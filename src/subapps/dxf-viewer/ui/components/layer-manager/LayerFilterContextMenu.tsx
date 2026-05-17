'use client';

/**
 * LayerFilterContextMenu — right-click menu on a filter chip
 * (ADR-358 §5.7.bis Q11 Phase 11).
 *
 * User-created/imported filters → Rename / Edit / Duplicate / Delete.
 * Smart filters → Pin to top only (rename/delete disabled).
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { isSmartFilterId } from '../../../services/layer-smart-filters';

export interface LayerFilterContextMenuProps {
  readonly filterId: string;
  readonly x: number;
  readonly y: number;
  readonly onRename: () => void;
  readonly onEdit: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onPin: () => void;
  readonly onClose: () => void;
}

export function LayerFilterContextMenu({
  filterId, x, y, onRename, onEdit, onDuplicate, onDelete, onPin, onClose,
}: LayerFilterContextMenuProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const colors = useSemanticColors();
  const { getStatusBorder } = useBorderTokens();

  const isSmart = isSmartFilterId(filterId);

  const handleClick = (cb: () => void): React.MouseEventHandler => (e) => {
    e.stopPropagation();
    cb();
    onClose();
  };

  return (
    <nav
      role="menu"
      style={{ position: 'fixed', top: y, left: x, zIndex: 9999 }}
      className={`${colors.bg.muted} ${getStatusBorder('muted')} ${PANEL_LAYOUT.PADDING.LEFT_SM} ${PANEL_LAYOUT.PADDING.RIGHT_SM} ${PANEL_LAYOUT.PADDING.VERTICAL_XS}`}
      aria-label={t('layerFilters.aria.contextMenu')}
    >
      {isSmart ? (
        <button type="button" onClick={handleClick(onPin)} className={colors.text.primary} role="menuitem">
          {t('layerFilters.action.pinToTop')}
        </button>
      ) : (
        <>
          <button type="button" onClick={handleClick(onRename)} className={colors.text.primary} role="menuitem">
            {t('layerFilters.action.rename')}
          </button>
          <button type="button" onClick={handleClick(onEdit)} className={colors.text.primary} role="menuitem">
            {t('layerFilters.action.edit')}
          </button>
          <button type="button" onClick={handleClick(onDuplicate)} className={colors.text.primary} role="menuitem">
            {t('layerFilters.action.duplicate')}
          </button>
          <button type="button" onClick={handleClick(onDelete)} className={colors.text.error} role="menuitem">
            {t('layerFilters.action.delete')}
          </button>
        </>
      )}
    </nav>
  );
}
