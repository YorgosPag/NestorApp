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

/**
 * Χρώμα γεμίσματος γραμμοσκίασης (plot-safe hex) — κάτοπτρο οθόνης + ADR-454 policy.
 *
 * 🔴 ADR-739 Φ.Ε/Φ1 — ρόλος **`'fill'`**: ο κανόνας «κοντά στο λευκό → μαύρο» υπάρχει για να
 * μη χαθεί **μελάνι** σε λευκό χαρτί. Ένα γέμισμα δεν είναι μελάνι — είναι **φόντο**, και
 * ένα ανοιχτόχρωμο φόντο που γίνεται συμπαγές μαύρο καταπίνει τα γράμματα που στέκονται
 * πάνω του (μετρημένο: γκρίζα κεφαλίδα πίνακα `#EDEDED` = 237 ≥ 234,6 → `PRINT_BLACK`).
 * Είναι **ακριβώς** το επιχείρημα που ο ADR-667 έγραψε για το `emitHatchBackground` — εκεί
 * λύθηκε με παράκαμψη του policy· εδώ λύνεται μέσα στο policy, ώστε να υπάρχει **ένας**
 * κανόνας και όχι δύο.
 */
export function resolveHatchFillHex(e: HatchEntity, policy: PrintColorPolicy): string {
  return applyPlotColor(e.fillColor ?? e.color ?? null, e.colorAci ?? null, policy, 'fill');
}

/** Ό,τι και το {@link resolveHatchFillHex}, ως RGB (ο jsPDF θέλει κανάλια, όχι hex). */
export function resolveHatchFillRgb(e: HatchEntity, policy: PrintColorPolicy): Rgb {
  return parseHex(resolveHatchFillHex(e, policy)) ?? BLACK;
}
