'use client';

/**
 * @fileoverview **Τα ευρήματα επικύρωσης, δίπλα στο πεδίο τους** (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/shared/CatalogIssues
 *
 * Οι επικυρωτές του πυρήνα επιστρέφουν **κωδικούς με διαδρομή** (`units[2].factor`) — οι ίδιοι στην οθόνη και στον
 * γραφέα. Εδώ μόνο: ποια ευρήματα ανήκουν σε ποιο πεδίο, και η μετάφρασή τους (`catalog:issues.*`, παρεμβολή ICU).
 */

import React, { useCallback } from 'react';

import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { ISSUE_KEYS } from './catalog-labels';
import { useCatalogText } from './catalog-ui-hooks';

/** Τα ευρήματα **στο** `path` ή **κάτω** από αυτό (`attributes` ⇒ και `attributes[3].attributeId`). */
export function issuesUnder(issues: readonly CatalogIssue[], path: string): CatalogIssue[] {
  return issues.filter(
    (issue) => issue.path === path || issue.path.startsWith(`${path}.`) || issue.path.startsWith(`${path}[`),
  );
}

/** Η μετάφραση ενός ευρήματος. */
export function useIssueMessage(): (issue: CatalogIssue) => string {
  const { t } = useCatalogText();
  return useCallback((issue: CatalogIssue) => t(ISSUE_KEYS[issue.code], issue.params ?? {}), [t]);
}

interface FieldIssuesProps {
  readonly issues: readonly CatalogIssue[];
  /** Ακριβής διαδρομή (`exact`) ή υποδέντρο. */
  readonly path: string;
  readonly exact?: boolean;
  readonly id?: string;
}

/** Τα ευρήματα ενός πεδίου — συνδέεται με το πεδίο μέσω `aria-describedby={id}`. */
export function FieldIssues({ issues, path, exact = false, id }: FieldIssuesProps) {
  const message = useIssueMessage();
  const mine = exact ? issues.filter((issue) => issue.path === path) : issuesUnder(issues, path);
  if (mine.length === 0) return null;
  return (
    <ul id={id} className="m-0 flex list-none flex-col gap-0.5 p-0 text-xs text-destructive" role="alert">
      {mine.map((issue, index) => (
        <li key={`${issue.path}-${issue.code}-${index}`}>{message(issue)}</li>
      ))}
    </ul>
  );
}

/** Πού ζει ένα εύρημα, με λέξεις: το όνομα του πεδίου και η μετάβαση σε αυτό. */
export interface IssueLocation {
  readonly label: string;
  readonly onSelect: () => void;
}

interface IssueSummaryProps {
  readonly issues: readonly CatalogIssue[];
  readonly title: string;
  /**
   * Ονομάζει το πεδίο ενός ευρήματος (Akeneo: η σύνοψη σε πηγαίνει στην ιδιότητα). Χωρίς αυτό ⇒ η διαδρομή, όπως στους
   * επεξεργαστές σχήματος. Ζωντανά (ADR-923 §5.10.5) το προϊόν έδειχνε `values.cattr_3a6f…` — ωμό UUID.
   */
  readonly locate?: (issue: CatalogIssue) => IssueLocation | null;
}

function IssuePlace({ issue, locate }: { readonly issue: CatalogIssue; readonly locate: IssueSummaryProps['locate'] }) {
  const place = locate?.(issue) ?? null;
  if (!place) return <code className="text-xs text-muted-foreground">{issue.path}</code>;
  return <button type="button" className="text-xs font-medium underline underline-offset-2" onClick={place.onSelect}>{place.label}</button>;
}

/** Όλα τα ευρήματα μαζί (π.χ. πάνω από τις καρτέλες) — με το σημείο τους. */
export function IssueSummary({ issues, title, locate }: IssueSummaryProps) {
  const message = useIssueMessage();
  if (issues.length === 0) return null;
  return (
    <section className="rounded-md border border-destructive/40 bg-destructive/5 p-3" aria-live="polite">
      <h3 className="m-0 text-sm font-semibold text-destructive">{title}</h3>
      <ul className="m-0 mt-1 flex list-disc flex-col gap-0.5 pl-5 text-sm text-foreground">
        {issues.map((issue, index) => (
          <li key={`${issue.path}-${issue.code}-${index}`}>
            {message(issue)} <IssuePlace issue={issue} locate={locate} />
          </li>
        ))}
      </ul>
    </section>
  );
}
