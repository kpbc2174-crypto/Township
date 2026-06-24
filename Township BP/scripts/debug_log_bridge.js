import { world } from "@minecraft/server";

export function sendDebugLogError(addonName, systemName, error) {
  try {
    const dimension = world.getDimension("overworld");
    const raw = error && error.stack ? error.stack : String(error && error.message ? error.message : error);
    const safe = raw.replace(/[\r\n|]/g, " ").slice(0, 800);
    dimension.runCommand(`scriptevent debuglog:error ${addonName} | ${systemName} | ${safe}`);
  } catch (bridgeError) {
    try {
      console.warn(`[${addonName}] ${systemName}: ${bridgeError}`);
    } catch (_) {}
  }
}
