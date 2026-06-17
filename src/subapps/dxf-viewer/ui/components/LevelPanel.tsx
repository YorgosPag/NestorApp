'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { EventBus } from '../../systems/events';
import { useTranslation } from '@/i18n';
import { Upload, Download, ChevronDown, Settings } from 'lucide-react';
import { FloorManagementDialogStore } from '../../stores/FloorManagementDialogStore';
import { FloorplanImportWizard, DuplicateFloorplanDialog } from '@/features/floorplan-import';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
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
import { AnnotationsSection } from './AnnotationsSection';
import type { LevelPanelProps, EditingMode } from './level-panel-types';
import { entityTypeToFloorplanType, buildDuplicateDestinations } from './level-panel-helpers';
import type { SceneModel } from '../../types/scene';
import { useLevels } from '../../systems/levels';
import { countSceneEntities } from '../../utils/scene-entity-count';
import { orderLevelsForPanel } from '../../systems/levels/level-display-order';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { useAllFloorsBackfill, useLevelDeletion, useFloorplanImportComplete } from './level-panel-hooks';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { createOverlayHandlers } from '../../overlays/types';
import { useUniversalSelection } from '../../systems/selection';
import { isNonEmptyArray } from '@/lib/type-guards';
import { LevelFloorLink } from './LevelFloorLink';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/auth/hooks/useAuth';

export function LevelPanel({
  currentTool,
  onToolChange,
  scene,
  onSceneImported,
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

  // ADR-448 Phase 3 — «Φόρτωσε ΟΛΟΥΣ τους ορόφους» backfill (decoupled hook).
  const triggerAllFloorsBackfill = useAllFloorsBackfill({ levels, addLevel, linkLevelToFloor });

  const { gripSettings, updateGripSettings } = useGripContext();
  const notifications = useNotifications();
  const { user } = useAuth();
  const overlayStore = useOverlayStore();
  const universalSelection = useUniversalSelection();
  const selectedEntityIds = universalSelection.getSelectedEntityIds();
  const { handleOverlaySelect, handleOverlayEdit, handleOverlayDelete } =
    createOverlayHandlers({
      setSelectedOverlay: (id: string | null) => universalSelection.handleOverlaySelect(id),
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
  // ADR-461 — order the cards physically (Επίπεδο 1 top, Θεμελίωση bottom, storeys by
  // number DESC, stair-penthouse/roof under «Επίπεδο 1») instead of creation order.
  // Kind/number live on the linked building FLOOR. Source the floors by the levels'
  // own `buildingId` (every linked level carries it) — NOT via ProjectHierarchy's
  // `selectedBuilding`, which is driven by the properties navigator and is typically
  // unset inside the DXF viewer (root cause of «η σειρά δεν άλλαξε», 2026-06-16).
  const buildingId = useMemo(
    () => levels.find(l => l.buildingId)?.buildingId ?? null,
    [levels]
  );
  const { floors: buildingFloors } = useFloorsByBuilding(buildingId, Boolean(buildingId));
  const orderedLevels = useMemo(() => {
    const byId = new Map(buildingFloors.map(f => [f.id, f]));
    return orderLevelsForPanel(levels, (level) =>
      level.floorId ? byId.get(level.floorId) : undefined
    );
  }, [levels, buildingFloors]);
  const [newLevelName, setNewLevelName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [activeEditingMode, setActiveEditingMode] = useState<EditingMode>(null);
  const [showToolbox, setShowToolbox] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showLoadWizard, setShowLoadWizard] = useState(false);
  // ADR-465 — «Αντιγραφή κάτοψης σε όροφο»: source floor for the duplicate dialog.
  const [duplicateSource, setDuplicateSource] = useState<{ floorId: string; name: string } | null>(null);

  const [isLevelsCollapsed, setIsLevelsCollapsed] = useState(false);
  const {
    showDeleteConfirm,
    setShowDeleteConfirm,
    requestDeleteLevel,
    handleConfirmDelete,
    handleCloseLevel,
  } = useLevelDeletion({ levels, deleteLevel, userUid: user?.uid });

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

  // ADR-420/465 — SSoT import-complete handler (extracted to level-panel-hooks),
  // reused by BOTH the import wizard and the cross-floor duplicate dialog.
  const handleImportComplete = useFloorplanImportComplete({
    resolver: { levels, addLevel, linkLevelToFloor },
    currentLevelId,
    setCurrentLevel,
    updateLevelContext,
    entityTypeToFloorplanType,
    triggerAllFloorsBackfill,
    onSceneImported,
  });

  // ADR-465 — destination floors for the cross-floor duplicate dialog (SSoT helper).
  const duplicateDestinations = useMemo(
    () => buildDuplicateDestinations(buildingFloors, duplicateSource?.floorId ?? null, t),
    [buildingFloors, duplicateSource, t],
  );

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
      <div className="w-full flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsLevelsCollapsed(prev => !prev)}
          className={`flex-1 flex items-center justify-between cursor-pointer rounded ${PANEL_LAYOUT.PADDING.XS} hover:opacity-80 transition-opacity`}
        >
          <h3 className={PANEL_TOKENS.LEVEL_PANEL.HEADER.TEXT}>
            <NAVIGATION_ENTITIES.building.icon className={PANEL_TOKENS.LEVEL_PANEL.HEADER.ICON} />
            {t('panels.levels.projectLevels')}
          </h3>
          <ChevronDown
            className={`${iconSizes.sm} transition-transform duration-200 ${isLevelsCollapsed ? '-rotate-90' : ''}`}
          />
        </button>
        {/* «Ρυθμίσεις Ορόφων / Υψομέτρων» — ανοίγει την καρτέλα «Όροφοι» σε modal. */}
        <button
          type="button"
          onClick={() => FloorManagementDialogStore.open()}
          aria-label={t('panels.levels.manageFloors')}
          className={`shrink-0 rounded ${PANEL_LAYOUT.PADDING.XS} hover:opacity-80 transition-opacity`}
        >
          <Settings className={iconSizes.sm} />
        </button>
      </div>

      {!isLevelsCollapsed && (isNonEmptyArray(levels) ? (
        <div className={PANEL_TOKENS.LEVEL_PANEL.CONTAINER.SECTION}>
          {orderedLevels.map((level) => {
            const levelScene = levelScenes[level.id];
            // ADR-309/399/462: for the ACTIVE level the live `scene` prop is the
            // authoritative rendered scene — it tracks DXF + BIM additions in real
            // time, whereas `levelScene` comes from a [levels]-keyed useMemo that is
            // ref-stable and therefore FROZEN after mount (it never recomputes when
            // a wall/column is drawn → setLevelScene only, no `levels` change). So
            // for the active level the live prop MUST win over the cached snapshot,
            // otherwise the count stays stuck at the DXF-only mount value (BUG A
            // 2026-06-16). Inactive levels can't gain entities while not on canvas,
            // so their frozen snapshot is correct.
            const effectiveScene = level.id === currentLevelId ? (scene ?? levelScene ?? null) : levelScene;
            // ADR-462: BIM entities live in the same `scene.entities` array as DXF,
            // so this single count already covers both — via the SSoT counter.
            const entityCount = countSceneEntities(effectiveScene);
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
                  onDuplicate={onSceneImported && level.floorId ? (e) => {
                    e.stopPropagation();
                    setDuplicateSource({
                      floorId: level.floorId!,
                      name: level.entityLabel || level.name,
                    });
                  } : undefined}
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
      {scene && scene.layersById && Object.keys(scene.layersById).length > 0 && (
        <div className={PANEL_TOKENS.LEVEL_PANEL.SECTIONS_BORDER}>
          <LayersSection
            scene={scene}
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

      <div className={PANEL_TOKENS.LEVEL_PANEL.SECTIONS_BORDER}>
        <AnnotationsSection />
      </div>

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
            return handleImportComplete(file, meta);
          }}
        />
      )}
      {onSceneImported && duplicateSource && (
        <DuplicateFloorplanDialog
          isOpen={!!duplicateSource}
          onClose={() => setDuplicateSource(null)}
          source={duplicateSource}
          projectId={currentLevel?.projectId}
          buildingId={buildingId ?? undefined}
          destinations={duplicateDestinations}
          onComplete={handleImportComplete}
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

