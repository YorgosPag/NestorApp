'use client';

/**
 * @fileoverview **Ένας κωδικός QR για σελίδα της εφαρμογής**: η μία γέννηση πίσω από κάθε οθόνη QR (ADR-841 §7 Α21.17 · ADR-923 §5.12).
 * @related lib/qr/qr-code.ts · hooks/mandate/useShowcaseQr.ts
 * @module hooks/useQrSvg
 *
 * 🔑 Η απόλυτη διεύθυνση από τον περιηγητή: το `window.location.origin` δεν παλιώνει και δεν χρειάζεται ρύθμιση ανά
 * περιβάλλον. Διαβάζεται **μέσα στο effect**, γιατί σε SSR δεν υπάρχει.
 * ⚠️ Δυναμική εισαγωγή του `qrcode`: η βιβλιοθήκη φορτώνει μόνο όταν χρειαστεί.
 */

import React from 'react';

import type { QrPreset } from '@/lib/qr/qr-code';

export type QrSvgState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly url: string; readonly svg: string }
  | { readonly phase: 'failed' };

export function useQrSvg(path: string, preset: QrPreset): QrSvgState {
  const [state, setState] = React.useState<QrSvgState>({ phase: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    const url = `${window.location.origin}${path}`;
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
  }, [path, preset]);

  return state;
}
