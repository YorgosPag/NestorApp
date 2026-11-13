'use client';

/**
 * @fileoverview **Η συνθήκη «όταν» ενός κανόνα συνέπειας** (ADR-923 §21.5) — Akeneo attribute dependencies · Revit πόλοι ↔ τάση.
 * @module components/catalog/families/RuleConditionFields
 *
 * 🔑 Ο κανόνας κρίνει **μόνο** τις παραλλαγές που ικανοποιούν τη συνθήκη: «όταν Φάσεις = 3 ⇒ Τάση ≥ 380 V».
 * 🔑 Ο επιλογέας προσφέρει **μόνο** ιδιότητες που μπορούν να είναι συνθήκη (αριθμός/μέτρηση · επιλογή · ναι/όχι), και ο έλεγχος
 *    ακολουθεί τον τύπο τους (`conditionFor`) — ό,τι άλλο θα απέρριπτε ο επικυρωτής (`ruleConditionTypeMismatch`).
 */

import React from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NumericField } from '@/components/ui/numeric-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import {
  COMPARE_OPERATORS,
  OPTION_CONDITION_OPERATORS,
  type ConsistencyRule,
  type OptionConditionOperator,
  type RuleCondition,
  type RuleConditionTest,
} from '@/subapps/catalog/types/family';
import { OPERATOR_SYMBOLS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { AttributePicker, type FamilyTabProps } from './AttributePicker';
import { conditionFor } from './rule-defaults';
import { ConstantUnitSelect } from './RuleParts';

const OPTION_OPERATOR_KEYS: Readonly<Record<OptionConditionOperator, string>> = {
  in: 'families.rules.whenOperators.in',
  notIn: 'families.rules.whenOperators.notIn',
};

type TestOf<K extends RuleConditionTest['kind']> = Extract<RuleConditionTest, { kind: K }>;

interface TestProps<K extends RuleConditionTest['kind']> {
  readonly test: TestOf<K>;
  readonly attribute: AttributeRecord | undefined;
  readonly props: FamilyTabProps;
  readonly onChange: (test: TestOf<K>) => void;
}

function NumberTest({ test, attribute, props, onChange }: TestProps<'number'>) {
  const { t } = useCatalogText();
  const family = attribute?.type === 'measurement' ? props.library.registry.get(attribute.config.measurementFamilyCode) : undefined;
  return (
    <>
      <Select value={test.operator} disabled={props.disabled} onValueChange={(next) => { const op = COMPARE_OPERATORS.find((item) => item === next); if (op) onChange({ ...test, operator: op }); }}>
        <SelectTrigger className="w-20" aria-label={t('families.rules.whenOperator')}><SelectValue /></SelectTrigger>
        <SelectContent>{COMPARE_OPERATORS.map((op) => <SelectItem key={op} value={op}>{OPERATOR_SYMBOLS[op]}</SelectItem>)}</SelectContent>
      </Select>
      <NumericField className="w-28" aria-label={t('families.rules.whenValue')} value={test.value} disabled={props.disabled} onValueChange={(value) => onChange({ ...test, value })} />
      <ConstantUnitSelect family={family} unitCode={test.unitCode} disabled={props.disabled} onChange={(unitCode) => onChange({ ...test, unitCode })} />
    </>
  );
}

function OptionTest({ test, attribute, props, onChange }: TestProps<'option'>) {
  const { t, text } = useCatalogText();
  const options = attribute?.type === 'select' ? attribute.config.options : [];
  const toggle = (code: string, on: boolean) => {
    const optionCodes = on ? [...test.optionCodes, code] : test.optionCodes.filter((item) => item !== code);
    if (optionCodes.length > 0) onChange({ ...test, optionCodes });
  };
  return (
    <>
      <Select value={test.operator} disabled={props.disabled} onValueChange={(next) => { const op = OPTION_CONDITION_OPERATORS.find((item) => item === next); if (op) onChange({ ...test, operator: op }); }}>
        <SelectTrigger className="w-40" aria-label={t('families.rules.whenOperator')}><SelectValue /></SelectTrigger>
        <SelectContent>{OPTION_CONDITION_OPERATORS.map((op) => <SelectItem key={op} value={op}>{t(OPTION_OPERATOR_KEYS[op])}</SelectItem>)}</SelectContent>
      </Select>
      <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0" aria-label={t('families.rules.whenOptions')}>
        {options.map((option) => (
          <label key={option.code} className="flex items-center gap-1 text-sm">
            <Checkbox checked={test.optionCodes.includes(option.code)} disabled={props.disabled} onCheckedChange={(checked) => toggle(option.code, checked === true)} />
            {text(option.labels, option.code)}
          </label>
        ))}
      </fieldset>
    </>
  );
}

function BooleanTest({ test, props, onChange }: TestProps<'boolean'>) {
  const { t } = useCatalogText();
  return (
    <Select value={test.value ? 'yes' : 'no'} disabled={props.disabled} onValueChange={(next) => onChange({ ...test, value: next === 'yes' })}>
      <SelectTrigger className="w-24" aria-label={t('families.rules.whenValue')}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="yes">{t('common.yes')}</SelectItem>
        <SelectItem value="no">{t('common.no')}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ConditionTest({ condition, attribute, props, onChange }: {
  readonly condition: RuleCondition;
  readonly attribute: AttributeRecord | undefined;
  readonly props: FamilyTabProps;
  readonly onChange: (condition: RuleCondition) => void;
}) {
  const set = (test: RuleConditionTest) => onChange({ ...condition, test });
  const { test } = condition;
  switch (test.kind) {
    case 'number':
      return <NumberTest test={test} attribute={attribute} props={props} onChange={set} />;
    case 'option':
      return <OptionTest test={test} attribute={attribute} props={props} onChange={set} />;
    case 'boolean':
      return <BooleanTest test={test} attribute={attribute} props={props} onChange={set} />;
  }
}

export function RuleConditionFields({ rule, set, props }: {
  readonly rule: ConsistencyRule;
  readonly set: (rule: ConsistencyRule) => void;
  readonly props: FamilyTabProps;
}) {
  const { t } = useCatalogText();
  const candidates = props.inFamily.filter((attribute) => conditionFor(attribute) !== null);
  const { when } = rule;
  if (!when) {
    return (
      <Button type="button" variant="ghost" size="sm" className="self-start" disabled={props.disabled || candidates.length === 0}
        onClick={() => set({ ...rule, when: conditionFor(candidates[0]) })}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />{t('families.rules.whenAdd')}
      </Button>
    );
  }
  const attribute = props.library.attributeById.get(when.attributeId);
  const pick = (id: string) => { const next = candidates.find((item) => item.id === id); if (next) set({ ...rule, when: conditionFor(next) }); };
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">{t('families.rules.when')}</span>
      <AttributePicker className="w-52" value={when.attributeId} options={candidates} disabled={props.disabled} placeholder={t('families.rules.whenAttribute')} ariaLabel={t('families.rules.whenAttribute')} onChange={pick} />
      <ConditionTest condition={when} attribute={attribute} props={props} onChange={(next) => set({ ...rule, when: next })} />
      <Button type="button" variant="ghost" size="icon" disabled={props.disabled} aria-label={t('families.rules.whenRemove')} onClick={() => set({ ...rule, when: null })}>
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </span>
  );
}
