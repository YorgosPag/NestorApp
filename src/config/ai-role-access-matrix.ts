/**
 * =============================================================================
 * AI ROLE ACCESS MATRIX — SSoT for AI Pipeline RBAC
 * =============================================================================
 *
 * Single Source of Truth for what each association role can access
 * through the AI pipeline (Telegram bot, WhatsApp, etc.)
 *
 * CONSUMED BY:
 * - agentic-loop.ts → buildRoleDescription() reads .promptDescription
 * - agentic-tool-executor.ts → enforceRoleAccess() reads .allowedCollections
 * - agentic-tool-executor.ts → redactRoleBlockedFields() reads .blockedFields
 *
 * DESIGN RULES:
 * - allowedCollections is the ONLY access control list (no separate blocklist)
 * - blockedFields are defined in NESTED form only — flat forms auto-derived
 * - Shared field sets are defined ONCE and reused (zero copy-paste)
 * - Every role (including admin) uses the same RoleAccessConfig interface
 *
 * @module config/ai-role-access-matrix
 * @see ADR-032 (Linking Model)
 * @see ADR-171 (Autonomous AI Agent)
 */

import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// INTERFACE
// ============================================================================

export interface RoleAccessConfig {
  /** Human-readable label (ελληνικά) */
  label: string;
  /** Collections this role CAN query. Everything else is denied. */
  allowedCollections: readonly string[];
  /**
   * Nested fields to redact from query results (e.g. 'commercial.askingPrice').
   * Flat forms (e.g. '_askingPrice') are auto-derived by deriveBlockedFieldSet().
   * Define ONLY the nested form here — no manual duplication.
   */
  blockedFields: readonly string[];
  /** System prompt description for AI (ελληνικά) */
  promptDescription: string;
  /** Scoping level: 'project' = filter by projectId, 'unit' = filter by unit ID (SPEC-257B) */
  scopeLevel: 'project' | 'unit';
}

// ============================================================================
// SHARED FIELD SETS (DRY — defined once, reused by roles)
// ============================================================================

/** Commercial pricing fields — hidden from non-admin roles */
const COMMERCIAL_PRICING_FIELDS = [
  'commercial.askingPrice',
  'commercial.finalPrice',
] as const;

/** Buyer identity fields — hidden from non-buyer roles */
const BUYER_IDENTITY_FIELDS = [
  'commercial.buyerContactId',
  'commercial.buyerName',
] as const;

/** Payment summary fields — hidden from external roles (must match PaymentSummary type) */
const PAYMENT_SUMMARY_FIELDS = [
  'commercial.paymentSummary',
  'commercial.paymentSummary.totalAmount',
  'commercial.paymentSummary.paidAmount',
  'commercial.paymentSummary.remainingAmount',
  'commercial.paymentSummary.paidPercentage',
  'commercial.paymentSummary.totalInstallments',
  'commercial.paymentSummary.paidInstallments',
  'commercial.paymentSummary.overdueInstallments',
  'commercial.paymentSummary.nextInstallmentAmount',
  'commercial.paymentSummary.nextInstallmentDate',
  'commercial.paymentSummary.planStatus',
  'commercial.paymentSummary.paymentPlanId',
] as const;

/**
 * Payment fields VISIBLE to buyer (SPEC-257C — allow list).
 * Everything else in PAYMENT_SUMMARY_FIELDS is auto-blocked.
 * Add new fields here ONLY if buyer should see them.
 */
const BUYER_VISIBLE_PAYMENT_FIELDS: ReadonlySet<string> = new Set([
  'commercial.paymentSummary.remainingAmount',
  'commercial.paymentSummary.nextInstallmentAmount',
  'commercial.paymentSummary.nextInstallmentDate',
  'commercial.paymentSummary.overdueInstallments',
]);

/**
 * Payment fields BLOCKED for buyer — derived from PAYMENT_SUMMARY_FIELDS minus visible set.
 * SSOT: new fields added to PAYMENT_SUMMARY_FIELDS are auto-blocked for buyer.
 * Excludes 'commercial.paymentSummary' (parent key that blocks entire object).
 */
const BUYER_BLOCKED_PAYMENT_FIELDS: readonly string[] = PAYMENT_SUMMARY_FIELDS
  .filter(f => f !== 'commercial.paymentSummary' && !BUYER_VISIBLE_PAYMENT_FIELDS.has(f));

/**
 * SPEC-257D: Complaint triage prompt — shared across buyer/owner/tenant (SSOT).
 * Defined ONCE, appended to each customer role's promptDescription.
 */
const COMPLAINT_TRIAGE_PROMPT = `
ΠΑΡΑΠΟΝΑ/ΠΡΟΒΛΗΜΑΤΑ:
Αν αναφέρει πρόβλημα στο ακίνητο, χρησιμοποίησε create_complaint_task.
Σοβαρότητα: urgent (υγρασία/πλημμύρα/ρωγμή/διαρροή/ηλεκτρολογικό/θέρμανση/ασανσέρ) | normal (φθορά/υλικό/πόρτα/παράθυρο/βαφή) | low (αισθητικό/γείτονας/θόρυβος/εκτός αρμοδιότητας)
Μετά τη δημιουργία: urgent → "✅ Καταγράφηκε ως ΕΠΕΙΓΟΝ. Θα ειδοποιηθεί αμέσως ο υπεύθυνος." | normal/low → "✅ Λάβαμε το μήνυμά σας. Θα εξεταστεί σύντομα."`;

/**
 * SPEC-257E: Contact update prompt — shared across buyer/owner/tenant (SSOT).
 * Defined ONCE, appended to each customer role's promptDescription.
 */
const CONTACT_UPDATE_PROMPT = `
ΕΝΗΜΕΡΩΣΗ ΣΤΟΙΧΕΙΩΝ ΕΠΙΚΟΙΝΩΝΙΑΣ:
Μπορείς να ΠΡΟΣΘΕΣΕΙΣ νέο τηλέφωνο, email ή social media χρησιμοποιώντας append_contact_info.
ΔΕΝ μπορείς να ΔΙΑΓΡΑΨΕΙΣ ή ΤΡΟΠΟΠΟΙΗΣΕΙΣ υπάρχοντα στοιχεία — μόνο ο διαχειριστής.
Παράδειγμα: "πρόσθεσε 6974050025 ως εργασία" → append_contact_info(fieldType:"phone", value:"6974050025", label:"εργασία")`;

/**
 * SPEC-257F: File delivery prompt — shared across buyer/owner/tenant (SSOT).
 * Defined ONCE, appended to each customer role's promptDescription.
 */
const FILE_DELIVERY_PROMPT = `
ΑΠΟΣΤΟΛΗ ΑΡΧΕΙΩΝ (φωτογραφίες, κατόψεις, έγγραφα):
Μπορείς να στείλεις αρχεία στον χρήστη χρησιμοποιώντας deliver_file_to_chat.
- Φωτογραφίες unit: deliver_file_to_chat(sourceType:"unit_photo", sourceId:"<unitId>", caption:null)
- Κάτοψη: Πρώτα ψάξε floorplans collection → deliver_file_to_chat(sourceType:"floorplan", sourceId:"<floorplanId>", caption:null)
- Έγγραφα: Πρώτα ψάξε files collection → deliver_file_to_chat(sourceType:"file", sourceId:"<fileId>", caption:null)
ΣΗΜΑΝΤΙΚΟ: Μπορείς να στείλεις ΜΟΝΟ αρχεία που ανήκουν στα δικά units του χρήστη.`;

/**
 * SPEC-257G: Knowledge base prompt — shared across buyer/owner/tenant (SSOT).
 * Defined ONCE, appended to each customer role's promptDescription.
 */
const KNOWLEDGE_BASE_PROMPT = `
ΔΙΑΔΙΚΑΣΙΕΣ & ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ:
Αν ρωτήσει για δικαιολογητικά, συμβολαιογράφο, δάνειο, μεταβίβαση ή νομικές διαδικασίες → search_knowledge_base(query).
Η απάντηση περιλαμβάνει: ποια δικαιολογητικά χρειάζονται, ποιος τα παρέχει, και ποια υπάρχουν ήδη στο σύστημα.
Αν υπάρχουν διαθέσιμα έγγραφα, πρόσφερε να τα στείλεις (deliver_file_to_chat).`;

/** All financial fields combined */
const ALL_FINANCIAL_FIELDS = [
  ...COMMERCIAL_PRICING_FIELDS,
  ...BUYER_IDENTITY_FIELDS,
  ...PAYMENT_SUMMARY_FIELDS,
] as const;

// ============================================================================
// SHARED COLLECTION SETS (DRY)
// ============================================================================

/** Technical/construction collections */
const TECHNICAL_COLLECTIONS = [
  COLLECTIONS.PROJECTS,
  COLLECTIONS.BUILDINGS,
  COLLECTIONS.UNITS,
  COLLECTIONS.FLOORS,
  COLLECTIONS.CONSTRUCTION_PHASES,
  COLLECTIONS.CONSTRUCTION_TASKS,
  COLLECTIONS.DOCUMENTS,
  COLLECTIONS.APPOINTMENTS,
  COLLECTIONS.TASKS,
] as const;

/** Public-facing collections (available to unlinked/unknown users) */
const PUBLIC_COLLECTIONS = [
  COLLECTIONS.UNITS,
  COLLECTIONS.APPOINTMENTS,
] as const;

/** Customer-facing collections */
const CUSTOMER_COLLECTIONS = [
  COLLECTIONS.UNITS,
  COLLECTIONS.BUILDINGS,
  COLLECTIONS.DOCUMENTS,
  COLLECTIONS.APPOINTMENTS,
  COLLECTIONS.TASKS,        // SPEC-257D: complaint task visibility (unit-scoped)
  COLLECTIONS.FILES,        // SPEC-257F: file delivery (photos, documents)
  COLLECTIONS.FLOORPLANS,   // SPEC-257F: floorplan delivery
] as const;

// ============================================================================
// SSoT: ROLE → ACCESS CONFIG
// ============================================================================

/** All writable collections for admin */
const ALL_COLLECTIONS = [
  ...TECHNICAL_COLLECTIONS,
  COLLECTIONS.CONTACTS,
  COLLECTIONS.LEADS,
  COLLECTIONS.OPPORTUNITIES,
  COLLECTIONS.INVOICES,
  COLLECTIONS.PAYMENTS,
  COLLECTIONS.CONTACT_LINKS,
] as const;

export const AI_ROLE_ACCESS_MATRIX = {

  // ── SUPER ADMIN — Full access, read + write ──
  super_admin: {
    label: 'Super Admin',
    allowedCollections: ALL_COLLECTIONS,
    blockedFields: [],
    promptDescription: `Ο χρήστης είναι ο Super Admin. Έχεις ΠΛΗΡΗ πρόσβαση σε ΟΛΑ τα δεδομένα — μπορείς να ΔΙΑΒΑΖΕΙΣ ΚΑΙ ΝΑ ΓΡΑΦΕΙΣ σε ΟΛΑ τα collections. ΠΟΤΕ μη λες "δεν έχω δικαίωμα" — ΕΧΕΙΣ. Αν κάτι αποτύχει, ΔΟΚΙΜΑΣΕ.

ΔΙΑΧΕΙΡΙΣΗ ΡΟΛΩΝ ΣΕ ΕΡΓΑ:
ΠΡΟΣΘΗΚΗ: "δήλωσε τον X ως επιβλέποντα στο έργο Y"
Βήματα: 1) Ψάξε contact, 2) Ψάξε project, 3) firestore_write("contact_links", create, { sourceContactId, targetEntityType: "project", targetEntityId, role: "supervisor|architect|engineer|contractor", status: "active" })

ΑΦΑΙΡΕΣΗ: "αφαίρεσε τον X από τον ρόλο του στο έργο Y"
Βήματα: 1) Ψάξε contact (πάρε contactId), 2) firestore_query("contact_links", [{field: "sourceContactId", operator: "==", value: contactId}]) → βρες το link document, 3) firestore_write("contact_links", update, documentId, { status: "inactive" })
ΣΗΜΑΝΤΙΚΟ: ΜΗΝ διαγράφεις — κάνε status: "inactive" (audit trail)

Ρόλοι: supervisor (επιβλέπων), architect (αρχιτέκτονας), engineer (μηχανικός), contractor (εργολάβος), lawyer (δικηγόρος), notary (συμβολαιογράφος)

ΡΑΝΤΕΒΟΥ — ΔΙΑΡΚΕΙΑ + CONFLICT DETECTION:
Κάθε ραντεβού ΠΡΕΠΕΙ να έχει: date, time (έναρξη), endTime (λήξη), durationMinutes.
- Αν ο χρήστης δώσει διάρκεια (π.χ. "για 2 ώρες") → υπολόγισε endTime = time + duration
- Αν ο χρήστης δώσει ώρα λήξης (π.χ. "10:00-12:00") → durationMinutes = διαφορά σε λεπτά
- Αν ΔΕΝ δοθεί ούτε διάρκεια ούτε ώρα λήξης → default: durationMinutes=60, endTime=time+1h
Παράδειγμα: "ραντεβού στις 10:00" → time:"10:00", endTime:"11:00", durationMinutes:60
ΜΟΡΦΟΠΟΙΗΣΗ ΑΠΑΝΤΗΣΗΣ: ΠΑΝΤΑ εμφάνιζε start-end στην επιβεβαίωση:
- "✅ Ραντεβού 10:00-11:00 (1 ώρα) με τον Γιάννη στο εργοτάξιο"
- "✅ Ραντεβού 10:00-12:00 (2 ώρες) με τη Σοφία στο δικαστήριο"
ΠΟΤΕ μη λες μόνο "στις 10:00" — ΠΑΝΤΑ δείχνε και την ώρα λήξης.

CONFLICT DETECTION (overlap, ΟΧΙ μόνο exact match):
ΠΡΙΝ δημιουργήσεις ραντεβού, ΥΠΟΧΡΕΩΤΙΚΑ ψάξε: firestore_query("appointments", [{field: "date", operator: "==", value: "<ζητούμενη ημερομηνία ISO>"}])
Αν βρεις ραντεβού την ΙΔΙΑ ΜΕΡΑ, ΕΛΕΓΞΕ OVERLAP:
- Υπάρχον: 10:00-11:00, Νέο: 10:30 → OVERLAP (10:30 < 11:00)
- Υπάρχον: 10:00-11:00, Νέο: 11:00 → ΟΧΙ OVERLAP (ξεκινά ακριβώς μετά)
- Υπάρχον: 10:00-11:00, Νέο: 09:00-10:30 → OVERLAP (10:30 > 10:00)
Κανόνας: overlap αν newStart < existingEnd ΚΑΙ newEnd > existingStart

Αν OVERLAP + ΔΙΑΦΟΡΕΤΙΚΗ τοποθεσία → ⚠️ "Σύγκρουση: Έχεις ραντεβού [ώρα]-[endTime] στο [τοποθεσία]. Θέλεις να κλείσω παρόλα αυτά;"
Αν OVERLAP + ΙΔΙΑ τοποθεσία → ⚠️ "Έχεις ήδη ραντεβού εκεί [ώρα]-[endTime]. Θέλεις να το ενημερώσω ή ξεχωριστό;"
Αν ΔΕΝ υπάρχει overlap → καταχώρησε κανονικά. Αν υπάρχουν άλλα ραντεβού την ίδια μέρα, ανέφερέ τα σύντομα.

ΕΙΔΟΠΟΙΗΣΗ ΤΡΙΤΩΝ — ΡΑΝΤΕΒΟΥ/ΕΡΓΑΣΙΕΣ:
Μετά τη δημιουργία ραντεβού που ΑΦΟΡΑ ΤΡΙΤΟ ΠΡΟΣΩΠΟ (όχι τον admin), ΡΩΤΑ:
"Θέλεις να ενημερώσω τον/την [Όνομα] μέσω email ή Telegram;"
Αν ο admin πει ναι → στείλε ειδοποίηση (email ή Telegram ανάλογα τι είναι διαθέσιμο).
Αν ο admin πει όχι → τέλος.
ΜΗΝ στέλνεις ειδοποίηση χωρίς έγκριση.`,
    scopeLevel: 'project',
  },

  // ── ΕΠΙΒΛΕΠΩΝ ΜΗΧΑΝΙΚΟΣ — All technical data ──
  supervisor: {
    label: 'Επιβλέπων Μηχανικός',
    allowedCollections: TECHNICAL_COLLECTIONS,
    blockedFields: ALL_FINANCIAL_FIELDS,
    promptDescription: `ΡΟΛΟΣ: ΕΠΙΒΛΕΠΩΝ ΜΗΧΑΝΙΚΟΣ (supervisor)
ΠΡΟΣΒΑΣΗ: ΟΛΑ τα τεχνικά δεδομένα των συνδεδεμένων έργων:
- projects, buildings, units, construction_phases, construction_tasks
- documents, μετρήσεις, tasks, ραντεβού
ΑΠΑΓΟΡΕΥΕΤΑΙ: τιμές πώλησης, πληρωμές, leads, εσωτερικά κόστη/κέρδη, δεδομένα άλλων έργων.`,
    scopeLevel: 'project',
  },

  // ── ΕΡΓΟΛΑΒΟΣ — Construction-focused ──
  contractor: {
    label: 'Εργολάβος',
    allowedCollections: [
      COLLECTIONS.PROJECTS,
      COLLECTIONS.BUILDINGS,
      COLLECTIONS.CONSTRUCTION_PHASES,
      COLLECTIONS.CONSTRUCTION_TASKS,
      COLLECTIONS.DOCUMENTS,
      COLLECTIONS.TASKS,
    ],
    blockedFields: [...COMMERCIAL_PRICING_FIELDS, ...BUYER_IDENTITY_FIELDS],
    promptDescription: `ΡΟΛΟΣ: ΕΡΓΟΛΑΒΟΣ (contractor)
ΠΡΟΣΒΑΣΗ: Κατασκευαστικά δεδομένα των συνδεδεμένων έργων:
- construction_phases, construction_tasks, documents, tasks
ΑΠΑΓΟΡΕΥΕΤΑΙ: ακίνητα (units), τιμές, πληρωμές, contacts πελατών, leads.`,
    scopeLevel: 'project',
  },

  // ── ΑΡΧΙΤΕΚΤΟΝΑΣ / ΜΗΧΑΝΙΚΟΣ — Shared base config ──
  architect: {
    label: 'Αρχιτέκτονας',
    allowedCollections: [
      COLLECTIONS.PROJECTS,
      COLLECTIONS.BUILDINGS,
      COLLECTIONS.UNITS,
      COLLECTIONS.FLOORS,
      COLLECTIONS.CONSTRUCTION_PHASES,
      COLLECTIONS.DOCUMENTS,
    ],
    blockedFields: ALL_FINANCIAL_FIELDS,
    promptDescription: `ΡΟΛΟΣ: ΑΡΧΙΤΕΚΤΟΝΑΣ (architect)
ΠΡΟΣΒΑΣΗ ΠΕΡΙΟΡΙΣΜΕΝΗ:
- ΝΑΙ: projects (βασικά), buildings, units (εμβαδά, σχέδια), floors, documents (αρχιτεκτονικά)
- ΜΟΝΟ VIEW: construction_phases (τίτλος, κατάσταση)
- ΟΧΙ: construction_tasks, contacts, κόστη, πληρωμές, μετρήσεις
ΜΟΝΟ δεδομένα συνδεδεμένων έργων.`,
    scopeLevel: 'project',
  },

  // engineer = same access as architect (DRY: reference same collections/fields)
  get engineer(): RoleAccessConfig {
    return {
      ...AI_ROLE_ACCESS_MATRIX.architect,
      label: 'Μηχανικός',
      promptDescription: `ΡΟΛΟΣ: ΜΗΧΑΝΙΚΟΣ (engineer)
ΠΡΟΣΒΑΣΗ ΠΕΡΙΟΡΙΣΜΕΝΗ:
- ΝΑΙ: projects, buildings, units (τεχνικά), floors, documents, construction_phases (view)
- ΟΧΙ: construction_tasks, contacts, κόστη, πληρωμές
ΜΟΝΟ δεδομένα συνδεδεμένων έργων.`,
    };
  },

  // ── ΑΓΟΡΑΣΤΗΣ ──
  buyer: {
    label: 'Αγοραστής',
    allowedCollections: CUSTOMER_COLLECTIONS,
    blockedFields: [
      ...COMMERCIAL_PRICING_FIELDS,
      ...BUYER_IDENTITY_FIELDS,
      ...BUYER_BLOCKED_PAYMENT_FIELDS,
    ],
    promptDescription: `ΡΟΛΟΣ: ΑΓΟΡΑΣΤΗΣ/ΠΕΛΑΤΗΣ
ΒΑΣΙΚΗ ΠΡΟΣΒΑΣΗ:
- ΝΑΙ: units (μόνο τα δικά), buildings (βασικά), documents (δικά), ραντεβού, tasks (δικά)
- ΠΛΗΡΩΜΕΣ: υπόλοιπο οφειλής, επόμενη δόση (ποσό + ημ/νία), ληξιπρόθεσμες
- ΟΧΙ: τιμές λίστας, αναλυτικά ποσά πληρωμών, construction, contacts, εσωτερικά${COMPLAINT_TRIAGE_PROMPT}${CONTACT_UPDATE_PROMPT}${FILE_DELIVERY_PROMPT}${KNOWLEDGE_BASE_PROMPT}`,
    scopeLevel: 'unit',
  },

  // owner = same as buyer but without price redaction
  owner: {
    label: 'Ιδιοκτήτης',
    allowedCollections: CUSTOMER_COLLECTIONS,
    blockedFields: ['commercial.askingPrice'],
    promptDescription: `ΡΟΛΟΣ: ΙΔΙΟΚΤΗΤΗΣ
ΒΑΣΙΚΗ ΠΡΟΣΒΑΣΗ:
- ΝΑΙ: units (μόνο τα δικά), buildings (βασικά), documents, ραντεβού, tasks (δικά)
- ΠΛΗΡΩΜΕΣ: πλήρης πρόσβαση — τελική τιμή, υπόλοιπο, δόσεις, αναλυτικά ποσά
- ΟΧΙ: τιμή λίστας, κατασκευαστικά, contacts, leads, εσωτερικά${COMPLAINT_TRIAGE_PROMPT}${CONTACT_UPDATE_PROMPT}${FILE_DELIVERY_PROMPT}${KNOWLEDGE_BASE_PROMPT}`,
    scopeLevel: 'unit',
  },

  // ── ΕΝΟΙΚΙΑΣΤΗΣ — Minimum access ──
  tenant: {
    label: 'Ενοικιαστής',
    allowedCollections: [
      COLLECTIONS.UNITS,
      COLLECTIONS.BUILDINGS,
      COLLECTIONS.APPOINTMENTS,
    ],
    blockedFields: [...COMMERCIAL_PRICING_FIELDS, ...BUYER_IDENTITY_FIELDS, ...PAYMENT_SUMMARY_FIELDS],
    promptDescription: `ΡΟΛΟΣ: ΕΝΟΙΚΙΑΣΤΗΣ
ΕΛΑΧΙΣΤΗ ΠΡΟΣΒΑΣΗ:
- ΝΑΙ: units (μόνο το δικό), buildings (βασικά), ραντεβού, tasks (δικά)
- ΟΧΙ: κατασκευαστικά, έγγραφα, contacts, τιμές, πληρωμές${COMPLAINT_TRIAGE_PROMPT}${CONTACT_UPDATE_PROMPT}${FILE_DELIVERY_PROMPT}${KNOWLEDGE_BASE_PROMPT}`,
    scopeLevel: 'unit',
  },

} as const satisfies Record<string, RoleAccessConfig>;

// ============================================================================
// DEFAULT ACCESS (for contacts without project links)
// ============================================================================

export const UNLINKED_ACCESS: RoleAccessConfig = {
  label: 'Χωρίς σύνδεση σε έργο',
  allowedCollections: PUBLIC_COLLECTIONS,
  blockedFields: [...BUYER_IDENTITY_FIELDS, ...PAYMENT_SUMMARY_FIELDS],
  promptDescription: `ΔΕΝ είναι συνδεδεμένος/η σε κάποιο έργο.
Μπορείς ΜΟΝΟ να:
- Απαντήσεις σε γενικές ερωτήσεις
- Δώσεις πληροφορίες ακινήτων (units: τ.μ., τιμή, τύπος)
- Κλείσεις ραντεβού
ΜΗΝ δίνεις πρόσβαση σε εσωτερικά δεδομένα (φάσεις, εργασίες, μετρήσεις, contacts).`,
  scopeLevel: 'project',
};

/** Unknown user = same access as unlinked (single reference, zero duplication) */
export const UNKNOWN_USER_ACCESS: RoleAccessConfig = {
  ...UNLINKED_ACCESS,
  label: 'Μη αναγνωρισμένος χρήστης',
  promptDescription: `Ο χρήστης δεν είναι αναγνωρισμένος.
Μπορείς ΜΟΝΟ να:
- Απαντήσεις σε γενικές ερωτήσεις για ακίνητα
- Δώσεις πληροφορίες ακινήτων (units: τ.μ., τιμή, τύπος)
- Κλείσεις ραντεβού
ΜΗΝ δίνεις πρόσβαση σε εσωτερικά δεδομένα.`,
};

// ============================================================================
// BLOCKED FIELD DERIVATION (nested → flat, automatic)
// ============================================================================

/**
 * Derive the complete set of blocked field keys from nested definitions.
 * Converts 'commercial.askingPrice' → Set containing BOTH
 * the nested form AND the flat form '_askingPrice'.
 *
 * Called once per request (cached in enforceRoleAccess context).
 */
export function deriveBlockedFieldSet(nestedFields: readonly string[]): Set<string> {
  const result = new Set<string>();
  for (const field of nestedFields) {
    // Add the nested form as-is (for object redaction)
    result.add(field);
    // Derive flat form: 'commercial.askingPrice' → '_askingPrice'
    const lastDot = field.lastIndexOf('.');
    if (lastDot !== -1) {
      const leafField = field.substring(lastDot + 1);
      result.add(`_${leafField}`);
    }
  }
  return result;
}

// ============================================================================
// HELPER: Resolve access config from contact roles
// ============================================================================

/** Role priority (first match wins). Derived from matrix keys. */
const ROLE_PRIORITY: readonly string[] = [
  'supervisor', 'contractor', 'architect', 'engineer',
  'buyer', 'owner', 'tenant',
];

/**
 * Get the highest-privilege access config from a list of project roles.
 */
export function resolveAccessConfig(
  roles: Array<{ role: string }>
): RoleAccessConfig {
  for (const priorityRole of ROLE_PRIORITY) {
    if (roles.some(r => r.role === priorityRole)) {
      return AI_ROLE_ACCESS_MATRIX[priorityRole as keyof typeof AI_ROLE_ACCESS_MATRIX] ?? UNLINKED_ACCESS;
    }
  }
  return UNLINKED_ACCESS;
}
