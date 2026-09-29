"use client";

import Link from "next/link";
import { useState } from "react";
import { gradeSortKey } from "@/lib/grades";
import { ASCENT_STYLES, STYLE_LABELS, type Ascent, type AscentStyle, type WallDetail } from "@/lib/types";
import { api } from "./api";
import { StatusBanner } from "./StatusBanner";
import { WallCanvas } from "./WallCanvas";
import { useClimber } from "./useClimber";
import { useWall } from "./useWall";

const STYLE_COLORS: Record<AscentStyle, string> = {
  lead: "bg-emerald-600 text-white",
  toprope: "bg-sky-600 text-white",
  attempt: "bg-stone-500 text-white",
};

/** Best style a climber has logged on a route, for the tick badge. */
function bestStyle(ascents: Ascent[]): AscentStyle | null {
  return ASCENT_STYLES.find((s) => ascents.some((a) => a.style === s)) ?? null;
}

export function WallView({ initial }: { initial: WallDetail }) {
  const { detail, setDetail, error, mutate } = useWall(initial);
  const { wall, routes, holds, ascents } = detail;
  const [climber, setClimber] = useClimber();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const sorted = [...routes].sort((a, b) => gradeSortKey(a.grade) - gradeSortKey(b.grade) || a.id - b.id);
  const selected = routes.find((r) => r.id === selectedId) ?? null;
  const mine = (routeId: number) =>
    ascents.filter((a) => a.route_id === routeId && a.climber.toLowerCase() === climber.toLowerCase());

  const log = (style: AscentStyle) => {
    if (!selected || !climber) return;
    mutate(async () => {
      const ascent = await api.logAscent(selected.id, climber, style);
      setDetail((d) => ({ ...d, ascents: [ascent, ...d.ascents] }));
    });
  };

  const removeAscent = (a: Ascent) => {
    setDetail((d) => ({ ...d, ascents: d.ascents.filter((x) => x.id !== a.id) }));
    mutate(() => api.deleteAscent(a.id));
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <section className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{wall.name}</h1>
          <span className="flex items-center gap-1 text-sm">
            <button className="rounded bg-stone-200 px-2 py-1" onClick={() => setZoom((z) => Math.max(1, z - 1))} aria-label="Zoom out">−</button>
            <span className="w-8 text-center tabular-nums">{zoom}×</span>
            <button className="rounded bg-stone-200 px-2 py-1" onClick={() => setZoom((z) => Math.min(4, z + 1))} aria-label="Zoom in">+</button>
          </span>
          <Link href={`/walls/${wall.id}/edit`} className="rounded bg-stone-200 px-3 py-1.5 text-sm font-medium">
            Edit routes
          </Link>
        </div>
        {wall.status === "detecting" && <StatusBanner wall={wall} />}
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="max-h-[75vh] overflow-auto rounded-lg bg-stone-900">
          <WallCanvas
            wall={wall}
            holds={holds}
            routes={routes}
            activeRouteId={selectedId}
            zoom={zoom}
            onPointerDown={(target) => {
              if (target.kind === "wall") return setSelectedId(null);
              const routeId = holds.find((h) => h.id === target.holdId)?.route_id ?? null;
              setSelectedId(routeId === selectedId ? null : routeId);
            }}
          />
        </div>
        <p className="mt-2 text-sm text-stone-500">Tap a hold or a route in the list to highlight it.</p>
      </section>

      <aside className="w-full shrink-0 lg:w-80">
        <ClimberName name={climber} onChange={setClimber} />

        {selected && (
          <div className="mb-4 rounded-lg border border-stone-900 bg-white p-3 shadow">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-5 w-5 rounded-full border border-black/20" style={{ background: selected.color_hex }} />
              <h2 className="flex-1 truncate font-semibold">{selected.name}</h2>
              <span className="text-lg font-semibold">{selected.grade ?? "—"}</span>
            </div>
            {climber ? (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {ASCENT_STYLES.map((s) => (
                  <button key={s} onClick={() => log(s)} className={`rounded px-2 py-2 text-sm font-medium ${STYLE_COLORS[s]}`}>
                    {STYLE_LABELS[s]}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm text-stone-600">Enter your name above to log climbs.</p>
            )}
            <AscentList
              ascents={ascents.filter((a) => a.route_id === selected.id)}
              climber={climber}
              onDelete={removeAscent}
            />
          </div>
        )}

        <h2 className="mb-2 font-semibold">
          Routes <span className="font-normal text-stone-500">({routes.length})</span>
        </h2>
        {routes.length === 0 && wall.status !== "detecting" && (
          <p className="text-sm text-stone-600">
            No routes yet. <Link href={`/walls/${wall.id}/edit`} className="underline">Mark them in the editor.</Link>
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {sorted.map((route) => {
            const best = climber ? bestStyle(mine(route.id)) : null;
            const sends = new Set(
              ascents.filter((a) => a.route_id === route.id && a.style !== "attempt").map((a) => a.climber.toLowerCase()),
            ).size;
            return (
              <li key={route.id}>
                <button
                  onClick={() => setSelectedId(route.id === selectedId ? null : route.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left ${route.id === selectedId ? "border-stone-900" : "border-stone-200"}`}
                >
                  <span className="h-4 w-4 shrink-0 rounded-full border border-black/20" style={{ background: route.color_hex }} />
                  <span className="w-14 font-semibold tabular-nums">{route.grade ?? "—"}</span>
                  <span className="min-w-0 flex-1 truncate">{route.name}</span>
                  {best && <span className={`rounded px-1.5 py-0.5 text-xs ${STYLE_COLORS[best]}`}>{STYLE_LABELS[best]}</span>}
                  <span className="w-12 text-right text-xs text-stone-500" title="Climbers who have sent it">
                    {sends > 0 ? `${sends} sent` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

function ClimberName({ name, onChange }: { name: string; onChange: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (name && !editing) {
    return (
      <p className="mb-4 text-sm text-stone-600">
        Climbing as <span className="font-semibold text-stone-900">{name}</span>{" "}
        <button className="underline" onClick={() => setEditing(true)}>
          change
        </button>
      </p>
    );
  }
  return (
    <form
      className="mb-4 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get("name") ?? "").trim();
        if (value) {
          onChange(value);
          setEditing(false);
        }
      }}
    >
      <input
        name="name"
        defaultValue={name}
        maxLength={50}
        placeholder="Your name"
        className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1.5 text-sm"
        autoFocus={editing}
      />
      <button className="rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white">Save</button>
    </form>
  );
}

function AscentList({ ascents, climber, onDelete }: { ascents: Ascent[]; climber: string; onDelete: (a: Ascent) => void }) {
  if (ascents.length === 0) return <p className="text-sm text-stone-500">No climbs logged yet.</p>;
  return (
    <ul className="flex max-h-60 flex-col gap-1 overflow-auto text-sm">
      {ascents.map((a) => (
        <li key={a.id} className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs ${STYLE_COLORS[a.style]}`}>{STYLE_LABELS[a.style]}</span>
          <span className="min-w-0 flex-1 truncate">{a.climber}</span>
          <span className="text-xs text-stone-500">{formatDate(a.created_at)}</span>
          {a.climber.toLowerCase() === climber.toLowerCase() && (
            <button className="text-xs text-stone-400 hover:text-red-700" onClick={() => onDelete(a)} aria-label="Remove">
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function formatDate(sqlUtc: string) {
  // SQLite datetime('now') is UTC without a zone marker.
  return new Date(sqlUtc.replace(" ", "T") + "Z").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
