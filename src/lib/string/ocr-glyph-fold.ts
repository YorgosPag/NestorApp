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

/** Ίδια ανάγνωση με διαφορά **μόνο** σε οπτικά συγχεόμενα γράμματα; */
export function sameUnderOcrConfusion(a: string, b: string): boolean {
  const left = ocrGlyphFold(a);
  return left !== '' && left === ocrGlyphFold(b);
}
