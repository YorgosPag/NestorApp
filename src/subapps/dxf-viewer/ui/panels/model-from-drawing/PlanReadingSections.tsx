'use client';

/**
 * ADR-929 Φ5.3β — το τμήμα του πάνελ για την **ανάγνωση κειμένων με AI**: άνοιγμα της όψης, εργαλεία σήμανσης, «Έλεγχος
 * πριν την αποστολή» (εκτίμηση · υπόλοιπο · λόγος), το πακέτο που θα φύγει (μικρογραφία από τα **ίδια** bytes, διαστάσεις,
 * μέγεθος, sha256), η αποστολή και το αποτέλεσμα με απόδειξη παραλαβής.
 *
 * Καθαρή παρουσίαση: δεν διαβάζει store, δεν γράφει τίποτα· ό,τι αποφασίζει ο άνθρωπος φεύγει προς τα πάνω ως callback.
 * 🔒 Ποτέ αυτόματη αποστολή: το «Αποστολή» ενεργοποιείται μόνο με πακέτο **και** «επιτρέπεται».
 *
 * @see ../../../systems/plan-recognition/plan-reading-review.ts (ο ελεγκτής)
 */

import * as React from 'react';
import { CheckCircle2, Eye, Loader2, ScanText, Send, ShieldAlert, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { formatFileSize } from '@/utils/file-validation';
import type { PlanReadingUnavailableReason } from '../../../bim/plan-recognition/plan-recognition-types';
import type {
  PlanReadingPacket,
  PlanReadingPreflightState,
  PlanReadingReview,
  PlanReadingSendState,
  PlanReadingWallsStatus,
} from '../../../systems/plan-recognition/plan-recognition-store';
import { MUTED, SECTION_TITLE, type Translate } from './ModelFromDrawingSections';

export interface PlanReadingActions {
  readonly onBegin: () => void;
  readonly onEnd: () => void;
  readonly onToggleAddRegion: () => void;
  readonly onReset: () => void;
  /** ADR-929 §6.10 Α2 — η ανάγνωση που ακυρώθηκε από αλλαγή της όψης επιστρέφει (ένα επίπεδο). */
  readonly onUndoReadingDrop: () => void;
  readonly onPrepare: () => void;
  readonly onSend: () => void;
}

/** Κάθε λόγος με ΡΗΤΟ κλειδί· εξαντλητικό: νέος λόγος χωρίς κείμενο = σφάλμα μεταγλώττισης (CHECK 3.8 βλέπει όλα). */
const REASON_KEY: Readonly<Record<PlanReadingUnavailableReason, string>> = {
  'ai-disabled-for-company': 'modelFromDrawing.image.reading.reason.ai-disabled-for-company',
  'ai-legal-disclosure-pending': 'modelFromDrawing.image.reading.reason.ai-legal-disclosure-pending',
  'allowance-exhausted': 'modelFromDrawing.image.reading.reason.allowance-exhausted',
  'allowance-unverifiable': 'modelFromDrawing.image.reading.reason.allowance-unverifiable',
  'page-cost-exceeds-cap': 'modelFromDrawing.image.reading.reason.page-cost-exceeds-cap',
  'cost-unknown': 'modelFromDrawing.image.reading.reason.cost-unknown',
  'reader-unconfigured': 'modelFromDrawing.image.reading.reason.reader-unconfigured',
  'reading-in-progress': 'modelFromDrawing.image.reading.reason.reading-in-progress',
  'reader-failed': 'modelFromDrawing.image.reading.reason.reader-failed',
};

/** Κάθε κατάσταση των τοίχων με ΡΗΤΟ κλειδί (εξαντλητικό, CHECK 3.8). */
const WALLS_STATUS_KEY: Readonly<Record<PlanReadingWallsStatus, string>> = {
  following: 'modelFromDrawing.image.reading.walls.following',
  updating: 'modelFromDrawing.image.reading.walls.updating',
  failed: 'modelFromDrawing.image.reading.walls.failed',
};

/** Ποσά σε USD (η τιμολόγηση του παρόχου): έως 4 δεκαδικά, γιατί μια σελίδα κοστίζει λίγα σεντς. */
const usd = (amount: number): string => formatCurrency(amount, 'USD', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function Refusal({ reason, t }: { readonly reason: PlanReadingUnavailableReason; readonly t: Translate }): React.ReactElement {
  return (
    <section className="flex flex-col gap-0.5" role="status" data-testid="mfd-reading-refusal" data-reason={reason}>
      <p className="m-0 flex items-start gap-1.5 text-[11px] text-foreground">
        <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span>{t(REASON_KEY[reason])}</span>
      </p>
      <p className={MUTED}>{t('modelFromDrawing.image.reading.geometryOnly')}</p>
    </section>
  );
}

function PreflightBlock({ preflight, t }: { readonly preflight: PlanReadingPreflightState; readonly t: Translate }): React.ReactElement | null {
  if (preflight.status === 'idle') return null;
  if (preflight.status === 'checking') return <p className={MUTED} role="status">{t('modelFromDrawing.image.reading.checking')}</p>;
  if (preflight.status === 'failed') return <p className="m-0 text-[11px] text-destructive" role="status">{t('modelFromDrawing.image.reading.preflightFailed')}</p>;
  const { result } = preflight;
  if (result.status === 'unavailable') return <Refusal reason={result.reason} t={t} />;
  return (
    <p className="m-0 text-[11px] text-foreground" data-testid="mfd-reading-estimate">
      {t('modelFromDrawing.image.reading.estimate', {
        estimate: usd(result.estimateUsd), remaining: usd(result.remainingUsd), cap: usd(result.monthlyCapUsd),
      })}
    </p>
  );
}

/** «Ό,τι βλέπεις, αυτό φεύγει»: η μικρογραφία είναι URL του **ίδιου** Blob που θα σταλεί. */
function PacketBlock({ packet, language, t }: { readonly packet: PlanReadingPacket; readonly language: string; readonly t: Translate }): React.ReactElement {
  return (
    <figure className="m-0 flex flex-col gap-1" data-testid="mfd-reading-packet">
      <img
        src={packet.previewUrl} alt={t('modelFromDrawing.image.reading.previewAlt')}
        className="max-h-40 w-full rounded border border-border bg-background object-contain"
        data-testid="mfd-reading-preview"
      />
      <figcaption className="flex flex-col gap-0.5">
        <span className={MUTED}>
          {t('modelFromDrawing.image.reading.packetSize', {
            width: packet.widthPx, height: packet.heightPx, size: formatFileSize(packet.blob.size, language),
          })}
        </span>
        <span className={MUTED}>
          {t('modelFromDrawing.image.reading.fingerprint')}{' '}
          <code className="break-all font-mono text-[10px] text-foreground" data-testid="mfd-reading-sha">{packet.sha256}</code>
        </span>
      </figcaption>
    </figure>
  );
}

function SendResult({ send, t }: { readonly send: PlanReadingSendState; readonly t: Translate }): React.ReactElement | null {
  switch (send.status) {
    case 'read':
      return (
        <section className="flex flex-col gap-0.5" role="status" data-testid="mfd-reading-result">
          <p className="m-0 flex items-center gap-1.5 text-[11px] text-foreground">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{t('modelFromDrawing.image.reading.receiptOk')}</span>
          </p>
          <p className={MUTED}>{t('modelFromDrawing.image.reading.readCounts', { ...send.counts })}</p>
          {send.cacheHit ? <p className={MUTED}>{t('modelFromDrawing.image.reading.cacheHit')}</p> : null}
        </section>
      );
    case 'unavailable': return <Refusal reason={send.reason} t={t} />;
    case 'receipt-mismatch':
      return <p className="m-0 text-[11px] text-destructive" role="alert" data-testid="mfd-reading-mismatch">{t('modelFromDrawing.image.reading.receiptMismatch')}</p>;
    case 'failed': return <p className="m-0 text-[11px] text-destructive" role="status">{t('modelFromDrawing.image.reading.sendFailed')}</p>;
    case 'prepare-failed': return <p className="m-0 text-[11px] text-destructive" role="status">{t('modelFromDrawing.image.reading.prepareFailed')}</p>;
    default: return null;
  }
}

/**
 * ADR-929 §6.10 Α2 — οι τοίχοι απέναντι στην όψη: ακολουθούν · ενημερώνονται · απέτυχαν. Πριν την πρώτη αλλαγή με ζωντανή
 * ανάγνωση, προειδοποίηση· μετά το σβήσιμό της, «Αναίρεση».
 */
function WallsBlock({ review, readingAdopted, onUndo, t }: {
  readonly review: PlanReadingReview;
  readonly readingAdopted: boolean;
  readonly onUndo: () => void;
  readonly t: Translate;
}): React.ReactElement {
  const { status, readingDropped } = review.walls;
  return (
    <section className="flex flex-col gap-1" data-testid="mfd-reading-walls" data-status={status}>
      <p className={status === 'failed' ? 'm-0 text-[11px] text-destructive' : MUTED} role="status">
        {status === 'updating' ? <Loader2 className="mr-1 inline size-3 animate-spin" aria-hidden="true" /> : null}
        {t(WALLS_STATUS_KEY[status])}
      </p>
      {readingAdopted && !readingDropped ? <p className={MUTED}>{t('modelFromDrawing.image.reading.walls.readingNote')}</p> : null}
      {readingDropped ? (
        <p className="m-0 flex flex-wrap items-center gap-1.5 text-[11px] text-foreground" role="status" data-testid="mfd-reading-dropped">
          <span>{t('modelFromDrawing.image.reading.walls.readingDropped')}</span>
          <Button type="button" variant="outline" size="xs" disabled={review.send.status === 'sending'} onClick={onUndo}
            data-testid="mfd-reading-undo">
            <Undo2 className="size-3" aria-hidden="true" />
            {t('modelFromDrawing.image.reading.walls.undo')}
          </Button>
        </p>
      ) : null}
    </section>
  );
}

function MarkingTools({ review, actions, t }: { readonly review: PlanReadingReview; readonly actions: PlanReadingActions; readonly t: Translate }): React.ReactElement {
  const busy = review.send.status === 'sending' || review.send.status === 'preparing';
  const adding = review.tool === 'add-redaction';
  return (
    <section className="flex flex-col gap-1.5">
      <p className={MUTED}>{t('modelFromDrawing.image.reading.instructions')}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('modelFromDrawing.image.reading.toolsLabel')}>
        <ToggleButton type="button" variant="outline" size="xs" pressed={adding} disabled={busy}
          onClick={actions.onToggleAddRegion} data-testid="mfd-reading-add-region">
          {t('modelFromDrawing.image.reading.addRegion')}
        </ToggleButton>
        <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={actions.onReset} data-testid="mfd-reading-reset">
          {t('modelFromDrawing.image.reading.reset')}
        </Button>
      </div>
      <p className={MUTED}>{t('modelFromDrawing.image.reading.regionCount', { count: review.view.redacted.length })}</p>
    </section>
  );
}

function ReviewBody({ review, readingAdopted, actions, language, t }: {
  readonly review: PlanReadingReview;
  readonly readingAdopted: boolean;
  readonly actions: PlanReadingActions;
  readonly language: string;
  readonly t: Translate;
}): React.ReactElement {
  const { send, preflight, packet } = review;
  const preparing = send.status === 'preparing';
  const sending = send.status === 'sending';
  const wallsUpdating = review.walls.status === 'updating';
  const allowed = preflight.status === 'done' && preflight.result.status === 'allowed';
  return (
    <>
      <MarkingTools review={review} actions={actions} t={t} />
      <WallsBlock review={review} readingAdopted={readingAdopted} onUndo={actions.onUndoReadingDrop} t={t} />
      <Button type="button" variant="outline" size="sm" disabled={preparing || sending || wallsUpdating} onClick={actions.onPrepare}
        data-testid="mfd-reading-prepare">
        {preparing ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
        {t('modelFromDrawing.image.reading.prepare')}
      </Button>
      <PreflightBlock preflight={preflight} t={t} />
      {packet ? <PacketBlock packet={packet} language={language} t={t} /> : null}
      <Button type="button" size="sm" disabled={!packet || !allowed || sending} onClick={actions.onSend} data-testid="mfd-reading-send">
        {sending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
        {t('modelFromDrawing.image.reading.send')}
      </Button>
      <SendResult send={send} t={t} />
      <Button type="button" variant="ghost" size="xs" disabled={sending} onClick={actions.onEnd} data-testid="mfd-reading-close">
        {t('modelFromDrawing.image.reading.close')}
      </Button>
    </>
  );
}

/** Στον έλεγχο, όταν η πηγή είναι η εικόνα: η ανάγνωση κειμένων (διαστάσεις, χώροι, ανοίγματα). */
export function PlanReadingSection({ available, readingAdopted, review, actions, t }: {
  /** Υπάρχει αποτέλεσμα αναγνώρισης γεωμετρίας για να διαβαστεί. */
  readonly available: boolean;
  /** ADR-929 §6.10 Α2 — μια ανάγνωση AI είναι στη σύντηξη. */
  readonly readingAdopted: boolean;
  readonly review: PlanReadingReview | null;
  readonly actions: PlanReadingActions;
  readonly t: Translate;
}): React.ReactElement | null {
  const { currentLanguage: language } = useTranslation('dxf-viewer-shell');
  if (!available) return null;
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-2" data-testid="mfd-reading">
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.image.reading.title')}</h4>
      {review ? <ReviewBody review={review} readingAdopted={readingAdopted} actions={actions} language={language} t={t} /> : (
        <>
          <p className={MUTED}>{t('modelFromDrawing.image.reading.intro')}</p>
          <Button type="button" variant="outline" size="sm" onClick={actions.onBegin} data-testid="mfd-reading-begin">
            <ScanText className="size-3.5" aria-hidden="true" />
            {t('modelFromDrawing.image.reading.begin')}
          </Button>
        </>
      )}
    </section>
  );
}
