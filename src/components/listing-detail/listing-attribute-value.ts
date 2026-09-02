/**
 * @fileoverview **Η ΤΙΜΗ ΕΝΟΣ ΣΤΟΙΧΕΙΟΥ, ΩΣ ΚΕΙΜΕΝΟ ΟΘΟΝΗΣ** (ADR-842 Φ3).
 * @related ADR-842 §7 (Φ3 · Α4) · ADR-777 §7 (Α3 οθόνη 3) · lib/listings/listing-disclosure
 * @module components/listing-detail/listing-attribute-value
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΙΜΩΝ **ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ** — ΚΑΙ ΗΤΑΝ ΜΕΤΡΗΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το SSoT audit της Φ3 βρήκε ότι **και οι δεκατρείς** κατάλογοι ετικετών υπάρχουν ήδη
 * στο `i18n/locales/<γλώσσα>/properties-enums.json` (`condition.*` · `systems.heating.*` ·
 * `finishes.flooring.*` · `features.interior.*` · `units.orientation.*` …) και ότι τους
 * διαβάζει **ήδη** και δεύτερος καταναλωτής, ο **server** resolver
 * (`services/property-enum-labels`) που τροφοδοτεί PDF · email · Telegram.
 *
 * ⇒ Ένα δεύτερο σύνολο ετικετών κάτω από το `search-results` θα ήταν **τρίτη** εκδοχή
 * της ίδιας αλήθειας (ADR-749 · N.0.2). Εδώ ζει **μόνο η αντιστοίχιση** «ποιο πεδίο
 * διαβάζεται με ποιο λεξιλόγιο» — μηδέν κείμενο.
 *
 * ⚠️ **Οι ΕΤΙΚΕΤΕΣ ΠΕΔΙΩΝ ζουν στο `listing-detail:attributes.label.*`, και είναι
 * δικό τους μητρώο επίτηδες.** Είναι το μόνο σημείο όπου η Φ3 γράφει κείμενο που
 * «μοιάζει» με υπάρχον (`properties-enums:systems.heating.label` = «Θέρμανση»). Ο
 * λόγος: εκείνα είναι ετικέτες της **φόρμας επεξεργασίας** μιας εταιρείας· αυτά είναι
 * ετικέτες της **δημόσιας αγγελίας**, και οι δύο οθόνες έχουν δικαίωμα σε δικό τους
 * μητρώο — όπως το `detail.price.role.*` δεν δανείζεται από τη φόρμα τιμής. Το κόστος
 * (23 συμβολοσειρές × 2 γλώσσες) είναι **γνωστό**, όχι κρυμμένο — και **δεν το πληρώνει
 * ολόκληρη η εφαρμογή**: το `listing-detail` είναι per-route namespace με **έναν**
 * καταναλωτή, σε αντίθεση με το `search-results` που ταξιδεύει σε 141 διαδρομές.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ ΤΑ ΠΡΟΘΕΜΑΤΑ ΕΙΝΑΙ **ΚΥΡΙΟΛΕΚΤΙΚΑ** ΚΑΙ ΟΧΙ ΜΕΤΑΒΛΗΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η προφανής γραφή ήταν ένας πίνακας `Record<…, string>` με πλήρη κλειδιά και
 * `t(prefixFromTable + '.' + value)`. **Απορρίφθηκε, και ο λόγος είναι πύλη**: ο
 * γεννήτορας του i18n shell slice (ADR-744, CHECK 3.34) αναλύει **στατικά** τις
 * κλήσεις `t(…)` και **αρνείται να παράξει slice** όσο υπάρχει ανεπίλυτη κλήση. Ένα
 * πρόθεμα από μεταβλητή είναι ακριβώς αυτό — και η θεραπεία θα ήταν χειρόγραφη
 * εγγραφή στο `$dynamicKeyPolicy`, δηλαδή **δεύτερη λίστα να συντηρείται**.
 *
 * 🔑 Με κυριολεκτικά προθέματα μέσα σε `switch`, ο γεννήτορας τα βλέπει **όλα** και ο
 * μεταγλωττιστής εγγυάται ότι κανένα λεξιλόγιο δεν έμεινε χωρίς σκέλος. Καμία
 * εγγραφή πολιτικής, καμία δεύτερη λίστα.
 */

'use client';

import type { TFunction } from 'i18next';

import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { normalizePropertyType } from '@/constants/property-type-aliases';
import type {
  ListingAttributeKey,
  ListingFeatureSetKey,
} from '@/lib/listings/listing-disclosure';
import type { PublicListing } from '@/types/public-listing';

// ============================================================================
// 1. ΤΑ ΛΕΞΙΛΟΓΙΑ — ένα όνομα ανά κατάλογο ετικετών
// ============================================================================

/**
 * Ποιος κατάλογος του `properties-enums` ονομάζει τις τιμές αυτού του πεδίου.
 *
 * ⚠️ **Ονόματα λεξιλογίου, ΟΧΙ ονόματα πεδίων**: το `heatingType` και το
 * `systemsOverride.heatingType` της φόρμας μοιράζονται τον **ίδιο** κατάλογο, και το
 * `flooring` τον μοιράζεται ως **σύνολο**. Αν το κλειδί ήταν το όνομα του πεδίου, δύο
 * πεδία με το ίδιο λεξιλόγιο θα το δήλωναν δύο φορές.
 */
export type AttributeVocabulary =
  | 'condition'
  | 'heating'
  | 'fuel'
  | 'cooling'
  | 'waterHeating'
  | 'frames'
  | 'glazing'
  | 'flooring'
  | 'orientation'
  | 'interiorFeature'
  | 'securityFeature'
  | 'amenity';

/**
 * Μία τιμή λεξιλογίου → η ετικέτα της.
 *
 * 🔴 **Κάθε πρόθεμα είναι ΚΥΡΙΟΛΕΚΤΙΚΟ** — δες την κεφαλίδα για το γιατί, και το
 * `switch` είναι εξαντλητικό πάνω στο {@link AttributeVocabulary}, άρα νέο λεξιλόγιο
 * **δεν μεταγλωττίζεται** μέχρι να πει από πού διαβάζονται οι ετικέτες του.
 */
export function vocabularyLabel(
  t: TFunction,
  vocabulary: AttributeVocabulary,
  value: string
): string {
  switch (vocabulary) {
    case 'condition':
      return t(`properties-enums:condition.${value}`);
    case 'heating':
      return t(`properties-enums:systems.heating.${value}`);
    case 'fuel':
      return t(`properties-enums:systems.fuel.${value}`);
    case 'cooling':
      return t(`properties-enums:systems.cooling.${value}`);
    case 'waterHeating':
      return t(`properties-enums:systems.waterHeating.${value}`);
    case 'frames':
      return t(`properties-enums:finishes.frames.${value}`);
    case 'glazing':
      return t(`properties-enums:finishes.glazing.${value}`);
    case 'flooring':
      return t(`properties-enums:finishes.flooring.${value}`);
    case 'orientation':
      return t(`properties-enums:units.orientation.${value}`);
    case 'interiorFeature':
      return t(`properties-enums:features.interior.${value}`);
    case 'securityFeature':
      return t(`properties-enums:features.security.${value}`);
    case 'amenity':
      return t(`properties-enums:features.amenities.${value}`);
  }
}

/**
 * **Κάθε σύνολο, και το λεξιλόγιο των τιμών του.**
 *
 * 🔑 `Record<ListingFeatureSetKey, …>` ⇒ νέο σύνολο **δεν μεταγλωττίζεται** μέχρι να
 * πει με ποιες ετικέτες ονομάζονται οι τιμές του. Είναι ο **ένας** από τους δύο
 * φρουρούς των συνόλων (ο άλλος είναι το `LISTING_ATTRIBUTE_GROUP`) — τα σύνολα δεν
 * έχουν πίνακα «πότε είναι δηλωμένο», γιατί η ανάγνωσή τους είναι ολική εξ ορισμού.
 */
export const FEATURE_SET_VOCABULARY: Record<ListingFeatureSetKey, AttributeVocabulary> = {
  flooring: 'flooring',
  orientations: 'orientation',
  interiorFeatures: 'interiorFeature',
  securityFeatures: 'securityFeature',
  amenities: 'amenity',
};

// ============================================================================
// 2. ΠΩΣ ΔΙΑΒΑΖΕΤΑΙ Η ΤΙΜΗ ΚΑΘΕ ΙΔΙΟΤΗΤΑΣ
// ============================================================================

/**
 * Ο τρόπος που μια δηλωμένη τιμή γίνεται κείμενο.
 *
 * ⚠️ **`'verbatim'` ΔΕΝ είναι «hardcoded string» (N.11)** — είναι **δεδομένο** που
 * τυπώνεται αυτούσιο: ένας αριθμός δωματίων, ένα έτος, ή το γράμμα `B` της ενεργειακής
 * κλάσης. Το `A+` δεν έχει μετάφραση· είναι **σύμβολο κανονισμού**, όπως ένα `m²`.
 */
type AttributeValueKind =
  | { readonly kind: 'sqm' }
  | { readonly kind: 'verbatim' }
  | { readonly kind: 'enum'; readonly vocabulary: AttributeVocabulary }
  /**
   * Πεδία με **δική τους** διατύπωση.
   *
   * ⚠️ **Η συνάρτηση ζει ΜΕΣΑ στην εγγραφή, και δεν ξαναγράφει το κλειδί της.** Η
   * εναλλακτική ήταν `{ kind: 'custom', field: 'floor' }` — αυτο-αναφορικό διπλότυπο
   * που μεταγλωττίζεται μια χαρά και λέει ψέματα αν αποκλίνει (`floor:
   * { field: 'bedrooms' }`). Ίδιο επιχείρημα με το `ATTRIBUTE_DECLARED` του
   * `listing-attribute-declared.ts`, και ο λόγος που δεν υπάρχει `as` πουθενά εδώ.
   */
  | { readonly kind: 'custom'; readonly render: AttributeRenderer };

/**
 * **Κάθε ιδιότητα, και πώς διαβάζεται η τιμή της.** Εξαντλητικό `Record` ⇒ νέα
 * ιδιότητα **δεν μεταγλωττίζεται** μέχρι να απαντηθεί *«πώς γίνεται κείμενο;»*.
 */
/**
 * 🔴 **ΤΑ ΚΛΕΙΔΙΑ ΠΟΥ Η ΤΙΜΗ ΤΟΥΣ ΕΙΝΑΙ ΒΑΘΜΩΤΗ** — δηλαδή όσα μπορούν να τυπωθούν
 * αυτούσια χωρίς να ρωτηθεί κανείς πώς.
 *
 * Παράγεται από το **ίδιο** το {@link PublicListing}: κλειδί του οποίου η τιμή δεν
 * είναι `string | number | null` **δεν ανήκει** εδώ, αυτόματα.
 */
type ScalarAttributeKey = {
  readonly [K in ListingAttributeKey]: PublicListing[K] extends string | number | null
    ? K
    : never;
}[ListingAttributeKey];

/**
 * 🔴 **Ο ΤΥΠΟΣ ΑΠΑΓΟΡΕΥΕΙ ΤΟ `[object Object]` — ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ.**
 *
 * Το `'verbatim'` κάνει `String(listing[key])`. Όσο **κάθε** ιδιότητα ήταν αριθμός ή
 * συμβολοσειρά, αυτό ήταν ασφαλές. Η Φ5 έδωσε στο `levels` δοχείο **με προέλευση**
 * (ADR-842 §8 #7) — και ένα `verbatim` πάνω σε αντικείμενο **μεταγλωττίζεται μια χαρά**
 * και ζωγραφίζει `[object Object]` **στον ανώνυμο επισκέπτη**. Είναι η ίδια οικογένεια
 * με το ωμό i18n κλειδί που το CHECK 3.51 κυνηγά, από άλλη πόρτα.
 *
 * ⇒ Ένα μη βαθμωτό κλειδί μπορεί να δηλωθεί **μόνο** `'custom'`, δηλαδή **μόνο** αν
 * κάποιος απαντήσει ρητά *«πώς γίνεται κείμενο;»*. Η εγγύηση είναι του **μεταγλωττιστή**,
 * όχι της προσοχής μας.
 */
type AttributeValueKindFor<K extends ListingAttributeKey> = K extends ScalarAttributeKey
  ? AttributeValueKind
  : Extract<AttributeValueKind, { readonly kind: 'custom' }>;

const ATTRIBUTE_VALUE_KIND: {
  readonly [K in ListingAttributeKey]: AttributeValueKindFor<K>;
} = {
  type: { kind: 'custom', render: renderType },
  areaSqm: { kind: 'sqm' },
  floor: { kind: 'custom', render: renderFloor },
  bedrooms: { kind: 'custom', render: renderBedrooms },

  energyClass: { kind: 'verbatim' },
  condition: { kind: 'enum', vocabulary: 'condition' },
  renovationYear: { kind: 'verbatim' },

  bathrooms: { kind: 'verbatim' },
  wc: { kind: 'verbatim' },
  totalRooms: { kind: 'verbatim' },
  levels: { kind: 'custom', render: renderLevels },
  balconies: { kind: 'verbatim' },
  netAreaSqm: { kind: 'sqm' },
  balconyAreaSqm: { kind: 'sqm' },
  terraceAreaSqm: { kind: 'sqm' },
  gardenAreaSqm: { kind: 'sqm' },

  heatingType: { kind: 'enum', vocabulary: 'heating' },
  heatingFuel: { kind: 'enum', vocabulary: 'fuel' },
  coolingType: { kind: 'enum', vocabulary: 'cooling' },
  waterHeating: { kind: 'enum', vocabulary: 'waterHeating' },
  windowFrames: { kind: 'enum', vocabulary: 'frames' },
  glazing: { kind: 'enum', vocabulary: 'glazing' },
};

type AttributeRenderer = (t: TFunction, listing: PublicListing) => string;

/** Το είδος — **ονομάσιμο** ή τίποτα (δες `isAttributeDeclared`). */
function renderType(t: TFunction, listing: PublicListing): string {
  const canonical = normalizePropertyType(listing.type);
  return canonical === null ? '' : t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[canonical]}`);
}

/**
 * ⚠️ **`floor: 0` είναι ΙΣΟΓΕΙΟ, όχι «όροφος 0»** — η ίδια διάκριση με την κάρτα των
 * αποτελεσμάτων, και ο λόγος που το `isAttributeDeclared` δεν κάνει ποτέ έλεγχο
 * αληθοφάνειας.
 */
function renderFloor(t: TFunction, listing: PublicListing): string {
  return listing.floor === 0
    ? t('search-results:listing.groundFloor')
    : t('search-results:listing.floor', { value: listing.floor });
}

/** Πληθυντικός ICU — `0` είναι **γκαρσονιέρα**, υπαρκτή τιμή. */
function renderBedrooms(t: TFunction, listing: PublicListing): string {
  return t('search-results:listing.bedrooms', { count: listing.bedrooms ?? 0 });
}

/**
 * Τα **επίπεδα** — αριθμός που ζει μέσα σε δοχείο προέλευσης (ADR-842 Φ5 · §8 #7).
 *
 * ⚠️ **Η ΠΡΟΕΛΕΥΣΗ ΔΕΝ ΖΩΓΡΑΦΙΖΕΤΑΙ ΑΚΟΜΗ, ΚΑΙ ΕΙΝΑΙ ΔΗΛΩΜΕΝΟ.** Ένα σήμα
 * *«μετρημένο από το σχέδιο»* δίπλα στην τιμή είναι πραγματικό πλεονέκτημα έναντι
 * κάθε portal — και χρειάζεται **νέα κλειδιά i18n** σε διαδρομή με **σφραγισμένο
 * ταβάνι** (`/listing/[id]`, 9.181 bytes), δηλαδή **πράξη ανθρώπου** με γραπτό `why`
 * (ADR-744, CHECK 3.34). Ανήκει στη **Φ6**, όπου το `measured` παύει να είναι μία
 * περίπτωση και γίνεται ο κανόνας.
 *
 * 🔑 Το `?? 0` **δεν** υπάρχει εδώ επίτηδες: καλούμαστε μόνο για κλειδιά που το
 * `isAttributeDeclared` έκρινε δηλωμένα, και εκείνο ρωτά **και** το Α7. Μια σιωπηλή
 * προεπιλογή θα έκρυβε ασυμφωνία που πρέπει να είναι **αδύνατη**.
 */
function renderLevels(_t: TFunction, listing: PublicListing): string {
  return String(listing.levels?.value);
}

/**
 * Η **τιμή** ενός δηλωμένου στοιχείου, ως κείμενο οθόνης.
 *
 * ⚠️ Καλείται **μόνο** για κλειδιά που το `isAttributeDeclared` έκρινε δηλωμένα — γι'
 * αυτό δεν υπάρχουν εδώ `!` ούτε `?? ''` πάνω στην τιμή: θα ήταν σιωπηλή κάλυψη μιας
 * ασυμφωνίας που πρέπει να είναι **αδύνατη**, όχι κρυμμένη.
 */
export function attributeValue(
  t: TFunction,
  listing: PublicListing,
  key: ListingAttributeKey
): string {
  const spec = ATTRIBUTE_VALUE_KIND[key];

  switch (spec.kind) {
    case 'custom':
      return spec.render(t, listing);
    case 'sqm':
      return t('search-results:listing.areaSqm', { value: listing[key] });
    case 'enum':
      return vocabularyLabel(t, spec.vocabulary, String(listing[key]));
    case 'verbatim':
      return String(listing[key]);
  }
}
