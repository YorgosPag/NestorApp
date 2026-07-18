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
// ADR-677 — η ετικέτα ακολουθεί τη μονάδα που διάλεξε ο χρήστης στη status bar.
// Ήταν hardcoded «mm» ενώ οι ετικέτες αποστάσεων και το λευκό HUD έδειχναν ήδη
// τη μονάδα εμφάνισης — ο χρήστης έβλεπε «0,150 m» και πληκτρολογούσε σε «mm».
import { useDisplayUnit } from '../../hooks/common/useDisplayUnit';
import { DISPLAY_UNIT_LABELS } from '../../config/units';

// Module-level stable accessors (ADR-040 pattern)
const _isActive = () => CanvasNumericInputStore.isActive();
const _getBuffer = () => CanvasNumericInputStore.getBuffer();
const _subscribe = (cb: () => void) => CanvasNumericInputStore.subscribe(cb);

export const CanvasNumericInputOverlay = React.memo(function CanvasNumericInputOverlay() {
  const { t } = useTranslation('dxf-viewer-guides');

  // Low-frequency: αλλάζει μόνο όταν ο χρήστης πειράξει τον επιλογέα μονάδας.
  const { displayUnit } = useDisplayUnit();

  const isActive = useSyncExternalStore(_subscribe, _isActive, _isActive);
  const buffer = useSyncExternalStore(_subscribe, _getBuffer, _getBuffer);

  if (!isActive) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-md bg-popover/95 px-4 py-2 text-sm font-mono text-foreground shadow-lg border border-border pointer-events-none select-none">
      <span className="text-muted-foreground">{t('canvasNumericInput.label')}</span>
      <span className="min-w-[5ch]">
        {buffer || '0'}
        <span className="animate-pulse">█</span>
      </span>
      <span className="text-muted-foreground text-xs">{DISPLAY_UNIT_LABELS[displayUnit]}</span>
    </div>
  );
});
