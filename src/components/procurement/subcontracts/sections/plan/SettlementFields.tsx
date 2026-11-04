'use client';

/**
 * **Με τι πληρώνεται** (ADR-928 §5.4.1 άξονας 3): μερίδια μέσων που αθροίζουν 100% για κάθε πληρωμή, και προαιρετικά
 * **άλλα** για την εξόφληση (π.χ. «50% τράπεζα, 50% επιταγή 4 μηνών»). Και τα ορόσημα και η προκαταβολή.
 *
 * 🔑 Αλλαγή μέσου μέσω `withInstrument`: μόνο η επιταγή κρατά ημέρες λήξης.
 * 🔑 Τα μετρητά **επιτρέπονται** (εντολή Giorgio, §5.4.1). Η προειδοποίηση ορίου ζει στο ημερολόγιο πληρωμών της
 *    προεπισκόπησης (`cashOverLimit`), όπου υπάρχει το **ποσό**, όχι εδώ που υπάρχει μόνο ποσοστό.
 */

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnumSelect } from '@/components/ui/enum-select';
import { MoneyField, NumericField, PercentField } from '@/components/ui/numeric-field';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { removeAt, replaceAt } from '@/lib/array-utils';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { documentLocaleOf, MILESTONE_KEYS } from '@/subapps/procurement/subcontracts/document/document-locale';
import { milestoneLabel } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { NEW_ADVANCE, NEW_SETTLEMENT_SHARE, newMilestonePayment, withInstrument } from '@/subapps/procurement/subcontracts/terms/plan-edits';
import { SETTLEMENT_INSTRUMENTS, type AdvancePaymentTerms, type MilestonePayment, type SettlementShare } from '@/subapps/procurement/subcontracts/types/payment-plan';
import { EditorField } from '../../editor/EditorField';
import { FieldIssues } from '../../editor/FieldIssues';
import { SharesEditor } from '../SharesEditor';
import type { PaymentPlanSectionProps } from './PaymentPlanSection';

function SharesOf({ id, legend, shares, set, path, props }: { readonly id: string; readonly legend: string; readonly shares: readonly SettlementShare[]; readonly set: (shares: readonly SettlementShare[]) => void; readonly path: string; readonly props: PaymentPlanSectionProps }) {
  const { t } = useTranslation('procurement');
  return (
    <SharesEditor<SettlementShare>
      id={id} legend={legend} items={shares} onChange={set} shareOf={(share) => share.share} withShare={(share, next) => ({ ...share, share: next })}
      newItem={() => NEW_SETTLEMENT_SHARE} addLabel={t('subcontracts.sections.plan.addInstrument')} path={path} issues={props.issues} language={props.language}
      renderFields={(share, update, index) => (
        <span className="flex flex-wrap items-end gap-2">
          <EnumSelect id={`${id}-${index}-instrument`} ariaLabel={t('subcontracts.sections.plan.instrumentLabel')} value={share.instrument} values={SETTLEMENT_INSTRUMENTS}
            getLabel={(instrument) => t(`subcontracts.sections.plan.instrument.${instrument}`)} onValueChange={(instrument) => update(withInstrument(share, instrument))} />
          {share.instrument === 'cheque' && (
            <span className="w-24"><NumericField id={`${id}-${index}-maturity`} aria-label={t('subcontracts.sections.plan.chequeDays')} value={share.chequeMaturityDays ?? 0} min={1} step={1}
              onValueChange={(chequeMaturityDays) => update({ ...share, chequeMaturityDays })} /></span>
          )}
        </span>
      )}
    />
  );
}

export function SettlementFields(props: PaymentPlanSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, path } = props;
  const settlement = value.settlement;
  const at = joinPath(path, 'settlement');
  const set = (next: typeof settlement) => onChange({ ...value, settlement: next });
  return (
    <fieldset className="space-y-3">
      <SharesOf id="plan-regular" legend={t('subcontracts.sections.plan.regular')} shares={settlement.regular} set={(regular) => set({ ...settlement, regular })} path={joinPath(at, 'regular')} props={props} />
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={settlement.final !== null} onCheckedChange={(on) => set({ ...settlement, final: on ? settlement.regular : null })} />
        {t('subcontracts.sections.plan.ownFinal')}
      </label>
      {settlement.final && <SharesOf id="plan-final-shares" legend={t('subcontracts.sections.plan.finalShares')} shares={settlement.final} set={(final) => set({ ...settlement, final })} path={joinPath(at, 'final')} props={props} />}
    </fieldset>
  );
}

function MilestoneRow({ payment, index, update, language }: { readonly payment: MilestonePayment; readonly index: number; readonly update: (next: MilestonePayment) => void; readonly language: PaymentPlanSectionProps['language'] }) {
  const { t } = useTranslation('procurement');
  const id = `plan-milestone-${index}`;
  const amount = payment.amount;
  return (
    <span className="flex flex-wrap items-end gap-2">
      <EnumSelect id={`${id}-key`} ariaLabel={t('subcontracts.sections.plan.milestone')} value={payment.milestone} values={[...new Set([...MILESTONE_KEYS, payment.milestone])]}
        getLabel={(key) => milestoneLabel(key, documentLocaleOf(language))} onValueChange={(milestone) => update({ ...payment, milestone })} />
      <EnumSelect id={`${id}-kind`} ariaLabel={t('subcontracts.sections.plan.amountKind')} value={amount.kind} values={['percent', 'fixed'] as const}
        getLabel={(kind) => t(`subcontracts.sections.plan.amountKinds.${kind}`)} onValueChange={(kind) => update({ ...payment, amount: { kind, value: 0 } })} />
      <span className="w-28">
        {amount.kind === 'percent'
          ? <PercentField id={`${id}-value`} aria-label={t('subcontracts.sections.plan.amount')} value={amount.value} onValueChange={(next) => update({ ...payment, amount: { kind: 'percent', value: next } })} />
          : <MoneyField id={`${id}-value`} aria-label={t('subcontracts.sections.plan.amount')} value={amount.value} onValueChange={(next) => update({ ...payment, amount: { kind: 'fixed', value: next } })} />}
      </span>
    </span>
  );
}

export function MilestoneFields(props: PaymentPlanSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, path, issues, language } = props;
  const set = (milestones: readonly MilestonePayment[]) => onChange({ ...value, milestones });
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{t('subcontracts.sections.plan.milestones')}</legend>
      <ul className="space-y-2">
        {value.milestones.map((payment, index) => (
          <li key={`milestone-${index}`} className="flex flex-wrap items-end gap-2">
            <MilestoneRow payment={payment} index={index} language={language} update={(next) => set(replaceAt(value.milestones, index, next))} />
            <Button type="button" variant="ghost" size="icon" aria-label={t('subcontracts.sections.plan.removeMilestone', { position: index + 1 })} onClick={() => set(removeAt(value.milestones, index))}><Trash2 className="h-4 w-4" aria-hidden /></Button>
            <FieldIssues issues={issuesAt(issues, joinPath(path, 'milestones', index))} />
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={() => set([...value.milestones, newMilestonePayment(MILESTONE_KEYS[0])])}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.sections.plan.addMilestone')}</Button>
    </fieldset>
  );
}

function AdvanceBody({ advance, set }: { readonly advance: AdvancePaymentTerms; readonly set: (next: AdvancePaymentTerms) => void }) {
  const { t } = useTranslation('procurement');
  const recovery = advance.recovery;
  return (
    <span className="flex flex-wrap items-end gap-3">
      <EditorField id="plan-advance-amount" label={t('subcontracts.sections.plan.advanceAmount')}>
        <MoneyField id="plan-advance-amount" value={advance.amount} onValueChange={(amount) => set({ ...advance, amount })} />
      </EditorField>
      <EditorField id="plan-advance-recovery" label={t('subcontracts.sections.plan.advanceRecovery')}>
        <EnumSelect id="plan-advance-recovery" value={recovery.kind} values={['on_final', 'per_payment'] as const} getLabel={(kind) => t(`subcontracts.sections.plan.recovery.${kind}`)}
          onValueChange={(kind) => set({ ...advance, recovery: kind === 'per_payment' ? { kind, rate: 0 } : { kind } })} />
      </EditorField>
      {recovery.kind === 'per_payment' && (
        <EditorField id="plan-advance-rate" label={t('subcontracts.sections.plan.advanceRate')}>
          <PercentField id="plan-advance-rate" value={recovery.rate} onValueChange={(rate) => set({ ...advance, recovery: { kind: 'per_payment', rate } })} />
        </EditorField>
      )}
    </span>
  );
}

export function AdvanceFields(props: PaymentPlanSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, path, issues } = props;
  const set = (advance: AdvancePaymentTerms | null) => onChange({ ...value, advance });
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Switch aria-label={t('subcontracts.sections.plan.advance')} checked={value.advance !== null} onCheckedChange={(on) => set(on ? NEW_ADVANCE : null)} />
        {t('subcontracts.sections.plan.advance')}
      </legend>
      {value.advance && <AdvanceBody advance={value.advance} set={set} />}
      <FieldIssues issues={issuesAt(issues, joinPath(path, 'advance'))} />
    </fieldset>
  );
}
