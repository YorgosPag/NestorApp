/**
 * GRIP HOVER MENU — ADR-349 Phase 1b.2
 *
 * Floating multifunctional menu shown next to a grip after the hover
 * hold-time (400ms) elapses. ADR-040 micro-leaf: the ONLY subscriber to
 * {@link GripHoverMenuStore}. Mounted as a sibling of CanvasLayerStack so
 * orchestrators (CanvasSection, CanvasLayerStack) stay subscription-free.
 *
 * @see GripHoverMenuStore
 * @see ADR-040 §micro-leaf subscriber pattern
 */

'use client';

import React, { useSyncExternalStore, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { GripHoverMenuStore } from '../../systems/grip/GripHoverMenuStore';

export const GripHoverMenu = React.memo(function GripHoverMenu() {
  const snapshot = useSyncExternalStore(
    GripHoverMenuStore.subscribe,
    GripHoverMenuStore.getSnapshot,
    GripHoverMenuStore.getSnapshot,
  );
  const { t } = useTranslation('tool-hints');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Dismiss on outside-click / Escape ───────────────────────────────────
  useEffect(() => {
    if (!snapshot.visible) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && containerRef.current.contains(e.target as Node)) return;
      GripHoverMenuStore.hide();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') GripHoverMenuStore.hide();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [snapshot.visible]);

  const handleSelect = useCallback((onSelect: () => void) => {
    onSelect();
    GripHoverMenuStore.hide();
  }, []);

  if (!snapshot.visible || !snapshot.screenPos) return null;

  return (
    <nav
      ref={containerRef}
      className="dxf-grip-menu fixed z-50 min-w-[160px] rounded-md border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
      style={{ left: snapshot.screenPos.x, top: snapshot.screenPos.y }}
      aria-label={t('gripMenu.ariaLabel')}
    >
      <ul className="py-1 text-sm">
        {snapshot.options.map((opt) => (
          <li key={opt.id}>
            <button
              type="button"
              disabled={opt.disabled}
              onClick={() => handleSelect(opt.onSelect)}
              className="block w-full px-3 py-1.5 text-left hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-800"
            >
              {t(opt.labelKey)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
});

export default GripHoverMenu;
