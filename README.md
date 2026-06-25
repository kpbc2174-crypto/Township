# Township

Minecraft Bedrock Add-On source repository.

## Active source

- `Township BP/` — Behavior Pack source and Script API code.
- `Township RP/` — Resource Pack source and assets.

These are direct Bedrock pack roots. They remain at the repository root so a release package can be built from them without a staging copy.

## Project support

- `docs/PROJECT_STRUCTURE.md` — current pack and repository layout.
- `docs/DEVELOPMENT_WORKFLOW.md` — one-feature-at-a-time change process.
- `docs/UUID_REGISTRY.md` — pack identity values that normal updates preserve.
- `docs/TEST_LOG.md` — test record format and current checkpoint.
- `tools/validate_addon.py` — local JSON and BP/RP dependency validation.

Generated `.mcaddon` and `.mcpack` files are intentionally ignored. The repository holds source, not export copies.
