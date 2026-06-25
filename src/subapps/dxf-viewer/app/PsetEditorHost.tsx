'use client';

/**
 * IFC Pset Editor Host (ADR-369 §9 Q8.2)
 *
 * Subscribes to `bim:pset-editor-open` EventBus event, resolves the target
 * entity, and renders `PsetEditorDialog`. On save → dispatches
 * `UpdateEntityPsetCommand` (undoable, atomic). On cancel → discards draft.
 *
 * Mirrors `SlabOpeningStackHost` pattern: mounted once in `DxfViewerTopBar`,
 * zero high-frequency subscriptions (CHECK 6B/6C compliant).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §Q8.2
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { useLevels } from '../systems/levels';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands';
import { UpdateEntityPsetCommand } from '../core/commands/entity-commands/UpdateEntityPsetCommand';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import type { IfcPropertySet, IfcEntityMixin } from '../bim/types/ifc-entity-mixin';
import type { AnySceneEntity } from '../types/entities';
import { PsetEditorDialog } from '../ui/components/bim-pset/PsetEditorDialog';
import type { BimPsetEntityType } from '../ui/components/bim-pset/pset-templates';

// ─── Props ────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene'
>;

export interface PsetEditorHostProps {
  readonly levelManager: LevelManagerLike;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface DialogState {
  open: boolean;
  entityId: string | null;
  levelId: string | null;
  entityType: BimPsetEntityType | null;
  currentPset: IfcPropertySet | undefined;
}

const CLOSED: DialogState = {
  open: false,
  entityId: null,
  levelId: null,
  entityType: null,
  currentPset: undefined,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PsetEditorHost({ levelManager }: PsetEditorHostProps): React.ReactElement | null {
  const [dialogState, setDialogState] = useState<DialogState>(CLOSED);
  const { execute: executeCommand } = useCommandHistory();

  useEffect(() => {
    return EventBus.on('bim:pset-editor-open', ({ entityId, levelId, entityType }) => {
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const entity = scene.entities.find((e: AnySceneEntity) => e.id === entityId);
      if (!entity) return;
      const currentPset = ('pset' in entity)
        ? (entity as AnySceneEntity & Pick<IfcEntityMixin, 'pset'>).pset
        : undefined;
      setDialogState({
        open: true,
        entityId,
        levelId,
        entityType: entityType as BimPsetEntityType,
        currentPset,
      });
    });
  }, [levelManager]);

  const handleSave = useCallback(
    (nextPset: IfcPropertySet | undefined): void => {
      const { entityId, levelId, currentPset } = dialogState;
      if (!entityId || !levelId) {
        setDialogState(CLOSED);
        return;
      }
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      executeCommand(new UpdateEntityPsetCommand(entityId, nextPset, currentPset, sm));
      setDialogState(CLOSED);
    },
    [dialogState, levelManager, executeCommand],
  );

  const handleCancel = useCallback((): void => {
    setDialogState(CLOSED);
  }, []);

  return (
    <PsetEditorDialog
      open={dialogState.open}
      entityId={dialogState.entityId}
      entityType={dialogState.entityType}
      currentPset={dialogState.currentPset}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
