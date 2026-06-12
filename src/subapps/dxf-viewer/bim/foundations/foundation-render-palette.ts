/**
 * Foundation 2Δ render palette (ADR-436, Slice 1).
 *
 * Per-kind stroke + translucent fill colours για τον `FoundationRenderer`.
 * Καθαρό config (μηδέν logic) → εκτός size-cap.
 *
 * Convention (ADR-445 v1.2): τα 3 kinds θεμελίωσης έχουν ΔΙΑΚΡΙΤΕΣ ΧΡΟΙΕΣ (όχι
 * αποχρώσεις — οι κοντινές αποχρώσεις sienna φαίνονταν ίδιες, Giorgio 2026-06-12):
 *   - πέδιλο (pad)        → sienna/καφέ  `#8a5a3c` (η αρχική ταυτότητα θεμελίωσης)
 *   - πεδιλοδοκός (strip) → teal/πράσινο `#2f7d6a`
 *   - συνδετήρια (tie)    → κεραμυδί     `#b5651d`
 * Ίδιες χροιές χρησιμοποιούνται και στα 3Δ faces (`elem-foundation-*`) → συνέπεια
 * κάτοψης ↔ προβολής.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4.2
 */

import type { FoundationKind } from '../types/foundation-types';

/** Stroke colour per kind (ΔΙΑΚΡΙΤΕΣ χροιές· περίγραμμα/άξονας διακεκομμένος). */
export const FOUNDATION_KIND_STROKE: Readonly<Record<FoundationKind, string>> = {
  'pad':      '#8a5a3c', // sienna/καφέ
  'strip':    '#2f7d6a', // teal/πράσινο
  'tie-beam': '#b5651d', // κεραμυδί/πορτοκαλί
};

/** Translucent fill (rgba) per kind. 28% opacity ώστε η διακριτή χροιά να διαβάζεται. */
export const FOUNDATION_KIND_FILL: Readonly<Record<FoundationKind, string>> = {
  'pad':      'rgba(138, 90, 60, 0.28)',  // #8a5a3c
  'strip':    'rgba(47, 125, 106, 0.28)', // #2f7d6a
  'tie-beam': 'rgba(181, 101, 29, 0.28)', // #b5651d
};
