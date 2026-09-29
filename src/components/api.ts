import type { Ascent, AscentStyle, Hold, Route, Wall, WallDetail } from "@/lib/types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  uploadWall: (form: FormData) => call<Wall>("/api/walls", { method: "POST", body: form }),
  getWall: (id: number) => call<WallDetail>(`/api/walls/${id}`),
  renameWall: (id: number, name: string) => call<Wall>(`/api/walls/${id}`, json("PATCH", { name })),
  deleteWall: (id: number) => call<void>(`/api/walls/${id}`, { method: "DELETE" }),
  redetect: (id: number) => call<Wall>(`/api/walls/${id}/detect`, { method: "POST" }),

  createRoute: (wallId: number, r: Pick<Route, "name" | "color_name" | "color_hex">) =>
    call<Route>(`/api/walls/${wallId}/routes`, json("POST", r)),
  updateRoute: (id: number, patch: Partial<Pick<Route, "name" | "color_name" | "color_hex" | "grade">>) =>
    call<Route>(`/api/routes/${id}`, json("PATCH", patch)),
  deleteRoute: (id: number) => call<void>(`/api/routes/${id}`, { method: "DELETE" }),

  createHold: (wallId: number, h: Pick<Hold, "route_id" | "x" | "y" | "w" | "h">) =>
    call<Hold>(`/api/walls/${wallId}/holds`, json("POST", h)),
  updateHold: (id: number, patch: Partial<Pick<Hold, "route_id" | "x" | "y" | "w" | "h">>) =>
    call<Hold>(`/api/holds/${id}`, json("PATCH", patch)),
  deleteHold: (id: number) => call<void>(`/api/holds/${id}`, { method: "DELETE" }),

  logAscent: (routeId: number, climber: string, style: AscentStyle) =>
    call<Ascent>(`/api/routes/${routeId}/ascents`, json("POST", { climber, style })),
  deleteAscent: (id: number) => call<void>(`/api/ascents/${id}`, { method: "DELETE" }),
};
