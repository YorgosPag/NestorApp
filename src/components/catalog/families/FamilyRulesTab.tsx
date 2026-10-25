'use client';

/**
 * @fileoverview **Καρτέλα «Κανόνες συνέπειας» της οικογένειας** — τυποποιημένος builder, όχι ελεύθερες εκφράσεις
 *   (ADR-923 §5.2 · §21.3 · Φάση 1γ).
 * @module components/catalog/families/FamilyRulesTab
 *
 * 🔑 Τέσσερα είδη, το καθένα με **τα πεδία του**: μοναδική τιμή · διάταξη ανάμεσα σε ιδιότητες (H ≥ M ≥ L, η σειρά
 *    μετρά — σύρσιμο) · μονοτονία κατά άξονα · σύγκριση με ιδιότητα ή σταθερά **σε μονάδα** (μετατρέπεται στο πρότυπο).
 * 🔑 Οι επιλογείς προσφέρουν **μόνο** ό,τι δέχεται ο επικυρωτής (αριθμητικές ιδιότητες · άξονες του σχήματος · μονάδες
 *    της οικογένειας μέτρησης της ιδιότητας). Η Φάση 0 μέτρησε ότι αυτοί οι κανόνες πιάνουν **κάθε** μετατόπιση
 *    γραμμής της AI (§21.3) — είναι το δίχτυ της εισαγωγής της Φάσης 4.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { COMPARE_OPERATORS, ORDER_DIRECTIONS, RULE_SEVERITIES, type ConsistencyRule } from '@/subapps/catalog/types/family';
import { DIRECTION_KEYS, OPERATOR_SYMBOLS, RULE_KIND_HINT_KEYS, RULE_KIND_KEYS, SEVERITY_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { SwitchField } from '../shared/CatalogFormFields';
import { FieldIssues } from '../shared/CatalogIssues';
import { AttributePicker, type FamilyTabProps } from './AttributePicker';
import { allSchemeAxes, newRule, RULE_KINDS } from './rule-defaults';
import { CompareRightFields, OrderAttributesList, withLeftAttribute } from './RuleParts';

function EnumSelect<T extends string>({ value, values, label, keyOf, onChange, disabled, className }: {
  readonly value: T;
  readonly values: readonly T[];
  readonly label: string;
  readonly keyOf: (value: T) => string;
  readonly onChange: (value: T) => void;
  readonly disabled: boolean;
  readonly className?: string;
}) {
  const { t } = useCatalogText();
  return (
    <Select value={value} disabled={disabled} onValueChange={(next) => { const match = values.find((item) => item === next); if (match) onChange(match); }}>
      <SelectTrigger className={className ?? 'w-40'} aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{t(keyOf(item))}</SelectItem>)}</SelectContent>
    </Select>
  );
}

type OrderedRule = Extract<ConsistencyRule, { kind: 'orderAcrossAttributes' | 'monotonicAlongAxis' }>;

/** Φορά + αυστηρότητα — κοινά στη «διάταξη» και στη «μονοτονία». */
function OrderingFields<R extends OrderedRule>({ rule, disabled, onChange }: { readonly rule: R; readonly disabled: boolean; readonly onChange: (rule: R) => void }) {
  const { t } = useCatalogText();
  return (
    <>
      <EnumSelect value={rule.direction} values={ORDER_DIRECTIONS} label={t('families.rules.direction')} keyOf={(item) => DIRECTION_KEYS[item]} disabled={disabled} onChange={(direction) => onChange({ ...rule, direction })} />
      <SwitchField label={t('families.rules.strict')} checked={rule.strict} disabled={disabled} onChange={(strict) => onChange({ ...rule, strict })} />
    </>
  );
}

function RuleFields({ rule, set, props }: { readonly rule: ConsistencyRule; readonly set: (rule: ConsistencyRule) => void; readonly props: FamilyTabProps }) {
  const { t } = useCatalogText();
  const { disabled, inFamily, draft } = props;
  const numeric = inFamily.filter((attribute) => attribute.type === 'number' || attribute.type === 'measurement');
  const axes: readonly AttributeRecord[] = allSchemeAxes(draft, inFamily);
  const picker = (value: string, options: readonly AttributeRecord[], label: string, onChange: (id: string) => void) => (
    <AttributePicker className="w-56" value={value} options={options} disabled={disabled} placeholder={label} ariaLabel={label} onChange={onChange} />
  );
  switch (rule.kind) {
    case 'unique':
      return picker(rule.attributeId, inFamily, t('families.rules.attribute'), (attributeId) => set({ ...rule, attributeId }));
    case 'orderAcrossAttributes':
      return (
        <>
          <OrderAttributesList rule={rule} options={numeric} disabled={disabled} onChange={set} />
          <OrderingFields rule={rule} disabled={disabled} onChange={set} />
        </>
      );
    case 'monotonicAlongAxis':
      return (
        <>
          {picker(rule.attributeId, numeric, t('families.rules.attribute'), (attributeId) => set({ ...rule, attributeId }))}
          {picker(rule.axisAttributeId, axes, t('families.rules.axis'), (axisAttributeId) => set({ ...rule, axisAttributeId }))}
          <OrderingFields rule={rule} disabled={disabled} onChange={set} />
        </>
      );
    case 'compare':
      return (
        <>
          {picker(rule.leftAttributeId, numeric, t('families.rules.left'), (leftAttributeId) => set(withLeftAttribute(rule, leftAttributeId, props.library)))}
          <Select value={rule.operator} disabled={disabled} onValueChange={(next) => { const op = COMPARE_OPERATORS.find((item) => item === next); if (op) set({ ...rule, operator: op }); }}>
            <SelectTrigger className="w-20" aria-label={t('families.rules.operator')}><SelectValue /></SelectTrigger>
            <SelectContent>{COMPARE_OPERATORS.map((op) => <SelectItem key={op} value={op}>{OPERATOR_SYMBOLS[op]}</SelectItem>)}</SelectContent>
          </Select>
          <CompareRightFields rule={rule} numeric={numeric} library={props.library} disabled={disabled} onChange={set} />
        </>
      );
  }
}

function RuleCard({ rule, index, props }: { readonly rule: ConsistencyRule; readonly index: number; readonly props: FamilyTabProps }) {
  const { t } = useCatalogText();
  const { draft, update, disabled, issues } = props;
  const set = (next: ConsistencyRule) => update({ ...draft, consistencyRules: draft.consistencyRules.map((item, at) => (at === index ? next : item)) });
  return (
    <li className="flex list-none flex-col gap-2 rounded-md border p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">{t(RULE_KIND_KEYS[rule.kind])}</span>
          <span className="text-xs text-muted-foreground">{t(RULE_KIND_HINT_KEYS[rule.kind])}</span>
        </span>
        <span className="flex items-center gap-2">
          <EnumSelect value={rule.severity} values={RULE_SEVERITIES} label={t('families.rules.severity')} keyOf={(item) => SEVERITY_KEYS[item]} disabled={disabled} className="w-36" onChange={(severity) => set({ ...rule, severity })} />
          <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t('families.rules.remove', { index: index + 1 })}
            onClick={() => update({ ...draft, consistencyRules: draft.consistencyRules.filter((_, at) => at !== index) })}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-2"><RuleFields rule={rule} set={set} props={props} /></div>
      <FieldIssues issues={issues} path={`consistencyRules[${index}]`} />
    </li>
  );
}

export function FamilyRulesTab(props: FamilyTabProps) {
  const { t } = useCatalogText();
  const { draft, update, disabled, issues } = props;
  const add = (kind: ConsistencyRule['kind']) => update({ ...draft, consistencyRules: [...draft.consistencyRules, newRule(kind, draft, props.inFamily)] });
  return (
    <section className="flex flex-col gap-3">
      <p className="m-0 text-sm text-muted-foreground">{t('families.rules.lead')}</p>
      {draft.consistencyRules.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t('families.rules.none')}</p> : null}
      <ul className="m-0 flex flex-col gap-2 p-0">{draft.consistencyRules.map((rule, index) => <RuleCard key={rule.id} rule={rule} index={index} props={props} />)}</ul>
      <FieldIssues issues={issues.filter((issue) => issue.path === 'consistencyRules')} path="consistencyRules" exact />
      <span className="flex flex-wrap gap-2">
        {RULE_KINDS.map((kind) => (
          <Button key={kind} type="button" variant="outline" size="sm" disabled={disabled} onClick={() => add(kind)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />{t(RULE_KIND_KEYS[kind])}
          </Button>
        ))}
      </span>
    </section>
  );
}
