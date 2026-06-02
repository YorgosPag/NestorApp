/**
 * USEFLOATINGPANELHANDLE HOOK
 * Extracted from FloatingPanelContainer.tsx for ΒΗΜΑ 3 refactoring
 * Imperative handle logic for parent control
 */

import { useMemo } from 'react';
import type { SceneModel } from '../../types/scene';
import { DEFAULT_LAYER_COLOR } from '../../config/color-config';
// 🏢 ENTERPRISE: Import from Single Source of Truth
import type { FloatingPanelType } from '../../types/panel-types';
import { getSceneLayerById } from '../../utils/scene-layer-utils';

/**
 * @deprecated Use FloatingPanelType instead
 */
export type SideTab = FloatingPanelType;

export interface FloatingPanelHandle {
  showTab: (t: SideTab) => void;
  expandForSelection: (ids: string[], scene?: SceneModel | null) => void;
  scrollFirstSelectedIntoView: () => void;
}

interface UseFloatingPanelHandleParams {
  expandedKeys: Set<string>;
  setActivePanel: (panel: FloatingPanelType) => void;
  setExpandedKeys: (keys: Set<string>) => void;
}

/**
 * Custom hook για το imperative handle του FloatingPanelContainer
 * Εξαγωγή από FloatingPanelContainer.tsx για καλύτερη οργάνωση
 */
export function useFloatingPanelHandle({
  expandedKeys,
  setActivePanel,
  setExpandedKeys
}: UseFloatingPanelHandleParams): FloatingPanelHandle {

  return useMemo(() => ({
    showTab: (t: SideTab) => {
      // 🏢 ENTERPRISE: SideTab is now FloatingPanelType - direct assignment
      setActivePanel(t);
    },

    expandForSelection: (ids, scene) => {
      if (!scene || !ids?.length) return;
      const next = new Set(expandedKeys);

      // Helper για ΣΤΑΘΕΡΑ keys (ίδια και στο Properties)
      const layerKey = (name: string) => `layer:${encodeURIComponent(name)}`;
      const subLayerKey = (layer: string, sub: string) =>
        `sublayer:${encodeURIComponent(layer)}:${encodeURIComponent(sub)}`;
      const colorKey = (hex: string) => `layer:${encodeURIComponent(`Color ${hex}`)}`;

      // ❶ Βρες τα groups που περιέχουν τις οντότητες
      ids.forEach(id => {
        const ent = scene.entities.find(e => e.id === id);
        if (!ent) return;

        // Κλειδί 1ου επιπέδου: Color Group (όχι layer name)
        const layerId = (ent as { layerId?: string }).layerId;
        if (layerId) {
          const layer = getSceneLayerById(scene, layerId);
          const layerName = layer?.name ?? '';
          if (layer) {
            const color = layer.color || DEFAULT_LAYER_COLOR;
            next.add(layerKey(`Color ${color}`));
          }
          if (layerName) {
            next.add(layerKey(layerName));
            const sub = ('subLayer' in ent ? ent.subLayer : 'groupKey' in ent ? ent.groupKey : undefined);
            if (sub) next.add(subLayerKey(layerName, sub as string));
          }
        }
      });

      setExpandedKeys(next);

      // ❂ Scroll στο πρώτο selected στοιχείο μέσα στη λίστα Properties
      requestAnimationFrame(() => {
        const first = ids[0];
        const el = document.querySelector(`[data-entity-id="${first}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: 'nearest' });
      });
    },

    scrollFirstSelectedIntoView: () => {
      const el = document.querySelector('[data-entity-selected="true"]') as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }), [expandedKeys, setActivePanel, setExpandedKeys]);
}