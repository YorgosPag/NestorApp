/**
 * ADR-513 §opening-width — «Δαχτυλίδι Εντολών» διάταξη για την ΕΠΕΚΤΑΣΗ ΠΛΑΤΟΥΣ κουφώματος
 * (λαβή παρειάς `opening-corner-*`): **ΜΟΝΟ Μήκος** (1 πεδίο = όλος ο δίσκος), σε **mm**.
 *
 * Design decision — length-only (AutoCAD direct-distance-entry): η **διεύθυνση είναι ήδη
 * κλειδωμένη** στον άξονα του τοίχου (η παρειά κινείται μόνο κατά μήκος του), οπότε το πεδίο
 * «Γωνία» είναι περιττό — πληκτρολογείς ΜΟΝΟ την απόσταση μετακίνησης. Ίδιο idiom με την ΚΑΘΕΤΗ
 * ΓΡΑΜΜΗ (`PERPENDICULAR_LINE_RING_CONFIG`) και το `ROTATION_RING_CONFIG` (1 πεδίο → 1 φέτα).
 *
 * 🔴 ΜΟΝΑΔΑ = mm (fix Giorgio 2026-07-18): το πλάτος κουφώματος είναι **mm-native** (το ribbon combobox
 * «Πλάτος» δείχνει 700/800/900… mm), οπότε η πληκτρολογούμενη τιμή ερμηνεύεται σε **mm** — ΟΧΙ στη
 * global display μονάδα (π.χ. cm) που χρησιμοποιεί ο κοινός `lengthRingField` του τοίχου/γραμμής. Έτσι
 * `10` = 10mm (όχι 10cm=100mm). Το lock αποθηκεύεται σε scene units (mm × mmToScene) στο ΙΔΙΟ
 * `DynamicInputLockStore`· ο `resolveOpeningWidthLockedDelta` το διαβάζει και μετακινεί την παρειά τόσα mm.
 *
 * FULL SSoT — μηδέν νέο store: κοινό `DynamicInputLockStore` με τοίχο/γραμμή· διαφέρει ΜΟΝΟ η μονάδα
 * εισόδου (mm αντί display-unit). Το lock εφαρμόζεται σε ghost ΚΑΙ commit → typed length preview ≡ commit.
 *
 * @see ./ring-config.ts — RingConfig/RingFieldDef contract
 * @see ./opening-width-lock.ts — preview≡commit lock geometry (διαβάζει το locked length σε scene units)
 */

import { DynamicInputLockStore } from './DynamicInputLockStore';
import type { RingConfig, RingFieldDef } from './ring-config';
import { mmToSceneUnits } from '../../utils/scene-units';

/**
 * mm-native πεδίο «Μήκος» για το πλάτος κουφώματος. Η πληκτρολογούμενη τιμή = **mm**· κλειδώνει σε
 * scene units (`mm × mmToScene`) στο `DynamicInputLockStore.length`. Seed = τρέχον locked (scene → mm).
 * Χωρίς `lengthDisplayToSceneLock`/display-unit conversion — γι' αυτό δεν είναι ο κοινός `lengthRingField`.
 */
function openingWidthMmField(labelKey: string): RingFieldDef {
  return {
    key: 'length',
    labelKey,
    kind: 'numeric',
    isLocked: () => DynamicInputLockStore.getLocked().length !== null,
    seed: (ctx) => {
      const scene = DynamicInputLockStore.getLocked().length;
      return scene !== null ? String(Math.round(scene / mmToSceneUnits(ctx.sceneUnits))) : '';
    },
    commitNumeric: (valueMm, ctx) => DynamicInputLockStore.lockLength(valueMm * mmToSceneUnits(ctx.sceneUnits)),
    // One-shot: μετά την τοποθέτηση ξεκλειδώνει ώστε η επόμενη επέκταση να ξεκινά ελεύθερη.
    clearOnPlace: () => DynamicInputLockStore.unlockLength(),
  };
}

/** Διάταξη δαχτυλιδιού πλάτους κουφώματος: 1 αριθμητικό πεδίο «Μήκος» (mm) = όλος ο δίσκος (μία φέτα). */
export const OPENING_WIDTH_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.ring.openingWidthLabel',
  fields: [openingWidthMmField('tools.ring.length')],
  subscribe: DynamicInputLockStore.subscribe,
};
