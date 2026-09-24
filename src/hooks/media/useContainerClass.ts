'use client';
/**
 * @fileoverview **Το πλάτος του ΠΕΡΙΕΚΤΗ ως τρεις καταστάσεις** — όχι του παραθύρου.
 * @related ADR-777 §8.75 · hooks/media/useViewportClass.ts
 * @module hooks/media/useContainerClass
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΟ `useViewportClass` — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΠΡΟΤΙΜΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `useViewportClass` ρωτά το **παράθυρο**, και για την οθόνη 2 αυτό είναι σωστό: εκεί η
 * επιφάνεια **είναι** το παράθυρο. Μέσα στον ιδιωτικό χώρο όμως υπάρχει η πλαϊνή στήλη
 * (ADR-871): σε παράθυρο 1024px με ανοιχτή στήλη μένουν **768px** επιφάνειας, με κλειστή
 * **~976px**. Η ίδια ερώτηση «χωράνε λίστα και χάρτης δίπλα-δίπλα;» έχει **δύο** απαντήσεις
 * στο ίδιο παράθυρο — και ένα media query δεν μπορεί να ξέρει ποια ισχύει.
 *
 * 🏆 **Πέρα από τους μεγάλους**: Zillow / Redfin / Airbnb αποφασίζουν με breakpoint του
 * παραθύρου. Εδώ αποφασίζει ο **χώρος που πραγματικά υπάρχει**, άρα η διάταξη αντιδρά σωστά
 * (α) στο άνοιγμα/κλείσιμο της στήλης, (β) στο zoom — στο 400% (WCAG 2.2 SC 1.4.10) το
 * CSS πλάτος πέφτει και η οθόνη γυρίζει **μόνη της** στη μονόστηλη εκδοχή — και (γ) στο
 * μέγεθος γραμματοσειράς του χρήστη: το κατώφλι είναι σε **rem**, όχι σε px (SC 1.4.4).
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ `@container` ΣΤΟ CSS**: η απόφαση δεν είναι μόνο γεωμετρία — αλλάζει **ρόλους**
 * (καρτέλες ⇄ δύο περιοχές). Ένα `tabpanel` δεν γίνεται `region` με CSS. Και το
 * `container-type` δημιουργεί stacking context (δες `shell-surface.css` §2).
 *
 * 🔑 **`useLayoutEffect`, όχι `useEffect`**: η πρώτη μέτρηση γίνεται **πριν** το πρώτο βάψιμο,
 * άρα η λάθος διάταξη δεν φαίνεται ποτέ — μηδέν CLS.
 */
import { useLayoutEffect, useState, type RefObject } from 'react';

import type { ViewportClass } from '@/hooks/media/useViewportClass';

/** Το root font size σε px — το κατώφλι ακολουθεί την προτίμηση γραμματοσειράς του χρήστη. */
function rootFontPx(): number {
  const parsed = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
}

/**
 * **Χωράει ο περιέκτης `minRem`;** `'measuring'` μέχρι την πρώτη μέτρηση — και **για πάντα**
 * εκεί όπου δεν υπάρχει `ResizeObserver` (jsdom, πολύ παλιός browser): η ειλικρινής απάντηση
 * είναι «δεν ξέρω», και ο καταναλωτής οφείλει να τη χειριστεί ρητά.
 */
export function useContainerClass(ref: RefObject<HTMLElement | null>, minRem: number): ViewportClass {
  const [value, setValue] = useState<ViewportClass>('measuring');

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const sync = (width: number): void => setValue(width >= minRem * rootFontPx() ? 'wide' : 'narrow');
    sync(element.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) sync(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, minRem]);

  return value;
}
