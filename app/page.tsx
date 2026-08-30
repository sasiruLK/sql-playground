import { Database } from "lucide-react";
import { Playground } from "@/components/playground";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-4 p-4 sm:gap-5 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card">
            <Database className="size-4" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              SQL Playground
            </h1>
            <p className="text-sm text-balance text-muted-foreground">
              A Superstore database of your own. Every query runs in your browser, so
              nothing you do here reaches anyone else.
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main>
        <Playground />
      </main>
    </div>
  );
}
