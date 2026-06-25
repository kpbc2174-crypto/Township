import { system } from "@minecraft/server";

const COMPONENT_IDS = [
  "township:founding_stone_component",
  "township:lot_marker_component",
  "township:build_recorder_component",
  "township:ground_leveler_component"
];

export function registerTownshipBlockComponents(event, openUi, reportError) {
  try {
    const registry = event.blockComponentRegistry;
    if (!registry) return;

    for (const componentId of COMPONENT_IDS) {
      registry.registerCustomComponent(componentId, {
        onPlayerInteract(componentEvent) {
          const block = componentEvent.block;
          const player = componentEvent.player;
          system.run(() => openUi(block, player));
        }
      });
    }
  } catch (error) {
    reportError?.("Register Township Block Components", error);
  }
}
