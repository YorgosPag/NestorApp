'use client';

/**
 * EntityContextMenuHost — ADR-532 B4 selection-subscribed leaf.
 *
 * Owns the right-click EntityContextMenu. Self-subscribes to the selection set
 * (`useSelectedEntityIds`) and rebuilds the menu's selection-derived display flags
 * (count / join / split / isolate / layer commands) WITHOUT re-rendering the
 * CanvasSection orchestrator (ADR-040 dual-access invariant).
 *
 * CanvasSection passes only selection-AGNOSTIC inputs: the menu ref, scene, the
 * selection-agnostic `entityJoinHook` (takes ids as args), event-time handlers,
 * and command/i18n helpers. The current selection is read here at the leaf.
 */

import React, { useMemo } from 'react';
import EntityContextMenu, { type EntityContextMenuHandle } from '../../ui/components/EntityContextMenu';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { useEntityJoin } from '../../hooks/useEntityJoin';
import { useSelectedEntityIds } from '../../systems/selection/useSelectedEntities';
import { useEntityLayerCommands } from '../../hooks/canvas/useEntityLayerCommands';
import { computeEntityJoinState } from '../../hooks/canvas/entity-join-state';
import { buildEntityContextMenuProps } from './canvas-section-entity-menu';
import type { ICommand } from '../../core/commands/interfaces';

export interface EntityContextMenuHostProps {
  entityMenuRef: React.RefObject<EntityContextMenuHandle | null>;
  currentScene: DXFViewerLayoutProps['currentScene'];
  dxfScene: DxfScene | null;
  entityJoinHook: ReturnType<typeof useEntityJoin>;
  handleSmartDelete: () => void;
  onToolChange: ((tool: string) => void) | undefined;
  replaceEntitySelection: (ids: string[]) => void;
  executeCommand: (command: ICommand) => void;
  t: (key: string, opts?: { count?: number }) => string;
}

const EntityContextMenuHostInner: React.FC<EntityContextMenuHostProps> = ({
  entityMenuRef, currentScene, dxfScene, entityJoinHook, handleSmartDelete,
  onToolChange, replaceEntitySelection, executeCommand, t,
}) => {
  // ADR-532 B4 — selection-set leaf subscription (reference-stable per dxf change).
  const selectedEntityIds = useSelectedEntityIds();
  const entityJoinState = useMemo(
    () => computeEntityJoinState(entityJoinHook, selectedEntityIds),
    [entityJoinHook, selectedEntityIds],
  );
  const entityLayerCommands = useEntityLayerCommands(selectedEntityIds, dxfScene, executeCommand);
  // 🚀 PERF (2026-06-28, ADR-040): memoize the props build. `canIsolateCategory`/`canSplit` do
  // O(k×n) entity scans (`collectBimCategories`, `entities.find`); previously they re-ran on EVERY
  // parent re-render (incl. the now-fixed cursor cascade). Now only on a real selection/scene change.
  const entityMenuProps = useMemo(() => buildEntityContextMenuProps({
    selectedEntityIds, currentScene, dxfScene, entityJoinState, entityJoinHook,
    handleSmartDelete, entityMenuRef, onToolChange, replaceEntitySelection,
    executeCommand, t, entityLayerCommands,
  }), [selectedEntityIds, currentScene, dxfScene, entityJoinState, entityJoinHook,
    handleSmartDelete, entityMenuRef, onToolChange, replaceEntitySelection, executeCommand, t, entityLayerCommands]);
  return <EntityContextMenu ref={entityMenuRef as React.Ref<EntityContextMenuHandle>} {...entityMenuProps} />;
};

// 🚀 PERF (2026-06-28, ADR-040): memoized — does NOT re-render when the CanvasSection orchestrator
// re-renders with unchanged props (the menu opens imperatively via ref, so it must stay mounted —
// gate-at-mount is not an option; React.memo is the correct lever).
export const EntityContextMenuHost = React.memo(EntityContextMenuHostInner);
