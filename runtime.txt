import { world, system, BlockPermutation } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { sendDebugLogError } from "../shared/debug_log_bridge.js";

import { ADDON_NAME, VERSION } from "../core/version.js";
import { requestTownshipTickingArea, removeTownshipTickingArea } from "../systems/ticking_areas.js";
import { registerTownshipBlockComponents as registerBlockInteractionComponents } from "../systems/block_interactions.js";
import { createBuildingPlans } from "../systems/building_plans.js";
import {
  runtimeState,
  townTag,
  safeLocationKey,
  distance2D,
  oppositeDirection,
  directionVector,
  directionFromPlayerView,
  getPlacementFacing,
  isBuildLotRecorderType,
  isLotMarkerType,
  getLotSizeInfoFromMarker,
  directionStateNumber,
  addBlockEntry,
  getRightVector,
  transformFromBackAnchor,
  transformTownLocal,
  sendSystemMessage,
  messagePlayer,
  loadTowns,
  getTowns,
  saveTowns,
  findNearbyTown,
  getTownAtBlock,
  findTownContainingLocation,
  boundsOverlapOrTooClose,
  getCenteredBounds,
  getFrontMarkerLotBounds,
  getLotBounds,
  getLots,
  getJobs,
  ensureTownAutomationDefaults,
  getLotById,
  hashStringNumber,
  pointInsideBounds
} from "../core/runtime_state.js";
const FOUNDING_STONE_ID = "township:founding_stone";
const LOT_MARKER_ID = "township:lot_marker";
const MEDIUM_LOT_MARKER_ID = "township:medium_lot_marker";
const LARGE_LOT_MARKER_ID = "township:large_lot_marker";
const DIRT_ROAD_ID = "township:dirt_road";
const GROUND_LEVELER_ID = "township:ground_leveler";
const BUILD_RECORDER_ID = "township:build_recorder";
const SMALL_BUILD_LOT_ID = "township:small_build_lot";
const MEDIUM_BUILD_LOT_ID = "township:medium_build_lot";
const LARGE_BUILD_LOT_ID = "township:large_build_lot";
const BUILD_LOT_MARKER_IDS = [SMALL_BUILD_LOT_ID, MEDIUM_BUILD_LOT_ID, LARGE_BUILD_LOT_ID];
const NATURAL_CAPTURE_SKIP_BLOCKS = new Set([
  "minecraft:stone",
  "minecraft:dirt",
  "minecraft:grass_block",
  "minecraft:deepslate",
  "minecraft:tuff",
  "minecraft:gravel",
  "minecraft:sand",
  "minecraft:sandstone",
  "minecraft:andesite",
  "minecraft:diorite",
  "minecraft:granite",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava"
]);
const LOT_MARKER_IDS = [LOT_MARKER_ID, MEDIUM_LOT_MARKER_ID, LARGE_LOT_MARKER_ID, SMALL_BUILD_LOT_ID, MEDIUM_BUILD_LOT_ID, LARGE_BUILD_LOT_ID];
const TOWNS_PROPERTY = "township:towns_v1";
const BUILD_RECORDER_PROPERTY = "township:captured_build_v1";
const CLAIM_RADIUS = 96;
const MIN_TOWN_DISTANCE = CLAIM_RADIUS * 2;
const STARTING_BUILD_RADIUS = CLAIM_RADIUS;
const BUILDER_DELAY_TICKS = 20 * 5;
const BUILDER_TAG = "township_builder";
const CAMP_BUILD_INTERVAL_TICKS = 5;
const CAMP_BLOCKS_PER_STEP = 4;
const CAMP_JOB_STATUS_PENDING = "starter_camp_pending";
const CAMP_JOB_STATUS_BUILDING = "starter_camp_building";
const CAMP_JOB_STATUS_COMPLETE = "starter_camp_complete";
const LOT_SMALL_SIZE = 11;
const LOT_SMALL_HALF = 5;
const LOT_MEDIUM_SIZE = 15;
const LOT_MEDIUM_HALF = 7;
const LOT_LARGE_SIZE = 21;
const LOT_LARGE_HALF = 10;
const LOT_BUFFER = 1;
const LOT_PREP_INTERVAL_TICKS = 5;
const LOT_PREP_BLOCKS_PER_STEP = 32;
const LOT_STATUS_REGISTERED = "registered";
const LOT_STATUS_QUEUED = "prep_queued";
const LOT_STATUS_PREPARING = "preparing";
const LOT_STATUS_READY = "ready";
const LOT_STATUS_BUILDING = "building";
const LOT_STATUS_OCCUPIED = "occupied";
const HOUSE_BUILD_INTERVAL_TICKS = 5;
const HOUSE_BLOCKS_PER_STEP = 64;
const ROAD_BUILD_INTERVAL_TICKS = 4;
const ROAD_BLOCKS_PER_STEP = 24;
const ROAD_STATUS_NOT_CONNECTED = "not_connected";
const ROAD_STATUS_QUEUED = "road_queued";
const ROAD_STATUS_BUILDING = "road_building";
const ROAD_STATUS_CONNECTED = "connected";
const GROUND_LEVELER_SIZE = 41;
const GROUND_LEVELER_HALF = 20;
const GROUND_LEVELER_CLEAR_HEIGHT = 16;
const GROUND_LEVELER_INTERVAL_TICKS = 3;
const GROUND_LEVELER_BLOCKS_PER_STEP = 64;
const LOT_PREVIEW_RADIUS = 56;
const LOT_PREVIEW_INTERVAL_TICKS = 20;
const LOT_PREVIEW_PARTICLE = "minecraft:basic_smoke_particle";
const LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER = 160;
const LOT_PATH_OFFSET = -3;
const AUTO_PLACE_INTERVAL_TICKS = 20 * 8;
const AUTO_PLACE_MAX_SMALL = 12;
const AUTO_PLACE_MAX_MEDIUM = 8;
const AUTO_PLACE_MAX_LARGE = 5;
const AUTO_PLACE_QUEUE_LIMIT = 1;
const AUTO_PLACE_SEARCH_STEP = 8;
const AUTO_PLACE_RINGS = [24, 40, 56, 72, 88];
const TOWN_PREP_RADIUS = 96;
const TOWN_BOUNDARY_RADIUS = 96;
const INNER_WALL_RESERVE_HALF_WIDTH = 5;
const INNER_GATE_HALF_WIDTH = 2;
const TOWN_PREP_CLEAR_HEIGHT = 16;
const TOWN_PREP_INTERVAL_TICKS = 2;
const TOWN_PREP_BLOCKS_PER_STEP = 800;
const TOWN_PREP_PHASES = ["clear_town_area", "level_town_area", "mark_town_boundary"];
const AUTO_PLACE_MAX_PER_RUN = 1;
const AUTO_PLACE_MAX_CANDIDATES_PER_SEARCH = 80;
const AUTO_PLACE_ROAD_SCAN_DISTANCE = 18;
const ROAD_RESERVE_HALF_WIDTH = 5;
const ROAD_RESERVE_SCAN_BUFFER = 2;
const TOWN_PREP_LOAD_BUFFER = 24;
const TOWN_PREP_LOAD_WAIT_TICKS = 80;
const TICKING_AREA_CIRCLE_RADIUS = 4;
const ACTIVE_JOB_BUFFER = 24;
const TOWN_PREP_QUADRANTS = [
  { key: "se_1", label: "south-east section A", sx: 0.5, ex: 1, sz: 0.5, ez: 1 },
  { key: "se_2", label: "south-east section B", sx: 0, ex: 0.5, sz: 0, ez: 0.5 },
  { key: "east_south", label: "east-south section", sx: 0.5, ex: 1, sz: 0, ez: 0.5 },
  { key: "south_east", label: "south-east side section", sx: 0, ex: 0.5, sz: 0.5, ez: 1 },
  { key: "ne_1", label: "north-east section A", sx: 0.5, ex: 1, sz: -1, ez: -0.5 },
  { key: "ne_2", label: "north-east section B", sx: 0, ex: 0.5, sz: -0.5, ez: 0 },
  { key: "east_north", label: "east-north section", sx: 0.5, ex: 1, sz: -0.5, ez: 0 },
  { key: "north_east", label: "north-east side section", sx: 0, ex: 0.5, sz: -1, ez: -0.5 },
  { key: "nw_1", label: "north-west section A", sx: -1, ex: -0.5, sz: -1, ez: -0.5 },
  { key: "nw_2", label: "north-west section B", sx: -0.5, ex: 0, sz: -0.5, ez: 0 },
  { key: "west_north", label: "west-north section", sx: -1, ex: -0.5, sz: -0.5, ez: 0 },
  { key: "north_west", label: "north-west side section", sx: -0.5, ex: 0, sz: -1, ez: -0.5 },
  { key: "sw_1", label: "south-west section A", sx: -1, ex: -0.5, sz: 0.5, ez: 1 },
  { key: "sw_2", label: "south-west section B", sx: -0.5, ex: 0, sz: 0, ez: 0.5 },
  { key: "west_south", label: "west-south section", sx: -1, ex: -0.5, sz: 0, ez: 0.5 },
  { key: "south_west", label: "south-west side section", sx: -0.5, ex: 0, sz: 0.5, ez: 1 }
];







const buildingPlans = createBuildingPlans({
  transformFromBackAnchor,
  directionStateNumber,
  addBlockEntry,
  lotPathOffset: LOT_PATH_OFFSET,
  lotSmallHalf: LOT_SMALL_HALF,
  lotSmallSize: LOT_SMALL_SIZE
});
function queueLotPrep(town, lot) {
  if (!town || !lot) return;
  const jobs = getJobs(town);
  const existing = jobs.find(job => job && job.type === "prepare_lot" && job.lotId === lot.id && job.status !== "complete");
  if (existing) return;
  lot.status = LOT_STATUS_QUEUED;
  lot.prepPhase = "queued";
  jobs.push({
    type: "prepare_lot",
    lotId: lot.id,
    status: "queued",
    nextIndex: 0,
    nextTick: runtimeState.tickCounter + LOT_PREP_INTERVAL_TICKS,
    lastPhase: undefined
  });
}

function queueSmallHouseBuild(town, lot, priority = false) {
  if (!town || !lot) return;
  if ((lot.buildingType ?? "empty") !== "empty") return;
  const jobs = getJobs(town);
  const existing = jobs.find(job => job && job.type === "build_small_house" && job.lotId === lot.id && job.status !== "complete");
  if (existing) return;
  const variant = buildingPlans.chooseAutoBuildingVariant(lot);
  lot.status = LOT_STATUS_BUILDING;
  lot.buildingType = `${variant}_pending`;
  lot.buildVariant = variant;
  lot.buildPhase = "queued";
  const newJob = {
    type: "build_small_house",
    lotId: lot.id,
    buildingVariant: variant,
    status: "queued",
    nextIndex: 0,
    nextTick: runtimeState.tickCounter + HOUSE_BUILD_INTERVAL_TICKS,
    lastPhase: undefined
  };
  if (priority) jobs.unshift(newJob);
  else jobs.push(newJob);
}


function queueTownPrep(town) {
  if (!town) return;
  const jobs = getJobs(town);
  if (jobs.find(job => job && job.type === "town_prep" && job.status !== "complete")) return;
  jobs.unshift({
    type: "town_prep",
    status: "queued",
    quadrantIndex: 0,
    phase: "clear_town_area",
    nextIndex: 0,
    nextTick: runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS,
    lastPhase: undefined,
    tickingAreaName: undefined,
    loadedQuadrantIndex: undefined,
    loadedPrepKey: undefined,
    tickingAreaReadyTick: undefined
  });
  town.townPrepStatus = "queued";
  town.townPrepPhase = "queued";
}

function townPrepTickingAreaName(town) {
  return `township_setup_${safeLocationKey(town.center ?? { x: 0, y: 0, z: 0 })}`.slice(0, 60);
}

function sampleLoadedForWrite(dimension, location) {
  try {
    const block = dimension.getBlock(location);
    if (!block) return { ok: false, stage: "read", typeId: "none" };

    const typeId = block.typeId;
    if (!typeId) return { ok: false, stage: "read_type", typeId: "unknown" };
    if (typeId.startsWith("township:")) return { ok: true, stage: "protected", typeId };

    const originalPermutation = block.permutation;
    if (typeId === "minecraft:air") {
      block.setType("minecraft:dirt");
      block.setType("minecraft:air");
      return { ok: true, stage: "write_restore_air", typeId };
    }

    block.setType("minecraft:dirt");
    if (originalPermutation) block.setPermutation(originalPermutation);
    else block.setType(typeId);
    return { ok: true, stage: "write_restore", typeId };
  } catch (error) {
    return { ok: false, stage: "exception", typeId: "unknown", error: String(error?.message ?? error) };
  }
}

function confirmBoundsLoaded(dimension, bounds) {
  try {
    if (!dimension || !bounds) return false;
    const y = Math.floor((bounds.testY ?? bounds.y ?? bounds.cy ?? 64) - 1);
    const minX = Math.floor(bounds.minX);
    const maxX = Math.floor(bounds.maxX);
    const minZ = Math.floor(bounds.minZ);
    const maxZ = Math.floor(bounds.maxZ);
    const midX = Math.floor((minX + maxX) / 2);
    const midZ = Math.floor((minZ + maxZ) / 2);
    const sample = { x: midX, y, z: midZ };
    const result = sampleLoadedForWrite(dimension, sample);
    if (!result.ok && bounds) {
      bounds.lastProbe = `${result.stage} at ${sample.x} ${sample.y} ${sample.z} type ${result.typeId}${result.error ? ` error ${result.error}` : ""}`;
    } else if (bounds) {
      bounds.lastProbe = `ok ${result.stage} at ${sample.x} ${sample.y} ${sample.z} type ${result.typeId}`;
    }
    return !!result.ok;
  } catch (error) {
    if (bounds) bounds.lastProbe = `exception ${String(error?.message ?? error)}`;
    return false;
  }
}

function waitForTickingAreaReady(target, dimension, bounds, label) {
  try {
    if (!target) return false;
    if (target.loadState === "failed") {
      if (!target.loadFailureAnnounced) {
        target.loadFailureAnnounced = true;
        sendSystemMessage(`§c${label} cannot continue: ticking area failed.`);
      }
      return false;
    }
    if (target.loadState === "requesting") return false;
    if (typeof target.tickingAreaReadyTick === "number" && runtimeState.tickCounter < target.tickingAreaReadyTick) return false;
    if (!target.loadConfirmed) {
      target.loadCheckAttempts = (target.loadCheckAttempts ?? 0) + 1;
      if (confirmBoundsLoaded(dimension, bounds)) {
        target.loadConfirmed = true;
        target.loadState = "confirmed";
        target.loadCheckAttempts = 0;
        return true;
      }
      if ((target.nextLoadCheckMessageTick ?? 0) <= runtimeState.tickCounter) {
        target.nextLoadCheckMessageTick = runtimeState.tickCounter + 100;
        const probe = bounds?.lastProbe ? ` Probe: ${bounds.lastProbe}.` : "";
        sendSystemMessage(`§e${label} is waiting for its ticking area to become writable. Check ${target.loadCheckAttempts}/10.${probe}`);
      }
      if (target.loadCheckAttempts >= 10) {
        target.loadState = "failed";
        target.loadError = `Writable probe failed after ticking area wait. Add: ${target.loadCommandStatus ?? "unknown"}. List: ${target.loadListStatus ?? "unknown"}. Probe: ${bounds?.lastProbe ?? "unknown"}.`;
        sendDebugLogError(ADDON_NAME, `${label} Writable Probe`, target.loadError);
        sendSystemMessage(`§c${label} failed: ${target.loadError}`);
        return false;
      }
      target.tickingAreaReadyTick = runtimeState.tickCounter + 20;
      return false;
    }
    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Wait For Ticking Area Ready", error);
    return false;
  }
}

function removeTownPrepTickingArea(town, job, dimension) {
  try {
    const name = job?.tickingAreaName ?? townPrepTickingAreaName(town);
    if (!name) return;
    removeTownshipTickingArea(
      name,
      (systemName, error) => sendDebugLogError(ADDON_NAME, systemName, error),
      "Remove Town Prep Ticking Area"
    );
    if (job) {
      job.loadedQuadrantIndex = undefined;
      job.loadedPrepKey = undefined;
      job.tickingAreaReadyTick = undefined;
      job.tickingAreaName = undefined;
      job.loadState = undefined;
      job.loadConfirmed = undefined;
      job.loadFailureAnnounced = undefined;
      job.nextLoadCheckMessageTick = undefined;
      job.loadCheckAttempts = undefined;
    }
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Remove Town Prep Ticking Area", error);
  }
}

function ensureFoundingStoneBlock(town, dimension) {
  try {
    if (!town || !town.center || !dimension) return false;
    const location = {
      x: Math.floor(town.center.x),
      y: Math.floor(town.center.y),
      z: Math.floor(town.center.z)
    };

    // The Founding Stone and Lot Markers are meant to sit one block above the finished ground.
    // Always repair the support block first so town prep cannot leave an air pocket under it.
    const support = dimension.getBlock({ x: location.x, y: location.y - 1, z: location.z });
    if (support && support.typeId === "minecraft:air") support.setType("minecraft:dirt");

    const block = dimension.getBlock(location);
    if (!block) return false;
    if (block.typeId !== FOUNDING_STONE_ID) {
      block.setType(FOUNDING_STONE_ID);
      sendSystemMessage("§eTownship Founding Stone restored after setup protection check.");
    }
    town.center = location;
    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Ensure Founding Stone Block", error);
    return false;
  }
}

function getTownPrepQuadrantBounds(town, quadrantIndex, radius = TOWN_PREP_RADIUS) {
  const center = town?.center ?? { x: 0, y: 0, z: 0 };
  const cx = Math.floor(center.x);
  const cy = Math.floor(center.y);
  const cz = Math.floor(center.z);
  const q = TOWN_PREP_QUADRANTS[quadrantIndex] ?? TOWN_PREP_QUADRANTS[0];
  return {
    key: q.key,
    label: q.label,
    cx, cy, cz,
    minX: cx + q.sx * radius,
    maxX: cx + q.ex * radius,
    minZ: cz + q.sz * radius,
    maxZ: cz + q.ez * radius
  };
}

function ensureTownPrepTickingArea(town, job, dimension) {
  try {
    if (!job || typeof job.quadrantIndex !== "number") return;
    const phase = job.phase ?? "clear_town_area";
    const radius = phase === "mark_town_boundary" ? TOWN_BOUNDARY_RADIUS : TOWN_PREP_RADIUS;
    const loadKey = `${job.quadrantIndex}_${phase}_${radius}`;
    if (job.loadedPrepKey === loadKey && job.tickingAreaName) return;

    removeTownPrepTickingArea(town, job, dimension);

    const bounds = getTownPrepQuadrantBounds(town, job.quadrantIndex, radius);
    const name = "township_temp";
    job.tickingAreaName = name;
    job.loadedQuadrantIndex = job.quadrantIndex;
    job.loadedPrepKey = loadKey;
    job.loadState = undefined;
    job.loadConfirmed = false;
    job.loadFailureAnnounced = false;
    job.nextLoadCheckMessageTick = undefined;
    job.loadCheckAttempts = 0;

    // v1.0.48: command ticking area diagnostic path.
    // Use a simple circle area centered on the section instead of a large rectangle.
    const loadMinX = Math.floor(bounds.minX) - TOWN_PREP_LOAD_BUFFER;
    const loadMaxX = Math.floor(bounds.maxX) + TOWN_PREP_LOAD_BUFFER;
    const loadMinZ = Math.floor(bounds.minZ) - TOWN_PREP_LOAD_BUFFER;
    const loadMaxZ = Math.floor(bounds.maxZ) + TOWN_PREP_LOAD_BUFFER;
    const centerX = Math.floor((Math.floor(bounds.minX) + Math.floor(bounds.maxX)) / 2);
    const centerZ = Math.floor((Math.floor(bounds.minZ) + Math.floor(bounds.maxZ)) / 2);
    job.loadBounds = { minX: loadMinX, maxX: loadMaxX, minZ: loadMinZ, maxZ: loadMaxZ, y: bounds.cy, testY: bounds.cy };
    requestTownshipTickingArea({
      dimension,
      bounds: job.loadBounds,
      identifier: name,
      target: job,
      label: "Add Town Prep Ticking Area",
      tick: runtimeState.tickCounter,
      readyDelayTicks: TOWN_PREP_LOAD_WAIT_TICKS,
      reportError: (systemName, error) => sendDebugLogError(ADDON_NAME, systemName, error),
      reportMessage: sendSystemMessage
    });
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Ensure Town Prep Ticking Area", error);
  }
}


function activeJobTickingAreaName(town, job) {
  const key = `${town?.id ?? "town"}_${job?.type ?? "job"}_${job?.lotId ?? "main"}`.replace(/[^A-Za-z0-9_]/g, "_");
  return `township_job_${key}`.slice(0, 60);
}

function getJobWorkBounds(town, job) {
  try {
    if (!town || !job) return undefined;
    if (job.type === "prepare_lot" || job.type === "build_small_house") {
      const lot = getLotById(town, job.lotId);
      const b = getLotBounds(lot);
      if (!b) return undefined;
      return { minX: b.minX - ACTIVE_JOB_BUFFER, maxX: b.maxX + ACTIVE_JOB_BUFFER, minZ: b.minZ - ACTIVE_JOB_BUFFER, maxZ: b.maxZ + ACTIVE_JOB_BUFFER, y: Math.floor(lot.marker.y) };
    }
    if (job.type === "build_road") {
      if (Array.isArray(job.plan) && job.plan.length > 0) {
        const xs = job.plan.map(p => p.x);
        const zs = job.plan.map(p => p.z);
        return { minX: Math.min(...xs) - ACTIVE_JOB_BUFFER, maxX: Math.max(...xs) + ACTIVE_JOB_BUFFER, minZ: Math.min(...zs) - ACTIVE_JOB_BUFFER, maxZ: Math.max(...zs) + ACTIVE_JOB_BUFFER, y: Math.floor(town.center?.y ?? 64) };
      }
      const lot = getLotById(town, job.lotId);
      const b = getLotBounds(lot);
      if (!b) return undefined;
      return { minX: b.minX - ACTIVE_JOB_BUFFER, maxX: b.maxX + ACTIVE_JOB_BUFFER, minZ: b.minZ - ACTIVE_JOB_BUFFER, maxZ: b.maxZ + ACTIVE_JOB_BUFFER, y: Math.floor(lot.marker.y) };
    }
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Get Job Work Bounds", error);
  }
  return undefined;
}

function ensureActiveJobTickingArea(town, job, dimension) {
  try {
    if (!town || !job || !dimension) return;
    const bounds = getJobWorkBounds(town, job);
    if (!bounds) return;
    const name = activeJobTickingAreaName(town, job);
    const key = `${bounds.minX}_${bounds.minZ}_${bounds.maxX}_${bounds.maxZ}`;
    if (job.activeTickingAreaName === name && job.activeTickingAreaKey === key) return;
    if (job.activeTickingAreaName) {
      removeTownshipTickingArea(
        job.activeTickingAreaName,
        (systemName, error) => sendDebugLogError(ADDON_NAME, systemName, error),
        "Remove Active Job Ticking Area"
      );
    }
    job.activeTickingAreaName = name;
    job.activeTickingAreaKey = key;
    job.loadState = undefined;
    job.loadConfirmed = false;
    job.loadFailureAnnounced = false;
    const centerX = Math.floor((Math.floor(bounds.minX) + Math.floor(bounds.maxX)) / 2);
    const centerZ = Math.floor((Math.floor(bounds.minZ) + Math.floor(bounds.maxZ)) / 2);
    job.loadBounds = { ...bounds, testY: bounds.y };
    requestTownshipTickingArea({
      dimension,
      bounds: job.loadBounds,
      identifier: name,
      target: job,
      label: "Add Active Job Ticking Area",
      tick: runtimeState.tickCounter,
      readyDelayTicks: TOWN_PREP_LOAD_WAIT_TICKS,
      reportError: (systemName, error) => sendDebugLogError(ADDON_NAME, systemName, error),
      reportMessage: sendSystemMessage
    });
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Ensure Active Job Ticking Area", error);
  }
}

function removeActiveJobTickingArea(town, job, dimension) {
  try {
    const name = job?.activeTickingAreaName;
    if (!name || !dimension) return;
    removeTownshipTickingArea(
      name,
      (systemName, error) => sendDebugLogError(ADDON_NAME, systemName, error),
      "Remove Active Job Ticking Area"
    );
    job.activeTickingAreaName = undefined;
    job.activeTickingAreaKey = undefined;
    job.loadState = undefined;
    job.loadConfirmed = undefined;
    job.loadBounds = undefined;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Remove Active Job Ticking Area", error);
  }
}

function verifyPlanComplete(dimension, plan, job, label) {
  try {
    if (!Array.isArray(plan)) return true;

    // v1.0.44: verification is now a safety check, not an endless rebuild trigger.
    // Bedrock can reject or delay some block reads briefly, and decorative/stateful blocks
    // are not reliable enough to verify every single template entry. Check a small set of
    // stable anchors and cap retries so roads/paths do not fight a rebuilding structure forever.
    const anchors = [];
    const preferred = ["minecraft:oak_log", "minecraft:oak_planks", "minecraft:spruce_planks", "minecraft:torch", "minecraft:bell", DIRT_ROAD_ID];
    for (const wanted of preferred) {
      const found = plan.find(entry => entry && entry.typeId === wanted);
      if (found) anchors.push(found);
    }
    if (anchors.length === 0) {
      for (const entry of plan) {
        if (entry && entry.typeId && entry.typeId !== "minecraft:air" && entry.typeId !== "minecraft:dirt") anchors.push(entry);
        if (anchors.length >= 6) break;
      }
    }

    for (const entry of anchors.slice(0, 8)) {
      if (!entry || entry.typeId === "minecraft:air") continue;
      if (!blockAlreadyMatches(dimension, entry)) {
        job.verifyRetries = (job.verifyRetries ?? 0) + 1;
        if (job.verifyRetries > 2) {
          sendSystemMessage(`§e${label} verification still found missing anchor blocks after 2 retries. Marking job complete to prevent a rebuild loop.`);
          return true;
        }
        if (job) {
          job.nextIndex = 0;
          job.status = "queued";
          job.lastPhase = undefined;
          job.nextTick = runtimeState.tickCounter + 20;
        }
        sendSystemMessage(`§e${label} verification found missing anchor blocks. Retrying this job (${job.verifyRetries}/2).`);
        return false;
      }
    }
    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Verify Plan Complete", error);
    return true;
  }
}

function getTownPrepPhasePlan(town, quadrantIndex, phase) {
  const plan = [];
  if (!town || !town.center) return plan;

  const center = town.center;
  const cx = Math.floor(center.x);
  const cy = Math.floor(center.y);
  const cz = Math.floor(center.z);
  const prep = getTownPrepQuadrantBounds(town, quadrantIndex, TOWN_PREP_RADIUS);
  const fence = getTownPrepQuadrantBounds(town, quadrantIndex, TOWN_BOUNDARY_RADIUS);
  const q = TOWN_PREP_QUADRANTS[quadrantIndex] ?? TOWN_PREP_QUADRANTS[0];

  const isProtectedTownCenter = (x, y, z) => (x === cx && y === cy && z === cz);
  const isGateOpening = (x, z) => {
    const relX = x - cx;
    const relZ = z - cz;
    const r = TOWN_BOUNDARY_RADIUS;
    if ((Math.abs(relX) <= INNER_GATE_HALF_WIDTH) && (Math.abs(relZ) === r)) return true;
    if ((Math.abs(relZ) <= INNER_GATE_HALF_WIDTH) && (Math.abs(relX) === r)) return true;
    return false;
  };

  if (phase === "clear_town_area") {
    for (let y = cy - 2; y <= cy + TOWN_PREP_CLEAR_HEIGHT; y++) {
      for (let x = Math.floor(prep.minX); x <= Math.floor(prep.maxX); x++) {
        for (let z = Math.floor(prep.minZ); z <= Math.floor(prep.maxZ); z++) {
          if (isProtectedTownCenter(x, y, z)) continue;
          plan.push({ phase, x, y, z, typeId: "minecraft:air", clearLotMarker: true });
        }
      }
    }
  }

  if (phase === "level_town_area") {
    for (let x = Math.floor(prep.minX); x <= Math.floor(prep.maxX); x++) {
      for (let z = Math.floor(prep.minZ); z <= Math.floor(prep.maxZ); z++) {
        plan.push({ phase, x, y: cy - 3, z, typeId: "minecraft:dirt", setupFill: true });
        plan.push({ phase, x, y: cy - 2, z, typeId: "minecraft:dirt", setupFill: true });
        plan.push({ phase, x, y: cy - 1, z, typeId: "minecraft:dirt", setupFill: true });
      }
    }
  }

  if (phase === "mark_town_boundary") {
    // v1.0.51: single-radius township. This is the town fence around the whole active township.
    // Four roads run from the main lot to the gates.
    const r = TOWN_BOUNDARY_RADIUS;
    const addFence = (x, z, offset) => {
      if (isGateOpening(x, z)) return;
      plan.push({ phase, x, y: cy, z, typeId: "minecraft:oak_fence" });
      if (offset % 8 === 0) plan.push({ phase, x, y: cy + 1, z, typeId: "minecraft:torch" });
    };
    const addRoad = (x, z) => {
      plan.push({ phase, x, y: cy - 1, z, typeId: DIRT_ROAD_ID });
      plan.push({ phase, x, y: cy, z, typeId: "minecraft:air" });
    };

    // Crossroads from the main lot road loop out to the four gate openings.
    // Use the same section ownership so each section only works its own slice.
    for (let x = Math.floor(fence.minX); x <= Math.floor(fence.maxX); x++) {
      if (Math.abs(x - cx) <= r && Math.abs(x - cx) >= 11) {
        for (let oz = -1; oz <= 1; oz++) addRoad(x, cz + oz);
      }
    }
    for (let z = Math.floor(fence.minZ); z <= Math.floor(fence.maxZ); z++) {
      if (Math.abs(z - cz) <= r && Math.abs(z - cz) >= 11) {
        for (let ox = -1; ox <= 1; ox++) addRoad(cx + ox, z);
      }
    }

    // Only mark outside edges owned by this section. Do not create cross-fences.
    if (q.ex === 1) {
      let n = 0;
      for (let z = Math.floor(fence.minZ); z <= Math.floor(fence.maxZ); z++) addFence(cx + r, z, n++);
    }
    if (q.sx === -1) {
      let n = 0;
      for (let z = Math.floor(fence.minZ); z <= Math.floor(fence.maxZ); z++) addFence(cx - r, z, n++);
    }
    if (q.ez === 1) {
      let n = 0;
      for (let x = Math.floor(fence.minX); x <= Math.floor(fence.maxX); x++) addFence(x, cz + r, n++);
    }
    if (q.sz === -1) {
      let n = 0;
      for (let x = Math.floor(fence.minX); x <= Math.floor(fence.maxX); x++) addFence(x, cz - r, n++);
    }
  }

  return plan;
}

function getTownPrepPhaseLabel(phase) {
  if (phase === "clear_town_area") return "clearing the township area";
  if (phase === "level_town_area") return "leveling the township area";
  if (phase === "mark_town_boundary") return "marking the town fence and gate roads";
  return phase ?? "preparing the township area";
}

function advanceTownPrepPhaseOrQuadrant(town, job, dimension) {
  const currentPhase = job.phase ?? "clear_town_area";
  const phaseIndex = Math.max(0, TOWN_PREP_PHASES.indexOf(currentPhase));

  if (phaseIndex < TOWN_PREP_PHASES.length - 1) {
    job.phase = TOWN_PREP_PHASES[phaseIndex + 1];
    job.nextIndex = 0;
    job.lastPhase = undefined;
    job.failedPlacementStreak = 0;
    job.lastSkippedSetupBlockKey = undefined;
    job.skippedSetupMessages = 0;
    return;
  }

  if ((job.skippedSetupMessages ?? 0) > 0) {
    sendSystemMessage(`§eTownship setup section ${job.quadrantIndex + 1}/${TOWN_PREP_QUADRANTS.length} complete with ${job.skippedSetupMessages} skipped block attempts.`);
  }

  removeTownPrepTickingArea(town, job, dimension);
  job.quadrantIndex = (typeof job.quadrantIndex === "number" ? job.quadrantIndex : 0) + 1;
  job.phase = "clear_town_area";
  job.nextIndex = 0;
  job.lastPhase = undefined;
  job.failedPlacementStreak = 0;
  job.lastSkippedSetupBlockKey = undefined;
  job.skippedSetupMessages = 0;

  if (job.quadrantIndex >= TOWN_PREP_QUADRANTS.length) {
    job.status = "complete";
    town.townPrepStatus = "complete";
    town.townPrepPhase = "complete";
    ensureFoundingStoneBlock(town, dimension);
    const skipped = job.skippedSetupBlocks ?? 0;
    sendSystemMessage(`§aTownship area prepared, fence marked, and gate roads placed.${skipped ? ` Skipped setup blocks: ${skipped}.` : ""}`);
  }
}

function processTownPrepJob(town, job) {
  try {
    if (!town || !job || job.type !== "town_prep" || job.status === "complete") return false;
    if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;

    const dimension = getDimensionFromId(town.dimensionId);
    if (typeof job.quadrantIndex !== "number") job.quadrantIndex = 0;
    if (!job.phase) job.phase = "clear_town_area";

    if (job.quadrantIndex >= TOWN_PREP_QUADRANTS.length) {
      removeTownPrepTickingArea(town, job, dimension);
      job.status = "complete";
      town.townPrepStatus = "complete";
      town.townPrepPhase = "complete";
      ensureFoundingStoneBlock(town, dimension);
      const skipped = job.skippedSetupBlocks ?? 0;
      sendSystemMessage(`§aTownship area prepared, fence marked, and gate roads placed.${skipped ? ` Skipped setup blocks: ${skipped}.` : ""}`);
      return true;
    }

    ensureTownPrepTickingArea(town, job, dimension);

    if (!waitForTickingAreaReady(job, dimension, job.loadBounds, "Township setup section")) {
      job.nextTick = runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS;
      return true;
    }

    const quadrant = TOWN_PREP_QUADRANTS[job.quadrantIndex] ?? TOWN_PREP_QUADRANTS[0];
    const phase = job.phase ?? "clear_town_area";
    const plan = getTownPrepPhasePlan(town, job.quadrantIndex, phase);
    let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;

    while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;

    if (index >= plan.length) {
      advanceTownPrepPhaseOrQuadrant(town, job, dimension);
      job.nextTick = runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS;
      return true;
    }

    let worked = 0;
    town.townPrepStatus = "working";
    while (index < plan.length && worked < TOWN_PREP_BLOCKS_PER_STEP) {
      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
      if (index >= plan.length) break;

      const entry = plan[index];
      const entryPhase = entry.phase ?? phase;
      const phaseLabel = `${entryPhase}_${quadrant.key}`;
      if (job.lastPhase !== phaseLabel) {
        job.lastPhase = phaseLabel;
        town.townPrepPhase = `${entryPhase}_${quadrant.key}`;
        sendSystemMessage(`§eTownship is ${getTownPrepPhaseLabel(entryPhase)} (${quadrant.label} section ${job.quadrantIndex + 1}/${TOWN_PREP_QUADRANTS.length}).`);
      }

      if (safeSetBlock(dimension, entry)) {
        job.failedPlacementStreak = 0;
        index++;
        worked++;
      } else {
        // A failed placement must still advance the section cursor. Otherwise one invalid or
        // unloaded coordinate can trap the whole initial town setup on the same block forever.
        job.failedPlacementStreak = (job.failedPlacementStreak ?? 0) + 1;
        job.skippedSetupBlocks = (job.skippedSetupBlocks ?? 0) + 1;
        const skipKey = `${job.quadrantIndex}_${entryPhase}_${entry.x}_${entry.y}_${entry.z}_${entry.typeId}`;
        if (job.lastSkippedSetupBlockKey !== skipKey) {
          job.lastSkippedSetupBlockKey = skipKey;
          job.skippedSetupMessages = (job.skippedSetupMessages ?? 0) + 1;
          if ((job.skippedSetupMessages ?? 0) === 1) {
            sendSystemMessage(`§eTownship setup section ${job.quadrantIndex + 1}/${TOWN_PREP_QUADRANTS.length} has skipped setup blocks; continuing.`);
          }
        }
        index++;
        worked++;
      }
    }

    job.nextIndex = index;
    job.nextTick = runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS;

    if (index >= plan.length) {
      advanceTownPrepPhaseOrQuadrant(town, job, dimension);
    }

    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Process Town Prep Job", error);
    job.status = "error";
    town.townPrepStatus = "error";
    return true;
  }
}

function queueGroundLevelerJob(town, blockLocation, player) {
  if (!town || !blockLocation) return;
  const jobs = getJobs(town);
  const id = `${town.id}_leveler_${safeLocationKey(blockLocation)}_${runtimeState.tickCounter}`;
  const existing = jobs.find(job => job && job.type === "ground_leveler" && job.location && job.location.x === blockLocation.x && job.location.y === blockLocation.y && job.location.z === blockLocation.z && job.status !== "complete");
  if (existing) return;
  jobs.push({
    id,
    type: "ground_leveler",
    status: "queued",
    location: { x: blockLocation.x, y: blockLocation.y, z: blockLocation.z },
    nextIndex: 0,
    nextTick: runtimeState.tickCounter + GROUND_LEVELER_INTERVAL_TICKS,
    lastPhase: undefined
  });
  messagePlayer(player, `§eTownship Ground Leveler queued a ${GROUND_LEVELER_SIZE}x${GROUND_LEVELER_SIZE} flatten job with ${GROUND_LEVELER_CLEAR_HEIGHT} blocks of overhead clearing.`);
}

function registerGroundLevelerFromBlock(block, player) {
  try {
    if (!block || block.typeId !== GROUND_LEVELER_ID) return;
    const location = block.location;
    const dimensionId = block.dimension.id;
    const town = findTownContainingLocation(location, dimensionId);
    if (!town) {
      clearBlock(block);
      messagePlayer(player, "§cTownship Ground Leveler rejected: place it inside the township radius.");
      return;
    }
    queueGroundLevelerJob(town, location, player);
    saveTowns(getTowns());
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Register Ground Leveler", error);
    messagePlayer(player, "§cTownship error while registering Ground Leveler. Check content log.");
  }
}

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

function registerLotMarkerFromBlock(block, player) {
  try {
    if (!block || !isLotMarkerType(block.typeId)) return;
    const location = block.location;
    const dimensionId = block.dimension.id;

    if (getLotAtBlock(location, dimensionId)) return;

    const town = findTownContainingLocation(location, dimensionId);
    if (!town) {
      clearBlock(block);
      messagePlayer(player, "§cTownship Lot Marker rejected: place it inside the township radius.");
      return;
    }

    const placementFacing = getPlacementFacing(player);
    const lotSizeInfo = getLotSizeInfoFromMarker(block.typeId);
    const newLotBounds = getFrontMarkerLotBounds(location, placementFacing.backDirection, lotSizeInfo.halfSize, lotSizeInfo.size - 1);

    // Do not allow normal lots to overlap the starter central lot around the Founding Stone.
    if (boundsOverlapOrTooClose(newLotBounds, getCenteredBounds(town.center, LOT_SMALL_HALF), LOT_BUFFER)) {
      clearBlock(block);
      messagePlayer(player, "§cTownship Lot Marker rejected: too close to the town center lot.");
      return;
    }

    if (boundsOverlapInnerWallReserve(town, newLotBounds)) {
      clearBlock(block);
      messagePlayer(player, "§cTownship Lot Marker rejected: reserved inner-wall upgrade corridor.");
      return;
    }

    for (const lot of getLots(town)) {
      const existingBounds = getLotBounds(lot);
      if (existingBounds && boundsOverlapOrTooClose(newLotBounds, existingBounds, LOT_BUFFER)) {
        clearBlock(block);
        messagePlayer(player, "§cTownship Lot Marker rejected: too close to another township lot.");
        return;
      }
    }

    const lotId = `${town.id}_lot_${getLots(town).length + 1}`;
    const lot = {
      id: lotId,
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
      prepPhase: "not_started"
    };

    getLots(town).push(lot);
    queueLotPrep(town, lot);
    saveTowns(getTowns());
    messagePlayer(player, `§aTownship ${lot.sizeName} registered. Lot ID: ${lot.id}`);
    messagePlayer(player, "§eTownship Builder queued lot preparation.");
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Register Lot Marker", error);
    messagePlayer(player, "§cTownship error while registering lot. Check content log.");
  }
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
    sendDebugLogError(ADDON_NAME, "Show Lot Status", error);
    messagePlayer(player, "§cTownship error while reading lot status. Check content log.");
  }
}

function showLotMarkerMenu(block, player) {
  try {
    if (!block || !isLotMarkerType(block.typeId)) return;
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
    form.show(player).then((response) => {
      try {
        if (response.canceled) return;
        if (response.selection === 0) messagePlayer(player, getLotStatusText(found.town, found.lot));
        else if (response.selection === 1) cleanupLotAt(block.location, block.dimension.id, player);
      } catch (error) {
        sendDebugLogError(ADDON_NAME, "Lot Marker UI Selection", error);
      }
    }).catch(error => sendDebugLogError(ADDON_NAME, "Lot Marker UI", error));
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Show Lot Marker Menu", error);
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
    form.show(player).then((response) => {
      try {
        if (response.canceled) return;
        if (response.selection === 0) registerGroundLevelerFromBlock(block, player);
        else if (response.selection === 1) messagePlayer(player, body);
      } catch (error) {
        sendDebugLogError(ADDON_NAME, "Ground Leveler UI Selection", error);
      }
    }).catch(error => sendDebugLogError(ADDON_NAME, "Ground Leveler UI", error));
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Show Ground Leveler Menu", error);
    messagePlayer(player, "§cTownship Ground Leveler UI failed. Check content log.");
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
    sendDebugLogError(ADDON_NAME, "Cleanup Lot", error);
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

function registerTownFromBlock(block, player) {
  try {
    if (!block || block.typeId !== FOUNDING_STONE_ID) return;

    const location = block.location;
    const dimensionId = block.dimension.id;

    if (getTownAtBlock(location, dimensionId)) return;

    const nearby = findNearbyTown(location, dimensionId);
    if (nearby) {
      clearBlock(block);
      messagePlayer(player, `§cTownship Founding Stone failed: another township is too close (${Math.floor(nearby.distance)} blocks away). Minimum center distance is ${MIN_TOWN_DISTANCE} blocks.`);
      return;
    }

    const placementFacing = getPlacementFacing(player);
    const id = `t_${dimensionId.replace("minecraft:", "").replace(/[^a-zA-Z0-9]/g, "_")}_${safeLocationKey(location)}_${runtimeState.tickCounter}`;
    const town = {
      id,
      dimensionId,
      center: { x: location.x, y: location.y, z: location.z },
      frontDirection: placementFacing.frontDirection,
      backDirection: placementFacing.backDirection,
      tier: 1,
      claimRadius: CLAIM_RADIUS,
      buildRadius: STARTING_BUILD_RADIUS,
      createdTick: runtimeState.tickCounter,
      builderStatus: "pending",
      builderSpawnTick: runtimeState.tickCounter + BUILDER_DELAY_TICKS,
      builderEntityId: undefined,
      campStatus: CAMP_JOB_STATUS_PENDING,
      campNextIndex: 0,
      campNextTick: undefined,
      autoBuildLots: true,
      autoRoads: true,
      builderPaused: false
    };

    const towns = getTowns();
    towns.push(town);
    queueTownPrep(town);
    saveTowns(towns);

    messagePlayer(player, `§aTownship founded. Front: ${placementFacing.frontDirection}. Township radius: ${CLAIM_RADIUS}. Township area prep queued. First builder will arrive soon.`);
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Register Town", error);
    messagePlayer(player, `§cTownship error while founding town. Check content log.`);
  }
}

function getTownStatusText(town) {
  if (!town) return "§cNo township record found for this Founding Stone.";

  const center = town.center ?? { x: 0, y: 0, z: 0 };
  const campStatus = town.campStatus ?? "unknown";
  const campPhase = town.campLastPhase ? ` (${town.campLastPhase})` : "";
  const builderStatus = town.builderStatus ?? "unknown";
  const tier = town.tier ?? 1;
  const claimRadius = town.claimRadius ?? CLAIM_RADIUS;
  const buildRadius = town.buildRadius ?? STARTING_BUILD_RADIUS;

  const totalTowns = getTowns().length;
  return [
    "§6--- Township Status ---",
    `§eTier: §f${tier}`,
    `§eTown Front: §f${town.frontDirection ?? "unknown"}`,
    `§eBuilder: §f${builderStatus}${town.builderPaused ? " (paused)" : ""}`,
    `§eAuto Build Lots: §f${(town.autoBuildLots ?? true) ? "on" : "off"}`,
    `§eAuto Roads: §f${(town.autoRoads ?? true) ? "on" : "off"}`,
    `§eAuto Place Lots: §f${(town.autoPlaceLots ?? false) ? "on" : "off"}`,
    `§eAuto Lot Limits: §fS ${town.maxSmallLots ?? AUTO_PLACE_MAX_SMALL} / M ${town.maxMediumLots ?? AUTO_PLACE_MAX_MEDIUM} / L ${town.maxLargeLots ?? AUTO_PLACE_MAX_LARGE}`,
    `§eTown Prep: §f${town.townPrepStatus ?? "not_started"} (${town.townPrepPhase ?? "not_started"})`,
    `§eStarter Camp: §f${campStatus}${campPhase}`,
    `§eTownship Radius: §f${buildRadius}`,
    `§eTown Center: §f${center.x}, ${center.y}, ${center.z}`,
    `§eRegistered Townships This World: §f${totalTowns}`,
    `§eRegistered Lots: §f${getLots(town).length}`,
    `§eQueued Jobs: §f${getJobs(town).length}`
  ].join("\n");
}

function showTownStatusFromBlock(block, player) {
  try {
    if (!block || block.typeId !== FOUNDING_STONE_ID) return;
    const town = getTownAtBlock(block.location, block.dimension.id);
    if (!town) {
      messagePlayer(player, getTownStatusText(town));
      return;
    }
    showFoundingStoneMenu(block, player, town);
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Show Town Status", error);
    messagePlayer(player, "§cTownship error while reading status. Check content log.");
  }
}

function queueReadyLotsForAutoBuild(town) {
  if (!town) return 0;
  let count = 0;
  for (const lot of getLots(town)) {
    if (!lot) continue;
    const empty = !lot.buildingType || lot.buildingType === "empty";
    if (lot.isBuildLotRecorder) continue;
    if (lot.status === LOT_STATUS_READY && empty) {
      queueSmallHouseBuild(town, lot, false);
      count++;
    }
  }
  return count;
}

function queueRoadsForCompletedBuildings(town) {
  if (!town) return 0;
  let count = 0;
  for (const lot of getLots(town)) {
    if (!lot) continue;
    if (lot.status === LOT_STATUS_OCCUPIED && lot.roadStatus !== ROAD_STATUS_CONNECTED) {
      queueRoadToTown(town, lot, false);
      count++;
    }
  }
  return count;
}

function queueBoundaryRebuild(town) {
  if (!town) return false;
  const jobs = getJobs(town);
  const existing = jobs.find(job => job && job.type === "rebuild_boundary" && job.status !== "complete");
  if (existing) return false;
  jobs.unshift({
    type: "rebuild_boundary",
    status: "queued",
    quadrantIndex: 0,
    nextIndex: 0,
    nextTick: runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS,
    lastPhase: undefined
  });
  return true;
}

function processBoundaryRebuildJob(town, job) {
  try {
    if (!town || !job || job.type !== "rebuild_boundary" || job.status === "complete") return false;
    if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;
    const dimension = getDimensionFromId(town.dimensionId);
    if (typeof job.quadrantIndex !== "number") job.quadrantIndex = 0;
    if (job.quadrantIndex >= TOWN_PREP_QUADRANTS.length) {
      job.status = "complete";
      sendSystemMessage("§aTownship fence rebuild complete.");
      return true;
    }
    const quadrant = TOWN_PREP_QUADRANTS[job.quadrantIndex] ?? TOWN_PREP_QUADRANTS[0];
    const plan = getTownPrepPhasePlan(town, job.quadrantIndex, "mark_town_boundary");
    let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;
    while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
    if (index >= plan.length) {
      job.quadrantIndex++;
      job.nextIndex = 0;
      job.lastPhase = undefined;
      return true;
    }
    if (job.lastPhase !== quadrant.label) {
      job.lastPhase = quadrant.label;
      sendSystemMessage(`§eTownship is rebuilding the town fence (${quadrant.label} section ${job.quadrantIndex + 1}/${TOWN_PREP_QUADRANTS.length}).`);
    }
    let worked = 0;
    while (index < plan.length && worked < TOWN_PREP_BLOCKS_PER_STEP) {
      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
      if (index >= plan.length) break;
      if (safeSetBlock(dimension, plan[index])) {
        index++;
        worked++;
      } else {
        break;
      }
    }
    job.nextIndex = index;
    job.nextTick = runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS;
    if (index >= plan.length) {
      job.quadrantIndex++;
      job.nextIndex = 0;
      job.lastPhase = undefined;
    }
    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Process Boundary Rebuild Job", error);
    job.status = "error";
    return true;
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
    form.show(player).then((response) => {
      try {
        if (response.canceled) return;
        const towns = getTowns();
        const liveTown = towns.find(t => t && t.id === town.id) ?? town;
        ensureTownAutomationDefaults(liveTown);
        if (response.selection === 0) {
          liveTown.autoBuildLots = !(liveTown.autoBuildLots ?? true);
          let queued = 0;
          if (liveTown.autoBuildLots) queued = queueReadyLotsForAutoBuild(liveTown);
          messagePlayer(player, `§eAuto Build Lots is now ${liveTown.autoBuildLots ? "ON" : "OFF"}.${queued ? ` Queued ${queued} ready lot(s).` : ""}`);
        } else if (response.selection === 1) {
          liveTown.autoRoads = !(liveTown.autoRoads ?? true);
          let queued = 0;
          if (liveTown.autoRoads) queued = queueRoadsForCompletedBuildings(liveTown);
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
              lot.status = LOT_STATUS_READY;
              lot.prepPhase = lot.prepPhase === "queued" ? "manual_reset" : lot.prepPhase;
            }
            if (lot.roadStatus === ROAD_STATUS_QUEUED || lot.roadStatus === ROAD_STATUS_BUILDING) lot.roadStatus = ROAD_STATUS_NOT_CONNECTED;
          }
          messagePlayer(player, `§eCleared ${before - getJobs(liveTown).length} non-town-prep queued job(s).`);
        } else if (response.selection === 6) {
          messagePlayer(player, getTownStatusText(liveTown));
        }
        saveTowns(towns);
      } catch (innerError) {
        sendDebugLogError(ADDON_NAME, "Founding Stone Menu Action", innerError);
        messagePlayer(player, "§cTownship menu action failed. Check content log.");
      }
    }).catch((error) => sendDebugLogError(ADDON_NAME, "Founding Stone UI", error));
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Show Founding Stone Menu", error);
    messagePlayer(player, getTownStatusText(town));
  }
}

function cleanupTownAt(location, dimensionId, player) {
  try {
    const towns = getTowns();
    const remaining = towns.filter(t => !(t.dimensionId === dimensionId && t.center.x === location.x && t.center.y === location.y && t.center.z === location.z));
    if (remaining.length !== towns.length) {
      saveTowns(remaining);
      messagePlayer(player, "§eTownship record removed for this Founding Stone.");
    }
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Cleanup Town", error);
  }
}

function getDimensionFromId(dimensionId) {
  const shortId = dimensionId.replace("minecraft:", "");
  return world.getDimension(shortId);
}

function findSpawnLocation(center) {
  return { x: center.x + 3, y: center.y + 1, z: center.z };
}

function spawnTwoVillageResidents(town, dimension) {
  try {
    if (!town || !dimension || town.vanillaVillagersSpawned === true) return;
    const center = town.center ?? { x: 0, y: 0, z: 0 };
    const spots = [
      { x: center.x + 2, y: center.y + 1, z: center.z + 2 },
      { x: center.x - 2, y: center.y + 1, z: center.z + 2 }
    ];
    for (const spot of spots) {
      const villager = dimension.spawnEntity("minecraft:villager", spot);
      villager.addTag(townTag(town.id));
      villager.addTag("township_resident");
    }
    town.vanillaVillagersSpawned = true;
    sendSystemMessage("§aTwo villagers have arrived at the township.");
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Spawn Township Villagers", error);
  }
}

function spawnBuilderForTown(town) {
  try {
    const dimension = getDimensionFromId(town.dimensionId);
    let block = dimension.getBlock(town.center);
    if (!block || block.typeId !== FOUNDING_STONE_ID) {
      if ((town.townPrepStatus ?? "") === "complete") {
        ensureFoundingStoneBlock(town, dimension);
        block = dimension.getBlock(town.center);
      }
    }
    if (!block || block.typeId !== FOUNDING_STONE_ID) {
      town.builderStatus = "missing_founding_stone";
      return false;
    }

    // Construction is script-driven, but no visible Township Builder is spawned.
    // Vanilla villagers arrive only after initial setup and the starter/main lot are complete.
    town.builderEntityId = undefined;
    town.builderStatus = "present";

    sendSystemMessage("§aTownship construction controller is active.");
    if (!getJobs(town).some(job => job && job.type === "town_prep" && job.status !== "complete")) {
      queueStarterCamp(town);
    } else {
      sendSystemMessage("§eTownship construction is waiting for township founding area prep to finish.");
    }
    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Activate Township Construction", error);
    town.builderStatus = "spawn_error";
    return false;
  }
}


function getStarterCampPlan(townOrCenter) {
  const center = townOrCenter.center ?? townOrCenter;
  const frontDirection = townOrCenter.frontDirection ?? "south";
  const x = Math.floor(center.x);
  const y = Math.floor(center.y);
  const z = Math.floor(center.z);
  const plan = [];

  const add = (phase, lx, dy, lz, typeId) => {
    const p = transformTownLocal({ x, y, z }, frontDirection, lx, lz);
    plan.push({ phase, x: p.x, y: y + dy, z: p.z, typeId });
  };

  // Expanded central town lot: 17x17. Local +Z is the town front.
  for (let cy = 0; cy <= 6; cy++) {
    for (let lx = -8; lx <= 8; lx++) {
      for (let lz = -8; lz <= 8; lz++) {
        if (lx === 0 && lz === 0 && cy === 0) continue;
        add("clear_lot", lx, cy, lz, "minecraft:air");
      }
    }
  }

  // Use normal dirt so grass can regrow around the central lot.
  for (let lx = -8; lx <= 8; lx++) {
    for (let lz = -8; lz <= 8; lz++) {
      if (lx === 0 && lz === 0) continue;
      add("level_lot", lx, -1, lz, "minecraft:dirt");
    }
  }

  // 3-wide road loop outside the central fence. The fence is at +/-8, road is at +/-9 and +/-10.
  for (let lx = -10; lx <= 10; lx++) {
    for (const lz of [-10, -9, 9, 10]) add("build_camp", lx, -1, lz, DIRT_ROAD_ID);
  }
  for (let lz = -8; lz <= 8; lz++) {
    for (const lx of [-10, -9, 9, 10]) add("build_camp", lx, -1, lz, DIRT_ROAD_ID);
  }

  // Larger open starter pavilion / future town hall footprint.
  for (const lx of [-4, 4]) {
    for (const lz of [-4, 4]) {
      for (let dy = 0; dy <= 3; dy++) add("build_camp", lx, dy, lz, "minecraft:oak_log");
    }
  }

  for (let lx = -4; lx <= 4; lx++) {
    for (let lz = -4; lz <= 4; lz++) {
      if (lx === 0 && lz === 0) continue;
      add("build_camp", lx, 4, lz, "minecraft:oak_planks");
    }
  }
  for (let lx = -3; lx <= 3; lx++) {
    if (lx === 0) continue;
    add("build_camp", lx, 3, -4, "minecraft:oak_planks");
  }

  // Fence the central lot, with a front opening aligned to the town front.
  for (let lx = -8; lx <= 8; lx++) {
    for (const lz of [-8, 8]) {
      if (lz === 8 && lx >= -1 && lx <= 1) continue;
      add("build_camp", lx, 0, lz, "minecraft:oak_fence");
    }
  }
  for (let lz = -7; lz <= 7; lz++) {
    add("build_camp", -8, 0, lz, "minecraft:oak_fence");
    add("build_camp", 8, 0, lz, "minecraft:oak_fence");
  }

  // More lighting throughout the central lot.
  for (const [tx, tz] of [[-7,-7],[7,-7],[-7,7],[7,7],[-3,0],[3,0],[-2,5],[2,5]]) {
    add("build_camp", tx, 0, tz, "minecraft:torch");
  }

  add("build_camp", 0, 0, 3, "minecraft:campfire");
  add("build_camp", -3, 0, 2, "minecraft:chest");
  add("build_camp", 3, 0, 2, "minecraft:crafting_table");
  add("build_camp", 0, 0, 5, "minecraft:bell");

  return plan;
}
function getCampPhaseLabel(phase) {
  if (phase === "clear_lot") return "clearing starter lot";
  if (phase === "level_lot") return "leveling starter lot";
  if (phase === "build_camp") return "building starter camp";
  return phase ?? "working";
}

function keepBuilderNearLocation(town, location, maxDistance = 10) {
  try {
    const dimension = getDimensionFromId(town.dimensionId);
    const builders = dimension.getEntities({ tags: [BUILDER_TAG, townTag(town.id)] });
    if (!builders || builders.length === 0) return;

    const builder = builders[0];
    const d = distance2D(builder.location, location);
    if (d <= maxDistance) return;

    const target = { x: location.x + 2, y: location.y + 1, z: location.z };
    if (typeof builder.teleport === "function") {
      builder.teleport(target, { dimension });
    }
  } catch (error) {
    // Keep this non-fatal. Builder movement polish should not break construction.
    sendDebugLogError(ADDON_NAME, "Keep Builder Near Location", error);
  }
}

function keepBuilderNearTown(town) {
  keepBuilderNearLocation(town, town.center, 10);
}

function queueStarterCamp(town) {
  if (!town || town.campStatus === CAMP_JOB_STATUS_COMPLETE || town.campStatus === CAMP_JOB_STATUS_BUILDING) return;
  town.campStatus = CAMP_JOB_STATUS_BUILDING;
  town.campNextIndex = 0;
  town.campNextTick = runtimeState.tickCounter + CAMP_BUILD_INTERVAL_TICKS;
  town.campLastPhase = undefined;
  sendSystemMessage("§eThe Township Builder has started preparing the starter camp.");
}

function blockAlreadyMatches(dimension, entry) {
  try {
    const block = dimension.getBlock({ x: entry.x, y: entry.y, z: entry.z });
    if (!block) return false;
    if (block.typeId === FOUNDING_STONE_ID || block.typeId === GROUND_LEVELER_ID || block.typeId === BUILD_RECORDER_ID) return true;
    if (isLotMarkerType(block.typeId)) return !entry.clearLotMarker;
    if (entry?.supportFill) {
      return !(block.typeId === "minecraft:air" || block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water");
    }
    if (block.typeId !== entry.typeId) return false;

    if (entry.states) {
      try {
        for (const [stateName, expectedValue] of Object.entries(entry.states)) {
          const currentValue = block.permutation.getState(stateName);
          if (currentValue !== expectedValue) return false;
        }
      } catch (stateError) {
        // If state reading fails, rebuild the block so directional/multipart blocks are corrected.
        return false;
      }
    }

    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Check Starter Camp Block", error);
    return false;
  }
}

function safeSetBlock(dimension, entry) {
  try {
    const block = dimension.getBlock({ x: entry.x, y: entry.y, z: entry.z });
    if (!block) return false;
    if (blockAlreadyMatches(dimension, entry)) return true;
    if (entry?.supportFill && !(block.typeId === "minecraft:air" || block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water")) return true;

    if (entry.states) {
      try {
        const permutation = BlockPermutation.resolve(entry.typeId, entry.states);
        block.setPermutation(permutation);
        return true;
      } catch (permutationError) {
        sendDebugLogError(ADDON_NAME, "Set Block Permutation", permutationError);
        // Fall back to type placement so the build can continue even if a state is rejected.
      }
    }

    block.setType(entry.typeId);
    return true;
  } catch (error) {
    if (entry?.setupFill && entry?.typeId === "minecraft:dirt") return true;
    sendDebugLogError(ADDON_NAME, "Starter Camp Block", error);
    return false;
  }
}

function starterCampTickingAreaName(town) {
  return `township_starter_${safeLocationKey(town.center ?? { x: 0, y: 0, z: 0 })}`.slice(0, 60);
}

function getPlanBounds(plan, yFallback = 64, buffer = ACTIVE_JOB_BUFFER) {
  if (!Array.isArray(plan) || plan.length === 0) return undefined;
  const xs = plan.map(p => p.x).filter(v => typeof v === "number");
  const zs = plan.map(p => p.z).filter(v => typeof v === "number");
  if (xs.length === 0 || zs.length === 0) return undefined;
  return {
    minX: Math.min(...xs) - buffer,
    maxX: Math.max(...xs) + buffer,
    minZ: Math.min(...zs) - buffer,
    maxZ: Math.max(...zs) + buffer,
    y: yFallback
  };
}

function ensureStarterCampTickingArea(town, dimension, plan) {
  try {
    if (!town || !dimension) return;
    const bounds = getPlanBounds(plan, Math.floor(town.center?.y ?? 64), ACTIVE_JOB_BUFFER);
    if (!bounds) return;
    const name = starterCampTickingAreaName(town);
    const key = `${bounds.minX}_${bounds.minZ}_${bounds.maxX}_${bounds.maxZ}`;
    if (town.campTickingAreaName === name && town.campTickingAreaKey === key) return;
    if (town.campTickingAreaName) {
      removeTownshipTickingArea(
        town.campTickingAreaName,
        (systemName, error) => sendDebugLogError(ADDON_NAME, systemName, error),
        "Remove Starter Camp Ticking Area"
      );
    }
    town.campTickingAreaName = name;
    town.campTickingAreaKey = key;
    town.loadState = undefined;
    town.loadConfirmed = false;
    town.loadFailureAnnounced = false;
    const centerX = Math.floor((Math.floor(bounds.minX) + Math.floor(bounds.maxX)) / 2);
    const centerZ = Math.floor((Math.floor(bounds.minZ) + Math.floor(bounds.maxZ)) / 2);
    town.loadBounds = { ...bounds, testY: bounds.y };
    requestTownshipTickingArea({
      dimension,
      bounds: town.loadBounds,
      identifier: name,
      target: town,
      label: "Add Starter Camp Ticking Area",
      tick: runtimeState.tickCounter,
      readyDelayTicks: TOWN_PREP_LOAD_WAIT_TICKS,
      reportError: (systemName, error) => sendDebugLogError(ADDON_NAME, systemName, error),
      reportMessage: sendSystemMessage
    });
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Ensure Starter Camp Ticking Area", error);
  }
}

function removeStarterCampTickingArea(town, dimension) {
  try {
    if (!town?.campTickingAreaName || !dimension) return;
    removeTownshipTickingArea(
      town.campTickingAreaName,
      (systemName, error) => sendDebugLogError(ADDON_NAME, systemName, error),
      "Remove Starter Camp Ticking Area"
    );
    town.campTickingAreaName = undefined;
    town.campTickingAreaKey = undefined;
    town.loadState = undefined;
    town.loadConfirmed = undefined;
    town.loadBounds = undefined;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Remove Starter Camp Ticking Area", error);
  }
}

function processStarterCamp(town) {
  try {
    if (!town || town.campStatus !== CAMP_JOB_STATUS_BUILDING) return false;
    if (typeof town.campNextTick === "number" && runtimeState.tickCounter < town.campNextTick) return false;

    keepBuilderNearTown(town);

    const dimension = getDimensionFromId(town.dimensionId);
    const plan = getStarterCampPlan(town);
    ensureStarterCampTickingArea(town, dimension, plan);
    if (!waitForTickingAreaReady(town, dimension, town.loadBounds, "Starter camp work zone")) {
      town.campNextTick = runtimeState.tickCounter + CAMP_BUILD_INTERVAL_TICKS;
      return true;
    }
    let index = typeof town.campNextIndex === "number" ? town.campNextIndex : 0;

    if (index >= plan.length) {
      town.campStatus = CAMP_JOB_STATUS_COMPLETE;
      town.campLastPhase = "complete";
      removeStarterCampTickingArea(town, dimension);
      sendSystemMessage("§aStarter camp complete.");
      return true;
    }

    // Skip already-correct blocks immediately, including air positions that are already air.
    // This keeps clear/repair/resume jobs from wasting one build tick per unchanged block.
    let skipped = 0;
    while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
      index++;
      skipped++;
    }

    if (index >= plan.length) {
      town.campNextIndex = index;
      town.campStatus = CAMP_JOB_STATUS_COMPLETE;
      town.campLastPhase = "complete";
      removeStarterCampTickingArea(town, dimension);
      sendSystemMessage("§aStarter camp complete.");
      return true;
    }

    let worked = 0;
    while (index < plan.length && worked < CAMP_BLOCKS_PER_STEP) {
      // Skip any already-correct entries without spending a visible build action.
      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
        index++;
        skipped++;
      }

      if (index >= plan.length) break;

      const entry = plan[index];
      const phase = entry.phase ?? "build_camp";
      if (town.campLastPhase !== phase) {
        town.campLastPhase = phase;
        sendSystemMessage(`§eTownship Builder is ${getCampPhaseLabel(phase)}.`);
      }

      if (safeSetBlock(dimension, entry)) {
        index++;
        worked++;
      } else {
        break;
      }
    }

    town.campNextIndex = index;
    town.campNextTick = runtimeState.tickCounter + CAMP_BUILD_INTERVAL_TICKS;

    if (index % 50 === 0 || skipped >= 50) {
      sendSystemMessage(`§7Starter camp progress: ${index}/${plan.length}`);
    }

    if (town.campNextIndex >= plan.length) {
      town.campStatus = CAMP_JOB_STATUS_COMPLETE;
      town.campLastPhase = "complete";
      removeStarterCampTickingArea(town, dimension);
      sendSystemMessage("§aStarter camp complete.");
    }

    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Process Starter Camp", error);
    town.campStatus = "starter_camp_error";
    return true;
  }
}


function getLotPrepPlan(lot) {
  const marker = lot.marker;
  const y = Math.floor(marker.y);
  const half = lot.halfSize ?? LOT_SMALL_HALF;
  const depth = (lot.size ?? LOT_SMALL_SIZE) - 1;
  const backDirection = lot.backDirection ?? "north";
  const plan = [];

  const add = (phase, lx, dy, lb, typeId) => {
    const p = transformFromBackAnchor(marker, backDirection, lx, lb);
    plan.push({ phase, x: p.x, y: y + dy, z: p.z, typeId });
  };

  // Clear the small lot above the floor while preserving the Lot Marker on the front edge.
  for (let cy = 0; cy <= 5; cy++) {
    for (let lx = -half; lx <= half; lx++) {
      for (let lb = 0; lb <= depth; lb++) {
        if (lx === 0 && lb === 0 && cy === 0) continue;
        add("clear_lot", lx, cy, lb, "minecraft:air");
      }
    }
  }

  // Solidify and level the ground under the directional lot. Two layers avoids hollow edges over water/sand cuts.
  for (let lx = -half; lx <= half; lx++) {
    for (let lb = 0; lb <= depth; lb++) {
      add("level_lot", lx, -3, lb, "minecraft:dirt");
      add("level_lot", lx, -2, lb, "minecraft:dirt");
      add("level_lot", lx, -1, lb, "minecraft:dirt");
    }
  }

  // Visible lot boundary. Leave a front opening around the Lot Marker.
  for (let lx = -half; lx <= half; lx++) {
    const frontOpen = (lx >= LOT_PATH_OFFSET - 1 && lx <= LOT_PATH_OFFSET + 1);
    if (!frontOpen && lx !== 0) add("outline_lot", lx, 0, 0, "minecraft:oak_fence");
    add("outline_lot", lx, 0, depth, "minecraft:oak_fence");
  }

  for (let lb = 1; lb <= depth - 1; lb++) {
    add("outline_lot", -half, 0, lb, "minecraft:oak_fence");
    add("outline_lot", half, 0, lb, "minecraft:oak_fence");
  }

  // Low corner posts mark the bounds without torch glow clutter.
  for (const [cx, cb] of [[-half, 0], [half, 0], [-half, depth], [half, depth]]) {
    add("outline_lot", cx, 1, cb, "minecraft:stripped_oak_log");
  }

  return plan;
}
function getLotPrepPhaseLabel(phase) {
  if (phase === "clear_lot") return "clearing a township lot";
  if (phase === "level_lot") return "leveling a township lot";
  if (phase === "outline_lot") return "marking a township lot boundary";
  return phase ?? "preparing a township lot";
}



function processSmallHouseJob(town, job) {
  try {
    if (!town || !job || job.type !== "build_small_house" || job.status === "complete") return false;
    if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;

    const lot = getLotById(town, job.lotId);
    if (!lot || !lot.marker) {
      job.status = "complete";
      return true;
    }

    const dimension = getDimensionFromId(town.dimensionId);
    ensureActiveJobTickingArea(town, job, dimension);
    if (!waitForTickingAreaReady(job, dimension, job.loadBounds, "Active build job")) {
      job.nextTick = runtimeState.tickCounter + HOUSE_BUILD_INTERVAL_TICKS;
      return true;
    }
    const markerBlock = dimension.getBlock(lot.marker);
    if (!markerBlock || !isLotMarkerType(markerBlock.typeId)) {
      lot.status = "missing_marker";
      job.status = "complete";
      return true;
    }

    keepBuilderNearLocation(town, lot.marker, 12);

    const variant = job.buildingVariant ?? lot.buildVariant ?? buildingPlans.chooseAutoBuildingVariant(lot);
    lot.buildVariant = variant;
    const plan = buildingPlans.getAutoBuildingPlan(town, lot, variant);
    let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;

    while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
      index++;
    }

    if (index >= plan.length) {
      if (!verifyPlanComplete(dimension, plan, job, buildingPlans.buildingDisplayName(variant))) return true;
      lot.status = LOT_STATUS_OCCUPIED;
      lot.buildingType = variant;
      lot.buildingLevel = 1;
      lot.buildPhase = "complete";
      job.status = "complete";
      removeActiveJobTickingArea(town, job, dimension);
      sendSystemMessage(`§a${buildingPlans.buildingDisplayName(variant)} complete on lot: ${lot.id}`);
      ensureTownAutomationDefaults(town);
      if (town.autoRoads !== false) queueRoadToTown(town, lot, true);
      return true;
    }

    lot.status = LOT_STATUS_BUILDING;
    let worked = 0;
    while (index < plan.length && worked < HOUSE_BLOCKS_PER_STEP) {
      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
        index++;
      }
      if (index >= plan.length) break;

      const entry = plan[index];
      const phase = entry.phase ?? "build_small_house";
      if (job.lastPhase !== phase) {
        job.lastPhase = phase;
        lot.buildPhase = phase;
        sendSystemMessage(`§eTownship Builder is ${buildingPlans.getSmallHousePhaseLabel(phase, variant)}.`);
      }

      if (safeSetBlock(dimension, entry)) {
        index++;
        worked++;
      } else {
        break;
      }
    }

    job.nextIndex = index;
    job.nextTick = runtimeState.tickCounter + HOUSE_BUILD_INTERVAL_TICKS;

    if (index >= plan.length) {
      if (!verifyPlanComplete(dimension, plan, job, buildingPlans.buildingDisplayName(variant))) return true;
      lot.status = LOT_STATUS_OCCUPIED;
      lot.buildingType = variant;
      lot.buildingLevel = 1;
      lot.buildPhase = "complete";
      job.status = "complete";
      removeActiveJobTickingArea(town, job, dimension);
      sendSystemMessage(`§a${buildingPlans.buildingDisplayName(variant)} complete on lot: ${lot.id}`);
      ensureTownAutomationDefaults(town);
      if (town.autoRoads !== false) queueRoadToTown(town, lot, true);
    }

    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Process Small House Job", error);
    job.status = "error";
    const lot = getLotById(town, job.lotId);
    if (lot) lot.status = "small_house_error";
    return true;
  }
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

function getAllRoadBlockedBounds(town, currentLot = undefined, expand = 1) {
  const blocked = [];
  // Keep roads out of the starter town-center lot as well.
  blocked.push(expandBounds(getCenteredBounds(town.center, LOT_SMALL_HALF), expand));
  for (const lot of getLots(town)) {
    const b = getLotBounds(lot);
    if (!b) continue;
    blocked.push(expandBounds(b, expand));
  }
  return blocked.filter(Boolean);
}

function pointInsideAnyBounds(x, z, boundsList) {
  for (const bounds of boundsList) {
    if (pointInsideBounds(x, z, bounds)) return true;
  }
  return false;
}

function boundsOverlapInnerWallReserve(town, bounds) {
  try {
    if (!town || !town.center || !bounds) return false;
    const cx = Math.floor(town.center.x);
    const cz = Math.floor(town.center.z);
    const r = TOWN_BOUNDARY_RADIUS;
    const w = INNER_WALL_RESERVE_HALF_WIDTH;
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


function isRoadBuildProtectedBlock(typeId) {
  return typeId === FOUNDING_STONE_ID || isLotMarkerType(typeId) || typeId === GROUND_LEVELER_ID || typeId === BUILD_RECORDER_ID;
}

function findNearestExistingRoadTarget(town, start, currentLot) {
  try {
    const dimension = getDimensionFromId(town.dimensionId);
    const buildRadius = town.buildRadius ?? STARTING_BUILD_RADIUS;
    const cx = Math.floor(town.center.x);
    const cz = Math.floor(town.center.z);
    const blocked = getAllRoadBlockedBounds(town, currentLot, 2);
    let best = undefined;
    let bestDistance = 999999;

    for (let x = cx - buildRadius; x <= cx + buildRadius; x++) {
      for (let z = cz - buildRadius; z <= cz + buildRadius; z++) {
        if (pointInsideAnyBounds(x, z, blocked)) continue;
        const block = dimension.getBlock({ x, y: start.y, z });
        if (!block || block.typeId !== DIRT_ROAD_ID) continue;
        const d = Math.abs(x - start.x) + Math.abs(z - start.z);
        if (d < 4) continue;
        if (d < bestDistance) {
          bestDistance = d;
          best = { x, y: start.y, z };
        }
      }
    }

    return best;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Find Existing Road Target", error);
    return undefined;
  }
}

function buildRoadCenterPath(town, lot, start, end) {
  const buildRadius = town.buildRadius ?? STARTING_BUILD_RADIUS;
  const cx = Math.floor(town.center.x);
  const cz = Math.floor(town.center.z);
  const minX = cx - buildRadius;
  const maxX = cx + buildRadius;
  const minZ = cz - buildRadius;
  const maxZ = cz + buildRadius;
  const blocked = getAllRoadBlockedBounds(town, lot, 2);
  const startKey = `${start.x},${start.z}`;
  const endKey = `${end.x},${end.z}`;

  const isBlocked = (x, z) => {
    const key = `${x},${z}`;
    if (key === startKey || key === endKey) return false;
    if (x < minX || x > maxX || z < minZ || z > maxZ) return true;
    return pointInsideAnyBounds(x, z, blocked);
  };

  if (isBlocked(end.x, end.z)) return [];

  const open = [{ x: start.x, z: start.z, g: 0, f: Math.abs(start.x - end.x) + Math.abs(start.z - end.z) }];
  const cameFrom = new Map();
  const bestG = new Map([[startKey, 0]]);
  const closed = new Set();
  const directions = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 }
  ];

  let iterations = 0;
  while (open.length > 0 && iterations < 30000) {
    iterations++;
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const currentKey = `${current.x},${current.z}`;
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    if (currentKey === endKey) {
      const path = [];
      let k = currentKey;
      let p = { x: current.x, z: current.z };
      path.push(p);
      while (cameFrom.has(k)) {
        p = cameFrom.get(k);
        k = `${p.x},${p.z}`;
        path.push(p);
      }
      path.reverse();
      return path;
    }

    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const nz = current.z + dir.dz;
      const nk = `${nx},${nz}`;
      if (closed.has(nk) || isBlocked(nx, nz)) continue;
      const ng = current.g + 1;
      if (ng >= (bestG.get(nk) ?? 999999)) continue;
      bestG.set(nk, ng);
      cameFrom.set(nk, { x: current.x, z: current.z });
      const h = Math.abs(nx - end.x) + Math.abs(nz - end.z);
      open.push({ x: nx, z: nz, g: ng, f: ng + h });
    }
  }

  return [];
}

function queueRoadToTown(town, lot, priority = false) {
  if (!town || !lot || !lot.marker) return;
  if (lot.roadStatus === ROAD_STATUS_CONNECTED || lot.roadStatus === ROAD_STATUS_QUEUED || lot.roadStatus === ROAD_STATUS_BUILDING) return;
  const jobs = getJobs(town);
  const existing = jobs.find(job => job && job.type === "build_road" && job.lotId === lot.id && job.status !== "complete");
  if (existing) return;
  lot.roadStatus = ROAD_STATUS_QUEUED;
  lot.roadPhase = "queued";
  const newJob = {
    type: "build_road",
    lotId: lot.id,
    status: "queued",
    nextIndex: 0,
    nextTick: runtimeState.tickCounter + ROAD_BUILD_INTERVAL_TICKS,
    lastPhase: undefined
  };
  if (priority) jobs.unshift(newJob);
  else jobs.push(newJob);
}

function getRoadPlan(town, lot) {
  const plan = [];
  if (!town || !lot || !lot.marker || !town.center) return plan;
  const front = directionVector(lot.frontDirection ?? "south");
  const townFront = directionVector(town.frontDirection ?? "south");

  // Start outside the lot front. The 3-wide brush is kept out of all lot bounds.
  const roadStartPoint = transformFromBackAnchor(lot.marker, lot.backDirection ?? "north", LOT_PATH_OFFSET, -3);
  const start = {
    x: Math.floor(roadStartPoint.x),
    y: Math.floor(lot.marker.y) - 1,
    z: Math.floor(roadStartPoint.z)
  };

  const fallbackEnd = {
    x: Math.floor(town.center.x) + townFront.dx * 7,
    y: Math.floor(town.center.y) - 1,
    z: Math.floor(town.center.z) + townFront.dz * 7
  };

  const existingRoadTarget = findNearestExistingRoadTarget(town, start, lot);
  const end = existingRoadTarget ?? fallbackEnd;
  const blockedForBrush = getAllRoadBlockedBounds(town, lot, 2);

  const pushRoad = (rx, rz) => {
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const wx = rx + ox;
        const wz = rz + oz;
        if (wx === Math.floor(lot.marker.x) && wz === Math.floor(lot.marker.z)) continue;
        if (wx === Math.floor(town.center.x) && wz === Math.floor(town.center.z)) continue;
        if (pointInsideAnyBounds(wx, wz, blockedForBrush)) continue;
        plan.push({ phase: "clear_road", x: wx, y: start.y + 1, z: wz, typeId: "minecraft:air" });
        plan.push({ phase: "build_road", x: wx, y: start.y, z: wz, typeId: DIRT_ROAD_ID });
      }
    }
  };

  const centerPath = buildRoadCenterPath(town, lot, start, end);
  if (centerPath.length === 0) {
    // No safe path found. Do not build a short broken road stub.
    return plan;
  }

  for (const p of centerPath) pushRoad(p.x, p.z);
  return plan;
}

function getRoadPhaseLabel(phase) {
  if (phase === "clear_road") return "clearing a road path";
  if (phase === "build_road") return "building a township dirt road";
  return phase ?? "building a township road";
}

function processRoadJob(town, job) {
  try {
    if (!town || !job || job.type !== "build_road" || job.status === "complete") return false;
    if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;

    const lot = getLotById(town, job.lotId);
    if (!lot || !lot.marker) {
      job.status = "complete";
      return true;
    }

    const dimension = getDimensionFromId(town.dimensionId);
    ensureActiveJobTickingArea(town, job, dimension);
    if (!waitForTickingAreaReady(job, dimension, job.loadBounds, "Active road job")) {
      job.nextTick = runtimeState.tickCounter + ROAD_BUILD_INTERVAL_TICKS;
      return true;
    }
    const markerBlock = dimension.getBlock(lot.marker);
    if (!markerBlock || !isLotMarkerType(markerBlock.typeId)) {
      lot.status = "missing_marker";
      job.status = "complete";
      return true;
    }

    keepBuilderNearLocation(town, lot.marker, 14);

    if (!Array.isArray(job.plan) || job.plan.length === 0) job.plan = getRoadPlan(town, lot);
    const plan = job.plan;
    let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;

    while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
      index++;
    }

    if (index >= plan.length) {
      if (!verifyPlanComplete(dimension, plan, job, "Township road")) return true;
      lot.roadStatus = ROAD_STATUS_CONNECTED;
      lot.roadPhase = "complete";
      job.status = "complete";
      removeActiveJobTickingArea(town, job, dimension);
      sendSystemMessage(`§aTownship dirt road connected for lot: ${lot.id}`);
      return true;
    }

    lot.roadStatus = ROAD_STATUS_BUILDING;
    let worked = 0;
    while (index < plan.length && worked < ROAD_BLOCKS_PER_STEP) {
      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
        index++;
      }
      if (index >= plan.length) break;

      const entry = plan[index];
      const phase = entry.phase ?? "build_road";
      if (job.lastPhase !== phase) {
        job.lastPhase = phase;
        lot.roadPhase = phase;
        sendSystemMessage(`§eTownship Builder is ${getRoadPhaseLabel(phase)}.`);
      }

      if (safeSetBlock(dimension, entry)) {
        index++;
        worked++;
      } else {
        break;
      }
    }

    job.nextIndex = index;
    job.nextTick = runtimeState.tickCounter + ROAD_BUILD_INTERVAL_TICKS;

    if (index >= plan.length) {
      if (!verifyPlanComplete(dimension, plan, job, "Township road")) return true;
      lot.roadStatus = ROAD_STATUS_CONNECTED;
      lot.roadPhase = "complete";
      job.status = "complete";
      removeActiveJobTickingArea(town, job, dimension);
      sendSystemMessage(`§aTownship dirt road connected for lot: ${lot.id}`);
    }

    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Process Road Job", error);
    job.status = "error";
    const lot = getLotById(town, job.lotId);
    if (lot) lot.roadStatus = "road_error";
    return true;
  }
}

function processLotPrepJob(town, job) {
  try {
    if (!town || !job || job.type !== "prepare_lot" || job.status === "complete") return false;
    if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;

    const lot = getLotById(town, job.lotId);
    if (!lot || !lot.marker) {
      job.status = "complete";
      return true;
    }

    const dimension = getDimensionFromId(town.dimensionId);
    ensureActiveJobTickingArea(town, job, dimension);
    if (!waitForTickingAreaReady(job, dimension, job.loadBounds, "Active lot prep job")) {
      job.nextTick = runtimeState.tickCounter + LOT_PREP_INTERVAL_TICKS;
      return true;
    }
    const markerBlock = dimension.getBlock(lot.marker);
    if (!markerBlock || !isLotMarkerType(markerBlock.typeId)) {
      lot.status = "missing_marker";
      job.status = "complete";
      return true;
    }

    lot.townCenter = town.center;
    keepBuilderNearLocation(town, lot.marker, 12);

    const plan = getLotPrepPlan(lot);
    let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;

    while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
      index++;
    }

    if (index >= plan.length) {
      if (!verifyPlanComplete(dimension, plan, job, "Township lot prep")) return true;
      lot.status = LOT_STATUS_READY;
      lot.prepPhase = "complete";
      job.status = "complete";
      removeActiveJobTickingArea(town, job, dimension);
      sendSystemMessage(`§aTownship lot ready: ${lot.id}`);
      ensureTownAutomationDefaults(town);
      if (!lot.isBuildLotRecorder && town.autoBuildLots !== false) queueSmallHouseBuild(town, lot, true);
      return true;
    }

    lot.status = LOT_STATUS_PREPARING;
    let worked = 0;
    while (index < plan.length && worked < LOT_PREP_BLOCKS_PER_STEP) {
      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
        index++;
      }
      if (index >= plan.length) break;

      const entry = plan[index];
      const phase = entry.phase ?? "outline_lot";
      if (job.lastPhase !== phase) {
        job.lastPhase = phase;
        lot.prepPhase = phase;
        sendSystemMessage(`§eTownship Builder is ${getLotPrepPhaseLabel(phase)}.`);
      }

      if (safeSetBlock(dimension, entry)) {
        index++;
        worked++;
      } else {
        break;
      }
    }

    job.nextIndex = index;
    job.nextTick = runtimeState.tickCounter + LOT_PREP_INTERVAL_TICKS;

    if (index >= plan.length) {
      if (!verifyPlanComplete(dimension, plan, job, "Township lot prep")) return true;
      lot.status = LOT_STATUS_READY;
      lot.prepPhase = "complete";
      job.status = "complete";
      removeActiveJobTickingArea(town, job, dimension);
      sendSystemMessage(`§aTownship lot ready: ${lot.id}`);
      ensureTownAutomationDefaults(town);
      if (!lot.isBuildLotRecorder && town.autoBuildLots !== false) queueSmallHouseBuild(town, lot, true);
    }

    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Process Lot Prep Job", error);
    job.status = "error";
    const lot = getLotById(town, job.lotId);
    if (lot) lot.status = "prep_error";
    return true;
  }
}

function cleanupLotsInsideGroundLeveler(town, dimension, job) {
  try {
    if (!town || !job?.location) return;
    const loc = job.location;
    const protectedCenter = town.center ? expandBounds(getCenteredBounds(town.center, 10), 0) : undefined;
    const removedIds = new Set();
    const remaining = [];
    for (const lot of getLots(town)) {
      const marker = lot?.marker;
      if (!marker) { remaining.push(lot); continue; }
      const insideRange = Math.abs(marker.x - loc.x) <= GROUND_LEVELER_HALF && Math.abs(marker.z - loc.z) <= GROUND_LEVELER_HALF;
      const protectedMain = protectedCenter && pointInsideBounds(marker.x, marker.z, protectedCenter);
      if (insideRange && !protectedMain) {
        removedIds.add(lot.id);
        try {
          const b = dimension.getBlock(marker);
          if (b && isLotMarkerType(b.typeId)) b.setType("minecraft:air");
        } catch (blockError) { sendDebugLogError(ADDON_NAME, "Ground Leveler Clear Lot Marker", blockError); }
      } else {
        remaining.push(lot);
      }
    }
    if (removedIds.size > 0) {
      town.lots = remaining;
      town.jobs = getJobs(town).filter(j => !(j?.lotId && removedIds.has(j.lotId)));
      sendSystemMessage(`§eTownship Ground Leveler removed ${removedIds.size} lot marker record(s).`);
    }
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Ground Leveler Cleanup Lots", error);
  }
}

function getGroundLevelerPlan(town, job) {
  const loc = job.location;
  const plan = [];
  if (!loc) return plan;
  const x0 = Math.floor(loc.x);
  const y0 = Math.floor(loc.y);
  const z0 = Math.floor(loc.z);
  const protectedCenter = town?.center ? expandBounds(getCenteredBounds(town.center, 10), 0) : undefined;

  for (let cy = 0; cy <= GROUND_LEVELER_CLEAR_HEIGHT; cy++) {
    for (let dx = -GROUND_LEVELER_HALF; dx <= GROUND_LEVELER_HALF; dx++) {
      for (let dz = -GROUND_LEVELER_HALF; dz <= GROUND_LEVELER_HALF; dz++) {
        const wx = x0 + dx;
        const wz = z0 + dz;
        if (dx === 0 && dz === 0 && cy === 0) continue;
        if (protectedCenter && pointInsideBounds(wx, wz, protectedCenter)) continue;
        plan.push({ phase: "clear_ground_leveler", x: wx, y: y0 + cy, z: wz, typeId: "minecraft:air", clearLotMarker: true });
      }
    }
  }

  for (let dx = -GROUND_LEVELER_HALF; dx <= GROUND_LEVELER_HALF; dx++) {
    for (let dz = -GROUND_LEVELER_HALF; dz <= GROUND_LEVELER_HALF; dz++) {
      const wx = x0 + dx;
      const wz = z0 + dz;
      if (protectedCenter && pointInsideBounds(wx, wz, protectedCenter)) continue;
      plan.push({ phase: "level_ground_leveler", x: wx, y: y0 - 3, z: wz, typeId: "minecraft:dirt" });
      plan.push({ phase: "level_ground_leveler", x: wx, y: y0 - 2, z: wz, typeId: "minecraft:dirt" });
      plan.push({ phase: "level_ground_leveler", x: wx, y: y0 - 1, z: wz, typeId: "minecraft:dirt" });
    }
  }

  return plan;
}

function getGroundLevelerPhaseLabel(phase) {
  if (phase === "clear_ground_leveler") return "clearing a large township work area";
  if (phase === "level_ground_leveler") return "leveling a large township work area";
  return phase ?? "using a Township Ground Leveler";
}

function processGroundLevelerJob(town, job) {
  try {
    if (!town || !job || job.type !== "ground_leveler" || job.status === "complete") return false;
    if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;

    const dimension = getDimensionFromId(town.dimensionId);
    const levelerBlock = dimension.getBlock(job.location);
    if (!levelerBlock || levelerBlock.typeId !== GROUND_LEVELER_ID) {
      job.status = "complete";
      return true;
    }

    keepBuilderNearLocation(town, job.location, 18);

    if (!job.cleanedLots) { cleanupLotsInsideGroundLeveler(town, dimension, job); job.cleanedLots = true; }
    const plan = getGroundLevelerPlan(town, job);
    let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;

    while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
      index++;
    }

    if (index >= plan.length) {
      try {
        const b = dimension.getBlock(job.location);
        if (b && b.typeId === GROUND_LEVELER_ID) b.setType("minecraft:air");
      } catch (cleanupError) { sendDebugLogError(ADDON_NAME, "Ground Leveler Self Remove", cleanupError); }
      job.status = "complete";
      sendSystemMessage("§aTownship Ground Leveler job complete and removed itself.");
      return true;
    }

    let worked = 0;
    while (index < plan.length && worked < GROUND_LEVELER_BLOCKS_PER_STEP) {
      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
        index++;
      }
      if (index >= plan.length) break;

      const entry = plan[index];
      const phase = entry.phase ?? "ground_leveler";
      if (job.lastPhase !== phase) {
        job.lastPhase = phase;
        sendSystemMessage(`§eTownship Builder is ${getGroundLevelerPhaseLabel(phase)}.`);
      }

      if (safeSetBlock(dimension, entry)) {
        index++;
        worked++;
      } else {
        break;
      }
    }

    job.nextIndex = index;
    job.nextTick = runtimeState.tickCounter + GROUND_LEVELER_INTERVAL_TICKS;

    if (index >= plan.length) {
      try {
        const b = dimension.getBlock(job.location);
        if (b && b.typeId === GROUND_LEVELER_ID) b.setType("minecraft:air");
      } catch (cleanupError) { sendDebugLogError(ADDON_NAME, "Ground Leveler Self Remove", cleanupError); }
      job.status = "complete";
      sendSystemMessage("§aTownship Ground Leveler job complete and removed itself.");
    }

    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Process Ground Leveler Job", error);
    job.status = "error";
    return true;
  }
}


function countLotsBySizeName(town, sizeName) {
  return getLots(town).filter(lot => lot && lot.sizeName === sizeName).length;
}

function directionTowardCenter(marker, center) {
  const dx = Math.floor(center.x) - Math.floor(marker.x);
  const dz = Math.floor(center.z) - Math.floor(marker.z);
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "east" : "west";
  return dz > 0 ? "south" : "north";
}

function getAutoLotPlanForType(typeId) {
  const info = getLotSizeInfoFromMarker(typeId);
  return { typeId, ...info, max: info.size === LOT_SMALL_SIZE ? AUTO_PLACE_MAX_SMALL : (info.size === LOT_MEDIUM_SIZE ? AUTO_PLACE_MAX_MEDIUM : AUTO_PLACE_MAX_LARGE) };
}

function lotBoundsInsideBuildRadius(town, bounds) {
  if (!town || !bounds) return false;
  const radius = town.buildRadius ?? STARTING_BUILD_RADIUS;
  const points = [
    { x: bounds.minX, z: bounds.minZ }, { x: bounds.minX, z: bounds.maxZ },
    { x: bounds.maxX, z: bounds.minZ }, { x: bounds.maxX, z: bounds.maxZ }
  ];
  return points.every(p => distance2D({ x: p.x, z: p.z }, town.center) <= radius - 2);
}


function boundsOverlapPrimaryRoadReserve(town, bounds) {
  if (!town || !town.center || !bounds) return false;
  const cx = Math.floor(town.center.x);
  const cz = Math.floor(town.center.z);
  const r = town.buildRadius ?? STARTING_BUILD_RADIUS;
  const w = ROAD_RESERVE_HALF_WIDTH;

  // The founding layout creates a north/south and east/west arterial cross through town center.
  const overlapsNorthSouth = bounds.maxX >= cx - w && bounds.minX <= cx + w && bounds.maxZ >= cz - r && bounds.minZ <= cz + r;
  const overlapsEastWest = bounds.maxZ >= cz - w && bounds.minZ <= cz + w && bounds.maxX >= cx - r && bounds.minX <= cx + r;
  return overlapsNorthSouth || overlapsEastWest;
}

function boundsOverlapExistingRoadReserve(town, bounds, reserve = ROAD_RESERVE_HALF_WIDTH) {
  try {
    if (!town || !bounds) return false;
    const dimension = getDimensionFromId(town.dimensionId);
    const y = Math.floor((town.center?.y ?? 0) - 1);
    const minX = bounds.minX - reserve;
    const maxX = bounds.maxX + reserve;
    const minZ = bounds.minZ - reserve;
    const maxZ = bounds.maxZ + reserve;
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const block = dimension.getBlock({ x, y, z });
        if (block && block.typeId === DIRT_ROAD_ID) return true;
      }
    }
    return false;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Road Reserve Check", error);
    return true;
  }
}

function lotOverlapsAnyRoadReserve(town, bounds) {
  if (boundsOverlapPrimaryRoadReserve(town, expandBounds(bounds, ROAD_RESERVE_SCAN_BUFFER))) return true;
  if (boundsOverlapExistingRoadReserve(town, bounds, ROAD_RESERVE_HALF_WIDTH)) return true;
  return false;
}

function hasActiveAutoConstruction(town) {
  if (!town) return true;
  const jobs = getJobs(town);
  const activeJob = jobs.some(job => job && job.status !== "complete" && job.type !== "rebuild_boundary" && job.type !== "town_prep");
  if (activeJob) return true;
  return getLots(town).some(lot => {
    if (!lot || lot.isBuildLotRecorder) return false;
    if (lot.status === LOT_STATUS_REGISTERED || lot.status === LOT_STATUS_QUEUED || lot.status === LOT_STATUS_PREPARING || lot.status === LOT_STATUS_READY || lot.status === LOT_STATUS_BUILDING) return true;
    if (lot.status === LOT_STATUS_OCCUPIED && lot.roadStatus !== ROAD_STATUS_CONNECTED) return true;
    return false;
  });
}

function canAutoPlaceLotAt(town, marker, info, frontDirection) {
  if (!town || !marker || !info) return false;
  const backDirection = oppositeDirection(frontDirection);
  const bounds = getFrontMarkerLotBounds(marker, backDirection, info.halfSize, info.size - 1);
  if (!lotBoundsInsideBuildRadius(town, bounds)) return false;
  if (boundsOverlapInnerWallReserve(town, bounds)) return false;
  if (lotOverlapsAnyRoadReserve(town, bounds)) return false;
  if (boundsOverlapOrTooClose(bounds, getCenteredBounds(town.center, LOT_SMALL_HALF + 4), LOT_BUFFER + 2)) return false;
  for (const lot of getLots(town)) {
    const existingBounds = getLotBounds(lot);
    if (existingBounds && boundsOverlapOrTooClose(bounds, existingBounds, LOT_BUFFER + 2)) return false;
  }
  return true;
}

function getNearestLotDistance(town, marker) {
  let best = distance2D(marker, town.center ?? marker);
  for (const lot of getLots(town)) {
    if (!lot?.marker) continue;
    best = Math.min(best, distance2D(marker, lot.marker));
  }
  return best;
}

function scanNearestRoadDirection(town, marker, maxDistance = AUTO_PLACE_ROAD_SCAN_DISTANCE) {
  try {
    const dimension = getDimensionFromId(town.dimensionId);
    const dirs = [
      { name: "north", dx: 0, dz: -1 },
      { name: "south", dx: 0, dz: 1 },
      { name: "west", dx: -1, dz: 0 },
      { name: "east", dx: 1, dz: 0 }
    ];
    let best;
    for (const dir of dirs) {
      for (let d = 1; d <= maxDistance; d++) {
        for (let side = -2; side <= 2; side++) {
          const x = marker.x + dir.dx * d + (dir.dz !== 0 ? side : 0);
          const z = marker.z + dir.dz * d + (dir.dx !== 0 ? side : 0);
          const block = dimension.getBlock({ x, y: marker.y - 1, z });
          if (block && block.typeId === DIRT_ROAD_ID) {
            const score = d + Math.abs(side) * 0.25;
            if (!best || score < best.distance) best = { direction: dir.name, distance: score };
          }
        }
      }
    }
    return best;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Scan Nearest Road Direction", error);
    return undefined;
  }
}

function scoreAutoLotCandidate(town, marker, info, frontDirection, seedOffset = 0, roadOverride = undefined) {
  const center = town.center;
  const distCenter = distance2D(marker, center);
  const innerLimit = TOWN_BOUNDARY_RADIUS - INNER_WALL_RESERVE_HALF_WIDTH - info.halfSize - LOT_BUFFER;
  const insideInner = distCenter <= innerLimit;
  const nearestLot = getNearestLotDistance(town, marker);
  const road = roadOverride ?? scanNearestRoadDirection(town, marker, AUTO_PLACE_ROAD_SCAN_DISTANCE);
  let score = 0;

  // Prefer filling the fenced township before moving toward the edge.
  score += insideInner ? -8000 : 8000;
  // Prefer clustered growth near existing lots and the town center, not scattered edge builds.
  score += nearestLot * 18;
  score += distCenter * 0.65;
  // Prefer lots that can face an existing road.
  if (road) {
    score -= 1400;
    score += road.distance * 20;
    if (frontDirection === road.direction) score -= 700;
  } else {
    // Fallback should face the town center.
    if (frontDirection === directionTowardCenter(marker, center)) score -= 250;
  }
  // Deterministic tiny spread so candidates do not tie into one line.
  score += Math.abs(((marker.x * 31 + marker.z * 17 + seedOffset) % 23));
  return score;
}

function findAutoLotMarkerLocation(town, info, seedOffset = 0) {
  const center = town.center;
  if (!center) return undefined;
  const baseY = Math.floor(center.y);
  const candidates = [];
  for (const radius of AUTO_PLACE_RINGS) {
    for (let x = -radius; x <= radius; x += AUTO_PLACE_SEARCH_STEP) {
      candidates.push({ x: Math.floor(center.x) + x, y: baseY, z: Math.floor(center.z) - radius });
      candidates.push({ x: Math.floor(center.x) + x, y: baseY, z: Math.floor(center.z) + radius });
    }
    for (let z = -radius + AUTO_PLACE_SEARCH_STEP; z <= radius - AUTO_PLACE_SEARCH_STEP; z += AUTO_PLACE_SEARCH_STEP) {
      candidates.push({ x: Math.floor(center.x) - radius, y: baseY, z: Math.floor(center.z) + z });
      candidates.push({ x: Math.floor(center.x) + radius, y: baseY, z: Math.floor(center.z) + z });
    }
  }

  let best;
  const dirs = ["north", "south", "east", "west"];
  let checkedCandidates = 0;
  for (const marker of candidates) {
    checkedCandidates++;
    if (checkedCandidates > AUTO_PLACE_MAX_CANDIDATES_PER_SEARCH) break;
    const road = scanNearestRoadDirection(town, marker, AUTO_PLACE_ROAD_SCAN_DISTANCE);
    const preferredDirs = road ? [road.direction, ...dirs.filter(d => d !== road.direction)] : [directionTowardCenter(marker, center), ...dirs.filter(d => d !== directionTowardCenter(marker, center))];
    for (const frontDirection of preferredDirs) {
      if (!canAutoPlaceLotAt(town, marker, info, frontDirection)) continue;
      const score = scoreAutoLotCandidate(town, marker, info, frontDirection, seedOffset, road);
      if (!best || score < best.score) best = { marker, frontDirection, backDirection: oppositeDirection(frontDirection), score };
    }
  }
  return best;
}

function createAutoLot(town, typeId, seedOffset = 0) {
  try {
    const info = getLotSizeInfoFromMarker(typeId);
    const found = findAutoLotMarkerLocation(town, info, seedOffset);
    if (!found) return false;
    const dimension = getDimensionFromId(town.dimensionId);
    const block = dimension.getBlock(found.marker);
    if (!block) return false;
    if (block.typeId !== "minecraft:air" && !isLotMarkerType(block.typeId)) return false;
    block.setType(typeId);
    const lotId = `${town.id}_lot_${getLots(town).length + 1}`;
    const lot = {
      id: lotId,
      sizeName: info.sizeName,
      size: info.size,
      halfSize: info.halfSize,
      markerTypeId: typeId,
      anchorMode: "front",
      frontDirection: found.frontDirection,
      backDirection: found.backDirection,
      marker: { x: found.marker.x, y: found.marker.y, z: found.marker.z },
      buildingType: "empty",
      buildingLevel: 0,
      roadStatus: ROAD_STATUS_NOT_CONNECTED,
      assignedVillager: "none",
      locked: false,
      status: LOT_STATUS_REGISTERED,
      prepPhase: "not_started",
      autoPlaced: true
    };
    getLots(town).push(lot);
    queueLotPrep(town, lot);
    sendSystemMessage(`§aTownship auto-placed ${info.sizeName}: ${lot.id}`);
    return true;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Create Auto Lot", error);
    return false;
  }
}

function runAutoLotPlacement(town, force = false) {
  try {
    ensureTownAutomationDefaults(town);
    if (!town || town.autoPlaceLots !== true || town.builderPaused === true) return 0;
    if ((town.townPrepStatus ?? "") !== "complete") return 0;
    if (town.campStatus !== CAMP_JOB_STATUS_COMPLETE) return 0;
    if (!force && runtimeState.tickCounter < (town.nextAutoPlaceTick ?? 0)) return 0;
    // v1.0.52: never build an auto backlog. Auto placement waits until the current lot/build/road chain is fully done.
    if (hasActiveAutoConstruction(town)) {
      town.nextAutoPlaceTick = runtimeState.tickCounter + AUTO_PLACE_INTERVAL_TICKS;
      return 0;
    }
    const plans = [
      { typeId: LARGE_LOT_MARKER_ID, max: town.maxLargeLots ?? AUTO_PLACE_MAX_LARGE, sizeName: "Large Lot" },
      { typeId: MEDIUM_LOT_MARKER_ID, max: town.maxMediumLots ?? AUTO_PLACE_MAX_MEDIUM, sizeName: "Medium Lot" },
      { typeId: LOT_MARKER_ID, max: town.maxSmallLots ?? AUTO_PLACE_MAX_SMALL, sizeName: "Small Lot" }
    ];
    let placed = 0;
    for (const plan of plans) {
      if (placed >= AUTO_PLACE_MAX_PER_RUN) break;
      if (countLotsBySizeName(town, plan.sizeName) >= plan.max) continue;
      if (createAutoLot(town, plan.typeId, runtimeState.tickCounter + placed * 17 + getLots(town).length * 31)) placed++;
    }
    town.nextAutoPlaceTick = runtimeState.tickCounter + AUTO_PLACE_INTERVAL_TICKS;
    if (placed > 0) sendSystemMessage(`§eTownship auto lot placement added ${placed} lot(s).`);
    return placed;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Run Auto Lot Placement", error);
    return 0;
  }
}

function processLotJobs(town) {
  let changed = false;
  const jobs = getJobs(town);

  // Background township prep should not block normal lot/build/road work.
  // Earlier builds allowed the huge town-prep job to monopolize the queue, leaving lots queued or half-built.
  for (const job of jobs) {
    if (!job || job.status === "complete") continue;
    if (job.type === "town_prep") {
      const didWork = processTownPrepJob(town, job);
      if (didWork) changed = true;
      break;
    }
  }

  for (const job of jobs) {
    if (!job || job.status === "complete") continue;
    if (job.type === "rebuild_boundary") {
      const didWork = processBoundaryRebuildJob(town, job);
      if (didWork) changed = true;
      break;
    }
  }

  // Ground leveler is still allowed to take one work slice, but it no longer prevents lot work for the whole tick.
  for (const job of jobs) {
    if (!job || job.status === "complete") continue;
    if (job.type === "ground_leveler") {
      const didWork = processGroundLevelerJob(town, job);
      if (didWork) changed = true;
      break;
    }
  }

  // Process one normal construction job per tick batch so lot projects advance cleanly.
  for (const job of jobs) {
    if (!job || job.status === "complete") continue;
    if (job.type === "town_prep" || job.type === "ground_leveler" || job.type === "rebuild_boundary") continue;
    let didWork = false;
    if (job.type === "prepare_lot") didWork = processLotPrepJob(town, job);
    else if (job.type === "build_small_house") didWork = processSmallHouseJob(town, job);
    else if (job.type === "build_road") didWork = processRoadJob(town, job);
    if (didWork) {
      changed = true;
      break;
    }
  }

  town.jobs = jobs.filter(job => job && job.status !== "complete");
  return changed;
}

function processTowns() {
  try {
    const towns = getTowns();
    let changed = false;

    for (const town of towns) {
      if (!town) continue;
      ensureTownAutomationDefaults(town);
      if (town.builderStatus === "pending" && typeof town.builderSpawnTick === "number" && runtimeState.tickCounter >= town.builderSpawnTick) {
        const spawned = spawnBuilderForTown(town);
        if (!spawned && town.builderStatus === "spawn_error") {
          town.builderSpawnTick = runtimeState.tickCounter + 20 * 10;
          town.builderStatus = "pending";
        }
        changed = true;
      }


      if (town.builderStatus === "missing_founding_stone" && (town.townPrepStatus ?? "") === "complete") {
        const dimension = getDimensionFromId(town.dimensionId);
        ensureFoundingStoneBlock(town, dimension);
        town.builderStatus = "pending";
        town.builderSpawnTick = runtimeState.tickCounter + 20;
        changed = true;
      }

      const pendingTownPrep = getJobs(town).some(job => job && job.type === "town_prep" && job.status !== "complete");
      if (pendingTownPrep) {
        const jobs = getJobs(town);
        const prepJob = jobs.find(job => job && job.type === "town_prep" && job.status !== "complete");
        if (prepJob && processTownPrepJob(town, prepJob)) changed = true;
        town.jobs = jobs.filter(job => job && job.status !== "complete");
        continue;
      }

      if (town.builderPaused === true) {
        continue;
      }

      if (town.builderStatus === "present" && town.campStatus === CAMP_JOB_STATUS_PENDING) {
        queueStarterCamp(town);
        changed = true;
      }

      if (town.builderStatus === "present" && town.campStatus === CAMP_JOB_STATUS_BUILDING) {
        const campChanged = processStarterCamp(town);
        if (campChanged) changed = true;
      }

      if (town.builderStatus === "present" && town.campStatus === CAMP_JOB_STATUS_COMPLETE) {
        if (town.vanillaVillagersSpawned !== true) {
          try { spawnTwoVillageResidents(town, getDimensionFromId(town.dimensionId)); changed = true; } catch (residentError) { sendDebugLogError(ADDON_NAME, "Ensure Township Villagers", residentError); }
        }
        const autoPlaced = runAutoLotPlacement(town, false);
        if (autoPlaced) changed = true;
        const lotChanged = processLotJobs(town);
        if (lotChanged) changed = true;
      }
    }

    if (changed) saveTowns(towns);
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Process Towns", error);
  }
}



function getHeldItemTypeId(player) {
  try {
    // Current stable Script API path on most Bedrock builds.
    const equippable = player.getComponent?.("minecraft:equippable") ?? player.getComponent?.("equippable");
    if (equippable && typeof equippable.getEquipment === "function") {
      const possibleSlots = ["Mainhand", "mainhand", "main_hand", "MainHand"];
      for (const slot of possibleSlots) {
        try {
          const item = equippable.getEquipment(slot);
          if (item?.typeId) return item.typeId;
        } catch (slotError) {
          // Try the next slot spelling. Different examples/API versions use different enum paths.
        }
      }
    }
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Get Held Item Equippable", error);
  }

  try {
    // Fallback for older/current mobile builds where the selected hotbar index is readable.
    const inventory = player.getComponent?.("minecraft:inventory") ?? player.getComponent?.("inventory");
    const container = inventory?.container;
    const slotIndex = player.selectedSlotIndex;
    if (container && typeof slotIndex === "number" && typeof container.getItem === "function") {
      const item = container.getItem(slotIndex);
      if (item?.typeId) return item.typeId;
    }
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Get Held Item Inventory", error);
  }

  return undefined;
}

function isHoldingLotMarker(player) {
  return isLotMarkerType(getHeldItemTypeId(player));
}

function faceToOffset(face) {
  const value = String(face ?? "").toLowerCase();
  if (value.includes("up")) return { x: 0, y: 1, z: 0 };
  if (value.includes("down")) return { x: 0, y: -1, z: 0 };
  if (value.includes("north")) return { x: 0, y: 0, z: -1 };
  if (value.includes("south")) return { x: 0, y: 0, z: 1 };
  if (value.includes("east")) return { x: 1, y: 0, z: 0 };
  if (value.includes("west")) return { x: -1, y: 0, z: 0 };
  return { x: 0, y: 1, z: 0 };
}

function getPreviewPlacementLocation(player) {
  try {
    if (!player || typeof player.getBlockFromViewDirection !== "function") return undefined;
    const hit = player.getBlockFromViewDirection({ maxDistance: 8 });
    const block = hit?.block;
    if (!block) return undefined;
    const offset = faceToOffset(hit.face);
    return {
      x: Math.floor(block.location.x) + offset.x,
      y: Math.floor(block.location.y) + offset.y,
      z: Math.floor(block.location.z) + offset.z
    };
  } catch (error) {
    // Non-fatal. Existing-lot border preview can still run without placement preview.
    return undefined;
  }
}

function addBoundsParticlePositions(positions, bounds, y, step = 2) {
  if (!bounds) return;
  const minX = Math.floor(bounds.minX);
  const maxX = Math.floor(bounds.maxX);
  const minZ = Math.floor(bounds.minZ);
  const maxZ = Math.floor(bounds.maxZ);
  for (let x = minX; x <= maxX; x += step) {
    positions.push({ x: x + 0.5, y, z: minZ + 0.5 });
    positions.push({ x: x + 0.5, y, z: maxZ + 0.5 });
  }
  for (let z = minZ; z <= maxZ; z += step) {
    positions.push({ x: minX + 0.5, y, z: z + 0.5 });
    positions.push({ x: maxX + 0.5, y, z: z + 0.5 });
  }
  // Always include the exact corners.
  positions.push({ x: minX + 0.5, y, z: minZ + 0.5 });
  positions.push({ x: minX + 0.5, y, z: maxZ + 0.5 });
  positions.push({ x: maxX + 0.5, y, z: minZ + 0.5 });
  positions.push({ x: maxX + 0.5, y, z: maxZ + 0.5 });
}

function spawnPreviewParticle(dimension, location) {
  try {
    dimension.spawnParticle(LOT_PREVIEW_PARTICLE, location);
  } catch (error) {
    // Particle failures should not break the add-on. The most likely cause is a particle ID difference.
  }
}

function processLotBorderPreview() {
  try {
    if (runtimeState.tickCounter % LOT_PREVIEW_INTERVAL_TICKS !== 0) return;

    for (const player of world.getPlayers()) {
      try {
        if (!player || !player.dimension || !isHoldingLotMarker(player)) continue;
        const town = findTownContainingLocation(player.location, player.dimension.id);
        if (!town) continue;

        const positions = [];
        const py = Math.floor(player.location.y) + 1.15;

        // Show registered lot borders near the player while holding the Lot Marker.
        for (const lot of getLots(town)) {
          if (!lot?.marker) continue;
          if (distance2D(player.location, lot.marker) > LOT_PREVIEW_RADIUS) continue;
          addBoundsParticlePositions(positions, getLotBounds(lot), py, 2);
        }

        // Show a candidate 11x11 directional lot where the player is looking, if the raycast is available.
        const placement = getPreviewPlacementLocation(player);
        if (placement) {
          const facing = getPlacementFacing(player);
          const info = getLotSizeInfoFromMarker(heldItem);
          const candidateBounds = getFrontMarkerLotBounds(placement, facing.backDirection, info.halfSize, info.size - 1);
          addBoundsParticlePositions(positions, candidateBounds, placement.y + 1.35, 1);
        }

        let count = 0;
        for (const position of positions) {
          if (count >= LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER) break;
          spawnPreviewParticle(player.dimension, position);
          count++;
        }
      } catch (innerError) {
        sendDebugLogError(ADDON_NAME, "Lot Border Preview Player", innerError);
      }
    }
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Lot Border Preview", error);
  }
}





function buildLotKey(location, dimensionId) {
  if (!location) return "unknown";
  return `${dimensionId ?? "minecraft:overworld"}:${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
}

function getBuildLotByBlock(block) {
  try {
    if (!block) return undefined;
    const found = getLotAtBlock(block.location, block.dimension.id);
    if (!found || !found.lot || !found.lot.isBuildLotRecorder) return undefined;
    return found;
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Get Build Lot By Block", error);
    return undefined;
  }
}

function defaultBuildLotName(lot) {
  const size = (lot?.recorderSizeName ?? "small").toLowerCase();
  return `custom_${size}_${safeLocationKey(lot?.marker ?? { x: 0, y: 0, z: 0 })}`;
}

function ensureBuildLotSettings(lot) {
  if (!lot) return;
  if (!lot.buildName) lot.buildName = defaultBuildLotName(lot);
  if (typeof lot.captureDown !== "number") lot.captureDown = 1;
  if (typeof lot.captureUp !== "number") lot.captureUp = 12;
  if (typeof lot.includeNaturalBlocks !== "boolean") lot.includeNaturalBlocks = false;
}

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
    sendDebugLogError(ADDON_NAME, "Register Build Lot", error);
    messagePlayer(player, "§cTownship error while registering Build Lot. Check content log.");
  }
}

function getBuildLotCaptureBox(lot) {
  ensureBuildLotSettings(lot);
  const down = Math.max(0, Math.min(32, Math.floor(lot.captureDown ?? 1)));
  const up = Math.max(1, Math.min(64, Math.floor(lot.captureUp ?? 12)));
  return { down, up, minDy: -down, maxDy: up };
}

function getBlockPermutationStates(block) {
  try {
    const perm = block?.permutation;
    if (!perm) return undefined;
    if (typeof perm.getAllStates === "function") {
      const states = perm.getAllStates();
      if (states && typeof states === "object") return states;
    }
  } catch (error) {
    // State export is best-effort. Do not make capture fail if a permutation state cannot be read.
  }
  return undefined;
}

function shouldSkipBuildLotCaptureBlock(block, lot) {
  if (!block) return true;
  if (block.typeId === "minecraft:air") return true;
  if (isBuildLotRecorderType(block.typeId)) return true;
  if (!(lot?.includeNaturalBlocks ?? false) && NATURAL_CAPTURE_SKIP_BLOCKS.has(block.typeId)) return true;
  // Do not export the blank lot border. The Township lot system already creates the border.
  if (block.typeId === "minecraft:oak_fence" || block.typeId === "minecraft:oak_fence_gate") {
    const bounds = getLotBounds(lot);
    if (bounds) {
      const x = Math.floor(block.location.x);
      const z = Math.floor(block.location.z);
      if (x === bounds.minX || x === bounds.maxX || z === bounds.minZ || z === bounds.maxZ) return true;
    }
  }
  return false;
}

function captureBuildLot(block, player) {
  try {
    const found = getBuildLotByBlock(block);
    if (!found) {
      messagePlayer(player, "§cNo Build Lot record found for this block.");
      return;
    }
    const { town, lot } = found;
    ensureBuildLotSettings(lot);
    const box = getBuildLotCaptureBox(lot);
    const marker = lot.marker;
    const yBase = Math.floor(marker.y) - 1;
    const depth = lot.size - 1;
    const records = [];

    for (let lx = -lot.halfSize; lx <= lot.halfSize; lx++) {
      for (let lb = 0; lb <= depth; lb++) {
        const p = transformFromBackAnchor(marker, lot.backDirection, lx, lb);
        for (let dy = box.minDy; dy <= box.maxDy; dy++) {
          const b = block.dimension.getBlock({ x: p.x, y: yBase + dy, z: p.z });
          if (shouldSkipBuildLotCaptureBlock(b, lot)) continue;
          const entry = { x: lx, y: dy, z: lb, block: b.typeId };
          const states = getBlockPermutationStates(b);
          if (states) entry.states = states;
          records.push(entry);
        }
      }
    }

    const capture = {
      export_version: 1,
      capturedAt: Date.now(),
      building_id: lot.buildName,
      lot_size: lot.recorderSizeName ?? "small",
      lot_blocks: `${lot.size}x${lot.size}`,
      front: lot.frontDirection,
      back: lot.backDirection,
      capture_down: box.down,
      capture_up: box.up,
      include_natural_blocks: !!lot.includeNaturalBlocks,
      base_y: yBase,
      marker: { x: marker.x, y: marker.y, z: marker.z },
      block_count: records.length,
      blocks: records
    };

    const key = buildLotKey(marker, town.dimensionId);
    capture.key = key;
    const list = getRecorderList().filter(c => c && c.key !== key);
    list.push(capture);
    saveRecorderList(list);
    lot.savedCaptureKey = key;
    lot.savedBlockCount = records.length;
    saveTowns(getTowns());
    messagePlayer(player, `§aSaved Build Lot '${lot.buildName}' with ${records.length} blocks. Use Export Saved Build to copy it.`);
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Capture Build Lot", error);
    messagePlayer(player, "§cBuild Lot save failed. Check content log.");
  }
}

function getSavedCaptureForLot(lot, dimensionId) {
  if (!lot || !lot.marker) return undefined;
  const key = lot.savedCaptureKey ?? buildLotKey(lot.marker, dimensionId);
  return getRecorderList().find(c => c && c.key === key);
}

function sendExportChunkToDebug(player, capture, index, total, chunk) {
  try {
    const dimension = player?.dimension ?? world.getDimension("overworld");
    const safe = String(chunk).replace(/[\r\n|]/g, " ").slice(0, 720);
    dimension.runCommand(`scriptevent debuglog:error ${ADDON_NAME} | Build Export ${capture.building_id} ${index + 1}/${total} | ${safe}`);
  } catch (error) {
    // Debug export is best-effort. Chat export still happens.
  }
}

function exportBuildLot(block, player) {
  try {
    const found = getBuildLotByBlock(block);
    if (!found) {
      messagePlayer(player, "§cNo Build Lot record found for this block.");
      return;
    }
    const capture = getSavedCaptureForLot(found.lot, found.town.dimensionId);
    if (!capture) {
      messagePlayer(player, "§cNo saved build found for this Build Lot. Press Save Build first.");
      return;
    }
    const text = JSON.stringify(capture);
    const chunkSize = 520;
    const total = Math.max(1, Math.ceil(text.length / chunkSize));
    messagePlayer(player, `§6--- Township Build Export: ${capture.building_id} (${capture.block_count ?? capture.blocks?.length ?? 0} blocks, ${total} chunks) ---`);
    for (let i = 0; i < total; i++) {
      const chunk = text.slice(i * chunkSize, (i + 1) * chunkSize);
      const header = `TOWNSHIP_BUILD_EXPORT name=${capture.building_id} lot_size=${capture.lot_size} chunk=${i + 1}/${total}`;
      messagePlayer(player, `§e${header}`);
      messagePlayer(player, `§f${chunk}`);
      sendExportChunkToDebug(player, capture, i, total, `${header} ${chunk}`);
    }
    messagePlayer(player, "§aExport sent in chat chunks. Each chunk includes the build name and chunk number.");
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Export Build Lot", error);
    messagePlayer(player, "§cBuild Lot export failed. Check content log.");
  }
}

function clearSavedBuildLotCapture(block, player) {
  try {
    const found = getBuildLotByBlock(block);
    if (!found) {
      messagePlayer(player, "§cNo Build Lot record found for this block.");
      return;
    }
    const key = found.lot.savedCaptureKey ?? buildLotKey(found.lot.marker, found.town.dimensionId);
    saveRecorderList(getRecorderList().filter(c => c && c.key !== key));
    delete found.lot.savedCaptureKey;
    delete found.lot.savedBlockCount;
    saveTowns(getTowns());
    messagePlayer(player, "§eSaved Build Lot capture cleared. The physical build was not changed.");
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Clear Saved Build Lot", error);
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
          const b = block.dimension.getBlock({ x, y, z });
          if (!b) continue;
          if (y === yBase) {
            if (b.typeId !== "minecraft:dirt") { b.setType("minecraft:dirt"); restoredFloor++; }
          } else if (b.typeId !== "minecraft:air") {
            b.setType("minecraft:air");
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

function showBuildLotSettingsForm(block, player) {
  try {
    const found = getBuildLotByBlock(block);
    if (!found) {
      messagePlayer(player, "§cNo Build Lot record found for this block.");
      return;
    }
    const lot = found.lot;
    ensureBuildLotSettings(lot);
    const form = new ModalFormData()
      .title("Build Lot Settings")
      .textField("Build name", "small_blacksmith_01", lot.buildName)
      .textField("Capture down range", "1", String(lot.captureDown))
      .textField("Capture up range", "12", String(lot.captureUp))
      .toggle("Include natural blocks", !!lot.includeNaturalBlocks);
    form.show(player).then(response => {
      if (response.canceled) return;
      const values = response.formValues ?? [];
      const name = String(values[0] ?? lot.buildName).trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_\-]/g, "");
      const down = Math.max(0, Math.min(32, parseInt(values[1] ?? lot.captureDown, 10) || 0));
      const up = Math.max(1, Math.min(64, parseInt(values[2] ?? lot.captureUp, 10) || 12));
      const includeNatural = !!values[3];
      lot.buildName = name || defaultBuildLotName(lot);
      lot.captureDown = down;
      lot.captureUp = up;
      lot.includeNaturalBlocks = includeNatural;
      saveTowns(getTowns());
      messagePlayer(player, `§aBuild Lot settings saved. Name: ${lot.buildName}, Down: ${down}, Up: ${up}, Natural Blocks: ${includeNatural ? "Include" : "Ignore"}`);
    }).catch(error => sendDebugLogError(ADDON_NAME, "Build Lot Settings UI", error));
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Show Build Lot Settings", error);
  }
}

function getBuildLotInfoText(town, lot) {
  ensureBuildLotSettings(lot);
  return [
    "§6--- Township Build Lot ---",
    `§eName: §f${lot.buildName}`,
    `§eLot ID: §f${lot.id}`,
    `§eSize: §f${lot.sizeName} (${lot.size}x${lot.size})`,
    `§eFacing: §f${lot.frontDirection}`,
    `§eCapture Down: §f${lot.captureDown}`,
    `§eCapture Up: §f${lot.captureUp}`,
    `§eNatural Blocks: §f${lot.includeNaturalBlocks ? "Include" : "Ignore"}`,
    `§eSaved Blocks: §f${lot.savedBlockCount ?? "none"}`,
    `§eStatus: §f${lot.status}`,
    "§7Build inside the fenced lot, save it, then export the chunks here."
  ].join("\n");
}

function showBuildLotMenu(block, player) {
  try {
    const found = getBuildLotByBlock(block);
    if (!found) {
      messagePlayer(player, "§cThis Build Lot is not registered yet. Break and replace it inside a township if needed.");
      return;
    }
    const { town, lot } = found;
    ensureBuildLotSettings(lot);
    const form = new ActionFormData()
      .title("Township Build Lot")
      .body(getBuildLotInfoText(town, lot))
      .button("Set Name / Capture Settings")
      .button(`Natural Blocks: ${lot.includeNaturalBlocks ? "Include" : "Ignore"}`)
      .button("Save Build")
      .button("Export Saved Build")
      .button("Clear Saved Build")
      .button("Clear Physical Lot")
      .button("Show Lot Info");
    form.show(player).then(response => {
      if (response.canceled) return;
      if (response.selection === 0) showBuildLotSettingsForm(block, player);
      else if (response.selection === 1) {
        lot.includeNaturalBlocks = !lot.includeNaturalBlocks;
        saveTowns(getTowns());
        messagePlayer(player, `§aNatural Blocks now: ${lot.includeNaturalBlocks ? "Include" : "Ignore"}`);
        system.run(() => showBuildLotMenu(block, player));
      }
      else if (response.selection === 2) captureBuildLot(block, player);
      else if (response.selection === 3) exportBuildLot(block, player);
      else if (response.selection === 4) clearSavedBuildLotCapture(block, player);
      else if (response.selection === 5) clearPhysicalBuildLot(block, player);
      else if (response.selection === 6) messagePlayer(player, getBuildLotInfoText(town, lot));
    }).catch(error => sendDebugLogError(ADDON_NAME, "Build Lot UI", error));
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Show Build Lot Menu", error);
    messagePlayer(player, "§cBuild Lot UI failed. Check content log.");
  }
}

function getRecorderList() {
  if (runtimeState.memoryBuildRecorderCaptures.length > 0) return runtimeState.memoryBuildRecorderCaptures;
  try {
    const raw = world.getDynamicProperty(BUILD_RECORDER_PROPERTY);
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) { runtimeState.memoryBuildRecorderCaptures = parsed; return parsed; }
    }
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Load Build Recorder Data", error);
  }
  return [];
}

function saveRecorderList(records) {
  runtimeState.memoryBuildRecorderCaptures = records.slice(-10);
  try {
    world.setDynamicProperty(BUILD_RECORDER_PROPERTY, JSON.stringify(runtimeState.memoryBuildRecorderCaptures));
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Save Build Recorder Data", error);
  }
}

function registerBuildRecorderFromBlock(block, player) {
  try {
    if (!block || block.typeId !== BUILD_RECORDER_ID) return;
    const town = findTownContainingLocation(block.location, block.dimension.id);
    if (!town) {
      clearBlock(block);
      messagePlayer(player, "§cTownship Build Recorder rejected: place it inside the township radius.");
      return;
    }
    const facing = getPlacementFacing(player);
    messagePlayer(player, `§aTownship Build Recorder placed. Front: ${facing.frontDirection}. Crouch near it or tap it to open capture options.`);
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Register Build Recorder", error);
  }
}

function getRecorderLotInfo(sizeName) {
  if (sizeName === "medium") return { sizeName: "medium", size: LOT_MEDIUM_SIZE, halfSize: LOT_MEDIUM_HALF };
  if (sizeName === "large") return { sizeName: "large", size: LOT_LARGE_SIZE, halfSize: LOT_LARGE_HALF };
  return { sizeName: "small", size: LOT_SMALL_SIZE, halfSize: LOT_SMALL_HALF };
}

function captureBuildRecorderLot(block, player, sizeName) {
  try {
    const info = getRecorderLotInfo(sizeName);
    const facing = getPlacementFacing(player);
    const marker = block.location;
    const y0 = Math.floor(marker.y) - 1;
    const depth = info.size - 1;
    const records = [];
    for (let lx = -info.halfSize; lx <= info.halfSize; lx++) {
      for (let lb = 0; lb <= depth; lb++) {
        for (let dy = 0; dy <= 12; dy++) {
          const p = transformFromBackAnchor(marker, facing.backDirection, lx, lb);
          const b = block.dimension.getBlock({ x: p.x, y: y0 + dy, z: p.z });
          if (!b || b.typeId === "minecraft:air" || b.typeId === BUILD_RECORDER_ID || isBuildLotRecorderType(b.typeId)) continue;
          const entry = { x: lx, y: dy, z: lb, block: b.typeId };
          const states = getBlockPermutationStates(b);
          if (states) entry.states = states;
          records.push(entry);
        }
      }
    }
    const capture = {
      capturedAt: Date.now(),
      building_id: `custom_${info.sizeName}_${safeLocationKey(marker)}`,
      lot_size: info.sizeName,
      lot_blocks: `${info.size}x${info.size}`,
      front: facing.frontDirection,
      back: facing.backDirection,
      marker: { x: marker.x, y: marker.y, z: marker.z },
      blocks: records
    };
    const list = getRecorderList();
    list.push(capture);
    saveRecorderList(list);
    messagePlayer(player, `§aTownship Build Recorder saved ${records.length} blocks for ${info.sizeName} lot. Use Export Build Data to copy it in chunks.`);
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Capture Build Recorder Lot", error);
    messagePlayer(player, "§cBuild Recorder capture failed. Check content log.");
  }
}

function exportLastBuildRecorderCapture(player) {
  try {
    const list = getRecorderList();
    if (list.length === 0) {
      messagePlayer(player, "§cNo Township Build Recorder capture is saved yet.");
      return;
    }
    const capture = list[list.length - 1];
    const text = JSON.stringify(capture);
    const chunkSize = 850;
    const total = Math.ceil(text.length / chunkSize);
    messagePlayer(player, `§6--- Township Build Recorder Export: ${capture.building_id} (${capture.blocks?.length ?? 0} blocks, ${total} chunks) ---`);
    for (let i = 0; i < total; i++) {
      messagePlayer(player, `§e[${i + 1}/${total}] §f${text.slice(i * chunkSize, (i + 1) * chunkSize)}`);
    }
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Export Build Recorder", error);
  }
}

function clearBuildRecorderCaptures(player) {
  saveRecorderList([]);
  messagePlayer(player, "§eTownship Build Recorder captures cleared.");
}

function previewBuildRecorderArea(block, player, sizeName) {
  try {
    const info = getRecorderLotInfo(sizeName);
    const facing = getPlacementFacing(player);
    const bounds = getFrontMarkerLotBounds(block.location, facing.backDirection, info.halfSize, info.size - 1);
    const positions = [];
    addBoundsParticlePositions(positions, bounds, Math.floor(block.location.y) + 1.35, 1);
    let count = 0;
    for (const pos of positions) {
      if (count > LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER) break;
      spawnPreviewParticle(block.dimension, pos);
      count++;
    }
    messagePlayer(player, `§ePreviewed ${info.sizeName} capture area using particles.`);
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Preview Build Recorder Area", error);
  }
}

function showBuildRecorderMenu(block, player) {
  try {
    if (!block || block.typeId !== BUILD_RECORDER_ID) return;
    const form = new ActionFormData()
      .title("Township Build Recorder")
      .body("Build by hand behind this recorder, then capture the lot. Export the saved data and paste it back here so it can be converted into a real Township building template.")
      .button("Save Small Lot")
      .button("Save Medium Lot")
      .button("Save Large Lot")
      .button("Preview Small Area")
      .button("Preview Medium Area")
      .button("Preview Large Area")
      .button("Export Build Data")
      .button("Clear Saved Capture");
    form.show(player).then((response) => {
      if (response.canceled) return;
      if (response.selection === 0) captureBuildRecorderLot(block, player, "small");
      else if (response.selection === 1) captureBuildRecorderLot(block, player, "medium");
      else if (response.selection === 2) captureBuildRecorderLot(block, player, "large");
      else if (response.selection === 3) previewBuildRecorderArea(block, player, "small");
      else if (response.selection === 4) previewBuildRecorderArea(block, player, "medium");
      else if (response.selection === 5) previewBuildRecorderArea(block, player, "large");
      else if (response.selection === 6) exportLastBuildRecorderCapture(player);
      else if (response.selection === 7) clearBuildRecorderCaptures(player);
    }).catch((error) => sendDebugLogError(ADDON_NAME, "Build Recorder UI", error));
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Show Build Recorder Menu", error);
    messagePlayer(player, "§cBuild Recorder UI failed. Check content log.");
  }
}

// Custom block component path: preferred clickable-block path for all Township UI blocks.
// The component names in block JSON must exactly match these registered names.
function openTownshipBlockUiFromBlock(block, player) {
  try {
    if (!block || !player) return;

    if (block.typeId === FOUNDING_STONE_ID) {
      showTownStatusFromBlock(block, player);
    } else if (isBuildLotRecorderType(block.typeId)) {
      showBuildLotMenu(block, player);
    } else if (isLotMarkerType(block.typeId)) {
      showLotMarkerMenu(block, player);
    } else if (block.typeId === GROUND_LEVELER_ID) {
      showGroundLevelerMenu(block, player);
    } else if (block.typeId === BUILD_RECORDER_ID) {
      showBuildRecorderMenu(block, player);
    }
  } catch (error) {
    sendDebugLogError(ADDON_NAME, "Open Township Block UI", error);
  }
}

try {
  system.beforeEvents.startup.subscribe((event) => {
    registerBlockInteractionComponents(
      event,
      openTownshipBlockUiFromBlock,
      (systemName, error) => sendDebugLogError(ADDON_NAME, systemName, error)
    );
  });
} catch (error) {
  sendDebugLogError(ADDON_NAME, "Subscribe startup block components", error);
}


// Primary stable path: global player-place event.
try {
  world.afterEvents.playerPlaceBlock.subscribe((event) => {
    try {
      const block = event.block;
      if (block && block.typeId === FOUNDING_STONE_ID) registerTownFromBlock(block, event.player);
      else if (block && isBuildLotRecorderType(block.typeId)) registerBuildLotFromBlock(block, event.player);
      else if (block && isLotMarkerType(block.typeId)) registerLotMarkerFromBlock(block, event.player);
      else if (block && block.typeId === GROUND_LEVELER_ID) registerGroundLevelerFromBlock(block, event.player);
      else if (block && block.typeId === BUILD_RECORDER_ID) registerBuildRecorderFromBlock(block, event.player);
    } catch (error) {
      sendDebugLogError(ADDON_NAME, "Global Place Event", error);
    }
  });
} catch (error) {
  sendDebugLogError(ADDON_NAME, "Subscribe playerPlaceBlock", error);
}

try {
  world.afterEvents.playerBreakBlock.subscribe((event) => {
    try {
      const typeId = event.brokenBlockPermutation?.type?.id ?? event.brokenBlockPermutation?.typeId;
      if (typeId === FOUNDING_STONE_ID) cleanupTownAt(event.block.location, event.dimension.id, event.player);
      else if (isLotMarkerType(typeId)) cleanupLotAt(event.block.location, event.dimension.id, event.player);
      else if (typeId === BUILD_RECORDER_ID) {
        messagePlayer(event.player, "§eTownship Build Recorder removed.");
      }
      else if (typeId === GROUND_LEVELER_ID) {
        for (const town of getTowns()) {
          if (!town || town.dimensionId !== event.dimension.id) continue;
          town.jobs = getJobs(town).filter(job => !(job.type === "ground_leveler" && job.location && job.location.x === event.block.location.x && job.location.y === event.block.location.y && job.location.z === event.block.location.z));
        }
        saveTowns(getTowns());
        messagePlayer(event.player, "§eTownship Ground Leveler job removed.");
      }
    } catch (error) {
      sendDebugLogError(ADDON_NAME, "Global Break Event", error);
    }
  });
} catch (error) {
  sendDebugLogError(ADDON_NAME, "Subscribe playerBreakBlock", error);
}

try {
  world.afterEvents.playerSpawn.subscribe((event) => {
    try {
      const player = event.player;
      if (!player || runtimeState.scriptLoadedAnnounced.has(player.id)) return;
      runtimeState.scriptLoadedAnnounced.add(player.id);
      system.runTimeout(() => {
        messagePlayer(player, `§7Township script loaded v${VERSION}.`);
      }, 5);
    } catch (error) {
      sendDebugLogError(ADDON_NAME, "Player Spawn Message", error);
    }
  });
} catch (error) {
  sendDebugLogError(ADDON_NAME, "Subscribe playerSpawn", error);
}

system.runTimeout(() => {
  loadTowns();
  sendSystemMessage(`§7Township script initialized v${VERSION}.`);
}, 1);

system.runInterval(() => {
  runtimeState.tickCounter += 5;
  processTowns();
  processLotBorderPreview();
}, 5);
