'use client';

/**
 * ADR-652 M6 — «Δημιουργία Block» host: ενορχηστρώνει build → register → persist → (προαιρετικά)
 * replace-with-instance, όταν ο ribbon interceptor σημάνει αίτημα.
 *
 * **Gate-at-mount**: ο εξωτερικός wrapper ακούει ΜΟΝΟ το ελαφρύ request-store· ο βαρύς inner
 * (palette hook + command history) mount-άρεται μόνο όσο υπάρχει ενεργό αίτημα (ίδιο μοτίβο με τους
 * υπόλοιπους gate-at-mount hosts στο `DxfViewerDialogs`).
 *
 * Confirm:
 *  1. build def από την επιλογή (pure {@link buildBlockDefFromSelection}) — validation gate.
 *  2. αν «αντικατάσταση με instance» → undoable {@link CreateBlockFromSelectionCommand} (η επιλογή
 *     γίνεται BlockEntity· reselect του instance).
 *  3. persist στην ΙΔΙΩΤΙΚΗ βιβλιοθήκη + register στο in-session registry ({@link useBlockLibraryPalette}
 *     `saveNewBlockFromDef`) — η ΙΔΙΑ διαδρομή αποθήκευσης με το palette (κανένα δεύτερο service).
 *
 * @see ../../../systems/block/create-block-request-store.ts — το signal (interceptor → host)
 * @see ./CreateBlockDialog.tsx — η φόρμα (pure UI)
 */

import React, { useCallback, useEffect, useState } from 'react';
import i18next from 'i18next';
import { useCreateBlockRequest, clearCreateBlockRequest } from '../../../systems/block/create-block-request-store';
import { buildBlockDefFromSelection } from '../../../systems/block/build-block-def-from-selection';
import {
  armPickBasePoint,
  disarmPickBasePoint,
  clearPickBasePoint,
  usePickBasePointState,
} from '../../../systems/block/pick-base-point-store';
import { CreateBlockFromSelectionCommand } from '../../../core/commands/entity-commands/CreateBlockFromSelectionCommand';
import { useCommandHistory } from '../../../core/commands';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { SelectedEntitiesStore } from '../../../systems/selection';
import { toolHintOverrideStore } from '../../../hooks/toolHintOverrideStore';
import { useEscapeHandler } from '../../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../../systems/escape-bus/escape-priority';
import { isBlockNameTaken } from '../../../bim/block-library/block-palette-entries';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { useLevels } from '../../../systems/levels';
import { CreateBlockDialog, type CreateBlockFormValues } from './CreateBlockDialog';
import { useBlockLibraryPalette } from './hooks/useBlockLibraryPalette';

type LevelManager = ReturnType<typeof useLevels>;

export interface CreateBlockDialogHostProps {
  readonly levelManager: LevelManager;
  /** ADR-652 M3 — ενεργό έργο (περνά στο palette hook· εδώ δεν αλλάζει το scope, μένει `user`). */
  readonly projectId?: string;
}

/** Gate-at-mount: ο βαρύς inner ζει μόνο όσο υπάρχει αίτημα «Δημιουργία Block». */
export const CreateBlockDialogHost: React.FC<CreateBlockDialogHostProps> = (props) => {
  const pendingIds = useCreateBlockRequest();
  if (pendingIds === null) return null;
  return <CreateBlockDialogInner pendingIds={pendingIds} {...props} />;
};

interface CreateBlockDialogInnerProps extends CreateBlockDialogHostProps {
  readonly pendingIds: readonly string[];
}

const CreateBlockDialogInner: React.FC<CreateBlockDialogInnerProps> = ({
  pendingIds,
  levelManager,
  projectId,
}) => {
  const palette = useBlockLibraryPalette(projectId);
  const { execute: executeCommand } = useCommandHistory();
  const [saving, setSaving] = useState(false);
  // ADR-652 M6 — «Specify base point»: user-picked base (world), ή null = αυτόματο AABB min-corner.
  const [pickedBase, setPickedBase] = useState<Point2D | null>(null);
  const pick = usePickBasePointState();

  // Υιοθέτησε ένα captured σημείο (one-shot) → πίσω στον διάλογο με το base συμπληρωμένο.
  useEffect(() => {
    if (pick.point) {
      setPickedBase(pick.point);
      clearPickBasePoint();
    }
  }, [pick.point]);

  // Όσο armed: banner hint στο status bar. Ο διάλογος κρύβεται μέσω `open={!armed}`
  // ώστε το modal overlay να μη μπλοκάρει τα κλικ στον καμβά.
  useEffect(() => {
    if (!pick.armed) return;
    toolHintOverrideStore.setOverride(i18next.t('tool-hints:createBlock.pickBasePoint'));
    return () => {
      toolHintOverrideStore.setOverride(null);
    };
  }, [pick.armed]);

  // Esc → ακύρωση του pick-base-point μέσω του κεντρικού Escape bus (ADR-364), όχι ιδιωτικού
  // window listener. Priority MODAL_DIALOG: όσο armed, η ακύρωση της pick session προηγείται
  // κάθε tool/selection handler.
  useEscapeHandler(
    pick.armed
      ? {
          id: 'create-block-pick-base-point',
          priority: ESC_PRIORITY.MODAL_DIALOG,
          canHandle: () => true,
          handle: () => {
            disarmPickBasePoint();
            return true;
          },
        }
      : null,
  );

  // Safety net: αν ο host unmount-άρει (αίτημα καθαρίστηκε) ενώ armed, μη μείνει «ζωντανό» το pick
  // mode στον καμβά — reset ολόκληρης της pick session.
  useEffect(() => () => {
    disarmPickBasePoint();
    clearPickBasePoint();
  }, []);

  const isNameTaken = useCallback(
    (name: string) => isBlockNameTaken(palette.entries, name, ''),
    [palette.entries],
  );

  /** Οι επιλεγμένες οντότητες του τρέχοντος level (WBLOCK path + validation gate). */
  const readSelectedEntities = useCallback((): Entity[] => {
    const levelId = levelManager.currentLevelId;
    const scene = levelId ? levelManager.getLevelScene(levelId) : null;
    if (!scene) return [];
    const byId = new Map(scene.entities.map((e) => [e.id, e as unknown as Entity]));
    return pendingIds.map((id) => byId.get(id)).filter((e): e is Entity => Boolean(e));
  }, [levelManager, pendingIds]);

  const handleSubmit = useCallback(
    async (values: CreateBlockFormValues) => {
      setSaving(true);
      try {
        // (1) build + validate ΜΙΑ φορά από την τρέχουσα επιλογή — degenerate γεωμετρία → κράτα ανοιχτό.
        //     `pickedBase` (αν υπάρχει) παρακάμπτει το AABB min-corner (ADR-652 M6).
        const built = buildBlockDefFromSelection(readSelectedEntities(), values.name, pickedBase ?? undefined);
        if (!built) return;
        let def = built.def;

        // (2) AutoCAD BLOCK: αντικατάσταση της επιλογής με instance (undoable + reselect).
        if (values.replaceWithInstance) {
          const levelId = levelManager.currentLevelId;
          if (levelId) {
            const sm = createLevelSceneManagerAdapter(
              levelManager.getLevelScene,
              levelManager.setLevelScene,
              levelId,
            );
            const cmd = new CreateBlockFromSelectionCommand([...pendingIds], values.name, sm, pickedBase ?? undefined);
            executeCommand(cmd);
            def = cmd.getCreatedDef() ?? def;
            const createdId = cmd.getCreatedEntityId();
            SelectedEntitiesStore.replaceEntitySelection(createdId ? [createdId] : []);
          }
        }

        // (3) register + persist (scope `user`) — ίδια διαδρομή με το palette save.
        await palette.saveNewBlockFromDef(def, values);
      } finally {
        // Το create «έγινε» (session def + τυχόν instance) — κλείσε ούτως ή άλλως· μια αποτυχία cloud
        // αφήνει ορατή session κάρτα προς αποθήκευση (γνωστή κατάσταση palette), όχι σιωπηλή απώλεια.
        setSaving(false);
        clearCreateBlockRequest();
      }
    },
    [readSelectedEntities, levelManager, pendingIds, executeCommand, palette, pickedBase],
  );

  return (
    <CreateBlockDialog
      open={!pick.armed}
      saving={saving}
      isNameTaken={isNameTaken}
      basePoint={pickedBase}
      onPickBasePoint={armPickBasePoint}
      onClearBasePoint={() => setPickedBase(null)}
      onSubmit={handleSubmit}
      onCancel={clearCreateBlockRequest}
    />
  );
};
