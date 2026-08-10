/**
 * @fileoverview **Ζ7 → ΠΡΟΤΑΣΕΙΣ** — «η φόρμα μικραίνει όσο δίνεις περισσότερα» (Α14 §17.2).
 * @related ADR-777 §7 (Α14 κανόνας 3 · Α9) · types/property-demand.ts (`DemandLifeContext`)
 * @module lib/demand/demand-life-presets
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΕΙΝΑΙ, ΚΑΙ ΤΙ ΡΗΤΑ ΔΕΝ ΕΙΝΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `DemandLifeContext` (Ζ7) **απορρίφθηκε ως άξονας ταιριάσματος**, με γραμμένο
 * επιχείρημα: είναι *«συμπίεση με απώλειες των άλλων τεσσάρων αξόνων»*, και ως
 * κριτήριο θα γεννούσε **δεύτερη αρχή** που απαντά «ταιριάζει;» — μία ρητή (τα πεδία)
 * και μία υπονοούμενη (η ετικέτα) — που θα διαφωνούσαν *«στην πρώτη οικογένεια που
 * θέλει γκαρσονιέρα»*.
 *
 * ✅ **Ο ένας από τους δύο επιτρεπτούς του ρόλους είναι αυτό το αρχείο**: ο **κανόνας
 * 3** της Α14 §17.2 — *«η φόρμα **μικραίνει** όσο δίνεις περισσότερα»*. Το πλαίσιο
 * ζωής **προτείνει** τιμές, ο άνθρωπος τις **βλέπει και τις αλλάζει**, και ό,τι μείνει
 * είναι **ρητό**.
 *
 * 🔑 **«Ρητό» σημαίνει ότι μετά την εφαρμογή ΔΕΝ υπάρχει κρυφή κατάσταση.** Δεν
 * αποθηκεύεται «η οικογένεια εννοεί 2 υπνοδωμάτια»· αποθηκεύεται `bedroomsMin: 2`. Αν
 * η πρόταση έμενε υπονοούμενη, το ταίριασμα θα εξαρτιόταν από ετικέτα — δηλαδή θα
 * ξαναγεννιόταν ακριβώς ο πέμπτος άξονας που το μοντέλο αρνήθηκε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΚΑΝΟΝΑΣ ΠΟΥ ΚΑΝΕΙ ΤΗΝ ΠΡΟΤΑΣΗ ΑΚΙΝΔΥΝΗ: **ΠΟΤΕ ΠΑΝΩ ΑΠΟ ΑΝΘΡΩΠΙΝΗ ΤΙΜΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το {@link applyLifePreset} γεμίζει **μόνο κενά**. Ένας άνθρωπος που έγραψε
 * «ως 250.000» και μετά διάλεξε «φοιτητής» **δεν** θα δει τον προϋπολογισμό του να
 * αλλάζει. Η εναλλακτική —πρόταση που γράφει από πάνω— είναι το κλασικό ελάττωμα των
 * «έξυπνων» φορμών: ο χρήστης χάνει δουλειά που έκανε, και **μαθαίνει να μην αγγίζει
 * τα χειριστήρια**. Και επιστρέφει **ποια** πεδία γέμισε, ώστε η οθόνη να τα δείχνει
 * ως προτάσεις — *«πρότεινε, δεν αποφάσισε»*.
 *
 * ⚠️ Οι τιμές είναι **παραδοχές αγοράς**, όχι φυσικοί νόμοι. Ζουν εδώ, **μία φορά**,
 * ώστε να αλλάζουν σε ένα σημείο και να είναι **δοκιμάσιμες**.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις πάνω σε τύπους.
 */

import { PROPERTY_TYPES, type PropertyTypeCanonical } from '@/constants/property-types';
import type { DemandLifeContext, DemandProximity } from '@/types/property-demand';
import type { DemandFormValues } from './demand-form-values';

// =============================================================================
// 1. ΟΙ ΑΠΟΣΤΑΣΕΙΣ — γιατί αυτοί οι αριθμοί
// =============================================================================

/**
 * **800 μέτρα** — το καθιερωμένο όριο «άνετου περπατήματος» του πολεοδομικού
 * σχεδιασμού (~10 λεπτά με 4,8 km/h). Χρησιμοποιείται για σχολείο και σούπερ μάρκετ:
 * προορισμοί που ο άνθρωπος επισκέπτεται **με πρόθεση**, όχι βιαστικά.
 */
export const COMFORTABLE_WALK_METRES = 800;

/**
 * **500 μέτρα** — στάση συγκοινωνίας. Μικρότερο **επίτηδες**: η στάση δεν είναι
 * προορισμός, είναι **φόρος** πάνω σε κάθε διαδρομή της ημέρας, και πληρώνεται
 * τέσσερις φορές την ημέρα.
 */
export const TRANSIT_STOP_METRES = 500;

// =============================================================================
// 2. ΤΙ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΠΡΟΤΕΙΝΕΙ ΕΝΑ ΠΛΑΙΣΙΟ ΖΩΗΣ
// =============================================================================

/**
 * Το **κλειστό** σύνολο πεδίων που μπορεί να αγγίξει μια πρόταση.
 *
 * 🔴 **Η ΤΙΜΗ ΔΕΝ ΕΙΝΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ Η ΣΗΜΑΝΤΙΚΟΤΕΡΗ ΑΠΟΥΣΙΑ ΤΟΥ ΑΡΧΕΙΟΥ.**
 * Θα ήταν το πρώτο πράγμα που θα «πρότεινε» μια αφελής υλοποίηση («φοιτητής ⇒ ως
 * 400 €»), και θα ήταν **λάθος για δύο ανεξάρτητους λόγους**: (α) ο προϋπολογισμός
 * είναι το **μόνο** πράγμα που ο άνθρωπος ξέρει καλύτερα από κάθε αλγόριθμο· (β) ένας
 * αριθμός που εμφανίζεται μόνος του σε πεδίο τιμής **αγκυρώνει** — τεκμηριωμένη
 * γνωστική μεροληψία — δηλαδή θα **διαμόρφωνε** τη ζήτηση αντί να την καταγράψει, και
 * ο θερμοχάρτης του **Ε2** θα μετρούσε τις δικές μας υποθέσεις.
 *
 * ⚠️ Ούτε ο **χώρος** και ο **χρόνος** προτείνονται: κανένα πλαίσιο ζωής δεν
 * υπονοεί πού ή πότε.
 */
export interface DemandLifeSuggestion {
  readonly bedroomsMin: number | null;
  readonly areaMin: number | null;
  readonly areaMax: number | null;
  readonly types: readonly PropertyTypeCanonical[];
  readonly proximity: readonly DemandProximity[];
}

/** Τα πεδία που μια πρόταση μπορεί να γεμίσει — για την οθόνη, ονομασμένα. */
export const SUGGESTIBLE_FIELDS = [
  'bedroomsMin',
  'areaMin',
  'areaMax',
  'types',
  'proximity',
] as const satisfies readonly (keyof DemandLifeSuggestion)[];

export type SuggestibleField = (typeof SUGGESTIBLE_FIELDS)[number];

// =============================================================================
// 3. ΟΙ ΤΡΕΙΣ ΠΡΟΤΑΣΕΙΣ
// =============================================================================

/** Κατοικίες όπου χωράει οικογένεια — από το SSoT των ειδών, ποτέ χειρόγραφη λίστα. */
const FAMILY_HOMES: readonly PropertyTypeCanonical[] = PROPERTY_TYPES.filter(
  (type): type is PropertyTypeCanonical =>
    type === 'apartment' ||
    type === 'maisonette' ||
    type === 'penthouse' ||
    type === 'detached_house' ||
    type === 'villa',
);

/** Μικρές κατοικίες — ένα άτομο, με ή χωρίς ξεχωριστό υπνοδωμάτιο. */
const COMPACT_HOMES: readonly PropertyTypeCanonical[] = PROPERTY_TYPES.filter(
  (type): type is PropertyTypeCanonical =>
    type === 'studio' || type === 'apartment_1br' || type === 'apartment' || type === 'loft',
);

/**
 * `Record<DemandLifeContext, …>` **επίτηδες**: κλειστό και στους δύο άξονες. Νέο
 * πλαίσιο ζωής **δεν μεταγλωττίζεται** χωρίς πρόταση — και μια ετικέτα που δεν
 * προτείνει τίποτα θα ήταν πεδίο **χωρίς καταναλωτή**, ακριβώς αυτό που το
 * `DemandLifeContext` αρνείται στην τιμή «άλλο».
 */
export const DEMAND_LIFE_PRESETS: Readonly<Record<DemandLifeContext, DemandLifeSuggestion>> = {
  family: {
    // ≥2 υπνοδωμάτια: το ελάχιστο για γονείς + παιδί, χωρίς να αποκλείει το τριάρι.
    bedroomsMin: 2,
    areaMin: 80,
    areaMax: null,
    types: FAMILY_HOMES,
    proximity: [
      { kind: 'school', maxMetres: COMFORTABLE_WALK_METRES },
      { kind: 'supermarket', maxMetres: COMFORTABLE_WALK_METRES },
    ],
  },
  workRelocation: {
    // Ένα υπνοδωμάτιο: μετακομίζει για δουλειά, θέλει να ξεχωρίζει ύπνο από ζωή.
    bedroomsMin: 1,
    areaMin: 35,
    areaMax: null,
    types: COMPACT_HOMES,
    proximity: [{ kind: 'busStop', maxMetres: TRANSIT_STOP_METRES }],
  },
  student: {
    // 🔑 `0`, **όχι `null`** — και η διαφορά είναι όλο το συμβόλαιο του `DemandFeatures`:
    // `0` σημαίνει «**δέξου και γκαρσονιέρα**», δηλαδή ρητή απάντηση· `null` θα σήμαινε
    // «δεν ρωτήθηκε». Ο φοιτητής **έχει** απαντήσει.
    bedroomsMin: 0,
    areaMin: null,
    areaMax: 60,
    types: COMPACT_HOMES,
    proximity: [{ kind: 'busStop', maxMetres: TRANSIT_STOP_METRES }],
  },
};

// =============================================================================
// 4. Η ΕΦΑΡΜΟΓΗ — γεμίζει κενά, ποτέ δεν γράφει από πάνω
// =============================================================================

/** Τι έγινε όταν εφαρμόστηκε η πρόταση. */
export interface LifePresetOutcome {
  readonly values: DemandFormValues;
  /**
   * Ποια πεδία **γέμισαν όντως**. Η οθόνη τα σημαίνει ως προτάσεις.
   *
   * ⚠️ Κενό σύνολο **δεν είναι σφάλμα**: σημαίνει ότι ο άνθρωπος τα είχε ήδη
   * απαντήσει όλα, και η πρόταση σεβάστηκε τη δουλειά του. Η οθόνη οφείλει να το
   * ξεχωρίζει από «δεν διάλεξε πλαίσιο ζωής».
   */
  readonly filled: readonly SuggestibleField[];
}

/** Είναι το πεδίο **κενό**; Το `0` και το κενό κείμενο **δεν** είναι το ίδιο με το `null`. */
function isUnanswered(value: number | string | null | undefined): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * **Πλαίσιο ζωής → γεμισμένα κενά.**
 *
 * 🔑 **Καθαρή συνάρτηση: επιστρέφει νέες τιμές, δεν μεταλλάσσει.** Ο καλών είναι μια
 * φόρμα `react-hook-form`, και μια μεταλλαγή στη θέση της θα ήταν αόρατη στο
 * `useForm` — δηλαδή η οθόνη θα έδειχνε παλιές τιμές και ο έλεγχος θα έκρινε νέες.
 */
export function applyLifePreset(
  values: DemandFormValues,
  lifeContext: DemandLifeContext,
): LifePresetOutcome {
  const preset = DEMAND_LIFE_PRESETS[lifeContext];
  const filled: SuggestibleField[] = [];
  const next: DemandFormValues = { ...values, lifeContext };

  if (isUnanswered(values.bedroomsMin) && preset.bedroomsMin !== null) {
    next.bedroomsMin = preset.bedroomsMin;
    filled.push('bedroomsMin');
  }
  if (isUnanswered(values.areaMin) && preset.areaMin !== null) {
    next.areaMin = preset.areaMin;
    filled.push('areaMin');
  }
  if (isUnanswered(values.areaMax) && preset.areaMax !== null) {
    next.areaMax = preset.areaMax;
    filled.push('areaMax');
  }
  // Πίνακες: «κενό» σημαίνει **μήκος 0**. Ένας άνθρωπος που διάλεξε έστω ένα είδος
  // έχει απαντήσει, και η πρόταση δεν έχει δικαίωμα να προσθέσει τα υπόλοιπα.
  if (values.types.length === 0 && preset.types.length > 0) {
    next.types = [...preset.types];
    filled.push('types');
  }
  if (values.proximity.length === 0 && preset.proximity.length > 0) {
    next.proximity = preset.proximity.map((requirement) => ({ ...requirement }));
    filled.push('proximity');
  }

  return { values: next, filled };
}
