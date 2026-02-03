/**
 * LayersSection - Refactored and Simplified
 * Split into smaller, focused components
 */

'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import type { SceneModel } from '../../types/scene';
import { ColorPickerModal } from './layers/components/ColorPickerModal';
import { MergePanel } from './layers/components/MergePanel';
import { SearchInput } from './layers/components/SearchInput';
import { LayersHeader } from './layers/components/LayersHeader';
import { ColorGroupList } from './layers/ColorGroupList';
import { useLayersState } from './layers/hooks/useLayersState';
import { useColorGroups } from './layers/hooks/useColorGroups';
import { useSearchFilter } from './layers/hooks/useSearchFilter';
import { useLayersCallbacks } from './layers/hooks/useLayersCallbacks';
import { useKeyboardNavigation } from './layers/hooks/useKeyboardNavigation';

// ✅ ENTERPRISE: Inline type definitions (matching LevelPanel.tsx)
interface LayersSectionProps {
  scene: SceneModel | null;
  selectedEntityIds: string[];
  onEntitySelectionChange?: (entityIds: string[]) => void;
  // Layer operations
  onLayerToggle?: (layerName: string, visible: boolean) => void;
  onLayerDelete?: (layerName: string) => void;
  onLayerColorChange?: (layerName: string, color: string) => void;
  onLayerRename?: (oldName: string, newName: string) => void;
  // Entity operations (inline instead of extending EntityOperations)
  onEntityToggle?: (entityId: string, visible: boolean) => void;
  onEntityDelete?: (entityId: string) => void;
  onEntityColorChange?: (entityId: string, color: string) => void;
  onEntityRename?: (entityId: string, newName: string) => void;
  // Color group operations (inline instead of extending ColorGroupOperations)
  onColorGroupToggle?: (colorGroupName: string, layersInGroup: string[], visible: boolean) => void;
  onColorGroupDelete?: (colorGroupName: string, layersInGroup: string[]) => void;
  onColorGroupColorChange?: (colorGroupName: string, layersInGroup: string[], color: string) => void;
  // Merge operations
  onEntitiesMerge?: (targetEntityId: string, sourceEntityIds: string[]) => void;
  onLayersMerge?: (targetLayerName: string, sourceLayerNames: string[]) => void;
  onColorGroupsMerge?: (targetColorGroup: string, sourceColorGroups: string[]) => void;
  // Expansion state (optional - matching LevelPanel props)
  expandedKeys?: Set<string>;
  onExpandChange?: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function LayersSection({
  scene,
  selectedEntityIds,
  onEntitySelectionChange,
  onLayerToggle,
  onLayerDelete,
  onLayerColorChange,
  onLayerRename,
  onEntityToggle,
  onEntityDelete,
  onEntityColorChange,
  onEntityRename,
  onColorGroupToggle,
  onColorGroupDelete,
  onColorGroupColorChange,
  onEntitiesMerge,
  onLayersMerge,
  onColorGroupsMerge,
  expandedKeys = new Set<string>(), // ✅ ENTERPRISE: Default value for optional prop
  onExpandChange
}: LayersSectionProps) {
  const noopExpandChange: React.Dispatch<React.SetStateAction<Set<string>>> = () => {};
  const effectiveOnExpandChange = onExpandChange ?? noopExpandChange;
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Use custom hooks for state management
  const state = useLayersState(scene);
  const colorGroups = useColorGroups(scene, state.searchTerm);
  const { getFilteredEntities } = useSearchFilter(scene, state.searchTerm);
  
  // Use callbacks hook
  const callbacks = useLayersCallbacks({
    scene,
    selectedEntityIds,
    onEntitySelectionChange,
    selectedEntitiesForMerge: state.selectedEntitiesForMerge,
    setSelectedEntitiesForMerge: state.setSelectedEntitiesForMerge,
    selectedLayersForMerge: state.selectedLayersForMerge,
    setSelectedLayersForMerge: state.setSelectedLayersForMerge,
    selectedColorGroupsForMerge: state.selectedColorGroupsForMerge,
    setSelectedColorGroupsForMerge: state.setSelectedColorGroupsForMerge,
    onEntitiesMerge,
    onLayersMerge,
    onColorGroupsMerge,
    customColorGroupNames: state.customColorGroupNames
  });
  
  // Use keyboard navigation hook
  const { handleEntityKeyDown } = useKeyboardNavigation({
    selectedEntityIds,
    focusedEntityId: state.focusedEntityId,
    onEntitySelectionChange,
    setFocusedEntityId: state.setFocusedEntityId,
    setSelectedEntitiesForMerge: state.setSelectedEntitiesForMerge
  });

  // Early return for empty scene
  if (!scene || Object.keys(scene.layers).length === 0) {
    return (
      <div className={PANEL_LAYOUT.SPACING.GAP_MD}>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.muted} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <Layers className={iconSizes.sm} />
          Δεν υπάρχουν layers
        </h3>
        <div className={`text-center ${PANEL_LAYOUT.SPACING.LG} ${colors.text.tertiary} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>
          Τα layers θα εμφανιστούν μετά την εισαγωγή DXF
        </div>
      </div>
    );
  }

  // Prepare layer item props (passed to LayerItem components)
  const layerItemProps = {
    // State
    editingLayer: state.editingLayer,
    editingName: state.editingName,
    colorPickerLayer: state.colorPickerLayer,
    expandedLayers: expandedKeys,
    selectedLayersForMerge: state.selectedLayersForMerge,
    
    // State setters
    setColorPickerLayer: state.setColorPickerLayer,
    setEditingLayer: state.setEditingLayer,
    setEditingName: state.setEditingName,
    setExpandedLayers: effectiveOnExpandChange,
    
    // Callbacks
    handleLayerMultiSelectForMerge: callbacks.handleLayerMultiSelectForMerge,
    getFilteredEntities,
    
    // Event handlers
    onEntitySelectionChange,
    onLayerToggle,
    onLayerDelete,
    onLayerRename,
    
    // Entity-related props
    selectedEntityIds,
    editingEntity: state.editingEntity,
    colorPickerEntity: state.colorPickerEntity,
    focusedEntityId: state.focusedEntityId,
    selectedEntitiesForMerge: state.selectedEntitiesForMerge,
    editingEntityName: state.editingEntityName,
    
    // Entity callbacks
    handleEntityClick: callbacks.handleEntityClick,
    handleEntityMultiSelectForMerge: callbacks.handleEntityMultiSelectForMerge,
    handleEntityKeyDown,
    setFocusedEntityId: state.setFocusedEntityId,
    setColorPickerEntity: state.setColorPickerEntity,
    setEditingEntity: state.setEditingEntity,
    setEditingEntityName: state.setEditingEntityName,
    
    // Entity event handlers
    onEntityToggle,
    onEntityDelete,
    onEntityColorChange,
    onEntityRename
  };

  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_MD}>
      <LayersHeader scene={scene} />
      
      <SearchInput 
        searchTerm={state.searchTerm}
        onSearchChange={state.setSearchTerm}
      />

      <MergePanel
        selectedEntitiesForMerge={state.selectedEntitiesForMerge}
        selectedLayersForMerge={state.selectedLayersForMerge}
        selectedColorGroupsForMerge={state.selectedColorGroupsForMerge}
        onMergeEntities={callbacks.mergeSelectedEntities}
        onMergeLayers={callbacks.mergeSelectedLayers}
        onMergeColorGroups={callbacks.mergeSelectedColorGroups}
      />

      <ColorGroupList
        scene={scene}
        colorGroups={colorGroups}
        
        expandedColorGroups={expandedKeys}
        editingColorGroup={state.editingColorGroup}
        editingColorGroupName={state.editingColorGroupName}
        colorPickerColorGroup={state.colorPickerColorGroup}
        selectedColorGroupsForMerge={state.selectedColorGroupsForMerge}
        
        setExpandedColorGroups={effectiveOnExpandChange}
        setEditingColorGroup={state.setEditingColorGroup}
        setEditingColorGroupName={state.setEditingColorGroupName}
        setColorPickerColorGroup={state.setColorPickerColorGroup}
        
        getColorGroupDisplayName={callbacks.getColorGroupDisplayName}
        handleColorGroupMultiSelectForMerge={callbacks.handleColorGroupMultiSelectForMerge}
        handleColorGroupClick={callbacks.handleColorGroupClick}
        
        onColorGroupToggle={onColorGroupToggle}
        onColorGroupDelete={onColorGroupDelete}
        
        layerItemProps={layerItemProps}
      />

      {/* COLOR PICKERS */}
      {state.colorPickerColorGroup && (
        <ColorPickerModal
          title="🎨 Αλλαγή Χρώματος Color Group"
          onColorSelect={(color) => {
            const colorGroupName = state.colorPickerColorGroup!;
            const layersInGroup = colorGroups.get(colorGroupName) || [];
            onColorGroupColorChange?.(colorGroupName, layersInGroup, color);
          }}
          onClose={() => state.setColorPickerColorGroup(null)}
        />
      )}

      {state.colorPickerLayer && (
        <ColorPickerModal
          title="🎨 Αλλαγή Χρώματος Layer"
          onColorSelect={(color) => onLayerColorChange?.(state.colorPickerLayer!, color)}
          onClose={() => state.setColorPickerLayer(null)}
        />
      )}

      {state.colorPickerEntity && (
        <ColorPickerModal
          title="🎨 Αλλαγή Χρώματος Entity"
          onColorSelect={(color) => onEntityColorChange?.(state.colorPickerEntity!, color)}
          onClose={() => state.setColorPickerEntity(null)}
        />
      )}
    </div>
  );
}
