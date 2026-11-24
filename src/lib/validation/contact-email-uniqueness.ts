/**
 * @fileoverview **ΥΠΑΡΧΕΙ ΗΔΗ ΑΥΤΟ ΤΟ EMAIL ΣΕ ΑΛΛΗ ΕΠΑΦΗ ΤΟΥ ΓΡΑΦΕΙΟΥ;** (ADR-944)
 * @module lib/validation/contact-email-uniqueness
 *
 * Πρότυπο Salesforce Duplicate Rules «Allow with Alert»: ακριβές ταίριασμα email (χωρίς διάκριση πεζών/κεφαλαίων),
 * **προειδοποίηση με σύνδεσμο** στην υπάρχουσα επαφή — **ποτέ** φραγμός. Κοινά γραμματοκιβώτια (`info@`, γραμματεία)
 * είναι θεμιτά· ο HubSpot που τα μπλοκάρει είναι το αντιπαράδειγμα.
 *
 * 🔑 **Ερώτημα δείκτη, όχι σάρωση**: `companyId ==` + `emailKeys array-contains` (δείκτης στο `firestore.indexes.json`).
 *    Ο μισθωτής από το token του καλούντα (`useCompanyId`), ποτέ από το φορτίο.
 * 🔑 **Fail-open**: αποτυχία ερωτήματος ⇒ «καμία προειδοποίηση» — η φόρμα δεν μπλοκάρεται ποτέ από τον έλεγχο.
 * ⚠️ Επαφή που γράφτηκε πριν το `emailKeys` **δεν** βρίσκεται μέχρι τη συμπλήρωση (`scripts/backfill-contact-email-keys.ts`).
 */

import { collection, getDocs, limit, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { liveIdentifierHolders } from '@/lib/contacts/live-identifier-holders';
import { CONTACT_EMAIL_KEYS_FIELD, emailKeyOf } from '@/lib/contacts/contact-email-keys';
import { isValidEmail } from '@/lib/validation/email-validation';
import type { Contact, ContactType } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('contact-email-uniqueness');

/** Ως 2 άλλες επαφές + ενδεχομένως η ίδια (εξαιρείται) — αρκετό για «υπάρχει ήδη στην Χ (και σε άλλες)». */
const MATCH_LIMIT = 3;

/** Άνω όριο ελέγχων ανά φόρμα — μια επαφή με δεκάδες email δεν γίνεται δεκάδες ερωτήματα σε κάθε πλήκτρο. */
export const MAX_EMAILS_CHECKED = 10;

export interface ExistingEmailContact {
  readonly id: string;
  /** Κενό όταν η επαφή δεν έχει όνομα — η όψη δείχνει δικό της κείμενο, ποτέ ωμό «undefined». */
  readonly name: string;
  readonly type: ContactType;
}

/** Ένα email της φόρμας που υπάρχει ήδη αλλού. */
export interface EmailDuplicateWarning {
  readonly email: string;
  readonly contacts: readonly ExistingEmailContact[];
}

/**
 * Το όνομα **ανά είδος**, χωρίς ελληνικό fallback σε κώδικα (N.11) και χωρίς το «undefined undefined» που δίνει το
 * `getContactDisplayName` σε φυσικό πρόσωπο με μισό όνομα — κενό ⇒ η όψη αποφασίζει.
 */
function displayNameOf(contact: Contact): string {
  const parts = contact.type === 'individual'
    ? [contact.firstName, contact.lastName]
    : [contact.type === 'company' ? contact.companyName : contact.serviceName];
  const named = parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join(' ').trim();
  return named !== '' ? named : (contact.name ?? '').trim();
}

/** Οι **άλλες** επαφές του γραφείου που έχουν αυτό το email. Άκυρο/κενό email ⇒ καμία ερώτηση. */
export async function findContactsWithEmail(
  email: string,
  companyId: string,
  excludeContactId?: string,
): Promise<readonly ExistingEmailContact[]> {
  const key = emailKeyOf(email);
  if (key === null || !isValidEmail(key)) return [];
  try {
    const snapshot = await getDocs(query(
      collection(db, COLLECTIONS.CONTACTS).withConverter(contactConverter),
      where('companyId', '==', companyId),
      where(CONTACT_EMAIL_KEYS_FIELD, 'array-contains', key),
      limit(MATCH_LIMIT),
    ));
    return liveIdentifierHolders(snapshot.docs, excludeContactId, displayNameOf);
  } catch (error) {
    logger.warn('Ο έλεγχος διπλού email απέτυχε — καμία προειδοποίηση (fail-open)', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/** Όλα τα email της φόρμας: μοναδικά κλειδιά, ως {@link MAX_EMAILS_CHECKED}, μόνο όσα βρέθηκαν αλλού. */
export async function findEmailDuplicates(
  emails: readonly string[],
  companyId: string,
  excludeContactId?: string,
): Promise<readonly EmailDuplicateWarning[]> {
  const keys = [...new Set(emails.map(emailKeyOf).filter((k): k is string => k !== null))].slice(0, MAX_EMAILS_CHECKED);
  const results = await Promise.all(keys.map(async (email) => ({
    email,
    contacts: await findContactsWithEmail(email, companyId, excludeContactId),
  })));
  return results.filter((r) => r.contacts.length > 0);
}
