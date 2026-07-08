/**
 * ADR-513 — «Δαχτυλίδι Εντολών» διάταξη της ΔΟΚΟΥ: Μήκος / Γωνία / Πλάτος / Ύψος.
 *
 * Full parity με τον ΤΟΙΧΟ (`wall-ring-config.ts`): μετά το 1ο κλικ (awaitingEnd) εμφανίζεται το ΙΔΙΟ
 * ραδιακό δαχτυλίδι — τα ίδια πεδία, ο ίδιος μηχανισμός.
 *
 * **FULL SSoT — μηδέν νέο store/μηχανισμός:**
 *   · Μήκος/Γωνία → ΚΟΙΝΟΙ builders (`ring-config.ts`) → ΙΔΙΟ `DynamicInputLockStore` με τοίχο & γραμμή.
 *   · Πλάτος (b) / Ύψος (h) → beam-specific numeric overrides μέσω του κοινού `createOverrideRingFields`
 *     (ΙΔΙΟ idiom με τον τοίχο· ο setter ενημερώνει tool FSM + `beamPreviewStore` → preview ≡ commit).
 */

import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import { beamToolBridgeStore } from '../../bim/beams/beam-tool-bridge-store';
import { DEFAULT_BEAM_DEPTH_MM, DEFAULT_BEAM_WIDTH_MM } from '../../bim/types/beam-types';
import { DynamicInputLockStore } from './DynamicInputLockStore';
import {
  type RingConfig,
  angleRingField,
  combineSubscribers,
  createOverrideRingFields,
  lengthRingField,
} from './ring-config';

const { numericOverrideField } = createOverrideRingFields(beamToolBridgeStore, beamPreviewStore);

/** Διάταξη δαχτυλιδιού δοκού (4 πεδία → cardinal, mirror του τοίχου): Μήκος πάνω, Γωνία δεξιά,
 * Ύψος κάτω, Πλάτος αριστερά (σειρά = φέτα μέσω `computeRingSlices`). */
export const BEAM_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.beam.ringLabel',
  fields: [
    lengthRingField('tools.beam.ringLength'),
    angleRingField('tools.beam.ringAngle'),
    numericOverrideField({
      key: 'depth',
      labelKey: 'tools.beam.ringDepth',
      resolveSeedMm: (o) => o.depth ?? DEFAULT_BEAM_DEPTH_MM,
    }),
    numericOverrideField({
      key: 'width',
      labelKey: 'tools.beam.ringWidth',
      resolveSeedMm: (o) => o.width ?? DEFAULT_BEAM_WIDTH_MM,
    }),
  ],
  subscribe: combineSubscribers(
    DynamicInputLockStore.subscribe,
    beamPreviewStore.subscribe,
    beamToolBridgeStore.subscribe,
  ),
};
