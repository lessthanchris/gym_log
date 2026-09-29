import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Point the DB at a throwaway directory before the module opens it.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "gymlog-test-"));
const db = await import("../db");

describe("db", () => {
  let wallId: number;
  beforeAll(() => {
    wallId = db.createWall({ name: "Test wall", imageFile: "x.jpg", width: 100, height: 200 }).id;
  });

  it("replaces detections and numbers duplicate colors", () => {
    db.replaceDetection(wallId, [
      { color_name: "Green", color_hex: "#00ff00", holds: [{ x: 0.1, y: 0.1, w: 0.1, h: 0.1 }] },
      { color_name: "Green", color_hex: "#00ff00", holds: [{ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }] },
    ]);
    const detail = db.getWallDetail(wallId)!;
    expect(detail.routes.map((r) => r.name)).toEqual(["Green", "Green 2"]);
    expect(detail.holds).toHaveLength(2);
    expect(detail.holds.every((h) => h.source === "ai")).toBe(true);

    db.replaceDetection(wallId, []);
    expect(db.getWallDetail(wallId)!.routes).toHaveLength(0);
  });

  it("unassigns holds and drops ascents when a route is deleted", () => {
    const route = db.createRoute(wallId, { name: "Pink", color_name: "Pink", color_hex: "#ff00ff" });
    const hold = db.createHold(wallId, { route_id: route.id, x: 0.2, y: 0.2, w: 0.05, h: 0.05 });
    db.createAscent(route.id, "Sam", "lead");
    db.updateRoute(route.id, { grade: "5.10a" });
    expect(db.getWallDetail(wallId)!.ascents).toHaveLength(1);
    expect(db.getRoute(route.id)!.grade).toBe("5.10a");

    db.deleteRoute(route.id);
    expect(db.getHold(hold.id)!.route_id).toBeNull();
    expect(db.getWallDetail(wallId)!.ascents).toHaveLength(0);
  });

  it("updates hold geometry and route assignment", () => {
    const route = db.createRoute(wallId, { name: "Blue", color_name: "Blue", color_hex: "#0000ff" });
    const hold = db.createHold(wallId, { route_id: null, x: 0.1, y: 0.1, w: 0.05, h: 0.05 });
    expect(db.updateHold(hold.id, { route_id: route.id, x: 0.3 })).toMatchObject({ route_id: route.id, x: 0.3, y: 0.1 });
    expect(db.updateHold(hold.id, { route_id: null })!.route_id).toBeNull();
  });
});
