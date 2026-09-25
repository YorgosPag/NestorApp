'use client';

/**
 * **Οι τέσσερις άξονες σε μία γραμμή** — η ζήτηση όπως τη διαβάζει άνθρωπος.
 *
 * @related ADR-777 §7 (Α9) · ADR-886 · lib/demand/demand-phrases.ts · types/property-demand.ts
 * @module components/demand/DemandSummary
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ: **ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ, ΜΙΑ ΔΙΑΤΥΠΩΣΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Την ίδια περίληψη τη χρειάζονται ο **κατάλογος** («οι ζητήσεις μου») και η
 * **λεπτομέρεια**. Γραμμένη δύο φορές, θα απέκλινε στην πρώτη αλλαγή — και η
 * απόκλιση θα ήταν του χειρότερου είδους: ο άνθρωπος θα διάβαζε **δύο περιγραφές του
 * ίδιου αιτήματος** και θα αναρωτιόταν ποια ισχύει.
 *
 * 🔑 **ADR-886: οι φράσεις ζουν πλέον στο `lib/demand/demand-phrases.ts`** (καθαρές, χωρίς React),
 * γιατί τις χρειάζεται **και** το αυτόματο όνομα της ζήτησης. Εδώ μένει μόνο η διάταξη.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  demandPlacePhrase,
  demandPricePhrase,
  demandTimingPhrase,
  demandTypesPhrase,
} from '@/lib/demand/demand-phrases';
import type { PropertyDemand } from '@/types/property-demand';

/** Η ζήτηση ως τέσσερις φράσεις. */
export function DemandSummary({ demand }: { demand: PropertyDemand }): React.ReactElement {
  // Τα τρία namespaces των φράσεων: η ζήτηση, τα είδη ακινήτου, οι μονάδες τιμής (`common:priceAmount`).
  const { t } = useTranslation(['property-market', 'properties-enums', 'common']);

  const rows: readonly (readonly [string, string])[] = [
    [t('property-market:demand.form.place.legend'), demandPlacePhrase(t, demand.place)],
    [t('property-market:demand.form.timing.legend'), demandTimingPhrase(t, demand.timing)],
    [t('property-market:demand.form.features.typesLabel'), demandTypesPhrase(t, demand.features.types)],
    [t('property-market:demand.summary.priceLabel'), demandPricePhrase(t, demand.seeks)],
  ];

  return (
    <dl className="flex flex-col gap-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
