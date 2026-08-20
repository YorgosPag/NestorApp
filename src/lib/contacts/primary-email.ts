/**
 * @fileoverview **ΠΟΥ ΣΤΕΛΝΟΥΜΕ ΣΕ ΜΙΑ ΕΠΑΦΗ** — μία απάντηση, γραμμένη μία φορά.
 * @related ADR-777 §8.33 · types/contacts (EmailInfo)
 * @module lib/contacts/primary-email
 *
 * 🔴 **ΤΟ ΙΔΙΟ ΕΡΩΤΗΜΑ ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΤΟΥΛΑΧΙΣΤΟΝ ΠΕΝΤΕ ΦΟΡΕΣ** — μετρημένο στο
 * §8.33: `contact-linker.ts` · `messaging-handler.ts` · `org-structure-handler-utils.ts`
 * (δύο σημεία) · `contact-lookup-search.ts`. Και **δεν έλεγαν όλα το ίδιο**: άλλα
 * γράφουν `emails.find(isPrimary)?.email ?? emails[0]?.email`, άλλα σκέτο
 * `emails[0].email` — δηλαδή στέλνουν στο **λάθος** email όταν το κύριο δεν είναι
 * πρώτο στη λίστα.
 *
 * ⚠️ **Οι πέντε ΔΕΝ μεταναστεύουν σε αυτό το commit**, και ο λόγος είναι μετρημένος:
 * τέσσερις από τους πέντε ζουν κάτω από το `services/ai-pipeline/`, όπου **κάθε**
 * άγγιγμα ενεργοποιεί τον N.10 (77 σουίτες). Είναι το σχήμα «μεγάλο διπλότυπο» του
 * κανόνα **N.0.2** ⇒ καταγράφεται στο `.claude-rules/pending-ratchet-work.md` αντί να
 * γίνει βιαστικά. Αυτό εδώ **δεν είναι έκτο αντίγραφο** — είναι ο **κανονικός** τόπος
 * όπου θα δείξουν οι πέντε.
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

/** Το ελάχιστο σχήμα που χρειάζεται η απόφαση — **όχι** ολόκληρη η `EmailInfo`. */
export interface EmailLike {
  readonly email?: unknown;
  readonly isPrimary?: unknown;
}

/**
 * **Η διεύθυνση στην οποία μιλάμε σε αυτόν τον άνθρωπο**, ή `null`.
 *
 * 🔑 **Κύριο πρώτα, αλλιώς η πρώτη έγκυρη.** Η σειρά της λίστας είναι **σειρά
 * καταχώρησης**, όχι προτίμηση — γι' αυτό το `isPrimary` προηγείται πάντα. Ένα σκέτο
 * `emails[0]` στέλνει το μήνυμα στο παλιό email της δουλειάς επειδή καταχωρήθηκε
 * πρώτο, και **κανείς δεν το μαθαίνει**: το email φεύγει κανονικά.
 *
 * ⚠️ **Κενές συμβολοσειρές δεν είναι διευθύνσεις.** Μια επαφή με `{ email: '' }`
 * είναι συνηθισμένη (μισοσυμπληρωμένη φόρμα) και ένα `?? emails[0]?.email` θα
 * επέστρεφε `''` — που **δεν είναι `null`**, δηλαδή θα περνούσε κάθε έλεγχο
 * «υπάρχει;» και θα έσκαγε στον πάροχο.
 */
export function primaryEmailOf(emails: readonly EmailLike[] | undefined): string | null {
  if (!Array.isArray(emails)) return null;

  const usable = emails.filter(
    (entry): entry is EmailLike & { email: string } =>
      typeof entry.email === 'string' && entry.email.trim() !== '',
  );

  const preferred = usable.find((entry) => entry.isPrimary === true) ?? usable[0];
  return preferred === undefined ? null : preferred.email.trim();
}
