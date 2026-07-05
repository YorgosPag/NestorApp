/**
 * ADR-513 — «Δαχτυλίδι Εντολών» διάταξη της ΔΟΚΟΥ: Μήκος / Γωνία / Πλάτος / Ύψος.
 *
 * Full parity με τον ΤΟΙΧΟ (`wall-ring-config.ts`): μετά το 1ο κλικ (awaitingEnd) εμφανίζεται το ΙΔΙΟ
 * ραδιακό δαχτυλίδι — τα ίδια πεδία, ο ίδιος μηχανισμός.
 *
 * **FULL SSoT — μηδέν νέο store/μηχανισμός:**
 *   · Μήκος/Γωνία → ΚΟΙΝΟΙ builders (`ring-config.ts`) → ΙΔΙΟ `DynamicInputLockStore` με τοίχο & γραμμή
 *     (το `applyLengthAngleLock` εφαρμόζεται ΗΔΗ στο preview ΚΑΙ στο commit της δοκού).
 *   · Πλάτος (b) / Ύψος (h) → beam-specific numeric overrides μέσω `beamToolBridgeStore.setParamOverrides`
 *     (ΙΔΙΟ idiom με τον τοίχο· ο setter ενημερώνει tool FSM + `beamPreviewStore` → preview ≡ commit).
 */

import { formatDisplayValue, fromDisplay } from '../../config/units';
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import { beamToolBridgeStore } from '../../bim/beams/beam-tool-bridge-store';
import type { BeamParamOverrides } from '../../hooks/drawing/beam-completion';
import { DEFAULT_BEAM_DEPTH_MM, DEFAULT_BEAM_WIDTH_MM } from '../../bim/types/beam-types';
import { DynamicInputLockStore } from './DynamicInputLockStore';
import {
  type RingConfig,
  type RingFieldDef,
  type RingUnitContext,
  angleRingField,
  combineSubscribers,
  lengthRingField,
} from './ring-config';

/** Τρέχοντα overrides (bridge → preview fallback) — ίδιο idiom με το `wall-ring-config.currentOverrides`. */
function currentOverrides(): BeamParamOverrides {
  return beamToolBridgeStore.get()?.overrides ?? beamPreviewStore.get().overrides;
}

/** Γράψε ένα override στο bridge (no-op όταν δεν υπάρχει ενεργό beam-tool handle). */
function setOverride(key: 'width' | 'depth', valueMm: number): void {
  const handle = beamToolBridgeStore.get();
  handle?.setParamOverrides({ ...handle.overrides, [key]: valueMm });
}

function beamWidthField(): RingFieldDef {
  return {
    key: 'width',
    labelKey: 'tools.beam.ringWidth',
    kind: 'numeric',
    isLocked: () => currentOverrides().width !== undefined,
    seed: (ctx: RingUnitContext) => formatDisplayValue(currentOverrides().width ?? DEFAULT_BEAM_WIDTH_MM, ctx.displayUnit),
    commitNumeric: (value, ctx) => setOverride('width', fromDisplay(value, ctx.displayUnit)),
  };
}

function beamDepthField(): RingFieldDef {
  return {
    key: 'depth',
    labelKey: 'tools.beam.ringDepth',
    kind: 'numeric',
    isLocked: () => currentOverrides().depth !== undefined,
    seed: (ctx: RingUnitContext) => formatDisplayValue(currentOverrides().depth ?? DEFAULT_BEAM_DEPTH_MM, ctx.displayUnit),
    commitNumeric: (value, ctx) => setOverride('depth', fromDisplay(value, ctx.displayUnit)),
  };
}

/** Διάταξη δαχτυλιδιού δοκού (4 πεδία → cardinal, mirror του τοίχου): Μήκος πάνω, Γωνία δεξιά,
 * Ύψος κάτω, Πλάτος αριστερά (σειρά = φέτα μέσω `computeRingSlices`). */
export const BEAM_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.beam.ringLabel',
  fields: [
    lengthRingField('tools.beam.ringLength'),
    angleRingField('tools.beam.ringAngle'),
    beamDepthField(),
    beamWidthField(),
  ],
  subscribe: combineSubscribers(
    DynamicInputLockStore.subscribe,
    beamPreviewStore.subscribe,
    beamToolBridgeStore.subscribe,
  ),
};
