/**
 * PolygonMode3DStore — micro-store για το Cinema 4D «Polygon Mode» (ADR-539).
 *
 * Κρατά την ελάχιστη low-frequency UI κατάσταση: αν το mode είναι ενεργό και ποιες όψεις
 * (`bimId` + `FaceKey`) είναι επιλεγμένες. Ο (non-React) pointer handler γράφει το
 * `selectedFaces` στο click σε όψη (Shift → toggle add/remove, mirror Cinema 4D)· το
 * `PolygonMaterialPanel` τις διαβάζει ώστε το επόμενο swatch click να εφαρμόσει υλικό/χρώμα
 * σε ΟΛΕΣ τις επιλεγμένες όψεις με ΕΝΑ undo. Μηδέν high-frequency δεδομένα (καμία θέση
 * κέρσορα) — mirror του `Grip3DContextMenuStore` (ADR-040: οι orchestrators δεν subscribe εδώ).
 *
 * ΑΓΚΥΡΑ (`selectedFace`): η ΤΕΛΕΥΤΑΙΑ προστιθέμενη/επιλεγμένη όψη (primary). Το panel
 * (custom-color seed) και το Φ4a entity-level copy (που θέλει ΕΝΑ `bimId`) τη διαβάζουν.
 * Η αλήθεια του set είναι το `selectedFaces`· το `selectedFace` = `selectedFaces` τελευταίο.
 *
 * @see bim-3d/ui/PolygonMaterialPanel.tsx — apply (σε ΟΛΕΣ τις όψεις)
 * @see bim-3d/viewport/use-bim3d-pointer-handlers.ts — face pick (Shift-toggle)
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { create } from 'zustand';

/** Η επιλεγμένη όψη: ποια entity + ποιο `FaceKey`. */
export interface SelectedFace3D {
  readonly bimId: string;
  readonly faceKey: string;
}

/** Σταθερό κλειδί ταυτότητας όψης (cross-entity unique) — `${bimId}|${faceKey}`. */
function faceIdentity(face: SelectedFace3D): string {
  return `${face.bimId}|${face.faceKey}`;
}

interface PolygonMode3DState {
  /** True όταν το Polygon Mode είναι ενεργό (κλικ → επιλογή όψης αντί entity). */
  readonly active: boolean;
  /**
   * Το solid πάνω στο οποίο είναι ανοιχτό το Polygon Mode. Ο slab converter το διαβάζει
   * ώστε να render-άρει ΑΥΤΟ το solid faced (pickable όψεις) ακόμη κι αν δεν έχει βαφή —
   * λύνει το chicken-and-egg (faced render ↔ faceAppearance). null όταν off.
   */
  readonly targetBimId: string | null;
  /** Όλες οι επιλεγμένες όψεις (SSoT· Cinema 4D multi-face select). Κενό = καμία. */
  readonly selectedFaces: readonly SelectedFace3D[];
  /** Άγκυρα = η τελευταία προστιθέμενη/επιλεγμένη όψη (primary), ή null. */
  readonly selectedFace: SelectedFace3D | null;
  /** Ρητό set του active + target solid (καθαρίζει επιλογή/target όταν off). */
  setActive(active: boolean, bimId?: string | null): void;
  /** Replace-select: αντικαθιστά το set με ΜΙΑ όψη (ή το αδειάζει με null). */
  selectFace(face: SelectedFace3D | null): void;
  /** Toggle add/remove ΜΙΑΣ όψης στο set (Shift+κλικ· anchor = η όψη αν προστέθηκε). */
  toggleFace(face: SelectedFace3D): void;
  /** Καθαρίζει το set όψεων (κρατά active/target). */
  clearFaces(): void;
  /** Πλήρες reset (off + κανένα target/όψη). */
  reset(): void;
}

export const usePolygonMode3DStore = create<PolygonMode3DState>((set) => ({
  active: false,
  targetBimId: null,
  selectedFaces: [],
  selectedFace: null,
  setActive: (active, bimId) => set((s) => ({
    active,
    targetBimId: active ? (bimId ?? s.targetBimId) : null,
    selectedFaces: active ? s.selectedFaces : [],
    selectedFace: active ? s.selectedFace : null,
  })),
  selectFace: (face) => set({
    selectedFaces: face ? [face] : [],
    selectedFace: face,
  }),
  toggleFace: (face) => set((s) => {
    const key = faceIdentity(face);
    const exists = s.selectedFaces.some((f) => faceIdentity(f) === key);
    if (exists) {
      const remaining = s.selectedFaces.filter((f) => faceIdentity(f) !== key);
      return { selectedFaces: remaining, selectedFace: remaining[remaining.length - 1] ?? null };
    }
    const next = [...s.selectedFaces, face];
    return { selectedFaces: next, selectedFace: face };
  }),
  clearFaces: () => set({ selectedFaces: [], selectedFace: null }),
  reset: () => set({ active: false, targetBimId: null, selectedFaces: [], selectedFace: null }),
}));
