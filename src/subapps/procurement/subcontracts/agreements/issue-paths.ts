/**
 * @fileoverview **Ποια ευρήματα αφορούν αυτό το πεδίο** — δέσιμο ευρήματος ↔ πεδίου με το `path` του κριτή
 *   (ADR-928 Φ3γ απόφαση 3).
 * @module subapps/procurement/subcontracts/agreements/issue-paths
 *
 * 🔑 Τα `path` τα γράφουν οι κριτές με το `joinPath` (τελεία ανάμεσα στα τμήματα: `clauses.2.parameterValues.rate`).
 *    Ένα πεδίο ρωτά **ακριβώς** το δικό του μονοπάτι· μια ενότητα ρωτά το πρόθεμά της (`lines` ⇒ κάθε γραμμή).
 *    Το πρόθεμα κόβει σε όριο τμήματος: το `lines.1` δεν πιάνει το `lines.10`.
 */

import type { SubcontractIssue } from '../clauses/clause-issues';

/** Τα ευρήματα ακριβώς σε αυτό το μονοπάτι. */
export function issuesAt(issues: readonly SubcontractIssue[], path: string): SubcontractIssue[] {
  return issues.filter((issue) => issue.path === path);
}

/** Τα ευρήματα σε αυτό το μονοπάτι **ή κάτω από αυτό**. */
export function issuesUnder(issues: readonly SubcontractIssue[], path: string): SubcontractIssue[] {
  const prefix = `${path}.`;
  return issues.filter((issue) => issue.path === path || issue.path.startsWith(prefix));
}
