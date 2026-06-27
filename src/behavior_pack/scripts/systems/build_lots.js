export function createBuildLotSystem({
  safeLocationKey,
  isBuildLotRecorderType,
  registerLotFromBlock,
  lotOverlapsAnyRoadReserve,
  constants
}) {
  const { ROAD_STATUS_NOT_CONNECTED } = constants;

  function registerBuildLotFromBlock(block, player) {
    return registerLotFromBlock(block, player, {
      label: "Build Lot",
      isValidType: isBuildLotRecorderType,
      requireRoadClearance: true,
      lotOverlapsAnyRoadReserve,
      errorSystem: "Register Build Lot",
      recordOverrides: ({ location, lotSizeInfo }) => ({
        idPrefix: "buildlot",
        recorderSizeName: lotSizeInfo.recorderSizeName,
        buildingType: "recorder_blank",
        roadStatus: ROAD_STATUS_NOT_CONNECTED,
        locked: true,
        isBuildLotRecorder: true,
        buildName: `custom_${lotSizeInfo.recorderSizeName}_${safeLocationKey(location)}`,
        captureDown: 1,
        captureUp: 12,
        includeNaturalBlocks: false,
        savedCaptureKey: undefined
      }),
      successMessage: "§aTownship Build Lot registered. Blank lot prep queued.",
      followUpMessage: "§eBuild inside the fenced blank lot, then tap this block to name, save, export, or clear it."
    });
  }

  return { registerBuildLotFromBlock };
}
