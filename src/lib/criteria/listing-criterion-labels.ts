/**
 * @fileoverview **ΠΩΣ ΛΕΓΕΤΑΙ ΕΝΑΣ ΑΞΟΝΑΣ, ΚΑΙ ΠΩΣ ΛΕΓΕΤΑΙ ΜΙΑ ΤΙΜΗ ΤΟΥ** — στην οθόνη.
 * @related ADR-777 §8.51 (Στάδιο 3) · ADR-842 Φ3 · N.11 · N.18 (CHECK 3.28)
 * @module lib/criteria/listing-criterion-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΔΙΠΛΟΤΥΠΟ ΠΟΥ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΥΠΑΡΧΕΙ ΓΙΑ ΝΑ ΜΗ ΓΕΝΝΗΘΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το πάνελ φίλτρων πρέπει να γράψει *«Θέρμανση»* πάνω από μια στήλη τετραγωνιδίων και
 * *«Φυσικό αέριο»* δίπλα σε καθένα. Η **σελίδα του ακινήτου** γράφει ήδη ακριβώς
 * αυτές τις δύο λέξεις, σε γραμμή αντί σε τετραγωνίδιο.
 *
 * ⚠️ **Η προφανής γραφή ήταν δεύτερο `switch` εδώ**, και θα ήταν ο **ακριβής** δίδυμος
 * κλώνος που κυνηγά το CHECK 3.28. Το ελάττωμα δεν θα φαινόταν ποτέ σε μεταγλώττιση:
 * και οι δύο θα ήταν έγκυρες συμβολοσειρές. Θα φαινόταν την ημέρα που κάποιος αλλάζει
 * *«Θέρμανση»* σε *«Σύστημα θέρμανσης»* **σε ένα από τα δύο** — και το φίλτρο θα έλεγε
 * άλλη λέξη από την κάρτα, για το **ίδιο** πράγμα.
 *
 * ⇒ Εδώ **δεν γράφεται κείμενο**. Κάθε γραμμή δείχνει σε **υπάρχον** κλειδί:
 *
 * | Τι ονομάζεται | Από πού |
 * |---|---|
 * | οι 27 άξονες-στοιχεία | `listing-detail:attributes.label.*` — **οι ίδιες** ετικέτες με την οθόνη 3 |
 * | οι τιμές των 12 λεξιλογίων | `vocabularyLabel()` — η **μία** συνάρτηση, `lib/listings/listing-attribute-vocabulary` |
 * | τα είδη ακινήτου | `PROPERTY_TYPE_I18N_KEYS` — ο **ίδιος** πίνακας με τη `renderType` |
 * | οι διαθέσεις | `search-results:listing.offer.*` — **τα ίδια** κλειδιά με την κάρτα |
 *
 * **Νέο κείμενο γράφεται μόνο για τους 4 ειδικούς άξονες** *(τιμή · διάθεση · συγγραφή
 * · φωτογραφίες)*, γιατί εκείνοι **δεν είναι δημόσια στοιχεία** και δεν έχουν ετικέτα
 * στο μητρώο της οθόνης 3 — δες `BESPOKE_ASKING`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ ΚΥΡΙΟΛΕΚΤΙΚΑ ΠΡΟΘΕΜΑΤΑ ΚΑΙ ΟΧΙ ΠΙΝΑΚΑΣ ΠΛΗΡΩΝ ΚΛΕΙΔΙΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα `Record<CriterionKey, string>` με **πλήρη** κλειδιά και `t(TABLE[key])` μοιάζει
 * αυστηρότερο. **Είναι το αντίθετο**: ο γεννήτορας του i18n shell slice (ADR-744,
 * CHECK 3.34) αναλύει **στατικά** τις κλήσεις `t(…)`, και ένα κλειδί που φτάνει από
 * **μεταβλητή** είναι ανεπίλυτο — ο γεννήτορας αρνείται να εκπέμψει, ή (χειρότερα)
 * εκπέμπει slice **χωρίς** αυτά τα κλειδιά και η οθόνη βάφει **ωμό κλειδί**.
 *
 * 🔑 Με **κυριολεκτικό πρόθεμα** ο γεννήτορας βλέπει το υποδέντρο ολόκληρο και το
 * κουβαλά. Είναι το **ίδιο** ιδίωμα με το `vocabularyLabel` και με το
 * `ListingAttributeRow`, που το έχουν ήδη αποδείξει ζωντανά: το slice της
 * `/listing/[id]` κουβαλά **2.184 bytes** `properties-enums` και **1.332** `listing-detail`.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις πάνω σε `TFunction`. Καμία εξάρτηση από
 * React ή Firestore.
 */

import type { TFunction } from 'i18next';

import {
  isCanonicalPropertyType,
  PROPERTY_TYPE_I18N_KEYS,
} from '@/constants/property-types';
import {
  ATTRIBUTE_VOCABULARY,
  FEATURE_SET_VOCABULARY,
  vocabularyLabel,
  type AttributeVocabulary,
} from '@/lib/listings/listing-attribute-vocabulary';
import type { ListingAttributeGroup } from '@/lib/listings/listing-attribute-groups';
import type {
  ListingAttributeKey,
  ListingFeatureSetKey,
} from '@/lib/listings/listing-disclosure';

import type { CriterionKey, ValueSetCriterionKey } from './listing-criterion-asking';

// =============================================================================
// 1. ΤΟ ΟΝΟΜΑ ΤΟΥ ΑΞΟΝΑ
// =============================================================================

/**
 * Οι άξονες που **δεν είναι δημόσια στοιχεία** — άρα δεν έχουν ετικέτα στο μητρώο της
 * οθόνης 3 και χρειάζονται δική τους.
 *
 * 🔑 **Παράγεται με αφαίρεση, δεν ξαναγράφεται.** Μια χειρόγραφη ένωση
 * `'price' | 'offerKind' | …` θα ήταν **δεύτερη** δήλωση του `BESPOKE_ASKING`, και θα
 * έμενε σιωπηλά πίσω την ημέρα που γεννιέται πέμπτος ειδικός άξονας.
 */
export type BespokeCriterionKey = Exclude<
  CriterionKey,
  ListingAttributeKey | ListingFeatureSetKey
>;

/**
 * **Η ετικέτα κάθε ειδικού άξονα** — το μόνο νέο κείμενο αυτού του αρχείου.
 *
 * ⚠️ `Record<BespokeCriterionKey, string>` ⇒ νέος ειδικός άξονας **δεν
 * μεταγλωττίζεται** μέχρι να πάρει όνομα οθόνης. Ίδιος φρουρός με το
 * `LEDGER_KIND_KEYS` του `StayLedgerBar`, και για τον **ίδιο** μετρημένο λόγο.
 *
 * 🔑 Εδώ τα κλειδιά είναι **πλήρη και κυριολεκτικά** — και δεν αντιφάσκει με την
 * κεφαλίδα: το επιχείρημα του προθέματος αφορά **ανοιχτά** σύνολα τιμών, όπου ο
 * γεννήτορας χρειάζεται ολόκληρο το υποδέντρο. Εδώ τα μέλη είναι **τέσσερα και
 * γραμμένα**, οπότε ο σαρωτής της CHECK 3.8 τα βλέπει **ένα προς ένα** — αυστηρότερο.
 */
const BESPOKE_AXIS_LABEL_KEY: Record<BespokeCriterionKey, string> = {
  price: 'search-filters:filters.axis.price',
  offerKind: 'search-filters:filters.axis.offerKind',
  authorship: 'search-filters:filters.axis.authorship',
  hasPhotos: 'search-filters:filters.axis.hasPhotos',
};

/**
 * **Πώς λέγεται αυτός ο άξονας στην οθόνη.**
 *
 * 🔴 **Οι 27 δανείζονται τις ετικέτες της οθόνης 3 — ΑΥΤΟΥΣΙΕΣ, ΟΧΙ ΑΝΤΙΓΡΑΦΑ.** Το
 * φίλτρο *«Ενεργειακή κλάση»* και η γραμμή *«Ενεργειακή κλάση: B»* είναι η **ίδια**
 * λέξη για το **ίδιο** πεδίο· δύο μητρώα θα σήμαιναν ότι μια μέρα δεν θα είναι.
 */
export function criterionLabel(t: TFunction, key: CriterionKey): string {
  const bespoke = BESPOKE_AXIS_LABEL_KEY[key as BespokeCriterionKey];
  return bespoke === undefined
    ? t(`listing-detail:attributes.label.${key}`)
    : t(bespoke);
}

// =============================================================================
// 2. ΤΟ ΟΝΟΜΑ ΤΗΣ ΟΜΑΔΑΣ
// =============================================================================

/**
 * Η ομάδα των αξόνων που **δεν είναι δημόσια στοιχεία** — δες {@link BespokeCriterionKey}.
 *
 * 🔑 **Ονομασμένη σταθερά και όχι κυριολεκτικό `'listing'` σκορπισμένο**: εμφανίζεται
 * σε τρία σημεία *(διάταξη, ετικέτα, κλειδί React)* και μια αναντιστοιχία ανάμεσά τους
 * θα ήταν αόρατη — ίδιο ιδίωμα με τα `VERDICTS_KEEPING_THE_LISTING`.
 */
export const BESPOKE_CRITERION_GROUP = 'listing';

export type CriterionGroup = ListingAttributeGroup | typeof BESPOKE_CRITERION_GROUP;

/**
 * **Πώς λέγεται αυτή η ομάδα στην οθόνη.**
 *
 * 🔴 **Οι πέντε δανείζονται τις ετικέτες ομάδας της οθόνης 3** *(«Βασικά στοιχεία» ·
 * «Ενέργεια & κατάσταση» …)*, αυτούσιες. Η οθόνη 3 τις χρησιμοποιεί για να **ομαδοποιήσει
 * ό,τι δηλώθηκε**· η οθόνη 2 για να **ομαδοποιήσει ό,τι μπορεί να ζητηθεί** — ίδιες
 * ομάδες, ίδιες λέξεις, μία δήλωση.
 */
export function criteriaGroupLabel(t: TFunction, group: CriterionGroup): string {
  return group === BESPOKE_CRITERION_GROUP
    ? t('search-filters:filters.group.listing')
    : t(`listing-detail:attributes.group.${group}`);
}

// =============================================================================
// 3. ΤΟ ΟΝΟΜΑ ΜΙΑΣ ΤΙΜΗΣ
// =============================================================================

/**
 * Ο τρόπος που μια **επιλογή** γίνεται κείμενο.
 *
 * ⚠️ **`'verbatim'` ΔΕΝ είναι hardcoded string (N.11)** — είναι **σύμβολο κανονισμού**
 * που τυπώνεται αυτούσιο: το `A+` της ενεργειακής κλάσης δεν έχει μετάφραση, όπως το
 * `m²`. Ίδιο σκεπτικό με το ομώνυμο σκέλος του `ATTRIBUTE_VALUE_KIND`.
 */
type CriterionValueNaming =
  | { readonly kind: 'vocabulary'; readonly vocabulary: AttributeVocabulary }
  | { readonly kind: 'propertyType' }
  | { readonly kind: 'offerKind' }
  | { readonly kind: 'authorship' }
  | { readonly kind: 'verbatim' };

/**
 * **Κάθε άξονας με σχήμα συνόλου, και πώς ονομάζονται οι τιμές του.**
 *
 * 🔴 `Record<ValueSetCriterionKey, …>` ⇒ νέος άξονας λεξιλογίου **δεν
 * μεταγλωττίζεται** μέχρι να απαντηθεί *«πώς ονομάζεται η επιλογή;»*. Είναι η **τρίτη**
 * εγγύηση της ίδιας οικογένειας, δίπλα στο `CRITERION_VALUES` *(«ποιες τιμές
 * δέχεται;»)* και στο `CRITERION_PARAM` *(«πώς λέγεται στη διεύθυνση;»)* — τρία
 * ερωτήματα, **ένας** κατάλογος κλειδιών.
 *
 * ⚠️ **Τα λεξιλογικά σκέλη ΔΕΝ ξαναδηλώνουν το λεξιλόγιό τους** — το διαβάζουν από το
 * `ATTRIBUTE_VOCABULARY` / `FEATURE_SET_VOCABULARY`, τους **ίδιους** πίνακες που
 * διαβάζει η οθόνη 3. Ένα γραμμένο `vocabulary: 'heating'` εδώ θα ήταν δεύτερη δήλωση
 * του ίδιου γεγονότος — και η αστοχία της θα ήταν **αθόρυβη**.
 */
const CRITERION_VALUE_NAMING: Record<ValueSetCriterionKey, CriterionValueNaming> = {
  type: { kind: 'propertyType' },
  energyClass: { kind: 'verbatim' },
  condition: { kind: 'vocabulary', vocabulary: ATTRIBUTE_VOCABULARY.condition },
  heatingType: { kind: 'vocabulary', vocabulary: ATTRIBUTE_VOCABULARY.heatingType },
  heatingFuel: { kind: 'vocabulary', vocabulary: ATTRIBUTE_VOCABULARY.heatingFuel },
  coolingType: { kind: 'vocabulary', vocabulary: ATTRIBUTE_VOCABULARY.coolingType },
  waterHeating: { kind: 'vocabulary', vocabulary: ATTRIBUTE_VOCABULARY.waterHeating },
  windowFrames: { kind: 'vocabulary', vocabulary: ATTRIBUTE_VOCABULARY.windowFrames },
  glazing: { kind: 'vocabulary', vocabulary: ATTRIBUTE_VOCABULARY.glazing },
  flooring: { kind: 'vocabulary', vocabulary: FEATURE_SET_VOCABULARY.flooring },
  orientations: { kind: 'vocabulary', vocabulary: FEATURE_SET_VOCABULARY.orientations },
  interiorFeatures: {
    kind: 'vocabulary',
    vocabulary: FEATURE_SET_VOCABULARY.interiorFeatures,
  },
  securityFeatures: {
    kind: 'vocabulary',
    vocabulary: FEATURE_SET_VOCABULARY.securityFeatures,
  },
  amenities: { kind: 'vocabulary', vocabulary: FEATURE_SET_VOCABULARY.amenities },
  offerKind: { kind: 'offerKind' },
  authorship: { kind: 'authorship' },
};

/**
 * **Πώς λέγεται αυτή η επιλογή στην οθόνη.**
 *
 * ⚠️ **Το είδος ακινήτου περνά από έλεγχο κανονικότητας, και δεν είναι τελετουργία**:
 * το `PROPERTY_TYPE_I18N_KEYS` καλύπτει **μόνο** τα κανονικά είδη — μια παλιά ελληνική
 * τιμή θα έδινε `undefined` και ο περιηγητής θα ζωγράφιζε **ωμό κλειδί** μπροστά στον
 * ανώνυμο επισκέπτη *(η ίδια οικογένεια που κυνηγά το CHECK 3.51)*. Είναι το ίδιο
 * ελάττωμα που ο `isCanonicalPropertyType` γεννήθηκε για να κλείσει, στην κάρτα της
 * προσφοράς.
 *
 * 🔑 **Η επιστροφή είναι η ωμή τιμή, ΟΧΙ κενό**: ένα κενό τετραγωνίδιο δεν επιλέγεται
 * και δεν εξηγείται. Μια τιμή που δεν ξέρουμε να ονομάσουμε **φαίνεται όπως είναι** —
 * ειλικρινές, και ορατό στον πρώτο έλεγχο.
 */
export function criterionValueLabel(
  t: TFunction,
  key: ValueSetCriterionKey,
  value: string
): string {
  const naming = CRITERION_VALUE_NAMING[key];

  switch (naming.kind) {
    case 'vocabulary':
      return vocabularyLabel(t, naming.vocabulary, value);
    case 'propertyType':
      return isCanonicalPropertyType(value)
        ? t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[value]}`)
        : value;
    case 'offerKind':
      // ⚠️ **Τα ΙΔΙΑ κλειδιά με την κάρτα** (`ListingCard`), επίτηδες: η ετικέτα
      //    «Ενοικίαση» του φίλτρου και η ετικέτα «Ενοικίαση» της κάρτας είναι η ίδια
      //    δήλωση για το ίδιο πράγμα.
      return t(`search-results:listing.offer.${value}`);
    case 'authorship':
      return t(`search-filters:filters.authorship.${value}`);
    case 'verbatim':
      return value;
  }
}
