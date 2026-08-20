/**
 * @fileoverview **ΦΟΡΜΑ ⇄ ΠΡΟΣΦΟΡΑ** — η **μία** μετάφραση, με τις απώλειες ονομασμένες.
 * @related ADR-777 §7 (Α14 §17.2 · Α20 · Α22) · types/owner-property.ts
 * @module lib/owner-property/owner-property-form-values
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΦΟΡΜΑ ΔΕΝ ΕΧΕΙ ΤΟ ΣΧΗΜΑ ΤΗΣ ΟΝΤΟΤΗΤΑΣ — ΔΥΟ ΦΟΡΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η {@link OwnerProperty} είναι φτιαγμένη ώστε **η σύγκρουση να μη μεταγλωττίζεται**:
 * το `place` είναι **διακριτή ένωση** (δηλωμένο ⇄ αρνήθηκε) και το `offers` **πίνακας
 * διακριτών ενώσεων**, όπου ένα `percentage` πάνω σε πώληση είναι **αδύνατο**.
 *
 * Ένα `<form>` όμως είναι **επίπεδο**, και το επίπεδο είναι εδώ **προϋπόθεση της
 * Α14 §17.2**, όχι συμβιβασμός:
 *
 * 1. Ο άνθρωπος τσεκάρει «πώληση», γράφει τιμή, μετά προσθέτει «ενοικίαση». Αν η
 *    φόρμα κρατούσε ένωση, η τιμή θα **χανόταν** στην αλλαγή — και η Α14 δεσμεύτηκε
 *    ρητά ότι η φόρμα **δεν γίνεται φράγμα**.
 * 2. Ο άνθρωπος πληκτρολογεί περιοχή, δοκιμάζει «δεν θέλω να το πω», γυρίζει πίσω:
 *    **βρίσκει ό,τι έγραψε**. Μια φόρμα που σβήνει ό,τι δεν είναι ενεργό **τιμωρεί
 *    την εξερεύνηση**.
 *
 * Άρα οι δύο μορφές είναι **σκόπιμα διαφορετικές**, και η μετάφραση ζει **εδώ, μία
 * φορά**. Γραμμένη μέσα στο component θα ήταν αόρατη στις δοκιμές και θα
 * ξαναγραφόταν στη σελίδα επεξεργασίας — **δύο μεταφραστές για ένα λεξιλόγιο**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ `zod` ΚΡΙΝΕΙ **ΣΧΗΜΑ**· ΤΟΥΣ **ΚΑΝΟΝΕΣ** ΤΟΥΣ ΚΡΙΝΕΙ Η ΟΝΤΟΤΗΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ερώτηση | Ποιος απαντά |
 * |---|---|
 * | «είναι αριθμός αυτό που πληκτρολόγησε;» | **zod** ({@link ownerPropertyFormSchema}) |
 * | «λείπει βήμα για να **φτιαχτεί** αγγελία;» | {@link ownerPropertyFormBlockers} |
 * | «είναι **έγκυρη** αγγελία;» | 🔴 **`ownerPropertyInvariantViolations`** — η **ίδια** συνάρτηση που φρουρεί την πύλη γραφής στον διακομιστή |
 *
 * *(Και γι' αυτό δεν χρειάστηκε το `@hookform/resolvers`, που **δεν είναι
 * εγκατεστημένο** και **δεν εγκαταστάθηκε**: το δέντρο μοιράζεται με άλλον agent και
 * ένα `npm install` αγγίζει `package.json` + lock. Μηδέν νέα εξάρτηση.)*
 *
 * **Layering**: leaf — τύποι + καθαρές συναρτήσεις. Καμία εξάρτηση από React.
 */

import { z } from 'zod';

import { geoPointSchema, optionalNumberSchema } from '@/lib/forms/form-primitives';
import { GEOCODING_ACCURACIES, type GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import { isLandPropertyType, PROPERTY_TYPES } from '@/constants/property-types';
import { OFFER_KINDS, type OfferKind, type PropertyOffer } from '@/types/property-offers';
import type {
  OwnerProperty,
  OwnerPropertyDraft,
  OwnerPropertyMedia,
  OwnerPropertyPlace,
} from '@/types/owner-property';

// =============================================================================
// 1. ΠΡΩΤΟΓΟΝΑ ΣΧΗΜΑΤΟΣ
// =============================================================================

/**
 * ⚠️ Το «αριθμός ή δεν το έθεσε» και το «σημείο ή δεν δείχτηκε» **δεν ζουν πια εδώ**:
 * είναι κοινά με τη φόρμα της ζήτησης (Α9) και το CHECK 3.28 τα ονόμασε ως κλώνο μέσα
 * στο ίδιο commit. Ζουν στο `@/lib/forms/form-primitives` — εδώ οι μάρτυρες της
 * απόφασης *«κενό ⇒ `null`, ΠΟΤΕ `0`»* είναι `floor: 0` = **ισόγειο** και
 * `bedrooms: 0` = **γκαρσονιέρα**.
 */
const optionalNumber = optionalNumberSchema;

const geoPoint = geoPointSchema;

/**
 * Οι δύο **έγκυρες απαντήσεις** στο ερώτημα της θέσης (Α5 §3).
 *
 * 🔑 **Η δεύτερη είναι απάντηση, όχι κενό** — γι' αυτό είναι τιμή κλειστού συνόλου
 * και όχι «άδειο πεδίο». *«Υποχρεωτικό ΕΡΩΤΗΜΑ, όχι υποχρεωτική ΑΠΑΝΤΗΣΗ.»*
 */
export const PLACE_ANSWERS = ['declared', 'declined'] as const;

export type PlaceAnswer = (typeof PLACE_ANSWERS)[number];

// =============================================================================
// 2. ΤΟ ΣΧΗΜΑ — επίπεδο, με ετικέτες αντί για ενώσεις
// =============================================================================

/**
 * Το σχήμα της φόρμας προσφοράς.
 *
 * 🔑 **Τα τρία ποσά ζουν ΔΙΠΛΑ-ΔΙΠΛΑ, όχι μέσα σε διαθέσεις** — και είναι ακριβώς
 * αυτό που κάνει τον κανόνα 3 της **Α14 §17.2** («*η φόρμα μικραίνει όσο δίνεις*»)
 * υλοποιήσιμο **χωρίς απώλεια**: η οθόνη ζωγραφίζει **μόνο** τα πεδία των ειδών που
 * τσέκαρε ο άνθρωπος, ενώ οι τιμές των υπολοίπων **μένουν** στη μνήμη της φόρμας.
 * Ξετσεκάρει «ενοικίαση», το ξανασκέφτεται, και το ενοίκιο είναι **ακόμη εκεί**.
 */
export const ownerPropertyFormSchema = z.object({
  // ── ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΑΓΓΕΛΙΑΣ ──────────────────────────────────────────────
  title: z.string(),

  // ── §25.6: ΕΙΔΟΣ + ΕΜΒΑΔΟΝ ──────────────────────────────────────────────
  type: z.string(),
  areaSqm: optionalNumber,

  // ── §25.6: +2 ΕΙΔΙΚΑ ────────────────────────────────────────────────────
  floor: optionalNumber,
  bedrooms: optionalNumber,

  // ── §25.6: ΔΙΑΘΕΣΕΙΣ + ΤΙΜΗ (Α20 · Α22) ─────────────────────────────────
  offerKinds: z.array(z.enum(OFFER_KINDS as unknown as [OfferKind, ...OfferKind[]])),
  askingPrice: optionalNumber,
  rentPrice: optionalNumber,
  exchangePercentage: optionalNumber,

  // ── §25.6: ΘΕΣΗ ─────────────────────────────────────────────────────────
  placeAnswer: z.enum(PLACE_ANSWERS),
  /** Το κείμενο που πληκτρολόγησε. **Αποθηκεύεται** ως `label` — δες {@link placeFrom}. */
  placeQuery: z.string(),
  /** Το λυμένο σημείο. `null` = δεν έχει γεωκωδικοποιηθεί **ακόμη**. */
  placePoint: geoPoint,
  /** Η ακρίβεια που ανέφερε ο γεωκωδικοποιητής. `null` ⇒ **χειροκίνητο** σημείο. */
  placeAccuracy: z.enum(GEOCODING_ACCURACIES as unknown as [GeocodingAccuracy, ...GeocodingAccuracy[]]).nullable(),
  /**
   * **Ο δεσμός προς το επίπεδο Α** — «το ακίνητό μου είναι ΣΕ ΑΥΤΟ το κτίριο».
   *
   * 🔑 Είναι το πεδίο που κάνει την προσφορά να συναντά τη ζήτηση (§14.5), και
   * μένει **προαιρετικό**: ο κάτοχος που δεν θέλει να δείξει κτίριο δημοσιεύει
   * κανονικά — *επιλογή, ποτέ προϋπόθεση* (ίδιος κανόνας με το τοπογραφικό, §21.4).
   */
  placeRef: z
    .object({ landId: z.string(), buildingId: z.string().nullable() })
    .nullable(),

  // ── §25.6: ΦΩΤΟΓΡΑΦΙΑ / ΚΑΤΟΨΗ ──────────────────────────────────────────
  /**
   * ⚠️ **Δεν είναι πεδίο εισόδου** — γεμίζει από το ανέβασμα, που συμβαίνει **πριν**
   * την υποβολή (τα bytes ταξιδεύουν στο Storage, όχι στο έγγραφο). Ζει στη φόρμα
   * ώστε η επεξεργασία να μη χάνει ό,τι ανέβηκε παλιότερα.
   */
  media: z.array(
    z.object({
      storagePath: z.string(),
      fileName: z.string(),
      sizeBytes: z.number(),
      uploadedAt: z.string(),
    }),
  ),
});

export type OwnerPropertyFormValues = z.input<typeof ownerPropertyFormSchema>;
export type OwnerPropertyFormParsed = z.output<typeof ownerPropertyFormSchema>;

/**
 * Η **κενή** φόρμα.
 *
 * ⚠️ **`placeAnswer: 'declared'` και όχι `'declined'`**, παρότι το δεύτερο θα ήταν
 * «ουδέτερο»: η **Α5 §4.3** ορίζει ότι *«το γέμισμα της θέσης είναι το **δόλωμα**,
 * ποτέ το φράγμα»*. Ξεκινώντας από την άρνηση θα λέγαμε στον άνθρωπο ότι η
 * προεπιλογή μας είναι να **μην** ξέρουμε πού είναι το ακίνητό του — και η ίδια η Α5
 * μετρά ότι οι αγγελίες χωρίς θέση λαμβάνουν λιγότερα μηνύματα.
 *
 * ⚠️ **`offerKinds: []` και όχι `['sell']`**: μια προεπιλεγμένη διάθεση θα **αγκύρωνε**
 * — ίδιο σκεπτικό με το *«η ΤΙΜΗ δεν προτείνεται ποτέ»* της Α9 (§8.15.6). Το τι κάνει
 * ο άνθρωπος με το ακίνητό του είναι **η ερώτηση**, όχι κάτι που μαντεύουμε.
 */
export const EMPTY_OWNER_PROPERTY_FORM: OwnerPropertyFormValues = {
  title: '',
  type: '',
  areaSqm: null,
  floor: null,
  bedrooms: null,
  offerKinds: [],
  askingPrice: null,
  rentPrice: null,
  exchangePercentage: null,
  placeAnswer: 'declared',
  placeQuery: '',
  placePoint: null,
  placeAccuracy: null,
  placeRef: null,
  media: [],
};

// =============================================================================
// 3. ΦΟΡΜΑ → ΠΡΟΣΦΟΡΑ
// =============================================================================

/**
 * Πώς αποκτά **ταυτότητα** μια διάθεση.
 *
 * 🔴 **Η ταυτότητα ΔΕΝ γεννιέται εδώ, και δεν είναι λεπτομέρεια.** Η **Α20 σημείο 4**
 * στηρίζεται πάνω της: *«το κλείσιμο μιας διάθεσης **αποσύρει τις άλλες**»* — χωρίς
 * σταθερή ταυτότητα, το «οι άλλες» **δεν έχει υποκείμενο**. Άρα σε **επεξεργασία** η
 * υπάρχουσα διάθεση ίδιου είδους κρατά το `offr_*` της, και **μόνο** τα καινούργια
 * είδη παίρνουν νέο.
 *
 * ⚠️ **Εγχεόμενο, όχι εισαγόμενο** ({@link enterpriseIdService}): αλλιώς αυτή η
 * καθαρή μετάφραση θα γινόταν μη ντετερμινιστική και **αδοκίμαστη** — κάθε test θα
 * σύγκρινε τυχαίες συμβολοσειρές.
 */
export interface OfferIdentitySource {
  /** Οι διαθέσεις που **υπάρχουν ήδη** (κενό στη δημιουργία). */
  readonly previous: readonly PropertyOffer[];
  /** Γεννήτρια νέας ταυτότητας διάθεσης (`offr_*`). */
  readonly mintOfferId: () => string;
}

/** Η ταυτότητα της διάθεσης αυτού του είδους — **υπάρχουσα** ή νέα. */
function offerIdFor(kind: OfferKind, source: OfferIdentitySource): string {
  const existing = source.previous.find((offer) => offer.kind === kind);
  return existing?.id ?? source.mintOfferId();
}

/**
 * Τα ποσά της φόρμας → **μία διάθεση**, με τον τύπο να επιβάλλει ποιο ποσό ταιριάζει.
 *
 * ⚠️ **`switch` χωρίς `default`**: τέταρτο είδος διάθεσης **δεν μεταγλωττίζεται**
 * μέχρι κάποιος να δηλώσει ποιο πεδίο της φόρμας το τροφοδοτεί. Ένα σιωπηλό
 * `default` θα το γεννούσε **χωρίς ποσό** — δηλαδή αόρατο στην Α22.
 *
 * ⚠️ **`listedDate`/`closedDate` δεν τίθενται, και είναι δηλωμένη παράλειψη**: είναι
 * `Timestamp` του Firestore και αυτή η διαδρομή περνά από **JSON** (φόρμα → API). Δεν
 * λείπει πληροφορία που έχουμε — λείπει πληροφορία που **κανείς δεν ζήτησε** από τον
 * ιδιώτη· η «ημέρες στην αγορά» δεν υπάρχει στο κλειστό σχήμα της δημόσιας αγγελίας.
 */
function offerFrom(
  kind: OfferKind,
  values: OwnerPropertyFormParsed,
  source: OfferIdentitySource,
): PropertyOffer {
  const id = offerIdFor(kind, source);

  switch (kind) {
    case 'sell':
      return { id, kind: 'sell', lifecycle: 'active', askingPrice: values.askingPrice };
    case 'leaseOut':
      return { id, kind: 'leaseOut', lifecycle: 'active', rentPrice: values.rentPrice };
    case 'exchange':
      return { id, kind: 'exchange', lifecycle: 'active', percentage: values.exchangePercentage };
  }
}

/**
 * Ο χωρικός άξονας — επίπεδα πεδία → **διακριτή ένωση**.
 *
 * 🔑 **`declared` χωρίς λυμένο σημείο πέφτει σε `declined`**, και **δεν είναι σιωπηλή
 * απώλεια**: το κουμπί υποβολής είναι απενεργοποιημένο όσο η περιοχή δεν έχει λυθεί
 * (δες {@link ownerPropertyFormBlockers}). Εδώ η επιστροφή είναι απλώς **ολική** —
 * μια συνάρτηση που πετούσε θα μετέτρεπε κατάσταση οθόνης σε εξαίρεση.
 *
 * ⚠️ **Το κείμενο ΑΠΟΘΗΚΕΥΕΤΑΙ εδώ (`label`), σε αντίθεση με τη ζήτηση.** Και ο λόγος
 * είναι ότι το ερώτημα είναι **άλλο**: η ζήτηση λέει *«ψάχνω γύρω από εκεί»* — το
 * κείμενο είναι **αναζήτηση**, και ξαναλυμένο αύριο μπορεί να δώσει άλλο σημείο. Η
 * προσφορά λέει *«το ακίνητό μου **είναι** εκεί»* — το κείμενο είναι **η δήλωση του
 * ανθρώπου** για το δικό του πράγμα, και ο κάτοχος οφείλει να τη βλέπει αυτούσια
 * στην οθόνη του. ⛔ **Δεν ταξιδεύει στη δημόσια προβολή** (κλειστό σχήμα).
 */
function placeFrom(values: OwnerPropertyFormParsed): OwnerPropertyPlace {
  if (values.placeAnswer === 'declared' && values.placePoint !== null) {
    return {
      kind: 'declared',
      point: values.placePoint,
      label: values.placeQuery.trim(),
      accuracy: values.placeAccuracy,
      // ⛔ Ο δεσμός ζει **μόνο** στον κλάδο `declared`: το `declined` δεν μπορεί να
      // τον κουβαλήσει, γιατί το να δείξεις δημόσιο κτίριο **είναι** αποκάλυψη θέσης.
      link: values.placeRef,
    };
  }
  return { kind: 'declined' };
}

/** **Φόρμα → προσχέδιο προσφοράς.** Ολική· ντετερμινιστική δεδομένης της πηγής ταυτοτήτων. */
export function ownerPropertyDraftFrom(
  values: OwnerPropertyFormParsed,
  source: OfferIdentitySource,
): OwnerPropertyDraft {
  // 🔴 **Η γη δεν έχει όροφο ούτε υπνοδωμάτια** (ADR-777 §8.32), και ο κανόνας ζει
  // **εδώ** και όχι στην οθόνη: ένα πεδίο που η φόρμα απλώς **κρύβει** εξακολουθεί
  // να κρατά την τιμή που γράφτηκε πριν αλλάξει το είδος, και θα ταξίδευε στη βάση
  // ως «οικόπεδο στον 3ο όροφο» — σιωπηλό ψέμα που **καμία** οθόνη δεν θα έδειχνε.
  // Στη μετάφραση προς το προσχέδιο, ο διακομιστής παίρνει την ίδια εγγύηση δωρεάν.
  const land = isLandPropertyType(values.type);

  return {
    title: values.title.trim(),
    type: values.type as OwnerPropertyDraft['type'],
    areaSqm: values.areaSqm,
    floor: land ? null : values.floor,
    bedrooms: land ? null : values.bedrooms,
    // ⚠️ Ταξινομημένα, όπως και το `deriveOfferKinds`: δύο ταυτόσημες αγγελίες με
    // άλλη σειρά τσεκαρίσματος πρέπει να δίνουν **ταυτόσημο** έγγραφο, αλλιώς κάθε
    // αποθήκευση φαίνεται αλλαγή και οι συγκρίσεις ταυτότητας σπάνε.
    offers: [...values.offerKinds].sort().map((kind) => offerFrom(kind, values, source)),
    place: placeFrom(values),
    media: values.media as readonly OwnerPropertyMedia[],
  };
}

// =============================================================================
// 4. ΠΡΟΣΦΟΡΑ → ΦΟΡΜΑ (επεξεργασία)
// =============================================================================

/**
 * **Προσφορά → φόρμα.**
 *
 * 🔑 **Ολική, ΧΩΡΙΣ ένωση αποτελέσματος** — σε αντίθεση με το `demandFormFrom`, που
 * επιστρέφει `editable | place-not-editable`. Η διαφορά **δεν** είναι ασυνέπεια: εκεί
 * το μοντέλο έχει **τέσσερις** μορφές χώρου και η φόρμα συντάσσει **δύο**, οπότε
 * υπάρχει έγγραφο που η οθόνη **δεν μπορεί** να ανοίξει. Εδώ το μοντέλο έχει
 * **ακριβώς δύο** και η φόρμα τις συντάσσει **και τις δύο** ⇒ μια κατάσταση «δεν
 * επεξεργάζεται» θα ήταν **αδύνατη να συμβεί**, δηλαδή φρουρός χωρίς απόδειξη ζωής
 * (ADR-749 §5).
 *
 * ⚠️ Τα **ποσά διαβάζονται από κάθε είδος ξεχωριστά** και όχι από «την πρώτη
 * διάθεση»: ένα ακίνητο **και προς πώληση και προς ενοικίαση** έχει **δύο** ποσά, και
 * το να διαβαστεί ένα θα άδειαζε σιωπηλά το άλλο στην πρώτη αποθήκευση.
 */
export function ownerPropertyFormFrom(
  property: OwnerProperty,
): OwnerPropertyFormValues {
  const sell = property.offers.find((offer) => offer.kind === 'sell');
  const lease = property.offers.find((offer) => offer.kind === 'leaseOut');
  const exchange = property.offers.find((offer) => offer.kind === 'exchange');
  const declared = property.place.kind === 'declared' ? property.place : null;

  return {
    title: property.title,
    type: property.type,
    areaSqm: property.areaSqm,
    floor: property.floor,
    bedrooms: property.bedrooms,
    offerKinds: property.offers.map((offer) => offer.kind),
    askingPrice: sell?.kind === 'sell' ? sell.askingPrice : null,
    rentPrice: lease?.kind === 'leaseOut' ? lease.rentPrice : null,
    exchangePercentage: exchange?.kind === 'exchange' ? exchange.percentage : null,
    placeAnswer: declared === null ? 'declined' : 'declared',
    placeQuery: declared?.label ?? '',
    placePoint: declared?.point ?? null,
    placeAccuracy: declared?.accuracy ?? null,
    placeRef: declared?.link ?? null,
    media: property.media.map((item) => ({ ...item })),
  };
}

// =============================================================================
// 5. ΤΙ ΕΜΠΟΔΙΖΕΙ ΤΗΝ ΥΠΟΒΟΛΗ — πέρα από τα invariants της οντότητας
// =============================================================================

/**
 * Τα εμπόδια που είναι **της φόρμας**, όχι της οντότητας. Κλειστό σύνολο.
 *
 * ⚠️ **Δεν επικαλύπτονται με τα `OWNER_PROPERTY_INVARIANTS`, και ο διαχωρισμός είναι
 * σημασιολογικός**: εκείνα λένε *«αυτή δεν είναι έγκυρη αγγελία»*· αυτά λένε *«αυτή η
 * φόρμα δεν έχει ακόμη αρκετά για να **φτιάξει** αγγελία»*. Ένα κείμενο περιοχής που
 * δεν λύθηκε σε σημείο δεν είναι **άκυρη** αγγελία — δεν είναι αγγελία **ακόμη**.
 */
export const OWNER_PROPERTY_FORM_BLOCKERS = [
  /** Δήλωσε θέση αλλά η περιοχή δεν έχει λυθεί σε σημείο. */
  'place-unresolved',
] as const;

export type OwnerPropertyFormBlocker = (typeof OWNER_PROPERTY_FORM_BLOCKERS)[number];

/** Τι λείπει **από τη φόρμα**. Όλα, ποτέ το πρώτο. */
export function ownerPropertyFormBlockers(
  values: OwnerPropertyFormParsed,
): OwnerPropertyFormBlocker[] {
  const found: OwnerPropertyFormBlocker[] = [];

  if (values.placeAnswer === 'declared' && values.placePoint === null) {
    found.push('place-unresolved');
  }

  return found;
}

/** Τα είδη ακινήτου, ξαναεξαγόμενα ώστε η οθόνη να μην τα ξαναγράψει. */
export { PROPERTY_TYPES };
