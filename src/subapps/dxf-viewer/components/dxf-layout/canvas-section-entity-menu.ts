/**
 * Entity context-menu props builder — extracted from CanvasSection to keep that
 * orchestrator under the 500-line budget (N.7.1). Pure construction of the
 * EntityContextMenu config object from already-resolved render state.
 *
 * ADR-040-safe: contains only event handlers (onClick callbacks), NO
 * useSyncExternalStore subscriptions — store reads happen at event time via
 * getState(), never during render.
 *
 * ADR-358 §5.6.bis — Isolate Element/Category. ADR-445 — Select Similar by colour
 * (objectStyles threaded so per-category structural colours match).
 */
import type React from 'react';
import type { EntityContextMenuHandle } from '../../ui/components/EntityContextMenu';
import type { ToolType } from '../../ui/toolbar/types';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { useEntityLayerCommands } from '../../hooks/canvas/useEntityLayerCommands';
import { isWallEntity } from '../../types/entities';
import { findEntitiesWithSimilarColor } from '../../systems/selection/select-similar-by-color';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { EntityIsolateCommand, CategoryIsolateCommand } from '../../core/commands/layer';
import { collectBimCategories } from '../../bim/visibility/resolve-entity-bim-category';

interface EntityContextMenuPropsDeps {
  selectedEntityIds: string[];
  currentScene: DXFViewerLayoutProps['currentScene'];
  dxfScene: DxfScene | null;
  entityJoinState: { canJoin: boolean; joinResultLabel?: string };
  entityJoinHook: { joinEntities: (ids: string[]) => void };
  handleSmartDelete: () => void;
  entityMenuRef: React.RefObject<EntityContextMenuHandle | null>;
  onToolChange: ((tool: string) => void) | undefined;
  replaceEntitySelection: (ids: string[]) => void;
  executeCommand: (command: EntityIsolateCommand | CategoryIsolateCommand) => void;
  t: (key: string, opts?: { count?: number }) => string;
  entityLayerCommands: ReturnType<typeof useEntityLayerCommands>;
}

/**
 * Builds the `entityMenu` prop object for CanvasSectionOverlays. Recomputed each
 * render (identical semantics to the former inline literal — no memo, no stale
 * closures).
 */
export function buildEntityContextMenuProps(deps: EntityContextMenuPropsDeps) {
  const {
    selectedEntityIds, currentScene, dxfScene, entityJoinState, entityJoinHook,
    handleSmartDelete, entityMenuRef, onToolChange, replaceEntitySelection,
    executeCommand, t, entityLayerCommands,
  } = deps;
  return {
    selectedCount: selectedEntityIds.length,
    canJoin: entityJoinState.canJoin,
    joinResultLabel: entityJoinState.joinResultLabel,
    onJoin: () => entityJoinHook.joinEntities(selectedEntityIds),
    onDelete: () => handleSmartDelete(),
    onCancel: () => entityMenuRef.current?.close(),
    canSplit: selectedEntityIds.length === 1 && !!currentScene?.entities.find((x) => x.id === selectedEntityIds[0] && isWallEntity(x)),
    onSplit: () => { entityMenuRef.current?.close(); onToolChange?.('wall-split' as ToolType); },
    canSelectSimilar: selectedEntityIds.length >= 1,
    onSelectSimilar: () => {
      entityMenuRef.current?.close();
      if (!currentScene || selectedEntityIds.length === 0) return;
      const ids = findEntitiesWithSimilarColor(selectedEntityIds[0], currentScene.entities, currentScene.layersById, useBimRenderSettingsStore.getState().objectStyles);
      if (ids.length > 0) replaceEntitySelection(ids);
    },
    canIsolateEntity: selectedEntityIds.length >= 1,
    onIsolateEntity: () => {
      entityMenuRef.current?.close();
      if (selectedEntityIds.length === 0) return;
      executeCommand(new EntityIsolateCommand({ targetEntityIds: selectedEntityIds, category: t('layer.isolate.statusBadge.entityCount', { count: selectedEntityIds.length }) }));
    },
    canIsolateCategory: collectBimCategories(selectedEntityIds, dxfScene?.entities).length > 0,
    onIsolateCategory: () => {
      entityMenuRef.current?.close();
      const cats = collectBimCategories(selectedEntityIds, dxfScene?.entities);
      if (cats.length === 0) return;
      executeCommand(new CategoryIsolateCommand({ targetCategories: cats, category: t('layer.isolate.statusBadge.categoryCount', { count: cats.length }) }));
    },
    ...entityLayerCommands,
  };
}
