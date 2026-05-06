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
import { Spinner } from '@/components/ui/spinner';
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
  /**
   * Pre-built share URL. When provided, bypasses `UnifiedSharingService.createShare`
   * entirely and uses this URL directly. The policy accordion is hidden.
   * Used for vendor_rfq_invite where the HMAC token URL is pre-generated.
   */
  shareUrl?: string;
  /**
   * When provided, the email platform button bypasses `EmailShareForm` and
   * calls this function directly. Used for vendor_rfq_invite to dispatch via
   * email-channel.ts (ADR-327 Phase H). Caller owns the API call.
   */
  onDirectEmailShare?: () => Promise<void>;
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
  shareUrl,
  onDirectEmailShare,
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
  // Snapshot of the draft currently applied to the active token. Used to
  // disable the accordion submit when the user has not changed any field
  // (ADR-312 Phase 9.8 — no-op revoke+recreate suppression).
  const appliedDraftRef = useRef<LinkTokenDraft>(INITIAL_LINK_TOKEN_DRAFT);

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
        appliedDraftRef.current = currentDraft;
        setShare(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setCreating(false);
      }
    },
    [createShare, userId],
  );

  // Auto-create on open (ADR-312 Phase 9.7). When `shareUrl` is pre-provided
  // (vendor_rfq_invite), skip createShare and use the URL directly.
  useEffect(() => {
    if (!open) return;
    if (share || creating) return;
    if (shareUrl) {
      setShare({ shareId: '', token: '', url: shareUrl });
      return;
    }
    void ensureShare(INITIAL_LINK_TOKEN_DRAFT, { revokePrevious: false });
  }, [open, share, creating, ensureShare, shareUrl]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      setShare(null);
      setDraft(INITIAL_LINK_TOKEN_DRAFT);
      setPolicyOpen(false);
      setError(null);
      preSubmitCacheRef.current = null;
      previousShareIdRef.current = null;
      appliedDraftRef.current = INITIAL_LINK_TOKEN_DRAFT;
    }, 200);
  }, [onOpenChange]);

  const handleApplyPolicy = useCallback(() => {
    void ensureShare(draft, { revokePrevious: true });
    setPolicyOpen(false);
  }, [ensureShare, draft]);

  const isDirty =
    draft.expiresInHours !== appliedDraftRef.current.expiresInHours ||
    draft.password !== appliedDraftRef.current.password ||
    draft.maxDownloads !== appliedDraftRef.current.maxDownloads ||
    draft.note !== appliedDraftRef.current.note;

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
    // ADR-312 Phase 9.18 — the route uses this to load the showcase snapshot
    // and append a text digest after the photo dispatch. Only set for the
    // `property_showcase` entity type; other shares keep `propertyId`
    // undefined so the digest step is skipped.
    propertyId: entityType === 'property_showcase' ? entityId : undefined,
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
        <section
          className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
          aria-busy="true"
        >
          <Spinner size="default" color="inherit" />
          <span>{t('common-shared:share.creatingLink')}</span>
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
            showcaseContext={
              entityType === 'property_showcase'
                ? { type: 'property', propertyId: entityId }
                : entityType === 'project_showcase'
                  ? { type: 'project', projectId: entityId }
                  : entityType === 'building_showcase'
                    ? { type: 'building', buildingId: entityId }
                    : entityType === 'storage_showcase'
                      ? { type: 'storage', storageId: entityId }
                      : entityType === 'parking_showcase'
                        ? { type: 'parking', parkingId: entityId }
                        : undefined
            }
            initialPersonalMessage={draft.note.trim() || undefined}
            dirtyPolicy={isDirty}
            onDirectEmailShare={onDirectEmailShare}
          />

          {(entityType === 'property_showcase'
            || entityType === 'project_showcase'
            || entityType === 'building_showcase') && (
            <Button
              asChild
              variant="outline"
              className={cn('w-full', isDirty && 'pointer-events-none opacity-50')}
              aria-disabled={isDirty}
            >
              <a
                href={
                  entityType === 'project_showcase'
                    ? `/api/project-showcase/${share.token}/pdf`
                    : entityType === 'building_showcase'
                      ? `/api/building-showcase/${share.token}/pdf`
                      : `/api/showcase/${share.token}/pdf`
                }
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={isDirty ? -1 : undefined}
              >
                <Download className="mr-2 h-4 w-4" />
                {t('properties-detail:showcase.downloadPdf')}
              </a>
            </Button>
          )}

          {!shareUrl && (
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
                    disabled={!isDirty}
                  />
                </div>
              )}
            </section>
          )}
        </section>
      )}
    </ShareSurfaceShell>
  );
}

export default UnifiedShareDialog;
