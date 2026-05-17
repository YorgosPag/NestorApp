'use client';

/**
 * RuleSetGroup — recursive ruleset node (combinator + rules + nested children)
 * (ADR-358 §5.7.bis Q11 Phase 11).
 *
 * Visual nesting capped at depth 3 (UI guidance). Engine supports deeper.
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import { Plus } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  LayerFilterCombinator,
  LayerFilterRule,
  LayerFilterRuleSet,
} from '../../../../types/layer-filters';
import { RuleChip } from './RuleChip';

export interface RuleSetGroupProps {
  readonly ruleset: LayerFilterRuleSet;
  readonly onChange: (next: LayerFilterRuleSet) => void;
  readonly depth?: number;
}

const MAX_DEPTH_WARN = 3;

export function RuleSetGroup({ ruleset, onChange, depth = 0 }: RuleSetGroupProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const colors = useSemanticColors();
  const { getStatusBorder } = useBorderTokens();

  const handleCombinatorChange = (next: LayerFilterCombinator): void => {
    onChange({ ...ruleset, combinator: next });
  };

  const handleRuleChange = (idx: number, next: LayerFilterRule): void => {
    const rules = ruleset.rules.slice();
    rules[idx] = next;
    onChange({ ...ruleset, rules });
  };

  const handleRuleRemove = (idx: number): void => {
    const rules = ruleset.rules.filter((_, i) => i !== idx);
    onChange({ ...ruleset, rules });
  };

  const handleAddRule = (): void => {
    const rules = [...ruleset.rules, { field: 'name', operator: 'contains', value: '' } as LayerFilterRule];
    onChange({ ...ruleset, rules });
  };

  const handleAddNested = (): void => {
    const nested = [...(ruleset.nested ?? []), { combinator: 'AND' as const, rules: [] }];
    onChange({ ...ruleset, nested });
  };

  const handleNestedChange = (idx: number, next: LayerFilterRuleSet): void => {
    const nested = (ruleset.nested ?? []).slice();
    nested[idx] = next;
    onChange({ ...ruleset, nested });
  };

  const handleNestedRemove = (idx: number): void => {
    const nested = (ruleset.nested ?? []).filter((_, i) => i !== idx);
    onChange({ ...ruleset, nested });
  };

  const overDepth = depth >= MAX_DEPTH_WARN;

  return (
    <fieldset
      className={`${getStatusBorder('muted')} ${PANEL_LAYOUT.PADDING.LEFT_SM} ${PANEL_LAYOUT.PADDING.RIGHT_SM} ${PANEL_LAYOUT.PADDING.VERTICAL_SM} ${PANEL_LAYOUT.SPACING.GAP_SM}`}
      aria-label={t('layerFilters.aria.ruleset')}
    >
      <header className={`${PANEL_LAYOUT.SPACING.GAP_SM} flex items-center`}>
        <Select value={ruleset.combinator} onValueChange={(v) => handleCombinatorChange(v as LayerFilterCombinator)}>
          <SelectTrigger className={`${PANEL_LAYOUT.WIDTH.SM}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">{t('layerFilters.combinator.and')}</SelectItem>
            <SelectItem value="OR">{t('layerFilters.combinator.or')}</SelectItem>
          </SelectContent>
        </Select>
        {overDepth ? (
          <small className={colors.text.warning}>{t('layerFilters.warn.depthExceeded')}</small>
        ) : null}
      </header>

      <ul className={PANEL_LAYOUT.SPACING.GAP_XS}>
        {ruleset.rules.map((rule, idx) => (
          <li key={idx}>
            <RuleChip
              rule={rule}
              onChange={(next) => handleRuleChange(idx, next)}
              onRemove={() => handleRuleRemove(idx)}
            />
          </li>
        ))}
      </ul>

      {ruleset.nested && ruleset.nested.length > 0 ? (
        <ul className={PANEL_LAYOUT.SPACING.GAP_SM}>
          {ruleset.nested.map((child, idx) => (
            <li key={idx}>
              <RuleSetGroup
                ruleset={child}
                onChange={(next) => handleNestedChange(idx, next)}
                depth={depth + 1}
              />
              <button
                type="button"
                onClick={() => handleNestedRemove(idx)}
                className={`${colors.text.muted} hover:${colors.text.error}`}
              >
                {t('layerFilters.action.removeNested')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <footer className={`${PANEL_LAYOUT.SPACING.GAP_SM} flex`}>
        <button type="button" onClick={handleAddRule} className={`${colors.text.primary} flex items-center gap-1`}>
          <Plus size={14} /> {t('layerFilters.action.addRule')}
        </button>
        <button type="button" onClick={handleAddNested} className={`${colors.text.primary} flex items-center gap-1`}>
          <Plus size={14} /> {t('layerFilters.action.addNested')}
        </button>
      </footer>
    </fieldset>
  );
}
