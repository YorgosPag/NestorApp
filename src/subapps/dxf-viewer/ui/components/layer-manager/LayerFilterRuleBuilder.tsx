'use client';

/**
 * LayerFilterRuleBuilder — modal for creating / editing a Property Filter
 * (ADR-358 §5.7.bis Q11 Phase 11).
 *
 * Orchestrates `RuleSetGroup` with a name input + footer (Save/Cancel).
 * Submit emits the new filter; persistence handled by caller via
 * `upsertUserFilter`.
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n';
import { nowISO } from '@/lib/date-local';
import { BaseModal } from '../../../components/shared/BaseModal';
import { Input } from '@/components/ui/input';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { generateLayerFilterPropertyId } from '@/services/enterprise-id.service';
import type { LayerPropertiesFilter, LayerFilterRuleSet } from '../../../types/layer-filters';
import { RuleSetGroup } from './rule-builder/RuleSetGroup';

const EMPTY_RULESET: LayerFilterRuleSet = { combinator: 'AND', rules: [] };

export interface LayerFilterRuleBuilderProps {
  readonly isOpen: boolean;
  readonly initial?: LayerPropertiesFilter | null;
  readonly onClose: () => void;
  readonly onSubmit: (filter: LayerPropertiesFilter) => void;
}

export function LayerFilterRuleBuilder({
  isOpen, initial, onClose, onSubmit,
}: LayerFilterRuleBuilderProps): React.ReactElement | null {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const colors = useSemanticColors();

  const [name, setName] = useState(initial?.name ?? '');
  const [ruleset, setRuleset] = useState<LayerFilterRuleSet>(initial?.rules ?? EMPTY_RULESET);

  React.useEffect(() => {
    if (isOpen) {
      setName(initial?.name ?? '');
      setRuleset(initial?.rules ?? EMPTY_RULESET);
    }
  }, [isOpen, initial]);

  const handleSubmit = (): void => {
    const id = initial?.id ?? generateLayerFilterPropertyId();
    const nowIso = nowISO();
    const filter: LayerPropertiesFilter = {
      kind: 'properties',
      id,
      name: name.trim() || t('layerFilters.placeholder.untitled'),
      source: initial?.source ?? 'user-created',
      createdAt: initial?.createdAt ?? nowIso,
      updatedAt: nowIso,
      rules: ruleset,
    };
    onSubmit(filter);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? t('layerFilters.builder.editTitle') : t('layerFilters.builder.createTitle')}
      size="lg"
      footer={(
        <footer className={`${PANEL_LAYOUT.SPACING.GAP_SM} flex justify-end`}>
          <button type="button" onClick={onClose} className={colors.text.muted}>
            {t('layerFilters.action.cancel')}
          </button>
          <button type="button" onClick={handleSubmit} className={colors.text.primary}>
            {t('layerFilters.action.save')}
          </button>
        </footer>
      )}
    >
      <section className={PANEL_LAYOUT.SPACING.GAP_SM}>
        <label className={colors.text.primary} htmlFor="lf-name">{t('layerFilters.builder.nameLabel')}</label>
        <Input
          id="lf-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('layerFilters.builder.namePlaceholder')}
        />
        <RuleSetGroup ruleset={ruleset} onChange={setRuleset} />
      </section>
    </BaseModal>
  );
}
