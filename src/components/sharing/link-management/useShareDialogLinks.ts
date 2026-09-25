/**
 * =============================================================================
 * useShareDialogLinks — η ροή συνδέσμων του `UnifiedShareDialog` (ADR-315 §5 · Α11)
 * =============================================================================
 *
 * Ενώνει τα δύο κομμάτια που ο διάλογος χρειάζεται μαζί:
 *   - `useLinkMint`   — νέος σύνδεσμος **στο κλικ**, αντιγραμμένος στην ίδια χειρονομία.
 *   - `useShareLinks` — η λίστα ενεργών συνδέσμων, που ανανεώνεται μετά από κάθε δημιουργία.
 *
 * Ο διάλογος μένει **παρουσίαση**· η σειρά «γέννα → αντέγραψε → ανανέωσε λίστα» ζει εδώ.
 *
 * @module components/sharing/link-management/useShareDialogLinks
 */

'use client';

import { useCallback, useState } from 'react';

import {
  INITIAL_LINK_TOKEN_DRAFT,
  type LinkTokenDraft,
} from '@/components/ui/sharing/panels/link-token/types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { copyDeferredText, copyToClipboard } from '@/lib/share-utils';
import { useNotifications } from '@/providers/NotificationProvider';
import { useLinkMint, type MintedShare, type UseLinkMintOptions } from './useLinkMint';
import { useShareLinks, type UseShareLinksResult } from './useShareLinks';

export interface UseShareDialogLinksOptions extends UseLinkMintOptions {
  /** Ανοιχτός διάλογος **και** σύνδεσμος που διαχειρίζεται εδώ (όχι έτοιμο `shareUrl`). */
  readonly enabled: boolean;
  readonly onCopySuccess?: () => void;
}

export interface UseShareDialogLinksResult {
  readonly draft: LinkTokenDraft;
  readonly setDraft: (next: LinkTokenDraft) => void;
  readonly minted: MintedShare | null;
  readonly minting: boolean;
  readonly error: string | null;
  readonly links: UseShareLinksResult;
  /** **Συγχρόνως** από το κλικ. */
  readonly createAndCopy: () => void;
  readonly copyAgain: () => void;
  readonly startOver: () => void;
  readonly reset: () => void;
}

export function useShareDialogLinks({
  enabled, onCopySuccess, ...mintOptions
}: UseShareDialogLinksOptions): UseShareDialogLinksResult {
  const { t } = useTranslation(['files', 'files-media']);
  const notifications = useNotifications();
  const [draft, setDraft] = useState<LinkTokenDraft>(INITIAL_LINK_TOKEN_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const mintState = useLinkMint(mintOptions);
  const links = useShareLinks({ entityType: mintOptions.entityType, entityId: mintOptions.entityId, enabled });
  const { mint, minted, minting, startOver, reset: resetMint } = mintState;
  const { refresh: refreshLinks } = links;

  const reportCopy = useCallback((copied: boolean) => {
    if (copied) {
      notifications.success(t('share.copied'));
      onCopySuccess?.();
    } else {
      notifications.warning(t('share.copyFailed'));
    }
  }, [notifications, onCopySuccess, t]);

  const createAndCopy = useCallback(() => {
    setError(null);
    const url = mint(draft).then((next) => next.url);
    copyDeferredText(url)
      .then((copied) => {
        reportCopy(copied);
        setDraft(INITIAL_LINK_TOKEN_DRAFT); // ο επόμενος σύνδεσμος (άλλος παραλήπτης) ξεκινά καθαρός
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => void refreshLinks());
  }, [mint, draft, reportCopy, refreshLinks]);

  const copyAgain = useCallback(() => {
    if (minted) void copyToClipboard(minted.url).then(reportCopy);
  }, [minted, reportCopy]);

  const reset = useCallback(() => {
    resetMint();
    setDraft(INITIAL_LINK_TOKEN_DRAFT);
    setError(null);
  }, [resetMint]);

  return { draft, setDraft, minted, minting, error, links, createAndCopy, copyAgain, startOver, reset };
}
