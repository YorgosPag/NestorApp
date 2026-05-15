'use client';

/**
 * ADR-353 Q24 — Modal shown when the user exits Edit Source mode after
 * deleting the last source entity inside an associative array.
 *
 * Two actions:
 *   - 'delete-array' → drop the now-empty array entity from the scene.
 *   - 'restore'      → re-enter edit mode so the user can add a source
 *                      back (caller handles the revert path).
 *
 * Phase A: stub UI only — `exitEditSource` returns `{ ok: false,
 * reason: 'empty' }` and the caller chooses whether to mount this
 * dialog. Full integration lives alongside the Edit Source UX in a
 * later session.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export type EmptySourceAction = 'delete-array' | 'restore';

export interface EmptySourceWarningDialogProps {
  readonly open: boolean;
  readonly onResolve: (action: EmptySourceAction) => void;
}

export const EmptySourceWarningDialog: React.FC<EmptySourceWarningDialogProps> = ({
  open,
  onResolve,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">
          {t('array.emptySource.title')}
        </h2>
        <p className="dxf-modal-body">
          {t('array.emptySource.body')}
        </p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            className="dxf-modal-button dxf-modal-button-danger"
            onClick={() => onResolve('delete-array')}
          >
            {t('array.emptySource.deleteArray')}
          </button>
          <button
            type="button"
            className="dxf-modal-button dxf-modal-button-primary"
            onClick={() => onResolve('restore')}
          >
            {t('array.emptySource.restore')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
