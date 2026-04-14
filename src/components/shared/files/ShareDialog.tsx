/**
 * =============================================================================
 * 🏢 ENTERPRISE: Share Dialog (thin wrapper)
 * =============================================================================
 *
 * Thin wrapper over `ShareSurfaceShell` + `LinkTokenPermissionPanel` that
 * injects the file-share service as the submit function and maps the
 * `files.share.*` i18n namespace into the shared surface labels.
 *
 * @module components/shared/files/ShareDialog
 * @enterprise ADR-147 Unified Share Surface (Phase B) — supersedes ADR-191 Phase 4.2 dialog
 */

'use client';

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShareSurfaceShell, useShareFlow } from '@/components/ui/sharing';
import { LinkTokenPermissionPanel } from '@/components/ui/sharing/panels/LinkTokenPermissionPanel';
import {
  INITIAL_LINK_TOKEN_DRAFT,
  type LinkTokenDraft,
  type LinkTokenResultData,
} from '@/components/ui/sharing/panels/link-token/types';
import { createFileShareWithPolicy } from '@/services/filesystem/file-mutation-gateway';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileName: string;
  userId: string;
  companyId?: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
  userId,
  companyId,
}: ShareDialogProps): React.ReactElement {
  const { t } = useTranslation(['files', 'files-media']);
  const { t: tShell } = useTranslation('common-shared');

  const expirationLabelFor = useCallback(
    (hours: string): string => {
      const map: Record<string, string> = {
        '1': t('share.expirationOptions.1hour'),
        '24': t('share.expirationOptions.24hours'),
        '72': t('share.expirationOptions.3days'),
        '168': t('share.expirationOptions.1week'),
        '720': t('share.expirationOptions.30days'),
      };
      return map[hours] ?? hours;
    },
    [t],
  );

  const submit = useCallback(
    async (draft: LinkTokenDraft): Promise<LinkTokenResultData> => {
      const maxDownloadsCount = parseInt(draft.maxDownloads, 10);
      const token = await createFileShareWithPolicy({
        fileId,
        createdBy: userId,
        expiresInHours: parseInt(draft.expiresInHours, 10),
        password: draft.password.trim() || undefined,
        maxDownloads: maxDownloadsCount,
        note: draft.note.trim() || undefined,
        companyId,
      });
      return {
        url: `${window.location.origin}/shared/${token}`,
        expiresInHoursLabel: expirationLabelFor(draft.expiresInHours),
        maxDownloadsCount,
        passwordProtected: draft.password.trim().length > 0,
      };
    },
    [fileId, userId, companyId, expirationLabelFor],
  );

  const flow = useShareFlow<LinkTokenDraft, LinkTokenResultData>({
    initialDraft: INITIAL_LINK_TOKEN_DRAFT,
    submit,
  });

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset state after close animation (preserves ADR-191 Phase 4.2 UX)
    setTimeout(() => {
      flow.reset();
    }, 200);
  }, [onOpenChange, flow]);

  const entity = useMemo(
    () => ({
      kind: 'file' as const,
      id: fileId,
      title: t('share.title'),
      subtitle: fileName,
      companyId,
    }),
    [fileId, fileName, companyId, t],
  );

  return (
    <ShareSurfaceShell
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
      entity={entity}
      labels={{
        title: t('share.title'),
        subtitle: fileName,
        closeLabel: t('share.close'),
        errorPrefix: tShell('shareSurface.errorPrefix'),
      }}
      status={flow.state.status}
      error={flow.state.error}
    >
      <LinkTokenPermissionPanel
        entity={entity}
        draft={flow.draft}
        onDraftChange={flow.setDraft}
        onSubmit={flow.submit}
        onCancel={handleClose}
        state={flow.state}
      />
    </ShareSurfaceShell>
  );
}
