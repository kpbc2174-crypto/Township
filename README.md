# Township

Minecraft Bedrock Add-On source repository.

## Active source

- `src/behavior_pack/` — editable Behavior Pack source and Script API code.
- `src/resource_pack/` — editable Resource Pack source and assets.

The packaging tool writes these source roots into the required `Township BP/` and `Township RP/` archive roots inside an `.mcaddon` file.

## Script layout

- `scripts/main.js` — manifest entry point.
- `scripts/app/runtime.js` — current complete runtime.
- `scripts/core/` — versioning and future shared project state.
- `scripts/shared/` — reusable helpers.
- `scripts/systems/` — future independent township systems.
- `scripts/ui/` — future form routing and screens.

## Project support

- `docs/PROJECT_STRUCTURE.md` — repository and pack layout.
- `docs/DEVELOPMENT_WORKFLOW.md` — change process.
- `docs/UUID_REGISTRY.md` — stable pack identity values.
- `docs/TEST_LOG.md` — test record format.
- `docs/RELEASE_CHECKLIST.md` — release gate.
- `tools/validate_addon.py` — JSON and BP/RP dependency validation.
- `tools/package_addon.py` — repeatable `.mcaddon` packaging.

Generated packages and temporary import material do not belong in this repository.
