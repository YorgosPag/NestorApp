'use client';

/**
 * **Η υπενθύμιση του κύκλου ζωής στην ενεργειακή ενότητα** (ADR-777 §8.102) — πρόταση ή προειδοποίηση, ποτέ μπλοκάρισμα.
 *
 * @related `lib/energy-certificate/energy-construction-notice.ts` (πότε υπενθυμίζεται τι — καθαρή συνάρτηση) ·
 *   `./PlausibilityAlert.tsx` (η κοινή κάρτα προειδοποίησης) ·
 *   `features/property-details/components/PropertyFieldsDetailCards.tsx` (η φόρμα του γραφείου)
 *
 * ⚠️ **Ζει στη φόρμα του γραφείου, όχι στο κοινό `EnergyCertificateFields`**: εκείνο φορτώνεται και στη σελίδα του
 * ιδιώτη, και το `PlausibilityAlert` κάνει δυναμική `t(titleKey)` — το i18n slice της διαδρομής αρνήθηκε να εκπεμφθεί
 * (μετρημένο από τον γεννήτορα, 2026-11-17). Εξάλλου ο ιδιώτης δεν έχει «κατάσταση κατασκευής».
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EnergyConstructionNotice } from '@/lib/energy-certificate/energy-construction-notice';

import { PlausibilityAlert } from './PlausibilityAlert';

export function EnergyConstructionWarning({ notice }: { readonly notice: EnergyConstructionNotice | null }) {
  const { t } = useTranslation(['properties-enums']);
  if (notice === 'suggest-under-construction') {
    return (
      <p className="m-0 text-xs text-muted-foreground" role="status">
        {t('properties-enums:energyCertificate.projection.suggestion')}
      </p>
    );
  }
  if (notice === 'completed-without-certificate') {
    return (
      <PlausibilityAlert
        titleKey="properties-enums:energyCertificate.projection.completedTitle"
        reasonText={t('properties-enums:energyCertificate.projection.completed')}
        t={t}
      />
    );
  }
  return null;
}
