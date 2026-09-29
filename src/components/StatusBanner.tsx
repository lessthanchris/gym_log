import type { Wall } from "@/lib/types";

export function StatusBanner({ wall, onRetry }: { wall: Wall; onRetry?: () => void }) {
  if (wall.status === "detecting") {
    return (
      <p className="mb-3 flex items-center gap-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
        Finding holds and routes… this usually takes a minute or two.
      </p>
    );
  }
  if (wall.status === "failed") {
    return (
      <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
        AI detection failed: {wall.error ?? "unknown error"} You can still mark holds by hand.{" "}
        {onRetry && (
          <button className="font-medium underline" onClick={onRetry}>
            Try again
          </button>
        )}
      </p>
    );
  }
  return null;
}
