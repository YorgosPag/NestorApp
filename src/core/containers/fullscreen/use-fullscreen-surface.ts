'use client';

/**
 * ADR-241 · ADR-364 §10.15.γ · ADR-711 — **Η πλήρης οθόνη ως επιφάνεια: Escape, focus, αδράνεια, κύλιση.**
 *
 * Ως 2026-09-11 η πλήρης οθόνη δήλωνε `role="dialog" aria-modal` χωρίς να το τηρεί (μετρημένο ζωντανά):
 *   - **ένα** Esc με ανοιχτό Select / μενού / διάλογο μέσα της έκλεινε **και** τη στρώση **και** την ίδια·
 *   - το Tab δραπέτευε στη σελίδα από κάτω· στην έξοδο το focus έπεφτε στο `body`.
 *
 * ── ΕΝΑ ESC = ΕΝΑ ΠΛΑΙΣΙΟ ΠΡΟΣ ΤΑ ΕΞΩ (Revit / AutoCAD / Figma — ίδια αρχή με το GROUP_EXIT του ADR-364) ──
 *
 *   1. εσώτερη στρώση (Radix, slot του bus, πεδίο με δικό του «άκυρο») — την κρίνει η στοίβα (`escape-layers`)
 *   2. **πεδίο κειμένου** μέσα στην επιφάνεια ⇒ το focus φεύγει από το πεδίο προς την επιφάνεια· το κείμενο μένει
 *   3. **η πλήρης οθόνη** ⇒ έξοδος
 * Ένας χώρος εργασίας δεν επιτρέπεται να κλείνει επειδή κάποιος πάτησε Esc για να φύγει από ένα πεδίο.
 *
 * ── ΓΙΑΤΙ ΔΥΟ HOOKS ──
 *
 * Ο opener (το κουμπί που άνοιξε την πλήρη οθόνη) καταγράφεται **πριν** μετακινηθεί ο ξενιστής: με το εφεδρικό
 * `appendChild` η μετακίνηση χάνει το focus, οπότε μια καταγραφή μετά θα έβρισκε `body`. Το React τρέχει τις layout
 * effects με σειρά δήλωσης — άρα {@link useFullscreenOpener} δηλώνεται **πριν** το `useStableHost` και
 * {@link useFullscreenSurface} **μετά**.
 *
 * ⚠️ **ΔΕΝ** πατά `ModalKeyboardScope` (ADR-711): θα σκότωνε όλους τους accelerators του DXF σε πλήρη οθόνη.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';

import { pushEscapeLayer } from '@/lib/a11y/escape-layers';
import { canRestoreFocusTo, captureFocusOpener } from '@/lib/a11y/focus-return';
import { inertOutside } from '@/lib/a11y/inert-outside';
import { isTextEntryTarget } from '@/lib/a11y/keyboard-scope';

/** Ο δηλωμένος ιδιοκτήτης των πατημάτων Escape που χειρίζεται η επιφάνεια (ADR-364 — έλεγχος). */
export const FULLSCREEN_SURFACE_ESCAPE_ID = 'core/fullscreen-surface';

type ElementRef = React.MutableRefObject<HTMLElement | null>;

export interface FullscreenSurfaceOptions {
  readonly isFullscreen: boolean;
  /**
   * Υπάρχει ήδη η επιφάνεια στο DOM (ο σταθερός ξενιστής δημιουργείται σε layout effect, άρα **όχι** στο πρώτο
   * πέρασμα). ⚠️ Χωρίς αυτό στα deps, μια επιφάνεια που **ξεκινά** ενεργή δεν θα αποκτούσε ποτέ αδράνεια, κλείδωμα
   * κύλισης ή focus: η layout effect θα έβρισκε `surfaceRef = null` και δεν θα ξανάτρεχε (το έπιασε η άγκυρα C4).
   */
  readonly ready: boolean;
  /** Έξοδος από την πλήρη οθόνη — καλείται μόνο όσο είναι ενεργή. */
  readonly onExit: () => void;
  readonly surfaceRef: ElementRef;
  /** Από το {@link useFullscreenOpener}. */
  readonly openerRef: ElementRef;
}

/** Δηλώνεται **πριν** το `useStableHost`: κρατά τον opener πριν η μετακίνηση του ξενιστή του πάρει το focus. */
export function useFullscreenOpener(isFullscreen: boolean): ElementRef {
  const openerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (isFullscreen) openerRef.current = captureFocusOpener();
  }, [isFullscreen]);
  return openerRef;
}

let scrollLocks = 0;

/** Κλείδωμα κύλισης του `body` με μέτρηση αναφορών — δύο επιφάνειες δεν ξεκλειδώνουν η μία την άλλη. */
function lockBodyScroll(): () => void {
  scrollLocks += 1;
  document.body.classList.add('overflow-hidden');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.classList.remove('overflow-hidden');
  };
}

function isTextEntryInside(surface: HTMLElement | null, target: EventTarget | null): boolean {
  return surface !== null && target instanceof Node && surface.contains(target) && isTextEntryTarget(target);
}

function useSurfaceEscape({ isFullscreen, onExit, surfaceRef }: FullscreenSurfaceOptions): void {
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  useEffect(() => {
    if (!isFullscreen) return undefined;
    return pushEscapeLayer({
      id: FULLSCREEN_SURFACE_ESCAPE_ID,
      onEscape: (event) => {
        const surface = surfaceRef.current;
        if (surface && isTextEntryInside(surface, event.target)) {
          surface.focus({ preventScroll: true }); // 1ο Esc: έξω από το πεδίο — ένα πλαίσιο, όχι δύο
          return;
        }
        exitRef.current();
      },
    });
  }, [isFullscreen, surfaceRef]);
}

/** Αδράνεια + κύλιση + focus μέσα, όσο η επιφάνεια είναι ενεργή. Τρέχει **μετά** τη μετακίνηση του ξενιστή. */
function useSurfaceModality({ isFullscreen, ready, surfaceRef }: FullscreenSurfaceOptions): void {
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!isFullscreen || !ready || !surface) return undefined;
    const releaseInert = inertOutside([surface]);
    const releaseScroll = lockBodyScroll();
    if (!surface.contains(document.activeElement)) surface.focus({ preventScroll: true });
    return () => {
      releaseInert();
      releaseScroll();
    };
  }, [isFullscreen, ready, surfaceRef]);
}

/** Στην έξοδο, **αφού** ο ξενιστής γύρισε στη σελίδα: αν χάθηκε το focus, πίσω στον opener. */
function useFocusReturn({ isFullscreen, surfaceRef, openerRef }: FullscreenSurfaceOptions): void {
  const wasFullscreenRef = useRef(false);
  useLayoutEffect(() => {
    if (isFullscreen) {
      wasFullscreenRef.current = true;
      return;
    }
    if (!wasFullscreenRef.current) return;
    wasFullscreenRef.current = false;
    const opener = openerRef.current;
    openerRef.current = null;
    const active = document.activeElement;
    const focusLost = !active || active === document.body || surfaceRef.current?.contains(active) === true;
    if (focusLost && canRestoreFocusTo(opener)) opener.focus({ preventScroll: true });
  }, [isFullscreen, surfaceRef, openerRef]);
}

/** Δηλώνεται **μετά** το `useStableHost`. */
export function useFullscreenSurface(options: FullscreenSurfaceOptions): void {
  useSurfaceEscape(options);
  useSurfaceModality(options);
  useFocusReturn(options);
}
