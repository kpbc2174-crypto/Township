import { world } from "@minecraft/server";

export function createBuildRecorderStore({
  addonName,
  runtimeState,
  safeLocationKey,
  sendDebugLogError,
  messagePlayer,
  getLotAtBlock,
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
}) {
  const {
    BUILD_RECORDER_ID,
    BUILD_RECORDER_PROPERTY,
    NATURAL_CAPTURE_SKIP_BLOCKS,
    LOT_SMALL_HALF,
    LOT_MEDIUM_HALF,
    LOT_LARGE_HALF,
    LOT_SMALL_SIZE,
    LOT_MEDIUM_SIZE,
    LOT_LARGE_SIZE
  } = constants;

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
      sendDebugLogError(addonName, "Get Build Lot By Block", error);
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
    }
    return undefined;
  }

  function shouldSkipBuildLotCaptureBlock(block, lot) {
    if (!block) return true;
    if (block.typeId === "minecraft:air") return true;
    if (isBuildLotRecorderType(block.typeId)) return true;
    if (!(lot?.includeNaturalBlocks ?? false) && NATURAL_CAPTURE_SKIP_BLOCKS.has(block.typeId)) return true;
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

  function getRecorderList() {
    if (runtimeState.memoryBuildRecorderCaptures.length > 0) return runtimeState.memoryBuildRecorderCaptures;
    try {
      const raw = world.getDynamicProperty(BUILD_RECORDER_PROPERTY);
      if (typeof raw === "string") {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          runtimeState.memoryBuildRecorderCaptures = parsed;
          return parsed;
        }
      }
    } catch (error) {
      sendDebugLogError(addonName, "Load Build Recorder Data", error);
    }
    return [];
  }

  function saveRecorderList(records) {
    runtimeState.memoryBuildRecorderCaptures = records.slice(-10);
    try {
      world.setDynamicProperty(BUILD_RECORDER_PROPERTY, JSON.stringify(runtimeState.memoryBuildRecorderCaptures));
    } catch (error) {
      sendDebugLogError(addonName, "Save Build Recorder Data", error);
    }
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
          const point = transformFromBackAnchor(marker, lot.backDirection, lx, lb);
          for (let dy = box.minDy; dy <= box.maxDy; dy++) {
            const target = block.dimension.getBlock({ x: point.x, y: yBase + dy, z: point.z });
            if (shouldSkipBuildLotCaptureBlock(target, lot)) continue;
            const entry = { x: lx, y: dy, z: lb, block: target.typeId };
            const states = getBlockPermutationStates(target);
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
      const list = getRecorderList().filter(captureItem => captureItem && captureItem.key !== key);
      list.push(capture);
      saveRecorderList(list);
      lot.savedCaptureKey = key;
      lot.savedBlockCount = records.length;
      saveTowns(getTowns());
      messagePlayer(player, `§aSaved Build Lot '${lot.buildName}' with ${records.length} blocks. Use Export Saved Build to copy it.`);
    } catch (error) {
      sendDebugLogError(addonName, "Capture Build Lot", error);
      messagePlayer(player, "§cBuild Lot save failed. Check content log.");
    }
  }

  function getSavedCaptureForLot(lot, dimensionId) {
    if (!lot || !lot.marker) return undefined;
    const key = lot.savedCaptureKey ?? buildLotKey(lot.marker, dimensionId);
    return getRecorderList().find(capture => capture && capture.key === key);
  }

  function sendExportChunkToDebug(player, capture, index, total, chunk) {
    try {
      const dimension = player?.dimension ?? world.getDimension("overworld");
      const safe = String(chunk).replace(/[\r\n|]/g, " ").slice(0, 720);
      dimension.runCommand(`scriptevent debuglog:error ${addonName} | Build Export ${capture.building_id} ${index + 1}/${total} | ${safe}`);
    } catch (error) {
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
      for (let index = 0; index < total; index++) {
        const chunk = text.slice(index * chunkSize, (index + 1) * chunkSize);
        const header = `TOWNSHIP_BUILD_EXPORT name=${capture.building_id} lot_size=${capture.lot_size} chunk=${index + 1}/${total}`;
        messagePlayer(player, `§e${header}`);
        messagePlayer(player, `§f${chunk}`);
        sendExportChunkToDebug(player, capture, index, total, `${header} ${chunk}`);
      }
      messagePlayer(player, "§aExport sent in chat chunks. Each chunk includes the build name and chunk number.");
    } catch (error) {
      sendDebugLogError(addonName, "Export Build Lot", error);
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
      saveRecorderList(getRecorderList().filter(capture => capture && capture.key !== key));
      delete found.lot.savedCaptureKey;
      delete found.lot.savedBlockCount;
      saveTowns(getTowns());
      messagePlayer(player, "§eSaved Build Lot capture cleared. The physical build was not changed.");
    } catch (error) {
      sendDebugLogError(addonName, "Clear Saved Build Lot", error);
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
      sendDebugLogError(addonName, "Register Build Recorder", error);
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
            const point = transformFromBackAnchor(marker, facing.backDirection, lx, lb);
            const target = block.dimension.getBlock({ x: point.x, y: y0 + dy, z: point.z });
            if (!target || target.typeId === "minecraft:air" || target.typeId === BUILD_RECORDER_ID || isBuildLotRecorderType(target.typeId)) continue;
            const entry = { x: lx, y: dy, z: lb, block: target.typeId };
            const states = getBlockPermutationStates(target);
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
      sendDebugLogError(addonName, "Capture Build Recorder Lot", error);
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
      for (let index = 0; index < total; index++) {
        messagePlayer(player, `§e[${index + 1}/${total}] §f${text.slice(index * chunkSize, (index + 1) * chunkSize)}`);
      }
    } catch (error) {
      sendDebugLogError(addonName, "Export Build Recorder", error);
    }
  }

  function clearBuildRecorderCaptures(player) {
    saveRecorderList([]);
    messagePlayer(player, "§eTownship Build Recorder captures cleared.");
  }

  return {
    getBuildLotByBlock,
    ensureBuildLotSettings,
    getBuildLotCaptureBox,
    registerBuildRecorderFromBlock,
    captureBuildLot,
    exportBuildLot,
    clearSavedBuildLotCapture,
    getRecorderList,
    saveRecorderList,
    captureBuildRecorderLot,
    exportLastBuildRecorderCapture,
    clearBuildRecorderCaptures,
    getRecorderLotInfo
  };
}
