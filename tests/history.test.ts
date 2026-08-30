import { test } from "node:test";
import assert from "node:assert/strict";
import { addToHistory } from "@/lib/sandbox/history";
import type { HistoryEntry } from "@/lib/types";

const entry = (sql: string): HistoryEntry => ({
  id: sql,
  sql,
  ranAt: 0,
  ok: true,
});

test("puts the newest query first", () => {
  const history = addToHistory([entry("select 1")], { sql: "select 2", ok: true });

  assert.deepEqual(
    history.map((item) => item.sql),
    ["select 2", "select 1"],
  );
});

test("trims surrounding whitespace before storing", () => {
  const [newest] = addToHistory([], { sql: "  select 1  \n", ok: true });
  assert.equal(newest.sql, "select 1");
});

test("moves a repeated query to the top instead of duplicating it", () => {
  const history = addToHistory([entry("select 1"), entry("select 2")], {
    sql: "select 2",
    ok: true,
  });

  assert.deepEqual(
    history.map((item) => item.sql),
    ["select 2", "select 1"],
  );
});

test("remembers queries that failed", () => {
  const [newest] = addToHistory([], { sql: "select oops", ok: false });
  assert.equal(newest.ok, false);
});

test("keeps at most fifty entries", () => {
  let history: HistoryEntry[] = [];

  for (let i = 0; i < 60; i++) {
    history = addToHistory(history, { sql: `select ${i}`, ok: true });
  }

  assert.equal(history.length, 50);
  assert.equal(history[0].sql, "select 59");
});
