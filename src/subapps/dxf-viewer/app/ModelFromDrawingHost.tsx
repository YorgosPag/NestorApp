'use client';

/**
 * ADR-911 Φ3β — lifecycle owner του βοηθού **«Μοντέλο από το σχέδιο»**.
 *
 * Ο host είναι το ΜΟΝΟ σημείο που κρατά μαζί τα τρία πράγματα που χρειάζεται ο ελεγκτής και που
 * ο καμβάς δεν έχει: τη σκηνή του ενεργού επιπέδου (`levelManager`), τις στρώσεις (αποδιδόμενο
 * χρώμα) και τη συνεδρία τύπων τοίχου (auth + αποθήκευση). Τα δίνει στον ελεγκτή ΤΗ ΣΤΙΓΜΗ κάθε
 * πράξης — ποτέ ως στιγμιότυπο.
 *
 *   σήμα ribbon (`dxf:model-from-drawing-requested`) → οπλισμός
 *   κλικ καμβά → `pendingSample` στο store → ΕΔΩ υιοθετείται (γραμμή → χρώμα → πρόταση)
 *   πάνελ → αποφάσεις → ΜΙΑ έγκριση → `addWallsToScene`
 *
 * Mirror του `DxfSymbolDetectHost` (always-on host με `levelManager`) + `CreateBlockDialogHost`
 * (οπλισμένο κλικ: hint στη γραμμή κατάστασης, Esc από τον κεντρικό Escape bus).
 *
 * ADR-040: μηδέν συνδρομές καμβά· το store της συνεδρίας είναι χαμηλόσυχνο.
 *
 * @see ../systems/model-from-drawing/model-from-drawing-session.ts (ο ελεγκτής)
 * @see ../ui/panels/model-from-drawing/ModelFromDrawingPanel.tsx (το πάνελ)
 * @see ../components/dxf-layout/ModelFromDrawingPreviewOverlay.tsx (η προεπισκόπηση)
 */

import * as React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LevelsHookReturn } from '../systems/levels';
import { EventBus } from '../systems/events/EventBus';
import { useEscapeHandler } from '../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../systems/escape-bus/escape-priority';
import { toolHintOverrideStore } from '../hooks/toolHintOverrideStore';
import { getLayersById } from '../stores/LayerStore';
import { getImmediateTransform } from '../systems/cursor/ImmediateTransformStore';
import { HIT_TEST_RADIUS_PX } from '../config/tolerance-config';
import { focusReviewTarget, reviewFocusExtent } from '../systems/coordination/review-focus';
import { useWallAutoTyping } from '../bim/family-types/useWallAutoTyping';
import type { WallTypingSession } from '../bim/family-types/wall-typer';
import {
  modelFromDrawingSession,
  type ModelFromDrawingDeps,
} from '../systems/model-from-drawing/model-from-drawing-session';
import {
  modelFromDrawingStore,
  useModelFromDrawingState,
} from '../systems/model-from-drawing/model-from-drawing-store';
import {
  ModelFromDrawingPanel,
  type ModelFromDrawingPanelActions,
} from '../ui/panels/model-from-drawing/ModelFromDrawingPanel';

/** Περιθώριο (mm) γύρω από το ορθογώνιο όταν ο άνθρωπος ζητά «δείξε μου αυτό». */
const FOCUS_PAD_MM = 1500;

export interface ModelFromDrawingHostProps {
  readonly levelManager: LevelsHookReturn;
}

interface AssistantWiring {
  /** Οι εξαρτήσεις του ελεγκτή, διαβασμένες ΤΩΡΑ (σκηνή, στρώσεις, κλίμακα οθόνης). */
  readonly getDeps: () => ModelFromDrawingDeps;
  /** Νέα συνεδρία (άνοιγμα ή «άλλο δείγμα»): φρέσκος τυπογράφος, οπλισμένος βοηθός. */
  readonly start: () => void;
}

/** Φέρνει στην οθόνη το ορθογώνιο ενός στοιχείου της πρότασης (2Δ· στο 3Δ δεν υπάρχει υψόμετρο να δοθεί). */
function focusProposalItem(key: string): void {
  modelFromDrawingSession.focus(key);
  const item = modelFromDrawingStore.get().proposal?.items.find((i) => i.key === key);
  const extent = item ? reviewFocusExtent(item.rect.polygon.map((p) => ({ x: p.x, y: p.y })), FOCUS_PAD_MM) : null;
  if (extent) focusReviewTarget(extent, () => null, false);
}

/**
 * Δένει τον ελεγκτή με τον κόσμο. Refs, όχι closures: οι callbacks βλέπουν ΠΑΝΤΑ τον τρέχοντα
 * `levelManager` και τον τρέχοντα τυπογράφο. ΜΙΑ συνεδρία τύπων ανά συνεδρία βοηθού — σφραγίζει
 * κάθε πρόταση και αποθηκεύει στην έγκριση, ώστε ό,τι φωτίστηκε να φέρει τον τύπο που θα γραφτεί.
 */
function useAssistantWiring(levelManager: LevelsHookReturn, undoName: string): AssistantWiring {
  const { beginWallTyping } = useWallAutoTyping();
  const lmRef = React.useRef(levelManager);
  lmRef.current = levelManager;
  const beginTypingRef = React.useRef(beginWallTyping);
  beginTypingRef.current = beginWallTyping;
  const typingRef = React.useRef<WallTypingSession | null>(null);

  const getDeps = React.useCallback((): ModelFromDrawingDeps => {
    typingRef.current ??= beginTypingRef.current();
    return {
      accessor: lmRef.current,
      typing: typingRef.current,
      layersById: getLayersById(),
      pickTolerance: HIT_TEST_RADIUS_PX / Math.max(getImmediateTransform().scale, Number.EPSILON),
      undoName,
    };
  }, [undoName]);

  const start = React.useCallback((): void => {
    typingRef.current = beginTypingRef.current();
    modelFromDrawingSession.open();
  }, []);

  return { getDeps, start };
}

/** Όσο ο βοηθός είναι οπλισμένος: οδηγία στη γραμμή κατάστασης, και Esc που τον κλείνει. */
function useSamplePickMode(picking: boolean, hint: string): void {
  React.useEffect(() => {
    if (!picking) return;
    toolHintOverrideStore.setOverride(hint);
    return () => toolHintOverrideStore.setOverride(null);
  }, [picking, hint]);

  // Μέσω του κεντρικού Escape bus (ADR-364), όχι ιδιωτικού window listener.
  useEscapeHandler(
    picking
      ? {
          id: 'model-from-drawing-pick-sample',
          priority: ESC_PRIORITY.MODAL_DIALOG,
          canHandle: () => true,
          handle: () => {
            modelFromDrawingSession.close();
            return true;
          },
        }
      : null,
  );
}

export function ModelFromDrawingHost({ levelManager }: ModelFromDrawingHostProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useModelFromDrawingState();
  const { getDeps, start } = useAssistantWiring(levelManager, t('modelFromDrawing.undoName'));
  useSamplePickMode(state.phase === 'picking', t('modelFromDrawing.pickHint'));

  React.useEffect(() => EventBus.on('dxf:model-from-drawing-requested', start), [start]);

  // Το κλικ του καμβά άφησε δείγμα → υιοθέτησέ το (one-shot· ο ελεγκτής το καθαρίζει).
  React.useEffect(() => {
    if (state.pendingSample) modelFromDrawingSession.adoptSample(getDeps());
  }, [state.pendingSample, getDeps]);

  // Αλλαγή ενεργού επιπέδου με πρόταση ανοιχτή → η πρόταση αφορά άλλη σκηνή: ξαναϋπολόγισε.
  const levelId = levelManager.currentLevelId;
  React.useEffect(() => {
    modelFromDrawingSession.refresh(getDeps());
  }, [levelId, getDeps]);

  // Δίχτυ: αν ο host φύγει ενώ ο βοηθός είναι ανοιχτός, μη μείνει οπλισμένος ο καμβάς.
  React.useEffect(() => () => modelFromDrawingSession.close(), []);

  const actions = React.useMemo((): ModelFromDrawingPanelActions => ({
    onClose: () => modelFromDrawingSession.close(),
    onResample: start,
    onConfirmGroup: (thicknessMm, category) => modelFromDrawingSession.confirmGroup(thicknessMm, category, getDeps()),
    onSetUndecided: (key, isWall) => modelFromDrawingSession.setUndecided(key, isWall, getDeps()),
    onFocus: focusProposalItem,
    onApprove: () => { modelFromDrawingSession.approve(getDeps()); },
  }), [start, getDeps]);

  if (state.phase === 'closed') return null;
  return <ModelFromDrawingPanel state={state} actions={actions} />;
}
