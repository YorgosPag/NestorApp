# SPEC-230B: Real Estate Agents & Commissions

| Field | Value |
|-------|-------|
| **ADR** | ADR-230 |
| **Phase** | B — Brokerage & Commission Infrastructure |
| **Priority** | HIGH |
| **Status** | PLANNING |
| **Estimated Effort** | 1 session |
| **Prerequisite** | None |
| **Dependencies** | SPEC-230C depends on this (commission recording at contract completion) |

---

## 1. Objective

Μοντελοποίηση μεσιτικών συμφωνιών (brokerage agreements) και προμηθειών (commissions) για τη νομική διαδικασία πώλησης ακινήτων. Ο μεσίτης μπορεί να έχει αποκλειστικότητα (σε επίπεδο project ή μεμονωμένης μονάδας) και η αμοιβή του μπορεί να είναι ποσοστό επί της τιμής πώλησης ή σταθερό ποσό.

---

## 2. Domain Analysis — Ελληνική Κτηματαγορά

### Τύποι Μεσιτικής Σύμβασης
| Τύπος | Περιγραφή | Scope |
|-------|-----------|-------|
| **Αποκλειστική (exclusive)** | Μόνο αυτός ο μεσίτης μπορεί να πουλήσει | Project ή Unit |
| **Απλή (non_exclusive)** | Πολλοί μεσίτες, πληρώνεται αυτός που φέρνει τον αγοραστή | Project ή Unit |

### Scope (2026-03-15 — Απόφαση: ΟΧΙ building-level)
| Scope | Περιγραφή | Παράδειγμα |
|-------|-----------|------------|
| **project** | Αφορά ΟΛΑ τα κτίρια & μονάδες του project | "Πούλα ό,τι θέλεις στο Riviera Residence" |
| **unit** | Αφορά ΜΙΑ συγκεκριμένη μονάδα | "Πούλα μόνο το Α-301" |

> **Γιατί ΟΧΙ building-level**: Στην πράξη, η ανάθεση σε κτίριο δεν συμβαίνει αρκετά συχνά ώστε να δικαιολογεί την πολυπλοκότητα. Αν χρειαστεί, ο χρήστης μπορεί να βάλει project-level ή ξεχωριστές unit-level αναθέσεις.

### Χρονολογία & Σενάρια Σύμβασης (2026-03-15)

**Σενάριο Α — Προσυμφωνημένη ανάθεση:**
- Ο μεσίτης έρχεται εκ των προτέρων (ακόμα και πριν την κατασκευή)
- Υπογράφεται σύμβαση (απλή ή αποκλειστική)
- Η σύμβαση ζει ανεξάρτητα από τις πωλήσεις — είναι pre-sales agreement
- Ο μεσίτης εμφανίζεται στο dropdown κατά την πώληση

**Σενάριο Β — Ad-hoc μεσίτης (χωρίς προηγούμενη σύμβαση):**
- Ο μεσίτης εμφανίζεται ΤΗ ΣΤΙΓΜΗ που φέρνει αγοραστή
- ΔΕΝ υπάρχει προηγούμενη σύμβαση στο σύστημα
- Quick-add: στο SellDialog ο χρήστης πατάει "+ Νέος μεσίτης", συμπληρώνει on-the-fly (επαφή + ποσοστό)
- Δημιουργείται αυτόματα σύμβαση + commission record
- Upload εγγράφου σύμβασης: σκαναρισμένο χαρτί μεσιτικής σύμβασης → FileRecord (centralized file system, auto-naming)
- **Σημείωση**: Χωρίς σύμβαση δύσκολα λειτουργούν οι μεσίτες — προτιμάται η εκ των προτέρων δήλωση

### Αμφίδρομη Επικοινωνία Entry Points (2026-03-15)
**ΚΑΝΟΝΑΣ**: Δύο entry points, πάντα σε sync:

1. **Project → Tab "Μεσίτες"** — Κεντρικό σημείο διαχείρισης
   - Ο χρήστης βλέπει ΟΛΕΣ τις μεσιτικές συμβάσεις (απλές + αποκλειστικές)
   - Μπορεί να προσθέσει/επεξεργαστεί/τερματίσει σύμβαση
   - Αν προσθέσει εδώ → αυτόματα διαθέσιμος στα Νομικά (SellDialog dropdown)

2. **Unit → Legal Tab → SellDialog** — Quick-add κατά την πώληση
   - Dropdown: λίστα μεσιτών από τις ενεργές συμβάσεις
   - "+ Νέος μεσίτης": quick-add on-the-fly (δημιουργεί σύμβαση + ανεβάζει χαρτί)
   - Αν προσθέσει εδώ → αυτόματα εμφανίζεται στο Project → tab "Μεσίτες"

**Αρχή**: Δεν πειράζει από πού ξεκινάει ο χρήστης — τα δεδομένα ζουν στο ίδιο collection (brokerage_agreements) και εμφανίζονται παντού.

### Ορατότητα Tab "Μεσίτες" (Google Progressive Disclosure — 2026-03-15)
**ΚΑΝΟΝΑΣ**: Το tab "Μεσίτες" εμφανίζεται ΜΟΝΟ σε sales projects (projects με units προς πώληση).
- Project χωρίς units → ΔΕΝ εμφανίζεται
- Project ανακαίνισης/εργολαβίας χωρίς πωλήσεις → ΔΕΝ εμφανίζεται
- Project κατασκευαστικό με units → ΕΜΦΑΝΙΖΕΤΑΙ
- **Rationale**: Google progressive disclosure — λειτουργίες εμφανίζονται μόνο όταν έχουν νόημα

### Επαφή Μεσίτη — Contacts + Quick-Create (2026-03-15)
**ΚΑΝΟΝΑΣ**: Ο μεσίτης ΠΡΕΠΕΙ να είναι Contact (persona: real_estate_agent), ΑΛΛΑ:
- Αν δεν υπάρχει στις Επαφές → quick-create inline (όνομα + τηλέφωνο + email)
- Το quick-create δημιουργεί Contact + ενεργοποιεί persona `real_estate_agent` αυτόματα
- Χρησιμοποιεί τον υπάρχοντα `ContactSearchManager` (centralized) — no duplicate code
- **Single Source of Truth**: Ο μεσίτης ζει ΜΟΝΟ στο contacts collection

### Λήξη Σύμβασης — Auto-Expire Client-Side (2026-03-15)
**ΚΑΝΟΝΑΣ**: Αν `endDate < now` → η σύμβαση θεωρείται **expired**:
- Client-side check (χωρίς cron/scheduled jobs)
- ΔΕΝ εμφανίζεται στο SellDialog dropdown (ληγμένη σύμβαση = μη ενεργή)
- Εμφανίζεται στο Project → tab "Μεσίτες" με badge "Ληγμένη" (ιστορικό)
- Ο χρήστης μπορεί να την **ανανεώσει** (νέα endDate) → γίνεται πάλι active
- `endDate = null` → αόριστη διάρκεια (δεν λήγει ποτέ, τερματίζεται μόνο χειροκίνητα)
- **Rationale**: Αρχή ελάχιστης έκπληξης — ληγμένη σύμβαση ΔΕΝ πρέπει να είναι επιλέξιμη σε πώληση

### Έγγραφο Σύμβασης — FileRecord (domain: 'brokerage') (2026-03-15)
**ΚΑΝΟΝΑΣ**: Το φυσικό χαρτί/PDF αποθηκεύεται μέσω του κεντρικοποιημένου FileRecord system (ADR-191):
- Domain: `'brokerage'`
- Linked entity: `brokerageAgreementId`
- Auto-naming: κεντρικοποιημένο σύστημα ονοματοδοσίας (ADR-191)
- Upload: optional στη φόρμα δημιουργίας σύμβασης (+ μετέπειτα από τη λίστα)
- Zero νέος κώδικας file management — χρησιμοποιεί υπάρχουσα υποδομή

### Commission UI — Αργότερα (Google 80/20 Rule — 2026-03-15)
**ΑΠΟΦΑΣΗ**: Τα CommissionRecord ΗΔΗ αποθηκεύονται στο Firestore κατά την πώληση (SellDialog).
- **Τώρα**: Εστίαση στη διαχείριση συμβάσεων (CRUD + Project tab + quick-add)
- **Αργότερα**: Commission tracking UI (ποσά, payment status, reports ανά μεσίτη)
- **Rationale**: Ship the core, iterate fast. Τα δεδομένα δεν χάνονται — δεν υπάρχει urgency για UI

### Τρόποι Αμοιβής
| Τρόπος | Τυπικό ποσοστό | Παράδειγμα |
|--------|---------------|-----------|
| **Ποσοστό (percentage)** | 2-3% επί πώλησης | €200K × 2% = €4,000 |
| **Σταθερό (fixed)** | Προκαθορισμένο ποσό | €5,000 flat |

### Business Rules
1. Αποκλειστικότητα σε project-level = αποκλειστικότητα σε ΟΛΑ τα units αυτού του project
2. Αποκλειστικότητα σε unit-level = μόνο για τη συγκεκριμένη μονάδα
4. Χωρίς αποκλειστικότητα → πολλοί μεσίτες στο ίδιο scope (project/building/unit)
5. Η αμοιβή καταγράφεται κατά τη στιγμή ολοκλήρωσης πώλησης (fire-and-forget)
6. **Στα Νομικά (Legal Tab) εμφανίζεται ΜΟΝΟ ο μεσίτης που έφερε τον αγοραστή** — dropdown επιλογή κατά την κράτηση/πώληση
7. **Κεντρικό σημείο εγγραφής**: Πρέπει να υπάρχει ΕΝΑ σημείο όπου καταγράφονται ΟΛΕΣ οι μεσιτικές συμβάσεις (απλές + αποκλειστικές) ΠΡΙΝ γίνει οποιαδήποτε πώληση

---

## 3. Task A: Types — Brokerage & Commission

### Target File
`src/types/brokerage.ts` (νέο αρχείο)

### Type Definitions
```typescript
import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// BROKERAGE AGREEMENT
// ============================================================================

/** Τύπος αποκλειστικότητας */
export type ExclusivityType = 'exclusive' | 'non_exclusive';

/** Scope αποκλειστικότητας */
export type ExclusivityScope = 'project' | 'unit';

/** Τρόπος υπολογισμού αμοιβής */
export type CommissionType = 'percentage' | 'fixed';

/** Κατάσταση μεσιτικής σύμβασης */
export type BrokerageStatus = 'active' | 'expired' | 'terminated';

/**
 * Μεσιτική Σύμβαση — Brokerage Agreement
 *
 * Αντιπροσωπεύει τη συμφωνία μεταξύ κατασκευαστή και μεσίτη
 * για πώληση ακινήτων.
 */
export interface BrokerageAgreement {
  id: string;

  /** Contact ID του μεσίτη (persona: real_estate_agent) */
  agentContactId: string;

  /** Display name (denormalized for fast rendering) */
  agentName: string;

  /** Μεσιτικό γραφείο (denormalized) */
  agentAgency: string | null;

  // --- Scope ---

  /** Scope: αφορά project ή μεμονωμένο unit */
  scope: ExclusivityScope;

  /** Project ID (πάντα παρόν) */
  projectId: string;

  /** Unit ID (μόνο αν scope === 'unit') */
  unitId: string | null;

  /** Project name (denormalized) */
  projectName: string;

  /** Unit name (denormalized, μόνο αν scope === 'unit') */
  unitName: string | null;

  // --- Αποκλειστικότητα ---

  /** Τύπος αποκλειστικότητας */
  exclusivity: ExclusivityType;

  // --- Όροι αμοιβής ---

  /** Τρόπος υπολογισμού αμοιβής */
  commissionType: CommissionType;

  /**
   * Ποσοστό αμοιβής (0-100, π.χ. 2.5 = 2.5%)
   * Χρησιμοποιείται μόνο αν commissionType === 'percentage'
   */
  commissionPercentage: number | null;

  /**
   * Σταθερό ποσό αμοιβής (€)
   * Χρησιμοποιείται μόνο αν commissionType === 'fixed'
   */
  commissionFixedAmount: number | null;

  // --- Διάρκεια ---

  /** Ημερομηνία έναρξης */
  startDate: Timestamp;

  /** Ημερομηνία λήξης (null = αόριστη) */
  endDate: Timestamp | null;

  // --- Κατάσταση ---

  status: BrokerageStatus;

  /** Λόγος τερματισμού (αν terminated) */
  terminationReason: string | null;

  /** Σημειώσεις */
  notes: string | null;

  // --- Audit ---

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// COMMISSION RECORD
// ============================================================================

/** Κατάσταση πληρωμής προμήθειας */
export type CommissionPaymentStatus = 'pending' | 'paid' | 'cancelled';

/**
 * Εγγραφή Προμήθειας — Commission Record
 *
 * Καταγράφεται αυτόματα (fire-and-forget) κατά την ολοκλήρωση πώλησης.
 * Αναφέρεται σε ένα brokerage agreement + μία πώληση unit.
 */
export interface CommissionRecord {
  id: string;

  /** Reference to BrokerageAgreement */
  brokerageAgreementId: string;

  /** Contact ID μεσίτη */
  agentContactId: string;

  /** Display name (denormalized) */
  agentName: string;

  // --- Transaction context ---

  /** Unit ID που πουλήθηκε */
  unitId: string;

  /** Unit name (denormalized) */
  unitName: string;

  /** Project ID */
  projectId: string;

  /** Buyer contact ID */
  buyerContactId: string;

  /** Buyer name (denormalized) */
  buyerName: string;

  // --- Ποσά ---

  /** Τιμή πώλησης του unit */
  salePrice: number;

  /** Τρόπος υπολογισμού (snapshot από agreement) */
  commissionType: CommissionType;

  /** Ποσοστό (snapshot) */
  commissionPercentage: number | null;

  /** Υπολογισμένο ποσό αμοιβής */
  commissionAmount: number;

  /** Νόμισμα */
  currency: 'EUR';

  // --- Κατάσταση πληρωμής ---

  paymentStatus: CommissionPaymentStatus;

  /** Ημερομηνία πληρωμής */
  paidAt: Timestamp | null;

  /** Σημειώσεις πληρωμής */
  paymentNotes: string | null;

  // --- Audit ---

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// COMMISSION CALCULATION
// ============================================================================

/**
 * Input για υπολογισμό αμοιβής
 */
export interface CommissionCalculationInput {
  commissionType: CommissionType;
  commissionPercentage: number | null;
  commissionFixedAmount: number | null;
  salePrice: number;
}

/**
 * Υπολογίζει το ποσό αμοιβής βάσει agreement terms.
 * Pure function — no side effects.
 */
export function calculateCommission(input: CommissionCalculationInput): number {
  if (input.commissionType === 'percentage' && input.commissionPercentage !== null) {
    return Math.round(input.salePrice * (input.commissionPercentage / 100) * 100) / 100;
  }
  if (input.commissionType === 'fixed' && input.commissionFixedAmount !== null) {
    return input.commissionFixedAmount;
  }
  return 0;
}
```

---

## 4. Task B: Register Firestore Collections

### Target File
`src/config/firestore-collections.ts`

### Changes
Στο `COLLECTIONS` object, μετά τα BOQ entries (γραμμή ~241), πρόσθεσε:

```typescript
// 🏠 BROKERAGE & COMMISSIONS (ADR-230: Contract Workflow — Legal Process)
BROKERAGE_AGREEMENTS: process.env.NEXT_PUBLIC_BROKERAGE_AGREEMENTS_COLLECTION || 'brokerage_agreements',
COMMISSION_RECORDS: process.env.NEXT_PUBLIC_COMMISSION_RECORDS_COLLECTION || 'commission_records',
```

### Rationale: Separate Collections (not Embedded)
| Approach | Πλεονεκτήματα | Μειονεκτήματα |
|----------|---------------|---------------|
| Embedded in unit | Γρήγορο read | Δεν μπορείς να query across units/projects |
| Embedded in project | Εύκολο per-project | Δεν μπορείς να δεις τις συμφωνίες ενός μεσίτη |
| **Separate collection (επιλέχθηκε)** | Query by agent, by project, by unit | Extra read |

Αποφασιστικός λόγος: "Δείξε μου ΟΛΕΣ τις μεσιτικές συμφωνίες του μεσίτη Χ" — αυτό απαιτεί separate collection.

---

## 5. Task C: BrokerageService

### Target File
`src/services/brokerage.service.ts` (νέο αρχείο)

### API Surface
```typescript
export class BrokerageService {
  // --- CRUD ---

  /** Δημιουργία μεσιτικής σύμβασης */
  static async createAgreement(input: CreateBrokerageInput): Promise<BrokerageAgreement>

  /** Ενημέρωση σύμβασης */
  static async updateAgreement(id: string, updates: Partial<BrokerageAgreement>, updatedBy: string): Promise<void>

  /** Τερματισμός σύμβασης */
  static async terminateAgreement(id: string, reason: string, updatedBy: string): Promise<void>

  /** Λήψη σύμβασης */
  static async getAgreement(id: string): Promise<BrokerageAgreement | null>

  // --- QUERIES ---

  /** Όλες οι ενεργές συμβάσεις ενός project */
  static async getAgreementsForProject(projectId: string): Promise<BrokerageAgreement[]>

  /** Όλες οι ενεργές συμβάσεις ενός unit (project-level + unit-level) */
  static async getAgreementsForUnit(projectId: string, unitId: string): Promise<BrokerageAgreement[]>

  /** Όλες οι συμβάσεις ενός μεσίτη */
  static async getAgreementsForAgent(agentContactId: string): Promise<BrokerageAgreement[]>

  // --- VALIDATION ---

  /**
   * Ελέγχει αν υπάρχει ήδη exclusive agreement στο ίδιο scope.
   * Returns: { valid: true } ή { valid: false, reason: string }
   */
  static async validateExclusivity(input: ExclusivityValidationInput): Promise<ExclusivityValidationResult>

  // --- COMMISSION ---

  /**
   * Καταγραφή αμοιβής κατά την ολοκλήρωση πώλησης.
   * Fire-and-forget: δεν μπλοκάρει τη ροή πώλησης.
   */
  static async recordCommission(input: RecordCommissionInput): Promise<CommissionRecord>

  /** Ανάκτηση commission records για ένα unit */
  static async getCommissionsForUnit(unitId: string): Promise<CommissionRecord[]>

  /** Ενημέρωση payment status */
  static async updateCommissionPayment(
    id: string,
    status: CommissionPaymentStatus,
    updatedBy: string,
    paymentNotes?: string
  ): Promise<void>
}
```

### Exclusivity Validation Logic
```
Rule 1: Αν ο νέος μεσίτης θέλει EXCLUSIVE σε PROJECT:
  → Δεν πρέπει να υπάρχει ΑΛΛΟΣ EXCLUSIVE μεσίτης (project ή unit scope) στο ίδιο project

Rule 2: Αν ο νέος μεσίτης θέλει EXCLUSIVE σε UNIT:
  → Δεν πρέπει να υπάρχει EXCLUSIVE project-level agreement
  → Δεν πρέπει να υπάρχει ΑΛΛΟΣ EXCLUSIVE unit-level στο ίδιο unit

Rule 3: NON_EXCLUSIVE → πάντα OK (δεν conflict-άρει)
```

### Integration Point: SellDialog

**ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ**: Πληρώνεται ΜΟΝΟ ο μεσίτης που έφερε τον αγοραστή.
Οι υπόλοιποι μεσίτες (non-exclusive) ΔΕΝ πληρώνονται.

Η καταγραφή αμοιβής **ΔΕΝ είναι αυτόματη** (fire-and-forget). Αντ' αυτού:

1. Κατά την πώληση (SellDialog), ο χρήστης **επιλέγει** ποιος μεσίτης έφερε τον αγοραστή
2. Commission record δημιουργείται **ΜΟΝΟ** για τον επιλεγμένο μεσίτη
3. Αν δεν υπάρχει μεσίτης ή κανείς δεν επιλεγεί → δεν δημιουργείται commission

```typescript
// Στο SellDialog: ο χρήστης επιλέγει μεσίτη (optional dropdown)
// Αν επιλεγεί μεσίτης:
if (selectedBrokerageAgreementId) {
  const agreement = await BrokerageService.getAgreement(selectedBrokerageAgreementId);
  if (agreement) {
    BrokerageService.recordCommission({
      brokerageAgreementId: agreement.id,
      agentContactId: agreement.agentContactId,
      agentName: agreement.agentName,
      unitId,
      unitName,
      projectId,
      buyerContactId,
      buyerName,
      salePrice,
      commissionType: agreement.commissionType,
      commissionPercentage: agreement.commissionPercentage,
      commissionFixedAmount: agreement.commissionFixedAmount,
    }).catch(err => logger.error('Commission recording failed:', err));
  }
}
```

### SellDialog UI Addition
Προσθήκη **optional dropdown** στο SellDialog:
- Label: "Μεσίτης που έφερε τον αγοραστή" (optional)
- Options: Ενεργοί μεσίτες (agreements) για αυτό το unit/project
- Default: κενό (κανένας)
- Αν exclusive → pre-selected αυτόματα

---

## 6. Task D: Integration — SellDialog Broker Selection

### Target File
`src/components/sales/dialogs/SalesActionDialogs.tsx` (SellDialog section)

### Change
Προσθήκη **optional broker dropdown** στο SellDialog:
1. Fetch ενεργές μεσιτικές συμβάσεις για το unit/project
2. Αν υπάρχουν → εμφανίζεται dropdown "Μεσίτης που έφερε τον αγοραστή"
3. Αν exclusive → pre-selected
4. Αν δεν υπάρχουν → δεν εμφανίζεται
5. Μετά το successful sale → record commission ΜΟΝΟ για τον επιλεγμένο μεσίτη

---

## 7. Task E: BrokerageCard Component

### Target File
`src/components/sales/brokerage/BrokerageCard.tsx` (νέο αρχείο)

### Description
Compact card component that shows:
- Agent name + agency
- Exclusivity badge (exclusive/non-exclusive)
- Commission terms (π.χ. "2.5% επί πώλησης" ή "€5,000 flat")
- Agreement status
- Actions: Edit, Terminate

### Usage
Θα ενσωματωθεί στο `LegalTabContent` (SPEC-230D) και στο project-level brokerage panel (μελλοντικό).

---

## 8. Task F: i18n Keys

### Keys to Add
```json
{
  "brokerage": {
    "title": "Μεσιτικές Συμβάσεις",
    "agreement": "Μεσιτική Σύμβαση",
    "addAgreement": "Προσθήκη Μεσίτη",
    "exclusive": "Αποκλειστική",
    "nonExclusive": "Απλή",
    "scopeProject": "Σε επίπεδο Έργου",
    "scopeUnit": "Σε επίπεδο Μονάδας",
    "commissionPercentage": "Ποσοστό",
    "commissionFixed": "Σταθερό Ποσό",
    "commissionAmount": "Ποσό Αμοιβής",
    "status": {
      "active": "Ενεργή",
      "expired": "Ληγμένη",
      "terminated": "Τερματισμένη"
    },
    "payment": {
      "pending": "Αναμονή Πληρωμής",
      "paid": "Πληρώθηκε",
      "cancelled": "Ακυρώθηκε"
    },
    "terminateAgreement": "Τερματισμός Σύμβασης",
    "terminationReason": "Λόγος Τερματισμού"
  }
}
```

---

## 9. Files Summary

| Action | File | What |
|--------|------|------|
| **CREATE** | `src/types/brokerage.ts` | BrokerageAgreement + CommissionRecord + CommissionTerms types |
| **MODIFY** | `src/config/firestore-collections.ts` | +BROKERAGE_AGREEMENTS, +COMMISSION_RECORDS |
| **CREATE** | `src/services/brokerage.service.ts` | BrokerageService (CRUD + validation + commission) |
| **MODIFY** | `src/components/sales/dialogs/SalesActionDialogs.tsx` | Fire-and-forget commission recording in SellDialog |
| **CREATE** | `src/components/sales/brokerage/BrokerageCard.tsx` | BrokerageCard UI component |
| **MODIFY** | `src/i18n/locales/el/common.json` | +brokerage section |
| **MODIFY** | `src/i18n/locales/en/common.json` | +brokerage section |

---

## 10. Verification Criteria

1. `npx tsc --noEmit` — zero errors σε αλλαγμένα αρχεία
2. `BrokerageAgreement` type — no `any`, proper discriminated commission types
3. `calculateCommission()` — correct for percentage and fixed cases
4. Exclusivity validation blocks conflicting agreements
5. Commission auto-recorded on sale completion (fire-and-forget)
6. `CommissionRecord` includes snapshot of agreement terms at time of sale
7. i18n keys resolve in both EL and EN

---

*SPEC Format: Google Engineering Design Docs standard*
