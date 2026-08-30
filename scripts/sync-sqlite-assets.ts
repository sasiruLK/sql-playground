/**
 * Copies the SQLite WASM runtime out of node_modules into public/sqlite so the
 * worker can load it with a plain URL import, bypassing the bundler entirely.
 * Runs before every build; the copied files are gitignored.
 */
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const FROM = join(ROOT, "node_modules", "@sqlite.org", "sqlite-wasm", "dist");
const TO = join(ROOT, "public", "sqlite");

mkdirSync(TO, { recursive: true });
cpSync(FROM, TO, { recursive: true });

console.log("Synced SQLite WASM runtime -> public/sqlite");
