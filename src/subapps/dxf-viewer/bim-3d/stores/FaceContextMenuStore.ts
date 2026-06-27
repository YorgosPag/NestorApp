/**
 * FaceContextMenuStore — micro-store για το per-face context menu του Cinema 4D
 * «Polygon Mode» (ADR-539 Φ3f). Mirror του `Grip3DContextMenuStore`.
 *
 * Κρατά την ελάχιστη low-frequency UI κατάσταση που χρειάζεται το δεξί-κλικ σε όψη:
 * αν είναι ανοιχτό, πού (client px) και ποια όψη (`bimId` + `FaceKey`) στοχεύει. Ο
 * (non-React) pointer handler το ανοίγει σε `contextmenu` πάνω σε όψη (Polygon Mode)·
 * ο React `FaceContextMenu` leaf το διαβάζει. ΕΠΙΣΗΣ κρατά ένα μικρό **clipboard**
 * (copy/paste appearance) που επιβιώνει του open/close — μηδέν high-frequency δεδομένα
 * (ADR-040: οι orchestrators δεν subscribe-άρουν εδώ).
 *
 * @see bim-3d/viewport/grips/FaceContextMenu.tsx — ο React leaf
 * @see bim-3d/stores/Grip3DContextMenuStore.ts — το πρότυπο
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { create } from 'zustand';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';

/** Η όψη που στοχεύει το menu: ποια entity + ποιο `FaceKey`. */
export interface FaceMenuTarget {
  readonly bimId: string;
  readonly faceKey: string;
}

interface FaceContextMenuState {
  /** True όσο το menu είναι ανοιχτό. */
  readonly open: boolean;
  /** Screen position (client px) όπου αγκυρώνεται το menu, ή null όταν κλειστό. */
  readonly screen: { readonly x: number; readonly y: number } | null;
  /** Η όψη που αφορά το menu, ή null όταν κλειστό. */
  readonly target: FaceMenuTarget | null;
  /**
   * Copy/paste clipboard: η αντιγραμμένη εμφάνιση όψης (ή null = άδειο). Επιβιώνει
   * του open/close ώστε «αντιγραφή» από μία όψη → «επικόλληση» σε άλλη.
   */
  readonly clipboard: FaceAppearance | null;
  /** Άνοιγμα του menu στο `screen` για `target` (δεξί-κλικ σε όψη σε Polygon Mode). */
  show(target: FaceMenuTarget, screen: { x: number; y: number }): void;
  /** Κλείσιμο του menu (το clipboard ΜΕΝΕΙ). */
  hide(): void;
  /** Set του clipboard (copy). */
  setClipboard(appearance: FaceAppearance | null): void;
}

export const useFaceContextMenuStore = create<FaceContextMenuState>((set) => ({
  open: false,
  screen: null,
  target: null,
  clipboard: null,
  show: (target, screen) => set({ open: true, target, screen }),
  hide: () => set({ open: false, target: null, screen: null }),
  setClipboard: (appearance) => set({ clipboard: appearance }),
}));
