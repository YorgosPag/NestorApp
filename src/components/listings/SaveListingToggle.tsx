'use client';

/**
 * @fileoverview **Η ΚΑΡΔΙΑ** — «κράτα αυτή την αγγελία» (ADR-777 §8.74).
 * @related components/ui/toggle-button.tsx (ADR-770 §19) · SavedListingsProvider.tsx
 * @module components/listings/SaveListingToggle
 *
 * ♿ **Σταθερή ετικέτα, κατάσταση στο `aria-pressed`** (WAI-ARIA APG, Button pattern): ο αναγνώστης λέει
 * «Αποθήκευση αγγελίας, κουμπί εναλλαγής, πατημένο». Ετικέτα που γίνεται «Αποθηκευμένη» θα έλεγε την
 * κατάσταση **δύο φορές**, και θα άλλαζε το όνομα του στοιχείου κάτω από τον χρήστη.
 *
 * 🎨 Όχι νέο κουμπί: το `ToggleButton` της §19 φορά τον ρόλο «πατημένο» (γέμισμα ≥ 3:1 στα δύο θέματα).
 * Η καρδιά γεμίζει **και** το κουμπί αλλάζει γέμισμα — δύο κανάλια, όχι μόνο χρώμα (WCAG 1.4.1).
 */

import React from 'react';
import { Heart } from 'lucide-react';

import { ToggleButton } from '@/components/ui/toggle-button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import { useSavedListing } from './SavedListingsProvider';

export interface SaveListingToggleProps {
  readonly listingId: string;
  /** `icon` = γωνία κάρτας (μόνο καρδιά) · `labeled` = πλευρική στήλη λεπτομέρειας (καρδιά + λέξη). */
  readonly appearance: 'icon' | 'labeled';
  readonly className?: string;
}

export function SaveListingToggle({ listingId, appearance, className }: SaveListingToggleProps): React.ReactElement | null {
  const { t } = useTranslation(['common']);
  const heart = useSavedListing(listingId);
  if (heart === null) return null;

  const label = t('common:savedListing.label');
  return (
    <ToggleButton
      type="button"
      pressed={heart.saved}
      variant="outline"
      size={appearance === 'icon' ? 'icon' : 'default'}
      disabled={!heart.available}
      aria-label={appearance === 'icon' ? label : undefined}
      onClick={(event) => {
        // Η κάρτα είναι σύνδεσμος (`::after` του τίτλου): το κλικ της καρδιάς δεν ανοίγει την αγγελία.
        event.preventDefault();
        event.stopPropagation();
        heart.toggle();
      }}
      className={cn(appearance === 'icon' && 'rounded-full bg-background/90 shadow-sm', className)}
    >
      <Heart aria-hidden className={cn('size-4', heart.saved && 'fill-current')} />
      {appearance === 'labeled' && label}
    </ToggleButton>
  );
}
