/**
 * =============================================================================
 * Ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ ΜΙΑΣ ΘΕΣΗΣ — από τον ορισμό του `ProfessionalsCard` στον λογαριασμό (ADR-901 Φ2)
 * =============================================================================
 *
 * Ο ορισμός **υπάρχει ήδη**: `contact_links` (επαφή → ακίνητο, ρόλος `seller_lawyer|buyer_lawyer|notary`).
 * Η συμμετοχή **κρέμεται** σε αυτόν — ⛔ ΟΧΙ δεύτερη λίστα επαγγελματιών (N.0 · ADR-749).
 *
 * Η αλυσίδα (κάθε κρίκος με **ονομασμένη** αποτυχία — πρότυπο Procore «Save & Send Notification» για
 * υπάρχοντα χρήστη, «Save & Send Invitation» για νέο):
 *   ορισμός ─► επαφή ─► κύριο email (`primaryEmailOf`, SSoT) ─► λογαριασμός (Admin Auth)
 *   └ κανένας ορισμός      └ χωρίς email         └ χωρίς λογαριασμό ⇒ `needs-invitation` (Φ3)
 *
 * @module services/conveyance/conveyance-professional.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { isAuthUserNotFound } from '@/lib/auth/firebase-auth-errors';
import { legalRoleCredentialHint } from '@/lib/contacts/legal-professional-credentials';
import { primaryEmailOf } from '@/lib/contacts/primary-email';
import { scopeQueryToCompany } from '@/lib/firestore/tenant-scoped-query';
import type { PersonaData } from '@/types/contacts/personas';
import type { CredentialHint } from '@/types/engagement-invitation';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

export type CaseProfessional =
  | { readonly outcome: 'account'; readonly contactId: string; readonly email: string; readonly uid: string }
  /** Δεν έχει οριστεί επαγγελματίας σε αυτή τη θέση (ProfessionalsCard). */
  | { readonly outcome: 'not-appointed' }
  /** Η επαφή δεν έχει email — **καμία** σιωπηλή παράλειψη (κλείνει το Κ-2 του ADR-901 §2.2). */
  | { readonly outcome: 'no-email'; readonly contactId: string }
  /** Υπάρχει email, όχι λογαριασμός ⇒ η θέση χρειάζεται **πρόσκληση** (ADR-901 Φ3). */
  | {
      readonly outcome: 'needs-invitation';
      readonly contactId: string;
      readonly email: string;
      /** Ό,τι ξέρει η επαφή για τον αριθμό μητρώου — **προσυμπλήρωση** της δήλωσης (Ε-4), ποτέ δήλωση. */
      readonly credentialHint: CredentialHint;
    };

/** Η **ενεργή** σύνδεση επαφής του ρόλου στο ακίνητο — ο ορισμός του `ProfessionalsCard`. */
async function appointedContactId(
  db: Firestore,
  companyId: string,
  propertyId: string,
  role: LegalProfessionalRole,
): Promise<string | null> {
  const links = await scopeQueryToCompany(db.collection(COLLECTIONS.CONTACT_LINKS), companyId)
    .where('targetEntityType', '==', ENTITY_TYPES.PROPERTY)
    .where('targetEntityId', '==', propertyId)
    .where('status', '==', 'active')
    .get();
  const link = links.docs.map((doc) => doc.data()).find((data) => data.role === role);
  return link && typeof link.sourceContactId === 'string' ? link.sourceContactId : null;
}

/** Το κύριο email και οι persona της επαφής — **μόνο** αν η επαφή ανήκει στον μισθωτή (ξένη ≡ ανύπαρκτη). */
async function readContact(
  db: Firestore,
  companyId: string,
  contactId: string,
): Promise<{ readonly email: string | null; readonly personas: readonly PersonaData[] } | null> {
  const snapshot = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
  const data = snapshot.data();
  if (!data || data.companyId !== companyId) return null;
  return {
    email: primaryEmailOf(Array.isArray(data.emails) ? data.emails : undefined),
    personas: Array.isArray(data.personas) ? (data.personas as PersonaData[]) : [],
  };
}

/** Ο λογαριασμός με αυτό το email — `null` αν δεν υπάρχει ή είναι απενεργοποιημένος. */
async function accountUid(email: string): Promise<string | null> {
  try {
    const account = await getAdminAuth().getUserByEmail(email);
    return account.disabled ? null : account.uid;
  } catch (error: unknown) {
    if (isAuthUserNotFound(error)) return null;
    throw error;
  }
}

/** **Ποιος** είναι ο επαγγελματίας της θέσης, και μπορεί να του προταθεί συμμετοχή; */
export async function resolveCaseProfessional(
  db: Firestore,
  companyId: string,
  propertyId: string,
  role: LegalProfessionalRole,
): Promise<CaseProfessional> {
  const contactId = await appointedContactId(db, companyId, propertyId, role);
  if (!contactId) return { outcome: 'not-appointed' };
  const contact = await readContact(db, companyId, contactId);
  const email = contact?.email ?? null;
  if (!contact || !email) return { outcome: 'no-email', contactId };
  const uid = await accountUid(email);
  if (uid) return { outcome: 'account', contactId, email, uid };
  return { outcome: 'needs-invitation', contactId, email, credentialHint: legalRoleCredentialHint(role, contact.personas) };
}

/**
 * Ό,τι ξέρει το βιβλίο του οικοδεσπότη για τον αριθμό μητρώου της επαφής του διορισμού. Είναι η **εφεδρεία**
 * της προσυμπλήρωσης στο «Αναλαμβάνω» (ADR-901 Φ4), και ποτέ δήλωση.
 */
export async function contactCredentialHint(
  db: Firestore,
  companyId: string,
  contactId: string,
  role: LegalProfessionalRole,
): Promise<CredentialHint | null> {
  const contact = await readContact(db, companyId, contactId);
  return contact ? legalRoleCredentialHint(role, contact.personas) : null;
}
