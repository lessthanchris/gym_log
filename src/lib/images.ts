import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { DATA_DIR } from "./db";

const IMAGE_DIR = path.join(DATA_DIR, "images");

/** Longest edge kept for the stored wall photo. */
const STORED_MAX_EDGE = 2400;

/**
 * Normalize an uploaded photo (apply EXIF rotation, cap its size, re-encode
 * as JPEG) and write it to disk. Returns the stored file name and its size.
 */
export async function saveWallImage(input: Buffer): Promise<{ file: string; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: STORED_MAX_EDGE, height: STORED_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  const file = `${crypto.randomUUID()}.jpg`;
  await fs.writeFile(path.join(IMAGE_DIR, file), data);
  return { file, width: info.width, height: info.height };
}

export function wallImagePath(file: string): string {
  return path.join(IMAGE_DIR, path.basename(file));
}

export async function deleteWallImage(file: string): Promise<void> {
  await fs.rm(wallImagePath(file), { force: true });
}
