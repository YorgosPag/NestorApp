/**
 * ENTERPRISE: FloorplanGalleryZoomControls — extracted toolbar widget.
 *
 * Pure presentational fragment used by `FloorplanGallery` for both inline
 * and fullscreen modal headers. Hosts zoom in/out/reset + optional
 * fullscreen-enter and modal-close affordances.
 *
 * @module components/shared/files/media/FloorplanGalleryZoomControls
 * @enterprise ADR-340 §3.6 / Phase 9 STEP H (extracted to free LOC budget)
 */

'use client';

import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Expand, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ZOOM_CONFIG } from '@/components/shared/files/media/floorplan-gallery-config';
import type { useZoomPan } from '@/hooks/useZoomPan';

export interface FloorplanGalleryZoomControlsProps {
  zp: ReturnType<typeof useZoomPan>;
  showFullscreen?: boolean;
  showClose?: boolean;
  onOpenFullscreen?: () => void;
  onCloseFullscreen?: () => void;
}

export function FloorplanGalleryZoomControls({
  zp,
  showFullscreen,
  showClose,
  onOpenFullscreen,
  onCloseFullscreen,
}: FloorplanGalleryZoomControlsProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={zp.zoomOut} disabled={zp.zoom <= ZOOM_CONFIG.minZoom} aria-label={t('floorplan.zoomOut')}>
            <ZoomOut className={iconSizes.sm} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('floorplan.zoomOut')}</TooltipContent>
      </Tooltip>
      <span className={cn('text-xs min-w-[40px] text-center', colors.text.muted)}>
        {Math.round(zp.zoom * 100)}%
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={zp.zoomIn} disabled={zp.zoom >= ZOOM_CONFIG.maxZoom} aria-label={t('floorplan.zoomIn')}>
            <ZoomIn className={iconSizes.sm} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('floorplan.zoomIn')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={zp.resetAll} aria-label={t('floorplan.resetZoom')}>
            <Maximize2 className={iconSizes.sm} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('floorplan.resetZoom')}</TooltipContent>
      </Tooltip>
      {showFullscreen && onOpenFullscreen && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onOpenFullscreen} aria-label={t('floorplan.fullscreen')}>
              <Expand className={iconSizes.sm} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('floorplan.fullscreen')}</TooltipContent>
        </Tooltip>
      )}
      {showClose && onCloseFullscreen && (
        <>
          <span className="w-px h-6 bg-border mx-1" aria-hidden="true" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onCloseFullscreen} aria-label={t('floorplan.close')}>
                <X className={iconSizes.sm} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('floorplan.close')}</TooltipContent>
          </Tooltip>
        </>
      )}
    </>
  );
}

export default FloorplanGalleryZoomControls;
