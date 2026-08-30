import { Playground } from "@/components/playground";

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="masthead">
        <div>
          <h1>SQL Playground</h1>
          <p>
            A Superstore database of your own. Every query runs in your browser, so
            nothing you do here reaches anyone else.
          </p>
        </div>
      </header>

      <Playground />
    </main>
  );
}
