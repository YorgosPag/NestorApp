# SPEC-012: Πλήρης Χαρτογράφηση — Έργα (Projects)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/project.ts`, `src/types/project/addresses.ts`, `src/components/projects/ika/contracts.ts`)

---

## 1. Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `projects` |
| **TypeScript** | `Project` (interface) |
| **Summary Type** | `ProjectSummary` (Pick<Project, ...> + overrides) |
| **ID Pattern** | Enterprise ID: `proj_XXXXX` (`enterprise-id.service.ts`) |
| **Tenant Isolation** | `companyId` (ADR-029) |
| **Form Config** | `src/config/project-tabs-config.ts` (17 tabs) |
| **Tabs** | 17 tabs: General, Locations, Structure, Ownership, Landowners, Contributors, Brokers, Customers, Timeline, IKA, Floorplan, Parking Floorplan, Measurements, Documents, Photos, Videos, History |
| **Upload Entry Points** | 17 entry points σε 5 κατηγορίες (Administration, Brokerage, Construction, Accounting, Generic) |

---

## 2. Πλήρης Κατάλογος Πεδίων

### 2.1 Βασικά Στοιχεία Ταυτοποίησης

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID (`proj_XXXXX`) |
| 2 | `projectCode` | string | No | Ανθρώπινα αναγνώσιμος κωδικός (π.χ. "PRJ-001") |
| 3 | `name` | string | Yes | Όνομα έργου |
| 4 | `title` | string | Yes | Τίτλος εμφάνισης |
| 5 | `status` | ProjectStatus | Yes | `planning` / `in_progress` / `completed` / `on_hold` / `cancelled` |
| 6 | `company` | string | Yes | Όνομα εταιρείας (tenant) |
| 7 | `companyId` | string | Yes | Company document ID (tenant isolation, ADR-029) |

### 2.2 Business Entity Link (ADR-232)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 8 | `linkedCompanyId` | string \| null | No | Σύνδεση με επιχειρηματική οντότητα (ξεχωριστή από tenant companyId) |
| 9 | `linkedCompanyName` | string \| null | No | Denormalized όνομα εταιρείας (ADR-232) |

### 2.3 Διευθύνσεις

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 10 | `address` | string | Yes | LEGACY: Backward compatibility — auto-synced από primary address |
| 11 | `city` | string | Yes | LEGACY: Backward compatibility — auto-synced από primary address |
| 12 | `addresses` | ProjectAddress[] | No | ADR-167: Multi-address system (πολλαπλές είσοδοι, παραδόσεις, κλπ) |

### 2.4 Οικονομικά & Μέγεθος

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 13 | `progress` | number | Yes | Ποσοστό ολοκλήρωσης (%) |
| 14 | `totalValue` | number | Yes | Συνολική αξία έργου (€) |
| 15 | `totalArea` | number | Yes | Συνολική επιφάνεια (τ.μ.) |
| 16 | `budget` | number | No | Προϋπολογισμός (€) |

### 2.5 Χρονικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 17 | `startDate` | ISO date | No | Ημ/νία έναρξης |
| 18 | `completionDate` | ISO date | No | Ημ/νία ολοκλήρωσης |
| 19 | `endDate` | ISO date | No | Αναμενόμενη λήξη |
| 20 | `lastUpdate` | ISO timestamp | Yes | Τελευταία ενημέρωση |
| 21 | `duration` | number | No | Εκτιμώμενη διάρκεια (μήνες) |
| 22 | `startYear` | number | No | Έτος έναρξης (για φιλτράρισμα) |

### 2.6 Περιγραφικά & Κατηγοριοποίηση

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 23 | `description` | string | No | Περιγραφή έργου |
| 24 | `location` | string | No | Τοποθεσία (πόλη/περιοχή) για φιλτράρισμα |
| 25 | `client` | string | No | Πελάτης/πελάτισσα |
| 26 | `type` | ProjectType | No | `residential` / `commercial` / `industrial` / `mixed` / `infrastructure` / `renovation` |
| 27 | `priority` | ProjectPriority | No | `low` / `medium` / `high` / `critical` |
| 28 | `riskLevel` | ProjectRiskLevel | No | `low` / `medium` / `high` / `critical` |
| 29 | `complexity` | ProjectComplexity | No | `simple` / `moderate` / `complex` / `highly_complex` |

### 2.7 Αδειοδότηση & Πρωτόκολλο

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 30 | `buildingBlock` | string | No | Οικοδομικό τετράγωνο |
| 31 | `protocolNumber` | string | No | Αριθμός πρωτοκόλλου |
| 32 | `licenseNumber` | string | No | Αριθμός αδείας (Πολεοδομία) |
| 33 | `issuingAuthority` | string | No | Αρχή έκδοσης αδείας |
| 34 | `issueDate` | ISO date | No | Ημ/νία έκδοσης αδείας |

### 2.8 Boolean Feature Flags

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 35 | `hasPermits` | boolean | No | Έχει όλες τις άδειες |
| 36 | `hasFinancing` | boolean | No | Εξασφαλισμένη χρηματοδότηση |
| 37 | `isEcological` | boolean | No | Οικολογικό/πράσινο κτίριο |
| 38 | `hasSubcontractors` | boolean | No | Χρησιμοποιεί υπεργολάβους |
| 39 | `isActive` | boolean | No | Ενεργό αυτήν τη στιγμή |
| 40 | `hasIssues` | boolean | No | Αναφερμένα ζητήματα |

### 2.9 Αντιπαροχή & Οικοπεδούχοι (ADR-244)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 41 | `landowners` | LandownerEntry[] \| null | No | SSoT οικοπεδούχων |
| 42 | `bartexPercentage` | number \| null | No | Ποσοστό αντιπαροχής (%) |
| 43 | `landownerContactIds` | string[] \| null | No | Denormalized IDs για Firestore array-contains queries |

### 2.10 ΕΦΚΑ Δήλωση (ADR-090)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 44 | `efkaDeclaration` | EfkaDeclarationData | No | Αναγγελία έργου στο e-ΕΦΚΑ (nested object, βλ. §3.2) |

---

## 3. Nested Objects / Arrays

### 3.1 Διευθύνσεις Έργου (`addresses[]`) — ADR-167

**Path**: `projects/{id}.addresses[]` (embedded array)

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `id` | string | Yes | Μοναδικός αναγνωριστικός |
| `street` | string | Yes | Οδός (π.χ. "Σαμοθράκης") |
| `number` | string | No | Αριθμός (π.χ. "16") |
| `city` | string | Yes | Πόλη/Οικισμός |
| `postalCode` | string | Yes | Τ.Κ. (π.χ. "54621") |
| `region` | string | No | Περιφέρεια |
| `regionalUnit` | string | No | Περιφερειακή Ενότητα |
| `country` | string | Yes | Χώρα (default: "Greece") |
| `type` | ProjectAddressType | Yes | `site` / `entrance` / `delivery` / `legal` / `postal` / `billing` / `correspondence` / `other` |
| `isPrimary` | boolean | Yes | Κύρια διεύθυνση (ακριβώς μία) |
| `label` | string | No | Ανθρώπινη ετικέτα (π.χ. "Κύρια Είσοδος") |
| `blockSide` | BlockSideDirection | No | `north` / `south` / `east` / `west` / `northeast` / `northwest` / `southeast` / `southwest` / `corner` / `internal` |
| `blockSideDescription` | string | No | Περιγραφή (π.χ. "Πρόσοψη επί Σαμοθράκης") |
| `cadastralCode` | string | No | ΚΑΕΚ (Κτηματολογικός Αναγνωριστικός Κωδικός) |
| `municipality` | string | No | Δήμος (π.χ. "Δήμος Καλαμαριάς") |
| `neighborhood` | string | No | Γειτονιά (π.χ. "Άνω Τούμπα") |
| `coordinates` | `{ lat: number; lng: number }` | No | GPS συντεταγμένες |
| `sortOrder` | number | No | Σειρά εμφάνισης |

**Invariants**:
- Ακριβώς ΜΙΑ address με `isPrimary = true`
- Κανένα duplicate ID
- Legacy πεδία (address, city) auto-synced από primary

### 3.2 ΕΦΚΑ Δήλωση (`efkaDeclaration`) — ADR-090

**Path**: `projects/{id}.efkaDeclaration` (embedded object, 1:1)

#### Βασικά Πεδία ΕΦΚΑ (7 required)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `employerVatNumber` | string \| null | 1. ΑΦΜ Εργοδότη |
| `projectAddress` | string \| null | 2. Διεύθυνση Έργου |
| `projectDescription` | string \| null | 3. Περιγραφή Έργου |
| `startDate` | ISO date \| null | 4. Ημ/νία Έναρξης |
| `estimatedEndDate` | ISO date \| null | 5. Εκτιμώμενη Ημ/νία Λήξης |
| `estimatedWorkerCount` | number \| null | 6. Εκτιμώμενος Αριθμός Εργαζομένων |
| `projectCategory` | EfkaProjectCategory \| null | 7. Κατηγορία: `construction` / `technical` |

#### ΑΜΟΕ

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `amoe` | string \| null | Αριθμός Μητρώου Οικοδομοτεχνικού Έργου |
| `amoeAssignedDate` | ISO date \| null | Ημ/νία εκχώρησης ΑΜΟΕ |

#### Status & Tracking

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `status` | EfkaDeclarationStatus | `draft` / `preparation` / `submitted` / `active` / `amended` / `closed` |
| `documents` | EfkaDocument[] | Έγγραφα Ε.1, Ε.3, Ε.4 |

#### Audit

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `createdAt` | ISO timestamp | Δημιουργία |
| `createdBy` | string | User ID |
| `updatedAt` | ISO timestamp | Τελευταία ενημέρωση |
| `updatedBy` | string | User ID |
| `submittedAt` | ISO timestamp \| null | Ημ/νία υποβολής |
| `submittedBy` | string \| null | User ID υποβολής |
| `notes` | string \| null | Σημειώσεις |

#### ΕΦΚΑ Document (`documents[]`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `type` | EfkaDocumentType | `E1` / `E3` / `E4` |
| `label` | string | π.χ. "Ε.1 — Αναγγελία Πρόσληψης" |
| `status` | EfkaDocumentStatus | `pending` / `uploaded` / `submitted` / `approved` |
| `fileUrl` | string \| null | URL αρχείου |
| `uploadedAt` | ISO timestamp \| null | Ημ/νία upload |
| `submittedAt` | ISO timestamp \| null | Ημ/νία υποβολής |
| `notes` | string \| null | Σημειώσεις |

### 3.3 Οικοπεδούχοι (`landowners[]`) — ADR-244

**Path**: `projects/{id}.landowners[]` (embedded array)

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `contactId` | string (readonly) | Yes | Contact ID οικοπεδούχου |
| `name` | string (readonly) | Yes | Πλήρες όνομα (denormalized) |
| `landOwnershipPct` | number (readonly) | Yes | Ποσοστό ιδιοκτησίας οικοπέδου (π.χ. 33.33 = 1/3) |
| `allocatedShares` | number (readonly) | Yes | Χιλιοστά (auto-calculated) |

---

## 4. Subcollections

**Path patterns** (root-level):

| Subcollection | Path | Περιγραφή |
|---------------|------|-----------|
| `tasks` | `projects/{projectId}/tasks` | Εργασίες/tasks ανά έργο |
| `documents` | `projects/{projectId}/documents` | Έγγραφα ανά έργο |
| `timeline` | `projects/{projectId}/timeline` | Χρονολόγιο δραστηριοτήτων |

**Path patterns** (company-scoped RBAC):

| Subcollection | Path | Περιγραφή |
|---------------|------|-----------|
| `projects` | `companies/{companyId}/projects` | Έργα ανά εταιρεία |
| `members` | `companies/{companyId}/projects/{projectId}/members` | Μέλη ανά έργο (RBAC) |

---

## 5. Σχέσεις με ΟΛΕΣ τις Οντότητες (Relationship Map)

### 5.1 Διάγραμμα Σχέσεων

```
                              ┌──────────────┐
                              │    ΕΡΓΟ      │
                              │  (projects)  │
                              └──────┬───────┘
                                     │
     ┌──────────────┬────────────────┼────────────────┬──────────────┐
     │              │                │                │              │
┌────┴────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌─────┴─────┐ ┌─────┴─────┐
│ ΔΟΜΗ    │  │ ΑΝΘΡΩΠΟΙ    │  │ ΟΙΚΟΝΟΜΙΚΑ  │  │ ΚΑΤΑΣΚΕΥΗ │ │ ΕΓΓΡΑΦΑ   │
│         │  │             │  │             │  │           │ │           │
├─────────┤  ├─────────────┤  ├─────────────┤  ├───────────┤ ├───────────┤
│buildings│  │contact_links│  │cheques      │  │constr_    │ │files      │
│units    │  │contacts     │  │legal_contr. │  │ phases    │ │file_links │
│floors   │  │ (via links) │  │payment_plans│  │constr_    │ │project_   │
│parking  │  │brokerage_   │  │invoices     │  │ tasks     │ │ floorplans│
│storage  │  │ agreements  │  │purchase_ord.│  │constr_    │ │           │
│ownership│  │commission_  │  │obligations  │  │ baselines │ │           │
│ _tables │  │ records     │  │obl_transm.  │  │constr_    │ │           │
└─────────┘  │assignment_  │  │acct_journal │  │ resource_ │ └───────────┘
             │ policies    │  │acct_invoices│  │ assign.   │
             └─────────────┘  │acct_expenses│  │bldg_      │
                              │acct_bank_tx │  │ milestones│
                              │boq_items    │  └───────────┘
                              └─────────────┘
                                     │
                              ┌──────┴──────┐
                              │ CRM         │
                              ├─────────────┤
                              │opportunities│
                              │communic.    │
                              │tasks        │
                              │conversations│
                              │calendar_evts│
                              └─────────────┘
```

### 5.2 Αναλυτικός Πίνακας Σχέσεων

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Ρόλος Project | Περιγραφή |
|---|------------|-------------------|-------|---------------|-----------|
| 1 | **buildings** | `projectId` | 1:N | Parent | Κτίρια ανήκουν σε έργο |
| 2 | **units** | `projectId` | 1:N | Parent | Μονάδες μπορούν να αναφέρουν project άμεσα |
| 3 | **parking_spots** | `projectId` | 1:N | Parent | Θέσεις στάθμευσης ανά έργο |
| 4 | **storage_units** | `projectId` | 1:N | Parent | Αποθήκες ανά έργο |
| 5 | **floors** | via `buildingId` → `projectId` | 1:N:N | Grandparent | Όροφοι μέσω κτιρίων |
| 6 | **ownership_tables** | `projectId` | 1:1 | Owner | ΕΝΑΣ πίνακας χιλιοστών ανά έργο (οικόπεδο) |
| 7 | **contact_links** | `targetEntityId` (type='project') | N:M | Target | Junction: contacts → project (engineer, contractor, κλπ) |
| 8 | **brokerage_agreements** | `projectId` | 1:N | Scope | Μεσιτικές συμφωνίες (scope: project ή unit) |
| 9 | **commission_records** | `projectId` | 1:N | Context | Καταγραφή προμηθειών |
| 10 | **cheques** | `projectId` | 1:N | Context | Αξιόγραφα (εισερχόμενα/εξερχόμενα) |
| 11 | **legal_contracts** | `projectId` | 1:N | Context | Συμβόλαια (προσυμφωνητικά → οριστικά) |
| 12 | **payment_plans** | via `units/{unitId}/payment_plans` | 1:N:N | Indirect | Πλάνα πληρωμών μέσω μονάδων |
| 13 | **invoices** | `projectId` | 1:N | Context | Τιμολόγια |
| 14 | **purchase_orders** | `projectId` | 1:N | Context | Παραγγελίες αγοράς (ADR-267) |
| 15 | **boq_items** | `projectId` | 1:N | Owner | Αντικείμενα ΒΟQ (ADR-175) |
| 16 | **obligations** | `projectId` | 1:N | Context | Υποχρεώσεις |
| 17 | **obligation_transmittals** | `projectId` | 1:N | Context | Διαβιβαστικά υποχρεώσεων |
| 18 | **construction_phases** | via `buildingId` → `projectId` | 1:N:N | Indirect | Φάσεις κατασκευής μέσω κτιρίων |
| 19 | **construction_tasks** | via `phaseId` → `buildingId` | 1:N:N:N | Indirect | Εργασίες κατασκευής |
| 20 | **construction_baselines** | via `buildingId` → `projectId` | 1:N:N | Indirect | Baselines (ADR-266 Phase C) |
| 21 | **construction_resource_assignments** | via `buildingId` → `projectId` | 1:N:N | Indirect | Πόροι κατασκευής (ADR-266 Phase C) |
| 22 | **building_milestones** | via `buildingId` → `projectId` | 1:N:N | Indirect | Ορόσημα κατασκευής |
| 23 | **opportunities** | via `interestedIn.projectIds` | N:M | Target | CRM pipeline — leads ενδιαφέρονται |
| 24 | **communications** | `projectId` | 1:N | Context | Επικοινωνίες (email, SMS, κλπ) |
| 25 | **tasks** | `projectId` | 1:N | Context | CRM εργασίες |
| 26 | **conversations** | `projectId` | 1:N | Context | Συνομιλίες |
| 27 | **calendar_events** | `projectId` | 1:N | Context | Ημερολόγιο (source: task) |
| 28 | **files** | `projectId` | 1:N | Scope | Αρχεία (tenant isolation) |
| 29 | **file_links** | `targetEntityId` (type='project') | N:M | Target | Virtual folder links (ADR-191) |
| 30 | **project_floorplans** | top-level collection | 1:N | Owner | Κατόψεις (ADR-033) |
| 31 | **assignment_policies** | `projectId` / `constraints.projectIds` | 1:N / N:M | Scope | Auto-assignment πολιτικές |
| 32 | **accounting_journal_entries** | `projectId` | 1:N | Context | Λογιστικά ημερολόγια |
| 33 | **accounting_invoices** | `projectId` | 1:N | Context | Λογιστικά τιμολόγια |
| 34 | **accounting_expense_documents** | `projectId` | 1:N | Context | Λογιστικά έξοδα |
| 35 | **accounting_bank_transactions** | `projectId` | 1:N | Context | Τραπεζικές κινήσεις |
| 36 | **contacts (landowners)** | `landowners[].contactId` / `landownerContactIds[]` | N:M | Bartex | Οικοπεδούχοι (ADR-244) |

---

## 6. Report Builder Impact — Τι σημαίνει αυτό για τα Domains

### 6.1 Domain A1 (Έργα) — Στήλες

**Tier 1 (Flat Table) — Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Κωδικός | `projectCode` | text | |
| Όνομα | `name` | text | |
| Τίτλος | `title` | text | |
| Status | `status` | enum | planning/in_progress/completed/on_hold/cancelled |
| Τύπος | `type` | enum | residential/commercial/industrial/mixed/infrastructure/renovation |
| Εταιρεία | `company` | text | Tenant company |
| Linked Company | `linkedCompanyName` | text | ADR-232 |
| Πρόοδος (%) | `progress` | number | |
| Συνολική Αξία | `totalValue` | currency | € |
| Προϋπολογισμός | `budget` | currency | € |
| Συν. Επιφάνεια | `totalArea` | number | τ.μ. |
| Πόλη | `addresses[isPrimary].city` | text | Flat: μόνο primary address |
| Τ.Κ. | `addresses[isPrimary].postalCode` | text | |
| Δήμος | `addresses[isPrimary].municipality` | text | |
| Τοποθεσία | `location` | text | |
| Πελάτης | `client` | text | |
| Ημ/νία Έναρξης | `startDate` | date | |
| Ημ/νία Ολοκλήρ. | `completionDate` | date | |
| Διάρκεια (μήνες) | `duration` | number | |
| Προτεραιότητα | `priority` | enum | low/medium/high/critical |
| Επίπεδο Κινδύνου | `riskLevel` | enum | low/medium/high/critical |
| Πολυπλοκότητα | `complexity` | enum | simple/moderate/complex/highly_complex |
| Αρ. Αδείας | `licenseNumber` | text | |
| Αρχή Έκδοσης | `issuingAuthority` | text | |
| Αρ. Πρωτοκόλλου | `protocolNumber` | text | |
| Αντιπαροχή (%) | `bartexPercentage` | number | ADR-244 |
| Έχει Άδειες | `hasPermits` | boolean | |
| Έχει Χρηματοδ. | `hasFinancing` | boolean | |
| Οικολογικό | `isEcological` | boolean | |
| ΑΜΟΕ | `efkaDeclaration.amoe` | text | |
| ΕΦΚΑ Status | `efkaDeclaration.status` | enum | |
| Τελ. Ενημέρωση | `lastUpdate` | datetime | |

**Tier 1 — Computed/Joined columns (cross-entity):**

| Στήλη | Join | Τύπος | Σημείωση |
|-------|------|-------|----------|
| Αρ. Κτιρίων | COUNT buildings WHERE projectId | number | |
| Αρ. Μονάδων | COUNT units WHERE projectId (via buildings) | number | |
| Πωλημένες Μον. | COUNT units WHERE status='sold' | number | |
| Αρ. Θέσεων Parking | COUNT parking_spots WHERE projectId | number | |
| Αρ. Αποθηκών | COUNT storage_units WHERE projectId | number | |
| Αρ. Ορόφων | COUNT floors (via buildings) | number | |
| Αρ. Συμβολαίων | COUNT legal_contracts WHERE projectId | number | |
| Αρ. Αξιογράφων | COUNT cheques WHERE projectId | number | |
| Σύν. Αξιογράφων | SUM cheques.amount WHERE projectId | currency | € |
| Αρ. Παραγγελιών | COUNT purchase_orders WHERE projectId | number | |
| Σύν. Παραγγελιών | SUM purchase_orders.totalAmount | currency | € |
| Αρ. Τιμολογίων | COUNT invoices WHERE projectId | number | |
| Αρ. Μεσιτικών | COUNT brokerage_agreements WHERE projectId | number | |
| Αρ. Συνεργατών | COUNT contact_links WHERE targetEntityType='project' | number | Engineers, contractors, κλπ |
| Αρ. Οικοπεδούχων | LENGTH landowners[] | number | |
| Αρ. Leads | COUNT opportunities WHERE interestedIn.projectIds | number | CRM |
| Αρ. Επικοινωνιών | COUNT communications WHERE projectId | number | |
| Αρ. BOQ Items | COUNT boq_items WHERE projectId | number | |
| Αρ. Κατ. Φάσεων | COUNT construction_phases (via buildings) | number | |

### 6.2 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `addresses[]` | type, street, number, city, postalCode, municipality, isPrimary, blockSide, cadastralCode | ~5 |
| `landowners[]` | contactId, name, landOwnershipPct, allocatedShares | ~10 |
| `efkaDeclaration.documents[]` | type, label, status, fileUrl | 3 (E1, E3, E4) |

**Cross-entity row expansion sources:**

| Source | Πεδία ανά row | Join Key |
|--------|---------------|----------|
| buildings | id, name, status, floors, totalArea | projectId |
| units | id, code, type, status, buyerName, price | via buildingId |
| contact_links | contactName, role, relationship | targetEntityId |
| cheques | number, amount, issueDate, dueDate, status | projectId |
| legal_contracts | type, status, buyerName, signDate | projectId |
| purchase_orders | poNumber, supplier, totalAmount, status | projectId |

### 6.3 Tier 3 (Project Card PDF) — Sections

```
┌─────────────────────────────────────────────────┐
│ [LOGO] ΟΝΟΜΑ ΕΡΓΟΥ                              │
│        Κωδικός: PRJ-001 | Status | Τύπος        │
├─────────────────────────────────────────────────┤
│ ΒΑΣΙΚΑ ΣΤΟΙΧΕΙΑ                                  │
│ Εταιρεία | Πελάτης | Αξία | Εμβαδόν            │
│ Προϋπολογισμός | Πρόοδος (%) | Διάρκεια        │
│ Προτεραιότητα | Κίνδυνος | Πολυπλοκότητα       │
├─────────────────────────────────────────────────┤
│ ΑΔΕΙΟΔΟΤΗΣΗ                                      │
│ Αρ. Αδείας | Αρχή Έκδοσης | Ημ/νία            │
│ Αρ. Πρωτοκόλλου | Οικοδ. Τετράγωνο            │
│ [flags]: Άδειες ✅ | Χρηματοδ. ✅ | Οικολ. ❌   │
├─────────────────────────────────────────────────┤
│ ΔΙΕΥΘΥΝΣΕΙΣ                                      │
│ [πίνακας: τύπος, οδός, πόλη, Τ.Κ., ΚΑΕΚ]      │
├─────────────────────────────────────────────────┤
│ ΕΦΚΑ (conditional — αν υπάρχει)                  │
│ ΑΜΟΕ | Status | Εργαζόμενοι | Κατηγορία        │
│ Έγγραφα: Ε.1/Ε.3/Ε.4 [status badges]          │
├─────────────────────────────────────────────────┤
│ ΑΝΤΙΠΑΡΟΧΗ (conditional — αν landowners)         │
│ Ποσοστό: X% | Οικοπεδούχοι:                    │
│ [πίνακας: όνομα, %, χιλιοστά]                  │
├─────────────────────────────────────────────────┤
│ ΔΟΜΗ ΕΡΓΟΥ                                       │
│ [πίνακας: Κτίρια, Μονάδες, Parking, Αποθήκες]  │
│ Συν. Κτίρια: X | Μονάδες: Y | Parking: Z       │
├─────────────────────────────────────────────────┤
│ ΣΥΝΕΡΓΑΤΕΣ (via contact_links)                   │
│ [πίνακας: Όνομα, Ρόλος, Ειδικότητα]           │
├─────────────────────────────────────────────────┤
│ ΟΙΚΟΝΟΜΙΚΑ                                       │
│ Αξιόγραφα: X αρ., Y€ | Συμβόλαια: Z           │
│ Παραγγελίες: W αρ., V€ | Τιμολόγια: K         │
├─────────────────────────────────────────────────┤
│ ΧΡΟΝΙΚΑ                                          │
│ Έναρξη | Ολοκλήρωση | Διάρκεια (μήνες)        │
│ Τελευταία Ενημέρωση                             │
├─────────────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                                       │
│ [description]                                   │
└─────────────────────────────────────────────────┘
```

---

## 7. Στατιστικά

| Μέτρηση | Τιμή |
|---------|------|
| Πεδία Project (direct) | 44 |
| Πεδία addresses[] (nested) | 17 per address |
| Πεδία efkaDeclaration (nested) | ~25 (incl. documents[]) |
| Πεδία landowners[] (nested) | 4 per entry |
| Enums (type-safe) | 6 (ProjectStatus, ProjectType, ProjectPriority, ProjectRiskLevel, ProjectComplexity, ProjectAddressType) |
| Subcollections (root-level) | 3 (tasks, documents, timeline) |
| Subcollections (RBAC) | 2 (company_projects, project_members) |
| Cross-entity references | 36 collections |
| Tier 1 flat columns | 31 |
| Tier 1 computed columns | 19 |
| Tier 2 array sources | 3 embedded + 6 cross-entity |
| **Σύνολο πεδίων (πλήρες Project)** | **~90+** |
