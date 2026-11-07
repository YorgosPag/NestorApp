'use client';

/**
 * @fileoverview **Η μπάρα του `PdfCanvasViewer`** — πλοήγηση σελίδων, ζουμ, στροφή, πλήρης οθόνη, λήψη.
 * @module components/file-manager/PdfViewerToolbar
 *
 * Βγήκε από τον viewer στο ADR-923 §5.15.2 (Θ.2α-2), όταν μπήκε η λήψη: ο viewer κρατά κατάσταση και στρώσεις, η μπάρα
 * μόνο αποδίδει (N.7.1). Καμία δική της κατάσταση — κάθε ενέργεια έρχεται από τον κάτοχό της.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, Maximize, RotateCw } from 'lucide-react';

import { DocumentZoomControl } from '@/components/shared/media/viewer/DocumentZoomControl';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ZoomLimits } from '@/lib/geometry/zoom-pan-math';
import { cn } from '@/lib/utils';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import type { PdfDownloadStatus } from './usePdfDownload';
import type { PdfViewport } from './usePdfViewport';

export interface PdfViewerToolbarProps {
  readonly hidden: boolean;
  readonly currentPage: number;
  readonly numPages: number;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly viewport: PdfViewport;
  readonly limits: ZoomLimits;
  readonly onRotate: () => void;
  /** `null` ⇒ κρυφή (έντυπο με άδεια: θα άνοιγε την ίδια την άδεια, ADR-923 Η4). */
  readonly onFullscreen: (() => void) | null;
  /** `null` ⇒ ο καλών δεν ζήτησε λήψη. */
  readonly download: { readonly status: PdfDownloadStatus; readonly onDownload: () => void } | null;
}

function ToolButton({ label, onClick, disabled, children }: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" onClick={onClick} aria-label={label} disabled={disabled} className="h-7 w-7 p-0">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function PageNavigation({ currentPage, numPages, onPrev, onNext }: Pick<PdfViewerToolbarProps, 'currentPage' | 'numPages' | 'onPrev' | 'onNext'>) {
  const { t } = useTranslation('files');
  const colors = useSemanticColors();
  return (
    <div className="flex items-center gap-1">
      <ToolButton label={t('pdf.previousPage')} onClick={onPrev} disabled={currentPage <= 1}>
        <ChevronLeft className="h-4 w-4" />
      </ToolButton>
      <span className={cn('text-xs min-w-[60px] text-center tabular-nums', colors.text.muted)}>
        {currentPage} / {numPages}
      </span>
      <ToolButton label={t('pdf.nextPage')} onClick={onNext} disabled={currentPage >= numPages}>
        <ChevronRight className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}

/** Λήψη: κατά τη διάρκεια δείχνει πρόοδο (έντυπο με άδεια = κατεβαίνουν τα κομμάτια που λείπουν)· η αποτυχία μένει εδώ. */
function DownloadControl({ status, onDownload }: NonNullable<PdfViewerToolbarProps['download']>) {
  const { t } = useTranslation('files');
  const busy = status === 'busy';
  return (
    <>
      {/* Η ζώνη ανακοίνωσης υπάρχει ΠΡΙΝ γεμίσει — αλλιώς ο αναγνώστης οθόνης δεν ανακοινώνει την αποτυχία. */}
      <span role="status" className="text-xs text-destructive">{status === 'failed' ? t('pdf.downloadFailed') : ''}</span>
      <ToolButton label={busy ? t('pdf.downloading') : t('pdf.download')} onClick={onDownload} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </ToolButton>
    </>
  );
}

export function PdfViewerToolbar(props: PdfViewerToolbarProps) {
  const { viewport, limits, onRotate, onFullscreen, download } = props;
  const { t } = useTranslation('files');
  return (
    <nav className={cn('flex items-center justify-between px-3 py-1.5 border-b bg-muted/50 gap-2', props.hidden && 'invisible')}>
      <PageNavigation currentPage={props.currentPage} numPages={props.numPages} onPrev={props.onPrev} onNext={props.onNext} />
      <div className="flex items-center gap-1">
        {/* ADR-928 §5.25 — η ΚΟΙΝΗ μπάρα ζουμ σελίδας (μενού ποσοστού, σκάλα, «Προσαρμογή στο πλάτος» πατημένο). */}
        <DocumentZoomControl
          zoom={viewport.scale}
          fitted={viewport.fit === 'width'}
          pageFitted={viewport.fit === 'page'}
          limits={limits}
          onStep={viewport.step}
          onZoomTo={viewport.zoomTo}
          onFit={() => viewport.fitTo('width')}
          onFitPage={() => viewport.fitTo('page')}
        />
        <ToolButton label={t('preview.rotate')} onClick={onRotate}>
          <RotateCw className="h-3.5 w-3.5" />
        </ToolButton>
        {onFullscreen !== null && (
          <ToolButton label={t('pdf.fullscreen')} onClick={onFullscreen}>
            <Maximize className="h-3.5 w-3.5" />
          </ToolButton>
        )}
        {download !== null && <DownloadControl status={download.status} onDownload={download.onDownload} />}
      </div>
    </nav>
  );
}
