/**
 * ADR-833 Φάση 4 — **ΤΟ ΣΥΜΒΟΛΟ ΕΝΟΣ ΧΕΙΡΙΣΤΗΡΙΟΥ ΠΙΝΑΚΑ**: το `+` και το `−`, γερμένα με τον
 * πίνακα. Ο ΕΝΑΣ ζωγράφος τους.
 *
 * ## Γιατί βγήκε από το `stamp-table-control-disc.ts` — και γιατί ΠΡΙΝ γραφτεί ο τρίτος
 * Ζούσε ιδιωτικά εκεί και εξυπηρετούσε **δύο** καταναλωτές μέσα από τον ίδιο δίσκο (⊕ εισαγωγής
 * §40, ⊖ διαγραφής §42). Το ⊕ της **προσθήκης φύλλου** είναι ο τρίτος — και ο πρώτος που **δεν
 * φοράει δίσκο**: κάθεται σε ορθογώνιο, γιατί ζει μέσα στη λωρίδα καρτελών και οφείλει να
 * μοιάζει με ό,τι υπάρχει δίπλα του, όχι με ξένο σώμα.
 *
 * Άρα το κοινό δεν είναι «ο δίσκος» — είναι το **σύμβολο**. Ένα αντίγραφο των έξι γραμμών θα
 * ήταν sibling clone (N.18 / CHECK 3.28), και το ακριβό δεν είναι οι γραμμές: είναι ο **κανόνας
 * προβολής** που κουβαλούν.
 *
 * ## 🔴 Ο κανόνας: τα άκρα γεννιούνται σε **mm** και προβάλλονται ένα προς ένα
 * Ποτέ ως σταθερές μετατοπίσεις πάνω στο προβεβλημένο κέντρο: η δεύτερη διαδρομή θα έδινε
 * πάντα **ίσιο** σύμβολο, δηλαδή θα ακύρωνε σιωπηλά την περιστροφή του πίνακα — και θα φαινόταν
 * σωστή σε κάθε test με γωνία μηδέν.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-control-glyph
 * @see rendering/entities/table/stamp-table-control-disc.ts — ο πρώτος και δεύτερος καταναλωτής
 * @see rendering/entities/table/stamp-table-worksheet-tabs.ts — ο τρίτος (⊕ προσθήκης φύλλου)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §40, §42
 */

import type { TableFramePoint } from '../../../types/table-entity';
import type { StampTableContext } from './stamp-table-layout';

/**
 * Το μισό μήκος κάθε σκέλους του συμβόλου, ως **κλάσμα της ακτίνας** του δίσκου.
 *
 * Κλάσμα και όχι δεύτερη σταθερά σε px: το σύμβολο οφείλει να μένει αναλογικό μέσα στο
 * χειριστήριό του. Δύο ανεξάρτητοι αριθμοί θα άφηναν το σύμβολο να ξεχειλίσει την πρώτη φορά
 * που κάποιος μικρύνει την ακτίνα — και θα το ανακάλυπτε στην οθόνη, όχι στον κώδικα.
 */
const GLYPH_ARM_RATIO = 0.5;

/** Ποιο σύμβολο ζωγραφίζεται. Το `−` είναι το `+` **χωρίς** το κάθετο σκέλος. */
export type TableControlGlyph = 'plus' | 'minus';

/**
 * Το μισό μήκος σκέλους σε px, από την **ακτίνα** ενός χειριστηρίου.
 *
 * 🔑 Εξάγεται ώστε ο τρίτος καταναλωτής — που **δεν** έχει δίσκο — να μπορεί να ζητήσει το
 * **ίδιο μέγεθος συμβόλου** με τους δύο πρώτους. Ένα `+` σε αυτόν τον πίνακα έχει **ένα**
 * μέγεθος, ανεξάρτητα από το σχήμα που το περιβάλλει· διαφορετικά μεγέθη θα διάβαζαν ως
 * διαφορετικές πράξεις.
 */
export function tableControlGlyphArmPx(radiusPx: number): number {
  return radiusPx * GLYPH_ARM_RATIO;
}

/** Χρώμα και πάχος του συμβόλου — ο καλών έχει ήδη διαλέξει φάση. */
export interface TableControlGlyphStyle {
  readonly glyphHex: string;
  readonly glyphWidthPx: number;
}

/**
 * Το σύμβολο, **γερμένο με τον πίνακα** — δες τον κανόνα στην κεφαλίδα.
 *
 * @param armPx Το μισό μήκος κάθε σκέλους σε px οθόνης· δες {@link tableControlGlyphArmPx}.
 */
export function stampTableControlGlyph(
  rc: StampTableContext,
  centerMm: TableFramePoint,
  armPx: number,
  glyph: TableControlGlyph,
  style: TableControlGlyphStyle,
): void {
  const { ctx } = rc;
  const armMm = armPx / rc.pxPerMm;
  const { u, v } = centerMm;
  const left = rc.toScreen(u - armMm, v);
  const right = rc.toScreen(u + armMm, v);

  ctx.save();
  ctx.strokeStyle = style.glyphHex;
  ctx.lineWidth = style.glyphWidthPx;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  // Το κάθετο σκέλος είναι **όλη** η διαφορά ανάμεσα στα δύο σύμβολα. Δύο ξεχωριστές
  // συναρτήσεις θα ήταν δύο αντίγραφα του οριζόντιου σκέλους — και δύο ευκαιρίες να αποκλίνει
  // το μήκος του, δηλαδή ένα `+` και ένα `−` που δεν μοιάζουν αδέλφια στην οθόνη.
  if (glyph === 'plus') {
    const top = rc.toScreen(u, v - armMm);
    const bottom = rc.toScreen(u, v + armMm);
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
  }
  ctx.stroke();
  ctx.restore();
}
