# ADR-267: Lightweight Procurement Module — Purchase Orders & Material Tracking

**Status**: ✅ IMPLEMENTED — Phases A–E complete. 2026-04-16
**Date**: 2026-03-28
**Author**: Claude (Research Agents × 4)
**Related ADRs**: ADR-175 (BOQ/Quantity Surveying), ADR-034 (Gantt), ADR-017 (Enterprise ID), ADR-ACC-002 (Invoicing), ADR-121 (Contact Personas)

### Changelog
| Date | Changes |
|------|---------|
| 2026-03-28 | Initial research & architecture — DRAFT for review |
| 2026-03-28 | ✅ APPROVED — 41 ερωτήσεις Q&A με Γιώργο. Όλες οι αρχιτεκτονικές αποφάσεις κλείδωσαν |
| 2026-03-28 | 🚀 Phase A Implementation — Batches 1-6: Types, Enterprise IDs, Config, Repository, Service, API Routes, Hooks, UI Components (5 components), Pages, Navigation, i18n (el+en). ~22 νέα αρχεία, ~3.800 LOC |
| 2026-03-28 | 🚀 Phase B Implementation — Enhanced Integration: (1) SSOT registerGreekFont consolidation (7 duplicates → 1 module), (2) Entity audit trail integration (EntityAuditService.recordChange in all status transitions), (3) Notification system (3 procurement events: approval, approved, overdue), (4) PO PDF generator (bilingual EL/EN, jsPDF+autoTable), (5) PO Email service (Mailgun + PDF attachment), (6) Share link service (token-based, 7-day expiry, public API), (7) 4 new API routes (pdf, email, share, public), (8) PurchaseOrderActions component (PDF/Email/Share buttons), (9) ContactPurchaseOrdersTab (supplier POs in contact detail), (10) BOQRelatedPOs component, (11) Activity tab in PO detail (reuses ActivityTab SSOT), (12) Public share page (/shared/po/[token]). ~14 νέα αρχεία, ~1.700 LOC, 12+ modified |
| 2026-03-28 | 🚀 Phase C Implementation — Advanced Features: (1) AI Telegram PO creation — 3 new agentic tools (create_purchase_order, list_purchase_orders, get_purchase_order_status) + ProcurementHandler in ai-pipeline, (2) AI Invoice→PO auto-match — scoring algorithm (amount/date/items/description/reference, threshold 85pts), POST /api/procurement/invoice-match, suggestedPOId+poMatchConfidence on expense docs, (3) Supplier performance metrics — calculateSupplierMetrics+getSupplierComparison+getSupplierPriceTrend services, 2 API routes, useSupplierMetrics hook, SupplierMetricsCard+SupplierComparisonTable components. SSOT: PO_MATCHABLE_STATUSES, PO_COMMITTED_STATUSES, PO_MATCH_SCORING. ~9 νέα αρχεία, ~1.634 LOC, 5+ modified. |
| 2026-04-16 | 🚀 Phase D Implementation — Entity Selectors: Replaced 3 plain `<Input>` fields (projectId, supplierId, buildingId) with searchable `SearchableCombobox` selectors that load real Firestore data. New: `usePOSupplierContacts` hook (supplier contacts via `personaTypes array-contains`, ADR-300 cache), `POEntitySelectors.tsx` (POProjectSelector, POSupplierSelector, POBuildingSelector). Auto-fill delivery address from project.addresses[] (priority: delivery→site→legacy). Building selector filters by selected projectId. 4 new/modified files, 7 new i18n keys. |
| 2026-04-16 | 🚀 Phase E Implementation — Layout Unification (SSoT): Pagina `/procurement` allineata al pattern unificato di Contacts/Buildings. Nuovi: `procurementFiltersConfig` (AdvancedFiltersPanel SSoT), `procurementDashboardStats` (UnifiedDashboard SSoT), `ProcurementHeader`, `useProcurementPageState`. Modificati: `PurchaseOrderList` (+onSelectPO/selectedPOId/hideSearchBar), `ProcurementPageContent` (riscrittura con PageContainer+ListContainer+split panel). Route `/procurement/[poId]` invariata per deep-link. 4 nuovi + 4 modificati, 16 nuove chiavi i18n. |
| 2026-04-26 | 🔗 Extended for ADR-327 P5 — `sourceQuoteId` field + auto-generation from awarded quote. `PurchaseOrder.sourceQuoteId: string \| null` added to type + DTO. `CreatePurchaseOrderDTO.sourceQuoteId?: string \| null` added. `procurement-repository.ts` persists `sourceQuoteId` from DTO. `calculateSupplierMetrics()` unchanged — newly auto-generated `draft` POs naturally included in future supplier score computations (totalOrders bonus). No new collections, no new services in ADR-267 scope — consumer is `po-generation-service.ts` (ADR-327). |
| 2026-04-28 | 🧹 UX cleanup — Removed "Σάρωση Προσφοράς" button from `ProcurementHeader` (Παραγγελίες tab). Quote scan action belongs semantically to Προσφορές tab only (separation of concerns: PO ≠ Quote). Removed `onScanQuote` prop from `ProcurementHeaderProps`, dropped `ScanLine` import + `procurement.page.scanQuote` orphan i18n key (el+en). Also removed duplicate "Νέα Προσφορά" button inside `QuoteList` card header on `/procurement/quotes` (page header already exposes it — single owner). Files touched: `ProcurementHeader.tsx`, `ProcurementPageContent.tsx`, `QuotesPageContent.tsx`, `procurement.json` (el+en). |
| 2026-04-28 | 📍 **Delivery address by type — picker UX**: il campo `Διεύθυνση Παράδοσης` nel `PurchaseOrderForm` faceva solo auto-fill statico (priority `delivery → site → legacy`) la prima volta che si selezionava il progetto, senza modo di scegliere altri tipi di indirizzo (Είσοδος, Παράδοση, Νομική, Τιμολόγηση, ...). Aggiunto **`PODeliveryAddressField`** (`src/components/procurement/PODeliveryAddressField.tsx`, ~120 LOC): dropdown `Τύπος Διεύθυνσης` (popolato dai `PROJECT_ADDRESS_TYPES` presenti negli `addresses[]` del progetto selezionato) + input free-text. Selezione tipo → autofill indirizzo del progetto di quel tipo (preferendo `isPrimary` se >1). Opzione "— Καθαρισμός —" per svuotare il field. Disabled quando nessun progetto selezionato o il progetto non ha addresses. Reuse: `formatAddressType()`, `formatAddressLine()`, `useFirestoreProjects`. La logica priority esistente in `handleProjectSelect` resta come default al primo project select (backwards compat). i18n: 5 nuove keys procurement.json (el+en) `form.deliveryAddressType*`. Files: `PODeliveryAddressField.tsx` (NEW), `PurchaseOrderForm.tsx` (rimosso Input inline → componente), `procurement.json` (el+en). |
| 2026-04-28 | 🧩 **Phase G — PO Detail Header SSoT (parità con Επαφές)**: la pagina `/procurement` non esponeva un bottone "Νέα Παραγγελία" quando un PO era selezionato (il bottone era solo nell'`EmptyDetailState` quando nessun PO era scelto, identico problema risolto in Επαφές con `ContactDetailsHeader`). Aggiunto **`PurchaseOrderDetailsHeader`** (`src/components/procurement/PurchaseOrderDetailsHeader.tsx`, ~75 LOC) wrapper di `EntityDetailsHeader` (SSoT `@/core/entity-headers`) con stesso pattern di `ContactDetailsHeader`: icon=`Package`, title=`po.poNumber`, `titleAdornment` = status badge interattiva, `actions` derivate via `createEntityAction`: `new` (sempre visibile → `t('list.createPO')`), `edit` (solo se non cancelled/closed), `delete` (=cancel PO, solo se non già terminato). `PurchaseOrderDetail.tsx` aggiornato: rimossa la `<Card>{poNumber + Badge}` interna (ora la titolazione vive nell'header SSoT), rimossi import obsoleti (`Badge`, `getStatusColor`, `PO_STATUS_META`), aggiunto prop `onCreateNew`. `ProcurementPageContent.tsx` cabla `handleCreateNew → onCreateNew` su entrambi i mount (desktop split + mobile slide-in). Zero nuove chiavi i18n (riusa `list.createPO`, `detail.edit`, `detail.cancelPO`). Files: `PurchaseOrderDetailsHeader.tsx` (NEW), `PurchaseOrderDetail.tsx` (REFACTOR header), `ProcurementPageContent.tsx` (+`onCreateNew` prop wiring). |
| 2026-04-28 | 🎨 **Line items UX — ΑΤΟΕ first column + width fix**: in `PurchaseOrderItemsTable.tsx` la colonna `ΑΤΟΕ` (categoryCode) era ultima, costringendo il flusso "Περιγραφή → ΑΤΟΕ" che è inverso al ragionamento utente (prima la categoria, poi la descrizione). Spostata in **prima posizione** (ATOE | Περιγραφή | Ποσότητα | Μονάδα | Τιμή/Μον. | Σύνολο | delete). Fix larghezza dropdown: `<TableHead>` + `<TableCell>` ATOE → `min-w-[220px]` (prima `w-[140px]`, troncava labels tipo "ΟΙΚ-1 — Χωμ"); `<SelectContent>` → `min-w-[260px]` per labels complete tipo "ΟΙΚ-1 — Χωματουργικά". **SSoT cleanup**: rimosso array hardcoded `ATOE_CODES` locale, ora desktop+mobile usano entrambi `ATOE_MASTER_CATEGORIES` da `@/config/boq-categories` come single source per i 12 codici. Mobile aggiornato: ATOE come primo blocco a tutta larghezza (`w-full` invece di `w-[120px]`), label `t('items.category')` (era hardcoded `ΑΤΟΕ`), label dropdown via `t(\`categories.${code}\`)` invece di `c.nameEL` (i18n compliant, allineato a desktop). Files: `PurchaseOrderItemsTable.tsx`. |
| 2026-04-28 | 🧭 **Phase F — Sub-nav SSoT extraction**: Estratto `TabsNav` componente riusabile a livello dominio in `src/components/shared/TabsNav.tsx` (~70 LOC, props `tabs` + `i18nNamespace` + `ariaLabel`, supporta `exactMatch` e `excludeStartsWith` per logica match selettiva). `ProcurementSubNav` riscritto come wrapper sottile (~30 LOC, era 41 LOC, API esterna invariata — zero call-site changes). Tabs config: `[{href:'/procurement', exactMatch:true}, {href:'/procurement/quotes', excludeStartsWith:['/procurement/quotes/scan']}]`. **Bug fix correlato**: `ModuleBreadcrumb` non rendeva su `/procurement` e `/procurement/quotes` perché `procurement` e `quotes` non erano in `SEGMENT_CONFIG` → la funzione tornava `null` con zero items mappabili. Aggiunti 2 entries (icone `Package` arancio, `FileText` ambra) + 2 chiavi i18n `module.procurement` / `module.quotes` (el+en). Files: `src/components/shared/TabsNav.tsx` (NEW), `src/subapps/procurement/components/ProcurementSubNav.tsx` (REFACTOR), `src/components/shared/ModuleBreadcrumb.tsx` (+2 SEGMENT entries), `src/i18n/locales/{el,en}/navigation.json` (+2 keys). |

---

## 1. EXECUTIVE SUMMARY

Σήμερα οι παραγγελίες υλικών γίνονται με email/τηλέφωνο/Excel. Το Procurement module:
- Δημιουργεί **Purchase Orders** (PO) συνδεδεμένα με BOQ items + suppliers
- **6-state workflow**: `Draft → Approved → Ordered → Partially Delivered → Delivered → Closed`
- **Automatic delivery status** based on quantities received (Procore/SAP pattern)
- **7 KPI dashboard** + Budget vs Committed charts (Bar + Donut)
- **Bilingual PDF** export (EL/EN) + Excel Level 2 (formulas, conditional formatting)
- **Production-grade RBAC** (6 new permissions, reuse existing auth system)
- **Full audit trail** (9 events via existing `logAuditEvent()`)
- **Full responsive** (desktop + mobile — εργοτάξιο)
- Συνδέεται με: BOQ items (ΑΤΟΕ codes), contacts (supplier persona), accounting invoices
- **ΔΕΝ περιλαμβάνει**: RFQ/quotes, 3-way matching, recurring POs, delivery photos

### Αποφάσεις (41 Q&A — Γιώργος, 2026-03-28)

| # | Θέμα | Απόφαση |
|---|------|---------|
| 1 | Navigation | Standalone top-level (displayOrder: 55) |
| 2 | Status workflow | 6 states + partially_delivered (auto) |
| 3 | Approval | Feature flag: self-approve τώρα, separate approver αύριο |
| 4 | Scope | 1 PO = 1 project πάντα |
| 5 | ΦΠΑ | PO-level: 24/13/6/0% (ενδοκοινοτικές = 0%) |
| 6 | Units | Predefined dropdown (14 units) + "Άλλο" |
| 7 | PDF γλώσσα | Bilingual EL/EN, dropdown κατά export |
| 8 | Delivery address | Auto-fill από project, editable |
| 9 | BOQ integration | Optional link, ΑΤΟΕ mandatory |
| 10 | Partial deliveries | Auto status: 0%→ordered, 1-99%→partial, 100%→delivered |
| 11 | Currency | EUR only |
| 12 | KPIs | 7 cards (incl. partially delivered, awaiting invoice, monthly spend) |
| 13 | PO number | PO-NNNN sequential, no year reset |
| 14 | Items limit | Embedded array, τυπικά 1-10, max 30 |
| 15 | Notifications | In-app (Phase A) + Telegram (Phase B) |
| 16 | Quick-create supplier | Inline dialog (mandatory: επωνυμία only) |
| 17 | Duplicate PO | Button — copy all, edit ό,τι θες |
| 18 | Price history | Inline last price + trend + modal (Phase A) |
| 19 | Filters | Search + 4 quick filters (status, project, supplier, date) |
| 20 | Sorting | "Απαιτούν ενέργεια" pinned + chronological |
| 21 | Mobile | Full responsive (desktop + mobile) |
| 22 | Deletion | Soft delete only (SAP/Procore) |
| 23 | RBAC | 6 new permissions, production-grade |
| 24 | i18n | Full EL + EN |
| 25 | Audit trail | Full (9 events) |
| 26 | Cancellation | Mandatory dropdown reason (7 options) |
| 27 | Invoice linking | Manual link, Phase A |
| 28 | Charts | Bar + Donut (Phase A), Line (Phase B) |
| 29 | Phase C | AI scan, AI Telegram, Supplier metrics |
| 30 | Notes | 2 πεδία: supplier (PDF) + internal (hidden) |
| 31 | ΑΤΟΕ codes | Ίδιοι με BOQ/Gantt — μία γλώσσα παντού |
| 32 | Date needed | Προαιρετικό |
| 33 | Empty state | Onboarding (illustration + CTA) |
| 34 | Send PO | PDF + Copy text (Phase A), Email + Share link (Phase B) |
| 35 | Excel export | Level 2 Smart (2 sheets, formulas, conditional formatting) |
| 36 | PDF list export | A4 landscape |
| 37 | Attachments | Drag & drop, max 5 files / 10MB, Phase A |
| 38 | Payment terms | Auto-fill from supplier + auto-calc due date |
| 39 | T&C | Configurable, auto-include στο PDF footer |
| 40 | Company branding | Logo + company info στο PDF header (reuse existing) |
| 41 | Users | 5 άτομα, 2-3 δημιουργούν POs, οικογενειακή επιχ. |

**ΥΠΑΡΧΟΥΣΑ ΥΠΟΔΟΜΗ** (70% integration layer ready):
- BOQ items με `linkedContractorId` + `linkedInvoiceId`
- Supplier contacts (persona 'supplier', 5 κατηγορίες)
- Accounting invoices + expense documents
- Enterprise ID system (χρειάζεται νέος generator)
- Cheque registry (ήδη υποστηρίζει `ChequeContextType = 'supplier'`)
- RBAC system (40+ permissions, `withAuth()` middleware)
- Company config + logo + email templates
- Recharts, jspdf, jspdf-autotable (ήδη installed)

---

## 2. INDUSTRY RESEARCH (Buildertrend / CoConstruct / Fieldwire)

### 2.1 Τι κάνουν οι μικρές κατασκευαστικές εφαρμογές

| Feature | Buildertrend | CoConstruct | Fieldwire | Nestor Πρόταση |
|---------|-------------|-------------|-----------|---------------|
| PO CRUD | ✅ Full | ✅ Full | 🔶 Task-based | ✅ **Phase A** |
| Status Workflow | 7 states | 5 states | 5 states | ✅ **6 states (auto delivery)** |
| Line Items | ✅ + cost codes | ✅ + selections | Basic | ✅ **+ BOQ link + ΑΤΟΕ** |
| Budget Integration | ✅ Cost codes | ✅ Allowances | — | ✅ **Via BOQ + ΑΤΟΕ** |
| Supplier Link | ✅ Directory | ✅ Vendor list | ✅ | ✅ **Via contacts + quick-create** |
| Invoice Matching | ✅ PO↔Invoice | 🔶 Manual | — | ✅ **Phase A (manual)** |
| Delivery Photos | — | — | ✅ | ❌ **Απορρίφθηκε** |
| Email/Share PO | ✅ Auto-email | ✅ | — | 🔶 **Phase B** |
| PDF Export | ✅ | ✅ | — | ✅ **Phase A (bilingual)** |
| Excel Export | ✅ | 🔶 | — | ✅ **Phase A (Level 2)** |
| Attachments | ✅ | 🔶 | ✅ | ✅ **Phase A** |
| Price History | ✅ | — | — | ✅ **Phase A** |
| Approval Workflow | ✅ Multi-level | 🔶 Simple | — | ✅ **Feature flag (flexible)** |
| RFQ Process | ✅ | — | — | ❌ **Overkill** |
| 3-Way Matching | ✅ | — | — | ❌ **Overkill** |
| Recurring POs | ✅ | — | — | ❌ **Duplicate button αρκεί** |

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

/** PO Status — 6-state workflow (Procore/SAP pattern)
 *  Invoice linking = action (linkedInvoiceIds[]), ΟΧΙ status.
 *  Delivery status = AUTOMATIC based on quantities received.
 *  "Delivered without invoice" = KPI/filter στο dashboard.
 */
type PurchaseOrderStatus =
  | 'draft'                // Δημιουργήθηκε, δεν εγκρίθηκε ακόμα
  | 'approved'             // Εγκρίθηκε — έτοιμο για αποστολή
  | 'ordered'              // Στάλθηκε στον προμηθευτή (0% received)
  | 'partially_delivered'  // Μερική παραλαβή (1-99% received) — AUTO
  | 'delivered'            // Πλήρης παραλαβή (100% received) — AUTO
  | 'closed'               // Ολοκληρώθηκε
  | 'cancelled';           // Ακυρώθηκε

/** Purchase Order — Core Entity */
interface PurchaseOrder {
  id: string;                       // 'po_XXXXX' (enterprise-id)
  poNumber: string;                 // 'PO-0042' (sequential, no year reset)
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
  currency: 'EUR';                   // Πάντα EUR — ακόμα και ενδοκοινοτικοί (hardcoded)
  subtotal: number;
  taxRate: 24 | 13 | 6 | 0;         // PO-level ΦΠΑ: 24% default, 0% ενδοκοινοτικές
  taxAmount: number;
  total: number;

  // Dates
  dateCreated: string;              // ISO
  dateNeeded: string | null;        // Προαιρετικό — ο χρήστης ορίζει αν θέλει. Overdue KPI μόνο αν set
  dateOrdered: string | null;       // When sent to supplier
  dateDelivered: string | null;     // When received
  dateInvoiced: string | null;      // When invoice linked

  // Delivery
  deliveryAddress: string | null;   // Auto-fill από project.address, editable override

  // Payment Terms (auto-fill από supplier, editable per PO)
  paymentTermsDays: number | null;  // Auto-fill από supplier.paymentTermsDays
  paymentDueDate: string | null;    // Auto-calculated: dateOrdered + paymentTermsDays

  // Accounting Links
  linkedInvoiceIds: string[];       // ref → accounting_invoices (1:many)

  // Notes (Procore/Oracle pattern — 2 πεδία)
  supplierNotes: string | null;    // Εμφανίζεται στο PDF — ό,τι θέλεις να δει ο προμηθευτής
  internalNotes: string | null;    // ΔΕΝ εμφανίζεται στο PDF — εσωτερικά σχόλια

  // Attachments (Procore/Google pattern — Phase A)
  attachments: POAttachment[];     // Max 5 files, 10MB each

  // Cancellation (υποχρεωτικό αν status = cancelled)
  cancellationReason: POCancellationReason | null;
  cancellationComment: string | null;  // Προαιρετικό free text

  // Metadata
  createdBy: string;                // userId
  approvedBy: string | null;
  updatedAt: string;
  isDeleted: boolean;               // Soft delete ΜΟΝΟ — ποτέ hard delete (SAP/Procore pattern)
}

/** PO Attachment (Firebase Storage) */
interface POAttachment {
  id: string;              // 'poatt_XXXXX' (enterprise-id)
  fileName: string;
  fileSize: number;        // bytes
  mimeType: string;        // pdf, jpg, png, dxf, dwg, xlsx, docx
  storagePath: string;     // Firebase Storage: /purchase_orders/{poId}/attachments/{id}
  uploadedBy: string;      // userId
  uploadedAt: string;      // ISO
}
// Limits: Max 5 files, max 10MB each
// Allowed: PDF, JPG, PNG, DXF, DWG, XLSX, DOCX
// UI: Drag & drop + file picker, inline thumbnail for images, icon for docs

/** Cancellation Reasons (υποχρεωτικό dropdown + optional comment) */
type POCancellationReason =
  | 'supplier_change'    // Αλλαγή προμηθευτή
  | 'plan_change'        // Αλλαγή σχεδίου/scope
  | 'wrong_order'        // Λάθος παραγγελία
  | 'supplier_delay'     // Καθυστέρηση προμηθευτή
  | 'budget_cut'         // Περικοπή budget
  | 'duplicate'          // Διπλή παραγγελία
  | 'other';             // Άλλο

/** Purchase Order Line Item */
interface PurchaseOrderItem {
  id: string;                       // 'poi_XXXXX'
  description: string;
  quantity: number;
  unit: string;                     // Predefined dropdown + custom (see UNIT_OPTIONS)
  unitPrice: number;
  total: number;                    // quantity × unitPrice

  // BOQ Integration (optional link, categoryCode required)
  boqItemId: string | null;         // ref → boq_items (optional — search+select dropdown)
  categoryCode: string;             // ΑΤΟΕ code (OIK-1...OIK-12) — ΥΠΟΧΡΕΩΤΙΚΟ
                                    // Auto-fill αν linked BOQ item, αλλιώς manual dropdown
                                    // Ίδιοι κωδικοί με BOQ + Gantt → μία γλώσσα παντού

  // Delivery Tracking — Partial deliveries (ΣΥΧΝΟ στην πράξη)
  quantityReceived: number;         // Συνολικά παραληφθέντα (default: 0)
  quantityRemaining: number;        // quantity - quantityReceived (computed)
}
```

### 4.2 Procurement Settings (Feature Flags)

```typescript
// Firestore: settings/{companyId}/modules/procurement
interface ProcurementSettings {
  requireSeparateApprover: boolean;    // false = self-approve OK (default)
  autoApproveThreshold: number | null; // null = no auto-approve (default)
  termsAndConditions: string | null;   // Standard T&C — εμφανίζεται στο PDF footer
}

// Defaults (Phase A)
const PROCUREMENT_DEFAULTS: ProcurementSettings = {
  requireSeparateApprover: false,
  autoApproveThreshold: null,
};
```

### 4.3 Status State Machine

```
                    ┌────────── CANCELLED ──────────┐
                    │                               │
DRAFT ──→ APPROVED ──→ ORDERED ──→ PART_DELIVERED ──→ DELIVERED ──→ CLOSED
  │         │           │    ↑         │                │
  └─cancel──┘──cancel───┘    └─────────┘ (more deliv.)  │
                             (auto: 1-99%)  (auto: 100%) │
                                                         └── CLOSED
```

**Απόφαση**: ✅ 6 states — automatic delivery status (Γιώργος, 2026-03-28)
- `partially_delivered` + `delivered` = **AUTOMATIC** based on quantities
- Χρήστης καταγράφει ποσότητες → σύστημα αλλάζει status αυτόματα
- 0% received → `ordered` | 1-99% → `partially_delivered` | 100% → `delivered`
- Invoice linking = action (`linkedInvoiceIds[]`), ΟΧΙ status
- "Delivered χωρίς τιμολόγιο" = KPI/filter στο dashboard
- 2-3 άτομα δημιουργούν POs → APPROVED step απαραίτητο

**Approval Model**: ✅ Feature Flag (Γιώργος, 2026-03-28)
- **Τώρα**: Self-approve επιτρέπεται (οικογενειακή επιχ., ρόλοι αλληλοεπικαλύπτονται)
- **Αύριο**: Setting `requireSeparateApprover: true` → ο δημιουργός δεν εγκρίνει το δικό του
- **Optional**: `autoApproveThreshold: number | null` → POs κάτω από ποσό = auto-approve

**Allowed Transitions**:
| From | To | Trigger |
|------|----|---------|
| draft | approved | User εγκρίνει (self-approve OK τώρα) |
| draft | cancelled | User ακυρώνει |
| approved | ordered | User σημειώνει ως σταλμένο |
| approved | cancelled | User ακυρώνει |
| ordered | partially_delivered | **AUTO**: πρώτη καταγραφή ποσοτήτων (1-99%) |
| ordered | delivered | **AUTO**: καταγραφή ποσοτήτων = 100% |
| ordered | cancelled | User ακυρώνει (πριν παραλαβή) |
| partially_delivered | partially_delivered | **AUTO**: νέα καταγραφή, ακόμα <100% |
| partially_delivered | delivered | **AUTO**: τελική καταγραφή = 100% |
| delivered | closed | Manual close (με ή χωρίς linked invoice) |

### 4.3 File Structure

```
src/
├── types/procurement/
│   └── purchase-order.ts                      # Types + status FSM + POAttachment + POCancellationReason
├── config/
│   └── procurement-units.ts                   # PROCUREMENT_UNIT_OPTIONS (14 units + custom)
├── services/procurement/
│   ├── procurement-repository.ts              # Firestore CRUD + counter + attachments
│   ├── procurement-service.ts                 # Business logic, validation, auto status
│   ├── procurement-pdf.service.ts             # PO PDF + list PDF (bilingual)
│   └── procurement-excel.service.ts           # Excel Level 2 export (2 sheets)
├── app/
│   ├── api/procurement/
│   │   ├── route.ts                          # GET list, POST create
│   │   └── [poId]/
│   │       ├── route.ts                      # GET one, PATCH update, DELETE
│   │       └── attachments/
│   │           └── route.ts                  # POST upload, DELETE attachment
│   └── procurement/
│       ├── page.tsx                           # Dashboard / list page
│       └── [poId]/
│           └── page.tsx                       # PO detail / edit page
├── components/procurement/
│   ├── PurchaseOrderList.tsx                  # List with "Requires Action" + filters
│   ├── PurchaseOrderForm.tsx                  # Create / edit form
│   ├── PurchaseOrderDetail.tsx                # Read-only view + status actions
│   ├── PurchaseOrderKPIs.tsx                  # 7 KPI dashboard cards
│   ├── PurchaseOrderItemsTable.tsx            # Line items + price history inline
│   ├── ProcurementBudgetOverview.tsx          # Bar chart + Donut chart
│   ├── PriceHistoryModal.tsx                  # Full price history per item
│   ├── QuickCreateSupplierDialog.tsx          # Inline supplier creation
│   ├── DeliveryRecordDialog.tsx               # Record partial delivery quantities
│   ├── CancellationDialog.tsx                 # Cancel PO with mandatory reason
│   └── AttachmentsSection.tsx                 # Drag & drop file upload
├── hooks/procurement/
│   ├── usePurchaseOrders.ts                   # List hook with filters + search
│   └── usePurchaseOrderForm.ts                # Form state + validation
├── i18n/locales/
│   ├── el/procurement.json                    # Greek translations
│   └── en/procurement.json                    # English translations
```

**Εκτίμηση**: ~22 νέα αρχεία, ~3.800 LOC.

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

**Απόφαση**: ✅ **Standalone top-level module** (Γιώργος, 2026-03-28)

```
Sidebar
├── ...existing items...
├── Procurement (ShoppingCart icon, displayOrder: 55)
│   ├── Purchase Orders       /procurement
│   └── Budget Overview       /procurement/budget
```

**Σκεπτικό**: Enterprise pattern (Procore, Oracle Primavera, SAP). Procurement είναι cross-cutting domain (BOQ + Accounting + Contacts), όχι sub-feature του Construction. Επιτρέπει πρόσβαση σε CFO/λογιστή χωρίς να μπει σε Construction section.

---

## 5. INTEGRATION POINTS (SSoT)

### 5.1 BOQ ↔ Procurement

**Απόφαση**: ✅ Optional BOQ link + mandatory categoryCode (Γιώργος, 2026-03-28)
**Pattern**: Procore/SAP — optional link, αλλά πάντα κατηγοριοποίηση για reports.

- `boqItemId`: Optional — search+select dropdown αν υπάρχει BOQ item
- `categoryCode`: **ΥΠΟΧΡΕΩΤΙΚΟ** (ΑΤΟΕ) — reports/budget overview δουλεύουν πάντα
- Αν item δεν έχει BOQ link → subtle κίτρινο dot indicator (nudge, όχι blocker)
- Dashboard: Budget overview per category + ξεχωριστή γραμμή "Unlinked / Ad-hoc"
- **Budget flow**: Budget (BOQ estimated) → Committed (POs ordered) → Spent (Invoices) → Remaining

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

**Quick-create supplier** (Απόφαση ✅ Γιώργος, 2026-03-28 — Procore/Google pattern):
- Searchable dropdown + "➕ Προσθήκη νέου προμηθευτή" link
- Click → Dialog με minimal fields:
  - **Mandatory**: Επωνυμία
  - **Optional**: ΑΦΜ, Τηλέφωνο, Κατηγορία (materials/equipment/subcontractor/services/other)
- Δημιουργεί contact με `persona: 'supplier'` → auto-select στο dropdown
- Υπόλοιπα στοιχεία συμπληρώνονται αργότερα στις Επαφές

**Reverse Link**: Contact detail page → tab/section "Purchase Orders" (all POs for this supplier).

### 5.3 Accounting ↔ Procurement

**Phase A** (Απόφαση ✅ Γιώργος, 2026-03-28 — MVP feature, Procore/SAP pattern):
| Accounting Entity | Procurement Link | Direction | Phase |
|-------------------|-----------------|-----------|-------|
| Expense Invoice | Manual link: button → dropdown → select | PO → Invoice | **A** |

**Phase B+C:**
| Accounting Entity | Procurement Link | Direction | Phase |
|-------------------|-----------------|-----------|-------|
| Expense Document (AI) | Auto-suggest PO matching | Invoice → PO | C |
| Journal Entry | Auto-generated on PO close | PO → Journal | B |
| Cheque | `contextType: 'supplier'` + poId | PO → Cheque | B |
| Bank Transaction | Matching via supplier + amount | Transaction → PO | B |

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
| `logAuditEvent()` | Full audit trail (see below) |
| Enterprise ID: `generatePurchaseOrderId()` | New generator needed |
| `getAdminFirestore()` | Server-side Firestore SDK |
| i18n: `useTranslation('procurement')` | New namespace (el + en) |
| `formatCurrency()` | Money display |
| `formatDateShort()` | Date display |
| `cn()` | Class merging |

### 6.4 Audit Trail Events (Απόφαση ✅ Γιώργος, 2026-03-28 — Full audit, production-grade)

Χρήση υπάρχοντος `logAuditEvent()` — μηδέν νέα infra.

| Event | Action | Τι καταγράφεται |
|-------|--------|----------------|
| PO created | `procurement.po.created` | Ποιος, πότε, supplier, project, items, total |
| PO approved | `procurement.po.approved` | Ποιος ενέκρινε, πότε |
| PO ordered | `procurement.po.ordered` | Ποιος σημείωσε αποστολή, πότε |
| Status changed | `procurement.po.status_changed` | Από τι → σε τι, ποιος, πότε |
| Items edited | `procurement.po.items_edited` | Τι άλλαξε (ποσότητα, τιμή, added/removed) |
| PO cancelled | `procurement.po.cancelled` | Ποιος, πότε, reason |
| PO soft deleted | `procurement.po.deleted` | Ποιος, πότε |
| Delivery recorded | `procurement.po.delivery_recorded` | Ποιος κατέγραψε, ποσότητες ανά item |
| Invoice linked | `procurement.po.invoice_linked` | Ποιος, ποιο invoice ID |

---

## 7. PO NUMBER FORMAT

**Απόφαση**: ✅ Συνεχής αρίθμηση `PO-NNNN` (Γιώργος, 2026-03-28)

**Pattern**: `PO-{NNNN}` — sequential, no year reset, no project prefix
**Examples**: `PO-0001`, `PO-0042`, `PO-0999`, `PO-10000`

**Σκεπτικό**: Procore/SAP/Google pattern. Ο αριθμός = μοναδικό ID. Year + Project = searchable fields στο UI, όχι μέρος του αριθμού. Ποτέ confusion, ποτέ duplicate.

**Implementation**: Counter document στο Firestore:
```typescript
// purchase_order_counters/{companyId}
{ lastNumber: 42 }
```

Atomic increment via `FieldValue.increment(1)` → race-condition safe.

---

## 8. UNIT OF MEASURE — PREDEFINED LIST

**Απόφαση**: ✅ Predefined dropdown + "Άλλο" (Γιώργος, 2026-03-28)
**Pattern**: Procore/SAP — strict dropdown για consistency, extensible via custom entry.

```typescript
// src/config/procurement-units.ts
const PROCUREMENT_UNIT_OPTIONS = [
  { value: 'τεμ',  label: 'Τεμάχιο' },
  { value: 'm',    label: 'Μέτρο' },
  { value: 'm²',   label: 'Τετραγωνικό μέτρο' },
  { value: 'm³',   label: 'Κυβικό μέτρο' },
  { value: 'kg',   label: 'Κιλό' },
  { value: 'ton',  label: 'Τόνος' },
  { value: 'lt',   label: 'Λίτρο' },
  { value: 'σακ',  label: 'Σακί' },
  { value: 'κουτ', label: 'Κουτί' },
  { value: 'παλ',  label: 'Παλέτα' },
  { value: 'ρολ',  label: 'Ρολό' },
  { value: 'ζεύγ', label: 'Ζεύγος' },
  { value: 'δοχ',  label: 'Δοχείο' },
  { value: 'σετ',  label: 'Σετ' },
] as const;
```

- **"Άλλο"** option: free text input, αποθηκεύεται και γίνεται διαθέσιμο σε μελλοντικά POs
- **Γιατί**: Aggregation/reports σπάνε αν "τεμ" vs "τεμάχια" vs "TEM" — strict dropdown = consistency

---

## 9. DASHBOARD SPECIFICATIONS

### 9.1 KPI Cards (7 cards)

**Απόφαση**: ✅ 7 KPIs (Γιώργος, 2026-03-28)

| # | KPI | Υπολογισμός | Icon |
|---|-----|-------------|------|
| 1 | Active POs | COUNT WHERE status IN (ordered, partially_delivered, delivered) | Package |
| 2 | Pending Delivery | COUNT WHERE status = 'ordered' | Truck |
| 3 | Total Committed | SUM(po.total) WHERE status IN (ordered, partially_delivered, delivered) | DollarSign |
| 4 | Overdue Deliveries | COUNT WHERE dateNeeded < today AND status IN ('ordered', 'partially_delivered') | AlertTriangle |
| 5 | Partially Delivered | COUNT WHERE status = 'partially_delivered' | PackageOpen |
| 6 | Awaiting Invoice | COUNT WHERE status = 'delivered' AND linkedInvoiceIds = [] | FileWarning |
| 7 | Monthly Spend | SUM(po.total) WHERE dateOrdered IN current month | TrendingUp |

### 9.2 Responsive Design (Απόφαση ✅ Γιώργος, 2026-03-28)

**Χρήση**: Desktop (γραφείο) + Mobile (εργοτάξιο) — και τα δύο.

| Component | Desktop | Mobile |
|-----------|---------|--------|
| KPI Cards | 4 columns row | 2×2 grid, swipeable |
| PO List | Full table | Card list (stacked) |
| PO Form | 2-column grid | Single column, stacked |
| Items Table | Full table | Collapsible cards per item |
| Filters | Horizontal bar | Collapsible "Φίλτρα" panel |
| Actions | Button row | Bottom sticky bar |
| PDF Export | Inline button | Full-width button |
| Price History modal | Side panel | Full-screen sheet |

**Mobile priorities** (εργοτάξιο use cases):
- Γρήγορη καταγραφή παραλαβής (ποσότητες received)
- Approval με 1 tap
- Βλέπω status PO χωρίς scroll

### 9.3 Price History (Απόφαση ✅ Γιώργος, 2026-03-28 — Phase A)

**Pattern**: Procore/SAP — inline last price + on-demand full history.

**Inline (στη φόρμα PO, κάτω από κάθε line item):**
```
Τσιμεντοσανίδα 12mm    [200] [τεμ] [€18.00]
                        ⬆ €15.00 → €18.00 (+20%) | Τελ. PO-0038, 15/01/2026
```

**Modal (click "Ιστορικό τιμών"):**
- Πίνακας: PO number, ημερομηνία, τιμή/μονάδα, ποσότητα
- Μέση τιμή + trend %/τρίμηνο
- Query: `WHERE supplierId == X AND item description LIKE Y ORDER BY dateCreated DESC LIMIT 5`

### 9.2 Budget vs Committed Charts (Απόφαση ✅ Γιώργος, 2026-03-28)

**Pattern**: Google "One chart, one question" + Procore layout.

**Phase A — 2 charts:**

**Chart 1: Stacked Bar** — "Πού πάνε τα λεφτά;"
- Recharts `<BarChart>` — stacked bars per ΑΤΟΕ category:
- **Budgeted** (gray) — from BOQ estimated costs
- **Committed** (blue) — from POs ordered/partially_delivered/delivered
- **Spent** (green) — from linked invoices
- **Remaining** (light gray) — budgeted - committed

**Chart 2: Donut** — "Πόσο % φάγαμε;"
- Recharts `<PieChart>` — συνολική κατανομή committed ανά ΑΤΟΕ category
- Quick glance σε 1 δευτερόλεπτο

**Phase B — 1 chart:**

**Chart 3: Line/S-Curve** — "Πώς πάμε σε σχέση με τον χρόνο;"
- Recharts `<LineChart>` — monthly spend trend
- Χρειάζεται 3+ μήνες data για να έχει νόημα

### 8.3 PO List View

**List Layout** (Απόφαση ✅ Γιώργος, 2026-03-28 — Google/Oracle hybrid):

**Section 1: "⚡ Απαιτούν ενέργεια"** (pinned, πάντα πάνω):
- Drafts pending approval
- Overdue POs (dateNeeded < today AND status IN ordered, partially_delivered)
- Partially delivered (items λείπουν)
- Εξαφανίζεται αν δεν υπάρχει pending action

**Section 2: "📋 Όλες οι παραγγελίες"** (dateCreated DESC):
- Πλήρης λίστα με φίλτρα

**Φίλτρα** (Απόφαση ✅ Γιώργος, 2026-03-28 — Google/Procore pattern: search + 4 quick filters):

| # | Φίλτρο | Τύπος | Use case |
|---|--------|-------|----------|
| 🔍 | Search | Free text | PO number, supplier name, item description |
| 1 | Status | Multi-select chips | "δείξε μόνο ordered" |
| 2 | Project | Dropdown | "τι τρέχει στη Γλυφάδα;" |
| 3 | Supplier | Dropdown | "τι παρήγγειλα από Παπαδόπουλο;" |
| 4 | Date range | Date picker | "POs τελευταίου τριμήνου" |

**Columns**:

| Column | Source | Sort/Filter |
|--------|--------|-------------|
| PO Number | poNumber | Sort ↑↓ |
| Supplier | supplierId → contact.name | Filter by supplier |
| Project | projectId → project.name | Filter by project |
| Status | status | Filter by status |
| Total | total (formatted) | Sort ↑↓ |
| Date Needed | dateNeeded | Sort ↑↓ |
| Date Created | dateCreated | Sort ↑↓ |
| Actions | Edit, View, Duplicate, Status change | — |

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
│ Supplier Notes: Παράδοση στο εργοτάξιο, 8-12 │
│ Internal Notes: Τσέκαρε ποιότητα παραλαβής   │
│ Created: 28/03/2026 by Γιώργος               │
│                                               │
│ [Mark Delivered] [Link Invoice] [Export PDF]  │
│ [Duplicate PO] [Copy Text] [Edit] [Cancel PO]  │
└──────────────────────────────────────────────┘
```

---

## 9. PDF EXPORT

**Pattern**: Reuse jspdf + jspdf-autotable (same as accounting invoices).

**Απόφαση**: ✅ Bilingual PDF — Ελληνικά + Αγγλικά (Γιώργος, 2026-03-28)
- Ενδοκοινοτικοί προμηθευτές → αγγλικό PDF
- Έλληνες προμηθευτές → ελληνικό PDF
- Γλώσσα επιλέγεται κατά το export (dropdown: EL / EN)

**Layout** (A4 portrait):
1. **Header**: Company logo (`public/images/logo-email.svg`) + name, ΑΦΜ, ΓΕΜΗ, address, phone (from `company-config.ts`)
2. **PO info**: PO number, date, status
3. **Supplier info**: Name, VAT, address, phone, category
4. **Line items table**: Description, Qty, Unit, Price, Total
5. **Totals**: Subtotal, Tax rate + amount, Grand Total
6. **Payment terms**: "Όροι πληρωμής: 30 ημέρες | Πληρωτέο έως: DD/MM/YYYY"
7. **Supplier notes**: Σημειώσεις προμηθευτή
8. **Delivery**: Address + date needed
9. **Terms & Conditions**: From ProcurementSettings (configurable by admin)
10. **Footer**: "Powered by Nestor App" (ίδιο branding με email templates)

**Reuse existing assets:**
- Logo: `public/images/logo-email.svg` (120x120px)
- Company info: `src/config/company-config.ts` (name, VAT, GEMI, address)
- Footer branding: Ίδιο pattern με `src/services/email-templates.service.ts`

**i18n PDF labels**:
| Field | EL | EN |
|-------|----|----|
| Αρ. Παραγγελίας | Αρ. Παραγγελίας | Purchase Order No. |
| Προμηθευτής | Προμηθευτής | Supplier |
| Περιγραφή | Περιγραφή | Description |
| Ποσότητα | Ποσότητα | Quantity |
| Τιμή Μονάδος | Τιμή Μονάδος | Unit Price |
| Σύνολο | Σύνολο | Total |
| Υποσύνολο | Υποσύνολο | Subtotal |
| ΦΠΑ | ΦΠΑ | VAT |
| Γενικό Σύνολο | Γενικό Σύνολο | Grand Total |
| Ημ. Παράδοσης | Ημ. Παράδοσης | Delivery Date |
| Σημειώσεις | Σημειώσεις | Notes |
| Όροι Πληρωμής | Όροι Πληρωμής | Payment Terms |
| Πληρωτέο έως | Πληρωτέο έως | Due Date |

**Greek font**: Reuse Roboto font data from `src/services/gantt-export/roboto-font-data.ts`.

### 9.1 Excel + PDF List Export (Απόφαση ✅ Γιώργος, 2026-03-28 — Procore Level 2)

**Library**: `xlsx` (SheetJS) — MIT license

**Excel export — 2 sheets:**

**Sheet 1: "Purchase Orders"**:
- Columns: PO#, Supplier, Project, Status, Subtotal, VAT, Total, Date Created, Date Needed
- `=SUM()` formula στο total row
- Auto-filters σε κάθε column
- Conditional formatting: overdue = κόκκινο background

**Sheet 2: "Budget Overview"**:
- Columns: ΑΤΟΕ Category, Budgeted, Committed, Spent, Remaining
- `Remaining = Budgeted - Committed` formula
- `=SUM()` totals row
- Conditional formatting: Remaining < 0 = κόκκινο, > 20% = πράσινο

**Formatting**: Headers bold, currency €, auto-width columns, date format DD/MM/YYYY

**PDF list export**:
- A4 landscape
- Same data as Excel Sheet 1 + Budget Overview
- jspdf + jspdf-autotable (reuse existing)

---

## 10. IMPLEMENTATION PHASES

### Phase A: Core PO CRUD (MVP)
**Εκτίμηση**: ~22 αρχεία, ~3.800 LOC

| # | Feature | LOC est. |
|---|---------|----------|
| 1 | Types: `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseOrderStatus`, `ProcurementSettings`, `POAttachment`, `POCancellationReason` | ~200 |
| 2 | Enterprise ID: `generatePurchaseOrderId()`, `generatePOItemId()`, `generatePOAttachmentId()` | ~30 |
| 3 | Firestore collection registration + procurement settings + indexes | ~50 |
| 4 | Repository: CRUD operations + counter + attachments | ~350 |
| 5 | Service: Business logic, validation, auto status transitions (partial delivery), price history query | ~400 |
| 6 | API routes: `/api/procurement/` (list, create) + `/api/procurement/[poId]` (get, update, delete, attachments) | ~300 |
| 7 | Hooks: `usePurchaseOrders()`, `usePurchaseOrderForm()` | ~250 |
| 8 | Components: List (with "Requires Action" section), Form, Detail, Items Table | ~600 |
| 9 | Dashboard: 7 KPIs + Budget Overview (Bar + Donut charts) | ~350 |
| 10 | Navigation: Standalone top-level (displayOrder: 55) | ~30 |
| 11 | i18n: Greek + English keys (procurement namespace) | ~150 |
| 12 | PDF export: Bilingual (EL/EN) PO document (company logo, T&C, payment terms) | ~300 |
| 13 | Copy to clipboard (plain text for WhatsApp/Viber) | ~40 |
| 14 | Excel export: Level 2 Smart (2 sheets, formulas, conditional formatting) | ~200 |
| 15 | PDF list export: A4 landscape | ~100 |
| 16 | Duplicate PO button | ~40 |
| 17 | Quick-create supplier (inline dialog) | ~150 |
| 18 | Price history: inline last price + trend + modal full history | ~200 |
| 19 | In-app notifications (bell icon + badge) | ~150 |
| 20 | Unit of measure: predefined dropdown + custom | ~50 |
| 21 | Attachments: drag & drop, Firebase Storage, max 5 files / 10MB | ~200 |
| 22 | RBAC: 6 new permissions + role mappings | ~60 |

### Phase B: Enhanced Integration
**Εκτίμηση**: ~8 αρχεία, ~1.200 LOC

1. Invoice matching: Link PO → accounting expense invoice
2. Status history subcollection (audit trail)
3. Contact detail page → "Purchase Orders" tab
4. BOQ detail → "Related POs" section
5. Send PO via Email (button → PDF στο email supplier)
6. Share link (read-only PO view, χωρίς login)
7. Telegram notifications (PO pending approval, overdue digest)

### Phase C: Advanced (Μελλοντικά)
**Απόφαση**: ✅ 3 features επιλέχθηκαν (Γιώργος, 2026-03-28)
**Εκτίμηση**: ~1.200 LOC

1. **AI scan supplier invoice → auto-match to PO** — Scan τιμολόγιο προμηθευτή, auto-suggest ποιο PO αφορά
2. **AI Telegram: "δημιούργησε PO για 200 τσιμεντοσανίδες στον Παπαδόπουλο"** — Voice/text command via existing pipeline
3. **Supplier performance metrics** — On-time %, price trend, avg delivery time, σύγκριση προμηθευτών

**Απορρίφθηκαν:**
- ~~Delivery photo verification~~ — Overkill για τώρα
- ~~Recurring POs~~ — Duplicate PO button αρκεί, οι παραγγελίες δεν είναι σταθερές μηνιαίες

---

## 11. FIRESTORE IMPACT

### Νέα Collection: `purchase_orders`

**Απόφαση**: ✅ Production-grade RBAC — reuse existing system (Γιώργος, 2026-03-28)

**Νέα Permissions** (προσθήκη στο `src/lib/auth/types.ts` PERMISSIONS registry):
```typescript
'procurement:po:read'           // Βλέπει POs
'procurement:po:create'         // Δημιουργεί PO (draft)
'procurement:po:approve'        // Εγκρίνει PO (draft → approved)
'procurement:po:cancel'         // Ακυρώνει PO
'procurement:po:delete'         // Soft delete PO
'procurement:po:read_internal'  // Βλέπει internal notes
```

**Role → Permission Mapping:**
| Permission | super_admin | company_admin | project_manager | site_manager | accountant | data_entry | vendor | viewer |
|-----------|:-----------:|:-------------:|:---------------:|:------------:|:----------:|:----------:|:------:|:------:|
| po:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| po:create | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| po:approve | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| po:cancel | ✅ | ✅ | ✅ | creator only | creator only | creator only | ❌ | ❌ |
| po:delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| po:read_internal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

**Security Rules** (production-grade):
```
match /purchase_orders/{poId} {
  allow read: if isAuthenticated() &&
    resource.data.companyId == request.auth.token.companyId &&
    hasPermission('procurement:po:read');
  allow create: if isAuthenticated() &&
    request.resource.data.companyId == request.auth.token.companyId &&
    hasPermission('procurement:po:create');
  allow update: if isAuthenticated() &&
    resource.data.companyId == request.auth.token.companyId &&
    (hasPermission('procurement:po:approve') ||
     resource.data.createdBy == request.auth.uid);
  allow delete: if false; // Soft delete only — via API
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
| Επαναλαμβανόμενες παραγγελίες | Manual re-entry | ✅ "Duplicate PO" button — copy items+supplier → edit ό,τι θες (qty, supplier, items) |
| Deletion policy | Data loss risk | ✅ Soft delete only (SAP/Procore). Drafts: "Διαγραφή"→hide. Ordered+: μόνο "Ακύρωση". Admin: φίλτρο "Εμφάνιση διαγραμμένων" |
| Suppliers not in contacts system | Can't create PO | ✅ Inline quick-create dialog (Procore/Google pattern) |

### 12.1 Notifications

**Απόφαση**: ✅ In-app + Telegram (Γιώργος, 2026-03-28)

**Phase A — In-app notifications (bell icon + badge)**:
| Event | Notification |
|-------|-------------|
| Νέο PO δημιουργήθηκε (draft) | ✅ badge counter |
| PO περιμένει approval | ✅ badge counter + highlight |
| PO εγκρίθηκε | ✅ |
| PO overdue (πέρασε dateNeeded) | ✅ |
| Μερική παραλαβή καταγράφηκε | ✅ |
| Πλήρης παραλαβή (100%) | ✅ |

**Phase B — Telegram notifications (reuse existing AI pipeline)**:
| Event | Telegram |
|-------|----------|
| PO περιμένει approval | ✅ στον approver: "🔔 Νέο PO-0042 (€3.200) περιμένει έγκριση" |
| PO overdue | ✅ daily digest |

---

## 13. TESTING STRATEGY

1. **Unit tests**: Status transitions, total calculations, PO number generation
2. **Integration**: API routes → Firestore CRUD → response validation
3. **UI**: Form validation, status badge colors, **full responsive layout (desktop + mobile)**
4. **Edge cases**: Empty PO, 100-item PO, cancelled PO, partial delivery

---

## 14. DECISION RECORD

| Ερώτημα | Απόφαση | Σκεπτικό |
|---------|---------|----------|
| Items: embedded array ή subcollection? | ✅ Embedded array | Τυπικό PO: 1-10 items, σπάνια 10-30. Πάντα read μαζί. Array = simpler + faster |
| Status: πόσα states; | ✅ 6 states (+ partially_delivered, χωρίς INVOICED) | Procore/SAP pattern. Delivery = auto based on qty. Invoice = action, όχι status |
| Navigation: under Construction ή standalone? | ✅ Standalone top-level (displayOrder: 55) | Enterprise pattern: Procore/SAP/Oracle — cross-cutting domain |
| Approval workflow? | ✅ Feature Flag: self-approve τώρα, separate approver αύριο | Οικογενειακή επιχ., ρόλοι αλληλοεπικαλύπτονται. Settings-driven flexibility |
| PO per building ή per project? | ✅ Per project (buildingId optional), πάντα 1 PO = 1 project | Γιώργος: κάθε PO ανήκει σε ένα project. Cross-project PO δεν χρειάζεται |
| Tax handling? | ✅ ΦΠΑ σε επίπεδο PO, default 24%, dropdown: 24%/13%/6%/0% | Ενδοκοινοτικές παραγγελίες = 0%. Πάντα ίδιο ΦΠΑ σε όλο το PO |
