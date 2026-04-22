# ADR-230: Contract Workflow — Legal Process (Σύστημα Συμβολαίων / Νομική Διαδικασία Πώλησης)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED — All 5 phases completed (2026-03-14) |
| **Date** | 2026-03-14 |
| **Category** | Entity Systems |
| **Priority** | P1 — Business-Critical Process |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Related** | ADR-197 (Reservation Flow), ADR-198 (Sale Flow), ADR-191 (Document Management / FileRecord) |
| **Specs** | [SPEC-230A](specs/SPEC-230A-legal-professionals-placement.md), [SPEC-230B](specs/SPEC-230B-real-estate-agents-commissions.md), [SPEC-230C](specs/SPEC-230C-contract-workflow-phases.md), [SPEC-230D](specs/SPEC-230D-legal-tab-ui.md) |

---

## 1. Πρόβλημα (Context & Problem)

### 1.1 Τρέχουσα Κατάσταση

Η εφαρμογή υποστηρίζει ήδη τη **διαδικασία κράτησης και πώλησης** μονάδων ακινήτων (ADR-197/198). Όταν ολοκληρωθεί η πώληση, εμφανίζεται στην καρτέλα της μονάδας ποιος αγόρασε.

**Αυτό που ΛΕΙΠΕΙ** είναι η **νομική διαδικασία** που ακολουθεί μετά την οικονομική συναλλαγή:

1. **Προσύμφωνο** — Δεσμευτική συμφωνία πριν το οριστικό συμβόλαιο
2. **Οριστικό Συμβόλαιο** — Υπογραφή στο συμβολαιογραφείο
3. **Εξοφλητήριο Συμβόλαιο** — Βεβαίωση πλήρους εξόφλησης

Κάθε φάση απαιτεί τη συμμετοχή **τριών επαγγελματιών**:
- **Δικηγόρος Αγοραστή**
- **Δικηγόρος Πωλητή**
- **Συμβολαιογράφος**

### 1.2 Γιατί Είναι Πρόβλημα

| Κενό | Επίπτωση |
|------|----------|
| Δεν υπάρχει tracking νομικής φάσης | Ο χρήστης δεν ξέρει σε ποιο στάδιο είναι η πώληση μετά τη συναλλαγή |
| Δεν υπάρχει σύνδεση δικηγόρων/συμβολαιογράφου με μονάδα | Οι επαγγελματίες δεν φαίνονται πουθενά στην εφαρμογή |
| Δεν υπάρχει σειρά βημάτων (workflow) | Δεν μπορεί να εξασφαλιστεί ότι τηρείται η σωστή νομική σειρά |
| Δεν υπάρχει αποθήκευση εγγράφων ανά φάση | Τα συμβόλαια δεν συνδέονται με τη μονάδα |

### 1.3 Απαιτήσεις (Γιώργος)

- Μετά την κράτηση/πώληση → εμφανίζεται νέο tab "Νομικά" στο sidebar
- Τρία στάδια: Προσύμφωνο → Οριστικό → Εξοφλητήριο (sequential)
- Κάθε στάδιο δέχεται ανάθεση δικηγόρων + συμβολαιογράφου
- Οι επαγγελματίες αντλούνται από τις υπάρχουσες επαφές (contacts)
- **Ποιότητα Google-level** — enterprise architecture, όχι ad-hoc

---

## 2. Αρχιτεκτονική Απόφαση

### 2.1 Στρατηγικές Αποφάσεις

| Θέμα | Απόφαση | Γιατί |
|------|---------|-------|
| **Storage** | Νέο collection `contracts` | Ανεξάρτητος lifecycle, αποφυγή bloated unit document |
| **Professionals** | Embedded στο contract + `contact_links` extension στη μονάδα | Γρήγορο read + κεντρικοποιημένη σύνδεση |
| **Unit summary** | Denormalized `legalPhase` στο `unit.commercial` | Cards/lists χωρίς extra fetch |
| **Status progression** | Manual transitions + validation guards | MVP — ο χρήστης ελέγχει |
| **PDF Documents** | Υπάρχον `FileRecord` (domain: `legal`) | Πλήρης υποδομή ήδη (ADR-191) |
| **UI** | Νέο tab "Νομικά" στο `SalesSidebar` | Conditional — μόνο αν reserved/sold |
| **Σειρά** | Sequential: Προσύμφωνο → Οριστικό → Εξοφλητήριο | Business rule, server-enforced |

### 2.2 Αρχιτεκτονικό Διάγραμμα

```
┌─────────────────────────────────────────────────────────┐
│                    Unit (Μονάδα)                         │
│  commercial.legalPhase: LegalPhase (denormalized)       │
└──────────────────────┬──────────────────────────────────┘
                       │ unitId
                       ▼
┌─────────────────────────────────────────────────────────┐
│              contracts (Firestore Collection)            │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Προσύμφωνο   │→ │   Οριστικό   │→ │ Εξοφλητήριο  │  │
│  │ preliminary  │  │    final     │  │   payoff     │  │
│  │              │  │              │  │              │  │
│  │ buyerLawyer  │  │ buyerLawyer  │  │ buyerLawyer  │  │
│  │ sellerLawyer │  │ sellerLawyer │  │ sellerLawyer │  │
│  │ notary       │  │ notary       │  │ notary       │  │
│  │ fileIds[]    │  │ fileIds[]    │  │ fileIds[]    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                       │ contactId (lawyer/notary)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  contacts (Existing)                     │
│  persona: 'lawyer' | 'notary' (existing personas)       │
└─────────────────────────────────────────────────────────┘
```

### 2.3 State Machine — Legal Phase Progression

```
                    ┌──────────┐
                    │   none   │ (Αρχική κατάσταση — δεν έχει ξεκινήσει)
                    └────┬─────┘
                         │ createContract('preliminary')
                         ▼
              ┌─────────────────────┐
              │ preliminary_pending │ (Προσύμφωνο σε εξέλιξη)
              └──────────┬──────────┘
                         │ signContract()
                         ▼
              ┌─────────────────────┐
              │ preliminary_signed  │ (Προσύμφωνο υπογεγραμμένο)
              └──────────┬──────────┘
                         │ createContract('final')
                         ▼
              ┌─────────────────────┐
              │    final_pending    │ (Οριστικό σε εξέλιξη)
              └──────────┬──────────┘
                         │ signContract()
                         ▼
              ┌─────────────────────┐
              │    final_signed     │ (Οριστικό υπογεγραμμένο)
              └──────────┬──────────┘
                         │ createContract('payoff')
                         ▼
              ┌─────────────────────┐
              │   payoff_pending    │ (Εξοφλητήριο σε εξέλιξη)
              └──────────┬──────────┘
                         │ completeContract()
                         ▼
              ┌─────────────────────┐
              │  payoff_completed   │ (Ολοκληρώθηκε η νομική διαδικασία)
              └─────────────────────┘
```

---

## 3. Data Model

### 3.1 Types — `src/types/contract.ts` (Νέο αρχείο)

```typescript
import { Timestamp } from 'firebase/firestore';

/** Τύπος συμβολαίου */
export type ContractType = 'preliminary' | 'final' | 'payoff';

/** Κατάσταση μεμονωμένου συμβολαίου */
export type ContractStatus = 'draft' | 'pending_signature' | 'signed' | 'completed';

/** Νομική φάση μονάδας (denormalized στο unit.commercial) */
export type LegalPhase =
  | 'none'
  | 'preliminary_pending'
  | 'preliminary_signed'
  | 'final_pending'
  | 'final_signed'
  | 'payoff_pending'
  | 'payoff_completed';

/** Επαγγελματίας συνδεδεμένος με συμβόλαιο */
export interface ContractProfessional {
  contactId: string;
  displayName: string;
  role: 'buyer_lawyer' | 'seller_lawyer' | 'notary';
}

/** Κεντρικό interface συμβολαίου */
export interface Contract {
  id: string;

  // Σύνδεση με μονάδα & project
  unitId: string;
  unitName: string;
  projectId: string;
  buildingId: string;

  // Σύνδεση με αγοραστή
  buyerContactId: string;
  buyerName: string;

  // Σύνδεση με αλυσίδα συναλλαγής (reservation → sale → contract)
  transactionChainId: string | null;

  // Τύπος & κατάσταση
  contractType: ContractType;
  status: ContractStatus;

  // Στοιχεία συμβολαίου
  contractNumber: string | null;
  amount: number | null;
  notes: string | null;

  // Επαγγελματίες
  buyerLawyer: ContractProfessional | null;
  sellerLawyer: ContractProfessional | null;
  notary: ContractProfessional | null;

  // Έγγραφα (αναφορές στο files collection — ADR-191)
  fileIds: string[];

  // Ημερομηνίες
  draftDate: Timestamp | null;
  signatureDate: Timestamp | null;
  completionDate: Timestamp | null;
  scheduledDate: Timestamp | null; // Ραντεβού στο συμβολαιογραφείο

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}
```

### 3.2 Extensions σε Υπάρχοντα Types

#### `src/types/unit.ts` — Προσθήκη `legalPhase`

```typescript
// Στο UnitCommercialData interface:
legalPhase?: LegalPhase; // Denormalized από contracts — sync αυτόματα
```

#### `src/types/entity-associations.ts` — Νέα roles για μονάδα

```typescript
// Νέα roles στο unit context:
'buyer_lawyer' | 'seller_lawyer' | 'notary'
```

#### `src/config/firestore-collections.ts` — Νέο collection

```typescript
CONTRACTS: 'contracts' as const,
```

---

## 4. Service Layer

### 4.1 Αρχεία — `src/services/contract/`

| Αρχείο | Ρόλος |
|--------|-------|
| `contract.service.ts` | CRUD: create, updateStatus, assignProfessional, getForUnit |
| `contract-validation.ts` | FSM guards: canCreate, canTransition, validateProfessional |
| `contract-legal-phase-sync.ts` | Sync `unit.commercial.legalPhase` μετά κάθε status change |
| `index.ts` | Barrel exports |

### 4.2 Validation Rules (Business Logic)

**Σειρά δημιουργίας:**
- `preliminary` → Μπορεί να δημιουργηθεί αν η μονάδα είναι reserved ή sold
- `final` → **ΜΟΝΟ** αν υπάρχει signed `preliminary`
- `payoff` → **ΜΟΝΟ** αν υπάρχει signed `final`

**Status transitions (per contract):**
```
draft → pending_signature → signed → completed
```
- Κάθε transition είναι μονόδρομη (forward-only)
- `completed` = τελική κατάσταση, immutable

**Professional assignment:**
- Ο contact ΠΡΕΠΕΙ να έχει persona `lawyer` ή `notary` αντίστοιχα
- Validation στο service layer πριν την ανάθεση

### 4.3 Legal Phase Sync

Μετά κάθε status change στο contract, το service αυτόματα ενημερώνει:
```
unit.commercial.legalPhase = computeCurrentLegalPhase(contracts)
```

Ο υπολογισμός βασίζεται στο πιο προχωρημένο contract status:

| Contract State | Resulting `legalPhase` |
|---------------|----------------------|
| Preliminary draft/pending | `preliminary_pending` |
| Preliminary signed | `preliminary_signed` |
| Final draft/pending | `final_pending` |
| Final signed | `final_signed` |
| Payoff draft/pending | `payoff_pending` |
| Payoff completed | `payoff_completed` |

---

## 5. API Routes

| Route | Method | Λειτουργία |
|-------|--------|-----------|
| `/api/contracts` | `POST` | Δημιουργία contract (type, unitId, buyerContactId) |
| `/api/contracts?unitId=X` | `GET` | Ανάκτηση contracts για μονάδα |
| `/api/contracts/[id]/status` | `PATCH` | Αλλαγή status (draft → pending → signed → completed) |
| `/api/contracts/[id]/professionals` | `PATCH` | Ανάθεση/αφαίρεση επαγγελματία |

Όλα τα endpoints χρησιμοποιούν:
- `withAuth` middleware (authentication)
- `withStandardRateLimit` (rate limiting)
- Server-side validation μέσω `contract-validation.ts`

---

## 6. UI Components

### 6.1 Integration Point — `SalesSidebar`

Νέο tab στο sidebar:
```typescript
{
  id: 'legal',
  icon: Scale, // lucide-react
  labelKey: 'sales.tabs.legal',
  defaultLabel: 'Νομικά'
}
```

**Conditional rendering:** Εμφανίζεται ΜΟΝΟ αν `commercialStatus === 'reserved' || 'sold'`

### 6.2 Νέα Components — `src/components/sales/contracts/`

| Component | Ρόλος |
|-----------|-------|
| `LegalTabContent.tsx` | Main tab content — composition component |
| `ContractTimeline.tsx` | Horizontal stepper: `[Προσύμφωνο] → [Οριστικό] → [Εξοφλητήριο]` |
| `ContractCard.tsx` | Card ανά contract: status badge, professionals, ποσό, ημερομηνίες, actions |
| `ProfessionalsPanel.tsx` | 3 slots: Δικηγόρος Αγοραστή, Δικηγόρος Πωλητή, Συμβολαιογράφος |
| `ProfessionalSelector.tsx` | Dialog: contact picker φιλτραρισμένος σε lawyer/notary persona |

### 6.3 Hook — `src/hooks/useContractsForUnit.ts`

```typescript
// Fetch + cache contracts ανά μονάδα
function useContractsForUnit(unitId: string): {
  contracts: Contract[];
  currentPhase: LegalPhase;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

### 6.4 UI Mockup — Contract Timeline

```
┌─────────────────────────────────────────────────────────────┐
│  Νομική Διαδικασία                                          │
│                                                             │
│  ●━━━━━━━━━━━━●─────────────────○─────────────────○         │
│  Προσύμφωνο    Οριστικό          Εξοφλητήριο               │
│  ✅ Υπογεγραμμένο  📝 Σε εξέλιξη    ⏳ Αναμονή             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Οριστικό Συμβόλαιο                      📝 Draft    │    │
│  │                                                     │    │
│  │ Δικηγόρος Αγοραστή: Νίκος Παπαδόπουλος      ✏️    │    │
│  │ Δικηγόρος Πωλητή:   Μαρία Γεωργίου          ✏️    │    │
│  │ Συμβολαιογράφος:     Δημήτρης Αλεξίου        ✏️    │    │
│  │                                                     │    │
│  │ Ποσό: €185,000                                      │    │
│  │ Ραντεβού: 25/03/2026 10:00                          │    │
│  │                                                     │    │
│  │ 📎 2 έγγραφα                                        │    │
│  │                                                     │    │
│  │ [Αλλαγή Κατάστασης ▼]  [Προσθήκη Εγγράφου]        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. i18n Keys

**Namespace:** `common` → section `sales.legal.*`

```
sales.tabs.legal          → "Νομικά" / "Legal"
sales.legal.title         → "Νομική Διαδικασία" / "Legal Process"
sales.legal.preliminary   → "Προσύμφωνο" / "Preliminary Contract"
sales.legal.final         → "Οριστικό Συμβόλαιο" / "Final Contract"
sales.legal.payoff        → "Εξοφλητήριο" / "Payoff Certificate"
sales.legal.buyerLawyer   → "Δικηγόρος Αγοραστή" / "Buyer's Lawyer"
sales.legal.sellerLawyer  → "Δικηγόρος Πωλητή" / "Seller's Lawyer"
sales.legal.notary        → "Συμβολαιογράφος" / "Notary"
sales.legal.draft         → "Πρόχειρο" / "Draft"
sales.legal.pendingSig    → "Αναμονή Υπογραφής" / "Pending Signature"
sales.legal.signed        → "Υπογεγραμμένο" / "Signed"
sales.legal.completed     → "Ολοκληρώθηκε" / "Completed"
sales.legal.createContract→ "Δημιουργία Συμβολαίου" / "Create Contract"
sales.legal.scheduledDate → "Ραντεβού Συμβολαιογραφείου" / "Notary Appointment"
sales.legal.assignProfessional → "Ανάθεση Επαγγελματία" / "Assign Professional"
```

---

## 8. Centralized Systems Used

| Σύστημα | Χρήση | Αρχείο |
|---------|-------|--------|
| `COLLECTIONS` | `CONTRACTS` registration | `firestore-collections.ts` |
| `FileRecord` (ADR-191) | Αποθήκευση εγγράφων συμβολαίων (domain: `legal`) | `contract.service.ts` |
| `entity-associations` | Σύνδεση professionals → unit | `entity-associations.ts` |
| `useSemanticColors()` | Χρωματισμός status badges | UI components |
| `withAuth` | Authentication σε API routes | API routes |
| `withStandardRateLimit` | Rate limiting | API routes |
| Contact personas | Φιλτράρισμα lawyer/notary | `ProfessionalSelector.tsx` |

---

## 9. Implementation Phases

| Φάση | Περιγραφή | Αρχεία |
|------|-----------|--------|
| **1** | Types & Collection registration | `contract.ts`, `unit.ts`, `entity-associations.ts`, `firestore-collections.ts` |
| **2** | Service layer (CRUD + validation + sync) | `contract.service.ts`, `contract-validation.ts`, `contract-legal-phase-sync.ts` |
| **3** | API routes (4 endpoints) | `/api/contracts/*` |
| **4** | UI components (5 components + hook) | `LegalTabContent`, `ContractTimeline`, `ContractCard`, `ProfessionalsPanel`, `ProfessionalSelector`, `useContractsForUnit` |
| **5** | Integration + i18n | `SalesSidebar` tab, `el/en` keys |
| **6** | ADR update + verification | ADR ενημέρωση, tsc check |

---

## 10. Verification Criteria

1. `npx tsc --noEmit` — zero errors σε αλλαγμένα αρχεία
2. Sold unit → tab "Νομικά" εμφανίζεται
3. Create Προσύμφωνο → ContractCard εμφανίζεται
4. Ανάθεση δικηγόρου → ProfessionalsPanel ενημερώνεται
5. Status: draft → pending → signed → completed (transitions)
6. **ΔΕΝ** μπορεί να δημιουργηθεί Οριστικό αν δεν είναι signed το Προσύμφωνο
7. `legalPhase` badge στις κάρτες μονάδων
8. EL + EN i18n σωστά

---

## 11. Future Enhancements (Phase 2+)

| Feature | Priority | Περιγραφή |
|---------|----------|-----------|
| **ADR-231: Payment Plan & Installment Tracking** | **HIGH — Επόμενο βήμα** | **Πρόγραμμα αποπληρωμής ακινήτου**: μετρητά, δάνειο, δόσεις, επιταγές, συναλλαγματικές, ημερομηνίες λήξης. Ξεχωριστό domain — συνδέεται με contracts (π.χ. Εξοφλητήριο δημιουργείται μετά την πλήρη αποπληρωμή). |
| Notifications | Medium | Email/push notification σε αλλαγή status |
| Templates | Low | Predefined templates για κάθε τύπο συμβολαίου |
| Digital signatures | Low | E-signature integration |
| Timeline audit | Medium | Full audit trail κάθε αλλαγής |
| Calendar integration | Medium | Ραντεβού συμβολαιογραφείου στο calendar (ADR-089) |
| Dashboard stats | Low | Στατιστικά νομικών φάσεων ανά project |

---

## 12. Decision Log

| Ημερομηνία | Απόφαση | Συγγραφέας |
|------------|---------|------------|
| 2026-03-14 | ADR-230 δημιουργία — τεκμηρίωση αρχιτεκτονικής πριν υλοποίηση | Γιώργος + Claude |
| 2026-03-14 | Separate `contracts` collection αντί embedded στο unit | Γιώργος + Claude |
| 2026-03-14 | Sequential workflow: Προσύμφωνο → Οριστικό → Εξοφλητήριο | Γιώργος + Claude |
| 2026-03-14 | Manual status transitions (MVP) — αυτοματισμοί στο Phase 2 | Γιώργος + Claude |
| 2026-03-14 | 4 SPEC αρχεία: A (Professionals), B (Brokerage), C (Contract FSM), D (UI) | Γιώργος + Claude |
| 2026-03-14 | Hybrid approach: unit-level assignment + contract snapshot + override | Γιώργος + Claude |
| 2026-03-14 | Separate `legal_contracts` collection (prefix αποφυγή naming collision) | Γιώργος + Claude |
| 2026-03-14 | Brokerage: exclusive/non-exclusive + percentage/fixed commission | Γιώργος + Claude |
| 2026-03-14 | Προσύμφωνο + Εξοφλητήριο = προαιρετικά, Οριστικό = υποχρεωτικό | Γιώργος + Claude |
| 2026-03-14 | Αρραβώνας: depositAmount + depositTerms (ΑΚ 402-403) | Γιώργος + Claude |
| 2026-03-14 | Μόνο 1 active contract ανά φάση — cancelled κρατούνται ως ιστορικό | Γιώργος + Claude |
| 2026-03-14 | Μεσίτης μόνο στο BrokerageSection (separation of concerns) | Γιώργος + Claude |
| 2026-03-14 | Πληρώνεται μόνο ο μεσίτης που έφερε τον αγοραστή (χειροκίνητη επιλογή) | Γιώργος + Claude |
| 2026-03-14 | Επαγγελματίες προαιρετικοί — σταδιακή ανάθεση μετά καπάρο | Γιώργος + Claude |
| 2026-03-14 | Ποσό contract ελεύθερο — μπορεί να είναι αντικειμενική αξία | Γιώργος + Claude |
| 2026-03-14 | Payment Plan (δόσεις/δάνειο/επιταγές) → ξεχωριστό ADR-231 | Γιώργος + Claude |

---

## Implementation Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-14 | **Phase 1**: Created `types/legal-contracts.ts`, `types/brokerage.ts`. Extended `entity-associations.ts` (+3 unit roles), `unit.ts` (+legalPhase), `firestore-collections.ts` (+3 collections). Added i18n keys. | Claude |
| 2026-03-14 | **Phase 2**: Added `snapshotProfessionals()` to AssociationService. Created `BrokerageService` (CRUD + exclusivity validation + commission). | Claude |
| 2026-03-14 | **Phase 3**: Created `LegalContractService` (CRUD + FSM + legalPhase sync). 4 API routes: `/api/contracts`, `/api/contracts/[id]`, `/api/contracts/[id]/transition`, `/api/contracts/[id]/professionals`. Added 5 realtime event types. | Claude |
| 2026-03-14 | **Phase 4**: Created UI components: `ContractTimeline`, `ContractCard`, `ProfessionalsCard`, `BrokerageCard`, `LegalTabContent`. Modified `SalesSidebar` (+conditional legal tab). Added `useLegalContracts` hook. Added ~35 i18n keys (EL+EN). | Claude |
| 2026-03-14 | **Phase 5**: Added optional broker dropdown in `SellDialog` with commission preview. Fire-and-forget commission recording on sale. Updated ADR status to IMPLEMENTED. | Claude |
| 2026-04-22 | **Fix (Google-level SSoT)**: `LegalTabContent.handleCreate` e `useLegalContracts` consumavano `unit.project` (campo denormalizzato, può essere stale se il property è stato creato prima del link `building→project`). Sintomo: creazione προσύμφωνο falliva con `sales.errors.noProject` anche quando il building era regolarmente linkato. Refactor: adotta il hook centralizzato `usePropertyHierarchyValidation` (ADR-197/ADR-284) che risolve `building.projectId` real-time via `subscribeDoc` + `RealtimeService`. Allinea LegalTabContent al pattern già usato da `SellDialog` / `ReserveDialog`. Button "Create" ora disabilitato durante `hierarchy.loading`; error dispatch usa il primo `hierarchy.errors[i].i18nKey` (Company→Project→Building→Floor order). Nessuna modifica server-side necessaria. | Claude |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Google, Stripe, Palantir*
