'use client';

/**
 * @fileoverview **Προβολή ευρημάτων ελέγχου — τα κοινά κομμάτια** (ADR-ACC-003 §22.8).
 * @module subapps/accounting/components/invoices/forms/invoice-review-presentation
 *
 * Ένα κείμενο ανά εύρημα, ίδιο στη σύνοψη και κάτω από τη γραμμή (GOV.UK: «το μήνυμα της σύνοψης ταιριάζει με το
 * inline»). Η βαθμίδα λέγεται με **σχήμα** εικονιδίου και λέξη, όχι μόνο με χρώμα (WCAG 1.4.1 · ADR-771).
 */

import { Info, OctagonX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useIconSizes } from '@/hooks/useIconSizes';
import { formatList } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { InvoiceReviewFinding } from '@/subapps/accounting/services/invoices/invoice-review';
import type { InvoiceReviewSeverity } from '@/subapps/accounting/services/invoices/review-severity';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

const SEVERITY_ICON = {
  block: OctagonX,
  warn: TriangleAlert,
  info: Info,
} as const satisfies Record<InvoiceReviewSeverity, LucideIcon>;

/** Η απόχρωση κάθε βαθμίδας — συμπληρωματικό κανάλι, ποτέ το μόνο. */
export function useSeverityTone(): Readonly<Record<InvoiceReviewSeverity, string>> {
  const colors = useSemanticColors();
  return { block: colors.text.error, warn: colors.text.warning, info: colors.text.info };
}

export function ReviewSeverityIcon({ severity, className }: { severity: InvoiceReviewSeverity; className?: string }) {
  const iconSizes = useIconSizes();
  const tone = useSeverityTone();
  const Icon = SEVERITY_ICON[severity];
  return <Icon aria-hidden="true" className={cn(iconSizes.sm, 'shrink-0', tone[severity], className)} />;
}

/** Το κείμενο ενός ευρήματος — η ΜΙΑ συνάρτηση για σύνοψη και γραμμή. */
export function useReviewFindingMessage(): (finding: InvoiceReviewFinding) => string {
  const { t } = useTranslation('accounting');
  return useCallback(
    (finding: InvoiceReviewFinding) => {
      // Ο σύνδεσμος («και» / «and») από το Intl, ποτέ γραμμένος εδώ (N.11).
      const dimensions = formatList(finding.dimensions.map((dimension) => t(`invoices.review.dimensions.${dimension}`)));
      return t(`invoices.review.codes.${finding.code}`, { code: finding.vatExemptionCategory ?? '', dimensions });
    },
    [t],
  );
}

/** Τα ευρήματα μιας γραμμής, κάτω από το πεδίο της αιτίας — το `id` το δείχνει το `aria-describedby` του πεδίου. */
export function InvoiceLineReviewNote({ id, findings }: { id: string; findings: readonly InvoiceReviewFinding[] }) {
  const messageOf = useReviewFindingMessage();
  if (findings.length === 0) return null;
  return (
    <ul id={id} className="mt-2 space-y-1">
      {findings.map((finding) => (
        <li key={finding.code} className="flex items-start gap-2 text-xs">
          <ReviewSeverityIcon severity={finding.severity} className="mt-px" />
          <span>{messageOf(finding)}</span>
        </li>
      ))}
    </ul>
  );
}
