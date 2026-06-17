'use client';

/**
 * useStructuralOrganismNotification — ADR-459 Phase 7 (ΑΥΤΟΜΑΤΟΣ ενιαίος οπλισμός).
 *
 * Όταν μια κολόνα συνδεθεί με πέδιλο (`bim:column-footing-attached` /
 * `-attached-manual`), υπολογίζει **πάντα & αυτόματα** (χωρίς ερώτηση) τον **ενιαίο
 * οπλισμό** του οργανισμού (κολόνα + πέδιλο) — οι συνδέσεις (αναμονές/αγκυρώσεις/
 * ματίσεις) προκύπτουν DERIVED από τον cross-level οργανισμό μόλις και τα δύο μέλη
 * αποκτήσουν οπλισμό. Idempotent: αν όλα τα μέλη είναι ήδη οπλισμένα → no-op (γι'
 * αυτό η εκτέλεση μετά το `ApplyFoundationLayoutCommand` —που ήδη όπλισε— δεν διπλο-
 * οπλίζει· belt-and-suspenders για τα υπόλοιπα attach paths, π.χ. cross-floor copy).
 *
 * Δύο μονοπάτια:
 *   · πέδιλο στον ίδιο όροφο → emit `bim:auto-reinforce-requested` (υπάρχον hook).
 *   · πέδιλο στον όροφο Θεμελίωσης → `ReinforceColumnFootingCommand` (κολόνα active +
 *     πέδιλο cross-level).
 *
 * Phase 7: μετάβαση από «ερώτηση» (ConfirmationToast) → **αυτόματη ενέργεια + info
 * toast** (mirror του `useAutoFoundationDesign`).
 *
 * @see core/commands/entity-commands/ReinforceColumnFootingCommand.ts
 * @see hooks/useStructuralAutoReinforce.ts — το single-level reinforce path
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/auth/hooks/useAuth';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { useFoundationLevelStore } from '../state/foundation-level-store';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { resolveStructuralCode } from '../bim/structural/codes';
import { buildReinforcePatch } from '../bim/structural/reinforce-patch';
import { createFoundationCrossLevelWriter, type FoundationWriteScope } from '../bim/foundations/foundation-cross-level-writer';
import { ReinforceColumnFootingCommand } from '../core/commands/entity-commands/ReinforceColumnFootingCommand';
import { isFoundationEntity, type Entity } from '../types/entities';
import type { FoundationEntity } from '../bim/types/foundation-types';
import type { StructuralCodeProvider } from '../bim/structural/codes/structural-code-types';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  readonly levels: readonly { id: string; projectId?: string }[];
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

/** Βρες το footing entity είτε στην ενεργή σκηνή (single-level) είτε στον foundation store. */
function resolveFooting(
  footingId: string,
  activeEntities: readonly Entity[],
): { entity: Entity; crossLevel: boolean } | null {
  const inActive = activeEntities.find((e) => e.id === footingId);
  if (inActive) return { entity: inActive, crossLevel: false };
  const inFoundation = useFoundationLevelStore.getState().entities.find((e) => e.id === footingId);
  if (inFoundation) return { entity: inFoundation, crossLevel: true };
  return null;
}

/** True αν τουλάχιστον ένα μέλος χρειάζεται οπλισμό (SSoT buildReinforcePatch ≠ null). */
function anyNeedsReinforcement(members: readonly (Entity | undefined)[], provider: StructuralCodeProvider): boolean {
  return members.some((m) => {
    if (!m) return true; // unresolved (π.χ. μόλις-δημιουργημένο πέδιλο) → πιθανώς χρειάζεται
    return buildReinforcePatch(m, provider) !== null;
  });
}

export function useStructuralOrganismNotification(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');
  const { user } = useAuth();

  useEffect(() => {
    const adapterFor = (levelId: string): LevelSceneManagerAdapter =>
      new LevelSceneManagerAdapter(levelManager.getLevelScene, levelManager.setLevelScene, levelId);

    const onConfirm = (columnIds: readonly string[], footingId: string, levelId: string): void => {
      const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
      const scene = levelManager.getLevelScene(levelId);
      const activeEntities = (scene?.entities ?? []) as unknown as readonly Entity[];
      const footing = resolveFooting(footingId, activeEntities);
      if (footing && !footing.crossLevel) {
        // Single-level: το υπάρχον auto-reinforce hook οπλίζει κολόνες + πέδιλο.
        EventBus.emit('bim:auto-reinforce-requested', { entityIds: [...columnIds, footingId] });
        return;
      }
      const fl = useFoundationLevelStore.getState();
      if (footing && footing.crossLevel && fl.target && isFoundationEntity(footing.entity)) {
        const scope: FoundationWriteScope = {
          companyId: user?.companyId,
          projectId: levelManager.levels.find((l) => l.id === levelId)?.projectId,
          userId: user?.uid,
        };
        const writer = createFoundationCrossLevelWriter(scope, fl.target, levelManager);
        if (writer) {
          const cmd = new ReinforceColumnFootingCommand(
            columnIds, footing.entity as FoundationEntity, writer, adapterFor(levelId), provider,
          );
          execute(cmd);
          const count = cmd.reinforcedCount();
          EventBus.emit('bim:structural-auto-reinforced', { entityIds: [...columnIds, footingId], count });
          if (count > 0) toast.success(t('structuralOrganism.autoReinforced', { count }));
          return;
        }
      }
      // Fallback: οπλισμός μόνο των κολόνων (active).
      EventBus.emit('bim:auto-reinforce-requested', { entityIds: [...columnIds] });
    };

    /**
     * Phase 7 — ΑΥΤΟΜΑΤΟΣ οπλισμός στη σύνδεση (χωρίς ερώτηση). Idempotent: τρέχει
     * μόνο όταν τουλάχιστον ένα μέλος χρειάζεται οπλισμό (αλλιώς silent no-op).
     */
    const handleAttached = ({ columnIds, footingId }: { columnIds: string[]; footingId: string }): void => {
      const levelId = levelManager.currentLevelId;
      if (!levelId || columnIds.length === 0) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const activeEntities = scene.entities as unknown as readonly Entity[];
      const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
      const columns = columnIds.map((id) => activeEntities.find((e) => e.id === id));
      const footing = resolveFooting(footingId, activeEntities)?.entity;
      if (!anyNeedsReinforcement([...columns, footing], provider)) return; // όλα ήδη οπλισμένα
      onConfirm(columnIds, footingId, levelId);
    };

    const unsubA = EventBus.on('bim:column-footing-attached', handleAttached);
    const unsubB = EventBus.on('bim:column-footing-attached-manual', handleAttached);
    return () => {
      unsubA();
      unsubB();
    };
  }, [levelManager, execute, t, user]);
}
