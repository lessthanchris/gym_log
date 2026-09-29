import { NextResponse } from "next/server";
import { createAscent, getRoute } from "@/lib/db";
import { badRequest, notFound, parseId, readJson, readText } from "@/lib/http";
import { ASCENT_STYLES, type AscentStyle } from "@/lib/types";

export async function POST(req: Request, ctx: RouteContext<"/api/routes/[id]/ascents">) {
  const id = parseId((await ctx.params).id);
  if (!id || !getRoute(id)) return notFound("Route not found");
  const body = await readJson(req);
  const climber = body && readText(body.climber, 50);
  if (!body || !climber) return badRequest("Say who climbed it (up to 50 characters).");
  if (!ASCENT_STYLES.includes(body.style as AscentStyle)) {
    return badRequest(`style must be one of ${ASCENT_STYLES.join(", ")}.`);
  }
  return NextResponse.json(createAscent(id, climber, body.style as AscentStyle), { status: 201 });
}
