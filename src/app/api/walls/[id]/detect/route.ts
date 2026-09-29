import { after, NextResponse } from "next/server";
import { getWall, setWallStatus } from "@/lib/db";
import { notFound, parseId } from "@/lib/http";
import { runDetection } from "@/lib/run-detection";

export const maxDuration = 300;

/** Re-run AI detection. Replaces all routes, holds and their logged ascents. */
export async function POST(_req: Request, ctx: RouteContext<"/api/walls/[id]/detect">) {
  const id = parseId((await ctx.params).id);
  if (!id || !getWall(id)) return notFound("Wall not found");
  setWallStatus(id, "detecting");
  after(() => runDetection(id));
  return NextResponse.json(getWall(id), { status: 202 });
}
