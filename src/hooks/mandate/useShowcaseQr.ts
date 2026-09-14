'use client';

/**
 * @fileoverview **Ο κωδικός QR της ζωντανής βιτρίνας** — μία γέννηση για τις δύο οθόνες (ADR-841 §7 Α21.17).
 * @related components/mandate/ShowcaseShareDialog.tsx (δημόσια) · components/mandate/ShowcaseQrPanel.tsx (ρυθμίσεις) ·
 *   lib/qr/qr-code.ts
 * @module hooks/mandate/useShowcaseQr
 *
 * 🔑 **Δείχνει στη ΖΩΝΤΑΝΗ σελίδα, ποτέ σε ενσωματωμένα στοιχεία** (όχι vCard-μέσα-στο-QR): αλλαγή τηλεφώνου ή
 * ωραρίου ⇒ τίποτα για επανεκτύπωση. Και **καμία παράμετρος παρακολούθησης** (`utm_*`) — αρχή #2 της Α21.16.
 *
 * 🔑 **Η απόλυτη διεύθυνση από τον περιηγητή**, ίδιο δόγμα με το `ShowcasePublicDoor`: το `window.location.origin`
 * δεν παλιώνει και δεν χρειάζεται ρύθμιση ανά περιβάλλον. Διαβάζεται **μέσα στο effect** — σε SSR δεν υπάρχει.
 *
 * ⚠️ **Δυναμική εισαγωγή του `qrcode`**: η βιβλιοθήκη φορτώνει μόνο όταν ανοίξει ο διάλογος / η σελίδα QR — η
 * δημόσια βιτρίνα δεν την πληρώνει στο πρώτο καρέ. Είναι **κώδικας**, όχι κλειδιά i18n (CHECK 3.51 δεν αφορά).
 */

import React from 'react';

import { agencyProfileRoute } from '@/components/mandate/agency-directory-route';
import type { QrPreset } from '@/lib/qr/qr-code';

export type ShowcaseQrState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly url: string; readonly svg: string }
  | { readonly phase: 'failed' };

export function useShowcaseQr(alias: string, preset: QrPreset): ShowcaseQrState {
  const [state, setState] = React.useState<ShowcaseQrState>({ phase: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    const url = `${window.location.origin}${agencyProfileRoute(alias)}`;
    setState({ phase: 'loading' });
    import('@/lib/qr/qr-code')
      .then(({ qrSvg }) => qrSvg(url, preset))
      .then((svg) => {
        if (!cancelled) setState({ phase: 'ready', url, svg });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [alias, preset]);

  return state;
}

/** **SVG → `src` εικόνας** — `<img>` αντί για `dangerouslySetInnerHTML`: το SVG δεν γίνεται ποτέ DOM της σελίδας. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
