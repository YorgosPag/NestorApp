/**
 * «Φέρε την επαφή — ή πες ότι δεν υπάρχει»: ο ΕΝΑΣ φορτωτής εγγράφου επαφής των εργαλείων του βοηθού.
 *
 * Ήταν **έξι** αντίγραφα του ίδιου προλόγου (`activity` ×4 · `esco-write` · `contact-field-update`) — ίδια
 * ανάγνωση, ίδιο μήνυμα «δεν βρέθηκε». Το CHECK 3.28 τα μέτρησε ως κλώνους (N.0.2).
 *
 * @module services/ai-pipeline/tools/handlers/agent-contact-doc
 */

import type { DocumentReference } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { ToolResult } from '../executor-shared';

export type AgentContactDoc =
  | { readonly found: true; readonly ref: DocumentReference; readonly data: Record<string, unknown> }
  | { readonly found: false; readonly result: ToolResult };

export async function loadAgentContact(contactId: string): Promise<AgentContactDoc> {
  const ref = getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(contactId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { found: false, result: { success: false, error: `Η επαφή ${contactId} δεν βρέθηκε.` } };
  }
  return { found: true, ref, data: (snap.data() ?? {}) as Record<string, unknown> };
}
