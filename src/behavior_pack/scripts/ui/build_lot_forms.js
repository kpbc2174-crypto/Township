import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

export function createBuildLotForms({
  addonName,
  system,
  sendDebugLogError,
  messagePlayer,
  getTowns,
  saveTowns,
  getBuildLotByBlock,
  ensureBuildLotSettings,
  defaultBuildLotName,
  captureBuildLot,
  exportBuildLot,
  clearSavedBuildLotCapture,
  clearPhysicalBuildLot
}) {
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

  function showBuildLotSettingsForm(block, player) {
    try {
      const found = getBuildLotByBlock(block);
      if (!found) return messagePlayer(player, "§cNo Build Lot record found for this block.");
      const lot = found.lot;
      ensureBuildLotSettings(lot);
      new ModalFormData()
        .title("Build Lot Settings")
        .textField("Build name", "small_blacksmith_01", lot.buildName)
        .textField("Capture down range", "1", String(lot.captureDown))
        .textField("Capture up range", "12", String(lot.captureUp))
        .toggle("Include natural blocks", !!lot.includeNaturalBlocks)
        .show(player)
        .then(response => {
          if (response.canceled) return;
          const values = response.formValues ?? [];
          const name = String(values[0] ?? lot.buildName).trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_\-]/g, "");
          const down = Math.max(0, Math.min(32, parseInt(values[1] ?? lot.captureDown, 10) || 0));
          const up = Math.max(1, Math.min(64, parseInt(values[2] ?? lot.captureUp, 10) || 12));
          lot.buildName = name || defaultBuildLotName(lot);
          lot.captureDown = down;
          lot.captureUp = up;
          lot.includeNaturalBlocks = !!values[3];
          saveTowns(getTowns());
          messagePlayer(player, `§aBuild Lot settings saved. Name: ${lot.buildName}, Down: ${down}, Up: ${up}, Natural Blocks: ${lot.includeNaturalBlocks ? "Include" : "Ignore"}`);
        })
        .catch(error => sendDebugLogError(addonName, "Build Lot Settings UI", error));
    } catch (error) {
      sendDebugLogError(addonName, "Show Build Lot Settings", error);
    }
  }

  function showBuildLotMenu(block, player) {
    try {
      const found = getBuildLotByBlock(block);
      if (!found) return messagePlayer(player, "§cThis Build Lot is not registered yet. Break and replace it inside a township if needed.");
      const { town, lot } = found;
      ensureBuildLotSettings(lot);
      new ActionFormData()
        .title("Township Build Lot")
        .body(getBuildLotInfoText(town, lot))
        .button("Set Name / Capture Settings")
        .button(`Natural Blocks: ${lot.includeNaturalBlocks ? "Include" : "Ignore"}`)
        .button("Save Build")
        .button("Export Saved Build")
        .button("Clear Saved Build")
        .button("Clear Physical Lot")
        .button("Show Lot Info")
        .show(player)
        .then(response => {
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
        })
        .catch(error => sendDebugLogError(addonName, "Build Lot UI", error));
    } catch (error) {
      sendDebugLogError(addonName, "Show Build Lot Menu", error);
      messagePlayer(player, "§cBuild Lot UI failed. Check content log.");
    }
  }

  return { getBuildLotInfoText, showBuildLotSettingsForm, showBuildLotMenu };
}
