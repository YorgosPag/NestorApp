'use client';

/**
 * RuleChip — one rule (field + operator + value + delete)
 * (ADR-358 §5.7.bis Q11 Phase 11).
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import { X } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import type { LayerFilterRule, LayerFilterRuleField } from '../../../../types/layer-filters';
import { RuleFieldSelector } from './RuleFieldSelector';
import { RuleOperatorSelector, getOperatorsForField } from './RuleOperatorSelector';
import { RuleValueInput } from './RuleValueInput';

export interface RuleChipProps {
  readonly rule: LayerFilterRule;
  readonly onChange: (next: LayerFilterRule) => void;
  readonly onRemove: () => void;
}

export function RuleChip({ rule, onChange, onRemove }: RuleChipProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const colors = useSemanticColors();
  const { getStatusBorder } = useBorderTokens();

  const handleFieldChange = (next: LayerFilterRuleField): void => {
    const ops = getOperatorsForField(next);
    onChange(buildDefaultRule(next, ops[0]));
  };

  const handleOperatorChange = (next: string): void => {
    onChange({ ...rule, operator: next as never } as LayerFilterRule);
  };

  const handleValueChange = (next: unknown): void => {
    onChange({ ...rule, value: next as never } as LayerFilterRule);
  };

  return (
    <fieldset
      className={`${colors.bg.hover} ${getStatusBorder('muted')} ${PANEL_LAYOUT.PADDING.LEFT_SM} ${PANEL_LAYOUT.PADDING.RIGHT_SM} ${PANEL_LAYOUT.PADDING.VERTICAL_XS} ${PANEL_LAYOUT.SPACING.GAP_XS}`}
      aria-label={t('layerFilters.aria.ruleChip')}
    >
      <RuleFieldSelector value={rule.field} onChange={handleFieldChange} />
      <RuleOperatorSelector field={rule.field} value={rule.operator} onChange={handleOperatorChange} />
      <RuleValueInput field={rule.field} value={rule.value} onChange={handleValueChange} />
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('layerFilters.aria.removeRule')}
        className={`${colors.text.muted} hover:${colors.text.error}`}
      >
        <X size={14} />
      </button>
    </fieldset>
  );
}

function buildDefaultRule(field: LayerFilterRuleField, operator: string): LayerFilterRule {
  // Sensible default value per field. Caller can edit afterwards.
  switch (field) {
    case 'name': return { field, operator: operator as never, value: '' } as LayerFilterRule;
    case 'category': return { field, operator: operator as never, value: 'architectural' } as LayerFilterRule;
    case 'tag': return { field, operator: operator as never, value: '' } as LayerFilterRule;
    case 'visible':
    case 'frozen':
    case 'locked':
    case 'plottable': return { field, operator: 'is', value: true } as LayerFilterRule;
    case 'color.aci': return { field, operator: operator as never, value: 0 } as LayerFilterRule;
    case 'linetype': return { field, operator: operator as never, value: 'Continuous' } as LayerFilterRule;
    case 'lineweight': return { field, operator: operator as never, value: 0.25 } as LayerFilterRule;
    case 'memberKind': return { field, operator: 'has', value: 'entity' } as LayerFilterRule;
  }
}
