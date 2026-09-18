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
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { normalizePropertyType } from '@/constants/property-type-aliases';
import {
  boundedPricedSeeks,
  isExchangeSeek,
  isShortStaySeek,
  isStayTermsSet,
  type DemandPlace,
  type DemandSeek,
  type DemandTiming,
  type PricedDemandSeek,
  type PropertyDemand,
} from '@/types/property-demand';
import { priceRoleOfSeek } from '@/lib/criteria/listing-criterion-reading';
import { resolvedPriceLabel } from '@/lib/listings/listing-price-label';
import { formatPercentage } from '@/lib/intl-formatting';
import { SEEK_KIND_I18N_KEYS } from './seek-kind-labels';

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
        case 'frontage':
          // 🔑 **ΔΥΟ ΚΛΕΙΔΙΑ, ΟΧΙ ΕΝΑ ΜΕ ΚΕΝΗ ΠΑΡΑΜΕΤΡΟ.** Το ICU `select` **δεν**
          // ξεχωρίζει το κενό string ως περίπτωση, οπότε ένα μοναδικό κλειδί θα
          // απαιτούσε από **εδώ** να χτίσει την ουρά «` (Μεγάλου Αλεξάνδρου)`» — δηλαδή
          // μορφοποίηση κειμένου μέσα σε `.tsx`, ακριβώς ό,τι απαγορεύει ο N.11. Με δύο
          // κλειδιά, **και οι δύο** προτάσεις είναι γραμματικά πλήρεις στο locale, σε
          // κάθε γλώσσα χωριστά (τα ελληνικά θέλουν γενική: «*της οδού*»).
          //
          // ⚠️ Το `side` ταξιδεύει **ωμό** (`'left'|'right'|'both'`): το `select` το
          // μεταφράζει **μέσα** στο locale. Περνώντας έτοιμη ελληνική λέξη, κανένα
          // `case` δεν θα ταίριαζε και η φράση θα έπεφτε σιωπηλά στο `other`.
          return place.streetName === null
            ? t(`${K}.frontage`, { side: place.side })
            : t(`${K}.frontageNamed`, { side: place.side, street: place.streetName });
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
 * Ο άξονας τιμής ως φράση — **ανά εναλλακτική, με τη μονάδα της** (ADR-777 §8.60.15).
 *
 * 🔴 Ως τις 2026-09-18 έγραφε «Έως 250.000 €» για ζήτηση «αγορά **ή** ενοικίαση» — ένα ποσό χωρίς
 * να λέει **σε ποια** συναλλαγή. Τώρα: «Αγορά: έως 250.000 € · Ενοικίαση: έως 900 €/μήνα». Η μονάδα
 * έρχεται από τον **ΕΝΑ** μορφοποιητή (`resolvedPriceLabel`), όχι από «€» γραμμένο στο locale.
 *
 * ⚠️ Το «μόνο κατώτατο» (`min` χωρίς `max`) είναι **υπαρκτό αίτημα** («τίποτα κάτω από Χ»): μια
 * περίληψη που έδειχνε μόνο οροφή θα το εξαφάνιζε από την οθόνη ενώ θα **ίσχυε** στο ταίριασμα.
 */
function usePricePhrase(): (seeks: readonly DemandSeek[]) => string {
  const { t } = useTranslation(['property-market', 'common']);
  const K = 'property-market:demand.summary';
  const stayPhrase = useStayTermsPhrase();

  const rangeOf = React.useCallback(
    (seek: PricedDemandSeek): string => {
      const role = priceRoleOfSeek(seek);
      const amount = (value: number) => resolvedPriceLabel(t, { role, amount: value });
      const { min, max } = seek.price;
      if (min !== null && max !== null) return t(`${K}.priceRange`, { priceMin: amount(min), priceMax: amount(max) });
      if (max !== null) return t(`${K}.priceUpTo`, { priceMax: amount(max) });
      if (min !== null) return t(`${K}.priceFrom`, { priceMin: amount(min) });
      return t(`${K}.noPriceLimit`);
    },
    [t],
  );

  return React.useCallback(
    (seeks) => {
      const parts = boundedPricedSeeks(seeks).map((seek) =>
        t(`${K}.seekPrice`, { kind: t(SEEK_KIND_I18N_KEYS[seek.kind]), range: rangeOf(seek) }),
      );
      // 🔑 ADR-777 §8.60.17 — η αντιπαροχή δεν έχει ποσό, έχει **οροφή ποσοστού οικοπεδούχου**.
      const shareMax = seeks.find(isExchangeSeek)?.landownerShareMax ?? null;
      if (shareMax !== null) {
        parts.push(t(`${K}.exchangeShare`, { share: formatPercentage(shareMax) }));
      }
      const stay = stayPhrase(seeks);
      if (stay !== null) parts.push(stay);
      return parts.length === 0 ? t(`${K}.noPriceLimit`) : parts.join(' · ');
    },
    [t, rangeOf, stayPhrase],
  );
}

/**
 * Οι **όροι διαμονής** ως φράση (ADR-777 §8.60.19) — «Διαμονή: 4–6 νύχτες, 2 ενήλικες, 1 βρέφος».
 * `null` όταν δεν ζητείται διαμονή ή δεν τέθηκε όρος. Μηδενικά παιδιά/βρέφη **δεν** λέγονται.
 */
function useStayTermsPhrase(): (seeks: readonly DemandSeek[]) => string | null {
  const { t } = useTranslation(['property-market', 'common']);
  const K = 'property-market:demand.summary';

  return React.useCallback(
    (seeks) => {
      const stay = seeks.find(isShortStaySeek);
      if (stay === undefined || !isStayTermsSet(stay)) return null;
      const { min, max } = stay.nights;
      const parts: string[] = [];
      if (min !== null && max !== null) parts.push(t(`${K}.stayNightsRange`, { min, max }));
      else if (min !== null) parts.push(t(`${K}.stayNightsFrom`, { min }));
      else if (max !== null) parts.push(t(`${K}.stayNightsUpTo`, { max }));
      const party = stay.party;
      if (party !== null) {
        parts.push(t(`${K}.stayAdults`, { count: party.adults }));
        if (party.children > 0) parts.push(t(`${K}.stayChildren`, { count: party.children }));
        if (party.infants > 0) parts.push(t(`${K}.stayInfants`, { count: party.infants }));
        // ADR-777 §8.60.21 — τα κατοικίδια είναι όρος της παρέας, όχι άτομα.
        if (party.pets > 0) parts.push(t(`${K}.stayPets`, { count: party.pets }));
      }
      return t(`${K}.stayTerms`, { kind: t(SEEK_KIND_I18N_KEYS.leaseShort), terms: parts.join(', ') });
    },
    [t],
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
          // 🔴 **ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ, ΟΧΙ ΙΣΧΥΡΙΣΜΟΣ** (ADR-842 §7.6.12 / §8 #11). Έγραφε
          //    `PROPERTY_TYPE_I18N_KEYS[type as PropertyTypeCanonical]` πάνω σε ωμό
          //    `string` της ζήτησης — δηλαδή **δεικτοδοτούσε πίνακα με ανεπίβεβαιο
          //    κλειδί** και βασιζόταν στο `undefined` για να το καταλάβει.
          //
          // 🔑 **Και κερδίζει σημασία, δεν χάνει**: μια παλαιά ελληνική τιμή
          //    (`'Στούντιο'`) εμφανιζόταν **αμετάφραστη**· τώρα λύνεται σε `studio` και
          //    ο άνθρωπος βλέπει τη σωστή ετικέτα στη γλώσσα του.
          const canonical = normalizePropertyType(type);
          // Πραγματικά άγνωστο είδος εμφανίζεται **ως έχει** αντί να εξαφανιστεί: μια
          // ζήτηση που φιλτράρει σε κάτι που δεν δείχνουμε είναι χειρότερη από μια
          // ετικέτα χωρίς μετάφραση.
          return canonical === null
            ? type
            : t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[canonical]}`);
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
    [t('property-market:demand.summary.priceLabel'), priceOf(demand.seeks)],
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
