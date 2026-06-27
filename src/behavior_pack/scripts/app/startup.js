export function registerTownshipStartup({ addonName, system, sendDebugLogError, registerTownshipBlockComponents }) {
  try {
    system.beforeEvents.startup.subscribe(event => {
      registerTownshipBlockComponents(event);
    });
  } catch (error) {
    sendDebugLogError(addonName, "Subscribe startup block components", error);
  }
}
