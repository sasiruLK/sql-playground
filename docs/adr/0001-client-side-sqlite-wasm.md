# SQL executes client-side in SQLite WASM, not on a server

The playground must let ~100 concurrent anonymous students run arbitrary SQL — including DROP/DELETE — against their own Sandbox without affecting anyone else. We ship a full SQLite engine to the browser (`@sqlite.org/sqlite-wasm`): each browser copies the Seed into OPFS and mutates it locally, so isolation is physical rather than enforced, and server cost is zero regardless of student count.

## Consequences

- The Postgres path (`pg`, `lib/db.ts`, `DATABASE_URL`) and the regex SQL validator (`lib/sql-validator.ts`) are deleted — there is no shared database left to protect. Do not "fix" the missing server-side validation; its absence is the design.
- Dialect is SQLite, not Postgres. Acceptable because the curriculum teaches generic SQL.
- Rejected: per-student Postgres schemas/databases on a server (provisioning, cleanup, connection limits, real infra — none of it needed) and DuckDB-WASM (a much larger download, analytics-oriented, weaker fit for teaching DML).
- A student's work lives only in their own browser (OPFS). Nothing can be observed or graded server-side; a teacher dashboard would require revisiting this decision.
- We use the `opfs-sahpool` VFS rather than the plain `opfs` one specifically because it needs no COOP/COEP cross-origin isolation headers, which keeps the Vercel deployment configuration-free. The cost is that the VFS is exclusive to one tab: a second tab of the playground falls back to an in-memory database. The worker retries briefly before giving up, because a reload can race the departing worker's file handles.
