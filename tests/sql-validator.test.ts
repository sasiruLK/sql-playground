import test from "node:test";
import assert from "node:assert/strict";
import { validateReadOnlySql } from "@/lib/sql-validator";

test("allows a basic select query", () => {
  const result = validateReadOnlySql("select * from customers;");
  assert.equal(result.ok, true);
});

test("allows a with query that resolves to select", () => {
  const result = validateReadOnlySql(
    "with recent as (select * from orders) select * from recent;",
  );
  assert.equal(result.ok, true);
});

test("rejects write statements", () => {
  const result = validateReadOnlySql("delete from orders");
  assert.deepEqual(result, {
    ok: false,
    reason: "Only read-only SELECT queries are allowed.",
  });
});

test("rejects multiple statements", () => {
  const result = validateReadOnlySql("select * from customers; select * from orders;");
  assert.deepEqual(result, {
    ok: false,
    reason: "Only one SQL statement is allowed per request.",
  });
});

test("rejects transaction control", () => {
  const result = validateReadOnlySql("begin");
  assert.deepEqual(result, {
    ok: false,
    reason: "Only read-only SELECT queries are allowed.",
  });
});

test("rejects comment-obfuscated input", () => {
  const result = validateReadOnlySql("select * from customers -- hidden");
  assert.deepEqual(result, {
    ok: false,
    reason: "Comments are not allowed in playground queries.",
  });
});
