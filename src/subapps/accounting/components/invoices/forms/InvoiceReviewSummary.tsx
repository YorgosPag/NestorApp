'use client';

/**
 * @fileoverview **Έλεγχος πριν την έκδοση — η σύνοψη** (ADR-ACC-003 §22.8).
 * @module subapps/accounting/components/invoices/forms/InvoiceReviewSummary
 *
 * Μοτίβο GOV.UK «error summary» + βαθμίδες EN 16931 / SAP: ομάδες ανά βαθμίδα (σοβαρότερο πρώτο), κάθε εύρημα με
 * κείμενο, γραμμή, το σφάλμα ΑΑΔΕ που προλαβαίνει, και **μετάβαση στο πεδίο** που το διορθώνει. Ζωντανά καθώς γράφει
 * ο χρήστης — όχι μόνο στην υποβολή. Δεν μπλοκάρει την αποθήκευση (πρόχειρο).
 */

import { CircleCheck } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import type { InvoiceReviewFinding } from '@/subapps/accounting/services/invoices/invoice-review';
import {
  INVOICE_REVIEW_SEVERITIES,
  type InvoiceReviewSeverity,
} from '@/subapps/accounting/services/invoices/review-severity';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { invoiceFieldIdOf } from './invoice-field-ids';
import { ReviewSeverityIcon, useReviewFindingMessage } from './invoice-review-presentation';

interface InvoiceReviewSummaryProps {
  readonly findings: readonly InvoiceReviewFinding[];
  /** Πρόθεμα των `id` της φόρμας (ίδιο με του `LineItemsEditor`). */
  readonly fieldIdPrefix: string;
}

/** Εστίαση στο πεδίο του ευρήματος — κεντραρισμένο, χωρίς δεύτερο άλμα από το `focus`. */
function focusField(id: string): void {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

function FindingMeta({ finding }: { finding: InvoiceReviewFinding }) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();
  const parts: string[] = [];
  if (finding.lineNumber !== null) parts.push(t('invoices.review.line', { line: finding.lineNumber }));
  if (finding.aadeErrors.length > 0) {
    parts.push(t('invoices.review.aadeErrors', { count: finding.aadeErrors.length, codes: finding.aadeErrors.join(' / ') }));
  }
  if (finding.anchor.kind === 'company') parts.push(t('invoices.review.companySetup'));
  if (parts.length === 0) return null;
  return <span className={cn('block text-xs', colors.text.muted)}>{parts.join(' · ')}</span>;
}

function FindingItem({ finding, fieldIdPrefix }: { finding: InvoiceReviewFinding; fieldIdPrefix: string }) {
  const { t } = useTranslation('accounting');
  const messageOf = useReviewFindingMessage();
  const targetId = invoiceFieldIdOf(fieldIdPrefix, finding.anchor);
  return (
    <li className="flex items-start justify-between gap-4">
      <span className="space-y-0.5">
        <span className="block text-sm">{messageOf(finding)}</span>
        <FindingMeta finding={finding} />
      </span>
      {targetId !== null && (
        <Button type="button" variant="link" size="sm" className="shrink-0" onClick={() => focusField(targetId)}>
          {t('invoices.review.goTo')}
        </Button>
      )}
    </li>
  );
}

function SeverityGroup({ severity, findings, fieldIdPrefix }: {
  severity: InvoiceReviewSeverity; findings: readonly InvoiceReviewFinding[]; fieldIdPrefix: string;
}) {
  const { t } = useTranslation('accounting');
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h4 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
        <ReviewSeverityIcon severity={severity} />
        {t(`invoices.review.groups.${severity}`, { count: findings.length })}
      </h4>
      <ul className="space-y-2 pl-6">
        {findings.map((finding) => (
          <FindingItem
            key={`${finding.code}-${finding.lineNumber ?? 'doc'}`}
            finding={finding}
            fieldIdPrefix={fieldIdPrefix}
          />
        ))}
      </ul>
    </section>
  );
}

export function InvoiceReviewSummary({ findings, fieldIdPrefix }: InvoiceReviewSummaryProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="rounded-lg border border-border p-4 space-y-3">
      <h3 id={titleId} className="text-base font-semibold">{t('invoices.review.title')}</h3>
      {findings.length === 0 ? (
        <p className="flex items-center gap-2 text-sm">
          <CircleCheck aria-hidden="true" className={cn(iconSizes.sm, colors.text.success)} />
          {t('invoices.review.ready')}
        </p>
      ) : (
        <>
          {INVOICE_REVIEW_SEVERITIES.map((severity) => {
            const group = findings.filter((finding) => finding.severity === severity);
            return group.length === 0 ? null : (
              <SeverityGroup key={severity} severity={severity} findings={group} fieldIdPrefix={fieldIdPrefix} />
            );
          })}
          <p className={cn('text-xs', colors.text.muted)}>{t('invoices.review.draftNote')}</p>
        </>
      )}
    </section>
  );
}
