'use client';
/**
 * OverlapCountBadge — ADR-659 D4 (AutoCAD Selection Cycling badge).
 *
 * Tiny «⧉ N» chip that trails the cursor when ≥2 entities overlap under it, signalling the
 * user can disambiguate (2nd click same point / Shift+Space). Portal at document.body,
 * pointer-events-none so it never intercepts the click it advertises.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the low-freq OverlapBadgeStore.
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getOverlapBadgeSnapshot, subscribeOverlapBadge } from './OverlapBadgeStore';

export function OverlapCountBadge() {
  const { t } = useTranslation('dxf-viewer');
  const state = useSyncExternalStore(
    subscribeOverlapBadge,
    getOverlapBadgeSnapshot,
    getOverlapBadgeSnapshot,
  );

  if (state.count < 2) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <output
      aria-label={`${t('selectionCycling.overlapBadge', { count: state.count })} — ${t('selectionCycling.overlapBadgeHint')}`}
      style={{ left: state.clientX + 16, top: state.clientY - 10 }}
      className="fixed z-[2400] pointer-events-none select-none flex items-center gap-0.5 rounded-sm border border-border bg-popover/90 px-1 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm"
    >
      <span aria-hidden="true">⧉</span>
      <span className="font-mono">{state.count}</span>
    </output>,
    document.body,
  );
}
