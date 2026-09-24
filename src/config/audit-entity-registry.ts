/**
 * ADR-852 **Φ4α** — ΤΟ ΜΗΤΡΩΟ ΤΩΝ ΟΝΤΟΤΗΤΩΝ ΠΟΥ ΓΡΑΦΟΥΝ ΙΣΤΟΡΙΚΟ.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΑΠΑΝΤΑ — ΚΑΙ ΤΟ ΜΟΝΟ
 *
 *   ✅ *«**ΠΟΥ ΖΕΙ** το έγγραφο αυτής της οντότητας, και **ποιες υποδομές** την
 *       αναγνωρίζουν;»*
 *   ⛔ **ΟΧΙ** *«ποιος γράφει — service ή CDC trigger;»* → `audit-cdc-coverage.ts`
 *   ⛔ **ΟΧΙ** *«ποια πεδία της παρακολουθούνται;»* → `audit-tracked-fields.ts`
 *   ⛔ **ΟΧΙ** *«πώς λέγεται στην οθόνη;»* → i18n `audit.entityTypes.*`
 *
 * Τέσσερα ερωτήματα, τέσσερα σπίτια *(δόγμα ADR-812 §6)*. Η συγχώνευσή τους θα
 * έδενε το **πού ζει** με το **ποιος γράφει**, και τότε μια οντότητα δεν θα
 * μπορούσε να αλλάξει συγγραφέα χωρίς να μετακομίσει.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ — **ΤΕΣΣΕΡΙΣ ΛΙΣΤΕΣ, ΚΑΝΕΝΑΣ ΔΕΝ ΤΙΣ ΕΔΕΝΕ** (μετρημένο 13/09)
 *
 * Ο τύπος οντότητας δηλωνόταν σε **τέσσερα** ανεξάρτητα σώματα:
 *
 *   | σώμα | τι κρατούσε | κατάσταση 13/09 |
 *   |---|---|---|
 *   | `types/audit-trail.ts` | το union | **40** μέλη |
 *   | `config/audit-entity-collection-map.ts` | `Partial<Record<…>>` | **19** κλειδιά |
 *   | `api/files/propagate-entity-rename` | **εξαντλητικό** `Record<…>` | **37** κλειδιά |
 *   | `services/backup/incremental-backup` | **εξαντλητικό** `Record<…>` | **37** κλειδιά |
 *
 * Τα δύο τελευταία είναι **δίδυμα** — ίδια κλειδιά, παράλληλα σχόλια — και
 * σταμάτησαν να ενημερώνονται στο `f2af8c5f` *(11/06)*, ενώ το union μεγάλωσε
 * κατά τρία στο `e066fbea` *(22/07)*. **Ένας μήνας απόκλισης, σε τύπο που
 * δηλώνεται εξαντλητικός.**
 *
 * 🔴 **ΚΑΙ Η ΖΗΜΙΑ ΗΤΑΝ ΖΩΝΤΑΝΗ, ΟΧΙ ΘΕΩΡΗΤΙΚΗ.** Το `VALID_ENTITY_TYPES`
 * **παράγεται** από τα κλειδιά του δεύτερου σώματος, άρα **έξι** οντότητες με
 * ζωντανό audit-client έπαιρναν **400 «Invalid entityType»** σε κάθε
 * δημιουργία/αλλαγή/διαγραφή — και το `.catch(() => {})` του fire-and-forget το
 * κατάπινε: `railing` · `floorplan-symbol` · `mep-radiator` · `mep-boiler` ·
 * `mep-water-heater` · `mep-underfloor`. **Το ιστορικό τους δεν γράφτηκε ΠΟΤΕ.**
 *
 * ⚠️ **ΤΕΤΑΡΤΗ ΕΜΦΑΝΙΣΗ ΤΗΣ ΙΔΙΑΣ ΚΛΑΣΗΣ**: το ίδιο σχήμα χτύπησε στο `stair`
 * (ADR-380), στο `mep-fixture` (ADR-408) και στα `imported-mesh`/`furniture`
 * (ADR-684). Κάθε φορά διορθώθηκε **το δείγμα** — μια γραμμή στον χάρτη — και
 * κάθε φορά ξαναγύρισε. Αυτό το αρχείο διορθώνει **την κλάση**: υπάρχει **μία**
 * δήλωση ανά οντότητα, και κάθε άλλη όψη **παράγεται** από εδώ.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ *(ερευνήθηκε 13/09)*
 *
 * · **Revit** — οι *categories* είναι η **μία** ταξινομία στοιχείων, και η
 *   αντιστοίχιση προς IFC ζει σε **έναν** πίνακα (`exportlayers-ifc-IAI.txt`).
 *   Σωστό δόγμα — αλλά ο πίνακας είναι **αρχείο κειμένου δίπλα στο προϊόν**:
 *   τίποτα δεν εμποδίζει μια κατηγορία να λείπει από αυτόν.
 * · **GitLab** — ορίζει κάθε τύπο audit event σε **YAML** ως single-source-of-truth.
 * · **AWS EventBridge / CUE** — ορισμός μία φορά, **παραγωγή** τύπων με codegen.
 *
 * 🔑 **Η δική μας εκδοχή είναι αυστηρότερη, και ο λόγος είναι δομικός**: YAML και
 * codegen παράγουν **αρχείο**, και ένα παραγόμενο αρχείο **μπαγιατεύει** όταν
 * κανείς δεν ξανατρέξει τον γεννήτορα — κόστος που το έργο έχει **ήδη πληρώσει**
 * *(CHECK 3.33: το `src/types/i18n.ts` έμεινε μπαγιάτικο **τέσσερις μήνες**)*.
 * Εδώ ο «γεννήτορας» είναι ο **ίδιος ο μεταγλωττιστής**: το union **είναι**
 * `keyof typeof AUDIT_ENTITIES`, άρα δεν υπάρχει στιγμή στην οποία να διαφωνούν.
 * Η απόκλιση δεν είναι *ανιχνεύσιμη* — είναι **μη εκφράσιμη**.
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ ΓΙΑΤΙ **ΔΕΝ** ΕΙΝΑΙ ΡΙΖΑ ΛΕΞΙΛΟΓΙΟΥ ADR-812 / CHECK 3.73 — **ΜΕΤΡΗΘΗΚΕ**
 *
 * Η πρώτη πρόθεση ήταν να δηλωθεί ως **τέταρτη ρίζα** στο `.domain-vocabulary.json`.
 * **Απορρίφθηκε από μέτρηση**: ο σαρωτής της πύλης, με το υποχρεωτικό κατώφλι,
 * βρήκε **132 αδέσμευτες δηλώσεις** σε 16.601 αρχεία — και σχεδόν όλες είναι
 * **νόμιμα άλλα λεξιλόγια** που απλώς μοιράζονται λέξεις τομέα: `FileEntityType`
 * [5/5], `PhotosTabEntityType` [7/7], `BimCategory` [8/35], `ToolType` **[8/211]**.
 * Το τελευταίο το δείχνει γυμνό: **8 συμπτώσεις σε 211 τιμές** = θόρυβος.
 *
 * 🔑 Ο λόγος είναι δομικός: το CHECK 3.73 φτιάχτηκε για κλειστά σύνολα με
 * **ιδιαίτερες** τιμές (`on_hold`, `tee`, `model-length`)· εδώ οι τιμές είναι
 * **κοινές λέξεις του τομέα** (`project`, `wall`, `slab`). Δήλωση εκεί θα
 * απαιτούσε **132 εξαιρέσεις με αιτιολόγηση** — δηλαδή θα κατέστρεφε την πύλη
 * για να περάσει. **Αυτό δεν είναι λεξιλόγιο τομέα· είναι μητρώο υποδομής**, και
 * ο φύλακάς του είναι ο μεταγλωττιστής, που εδώ είναι **ισχυρότερος**.
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ **LAYERING — ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ TYPE-ONLY ΩΣ ΠΡΟΣ ΤΟ `COLLECTIONS`, ΕΠΙΤΗΔΕΣ.**
 *
 * Κρατά **το κλειδί** (`'FLOORPLAN_WALLS'`), όχι την τιμή. Δύο λόγοι, και οι δύο
 * μετρημένοι:
 *   1. Οι καταναλωτές θέλουν **διαφορετικές όψεις**: το audit route θέλει την
 *      **τιμή** (`COLLECTIONS[key]`), το incremental backup θέλει **το κλειδί**.
 *      Μία δήλωση, δύο προβολές — αντί για δύο δηλώσεις που διαφωνούν.
 *   2. Το `types/audit-trail.ts` διαβάζει αυτό το αρχείο με `import type`, ώστε
 *      το union να παράγεται **χωρίς** να αποκτήσει το `types/` runtime εξάρτηση.
 *      Μετρήθηκε: **35** αρχεία εισάγουν το `types/audit-trail`, **όλα** με
 *      `import type`, και το `functions/` (άλλο tsconfig) **δεν** το εισάγει καθόλου.
 *
 * @module config/audit-entity-registry
 * @see docs/centralized-systems/reference/adrs/ADR-852-audit-field-descriptor-vocabulary.md — §4.9
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import type { COLLECTIONS } from '@/config/firestore-collections';

/** Κλειδί του καταλόγου συλλογών — **παράγεται**, ποτέ χειρόγραφη ένωση. */
export type FirestoreCollectionKey = keyof typeof COLLECTIONS;

/**
 * Πού ζει το έγγραφο της οντότητας.
 *
 * ⚠️ Το `'subcollection'` σημαίνει `companies/{companyId}/<collection>/{id}` — ο
 * audit route χτίζει **άλλη** διαδρομή γι' αυτές (ADR-412 Φ5).
 */
export type AuditEntityScope = 'top-level' | 'subcollection';

/**
 * **Ποιος** στέλνει την εγγραφή ιστορικού. Δεν είναι διακοσμητικό: καθορίζει αν
 * η οντότητα περνά από τον φρουρό του `/api/audit-trail/record`.
 *
 * · `'client-post'` — thin client κάνει POST στο route ⇒ **υποχρεωτικά** πρέπει να
 *   έχει `collectionKey`, αλλιώς παίρνει 400 και το ιστορικό χάνεται **σιωπηλά**.
 * · `'server-direct'` — server service καλεί `EntityAuditService.recordChange`
 *   απευθείας (`import 'server-only'`) ⇒ **δεν** αγγίζει το route.
 * · `'none'` — δεν γράφεται ιστορικό γι' αυτή την οντότητα σήμερα.
 */
export type AuditEntityWriter = 'client-post' | 'server-direct' | 'none';

/**
 * **Σε ποιο βιβλίο γράφεται το ιστορικό** — ADR-195 §«Προσωπικό βιβλίο» · ADR-864 Φ1β.
 *
 * · `'company'` — η εγγραφή φέρει **πάντα** `companyId`: του καλούντος στο
 *   `/api/audit-trail/record`, ή του service που την καταγράφει. Είναι ό,τι ίσχυε για
 *   **κάθε** οντότητα ως τις 2026-09-16.
 * · `'custody'` — η εμβέλεια **παράγεται από τη θεματοφυλακή του εγγράφου** (π.χ.
 *   `custodyOf` της αγγελίας): `companyId` **ή** `userId`, ποτέ και τα δύο. Ο ιδιώτης
 *   χωρίς εταιρεία έχει έτσι ίχνος που διαβάζει **μόνο ο ίδιος**.
 *
 * 🔴 **Γιατί στήλη και όχι σύμβαση**: το `/api/audit-trail/record` είναι **εταιρική**
 * πόρτα (`withAuth`) και γράφει το `companyId` του καλούντος. Για οντότητα `'custody'`
 * αυτό θα ήταν **λάθος εμβέλεια** — και ο κλάδος `deleted` δέχεται ανύπαρκτο έγγραφο,
 * άρα δεν υπάρχει καν θεματοφυλακή να ρωτηθεί. Η στήλη κάνει την άρνηση **προβολή του
 * μητρώου** (`RECORDABLE_ENTITY_TYPES`), όχι έλεγχο που κάποιος θυμάται.
 *
 * ⚠️ `'custody'` ⇒ **υποχρεωτικά** `writer: 'server-direct'` — το φυλάει άγκυρα.
 */
export type AuditLedger = 'company' | 'custody';

/** Η δήλωση μιας οντότητας — **μία** γραμμή, όλες οι όψεις. */
export interface AuditEntitySpec {
  /**
   * Το κλειδί της συλλογής όπου ζει το έγγραφο, ή `null` όταν η οντότητα **δεν
   * έχει δικό της έγγραφο** (τηλεμετρία/σχολιασμοί που ζουν αλλού).
   *
   * ⚠️ `null` ⇒ ο audit route **θα απορρίψει** POST γι' αυτήν. Αυτό είναι σωστό
   * για `'server-direct'`/`'none'`, και **βλάβη** για `'client-post'` — γι' αυτό
   * το ζεύγος το φυλάει άγκυρα.
   */
  readonly collectionKey: FirestoreCollectionKey | null;
  readonly scope: AuditEntityScope;
  readonly writer: AuditEntityWriter;
  /** Σε ποιο βιβλίο γράφεται το ιστορικό — δες {@link AuditLedger}. */
  readonly ledger: AuditLedger;
  /** Μεταφέρεται η μετονομασία της στα ονόματα των αρχείων της; (ADR-293 Φ8) */
  readonly renamePropagation: boolean;
  /** Μπαίνει στο incremental backup manifest; (ADR-195) */
  readonly backup: boolean;
}

// =============================================================================
// ΤΟ ΜΗΤΡΩΟ — εδώ δηλώνεται κάθε οντότητα, και ΜΟΝΟ εδώ
// =============================================================================

/**
 * **Η ΜΙΑ ΔΗΛΩΣΗ.** Κάθε άλλη λίστα τύπων οντότητας στο έργο **παράγεται** από
 * εδώ — το union, ο χάρτης συλλογών, το `VALID_ENTITY_TYPES`, τα subcollections,
 * ο χάρτης μετονομασίας, ο χάρτης backup.
 *
 * ⚠️ **ΠΡΟΣΘΕΤΕΙΣ ΝΕΑ ΟΝΤΟΤΗΤΑ ΕΔΩ, ΚΑΙ ΠΟΥΘΕΝΑ ΑΛΛΟΥ.** Αν ξεχάσεις πεδίο, δεν
 * μεταγλωττίζεται. Αν γράψεις λάθος `collectionKey`, δεν μεταγλωττίζεται. Αν
 * δηλώσεις `'client-post'` χωρίς `collectionKey`, **κοκκινίζει άγκυρα** — γιατί
 * ακριβώς αυτός ο συνδυασμός είναι που έκρυψε έξι οντότητες επί μήνες.
 *
 * ⚠️ Η σειρά είναι **σημασιολογική**: πρώτα ο επιχειρησιακός κόσμος (CRM/
 * προμήθειες), μετά το BIM ανά πειθαρχία, τελευταία η τηλεμετρία.
 */
export const AUDIT_ENTITIES = {
  // ── Επιχειρησιακός κόσμος — γράφεται από server services ──────────────────
  contact: { collectionKey: 'CONTACTS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: true, backup: true },
  company: { collectionKey: 'COMPANIES', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },
  project: { collectionKey: 'PROJECTS', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },
  building: { collectionKey: 'BUILDINGS', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },
  floor: { collectionKey: 'FLOORS', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },
  property: { collectionKey: 'PROPERTIES', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },
  parking: { collectionKey: 'PARKING_SPACES', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },
  storage: { collectionKey: 'STORAGE', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },

  /**
   * 🎯 ADR-864 Φ1β — **η αγγελία ιδιοκτήτη**, η πρώτη οντότητα με βιβλίο `'custody'`.
   * Ιδιώτης ⇒ `userId` · γραφείο ⇒ `companyId`, από το `custodyOf` (CHECK 3.56). Όλες οι
   * πράξεις περνούν από το `persist()` του `owner-property-write.service.ts`.
   * `renamePropagation: false` — τα αρχεία της δεν ονομάζονται από τον τίτλο.
   */
  owner_property: { collectionKey: 'OWNER_PROPERTIES', scope: 'top-level', writer: 'server-direct', ledger: 'custody', renamePropagation: false, backup: true },
  /**
   * 🗂️ ADR-866 Φ1.1 — **ο φάκελος του ακινήτου**, η δεύτερη οντότητα βιβλίου `'custody'`: ο
   * κάτοχος (`userId`) διαβάζει το ιστορικό του στο **προσωπικό** βιβλίο. Κάθε γραφή περνά από το
   * `property-dossier-write.service.ts` (ίχνος μέσω `recordTrackedEntityWrite`).
   */
  property_dossier: { collectionKey: 'PROPERTY_DOSSIERS', scope: 'top-level', writer: 'server-direct', ledger: 'custody', renamePropagation: false, backup: true },

  /**
   * 💬 ADR-867 Β5 — **η ομάδα της πράξης** (ποιος απαντά από το γραφείο). Βιβλίο `'company'`
   * = ο χώρος που **φιλοξενεί** την πράξη (`hostCompanyId`). Κάθε αλλαγή μετά τη γέννηση —
   * ανθρώπινη ή μεταβίβαση — περνά από το `commitActTeamVersion` του `act-team-writer.ts` και
   * γράφει ίχνος: ADR-834 (ε) ② «ο διαχειριστής αλλάζει υπεύθυνο ή προσθέτει μέλη — **με ίχνος**».
   */
  network_act_team: { collectionKey: 'NETWORK_ACT_TEAMS', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: false, backup: true },

  /**
   * ⚠️ `parking_spot` / `storage_unit`: **παλαιά συνώνυμα** των `parking`/`storage`
   * που δείχνουν στην **ίδια** συλλογή. Διατηρούνται επειδή υπάρχουν γραμμένες
   * εγγραφές με αυτά τα ονόματα — αφαίρεση θα έκανε το παλιό ιστορικό **αδιάβαστο**.
   */
  parking_spot: { collectionKey: 'PARKING_SPACES', scope: 'top-level', writer: 'none', ledger: 'company', renamePropagation: true, backup: true },
  storage_unit: { collectionKey: 'STORAGE', scope: 'top-level', writer: 'none', ledger: 'company', renamePropagation: true, backup: true },

  // ── Προμήθειες (ADR-332 / procurement) ────────────────────────────────────
  purchase_order: { collectionKey: 'PURCHASE_ORDERS', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },
  quote: { collectionKey: 'QUOTES', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },
  /** ADR-876 §5 Σ9 — πρόσκληση προμηθευτή: έκδοση/ανάκληση συνδέσμων + ανάκληση πρόσκλησης, με ίχνος (ΠΟΤΕ το token). */
  vendor_invite: { collectionKey: 'VENDOR_INVITES', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: false, backup: true },
  material: { collectionKey: 'MATERIALS', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },
  framework_agreement: { collectionKey: 'FRAMEWORK_AGREEMENTS', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },

  // ── Μηχανή κειμένου (ADR-651 / ADR-344) — server-only services ────────────
  text_template: { collectionKey: 'TEXT_TEMPLATES', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },
  custom_dictionary_entry: { collectionKey: 'TEXT_CUSTOM_DICTIONARY', scope: 'top-level', writer: 'server-direct', ledger: 'company', renamePropagation: true, backup: true },

  // ── BIM: δομικά (ADR-363 §5.17) ───────────────────────────────────────────
  // Καμία BIM οντότητα δεν μεταφέρει μετονομασία σε αρχεία ούτε μπαίνει στο
  // backup manifest — δηλωμένα, όχι σιωπηλά.
  wall: { collectionKey: 'FLOORPLAN_WALLS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  opening: { collectionKey: 'FLOORPLAN_OPENINGS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  slab: { collectionKey: 'FLOORPLAN_SLABS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'slab-opening': { collectionKey: 'FLOORPLAN_SLAB_OPENINGS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  column: { collectionKey: 'FLOORPLAN_COLUMNS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  beam: { collectionKey: 'FLOORPLAN_BEAMS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  stair: { collectionKey: 'FLOORPLAN_STAIRS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  roof: { collectionKey: 'FLOORPLAN_ROOFS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  foundation: { collectionKey: 'FLOORPLAN_FOUNDATIONS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },

  /**
   * 🔴 **ADR-407 — ΕΓΡΑΦΕ ΣΕ 400 ΑΠΟ ΤΗ ΓΕΝΝΗΣΗ ΤΟΥ.** Ο `railing-audit-client.ts`
   * POST-άρει σε create/update/delete/restore· το `railing` δεν υπήρχε **ούτε** στο
   * union **ούτε** στον χάρτη ⇒ κάθε εγγραφή 400άριζε και το `.catch(()=>{})` τη
   * σιωπούσε. Η συλλογή `floorplan_railings` **υπήρχε ήδη**.
   */
  railing: { collectionKey: 'FLOORPLAN_RAILINGS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },

  // ── BIM: Η-Μ (ADR-406 / ADR-408) ──────────────────────────────────────────
  'mep-fixture': { collectionKey: 'FLOORPLAN_MEP_FIXTURES', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'mep-system': { collectionKey: 'FLOORPLAN_MEP_SYSTEMS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'electrical-panel': { collectionKey: 'FLOORPLAN_ELECTRICAL_PANELS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'mep-segment': { collectionKey: 'FLOORPLAN_MEP_SEGMENTS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'mep-fitting': { collectionKey: 'FLOORPLAN_MEP_FITTINGS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'mep-manifold': { collectionKey: 'FLOORPLAN_MEP_MANIFOLDS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },

  /**
   * 🔴 **ADR-408 Εύρος Β — ΤΑ ΤΕΣΣΕΡΑ ΘΕΡΜΙΚΑ ΣΩΜΑΤΑ ΕΓΡΑΦΑΝ ΣΕ 400.** Ίδιο σχήμα
   * με το `railing`: ζωντανοί audit-clients, συλλογές υπαρκτές, **καμία** εγγραφή
   * στο union ή στον χάρτη.
   */
  'mep-radiator': { collectionKey: 'FLOORPLAN_MEP_RADIATORS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'mep-boiler': { collectionKey: 'FLOORPLAN_MEP_BOILERS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'mep-water-heater': { collectionKey: 'FLOORPLAN_MEP_WATER_HEATERS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'mep-underfloor': { collectionKey: 'FLOORPLAN_MEP_UNDERFLOORS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },

  // ── BIM: σύμβολα, έπιπλα, εισαγόμενα, παραμετρικά ─────────────────────────
  /**
   * 🔴 **ADR-415 — ΗΤΑΝ ΣΤΟ UNION ΑΛΛΑ ΟΧΙ ΣΤΟΝ ΧΑΡΤΗ.** Η πιο ύπουλη εκδοχή: ο
   * τύπος φαινόταν «κανονικό μέλος», άρα κάθε έλεγχος τύπου περνούσε — και το
   * `VALID_ENTITY_TYPES`, που **παράγεται από τον χάρτη**, τον απέρριπτε στο runtime.
   */
  'floorplan-symbol': { collectionKey: 'FLOORPLAN_SYMBOLS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  furniture: { collectionKey: 'FLOORPLAN_FURNITURE', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'imported-mesh': { collectionKey: 'FLOORPLAN_IMPORTED_MESHES', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },
  'generic-solid': { collectionKey: 'FLOORPLAN_GENERIC_SOLIDS', scope: 'top-level', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },

  /** ADR-412 Φ5 — **η μόνη** subcollection-scoped οντότητα: `companies/{id}/bim_family_types/{typeId}`. */
  bim_family_type: { collectionKey: 'BIM_FAMILY_TYPES', scope: 'subcollection', writer: 'client-post', ledger: 'company', renamePropagation: false, backup: false },

  // ── Τηλεμετρία & σχολιασμοί 3D (ADR-366) ──────────────────────────────────
  // `collectionKey: null` ⇒ δεν έχουν δικό τους έγγραφο προς επαλήθευση κατοχής.
  performance_diagnostic: { collectionKey: null, scope: 'top-level', writer: 'none', ledger: 'company', renamePropagation: false, backup: false },
  performance_telemetry: { collectionKey: null, scope: 'top-level', writer: 'none', ledger: 'company', renamePropagation: false, backup: false },
  bim_dimension_3d: { collectionKey: null, scope: 'top-level', writer: 'none', ledger: 'company', renamePropagation: false, backup: false },
  bim_animation: { collectionKey: null, scope: 'top-level', writer: 'none', ledger: 'company', renamePropagation: false, backup: false },
} as const satisfies Record<string, AuditEntitySpec>;

/**
 * Ο τύπος οντότητας — **ΠΑΡΑΓΕΤΑΙ** από το μητρώο.
 *
 * 🔑 Εδώ κλείνει η κλάση: δεν υπάρχει «το union» και «ο χάρτης» που μπορούν να
 * διαφωνήσουν, γιατί **το union ΕΙΝΑΙ ο χάρτης**. Ένα μέλος χωρίς γραμμή στο
 * μητρώο είναι **μη εκφράσιμο**, όχι «ανιχνεύσιμο από test που κάποιος θα ξεχάσει
 * να ενημερώσει» — το test που υπήρχε γι' αυτόν ακριβώς τον σκοπό έμεινε πίσω
 * **επτά** φορές (`BIM_AUDIT_ENTITY_TYPES`: 18 ονόματα για 25 clients).
 */
export type AuditEntityType = keyof typeof AUDIT_ENTITIES;

/** Η δήλωση μιας οντότητας, ή `undefined` για άγνωστο string (runtime είσοδος). */
export function auditEntitySpec(type: string): AuditEntitySpec | undefined {
  return (AUDIT_ENTITIES as Record<string, AuditEntitySpec>)[type];
}
