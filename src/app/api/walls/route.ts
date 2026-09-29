import { after, NextResponse } from "next/server";
import { createWall, listWalls } from "@/lib/db";
import { badRequest } from "@/lib/http";
import { saveWallImage } from "@/lib/images";
import { runDetection } from "@/lib/run-detection";

// Detection runs after the response and can take a few minutes on a busy wall.
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function GET() {
  return NextResponse.json(listWalls());
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Expected a multipart form upload.");
  }
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return badRequest("Attach a photo of the wall.");
  if (photo.size > MAX_UPLOAD_BYTES) return badRequest("That photo is too large (25 MB max).");
  const name = String(form.get("name") ?? "").trim() || `Wall ${new Date().toLocaleDateString("en-US")}`;

  let saved;
  try {
    saved = await saveWallImage(Buffer.from(await photo.arrayBuffer()));
  } catch {
    return badRequest("That file doesn't look like an image we can read.");
  }
  const wall = createWall({ name: name.slice(0, 100), imageFile: saved.file, width: saved.width, height: saved.height });
  after(() => runDetection(wall.id));
  return NextResponse.json(wall, { status: 201 });
}
