/**
 * ADR-513 §grip-parity — «Δαχτυλίδι Εντολών» διάταξη για την ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ γραμμής (grip-drag).
 *
 * Parity με τη σχεδίαση (Giorgio: «ακριβώς το ίδιο σύστημα»): όταν σέρνεις το άκρο μιας γραμμής
 * με ενεργή τη Δυναμική Εισαγωγή, εμφανίζεται το ΙΔΙΟ ραδιακό δαχτυλίδι για να πληκτρολογήσεις
 * **Μήκος / Γωνία**. Χειρονομία = press-drag (Revit-style): πατάς & σέρνεις, πληκτρολογείς, αφήνεις
 * = commit — γι' αυτό το δαχτυλίδι mount-άρεται σε `placementMode='lock-only'` (δεν κάνει synthetic
 * click ούτε μπλοκάρει το mouseup· απλώς κλειδώνει, το πραγματικό «άφημα» κάνει το commit).
 *
 * **FULL SSoT — μηδέν νέο store/μηχανισμός:**
 *   · Μήκος/Γωνία → ΟΙ ΙΔΙΟΙ builders (`ring-config.ts`) → ΤΟ ΙΔΙΟ `DynamicInputLockStore` με τη
 *     σχεδίαση. Το lock εφαρμόζεται στο ghost ΚΑΙ στο commit μέσω `grip-endpoint-lock.ts`
 *     (`resolveLineEndpointLockedDelta` → `applyLengthAngleLock`).
 *   · Δεν υπάρχει πεδίο «Τύπος γραμμής» (όπως στη σχεδίαση) — αυτό γράφει το global draw-default
 *     (`QuickStyleStore`), λάθος σημασιολογία για επεξεργασία ΥΠΑΡΧΟΥΣΑΣ γραμμής.
 *
 * @see ./grip-endpoint-lock.ts — preview≡commit lock geometry
 * @see ./line-ring-config.ts — ο καθρέφτης της σχεδίασης (Μήκος/Γωνία/Τύπος)
 */

import { DynamicInputLockStore } from './DynamicInputLockStore';
import { type RingConfig, angleRingField, lengthRingField } from './ring-config';

/** Διάταξη δαχτυλιδιού επέκτασης άκρου (2 πεδία: Μήκος πάνω, Γωνία δεξιά). */
export const GRIP_LINEAR_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.ring.endpointLabel',
  fields: [
    lengthRingField('tools.ring.length'),
    angleRingField('tools.ring.angle'),
  ],
  // Μόνο το lock store τρέφει highlight/seed (μηδέν tool-specific store εδώ).
  subscribe: DynamicInputLockStore.subscribe,
};
