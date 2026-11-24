/**
 * @fileoverview **Δύο φυσικά πρόσωπα δεν έχουν το ίδιο ΑΦΜ** — ο κανόνας ADR-944 §9 στη ΔΗΜΙΟΥΡΓΙΑ επαφής.
 * @module services/contacts/individual-vat-guard
 *
 * Ο γενικός ανιχνευτής διπλοτύπων (`DuplicatePreventionService`) συγκρίνει τα φυσικά πρόσωπα με όνομα · email ·
 * τηλέφωνο — **όχι** με ΑΦΜ, άρα δεύτερο φυσικό πρόσωπο με το ίδιο ΑΦΜ περνούσε. (Στην παραγωγή βρέθηκε τέτοια
 * επαφή στον ζωντανό έλεγχο της 2026-11-24· από ποιον δρόμο γράφτηκε δεν ερευνήθηκε.) Εδώ ρωτιέται ο ίδιος κανόνας
 * με την ενημέρωση (`decideVatDuplicate`).
 *
 * 🔑 Μόνο το `block` επιβάλλεται εδώ. Το `confirm` (π.χ. φυσικό πρόσωπο με το ΑΦΜ της ατομικής του επιχείρησης)
 *    περνά: η ροή δημιουργίας δεν έχει ακόμη διάλογο επιβεβαίωσης (ADR-944 §9, ανοιχτά).
 * 🔑 Fail-open όπως κάθε έλεγχος μοναδικότητας: αποτυχία ερωτήματος ⇒ καμία άρνηση.
 */

import { decideVatDuplicate } from '@/lib/contacts/contact-identifier-duplicate-policy';
import { findVatHolders } from '@/lib/validation/vat-validation';
import type { ContactType } from '@/types/contacts';

interface VatCandidate {
  readonly type?: ContactType;
  readonly companyId?: string;
  readonly vatNumber?: unknown;
}

/**
 * Ρίχνει `DUPLICATE_CONTACT_DETECTED` (το σχήμα που διαβάζει ο `submission-error-handler`) όταν το ΑΦΜ του νέου
 * φυσικού προσώπου το έχει ήδη άλλο φυσικό πρόσωπο του ίδιου χώρου.
 */
export async function assertIndividualVatFree(candidate: VatCandidate): Promise<void> {
  const { type, companyId, vatNumber } = candidate;
  if (type !== 'individual' || !companyId || typeof vatNumber !== 'string' || vatNumber.trim() === '') return;

  const holders = await findVatHolders(vatNumber, companyId);
  if (decideVatDuplicate(type, holders) !== 'block') return;

  const holder = holders.find((entry) => entry.type === 'individual') ?? holders[0];
  throw new Error(
    'DUPLICATE_CONTACT_DETECTED: VAT number already held by another individual ' +
    `(Confidence: 100.0%) [Contact ID: ${holder.id}]`
  );
}
