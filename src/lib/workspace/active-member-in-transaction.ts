import 'server-only';

/**
 * @fileoverview **«Είναι ΕΝΕΡΓΟ μέλος του χώρου;» — μέσα σε συναλλαγή.**
 * @related ADR-930 §3.8 (κάτοχος ευκαιρίας) · §3.10 (αρχικός κάτοχος στη δημιουργία) · ADR-787 §5.1
 * @module lib/workspace/active-member-in-transaction
 *
 * Η ανάγνωση γίνεται στην **ίδια** συναλλαγή με την εγγραφή που εξαρτάται από αυτήν, ώστε ένα μέλος που αποχωρεί
 * εκείνη τη στιγμή να μη γίνει κάτοχος. Εξήχθη από την πόρτα κατόχου όταν τη χρειάστηκε και η δημιουργία ευκαιρίας —
 * ένας έλεγχος, όχι δύο αντίγραφα. Το «τι σημαίνει ενεργό» το λέει το `normalizeMembership`, όχι αυτό το αρχείο.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { normalizeMembership } from '@/lib/auth/workspace-membership';
import { workspaceMemberRef } from './workspace-member-ref';

export async function isActiveWorkspaceMemberInTx(
  tx: Transaction,
  db: Firestore,
  companyId: string,
  uid: string,
): Promise<boolean> {
  const member = await tx.get(workspaceMemberRef(db, companyId, uid));
  return member.exists && normalizeMembership(uid, member.data()).status === 'active';
}
