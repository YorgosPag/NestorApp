import { useCallback, useRef } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('UseLayersCallbacks');
import { publishHighlight } from '../../../../events/selection-bus';
import type { SceneModel } from '../../../../types/scene';
import { setSelection } from './selection';
import { DEFAULT_LAYER_COLOR } from '../../../../config/color-config';
// ADR-129: Centralized entity layer filtering
import {
  getVisibleEntityIdsByLayer,
  getVisibleEntityIdsByLayers,
  getVisibleEntityIdsInLayers
} from '../../../../services/shared/layer-operation-utils';
// ADR-358 Phase 9D-5a: id-first reader SSoT (LayerStore lookup + legacy name fallback).
import { resolveEntityLayerName } from '../../../../stores/LayerStore';
import { useUniversalSelection } from '../../../../systems/selection';

interface LayersCallbacksProps {
  scene: SceneModel | null;
  selectedEntitiesForMerge: Set<string>;
  setSelectedEntitiesForMerge: (set: Set<string>) => void;
  selectedLayersForMerge: Set<string>;
  setSelectedLayersForMerge: (set: Set<string>) => void;
  selectedColorGroupsForMerge: Set<string>;
  setSelectedColorGroupsForMerge: (set: Set<string>) => void;
  onEntitiesMerge?: (targetEntityId: string, sourceEntityIds: string[]) => void;
  onLayersMerge?: (targetLayerName: string, sourceLayerNames: string[]) => void;
  onColorGroupsMerge?: (targetColorGroup: string, sourceColorGroups: string[]) => void;
  customColorGroupNames: Map<string, string>;
}

/**
 * Collect visible entity IDs from color groups
 * ADR-129: Helper function using centralized utilities
 */
function collectEntityIdsOfColorGroups(scene: SceneModel | null, groups: string[]): string[] {
  if (!scene?.entities) return [];

  // Find all layer names that belong to the specified color groups
  const layerNamesInGroups: string[] = [];
  if (scene.layersById) {
    Object.entries(scene.layersById).forEach(([, layer]) => {
      const colorGroup = `Color ${layer?.color ?? DEFAULT_LAYER_COLOR}`;
      if (groups.includes(colorGroup)) {
        layerNamesInGroups.push(layer.name);
      }
    });
  }

  // Use centralized filtering with visibility check
  return getVisibleEntityIdsByLayers(scene.entities, layerNamesInGroups);
}

export function useLayersCallbacks({
  scene,
  selectedEntitiesForMerge,
  setSelectedEntitiesForMerge,
  selectedLayersForMerge,
  setSelectedLayersForMerge,
  selectedColorGroupsForMerge,
  setSelectedColorGroupsForMerge,
  onEntitiesMerge,
  onLayersMerge,
  onColorGroupsMerge,
  customColorGroupNames
}: LayersCallbacksProps) {

  const universalSelection = useUniversalSelection();

  // Anchor ref for Color Group merge - κρατάει το πρώτο επιλεγμένο group ως target
  const colorGroupAnchorRef = useRef<string | null>(null);

  // Helper function to get display name for Color Group
  const getColorGroupDisplayName = useCallback((originalColorName: string) => {
    return customColorGroupNames.get(originalColorName) || originalColorName;
  }, [customColorGroupNames]);

  // Simple layer click - ADR-129: Using centralized layer filtering
  const handleLayerClick = useCallback((layerName: string) => {
    if (!scene?.entities) return;

    // Use centralized visible entity filtering
    const entityIds = getVisibleEntityIdsByLayer(scene.entities, layerName);

    // publishHighlight + merge-state via setSelection; selection SSoT via universalSelection
    setSelection(entityIds, {}, { layerName });
    universalSelection.replaceEntitySelection(entityIds);
  }, [scene, universalSelection]);

  // Handle individual entity click
  const handleEntityClick = useCallback((entityId: string, addToSelection: boolean = false) => {
    let newSelection: string[];
    if (addToSelection) {
      const currentIds = universalSelection.getSelectedEntityIds();
      newSelection = currentIds.includes(entityId)
        ? currentIds.filter(id => id !== entityId)
        : [...currentIds, entityId];
    } else {
      newSelection = [entityId];
    }

    // publishHighlight + merge-state via setSelection; selection SSoT via universalSelection
    setSelection(newSelection, {});
    universalSelection.replaceEntitySelection(newSelection);
  }, [universalSelection]);

  // Handle entity multi-selection for merge (with Ctrl+Click)
  const handleEntityMultiSelectForMerge = useCallback((entityId: string, ctrlKey: boolean) => {
    if (ctrlKey) {
      const newSelected = new Set(selectedEntitiesForMerge);
      if (selectedEntitiesForMerge.has(entityId)) {
        newSelected.delete(entityId);
      } else {
        newSelected.add(entityId);
      }
      setSelectedEntitiesForMerge(newSelected);

      // Also clear other selections when selecting entities
      setSelectedLayersForMerge(new Set());
      setSelectedColorGroupsForMerge(new Set());

      const entityIdsArray = Array.from(newSelected);
      setSelection(entityIdsArray, { setSelectedEntitiesForMerge }, { forMerge: true });
      universalSelection.replaceEntitySelection(entityIdsArray);

    } else {
      // Regular single click - use existing handler
      handleEntityClick(entityId, false);
    }
  }, [selectedEntitiesForMerge, handleEntityClick, setSelectedEntitiesForMerge, setSelectedLayersForMerge, setSelectedColorGroupsForMerge, universalSelection]);

  // Handle layer multi-selection for merge (with Ctrl+Click)
  const handleLayerMultiSelectForMerge = useCallback((layerName: string, ctrlKey: boolean) => {

    if (ctrlKey) {
      const newSelected = new Set(selectedLayersForMerge);
      if (selectedLayersForMerge.has(layerName)) {
        newSelected.delete(layerName);
      } else {
        newSelected.add(layerName);
      }
      setSelectedLayersForMerge(newSelected);

      // Καθαρίζουμε τα άλλα merge selections για συνέπεια
      setSelectedEntitiesForMerge(new Set());
      setSelectedColorGroupsForMerge(new Set());

      // ✅ UNION όλων των entity ids από τα επιλεγμένα layers - ADR-129
      if (scene?.entities) {
        const selectedLayerNames = Array.from(newSelected);
        const unionIds = getVisibleEntityIdsByLayers(scene.entities, selectedLayerNames);

        setSelection(unionIds, {}, { forMerge: false });
        universalSelection.replaceEntitySelection(unionIds);
      }
    } else {
      // Regular single click - use existing handler
      handleLayerClick(layerName);
    }
  }, [
    scene,
    selectedLayersForMerge,
    setSelectedLayersForMerge,
    setSelectedEntitiesForMerge,
    setSelectedColorGroupsForMerge,
    handleLayerClick,
    universalSelection
  ]);

  // Handle color group multi-selection for merge (with Ctrl+Click)
  const handleColorGroupMultiSelectForMerge = useCallback((colorName: string, layerNames: string[], ctrlKey: boolean) => {
    if (ctrlKey) {
      const newSelected = new Set(selectedColorGroupsForMerge);
      if (newSelected.has(colorName)) {
        newSelected.delete(colorName);
      } else {
        newSelected.add(colorName);
      }
      setSelectedColorGroupsForMerge(newSelected);

      // ορίζουμε άγκυρα στο πρώτο click
      if (!colorGroupAnchorRef.current && newSelected.has(colorName)) {
        colorGroupAnchorRef.current = colorName;
      }
      // αν ξε-επιλέξεις την άγκυρα, πάρε ως νέα άγκυρα το πρώτο από το set (αν υπάρχει)
      if (colorGroupAnchorRef.current && !newSelected.has(colorGroupAnchorRef.current)) {
        colorGroupAnchorRef.current = Array.from(newSelected)[0] ?? null;
      }

      // καθάρισε άλλα merge selections για συνέπεια
      setSelectedEntitiesForMerge(new Set());
      setSelectedLayersForMerge(new Set());

      const unionIds = collectEntityIdsOfColorGroups(scene, Array.from(newSelected));
      setSelection(unionIds, {}, { forMerge: false });
      universalSelection.replaceEntitySelection(unionIds);
    } else {
      if (!scene) return;
      const ids: string[] = [];
      // ADR-358 Phase 9D-5a: id-first resolution via LayerStore (post-rename stale-name guard).
      layerNames.forEach(L =>
        scene.entities?.forEach(e => {
          if (resolveEntityLayerName(e as { layerId?: string; layer?: string }) === L && e.visible !== false) {
            ids.push(e.id);
          }
        })
      );
      setSelection(ids, {});
      universalSelection.replaceEntitySelection(ids);
    }
  }, [
    scene,
    selectedColorGroupsForMerge,
    setSelectedColorGroupsForMerge,
    setSelectedEntitiesForMerge,
    setSelectedLayersForMerge,
    universalSelection
  ]);

  // Color Group click handler (for grips) - ✅ ένα event – όχι χιλιάδες
  // ADR-129: Using centralized layer filtering with layer visibility check
  const handleColorGroupClick = useCallback((colorName: string, layerNames: string[]) => {
    if (!scene?.entities) return;

    const ids = getVisibleEntityIdsInLayers(scene.entities, scene.layersById, layerNames);

    publishHighlight({ ids, mode: 'select' });
    universalSelection.replaceEntitySelection(ids);
  }, [scene, universalSelection]);

  // Merge functions
  const mergeSelectedEntities = useCallback(() => {

    if (selectedEntitiesForMerge.size < 2) {
      logger.warn('Χρειάζονται τουλάχιστον 2 entities για merge');
      return;
    }

    if (!scene) {
      logger.warn('Δεν υπάρχει scene για merge');
      return;
    }

    if (!onEntitiesMerge) {
      logger.warn('Δεν υπάρχει callback onEntitiesMerge! Το parent component πρέπει να το παράσχει.');
      const entitiesArray = Array.from(selectedEntitiesForMerge);
      const firstEntityId = entitiesArray[0];
      const firstEntity = scene.entities?.find(e => e.id === firstEntityId);
      const mergedEntityName = firstEntity?.name || `${firstEntity?.type} #${firstEntityId.substring(0, 8)}...`;
      void mergedEntityName;

      setSelectedEntitiesForMerge(new Set());
      return;
    }

    const entitiesArray = Array.from(selectedEntitiesForMerge);
    const firstEntityId = entitiesArray[0]; // Target entity (κρατάμε αυτήν)
    const sourceEntityIds = entitiesArray.slice(1); // Source entities (διαγράφονται)

    const firstEntity = scene.entities?.find(e => e.id === firstEntityId);

    if (!firstEntity) return;

    const mergedEntityName = firstEntity.name || `${firstEntity.type} #${firstEntity.id.substring(0, 8)}...`;
    void mergedEntityName;

    // Καλούμε το callback για την πραγματική συγχώνευση
    onEntitiesMerge(firstEntityId, sourceEntityIds);

    // Καθαρίζουμε την επιλογή
    setSelectedEntitiesForMerge(new Set());
  }, [selectedEntitiesForMerge, scene, onEntitiesMerge, setSelectedEntitiesForMerge]);

  const mergeSelectedLayers = useCallback(() => {
    if (selectedLayersForMerge.size < 2) {
      logger.warn('Χρειάζονται τουλάχιστον 2 layers για merge');
      return;
    }

    if (!onLayersMerge) return;

    const layersArray = Array.from(selectedLayersForMerge);
    const firstLayerName = layersArray[0]; // Target layer (κρατάμε αυτό)
    const sourceLayerNames = layersArray.slice(1); // Source layers (διαγράφονται)

    // Καλούμε το callback για την πραγματική συγχώνευση
    onLayersMerge(firstLayerName, sourceLayerNames);

    // Καθαρίζουμε την επιλογή
    setSelectedLayersForMerge(new Set());
  }, [selectedLayersForMerge, onLayersMerge, setSelectedLayersForMerge]);

  const mergeSelectedColorGroups = useCallback(() => {
    const groups = Array.from(selectedColorGroupsForMerge);
    if (groups.length < 2 || !scene) {
      logger.warn('Χρειάζονται τουλάχιστον 2 color groups για merge');
      return;
    }

    if (!onColorGroupsMerge) return;

    // Χρησιμοποιούμε την άγκυρα ως target, αλλιώς το πρώτο
    const targetCG = colorGroupAnchorRef.current && groups.includes(colorGroupAnchorRef.current)
      ? colorGroupAnchorRef.current
      : groups[0]; // fallback

    const sourcesCG = groups.filter(g => g !== targetCG);

    // Καλούμε το callback για την πραγματική συγχώνευση
    onColorGroupsMerge(targetCG, sourcesCG);

    // Καθαρίζουμε την επιλογή και την άγκυρα
    setSelectedColorGroupsForMerge(new Set());
    colorGroupAnchorRef.current = null;
  }, [selectedColorGroupsForMerge, scene, getColorGroupDisplayName, onColorGroupsMerge, setSelectedColorGroupsForMerge]);

  return {
    getColorGroupDisplayName,
    handleLayerClick,
    handleEntityClick,
    handleEntityMultiSelectForMerge,
    handleLayerMultiSelectForMerge,
    handleColorGroupMultiSelectForMerge,
    handleColorGroupClick,
    mergeSelectedEntities,
    mergeSelectedLayers,
    mergeSelectedColorGroups
  };
}
