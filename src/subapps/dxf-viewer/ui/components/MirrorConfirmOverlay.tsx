'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface MirrorConfirmOverlayProps {
  readonly onConfirm: (keepOriginals: boolean) => void;
  readonly onCancel: () => void;
}

export function MirrorConfirmOverlay({ onConfirm, onCancel }: MirrorConfirmOverlayProps) {
  const { t } = useTranslation(['dxf-viewer-guides']);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-white/20 bg-card/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <span className="text-sm font-medium text-white">
        {t('dxf-viewer-guides:mirrorTool.confirmTitle')}
      </span>
      <button
        type="button"
        onClick={() => onConfirm(true)}
        className="rounded-md bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-primary/80"
      >
        {t('dxf-viewer-guides:mirrorTool.confirmYes')}
      </button>
      <button
        type="button"
        onClick={() => onConfirm(false)}
        className="rounded-md bg-muted px-3 py-1 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-muted/80"
      >
        {t('dxf-viewer-guides:mirrorTool.confirmNo')}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="ml-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        aria-label="Cancel"
      >
        Esc
      </button>
    </div>
  );
}
