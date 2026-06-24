Township v1.0.84 Changelog

Purpose:
- Stable recovery build.
- Rebuilds from v1.0.63, the last confirmed line where Township blocks were visible and behaving normally.

Changed:
- Bumped Behavior Pack and Resource Pack manifest versions to 1.0.84.
- Updated script VERSION constant to 1.0.84.
- Added this version changelog.

Preserved intentionally:
- @minecraft/server dependency remains [1, 0, 47].
- @minecraft/server-ui dependency remains [1, 0, 47].
- Existing command-based ticking-area logic is preserved from the v1.0.63 line.
- Existing block JSON, texture setup, road logic, lot logic, recorder logic, and township setup logic are not intentionally changed.

Not included:
- No Script API 2.0.0 migration.
- No direct-click UI repair.
- No chunk-loading rewrite.
- No saved-building feature.
- No terrain-prep redesign.

Testing target:
- Confirm all custom Township blocks render normally.
- Confirm founding/township setup behaves like the stable pre-2.0 recovery line.
