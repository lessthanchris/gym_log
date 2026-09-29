import Anthropic from "@anthropic-ai/sdk";
import { getWallImageFile, replaceDetection, setWallStatus } from "./db";
import { DetectionError, detectRoutes } from "./detect";
import { wallImagePath } from "./images";

/** Run AI detection for a wall and record the outcome on the wall's status. */
export async function runDetection(wallId: number): Promise<void> {
  const file = getWallImageFile(wallId);
  if (!file) return;
  setWallStatus(wallId, "detecting");
  try {
    const routes = await detectRoutes(wallImagePath(file));
    replaceDetection(wallId, routes);
    setWallStatus(wallId, "ready");
  } catch (err) {
    console.error(`Detection failed for wall ${wallId}:`, err);
    setWallStatus(wallId, "failed", describeError(err));
  }
}

function describeError(err: unknown): string {
  if (err instanceof DetectionError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key is missing or invalid.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by the Anthropic API. Try again shortly.";
  if (err instanceof Anthropic.APIError) return `Anthropic API error (${err.status ?? "network"}).`;
  if (err instanceof Error && /api key|apiKey|authToken/i.test(err.message)) {
    return "No Anthropic API key configured. Set ANTHROPIC_API_KEY and retry.";
  }
  return "Detection failed unexpectedly.";
}
