# Refactor Status

## Completed repository cleanup

- Active source roots remain `Township BP/` and `Township RP/`.
- One-time source-reconstruction script and workflow were removed.
- Obsolete temporary upload status documentation was removed.
- Repository rules, UUID registry, test log, release checklist, and JSON validation tool were added.

## Next structural migration

The next source migration moves the Script API implementation behind a stable entry point:

- `scripts/main.js` remains the manifest entry point.
- `scripts/app/runtime.js` becomes the current complete runtime implementation.
- `scripts/core/version.js` owns the add-on name and source version.
- `scripts/shared/debug_log_bridge.js` owns Debug Log Reader transport.

This is intentionally a source-only structural migration. It must not change Township gameplay behavior.
