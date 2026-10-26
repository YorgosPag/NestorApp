/**
 * **`/o/<χώρος>/catalog/settings` — κανάλια × γλώσσες** (ADR-923 §5.10.4 Β5).
 *
 * Λεπτή σελίδα: η ουσία ζει στο {@link SettingsContent}. Χωρίς `useSearchParams` ⇒ χωρίς `<Suspense>` επιλογής·
 * το κρατάμε για ομοιομορφία με τις αδελφές σελίδες και ως όριο της πρώτης φόρτωσης (CHECK 3.55).
 *
 * @module app/(app)/o/[workspace]/catalog/settings/page
 */

import React, { Suspense } from 'react';

import { SettingsContent } from '@/components/catalog/settings/SettingsContent';
import { StaticPageLoading } from '@/core/states';

export default function CatalogSettingsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <SettingsContent />
    </Suspense>
  );
}
