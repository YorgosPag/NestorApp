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
 * Καλεί το `onSize` με το μέγεθος του `ref` — μία φορά πριν το πρώτο βάψιμο και σε κάθε αλλαγή. Χωρίς `ResizeObserver`
 * (jsdom · πολύ παλιός browser) δεν καλείται **ποτέ**: ο καταναλωτής κρατά την ειλικρινή «άγνωστη» τιμή του.
 * ⚠️ Το `onSize` πρέπει να είναι σταθερό (`useCallback`) — αλλιώς ο παρατηρητής ξαναστήνεται σε κάθε render.
 */
export function useSizeObserver(ref: RefObject<HTMLElement | null>, onSize: (width: number, height: number) => void): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const rect = element.getBoundingClientRect();
    onSize(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      // Border-box και εδώ, ίδια με την πρώτη μέτρηση (`getBoundingClientRect`) — το `contentRect` αφαιρεί το padding, και
      // δύο μετρήσεις του ίδιου στοιχείου θα διαφωνούσαν κατά το padding.
      const box = entry.borderBoxSize?.[0];
      if (box) onSize(box.inlineSize, box.blockSize);
      else onSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, onSize]);
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
export function useElementSize(ref: RefObject<HTMLElement | null>, step: number): ElementSize {
  const [size, setSize] = useState<ElementSize>(UNMEASURED_SIZE);
  const sync = useCallback((width: number, height: number) => {
    const next = { width: toStep(width, step), height: toStep(height, step) };
    setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
  }, [step]);
  useSizeObserver(ref, sync);
  return size;
}
