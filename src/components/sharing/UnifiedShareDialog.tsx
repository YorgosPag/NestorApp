/**
 * =============================================================================
 * UNIFIED SHARE DIALOG (ADR-315 — unified entry)
 * =============================================================================
 *
 * Single adaptive dialog for file / contact / showcase shares:
 *
 *   ┌────────────────────────────────────────────┐
 *   │ Για ποιον; [___________]                   │  ← ShareLinkCreatePanel (Α11 · Α14)
 *   │ ▸ Ρυθμίσεις συνδέσμου                      │
 *   │ [ Δημιουργία & αντιγραφή συνδέσμου ]        │
 *   │   — μετά: URL + «δεν θα ξαναεμφανιστεί»     │  ← MintedLinkCard
 *   │   [5 social circles] [Copy] [Send…]        │  ← UserAuthPermissionPanel
 *   │   [Download PDF] — μόνο showcase           │
 *   │ Ενεργοί σύνδεσμοι (N)                      │  ← ActiveShareLinksList (ADR-315 §5)
 *   └────────────────────────────────────────────┘
 *
 * Behavior (ADR-315 §5, 2026-09-25):
 *  - 🔴 **No link on open.** Until then every open minted an active 72h link, even if it was
 *    never sent — orphan credentials. Like Dropbox «Copy link» / Box «Create and Copy Shared
 *    Link», the link is minted **on click** and copied in the **same** gesture
 *    (`copyDeferredText` — a Promise-valued `ClipboardItem`).
 *  - The raw link is shown **once** (the server keeps only its fingerprint). «New link» mints
 *    another for another recipient; the previous one **stays** active.
 *  - Settings of an existing link change **in place** (same URL) from the list — no more
 *    revoke + recreate that silently broke already-sent URLs (Α13).
 *  - `shareUrl` (vendor_rfq_invite) bypasses all of this: pre-built URL, no list.
 *
 * Persistence: `UnifiedSharingService` (Tier 2 SSoT) only.
 *
 * @module components/sharing/UnifiedShareDialog
 * @see docs/centralized-systems/reference/adrs/ADR-315-unified-sharing.md §3 Α11–Α14, §5
 */

'use client';

import React, { useCallback, useMemo } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShareSurfaceShell } from '@/components/ui/sharing';
import { UserAuthPermissionPanel } from '@/components/ui/sharing/panels/UserAuthPermissionPanel';
import type { ShareData } from '@/components/ui/email-sharing/EmailShareForm';
import { Button } from '@/components/ui/button';
import { ActiveShareLinksList } from '@/components/sharing/link-management/ActiveShareLinksList';
import {
  MintedLinkCard,
  ShareLinkCreatePanel,
} from '@/components/sharing/link-management/ShareLinkCreatePanel';
import {
  useShareDialogLinks,
  type UseShareDialogLinksResult,
} from '@/components/sharing/link-management/useShareDialogLinks';
import {
  buildShowcaseContext,
  findShowcaseSurface,
  showcasePdfHref,
} from '@/services/sharing/showcase-surfaces';
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
   * result is cached and reused for every link minted while the dialog is open.
   */
  preSubmit?: () => Promise<
    Pick<CreateShareInput, 'showcaseMeta' | 'contactMeta' | 'fileMeta'>
  >;
  onShareSuccess?: (platform: string) => void;
  onShareError?: (platform: string, error: string) => void;
  onCopySuccess?: () => void;
  /**
   * Pre-built share URL. When provided, bypasses `UnifiedSharingService.createShare`
   * entirely and uses this URL directly. No link panel, no link list.
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

/** Τα δεδομένα των καναλιών αποστολής για τον τρέχοντα σύνδεσμο. */
function channelShareData(
  content: Omit<ShareData, 'url'> | undefined,
  entityTitle: string,
  url: string | null,
  propertyId: string | undefined,
): ShareData & { isPhoto?: boolean } {
  return {
    title: content?.title ?? entityTitle,
    text: content?.text ?? '',
    url: url ?? '',
    isPhoto: content?.isPhoto,
    photoUrl: content?.photoUrl,
    galleryPhotos: content?.galleryPhotos,
    // ADR-312 Phase 9.18 — the route uses this to load the showcase snapshot
    // and append a text digest after the photo dispatch. Only set for the
    // `property_showcase` entity type; other shares keep `propertyId`
    // undefined so the digest step is skipped.
    propertyId,
  };
}

export function UnifiedShareDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityTitle,
  entitySubtitle,
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
  const flow = useShareDialogLinks({
    entityType, entityId, preSubmit, showcaseMeta, contactMeta, fileMeta, onCopySuccess,
    enabled: open && !shareUrl,
  });
  const { reset } = flow;

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(reset, 200);
  }, [onOpenChange, reset]);

  const entity = useMemo(
    () => ({ kind: entityType, id: entityId, title: entityTitle, subtitle: entitySubtitle, companyId }),
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

  /**
   * Η επιφάνεια showcase αυτού του share — `null` για `file` / `contact` /
   * `vendor_rfq_invite`. Αντικαθιστά **τρεις** χειρόγραφες αλυσίδες τριαδικών
   * που αποκλίναν ήδη (5 κλάδοι context vs 3 κλάδοι PDF, ADR-742 §7quaterdecies).
   */
  const showcaseSurface = findShowcaseSurface(entityType);
  const liveUrl = shareUrl ?? flow.minted?.url ?? null;
  /** `null` = δεν είναι showcase, ή η επιφάνεια δεν έχει γεννήτρια PDF, ή δεν γεννήθηκε ακόμη σύνδεσμος. */
  const pdfHref = flow.minted === null ? null : showcasePdfHref(entityType, flow.minted.token);

  const shareDataForChannel = channelShareData(
    contactShareContent, entityTitle, liveUrl, showcaseSurface?.kind === 'property' ? entityId : undefined,
  );

  const channels = liveUrl !== null && (
    <UserAuthPermissionPanel
      shareData={shareDataForChannel}
      isOpen={open}
      onClose={handleClose}
      onCopySuccess={onCopySuccess}
      onShareSuccess={onShareSuccess}
      onShareError={onShareError}
      showcaseContext={buildShowcaseContext(entityType, entityId)}
      initialPersonalMessage={flow.minted?.note}
      onDirectEmailShare={onDirectEmailShare}
    />
  );

  return (
    <ShareSurfaceShell
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
      entity={entity}
      labels={labels}
      status="idle"
      error={flow.error}
    >
      {shareUrl ? (
        <section className="flex flex-col gap-4">{channels}</section>
      ) : (
        <ManagedLinksBody flow={flow} channels={channels} pdfHref={pdfHref} pdfLabel={t('properties-detail:showcase.downloadPdf')} />
      )}
    </ShareSurfaceShell>
  );
}

interface ManagedLinksBodyProps {
  readonly flow: UseShareDialogLinksResult;
  readonly channels: React.ReactNode;
  readonly pdfHref: string | null;
  readonly pdfLabel: string;
}

/** Νέος σύνδεσμος (ή ο μόλις δημιουργημένος + κανάλια) και η λίστα ενεργών συνδέσμων. */
function ManagedLinksBody({ flow, channels, pdfHref, pdfLabel }: ManagedLinksBodyProps): React.ReactElement {
  return (
    <section className="flex flex-col gap-4">
      {flow.minted === null ? (
        <ShareLinkCreatePanel
          draft={flow.draft}
          onDraftChange={flow.setDraft}
          onCreateAndCopy={flow.createAndCopy}
          minting={flow.minting}
        />
      ) : (
        <>
          <MintedLinkCard minted={flow.minted} onCopy={flow.copyAgain} onStartOver={flow.startOver} />
          {channels}
          {pdfHref !== null && (
            <Button asChild variant="outline" className="w-full">
              <a href={pdfHref} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                {pdfLabel}
              </a>
            </Button>
          )}
        </>
      )}
      <ActiveShareLinksList state={flow.links} currentShareId={flow.minted?.shareId ?? null} />
    </section>
  );
}

export default UnifiedShareDialog;
