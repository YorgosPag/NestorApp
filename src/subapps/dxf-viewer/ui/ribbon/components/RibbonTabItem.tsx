'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RibbonTab } from '../types/ribbon-types';
import type { TabDragHandlers } from '../hooks/useRibbonTabDrag';
import { useRibbonBadgeState } from '../context/useRibbonFieldSelectors';

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
  // ADR-547 Stage 4 Option B — per-key badge subscription (was the volatile field
  // context → re-rendered every tab on any field change). '' = no badge → false.
  const badgeState = useRibbonBadgeState(tab.badgeKey ?? '');
  const isDragging = drag.draggingId === tab.id;
  const isDropTarget = drag.dropTargetId === tab.id;
  // ADR-358 Phase 7b1 — Validation badge surfacing.
  const showBadge = tab.badgeKey ? badgeState : false;
  const badgeAriaLabel = tab.badgeKey
    ? t('ribbon.tabs.validationBadge', { defaultValue: '' })
    : '';
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
      data-has-badge={showBadge}
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
      {showBadge && (
        <span
          className="dxf-ribbon-tab-badge"
          role="img"
          aria-label={badgeAriaLabel}
        >
          !
        </span>
      )}
    </button>
  );
};
