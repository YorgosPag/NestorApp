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
 * Uses pdfjs-dist@4.5.136 (same version as DXF viewer PdfRenderer).
 * Worker: self-hosted /public/pdf.worker.min.mjs
 *
 * @module components/file-manager/PdfCanvasViewer
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Maximize,
} from 'lucide-react';
import { DocumentZoomControl } from '@/components/shared/media/viewer/DocumentZoomControl';
import { quarterTurnExtent, type Extent, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { shouldGlobalShortcutYield } from '@/lib/a11y/keyboard-scope';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  type PdfCanvasViewerProps,
  type PdfState,
  type PdfDocProxy,
  MIN_SCALE,
  MAX_SCALE,
  loadPdfJs,
} from './pdf-canvas-config';
import { loadPdfBytes } from './pdf-bytes-cache';
import { pdfFetchTarget } from './pdf-fetch-target';
import { PdfHighlights, useControlledPdfPage } from './PdfHighlights';
import { usePdfViewport } from './usePdfViewport';

// ============================================================================
// COMPONENT
// ============================================================================

const logger = createModuleLogger('PdfCanvasViewer');

/** Τα όρια του ζουμ του θεατή, στη μορφή της κοινής μαθηματικής του ζουμ (`zoom-pan-math`). */
const PDF_ZOOM_LIMITS: ZoomLimits = { min: MIN_SCALE, max: MAX_SCALE };

/** Πόσο «ηρεμεί» ένα ζουμ πριν ξαναζωγραφιστεί το bitmap — ως τότε τεντώνεται το παλιό (pdf.js). */
const RENDER_SETTLE_MS = 120;

/**
 * Το μέγεθος της **τρέχουσας** σελίδας σε κλίμακα 1, χωρίς στροφή — κάθε σελίδα το δικό της (ένα PDF μπορεί να ανακατεύει
 * Α4 και Α3). Ως την 2026-11-07 η προσαρμογή μετρούσε μόνο τη σελίδα 1, και μία φορά, στη φόρτωση.
 */
function usePdfPageBase(docRef: React.RefObject<PdfDocProxy | null>, state: PdfState): Extent | null {
  const [base, setBase] = useState<Extent | null>(null);
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || state.loading || state.numPages === 0) return;
    let cancelled = false;
    doc.getPage(state.currentPage).then((pdfPage) => {
      if (cancelled) return;
      const { width, height } = pdfPage.getViewport({ scale: 1 });
      setBase((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    }).catch(() => { /* το σφάλμα σελίδας το δείχνει ο ζωγράφος — εδώ μένει το προηγούμενο μέγεθος */ });
    return () => { cancelled = true; };
  }, [docRef, state.loading, state.numPages, state.currentPage]);
  return base;
}

export function PdfCanvasViewer({ url, fileId, urlDelivery, title, className, page, highlights }: PdfCanvasViewerProps) {
  const { t } = useTranslation('files');
  const colors = useSemanticColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PdfDocProxy | null>(null);
  const renderTaskRef = useRef<{ cancel(): void } | null>(null);
  /** Τι ζωγραφίστηκε τελευταίο — ίδια όψη ⇒ το νέο ζουμ περιμένει να ηρεμήσει· άλλη ⇒ ζωγραφίζεται αμέσως. */
  const lastDrawnRef = useRef<{ page: number; rotation: number } | null>(null);

  const [state, setState] = useState<PdfState>({
    numPages: 0,
    currentPage: 1,
    rotation: 0,
    loading: true,
    error: null,
  });

  useControlledPdfPage(page, state.numPages, setState);

  // ADR-928 §5.25.2 — η όψη (ζουμ · προσαρμογή πλάτος/σελίδα · κύλιση · χειρονομίες) έχει ΕΝΑΝ κάτοχο.
  const pageBase = usePdfPageBase(docRef, state);
  const pageExtent = useMemo(() => (pageBase ? quarterTurnExtent(pageBase, state.rotation) : null), [pageBase, state.rotation]);
  const viewport = usePdfViewport({ page: pageExtent, pageKey: state.currentPage, limits: PDF_ZOOM_LIMITS, canvasRef });
  const { containerRef, scale, ready } = viewport;

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadDoc() {
      lastDrawnRef.current = null;
      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const lib = await loadPdfJs();
        if (cancelled) return;

        if (docRef.current) {
          await docRef.current.destroy();
          docRef.current = null;
        }

        // 🔑 «Από πού, και με ποια διαπιστευτήρια;» το απαντά ο ΕΝΑΣ απαντητής
        //    (`pdfFetchTarget`, ADR-901 §14.9) — ποτέ ξανά inline εδώ.
        const target = pdfFetchTarget({ url, fileId, urlDelivery });
        //    Τα bytes από τη μνήμη του θεατή: αν τα προφόρτωσε η πλοήγηση αρχείων (ADR-912 §12.16), είναι ήδη εδώ.
        const data = await loadPdfBytes(target);
        if (cancelled) return;

        const doc = await lib.getDocument({ data }).promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }

        docRef.current = doc;
        setState((s) => ({
          ...s,
          numPages: doc.numPages,
          currentPage: 1,
          loading: false,
        }));
      } catch (err) {
        if (!cancelled) {
          // ⚠️ Το τεχνικό αίτιο πάει στο ημερολόγιο· ο άνθρωπος βλέπει μεταφρασμένο
          //    μήνυμα (N.11). ⛔ Ποτέ το URL: μπορεί να είναι υπογεγραμμένη άδεια.
          logger.warn('PDF load failed', { error: err instanceof Error ? err.message : String(err), urlDelivery });
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load PDF',
          }));
        }
      }
    }

    loadDoc();

    return () => {
      cancelled = true;
      if (docRef.current) {
        docRef.current.destroy().catch(() => {});
        docRef.current = null;
      }
    };
    // ⚠️ Το `fileId` **πρέπει** να είναι εδώ: είναι πλέον η **πηγή** του `fetchUrl`
    //    (ADR-862 Φ0 Β8). Χωρίς αυτό, η εναλλαγή αρχείου θα άφηνε στην οθόνη το
    //    **προηγούμενο** PDF κάτω από το νέο όνομα.
  }, [url, fileId, urlDelivery]);

  // Render current page — μόνο το BITMAP: το μέγεθος στην οθόνη το γράφει ήδη σύγχρονα ο `usePdfViewport`, άρα στη διάρκεια
  // ενός ζουμ το παλιό bitmap απλώς τεντώνεται και καθαρίζει όταν η κίνηση ηρεμήσει (pdf.js). Νέα σελίδα/στροφή/έγγραφο ⇒ αμέσως.
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || state.loading || !ready) return;

    let cancelled = false;
    const last = lastDrawnRef.current;
    const sameView = last !== null && last.page === state.currentPage && last.rotation === state.rotation;
    const settle = window.setTimeout(() => { void renderPage(); }, sameView ? RENDER_SETTLE_MS : 0);

    async function renderPage() {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      try {
        const page = await doc!.getPage(state.currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale, rotation: state.rotation });

        const dpr = window.devicePixelRatio || 1;
        canvas!.width = Math.round(viewport.width * dpr);
        canvas!.height = Math.round(viewport.height * dpr);
        lastDrawnRef.current = { page: state.currentPage, rotation: state.rotation };

        const ctx = canvas!.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
      } catch (err) {
        if (cancelled || (err instanceof Error && err.message.includes('Rendering cancelled'))) return;
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : 'Render error',
        }));
      }
    }

    return () => {
      cancelled = true;
      window.clearTimeout(settle);
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [state.currentPage, scale, state.rotation, state.loading, ready]);

  // Navigation handlers
  const goToPrev = useCallback(() => {
    setState((s) => ({ ...s, currentPage: Math.max(1, s.currentPage - 1) }));
  }, []);

  const goToNext = useCallback(() => {
    setState((s) => ({
      ...s,
      currentPage: Math.min(s.numPages, s.currentPage + 1),
    }));
  }, []);

  // ADR-928 §5.25 — τα κουμπιά πατούν **σκαλί** της κοινής σκάλας (`ladderZoom`, Chrome PDF: 90 → 100 → 110 %), όχι ×1,1·
  // Ctrl/⌘+ροδέλα και pinch μένουν συνεχή. Κάθε χειροκίνητο ζουμ βγάζει την προσαρμογή (§5.25.2).
  const { step: zoomStep, zoomTo, fitTo, toggleFit } = viewport;
  const fitWidth = useCallback(() => fitTo('width'), [fitTo]);
  const fitPage = useCallback(() => fitTo('page'), [fitTo]);

  const rotate = useCallback(() => {
    setState((s) => ({ ...s, rotation: (s.rotation + 90) % 360 }));
  }, []);

  const openFullscreen = useCallback(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  // Keyboard navigation — PgUp/PgDn = σελίδες (Adobe · Chrome PDF). Τα ←/→ μόνο όταν δεν τα διεκδίκησε κανείς:
  // μέσα σε σειρά αρχείων ανήκουν στην πλοήγηση ΑΡΧΕΙΩΝ (`FileSequenceNav`, ADR-912 §12.16 — όπως το Drive).
  // `shouldGlobalShortcutYield`: πεδίο κειμένου / ανοιχτός διάλογος κρατούν τα πλήκτρα τους.
  // ADR-928 §5.25.2 — Ctrl/⌘ + `\` εναλλάσσει πλάτος ⇄ σελίδα (Chrome PDF)· τα σκέτα `=`/`-`/`0` μόνο **χωρίς** Ctrl/⌘,
  // αλλιώς το Ctrl + `-` θα σμίκραινε ταυτόχρονα τον θεατή ΚΑΙ τη σελίδα του browser.
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
      else if (e.key === '0') fitWidth();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, zoomStep, fitWidth, toggleFit]);

  // Loading / error overlay (rendered inside the main layout so containerRef stays mounted)
  const showOverlay = state.loading || !!state.error;

  return (
    <section className={cn('flex flex-col h-full', className)}>
      {/* Toolbar — hidden during loading */}
      <nav className={cn(
        'flex items-center justify-between px-3 py-1.5 border-b bg-muted/50 gap-2',
        showOverlay && 'invisible'
      )}>
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPrev}
                aria-label={t('pdf.previousPage')}
                disabled={state.currentPage <= 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('pdf.previousPage')}</TooltipContent>
          </Tooltip>

          <span className={cn("text-xs min-w-[60px] text-center tabular-nums", colors.text.muted)}>
            {state.currentPage} / {state.numPages}
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNext}
                aria-label={t('pdf.nextPage')}
                disabled={state.currentPage >= state.numPages}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('pdf.nextPage')}</TooltipContent>
          </Tooltip>
        </div>

        {/* Zoom + tools */}
        <div className="flex items-center gap-1">
          {/* ADR-928 §5.25 — η ΚΟΙΝΗ μπάρα ζουμ σελίδας (μενού ποσοστού, σκάλα, «Προσαρμογή στο πλάτος» πατημένο). */}
          <DocumentZoomControl
            zoom={scale}
            fitted={viewport.fit === 'width'}
            pageFitted={viewport.fit === 'page'}
            limits={PDF_ZOOM_LIMITS}
            onStep={zoomStep}
            onZoomTo={zoomTo}
            onFit={fitWidth}
            onFitPage={fitPage}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={rotate} className="h-7 w-7 p-0">
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('preview.rotate')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={openFullscreen} className="h-7 w-7 p-0">
                <Maximize className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('pdf.fullscreen')}</TooltipContent>
          </Tooltip>
        </div>
      </nav>

      {/* Canvas area — ADR-928 §5.25.2: πλαίσιο ΚΥΛΙΣΗΣ (Chrome PDF · pdf.js · Acrobat). Το `m-auto` της σελίδας κεντράρει
          όταν χωρά και την αφήνει να ξεκινά από την κορυφή/αριστερά όταν δεν χωρά (το `items-center` έκοβε και τις δύο άκρες). */}
      <div
        ref={containerRef}
        className="relative flex flex-1 overflow-auto overscroll-contain p-4 bg-muted/20 select-none touch-pan-x touch-pan-y [scrollbar-gutter:stable]"
      >
        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted/20">
            {state.loading && (
              <p className={cn("text-sm animate-pulse", colors.text.muted)}>
                {t('pdf.loading')}
              </p>
            )}
            {state.error && (
              <p role="alert" className="text-sm text-destructive">{t('pdf.loadFailed')}</p>
            )}
          </div>
        )}
        <figure className="relative m-auto shrink-0">
          <canvas
            ref={canvasRef}
            className="block shadow-md rounded bg-white"
            aria-label={title}
          />
          <PdfHighlights regions={highlights} />
        </figure>
      </div>
    </section>
  );
}
