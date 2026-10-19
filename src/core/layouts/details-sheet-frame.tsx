'use client';
/**
 * @fileoverview **Το πλαίσιο του φύλλου λεπτομερειών** — μπάρα (✕ · τίτλος · ενέργειες) + περιεχόμενο, ανεξάρτητα από
 *   το **πού** παρουσιάζεται: πλήρης οθόνη στο κινητό (`MobileDetailsSlideIn`) ή πλευρικό panel δίπλα στο πλέγμα στο
 *   desktop (`DetailsPeekPanel`).
 * @related ADR-912 §12 · §12.19 · `details-sheet-actions.tsx` (η θυρίδα που γεμίζει η κεφαλίδα)
 * @module core/layouts/details-sheet-frame
 *
 * 🔑 **Μία μπάρα, δύο παρουσιάσεις.** Η Ακύρωση-ως-✕ (§12.5), η ερώτηση πριν χαθούν αλλαγές (§12.12) και η θυρίδα
 *   ενεργειών ζουν ΕΔΩ μία φορά· η παρουσίαση αποφασίζει μόνο το περίβλημα (modal ή όχι, portal ή όχι, πλάτος).
 */
import React from 'react';
import { X } from 'lucide-react';
import { canvasUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useIsTruncated } from '@/hooks/media/useIsTruncated';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useUnsavedEditsAnswer } from '@/providers/DirtyFormProvider';
import { confirmLeave, settledLeave } from '@/lib/unsaved-edits/leave-guard';
import { cn } from '@/lib/utils';
import {
  DetailsSheetActionsProvider,
  type DetailsSheetActionsSlot,
  type DetailsSheetDismissal,
} from './details-sheet-actions';

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
 * **Τι κάνει ο ✕** (και το Esc του peek): όσο τρέχει επεξεργασία ΕΙΝΑΙ η Ακύρωση (ADR-912 §12.5) — ρωτά πριν χαθούν
 * αλλαγές· αλλιώς κλείνει το φύλλο.
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

/** Ό,τι χρειάζεται το περίβλημα από το πλαίσιο: το `id` του τίτλου (για `aria-labelledby`) και την έξοδο (για Esc). */
export interface DetailsSheetSurface {
  readonly titleId: string;
  readonly leave: () => void;
}

interface DetailsSheetFrameProps {
  readonly onClose: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
  /** Το περίβλημα της παρουσίασης· λαμβάνει το σώμα (μπάρα + περιεχόμενο) έτοιμο. */
  readonly surface: (surface: DetailsSheetSurface, body: React.ReactNode) => React.ReactNode;
}

/**
 * ⚠️ Πρέπει να ζει **μέσα** σε `DirtyFormProvider`: ο ✕ ρωτά την εμβέλεια των φορμών του φύλλου (ADR-912 §12.5).
 *   Το εξασφαλίζουν οι δύο παρουσιάσεις — ο καλών δεν το βλέπει.
 */
export function DetailsSheetFrame({ onClose, title, children, surface }: DetailsSheetFrameProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('common-actions');
  // Κατάσταση και όχι ref: η κεφαλίδα πρέπει να ξαναζωγραφιστεί μόλις υπάρξει ο ξενιστής.
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const { ref: titleRef, truncated: titleTruncated } = useIsTruncated<HTMLHeadingElement>();
  const dismissal = useSheetDismissal();
  const leave = useSheetLeave(onClose, dismissal.current);
  const titleId = React.useId();
  const slot = React.useMemo<DetailsSheetActionsSlot>(
    () => ({ host, titleTruncated, claimDismissal: dismissal.claim }),
    [host, titleTruncated, dismissal.claim],
  );

  const body = (
    <>
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
    </>
  );

  return <>{surface({ titleId, leave }, body)}</>;
}
