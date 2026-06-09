import { SNAP_STEP_PRESETS } from '../../../bim-3d/animation/snap-quantizer';

/** Combobox options for the animation snap step (mirrors SNAP_STEP_PRESETS). */
export const SNAP_STEP_COMBOBOX_OPTIONS = SNAP_STEP_PRESETS.map((v) => ({
  value: String(v),
  labelKey: `animation.snapStepOptions.${v % 1 === 0 ? String(Math.round(v)) : String(v)}`,
}));
