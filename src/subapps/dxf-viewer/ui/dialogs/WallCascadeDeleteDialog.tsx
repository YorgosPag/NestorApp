'use client';

/**
 * ADR-363 Phase cascade-delete — Confirmation dialog for wall + child openings.
 *
 * Shown when the user deletes a wall that owns one or more openings. Renders
 * via createPortal to document.body (pattern mirror: PathDeletionWarningDialog).
 * Subscribes to WallCascadeDeleteStore via useSyncExternalStore — zero props.
 *
 * Two actions:
 *   - 'delete-all' → delete the wall AND all its child openings.
 *   - 'cancel'     → abort the delete operation (wall stays).
 *
 * The cancel button has autoFocus (industry standard: Figma, Linear, Notion —
 * safest default so an accidental Enter cannot trigger destructive action).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  subscribeWallCascadeDelete,
  getWallCascadeDeleteState,
  resolveWallCascadeDelete,
} from '../../bim/walls/wall-cascade-delete-store';

export const WallCascadeDeleteDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(subscribeWallCascadeDelete, getWallCascadeDeleteState);

  if (!state.open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">
          {t('bim.wallCascadeDelete.title')}
        </h2>
        <p className="dxf-modal-body">
          {t('bim.wallCascadeDelete.body', { count: state.openingCount })}
        </p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            className="dxf-modal-button dxf-modal-button-danger"
            onClick={() => resolveWallCascadeDelete('delete-all')}
          >
            {t('bim.wallCascadeDelete.confirmDelete')}
          </button>
          <button
            type="button"
            autoFocus
            className="dxf-modal-button"
            onClick={() => resolveWallCascadeDelete('cancel')}
          >
            {t('bim.wallCascadeDelete.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
