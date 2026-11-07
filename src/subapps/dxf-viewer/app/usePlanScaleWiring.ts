'use client';

/**
 * ADR-929 Φ5.3γ — δένει την **κάρτα κλίμακας** με το πάνελ «Μοντέλο από το σχέδιο».
 *
 *   η κάρτα (`planRecognitionSession.scale.card`) → πάνελ · «Εφαρμογή» → `scale.apply` (η μία πόρτα `commitCalibration`) ·
 *   «Βαθμονόμηση με το χέρι» → ο υπάρχων διάλογος δύο σημείων.
 *
 * 🔑 **Μετά από ΚΑΘΕ βαθμονόμηση** (κάρτα **ή** διάλογος) η σύντηξη ξανατρέχει με τη νέα κλίμακα (`syncKnownScale`, ιδεμποτικό)
 * και ο βοηθός υιοθετεί τη νέα πηγή γραμμών. Αλλιώς η κάρτα θα πρότεινε ξανά μια κλίμακα που ήδη εφαρμόστηκε. Επειδή το
 * `commitCalibration` εφαρμόζει αισιόδοξα και επαναφέρει σε αποτυχία, ο ίδιος συγχρονισμός ακολουθεί και την επαναφορά.
 *
 * @see ./usePlanRecognitionWiring.ts
 */

import * as React from 'react';
import { usePlanRecognitionState, planRecognitionStore } from '../systems/plan-recognition/plan-recognition-store';
import { planRecognitionSession } from '../systems/plan-recognition/plan-recognition-session';
import type { PlanScaleCard } from '../systems/plan-recognition/plan-scale-card';
import { modelFromDrawingSession, type ModelFromDrawingDeps } from '../systems/model-from-drawing/model-from-drawing-session';
import { readLiveScene } from '../systems/model-from-drawing/model-from-drawing-live';
import { useFloorplanBackgroundStore } from '../floorplan-background/stores/floorplanBackgroundStore';
import { useAnnounceCalibration } from '../floorplan-background/hooks/useAnnounceCalibration';
import type { PlanScaleActions, PlanScaleView } from '../ui/panels/model-from-drawing/PlanScaleCard';

export interface PlanScaleWiring {
  readonly view: PlanScaleView;
  readonly actions: PlanScaleActions;
}

/** Η κάρτα για ό,τι ισχύει τώρα: σύντηξη · ανάγνωση · θέση εικόνας · μονάδες σκηνής. */
function usePlanScaleCard(getDeps: () => ModelFromDrawingDeps): PlanScaleCard | null {
  const { run, fusion, reading } = usePlanRecognitionState();
  const floorId = run?.floorId ?? null;
  const background = useFloorplanBackgroundStore((s) => (floorId ? s.floors[floorId]?.background ?? null : null));
  return React.useMemo(() => {
    if (!background || !fusion) return null;
    // Οι μονάδες της ζωντανής σκηνής (όπως η πρόταση τοίχων)· χωρίς σκηνή δεν υπάρχει λύση σε μονάδες, άρα ούτε κάρτα.
    const live = readLiveScene(getDeps().accessor);
    return live ? planRecognitionSession.scale.card(background, live.sceneUnits) : null;
  }, [fusion, reading, background, getDeps]);
}

/** Κάθε βαθμονόμηση του ορόφου της αναγνώρισης ⇒ η σύντηξη ακολουθεί τη νέα κλίμακα. */
function useKnownScaleSync(getDeps: () => ModelFromDrawingDeps): void {
  const floorId = usePlanRecognitionState().run?.floorId ?? null;
  const calibration = useFloorplanBackgroundStore((s) => (floorId ? s.floors[floorId]?.background?.calibration ?? null : null));
  React.useEffect(() => {
    if (!floorId) return;
    const source = planRecognitionSession.scale.syncKnownScale(floorId);
    if (source) modelFromDrawingSession.adoptRasterSegments(source, getDeps());
  }, [floorId, calibration, getDeps]);
}

function usePlanScaleActions(
  getDeps: () => ModelFromDrawingDeps,
  setApplying: (v: boolean) => void,
  setStale: (v: boolean) => void,
): PlanScaleActions {
  const announce = useAnnounceCalibration();
  return React.useMemo((): PlanScaleActions => ({
    onApply: (proposal) => {
      setApplying(true);
      setStale(false);
      void planRecognitionSession.scale.apply(proposal).then((result) => {
        if (result.status === 'stale') setStale(true);
        else announce({ status: result.status, overlaysSkipped: result.overlaysSkipped });
        if (result.source) modelFromDrawingSession.adoptRasterSegments(result.source, getDeps());
      }).finally(() => setApplying(false));
    },
    onManual: () => {
      const floorId = planRecognitionStore.get().run?.floorId;
      if (floorId) useFloorplanBackgroundStore.getState().startCalibration(floorId);
    },
    onHover: (textId) => planRecognitionSession.scale.hover(textId),
  }), [getDeps, announce, setApplying, setStale]);
}

export function usePlanScaleWiring(getDeps: () => ModelFromDrawingDeps): PlanScaleWiring {
  const card = usePlanScaleCard(getDeps);
  const [applying, setApplying] = React.useState(false);
  const [stale, setStale] = React.useState(false);
  // Νέα κάρτα ⇒ η άρνηση της παλιάς δεν αφορά ό,τι βλέπει τώρα ο άνθρωπος.
  React.useEffect(() => setStale(false), [card]);
  useKnownScaleSync(getDeps);
  const actions = usePlanScaleActions(getDeps, setApplying, setStale);
  const view = React.useMemo((): PlanScaleView => ({ card, applying, stale }), [card, applying, stale]);
  return { view, actions };
}
