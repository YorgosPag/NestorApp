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
import type { GeoPoint } from '@/types/geo/coordinates';
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
 * 🔶 **ΔΗΛΩΜΕΝΟ ΚΕΝΟ, ΜΕ ΟΝΟΜΑ ΚΑΙ ΜΕ ΛΟΓΟ ΓΙΑ ΤΟ ΚΑΘΕΝΑ.**
 *
 * Το **μοντέλο** ({@link DemandPlace}) έχει **τέσσερις** μορφές. Η **φόρμα** προσφέρει
 * **δύο**, και η διαφορά **δεν** είναι παράλειψη — είναι άρνηση να γεννηθεί χειριστήριο
 * που **δεν μπορεί να χρησιμοποιηθεί**:
 *
 * | Μορφή | Γιατί όχι σήμερα |
 * |---|---|
 * | **Ζ3/Ζ5** `place` | Το **επίπεδο Α είναι άδειο** (`public_lands`/`public_buildings`, μετρημένο). Ένας επιλογέας κτιρίου θα άνοιγε **κενή λίστα** — φρουρός χωρίς απόδειξη ζωής (ADR-749 §5, 606 αδρανείς) |
 * | **Ζ4** `area` | Απαιτεί **επιφάνεια σχεδίασης**. Το σύστημα πολυγώνων υπάρχει, αλλά ζει στο `subapps/geo-canvas` — άλλο subapp, με **ανοιχτή δουλειά τρίτου** πάνω του (ADR-782). Μια βιαστική προσάρτηση εκεί θα ήταν ακριβώς η «μισή φόρμα» που το §2253 του ADR απαγορεύει |
 *
 * 🔑 **Και τα δύο ξεκλειδώνουν με ΔΕΔΟΜΕΝΑ/ΕΠΙΦΑΝΕΙΑ, όχι με αλλαγή μοντέλου.** Η
 * σειρά είναι γραμμένη στον χάρτη υλοποίησης: το επίπεδο Α έρχεται **μετά** από αυτή
 * την οθόνη και **ξεκλειδώνει** τη Ζ3/Ζ5. Όταν έρθει, αυτή η λίστα μεγαλώνει και
 * **ο μεταγλωττιστής δείχνει** κάθε σημείο που την υποθέτει.
 */
export const FORM_PLACE_KINDS = ['anywhere', 'near'] as const satisfies readonly DemandPlace['kind'][];

export type FormPlaceKind = (typeof FORM_PLACE_KINDS)[number];

/** Οι μορφές που **υπάρχουν στο μοντέλο** αλλά η φόρμα δεν συντάσσει. */
export const PLACE_KINDS_NOT_IN_FORM = ['area', 'place'] as const satisfies readonly DemandPlace['kind'][];

// =============================================================================
// 2. ΤΟ ΣΧΗΜΑ — zod, και **μόνο** σχήμα
// =============================================================================

/**
 * Αριθμός ή «δεν το έθεσε».
 *
 * ⚠️ **Το κενό πεδίο γίνεται `null`, ΠΟΤΕ `0`.** Είναι το ίδιο συμβόλαιο με το
 * {@link DemandFeatures}: *«αν το `floorMin` ήταν `0` για αδιάφορο, καμία ζήτηση δεν
 * θα μπορούσε να ζητήσει **ισόγειο**»*. Και ο `Number('')` είναι **0** — δηλαδή η
 * αφελής μετατροπή παράγει ακριβώς το λάθος που ο τύπος υπάρχει για να αποτρέψει.
 */
const optionalNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((raw) => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  });

/** Ημερομηνία ISO `YYYY-MM-DD` ή κενό. **Ποτέ `Date`** — βλ. {@link DemandTiming}. */
const isoDate = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/);

const geoPoint: z.ZodType<GeoPoint | null> = z
  .object({ lat: z.number(), lng: z.number() })
  .nullable();

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

/** Ο χωρικός άξονας — επίπεδα πεδία → διακριτή ένωση. */
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
  // 🔑 `near` **χωρίς λυμένο σημείο** πέφτει σε `anywhere`, και δεν είναι σιωπηλή
  // απώλεια: το κουμπί υποβολής είναι απενεργοποιημένο όσο η περιοχή δεν έχει λυθεί
  // (βλ. `demandFormBlockers`). Εδώ η επιστροφή είναι απλώς **ολική**.
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
  const window = demand.timing.kind === 'window' ? demand.timing : null;

  return {
    kind: 'editable',
    values: {
      seeks: [...demand.seeks],
      placeKind: near === null ? 'anywhere' : 'near',
      placeQuery: '',
      placeCenter: near?.center ?? null,
      radiusKm: near?.radiusKm ?? DEFAULT_SEARCH_RADIUS_KM,
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
  if (values.timingKind === 'window' && (values.fromDate === '' || values.toDate === '')) {
    found.push('window-incomplete');
  }

  return found;
}

/** Η ουδέτερη τιμή των χαρακτηριστικών, ξαναεξαγόμενη ώστε η φόρμα να μη την ξαναγράψει. */
export { NO_DEMAND_FEATURES };
