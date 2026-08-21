'use client';

/**
 * **Οι τέσσερις άξονες σε μία γραμμή** — η ζήτηση όπως τη διαβάζει άνθρωπος.
 *
 * @related ADR-777 §7 (Α9) · types/property-demand.ts
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
 * ⚠️ **Οι διακριτές ενώσεις κρίνονται με `switch` πάνω σε `kind`, ποτέ με
 * προαιρετικά πεδία.** Το μοντέλο φρόντισε ώστε *«η σύγκρουση να μη
 * μεταγλωττίζεται»*· μια περίληψη με `place.radiusKm ?? …` θα ξανάνοιγε ακριβώς την
 * πόρτα που ο τύπος έκλεισε.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { PROPERTY_TYPE_I18N_KEYS, type PropertyTypeCanonical } from '@/constants/property-types';
import type { DemandPlace, DemandTiming, PropertyDemand } from '@/types/property-demand';

/** Ο χωρικός άξονας ως φράση. */
function usePlacePhrase(): (place: DemandPlace) => string {
  const { t } = useTranslation(['property-market']);
  const K = 'property-market:demand.summary';

  return React.useCallback(
    (place) => {
      switch (place.kind) {
        case 'anywhere':
          return t(`${K}.anywhere`);
        case 'near':
          return t(`${K}.near`, { radiusKm: place.radiusKm });
        case 'area':
          return t(`${K}.area`);
        case 'place':
          return t(`${K}.place`);
      }
    },
    [t],
  );
}

/** Ο χρονικός άξονας ως φράση. */
function useTimingPhrase(): (timing: DemandTiming) => string {
  const { t } = useTranslation(['property-market']);
  const K = 'property-market:demand.summary';

  return React.useCallback(
    (timing) => {
      switch (timing.kind) {
        case 'now':
          return t(`${K}.now`);
        case 'window':
          return t(`${K}.window`, { fromDate: timing.fromDate, toDate: timing.toDate });
        case 'whenever':
          return t(`${K}.whenever`);
      }
    },
    [t],
  );
}

/**
 * Ο άξονας τιμής ως φράση — **τέσσερις** περιπτώσεις, όχι τρεις.
 *
 * ⚠️ Το «μόνο κατώτατο» (`priceMin` χωρίς `priceMax`) είναι **υπαρκτό αίτημα**
 * («τίποτα κάτω από Χ» — ο τύπος το επιτρέπει ρητά και εξηγεί γιατί). Μια περίληψη
 * που έδειχνε μόνο οροφή θα το εξαφάνιζε από την οθόνη ενώ θα **ίσχυε** στο
 * ταίριασμα — δηλαδή ο άνθρωπος θα έβλεπε αποτελέσματα φιλτραρισμένα από όρο που δεν
 * του λέμε ότι έθεσε.
 */
function usePricePhrase(): (features: PropertyDemand['features']) => string {
  const { t } = useTranslation(['property-market']);
  const K = 'property-market:demand.summary';
  const money = React.useCallback(
    (value: number) => formatCurrency(value, 'EUR', { maximumFractionDigits: 0 }),
    [],
  );

  return React.useCallback(
    ({ priceMin, priceMax }) => {
      if (priceMin !== null && priceMax !== null) {
        return t(`${K}.priceRange`, { priceMin: money(priceMin), priceMax: money(priceMax) });
      }
      if (priceMax !== null) return t(`${K}.priceUpTo`, { priceMax: money(priceMax) });
      if (priceMin !== null) return t(`${K}.priceFrom`, { priceMin: money(priceMin) });
      return t(`${K}.noPriceLimit`);
    },
    [t, money],
  );
}

/** Τα είδη ακινήτου — από το **SSoT ετικετών**, ποτέ χειρόγραφη λίστα. */
function useTypesPhrase(): (types: readonly string[]) => string {
  const { t } = useTranslation(['property-market', 'properties-enums']);

  return React.useCallback(
    (types) => {
      if (types.length === 0) return t('property-market:demand.summary.anyType');
      return types
        .map((type) => {
          const key = PROPERTY_TYPE_I18N_KEYS[type as PropertyTypeCanonical];
          // Άγνωστο είδος (παλιά εγγραφή Firestore) εμφανίζεται **ως έχει** αντί να
          // εξαφανιστεί: μια ζήτηση που φιλτράρει σε κάτι που δεν δείχνουμε είναι
          // χειρότερη από μια ετικέτα χωρίς μετάφραση.
          return key === undefined ? type : t(`properties-enums:${key}`);
        })
        .join(' · ');
    },
    [t],
  );
}

/** Η ζήτηση ως τέσσερις φράσεις. */
export function DemandSummary({ demand }: { demand: PropertyDemand }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const placeOf = usePlacePhrase();
  const timingOf = useTimingPhrase();
  const priceOf = usePricePhrase();
  const typesOf = useTypesPhrase();

  const rows: readonly (readonly [string, string])[] = [
    [t('property-market:demand.form.place.legend'), placeOf(demand.place)],
    [t('property-market:demand.form.timing.legend'), timingOf(demand.timing)],
    [t('property-market:demand.form.features.typesLabel'), typesOf(demand.features.types)],
    [t('property-market:demand.form.features.priceLegend'), priceOf(demand.features)],
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
