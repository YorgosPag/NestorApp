/**
 * =============================================================================
 * SharedShowcasePageContent — Public Property Showcase View (ADR-315 Phase M3)
 * =============================================================================
 *
 * Public page accessible without authentication at `/shared/[token]` when the
 * share's entityType is `property_showcase`. Replaces the legacy redirect to
 * `/shared/po/[token]` that forked Property Showcase onto a separate public
 * route (ADR-312). Under ADR-315 all three entity types share a single public
 * URL family.
 *
 * Rendering: `FilePreviewRenderer` with contentType='application/pdf' and url
 * pointing to the unified public PDF proxy `/api/shared/[token]/pdf`.
 *
 * @module components/shared/pages/SharedShowcasePageContent
 */

'use client';

import React, { useCallback } from 'react';
import { Clock, Download, Home } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { FilePreviewRenderer } from '@/components/shared/files/preview/FilePreviewRenderer';
import { openRemoteUrlInNewTab } from '@/lib/exports/trigger-export-download';
import type { PropertyShowcaseResolvedData } from '@/services/sharing/resolvers/property-showcase.resolver';

interface SharedShowcasePageContentProps {
  token: string;
  data: PropertyShowcaseResolvedData;
  expiresAt: string;
}

export function SharedShowcasePageContent({
  token,
  data,
  expiresAt,
}: SharedShowcasePageContentProps): React.ReactElement {
  const { t } = useTranslation(['properties-detail', 'files-media']);
  const colors = useSemanticColors();

  const pdfUrl = `/api/shared/${encodeURIComponent(token)}/pdf`;
  const title = data.propertyTitle ?? data.propertyId;

  const handleDownload = useCallback(() => {
    openRemoteUrlInNewTab(pdfUrl);
  }, [pdfUrl]);

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString('el-GR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <main className="min-h-screen bg-gradient-to-b from-muted/50 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardContent className="pt-6">
          <header className="text-center mb-6">
            <figure className="flex items-center justify-center mb-3">
              <Home className="h-10 w-10 text-primary" />
            </figure>
            <h1 className="text-lg font-semibold mb-1 truncate">{title}</h1>
            <p className={cn('text-xs', colors.text.muted)}>
              {t('properties-detail:showcase.title')}
            </p>
          </header>

          {data.note && (
            <p
              className={cn(
                'text-sm bg-muted/50 rounded-md p-3 mb-4 italic text-center',
                colors.text.muted,
              )}
            >
              {data.note}
            </p>
          )}

          <Button onClick={handleDownload} className="w-full mb-4" size="lg">
            <Download className="h-4 w-4 mr-2" />
            {t('properties-detail:showcase.downloadPdf')}
          </Button>

          <div className="border rounded-md overflow-hidden mb-4 flex flex-col min-h-[500px] max-h-[70vh]">
            <FilePreviewRenderer
              url={pdfUrl}
              contentType="application/pdf"
              fileName={`${title}.pdf`}
              displayName={title}
              onDownload={handleDownload}
            />
          </div>

          <footer
            className={cn(
              'flex items-center justify-center gap-2 text-xs',
              colors.text.muted,
            )}
          >
            <Clock className="h-3 w-3" />
            <span>
              {t('files-media:share.expires')} {expiresLabel}
            </span>
          </footer>
        </CardContent>
      </Card>
    </main>
  );
}
