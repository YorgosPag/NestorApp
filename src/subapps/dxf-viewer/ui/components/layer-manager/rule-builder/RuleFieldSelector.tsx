'use client';

/**
 * RuleFieldSelector — field dropdown for a single rule chip
 * (ADR-358 §5.7.bis Q11 Phase 11).
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LayerFilterRuleField } from '../../../../types/layer-filters';

const FIELD_OPTIONS: ReadonlyArray<LayerFilterRuleField> = [
  'name', 'category', 'tag', 'visible', 'frozen', 'locked', 'plottable',
  'color.aci', 'linetype', 'lineweight', 'memberKind',
];

export interface RuleFieldSelectorProps {
  readonly value: LayerFilterRuleField;
  readonly onChange: (next: LayerFilterRuleField) => void;
}

export function RuleFieldSelector({ value, onChange }: RuleFieldSelectorProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  return (
    <Select value={value} onValueChange={(v) => onChange(v as LayerFilterRuleField)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FIELD_OPTIONS.map((field) => (
          <SelectItem key={field} value={field}>
            {t(`layerFilters.field.${normalizeKey(field)}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function normalizeKey(field: LayerFilterRuleField): string {
  return field.replace('.', '_');
}
