// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
// 🏢 ENTERPRISE: Refactored to use LevelListCard - 2026-01-25
'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_LEVEL_PANEL = false;

import React, { useState, useMemo, useCallback } from 'react';
// 🏢 ENTERPRISE: Unified EventBus for type-safe event coordination
import { EventBus } from '../../systems/events';
import { useTranslation } from '@/i18n';
import { Plus, Upload, Download } from 'lucide-react';
// 🏢 ADR-309 Phase 2: Wizard button in LevelPanel
import { FloorplanImportWizard } from '@/features/floorplan-import';
import { DxfFirestoreService, type DxfSaveContext } from '../../services/dxf-firestore.service';
import type { FloorplanType } from '../../systems/levels/config';
import { ENTITY_TYPES, type EntityType } from '@/config/domain-constants';
import { Button } from '@/components/ui/button';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
// 🏢 ENTERPRISE: Centralized LevelListCard from domain cards
import { LevelListCard } from '@/domain/cards';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useOverlayStore } from '../../overlays/overlay-store';
import { PANEL_TOKENS, PANEL_LAYOUT, PanelTokenUtils } from '../../config/panel-tokens';
import { OverlayList } from '../OverlayList';
import { OverlayProperties } from '../OverlayProperties';
import { useGripContext } from '../../providers/GripProvider';
import { SceneInfoSection } from './SceneInfoSection'; // 🔺 ADDED: Import SceneInfoSection
import { LayersSection } from './LayersSection'; // 🔺 ADDED: Import LayersSection
import type { ToolType } from '../toolbar/types';
import type { SceneModel } from '../../types/scene';
import { useLevels } from '../../systems/levels';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { createOverlayHandlers } from '../../overlays/types';
// 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
import { useUniversalSelection } from '../../systems/selection';
import { isNonEmptyArray } from '@/lib/type-guards';
import { LevelFloorLink } from './LevelFloorLink';

interface LevelPanelProps {
  currentTool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
  // 🔺 ADDED: Props for SceneInfoSection and LayersSection
  scene?: SceneModel | null;
  selectedEntityIds?: string[];
  // ADR-309 Phase 2: Wizard button
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext) => void;
  // LayersSection specific props
  onEntitySelect?: (ids: string[]) => void;
  expandedKeys?: Set<string>;
  onExpandChange?: React.Dispatch<React.SetStateAction<Set<string>>>;
  // Layer operations
  onLayerToggle?: (layerName: string, visible: boolean) => void;
  onLayerDelete?: (layerName: string) => void;
  onLayerColorChange?: (layerName: string, color: string) => void;
  onLayerRename?: (oldName: string, newName: string) => void;
  onLayerCreate?: (name: string, color: string) => void;
  // Entity operations
  onEntityToggle?: (entityId: string, visible: boolean) => void;
  onEntityDelete?: (entityId: string) => void;
  onEntityColorChange?: (entityId: string, color: string) => void;
  onEntityRename?: (entityId: string, newName: string) => void;
  // Color group operations
  onColorGroupToggle?: (colorGroupName: string, layersInGroup: string[], visible: boolean) => void;
  onColorGroupDelete?: (colorGroupName: string, layersInGroup: string[]) => void;
  onColorGroupColorChange?: (colorGroupName: string, layersInGroup: string[], color: string) => void;
  // Merge operations
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

  const overlayStore = useOverlayStore();
  // 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
  const universalSelection = useUniversalSelection();

  // Use shared overlay handlers to eliminate duplicate code
  // 🏢 ENTERPRISE (2026-01-25): Bridge to universal selection system - ADR-030
  const { handleOverlaySelect, handleOverlayEdit, handleOverlayDelete } =
    createOverlayHandlers({
      setSelectedOverlay: (id: string | null) => {
        // 🏢 ENTERPRISE (2026-01-25): Route through universal selection system - ADR-030
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
      setCurrentLevel: setCurrentLevel  // ✅ Περνάω την ίδια function που χρησιμοποιείται στο κλικ της κάρτας επιπέδου
    });

  const currentOverlays = currentLevelId
    ? overlayStore.getByLevel(currentLevelId)
    : [];

  // ADR-309 Phase 4: Inline overlay panel only when active level is floorplanType='floor'
  const currentLevel = useMemo(
    () => (currentLevelId ? levels.find(l => l.id === currentLevelId) : undefined),
    [levels, currentLevelId]
  );
  const showOverlayPanel = currentLevel?.floorplanType === 'floor';

  const selectedOverlayId = universalSelection.getPrimaryId();
  const selectedOverlay = selectedOverlayId ? (overlayStore.overlays[selectedOverlayId] ?? null) : null;
    
  // ✅ ENTERPRISE: Proper typing for levelScenes (SceneModel instead of unknown)
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
  // ADR-309 Phase 2: Wizard dialog state
  const [showImportWizard, setShowImportWizard] = useState(false);
  // ADR-309 Phase 5: Load from storage — wizard in load mode
  const [showLoadWizard, setShowLoadWizard] = useState(false);

  // ADR-309 Phase 3: Map wizard entityType → FloorplanType
  const entityTypeToFloorplanType = useCallback((entityType: EntityType): FloorplanType | undefined => {
    switch (entityType) {
      case ENTITY_TYPES.PROJECT: return 'project';
      case ENTITY_TYPES.BUILDING: return 'building';
      case ENTITY_TYPES.FLOOR: return 'floor';
      case ENTITY_TYPES.PROPERTY: return 'unit';
      default: return undefined;
    }
  }, []);

  const handleDeleteLevel = async (levelId: string) => {
    try {
      await deleteLevel(levelId);
    } catch (error) {
      console.error('❌ Failed to delete level:', error);
    }
  };

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

  // Handle editing mode changes
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

  // Handle layering tool activation
  // ✅ FIX: Wrapped in useCallback to prevent infinite loop in useEffect dependency
  const handleLayeringActivation = useCallback(() => {
    setShowToolbox(true);

    // Auto-activate editing mode when layering is activated
    setActiveEditingMode('editing');
    updateGripSettings({
      showGrips: true,       // Αυτόματη ενεργοποίηση grips όταν ανοίγει το layering
      multiGripEdit: true,
      snapToGrips: true
    });

  }, [updateGripSettings]);

  // ✅ EVENT LISTENER: Ακούω για το layering activate event από overlay clicks
  // 🏢 ENTERPRISE: Unified EventBus.on — receives events from both EventBus.emit AND window CustomEvent
  React.useEffect(() => {
    const cleanup = EventBus.on('level-panel:layering-activate', () => {
      handleLayeringActivation();
    });
    return cleanup;
  }, [handleLayeringActivation]);

  return (
    <div className={`${PANEL_TOKENS.LEVEL_PANEL.CONTAINER.BASE} ${PANEL_TOKENS.LEVEL_PANEL.CONTAINER.PADDING} ${PANEL_TOKENS.LEVEL_PANEL.CONTAINER.SECTION}`}>
      {/* 🔺 ADDED: Scene Info Section moved from Properties */}
      <SceneInfoSection 
        scene={scene || null} 
        selectedEntityIds={selectedEntityIds} 
      />
      {/* ADR-309 Phase 2: Wizard button — primary entry point for floorplan import */}
      {onSceneImported && (
        <Button variant="default" className="w-full" onClick={() => setShowImportWizard(true)}>
          <Upload className={iconSizes.sm} />
          {t('toolbar.importFloorplanWizard')}
        </Button>
      )}
      {/* ADR-309 Phase 5: Load from storage — only when level has a linked entity */}
      {(currentLevel?.floorId || currentLevel?.buildingId || currentLevel?.projectId) && (
        <Button variant="outline" className="w-full" onClick={() => setShowLoadWizard(true)}>
          <Download className={iconSizes.sm} />{t('panels.levels.loadFromStorage')}
        </Button>
      )}

      {/* ✅ ENTERPRISE: Αφαίρεση περιττού wrapper - justify-between χωρίς νόημα με 1 child (ADR-003) */}
      <h3 className={PANEL_TOKENS.LEVEL_PANEL.HEADER.TEXT}>
        <NAVIGATION_ENTITIES.building.icon className={PANEL_TOKENS.LEVEL_PANEL.HEADER.ICON} />
        {t('panels.levels.projectLevels')}
      </h3>

      {isNonEmptyArray(levels) ? (
        <div className={PANEL_TOKENS.LEVEL_PANEL.CONTAINER.SECTION}>
          {levels.map((level) => {
            const scene = levelScenes[level.id];
            const entityCount = scene?.entities?.length || 0;
            const isEditing = editingLevelId === level.id;
            const isOnlyLevel = levels.length === 1;
            const isSelected = currentLevelId === level.id;

            // 🏢 ENTERPRISE: Inline editing mode - keep input field for rename
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

            // 🏢 ENTERPRISE: Normal mode - use LevelListCard
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
                    handleDeleteLevel(level.id);
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
      )}

      {/* ADR-309 §2.5: "+ Νέο Επίπεδο" hidden — new levels created via wizard only (reversible) */}
      {/* addLevel() function remains in useLevels; only UI hidden */}

      {/* 🔺 ADDED: LayersSection moved from Properties */}
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

      {/* ADR-309 Phase 4: Inline overlay management — visible only when floorplanType='floor' */}
      {showOverlayPanel && (
        <div className={PANEL_TOKENS.LEVEL_PANEL.OVERLAY_SECTION}>
          {/* 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030 */}
          <OverlayList
            overlays={currentOverlays}
            selectedOverlayId={selectedOverlayId}
            onSelect={handleOverlaySelect}
            onEdit={handleOverlayEdit}
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

      {/* ADR-309 Phase 5: Load wizard — same wizard in load mode */}
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
      {/* ADR-309 Phase 2: Wizard dialog — same instance as toolbar (SPEC-237D) */}
      {onSceneImported && (
        <FloorplanImportWizard
          isOpen={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          onComplete={(file, meta) => {
            setShowImportWizard(false);
            const saveContext: DxfSaveContext = {
              companyId: meta.companyId,
              projectId: meta.projectId,
              entityId: meta.entityId,
              entityType: meta.entityType as DxfSaveContext['entityType'],
              filesCategory: 'floorplans',
              purpose: meta.purpose || undefined,
              entityLabel: meta.entityLabel,
            };
            // ADR-309 Phase 3: Store context on the current level for context-aware titles
            if (currentLevelId) {
              const floorplanType = entityTypeToFloorplanType(meta.entityType);
              if (floorplanType) {
                updateLevelContext(currentLevelId, {
                  floorplanType,
                  entityLabel: meta.entityLabel,
                  projectId: meta.projectId,
                });
              }
            }
            onSceneImported(file, undefined, saveContext);
          }}
        />
      )}
    </div>
  );
}

