/**
 * useEntityLayerCommands — ADR-358 §5.6.bis Phase 10: Layer click-driven commands
 * (Off / Freeze / Lock) for the EntityContextMenu. Extracted from CanvasSection.tsx
 * to keep the orchestrator under the 500-line cap (CLAUDE.md N.7.1).
 */
import { useMemo } from 'react';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';

type LayerCommandProps =
  | { readonly canApplyLayerCommands: false }
  | {
      readonly canApplyLayerCommands: true;
      readonly isSystemLayer: boolean;
      readonly onLayerOff: () => void;
      readonly onLayerFreeze: () => void;
      readonly onLayerLock: () => void;
    };

interface ExecuteCommand {
  (cmd: unknown): void;
}

export function useEntityLayerCommands(
  selectedEntityIds: readonly string[],
  currentScene: DxfScene | null | undefined,
  executeCommand: ExecuteCommand,
): LayerCommandProps {
  return useMemo<LayerCommandProps>(() => {
    const firstId = selectedEntityIds[0];
    const firstEntity = firstId && currentScene
      ? currentScene.entities.find((e) => e.id === firstId)
      : null;
    const layerId = (firstEntity as { layerId?: string } | null)?.layerId ?? null;
    if (!layerId) return { canApplyLayerCommands: false };
    const layer = currentScene?.layersById?.[layerId];
    const isSystem = layer?.name === '0';
    return {
      canApplyLayerCommands: true,
      isSystemLayer: isSystem,
      onLayerOff: () => {
        const { LayerOffCommand } = require('../../core/commands/layer');
        executeCommand(new LayerOffCommand({ layerId }));
      },
      onLayerFreeze: () => {
        const { LayerFreezeCommand } = require('../../core/commands/layer');
        executeCommand(new LayerFreezeCommand({ layerId }));
      },
      onLayerLock: () => {
        const { LayerLockCommand } = require('../../core/commands/layer');
        executeCommand(new LayerLockCommand({ layerId }));
      },
    };
  }, [selectedEntityIds, currentScene, executeCommand]);
}
