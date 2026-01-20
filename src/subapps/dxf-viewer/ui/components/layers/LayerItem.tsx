// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
/**
 * LayerItem Component
 * Displays a single layer with its entities and controls
 */

import React from 'react';
import { Eye, EyeOff, Trash2, Edit2, ChevronRight, ChevronDown } from 'lucide-react';
import { EntityCard } from './components/EntityCard';
import type { SceneModel } from '../../../types/scene';
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { layoutUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

interface LayerItemProps {
  layerName: string;
  scene: SceneModel;
  
  // State
  editingLayer: string | null;
  editingName: string;
  colorPickerLayer: string | null;
  expandedLayers: Set<string>;
  selectedLayersForMerge: Set<string>;
  
  // State setters
  setColorPickerLayer: (layer: string | null) => void;
  setEditingLayer: (layer: string | null) => void;
  setEditingName: (name: string) => void;
  setExpandedLayers: (layers: Set<string>) => void;
  
  // Callbacks
  handleLayerMultiSelectForMerge: (layerName: string, ctrlPressed: boolean) => void;
  getFilteredEntities: (layerName: string) => Array<{ id: string; type: string; layer: string; [key: string]: unknown }>;
  
  // Event handlers
  onEntitySelectionChange?: (entityIds: string[]) => void;
  onLayerToggle?: (layerName: string, visible: boolean) => void;
  onLayerDelete?: (layerName: string) => void;
  onLayerRename?: (oldName: string, newName: string) => void;
  
  // Entity-related props
  selectedEntityIds: string[];
  editingEntity: string | null;
  colorPickerEntity: string | null;
  focusedEntityId: string | null;
  selectedEntitiesForMerge: Set<string>;
  editingEntityName: string;
  
  // Entity callbacks
  handleEntityClick: (entity: { id: string; type: string; layer: string; [key: string]: unknown }, ctrlPressed: boolean) => void;
  handleEntityMultiSelectForMerge: (entityId: string, ctrlPressed: boolean) => void;
  handleEntityKeyDown: (e: React.KeyboardEvent) => void;
  setFocusedEntityId: (id: string | null) => void;
  setColorPickerEntity: (id: string | null) => void;
  setEditingEntity: (id: string | null) => void;
  setEditingEntityName: (name: string) => void;
  
  // Entity event handlers
  onEntityToggle?: (entityId: string, visible: boolean) => void;
  onEntityDelete?: (entityId: string) => void;
  onEntityColorChange?: (entityId: string, color: string) => void;
  onEntityRename?: (entityId: string, newName: string) => void;
}

export function LayerItem({
  layerName,
  scene,
  
  editingLayer,
  editingName,
  colorPickerLayer,
  expandedLayers,
  selectedLayersForMerge,
  
  setColorPickerLayer,
  setEditingLayer,
  setEditingName,
  setExpandedLayers,
  
  handleLayerMultiSelectForMerge,
  getFilteredEntities,
  
  onEntitySelectionChange,
  onLayerToggle,
  onLayerDelete,
  onLayerRename,
  
  // Entity props
  selectedEntityIds,
  editingEntity,
  colorPickerEntity,
  focusedEntityId,
  selectedEntitiesForMerge,
  editingEntityName,
  
  handleEntityClick,
  handleEntityMultiSelectForMerge,
  handleEntityKeyDown,
  setFocusedEntityId,
  setColorPickerEntity,
  setEditingEntity,
  setEditingEntityName,
  
  onEntityToggle,
  onEntityDelete,
  onEntityColorChange,
  onEntityRename
}: LayerItemProps) {
  const { quick, getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  // 🌐 i18n
  const { t } = useTranslation('dxf-viewer');
  const layer = scene.layers[layerName];
  const isEditing = editingLayer === layerName;
  const showColorPicker = colorPickerLayer === layerName;
  
  // Get filtered entities in this layer
  const layerEntities = getFilteredEntities(layerName);
  const entityCount = layerEntities.length;
  
  // Helper για consistent keys (ίδιο με το FloatingPanelContainer)
  const layerKey = `layer:${encodeURIComponent(layerName)}`;
  const isLayerExpanded = expandedLayers.has(layerKey);
  
  if (process.env.NODE_ENV === 'development' && entityCount > 0) {
    console.debug('[LayerItem] layerName:', layerName, 'key:', layerKey, 'expanded:', isLayerExpanded, 'entityCount:', entityCount);
  }

  const handleLayerClick = (e: React.MouseEvent) => {
    if (!isEditing) {
      e.stopPropagation();
      const ctrlPressed = e.ctrlKey || e.metaKey;
      if (ctrlPressed) {
        handleLayerMultiSelectForMerge(layerName, true);
      } else {
        const entityIds = layerEntities.map(entity => entity.id);
        onEntitySelectionChange?.(entityIds);
      }
    }
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedLayers);
    if (expandedLayers.has(layerKey)) {
      newExpanded.delete(layerKey);
    } else {
      newExpanded.add(layerKey);
    }
    setExpandedLayers(newExpanded);
  };

  const handleColorPickerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setColorPickerLayer(showColorPicker ? null : layerName);
  };

  const handleNameDoubleClick = () => {
    setEditingLayer(layerName);
    setEditingName(layerName);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingName.trim() && editingName !== layerName) {
        onLayerRename?.(layerName, editingName.trim());
      }
      setEditingLayer(null);
      setEditingName('');
    } else if (e.key === 'Escape') {
      setEditingLayer(null);
      setEditingName('');
    }
  };

  const handleNameBlur = () => {
    if (editingName.trim() && editingName !== layerName) {
      onLayerRename?.(layerName, editingName.trim());
    }
    setEditingLayer(null);
    setEditingName('');
  };

  const handleVisibilityToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLayerToggle?.(layerName, !layer.visible);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLayer(layerName);
    setEditingName(layerName);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLayerDelete?.(layerName);
  };

  return (
    <>
      <div
        className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.CURSOR.POINTER} ${PANEL_LAYOUT.TRANSITION.ALL} ${getDirectionalBorder('muted', 'left')} ${
          layer.visible ? `${colors.bg.secondary} ${HOVER_BACKGROUND_EFFECTS.LIGHT}` : `${colors.bg.primary} ${PANEL_LAYOUT.OPACITY['60']}`
        } ${selectedLayersForMerge.has(layerName) ? `ring-2 ${colors.ring.info} ${colors.bg.selection}` : ''}`}
        onClick={handleLayerClick}
      >
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM} flex-1 ${PANEL_LAYOUT.MIN_WIDTH['0']}`}>
          {/* Expand/Collapse Arrow for entities */}
          {entityCount > 0 && (
            <button
              onClick={handleExpandToggle}
              className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
              title={isLayerExpanded ? t('layerActions.collapseEntities') : t('layerActions.expandEntities')}
            >
              {isLayerExpanded ? (
                <ChevronDown className={iconSizes.xs} />
              ) : (
                <ChevronRight className={iconSizes.xs} />
              )}
            </button>
          )}
          
          {/* Color Picker */}
          <div className="relative">
            <button
              onClick={handleColorPickerToggle}
              className={`${iconSizes.xs} rounded ${getStatusBorder('muted')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
              style={layoutUtilities.dxf.colors.backgroundColor(layer.color)}
              title={t('layerActions.changeColor')}
            />
          </div>

          {/* Layer Name */}
          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleNameBlur}
              className={`${colors.bg.secondary} ${colors.text.primary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.INPUT.PADDING_X} rounded border ${getStatusBorder('info')} focus:outline-none ${colors.interactive.focus.ring}`}
              autoFocus
            />
          ) : (
            <span
              className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary} ${PANEL_LAYOUT.TEXT_OVERFLOW.TRUNCATE} ${PANEL_LAYOUT.CURSOR.POINTER}`}
              title={layerName}
              onDoubleClick={handleNameDoubleClick}
            >
              {layerName}
            </span>
          )}
        </div>
        
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          {/* Entity Count */}
          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{entityCount}</span>
          
          {/* Visibility Toggle */}
          <button
            onClick={handleVisibilityToggle}
            className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
            title={layer.visible ? t('layerActions.hide') : t('layerActions.show')}
          >
            {layer.visible ? <Eye className={iconSizes.xs} /> : <EyeOff className={iconSizes.xs} />}
          </button>
          
          {/* Edit Button */}
          <button
            onClick={handleEditClick}
            className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
            title={t('layerActions.rename')}
          >
            <Edit2 className={iconSizes.xs} />
          </button>
          
          {/* Delete Button */}
          <button
            onClick={handleDeleteClick}
            className={`${PANEL_LAYOUT.SPACING.XS} ${HOVER_TEXT_EFFECTS.RED}`}
            title={t('layerActions.delete')}
          >
            <Trash2 className={iconSizes.xs} />
          </button>
        </div>
      </div>

      {/* Individual Entities (when layer is expanded) */}
      {isLayerExpanded && layerEntities.map((entity) => (
        <EntityCard
          key={entity.id}
          entity={entity}
          layer={layer}
          isSelected={selectedEntityIds.includes(entity.id)}
          isEntityEditing={editingEntity === entity.id}
          showEntityColorPicker={colorPickerEntity === entity.id}
          isFocused={focusedEntityId === entity.id}
          selectedEntitiesForMerge={selectedEntitiesForMerge}
          editingEntityName={editingEntityName}
          onEntityClick={handleEntityClick}
          onEntityMultiSelectForMerge={handleEntityMultiSelectForMerge}
          onEntityKeyDown={handleEntityKeyDown}
          onSetFocusedEntityId={setFocusedEntityId}
          onSetColorPickerEntity={setColorPickerEntity}
          onSetEditingEntity={setEditingEntity}
          onSetEditingEntityName={setEditingEntityName}
          onEntityToggle={onEntityToggle}
          onEntityDelete={onEntityDelete}
          onEntityColorChange={onEntityColorChange}
          onEntityRename={onEntityRename}
          layerEntities={layerEntities}
        />
      ))}
    </>
  );
}