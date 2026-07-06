/**
 * ADR-513 §rotation-ring — «Δαχτυλίδι Εντολών» διάταξη για την ΠΕΡΙΣΤΡΟΦΗ hot-grip (free-rotate).
 *
 * Ζητούμενο (Giorgio 2026-07-06): με Δυναμική Εισαγωγή ON, στο βήμα `rotate-free` (κέντρο δηλωμένο,
 * φάντασμα να στρέφεται), όλος ο δίσκος = **ΕΝΑ πλήκτρο «Γωνία»** για να πληκτρολογείς τη γωνία
 * περιστροφής· Enter = οριστικοποίηση. Ισχύει για ΟΛΑ τα περιστρεφόμενα (γραμμή/τοίχος/κολόνα/
 * δοκός/τόξο/polyline) — το ΙΔΙΟ preview + commit path (typed-angle SSoT, ADR-397 Σ3).
 *
 * **FULL SSoT — μηδέν νέο override/lock geometry:** το πεδίο κλειδώνει τη γωνία στο
 * `RotationRingStore` (γέφυρα)· το `useUnifiedGripInteraction` τη διαβάζει και την τροφοδοτεί στο
 * ΥΠΑΡΧΟΝ `typedAngleDeg`, που ήδη οδηγεί ghost + κόκκινα/πράσινα τόξα + commit. Το ring απλώς
 * γεμίζει την ίδια τιμή που θα γέμιζε το keyboard DDE — μηδέν διπλότυπη λογική περιστροφής.
 *
 * **1 πεδίο → 1 φέτα:** ο `RadialCommandRing` χωρίζει τον κύκλο σε `computeRingSlices(fields.length)`·
 * με ένα πεδίο → μία φέτα = όλος ο δίσκος (κλικ οπουδήποτε μέσα ανοίγει το «Γωνία»). Η γωνία μένει
 * ΧΩΡΙΣ normalize (signed +CCW) — parity με το `commitTypedRotate` (raw `DirectDistanceEntry.value`).
 *
 * @see ./rotation-ring-store.ts — ο bridge (RotationRingStore) που γράφει/διαβάζει αυτό το config
 * @see ./ring-config.ts — RingConfig/RingFieldDef (tool-agnostic διάταξη)
 */

import { type RingConfig } from './ring-config';
import { RotationRingStore } from './rotation-ring-store';

/** Διάταξη δαχτυλιδιού περιστροφής: 1 αριθμητικό πεδίο «Γωνία» = όλος ο δίσκος (μία φέτα). */
export const ROTATION_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.ring.rotationLabel',
  fields: [
    {
      key: 'rotation-angle',
      labelKey: 'tools.ring.rotationAngle',
      kind: 'numeric',
      isLocked: () => RotationRingStore.getLockedDeg() !== null,
      seed: () => {
        const deg = RotationRingStore.getLockedDeg();
        return deg !== null ? deg.toFixed(2) : '';
      },
      // Signed +CCW, ΧΩΡΙΣ normalize (parity με το keyboard typed-angle → commitTypedRotate).
      commitNumeric: (value) => RotationRingStore.lock(value),
      // Το synthetic canvas click (Enter) οριστικοποιεί → resetToIdle → endSession καθαρίζει· εδώ
      // ο ίδιος ο field κατέχει το one-shot reset του (SSoT), no-op αν έχει ήδη καθαριστεί.
      clearOnPlace: () => RotationRingStore.clearAngle(),
    },
  ],
  subscribe: RotationRingStore.subscribe,
};
