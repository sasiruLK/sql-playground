const ALLOWED_FIRST_KEYWORDS = new Set(["select", "with"]);
const BANNED_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "truncate",
  "grant",
  "revoke",
  "comment",
  "merge",
  "call",
  "copy",
  "vacuum",
  "analyze",
  "refresh",
  "reindex",
  "cluster",
  "listen",
  "notify",
  "unlisten",
  "begin",
  "commit",
  "rollback",
  "savepoint",
  "release",
  "set",
  "reset",
  "show",
  "prepare",
  "execute",
  "deallocate",
  "do",
  "security",
];

export const MAX_QUERY_LENGTH = 4000;

export type ValidationResult =
  | { ok: true; normalizedSql: string }
  | { ok: false; reason: string };

export function validateReadOnlySql(sql: string): ValidationResult {
  const trimmed = sql.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: "Query text cannot be empty." };
  }

  if (hasSqlComments(trimmed)) {
    return {
      ok: false,
      reason: "Comments are not allowed in playground queries.",
    };
  }

  const normalizedSql = stripTrailingSemicolon(trimmed);

  if (containsMultipleStatements(normalizedSql)) {
    return {
      ok: false,
      reason: "Only one SQL statement is allowed per request.",
    };
  }

  const collapsed = collapseWhitespace(normalizedSql).toLowerCase();
  const firstKeyword = collapsed.split(" ", 1)[0];

  if (!ALLOWED_FIRST_KEYWORDS.has(firstKeyword)) {
    return {
      ok: false,
      reason: "Only read-only SELECT queries are allowed.",
    };
  }

  if (firstKeyword === "with" && !/\bselect\b/.test(collapsed)) {
    return {
      ok: false,
      reason: "WITH queries must end in a SELECT statement.",
    };
  }

  for (const keyword of BANNED_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(collapsed)) {
      return {
        ok: false,
        reason: `The keyword "${keyword}" is not allowed in this playground.`,
      };
    }
  }

  return { ok: true, normalizedSql };
}

function hasSqlComments(sql: string) {
  return sql.includes("--") || sql.includes("/*") || sql.includes("*/");
}

function containsMultipleStatements(sql: string) {
  return sql.includes(";");
}

function stripTrailingSemicolon(sql: string) {
  return sql.endsWith(";") ? sql.slice(0, -1).trimEnd() : sql;
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
