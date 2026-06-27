import { ActionFormData } from "@minecraft/server-ui";

export function createBuildRecorderForms({ addonName, sendDebugLogError, messagePlayer, isBuildRecorderType, captureBuildRecorderLot, previewBuildRecorderArea, exportLastBuildRecorderCapture, clearBuildRecorderCaptures }) {
  function showBuildRecorderMenu(block, player) {
    try {
      if (!block || !isBuildRecorderType(block.typeId)) return;
      const form = new ActionFormData().title("Township Build Recorder").body("Build behind this recorder, then capture the lot.").button("Save Small Lot").button("Save Medium Lot").button("Save Large Lot").button("Preview Small Area").button("Preview Medium Area").button("Preview Large Area").button("Export Build Data").button("Clear Capture");
      form.show(player).then(response => {
        if (response.canceled) return;
        const actions = [
          () => captureBuildRecorderLot(block, player, "small"),
          () => captureBuildRecorderLot(block, player, "medium"),
          () => captureBuildRecorderLot(block, player, "large"),
          () => previewBuildRecorderArea(block, player, "small"),
          () => previewBuildRecorderArea(block, player, "medium"),
          () => previewBuildRecorderArea(block, player, "large"),
          () => exportLastBuildRecorderCapture(player),
          () => clearBuildRecorderCaptures(player)
        ];
        actions[response.selection]?.();
      }).catch(error => sendDebugLogError(addonName, "Build Recorder UI", error));
    } catch (error) {
      sendDebugLogError(addonName, "Show Build Recorder Menu", error);
      messagePlayer(player, "§cBuild Recorder UI failed. Check content log.");
    }
  }
  return { showBuildRecorderMenu };
}
