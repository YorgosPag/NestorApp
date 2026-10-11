'use client';

import React from 'react';
import { X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { canvasUtilities } from '@/styles/design-tokens';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useIsTruncated } from '@/hooks/media/useIsTruncated';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DirtyFormProvider, useUnsavedEditsAnswer } from '@/providers/DirtyFormProvider';
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
  // `common-shared`, όχι `common-actions`: το ερώτημα βγαίνει μόνο σε πάτημα, άρα δεν χρεώνεται στο κέλυφος (ADR-744).
  const { t } = useTranslation('common-shared');
  const { confirm, dialogProps } = useConfirmDialog();
  // Τι δήλωσαν οι φόρμες του φύλλου (`useReportUnsavedEdits`)· `undefined` = καμία δεν ξέρει ⇒ ρωτάμε.
  const unsavedEdits = useUnsavedEditsAnswer();

  const leave = async () => {
    const editing = currentDismissal();
    if (!editing) return onClose();
    // Η ρητή δήλωση της ενέργειας υπερισχύει· αλλιώς απαντούν οι φόρμες.
    if ((editing.discards ?? unsavedEdits) !== false) {
      const discard = await confirm({
        title: t('discardChanges.title'),
        description: t('discardChanges.body'),
        confirmText: t('discardChanges.confirm'),
        cancelText: t('discardChanges.keep'),
        variant: 'destructive',
      });
      if (!discard) return;
    }
    // Ξανά από την πηγή: όσο ήταν ανοιχτή η ερώτηση η επεξεργασία μπορεί να τελείωσε (π.χ. ολοκληρώθηκε αποθήκευση).
    currentDismissal()?.onDismiss();
  };

  return { leave, dialogProps };
}

/**
 * 📱 **Το φύλλο λεπτομερειών του κινητού** — πλήρης οθόνη, μπάρα 48px (κλείσιμο · τίτλος · ενέργειες), περιεχόμενο.
 *
 * 🔑 Η μπάρα είναι **η** μπάρα ενεργειών της οντότητας (ADR-912 §12): κάθε `EntityDetailsHeader` που ζει στο
 *   περιεχόμενο αποδίδει τις ενέργειές του στη θυρίδα της, μέσω `details-sheet-actions`.
 */
export function MobileDetailsSlideIn({ isOpen, ...sheet }: MobileDetailsSlideInProps) {
  // Το ανοιχτό φύλλο είναι δικό του component: οι παρατηρητές του δένονται σε στοιχεία που υπάρχουν από το πρώτο render.
  // `DirtyFormProvider`: η εμβέλεια όπου οι φόρμες του φύλλου δηλώνουν αν έχουν αλλαγές — ο ✕ ρωτά ΑΥΤΗΝ (ADR-912 §12.5).
  return isOpen ? <DirtyFormProvider><OpenDetailsSheet {...sheet} /></DirtyFormProvider> : null;
}

function OpenDetailsSheet({ onClose, title, children }: Omit<MobileDetailsSlideInProps, 'isOpen'>) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('common-actions');
  // Κατάσταση και όχι ref: η κεφαλίδα πρέπει να ξαναζωγραφιστεί μόλις υπάρξει ο ξενιστής.
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const { ref: titleRef, truncated: titleTruncated } = useIsTruncated<HTMLHeadingElement>();
  const dismissal = useSheetDismissal();
  const { leave, dialogProps } = useSheetLeave(onClose, dismissal.current);
  const slot = React.useMemo<DetailsSheetActionsSlot>(
    () => ({ host, titleTruncated, claimDismissal: dismissal.claim }),
    [host, titleTruncated, dismissal.claim],
  );

  return (
    <div className={cn('md:hidden fixed inset-0 z-50 flex flex-col animate-in slide-in-from-right duration-300', colors.bg.primary)}>
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
          <h2 ref={titleRef} className="truncate text-sm font-medium">
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

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
