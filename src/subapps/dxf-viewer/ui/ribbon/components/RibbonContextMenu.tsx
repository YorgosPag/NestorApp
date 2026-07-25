'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// ADR-364 — Escape Command Bus SSoT (no private window keydown listener)
import { useEscapeHandler, ESC_PRIORITY } from '../../../systems/escape-bus';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface RibbonContextMenuProps {
  position: ContextMenuPosition;
  isMinimized: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
}

export const RibbonContextMenu: React.FC<RibbonContextMenuProps> = ({
  position,
  isMinimized,
  onClose,
  onToggleMinimize,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onAnyClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', onAnyClick);
    return () => window.removeEventListener('mousedown', onAnyClick);
  }, [onClose]);

  // ADR-364 §10.14 (Κ2 #9) — ESC closes the menu through the central bus.
  // The private `window` keydown listener that used to live in the effect above
  // was a Zone-A competitor: it ran on every ESC in the app regardless of what
  // else claimed the press.
  //
  // `canHandle: () => true` is legitimate here (and NOT the §10.12 anti-pattern):
  // this component is rendered ONLY while the menu is open, so the registration's
  // lifetime IS the gate — an unmounted menu holds no bus slot at all.
  useEscapeHandler({
    id: 'ribbon/context-menu',
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    canHandle: () => true,
    handle: () => { onClose(); return true; },
  });

  return (
    <div
      ref={ref}
      className="dxf-ribbon-context-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
    >
      <button
        type="button"
        className="dxf-ribbon-context-menu-item"
        role="menuitemcheckbox"
        aria-checked={isMinimized}
        data-checked={isMinimized}
        onClick={() => {
          onToggleMinimize();
          onClose();
        }}
      >
        {t('ribbon.contextMenu.minimize')}
      </button>
      <button
        type="button"
        className="dxf-ribbon-context-menu-item"
        role="menuitem"
        data-disabled
        disabled
      >
        {t('ribbon.contextMenu.showTabs')}
      </button>
      <button
        type="button"
        className="dxf-ribbon-context-menu-item"
        role="menuitem"
        data-disabled
        disabled
      >
        {t('ribbon.contextMenu.showPanels')}
      </button>
      <button
        type="button"
        className="dxf-ribbon-context-menu-item"
        role="menuitem"
        data-disabled
        disabled
      >
        {t('ribbon.contextMenu.undock')}
      </button>
    </div>
  );
};
