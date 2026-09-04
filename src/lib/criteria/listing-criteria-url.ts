/**
 * @fileoverview **ΔΙΕΥΘΥΝΣΗ ⇄ ΚΡΙΤΗΡΙΑ** — μία παράμετρος ανά άξονα, κανονική και κοινοποιήσιμη.
 * @related ADR-777 §7 (Α3) · ./listing-criterion-asking · ./listing-criterion-values
 * @module lib/criteria/listing-criteria-url
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΣΥΝΤΟΜΕΥΕΤΑΙ — ΚΑΙ ΤΟ ΕΡΩΤΗΜΑ ΤΕΘΗΚΕ ΡΗΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Με ~30 άξονες η διεύθυνση **γίνεται μακριά**, και η προφανής θεραπεία —συμπίεση
 * όλων σε ένα αδιαφανές `?q=<base64>`— **απορρίπτεται**, με τρεις λόγους:
 *
 * 1. 🔴 **Θα έσπαγε την εγγύηση που ήδη δίνει το `demandResultsHref`**: ο σύνδεσμος
 *    μιας ζήτησης είναι **ταυτόσημος** με ό,τι θα παρήγαγε ο άνθρωπος ρυθμίζοντας τα
 *    φίλτρα με το χέρι. Με αδιαφανές blob αυτό γίνεται αδύνατο να επαληθευτεί.
 * 2. **Ο άνθρωπος διορθώνει διευθύνσεις.** `?pmax=250000` αλλάζει με το χέρι· ένα
 *    blob όχι — και τότε κάθε μικροαλλαγή απαιτεί την οθόνη.
 * 3. **Μια αδιαφανής παράμετρος είναι έκδοση σχήματος υπό μεταμφίεση**: την ημέρα που
 *    αλλάξει η κωδικοποίηση, κάθε παλιός κοινοποιημένος σύνδεσμος πεθαίνει σιωπηλά.
 *
 * ✅ **Το πραγματικό πρόβλημα του μήκους δεν είναι ο άνθρωπος, είναι οι μηχανές
 * αναζήτησης** *(«index bloat», «crawl budget», «duplicate content» — η γνωστή
 * παθολογία της πλοηγικής με όψεις)*, και **δεν λύνεται εδώ**: λύνεται με `canonical`
 * προς τη βασική διεύθυνση, που είναι δουλειά της σελίδας. Δηλωμένο, ώστε να μη
 * «λυθεί» δεύτερη φορά με λάθος εργαλείο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΟΙ ΤΡΕΙΣ ΚΑΝΟΝΕΣ ΠΟΥ ΚΛΗΡΟΝΟΜΟΥΝΤΑΙ ΑΠΟ ΤΟ `listing-filters`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Άγνωστη τιμή αγνοείται** — ποτέ δεν σκάει η οθόνη.
 * 2. **Τα κενά δεν γράφονται** — αλλιώς δύο ταυτόσημες αναζητήσεις έχουν δύο διευθύνσεις.
 * 3. **`parse → serialize` κανονικοποιεί** — σκουπίδια πέφτουν στην πόρτα και δεν
 *    ταξιδεύουν στην επόμενη σελίδα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις πάνω σε `URLSearchParams`.
 */

import type { CriterionRange } from './criterion-vocabulary';
import {
  LISTING_CRITERION_ASKING,
  LISTING_CRITERION_KEYS,
  type CriterionKey,
  type FlagCriterionKey,
  type RangeCriterionKey,
  type ValueSetCriterionKey,
} from './listing-criterion-asking';
import { keepKnownValues } from './listing-criterion-values';
import {
  EMPTY_LISTING_CRITERIA,
  withFlag,
  withRange,
  withValues,
  type ListingCriteria,
} from './listing-criteria';

// =============================================================================
// 1. ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΠΑΡΑΜΕΤΡΩΝ
// =============================================================================

/**
 * **Το σύντομο όνομα κάθε άξονα στη διεύθυνση.**
 *
 * ⚠️ **`Record<CriterionKey, string>`** ⇒ νέος άξονας **δεν μεταγλωττίζεται** μέχρι να
 * πάρει όνομα. Και το όνομα είναι **δημόσιο συμβόλαιο**: ταξιδεύει σε κάθε
 * κοινοποιημένο σύνδεσμο και σε κάθε bookmark — αλλαγή εδώ **σπάει παλιούς
 * συνδέσμους**, και διαβάζεται ως τέτοια στο diff.
 *
 * 🔑 **Τα πέντε παλιά ονόματα διατηρήθηκαν αυτούσια** *(`type` · `offer` · `pmin`/`pmax`
 * · `amin`/`amax`)*: κάθε σύνδεσμος που έχει ήδη μοιραστεί εξακολουθεί να διαβάζεται.
 *
 * ⚠️ Τα αριθμητικά παίρνουν κατάληξη `min`/`max` — δες {@link rangeParams}. Ο έλεγχος
 * ότι **κανένα παραγόμενο όνομα δεν συγκρούεται** με άλλο ή με τις τρεις δεσμευμένες
 * παραμέτρους της γεωγραφίας/διαμονής είναι **άγκυρα**, όχι σχόλιο.
 */
export const CRITERION_PARAM: Record<CriterionKey, string> = {
  // ── αριθμητικοί ───────────────────────────────────────────────────────────
  price: 'p',
  areaSqm: 'a',
  floor: 'fl',
  bedrooms: 'beds',
  renovationYear: 'reno',
  bathrooms: 'bath',
  wc: 'wc',
  totalRooms: 'rooms',
  levels: 'lev',
  balconies: 'balc',
  netAreaSqm: 'na',
  balconyAreaSqm: 'ba',
  terraceAreaSqm: 'ta',
  gardenAreaSqm: 'ga',

  // ── λεξιλογίου ────────────────────────────────────────────────────────────
  type: 'type',
  offerKind: 'offer',
  energyClass: 'energy',
  condition: 'cond',
  heatingType: 'heat',
  heatingFuel: 'fuel',
  coolingType: 'cool',
  waterHeating: 'water',
  windowFrames: 'frames',
  glazing: 'glaz',
  flooring: 'floors',
  orientations: 'orient',
  interiorFeatures: 'feat',
  securityFeatures: 'sec',
  amenities: 'amen',
  authorship: 'by',

  // ── ναι/όχι ───────────────────────────────────────────────────────────────
  hasPhotos: 'photos',
};

/**
 * 🔴 **ΟΙ ΤΡΕΙΣ ΠΑΡΑΜΕΤΡΟΙ ΠΟΥ ΔΕΝ ΑΝΗΚΟΥΝ ΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ** — δηλωμένες εδώ ώστε
 * ο έλεγχος μοναδικότητας να τις **βλέπει**.
 *
 * Ανήκουν στους άξονες που μένουν εκτός του χάρτη κριτηρίων
 * *(`AXES_OUTSIDE_THE_CRITERIA_MAP`)*: γεωγραφία (`lat`/`lng`/`r`), παράθυρο διαμονής
 * (`in`/`out`) και χωρητικότητα (`guests`). Μια σύγκρουση μαζί τους θα ήταν αόρατη —
 * η μία πλευρά θα διάβαζε σκουπίδια της άλλης, **σιωπηλά**, σε κοινοποιημένο σύνδεσμο.
 */
export const RESERVED_SEARCH_PARAMS = ['lat', 'lng', 'r', 'in', 'out', 'guests'] as const;

/** Τα δύο άκρα ενός αριθμητικού άξονα στη διεύθυνση. */
export function rangeParams(key: RangeCriterionKey): { readonly min: string; readonly max: string } {
  const base = CRITERION_PARAM[key];
  return { min: `${base}min`, max: `${base}max` };
}

/**
 * **Παλιά ονόματα που εξακολουθούν να διαβάζονται** — ποτέ να γράφονται.
 *
 * 🔑 Το `beds` σήμαινε *«υπνοδωμάτια, τουλάχιστον»* όσο ο άξονας ήταν μονόπλευρος
 * (`bedroomsMin`). Τώρα που έγινε εύρος, το κανονικό όνομα είναι `bedsmin` — αλλά
 * **κάθε σύνδεσμος που μοιράστηκε ως τώρα λέει `beds`**, και ένας σύνδεσμος που παύει
 * σιωπηλά να φιλτράρει είναι χειρότερος από έναν που σπάει.
 *
 * ⚠️ **Μονής κατεύθυνσης, επίτηδες.** Η σειριοποίηση γράφει **μόνο** το κανονικό
 * όνομα: δύο ονόματα στη γραμμή θα σήμαιναν δύο διευθύνσεις για την ίδια ερώτηση.
 */
export const LEGACY_PARAM_ALIASES: Readonly<Record<string, string>> = {
  beds: 'bedsmin',
};

// =============================================================================
// 2. ΑΝΑΓΝΩΣΗ
// =============================================================================

/**
 * **Πεπερασμένος αριθμός, ή τίποτα.**
 *
 * 🔑 **Εξάγεται, και είναι ο ίδιος αναγνώστης που χρησιμοποιεί το `listing-filters`
 * για την ακτίνα και τα άτομα.** Δύο αντίγραφα θα ήταν τρεις γραμμές το καθένα — και
 * η πιθανότερη παραλλαγή τους (`Number(raw) || null`) θα έκανε το **`0` να γίνει
 * σιωπηλά `null`**, δηλαδή το «ισόγειο» και το «καμία απάντηση» θα ήταν το ίδιο πράγμα.
 *
 * ⚠️ `Number('')` είναι `0` και `Number('abc')` είναι `NaN` — και τα δύο θα γίνονταν
 * σιωπηλά «φίλτρο 0», που φιλτράρει τα πάντα. Η άρνηση είναι **ρητή**.
 */
export function readFiniteNumber(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Διαβάζει ένα άκρο, δοκιμάζοντας και το παλιό όνομα. */
function readBound(params: URLSearchParams, canonical: string): number | null {
  const direct = readFiniteNumber(params, canonical);
  if (direct !== null) return direct;
  for (const [legacy, target] of Object.entries(LEGACY_PARAM_ALIASES)) {
    if (target === canonical) {
      const aliased = readFiniteNumber(params, legacy);
      if (aliased !== null) return aliased;
    }
  }
  return null;
}

/**
 * **Η σημαία διαβάζεται με ΤΡΕΙΣ καταστάσεις, όχι δύο.**
 *
 * ⚠️ Απουσία ⇒ `undefined` *(«δεν με νοιάζει»)*. Παρουσία ⇒ `true`/`false`. Ένα
 * `params.has(key)` θα έκανε το «μόνο χωρίς φωτογραφίες» **ανέκφραστο**, και ένα
 * `Boolean(params.get(key))` θα διάβαζε το `?photos=0` ως… `true`, επειδή το `'0'`
 * είναι μη κενή συμβολοσειρά. Και τα δύο είναι σιωπηλά.
 */
function readFlag(params: URLSearchParams, key: string): boolean | undefined {
  const raw = params.get(key)?.trim();
  if (raw === undefined || raw === '') return undefined;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return undefined;
}

/**
 * **Διεύθυνση → κριτήρια.**
 *
 * 🔑 **Ο βρόχος τρέχει πάνω στον ΠΙΝΑΚΑ, όχι πάνω στις παραμέτρους της διεύθυνσης.**
 * Η αντίστροφη φορά *(«για κάθε παράμετρο, βρες τον άξονα»)* θα ήταν ανοιχτή σε ό,τι
 * γράψει ο κόσμος και θα απαιτούσε δεύτερο πίνακα *(όνομα → άξονας)* — δηλαδή δύο
 * λίστες που «συμφωνούν μεταξύ τους». Έτσι, ό,τι δεν είναι δηλωμένος άξονας
 * **αγνοείται εξ ορισμού**, χωρίς κανέναν έλεγχο.
 */
export function parseListingCriteria(params: URLSearchParams): ListingCriteria {
  let criteria = EMPTY_LISTING_CRITERIA;

  for (const key of LISTING_CRITERION_KEYS) {
    switch (LISTING_CRITERION_ASKING[key]) {
      case 'range': {
        const rangeKey = key as RangeCriterionKey;
        const { min, max } = rangeParams(rangeKey);
        criteria = withRange(criteria, rangeKey, {
          min: readBound(params, min),
          max: readBound(params, max),
        });
        break;
      }
      case 'flag': {
        const flagKey = key as FlagCriterionKey;
        criteria = withFlag(criteria, flagKey, readFlag(params, CRITERION_PARAM[key]));
        break;
      }
      default: {
        const valuesKey = key as ValueSetCriterionKey;
        criteria = withValues(
          criteria,
          valuesKey,
          keepKnownValues(valuesKey, params.getAll(CRITERION_PARAM[key]))
        );
        break;
      }
    }
  }

  return criteria;
}

// =============================================================================
// 3. ΓΡΑΨΙΜΟ
// =============================================================================

/**
 * **Κριτήρια → διεύθυνση**, γραμμένα μέσα στις παραμέτρους που δόθηκαν.
 *
 * 🔑 **Γράφει μέσα σε δοσμένο `URLSearchParams` αντί να επιστρέφει δικό του**, ώστε ο
 * `serializeListingFilters` να συνθέτει τους τρεις εκτός-χάρτη άξονες *(γεωγραφία,
 * παράθυρο, άτομα)* **χωρίς συγχώνευση** — μια δεύτερη πράξη συγχώνευσης θα ήταν η
 * θέση όπου κάποιος θα ξεχνούσε τα επαναλαμβανόμενα κλειδιά (`append` ⇄ `set`).
 *
 * ⚠️ **Η σειρά είναι η σειρά του πίνακα**, όχι του χάρτη: δύο ταυτόσημες αναζητήσεις
 * οφείλουν να παράγουν **χαρακτήρα προς χαρακτήρα** την ίδια διεύθυνση, αλλιώς μια
 * μηχανή αναζήτησης βλέπει δύο σελίδες με ταυτόσημο περιεχόμενο.
 */
export function writeListingCriteria(
  criteria: ListingCriteria,
  params: URLSearchParams
): void {
  for (const key of LISTING_CRITERION_KEYS) {
    const value = criteria[key];
    if (value === undefined) continue;

    switch (LISTING_CRITERION_ASKING[key]) {
      case 'range': {
        const { min, max } = rangeParams(key as RangeCriterionKey);
        const range = value as CriterionRange;
        if (range.min !== null) params.set(min, String(range.min));
        if (range.max !== null) params.set(max, String(range.max));
        break;
      }
      case 'flag':
        params.set(CRITERION_PARAM[key], (value as boolean) ? '1' : '0');
        break;
      default:
        // ⚠️ `append`, ΠΟΤΕ `set`: ο άξονας κρατά **πολλές** τιμές, και ένα `set` θα
        // κρατούσε σιωπηλά μόνο την τελευταία.
        for (const item of value as readonly string[]) {
          params.append(CRITERION_PARAM[key], item);
        }
        break;
    }
  }
}
