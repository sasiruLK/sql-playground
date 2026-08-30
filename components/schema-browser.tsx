"use client";

import { useState } from "react";
import { ChevronRight, Plus, KeyRound } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NOT_CHOSEN = Symbol("no-table-chosen");

import type { TableInfo } from "@/lib/types";

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
    return (
      <p className="px-2 py-6 text-center text-sm text-muted-foreground">
        No tables. Run a Reset to bring the dataset back.
      </p>
    );
  }

  const open = chosen === NOT_CHOSEN ? schema[0].name : chosen;

  return (
    <ul className="space-y-px" data-testid="schema-browser">
      {schema.map((table) => {
        const isOpen = open === table.name;

        return (
          <li key={table.name}>
            <Collapsible
              open={isOpen}
              onOpenChange={(next) => setChosen(next ? table.name : null)}
            >
              <div className="flex items-center gap-1">
                <CollapsibleTrigger
                  data-testid="schema-table"
                  className="flex min-h-11 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ChevronRight
                    className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                  <span className="flex-1 truncate font-mono text-[13px] font-medium">
                    {table.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                    {table.rowCount.toLocaleString()}
                  </span>
                </CollapsibleTrigger>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0 text-muted-foreground"
                        onClick={() => onInsert(table.name)}
                        aria-label={`Insert ${table.name} into the editor`}
                      >
                        <Plus />
                      </Button>
                    }
                  />
                  <TooltipContent side="left">Insert into editor</TooltipContent>
                </Tooltip>
              </div>

              <CollapsibleContent>
                <ul className="mb-1 ml-4 border-l pl-2">
                  {table.columns.map((column) => (
                    <li key={column.name}>
                      <button
                        type="button"
                        onClick={() => onInsert(column.name)}
                        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          {column.primaryKey ? (
                            <KeyRound className="size-3 shrink-0 text-muted-foreground" />
                          ) : null}
                          <span className="truncate font-mono text-[12px]">
                            {column.name}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {column.type.toLowerCase()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </li>
        );
      })}
    </ul>
  );
}
