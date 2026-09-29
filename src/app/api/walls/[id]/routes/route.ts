import { NextResponse } from "next/server";
import { createRoute, getWall } from "@/lib/db";
import { badRequest, isHexColor, notFound, parseId, readJson, readText } from "@/lib/http";

export async function POST(req: Request, ctx: RouteContext<"/api/walls/[id]/routes">) {
  const id = parseId((await ctx.params).id);
  if (!id || !getWall(id)) return notFound("Wall not found");
  const body = await readJson(req);
  if (!body) return badRequest("Expected a JSON body.");
  const name = readText(body.name);
  const colorName = readText(body.color_name) ?? name;
  const grade = body.grade === null ? null : readText(body.grade, 20);
  if (!name || !colorName) return badRequest("A route needs a name.");
  if (!isHexColor(body.color_hex)) return badRequest("color_hex must look like #rrggbb.");
  if (grade === null && body.grade !== null && body.grade !== undefined) return badRequest("Invalid grade.");
  return NextResponse.json(
    createRoute(id, { name, color_name: colorName, color_hex: body.color_hex.toLowerCase(), grade }),
    { status: 201 },
  );
}
