'use client';

/**
 * useProactiveTieBeamTieForce — ADR-477 Slice 3 (PROACTIVE σεισμική δύναμη σύνδεσης).
 *
 * Καθρεφτίζει το `useProactiveStructuralLoads` (Φ9): μόλις ολοκληρωθεί η διαδρομή
 * φορτίων (`bim:structural-loads-computed` → οι κολώνες έχουν φρέσκο `appliedLoad`),
 * ξανα-υπολογίζει αυτόματα — χωρίς κουμπί — τη σεισμική αξονική δύναμη σύνδεσης
 * `N_tie` (EN1998-5 §5.4.1.2) κάθε συνδετήριας δοκού μέσω του pure
 * `computeTieBeamTieForces` και τη γράφει στα params (`ComputeTieBeamTieForcesCommand`).
 * Έπειτα ο **ενεργός** οπλισμός της συνδετήριας (auto) re-derives με το `As,tie`.
 *
 * **Δεύτερο σκαλί της αλυσίδας** `φορτία κολονών → N_tie συνδετήριας → As,tie`: ακούει
 * ΜΟΝΟ το `bim:structural-loads-computed` (αφού οι κολώνες φορτιστούν) — ΟΧΙ direct
 * geometry edits (αυτά περνούν πρώτα από τη διαδρομή φορτίων).
 *
 * **Loop guard:** το command γράφει μόνο tie-beam params (`updateEntity`)· ΔΕΝ
 * επανεκπέμπει `bim:structural-loads-computed` ούτε `bim:*-params-updated` που ακούει
 * η διαδρομή φορτίων → μηδέν κύκλος. Idempotent (skip όταν N_tie αμετάβλητο).
 *
 * ADR-040 safe: low-freq, coalesced ανά microtask.
 *
 * @see bim/structural/loads/tie-beam-tie-force.ts — computeTieBeamTieForces (pure SSoT)
 * @see hooks/useProactiveStructuralLoads.ts — το proactive πρότυπο (Φ9)
 * @see docs/centralized-systems/reference/adrs/ADR-477-tie-beam-reinforcement-unification.md §Slice 3
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { ComputeTieBeamTieForcesCommand } from '../core/commands/entity-commands/ComputeTieBeamTieForcesCommand';
import { computeTieBeamTieForces } from '../bim/structural/loads/tie-beam-tie-force';
import {
  DEFAULT_SEISMIC_GROUND_ACCEL_RATIO,
  DEFAULT_SEISMIC_GROUND_TYPE,
} from '../bim/structural/loads/seismic-params';
import type { Entity } from '../types/entities';
import type { LoadTakedownLevelManager } from './structural-load-takedown-core';

export function useProactiveTieBeamTieForce(props: { levelManager: LoadTakedownLevelManager }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();

  useEffect(() => {
    let scheduled = false;

    const recompute = (): void => {
      scheduled = false;
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const settings = useStructuralSettingsStore.getState();
      const forces = computeTieBeamTieForces(
        scene.entities as unknown as readonly Entity[],
        settings.seismicGroundType ?? DEFAULT_SEISMIC_GROUND_TYPE,
        settings.seismicGroundAccelRatio ?? DEFAULT_SEISMIC_GROUND_ACCEL_RATIO,
      );
      if (forces.length === 0) return; // κατηγορία A / καμία συνδετήρια

      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      const command = new ComputeTieBeamTieForcesCommand(forces, sm);
      if (command.getChangedTieBeamIds().length === 0) return; // idempotent no-op
      execute(command);
    };

    const schedule = (): void => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(recompute);
    };

    return EventBus.on('bim:structural-loads-computed', schedule);
  }, [levelManager, execute]);
}
