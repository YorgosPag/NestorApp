'use client';

/**
 * Κράτηση καλής εκτέλεσης (ADR-928 §5.4.1): ποσοστό και απόδοση **σε δόσεις** (π.χ. 50% στην προσωρινή παραλαβή, 50% 12
 * μήνες μετά). Το ίδιο στοιχείο για το σχέδιο πληρωμών και για την υπέρβαση ανά γραμμή (Procore: κράτηση ανά γραμμή).
 *
 * 🔑 Οι δόσεις είναι μερίδια ⇒ το ΕΝΑ `SharesEditor`, με τα ίδια μονοπάτια ευρημάτων με το `validateRetention`.
 */

import { EnumSelect } from '@/components/ui/enum-select';
import { NumericField, PercentField } from '@/components/ui/numeric-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HumanLanguage } from '@/i18n/languages';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath, type SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { NEW_RELEASE_INSTALLMENT, RELEASE_CHOICES, releaseChoiceOf, triggerOfChoice } from '@/subapps/procurement/subcontracts/terms/plan-edits';
import type { RetentionReleaseInstallment, RetentionTerms } from '@/subapps/procurement/subcontracts/types/payment-plan';
import { EditorField } from '../../editor/EditorField';
import { FieldIssues } from '../../editor/FieldIssues';
import { BoundTermZone } from '../BoundTermZone';
import { SharesEditor } from '../SharesEditor';
import type { BoundTermsView } from '../section-types';

interface RetentionFieldsProps {
  readonly id: string;
  readonly value: RetentionTerms;
  readonly onChange: (next: RetentionTerms) => void;
  readonly path: string;
  readonly issues: readonly SubcontractIssue[];
  readonly language: HumanLanguage;
  /** Μόνο στο σχέδιο του συμφωνητικού: η ρήτρα κράτησης δένει το ποσοστό. Η υπέρβαση γραμμής δεν δένεται. */
  readonly bound?: BoundTermsView;
}

function InstallmentTrigger({ id, installment, update, path, issues }: { readonly id: string; readonly installment: RetentionReleaseInstallment; readonly update: (next: RetentionReleaseInstallment) => void; readonly path: string; readonly issues: readonly SubcontractIssue[] }) {
  const { t } = useTranslation('procurement');
  const trigger = installment.trigger;
  return (
    <span className="flex flex-wrap items-end gap-2">
      <EnumSelect id={`${id}-trigger`} ariaLabel={t('subcontracts.sections.plan.releaseWhen')} value={releaseChoiceOf(trigger)} values={RELEASE_CHOICES}
        getLabel={(choice) => t(`subcontracts.sections.plan.release.${choice}`)} onValueChange={(choice) => update({ ...installment, trigger: triggerOfChoice(choice, trigger) })} />
      {trigger.kind === 'months_after' && (
        <span className="w-24"><NumericField id={`${id}-months`} aria-label={t('subcontracts.sections.plan.releaseMonths')} value={trigger.months} min={1} step={1}
          onValueChange={(months) => update({ ...installment, trigger: { ...trigger, months } })} /></span>
      )}
      <FieldIssues issues={issuesAt(issues, joinPath(path, 'trigger'))} />
    </span>
  );
}

export function RetentionFields({ id, value, onChange, path, issues, language, bound }: RetentionFieldsProps) {
  const { t } = useTranslation('procurement');
  const releasePath = joinPath(path, 'release');
  return (
    <fieldset className="space-y-3">
      <span className="grid gap-1">
        <EditorField id={`${id}-rate`} label={t('subcontracts.sections.plan.retentionRate')} issues={issuesAt(issues, joinPath(path, 'rate'))}>
          <PercentField id={`${id}-rate`} value={value.rate} onValueChange={(rate) => onChange({ ...value, rate })} />
        </EditorField>
        {bound && <BoundTermZone termPath="retention.rate" bound={bound} issues={issues} language={language} />}
      </span>
      <SharesEditor<RetentionReleaseInstallment>
        id={`${id}-release`} legend={t('subcontracts.sections.plan.release.title')} items={value.release} onChange={(release) => onChange({ ...value, release })}
        shareOf={(installment) => installment.share} withShare={(installment, share) => ({ ...installment, share })} newItem={() => NEW_RELEASE_INSTALLMENT}
        addLabel={t('subcontracts.sections.plan.release.add')} path={releasePath} issues={issues} language={language}
        renderFields={(installment, update, index) => (
          <InstallmentTrigger id={`${id}-release-${index}`} installment={installment} update={update} path={joinPath(releasePath, index)} issues={issues} />
        )}
      />
    </fieldset>
  );
}
