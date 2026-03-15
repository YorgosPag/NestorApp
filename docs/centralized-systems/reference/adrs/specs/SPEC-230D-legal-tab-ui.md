# SPEC-230D: Legal Tab UI

| Field | Value |
|-------|-------|
| **ADR** | ADR-230 |
| **Phase** | D — UI Layer (Legal Tab + Components) |
| **Priority** | HIGH |
| **Status** | PLANNING |
| **Estimated Effort** | 2 sessions |
| **Prerequisites** | SPEC-230A, SPEC-230B, SPEC-230C |
| **Dependencies** | None (τελευταίο στη σειρά) |

---

## 1. Objective

Δημιουργία νέου tab "Νομικά" στο `SalesSidebar` που εμφανίζεται conditional (μόνο αν η μονάδα είναι reserved ή sold). Το tab περιέχει:
- Timeline 3 φάσεων (Προσύμφωνο → Οριστικό → Εξοφλητήριο)
- Card ανά contract με FSM actions
- Panel επαγγελματιών (live from unit associations)
- Brokerage card (μεσίτης + αμοιβή)

---

## 2. Task A: Νέο Tab στο SalesSidebar

### Target File
`src/components/sales/sidebar/SalesSidebar.tsx`

### Current Tab Config (γραμμή 63-70)
```typescript
const SALES_TABS = [
  { id: 'sale-info', icon: DollarSign, ... },
  { id: 'unit-summary', icon: Home, ... },
  { id: 'documents', icon: FileText, ... },
  { id: 'photos', icon: Camera, ... },
  { id: 'videos', icon: Video, ... },
  { id: 'history', icon: Clock, ... },
] as const;
```

### Required Change
```typescript
import { Scale } from 'lucide-react'; // ⚖️ icon

// Add to SALES_TABS (after 'sale-info'):
{ id: 'legal', icon: Scale, labelKey: 'sales.tabs.legal', defaultLabel: 'Νομικά' },
```

### Conditional Rendering
Το tab ΕΜΦΑΝΙΖΕΤΑΙ ΜΟΝΟ αν `selectedUnit.commercialStatus === 'reserved' || selectedUnit.commercialStatus === 'sold'`:

```typescript
// Filter tabs based on unit status
const visibleTabs = useMemo(() => {
  const isReservedOrSold = selectedUnit?.commercialStatus === 'reserved'
    || selectedUnit?.commercialStatus === 'sold';

  return SALES_TABS.filter(tab => {
    if (tab.id === 'legal') return isReservedOrSold;
    return true;
  });
}, [selectedUnit?.commercialStatus]);
```

### Tab Content
```tsx
<TabsContent value="legal">
  <LegalTabContent unit={selectedUnit} />
</TabsContent>
```

---

## 3. Task B: LegalTabContent — Composition Component

### Target File
`src/components/sales/legal/LegalTabContent.tsx` (νέο αρχείο)

### Component Structure
```tsx
interface LegalTabContentProps {
  unit: Unit;
}

export function LegalTabContent({ unit }: LegalTabContentProps) {
  const { contracts, currentPhase, isLoading } = useLegalContracts(unit.id);

  return (
    <ScrollArea>
      {/* 1. Timeline — visual progress */}
      <ContractTimeline
        currentPhase={currentPhase}
        contracts={contracts}
      />

      {/* 2. Active Contract Card(s) */}
      <section>
        {contracts.map(contract => (
          <ContractCard
            key={contract.id}
            contract={contract}
            onTransition={handleTransition}
            onOverrideProfessional={handleOverride}
          />
        ))}

        {/* Create next contract button (if allowed) */}
        <CreateContractButton
          unitId={unit.id}
          currentPhase={currentPhase}
          contracts={contracts}
        />
      </section>

      {/* 3. Professionals Panel — live from associations */}
      <ProfessionalsCard unitId={unit.id} />

      {/* 4. Brokerage — μεσίτης & αμοιβή */}
      <BrokerageSection
        projectId={unit.projectId}
        unitId={unit.id}
      />
    </ScrollArea>
  );
}
```

---

## 4. Task C: ProfessionalsCard

### Target File
`src/components/sales/legal/ProfessionalsCard.tsx` (νέο αρχείο)

### Description
Εμφανίζει τους 3 νομικούς ρόλους (seller_lawyer, buyer_lawyer, notary) με live data από unit associations. Ο μεσίτης (realtor) ΔΕΝ εμφανίζεται εδώ — είναι εμπορική σχέση και εμφανίζεται ΜΟΝΟ στο BrokerageSection (separation of concerns, Google pattern). Κάθε slot:
- Αν έχει ανατεθεί → Εμφανίζει όνομα + persona details + κουμπί αλλαγής
- Αν δεν έχει → Κουμπί "Ανάθεση" → ανοίγει contact picker (φιλτραρισμένο σε σχετική persona)

### Layout
```
┌─────────────────────────────────────────────────┐
│ Επαγγελματίες                                    │
│                                                   │
│ ⚖️ Δικηγόρος Πωλητή     Νίκος Παπαδόπουλος  ✏️ │
│    ΔΣΑ: 12345                                     │
│                                                   │
│ ⚖️ Δικηγόρος Αγοραστή   Μαρία Γεωργίου      ✏️ │
│    ΔΣΘ: 67890                                     │
│                                                   │
│ 📋 Συμβολαιογράφος       Δημήτρης Αλεξίου    ✏️ │
│    ΣΣΑ: 11223                                     │
└─────────────────────────────────────────────────┘
```

### Data Source
```typescript
// Reads from contact_links (AssociationService)
const links = await AssociationService.listContactLinks({
  targetEntityType: 'unit',
  targetEntityId: unitId,
  status: 'active',
});

// Filter for legal roles
// Μόνο νομικοί ρόλοι — ο μεσίτης διαχειρίζεται στο BrokerageSection
const legalLinks = links.filter(link =>
  ['seller_lawyer', 'buyer_lawyer', 'notary'].includes(link.role ?? '')
);
```

### Contact Picker Integration
Ο contact picker ΠΡΕΠΕΙ να φιλτράρει βάσει persona:
| Role | Required Persona |
|------|-----------------|
| seller_lawyer | `lawyer` |
| buyer_lawyer | `lawyer` |
| notary | `notary` |

---

## 5. Task D: ContractTimeline

### Target File
`src/components/sales/legal/ContractTimeline.tsx` (νέο αρχείο)

### Description
Horizontal stepper (3 βήματα) που δείχνει visual progress:

```
  ●━━━━━━━━━━━●─────────────────○
  Προσύμφωνο    Οριστικό          Εξοφλητήριο
  ✅ Signed      📝 Draft          ⏳ Pending
```

### Visual States per Step
| State | Icon | Color | Description |
|-------|------|-------|-------------|
| Not started | `○` (empty circle) | muted | Δεν έχει δημιουργηθεί ακόμα |
| Draft | `◐` (half circle) | warning/yellow | Υπάρχει draft contract |
| Pending Signature | `◐` | info/blue | Αναμένει υπογραφή |
| Signed | `●` (filled) | success/green | Υπεγράφη |
| Completed | `✓` (check) | success/green | Ολοκληρώθηκε |
| Cancelled | `✕` (cross) | destructive/red | Ακυρώθηκε |

### Progress Line
- **Solid line** (`━━━`) μεταξύ completed/signed steps
- **Dashed line** (`────`) μεταξύ current και next steps
- **No line** μετά τον τρέχοντα step

### Props
```typescript
interface ContractTimelineProps {
  currentPhase: LegalPhase;
  contracts: LegalContract[];
}
```

### Implementation Notes
- Χρήση `useSemanticColors()` για consistent χρωματισμό
- Mobile-responsive: σε μικρή οθόνη, vertical layout
- Κάθε step clickable → scroll to αντίστοιχο ContractCard

---

## 6. Task E: ContractCard

### Target File
`src/components/sales/legal/ContractCard.tsx` (νέο αρχείο)

### Description
Expandable card ανά contract. Default: collapsed (summary). Expanded: full details + actions.

### Collapsed View
```
┌─────────────────────────────────────────────────┐
│ Οριστικό Συμβόλαιο                  📝 Draft  ▼ │
│ €185,000 · Ραντεβού: 25/03/2026                │
└─────────────────────────────────────────────────┘
```

### Expanded View
```
┌─────────────────────────────────────────────────┐
│ Οριστικό Συμβόλαιο                  📝 Draft  ▲ │
│                                                  │
│ Αριθμός:     ΣΥΜ-2026-0042                      │
│ Ποσό:        €185,000                            │
│ Ραντεβού:    25/03/2026 10:00                    │
│                                                  │
│ ─── Επαγγελματίες (Snapshot) ───                │
│ Δικ. Πωλητή:   Ν. Παπαδόπουλος (ΔΣΑ: 12345)   │
│ Δικ. Αγοραστή: Μ. Γεωργίου (ΔΣΘ: 67890)       │
│ Συμβολαιογράφος: Δ. Αλεξίου (ΣΣΑ: 11223)      │
│                                                  │
│ 📎 2 έγγραφα                                    │
│                                                  │
│ [Αποστολή για Υπογραφή]  [Ακύρωση]             │
└─────────────────────────────────────────────────┘
```

### FSM Actions (Buttons)
| Current Status | Available Actions |
|---------------|-------------------|
| draft | "Αποστολή για Υπογραφή", "Ακύρωση" |
| pending_signature | "Υπογεγραμμένο", "Ακύρωση" |
| signed | "Ολοκλήρωση" |
| completed | — (no actions, terminal) |
| cancelled | — (no actions, terminal) |

### Status Badge Colors
- `draft` → `muted` (γκρι)
- `pending_signature` → `info` (μπλε)
- `signed` → `success` (πράσινο)
- `completed` → `success` (πράσινο, bold)
- `cancelled` → `destructive` (κόκκινο)

### Props
```typescript
interface ContractCardProps {
  contract: LegalContract;
  onTransition: (contractId: string, action: ContractTransitionAction, metadata?: TransitionMetadata) => Promise<void>;
  onOverrideProfessional: (contractId: string, role: LegalProfessionalRole, newContactId: string) => Promise<void>;
}
```

---

## 7. Task F: useLegalContracts Hook

### Target File
`src/hooks/useLegalContracts.ts` (νέο αρχείο)

### API
```typescript
interface UseLegalContractsReturn {
  /** Contracts ordered by phase (preliminary → final → payoff) */
  contracts: LegalContract[];

  /** Current legal phase (computed) */
  currentPhase: LegalPhase;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Manual refetch */
  refetch: () => void;

  // --- Actions ---

  /** Create new contract */
  createContract: (input: CreateContractInput) => Promise<void>;

  /** Transition contract status */
  transitionStatus: (contractId: string, action: ContractTransitionAction, metadata?: TransitionMetadata) => Promise<void>;

  /** Override professional on a contract */
  overrideProfessional: (contractId: string, role: LegalProfessionalRole, newContactId: string) => Promise<void>;
}

export function useLegalContracts(unitId: string): UseLegalContractsReturn
```

### Implementation Notes
- Fetch via `GET /api/contracts?unitId=X`
- Cache result in state
- Subscribe to RealtimeService events for optimistic updates:
  - `LEGAL_CONTRACT_CREATED` → refetch
  - `LEGAL_CONTRACT_STATUS_CHANGED` → update in-place
  - `LEGAL_CONTRACT_UPDATED` → update in-place
- Actions call API routes and optimistically update local state

---

## 8. Task G: i18n Keys

### Target Files
- `src/i18n/locales/el/common.json`
- `src/i18n/locales/en/common.json`

### Greek Keys
```json
{
  "sales": {
    "tabs": {
      "legal": "Νομικά"
    },
    "legal": {
      "title": "Νομική Διαδικασία",
      "preliminary": "Προσύμφωνο",
      "final": "Οριστικό Συμβόλαιο",
      "payoff": "Εξοφλητήριο",
      "contractNumber": "Αριθμός Συμβολαίου",
      "amount": "Ποσό",
      "scheduledDate": "Ραντεβού Συμβολαιογραφείου",
      "signatureDate": "Ημερομηνία Υπογραφής",
      "completionDate": "Ημερομηνία Ολοκλήρωσης",
      "notes": "Σημειώσεις",
      "professionals": "Επαγγελματίες",
      "professionalsSnapshot": "Στοιχεία κατά τη δημιουργία",
      "assignProfessional": "Ανάθεση Επαγγελματία",
      "changeProfessional": "Αλλαγή Επαγγελματία",
      "createContract": "Δημιουργία Συμβολαίου",
      "createPreliminary": "Δημιουργία Προσυμφώνου",
      "createFinal": "Δημιουργία Οριστικού",
      "createPayoff": "Δημιουργία Εξοφλητηρίου",
      "status": {
        "draft": "Πρόχειρο",
        "pending_signature": "Αναμονή Υπογραφής",
        "signed": "Υπεγράφη",
        "completed": "Ολοκληρώθηκε",
        "cancelled": "Ακυρώθηκε"
      },
      "actions": {
        "submitForSignature": "Αποστολή για Υπογραφή",
        "markSigned": "Σημείωση ως Υπεγραμμένο",
        "markCompleted": "Ολοκλήρωση",
        "cancel": "Ακύρωση",
        "cancellationReason": "Λόγος Ακύρωσης"
      },
      "phase": {
        "none": "Χωρίς νομική διαδικασία",
        "preliminary_pending": "Προσύμφωνο σε εξέλιξη",
        "preliminary_signed": "Προσύμφωνο υπεγράφη",
        "final_pending": "Οριστικό σε εξέλιξη",
        "final_signed": "Οριστικό υπεγράφη",
        "payoff_pending": "Εξοφλητήριο σε εξέλιξη",
        "payoff_completed": "Νομική διαδικασία ολοκληρώθηκε"
      },
      "timeline": {
        "notStarted": "Δεν έχει ξεκινήσει",
        "inProgress": "Σε εξέλιξη",
        "completed": "Ολοκληρώθηκε"
      },
      "documents": "Έγγραφα",
      "addDocument": "Προσθήκη Εγγράφου",
      "noContracts": "Δεν υπάρχουν συμβόλαια",
      "prerequisiteNotMet": "Απαιτείται υπογραφή {{phase}} πρώτα",
      "deposit": {
        "title": "Αρραβώνας / Προκαταβολή",
        "amount": "Ποσό Αρραβώνα",
        "terms": "Όροι σε Ακύρωση",
        "forfeited": "Χάνεται (αγοραστής αποσύρεται)",
        "returned": "Επιστρέφεται (αμοιβαία λύση)",
        "returned_double": "Επιστρέφεται στο διπλάσιο (πωλητής αποσύρεται)"
      }
    }
  }
}
```

### English Keys
```json
{
  "sales": {
    "tabs": {
      "legal": "Legal"
    },
    "legal": {
      "title": "Legal Process",
      "preliminary": "Preliminary Contract",
      "final": "Final Contract",
      "payoff": "Payoff Certificate",
      "contractNumber": "Contract Number",
      "amount": "Amount",
      "scheduledDate": "Notary Appointment",
      "signatureDate": "Signature Date",
      "completionDate": "Completion Date",
      "notes": "Notes",
      "professionals": "Professionals",
      "professionalsSnapshot": "Details at creation time",
      "assignProfessional": "Assign Professional",
      "changeProfessional": "Change Professional",
      "createContract": "Create Contract",
      "createPreliminary": "Create Preliminary",
      "createFinal": "Create Final Contract",
      "createPayoff": "Create Payoff Certificate",
      "status": {
        "draft": "Draft",
        "pending_signature": "Pending Signature",
        "signed": "Signed",
        "completed": "Completed",
        "cancelled": "Cancelled"
      },
      "actions": {
        "submitForSignature": "Submit for Signature",
        "markSigned": "Mark as Signed",
        "markCompleted": "Complete",
        "cancel": "Cancel",
        "cancellationReason": "Cancellation Reason"
      },
      "phase": {
        "none": "No legal process",
        "preliminary_pending": "Preliminary in progress",
        "preliminary_signed": "Preliminary signed",
        "final_pending": "Final contract in progress",
        "final_signed": "Final contract signed",
        "payoff_pending": "Payoff in progress",
        "payoff_completed": "Legal process completed"
      },
      "timeline": {
        "notStarted": "Not started",
        "inProgress": "In progress",
        "completed": "Completed"
      },
      "documents": "Documents",
      "addDocument": "Add Document",
      "noContracts": "No contracts",
      "prerequisiteNotMet": "{{phase}} must be signed first",
      "deposit": {
        "title": "Deposit / Earnest Money",
        "amount": "Deposit Amount",
        "terms": "Terms on Cancellation",
        "forfeited": "Forfeited (buyer withdraws)",
        "returned": "Returned (mutual cancellation)",
        "returned_double": "Returned double (seller withdraws)"
      }
    }
  }
}
```

---

## 9. Component Architecture

```
SalesSidebar
  └── TabsContent value="legal"
        └── LegalTabContent
              ├── ContractTimeline          (visual progress)
              ├── ContractCard[]            (per contract, expandable)
              │     ├── StatusBadge
              │     ├── ProfessionalSnapshotList
              │     ├── DocumentsList
              │     └── FSM Action Buttons
              ├── CreateContractButton       (next phase creation)
              ├── ProfessionalsCard          (live unit associations — νομικοί μόνο)
              │     └── ProfessionalSlot × 3 (seller_lawyer, buyer_lawyer, notary)
              │           └── ContactPicker (filtered by persona)
              └── BrokerageSection           (from SPEC-230B)
                    └── BrokerageCard[]
```

---

## 10. Files Summary

| Action | File | What |
|--------|------|------|
| **MODIFY** | `src/components/sales/sidebar/SalesSidebar.tsx` | +legal tab (conditional) |
| **CREATE** | `src/components/sales/legal/LegalTabContent.tsx` | Composition component |
| **CREATE** | `src/components/sales/legal/ProfessionalsCard.tsx` | 3 professional slots (νομικοί — χωρίς μεσίτη) |
| **CREATE** | `src/components/sales/legal/ContractTimeline.tsx` | Horizontal 3-step stepper |
| **CREATE** | `src/components/sales/legal/ContractCard.tsx` | Expandable contract card + FSM |
| **CREATE** | `src/hooks/useLegalContracts.ts` | Data hook + actions |
| **MODIFY** | `src/i18n/locales/el/common.json` | +sales.legal.* keys |
| **MODIFY** | `src/i18n/locales/en/common.json` | +sales.legal.* keys |

---

## 11. Verification Criteria

1. `npx tsc --noEmit` — zero errors σε αλλαγμένα αρχεία
2. Legal tab visible ONLY when unit is reserved or sold
3. Legal tab hidden when unit is available or under_construction
4. ContractTimeline renders correct visual state
5. ContractCard shows FSM action buttons per status
6. ProfessionalsCard shows live associations from unit
7. Contact picker filters by persona type
8. Create contract button respects phase prerequisites
9. i18n keys resolve in both EL and EN
10. Mobile responsive (timeline vertical, cards stack)

---

*SPEC Format: Google Engineering Design Docs standard*
