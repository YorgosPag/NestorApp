/**
 * =============================================================================
 * PDF Canvas Viewer — Theme-aware PDF preview using pdfjs-dist
 * =============================================================================
 *
 * Renders PDF pages to canvas with custom controls that respect the app theme.
 * Replaces browser iframe PDF viewer for consistent dark/light mode UX.
 *
 * Features: native scrolling, Ctrl/⌘+wheel & pinch zoom around the pointer, click-drag pan, fit to width / page,
 * page nav, rotation. Zoom, fit and scrolling are owned by `usePdfViewport` (ADR-928 §5.25.2).
 *
 * ADR-923 §5.15.2 (Θ.2α-2) — **αναγνώστης εντύπου**, ρητά ανά καλούντα (`features`): στρώση κειμένου (`PdfTextLayer`),
 * σύνδεσμοι (`PdfLinkLayer`), `#page=N` (`usePdfPageInUrl`), λήψη (`usePdfDownload`). Χωρίς `features` ⇒ η σημερινή
 * συμπεριφορά (file manager · εισαγωγή καταλόγου αμετάβλητα).
 *
 * Uses pdfjs-dist@4.5.136 (same version as DXF viewer PdfRenderer).
 * Worker: self-hosted /public/pdf.worker.min.mjs
 *
 * @module components/file-manager/PdfCanvasViewer
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useEffect, useId, useMemo, useRef, useState, useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { quarterTurnExtent, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { shouldGlobalShortcutYield } from '@/lib/a11y/keyboard-scope';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  type PdfCanvasViewerProps,
  type PdfState,
  type PdfDocProxy,
  type PdfPageProxy,
  MIN_SCALE,
  MAX_SCALE,
  PDF_RENDER_SETTLE_MS,
  pdfDocumentSourceOf,
} from './pdf-canvas-config';
import { PdfHighlights, useControlledPdfPage } from './PdfHighlights';
import { PdfLinkLayer } from './PdfLinkLayer';
import { PdfSidebar } from './PdfSidebar';
import { PdfTextLayer } from './PdfTextLayer';
import { PdfViewerToolbar } from './PdfViewerToolbar';
import { usePdfCurrentPage } from './usePdfCurrentPage';
import { sourceIdentityOf, usePdfDocument } from './usePdfDocument';
import { usePdfDownload } from './usePdfDownload';
import { usePdfPageInUrl } from './usePdfPageInUrl';
import { usePdfReaderSidebar, type PdfReaderSidebar } from './usePdfSidebar';
import { usePdfViewport, type PdfViewport } from './usePdfViewport';

// ============================================================================
// COMPONENT
// ============================================================================

/** Τα όρια του ζουμ του θεατή, στη μορφή της κοινής μαθηματικής του ζουμ (`zoom-pan-math`). */
const PDF_ZOOM_LIMITS: ZoomLimits = { min: MIN_SCALE, max: MAX_SCALE };

type RenderTask = { cancel(): void };

/** Ζωγραφίζει μία σελίδα στο canvas· το μέγεθος στην οθόνη το έχει ήδη γράψει ο `usePdfViewport`. */
async function drawPage(page: PdfPageProxy, canvas: HTMLCanvasElement, scale: number, rotation: number, track: (task: RenderTask | null) => void): Promise<void> {
  const viewport = page.getViewport({ scale, rotation });
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(viewport.width * dpr);
  canvas.height = Math.round(viewport.height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const task = page.render({ canvasContext: ctx, viewport });
  track(task);
  await task.promise;
  track(null);
}

/**
 * Render current page — μόνο το BITMAP: το μέγεθος στην οθόνη το γράφει ήδη σύγχρονα ο `usePdfViewport`, άρα στη διάρκεια
 * ενός ζουμ το παλιό bitmap απλώς τεντώνεται και καθαρίζει όταν η κίνηση ηρεμήσει (pdf.js). Νέα σελίδα/στροφή/έγγραφο ⇒ αμέσως.
 */
function usePdfPageRender(
  { docRef, canvasRef, lastDrawnRef, state, scale, ready, setState, onDrawn }: {
    docRef: RefObject<PdfDocProxy | null>; canvasRef: RefObject<HTMLCanvasElement>;
    lastDrawnRef: { current: { page: number; rotation: number } | null };
    state: PdfState; scale: number; ready: boolean; setState: Dispatch<SetStateAction<PdfState>>;
    /** Ένα σχέδιο ολοκληρώθηκε — η συγκομιδή μικρογραφίας μηδενικού κόστους (ADR-923 §5.15.2 Θ.2α-3). */
    onDrawn: (page: number, rotation: number, canvas: HTMLCanvasElement) => void;
  },
): void {
  const renderTaskRef = useRef<RenderTask | null>(null);
  const onDrawnRef = useRef(onDrawn);
  useEffect(() => { onDrawnRef.current = onDrawn; });
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || state.loading || !ready) return;
    let cancelled = false;
    const cancelTask = () => { renderTaskRef.current?.cancel(); renderTaskRef.current = null; };
    const last = lastDrawnRef.current;
    const sameView = last !== null && last.page === state.currentPage && last.rotation === state.rotation;
    const run = async () => {
      cancelTask();
      try {
        const page = await doc.getPage(state.currentPage);
        if (cancelled) return;
        lastDrawnRef.current = { page: state.currentPage, rotation: state.rotation };
        await drawPage(page, canvas, scale, state.rotation, (task) => { renderTaskRef.current = task; });
        if (!cancelled) onDrawnRef.current(state.currentPage, state.rotation, canvas);
      } catch (err) {
        if (cancelled || (err instanceof Error && err.message.includes('Rendering cancelled'))) return;
        setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Render error' }));
      }
    };
    const settle = window.setTimeout(() => { void run(); }, sameView ? PDF_RENDER_SETTLE_MS : 0);
    return () => { cancelled = true; window.clearTimeout(settle); cancelTask(); };
  }, [state.currentPage, scale, state.rotation, state.loading, ready]);
}

/**
 * Keyboard navigation — PgUp/PgDn = σελίδες (Adobe · Chrome PDF). Τα ←/→ μόνο όταν δεν τα διεκδίκησε κανείς:
 * μέσα σε σειρά αρχείων ανήκουν στην πλοήγηση ΑΡΧΕΙΩΝ (`FileSequenceNav`, ADR-912 §12.16 — όπως το Drive).
 * `shouldGlobalShortcutYield`: πεδίο κειμένου / ανοιχτός διάλογος κρατούν τα πλήκτρα τους.
 * ADR-928 §5.25.2 — Ctrl/⌘ + `\` εναλλάσσει πλάτος ⇄ σελίδα (Chrome PDF)· τα σκέτα `=`/`-`/`0` μόνο **χωρίς** Ctrl/⌘,
 * αλλιώς το Ctrl + `-` θα σμίκραινε ταυτόχρονα τον θεατή ΚΑΙ τη σελίδα του browser.
 */
function usePdfKeyboard(viewport: PdfViewport, goToPrev: () => void, goToNext: () => void): void {
  const { step: zoomStep, fitTo, toggleFit } = viewport;
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || shouldGlobalShortcutYield(e)) return;
      const modified = e.ctrlKey || e.metaKey;
      if (modified && e.key === '\\') { e.preventDefault(); toggleFit(); return; }
      if (modified || e.altKey) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goToPrev();
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') goToNext();
      else if (e.key === '+' || e.key === '=') zoomStep(1);
      else if (e.key === '-') zoomStep(-1);
      else if (e.key === '0') fitTo('width');
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, zoomStep, fitTo, toggleFit]);
}

/** Πλοήγηση σελίδων — η ΜΙΑ πόρτα για κουμπιά, πλήκτρα και εσωτερικούς συνδέσμους. */
function usePdfPageNavigation(setState: Dispatch<SetStateAction<PdfState>>) {
  const goToPrev = useCallback(() => {
    setState((s) => ({ ...s, currentPage: Math.max(1, s.currentPage - 1) }));
  }, [setState]);
  const goToNext = useCallback(() => {
    setState((s) => ({ ...s, currentPage: Math.min(s.numPages, s.currentPage + 1) }));
  }, [setState]);
  const goToPage = useCallback((page: number) => {
    setState((s) => ({ ...s, currentPage: Math.min(Math.max(1, page), s.numPages) }));
  }, [setState]);
  const rotate = useCallback(() => {
    setState((s) => ({ ...s, rotation: (s.rotation + 90) % 360 }));
  }, [setState]);
  return { goToPrev, goToNext, goToPage, rotate };
}

function PdfStatusOverlay({ state }: { readonly state: PdfState }) {
  const { t } = useTranslation('files');
  const colors = useSemanticColors();
  if (!state.loading && !state.error) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted/20">
      {state.loading && <p className={cn('text-sm animate-pulse', colors.text.muted)}>{t('pdf.loading')}</p>}
      {state.error && <p role="alert" className="text-sm text-destructive">{t('pdf.loadFailed')}</p>}
    </div>
  );
}

export function PdfCanvasViewer(props: PdfCanvasViewerProps) {
  const { title, className, page, highlights, features } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Τι ζωγραφίστηκε τελευταίο — ίδια όψη ⇒ το νέο ζουμ περιμένει να ηρεμήσει· άλλη ⇒ ζωγραφίζεται αμέσως. */
  const lastDrawnRef = useRef<{ page: number; rotation: number } | null>(null);
  const [state, setState] = useState<PdfState>({ numPages: 0, currentPage: 1, rotation: 0, loading: true, error: null });

  // ADR-923 §5.15.2 — η φόρτωση έχει ΕΝΑΝ κάτοχο (`usePdfDocument`): αρχείο ολόκληρο ή έντυπο κατά κομμάτια με άδεια.
  const source = pdfDocumentSourceOf(props);
  const docRef = usePdfDocument(source, setState, () => { lastDrawnRef.current = null; });

  useControlledPdfPage(page, state.numPages, setState);
  // Ο ελεγχόμενος `page` του καλούντα νικά: η διεύθυνση δεν διεκδικεί σελίδα που ορίζει κάποιος άλλος.
  usePdfPageInUrl(features?.pageInUrl === true && page === undefined, state, setState);

  // ADR-928 §5.25.2 — η όψη (ζουμ · προσαρμογή πλάτος/σελίδα · κύλιση · χειρονομίες) έχει ΕΝΑΝ κάτοχο.
  const current = usePdfCurrentPage(docRef, state);
  const pageExtent = useMemo(() => (current.base ? quarterTurnExtent(current.base, state.rotation) : null), [current.base, state.rotation]);
  const viewport = usePdfViewport({ page: pageExtent, pageKey: state.currentPage, limits: PDF_ZOOM_LIMITS, canvasRef });
  // ADR-923 §5.15.2 (Θ.2α-3) — πλευρικό πάνελ από το ΙΔΙΟ έγγραφο· ταυτότητα μόνο όταν το έγγραφο είναι έτοιμο.
  const documentKey = !state.loading && !state.error && state.numPages > 0 ? sourceIdentityOf(source) : null;
  const reader = usePdfReaderSidebar(docRef, documentKey, features?.sidebar === true);
  usePdfPageRender({
    docRef, canvasRef, lastDrawnRef, state, scale: viewport.scale, ready: viewport.ready, setState,
    onDrawn: reader.thumbnails.offerRendered,
  });

  const { goToPrev, goToNext, goToPage, rotate } = usePdfPageNavigation(setState);
  usePdfKeyboard(viewport, goToPrev, goToNext);

  // ⛔ Έντυπο με άδεια ⇒ ΟΧΙ: η καρτέλα θα άνοιγε την ίδια την υπογεγραμμένη άδεια, χωρίς τον θεατή (ADR-923 Η4).
  const fullscreenUrl = source.kind === 'file' ? source.url : null;
  const openFullscreen = useCallback(() => {
    if (fullscreenUrl) window.open(fullscreenUrl, '_blank', 'noopener,noreferrer');
  }, [fullscreenUrl]);

  const downloadName = features?.download?.fileName ?? null;
  const pdfDownload = usePdfDownload(docRef, downloadName, sourceIdentityOf(source));
  const showOverlay = state.loading || !!state.error;
  const sidebarId = useId();
  const sidebarEnabled = features?.sidebar === true;

  return (
    <section className={cn('flex flex-col h-full', className)}>
      <PdfViewerToolbar
        hidden={showOverlay}
        currentPage={state.currentPage}
        numPages={state.numPages}
        onPrev={goToPrev}
        onNext={goToNext}
        viewport={viewport}
        limits={PDF_ZOOM_LIMITS}
        onRotate={rotate}
        onFullscreen={fullscreenUrl !== null ? openFullscreen : null}
        download={downloadName !== null ? { status: pdfDownload.status, onDownload: pdfDownload.download } : null}
        sidebar={sidebarEnabled ? { open: reader.sidebar.open, onToggle: reader.sidebar.toggle, controls: sidebarId } : null}
      />

      {/* Πάνελ (αν ζητήθηκε) | σκηνή — το πάνελ στην ίδια γραμμή, η μπάρα πάνω από τα δύο (pdf.js · Acrobat). */}
      <div className="flex min-h-0 flex-1">
        {sidebarEnabled && !showOverlay && (
          <ReaderSidebar id={sidebarId} reader={reader} state={state} pageExtent={pageExtent} onNavigate={goToPage} />
        )}
        <PdfPageStage
          viewport={viewport}
          canvasRef={canvasRef}
          docRef={docRef}
          title={title}
          state={state}
          page={current.page}
          highlights={highlights}
          features={features}
          onNavigate={goToPage}
        />
      </div>
    </section>
  );
}

/** Λόγος ύψους/πλάτους μιας Α4 — το σχήμα των θέσεων πριν μετρηθεί η πρώτη σελίδα. */
const A4_ASPECT = Math.SQRT2;

function ReaderSidebar({ id, reader, state, pageExtent, onNavigate }: {
  readonly id: string;
  readonly reader: PdfReaderSidebar;
  readonly state: PdfState;
  readonly pageExtent: { readonly width: number; readonly height: number } | null;
  readonly onNavigate: (page: number) => void;
}) {
  const defaultAspect = pageExtent && pageExtent.width > 0 ? pageExtent.height / pageExtent.width : A4_ASPECT;
  return (
    <PdfSidebar
      id={id}
      sidebar={reader.sidebar}
      navigation={reader.navigation}
      thumbnails={{ store: reader.thumbnails.store, numPages: state.numPages, rotation: state.rotation, defaultAspect }}
      currentPage={state.currentPage}
      onNavigate={onNavigate}
    />
  );
}

/**
 * Canvas area — ADR-928 §5.25.2: πλαίσιο ΚΥΛΙΣΗΣ (Chrome PDF · pdf.js · Acrobat). Το `m-auto` της σελίδας κεντράρει
 * όταν χωρά και την αφήνει να ξεκινά από την κορυφή/αριστερά όταν δεν χωρά (το `items-center` έκοβε και τις δύο άκρες).
 * Στρώσεις, από κάτω προς τα πάνω: bitmap · κείμενο (επιλογή) · επισημάνσεις · σύνδεσμοι (ADR-923 §5.15.2).
 */
function PdfPageStage({ viewport, canvasRef, docRef, title, state, page, highlights, features, onNavigate }: {
  readonly viewport: PdfViewport;
  readonly canvasRef: RefObject<HTMLCanvasElement>;
  readonly docRef: RefObject<PdfDocProxy | null>;
  readonly title: string;
  readonly state: PdfState;
  readonly page: PdfPageProxy | null;
  readonly highlights: PdfCanvasViewerProps['highlights'];
  readonly features: PdfCanvasViewerProps['features'];
  readonly onNavigate: (page: number) => void;
}) {
  return (
    <div
      ref={viewport.containerRef}
      className="relative flex flex-1 overflow-auto overscroll-contain p-4 bg-muted/20 select-none touch-pan-x touch-pan-y [scrollbar-gutter:stable]"
    >
      <PdfStatusOverlay state={state} />
      <figure className="relative m-auto shrink-0">
        <canvas ref={canvasRef} className="block shadow-md rounded bg-white" aria-label={title} />
        {features?.textSelection === true && <PdfTextLayer page={page} scale={viewport.scale} rotation={state.rotation} />}
        <PdfHighlights regions={highlights} />
        {features?.links === true && <PdfLinkLayer docRef={docRef} page={page} rotation={state.rotation} onNavigate={onNavigate} />}
      </figure>
    </div>
  );
}
