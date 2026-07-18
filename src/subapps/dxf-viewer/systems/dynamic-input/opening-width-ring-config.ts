/**
 * ADR-513 §opening-width — «Δαχτυλίδι Εντολών» διάταξη για την ΕΠΕΚΤΑΣΗ ΠΛΑΤΟΥΣ κουφώματος
 * (λαβή παρειάς `opening-corner-*`): **ΜΟΝΟ Μήκος** (1 πεδίο = όλος ο δίσκος).
 *
 * Design decision — length-only (AutoCAD direct-distance-entry): η **διεύθυνση είναι ήδη
 * κλειδωμένη** στον άξονα του τοίχου (η παρειά κινείται μόνο κατά μήκος του), οπότε το πεδίο
 * «Γωνία» είναι περιττό — πληκτρολογείς ΜΟΝΟ την απόσταση μετακίνησης. Ίδιο idiom με την ΚΑΘΕΤΗ
 * ΓΡΑΜΜΗ (`PERPENDICULAR_LINE_RING_CONFIG`) και το `ROTATION_RING_CONFIG` (1 πεδίο → 1 φέτα).
 *
 * FULL SSoT — μηδέν νέο store: το Μήκος κλειδώνει στο ΙΔΙΟ `DynamicInputLockStore` (κοινός builder
 * `lengthRingField`, ίδιος με τοίχο/γραμμή). Το lock εφαρμόζεται στο ghost ΚΑΙ στο commit μέσω του
 * `resolveOpeningWidthLockedDelta` (`opening-width-lock.ts`) → typed length preview ≡ commit.
 *
 * @see ./ring-config.ts — RingConfig + `lengthRingField` (tool-agnostic builder)
 * @see ./perpendicular-line-ring-config.ts — ο αδελφός length-only καθρέφτης (κάθετη γραμμή)
 * @see ./opening-width-lock.ts — preview≡commit lock geometry
 */

import { DynamicInputLockStore } from './DynamicInputLockStore';
import { type RingConfig, lengthRingField } from './ring-config';

/** Διάταξη δαχτυλιδιού πλάτους κουφώματος: 1 αριθμητικό πεδίο «Μήκος» = όλος ο δίσκος (μία φέτα). */
export const OPENING_WIDTH_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.ring.openingWidthLabel',
  fields: [lengthRingField('tools.ring.length')],
  subscribe: DynamicInputLockStore.subscribe,
};
