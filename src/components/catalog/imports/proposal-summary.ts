/**
 * @fileoverview **Η σύνοψη μιας πρότασης** (ADR-923 §5.5.2 Α6): πόσα θέλουν απόφαση, πόσα αποφάσισε ο κανόνας, πόσα ο άνθρωπος,
 *   και ποια πεδία δείχνει κάθε προβολή. Καθαρό: το διαβάζουν η μπάρα σύνοψης και ο πίνακας από το **ίδιο** σημείο.
 * @module components/catalog/imports/proposal-summary
 *
 * 🔑 Οι κάδοι είναι **ξένοι μεταξύ τους** και αθροίζουν όλα τα πεδία: αμετάβλητο · εκκρεμεί · αποδεκτό αυτόματα · αποδεκτό από
 *    άνθρωπο · απορρίφθηκε. Ο άνθρωπος βλέπει «4 θέλουν απόφαση», όχι 48 γραμμές (GitHub «unviewed» · Akeneo).
 */

import { decisionSourceOf } from '@/subapps/catalog/import/field-diff';
import type { ImportProposalField, ImportProposalRow } from '@/subapps/catalog/types/catalog-import';

export const PROPOSAL_VIEWS = ['pending', 'changes', 'all'] as const;
export type ProposalView = (typeof PROPOSAL_VIEWS)[number];

export interface ProposalSummary {
  readonly pending: number;
  readonly acceptedByRule: number;
  readonly acceptedByHuman: number;
  readonly rejected: number;
  readonly unchanged: number;
}

type ProposalBucket = keyof ProposalSummary;

/** Ο κάδος ενός πεδίου — η **μία** ταξινόμηση· τη διαβάζουν η σύνοψη και ο χάρτης κατάστασης του PDF (§5.5.2 Β8). */
export function bucketOf(field: ImportProposalField): ProposalBucket {
  if (field.status === 'unchanged') return 'unchanged';
  if (field.decision === 'pending') return 'pending';
  if (field.decision === 'reject') return 'rejected';
  return decisionSourceOf(field) === 'rule' ? 'acceptedByRule' : 'acceptedByHuman';
}

export function summarizeProposal(rows: readonly ImportProposalRow[]): ProposalSummary {
  const counts: Record<ProposalBucket, number> = { pending: 0, acceptedByRule: 0, acceptedByHuman: 0, rejected: 0, unchanged: 0 };
  for (const field of rows.flatMap((row) => row.fields)) counts[bucketOf(field)] += 1;
  return counts;
}

/** Η αρχική προβολή: ό,τι θέλει απόφαση όταν υπάρχει, αλλιώς οι αλλαγές, αλλιώς όλα (πρόταση μόνο με αμετάβλητα). */
export function initialProposalView(summary: ProposalSummary): ProposalView {
  if (summary.pending > 0) return 'pending';
  return summary.acceptedByRule + summary.acceptedByHuman + summary.rejected > 0 ? 'changes' : 'all';
}

export function fieldVisibleIn(view: ProposalView, field: ImportProposalField): boolean {
  if (view === 'pending') return field.decision === 'pending';
  if (view === 'changes') return field.status !== 'unchanged';
  return true;
}

/** Το επόμενο πεδίο που θέλει απόφαση μετά το εστιασμένο, κυκλικά, με τη σειρά της πρότασης. */
export function nextPendingField(rows: readonly ImportProposalRow[], focused: ImportProposalField | null): ImportProposalField | null {
  const fields = rows.flatMap((row) => row.fields);
  const start = focused ? fields.indexOf(focused) + 1 : 0;
  const ordered = [...fields.slice(start), ...fields.slice(0, start)];
  return ordered.find((field) => field.decision === 'pending') ?? null;
}
