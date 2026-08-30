"use client";

/**
 * Results can be arbitrarily wide, so the table scrolls inside its own box
 * rather than pushing the page sideways, and keeps its header visible while the
 * student scrolls down a long result.
 */
export function ResultsTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: unknown[][];
}) {
  return (
    <div className="results-wrap" tabIndex={0} role="region" aria-label="Query results">
      <table className="results-table">
        <thead>
          <tr>
            <th className="row-number" scope="col">
              #
            </th>
            {columns.map((column, index) => (
              <th key={`${column}-${index}`} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td className="row-number">{rowIndex + 1}</td>
              {row.map((value, cellIndex) => (
                <td
                  key={cellIndex}
                  className={typeof value === "number" ? "is-number" : undefined}
                >
                  {formatCell(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) {
    return <span className="is-null">null</span>;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toString();
  }

  return String(value);
}
