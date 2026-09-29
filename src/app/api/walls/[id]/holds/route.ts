import { NextResponse } from "next/server";
import { createHold, getRoute, getWall } from "@/lib/db";
import { badRequest, notFound, parseId, readBox, readJson } from "@/lib/http";

export async function POST(req: Request, ctx: RouteContext<"/api/walls/[id]/holds">) {
  const id = parseId((await ctx.params).id);
  if (!id || !getWall(id)) return notFound("Wall not found");
  const body = await readJson(req);
  const box = body && readBox(body, false);
  if (!body || !box) return badRequest("A hold needs x, y, w, h between 0 and 1.");
  const routeId = body.route_id ?? null;
  if (routeId !== null && (typeof routeId !== "number" || getRoute(routeId)?.wall_id !== id)) {
    return badRequest("route_id must be a route on this wall.");
  }
  return NextResponse.json(
    createHold(id, { route_id: routeId, x: box.x!, y: box.y!, w: box.w!, h: box.h! }),
    { status: 201 },
  );
}
