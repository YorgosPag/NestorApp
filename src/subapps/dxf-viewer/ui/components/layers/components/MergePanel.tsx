// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { GitMerge, Lightbulb } from 'lucide-react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { PANEL_TOKENS } from '../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

interface MergePanelProps {
  selectedEntitiesForMerge: Set<string>;
  selectedLayersForMerge: Set<string>;
  selectedColorGroupsForMerge: Set<string>;
  onMergeEntities: () => void;
  onMergeLayers: () => void;
  onMergeColorGroups: () => void;
}

export const MergePanel = ({
  selectedEntitiesForMerge,
  selectedLayersForMerge,
  selectedColorGroupsForMerge,
  onMergeEntities,
  onMergeLayers,
  onMergeColorGroups,
}: MergePanelProps) => {
  const iconSizes = useIconSizes();
  // 🌐 i18n
  const { t } = useTranslation('dxf-viewer');
  const hasAnySelection =
    selectedEntitiesForMerge.size > 1 || 
    selectedLayersForMerge.size > 1 || 
    selectedColorGroupsForMerge.size > 1;

  if (!hasAnySelection) return null;

  return (
    <div className={PANEL_TOKENS.MERGE_PANEL.CONTAINER.BASE}>
      <div className={PANEL_TOKENS.MERGE_PANEL.TITLE.BASE}>{t('mergePanel.title')}</div>

      {selectedEntitiesForMerge.size > 1 && (
        <div className="flex items-center justify-between">
          <span className={PANEL_TOKENS.MERGE_PANEL.SECTION_TEXT.BASE}>
            {t('mergePanel.entitiesSelected', { count: selectedEntitiesForMerge.size })}
          </span>
          <button
            onClick={onMergeEntities}
            className={PANEL_TOKENS.MERGE_PANEL.ACTION_BUTTON.BASE}
            title={t('layerActions.mergeEntities')}
          >
            <GitMerge className={iconSizes.xs} />
            {t('mergePanel.mergeEntitiesButton')}
          </button>
        </div>
      )}

      {selectedLayersForMerge.size > 1 && (
        <div className="flex items-center justify-between">
          <span className={PANEL_TOKENS.MERGE_PANEL.SECTION_TEXT.BASE}>
            {t('mergePanel.layersSelected', { count: selectedLayersForMerge.size })}
          </span>
          <button
            onClick={onMergeLayers}
            className={PANEL_TOKENS.MERGE_PANEL.ACTION_BUTTON.BASE}
            title={t('layerActions.mergeLayers')}
          >
            <GitMerge className={iconSizes.xs} />
            {t('mergePanel.mergeLayersButton')}
          </button>
        </div>
      )}

      {selectedColorGroupsForMerge.size > 1 && (
        <div className="flex items-center justify-between">
          <span className={PANEL_TOKENS.MERGE_PANEL.SECTION_TEXT.BASE}>
            {t('mergePanel.colorGroupsSelected', { count: selectedColorGroupsForMerge.size })}
          </span>
          <button
            onClick={onMergeColorGroups}
            className={PANEL_TOKENS.MERGE_PANEL.ACTION_BUTTON.BASE}
            title={t('layerActions.mergeColorGroups')}
          >
            <GitMerge className={iconSizes.xs} />
            {t('mergePanel.mergeColorGroupsButton')}
          </button>
        </div>
      )}

      <div className={`${PANEL_TOKENS.MERGE_PANEL.FOOTER_TEXT.BASE} flex items-center gap-1`}>
        <Lightbulb className={iconSizes.xs} /> {t('mergePanel.tip')}
      </div>
    </div>
  );
};