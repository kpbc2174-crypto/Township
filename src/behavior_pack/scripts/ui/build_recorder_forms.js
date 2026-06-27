import { ActionFormData } from "@minecraft/server-ui";

export function createBuildRecorderForms({ addonName, sendDebugLogError, messagePlayer, isBuildRecorderType, captureBuildRecorderLot, previewBuildRecorderArea, exportLastBuildRecorderCapture, clearBuildRecorderCaptures }) {
  function showBuildRecorderMenu(block, player) {
    try {
      if (!block || !isBuildRecorderType(block.typeId)) return;
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
      }).catch((error) => sendDebugLogError(addonName, "Build Recorder UI", error));
    } catch (error) {
      sendDebugLogError(addonName, "Show Build Recorder Menu", error);
      messagePlayer(player, "§cBuild Recorder UI failed. Check content log.");
    }
  }
  return { showBuildRecorderMenu };
}
