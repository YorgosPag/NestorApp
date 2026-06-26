/**
 * PolygonMode3DStore — micro-store για το Cinema 4D «Polygon Mode» (ADR-539).
 *
 * Κρατά την ελάχιστη low-frequency UI κατάσταση: αν το mode είναι ενεργό και ποια όψη
 * (`bimId` + `FaceKey`) είναι επιλεγμένη. Ο (non-React) pointer handler γράφει το
 * `selectedFace` στο click σε όψη· το `PolygonMaterialPanel` το διαβάζει ώστε το επόμενο
 * swatch click να εφαρμόσει υλικό/χρώμα σε εκείνη την όψη. Μηδέν high-frequency δεδομένα
 * (καμία θέση κέρσορα) — mirror του `Grip3DContextMenuStore` (ADR-040: οι orchestrators
 * δεν subscribe-άρουν εδώ).
 *
 * @see bim-3d/ui/PolygonMaterialPanel.tsx — apply
 * @see bim-3d/viewport/use-bim3d-pointer-handlers.ts — face pick
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { create } from 'zustand';

/** Η επιλεγμένη όψη: ποια entity + ποιο `FaceKey`. */
export interface SelectedFace3D {
  readonly bimId: string;
  readonly faceKey: string;
}

interface PolygonMode3DState {
  /** True όταν το Polygon Mode είναι ενεργό (κλικ → επιλογή όψης αντί entity). */
  readonly active: boolean;
  /** Η τρέχουσα επιλεγμένη όψη, ή null. */
  readonly selectedFace: SelectedFace3D | null;
  /** Toggle του mode (καθαρίζει την επιλογή όψης όταν απενεργοποιείται). */
  toggle(): void;
  /** Ρητό set του active (καθαρίζει επιλογή όταν off). */
  setActive(active: boolean): void;
  /** Set/clear της επιλεγμένης όψης. */
  selectFace(face: SelectedFace3D | null): void;
  /** Πλήρες reset (off + καμία όψη). */
  reset(): void;
}

export const usePolygonMode3DStore = create<PolygonMode3DState>((set) => ({
  active: false,
  selectedFace: null,
  toggle: () => set((s) => ({ active: !s.active, selectedFace: s.active ? null : s.selectedFace })),
  setActive: (active) => set((s) => ({ active, selectedFace: active ? s.selectedFace : null })),
  selectFace: (face) => set({ selectedFace: face }),
  reset: () => set({ active: false, selectedFace: null }),
}));
