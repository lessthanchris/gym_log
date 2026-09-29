import { NextResponse } from "next/server";

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(what = "Not found") {
  return NextResponse.json({ error: what }, { status: 404 });
}

/** Parse a positive integer route param, or return null. */
export function parseId(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const isUnit = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

/** Validate the geometry fields of a hold payload (all normalized to 0..1). */
export function readBox(body: Record<string, unknown>, partial: boolean) {
  const box: { x?: number; y?: number; w?: number; h?: number } = {};
  for (const k of ["x", "y", "w", "h"] as const) {
    if (body[k] === undefined) {
      if (!partial) return null;
      continue;
    }
    if (!isUnit(body[k])) return null;
    box[k] = body[k];
  }
  return box;
}

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
}

/** Trim a string field; returns undefined when absent and null when invalid. */
export function readText(v: unknown, max = 100): string | undefined | null {
  if (v === undefined) return undefined;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}
