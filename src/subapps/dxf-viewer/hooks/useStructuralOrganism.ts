'use client';

/**
 * useStructuralOrganism — ADR-459 Phase 1 (cross-entity diagnostics bridge).
 *
 * Thin, decoupled shell hook (mirror του `useStructuralAutoAttach`): ακούει τα
 * structural lifecycle events, ξανα-χτίζει τον DERIVED στατικό οργανισμό
 * (`buildStructuralGraph` → `runOrganismChecks`) από τη σκηνή του ενεργού ορόφου,
 * και γράφει τα ευρήματα στο `StructuralDiagnosticsStore` (low-freq → ADR-040 safe).
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralAutoAttach`).
 * Re-derive coalesced ανά microtask: πολλά events στο ίδιο tick → ΕΝΑ recompute.
 *
 * @see bim/structural/organism/organism-checks.ts — buildStructuralGraph + runOrganismChecks
 * @see bim/structural/organism/structural-diagnostics-store.ts — ο store που γράφεται
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md
 */

import { useEffect } from 'react';
import { EventBus, type DrawingEventType } from '../systems/events/EventBus';
import {
  buildStructuralGraph,
  runOrganismChecks,
} from '../bim/structural/organism/organism-checks';
import { StructuralDiagnosticsStore } from '../bim/structural/organism/structural-diagnostics-store';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
}

/** Structural mutations που επηρεάζουν τον οργανισμό → trigger recompute. */
const ORGANISM_EVENTS: readonly DrawingEventType[] = [
  'drawing:entity-created',
  'bim:column-params-updated',
  'bim:column-delete-requested',
  'bim:beam-params-updated',
  'bim:beam-delete-requested',
  'bim:foundation-params-updated',
  'bim:foundation-delete-requested',
  'bim:columns-from-grid',
  'bim:foundations-from-grid',
  'bim:beams-from-grid',
  'bim:columns-auto-attached',
  'bim:columns-auto-attached-base',
  'bim:column-footing-attached',
];

export function useStructuralOrganism(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;

  useEffect(() => {
    let scheduled = false;

    const recompute = (): void => {
      scheduled = false;
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!levelId || !scene) {
        StructuralDiagnosticsStore.set([]);
        return;
      }
      const entities = scene.entities as unknown as readonly Entity[];
      const diagnostics = runOrganismChecks(buildStructuralGraph(entities));
      StructuralDiagnosticsStore.set(diagnostics);
      EventBus.emit('bim:structural-organism-updated', {
        diagnosticCount: diagnostics.length,
        levelId,
      });
    };

    const schedule = (): void => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(recompute);
    };

    const unsubs = ORGANISM_EVENTS.map((ev) => EventBus.on(ev, schedule));
    schedule(); // initial pass
    return () => unsubs.forEach((u) => u());
  }, [levelManager]);
}
