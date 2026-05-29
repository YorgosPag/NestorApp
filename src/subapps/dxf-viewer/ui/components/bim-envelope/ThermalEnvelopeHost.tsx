'use client';

/**
 * ADR-396 Phase P6 + P7 Part B — Thermal Envelope (ETICS) dialog host.
 *
 * Lifecycle owner του authoring command «Εφαρμογή Θερμοπρόσοψης»:
 *   1. Listen σε `bim:thermal-envelope-requested` (ribbon → action intercept →
 *      EventBus) → init draft από το spec του τρέχοντος ορόφου (ή default) +
 *      open dialog.
 *   2. «Εφαρμογή» → `setEnvelopeSpec(currentLevelId, draft)` (D3 ανά όροφο).
 *   3. «σε όλους» → `setEnvelopeSpec` σε ΟΛΟΥΣ τους ορόφους (D3).
 *   4. `markAllCanvasDirty()` → 2D overlay repaint· το 3D resync wiring
 *      (`use-bim3d-vg-resync`) ακούει το spec store για parity.
 *
 * **P7 Part A** — μετά το apply, persist το per-floor spec στο level doc
 * (`saveThermalEnvelopeSpec`) ώστε το κέλυφος να επιβιώνει reload.
 *
 * **P7 Part B** — επιπλέον, παράγει per-element στρώσεις μόνωσης:
 *   `computeEnvelopeAssignments` → `applyAssignmentsToEntities` → `setLevelScene`
 *   με ενημερωμένα params → `EventBus.emit('bim:envelope-applied')` ώστε τα
 *   υπάρχοντα persistence hooks να γράψουν + audit-άρουν (column/beam/slab μέσω
 *   του shared moved effect· opening μέσω δικού του listener) → `syncEnvelopeBoq`
 *   για χωριστές BOQ γραμμές ανά ζώνη+όροφο (D5). Idempotent.
 *
 * Mounted as React.Suspense leaf σε `DxfViewerContent.tsx` — mirror του
 * `OpeningTagStyleHost` (ADR-376 C.2). ADR-040: leaf-only, καμία orchestrator
 * subscription. Τα storeys διαβάζονται imperatively (apply = action, όχι render).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §7 (P6, P7)
 */

import * as React from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { markAllCanvasDirty } from '../../../rendering/core/frame-scheduler-api';
import { EventBus } from '../../../systems/events/EventBus';
import {
  buildDefaultSpec,
  getEnvelopeSpec,
  setEnvelopeSpec,
} from '../../../bim/stores/envelope-spec-store';
import type { ThermalEnvelopeSpec } from '../../../bim/types/thermal-envelope-types';
import { saveThermalEnvelopeSpec } from '../../../services/thermal-envelope.service';
import {
  computeEnvelopeAssignments,
  applyAssignmentsToEntities,
} from '../../../bim/services/envelope-element-applicator';
import { syncEnvelopeBoq } from '../../../bim/services/envelope-boq-sync';
import { useBim3DEntitiesStore } from '../../../bim-3d/stores/Bim3DEntitiesStore';
import type { SceneModel } from '../../../types/scene';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { ThermalEnvelopeDialog } from './ThermalEnvelopeDialog';

const logger = createModuleLogger('ThermalEnvelopeHost');

/** Ελάχιστη μορφή ορόφου που χρειάζεται ο host (per-level BOQ scope). */
export interface ThermalEnvelopeLevel {
  readonly id: string;
  readonly floorId?: string;
  readonly buildingId?: string;
  readonly projectId?: string;
}

export interface ThermalEnvelopeHostProps {
  /** Τρέχων BIM όροφος — κλειδί του per-level spec (D3). */
  readonly currentLevelId: string | null | undefined;
  /** Όλοι οι όροφοι — για «Εφαρμογή σε όλους» (D3) + per-level BOQ scope. */
  readonly levels: ReadonlyArray<ThermalEnvelopeLevel>;
  /** Scene readers/writers (από levelManager) — per-element apply (P7 Part B). */
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  /** Project scope fallback (level.projectId ?? αυτό). */
  readonly projectId: string | null | undefined;
}

export function ThermalEnvelopeHost(
  props: ThermalEnvelopeHostProps,
): React.ReactElement | null {
  const { currentLevelId, levels, getLevelScene, setLevelScene, projectId } = props;
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<ThermalEnvelopeSpec>(buildDefaultSpec);

  // EventBus listener — ribbon button → init draft από το spec του ορόφου + open.
  React.useEffect(() => {
    return EventBus.on('bim:thermal-envelope-requested', () => {
      setDraft(getEnvelopeSpec(currentLevelId) ?? buildDefaultSpec());
      setOpen(true);
    });
  }, [currentLevelId]);

  // P7 Part B — per-element apply + BOQ για έναν όροφο (idempotent).
  const applyPerElement = React.useCallback(
    (levelId: string, spec: ThermalEnvelopeSpec) => {
      const scene = getLevelScene(levelId);
      if (!scene) return;
      const storeys = useBim3DEntitiesStore.getState().floors;
      const assignments = computeEnvelopeAssignments(spec, scene.entities, storeys);
      const { entities, changed } = applyAssignmentsToEntities(scene.entities, assignments);
      if (changed.length > 0) {
        setLevelScene(levelId, { ...scene, entities });
        EventBus.emit('bim:envelope-applied', { entities: changed });
      }
      const level = levels.find((l) => l.id === levelId);
      void syncEnvelopeBoq(entities, storeys, spec, {
        companyId: companyId ?? '',
        projectId: level?.projectId ?? projectId ?? '',
        buildingId: level?.buildingId ?? '',
        floorId: level?.floorId ?? '',
      }).catch((err: unknown) => logger.error('envelope BOQ sync failed', { levelId, err }));
    },
    [getLevelScene, setLevelScene, levels, companyId, projectId],
  );

  const applyToLevels = React.useCallback(
    (levelIds: readonly string[]) => {
      for (const id of levelIds) {
        // Optimistic in-memory update (instant 2D/3D repaint)…
        setEnvelopeSpec(id, draft);
        // …+ persist το per-floor spec στο level doc (P7 Part A) — επιβιώνει reload.
        void saveThermalEnvelopeSpec(id, draft).catch((err: unknown) => {
          logger.error('persist failed', { levelId: id, err });
        });
        // …+ per-element layers + audit + BOQ (P7 Part B).
        applyPerElement(id, draft);
      }
      markAllCanvasDirty();
      setOpen(false);
    },
    [draft, applyPerElement],
  );

  const handleApply = React.useCallback(() => {
    if (currentLevelId) applyToLevels([currentLevelId]);
  }, [currentLevelId, applyToLevels]);

  const handleApplyAll = React.useCallback(() => {
    applyToLevels(levels.map((l) => l.id));
  }, [levels, applyToLevels]);

  return (
    <ThermalEnvelopeDialog
      open={open}
      onOpenChange={setOpen}
      value={draft}
      onChange={setDraft}
      onApply={handleApply}
      onApplyAll={handleApplyAll}
    />
  );
}
