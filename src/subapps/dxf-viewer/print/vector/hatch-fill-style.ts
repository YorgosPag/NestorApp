/**
 * ADR-667 — Χρώμα **γεμίσματος** γραμμοσκίασης για το vector PDF (SSoT).
 *
 * **Κάτοπτρο του screen SSoT** (`HatchRenderer.ts:210`: `hatch.fillColor ?? entity.color`),
 * περασμένο από το **ΙΔΙΟ** plot-style policy με τα υπόλοιπα (mono / grayscale / white-safe)
 * ⇒ vector και raster έξοδος μένουν οπτικά ταυτόσημες (ADR-454).
 *
 * **Γιατί ξεχωριστό αρχείο:** το χρειάζονται **δύο** καταναλωτές — ο `scene-vector-emitter`
 * (solid γέμισμα + γραμμές μοτίβου) και το pre-pass `scene-hatch-line-resolver` (μελάνι του
 * ριγέ κελιού). Αντιγραφή σε δύο σημεία = sibling clone (N.18)· import από τον emitter στο
 * resolver = κύκλος (ο emitter εισάγει τους τύπους του resolver).
 *
 * @module subapps/dxf-viewer/print/vector/hatch-fill-style
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md
 */

import type { HatchEntity } from '../../types/entities';
import { applyPlotColor, type PrintColorPolicy } from '../../config/print-color-policy';
import { parseHex, type Rgb } from '../../config/color-math';

/** Ουδέτερο μελάνι όταν το hex δεν αναλύεται (ίδιο fallback με τον emitter). */
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** Χρώμα γεμίσματος γραμμοσκίασης (plot-safe hex) — κάτοπτρο οθόνης + ADR-454 policy. */
export function resolveHatchFillHex(e: HatchEntity, policy: PrintColorPolicy): string {
  return applyPlotColor(e.fillColor ?? e.color ?? null, e.colorAci ?? null, policy);
}

/** Ό,τι και το {@link resolveHatchFillHex}, ως RGB (ο jsPDF θέλει κανάλια, όχι hex). */
export function resolveHatchFillRgb(e: HatchEntity, policy: PrintColorPolicy): Rgb {
  return parseHex(resolveHatchFillHex(e, policy)) ?? BLACK;
}
