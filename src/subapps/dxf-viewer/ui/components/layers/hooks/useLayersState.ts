import { useState } from 'react';
import type { SceneModel } from '../../../../types/scene';
import { DEFAULT_LAYER_COLOR } from '../../../../config/color-config';

export function useLayersState(scene: SceneModel | null) {
  // Simple state
  const [editingLayer, setEditingLayer] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [colorPickerLayer, setColorPickerLayer] = useState<string | null>(null);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  
  // Entity editing state
  const [editingEntity, setEditingEntity] = useState<string | null>(null);
  const [editingEntityName, setEditingEntityName] = useState<string>('');
  const [colorPickerEntity, setColorPickerEntity] = useState<string | null>(null);
  
  // Color Group editing state
  const [editingColorGroup, setEditingColorGroup] = useState<string | null>(null);
  const [editingColorGroupName, setEditingColorGroupName] = useState<string>('');
  
  // Search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Custom Color Group names - Map from original color group name to custom name
  const [customColorGroupNames, setCustomColorGroupNames] = useState<Map<string, string>>(new Map());
  
  // Keyboard navigation state
  const [focusedEntityId, setFocusedEntityId] = useState<string | null>(null);
  
  // Multi-selection states for merge functionality
  const [selectedEntitiesForMerge, setSelectedEntitiesForMerge] = useState<Set<string>>(new Set());
  const [selectedLayersForMerge, setSelectedLayersForMerge] = useState<Set<string>>(new Set());
  const [selectedColorGroupsForMerge, setSelectedColorGroupsForMerge] = useState<Set<string>>(new Set());
  
  // Color Group state - Start with all expanded
  const [expandedColorGroups, setExpandedColorGroups] = useState<Set<string>>(() => {
    if (!scene?.layers) return new Set();
    const colorGroupNames = Array.from(new Set(
      Object.values(scene.layers).map(layer => `Color ${layer.color || DEFAULT_LAYER_COLOR}`)
    ));
    return new Set(colorGroupNames);
  });
  const [colorPickerColorGroup, setColorPickerColorGroup] = useState<string | null>(null);

  return {
    // Layer state
    editingLayer,
    setEditingLayer,
    editingName,
    setEditingName,
    colorPickerLayer,
    setColorPickerLayer,
    expandedLayers,
    setExpandedLayers,
    
    // Entity state
    editingEntity,
    setEditingEntity,
    editingEntityName,
    setEditingEntityName,
    colorPickerEntity,
    setColorPickerEntity,
    
    // Color Group state
    editingColorGroup,
    setEditingColorGroup,
    editingColorGroupName,
    setEditingColorGroupName,
    expandedColorGroups,
    setExpandedColorGroups,
    colorPickerColorGroup,
    setColorPickerColorGroup,
    customColorGroupNames,
    setCustomColorGroupNames,
    
    // Search state
    searchTerm,
    setSearchTerm,
    
    // Keyboard navigation
    focusedEntityId,
    setFocusedEntityId,
    
    // Multi-selection
    selectedEntitiesForMerge,
    setSelectedEntitiesForMerge,
    selectedLayersForMerge,
    setSelectedLayersForMerge,
    selectedColorGroupsForMerge,
    setSelectedColorGroupsForMerge
  };
}