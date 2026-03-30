# SPEC-018: Πλήρης Χαρτογράφηση — Οικονομικά B (Purchase Orders + Brokerage + Commissions)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.1
**Last Updated**: 2026-03-30
**Source of Truth**: Κώδικας (`src/types/procurement/purchase-order.ts`, `src/types/brokerage.ts`)

---

## 1. Ταυτότητα Οντοτήτων

| Στοιχείο | Purchase Orders | Brokerage Agreements | Commission Records |
|----------|----------------|---------------------|--------------------|
| **Collection** | `purchase_orders` | `brokerage_agreements` | `commission_records` |
| **TypeScript** | `PurchaseOrder` | `BrokerageAgreement` | `CommissionRecord` |
| **ID Pattern** | `po_XXXXX` | Enterprise ID | Enterprise ID |
| **Tenant Isolation** | `companyId` | `companyId` | `companyId` |
| **ADR Reference** | ADR-267 (Procurement) | ADR-230 (Contract Workflow) | ADR-230 (Contract Workflow) |
| **FSM States** | 7 (draft→closed + cancelled) | 3 (active/expired/terminated) | 3 (pending/paid/cancelled) |

---

# ΟΝΤΟΤΗΤΑ 1: Purchase Orders (Παραγγελίες Αγοράς)

## 2A. Πλήρης Κατάλογος Πεδίων — PurchaseOrder

### 2A.1 Ταυτοποίηση & Αναφορές

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID (`po_XXXXX`) |
| 2 | `poNumber` | string | Yes | Sequential αρίθμηση `PO-NNNN` (χωρίς reset ανά έτος) |
| 3 | `companyId` | string | Yes | Tenant isolation |
| 4 | `projectId` | string | Yes | FK → `projects` (REQUIRED) |
| 5 | `buildingId` | string / null | Yes | FK → `buildings` (optional — project-wide ή building-specific) |
| 6 | `supplierId` | string | Yes | FK → `contacts` (supplier persona) |

### 2A.2 Status & Workflow

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 7 | `status` | PurchaseOrderStatus | Yes | 7-state FSM (βλ. §3A.1) |

### 2A.3 Line Items (Embedded Array)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 8 | `items` | PurchaseOrderItem[] | Yes | Ενσωματωμένα line items (~30 max τυπικά) |

### 2A.4 Οικονομικά Σύνοψης (Computed, stored)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 9 | `currency` | `'EUR'` | Yes | Νόμισμα (πάντα EUR) |
| 10 | `subtotal` | number | Yes | Σύνολο χωρίς ΦΠΑ |
| 11 | `taxRate` | POVatRate | Yes | ΦΠΑ: 24% / 13% / 6% / 0% |
| 12 | `taxAmount` | number | Yes | Ποσό ΦΠΑ |
| 13 | `total` | number | Yes | Σύνολο με ΦΠΑ |

### 2A.5 Ημερομηνίες

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 14 | `dateCreated` | string (ISO) | Yes | Ημ/νία δημιουργίας |
| 15 | `dateNeeded` | string (ISO) / null | No | Ημ/νία ανάγκης |
| 16 | `dateOrdered` | string (ISO) / null | No | Ημ/νία αποστολής στον προμηθευτή |
| 17 | `dateDelivered` | string (ISO) / null | No | Ημ/νία παραλαβής |
| 18 | `dateInvoiced` | string (ISO) / null | No | Ημ/νία τιμολόγησης |

### 2A.6 Παράδοση & Πληρωμή

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 19 | `deliveryAddress` | string / null | No | Auto-fill από project, editable |
| 20 | `paymentTermsDays` | number / null | No | Auto-fill από supplier persona |
| 21 | `paymentDueDate` | string (ISO) / null | No | Auto: dateOrdered + paymentTermsDays |

### 2A.7 Accounting Links

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 22 | `linkedInvoiceIds` | string[] | Yes | FK → `accounting_invoices` (1:N matching) |

### 2A.8 Σημειώσεις

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 23 | `supplierNotes` | string / null | No | Εμφανίζεται στο PDF |
| 24 | `internalNotes` | string / null | No | Εσωτερικό — ΔΕΝ εμφανίζεται στο PDF |

### 2A.9 Συνημμένα

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 25 | `attachments` | POAttachment[] | Yes | Max 5 αρχεία, max 10MB έκαστο |

### 2A.10 Ακύρωση

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 26 | `cancellationReason` | POCancellationReason / null | Cond. | Υποχρεωτικό αν status = cancelled |
| 27 | `cancellationComment` | string / null | No | Ελεύθερο σχόλιο ακύρωσης |

### 2A.11 Metadata / Audit

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 28 | `createdBy` | string | Yes | User ID δημιουργού |
| 29 | `approvedBy` | string / null | No | User ID εγκρίνοντος |
| 30 | `updatedAt` | string (ISO) | Yes | Ημ/νία τελευταίας ενημέρωσης |
| 31 | `isDeleted` | boolean | Yes | Soft delete flag |

---

## 3A. Nested Objects & Arrays — PurchaseOrder

### 3A.1 PurchaseOrderStatus FSM (7 states)

```
  draft ──→ approved ──→ ordered ──→ partially_delivered ──→ delivered ──→ closed
    │           │           │              │
    └───────────┴───────────┘              │
              cancelled ←──────────────────┘ (ΟΧΙ — μόνο από draft/approved/ordered)
```

| Status | Περιγραφή | Χρώμα | Transitions |
|--------|-----------|-------|-------------|
| `draft` | Πρόχειρο | gray | → approved, cancelled |
| `approved` | Εγκρίθηκε | blue | → ordered, cancelled |
| `ordered` | Παραγγέλθηκε | yellow | → partially_delivered, delivered, cancelled |
| `partially_delivered` | Μερική παραλαβή (AUTO) | orange | → partially_delivered, delivered |
| `delivered` | Πλήρης παραλαβή (AUTO) | green | → closed |
| `closed` | Ολοκληρώθηκε | emerald | — (τερματική) |
| `cancelled` | Ακυρώθηκε | red | — (τερματική) |

> **ΣΗΜΑΝΤΙΚΟ**: `partially_delivered` & `delivered` υπολογίζονται αυτόματα από ποσότητες received.

### 3A.2 `items[]` — PurchaseOrderItem

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `id` | string | `poi_XXXXX` (enterprise-id) |
| `description` | string | Περιγραφή είδους |
| `quantity` | number | Ποσότητα |
| `unit` | string | Μονάδα μέτρησης (from PROCUREMENT_UNIT_OPTIONS ή custom) |
| `unitPrice` | number | Τιμή μονάδας (EUR) |
| `total` | number | quantity × unitPrice (computed, stored) |
| `boqItemId` | string / null | FK → `boq_items` (optional link) |
| `categoryCode` | string | Κωδικός ΑΤΟΕ (OIK-1…OIK-12) — **ΥΠΟΧΡΕΩΤΙΚΟ** |
| `quantityReceived` | number | Παραληφθείσα ποσότητα (default: 0) |
| `quantityRemaining` | number | quantity − quantityReceived (computed) |

### 3A.3 `attachments[]` — POAttachment

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `id` | string | `poatt_XXXXX` |
| `fileName` | string | Όνομα αρχείου |
| `fileSize` | number | Μέγεθος σε bytes |
| `mimeType` | string | MIME type (pdf, jpg, png, xlsx, docx) |
| `storagePath` | string | Firebase Storage path |
| `uploadedBy` | string | User ID |
| `uploadedAt` | string (ISO) | Ημ/νία upload |

### 3A.4 POCancellationReason (7 values)

| Τιμή | Περιγραφή EL | Περιγραφή EN |
|------|-------------|-------------|
| `supplier_change` | Αλλαγή προμηθευτή | Supplier change |
| `plan_change` | Αλλαγή σχεδίου | Plan change |
| `wrong_order` | Λάθος παραγγελία | Wrong order |
| `supplier_delay` | Καθυστέρηση προμηθευτή | Supplier delay |
| `budget_cut` | Περικοπή budget | Budget cut |
| `duplicate` | Διπλή παραγγελία | Duplicate order |
| `other` | Άλλο | Other |

### 3A.5 POVatRate (4 values)

| Τιμή | Ετικέτα |
|------|---------|
| `24` | 24% (standard) |
| `13` | 13% (μειωμένος) |
| `6` | 6% (υπερμειωμένος) |
| `0` | 0% (ενδοκοινοτική) |

### 3A.6 PO-Invoice Matching (ADR-267 Phase C)

| Τύπος | Πεδία | Περιγραφή |
|-------|-------|-----------|
| `POMatchCandidate` | poId, poNumber, supplierId, total, subtotal, status, confidence, matchReasons[] | Υποψήφιο match |
| `POMatchResult` | candidates[], bestMatch, autoMatched | Αποτέλεσμα matching |

**Scoring Algorithm** (max 100 points):

| Κριτήριο | Πόντοι |
|----------|--------|
| Amount exact (±5%) | 40 |
| Amount near (±10%) | 25 |
| Date proximity (≤30d) | 20 |
| Date proximity (≤60d) | 10 |
| Line item count match | 15 |
| Description match | 15 |
| Reference match | 10 |
| **Auto-match threshold** | **≥85** |

### 3A.7 Supplier Metrics (ADR-267 Phase C)

| Τύπος | Πεδία | Περιγραφή |
|-------|-------|-----------|
| `SupplierMetrics` | supplierId, supplierName, totalOrders, totalSpend, averageOrderValue, onTimeDeliveryRate, averageLeadTimeDays, cancellationRate, categoryBreakdown[] | Aggregated KPIs |
| `CategorySpend` | categoryCode, categoryName, totalSpend, orderCount | Spend per ΑΤΟΕ |
| `SupplierComparison` | suppliers[], totalSuppliers | Multi-supplier σύγκριση |
| `SupplierPriceTrend` | month, averageUnitPrice, orderCount, totalQuantity | Τιμές ανά μήνα |

### 3A.8 Budget Overview (Dashboard, computed)

| Τύπος | Πεδία | Περιγραφή |
|-------|-------|-----------|
| `BudgetOverviewItem` | categoryCode, categoryName, budgeted, committed, spent, remaining, percentUsed | Budget awareness ανά ΑΤΟΕ |

### 3A.9 Procurement Settings (Per-company)

| Πεδίο | Τύπος | Default | Περιγραφή |
|-------|-------|---------|-----------|
| `requireSeparateApprover` | boolean | false | Self-approve OK αν false |
| `autoApproveThreshold` | number / null | null | Auto-approve κάτω από ποσό |
| `termsAndConditions` | string / null | null | Standard T&C for PDF footer |

### 3A.10 Procurement Audit Events (9 types)

| Event | Περιγραφή |
|-------|-----------|
| `procurement.po.created` | PO δημιουργήθηκε |
| `procurement.po.approved` | PO εγκρίθηκε |
| `procurement.po.ordered` | PO στάλθηκε στον προμηθευτή |
| `procurement.po.status_changed` | Αλλαγή status |
| `procurement.po.items_edited` | Τροποποίηση line items |
| `procurement.po.cancelled` | PO ακυρώθηκε |
| `procurement.po.deleted` | PO soft-deleted |
| `procurement.po.delivery_recorded` | Καταγραφή παραλαβής |
| `procurement.po.invoice_linked` | Σύνδεση τιμολογίου |

### 3A.11 Procurement Permissions (ADR-267 §11)

| Permission | Key | Περιγραφή |
|-----------|-----|-----------|
| PO_READ | `procurement:po:read` | Ανάγνωση POs |
| PO_CREATE | `procurement:po:create` | Δημιουργία POs |
| PO_APPROVE | `procurement:po:approve` | Έγκριση POs |
| PO_CANCEL | `procurement:po:cancel` | Ακύρωση POs |
| PO_DELETE | `procurement:po:delete` | Διαγραφή POs |
| PO_READ_INTERNAL | `procurement:po:read_internal` | Internal notes |

---

### 3A.12 Computed Fields — PO Delivery & Aging (Procore/NetSuite Pattern, 2026-03-30)

**Απόφαση**: Ίδιο pattern με Payment Plan aging — virtual columns, at query time, μηδέν storage.

| # | Field Key | Τύπος | Υπολογισμός | Περιγραφή |
|---|-----------|-------|-------------|-----------|
| C1 | `computed.deliveryPct` | percentage | `SUM(items[].quantityReceived) / SUM(items[].quantity) × 100` | % παράδοσης (0-100) |
| C2 | `computed.isOverdue` | boolean | `dateNeeded < now AND status NOT IN ('delivered','closed','cancelled')` | Εκπρόθεσμη παραγγελία |
| C3 | `computed.daysOverdue` | number | `max(0, (now - dateNeeded) / 86400000)` αν isOverdue, αλλιώς 0 | Ημέρες καθυστέρησης |
| C4 | `computed.agingBucket` | enum | `daysOverdue → '0-30' / '31-60' / '61-90' / '90+'` | Aging bucket |
| C5 | `computed.daysInStatus` | number | `(now - updatedAt) / 86400000` | Ημέρες στο τρέχον status |
| C6 | `computed.itemCount` | number | `items.length` | Πλήθος ειδών |
| C7 | `computed.receivedItemCount` | number | `COUNT items WHERE quantityReceived >= quantity` | Πλήρως παραληφθέντα είδη |
| C8 | `computed.paymentOverdue` | boolean | `paymentDueDate < now AND status NOT IN ('closed','cancelled')` | Εκπρόθεσμη πληρωμή |
| C9 | `computed.daysSinceOrdered` | number | `dateOrdered ? (now - dateOrdered) / 86400000 : null` | Lead time (ημέρες από παραγγελία) |

---

# ΟΝΤΟΤΗΤΑ 2: Brokerage Agreements (Μεσιτικές Συμφωνίες)

## 2B. Πλήρης Κατάλογος Πεδίων — BrokerageAgreement

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID |
| 2 | `agentContactId` | string | Yes | FK → `contacts` (real_estate_agent persona) |
| 3 | `agentName` | string | Yes | Denormalized όνομα μεσίτη |
| 4 | `scope` | `'project'` / `'unit'` | Yes | Εμβέλεια σύμβασης |
| 5 | `projectId` | string | Yes | FK → `projects` |
| 6 | `unitId` | string / null | Cond. | FK → `units` (μόνο αν scope = 'unit') |
| 7 | `exclusivity` | ExclusivityType | Yes | `exclusive` / `non_exclusive` / `semi_exclusive` |
| 8 | `commissionType` | CommissionType | Yes | `percentage` / `fixed` / `tiered` |
| 9 | `commissionPercentage` | number / null | Cond. | % προμήθειας (μόνο αν type = percentage) |
| 10 | `commissionFixedAmount` | number / null | Cond. | Σταθερό ποσό (μόνο αν type = fixed) |
| 11 | `status` | BrokerageStatus | Yes | `active` / `expired` / `terminated` |
| 12 | `startDate` | string (ISO) | Yes | Ημ/νία έναρξης |
| 13 | `endDate` | string (ISO) / null | No | Ημ/νία λήξης (null = αόριστη) |
| 14 | `terminatedAt` | string (ISO) / null | No | Ημ/νία πρόωρου τερματισμού |
| 15 | `companyId` | string | Yes | Tenant isolation |
| 16 | `notes` | string / null | No | Σημειώσεις |
| 17 | `createdBy` | string | Yes | User ID δημιουργού |
| 18 | `createdAt` | string (ISO) | Yes | Audit |
| 19 | `updatedAt` | string (ISO) | Yes | Audit |

## 3B. Nested & Enums — BrokerageAgreement

### 3B.1 ExclusivityType (3 values)

| Τιμή | Περιγραφή |
|------|-----------|
| `exclusive` | Αποκλειστική — μόνο αυτός ο μεσίτης |
| `non_exclusive` | Μη αποκλειστική — πολλοί μεσίτες |
| `semi_exclusive` | Ημι-αποκλειστική — μεσίτης + ιδιοκτήτης |

### 3B.2 CommissionType (3 values)

| Τιμή | Περιγραφή |
|------|-----------|
| `percentage` | Ποσοστό επί τιμής πώλησης (π.χ. 2%) |
| `fixed` | Σταθερό ποσό (EUR) |
| `tiered` | Κλιμακωτό (Phase 2 — δεν υλοποιήθηκε ακόμα) |

### 3B.3 BrokerageStatus (3 states)

| Τιμή | Περιγραφή |
|------|-----------|
| `active` | Ενεργή σύμβαση |
| `expired` | Λήξη ημερομηνίας |
| `terminated` | Πρόωρος τερματισμός |

### 3B.4 Exclusivity Validation (Server-enforced)

| Τύπος | Πεδία | Περιγραφή |
|-------|-------|-----------|
| `ExclusivityValidationIssue` | severity, messageKey, messageParams, conflictingAgreementId, conflictingAgentName | Ένα ζήτημα |
| `ExclusivityValidationResult` | canProceed, issues[], excludedUnitIds[] | Αποτέλεσμα ελέγχου |

**Κανόνες Αποκλειστικότητας**:
- Project-level exclusive → ΔΕΝ επιτρέπεται άλλη σύμβαση (project ή unit) για ίδιο project
- Unit-level exclusive → ΔΕΝ επιτρέπεται άλλη σύμβαση (project ή unit) για ίδια μονάδα
- Non-exclusive → Πάντα OK (warning μόνο)

---

# ΟΝΤΟΤΗΤΑ 3: Commission Records (Εγγραφές Προμηθειών)

## 2C. Πλήρης Κατάλογος Πεδίων — CommissionRecord

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID |
| 2 | `brokerageAgreementId` | string | Yes | FK → `brokerage_agreements` |
| 3 | `agentContactId` | string | Yes | FK → `contacts` (μεσίτης) |
| 4 | `agentName` | string | Yes | Denormalized όνομα μεσίτη |
| 5 | `unitId` | string | Yes | FK → `units` (πωληθείσα μονάδα) |
| 6 | `projectId` | string | Yes | FK → `projects` |
| 7 | `buyerContactId` | string | Yes | FK → `contacts` (αγοραστής) |
| 8 | `salePrice` | number | Yes | Τιμή πώλησης (EUR) |
| 9 | `commissionAmount` | number | Yes | Ποσό προμήθειας (EUR, computed) |
| 10 | `commissionType` | CommissionType | Yes | Denormalized από agreement |
| 11 | `commissionPercentage` | number / null | Cond. | Denormalized % |
| 12 | `paymentStatus` | CommissionPaymentStatus | Yes | `pending` / `paid` / `cancelled` |
| 13 | `paidAt` | string (ISO) / null | Cond. | Ημ/νία πληρωμής (μόνο αν paid) |
| 14 | `companyId` | string | Yes | Tenant isolation |
| 15 | `createdBy` | string | Yes | User ID |
| 16 | `createdAt` | string (ISO) | Yes | Audit |
| 17 | `updatedAt` | string (ISO) | Yes | Audit |

## 3C. Enums & Logic — CommissionRecord

### 3C.1 CommissionPaymentStatus (3 states)

| Τιμή | Περιγραφή |
|------|-----------|
| `pending` | Σε αναμονή πληρωμής |
| `paid` | Πληρώθηκε |
| `cancelled` | Ακυρώθηκε |

### 3C.2 Commission Calculation (Pure Function)

```
calculateCommission(input):
  if type = 'percentage' → salePrice × (percentage / 100), στρογγυλοποίηση 2 δεκ.
  if type = 'fixed' → commissionFixedAmount
  else → 0
```

### 3C.3 Δημιουργία Commission — Κανόνας

- **ΔΕΝ** δημιουργείται αυτόματα — ο χρήστης επιλέγει μεσίτη στο **SellDialog**
- Πληρώνεται ΜΟΝΟ ο μεσίτης που έφερε τον αγοραστή
- **Immutable** μετά τη δημιουργία (μόνο paymentStatus αλλάζει)

---

## 4. Subcollections

Καμία από τις 3 οντότητες δεν έχει subcollections.

- Purchase Orders: embedded `items[]` + `attachments[]` (ΟΧΙ subcollections)
- Brokerage Agreements: flat document
- Commission Records: flat document

**Σχετικές root-level collections**:
- `purchase_order_counters` — atomic counter για sequential PO numbering
- `po_shares` — token-based share links (7-day expiry)

---

## 5. Σχέσεις με ΟΛΕΣ τις Οντότητες (Relationship Map)

### 5.1 Διάγραμμα Σχέσεων

```
                    ┌──────────────────┐
                    │  PURCHASE ORDER  │
                    │ (purchase_orders)│
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────┴─────┐        ┌────┴────┐         ┌─────┴─────┐
   │ projects │        │ contacts│         │accounting │
   │          │ ←──────│(supplier│         │_invoices  │
   │ buildings│        │)        │         │           │
   └──────────┘        └─────────┘         └───────────┘
                             │
                    ┌────────┴──────────┐
                    │                   │
              ┌─────┴──────┐    ┌──────┴──────┐
              │ BROKERAGE  │    │ COMMISSION  │
              │AGREEMENT   │    │  RECORD     │
              └─────┬──────┘    └──────┬──────┘
                    │                  │
        ┌───────────┼──────┐     ┌─────┼──────┐
        │           │      │     │     │      │
   ┌────┴──┐  ┌────┴──┐ ┌─┴──┐ ┌┴───┐ │  ┌───┴───┐
   │project│  │contact │ │unit│ │unit│ │  │contact│
   │       │  │(agent) │ │    │ │    │ │  │(buyer)│
   └───────┘  └────────┘ └────┘ └────┘ │  └───────┘
                                        │
                                   ┌────┴──────┐
                                   │ brokerage │
                                   │ agreement │
                                   └───────────┘
```

### 5.2 Αναλυτικός Πίνακας Σχέσεων — Purchase Orders

| # | Collection | Πεδίο σύνδεσης | Σχέση | Περιγραφή |
|---|------------|----------------|-------|-----------|
| 1 | **projects** | `po.projectId` | N:1 | PO ανήκει σε project (REQUIRED) |
| 2 | **buildings** | `po.buildingId` | N:1 | PO σχετίζεται με building (optional) |
| 3 | **contacts** (supplier) | `po.supplierId` | N:1 | Προμηθευτής (supplier persona, REQUIRED) |
| 4 | **accounting_invoices** | `po.linkedInvoiceIds[]` | N:M | Συνδεδεμένα τιμολόγια (PO-invoice matching) |
| 5 | **boq_items** | `items[].boqItemId` | N:M | Line-level BOQ link (via ΑΤΟΕ codes) |
| 6 | **contacts** (createdBy) | `po.createdBy` | N:1 | User που δημιούργησε |
| 7 | **contacts** (approvedBy) | `po.approvedBy` | N:1 | User που ενέκρινε |

### 5.3 Αναλυτικός Πίνακας Σχέσεων — Brokerage Agreements

| # | Collection | Πεδίο σύνδεσης | Σχέση | Περιγραφή |
|---|------------|----------------|-------|-----------|
| 1 | **projects** | `agreement.projectId` | N:1 | Σε ποιο έργο (REQUIRED) |
| 2 | **units** | `agreement.unitId` | N:1 | Σε ποια μονάδα (μόνο αν scope='unit') |
| 3 | **contacts** (agent) | `agreement.agentContactId` | N:1 | Μεσίτης (real_estate_agent persona) |
| 4 | **commission_records** | `record.brokerageAgreementId` | 1:N | Προμήθειες κάτω από αυτή τη σύμβαση |

### 5.4 Αναλυτικός Πίνακας Σχέσεων — Commission Records

| # | Collection | Πεδίο σύνδεσης | Σχέση | Περιγραφή |
|---|------------|----------------|-------|-----------|
| 1 | **brokerage_agreements** | `record.brokerageAgreementId` | N:1 | Από ποια σύμβαση |
| 2 | **contacts** (agent) | `record.agentContactId` | N:1 | Μεσίτης |
| 3 | **contacts** (buyer) | `record.buyerContactId` | N:1 | Αγοραστής |
| 4 | **units** | `record.unitId` | N:1 | Πωληθείσα μονάδα |
| 5 | **projects** | `record.projectId` | N:1 | Σε ποιο έργο |
| 6 | **legal_contracts** | (derived: same unit + buyer) | N:1 | Σχετικό συμβόλαιο |

---

## 6. Report Builder Impact

### 6.1 Domain C6 (Παραγγελίες) — Tier 1 Columns

**Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Αρ. Παραγγελίας | `poNumber` | text | PO-NNNN |
| Έργο | `projectId` → join project.name | text | Cross-join |
| Κτίριο | `buildingId` → join building.name | text | Optional |
| Προμηθευτής | `supplierId` → join contact.displayName | text | |
| Status | `status` | enum | 7 values |
| Υποσύνολο | `subtotal` | currency | |
| ΦΠΑ % | `taxRate` | number | 24/13/6/0 |
| Ποσό ΦΠΑ | `taxAmount` | currency | |
| Σύνολο | `total` | currency | |
| Ημ/νία Δημιουργίας | `dateCreated` | date | |
| Ημ/νία Ανάγκης | `dateNeeded` | date | |
| Ημ/νία Παραγγελίας | `dateOrdered` | date | |
| Ημ/νία Παραλαβής | `dateDelivered` | date | |
| Ημ/νία Τιμολόγησης | `dateInvoiced` | date | |
| Δ/νση Παράδοσης | `deliveryAddress` | text | |
| Ημέρες Πληρωμής | `paymentTermsDays` | number | |
| Λήξη Πληρωμής | `paymentDueDate` | date | |
| Σημειώσεις Προμ. | `supplierNotes` | text | |
| Λόγος Ακύρωσης | `cancellationReason` | enum | 7 values |
| Δημιουργός | `createdBy` | text | |
| Εγκρίνων | `approvedBy` | text | |

**Computed/Joined columns:**

| Στήλη | Join | Τύπος | Σημείωση |
|-------|------|-------|----------|
| Αρ. Ειδών | COUNT items[] | number | |
| Συν. Ποσ. Παραγγελίας | SUM items[].quantity | number | |
| Συν. Ποσ. Παραληφθ. | SUM items[].quantityReceived | number | |
| % Παράδοσης | received/ordered × 100 | number | |
| Αρ. Τιμολογίων | COUNT linkedInvoiceIds | number | |
| Αρ. Συνημμένων | COUNT attachments | number | |
| Ηλικία PO (ημέρες) | NOW − dateCreated | number | Aging |
| Overdue | paymentDueDate < NOW && unpaid | boolean | |

### 6.2 Domain C4 (Μεσιτικές) — Tier 1 Columns

**Primary columns:**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Μεσίτης | `agentName` | text |
| Έργο | `projectId` → join project.name | text |
| Μονάδα | `unitId` → join unit.code | text |
| Scope | `scope` | enum |
| Αποκλειστικότητα | `exclusivity` | enum |
| Τύπος Προμήθειας | `commissionType` | enum |
| % Προμήθειας | `commissionPercentage` | number |
| Σταθ. Ποσό | `commissionFixedAmount` | currency |
| Status | `status` | enum |
| Έναρξη | `startDate` | date |
| Λήξη | `endDate` | date |
| Τερματισμός | `terminatedAt` | date |

**Computed/Joined columns:**

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Αρ. Πωλήσεων | COUNT commission_records WHERE agreementId | number |
| Σύν. Προμηθειών | SUM commission_records.commissionAmount | currency |
| Ενεργές Ημέρες | NOW − startDate (ή endDate − startDate) | number |

### 6.3 Domain C5 (Προμήθειες) — Tier 1 Columns

**Primary columns:**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Μεσίτης | `agentName` | text |
| Αγοραστής | `buyerContactId` → join contact.displayName | text |
| Έργο | `projectId` → join project.name | text |
| Μονάδα | `unitId` → join unit.code | text |
| Τιμή Πώλησης | `salePrice` | currency |
| Ποσό Προμήθειας | `commissionAmount` | currency |
| Τύπος | `commissionType` | enum |
| % | `commissionPercentage` | number |
| Status Πληρωμής | `paymentStatus` | enum |
| Ημ/νία Πληρωμής | `paidAt` | date |
| Ημ/νία Δημιουργίας | `createdAt` | date |

**Computed/Joined columns:**

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Σύμβαση | `brokerageAgreementId` → join agreement details | text |
| % επί Πώλησης | commissionAmount / salePrice × 100 | number |

### 6.4 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

| Οντότητα | Array | Πεδία ανά row | Μέγιστο πλήθος |
|----------|-------|---------------|----------------|
| PurchaseOrder | `items[]` | description, quantity, unit, unitPrice, total, categoryCode, quantityReceived, quantityRemaining | ~30 |
| PurchaseOrder | `attachments[]` | fileName, fileSize, mimeType, uploadedBy, uploadedAt | 5 |
| PurchaseOrder | `linkedInvoiceIds[]` | invoiceId (+ join invoice details) | ~10 |

### 6.5 Tier 3 (Card PDF) — Purchase Order

```
┌─────────────────────────────────────────────────────┐
│ [LOGO] ΠΑΡΑΓΓΕΛΙΑ: {poNumber}                       │
│        Έργο: {projectName} | Status: {status}       │
├─────────────────────────────────────────────────────┤
│ ΠΡΟΜΗΘΕΥΤΗΣ                                          │
│ {supplierName} | Τηλ | Email                        │
├─────────────────────────────────────────────────────┤
│ ΗΜΕΡΟΜΗΝΙΕΣ                                          │
│ Δημιουργία: {dateCreated} | Ανάγκη: {dateNeeded}    │
│ Παραγγελία: {dateOrdered} | Παραλαβή: {dateDelivered}│
├─────────────────────────────────────────────────────┤
│ ΕΙΔΗ ΠΑΡΑΓΓΕΛΙΑΣ                                     │
│ [πίνακας items: Περιγραφή, Ποσ., Μονάδα, Τιμή, Σύν.]│
│ Υποσύνολο: {subtotal}EUR                            │
│ ΦΠΑ {taxRate}%: {taxAmount}EUR                      │
│ ΣΥΝΟΛΟ: {total}EUR                                  │
├─────────────────────────────────────────────────────┤
│ ΠΑΡΑΔΟΣΗ                                             │
│ % Παράδοσης: {deliveryPercentage}%                  │
│ [πίνακας: Είδος, Παραγγελθέν, Παραληφθέν, Υπόλοιπο]│
├─────────────────────────────────────────────────────┤
│ ΠΛΗΡΩΜΗ                                              │
│ Όροι: {paymentTermsDays} ημέρες | Λήξη: {dueDate}  │
│ Συνδεδεμένα Τιμολόγια: {linkedInvoiceIds.length}    │
├─────────────────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                                           │
│ Προμηθευτή: {supplierNotes}                         │
│ Εσωτερικές: {internalNotes}                         │
├─────────────────────────────────────────────────────┤
│ ΣΥΝΗΜΜΕΝΑ                                            │
│ [λίστα: fileName, fileSize]                         │
└─────────────────────────────────────────────────────┘
```

### 6.6 Tier 3 (Card PDF) — Brokerage Agreement

```
┌─────────────────────────────────────────────────────┐
│ [LOGO] ΜΕΣΙΤΙΚΗ ΣΥΜΒΑΣΗ                             │
│        Μεσίτης: {agentName} | Status: {status}      │
├─────────────────────────────────────────────────────┤
│ ΣΤΟΙΧΕΙΑ ΣΥΜΒΑΣΗΣ                                    │
│ Scope: {scope} | Αποκλ/τα: {exclusivity}            │
│ Τύπος Προμήθειας: {commissionType}                  │
│ % Προμ.: {commissionPercentage}% ή Fixed: {amount}  │
│ Έναρξη: {startDate} | Λήξη: {endDate}              │
├─────────────────────────────────────────────────────┤
│ ΕΡΓΟ / ΜΟΝΑΔΑ                                        │
│ Έργο: {projectName}                                 │
│ Μονάδα: {unitCode} (αν scope = unit)                │
├─────────────────────────────────────────────────────┤
│ ΠΡΟΜΗΘΕΙΕΣ (via commission_records)                  │
│ [πίνακας: Αγοραστής, Μονάδα, Τιμή, Προμήθεια, Status]│
│ Σύνολο Προμηθειών: {totalCommissions}EUR            │
├─────────────────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                                           │
│ {notes}                                             │
└─────────────────────────────────────────────────────┘
```

---

## 7. Στατιστικά

| Μέτρηση | Purchase Orders | Brokerage | Commission Records |
|---------|-----------------|-----------|-------------------|
| Direct fields | 31 | 19 | 17 |
| Nested array fields (items) | 10 per item | — | — |
| Nested array fields (attachments) | 7 per attachment | — | — |
| Enums | 4 (status, cancellation, vatRate, auditAction) | 3 (exclusivity, commission, status) | 2 (paymentStatus, commissionType) |
| Cross-entity references | 7 | 4 | 6 |
| FSM states | 7 | 3 | 3 |
| Permissions | 6 | — | — |
| Audit event types | 9 | — | — |
| **Σύνολο πεδίων** | **~55+** | **19** | **17** |

### Συνολικά SPEC-018

| Μέτρηση | Τιμή |
|---------|------|
| Οντότητες | 3 |
| Σύνολο πεδίων (direct) | 67 |
| Σύνολο nested fields | 17 (items) + 7 (attachments) = 24 |
| Σύνολο enums | 9 |
| Σύνολο cross-entity references | 17 |
| FSM states (σύνολο) | 13 |
| Computed types (metrics, matching, budget) | 7 |
| **Σύνολο πεδίων (πλήρες SPEC)** | **~90+** |
