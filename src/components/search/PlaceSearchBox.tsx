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
import { useRouter } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { geocodeAddressDetailed } from '@/lib/geocoding/geocoding-service';
import { addressLineToQuery } from '@/lib/geocoding/address-line-query';
import {
  serializeListingFilters,
  DEFAULT_SEARCH_RADIUS_KM,
} from '@/lib/listings/listing-filters';
import { searchResultsHref } from '@/lib/listings/listing-routes';
import { landingModeFilters, type LandingMode } from '@/lib/landing/landing-modes';
import { serializeShowcaseFilters } from '@/lib/agency/showcase-filter';
import { agencyDirectoryHref } from '@/components/mandate/agency-directory-route';
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

interface PlaceSearchBoxProps {
  /**
   * **Ποια λειτουργία ρωτά** (ADR-841 §7 Α4).
   *
   * 🔑 Το πεδίο μένει **ένα** — το δεσμεύει αριθμητικά το **ADR-777 Α3** *(«Οθόνη 1:
   * ένα κουτί … Desktop: **ένα πεδίο**. Κινητό: **ίδιο**»)*. Αυτό που αλλάζει είναι ο
   * **προορισμός**: δες {@link destinationFor}.
   */
  readonly mode: LandingMode;
}

/**
 * **Πού πάει ο επισκέπτης** — η μία απόφαση που ο διακόπτης πραγματικά αλλάζει.
 *
 * 🔴 **Η διακλάδωση είναι ΤΥΠΟΥ, όχι συνθήκης**: το {@link landingModeFilters}
 * επιστρέφει `null` **μόνο** για τους επαγγελματίες, γιατί η **Α5** το λέει ρητά —
 * *«οι επαγγελματίες δεν είναι τύπος αγγελίας»*. Ένα `if (mode === 'pros')` εδώ θα
 * ήταν **δεύτερη διατύπωση** του ίδιου κανόνα, ελεύθερη να αποκλίνει από το SSoT.
 *
 * ⚠️ **Η ειδικότητα ΔΕΝ ταξιδεύει** *(`occupation: null`)*, και είναι απόφαση: η ρίζα
 * δεν τη ρωτά *(Α3 — ένα πεδίο)*, και το `/pro` χτίζει τις επιλογές του από τα **ίδια
 * τα προφίλ**. Μια αυθαίρετη τιμή εδώ θα φιλτράριζε τον κατάλογο **χωρίς ο επισκέπτης
 * να το έχει ζητήσει**.
 */
function destinationFor(mode: LandingMode, center: { lat: number; lng: number }) {
  const filters = landingModeFilters(mode, center);

  if (filters === null) {
    const params = serializeShowcaseFilters({
      occupation: null,
      near: { center, radiusKm: DEFAULT_SEARCH_RADIUS_KM },
    });
    return agencyDirectoryHref(params.toString());
  }

  return searchResultsHref(serializeListingFilters(filters).toString());
}

export function PlaceSearchBox({ mode }: PlaceSearchBoxProps) {
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
    // ⚠️ **Ένας μεταφραστής για τα τρία σημεία** (2026-09-02): το «ελεύθερο κείμενο →
    // `city`» ήταν γραμμένο εδώ, στο `usePlaceResolver` και στο
    // `place-source-verification`. Δες `lib/geocoding/address-line-query`.
    const outcome = await geocodeAddressDetailed(addressLineToQuery(trimmed));

    if (outcome.kind === 'found') {
      // Η οθόνη προορισμού διαβάζει **τη διεύθυνση**, ποτέ κατάσταση σε μνήμη.
      router.push(
        destinationFor(mode, { lat: outcome.result.lat, lng: outcome.result.lng }),
      );
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
        {/*
          🔴 **ΗΤΑΝ `bg-card` — ΔΗΛΑΔΗ ΤΟ ΧΡΩΜΑ ΤΟΥ ΠΕΔΙΟΥ ΤΟΥ** (ADR-777 §8.49 Φ4).
          Στο στιγμιότυπο της 2026-09-04 το κουμπί και το `<input>` δίπλα του
          διαβάζονταν ως **ένα** στοιχείο: και τα δύο σκούρα, με το ίδιο `border-border`,
          χωρίς κανένα σήμα «εδώ είναι η πράξη». Όσο η οθόνη ήταν κενή δεν φαινόταν· με
          τη βιτρίνα από κάτω, το κουτί απέκτησε **ανταγωνισμό** και το αόρατο κουμπί
          έγινε χαμένη αναζήτηση.

          🔑 **ΚΑΙ Η ΑΠΑΝΤΗΣΗ ΥΠΗΡΧΕ ΗΔΗ ΣΤΗΝ ΙΔΙΑ ΣΕΛΙΔΑ, ΣΤΗΝ ΚΕΦΑΛΙΔΑ ΑΠΟ ΠΑΝΩ**:
          το «Καταχώριση αγγελίας» (`PublicSiteHeader`) λύνει **το ίδιο ακριβώς**
          πρόβλημα με **αντιστροφή σε σημασιολογικά tokens** — και η αιτιολογία του
          ισχύει αυτούσια εδώ. ⛔ **ΜΗΝ βάλεις ωμό χρώμα** (σπάει 3.26/3.38/3.42) και
          ⛔ **ΜΗΝ βάλεις `bg-primary`**: σε **σκοτεινό** θέμα λύνεται `217 33% 17%`,
          **byte-ταυτόσημο με το `--card`** (ADR-682 §5.5 · ADR-770) — δηλαδή θα ήταν
          η ίδια αορατότητα με άλλο όνομα.

          🏆 Το ζεύγος `foreground`/`background` είναι το **μόνο** που εγγυάται τη
          μέγιστη αντίθεση **του κάθε θέματος** χωρίς να τη μετρήσει κανείς: σκούρο
          κουμπί σε φωτεινό θέμα, φωτεινό σε σκοτεινό, **από τον ορισμό των tokens**.
        */}
        <button
          type="submit"
          disabled={busy || query.trim() === ''}
          className="rounded-md bg-foreground px-4 py-2 font-semibold text-background disabled:opacity-50"
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
