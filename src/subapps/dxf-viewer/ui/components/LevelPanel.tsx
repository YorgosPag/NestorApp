'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { EventBus } from '../../systems/events';
import { useTranslation } from '@/i18n';
import { Upload, Download, ChevronDown } from 'lucide-react';
import { FloorplanImportWizard } from '@/features/floorplan-import';
import { DxfFirestoreService, type DxfSaveContext } from '../../services/dxf-firestore.service';
import type { FloorplanType } from '../../systems/levels/config';
import { ENTITY_TYPES, type EntityType } from '@/config/domain-constants';
import { Button } from '@/components/ui/button';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { LevelListCard } from '@/domain/cards';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLiveOverlaysForLevel } from '../../hooks/useLiveOverlaysForLevel';
import { PANEL_TOKENS, PANEL_LAYOUT, PanelTokenUtils } from '../../config/panel-tokens';
import { OverlayList } from '../OverlayList';
import { OverlayProperties } from '../OverlayProperties';
import { useGripContext } from '../../providers/GripProvider';
import { SceneInfoSection } from './SceneInfoSection';
import { LayersSection } from './LayersSection';
import type { ToolType } from '../toolbar/types';
import type { SceneModel } from '../../types/scene';
import { useLevels } from '../../systems/levels';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { createOverlayHandlers } from '../../overlays/types';
import { useUniversalSelection } from '../../systems/selection';
import { isNonEmptyArray } from '@/lib/type-guards';
import { LevelFloorLink } from './LevelFloorLink';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FileRecordService } from '@/services/file-record.service';
import { useAuth } from '@/auth/hooks/useAuth';

interface LevelPanelProps {
  currentTool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
  scene?: SceneModel | null;
  selectedEntityIds?: string[];
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext) => void;
  onEntitySelect?: (ids: string[]) => void;
  expandedKeys?: Set<string>;
  onExpandChange?: React.Dispatch<React.SetStateAction<Set<string>>>;
  onLayerToggle?: (layerName: string, visible: boolean) => void;
  onLayerDelete?: (layerName: string) => void;
  onLayerColorChange?: (layerName: string, color: string) => void;
  onLayerRename?: (oldName: string, newName: string) => void;
  onLayerCreate?: (name: string, color: string) => void;
  onEntityToggle?: (entityId: string, visible: boolean) => void;
  onEntityDelete?: (entityId: string) => void;
  onEntityColorChange?: (entityId: string, color: string) => void;
  onEntityRename?: (entityId: string, newName: string) => void;
  onColorGroupToggle?: (colorGroupName: string, layersInGroup: string[], visible: boolean) => void;
  onColorGroupDelete?: (colorGroupName: string, layersInGroup: string[]) => void;
  onColorGroupColorChange?: (colorGroupName: string, layersInGroup: string[], color: string) => void;
  onEntitiesMerge?: (targetEntityId: string, sourceEntityIds: string[]) => void;
  onLayersMerge?: (targetLayerName: string, sourceLayerNames: string[]) => void;
  onColorGroupsMerge?: (targetColorGroup: string, sourceColorGroups: string[]) => void;
}

type EditingMode = 'selection' | 'drawing' | 'editing' | 'status' | 'types' | null;

export function LevelPanel({
  currentTool,
  onToolChange,
  scene,
  selectedEntityIds = [],
  onSceneImported,
  onEntitySelect,
  expandedKeys = new Set(),
  onExpandChange,
  onLayerToggle,
  onLayerDelete,
  onLayerColorChange,
  onLayerRename,
  onLayerCreate,
  onEntityToggle,
  onEntityDelete,
  onEntityColorChange,
  onEntityRename,
  onColorGroupToggle,
  onColorGroupDelete,
  onColorGroupColorChange,
  onEntitiesMerge,
  onLayersMerge,
  onColorGroupsMerge
}: LevelPanelProps = {}) {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const iconSizes = useIconSizes();

  const {
    levels,
    currentLevelId,
    setCurrentLevel,
    addLevel,
    deleteLevel,
    renameLevel,
    getLevelScene,
    setLevelScene,
    linkLevelToFloor,
    updateLevelContext,
  } = useLevels();

  const { gripSettings, updateGripSettings } = useGripContext();
  const notifications = useNotifications();
  const { user } = useAuth();
  const overlayStore = useOverlayStore();
  const universalSelection = useUniversalSelection();
  const { handleOverlaySelect, handleOverlayEdit, handleOverlayDelete } =
    createOverlayHandlers({
      setSelectedOverlay: (id: string | null) => {
        if (id) {
          universalSelection.select(id, 'overlay');
        } else {
          universalSelection.clearByType('overlay');
        }
      },
      remove: overlayStore.remove,
      update: overlayStore.update,
      getSelectedOverlay: overlayStore.getSelectedOverlay,
      overlays: overlayStore.overlays
    }, {
      setCurrentLevel,
    });
  // ADR-281: filter out overlays linked to soft-deleted properties
  const currentOverlays = useLiveOverlaysForLevel(currentLevelId);
  const currentLevel = useMemo(
    () => (currentLevelId ? levels.find(l => l.id === currentLevelId) : undefined),
    [levels, currentLevelId]
  );
  const showOverlayPanel = currentLevel?.floorplanType === 'floor';
  const selectedOverlayId = universalSelection.getPrimaryId();
  const selectedOverlay = selectedOverlayId ? (overlayStore.overlays[selectedOverlayId] ?? null) : null;
  const levelScenes = useMemo(() => {
    const scenes: Record<string, SceneModel> = {};
    if (levels && getLevelScene) {
      levels.forEach(level => {
        const scene = getLevelScene(level.id);
        if (scene) scenes[level.id] = scene;
      });
    }
    return scenes;
  }, [levels, getLevelScene]);
  const [newLevelName, setNewLevelName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [activeEditingMode, setActiveEditingMode] = useState<EditingMode>(null);
  const [showToolbox, setShowToolbox] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showLoadWizard, setShowLoadWizard] = useState(false);

  const entityTypeToFloorplanType = useCallback((entityType: EntityType): FloorplanType | undefined => {
    switch (entityType) {
      case ENTITY_TYPES.PROJECT: return 'project';
      case ENTITY_TYPES.BUILDING: return 'building';
      case ENTITY_TYPES.FLOOR: return 'floor';
      case ENTITY_TYPES.PROPERTY: return 'unit';
      default: return undefined;
    }
  }, []);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLevelsCollapsed, setIsLevelsCollapsed] = useState(false);
  const pendingDeleteLevelRef = useRef<string | null>(null);
  const requestDeleteLevel = useCallback((levelId: string) => {
    pendingDeleteLevelRef.current = levelId;
    setShowDeleteConfirm(true);
  }, []);
  const handleConfirmDelete = useCallback(async () => {
    const levelId = pendingDeleteLevelRef.current;
    if (!levelId) return;
    try {
      const level = levels.find(l => l.id === levelId);
      await deleteLevel(levelId);
      // Trash underlying FileRecord if linked
      if (level?.sceneFileId && user?.uid) {
        try {
          await FileRecordService.moveToTrash(level.sceneFileId, user.uid);
        } catch {
          // Non-blocking — level removed, file trash best-effort
        }
      }
    } catch (error) {
      console.error('Failed to delete level:', error);
    } finally {
      setShowDeleteConfirm(false);
      pendingDeleteLevelRef.current = null;
    }
  }, [levels, deleteLevel, user?.uid]);
  const handleCloseLevel = useCallback(async (levelId: string) => {
    try {
      await deleteLevel(levelId);
    } catch (error) {
      console.error('Failed to close level:', error);
    }
  }, [deleteLevel]);

  const handleAddLevel = async () => {
    if (isAdding) return;

    const safeName = newLevelName.trim() || t('panels.levels.defaultLevelName', { number: levels.length + 1 });

    try {
      setIsAdding(true);
      const newLevelId = await addLevel(safeName);
      setNewLevelName('');
      if (newLevelId) {
        setCurrentLevel(newLevelId);
      }
    } catch (error) {
      console.error('❌ Failed to add level:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRename = (levelId: string) => {
    if (!editingName.trim()) {
      notifications.warning(t('panels.levels.emptyNameWarning'));
      return;
    }
    renameLevel(levelId, editingName);
    setEditingLevelId(null);
    setEditingName('');
  };
  
  const startEditing = (level: { id: string, name: string }) => {
    setEditingLevelId(level.id);
    setEditingName(level.name);
  };

  const handleEditingModeChange = (mode: EditingMode) => {
    setActiveEditingMode(mode);
    if (mode === 'editing') {
      updateGripSettings({ showGrips: true, multiGripEdit: true, snapToGrips: true });
      if (onToolChange) onToolChange('grip-edit');
      window.dispatchEvent(new CustomEvent('level-panel:grip-edit-enabled', { detail: { enabled: true } }));
    } else {
      if (mode === 'selection') {
        updateGripSettings({ showGrips: true, multiGripEdit: false, snapToGrips: false });
        if (onToolChange) onToolChange('select');
      } else {
        updateGripSettings({ showGrips: false });
      }
      window.dispatchEvent(new CustomEvent('level-panel:grip-edit-enabled', { detail: { enabled: false } }));
    }
  };
  const handleLayeringActivation = useCallback(() => {
    setShowToolbox(true);
    setActiveEditingMode('editing');
    updateGripSettings({ showGrips: true, multiGripEdit: true, snapToGrips: true });
  }, [updateGripSettings]);
  React.useEffect(() => {
    const cleanup = EventBus.on('level-panel:layering-activate', () => {
      handleLayeringActivation();
    });
    return cleanup;
  }, [handleLayeringActivation]);

  return (
    <div className={`${PANEL_TOKENS.LEVEL_PANEL.CONTAINER.BASE} ${PANEL_TOKENS.LEVEL_PANEL.CONTAINER.PADDING} ${PANEL_TOKENS.LEVEL_PANEL.CONTAINER.SECTION}`}>
      <SceneInfoSection scene={scene || null} selectedEntityIds={selectedEntityIds} />
      {onSceneImported && (
        <Button variant="default" className="w-full" onClick={() => setShowImportWizard(true)}>
          <Upload className={iconSizes.sm} />
          {t('toolbar.importFloorplanWizard')}
        </Button>
      )}
      {(currentLevel?.floorId || currentLevel?.buildingId || currentLevel?.projectId) && (
        <Button variant="outline" className="w-full" onClick={() => setShowLoadWizard(true)}>
          <Download className={iconSizes.sm} />{t('panels.levels.loadFromStorage')}
        </Button>
      )}
      <button
        type="button"
        onClick={() => setIsLevelsCollapsed(prev => !prev)}
        className={`w-full flex items-center justify-between cursor-pointer rounded ${PANEL_LAYOUT.PADDING.XS} hover:opacity-80 transition-opacity`}
      >
        <h3 className={PANEL_TOKENS.LEVEL_PANEL.HEADER.TEXT}>
          <NAVIGATION_ENTITIES.building.icon className={PANEL_TOKENS.LEVEL_PANEL.HEADER.ICON} />
          {t('panels.levels.projectLevels')}
        </h3>
        <ChevronDown
          className={`${iconSizes.sm} transition-transform duration-200 ${isLevelsCollapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {!isLevelsCollapsed && (isNonEmptyArray(levels) ? (
        <div className={PANEL_TOKENS.LEVEL_PANEL.CONTAINER.SECTION}>
          {levels.map((level) => {
            const scene = levelScenes[level.id];
            const entityCount = scene?.entities?.length || 0;
            const isEditing = editingLevelId === level.id;
            const isOnlyLevel = levels.length === 1;
            const isSelected = currentLevelId === level.id;
            if (isEditing) {
              return (
                <div
                  key={level.id}
                  className={PanelTokenUtils.getLevelCardClasses(isSelected)}
                >
                  <div className={`flex items-center justify-between ${PANEL_LAYOUT.FLEX_UTILS.ALLOW_SHRINK}`}>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleRename(level.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(level.id)}
                        className={PANEL_TOKENS.LEVEL_PANEL.LEVEL_INPUT.BASE}
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={level.id}>
                <LevelListCard
                  level={level}
                  entityCount={entityCount}
                  isSelected={isSelected}
                  isOnlyLevel={isOnlyLevel}
                  onSelect={() => {
                    setCurrentLevel(level.id);
                    if (currentTool !== 'grip-edit' && onToolChange) onToolChange('grip-edit');
                    EventBus.emit('level-panel:layering-activate', { levelId: level.id, source: 'card' });
                  }}
                  onEdit={(e) => {
                    e.stopPropagation();
                    startEditing(level);
                  }}
                  onDelete={(e) => {
                    e.stopPropagation();
                    requestDeleteLevel(level.id);
                  }}
                  onClose={(e) => {
                    e.stopPropagation();
                    handleCloseLevel(level.id);
                  }}
                  compact
                />
                <LevelFloorLink
                  levelId={level.id}
                  floorId={level.floorId}
                  onLink={linkLevelToFloor}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className={PANEL_TOKENS.LEVEL_PANEL.EMPTY_STATE.CONTAINER}>
          <NAVIGATION_ENTITIES.building.icon className={PANEL_TOKENS.LEVEL_PANEL.EMPTY_STATE.ICON} />
          <p>{t('panels.levels.noLevels')}</p>
        </div>
      ))}
      {scene && Object.keys(scene.layers).length > 0 && (
        <div className={PANEL_TOKENS.LEVEL_PANEL.SECTIONS_BORDER}>
          <LayersSection
            scene={scene}
            selectedEntityIds={selectedEntityIds}
            onEntitySelectionChange={onEntitySelect}
            onLayerToggle={onLayerToggle}
            onLayerDelete={onLayerDelete}
            onLayerColorChange={onLayerColorChange}
            onLayerRename={onLayerRename}
            onEntityToggle={onEntityToggle}
            onEntityDelete={onEntityDelete}
            onEntityColorChange={onEntityColorChange}
            onEntityRename={onEntityRename}
            onColorGroupToggle={onColorGroupToggle}
            onColorGroupDelete={onColorGroupDelete}
            onColorGroupColorChange={onColorGroupColorChange}
            onEntitiesMerge={onEntitiesMerge}
            onLayersMerge={onLayersMerge}
            onColorGroupsMerge={onColorGroupsMerge}
            expandedKeys={expandedKeys}
            onExpandChange={onExpandChange}
          />
        </div>
      )}

      {showOverlayPanel && (
        <div className={PANEL_TOKENS.LEVEL_PANEL.OVERLAY_SECTION}>
          <OverlayList
            overlays={currentOverlays}
            selectedOverlayId={selectedOverlayId}
            onSelect={handleOverlaySelect}
            onDelete={handleOverlayDelete}
            onToggleLayers={() => {
              // Auto-open layers panel functionality - already integrated
            }}
          />
          {selectedOverlay && (
            <div className={PANEL_TOKENS.LEVEL_PANEL.SECTIONS_BORDER}>
              <OverlayProperties
                overlay={selectedOverlay}
                onUpdate={(id, updates) => overlayStore.update(id, updates)}
                overlays={overlayStore.overlays}
              />
            </div>
          )}
        </div>
      )}
      <FloorplanImportWizard
        isOpen={showLoadWizard}
        onClose={() => setShowLoadWizard(false)}
        mode="load"
        onLoad={async (fileId) => {
          if (!currentLevelId) return;
          const record = await DxfFirestoreService.loadFromStorage(fileId);
          if (!record?.scene) throw new Error(t('panels.levels.storagePicker.error'));
          setLevelScene(currentLevelId, record.scene);
        }}
      />
      {onSceneImported && (
        <FloorplanImportWizard
          isOpen={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          onComplete={(file, meta) => {
            setShowImportWizard(false);
            const entityType = meta.entityType as DxfSaveContext['entityType'];
            const saveContext: DxfSaveContext = {
              companyId: meta.companyId,
              projectId: meta.projectId,
              ...(entityType === 'building' && meta.entityId ? { buildingId: meta.entityId } : {}),
              ...(entityType === 'floor' && meta.entityId ? { floorId: meta.entityId } : {}),
              entityType,
              filesCategory: 'floorplans',
              purpose: meta.purpose || undefined,
              entityLabel: meta.entityLabel,
              fileRecordId: meta.fileId,
            };
            if (currentLevelId) {
              const floorplanType = entityTypeToFloorplanType(meta.entityType);
              if (floorplanType) {
                updateLevelContext(currentLevelId, {
                  floorplanType,
                  entityLabel: meta.entityLabel,
                  projectId: meta.projectId,
                  floorId: saveContext.floorId,
                  buildingId: saveContext.buildingId,
                });
              }
            }
            onSceneImported(file, undefined, saveContext);
          }}
        />
      )}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('panels.levels.deleteConfirm.title')}
        description={t('panels.levels.deleteConfirm.description')}
        confirmText={t('panels.levels.deleteConfirm.confirm')}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

