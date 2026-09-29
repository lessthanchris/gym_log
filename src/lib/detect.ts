import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import sharp from "sharp";
import { z } from "zod";
import type { DetectedRoute } from "./db";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

/** Longest edge of the copy sent to Claude. Coordinates come back in this image's pixels. */
const MODEL_MAX_EDGE = 1568;

const SYSTEM_PROMPT = `You map indoor climbing walls from photos so a gym's route setters can track their routes. \
Your output seeds an editor where the setters fix any mistakes, so aim for complete coverage: \
a missed hold costs them more time than a hold they need to reassign.`;

function userPrompt(width: number, height: number): string {
  return `This photo shows a climbing wall in a gym. The image is ${width}×${height} pixels.

Identify every route on the wall and the holds that belong to each one.

- In most gyms all holds on a route share one color. Some gyms instead mark routes with colored tape beside the holds; if so, group holds by tape color.
- Two routes on one wall can share a color. List them separately when their holds form clearly separate lines up the wall.
- Include every hold you can see for each route, small footholds too. For a hold bolted onto a volume (a large wooden or fiberglass feature), box the hold, not the volume. Ignore ropes, quickdraws, bolts, anchors, and people.
- Give each hold a tight bounding box in pixel coordinates of this image, origin at the top-left: x_min, y_min, x_max, y_max.
- color_name is the short name a climber would use ("Orange", "Pink", "Black"); color_hex is the holds' typical color as #rrggbb.
- If a hold's color is ambiguous, put it with the route it fits best.`;
}

const RawBox = z.object({
  x_min: z.number(),
  y_min: z.number(),
  x_max: z.number(),
  y_max: z.number(),
});

const RawDetection = z.object({
  routes: z.array(
    z.object({
      color_name: z.string(),
      color_hex: z.string(),
      holds: z.array(RawBox),
    }),
  ),
});
export type RawDetection = z.infer<typeof RawDetection>;

// Structured-output schema matching RawDetection.
const BOX_SCHEMA = {
  type: "object",
  properties: {
    x_min: { type: "number" },
    y_min: { type: "number" },
    x_max: { type: "number" },
    y_max: { type: "number" },
  },
  required: ["x_min", "y_min", "x_max", "y_max"],
  additionalProperties: false,
};
const DETECTION_SCHEMA = {
  type: "object",
  properties: {
    routes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          color_name: { type: "string" },
          color_hex: { type: "string" },
          holds: { type: "array", items: BOX_SCHEMA },
        },
        required: ["color_name", "color_hex", "holds"],
        additionalProperties: false,
      },
    },
  },
  required: ["routes"],
  additionalProperties: false,
};

/** Smallest box side kept, as a fraction of the image; anything smaller is noise. */
const MIN_SIDE = 0.002;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Convert Claude's pixel-space boxes into normalized (0..1) holds, dropping
 * degenerate boxes and empty routes and tidying up color fields.
 */
export function normalizeDetection(raw: RawDetection, width: number, height: number): DetectedRoute[] {
  const routes: DetectedRoute[] = [];
  for (const r of raw.routes) {
    const holds = r.holds.flatMap((b) => {
      const x0 = clamp01(Math.min(b.x_min, b.x_max) / width);
      const x1 = clamp01(Math.max(b.x_min, b.x_max) / width);
      const y0 = clamp01(Math.min(b.y_min, b.y_max) / height);
      const y1 = clamp01(Math.max(b.y_min, b.y_max) / height);
      if (x1 - x0 < MIN_SIDE || y1 - y0 < MIN_SIDE) return [];
      return [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }];
    });
    if (holds.length === 0) continue;
    const name = r.color_name.trim() || "Route";
    routes.push({
      color_name: name.charAt(0).toUpperCase() + name.slice(1),
      color_hex: normalizeHex(r.color_hex),
      holds,
    });
  }
  return routes;
}

export function normalizeHex(value: string): string {
  const v = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  if (/^[0-9a-f]{3}$/.test(v)) return `#${[...v].map((c) => c + c).join("")}`;
  return "#888888";
}

export class DetectionError extends Error {}

/** Ask Claude to find the routes and holds in a stored wall photo. */
export async function detectRoutes(imagePath: string): Promise<DetectedRoute[]> {
  const { data, info } = await sharp(await fs.readFile(imagePath))
    .resize({ width: MODEL_MAX_EDGE, height: MODEL_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  const client = new Anthropic();
  // Streaming: a busy wall can produce a long list of boxes.
  const message = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: DETECTION_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: data.toString("base64") } },
            { type: "text", text: userPrompt(info.width, info.height) },
          ],
        },
      ],
    })
    .finalMessage();

  if (message.stop_reason === "refusal") {
    throw new DetectionError("Claude declined to analyze this photo.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new DetectionError("The wall had too many holds to list in one pass.");
  }
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let parsed: RawDetection;
  try {
    parsed = RawDetection.parse(JSON.parse(text));
  } catch {
    throw new DetectionError("Claude returned a response that could not be read.");
  }
  return normalizeDetection(parsed, info.width, info.height);
}
