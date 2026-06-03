'use client';

/**
 * ADR-412 Φ5 — «Delete Wall Type» warn dialog (Q6, non-destructive detach).
 *
 * Shown when the user deletes a family type. Mirrors `WallCascadeDeleteDialog`
 * (portal + `useSyncExternalStore`, zero props). Resolves the type's display
 * name from the catalog store. Two actions:
 *   - 'delete-and-detach' → detach instances (keep their dimensions) + delete type.
 *   - 'cancel'            → abort (type stays).
 *
 * Cancel has autoFocus (safest default — accidental Enter can't delete).
 *
 * @see ../../bim/family-types/bim-family-type-delete-store.ts
 * @see ../dialogs/WallCascadeDeleteDialog.tsx — sibling pattern
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimFamilyTypeStore } from '../../bim/family-types/bim-family-type-store';
import { asWallFamilyType, resolveTypeDisplayName } from '../../bim/family-types/family-type-ui-helpers';
import {
  subscribeFamilyTypeDelete,
  getFamilyTypeDeleteState,
  resolveFamilyTypeDelete,
} from '../../bim/family-types/bim-family-type-delete-store';

export const BimFamilyTypeDeleteDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(subscribeFamilyTypeDelete, getFamilyTypeDeleteState);
  const getType = useBimFamilyTypeStore((s) => s.getType);

  if (!state.open || !state.typeId || typeof document === 'undefined') return null;

  const type = asWallFamilyType(getType(state.typeId));
  const name = type ? resolveTypeDisplayName(type, t) : '';
  const body =
    state.affectedCount > 0
      ? t('ribbon.commands.bimFamilyType.deleteTypeBody', { name, count: state.affectedCount })
      : t('ribbon.commands.bimFamilyType.deleteTypeBodyUnused', { name });

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('ribbon.commands.bimFamilyType.deleteTypeTitle')}</h2>
        <p className="dxf-modal-body">{body}</p>
        <div className="dxf-modal-actions">
          <button
            type="button"
            className="dxf-modal-button dxf-modal-button-danger"
            onClick={() => resolveFamilyTypeDelete('delete-and-detach')}
          >
            {t('ribbon.commands.bimFamilyType.deleteTypeConfirm')}
          </button>
          <button
            type="button"
            autoFocus
            className="dxf-modal-button"
            onClick={() => resolveFamilyTypeDelete('cancel')}
          >
            {t('ribbon.commands.bimFamilyType.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
