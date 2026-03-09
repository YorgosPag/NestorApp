/**
 * =============================================================================
 * PDF Canvas Viewer — Theme-aware PDF preview using pdfjs-dist
 * =============================================================================
 *
 * Renders PDF pages to canvas with custom controls that respect the app theme.
 * Replaces browser iframe PDF viewer for consistent dark/light mode UX.
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

interface PdfCanvasViewerProps {
  /** PDF download URL (Firebase Storage) */
  url: string;
  /** Accessible title */
  title: string;
  /** Optional className */
  className?: string;
}

interface PdfState {
  numPages: number;
  currentPage: number;
  scale: number;
  rotation: number;
  loading: boolean;
  error: string | null;
}

// PDF.js types (minimal interface to avoid import issues)
interface PdfDocProxy {
  numPages: number;
  getPage(num: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
}

interface PdfPageProxy {
  getViewport(opts: { scale: number; rotation?: number }): {
    width: number;
    height: number;
  };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void>; cancel(): void };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;
const WORKER_URL = '/pdf.worker.min.mjs';

// ============================================================================
// PDF.JS LOADER (lazy, avoids SSR issues)
// ============================================================================

let pdfjsLib: {
  getDocument(params: { url?: string; data?: Uint8Array; cMapUrl?: string; cMapPacked?: boolean }): {
    promise: Promise<PdfDocProxy>;
  };
  GlobalWorkerOptions: { workerSrc: string };
} | null = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  // Dynamic import for client-side only
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
  pdfjsLib = lib as unknown as typeof pdfjsLib;
  return pdfjsLib!;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PdfCanvasViewer({ url, title, className }: PdfCanvasViewerProps) {
  const { t } = useTranslation('files');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDocProxy | null>(null);
  const renderTaskRef = useRef<{ cancel(): void } | null>(null);

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

        // Cleanup previous document
        if (docRef.current) {
          await docRef.current.destroy();
          docRef.current = null;
        }

        // Proxy through /api/download to bypass CORS on Firebase Storage URLs
        const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=preview.pdf`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Download proxy: HTTP ${response.status}`);
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

    // Cancel any in-flight render before starting a new one
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

        // Set canvas size (use devicePixelRatio for sharp rendering)
        const dpr = window.devicePixelRatio || 1;
        canvas!.width = viewport.width * dpr;
        canvas!.height = viewport.height * dpr;
        canvas!.style.width = `${viewport.width}px`;
        canvas!.style.height = `${viewport.height}px`;

        const ctx = canvas!.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
      } catch (err) {
        // Ignore cancellation errors from pdfjs
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
      const containerWidth = container!.clientWidth - 32; // 16px padding each side
      const fitScale = Math.min(containerWidth / viewport.width, 2);
      setState((s) => ({ ...s, scale: Math.round(fitScale * 100) / 100 }));
    }

    fitToWidth();
  }, [state.loading, state.numPages]);

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
    setState((s) => ({ ...s, scale: Math.min(MAX_SCALE, s.scale + SCALE_STEP) }));
  }, []);

  const zoomOut = useCallback(() => {
    setState((s) => ({ ...s, scale: Math.max(MIN_SCALE, s.scale - SCALE_STEP) }));
  }, []);

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
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, zoomIn, zoomOut]);

  // Loading state
  if (state.loading) {
    return (
      <section className={cn('flex items-center justify-center h-full', className)}>
        <p className="text-sm text-muted-foreground animate-pulse">
          {t('floorplan.loading', 'Φόρτωση PDF...')}
        </p>
      </section>
    );
  }

  // Error state
  if (state.error) {
    return (
      <section className={cn('flex items-center justify-center h-full', className)}>
        <p className="text-sm text-destructive">{state.error}</p>
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col h-full', className)}>
      {/* Toolbar — theme-aware */}
      <nav className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/50 gap-2">
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
            <TooltipContent>{t('floorplan.previous', 'Προηγούμενη')}</TooltipContent>
          </Tooltip>

          <span className="text-xs text-muted-foreground min-w-[60px] text-center tabular-nums">
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
            <TooltipContent>{t('floorplan.next', 'Επόμενη')}</TooltipContent>
          </Tooltip>
        </div>

        {/* Zoom + rotation */}
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
            <TooltipContent>{t('preview.zoomOut', 'Σμίκρυνση')}</TooltipContent>
          </Tooltip>

          <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
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
            <TooltipContent>{t('preview.zoomIn', 'Μεγέθυνση')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={rotate} className="h-7 w-7 p-0">
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('preview.rotate', 'Περιστροφή')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={openFullscreen} className="h-7 w-7 p-0">
                <Maximize className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('floorplan.fullscreen', 'Πλήρης οθόνη')}</TooltipContent>
          </Tooltip>
        </div>
      </nav>

      {/* Canvas area — scrollable, theme background */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4 bg-muted/20"
      >
        <canvas
          ref={canvasRef}
          className="shadow-md rounded"
          aria-label={title}
        />
      </div>
    </section>
  );
}
