/**
 * @fileoverview **ΓΡΑΜΜΑΤΑ ΠΟΥ ΜΠΕΡΔΕΥΕΙ Η ΑΝΑΓΝΩΣΗ** — οπτικά συγχεόμενα κεφαλαία ελληνικά σε σφραγίδες/σαρώσεις.
 * @module lib/string/ocr-glyph-fold
 * @related ADR-950 §8.2 · server/contacts/evidence-address-verification (ο καταναλωτής)
 *
 * 🔴 2026-11-23 (ζωντανός έλεγχος): η AI διάβασε «ΣΑΜΟΦΡΑΚΗΣ» στη σφραγίδα «ΣΑΜΟΘΡΑΚΗΣ». Θ και Φ είναι **κύκλος με
 * γραμμή** — σε φθαρμένο μελάνι η διαφορά είναι μια κατεύθυνση. Μια απλή απόσταση επεξεργασίας (κόστος 1 ανά γράμμα)
 * βάζει το «Θ→Φ» στο ίδιο ζύγι με το «Θ→Κ», που **δεν** συγχέεται ποτέ.
 *
 * Λύση: δύο λέξεις είναι «η ίδια ανάγνωση» όταν ταυτίζονται **αφού** κάθε γράμμα αντικατασταθεί από την **τάξη μορφής**
 * του. Οι τάξεις είναι στενές επίτηδες: μόνο ζεύγη που μοιράζονται σχεδόν όλο το σχήμα τους στα κεφαλαία.
 *
 * ⚠️ Δεν είναι ο σκελετός Unicode (`lib/unicode/skeleton`, TR39): εκείνος ενώνει **ίδια** σχήματα από **άλλο αλφάβητο**
 * (λατινικό Η ⇄ ελληνικό Η)· εδώ ενώνονται **διαφορετικά** γράμματα που μια φθαρμένη εκτύπωση κάνει να μοιάζουν.
 *
 * **Layering**: καθαρή.
 */

import { editDistance } from '@/lib/string/edit-distance';
import { normalizeGreekText } from '@/utils/greek-text';

/** Τάξεις μορφής (πεζά, χωρίς τόνους) — ο πρώτος χαρακτήρας κάθε τάξης είναι ο εκπρόσωπός της. */
const GLYPH_CLASSES: readonly string[] = [
  'οθφ', // κύκλος · κύκλος με οριζόντια γραμμή · κύκλος με κάθετη
  'ηνμ', // δύο κάθετες με γέφυρα / διαγώνιο
  'λδα', // τρίγωνα χωρίς/με βάση/με γραμμή
  'ρβ', // κάθετη με έναν/δύο θόλους
  'πγ', // κάθετη με οριζόντια κορυφή
];

const REPRESENTATIVE: ReadonlyMap<string, string> = new Map(
  GLYPH_CLASSES.flatMap((members) => [...members].map((letter) => [letter, members[0]] as const)),
);

/** Η λέξη με κάθε γράμμα στην τάξη μορφής του — «Σαμοφράκης» και «Σαμοθράκης» δίνουν το ίδιο. */
function ocrGlyphFold(text: string): string {
  const normalized = normalizeGreekText(text).replace(/ς/g, 'σ').replace(/\s+/g, ' ').trim();
  return [...normalized].map((char) => REPRESENTATIVE.get(char) ?? char).join('');
}

/**
 * Πόσα **πραγματικά** λάθη ανεχόμαστε για λέξη αυτού του μήκους — το `fuzziness: AUTO` του Elasticsearch
 * (0 ως 2 γράμματα · 1 ως 5 · 2 πάνω από 5). Οι οπτικές συγχύσεις **δεν** μετρούν: έχουν ήδη διπλωθεί.
 */
function allowedErrors(length: number): number {
  if (length <= 2) return 0;
  return length <= 5 ? 1 : 2;
}

/**
 * **«Μήπως εννοείτε…»** — η **μία** υπαρκτή ονομασία που απέχει λιγότερο από την ανάγνωση (ADR-950 §8.13), ή `null`.
 *
 * 🔴 2026-11-24 (ζωντανός έλεγχος): η σφραγίδα «ΣΑΜΟΘΡΑΚΗΣ» διαβάστηκε «ΣΑΜΟΓΡΑΦΗΣ» — γραμμές υπογραφής **πάνω** στο
 *    «ΘΡΑΚ». Δεν είναι πια μόνο οπτική σύγχυση (Θ/Φ), είναι **κρυμμένα** γράμματα: η ταύτιση τάξεων δεν το πιάνει.
 *
 * Πρότυπο: spell-correction με **περιορισμένο λεξικό** (Google «Did you mean», Elasticsearch `fuzzy`): ο υποψήφιος
 * είναι **μόνο** υπαρκτή ονομασία της γειτονιάς — ποτέ ελεύθερο κείμενο. Η απόσταση μετρά **μετά** το δίπλωμα των τάξεων
 * μορφής, άρα «Θ→Φ» κοστίζει 0 και κάθε άλλη αλλαγή 1 (Damerau/OSA, ο ΕΝΑΣ `editDistance`).
 * 🔑 Μοναδικότητα: ο νικητής πρέπει να απέχει **αυστηρά λιγότερο** από κάθε άλλον — ισοπαλία ⇒ καμία πρόταση.
 *    Η πρόταση μένει πρόταση: τη βλέπει άνθρωπος, με το τυπωμένο από κάτω, και την αποδέχεται ή όχι.
 */
export function closestUnderOcrConfusion(printed: string, names: readonly string[]): string | null {
  const target = ocrGlyphFold(printed);
  if (target === '') return null;
  const max = allowedErrors(target.length);
  let best: string | null = null;
  let bestDistance = max + 1;
  let tied = false;
  for (const name of new Set(names)) {
    const distance = editDistance(target, ocrGlyphFold(name), { transpositions: true, max });
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
      tied = false;
    } else if (distance === bestDistance && distance <= max && ocrGlyphFold(name) !== ocrGlyphFold(best ?? '')) {
      tied = true;
    }
  }
  return best === null || tied ? null : best;
}
