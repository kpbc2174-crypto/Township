export function createTownshipUiDispatch({
  addonName,
  world,
  system,
  runtimeState,
  sendDebugLogError,
  isLotMarkerType,
  isBuildLotRecorderType,
  showTownStatusFromBlock,
  showBuildLotMenu,
  showLotMarkerMenu,
  showGroundLevelerMenu,
  showBuildRecorderMenu,
  constants
}) {
  const { FOUNDING_STONE_ID, GROUND_LEVELER_ID, BUILD_RECORDER_ID } = constants;
  const lastSneakState = new Map();
  const STATUS_SNEAK_RADIUS = 3;

  function findNearestTownshipStatusBlockNearPlayer(player, radius = STATUS_SNEAK_RADIUS) {
    try {
      if (!player || !player.location || !player.dimension) return undefined;
      const px = Math.floor(player.location.x);
      const py = Math.floor(player.location.y);
      const pz = Math.floor(player.location.z);
      let bestBlock;
      let bestDistance = 999999;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -1; dy <= 2; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const block = player.dimension.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
            if (!block || (block.typeId !== FOUNDING_STONE_ID && !isLotMarkerType(block.typeId) && !isBuildLotRecorderType(block.typeId) && block.typeId !== GROUND_LEVELER_ID && block.typeId !== BUILD_RECORDER_ID)) continue;
            const distance = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestBlock = block;
            }
          }
        }
      }
      return bestBlock;
    } catch (error) {
      sendDebugLogError(addonName, "Find Nearby Township Status Block", error);
      return undefined;
    }
  }

  function openTownshipBlockUiFromBlock(block, player) {
    try {
      if (!block || !player) return;
      if (block.typeId === FOUNDING_STONE_ID) showTownStatusFromBlock(block, player);
      else if (isBuildLotRecorderType(block.typeId)) showBuildLotMenu(block, player);
      else if (isLotMarkerType(block.typeId)) showLotMarkerMenu(block, player);
      else if (block.typeId === GROUND_LEVELER_ID) showGroundLevelerMenu(block, player);
      else if (block.typeId === BUILD_RECORDER_ID) showBuildRecorderMenu(block, player);
    } catch (error) {
      sendDebugLogError(addonName, "Open Township Block UI", error);
    }
  }

  function processSneakStatusChecks() {
    try {
      for (const player of world.getPlayers()) {
        const key = player.id;
        const nowSneaking = !!player.isSneaking;
        const wasSneaking = !!lastSneakState.get(key);
        lastSneakState.set(key, nowSneaking);
        if (!nowSneaking || wasSneaking) continue;
        const block = findNearestTownshipStatusBlockNearPlayer(player);
        if (block) system.run(() => openTownshipBlockUiFromBlock(block, player));
      }
    } catch (error) {
      sendDebugLogError(addonName, "Process Sneak Status Checks", error);
    }
  }

  function registerTownshipBlockComponents(event) {
    try {
      const registry = event.blockComponentRegistry;
      if (!registry) return;
      const componentNames = [
        "township:founding_stone_component",
        "township:lot_marker_component",
        "township:build_recorder_component",
        "township:ground_leveler_component"
      ];
      for (const name of componentNames) {
        registry.registerCustomComponent(name, {
          onPlayerInteract(componentEvent) {
            system.run(() => openTownshipBlockUiFromBlock(componentEvent.block, componentEvent.player));
          }
        });
      }
    } catch (error) {
      sendDebugLogError(addonName, "Register Township Block Components", error);
    }
  }

  return { findNearestTownshipStatusBlockNearPlayer, openTownshipBlockUiFromBlock, processSneakStatusChecks, registerTownshipBlockComponents };
}
