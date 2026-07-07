/**
 * ADR-060 / ADR-513 §direct-distance-entry — «Δαχτυλίδι Εντολών» διάταξη της ΚΑΘΕΤΗΣ ΓΡΑΜΜΗΣ
 * (`line-perpendicular`): **ΜΟΝΟ Μήκος** (1 πεδίο = όλος ο δίσκος).
 *
 * Ζητούμενο (Giorgio 2026-07-07): αφού δηλωθεί το 1ο σημείο (σημείο εισαγωγής) πάνω στην οντότητα,
 * ο χρήστης πληκτρολογεί το ΜΗΚΟΣ της γραμμής και με Enter ολοκληρώνεται η τοποθέτηση κάθετα.
 *
 * **Design decision — length-only (AutoCAD direct-distance-entry):** μετά το click-1 η **διεύθυνση
 * είναι ήδη κλειδωμένη** (ο κάθετος άξονας, `perpendicularAxisLockStore`). Άρα το πεδίο «Γωνία»
 * είναι περιττό/παραπλανητικό — κατά μήκος constrained direction πληκτρολογείς ΜΟΝΟ την απόσταση
 * (πρακτική AutoCAD DDE· Revit/C4D-faithful: ένας ελεύθερος βαθμός ⇒ ένα πεδίο). Ίδιο idiom με το
 * single-field `ROTATION_RING_CONFIG` (1 πεδίο → 1 φέτα → όλος ο δίσκος ανοίγει το πεδίο).
 *
 * **FULL SSoT — μηδέν νέο store/μηχανισμός:** το Μήκος κλειδώνει στο ΙΔΙΟ `DynamicInputLockStore`
 * (κοινός builder `lengthRingField`, ίδιος με τοίχο & γραμμή). Το `applyLengthAngleLock` εφαρμόζεται
 * ΗΔΗ στο preview (`drawing-hover-handler`) ΚΑΙ στο commit (`resolveLineFamilyCommitPoint`) της
 * κάθετης γραμμής → typed length δουλεύει end-to-end (preview≡commit) μόλις οπλιστεί το lock.
 *
 * @see ./ring-config.ts — RingConfig/RingFieldDef + `lengthRingField` (tool-agnostic builder)
 * @see ./line-ring-config.ts — η πλήρης (Μήκος/Γωνία/Τύπος) διάταξη της απλής γραμμής
 * @see ../../hooks/drawing/drawing-handler-utils.ts — `resolveLineFamilyCommitPoint` (commit path)
 */

import { DynamicInputLockStore } from './DynamicInputLockStore';
import { type RingConfig, lengthRingField } from './ring-config';

/** Διάταξη δαχτυλιδιού κάθετης γραμμής: 1 αριθμητικό πεδίο «Μήκος» = όλος ο δίσκος (μία φέτα). */
export const PERPENDICULAR_LINE_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.ring.perpendicularLabel',
  fields: [lengthRingField('tools.ring.length')],
  subscribe: DynamicInputLockStore.subscribe,
};
