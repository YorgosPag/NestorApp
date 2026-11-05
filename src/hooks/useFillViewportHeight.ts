'use client';

/**
 * **Ένα στοιχείο γεμίζει ό,τι μένει από το ύψος του παραθύρου κάτω από τη θέση του** — μετρημένο, όχι μαντεμένο.
 * @module hooks/useFillViewportHeight
 * @related ADR-928 §5.23 (πρώτος καταναλωτής: το `EditorSplitLayout` των επεξεργαστών υπεργολαβίας)
 *
 * 🔴 **Η αφορμή**: το split φόρμα | προεπισκόπηση είχε `h-[calc(100dvh-16rem)]` — ο αριθμός υπέθετε 256px πάνω από τον
 *    επεξεργαστή, ενώ μετρημένα ήταν ~540px (επικεφαλίδα, αποκλίσεις, εργαλειοθήκη). Αποτέλεσμα: η **σελίδα** κυλούσε
 *    **και** οι στήλες κυλούσαν — διπλή κύλιση, και το κάτω μέρος της προεπισκόπησης έξω από την οθόνη. Κάθε γραμμή
 *    πάνω από το split (μπάνερ σύγκρουσης, ανοιχτές αποκλίσεις) θα τον ξαναχαλούσε.
 * 🔑 Ύψος = `innerHeight − (απόσταση του στοιχείου από την κορυφή του εγγράφου) − κενό βάσης`, με ελάχιστο. Ξαναμετρά
 *    όταν αλλάξει το παράθυρο **ή** ό,τι βρίσκεται πάνω του (αλλάζει το ύψος του εγγράφου) — ένα rAF ανά αλλαγή.
 * 🔑 Η απόσταση μετριέται ανεξάρτητα από την κύλιση (προστίθεται η κύλιση του κυλιόμενου προγόνου), άρα ο υπολογισμός
 *    δεν αλλάζει όταν ο άνθρωπος κυλήσει.
 * ⚠️ Γράφεται **προστακτικά** (`style.height`) — όπως η `react-resizable-panels` γράφει `flex-grow`: τιμή που αλλάζει με
 *    το παράθυρο δεν περνά από render. Χωρίς `ResizeObserver` (jsdom/SSR) ⇒ το στοιχείο κρατά το `className` του.
 */

import { useLayoutEffect, useRef, type RefObject } from 'react';

export interface FillViewportHeightOptions {
  /** Κάτω όριο σε px: σε πολύ χαμηλό παράθυρο κυλά η σελίδα, αντί να γίνει το στοιχείο λωρίδα. */
  readonly minPx: number;
  /** Κενό κάτω από το στοιχείο σε px (το κάτω περιθώριο της σελίδας). */
  readonly bottomGapPx: number;
}

/** Καθαρή: το ύψος που γεμίζει το παράθυρο. Ακέραια px — όχι αναδιάταξη για κλάσματα. */
export function fillHeightOf(viewportPx: number, documentTopPx: number, options: FillViewportHeightOptions): number {
  return Math.max(options.minPx, Math.floor(viewportPx - documentTopPx - options.bottomGapPx));
}

/** Πόσο απέχει το στοιχείο από την κορυφή του **περιεχομένου** — ίδιο σε κάθε θέση κύλισης. */
function documentTopOf(element: HTMLElement): number {
  let scrolled = window.scrollY;
  for (let node = element.parentElement; node; node = node.parentElement) scrolled += node.scrollTop;
  return element.getBoundingClientRect().top + scrolled;
}

/** Τα παιδιά του πλησιέστερου κυλιόμενου προγόνου (ή το `body`, όταν κυλά το παράθυρο): το ύψος του περιεχομένου. */
function contentOf(element: HTMLElement): Element[] {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return Array.from(node.children);
  }
  return [document.body];
}

export function useFillViewportHeight<T extends HTMLElement>(enabled: boolean, options: FillViewportHeightOptions): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const { minPx, bottomGapPx } = options;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = `${fillHeightOf(window.innerHeight, documentTopOf(element), { minPx, bottomGapPx })}px`;
        if (element.style.height !== height) element.style.height = height;
      });
    };
    // Όταν ανοίξει κάτι **πάνω** από το στοιχείο (αποκλίσεις, μπάνερ) αλλάζει η **θέση** του, όχι το μέγεθος του γονέα
    // του. Αλλάζει όμως το ύψος του **περιεχομένου** του κυλιόμενου προγόνου (το κέλυφος κυλά μέσα στο `<main>`, όχι στο
    // παράθυρο) — αυτό παρατηρείται. Η δική μας εγγραφή ξαναπυροδοτεί μία φορά και σταματά (ίδια τιμή ⇒ καμία εγγραφή).
    const observer = new ResizeObserver(measure);
    for (const content of contentOf(element)) observer.observe(content);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      element.style.height = '';
    };
  }, [enabled, minPx, bottomGapPx]);
  return ref;
}
