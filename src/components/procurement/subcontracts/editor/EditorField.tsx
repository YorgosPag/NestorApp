'use client';

/**
 * Ένα πεδίο του επεξεργαστή: ετικέτα → έλεγχος → ευρήματα, δεμένα με `htmlFor` / `aria-describedby` (ADR-928 Φ3γ).
 * ΕΝΑ σημείο για τη διάταξη κάθε πεδίου — οι ενότητες δεν ξαναγράφουν την τριάδα.
 */

import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { FieldIssues } from './FieldIssues';

interface EditorFieldProps {
  readonly id: string;
  readonly label: string;
  readonly issues?: readonly SubcontractIssue[];
  readonly className?: string;
  readonly children: ReactNode;
}

/** Το id της λίστας ευρημάτων ενός πεδίου — για το `aria-describedby` του ελέγχου. */
export const issuesIdOf = (id: string): string => `${id}-issues`;

export function EditorField({ id, label, issues = [], className, children }: EditorFieldProps) {
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldIssues id={issuesIdOf(id)} issues={issues} />
    </div>
  );
}
