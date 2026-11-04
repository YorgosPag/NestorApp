'use client';

/**
 * Υπέρβαση του σχεδίου πληρωμών **για αυτή τη γραμμή** (ADR-928 §5.4.1, Procore: κράτηση και βάση ανά γραμμή).
 *
 * 🔑 «Όπως στο σχέδιο πληρωμών» = **απουσία** κλειδιού στο `PaymentPlanLineOverride`, όχι αντίγραφο της τιμής του
 *    συμφωνητικού. Έτσι η αλλαγή του σχεδίου φτάνει σε κάθε γραμμή που δεν το υπερβαίνει. Κενή υπέρβαση ⇒ `null`.
 */

import { EnumSelect } from '@/components/ui/enum-select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { NEW_RETENTION } from '@/subapps/procurement/subcontracts/terms/plan-edits';
import { PAYMENT_BASES, type PaymentBasis, type PaymentPlanLineOverride, type RetentionTerms } from '@/subapps/procurement/subcontracts/types/payment-plan';
import { Switch } from '@/components/ui/switch';
import { RetentionFields } from '../plan/RetentionFields';
import { EditorField } from '../../editor/EditorField';
import type { LineCardProps } from './LineCard';

const INHERIT = 'inherit';
const BASIS_CHOICES = [INHERIT, ...PAYMENT_BASES] as const;
const CAP_CHOICES = [INHERIT, 'capped', 'uncapped'] as const;

type OverrideProps = Pick<LineCardProps, 'value' | 'onChange' | 'path' | 'issues' | 'index' | 'language'>;

const orNull = (override: PaymentPlanLineOverride): PaymentPlanLineOverride | null => (Object.keys(override).length > 0 ? override : null);

function withBasis(current: PaymentPlanLineOverride | null, basis: PaymentBasis | null): PaymentPlanLineOverride | null {
  const { basis: _previous, ...rest } = current ?? {};
  return orNull(basis === null ? rest : { ...rest, basis });
}

function withCap(current: PaymentPlanLineOverride | null, capAtEarnedValue: boolean | null): PaymentPlanLineOverride | null {
  const { capAtEarnedValue: _previous, ...rest } = current ?? {};
  return orNull(capAtEarnedValue === null ? rest : { ...rest, capAtEarnedValue });
}

function withRetention(current: PaymentPlanLineOverride | null, retention: RetentionTerms | null): PaymentPlanLineOverride | null {
  const { retention: _previous, ...rest } = current ?? {};
  return orNull(retention === null ? rest : { ...rest, retention });
}

function LineRetention({ value, onChange, path, issues, index, language }: OverrideProps) {
  const { t } = useTranslation('procurement');
  const override = value.paymentOverride;
  const retention = override?.retention;
  const set = (next: RetentionTerms | null) => onChange({ ...value, paymentOverride: withRetention(override, next) });
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="mb-2 flex items-center gap-2 text-sm">
        <Switch aria-label={t('subcontracts.sections.lines.ownRetention')} checked={retention !== undefined} onCheckedChange={(on) => set(on ? NEW_RETENTION : null)} />
        {t('subcontracts.sections.lines.ownRetention')}
      </legend>
      {retention && <RetentionFields id={`line-${index}-retention`} value={retention} onChange={set} path={joinPath(path, 'paymentOverride', 'retention')} issues={issues} language={language} />}
    </fieldset>
  );
}

export function LinePaymentOverride(props: OverrideProps) {
  const { value, onChange, path, issues, index } = props;
  const { t } = useTranslation('procurement');
  const override = value.paymentOverride;
  const at = joinPath(path, 'paymentOverride');
  const id = `line-${index}-override`;
  const cap = override?.capAtEarnedValue === undefined ? INHERIT : override.capAtEarnedValue ? 'capped' : 'uncapped';
  const set = (paymentOverride: PaymentPlanLineOverride | null) => onChange({ ...value, paymentOverride });
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-2 text-sm font-medium">{t('subcontracts.sections.lines.paymentOverride')}</legend>
      <EditorField id={`${id}-basis`} label={t('subcontracts.sections.plan.basisLabel')} issues={issuesAt(issues, joinPath(at, 'basis'))}>
        <EnumSelect id={`${id}-basis`} value={override?.basis ?? INHERIT} values={BASIS_CHOICES}
          getLabel={(choice) => (choice === INHERIT ? t('subcontracts.sections.lines.inheritPlan') : t(`subcontracts.sections.plan.basis.${choice}`))}
          onValueChange={(choice) => set(withBasis(override, choice === INHERIT ? null : choice))} />
      </EditorField>
      <EditorField id={`${id}-cap`} label={t('subcontracts.sections.plan.capAtEarnedValue')}>
        <EnumSelect id={`${id}-cap`} value={cap} values={CAP_CHOICES}
          getLabel={(choice) => (choice === INHERIT ? t('subcontracts.sections.lines.inheritPlan') : t(`subcontracts.sections.plan.cap.${choice}`))}
          onValueChange={(choice) => set(withCap(override, choice === INHERIT ? null : choice === 'capped'))} />
      </EditorField>
      <LineRetention {...props} />
    </fieldset>
  );
}
