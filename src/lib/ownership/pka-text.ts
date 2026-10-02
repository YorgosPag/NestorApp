/**
 * @module lib/ownership/pka-text
 * @description **Ανάγνωση του κειμένου ενός ΠΚΑ** (ADR-900 §3.8) — καθαρή, ανεκτική, ποτέ μαντεψιά.
 *
 * Εξάγει από το κείμενο του Πιστοποιητικού Κτηματογραφούμενου Ακινήτου:
 * - **ΚΑΕΚ** — μέσω του ΕΝΟΣ SSoT (`lib/geo/kaek.ts` → `findKaekCodes`)·
 * - **δικαιούχους** — γραμμή με **έγκυρο** ΑΦΜ (mod-11, `greek-vat-number`) ⇒ τα κεφαλαία ελληνικά
 *   ονόματα της ίδιας γραμμής είναι ο δικαιούχος·
 * - **κωδικό επαλήθευσης** — μετά από ετικέτα «κωδικός επαλήθευσης/επιβεβαίωσης».
 *
 * ⚠️ **Η διάταξη του εγγράφου ΔΕΝ έχει επιβεβαιωθεί σε πραγματικό ΠΚΑ** (ADR-900 §3.8 · §8). Γι' αυτό ο
 * αναγνώστης είναι **ανεκτικός προς την άρνηση**: ό,τι δεν βρει επιστρέφεται κενό, και ο κριτής
 * (`verification-verdict.ts`) το στέλνει σε **άνθρωπο** (`kaek-unreadable` · `beneficiaries-unreadable` ·
 * `tax-id-absent`). Μέχρι να επιβεβαιωθεί ο εκδότης, **καμία** αυτόματη έγκριση δεν συμβαίνει
 * ούτως ή άλλως (`issuer-unconfirmed`). Όταν έρθει δείγμα, βαθμονομείται **αυτό** το αρχείο.
 *
 * 🔒 Ο ΑΦΜ επιστρέφεται **καθαρός μόνο στη μνήμη** — ο καλών (service) τον κάνει HMAC πριν από
 * οποιαδήποτε εγγραφή. Ποτέ σε log.
 *
 * **Layering**: καθαρή — καμία εισαγωγή Firestore/δικτύου.
 */

import { findKaekCodes } from '@/lib/geo/kaek';
import { isValidGreekVat } from '@/lib/validation/greek-vat-number';

export interface PkaBeneficiary {
  /** Το όνομα όπως γράφεται στο έγγραφο (κεφαλαία, χωρίς ετικέτες). */
  readonly name: string;
  /** Ο ΑΦΜ (9 ψηφία, έγκυρος mod-11) — **μόνο στη μνήμη**. */
  readonly taxId: string | null;
}

export interface PkaReading {
  readonly kaekCodes: ReadonlyArray<string>;
  readonly beneficiaries: ReadonlyArray<PkaBeneficiary>;
  readonly verificationCode: string | null;
}

/** Λέξεις-ετικέτες που **δεν** είναι μέρος ονόματος (κανονικοποιημένες σε κεφαλαία χωρίς τόνους). */
const LABEL_WORDS = new Set([
  'ΑΦΜ', 'Α.Φ.Μ', 'ΔΙΚΑΙΟΥΧΟΣ', 'ΔΙΚΑΙΟΥΧΟΙ', 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ', 'ΕΠΩΝΥΜΙΑ', 'ΕΠΩΝΥΜΟ', 'ΟΝΟΜΑ',
  'ΠΑΤΡΩΝΥΜΟ', 'ΤΟΥ', 'ΤΗΣ', 'ΠΟΣΟΣΤΟ', 'ΔΙΚΑΙΩΜΑ', 'ΚΥΡΙΟΤΗΤΑ', 'ΠΛΗΡΗΣ', 'ΨΙΛΗ', 'ΕΠΙΚΑΡΠΙΑ',
]);

/** Ενιαία λέξη ονόματος: ελληνικά κεφαλαία (με/χωρίς τόνους), συστολή `ΚΩΝ/ΝΟΣ`, παύλα σύνθετου. */
const NAME_WORD = /^[\p{Script=Greek}][\p{Script=Greek}/-]*[\p{Script=Greek}]$/u;

function stripTones(word: string): string {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function isNameWord(word: string): boolean {
  const bare = stripTones(word);
  return NAME_WORD.test(word) && bare === bare.toUpperCase() && !LABEL_WORDS.has(bare.replace(/[.:]$/, ''));
}

/** Ο **ΑΦΜ** μιας γραμμής: ακριβώς ένας έγκυρος εννιαψήφιος, μόνος του (όχι κομμάτι μεγαλύτερου αριθμού). */
function taxIdOfLine(line: string): string | null {
  const candidates = [...line.matchAll(/(?<!\d)\d{9}(?!\d)/g)].map((match) => match[0]).filter(isValidGreekVat);
  return candidates.length === 1 ? candidates[0] : null;
}

function beneficiaryOfLine(line: string): PkaBeneficiary | null {
  const taxId = taxIdOfLine(line);
  if (taxId === null) return null;
  const words = line.split(/[\s,;:|]+/).filter(isNameWord);
  return words.length >= 2 ? { name: words.join(' '), taxId } : null;
}

const VERIFICATION_LABEL = /κωδικ\S*\s+(?:επαληθευσ\S*|επιβεβαιωσ\S*)\s*[:：]?\s*([A-Za-z0-9-]{6,64})/iu;

/** Η ανάγνωση. Ίδιο κείμενο ⇒ ίδια ανάγνωση. */
export function readPkaText(pages: ReadonlyArray<string>): PkaReading {
  const text = pages.join('\n');
  const lines = text.split(/\r?\n/);

  const beneficiaries: PkaBeneficiary[] = [];
  for (const line of lines) {
    const beneficiary = beneficiaryOfLine(line);
    if (beneficiary !== null && !beneficiaries.some((known) => known.taxId === beneficiary.taxId)) {
      beneficiaries.push(beneficiary);
    }
  }

  const code = VERIFICATION_LABEL.exec(stripTones(text));
  return {
    kaekCodes: findKaekCodes(text),
    beneficiaries,
    verificationCode: code === null ? null : code[1],
  };
}
