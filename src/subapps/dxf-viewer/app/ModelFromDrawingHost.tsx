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
  modelFromDrawingOpeningsSession,
  type OpeningSessionDeps,
} from '../systems/model-from-drawing/model-from-drawing-openings-session';
import {
  modelFromDrawingStore,
  useModelFromDrawingState,
} from '../systems/model-from-drawing/model-from-drawing-store';
import type { Point2D } from '../rendering/types/Types';
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

/** Τα σημεία κόσμου ενός στοιχείου — τοίχου (το ορθογώνιό του) ή ανοίγματος (η ζώνη ή το κενό του). */
function proposalItemPoints(key: string): readonly Point2D[] {
  const state = modelFromDrawingStore.get();
  const wall = state.proposal?.items.find((i) => i.key === key);
  if (wall) return wall.rect.polygon.map((p) => ({ x: p.x, y: p.y }));
  const zone = state.openingPreview?.zones.find((z) => z.key === key);
  if (zone && zone.pieces.length > 0) return zone.pieces.flat();
  const span = state.openingProposal?.items.find((i) => i.key === key)?.span;
  return span ? [span.start, span.end] : [];
}

/**
 * Φέρνει στην οθόνη ένα στοιχείο της πρότασης (2Δ· στο 3Δ δεν υπάρχει υψόμετρο να δοθεί). Το
 * ΠΡΩΤΟ άλμα μιας συνεδρίας πλαισιώνει το στοιχείο· τα επόμενα μόνο κεντράρουν, ώστε η κλίμακα
 * που έστησε ο άνθρωπος να μη χάνεται σε κάθε βέλος της ουράς (σύμβαση του `review-focus`).
 */
function focusProposalItem(key: string): void {
  const preserveZoom = modelFromDrawingStore.get().focusedKey !== null;
  modelFromDrawingSession.focus(key);
  const extent = reviewFocusExtent(proposalItemPoints(key), FOCUS_PAD_MM);
  if (extent) focusReviewTarget(extent, () => null, preserveZoom);
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

/**
 * Όσο ο βοηθός είναι οπλισμένος: οδηγία στη γραμμή κατάστασης, και Esc. Το Esc ακυρώνει ΜΟΝΟ
 * ό,τι περίμενε: το δείγμα «κούφωμα» γυρίζει στον έλεγχο (η πρόταση τοίχων μένει)· το δείγμα
 * «τοίχος» κλείνει τον βοηθό, όπως πάντα.
 */
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
            if (!modelFromDrawingOpeningsSession.cancelSample()) modelFromDrawingSession.close();
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
  const openingsUndoName = t('modelFromDrawing.openings.undoName');
  /** Οι εξαρτήσεις του ελεγκτή ανοιγμάτων: η ΙΔΙΑ σκηνή και στρώσεις, δική του εγγραφή ιστορικού. */
  const getOpeningDeps = React.useCallback(
    (): OpeningSessionDeps => ({ ...getDeps(), undoName: openingsUndoName }),
    [getDeps, openingsUndoName],
  );
  const picking = state.phase === 'picking';
  useSamplePickMode(picking, state.sampleRole === 'opening'
    ? t('modelFromDrawing.openings.pickHint')
    : t('modelFromDrawing.pickHint'));

  React.useEffect(() => EventBus.on('dxf:model-from-drawing-requested', start), [start]);

  // Το κλικ του καμβά άφησε δείγμα → το υιοθετεί ο ελεγκτής του ρόλου του (one-shot· ο καθένας
  // αγνοεί το δείγμα του άλλου).
  React.useEffect(() => {
    if (!state.pendingSample) return;
    modelFromDrawingSession.adoptSample(getDeps());
    modelFromDrawingOpeningsSession.adoptSample(getOpeningDeps());
  }, [state.pendingSample, getDeps, getOpeningDeps]);

  // Αλλαγή ενεργού επιπέδου με πρόταση ανοιχτή → η πρόταση αφορά άλλη σκηνή: ξαναϋπολόγισε.
  const levelId = levelManager.currentLevelId;
  React.useEffect(() => {
    modelFromDrawingSession.refresh(getDeps());
    modelFromDrawingOpeningsSession.refresh(getOpeningDeps());
  }, [levelId, getDeps, getOpeningDeps]);

  // Δίχτυ: αν ο host φύγει ενώ ο βοηθός είναι ανοιχτός, μη μείνει οπλισμένος ο καμβάς.
  React.useEffect(() => () => modelFromDrawingSession.close(), []);

  const actions = usePanelActions(start, getDeps, getOpeningDeps);

  if (state.phase === 'closed') return null;
  return <ModelFromDrawingPanel state={state} actions={actions} />;
}

/**
 * Οι πράξεις του πάνελ → ελεγκτές. Κάθε έγκριση αλλάζει τη σκηνή του ΑΛΛΟΥ βήματος: νέοι τοίχοι ⇒
 * νέοι ξενιστές για κουφώματα· νέα κουφώματα ⇒ τοίχοι που ενώθηκαν. Ο άλλος ξαναϋπολογίζει χωρίς
 * να σβήσει το «γράφτηκαν Ν».
 */
function usePanelActions(
  start: () => void,
  getDeps: () => ModelFromDrawingDeps,
  getOpeningDeps: () => OpeningSessionDeps,
): ModelFromDrawingPanelActions {
  return React.useMemo((): ModelFromDrawingPanelActions => ({
    onClose: () => modelFromDrawingSession.close(),
    onResample: start,
    onConfirmGroup: (thicknessMm, category) => modelFromDrawingSession.confirmGroup(thicknessMm, category, getDeps()),
    onSetUndecided: (key, isWall) => modelFromDrawingSession.setUndecided(key, isWall, getDeps()),
    onFocus: focusProposalItem,
    onApprove: () => {
      if (modelFromDrawingSession.approve(getDeps())) modelFromDrawingOpeningsSession.refresh(getOpeningDeps(), true);
    },
    onStartOpenings: () => modelFromDrawingOpeningsSession.armSample(),
    onChooseOpening: (keys, choice) => modelFromDrawingOpeningsSession.choose(keys, choice, getOpeningDeps()),
    onApproveOpenings: () => {
      if (modelFromDrawingOpeningsSession.approve(getOpeningDeps())) modelFromDrawingSession.refresh(getDeps(), true);
    },
  }), [start, getDeps, getOpeningDeps]);
}
