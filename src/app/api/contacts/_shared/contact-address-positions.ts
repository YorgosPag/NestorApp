/**
 * Ο πυρήνας των διαδρομών θέσης επαφής — **λύνει, δεν γράφει** (ADR-332 D27 Βήμα Β-ΙΙ).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ «RESOLVE-ONLY» ΚΑΙ ΟΧΙ ΕΓΓΡΑΦΗ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η επαφή γράφεται από τον **πελάτη** (`contacts.service` → `updateDoc`), με ολόκληρη την
 * αλυσίδα της φόρμας (dirty diff, δικλείδα D20, CDC). Ο γραφέας θέσης όμως ζει στον
 * **διακομιστή** — εκεί είναι επιβλητή η πολιτική 1 αιτήματος/δευτ. του Nominatim και εκεί
 * λύνει ήδη τα έργα και τα κτίρια. Άρα ο διακομιστής **αποφασίζει** και ο πελάτης γράφει
 * **μία** φορά: ένα `updateDoc`, μία εγγραφή CDC. Δεύτερη εγγραφή από εδώ θα έδινε δύο
 * εκδοχές του ίδιου εγγράφου και δύο γραμμές ιστορικού για μία πράξη του ανθρώπου.
 *
 * Πρακτική: Salesforce Geocode Data Integration Rules (θέση σε create **και** update) ·
 * Salesforce Maps Verified Location (η πινέζα του ανθρώπου επιβιώνει αλλαγής διεύθυνσης).
 *
 * ⚠️ **Ο ΙΔΙΟΣ γραφέας** (`resolveProjectAddressPositions` — το όνομα είναι ιστορικό, ο
 * τύπος δομικός). Δεύτερη μηχανή θέσης για τις επαφές θα απέκλινε από την πρώτη.
 *
 * @module api/contacts/_shared/contact-address-positions
 */

import 'server-only';

import { z } from 'zod';
import { createModuleLogger } from '@/lib/telemetry';
import { createDeadline } from '@/lib/async-utils';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { GEOCODING_ACCURACIES } from '@/lib/geocoding/geocoding-types';
import { WRITTEN_ADDRESS_SOURCES } from '@/lib/geocoding/address-position';
import { resolveProjectAddressPositions } from '@/services/listings/address-place-writeback';
import { addressPositionFieldsSchema, geocodingMetadataSchema } from '@/types/project/address-schemas';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { pickStoredAddressPosition } from '@/utils/address/stored-address-position';
import {
  contactAddressPositionViews,
  type ContactAddressPositionsResponse,
} from '@/utils/contacts/contact-address-position-view';

const logger = createModuleLogger('ContactAddressPositions');
const { GEOCODING } = GEOGRAPHIC_CONFIG;

/** Πάνω όριο εγγραφών ανά αίτημα — η μηχανή ρωτιέται σειριακά (1 αίτημα/δευτ.). */
export const CONTACT_ADDRESS_POSITIONS_LIMIT = 50;

const identityText = z.string().max(300).optional();

/**
 * Η **όψη θέσης** στο σύνορο — αυστηρή (`strict`): ταξιδεύουν μόνο όψεις, ποτέ ολόκληρες
 * εγγραφές, άρα δεν υπάρχει κείμενο ή ιεραρχία που θα μπορούσε να κοπεί.
 *
 * 🔑 Τα πεδία ταυτότητας είναι ακριβώς το `ADDRESS_IDENTITY_FIELDS` — η άγκυρα
 * `contact-address-positions.test` κρατά τα δύο ίσα. `source` / `accuracy` στενεύουν με
 * `z.enum` πάνω σε **πίνακες χρόνου εκτέλεσης**: οι επαφές δεν είχαν ποτέ θέση, άρα κάθε
 * τιμή τους προέρχεται από τον γραφέα (σε αντίθεση με τα έργα, όπου το `z.string()` του
 * `addressPositionFieldsSchema` προστατεύει παλιές τιμές).
 */
const contactAddressPositionViewSchema = z.object({
  id: z.string().min(1).max(128),
  street: identityText,
  number: identityText,
  city: identityText,
  neighborhood: identityText,
  postalCode: identityText,
  municipality: identityText,
  region: identityText,
  regionalUnit: identityText,
  country: identityText,
  coordinates: addressPositionFieldsSchema.shape.coordinates,
  verifiedAt: addressPositionFieldsSchema.shape.verifiedAt,
  source: z.enum(WRITTEN_ADDRESS_SOURCES).optional(),
  // ADR-332 D27 Ζ6 — η **απόδειξη** ταξιδεύει και στις δύο κατευθύνσεις: ο πελάτης στέλνει
  // πίσω την αποθηκευμένη θέση, και αδήλωτο κλειδί εδώ **κόβεται σιωπηλά** ⇒ ο διακομιστής
  // θα το έβλεπε ως «δεν υπήρξε ποτέ» και το `keepStored` θα το **έχανε σε κάθε αποθήκευση**.
  // 🔑 Η απαρίθμηση των πεδίων ζει **σε ένα σημείο** (`geocodingMetadataSchema`, N.12)· εδώ
  //    μένει μόνο η **αυστηρότητα** που αφορά αυτή τη διαδρομή: η τιμή **γεννιέται** τώρα,
  //    άρα οφείλει να ανήκει στο λεξιλόγιο — σε αντίθεση με το PATCH έργου, που διασώζει.
  geocodingMetadata: geocodingMetadataSchema(z.enum(GEOCODING_ACCURACIES)).optional(),
}).strict();

export const contactAddressPositionsRequestSchema = z.object({
  addresses: z.array(contactAddressPositionViewSchema).min(1).max(CONTACT_ADDRESS_POSITIONS_LIMIT),
  relocateAddressIds: z.array(z.string().min(1).max(128)).max(CONTACT_ADDRESS_POSITIONS_LIMIT).optional(),
}).strict();

export type ContactAddressPositionsBody = z.infer<typeof contactAddressPositionsRequestSchema>;

/**
 * Λύνει τη θέση κάθε εισερχόμενης εγγραφής απέναντι στις **αποθηκευμένες** — και
 * επιστρέφει μόνο τις αποφάσεις, **χωρίς καμία εγγραφή**.
 *
 * @param storedAddresses Η αυθεντική λίστα όπως είναι στη βάση (`[]` για νέα επαφή).
 */
export async function resolveContactAddressPositions(
  storedAddresses: readonly CompanyAddress[],
  body: ContactAddressPositionsBody,
): Promise<ContactAddressPositionsResponse> {
  // ADR-332 D27 Ζ5 — **μία** προθεσμία για όλη την επίλυση (deadline propagation, όπως το Β13 στο
  // αντίστροφο): κάθε διεύθυνση ρωτά το **υπόλοιπο** πριν ρωτήσει τη μηχανή. Χωρίς αυτό, ένας
  // **μη κρίσιμος** γραφέας κρατούσε την «Αποθήκευση» **61,4″** (μετρημένο ζωντανά).
  const deadline = createDeadline(GEOCODING.RESOLVER_TIMEOUT_MS);
  try {
    const { addresses, tally, drifts, pendingIds } = await resolveProjectAddressPositions(
      contactAddressPositionViews(storedAddresses),
      body.addresses,
      Date.now(),
      {
        relocateIds: new Set(body.relocateAddressIds ?? []),
        budget: {
          remainingMs: () => deadline.remainingMs(),
          advisoryReserveMs: GEOCODING.ADVISORY_RESERVE_MS,
        },
      },
    );

    // Η λογιστική τυπώνεται **πάντα** — ένα «0» που δεν τυπώνεται διαβάζεται ως «δεν ελέγχθηκε».
    logger.info('[Contacts/AddressPositions] Θέσεις διευθύνσεων', {
      ...tally,
      drifts: drifts.length,
      pending: pendingIds.length,
    });

    return {
      positions: addresses.map((address) => ({ id: address.id, ...pickStoredAddressPosition(address) })),
      positionAdvisories: [...drifts],
      ...(pendingIds.length > 0 ? { positionsPending: [...pendingIds] } : {}),
    };
  } finally {
    // Το χρονόμετρο της προθεσμίας κρατά ζωντανή τη διεργασία ως τη λήξη αν δεν κλείσει.
    deadline.dispose();
  }
}
