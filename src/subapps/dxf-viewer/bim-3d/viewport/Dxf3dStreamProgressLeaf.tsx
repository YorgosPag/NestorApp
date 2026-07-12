"use client";

/**
 * Dxf3dStreamProgressLeaf — ADR-645 Φάση A · ADR-040 micro-leaf.
 *
 * Forge/Figma-style «loading %» overlay for the incremental 3D DXF text streaming build.
 * The ONLY subscriber to `Dxf3dStreamProgressStore` (zero React state, `useSyncExternalStore`),
 * so streaming progress updates repaint this tiny leaf alone — never the whole viewport. Self-
 * hides when no build is in flight. All copy is i18n (N.11) — no hardcoded strings.
 */

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getDxf3dStreamProgress,
  getDxf3dStreamServerSnapshot,
  subscribeDxf3dStreamProgress,
} from '../stores/Dxf3dStreamProgressStore';

export function Dxf3dStreamProgressLeaf() {
  const { t } = useTranslation('bim3d');
  const progress = useSyncExternalStore(
    subscribeDxf3dStreamProgress,
    getDxf3dStreamProgress,
    getDxf3dStreamServerSnapshot,
  );

  if (!progress.active || progress.total <= 0) return null;
  const pct = Math.min(100, Math.round((progress.done / progress.total) * 100));

  return (
    <section
      className="pointer-events-none absolute inset-x-0 bottom-12 z-[80] flex justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-72 flex-col gap-2 rounded-lg border border-white/20 bg-black/70 px-4 py-3 text-white backdrop-blur-sm">
        <p className="text-sm font-semibold">{t('viewport.streaming.title')}</p>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-white/70">
          <span>{t('viewport.streaming.labels', { current: progress.done, total: progress.total })}</span>
          <span>{t('viewport.streaming.percent', { percent: pct })}</span>
        </div>
      </div>
    </section>
  );
}
