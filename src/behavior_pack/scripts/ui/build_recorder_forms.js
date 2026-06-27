import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

export function createBuildRecorderForms({
  addonName,
  sendDebugLogError,
  messagePlayer,
  getLotBounds,
  saveTowns,
  getTowns,
  transformFromBackAnchor,
  getFrontMarkerLotBounds,
  addBoundsParticlePositions,
  spawnPreviewParticle,
  getBuildLotByBlock,
  ensureBuildLotSettings,
  getBuildLotCaptureBox,
  captureBuildLot,
  exportBuildLot,
  clearSavedBuildLotCapture,
  getRecorderLotInfo,
  captureBuildRecorderLot,
  exportLastBuildRecorderCapture,
  clearBuildRecorderCaptures,
  constants
}) {
  const { LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER, BUILD_RECORDER_ID } = constants;

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
        lot.buildName = name || `custom_${lot.recorderSizeName ?? "small"}`;
        lot.captureDown = down;
        lot.captureUp = up;
        lot.includeNaturalBlocks = includeNatural;
        saveTowns(getTowns());
        messagePlayer(player, `§aBuild Lot settings saved. Name: ${lot.buildName}, Down: ${down}, Up: ${up}, Natural Blocks: ${includeNatural ? "Include" : "Ignore"}`);
      }).catch(error => sendDebugLogError(addonName, "Build Lot Settings UI", error));
    } catch (error) {
      sendDebugLogError(addonName, "Show Build Lot Settings", error);
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
        } else if (response.selection === 2) captureBuildLot(block, player);
        else if (response.selection === 3) exportBuildLot(block, player);
        else if (response.selection === 4) clearSavedBuildLotCapture(block, player);
        else if (response.selection === 5) clearPhysicalBuildLot(block, player);
        else if (response.selection === 6) messagePlayer(player, getBuildLotInfoText(town, lot));
      }).catch(error => sendDebugLogError(addonName, "Build Lot UI", error));
    } catch (error) {
      sendDebugLogError(addonName, "Show Build Lot Menu", error);
      messagePlayer(player, "§cBuild Lot UI failed. Check content log.");
    }
  }

  function previewBuildRecorderArea(block, player, sizeName) {
    try {
      const info = getRecorderLotInfo(sizeName);
      const facing = { frontDirection: "south", backDirection: "north" };
      const bounds = getFrontMarkerLotBounds(block.location, facing.backDirection, info.halfSize, info.size - 1);
      const positions = [];
      addBoundsParticlePositions(positions, bounds, Math.floor(block.location.y) + 1.35, 1);
      let count = 0;
      for (const position of positions) {
        if (count > LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER) break;
        spawnPreviewParticle(block.dimension, position);
        count++;
      }
      messagePlayer(player, `§ePreviewed ${info.sizeName} capture area using particles.`);
    } catch (error) {
      sendDebugLogError(addonName, "Preview Build Recorder Area", error);
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
      form.show(player).then(response => {
        if (response.canceled) return;
        if (response.selection === 0) captureBuildRecorderLot(block, player, "small");
        else if (response.selection === 1) captureBuildRecorderLot(block, player, "medium");
        else if (response.selection === 2) captureBuildRecorderLot(block, player, "large");
        else if (response.selection === 3) previewBuildRecorderArea(block, player, "small");
        else if (response.selection === 4) previewBuildRecorderArea(block, player, "medium");
        else if (response.selection === 5) previewBuildRecorderArea(block, player, "large");
        else if (response.selection === 6) exportLastBuildRecorderCapture(player);
        else if (response.selection === 7) clearBuildRecorderCaptures(player);
      }).catch(error => sendDebugLogError(addonName, "Build Recorder UI", error));
    } catch (error) {
      sendDebugLogError(addonName, "Show Build Recorder Menu", error);
      messagePlayer(player, "§cBuild Recorder UI failed. Check content log.");
    }
  }

  return { showBuildLotMenu, showBuildRecorderMenu, clearPhysicalBuildLot };
}
