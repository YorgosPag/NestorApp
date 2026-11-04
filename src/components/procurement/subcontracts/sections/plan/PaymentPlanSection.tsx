'use client';

/**
 * **Σχέδιο πληρωμών** — γενική ενότητα (ADR-928 §5.4.1 · Φ3γ-2 αποφάσεις 1, 2 και 7): τι πληρώνεται · πότε · με τι ·
 * όριο παραχθέντος · ορόσημα · προκαταβολή · κράτηση.
 *
 * 🏆 Κάτω από τα πεδία, η **φράση του εγγράφου** (`describePaymentPlan`, ο ίδιος παραγωγός με το PDF): ο άνθρωπος διαβάζει
 *    ό,τι θα υπογράψει, όχι μια περίληψη της φόρμας. Το ημερολόγιο με ημερομηνίες και ποσά είναι στην προεπισκόπηση.
 */

import { useDeferredValue } from 'react';
import { EnumSelect } from '@/components/ui/enum-select';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { describePaymentPlan } from '@/subapps/procurement/subcontracts/document/describe-payment-plan';
import { documentLocaleOf, isDocumentLanguage } from '@/subapps/procurement/subcontracts/document/document-locale';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '@/subapps/procurement/subcontracts/types/clause';
import { NEW_RETENTION } from '@/subapps/procurement/subcontracts/terms/plan-edits';
import { PAYMENT_BASES, type PaymentPlan, type RetentionTerms } from '@/subapps/procurement/subcontracts/types/payment-plan';
import { EditorField } from '../../editor/EditorField';
import type { BoundTermsView, SectionProps } from '../section-types';
import { RetentionFields } from './RetentionFields';
import { ScheduleFields } from './ScheduleFields';
import { AdvanceFields, MilestoneFields, SettlementFields } from './SettlementFields';

export interface PaymentPlanSectionProps extends SectionProps<PaymentPlan> {
  /** Ρωτά σχετικά με το σχέδιο (`retention.rate`, `schedule.anchor.weekday`). */
  readonly bound: BoundTermsView;
}

function BasisFields(props: PaymentPlanSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, issues, path } = props;
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <EditorField id="plan-basis" label={t('subcontracts.sections.plan.basisLabel')} issues={issuesAt(issues, joinPath(path, 'basis'))}>
        <EnumSelect id="plan-basis" value={value.basis} values={PAYMENT_BASES} getLabel={(basis) => t(`subcontracts.sections.plan.basis.${basis}`)} onValueChange={(basis) => onChange({ ...value, basis })} />
      </EditorField>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <Switch checked={value.capAtEarnedValue} onCheckedChange={(capAtEarnedValue) => onChange({ ...value, capAtEarnedValue })} />
        {t('subcontracts.sections.plan.cap.capped')}
      </label>
    </fieldset>
  );
}

function RetentionSection(props: PaymentPlanSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, path, issues, language, bound } = props;
  const set = (retention: RetentionTerms | null) => onChange({ ...value, retention });
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Switch aria-label={t('subcontracts.sections.plan.retention')} checked={value.retention !== null} onCheckedChange={(on) => set(on ? NEW_RETENTION : null)} />
        {t('subcontracts.sections.plan.retention')}
      </legend>
      {value.retention && <RetentionFields id="plan-retention" value={value.retention} onChange={set} path={joinPath(path, 'retention')} issues={issues} language={language} bound={bound} />}
    </fieldset>
  );
}

/** Στις γλώσσες του **εγγράφου** (ελληνικά + η δεύτερη αν τυπώνεται), όχι της οθόνης: αυτό θα υπογραφεί. */
function PlanSentence({ plan, secondaryLanguage }: { readonly plan: PaymentPlan; readonly secondaryLanguage: string | null }) {
  const { t } = useTranslation('procurement');
  const deferred = useDeferredValue(plan);
  const languages = [CLAUSE_AUTHORITATIVE_LANGUAGE, ...(secondaryLanguage && isDocumentLanguage(secondaryLanguage) ? [secondaryLanguage] : [])];
  return (
    <aside aria-labelledby="plan-sentence" className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
      <h4 id="plan-sentence" className="font-medium">{t('subcontracts.sections.plan.asPrinted')}</h4>
      {languages.map((language) => (
        <ul key={language} lang={language} className="space-y-1">
          {describePaymentPlan(deferred, documentLocaleOf(language)).map((sentence) => <li key={sentence}>{sentence}</li>)}
        </ul>
      ))}
    </aside>
  );
}

export function PaymentPlanSection(props: PaymentPlanSectionProps) {
  const { t } = useTranslation('procurement');
  return (
    <section aria-labelledby="editor-plan" className="space-y-4">
      <h3 id="editor-plan" className="text-base font-semibold">{t('subcontracts.sections.plan.title')}</h3>
      <BasisFields {...props} />
      <ScheduleFields {...props} />
      <SettlementFields {...props} />
      <MilestoneFields {...props} />
      <AdvanceFields {...props} />
      <RetentionSection {...props} />
      <PlanSentence plan={props.value} secondaryLanguage={props.secondaryLanguage} />
    </section>
  );
}
