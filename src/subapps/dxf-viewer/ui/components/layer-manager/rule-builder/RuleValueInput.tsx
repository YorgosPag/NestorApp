'use client';

/**
 * RuleValueInput — field-aware value input for a rule chip
 * (ADR-358 §5.7.bis Q11 Phase 11).
 *
 * Renders the appropriate primitive (text / number / boolean / category select)
 * based on the rule's `field`. Caller manages canonical value shape; this
 * component does only display + emit.
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AecLayerCategory } from '../../../../types/entities';
import type { LayerFilterRuleField } from '../../../../types/layer-filters';

const AEC_CATEGORIES: ReadonlyArray<AecLayerCategory> = [
  'architectural', 'structural', 'electrical', 'mechanical', 'plumbing',
  'fire', 'civil', 'telecom', 'interior', 'general',
];

export interface RuleValueInputProps {
  readonly field: LayerFilterRuleField;
  readonly value: unknown;
  readonly onChange: (next: unknown) => void;
}

export function RuleValueInput({ field, value, onChange }: RuleValueInputProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);

  if (field === 'visible' || field === 'frozen' || field === 'locked' || field === 'plottable') {
    return (
      <Select value={String(Boolean(value))} onValueChange={(v) => onChange(v === 'true')}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{t('layerFilters.value.true')}</SelectItem>
          <SelectItem value="false">{t('layerFilters.value.false')}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field === 'category') {
    const current = typeof value === 'string' ? value : 'architectural';
    return (
      <Select value={current} onValueChange={(v) => onChange(v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {AEC_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>{t(`layerFilters.aecCategory.${c}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field === 'memberKind') {
    const current = typeof value === 'string' ? value : 'entity';
    return (
      <Select value={current} onValueChange={(v) => onChange(v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="entity">{t('layerFilters.memberKind.entity')}</SelectItem>
          <SelectItem value="region">{t('layerFilters.memberKind.region')}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field === 'color.aci' || field === 'lineweight') {
    const current = typeof value === 'number' ? value : 0;
    return (
      <Input
        type="number"
        value={current}
        step={field === 'lineweight' ? 0.01 : 1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }

  // name / tag / linetype → free-text string
  const current = typeof value === 'string' ? value : '';
  return (
    <Input
      type="text"
      value={current}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('layerFilters.value.textPlaceholder')}
    />
  );
}
