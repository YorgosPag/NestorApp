# ADR-267: Lightweight Procurement Module — Purchase Orders & Material Tracking

**Status**: DRAFT — Αναμένει συζήτηση με Γιώργο
**Date**: 2026-03-28
**Author**: Claude (Research Agents × 4)
**Related ADRs**: ADR-175 (BOQ/Quantity Surveying), ADR-034 (Gantt), ADR-017 (Enterprise ID), ADR-ACC-002 (Invoicing), ADR-121 (Contact Personas)

### Changelog
| Date | Changes |
|------|---------|
| 2026-03-28 | Initial research & architecture — DRAFT for review |

---

## 1. EXECUTIVE SUMMARY

Σήμερα οι παραγγελίες υλικών γίνονται με email/τηλέφωνο/Excel. Προτείνεται ένα **lightweight** procurement module που:
- Δημιουργεί **Purchase Orders** (PO) συνδεδεμένα με BOQ items + suppliers
- Παρακολουθεί status: `Draft → Ordered → Delivered → Closed`
- Δείχνει **overview dashboard** (τι περιμένω, τι έφτασε, τι πληρώθηκε)
- Συνδέεται με υπάρχοντα: BOQ items, contacts (supplier persona), accounting invoices
- **ΔΕΝ περιλαμβάνει**: RFQ/quotes, 3-way matching, complex approval workflows, vendor scoring

**ΥΠΑΡΧΟΥΣΑ ΥΠΟΔΟΜΗ**: Το 70% του integration layer υπάρχει ήδη:
- BOQ items με `linkedContractorId` + `linkedInvoiceId`
- Supplier contacts (persona 'supplier', 5 κατηγορίες)
- Accounting invoices + expense documents
- Enterprise ID system (χρειάζεται νέος generator)
- Cheque registry (ήδη υποστηρίζει `ChequeContextType = 'supplier'`)

---

## 2. INDUSTRY RESEARCH (Buildertrend / CoConstruct / Fieldwire)

### 2.1 Τι κάνουν οι μικρές κατασκευαστικές εφαρμογές

| Feature | Buildertrend | CoConstruct | Fieldwire | Nestor Πρόταση |
|---------|-------------|-------------|-----------|---------------|
| PO CRUD | ✅ Full | ✅ Full | 🔶 Task-based | ✅ **Core** |
| Status Workflow | 7 states | 5 states | 5 states | ✅ **5 states** |
| Line Items | ✅ + cost codes | ✅ + selections | Basic | ✅ **+ BOQ link** |
| Budget Integration | ✅ Cost codes | ✅ Allowances | — | ✅ **Via BOQ** |
| Supplier Link | ✅ Directory | ✅ Vendor list | ✅ | ✅ **Via contacts** |
| Invoice Matching | ✅ PO↔Invoice | 🔶 Manual | — | 🔶 **Phase 2** |
| Delivery Photos | — | — | ✅ | 🔶 **Phase 2** |
| Email/Share PO | ✅ Auto-email | ✅ | — | 🔶 **Phase 2** |
| PDF Export | ✅ | ✅ | — | ✅ **Core** |
| Approval Workflow | ✅ Multi-level | 🔶 Simple | — | ❌ **Overkill** |
| RFQ Process | ✅ | — | — | ❌ **Overkill** |
| 3-Way Matching | ✅ | — | — | ❌ **Overkill** |

### 2.2 Consensus Pattern (Cross-Platform)

Όλες οι μικρές εφαρμογές συμφωνούν σε ένα **Tier 2** workflow:

```
DRAFT → APPROVED → ORDERED → DELIVERED → INVOICED → CLOSED
                                                   └→ CANCELLED (from any state)
```

Για 1-5 άτομα, το **Tier 1** αρκεί αρχικά:
```
DRAFT → ORDERED → DELIVERED → CLOSED
                             └→ CANCELLED
```

---

## 3. ΥΠΑΡΧΟΥΣΑ ΥΠΟΔΟΜΗ (Inventory)

### 3.1 BOQ Items — Procurement Links (ΗΔΗ ΥΠΑΡΧΟΥΝ)

```typescript
// src/types/boq/boq.ts — EXISTING fields
interface BOQItem {
  // ...
  linkedContractorId: string | null;  // ← Supplier/Subcontractor contact ID
  linkedInvoiceId: string | null;     // ← Linked to accounting invoice
  linkedPhaseId: string | null;       // ← Gantt phase
  linkedTaskId: string | null;        // ← Gantt task
  // ...
  materialUnitCost: number;
  laborUnitCost: number;
  equipmentUnitCost: number;
  estimatedQuantity: number;
  actualQuantity: number | null;
}
```

### 3.2 Supplier Contacts — Persona (ΗΔΗ ΥΠΑΡΧΕΙ)

```typescript
// src/types/contacts/personas.ts — EXISTING
interface SupplierPersona {
  personaType: 'supplier';
  supplierCategory: 'materials' | 'equipment' | 'subcontractor' | 'services' | 'other';
  paymentTermsDays: number | null;
  status: 'active' | 'inactive';
  activatedAt: string;
}
```

### 3.3 Accounting Integration (ΗΔΗ ΥΠΑΡΧΕΙ)

| System | Location | Σύνδεση με Procurement |
|--------|----------|----------------------|
| Invoicing | `src/subapps/accounting/` | Expense invoices → link to PO |
| Expense Documents | `accounting_expense_documents` collection | AI-processed supplier invoices |
| VAT Engine | ADR-ACC-004 | Supplier invoice VAT handling |
| Bank Reconciliation | ADR-ACC-008 | Supplier payment matching |
| Cheque Registry | `cheques` collection | `ChequeContextType = 'supplier'` ← READY |

### 3.4 Enterprise ID Generators (ΗΔΗ ΥΠΑΡΧΟΥΝ — χρειάζεται extension)

```typescript
// src/services/enterprise-id.service.ts — EXISTING generators (σχετικά)
generateBOQItemId()         // 'boq_XXXXX'
generateContactId()          // 'cont_XXXXX'
generateInvoiceAccId()       // 'inv_XXXXX'
generateExpenseDocId()       // 'exdoc_XXXXX'
generateChequeId()           // 'chq_XXXXX'
generateConstructionPhaseId() // 'cphase_XXXXX'
generateConstructionTaskId()  // 'ctask_XXXXX'

// ΝΕΟΙ generators needed:
generatePurchaseOrderId()    // 'po_XXXXX' ← NEW
generatePOItemId()           // 'poi_XXXXX' ← NEW (αν items σε subcollection)
```

### 3.5 UC-016 Document (Τεκμηριωμένη ροή — ΜΗ υλοποιημένη)

**Location**: `src/services/ai-pipeline/modules/uc-016-admin-update-contact/`

10-βήματη ροή admin contact update. Χρήσιμη ως **template** για μελλοντικά AI procurement modules (π.χ. "δημιούργησε PO για τσιμεντοσανίδες").

---

## 4. ΑΡΧΙΤΕΚΤΟΝΙΚΗ — PROPOSED SOLUTION

### 4.1 Purchase Order Entity

```typescript
// src/types/procurement/purchase-order.ts — NEW

/** PO Status — Tier 2 Workflow */
type PurchaseOrderStatus =
  | 'draft'       // Δημιουργήθηκε, δεν στάλθηκε
  | 'approved'    // Εγκρίθηκε (optional, for future multi-user)
  | 'ordered'     // Στάλθηκε στον προμηθευτή
  | 'delivered'   // Παραλήφθηκε (πλήρως ή μερικώς)
  | 'invoiced'    // Τιμολογήθηκε (linked to accounting invoice)
  | 'closed'      // Ολοκληρώθηκε
  | 'cancelled';  // Ακυρώθηκε

/** Purchase Order — Core Entity */
interface PurchaseOrder {
  id: string;                       // 'po_XXXXX' (enterprise-id)
  poNumber: string;                 // 'PO-2026-0042' (human-readable, auto-increment)
  companyId: string;

  // References
  projectId: string;                // ref → projects
  buildingId: string | null;        // ref → buildings (optional, PO may span buildings)
  supplierId: string;               // ref → contacts (supplier persona)

  // Status
  status: PurchaseOrderStatus;

  // Line Items (embedded array — max ~100 items per PO)
  items: PurchaseOrderItem[];

  // Financial Summary (computed, stored for query efficiency)
  subtotal: number;
  taxRate: number;                  // Default: 24 (Greece FPA)
  taxAmount: number;
  total: number;

  // Dates
  dateCreated: string;              // ISO
  dateNeeded: string | null;        // Requested delivery date
  dateOrdered: string | null;       // When sent to supplier
  dateDelivered: string | null;     // When received
  dateInvoiced: string | null;      // When invoice linked

  // Delivery
  deliveryAddress: string | null;   // Default: project site address

  // Accounting Links
  linkedInvoiceIds: string[];       // ref → accounting_invoices (1:many)

  // Metadata
  notes: string | null;
  createdBy: string;                // userId
  approvedBy: string | null;
  updatedAt: string;
  isDeleted: boolean;
}

/** Purchase Order Line Item */
interface PurchaseOrderItem {
  id: string;                       // 'poi_XXXXX'
  description: string;
  quantity: number;
  unit: string;                     // 'τεμ', 'm²', 'kg', 'lt', etc.
  unitPrice: number;
  total: number;                    // quantity × unitPrice

  // BOQ Integration (optional)
  boqItemId: string | null;         // ref → boq_items
  categoryCode: string | null;      // ΑΤΟΕ code (OIK-1...OIK-12)

  // Delivery Tracking
  quantityReceived: number;         // For partial deliveries (default: 0)
  quantityRemaining: number;        // quantity - quantityReceived (computed)
}
```

### 4.2 Status State Machine

```
                    ┌─── CANCELLED ───┐
                    │                 │
DRAFT ──→ APPROVED ──→ ORDERED ──→ DELIVERED ──→ INVOICED ──→ CLOSED
  │         │           │              │            │
  └─cancel──┘──cancel───┘──cancel──────┘            │
                                                    └── CLOSED
```

**Allowed Transitions**:
| From | To | Trigger |
|------|----|---------|
| draft | approved | User approves (or auto-approve for single-user) |
| draft | cancelled | User cancels |
| approved | ordered | User marks as sent |
| approved | cancelled | User cancels |
| ordered | delivered | User confirms delivery |
| ordered | cancelled | User cancels (before delivery) |
| delivered | invoiced | User links accounting invoice |
| invoiced | closed | Auto (or manual close) |
| delivered | closed | Manual close (without invoice link) |

**Phase A**: Simplified (auto-approve for single-user):
```
DRAFT ──→ ORDERED ──→ DELIVERED ──→ CLOSED
  │          │                      │
  └─cancel───┘──────────────────────┘
```

### 4.3 File Structure

```
src/
├── types/procurement/
│   └── purchase-order.ts                      # Types + status FSM
├── services/procurement/
│   ├── procurement-repository.ts              # Firestore CRUD
│   └── procurement-service.ts                 # Business logic + validation
├── app/
│   ├── api/procurement/
│   │   ├── route.ts                          # GET list, POST create
│   │   └── [poId]/
│   │       └── route.ts                      # GET one, PATCH update, DELETE
│   └── procurement/
│       ├── page.tsx                           # Dashboard / list page
│       └── [poId]/
│           └── page.tsx                       # PO detail / edit page
├── components/procurement/
│   ├── PurchaseOrderList.tsx                  # List with filters + status badges
│   ├── PurchaseOrderForm.tsx                  # Create / edit form
│   ├── PurchaseOrderDetail.tsx                # Read-only view + status actions
│   ├── PurchaseOrderKPIs.tsx                  # Dashboard summary cards
│   ├── PurchaseOrderItemsTable.tsx            # Line items table (add/edit/remove)
│   └── ProcurementBudgetOverview.tsx          # Budget vs committed vs spent
├── hooks/procurement/
│   ├── usePurchaseOrders.ts                   # List hook with filters
│   └── usePurchaseOrderForm.ts                # Form state + validation
```

**Εκτίμηση**: ~14 νέα αρχεία, ~2.500 LOC.

### 4.4 Firestore Collection

```
Firestore
└── purchase_orders/
    ├── {poId}/                    # PurchaseOrder document
    │   └── status_history/        # Subcollection (optional, Phase 2)
    │       └── {entryId}/         # { status, changedBy, changedAt, notes }
```

**Composite Indexes** (required):
- `companyId` + `status` + `dateCreated` DESC
- `companyId` + `projectId` + `dateCreated` DESC
- `companyId` + `supplierId` + `dateCreated` DESC

**Collection Registration** — add to `src/config/firestore-collections.ts`:
```typescript
PURCHASE_ORDERS: 'purchase_orders',
```

### 4.5 Navigation Placement

```
Sidebar
├── ...existing items...
├── Construction (HardHat icon)
│   ├── Timeline & Gantt
│   ├── BOQ / Measurements
│   └── Procurement          ← NEW (displayOrder: TBD)
```

Ή ως top-level item:
```
├── Procurement (ShoppingCart / Package icon, displayOrder: 55)
│   ├── Purchase Orders       /procurement
│   └── Budget Overview       /procurement/budget
```

**Απόφαση**: Συζήτηση με Γιώργο — εξαρτάται αν θέλουμε tight coupling με Construction ή standalone.

---

## 5. INTEGRATION POINTS (SSoT)

### 5.1 BOQ ↔ Procurement

**Pattern: Hybrid Linking** (best for Nestor):
- Κάθε PO line item **μπορεί** (optional) να δείχνει σε `boqItemId`
- Αν δεν δείχνει, τουλάχιστον δείχνει σε `categoryCode` (ΑΤΟΕ)
- Dashboard δείχνει: **Budget (BOQ estimated) → Committed (POs ordered) → Spent (Invoices) → Remaining**

```typescript
// Budget Awareness Calculation
interface BudgetOverviewItem {
  categoryCode: string;         // e.g., 'OIK-2' (Concrete)
  categoryName: string;         // e.g., 'Σκυροδέματα'
  budgeted: number;             // SUM(boq.estimatedCost) for category
  committed: number;            // SUM(po.total) WHERE status IN (ordered, delivered)
  spent: number;                // SUM(invoice.total) linked to POs in category
  remaining: number;            // budgeted - committed
  percentUsed: number;          // committed / budgeted × 100
}
```

### 5.2 Contacts ↔ Procurement

**Supplier Selection**: Φιλτράρισμα contacts WHERE `personas` contains `{ personaType: 'supplier' }`.

**Display**: Supplier name, VAT number, supplier category, payment terms.

**Reverse Link**: Contact detail page → tab/section "Purchase Orders" (all POs for this supplier).

### 5.3 Accounting ↔ Procurement

| Accounting Entity | Procurement Link | Direction |
|-------------------|-----------------|-----------|
| Expense Invoice | PO.linkedInvoiceIds[] | PO → Invoice |
| Expense Document (AI) | Auto-suggest PO matching | Invoice → PO |
| Journal Entry | Auto-generated on PO close | PO → Journal |
| Cheque | `contextType: 'supplier'` + poId | PO → Cheque |
| Bank Transaction | Matching via supplier + amount | Transaction → PO |

### 5.4 Gantt ↔ Procurement

Via BOQ items: `BOQItem.linkedPhaseId` → `ConstructionPhase` → PO items linked to same BOQ items.

**Use Case**: "Τι υλικά χρειάζομαι για τη φάση Σκυροδέματα;" → Φιλτράρισμα BOQ items by phaseId → show related POs.

---

## 6. CENTRALIZED SYSTEMS — ΥΠΟΧΡΕΩΤΙΚΗ ΧΡΗΣΗ (SSoT)

### 6.1 Design System Hooks

| Hook | Χρήση στο Procurement |
|------|----------------------|
| `useSemanticColors()` | Status badge colors, budget health indicators |
| `useSpacingTokens()` | Form layout, list spacing, card padding |
| `useBorderTokens()` | Form fields, card borders, table separators |
| `useIconSizes()` | Status icons, action button icons |
| `useTypography()` | Form labels, PO number display, totals |
| `useLayoutClasses()` | Form grid, responsive list layout |

### 6.2 UI Components (EXISTING — Reuse)

| Component | Χρήση |
|-----------|-------|
| `Card`, `CardContent`, `CardHeader` | PO detail, dashboard cards |
| `Badge` | Status badges (draft=gray, ordered=blue, delivered=green, etc.) |
| `Button` | Actions (Create PO, Mark Delivered, Link Invoice) |
| `Dialog`, `DialogContent` | Confirmation dialogs |
| `Select` (Radix) | Status filter, supplier select, unit select |
| `Input`, `Textarea` | Form fields |
| `Table`, `TableRow`, `TableCell` | Line items, PO list |
| `FormGrid`, `FormField` | Form layout |
| `SaveButton`, `CancelButton`, `DeleteButton` | Action buttons |
| `Spinner` | Loading states |
| `EmptyState` | No POs yet |

### 6.3 Infrastructure

| System | Χρήση |
|--------|-------|
| `withAuth()` + `withStandardRateLimit()` | API route protection |
| `logAuditEvent()` | PO create/update/status change audit |
| Enterprise ID: `generatePurchaseOrderId()` | New generator needed |
| `getAdminFirestore()` | Server-side Firestore SDK |
| i18n: `useTranslation('procurement')` | New namespace (el + en) |
| `formatCurrency()` | Money display |
| `formatDateShort()` | Date display |
| `cn()` | Class merging |

---

## 7. PO NUMBER FORMAT

**Pattern**: `PO-{YYYY}-{NNNN}` (human-readable, auto-increment)

**Examples**: `PO-2026-0001`, `PO-2026-0042`, `PO-2027-0001`

**Implementation**: Counter document στο Firestore (ίδιο pattern με `accounting_invoice_counters`):
```typescript
// purchase_order_counters/{companyId}_{year}
{ lastNumber: 42 }
```

Atomic increment via `FieldValue.increment(1)` → race-condition safe.

---

## 8. DASHBOARD SPECIFICATIONS

### 8.1 KPI Cards

| KPI | Υπολογισμός | Icon |
|-----|-------------|------|
| Active POs | COUNT WHERE status IN (ordered, delivered) | Package |
| Pending Delivery | COUNT WHERE status = 'ordered' | Truck |
| Total Committed | SUM(po.total) WHERE status IN (ordered, delivered) | DollarSign |
| Overdue Deliveries | COUNT WHERE dateNeeded < today AND status = 'ordered' | AlertTriangle |

### 8.2 Budget vs Committed Chart

**Visualization**: Recharts `<BarChart>` — stacked bars per ΑΤΟΕ category:
- **Budgeted** (gray) — from BOQ estimated costs
- **Committed** (blue) — from POs ordered/delivered
- **Spent** (green) — from linked invoices
- **Remaining** (light gray) — budgeted - committed

### 8.3 PO List View

| Column | Source | Sort/Filter |
|--------|--------|-------------|
| PO Number | poNumber | Sort ↑↓ |
| Supplier | supplierId → contact.name | Filter by supplier |
| Project | projectId → project.name | Filter by project |
| Status | status | Filter by status |
| Total | total (formatted) | Sort ↑↓ |
| Date Needed | dateNeeded | Sort ↑↓ |
| Date Created | dateCreated | Sort ↑↓ |
| Actions | Edit, View, Status change | — |

### 8.4 PO Detail View

```
┌──────────────────────────────────────────────┐
│ PO-2026-0042                  Status: ORDERED │
│ Supplier: Κ. Παπαδόπουλος ΟΕ                │
│ Project: Πολυκατοικία Γλυφάδα                │
│ Needed by: 15/04/2026                         │
├──────────────────────────────────────────────┤
│ LINE ITEMS                                    │
│ ┌─────────────────┬────┬─────┬───────┬──────┐│
│ │ Description      │ Qty│ Unit│ Price │ Total││
│ ├─────────────────┼────┼─────┼───────┼──────┤│
│ │ Τσιμεντοσανίδες │ 200│ τεμ │ €15.00│€3,000││
│ │ Γυψοσανίδα 12mm │ 150│ τεμ │ €8.50 │€1,275││
│ │ Βίδες γυψ/δας   │ 50 │ κουτ│ €4.20 │ €210 ││
│ └─────────────────┴────┴─────┴───────┴──────┘│
│                                               │
│ Subtotal: €4,485.00                           │
│ ΦΠΑ 24%:  €1,076.40                          │
│ TOTAL:    €5,561.40                           │
├──────────────────────────────────────────────┤
│ Notes: Παράδοση στο εργοτάξιο, πρωί 8-12    │
│ Created: 28/03/2026 by Γιώργος               │
│                                               │
│ [Mark Delivered] [Link Invoice] [Export PDF]  │
│ [Edit] [Cancel PO]                            │
└──────────────────────────────────────────────┘
```

---

## 9. PDF EXPORT

**Pattern**: Reuse jspdf + jspdf-autotable (same as accounting invoices).

**Layout** (A4 portrait):
1. Header: Company name, logo (optional), PO number, date
2. Supplier info: Name, VAT, address, phone
3. Line items table: Description, Qty, Unit, Price, Total
4. Totals: Subtotal, Tax, Total
5. Notes section
6. Footer: Delivery address, date needed

**Greek font**: Reuse Roboto font data from `src/services/gantt-export/roboto-font-data.ts`.

---

## 10. IMPLEMENTATION PHASES

### Phase A: Core PO CRUD (MVP)
**Εκτίμηση**: ~14 αρχεία, ~2.500 LOC

1. Types: `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseOrderStatus`
2. Enterprise ID: `generatePurchaseOrderId()`, `generatePOItemId()`
3. Firestore collection registration
4. Repository: CRUD operations
5. Service: Business logic, validation, status transitions
6. API routes: `/api/procurement/` (list, create) + `/api/procurement/[poId]` (get, update, delete)
7. Hooks: `usePurchaseOrders()`, `usePurchaseOrderForm()`
8. Components: List, Form, Detail, Items Table
9. Dashboard: KPIs, Budget Overview
10. Navigation: Sidebar entry
11. i18n: Greek + English keys
12. PDF export: PO document

### Phase B: Enhanced Integration
**Εκτίμηση**: ~6 αρχεία, ~1.000 LOC

1. Invoice matching: Link PO → accounting expense invoice
2. Status history subcollection (audit trail)
3. Partial delivery tracking (quantityReceived per item)
4. Contact detail page → "Purchase Orders" tab
5. BOQ detail → "Related POs" section
6. Email/share PO as PDF

### Phase C: Advanced (Μελλοντικά)
**Εκτίμηση**: ~1.500 LOC

1. Delivery photo verification (reuse `usePhotoCapture` from ADR-170)
2. AI document processing: Scan supplier invoice → auto-match to PO
3. AI Telegram module: "δημιούργησε PO για 200 τσιμεντοσανίδες στον Παπαδόπουλο"
4. Recurring POs (for regular suppliers/materials)
5. Supplier performance metrics (on-time %, quality rating)

---

## 11. FIRESTORE IMPACT

### Νέα Collection: `purchase_orders`

**Security Rules**:
```
match /purchase_orders/{poId} {
  allow read, write: if isAuthenticated() &&
    resource.data.companyId == request.auth.token.companyId;
}
```

### Νέα Collection: `purchase_order_counters`
```
match /purchase_order_counters/{counterId} {
  allow read, write: if isAuthenticated();
}
```

### Estimated Document Sizes:
- PO with 10 items: ~2-3 KB
- PO with 50 items: ~8-10 KB
- Well within Firestore 1MB limit

### Composite Indexes (deploy with `firebase deploy --only firestore:indexes`):
1. `companyId ASC, status ASC, dateCreated DESC`
2. `companyId ASC, projectId ASC, dateCreated DESC`
3. `companyId ASC, supplierId ASC, dateCreated DESC`

---

## 12. RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| PO-Invoice matching complexity | User confusion | Phase A: Manual link only. Phase C: AI matching |
| Items array grows too large | Slow reads | Max 100 items enforced in validation |
| Concurrent PO number generation | Duplicate numbers | Firestore atomic increment (proven pattern from accounting) |
| BOQ items not linked to suppliers | Empty "Budget vs Committed" | Allow POs without BOQ link (direct entry) |
| Suppliers not in contacts system | Can't create PO | Quick-create supplier from PO form (link to contacts) |

---

## 13. TESTING STRATEGY

1. **Unit tests**: Status transitions, total calculations, PO number generation
2. **Integration**: API routes → Firestore CRUD → response validation
3. **UI**: Form validation, status badge colors, responsive layout
4. **Edge cases**: Empty PO, 100-item PO, cancelled PO, partial delivery

---

## 14. DECISION RECORD

| Ερώτημα | Απόφαση | Σκεπτικό |
|---------|---------|----------|
| Items: embedded array ή subcollection? | Embedded array | PO items always read with PO. Max ~100 items. Array is simpler + faster |
| Status: Tier 1 (4 states) ή Tier 2 (7 states)? | Tier 2 schema, Tier 1 UI | Schema supports full workflow, Phase A UI shows simplified transitions |
| Navigation: under Construction ή standalone? | TBD — Γιώργος decides | Both patterns viable |
| Approval workflow? | Auto-approve for single-user | Team has 1-5 people, multi-level approval is overkill |
| PO per building ή per project? | Per project (buildingId optional) | POs often span multiple buildings in same project |
| Tax handling? | Default 24% with override | Greece standard VAT, allow override for exempt suppliers |
