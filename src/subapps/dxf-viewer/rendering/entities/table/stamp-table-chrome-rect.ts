/**
 * ADR-833 Φάση 3 — **ΠΩΣ ΒΑΦΕΤΑΙ ΕΝΑ ΟΡΘΟΓΩΝΙΟ ΧΡΩΜΙΟΥ ΤΟΥ ΠΙΝΑΚΑ**: γέμισμα, πλύσιμο
 * hover, περίγραμμα. Τρεις κινήσεις, ένα σημείο.
 *
 * ## Γιατί εξήχθη — και γιατί ΠΡΙΝ γραφτεί ο τρίτος καταναλωτής
 * Οι τρεις συναρτήσεις ζούσαν ιδιωτικές στο `stamp-table-indicator.ts` με **δύο** καταναλωτές
 * ήδη μέσα του (η υποδιαίρεση ζώνης, το κουμπί «επιλογή όλων»), και το ίδιο το αρχείο έγραφε
 * ρητά γιατί ο δεύτερος τις επαναλαμβάνει αυτούσιες:
 *
 * > *«Οι τρεις πρώτες κλήσεις είναι ΟΙ ΙΔΙΕΣ με του `stampTick`, με την ίδια σειρά και για
 * > τους ίδιους λόγους (§30). Αυτό δεν είναι εξοικονόμηση γραμμών — είναι η μετάφραση της
 * > μέτρησης […] αντιγράφουμε τον **κανόνα** “η γωνία φοράει ό,τι φοράει μια ενεργή
 * > υποδιαίρεση”.»*
 *
 * Η λωρίδα καρτελών (ADR-833 Φ3) είναι ο **τρίτος**. Ένα αντίγραφο σε δεύτερο αρχείο θα ήταν
 * ακριβώς ο sibling clone που πιάνει το CHECK 3.28 (jscpd, N.18) — και το σοβαρό δεν είναι οι
 * γραμμές: θα ήταν **δεύτερη ευκαιρία να γραφτεί ανάποδα η σειρά**. Και η σειρά είναι
 * προδιαγραφή, όχι γούστο (ADR-739 §30): το πλύσιμο μπαίνει **πάνω** από το γέμισμα (αλλιώς
 * δεν φαίνεται) και **κάτω** από περίγραμμα και ετικέτα (οι διαχωριστικές γραμμές πρέπει να
 * μένουν συνεχείς, και το γράμμα δεν επιτρέπεται να θολώσει τη στιγμή που το στοχεύεις).
 *
 * ⚠️ **Καθαρή μετακίνηση**: τα σώματα ήρθαν αυτούσια — δεν «καθαρίστηκαν», δεν συγχωνεύτηκαν
 * σε μία παραμετρική συνάρτηση. Μια `paintChromeRect(rc, rect, { fill, wash, stroke })` θα
 * ήταν **ένα σώμα με τρεις συμπεριφορές κρυμμένες σε `if`**, δηλαδή η ακριβώς αντίθετη κίνηση
 * από SSoT.
 *
 * @module rendering/entities/table/stamp-table-chrome-rect
 * @see rendering/entities/table/stamp-table-indicator.ts — ο πρώτος και δεύτερος καταναλωτής
 * @see rendering/entities/table/stamp-table-worksheet-tabs.ts — ο τρίτος (ADR-833 Φ3)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §30, §43
 */

import { TABLE_INDICATOR } from '../../../config/color-config';
import type { TableRectMm } from '../../../bim/table/table-layout-types';
import { traceRectMm, type StampTableContext } from './stamp-table-layout';

/**
 * Το γέμισμα: ουδέτερο γκρι, ή το **ενεργό** μπλε.
 *
 * Τα δύο χρώματα έρχονται από το {@link TABLE_INDICATOR} και **δεν** παραμετροποιούνται: ο
 * κανόνας «η ενεργή κατάσταση του πίνακα είναι μπλε» παραμένει αληθής **εξ ορισμού** για κάθε
 * κομμάτι χρωμίου — υποδιαίρεση ζώνης, γωνία, καρτέλα φύλλου. Ένα τρίτο χρώμα κάπου θα ήταν η
 * πρώτη ευκαιρία η λωρίδα να πει «ενεργό» με άλλη λέξη από ό,τι ο δείκτης.
 */
export function fillTableChromeRect(
  rc: StampTableContext,
  rect: TableRectMm,
  active: boolean,
): void {
  const { ctx } = rc;
  ctx.save();
  ctx.fillStyle = active ? TABLE_INDICATOR.activeFillHex : TABLE_INDICATOR.fillHex;
  traceRectMm(rc, rect);
  ctx.fill();
  ctx.restore();
}

/**
 * ADR-739 §30 — το ημιδιαφανές στρώμα του hover, **πάνω σε ό,τι κι αν** έχει ήδη ζωγραφιστεί.
 *
 * Δεν ξέρει — και δεν επιτρέπεται να ξέρει — αν από κάτω είναι το ουδέτερο γκρι ή το ενεργό
 * μπλε. Αυτή ακριβώς η άγνοια είναι που κάνει **έναν** κανόνα να απαντά και στις δύο
 * καταστάσεις· δες το σκεπτικό στο {@link TABLE_INDICATOR.hoverWashRgba}.
 */
export function washTableChromeRect(rc: StampTableContext, rect: TableRectMm): void {
  const { ctx } = rc;
  ctx.save();
  ctx.fillStyle = TABLE_INDICATOR.hoverWashRgba;
  traceRectMm(rc, rect);
  ctx.fill();
  ctx.restore();
}

/** Το περίγραμμα — **ρητά συμπαγές**, δες το σχόλιο μέσα. */
export function strokeTableChromeRect(rc: StampTableContext, rect: TableRectMm): void {
  const { ctx } = rc;
  ctx.save();
  ctx.strokeStyle = TABLE_INDICATOR.lineHex;
  ctx.lineWidth = TABLE_INDICATOR.lineWidthPx;
  // Ρητά συμπαγής: το `stampTableBorders` μπορεί να έχει αφήσει διακεκομμένο μοτίβο πάνω
  // στο ίδιο context — το `save/restore` προστατεύει τη ΔΙΚΗ μας κλήση, όχι την επόμενη.
  ctx.setLineDash([]);
  traceRectMm(rc, rect);
  ctx.stroke();
  ctx.restore();
}
