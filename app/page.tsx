import { Playground } from "@/components/playground";
import { SAMPLE_QUERIES } from "@/lib/sample-queries";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">Public Demo</span>
        <h1>Query a live Postgres sandbox.</h1>
        <p>
          This playground runs read-only SQL against a seeded commerce dataset.
          It is built for Vercel, so query execution stays server-side and
          responses come back as simple tables.
        </p>
      </section>

      <div className="grid">
        <Playground sampleQueries={SAMPLE_QUERIES} />

        <aside className="grid">
          <section className="panel">
            <div className="panel-header">
              <h3>Demo tables</h3>
              <span className="panel-subtle">3 tables</span>
            </div>
            <ul className="note-list">
              <li>
                <strong>customers</strong>: account profile, tier, city,
                created date
              </li>
              <li>
                <strong>products</strong>: sku, category, unit price,
                inventory
              </li>
              <li>
                <strong>orders</strong>: order facts with joins to customers and
                products
              </li>
            </ul>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Rules</h3>
              <span className="panel-subtle">Read-only</span>
            </div>
            <ul className="note-list">
              <li>Only single-statement read queries are accepted.</li>
              <li>Writes, schema changes, and transaction commands are blocked.</li>
              <li>Each request has a row cap, length cap, and timeout.</li>
            </ul>
          </section>
        </aside>
      </div>

      <p className="footer">
        Seed the demo schema with <code>db/seed.sql</code> and set{" "}
        <code>DATABASE_URL</code> before deploying to Vercel.
      </p>
    </main>
  );
}
