# Township Project Structure

## Source roots

- `src/behavior_pack/` is the editable Behavior Pack source.
- `src/resource_pack/` is the editable Resource Pack source.

The build tool packages those two roots as `Township BP/` and `Township RP/` inside the `.mcaddon`.

## Script layout

- `scripts/main.js` is the stable Script API entry point.
- `scripts/app/runtime.js` contains the current runtime until individual systems are migrated.
- `scripts/core/` is for versioning and shared project state.
- `scripts/shared/` is for reusable helpers.
- `scripts/systems/` is for township systems.
- `scripts/ui/` is for forms.

## Repository support

- `docs/` stores project records.
- `tools/` stores repeatable validation and packaging helpers.
- `.github/workflows/` stores validation automation only.

Do not store generated packages, Miner exports, Base64 dumps, or temporary import files in this repository.
