import { ActionFormData } from "@minecraft/server-ui";

export function createTownshipForms({
  addonName,
  runtimeState,
  system,
  sendDebugLogError,
  messagePlayer,
  getTowns,
  getLots,
  getJobs,
  saveTowns,
  ensureTownAutomationDefaults,
  getTownStatusText,
  getLotStatusText,
  getLotAtBlock,
  cleanupLotAt,
  queueReadyLotsForAutoBuild,
  queueRoadsForCompletedBuildings,
  queueBoundaryRebuild,
  runAutoLotPlacement,
  registerGroundLevelerFromBlock,
  constants
}) {
  const {
    GROUND_LEVELER_ID,
    GROUND_LEVELER_SIZE,
    GROUND_LEVELER_CLEAR_HEIGHT,
    LOT_STATUS_QUEUED,
    LOT_STATUS_PREPARING,
    LOT_STATUS_BUILDING,
    ROAD_STATUS_QUEUED,
    ROAD_STATUS_BUILDING,
    ROAD_STATUS_NOT_CONNECTED,
    LOT_SMALL_SIZE
  } = constants;

  function showLotMarkerMenu(block, player) {
    try {
      const found = getLotAtBlock(block.location, block.dimension.id);
      if (!found) {
        messagePlayer(player, "§cNo township lot record found for this Lot Marker.");
        return;
      }
      const form = new ActionFormData()
        .title("Township Lot Marker")
        .body(getLotStatusText(found.town, found.lot))
        .button("Show Status in Chat")
        .button("Remove Lot Record")
        .button("Close");
      form.show(player).then(response => {
        try {
          if (response.canceled) return;
          if (response.selection === 0) messagePlayer(player, getLotStatusText(found.town, found.lot));
          else if (response.selection === 1) cleanupLotAt(block.location, block.dimension.id, player);
        } catch (error) {
          sendDebugLogError(addonName, "Lot Marker UI Selection", error);
        }
      }).catch(error => sendDebugLogError(addonName, "Lot Marker UI", error));
    } catch (error) {
      sendDebugLogError(addonName, "Show Lot Marker Menu", error);
      messagePlayer(player, "§cTownship Lot Marker UI failed. Check content log.");
    }
  }

  function showGroundLevelerMenu(block, player) {
    try {
      if (!block || block.typeId !== GROUND_LEVELER_ID) return;
      const body = [
        "§6Township Ground Leveler",
        `§eRange: §f${GROUND_LEVELER_SIZE}x${GROUND_LEVELER_SIZE}`,
        `§eClear Height: §f${GROUND_LEVELER_CLEAR_HEIGHT} blocks above`,
        "§eLevel Target: §fits own base level",
        "§7The leveler normally queues its job when placed. Use Run Again if the first queue did not start."
      ].join("\n");
      const form = new ActionFormData()
        .title("Township Ground Leveler")
        .body(body)
        .button("Run Leveler Again")
        .button("Show Info in Chat")
        .button("Close");
      form.show(player).then(response => {
        try {
          if (response.canceled) return;
          if (response.selection === 0) registerGroundLevelerFromBlock(block, player);
          else if (response.selection === 1) messagePlayer(player, body);
        } catch (error) {
          sendDebugLogError(addonName, "Ground Leveler UI Selection", error);
        }
      }).catch(error => sendDebugLogError(addonName, "Ground Leveler UI", error));
    } catch (error) {
      sendDebugLogError(addonName, "Show Ground Leveler Menu", error);
      messagePlayer(player, "§cTownship Ground Leveler UI failed. Check content log.");
    }
  }

  function showFoundingStoneMenu(block, player, town) {
    try {
      ensureTownAutomationDefaults(town);
      const body = `${getTownStatusText(town)}\n\nUse these controls to manage township automation. Settings are saved in the township record.`;
      const form = new ActionFormData()
        .title("Township Founding Stone")
        .body(body)
        .button(`Auto Build Lots: ${(town.autoBuildLots ?? true) ? "ON" : "OFF"}`)
        .button(`Auto Roads: ${(town.autoRoads ?? true) ? "ON" : "OFF"}`)
        .button(`Auto Place Lots: ${(town.autoPlaceLots ?? false) ? "ON" : "OFF"}`)
        .button(town.builderPaused ? "Resume Builder" : "Pause Builder")
        .button("Rebuild Town Fence")
        .button("Clear Stuck Queue")
        .button("Show Status in Chat");
      form.show(player).then(response => {
        try {
          if (response.canceled) return;
          const towns = getTowns();
          const liveTown = towns.find(item => item && item.id === town.id) ?? town;
          ensureTownAutomationDefaults(liveTown);
          if (response.selection === 0) {
            liveTown.autoBuildLots = !(liveTown.autoBuildLots ?? true);
            const queued = liveTown.autoBuildLots ? queueReadyLotsForAutoBuild(liveTown) : 0;
            messagePlayer(player, `§eAuto Build Lots is now ${liveTown.autoBuildLots ? "ON" : "OFF"}.${queued ? ` Queued ${queued} ready lot(s).` : ""}`);
          } else if (response.selection === 1) {
            liveTown.autoRoads = !(liveTown.autoRoads ?? true);
            const queued = liveTown.autoRoads ? queueRoadsForCompletedBuildings(liveTown) : 0;
            messagePlayer(player, `§eAuto Roads is now ${liveTown.autoRoads ? "ON" : "OFF"}.${queued ? ` Queued ${queued} road job(s).` : ""}`);
          } else if (response.selection === 2) {
            liveTown.autoPlaceLots = !(liveTown.autoPlaceLots ?? false);
            liveTown.nextAutoPlaceTick = runtimeState.tickCounter;
            const placed = liveTown.autoPlaceLots ? runAutoLotPlacement(liveTown, true) : 0;
            messagePlayer(player, `§eAuto Place Lots is now ${liveTown.autoPlaceLots ? "ON" : "OFF"}.${placed ? ` Placed ${placed} lot marker(s).` : ""}`);
          } else if (response.selection === 3) {
            liveTown.builderPaused = !liveTown.builderPaused;
            messagePlayer(player, liveTown.builderPaused ? "§eTownship builder paused." : "§aTownship builder resumed.");
          } else if (response.selection === 4) {
            const queued = queueBoundaryRebuild(liveTown);
            messagePlayer(player, queued ? "§eTown fence rebuild queued." : "§eTown fence rebuild was already queued.");
          } else if (response.selection === 5) {
            const before = getJobs(liveTown).length;
            liveTown.jobs = getJobs(liveTown).filter(job => job && job.type === "town_prep" && job.status !== "complete");
            for (const lot of getLots(liveTown)) {
              if (!lot) continue;
              if (lot.status === LOT_STATUS_QUEUED || lot.status === LOT_STATUS_PREPARING || lot.status === LOT_STATUS_BUILDING) {
                lot.status = "ready";
                lot.prepPhase = lot.prepPhase === "queued" ? "manual_reset" : lot.prepPhase;
              }
              if (lot.roadStatus === ROAD_STATUS_QUEUED || lot.roadStatus === ROAD_STATUS_BUILDING) lot.roadStatus = ROAD_STATUS_NOT_CONNECTED;
            }
            messagePlayer(player, `§eCleared ${before - getJobs(liveTown).length} non-town-prep queued job(s).`);
          } else if (response.selection === 6) {
            messagePlayer(player, getTownStatusText(liveTown));
          }
          saveTowns(towns);
        } catch (error) {
          sendDebugLogError(addonName, "Founding Stone Menu Action", error);
          messagePlayer(player, "§cTownship menu action failed. Check content log.");
        }
      }).catch(error => sendDebugLogError(addonName, "Founding Stone UI", error));
    } catch (error) {
      sendDebugLogError(addonName, "Show Founding Stone Menu", error);
      messagePlayer(player, getTownStatusText(town));
    }
  }

  return { showLotMarkerMenu, showGroundLevelerMenu, showFoundingStoneMenu };
}
