# Township Scripts

## Current status

`main.js` remains the working controller during the migration. Do not add new gameplay systems to it.

The directories beside it are the permanent home for forward work. A directory is added before its first module is extracted so the repository already communicates the intended subsystem boundaries.

## Module rules

- `core/`: shared runtime services only. No town-specific decisions.
- `data/`: persistence, schema defaults, and migration only.
- `towns/`: town lifecycle and resident lifecycle.
- `lots/`: lot registration, geometry, and previews.
- `construction/`: durable builder work, block plans, terrain, roads, and ticking areas.
- `buildings/`: declarative building catalogs and plans; no scheduler logic.
- `ui/`: menus, form construction, and display text; no direct world mutations.
- `interactions/`: event handlers that route player actions to domain modules.
- `tools/`: Township utility-block behavior.
- `compat/`: a documented, tested compatibility layer only.
- `tests/`: small isolated proof packs or focused test modules.

## First extraction rule

The first runtime extraction will be a pure helper or immutable constants file. It must not change player-visible behavior. Each later extraction must be individually tested before the next system moves.
