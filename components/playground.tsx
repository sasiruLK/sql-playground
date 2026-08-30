"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sandbox } from "@/lib/sandbox/client";
import { addToHistory, loadHistory, saveHistory } from "@/lib/sandbox/history";
import { DEFAULT_QUERY, SAMPLE_QUERIES } from "@/lib/sample-queries";
import type {
  HistoryEntry,
  QueryResult,
  SandboxStorage,
  TableInfo,
} from "@/lib/types";
import { SqlEditor } from "@/components/sql-editor";
import { SchemaBrowser } from "@/components/schema-browser";
import { ResultsTable } from "@/components/results-table";

type Status =
  | { kind: "starting" }
  | { kind: "failed"; message: string }
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | { kind: "success"; result: QueryResult };

/** Which side panel is showing on narrow screens, where both cannot fit. */
type Panel = "schema" | "history";

export function Playground() {
  const [sql, setSql] = useState(DEFAULT_QUERY);
  const [status, setStatus] = useState<Status>({ kind: "starting" });
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [storage, setStorage] = useState<SandboxStorage>("opfs");
  const [storageReason, setStorageReason] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [panel, setPanel] = useState<Panel>("schema");
  const sandbox = useRef<Sandbox | null>(null);
  const statusRef = useRef<Status["kind"]>("starting");
  statusRef.current = status.kind;

  useEffect(() => {
    const { sandbox: instance, ready } = Sandbox.open();
    sandbox.current = instance;
    setHistory(loadHistory());

    ready
      .then((snapshot) => {
        setSchema(snapshot.schema);
        setStorage(snapshot.storage);
        setStorageReason(snapshot.storageReason);
        setStatus({ kind: "idle" });
      })
      .catch((error: Error) => {
        setStatus({ kind: "failed", message: error.message });
      });

    return () => {
      instance.close();
      sandbox.current = null;
    };
  }, []);

  const run = useCallback(async () => {
    const instance = sandbox.current;
    if (!instance || !sql.trim()) return;
    // The editor's Ctrl+Enter shortcut bypasses the disabled Run button, so the
    // busy check has to live here too.
    if (statusRef.current === "starting" || statusRef.current === "running") return;

    setStatus({ kind: "running" });

    try {
      const { result, schema: next } = await instance.query(sql);
      setSchema(next);
      setStatus({ kind: "success", result });
      commitHistory(sql, true);
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
      commitHistory(sql, false);
    }

    function commitHistory(statement: string, ok: boolean) {
      setHistory((entries) => {
        const next = addToHistory(entries, { sql: statement, ok });
        saveHistory(next);
        return next;
      });
    }
  }, [sql]);

  const reset = useCallback(async () => {
    const instance = sandbox.current;
    if (!instance) return;
    if (statusRef.current === "starting" || statusRef.current === "running") return;

    const confirmed = window.confirm(
      "Restore the original Superstore data? Everything you have changed in your own database will be discarded. Your query history is kept.",
    );
    if (!confirmed) return;

    setStatus({ kind: "running" });

    try {
      const snapshot = await instance.reset();
      setSchema(snapshot.schema);
      setStorage(snapshot.storage);
      setStorageReason(snapshot.storageReason);
      setStatus({ kind: "idle" });
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
    }
  }, []);

  const insertIntoEditor = useCallback((text: string) => {
    setSql((current) => (current.endsWith(" ") ? current + text : `${current} ${text}`));
  }, []);

  const busy = status.kind === "running" || status.kind === "starting";

  return (
    <div className="workspace">
      <section className="panel editor-panel">
        <div className="panel-header">
          <h2>Your database</h2>
          <StorageBadge storage={storage} status={status} />
        </div>

        {storage === "memory" && storageReason ? (
          <p className="notice">{storageReason}</p>
        ) : null}

        <SqlEditor value={sql} onChange={setSql} onRun={run} schema={schema} />

        <div className="editor-actions">
          <button className="button" onClick={run} disabled={busy}>
            {status.kind === "running" ? "Running…" : "Run"}
          </button>
          <button className="secondary-button" onClick={reset} disabled={busy}>
            Reset data
          </button>
          <span className="hint">
            <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd>
          </span>
        </div>
      </section>

      <section className="panel results-panel">
        <div className="panel-header">
          <h2>Results</h2>
          <ResultSummary status={status} />
        </div>
        <ResultsBody status={status} />
      </section>

      <section className="panel side-panel">
        <div className="panel-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={panel === "schema"}
            className={panel === "schema" ? "is-active" : ""}
            onClick={() => setPanel("schema")}
          >
            Tables
          </button>
          <button
            role="tab"
            aria-selected={panel === "history"}
            className={panel === "history" ? "is-active" : ""}
            onClick={() => setPanel("history")}
          >
            History
          </button>
        </div>

        <div className="side-panel-body">
          {panel === "schema" ? (
            <>
              <SchemaBrowser schema={schema} onInsert={insertIntoEditor} />
              <div className="samples">
                <h3>Examples</h3>
                {SAMPLE_QUERIES.map((sample) => (
                  <button
                    key={sample.id}
                    className="sample-button"
                    onClick={() => setSql(sample.sql)}
                  >
                    <strong>{sample.title}</strong>
                    <span>{sample.description}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <HistoryList history={history} onPick={setSql} />
          )}
        </div>
      </section>
    </div>
  );
}

function StorageBadge({ storage, status }: { storage: SandboxStorage; status: Status }) {
  if (status.kind === "starting") {
    return <span className="panel-subtle">Starting…</span>;
  }

  if (storage === "memory") {
    return (
      <span className="badge badge-warn" title="This browser could not store your database.">
        Not saved on refresh
      </span>
    );
  }

  return <span className="badge">Saved in this browser</span>;
}

function ResultSummary({ status }: { status: Status }) {
  if (status.kind !== "success") return <span className="panel-subtle">Ready</span>;

  const { result } = status;
  const shown = result.rows.length;

  if (result.columns.length === 0) {
    return (
      <span className="panel-subtle">
        {result.rowsChanged} {result.rowsChanged === 1 ? "row" : "rows"} changed ·{" "}
        {result.elapsedMs} ms
      </span>
    );
  }

  return (
    <span className="panel-subtle">
      {result.truncated
        ? `${shown.toLocaleString()} of ${result.rowsScanned.toLocaleString()} rows`
        : `${shown.toLocaleString()} ${shown === 1 ? "row" : "rows"}`}{" "}
      · {result.elapsedMs} ms
    </span>
  );
}

function ResultsBody({ status }: { status: Status }) {
  switch (status.kind) {
    case "starting":
      return <p className="empty-state">Setting up your private copy of the dataset…</p>;

    case "failed":
      return (
        <p className="status error">
          The database engine could not start: {status.message}
        </p>
      );

    case "error":
      return <p className="status error">{status.message}</p>;

    case "running":
      return <p className="empty-state">Running…</p>;

    case "success": {
      const { result } = status;

      if (result.columns.length === 0) {
        return (
          <p className="status success">
            Done. {result.rowsChanged} {result.rowsChanged === 1 ? "row was" : "rows were"}{" "}
            changed.
          </p>
        );
      }

      if (result.rows.length === 0) {
        return <p className="empty-state">The query ran, but matched no rows.</p>;
      }

      return (
        <>
          {result.aborted ? (
            <p className="status error">
              Stopped after {result.rowsScanned.toLocaleString()} rows — that query
              returns more data than the page can hold. Try adding a{" "}
              <code>where</code> or <code>limit</code>.
            </p>
          ) : null}
          <ResultsTable columns={result.columns} rows={result.rows} />
        </>
      );
    }

    default:
      return (
        <p className="empty-state">
          Pick an example, or write your own query. This database is yours alone — you
          can change or delete anything in it.
        </p>
      );
  }
}

function HistoryList({
  history,
  onPick,
}: {
  history: HistoryEntry[];
  onPick: (sql: string) => void;
}) {
  if (history.length === 0) {
    return <p className="empty-state">Queries you run will show up here.</p>;
  }

  return (
    <ul className="history-list">
      {history.map((entry) => (
        <li key={entry.id}>
          <button onClick={() => onPick(entry.sql)} title="Put this back in the editor">
            <span className={`history-dot${entry.ok ? "" : " is-error"}`} aria-hidden="true" />
            <code>{entry.sql}</code>
          </button>
        </li>
      ))}
    </ul>
  );
}
