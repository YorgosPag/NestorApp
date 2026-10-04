'use client';
/**
 * @fileoverview **Το μέγεθος ενός στοιχείου** — ο ΕΝΑΣ παρατηρητής (`useSizeObserver`) και η εκδοχή του σε σκαλοπάτια.
 * @related ADR-884 Φ2στ-γ Γ2 (η κάτοψη της περιήγησης: ποιο παράγωγο ζητά, πόσα μέτρα είναι ένα pixel) · `useContainerClass.ts`
 *   (ADR-777 §8.75 — ίδιος παρατηρητής, τρεις καταστάσεις)
 * @module hooks/media/useElementSize
 *
 * 🔑 **Ένας παρατηρητής**: μέτρηση πριν το πρώτο βάψιμο (`useLayoutEffect` — μηδέν CLS) + `ResizeObserver` + αποσύνδεση.
 *   Ζούσε γραμμένος μέσα στο `useContainerClass`· η στήλη της περιήγησης χρειάστηκε την ίδια μηχανική με άλλη ερώτηση,
 *   άρα η μηχανική έγινε ένα σημείο και οι **ερωτήσεις** μένουν στους καταναλωτές.
 * 🔑 **Σκαλοπάτια, όχι pixel** (`useElementSize`): όταν ο επισκέπτης σέρνει τη διαχωριστική, το μέγεθος αλλάζει ~60 φορές το
 *   δευτερόλεπτο. Ο καταναλωτής ξαναζωγραφίζεται **μόνο** όταν το μέγεθος περάσει σε άλλο σκαλοπάτι (πνεύμα ADR-040).
 */
import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

export interface ElementSize {
  readonly width: number;
  readonly height: number;
}

/** `0 × 0` = «δεν μετρήθηκε» (SSR · jsdom · χωρίς `ResizeObserver`). */
const UNMEASURED_SIZE: ElementSize = { width: 0, height: 0 };

/**
 * **Ποιο κουτί μετριέται** — το λεξιλόγιο του ίδιου του `ResizeObserver.observe(el, { box })`. `border-box` (προεπιλογή) =
 * ό,τι πιάνει το στοιχείο στη σελίδα· `content-box` = ό,τι μένει για τα **παιδιά** του, χωρίς padding/border — η σωστή
 * ερώτηση για «σε πόσο χώρο χωρά η εικόνα» (ADR-899 §9 Ε4ε: το `p-4` του πάνελ, ×1,5 από τον λόγο πλευρών, έδινε +55 px).
 */
export type MeasuredBox = 'border-box' | 'content-box';

function px(value: string): number {
  return Number.parseFloat(value) || 0;
}

/** Η πρώτη μέτρηση, σύμφωνη με το κουτί που θα αναφέρει μετά ο παρατηρητής — δύο μετρήσεις, ΕΝΑ κουτί. */
function initialSizeOf(element: HTMLElement, box: MeasuredBox): ElementSize {
  const rect = element.getBoundingClientRect();
  if (box === 'border-box') return { width: rect.width, height: rect.height };
  const s = getComputedStyle(element);
  return {
    width: rect.width - px(s.paddingLeft) - px(s.paddingRight) - px(s.borderLeftWidth) - px(s.borderRightWidth),
    height: rect.height - px(s.paddingTop) - px(s.paddingBottom) - px(s.borderTopWidth) - px(s.borderBottomWidth),
  };
}

/** Το μέγεθος μιας αναφοράς του παρατηρητή στο ζητούμενο κουτί (`contentRect` = content-box, εφεδρεία παλιών browser). */
function observedSizeOf(entry: ResizeObserverEntry, box: MeasuredBox): ElementSize {
  const size = (box === 'border-box' ? entry.borderBoxSize : entry.contentBoxSize)?.[0];
  return size
    ? { width: size.inlineSize, height: size.blockSize }
    : { width: entry.contentRect.width, height: entry.contentRect.height };
}

/**
 * Καλεί το `onSize` με το μέγεθος του `ref` — μία φορά πριν το πρώτο βάψιμο και σε κάθε αλλαγή. Χωρίς `ResizeObserver`
 * (jsdom · πολύ παλιός browser) δεν καλείται **ποτέ**: ο καταναλωτής κρατά την ειλικρινή «άγνωστη» τιμή του.
 * ⚠️ Το `onSize` πρέπει να είναι σταθερό (`useCallback`) — αλλιώς ο παρατηρητής ξαναστήνεται σε κάθε render.
 */
export function useSizeObserver(
  ref: RefObject<HTMLElement | null>,
  onSize: (width: number, height: number) => void,
  box: MeasuredBox = 'border-box',
): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const initial = initialSizeOf(element, box);
    onSize(initial.width, initial.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      // Το ΙΔΙΟ κουτί με την πρώτη μέτρηση — αλλιώς δύο μετρήσεις του ίδιου στοιχείου διαφωνούν κατά το padding.
      const size = observedSizeOf(entry, box);
      onSize(size.width, size.height);
    });
    observer.observe(element, { box });
    return () => observer.disconnect();
  }, [ref, onSize, box]);
}

function toStep(value: number, step: number): number {
  return value > 0 ? Math.round(value / step) * step : 0;
}

/**
 * **Το άνω φράγμα ενός μεγέθους σε σκαλοπάτια** (+½ σκαλοπατιού) — για όποιον ρωτά «πόσα pixel χρειάζεται η εικόνα»:
 * υπερεκτίμηση λίγων pixel, ποτέ θόλωμα από στρογγύλευση προς τα κάτω (ADR-899 §4.1). Το «δεν μετρήθηκε» (`0 × 0`)
 * μένει `0 × 0` — η ειλικρινής «άγνωστη» τιμή δεν γίνεται ποτέ μισό σκαλοπάτι.
 */
export function steppedUpperBound(size: ElementSize, step: number): ElementSize {
  if (!(size.width > 0) || !(size.height > 0)) return UNMEASURED_SIZE;
  const half = step / 2;
  return { width: size.width + half, height: size.height + half };
}

/** Το μέγεθος του `ref` στρογγυλεμένο σε πολλαπλάσιο του `step` (css px) — νέα τιμή **μόνο** όταν αλλάζει σκαλοπάτι. */
export function useElementSize(
  ref: RefObject<HTMLElement | null>,
  step: number,
  box: MeasuredBox = 'border-box',
): ElementSize {
  const [size, setSize] = useState<ElementSize>(UNMEASURED_SIZE);
  const sync = useCallback((width: number, height: number) => {
    const next = { width: toStep(width, step), height: toStep(height, step) };
    setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
  }, [step]);
  useSizeObserver(ref, sync, box);
  return size;
}
