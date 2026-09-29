import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Ascent, AscentStyle, Hold, Route, Wall, WallDetail, WallStatus } from "./types";

// Resolved at runtime; keep Turbopack from tracing the whole project into the build.
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS walls (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  image_file TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'detecting',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY,
  wall_id INTEGER NOT NULL REFERENCES walls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  grade TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS holds (
  id INTEGER PRIMARY KEY,
  wall_id INTEGER NOT NULL REFERENCES walls(id) ON DELETE CASCADE,
  route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  w REAL NOT NULL,
  h REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual'
);
CREATE TABLE IF NOT EXISTS ascents (
  id INTEGER PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  climber TEXT NOT NULL,
  style TEXT NOT NULL CHECK (style IN ('toprope', 'lead', 'attempt')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS routes_wall ON routes(wall_id);
CREATE INDEX IF NOT EXISTS holds_wall ON holds(wall_id);
CREATE INDEX IF NOT EXISTS ascents_route ON ascents(route_id);
`;

// Reuse one connection across dev-server hot reloads.
const globalForDb = globalThis as unknown as { gymLogDb?: Database.Database };

export function db(): Database.Database {
  if (!globalForDb.gymLogDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const conn = new Database(path.join(DATA_DIR, "gym_log.sqlite"));
    conn.pragma("journal_mode = WAL");
    conn.pragma("foreign_keys = ON");
    conn.exec(SCHEMA);
    globalForDb.gymLogDb = conn;
  }
  return globalForDb.gymLogDb;
}

const WALL_COLUMNS = "id, name, width, height, status, error, created_at";

// ---- walls ----

export function listWalls(): (Wall & { route_count: number })[] {
  return db()
    .prepare(
      `SELECT ${WALL_COLUMNS.split(", ").map((c) => `w.${c}`).join(", ")},
              (SELECT COUNT(*) FROM routes r WHERE r.wall_id = w.id) AS route_count
       FROM walls w ORDER BY w.created_at DESC, w.id DESC`,
    )
    .all() as (Wall & { route_count: number })[];
}

export function getWall(id: number): Wall | undefined {
  return db().prepare(`SELECT ${WALL_COLUMNS} FROM walls WHERE id = ?`).get(id) as Wall | undefined;
}

export function getWallImageFile(id: number): string | undefined {
  const row = db().prepare("SELECT image_file FROM walls WHERE id = ?").get(id) as
    | { image_file: string }
    | undefined;
  return row?.image_file;
}

export function createWall(input: { name: string; imageFile: string; width: number; height: number }): Wall {
  const info = db()
    .prepare("INSERT INTO walls (name, image_file, width, height) VALUES (?, ?, ?, ?)")
    .run(input.name, input.imageFile, input.width, input.height);
  return getWall(Number(info.lastInsertRowid))!;
}

export function updateWall(id: number, patch: { name?: string }): Wall | undefined {
  if (patch.name !== undefined) db().prepare("UPDATE walls SET name = ? WHERE id = ?").run(patch.name, id);
  return getWall(id);
}

export function setWallStatus(id: number, status: WallStatus, error: string | null = null): void {
  db().prepare("UPDATE walls SET status = ?, error = ? WHERE id = ?").run(status, error, id);
}

export function deleteWall(id: number): void {
  db().prepare("DELETE FROM walls WHERE id = ?").run(id);
}

export function getWallDetail(id: number): WallDetail | undefined {
  const wall = getWall(id);
  if (!wall) return undefined;
  const conn = db();
  return {
    wall,
    routes: conn.prepare("SELECT * FROM routes WHERE wall_id = ? ORDER BY id").all(id) as Route[],
    holds: conn.prepare("SELECT * FROM holds WHERE wall_id = ? ORDER BY id").all(id) as Hold[],
    ascents: conn
      .prepare(
        `SELECT a.* FROM ascents a JOIN routes r ON r.id = a.route_id
         WHERE r.wall_id = ? ORDER BY a.created_at DESC, a.id DESC`,
      )
      .all(id) as Ascent[],
  };
}

export interface DetectedRoute {
  color_name: string;
  color_hex: string;
  holds: { x: number; y: number; w: number; h: number }[];
}

/**
 * Replace a wall's routes and holds with a fresh detection. Ascents on the
 * old routes are deleted with them, so callers should confirm first.
 */
export function replaceDetection(wallId: number, routes: DetectedRoute[]): void {
  const conn = db();
  const insertRoute = conn.prepare(
    "INSERT INTO routes (wall_id, name, color_name, color_hex) VALUES (?, ?, ?, ?)",
  );
  const insertHold = conn.prepare(
    "INSERT INTO holds (wall_id, route_id, x, y, w, h, source) VALUES (?, ?, ?, ?, ?, ?, 'ai')",
  );
  conn.transaction(() => {
    conn.prepare("DELETE FROM holds WHERE wall_id = ?").run(wallId);
    conn.prepare("DELETE FROM routes WHERE wall_id = ?").run(wallId);
    const nameCounts = new Map<string, number>();
    for (const r of routes) {
      const count = (nameCounts.get(r.color_name) ?? 0) + 1;
      nameCounts.set(r.color_name, count);
      const name = count > 1 ? `${r.color_name} ${count}` : r.color_name;
      const routeId = Number(insertRoute.run(wallId, name, r.color_name, r.color_hex).lastInsertRowid);
      for (const h of r.holds) insertHold.run(wallId, routeId, h.x, h.y, h.w, h.h);
    }
  })();
}

// ---- routes ----

export function getRoute(id: number): Route | undefined {
  return db().prepare("SELECT * FROM routes WHERE id = ?").get(id) as Route | undefined;
}

export function createRoute(
  wallId: number,
  input: { name: string; color_name: string; color_hex: string; grade?: string | null },
): Route {
  const info = db()
    .prepare("INSERT INTO routes (wall_id, name, color_name, color_hex, grade) VALUES (?, ?, ?, ?, ?)")
    .run(wallId, input.name, input.color_name, input.color_hex, input.grade ?? null);
  return getRoute(Number(info.lastInsertRowid))!;
}

export function updateRoute(
  id: number,
  patch: Partial<Pick<Route, "name" | "color_name" | "color_hex" | "grade">>,
): Route | undefined {
  const fields = (["name", "color_name", "color_hex", "grade"] as const).filter((k) => patch[k] !== undefined);
  if (fields.length > 0) {
    db()
      .prepare(`UPDATE routes SET ${fields.map((f) => `${f} = ?`).join(", ")} WHERE id = ?`)
      .run(...fields.map((f) => patch[f]), id);
  }
  return getRoute(id);
}

export function deleteRoute(id: number): void {
  db().prepare("DELETE FROM routes WHERE id = ?").run(id);
}

// ---- holds ----

export function getHold(id: number): Hold | undefined {
  return db().prepare("SELECT * FROM holds WHERE id = ?").get(id) as Hold | undefined;
}

export function createHold(
  wallId: number,
  input: { route_id: number | null; x: number; y: number; w: number; h: number },
): Hold {
  const info = db()
    .prepare("INSERT INTO holds (wall_id, route_id, x, y, w, h, source) VALUES (?, ?, ?, ?, ?, ?, 'manual')")
    .run(wallId, input.route_id, input.x, input.y, input.w, input.h);
  return getHold(Number(info.lastInsertRowid))!;
}

export function updateHold(
  id: number,
  patch: Partial<Pick<Hold, "route_id" | "x" | "y" | "w" | "h">>,
): Hold | undefined {
  const fields = (["route_id", "x", "y", "w", "h"] as const).filter((k) => patch[k] !== undefined);
  if (fields.length > 0) {
    db()
      .prepare(`UPDATE holds SET ${fields.map((f) => `${f} = ?`).join(", ")} WHERE id = ?`)
      .run(...fields.map((f) => patch[f]), id);
  }
  return getHold(id);
}

export function deleteHold(id: number): void {
  db().prepare("DELETE FROM holds WHERE id = ?").run(id);
}

// ---- ascents ----

export function createAscent(routeId: number, climber: string, style: AscentStyle): Ascent {
  const info = db()
    .prepare("INSERT INTO ascents (route_id, climber, style) VALUES (?, ?, ?)")
    .run(routeId, climber, style);
  return db().prepare("SELECT * FROM ascents WHERE id = ?").get(Number(info.lastInsertRowid)) as Ascent;
}

export function deleteAscent(id: number): void {
  db().prepare("DELETE FROM ascents WHERE id = ?").run(id);
}
