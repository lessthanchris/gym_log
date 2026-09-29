import { NextResponse } from "next/server";
import { deleteRoute, getRoute, updateRoute } from "@/lib/db";
import { badRequest, isHexColor, notFound, parseId, readJson, readText } from "@/lib/http";

export async function PATCH(req: Request, ctx: RouteContext<"/api/routes/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id || !getRoute(id)) return notFound("Route not found");
  const body = await readJson(req);
  if (!body) return badRequest("Expected a JSON body.");

  const name = readText(body.name);
  const colorName = readText(body.color_name);
  if (name === null || colorName === null) return badRequest("Names can't be empty.");
  if (body.color_hex !== undefined && !isHexColor(body.color_hex)) return badRequest("color_hex must look like #rrggbb.");
  // An empty grade clears it.
  let grade: string | null | undefined;
  if (body.grade === null || body.grade === "") grade = null;
  else {
    grade = readText(body.grade, 20);
    if (grade === null) return badRequest("Grades are up to 20 characters.");
  }

  const route = updateRoute(id, {
    name,
    color_name: colorName,
    color_hex: typeof body.color_hex === "string" ? body.color_hex.toLowerCase() : undefined,
    grade,
  });
  return NextResponse.json(route);
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/routes/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id || !getRoute(id)) return notFound("Route not found");
  deleteRoute(id);
  return new NextResponse(null, { status: 204 });
}
