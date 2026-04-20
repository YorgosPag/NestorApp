/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Preview Renderer (SSoT)
 * =============================================================================
 *
 * The single preview surface used by every view that needs to preview a file:
 *
 *   1. Authenticated file manager (components/file-manager/FilePreviewPanel)
 *   2. Public share page       (components/shared/pages/SharedFilePageContent)
 *
 * This component renders ONLY the preview area — no header, no actions,
 * no side panels. Those concerns belong to the hosting component.
 *
 * Supported preview strategies (see lib/file-types/preview-registry):
 *   - pdf         → PdfCanvasViewer (pdfjs-dist, theme-aware)
 *   - image       → Zoomable/rotatable <img>
 *   - video       → HTML5 <video>
 *   - audio       → HTML5 <audio>
 *   - docx        → Client-side docx-preview rendering
 *   - unsupported → Friendly fallback with download prompt
 *
 * @module components/shared/files/preview/FilePreviewRenderer
 * @enterprise ADR-191 — Enterprise Document Management System (Phase 4.3)
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download,
  File,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatFileSize } from '@/utils/file-validation';
import { PdfCanvasViewer } from '@/components/file-manager/PdfCanvasViewer';
import { DocxPreview } from '@/components/file-manager/preview/DocxPreview';
import { ExcelPreview } from '@/components/file-manager/preview/ExcelPreview';
import { XmlPreview } from '@/components/file-manager/preview/XmlPreview';
import { TxtPreview } from '@/components/file-manager/preview/TxtPreview';
import { HtmlPreview } from '@/components/file-manager/preview/HtmlPreview';
import { DxfPreview } from '@/components/file-manager/preview/DxfPreview';
import { getPreviewType, type PreviewType } from '@/lib/file-types/preview-registry';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

export interface FilePreviewRendererProps {
  /** Public download URL the renderer will fetch from */
  url: string | undefined;
  /** MIME type — used to select the preview strategy */
  contentType: string | undefined;
  /** Original filename — used as extension fallback for type detection */
  fileName: string | undefined;
  /** Human-readable title (alt text, tooltips) */
  displayName: string;
  /** File ID — required for Excel preview (in-house API endpoint) */
  fileId?: string;
  /** File size in bytes (shown in unsupported fallback) */
  sizeBytes?: number;
  /** Optional download handler (used by unsupported fallback) */
  onDownload?: () => void;
  /** Optional class forwarded to the outer section */
  className?: string;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** PDF preview via pdfjs-dist canvas (theme-aware) */
function PdfPreview({ url, title }: { url: string; title: string }) {
  return <PdfCanvasViewer url={url} title={title} className="flex-1" />;
}

const IMG_MIN_ZOOM = 0.1;
const IMG_MAX_ZOOM = 10;
const IMG_WHEEL_FACTOR = 1.15;

/** Image/SVG preview with cursor-centered wheel zoom + drag-to-pan */
function ImagePreview({ url, title }: { url: string; title: string }) {
  const colors = useSemanticColors();
  const [displayZoom, setDisplayZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const rotRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panAtDragRef = useRef({ x: 0, y: 0 });

  const applyTransform = useCallback(() => {
    if (!imgRef.current) return;
    const { x, y } = panRef.current;
    imgRef.current.style.transform =
      `translate(${x}px, ${y}px) scale(${zoomRef.current}) rotate(${rotRef.current}deg)`;
  }, []);

  // Wheel zoom — cursor-centered (same formula as DxfPreview)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? IMG_WHEEL_FACTOR : 1 / IMG_WHEEL_FACTOR;
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(IMG_MAX_ZOOM, Math.max(IMG_MIN_ZOOM, oldZoom * factor));
      const rect = container!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const ratio = newZoom / oldZoom;
      panRef.current = {
        x: (mx - rect.width / 2) * (1 - ratio) + panRef.current.x * ratio,
        y: (my - rect.height / 2) * (1 - ratio) + panRef.current.y * ratio,
      };
      zoomRef.current = newZoom;
      applyTransform();
      setDisplayZoom(newZoom);
    }
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [applyTransform]);

  // Drag-to-pan
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onMouseDown(e: MouseEvent) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panAtDragRef.current = { ...panRef.current };
      container!.style.cursor = 'grabbing';
    }
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return;
      panRef.current = {
        x: panAtDragRef.current.x + (e.clientX - dragStartRef.current.x),
        y: panAtDragRef.current.y + (e.clientY - dragStartRef.current.y),
      };
      applyTransform();
    }
    function onMouseUp() {
      isDraggingRef.current = false;
      container!.style.cursor = 'grab';
    }
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.style.cursor = 'grab';
    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [applyTransform]);

  function zoomBy(delta: number) {
    const newZoom = Math.min(IMG_MAX_ZOOM, Math.max(IMG_MIN_ZOOM, zoomRef.current + delta));
    const ratio = newZoom / zoomRef.current;
    panRef.current = { x: panRef.current.x * ratio, y: panRef.current.y * ratio };
    zoomRef.current = newZoom;
    applyTransform();
    setDisplayZoom(newZoom);
  }

  function rotate() {
    rotRef.current = (rotRef.current + 90) % 360;
    applyTransform();
  }

  return (
    <figure className="flex-1 flex flex-col overflow-hidden">
      <nav className="flex items-center justify-center gap-1 py-2 border-b bg-muted/30">
        <Button variant="ghost" size="sm" onClick={() => zoomBy(-0.25)}
          disabled={displayZoom <= IMG_MIN_ZOOM} className="h-7 w-7 p-0">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className={cn('text-xs w-12 text-center', colors.text.muted)}>
          {Math.round(displayZoom * 100)}%
        </span>
        <Button variant="ghost" size="sm" onClick={() => zoomBy(0.25)}
          disabled={displayZoom >= IMG_MAX_ZOOM} className="h-7 w-7 p-0">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={rotate} className="h-7 w-7 p-0 ml-2">
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
      </nav>
      <div ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center p-4 bg-muted/20">
        <img
          ref={imgRef}
          src={url}
          alt={title}
          className="max-w-full max-h-full object-contain"
          style={{ transformOrigin: 'center', userSelect: 'none' }}
          draggable={false}
          loading="lazy"
        />
      </div>
    </figure>
  );
}

/** Video preview with native player */
function VideoPreview({ url, title }: { url: string; title: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-black/5">
      <video
        src={url}
        controls
        className="max-w-full max-h-full rounded-lg"
        preload="metadata"
        aria-label={title}
      >
        <track kind="captions" />
      </video>
    </div>
  );
}

/** Audio preview with native player */
function AudioPreview({ url, title }: { url: string; title: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-muted/20">
      <audio src={url} controls className="w-full max-w-xl" aria-label={title} />
    </div>
  );
}

/** Fallback for unsupported types */
function UnsupportedPreview({
  displayName,
  contentType,
  sizeBytes,
  onDownload,
}: {
  displayName: string;
  contentType: string | undefined;
  sizeBytes: number | undefined;
  onDownload?: () => void;
}) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();

  const subtitle = [
    contentType || t('technical.unavailable'),
    sizeBytes ? formatFileSize(sizeBytes) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
        <File className={cn('h-8 w-8', colors.text.muted)} />
      </div>
      <div>
        <p className="font-medium text-sm">{displayName}</p>
        <p className={cn('text-xs mt-1', colors.text.muted)}>{subtitle}</p>
      </div>
      <p className={cn('text-xs max-w-xs', colors.text.muted)}>
        {t('preview.unsupported')}
      </p>
      {onDownload && (
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="h-4 w-4 mr-2" />
          {t('list.download')}
        </Button>
      )}
    </section>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FilePreviewRenderer({
  url,
  contentType,
  fileName,
  displayName,
  fileId,
  sizeBytes,
  onDownload,
  className,
}: FilePreviewRendererProps) {
  const previewType: PreviewType = getPreviewType(contentType, fileName);
  const hasUrl = !!url;

  // No URL → unsupported fallback
  if (!hasUrl) {
    return (
      <section className={cn('flex flex-col flex-1 min-h-[400px]', className)}>
        <UnsupportedPreview
          displayName={displayName}
          contentType={contentType}
          sizeBytes={sizeBytes}
          onDownload={onDownload}
        />
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col flex-1 min-h-[400px]', className)}>
      {previewType === 'pdf' && <PdfPreview url={url!} title={displayName} />}
      {previewType === 'image' && <ImagePreview url={url!} title={displayName} />}
      {previewType === 'video' && <VideoPreview url={url!} title={displayName} />}
      {previewType === 'audio' && <AudioPreview url={url!} title={displayName} />}
      {previewType === 'docx' && <DocxPreview url={url!} title={displayName} />}
      {previewType === 'excel' && fileId && <ExcelPreview fileId={fileId} title={displayName} />}
      {previewType === 'excel' && !fileId && (
        <UnsupportedPreview
          displayName={displayName}
          contentType={contentType}
          sizeBytes={sizeBytes}
          onDownload={onDownload}
        />
      )}
      {previewType === 'xml' && <XmlPreview url={url!} title={displayName} />}
      {previewType === 'text' && <TxtPreview url={url!} title={displayName} />}
      {previewType === 'html' && <HtmlPreview url={url!} title={displayName} />}
      {previewType === 'dxf' && <DxfPreview url={url!} fileName={fileName ?? displayName} title={displayName} />}
      {previewType === 'unsupported' && (
        <UnsupportedPreview
          displayName={displayName}
          contentType={contentType}
          sizeBytes={sizeBytes}
          onDownload={onDownload}
        />
      )}
    </section>
  );
}
