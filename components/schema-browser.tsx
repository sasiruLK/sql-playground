"use client";

import { useState } from "react";
import type { TableInfo } from "@/lib/types";

const NOT_CHOSEN = Symbol("no-table-chosen");

/**
 * The live schema, read back from the Sandbox after every query, so a student
 * who runs DDL sees their own tables here. Tapping a name inserts it into the
 * editor, which matters most on phones where typing identifiers is slow.
 */
export function SchemaBrowser({
  schema,
  onInsert,
}: {
  schema: TableInfo[];
  onInsert: (text: string) => void;
}) {
  // The schema arrives after mount, so "untouched" has to be distinct from
  // "explicitly collapsed" for the first table to start open.
  const [chosen, setChosen] = useState<string | null | typeof NOT_CHOSEN>(NOT_CHOSEN);

  if (schema.length === 0) {
    return <p className="empty-state">No tables. Run a Reset to bring the dataset back.</p>;
  }

  const open = chosen === NOT_CHOSEN ? schema[0].name : chosen;

  return (
    <ul className="schema-list">
      {schema.map((table) => {
        const isOpen = open === table.name;

        return (
          <li key={table.name} className="schema-table">
            <div className="schema-table-row">
              <button
                type="button"
                className="schema-toggle"
                aria-expanded={isOpen}
                onClick={() => setChosen(isOpen ? null : table.name)}
              >
                <span className={`schema-caret${isOpen ? " is-open" : ""}`} aria-hidden="true">
                  ▸
                </span>
                <strong>{table.name}</strong>
                <span className="panel-subtle">{table.rowCount.toLocaleString()} rows</span>
              </button>
              <button
                type="button"
                className="schema-insert"
                onClick={() => onInsert(table.name)}
                title={`Insert ${table.name}`}
                aria-label={`Insert ${table.name} into the editor`}
              >
                +
              </button>
            </div>

            {isOpen ? (
              <ul className="schema-columns">
                {table.columns.map((column) => (
                  <li key={column.name}>
                    <button type="button" onClick={() => onInsert(column.name)}>
                      <code>{column.name}</code>
                      <span className="panel-subtle">
                        {column.type.toLowerCase()}
                        {column.primaryKey ? " · pk" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
