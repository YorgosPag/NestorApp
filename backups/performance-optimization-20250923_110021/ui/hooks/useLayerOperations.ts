/**
 * USELAYEROPERATIONS HOOK
 * Extracted from FloatingPanelContainer.tsx for ΒΗΜΑ 2 refactoring
 * Centralized layer and entity operations callbacks
 */

import { useMemo } from 'react';
import type { SceneModel } from '../../types/scene';
import { LayerOperationsService } from '../../services/LayerOperationsService';
import { EntityMergeService } from '../../services/EntityMergeService';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { publishHighlight } from '../../events/selection-bus';
import { handleLayerServiceResult } from '../utils/selection-update-utils';

export interface LayerOperationsCallbacks {
  // Layer operations
  handleLayerToggle: (layerName: string, visible: boolean) => void;
  handleLayerDelete: (layerName: string) => Promise<void>;
  handleLayerColorChange: (layerName: string, color: string) => void;
  handleLayerRename: (oldName: string, newName: string) => void;
  handleLayerCreate: (name: string, color: string) => void;
  handleLayersMerge: (targetLayerName: string, sourceLayerNames: string[]) => Promise<void>;

  // Entity operations
  handleEntityToggle: (entityId: string, visible: boolean) => void;
  handleEntityDelete: (entityId: string) => Promise<void>;
  handleEntityColorChange: (entityId: string, color: string) => void;
  handleEntityRename: (entityId: string, newName: string) => void;
  handleEntitiesMerge: (targetEntityId: string, sourceEntityIds: string[]) => Promise<void>;

  // Color group operations
  handleColorGroupToggle: (colorGroupName: string, layersInGroup: string[], visible: boolean) => void;
  handleColorGroupDelete: (colorGroupName: string, layersInGroup: string[]) => void;
  handleColorGroupColorChange: (colorGroupName: string, layersInGroup: string[], color: string) => void;
  handleColorGroupsMerge: (targetColorGroup: string, sourceColorGroups: string[]) => Promise<void>;
}

interface UseLayerOperationsParams {
  scene: SceneModel | null;
  currentLevelId: string | null;
  selectedEntityIds: string[];
  onEntitySelect: (ids: string[]) => void;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/**
 * Custom hook για όλες τις layer και entity operations του FloatingPanelContainer
 * Εξαγωγή από FloatingPanelContainer.tsx για καλύτερη οργάνωση
 */
export function useLayerOperations({
  scene,
  currentLevelId,
  selectedEntityIds,
  onEntitySelect,
  setLevelScene
}: UseLayerOperationsParams): LayerOperationsCallbacks {

  // ✅ Memoized services to prevent re-creation on every render
  const layerService = useMemo(() => new LayerOperationsService(), []);
  const entityService = useMemo(() => new EntityMergeService(), []);

  // ✅ Confirmation dialogs
  const { showConfirmDialog } = useNotifications();

  // ===== LAYER OPERATIONS =====

  const handleLayerToggle = (layerName: string, visible: boolean) => {
    if (!scene || !currentLevelId) return;
    const result = layerService.toggleLayerVisibility(layerName, visible, scene);
    if (result.success) {
      setLevelScene(currentLevelId, result.updatedScene);
    }
  };

  const handleLayerDelete = async (layerName: string) => {
    if (!scene || !currentLevelId || !scene.entities) return;

    const entityCount = scene.entities.filter(entity => entity.layer === layerName).length;
    const confirmed = await showConfirmDialog({
      title: 'Διαγραφή Layer',
      message: `Θέλετε να διαγράψετε το layer "${layerName}" και ${entityCount} entities;`,
      type: 'warning'
    });
    if (!confirmed) return;

    const result = layerService.deleteLayer(layerName, scene);
    handleLayerServiceResult(result, selectedEntityIds, onEntitySelect, setLevelScene, currentLevelId);
  };

  const handleLayerColorChange = (layerName: string, color: string) => {
    if (!scene || !currentLevelId) return;
    const result = layerService.changeLayerColor(layerName, color, scene);
    if (result.success) {
      setLevelScene(currentLevelId, result.updatedScene);
    }
  };

  const handleLayerRename = (oldName: string, newName: string) => {
    if (!scene || !currentLevelId) return;
    const result = layerService.renameLayer(oldName, newName, scene);
    if (!result.success && result.message) {
      alert(result.message);
      return;
    }
    if (result.success) {
      setLevelScene(currentLevelId, result.updatedScene);
    }
  };

  const handleLayerCreate = (name: string, color: string) => {
    if (!scene || !currentLevelId) return;
    const result = layerService.createLayer({ name, color }, scene);
    if (!result.success && result.message) {
      alert(result.message);
      return;
    }
    if (result.success) {
      setLevelScene(currentLevelId, result.updatedScene);
    }
  };

  const handleLayersMerge = async (targetLayerName: string, sourceLayerNames: string[]) => {
    if (!scene || !currentLevelId) return;

    const confirmed = await showConfirmDialog({
      title: 'Συγχώνευση Layers',
      message: `Θέλετε να συγχωνεύσετε τα layers [${sourceLayerNames.join(', ')}] στο "${targetLayerName}";`,
      type: 'info'
    });
    if (!confirmed) return;

    const result = layerService.mergeLayers(targetLayerName, sourceLayerNames, scene);
    if (result.success) {
      setLevelScene(currentLevelId, result.updatedScene);
    }
  };

  // ===== ENTITY OPERATIONS =====

  const handleEntityToggle = (entityId: string, visible: boolean) => {
    if (!scene || !currentLevelId || !scene.entities) return;
    const updatedScene = {
      ...scene,
      entities: scene.entities.map(entity =>
        entity.id === entityId ? { ...entity, visible } : entity
      )
    };
    setLevelScene(currentLevelId, updatedScene);
  };

  const handleEntityDelete = async (entityId: string) => {
    if (!scene || !currentLevelId || !scene.entities) return;

    const entity = scene.entities.find(e => e.id === entityId);
    if (!entity) return;

    const entityName = entity.name || entity.type || `Entity ${entityId.substring(0, 8)}`;
    const confirmed = await showConfirmDialog({
      title: 'Διαγραφή Entity',
      message: `Θέλετε να διαγράψετε το entity "${entityName}";`,
      type: 'warning'
    });
    if (!confirmed) return;

    const updatedScene = {
      ...scene,
      entities: scene.entities.filter(entity => entity.id !== entityId)
    };

    const newSelection = selectedEntityIds.filter(id => id !== entityId);
    if (newSelection.length !== selectedEntityIds.length) {
      onEntitySelect(newSelection);
    }
    setLevelScene(currentLevelId, updatedScene);
  };

  const handleEntityColorChange = (entityId: string, color: string) => {
    if (!scene || !currentLevelId || !scene.entities) return;

    const entity = scene.entities.find(e => e.id === entityId);
    if (!entity) return;

    const existingLayerWithColor = Object.keys(scene.layers).find(layerName =>
      scene.layers[layerName].color === color
    );

    let targetLayerName = existingLayerWithColor;
    let updatedLayers = { ...scene.layers };

    if (!existingLayerWithColor) {
      const newLayerName = entity.name || `Layer_${color.replace('#', '')}`;
      targetLayerName = newLayerName;

      let counter = 1;
      while (updatedLayers[targetLayerName]) {
        targetLayerName = `${newLayerName}_${counter}`;
        counter++;
      }

      updatedLayers[targetLayerName] = {
        name: targetLayerName,
        color: color,
        visible: true,
        frozen: false
      };
    }

    const updatedScene = {
      ...scene,
      layers: updatedLayers,
      entities: scene.entities.map(e =>
        e.id === entityId ? {
          ...e,
          color: color,
          layer: targetLayerName
        } : e
      )
    };

    setLevelScene(currentLevelId, updatedScene);
  };

  const handleEntityRename = (entityId: string, newName: string) => {
    if (!scene || !currentLevelId || !scene.entities) return;
    const updatedScene = {
      ...scene,
      entities: scene.entities.map(entity =>
        entity.id === entityId ? { ...entity, name: newName } : entity
      )
    };
    setLevelScene(currentLevelId, updatedScene);
  };

  const handleEntitiesMerge = async (targetEntityId: string, sourceEntityIds: string[]) => {
    if (!scene || !currentLevelId || !scene.entities) return;

    const targetEntity = scene.entities.find(e => e.id === targetEntityId);
    if (!targetEntity) return;

    const sourceNames = scene.entities
      .filter(e => sourceEntityIds.includes(e.id))
      .map(e => e.name || e.type || e.id.substring(0, 8));

    const confirmed = await showConfirmDialog({
      title: 'Συγχώνευση Entities',
      message: `Θέλετε να συγχωνεύσετε τα entities [${sourceNames.join(', ')}] στο "${targetEntity.name || targetEntity.type || 'Entity'}";`,
      type: 'info'
    });
    if (!confirmed) return;

    const result = await entityService.mergeEntities({
      targetEntityId,
      sourceEntityIds,
      scene,
      currentLevelId
    });

    if (result.success) {
      if (result.newEntityId) {
        onEntitySelect([result.newEntityId]);
        publishHighlight({ ids: [result.newEntityId] });
      } else {
        onEntitySelect([targetEntityId]);
        publishHighlight({ ids: [targetEntityId] });
      }
      setLevelScene(currentLevelId, result.updatedScene);
    } else if (result.message) {
      alert(result.message);
    }
  };

  // ===== COLOR GROUP OPERATIONS =====

  const handleColorGroupToggle = (colorGroupName: string, layersInGroup: string[], visible: boolean) => {
    if (!scene || !currentLevelId) return;
    const result = layerService.toggleColorGroup(colorGroupName, layersInGroup, visible, scene);
    if (result.success) {
      setLevelScene(currentLevelId, result.updatedScene);
    }
  };

  const handleColorGroupDelete = (colorGroupName: string, layersInGroup: string[]) => {
    if (!scene || !currentLevelId) return;
    const result = layerService.deleteColorGroup(colorGroupName, layersInGroup, scene);
    handleLayerServiceResult(result, selectedEntityIds, onEntitySelect, setLevelScene, currentLevelId);
  };

  const handleColorGroupColorChange = (colorGroupName: string, layersInGroup: string[], color: string) => {
    if (!scene || !currentLevelId) return;
    const result = layerService.changeColorGroupColor(colorGroupName, layersInGroup, color, scene);
    if (result.success) {
      setLevelScene(currentLevelId, result.updatedScene);
    }
  };

  const handleColorGroupsMerge = async (targetColorGroup: string, sourceColorGroups: string[]) => {
    if (!scene || !currentLevelId) return;

    const confirmed = await showConfirmDialog({
      title: 'Συγχώνευση Color Groups',
      message: `Θέλετε να συγχωνεύσετε τα color groups [${sourceColorGroups.join(', ')}] στο "${targetColorGroup}";`,
      type: 'info'
    });
    if (!confirmed) return;

    const result = layerService.mergeColorGroups(targetColorGroup, sourceColorGroups, scene);
    if (result.success) {
      setLevelScene(currentLevelId, result.updatedScene);
    }
  };

  return {
    // Layer operations
    handleLayerToggle,
    handleLayerDelete,
    handleLayerColorChange,
    handleLayerRename,
    handleLayerCreate,
    handleLayersMerge,

    // Entity operations
    handleEntityToggle,
    handleEntityDelete,
    handleEntityColorChange,
    handleEntityRename,
    handleEntitiesMerge,

    // Color group operations
    handleColorGroupToggle,
    handleColorGroupDelete,
    handleColorGroupColorChange,
    handleColorGroupsMerge,
  };
}