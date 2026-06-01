/**
 * Column 2Δ render palette (ADR-363 Phase 4 / Phase 8).
 *
 * Per-kind stroke + translucent fill colours για τον `ColumnRenderer`. Εξήχθη από
 * `ColumnRenderer.ts` (ADR-404 Phase 3 — file-size split, N.7.1) ώστε ο renderer να
 * μένει < 500 γρ. Καθαρό config (μηδέν logic) → εκτός size-cap.
 *
 * Industry convention — RC συμπαγή φόντα, steel cooler.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import type { ColumnKind } from '../types/column-types';

/** Stroke colour per kind. */
export const KIND_STROKE: Readonly<Record<ColumnKind, string>> = {
  'rectangular': '#5b6478',
  'circular':    '#3a3a40',
  'L-shape':     '#a07a2b',
  'T-shape':     '#3a5a78',
  'polygon':     '#5c8a3a',
  'shear-wall':  '#3a4048',
  'I-shape':     '#4a4a52',
  // ADR-363 Phase 2 «από περίγραμμα» — τοιχία ΟΣ, ίδια RC απόχρωση με shear-wall.
  'U-shape':     '#3a4048',
  'composite':   '#3a4048',
};

/** Translucent fill (rgba) per kind. ~22% opacity. */
export const KIND_FILL: Readonly<Record<ColumnKind, string>> = {
  'rectangular': 'rgba(140, 158, 178, 0.22)',
  'circular':    'rgba(96, 96, 102, 0.22)',
  'L-shape':     'rgba(192, 148, 56, 0.22)',
  'T-shape':     'rgba(110, 140, 178, 0.22)',
  'polygon':     'rgba(120, 170, 90, 0.22)',
  'shear-wall':  'rgba(70, 80, 90, 0.25)',
  'I-shape':     'rgba(95, 95, 110, 0.20)',
  // ADR-363 Phase 2 «από περίγραμμα» — τοιχία ΟΣ, ίδιο RC fill με shear-wall.
  'U-shape':     'rgba(70, 80, 90, 0.25)',
  'composite':   'rgba(70, 80, 90, 0.25)',
};
