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

/**
 * ADR-449 PART B Slice C — ποιο **layer** βάφει το paint: το δομικό **σώμα** (`FaceAppearance`,
 * ADR-539) ή το **δέρμα/σοβάς** (`faceOverrides`, ADR-449). ΕΝΑ picking/panel, δύο στόχοι —
 * το `PolygonMaterialPanel` δίνει toggle, το apply route-άρει ανάλογα. Default `body` (539 parity).
 */
export type PolygonTargetLayer = 'body' | 'finish';

interface PolygonMode3DState {
  /** True όταν το Polygon Mode είναι ενεργό (κλικ → επιλογή όψης αντί entity). */
  readonly active: boolean;
  /** ADR-449 Slice C — στόχος βαφής: σώμα (539) ή σοβάς (449). Default `body`. */
  readonly targetLayer: PolygonTargetLayer;
  /**
   * Το solid πάνω στο οποίο **άνοιξε** το Polygon Mode (primary anchor, π.χ. για framing/UX).
   * Φ4b: το faced render ΔΕΝ εξαρτάται πλέον από αυτό — όσο το mode είναι active, ΟΛΑ τα solids
   * γίνονται faced (`shouldRenderFaced` SSoT) ώστε το multi-face select να δουλεύει cross-entity.
   * null όταν off.
   */
  readonly targetBimId: string | null;
  /** Όλες οι επιλεγμένες όψεις (SSoT· Cinema 4D multi-face select). Κενό = καμία. */
  readonly selectedFaces: readonly SelectedFace3D[];
  /** Άγκυρα = η τελευταία προστιθέμενη/επιλεγμένη όψη (primary), ή null. */
  readonly selectedFace: SelectedFace3D | null;
  /** Ρητό set του active + target solid (καθαρίζει επιλογή/target όταν off). */
  setActive(active: boolean, bimId?: string | null): void;
  /** ADR-449 Slice C — εναλλαγή στόχου βαφής (σώμα ↔ σοβάς). */
  setTargetLayer(layer: PolygonTargetLayer): void;
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
  targetLayer: 'body',
  targetBimId: null,
  selectedFaces: [],
  selectedFace: null,
  setActive: (active, bimId) => set((s) => ({
    active,
    targetBimId: active ? (bimId ?? s.targetBimId) : null,
    selectedFaces: active ? s.selectedFaces : [],
    selectedFace: active ? s.selectedFace : null,
  })),
  setTargetLayer: (layer) => set({ targetLayer: layer }),
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
