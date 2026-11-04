'use client';

/**
 * **Εμπορικοί όροι** — γενική ενότητα (ADR-928 §5.4 · Φ3γ-2 αποφάσεις 1, 2 και 6): ΦΠΑ, παρακράτηση, όριο μετρητών,
 * ποινική ρήτρα, συνεργείο, επιμερισμός, απαιτούμενα έγγραφα, ελάχιστη απόδοση. Το σχέδιο πληρωμών είναι **δική του**
 * ενότητα (`path` + `.paymentPlan`).
 *
 * 🔑 Κάθε πεδίο που δένει ρήτρα δείχνει τη ζώνη της δίπλα του (`BoundTermZone`, `termPath` από το ΕΝΑ μητρώο δεσιμάτων).
 * 🔑 Ό,τι είναι `null` στο μοντέλο (ποινή, συνεργείο) έχει διακόπτη: «χωρίς ποινή» δεν είναι «ποινή 0 €».
 * 🔑 ΦΠΑ μόνο από τον ΕΝΑ πίνακα συντελεστών (`GREEK_VAT_RATE_PERCENTS`).
 */

import type { ReactNode } from 'react';
import { EnumSelect } from '@/components/ui/enum-select';
import { MoneyField, PercentField } from '@/components/ui/numeric-field';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { basisPointsFromPercent } from '@/lib/pricing/discount-rule';
import { GREEK_VAT_RATE_PERCENTS, type GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { documentLocaleOf } from '@/subapps/procurement/subcontracts/document/document-locale';
import { NEW_PENALTY } from '@/subapps/procurement/subcontracts/terms/term-edits';
import type { AgreementLine } from '@/subapps/procurement/subcontracts/types/agreement-line';
import type { CommercialTerms } from '@/subapps/procurement/subcontracts/types/commercial-terms';
import { EditorField } from '../../editor/EditorField';
import { FieldIssues } from '../../editor/FieldIssues';
import { BoundTermZone } from '../BoundTermZone';
import type { BoundTermsView, SectionProps } from '../section-types';
import { CrewFields } from './CrewFields';
import { CostSharingFields, MinimumOutputsFields, RequiredDocumentsFields } from './TermListsFields';

export interface TermsSectionProps extends SectionProps<CommercialTerms> {
  readonly bound: BoundTermsView;
  /** Οι γραμμές του **ίδιου** εγγράφου — η ελάχιστη απόδοση δείχνει σε μία από αυτές. */
  readonly lines: readonly AgreementLine[];
}

const VAT_TREATMENTS = ['excluded', 'included'] as const;
const VAT_RATES = GREEK_VAT_RATE_PERCENTS.map(String);

/** Ένα πεδίο όρου: ετικέτα, έλεγχος, ευρήματα, και η ζώνη της ρήτρας που το δένει. */
function TermField({ props, name, label, children }: { readonly props: TermsSectionProps; readonly name: string; readonly label: string; readonly children: ReactNode }) {
  return (
    <span className="grid gap-1">
      <EditorField id={`terms-${name}`} label={label} issues={issuesAt(props.issues, joinPath(props.path, name))}>{children}</EditorField>
      <BoundTermZone termPath={name} bound={props.bound} issues={props.issues} language={props.language} />
    </span>
  );
}

function VatFields(props: TermsSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, language } = props;
  const percent = (rate: string) => documentLocaleOf(language).percent(basisPointsFromPercent(Number(rate)) ?? 0);
  const setRate = (rate: string) => {
    const match = GREEK_VAT_RATE_PERCENTS.find((candidate: GreekVatRatePercent) => String(candidate) === rate);
    if (match !== undefined) onChange({ ...value, vat: { ...value.vat, rate: match } });
  };
  return (
    <>
      <TermField props={props} name="vat.treatment" label={t('subcontracts.sections.terms.vatTreatment')}>
        <EnumSelect id="terms-vat.treatment" value={value.vat.treatment} values={VAT_TREATMENTS} getLabel={(treatment) => t(`subcontracts.sections.terms.vat.${treatment}`)} onValueChange={(treatment) => onChange({ ...value, vat: { ...value.vat, treatment } })} />
      </TermField>
      <TermField props={props} name="vat.rate" label={t('subcontracts.sections.terms.vatRate')}>
        <EnumSelect id="terms-vat.rate" value={String(value.vat.rate)} values={VAT_RATES} getLabel={percent} onValueChange={setRate} />
      </TermField>
    </>
  );
}

function WithholdingAndCash(props: TermsSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange } = props;
  const withholding = value.withholding;
  return (
    <>
      <TermField props={props} name="withholding.rate" label={t('subcontracts.sections.terms.withholding')}>
        <span className="flex items-center gap-2">
          <Switch aria-label={t('subcontracts.sections.terms.withholdingApplies')} checked={withholding.applies} onCheckedChange={(applies) => onChange({ ...value, withholding: { ...withholding, applies } })} />
          {withholding.applies && <PercentField id="terms-withholding.rate" value={withholding.rate} onValueChange={(rate) => onChange({ ...value, withholding: { ...withholding, rate } })} />}
        </span>
      </TermField>
      <TermField props={props} name="cashLimitPerPayment" label={t('subcontracts.sections.terms.cashLimit')}>
        <MoneyField id="terms-cashLimitPerPayment" value={value.cashLimitPerPayment} onValueChange={(cashLimitPerPayment) => onChange({ ...value, cashLimitPerPayment })} />
      </TermField>
    </>
  );
}

function PenaltyFields(props: TermsSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, issues, path } = props;
  const penalty = value.penalty;
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Switch aria-label={t('subcontracts.sections.terms.penalty')} checked={penalty !== null} onCheckedChange={(on) => onChange({ ...value, penalty: on ? NEW_PENALTY : null })} />
        {t('subcontracts.sections.terms.penalty')}
      </legend>
      {penalty && (
        <>
          <TermField props={props} name="penalty.perDay" label={t('subcontracts.sections.terms.penaltyPerDay')}>
            <MoneyField id="terms-penalty.perDay" value={penalty.perDay} onValueChange={(perDay) => onChange({ ...value, penalty: { ...penalty, perDay } })} />
          </TermField>
          <TermField props={props} name="penalty.capOfContractValue" label={t('subcontracts.sections.terms.penaltyCap')}>
            <PercentField id="terms-penalty.capOfContractValue" value={penalty.capOfContractValue} onValueChange={(capOfContractValue) => onChange({ ...value, penalty: { ...penalty, capOfContractValue } })} />
          </TermField>
        </>
      )}
      <FieldIssues issues={issuesAt(issues, joinPath(path, 'penalty'))} />
    </fieldset>
  );
}

export function TermsSection(props: TermsSectionProps) {
  const { t } = useTranslation('procurement');
  return (
    <section aria-labelledby="editor-terms" className="space-y-4">
      <h3 id="editor-terms" className="text-base font-semibold">{t('subcontracts.sections.terms.title')}</h3>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <VatFields {...props} />
        <WithholdingAndCash {...props} />
      </fieldset>
      <PenaltyFields {...props} />
      <CrewFields {...props} />
      <CostSharingFields {...props} />
      <RequiredDocumentsFields {...props} />
      <MinimumOutputsFields {...props} />
    </section>
  );
}
