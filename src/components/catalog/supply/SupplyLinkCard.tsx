'use client';

/**
 * @fileoverview **Ο σύνδεσμος/QR του προμηθευτή** (ADR-923 §5.12 Σ2 πόρτα β): δημοσίευση · αντιγραφή · ανανέωση · ανάκληση.
 * @related server/supply-relationships/supply-request-link.server.ts · hooks/useQrSvg.ts
 * @module components/catalog/supply/SupplyLinkCard
 *
 * 🔑 Ίδιο QR σε κάθε έντυπο, ώσπου να το ακυρώσει ο ίδιος. Η ανανέωση και η ανάκληση σκοτώνουν κάθε τυπωμένο αντίγραφο, γι'
 *    αυτό ζητούν επιβεβαίωση. Δείχνει ανάγλυφα ότι ο σύνδεσμος δίνει μόνο το δικαίωμα να ζητήσεις.
 * ⚠️ `<img>` με data URL, ποτέ `dangerouslySetInnerHTML`: το SVG δεν γίνεται DOM της σελίδας.
 */

import React, { useState } from 'react';
import { Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { svgDataUrl } from '@/hooks/mandate/useShowcaseQr';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useQrSvg } from '@/hooks/useQrSvg';
import { changeSupplyRequestLink } from '@/services/catalog/supply-api.client';
import { supplyRequestHref } from '@/subapps/catalog/catalog-routes';
import type { SupplyRequestLinkWire } from '@/subapps/catalog/types/supply-views';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import type { SupplyAction } from './use-supply-action';

const ACTION_KEY = 'link';

type RiskyAct = 'publish' | 'revoke';

function LivePreview({ token }: { readonly token: string }) {
  const { t } = useCatalogText();
  const qr = useQrSvg(supplyRequestHref(token), 'print');
  const { copy, copied } = useCopyToClipboard();
  if (qr.phase === 'loading') return <p className="m-0 text-sm text-muted-foreground" role="status">{t('common.loading')}</p>;
  if (qr.phase === 'failed') return <p className="m-0 text-sm text-destructive" role="alert">{t('supply.link.qrFailed')}</p>;
  return (
    <figure className="m-0 flex flex-wrap items-center gap-4">
      <img src={svgDataUrl(qr.svg)} alt={t('supply.link.qrAlt')} className="h-40 w-40 rounded-md bg-white" />
      <figcaption className="flex min-w-0 flex-1 flex-col gap-2">
        <code className="break-all text-xs">{qr.url}</code>
        <Button className="self-start" size="sm" variant="outline" onClick={() => void copy(qr.url)}>
          <Copy aria-hidden="true" />{t(copied ? 'supply.link.copied' : 'supply.link.copy')}
        </Button>
      </figcaption>
    </figure>
  );
}

export function SupplyLinkCard({ link, action, canManage }: { readonly link: SupplyRequestLinkWire; readonly action: SupplyAction; readonly canManage: boolean }) {
  const { t } = useCatalogText();
  const [confirming, setConfirming] = useState<RiskyAct | null>(null);
  const busy = action.pending === ACTION_KEY;
  const change = (act: RiskyAct) => action.run(ACTION_KEY, () => changeSupplyRequestLink(act));
  const live = link.state === 'live' && link.token !== null;
  return (
    <section className="flex flex-col gap-2 rounded-md border p-3">
      <h3 className="m-0 text-sm font-semibold">{t('supply.link.title')}</h3>
      <p className="m-0 text-sm text-muted-foreground">{t('supply.link.body')}</p>
      {live && link.token !== null ? <LivePreview token={link.token} /> : null}
      {canManage ? (
        <nav className="flex flex-wrap gap-2" aria-label={t('common.actions')}>
          {live ? (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming('publish')}>{t('supply.link.renew')}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming('revoke')}>{t('supply.link.revoke')}</Button>
            </>
          ) : <Button size="sm" disabled={busy} aria-busy={busy} onClick={() => void change('publish')}>{t('supply.link.publish')}</Button>}
        </nav>
      ) : null}
      <ConfirmDialog open={confirming !== null} onOpenChange={(open) => { if (!open) setConfirming(null); }} variant="warning"
        title={t(confirming === 'revoke' ? 'supply.link.revokeTitle' : 'supply.link.renewTitle')} description={t('supply.link.killsPrinted')}
        confirmText={t(confirming === 'revoke' ? 'supply.link.revoke' : 'supply.link.renew')} cancelText={t('common.cancel')}
        onConfirm={async () => { if (confirming) await change(confirming); setConfirming(null); }} />
    </section>
  );
}
