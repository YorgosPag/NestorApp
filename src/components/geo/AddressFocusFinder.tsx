'use client';

/**
 * **«Γράψε τη διεύθυνση» → ο χάρτης του επιλογέα κτιρίου πάει εκεί.**
 *
 * @related ADR-900 · hooks/geo/usePlaceResolver · components/geo/PlaceIdentityField (`focus` · `addressQuery`)
 * @module components/geo/AddressFocusFinder
 *
 * 🔑 **Δεν αποφασίζει τόπο — δίνει ΕΣΤΙΑΣΗ.** Ο τόπος (γη/κτίριο) τον βγάζει **μόνο** ο `PlaceChooser`, που με
 * `focus` + `addressQuery` κεντράρει τον χάρτη και **προσφέρει** τη διεύθυνση ως τόπο (ADR-332 D28) — ίδια σειρά με
 * τη φόρμα του κατόχου, όπου η διεύθυνση έρχεται **πριν** από το κτίριο. Ο γεωκωδικοποιητής είναι ο **ένας**
 * `usePlaceResolver`· οι λέξεις είναι **οι ίδιες** με τη φόρμα καταχώρισης (`offer.form.place*`).
 *
 * ⚠️ **Χωρίς `<form>`**: ζει μέσα στη φόρμα της σελίδας, και φωλιασμένη φόρμα είναι άκυρη HTML. Το Enter
 * εντοπίζει τη διεύθυνση — δεν υποβάλλει την εξωτερική φόρμα.
 *
 * ⚠️ **Αυτόνομο, όχι εξαγωγή από το `OwnerPropertyPlaceField`**: εκείνο είναι δεμένο στα πεδία της φόρμας
 * του κατόχου (σημείο + ακρίβεια **αποθηκεύονται**)· εδώ η απάντηση είναι εφήμερη εστίαση.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePlaceResolver, type ResolvedPlace } from '@/hooks/geo/usePlaceResolver';
import type { PlaceFocus } from '@/lib/geo/geocoding-focus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResolvedPlaceConfirmation } from './ResolvedPlaceConfirmation';

const K = 'property-market:offer.form';

/** Τι ξέρει ο επιλογέας μετά την αναζήτηση: πού να κοιτάξει, και τι έγραψε ο άνθρωπος. */
export interface AddressFocus {
  readonly focus: PlaceFocus;
  readonly query: string;
}

export function AddressFocusFinder({
  onFocus,
  initialQuery = null,
}: {
  /** `null` = η διεύθυνση άλλαξε ή καθαρίστηκε· η προηγούμενη εστίαση δεν ισχύει πια. */
  onFocus: (found: AddressFocus | null) => void;
  /**
   * ADR-900 §3.7 — διεύθυνση που ο άνθρωπος **ήδη** έγραψε σε άλλη πόρτα (αρχική). Το πεδίο ξεκινά γεμάτο
   * και εντοπίζεται **μία** φορά αυτόματα: να του ζητήσουμε να ξαναπατήσει «Εντοπισμός» για κάτι που μόλις
   * έγραψε θα ήταν δεύτερο βήμα χωρίς πληροφορία (Zillow «Sell»: η διεύθυνση της αρχικής ανοίγει έτοιμη).
   */
  initialQuery?: string | null;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const inputId = React.useId();
  const [query, setQuery] = React.useState(initialQuery ?? '');
  const [found, setFound] = React.useState<ResolvedPlace | null>(null);

  const { state, resolve, reset } = usePlaceResolver({
    onFound: React.useCallback((place: ResolvedPlace) => {
      setFound(place);
      onFocus({ focus: { point: { lat: place.lat, lng: place.lng }, accuracy: place.accuracy, extent: place.extent }, query });
    }, [onFocus, query]),
    onCleared: React.useCallback(() => {
      setFound(null);
      onFocus(null);
    }, [onFocus]),
  });

  // Μία φορά ανά τοποθέτηση — ο ref επιβιώνει τη διπλή εκτέλεση του StrictMode, άρα κανένα δεύτερο αίτημα
  // στο όριο ρυθμού του γεωκωδικοποιητή.
  const autoResolved = React.useRef(false);
  React.useEffect(() => {
    if (autoResolved.current || initialQuery === null || initialQuery.trim() === '') return;
    autoResolved.current = true;
    void resolve(initialQuery);
  }, [initialQuery, resolve]);

  const busy = state === 'resolving';
  const canResolve = !busy && query.trim() !== '';

  function changeQuery(next: string): void {
    setQuery(next);
    // Η εστίαση ανήκει στο ΠΡΟΗΓΟΥΜΕΝΟ κείμενο — μόλις αλλάξει, παύει να είναι αλήθεια.
    if (found !== null || state !== 'idle') {
      setFound(null);
      reset();
      onFocus(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm text-foreground">{t(`${K}.placeQueryLabel`)}</label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={inputId}
          type="search"
          value={query}
          placeholder={t(`${K}.placeQueryPlaceholder`)}
          disabled={busy}
          className="min-w-field flex-1"
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (canResolve) void resolve(query);
          }}
        />
        <Button type="button" variant="outline" disabled={!canResolve} onClick={() => void resolve(query)}>
          {busy ? t(`${K}.placeResolving`) : t(`${K}.placeResolve`)}
        </Button>
      </div>
      {found !== null && <ResolvedPlaceConfirmation place={found} />}
      {state === 'not-found' && <p className="text-sm text-foreground">{t(`${K}.placeNotFound`)}</p>}
      {state === 'error' && <p className="text-sm text-foreground">{t(`${K}.placeFailed`)}</p>}
    </div>
  );
}
