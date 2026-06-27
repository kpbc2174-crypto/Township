export function createBuildLotSystem({
  addonName,
  safeLocationKey,
  sendDebugLogError,
  messagePlayer,
  clearBlock,
  isBuildLotRecorderType,
  getLotSizeInfoFromMarker,
  getLotAtBlock,
  findTownContainingLocation,
  getPlacementFacing,
  getFrontMarkerLotBounds,
  getCenteredBounds,
  boundsOverlapOrTooClose,
  boundsOverlapInnerWallReserve,
  lotOverlapsAnyRoadReserve,
  getLots,
  getLotBounds,
  queueLotPrep,
  saveTowns,
  getTowns,
  constants
}) {
  const {
    LOT_SMALL_HALF,
    LOT_BUFFER,
    ROAD_STATUS_NOT_CONNECTED,
    LOT_STATUS_REGISTERED
  } = constants;

  function registerBuildLotFromBlock(block, player) {
    try {
      if (!block || !isBuildLotRecorderType(block.typeId)) return;
      const location = block.location;
      const dimensionId = block.dimension.id;

      if (getLotAtBlock(location, dimensionId)) return;

      const town = findTownContainingLocation(location, dimensionId);
      if (!town) {
        clearBlock(block);
        messagePlayer(player, "§cTownship Build Lot rejected: place it inside the township radius.");
        return;
      }

      const placementFacing = getPlacementFacing(player);
      const lotSizeInfo = getLotSizeInfoFromMarker(block.typeId);
      const newLotBounds = getFrontMarkerLotBounds(location, placementFacing.backDirection, lotSizeInfo.halfSize, lotSizeInfo.size - 1);

      if (boundsOverlapOrTooClose(newLotBounds, getCenteredBounds(town.center, LOT_SMALL_HALF), LOT_BUFFER)) {
        clearBlock(block);
        messagePlayer(player, "§cTownship Build Lot rejected: too close to the town center lot.");
        return;
      }

      if (boundsOverlapInnerWallReserve(town, newLotBounds)) {
        clearBlock(block);
        messagePlayer(player, "§cTownship Build Lot rejected: reserved inner-wall upgrade corridor.");
        return;
      }

      if (lotOverlapsAnyRoadReserve(town, newLotBounds)) {
        clearBlock(block);
        messagePlayer(player, "§cTownship Build Lot rejected: too close to a protected road corridor.");
        return;
      }

      for (const lot of getLots(town)) {
        const existingBounds = getLotBounds(lot);
        if (existingBounds && boundsOverlapOrTooClose(newLotBounds, existingBounds, LOT_BUFFER)) {
          clearBlock(block);
          messagePlayer(player, "§cTownship Build Lot rejected: too close to another township lot.");
          return;
        }
      }

      const lotId = `${town.id}_buildlot_${getLots(town).length + 1}`;
      const lot = {
        id: lotId,
        sizeName: lotSizeInfo.sizeName,
        recorderSizeName: lotSizeInfo.recorderSizeName,
        size: lotSizeInfo.size,
        halfSize: lotSizeInfo.halfSize,
        markerTypeId: block.typeId,
        anchorMode: "front",
        frontDirection: placementFacing.frontDirection,
        backDirection: placementFacing.backDirection,
        marker: { x: location.x, y: location.y, z: location.z },
        buildingType: "recorder_blank",
        buildingLevel: 0,
        roadStatus: ROAD_STATUS_NOT_CONNECTED,
        assignedVillager: "none",
        locked: true,
        isBuildLotRecorder: true,
        buildName: `custom_${lotSizeInfo.recorderSizeName}_${safeLocationKey(location)}`,
        captureDown: 1,
        captureUp: 12,
        includeNaturalBlocks: false,
        savedCaptureKey: undefined,
        status: LOT_STATUS_REGISTERED,
        prepPhase: "not_started"
      };

      getLots(town).push(lot);
      queueLotPrep(town, lot);
      saveTowns(getTowns());
      messagePlayer(player, `§aTownship ${lot.sizeName} Build Lot registered. Blank lot prep queued.`);
      messagePlayer(player, "§eBuild inside the fenced blank lot, then tap this block to name, save, export, or clear it.");
    } catch (error) {
      sendDebugLogError(addonName, "Register Build Lot", error);
      messagePlayer(player, "§cTownship error while registering Build Lot. Check content log.");
    }
  }

  return { registerBuildLotFromBlock };
}
