'use client';

import React from 'react';
import { GitMerge } from 'lucide-react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

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
    <div className="bg-blue-900 bg-opacity-20 border border-blue-400 rounded-lg p-3 mb-3 space-y-2">
      <div className="text-sm font-medium text-blue-200 mb-2">🔗 Multi-Selection Active</div>
      
      {selectedEntitiesForMerge.size > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-blue-200">
            {selectedEntitiesForMerge.size} entities επιλεγμένες
          </span>
          <button
            onClick={onMergeEntities}
            className={`flex items-center gap-1 px-2 py-1 bg-blue-600 ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} text-white rounded text-xs`}
            title="Συγχώνευση επιλεγμένων entities"
          >
            <GitMerge className="w-3 h-3" />
            Merge Entities
          </button>
        </div>
      )}
      
      {selectedLayersForMerge.size > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-blue-200">
            {selectedLayersForMerge.size} layers επιλεγμένα
          </span>
          <button
            onClick={onMergeLayers}
            className={`flex items-center gap-1 px-2 py-1 bg-blue-600 ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} text-white rounded text-xs`}
            title="Συγχώνευση επιλεγμένων layers"
          >
            <GitMerge className="w-3 h-3" />
            Merge Layers
          </button>
        </div>
      )}
      
      {selectedColorGroupsForMerge.size > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-blue-200">
            {selectedColorGroupsForMerge.size} color groups επιλεγμένα
          </span>
          <button
            onClick={onMergeColorGroups}
            className={`flex items-center gap-1 px-2 py-1 bg-blue-600 ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} text-white rounded text-xs`}
            title="Συγχώνευση επιλεγμένων color groups"
          >
            <GitMerge className="w-3 h-3" />
            Merge Color Groups
          </button>
        </div>
      )}
      
      <div className="text-xs text-blue-300 opacity-75">
        💡 Tip: Ctrl+Click για multi-selection
      </div>
    </div>
  );
};