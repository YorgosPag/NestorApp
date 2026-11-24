/**
 * @fileoverview **Φρουρός διπλού ΑΦΜ / email τη στιγμή της αποθήκευσης** (ADR-944 §9).
 * @module utils/contactForm/identifier-duplicate-guard
 *
 * Το ΕΝΑ σημείο επιβολής του κανόνα `contact-identifier-duplicate-policy` για κάθε **ενημέρωση** επαφής: φόρμα
 * λεπτομερειών, φόρμα διαλόγου, «Καταχώριση» από έγγραφο — όλες περνούν από το `runGuardChain`.
 *
 * 🔑 **Ρωτά μόνο για ό,τι ΑΛΛΑΖΕΙ σε αυτή την αποθήκευση** (Salesforce: ο κανόνας τρέχει όταν αλλάζει πεδίο του
 *    ταιριάσματος). Παλιό διπλότυπο δεν κλειδώνει την επαφή — φαίνεται στη γραμμή κάτω από το πεδίο.
 * 🔑 **Fail-open**: οι αναζητήσεις (`findVatHolders` · `findEmailDuplicates`) δίνουν «κανένας» όταν αποτύχουν. Ο
 *    έλεγχος είναι βοήθεια προς τον άνθρωπο, όχι εγγύηση μοναδικότητας — δεν υπάρχει επιβολή στον διακομιστή.
 */

import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { contactEmailKeys } from '@/lib/contacts/contact-email-keys';
import {
  decideEmailDuplicate,
  decideVatDuplicate,
  formVatOf,
  strictestDecision,
  vatChanges,
  type IdentifierDuplicateDecision,
  type IdentifierHolder,
} from '@/lib/contacts/contact-identifier-duplicate-policy';
import { findEmailDuplicates } from '@/lib/validation/contact-email-uniqueness';
import { findVatHolders, isValidGreekVat, normalizeVat } from '@/lib/validation/vat-validation';
import { getSafeFieldValue } from '@/utils/contactForm/contactMapper';

/** Ένα στοιχείο της φόρμας που το έχει ήδη άλλη επαφή. */
export interface IdentifierDuplicateEntry {
  readonly value: string;
  readonly holders: readonly IdentifierHolder[];
}

/** Ό,τι δείχνει ο διάλογος: η απόφαση και ποιοι έχουν ήδη τι. */
export interface IdentifierDuplicateDialogState {
  readonly decision: Exclude<IdentifierDuplicateDecision, 'allow'>;
  readonly vat: IdentifierDuplicateEntry | null;
  readonly emails: readonly IdentifierDuplicateEntry[];
}

/**
 * Το ΑΦΜ όπως είναι **αποθηκευμένο** — η υπηρεσία το κρατά σε δικό της πεδίο. Το διαβάζει και η προειδοποίηση πριν
 * από την αποθήκευση (`VatNumberField` · διάλογος «Διόρθωση ανάγνωσης»), ώστε να κρίνει «αλλάζει;» όπως εδώ.
 */
export function storedVatOf(contact: Contact): string {
  const field = contact.type === 'service' ? 'serviceVatNumber' : 'vatNumber';
  const value = getSafeFieldValue<unknown>(contact, field, '');
  return typeof value === 'string' ? normalizeVat(value) : '';
}

/** Το νέο ΑΦΜ, **μόνο** αν αλλάζει και είναι έγκυρο 9ψήφιο — αλλιώς δεν υπάρχει τίποτα να ρωτηθεί. */
export function changedVatOf(editContact: Contact, formData: ContactFormData): string | null {
  const next = normalizeVat(formVatOf(formData, editContact.type));
  if (!isValidGreekVat(next) || !vatChanges(next, storedVatOf(editContact))) return null;
  return next;
}

/** Τα email που **προστίθενται** — όσα έχει η φόρμα και δεν είχε η επαφή (ίδια κλειδιά με το `removedEmailKeysOf`). */
export function addedEmailKeysOf(editContact: Contact, formData: ContactFormData): string[] {
  const previous = new Set([...contactEmailKeys(editContact.emails ?? []), ...(editContact.emailKeys ?? [])]);
  return contactEmailKeys(formData.emails ?? []).filter((key) => !previous.has(key));
}

async function vatEntryOf(editContact: Contact, formData: ContactFormData, companyId: string) {
  const vat = changedVatOf(editContact, formData);
  if (vat === null) return null;
  const holders = await findVatHolders(vat, companyId, editContact.id);
  return holders.length === 0 ? null : { value: vat, holders };
}

async function emailEntriesOf(editContact: Contact, formData: ContactFormData, companyId: string) {
  const added = addedEmailKeysOf(editContact, formData);
  if (added.length === 0) return [];
  const warnings = await findEmailDuplicates(added, companyId, editContact.id);
  return warnings.map((warning) => ({ value: warning.email, holders: warning.contacts }));
}

/**
 * Τι από όσα αλλάζει αυτή η αποθήκευση υπάρχει ήδη σε άλλη επαφή του χώρου, και τι αποφασίζει ο κανόνας.
 * `null` ⇒ τίποτα να ειπωθεί — η αποθήκευση περνά.
 */
export async function detectIdentifierDuplicates(
  editContact: Contact,
  formData: ContactFormData,
): Promise<IdentifierDuplicateDialogState | null> {
  const companyId = editContact.companyId;
  if (companyId === undefined || companyId === '') return null;

  const [vat, emails] = await Promise.all([
    vatEntryOf(editContact, formData, companyId),
    emailEntriesOf(editContact, formData, companyId),
  ]);

  const vatDecision = vat === null ? 'allow' : decideVatDuplicate(editContact.type, vat.holders);
  const emailDecision = emails.some((entry) => decideEmailDuplicate(entry.holders) === 'confirm') ? 'confirm' : 'allow';
  const decision = strictestDecision(vatDecision, emailDecision);
  return decision === 'allow' ? null : { decision, vat, emails };
}
