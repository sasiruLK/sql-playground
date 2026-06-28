import { NextRequest, NextResponse } from "next/server";
import { executeReadOnlyQuery, QueryExecutionError } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { MAX_QUERY_LENGTH, validateReadOnlySql } from "@/lib/sql-validator";
import type { QueryResponseError } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimit = enforceRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json<QueryResponseError>(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json<QueryResponseError>(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const sql = typeof payload === "object" && payload !== null ? (payload as { sql?: unknown }).sql : undefined;

  if (typeof sql !== "string" || sql.trim().length === 0) {
    return NextResponse.json<QueryResponseError>(
      { error: "A SQL string is required." },
      { status: 400 },
    );
  }

  if (sql.length > MAX_QUERY_LENGTH) {
    return NextResponse.json<QueryResponseError>(
      { error: `Queries must be ${MAX_QUERY_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  const validation = validateReadOnlySql(sql);
  if (!validation.ok) {
    return NextResponse.json<QueryResponseError>(
      { error: validation.reason },
      { status: 400 },
    );
  }

  try {
    const result = await executeReadOnlyQuery(validation.normalizedSql);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof QueryExecutionError) {
      return NextResponse.json<QueryResponseError>(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    return NextResponse.json<QueryResponseError>(
      { error: "The server could not complete the query." },
      { status: 500 },
    );
  }
}
