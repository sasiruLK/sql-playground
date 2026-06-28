# SQL Playground

A Vercel-ready Next.js SQL playground for running safe read-only Postgres queries against a seeded demo dataset.

## Features

- Public single-page SQL playground UI
- Server-side query execution through `/api/query`
- Conservative read-only SQL validator
- In-memory rate limiting, query length cap, row cap, and timeout
- Seed script for demo `customers`, `products`, and `orders` tables

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create an environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Provision a Postgres database and set `DATABASE_URL`.

4. Seed the database with [`db/seed.sql`](db/seed.sql).

5. Run the app:

   ```bash
   npm run dev
   ```

## Deploying to Vercel

1. Create a Postgres database compatible with Vercel serverless runtimes.
2. Add `DATABASE_URL` in the Vercel project environment variables.
3. Seed the database before exposing the app publicly.
4. Deploy with the default Next.js settings.

## Notes

- The in-memory rate limiter is acceptable for a first deployment but should move to a shared backing store for multi-instance production usage.
- The validator is intentionally strict. It favors blocking ambiguous SQL over allowing risky input.
