import { createTownshipForms } from "./township_forms.js";
import { createBuildLotForms } from "./build_lot_forms.js";
import { createBuildRecorderForms } from "./build_recorder_forms.js";

export function createTownshipUi({
  townshipFormOptions,
  buildLotFormOptions,
  buildRecorderFormOptions
}) {
  const townshipForms = createTownshipForms(townshipFormOptions);
  const buildLotForms = createBuildLotForms(buildLotFormOptions);
  const buildRecorderForms = createBuildRecorderForms(buildRecorderFormOptions);

  return {
    ...townshipForms,
    ...buildLotForms,
    ...buildRecorderForms
  };
}
