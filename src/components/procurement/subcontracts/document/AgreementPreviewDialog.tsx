'use client';

/**
 * Το παράθυρο «Προεπισκόπηση εγγράφου» (ADR-928 §5.17): πρόχειρο → στιγμιότυπο με τις **ίδιες** συναρτήσεις του
 * `issue` → `AgreementDocument` ανά γλώσσα → HTML. Δίγλωσσο ⇒ παράλληλες στήλες (§5.2.2). Κάτω, το ημερολόγιο
 * πληρωμών (εκτίμηση) με ορίσιμη έναρξη/πέρας.
 *
 * Φορτώνεται με `import()` από τη λίστα: το slice της καρτέλας δεν κουβαλά μοντέλο, bundles εγγράφου ή ολογράφως.
 */

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { useSubcontractClauseLibrary } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { addMonthsToDateKey, isDateKey } from '@/lib/calendar/date-key';
import { todayLocalDate } from '@/lib/date-local';
import { buildAgreementDocument } from '@/subapps/procurement/subcontracts/document/agreement-document-model';
import { documentLocaleOf, isDocumentLanguage } from '@/subapps/procurement/subcontracts/document/document-locale';
import { projectPaymentSchedule } from '@/subapps/procurement/subcontracts/document/payment-schedule-projection';
import { previewSnapshotOf } from '@/subapps/procurement/subcontracts/document/preview-snapshot';
import { estimatedAgreementValue } from '@/subapps/procurement/subcontracts/lines/line-amount';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { AgreementDocumentPreview } from './AgreementDocumentPreview';
import { PaymentCalendarPreview } from './PaymentCalendarPreview';

const DEFAULT_SPAN_MONTHS = 3;

interface AgreementPreviewDialogProps {
  readonly agreement: SubcontractAgreement;
  readonly onClose: () => void;
}

function documentLanguagesOf(agreement: SubcontractAgreement): HumanLanguage[] {
  const secondary = agreement.languages.secondary;
  return secondary && secondary !== 'el' && isDocumentLanguage(secondary) ? ['el', secondary] : ['el'];
}

function useProjectionWindow() {
  const [start, setStart] = useState(todayLocalDate);
  const [end, setEnd] = useState(() => addMonthsToDateKey(todayLocalDate(), DEFAULT_SPAN_MONTHS) ?? todayLocalDate());
  return { start, end, setStart, setEnd, valid: isDateKey(start) && isDateKey(end) && start < end };
}

function CalendarSection({ agreement }: { agreement: SubcontractAgreement }) {
  const { t, i18n } = useTranslation('procurement');
  const span = useProjectionWindow();
  const value = estimatedAgreementValue(agreement.lines).amount;
  const payments = useMemo(
    () => (span.valid ? projectPaymentSchedule({ plan: agreement.terms.paymentPlan, terms: agreement.terms, value, startDate: span.start, endDate: span.end }) : []),
    [agreement.terms, value, span.valid, span.start, span.end],
  );
  return (
    <section aria-label={t('subcontracts.preview.calendar')} className="space-y-3">
      <fieldset className="flex flex-wrap gap-4">
        <Label className="space-y-1">{t('subcontracts.preview.start')}<Input type="date" value={span.start} onChange={(event) => span.setStart(event.target.value)} /></Label>
        <Label className="space-y-1">{t('subcontracts.preview.end')}<Input type="date" value={span.end} onChange={(event) => span.setEnd(event.target.value)} /></Label>
      </fieldset>
      <PaymentCalendarPreview
        payments={payments}
        locale={documentLocaleOf(resolveHumanLanguage(i18n.language))}
        cashLimit={agreement.terms.cashLimitPerPayment}
        hasValue={value > 0 && span.valid}
      />
    </section>
  );
}

function DocumentColumns({ agreement }: { agreement: SubcontractAgreement }) {
  const { t } = useTranslation('procurement');
  const { clauses, versions, loading } = useSubcontractClauseLibrary();
  const preview = useMemo(() => previewSnapshotOf(agreement, clauses, versions), [agreement, clauses, versions]);
  const documents = useMemo(() => documentLanguagesOf(agreement).map((language) => buildAgreementDocument(preview.snapshot, language)), [agreement, preview]);
  if (loading) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('subcontracts.preview.loading')}</p>;
  }
  const translationMissing = documents.some((document) => document.issues.length > 0);
  return (
    <>
      {preview.unavailable.length > 0 && <p role="alert" className="text-sm text-destructive">{t('subcontracts.preview.unavailable', { clauses: preview.unavailable.join(', ') })}</p>}
      {translationMissing && <p role="alert" className="text-sm text-destructive">{t('subcontracts.preview.translationMissing')}</p>}
      <section className={documents.length > 1 ? 'grid gap-4 lg:grid-cols-2' : undefined}>
        {documents.map((document) => <AgreementDocumentPreview key={document.language} document={document} />)}
      </section>
    </>
  );
}

export default function AgreementPreviewDialog({ agreement, onClose }: AgreementPreviewDialogProps) {
  const { t } = useTranslation('procurement');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('subcontracts.preview.title', { number: agreement.documentNumber })}</DialogTitle>
          <DialogDescription>{t('subcontracts.preview.description')}</DialogDescription>
        </DialogHeader>
        <DocumentColumns agreement={agreement} />
        <CalendarSection agreement={agreement} />
      </DialogContent>
    </Dialog>
  );
}
