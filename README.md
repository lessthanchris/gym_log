# Gym Log

Photograph a climbing wall, let Claude find the routes and holds, fix what it got wrong, grade each route, and let climbers log their top ropes, leads and attempts.

## How it works

1. **Add a wall**: take (or choose) a photo on the home page. The photo is stored and Claude's vision model groups the holds into routes by color, returning a bounding box for each hold.
2. **Correct it**: the editor opens while detection runs (usually a minute or two). Pick a route in the list, then use the tools:
   - **Assign**: tap a hold to add it to or remove it from the selected route. With no route selected, tapping a hold selects its route.
   - **Add hold**: drag a box around a missed hold, or tap to drop one.
   - **Move / resize**: tap a hold, then drag it or its corner handle.
   - **Delete**: tap a false detection to remove it.

   Rename routes, change their color, add routes, and set grades (YDS suggestions; any text is accepted, e.g. `6a+`). Zoom in with **+** for dense walls.
3. **Climb**: on the wall page, enter your name once (it's remembered in this browser), tap a route, and log **Lead**, **Top rope** or **Attempt**. The route list is sorted by grade and shows your best style on each route and how many people have sent it.

Unassigned holds are drawn with a dashed white outline. If detection fails (for example, no API key), you can still mark every hold by hand.

## Running it

Requires Node.js 20.9+.

```bash
npm install
cp .env.example .env.local   # then set OPENROUTER_API_KEY (or ANTHROPIC_API_KEY)
npm run dev                  # http://localhost:3000
```

To use it from your phone at the gym, run it on a machine your phone can reach (`npm run build && npm start`) and open it by the host's address.

Data lives in `./data` (SQLite database plus photos), or wherever `DATA_DIR` points.

Detection works with either key. With `OPENROUTER_API_KEY` it uses `anthropic/claude-opus-5.5` by default; set `OPENROUTER_MODEL` to try any other vision model on OpenRouter (use the ID shown on the model's OpenRouter page). With `ANTHROPIC_API_KEY` it calls Anthropic directly with `claude-opus-5-5` (override with `ANTHROPIC_MODEL`); if both keys are set, Anthropic is used.

## Development

```bash
npm test          # unit tests (vitest)
npm run lint
npm run typecheck
```

Layout:

- `src/lib/detect.ts`: the AI call (OpenRouter or Anthropic, structured JSON output) and conversion of its pixel boxes to normalized hold boxes.
- `src/lib/db.ts`: SQLite schema and queries (walls, routes, holds, ascents).
- `src/app/api/`: JSON route handlers used by the UI.
- `src/components/WallCanvas.tsx`: photo with the SVG hold overlay, shared by the editor (`WallEditor`) and the climber view (`WallView`).

## Not built yet

- Accounts: climbers identify themselves with a name only, so anyone can log or remove climbs as anyone.
- Pinch-to-zoom, and marking start/finish holds.
- Retiring routes when they are reset (for now, delete the route or re-photograph the wall).
