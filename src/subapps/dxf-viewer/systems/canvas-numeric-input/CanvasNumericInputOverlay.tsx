/**
 * ⚠️ ARCHITECTURE-CRITICAL — ADR-040 micro-leaf pattern.
 * Subscribes to CanvasNumericInputStore only.
 * Only this component re-renders on buffer change.
 * Shell (CanvasLayerStack) MUST NOT call useSyncExternalStore — keep it here.
 */
'use client';

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { CanvasNumericInputStore } from './CanvasNumericInputStore';

// Module-level stable accessors (ADR-040 pattern)
const _isActive = () => CanvasNumericInputStore.isActive();
const _getBuffer = () => CanvasNumericInputStore.getBuffer();
const _subscribe = (cb: () => void) => CanvasNumericInputStore.subscribe(cb);

export const CanvasNumericInputOverlay = React.memo(function CanvasNumericInputOverlay() {
  const { t } = useTranslation('dxf-viewer-guides');

  const isActive = useSyncExternalStore(_subscribe, _isActive, _isActive);
  const buffer = useSyncExternalStore(_subscribe, _getBuffer, _getBuffer);

  if (!isActive) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-md bg-gray-900/90 px-4 py-2 text-sm font-mono text-white shadow-lg border border-white/10 pointer-events-none select-none">
      <span className="text-gray-400">{t('canvasNumericInput.label')}</span>
      <span className="min-w-[5ch]">
        {buffer || '0'}
        <span className="animate-pulse">█</span>
      </span>
      <span className="text-gray-500 text-xs">mm</span>
    </div>
  );
});
