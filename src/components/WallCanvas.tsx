"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Hold, Route, Wall } from "@/lib/types";

export interface Point {
  x: number;
  y: number;
}

export type CanvasTarget = { kind: "hold"; holdId: number } | { kind: "handle"; holdId: number } | { kind: "wall" };

interface Props {
  wall: Wall;
  holds: Hold[];
  routes: Route[];
  /** When set, holds on other routes are dimmed. */
  activeRouteId?: number | null;
  selectedHoldId?: number | null;
  /** In-progress box being drawn, normalized. */
  draft?: { x: number; y: number; w: number; h: number } | null;
  zoom?: number;
  /** Let the canvas own touch gestures (needed while dragging boxes). */
  captureTouch?: boolean;
  onPointerDown?: (target: CanvasTarget, point: Point, e: ReactPointerEvent) => void;
  onPointerMove?: (point: Point) => void;
  onPointerUp?: (point: Point) => void;
  children?: ReactNode;
}

const UNASSIGNED_COLOR = "#ffffff";

/** The wall photo with hold outlines drawn on top in each route's color. */
export function WallCanvas({
  wall,
  holds,
  routes,
  activeRouteId = null,
  selectedHoldId = null,
  draft = null,
  zoom = 1,
  captureTouch = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const colorById = new Map(routes.map((r) => [r.id, r.color_hex]));
  const { width: W, height: H } = wall;
  // Keep strokes and handles a consistent on-screen size.
  const unit = Math.max(W, H) / 1000 / zoom;

  const toPoint = (e: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!onPointerDown) return;
    const el = (e.target as Element).closest("[data-hold]");
    const holdId = el ? Number(el.getAttribute("data-hold")) : null;
    const target: CanvasTarget =
      holdId === null ? { kind: "wall" } : el?.hasAttribute("data-handle") ? { kind: "handle", holdId } : { kind: "hold", holdId };
    if (captureTouch) svgRef.current?.setPointerCapture(e.pointerId);
    onPointerDown(target, toPoint(e), e);
  };

  // Draw the active route last so it sits above overlapping holds.
  const ordered = [...holds].sort(
    (a, b) => Number(a.route_id === activeRouteId) - Number(b.route_id === activeRouteId),
  );
  const selected = holds.find((h) => h.id === selectedHoldId);

  return (
    <div className="relative select-none" style={{ width: `${zoom * 100}%`, aspectRatio: `${W} / ${H}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- served from our own API, sized by the container */}
      <img
        src={`/api/walls/${wall.id}/image`}
        alt={wall.name}
        draggable={false}
        className="absolute inset-0 h-full w-full"
      />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        style={{ touchAction: captureTouch ? "none" : "auto" }}
        onPointerDown={handleDown}
        onPointerMove={onPointerMove && ((e) => onPointerMove(toPoint(e)))}
        onPointerUp={onPointerUp && ((e) => onPointerUp(toPoint(e)))}
      >
        {ordered.map((h) => {
          const color = h.route_id === null ? UNASSIGNED_COLOR : (colorById.get(h.route_id) ?? UNASSIGNED_COLOR);
          const dimmed = activeRouteId !== null && h.route_id !== activeRouteId;
          const isActive = activeRouteId !== null && h.route_id === activeRouteId;
          const box = { x: h.x * W, y: h.y * H, width: h.w * W, height: h.h * H };
          const r = Math.min(box.width, box.height) / 3;
          return (
            <g key={h.id} data-hold={h.id} opacity={dimmed ? 0.3 : 1} className="cursor-pointer">
              {/* Dark halo keeps the outline visible on any wall color. */}
              <rect {...box} rx={r} fill="transparent" stroke="black" strokeOpacity={0.6} strokeWidth={unit * (isActive ? 7 : 5)} />
              <rect
                {...box}
                rx={r}
                fill={color}
                fillOpacity={isActive ? 0.2 : 0.08}
                stroke={color}
                strokeWidth={unit * (isActive ? 4 : 2.5)}
                strokeDasharray={h.route_id === null ? `${unit * 6} ${unit * 4}` : undefined}
              />
            </g>
          );
        })}
        {selected && (
          <g data-hold={selected.id}>
            <rect
              x={selected.x * W}
              y={selected.y * H}
              width={selected.w * W}
              height={selected.h * H}
              fill="transparent"
              stroke="white"
              strokeWidth={unit * 2}
              strokeDasharray={`${unit * 5} ${unit * 3}`}
              pointerEvents="none"
            />
            <circle
              data-handle=""
              data-hold={selected.id}
              cx={(selected.x + selected.w) * W}
              cy={(selected.y + selected.h) * H}
              r={unit * 14}
              fill="white"
              stroke="black"
              strokeWidth={unit * 2}
              className="cursor-nwse-resize"
            />
          </g>
        )}
        {draft && (
          <rect
            x={draft.x * W}
            y={draft.y * H}
            width={draft.w * W}
            height={draft.h * H}
            fill="white"
            fillOpacity={0.15}
            stroke="white"
            strokeWidth={unit * 2.5}
            strokeDasharray={`${unit * 6} ${unit * 4}`}
            pointerEvents="none"
          />
        )}
      </svg>
      {children}
    </div>
  );
}
