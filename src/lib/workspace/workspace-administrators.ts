import 'server-only';

/**
 * @fileoverview **ΟΙ ΕΝΕΡΓΟΙ ΔΙΑΧΕΙΡΙΣΤΕΣ ΕΝΟΣ ΧΩΡΟΥ** — «ποιοι μιλούν για το γραφείο;», σε **ένα** σημείο.
 * @related lib/workspace/workspace-member-ref.ts (το μονοπάτι) · lib/auth/workspace-membership.ts (`normalizeMembership`)
 *   · lib/auth/roles.ts (`ADMINISTRATIVE_ROLES` — η **μία** λίστα ρόλων διοίκησης)
 * @module lib/workspace/workspace-administrators
 *
 * 🔑 **Δύο καταναλωτές, μία ερώτηση** (N.0.2, 2026-09-27): η ερώτηση αργιών (ADR-841 §7 Α21.21 — απόφαση Giorgio
 * 2026-09-15 «διαχειριστές χώρου, όπως η Google στέλνει στους κατόχους του προφίλ») και η ειδοποίηση πρώτης επαφής
 * προς γραφείο (ADR-843 §10.20). Η πρώτη έχτιζε το μονοπάτι **χειρόγραφα** — όγδοο σημείο που το
 * `workspace-member-ref.ts` (μετρημένο «7») δεν είχε δει — και διάβαζε τα ωμά πεδία αντί για τον κανονικοποιητή.
 *
 * ⚠️ **`normalizeMembership`, ΠΟΤΕ ωμό `doc.data().status`**: ο κανονικοποιητής απαντά `suspended` σε άγνωστη
 * κατάσταση — δηλαδή «όχι» όταν δεν ξέρει (ADR-749). Ωμή σύγκριση θα ήταν δεύτερη ερμηνεία του ίδιου εγγράφου.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { normalizeMembership } from '@/lib/auth/workspace-membership';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { workspaceMembersCollection } from '@/lib/workspace/workspace-member-ref';

const ADMIN_ROLES: readonly string[] = ADMINISTRATIVE_ROLES;

/**
 * **Τα `uid` των ενεργών μελών με ρόλο διοίκησης.** Κενός πίνακας = κανένας (όχι βλάβη)· η βλάβη **πετά**, και την
 * κρίνει ο καλών — ένας αγωγός ειδοποίησης την καταγράφει, δεν τη μετατρέπει σιωπηλά σε «κανένας».
 */
export async function activeWorkspaceAdministrators(db: Firestore, companyId: string): Promise<string[]> {
  const members = await workspaceMembersCollection(db, companyId).get();
  return members.docs.flatMap((doc) => {
    const member = normalizeMembership(doc.id, doc.data());
    return member.status === 'active' && ADMIN_ROLES.includes(member.globalRole) ? [member.uid] : [];
  });
}
