'use client';

/**
 * ADR-241 — **Σταθερός ξενιστής: τα παιδιά της πλήρους οθόνης προσαρτώνται ΜΙΑ φορά.**
 *
 * 🔴 Ως 2026-09-11 το `FullscreenOverlay` επέστρεφε `<section>{children}</section>` ή `createPortal(...)` — άλλη
 * θέση στο δέντρο ⇒ το React ξαναπροσάρτα τα παιδιά σε **κάθε** εναλλαγή: μισοσυμπληρωμένα πεδία χάνονταν (Νομικά
 * «Ανάθεση»), ο DXF ξαναέστηνε **4/4** καμβάδες και contexts WebGL, και το κουμπί που άνοιξε την πλήρη οθόνη δεν
 * υπήρχε πια για να πάρει πίσω το focus.
 *
 * ── ΤΟ ΣΧΗΜΑ (reverse portal, χωρίς εξάρτηση) ──
 *
 * Ένα στοιχείο `<section>` που ζει **όσο ζει το component** (ο «ξενιστής»). Τα παιδιά αποδίδονται **πάντα** μέσα του
 * με `createPortal` — ο container του portal δεν αλλάζει ποτέ, άρα το React δεν τα ξαναχτίζει. Ό,τι αλλάζει είναι
 * **πού βρίσκεται ο ξενιστής** στο DOM: στη θέση του μέσα στη σελίδα ή μέσα στην επιφάνεια. Τον μετακινεί το
 * {@link moveNode} (`moveBefore` όπου υπάρχει — κρατά focus, iframes, WebGL).
 *
 * ⚠️ **Client-only από κατασκευής**: ο ξενιστής δημιουργείται σε layout effect, άρα ο server (και το πρώτο πέρασμα
 * της hydration) αποδίδουν μόνο τις κενές θέσεις — ο server renderer του React **πετά** σε `createPortal`. Η layout
 * effect τρέχει πριν τη ζωγραφική, οπότε στον client δεν υπάρχει ορατό «πρώτα άδειο, μετά γεμάτο».
 *
 * ⚠️ Η κλάση του καταναλωτή μπαίνει **στον ξενιστή**, δηλαδή στον **άμεσο** γονέα των παιδιών: το `space-y-*` της
 * Tailwind 3.4 είναι επιλογέας παιδιού και σε ενδιάμεσο wrapper θα έπαυε σιωπηλά να ισχύει.
 */

import { useLayoutEffect, useRef, useState } from 'react';

import { moveNode } from './move-node';

export interface StableHostOptions {
  readonly isFullscreen: boolean;
  /** Κλάση του ξενιστή όταν ζει μέσα στη σελίδα (η `className` του καταναλωτή). */
  readonly inlineClassName: string;
  /** Κλάση του ξενιστή όταν ζει μέσα στην επιφάνεια (ήδη συντεθειμένη από τον καλούντα). */
  readonly fullscreenClassName: string;
  /** Ετικέτα της περιοχής όσο ζει μέσα στη σελίδα· στην επιφάνεια την ετικέτα τη φέρει η ίδια η επιφάνεια. */
  readonly ariaLabel?: string;
}

export interface StableHost {
  /** Ο ξενιστής — `null` στον server και στο πρώτο πέρασμα του client. */
  readonly host: HTMLElement | null;
  /** Η θέση του ξενιστή μέσα στη σελίδα. */
  readonly inlineSlotRef: React.MutableRefObject<HTMLDivElement | null>;
  /** Η θέση του ξενιστή μέσα στην επιφάνεια της πλήρους οθόνης. */
  readonly surfaceSlotRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function useStableHost(options: StableHostOptions): StableHost {
  const { isFullscreen, inlineClassName, fullscreenClassName, ariaLabel } = options;
  const [host, setHost] = useState<HTMLElement | null>(null);
  const inlineSlotRef = useRef<HTMLDivElement | null>(null);
  const surfaceSlotRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    setHost(document.createElement('section'));
  }, []);

  useLayoutEffect(() => {
    if (!host) return;
    const slot = isFullscreen ? surfaceSlotRef.current : inlineSlotRef.current;
    if (slot) moveNode(host, slot);
    host.className = isFullscreen ? fullscreenClassName : inlineClassName;
    if (!isFullscreen && ariaLabel) host.setAttribute('aria-label', ariaLabel);
    else host.removeAttribute('aria-label');
  }, [host, isFullscreen, inlineClassName, fullscreenClassName, ariaLabel]);

  return { host, inlineSlotRef, surfaceSlotRef };
}
