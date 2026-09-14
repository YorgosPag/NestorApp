'use client';

/**
 * @fileoverview 🏆 **Ο ΚΩΔΙΚΟΣ QR ΤΗΣ ΒΙΤΡΙΝΑΣ, ΓΙΑ ΕΚΤΥΠΩΣΗ** — στη σελίδα της κάρτας (ADR-841 §7 Α21.17).
 * @related hooks/mandate/useShowcaseQr.ts · components/mandate/ShowcaseShareDialog.tsx (η δημόσια όψη) ·
 *   lib/exports/trigger-export-download.ts (η λήψη)
 * @module components/mandate/ShowcaseQrPanel
 *
 * 🔑 **SVG για το τυπογραφείο, PNG για όλα τα άλλα**: το SVG κλιμακώνεται σε αυτοκόλλητο βιτρίνας χωρίς θόλωμα·
 * το PNG μπαίνει σε Word, σε Canva, σε ανάρτηση. Και τα δύο με χρήση `print` (διόρθωση Q, ήσυχη ζώνη 4) —
 * το χαρτί γδέρνεται, η βιτρίνα αντανακλά.
 *
 * ⚠️ **Η λήψη περνά από το `triggerExportDownload`** — το SSoT των παραγόμενων αρχείων, όχι δεύτερο `<a download>`.
 */

import React from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { svgDataUrl, useShowcaseQr } from '@/hooks/mandate/useShowcaseQr';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { SHOWCASE_CARD_KEYS, SHOWCASE_NS } from './agency-showcase-labels';

/** PNG αρκετά μεγάλο για κάρτα 300 dpi (~8,5 cm), χωρίς να γίνεται βαρύ. */
const PRINT_PNG_PX = 1024;
const PREVIEW_PX = 192;

async function downloadPng(url: string, alias: string): Promise<void> {
  const { qrPngDataUrl } = await import('@/lib/qr/qr-code');
  const blob = await (await fetch(await qrPngDataUrl(url, 'print', PRINT_PNG_PX))).blob();
  triggerExportDownload({ blob, filename: `${alias}-qr.png` });
}

export function ShowcaseQrPanel({ alias }: { readonly alias: string }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const qr = useShowcaseQr(alias, 'print');
  const [pngFailed, setPngFailed] = React.useState(false);

  const onSvg = React.useCallback(() => {
    if (qr.phase !== 'ready') return;
    triggerExportDownload({ blob: new Blob([qr.svg], { type: 'image/svg+xml' }), filename: `${alias}-qr.svg` });
  }, [alias, qr]);

  const onPng = React.useCallback(() => {
    if (qr.phase !== 'ready') return;
    setPngFailed(false);
    downloadPng(qr.url, alias).catch(() => setPngFailed(true));
  }, [alias, qr]);

  return (
    <section aria-labelledby="showcase-qr-title" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-col gap-1">
        <h2 id="showcase-qr-title" className="m-0 text-base font-semibold text-foreground">
          {t(SHOWCASE_CARD_KEYS.qrTitle)}
        </h2>
        <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_CARD_KEYS.qrLead)}</p>
      </header>
      <figure className="m-0 flex min-h-48 items-center">
        {qr.phase === 'ready' ? (
          <img
            src={svgDataUrl(qr.svg)}
            alt={t(SHOWCASE_CARD_KEYS.qrAlt)}
            width={PREVIEW_PX}
            height={PREVIEW_PX}
            className="h-48 w-48 rounded-md"
          />
        ) : null}
        {qr.phase === 'loading' ? <span aria-hidden="true" className="h-48 w-48 animate-pulse rounded-md bg-muted" /> : null}
      </figure>
      <nav className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={qr.phase !== 'ready'} onClick={onSvg}>
          <Download aria-hidden="true" /> {t(SHOWCASE_CARD_KEYS.qrDownloadSvg)}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={qr.phase !== 'ready'} onClick={onPng}>
          <Download aria-hidden="true" /> {t(SHOWCASE_CARD_KEYS.qrDownloadPng)}
        </Button>
      </nav>
      {qr.phase === 'failed' || pngFailed ? (
        <p role="alert" className="m-0 text-sm text-destructive">{t(SHOWCASE_CARD_KEYS.qrFailed)}</p>
      ) : null}
    </section>
  );
}
