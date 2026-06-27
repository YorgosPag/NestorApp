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
import type { FaceAppearance, FaceAppearanceMap } from '../../bim/types/face-appearance-types';

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
   * Per-face clipboard: η αντιγραμμένη εμφάνιση ΜΙΑΣ όψης (ή null = άδειο). Επιβιώνει
   * του open/close ώστε «αντιγραφή» από μία όψη → «επικόλληση» σε άλλη (Ctrl+C / Ctrl+V).
   */
  readonly clipboard: FaceAppearance | null;
  /**
   * Entity-level clipboard (ADR-539 Φ4a): το αντιγραμμένο ΟΛΟΚΛΗΡΟ map μιας entity
   * (όλες οι όψεις) ή null = άδειο. Ξεχωριστό slot από το per-face clipboard ώστε
   * Ctrl+Shift+C/V (entity) να μην πατάει το Ctrl+C/V (face).
   */
  readonly entityClipboard: FaceAppearanceMap | null;
  /** Άνοιγμα του menu στο `screen` για `target` (δεξί-κλικ σε όψη σε Polygon Mode). */
  show(target: FaceMenuTarget, screen: { x: number; y: number }): void;
  /** Κλείσιμο του menu (τα clipboards ΜΕΝΟΥΝ). */
  hide(): void;
  /** Set του per-face clipboard (copy face). */
  setClipboard(appearance: FaceAppearance | null): void;
  /** Set του entity-level clipboard (copy entity). */
  setEntityClipboard(map: FaceAppearanceMap | null): void;
}

export const useFaceContextMenuStore = create<FaceContextMenuState>((set) => ({
  open: false,
  screen: null,
  target: null,
  clipboard: null,
  entityClipboard: null,
  show: (target, screen) => set({ open: true, target, screen }),
  hide: () => set({ open: false, target: null, screen: null }),
  setClipboard: (appearance) => set({ clipboard: appearance }),
  setEntityClipboard: (map) => set({ entityClipboard: map }),
}));
