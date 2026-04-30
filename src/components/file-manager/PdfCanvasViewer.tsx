/**
 * =============================================================================
 * PDF Canvas Viewer — Theme-aware PDF preview using pdfjs-dist
 * =============================================================================
 *
 * Renders PDF pages to canvas with custom controls that respect the app theme.
 * Replaces browser iframe PDF viewer for consistent dark/light mode UX.
 *
 * Features: wheel zoom, click-drag pan, fit-to-width, page nav, rotation.
 *
 * Uses pdfjs-dist@4.5.136 (same version as DXF viewer PdfRenderer).
 * Worker: self-hosted /public/pdf.worker.min.mjs
 *
 * @module components/file-manager/PdfCanvasViewer
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { API_ROUTES } from '@/config/domain-constants';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  type PdfCanvasViewerProps,
  type PdfState,
  type PdfDocProxy,
  MIN_SCALE,
  MAX_SCALE,
  WHEEL_ZOOM_FACTOR,
  loadPdfJs,
} from './pdf-canvas-config';

// ============================================================================
// COMPONENT
// ============================================================================

export function PdfCanvasViewer({ url, title, className }: PdfCanvasViewerProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDocProxy | null>(null);
  const renderTaskRef = useRef<{ cancel(): void } | null>(null);
  const fitScaleRef = useRef<number>(1);

  // Pan state refs (not in React state to avoid re-renders during drag)
  // Transform-based pan: container is overflow-hidden, canvas is translated.
  // Works regardless of canvas vs container size (scroll-based pan was a no-op
  // when canvas <= container, e.g. at fit-to-width with small PDFs).
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const panAtDragRef = useRef({ x: 0, y: 0 });

  const applyPanTransform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
  }, []);

  const [state, setState] = useState<PdfState>({
    numPages: 0,
    currentPage: 1,
    scale: 1,
    rotation: 0,
    loading: true,
    error: null,
  });

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadDoc() {
      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const lib = await loadPdfJs();
        if (cancelled) return;

        if (docRef.current) {
          await docRef.current.destroy();
          docRef.current = null;
        }

        // Same-origin relative URLs (e.g. `/api/shared/[token]/pdf`) are already
        // public streams — skip the auth-gated `/api/download` proxy which
        // requires a Firebase Storage URL + auth. External Firebase URLs still
        // route through the proxy to bypass CORS.
        const isRelative = url.startsWith('/');
        const fetchUrl = isRelative
          ? url
          : `${API_ROUTES.DOWNLOAD}?url=${encodeURIComponent(url)}&filename=preview.pdf`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`PDF fetch: HTTP ${response.status}`);
        const data = new Uint8Array(await response.arrayBuffer());
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
  }, [url]);

  // Render current page
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!doc || !canvas || !container || state.loading) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    let cancelled = false;

    async function renderPage() {
      try {
        const page = await doc!.getPage(state.currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({
          scale: state.scale,
          rotation: state.rotation,
        });

        const dpr = window.devicePixelRatio || 1;
        canvas!.width = viewport.width * dpr;
        canvas!.height = viewport.height * dpr;
        canvas!.style.width = `${viewport.width}px`;
        canvas!.style.height = `${viewport.height}px`;
        canvas!.style.transformOrigin = 'center center';
        canvas!.style.willChange = 'transform';
        canvas!.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;

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

    renderPage();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [state.currentPage, state.scale, state.rotation, state.loading]);

  // Fit to container width on first load
  useEffect(() => {
    const doc = docRef.current;
    const container = containerRef.current;
    if (!doc || !container || state.loading || state.numPages === 0) return;

    async function fitToWidth() {
      const page = await doc!.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = container!.clientWidth - 32;
      const fitScale = Math.min(containerWidth / viewport.width, 2);
      const rounded = Math.round(fitScale * 100) / 100;
      fitScaleRef.current = rounded;
      setState((s) => ({ ...s, scale: rounded }));
    }

    fitToWidth();
  }, [state.loading, state.numPages]);

  // ── Wheel zoom ──────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      setState((s) => {
        const factor = direction > 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
        const newScale = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, s.scale * factor)) * 100) / 100;
        return { ...s, scale: newScale };
      });
    }

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [state.loading]);

  // ── Pan (click & drag) — transform-based, works at any zoom ─────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handlePointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panAtDragRef.current = { ...panRef.current };
      container!.setPointerCapture(e.pointerId);
      container!.style.cursor = 'grabbing';
    }

    function handlePointerMove(e: PointerEvent) {
      if (!isPanningRef.current) return;
      panRef.current = {
        x: panAtDragRef.current.x + (e.clientX - panStartRef.current.x),
        y: panAtDragRef.current.y + (e.clientY - panStartRef.current.y),
      };
      applyPanTransform();
    }

    function handlePointerUp(e: PointerEvent) {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      container!.releasePointerCapture(e.pointerId);
      container!.style.cursor = 'grab';
    }

    container.style.cursor = 'grab';
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerUp);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [state.loading, applyPanTransform]);

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

  const zoomIn = useCallback(() => {
    setState((s) => ({
      ...s,
      scale: Math.round(Math.min(MAX_SCALE, s.scale * WHEEL_ZOOM_FACTOR) * 100) / 100,
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setState((s) => ({
      ...s,
      scale: Math.round(Math.max(MIN_SCALE, s.scale / WHEEL_ZOOM_FACTOR) * 100) / 100,
    }));
  }, []);

  const fitToWidth = useCallback(() => {
    panRef.current = { x: 0, y: 0 };
    applyPanTransform();
    setState((s) => ({ ...s, scale: fitScaleRef.current }));
  }, [applyPanTransform]);

  const rotate = useCallback(() => {
    setState((s) => ({ ...s, rotation: (s.rotation + 90) % 360 }));
  }, []);

  const openFullscreen = useCallback(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') goToPrev();
      else if (e.key === 'ArrowRight') goToNext();
      else if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-') zoomOut();
      else if (e.key === '0') fitToWidth();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, zoomIn, zoomOut, fitToWidth]);

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
                disabled={state.currentPage <= 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('pdf.previous')}</TooltipContent>
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
                disabled={state.currentPage >= state.numPages}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('pdf.next')}</TooltipContent>
          </Tooltip>
        </div>

        {/* Zoom + tools */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomOut}
                disabled={state.scale <= MIN_SCALE}
                className="h-7 w-7 p-0"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('preview.zoomOut')}</TooltipContent>
          </Tooltip>

          <span className={cn("text-xs w-10 text-center tabular-nums", colors.text.muted)}>
            {Math.round(state.scale * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomIn}
                disabled={state.scale >= MAX_SCALE}
                className="h-7 w-7 p-0"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('preview.zoomIn')}</TooltipContent>
          </Tooltip>

          {/* Fit to width */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={fitToWidth} className="h-7 w-7 p-0">
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('preview.fitToWidth')}</TooltipContent>
          </Tooltip>

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

      {/* Canvas area — pan via transform, no scrollbars */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center p-4 bg-muted/20 select-none relative touch-none"
      >
        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted/20">
            {state.loading && (
              <p className={cn("text-sm animate-pulse", colors.text.muted)}>
                {t('pdf.loading')}
              </p>
            )}
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="shadow-md rounded bg-white"
          aria-label={title}
        />
      </div>
    </section>
  );
}
