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
 * Styling: uses DxfContextMenu shared primitives for visual consistency with
 * DrawingContextMenu and EntityContextMenu.
 *
 * @see GripContextMenuStore
 * @see GripHoverMenu — sister leaf (hover hold-menu, entity-specific actions)
 * @see ADR-040 §micro-leaf subscriber pattern
 * @see DxfContextMenu — shared context menu SSoT
 */

'use client';

import React, { useSyncExternalStore, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { GripContextMenuStore } from '../../systems/grip/GripContextMenuStore';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DxfMenuContent,
  DxfMenuItem,
  DxfMenuSeparator,
  DxfMenuHiddenTrigger,
  DxfMenuSectionTitle,
  DxfMenuLabel,
  DxfMenuCheck,
} from '../../ui/components/dxf-context-menu';

export const GripContextMenu = React.memo(function GripContextMenu() {
  const snapshot = useSyncExternalStore(
    GripContextMenuStore.subscribe,
    GripContextMenuStore.getSnapshot,
    GripContextMenuStore.getSnapshot,
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
    if (!open) GripContextMenuStore.hide();
  }, []);

  const handleSelect = useCallback((onSelect: () => void) => {
    onSelect();
  }, []);

  return (
    <DropdownMenu open={snapshot.visible} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <DxfMenuHiddenTrigger ref={triggerRef} />
      </DropdownMenuTrigger>
      <DxfMenuContent
        aria-label={t('gripContextMenu.ariaLabel')}
        onContextMenu={(e) => e.preventDefault()}
      >
        {snapshot.sections.map((section, sectionIdx) => (
          <React.Fragment key={section.id}>
            {sectionIdx > 0 && <DxfMenuSeparator />}
            {section.titleKey && (
              <DxfMenuSectionTitle>{t(section.titleKey)}</DxfMenuSectionTitle>
            )}
            {section.items.map((opt) => (
              <DxfMenuItem
                key={opt.id}
                disabled={opt.disabled}
                destructive={opt.destructive}
                onClick={() => handleSelect(opt.onSelect)}
              >
                <DxfMenuCheck checked={!!opt.checked} />
                <DxfMenuLabel>{t(opt.labelKey, opt.labelParams)}</DxfMenuLabel>
              </DxfMenuItem>
            ))}
          </React.Fragment>
        ))}
      </DxfMenuContent>
    </DropdownMenu>
  );
});

export default GripContextMenu;
