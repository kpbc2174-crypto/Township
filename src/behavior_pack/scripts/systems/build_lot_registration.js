export function createBuildLotRegistrationSystem({
  addonName,
  safeLocationKey,
  sendDebugLogError,
  messagePlayer,
  getLotAtBlock,
  isBuildLotRecorderType,
  findTownContainingLocation,
  clearBlock,
  getPlacementFacing,
  getLotSizeInfoFromMarker,
  getFrontMarkerLotBounds,
  boundsOverlapOrTooClose,
  getCenteredBounds,
  boundsOverlapInnerWallReserve,
  lotOverlapsAnyRoadReserve,
  getLots,
  getLotBounds,
  queueLotPrep,
  saveTowns,
  getTowns,
  getBuildLotByBlock,
  ensureBuildLotSettings,
  getBuildLotCaptureBox,
  constants
}) {
  const { LOT_SMALL_HALF, LOT_BUFFER, ROAD_STATUS_NOT_CONNECTED, LOT_STATUS_REGISTERED } = constants;

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
      const lot = {
        id: `${town.id}_buildlot_${getLots(town).length + 1}`,
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

  function clearPhysicalBuildLot(block, player) {
    try {
      const found = getBuildLotByBlock(block);
      if (!found) {
        messagePlayer(player, "§cNo Build Lot record found for this block.");
        return;
      }
      const lot = found.lot;
      ensureBuildLotSettings(lot);
      const box = getBuildLotCaptureBox(lot);
      const bounds = getLotBounds(lot);
      const yBase = Math.floor(lot.marker.y) - 1;
      let cleared = 0;
      let restoredFloor = 0;
      for (let x = bounds.minX + 1; x <= bounds.maxX - 1; x++) {
        for (let z = bounds.minZ + 1; z <= bounds.maxZ - 1; z++) {
          for (let dy = box.minDy; dy <= box.maxDy; dy++) {
            const y = yBase + dy;
            if (x === lot.marker.x && y === lot.marker.y && z === lot.marker.z) continue;
            const target = block.dimension.getBlock({ x, y, z });
            if (!target) continue;
            if (y === yBase) {
              if (target.typeId !== "minecraft:dirt") {
                target.setType("minecraft:dirt");
                restoredFloor++;
              }
            } else if (target.typeId !== "minecraft:air") {
              target.setType("minecraft:air");
              cleared++;
            }
          }
        }
      }
      messagePlayer(player, `§ePhysical Build Lot cleared. Removed ${cleared} block(s), restored ${restoredFloor} floor block(s). Fence and recorder were kept.`);
    } catch (error) {
      sendDebugLogError(addonName, "Clear Physical Build Lot", error);
      messagePlayer(player, "§cPhysical Build Lot clear failed. Check content log.");
    }
  }

  return { registerBuildLotFromBlock, clearPhysicalBuildLot };
}
