'use client';

/**
 * ADR-344 Phase 6.E — Double-click → TipTap in-canvas editor.
 *
 * AutoCAD `DBLCLKEDIT = 1` parity: a double-click on a TEXT/MTEXT
 * entity opens a contextual in-canvas editor over the entity. On
 * commit, the editor's resulting DxfTextNode is diffed against the
 * pre-edit snapshot and dispatched as one CompoundCommand — a single
 * undo step regardless of how many fields changed (matches AutoCAD's
 * MTEXTEDIT undo grain).
 *
 * Returns:
 *   - `editingState`: `{ entityId, initial, anchorRect } | null`
 *   - `handleDoubleClick`: bind to canvas container
 *   - `onCommit` / `onCancel`: forward to `<TextEditorOverlay>`
 *
 * Selection-driven trigger: the hook only opens the editor when
 * `selectedEntityIds.length === 1` and the entity is a TEXT/MTEXT.
 * Picking at the click point (no prior selection) is a future
 * enhancement once the canvas exposes a public hit-test API.
 *
 * ADR-040 note: this hook holds local React state only — no
 * `useSyncExternalStore`, no high-frequency subscription. Safe to
 * mount in the orchestrator (CanvasSection).
 */

import { useCallback, useMemo, useState } from 'react';
import { CompoundCommand, type ICommand } from '../../../core/commands';
import { diffTextNode, ensureTextNode } from '../../../text-engine/edit';
import { useCurrentSceneModel } from './useCurrentSceneModel';
import { useDxfTextServices } from './useDxfTextServices';
import type { DxfTextNode } from '../../../text-engine/types';
import type { AnySceneEntity, SceneModel } from '../../../types/scene';

interface EditingState {
  readonly entityId: string;
  readonly initial: DxfTextNode;
  readonly anchorRect: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
}

interface CanvasTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface UseTextDoubleClickEditorParams {
  readonly transformRef: React.RefObject<CanvasTransform>;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly executeCommand: (cmd: ICommand) => void;
  readonly getSelectedEntityIds: () => readonly string[];
}

interface TextDoubleClickEditorApi {
  readonly editingState: EditingState | null;
  readonly handleDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  readonly onCommit: (next: DxfTextNode) => void;
  readonly onCancel: () => void;
}

function findEntity(
  scene: SceneModel | null,
  id: string,
): AnySceneEntity | null {
  if (!scene) return null;
  return scene.entities.find((e) => e.id === id) ?? null;
}

function computeAnchorRect(
  entity: AnySceneEntity,
  node: DxfTextNode,
  transform: CanvasTransform,
  container: HTMLDivElement,
): EditingState['anchorRect'] {
  const containerRect = container.getBoundingClientRect();
  const position = (entity as unknown as { position?: { x: number; y: number } })
    .position ?? { x: 0, y: 0 };
  const left = containerRect.left + position.x * transform.scale + transform.offsetX;
  const top = containerRect.top + position.y * transform.scale + transform.offsetY;
  // Approximate the overlay footprint from the first run's height — refined
  // by TipTap's intrinsic content sizing once mounted.
  const firstRun = node.paragraphs[0]?.runs[0];
  const height = firstRun && 'style' in firstRun
    ? Math.max(24, firstRun.style.height * transform.scale * 4)
    : 32;
  return { left, top, width: 200, height };
}

export function useTextDoubleClickEditor(
  params: UseTextDoubleClickEditorParams,
): TextDoubleClickEditorApi {
  const { transformRef, containerRef, executeCommand, getSelectedEntityIds } = params;
  const scene = useCurrentSceneModel();
  const services = useDxfTextServices();
  const [editingState, setEditingState] = useState<EditingState | null>(null);

  const handleDoubleClick = useCallback(
    (_event: React.MouseEvent<HTMLDivElement>) => {
      const ids = getSelectedEntityIds();
      if (ids.length !== 1) return;
      const entity = findEntity(scene, ids[0]!);
      if (!entity) return;
      if (entity.type !== 'text' && entity.type !== 'mtext') return;
      const node = ensureTextNode(
        entity as unknown as Parameters<typeof ensureTextNode>[0],
      );
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!container || !transform) return;
      const anchorRect = computeAnchorRect(entity, node, transform, container);
      setEditingState({ entityId: entity.id, initial: node, anchorRect });
    },
    [scene, getSelectedEntityIds, transformRef, containerRef],
  );

  const onCancel = useCallback(() => setEditingState(null), []);

  const onCommit = useCallback(
    (next: DxfTextNode) => {
      const state = editingState;
      if (!state || !services) {
        setEditingState(null);
        return;
      }
      const commands = diffTextNode(
        state.entityId,
        state.initial,
        next,
        services,
      );
      if (commands.length === 0) {
        setEditingState(null);
        return;
      }
      const compound =
        commands.length === 1
          ? commands[0]!
          : new CompoundCommand('Edit text', commands);
      executeCommand(compound);
      setEditingState(null);
    },
    [editingState, services, executeCommand],
  );

  return useMemo(
    () => ({ editingState, handleDoubleClick, onCommit, onCancel }),
    [editingState, handleDoubleClick, onCommit, onCancel],
  );
}
