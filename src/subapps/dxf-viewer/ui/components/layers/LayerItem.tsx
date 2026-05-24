// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
/**
 * LayerItem Component
 * Displays a single layer with its entities and controls
 */

import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, Edit2, ChevronRight, ChevronDown, Lock } from 'lucide-react';
import { EntityCard } from './components/EntityCard';
import type { AnySceneEntity, SceneModel } from '../../../types/scene';
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { layoutUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';
// ADR-358 Phase 9E-4: compat bridge for name-keyed layer lookup.
import { getSceneLayerByName } from '../../../utils/scene-layer-utils';
import { validateLayerName, type LayerNameValidationResult } from '../../../services/layer-name-validator';
import { useUniversalSelection } from '../../../systems/selection';

export interface LayerItemProps {
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
  getFilteredEntities: (layerName: string) => AnySceneEntity[];
  
  // Event handlers
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
  handleEntityClick: (entityId: string, ctrlPressed: boolean) => void;
  handleEntityMultiSelectForMerge: (entityId: string, ctrlPressed: boolean) => void;
  handleEntityKeyDown: (e: React.KeyboardEvent, allVisibleEntities: Array<{ id: string }>) => void;
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
  const universalSelection = useUniversalSelection();
  const { quick, getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  // 🌐 i18n
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  // ADR-358 Phase 9E-4: compat bridge — name-keyed lookup (Phase 9E-6 will switch to id-keyed).
  // Non-null: LayerItem is only rendered for layers that exist in the scene.
  const layer = getSceneLayerByName(scene, layerName)!;
  const isSystemLayer = layer.name === '0';
  const isEditing = editingLayer === layerName;
  const [renameValidation, setRenameValidation] =
    useState<LayerNameValidationResult | null>(null);
  const existingLayers = Object.values(scene.layersById);
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
        universalSelection.replaceEntitySelection(entityIds);
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
    if (isSystemLayer) return;
    setEditingLayer(layerName);
    setEditingName(layerName);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (renameValidation && !renameValidation.valid) return;
      if (editingName.trim() && editingName !== layerName) {
        onLayerRename?.(layerName, editingName.trim());
      }
      setEditingLayer(null);
      setEditingName('');
      setRenameValidation(null);
    } else if (e.key === 'Escape') {
      setEditingLayer(null);
      setEditingName('');
      setRenameValidation(null);
    }
  };

  const handleNameBlur = () => {
    if (renameValidation && !renameValidation.valid) {
      setEditingLayer(null);
      setEditingName('');
      setRenameValidation(null);
      return;
    }
    if (editingName.trim() && editingName !== layerName) {
      onLayerRename?.(layerName, editingName.trim());
    }
    setEditingLayer(null);
    setEditingName('');
    setRenameValidation(null);
  };

  const handleVisibilityToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLayerToggle?.(layerName, !layer.visible);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSystemLayer) return;
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
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleExpandToggle}
                  aria-label={isLayerExpanded ? t('layerActions.collapseEntities') : t('layerActions.expandEntities')}
                  className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
                >
                  {isLayerExpanded ? (
                    <ChevronDown className={iconSizes.xs} />
                  ) : (
                    <ChevronRight className={iconSizes.xs} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{isLayerExpanded ? t('layerActions.collapseEntities') : t('layerActions.expandEntities')}</TooltipContent>
            </Tooltip>
          )}

          {/* Color Picker */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleColorPickerToggle}
                  aria-label={t('layerActions.changeColor')}
                  className={`${iconSizes.xs} rounded ${getStatusBorder('muted')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
                  style={layoutUtilities.dxf.colors.backgroundColor(layer.color)}
                />
              </TooltipTrigger>
              <TooltipContent>{t('layerActions.changeColor')}</TooltipContent>
            </Tooltip>
          </div>

          {/* Layer Name */}
          {isEditing ? (
            <div className="flex flex-col gap-0.5 flex-1">
              <input
                type="text"
                value={editingName}
                onChange={(e) => {
                  setEditingName(e.target.value);
                  setRenameValidation(
                    validateLayerName({
                      name: e.target.value,
                      existingLayers,
                      excludeId: layer.id,
                    }),
                  );
                }}
                onKeyDown={handleNameKeyDown}
                onBlur={handleNameBlur}
                className={`${colors.bg.secondary} ${colors.text.primary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.INPUT.PADDING_X} rounded border ${renameValidation && !renameValidation.valid ? 'border-destructive' : getStatusBorder('info')} focus:outline-none ${colors.interactive.focus.ring}`}
                autoFocus
              />
              {renameValidation && !renameValidation.valid && (
                <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} text-destructive`}>
                  {t(`layerValidation.${renameValidation.error}`, { ns: 'dxf-viewer-panels' })}
                  {renameValidation.suggestion &&
                    ` ${t(`layerValidation.${renameValidation.error}_suggestion`, {
                      ns: 'dxf-viewer-panels',
                      suggestion: renameValidation.suggestion,
                    })}`}
                </span>
              )}
            </div>
          ) : (
            <>
              <span
                className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary} ${PANEL_LAYOUT.TEXT_OVERFLOW.TRUNCATE} ${PANEL_LAYOUT.CURSOR.POINTER}`}
                title={layerName}
                onDoubleClick={handleNameDoubleClick}
              >
                {layerName}
              </span>
              {isSystemLayer && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`inline-flex items-center gap-0.5 ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} select-none`}>
                      <Lock className={iconSizes.xs} />
                      {t('layerActions.layer0Badge', { ns: 'dxf-viewer-panels' })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('layerActions.layer0Tooltip', { ns: 'dxf-viewer-panels' })}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
        
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          {/* Entity Count */}
          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{entityCount}</span>

          {/* Visibility Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleVisibilityToggle}
                aria-label={layer.visible ? t('layerActions.hide') : t('layerActions.show')}
                className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
              >
                {layer.visible ? <Eye className={iconSizes.xs} /> : <EyeOff className={iconSizes.xs} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{layer.visible ? t('layerActions.hide') : t('layerActions.show')}</TooltipContent>
          </Tooltip>

          {/* Edit Button — hidden for system layer "0" */}
          {!isSystemLayer && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleEditClick}
                  aria-label={t('layerActions.rename')}
                  className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
                >
                  <Edit2 className={iconSizes.xs} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('layerActions.rename')}</TooltipContent>
            </Tooltip>
          )}

          {/* Delete Button — hidden for system layer "0" */}
          {!isSystemLayer && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleDeleteClick}
                  aria-label={t('layerActions.delete')}
                  className={`${PANEL_LAYOUT.SPACING.XS} ${HOVER_TEXT_EFFECTS.RED}`}
                >
                  <Trash2 className={iconSizes.xs} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('layerActions.delete')}</TooltipContent>
            </Tooltip>
          )}
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

