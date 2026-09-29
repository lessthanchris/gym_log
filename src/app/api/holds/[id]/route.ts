import { NextResponse } from "next/server";
import { deleteHold, getHold, getRoute, updateHold } from "@/lib/db";
import { badRequest, notFound, parseId, readBox, readJson } from "@/lib/http";

export async function PATCH(req: Request, ctx: RouteContext<"/api/holds/[id]">) {
  const id = parseId((await ctx.params).id);
  const hold = id && getHold(id);
  if (!id || !hold) return notFound("Hold not found");
  const body = await readJson(req);
  const box = body && readBox(body, true);
  if (!body || !box) return badRequest("x, y, w, h must be between 0 and 1.");
  const routeId = body.route_id;
  if (routeId !== undefined && routeId !== null) {
    if (typeof routeId !== "number" || getRoute(routeId)?.wall_id !== hold.wall_id) {
      return badRequest("route_id must be a route on this hold's wall.");
    }
  }
  return NextResponse.json(updateHold(id, { ...box, route_id: routeId as number | null | undefined }));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/holds/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id || !getHold(id)) return notFound("Hold not found");
  deleteHold(id);
  return new NextResponse(null, { status: 204 });
}
