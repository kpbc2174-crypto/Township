export function registerTownshipEvents({
  addonName,
  version,
  world,
  system,
  runtimeState,
  sendSystemMessage,
  sendDebugLogError,
  messagePlayer,
  loadTowns,
  getTowns,
  getJobs,
  saveTowns,
  isLotMarkerType,
  isBuildLotRecorderType,
  registerTownFromBlock,
  registerBuildLotFromBlock,
  registerLotMarkerFromBlock,
  registerGroundLevelerFromBlock,
  registerBuildRecorderFromBlock,
  cleanupTownAt,
  cleanupLotAt,
  processTowns,
  processLotBorderPreview,
  constants
}) {
  const { FOUNDING_STONE_ID, GROUND_LEVELER_ID, BUILD_RECORDER_ID } = constants;
  const announced = new Set();

  try {
    world.afterEvents.playerPlaceBlock.subscribe(event => {
      try {
        const block = event.block;
        if (!block) return;
        if (block.typeId === FOUNDING_STONE_ID) registerTownFromBlock(block, event.player);
        else if (isBuildLotRecorderType(block.typeId)) registerBuildLotFromBlock(block, event.player);
        else if (isLotMarkerType(block.typeId)) registerLotMarkerFromBlock(block, event.player);
        else if (block.typeId === GROUND_LEVELER_ID) registerGroundLevelerFromBlock(block, event.player);
        else if (block.typeId === BUILD_RECORDER_ID) registerBuildRecorderFromBlock(block, event.player);
      } catch (error) {
        sendDebugLogError(addonName, "Global Place Event", error);
      }
    });
  } catch (error) {
    sendDebugLogError(addonName, "Subscribe playerPlaceBlock", error);
  }

  try {
    world.afterEvents.playerBreakBlock.subscribe(event => {
      try {
        const typeId = event.brokenBlockPermutation?.type?.id ?? event.brokenBlockPermutation?.typeId;
        if (typeId === FOUNDING_STONE_ID) cleanupTownAt(event.block.location, event.dimension.id, event.player);
        else if (isLotMarkerType(typeId)) cleanupLotAt(event.block.location, event.dimension.id, event.player);
        else if (typeId === BUILD_RECORDER_ID) messagePlayer(event.player, "§eTownship Build Recorder removed.");
        else if (typeId === GROUND_LEVELER_ID) {
          for (const town of getTowns()) {
            if (!town || town.dimensionId !== event.dimension.id) continue;
            town.jobs = getJobs(town).filter(job => !(job.type === "ground_leveler" && job.location && job.location.x === event.block.location.x && job.location.y === event.block.location.y && job.location.z === event.block.location.z));
          }
          saveTowns(getTowns());
          messagePlayer(event.player, "§eTownship Ground Leveler job removed.");
        }
      } catch (error) {
        sendDebugLogError(addonName, "Global Break Event", error);
      }
    });
  } catch (error) {
    sendDebugLogError(addonName, "Subscribe playerBreakBlock", error);
  }

  try {
    world.afterEvents.playerSpawn.subscribe(event => {
      try {
        const player = event.player;
        if (!player || announced.has(player.id)) return;
        announced.add(player.id);
        system.runTimeout(() => messagePlayer(player, `§7Township script loaded v${version}.`), 5);
      } catch (error) {
        sendDebugLogError(addonName, "Player Spawn Message", error);
      }
    });
  } catch (error) {
    sendDebugLogError(addonName, "Subscribe playerSpawn", error);
  }

  system.runTimeout(() => {
    loadTowns();
    sendSystemMessage(`§7Township script initialized v${version}.`);
  }, 1);

  system.runInterval(() => {
    runtimeState.tickCounter += 5;
    processTowns();
    processLotBorderPreview();
  }, 5);
}
