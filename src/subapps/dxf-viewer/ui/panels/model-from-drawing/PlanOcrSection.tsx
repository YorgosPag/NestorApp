'use client';

/**
 * ADR-929 Φ0.6 — το τμήμα του πάνελ για την **τοπική ανάγνωση τιμών** (OCR στη συσκευή): ξεκινά μόνη της μετά την
 * αναγνώριση, με στάδιο, γραμμή προόδου και «Ακύρωση»· μετά, τι διαβάστηκε (ή γιατί όχι, με «Ξανά»).
 *
 * Καθαρή παρουσίαση: δεν διαβάζει store, δεν γράφει τίποτα· ό,τι αποφασίζει ο άνθρωπος φεύγει προς τα πάνω ως callback.
 *
 * @see ../../../systems/plan-recognition/plan-ocr-controller.ts (ο ελεγκτής)
 */

import * as React from 'react';
import { CheckCircle2, Loader2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { PlanOcrFailure, PlanOcrStage, PlanOcrState } from '../../../systems/plan-recognition/plan-recognition-store';
import { MUTED, SECTION_TITLE, type Translate } from './ModelFromDrawingSections';

/** Ό,τι χρειάζεται το πάνελ για την τοπική ανάγνωση — υπολογισμένο από τον host. */
export interface PlanOcrView {
  readonly state: PlanOcrState;
  /** Η τοπική ανάγνωση είναι αυτή που μετρά στη σύντηξη (όχι η ανάγνωση AI). */
  readonly inUse: boolean;
  /** Τι μετρά από αυτήν στην τρέχουσα όψη· `null` όταν δεν μετρά. */
  readonly counts: { readonly texts: number; readonly dimensions: number } | null;
}

export interface PlanOcrActions {
  readonly onCancel: () => void;
  readonly onRetry: () => void;
}

/** Κάθε στάδιο με ΡΗΤΟ κλειδί (CHECK 3.8)· `starting` = πριν την πρώτη αναφορά προόδου. */
const STAGE_KEY: Readonly<Record<PlanOcrStage | 'starting', string>> = {
  starting: 'modelFromDrawing.image.ocr.stage.starting',
  load: 'modelFromDrawing.image.ocr.stage.load',
  detect: 'modelFromDrawing.image.ocr.stage.detect',
  read: 'modelFromDrawing.image.ocr.stage.read',
};

/** Κάθε αποτυχία με ΡΗΤΟ κλειδί· εξαντλητικό: νέος λόγος χωρίς κείμενο = σφάλμα μεταγλώττισης. */
const FAILURE_KEY: Readonly<Record<PlanOcrFailure, string>> = {
  'no-pixels': 'modelFromDrawing.image.ocr.failure.no-pixels',
  'worker-unavailable': 'modelFromDrawing.image.ocr.failure.worker-unavailable',
  'models-unavailable': 'modelFromDrawing.image.ocr.failure.models-unavailable',
  'ocr-failed': 'modelFromDrawing.image.ocr.failure.ocr-failed',
};

type RunningState = Extract<PlanOcrState, { status: 'running' }>;

function Running({ state, onCancel, t }: { readonly state: RunningState; readonly onCancel: () => void; readonly t: Translate }): React.ReactElement {
  const percent = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
  return (
    <section className="flex flex-col gap-1" role="status" data-testid="mfd-ocr-running" data-stage={state.stage ?? 'starting'}>
      <p className="m-0 flex items-center gap-1.5 text-[11px] text-foreground">
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
        <span>{t(STAGE_KEY[state.stage ?? 'starting'])}</span>
        {state.total > 0 ? <span className={MUTED}>{t('modelFromDrawing.image.ocr.progress', { done: state.done, total: state.total })}</span> : null}
      </p>
      <Progress value={percent} className="h-1.5" aria-label={t('modelFromDrawing.image.ocr.progressLabel')} data-testid="mfd-ocr-progress" />
      <Button type="button" variant="ghost" size="xs" onClick={onCancel} className="self-start" data-testid="mfd-ocr-cancel">
        <X className="size-3" aria-hidden="true" />
        {t('modelFromDrawing.image.ocr.cancel')}
      </Button>
    </section>
  );
}

function Retry({ message, destructive, onRetry, t }: {
  readonly message: string;
  readonly destructive: boolean;
  readonly onRetry: () => void;
  readonly t: Translate;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-1" role="status" data-testid="mfd-ocr-stopped">
      <p className={destructive ? 'm-0 text-[11px] text-destructive' : MUTED}>{message}</p>
      <Button type="button" variant="outline" size="xs" onClick={onRetry} className="self-start" data-testid="mfd-ocr-retry">
        <RotateCcw className="size-3" aria-hidden="true" />
        {t('modelFromDrawing.image.ocr.retry')}
      </Button>
    </section>
  );
}

function Done({ view, t }: { readonly view: PlanOcrView; readonly t: Translate }): React.ReactElement {
  if (!view.inUse || !view.counts) return <p className={MUTED} role="status" data-testid="mfd-ocr-ai-preferred">{t('modelFromDrawing.image.ocr.aiPreferred')}</p>;
  return (
    <p className="m-0 flex items-start gap-1.5 text-[11px] text-foreground" role="status" data-testid="mfd-ocr-result">
      <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{t('modelFromDrawing.image.ocr.result', { ...view.counts })}</span>
    </p>
  );
}

function OcrBody({ view, actions, t }: { readonly view: PlanOcrView; readonly actions: PlanOcrActions; readonly t: Translate }): React.ReactElement | null {
  const { state } = view;
  switch (state.status) {
    case 'running': return <Running state={state} onCancel={actions.onCancel} t={t} />;
    case 'done': return <Done view={view} t={t} />;
    case 'cancelled': return <Retry message={t('modelFromDrawing.image.ocr.cancelled')} destructive={false} onRetry={actions.onRetry} t={t} />;
    case 'failed': return <Retry message={t(FAILURE_KEY[state.reason])} destructive onRetry={actions.onRetry} t={t} />;
    default: return null;
  }
}

/** Στον έλεγχο, όταν η πηγή είναι η εικόνα: η τοπική ανάγνωση των γραμμένων τιμών. */
export function PlanOcrSection({ view, actions, t }: {
  readonly view: PlanOcrView;
  readonly actions: PlanOcrActions;
  readonly t: Translate;
}): React.ReactElement | null {
  if (view.state.status === 'idle') return null;
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-2" data-testid="mfd-ocr" data-status={view.state.status}>
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.image.ocr.title')}</h4>
      <p className={MUTED}>{t('modelFromDrawing.image.ocr.localNote')}</p>
      <OcrBody view={view} actions={actions} t={t} />
    </section>
  );
}
