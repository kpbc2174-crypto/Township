Township v1.0.10

Stable base carried forward from v1.0.7/v1.0.8.

This build exists primarily to fix Android import/update workflow by giving this exported build fresh pack UUIDs while preserving the same in-game identifiers such as township:founding_stone.

Included gameplay logic:
- Township Founding Stone creative block.
- BP/RP dependency linking.
- No-overlap township founding rule.
- Delayed Township Builder arrival.
- Starter camp lifecycle: clear lot, level lot, build camp, mark complete.
- Builder skips block placements when the target location already contains the correct block, including air blocks that are already air.
- Slightly larger starter camp layout from v1.0.9.
- Android-friendly crouch-near-Founding-Stone status display.
- Builder nudge-back during starter camp construction.

Known issues:
- Starter camp remains a temporary test structure.
- Builder is still a vanilla villager and can wander when not actively nudged.
- Future builds need proper lots, roads, storage, and Township Donation Crate systems.
