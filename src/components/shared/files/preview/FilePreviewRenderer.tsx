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

import React, { useState } from 'react';
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

/** Image preview with zoom/rotate */
function ImagePreview({ url, title }: { url: string; title: string }) {
  const colors = useSemanticColors();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  return (
    <figure className="flex-1 flex flex-col overflow-hidden">
      <nav className="flex items-center justify-center gap-1 py-2 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
          disabled={zoom <= 0.25}
          className="h-7 w-7 p-0"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className={cn('text-xs w-12 text-center', colors.text.muted)}>
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
          disabled={zoom >= 4}
          className="h-7 w-7 p-0"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="h-7 w-7 p-0 ml-2"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
      </nav>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-muted/20">
        <img
          src={url}
          alt={title}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
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
      {previewType === 'excel' && <ExcelPreview url={url!} title={displayName} />}
      {previewType === 'xml' && <XmlPreview url={url!} title={displayName} />}
      {previewType === 'text' && <TxtPreview url={url!} title={displayName} />}
      {previewType === 'html' && <HtmlPreview url={url!} title={displayName} />}
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
