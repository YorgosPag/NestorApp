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
import { listTourCapturesFromScreen } from '@/services/spatial-tour/spatial-tour.client';
import type { TourCapture, TourSubject } from '@/types/spatial-tour';

import { MILESTONE_KEY, PANEL_KEYS, UPLOAD_SOURCE_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { TourCaptureUploadForm } from './TourCaptureUploadForm';

/** Μόνο για τον υπεύθυνο — πίσω από όριο, ώστε η σελίδα του φωτογράφου να μην κουβαλά τις λέξεις του (ADR-744 §15). */
const TourEditorDialog = dynamic(() => import('./editor/TourEditorDialog').then((m) => m.TourEditorDialog), { ssr: false });

type CapturesLoad =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly captures: readonly TourCapture[]; readonly asManager: boolean }
  | { readonly kind: 'failed' };

function useTourCaptures(subject: TourSubject) {
  const [load, setLoad] = useState<CapturesLoad>({ kind: 'loading' });
  const refresh = useCallback(async () => {
    const result = await listTourCapturesFromScreen(subject);
    if (result.kind === 'ok') {
      return setLoad({ kind: 'loaded', captures: [...result.value.captures].sort(newestCaptureFirst), asManager: result.value.asManager });
    }
    // Η περιήγηση δεν υπάρχει ακόμη ⇒ κενά εισερχόμενα, όχι σφάλμα (τη γεννά το πρώτο ανέβασμα).
    setLoad(result.kind === 'refused' && result.reason === 'tour-absent' ? { kind: 'loaded', captures: [], asManager: false } : { kind: 'failed' });
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
        : <CaptureList captures={load.captures} />)}
    </section>
  );
}

function CaptureList({ captures }: { readonly captures: readonly TourCapture[] }) {
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
        </li>
      ))}
    </ul>
  );
}
