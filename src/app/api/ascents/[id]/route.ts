import { NextResponse } from "next/server";
import { deleteAscent } from "@/lib/db";
import { notFound, parseId } from "@/lib/http";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/ascents/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return notFound("Ascent not found");
  deleteAscent(id);
  return new NextResponse(null, { status: 204 });
}
