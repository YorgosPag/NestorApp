'use client';

/**
 * useStructuralFootingConnect — ADR-459 Φ4f (manual κολόνα↔πέδιλο connectivity).
 *
 * Thin shell hook (mirror του `useStructuralAutoReinforce`): ακούει τα ribbon
 * requests «Σύνδεση/Αποσύνδεση πεδίλου» από την **πάντα διαθέσιμη** καρτέλα
 * «Ανάλυση» (selection-driven — λειτουργεί με multi-selection, σε αντίθεση με τις
 * contextual καρτέλες που κρύβονται στην πολλαπλή επιλογή), αναλύει την επιλογή και
 * εκτελεί ΕΝΑ undoable `Attach`/`DetachColumnFootingCommand`:
 *   · **attach**: επιλογή = 1 πέδιλο (target) + N κολόνες → εδραίωση `footingId`.
 *   · **detach**: επιλογή = κολόνες (με `footingId`) ή/και πέδιλα → καθαρισμός `footingId`
 *     όλων των κολόνων που εδράζονται στα επιλεγμένα πέδιλα + των επιλεγμένων κολόνων.
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralAutoReinforce`).
 *
 * @see core/commands/entity-commands/AttachColumnFootingCommand.ts / DetachColumnFootingCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §6h
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { createLevelSceneManagerAdapter, type LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { AttachColumnFootingCommand } from '../core/commands/entity-commands/AttachColumnFootingCommand';
import { DetachColumnFootingCommand } from '../core/commands/entity-commands/DetachColumnFootingCommand';
import { isColumnEntity, isFoundationEntity } from '../types/entities';
import { isFoundationSlabEntity } from '../bim/structural/section-context';
import type { Entity } from '../types/entities';
import type { ColumnParams } from '../bim/types/column-types';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/** True αν το entity μπορεί να φιλοξενήσει `footingId` (πέδιλο ή εδαφόπλακα). */
function isFootingTarget(e: Entity): boolean {
  return isFoundationEntity(e) || isFoundationSlabEntity(e);
}

/** `footingId` ενός column entity (ή undefined). */
function columnFootingId(e: Entity): string | undefined {
  return isColumnEntity(e) ? (e.params as ColumnParams).footingId : undefined;
}

export function useStructuralFootingConnect(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();

  useEffect(() => {
    const resolve = (): { entities: readonly Entity[]; sm: LevelSceneManagerAdapter } | null => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return null;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return null;
      const sm = createLevelSceneManagerAdapter(levelManager.getLevelScene, levelManager.setLevelScene, levelId);
      return { entities: scene.entities as unknown as readonly Entity[], sm };
    };

    const unsubAttach = EventBus.on('bim:column-footing-attach-requested', ({ entityIds }) => {
      const ctx = resolve();
      if (!ctx) return;
      const selected = new Set(entityIds);
      const footings = ctx.entities.filter((e) => selected.has(e.id) && isFootingTarget(e));
      const columns = ctx.entities.filter((e) => selected.has(e.id) && isColumnEntity(e));
      // Selection-pair: ΑΚΡΙΒΩΣ 1 πέδιλο (target) + ≥1 κολόνα (μη ήδη συνδεδεμένη).
      if (footings.length !== 1 || columns.length === 0) return;
      const footingId = footings[0].id;
      const columnIds = columns.filter((c) => columnFootingId(c) !== footingId).map((c) => c.id);
      if (columnIds.length === 0) return;
      execute(new AttachColumnFootingCommand(footingId, columnIds, ctx.sm));
      EventBus.emit('bim:column-footing-attached-manual', { columnIds, footingId });
    });

    const unsubDetach = EventBus.on('bim:column-footing-detach-requested', ({ entityIds }) => {
      const ctx = resolve();
      if (!ctx) return;
      const selected = new Set(entityIds);
      const selectedFootings = new Set(
        ctx.entities.filter((e) => selected.has(e.id) && isFootingTarget(e)).map((e) => e.id),
      );
      // Κολόνες προς αποσύνδεση: επιλεγμένες (με footingId) ∪ όσες εδράζονται σε επιλεγμένο πέδιλο.
      const columnIds = ctx.entities
        .filter((e) => {
          const fid = columnFootingId(e);
          if (fid === undefined) return false;
          return selected.has(e.id) || selectedFootings.has(fid);
        })
        .map((e) => e.id);
      if (columnIds.length === 0) return;
      execute(new DetachColumnFootingCommand(columnIds, ctx.sm));
      EventBus.emit('bim:column-footing-detached', { columnIds });
    });

    return () => {
      unsubAttach();
      unsubDetach();
    };
  }, [levelManager, execute]);
}
