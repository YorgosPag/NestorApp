# SPEC-234B: Bills of Exchange — Συναλλαγματικές (Γραμμάτια)

| Field | Value |
|-------|-------|
| **ADR** | ADR-234 |
| **Phase** | B — Bills of Exchange & Promissory Notes |
| **Priority** | LOW — FROZEN |
| **Status** | FROZEN — Δεν υλοποιείται μέχρι νεωτέρας (2026-03-15 απόφαση Γιώργου) |
| **Estimated Effort** | 1-2 sessions |
| **Prerequisite** | ADR-234 types, SPEC-234A (shared instrument patterns) |
| **Dependencies** | SPEC-234D depends on this (payment recording) |

---

## 1. Objective

Δημιουργία module για **Συναλλαγματικές** (Bills of Exchange) και **Γραμμάτια εις Διαταγήν** (Promissory Notes) σύμφωνα με τον Ν. 5325/1932. Αν και σπάνιες στις πωλήσεις ακινήτων, χρησιμοποιούνται σε εμπορικές συναλλαγές μεγάλων κατασκευαστικών (stage payments, εργολαβικά). Η εφαρμογή πρέπει να τις υποστηρίζει ως αξιόγραφα με πλήρες lifecycle.

> **FROZEN (2026-03-15)**: Ο Γιώργος αποφάσισε ότι οι συναλλαγματικές δεν χρησιμοποιούνται αρκετά στην πράξη. Η spec παραμένει ως τεκμηρίωση για μελλοντική υλοποίηση αν ζητηθεί. Δεν υλοποιείται στις τρέχουσες φάσεις.

**Κεντρική διαφορά από επιταγή**: Η συναλλαγματική περιέχει εντολή πληρωμής από εκδότη → πληρωτή → λήπτη (τριμερής σχέση), ενώ η επιταγή είναι εντολή πληρωμής σε τράπεζα. Η συναλλαγματική απαιτεί **αποδοχή (acceptance)** από τον πληρωτή.

---

## 2. Νομικό Πλαίσιο (Ν. 5325/1932)

### 2.1 Υποχρεωτικά Στοιχεία Συναλλαγματικής

| # | Στοιχείο | Περιγραφή | Field |
|---|----------|-----------|-------|
| 1 | Λέξη "Συναλλαγματική" | Στο σώμα του εγγράφου, στη γλώσσα σύνταξης | `instrumentType: 'bill_of_exchange'` |
| 2 | Ανεπιφύλακτη εντολή πληρωμής | "Πληρώσατε..." | (φυσικό έγγραφο) |
| 3 | Ποσό | Αριθμητικώς και ολογράφως | `amount`, `amountInWords` |
| 4 | Όνομα πληρωτή | Αυτός που πρέπει να πληρώσει (drawee) | `draweeName` |
| 5 | Λήξη | Πότε πρέπει να πληρωθεί | `maturityDate`, `maturityType` |
| 6 | Τόπος πληρωμής | Πού θα γίνει η πληρωμή | `paymentPlace` |
| 7 | Λήπτης | Αυτός που θα εισπράξει (payee) | `payeeName` |
| 8 | Τόπος + Ημ. Έκδοσης | Πού και πότε εκδόθηκε | `issuePlace`, `issueDate` |
| 9 | Υπογραφή εκδότη | Ο εκδότης υπογράφει (drawer) | `drawerName` |

### 2.2 Τύποι Λήξης (Maturity Types)

| Τύπος | Περιγραφή | Υπολογισμός |
|-------|-----------|-------------|
| `at_sight` | Εν όψει — πληρωτέα κατά την εμφάνιση | maturityDate = presentmentDate |
| `at_fixed_period_after_sight` | Σε τακτό χρόνο μετά την εμφάνιση | maturityDate = acceptanceDate + period |
| `at_fixed_period_after_date` | Σε τακτό χρόνο από ημ. έκδοσης | maturityDate = issueDate + period |
| `at_fixed_date` | Σε ορισμένη ημέρα | maturityDate = fixed date |

### 2.3 Βασικοί Νομικοί Κανόνες

| Κανόνας | Λεπτομέρεια |
|---------|-------------|
| **Αποδοχή (Acceptance)** | Γραπτή δήλωση πληρωτή ότι δέχεται να πληρώσει — "αποδέχομαι" + υπογραφή |
| **Αποδοχή ≠ Πληρωμή** | Αποδοχή δημιουργεί υποχρέωση, δεν σημαίνει ότι πλήρωσε |
| **Οπισθογράφηση** | Μονομερής δήλωση βούλησης, γράφεται στο πίσω μέρος, μεταβιβάζει δικαιώματα |
| **Διαμαρτύρηση (Protest)** | Τυπική προϋπόθεση αναγωγής — δημόσιο έγγραφο (συμβολαιογράφος/δικαστικός) |
| **Αναγωγή (Recourse)** | Δικαίωμα κατά εκδότη + οπισθογράφων αν δεν πληρωθεί |
| **Παραγραφή** | 3 έτη (κατά αποδέκτη), 1 έτος (κατά οπισθογράφων), 6 μήνες (μεταξύ οπισθογράφων) |
| **Αβάλ (Aval)** | Εγγύηση τρίτου — ο εγγυητής ευθύνεται αλληλέγγυα |

### 2.4 Γραμμάτιο εις Διαταγήν (Promissory Note)

| Διαφορά | Συναλλαγματική | Γραμμάτιο |
|---------|----------------|-----------|
| Μέρη | 3 (εκδότης, πληρωτής, λήπτης) | 2 (εκδότης=πληρωτής, λήπτης) |
| Αποδοχή | Ναι (απαιτείται) | Όχι (αυτοδίκαια — ο εκδότης υπόσχεται) |
| Εντολή | "Πληρώσατε..." | "Υπόσχομαι να πληρώσω..." |

---

## 3. Data Model

### 3.1 BillOfExchangeRecord Interface

```typescript
import type { Timestamp } from 'firebase/firestore';

/** Τύπος αξιόγραφου */
export type BillInstrumentType = 'bill_of_exchange' | 'promissory_note';

/** Τρόπος λήξης */
export type MaturityType =
  | 'at_sight'                        // Εν όψει
  | 'at_fixed_period_after_sight'     // Τακτό χρόνο μετά εμφάνιση
  | 'at_fixed_period_after_date'      // Τακτό χρόνο από ημ. έκδοσης
  | 'at_fixed_date';                  // Ορισμένη ημέρα

/** Κατάσταση lifecycle */
export type BillStatus =
  | 'issued'            // Εκδόθηκε
  | 'presented'         // Εμφανίστηκε για αποδοχή
  | 'accepted'          // Αποδεκτή (πληρωτής αποδέχτηκε)
  | 'acceptance_refused' // Αρνήθηκε αποδοχή
  | 'in_custody'        // Σε φύλαξη (αποδεκτή, αναμένεται λήξη)
  | 'endorsed'          // Οπισθογραφήθηκε
  | 'presented_payment' // Εμφανίστηκε για πληρωμή
  | 'paid'              // Πληρώθηκε
  | 'protested'         // Διαμαρτυρήθηκε (δεν πληρώθηκε)
  | 'recourse_filed'    // Ασκήθηκε αναγωγή
  | 'settled'           // Διακανονίστηκε (μετά αναγωγή)
  | 'expired'           // Παραγράφηκε
  | 'cancelled';        // Ακυρώθηκε

/** Protest reason */
export type ProtestReason =
  | 'non_acceptance'    // Μη αποδοχή
  | 'non_payment'       // Μη πληρωμή
  | 'partial_acceptance' // Μερική αποδοχή
  | 'partial_payment';  // Μερική πληρωμή

/**
 * Μητρώο Συναλλαγματικής/Γραμματίου
 * Subcollection: units/{unitId}/bills/{billId}
 */
export interface BillOfExchangeRecord {
  /** Document ID */
  id: string;

  /** Reference → unit */
  unitId: string;

  /** Reference → payment plan */
  paymentPlanId: string;

  /** Reference → buyer/payer contact */
  payerContactId: string;

  // --- Στοιχεία Αξιόγραφου (Ν. 5325/1932) ---

  /** Τύπος: Συναλλαγματική ή Γραμμάτιο */
  instrumentType: BillInstrumentType;

  /** Αριθμός αξιόγραφου (εσωτερική αρίθμηση) */
  billNumber: string;

  /** Ποσό (EUR) */
  amount: number;

  /** Ποσό ολογράφως */
  amountInWords: string | null;

  // --- Μέρη (Parties) ---

  /** Εκδότης (drawer) — αυτός που εντέλλεται την πληρωμή */
  drawerName: string;

  /** ΑΦΜ εκδότη */
  drawerTaxId: string | null;

  /**
   * Πληρωτής (drawee) — αυτός που πρέπει να πληρώσει.
   * Στο γραμμάτιο: ίδιος με τον εκδότη (drawer = drawee)
   */
  draweeName: string | null;

  /** ΑΦΜ πληρωτή */
  draweeTaxId: string | null;

  /** Λήπτης (payee) — αυτός που εισπράττει */
  payeeName: string;

  // --- Χρόνος & Τόπος ---

  /** Τόπος έκδοσης */
  issuePlace: string | null;

  /** Ημερομηνία έκδοσης */
  issueDate: Timestamp;

  /** Τρόπος λήξης */
  maturityType: MaturityType;

  /**
   * Περίοδος (σε ημέρες) — μόνο για at_fixed_period_after_sight / after_date
   */
  maturityPeriodDays: number | null;

  /** Ημερομηνία λήξης (υπολογισμένη ή σταθερή) */
  maturityDate: Timestamp | null;

  /** Τόπος πληρωμής */
  paymentPlace: string | null;

  // --- Lifecycle ---

  /** Τρέχουσα κατάσταση */
  status: BillStatus;

  // --- Acceptance (Αποδοχή) ---

  /** Αποδοχή έγινε; (μόνο για bill_of_exchange, όχι promissory_note) */
  accepted: boolean;

  /** Ημερομηνία αποδοχής */
  acceptanceDate: Timestamp | null;

  /** Σημειώσεις αποδοχής */
  acceptanceNotes: string | null;

  // --- Protest (Διαμαρτύρηση) ---

  /** Διαμαρτύρηση κατατέθηκε; */
  protested: boolean;

  /** Ημερομηνία διαμαρτύρησης */
  protestDate: Timestamp | null;

  /** Λόγος διαμαρτύρησης */
  protestReason: ProtestReason | null;

  /** Αρ. πρωτοκόλλου διαμαρτύρησης */
  protestProtocolNumber: string | null;

  /** Συμβολαιογράφος/δικαστικός που συνέταξε */
  protestOfficerName: string | null;

  // --- Recourse (Αναγωγή) ---

  /** Αναγωγή ασκήθηκε; */
  recourseFiled: boolean;

  /** Κατά ποιου (drawer, endorser...) */
  recourseAgainst: string | null;

  /** Ημερομηνία αναγωγής */
  recourseDate: Timestamp | null;

  // --- Aval (Εγγύηση) ---

  /** Υπάρχει αβάλ (εγγύηση τρίτου); */
  hasAval: boolean;

  /** Εγγυητής */
  avalGiverName: string | null;

  /** Υπέρ ποιου (αποδέκτη ή εκδότη) */
  avalForParty: string | null;

  // --- Endorsement (Οπισθογράφηση) ---

  /** Αλυσίδα οπισθογραφήσεων (ίδια δομή με SPEC-234A) */
  endorsementChain: BillEndorsementEntry[];

  // --- References ---

  /** Reference → payment record (αν πληρώθηκε) */
  paymentId: string | null;

  /** Reference → installment index */
  installmentIndex: number | null;

  /** Σημειώσεις */
  notes: string | null;

  // --- Prescription (Παραγραφή) ---

  /** Ημερομηνία παραγραφής κατά αποδέκτη (3 έτη) */
  prescriptionDateAcceptor: Timestamp | null;

  /** Ημερομηνία παραγραφής κατά οπισθογράφων (1 έτος) */
  prescriptionDateEndorsers: Timestamp | null;

  // --- Audit ---
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/** Endorsement entry for bill */
export interface BillEndorsementEntry {
  order: number;
  endorserName: string;
  endorseeName: string;
  endorsementDate: Timestamp;
  notes: string | null;
}
```

### 3.2 Firestore Structure

```
units/{unitId}/
  └── bills/{billId}     ← BillOfExchangeRecord document
        instrumentType: "bill_of_exchange"
        status: "accepted"
        endorsementChain: [...]
```

### 3.3 Firestore Collection Registration

```typescript
// src/config/firestore-collections.ts — addition
BILLS: 'bills',   // Subcollection of units — Bills of Exchange & Promissory Notes
```

---

## 4. Lifecycle / State Machine

### 4.1 Bill of Exchange (Συναλλαγματική) — 3 μέρη

```
┌────────┐
│ issued │  (εκδότης δημιούργησε)
└───┬────┘
    │
┌───▼──────┐
│presented │  (εμφανίστηκε στον πληρωτή για αποδοχή)
└───┬──────┘
    ├──────────────────┐
    │                  │
┌───▼─────┐    ┌──────▼──────────┐
│accepted │    │acceptance_refused│
└───┬─────┘    └────────┬────────┘
    │                   │
┌───▼──────┐    ┌──────▼────┐
│in_custody│    │ protested │  (διαμαρτύρηση μη αποδοχής)
└───┬──────┘    └──────┬────┘
    │                  │
    ├─────┐     ┌──────▼──────┐
    │     │     │recourse_filed│
    │     │     └──────┬──────┘
    │     │            │
    │  ┌──▼─────┐  ┌──▼─────┐
    │  │endorsed│  │settled │
    │  └────────┘  └────────┘
    │
┌───▼──────────────┐
│presented_payment │  (εμφανίστηκε για πληρωμή στη λήξη)
└───┬──────────────┘
    ├────────┐
    │        │
┌───▼──┐  ┌─▼────────┐
│ paid │  │ protested│  (διαμαρτύρηση μη πληρωμής)
└──────┘  └────┬─────┘
               │
         ┌─────▼──────┐
         │recourse_filed│
         └─────┬──────┘
               │
         ┌─────▼──┐
         │settled │
         └────────┘
```

### 4.2 Promissory Note (Γραμμάτιο) — 2 μέρη, χωρίς acceptance

```
┌────────┐
│ issued │  (εκδότης = πληρωτής, υπόσχεται πληρωμή)
└───┬────┘
    │
┌───▼──────┐
│in_custody│  (αναμένεται λήξη)
└───┬──────┘
    │
┌───▼──────────────┐
│presented_payment │
└───┬──────────────┘
    ├────────┐
    │        │
┌───▼──┐  ┌─▼────────┐
│ paid │  │ protested│
└──────┘  └──────────┘
```

### 4.3 Allowed Transitions

| From | To | Instrument | Condition |
|------|----|------------|-----------|
| `issued` | `presented` | bill_of_exchange | Εμφανίστηκε στον πληρωτή |
| `issued` | `in_custody` | promissory_note | Δεν χρειάζεται αποδοχή |
| `presented` | `accepted` | bill_of_exchange | Πληρωτής αποδέχτηκε |
| `presented` | `acceptance_refused` | bill_of_exchange | Πληρωτής αρνήθηκε |
| `accepted` | `in_custody` | bill_of_exchange | Αναμένεται λήξη |
| `acceptance_refused` | `protested` | bill_of_exchange | Διαμαρτύρηση μη αποδοχής |
| `in_custody` | `presented_payment` | both | Εμφανίστηκε στη λήξη |
| `in_custody` | `endorsed` | both | Οπισθογραφήθηκε |
| `presented_payment` | `paid` | both | Πληρώθηκε |
| `presented_payment` | `protested` | both | Δεν πληρώθηκε |
| `protested` | `recourse_filed` | both | Αναγωγή κατά εκδότη/οπισθογράφων |
| `recourse_filed` | `settled` | both | Διακανονισμός μετά αναγωγή |
| * (non-terminal) | `cancelled` | both | Ακύρωση |
| * (non-terminal) | `expired` | both | Παραγραφή |

---

## 5. Business Rules & Validation

### 5.1 Validation Rules

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **V-BILL-001** | `billNumber` υποχρεωτικό | Server-side |
| **V-BILL-002** | `amount` > 0 | Server-side |
| **V-BILL-003** | `draweeName` required για `bill_of_exchange`, nullable για `promissory_note` | Server-side |
| **V-BILL-004** | `acceptanceDate` required όταν `accepted = true` | Server-side |
| **V-BILL-005** | `protestDate` required όταν `protested = true` | Server-side |
| **V-BILL-006** | `maturityPeriodDays` required μόνο για `at_fixed_period_*` maturity types | Server-side |
| **V-BILL-007** | Promissory note: δεν μπορεί status `presented` ή `accepted` | State machine |
| **V-BILL-008** | Protest πρέπει εντός 2 εργάσιμων ημερών μετά τη λήξη | Business warning |

### 5.2 Prescription (Παραγραφή) Auto-Calculate

```
prescriptionDateAcceptor = maturityDate + 3 years
prescriptionDateEndorsers = maturityDate + 1 year (ή protest date + 1 year)
```

### 5.3 Protest Requirements

| Τύπος | Πότε | Ποιος | Αποτέλεσμα |
|-------|------|-------|------------|
| Μη αποδοχής | Εντός προθεσμίας εμφάνισης | Συμβολαιογράφος | Δικαίωμα αναγωγής χωρίς αναμονή λήξης |
| Μη πληρωμής | 2 εργάσιμες μετά τη λήξη | Συμβολαιογράφος | Δικαίωμα αναγωγής κατά εκδότη + οπισθογράφων |

---

## 6. UI Components & Flow

### 6.1 Component Tree

| Component | Location | Description |
|-----------|----------|-------------|
| `BillsRegistryTab` | PaymentPlanTab child | Container — λίστα + actions |
| `BillsTable` | BillsRegistryTab | Πίνακας αξιόγραφων |
| `BillDetailDialog` | Modal | Πλήρης προβολή + lifecycle timeline |
| `AddBillDialog` | Modal | Φόρμα — bill_of_exchange ή promissory_note toggle |
| `AcceptanceBadge` | Inline | Αποδοχή status (pending/accepted/refused) |
| `ProtestDialog` | Modal | Καταχώρηση διαμαρτύρησης |
| `BillStatusBadge` | Inline | Color-coded status |

### 6.2 BillsTable Columns

| Column | Field | Sortable |
|--------|-------|----------|
| Αρ. | `billNumber` | Yes |
| Τύπος | `instrumentType` | No |
| Ποσό | `amount` | Yes |
| Εκδότης | `drawerName` | Yes |
| Πληρωτής | `draweeName` | Yes |
| Λήπτης | `payeeName` | Yes |
| Λήξη | `maturityDate` | Yes |
| Αποδοχή | `accepted` | No |
| Κατάσταση | `status` | No |

### 6.3 Instrument Type Toggle

Το `AddBillDialog` εμφανίζει toggle:
- **Συναλλαγματική** → εμφανίζει πεδία drawee (πληρωτής), acceptance section
- **Γραμμάτιο** → κρύβει drawee, drawer = drawee αυτόματα

---

## 7. API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/units/[unitId]/bills` | Λίστα αξιόγραφων μονάδας |
| `POST` | `/api/units/[unitId]/bills` | Καταχώρηση νέας |
| `GET` | `/api/units/[unitId]/bills/[billId]` | Λεπτομέρειες |
| `PATCH` | `/api/units/[unitId]/bills/[billId]` | Ενημέρωση |
| `POST` | `/api/units/[unitId]/bills/[billId]/accept` | Αποδοχή |
| `POST` | `/api/units/[unitId]/bills/[billId]/protest` | Διαμαρτύρηση |
| `POST` | `/api/units/[unitId]/bills/[billId]/transition` | State transition |
| `POST` | `/api/units/[unitId]/bills/[billId]/endorse` | Οπισθογράφηση |

---

## 8. Integration Points

| System | Integration | Details |
|--------|-------------|---------|
| **ADR-234 PaymentPlan** | Bill → `paymentId`, `installmentIndex` | Σύνδεση αξιόγραφου με δόση |
| **ADR-198 Accounting** | Paid bill → `PaymentRecord` → Invoice | Λογιστική εγγραφή |
| **SPEC-234A Cheques** | Shared endorsement pattern, similar lifecycle | Code reuse |
| **SPEC-234D Installments** | Installment method = 'promissory_note' → link | Cross-reference |
| **Dynamics 365 Pattern** | Statuses: received, endorsed, collected, protested, settled, remitted, rediscounted | Industry alignment |

---

## 9. i18n Keys

```json
{
  "billsOfExchange": {
    "title": "Συναλλαγματικές & Γραμμάτια",
    "addBill": "Νέα Συναλλαγματική",
    "addPromissoryNote": "Νέο Γραμμάτιο",

    "instrumentType": {
      "bill_of_exchange": "Συναλλαγματική",
      "promissory_note": "Γραμμάτιο εις Διαταγήν"
    },

    "maturityType": {
      "at_sight": "Εν Όψει",
      "at_fixed_period_after_sight": "Σε Τακτό Χρόνο μετά Εμφάνιση",
      "at_fixed_period_after_date": "Σε Τακτό Χρόνο από Έκδοση",
      "at_fixed_date": "Σε Ορισμένη Ημέρα"
    },

    "status": {
      "issued": "Εκδόθηκε",
      "presented": "Εμφανίστηκε",
      "accepted": "Αποδεκτή",
      "acceptance_refused": "Αρνήθηκε Αποδοχή",
      "in_custody": "Σε Φύλαξη",
      "endorsed": "Οπισθογραφήθηκε",
      "presented_payment": "Εμφανίστηκε για Πληρωμή",
      "paid": "Πληρώθηκε",
      "protested": "Διαμαρτυρήθηκε",
      "recourse_filed": "Αναγωγή",
      "settled": "Διακανονίστηκε",
      "expired": "Παραγράφηκε",
      "cancelled": "Ακυρώθηκε"
    },

    "fields": {
      "billNumber": "Αρ. Αξιόγραφου",
      "amount": "Ποσό",
      "drawerName": "Εκδότης",
      "draweeName": "Πληρωτής",
      "payeeName": "Λήπτης",
      "issueDate": "Ημ. Έκδοσης",
      "maturityDate": "Ημ. Λήξης",
      "paymentPlace": "Τόπος Πληρωμής",
      "acceptanceDate": "Ημ. Αποδοχής",
      "protestDate": "Ημ. Διαμαρτύρησης"
    },

    "actions": {
      "present": "Εμφάνιση",
      "accept": "Αποδοχή",
      "protest": "Διαμαρτύρηση",
      "fileRecourse": "Αναγωγή",
      "endorse": "Οπισθογράφηση",
      "markPaid": "Πληρωμή"
    },

    "protestReason": {
      "non_acceptance": "Μη Αποδοχή",
      "non_payment": "Μη Πληρωμή",
      "partial_acceptance": "Μερική Αποδοχή",
      "partial_payment": "Μερική Πληρωμή"
    }
  }
}
```

---

## 10. Verification Criteria

1. `BillOfExchangeRecord` interface: πλήρης, χωρίς `any`, discriminated by `instrumentType`
2. State machine: bill_of_exchange vs promissory_note — different paths
3. Acceptance: μόνο για bill_of_exchange
4. Protest + Recourse: πλήρης workflow
5. Prescription dates: auto-calculated
6. i18n: EL + EN keys πλήρεις
7. Endorsement chain: shared pattern with SPEC-234A

---

*SPEC Format: Google Engineering Design Docs standard*
