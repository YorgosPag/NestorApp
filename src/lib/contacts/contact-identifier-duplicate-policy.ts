/**
 * @fileoverview **ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΕΧΕΙ ΑΥΤΗ Η ΕΠΑΦΗ ΕΝΑ ΑΦΜ / EMAIL ΠΟΥ ΕΧΕΙ ΗΔΗ ΑΛΛΗ;** — ο ΕΝΑΣ κανόνας (ADR-944 §9).
 * @module lib/contacts/contact-identifier-duplicate-policy
 *
 * Πρότυπο Salesforce Duplicate Rules: κάθε ταίριασμα έχει **ενέργεια** — `block` ή `allow` με ειδοποίηση. Εδώ η
 * ενέργεια δεν ρυθμίζεται, προκύπτει από το τι **είναι** το στοιχείο:
 *
 * | Στοιχείο | Ποιοι το μοιράζονται | Απόφαση |
 * |---|---|---|
 * | ΑΦΜ | φυσικό πρόσωπο ↔ φυσικό πρόσωπο | `block` — το ΑΦΜ είναι προσωπικό |
 * | ΑΦΜ | κάθε άλλος συνδυασμός | `confirm` — ατομική επιχείρηση, υποκατάστημα, υπηρεσία |
 * | email | οποιοιδήποτε | `confirm` — κοινό γραμματοκιβώτιο (ADR-944: ποτέ φραγμός) |
 *
 * 🔑 Καθαρή συνάρτηση: **δεν** ρωτά τη βάση. Τους κατόχους τους φέρνουν οι `findVatHolders` /
 *    `findEmailDuplicates`· εδώ μόνο κρίνονται. Έτσι η φόρμα, ο διάλογος διόρθωσης, ο φρουρός αποθήκευσης και η
 *    δημιουργία επαφής δίνουν την **ίδια** απάντηση.
 */

import type { ContactFormData } from '@/types/ContactFormTypes';
import type { ContactType } from '@/types/contacts';

export type IdentifierDuplicateDecision = 'allow' | 'confirm' | 'block';

/** Μια **άλλη** επαφή του ίδιου χώρου που έχει ήδη το στοιχείο. */
export interface IdentifierHolder {
  readonly id: string;
  readonly name: string;
  readonly type: ContactType;
}

/** ΑΦΜ: δύο φυσικά πρόσωπα δεν το μοιράζονται ποτέ· κάθε άλλη συνύπαρξη θέλει ρητή επιβεβαίωση. */
export function decideVatDuplicate(
  candidateType: ContactType,
  holders: readonly IdentifierHolder[],
): IdentifierDuplicateDecision {
  if (holders.length === 0) return 'allow';
  const individualHolder = holders.some((holder) => holder.type === 'individual');
  return candidateType === 'individual' && individualHolder ? 'block' : 'confirm';
}

/** Email: επιτρέπεται πάντα, με ρητή επιβεβαίωση όταν υπάρχει ήδη αλλού. */
export function decideEmailDuplicate(holders: readonly IdentifierHolder[]): IdentifierDuplicateDecision {
  return holders.length === 0 ? 'allow' : 'confirm';
}

/** Η αυστηρότερη από δύο αποφάσεις — `block` > `confirm` > `allow`. */
export function strictestDecision(
  a: IdentifierDuplicateDecision,
  b: IdentifierDuplicateDecision,
): IdentifierDuplicateDecision {
  if (a === 'block' || b === 'block') return 'block';
  return a === 'confirm' || b === 'confirm' ? 'confirm' : 'allow';
}

type FormVatFields = Pick<ContactFormData, 'vatNumber' | 'companyVatNumber' | 'serviceVatNumber'>;

/**
 * Το ΑΦΜ της φόρμας, στο πεδίο που το κρατά ο τύπος της επαφής (ίδια αντιστοίχιση με το `contact-document-evidence`).
 * Η εταιρεία πέφτει και στο `vatNumber`: η φόρμα ΓΕΜΗ γράφει εκεί (βλ. `company-identity-guard`).
 */
export function formVatOf(formData: Partial<FormVatFields>, contactType: ContactType): string {
  switch (contactType) {
    case 'individual':
      return (formData.vatNumber ?? '').trim();
    case 'company':
      return (formData.companyVatNumber?.trim() || formData.vatNumber?.trim()) ?? '';
    case 'service':
      return (formData.serviceVatNumber ?? '').trim();
  }
}
