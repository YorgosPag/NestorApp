'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { canvasUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useIsTruncated } from '@/hooks/media/useIsTruncated';
import { captureFocusReturnTarget, returnFocus, type FocusReturnTarget } from '@/lib/a11y/focus-return';
import { enterModalSurface } from '@/lib/a11y/modal-surface';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DirtyFormProvider, useUnsavedEditsAnswer } from '@/providers/DirtyFormProvider';
import { confirmLeave, settledLeave } from '@/lib/unsaved-edits/leave-guard';
import { cn } from '@/lib/utils';
import {
  DetailsSheetActionsProvider,
  type DetailsSheetActionsSlot,
  type DetailsSheetDismissal,
} from './details-sheet-actions';

interface MobileDetailsSlideInProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** ⚠️ Χωρίς θυρίδα για κουμπιά (ADR-912 §12): οι ενέργειες δηλώνονται στο `EntityDetailsHeader` του περιεχομένου και φτάνουν στην μπάρα μόνες τους. */
  children: React.ReactNode;
}

/**
 * Όταν η κεφαλίδα έχει στείλει ενέργειες, ο τίτλος υποχωρεί ως το 40% της μπάρας: το όνομα το λέει ήδη η λίστα από
 * την οποία ήρθε ο άνθρωπος, η ενέργεια δεν υπάρχει πουθενά αλλού (iOS: ο τίτλος κόβεται, τα κουμπιά ποτέ).
 *
 * ⚠️ Το όριο μπαίνει στο **περιτύλιγμα** (`div`), όχι στο `h2`: το `globals.css` επιβάλλει κάτω από 640px
 *   `h1…h6, p, span { max-width: 100% !important }`, άρα `max-w-*` πάνω σε επικεφαλίδα είναι νεκρό ακριβώς στο κινητό.
 *   Μετρημένο (2026-10-11, Πωληθέντα 390px): τίτλος 318px, θυρίδα **0px**, η μόνη ενέργεια αόρατη.
 */
const TITLE_YIELDS_TO_ACTIONS = 'group-has-[[data-entity-action]]/sheet-bar:max-w-[40%]';

/** Τι από τη δηλωμένη Ακύρωση αλλάζει την ΟΨΗ του ✕ — μόνο αυτό γίνεται κατάσταση (ο χειριστής αλλάζει ταυτότητα σε κάθε render). */
interface DismissalView {
  readonly label: string;
  readonly disabled: boolean;
}

interface SheetDismissal {
  readonly view: DismissalView | null;
  readonly claim: DetailsSheetActionsSlot['claimDismissal'];
  /** Η Ακύρωση όπως δηλώθηκε **τώρα** (ανάγνωση τη στιγμή του πατήματος, όχι στιγμιότυπο). */
  readonly current: () => DetailsSheetDismissal | null;
}

function useSheetDismissal(): SheetDismissal {
  const latest = React.useRef<DetailsSheetDismissal | null>(null);
  const [view, setView] = React.useState<DismissalView | null>(null);

  const claim = React.useCallback((dismissal: DetailsSheetDismissal | null) => {
    latest.current = dismissal;
    const next = dismissal ? { label: dismissal.label, disabled: dismissal.disabled === true } : null;
    setView((prev) => (prev?.label === next?.label && prev?.disabled === next?.disabled ? prev : next));
  }, []);
  const current = React.useCallback(() => latest.current, []);

  return { view, claim, current };
}

/**
 * **Τι κάνει ο ✕**: όσο τρέχει επεξεργασία ΕΙΝΑΙ η Ακύρωση (ADR-912 §12.5) — ρωτά πριν χαθούν αλλαγές· αλλιώς κλείνει το φύλλο.
 */
function useSheetLeave(onClose: () => void, currentDismissal: SheetDismissal['current']) {
  // Τι δήλωσαν οι φόρμες του φύλλου (`useReportUnsavedEdits`)· `undefined` = καμία δεν ξέρει ⇒ ρωτάμε.
  const unsavedEdits = useUnsavedEditsAnswer();

  return async () => {
    const editing = currentDismissal();
    if (!editing) return onClose();
    // Η ρητή δήλωση της ενέργειας υπερισχύει· αλλιώς απαντούν οι φόρμες. `force`: το άγνωστο δεν δηλώνει ποτέ «καθαρό».
    const mayLoseEdits = (editing.discards ?? unsavedEdits) !== false;
    // Η ΙΔΙΑ ερώτηση με κάθε άλλη έξοδο (ADR-912 §12.12): Αποθήκευση · Απόρριψη · Συνέχεια επεξεργασίας.
    if (mayLoseEdits && !(await confirmLeave({ force: true }))) return;
    // Ξανά από την πηγή: όσο ήταν ανοιχτή η ερώτηση η επεξεργασία μπορεί να τελείωσε (π.χ. ολοκληρώθηκε αποθήκευση).
    // `settledLeave`: η απόφαση πάρθηκε — η Ακύρωση που κλείνει επιλογή (φόρμα δημιουργίας) δεν ξαναρωτά.
    settledLeave(() => currentDismissal()?.onDismiss());
  };
}

/**
 * 📱 **Το φύλλο λεπτομερειών του κινητού** — πλήρης οθόνη, μπάρα 48px (κλείσιμο · τίτλος · ενέργειες), περιεχόμενο.
 *
 * 🔑 Η μπάρα είναι **η** μπάρα ενεργειών της οντότητας (ADR-912 §12): κάθε `EntityDetailsHeader` που ζει στο
 *   περιεχόμενο αποδίδει τις ενέργειές του στη θυρίδα της, μέσω `details-sheet-actions`.
 */
export function MobileDetailsSlideIn({ isOpen, ...sheet }: MobileDetailsSlideInProps) {
  const canPortal = useCanPortal();
  if (!isOpen || !canPortal) return null;
  // Το ανοιχτό φύλλο είναι δικό του component: οι παρατηρητές του δένονται σε στοιχεία που υπάρχουν από το πρώτο render.
  // `DirtyFormProvider`: η εμβέλεια όπου οι φόρμες του φύλλου δηλώνουν αν έχουν αλλαγές — ο ✕ ρωτά ΑΥΤΗΝ (ADR-912 §12.5).
  // 🔑 Portal στο `body` (όπως κάθε Radix Dialog/Sheet): ένα `fixed inset-0` είναι πλήρης οθόνη ΜΟΝΟ αν κανένας πρόγονος
  //   δεν έχει `transform` / `filter` / `backdrop-filter` / `container-type`. Μετρημένο 2026-10-17 (ADR-912 §12.15): μέσα
  //   στην καρτέλα «Έγγραφα» το `backdrop-blur-sm` του δοχείου καρτελών έκανε το φύλλο 356×5153 στη μέση της σελίδας.
  //   Το context και τα γεγονότα της React ακολουθούν το δέντρο της React, όχι του DOM — τίποτα άλλο δεν αλλάζει.
  return createPortal(<DirtyFormProvider><OpenDetailsSheet {...sheet} /></DirtyFormProvider>, document.body);
}

const subscribeNever = () => () => undefined;

/** Υπάρχει `document.body`; Ο διακομιστής και το καρέ ενυδάτωσης λένε «όχι» (καμία ασυμφωνία markup)· μετά «ναι». */
function useCanPortal(): boolean {
  return React.useSyncExternalStore(subscribeNever, () => true, () => false);
}

/**
 * 🔑 **Όσο το φύλλο είναι ανοιχτό, η σελίδα από κάτω δεν υπάρχει** (ADR-912 §12.16 — Drive / iOS: ο θεατής είναι modal).
 *   Στιγμιότυπο Giorgio 2026-10-17 23:08: η κάτω μπάρα της σελίδας [⋯][Προσθήκη Αρχείων] φαινόταν πάνω από τον θεατή —
 *   το φύλλο απλώς **σκέπαζε**, άρα η σωστή στρώση z ήταν η ΜΟΝΗ άμυνα. Τώρα τα από κάτω είναι `inert` (ούτε κλικ, ούτε
 *   Tab, ούτε αναγνώστης οθόνης) και δεν κυλούν — ό,τι κι αν λέει το z.
 * ⚠️ **Μόνο όσο το φύλλο ΦΑΙΝΕΤΑΙ**: είναι `md:hidden`, και κάποιοι ξενιστές το ανοίγουν χωρίς έλεγχο πλάτους· αδράνεια
 *   πίσω από αόρατη επιφάνεια θα πάγωνε όλη τη σελίδα. Το «φαίνεται;» το απαντά ο browser (`display`) — όχι δεύτερο
 *   κατώφλι πλάτους δίπλα στο CSS, που θα μπορούσε να αποκλίνει.
 */
function useSheetModality(): (surface: HTMLElement | null) => void {
  const [surface, setSurface] = React.useState<HTMLElement | null>(null);
  const shown = useIsDisplayed(surface);
  const openerRef = React.useRef<FocusReturnTarget | null>(null);
  React.useLayoutEffect(() => {
    if (!surface || !shown) return undefined;
    openerRef.current ??= captureFocusReturnTarget(); // πριν πάρει το focus το φύλλο
    const release = enterModalSurface(surface);
    return () => {
      release();
      const active = document.activeElement;
      const focusLost = !active || active === document.body || surface.contains(active);
      if (focusLost && openerRef.current) returnFocus(openerRef.current, { preventScroll: true });
    };
  }, [surface, shown]);
  return setSurface;
}

/** `display !== 'none'` του στοιχείου, ξαναρωτημένο σε κάθε αλλαγή μεγέθους παραθύρου (εκεί αλλάζει το `md:hidden`). */
function useIsDisplayed(el: HTMLElement | null): boolean {
  const [displayed, setDisplayed] = React.useState(false);
  React.useLayoutEffect(() => {
    if (!el) return undefined;
    const sync = () => setDisplayed(getComputedStyle(el).display !== 'none');
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [el]);
  return displayed;
}

function OpenDetailsSheet({ onClose, title, children }: Omit<MobileDetailsSlideInProps, 'isOpen'>) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('common-actions');
  // Κατάσταση και όχι ref: η κεφαλίδα πρέπει να ξαναζωγραφιστεί μόλις υπάρξει ο ξενιστής.
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const { ref: titleRef, truncated: titleTruncated } = useIsTruncated<HTMLHeadingElement>();
  const dismissal = useSheetDismissal();
  const leave = useSheetLeave(onClose, dismissal.current);
  const surfaceRef = useSheetModality();
  const titleId = React.useId();
  const slot = React.useMemo<DetailsSheetActionsSlot>(
    () => ({ host, titleTruncated, claimDismissal: dismissal.claim }),
    [host, titleTruncated, dismissal.claim],
  );

  return (
    // Η στρώση των Radix Sheet/Dialog (ADR-780): πάνω από την κάτω μπάρα (`sticky`)· ό,τι ανοίγει ΑΠΟ το φύλλο (μενού,
    // διάλογος) μπαίνει αργότερα στο `body` στην ίδια στρώση ⇒ από πάνω. Το παλιό `z-50` ήταν κάτω από τη μπάρα (1040).
    <div
      ref={surfaceRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn('md:hidden fixed inset-0 z-[var(--z-index-transient-stack)] flex flex-col outline-none animate-in slide-in-from-right duration-300', colors.bg.primary)}
    >
      <div className={cn(canvasUtilities.geoInteractive.mobileSlideHeaderClass, 'group/sheet-bar', colors.bg.primary)}>
        <button
          type="button"
          onClick={leave}
          disabled={dismissal.view?.disabled}
          aria-label={dismissal.view?.label ?? t('actions.close')}
          data-details-sheet-leave={dismissal.view ? 'dismiss' : 'close'}
          className="-my-1.5 -ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md disabled:opacity-50"
        >
          <X className={iconSizes.sm} />
        </button>

        <div data-details-sheet-title="" className={cn('min-w-0', TITLE_YIELDS_TO_ACTIONS)}>
          <h2 ref={titleRef} id={titleId} className="truncate text-sm font-medium">
            {title}
          </h2>
        </div>

        {/* `grid`: το παιδί (γραμμή ενεργειών) παίρνει ΟΛΟ το πλάτος της θυρίδας, ανεξάρτητα από το πόσες κρύφτηκαν. */}
        <div ref={setHost} data-details-sheet-actions="" className="grid min-w-0 flex-1 basis-0" />
      </div>

      <div data-details-sheet="" className={cn(canvasUtilities.geoInteractive.mobileSlideContentClass, colors.bg.primary)}>
        <DetailsSheetActionsProvider value={slot}>
          {children}
        </DetailsSheetActionsProvider>
      </div>
    </div>
  );
}
