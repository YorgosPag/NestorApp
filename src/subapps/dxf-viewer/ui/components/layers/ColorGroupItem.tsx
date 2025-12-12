/**
 * ColorGroupItem Component
 * Displays a single color group with its layers and controls
 */

import React from 'react';
import { Eye, EyeOff, Trash2, Edit2, ChevronRight, ChevronDown } from 'lucide-react';
import { LayerItem } from './LayerItem';
import { createColorGroupKey, type ColorGroupCommonProps } from './utils';
import { DEFAULT_LAYER_COLOR } from '../../../config/color-config';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, HOVER_TEXT_EFFECTS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';

interface ColorGroupItemProps extends Pick<ColorGroupCommonProps, 
  'setExpandedColorGroups' | 'setColorPickerColorGroup' | 'setEditingColorGroup' | 
  'setEditingColorGroupName' | 'getColorGroupDisplayName' | 'handleColorGroupMultiSelectForMerge' | 
  'handleColorGroupClick' | 'onColorGroupToggle' | 'onColorGroupDelete' | 'layerItemProps' | 'scene'
> {
  colorName: string;
  layerNames: string[];
  isExpanded: boolean;
  isEditingColorGroup: boolean;
  showColorGroupColorPicker: boolean;
  editingColorGroupName: string;
  selectedColorGroupsForMerge: Set<string>;
}

export function ColorGroupItem({
  colorName,
  layerNames,
  scene,
  isExpanded,
  isEditingColorGroup,
  showColorGroupColorPicker,
  editingColorGroupName,
  selectedColorGroupsForMerge,
  
  setExpandedColorGroups,
  setColorPickerColorGroup,
  setEditingColorGroup,
  setEditingColorGroupName,
  
  getColorGroupDisplayName,
  handleColorGroupMultiSelectForMerge,
  handleColorGroupClick,
  
  onColorGroupToggle,
  onColorGroupDelete,
  
  layerItemProps
}: ColorGroupItemProps) {
  
  const representativeColor = scene.layers[layerNames[0]]?.color || DEFAULT_LAYER_COLOR;
  
  // Color Group visibility check
  const allVisible = layerNames.every((layerName: string) => scene.layers[layerName]?.visible);
  const someVisible = layerNames.some((layerName: string) => scene.layers[layerName]?.visible);

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const colorGroupKey = createColorGroupKey(colorName);
    setExpandedColorGroups(prev => {
      const newExpanded = new Set(prev);
      if (prev.has(colorGroupKey)) {
        newExpanded.delete(colorGroupKey);
      } else {
        newExpanded.add(colorGroupKey);
      }
      return newExpanded;
    });
  };

  const handleColorPickerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setColorPickerColorGroup(showColorGroupColorPicker ? null : colorName);
  };

  const handleGroupClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ctrlPressed = e.ctrlKey || e.metaKey;
    if (ctrlPressed) {
      handleColorGroupMultiSelectForMerge(colorName, layerNames, true);
    } else {
      handleColorGroupClick(colorName, layerNames);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingColorGroup(colorName);
    setEditingColorGroupName(getColorGroupDisplayName(colorName));
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onColorGroupDelete?.(colorName, layerNames);
  };

  const handleVisibilityToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onColorGroupToggle?.(colorName, layerNames, !allVisible);
  };

  const handleNameDoubleClick = () => {
    setEditingColorGroup(colorName);
    setEditingColorGroupName(getColorGroupDisplayName(colorName));
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditingColorGroup(null);
      setEditingColorGroupName('');
    } else if (e.key === 'Escape') {
      setEditingColorGroup(null);
      setEditingColorGroupName('');
    }
  };

  const handleNameBlur = () => {
    setEditingColorGroup(null);
    setEditingColorGroupName('');
  };

  return (
    <div className="space-y-1">
      {/* Color Group Header */}
      <div 
        className={`flex items-center justify-between p-2 bg-purple-900 bg-opacity-20 border border-purple-500 rounded cursor-pointer ${INTERACTIVE_PATTERNS.PURPLE_HOVER} transition-colors ${
          selectedColorGroupsForMerge.has(colorName) ? 'ring-2 ring-blue-400 bg-blue-900 bg-opacity-30' : ''
        }`}
        onClick={handleGroupClick}
        title="Κλικ για επιλογή όλων των entities, Ctrl+Κλικ για multi-selection"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Expand/Collapse Arrow */}
          <button
            onClick={handleExpandToggle}
            className={`p-1 text-purple-300 ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT}`}
            title={isExpanded ? "Σύμπτυξη" : "Ανάπτυξη"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {/* Color Group Color Picker */}
          <div className="relative">
            <button
              onClick={handleColorPickerToggle}
              className={`w-4 h-4 rounded border border-gray-500 ${HOVER_BORDER_EFFECTS.BLUE}`}
              style={{ backgroundColor: representativeColor }}
              title="Αλλαγή χρώματος Color Group"
            />
          </div>
          
          {/* Color Group Name */}
          {isEditingColorGroup ? (
            <input
              type="text"
              value={editingColorGroupName}
              onChange={(e) => setEditingColorGroupName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleNameBlur}
              className="bg-gray-700 text-purple-200 text-sm font-medium px-1 rounded border border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 min-w-0 flex-1"
              autoFocus
            />
          ) : (
            <span 
              className="text-sm font-medium text-purple-200 truncate cursor-pointer"
              title="Double-click για μετονομασία"
              onDoubleClick={handleNameDoubleClick}
            >
              {getColorGroupDisplayName(colorName)} ({layerNames.length} layers)
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Visibility Toggle */}
          <button
            onClick={handleVisibilityToggle}
            className={`p-1 text-gray-400 ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT}`}
            title={allVisible ? "Απόκρυψη Color Group" : "Εμφάνιση Color Group"}
          >
            {allVisible ? (
              <Eye className="w-4 h-4" />
            ) : someVisible ? (
              <Eye className="w-4 h-4 opacity-50" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>
          
          {/* Edit Button */}
          <button
            onClick={handleEditClick}
            className={`p-1 text-gray-400 ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT}`}
            title="Μετονομασία Color Group"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          
          {/* Delete Button */}
          <button
            onClick={handleDeleteClick}
            className={`p-1 text-red-600 ${HOVER_TEXT_EFFECTS.RED}`}
            title="Διαγραφή Color Group"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Individual Layers (when expanded) */}
      {isExpanded && layerNames.map((layerName: string) => (
        <div key={layerName} className="ml-6">
          <LayerItem
            layerName={layerName}
            scene={scene}
            {...layerItemProps}
          />
        </div>
      ))}
    </div>
  );
}