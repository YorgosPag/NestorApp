'use client';

/**
 * QuoteOriginalDocumentPanel — ADR-327 §Phase G.
 *
 * The "sister artifact" of `ExtractedDataReviewPanel`: shows the original
 * scanned document (image/PDF) so the user can verify the AI extraction
 * against the source.
 *
 * Pure SSoT integration:
 *   - File loading via `useEntityFiles` (ADR-031 file system)
 *   - Preview rendering via `FilePreviewRenderer` (ADR-191 preview SSoT)
 *   - Download via `useFileDownload`
 *   - Display name + path canonicale via existing builders
 *
 * Used in:
 *   - /procurement/quotes/[id]/review (full mode, side-by-side with AI panel)
 *   - QuoteDetailSummary (compact mode, inline link list)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEntityFiles } from '@/components/shared/files/hooks/useEntityFiles';
import { useFileDownload } from '@/components/shared/files/hooks/useFileDownload';
import { FilePreviewRenderer } from '@/components/shared/files/preview/FilePreviewRenderer';
import {
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
} from '@/config/domain-constants';
import { formatFileSize } from '@/utils/file-validation';
import { cn } from '@/lib/utils';

// ============================================================================
// PROPS
// ============================================================================

export interface QuoteOriginalDocumentPanelProps {
  quoteId: string;
  companyId: string;
  /** Compact list mode for detail summary (no preview, just links). */
  compact?: boolean;
  /** Add lg:sticky lg:top-4 so the preview stays in view while scrolling AI data. */
  sticky?: boolean;
  className?: string;
}

// ============================================================================
// COMPACT MODE (used inside QuoteDetailSummary)
// ============================================================================

interface CompactProps {
  files: ReturnType<typeof useEntityFiles>['files'];
  className?: string;
}

function CompactList({ files, className }: CompactProps) {
  const { t } = useTranslation('quotes');
  const { handleDownload } = useFileDownload();

  return (
    <section
      aria-label={t('quotes.scan.originalDocument.title')}
      className={cn('space-y-2', className)}
    >
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <FileText className="h-4 w-4" />
        {t('quotes.scan.originalDocument.title')}
      </h3>
      <ul className="space-y-1">
        {files.map((f) => {
          const isImage = (f.contentType ?? '').startsWith('image/');
          return (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {isImage ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{f.displayName}</span>
                {typeof f.sizeBytes === 'number' && (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatFileSize(f.sizeBytes)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {f.downloadUrl && (
                  <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                    <a
                      href={f.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('quotes.scan.originalDocument.openExternal')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDownload(f)}
                  aria-label={t('quotes.scan.originalDocument.download')}
                  className="h-8 w-8 p-0"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ============================================================================
// MAIN PANEL
// ============================================================================

export function QuoteOriginalDocumentPanel({
  quoteId,
  companyId,
  compact = false,
  sticky = false,
  className,
}: QuoteOriginalDocumentPanelProps) {
  const { t } = useTranslation('quotes');
  const { handleDownload } = useFileDownload();
  const [activeIndex, setActiveIndex] = useState(0);

  const { files, loading, error } = useEntityFiles({
    entityType: ENTITY_TYPES.QUOTE,
    entityId: quoteId,
    companyId,
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.DOCUMENTS,
    realtime: true,
  });

  if (error) {
    return (
      <Card className={cn(className)}>
        <CardContent className="py-4 text-sm text-destructive">
          {error.message}
        </CardContent>
      </Card>
    );
  }

  if (loading && files.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardContent className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('quotes.loading')}
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
          <FileText className="h-8 w-8 opacity-50" />
          <p className="text-sm">
            {t('quotes.scan.originalDocument.empty')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return <CompactList files={files} className={className} />;
  }

  const activeFile = files[activeIndex] ?? files[0];

  return (
    <Card className={cn(className, sticky && 'lg:sticky lg:top-4')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">
            {t('quotes.scan.originalDocument.title')}
          </CardTitle>
          <Badge variant="secondary">
            {t('quotes.scan.originalDocument.badge')}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {activeFile?.downloadUrl && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={activeFile.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                {t('quotes.scan.originalDocument.openExternal')}
              </a>
            </Button>
          )}
          {activeFile && (
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleDownload(activeFile)}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              {t('quotes.scan.originalDocument.download')}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {files.length > 1 && (
          <nav
            aria-label="attachment-selector"
            className="flex flex-wrap gap-1"
          >
            {files.map((f, i) => (
              <Button
                key={f.id}
                variant={i === activeIndex ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveIndex(i)}
                className="h-7 text-xs"
              >
                {f.displayName}
              </Button>
            ))}
          </nav>
        )}

        {activeFile && (
          <figure className="flex min-h-[400px] flex-col overflow-hidden rounded-md border lg:min-h-[600px]">
            <FilePreviewRenderer
              url={activeFile.downloadUrl}
              contentType={activeFile.contentType}
              fileName={activeFile.originalFilename}
              displayName={activeFile.displayName}
              fileId={activeFile.id}
              sizeBytes={activeFile.sizeBytes}
              onDownload={() => void handleDownload(activeFile)}
            />
          </figure>
        )}

        {activeFile && (
          <footer className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>{activeFile.contentType}</span>
            {typeof activeFile.sizeBytes === 'number' && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatFileSize(activeFile.sizeBytes)}</span>
              </>
            )}
          </footer>
        )}
      </CardContent>
    </Card>
  );
}
