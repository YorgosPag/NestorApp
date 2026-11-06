/**
 * @fileoverview **Οι επιλυτές ονομάτων του ιστορικού ευκαιρίας** — ΕΝΑ σύνολο για όλους τους γραφείς (ADR-930 §3.10).
 * @module services/crm/opportunity-audit-resolvers.server
 *
 * Ξένα κλειδιά → όνομα στη γραμμή ιστορικού (η τιμή μένει η ταυτότητα, το όνομα γίνεται στιγμιότυπο ετικέτας):
 * κάτοχος (`assignedTo`) από τον **έναν** αναγνώστη προσώπων · επαφή (`contactId`, `referredBy`) από τον επιλυτή
 * επαφών **του μισθωτή**. Τους χρησιμοποιούν η πόρτα κατόχου και ο γραφέας πεδίων — όχι δύο αντίγραφα.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { ownedContactNameResolver, type AuditNameResolver } from '@/server/lib/owned-contact-name-resolver';
import { readNetworkPeople } from '@/services/network-messaging/thread-people';

/** «uid → όνομα» από τον **έναν** αναγνώστη προσώπων (`readNetworkPeople`). */
export function personNameResolver(db: Firestore): AuditNameResolver {
  return async (value: unknown): Promise<string | null> => {
    if (typeof value !== 'string' || value === '') return null;
    const [person] = await readNetworkPeople(db, [value]);
    return person?.name ?? null;
  };
}

/** Όλοι οι επιλυτές της ευκαιρίας — για το `resolvers` του `recordEntityUpdate`. */
export function opportunityAuditResolvers(db: Firestore, companyId: string): Readonly<Record<string, AuditNameResolver>> {
  const contactName = ownedContactNameResolver(db, companyId);
  return { assignedTo: personNameResolver(db), contactId: contactName, referredBy: contactName };
}
