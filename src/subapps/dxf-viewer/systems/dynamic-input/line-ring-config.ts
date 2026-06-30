/**
 * ADR-513 §line-parity — «Δαχτυλίδι Εντολών» διάταξη της ΓΡΑΜΜΗΣ: Μήκος / Γωνία / Τύπος γραμμής.
 *
 * Parity με τον τοίχο (Giorgio: «FULL PARITY»): in-canvas radial ring, κλικ wedge → popup → commit.
 * Διαφορά: το 3ο πεδίο «Τύπος» είναι **επιλογή** (drop-down), όχι αριθμός.
 *
 * **FULL SSoT — μηδέν νέο store/μηχανισμός:**
 *   · Μήκος/Γωνία → ΚΟΙΝΟΙ builders (`ring-config.ts`) → ΙΔΙΟ `DynamicInputLockStore` με τον τοίχο
 *     (το `applyLengthAngleLock` εφαρμόζεται ΗΔΗ στο preview ΚΑΙ στο commit της γραμμής).
 *   · Τύπος → ΙΔΙΟ `QuickStyleStore.linetypeName` (draw-default) που γράφει ΚΑΙ το ribbon dropdown
 *     (`useRibbonLineToolBridge`) + live κατάλογος από το `LinetypeRegistry` (8 ISO + custom).
 */

import {
  getQuickStyleSnapshot,
  subscribeQuickStyle,
  setQuickStyleLinetype,
} from '../../stores/QuickStyleStore';
import {
  BYLAYER_LINETYPE,
  listSelectableLinetypeNames,
  subscribeLinetypeRegistry,
} from '../../stores/LinetypeRegistry';
import { DynamicInputLockStore } from './DynamicInputLockStore';
import {
  type RingConfig,
  type RingFieldDef,
  type RingSelectOption,
  angleRingField,
  combineSubscribers,
  lengthRingField,
} from './ring-config';

/** Live επιλογές τύπου γραμμής — ΙΔΙΟΣ SSoT enumerator με το ribbon (ByLayer + registry, ISO + custom). */
function linetypeOptions(): readonly RingSelectOption[] {
  return listSelectableLinetypeNames().map((name) => ({ value: name, label: name }));
}

function linetypeField(): RingFieldDef {
  return {
    key: 'linetype',
    position: 'left',
    labelKey: 'tools.ring.linetype',
    kind: 'select',
    // Φωτίζεται όταν έχει οριστεί συγκεκριμένος τύπος (όχι ByLayer) — όπως «κλειδωμένο» wedge.
    isLocked: () => getQuickStyleSnapshot().linetypeName !== BYLAYER_LINETYPE,
    seed: () => getQuickStyleSnapshot().linetypeName,
    options: linetypeOptions,
    commitSelect: (value) => setQuickStyleLinetype(value),
  };
}

/** Διάταξη δαχτυλιδιού γραμμής (3 πεδία· η κάτω θέση μένει κενή). */
export const LINE_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.ring.lineLabel',
  fields: [
    lengthRingField('tools.ring.length'),
    angleRingField('tools.ring.angle'),
    linetypeField(),
  ],
  subscribe: combineSubscribers(
    DynamicInputLockStore.subscribe,
    subscribeQuickStyle,
    subscribeLinetypeRegistry,
  ),
};
