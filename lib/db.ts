import { Pool, types as pgTypes, type QueryResultRow } from "pg";
import type { QueryResponseSuccess } from "@/lib/types";

const QUERY_TIMEOUT_MS = 5000;
const MAX_RESULT_ROWS = 100;

pgTypes.setTypeParser(20, (value: string) => Number(value));
pgTypes.setTypeParser(1700, (value: string) => Number(value));

let pool: Pool | null = null;

export class QueryExecutionError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "QueryExecutionError";
  }
}

export async function executeReadOnlyQuery(sql: string): Promise<QueryResponseSuccess> {
  const db = getPool();
  const startedAt = performance.now();

  const wrappedSql = `select * from (${sql}) as playground_result limit ${MAX_RESULT_ROWS}`;

  try {
    const queryPromise = db.query(wrappedSql);
    const result = await withTimeout(queryPromise, QUERY_TIMEOUT_MS);

    return {
      columns: result.fields.map((field) => field.name),
      rows: result.rows.map((row: QueryResultRow) =>
        result.fields.map((field) => row[field.name]),
      ),
      rowCount: result.rowCount ?? result.rows.length,
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    if (error instanceof QueryExecutionError) {
      throw error;
    }

    throw new QueryExecutionError(
      "The query could not be executed against the demo dataset.",
      400,
    );
  }
}

function getPool() {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new QueryExecutionError(
      "DATABASE_URL is not configured on the server.",
      500,
    );
  }

  pool = new Pool({
    connectionString,
    max: 3,
    ssl: connectionString.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });

  return pool;
}

export const DB_LIMITS = {
  QUERY_TIMEOUT_MS,
  MAX_RESULT_ROWS,
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new QueryExecutionError(
              "The query exceeded the execution time limit.",
              408,
            ),
          );
        }, timeoutMs);

        timeoutId.unref?.();
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
