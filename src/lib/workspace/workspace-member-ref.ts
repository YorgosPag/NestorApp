import 'server-only';

/**
 * @fileoverview **ΤΟ ΜΟΝΟΠΑΤΙ ΤΟΥ ΕΓΓΡΑΦΟΥ ΜΕΛΟΥΣ** — `companies/{companyId}/workspace_members/{uid}`,
 * χτισμένο σε **ένα** σημείο.
 * @related ADR-787 §5.1 β (γιατί `workspace_members` και όχι `members`) · ADR-867 Β5
 * @module lib/workspace/workspace-member-ref
 *
 * 🔴 **Μετρημένο 2026-09-18**: το ίδιο μονοπάτι χτιζόταν **χειρόγραφα σε 7 σημεία** — με template
 * string σε τέσσερα, με αλυσίδα `.collection().doc()` σε τρία. Το όνομα της υποσυλλογής **είναι
 * μηχανισμός** (ένα collection group σαρώνει κατά όνομα — ADR-787 §5.1 β), άρα η διατύπωσή του
 * ανήκει σε **έναν** τόπο.
 *
 * ⚠️ **ΜΟΝΟ το μονοπάτι.** Το «τι σημαίνει το έγγραφο» το απαντά το `normalizeMembership`
 * (`lib/auth/workspace-membership.ts`)· το «ποιος το γράφει» ο `grant-membership.ts`.
 */

import type { CollectionReference, DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';

/** `companies/{companyId}/workspace_members` — τα μέλη **ενός** χώρου. */
export function workspaceMembersCollection(db: Firestore, companyId: string): CollectionReference {
  return db.collection(COLLECTIONS.COMPANIES).doc(companyId).collection(SUBCOLLECTIONS.WORKSPACE_MEMBERS);
}

/** `companies/{companyId}/workspace_members/{uid}` — **ένα** μέλος. */
export function workspaceMemberRef(db: Firestore, companyId: string, uid: string): DocumentReference {
  return workspaceMembersCollection(db, companyId).doc(uid);
}
