import fs from "node:fs/promises";
import { getWallImageFile } from "@/lib/db";
import { notFound, parseId } from "@/lib/http";
import { wallImagePath } from "@/lib/images";

export async function GET(_req: Request, ctx: RouteContext<"/api/walls/[id]/image">) {
  const id = parseId((await ctx.params).id);
  const file = id && getWallImageFile(id);
  if (!file) return notFound("Wall not found");
  try {
    const data = await fs.readFile(wallImagePath(file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        // File names are unique per upload, so the bytes never change.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return notFound("Image missing");
  }
}
