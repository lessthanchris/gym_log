"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { YDS_GRADES } from "@/lib/grades";
import type { Hold, Route, WallDetail } from "@/lib/types";
import { api } from "./api";
import { StatusBanner } from "./StatusBanner";
import { WallCanvas, type CanvasTarget, type Point } from "./WallCanvas";
import { useWall } from "./useWall";

type Tool = "assign" | "draw" | "adjust" | "delete";

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "assign", label: "Assign", hint: "Tap a hold to add it to (or remove it from) the selected route." },
  { id: "draw", label: "Add hold", hint: "Drag a box around a missed hold, or tap to drop one. It joins the selected route." },
  { id: "adjust", label: "Move / resize", hint: "Tap a hold, then drag it or its corner handle." },
  { id: "delete", label: "Delete", hint: "Tap a hold that isn't really a hold to remove it." },
];

const NEW_ROUTE_COLORS = ["#e11d48", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

/** Default size for a hold dropped with a single tap, as a fraction of the longer image side. */
const TAP_HOLD_SIZE = 0.03;
/** Drags shorter than this (normalized) count as taps. */
const TAP_SLOP = 0.008;

type Drag =
  | { kind: "draw"; start: Point }
  | { kind: "move"; holdId: number; start: Point; orig: Hold }
  | { kind: "resize"; holdId: number; orig: Hold };

export function WallEditor({ initial }: { initial: WallDetail }) {
  const { detail, setDetail, error, setError, reload, mutate } = useWall(initial);
  const { wall, routes, holds } = detail;
  const [activeRouteId, setActiveRouteId] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>("assign");
  const [selectedHoldId, setSelectedHoldId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<Drag | null>(null);
  const router = useRouter();

  const setHolds = (fn: (hs: Hold[]) => Hold[]) => setDetail((d) => ({ ...d, holds: fn(d.holds) }));
  const setRoutes = (fn: (rs: Route[]) => Route[]) => setDetail((d) => ({ ...d, routes: fn(d.routes) }));
  const patchHoldLocal = (id: number, patch: Partial<Hold>) =>
    setHolds((hs) => hs.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  // ---- canvas interaction ----

  const onPointerDown = (target: CanvasTarget, p: Point) => {
    const hold = target.kind === "wall" ? undefined : holds.find((h) => h.id === target.holdId);
    switch (tool) {
      case "assign": {
        if (!hold) return;
        if (activeRouteId === null) {
          // No route picked yet: tapping a hold picks its route.
          setActiveRouteId(hold.route_id);
          return;
        }
        const routeId = hold.route_id === activeRouteId ? null : activeRouteId;
        patchHoldLocal(hold.id, { route_id: routeId });
        mutate(() => api.updateHold(hold.id, { route_id: routeId }));
        return;
      }
      case "delete": {
        if (!hold) return;
        setHolds((hs) => hs.filter((h) => h.id !== hold.id));
        mutate(() => api.deleteHold(hold.id));
        return;
      }
      case "adjust": {
        if (target.kind === "handle" && hold) drag.current = { kind: "resize", holdId: hold.id, orig: hold };
        else if (hold) {
          setSelectedHoldId(hold.id);
          drag.current = { kind: "move", holdId: hold.id, start: p, orig: hold };
        } else setSelectedHoldId(null);
        return;
      }
      case "draw":
        drag.current = { kind: "draw", start: p };
        setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
        return;
    }
  };

  const onPointerMove = (p: Point) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "draw") {
      setDraft({ x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) });
    } else if (d.kind === "move") {
      const x = clamp(d.orig.x + p.x - d.start.x, 0, 1 - d.orig.w);
      const y = clamp(d.orig.y + p.y - d.start.y, 0, 1 - d.orig.h);
      patchHoldLocal(d.holdId, { x, y });
    } else {
      patchHoldLocal(d.holdId, { w: clamp(p.x - d.orig.x, 0.005, 1 - d.orig.x), h: clamp(p.y - d.orig.y, 0.005, 1 - d.orig.y) });
    }
  };

  const onPointerUp = (p: Point) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "draw") {
      setDraft(null);
      let box = { x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) };
      if (box.w < TAP_SLOP && box.h < TAP_SLOP) {
        // A tap: drop a square hold centered on the point.
        const w = (TAP_HOLD_SIZE * Math.max(wall.width, wall.height)) / wall.width;
        const h = (TAP_HOLD_SIZE * Math.max(wall.width, wall.height)) / wall.height;
        box = { x: clamp(p.x - w / 2, 0, 1 - w), y: clamp(p.y - h / 2, 0, 1 - h), w, h };
      }
      mutate(async () => {
        const created = await api.createHold(wall.id, { route_id: activeRouteId, ...box });
        setHolds((hs) => [...hs, created]);
      });
      return;
    }
    const hold = holds.find((h) => h.id === d.holdId);
    if (!hold) return;
    const { x, y, w, h } = hold;
    if (x === d.orig.x && y === d.orig.y && w === d.orig.w && h === d.orig.h) return;
    mutate(() => api.updateHold(hold.id, { x, y, w, h }));
  };

  // ---- routes ----

  const addRoute = () =>
    mutate(async () => {
      const color = NEW_ROUTE_COLORS[routes.length % NEW_ROUTE_COLORS.length];
      const route = await api.createRoute(wall.id, { name: `Route ${routes.length + 1}`, color_name: "Custom", color_hex: color });
      setRoutes((rs) => [...rs, route]);
      setActiveRouteId(route.id);
      setTool("assign");
    });

  const updateRoute = (id: number, patch: Partial<Route>) => {
    setRoutes((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    mutate(() => api.updateRoute(id, patch));
  };

  const deleteRoute = (route: Route) => {
    const count = holds.filter((h) => h.route_id === route.id).length;
    if (!confirm(`Delete “${route.name}”? Its ${count} holds become unassigned and logged climbs are removed.`)) return;
    setRoutes((rs) => rs.filter((r) => r.id !== route.id));
    setHolds((hs) => hs.map((h) => (h.route_id === route.id ? { ...h, route_id: null } : h)));
    if (activeRouteId === route.id) setActiveRouteId(null);
    mutate(() => api.deleteRoute(route.id));
  };

  const redetect = () => {
    if (!confirm("Re-run AI detection? This replaces every route and hold on this wall, including your corrections and logged climbs.")) return;
    setActiveRouteId(null);
    mutate(async () => {
      const w = await api.redetect(wall.id);
      setDetail((d) => ({ ...d, wall: w }));
    });
  };

  const rename = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === wall.name) return;
    setDetail((d) => ({ ...d, wall: { ...d.wall, name: trimmed } }));
    mutate(() => api.renameWall(wall.id, trimmed));
  };

  const deleteWall = () => {
    if (!confirm(`Delete “${wall.name}” with all its routes and logged climbs?`)) return;
    mutate(async () => {
      await api.deleteWall(wall.id);
      router.push("/");
      router.refresh();
    });
  };

  const unassigned = holds.filter((h) => h.route_id === null).length;
  const activeTool = TOOLS.find((t) => t.id === tool)!;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <section className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            defaultValue={wall.name}
            key={wall.name}
            onBlur={(e) => rename(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-xl font-semibold hover:border-stone-300 focus:border-stone-400 focus:outline-none"
            aria-label="Wall name"
          />
          <Link href={`/walls/${wall.id}`} className="rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white">
            Done
          </Link>
        </div>

        <StatusBanner wall={wall} onRetry={redetect} />
        {error && (
          <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}{" "}
            <button className="underline" onClick={() => { setError(null); reload(); }}>
              Dismiss
            </button>
          </p>
        )}

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTool(t.id); setSelectedHoldId(null); }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${tool === t.id ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-800"}`}
            >
              {t.label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1 text-sm">
            <button className="rounded bg-stone-200 px-2 py-1" onClick={() => setZoom((z) => Math.max(1, z - 1))} aria-label="Zoom out">−</button>
            <span className="w-8 text-center tabular-nums">{zoom}×</span>
            <button className="rounded bg-stone-200 px-2 py-1" onClick={() => setZoom((z) => Math.min(4, z + 1))} aria-label="Zoom in">+</button>
          </span>
        </div>
        <p className="mb-2 text-sm text-stone-600">
          {activeTool.hint}
          {tool !== "delete" && tool !== "adjust" && activeRouteId === null && " No route selected — pick one on the right."}
        </p>

        <div className="max-h-[75vh] overflow-auto rounded-lg bg-stone-900">
          <WallCanvas
            wall={wall}
            holds={holds}
            routes={routes}
            activeRouteId={activeRouteId}
            selectedHoldId={tool === "adjust" ? selectedHoldId : null}
            draft={draft}
            zoom={zoom}
            captureTouch={tool === "draw" || tool === "adjust"}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        </div>
      </section>

      <aside className="w-full shrink-0 lg:w-80">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">
            Routes <span className="font-normal text-stone-500">({routes.length})</span>
          </h2>
          <button onClick={addRoute} className="rounded bg-stone-900 px-3 py-1 text-sm font-medium text-white">
            + Add route
          </button>
        </div>
        {unassigned > 0 && (
          <p className="mb-2 text-sm text-stone-600">
            {unassigned} unassigned {unassigned === 1 ? "hold" : "holds"} (dashed white).
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {routes.map((route) => {
            const active = route.id === activeRouteId;
            const count = holds.filter((h) => h.route_id === route.id).length;
            return (
              <li key={route.id} className={`rounded-lg border bg-white ${active ? "border-stone-900 shadow" : "border-stone-200"}`}>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  onClick={() => setActiveRouteId(active ? null : route.id)}
                >
                  <span className="h-4 w-4 shrink-0 rounded-full border border-black/20" style={{ background: route.color_hex }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{route.name}</span>
                  <span className="text-sm text-stone-500">{route.grade ?? "no grade"}</span>
                  <span className="w-8 text-right text-xs text-stone-400">{count}</span>
                </button>
                {active && (
                  <div className="flex flex-col gap-2 border-t border-stone-100 px-3 py-2 text-sm">
                    <label className="flex items-center gap-2">
                      <span className="w-12 text-stone-500">Name</span>
                      <input
                        key={route.name}
                        defaultValue={route.name}
                        onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== route.name && updateRoute(route.id, { name: e.target.value.trim() })}
                        className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="w-12 text-stone-500">Grade</span>
                      <input
                        key={route.grade ?? ""}
                        defaultValue={route.grade ?? ""}
                        list="grade-options"
                        placeholder="e.g. 5.10b"
                        onBlur={(e) => {
                          const grade = e.target.value.trim() || null;
                          if (grade !== route.grade) updateRoute(route.id, { grade });
                        }}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="w-12 text-stone-500">Color</span>
                      <input
                        type="color"
                        value={route.color_hex}
                        onChange={(e) => setRoutes((rs) => rs.map((r) => (r.id === route.id ? { ...r, color_hex: e.target.value } : r)))}
                        onBlur={(e) => updateRoute(route.id, { color_hex: e.target.value })}
                        className="h-8 w-12 cursor-pointer rounded border border-stone-300"
                      />
                      <button onClick={() => deleteRoute(route)} className="ml-auto text-red-700 hover:underline">
                        Delete route
                      </button>
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <datalist id="grade-options">
          {YDS_GRADES.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <div className="mt-4 flex gap-4 text-sm">
          <button onClick={redetect} className="text-stone-600 underline" disabled={wall.status === "detecting"}>
            Re-run AI detection
          </button>
          <button onClick={deleteWall} className="text-red-700 underline">
            Delete wall
          </button>
        </div>
      </aside>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
