'use client';

/**
 * ADR-376 Phase C.1 — Opening tag drag interaction (React DOM glue).
 *
 * Mounts pointer event listeners on the viewport element + drives the
 * `OpeningTagDragController` FSM. Optimistically patches the scene during
 * drag so the pill follows the cursor at 60 fps, then commits the final
 * `tagOffset` via `UpdateOpeningParamsCommand` (undoable + auto-save).
 *
 * Lifecycle rules (ADR-040 micro-leaf compliance):
 *   - Mounted inside a leaf component (NOT the orchestrator).
 *   - DOM listeners on the viewport element only, removed on unmount.
 *   - Uses `setPointerCapture` so a moving cursor outside the canvas keeps
 *     firing events until release.
 *   - During an active drag, `pointerdown` consumed via stopPropagation so
 *     the canvas selection click handler does not fire.
 *
 * @module hooks/canvas/use-opening-tag-drag-interaction
 */

import { useEffect, useRef } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import type { OpeningEntity, OpeningParams } from '../../bim/types/opening-types';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import {
  OpeningTagDragController,
  hitTestTag,
  type TagDragOffset,
} from '../../bim/services/opening-tag-drag-controller';
import { UpdateOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { useCommandHistory } from '../../core/commands';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';

export interface UseOpeningTagDragInteractionParams {
  readonly transform: ViewTransform;
  readonly getViewportElement: () => HTMLElement | null;
  readonly getCurrentLevelId: () => string | null;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
}

function isOpeningEntity(e: AnySceneEntity): e is OpeningEntity {
  return (e as { type?: string }).type === 'opening';
}

function patchOpeningOffset(
  scene: SceneModel,
  openingId: string,
  nextOffset: TagDragOffset | undefined,
): SceneModel | null {
  let changed = false;
  const entities = scene.entities.map((e) => {
    if (e.id !== openingId || !isOpeningEntity(e)) return e;
    const params = e.params;
    if ((params.tagOffset ?? undefined) === undefined && nextOffset === undefined) return e;
    changed = true;
    if (nextOffset === undefined) {
      const { tagOffset: _omit, ...rest } = params;
      void _omit;
      return { ...e, params: rest as OpeningParams } as OpeningEntity;
    }
    return { ...e, params: { ...params, tagOffset: nextOffset } as OpeningParams } as OpeningEntity;
  });
  if (!changed) return null;
  return { ...scene, entities };
}

export function useOpeningTagDragInteraction(
  params: UseOpeningTagDragInteractionParams,
): void {
  const {
    transform,
    getViewportElement,
    getCurrentLevelId,
    getLevelScene,
    setLevelScene,
  } = params;

  const { execute: executeCommand } = useCommandHistory();

  // Refs that mirror props so the event handlers always see latest values
  // without forcing an effect teardown / re-mount on every prop change.
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const executeRef = useRef(executeCommand);
  executeRef.current = executeCommand;
  const getCurrentLevelIdRef = useRef(getCurrentLevelId);
  getCurrentLevelIdRef.current = getCurrentLevelId;
  const getLevelSceneRef = useRef(getLevelScene);
  getLevelSceneRef.current = getLevelScene;
  const setLevelSceneRef = useRef(setLevelScene);
  setLevelSceneRef.current = setLevelScene;

  const controllerRef = useRef<OpeningTagDragController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = new OpeningTagDragController();
  }

  // Original params snapshot — used to feed UpdateOpeningParamsCommand on
  // drag-end so undo can restore the pre-drag state cleanly.
  const startParamsRef = useRef<OpeningParams | null>(null);
  // Last optimistic offset patched into the scene (replayed on commit so the
  // command captures the exact value the user saw on release).
  const lastOffsetRef = useRef<TagDragOffset | null>(null);
  // RAF coalescing — multiple pointermove events / frame collapse to one patch.
  const rafIdRef = useRef<number | null>(null);
  const pendingPatchRef = useRef<{ openingId: string; offset: TagDragOffset } | null>(null);

  useEffect(() => {
    const el = getViewportElement();
    if (!el) return;

    function getOpenings(): readonly OpeningEntity[] {
      const levelId = getCurrentLevelIdRef.current();
      if (!levelId) return [];
      const scene = getLevelSceneRef.current(levelId);
      if (!scene) return [];
      return scene.entities.filter(isOpeningEntity);
    }

    function flushPatch(): void {
      rafIdRef.current = null;
      const pending = pendingPatchRef.current;
      pendingPatchRef.current = null;
      if (!pending) return;
      const levelId = getCurrentLevelIdRef.current();
      if (!levelId) return;
      const scene = getLevelSceneRef.current(levelId);
      if (!scene) return;
      const next = patchOpeningOffset(scene, pending.openingId, pending.offset);
      if (next) setLevelSceneRef.current(levelId, next);
    }

    function schedulePatch(openingId: string, offset: TagDragOffset): void {
      pendingPatchRef.current = { openingId, offset };
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(flushPatch);
    }

    function onPointerDown(e: PointerEvent): void {
      // Buttons we react to: 0 = left (start drag), 2 = right (reset offset).
      if (e.button !== 0 && e.button !== 2) return;
      const rect = el!.getBoundingClientRect();
      const hit = hitTestTag({
        openings: getOpenings(),
        transform: transformRef.current,
        viewport: { width: rect.width, height: rect.height },
        canvasRect: { left: rect.left, top: rect.top },
        clientX: e.clientX,
        clientY: e.clientY,
      });
      if (!hit) return;

      // Consume the event so neither the canvas selection click nor the
      // browser context-menu fires for taps directly on a tag pill.
      e.stopPropagation();
      e.preventDefault();

      if (e.button === 2) {
        // Right-click on tag → immediate Reset Position (no menu). Matches
        // Q4 industry-style UX: power-user quick action, redundant with the
        // ribbon button which lives on the contextual opening tab.
        if (hit.opening.params.tagOffset === undefined) return;
        const levelId = getCurrentLevelIdRef.current();
        if (!levelId) return;
        const { tagOffset: _omit, ...rest } = hit.opening.params;
        void _omit;
        const sm = createLevelSceneManagerAdapter(
          getLevelSceneRef.current,
          setLevelSceneRef.current,
          levelId,
        );
        executeRef.current(
          new UpdateOpeningParamsCommand(
            hit.opening.id,
            rest as OpeningParams,
            hit.opening.params,
            sm,
            false,
          ),
        );
        return;
      }

      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      controllerRef.current!.startDrag(hit, canvasX, canvasY);
      startParamsRef.current = hit.opening.params;
      lastOffsetRef.current = hit.startOffset;

      try {
        el!.setPointerCapture(e.pointerId);
      } catch {
        /* setPointerCapture can fail on detached elements — non-fatal. */
      }
    }

    function onContextMenu(e: MouseEvent): void {
      // Stop the browser context menu when the cursor is over a tag pill —
      // the right-click handler above has already issued the reset command.
      const rect = el!.getBoundingClientRect();
      const hit = hitTestTag({
        openings: getOpenings(),
        transform: transformRef.current,
        viewport: { width: rect.width, height: rect.height },
        canvasRect: { left: rect.left, top: rect.top },
        clientX: e.clientX,
        clientY: e.clientY,
      });
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
    }

    function onPointerMove(e: PointerEvent): void {
      const controller = controllerRef.current!;
      if (controller.getState() !== 'dragging') return;
      const rect = el!.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const offset = controller.updateDrag(canvasX, canvasY, transformRef.current);
      if (!offset) return;
      const id = controller.getActiveOpeningId();
      if (!id) return;
      lastOffsetRef.current = offset;
      schedulePatch(id, offset);
    }

    function commit(): void {
      const controller = controllerRef.current!;
      if (controller.getState() !== 'dragging') return;
      const id = controller.getActiveOpeningId();
      const start = startParamsRef.current;
      const finalOffset = lastOffsetRef.current;
      controller.endDrag(0, 0, transformRef.current);
      startParamsRef.current = null;
      lastOffsetRef.current = null;
      if (!id || !start || !finalOffset) return;
      const levelId = getCurrentLevelIdRef.current();
      if (!levelId) return;
      // Flush any queued RAF patch immediately so the scene reflects the
      // final offset before the undoable command runs.
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        const pending = pendingPatchRef.current;
        pendingPatchRef.current = null;
        if (pending) {
          const scene = getLevelSceneRef.current(levelId);
          if (scene) {
            const next = patchOpeningOffset(scene, pending.openingId, pending.offset);
            if (next) setLevelSceneRef.current(levelId, next);
          }
        }
      }
      const sm = createLevelSceneManagerAdapter(
        getLevelSceneRef.current,
        setLevelSceneRef.current,
        levelId,
      );
      const nextParams: OpeningParams = { ...start, tagOffset: finalOffset } as OpeningParams;
      executeRef.current(
        new UpdateOpeningParamsCommand(id, nextParams, start, sm, false),
      );
    }

    function onPointerUp(e: PointerEvent): void {
      if (controllerRef.current!.getState() !== 'dragging') return;
      try {
        el!.releasePointerCapture(e.pointerId);
      } catch {
        /* releasePointerCapture can fail when capture was lost — non-fatal. */
      }
      commit();
    }

    function onPointerCancel(): void {
      const controller = controllerRef.current!;
      if (controller.getState() !== 'dragging') return;
      const id = controller.getActiveOpeningId();
      const start = startParamsRef.current;
      controller.cancelDrag();
      startParamsRef.current = null;
      lastOffsetRef.current = null;
      // Rollback the optimistic scene patch to the pre-drag tagOffset.
      if (!id || !start) return;
      const levelId = getCurrentLevelIdRef.current();
      if (!levelId) return;
      const scene = getLevelSceneRef.current(levelId);
      if (!scene) return;
      const next = patchOpeningOffset(scene, id, start.tagOffset);
      if (next) setLevelSceneRef.current(levelId, next);
    }

    // `capture: true` so the listener fires before any nested element's
    // click handlers (canvas pick path). Without capture the pill drag and
    // selection click race for the gesture.
    el.addEventListener('pointerdown', onPointerDown, { capture: true });
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('contextmenu', onContextMenu, { capture: true });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown, { capture: true } as EventListenerOptions);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('contextmenu', onContextMenu, { capture: true } as EventListenerOptions);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [getViewportElement]);
}
