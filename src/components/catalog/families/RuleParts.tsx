'use client';

/**
 * @fileoverview **Τα σύνθετα κομμάτια του builder κανόνων** — διατεταγμένη λίστα ιδιοτήτων (H ≥ M ≥ L) και το δεξί
 *   μέλος σύγκρισης (ιδιότητα ή σταθερά σε μονάδα) (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/families/RuleParts
 *
 * 🔑 Στη «διάταξη» **η σειρά είναι ο κανόνας**: H ≥ M ≥ L ≠ L ≥ M ≥ H. Αναδιάταξη με σύρσιμο/πληκτρολόγιο.
 * 🔑 Σταθερά σύγκρισης: για μέτρηση **πάντα** με μονάδα (της οικογένειας της αριστερής ιδιότητας) — ο αξιολογητής τη
 *    μετατρέπει στο πρότυπο· για καθαρό αριθμό **χωρίς** μονάδα. Ό,τι άλλο θα απέρριπτε ο επικυρωτής.
 */

import React from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NumericField } from '@/components/ui/numeric-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortableList } from '@/components/ui/sortable/SortableList';
import { reorderByMove } from '@/components/ui/sortable/sortable-model';
import type { CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { ConsistencyRule } from '@/subapps/catalog/types/family';
import { CATALOG_LIMITS } from '@/subapps/catalog/vocabulary/catalog-limits';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { AttributePicker } from './AttributePicker';

type OrderRule = Extract<ConsistencyRule, { kind: 'orderAcrossAttributes' }>;
type CompareRule = Extract<ConsistencyRule, { kind: 'compare' }>;

export function OrderAttributesList({ rule, options, disabled, onChange }: {
  readonly rule: OrderRule;
  readonly options: readonly AttributeRecord[];
  readonly disabled: boolean;
  readonly onChange: (rule: OrderRule) => void;
}) {
  const { t } = useCatalogText();
  const rows = rule.attributeIds.map((attributeId, index) => ({ id: `slot-${index}`, attributeId, index }));
  const setIds = (attributeIds: readonly string[]) => onChange({ ...rule, attributeIds });
  return (
    <div className="flex flex-col gap-1">
      <SortableList
        items={rows}
        getId={(row) => row.id}
        getLabel={(row) => t('families.rules.positionOf', { index: row.index + 1 })}
        ariaLabel={t('families.rules.orderList')}
        disabled={disabled}
        onMove={(move) => setIds(reorderByMove(rows, (row) => row.id, move).map((row) => row.attributeId))}
        renderItem={(row, handle) => (
          <span className="flex items-center gap-1">
            {handle}
            <span className="w-6 text-center text-xs text-muted-foreground">{row.index + 1}</span>
            <AttributePicker className="w-52" value={row.attributeId} options={options} disabled={disabled} placeholder={t('families.rules.attribute')} ariaLabel={t('families.rules.positionOf', { index: row.index + 1 })}
              onChange={(id) => setIds(rule.attributeIds.map((current, at) => (at === row.index ? id : current)))} />
            <Button type="button" variant="ghost" size="icon" disabled={disabled || rule.attributeIds.length <= 2} aria-label={t('families.rules.removePosition', { index: row.index + 1 })}
              onClick={() => setIds(rule.attributeIds.filter((_, at) => at !== row.index))}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </span>
        )}
      />
      <Button type="button" variant="ghost" size="sm" className="self-start" disabled={disabled || rule.attributeIds.length >= CATALOG_LIMITS.maxAttributesPerOrderRule}
        onClick={() => setIds([...rule.attributeIds, options.find((option) => !rule.attributeIds.includes(option.id))?.id ?? ''])}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />{t('families.rules.addPosition')}
      </Button>
    </div>
  );
}

/** Νέα αριστερή ιδιότητα: η μονάδα μιας σταθεράς ακολουθεί την οικογένεια μέτρησης της νέας ιδιότητας. */
export function withLeftAttribute(rule: CompareRule, attributeId: string, library: CatalogLibrary): CompareRule {
  const left = library.attributeById.get(attributeId);
  if (rule.right.kind !== 'constant') return { ...rule, leftAttributeId: attributeId };
  const unitCode = left?.type === 'measurement' ? left.config.defaultUnitCode : null;
  return { ...rule, leftAttributeId: attributeId, right: { ...rule.right, unitCode } };
}

const RIGHT_KINDS = ['attribute', 'constant'] as const satisfies readonly CompareRule['right']['kind'][];

export function CompareRightFields({ rule, numeric, library, disabled, onChange }: {
  readonly rule: CompareRule;
  readonly numeric: readonly AttributeRecord[];
  readonly library: CatalogLibrary;
  readonly disabled: boolean;
  readonly onChange: (rule: CompareRule) => void;
}) {
  const { t } = useCatalogText();
  const left = library.attributeById.get(rule.leftAttributeId);
  const family = left?.type === 'measurement' ? library.registry.get(left.config.measurementFamilyCode) : undefined;
  const defaultUnit = left?.type === 'measurement' ? left.config.defaultUnitCode : null;
  const chooseKind = (kind: string) => {
    if (kind === 'attribute') onChange({ ...rule, right: { kind: 'attribute', attributeId: numeric.find((item) => item.id !== rule.leftAttributeId)?.id ?? '' } });
    if (kind === 'constant') onChange({ ...rule, right: { kind: 'constant', value: 0, unitCode: defaultUnit } });
  };
  const { right } = rule;
  return (
    <>
      <Select value={right.kind} disabled={disabled} onValueChange={chooseKind}>
        <SelectTrigger className="w-36" aria-label={t('families.rules.rightKind')}><SelectValue /></SelectTrigger>
        <SelectContent>{RIGHT_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{t(kind === 'attribute' ? 'families.rules.rightAttribute' : 'families.rules.rightConstant')}</SelectItem>)}</SelectContent>
      </Select>
      {right.kind === 'attribute' ? (
        <AttributePicker className="w-52" value={right.attributeId} options={numeric} disabled={disabled} placeholder={t('families.rules.right')} ariaLabel={t('families.rules.right')}
          onChange={(attributeId) => onChange({ ...rule, right: { kind: 'attribute', attributeId } })} />
      ) : (
        <>
          <NumericField className="w-28" aria-label={t('families.rules.constant')} value={right.value} disabled={disabled} onValueChange={(value) => onChange({ ...rule, right: { ...right, value } })} />
          {family ? (
            <Select value={right.unitCode ?? ''} disabled={disabled} onValueChange={(unitCode) => onChange({ ...rule, right: { ...right, unitCode } })}>
              <SelectTrigger className="w-28" aria-label={t('families.rules.constantUnit')}><SelectValue placeholder={t('attributes.config.chooseUnit')} /></SelectTrigger>
              <SelectContent>{family.units.map((unit) => <SelectItem key={unit.code} value={unit.code}>{unit.symbol}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
        </>
      )}
    </>
  );
}
