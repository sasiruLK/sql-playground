/**
 * Owns the student's Sandbox: a private SQLite database living in this browser.
 *
 * Runs off the main thread so a slow query freezes nothing, and stores the
 * database in OPFS via the SAHPool VFS, which - unlike the plain `opfs` VFS -
 * needs no cross-origin isolation headers. When OPFS is unavailable (private
 * windows, older browsers, a second tab holding the pool) it falls back to an
 * in-memory database: fully working, but wiped on refresh.
 */
import sqlite3InitModule from "./sqlite/index.mjs";

// Changing this name is how a new dataset reaches students who already have a
// Sandbox: their old database no longer matches, so the new Seed is imported.
const DB_PATH = "/lankakart.sqlite";
const SEED_URL = "/seed.sqlite";
const POOL_NAME = "sql-playground";

/** Rows sent back for display. The query still runs in full. */
const DISPLAY_ROW_LIMIT = 500;
/** Rows a single query may produce before we abort it, to stop runaway joins. */
const SCAN_ROW_LIMIT = 200_000;

const ABORT = Symbol("row-limit");

/**
 * The SAHPool VFS can only be held by one worker at a time. After a reload the
 * previous page's worker may still be letting go of its file handles, so we
 * retry briefly before deciding persistence is genuinely unavailable.
 */
const POOL_ATTEMPTS = 6;
const POOL_RETRY_MS = 300;

let sqlite3 = null;
let pool = null;
let db = null;
let storage = "memory";
/** Why persistence was unavailable, surfaced so a stuck student is diagnosable. */
let storageReason = null;

/**
 * Claims the OPFS pool, retrying while a departing worker still holds it.
 * Returns null when persistence is genuinely unavailable, leaving
 * `storageReason` set to something a student can act on.
 */
async function acquirePool() {
  let lastError = null;

  for (let attempt = 0; attempt < POOL_ATTEMPTS; attempt++) {
    try {
      storageReason = null;
      return await sqlite3.installOpfsSAHPoolVfs({
        name: POOL_NAME,
        // sqlite-wasm caches a failed init and re-throws it, so without this
        // every retry would replay the first failure instead of trying again.
        forceReinitIfPreviouslyFailed: true,
      });
    } catch (error) {
      lastError = error;

      if (!isPoolLocked(error)) break;
      await new Promise((resolve) => setTimeout(resolve, POOL_RETRY_MS));
    }
  }

  storageReason = isPoolLocked(lastError)
    ? "This playground is already open in another tab. Close the other tab and reload to get your saved database back."
    : (lastError?.message ?? String(lastError));

  return null;
}

function isPoolLocked(error) {
  return /Access Handle|NoModificationAllowed|already open/i.test(
    error?.message ?? String(error ?? ""),
  );
}

async function fetchSeed() {
  const response = await fetch(SEED_URL, { cache: "force-cache" });

  if (!response.ok) {
    throw new Error(`Could not download the dataset (HTTP ${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function openInMemory(seed) {
  const fresh = new sqlite3.oo1.DB();
  const pointer = sqlite3.wasm.allocFromTypedArray(seed);

  fresh.checkRc(
    sqlite3.capi.sqlite3_deserialize(
      fresh.pointer,
      "main",
      pointer,
      seed.byteLength,
      seed.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
        sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
    ),
  );

  return fresh;
}

/** Opens the Sandbox, importing the Seed when there is nothing stored yet. */
async function open({ forceReseed }) {
  db?.close();
  db = null;

  if (pool) {
    // A database left behind by an earlier dataset would otherwise sit in the
    // pool forever, holding a slot nothing can ever open again.
    for (const name of pool.getFileNames()) {
      if (name !== DB_PATH) pool.unlink(name);
    }

    const needsSeed = forceReseed || !pool.getFileNames().includes(DB_PATH);

    if (needsSeed) {
      pool.importDb(DB_PATH, await fetchSeed());
    }

    db = new pool.OpfsSAHPoolDb(DB_PATH);
    storage = "opfs";
    return;
  }

  db = openInMemory(await fetchSeed());
  storage = "memory";
}

/**
 * Quotes an identifier the way SQLite does, by doubling embedded quotes.
 * JSON.stringify is not a substitute: it escapes with backslashes, which SQLite
 * does not understand, and would throw on a table a student named with a quote.
 */
function quoteIdentifier(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

/** Reads the live schema so the browser and autocomplete follow DDL changes. */
function readSchema() {
  const tables = [];

  const names = db.exec({
    sql: "select name from sqlite_schema where type = 'table' and name not like 'sqlite_%' order by name",
    rowMode: "array",
    returnValue: "resultRows",
  });

  for (const [name] of names) {
    const columns = db.exec({
      sql: `pragma table_info(${quoteIdentifier(name)})`,
      rowMode: "object",
      returnValue: "resultRows",
    });

    tables.push({
      name,
      columns: columns.map((column) => ({
        name: column.name,
        type: column.type || "any",
        notNull: Boolean(column.notnull),
        primaryKey: Boolean(column.pk),
      })),
      rowCount: db.selectValue(`select count(*) from ${quoteIdentifier(name)}`),
    });
  }

  return tables;
}

function run(sql) {
  const started = performance.now();
  const rows = [];
  let columns = [];
  let scanned = 0;
  let aborted = false;
  // Connection-scoped and never reset, so only the delta describes this query.
  const changesBefore = sqlite3.capi.sqlite3_total_changes(db.pointer);

  try {
    db.exec({
      sql,
      rowMode: "array",
      columnNames: columns,
      callback: (row) => {
        scanned++;

        if (rows.length < DISPLAY_ROW_LIMIT) {
          rows.push(row.map(toTransferable));
        }

        if (scanned >= SCAN_ROW_LIMIT) {
          throw ABORT;
        }
      },
    });
  } catch (error) {
    if (error !== ABORT) throw error;
    aborted = true;
  }

  return {
    columns: [...columns],
    rows,
    rowsScanned: scanned,
    rowsChanged: sqlite3.capi.sqlite3_total_changes(db.pointer) - changesBefore,
    truncated: scanned > rows.length,
    aborted,
    elapsedMs: Math.round(performance.now() - started),
  };
}

/** BigInt and typed arrays cannot cross a postMessage boundary as-is. */
function toTransferable(value) {
  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }

  if (value instanceof Uint8Array) {
    return `<${value.byteLength} byte blob>`;
  }

  return value;
}

function reply(id, payload) {
  postMessage({ id, ...payload });
}

self.onmessage = async (event) => {
  const { id, type, sql } = event.data;

  try {
    switch (type) {
      case "init": {
        sqlite3 = await sqlite3InitModule();

        pool = await acquirePool();

        await open({ forceReseed: false });
        reply(id, { ok: true, storage, storageReason, schema: readSchema() });
        break;
      }

      case "query": {
        const result = run(sql);
        reply(id, { ok: true, result, schema: readSchema() });
        break;
      }

      // Hands the OPFS pool back before this worker goes away. Without it the
      // access handles linger past terminate(), and the next worker - a React
      // remount in dev, or a new tab - is locked out of the saved database.
      case "release": {
        db?.close();
        db = null;
        pool?.pauseVfs();
        reply(id, { ok: true });
        break;
      }

      case "reset": {
        await open({ forceReseed: true });
        reply(id, { ok: true, storage, storageReason, schema: readSchema() });
        break;
      }

      default:
        reply(id, { ok: false, error: `Unknown request: ${type}` });
    }
  } catch (error) {
    reply(id, { ok: false, error: error?.message ?? String(error) });
  }
};
