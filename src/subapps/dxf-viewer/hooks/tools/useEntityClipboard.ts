/**
 * USE ENTITY CLIPBOARD — ADR-466 (Cross-Floor Copy / Paste)
 *
 * Revit/AutoCAD-style clipboard for selected entities (DXF + BIM):
 *   Ctrl+C → snapshot the current selection into `EntityClipboardStore`
 *   (switch floor)
 *   Ctrl+V → paste the snapshots IN PLACE onto the CURRENT floor (same X/Y —
 *            Revit «Aligned to Same Place»), with fresh IDs + persistence.
 *
 * Triggered via the EventBus (`clipboard:copy-requested` / `:paste-requested`)
 * emitted by the keyboard-shortcut → onAction pipeline, so the shortcut SSoT
 * (keyboard-shortcuts.ts) stays the single source of bindings.
 *
 * Clone strategy (SSoT reuse, N.0.2):
 *   - BIM entities → `buildClonesFromEntities` (kind-specific enterprise IDs +
 *     host rewire + fresh IFC GlobalId) wrapped in a `PasteEntitiesCommand` that
 *     broadcasts the Firestore create/restore/delete (ADR-363 §7.2).
 *   - DXF raw geometry → id-swap clone; persisted by scene autosave (ADR-420).
 *
 * @see systems/clipboard/EntityClipboardStore.ts
 * @see bim/transforms/bim-copy-builder.ts — clone SSoT
 * @see core/commands/entity-commands/PasteEntitiesCommand.ts
 */
'use client';

import { useCallback, useEffect } from 'react';
import { EventBus } from '../../systems/events';
import { EntityClipboardStore } from '../../systems/clipboard/EntityClipboardStore';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { buildClonesFromEntities } from '../../bim/transforms/bim-copy-builder';
import { PasteEntitiesCommand } from '../../core/commands/entity-commands/PasteEntitiesCommand';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { isBimEntity } from '../../types/entities';
import type { Entity } from '../../types/entities';
import type { ICommand, SceneEntity } from '../../core/commands/interfaces';
import type { useLevels } from '../../systems/levels';

// ── Constants ───────────────────────────────────────────────────────────────

/** Paste «Aligned to Same Place» — zero translation (Revit default for cross-floor). */
const PASTE_IN_PLACE = { kind: 'translate', delta: { x: 0, y: 0 } } as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseEntityClipboardProps {
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  /** Re-selects the freshly pasted entities (Revit feedback). */
  selectEntities: (ids: string[]) => void;
}

export interface UseEntityClipboardReturn {
  copySelection: () => void;
  pasteClipboard: () => void;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useEntityClipboard({
  selectedEntityIds,
  levelManager,
  executeCommand,
  selectEntities,
}: UseEntityClipboardProps): UseEntityClipboardReturn {
  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── Ctrl+C: snapshot the current selection ──────────────────────────────
  const copySelection = useCallback(() => {
    const floorId = levelManager.currentLevelId;
    const scene = floorId ? levelManager.getLevelScene(floorId) : null;
    if (!scene) return;
    const selected = new Set(selectedEntityIds);
    const entities = scene.entities.filter((e) => selected.has(e.id)) as unknown as SceneEntity[];
    EntityClipboardStore.copy(entities, floorId);
  }, [selectedEntityIds, levelManager]);

  // ── Ctrl+V: paste snapshots in place onto the current floor ──────────────
  const pasteClipboard = useCallback(() => {
    const sm = getSceneManager();
    if (!sm) return;
    const snapshots = EntityClipboardStore.read();
    if (snapshots.length === 0) return;

    // Split BIM (clone SSoT) vs DXF raw geometry (id-swap).
    const bimSources = snapshots.filter((e) => isBimEntity(e as unknown as Entity));
    const dxfSources = snapshots.filter((e) => !isBimEntity(e as unknown as Entity));

    const bimResult = buildClonesFromEntities(bimSources, PASTE_IN_PLACE);
    const dxfClones: SceneEntity[] = dxfSources.map(
      (e) => ({ ...e, id: generateEntityId() }) as SceneEntity,
    );

    const allClones = [...bimResult.clones, ...dxfClones];
    if (allClones.length === 0) return;

    executeCommand(new PasteEntitiesCommand(bimResult.clones, dxfClones, sm));
    selectEntities(allClones.map((c) => c.id));
  }, [getSceneManager, executeCommand, selectEntities]);

  // ── EventBus wiring (Ctrl+C / Ctrl+V → onAction → emit) ──────────────────
  useEffect(() => {
    const offCopy = EventBus.on('clipboard:copy-requested', copySelection);
    const offPaste = EventBus.on('clipboard:paste-requested', pasteClipboard);
    return () => { offCopy(); offPaste(); };
  }, [copySelection, pasteClipboard]);

  return { copySelection, pasteClipboard };
}
