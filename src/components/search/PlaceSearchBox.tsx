'use client';

/**
 * **Το κουτί της οθόνης 1** — *«πού ψάχνεις;»*, και για τους επαγγελματίες **«τι;» πρώτα**.
 *
 * @related ADR-777 Α3 *(η αρχική δέσμευση)* · ADR-841 §7 Α4.5 *(η ανατροπή)* ·
 *          SPEC-777-RESEARCH §25.8 (μικρο-δέσμευση) · lib/listings/listing-filters
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ «ΕΝΑ ΠΕΔΙΟ» ΕΙΝΑΙ ΙΔΙΟΤΗΤΑ ΤΟΥ **ΠΑΝΕΛ**, ΟΧΙ ΤΗΣ ΟΘΟΝΗΣ (Α4.5)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **ADR-777 Α3** έγραψε *«Οθόνη 1 — **ένα** κουτί … Desktop: **ένα πεδίο**»*, και ήταν
 * σωστό **για τον κόσμο στον οποίο γράφτηκε**: η οθόνη είχε τότε **μία** λειτουργία και
 * **κανέναν** διακόπτη, άρα ήταν ολόκληρη **μία** ερώτηση. Η **Α4** έφερε τέσσερις
 * λειτουργίες και η **Α4.3** τους έδωσε **πάνελ** ⇒ το πλήθος των ερωτήσεων έγινε
 * ιδιότητα **της ενεργής λειτουργίας**.
 *
 * | Λειτουργία | Πεδία | Γιατί |
 * |---|---|---|
 * | Αγορά · Ενοικίαση · Διαμονή | **1** *(τόπος)* | Η ADR-777 Α3 **παραμένει αληθής** εδώ |
 * | **Επαγγελματίες** | **2** *(**ειδικότητα** → τόπος)* | Ο κατάλογος έχει **δύο** άξονες, και ο **πρώτος** δεν είναι ο τόπος |
 *
 * 🏆 **Μετρημένο σε ζωντανό DOM, 2026-09-04** *(ADR-841 §7 Α4.5.3)*: το **xe.gr** έχει τον
 * **ίδιο** διακόπτη στην **ίδια** θέση, και δίνει **1 · 2 · 1 · 2 · 1** πεδία ανά tab. Το
 * ερώτημα *«πόσα πεδία;»* **δεν** απαντιέται μία φορά για όλη τη σελίδα — ούτε εκεί.
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
import {
  landingModeFilters,
  landingModeSeeksPeople,
  type LandingMode,
} from '@/lib/landing/landing-modes';
import {
  serializeShowcaseFilters,
  type OccupationOption,
} from '@/lib/agency/showcase-filter';
import { agencyDirectoryHref } from '@/components/mandate/agency-directory-route';
import { OccupationSelect } from '@/components/mandate/OccupationSelect';
import type { GeoPoint } from '@/types/geo/coordinates';
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
   * 🔴 **ΑΥΤΗ ΚΡΙΝΕΙ ΚΑΙ ΤΟΝ ΑΡΙΘΜΟ ΤΩΝ ΠΕΔΙΩΝ, ΟΧΙ ΜΟΝΟ ΤΟΝ ΠΡΟΟΡΙΣΜΟ (Α4.5).** Η
   * παλιά διατύπωση *(«το πεδίο μένει ένα — ADR-777 Α3»)* **αναιρέθηκε ρητά**: το
   * «ένα πεδίο» παραμένει αληθές για **Αγορά · Ενοικίαση · Διαμονή** και **παύει** να
   * ισχύει για τους **Επαγγελματίες**, που έχουν **δύο** άξονες.
   */
  readonly mode: LandingMode;
  /**
   * Οι ειδικότητες που **υπάρχουν** — από το `occupationOptions(agencies, locale)` της
   * σελίδας.
   *
   * ⚠️ **Δίνονται ΠΑΝΤΑ, χρησιμοποιούνται ΜΟΝΟ όταν η λειτουργία ψάχνει πρόσωπο.** Η
   * κρίση *«ψάχνει πρόσωπο;»* δεν ξαναγράφεται εδώ — τη ρωτά το SSoT της **Α5**
   * *({@link landingModeSeeksPeople})*.
   */
  readonly occupations: readonly OccupationOption[];
  /** Η γλώσσα των ετικετών — από το `showcaseLocale`, ποτέ γραμμένη στο χέρι. */
  readonly locale: 'el' | 'en';
}

/**
 * **Πού πάει ο επισκέπτης** — και **με τι** φτάνει εκεί.
 *
 * 🔴 **Η διακλάδωση είναι ΤΥΠΟΥ, όχι συνθήκης**: το {@link landingModeFilters}
 * επιστρέφει `null` **μόνο** για τους επαγγελματίες, γιατί η **Α5** το λέει ρητά —
 * *«οι επαγγελματίες δεν είναι τύπος αγγελίας»*. Ένα `if (mode === 'pros')` εδώ θα
 * ήταν **δεύτερη διατύπωση** του ίδιου κανόνα, ελεύθερη να αποκλίνει από το SSoT.
 *
 * ⚠️ **ΔΥΟ ΚΛΑΔΟΙ ΜΕ `return`, ΠΟΤΕ ternary**: ένα ternary ανάμεσα σε δύο διευθύνσεις
 * **φαρδαίνει τον τύπο σε `string`** *(`listing-routes.ts:71`)* και τυφλώνει τον φρουρό
 * του συνόρου *(CHECK 3.61)*. Κάθε κλάδος καλεί **τον δικό του** helper.
 *
 * ✅ **Η ΕΙΔΙΚΟΤΗΤΑ ΠΛΕΟΝ ΤΑΞΙΔΕΥΕΙ (Α4.5)** — η προηγούμενη γραφή έστελνε
 * `occupation: null` **επίτηδες**, γιατί η ρίζα δεν τη ρωτούσε. Τώρα τη ρωτά, και το
 * `serializeShowcaseFilters` την υποστήριζε **ήδη**: **καμία νέα μηχανή**.
 *
 * 🔴 **ΚΑΙ ΤΟ ΚΕΝΤΡΟ ΕΙΝΑΙ ΠΛΕΟΝ `null`-άβλε (Α4.5.δ)**: *«υδραυλικός **οπουδήποτε**»*
 * είναι νόμιμη ερώτηση μόλις υπάρξει δεύτερος άξονας. Το `landingModeFilters` δέχεται
 * ήδη `null` κέντρο· το `serializeShowcaseFilters` **δεν γράφει** κενά φίλτρα *(Φ2)*.
 */
function destinationFor(
  mode: LandingMode,
  center: GeoPoint | null,
  occupation: string | null,
) {
  const filters = landingModeFilters(mode, center);

  if (filters === null) {
    const params = serializeShowcaseFilters({
      occupation,
      near: center === null ? null : { center, radiusKm: DEFAULT_SEARCH_RADIUS_KM },
    });
    return agencyDirectoryHref(params.toString());
  }

  return searchResultsHref(serializeListingFilters(filters).toString());
}

export function PlaceSearchBox({ mode, occupations, locale }: PlaceSearchBoxProps) {
  const { t } = useTranslation(['search-results']);
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [chosenOccupation, setChosenOccupation] = useState<string | null>(null);

  // 🔴 **Η ΜΙΑ ΔΙΑΤΥΠΩΣΗ ΤΟΥ ΚΑΝΟΝΑ ΤΗΣ Α5** — ⛔ ποτέ `mode === 'pros'` εδώ: θα ήταν η
  //    **πέμπτη** εκδοχή του ίδιου κανόνα, ελεύθερη να αποκλίνει από τις άλλες τέσσερις.
  const asksOccupation = landingModeSeeksPeople(mode);

  // ⚠️ **Η ΕΠΙΛΟΓΗ ΤΟΥ ΑΝΘΡΩΠΟΥ ΝΙΚΑ, ΑΛΛΑ ΜΟΝΟ ΟΣΟ ΠΑΡΑΜΕΝΕΙ ΔΥΝΑΤΗ** — ίδιος κανόνας
  //    με το `chosen` του `SearchLandingContent` για τη λειτουργία, και για τον ίδιο
  //    λόγο: ο `usePublicAgencies` είναι **ζωντανή συνδρομή**, και μια ειδικότητα μπορεί
  //    να πάψει να υπάρχει όσο η σελίδα είναι ανοιχτή *(ο τελευταίος που τη δήλωνε
  //    αποσύρθηκε)*. Χωρίς αυτό, το `<Select>` θα κρατούσε τιμή **εκτός επιλογών** ⇒ ο
  //    πυροδότης θα ζωγράφιζε **κενό**, και η υποβολή θα έστελνε σε φίλτρο που δίνει μηδέν.
  const occupation =
    chosenOccupation !== null &&
    occupations.some((option) => option.escoUri === chosenOccupation)
      ? chosenOccupation
      : null;

  const trimmedQuery = query.trim();

  // 🔴 **ΥΠΟΒΑΛΛΕΙΣ ΟΤΑΝ ΕΧΕΙΣ ΔΗΛΩΣΕΙ ΕΣΤΩ ΕΝΑΝ ΑΞΟΝΑ (ADR-841 §7 Α4.5.δ).**
  //
  // Ήταν `query.trim() === ''`, και ήταν **σωστό** όσο ο τόπος ήταν η **μόνη** ερώτηση:
  // υποβολή χωρίς κανένα κριτήριο δεν είναι αναζήτηση. Με δύο άξονες παύει να είναι, και
  // το ελάττωμα έχει όνομα: *«υδραυλικός **οπουδήποτε**»* — ο άνθρωπος που ξέρει **τι**
  // θέλει και δεν τον νοιάζει το **πού**.
  //
  // ⚠️ **Και το «τίποτα-τίποτα» μένει νεκρό επίτηδες**: η πόρτα «Δες όλους τους
  //    επαγγελματίες» απαντά ήδη ακριβώς αυτό *(Α4.4.2)*. Δεύτερος δρόμος προς τον ίδιο
  //    προορισμό θα ήταν δύο κουμπιά που κάνουν το ίδιο, δίπλα-δίπλα.
  const canSubmit = trimmedQuery !== '' || occupation !== null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    // 🔑 **ΧΩΡΙΣ ΤΟΠΟ ΔΕΝ ΚΑΛΕΙΤΑΙ Ο ΓΕΩΚΩΔΙΚΟΠΟΙΗΤΗΣ** — και δεν είναι βελτιστοποίηση:
    //    μια κλήση με κενό κείμενο θα επέστρεφε `not-found`, και ο επισκέπτης θα διάβαζε
    //    *«δεν εντοπίσαμε αυτή την περιοχή»* για περιοχή **που δεν ζήτησε ποτέ**.
    if (trimmedQuery === '') {
      router.push(destinationFor(mode, null, occupation));
      return;
    }

    setState('searching');
    // ⚠️ **Ένας μεταφραστής για τα τρία σημεία** (2026-09-02): το «ελεύθερο κείμενο →
    // `city`» ήταν γραμμένο εδώ, στο `usePlaceResolver` και στο
    // `place-source-verification`. Δες `lib/geocoding/address-line-query`.
    const outcome = await geocodeAddressDetailed(addressLineToQuery(trimmedQuery));

    if (outcome.kind === 'found') {
      // Η οθόνη προορισμού διαβάζει **τη διεύθυνση**, ποτέ κατάσταση σε μνήμη.
      router.push(
        destinationFor(
          mode,
          { lat: outcome.result.lat, lng: outcome.result.lng },
          occupation,
        ),
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
      {/*
        🔴 **Η ΕΙΔΙΚΟΤΗΤΑ ΠΡΩΤΗ, Ο ΤΟΠΟΣ ΔΕΥΤΕΡΟΣ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΠΡΟΤΙΜΗΣΗ**
        *(ADR-841 §7 Α4.5.3)*. Πέντε πλατφόρμες διαβάστηκαν σε ζωντανό DOM την ίδια ώρα
        *(xe.gr «Επαγγελματίες» · vrisko.gr · Houzz · Thumbtack · Angi)*: **5 στις 5**
        ρωτούν **δύο** πεδία, και **5 στις 5** βάζουν την υπηρεσία **πρώτη**. Καμία δεν
        ρωτά μόνο τόπο· καμία δεν βάζει τον τόπο πρώτο.

        ⚠️ **`items-end` και `flex-wrap`**: τα δύο πεδία έχουν **ετικέτα από πάνω**, άρα
        διαφορετικό ύψος από το κουμπί — το `items-end` τα ευθυγραμμίζει στη **γραμμή
        βάσης της πράξης**. Σε στενή οθόνη σπάνε σε στήλη μόνα τους, χωρίς breakpoint.
      */}
      <div className="flex flex-wrap items-end gap-2">
        {/*
          ⚠️ **ΑΠΟΔΙΔΕΤΑΙ ΜΟΝΟ ΟΤΑΝ Η ΛΕΙΤΟΥΡΓΙΑ ΨΑΧΝΕΙ ΠΡΟΣΩΠΟ.** Οι τρεις λειτουργίες
          ακινήτων κρατούν **ένα** πεδίο — το ADR-777 Α3 παραμένει αληθές γι' αυτές.
        */}
        {asksOccupation && (
          <OccupationSelect
            value={occupation}
            options={occupations}
            locale={locale}
            onChange={setChosenOccupation}
          />
        )}

        <label htmlFor={inputId} className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">
            {t('search-results:landing.search.label')}
          </span>
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
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
          />
        </label>
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
          disabled={busy || !canSubmit}
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
