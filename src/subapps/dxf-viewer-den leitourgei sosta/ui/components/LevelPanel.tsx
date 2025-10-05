'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_LEVEL_PANEL = false;

import React, { useState, useMemo } from 'react';
import { Trash2, Plus, Building2, Edit, MousePointer, Pen, Move, Info, Shapes } from 'lucide-react';
import { useOverlayStore } from '../../overlays/overlay-store';
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
    
  const levelScenes = useMemo(() => {
    const scenes: Record<string, unknown> = {};
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
  const handleLayeringActivation = () => {
    setShowToolbox(true);

    // Auto-activate editing mode when layering is activated
    setActiveEditingMode('editing');
    updateGripSettings({
      showGrips: true,       // Αυτόματη ενεργοποίηση grips όταν ανοίγει το layering
      multiGripEdit: true,
      snapToGrips: true
    });

  };

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
    <div className="h-full flex flex-col px-1 py-2 space-y-4">
      {/* 🔺 ADDED: Scene Info Section moved from Properties */}
      <SceneInfoSection 
        scene={scene || null} 
        selectedEntityIds={selectedEntityIds} 
      />
      
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Επίπεδα Έργου
        </h3>
      </div>

      {Array.isArray(levels) && levels.length > 0 ? (
        <div className="space-y-2">
          {levels.map((level) => {

            const scene = levelScenes[level.id];
            const hasContent = scene && scene.entities && scene.entities.length > 0;
            const isEditing = editingLevelId === level.id;
            const isOnlyLevel = levels.length === 1;

            return (
              <div
                key={level.id}
                className={`p-3 rounded-lg border transition-all ${
                  currentLevelId === level.id
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center justify-between min-w-0">
                  {isEditing ? (
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleRename(level.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(level.id)}
                        className="w-full bg-gray-800 border border-gray-500 rounded px-2 py-1 text-white text-sm"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex-1 cursor-pointer" onClick={(e) => {

                      setCurrentLevel(level.id);
                      // Auto-activate grip-edit tool for layer editing
                      if (currentTool !== 'grip-edit' && onToolChange) {

                        onToolChange('grip-edit');
                      }
                      // Show toolbox when level is selected
                      handleLayeringActivation();

                      // ✅ ΧΡΗΣΗ ΥΠΑΡΧΟΝΤΟΣ EVENT SYSTEM: Dispatch layering activation
                      window.dispatchEvent(new CustomEvent('level-panel:layering-activate', {
                        detail: { levelId: level.id }
                      }));
                    }}>
                      <div className="font-medium">{level.name}</div>
                      <div className="text-xs opacity-75">
                        {hasContent ? `${scene.entities.length} στοιχεία` : 'Κενό επίπεδο'}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(level);
                        }}
                        className="p-1 text-gray-400 hover:text-white hover:bg-gray-500/20 rounded transition-colors"
                        title="Μετονομασία επιπέδου"
                      >
                        <Edit className="w-4 h-4" />
                    </button>
                    {!isOnlyLevel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLevel(level.id);
                        }}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                        title="Διαγραφή επιπέδου"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Δεν υπάρχουν επίπεδα</p>
        </div>
      )}

      <div className="space-y-2 pt-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={newLevelName}
            onChange={(e) => setNewLevelName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLevel()}
            placeholder="Όνομα νέου επιπέδου..."
            disabled={isAdding}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAddLevel}
            disabled={isAdding}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded flex items-center gap-1 transition-colors"
          >
            {isAdding ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* 🔺 ADDED: LayersSection moved from Properties */}
      {scene && Object.keys(scene.layers).length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <LayersSection
            scene={scene}
            selectedEntityIds={selectedEntityIds}
            onEntitySelectionChange={onEntitySelect}
            onLayerToggle={onLayerToggle}
            onLayerDelete={onLayerDelete}
            onLayerColorChange={onLayerColorChange}
            onLayerRename={onLayerRename}
            onLayerCreate={onLayerCreate}
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
      
      <div className="mt-4 pt-4 border-t border-gray-700 flex-1 min-h-0">
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
