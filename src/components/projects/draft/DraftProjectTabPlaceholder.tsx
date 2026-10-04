'use client';

/**
 * Η καρτέλα ενός έργου που **δεν αποθηκεύτηκε ακόμη** («Fill then Create»).
 *
 * Οι καρτέλες που περιγράφουν **το ίδιο το έργο** («Γενικά», «Διευθύνσεις») γράφουν στο
 * πρόχειρο και αποθηκεύονται μαζί του. Οι υπόλοιπες δείχνουν **άλλες εγγραφές** που δένονται
 * στην ταυτότητά του (κτίρια, θέσεις στάθμευσης, επιμετρήσεις, αρχεία, …) — και ταυτότητα δεν
 * υπάρχει ακόμη. Αντί να ρωτήσουν τον διακομιστή για την ψευδο-ταυτότητα και να δείξουν
 * σφάλμα (περιστατικό 2026-10-04), λένε **τι λείπει και τι να κάνει ο άνθρωπος**.
 *
 * @module components/projects/draft/DraftProjectTabPlaceholder
 */

import React from 'react';
import { Save } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function DraftProjectTabPlaceholder() {
  const { t } = useTranslation('projects');

  return (
    <EmptyState
      icon={Save}
      title={t('draft.tabLockedTitle')}
      description={t('draft.tabLockedDescription')}
      size="lg"
    />
  );
}
