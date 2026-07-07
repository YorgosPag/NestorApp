/**
 * @file grip-factory-defaults.ts
 * @description Canonical grip default VALUES — Single Source of Truth (ADR-559 §3b).
 *
 * Before this, the default grip VALUES were re-declared in 7 divergent places
 * (`settings/FACTORY_DEFAULTS.ts`, `types/gripSettings.ts`, `stores/GripStyleStore.ts`,
 * `settings-core/defaults.ts`, `settings-core/types/domain.ts` validateGripSettings,
 * `ui/hooks/useUnifiedSpecificSettings.ts` preview mock, `rendering/grips/constants.ts`
 * render fallback). They disagreed on `apertureSize` (10 vs 20) and warm colour
 * (orange vs hot-pink) — an inconsistency, not a legitimate per-context difference.
 *
 * This file owns those values ONCE; every other grip-default surface is DERIVED
 * (spread / projection) from it, never re-declared. A new default value is changed
 * in exactly ONE place and propagates everywhere.
 *
 * NOTE: `types/grip-settings-schema.ts` owns the SHAPE (types); this file owns the
 * VALUES. Colours use the AutoCAD/Revit sentinel `cold: null` (→ `GRIP_COLD_COLOR`
 * at render time via `resolveGripColors()`). Mode-specific deltas (draft/hover/
 * selection/completion sizes, the preview blue-cold swatch) legitimately differ and
 * stay as small overrides ON TOP of these values.
 */

// 🏢 SSoT base grip size (AutoCAD GRIPSIZE = 7)
import { GRIP_SIZE_DEFAULT } from './grip-size-default';
// 🏢 SSoT grip colours — warm is magenta/ροζ (hover), hot red, contour black
import { GRIP_WARM_COLOR, GRIP_HOT_COLOR, GRIP_CONTOUR_COLOR } from './color-config';
// 🏢 ADR-559 — canonical grip-settings SHAPE (type-only)
import type { GripSettingsBase, GripColors } from '../types/grip-settings-schema';

/**
 * Canonical grip default VALUES. Shape = stored `GripSettingsBase` + sentinel colours.
 * Runtime/preview/legacy surfaces spread this and add their own extras.
 */
export const GRIP_FACTORY_DEFAULTS: GripSettingsBase & { colors: GripColors } = {
  enabled: true,
  showGrips: true,
  gripSize: GRIP_SIZE_DEFAULT,
  pickBoxSize: 3,               // AutoCAD PICKBOX default: 3 DIP
  apertureSize: 20,             // AutoCAD APERTURE (Giorgio 2026-07-07: unified to 20)
  opacity: 1.0,
  showAperture: true,           // AutoCAD APBOX default: enabled
  multiGripEdit: true,
  snapToGrips: true,
  showMidpoints: true,
  showCenters: true,
  showQuadrants: true,
  maxGripsPerEntity: 50,
  gripObjLimit: 100,            // AutoCAD GRIPOBJLIMIT (0 = no limit)
  colors: {
    cold: null,                 // Sentinel: null → GRIP_COLD_COLOR at render time
    warm: GRIP_WARM_COLOR,      // Magenta/ροζ — hover (Giorgio 2026-07-07)
    hot: GRIP_HOT_COLOR,        // Red — active drag / selected
    contour: GRIP_CONTOUR_COLOR // Black — outline
  }
};
