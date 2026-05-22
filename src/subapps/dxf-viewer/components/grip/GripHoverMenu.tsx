/**
 * GRIP HOVER MENU — ADR-349 Phase 1b.2
 *
 * Floating multifunctional menu shown next to a grip after the hover
 * hold-time (400ms) elapses. ADR-040 micro-leaf: the ONLY subscriber to
 * {@link GripHoverMenuStore}. Mounted as a sibling of CanvasLayerStack so
 * orchestrators (CanvasSection, CanvasLayerStack) stay subscription-free.
 *
 * Styling: uses DxfContextMenu shared primitives for visual consistency with
 * DrawingContextMenu, EntityContextMenu, and GripContextMenu.
 *
 * @see GripHoverMenuStore
 * @see ADR-040 §micro-leaf subscriber pattern
 * @see DxfContextMenu — shared context menu SSoT
 */

'use client';

import React, { useSyncExternalStore, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { GripHoverMenuStore } from '../../systems/grip/GripHoverMenuStore';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DxfMenuContent,
  DxfMenuItem,
  DxfMenuHiddenTrigger,
  DxfMenuLabel,
} from '../../ui/components/dxf-context-menu';

export const GripHoverMenu = React.memo(function GripHoverMenu() {
  const snapshot = useSyncExternalStore(
    GripHoverMenuStore.subscribe,
    GripHoverMenuStore.getSnapshot,
    GripHoverMenuStore.getSnapshot,
  );
  const { t } = useTranslation('tool-hints');
  const triggerRef = useRef<HTMLSpanElement>(null);

  // Position the hidden trigger at the grip screen position from the store.
  useEffect(() => {
    if (snapshot.visible && snapshot.screenPos && triggerRef.current) {
      triggerRef.current.style.left = `${snapshot.screenPos.x}px`;
      triggerRef.current.style.top = `${snapshot.screenPos.y}px`;
    }
  }, [snapshot.visible, snapshot.screenPos]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) GripHoverMenuStore.hide();
  }, []);

  const handleSelect = useCallback((onSelect: () => void) => {
    onSelect();
    GripHoverMenuStore.hide();
  }, []);

  return (
    <DropdownMenu open={snapshot.visible} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <DxfMenuHiddenTrigger ref={triggerRef} />
      </DropdownMenuTrigger>
      <DxfMenuContent
        aria-label={t('gripMenu.ariaLabel')}
        onContextMenu={(e) => e.preventDefault()}
      >
        {snapshot.options.map((opt) => (
          <DxfMenuItem
            key={opt.id}
            disabled={opt.disabled}
            onClick={() => handleSelect(opt.onSelect)}
          >
            <DxfMenuLabel>{t(opt.labelKey)}</DxfMenuLabel>
          </DxfMenuItem>
        ))}
      </DxfMenuContent>
    </DropdownMenu>
  );
});

export default GripHoverMenu;
