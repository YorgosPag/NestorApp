import { z } from 'zod';
import { PROJECT_ADDRESS_TYPES, BLOCK_SIDE_DIRECTIONS } from '@/types/project/addresses';

/**
 * Τα πεδία **θέσης** (`StoredAddressPosition`) — ΕΝΑ σχήμα για έργα, κτίρια **και επαφές**
 * (ADR-332 D27 Β-ΙΙ). Ως τότε ζούσαν inline στο `projectAddressSchema`· η διαδρομή θέσης των
 * επαφών θα χρειαζόταν δεύτερο αντίγραφο, που θα απέκλινε σιωπηλά (N.18) — και η απόκλιση
 * εκδηλώνεται ως **ξανά διαγραφή** του πεδίου.
 *
 * ⚠️ `z.string()` και ΟΧΙ `z.enum`: τα `AddressSourceType`/`GeocodingAccuracy` είναι ενώσεις
 * **μόνο τύπων** στο `lib/geocoding/geocoding-types.ts` — δεν έχουν πίνακα χρόνου εκτέλεσης.
 * Ένα `z.enum([...])` εδώ θα ήταν **δεύτερο αντίγραφο** του λεξιλογίου. Η αυθεντία μένει
 * στους τύπους· η δουλειά του σχήματος είναι να **μην καταστρέφει**.
 */
/**
 * **Η ΛΙΣΤΑ ΤΩΝ ΠΕΔΙΩΝ ΤΟΥ `geocodingMetadata` — ΕΝΑΣ ΙΔΙΟΚΤΗΤΗΣ** (N.12 · CHECK 3.28).
 *
 * 🔴 **Ήταν γραμμένη δύο φορές** *(εδώ και στο `api/contacts/_shared/contact-address-positions.ts`)*
 * και το πρόσεξε η πύλη κλώνων τη στιγμή που η D27 Ζ6 πρόσθεσε `resolvedFor` + `partialMatch`
 * — δηλαδή **και στα δύο** αντίγραφα, χειροκίνητα. Το επόμενο πεδίο θα έμπαινε στο ένα.
 * Και η αστοχία δεν είναι θεωρητική: το Zod **πετάει** κάθε αδήλωτο κλειδί, άρα ένα ξεχασμένο
 * πεδίο εκδηλώνεται ως **σιωπηλή διαγραφή σε κάθε αποθήκευση** *(ADR-759 Φ3 · Φ8)*.
 *
 * 🔑 **ΠΑΡΑΜΕΤΡΟΣ Ο ΕΛΕΓΚΤΗΣ, ΟΧΙ ΚΟΙΝΟ ΣΧΗΜΑ**: οι δύο πλευρές **διαφέρουν σκόπιμα** στο
 * `accuracy` *(εδώ `z.string()` «να μην καταστρέφει»· στις επαφές `z.enum(GEOCODING_ACCURACIES)`
 * γιατί εκεί η τιμή **γεννιέται** τώρα)*. Ένα κοινό σχήμα θα άλλαζε **συμπεριφορά** στη μία —
 * θα έκανε αυστηρή μια διαδρομή PATCH που σήμερα **διασώζει** ό,τι βρει. Κοινή γίνεται η
 * **απαρίθμηση**, που είναι και η μόνη που διπλογραφόταν.
 */
export function geocodingMetadataSchema<A extends z.ZodTypeAny>(accuracy: A) {
  return z.object({
    confidence: z.number(),
    accuracy,
    variantUsed: z.number(),
    osmType: z.string().max(64).optional(),
    // ── ADR-332 D27 Ζ6: η ΑΠΟΔΕΙΞΗ του ισχυρισμού ακρίβειας ────────────────────
    // Χωρίς δήλωση εδώ, κάθε αποθήκευση θα έσβηνε την απόδειξη και ο ισχυρισμός θα
    // ξαναγινόταν ανέλεγκτος — **ακριβώς** η βλάβη που το ADR-759 Φ3 μέτρησε για το
    // `municipalUnit` και η Φ8 για το `geocodingMetadata` ολόκληρο.
    // `z.record` και όχι απαρίθμηση πεδίων: η αυθεντία της λίστας είναι το
    // `ADDRESS_IDENTITY_FIELDS` — δεύτερο αντίγραφο εδώ θα απέκλινε.
    resolvedFor: z.record(z.string().max(64), z.string().max(300)).optional(),
    partialMatch: z.boolean().optional(),
  });
}

export const addressPositionFieldsSchema = z.object({
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  // ── ADR-332 Φ8: προέλευση & φρεσκάδα ────────────────────────────────────────
  // Χωρίς δήλωση σβήνονταν σε κάθε PATCH, δηλαδή τα δύο badges δεν είχαν ποτέ δεδομένα.
  // (Το ADR-745 §6.4 δήλωσε ακόμη και δικό του `source: 'titleblock'` — **αδύνατο να αποθηκευτεί**.)
  source: z.string().max(64).optional(),
  verifiedAt: z.number().optional(),
  // `z.string()` για το `accuracy`: εδώ το σχήμα **διασώζει** ό,τι βρει (δες κεφαλίδα).
  geocodingMetadata: geocodingMetadataSchema(z.string().max(64)).optional(),
});

/**
 * ⚠️ **ΣΥΜΒΟΛΑΙΟ SSoT — ΣΙΩΠΗΛΗ ΑΠΩΛΕΙΑ (μετρημένη 2026-08-05, ADR-759 Φ3).**
 *
 * Αυτό είναι `z.object` και το Zod **ΠΕΤΑΕΙ κάθε κλειδί που δεν δηλώνεται εδώ**. Είναι το σχήμα
 * του `ProjectUpdateSchema.addresses`, δηλαδή **κάθε** PATCH διεύθυνσης έργου περνά από εδώ.
 *
 * 🔴 Μετρημένο με `projectAddressSchema.parse()`: από ένα αντικείμενο με 10 κλειδιά **επέζησαν 7**
 * (`city,country,id,isPrimary,postalCode,street,type`). Έλειπαν **δηλωμένα πεδία δύο ADR**:
 * - **`frontageIndex`** (ADR-167 Φ2.5 / ADR-186) — ο **αντίστροφος** δεσμός προσώπου οικοπέδου.
 *   Το `FrontageAddressCreateDialog:68` τον γράφει· το PATCH τον έσβηνε στο ίδιο αίτημα.
 * - **`source` / `verifiedAt` / `geocodingMetadata`** (ADR-332 Φ8) — ολόκληρη η **προέλευση και
 *   φρεσκάδα** διεύθυνσης. Τα `<AddressSourceLabel>` / `<AddressFreshnessIndicator>` δεν είχαν
 *   ποτέ τι να δείξουν για διεύθυνση έργου που πέρασε από PATCH.
 *
 * Ίδιο σχήμα με το περιστατικό της 2026-05-27 στο `dxf-levels.schemas.ts` (V/G χρώματα): **το
 * σχήμα ήταν πράσινο, τα δεδομένα εξαφανίζονταν**. ⇒ **Κάθε νέο πεδίο του `ProjectAddress`
 * μπαίνει ΚΑΙ εδώ**, αλλιώς ο τύπος λέει ένα και η βάση κρατά άλλο.
 * Άγκυρα: `types/validation/__tests__/address-schemas.test.ts`.
 */
export const projectAddressSchema = z.object({
  id: z.string(),
  street: z.string(),
  number: z.string().optional(),
  city: z.string(),
  postalCode: z.string(),
  region: z.string().optional(),
  regionalUnit: z.string().optional(),
  country: z.string(),
  type: z.enum(PROJECT_ADDRESS_TYPES),
  isPrimary: z.boolean(),
  label: z.string().optional(),
  /** ADR-167 Φ2.5 / ADR-186 — ο δεσμός προς `PlotFrontage.index`. Χωρίς δήλωση: σβηνόταν. */
  frontageIndex: z.number().int().min(1).optional(),
  blockSide: z.enum(BLOCK_SIDE_DIRECTIONS).optional(),
  blockSideDescription: z.string().optional(),
  cadastralCode: z.string().optional(),
  municipality: z.string().optional(),
  /** ADR-759 Φ3 — Δημοτική Ενότητα (Καλλικράτης επίπεδο 6). */
  municipalUnit: z.string().optional(),
  neighborhood: z.string().optional(),
  // ── ADR-772: τα ανώτερα επίπεδα + οι ταυτότητες ─────────────────────────────
  // Η οθόνη τα ρωτούσε ήδη· ο τύπος τώρα τα κρατά. **Χωρίς δήλωση εδώ το PATCH τα
  // σβήνει** — ακριβώς η βλάβη που έπιασε το ADR-759 Φ3 για το `municipalUnit`.
  decentAdmin: z.string().optional(),
  majorGeo: z.string().optional(),
  // `nullable`: το `null` σημαίνει «καθαρίστηκε ρητά» και ΠΡΕΠΕΙ να επιβιώνει — αλλιώς
  // μια σβησμένη επιλογή αφήνει μπαγιάτικη ταυτότητα δίπλα σε νέο όνομα.
  settlementId: z.string().nullable().optional(),
  municipalUnitId: z.string().nullable().optional(),
  municipalityId: z.string().nullable().optional(),
  regionalUnitId: z.string().nullable().optional(),
  regionId: z.string().nullable().optional(),
  decentAdminId: z.string().nullable().optional(),
  majorGeoId: z.string().nullable().optional(),
  // Θέση + προέλευση + φρεσκάδα — το ΕΝΑ σχήμα θέσης (ADR-332 Φ8 · D27 Β-ΙΙ).
  ...addressPositionFieldsSchema.shape,
  sortOrder: z.number().optional(),
});

export const projectAddressCreateSchema = projectAddressSchema.extend({
  street: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
});

/** Το ελάχιστο σχήμα διεύθυνσης που χρειάζονται τα αναλλοίωτα του πίνακα. */
type AddressListInvariantInput = { readonly id: string; readonly isPrimary: boolean };

/**
 * Τα **δύο αναλλοίωτα του πίνακα διευθύνσεων**, γραμμένα μία φορά.
 *
 * ⚠️ Ήταν αντιγραμμένα αυτούσια σε `projectAddressesSchema` και `projectAddressesCreateSchema`
 * (12 γραμμές / 77 tokens) — το έπιασε η CHECK 3.28 (N.18) όταν το αρχείο μπήκε στο diff της
 * Φ3 του ADR-759. Δύο αντίγραφα κανόνα **επικύρωσης** είναι η χειρότερη μορφή κλώνου: όταν
 * αποκλίνουν, η μία διαδρομή δέχεται δεδομένα που η άλλη απορρίπτει, και **καμία δεν σκάει**.
 */
const withAddressListInvariants = <T extends z.ZodType<AddressListInvariantInput>>(
  itemSchema: T,
) =>
  z
    .array(itemSchema)
    .refine((addresses) => addresses.filter((addr) => addr.isPrimary).length === 1, {
      message: 'Exactly one address must be marked as primary',
    })
    .refine(
      (addresses) => {
        const ids = addresses.map((addr) => addr.id);
        return ids.length === new Set(ids).size;
      },
      { message: 'Address IDs must be unique' },
    );

export const projectAddressesSchema = withAddressListInvariants(projectAddressSchema);

export const projectAddressesCreateSchema = withAddressListInvariants(projectAddressCreateSchema);
