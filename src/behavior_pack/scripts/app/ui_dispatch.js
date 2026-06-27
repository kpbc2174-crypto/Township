export function createTownshipUiDispatch({
  addonName,
  sendDebugLogError,
  registerBlockInteractionComponents,
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
    registerBlockInteractionComponents(
      event,
      openTownshipBlockUiFromBlock,
      (systemName, error) => sendDebugLogError(addonName, systemName, error)
    );
  }

  return { openTownshipBlockUiFromBlock, registerTownshipBlockComponents };
}
