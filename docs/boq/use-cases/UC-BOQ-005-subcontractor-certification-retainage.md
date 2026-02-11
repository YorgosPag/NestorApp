# UC-BOQ-005: Subcontractor + Certification + Retainage

**Parent ADR:** ADR-175 — Σύστημα Επιμετρήσεων (Quantity Surveying / BOQ)
**Phase:** D (Project Controls)
**Status:** Draft — Implementation Contract
**Date:** 2026-02-11
**Depends on:** UC-BOQ-001, UC-BOQ-002, UC-BOQ-003
**Blocks:** —

---

## 1. Σκοπός

Πλήρης lifecycle υπεργολάβων: **Σύμβαση → SOV → Πιστοποίηση → Πληρωμή → Κρατήσεις → Τελική Εκκαθάριση**. Compliance με **Ν.4412/2016** (άρθρα 151-154, 165). Layer πάνω σε υπάρχον CRM contacts χωρίς αλλαγή στη δομή επαφών.

Πρότυπο: Procore, Oracle Primavera Unifier, Buildertrend.

---

## 2. Actors

| Actor | Ρόλος | Ενέργειες |
|-------|-------|-----------|
| **Project Manager** | Κύριος | Δημιουργία contracts, approve certifications |
| **Μηχανικός** | Πιστοποιητής | Πιστοποίηση ποσοτήτων (certified quantities) |
| **Λογιστήριο** | Finance | Payment applications, retainage release |
| **Υπεργολάβος** | External | Submit progress claims (future — self-service portal) |

---

## 3. Preconditions

1. UC-BOQ-001: BOQ items υπάρχουν
2. UC-BOQ-002: Τιμές resolved
3. CRM contacts: Υπεργολάβος υπάρχει ως contact (φυσικό ή νομικό πρόσωπο)
4. UC-BOQ-003: Gantt linking (optional αλλά recommended)

---

## 4. Data Model

### 4.1 Contractor Profile (LAYER πάνω σε Contact — ΔΕΝ αλλάζει contacts)

```typescript
interface ContractorProfile {
  id: string;
  contactId: string;              // FK → contacts (ΥΠΑΡΧΟΥΣΑ ΔΟΜΗ — αμετάβλητη)
  companyId: string;
  specialty: ContractorSpecialty[];
  rating: number | null;           // 1-5 (αξιολόγηση)
  yearsOfExperience: number | null;
  certifications: string[];        // Πιστοποιήσεις (π.χ. ISO 9001)
  insuranceExpiryDate: string | null;
  taxComplianceDate: string | null;  // Τελευταία φορολογική ενημερότητα
  socialSecurityComplianceDate: string | null; // Ασφαλιστική ενημερότητα
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

type ContractorSpecialty =
  | 'general'         // Γενικός εργολάβος
  | 'concrete'        // Σκυροδέματα
  | 'masonry'         // Τοιχοποιίες
  | 'plaster'         // Σοβάδες
  | 'tiler'           // Πλακάς
  | 'painter'         // Ελαιοχρωματιστής
  | 'plumber'         // Υδραυλικός
  | 'electrician'     // Ηλεκτρολόγος
  | 'carpenter'       // Ξυλουργός
  | 'metalworker'     // Σιδηρουργός
  | 'insulation'      // Μονώσεις
  | 'excavation'      // Χωματουργός
  | 'elevator'        // Ανελκυστήρας
  | 'hvac'            // Κλιματισμός/Θέρμανση
  | 'landscaping'     // Περιβάλλων χώρος
  | 'demolition';     // Κατεδαφίσεις
```

### 4.2 Contract / Commitment

```typescript
interface BOQContract {
  id: string;
  companyId: string;
  projectId: string;
  buildingId: string;
  contractorProfileId: string;        // FK → contractor_profiles
  contractType: ContractType;
  title: string;                      // "Σύμβαση σοβάδων Κτιρίου Α"
  description: string | null;

  // Financial
  contractValue: number;              // Αρχική αξία σύμβασης
  retainagePct: number;               // Ποσοστό κράτησης εγγύησης (π.χ. 5%)
  advancePaymentPct: number;          // Ποσοστό προκαταβολής (π.χ. 10%)
  guaranteePeriodMonths: number;      // Περίοδος εγγύησης (π.χ. 24 μήνες)

  // Dates
  startDate: string;
  expectedEndDate: string;
  actualEndDate: string | null;

  // Status
  status: ContractStatus;

  // Links
  linkedPhaseIds: string[];           // Φάσεις Gantt που καλύπτει
  linkedBoqItemIds: string[];         // BOQ items σε αυτή τη σύμβαση (SOV)

  // Approvals
  approvedBy: string | null;
  approvedAt: string | null;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

type ContractType =
  | 'lump_sum'         // Κατ' αποκοπή
  | 'unit_price'       // Τιμή μονάδας
  | 'cost_plus'        // Κόστος + ποσοστό
  | 'remeasurable';    // Αναμετρούμενη (ελληνική πρακτική — Ν.4412)

type ContractStatus =
  | 'draft'            // Πρόχειρη
  | 'pending_approval' // Αναμένει έγκριση
  | 'active'           // Ενεργή
  | 'completed'        // Ολοκληρωμένη
  | 'terminated'       // Διακοπή
  | 'disputed';        // Σε αμφισβήτηση
```

### 4.3 SOV Line (Schedule of Values)

```typescript
interface BOQSovLine {
  id: string;
  contractId: string;              // FK → boq_contracts
  boqItemId: string;               // FK → boq_items
  description: string;             // Inherited ή override
  contractedQuantity: number;      // Ποσότητα σύμβασης
  unitPrice: number;               // Τιμή μονάδας σύμβασης
  lineTotal: number;               // contracted × unitPrice
  certifiedToDate: number;         // Πιστοποιημένη ποσότητα μέχρι σήμερα
  remainingQuantity: number;       // contracted − certified
  percentComplete: number;         // certified / contracted × 100
  sortOrder: number;
}
```

### 4.4 Payment Application (Λογαριασμός Εργολάβου)

```typescript
interface BOQPaymentApplication {
  id: string;
  contractId: string;              // FK → boq_contracts
  applicationNumber: number;       // 1ος, 2ος, 3ος... λογαριασμός
  periodStart: string;             // Περίοδος αναφοράς
  periodEnd: string;
  status: PaymentApplicationStatus;

  // Amounts
  grossAmount: number;             // Σύνολο πιστοποίησης
  previousCertified: number;       // Ήδη πιστοποιημένα (σωρευτικά)
  currentCertified: number;        // Τρέχουσα πιστοποίηση
  retainageAmount: number;         // Κράτηση εγγύησης
  advanceDeduction: number;        // Αφαίρεση προκαταβολής
  netPayable: number;              // Πληρωτέο ποσό

  // Certification
  certifiedBy: string | null;
  certifiedAt: string | null;

  // Payment
  paidAmount: number | null;
  paidAt: string | null;
  invoiceRef: string | null;       // Αριθμός τιμολογίου

  // Lines (detail per SOV line)
  lines: PaymentApplicationLine[];

  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface PaymentApplicationLine {
  sovLineId: string;
  previousQuantity: number;        // Ποσότητα προηγούμενων λογαριασμών
  currentQuantity: number;         // Ποσότητα τρέχοντος λογαριασμού
  cumulativeQuantity: number;      // Σωρευτική πιστοποίηση
  lineAmount: number;              // currentQuantity × unitPrice
}

type PaymentApplicationStatus =
  | 'draft'
  | 'submitted'                    // Υπεργολάβος υπέβαλε
  | 'under_review'                 // Μηχανικός ελέγχει
  | 'certified'                    // Μηχανικός πιστοποίησε
  | 'approved'                     // PM εγκρίνει πληρωμή
  | 'paid'                         // Πληρώθηκε
  | 'disputed';                    // Σε αμφισβήτηση
```

### 4.5 Retainage Ledger (Κρατήσεις Εγγύησης)

```typescript
interface BOQRetainageEntry {
  id: string;
  contractId: string;
  paymentApplicationId: string;
  type: 'withheld' | 'released';
  amount: number;
  reason: string | null;           // "Τελική αποπληρωμή", "Λήξη εγγύησης"
  releaseDate: string | null;      // Ημερομηνία αποδέσμευσης
  approvedBy: string | null;
  createdAt: string;
}
```

### 4.6 Change Order (Εντολή Αλλαγής)

```typescript
interface BOQChangeOrder {
  id: string;
  contractId: string | null;       // Αν αφορά σύμβαση
  buildingId: string;
  changeType: 'scope' | 'rate' | 'schedule' | 'mixed';
  title: string;
  description: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';

  // Impact
  affectedItemIds: string[];       // BOQ items που αλλάζουν
  deltaCost: number;               // Αλλαγή κόστους (+/-)
  deltaDuration: number | null;    // Αλλαγή χρόνου (ημέρες)

  // Approval
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
```

---

## 5. Happy Path

### 5.1 Flow: Δημιουργία Contractor Profile

```
1. CRM → Contact "Παπαδόπουλος Νίκος" (φυσικό πρόσωπο — ΗΔΗ ΥΠΑΡΧΕΙ)
2. Click "Δημιουργία Προφίλ Υπεργολάβου"
3. Modal:
   • Specialty: [Πλακάς ✓] [Υδραυλικός ✓]
   • Rating: ⭐⭐⭐⭐ (4/5)
   • Πιστοποιήσεις: "ISO 9001, ΕΜΠΕ"
   • Φορολογική ενημερότητα: [2026-06-30]
   • Ασφαλιστική ενημερότητα: [2026-06-30]
4. Αποθήκευση → contractor_profiles + badge στο contact card
5. Contact ΔΕΝ αλλάζει — μόνο νέο profile linked
```

### 5.2 Flow: Δημιουργία Σύμβασης

```
1. Building → Tab "Υπεργολαβίες" (ή μέσα στο Επιμετρήσεις)
2. Click "+ Νέα Σύμβαση"
3. Φόρμα:
   • Υπεργολάβος: [Dropdown → contacts with contractor profile]
   • Τύπος: [Τιμή μονάδας ▼]
   • Αξία: [35.000€]
   • Κράτηση εγγύησης: [5%]
   • Ημερομηνίες: [01/03/2026 → 30/05/2026]
   • Φάσεις Gantt: [PH-004: Σοβάδες ✓, PH-005: Επιχρίσματα ✓]
4. SOV setup:
   • Αυτόματη φόρτωση linked BOQ items
   • Χρήστης ρυθμίζει ποσότητες/τιμές σύμβασης
5. Αποθήκευση → status = 'draft'
6. Αποστολή για έγκριση → status = 'pending_approval'
7. PM εγκρίνει → status = 'active'
```

### 5.3 Flow: Πιστοποίηση (Λογαριασμός Εργολάβου)

```
1. Μηχανικός → Σύμβαση → Tab "Λογαριασμοί"
2. Click "+ Νέος Λογαριασμός"
3. Σύστημα δημιουργεί:
   • applicationNumber = next (π.χ. 2ος λογαριασμός)
   • Φορτώνει SOV lines + previous certifications
4. Μηχανικός συμπληρώνει currentQuantity ανά γραμμή:
   ┌───────────────────────┬─────┬──────┬──────┬──────┬───────┐
   │ Περιγραφή             │ Μον.│Σύμβ. │Προηγ.│Τρέχ. │Σωρ.   │
   ├───────────────────────┼─────┼──────┼──────┼──────┼───────┤
   │ Σοβάς εσωτ. τοίχων   │ m²  │ 450  │ 200  │ 120  │ 320   │
   │ Σοβάς εσωτ. οροφών   │ m²  │ 120  │  60  │  40  │ 100   │
   │ Γωνιόκρανα            │ m   │  85  │  40  │  30  │  70   │
   └───────────────────────┴─────┴──────┴──────┴──────┴───────┘
5. Auto-computation:
   • grossAmount = Σ(currentQty × unitPrice)
   • retainageAmount = grossAmount × retainagePct
   • advanceDeduction = (proportional advance recovery)
   • netPayable = grossAmount − retainage − advanceDeduction
6. Click "Πιστοποίηση" → certifiedBy, certifiedAt
7. PM Click "Έγκριση Πληρωμής" → status = 'approved'
8. Λογιστήριο → "Πληρώθηκε" → paidAmount, paidAt, invoiceRef
```

### 5.4 Flow: Change Order

```
1. Χρήστης → Building → "Εντολές Αλλαγής" (ή μέσα σε Contract)
2. Click "+ Νέα Εντολή Αλλαγής"
3. Φόρμα:
   • Τύπος: [Αλλαγή Scope ▼]
   • Τίτλο: "Επιπλέον σοβάδες αποθήκης"
   • Επηρεαζόμενα items: [select BOQ items]
   • Αλλαγή κόστους: +2.400€
   • Αλλαγή χρόνου: +3 ημέρες
4. Υποβολή → status = 'submitted'
5. PM εγκρίνει → status = 'approved'
6. Σύστημα:
   • Νέα BOQ items: isOriginalBudget = false, changeOrderId = CO id
   • Budget updated: original + change order = revised budget
   • Baseline version bumped
```

### 5.5 Flow: Retainage Release

```
1. Σύμβαση completed + guarantee period expired
2. Λογιστήριο → Contract → Tab "Κρατήσεις"
3. Βλέπει: withheld entries (5% κάθε λογαριασμού)
4. Click "Αποδέσμευση Κράτησης"
5. Confirmation: "Αποδέσμευση 1.750€ κράτησης εγγύησης;"
6. Approve → released entry created
7. Τελική πληρωμή → contract status = 'completed'
```

### 5.6 Σύνδεση με Milestones (από UC-BOQ-003 §4.1.4)

Τα financial milestones `certification_cutoff`, `invoice_approved`, `retainage_release` συνδέονται αυτόματα:

```
1. Πιστοποίηση λογαριασμού → milestone 'certification_cutoff' = reached
2. Έγκριση τιμολογίου → milestone 'invoice_approved' = reached
3. Αποδέσμευση κράτησης → milestone 'retainage_release' = reached
4. Milestones εμφανίζονται στο Gantt timeline (UC-BOQ-003)
```

Αυτό δίνει **ενοποιημένη εικόνα** μεταξύ Gantt, BOQ, και πληρωμών — δεν χρειάζεται ο PM να ελέγχει ξεχωριστά κάθε σύστημα.

---

## 6. Edge Cases

| # | Σενάριο | Συμπεριφορά |
|---|---------|-------------|
| 1 | Contact χωρίς contractor profile | Δεν εμφανίζεται σε contract dropdown |
| 2 | Σύμβαση υπερβαίνει BOQ budget | Warning: "Σύμβαση > budget κατά 12%" |
| 3 | Πιστοποίηση > contracted quantity | Block: "Δεν μπορεί να πιστοποιηθεί > 100%" |
| 4 | Υπεργολάβος: expired φορολογική | Warning badge στο contract + block payment |
| 5 | Contract terminated mid-project | Final account: πιστοποιημένα μέχρι σήμερα + retainage handling |
| 6 | Disputed payment | status = 'disputed', freeze payments, audit trail |
| 7 | Multiple contractors same phase | Allowed — Σ contract values compared to phase budget |
| 8 | Retainage release before warranty expiry | Block + warning: "Εγγύηση λήγει σε X μήνες" |
| 9 | Change order rejected | BOQ items NOT modified, status = 'rejected' |
| 10 | Zero retainage contract | retainagePct = 0, no retainage entries created |

---

## 7. UI Components

### 7.1 Contractor Profile (στο Contact)

```
<ContractorProfileCard contactId={contactId}>
  <SpecialtyBadges specialties={...} />
  <RatingStars rating={4} />
  <ComplianceStatus tax={...} insurance={...} />
  <ContractHistory contracts={...} />
</ContractorProfileCard>
```

### 7.2 Contract Management

```
<ContractListPage buildingId={buildingId}>
  <ContractCard contract={contract}>
    <ContractHeader title={...} contractor={...} status={...} />
    <ContractFinancials value={...} certified={...} remaining={...} />
    <ProgressBar percent={certifiedPct} />
  </ContractCard>
</ContractListPage>
```

### 7.3 Payment Application (Λογαριασμός)

```
<PaymentApplicationForm contract={contract} previousApps={...}>
  <SOVTable lines={sovLines} onQuantityChange={...} />
  <PaymentSummary gross={...} retainage={...} advance={...} net={...} />
  <ApprovalActions onCertify={...} onApprove={...} onPay={...} />
</PaymentApplicationForm>
```

### 7.4 Change Order

```
<ChangeOrderForm buildingId={buildingId}>
  <ChangeTypeSelector type={...} />
  <AffectedItemsSelector items={boqItems} />
  <ImpactSummary deltaCost={...} deltaDuration={...} />
  <ApprovalActions onSubmit={...} onApprove={...} />
</ChangeOrderForm>
```

---

## 8. Service Operations

```typescript
interface SubcontractorService {
  // Contractor Profiles
  createProfile(contactId: string, data: CreateContractorInput): Promise<ContractorProfile>;
  updateProfile(profileId: string, data: Partial<ContractorProfile>): Promise<void>;
  getProfileByContact(contactId: string): Promise<ContractorProfile | null>;
  getContractorsBySpecialty(specialty: ContractorSpecialty): Promise<ContractorProfile[]>;

  // Contracts
  createContract(data: CreateContractInput): Promise<BOQContract>;
  updateContract(id: string, data: Partial<BOQContract>): Promise<void>;
  approveContract(id: string, approvedBy: string): Promise<void>;
  terminateContract(id: string, reason: string): Promise<void>;
  getContractsByBuilding(buildingId: string): Promise<BOQContract[]>;

  // SOV
  generateSOVFromBOQ(contractId: string, boqItemIds: string[]): Promise<BOQSovLine[]>;
  updateSOVLine(lineId: string, data: Partial<BOQSovLine>): Promise<void>;

  // Payment Applications
  createPaymentApplication(contractId: string): Promise<BOQPaymentApplication>;
  certifyApplication(appId: string, certifiedBy: string): Promise<void>;
  approvePayment(appId: string, approvedBy: string): Promise<void>;
  recordPayment(appId: string, amount: number, invoiceRef: string): Promise<void>;

  // Retainage
  getRetainageLedger(contractId: string): Promise<BOQRetainageEntry[]>;
  releaseRetainage(contractId: string, amount: number, reason: string): Promise<void>;

  // Change Orders
  createChangeOrder(data: CreateChangeOrderInput): Promise<BOQChangeOrder>;
  approveChangeOrder(id: string, approvedBy: string): Promise<void>;
  rejectChangeOrder(id: string, reason: string): Promise<void>;
  applyChangeOrder(id: string): Promise<void>;  // Creates/modifies BOQ items
}
```

---

## 9. Firestore

### 9.1 Collections (νέα)

```
contractor_profiles            # Layer πάνω σε contacts
boq_contracts                  # Συμβάσεις υπεργολάβων
boq_sov_lines                  # Schedule of Values (sub-collection of contracts, ή flat)
boq_payment_applications       # Λογαριασμοί εργολάβων
boq_retainage_ledger           # Κρατήσεις εγγύησης
boq_change_orders              # Εντολές αλλαγής
```

### 9.2 Composite Indexes

```
contractor_profiles: companyId ASC, active ASC
boq_contracts: buildingId ASC, status ASC
boq_contracts: contractorProfileId ASC, status ASC
boq_payment_applications: contractId ASC, applicationNumber ASC
boq_retainage_ledger: contractId ASC, type ASC
boq_change_orders: buildingId ASC, status ASC
```

---

## 10. Affected Files

### 10.1 Νέα Αρχεία

```
src/types/measurements/contractor.ts                     # ContractorProfile, ContractorSpecialty
src/types/measurements/contract.ts                       # BOQContract, BOQSovLine, ContractType
src/types/measurements/payment.ts                        # BOQPaymentApplication, PaymentApplicationLine
src/types/measurements/retainage.ts                      # BOQRetainageEntry
src/types/measurements/change-order.ts                   # BOQChangeOrder
src/services/measurements/subcontractor-service.ts       # Full lifecycle
src/services/measurements/subcontractor-repository.ts    # Firestore layer
src/services/measurements/change-order-service.ts        # CO lifecycle
src/components/building-management/subcontractors/ContractorProfileCard.tsx
src/components/building-management/subcontractors/ContractListPage.tsx
src/components/building-management/subcontractors/ContractCard.tsx
src/components/building-management/subcontractors/SOVTable.tsx
src/components/building-management/subcontractors/PaymentApplicationForm.tsx
src/components/building-management/subcontractors/RetainageLedger.tsx
src/components/building-management/subcontractors/ChangeOrderForm.tsx
src/components/crm/contacts/ContractorBadge.tsx          # Badge στο contact card
```

### 10.2 Τροποποιούμενα Αρχεία

```
src/config/firestore-collections.ts    # +6 νέα collections
src/components/crm/contacts/ContactDetail.tsx  # +contractor profile section
src/i18n/locales/el/measurements.json  # +subcontractor translations
src/i18n/locales/en/measurements.json
firestore.indexes.json                 # +contractor/contract indexes
```

---

## 11. Acceptance Criteria

### Contractor Profile
- [ ] Δημιουργία profile πάνω σε υπάρχον contact (χωρίς αλλαγή contact)
- [ ] Specialty selection + rating
- [ ] Compliance dates (φορολογική/ασφαλιστική)
- [ ] Badge εμφανίζεται στο contact card

### Contract
- [ ] CRUD contract με SOV auto-generation
- [ ] 4 contract types: lump_sum, unit_price, cost_plus, remeasurable
- [ ] Approval workflow: draft → pending → active → completed
- [ ] Link to Gantt phases + BOQ items

### Payment Applications
- [ ] Sequential numbering (1ος, 2ος, 3ος...)
- [ ] SOV-based certification (per-line quantities)
- [ ] Auto-compute: gross, retainage, advance, net
- [ ] Workflow: draft → submitted → certified → approved → paid
- [ ] Block: certification > contracted quantity

### Retainage
- [ ] Auto-withhold per payment application
- [ ] Release mechanism with approval
- [ ] Block release before warranty expiry

### Change Orders
- [ ] Create CO with affected items + delta cost/duration
- [ ] Approval workflow
- [ ] Apply: creates new BOQ items with isOriginalBudget=false
- [ ] Baseline version bumped

---

## 12. Compliance: Ν.4412/2016

| Άρθρο | Απαίτηση | Κάλυψη |
|-------|---------|--------|
| 151 | Επιμετρήσεις εργασιών | BOQ items + certified quantities |
| 152 | Λογαριασμοί εργολάβου | Payment Applications (sequential) |
| 153 | Αναθεώρηση τιμών | Change Orders + re-baseline |
| 154 | Τελικός λογαριασμός | Final payment + retainage release |
| 165 | Υπεργολαβία | Contract management + SOV |

---

## 13. Out of Scope

- Self-service portal για υπεργολάβους → Future
- Insurance tracking integration → Future
- Tax compliance auto-check (TAXIS) → Future
- Multi-currency contracts → Future
- Bid management (tender process) → Future

---

*Implementation contract for ADR-175 Phase D (Subcontractors). Contacts structure MUST NOT change. Contractor Profile is a LAYER, not a new contact type.*
