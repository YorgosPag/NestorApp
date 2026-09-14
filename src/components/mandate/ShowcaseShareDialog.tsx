'use client';

/**
 * @fileoverview 🏆 **«ΚΟΙΝΟΠΟΙΗΣΗ»** — ο κωδικός QR και ο σύνδεσμος της βιτρίνας, στη δημόσια σελίδα (ADR-841 §7 Α21.17).
 * @related hooks/mandate/useShowcaseQr.ts · components/mandate/ShowcasePublicDoor.tsx (η πόρτα του ιδιοκτήτη)
 * @module components/mandate/ShowcaseShareDialog
 *
 * 🔑 **Η σκηνή που λύνει**: ο πελάτης κάθεται στο γραφείο και θέλει τα στοιχεία στο **δικό του** κινητό. Ο
 * επαγγελματίας ανοίγει τη βιτρίνα του στην οθόνη, πατά «Κοινοποίηση», ο πελάτης σαρώνει. Κανένα
 * υπαγόρευμα αριθμού, κανένα χαρτάκι.
 *
 * ⚠️ **Ο κωδικός γεννιέται μόνο όταν ανοίξει ο διάλογος**: ο Radix αποπροσαρτά το περιεχόμενο όταν κλείνει, άρα
 * το `useShowcaseQr` τρέχει **μόνο** μέσα στο `ShareBody` — η βιτρίνα δεν φορτώνει το `qrcode` για κανέναν που
 * δεν το ζήτησε.
 *
 * 🔑 **`navigator.share` μόνο όπου υπάρχει** — ρωτιέται μετά την προσάρτηση (σε SSR δεν υπάρχει `navigator`),
 * ώστε το κουμπί να μην εμφανιστεί σε υπολογιστή όπου δεν θα έκανε τίποτα.
 */

import React from 'react';
import { Check, Copy, Send, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { svgDataUrl, useShowcaseQr } from '@/hooks/mandate/useShowcaseQr';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AGENCY_PUBLIC_NS, PROFILE_KEYS } from './agency-directory-labels';
import { agencyProfileRoute } from './agency-directory-route';

interface ShowcaseShareProps {
  readonly alias: string;
  readonly displayName: string;
}

const QR_DISPLAY_PX = 224;

function ShareCode({ alias, displayName }: ShowcaseShareProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const qr = useShowcaseQr(alias, 'screen');

  return (
    <figure className="m-0 flex min-h-56 items-center justify-center">
      {qr.phase === 'ready' ? (
        <img
          src={svgDataUrl(qr.svg)}
          alt={t(PROFILE_KEYS.shareQrAlt, { name: displayName })}
          width={QR_DISPLAY_PX}
          height={QR_DISPLAY_PX}
          className="h-56 w-56 rounded-md"
        />
      ) : null}
      {qr.phase === 'loading' ? <span aria-hidden="true" className="h-56 w-56 animate-pulse rounded-md bg-muted" /> : null}
      {qr.phase === 'failed' ? (
        <figcaption className="text-sm text-muted-foreground">{t(PROFILE_KEYS.shareQrFailed)}</figcaption>
      ) : null}
    </figure>
  );
}

function ShareActions({ alias, displayName }: ShowcaseShareProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const { copy, copied } = useCopyToClipboard();
  const [canShare, setCanShare] = React.useState(false);
  React.useEffect(() => setCanShare(typeof navigator.share === 'function'), []);

  // 🔑 Διαβάζεται **στο πάτημα** — ίδιο δόγμα με το `ShowcasePublicDoor`.
  const urlNow = React.useCallback(() => `${window.location.origin}${agencyProfileRoute(alias)}`, [alias]);

  return (
    <nav className="flex flex-wrap justify-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void copy(urlNow())}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {t(copied ? PROFILE_KEYS.shareLinkCopied : PROFILE_KEYS.shareCopyLink)}
      </Button>
      {canShare ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void navigator.share({ title: displayName, url: urlNow() }).catch(() => undefined)}
        >
          <Send aria-hidden="true" /> {t(PROFILE_KEYS.shareNative)}
        </Button>
      ) : null}
    </nav>
  );
}

export function ShowcaseShareDialog({ alias, displayName }: ShowcaseShareProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Share2 aria-hidden="true" /> {t(PROFILE_KEYS.shareOpen)}
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(PROFILE_KEYS.shareTitle)}</DialogTitle>
          <DialogDescription>{t(PROFILE_KEYS.shareLead)}</DialogDescription>
        </DialogHeader>
        <ShareCode alias={alias} displayName={displayName} />
        <ShareActions alias={alias} displayName={displayName} />
      </DialogContent>
    </Dialog>
  );
}
