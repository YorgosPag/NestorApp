/**
 * =============================================================================
 * ΠΟΙΟΣ ΠΑΡΑΛΑΜΒΑΝΕΙ ΜΙΑ ΠΡΟΣΚΛΗΣΗ — η ΜΙΑ κρίση (ADR-923 §5.13 Ε6δ, Τ5 · ADR-327 §7)
 * =============================================================================
 *
 * Πριν, τρία σημεία διάβαζαν την επαφή και έβγαζαν email μόνα τους (fan-out του `createRfq` · `createVendorInvite` ·
 * `resolveInviteRecipient`). Η επαφή ενός **προμηθευτή της πλατφόρμας** (Τ3) δεν έχει email, άρα και στα τρία η πρόσκληση
 * πήγαινε στο κενό: το RFQ γραφόταν και ο προμηθευτής δεν μάθαινε τίποτα. Τώρα όλα ρωτούν **εδώ**.
 *
 * | Επαφή | Παραλήπτης |
 * |---|---|
 * | του αγοραστή, με email | το email της επαφής (ο αγοραστής το έγραψε, ο αγοραστής το βλέπει) |
 * | **πλατφόρμας** (`platformCompanyOfContact`) | το `quoteIntake.recipientEmail` του προμηθευτή, **τη στιγμή της αποστολής**, μόνο όσο δέχεται |
 * | ξένη, χωρίς tenant, ανύπαρκτη, χωρίς email | κανένας |
 *
 * 🔒 **Ο παραλήπτης αποφασίζεται μόνο από επαληθευμένα δεδομένα του διακομιστή.** Ένα `platformCompanyId` μετρά μόνο αν
 *    συμφωνούν πεδίο, ντετερμινιστικό id ζεύγους, χώρος και τύπος (Τ3)· ποτέ email ή χώρος από το σώμα ενός αιτήματος.
 * 🔒 Για επαφή πλατφόρμας το email της καρτέλας **αγνοείται**: το κανάλι του χώρου είναι ένα, και το ορίζει ο προμηθευτής.
 * 🔒 Η διεύθυνση του προμηθευτή **δεν** γράφεται σε έγγραφο του αγοραστή ({@link recipientEmailSnapshot}): το
 *    `vendor_invites` το διαβάζει κάθε μέλος της εταιρείας του αγοραστή, και θα γινόταν κανάλι συλλογής διευθύνσεων.
 *
 * @module subapps/procurement/services/vendor-recipient
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { readQuoteIntakeRecipient } from '@/server/catalog/public/public-model-snapshot.server';
import { platformCompanyOfContact } from '@/services/contact/platform-company-contact-resolver';
import { getContactEmail } from '@/services/contacts/contact-name-resolver-types';

import type { DeliveryChannel } from '../types/vendor-invite';
import type { InviteRecipientKind } from '../types/vendor-invite-delivery';
import { pickContactDisplayName } from './vendor-name-resolver';

export interface VendorContactSnapshot {
  id: string;
  displayName: string;
  email: string | null;
  preferredChannel: DeliveryChannel | null;
  /** Ο χώρος του προμηθευτή, **μόνο** όταν η καρτέλα περνά την κρίση `platformCompanyOfContact`. */
  platformCompanyId: string | null;
}

export async function fetchVendorContact(companyId: string, contactId: string): Promise<VendorContactSnapshot | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    // Επαφή χωρίς `companyId` δεν ανήκει σε κανέναν (ADR-742 §4 · ADR-876 §5 Σ15) — ήταν `data.companyId && …`.
    if (!isPayloadOwnedByCompany(data, companyId)) return null;
    const supplierPersona = data.supplierPersona as { preferredChannel?: DeliveryChannel } | undefined;
    return {
      id: snap.id,
      displayName: pickContactDisplayName(data) ?? contactId,
      email: getContactEmail(data as Parameters<typeof getContactEmail>[0]),
      preferredChannel: supplierPersona?.preferredChannel ?? null,
      platformCompanyId: platformCompanyOfContact(snap.id, companyId, data),
    };
  }, null);
}

/** Ένας παραλήπτης που μπορεί να λάβει email. */
export interface VendorRecipient {
  readonly email: string;
  readonly name: string;
  readonly kind: InviteRecipientKind;
  /** Μόνο για `platform`: ο χώρος του προμηθευτή (ποσόστωση, ειδοποίηση). */
  readonly platformCompanyId: string | null;
}

/** Ο παραλήπτης μιας **ήδη ελεγμένης** επαφής του αγοραστή `buyerCompanyId`. */
export async function recipientOfContact(contact: VendorContactSnapshot, buyerCompanyId: string): Promise<VendorRecipient | null> {
  const supplier = contact.platformCompanyId;
  if (supplier === null) {
    return contact.email ? { email: contact.email, name: contact.displayName, kind: 'contact', platformCompanyId: null } : null;
  }
  if (supplier === buyerCompanyId) return null;
  const email = await readQuoteIntakeRecipient(supplier);
  return email ? { email, name: contact.displayName, kind: 'platform', platformCompanyId: supplier } : null;
}

/** **Η μία ερώτηση «σε ποιον πάει;»** για την επαφή `contactId` του αγοραστή `companyId`. `null` ⇒ πουθενά. */
export async function resolveVendorRecipient(companyId: string, contactId: string): Promise<VendorRecipient | null> {
  const contact = await fetchVendorContact(companyId, contactId);
  return contact === null ? null : recipientOfContact(contact, companyId);
}

/** Τι επιτρέπεται να μείνει ως στιγμιότυπο στην πρόσκληση: ποτέ η ιδιωτική διεύθυνση ενός χώρου της πλατφόρμας. */
export function recipientEmailSnapshot(recipient: Pick<VendorRecipient, 'email' | 'kind'>): string | null {
  return recipient.kind === 'platform' ? null : recipient.email;
}
