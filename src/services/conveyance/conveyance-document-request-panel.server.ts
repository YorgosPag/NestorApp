/**
 * =============================================================================
 * Η ενότητα «Ζήτησε έγγραφο» της όψης — για ΕΝΑΝ θεατή (ADR-901 Φ4.5 · Α29 · Α31)
 * =============================================================================
 *
 * `γραμμές που βλέπει ο θεατής + ενεργοί ρόλοι τώρα + αιτήματα της υπόθεσης → { targets · log · today }`
 *
 * - **targets** — ανά γραμμή, σε ποιον θα πήγαινε το αίτημα ή γιατί όχι (ο ΙΔΙΟΣ κριτής με τον γραφέα). Ο client
 *   δείχνει «Θα ειδοποιηθεί: …» **πριν** το πάτημα, χωρίς να ξέρει ποιοι συμμετέχουν (ο οικοδεσπότης δεν το ξέρει εδώ).
 * - **log**     — μόνο αιτήματα όπου ο θεατής είναι αιτών ή παραλήπτης (Α31).
 * - **today**   — η ημέρα Ελλάδας του server: το «ζητήθηκε σήμερα» κρίνεται με το ρολόι της ταυτότητας.
 *
 * Ανάγνωση αιτημάτων που απέτυχε ⇒ κενό ιστορικό (το κουμπί μένει — ο γραφέας είναι ιδεμποτικός ανά ημέρα).
 *
 * @module services/conveyance/conveyance-document-request-panel.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { documentRequestViewsFor, requestTargetOf, type RequestParty } from '@/lib/conveyance/document-request-policy';
import type { ChecklistRow, ConveyanceCase, ConveyanceCaseState } from '@/types/conveyance-case';
import type { CaseDocumentRequests, DocumentRequestTarget } from '@/types/conveyance-document-request';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import { readCaseDocumentRequests } from './conveyance-document-request-store.server';
import { activeCaseEngagements } from './conveyance-engagement-support';

interface PanelQuestion {
  readonly record: ConveyanceCase;
  readonly state: ConveyanceCaseState;
  readonly party: RequestParty;
  readonly rows: readonly ChecklistRow[];
  readonly nowMs: number;
}

/** Οι ρόλοι επαγγελματιών με ενεργή συμμετοχή **τώρα** — η ίδια κρίση με τον γραφέα (`engagedNow`). */
export async function activeRolesOf(db: Firestore, record: ConveyanceCase, nowMs: number): Promise<ReadonlySet<LegalProfessionalRole>> {
  return new Set((await activeCaseEngagements(db, record, nowMs)).map((engagement) => engagement.role));
}

export async function documentRequestPanel(db: Firestore, question: PanelQuestion): Promise<CaseDocumentRequests> {
  const { record, state, party, rows, nowMs } = question;
  const [activeRoles, requests] = await Promise.all([activeRolesOf(db, record, nowMs), readCaseDocumentRequests(db, record)]);
  const targets: Record<string, DocumentRequestTarget> = {};
  for (const row of rows) targets[row.itemId] = requestTargetOf({ item: row.item, requester: party.role, state, activeRoles });
  return {
    today: conveyanceToday(new Date(nowMs)),
    targets,
    log: documentRequestViewsFor(requests ?? [], party),
  };
}
