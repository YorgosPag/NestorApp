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
      <div className={PANEL_TOKENS.MERGE_PANEL.TITLE.BASE}>🔗 Multi-Selection Active</div>
      
      {selectedEntitiesForMerge.size > 1 && (
        <div className="flex items-center justify-between">
          <span className={PANEL_TOKENS.MERGE_PANEL.SECTION_TEXT.BASE}>
            {selectedEntitiesForMerge.size} entities επιλεγμένες
          </span>
          <button
            onClick={onMergeEntities}
            className={PANEL_TOKENS.MERGE_PANEL.ACTION_BUTTON.BASE}
            title={t('layerActions.mergeEntities')}
          >
            <GitMerge className={iconSizes.xs} />
            Merge Entities
          </button>
        </div>
      )}
      
      {selectedLayersForMerge.size > 1 && (
        <div className="flex items-center justify-between">
          <span className={PANEL_TOKENS.MERGE_PANEL.SECTION_TEXT.BASE}>
            {selectedLayersForMerge.size} layers επιλεγμένα
          </span>
          <button
            onClick={onMergeLayers}
            className={PANEL_TOKENS.MERGE_PANEL.ACTION_BUTTON.BASE}
            title={t('layerActions.mergeLayers')}
          >
            <GitMerge className={iconSizes.xs} />
            Merge Layers
          </button>
        </div>
      )}
      
      {selectedColorGroupsForMerge.size > 1 && (
        <div className="flex items-center justify-between">
          <span className={PANEL_TOKENS.MERGE_PANEL.SECTION_TEXT.BASE}>
            {selectedColorGroupsForMerge.size} color groups επιλεγμένα
          </span>
          <button
            onClick={onMergeColorGroups}
            className={PANEL_TOKENS.MERGE_PANEL.ACTION_BUTTON.BASE}
            title={t('layerActions.mergeColorGroups')}
          >
            <GitMerge className={iconSizes.xs} />
            Merge Color Groups
          </button>
        </div>
      )}
      
      <div className={`${PANEL_TOKENS.MERGE_PANEL.FOOTER_TEXT.BASE} flex items-center gap-1`}>
        <Lightbulb className={iconSizes.xs} /> Tip: Ctrl+Click για multi-selection
      </div>
    </div>
  );
};