export type WallStatus = "detecting" | "ready" | "failed";

export type AscentStyle = "toprope" | "lead" | "attempt";

export const ASCENT_STYLES: AscentStyle[] = ["lead", "toprope", "attempt"];

export const STYLE_LABELS: Record<AscentStyle, string> = {
  toprope: "Top rope",
  lead: "Lead",
  attempt: "Attempt",
};

export interface Wall {
  id: number;
  name: string;
  width: number;
  height: number;
  status: WallStatus;
  error: string | null;
  created_at: string;
}

export interface Route {
  id: number;
  wall_id: number;
  name: string;
  color_name: string;
  color_hex: string;
  grade: string | null;
  created_at: string;
}

/** A hold's bounding box, normalized to 0..1 of the wall image. */
export interface Hold {
  id: number;
  wall_id: number;
  route_id: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  source: "ai" | "manual";
}

export interface Ascent {
  id: number;
  route_id: number;
  climber: string;
  style: AscentStyle;
  created_at: string;
}

export interface WallDetail {
  wall: Wall;
  routes: Route[];
  holds: Hold[];
  ascents: Ascent[];
}
