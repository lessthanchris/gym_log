import { NextResponse } from "next/server";
import { deleteWall, getWallDetail, getWallImageFile, updateWall } from "@/lib/db";
import { badRequest, notFound, parseId, readJson, readText } from "@/lib/http";
import { deleteWallImage } from "@/lib/images";

export async function GET(_req: Request, ctx: RouteContext<"/api/walls/[id]">) {
  const id = parseId((await ctx.params).id);
  const detail = id && getWallDetail(id);
  return detail ? NextResponse.json(detail) : notFound("Wall not found");
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/walls/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return notFound("Wall not found");
  const body = await readJson(req);
  const name = body && readText(body.name);
  if (!name) return badRequest("Give the wall a name (up to 100 characters).");
  const wall = updateWall(id, { name });
  return wall ? NextResponse.json(wall) : notFound("Wall not found");
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/walls/[id]">) {
  const id = parseId((await ctx.params).id);
  const file = id && getWallImageFile(id);
  if (!id || !file) return notFound("Wall not found");
  deleteWall(id);
  await deleteWallImage(file);
  return new NextResponse(null, { status: 204 });
}
