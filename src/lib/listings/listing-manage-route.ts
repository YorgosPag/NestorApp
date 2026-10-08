/**
 * @fileoverview **ΠΟΙΑ ΠΟΡΤΑ ΔΙΑΧΕΙΡΙΣΗΣ ΕΧΕΙ ΑΥΤΗ Η ΑΓΓΕΛΙΑ** — μία απάντηση, για κάθε οικογένεια και χώρο.
 * @related ADR-843 §10.18 Ζ.1 · lib/listings/listing-families.ts · lib/owner-property/listing-custody.ts ·
 *   lib/places/place-detail-route.ts *(η ίδια ερώτηση για τις ειδοποιήσεις)*
 * @module lib/listings/listing-manage-route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: Η ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ ΗΞΕΡΕ **ΜΙΑ** ΠΟΡΤΑ ΑΠΟ ΤΙΣ ΤΡΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κάτοχος που ανοίγει τη **δημόσια** αγγελία του βλέπει *«Αυτή είναι η αγγελία σας»* και έναν σύνδεσμο
 * *«Επεξεργασία»*. Ως τις 2026-10-08 ο σύνδεσμος υπήρχε **μόνο** για την προσωπική θεματοφυλακή· κάθε αγγελία
 * γραφείου έπαιρνε `null`, με γραμμένο λόγο ότι *«από δημόσια σελίδα κανείς δεν μπορεί να ονομάσει τον χώρο»*
 * και ότι ο σύνδεσμος *«θα έβγαζε 404»*.
 *
 * 🔑 **Ο λόγος είχε παλιώσει.** Το δίχτυ `(app)/[...unprefixed]` (ADR-787 §5.3 ιβ) παίρνει την ωμή διεύθυνση και
 * τη στέλνει στον χώρο του ανθρώπου με **κριμένη** ταυτότητα στον διακομιστή — και οι ειδοποιήσεις το
 * χρησιμοποιούν ήδη για **ακριβώς** αυτές τις δύο πόρτες (`placeDetailHref` · `mandateDetailHref`). Άρα κανείς
 * δεν χρειάζεται να ονομάσει χώρο: αρκεί η **πόρτα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ **ΔΕΝ** ΓΡΑΦΕΤΑΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Καμία συμβολοσειρά διαδρομής** — και οι τρεις πόρτες έχουν ήδη μητρώο. **Κανένα πρόθεμα χώρου** — το
 * βάζει το δίχτυ. **Καμία κρίση εξουσιοδότησης** — ο καλών έχει ήδη ρωτήσει το `mayAdminister` (CHECK 3.56)·
 * εδώ μόνο διευθυνσιοδοτείται ό,τι εκείνος έκρινε *«δικό σου»*.
 *
 * **Layering**: leaf — μόνο σύνθεση διευθύνσεων, καμία ανάγνωση.
 */

// ⚠️ Απευθείας από το module, όχι από το barrel `@/lib/routes` — ίδιος λόγος με το `place-detail-route.ts`.
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { familyOfListingId, type ListingFamily } from '@/lib/listings/listing-families';
import { mandateDetailHref } from '@/lib/mandate/mandate-routes';
import type { ListingCustody } from '@/lib/owner-property/listing-custody';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';

type ManageDoor = (listingId: string) => string;

/**
 * **Η πόρτα κάθε ζεύγους (οικογένεια, χώρος)** — και ο τύπος είναι ο φρουρός.
 *
 * 🔑 Διπλό `Record` δεμένο στις **δύο** ρίζες (ιδίωμα CHECK 3.73): μια τρίτη οικογένεια ή ένα τρίτο είδος
 * θεματοφυλακής **δεν μεταγλωττίζεται** μέχρι να αποφασίσει κάποιος πού πάει ο κάτοχός της.
 *
 * | Οικογένεια | Χώρος | Πόρτα |
 * |---|---|---|
 * | ιδιώτης (`ownp_*`) | προσωπικός | η καρτέλα *«η αγγελία μου»* (`/offers/<id>`) |
 * | ιδιώτης (`ownp_*`) | γραφείου | η **εντολή** (`/listings/mandates/<id>`) — εκεί ζει η εταιρική αγγελία πελάτη |
 * | γραφείο (`prop_*`) | γραφείου | η καρτέλα του ακινήτου (`/properties/<id>`) |
 * | γραφείο (`prop_*`) | προσωπικός | **`null`, δηλωμένα**: το `agencyCustodyOf` δεν το παράγει ποτέ |
 *
 * ⚠️ Το τελευταίο `null` **δεν** είναι παράλειψη: συνδυασμός που ο επιλυτής δεν γεννά δεν έχει οθόνη, και μια
 * μαντεμένη πόρτα θα έστελνε τον άνθρωπο σε *«δεν υπάρχει — ή δεν είναι δικό σου»*.
 */
const LISTING_MANAGE_DOOR: Record<ListingFamily, Record<ListingCustody['kind'], ManageDoor | null>> = {
  owner: { personal: offerDetailHref, company: mandateDetailHref },
  agency: { personal: null, company: ENTITY_ROUTES.properties.withId },
};

/**
 * **Πού διαχειρίζεται ο κάτοχος αυτή την αγγελία** — ή `null` όταν δεν υπάρχει τέτοια οθόνη.
 *
 * @param listingId — η ταυτότητα της αγγελίας (`ownp_*` ή `prop_*`)· η οικογένεια διαβάζεται από τον **ένα**
 *   δρομολογητή (`familyOfListingId`), τον ίδιο που ρωτά ο επιλυτής
 * @param custody — ο χώρος της, όπως τον έδωσε ο εντοπιστής· **ποτέ** από claim του θεατή
 */
export function listingManageHref(listingId: string, custody: ListingCustody): string | null {
  const family = familyOfListingId(listingId);
  if (family === null) return null;

  const door = LISTING_MANAGE_DOOR[family][custody.kind];
  return door === null ? null : door(listingId);
}
