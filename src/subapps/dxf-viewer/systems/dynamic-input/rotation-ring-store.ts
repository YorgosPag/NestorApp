/**
 * ADR-513 §rotation-ring / ADR-397 Σ3 — bridge store για το single-slice «Δαχτυλίδι Εντολών»
 * ΠΕΡΙΣΤΡΟΦΗΣ. Singleton zero-React SSoT (ίδιο pattern με `DynamicInputLockStore`).
 *
 * **Γιατί γέφυρα (και ΟΧΙ νέος μηχανισμός preview/commit):** η typed-angle περιστροφή έχει ΗΔΗ
 * πλήρη διαδρομή (ADR-397 Σ3) — το `typedAngleDeg` οδηγεί ghost + τόξα (`buildRotateReferencePreview`)
 * ΚΑΙ commit (`commitFreeRotate`→`commitTypedRotate`), για ΟΛΑ τα περιστρεφόμενα (γραμμή/τοίχος/
 * κολόνα/δοκός/τόξο/polyline). Ο πηγαίος καταχωρητής του `typedAngleDeg` όμως ζει μέσα στο
 * `useUnifiedGripInteraction` (πλήκτρα → `DirectDistanceEntry`), όπου το «Δαχτυλίδι Εντολών»
 * (άλλο component tree, `DynamicInputSubscriber`) ΔΕΝ φτάνει. Αυτό το store είναι η ΜΟΝΗ γέφυρα
 * ring → hook: το ring γράφει τη γωνία (`lock`), το hook τη διαβάζει και την τροφοδοτεί στο ΙΔΙΟ
 * preview + commit path (μηδέν νέο override/seam).
 *
 * Κρατά ΔΥΟ σχετιζόμενα πεδία της ΙΔΙΑΣ «συνεδρίας δαχτυλιδιού περιστροφής»:
 *   · `sessionActive` — το βήμα `rotate-free` είναι ενεργό (κέντρο δηλωμένο). Γράφεται από το hook
 *     (`seedRotateFreeStep` → begin· reset/«R»/selection-change → end). Ο `DynamicInputSubscriber`
 *     το διαβάζει για να mount-άρει το ring (μαζί με το `dynInput.on` gate).
 *   · `lockedDeg` — η πληκτρολογημένη γωνία (μοίρες, signed +CCW, ΧΩΡΙΣ normalize — parity με το
 *     keyboard DDE flow). Γράφεται από το ring, διαβάζεται από το hook για preview + commit.
 *
 * Zero React / DOM dependencies — fully unit-testable.
 *
 * @see ./rotation-ring-config.ts — το `ROTATION_RING_CONFIG` (1 φέτα «Γωνία») που γράφει εδώ
 * @see ../../hooks/grips/grip-hotgrip-actions.ts — `seedRotateFreeStep` (begin) / `commitTypedRotate`
 * @see ../../hooks/grips/grip-projections.ts — `buildRotateReferencePreview` (typedAngleDeg → ghost+τόξα)
 */

import { createExternalStore } from '../../stores/createExternalStore';

interface RotationRingState {
  /** True όσο το βήμα `rotate-free` είναι ενεργό (κέντρο δηλωμένο) → το ring μπορεί να φανεί. */
  readonly sessionActive: boolean;
  /** Πληκτρολογημένη γωνία περιστροφής (μοίρες, signed +CCW) ή null. */
  readonly lockedDeg: number | null;
}

const INITIAL: RotationRingState = { sessionActive: false, lockedDeg: null };

// Field-compare guard: πανομοιότυπες εγγραφές δεν κάνουν notify (μηδέν περιττά re-render).
const store = createExternalStore<RotationRingState>(INITIAL, {
  equals: (a, b) => a.sessionActive === b.sessionActive && a.lockedDeg === b.lockedDeg,
});

export const RotationRingStore = {
  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
  },

  /**
   * Το hook μπαίνει σε `rotate-free` (κέντρο δηλωμένο) → το ring μπορεί να mount-άρει. Idempotent.
   * Καλείται από το `seedRotateFreeStep` (ΕΝΑ σημείο εισόδου: normal centre-pick + Ctrl-endpoint).
   */
  beginSession(): void {
    store.set({ sessionActive: true, lockedDeg: store.get().lockedDeg });
  },

  /**
   * Το `rotate-free` τελείωσε (commit / cancel / ESC / «R» → reference / selection-change) →
   * το ring ξε-mountάρει. Καθαρίζει ΚΑΙ την πληκτρολογημένη γωνία ώστε η επόμενη περιστροφή να
   * ξεκινά καθαρή. Idempotent.
   */
  endSession(): void {
    store.set({ sessionActive: false, lockedDeg: null });
  },

  /** Ring: ο χρήστης πληκτρολόγησε γωνία (μοίρες, signed +CCW). Οδηγεί ghost+τόξα μέσω του hook. */
  lock(deg: number): void {
    store.set({ sessionActive: store.get().sessionActive, lockedDeg: deg });
  },

  /** Καθάρισε ΜΟΝΟ την πληκτρολογημένη γωνία (η συνεδρία μένει ενεργή). */
  clearAngle(): void {
    if (store.get().lockedDeg === null) return;
    store.set({ sessionActive: store.get().sessionActive, lockedDeg: null });
  },

  /** True όσο το βήμα `rotate-free` είναι ενεργό — mount gate του ring (`useSyncExternalStore`). */
  isSessionActive(): boolean {
    return store.get().sessionActive;
  },

  /** Η τρέχουσα πληκτρολογημένη γωνία (μοίρες) ή null — διαβάζεται από το preview + commit path. */
  getLockedDeg(): number | null {
    return store.get().lockedDeg;
  },
};
