/**
 * =============================================================================
 * UNIFIED SHARE DIALOG (ADR-315 — unified entry)
 * =============================================================================
 *
 * Single adaptive dialog for file / contact / property_showcase shares, with
 * one identical entry point across all entity types:
 *
 *   ┌────────────────────────────────────────────┐
 *   │ [5 social circles]                         │  ← UserAuthPermissionPanel
 *   │ [Copy link] [Copy text] [Send to contact]  │
 *   │                                            │
 *   │ ▸ Ρυθμίσεις συνδέσμου (collapsible)        │  ← LinkTokenForm
 *   │                                            │
 *   │ [Download PDF]   — only property_showcase  │
 *   └────────────────────────────────────────────┘
 *
 * Behavior:
 *  - On open, the token is auto-created with defaults (72h, no password, 0 max
 *    accesses, no note). This keeps the channel surface functional from first
 *    paint — copy-link and social dispatch always receive a real URL.
 *  - The "Ρυθμίσεις συνδέσμου" accordion (closed by default) exposes the four
 *    canonical policy fields. Editing + applying triggers a fresh
 *    `createShare` with the new policy; the old share is revoked so only the
 *    latest URL is valid.
 *  - For property_showcase the accordion's submit also re-uses a cached
 *    `showcaseMeta` from the first `preSubmit` so policy edits don't re-run
 *    the expensive PDF generation.
 *
 * Persistence: delegates to `UnifiedSharingService` (Tier 2 SSoT).
 *
 * @module components/sharing/UnifiedShareDialog
 * @see adrs/ADR-315-unified-sharing.md §3.4
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShareSurfaceShell } from '@/components/ui/sharing';
import { LinkTokenForm } from '@/components/ui/sharing/panels/link-token/LinkTokenForm';
import {
  INITIAL_LINK_TOKEN_DRAFT,
  type LinkTokenDraft,
} from '@/components/ui/sharing/panels/link-token/types';
import { UserAuthPermissionPanel } from '@/components/ui/sharing/panels/UserAuthPermissionPanel';
import type { ShareData } from '@/components/ui/email-sharing/EmailShareForm';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  /** Per-entity metadata (required for contact.includedFields). Showcase uses `preSubmit`. */
  showcaseMeta?: ShowcaseShareMeta;
  contactMeta?: ContactShareMeta;
  fileMeta?: FileShareMeta;
  /**
   * Content used by the channel-dispatch surface (grid buttons + email form +
   * ContactChannelPicker). Optional for file / property_showcase — defaults
   * to a reasonable shape using `entityTitle`.
   */
  contactShareContent?: Omit<ShareData, 'url'>;
  /**
   * Optional pre-submit hook. Invoked BEFORE `UnifiedSharingService.createShare`
   * to produce entity-specific metadata that must be generated at submit time
   * (e.g. Property Showcase PDF upload). Called ONCE per dialog open — the
   * result is cached and reused across policy changes.
   */
  preSubmit?: () => Promise<
    Pick<CreateShareInput, 'showcaseMeta' | 'contactMeta' | 'fileMeta'>
  >;
  onShareSuccess?: (platform: string) => void;
  onShareError?: (platform: string, error: string) => void;
  onCopySuccess?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface CreatedShare {
  shareId: string;
  token: string;
  url: string;
}

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

  const [draft, setDraft] = useState<LinkTokenDraft>(INITIAL_LINK_TOKEN_DRAFT);
  const [share, setShare] = useState<CreatedShare | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  // Cache preSubmit result so policy changes don't re-run expensive PDF gen.
  const preSubmitCacheRef = useRef<
    Pick<CreateShareInput, 'showcaseMeta' | 'contactMeta' | 'fileMeta'> | null
  >(null);
  // Track previous shareId so editing the policy revokes the stale one.
  const previousShareIdRef = useRef<string | null>(null);

  const createShare = useCallback(
    async (currentDraft: LinkTokenDraft): Promise<CreatedShare> => {
      const maxAccesses = parseInt(currentDraft.maxDownloads, 10) || 0;
      const extra = preSubmit
        ? (preSubmitCacheRef.current ??= await preSubmit())
        : undefined;
      const result = await UnifiedSharingService.createShare({
        entityType,
        entityId,
        companyId,
        createdBy: userId,
        expiresInHours: parseInt(currentDraft.expiresInHours, 10) || 72,
        password: currentDraft.password.trim() || undefined,
        maxAccesses,
        note: currentDraft.note.trim() || undefined,
        showcaseMeta: extra?.showcaseMeta ?? showcaseMeta,
        contactMeta: extra?.contactMeta ?? contactMeta,
        fileMeta: extra?.fileMeta ?? fileMeta,
      });
      return {
        shareId: result.shareId,
        token: result.token,
        url: `${window.location.origin}/shared/${result.token}`,
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
    ],
  );

  const ensureShare = useCallback(
    async (currentDraft: LinkTokenDraft, { revokePrevious }: { revokePrevious: boolean }) => {
      setCreating(true);
      setError(null);
      try {
        const next = await createShare(currentDraft);
        if (revokePrevious && previousShareIdRef.current) {
          void UnifiedSharingService.revoke(previousShareIdRef.current, userId).catch(
            () => undefined,
          );
        }
        previousShareIdRef.current = next.shareId;
        setShare(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setCreating(false);
      }
    },
    [createShare, userId],
  );

  // No auto-create on open. The token is created ONLY when the user submits
  // the policy form — this guarantees the URL carries the password / note /
  // max-accesses the user actually entered, not stale defaults.

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      setShare(null);
      setDraft(INITIAL_LINK_TOKEN_DRAFT);
      setPolicyOpen(false);
      setError(null);
      preSubmitCacheRef.current = null;
      previousShareIdRef.current = null;
    }, 200);
  }, [onOpenChange]);

  const handleCreateLink = useCallback(() => {
    void ensureShare(draft, { revokePrevious: false });
  }, [ensureShare, draft]);

  const handleApplyPolicy = useCallback(() => {
    void ensureShare(draft, { revokePrevious: true });
    setPolicyOpen(false);
  }, [ensureShare, draft]);

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

  const shareDataForChannel: ShareData & { isPhoto?: boolean } = {
    title: contactShareContent?.title ?? entityTitle,
    text: contactShareContent?.text ?? '',
    url: share?.url ?? '',
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
      error={error}
    >
      {!share ? (
        <section className="flex flex-col gap-3">
          <LinkTokenForm
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={handleCreateLink}
            onCancel={handleClose}
            submitting={creating}
          />
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <UserAuthPermissionPanel
            shareData={shareDataForChannel}
            isOpen={open}
            onClose={handleClose}
            onCopySuccess={onCopySuccess}
            onShareSuccess={onShareSuccess}
            onShareError={onShareError}
          />

          {entityType === 'property_showcase' && (
            <Button asChild variant="outline" className="w-full">
              <a
                href={`/api/showcase/${share.token}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" />
                {t('properties-detail:showcase.downloadPdf')}
              </a>
            </Button>
          )}

          <section
            className={cn(
              'border rounded-lg overflow-hidden',
              policyOpen && 'border-primary/40',
            )}
          >
            <button
              type="button"
              onClick={() => setPolicyOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
              aria-expanded={policyOpen}
            >
              <span>{t('common:share.linkSettings')}</span>
              {policyOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {policyOpen && (
              <div className="p-3 border-t bg-muted/20">
                <LinkTokenForm
                  draft={draft}
                  onDraftChange={setDraft}
                  onSubmit={handleApplyPolicy}
                  onCancel={() => setPolicyOpen(false)}
                  submitting={creating}
                />
              </div>
            )}
          </section>
        </section>
      )}
    </ShareSurfaceShell>
  );
}

export default UnifiedShareDialog;
