'use client';

/**
 * RuleOperatorSelector — operator dropdown filtered by field type
 * (ADR-358 §5.7.bis Q11 Phase 11).
 *
 * Operator set per field — matches the discriminated union in
 * `types/layer-filters.ts`.
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LayerFilterRuleField } from '../../../../types/layer-filters';

type OperatorMap = Readonly<Record<LayerFilterRuleField, ReadonlyArray<string>>>;

const OPERATORS_BY_FIELD: OperatorMap = {
  name: ['equals', 'contains', 'startsWith', 'endsWith', 'matches'],
  category: ['is', 'isNot', 'isOneOf'],
  tag: ['has', 'hasAny', 'hasAll'],
  visible: ['is'],
  frozen: ['is'],
  locked: ['is'],
  plottable: ['is'],
  'color.aci': ['equals', 'oneOf'],
  linetype: ['is', 'isOneOf'],
  lineweight: ['equals', 'gte', 'lte', 'between'],
  memberKind: ['has'],
};

export function getOperatorsForField(field: LayerFilterRuleField): ReadonlyArray<string> {
  return OPERATORS_BY_FIELD[field];
}

export interface RuleOperatorSelectorProps {
  readonly field: LayerFilterRuleField;
  readonly value: string;
  readonly onChange: (next: string) => void;
}

export function RuleOperatorSelector({
  field, value, onChange,
}: RuleOperatorSelectorProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const operators = OPERATORS_BY_FIELD[field];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {operators.map((op) => (
          <SelectItem key={op} value={op}>
            {t(`layerFilters.operator.${op}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
