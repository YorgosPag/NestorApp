/**
 * =============================================================================
 * UNIFIED SHARE DIALOG (ADR-315)
 * =============================================================================
 *
 * Single adaptive dialog for file / contact / property_showcase shares.
 *
 * Architecture:
 *   - Wraps ADR-147 `ShareSurfaceShell` (presentational chrome)
 *   - Stage 1 — all entity types: `LinkTokenForm` (4 canonical fields:
 *     expiration / password / max accesses / note)
 *   - Stage 2 — all entity types: `LinkTokenResult` (URL + copy + policy)
 *   - Stage 3 — `contact` only: optional channel dispatch step
 *     (`UserAuthPermissionPanel` now receiving a real URL — fixes the
 *     long-standing copy-link bug)
 *
 * Persistence: delegates to `UnifiedSharingService` (Tier 2 SSoT).
 * Channel dispatch: delegates to existing API routes; Phase E migrates to
 * `ChannelDispatchService`.
 *
 * @module components/sharing/UnifiedShareDialog
 * @see adrs/ADR-315-unified-sharing.md §3.4
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShareSurfaceShell, useShareFlow } from '@/components/ui/sharing';
import { LinkTokenForm } from '@/components/ui/sharing/panels/link-token/LinkTokenForm';
import { LinkTokenResult } from '@/components/ui/sharing/panels/link-token/LinkTokenResult';
import {
  INITIAL_LINK_TOKEN_DRAFT,
  type LinkTokenDraft,
  type LinkTokenResultData,
} from '@/components/ui/sharing/panels/link-token/types';
import { UserAuthPermissionPanel } from '@/components/ui/sharing/panels/UserAuthPermissionPanel';
import type { ShareData } from '@/components/ui/email-sharing/EmailShareForm';
import { Button } from '@/components/ui/button';
import { Download, Send } from 'lucide-react';
import { UnifiedSharingService } from '@/services/sharing/unified-sharing.service';
// Side-effect import: registers file / contact / property_showcase resolvers
import '@/services/sharing/resolvers';
import type {
  ContactShareMeta,
  CreateShareInput,
  FileShareMeta,
  ShareEntityType,
  ShowcaseShareMeta,
} from '@/types/sharing';

// ============================================================================
// PROPS
// ============================================================================

export interface UnifiedShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: ShareEntityType;
  entityId: string;
  /** Display title for the dialog header (e.g. file name, contact name, property title). */
  entityTitle: string;
  /** Display subtitle for the dialog header (optional). */
  entitySubtitle?: string;
  userId: string;
  companyId: string;
  /** Per-entity metadata (required for property_showcase.pdfStoragePath and contact.includedFields). */
  showcaseMeta?: ShowcaseShareMeta;
  contactMeta?: ContactShareMeta;
  fileMeta?: FileShareMeta;
  /**
   * Content used by the contact-only channel dispatch stage (grid buttons +
   * email form + ContactChannelPicker). Ignored for file / property_showcase.
   * If omitted, only the link-copy path is shown (no channel dispatch UI).
   */
  contactShareContent?: Omit<ShareData, 'url'>;
  /**
   * Optional pre-submit hook. Invoked BEFORE `UnifiedSharingService.createShare`
   * to produce entity-specific metadata that must be generated at submit time
   * (e.g. Property Showcase PDF upload). The returned partial is merged into
   * the createShare input. Errors abort the flow via `useShareFlow`.
   *
   * Typical use — property_showcase: fetch `/api/properties/[id]/showcase/pdf`
   * and return `{ showcaseMeta: { pdfStoragePath, pdfRegeneratedAt } }`.
   */
  preSubmit?: () => Promise<
    Pick<CreateShareInput, 'showcaseMeta' | 'contactMeta' | 'fileMeta'>
  >;
  onShareSuccess?: (platform: string) => void;
  onShareError?: (platform: string, error: string) => void;
  onCopySuccess?: () => void;
}

// ============================================================================
// EXPIRATION LABEL MAP (duplicated intentionally from ShareDialog — each caller
// owns its own i18n namespace; sharing ns centralizes this post-Phase M3 cleanup)
// ============================================================================

function useExpirationLabel(): (hours: string) => string {
  const { t } = useTranslation(['files', 'files-media']);
  return useCallback(
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
}

// ============================================================================
// COMPONENT
// ============================================================================

type DispatchStage = 'form' | 'result' | 'channel';

export function UnifiedShareDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityTitle,
  entitySubtitle,
  userId,
  companyId,
  showcaseMeta,
  contactMeta,
  fileMeta,
  contactShareContent,
  preSubmit,
  onShareSuccess,
  onShareError,
  onCopySuccess,
}: UnifiedShareDialogProps): React.ReactElement {
  const { t } = useTranslation(['files', 'common', 'common-shared', 'properties-detail']);
  const { t: tShell } = useTranslation('common-shared');
  const expirationLabelFor = useExpirationLabel();

  const [stage, setStage] = useState<DispatchStage>('form');
  const [resultToken, setResultToken] = useState<string | null>(null);

  const submit = useCallback(
    async (draft: LinkTokenDraft): Promise<LinkTokenResultData> => {
      const maxAccesses = parseInt(draft.maxDownloads, 10) || 0;
      const extra = preSubmit ? await preSubmit() : undefined;
      const creatorId = userId;
      const result = await UnifiedSharingService.createShare({
        entityType,
        entityId,
        companyId,
        createdBy: creatorId,
        expiresInHours: parseInt(draft.expiresInHours, 10) || 72,
        password: draft.password.trim() || undefined,
        maxAccesses,
        note: draft.note.trim() || undefined,
        showcaseMeta: extra?.showcaseMeta ?? showcaseMeta,
        contactMeta: extra?.contactMeta ?? contactMeta,
        fileMeta: extra?.fileMeta ?? fileMeta,
      });
      setResultToken(result.token);
      return {
        url: `${window.location.origin}/shared/${result.token}`,
        expiresInHoursLabel: expirationLabelFor(draft.expiresInHours),
        maxDownloadsCount: maxAccesses,
        passwordProtected: draft.password.trim().length > 0,
      };
    },
    [
      entityType,
      entityId,
      companyId,
      userId,
      showcaseMeta,
      contactMeta,
      fileMeta,
      preSubmit,
      expirationLabelFor,
    ],
  );

  const flow = useShareFlow<LinkTokenDraft, LinkTokenResultData>({
    initialDraft: INITIAL_LINK_TOKEN_DRAFT,
    submit,
    onSuccess: () => setStage('result'),
  });

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      flow.reset();
      setStage('form');
      setResultToken(null);
    }, 200);
  }, [onOpenChange, flow]);

  const entity = useMemo(
    () => ({
      kind: entityType,
      id: entityId,
      title: entityTitle,
      subtitle: entitySubtitle,
      companyId,
    }),
    [entityType, entityId, entityTitle, entitySubtitle, companyId],
  );

  const labels = useMemo(
    () => ({
      title: entityTitle,
      subtitle: entitySubtitle,
      closeLabel: tShell('shareSurface.close'),
      errorPrefix: tShell('shareSurface.errorPrefix'),
    }),
    [entityTitle, entitySubtitle, tShell],
  );

  // ----- Stage: channel dispatch (contact only) -----
  if (stage === 'channel' && entityType === 'contact' && flow.state.result) {
    const shareDataForChannel: ShareData & { isPhoto?: boolean } = {
      title: contactShareContent?.title ?? entityTitle,
      text: contactShareContent?.text ?? '',
      url: flow.state.result.url,
      isPhoto: contactShareContent?.isPhoto,
      photoUrl: contactShareContent?.photoUrl,
      galleryPhotos: contactShareContent?.galleryPhotos,
    };
    return (
      <ShareSurfaceShell
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
        entity={entity}
        labels={labels}
        status="idle"
        error={null}
      >
        <UserAuthPermissionPanel
          shareData={shareDataForChannel}
          isOpen={open}
          onClose={handleClose}
          onCopySuccess={onCopySuccess}
          onShareSuccess={onShareSuccess}
          onShareError={onShareError}
        />
      </ShareSurfaceShell>
    );
  }

  // ----- Stage: form / result -----
  return (
    <ShareSurfaceShell
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
      entity={entity}
      labels={labels}
      status={flow.state.status}
      error={flow.state.error}
    >
      {flow.state.status === 'success' && flow.state.result ? (
        <section className="flex flex-col gap-3">
          <LinkTokenResult result={flow.state.result} onClose={handleClose} />
          {entityType === 'contact' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStage('channel')}
              className="w-full"
            >
              <Send className="mr-2 h-4 w-4" />
              {t('common:channelShare.sendToContact')}
            </Button>
          )}
          {entityType === 'property_showcase' && resultToken && (
            <Button asChild variant="outline" className="w-full">
              <a
                href={`/api/shared/${resultToken}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" />
                {t('properties-detail:showcase.downloadPdf')}
              </a>
            </Button>
          )}
        </section>
      ) : (
        <LinkTokenForm
          draft={flow.draft}
          onDraftChange={flow.setDraft}
          onSubmit={flow.submit}
          onCancel={handleClose}
          submitting={flow.state.status === 'submitting'}
        />
      )}
    </ShareSurfaceShell>
  );
}

export default UnifiedShareDialog;
