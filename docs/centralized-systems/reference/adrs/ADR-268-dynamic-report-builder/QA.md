# ADR-268 Q&A Log

Χρονολογικό αρχείο ερωτήσεων & απαντήσεων κατά τον σχεδιασμό.

---

## Q1 (2026-03-29): Πόσα domains χρειάζονται;

**Ερώτηση**: Η εφαρμογή έχει εταιρείες, επαφές, έργα, κτίρια, ορόφους, μονάδες, parking, αποθήκες, προμηθευτές, αγοραστές, συμβολαιογράφους, δικηγόρους, εργάτες, μηχανικούς, τιμολόγια, εισπράξεις — πόσες αναφορές χρειάζονται;

**Απάντηση**: Χαρτογραφήθηκαν 68 Firestore collections. Αρχικά 10 domains → επεκτάθηκαν σε **20 domains** σε 6 groups (Ακίνητα, Άνθρωποι, Οικονομικά, Κατασκευή, CRM, Λογιστική). Βλ. SPEC-001-domains.md.

---

## Q2 (2026-03-29): Μπορεί να δώσει ΠΛΗΡΗ στοιχεία φυσικού προσώπου;

**Ερώτηση**: Μπορεί το σύστημα να απαντήσει "δώσε μου πλήρη στοιχεία όλων των φυσικών προσώπων — τα πάντα, όλες οι καρτέλες, όλα τα πεδία";

**Απάντηση**: **ΟΧΙ** με flat table μόνο. Μια επαφή έχει 50+ πεδία + πολλαπλά emails/phones/addresses + 9 persona tabs + σχέσεις + ιστορικό. Χρειάζεται **3-tier export approach** (βλ. SPEC-003-export.md):
- Tier 1: Flat table (primary values)
- Tier 2: Row repetition (Salesforce pattern)
- Tier 3: Contact Card PDF (Procore/Dynamics pattern)

---

## Q3 (2026-03-29): Τι κάνουν οι μεγάλοι κατασκευαστές;

**Ερώτηση**: Τι θα έκαναν οι μεγάλες κατασκευαστικές / software εταιρείες;

**Απάντηση**: Έρευνα σε Salesforce, SAP, Dynamics 365, Procore, Oracle, HubSpot, Zoho. Βλ. RESEARCH.md §2.5. Universal standard = flat table + row repetition. Premium = Contact Card PDF. Αποφασίστηκε 3-tier approach.

---

## Q4 (2026-03-29): ADR ή SPEC αρχεία;

**Ερώτηση**: Χρειαζόμαστε 1 ADR ή πολλά SPEC αρχεία;

**Απάντηση**: Split σε folder structure — ADR (απόφαση, compact) + RESEARCH (read-only) + 7 SPEC αρχεία (εξελισσόμενα) + QA (αυτό το αρχείο).

---

## Q5 (2026-03-29): Σύγκριση ADR-265 / ADR-266 / ADR-267 vs ADR-268 — Overlap Analysis

**Ερώτηση**: Τι overlap υπάρχει ανάμεσα στα ADR-265, 266, 267 και το ADR-268; Τι πρέπει να προστεθεί στο 268; Τι ήδη καλύπτεται;

### Απάντηση:

#### 1. ADR-265 (Enterprise Reports System) vs ADR-268

| Θέμα | ADR-265 | ADR-268 |
|------|---------|---------|
| **Τύπος** | Hardcoded dashboards (9 σελίδες) | Dynamic ad-hoc builder (1 σελίδα, ∞ reports) |
| **Layout** | Σταθερά KPIs + charts + tables ανά domain | Configurable στήλες, φίλτρα, grouping |
| **Domains** | 13 κατηγορίες αναφορών | 20 domains (πιο granular) |
| **Export** | PDF + Excel (Phase 2+) | 3-tier (flat + row repetition + contact card) |
| **Navigation** | `/reports/*` (9 sub-routes) | `/reports/builder` (1 route) |

**Σχέση**: ΣΥΜΠΛΗΡΩΜΑΤΙΚΑ, ΟΧΙ ΑΝΤΙΚΡΟΥΟΜΕΝΑ.
- ADR-265 = "Δώσε μου το dashboard Πωλήσεων" (προκαθορισμένο, με τάσεις & KPIs)
- ADR-268 = "Δώσε μου όλες τις μονάδες >100τμ στο Κορδελιό, grouped by status" (ad-hoc)
- **Reuse**: ADR-268 χρησιμοποιεί τα core components του ADR-265 (ReportKPIGrid, ReportTable, ReportChart, export engine)
- **ΔΕΝ χρειάζεται duplicate**: Η export infrastructure (jsPDF, ExcelJS, Greek font) υπάρχει ήδη

#### 2. ADR-266 (Gantt Construction Reports) vs ADR-268

| Θέμα | ADR-266 | ADR-268 D1-D4 |
|------|---------|----------------|
| **Scope** | Per-building construction analytics | Cross-building/cross-project queries |
| **Visualizations** | S-Curve, CPM, Delay Breakdown, Resource Histogram | Generic bar/pie charts |
| **Placement** | Tab μέσα στο Building Management | `/reports/builder` |
| **Δεδομένα** | Ίδια collections (phases, tasks, resources, BOQ) | Ίδια collections |

**Overlap**: Και τα δύο αφορούν construction data, ΑΛΛΑ:
- ADR-266 παρέχει **εξειδικευμένες visualizations** που ο generic builder ΔΕΝ μπορεί να αναπαράγει (S-Curve PV/EV/AC, Critical Path Method, Resource Histogram)
- ADR-268 προσθέτει **cross-building queries**: "δείξε μου ΟΛΕΣ τις καθυστερημένες φάσεις σε ΟΛΑ τα κτίρια" — αδύνατο στο ADR-266 (per-building)
- **ΑΠΟΦΑΣΗ**: ADR-266 = βαθιά ανάλυση ανά κτίριο, ADR-268 = cross-project queries. Παράλληλη ύπαρξη.

**Τι λείπει από ADR-268**: Αναφορά ότι τα construction_baselines & construction_resource_assignments (Phase C collections του ADR-266) υπάρχουν ήδη → SPEC-001 D3 τα καλύπτει ήδη σωστά.

#### 3. ADR-267 (Procurement Module) vs ADR-268

| Θέμα | ADR-267 | ADR-268 C6 |
|------|---------|------------|
| **Τύπος** | Full CRUD module (workflow, approvals, delivery) | Read-only queries & reporting |
| **KPIs** | 7 operational KPIs (Active POs, Pending, Overdue...) | Dynamic aggregations (COUNT, SUM, AVG) |
| **Budget charts** | Stacked bar + Donut (ΑΤΟΕ categories) | Generic bar/pie |
| **Actions** | Create, Approve, Cancel, Record Delivery, Email, Share | Κανένα — μόνο view & export |
| **Navigation** | `/procurement` (top-level, standalone) | `/reports/builder` → domain "Παραγγελίες" |

**Overlap**: PO listing/filtering υπάρχει και στα δύο, ΑΛΛΑ:
- ADR-267 = **operational** module (δημιουργία, workflow, status changes)
- ADR-268 C6 = **analytics** layer ("ποια POs ξεπέρασαν τον προϋπολογισμό cross-project;")
- **ΔΕΝ υπάρχει conflict**: Ο χρήστης πάει στο 267 για δουλειά, στο 268 για αναφορές

**Τι λείπει από ADR-268**: Τίποτα. Το SPEC-001 C6 ήδη αντιστοιχεί στα πεδία purchase_orders.

---

---

## Q6 (2026-03-29): Απαιτήσεις Output — On-Screen + PDF + Enterprise Excel + Charts παντού

**Ερώτηση (Γιώργος)**: Θέλω οι αναφορές να εμφανίζονται στην οθόνη, να εξάγονται σε PDF, να εξάγονται σε Excel enterprise (τύποι μεταξύ κελιών, πολλαπλές καρτέλες, πληρέστατα). Ό,τι μπορεί να γίνει chart, να γίνεται chart.

**Απάντηση**: Ενημερώθηκαν τα specs:

1. **On-screen**: Table + KPIs + Interactive Charts (bar/pie/line/area/stacked) — ο χρήστης επιλέγει τύπο chart
2. **PDF**: Branded A4 landscape — KPIs + chart (ως εικόνα via html-to-image) + auto-paginated table + footer
3. **Excel (Enterprise 4-sheet)**:
   - Sheet 1 "Σύνοψη": KPIs με τύπους (`=SUM`, `=AVERAGE`, `=COUNTA` κλπ) + embedded Excel chart
   - Sheet 2 "Δεδομένα": Detail table, auto-filters, freeze panes, conditional formatting, TOTALS row με τύπους
   - Sheet 3 "Ανάλυση": Grouped aggregations (`=COUNTIFS`, `=SUMIFS`, `=AVERAGEIFS`) + embedded chart + % column
   - Sheet 4 "Raw": Unformatted για Power BI / Tableau
4. **Charts παντού**: Ίδιο chart σε screen (recharts) → PDF (html-to-image) → Excel (ExcelJS addChart, native)

**Αρχεία που ενημερώθηκαν**: SPEC-003-export.md (v2.0), SPEC-004-ui-wireframes.md (v2.0)

---

## Q7 (2026-03-29): Branding — Λογότυπο εταιρείας στο header, Nestor App στο footer

**Ερώτηση (Γιώργος)**: Οι αναφορές θα έχουν λογότυπο και στοιχεία εταιρείας, στο footer το λογότυπο της Nestor App. Ήδη χρησιμοποιούμε branded HTML templates (reservation, sale, lawyer/notary assignment, accounting).

**Απάντηση**: Βρέθηκε πλήρης υπάρχουσα υποδομή branding — **ZERO νέος κώδικας branding**:

- **Company logo**: `public/images/pagonis-energo-logo.png` → PDF header + Excel Sheet 1
- **App logo**: `public/images/nestor-app-logo.png` → PDF footer
- **Brand colors**: `BRAND` object (navy #1E3A5F, accent #2563EB κλπ) — ήδη σε 6 email templates + 2 PDF templates
- **PDF pattern**: Reuse `HeaderFooterRenderer.ts` + `invoice-pdf-template.ts` layout
- **8 existing templates** ήδη χρησιμοποιούν αυτό το branding (reservation, sale, cancellation, professional assignment, accounting, PO, invoice PDF, APY certificate PDF)

Προστέθηκε Branding section στο SPEC-003-export.md με πλήρη αντιστοίχιση logos, colors, header/footer layout.

---

---

## Q9 (2026-03-29): Πλήρης χαρτογράφηση Φυσικών Προσώπων — ALL fields + ALL relationships

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση φυσικών προσώπων — ΟΧΙ μόνο τα πεδία, αλλά και τις σχέσεις αυτών με ΟΛΕΣ τις άλλες οντότητες. Αργότερα: νομικά πρόσωπα, δημόσιες υπηρεσίες.

**Απάντηση**: Δημιουργήθηκε SPEC-008-entity-mapping-individuals.md με:

- **8 sections**, **220+ πεδία**, βάσει πραγματικού κώδικα (`IndividualContact`, `PersonaData`, `ContactRelationship`)
- **48 direct fields** (personal, identity, tax, professional, ESCO, family, photos)
- **~40 nested array fields** (emails, phones, addresses, websites, social media)
- **9 persona types** με ~40 persona-specific fields
- **12 banking fields** (subcollection)
- **63 relationship types** + 65+ relationship fields
- **26 cross-entity references** (units, projects, payment_plans, legal_contracts, cheques, POs, CRM, κλπ)
- **Report Builder impact**: Tier 1 columns (22 flat + 13 computed), Tier 2 arrays (8), Tier 3 card layout
- **Persona → Data unlock mapping**: ποια persona ξεκλειδώνει ποια joined data

**Pending**: SPEC-009 (Νομικά Πρόσωπα), SPEC-010 (Δημόσιες Υπηρεσίες)

---

## Q8 (2026-03-29): ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ — SSoT, Zero Duplicates, Google-Level Code

**Εντολή Γιώργου**: Η εφαρμογή έχει πολλά κεντρικοποιημένα συστήματα. ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ: χρήση αυτών, zero duplicates, zero διάσπαρτος κώδικας, Google-level quality, Single Source of Truth (SSoT).

**Απάντηση**: Προστέθηκε νέο §6 στο ADR-268.md — **SSoT Centralized Systems Mapping** με 5 κατηγορίες:

1. **UI Layer** (9 systems): Radix Select, Design Tokens, 78+ hooks, Report Core components, Filter System, Search, Headers, Fullscreen
2. **Data Layer** (6 systems): Firestore Collections SSoT, Enterprise ID Service, Entity Page State, State Management, Persona System, Contact System
3. **Navigation & i18n** (3 systems): Smart Navigation Factory, Tabs Factory, i18n locales
4. **Export & Branding** (7 systems): PDF/Excel engines, HeaderFooterRenderer, Brand colors, Company/App logos, Greek font registration
5. **Infrastructure** (5 systems): API Routes, Firebase Auth, Auto-Save, Audit Trail, Alert Engine

**Σύνολο**: 30+ centralized systems χαρτογραφημένα + verification checklist 8 σημείων.

Κάθε πίνακας έχει στήλη **ΑΠΑΓΟΡΕΥΕΤΑΙ** που λέει τι ΔΕΝ πρέπει να γίνει.

---

## Q10 (2026-03-29): Πλήρης χαρτογράφηση Νομικών Προσώπων — ALL fields + ALL relationships

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση Νομικών Προσώπων (CompanyContact) — ακολουθώντας ακριβώς τη δομή του SPEC-008.

**Απάντηση**: Δημιουργήθηκε SPEC-009-entity-mapping-companies.md με:

- **9 sections**, **120+ πεδία**, βάσει πραγματικού κώδικα (`CompanyContact`, `company-config.ts`, `company.ts` mapper)
- **30 direct fields** (company name, legal form, VAT, GEMI, industry, revenue)
- **16 ΓΕΜΗ fields** (via customFields — gemiStatus, KAD, chamber, capital, κλπ)
- **~40 nested array fields** (emails, phones, addresses, websites, social media)
- **6 contactPerson fields** (embedded array — name, position, department, email, phone, isPrimary)
- **0 persona types** (εταιρείες ΔΕΝ έχουν personas — 6 implicit roles)
- **12 banking fields** (subcollection, ίδια δομή με SPEC-008)
- **24 cross-entity references** (projects, units, POs, invoices, cheques, employees, CRM, κλπ)
- **Report Builder impact**: Tier 1 columns (26 flat + 14 computed), Tier 2 arrays (8), Tier 3 card layout
- **Πίνακας διαφορών** Εταιρεία vs Φυσικό Πρόσωπο (personas, naming, ΓΕΜΗ, legal form, κλπ)

**Pending**: SPEC-010 (Δημόσιες Υπηρεσίες)

---

## Q11 (2026-03-29): Πλήρης χαρτογράφηση Δημοσίων Υπηρεσιών — ALL fields + ALL relationships

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση Δημοσίων Υπηρεσιών (ServiceContact) — ακολουθώντας τη δομή SPEC-008/009.

**Απάντηση**: Δημιουργήθηκε SPEC-010-entity-mapping-services.md με:

- **9 sections**, **130+ πεδία**, βάσει πραγματικού κώδικα (`ServiceContact`, `service-config.ts`, `service.ts` mapper)
- **22 direct fields** (type definition) + **13 extended fields** (mapper: shortName, category, legalStatus, headTitle, κλπ)
- **~37 ωράριο fields** (operatingHours: 7 ημέρες × 5 πεδία + exceptions)
- **~40 nested array fields** (emails, phones, addresses, websites, social media)
- **8 responsiblePerson fields** (extends ContactPerson + responsibilities + availableHours)
- **5 serviceType values** (ministry, tax_office, municipality, public_organization, other)
- **0 persona types** (τύπος ορίζεται via serviceType enum)
- **12 banking fields** (subcollection)
- **9 cross-entity references** (contact_relationships, contact_links, communications, tasks, κλπ)
- **Report Builder impact**: Tier 1 columns (25 flat + 6 computed), Tier 2 arrays (8), Tier 3 card layout
- **Πίνακας σύγκρισης** 3 οντοτήτων (Individual vs Company vs Service) — 16 χαρακτηριστικά
- **ΥΠΕΣ Registry integration**: PublicServicePicker + MinistryPicker (21 υπουργεία)

**Ολοκληρώθηκε η χαρτογράφηση και των 3 οντοτήτων**: SPEC-008 (Φυσικά Πρόσωπα), SPEC-009 (Νομικά Πρόσωπα), SPEC-010 (Δημόσιες Υπηρεσίες).

---

## Q12 (2026-03-29): ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ — Google-Level Automated Testing

**Εντολή Γιώργου**: Θέλω τα tests να είναι επιπέδου Google. Τίποτα λιγότερο. Αδιαπραγμάτευτο.

**Απάντηση**: Δημιουργήθηκε SPEC-011-testing-strategy.md + ενημερώθηκε SPEC-007 v2.0 με:

### Υπάρχοντα Tests (Inventory):
- **8 test αρχεία**, **255 test cases** σε 3,235 γραμμές test code
- Report Engine: 3 αρχεία (EVM, aging, aggregator helpers)
- Procurement: 4 αρχεία (FSM, invoice matcher, supplier metrics, AI handler)
- Construction Scheduling: 1 αρχείο (CPM calculator)
- **Κενά**: PDF/Excel exporters, Report Builder UI, API routes, domain configs

### Testing Strategy (Νέα):
- **4-Layer Pyramid**: Unit (80%) → Component (15%) → Integration (5%) → E2E (optional)
- **~18 νέα test αρχεία**, **~225-285 νέα test cases**
- **Coverage target**: ≥ 80% statements, ≥ 75% branches, ≥ 90% functions
- **Κανόνας**: Κώδικας + Tests = **ΙΔΙΟ COMMIT**, μηδενική εξαίρεση
- **Pattern**: Factory functions + edge cases + error paths (ακολούθησε `evm-calculator.test.ts`)
- **Mock strategy**: Mock Firestore/Auth/PDF/Excel, test pure logic ως-έχει
- **npm script**: `test:report-builder` για targeted execution
- **Pre-commit hook**: Αυτόματο test run αν staged files αφορούν report-builder

### Ενημέρωση SPEC-007 v2.0:
- Κάθε Phase πλέον έχει στήλη **Test Αρχεία** και **Εκτ. Tests**
- Checklist delivery ανά Phase: κώδικας + tests + coverage ≥ 80% + ALL PASS

---

### ΣΥΝΟΨΗ ΕΥΡΗΜΑΤΩΝ

#### ✅ ΔΕΝ χρειάζεται duplicate (ήδη καλύπτεται):
1. Export infrastructure (jsPDF, ExcelJS, Greek font) → reuse ADR-265
2. Core UI components (ReportKPIGrid, ReportTable, ReportChart) → reuse ADR-265
3. Construction domains (D1-D4) → σωστά ορισμένα στο SPEC-001
4. Purchase Orders domain (C6) → σωστά ορισμένο στο SPEC-001
5. Η σχέση ADR-265 ↔ ADR-268 ήδη αναφέρεται στο ADR-268.md §5

#### ⚠️ Προσθήκες/Ενημερώσεις στο ADR-268:
1. **SPEC-001**: Πρόσθεσε σημείωση ότι D3 (Resource Assignments) χρησιμοποιεί τη collection `construction_resource_assignments` που δημιούργησε το ADR-266 Phase C
2. **SPEC-001**: Πρόσθεσε σημείωση ότι D4 (BOQ) χρησιμοποιεί `boq_items` (ADR-175)
3. **ADR-268.md**: Πρόσθεσε σαφή αναφορά ότι specialized visualizations (S-Curve, CPM, Resource Histogram) παραμένουν στο ADR-266 — ο builder κάνει generic bar/pie ΜΟΝΟ
4. **ADR-268.md**: Πρόσθεσε σαφή αναφορά ότι operational actions (PO workflow, delivery recording) παραμένουν στο ADR-267 — ο builder είναι read-only

#### ❌ ΔΕΝ χρειάζεται νέο spec/αρχείο:
- Κανένα νέο αρχείο — οι υπάρχουσες 7 specs καλύπτουν πλήρως το scope
- Οι μικρές προσθήκες γίνονται inline στα υπάρχοντα αρχεία
