/**
 * **`/o/<χώρος>/procurement/subcontracts/library/clauses/[clauseId]/propose` — πρόταση νέας έκδοσης ρήτρας**
 * (ADR-928 §5.22 · Φ3γ-0b-1).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link ProposeClauseClient}. Αφετηρία η έκδοση σε ισχύ· η πρόταση ισχύει μόνο αφού
 * την εγκρίνει άλλος.
 *
 * @module app/(app)/o/[workspace]/procurement/subcontracts/library/clauses/[clauseId]/propose/page
 */

import { ProposeClauseClient } from '@/components/procurement/subcontracts/library/authoring/ProposeClauseClient';

interface ProposeSubcontractClausePageProps {
  params: Promise<{ clauseId: string }>;
}

export default async function ProposeSubcontractClausePage({ params }: ProposeSubcontractClausePageProps) {
  const { clauseId } = await params;
  return <ProposeClauseClient clauseId={clauseId} />;
}
