import type { HistoryEntry } from "@/lib/types";

const KEY = "sql-playground:history";
const LIMIT = 50;

/**
 * Query history outlives a Reset on purpose: a student who wipes their data
 * usually wants the statement that did it back.
 */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isHistoryEntry).slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
  } catch {
    // A full or unavailable localStorage must not break running queries.
  }
}

export function addToHistory(
  entries: HistoryEntry[],
  entry: Omit<HistoryEntry, "id" | "ranAt">,
): HistoryEntry[] {
  const trimmed = entry.sql.trim();
  // Re-running the same statement should not fill the list with duplicates.
  const withoutRepeat = entries.filter((existing) => existing.sql !== trimmed);

  return [
    {
      ...entry,
      sql: trimmed,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ranAt: Date.now(),
    },
    ...withoutRepeat,
  ].slice(0, LIMIT);
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as HistoryEntry).id === "string" &&
    typeof (value as HistoryEntry).sql === "string" &&
    typeof (value as HistoryEntry).ranAt === "number" &&
    typeof (value as HistoryEntry).ok === "boolean"
  );
}
