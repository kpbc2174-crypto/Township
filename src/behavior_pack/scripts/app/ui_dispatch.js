export function createTownshipUiDispatch({
  addonName,
  system,
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

  return { openTownshipBlockUiFromBlock, registerTownshipBlockComponents };
}
