import { world, system } from "@minecraft/server";
import { sendDebugLogError } from "../shared/debug_log_bridge.js";
import { ADDON_NAME, VERSION } from "../core/version.js";
import * as constants from "../core/constants.js";
import {
  runtimeState, townTag, safeLocationKey, distance2D, getPlacementFacing,
  isBuildLotRecorderType, isLotMarkerType, getLotSizeInfoFromMarker,
  directionStateNumber, addBlockEntry, transformFromBackAnchor, transformTownLocal,
  sendSystemMessage, messagePlayer, loadTowns, getTowns, saveTowns,
  findNearbyTown, getTownAtBlock, findTownContainingLocation,
  boundsOverlapOrTooClose, getCenteredBounds, getFrontMarkerLotBounds,
  getLotBounds, getLots, getJobs, ensureTownAutomationDefaults,
  getLotById, hashStringNumber, pointInsideBounds
} from "../core/runtime_state.js";
import { createBuildingPlans } from "../systems/building_plans.js";
import { registerTownshipBlockComponents as registerBlockInteractionComponents } from "../systems/block_interactions.js";
import { createWorkBlockHelpers } from "../systems/work_blocks.js";
import { createActiveJobSystem } from "../systems/active_jobs.js";
import { createStarterCampSystem } from "../systems/starter_camp.js";
import { createTownPrepSystem } from "../systems/town_prep.js";
import { createRoadSystem } from "../systems/roads.js";
import { createBuildingSystem } from "../systems/buildings.js";
import { createLotPrepSystem } from "../systems/lot_prep.js";
import { createAutoLotSystem } from "../systems/auto_lots.js";
import { createLotSystem } from "../systems/lots.js";
import { createBuildLotSystem } from "../systems/build_lots.js";
import { createBuildRecorderStore } from "../systems/build_recorder_store.js";
import { createGroundLevelerSystem } from "../systems/ground_leveler.js";
import { createTownOperationsSystem } from "../systems/town_operations.js";
import { createTownRegistrySystem } from "../systems/town_registry.js";
import { createTownScheduler } from "../systems/town_scheduler.js";
import { createLotPreviewSystem } from "../shared/lot_preview.js";
import { createTownshipForms } from "../ui/township_forms.js";
import { createBuildLotForms } from "../ui/build_lot_forms.js";
import { createBuildRecorderForms } from "../ui/build_recorder_forms.js";
import { createTownshipUiDispatch } from "./ui_dispatch.js";
import { registerTownshipEvents } from "./event_wiring.js";

function getDimensionFromId(dimensionId) {
  return world.getDimension(dimensionId.replace("minecraft:", ""));
}

function expandBounds(bounds, amount) {
  if (!bounds) return undefined;
  return {
    minX: bounds.minX - amount,
    maxX: bounds.maxX + amount,
    minZ: bounds.minZ - amount,
    maxZ: bounds.maxZ + amount
  };
}

function boundsOverlapInnerWallReserve(town, bounds) {
  try {
    if (!town || !town.center || !bounds) return false;
    const cx = Math.floor(town.center.x);
    const cz = Math.floor(town.center.z);
    const r = constants.TOWN_BOUNDARY_RADIUS;
    const w = constants.INNER_WALL_RESERVE_HALF_WIDTH;
    const rel = {
      minX: bounds.minX - cx,
      maxX: bounds.maxX - cx,
      minZ: bounds.minZ - cz,
      maxZ: bounds.maxZ - cz
    };
    const overlapsWallBandSquare = rel.minX <= r + w && rel.maxX >= -r - w && rel.minZ <= r + w && rel.maxZ >= -r - w;
    if (!overlapsWallBandSquare) return false;
    const fullyInsideSafeInner = rel.minX > -r + w && rel.maxX < r - w && rel.minZ > -r + w && rel.maxZ < r - w;
    const fullyOutsideWallBand = rel.maxX < -r - w || rel.minX > r + w || rel.maxZ < -r - w || rel.minZ > r + w;
    return !fullyInsideSafeInner && !fullyOutsideWallBand;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Inner Wall Reserve Check", error);
    return false;
  }
}

function clearBlock(block) {
  try {
    system.run(() => {
      try { block.setType("minecraft:air"); }
      catch (error) { sendDebugLogError(ADDON_NAME, "Clear Block", error); }
    });
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Clear Block Schedule", error);
  }
}

const buildingPlans = createBuildingPlans({
  transformFromBackAnchor,
  directionStateNumber,
  addBlockEntry,
  hashStringNumber,
  lotPathOffset: constants.LOT_PATH_OFFSET,
  lotSmallHalf: constants.LOT_SMALL_HALF,
  lotSmallSize: constants.LOT_SMALL_SIZE
});

const workBlocks = createWorkBlockHelpers({
  addonName: ADDON_NAME,
  runtimeState,
  sendSystemMessage,
  sendDebugLogError,
  isLotMarkerType,
  constants
});

const activeJobs = createActiveJobSystem({
  addonName: ADDON_NAME,
  runtimeState,
  sendSystemMessage,
  sendDebugLogError,
  getLotById,
  getLotBounds,
  blockAlreadyMatches: workBlocks.blockAlreadyMatches,
  constants
});

const starterCamp = createStarterCampSystem({
  addonName: ADDON_NAME,
  runtimeState,
  safeLocationKey,
  transformTownLocal,
  distance2D,
  townTag,
  sendSystemMessage,
  sendDebugLogError,
  getDimensionFromId,
  getJobs,
  isLotMarkerType,
  blockAlreadyMatches: workBlocks.blockAlreadyMatches,
  safeSetBlock: workBlocks.safeSetBlock,
  waitForTickingAreaReady: workBlocks.waitForTickingAreaReady,
  constants
});

const townPrep = createTownPrepSystem({
  addonName: ADDON_NAME,
  runtimeState,
  safeLocationKey,
  sendSystemMessage,
  sendDebugLogError,
  getJobs,
  getDimensionFromId,
  blockAlreadyMatches: workBlocks.blockAlreadyMatches,
  safeSetBlock: workBlocks.safeSetBlock,
  waitForTickingAreaReady: workBlocks.waitForTickingAreaReady,
  constants
});

const roads = createRoadSystem({
  addonName: ADDON_NAME,
  runtimeState,
  transformFromBackAnchor,
  distance2D,
  sendSystemMessage,
  sendDebugLogError,
  getJobs,
  getLots,
  getLotById,
  getLotBounds,
  getCenteredBounds,
  pointInsideBounds,
  getDimensionFromId,
  isLotMarkerType,
  ensureActiveJobTickingArea: activeJobs.ensureActiveJobTickingArea,
  removeActiveJobTickingArea: activeJobs.removeActiveJobTickingArea,
  waitForTickingAreaReady: workBlocks.waitForTickingAreaReady,
  verifyPlanComplete: activeJobs.verifyPlanComplete,
  blockAlreadyMatches: workBlocks.blockAlreadyMatches,
  safeSetBlock: workBlocks.safeSetBlock,
  keepBuilderNearLocation: starterCamp.keepBuilderNearLocation,
  constants
});

const queueRoadToTown = (...args) => roads.queueRoadToTown(...args);
const buildings = createBuildingSystem({
  addonName: ADDON_NAME,
  runtimeState,
  buildingPlans,
  sendSystemMessage,
  sendDebugLogError,
  getJobs,
  getLotById,
  getDimensionFromId,
  ensureTownAutomationDefaults,
  isLotMarkerType,
  ensureActiveJobTickingArea: activeJobs.ensureActiveJobTickingArea,
  removeActiveJobTickingArea: activeJobs.removeActiveJobTickingArea,
  waitForTickingAreaReady: workBlocks.waitForTickingAreaReady,
  verifyPlanComplete: activeJobs.verifyPlanComplete,
  blockAlreadyMatches: workBlocks.blockAlreadyMatches,
  safeSetBlock: workBlocks.safeSetBlock,
  keepBuilderNearLocation: starterCamp.keepBuilderNearLocation,
  queueRoadToTown,
  constants
});

const queueSmallHouseBuild = (...args) => buildings.queueSmallHouseBuild(...args);
const lotPrep = createLotPrepSystem({
  addonName: ADDON_NAME,
  runtimeState,
  transformFromBackAnchor,
  sendSystemMessage,
  sendDebugLogError,
  getJobs,
  getLotById,
  getDimensionFromId,
  ensureTownAutomationDefaults,
  isLotMarkerType,
  ensureActiveJobTickingArea: activeJobs.ensureActiveJobTickingArea,
  removeActiveJobTickingArea: activeJobs.removeActiveJobTickingArea,
  waitForTickingAreaReady: workBlocks.waitForTickingAreaReady,
  verifyPlanComplete: activeJobs.verifyPlanComplete,
  blockAlreadyMatches: workBlocks.blockAlreadyMatches,
  safeSetBlock: workBlocks.safeSetBlock,
  keepBuilderNearLocation: starterCamp.keepBuilderNearLocation,
  queueSmallHouseBuild,
  constants
});

const queueLotPrep = (...args) => lotPrep.queueLotPrep(...args);
const autoLots = createAutoLotSystem({
  addonName: ADDON_NAME,
  runtimeState,
  distance2D,
  oppositeDirection: (direction) => ({ north: "south", south: "north", east: "west", west: "east" }[direction] ?? "south"),
  sendSystemMessage,
  sendDebugLogError,
  getLots,
  getJobs,
  getLotSizeInfoFromMarker,
  getLotBounds,
  getCenteredBounds,
  getFrontMarkerLotBounds,
  boundsOverlapOrTooClose,
  boundsOverlapInnerWallReserve,
  getDimensionFromId,
  queueLotPrep,
  ensureTownAutomationDefaults,
  isLotMarkerType,
  constants
});

const lots = createLotSystem({
  addonName: ADDON_NAME,
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
  boundsOverlapInnerWallReserve: autoLots.boundsOverlapInnerWallReserve,
  queueLotPrep,
  saveTowns,
  constants
});

const buildLots = createBuildLotSystem({
  safeLocationKey,
  isBuildLotRecorderType,
  registerLotFromBlock: lots.registerLotFromBlock,
  lotOverlapsAnyRoadReserve: autoLots.lotOverlapsAnyRoadReserve,
  constants
});

const recorderStore = createBuildRecorderStore({
  addonName: ADDON_NAME,
  runtimeState,
  safeLocationKey,
  sendDebugLogError,
  messagePlayer,
  getLotAtBlock: lots.getLotAtBlock,
  isBuildLotRecorderType,
  findTownContainingLocation,
  clearBlock,
  getPlacementFacing,
  getLotBounds,
  getLots,
  transformFromBackAnchor,
  saveTowns,
  getTowns,
  constants
});

const groundLeveler = createGroundLevelerSystem({
  addonName: ADDON_NAME,
  runtimeState,
  safeLocationKey,
  sendSystemMessage,
  sendDebugLogError,
  messagePlayer,
  getJobs,
  getLots,
  getDimensionFromId,
  getCenteredBounds,
  expandBounds,
  pointInsideBounds,
  isLotMarkerType,
  blockAlreadyMatches: workBlocks.blockAlreadyMatches,
  safeSetBlock: workBlocks.safeSetBlock,
  keepBuilderNearLocation: starterCamp.keepBuilderNearLocation,
  constants
});

function registerGroundLevelerFromBlock(block, player) {
  try {
    if (!block || block.typeId !== constants.GROUND_LEVELER_ID) return;
    const town = findTownContainingLocation(block.location, block.dimension.id);
    if (!town) {
      clearBlock(block);
      messagePlayer(player, "§cTownship Ground Leveler rejected: place it inside the township radius.");
      return;
    }
    groundLeveler.queueGroundLevelerJob(town, block.location, player);
    saveTowns(getTowns());
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Register Ground Leveler", error);
    messagePlayer(player, "§cTownship error while registering Ground Leveler. Check content log.");
  }
}

const townOperations = createTownOperationsSystem({
  addonName: ADDON_NAME,
  runtimeState,
  townTag,
  sendSystemMessage,
  sendDebugLogError,
  getLots,
  getJobs,
  getDimensionFromId,
  getTownPrepPhasePlan: townPrep.getTownPrepPhasePlan,
  ensureFoundingStoneBlock: townPrep.ensureFoundingStoneBlock,
  blockAlreadyMatches: workBlocks.blockAlreadyMatches,
  safeSetBlock: workBlocks.safeSetBlock,
  queueStarterCamp: starterCamp.queueStarterCamp,
  constants
});

let ui;
const showFoundingStoneMenu = (...args) => ui.showFoundingStoneMenu(...args);
const townRegistry = createTownRegistrySystem({
  addonName: ADDON_NAME,
  runtimeState,
  safeLocationKey,
  sendDebugLogError,
  messagePlayer,
  clearBlock,
  getTowns,
  getLots,
  getJobs,
  saveTowns,
  getTownAtBlock,
  findNearbyTown,
  getPlacementFacing,
  queueTownPrep: townPrep.queueTownPrep,
  showFoundingStoneMenu,
  constants
});

const lotPreview = createLotPreviewSystem({
  addonName: ADDON_NAME,
  world,
  runtimeState,
  sendDebugLogError,
  isLotMarkerType,
  findTownContainingLocation,
  getLots,
  getLotBounds,
  distance2D,
  getPlacementFacing,
  getLotSizeInfoFromMarker,
  getFrontMarkerLotBounds,
  constants
});

function previewBuildRecorderArea(block, player, sizeName) {
  try {
    const info = recorderStore.getRecorderLotInfo(sizeName);
    const facing = getPlacementFacing(player);
    const bounds = getFrontMarkerLotBounds(block.location, facing.backDirection, info.halfSize, info.size - 1);
    const positions = [];
    lotPreview.addBoundsParticlePositions(positions, bounds, Math.floor(block.location.y) + 1.35, 1);
    let count = 0;
    for (const position of positions) {
      if (count > constants.LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER) break;
      lotPreview.spawnPreviewParticle(block.dimension, position);
      count++;
    }
    messagePlayer(player, `§ePreviewed ${info.sizeName} capture area using particles.`);
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Preview Build Recorder Area", error);
  }
}

function clearPhysicalBuildLot(block, player) {
  try {
    const found = recorderStore.getBuildLotByBlock(block);
    if (!found) return messagePlayer(player, "§cNo Build Lot record found for this block.");
    const lot = found.lot;
    recorderStore.ensureBuildLotSettings(lot);
    const box = recorderStore.getBuildLotCaptureBox(lot);
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
            if (target.typeId !== "minecraft:dirt") { target.setType("minecraft:dirt"); restoredFloor++; }
          } else if (target.typeId !== "minecraft:air") {
            target.setType("minecraft:air");
            cleared++;
          }
        }
      }
    }
    messagePlayer(player, `§ePhysical Build Lot cleared. Removed ${cleared} block(s), restored ${restoredFloor} floor block(s). Fence and recorder were kept.`);
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Clear Physical Build Lot", error);
    messagePlayer(player, "§cPhysical Build Lot clear failed. Check content log.");
  }
}

const townshipForms = createTownshipForms({
  addonName: ADDON_NAME,
  runtimeState,
  system,
  sendDebugLogError,
  messagePlayer,
  getTowns,
  getLots,
  getJobs,
  saveTowns,
  ensureTownAutomationDefaults,
  getTownStatusText: townRegistry.getTownStatusText,
  getLotStatusText: lots.getLotStatusText,
  getLotAtBlock: lots.getLotAtBlock,
  cleanupLotAt: lots.cleanupLotAt,
  queueReadyLotsForAutoBuild: (town) => townOperations.queueReadyLotsForAutoBuild(town, buildings.queueSmallHouseBuild),
  queueRoadsForCompletedBuildings: (town) => townOperations.queueRoadsForCompletedBuildings(town, roads.queueRoadToTown),
  queueBoundaryRebuild: townOperations.queueBoundaryRebuild,
  runAutoLotPlacement: autoLots.runAutoLotPlacement,
  registerGroundLevelerFromBlock,
  constants
});

const buildLotForms = createBuildLotForms({
  addonName: ADDON_NAME,
  system,
  sendDebugLogError,
  messagePlayer,
  getTowns,
  saveTowns,
  getBuildLotByBlock: recorderStore.getBuildLotByBlock,
  ensureBuildLotSettings: recorderStore.ensureBuildLotSettings,
  defaultBuildLotName: recorderStore.defaultBuildLotName,
  captureBuildLot: recorderStore.captureBuildLot,
  exportBuildLot: recorderStore.exportBuildLot,
  clearSavedBuildLotCapture: recorderStore.clearSavedBuildLotCapture,
  clearPhysicalBuildLot
});

const buildRecorderForms = createBuildRecorderForms({
  addonName: ADDON_NAME,
  sendDebugLogError,
  messagePlayer,
  isBuildRecorderType: (typeId) => typeId === constants.BUILD_RECORDER_ID,
  captureBuildRecorderLot: recorderStore.captureBuildRecorderLot,
  previewBuildRecorderArea,
  exportLastBuildRecorderCapture: recorderStore.exportLastBuildRecorderCapture,
  clearBuildRecorderCaptures: recorderStore.clearBuildRecorderCaptures
});

ui = { ...townshipForms, ...buildLotForms, ...buildRecorderForms };

const uiDispatch = createTownshipUiDispatch({
  addonName: ADDON_NAME,
  sendDebugLogError,
  registerBlockInteractionComponents,
  isLotMarkerType,
  isBuildLotRecorderType,
  showTownStatusFromBlock: townRegistry.showTownStatusFromBlock,
  showBuildLotMenu: ui.showBuildLotMenu,
  showLotMarkerMenu: ui.showLotMarkerMenu,
  showGroundLevelerMenu: ui.showGroundLevelerMenu,
  showBuildRecorderMenu: ui.showBuildRecorderMenu,
  constants
});

const scheduler = createTownScheduler({
  addonName: ADDON_NAME,
  runtimeState,
  sendDebugLogError,
  getTowns,
  getJobs,
  saveTowns,
  ensureTownAutomationDefaults,
  getDimensionFromId,
  ensureFoundingStoneBlock: townPrep.ensureFoundingStoneBlock,
  spawnBuilderForTown: townOperations.spawnBuilderForTown,
  spawnTwoVillageResidents: townOperations.spawnTwoVillageResidents,
  queueStarterCamp: starterCamp.queueStarterCamp,
  processStarterCamp: starterCamp.processStarterCamp,
  processTownPrepJob: townPrep.processTownPrepJob,
  processBoundaryRebuildJob: townOperations.processBoundaryRebuildJob,
  processGroundLevelerJob: groundLeveler.processGroundLevelerJob,
  processLotPrepJob: lotPrep.processLotPrepJob,
  processSmallHouseJob: buildings.processSmallHouseJob,
  processRoadJob: roads.processRoadJob,
  runAutoLotPlacement: autoLots.runAutoLotPlacement,
  constants
});

try {
  system.beforeEvents.startup.subscribe((event) => uiDispatch.registerTownshipBlockComponents(event));
} catch (error) {
  sendDebugLogError(ADDON_NAME, "Subscribe startup block components", error);
}

registerTownshipEvents({
  addonName: ADDON_NAME,
  version: VERSION,
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
  registerTownFromBlock: townRegistry.registerTownFromBlock,
  registerBuildLotFromBlock: buildLots.registerBuildLotFromBlock,
  registerLotMarkerFromBlock: lots.registerLotMarkerFromBlock,
  registerGroundLevelerFromBlock,
  registerBuildRecorderFromBlock: recorderStore.registerBuildRecorderFromBlock,
  cleanupTownAt: (location, dimensionId, player) => {
    const towns = getTowns();
    const remaining = towns.filter(town => !(town.dimensionId === dimensionId && town.center.x === location.x && town.center.y === location.y && town.center.z === location.z));
    if (remaining.length !== towns.length) {
      saveTowns(remaining);
      messagePlayer(player, "§eTownship record removed for this Founding Stone.");
    }
  },
  cleanupLotAt: lots.cleanupLotAt,
  processTowns: scheduler.processTowns,
  processLotBorderPreview: lotPreview.processLotBorderPreview,
  constants
});
