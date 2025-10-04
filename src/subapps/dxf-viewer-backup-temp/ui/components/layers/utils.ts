/**
 * Color Group Utilities
 * Common functions for ColorGroup components
 */

import type { SceneModel } from '../../../types/scene';

/**
 * Creates a consistent key for color group identification
 * Used across ColorGroupItem and ColorGroupList components
 */
export function createColorGroupKey(colorName: string): string {
  return `layer:${encodeURIComponent(colorName)}`;
}

/**
 * Common props interface for ColorGroup components
 */
export interface ColorGroupCommonProps {
  scene: SceneModel;
  
  // State
  expandedColorGroups: Set<string>;
  editingColorGroup: string | null;
  editingColorGroupName: string;
  colorPickerColorGroup: string | null;
  selectedColorGroupsForMerge: Set<string>;
  
  // State setters
  setExpandedColorGroups: (groups: Set<string>) => void;
  setEditingColorGroup: (group: string | null) => void;
  setEditingColorGroupName: (name: string) => void;
  setColorPickerColorGroup: (group: string | null) => void;
  
  // Callbacks
  getColorGroupDisplayName: (colorName: string) => string;
  handleColorGroupMultiSelectForMerge: (colorName: string, layerNames: string[], ctrlPressed: boolean) => void;
  handleColorGroupClick: (colorName: string, layerNames: string[]) => void;
  
  // Event handlers
  onColorGroupToggle?: (colorGroupName: string, layersInGroup: string[], visible: boolean) => void;
  onColorGroupDelete?: (colorGroupName: string, layersInGroup: string[]) => void;
  
  // Layer item props
  layerItemProps: Record<string, unknown>;
}