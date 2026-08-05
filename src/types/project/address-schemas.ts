import { z } from 'zod';
import { PROJECT_ADDRESS_TYPES, BLOCK_SIDE_DIRECTIONS } from '@/types/project/addresses';

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
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  // ── ADR-332 Φ8: προέλευση & φρεσκάδα ────────────────────────────────────────
  // Χωρίς δήλωση σβήνονταν σε κάθε PATCH, δηλαδή τα δύο badges δεν είχαν ποτέ δεδομένα.
  // (Το ADR-745 §6.4 δήλωσε ακόμη και δικό του `source: 'titleblock'` — **αδύνατο να αποθηκευτεί**.)
  //
  // ⚠️ `z.string()` και ΟΧΙ `z.enum`: τα `AddressSourceType`/`GeocodingAccuracy` είναι ενώσεις
  // **μόνο τύπων** στο `lib/geocoding/geocoding-types.ts` — δεν έχουν πίνακα χρόνου εκτέλεσης.
  // Ένα `z.enum([...])` εδώ θα ήταν **δεύτερο αντίγραφο** του λεξιλογίου (N.18) που θα απέκλινε
  // σιωπηλά, και η απόκλιση θα εκδηλωνόταν ως **ξανά διαγραφή** του πεδίου. Η αυθεντία μένει
  // στους τύπους· η δουλειά του σχήματος εδώ είναι να **μην καταστρέφει**.
  source: z.string().max(64).optional(),
  verifiedAt: z.number().optional(),
  geocodingMetadata: z.object({
    confidence: z.number(),
    accuracy: z.string().max(64),
    variantUsed: z.number(),
    osmType: z.string().max(64).optional(),
  }).optional(),
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
