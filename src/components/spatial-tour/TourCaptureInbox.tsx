'use client';

/**
 * @fileoverview **ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ ΛΗΨΕΩΝ** — οι λήψεις της περιήγησης (ατοποθέτητες πρώτα) + ανέβασμα.
 * @related ADR-884 Φ0.8 · §4.5 (Κ3α — «Unplaced 360° Views», πρότυπο Matterport) · `TourCaptureUploadForm.tsx`
 * @module components/spatial-tour/TourCaptureInbox
 *
 * 🔑 **Ίδιο συστατικό για υπεύθυνο και φωτογράφο** — τι βλέπει ο καθένας το κρίνει ο **διακομιστής** (`listTourCaptures`:
 * υπεύθυνος ⇒ όλες, φωτογράφος ⇒ οι δικές του). Η οθόνη δεν φιλτράρει τίποτα μόνη της.
 * 🔑 Ταξινόμηση **στη μνήμη** (νεότερη λήψη πρώτη, `newestCaptureFirst` — η ΜΙΑ σειρά) — ο διακομιστής δεν ζητά σύνθετο
 *   δείκτη για λίστα ≤ 200.
 * 🔑 **Η πρόταση θέσης του φωτογράφου** (ADR-904 Κ8) φαίνεται στις **ατοποθέτητες** — μετά την τοποθέτηση μιλά η απόφαση.
 * 🔑 **«Τοποθέτηση στην περιήγηση»** μόνο όταν ο διακομιστής λέει `asManager` (ADR-884 Φ2δ) — ο φωτογράφος ανεβάζει, ο
 *   υπεύθυνος οργανώνει (πρότυπο Matterport).
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import { newestCaptureFirst } from '@/lib/spatial-tour/tour-editor-model';
import type { CaptureLevelChoice } from '@/lib/spatial-tour/tour-capture-placement-hint';
import { listTourCapturesFromScreen } from '@/services/spatial-tour/spatial-tour.client';
import type { TourCapture, TourSubject } from '@/types/spatial-tour';

import { MILESTONE_KEY, PANEL_KEYS, UPLOAD_SOURCE_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { TourCaptureUploadForm } from './TourCaptureUploadForm';

/** Μόνο για τον υπεύθυνο — πίσω από όριο, ώστε η σελίδα του φωτογράφου να μην κουβαλά τις λέξεις του (ADR-744 §15). */
const TourEditorDialog = dynamic(() => import('./editor/TourEditorDialog').then((m) => m.TourEditorDialog), { ssr: false });
/**
 * Η πρόταση θέσης (ADR-904 Κ8) — πίσω από όριο: οι λήψεις φορτώνονται **μετά** το fetch, άρα δεν ζωγραφίζεται ποτέ στο πρώτο
 * καρέ· οι 25 ονομασίες χώρων δεν έχουν θέση στο i18n slice της σελίδας (ADR-744, μετρημένο +29% χωρίς το όριο).
 */
const TourCapturePlacementHint = dynamic(() => import('./TourCapturePlacementHint').then((m) => m.TourCapturePlacementHint), { ssr: false });

type CapturesLoad =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'loaded';
      readonly captures: readonly TourCapture[];
      readonly asManager: boolean;
      readonly levels: readonly CaptureLevelChoice[];
    }
  | { readonly kind: 'failed' };

function useTourCaptures(subject: TourSubject) {
  const [load, setLoad] = useState<CapturesLoad>({ kind: 'loading' });
  const refresh = useCallback(async () => {
    const result = await listTourCapturesFromScreen(subject);
    if (result.kind === 'ok') {
      const { captures, asManager, levels } = result.value;
      return setLoad({ kind: 'loaded', captures: [...captures].sort(newestCaptureFirst), asManager, levels });
    }
    // Η περιήγηση δεν υπάρχει ακόμη ⇒ κενά εισερχόμενα, όχι σφάλμα (τη γεννά το πρώτο ανέβασμα).
    setLoad(result.kind === 'refused' && result.reason === 'tour-absent' ? { kind: 'loaded', captures: [], asManager: false, levels: [] } : { kind: 'failed' });
  }, [subject]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { load, refresh };
}

export function TourCaptureInbox({ subject }: { readonly subject: TourSubject }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { load, refresh } = useTourCaptures(subject);
  return (
    <section className="space-y-3" aria-labelledby="tour-inbox-heading">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="tour-inbox-heading" className="text-base font-semibold">{t(PANEL_KEYS.captures)}</h3>
        {load.kind === 'loaded' && load.asManager && load.captures.length > 0 && (
          <TourEditorDialog subject={subject} onClosed={() => void refresh()} />
        )}
      </header>
      <TourCaptureUploadForm subject={subject} onUploaded={() => void refresh()} />
      {load.kind === 'failed' && (
        <p className="text-sm text-destructive" role="alert">
          {t(PANEL_KEYS.loadFailed)}{' '}
          <Button type="button" variant="link" size="sm" onClick={() => void refresh()}>{t(PANEL_KEYS.retry)}</Button>
        </p>
      )}
      {load.kind === 'loaded' && (load.captures.length === 0
        ? <p className="text-sm text-muted-foreground">{t(PANEL_KEYS.noCaptures)}</p>
        : <CaptureList captures={load.captures} levels={load.levels} subject={subject} />)}
    </section>
  );
}

function CaptureList({ captures, levels, subject }: { readonly captures: readonly TourCapture[]; readonly levels: readonly CaptureLevelChoice[]; readonly subject: TourSubject }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <ul className="divide-y rounded-md border">
      {captures.map((capture) => (
        <li key={capture.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
          <span className="font-medium">{t(PANEL_KEYS.capturedAt, { date: formatDate(capture.capturedAt) })}</span>
          {capture.source !== 'bim-render' && <span className="text-muted-foreground">{t(UPLOAD_SOURCE_KEY[capture.source])}</span>}
          {capture.milestone !== null && <Badge variant="secondary">{t(MILESTONE_KEY[capture.milestone])}</Badge>}
          {capture.nodeId === null && <Badge variant="outline">{t(PANEL_KEYS.unplaced)}</Badge>}
          <span className="ms-auto text-muted-foreground">{capture.rights.copyrightNotice}</span>
          {capture.nodeId === null && capture.placementHint !== undefined && <TourCapturePlacementHint hint={capture.placementHint} levels={levels} subject={subject} />}
        </li>
      ))}
    </ul>
  );
}
