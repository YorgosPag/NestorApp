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
 * πύλη**. Εδώ γράφονται ολόκληρα, ώστε το `grep 'account.profile.vatNumberHint'`
 * να τα βρίσκει και η 3.8 να μπορεί να τα κρίνει.
 */

/** Λόγος άρνησης → κλειδί i18n. **Σταθερά module** — δες την κεφαλίδα. */
export const VAT_REJECTION_KEYS: Record<TaxIdentityRejection, string> = {
  'vat-format-invalid': 'account.profile.vat-format-invalid',
  'vat-check-digit-invalid': 'account.profile.vat-check-digit-invalid',
};

/** Τα σταθερά κείμενα του πεδίου — ίδιος λόγος, ίδιο σχήμα. */
export const VAT_FIELD_KEYS = {
  label: 'account.profile.vatNumber',
  placeholder: 'account.profile.vatNumberPlaceholder',
  hint: 'account.profile.vatNumberHint',
  saveError: 'account.profile.vatSaveError',
} as const;
