"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Results can be arbitrarily wide, so the table scrolls inside its own box
 * rather than pushing the page sideways, and keeps its header and row numbers
 * pinned while the student scrolls.
 */
export function ResultsTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: unknown[][];
}) {
  return (
    <Table
      // One box scrolls both ways, so the sticky header and the sticky row
      // numbers share a single scroll container.
      containerClassName="max-h-[min(60vh,34rem)] overflow-auto overscroll-x-contain"
      containerProps={{
        tabIndex: 0,
        role: "region",
        "aria-label": "Query results",
        "data-testid": "results-scroll",
      }}
      className="w-max min-w-full font-mono text-xs"
    >
      <TableHeader className="sticky top-0 z-20">
        <TableRow className="bg-muted hover:bg-muted">
          <TableHead
            scope="col"
            className="sticky left-0 z-10 w-12 bg-muted text-right text-muted-foreground"
          >
            #
          </TableHead>
          {columns.map((column, index) => (
            <TableHead
              key={`${column}-${index}`}
              scope="col"
              className="bg-muted font-medium whitespace-nowrap text-foreground"
            >
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={rowIndex} className="group">
            <TableCell className="sticky left-0 z-10 bg-background text-right text-muted-foreground tabular-nums group-hover:bg-muted/50">
              {rowIndex + 1}
            </TableCell>
            {row.map((value, cellIndex) => (
              <TableCell
                key={cellIndex}
                className={cn(
                  "max-w-80 truncate whitespace-nowrap",
                  typeof value === "number" && "text-right tabular-nums",
                )}
              >
                {formatCell(value)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/60 italic">null</span>;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toString();
  }

  return String(value);
}
