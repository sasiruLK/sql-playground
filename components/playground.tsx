"use client";

import { useState, useTransition } from "react";
import type { QueryResponseSuccess, SampleQuery } from "@/lib/types";

const DEFAULT_QUERY = `select
  c.city,
  count(*) as total_orders,
  round(avg(o.quantity * p.unit_price), 2) as avg_order_value
from orders o
join customers c on c.id = o.customer_id
join products p on p.id = o.product_id
group by c.city
order by avg_order_value desc;`;

type QueryState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; result: QueryResponseSuccess };

export function Playground({
  sampleQueries,
}: {
  sampleQueries: SampleQuery[];
}) {
  const [sql, setSql] = useState(DEFAULT_QUERY);
  const [state, setState] = useState<QueryState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function runQuery() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql }),
        });

        const payload = (await response.json()) as
          | QueryResponseSuccess
          | { error: string };

        if (isErrorPayload(payload)) {
          setState({
            kind: "error",
            message: payload.error ?? "Query failed.",
          });
          return;
        }

        if (!response.ok) {
          setState({
            kind: "error",
            message: "The server rejected the query.",
          });
          return;
        }

        setState({
          kind: "success",
          result: payload,
        });
      } catch {
        setState({
          kind: "error",
          message: "The request could not reach the server.",
        });
      }
    });
  }

  function resetToDefault() {
    setSql(DEFAULT_QUERY);
    setState({ kind: "idle" });
  }

  return (
    <>
      <section className="panel editor-panel">
        <div className="panel-header">
          <h2>SQL editor</h2>
          <span className="panel-subtle">Single read-only statement</span>
        </div>
        <div className="editor-body">
          <textarea
            className="sql-input"
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            spellCheck={false}
            aria-label="SQL query editor"
          />

          <div className="editor-actions">
            <div className="button-row">
              <button className="button" onClick={runQuery} disabled={isPending}>
                {isPending ? "Running..." : "Run query"}
              </button>
              <button
                className="secondary-button"
                onClick={resetToDefault}
                disabled={isPending}
              >
                Reset example
              </button>
            </div>
            <span className="panel-subtle">Result rows are capped server-side.</span>
          </div>
        </div>
      </section>

      <section className="grid">
        <section className="panel">
          <div className="panel-header">
            <h3>Sample queries</h3>
            <span className="panel-subtle">Starter prompts</span>
          </div>
          <div className="sample-list">
            {sampleQueries.map((sample) => (
              <button
                key={sample.id}
                className="sample-button"
                onClick={() => {
                  setSql(sample.sql);
                  setState({ kind: "idle" });
                }}
              >
                <strong>{sample.title}</strong>
                <span>{sample.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Results</h3>
            <span className="panel-subtle">
              {state.kind === "success"
                ? `${state.result.rowCount} rows in ${state.result.elapsedMs} ms`
                : "Ready"}
            </span>
          </div>

          <div className="editor-body">
            <StatusBlock state={state} />
          </div>

          {state.kind === "success" ? (
            state.result.rows.length > 0 ? (
              <div className="results-wrap">
                <table className="results-table">
                  <thead>
                    <tr>
                      {state.result.columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.result.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((value, cellIndex) => (
                          <td key={`${rowIndex}-${cellIndex}`}>
                            <code>{formatCell(value)}</code>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">The query ran successfully but returned no rows.</p>
            )
          ) : (
            <p className="empty-state">
              Try a sample query or edit the SQL directly, then run it to see
              tabular results here.
            </p>
          )}
        </section>
      </section>
    </>
  );
}

function StatusBlock({ state }: { state: QueryState }) {
  if (state.kind === "error") {
    return <p className="status error">{state.message}</p>;
  }

  if (state.kind === "success") {
    return (
      <p className="status success">
        Query completed successfully. Showing up to the configured row limit.
      </p>
    );
  }

  return (
    <p className="status idle">
      Read-only <code>SELECT</code> statements only. Multi-statement input is
      rejected.
    </p>
  );
}

function formatCell(value: unknown) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function isErrorPayload(
  payload: QueryResponseSuccess | { error: string },
): payload is { error: string } {
  return "error" in payload;
}
