'use client';

/**
 * Τα ευρήματα ενός πεδίου, κάτω από αυτό, με τη λέξη που θα έλεγε ο γραφέας (ADR-928 Φ3γ απόφαση 3). Το `id` δένεται στο
 * `aria-describedby` του πεδίου: ο αναγνώστης οθόνης διαβάζει **γιατί** είναι άκυρο, όχι μόνο ότι είναι.
 * Ο πίνακας μηνυμάτων φτάνει μόνο όταν υπάρχει εύρημα (`import()`, ADR-744 §34).
 */

import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { useSubcontractIssueMessage } from '../subcontract-messages';

interface FieldIssuesProps {
  readonly id?: string;
  readonly issues: readonly SubcontractIssue[];
}

export function FieldIssues({ id, issues }: FieldIssuesProps) {
  const message = useSubcontractIssueMessage(issues.length > 0);
  if (issues.length === 0) return null;
  return (
    <ul id={id} role="alert" className="space-y-0.5 text-xs text-destructive">
      {issues.map((issue, index) => <li key={`${issue.code}:${issue.path}:${index}`}>{message(issue)}</li>)}
    </ul>
  );
}
