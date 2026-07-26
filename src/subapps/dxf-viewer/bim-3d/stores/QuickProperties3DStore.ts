/**
 * QuickProperties3DStore — hover state for the 3D viewport BIM entity tooltip.
 *
 * Updated by BimViewport3D (800ms debounced raycasting on mousemove).
 * Consumed by StatusBarBim3DHoverLeaf (ADR-040 micro-leaf, status-bar readout).
 *
 * ADR-366 B.2.Q1.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface QuickProperties3DState {
  hoveredBimId: string | null;
  hoveredBimType: string | null;
  /**
   * ADR-715 — το `FaceKey` της όψης κάτω από τον κέρσορα (`null` σε legacy single-material mesh).
   *
   * Υπάρχει ώστε ο readout να μπορεί να πει «Κοντόστυλο» αντί «Στύλος» όταν ο κέρσορας είναι
   * **μέσα** στη θαμμένη ζώνη: ο χρήστης πρέπει να βλέπει τι θα επιλέξει **πριν** πατήσει
   * (Revit status bar). Χωρίς αυτό, το κλικ θα επέλεγε Τμήμα χωρίς καμία προηγούμενη ένδειξη —
   * και μια επιλογή που «άλλαξε μόνη της» διαβάζεται ως σφάλμα, όχι ως λειτουργία.
   */
  hoveredFaceKey: string | null;
  cursorX: number;
  cursorY: number;
}

interface QuickProperties3DActions {
  setHovered(bimId: string, bimType: string, x: number, y: number, faceKey?: string | null): void;
  clearHover(): void;
}

type QuickProperties3DStoreType = QuickProperties3DState & QuickProperties3DActions;

export const useQuickProperties3DStore = create<QuickProperties3DStoreType>()(
  subscribeWithSelector((set) => ({
    hoveredBimId: null,
    hoveredBimType: null,
    hoveredFaceKey: null,
    cursorX: 0,
    cursorY: 0,

    setHovered: (bimId, bimType, x, y, faceKey = null) =>
      set({ hoveredBimId: bimId, hoveredBimType: bimType, hoveredFaceKey: faceKey, cursorX: x, cursorY: y }),

    clearHover: () =>
      set({ hoveredBimId: null, hoveredBimType: null, hoveredFaceKey: null, cursorX: 0, cursorY: 0 }),
  })),
);
