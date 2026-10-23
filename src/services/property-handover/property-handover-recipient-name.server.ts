import 'server-only';

/**
 * @fileoverview **Το ονοματεπώνυμο του αγοραστή μιας παράδοσης** — η ΜΙΑ ανάγνωση (ADR-916 §5.15 Φ-Δ.2).
 * @related property-handover-preview.server.ts (καρτέλα) · property-handover-protocol-facts.server.ts (Πρωτόκολλο) ·
 *          server/property-handover-invitations/handover-invitation-answer-notifier.ts (ειδοποίηση)
 * @module services/property-handover/property-handover-recipient-name.server
 *
 * 🔑 **N.0.2**: η ίδια ανάγνωση (`readOwnedContactDocs` + `extractContactDisplayName`) ήταν γραμμένη στην καρτέλα και στο
 *    Πρωτόκολλο· η ειδοποίηση θα ήταν τρίτη. Τρεις επιφάνειες που πρέπει να λένε το **ίδιο** όνομα.
 * 🔒 **Μόνο ονοματεπώνυμο**, μόνο από επαφές του **ίδιου** μισθωτή — ποτέ email · τηλέφωνο · ΑΦΜ.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';

/** `contactId → ονοματεπώνυμο`· επαφή χωρίς όνομα ή ξένη ⇒ λείπει από τον χάρτη (ο καλών την ονομάζει «χωρίς όνομα»). */
export async function handoverRecipientNamesOf(
  adminDb: AdminFirestore,
  companyId: string,
  contactIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const contacts = await readOwnedContactDocs(adminDb, companyId, [...new Set(contactIds)]);
  return new Map([...contacts].flatMap(([contactId, contact]) => {
    const name = extractContactDisplayName(contact);
    return name ? [[contactId, name] as const] : [];
  }));
}
