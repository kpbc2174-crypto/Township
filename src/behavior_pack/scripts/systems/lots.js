export function createLotSystem({
  addonName,
  sendDebugLogError,
  messagePlayer,
  clearBlock,
  isLotMarkerType,
  getLotSizeInfoFromMarker,
  getPlacementFacing,
  findTownContainingLocation,
  getTowns,
  getLots,
  getJobs,
  getLotBounds,
  getCenteredBounds,
  getFrontMarkerLotBounds,
  boundsOverlapOrTooClose,
  boundsOverlapInnerWallReserve,
  queueLotPrep,
  saveTowns,
  constants
}) {
  const {
    LOT_SMALL_HALF,
    LOT_SMALL_SIZE,
    LOT_BUFFER,
    ROAD_STATUS_NOT_CONNECTED,
    LOT_STATUS_REGISTERED
  } = constants;

  function getLotAtBlock(location, dimensionId) {
    for (const town of getTowns()) {
      if (!town || town.dimensionId !== dimensionId) continue;
      for (const lot of getLots(town)) {
        if (lot.marker && lot.marker.x === location.x && lot.marker.y === location.y && lot.marker.z === location.z) {
          return { town, lot };
        }
      }
    }
    return undefined;
  }

  function validateLotPlacement(block, player, options = {}) {
    const {
      label = "Lot Marker",
      requireRoadClearance = false,
      lotOverlapsAnyRoadReserve
    } = options;

    if (!block) return undefined;
    const location = block.location;
    const dimensionId = block.dimension.id;
    if (getLotAtBlock(location, dimensionId)) return undefined;

    const town = findTownContainingLocation(location, dimensionId);
    if (!town) {
      clearBlock(block);
      messagePlayer(player, `§cTownship ${label} rejected: place it inside the township radius.`);
      return undefined;
    }

    const placementFacing = getPlacementFacing(player);
    const lotSizeInfo = getLotSizeInfoFromMarker(block.typeId);
    const bounds = getFrontMarkerLotBounds(location, placementFacing.backDirection, lotSizeInfo.halfSize, lotSizeInfo.size - 1);

    if (boundsOverlapOrTooClose(bounds, getCenteredBounds(town.center, LOT_SMALL_HALF), LOT_BUFFER)) {
      clearBlock(block);
      messagePlayer(player, `§cTownship ${label} rejected: too close to the town center lot.`);
      return undefined;
    }

    if (boundsOverlapInnerWallReserve(town, bounds)) {
      clearBlock(block);
      messagePlayer(player, `§cTownship ${label} rejected: reserved inner-wall upgrade corridor.`);
      return undefined;
    }

    if (requireRoadClearance && typeof lotOverlapsAnyRoadReserve === "function" && lotOverlapsAnyRoadReserve(town, bounds)) {
      clearBlock(block);
      messagePlayer(player, `§cTownship ${label} rejected: too close to a protected road corridor.`);
      return undefined;
    }

    for (const lot of getLots(town)) {
      const existingBounds = getLotBounds(lot);
      if (existingBounds && boundsOverlapOrTooClose(bounds, existingBounds, LOT_BUFFER)) {
        clearBlock(block);
        messagePlayer(player, `§cTownship ${label} rejected: too close to another township lot.`);
        return undefined;
      }
    }

    return { town, location, placementFacing, lotSizeInfo, bounds };
  }

  function createLotRecord(block, placement, overrides = {}) {
    const { town, location, placementFacing, lotSizeInfo } = placement;
    const prefix = overrides.idPrefix ?? "lot";
    const lot = {
      id: `${town.id}_${prefix}_${getLots(town).length + 1}`,
      sizeName: lotSizeInfo.sizeName,
      size: lotSizeInfo.size,
      halfSize: lotSizeInfo.halfSize,
      markerTypeId: block.typeId,
      anchorMode: "front",
      frontDirection: placementFacing.frontDirection,
      backDirection: placementFacing.backDirection,
      marker: { x: location.x, y: location.y, z: location.z },
      buildingType: "empty",
      buildingLevel: 0,
      roadStatus: ROAD_STATUS_NOT_CONNECTED,
      assignedVillager: "none",
      locked: false,
      status: LOT_STATUS_REGISTERED,
      prepPhase: "not_started",
      ...overrides
    };
    delete lot.idPrefix;
    return lot;
  }

  function registerLotFromBlock(block, player, options = {}) {
    const {
      label = "Lot Marker",
      isValidType = isLotMarkerType,
      requireRoadClearance = false,
      lotOverlapsAnyRoadReserve,
      recordOverrides,
      successMessage,
      followUpMessage,
      errorSystem = "Register Lot Marker"
    } = options;

    try {
      if (!block || !isValidType(block.typeId)) return undefined;
      const placement = validateLotPlacement(block, player, { label, requireRoadClearance, lotOverlapsAnyRoadReserve });
      if (!placement) return undefined;

      const resolvedOverrides = typeof recordOverrides === "function"
        ? recordOverrides(placement)
        : (recordOverrides ?? {});
      const lot = createLotRecord(block, placement, resolvedOverrides);
      getLots(placement.town).push(lot);
      queueLotPrep(placement.town, lot);
      saveTowns(getTowns());

      messagePlayer(player, successMessage ?? `§aTownship ${lot.sizeName} registered. Lot ID: ${lot.id}`);
      if (followUpMessage) messagePlayer(player, followUpMessage);
      return { town: placement.town, lot };
    } catch (error) {
      sendDebugLogError(addonName, errorSystem, error);
      messagePlayer(player, `§cTownship error while registering ${label.toLowerCase()}. Check content log.`);
      return undefined;
    }
  }

  function registerLotMarkerFromBlock(block, player) {
    return registerLotFromBlock(block, player, {
      label: "Lot Marker",
      isValidType: isLotMarkerType,
      successMessage: undefined,
      followUpMessage: "§eTownship Builder queued lot preparation.",
      errorSystem: "Register Lot Marker"
    });
  }

  function getLotStatusText(town, lot) {
    if (!town || !lot) return "§cNo township lot record found for this Lot Marker.";
    const center = town.center ?? { x: 0, y: 0, z: 0 };
    const marker = lot.marker ?? { x: 0, y: 0, z: 0 };
    return [
      "§6--- Township Lot Status ---",
      `§eLot ID: §f${lot.id}`,
      `§eLot Size: §f${lot.sizeName ?? "Small Lot"} (${lot.size ?? LOT_SMALL_SIZE}x${lot.size ?? LOT_SMALL_SIZE})`,
      `§eBuilding Type: §f${lot.buildingType ?? "empty"}`,
      `§eBuilding Level: §f${lot.buildingLevel ?? 0}`,
      `§eLot Status: §f${lot.status ?? "unknown"}`,
      `§eLot Front: §f${lot.frontDirection ?? "unknown"}`,
      `§eLot Back: §f${lot.backDirection ?? "unknown"}`,
      `§ePrep Phase: §f${lot.prepPhase ?? "unknown"}`,
      `§eBuild Phase: §f${lot.buildPhase ?? "not_started"}`,
      `§eRoad Status: §f${lot.roadStatus ?? "not_connected"}`,
      `§eRoad Phase: §f${lot.roadPhase ?? "not_started"}`,
      `§eAssigned Villager: §f${lot.assignedVillager ?? "none"}`,
      `§eLocked: §f${lot.locked ? "true" : "false"}`,
      `§eMarker: §f${marker.x}, ${marker.y}, ${marker.z}`,
      `§eTown Center: §f${center.x}, ${center.y}, ${center.z}`
    ].join("\n");
  }

  function showLotStatusFromBlock(block, player) {
    try {
      if (!block || !isLotMarkerType(block.typeId)) return;
      const found = getLotAtBlock(block.location, block.dimension.id);
      if (!found) {
        messagePlayer(player, "§cNo township lot record found for this Lot Marker.");
        return;
      }
      messagePlayer(player, getLotStatusText(found.town, found.lot));
    } catch (error) {
      sendDebugLogError(addonName, "Show Lot Status", error);
      messagePlayer(player, "§cTownship error while reading lot status. Check content log.");
    }
  }

  function cleanupLotAt(location, dimensionId, player) {
    try {
      let changed = false;
      for (const town of getTowns()) {
        if (!town || town.dimensionId !== dimensionId) continue;
        const before = getLots(town).length;
        const removedLots = getLots(town).filter(lot => lot.marker && lot.marker.x === location.x && lot.marker.y === location.y && lot.marker.z === location.z);
        town.lots = getLots(town).filter(lot => !(lot.marker && lot.marker.x === location.x && lot.marker.y === location.y && lot.marker.z === location.z));
        if (town.lots.length !== before) {
          const removedIds = new Set(removedLots.map(lot => lot.id));
          town.jobs = getJobs(town).filter(job => !((job.type === "prepare_lot" || job.type === "build_small_house" || job.type === "build_road") && removedIds.has(job.lotId)));
          changed = true;
        }
      }
      if (changed) {
        saveTowns(getTowns());
        messagePlayer(player, "§eTownship lot record removed for this Lot Marker.");
      }
    } catch (error) {
      sendDebugLogError(addonName, "Cleanup Lot", error);
    }
  }

  return {
    getLotAtBlock,
    validateLotPlacement,
    createLotRecord,
    registerLotFromBlock,
    registerLotMarkerFromBlock,
    getLotStatusText,
    showLotStatusFromBlock,
    cleanupLotAt
  };
}
