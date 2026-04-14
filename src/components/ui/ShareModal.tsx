/**
 * =============================================================================
 * 🏢 ENTERPRISE: Share Modal (thin wrapper)
 * =============================================================================
 *
 * Thin wrapper over `ShareSurfaceShell` + `UserAuthPermissionPanel` that
 * preserves the public API (`ShareModalProps`, `useShareModal`) expected by
 * existing callers — `ContactsList.handleShareContact` and friends.
 *
 * All platform/channel/email/photo logic lives in `UserAuthPermissionPanel`
 * and its sub-modules under `@/components/ui/sharing/panels/user-auth/`.
 *
 * @module components/ui/ShareModal
 * @see ADR-147 Unified Share Surface (Phase B)
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShareSurfaceShell } from '@/components/ui/sharing';
import { UserAuthPermissionPanel } from '@/components/ui/sharing/panels/UserAuthPermissionPanel';
import type { ShareData } from '@/components/ui/email-sharing/EmailShareForm';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: ShareData & {
    isPhoto?: boolean;
  };
  /** Custom modal title — defaults to i18n common:share.share */
  modalTitle?: string;
  onCopySuccess?: () => void;
  onShareSuccess?: (platform: string) => void;
  onShareError?: (platform: string, error: string) => void;
}

export function ShareModal({
  isOpen,
  onClose,
  shareData,
  modalTitle,
  onCopySuccess,
  onShareSuccess,
  onShareError,
}: ShareModalProps): React.ReactElement {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const { t: tShell } = useTranslation('common-shared');
  const [loading, setLoading] = useState(false);

  const entity = useMemo(
    () => ({
      kind: 'contact' as const,
      id: shareData.url,
      title: modalTitle ?? t('share.share'),
      subtitle: shareData.title,
    }),
    [shareData.url, shareData.title, modalTitle, t],
  );

  const handleOpenChange = useCallback(
    (next: boolean): void => {
      if (!next) onClose();
    },
    [onClose],
  );

  return (
    <ShareSurfaceShell
      open={isOpen}
      onOpenChange={handleOpenChange}
      entity={entity}
      labels={{
        title: modalTitle ?? t('share.share'),
        subtitle: shareData.title,
        closeLabel: tShell('shareSurface.close'),
        errorPrefix: tShell('shareSurface.errorPrefix'),
      }}
      status={loading ? 'submitting' : 'idle'}
      error={null}
    >
      <UserAuthPermissionPanel
        shareData={shareData}
        isOpen={isOpen}
        onClose={onClose}
        onCopySuccess={onCopySuccess}
        onShareSuccess={onShareSuccess}
        onShareError={onShareError}
        onLoadingChange={setLoading}
      />
    </ShareSurfaceShell>
  );
}

export function useShareModal() {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openModal,
    closeModal,
  };
}

export default ShareModal;
