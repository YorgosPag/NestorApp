/**
 * **`/o/<χώρος>/procurement/subcontracts/library/clauses/new` — συγγραφή νέας ρήτρας** (ADR-928 §5.22 · Φ3γ-0b-1).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link NewClauseClient}. Η νέα ρήτρα γεννιέται ως **πρόταση** — ισχύει μόνο αφού την
 * εγκρίνει άλλος.
 *
 * @module app/(app)/o/[workspace]/procurement/subcontracts/library/clauses/new/page
 */

import { NewClauseClient } from '@/components/procurement/subcontracts/library/authoring/NewClauseClient';

export default function NewSubcontractClausePage() {
  return <NewClauseClient />;
}
