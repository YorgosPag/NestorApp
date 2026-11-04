'use client';

/**
 * Μία γραμμή του schedule of values (ADR-928 §5.4 · Φ3γ-2 απόφαση 5): περιγραφή, είδος, τιμολόγηση, μονάδα, ποσότητα,
 * τιμή μονάδας και το ποσό της. Οι λεπτομέρειες (τιμή πελάτη, στάδια, επιμέτρηση, ένσημα, υπέρβαση πληρωμής) ανοίγουν
 * από κάτω.
 *
 * 🔑 Κάρτα, όχι γραμμή πίνακα: η φόρμα ζει σε στήλη 35–55% της οθόνης. Δέκα στήλες εκεί δεν διαβάζονται (μετρημένο στη
 *    Φ3γ-1), και η ίδια κάρτα δουλεύει και στο κινητό.
 * 🔑 Τα πεδία τιμής μοιράζονται το πλάτος **της κάρτας**, όχι της οθόνης (`auto-fill` + `minmax`): το `lg:grid-cols-5`
 *    ρωτούσε την οθόνη, και στη στήλη 55% έκοβε «Τιμή μονάδας» σε «Τιμή…» (μετρημένο στην παραγωγή).
 * 🔑 Το ποσό είναι **μόνο ανάγνωση** (`estimatedLineAmount`, ο ίδιος υπολογισμός με τη λίστα και το έγγραφο). Τιμή μονάδας
 *    χωρίς ποσότητα λέει «κατά επιμέτρηση», όχι μηδέν.
 */

import type { ReactNode } from 'react';
import { ChevronDown, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EnumSelect } from '@/components/ui/enum-select';
import { MilliQuantityField, MoneyField } from '@/components/ui/numeric-field';
import { UomSelect } from '@/components/shared/UomSelect';
import { PROCUREMENT_UNIT_OPTIONS } from '@/config/procurement-units';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { issuesAt, issuesUnder } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { documentLocaleOf } from '@/subapps/procurement/subcontracts/document/document-locale';
import { estimatedLineAmount } from '@/subapps/procurement/subcontracts/lines/line-amount';
import { setLinePricing } from '@/subapps/procurement/subcontracts/lines/line-edits';
import { AGREEMENT_LINE_KINDS, AGREEMENT_LINE_PRICINGS, type AgreementLine } from '@/subapps/procurement/subcontracts/types/agreement-line';
import { EditorField } from '../../editor/EditorField';
import { FieldIssues } from '../../editor/FieldIssues';
import { LocalizedTextFields } from '../LocalizedTextFields';
import type { SectionProps } from '../section-types';
import { LineDetails } from './LineDetails';

/** Τα πεδία που ζουν στις «Λεπτομέρειες» — το κουμπί τους λέει πόσα ευρήματα κρύβουν. */
const DETAIL_FIELDS = ['clientUnitPrice', 'comment', 'measurementRule', 'stages', 'insuredDaysCap', 'paymentOverride'] as const;

export interface LineCardProps extends Omit<SectionProps<AgreementLine>, 'path'> {
  readonly index: number;
  readonly path: string;
  readonly handle: ReactNode;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
}

function LineAmount({ line, language }: Pick<LineCardProps, 'language'> & { readonly line: AgreementLine }) {
  const { t } = useTranslation('procurement');
  const locale = documentLocaleOf(language);
  const amount = estimatedLineAmount(line);
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{t('subcontracts.sections.lines.amount')}: </span>
      <span className="font-medium tabular-nums">{amount === null ? locale.phrase('lines.byMeasurement') : locale.money(amount)}</span>
    </p>
  );
}

function PriceFields({ value, onChange, path, issues, language, index }: LineCardProps) {
  const { t } = useTranslation('procurement');
  const locale = documentLocaleOf(language);
  const id = `line-${index}`;
  const field = (name: string) => ({ id: `${id}-${name}`, issues: issuesAt(issues, joinPath(path, name)) });
  return (
    <fieldset className="grid grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))] gap-3">
      <EditorField {...field('kind')} label={t('subcontracts.sections.lines.kind')}>
        <EnumSelect id={`${id}-kind`} value={value.kind} values={AGREEMENT_LINE_KINDS} getLabel={(kind) => locale.phrase(`lines.kind.${kind}`)} onValueChange={(kind) => onChange({ ...value, kind })} />
      </EditorField>
      <EditorField {...field('pricing')} label={t('subcontracts.sections.lines.pricing')}>
        <EnumSelect id={`${id}-pricing`} value={value.pricing} values={AGREEMENT_LINE_PRICINGS} getLabel={(pricing) => locale.phrase(`lines.pricing.${pricing}`)} onValueChange={(pricing) => onChange(setLinePricing(value, pricing))} />
      </EditorField>
      <EditorField {...field('unit')} label={t('subcontracts.sections.lines.unit')}>
        <UomSelect id={`${id}-unit`} value={value.unit} units={PROCUREMENT_UNIT_OPTIONS} compact onValueChange={(unit) => onChange({ ...value, unit })} />
      </EditorField>
      {value.pricing !== 'lump_sum' && (
        <EditorField {...field('estimatedMilliQuantity')} label={t('subcontracts.sections.lines.quantity')}>
          <MilliQuantityField id={`${id}-estimatedMilliQuantity`} nullable value={value.estimatedMilliQuantity} placeholder={t('subcontracts.sections.lines.quantityOptional')} onValueChange={(estimatedMilliQuantity) => onChange({ ...value, estimatedMilliQuantity })} />
        </EditorField>
      )}
      <EditorField {...field('unitPrice')} label={t(value.pricing === 'lump_sum' ? 'subcontracts.sections.lines.lumpSum' : 'subcontracts.sections.lines.unitPrice')}>
        <MoneyField id={`${id}-unitPrice`} value={value.unitPrice} onValueChange={(unitPrice) => onChange({ ...value, unitPrice })} />
      </EditorField>
    </fieldset>
  );
}

export function LineCard(props: LineCardProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, path, issues, language, secondaryLanguage, index, handle } = props;
  const position = index + 1;
  const detailsIssues = DETAIL_FIELDS.reduce((count, field) => count + issuesUnder(issues, joinPath(path, field)).length, 0);
  return (
    <article aria-label={t('subcontracts.sections.lines.position', { position })} className="space-y-3 rounded-lg border p-3">
      <header className="flex items-center gap-2">
        {handle}
        <h4 className="text-sm font-semibold">{t('subcontracts.sections.lines.position', { position })}</h4>
        <span className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label={t('subcontracts.sections.lines.duplicate', { position })} onClick={props.onDuplicate}><Copy className="h-4 w-4" aria-hidden /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label={t('subcontracts.sections.lines.remove', { position })} onClick={props.onRemove}><Trash2 className="h-4 w-4" aria-hidden /></Button>
        </span>
      </header>
      <LocalizedTextFields
        id={`line-${index}-description`} label={t('subcontracts.sections.lines.description')} value={value.description}
        onChange={(description) => onChange({ ...value, description })} path={joinPath(path, 'description')} issues={issues}
        language={language} secondaryLanguage={secondaryLanguage} multiline
      />
      <PriceFields {...props} />
      <FieldIssues issues={issuesAt(issues, joinPath(path, 'id'))} />
      <LineAmount line={value} language={language} />
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="gap-1">
            <ChevronDown className="h-4 w-4" aria-hidden />
            {t('subcontracts.sections.lines.details')}
            {detailsIssues > 0 && <span className="text-destructive">({t('subcontracts.sections.issueCount', { count: detailsIssues })})</span>}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3"><LineDetails {...props} /></CollapsibleContent>
      </Collapsible>
    </article>
  );
}
