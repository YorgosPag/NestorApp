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
 * 🔑 **§6.23.** «Ευθυγράμμιση με τις διαστάσεις» (`scale.refinement`) υπολογίζεται **μόνο** όταν ζητηθεί και σβήνει με κάθε
 * νέα κάρτα (άλλη βάση). §6.24: κάθε εγγραφή της κάρτας είναι βήμα του ιστορικού αναίρεσης· το μήνυμα φέρει «Αναίρεση» = Ctrl+Z.
 *
 * @see ./usePlanRecognitionWiring.ts
 */

import * as React from 'react';
import { usePlanRecognitionState, planRecognitionStore } from '../systems/plan-recognition/plan-recognition-store';
import { planRecognitionSession } from '../systems/plan-recognition/plan-recognition-session';
import type { PlanScaleCard, PlanScaleFailed, PlanScaleProposal } from '../systems/plan-recognition/plan-scale-card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { modelFromDrawingSession, type ModelFromDrawingDeps } from '../systems/model-from-drawing/model-from-drawing-session';
import { readLiveScene } from '../systems/model-from-drawing/model-from-drawing-live';
import { getFloorBackground, useFloorplanBackgroundStore } from '../floorplan-background/stores/floorplanBackgroundStore';
import { useAnnounceCalibration } from '../floorplan-background/hooks/useAnnounceCalibration';
import type { PlanScaleActions, PlanScaleView } from '../ui/panels/model-from-drawing/PlanScaleCard';

export interface PlanScaleWiring {
  readonly view: PlanScaleView;
  readonly actions: PlanScaleActions;
}

type PlanScaleRefinement = PlanScaleProposal | PlanScaleFailed | null;

interface PlanScaleSetters {
  readonly setApplying: (v: boolean) => void;
  readonly setStale: (v: boolean) => void;
  readonly setRefinement: (v: PlanScaleRefinement) => void;
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

/** Η ευθυγράμμιση πάνω στη θέση και τις μονάδες **αυτής** της στιγμής (όπως η κάρτα). */
function computeRefinement(getDeps: () => ModelFromDrawingDeps): PlanScaleRefinement {
  const floorId = planRecognitionStore.get().run?.floorId;
  const background = floorId ? getFloorBackground(floorId) : null;
  const live = readLiveScene(getDeps().accessor);
  return background && live ? planRecognitionSession.scale.refinement(background, live.sceneUnits) : null;
}

function usePlanScaleActions(getDeps: () => ModelFromDrawingDeps, set: PlanScaleSetters): PlanScaleActions {
  const announce = useAnnounceCalibration();
  const { t } = useTranslation(['dxf-viewer-shell']);
  const undoName = t('modelFromDrawing.image.scale.undoName');
  return React.useMemo((): PlanScaleActions => ({
    onApply: (proposal) => {
      set.setApplying(true);
      set.setStale(false);
      void planRecognitionSession.scale.apply(proposal, undoName).then((result) => {
        if (result.status === 'stale') { set.setStale(true); return; }
        // §6.24: «Αναίρεση» = το ίδιο Ctrl+Z (η εντολή στο ιστορικό)· η σύντηξη ακολουθεί μέσω `useKnownScaleSync`.
        announce(result, result.command);
        if (result.source) modelFromDrawingSession.adoptRasterSegments(result.source, getDeps());
        if (result.status === 'saved') set.setRefinement(null);
      }).finally(() => set.setApplying(false));
    },
    onManual: () => {
      const floorId = planRecognitionStore.get().run?.floorId;
      if (floorId) useFloorplanBackgroundStore.getState().startCalibration(floorId);
    },
    onRefine: () => set.setRefinement(computeRefinement(getDeps)),
    onCloseRefine: () => set.setRefinement(null),
    onHover: (textId) => planRecognitionSession.scale.hover(textId),
  }), [getDeps, announce, set, undoName]);
}

export function usePlanScaleWiring(getDeps: () => ModelFromDrawingDeps): PlanScaleWiring {
  const card = usePlanScaleCard(getDeps);
  const [applying, setApplying] = React.useState(false);
  const [stale, setStale] = React.useState(false);
  const [refinement, setRefinement] = React.useState<PlanScaleRefinement>(null);
  // Νέα κάρτα ⇒ η άρνηση και η ευθυγράμμιση της παλιάς δεν αφορούν ό,τι βλέπει τώρα ο άνθρωπος.
  React.useEffect(() => { setStale(false); setRefinement(null); }, [card]);
  useKnownScaleSync(getDeps);
  const setters = React.useMemo((): PlanScaleSetters => ({ setApplying, setStale, setRefinement }), []);
  const actions = usePlanScaleActions(getDeps, setters);
  const view = React.useMemo((): PlanScaleView => ({ card, refinement, applying, stale }), [card, refinement, applying, stale]);
  return { view, actions };
}
