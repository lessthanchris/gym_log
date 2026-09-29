import { describe, expect, it } from "vitest";
import { normalizeDetection, normalizeHex } from "../detect";

describe("normalizeDetection", () => {
  it("converts pixel boxes to normalized holds", () => {
    const [route] = normalizeDetection(
      { routes: [{ color_name: "orange", color_hex: "#FF8800", holds: [{ x_min: 100, y_min: 50, x_max: 150, y_max: 100 }] }] },
      1000,
      500,
    );
    expect(route.color_name).toBe("Orange");
    expect(route.color_hex).toBe("#ff8800");
    expect(route.holds[0]).toEqual({ x: 0.1, y: 0.1, w: expect.closeTo(0.05), h: expect.closeTo(0.1) });
  });

  it("clamps out-of-bounds boxes, fixes swapped corners, and drops empty routes", () => {
    const routes = normalizeDetection(
      {
        routes: [
          { color_name: "Blue", color_hex: "00f", holds: [{ x_min: 1100, y_min: 90, x_max: 950, y_max: -10 }] },
          { color_name: "Ghost", color_hex: "#123456", holds: [{ x_min: 10, y_min: 10, x_max: 10.5, y_max: 30 }] },
        ],
      },
      1000,
      1000,
    );
    expect(routes).toHaveLength(1);
    expect(routes[0].color_hex).toBe("#0000ff");
    expect(routes[0].holds[0]).toEqual({ x: 0.95, y: 0, w: expect.closeTo(0.05), h: expect.closeTo(0.09) });
  });
});

describe("normalizeHex", () => {
  it("falls back to gray for junk", () => {
    expect(normalizeHex("orange")).toBe("#888888");
  });
});
