/**
 * **Το πλάτος της οθόνης στο jsdom** — ο ΕΝΑΣ τρόπος να απαντήσει ένα test στην ερώτηση του `useViewportClass`.
 * @related `hooks/media/useViewportClass.ts` · ADR-912 §12.14 · §12.15
 *
 * Το jsdom δεν έχει `matchMedia` ⇒ κάθε component που ρωτά «στενό ή φαρδύ;» ρίχνει το render. Στενό = το query
 * `max-width` του `MOBILE_BREAKPOINT` ταιριάζει. Οι ακροατές είναι κενοί: το πλάτος δεν αλλάζει μέσα σε ένα test.
 */
const noop = (): void => undefined;

export function mockViewport(narrow: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: narrow, media: query, addEventListener: noop, removeEventListener: noop }),
  });
}
