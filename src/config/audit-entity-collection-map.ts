/**
 * Audit entity routing — **ΟΙ ΠΡΟΒΟΛΕΣ ΤΟΥ ΜΗΤΡΩΟΥ** (ADR-195 · ADR-852 §4.9).
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ
 *
 * Μέχρι τις 13/09 αυτό το αρχείο κρατούσε **χειρόγραφο** χάρτη `entityType →
 * collection` με `satisfies Partial<Record<…>>`, και το `VALID_ENTITY_TYPES`
 * παραγόταν από τα κλειδιά του. Το `Partial` ήταν ακριβώς η τρύπα: **επέτρεπε**
 * στον χάρτη να είναι ελλιπής, και ο μεταγλωττιστής δεν είχε λόγο να διαφωνήσει.
 *
 * 🔴 **ΤΟ ΚΟΣΤΟΣ, ΜΕΤΡΗΜΕΝΟ**: **έξι** οντότητες με ζωντανό audit-client
 * (`railing` · `floorplan-symbol` · `mep-radiator` · `mep-boiler` ·
 * `mep-water-heater` · `mep-underfloor`) έλειπαν από τον χάρτη ⇒ κάθε POST τους
 * γύριζε **400 «Invalid entityType»** ⇒ το `.catch(() => {})` του fire-and-forget
 * το κατάπινε ⇒ **το ιστορικό τους δεν γράφτηκε ΠΟΤΕ**. Οι συλλογές τους υπήρχαν.
 *
 * ✅ **Πλέον κάθε export εδώ είναι ΠΡΟΒΟΛΗ** του `config/audit-entity-registry.ts`.
 * Δεν υπάρχει δεύτερη λίστα να ξεχαστεί: μια νέα οντότητα μπαίνει **μία** φορά
 * στο μητρώο και εμφανίζεται εδώ **αυτόματα**.
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ **ΜΗΝ ξαναγράψεις χειρόγραφο χάρτη τύπων οντότητας** — ούτε εδώ, ούτε σε
 * route, ούτε σε service. Ήταν **τέσσερις** και κανείς δεν τους έδενε· αυτό
 * ακριβώς γέννησε τη βλάβη. Κάθε νέα όψη γράφεται ως **παράγωγο του μητρώου**.
 *
 * @module config/audit-entity-collection-map
 * @see src/config/audit-entity-registry.ts — Η ΜΙΑ δήλωση
 * @see docs/centralized-systems/reference/adrs/ADR-852-audit-field-descriptor-vocabulary.md — §4.9
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { AUDIT_ENTITIES, type AuditEntityType } from '@/config/audit-entity-registry';

/** Τα ζεύγη του μητρώου, μία φορά — κάθε προβολή παρακάτω χτίζεται από εδώ. */
const ENTRIES = Object.entries(AUDIT_ENTITIES) as ReadonlyArray<
  readonly [AuditEntityType, (typeof AUDIT_ENTITIES)[AuditEntityType]]
>;

/**
 * Entity types που ζουν σε per-company subcollection
 * (`companies/{companyId}/<collection>/{id}`) αντί για top-level συλλογή.
 *
 * **Παράγεται** — δεν δηλώνεται. Παλιότερα ήταν χειρόγραφο `Set` και έπρεπε να το
 * θυμηθεί όποιος πρόσθετε subcollection-scoped οντότητα.
 */
export const SUBCOLLECTION_ENTITY_TYPES: ReadonlySet<string> = new Set(
  ENTRIES.filter(([, spec]) => spec.scope === 'subcollection').map(([type]) => type),
);

/**
 * `entityType → Firestore collection` για επαλήθευση κατοχής στο
 * `/api/audit-trail/record`.
 *
 * ⚠️ Ο τύπος μένει `Record<string, string | undefined>` **επίτηδες**: το route το
 * ευρετηριάζει με το **ωμό** `body.entityType` (τιμή από το δίκτυο), και το
 * `undefined` για άγνωστο τύπο **είναι** ο runtime φρουρός. Ένα σφιχτότερο
 * `Record<AuditEntityType, string>` θα υποσχόταν ασφάλεια που η είσοδος δεν έχει.
 *
 * ⚠️ Οντότητες **χωρίς δικό τους έγγραφο** (τηλεμετρία 3D) έχουν `collectionKey:
 * null` στο μητρώο και **δεν** εμφανίζονται εδώ — άρα ο route τις απορρίπτει, που
 * είναι το σωστό: δεν υπάρχει έγγραφο του οποίου να επαληθευτεί η κατοχή.
 */
export const ENTITY_COLLECTION_MAP: Record<string, string | undefined> =
  Object.fromEntries(
    ENTRIES
      .filter(([, spec]) => spec.collectionKey !== null)
      .map(([type, spec]) => [type, COLLECTIONS[spec.collectionKey as keyof typeof COLLECTIONS]]),
  );

/**
 * Valid audit entity types — **ΠΑΡΑΓΕΤΑΙ** από τα κλειδιά του χάρτη (SSoT).
 * Ένας τύπος δεν μπορεί ποτέ να είναι «έγκυρος» χωρίς συλλογή να επαληθευτεί.
 */
export const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set(Object.keys(ENTITY_COLLECTION_MAP));

/**
 * Τύποι που δέχεται η **εταιρική πόρτα γραφής** `/api/audit-trail/record` (ADR-864 Φ1β).
 *
 * 🔴 **Εξαιρεί το βιβλίο `'custody'`, και είναι απαίτηση ασφάλειας.** Η πόρτα γράφει το
 * `companyId` του **καλούντος**· για οντότητα που η εμβέλειά της παράγεται από τη
 * θεματοφυλακή του εγγράφου (αγγελία ιδιώτη ⇒ `userId`) αυτό θα ήταν **λάθος βιβλίο** —
 * και ο κλάδος `deleted` δέχεται ανύπαρκτο έγγραφο, άρα δεν υπάρχει θεματοφυλακή να ρωτηθεί.
 * Τέτοιες οντότητες γράφονται **μόνο** από τον server γραφέα τους.
 */
export const RECORDABLE_ENTITY_TYPES: ReadonlySet<string> = new Set(
  ENTRIES
    .filter(([type, spec]) => VALID_ENTITY_TYPES.has(type) && spec.ledger === 'company')
    .map(([type]) => type),
);

/**
 * **Κάθε** τύπος του μητρώου — ό,τι επιτρέπεται να **διαβαστεί** (ADR-864 Φ1β).
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΠΡΟΒΟΛΗ ΑΠΟ ΤΟ `VALID_ENTITY_TYPES`**: εκείνο απαντά *«υπάρχει
 * έγγραφο να επαληθευτεί η κατοχή;»* (ερώτηση **γραφής**). Η ανάγνωση ρωτά κάτι άλλο:
 * *«είναι αυτός τύπος ιστορικού;»*. Μέχρι τις 2026-09-16 οι δύο διαδρομές ανάγνωσης
 * κρατούσαν **χειρόγραφα** σύνολα (**6** και **9** τύποι) ενώ το `ActivityTab` καλεί τη
 * σελιδοποίηση για **κάθε** τύπο ⇒ το «φόρτωσε περισσότερα» σε τοίχο/κολόνα/παραγγελία
 * γύριζε **400**. Πέμπτη εμφάνιση της κλάσης του ADR-852 §4.9.
 */
export const AUDIT_ENTITY_TYPES: ReadonlySet<string> = new Set(ENTRIES.map(([type]) => type));

/**
 * `entityType → collection` για τη διάδοση μετονομασίας στα ονόματα αρχείων
 * (ADR-293 Φ8). Κενή συμβολοσειρά = «δεν υποστηρίζει διάδοση», όπως και πριν.
 *
 * 🔴 **ΕΞΑΝΤΛΗΤΙΚΟ ΕΚ ΚΑΤΑΣΚΕΥΗΣ.** Ο καταναλωτής του το χρησιμοποιεί **και** ως
 * runtime validator (`value in MAP`), άρα ένα μέλος που λείπει δεν ήταν «κενό
 * πεδίο» — ήταν **400 για υπαρκτή οντότητα**. Ακριβώς αυτό συνέβη στα `furniture`
 * / `imported-mesh` / `generic-solid` επί δύο μήνες.
 */
export const RENAME_PROPAGATION_MAP: Readonly<Record<AuditEntityType, string>> =
  Object.fromEntries(
    ENTRIES.map(([type, spec]) => [
      type,
      spec.renamePropagation && spec.collectionKey !== null
        ? COLLECTIONS[spec.collectionKey as keyof typeof COLLECTIONS]
        : '',
    ]),
  ) as Record<AuditEntityType, string>;

/**
 * `entityType → COLLECTIONS **key**` για το incremental backup manifest.
 *
 * ⚠️ Κρατά το **κλειδί**, όχι την τιμή — ο καταναλωτής κάνει
 * `COLLECTIONS[key]` ο ίδιος. Αυτή η διαφορά είναι ο λόγος που το μητρώο δηλώνει
 * `collectionKey` αντί για έτοιμο όνομα συλλογής: **δύο** καταναλωτές θέλουν
 * **δύο** όψεις της ίδιας δήλωσης, και έτσι καμία από τις δύο δεν είναι αντίγραφο.
 */
export const BACKUP_COLLECTION_KEY_MAP: Readonly<Record<AuditEntityType, string>> =
  Object.fromEntries(
    ENTRIES.map(([type, spec]) => [
      type,
      spec.backup && spec.collectionKey !== null ? spec.collectionKey : '',
    ]),
  ) as Record<AuditEntityType, string>;
