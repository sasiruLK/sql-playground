"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Loader2, TriangleAlert, HardDriveDownload } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Status =
  | { kind: "starting" }
  | { kind: "failed"; message: string }
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | { kind: "success"; result: QueryResult };

export function Playground() {
  const [sql, setSql] = useState(DEFAULT_QUERY);
  const [status, setStatus] = useState<Status>({ kind: "starting" });
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [storage, setStorage] = useState<SandboxStorage>("opfs");
  const [storageReason, setStorageReason] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [confirmingReset, setConfirmingReset] = useState(false);
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
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(17rem,1fr)] lg:grid-rows-[min-content_1fr] lg:items-stretch">
        {/* Editor */}
        <Card className="gap-0 overflow-hidden py-0 lg:col-start-1 lg:row-start-1">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3">
            <CardTitle className="text-sm font-medium">Your database</CardTitle>
            <StorageBadge storage={storage} status={status} />
          </CardHeader>

          {storage === "memory" && storageReason ? (
            <p className="flex items-start gap-2 border-b bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              {storageReason}
            </p>
          ) : null}

          <CardContent className="p-0">
            <SqlEditor value={sql} onChange={setSql} onRun={run} schema={schema} />
          </CardContent>

          <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-4 py-3">
            <Button
              size="lg"
              className="h-11 sm:h-9"
              onClick={run}
              disabled={busy}
              data-testid="run"
            >
              {status.kind === "running" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Play />
              )}
              Run
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => setConfirmingReset(true)}
              disabled={busy}
              data-testid="reset"
            >
              <RotateCcw />
              Reset data
            </Button>
            <span className="ml-auto hidden text-[11px] text-muted-foreground sm:block">
              <Kbd>Ctrl</Kbd>
              <span className="mx-1">/</span>
              <Kbd>⌘</Kbd>
              <span className="mx-1">+</span>
              <Kbd>Enter</Kbd>
            </span>
          </div>
        </Card>

        {/* Results */}
        <Card
          className="gap-0 overflow-hidden py-0 lg:col-start-1 lg:row-start-2"
          data-testid="results-panel"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3">
            <CardTitle className="text-sm font-medium">Results</CardTitle>
            <ResultSummary status={status} />
          </CardHeader>
          <CardContent className="p-0">
            <ResultsBody status={status} />
          </CardContent>
        </Card>

        {/* Sidebar */}
        <Card className="gap-0 overflow-hidden py-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <Tabs defaultValue="tables" className="min-h-0 flex-1 gap-0">
            <TabsList variant="line" className="w-full rounded-none border-b p-0">
              <TabsTrigger
                value="tables"
                className="h-11 flex-1 rounded-none"
                data-testid="tab-tables"
              >
                Tables
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="h-11 flex-1 rounded-none"
                data-testid="tab-history"
              >
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="tables"
              className="min-h-0 overflow-y-auto p-2 lg:max-h-[calc(100vh-8rem)]"
            >
              {status.kind === "starting" ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <SchemaBrowser schema={schema} onInsert={insertIntoEditor} />
              )}

              <div className="mt-4 border-t pt-3">
                <h3 className="meta-label px-2 pb-2">
                  Examples
                </h3>
                <div className="space-y-1">
                  {SAMPLE_QUERIES.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => setSql(sample.sql)}
                      className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="block text-[13px] font-medium">
                        {sample.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {sample.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="history"
              className="min-h-0 overflow-y-auto p-2 lg:max-h-[calc(100vh-8rem)]"
            >
              <HistoryList history={history} onPick={setSql} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <AlertDialog open={confirmingReset} onOpenChange={setConfirmingReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore the original data?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything you have changed in your own database will be discarded and
              the LankaKart dataset put back as it was. Your query history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 sm:h-9"
              onClick={reset}
              data-testid="confirm-reset"
            >
              Reset data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">
      {children}
    </kbd>
  );
}

function StorageBadge({ storage, status }: { storage: SandboxStorage; status: Status }) {
  if (status.kind === "starting") {
    return <Skeleton className="h-5 w-28" />;
  }

  if (storage === "memory") {
    return (
      <Badge variant="outline" className="gap-1 text-amber-700 dark:text-amber-400">
        <TriangleAlert className="size-3" />
        Not saved on refresh
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1" data-testid="storage-badge">
      <HardDriveDownload className="size-3" />
      Saved in this browser
    </Badge>
  );
}

function ResultSummary({ status }: { status: Status }) {
  const className = "font-mono text-xs text-muted-foreground tabular-nums";

  if (status.kind !== "success") {
    return <span className={className}>Ready</span>;
  }

  const { result } = status;
  const shown = result.rows.length;

  if (result.columns.length === 0) {
    return (
      <span className={className} data-testid="result-summary">
        {result.rowsChanged} {result.rowsChanged === 1 ? "row" : "rows"} changed ·{" "}
        {result.elapsedMs} ms
      </span>
    );
  }

  return (
    <span className={className} data-testid="result-summary">
      {result.truncated
        ? `${shown.toLocaleString()} of ${result.rowsScanned.toLocaleString()} rows`
        : `${shown.toLocaleString()} ${shown === 1 ? "row" : "rows"}`}{" "}
      · {result.elapsedMs} ms
    </span>
  );
}

function ResultsBody({ status }: { status: Status }) {
  const empty = "px-4 py-10 text-center text-sm text-muted-foreground";

  switch (status.kind) {
    case "starting":
      return (
        <div className="space-y-2 p-4">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      );

    case "failed":
      return (
        <p
          className="m-4 rounded-md bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive"
          data-testid="error"
        >
          The database engine could not start: {status.message}
        </p>
      );

    case "error":
      return (
        <p
          className="m-4 rounded-md bg-destructive/10 px-3 py-2 font-mono text-xs leading-relaxed text-destructive"
          data-testid="error"
        >
          {status.message}
        </p>
      );

    case "running":
      return (
        <p className={empty}>
          <Loader2 className="mr-2 inline size-4 animate-spin" />
          Running…
        </p>
      );

    case "success": {
      const { result } = status;

      if (result.columns.length === 0) {
        return (
          <p className={empty} data-testid="write-result">
            Done. {result.rowsChanged}{" "}
            {result.rowsChanged === 1 ? "row was" : "rows were"} changed.
          </p>
        );
      }

      if (result.rows.length === 0) {
        return <p className={empty}>The query ran, but matched no rows.</p>;
      }

      return (
        <>
          {result.aborted ? (
            <p className="border-b bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              Stopped after {result.rowsScanned.toLocaleString()} rows — that query
              returns more data than the page can hold. Try adding a{" "}
              <code className="font-mono">where</code> or{" "}
              <code className="font-mono">limit</code>.
            </p>
          ) : null}
          <ResultsTable columns={result.columns} rows={result.rows} />
        </>
      );
    }

    default:
      return (
        <p className={empty}>
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
    return (
      <p className="px-2 py-6 text-center text-sm text-muted-foreground">
        Queries you run will show up here.
      </p>
    );
  }

  return (
    <ul className="space-y-px" data-testid="history-list">
      {history.map((entry) => (
        <li key={entry.id}>
          <button
            onClick={() => onPick(entry.sql)}
            title="Put this back in the editor"
            className="flex min-h-11 w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span
              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                entry.ok ? "bg-emerald-500" : "bg-destructive"
              }`}
              aria-hidden="true"
            />
            <code className="line-clamp-2 font-mono text-[11px] leading-relaxed break-all text-muted-foreground">
              {entry.sql}
            </code>
          </button>
        </li>
      ))}
    </ul>
  );
}
