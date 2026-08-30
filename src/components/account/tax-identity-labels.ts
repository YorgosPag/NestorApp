/**
 * @fileoverview **ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΑΡΝΗΣΕΩΝ ΤΟΥ ΑΦΜ** — πίνακας, ποτέ παρεμβολή.
 * @related ADR-827 §9.20 · services/account/tax-identity.service.ts · CHECK 3.8
 * @module components/account/tax-identity-labels
 *
 * 🔴 **ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΠΑΡΕΜΒΟΛΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΑΙΤΗΣΗ ΠΥΛΗΣ.** Το προφανές
 * `` t(`account.profile.${reason}`) `` είναι **δυναμικό κλειδί**: η **CHECK 3.8**
 * ψάχνει **κυριολεκτικά** `t('key')` ⇒ δεν το βλέπει, και ο τεμαχιστής δεν το
 * επιλύει. Το ίδιο σχήμα έχει ήδη τεκμηριωθεί **τρεις** φορές στο ADR-827 ως
 * τυφλό σημείο (Κ · Λ · Μ) — αυτό είναι το τέταρτο που **δεν** γεννήθηκε.
 *
 * 🔑 **Και το κείμενο της άρνησης ΔΕΝ είναι διακοσμητικό**: είναι η **μόνη** οδηγία
 * διόρθωσης που παίρνει ο άνθρωπος. Ωμό κλειδί εδώ σημαίνει ότι κάποιος κοιτάζει
 * έναν σωστό-φαινομενικά αριθμό και διαβάζει `vat-check-digit-invalid` — δηλαδή
 * **αδιέξοδο**.
 *
 * ⚠️ Ο τύπος `Record<TaxIdentityRejection, string>` ⇒ **τρίτος λόγος άρνησης δεν
 * μεταγλωττίζεται** χωρίς κείμενο. Το κλειστό σύνολο μένει κλειστό.
 */

import type { TaxIdentityRejection } from '@/services/account/tax-identity.service';

/**
 * ⚠️ **ΟΛΟΚΛΗΡΑ ΚΥΡΙΟΛΕΚΤΙΚΑ, ΧΩΡΙΣ `const K = ...` ΚΑΙ ΧΩΡΙΣ ΠΑΡΕΜΒΟΛΗ** — και
 * είναι **απόφαση**, όχι φλυαρία.
 *
 * Το γειτονικό `listing-agreement-labels.ts` χτίζει τα δικά του με πρόθεμα
 * (`` `${K}.exclusive-agency` ``). Ο **τεμαχιστής** τα επιλύει (διαβάζει σταθερές
 * module από το AST), αλλά η **CHECK 3.8 ψάχνει κυριολεκτικά** `t('key')` ⇒ είναι
 * **δομικά τυφλή** σε ό,τι χτίζεται. Μετρημένο 2026-08-29 στο
 * `.claude-rules/pending-ratchet-work.md`: **16** κλειδιά του
 * `BrokeredMandateFields` ζουν έτσι, και **καμία πύλη i18n δεν τα βλέπει** —
 * διαγραφή κλειδιού από τα locales δεν κοκκινίζει τίποτα.
 *
 * 🔑 Το πρόθεμα εξοικονομεί **δεκαοκτώ χαρακτήρες** και κοστίζει **ολόκληρη την
 * πύλη**. Εδώ γράφονται ολόκληρα, ώστε το `grep 'account.taxIdentity.hint'`
 * να τα βρίσκει και η 3.8 να μπορεί να τα κρίνει.
 */

/** Λόγος άρνησης → κλειδί i18n. **Σταθερά module** — δες την κεφαλίδα. */
export const VAT_REJECTION_KEYS: Record<TaxIdentityRejection, string> = {
  'vat-format-invalid': 'common-account:account.taxIdentity.vat-format-invalid',
  'vat-check-digit-invalid': 'common-account:account.taxIdentity.vat-check-digit-invalid',
};

/** Τα σταθερά κείμενα του πεδίου — ίδιος λόγος, ίδιο σχήμα. */
export const VAT_FIELD_KEYS = {
  label: 'common-account:account.taxIdentity.label',
  placeholder: 'common-account:account.taxIdentity.placeholder',
  hint: 'common-account:account.taxIdentity.hint',
  saveError: 'common-account:account.taxIdentity.saveError',
} as const;

/**
 * 🔑 **Ο πίνακας ιδωμένος ως αναζήτηση** — ώστε ο χαρτογράφος παρακάτω να μη
 * χρειάζεται **κανέναν ισχυρισμό τύπου**.
 *
 * ⚠️ Το `updateVatNumber` επιστρέφει `string | null`, όπου η συμβολοσειρά είναι
 * **είτε** ονομαστική άρνηση **είτε** `'write-failed'` — δηλαδή τιμή που ο
 * μεταγλωττιστής **δεν μπορεί** να στενέψει σε `TaxIdentityRejection`. Ένα
 * `as TaxIdentityRejection` θα ήταν **χειροκίνητος ισχυρισμός ακριβώς εκεί που η
 * υπόθεση είναι ψευδής** (το `'write-failed'` **δεν** ανήκει στην ένωση), και θα
 * επέστρεφε `undefined` μεταμφιεσμένο σε `string`.
 */
const VAT_REJECTION_LOOKUP: Readonly<Record<string, string | undefined>> = VAT_REJECTION_KEYS;

/**
 * **Η απάντηση του γραφέα → το κλειδί που διαβάζει ο άνθρωπος.** Ένας χαρτογράφος,
 * δύο καταναλωτές *(η οθόνη προφίλ και η φόρμα του Σ1)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΣΥΝΑΡΤΗΣΗ ΚΑΙ ΟΧΙ ΔΥΟ ΓΡΑΜΜΕΣ ΣΕ ΚΑΘΕ ΚΑΤΑΝΑΛΩΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι «δύο γραμμές» κρύβουν **μία απόφαση**: *τι γίνεται με λόγο που ο πίνακας δεν
 * ξέρει;* Γραμμένη δύο φορές, θα απέκλινε — και η απόκλιση θα ήταν **αόρατη**,
 * γιατί και οι δύο εκδοχές «δουλεύουν». Ο ένας θα έδειχνε το γενικό σφάλμα, ο
 * άλλος **ωμό κωδικό** σε άνθρωπο που κοιτάζει έναν φαινομενικά σωστό αριθμό.
 *
 * 🔑 **Η προεπιλογή είναι το `saveError`, ΠΟΤΕ ο ωμός κωδικός** (N.11): το
 * `'write-failed'` σημαίνει *«δεν μπόρεσα να γράψω»*, και το κείμενό του λέει
 * ρητά *«ο αριθμός σας δεν άλλαξε»* — ώστε ο άνθρωπος να **ξαναδοκιμάσει το ίδιο**,
 * αντί να αλλάξει έναν σωστό αριθμό (N.12: βλάβη ≠ άρνηση).
 *
 * @param rejection Ό,τι επέστρεψε το `useAuth().updateVatNumber` — `null` = γράφτηκε.
 * @returns Κλειδί i18n, ή `null` όταν δεν υπάρχει τίποτα να ειπωθεί.
 */
export function vatIssueKey(rejection: string | null): string | null {
  if (rejection === null) return null;
  return VAT_REJECTION_LOOKUP[rejection] ?? VAT_FIELD_KEYS.saveError;
}
