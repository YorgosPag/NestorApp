'use client';

/**
 * ADR-353 Q23 — Modal shown when the user tries to delete an entity
 * referenced as `pathEntityId` by one or more path-arrays.
 *
 * Three actions:
 *   - 'delete-both' → delete the path AND the referencing arrays.
 *   - 'explode'     → explode the arrays into independent items, then
 *                     delete the path.
 *   - 'cancel'      → abort the delete operation.
 *
 * Phase A: stub UI only. No path arrays exist yet (rect-only), so the
 * dialog is never mounted at runtime. Activated in Phase C alongside
 * `path-deletion-guard.ts`.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PathDeletionAction } from '../../systems/array/path-deletion-guard';

export interface PathDeletionWarningDialogProps {
  readonly open: boolean;
  readonly referencingArrayCount: number;
  readonly onResolve: (action: PathDeletionAction) => void;
}

export const PathDeletionWarningDialog: React.FC<PathDeletionWarningDialogProps> = ({
  open,
  referencingArrayCount,
  onResolve,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">
          {t('array.pathDeletion.title')}
        </h2>
        <p className="dxf-modal-body">
          {t('array.pathDeletion.body', { count: referencingArrayCount })}
        </p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            className="dxf-modal-button dxf-modal-button-danger"
            onClick={() => onResolve('delete-both')}
          >
            {t('array.pathDeletion.deleteBoth')}
          </button>
          <button
            type="button"
            className="dxf-modal-button dxf-modal-button-primary"
            onClick={() => onResolve('explode')}
          >
            {t('array.pathDeletion.explode')}
          </button>
          <button
            type="button"
            className="dxf-modal-button"
            onClick={() => onResolve('cancel')}
          >
            {t('array.pathDeletion.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
