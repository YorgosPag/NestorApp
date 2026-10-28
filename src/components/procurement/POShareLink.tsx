'use client';

/**
 * PO Share Link — «Δημιουργία Συνδέσμου» (Google Drive / Figma «Copy link»)
 *
 * 🔴 ADR-923 §5.11 «3γ» Α15: the old button awaited the network and THEN
 * `navigator.clipboard.writeText`. The user gesture was gone by then, and when the tab had no
 * focus the promise never settled ⇒ the button stayed on «loading» forever while the link
 * already existed and was never shown.
 *
 * Now:
 *   1. the click opens the dialog and starts the copy **synchronously**, through
 *      `copyDeferredText` (Promise-valued `ClipboardItem`, ADR-315 Α11);
 *   2. the link appears in a read-only field as soon as the server answers — the screen
 *      **never waits for the clipboard**;
 *   3. the clipboard outcome is only a toast; re-copy goes through `useCopyToClipboard`.
 *
 * @module components/procurement/POShareLink
 * @enterprise ADR-267 Phase B · ADR-923 §5.11 «3γ» Α15
 */

import { useCallback, useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CopyableLinkField } from '@/components/sharing/fields/CopyableLinkField';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { deadlineDaysLeft } from '@/lib/date-local';
import { copyDeferredText } from '@/lib/share-utils';
import { useNotifications } from '@/providers/NotificationProvider';
import { createPurchaseOrderShareWithPolicy } from '@/services/procurement/procurement-mutation-gateway';

type ShareState =
  | { readonly status: 'idle' }
  | { readonly status: 'creating' }
  | { readonly status: 'ready'; readonly url: string; readonly expiresAt: string }
  | { readonly status: 'failed' };

/** Mint + copy in the click; the link is shown as soon as it exists, whatever the clipboard does. */
export function usePOShareLink(poId: string) {
  const { t } = useTranslation('procurement');
  const notifications = useNotifications();
  const [state, setState] = useState<ShareState>({ status: 'idle' });

  const create = useCallback(() => {
    setState({ status: 'creating' });
    const share = createPurchaseOrderShareWithPolicy(poId);
    share.then(
      (result) => setState({ status: 'ready', url: result.url, expiresAt: result.expiresAt }),
      () => setState({ status: 'failed' }),
    );
    // Synchronously inside the gesture — never after another `await`.
    copyDeferredText(share.then((result) => result.url)).then(
      (copied) => (copied ? notifications.success(t('share.copied')) : notifications.warning(t('share.copyFailed'))),
      () => undefined, // creation failure is reported by the dialog, not as a clipboard failure
    );
  }, [poId, notifications, t]);

  const close = useCallback(() => setState({ status: 'idle' }), []);

  return { state, create, close };
}

interface POShareLinkDialogProps {
  readonly state: ShareState;
  readonly onClose: () => void;
  readonly onRetry: () => void;
}

function ReadyLink({ url, expiresAt }: { readonly url: string; readonly expiresAt: string }) {
  const { t } = useTranslation('procurement');
  const { copy, copied } = useCopyToClipboard();
  const days = deadlineDaysLeft(expiresAt);

  return (
    <section className="flex flex-col gap-2" aria-label={t('share.linkLabel')}>
      <CopyableLinkField
        url={url}
        fieldLabel={t('share.linkLabel')}
        copyLabel={t('share.copyLink')}
        copiedLabel={t('share.copiedShort')}
        copied={copied}
        onCopy={() => void copy(url)}
      />
      {days !== null && <p className="text-xs text-muted-foreground">{t('share.expires', { days })}</p>}
    </section>
  );
}

function POShareLinkDialog({ state, onClose, onRetry }: POShareLinkDialogProps) {
  const { t } = useTranslation('procurement');

  return (
    <Dialog open={state.status !== 'idle'} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('share.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('share.dialogDescription')}</DialogDescription>
        </DialogHeader>
        {state.status === 'creating' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />{t('share.creating')}
          </p>
        )}
        {state.status === 'ready' && <ReadyLink url={state.url} expiresAt={state.expiresAt} />}
        {state.status === 'failed' && (
          <section className="flex flex-col items-start gap-2" role="alert">
            <p className="text-sm text-destructive">{t('share.createFailed')}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>{t('share.retry')}</Button>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Toolbar button + dialog. */
export function POShareLinkButton({ poId }: { readonly poId: string }) {
  const { t } = useTranslation('procurement');
  const { state, create, close } = usePOShareLink(poId);

  return (
    <>
      <Button variant="outline" size="sm" onClick={create} disabled={state.status === 'creating'}>
        {state.status === 'creating'
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <Link2 className="mr-2 h-4 w-4" />}
        {t('share.createLink')}
      </Button>
      <POShareLinkDialog state={state} onClose={close} onRetry={create} />
    </>
  );
}
