/**
 * GRIP CONTEXT MENU — ADR-357 Phase 11 / G10.A
 *
 * Floating right-click context menu shown next to a hot DXF grip
 * (AutoCAD multifunctional grip menu, full variant). Sister leaf of
 * {@link GripHoverMenu}: same dismiss rules (outside-click / Escape), distinct
 * concern (universal modes + terminal Exit, not entity-specific actions).
 *
 * ADR-040 micro-leaf: the ONLY subscriber to {@link GripContextMenuStore}.
 * Mounted as a sibling of `CanvasLayerStack` in `CanvasSection` so the
 * orchestrators (CanvasSection / CanvasLayerStack) stay subscription-free.
 *
 * Visual conventions:
 *   - The currently active grip mode is rendered with a leading `✓` glyph
 *     (radio behavior — clicking another mode switches and closes the menu).
 *   - Sections are visually separated by a thin divider.
 *   - The `Exit` row uses destructive (red) styling to match AutoCAD UX.
 *
 * @see GripContextMenuStore
 * @see GripHoverMenu — sister leaf (hover hold-menu, entity-specific actions)
 * @see ADR-040 §micro-leaf subscriber pattern
 */

'use client';

import React, { useSyncExternalStore, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { GripContextMenuStore } from '../../systems/grip/GripContextMenuStore';

export const GripContextMenu = React.memo(function GripContextMenu() {
  const snapshot = useSyncExternalStore(
    GripContextMenuStore.subscribe,
    GripContextMenuStore.getSnapshot,
    GripContextMenuStore.getSnapshot,
  );
  const { t } = useTranslation('tool-hints');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Dismiss on outside-click / Escape ─────────────────────────────────────
  useEffect(() => {
    if (!snapshot.visible) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && containerRef.current.contains(e.target as Node)) return;
      GripContextMenuStore.hide();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') GripContextMenuStore.hide();
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
  }, []);

  if (!snapshot.visible || !snapshot.screenPos) return null;

  return (
    <nav
      ref={containerRef}
      className="dxf-grip-context-menu fixed z-50 min-w-[180px] rounded-md border border-border bg-card shadow-lg"
      style={{ left: snapshot.screenPos.x, top: snapshot.screenPos.y }}
      aria-label={t('gripContextMenu.ariaLabel')}
      onContextMenu={(e) => e.preventDefault()}
    >
      {snapshot.sections.map((section, sectionIdx) => (
        <section
          key={section.id}
          className={
            sectionIdx > 0
              ? 'border-t border-border'
              : undefined
          }
        >
          {section.titleKey && (
            <h3 className="px-3 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(section.titleKey)}
            </h3>
          )}
          <ul className="py-1 text-sm">
            {section.items.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.onSelect)}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    opt.destructive
                      ? 'text-destructive hover:bg-[hsl(var(--bg-error))]/40'
                      : 'hover:bg-accent',
                  ].join(' ')}
                >
                  <span
                    className="inline-block w-3 text-center text-muted-foreground"
                    aria-hidden="true"
                  >
                    {opt.checked ? '✓' : ''}
                  </span>
                  <span className="flex-1">{t(opt.labelKey, opt.labelParams)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
});

export default GripContextMenu;
