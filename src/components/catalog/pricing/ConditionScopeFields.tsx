'use client';

/**
 * @fileoverview **Πού και πότε ισχύει μια συνθήκη** — ομάδα έκπτωσης · κοινό · ισχύς σε ημέρες (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related DiscountConditionEditor.tsx (ο γονέας) · AudienceField.tsx (το ΕΝΑ πεδίο κοινού, κοινό με τους τιμοκαταλόγους) ·
 *   discount-condition-draft.ts (η «τελευταία ημέρα» συμπεριληπτικά ↔ το ημιανοιχτό «έως» της μηχανής)
 * @module components/catalog/pricing/ConditionScopeFields
 *
 * ⚠️ «Όλες οι ομάδες» = τιμή `*` στο Select (το Radix **δεσμεύει** το `''`, CHECK 3.48)· ίδιο σύμβολο με την υποδοχή του γραφέα.
 */

import React from 'react';

import { DatePickerField } from '@/components/ui/date-picker-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { DiscountConditionDefinition } from '@/subapps/catalog/types/price-list';
import type { CustomerGroupWire, DiscountGroupWire } from '@/subapps/catalog/types/pricing-views';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { AudienceField } from './AudienceField';
import { ALL_GROUPS_ROW } from './condition-matrix';
import { pickerOfLastDay, pickerOfValidFrom, validFromOfPicker, validUntilOfLastDay } from './discount-condition-draft';

export interface ConditionScopeFieldsProps {
  readonly draft: DiscountConditionDefinition;
  readonly update: (draft: DiscountConditionDefinition) => void;
  readonly discountGroups: readonly DiscountGroupWire[];
  readonly customerGroups: readonly CustomerGroupWire[];
  readonly disabled: boolean;
  readonly issues: readonly CatalogIssue[];
}

function DiscountGroupField({ draft, update, discountGroups, disabled, issues }: ConditionScopeFieldsProps) {
  const { t, text } = useCatalogText();
  const choose = (value: string) => update({ ...draft, discountGroupId: value === ALL_GROUPS_ROW ? null : value });
  return (
    <CatalogField label={t('pricing.discounts.editor.discountGroup')} hint={t('pricing.discounts.editor.discountGroupHint')} issues={issues} path="discountGroupId">
      {({ id, describedBy }) => (
        <Select value={draft.discountGroupId ?? ALL_GROUPS_ROW} disabled={disabled} onValueChange={choose}>
          <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_GROUPS_ROW}>{t('pricing.discounts.matrix.allGroups')}</SelectItem>
            {discountGroups.map((group) => <SelectItem key={group.id} value={group.id}>{text(group.labels, group.code)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </CatalogField>
  );
}

function ValidityFields({ draft, update, disabled, issues }: ConditionScopeFieldsProps) {
  const { t } = useCatalogText();
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <CatalogField label={t('pricing.discounts.editor.validFrom')} issues={issues} path="validFrom">
        {({ id }) => (
          <DatePickerField id={id} value={pickerOfValidFrom(draft.validFrom)} disabled={disabled} placeholder={t('pricing.discounts.editor.validFromNone')}
            onSelect={(date) => update({ ...draft, validFrom: validFromOfPicker(date) })} />
        )}
      </CatalogField>
      <CatalogField label={t('pricing.discounts.editor.lastDay')} hint={t('pricing.discounts.editor.lastDayHint')} issues={issues} path="validUntil">
        {({ id }) => (
          <DatePickerField id={id} value={pickerOfLastDay(draft.validUntil)} disabled={disabled} placeholder={t('pricing.discounts.editor.lastDayNone')}
            onSelect={(date) => update({ ...draft, validUntil: validUntilOfLastDay(date) })} />
        )}
      </CatalogField>
    </section>
  );
}

export function ConditionScopeFields(props: ConditionScopeFieldsProps) {
  const { draft, update, customerGroups, disabled, issues } = props;
  const { t } = useCatalogText();
  return (
    <section className="flex flex-col gap-3">
      <section className="grid gap-3 sm:grid-cols-2">
        <DiscountGroupField {...props} />
        <AudienceField value={draft.audience} allowNone={false} customerGroups={customerGroups} disabled={disabled} issues={issues}
          hint={t('pricing.discounts.editor.audienceHint')} onChange={(audience) => { if (audience) update({ ...draft, audience }); }} />
      </section>
      <ValidityFields {...props} />
    </section>
  );
}
