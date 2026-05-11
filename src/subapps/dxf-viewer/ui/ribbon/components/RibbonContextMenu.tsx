'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onAnyClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onAnyClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

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
