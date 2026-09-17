/**
 * 📜 Entity Audit Trail — Type Definitions
 *
 * Centralized types for entity-level change tracking.
 * Used by EntityAuditService (server), API routes, and client hooks.
 *
 * @module types/audit-trail
 * @enterprise ADR-195 — Entity Audit Trail
 */

// ADR-852 §3.1 — type-only ⇒ σβήνεται στο build· καμία εξάρτηση χρόνου εκτέλεσης για
// τον Admin SDK. Η ρίζα του λεξιλογίου ποσοτήτων είναι leaf (μηδέν εξαρτήσεις).
import type { QuantitySpec } from '@/constants/quantity-specs';
// 🏢 ADR-852 Φ4α — ΤΟ UNION ΠΑΡΑΓΕΤΑΙ ΑΠΟ ΤΟ ΜΗΤΡΩΟ (δες παρακάτω το «γιατί»).
//
// ⚠️ `import type` + **ξεχωριστό** `export type`, ΠΟΤΕ `export type { … } from '…'`:
// το `AuditEntityType` χρησιμοποιείται **μέσα** σε αυτό το αρχείο (`EntityAuditEntry`,
// `AuditCdcEntry`), και το `export … from` **δεν δεσμεύει τοπικά** — είναι κατά λέξη
// το λάθος της Φ1 που τεκμηριώνει το §4.6 και φυλάει το **CHECK 3.70**.
//
// ⚠️ Και είναι `import type`, ώστε αυτό το αρχείο να μείνει **type-only**: μετρήθηκε
// ότι **35** αρχεία το εισάγουν, **όλα** με `import type`, και το `functions/` (άλλο
// tsconfig) δεν το εισάγει καθόλου. Μια runtime εξάρτηση εδώ θα ταξίδευε παντού.
import type { AuditEntityType } from '@/config/audit-entity-registry';
// ADR-864 Φ1β — type-only leaf· το αρχείο μένει type-only.
import type { AuditLedgerScope } from '@/lib/audit/audit-ledger';

// ============================================================================
// CORE UNION TYPES
// ============================================================================

/**
 * Entity types that support audit trail — **ΠΑΡΑΓΕΤΑΙ** από το
 * `config/audit-entity-registry.ts`, όπου κάθε οντότητα δηλώνεται **μία** φορά
 * μαζί με τη συλλογή της, το εύρος της και τον συγγραφέα της.
 *
 * 🔴 **ΓΙΑΤΙ ΕΠΑΨΕ ΝΑ ΕΙΝΑΙ ΧΕΙΡΟΓΡΑΦΟ** (ADR-852 §4.9, μετρημένο 13/09): ο τύπος
 * δηλωνόταν σε **τέσσερα** ανεξάρτητα σώματα — εδώ (**40** μέλη), στον χάρτη του
 * audit (**19**), και σε **δύο δίδυμα εξαντλητικά** `Record<AuditEntityType, …>`
 * (**37** το καθένα) που σταμάτησαν να ενημερώνονται **έναν μήνα πριν** μεγαλώσει
 * αυτό το union. Επειδή το `VALID_ENTITY_TYPES` **παράγεται** από τον χάρτη,
 * **έξι** οντότητες με ζωντανό audit-client έπαιρναν **400** σε κάθε εγγραφή και
 * το `.catch(() => {})` το κατάπινε: το ιστορικό τους δεν γράφτηκε **ποτέ**.
 *
 * 🔑 Τώρα δεν υπάρχει «το union» και «ο χάρτης» που μπορούν να αποκλίνουν, γιατί
 * **το union ΕΙΝΑΙ ο χάρτης**. Η απόκλιση έπαψε να είναι ανιχνεύσιμη — έγινε
 * **μη εκφράσιμη**.
 */
export type { AuditEntityType };

/** Actions that can be recorded in the audit trail */
export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'soft_deleted'
  | 'restored'
  | 'status_changed'
  | 'linked'
  | 'unlinked'
  | 'professional_assigned'
  | 'professional_removed'
  | 'email_sent'
  | 'vendor_notified'
  | 'invoice_created'
  | 'document_added'
  | 'document_removed'
  | 'orphaned'
  | 'auto_submit_prompted'
  | 'auto_submit_accepted'
  | 'auto_submit_declined'
  | 'erased'
  | 'triage_status_changed'
  | 'triage_assigned'
  | 'internal_note_added'
  /**
   * ADR-864 §19 (Α34) — **άνοιγμα** αποδεικτικού, όχι αλλαγή: το «Viewed» του Certificate of Completion του
   * DocuSign. Ποιος κατέβασε το παγωμένο έντυπο μιας βεβαίωσης, και πότε.
   */
  | 'document_accessed'
  /**
   * ADR-864 §20 — η σχέση γραφείου–ακινήτου έληξε και το αποδεικτικό **κλειδώθηκε** (GCS Locked) ως μια
   * ημερομηνία· από εκεί και πέρα κανείς, ούτε ο φορέας, δεν το σβήνει νωρίτερα.
   */
  | 'evidence_retention_scheduled'
  /** ADR-864 §20 — τα bytes διατέθηκαν μετά την προθεσμία· το **αποτύπωμα** μένει στο μητρώο. */
  | 'evidence_disposed';

// ============================================================================
// FIELD-LEVEL DIFF
// ============================================================================

/**
 * Operation type for collection-aware audit entries (ADR-195 Phase 11).
 * Scalar entries omit `op` (and `kind`).
 */
export type AuditCollectionOp = 'added' | 'removed' | 'modified';

/**
 * Sub-field change within a `modified` collection item.
 * Used when an existing item in a tracked collection has one or more
 * inner fields edited (e.g. an address whose street changed).
 */
export interface AuditSubChange {
  /** Sub-field name within the collection item (e.g. 'street') */
  subField: string;
  /** Optional human-readable label for the sub-field */
  label?: string;
  /** Value before the change (serialized) */
  oldValue: string | number | boolean | null;
  /** Value after the change (serialized) */
  newValue: string | number | boolean | null;
}

/**
 * A single field change within an audit entry.
 *
 * **Scalar** (legacy + current): `oldValue → newValue` describes a primitive
 * field change. `kind` is omitted (treated as 'scalar').
 *
 * **Collection** (ADR-195 Phase 11): for tracked array fields, the diff
 * engine emits one entry per item operation (added/removed/modified) with
 * `kind: 'collection'`, a stable `itemKey`, a human `itemLabel`, and (for
 * `modified`) granular `subChanges`. Legacy scalar entries continue to
 * render unchanged — the new fields are strictly optional.
 */
export interface AuditFieldChange {
  /** Field name (e.g. 'status', 'price', 'addresses') */
  field: string;
  /** Value before the change (serialized) — for collection ops, typically null */
  oldValue: string | number | boolean | null;
  /** Value after the change (serialized) — for collection ops, typically null */
  newValue: string | number | boolean | null;
  /** Optional human-readable label (e.g. 'Κατάσταση', 'Διευθύνσεις') */
  label?: string;

  // ── FK id + display label (ADR-195 enterprise enhancement) ──
  // For foreign-key fields (projectId, buildingId, linkedCompanyId, …) the
  // canonical document id stays in `oldValue`/`newValue` (immutable reference,
  // SAP/event-sourcing pattern) while these carry the denormalized display
  // name at the time of the change. The audit reader prefers `*Label` when
  // present and falls back to formatting the raw value otherwise — so legacy
  // records that stored the name directly in `*Value` keep rendering unchanged.
  /** Display label for `newValue` when it is an FK id (e.g. 'ΕΡΓΟ 1'). */
  newValueLabel?: string | null;
  /** Display label for `oldValue` when it is an FK id. */
  oldValueLabel?: string | null;

  // ── Collection-aware extension (ADR-195 Phase 11) ──
  /** Discriminator. Omitted = scalar (legacy). */
  kind?: 'scalar' | 'collection';
  /** Operation kind for collection items. */
  op?: AuditCollectionOp;
  /** Stable identity of the collection item (e.g. address id). */
  itemKey?: string;
  /** Human display label for the collection item (e.g. 'Εργοτάξιο — Σαμοθράκης'). */
  itemLabel?: string;
  /** Granular sub-field changes for `op === 'modified'`. */
  subChanges?: AuditSubChange[];

  // ── ΔΙΠΛΟ ΚΑΝΑΛΙ — ADR-852 §3.1 · Φ3 ──
  /**
   * **Τι ποσότητα** ήταν αυτός ο αριθμός, όπως το δήλωνε το μητρώο **τη στιγμή της
   * εγγραφής** — το χρονικό αδελφάκι του `label`.
   *
   * 🔑 Ο reader το διαβάζει **τελευταίο**: λύνει πρώτα ζωντανά από το τρέχον μητρώο
   * (`def?.quantity ?? change.quantity`), ώστε μια μελλοντική διόρθωση της δήλωσης να
   * **θεραπεύει αναδρομικά** και το ήδη γραμμένο ιστορικό (§4.1). Αυτό εδώ μετράει
   * **μόνο** όταν το πεδίο αποσυρθεί από το μητρώο — και τότε είναι ό,τι κρατά τον
   * αριθμό αναγνώσιμο, αντί να ξαναγίνει `749.9999999999927`.
   *
   * ⚠️ **ΔΕΝ υπάρχει αδελφό `unit`, και είναι απόφαση**: η μονάδα αποθήκευσης είναι
   * **συνάρτηση** της ποσότητας (canonical mm, ADR-462). Δεύτερο πεδίο για το ίδιο
   * ερώτημα = CHECK 3.59. Δες `lib/audit/tracked-field-def.ts` για το πλήρες σκεπτικό.
   *
   * ⛔ Γράφεται **μόνο** με conditional spread — ποτέ `quantity: undefined` (ο Admin SDK
   * απορρίπτει `undefined` και ο καθαριστής του writer, το `stripUndefinedShallow`, είναι
   * **ρηχός** εκ συμβολαίου· ADR-852 §4.7, άγκυρα `entity-audit-write-shallow.test.ts`).
   */
  quantity?: QuantitySpec;
}

// ============================================================================
// AUDIT ENTRY (Firestore Document)
// ============================================================================

/**
 * Writer identity for an audit entry. ADR-195 Phase 1 CDC dual-write:
 *   - `'service'` — written by `EntityAuditService.recordChange` (service-layer,
 *     curated tracked fields, authoritative `performedBy`).
 *   - `'cdc'` — written by Cloud Function `auditContactWrite` (Firestore
 *     onWrite trigger, full automatic deep diff).
 * Client dedup prefers `'cdc'` when both coexist for the same logical action.
 */
export type AuditSource = 'service' | 'cdc';

/** Ό,τι έχει κάθε εγγραφή, ανεξαρτήτως βιβλίου — δες {@link EntityAuditEntry}. */
export interface EntityAuditEntryBase {
  /** Firestore document ID (populated on read) */
  id?: string;
  /** Entity type (e.g. 'unit', 'building') */
  entityType: AuditEntityType;
  /** Entity document ID */
  entityId: string;
  /** Entity display name at time of change */
  entityName: string | null;
  /** Action performed */
  action: AuditAction;
  /** Field-level changes (for 'updated' action) */
  changes: AuditFieldChange[];
  /** User ID who performed the action */
  performedBy: string;
  /** User display name (denormalized) */
  performedByName: string | null;
  /** Timestamp (ISO string on read, serverTimestamp on write) */
  timestamp: string;
  /**
   * Writer that produced this entry. Optional for backward compatibility
   * with entries written before Phase 1 CDC rollout. Missing = legacy
   * service-layer (pre-CDC) semantics.
   */
  source?: AuditSource;
}

/**
 * Full audit trail entry as stored in Firestore.
 *
 * 🔑 ADR-864 Φ1β — η εγγραφή ανήκει σε **ένα** βιβλίο: `companyId` (εταιρεία) **ή** `userId`
 * (προσωπικό), ποτέ και τα δύο (`lib/audit/audit-ledger.ts`). ⚠️ Το `userId` είναι ο
 * **κάτοχος του βιβλίου**, όχι ο δράστης — αυτός είναι το `performedBy`.
 */
export type EntityAuditEntry = EntityAuditEntryBase & AuditLedgerScope;

// ============================================================================
// QUERY OPTIONS
// ============================================================================
// ============================================================================
// API RESPONSE
// ============================================================================

/** Response from the audit trail API endpoint */
export interface EntityAuditResponse {
  entries: EntityAuditEntry[];
  hasMore: boolean;
  nextCursor?: string;
}
