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

## Q12a (2026-03-29): Πλήρης χαρτογράφηση Έργων — ALL fields + ALL relationships

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση Έργων (Projects) — ακολουθώντας τη δομή SPEC-008/009/010.

**Απάντηση**: Δημιουργήθηκε SPEC-012-entity-mapping-projects.md με:

- **7 sections**, **~90+ πεδία**, βάσει πραγματικού κώδικα (`Project`, `ProjectAddress`, `EfkaDeclarationData`, `LandownerEntry`)
- **44 direct fields** (identification, business link, addresses, financials, dates, classification, licensing, boolean flags, bartex, EFKA)
- **17 address fields** per entry (ADR-167 multi-address system)
- **~25 EFKA fields** (nested object 1:1 — 7 required ΕΦΚΑ, ΑΜΟΕ, status, audit, documents[])
- **4 landowner fields** per entry (ADR-244 bartex)
- **6 enums** (ProjectStatus, ProjectType, ProjectPriority, ProjectRiskLevel, ProjectComplexity, ProjectAddressType)
- **5 subcollections** (3 root + 2 RBAC)
- **36 cross-entity references** — η πιο "πυκνή" οντότητα σε σχέσεις
- **Report Builder impact**: Tier 1 (31 flat + 19 computed), Tier 2 (3 embedded + 6 cross-entity), Tier 3 card layout

---

## Q13 (2026-03-29): Πλήρης χαρτογράφηση Κτιρίων — ALL fields + ALL relationships

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση Κτιρίων (Buildings) — ακολουθώντας τη δομή SPEC-008/009/010.

**Απάντηση**: Δημιουργήθηκε SPEC-013-entity-mapping-buildings.md με:

- **7 sections**, **210+ πεδία**, βάσει πραγματικού κώδικα (`Building`, `Floor`, `Property`, `ConstructionPhase`, `ConstructionTask`, `ConstructionBaseline`, `ConstructionResourceAssignment`, `BuildingMilestone`, `BOQItem`)
- **40 direct fields** (core, dates, financial, classification, addresses, amenities, features, audit)
- **36 BuildingFeatureKey values** (11 κατηγορίες — θέρμανση, ασφάλεια, βιομηχανικά, κλπ)
- **6 boolean amenity flags** (parking, elevator, garden, pool, accessibility, furnished)
- **7 nested/related entities** πλήρως χαρτογραφημένα:
  - Floor (7 πεδία) + Property (13 πεδία, nested in Floor)
  - ConstructionPhase (20 πεδία) + ConstructionTask (22 πεδία)
  - ConstructionBaseline (10 πεδία) + ResourceAssignment (15 πεδία)
  - BuildingMilestone (16 πεδία) + BOQItem (31 πεδία)
- **23 cross-entity references** (units, floors, parking, storage, phases, tasks, baselines, resources, milestones, BOQ, contact_links, ownership_tables, POs, legal_contracts, payment_plans, obligations, opportunities, layers, κλπ)
- **4 entity association roles** (supervisor, contractor, manager, engineer via contact_links)
- **Report Builder impact**: Tier 1 columns (27 flat + 18 computed), Tier 2 arrays (9), Tier 3 card layout (12 sections)
- **Deletion strategy**: BLOCK (δεν διαγράφεται αν έχει units/phases)

---

## Q15 (2026-03-29): Πλήρης χαρτογράφηση Αποθηκών — ALL fields + ALL relationships

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση Αποθηκών (Storage Rooms) — ακολουθώντας τη δομή SPEC-008/009/010.

**Απάντηση**: Δημιουργήθηκε SPEC-015-entity-mapping-storage.md με:

- **9 sections**, **~60 πεδία**, βάσει πραγματικού κώδικα (`Storage`, `StorageUnit`, `SpaceCommercialData`)
- **21 primary fields** (Storage interface) + **20 legacy fields** (StorageUnit)
- **6 SpaceCommercialData nested fields** (askingPrice, finalPrice, buyerContactId, κλπ)
- **9 features** (i18n keys: electricity, light, security, κλπ)
- **9 StorageType values** + **6 StorageStatus values** + **4 SpaceCommercialStatus values**
- **10 direct cross-entity references** (projects, buildings, floors, units, contacts, companies, ownership_tables, contact_links, search_documents)
- **3 indirect references** via unit.linkedSpaces[] (payment_plans, legal_contracts, cheques)
- **0 subcollections** (σε αντίθεση με units)
- **Report Builder impact**: Tier 1 columns (23 flat + 9 computed), Tier 2 arrays (4), Tier 3 card layout
- **Cascade propagation**: code change → unit.linkedSpaces[].allocationCode
- **Deletion strategy**: BLOCK conditional (sold = cannot delete)
- **Σύγκριση Storage vs Parking** (shared SpaceCommercialData, LinkedSpace pattern)
- **Migration 006**: Normalized building references (name → buildingId FK)

---

## Q16 (2026-03-29): Πλήρης χαρτογράφηση Θέσεων Στάθμευσης — ALL fields + ALL relationships

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση Θέσεων Στάθμευσης (ParkingSpot) — ακολουθώντας τη δομή SPEC-008/009/010.

**Απάντηση**: Δημιουργήθηκε SPEC-016-entity-mapping-parking.md με:

- **9 sections**, **~34 πεδία**, βάσει πραγματικού κώδικα (`ParkingSpot`, `SpaceCommercialData`, `mapParkingDoc()`)
- **22 direct fields** (number, code, type, status, locationZone, area, price, millesimalShares, κλπ)
- **6 nested fields** (commercial overlay: askingPrice, finalPrice, buyerContactId, buyerName, listedDate, reservationDeposit)
- **4 enums** (ParkingSpotType, ParkingSpotStatus, ParkingLocationZone, SpaceCommercialStatus) — 19 τιμές σύνολο
- **0 subcollections**
- **11 cross-entity references** (projects, buildings, floors, contacts, companies, units, ownership_tables, contact_links, search_documents, entity_links)
- **Report Builder impact**: Tier 1 columns (17 flat + 8 computed), Tier 2 sources (3 cross-entity), Tier 3 card layout
- **ADR-199 Sales Appurtenance**: millesimalShares → αυτοτελής vs παρακολούθημα
- **ADR-233 Entity Code**: PK (underground) vs PY (υπαίθριο)
- **ADR-232 Business Link**: linkedCompanyId (cascade από project)
- **Ownership Table**: πάντα `participatesInCalculation=false`, `hasOwnShares=false`

---

## Q14 (2026-03-29): Πλήρης χαρτογράφηση Μονάδων (Units) — ALL fields + ALL relationships

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση Μονάδων (Units) — ακολουθώντας τη δομή SPEC-008 template.

**Απάντηση**: Δημιουργήθηκε SPEC-014-entity-mapping-units.md με:

- **7 sections**, **130+ πεδία**, βάσει πραγματικού κώδικα (`Unit`, `UnitDoc`, `UnitModel`, `UnitCommercialData`)
- **56 direct fields** (identity, hierarchy, triple status architecture, areas, layout, orientation, views, energy, systems, finishes, features, coverage)
- **12 commercial nested fields** + `PaymentSummary` (16 fields) + `owners[]` (5 per entry)
- **9 linkedSpaces fields** per entry (parking/storage allocation, ADR-199 sale appurtenances)
- **Multi-level support** (ADR-236): `levels[]` (4 per level) + `levelData` (12 per level)
- **6 subcollections**: payment_plans (25+ fields), payments (14 fields), photos, documents, history, grants
- **20 cross-entity references** (projects, buildings, floors, contacts, parking, storage, legal_contracts, cheques, brokerage, ownership_tables, opportunities, communications, conversations, contact_links, file_links, companies, commission_records)
- **Report Builder impact**: Tier 1 columns (28 flat + 15 computed = 43), Tier 2 arrays (10), Tier 3 unit card layout
- **Τριπλή κατάσταση**: operationalStatus (physical) + commercialStatus (market, ADR-197) + legacy status (deprecated)
- **Denormalized data**: paymentSummary (ADR-234) + legalPhase (ADR-230) στο `commercial` object

---

## Q20 (2026-03-29): Πλήρης χαρτογράφηση Κατασκευής — 6 οντότητες

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση Construction group (BOQ Items, Construction Phases, Tasks, Resource Assignments, Baselines, Building Milestones) — ακολουθώντας τη δομή SPEC-008.

**Απάντηση**: Δημιουργήθηκε SPEC-020-entity-mapping-construction.md με:

- **6 οντότητες** σε 1 αρχείο, **128 πεδία**, βάσει πραγματικού κώδικα (`BOQItem`, `ConstructionPhase`, `ConstructionTask`, `ConstructionResourceAssignment`, `ConstructionBaseline`, `BuildingMilestone`)
- **BOQ Items**: 31 πεδία, 8 enums (BOQMeasurementUnit 11v, BOQItemStatus 5v, κλπ), 5-state governance lifecycle, 3-level price inheritance (master/project/item), ΑΤΟΕ category codes
- **Construction Phases**: 20 πεδία, 5-state status (planning→completed→blocked), delay tracking
- **Construction Tasks**: 22 πεδία, dependencies[] for Critical Path Method (CPM)
- **Resource Assignments**: 15 πεδία, 2 types (worker/equipment), max 20 per task
- **Construction Baselines**: 10 πεδία, denormalized snapshots of phases[] + tasks[], max 10 per building
- **Building Milestones**: 16 πεδία, 5 types (start→delivery), auto-generated MS-XXX codes
- **14 enum types**, **56 enum values** σύνολο
- **23 cross-entity references** (projects, buildings, units, contacts, invoices, phases↔tasks↔resources, PO→BOQ)
- **4 computed types** (CostBreakdown, PriceResolution, VarianceResult, BOQCategoryCost)
- **9 Firestore collections** (boq_items, boq_categories, boq_price_lists, boq_templates, construction_phases/tasks/baselines/resource_assignments, building_milestones)
- **Report Builder impact**: Tier 1 ανά οντότητα (BOQ: 15 flat + 10 computed, Phases: 17, Tasks: 14, Resources: 8, Milestones: 8), Tier 2 arrays (6), Tier 3 card layouts (Phase + BOQ)
- **Σχέση ADR-266**: Report Builder = cross-building tabular queries ΜΟΝΟ. S-Curve, CPM, Resource Histogram παραμένουν στο ADR-266.

---

## Q21 (2026-03-29): Πλήρης χαρτογράφηση CRM & Επικοινωνία — 4 οντότητες

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση CRM group (Opportunities, CRM Tasks, Communications, Appointments) — ακολουθώντας τη δομή SPEC-008.

**Απάντηση**: Δημιουργήθηκε SPEC-021-entity-mapping-crm.md με:

- **4 οντότητες** σε 1 αρχείο, **~114 πεδία**, βάσει πραγματικού κώδικα (`Opportunity`, `CrmTask`, `Communication`, `AppointmentDocument`)
- **Opportunity**: 23 direct + 9 nested (interestedIn 3-level deep: budget.min/max, desiredArea.min/max, projectIds[], buildingIds[], unitIds[], locations[]), 8-stage pipeline, 4 enums (24 τιμές), 7 cross-entity refs
- **CRM Task**: 23 direct + 10 nested (viewingDetails + RecurrencePattern Phase 3), 3 enums (16 τιμές), 5 cross-entity refs
- **Communication**: 24 direct + 3 AI fields (intentAnalysis, triageStatus, linkedTaskId), 5 enums (25 τιμές), 5 cross-entity refs, AI analysis integration (20+ intent types via MessageIntentAnalysis)
- **Appointment**: 10 direct + 12 nested (source + requester + appointment), 1 enum (5 τιμές), 3 cross-entity refs, UC-001 AI Pipeline integration
- **0 subcollections** (καμία οντότητα)
- **20 cross-entity references** σύνολο (contacts, projects, buildings, units, opportunities, tasks, communications, ai_pipeline_queue, companies)
- **Report Builder impact**: Tier 1 (58 flat + 19 computed), Tier 2 (9 arrays), Tier 3 (4 card layouts)
- **Ειδικά**: TriageStatus SSoT (`src/constants/triage-statuses.ts`), IntentTypeValue SSoT (`src/schemas/ai-analysis.ts`)

---

## Q19 (2026-03-29): Πλήρης χαρτογράφηση Πίνακα Χιλιοστών — ALL fields + ALL relationships

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση Πίνακα Ποσοστών Συνιδιοκτησίας (OwnershipPercentageTable) — λόγω εξαιρετικής πολυπλοκότητας σε ξεχωριστό SPEC.

**Απάντηση**: Δημιουργήθηκε SPEC-019-entity-mapping-ownership-tables.md με:

- **8 sections**, **~65+ πεδία** (+ 20×N rows + 9×M linkedSpaces), βάσει πραγματικού κώδικα (`OwnershipPercentageTable`, `OwnershipTableRow`, `LinkedSpaceDetail`, `BartexSummary`, `LandownerEntry`)
- **19 direct fields** (identity, calculation params, summaries, legal)
- **20 fields per row** (OwnershipTableRow — entity ref, areas, shares, coefficients, owner party, buyer, contracts)
- **9 fields per linkedSpace** (LinkedSpaceDetail — tree-branch rendering)
- **5+4×N fields** bartex (BartexSummary + LandownerEntry array)
- **5 fields** revision (OwnershipTableRevision — immutable snapshot + audit)
- **5 enums**: CalculationMethod, PropertyCategory, OwnerParty, OwnershipTableStatus, OwnershipEntityCollection
- **3 μέθοδοι υπολογισμού**: Κατ' Εμβαδόν (Α), Κατ' Αντικειμ. Αξία (Β, ΠΟΛ 1149/1994), Κατ' Όγκον (Γ)
- **15 floor coefficient entries** (Πίνακας Α + Β — ΑΑΔΕ)
- **1 subcollection**: revisions (version history)
- **13 cross-entity references** (projects 1:1, buildings, units, parking_spots, storage_units, contacts×2, revisions)
- **Report Builder impact**: Dual-level (28 table-level + 20 row-level Tier 1 columns), 5 Tier 2 arrays, Tier 3 full ownership table card
- **Νομοθετικό πλαίσιο**: Ν. 3741/1929, ΠΟΛ 1149/1994, ΑΚ 1002-1117
- **Rounding**: Largest Remainder Method (Hamilton) → ΠΑΝΤΑ σύνολο = 1000

---

## Q17 (2026-03-29): Πλήρης χαρτογράφηση Οικονομικά A — Payment Plans + Cheques + Legal Contracts

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση 3 οικονομικών οντοτήτων (Group C1-C3) — ακολουθώντας τη δομή SPEC-008 template.

**Απάντηση**: Δημιουργήθηκε SPEC-017-entity-mapping-financials-a.md με:

### Οντότητα 1: Payment Plans (~100+ πεδία)
- **23 direct fields** (references, amounts, tax regime, ADR-244 multi-owner, audit)
- **Installments[]**: 11 πεδία ανά δόση, 5-state FSM
- **LoanTracking[] (Phase 2)**: 35 πεδία, 15-state FSM, multi-bank support
- **Config**: 9 πεδία (grace period, late fees, sequential/partial/overpayments)
- **Payments subcollection**: 15 πεδία + PaymentMethodDetails (6 variants)
- **12 enums** (64 τιμές), **5+15 FSM states**

### Οντότητα 2: Cheques (~47 πεδία)
- **35 direct fields** + ChequeContext (7 πεδία) + EndorsementChain[] (5 πεδία/entry)
- **10-state FSM**, bounced workflow (ΤΕΙΡΕΣΙΑΣ + αστυνομία), Ν. 5960/1933
- **5 enums** (25 τιμές)

### Οντότητα 3: Legal Contracts (~65 πεδία)
- **20 direct fields** + ProfessionalSnapshot ×3 (8 πεδία + variant)
- **3 phases × 4 status states** (forward-only FSM), ΑΚ 402-403 αρραβώνας
- **5 enums** (20 τιμές)

**Σύνολο**: ~212+ πεδία, 22 enums, ~42 FSM states, 25 cross-entity references

---

## Q25 (2026-03-29): Πόσα records ανά collection — Performance Strategy

**Ερώτηση**: Πόσα records αναμένουμε ανά domain; Χρειαζόμαστε cursor pagination ή αρκεί server-side fetch + limit;

**Απάντηση Γιώργου**: Αρχικά 5-6 χρήστες, μετά distribution σε άλλες εταιρείες. Τυπική εταιρεία: 3-4 έργα (μεγάλη: 15-20), 20-50 μονάδες/έργο. Επαφές πολλαπλασιάζονται (αγοραστές, δικηγόροι, συμβ/φοι, συνεργεία, εμπλεκόμενοι).

### Εκτίμηση μεγέθους δεδομένων ΑΝΑ ΕΤΑΙΡΕΙΑ (companyId)

| Collection | Μικρή (3-4 έργα) | Μεσαία (6-7 έργα) | Μεγάλη (15-20 έργα) |
|------------|-------------------|--------------------|--------------------|
| projects | 3-4 | 6-7 | 15-20 |
| buildings | 4-6 | 8-12 | 20-30 |
| units | 80-120 | 200-350 | 600-1,000 |
| contacts | 300-500 | 800-1,400 | 2,000-4,000 |
| payment_plans | 80-120 | 200-350 | 600-1,000 |
| cheques | 100-200 | 300-600 | 1,000-2,000 |
| legal_contracts | 80-200 | 200-500 | 600-1,500 |
| boq_items | 200-500 | 500-1,500 | 2,000-5,000 |
| opportunities | 50-100 | 150-300 | 400-800 |
| purchase_orders | 30-80 | 100-300 | 300-800 |
| parking_spots | 40-80 | 100-200 | 300-600 |
| storage_units | 20-50 | 60-150 | 150-400 |
| **MAX record count** | **~500** | **~1,500** | **~5,000** |

### Performance Decision

| Στρατηγική | Κατάλληλο για | Απόφαση |
|------------|---------------|---------|
| Client-side fetch all | <500 records | ❌ Δεν αρκεί για μεγάλες |
| **Server-side fetch + limit 500** | **<5,000 records** | **✅ ΑΥΤΟ — ήδη στο SPEC-006** |
| Cursor pagination | 5,000-50,000 | Δεν χρειάζεται Phase 1 |
| Full-text search index | >50,000 | Δεν χρειάζεται |

### Industry Benchmarks (Google + Κατασκευαστικές)

| Εταιρεία | Approach | Limit |
|----------|----------|-------|
| **Google Looker** | Lazy loading (100 πρώτα, scroll batches), server-side aggregation, streaming results, 5-min query cache |
| **Procore** | Max 10K records, server pagination 100/σελίδα, async export (background → email) |
| **Oracle Primavera** | Cursor pagination, 5K activities/query, cached aggregations (ανανέωση 15 λεπτά) |
| **Autodesk BIM 360** | Real-time <1K, async job >1K, server-side export → download notification |
| **SAP S/4HANA** | Background execution, progress bar, notification on completion |

### Αρχιτεκτονική Απόφαση: Future-Proof Θεμέλια

**Εντολή Γιώργου**: Η υποδομή πρέπει να εξυπηρετεί πολύ μεγαλύτερες εταιρείες αργότερα χωρίς τεράστια refactorings.

**Απόφαση — Layered Architecture (Google Pattern)**:

Χτίζουμε **abstractions** που σήμερα τρέχουν sync αλλά αύριο γίνονται async χωρίς αλλαγή interface:

```
Phase 1 (τώρα):     QueryEngine.execute(request) → Promise<rows[]>         (sync, <5K records)
Phase 2+ (αργότερα): QueryEngine.execute(request) → Promise<rows[]> | JobId  (async, >5K records)
```

| Θεμέλιο | Phase 1 (σήμερα) | Phase 2+ (αργότερα, χωρίς rewrite) |
|---------|------------------|-----------------------------------|
| **Query abstraction** | `QueryEngine.execute()` → sync Firestore | Ίδιο interface → async job + polling |
| **Pagination interface** | `{ limit, offset }` → fetch + slice | Ίδιο interface → cursor pagination |
| **Export abstraction** | `ExportEngine.export()` → sync blob | Ίδιο interface → background job → notification |
| **Cache layer** | No-op (pass-through) | Ίδιο interface → Redis/in-memory 5-min cache |
| **Aggregation** | Server-side Firestore | Ίδιο interface → pre-computed materialized views |

**Πρακτικά**: Σήμερα `limit: 500, max: 2000` αρκεί. Αύριο αλλάζουμε ΜΟΝΟ τα internals, ΟΧΙ τα interfaces.

---

## Q26 (2026-03-29): Pre-built Report Templates — Google/Procore Pattern

**Ερώτηση**: Θέλουμε έτοιμες αναφορές (templates) ή μόνο blank builder;

**Απάντηση Γιώργου**: Δεν έχει δουλέψει ακόμα την εφαρμογή, δεν ξέρει ακριβώς τι θα χρειαστεί. Θέλει να ακολουθήσουμε Google/Procore pattern.

### Industry Standard

| Εταιρεία | Approach |
|----------|----------|
| **Procore** | ~30 pre-built + custom builder. Templates ανά κατηγορία (Budget, Commitments, Schedule, Safety) |
| **Oracle Primavera** | ~50 standard reports (Activity, Resource, Cost, Earned Value) + custom |
| **Google Analytics** | ~20 standard + Explore (custom builder). Templates = shortcuts, NOT separate code |
| **Salesforce** | ~15 standard + drag-and-drop builder. Templates = saved report configs |

### Απόφαση: Templates = Saved Report Configs (Salesforce Pattern)

Δεν χτίζουμε ξεχωριστό template system. Τα templates είναι **pre-configured saved reports** — ίδιος μηχανισμός με τα user-saved reports, απλά `isTemplate: true`.

```typescript
// Ίδιο interface — template ΚΑΙ user report
interface SavedReport {
  id: string;
  name: string;
  domain: ReportDomain;
  columns: string[];
  filters: ReportFilter[];
  groupBy?: string[];
  isTemplate: boolean;    // true = system template, false = user saved
  createdBy: string;      // 'system' for templates
  companyId: string;      // tenant isolation
}
```

**Phase 1**: Blank builder μόνο (δεν ξέρουμε ακόμα ποιες αναφορές χρειάζονται)
**Phase 7 (Saved Reports)**: Ο Γιώργος φτιάχνει τις αναφορές που χρειάζεται → τις σώζει → γίνονται de facto templates
**Phase 7+**: Προσθέτουμε ~15-20 system templates βάσει πραγματικής χρήσης

**Zero wasted code**: Κανένας ξεχωριστός template engine. Ό,τι δουλεύει για saved reports, δουλεύει για templates.

---

## Q27 (2026-03-29): Mobile/Tablet Support — Responsive Strategy

**Ερώτηση**: Ο Report Builder δουλεύει σε mobile/tablet ή μόνο desktop;

**Απάντηση Γιώργου**: Mobile/tablet + desktop.

### Industry Pattern (Procore)

Procore (η κορυφαία construction platform) κάνει **adaptive layout**, ΟΧΙ ίδιο UI σε mobile:

| Viewport | UI Pattern |
|----------|-----------|
| **Desktop (>1024px)** | Full builder: DomainSelector + ColumnSelector + FilterPanel + Table + Charts side-by-side |
| **Tablet (768-1024px)** | Stacked layout: selectors πάνω, results κάτω. Charts σε full-width. Column selector = drawer |
| **Mobile (<768px)** | Simplified: Domain → Filters → Results (step-by-step wizard). Table = horizontal scroll. Charts = full-width stacked |

### Απόφαση: Procore Adaptive Pattern

- **Phase 1**: Desktop-first, αλλά responsive foundations (CSS grid/flex, no fixed widths, mobile-safe components)
- **Phase 2**: Tablet optimization (stacked layout, drawer selectors)
- **Phase 4+**: Mobile wizard mode (step-by-step flow)
- **Export**: Πάντα landscape PDF — ίδιο σε όλες τις συσκευές

**Υπάρχον foundation**: Η εφαρμογή ήδη χρησιμοποιεί responsive patterns (ADR-265 `ReportKPIGrid` = 4→2→1 cols). Δεν χρειάζεται νέο responsive system.

---

## Q28 (2026-03-29): Γλώσσα UI — Bilingual Column Labels

**Ερώτηση**: Τα labels στηλών/filters θα είναι μόνο EL, μόνο EN, ή bilingual;

**Απάντηση Γιώργου**: Bilingual (EL + EN).

### Εκτίμηση μεταφραστικού όγκου

| Κατηγορία | Εκτίμηση κλειδιών |
|-----------|-------------------|
| Domain names (20) | 20 |
| Column labels (~20/domain × 20 domains) | ~400 |
| Filter operators (contains, equals, before, κλπ) | ~15 |
| UI labels (builder page, buttons, placeholders) | ~30 |
| Enum values (status, type, phase — ήδη translated σε ADR-265) | REUSE |
| **Σύνολο νέων κλειδιών** | **~465** |

### Απόφαση: i18n Namespace Extension (Google Pattern)

**Εντολή Γιώργου**: Τα JSON αρχεία να μην είναι τεράστια — όπως το κάνει η Google.

Η εφαρμογή **ήδη** κάνει Google pattern: ~30 split namespaces, lazy loaded ανά σελίδα. Μεγαλύτερα: `common.json` (117KB), `building.json` (113KB), `dxf-viewer.json` (88KB). Τα υπόλοιπα <30KB.

**Report Builder i18n — Split ανά domain group (ΟΧΙ 1 τεράστιο αρχείο)**:

```
src/i18n/locales/el/
├── report-builder.json          ← Core UI (~30 κλειδιά: buttons, labels, placeholders)
├── report-builder-domains.json  ← Domain names + column labels (~400 κλειδιά)
└── (existing reports.json)      ← Ήδη 25KB — ΔΕΝ πειράζεται
```

- **report-builder.json**: ~2KB — μόνο UI strings (φορτώνεται μόνο στο `/reports/builder`)
- **report-builder-domains.json**: ~15KB — column labels ανά domain (φορτώνεται lazy, μόνο όταν ανοίξει builder)
- **Enum values**: REUSE υπάρχοντα namespaces (contacts.json, projects.json, payments.json ήδη τα έχουν)
- **Fallback**: Αν λείπει μετάφραση → fallback στο field name (camelCase → human readable)
- **Phase 1**: ~80 κλειδιά (4 domains). **Phase 4-6**: incremental ~400 κλειδιά

---

## Q29 (2026-03-29): Report Sharing — URL + Saved + Export

**Ερώτηση**: Θέλουμε sharing αναφορών πέρα από PDF/Excel; Τι σημαίνει σε υποδομή/κόστος;

**Απάντηση Γιώργου**: Και τα τρία.

### 3 Sharing Methods — Phased Delivery

| Method | Phase | Effort | Server Cost | Περιγραφή |
|--------|-------|--------|-------------|-----------|
| **A. URL Sharing** | Phase 1 | ~20 γρ. | Μηδέν | Filters encoded στο URL → copy link → live data |
| **B. PDF/Excel Export** | Phase 3 | Ήδη σχεδιασμένο (SPEC-003) | Μηδέν | Static snapshot → email/Viber |
| **C. Saved Report Sharing** | Phase 7 | ~100 γρ. | Firestore reads (ελάχιστο) | Share με χρήστες/ρόλους → "Κοινές Αναφορές" |

### Τεχνικές Λεπτομέρειες

**A. URL Sharing (Phase 1)**:
- URL pattern: `/reports/builder?d=units&c=code,name,status&f=status:eq:sold`
- Encode/decode via `URLSearchParams` — zero storage
- Ο παραλήπτης βλέπει live data (αν έχει `reports:reports:view` permission)

**C. Saved Report Sharing (Phase 7)**:
- Extend `SavedReport` interface: `sharedWith: string[]`, `sharedWithRoles: string[]`
- Query: `where('sharedWith', 'array-contains', userId)`
- UI: "Κοινοποίηση" button → user/role picker
- Respects RBAC — ο παραλήπτης βλέπει μόνο data του companyId του

---

## Q30 (2026-03-29): Chart Types — Βασικά + Advanced

**Ερώτηση**: Ποιους τύπους chart θέλουμε στον builder;

**Απάντηση Γιώργου**: Όλους — βασικά + advanced (heatmap, treemap, scatter).

### Chart Types — Phased Delivery

| Τύπος | Ήδη υπάρχει (ADR-265) | Phase | Use Case Κατασκευής |
|-------|----------------------|-------|---------------------|
| **Bar** | ✅ ReportChart | Phase 2 | Πωλήσεις ανά μήνα, κόστος ανά κτίριο |
| **Pie** | ✅ ReportChart | Phase 2 | Κατανομή status μονάδων, τύποι επαφών |
| **Line** | ✅ ReportChart | Phase 2 | Τάσεις πληρωμών, πρόοδος κατασκευής |
| **Area** | ✅ ReportChart | Phase 2 | Σωρευτικά έσοδα |
| **Stacked Bar** | ✅ ReportChart | Phase 2 | Status breakdown ανά έργο |
| **Funnel** | ✅ ReportFunnel | Phase 2 | Pipeline ευκαιριών |
| **Gauge** | ✅ ReportGauge | Phase 2 | % ολοκλήρωσης, CPI/SPI |
| **Scatter** | ❌ Νέο | Phase 4+ | Εμβαδόν vs τιμή, €/m² analysis |
| **Treemap** | ❌ Νέο | Phase 4+ | Κατανομή κόστους BOQ, budget breakdown |
| **Heatmap** | ❌ Νέο | Phase 6+ | Καθυστερήσεις ανά μήνα/κτίριο, seasonal patterns |

### Τεχνική Σημείωση

- **Recharts** (ήδη εγκατεστημένο) υποστηρίζει: Bar, Pie, Line, Area, Scatter, Treemap — **μηδέν νέο dependency**
- **Heatmap**: Recharts δεν έχει native heatmap — υλοποίηση με custom `<Cell>` grid ή lightweight add-on
- **Κόστος**: Μηδέν νέες βιβλιοθήκες, μόνο γραμμές κώδικα
- **Smart auto-suggest**: Ο builder θα προτείνει τύπο chart βάσει data type (enum → pie, date → line, number × number → scatter)

---

## Q31 (2026-03-29): Real-time vs Snapshot Data

**Ερώτηση**: Τα data ενημερώνονται real-time ή snapshot + refresh;

**Απάντηση Γιώργου**: Snapshot + Refresh button.

**Απόφαση**: Snapshot + Refresh (Procore/Oracle/SAP pattern)
- Ο χρήστης πατάει "Εκτέλεση" → βλέπει data εκείνης της στιγμής
- Πατάει "Ανανέωση" → fresh query
- **ΟΧΙ** `onSnapshot` (real-time) → λιγότερα Firestore reads = λιγότερο κόστος
- Timestamp "Τελευταία ενημέρωση: 14:32" στο UI

---

## Q32 (2026-03-29): Cross-Domain Join Depth — Max 3 Levels

**Ερώτηση**: Πόσα επίπεδα βάθους σε joins μεταξύ collections;

**Απάντηση Γιώργου**: 3 max.

### Cost Analysis

| Επίπεδα | Reads/query (100 units) | Κόστος/query | 5 users × 10 rpts/day × 30 days |
|---------|------------------------|-------------|----------------------------------|
| 1 | ~180 | $0.000108 | $0.16/μήνα |
| 2 | ~380 | $0.000228 | $0.34/μήνα |
| **3** | **~600** | **$0.000360** | **$0.54/μήνα** |

Διαφορά 2→3 = ~$0.20/μήνα. Ακόμα 20 users × 20 rpts/day = ~$4.30/μήνα.

### Απόφαση

- **Max 3 επίπεδα** (π.χ. Unit → Payment Plan → Cheque)
- Αρχιτεκτονική extensible σε N — αν χρειαστεί 4ο, προστίθεται χωρίς rewrite
- Τα denormalized πεδία (snapshots, cached names) μειώνουν τα πραγματικά επίπεδα
- 4+ δεν βρέθηκε ρεαλιστικό use case λόγω SAP-pattern denormalization

---

## Q33 (2026-03-29): Project Isolation — Company-Wide Access

**Ερώτηση**: Αν χρήστης είναι project_manager σε 2/5 projects, βλέπει data από όλα ή μόνο τα δικά του;

**Απάντηση Γιώργου**: OK σε company-wide.

**Απόφαση**: Company-wide (data filtered μόνο by companyId, ΟΧΙ by project membership).
- Συμβαδίζει με ADR-265 reports (ήδη company-wide)
- Αρχικά 5-6 users — project isolation δεν έχει νόημα
- **Future-proof**: Config flag `projectIsolation: boolean` για μελλοντική ενεργοποίηση
- Υλοποίηση αργότερα = +1 γραμμή (`WHERE projectId IN [user's projects]`), 0 rewrite

### Τεχνικό Εύρημα: Subcollection Group Queries

Τα `payment_plans` και `payments` είναι subcollections (`units/{unitId}/payment_plans`). **Δεν υπάρχει collection group index** στο `firestore.indexes.json` για αυτές.

**Λύση Phase 1**: Query parent collection (units) → resolve subcollections per unit (batch). Με max ~1,000 units = ~1,000 subcollection queries (OK performance).

**Λύση Phase 4+ (αν χρειαστεί)**: Προσθήκη collection group index → `db.collectionGroup('payment_plans').where('projectId', '==', x)`.

---

## Q34 (2026-03-29): Conditional Formatting — Automatic Status Colors

**Ερώτηση**: Θέλουμε χρώματα βάσει τιμής στον πίνακα;

**Απάντηση Γιώργου**: A. Automatic.

**Απόφαση**: Automatic conditional formatting (Procore pattern)
- **Enum/Status πεδία**: Αυτόματο χρώμα βάσει status (green=completed/paid, red=overdue/bounced/cancelled, amber=pending/draft)
- **Boolean πεδία**: ✅ green / ❌ red
- **Currency πεδία**: Κόκκινο αν αρνητικό
- **Date πεδία**: Κόκκινο αν παρελθόν + status δεν είναι completed (overdue indication)
- **REUSE**: Η εφαρμογή ήδη έχει status color mappings σε κάθε domain — δεν χρειάζεται νέο color system
- Phase 1: Enum/status colors. Phase 2+: Date-based overdue, threshold rules.

---

## Q35 (2026-03-29): Drill-Down — Clickable Entity Links

**Ερώτηση**: Κλικ σε entity name → navigation στη σελίδα του;

**Απάντηση Γιώργου**: A. Clickable links.

**Απόφαση**: Clickable links (Procore pattern)
- Entity columns (Project name, Unit code, Contact name, PO number) = clickable → opens entity page (new tab)
- **REUSE**: Routes ήδη υπάρχουν (`/projects/[id]`, `/contacts/[id]`, `/procurement/[poId]`, κλπ)
- Domain config: κάθε domain ορίζει `linkField` + `linkTemplate` (π.χ. `{ field: 'unitId', template: '/units/{id}' }`)
- Phase 1: Primary entity link. Phase 2+: Joined entity links (π.χ. κλικ σε buyer name → contact page)

---

## Q36 (2026-03-29): Row Limit Notification — Warning Banner

**Ερώτηση**: Αν τα results ξεπερνούν το limit (500), τι βλέπει ο χρήστης;

**Απάντηση Γιώργου**: A. Warning banner.

**Απόφαση**: Warning banner (Google/Procore pattern)
- Banner: "Εμφανίζονται 500 από 2,000 αποτελέσματα. Πρόσθεσε φίλτρα ή αύξησε το limit."
- Κουμπί "Εμφάνιση περισσότερων" (αυξάνει limit σε 1000 → 2000 → max)
- Aggregations (SUM/COUNT/AVG) υπολογίζονται στο **σύνολο**, ΟΧΙ στα truncated rows
- Export: Εξάγει ΟΛΑ τα rows (μέχρι max 2000), ΟΧΙ μόνο τα εμφανιζόμενα

---

## Q37 (2026-03-29): Filter Chips UI — Google/Procore Pattern

**Ερώτηση**: Θέλουμε filter chips πάνω από τον πίνακα;

**Απάντηση Γιώργου**: Ναι.

**Απόφαση**: Filter Chips (Phase 1)
- Ενεργά φίλτρα εμφανίζονται ως chips: `[Status: Sold ✕] [Ποσό: > 10.000€ ✕] [+ Φίλτρο]`
- Κλικ ✕ → αφαιρεί φίλτρο + re-execute query
- Κλικ "+ Φίλτρο" → ανοίγει filter row
- Κλικ στο chip → edit inline (αλλαγή τιμής/operator)
- Mobile: horizontal scroll στα chips

---

## Q38 (2026-03-29): AI Natural Language Query — Phase 1

**Ερώτηση**: Θέλουμε AI text input που μεταφράζει φυσική γλώσσα σε query;

**Απάντηση Γιώργου**: ΝΑΙ, στο Phase 1.

**Απόφαση**: AI Query Translator (Phase 1, Procore Assist pattern)

### Flow
```
Χρήστης: "Δείξε μου τις ληξιπρόθεσμες δόσεις πάνω από 10K"
    ↓
AI (gpt-4o-mini): μεταφράζει σε BuilderQueryRequest
    ↓
Confirmation: "Κατάλαβα: Domain=Πλάνα Πληρωμών, Filter: status=due, amount>10000"
    ↓
Χρήστης: ✅ Εκτέλεση / ✏️ Διόρθωση
    ↓
Ίδιο Query Engine → Αποτελέσματα
```

### Νέα αρχεία (3)
- `src/services/report-engine/ai-query-translator.ts` — Prompt + OpenAI → BuilderQueryRequest
- `src/components/reports/builder/AIQueryInput.tsx` — Text field + confirmation UI
- `src/app/api/reports/builder/ai/route.ts` — API endpoint (withAuth + rate limit)

### Αρχιτεκτονική
- REUSE ADR-171 AI pipeline (OpenAI provider, structured outputs)
- System prompt: domain names + column names + filter operators (injected from domain configs)
- Bilingual: κατανοεί EL + EN
- Confirmation step ΥΠΟΧΡΕΩΤΙΚΟ — ο χρήστης βλέπει τι κατάλαβε πριν εκτελέσει
- Αν αποτύχει parsing → fallback: "Δεν κατάλαβα, δοκίμασε διαφορετικά ή χρησιμοποίησε τα φίλτρα"
- Κόστος: ~$0.001/query (gpt-4o-mini) = αμελητέο

### UI Position
```
┌────────────────────────────────────────────────────────────┐
│ 🤖 "Ρώτησε με κάτι..." [___________________________] [→] │
├────────────────────────────────────────────────────────────┤
│ [Domain ▾] [Στήλες ▾] [+ Φίλτρο]                         │
│ [Status: Sold ✕]  [Ποσό: > 10K ✕]                        │
├────────────────────────────────────────────────────────────┤
│ Πίνακας αποτελεσμάτων...                                  │
└────────────────────────────────────────────────────────────┘
```

Δύο τρόποι: Manual (κλασικά φίλτρα) ΚΑΙ AI (text input). Ίδιο αποτέλεσμα.

---

## Q39 (2026-03-29): Drag-and-Drop Column Reordering — Phase 1

**Ερώτηση**: Drag-and-drop για αλλαγή σειράς στηλών; Phase 1 ή αργότερα;

**Απάντηση Γιώργου**: Phase 1.

**Απόφαση**: Checkboxes ΓΙΑ ΕΠΙΛΟΓΗ + Drag-and-drop ΓΙΑ ΣΕΙΡΑ (Phase 1)
- Column selector: checkboxes ενεργοποιούν/απενεργοποιούν στήλες
- Επιλεγμένες στήλες εμφανίζονται σε sortable list — drag handle (⠿) για reorder
- Table headers: ΟΧΙ drag (πολύπλοκο) — η σειρά ορίζεται μόνο στον selector
- Library: HTML5 Drag-and-Drop ή `@dnd-kit/sortable` (αν ήδη υπάρχει στο project)
- Αποθηκεύεται στο URL sharing (column order encoded)

---

## Q40 (2026-03-29): Expand/Collapse Grouped Rows — Mandatory Phase 2

**Ερώτηση**: Expand/collapse σε grouped rows — mandatory ή nice-to-have;

**Απάντηση Γιώργου**: Ναι (mandatory).

**Απόφαση**: Mandatory στο Phase 2 (μαζί με grouping)
- ▼ Expanded: δείχνει child rows
- ▶ Collapsed: δείχνει μόνο summary (count + aggregations)
- Κουμπιά "Ανάπτυξη Όλων" / "Σύμπτυξη Όλων" (Procore Feb 2026 pattern)
- Default: Level 1 expanded, Level 2 collapsed
- Max 1,000 rows (Procore limit)

---

## Q24 (2026-03-29): Ποιο auth/RBAC model χρησιμοποιεί το Report Builder;

**Ερώτηση**: Ποιοι χρήστες θα έχουν πρόσβαση στο Report Builder; Τι RBAC model ακολουθούμε;

**Απάντηση** (βάσει ανάλυσης κώδικα `src/lib/auth/`):

Η εφαρμογή έχει **πλήρες enterprise RBAC** ήδη υλοποιημένο:

### Υπάρχον Auth Stack
- **Multi-tenant**: `companyId` σε κάθε AuthContext — automatic data isolation
- **11 roles**: 2 global (super_admin bypass, company_admin) + 9 project-scoped (project_manager, architect, engineer, site_manager, accountant, sales_agent, data_entry, vendor, viewer)
- **~70 permission IDs**: Fine-grained, compile-time safe (TypeScript `as const`)
- **9 permission sets**: Add-on bundles (3 require MFA: finance_approver, legal_viewer, legal_manager)
- **Tenant isolation**: `requireProjectInTenant()`, `requireBuildingInTenant()` κλπ — verified in Firestore

### Report-Specific Permissions (ήδη υπάρχουν)
- `reports:reports:view` — Βλέπει αναφορές (all current ADR-265 APIs use this)
- `reports:reports:create` — Δημιουργεί αναφορές (available in `report_creator` permission set)

### ADR-268 Report Builder Απόφαση
- **API**: `POST /api/reports/builder` → `withAuth({ requiredPermission: 'reports:reports:view' })` — ίδιο pattern με ADR-265
- **Saved Reports**: `reports:reports:create` permission required (ήδη στο `report_creator` set)
- **Navigation**: `/reports/builder` visible αν user has `reports:reports:view`
- **Data isolation**: `filter.companyId = ctx.companyId` — automatic, zero new code
- **Domain-level restrictions**: ΟΧΙ στο Phase 1 — αν χρειαστεί Phase 2+, extend permissions (π.χ. `reports:financial:view`)

### Ποιοι ρόλοι βλέπουν Reports
| Role | `reports:reports:view` | `reports:reports:create` |
|------|----------------------|------------------------|
| super_admin | ✅ (bypass) | ✅ (bypass) |
| company_admin | ✅ | ✅ |
| project_manager | ✅ | ✅ |
| site_manager | ✅ | ✅ |
| accountant | ✅ | ❌ (μόνο view) |
| viewer | ✅ | ❌ |
| architect | ❌ | ❌ |
| engineer | ❌ | ❌ |
| sales_agent | ❌ | ❌ |
| data_entry | ❌ | ❌ |
| vendor | ❌ | ❌ |

**Δεν χρειάζεται ΚΑΝΕΝΑ νέο RBAC code** — REUSE 100% του υπάρχοντος auth stack.

---

## Q23 (2026-03-29): Ανάλυση Overlap ADR-265/266/267 vs ADR-268 — Anti-Duplication Rules

**Ερώτηση Γιώργου**: Μήπως ο κώδικας που θα δημιουργηθεί για το ADR-268 έρχεται σε σύγκρουση ή είναι διπλότυπος με τον κώδικα που γράψαμε ήδη για τα ADR-265, ADR-266, ADR-267;

**Απάντηση**: Πλήρης ανάλυση ~21,500 γραμμών production κώδικα:

- **ADR-265**: 80+ components, 8 API routes, 7,500 γρ. — 9 hardcoded dashboards
- **ADR-266**: 36 files, 8,000 γρ. — Gantt, S-Curve, CPM, Resource Histogram (per-building)
- **ADR-267**: 10 services, 10 components, 6,000 γρ. — PO CRUD workflow

**Αποτέλεσμα**: ΜΗΔΕΝ overlap αν τηρηθούν 5 κανόνες:

1. **REUSE Core UI** — ReportTable, ReportChart, ReportKPIGrid κλπ (13 primitives). ΠΟΤΕ νέο component.
2. **REUSE Export Engines** — report-pdf-exporter.ts + report-excel-exporter.ts. ΠΟΤΕ νέο PDF/Excel wrapper.
3. **ΠΟΤΕ specialized visualizations** (S-Curve, CPM, Gantt, Resource Histogram) — μένουν στο 266.
4. **ΠΟΤΕ CRUD actions** (PO create/approve/cancel, delivery, email) — μένουν στο 267.
5. **Νέος κώδικας ΜΟΝΟ** για: dynamic query engine, filter engine, domain configs, saved reports, builder page/API.

**Διαχωρισμός**:
- ADR-265 = "Δώσε μου το dashboard Πωλήσεων" (σταθερά KPIs + charts)
- ADR-268 = "Δώσε μου ΟΛΕΣ τις μονάδες >100τμ grouped by status" (ad-hoc, user-defined)
- ADR-266 = Βαθιά ανάλυση per-building (specialized viz)
- ADR-267 = Operational PO module (CRUD + workflow)

Προστέθηκε §7 "Anti-Duplication Rules" στο ADR-268.md με πλήρεις πίνακες REUSE mapping.

---

## Q18 (2026-03-29): Πλήρης χαρτογράφηση Οικονομικών B — Purchase Orders + Brokerage + Commissions

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση 3 οντοτήτων (Purchase Orders, Brokerage Agreements, Commission Records) — ακολουθώντας τη δομή SPEC-008.

**Απάντηση**: Δημιουργήθηκε SPEC-018-entity-mapping-financials-b.md με:

- **3 οντότητες** σε 1 αρχείο, **~90+ πεδία**, βάσει πραγματικού κώδικα (`PurchaseOrder`, `BrokerageAgreement`, `CommissionRecord`)
- **Purchase Orders**: 31 direct fields, 10 per line item, 7 per attachment, 7-state FSM (draft→closed+cancelled), 7 POCancellationReason, 4 POVatRate, 9 audit events, 6 permissions, PO-Invoice matching (6 criteria, 85pt threshold), Supplier Metrics (8 KPIs)
- **Brokerage Agreements**: 19 direct fields, 3-state FSM, 3 ExclusivityType, 3 CommissionType, server-enforced exclusivity validation
- **Commission Records**: 17 direct fields, 3-state FSM, immutable, pure commission calculation
- **0 subcollections** (embedded arrays + flat documents)
- **17 cross-entity references** (projects, buildings, contacts×4, units, boq_items, accounting_invoices, brokerage_agreements)
- **Report Builder impact**: Tier 1 (PO: 21+8, Brokerage: 12+3, Commission: 11+2), Tier 2 (3 arrays), Tier 3 (2 card layouts)

---

## Q22 (2026-03-29): Πλήρης χαρτογράφηση Λογιστικής — 6 οντότητες

**Εντολή Γιώργου**: Πλήρης χαρτογράφηση GROUP F (Λογιστική): Invoices, Journal Entries, VAT Summaries, Bank Transactions, Expense Documents, EFKA — ακολουθώντας τη δομή SPEC-008.

**Απάντηση**: Δημιουργήθηκε SPEC-022-entity-mapping-accounting.md με:

- **6 οντότητες** σε 1 αρχείο, **~206 πεδία**, βάσει πραγματικού κώδικα (`Invoice`, `JournalEntry`, `VATQuarterSummary`, `VATAnnualSummary`, `BankTransaction`, `ReceivedExpenseDocument`, `EFKAAnnualSummary`, `EFKAPayment`)
- **Invoices**: 74 πεδία (24 κύρια + 50 nested), 6 enums, 4 nested arrays (lineItems, vatBreakdown, payments, emailHistory), myDATA integration, withholding tax (ADR-ACC-020)
- **Journal Entries**: 21 πεδία, 8 enums (25 account categories + custom), myDATA + E3 codes
- **VAT Summaries**: 29 πεδία, computed/aggregate (ΟΧΙ persisted collection), τριμηνιαία Φ2 + ετήσια εκκαθάριση
- **Bank Transactions**: 19 πεδία, 3 enums, matching engine (4 entity types: invoice/journal/efka/tax)
- **Expense Documents**: 33 πεδία, 3 enums, AI extraction (OpenAI gpt-4o-mini vision), dual data layer (AI vs confirmed)
- **EFKA**: 30+ πεδία, 3 enums, 3 εταιρικά variants (ΟΕ Partnership, ΕΠΕ, ΑΕ dual-mode employee/self-employed)
- **19 σχέσεις** σύνολο (13 εσωτερικές accounting↔accounting + 6 εξωτερικές → contacts, projects, units, purchase_orders)
- **8 Firestore collections** (accounting_invoices, journal_entries, bank_transactions, bank_accounts, import_batches, expense_documents, efka_payments, efka_config)
- **1 computed entity** (VAT Summaries)
- **Regulatory compliance**: ΦΠΑ Ν.2859/2000, ΕΦΚΑ Ν.4387/2016, myDATA ΑΑΔΕ, Παρακράτηση ADR-ACC-020

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
