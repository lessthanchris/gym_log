import Anthropic from "@anthropic-ai/sdk";
import { getWallImageFile, replaceDetection, setWallStatus } from "./db";
import { DetectionError, detectRoutes, OpenRouterError } from "./detect";
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
  if (err instanceof OpenRouterError) return describeOpenRouterError(err);
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key is missing or invalid.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by the Anthropic API. Try again shortly.";
  if (err instanceof Anthropic.APIError) return `Anthropic API error (${err.status ?? "network"}).`;
  // fetch() rejects with a bare TypeError when the host can't be reached.
  if (err instanceof TypeError && err.message === "fetch failed") return "Couldn't reach the AI service. Check the network and try again.";
  if (err instanceof Error && err.name === "TimeoutError") return "The AI took too long to respond. Try again.";
  return "Detection failed unexpectedly.";
}

function describeOpenRouterError(err: OpenRouterError): string {
  switch (err.status) {
    case 401:
      return "The OpenRouter API key is invalid.";
    case 402:
      return "The OpenRouter account is out of credits.";
    case 429:
      return "Rate limited by OpenRouter. Try again shortly.";
    default:
      // OpenRouter's messages are specific (e.g. an unknown model name), so pass them on.
      return `OpenRouter error (${err.status}): ${err.message.slice(0, 200)}`;
  }
}
