/**
 * @fileoverview **ΦΟΡΜΑ ⇄ ΖΗΤΗΣΗ** — η **μία** μετάφραση, με τις απώλειες ονομασμένες.
 * @related ADR-777 §7 (Α9 · Α14 §17.2) · SPEC-777B §12.2 · types/property-demand.ts
 * @module lib/demand/demand-form-values
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΦΟΡΜΑ ΔΕΝ ΕΧΕΙ ΤΟ ΣΧΗΜΑ ΤΗΣ ΟΝΤΟΤΗΤΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το {@link PropertyDemand} είναι φτιαγμένο ώστε **η σύγκρουση να μη μεταγλωττίζεται**:
 * `DemandPlace` και `DemandTiming` είναι **διακριτές ενώσεις**, οπότε ένα `outline`
 * δίπλα σε ένα `radiusKm` είναι **αδύνατο**. Ένα `<form>` όμως είναι **επίπεδο**: ο
 * άνθρωπος πληκτρολογεί ακτίνα, αλλάζει γνώμη, διαλέγει «οπουδήποτε», και η ακτίνα
 * **πρέπει** να παραμείνει στην οθόνη — αλλιώς χάνει ό,τι έγραψε σε κάθε δεύτερη
 * σκέψη.
 *
 * Άρα οι δύο μορφές είναι **σκόπιμα διαφορετικές**, και η μετάφραση ζει **εδώ, μία
 * φορά**. Γραμμένη μέσα στο component θα ήταν αόρατη στις δοκιμές και θα
 * ξαναγραφόταν στη σελίδα επεξεργασίας — δύο μεταφραστές για ένα λεξιλόγιο, το σχήμα
 * του **ADR-749**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ `zod` ΚΡΙΝΕΙ **ΣΧΗΜΑ**· ΤΟΥΣ **ΚΑΝΟΝΕΣ** ΤΟΥΣ ΚΡΙΝΕΙ Η ΟΝΤΟΤΗΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ήταν εύκολο —και λάθος— να γραφτεί το `demandInvariantViolations` ξανά ως αλυσίδα
 * `.refine()`. Το `types/property-demand.ts` **ήδη** κρίνει τα οκτώ invariants, τα
 * **ονομάζει**, και είναι η **ίδια** συνάρτηση που φρουρεί την πύλη γραφής. Ένα
 * δεύτερο σύνολο κανόνων σε zod θα ήταν **δεύτερη αρχή για το ίδιο ερώτημα**: θα
 * απέκλιναν στην πρώτη αλλαγή, και η φόρμα θα δεχόταν ζήτηση που η υπηρεσία αρνείται
 * — δηλαδή ο χρήστης θα έβλεπε «αποθηκεύεται…» και μετά αποτυχία **χωρίς πεδίο**.
 *
 * Ο καταμερισμός είναι απόλυτος:
 *
 * | Ερώτηση | Ποιος απαντά |
 * |---|---|
 * | «είναι αριθμός αυτό που πληκτρολόγησε;» | **zod** (σχήμα) |
 * | «είναι το εύρος αντεστραμμένο;» | **`demandInvariantViolations`** (κανόνας) |
 *
 * *(Και γι' αυτό δεν χρειάστηκε το `@hookform/resolvers`, που **δεν είναι
 * εγκατεστημένο**: ένας resolver είναι συνάρτηση, και η δική μας οφείλει ούτως ή
 * άλλως να καλέσει **δύο** κριτές. Μηδέν νέα εξάρτηση σε κοινό δέντρο.)*
 *
 * **Layering**: leaf — τύποι + καθαρές συναρτήσεις. Καμία εξάρτηση από React.
 */

import { z } from 'zod';
import { geoPointSchema, optionalNumberSchema } from '@/lib/forms/form-primitives';
import type { OfferKind } from '@/types/property-offers';
import { OFFER_KINDS } from '@/types/property-offers';
import {
  DEMAND_LIFE_CONTEXTS,
  DEMAND_PROXIMITY_KINDS,
  NO_DEMAND_FEATURES,
  type DemandFeatures,
  type DemandLifeContext,
  type DemandPlace,
  type DemandProximity,
  type DemandTiming,
  type PropertyDemand,
} from '@/types/property-demand';
import { DEFAULT_SEARCH_RADIUS_KM } from '@/lib/listings/listing-filters';

// =============================================================================
// 1. ΟΙ ΜΟΡΦΕΣ ΧΩΡΟΥ ΠΟΥ Η ΦΟΡΜΑ ΜΠΟΡΕΙ ΝΑ ΕΚΦΡΑΣΕΙ **ΣΗΜΕΡΑ**
// =============================================================================

/**
 * ✅ **ΤΟ ΚΕΝΟ ΕΚΛΕΙΣΕ** — και οι **τέσσερις** μορφές του {@link DemandPlace} συντάσσονται.
 *
 * Μέχρι τις 2026-08-11 εδώ ζούσαν **δύο** μορφές, με γραπτό λόγο για κάθε απουσία:
 *
 * | Μορφή | Γιατί έλειπε | Τι το ξεκλείδωσε |
 * |---|---|---|
 * | **Ζ3/Ζ5** `place` | *«το **επίπεδο Α είναι άδειο** … ένας επιλογέας κτιρίου θα άνοιγε **κενή λίστα**»* | ο **γραφέας** του επιπέδου Α: η ταυτότητα γεννιέται **κατ' απαίτηση**, άρα δεν υπάρχει λίστα να είναι κενή — ο άνθρωπος **δείχνει** και ο τόπος αποκτά ταυτότητα εκείνη τη στιγμή (§13.5) |
 * | **Ζ4** `area` | *«απαιτεί **επιφάνεια σχεδίασης** … ζει στο `subapps/geo-canvas`, με ανοιχτή δουλειά τρίτου (ADR-782)»* | η **δική μας** επιφάνεια (`components/geo/PlaceMap`), που χρειάστηκε ούτως ή άλλως για τη χειρονομία `drawn` του §13.6 — **μηδέν** νέα εξάρτηση, **καμία** επαφή με το ξένο subapp |
 *
 * 🔑 **Και τα δύο ξεκλείδωσαν με ΔΕΔΟΜΕΝΑ/ΕΠΙΦΑΝΕΙΑ, ακριβώς όπως προβλεπόταν** — το
 * μοντέλο δεν άλλαξε ούτε κατά ένα πεδίο. Η πρόβλεψη του Β1 («*αυτή η λίστα μεγαλώνει
 * και ο μεταγλωττιστής δείχνει κάθε σημείο που την υποθέτει*») επαληθεύτηκε κατά λέξη.
 */
export const FORM_PLACE_KINDS = [
  'anywhere',
  'near',
  'place',
  'area',
] as const satisfies readonly DemandPlace['kind'][];

export type FormPlaceKind = (typeof FORM_PLACE_KINDS)[number];

/**
 * Οι μορφές που **υπάρχουν στο μοντέλο** αλλά η φόρμα δεν συντάσσει.
 *
 * ✅ **Κενό από τις 2026-08-11.** Παραμένει ως **ρητή δήλωση** και δεν διαγράφεται: το
 * `satisfies` κρατά το κενό σύνολο **δεμένο** με το `DemandPlace['kind']`, οπότε μια
 * **πέμπτη** μορφή χώρου που θα προστεθεί αύριο έχει ήδη εδώ τη θέση της να δηλωθεί
 * ως «δεν συντάσσεται ακόμη» — αντί να προστεθεί σιωπηλά και να λείπει από την οθόνη
 * χωρίς κανείς να το πει. Ο έλεγχος ολότητας του `demand-form-values.test.ts` το
 * διαβάζει.
 */
export const PLACE_KINDS_NOT_IN_FORM = [] as const satisfies readonly DemandPlace['kind'][];

// =============================================================================
// 2. ΤΟ ΣΧΗΜΑ — zod, και **μόνο** σχήμα
// =============================================================================

/**
 * ⚠️ Το «αριθμός ή δεν το έθεσε» και το «σημείο ή δεν δείχτηκε» **δεν ζουν πια εδώ**:
 * είναι κοινά με τη φόρμα της προσφοράς (Α14) και το CHECK 3.28 τα ονόμασε ως κλώνο
 * μέσα στο ίδιο commit. Ζουν στο `@/lib/forms/form-primitives`, όπου γράφεται **μία**
 * φορά η απόφαση *«το κενό πεδίο γίνεται `null`, ΠΟΤΕ `0`»* — εδώ ο μάρτυράς της
 * είναι το `floorMin: 0` = **ισόγειο** ({@link DemandFeatures}).
 */
const optionalNumber = optionalNumberSchema;

/**
 * Ημερομηνία ISO `YYYY-MM-DD` ή κενό. **Ποτέ `Date`** — βλ. {@link DemandTiming}.
 *
 * Μένει **τοπικό** επίτηδες: έχει έναν καταναλωτή, και ένα πρωτόγονο με έναν
 * καταναλωτή δεν είναι κοινό λεξιλόγιο.
 */
const isoDate = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/);

const geoPoint = geoPointSchema;

/**
 * Το σχήμα της φόρμας. **Επίπεδο**, με διακριτές τιμές ως ετικέτες — όχι ενώσεις.
 *
 * 🔑 **Τα πεδία μένουν συμπληρωμένα ακόμη κι όταν η ετικέτα τα αγνοεί**, και αυτό
 * είναι το όλο νόημα: ο άνθρωπος που γράφει ακτίνα 5 χλμ., δοκιμάζει «οπουδήποτε»,
 * και γυρίζει πίσω, **βρίσκει το 5**. Μια φόρμα που σβήνει ό,τι δεν είναι ενεργό
 * τιμωρεί την εξερεύνηση — και η **Α14 §17.2** δεσμεύτηκε ρητά να μη γίνει φράγμα.
 */
export const demandFormSchema = z.object({
  seeks: z.array(z.enum(OFFER_KINDS as unknown as [OfferKind, ...OfferKind[]])),

  // ── ΧΩΡΟΣ ───────────────────────────────────────────────────────────────
  placeKind: z.enum(FORM_PLACE_KINDS),
  /** Το κείμενο που πληκτρολόγησε — κρατιέται για να ξαναδείχνεται, ποτέ δεν αποθηκεύεται. */
  placeQuery: z.string(),
  /** Το λυμένο σημείο. `null` = δεν έχει γεωκωδικοποιηθεί **ακόμη**. */
  placeCenter: geoPoint,
  radiusKm: optionalNumber,
  /**
   * **Ζ3/Ζ5** — η ταυτότητα του τόπου στο **επίπεδο Α**. `null` = δεν έχει δειχθεί ακόμη.
   *
   * ⚠️ Το κρατά η φόρμα ως **επίπεδο πεδίο** για τον ίδιο λόγο με την ακτίνα: ο
   * άνθρωπος που διάλεξε κτίριο, δοκίμασε «οπουδήποτε» και γύρισε πίσω **βρίσκει το
   * κτίριό του**. Η μετάφραση προς διακριτή ένωση γίνεται στο {@link placeFrom}.
   */
  placeRef: z
    .object({ landId: z.string(), buildingId: z.string().nullable() })
    .nullable(),
  /** **Ζ4** — το σχεδιασμένο περίγραμμα. `null` = δεν έχει σχεδιαστεί ακόμη. */
  placeOutline: z.array(z.object({ lat: z.number(), lng: z.number() })).nullable(),

  // ── ΧΡΟΝΟΣ ──────────────────────────────────────────────────────────────
  timingKind: z.enum(['now', 'window', 'whenever']),
  fromDate: isoDate,
  toDate: isoDate,

  // ── ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ ──────────────────────────────────────────────────────
  types: z.array(z.string()),
  priceMin: optionalNumber,
  priceMax: optionalNumber,
  areaMin: optionalNumber,
  areaMax: optionalNumber,
  bedroomsMin: optionalNumber,
  floorMin: optionalNumber,
  floorMax: optionalNumber,

  // ── ΓΕΙΤΟΝΙΑ ────────────────────────────────────────────────────────────
  proximity: z.array(
    z.object({
      kind: z.enum(DEMAND_PROXIMITY_KINDS),
      maxMetres: z.number(),
    }),
  ),

  // ── Ζ7 — δηλώνεται, ποτέ κριτήριο ──────────────────────────────────────
  lifeContext: z.enum(DEMAND_LIFE_CONTEXTS).nullable(),
});

export type DemandFormValues = z.input<typeof demandFormSchema>;
export type DemandFormParsed = z.output<typeof demandFormSchema>;

/**
 * Η **κενή** φόρμα.
 *
 * ⚠️ Η ακτίνα ξεκινά στο {@link DEFAULT_SEARCH_RADIUS_KM} — την **ίδια** σταθερά που
 * χρησιμοποιεί η οθόνη 1. Ένας δεύτερος αριθμός εδώ θα σήμαινε ότι «κοντά» σημαίνει
 * άλλο πράγμα ανάλογα με το από πού μπήκε ο χρήστης.
 */
export const EMPTY_DEMAND_FORM: DemandFormValues = {
  seeks: [],
  placeKind: 'anywhere',
  placeQuery: '',
  placeCenter: null,
  radiusKm: DEFAULT_SEARCH_RADIUS_KM,
  placeRef: null,
  placeOutline: null,
  timingKind: 'now',
  fromDate: '',
  toDate: '',
  types: [],
  priceMin: null,
  priceMax: null,
  areaMin: null,
  areaMax: null,
  bedroomsMin: null,
  floorMin: null,
  floorMax: null,
  proximity: [],
  lifeContext: null,
};

// =============================================================================
// 3. ΦΟΡΜΑ → ΖΗΤΗΣΗ
// =============================================================================

/**
 * Ό,τι η φόρμα μπορεί να πει για μια ζήτηση — **χωρίς** ταυτότητα, κάτοχο, ή χρόνο.
 *
 * 🔑 Ακριβώς οι πέντε άξονες + η Ζ7. Τα υπόλοιπα ({@link PropertyDemand.id} ·
 * `authorUserId` · `createdAt` …) τα γεννά η **υπηρεσία**, γιατί είναι γεγονότα του
 * συστήματος και όχι απαντήσεις του ανθρώπου — και μια φόρμα που τα παρήγαγε θα
 * μπορούσε να τα **στείλει λάθος**.
 */
export type DemandDraft = Pick<
  PropertyDemand,
  'seeks' | 'place' | 'timing' | 'features' | 'proximity' | 'lifeContext'
>;

/**
 * Ο χωρικός άξονας — επίπεδα πεδία → διακριτή ένωση.
 *
 * ⚠️ **Κάθε μορφή απαιτεί το δικό της συστατικό, και χωρίς αυτό πέφτει σε `anywhere`.**
 * Δεν είναι σιωπηλή απώλεια: η υποβολή είναι **φραγμένη** όσο λείπει (δες
 * {@link demandFormBlockers}) — εδώ η επιστροφή είναι απλώς **ολική**, γιατί μια
 * καθαρή συνάρτηση δεν επιτρέπεται να υποθέσει ότι κάποιος άλλος κοίταξε.
 */
function placeFrom(values: DemandFormParsed): DemandPlace {
  if (values.placeKind === 'near' && values.placeCenter !== null) {
    return {
      kind: 'near',
      center: values.placeCenter,
      // ⚠️ `?? DEFAULT` και **όχι** `?? 0`: το 0 είναι `radius-not-positive`, δηλαδή
      // η φόρμα θα απέρριπτε τον εαυτό της για πεδίο που ο χρήστης απλώς άδειασε.
      radiusKm: values.radiusKm ?? DEFAULT_SEARCH_RADIUS_KM,
    };
  }

  // **Ζ3/Ζ5** — δείχνει σε ταυτότητα του επιπέδου Α. Ο λόγος που το επίπεδο Α υπάρχει.
  if (values.placeKind === 'place' && values.placeRef !== null) {
    return {
      kind: 'place',
      landId: values.placeRef.landId,
      buildingId: values.placeRef.buildingId,
    };
  }

  // **Ζ4** — σχεδιασμένη περιοχή. Προέλευση **πάντα ανθρώπινη**, άρα επιτρέπεται σχήμα
  // (ODbL, §13.4): περίγραμμα αντλημένο από OSM **δεν** φτάνει ποτέ εδώ, γιατί ο
  // επιλογέας κτιρίου παράγει `placeRef`, όχι `placeOutline`.
  if (values.placeKind === 'area' && values.placeOutline !== null && values.placeOutline.length >= 3) {
    return { kind: 'area', outline: values.placeOutline };
  }

  return { kind: 'anywhere' };
}

/** Ο χρονικός άξονας. */
function timingFrom(values: DemandFormParsed): DemandTiming {
  if (values.timingKind === 'window') {
    return { kind: 'window', fromDate: values.fromDate, toDate: values.toDate };
  }
  return values.timingKind === 'whenever' ? { kind: 'whenever' } : { kind: 'now' };
}

/** Τα χαρακτηριστικά — ο **μόνος** άξονας που είναι σχεδόν ταυτότητα. */
function featuresFrom(values: DemandFormParsed): DemandFeatures {
  return {
    types: values.types,
    priceMax: values.priceMax,
    priceMin: values.priceMin,
    areaMin: values.areaMin,
    areaMax: values.areaMax,
    bedroomsMin: values.bedroomsMin,
    floorMin: values.floorMin,
    floorMax: values.floorMax,
  };
}

/** **Φόρμα → προσχέδιο ζήτησης.** Καθαρή, ολική. */
export function demandDraftFrom(values: DemandFormParsed): DemandDraft {
  return {
    seeks: values.seeks,
    place: placeFrom(values),
    timing: timingFrom(values),
    features: featuresFrom(values),
    proximity: values.proximity as readonly DemandProximity[],
    lifeContext: values.lifeContext,
  };
}

// =============================================================================
// 4. ΖΗΤΗΣΗ → ΦΟΡΜΑ (επεξεργασία)
// =============================================================================

/**
 * Τι έγινε όταν ζητήθηκε να ανοίξει υπάρχουσα ζήτηση για επεξεργασία.
 *
 * 🔴 **Δύο ρητές καταστάσεις, ποτέ `DemandFormValues | null`.** Το `null` θα σήμαινε
 * ταυτόχρονα «δεν φορτώθηκε» και «δεν υποστηρίζεται εδώ» — δύο πράγματα με **εντελώς
 * διαφορετική** θεραπεία για τον άνθρωπο: το πρώτο του λέει να ξαναδοκιμάσει, το
 * δεύτερο ότι η ζήτησή του είναι **μια χαρά** αλλά αυτή η οθόνη δεν τη συντάσσει
 * ακόμη. Ίδιο ιδίωμα με το `PublicListingLookup`.
 */
export type DemandFormLoad =
  | { readonly kind: 'editable'; readonly values: DemandFormValues }
  | { readonly kind: 'place-not-editable'; readonly placeKind: DemandPlace['kind'] };

/** **Ζήτηση → φόρμα**, ή ονομασμένη άρνηση. */
export function demandFormFrom(demand: PropertyDemand): DemandFormLoad {
  if (!(FORM_PLACE_KINDS as readonly string[]).includes(demand.place.kind)) {
    return { kind: 'place-not-editable', placeKind: demand.place.kind };
  }

  const near = demand.place.kind === 'near' ? demand.place : null;
  const identified = demand.place.kind === 'place' ? demand.place : null;
  const drawn = demand.place.kind === 'area' ? demand.place : null;
  const window = demand.timing.kind === 'window' ? demand.timing : null;

  return {
    kind: 'editable',
    values: {
      seeks: [...demand.seeks],
      // ⚠️ **Η μορφή διαβάζεται από την οντότητα, όχι συνάγεται από το τι είναι
      // γεμάτο.** Ένα `near === null ? 'anywhere' : 'near'` ήταν σωστό όσο υπήρχαν
      // δύο μορφές· με τέσσερις θα έστελνε κάθε Ζ3/Ζ5 και κάθε Ζ4 πίσω ως
      // «οπουδήποτε» — δηλαδή θα **έσβηνε τον τόπο** κάθε φορά που κάποιος άνοιγε τη
      // ζήτησή του για επεξεργασία.
      placeKind: demand.place.kind,
      placeQuery: '',
      placeCenter: near?.center ?? null,
      radiusKm: near?.radiusKm ?? DEFAULT_SEARCH_RADIUS_KM,
      placeRef:
        identified === null
          ? null
          : { landId: identified.landId, buildingId: identified.buildingId },
      placeOutline: drawn === null ? null : drawn.outline.map((vertex) => ({ ...vertex })),
      timingKind: demand.timing.kind,
      fromDate: window?.fromDate ?? '',
      toDate: window?.toDate ?? '',
      types: [...demand.features.types],
      priceMin: demand.features.priceMin,
      priceMax: demand.features.priceMax,
      areaMin: demand.features.areaMin,
      areaMax: demand.features.areaMax,
      bedroomsMin: demand.features.bedroomsMin,
      floorMin: demand.features.floorMin,
      floorMax: demand.features.floorMax,
      proximity: demand.proximity.map((p) => ({ ...p })),
      lifeContext: demand.lifeContext,
    },
  };
}

// =============================================================================
// 5. ΤΙ ΕΜΠΟΔΙΖΕΙ ΤΗΝ ΥΠΟΒΟΛΗ — πέρα από τα invariants της οντότητας
// =============================================================================

/**
 * Τα εμπόδια που είναι **της φόρμας**, όχι της οντότητας. Κλειστό σύνολο.
 *
 * ⚠️ **Δεν επικαλύπτονται με τα `DEMAND_INVARIANTS`, και ο διαχωρισμός είναι
 * σημασιολογικός**: εκείνα λένε «αυτή η ζήτηση δεν είναι έγκυρη ζήτηση»· αυτά λένε
 * «αυτή η φόρμα δεν έχει ακόμη αρκετά για να **φτιάξει** ζήτηση». Ένα κείμενο
 * περιοχής που δεν έχει λυθεί σε σημείο δεν είναι **άκυρη** ζήτηση — δεν είναι
 * ζήτηση **ακόμη**.
 */
export const DEMAND_FORM_BLOCKERS = [
  /** Διάλεξε «σε αυτή την περιοχή» αλλά η περιοχή δεν έχει λυθεί σε σημείο. */
  'place-unresolved',
  /**
   * **Ζ3/Ζ5** — διάλεξε «αυτό το κτίριο» αλλά **δεν έχει δείξει** ποιο.
   *
   * ⚠️ **Ξεχωριστό εμπόδιο από το `place-unresolved`, επίτηδες.** Εκείνο σημαίνει
   * «*το κείμενό σου δεν έγινε σημείο*» και θεραπεύεται με **ξαναγράψιμο**· αυτό
   * σημαίνει «*δεν έδειξες τόπο*» και θεραπεύεται με **κλικ στον χάρτη**. Κοινός
   * κωδικός θα έστελνε τον άνθρωπο να διορθώσει πεδίο που δεν υπάρχει στην οθόνη του.
   */
  'place-not-identified',
  /** **Ζ4** — διάλεξε «αυτή την περιοχή» αλλά το σχήμα δεν έχει τρεις κορυφές. */
  'area-not-drawn',
  /** Διάλεξε παράθυρο αλλά λείπει άκρο. */
  'window-incomplete',
] as const;

export type DemandFormBlocker = (typeof DEMAND_FORM_BLOCKERS)[number];

/** Τι λείπει **από τη φόρμα** για να μπορεί να συντεθεί ζήτηση. Όλα, ποτέ το πρώτο. */
export function demandFormBlockers(values: DemandFormParsed): DemandFormBlocker[] {
  const found: DemandFormBlocker[] = [];

  if (values.placeKind === 'near' && values.placeCenter === null) {
    found.push('place-unresolved');
  }
  if (values.placeKind === 'place' && values.placeRef === null) {
    found.push('place-not-identified');
  }
  if (values.placeKind === 'area' && (values.placeOutline === null || values.placeOutline.length < 3)) {
    found.push('area-not-drawn');
  }
  if (values.timingKind === 'window' && (values.fromDate === '' || values.toDate === '')) {
    found.push('window-incomplete');
  }

  return found;
}

/** Η ουδέτερη τιμή των χαρακτηριστικών, ξαναεξαγόμενη ώστε η φόρμα να μη την ξαναγράψει. */
export { NO_DEMAND_FEATURES };
