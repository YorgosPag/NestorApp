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
 *   - image       → ImagePreview (ΕΝΑ useZoomPan + ImageViewControls — ADR-899 §9 θέμα 3)
 *   - video       → HTML5 <video>
 *   - audio       → HTML5 <audio>
 *   - docx        → Client-side docx-preview rendering
 *   - dxf         → DxfPreview (σκηνή από την εγγραφή όταν υπάρχει, αλλιώς από τα bytes — ADR-899 §9 θέμα 8)
 *   - unsupported → Friendly fallback with download prompt
 *
 * @module components/shared/files/preview/FilePreviewRenderer
 * @enterprise ADR-191 — Enterprise Document Management System (Phase 4.3)
 */

'use client';

import { Download, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatFileSize } from '@/utils/file-validation';
import { PdfCanvasViewer } from '@/components/file-manager/PdfCanvasViewer';
import type { PreviewUrlDelivery } from '@/components/file-manager/pdf-fetch-target';
import { DocxPreview } from '@/components/file-manager/preview/DocxPreview';
import { ExcelPreview } from '@/components/file-manager/preview/ExcelPreview';
import { XmlPreview } from '@/components/file-manager/preview/XmlPreview';
import { TxtPreview } from '@/components/file-manager/preview/TxtPreview';
import { HtmlPreview } from '@/components/file-manager/preview/HtmlPreview';
import { DxfPreview } from '@/components/file-manager/preview/DxfPreview';
import { getPreviewType, type PreviewType } from '@/lib/file-types/preview-registry';
import type { ProxyImagePreview } from '@/lib/storage/storage-object-url';
import type { FileRecord } from '@/types/file-record';
import { ImagePreview } from './ImagePreview';
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
  /**
   * Παράγωγα κατ' απαίτηση της εικόνας (ADR-899 §4.1) — από τον `fileDisplayUrlOf`. Όταν δίνεται, η εικόνα ανοίγει
   * σε βαθμίδα στο μέγεθος του κουτιού και **ανεβαίνει** βαθμίδα μόνο όταν το zoom το απαιτεί· χωρίς αυτό, το `url`.
   */
  preview?: ProxyImagePreview | null;
  /**
   * Η εγγραφή του αρχείου, **όταν ο οικοδεσπότης την έχει** (ADR-899 §9 θέμα 8). Τη χρειάζεται όποια προεπισκόπηση
   * δεν είναι «τα bytes του `url`»: στις εγγραφές CAD η σκηνή ζει στο `processedData`, και το `url` δείχνει σε
   * συνοδευτικό. Η σελίδα κοινοποίησης δεν έχει εγγραφή ⇒ την παραλείπει και το σχέδιο διαβάζεται από το `url`.
   */
  record?: FileRecord | null;
  /**
   * Πώς παραδίδεται το `url` (ADR-901 §14.9). `'direct'` ⇒ είναι **βραχύβια υπογεγραμμένη άδεια** που ο διακομιστής
   * έδωσε αφού έκρινε, και ζητείται όπως είναι. Αφορά **μόνο** το PDF: είναι η μόνη προεπισκόπηση που αλλιώς περνά
   * από τον proxy `/api/download` — οι υπόλοιπες (εικόνα, κείμενο, DOCX, XML, HTML) ζητούν ήδη το `url` απευθείας.
   */
  urlDelivery?: PreviewUrlDelivery;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** PDF preview via pdfjs-dist canvas (theme-aware) */
function PdfPreview({ url, fileId, urlDelivery, title }: {
  url: string;
  fileId?: string;
  urlDelivery?: PreviewUrlDelivery;
  title: string;
}) {
  // 🔑 Το `fileId` **υπήρχε ήδη** σε αυτό το component (δηλωμένο στα props του, για
  //    το Excel preview) και **δεν προωθούνταν** στον PDF viewer — μετρημένο
  //    2026-09-16. Το κενό ήταν **μία γραμμή**, όχι έλλειψη δεδομένου (ADR-862 Φ0 Β8).
  return <PdfCanvasViewer url={url} fileId={fileId} urlDelivery={urlDelivery} title={title} className="flex-1" />;
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
  preview,
  record,
  urlDelivery,
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
      {previewType === 'pdf' && (
        <PdfPreview url={url!} fileId={fileId} urlDelivery={urlDelivery} title={displayName} />
      )}
      {previewType === 'image' && <ImagePreview url={url!} preview={preview} title={displayName} />}
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
      {previewType === 'dxf' && (
        <DxfPreview url={url!} fileName={fileName ?? displayName} title={displayName} record={record} />
      )}
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
