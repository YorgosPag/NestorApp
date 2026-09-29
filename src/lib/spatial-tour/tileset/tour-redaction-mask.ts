/**
 * @fileoverview **ΤΟ ΘΟΛΩΜΑ ΠΑΝΩ ΣΤΟ EQUIRECT** — ποια pixel ανήκουν σε μια θολωμένη περιοχή (κύκλος πάνω στη σφαίρα) και πόσο,
 * και η ανάμειξη «πρωτότυπο → θολωμένο» μέσα τους (ADR-884 Φ2ζ · §4.15 · Α8). Καθαρό, χωρίς `sharp` — ωμά bytes.
 * @related `equirect-to-cube.ts` (**η ίδια** σύμβαση pixel ⟷ yaw/pitch) · `server/spatial-tour/tour-tileset-render.ts` (ο καλών:
 *   φτιάχνει το θολωμένο και καλεί το `applyRedactions` πριν τον κύβο) · `types/spatial-tour.ts` (`TourRedactionRegion`)
 * @module lib/spatial-tour/tileset/tour-redaction-mask
 *
 * 🧭 **Κλειστή μορφή ανά γραμμή, όχι σάρωση όλης της εικόνας**: για γραμμή πλάτους `p`, τα pixel του κύκλου είναι ένα διάστημα
 *   μήκους `λc ± Δ` με `cos Δ = (cos R − sin p · sin pc) / (cos p · cos pc)` (σφαιρικός νόμος συνημιτόνων). Άρα κόστος ∝ εμβαδό
 *   της περιοχής, και η ραφή ±π (αναδίπλωση στήλης) και οι πόλοι (ολόκληρη γραμμή) βγαίνουν από τον ίδιο τύπο, χωρίς ειδικές
 *   περιπτώσεις.
 * 🔒 **Ποτέ λιγότερο από τη δηλωμένη ακτίνα**: μέσα στο `r` το θόλωμα είναι πλήρες· η ομαλή μετάβαση (ώστε να μη φαίνεται
 *   «κομμένος δίσκος») απλώνεται **έξω** από το `r`, ως `r·(1 + TOUR_REDACTION_FEATHER)`. Επικάλυψη δύο περιοχών ⇒ διπλή ανάμειξη
 *   = κάλυψη **≥** της μεγαλύτερης — ποτέ λιγότερη.
 */

import type { TourRedactionRegion } from '@/types/spatial-tour';

/**
 * **Η έκδοση της απόδοσης του θολώματος** — μπαίνει στο κλειδί των πλακιδίων (`redactionKeyMaterial`): αλλαγή αλγορίθμου ⇒
 * νέο κλειδί ⇒ νέα URL (τα πλακίδια σερβίρονται `immutable`).
 */
export const TOUR_REDACTION_RENDER_VERSION = 'r1';
/** Η ομαλή άκρη, ως κλάσμα της ακτίνας, **έξω** από αυτήν. */
export const TOUR_REDACTION_FEATHER = 0.2;
/**
 * **Πόσα pixel του πρωτοτύπου γίνονται ένα** στο θολωμένο αντίγραφο (σμίκρυνση → μεγέθυνση). 🔑 Όχι Gaussian: η σμίκρυνση
 * **καταστρέφει** την πληροφορία (δεν αντιστρέφεται με αποσυνέλιξη όπως ένα θόλωμα γνωστού πυρήνα), και κοστίζει κλάσμα του
 * χρόνου σε 8K. 48 ⇒ σε 8192 πλάτος, κελιά ~48 pixel: ένα πρόσωπο ~100 pixel γίνεται δύο-τρία κελιά χρώματος.
 */
export const TOUR_REDACTION_CELL_PX = 48;

/** Το πλάτος του σμικρυμένου αντιγράφου για εικόνα πλάτους `width` (ποτέ κάτω από 8 κελιά). */
export function redactionProxyWidth(width: number): number {
  return Math.max(8, Math.round(width / TOUR_REDACTION_CELL_PX));
}

const HALF_PI = Math.PI / 2;
const TWO_PI = 2 * Math.PI;

/** Η γωνιακή απόσταση δύο κατευθύνσεων (σφαιρικός νόμος συνημιτόνων) — η ΜΙΑ: ψήστης, πινέλο, hit-test. */
export function angularDistance(yawA: number, pitchA: number, yawB: number, pitchB: number): number {
  const cos = Math.sin(pitchA) * Math.sin(pitchB) + Math.cos(pitchA) * Math.cos(pitchB) * Math.cos(yawA - yawB);
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

/** Πόσο θολώνει ένα pixel σε γωνιακή απόσταση `d` από το κέντρο: 1 μέσα στο `r`, γραμμικά ως 0 στην εξωτερική άκρη. */
export function redactionAlpha(d: number, radius: number): number {
  if (d <= radius) return 1;
  const feather = radius * TOUR_REDACTION_FEATHER;
  return feather <= 0 ? 0 : Math.max(0, 1 - (d - radius) / feather);
}

/** Το μισό εύρος μήκους (`Δ`) του κύκλου στη γραμμή πλάτους `pitch` — `null` ⇒ η γραμμή δεν τον τέμνει· `≥ π` ⇒ όλη. */
function rowHalfSpan(pitch: number, region: TourRedactionRegion, outer: number): number | null {
  const lateral = Math.cos(pitch) * Math.cos(region.pitchRad);
  const vertical = Math.sin(pitch) * Math.sin(region.pitchRad);
  if (lateral < 1e-12) return vertical >= Math.cos(outer) ? Math.PI : null;
  const t = (Math.cos(outer) - vertical) / lateral;
  if (t > 1) return null;
  return t <= -1 ? Math.PI : Math.acos(t);
}

/** Οι γραμμές που μπορεί να αγγίζει ο κύκλος — η ζώνη πλάτους `pc ± R`, σφιγμένη στους πόλους. */
function rowBand(region: TourRedactionRegion, outer: number, height: number): readonly [number, number] {
  const rowOf = (pitch: number) => (0.5 - pitch / Math.PI) * height - 0.5;
  const top = Math.floor(rowOf(Math.min(HALF_PI, region.pitchRad + outer)));
  const bottom = Math.ceil(rowOf(Math.max(-HALF_PI, region.pitchRad - outer)));
  return [Math.max(0, top), Math.min(height - 1, bottom)];
}

/**
 * **Επισκέψου κάθε pixel μιας περιοχής** με το βάρος του (`0 < alpha ≤ 1`). Η στήλη αναδιπλώνεται στη ραφή· ένα pixel δεν
 * επισκέπτεται δύο φορές για την **ίδια** περιοχή.
 */
export function forEachRedactedPixel(
  width: number,
  height: number,
  region: TourRedactionRegion,
  visit: (pixel: number, alpha: number) => void,
): void {
  const outer = region.radiusRad * (1 + TOUR_REDACTION_FEATHER);
  const [top, bottom] = rowBand(region, outer, height);
  for (let y = top; y <= bottom; y++) {
    const pitch = (0.5 - (y + 0.5) / height) * Math.PI;
    const half = rowHalfSpan(pitch, region, outer);
    if (half === null) continue;
    const columnOf = (yaw: number) => (yaw / TWO_PI + 0.5) * width - 0.5;
    const first = half >= Math.PI ? 0 : Math.ceil(columnOf(region.yawRad - half));
    const last = half >= Math.PI ? width - 1 : Math.min(first + width - 1, Math.floor(columnOf(region.yawRad + half)));
    for (let x = first; x <= last; x++) {
      const column = ((x % width) + width) % width;
      const yaw = ((column + 0.5) / width - 0.5) * TWO_PI;
      const alpha = redactionAlpha(angularDistance(yaw, pitch, region.yawRad, region.pitchRad), region.radiusRad);
      if (alpha > 0) visit(y * width + column, alpha);
    }
  }
}

/**
 * **Θόλωσε επί τόπου** τις περιοχές του `target` (ωμό equirect, `channels` byte ανά pixel) αναμειγνύοντας προς το `blurred`
 * (ίδιες διαστάσεις). Επιστρέφει πόσα pixel άγγιξε — μηδέν μόνο αν δεν υπάρχει καμία περιοχή.
 */
export function applyRedactions(
  target: Uint8Array,
  blurred: Uint8Array,
  image: { readonly width: number; readonly height: number; readonly channels: number },
  regions: readonly TourRedactionRegion[],
): number {
  let touched = 0;
  for (const region of regions) {
    forEachRedactedPixel(image.width, image.height, region, (pixel, alpha) => {
      const at = pixel * image.channels;
      for (let c = 0; c < image.channels; c++) {
        target[at + c] = Math.round(target[at + c] + (blurred[at + c] - target[at + c]) * alpha);
      }
      touched++;
    });
  }
  return touched;
}
