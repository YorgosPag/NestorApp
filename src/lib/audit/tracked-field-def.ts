/**
 * 📜 Το **ΣΧΗΜΑ** ενός tracked πεδίου — ADR-195 Φ11 · ADR-852 §4
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (2026-09-12).** Το `audit-diff.ts` είναι η **μηχανή**:
 * συγκρίνει δύο καταστάσεις και παράγει εγγραφές. Αυτό εδώ είναι το **σχήμα**: τι
 * ξέρει το σύστημα για ένα πεδίο. Δύο ευθύνες, δύο αρχεία (Google SRP).
 *
 * Η αφορμή ήταν μετρήσιμη: ο περιγραφέας του ADR-852 ανέβασε το `audit-diff.ts` σε
 * **559 γραμμές**, πάνω από το όριο των **500** (N.7.1) — και ο κανόνας του έργου για
 * το όριο είναι **ΕΞΑΓΩΓΗ, ΠΟΤΕ ΚΟΨΙΜΟ**: κανένα σχόλιο δεν θυσιάστηκε, όλα
 * μετακόμισαν αυτούσια. Το όριο δεν είναι αισθητικό· είναι ο τρόπος που ένα αρχείο
 * ομολογεί ότι απέκτησε δεύτερη δουλειά.
 *
 * ⚠️ **Η ΔΙΑΔΡΟΜΗ IMPORT ΔΕΝ ΑΛΛΑΞΕ ΓΙΑ ΚΑΝΕΝΑΝ.** Το `audit-diff.ts` **επανεξάγει**
 * τον τύπο, άρα και τα τέσσερα σημεία που τον εισάγουν από `@/lib/audit/audit-diff`
 * (και το `@/config/audit-tracked-fields`, που τον ξανα-επανεξάγει για τους ~60
 * καταναλωτές του) μένουν **ανέγγιχτα**. Ίδιο μοτίβο σταθερότητας διαδρομής με το
 * `ribbon-types.ts` → `@/constants/quantity-specs` (ADR-852 Φ1).
 *
 * @module lib/audit/tracked-field-def
 * @see docs/centralized-systems/reference/adrs/ADR-852-audit-field-descriptor-vocabulary.md — §4
 * @see ./audit-diff.ts — η μηχανή που το καταναλώνει
 */

// ADR-852 §4 — ο περιγραφέας δανείζεται ΥΠΑΡΧΟΝΤΑ SSoT αντί να ορίσει δικά του:
// η ποσότητα από τη ρίζα του λεξιλογίου (CHECK 3.73) και ο κατάλογος τιμών από το
// μητρώο που ήδη κρατά η σελίδα audit. Και τα δύο είναι type-only ⇒ σβήνονται στο
// build, καμία νέα εξάρτηση χρόνου εκτέλεσης για τον Admin SDK.
import type { AuditCatalogRef } from '@/config/audit-value-catalogs';
import type { QuantitySpec } from '@/constants/quantity-specs';

/**
 * ADR-852 §4 — **Ο ΠΕΡΙΓΡΑΦΕΑΣ**: ό,τι ξέρει το σύστημα για ένα tracked πεδίο, πέρα
 * από το όνομά του.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ.** Μέχρι το ADR-852 υπήρχε **μία** θέση (`label`) εκεί που η Revit
 * έχει **τρεις**: όνομα (`LabelUtils`) · **ποσότητα** (`SpecTypeId`) · μορφοποίηση
 * (`UnitFormatUtils`). Τα BIM registries γέμιζαν τη μοναδική θέση με **το ίδιο το όνομα
 * του πεδίου** (`width: 'width'`), και το `diffTrackedFields` το αντέγραφε σε κάθε
 * `AuditFieldChange` ⇒ **κάθε αποθηκευμένη εγγραφή κουβαλά μόνιμα `label: 'width'`**.
 * Το «kind: — → rectangular» που βλέπει ο χρήστης **ΕΙΝΑΙ** το τεκμηριωμένο fallback του
 * ADR-195 Risk 6 να πυροδοτείται: ο σχεδιασμός το προέβλεψε, κανείς δεν έφτιαξε ποτέ το
 * μητρώο από το οποίο θα προέκυπτε η ετικέτα. Μετρημένο κενό: **133 από 279** πεδία,
 * **17** οντότητες με μηδενική κάλυψη.
 *
 * ⚠️ **ΚΑΘΕ ΝΕΟ ΠΕΔΙΟ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΟ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ**: ό,τι δεν
 * δηλώνεται συμπεριφέρεται **ΑΚΡΙΒΩΣ όπως σήμερα**, μηδέν αλλαγή για τα 279 πεδία και
 * για κάθε ήδη γραμμένη εγγραφή. Η ασυμμετρία είναι η ίδια με του ADR-677 §7.2:
 * ξεχασμένη δήλωση = **ορατό ωμό** (μια γραμμή διόρθωση), ποτέ **σιωπηλή αλλοίωση**.
 *
 * ⚠️ **ΜΗΝ γράψεις ποτέ `quantity: undefined` στο Firestore.** Το `removeUndefinedValues`
 * **δεν μπαίνει σε πίνακες** (`search-index-config.ts:47`), το `changes[]` γράφεται
 * αυτούσιο, και το `ignoreUndefinedProperties` δεν ορίζεται πουθενά ⇒ το write του Admin
 * SDK θα έσκαγε. Τα νέα πεδία μπαίνουν **μόνο** με conditional spread (ADR-852 §4.4).
 */
interface TrackedFieldDescriptor {
  /**
   * Ετικέτα όπως **γράφεται** στην εγγραφή του audit. Στα BIM registries ισούται
   * ιστορικά με το όνομα του πεδίου — δες παραπάνω γιατί.
   */
  readonly label: string;
  /**
   * Κλειδί i18n της ετικέτας. **Προτιμάται** του `label` κατά την ανάγνωση.
   *
   * 🔑 Η **ζωντανή** πλευρά του διπλού καναλιού (ADR-852 §3.1): λύνεται στη γλώσσα
   * **του θεατή**, άρα Έλληνας και Άγγλος βλέπουν ο καθένας τη δική του και μια
   * μελλοντική καλύτερη μετάφραση **θεραπεύει αναδρομικά** και το ήδη γραμμένο
   * ιστορικό. Το αποθηκευμένο `label` μένει ως **τίμιο στιγμιότυπο** για πεδίο που
   * μετονομάστηκε ή αποσύρθηκε — γι' αυτό κρατιούνται **και τα δύο**, όχι το ένα.
   */
  readonly labelKey?: string;
  /**
   * **Τι ποσότητα** είναι ο αριθμός — το `SpecTypeId` της Revit. Χωρίς αυτό, το
   * `749.9999999999927` **δεν μπορεί** να γίνει «0,750 m»: ο reader δεν έχει τρόπο να
   * μάθει ότι πρόκειται για μήκος αποθηκευμένο σε canonical mm (ADR-462).
   */
  readonly quantity?: QuantitySpec;
  /**
   * Ο κατάλογος i18n που μεταφράζει τις **τιμές** ενός enum πεδίου (`rectangular` →
   * «Ορθογωνική»). **Ο ίδιος** τύπος με το `AUDIT_VALUE_CATALOGS`, επίτηδες: δεύτερη
   * έννοια «καταλόγου τιμών» θα ήταν ακριβώς ο διπλασιασμός που το ADR-195 έλυσε.
   */
  readonly enumCatalog?: AuditCatalogRef;
  /**
   * Το πεδίο κρατά **ξένο κλειδί**: η αποθηκευμένη τιμή είναι id και το όνομα λύνεται
   * τη στιγμή της ανάγνωσης. Χωρίς αυτό ο χρήστης βλέπει `layerId: — → lvl_66e6611c-…`.
   *
   * ⚠️ Κλειστό σύνολο με **μόνο** όσα υπάρχουν σήμερα: το `diffFieldsWithResolution`
   * καλείται σε 4 σημεία, **κανένα BIM** (γι' αυτό κανένα `newValueLabel`). Η επίλυση
   * είναι δουλειά της Φ5 — εδώ δηλώνεται μόνο **τι είδους** πράγμα δείχνει το id.
   */
  readonly fk?: 'layer' | 'storey';
}

/**
 * Schema for one tracked field. The `kind` discriminator routes the diff
 * engine between scalar comparison and collection-aware reconciliation.
 *
 * - `scalar` — single primitive (string/number/bool/null) or opaque object.
 *   Produces `oldValue → newValue` entries (legacy behavior).
 * - `collection` — array of items. The diff engine reconciles by `keyBy`
 *   and produces granular added/removed/modified entries.
 *
 * As of this commit, ALL fields are declared `scalar`. Array fields will be
 * flipped to `collection` together with the engine that understands them.
 */
export type TrackedFieldDef =
  | (TrackedFieldDescriptor & { readonly kind: 'scalar' })
  | (TrackedFieldDescriptor & {
      readonly kind: 'collection';
      /**
       * Stable identity for collection items.
       * - `'value'` — the element itself is the key (primitive arrays).
       * - `string` — read this property from each item (e.g. `'id'`).
       * - `readonly string[]` — composite key, joined by `|`.
       */
      readonly keyBy: 'value' | string | readonly string[];
      /** Item fields concatenated to form the human display label. */
      readonly labelFields?: readonly string[];
      /** Separator between `labelFields` (default `' — '`). */
      readonly labelSeparator?: string;
      /** Sub-fields tracked for `op === 'modified'` entries. */
      readonly trackSubFields?: readonly string[];
      /** Optional human-readable label overrides per sub-field (used instead of i18n fallback). */
      readonly subFieldLabels?: Readonly<Record<string, string>>;
    });
