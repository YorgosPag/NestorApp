# SPEC-234A: Cheque Registry (Μητρώο Επιταγών)

| Field | Value |
|-------|-------|
| **ADR** | ADR-234 |
| **Phase** | A — Cheques & Promissory Instruments |
| **Priority** | HIGH |
| **Status** | IMPLEMENTED |
| **Estimated Effort** | 2 sessions |
| **Prerequisite** | ADR-234 types (PaymentMethod, PaymentRecord) |
| **Dependencies** | SPEC-234D depends on this (payment recording references cheque) |

---

## 1. Objective

Δημιουργία enterprise-grade **Μητρώου Επιταγών** (Cheque Registry) για πλήρη διαχείριση τραπεζικών και προσωπικών επιταγών στον κύκλο πώλησης ακινήτων. Περιλαμβάνει lifecycle tracking, bounced cheque handling, endorsement chain, και integration με τον Τειρεσία.

**Κεντρική ιδέα**: Η επιταγή δεν είναι απλά "μέσο πληρωμής" — είναι αξιόγραφο με δικό του lifecycle, νομική υπόσταση, και ποινικές συνέπειες σε περίπτωση ακάλυπτης. Χρειάζεται ξεχωριστό registry πέρα από το payment record.

> **WIDER SCOPE (2026-03-15 — απόφαση Γιώργου)**: Οι επιταγές δεν αφορούν μόνο αγοραστές ακινήτων. Χρησιμοποιούνται και μεταξύ **προμηθευτών, συνεργείων, υπεργολάβων**. Αυτό σημαίνει:
> - Το Cheque Registry πρέπει να είναι **κεντρικό σε επίπεδο project** (ή company), όχι μόνο κάτω από units
> - Μία επιταγή μπορεί να συνδέεται με: unit (αγοραστής), contact (προμηθευτής), ή project (εργολαβικά)
> - Η Firestore δομή αλλάζει: **top-level collection `cheques`** αντί subcollection of unit
> - Κάθε ChequeRecord έχει `context` field: `{ type: 'unit_sale' | 'supplier' | 'contractor', entityId: string }`

---

## 2. Νομικό Πλαίσιο (Ν. 5960/1933)

### 2.1 Υποχρεωτικά Στοιχεία Επιταγής

| # | Στοιχείο | Περιγραφή | Field |
|---|----------|-----------|-------|
| 1 | Λέξη "Επιταγή" | Αναγραφή στο σώμα του εγγράφου | `instrumentType: 'cheque'` |
| 2 | Ποσό | Αριθμητικώς και ολογράφως | `amount`, `amountInWords` |
| 3 | Πληρώτρια Τράπεζα | Τράπεζα που θα πληρώσει | `draweeBank` |
| 4 | Τόπος Πληρωμής | Κατάστημα τράπεζας | `paymentPlace` |
| 5 | Τόπος Έκδοσης | Πόλη έκδοσης | `issuePlace` |
| 6 | Ημερομηνία Έκδοσης | Ημέρα / μήνας / έτος | `issueDate` |
| 7 | Υπογραφή Εκδότη | Ο εκδότης υπογράφει | `drawerName` (+ φυσικό έγγραφο) |

### 2.2 Βασικοί Νομικοί Κανόνες

| Κανόνας | Λεπτομέρεια |
|---------|-------------|
| **Εμφάνιση** | 8 ημέρες από ημερομηνία έκδοσης (εντός Ελλάδας) |
| **Μεταχρονολογημένη** | Η 8ήμερη προθεσμία τρέχει από τη μεταγενέστερη ημερομηνία |
| **Οπισθογράφηση** | Μεταβίβαση σε τρίτους μέσω υπογραφής στο πίσω μέρος |
| **Ακάλυπτη** | Ποινικό αδίκημα (Άρθρο 79 Ν. 5960/1933) + εγγραφή στον Τειρεσία |
| **Ανάκληση** | Ο εκδότης ζητά από τράπεζα να μην πληρώσει — ΜΟΝΟ μετά την 8ήμερη προθεσμία |
| **Παραγραφή** | 6 μήνες (αξίωση αναγωγής), 3 έτη (αξίωση αδικαιολόγητου πλουτισμού) |

### 2.3 Ειδικές Κατηγορίες

| Κατηγορία | Περιγραφή | Σημείωση |
|-----------|-----------|----------|
| **Τραπεζική** | Εκδίδεται από τράπεζα — εγγυημένη κάλυψη | `chequeType: 'bank_cheque'` |
| **Προσωπική** | Εκδίδεται από φυσικό/νομικό πρόσωπο | `chequeType: 'personal_cheque'` |
| **Δίγραμμη** | Δύο παράλληλες γραμμές — μόνο κατάθεση σε λ/σμό | `crossedCheque: true` |
| **Μεταχρονολογημένη** | Ημερομηνία στο μέλλον — τυπικά σε δόσεις | `postDated: true` |

---

## 3. Data Model

### 3.1 ChequeRecord Interface

```typescript
import type { Timestamp } from 'firebase/firestore';

/** Τύπος επιταγής */
export type ChequeType = 'bank_cheque' | 'personal_cheque';

/** Κατάσταση lifecycle επιταγής */
export type ChequeStatus =
  | 'received'       // Παραλήφθηκε από τον αγοραστή
  | 'in_custody'     // Στο χρηματοκιβώτιο / φύλαξη
  | 'deposited'      // Κατατέθηκε στην τράπεζα
  | 'clearing'       // Σε εκκαθάριση (1-3 εργάσιμες)
  | 'cleared'        // Εισπράχθηκε — ποσό πιστώθηκε
  | 'bounced'        // Ακάλυπτη / σφραγίστηκε
  | 'endorsed'       // Οπισθογραφήθηκε σε τρίτο
  | 'cancelled'      // Ακυρώθηκε (ανάκληση)
  | 'expired'        // Πέρασε η προθεσμία εμφάνισης χωρίς ενέργεια
  | 'replaced';      // Αντικαταστάθηκε από νέα επιταγή

/** Λόγος ακάλυπτης (bounced reason) */
export type BouncedReason =
  | 'insufficient_funds'    // Ανεπαρκές υπόλοιπο
  | 'account_closed'        // Κλειστός λογαριασμός
  | 'signature_mismatch'    // Ασυμφωνία υπογραφής
  | 'stop_payment'          // Ανάκληση (εντολή μη πληρωμής)
  | 'post_dated_early'      // Εμφανίστηκε πριν την ημερομηνία
  | 'technical_issue'       // Τεχνικό πρόβλημα (π.χ. φθορά)
  | 'other';                // Άλλος λόγος

/**
 * Μητρώο Επιταγής — Subcollection units/{unitId}/cheques/{chequeId}
 * ΕΝΑ document ανά επιταγή, ανεξάρτητα αν αφορά μία ή πολλές δόσεις
 */
export interface ChequeRecord {
  /** Document ID */
  id: string;

  /** Reference → unit */
  unitId: string;

  /** Reference → payment plan */
  paymentPlanId: string;

  /** Reference → buyer contact */
  buyerContactId: string;

  // --- Στοιχεία Επιταγής (Ν. 5960/1933) ---

  /** Αριθμός επιταγής */
  chequeNumber: string;

  /** Τύπος */
  chequeType: ChequeType;

  /** Ποσό (EUR) */
  amount: number;

  /** Ποσό ολογράφως (ελληνικά) */
  amountInWords: string | null;

  /** Πληρώτρια τράπεζα */
  draweeBank: string;

  /** Υποκατάστημα τράπεζας */
  draweeBranch: string | null;

  /** Εκδότης (φυσικό/νομικό πρόσωπο) */
  drawerName: string;

  /** ΑΦΜ εκδότη */
  drawerTaxId: string | null;

  /** Τόπος έκδοσης */
  issuePlace: string | null;

  /** Ημερομηνία έκδοσης */
  issueDate: Timestamp;

  /** Ημερομηνία λήξης / εμφάνισης (maturity) */
  maturityDate: Timestamp;

  /** Μεταχρονολογημένη; */
  postDated: boolean;

  /** Δίγραμμη; (crossed cheque — μόνο κατάθεση) */
  crossedCheque: boolean;

  // --- Lifecycle ---

  /** Τρέχουσα κατάσταση */
  status: ChequeStatus;

  /** Ημερομηνία κατάθεσης στην τράπεζα */
  depositDate: Timestamp | null;

  /** Τράπεζα κατάθεσης (δική μας) */
  depositBank: string | null;

  /** Ημερομηνία εκκαθάρισης / πίστωσης */
  clearingDate: Timestamp | null;

  // --- Bounced (Ακάλυπτη) ---

  /** Ημερομηνία σφράγισης */
  bouncedDate: Timestamp | null;

  /** Λόγος */
  bouncedReason: BouncedReason | null;

  /** Βεβαίωση μη πληρωμής (αριθμός) */
  nonPaymentCertificateNumber: string | null;

  /** Αναγγελία στον Τειρεσία */
  teiresiasFiled: boolean;

  /** Ημερομηνία αναγγελίας */
  teiresiasFiledDate: Timestamp | null;

  /** Αστυνομική μήνυση κατατέθηκε; */
  policeCaseFiled: boolean;

  /** Αριθμός μήνυσης */
  policeCaseNumber: string | null;

  // --- Endorsement (Οπισθογράφηση) ---

  /** Οπισθογραφήθηκε; */
  endorsed: boolean;

  /** Αλυσίδα οπισθογραφήσεων */
  endorsementChain: EndorsementEntry[];

  // --- Replacement ---

  /** Αντικαταστάθηκε από νέα επιταγή; */
  replacedByChequeId: string | null;

  /** Αντικαθιστά παλαιότερη επιταγή; */
  replacesChequeId: string | null;

  // --- References ---

  /** Reference → payment record (αν εισπράχθηκε) */
  paymentId: string | null;

  /** Reference → installment index (ποια δόση καλύπτει) */
  installmentIndex: number | null;

  /** Σημειώσεις */
  notes: string | null;

  // --- Audit ---
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/** Εγγραφή οπισθογράφησης */
export interface EndorsementEntry {
  /** Σειρά (1, 2, 3...) */
  order: number;

  /** Οπισθογράφος (αυτός που μεταβιβάζει) */
  endorserName: string;

  /** Αποδέκτης (αυτός που λαμβάνει) */
  endorseeName: string;

  /** Ημερομηνία οπισθογράφησης */
  endorsementDate: Timestamp;

  /** Σημειώσεις */
  notes: string | null;
}
```

### 3.2 Cheque Context (Wider Scope)

```typescript
/** Πλαίσιο χρήσης επιταγής — σε ποια σχέση ανήκει */
export type ChequeContextType =
  | 'unit_sale'     // Αγοραστής → πωλητής (πώληση ακινήτου)
  | 'supplier'      // Προμηθευτής υλικών
  | 'contractor'    // Υπεργολάβος / συνεργείο
  | 'other';        // Λοιπά

export interface ChequeContext {
  /** Τύπος σχέσης */
  type: ChequeContextType;

  /** ID entity (unitId, contactId, projectId ανάλογα) */
  entityId: string;

  /** Project ID (πάντα υπάρχει — ανεξαρτήτως context) */
  projectId: string;

  /** Unit ID (μόνο αν type = 'unit_sale') */
  unitId: string | null;

  /** Payment Plan ID (μόνο αν type = 'unit_sale') */
  paymentPlanId: string | null;

  /** Contact ID (buyer, supplier, contractor) */
  contactId: string;

  /** Κατεύθυνση: εισερχόμενη (λαμβάνουμε) ή εξερχόμενη (δίνουμε) */
  direction: 'incoming' | 'outgoing';
}
```

> **`direction` field**: Κρίσιμο distinction:
> - `incoming`: Ο αγοραστής/προμηθευτής μας δίνει επιταγή (εισπράττουμε)
> - `outgoing`: Εμείς δίνουμε επιταγή σε υπεργολάβο/προμηθευτή (πληρώνουμε)

### 3.3 Firestore Structure (Updated — Top-Level Collection)

```
cheques/{chequeId}     ← Top-level collection (NOT subcollection)
  chequeNumber: "1234567"
  chequeType: "bank_cheque"
  status: "cleared"
  context: {
    type: "unit_sale",
    projectId: "proj_123",
    unitId: "unit_456",
    contactId: "contact_789",
    direction: "incoming"
  }
  endorsementChain: [...]
```

### 3.4 Firestore Collection Registration

```typescript
// src/config/firestore-collections.ts — addition
CHEQUES: 'cheques',   // Top-level collection — wider scope (sales + suppliers + contractors)
```

---

## 4. Lifecycle / State Machine

### 4.1 State Diagram

```
                    ┌─────────┐
                    │ received│
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │in_custody│
                    └────┬────┘
                    ┌────┤────────────────┐
                    │    │                │
               ┌────▼───┐      ┌────────▼───┐
               │deposited│      │  endorsed  │
               └────┬────┘      └────────────┘
                    │
               ┌────▼───┐
               │clearing │
               └────┬────┘
               ┌────┤────┐
               │         │
          ┌────▼──┐  ┌───▼───┐
          │cleared │  │bounced│
          └───────┘  └───┬───┘
                         │
                    ┌────▼────┐
                    │replaced │  (νέα επιταγή αντικαθιστά)
                    └─────────┘

Parallel paths from any non-terminal:
  → cancelled (ανάκληση)
  → expired (παρέλευση προθεσμίας)
```

### 4.2 Allowed Transitions

| From | To | Condition | Action |
|------|----|-----------|--------|
| `received` | `in_custody` | Καταχωρήθηκε στο μητρώο | Log entry |
| `in_custody` | `deposited` | Κατατέθηκε στην τράπεζα | Set `depositDate`, `depositBank` |
| `in_custody` | `endorsed` | Οπισθογραφήθηκε σε τρίτο | Add `endorsementChain` entry |
| `deposited` | `clearing` | Τράπεζα ξεκίνησε εκκαθάριση | Automatic (1-3 εργάσιμες) |
| `clearing` | `cleared` | Ποσό πιστώθηκε | Set `clearingDate`, create `PaymentRecord` |
| `clearing` | `bounced` | Ακάλυπτη | Set `bouncedDate`, `bouncedReason` |
| `bounced` | `replaced` | Νέα επιταγή αντικαθιστά | Set `replacedByChequeId` |
| * (non-terminal) | `cancelled` | Ανάκληση / ακύρωση | Log reason |
| * (non-terminal) | `expired` | Πάρε 8+ ημέρες χωρίς εμφάνιση | Automatic check |

### 4.3 Terminal States

- `cleared` — Επιτυχής είσπραξη
- `bounced` — Ακάλυπτη (μπορεί να οδηγήσει σε `replaced`)
- `endorsed` — Μεταβιβάστηκε (δεν μας αφορά πλέον)
- `cancelled` — Ακυρώθηκε
- `expired` — Έληξε
- `replaced` — Αντικαταστάθηκε

---

## 5. Business Rules & Validation

### 5.1 Validation Rules

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **V-CHQ-001** | `chequeNumber` υποχρεωτικό, unique per `draweeBank` | Server-side |
| **V-CHQ-002** | `amount` > 0, max €500.000 (configurable limit) | Server-side |
| **V-CHQ-003** | `maturityDate` ≥ `issueDate` | Server-side |
| **V-CHQ-004** | `depositDate` ≤ σήμερα | Server-side |
| **V-CHQ-005** | Μεταχρονολογημένη: `maturityDate` > `issueDate` | Auto-detect |
| **V-CHQ-006** | Bounced: `bouncedReason` required when status = 'bounced' | Server-side |
| **V-CHQ-007** | Endorsement: endorser ≠ endorsee | Server-side |
| **V-CHQ-008** | Replacement: new cheque amount ≥ bounced cheque amount | Business rule |

### 5.2 Bounced Cheque Workflow

```
Επιταγή σφραγίζεται (bounced)
  │
  ├─ 1. Βεβαίωση μη πληρωμής (certificate) → nonPaymentCertificateNumber
  │
  ├─ 2. Αναγγελία Τειρεσία (48 ώρες) → teiresiasFiled = true
  │
  ├─ 3. Μήνυση (αν > €200) → policeCaseFiled = true, policeCaseNumber
  │
  ├─ 4. Ειδοποίηση αγοραστή (UI notification)
  │
  └─ 5. Αντικατάσταση ή νομική αγωγή
       │
       ├─ Αντικατάσταση → Νέα ChequeRecord, replacedByChequeId
       └─ Αγωγή → notes, external legal tracking
```

### 5.3 Maturity Date Alert Rules

| Alert | Condition | When |
|-------|-----------|------|
| **Upcoming maturity** | `maturityDate` - σήμερα ≤ 7 ημέρες | Dashboard notification |
| **Due today** | `maturityDate` = σήμερα | Urgent notification |
| **Overdue (not deposited)** | σήμερα > `maturityDate` + 8 ημέρες, status = 'in_custody' | Warning |

---

## 6. UI Components & Flow

### 6.1 Component Tree

| Component | Location | Description |
|-----------|----------|-------------|
| `ChequeRegistryTab` | PaymentPlanTab child | Container — λίστα + actions |
| `ChequeTable` | ChequeRegistryTab | Sortable/filterable πίνακας επιταγών |
| `ChequeDetailDialog` | Modal | Πλήρης προβολή στοιχείων + lifecycle timeline |
| `AddChequeDialog` | Modal | Φόρμα καταχώρησης νέας επιταγής |
| `BouncedChequeDialog` | Modal | Workflow σφραγισμένης — Τειρεσίας, μήνυση, αντικατάσταση |
| `ChequeStatusBadge` | Inline | Color-coded status badge |
| `EndorsementChainView` | ChequeDetailDialog section | Timeline οπισθογραφήσεων |

### 6.2 ChequeTable Columns

| Column | Field | Sortable | Filterable |
|--------|-------|----------|------------|
| Αρ. Επιταγής | `chequeNumber` | Yes | Yes (search) |
| Τύπος | `chequeType` | No | Yes (dropdown) |
| Ποσό | `amount` | Yes | Yes (range) |
| Εκδότης | `drawerName` | Yes | Yes (search) |
| Τράπεζα | `draweeBank` | No | Yes (dropdown) |
| Ημ. Έκδοσης | `issueDate` | Yes | Yes (date range) |
| Ημ. Λήξης | `maturityDate` | Yes | Yes (date range) |
| Κατάσταση | `status` | No | Yes (multi-select) |

### 6.3 FalconPro-Inspired Filters

Ειδικά φίλτρα για property management context:

| Filter | Logic |
|--------|-------|
| Per Property | Aggregate cheques across all units of a project |
| Per Unit | Cheques subcollection of specific unit |
| Per Client (buyer) | Filter by `buyerContactId` |
| Bounced Only | `status = 'bounced'` |
| Maturing This Week | `maturityDate` between today and today+7 |
| Pending Deposit | `status = 'in_custody'`, `maturityDate` ≤ today |

---

## 7. API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/units/[unitId]/cheques` | Λίστα επιταγών μονάδας |
| `POST` | `/api/units/[unitId]/cheques` | Καταχώρηση νέας επιταγής |
| `GET` | `/api/units/[unitId]/cheques/[chequeId]` | Λεπτομέρειες επιταγής |
| `PATCH` | `/api/units/[unitId]/cheques/[chequeId]` | Ενημέρωση στοιχείων |
| `POST` | `/api/units/[unitId]/cheques/[chequeId]/transition` | Αλλαγή status (state machine) |
| `POST` | `/api/units/[unitId]/cheques/[chequeId]/endorse` | Οπισθογράφηση |
| `POST` | `/api/units/[unitId]/cheques/[chequeId]/bounce` | Σφράγιση ακάλυπτης |
| `GET` | `/api/projects/[projectId]/cheques` | Aggregate — όλες οι επιταγές project |

---

## 8. Integration Points

| System | Integration | Details |
|--------|-------------|---------|
| **ADR-234 PaymentPlan** | Cheque → `paymentId`, `installmentIndex` | Σύνδεση επιταγής με δόση |
| **ADR-198 Accounting** | Cleared cheque → `PaymentRecord` → Invoice | Αυτόματη λογιστική εγγραφή |
| **ADR-230 Contracts** | Contract phase triggers cheque schedule | Π.χ. προσύμφωνο → προκαταβολή cheque |
| **SPEC-234D Installments** | Installment method = 'cheque' → link | Cross-reference |
| **Τειρεσίας** | External — manual entry, flag `teiresiasFiled` | Μελλοντικό: API integration |
| **Dashboard** | Bounced alert, maturity countdown | Real-time notifications |

---

## 9. i18n Keys

```json
{
  "chequeRegistry": {
    "title": "Μητρώο Επιταγών",
    "addCheque": "Νέα Επιταγή",

    "chequeType": {
      "bank_cheque": "Τραπεζική Επιταγή",
      "personal_cheque": "Προσωπική Επιταγή"
    },

    "status": {
      "received": "Παραλήφθηκε",
      "in_custody": "Σε Φύλαξη",
      "deposited": "Κατατέθηκε",
      "clearing": "Εκκαθάριση",
      "cleared": "Εισπράχθηκε",
      "bounced": "Ακάλυπτη",
      "endorsed": "Οπισθογραφήθηκε",
      "cancelled": "Ακυρώθηκε",
      "expired": "Εκπρόθεσμη",
      "replaced": "Αντικαταστάθηκε"
    },

    "bouncedReason": {
      "insufficient_funds": "Ανεπαρκές Υπόλοιπο",
      "account_closed": "Κλειστός Λογαριασμός",
      "signature_mismatch": "Ασυμφωνία Υπογραφής",
      "stop_payment": "Ανάκληση Πληρωμής",
      "post_dated_early": "Πρόωρη Εμφάνιση",
      "technical_issue": "Τεχνικό Πρόβλημα",
      "other": "Άλλος Λόγος"
    },

    "fields": {
      "chequeNumber": "Αρ. Επιταγής",
      "amount": "Ποσό",
      "amountInWords": "Ποσό Ολογράφως",
      "draweeBank": "Πληρώτρια Τράπεζα",
      "draweeBranch": "Υποκατάστημα",
      "drawerName": "Εκδότης",
      "drawerTaxId": "ΑΦΜ Εκδότη",
      "issueDate": "Ημ. Έκδοσης",
      "maturityDate": "Ημ. Λήξης",
      "depositDate": "Ημ. Κατάθεσης",
      "clearingDate": "Ημ. Εκκαθάρισης",
      "postDated": "Μεταχρονολογημένη",
      "crossedCheque": "Δίγραμμη"
    },

    "actions": {
      "deposit": "Κατάθεση",
      "endorse": "Οπισθογράφηση",
      "markBounced": "Σφράγιση Ακάλυπτης",
      "replace": "Αντικατάσταση",
      "fileTeiresias": "Αναγγελία Τειρεσία",
      "filePoliceCase": "Κατάθεση Μήνυσης"
    }
  }
}
```

---

## 10. Verification Criteria

1. `ChequeRecord` interface: πλήρης, χωρίς `any`, Firestore-compatible (null not undefined)
2. State machine: κάθε transition validated server-side
3. Bounced workflow: Τειρεσίας + μήνυση flags
4. Endorsement chain: ordered array, endorser ≠ endorsee
5. Integration: cleared → `PaymentRecord` αυτόματα
6. i18n: EL + EN keys πλήρεις
7. Filters: per project, per unit, per client, bounced, maturity range

---

*SPEC Format: Google Engineering Design Docs standard*
