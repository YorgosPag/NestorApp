/**
 * @fileoverview **ΟΙ ΤΕΣΣΕΡΙΣ ΛΟΓΙΣΤΙΚΕΣ ΤΗΣ ΟΘΟΝΗΣ 2** — *«πού;»* · *«πότε;»* ·
 * *«ταιριάζει;»* · *«είναι στην περιοχή που κοιτάω;»*.
 * @related ADR-777 §8.51 · §8.63 · §8.65 · ADR-835 §4.6
 * @module hooks/listings/useResultsLedgers
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ — Η ΚΟΠΗ ΕΙΝΑΙ **ΚΑΤΑ ΕΥΘΥΝΗ**, ΟΧΙ ΑΡΙΘΜΗΤΙΚΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `SearchResultsContent` κρατούσε **δύο** πράγματα: τη **διάταξη** *(τι ζωγραφίζεται
 * πού)* και τις **τέσσερις λογιστικές** *(τι απαντά η οθόνη για το σύνολο)*. Η δεύτερη
 * ευθύνη ήταν ήδη γραμμένη ως χωριστή μέσα στο ίδιο το αρχείο — η κεφαλίδα του δήλωνε
 * *«η λογιστική είναι πάνω από ΚΑΙ ΤΑ ΔΥΟ»*, και το `useMapAreaSearch` αιτιολογούσε τη
 * δική του εξαγωγή με τη φράση *«θα πρόσθετε ΤΡΙΤΗ ευθύνη σε ένα συστατικό που ήδη
 * κρατά τη διάταξη και τις τέσσερις λογιστικές»*.
 *
 * 🔑 **Το όριο των 500 γραμμών (N.7.1) ήταν ο ΧΡΟΝΟΣ της κοπής, όχι ο ΛΟΓΟΣ της.** Η
 * γραμμή περνά εκεί όπου περνούσε ήδη εννοιολογικά: εδώ ζει *«τι απαντώ για το
 * σύνολο»* — γνώση που αλλάζει όταν αλλάζει **η αριθμητική**· εκεί μένει *«τι δείχνω
 * και πού»* — γνώση που αλλάζει όταν αλλάζει **η διάταξη**.
 *
 * ⚠️ **ΤΑ ΕΝΔΙΑΜΕΣΑ ΣΥΝΟΛΑ ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΑΠΑΝΤΗΣΗΣ, ΟΧΙ ΛΕΠΤΟΜΕΡΕΙΑ ΥΛΟΠΟΙΗΣΗΣ.** Το
 * `withinScope` επιστρέφεται επειδή το ζητά **και** η μπάρα φίλτρων *(τα πλήθη ανά
 * επιλογή οφείλουν να σέβονται περιοχή και ημερομηνίες)*. Το `anywhere` **δεν**
 * επιστρέφεται: κανείς έξω από εδώ δεν το χρειάζεται, και ένας δεύτερος αναγνώστης του
 * θα ήταν δεύτερη ευκαιρία να το μπερδέψει με το `visible`.
 *
 * **Layering**: hook — καθαροί υπολογισμοί πάνω σε δεδομένα που του δίνονται.
 */

import { useMemo } from 'react';

import { askedCriterionKeys, EMPTY_LISTING_CRITERIA } from '@/lib/criteria/listing-criteria';
import type { ListingCriteriaLedger } from '@/lib/criteria/listing-criteria-judge';
import {
  applyListingFilters,
  computeListingCriteriaLedger,
  stayQueryOf,
  type ListingFilters,
} from '@/lib/listings/listing-filters';
import { computeAreaLedger, type ListingAreaLedger } from '@/lib/listings/listing-search-area';
import { computeStayLedger, type StayLedger } from '@/lib/listings/stay-ledger';
import { saleExposureOf, stayAvailabilityFor } from '@/lib/stay/stay-availability';
import type {
  StayAvailabilityAnswer,
  StayQuery,
} from '@/lib/stay/stay-availability-vocabulary';
import { useListingLedger } from '@/services/realtime/hooks/usePublicListings';
import type { ListingLedger, PublicListing } from '@/types/public-listing';

/** Ό,τι απαντά η οθόνη για το **σύνολο** — και τα δύο σύνολα που το στηρίζουν. */
export interface ResultsLedgers {
  /**
   * Ο κατάλογος **αφού** απαντηθούν οι άξονες εκτός κριτηρίων και **πριν** κριθούν τα
   * κριτήρια. Επιστρέφεται γιατί τον διαβάζει **και** η μπάρα φίλτρων.
   */
  readonly withinScope: readonly PublicListing[];
  /** *«πού;»* — η διαμέριση θέσης του `visible`. */
  readonly ledger: ListingLedger;
  /** *«πότε;»* — η διαμέριση χρόνου του **ίδιου** `visible`. */
  readonly stayLedger: StayLedger;
  /** Το χρονικό ερώτημα, ή `null` όταν κανείς δεν ρώτησε. */
  readonly stayQuery: StayQuery | null;
  /** *«ταιριάζει;»* — η διαμέριση κριτηρίων του `withinScope`. */
  readonly criteriaLedger: ListingCriteriaLedger;
  /** Ρώτησε κανείς κριτήριο; Η γραμμή τυπώνεται μόνο τότε. */
  readonly criteriaAsked: boolean;
  /** *«είναι στην περιοχή που κοιτάω;»* — η μόνη από τις τέσσερις που περιγράφει κόψιμο. */
  readonly areaLedger: ListingAreaLedger;
}

/**
 * @param listings ο **ωμός** κατάλογος όπως ήρθε από την ανάγνωση.
 * @param filters τα φίλτρα της διεύθυνσης, **κανονικοποιημένα**.
 * @param visible ο κατάλογος **μετά** από κάθε φίλτρο — αυτό που βλέπει ο άνθρωπος.
 */
export function useResultsLedgers(
  listings: readonly PublicListing[],
  filters: ListingFilters,
  visible: readonly PublicListing[]
): ResultsLedgers {
  /**
   * 🔴 **ΤΟ ΤΡΙΤΟ ΣΥΝΟΛΟ — ΚΑΙ ΧΩΡΙΣ ΑΥΤΟ Η ΛΟΓΙΣΤΙΚΗ ΚΡΙΤΗΡΙΩΝ ΕΙΝΑΙ ΨΕΥΔΗΣ**
   * (ADR-777 §8.51).
   *
   * Ο κατάλογος **αφού** απαντηθούν οι άξονες που ζουν **έξω** από τον χάρτη κριτηρίων
   * *(γεωγραφία · παράθυρο · άτομα)* και **πριν** κριθούν τα ίδια τα κριτήρια.
   *
   * ⚠️ **Η προφανής γραφή ήταν να μετρηθεί το `visible`, και θα ήταν ΔΟΜΙΚΑ ΤΥΦΛΗ**:
   * το `visible` έχει **ήδη πετάξει** τις αποκλεισμένες, άρα το `excluded` θα ήταν
   * **πάντα 0** — μια γραμμή που θα έγραφε *«8 ταιριάζουν · 0 δεν ταιριάζουν»* σε
   * **κάθε** αναζήτηση, για πάντα. Το ίδιο σχήμα με το *«`0` σημαίνει κανείς δεν
   * κοίταξε»* που το repo έχει πληρώσει τέσσερις φορές.
   *
   * ⚠️ **Ούτε ο ωμός `listings` όμως**: τότε το σύνολο θα περιλάμβανε ακίνητα εκτός της
   * περιοχής που διάλεξε ο άνθρωπος, και η γραμμή θα του χρέωνε ως *«δεν ταιριάζουν»*
   * σπίτια που **δεν ζήτησε ποτέ**.
   *
   * 🔑 **Ο ΙΔΙΟΣ φιλτραριστής, άλλη ερώτηση** — `applyListingFilters` με **κενά**
   * κριτήρια. Ένας δεύτερος γεωγραφικός έλεγχος εδώ θα ήταν δεύτερη αλήθεια για το
   * *«είναι μέσα στην ακτίνα;»*, δηλαδή ακριβώς ό,τι αποφεύγει το `listingMapShape`.
   */
  const withinScope = useMemo(
    () => applyListingFilters(listings, { ...filters, criteria: EMPTY_LISTING_CRITERIA }),
    [listings, filters]
  );

  /**
   * 🔴 **ΤΟ ΣΥΝΟΛΟ ΠΟΥ Η ΠΕΡΙΟΧΗ ΚΡΙΝΕΙ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΚΑΝΕΝΑ ΑΠΟ ΤΑ ΔΥΟ ΥΠΑΡΧΟΝΤΑ**
   * *(ADR-777 §8.63)*.
   *
   * Ο κατάλογος αφού απαντηθεί **κάθε άλλος** άξονας και **πριν** τη γεωγραφία.
   *
   * ⚠️ **Ούτε το `visible`**: εκείνο έχει **ήδη** πετάξει τις εκτός περιοχής, άρα το
   * `outside` θα ήταν **πάντα 0** — μια γραμμή που θα έγραφε *«0 εκτός περιοχής»* σε
   * κάθε αναζήτηση, για πάντα.
   * ⚠️ **Ούτε ο ωμός `listings`**: τότε θα χρεώναμε ως *«εκτός περιοχής»* σπίτια που
   * έφυγαν για την **τιμή** τους, και ο αριθμός θα κατηγορούσε τον χάρτη για δουλειά
   * που έκανε το φίλτρο.
   *
   * 🔑 **Ο ΙΔΙΟΣ φιλτραριστής, άλλη ερώτηση** — `near: null`. Ακριβώς το ιδίωμα του
   * `withinScope` από πάνω, στον συμπληρωματικό άξονα.
   *
   * 🔴 **ΚΑΙ ΑΠΟ ΤΟ §8.65 ΤΟ «ΠΑΝΤΟΥ» ΔΕΝ ΕΙΝΑΙ ΠΙΑ ΠΑΝΤΟΥ.** Μόλις το ερώτημα άρχισε
   * να κουβαλά την περιοχή, ο `listings` περιέχει **μόνο** ό,τι ζει μέσα στο ορθογώνιο
   * ανάγνωσης *(η περιοχή + 10 χλμ)*. Άρα ο κάδος `outside` μετρά πλέον **τον
   * δακτύλιο**, όχι τον κόσμο — δηλαδή θα έδινε αριθμό **μικρό, εύλογο και ψεύτικο**,
   * το χειρότερο είδος.
   *
   * ⇒ Η στήλη **δεν διορθώνεται, ΑΠΟΣΥΡΕΤΑΙ όταν δεν είναι γνωστή**: το `AreaLedgerBar`
   * παίρνει το `coverage` της ανάγνωσης και σιωπά για το «εκτός» όταν η ανάγνωση ήταν
   * γεωγραφικά φραγμένη. Η εναλλακτική *(«κράτα τον αριθμό, είναι σχεδόν σωστός»)*
   * είναι κατά λέξη το *«`0` σημαίνει κανείς δεν κοίταξε»* που το repo έχει πληρώσει
   * τέσσερις φορές.
   */
  const anywhere = useMemo(
    () => applyListingFilters(listings, { ...filters, near: null }),
    [listings, filters]
  );

  const areaLedger = useMemo(
    () => computeAreaLedger(anywhere, filters.near),
    [anywhere, filters.near]
  );

  /**
   * **«7 ταιριάζουν · 3 χωρίς δηλωμένα στοιχεία · 4 δεν ταιριάζουν».**
   *
   * 🔑 Το άθροισμα κλείνει στο `withinScope`, και υπάρχει **δεύτερος** έλεγχος που η
   * οθόνη μπορεί να κάνει μόνη της: `visible.length === matching + undeclared`. Είναι
   * η ίδια σχέση με το `ledgersAgree` της διαμονής — δύο διαμερίσεις που **οφείλουν**
   * να συμφωνούν, και φωνάζουν αν όχι.
   */
  const criteriaLedger = useMemo(
    () => computeListingCriteriaLedger(withinScope, filters),
    [withinScope, filters]
  );

  const criteriaAsked = useMemo(
    () => askedCriterionKeys(filters.criteria).length > 0,
    [filters]
  );

  const ledger = useListingLedger(visible);

  /**
   * 🔴 **Ο ΧΡΟΝΟΣ — ΚΑΙ ΤΟ ΣΥΝΟΡΟ ΤΟΥ §3.2, ΣΕ ΜΙΑ ΜΕΤΑΒΛΗΤΗ.**
   *
   * Ο κριτής κατάληψης χρειάζεται τις **κρατήσεις**, που είναι **ιδιωτικές**: ο
   * ανώνυμος επισκέπτης δεν επιτρέπεται να τις διαβάσει, και το ADR-835 §4.5
   * απαγορεύει ρητά να ταξιδέψει ημερολόγιο μέσα στο `PublicListing`. Άρα η
   * διαθεσιμότητα απαντιέται **στον διακομιστή**, και φτάνει εδώ ως **απάντηση**.
   *
   * ⚠️ **Ο διακομιστής είναι Φ5** — η συλλογή κρατήσεων δεν υπάρχει ακόμη. Ως τότε
   * το ημερολόγιο κάθε αγγελίας είναι **`undeclared`**, και η μηχανή απαντά
   * ειλικρινά `unknown`: *«κανείς δεν δήλωσε ημερολόγιο»*. Αυτό **δεν** είναι
   * προσωρινό ψέμα — είναι η **αλήθεια** για τα σημερινά δεδομένα, και η γραμμή
   * λογιστικής τη λέει με **αριθμό** αντί να δείξει άδεια λίστα.
   *
   * 🔑 Οι όροι διαμονής (`maxGuests`/`minNights`) και το `not-a-stay` απαντιούνται
   * **ήδη σωστά** από σήμερα: ζουν στο `PublicListing.stay`, όχι στο ημερολόγιο.
   */
  const stayQuery = useMemo(() => stayQueryOf(filters), [filters]);

  const stayLedger = useMemo(() => {
    // 🔴 **ΜΕΤΡΑ ΠΑΝΤΑ ΤΟ ΙΔΙΟ `visible`, ΑΚΟΜΗ ΚΑΙ ΧΩΡΙΣ ΕΡΩΤΗΣΗ.** Ένα κενό σύνολο
    //    εδώ θα έδινε `total: 0` ενώ η πρώτη διαμέριση μετρά **N** — και το
    //    `ledgersAgree` θα φώναζε **σωστά**, για λάθος λόγο. Χωρίς ερώτηση κάθε
    //    αγγελία είναι `unknown` (*«δεν ρωτήσαμε»*), και το άθροισμα κλείνει.
    const answerFor = (listing: PublicListing): StayAvailabilityAnswer | undefined =>
      stayQuery === null
        ? undefined
        : stayAvailabilityFor(listing, stayQuery, { kind: 'undeclared' }, saleExposureOf(listing));
    return computeStayLedger(visible, answerFor);
  }, [visible, stayQuery]);

  return {
    withinScope,
    ledger,
    stayLedger,
    stayQuery,
    criteriaLedger,
    criteriaAsked,
    areaLedger,
  };
}
