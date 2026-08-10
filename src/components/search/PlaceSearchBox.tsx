'use client';

/**
 * **Το ΕΝΑ κουτί της οθόνης 1** — *«πού ψάχνεις;»* (ADR-777 Α3).
 *
 * @related SPEC-777-RESEARCH §25.8 (μικρο-δέσμευση) · lib/listings/listing-filters
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΟ `GlobalSearchDialog` — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΔΙΠΛΟΤΥΠΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `components/search/GlobalSearchDialog` ρωτά *«ποιο **έγγραφο** ταιριάζει στη
 * λέξη;»* πάνω στο `search_documents`, που απαιτεί **σύνδεση** και είναι
 * **tenant-scoped** (`firestore.rules` → `isAuthenticated() && belongsToCompany`).
 * Εδώ ο επισκέπτης είναι **ανώνυμος** και το ερώτημα είναι *«πού στον χάρτη;»*.
 *
 * Δύο διαφορετικά ερωτήματα, δύο διαφορετικές πηγές, ένα από τα οποία είναι δομικά
 * απρόσιτο στον χρήστη αυτής της οθόνης. Επαναχρήση εκεί δεν θα ήταν κεντρικοποίηση —
 * θα ήταν το ίδιο λάθος με το «δύο απαντήσεις σε ένα ερώτημα», ανάποδα.
 *
 * ⚠️ **Καμία νέα μηχανή γεωκωδικοποίησης.** Καλείται το υπάρχον
 * `geocodeAddressDetailed` (`lib/geocoding/geocoding-service`), που ήδη κουβαλά
 * **cache + in-flight dedup** και επιστρέφει **διακριτή** ετυμηγορία — ώστε το «δεν
 * υπάρχει τέτοια περιοχή» να μη συγχέεται με «μας έκοψε ο ρυθμιστής», που είναι
 * ακριβώς η διάκριση για την οποία γράφτηκε (ADR-332 D11).
 */

import React, { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { geocodeAddressDetailed } from '@/lib/geocoding/geocoding-service';
import {
  serializeListingFilters,
  EMPTY_LISTING_FILTERS,
  DEFAULT_SEARCH_RADIUS_KM,
} from '@/lib/listings/listing-filters';
import { searchResultsHref } from '@/lib/listings/listing-routes';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('PlaceSearchBox');

/**
 * Οι τρεις καταστάσεις υποβολής — **ρητές**, ποτέ ένα `boolean` + ένα `string`.
 *
 * Το `not-found` και το `error` έχουν **διαφορετική θεραπεία** για τον επισκέπτη:
 * το πρώτο του λέει να ξαναγράψει, το δεύτερο να ξαναδοκιμάσει. Ένα κοινό «κάτι
 * πήγε στραβά» θα τον έστελνε να διορθώσει κείμενο που ήταν ήδη σωστό.
 */
type SubmitState = 'idle' | 'searching' | 'not-found' | 'error';

export function PlaceSearchBox() {
  const { t } = useTranslation(['search-results']);
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SubmitState>('idle');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed === '') return;

    setState('searching');
    // ⚠️ Ελεύθερο κείμενο → `city`: είναι ένα από τα τρία πεδία που δέχεται το route,
    // και η μηχανή δοκιμάζει **free-form πρώτα**, οπότε «Εγνατίας 147, Θεσσαλονίκη»
    // λύνεται το ίδιο καλά με σκέτο «Θεσσαλονίκη».
    const outcome = await geocodeAddressDetailed({ city: trimmed });

    if (outcome.kind === 'found') {
      const params = serializeListingFilters({
        ...EMPTY_LISTING_FILTERS,
        near: {
          center: { lat: outcome.result.lat, lng: outcome.result.lng },
          radiusKm: DEFAULT_SEARCH_RADIUS_KM,
        },
      });
      // Η οθόνη 2 διαβάζει **τη διεύθυνση**, ποτέ κατάσταση σε μνήμη.
      router.push(searchResultsHref(params.toString()));
      return;
    }

    if (outcome.kind === 'not-found') {
      setState('not-found');
      return;
    }

    logger.warn('Ο εντοπισμός περιοχής απέτυχε', { data: { reason: outcome.reason } });
    setState('error');
  }

  const busy = state === 'searching';

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
        {t('search-results:landing.search.label')}
      </label>

      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // Το μήνυμα αστοχίας αφορά το **προηγούμενο** κείμενο· μόλις ο επισκέπτης
            // αρχίσει να γράφει, παύει να είναι αλήθεια.
            if (state !== 'idle') setState('idle');
          }}
          placeholder={t('search-results:landing.search.placeholder')}
          disabled={busy}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy || query.trim() === ''}
          className="rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground disabled:opacity-50"
        >
          {t('search-results:landing.search.submit')}
        </button>
      </div>

      {/* Κάθε κατάσταση λέει ΤΟ ΔΙΚΟ ΤΗΣ — καμία δεν σιωπά, καμία δεν δανείζεται ξένο. */}
      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-muted-foreground">
        {state === 'searching' && t('search-results:landing.search.searching')}
        {state === 'not-found' && t('search-results:landing.search.notFound')}
        {state === 'error' && t('search-results:landing.search.failed')}
      </p>
    </form>
  );
}
