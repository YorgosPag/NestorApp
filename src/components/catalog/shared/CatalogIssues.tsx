'use client';

/**
 * @fileoverview **Τα ευρήματα επικύρωσης, δίπλα στο πεδίο τους** (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/shared/CatalogIssues
 *
 * Οι επικυρωτές του πυρήνα επιστρέφουν **κωδικούς με διαδρομή** (`units[2].factor`) — οι ίδιοι στην οθόνη και στον
 * γραφέα. Εδώ μόνο: ποια ευρήματα ανήκουν σε ποιο πεδίο, και η μετάφρασή τους (`catalog:issues.*`, παρεμβολή ICU).
 */

import React, { useCallback } from 'react';

import { useDeferredMessage } from '@/i18n/hooks/useDeferredMessageTable';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { CATALOG_ISSUE_TABLE } from './catalog-issue-messages';
import { useCatalogText } from './catalog-ui-hooks';

/** Τα ευρήματα **στο** `path` ή **κάτω** από αυτό (`attributes` ⇒ και `attributes[3].attributeId`). */
export function issuesUnder(issues: readonly CatalogIssue[], path: string): CatalogIssue[] {
  return issues.filter(
    (issue) => issue.path === path || issue.path.startsWith(`${path}.`) || issue.path.startsWith(`${path}[`),
  );
}

/**
 * Η μετάφραση ενός ευρήματος (ADR-744 §34). Ο πίνακας φτάνει εκτός πρώτου καρέ· μέχρι τότε η γενική λέξη του slice.
 * @param needed υπάρχει **τώρα** εύρημα να δειχτεί ⇒ φόρτωση αμέσως, αντί για προφόρτωση σε αδράνεια.
 */
export function useIssueMessage(needed = false): (issue: CatalogIssue) => string {
  const { t, uiLanguage } = useCatalogText();
  const pending = useIssuePending();
  const translate = useDeferredMessage(CATALOG_ISSUE_TABLE, { language: uiLanguage, needed, t, pending });
  return useCallback((issue: CatalogIssue) => translate(issue.code, issue.params), [translate]);
}

/**
 * Η λέξη όσο φορτώνεται ένας πίνακας ευρημάτων (καταλόγου **ή** εισαγωγής): αληθινή για ΚΑΘΕ εύρημα («χρειάζεται
 * διόρθωση» — όχι «μη έγκυρη τιμή»: πολλά δεν είναι τιμές), σύντομη, και ζει στο slice. Αντικαθίσταται μόλις φτάσει η ακριβής.
 */
export function useIssuePending(): string {
  const { t } = useCatalogText();
  return t('common.issuePending');
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
  const mine = exact ? issues.filter((issue) => issue.path === path) : issuesUnder(issues, path);
  const message = useIssueMessage(mine.length > 0);
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
  const message = useIssueMessage(issues.length > 0);
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
