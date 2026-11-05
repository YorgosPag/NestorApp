'use client';

/**
 * Το έγγραφο ενός συμφωνητικού σε HTML + το ημερολόγιο πληρωμών (εκτίμηση) — ΕΝΑ σημείο απόδοσης για το παράθυρο
 * «Προεπισκόπηση εγγράφου» (λίστα) και τη ζωντανή προεπισκόπηση του επεξεργαστή (ADR-928 §5.17 · Φ3γ).
 *
 * 🔑 Πρόχειρο → στιγμιότυπο με τις **ίδιες** συναρτήσεις του `issue` → `AgreementDocument` ανά γλώσσα → HTML.
 *    Δίγλωσσο ⇒ παράλληλες στήλες (§5.2.2). Ρήτρα με καρφωμένη έκδοση που δεν είναι σε ισχύ **δεν μαντεύεται**.
 * Φορτώνεται μόνο μέσα από `import()` (ADR-744 §34): μοντέλο, bundles εγγράφου και ολογράφως δεν μπαίνουν στο slice.
 */

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { AgreementDocumentPreview, type AgreementDocumentPreviewProps } from './AgreementDocumentPreview';
import { PaymentCalendarPreview } from './PaymentCalendarPreview';

const DEFAULT_SPAN_MONTHS = 3;

interface AgreementProps {
  readonly agreement: SubcontractAgreement;
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

/** Το ημερολόγιο πληρωμών (εκτίμηση) με ορίσιμη έναρξη/πέρας. */
export function AgreementPaymentCalendar({ agreement }: AgreementProps) {
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

type DocumentColumnsProps = AgreementProps & Pick<AgreementDocumentPreviewProps, 'fit' | 'onEdit'>;

/** Το έγγραφο ανά γλώσσα, με ορατές τις αιτίες που δεν θα εκδοθεί όπως φαίνεται. */
export function AgreementDocumentColumns({ agreement, fit, onEdit }: DocumentColumnsProps) {
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
        {documents.map((document) => <AgreementDocumentPreview key={document.language} document={document} fit={fit} onEdit={onEdit} />)}
      </section>
    </>
  );
}
