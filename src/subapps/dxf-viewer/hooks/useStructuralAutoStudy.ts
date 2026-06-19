'use client';

/**
 * useStructuralAutoStudy — ADR-500 (ADR-487 §7: «Αυτόματη Μελέτη»).
 *
 * Thin, decoupled shell hook (mirror του `useStructuralAutoReinforce`): ακούει το
 * ribbon request `bim:auto-study-requested`, μαζεύει τα deps (ενεργός κανονισμός,
 * area loads, storey count, guide offsets, auth user, command executors) και εκτελεί
 * τον SSoT πυρήνα `runAutoStudy` — τον ντετερμινιστικό βρόχο σύγκλισης. Στο τέλος
 * εκδίδει ΕΝΑ συγκεντρωτικό report toast (§7.2) + exit-to-human warning αν απομένουν
 * blocking diagnostics (§7.4· τα ίδια diagnostics τα δείχνει ήδη το ADR-490 overlay).
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralAutoReinforce`).
 *
 * @see hooks/structural-auto-study-core.ts — runAutoStudy (SSoT βρόχος)
 * @see docs/centralized-systems/reference/adrs/ADR-500-auto-study-convergence-loop.md
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/auth/hooks/useAuth';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { resolveStructuralCode } from '../bim/structural/codes';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { useAnalysisDiagramViewStore } from '../state/analysis-diagram-view-store';
import { resolveEffectiveAreaLoads } from '../bim/structural/loads/occupancy-loads';
import { makeGuideOffsetLookup } from '../bim/hosting/guide-store-offset-lookup';
import { useBuildingStoreyCount } from './useBuildingStoreyCount';
import { useBuildingOccupancy } from './useBuildingOccupancy';
import { runAutoStudy, type AutoStudyLevelManager } from './structural-auto-study-core';

export function useStructuralAutoStudy(props: { levelManager: AutoStudyLevelManager }): void {
  const { levelManager } = props;
  const { execute, executeGrouped } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');
  const { user } = useAuth();
  // Refs ώστε ο event callback να διαβάζει τις τρέχουσες τιμές χωρίς re-subscribe.
  const storeyCount = useBuildingStoreyCount();
  const storeyCountRef = useRef(storeyCount);
  storeyCountRef.current = storeyCount;
  const occupancy = useBuildingOccupancy();
  const occupancyRef = useRef(occupancy);
  occupancyRef.current = occupancy;

  useEffect(() => {
    const unsub = EventBus.on('bim:auto-study-requested', () => {
      const settings = useStructuralSettingsStore.getState();
      // ADR-474 — explicit kPa κερδίζει· αλλιώς auto από occupancy + γεωμετρία πλάκας.
      const areaLoads = resolveEffectiveAreaLoads({
        explicitDeadKpa: settings.deadAreaLoadKpa,
        explicitLiveKpa: settings.liveAreaLoadKpa,
        occupancy: settings.occupancy ?? occupancyRef.current,
      });
      // DEFER B — frame-action σύγκλιση: force-engage την ανάλυση ΜΟΝΟ για τη διάρκεια
      // της μελέτης ώστε ο FEM solver να μετρά (το `resolveEngagedAnalysisResult` gate)
      // ακόμη κι όταν τα διαγράμματα είναι κλειστά. Επαναφορά μετά → καμία μόνιμη αλλαγή UI
      // (ο latch `analysisLive` δεν δείχνει overlay· μόνο ενεργοποιεί το FEM gate).
      const view = useAnalysisDiagramViewStore.getState();
      const prevAnalysisLive = view.analysisLive;
      view.setAnalysisLive(true);
      const result = (() => {
        try {
          return runAutoStudy(levelManager, {
            provider: resolveStructuralCode(settings.codeId),
            loadSettings: { storeyCount: storeyCountRef.current, ...areaLoads },
            getOffset: makeGuideOffsetLookup(),
            user,
            storeyCount: storeyCountRef.current,
            execute,
            executeGrouped,
          });
        } finally {
          if (!prevAnalysisLive) useAnalysisDiagramViewStore.getState().setAnalysisLive(false);
        }
      })();
      // §7.2 — «Τελείωσα. N γύροι. Άλλαξα X κολώνες, Y δοκάρια, Z πλάκες, W πέδιλα.»
      toast.success(
        t('autoStudy.report', {
          rounds: result.rounds,
          columns: result.columns,
          beams: result.beams,
          slabs: result.slabs,
          footings: result.footings,
        }),
      );
      // §7.4 — exit-to-human: αν απομένει κόκκινο, «εδώ χρειάζομαι εσένα».
      if (!result.converged && result.remaining.length > 0) {
        toast.warning(t('autoStudy.remaining', { count: result.remaining.length }));
      }
    });
    return () => unsub();
  }, [levelManager, execute, executeGrouped, t, user]);
}
