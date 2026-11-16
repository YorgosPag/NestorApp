'use client';

/**
 * ADR-911 Φ3β · ADR-929 §6.25 — το πάνελ του βοηθού **«Μοντέλο από το σχέδιο»**.
 *
 * Modeless (ο άνθρωπος πρέπει να βλέπει το σχέδιο όσο αποφασίζει). Από το §6.25 είναι **οδηγός τριών βημάτων μέσα
 * στο ίδιο πάνελ** — ① Πηγή & κλίμακα · ② Τοίχοι · ③ Κουφώματα — αντί για μία στήλη ~20 ενοτήτων χωρίς ιεραρχία:
 *
 *   · **Ράγα** πάνω: πού είμαι, τι έγινε (✓), τι θέλει απόφαση (⚠) — κάθε βήμα κουμπί, ελεύθερη μετάβαση (NN/g).
 *   · **Σώμα** μόνο του τρέχοντος βήματος· τα διαγνωστικά (σ, w, sha256, κάλυψη, βεβαιότητα) σε «Λεπτομέρειες», κλειστά.
 *   · **Υποσέλιδο** καρφωμένο: ΜΙΑ κύρια ενέργεια, με το «τι μένει έξω» δίπλα της, και η ειδοποίηση της τελευταίας πράξης.
 *   · Φαρδιά οθόνη ⇒ παλέτα που αλλάζει μέγεθος και το θυμάται· στενή ⇒ φύλλο πυθμένα (`ModelFromDrawingSurface`).
 *
 * Μερική έγκριση (ADR-929 Φ5.2ε): γράφονται οι τοίχοι των επιβεβαιωμένων ομάδων πάχους· οι υπόλοιποι μένουν έξω και
 * το λέει ρητά η γραμμή «δεν θα γραφτούν». Ο ελεγκτής ξαναελέγχει (`modelFromDrawingSession.approve`) — το κουμπί
 * είναι η ευγένεια, όχι η εγγύηση.
 *
 * Καθαρή παρουσίαση: κατάσταση ως prop, αποφάσεις ως callbacks. Χαμηλόσυχνο (ADR-040).
 *
 * @see ../../../app/ModelFromDrawingHost.tsx (ο host: store + εξαρτήσεις)
 * @see ../../../systems/model-from-drawing/model-from-drawing-session.ts (ο ελεγκτής)
 */

import * as React from 'react';
import { Wand2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { StepRail, type StepRailStatus } from '@/components/ui/step-rail';
import { useViewportClass } from '@/hooks/media/useViewportClass';
import type { WallCategory } from '../../../bim/types/wall-types';
import type {
  ModelFromDrawingNotice,
  ModelFromDrawingSampleRole,
  ModelFromDrawingState,
} from '../../../systems/model-from-drawing/model-from-drawing-store';
import { OPENING_REFUSAL_LABEL_KEY } from '../../../systems/model-from-drawing/opening-label-keys';
import { DIMENSION_LAYER_REFUSAL_LABEL_KEY } from '../../../systems/model-from-drawing/dimension-label-keys';
import type { KeepRecognizedActions } from './KeepRecognizedSection';
import type { OpeningReviewActions } from './ModelFromDrawingOpeningSections';
import type { Translate } from './ModelFromDrawingSections';
import type { ImageSourceView } from './PlanRecognitionSections';
import type { PdfVectorImportActions, PdfVectorImportView } from './PdfVectorImportSection';
import type { PlanReadingActions } from './PlanReadingSections';
import type { PlanOcrActions } from './PlanOcrSection';
import type { PlanReadValuesActions } from './PlanReadValuesSection';
import type { PlanDrawingKindActions } from './PlanDrawingKindSection';
import type { PlanScaleActions } from './PlanScaleCard';
import { MFD_STEP_ORDER, mfdStepStatuses, mfdSuggestedStep, type MfdStepId } from './model-from-drawing-steps';
import { useModelFromDrawingStep } from './useModelFromDrawingStep';
import { StepAction, StepBody, type StepProps } from './ModelFromDrawingStepBodies';
import { ModelFromDrawingSurface } from './ModelFromDrawingSurface';

export interface ModelFromDrawingPanelActions extends OpeningReviewActions, KeepRecognizedActions {
  readonly onClose: () => void;
  /** «Άλλο δείγμα»: νέα συνεδρία, οπλισμένη. */
  readonly onResample: () => void;
  readonly onConfirmGroup: (thicknessMm: number, category: WallCategory) => void;
  readonly onSetUndecided: (key: string, isWall: boolean) => void;
  /** ADR-929 §6.11 — πέταμα των αποφάσεων που δεν βρήκαν ορθογώνιο στην τρέχουσα πηγή. */
  readonly onDiscardOrphanedDecisions: () => void;
  readonly onApprove: () => void;
  /** ADR-929 Φ5 — αναγνώριση από την εικόνα του υποβάθρου του ενεργού ορόφου. */
  readonly onRecognizeImage: () => void;
  /** ADR-929 Φ5.3β — η ανάγνωση κειμένων με AI, με έλεγχο της όψης πριν την αποστολή. */
  readonly reading: PlanReadingActions;
  /** ADR-929 Φ5.3γ — η κάρτα κλίμακας από τις διαβασμένες διαστάσεις. */
  readonly scale: PlanScaleActions;
  /** ADR-929 Φ0.6 — η τοπική ανάγνωση τιμών: «Ακύρωση» · «Ξανά». */
  readonly ocr: PlanOcrActions;
  /** ADR-929 Δ21 (δ) — «Τι διάβασα»: διόρθωση τιμής · «δεν είναι διάσταση» · επαναφορά · επισήμανση. */
  readonly readValues: PlanReadValuesActions;
  /** ADR-929 Δ21 (0) · Δ7 Γ — «Σχέδιο υπό κλίμακα / Σκίτσο με το χέρι». */
  readonly drawingKind: PlanDrawingKindActions;
}

export interface ModelFromDrawingPanelProps {
  readonly state: ModelFromDrawingState;
  readonly actions: ModelFromDrawingPanelActions;
  /** ADR-929 Φ5 — η πηγή «εικόνα υποβάθρου», όπως την υπολογίζει ο host. */
  readonly imageSource: ImageSourceView;
  /** ADR-941 — εισαγωγή γραμμών και κειμένων όταν το υπόβαθρο είναι διανυσματικό PDF. */
  readonly pdfVectorImport: { readonly view: PdfVectorImportView } & PdfVectorImportActions;
}

/**
 * ADR-929 Δ20 Σ1.3β — «γράφτηκαν»: τοίχοι, και στην ίδια πρόταση ό,τι έγινε με τις διαστάσεις της ίδιας έγκρισης.
 * Τρία ολόκληρα μηνύματα (κανένα συναρμολογημένο): μόνο τοίχοι · τοίχοι + διαστάσεις · τοίχοι, διαστάσεις αρνήθηκαν.
 */
function writtenText(notice: Extract<ModelFromDrawingNotice, { kind: 'written' }>, t: Translate): string {
  const { count, dimensions } = notice;
  if (dimensions?.kind === 'refused') {
    const reason = t(DIMENSION_LAYER_REFUSAL_LABEL_KEY[dimensions.reason]);
    return t('modelFromDrawing.notice.writtenDimensionsRefused', { count, reason });
  }
  if (dimensions && dimensions.count > 0) {
    return t('modelFromDrawing.notice.writtenWithDimensions', { count, dimensions: dimensions.count });
  }
  return t('modelFromDrawing.notice.written', { count });
}

/**
 * ADR-929 §6.20 — «κρατήθηκαν»: ολόκληρη πρόταση για τα πλήθη, και για κάθε στρώση που αρνήθηκε ΔΙΚΗ της ολόκληρη
 * πρόταση με τον λόγο (καμία συναρμολογημένη φράση· τίποτα σιωπηλό).
 */
function keptText(notice: Extract<ModelFromDrawingNotice, { kind: 'kept' }>, t: Translate): string {
  const written = (o: typeof notice.lines): number => (o?.kind === 'written' ? o.count : 0);
  const dimensions = written(notice.dimensions);
  const lines = written(notice.lines);
  const parts = [dimensions + lines > 0
    ? t('modelFromDrawing.notice.kept', { dimensions, lines })
    : t('modelFromDrawing.notice.keptNothing')];
  if (notice.dimensions?.kind === 'refused') {
    parts.push(t('modelFromDrawing.notice.keptDimensionsRefused', { reason: t(DIMENSION_LAYER_REFUSAL_LABEL_KEY[notice.dimensions.reason]) }));
  }
  if (notice.lines?.kind === 'refused') {
    parts.push(t('modelFromDrawing.notice.keptLinesRefused', { reason: t(DIMENSION_LAYER_REFUSAL_LABEL_KEY[notice.lines.reason]) }));
  }
  return parts.join(' ');
}

/** Κάθε ειδοποίηση με ΡΗΤΟ κλειδί (όχι συναρμολογημένο): το CHECK 3.8 βλέπει ότι υπάρχουν όλα. */
function noticeText(notice: ModelFromDrawingNotice, role: ModelFromDrawingSampleRole, t: Translate): string {
  switch (notice.kind) {
    case 'no-scene': return t('modelFromDrawing.notice.no-scene');
    case 'no-line':
      return role === 'opening' ? t('modelFromDrawing.notice.no-line-opening') : t('modelFromDrawing.notice.no-line');
    case 'no-color': return t('modelFromDrawing.notice.no-color');
    case 'stale': return t('modelFromDrawing.notice.stale');
    case 'uncalibrated': return t('modelFromDrawing.notice.uncalibrated');
    case 'written': return writtenText(notice, t);
    case 'kept': return keptText(notice, t);
    case 'no-walls': return t('modelFromDrawing.notice.no-walls');
    case 'openings-written': return t('modelFromDrawing.notice.openings-written', { count: notice.count });
    case 'openings-refused': return t(OPENING_REFUSAL_LABEL_KEY[notice.refusal]);
    case 'refused':
      if (notice.refusal === 'overlap') return t('modelFromDrawing.notice.refused.overlap', { blocked: notice.blocked });
      if (notice.refusal === 'nothing-to-write') return t('modelFromDrawing.notice.refused.nothing-to-write');
      return t('modelFromDrawing.notice.refused.no-active-scene');
  }
}

/** Η ειδοποίηση της τελευταίας πράξης — στο υποσέλιδο, ΔΙΠΛΑ στην ενέργεια που την προκάλεσε. */
function Notice({ state, t }: { readonly state: ModelFromDrawingState; readonly t: Translate }): React.ReactElement | null {
  const { notice } = state;
  if (!notice) return null;
  return (
    <p
      className="m-0 rounded border border-border bg-accent/60 px-2 py-1.5 text-[11px] text-foreground"
      role="status" data-testid="mfd-notice" data-kind={notice.kind}
    >
      {noticeText(notice, state.sampleRole, t)}
    </p>
  );
}

/** ΡΗΤΑ κλειδιά ανά βήμα και κατάσταση (CHECK 3.8 — κανένα συναρμολογημένο). */
const STEP_LABEL_KEY: Readonly<Record<MfdStepId, string>> = {
  source: 'modelFromDrawing.steps.source.label',
  walls: 'modelFromDrawing.steps.walls.label',
  openings: 'modelFromDrawing.steps.openings.label',
};
const STEP_STATUS_KEY: Readonly<Record<StepRailStatus, string>> = {
  done: 'modelFromDrawing.steps.status.done',
  attention: 'modelFromDrawing.steps.status.attention',
  pending: 'modelFromDrawing.steps.status.pending',
};

/** Έχει το βήμα κάτι να πει στο υποσέλιδο; (ενέργεια ή ειδοποίηση) — αλλιώς κανένα άδειο πλαίσιο. */
function hasFooter(step: MfdStepId, state: ModelFromDrawingState): boolean {
  if (state.notice) return true;
  return step === 'openings' ? state.openingProposal !== null : state.proposal !== null;
}

export function ModelFromDrawingPanel(props: ModelFromDrawingPanelProps): React.ReactElement | null {
  const { state, actions, imageSource } = props;
  // `dxf-viewer-panels`: οι λόγοι «άκυρο όνομα επιπέδου» είναι τα ίδια κείμενα με τη μετονομασία layer (Σ1.3β).
  // `common`: το «Κλείσιμο» του φύλλου (`buttons.close`) — δίνεται στην επιφάνεια ως `closeLabel`.
  const { t } = useTranslation(['dxf-viewer-shell', 'dxf-viewer-panels', 'common']);
  const viewport = useViewportClass();
  const { current, select } = useModelFromDrawingStep(mfdSuggestedStep(state, imageSource));
  if (state.phase === 'closed') return null;

  const statuses = mfdStepStatuses(state, imageSource);
  const steps = MFD_STEP_ORDER.map((id) => ({
    id, label: t(STEP_LABEL_KEY[id]), status: statuses[id], statusLabel: t(STEP_STATUS_KEY[statuses[id]]),
  }));
  const stepProps: StepProps = { ...props, t, onSelectStep: select };
  return (
    <ModelFromDrawingSurface
      viewport={viewport} title={t('modelFromDrawing.title')} onClose={actions.onClose} closeLabel={t('buttons.close')} t={t}
      icon={<Wand2 className="size-4" aria-hidden="true" />}
      rail={<StepRail steps={steps} currentId={current} onSelect={select} ariaLabel={t('modelFromDrawing.steps.label')} data-testid="mfd-steps" />}
      body={<StepBody step={current} {...stepProps} />}
      footer={hasFooter(current, state) ? (
        <>
          <Notice state={state} t={t} />
          <StepAction step={current} {...stepProps} />
        </>
      ) : null}
    />
  );
}
