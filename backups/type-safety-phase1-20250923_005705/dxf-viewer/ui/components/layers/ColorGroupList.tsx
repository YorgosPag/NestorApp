/**
 * ColorGroupList Component
 * Renders the list of color groups and handles their interactions
 */

import React from 'react';
import { ColorGroupItem } from './ColorGroupItem';
import { createColorGroupKey, type ColorGroupCommonProps } from './utils';

interface ColorGroupListProps extends ColorGroupCommonProps {
  colorGroups: Map<string, string[]>;
}

export function ColorGroupList({
  scene,
  colorGroups,
  
  expandedColorGroups,
  editingColorGroup,
  editingColorGroupName,
  colorPickerColorGroup,
  selectedColorGroupsForMerge,
  
  setExpandedColorGroups,
  setEditingColorGroup,
  setEditingColorGroupName,
  setColorPickerColorGroup,
  
  getColorGroupDisplayName,
  handleColorGroupMultiSelectForMerge,
  handleColorGroupClick,
  
  onColorGroupToggle,
  onColorGroupDelete,
  
  layerItemProps
}: ColorGroupListProps) {
  
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {Array.from(colorGroups.entries()).map(([colorName, layerNames]) => {
        const colorGroupKey = createColorGroupKey(colorName);
        const isExpanded = expandedColorGroups.has(colorGroupKey);
        const showColorGroupColorPicker = colorPickerColorGroup === colorName;
        const isEditingColorGroup = editingColorGroup === colorName;
        
        if (process.env.NODE_ENV === 'development') {
          console.debug('[ColorGroupList] colorName:', colorName, 'key:', colorGroupKey, 'expanded:', isExpanded);
        }
        
        return (
          <ColorGroupItem
            key={colorName}
            colorName={colorName}
            layerNames={layerNames}
            scene={scene}
            isExpanded={isExpanded}
            isEditingColorGroup={isEditingColorGroup}
            showColorGroupColorPicker={showColorGroupColorPicker}
            editingColorGroupName={editingColorGroupName}
            selectedColorGroupsForMerge={selectedColorGroupsForMerge}
            
            setExpandedColorGroups={setExpandedColorGroups}
            setColorPickerColorGroup={setColorPickerColorGroup}
            setEditingColorGroup={setEditingColorGroup}
            setEditingColorGroupName={setEditingColorGroupName}
            
            getColorGroupDisplayName={getColorGroupDisplayName}
            handleColorGroupMultiSelectForMerge={handleColorGroupMultiSelectForMerge}
            handleColorGroupClick={handleColorGroupClick}
            
            onColorGroupToggle={onColorGroupToggle}
            onColorGroupDelete={onColorGroupDelete}
            
            layerItemProps={layerItemProps}
          />
        );
      })}
    </div>
  );
}