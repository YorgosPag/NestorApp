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
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-white/20 bg-neutral-900/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <span className="text-sm font-medium text-white">
        {t('dxf-viewer-guides:mirrorTool.confirmTitle')}
      </span>
      <button
        type="button"
        onClick={() => onConfirm(true)}
        className="rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:bg-blue-700"
      >
        {t('dxf-viewer-guides:mirrorTool.confirmYes')}
      </button>
      <button
        type="button"
        onClick={() => onConfirm(false)}
        className="rounded-md bg-neutral-700 px-3 py-1 text-sm font-semibold text-white hover:bg-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 active:bg-neutral-800"
      >
        {t('dxf-viewer-guides:mirrorTool.confirmNo')}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="ml-1 rounded-md px-2 py-1 text-sm text-neutral-400 hover:text-white"
        aria-label="Cancel"
      >
        Esc
      </button>
    </div>
  );
}
