'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_LEVEL_PANEL = false;

import React, { useState, useMemo, useCallback } from 'react';
import { Trash2, Plus, Edit, MousePointer, Pen, Move, Info, Shapes } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useOverlayStore } from '../../overlays/overlay-store';
import { PANEL_TOKENS, PANEL_LAYOUT, PanelTokenUtils } from '../../config/panel-tokens';
import { OverlayList } from '../OverlayList';
import { useGripContext } from '../../providers/GripProvider';
import { SceneInfoSection } from './SceneInfoSection'; // 🔺 ADDED: Import SceneInfoSection
import { LayersSection } from './LayersSection'; // 🔺 ADDED: Import LayersSection
import type { ToolType } from '../toolbar/types';
import type { SceneModel } from '../../types/scene';
import { useLevels } from '../../systems/levels';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { createOverlayHandlers } from '../../overlays/types';

interface LevelPanelProps {
  currentTool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
  // 🔺 ADDED: Props for SceneInfoSection and LayersSection
  scene?: SceneModel | null;
  selectedEntityIds?: string[];
  // LayersSection specific props
  onEntitySelect?: (ids: string[]) => void;
  expandedKeys?: Set<string>;
  onExpandChange?: (next: Set<string>) => void;
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
  const iconSizes = useIconSizes();

  const {
    levels,
    currentLevelId,
    setCurrentLevel,
    addLevel,
    deleteLevel,
    renameLevel,
    getLevelScene,
  } = useLevels();

  const { gripSettings, updateGripSettings } = useGripContext();
  const notifications = useNotifications();

  const overlayStore = useOverlayStore();

  // Use shared overlay handlers to eliminate duplicate code
  const { handleOverlaySelect, handleOverlayEdit, handleOverlayDelete } =
    createOverlayHandlers({
      setSelectedOverlay: overlayStore.setSelectedOverlay,
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

  const handleDeleteLevel = async (levelId: string) => {
    try {
      await deleteLevel(levelId);

    } catch (error) {
      console.error('❌ Failed to delete level:', error);
    }
  };

  const handleAddLevel = async () => {
    if (isAdding) return;

    const safeName = newLevelName.trim() || `Επίπεδο ${levels.length + 1}`;

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
      notifications.warning("Το όνομα δεν μπορεί να είναι κενό.");
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
      // Enable grip editing when editing mode is selected
      updateGripSettings({ 
        showGrips: true,       // Βεβαιώνομαι ότι τα grips είναι visible
        multiGripEdit: true,
        snapToGrips: true 
      });
      
      // Activate grip-edit tool instead of select
      if (onToolChange) {
        onToolChange('grip-edit');
      }
      
      // Dispatch event for canvas to enable grip interactions
      window.dispatchEvent(new CustomEvent('level-panel:grip-edit-enabled', { 
        detail: { enabled: true } 
      }));

    } else {
      // Disable grip editing for other modes (but keep grips visible in selection mode)
      if (mode === 'selection') {
        updateGripSettings({ 
          showGrips: true,       // Στο selection mode, δείχνω τα grips αλλά χωρίς editing
          multiGripEdit: false,
          snapToGrips: false 
        });
        if (onToolChange) {
          onToolChange('select');
        }
      } else {
        updateGripSettings({ 
          showGrips: false       // Κρύβω τα grips στα άλλα modes
        });
      }
      
      window.dispatchEvent(new CustomEvent('level-panel:grip-edit-enabled', { 
        detail: { enabled: false } 
      }));
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
  React.useEffect(() => {
    const handleLayeringActivateEvent = (event: CustomEvent) => {
      console.log('🎯 RECEIVED LAYERING ACTIVATE EVENT:', event.detail);

      // Καλώ την ίδια function που καλείται στο level card click
      handleLayeringActivation();

      console.log('✅ LAYERING ACTIVATION COMPLETED FROM EVENT');
    };

    // Προσθήκη event listener
    window.addEventListener('level-panel:layering-activate', handleLayeringActivateEvent as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('level-panel:layering-activate', handleLayeringActivateEvent as EventListener);
    };
  }, [handleLayeringActivation]); // Dependency στη function για να αναδημιουργηθεί αν αλλάξει

  return (
    <div className={`${PANEL_TOKENS.LEVEL_PANEL.CONTAINER.BASE} ${PANEL_TOKENS.LEVEL_PANEL.CONTAINER.PADDING} ${PANEL_TOKENS.LEVEL_PANEL.CONTAINER.SECTION}`}>
      {/* 🔺 ADDED: Scene Info Section moved from Properties */}
      <SceneInfoSection 
        scene={scene || null} 
        selectedEntityIds={selectedEntityIds} 
      />
      
      {/* ✅ ENTERPRISE: Αφαίρεση περιττού wrapper - justify-between χωρίς νόημα με 1 child (ADR-003) */}
      <h3 className={PANEL_TOKENS.LEVEL_PANEL.HEADER.TEXT}>
        <NAVIGATION_ENTITIES.building.icon className={PANEL_TOKENS.LEVEL_PANEL.HEADER.ICON} />
        Επίπεδα Έργου
      </h3>

      {Array.isArray(levels) && levels.length > 0 ? (
        <div className={PANEL_TOKENS.LEVEL_PANEL.CONTAINER.SECTION}>
          {levels.map((level) => {

            const scene = levelScenes[level.id];
            const hasContent = scene && scene.entities && scene.entities.length > 0;
            const isEditing = editingLevelId === level.id;
            const isOnlyLevel = levels.length === 1;

            return (
              <div
                key={level.id}
                className={PanelTokenUtils.getLevelCardClasses(currentLevelId === level.id)}
              >
                <div className={`flex items-center justify-between ${PANEL_LAYOUT.FLEX_UTILS.ALLOW_SHRINK}`}>
                  {isEditing ? (
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
                  ) : (
                    <button
                      type="button"
                      className={`flex-1 ${PANEL_LAYOUT.CURSOR.POINTER} text-left bg-transparent border-none`}
                      onClick={() => {
                        setCurrentLevel(level.id);
                        if (currentTool !== 'grip-edit' && onToolChange) onToolChange('grip-edit');
                        // ✅ FIX (ChatGPT-5): ONLY one activation path - via event (removed direct call to handleLayeringActivation)
                        window.dispatchEvent(new CustomEvent('level-panel:layering-activate', {
                          detail: { levelId: level.id, origin: 'card' }
                        }));
                      }}
                      aria-label={`Επιλογή επιπέδου ${level.name}`}
                    >
                      <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{level.name}</div>
                      <div className={`${PANEL_TOKENS.TABS.TAB_LABEL.SIZE} ${PANEL_LAYOUT.OPACITY['75']}`}>
                        {hasContent ? `${scene.entities.length} στοιχεία` : 'Κενό επίπεδο'}
                      </div>
                    </button>
                  )}
                  
                  <nav className={`flex items-center ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${PANEL_LAYOUT.MARGIN.LEFT_SM}`}>
                    <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(level);
                        }}
                        className={PANEL_TOKENS.LEVEL_PANEL.ACTION_BUTTON.EDIT}
                        title="Μετονομασία επιπέδου"
                      >
                        <Edit className={iconSizes.sm} />
                    </button>
                    {!isOnlyLevel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLevel(level.id);
                        }}
                        className={PANEL_TOKENS.LEVEL_PANEL.ACTION_BUTTON.DELETE}
                        title="Διαγραφή επιπέδου"
                      >
                        <Trash2 className={iconSizes.sm} />
                      </button>
                    )}
                  </nav>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={PANEL_TOKENS.LEVEL_PANEL.EMPTY_STATE.CONTAINER}>
          <NAVIGATION_ENTITIES.building.icon className={PANEL_TOKENS.LEVEL_PANEL.EMPTY_STATE.ICON} />
          <p>Δεν υπάρχουν επίπεδα</p>
        </div>
      )}

      <div className={PANEL_TOKENS.LEVEL_PANEL.ADD_SECTION.CONTAINER}>
        <div className={PANEL_TOKENS.LEVEL_PANEL.ADD_SECTION.FORM}>
          <input
            type="text"
            value={newLevelName}
            onChange={(e) => setNewLevelName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLevel()}
            placeholder="Όνομα νέου επιπέδου..."
            disabled={isAdding}
            className={PANEL_TOKENS.LEVEL_PANEL.ADD_INPUT.BASE}
          />
          <button
            type="button"
            onClick={handleAddLevel}
            disabled={isAdding}
            className={PANEL_TOKENS.LEVEL_PANEL.ADD_BUTTON.BASE}
          >
            {isAdding ? (
              <div className={PANEL_TOKENS.LEVEL_PANEL.ADD_BUTTON.LOADING_SPINNER}></div>
            ) : (
              <Plus className={iconSizes.sm} />
            )}
          </button>
        </div>
      </div>

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

      {/* Editing Toolbox - shown when layering tool is active */}
      
      <div className={PANEL_TOKENS.LEVEL_PANEL.OVERLAY_SECTION}>
        <OverlayList
            overlays={currentOverlays}
            selectedOverlayId={overlayStore.selectedOverlayId}
            onSelect={handleOverlaySelect}
            onEdit={handleOverlayEdit}
            onDelete={handleOverlayDelete}
            onToggleLayers={() => {
              // Auto-open layers panel functionality - already integrated
            }}
        />
        
      </div>
    </div>
  );
}
