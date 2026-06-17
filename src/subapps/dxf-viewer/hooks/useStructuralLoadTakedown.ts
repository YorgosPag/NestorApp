'use client';

/**
 * useStructuralLoadTakedown — ADR-467 (διαδρομή φορτίων: slab→beam→column→footing).
 *
 * Thin shell hook (mirror του `useStructuralAutoReinforce`): ακούει το ribbon
 * request `bim:compute-loads-requested` και καλεί τον SSoT πυρήνα
 * `runStructuralLoadTakedown` (κοινός με τον proactive trigger του Φ9), ο οποίος
 * χτίζει τον στατικό graph, υπολογίζει τα tributary φορτία **όλων των μελών** του
 * ενεργού ορόφου, εκτελεί ΕΝΑ undoable `ComputeLoadPathCommand`, και emit-άρει
 * `bim:structural-loads-computed` → ο `useStructuralOrganism` ξανα-υπολογίζει τους
 * ελέγχους έδρασης/σχεδιασμού.
 *
 * Storey count = μετρούμενοι όροφοι του κτιρίου (`useBuildingStoreyCount`, ADR-461)·
 * area loads = building-level `structuralSettingsStore` (G/Q kPa). Αδρανές χωρίς
 * area loads / ορόφους (advisory).
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralAutoReinforce`).
 *
 * @see hooks/structural-load-takedown-core.ts — runStructuralLoadTakedown (SSoT)
 * @see hooks/useProactiveStructuralLoads.ts — proactive trigger (Φ9)
 * @see docs/centralized-systems/reference/adrs/ADR-467-load-path-engine.md
 */

import { useEffect, useRef } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { makeGuideOffsetLookup } from '../bim/hosting/guide-store-offset-lookup';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { resolveEffectiveAreaLoads } from '../bim/structural/loads/occupancy-loads';
import { useBuildingStoreyCount } from './useBuildingStoreyCount';
import { runStructuralLoadTakedown, type LoadTakedownLevelManager } from './structural-load-takedown-core';

export function useStructuralLoadTakedown(props: { levelManager: LoadTakedownLevelManager }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();
  const storeyCount = useBuildingStoreyCount();
  // Ref ώστε ο event callback να διαβάζει το τρέχον storeyCount χωρίς re-subscribe.
  const storeyCountRef = useRef(storeyCount);
  storeyCountRef.current = storeyCount;

  useEffect(() => {
    const unsub = EventBus.on('bim:compute-loads-requested', () => {
      const settings = useStructuralSettingsStore.getState();
      // ADR-474 — explicit kPa κερδίζει· αλλιώς auto από occupancy + γεωμετρία πλάκας.
      const areaLoads = resolveEffectiveAreaLoads({
        explicitDeadKpa: settings.deadAreaLoadKpa,
        explicitLiveKpa: settings.liveAreaLoadKpa,
        occupancy: settings.occupancy,
      });
      runStructuralLoadTakedown(
        levelManager,
        { storeyCount: storeyCountRef.current, ...areaLoads },
        makeGuideOffsetLookup(),
        execute,
      );
    });
    return () => unsub();
  }, [levelManager, execute]);
}
