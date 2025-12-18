'use client';

import React from 'react';
import { GitMerge } from 'lucide-react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { PANEL_TOKENS } from '../../../../config/panel-tokens';

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
            title="Συγχώνευση επιλεγμένων entities"
          >
            <GitMerge className="w-3 h-3" />
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
            title="Συγχώνευση επιλεγμένων layers"
          >
            <GitMerge className="w-3 h-3" />
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
            title="Συγχώνευση επιλεγμένων color groups"
          >
            <GitMerge className="w-3 h-3" />
            Merge Color Groups
          </button>
        </div>
      )}
      
      <div className={PANEL_TOKENS.MERGE_PANEL.FOOTER_TEXT.BASE}>
        💡 Tip: Ctrl+Click για multi-selection
      </div>
    </div>
  );
};