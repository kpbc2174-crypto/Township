import { world } from "@minecraft/server";
import { sendDebugLogError } from "../shared/debug_log_bridge.js";
import { ADDON_NAME } from "./version.js";
import {
  BUILD_LOT_MARKER_IDS,
  LOT_MARKER_IDS,
  MEDIUM_LOT_MARKER_ID,
  MEDIUM_BUILD_LOT_ID,
  LARGE_LOT_MARKER_ID,
  LARGE_BUILD_LOT_ID,
  LOT_MEDIUM_SIZE,
  LOT_MEDIUM_HALF,
  LOT_LARGE_SIZE,
  LOT_LARGE_HALF,
  LOT_SMALL_SIZE,
  LOT_SMALL_HALF,
  CLAIM_RADIUS,
  MIN_TOWN_DISTANCE,
  STARTING_BUILD_RADIUS,
  AUTO_PLACE_MAX_SMALL,
  AUTO_PLACE_MAX_MEDIUM,
  AUTO_PLACE_MAX_LARGE,
  AUTO_PLACE_INTERVAL_TICKS,
  LOT_BUFFER,
  TOWNS_PROPERTY
} from "./constants.js";

export const runtimeState = {
  tickCounter: 0,
  scriptLoadedAnnounced: new Set(),
  memoryTowns: [],
  memoryBuildRecorderCaptures: []
};

function townTag(id) { return `township_id_${id}`; }
function safeLocationKey(location) { return `${Math.floor(location.x)}_${Math.floor(location.y)}_${Math.floor(location.z)}`.replace(/-/g, "m"); }
function distance2D(a, b) { const dx = a.x - b.x; const dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }
function oppositeDirection(direction) {
  if (direction === "north") return "south";
  if (direction === "south") return "north";
  if (direction === "east") return "west";
  if (direction === "west") return "east";
  return "south";
}
function directionVector(direction) {
  if (direction === "north") return { dx: 0, dz: -1 };
  if (direction === "south") return { dx: 0, dz: 1 };
  if (direction === "east") return { dx: 1, dz: 0 };
  if (direction === "west") return { dx: -1, dz: 0 };
  return { dx: 0, dz: 1 };
}
function directionFromPlayerView(player) {
  try {
    if (player && typeof player.getViewDirection === "function") {
      const view = player.getViewDirection();
      if (view && typeof view.x === "number" && typeof view.z === "number") {
        if (Math.abs(view.x) > Math.abs(view.z)) return view.x > 0 ? "east" : "west";
        return view.z > 0 ? "south" : "north";
      }
    }
  } catch (error) { sendDebugLogError(ADDON_NAME, "Player View Direction", error); }
  try {
    if (player && typeof player.getRotation === "function") {
      const yaw = player.getRotation().y;
      if (yaw >= -45 && yaw < 45) return "south";
      if (yaw >= 45 && yaw < 135) return "west";
      if (yaw >= -135 && yaw < -45) return "east";
      return "north";
    }
  } catch (error) { sendDebugLogError(ADDON_NAME, "Player Rotation Direction", error); }
  return "north";
}
function getPlacementFacing(player) { const playerFacing = directionFromPlayerView(player); return { frontDirection: oppositeDirection(playerFacing), backDirection: playerFacing }; }
function isBuildLotRecorderType(typeId) { return BUILD_LOT_MARKER_IDS.includes(typeId); }
function isLotMarkerType(typeId) { return LOT_MARKER_IDS.includes(typeId); }
function getLotSizeInfoFromMarker(typeId) {
  if (typeId === MEDIUM_LOT_MARKER_ID || typeId === MEDIUM_BUILD_LOT_ID) return { sizeName: "Medium Lot", size: LOT_MEDIUM_SIZE, halfSize: LOT_MEDIUM_HALF, recorderSizeName: "medium" };
  if (typeId === LARGE_LOT_MARKER_ID || typeId === LARGE_BUILD_LOT_ID) return { sizeName: "Large Lot", size: LOT_LARGE_SIZE, halfSize: LOT_LARGE_HALF, recorderSizeName: "large" };
  return { sizeName: "Small Lot", size: LOT_SMALL_SIZE, halfSize: LOT_SMALL_HALF, recorderSizeName: "small" };
}
function directionStateNumber(direction) { if (direction === "south") return 0; if (direction === "west") return 1; if (direction === "north") return 2; if (direction === "east") return 3; return 0; }
function addBlockEntry(plan, phase, x, y, z, typeId, states = undefined) { const entry = { phase, x, y, z, typeId }; if (states) entry.states = states; plan.push(entry); }
function getRightVector(backDirection) { const back = directionVector(backDirection); return { dx: -back.dz, dz: back.dx }; }
function transformFromBackAnchor(anchor, backDirection, lx, lb) { const back = directionVector(backDirection); const right = getRightVector(backDirection); return { x: Math.floor(anchor.x) + right.dx * lx + back.dx * lb, z: Math.floor(anchor.z) + right.dz * lx + back.dz * lb }; }
function transformTownLocal(center, frontDirection, lx, lz) { const front = directionVector(frontDirection ?? "south"); const right = { dx: front.dz, dz: -front.dx }; return { x: Math.floor(center.x) + right.dx * lx + front.dx * lz, z: Math.floor(center.z) + right.dz * lx + front.dz * lz }; }
function sendSystemMessage(text) { try { world.sendMessage(text); } catch {} }
function messagePlayer(player, text) { try { if (player && typeof player.sendMessage === "function") player.sendMessage(text); else sendSystemMessage(text); } catch (error) { sendDebugLogError(ADDON_NAME, "Message", error); } }
function normalizeTownData(town) { if (!town) return town; town.claimRadius = CLAIM_RADIUS; town.buildRadius = STARTING_BUILD_RADIUS; for (const lot of getLots(town)) { if (!lot.anchorMode) lot.anchorMode = "front"; if (!lot.frontDirection) lot.frontDirection = "south"; if (!lot.backDirection) lot.backDirection = oppositeDirection(lot.frontDirection); } return town; }
function loadTowns() { try { const raw = world.getDynamicProperty(TOWNS_PROPERTY); if (typeof raw === "string") { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) { runtimeState.memoryTowns = parsed.map(normalizeTownData); saveTowns(runtimeState.memoryTowns); return; } } } catch (error) { sendDebugLogError(ADDON_NAME, "Load Towns", error); } }
function getTowns() { return runtimeState.memoryTowns; }
function saveTowns(towns) { runtimeState.memoryTowns = towns; try { world.setDynamicProperty(TOWNS_PROPERTY, JSON.stringify(towns)); } catch (error) { sendDebugLogError(ADDON_NAME, "Save Towns", error); } }
function findNearbyTown(location, dimensionId, exceptId = undefined) { for (const town of getTowns()) { if (!town || town.id === exceptId || town.dimensionId !== dimensionId) continue; const d = distance2D(location, town.center); if (d < MIN_TOWN_DISTANCE) return { town, distance: d }; } return undefined; }
function getTownAtBlock(location, dimensionId) { return getTowns().find(t => t.dimensionId === dimensionId && t.center.x === location.x && t.center.y === location.y && t.center.z === location.z); }
function findTownContainingLocation(location, dimensionId) { let best; let bestDistance = 999999; for (const town of getTowns()) { if (!town || town.dimensionId !== dimensionId) continue; const d = distance2D(location, town.center); const buildRadius = town.buildRadius ?? STARTING_BUILD_RADIUS; if (d <= buildRadius && d < bestDistance) { best = town; bestDistance = d; } } return best; }
function boundsOverlapOrTooClose(a, b, buffer = LOT_BUFFER) { return !(a.maxX + buffer < b.minX || b.maxX + buffer < a.minX || a.maxZ + buffer < b.minZ || b.maxZ + buffer < a.minZ); }
function getCenteredBounds(center, half = LOT_SMALL_HALF) { const x = Math.floor(center.x); const z = Math.floor(center.z); return { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half }; }
function getFrontMarkerLotBounds(marker, backDirection, half = LOT_SMALL_HALF, depth = LOT_SMALL_SIZE - 1) { const points = []; for (const lx of [-half, half]) for (const lb of [0, depth]) points.push(transformFromBackAnchor(marker, backDirection ?? "north", lx, lb)); return { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) }; }
function getLotBounds(lot) { if (!lot || !lot.marker) return undefined; if (lot.anchorMode === "front") return getFrontMarkerLotBounds(lot.marker, lot.backDirection ?? "north", lot.halfSize ?? LOT_SMALL_HALF, (lot.size ?? LOT_SMALL_SIZE) - 1); return getCenteredBounds(lot.marker, lot.halfSize ?? LOT_SMALL_HALF); }
function getLots(town) { if (!town.lots || !Array.isArray(town.lots)) town.lots = []; return town.lots; }
function getJobs(town) { if (!town.jobs || !Array.isArray(town.jobs)) town.jobs = []; return town.jobs; }
function ensureTownAutomationDefaults(town) { if (!town) return; if (typeof town.autoBuildLots !== "boolean") town.autoBuildLots = true; if (typeof town.autoRoads !== "boolean") town.autoRoads = true; if (typeof town.autoPlaceLots !== "boolean") town.autoPlaceLots = false; if (typeof town.maxSmallLots !== "number") town.maxSmallLots = AUTO_PLACE_MAX_SMALL; if (typeof town.maxMediumLots !== "number") town.maxMediumLots = AUTO_PLACE_MAX_MEDIUM; if (typeof town.maxLargeLots !== "number") town.maxLargeLots = AUTO_PLACE_MAX_LARGE; if (typeof town.nextAutoPlaceTick !== "number") town.nextAutoPlaceTick = runtimeState.tickCounter + AUTO_PLACE_INTERVAL_TICKS; if (typeof town.builderPaused !== "boolean") town.builderPaused = false; }
function getLotById(town, lotId) { return getLots(town).find(lot => lot && lot.id === lotId); }
function hashStringNumber(text) { let hash = 0; const value = String(text ?? ""); for (let i = 0; i < value.length; i++) { hash = ((hash << 5) - hash) + value.charCodeAt(i); hash |= 0; } return Math.abs(hash); }
function pointInsideBounds(x, z, bounds) { if (!bounds) return false; return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ; }

export { townTag, safeLocationKey, distance2D, oppositeDirection, directionVector, directionFromPlayerView, getPlacementFacing, isBuildLotRecorderType, isLotMarkerType, getLotSizeInfoFromMarker, directionStateNumber, addBlockEntry, getRightVector, transformFromBackAnchor, transformTownLocal, sendSystemMessage, messagePlayer, normalizeTownData, loadTowns, getTowns, saveTowns, findNearbyTown, getTownAtBlock, findTownContainingLocation, boundsOverlapOrTooClose, getCenteredBounds, getFrontMarkerLotBounds, getLotBounds, getLots, getJobs, ensureTownAutomationDefaults, getLotById, hashStringNumber, pointInsideBounds };
