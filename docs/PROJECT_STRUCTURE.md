# Township Project Structure

## Active Minecraft source

- `Township BP/` — Behavior Pack source. Keep this as the real Bedrock pack root so it can be packaged directly.
- `Township RP/` — Resource Pack source. Keep this as the real Bedrock pack root so it can be packaged directly.

Do not put recovery archives, readable Miner exports, Base64 files, or generated `.mcaddon` packages inside either pack.

## Behavior Pack layout

- `manifest.json` — pack identity and Script API dependencies.
- `blocks/` — custom block definitions.
- `item_catalog/` — creative catalog entries.
- `scripts/main.js` — only Script API entry point.
- `scripts/` — shared Script API code.

As Township grows, new script modules belong under these directories while `scripts/main.js` remains the entry point:

- `scripts/core/` — startup, versioning, world state, registry access.
- `scripts/systems/` — township founding, lots, roads, builders, terrain preparation, resources.
- `scripts/ui/` — forms and UI routing.
- `scripts/shared/` — debug bridge, constants, safe helpers, formatting.

Move one working system at a time from `main.js`; do not refactor the whole script as an untested migration.

## Resource Pack layout

- `manifest.json` — Resource Pack identity and BP dependency.
- `textures/blocks/` — block textures.
- `textures/terrain_texture.json` — terrain atlas registrations.
- `texts/` — language files.

Future resource content uses normal Bedrock folders only when needed: `models/`, `entity/`, `animations/`, `animation_controllers/`, `render_controllers/`, `attachables/`, `particles/`, `sounds/`, `fogs/`, and `biomes/`.

## Repository support files

- `docs/` — architecture, UUID registry, changelog, workflow, and test records.
- `tools/` — repeatable validation/build helpers only.
- `.github/workflows/` — repository validation only.

Keep the repository root clean. No generated `.mcaddon` files, no temporary import files, and no unrelated Miner exports.
