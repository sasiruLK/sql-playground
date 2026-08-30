export type ColumnInfo = {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
};

export type TableInfo = {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
};

export type QueryResult = {
  columns: string[];
  rows: unknown[][];
  /** Total rows the query produced, which may exceed the rows sent for display. */
  rowsScanned: number;
  /** Rows written by the last statement; only meaningful for INSERT/UPDATE/DELETE. */
  rowsChanged: number;
  truncated: boolean;
  aborted: boolean;
  elapsedMs: number;
};

/**
 * Where the Sandbox lives. `opfs` survives a refresh; `memory` does not, which
 * the student is warned about.
 */
export type SandboxStorage = "opfs" | "memory";

export type SampleQuery = {
  id: string;
  title: string;
  description: string;
  sql: string;
};

export type HistoryEntry = {
  id: string;
  sql: string;
  ranAt: number;
  ok: boolean;
};
