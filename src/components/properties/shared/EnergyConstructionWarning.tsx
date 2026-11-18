'use client';

/**
 * **Η υπενθύμιση του κύκλου ζωής στην ενεργειακή ενότητα** (ADR-777 §8.102 · §8.102.1) — σήμα «αυτόματα» με αναίρεση,
 * πρόταση ή προειδοποίηση· ποτέ μπλοκάρισμα.
 *
 * @related `lib/energy-certificate/energy-construction-notice.ts` (πότε υπενθυμίζεται τι — καθαρή συνάρτηση) ·
 *   `lib/energy-certificate/energy-lifecycle-follow.ts` (πότε η απάντηση βγαίνει αυτόματα) ·
 *   `./PlausibilityAlert.tsx` (η κοινή κάρτα προειδοποίησης) ·
 *   `features/property-details/components/PropertyFieldsDetailCards.tsx` (η φόρμα του γραφείου)
 *
 * 🔑 **Η αυτόματη απάντηση λέει πάντα ΟΤΙ είναι αυτόματη και ΓΙΑΤΙ** (Figma: η παράκαμψη φαίνεται και επαναφέρεται) — ο
 * άνθρωπος δεν ανακαλύπτει στον έλεγχο επιπτώσεων ότι κάτι άλλαξε χωρίς να το πει.
 *
 * ⚠️ **Ζει στη φόρμα του γραφείου, όχι στο κοινό `EnergyCertificateFields`**: εκείνο φορτώνεται και στη σελίδα του
 * ιδιώτη, και το `PlausibilityAlert` κάνει δυναμική `t(titleKey)` — το i18n slice της διαδρομής αρνήθηκε να εκπεμφθεί
 * (μετρημένο από τον γεννήτορα, 2026-11-17). Εξάλλου ο ιδιώτης δεν έχει «κατάσταση κατασκευής».
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EnergyConstructionNotice } from '@/lib/energy-certificate/energy-construction-notice';
import type { EnergyLifecycleFollow, EnergyLifecycleReason } from '@/lib/energy-certificate/energy-lifecycle-follow';

import { PlausibilityAlert } from './PlausibilityAlert';

/** Μία φράση ανά λόγο — ρητά κλειδιά, ώστε ο γεννήτορας του i18n slice να τα βλέπει. */
const FOLLOW_REASON_KEY: Readonly<Record<EnergyLifecycleReason, string>> = {
  'not-completed': 'properties-enums:energyCertificate.lifecycle.notCompleted',
  completed: 'properties-enums:energyCertificate.lifecycle.completed',
};

interface EnergyConstructionWarningProps {
  readonly notice: EnergyConstructionNotice | null;
  readonly follow: EnergyLifecycleFollow | null;
  readonly onUndo: () => void;
  readonly disabled: boolean;
}

export function EnergyConstructionWarning({ notice, follow, onUndo, disabled }: EnergyConstructionWarningProps) {
  const { t } = useTranslation(['properties-enums']);
  if (follow !== null) {
    return (
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground" role="status">
        <span>{t(FOLLOW_REASON_KEY[follow.reason])}</span>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onUndo} disabled={disabled}>
          {t('properties-enums:energyCertificate.lifecycle.undo')}
        </Button>
      </p>
    );
  }
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
