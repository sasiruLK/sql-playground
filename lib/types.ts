export type QueryResponseSuccess = {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  elapsedMs: number;
};

export type QueryResponseError = {
  error: string;
};

export type SampleQuery = {
  id: string;
  title: string;
  description: string;
  sql: string;
};
