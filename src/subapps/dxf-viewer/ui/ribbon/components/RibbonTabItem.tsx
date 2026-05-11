'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonTab } from '../types/ribbon-types';
import type { TabDragHandlers } from '../hooks/useRibbonTabDrag';

interface RibbonTabItemProps {
  tab: RibbonTab;
  isActive: boolean;
  onActivate: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  drag: TabDragHandlers;
}

export const RibbonTabItem: React.FC<RibbonTabItemProps> = ({
  tab,
  isActive,
  onActivate,
  onDoubleClick,
  onContextMenu,
  drag,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const isDragging = drag.draggingId === tab.id;
  const isDropTarget = drag.dropTargetId === tab.id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className="dxf-ribbon-tab"
      data-active={isActive}
      data-contextual={tab.isContextual ?? false}
      data-dragging={isDragging}
      data-drop-target={isDropTarget}
      draggable
      onClick={onActivate}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragStart={drag.onDragStart(tab.id)}
      onDragOver={drag.onDragOver(tab.id)}
      onDragLeave={drag.onDragLeave}
      onDrop={drag.onDrop(tab.id)}
      onDragEnd={drag.onDragEnd}
    >
      {t(tab.labelKey)}
    </button>
  );
};
