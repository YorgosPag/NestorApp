'use client';

/**
 * @fileoverview Η στιγμή φόρτωσης μιας καρτέλας του φακέλου ακινήτου — ένα μήνυμα, ίδιο για όλες.
 * @module components/property-dossier/dossier-tab-loading
 *
 * Χωριστό αρχείο επίτηδες (ADR-280 §11.8 Β4.3): είναι το `fallback` της επιφάνειας `PropertyDossierTab`, άρα το
 * εισάγει το μητρώο `dossier-surfaces.tsx`. Αν ζούσε στο `propertyDossierMappings.ts` (που εισάγει το μητρώο), θα
 * έκλεινε κύκλο (CHECK 3.80).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';

export function DossierTabLoading(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return <p className="m-0 p-4 text-sm text-muted-foreground">{t('property-market:dossier.tabs.loading')}</p>;
}
