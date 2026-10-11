'use client';

import React from 'react';
import { X } from 'lucide-react';
import { canvasUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { DetailsSheetActionsProvider, type DetailsSheetActionsSlot } from './details-sheet-actions';

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
 */
const TITLE_YIELDS_TO_ACTIONS = '[&:has([data-entity-action])>h2]:max-w-[40%]';

/**
 * 📱 **Το φύλλο λεπτομερειών του κινητού** — πλήρης οθόνη, μπάρα 48px (κλείσιμο · τίτλος · ενέργειες), περιεχόμενο.
 *
 * 🔑 Η μπάρα είναι **η** μπάρα ενεργειών της οντότητας (ADR-912 §12): κάθε `EntityDetailsHeader` που ζει στο
 *   περιεχόμενο αποδίδει τις ενέργειές του στη θυρίδα της, μέσω `details-sheet-actions`.
 */
export function MobileDetailsSlideIn({
  isOpen,
  onClose,
  title,
  children
}: MobileDetailsSlideInProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('common-actions');
  // Κατάσταση και όχι ref: η κεφαλίδα πρέπει να ξαναζωγραφιστεί μόλις υπάρξει ο ξενιστής.
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const slot = React.useMemo<DetailsSheetActionsSlot>(() => ({ host }), [host]);
  if (!isOpen) return null;

  return (
    <div className={cn('md:hidden fixed inset-0 z-50 flex flex-col animate-in slide-in-from-right duration-300', colors.bg.primary)}>
      <div className={cn(canvasUtilities.geoInteractive.mobileSlideHeaderClass, TITLE_YIELDS_TO_ACTIONS, colors.bg.primary)}>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('actions.close')}
          className="-my-1.5 -ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
        >
          <X className={iconSizes.sm} />
        </button>

        <h2 className="min-w-0 truncate text-sm font-medium">
          {title}
        </h2>

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
