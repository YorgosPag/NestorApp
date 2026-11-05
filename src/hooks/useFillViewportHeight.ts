'use client';

/**
 * **Ένα στοιχείο γεμίζει ό,τι μένει από το ύψος του ορίου του κάτω από τη θέση του** — μετρημένο, όχι μαντεμένο.
 * @module hooks/useFillViewportHeight
 * @related ADR-928 §5.23 (πρώτος καταναλωτής: το `EditorSplitLayout` των επεξεργαστών υπεργολαβίας)
 *
 * 🔴 **Η αφορμή**: το split φόρμα | προεπισκόπηση είχε `h-[calc(100dvh-16rem)]` — ο αριθμός υπέθετε 256px πάνω από τον
 *    επεξεργαστή, ενώ μετρημένα ήταν ~540px (επικεφαλίδα, αποκλίσεις, εργαλειοθήκη). Αποτέλεσμα: η **σελίδα** κυλούσε
 *    **και** οι στήλες κυλούσαν — διπλή κύλιση, και το κάτω μέρος της προεπισκόπησης έξω από την οθόνη. Κάθε γραμμή
 *    πάνω από το split (μπάνερ σύγκρουσης, ανοιχτές αποκλίσεις) θα τον ξαναχαλούσε.
 * 🔑 **Όριο** = ο πλησιέστερος πρόγονος που **κόβει ή κυλά** (`overflow-y` όχι `visible`) — ο κυλιόμενος `<main>` του
 *    κελύφους **ή** μια στήλη flex σταθερού ύψους με `overflow:hidden` (σελίδες ρήτρας/προτύπου). Χωρίς τέτοιον: το
 *    παράθυρο.
 * 🔑 Ύψος = `κάτω άκρο του ορίου − απόσταση του στοιχείου από την κορυφή − ό,τι το ακολουθεί ως το τέλος του ορίου
 *    (μετρημένο: αδέλφια, κενά, padding/περιθώρια προγόνων) − πρόσθετο κενό`, με ελάχιστο. Ξαναμετρά όταν αλλάξει το
 *    παράθυρο **ή** το περιεχόμενο του ορίου — ένα rAF ανά αλλαγή.
 * 🔴 Ζωντανός έλεγχος §5.23 (2026-11-05), δύο αστοχίες της πρώτης εκδοχής (παράθυρο − κορυφή − σταθερά 16 px):
 *    (α) τα πραγματικά κάτω περιθώρια ήταν 16 + 24 ⇒ το `<main>` κυλούσε 23 px πάνω από το split που κυλά·
 *    (β) σε στήλη flex σταθερού ύψους το split έβγαινε ψηλότερο από το όριο ⇒ το flex **συμπίεζε** την κεφαλίδα της
 *    σελίδας (`overflow:hidden` ⇒ ελάχιστο ύψος 0), η κορυφή του split ανέβαινε, το ύψος μεγάλωνε ξανά — κύκλος ως ότου
 *    η κεφαλίδα «Νέα ρήτρα» κόπηκε στη μέση.
 * 🔑 Η απόσταση μετριέται ανεξάρτητα από την κύλιση (προστίθεται η κύλιση των προγόνων), άρα ο υπολογισμός δεν αλλάζει
 *    όταν ο άνθρωπος κυλήσει.
 * ⚠️ Γράφεται **προστακτικά** (`style.height`) — όπως η `react-resizable-panels` γράφει `flex-grow`: τιμή που αλλάζει με
 *    το παράθυρο δεν περνά από render. Χωρίς `ResizeObserver` (jsdom/SSR) ⇒ το στοιχείο κρατά το `className` του.
 */

import { useLayoutEffect, useRef, type RefObject } from 'react';

export interface FillViewportHeightOptions {
  /** Κάτω όριο σε px: σε πολύ χαμηλό παράθυρο κυλά η σελίδα, αντί να γίνει το στοιχείο λωρίδα. */
  readonly minPx: number;
  /** **Πρόσθετο** κενό κάτω από το στοιχείο σε px — τα περιθώρια της σελίδας μετριούνται ήδη, μην τα ξαναμετράς εδώ. */
  readonly bottomGapPx: number;
}

/** Καθαρή: το ύψος που γεμίζει το όριο. Ακέραια px — όχι αναδιάταξη για κλάσματα. */
export function fillHeightOf(boundaryBottomPx: number, documentTopPx: number, options: FillViewportHeightOptions): number {
  return Math.max(options.minPx, Math.floor(boundaryBottomPx - documentTopPx - options.bottomGapPx));
}

/** Πόσο απέχει το στοιχείο από την κορυφή του **περιεχομένου** — ίδιο σε κάθε θέση κύλισης. */
function documentTopOf(element: HTMLElement): number {
  let scrolled = window.scrollY;
  for (let node = element.parentElement; node; node = node.parentElement) scrolled += node.scrollTop;
  return element.getBoundingClientRect().top + scrolled;
}

/** Ο πλησιέστερος πρόγονος που κόβει ή κυλά — `null` όταν όριο είναι το ίδιο το παράθυρο. */
function boundaryOf(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    if (window.getComputedStyle(node).overflowY !== 'visible') return node;
  }
  return null;
}

/** Το κάτω άκρο της εσωτερικής περιοχής του ορίου (ή του παραθύρου), σε px παραθύρου, στη θέση κύλισης 0. */
function boundaryBottomOf(boundary: HTMLElement | null): number {
  if (!boundary) return window.innerHeight;
  return documentTopOf(boundary) + boundary.clientTop + boundary.clientHeight;
}

/**
 * **Ό,τι ακολουθεί το στοιχείο μέσα στο όριο** — για κάθε πρόγονο ως το όριο, η απόσταση από το κάτω άκρο του παιδιού
 * ως το κάτω άκρο του γονέα (επόμενα αδέλφια, κενά `space-y`, περιθώρια, `padding`/`border` του γονέα), και τέλος το
 * κάτω περιθώριο του τελευταίου κρίκου και το κάτω `padding` του ίδιου του ορίου.
 */
function trailingOf(element: HTMLElement, boundary: HTMLElement | null): number {
  const stop = boundary ?? document.body;
  let trailing = 0;
  let child: HTMLElement = element;
  for (let parent = element.parentElement; parent && parent !== stop; parent = parent.parentElement) {
    trailing += parent.getBoundingClientRect().bottom - child.getBoundingClientRect().bottom;
    child = parent;
  }
  const lastMargin = parseFloat(window.getComputedStyle(child).marginBottom) || 0;
  return trailing + lastMargin + (parseFloat(window.getComputedStyle(stop).paddingBottom) || 0);
}

/** Το ύψος (px) που γεμίζει το όριο του στοιχείου — όλη η μέτρηση σε ένα σημείο (ο hook το γράφει, το test το ελέγχει). */
export function measureFillHeight(element: HTMLElement, options: FillViewportHeightOptions): number {
  const boundary = boundaryOf(element);
  const gap = trailingOf(element, boundary) + options.bottomGapPx;
  return fillHeightOf(boundaryBottomOf(boundary), documentTopOf(element), { minPx: options.minPx, bottomGapPx: gap });
}

export function useFillViewportHeight<T extends HTMLElement>(enabled: boolean, options: FillViewportHeightOptions): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const { minPx, bottomGapPx } = options;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof ResizeObserver === 'undefined') return;
    const boundary = boundaryOf(element);
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = `${measureFillHeight(element, { minPx, bottomGapPx })}px`;
        if (element.style.height !== height) element.style.height = height;
      });
    };
    // Όταν ανοίξει κάτι **πάνω** από το στοιχείο (αποκλίσεις, μπάνερ) αλλάζει η **θέση** του, όχι το μέγεθος του γονέα
    // του. Αλλάζει όμως το ύψος του **περιεχομένου** του ορίου — αυτό παρατηρείται (τα παιδιά του ορίου, ή το `body`).
    // Η δική μας εγγραφή ξαναπυροδοτεί μία φορά και σταματά (ίδια τιμή ⇒ καμία εγγραφή).
    const observer = new ResizeObserver(measure);
    for (const content of boundary ? Array.from(boundary.children) : [document.body]) observer.observe(content);
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
