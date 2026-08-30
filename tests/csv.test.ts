import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "@/lib/seed/csv";

test("parses a simple header and row", () => {
  assert.deepEqual(parseCsv("a,b\n1,2"), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("keeps commas inside quoted fields", () => {
  assert.deepEqual(parseCsv('a,b\n"Chairs, Rounded Back",2'), [
    ["a", "b"],
    ["Chairs, Rounded Back", "2"],
  ]);
});

test("unescapes doubled quotes inside quoted fields", () => {
  assert.deepEqual(parseCsv('a\n"He said ""hi"""'), [["a"], ['He said "hi"']]);
});

test("handles newlines inside quoted fields", () => {
  assert.deepEqual(parseCsv('a,b\n"one\ntwo",3'), [
    ["a", "b"],
    ["one\ntwo", "3"],
  ]);
});

test("handles CRLF line endings", () => {
  assert.deepEqual(parseCsv("a,b\r\n1,2\r\n"), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("preserves empty fields", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,,3"), [
    ["a", "b", "c"],
    ["1", "", "3"],
  ]);
});

test("ignores a trailing newline rather than emitting a blank row", () => {
  assert.deepEqual(parseCsv("a\n1\n"), [["a"], ["1"]]);
});
