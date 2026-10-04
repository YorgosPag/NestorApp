/**
 * @fileoverview **Η ΜΙΑ ρύθμιση zoom θεατή φωτογραφίας** — modal φωτογραφίας και πάνελ προεπισκόπησης (ADR-899 §9 θέμα 3).
 * @module components/shared/media/viewer/photo-view-zoom
 *
 * Πριν ζούσαν σκόρπια `0.25`/`8` (modal, και ξανά μέσα στα κουμπιά του) και `0.1`/`10` (πάνελ) — δύο θεατές της ίδιας
 * φωτογραφίας με άλλα όρια και άλλο βήμα.
 *
 * 🏆 Google Photos / Apple Photos: το ελάχιστο είναι **«χωρά»** (1) — κάτω από αυτό η φωτογραφία απλώς μικραίνει μέσα σε
 * άδειο κουτί· pan μόνο όσο η εικόνα ξεπερνά το κουτί· διπλό κλικ = μεγέθυνση στο σημείο. Κουμπιά πολλαπλασιαστικά
 * (Figma/Revit): 1 → 8 σε ~5 κλικ.
 */

import type { ZoomPanConfig } from '@/hooks/useZoomPan';

export const PHOTO_VIEW_ZOOM = {
  minZoom: 1,
  maxZoom: 8,
  zoomFactor: 1.5,
  defaultZoom: 1,
  confinePan: true,
  doubleClickZoom: 2.5,
} as const satisfies ZoomPanConfig;
