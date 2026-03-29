# SPEC-009: Phase 4 — Domains A5-A6, B1-B8 + Tier 2 Export

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.2
**Last Updated**: 2026-03-29
**Q&A References**: Q76-Q94

---

## Σύνοψη

Phase 4 προσθέτει **10 νέα domains** (A5-A6, B1-B8) και τον **Tier 2 Export Engine** (generic row repetition). Σπάει σε 3 υποφάσεις (4a, 4b, 4c) λόγω context limits.

---

## Υποφάσεις

| Υποφάση | Domains | Scope |
|---------|---------|-------|
| **4a** | A5 Parking, A6 Storage, B1 Individuals, B2 Companies & Services | **IMPLEMENTED 2026-03-29** — 4 domain configs + query engine + grouped UI |
| **4b** | B3 Buyers, B4 Suppliers, B5 Engineers, B6 Workers, B7 Lawyers/Notaries, B8 Agents | **IMPLEMENTED 2026-03-29** — 6 domains + persona resolver + personaTypes sync |
| **4c** | Tier 2 Export Engine + Q47 Bucket Grouping + Q49 Conditional Highlighting | Generic engine + 2 deferred features |

---

## Phase 4a: A5 Parking, A6 Storage, B1 Individuals, B2 Companies & Services

### A5. Θέσεις Στάθμευσης (Parking)

| Property | Value |
|----------|-------|
| **Collection** | `parking_spots` (`COLLECTIONS.PARKING_SPACES`) |
| **Pre-filter** | — (dedicated collection) |
| **Entity Link** | `/parking/{id}` |
| **Default Sort** | name (asc) |

**Πεδία** (ακριβή ονόματα θα προκύψουν από Firestore schema κατά την υλοποίηση):

| Στήλη | Πεδίο | Τύπος | Default Visible |
|-------|-------|-------|----------------|
| Κωδικός | code | text | yes |
| Αριθμός | number | text | yes |
| Κτίριο | _ref: building.name | text | yes |
| Ζώνη | zone | enum | yes |
| Τύπος | type | enum | yes |
| Status | status | enum | yes |
| Εμβαδόν | area | number | yes |
| Τιμή | price | currency | yes |
| Όροφος | floor | text | no |
| Εμπορική Κατάσταση | commercialStatus | enum | yes |
| Αγοραστής | _ref: buyer.name | text | no |
| Συνδεδεμένη Μονάδα | _ref: unit.name | text | no |

### A6. Αποθήκες (Storage)

| Property | Value |
|----------|-------|
| **Collection** | `storage_units` (`COLLECTIONS.STORAGE`) |
| **Pre-filter** | — (dedicated collection) |
| **Entity Link** | `/storage/{id}` |
| **Default Sort** | name (asc) |

**Πεδία**:

| Στήλη | Πεδίο | Τύπος | Default Visible |
|-------|-------|-------|----------------|
| Κωδικός | code | text | yes |
| Όνομα | name | text | yes |
| Κτίριο | _ref: building.name | text | yes |
| Τύπος | type | enum | yes |
| Status | status | enum | yes |
| Εμβαδόν | area | number | yes |
| Τιμή | price | currency | yes |
| Εμπορική Κατάσταση | commercialStatus | enum | yes |
| Αγοραστής | _ref: buyer.name | text | no |
| Ηλεκτρικό | amenities.electricity | boolean | no |
| Ύδρευση | amenities.water | boolean | no |
| Κλιματισμός | amenities.climate | boolean | no |
| Συνδεδεμένη Μονάδα | _ref: unit.name | text | no |

### B1. Φυσικά Πρόσωπα (Individuals)

| Property | Value |
|----------|-------|
| **Collection** | `contacts` (`COLLECTIONS.CONTACTS`) |
| **Pre-filter** | `type = 'individual'` |
| **Entity Link** | `/contacts/{id}` |
| **Default Sort** | lastName (asc) |

**Πεδία** (~15 default visible, ~25 selectable):

| Στήλη | Πεδίο | Τύπος | Default Visible |
|-------|-------|-------|----------------|
| Όνομα | firstName | text | yes |
| Επώνυμο | lastName | text | yes |
| Πατρώνυμο | patronymic | text | no |
| ΑΦΜ | vatNumber | text | yes |
| ΔΟΥ | taxOffice | text | no |
| ΑΜΚΑ | amka | text | no |
| Επάγγελμα | profession | text | no |
| Email (κύριο) | emails[0].value | text | yes |
| Τηλέφωνο (κύριο) | phones[0].value | text | yes |
| Πόλη | addresses[0].city | text | yes |
| Διεύθυνση | addresses[0].street | text | no |
| ΤΚ | addresses[0].postalCode | text | no |
| Status | status | enum | yes |
| Personas | _computed: personas[].type joined | text | yes |
| Πληρότητα | completenessRate | percentage | yes |
| Εργοδότης | employer | text | yes |
| Ημ/νία Δημιουργίας | createdAt | date | no |

**Tier 2 Arrays** (ξεδίπλωμα στο Excel):
- `emails[]` → Email Type + Email Value
- `phones[]` → Phone Type + Phone Value
- `addresses[]` → Address Type + Street + City + Postal Code
- `personas[]` → Persona Type + Status
- `socialMedia[]` → Platform + URL

### B2. Εταιρείες & Υπηρεσίες (Companies & Services)

| Property | Value |
|----------|-------|
| **Collection** | `contacts` (`COLLECTIONS.CONTACTS`) |
| **Pre-filter** | `type = 'company' OR type = 'service'` |
| **Entity Link** | `/contacts/{id}` |
| **Default Sort** | companyName (asc) |

**Πεδία**:

| Στήλη | Πεδίο | Τύπος | Default Visible |
|-------|-------|-------|----------------|
| Επωνυμία | companyName | text | yes |
| Κατηγορία | type | enum: company/service | yes |
| Νομική Μορφή | legalForm | enum: ΑΕ/ΕΠΕ/ΙΚΕ/ΟΕ/ΕΕ/... | yes |
| Τύπος Υπηρεσίας | serviceType | enum: ministry/municipality/... | yes |
| ΑΦΜ | vatNumber | text | yes |
| ΓΕΜΗ | registrationNumber | text | no |
| ΔΟΥ | taxOffice | text | no |
| Κλάδος | industry | text | yes |
| Εργαζόμενοι | numberOfEmployees | number | no |
| Ετήσιος Τζίρος | annualRevenue | currency | no |
| Email (κύριο) | emails[0].value | text | yes |
| Τηλέφωνο (κύριο) | phones[0].value | text | yes |
| Πόλη | addresses[0].city | text | yes |
| Status | status | enum | yes |
| Ημ/νία Δημιουργίας | createdAt | date | no |

**Tier 2 Arrays**: emails[], phones[], addresses[], contactPersons[]

**Σημείωση**: Νομική Μορφή εμφανίζεται ΜΟΝΟ αν type=company. Τύπος Υπηρεσίας ΜΟΝΟ αν type=service. Conditional visibility στο UI.

---

## Phase 4b: B3 Buyers, B4-B8 Persona Domains

### B3. Αγοραστές (Buyers) — Transaction-based (Q79)

| Property | Value |
|----------|-------|
| **Collection** | `units` (`COLLECTIONS.UNITS`) |
| **Pre-filter** | `commercial.buyerContactId != null` |
| **Entity Link** | `/units/{id}` |
| **Default Sort** | commercial.buyerName (asc) |

**Αρχιτεκτονική**: Enterprise transaction-based pattern (Salesforce/SAP). Buyer = entity που αγόρασε, όχι label.

**Πεδία**:

| Στήλη | Πεδίο | Τύπος | Default Visible |
|-------|-------|-------|----------------|
| Αγοραστής | commercial.buyerName | text | yes |
| Μονάδα | name | text | yes |
| Κωδικός Μονάδας | code | text | yes |
| Κτίριο | _ref: building.name | text | yes |
| Έργο | _ref: project.name | text | yes |
| Τιμή Ζήτησης | commercial.askingPrice | currency | yes |
| Τελική Τιμή | commercial.finalPrice | currency | yes |
| Νομική Φάση | commercial.legalPhase | enum | yes |
| Σύνολο Πληρωμών | commercial.paymentSummary.totalAmount | currency | no |
| Πληρωμένο | commercial.paymentSummary.paidAmount | currency | yes |
| % Πληρωμής | commercial.paymentSummary.paidPercentage | percentage | yes |
| Ληξιπρόθεσμες Δόσεις | commercial.paymentSummary.overdueInstallments | number | yes |
| Ημ/νία Πώλησης | commercial.saleDate | date | no |
| Τύπος Μονάδας | type | enum | no |

**Cross-resolution**: `commercial.buyerContactId` → resolve από contacts (φυσικό πρόσωπο) ή companies (νομικό πρόσωπο)

### B4. Προμηθευτές (Suppliers)

| Property | Value |
|----------|-------|
| **Collection** | `contacts` (`COLLECTIONS.CONTACTS`) |
| **Pre-filter** | `personas[] contains personaType = 'supplier'` |
| **Entity Link** | `/contacts/{id}` |
| **Default Sort** | lastName (asc) |

**Πεδία**:

| Στήλη | Πεδίο | Τύπος | Default Visible |
|-------|-------|-------|----------------|
| Όνομα | displayName | text | yes |
| ΑΦΜ | vatNumber | text | yes |
| Κατηγορία | _persona: supplier.category | text | yes |
| Όροι Πληρωμής | _persona: supplier.paymentTerms | text | yes |
| Email | emails[0].value | text | yes |
| Τηλέφωνο | phones[0].value | text | yes |
| Πόλη | addresses[0].city | text | yes |
| Status | status | enum | yes |
| Αρ. Παραγγελιών | _computed: orderCount | number | no |
| Σύνολο Παραγγελιών | _computed: orderTotal | currency | no |

### B5. Μηχανικοί (Engineers)

| Property | Value |
|----------|-------|
| **Collection** | `contacts` (`COLLECTIONS.CONTACTS`) |
| **Pre-filter** | `personas[] contains personaType = 'engineer'` |
| **Entity Link** | `/contacts/{id}` |
| **Default Sort** | lastName (asc) |

**Πεδία**:

| Στήλη | Πεδίο | Τύπος | Default Visible |
|-------|-------|-------|----------------|
| Όνομα | displayName | text | yes |
| Ειδικότητα | _persona: engineer.specialty | text | yes |
| ΑΜ ΤΕΕ | _persona: engineer.teeRegistryNumber | text | yes |
| Τάξη Πτυχίου | _persona: engineer.licenseClass | text | yes |
| ΠΤΔΕ | _persona: engineer.ptdeNumber | text | no |
| ΑΦΜ | vatNumber | text | yes |
| Email | emails[0].value | text | yes |
| Τηλέφωνο | phones[0].value | text | yes |
| Πόλη | addresses[0].city | text | no |
| Status | status | enum | yes |
| Αρ. Έργων | _computed: projectCount | number | no |

### B6. Εργάτες (Workers)

| Property | Value |
|----------|-------|
| **Collection** | `contacts` (`COLLECTIONS.CONTACTS`) |
| **Pre-filter** | `personas[] contains personaType = 'construction_worker'` |
| **Entity Link** | `/contacts/{id}` |
| **Default Sort** | lastName (asc) |

**Πεδία**:

| Στήλη | Πεδίο | Τύπος | Default Visible |
|-------|-------|-------|----------------|
| Όνομα | displayName | text | yes |
| ΑΜ ΙΚΑ | _persona: worker.ikaNumber | text | yes |
| Ασφαλιστική Κλάση | _persona: worker.insuranceClass | text | yes |
| Τριετίες | _persona: worker.triennia | number | yes |
| Ημερομίσθιο | _persona: worker.dailyWage | currency | yes |
| Κωδικός Ειδικότητας | _persona: worker.specialtyCode | text | yes |
| ΑΦΜ | vatNumber | text | no |
| Email | emails[0].value | text | no |
| Τηλέφωνο | phones[0].value | text | yes |
| Status | status | enum | yes |
| Ώρες Εργασίας | _computed: workHours | number | no |
| Υπερωρίες | _computed: overtimeHours | number | no |

### B7. Νομικοί (Lawyers & Notaries) — (Q80)

| Property | Value |
|----------|-------|
| **Collection** | `contacts` (`COLLECTIONS.CONTACTS`) |
| **Pre-filter** | `personas[] contains personaType = 'lawyer' OR 'notary'` |
| **Entity Link** | `/contacts/{id}` |
| **Default Sort** | lastName (asc) |

**Πεδία**:

| Στήλη | Πεδίο | Τύπος | Default Visible |
|-------|-------|-------|----------------|
| Όνομα | displayName | text | yes |
| Τύπος | _persona: personaType | enum: lawyer/notary | yes |
| ΑΜ Δικηγόρου | _persona: lawyer.barAssociationNumber | text | yes |
| Δικηγορικός Σύλλογος | _persona: lawyer.barAssociation | text | yes |
| ΑΜ Συμβολαιογράφου | _persona: notary.notaryRegistryNumber | text | yes |
| Περιφέρεια | _persona: notary.notaryDistrict | text | yes |
| ΑΦΜ | vatNumber | text | no |
| Email | emails[0].value | text | yes |
| Τηλέφωνο | phones[0].value | text | yes |
| Status | status | enum | yes |
| Αρ. Συμβολαίων | _computed: contractCount | number | no |
| Ρόλος σε Συμβόλαια | _cross: LegalProfessionalRole | enum: seller_lawyer/buyer_lawyer/notary | no |

**Cross-join**: Φίλτρο "Ρόλος σε Συμβόλαια" → join με `legal_contracts` collection → `LegalProfessionalRole`

### B8. Μεσίτες (Real Estate Agents)

| Property | Value |
|----------|-------|
| **Collection** | `contacts` (`COLLECTIONS.CONTACTS`) |
| **Pre-filter** | `personas[] contains personaType = 'real_estate_agent'` |
| **Entity Link** | `/contacts/{id}` |
| **Default Sort** | lastName (asc) |

**Πεδία**:

| Στήλη | Πεδίο | Τύπος | Default Visible |
|-------|-------|-------|----------------|
| Όνομα | displayName | text | yes |
| Αρ. Αδείας | _persona: agent.licenseNumber | text | yes |
| Μεσιτικό Γραφείο | _persona: agent.agency | text | yes |
| ΑΦΜ | vatNumber | text | no |
| Email | emails[0].value | text | yes |
| Τηλέφωνο | phones[0].value | text | yes |
| Πόλη | addresses[0].city | text | no |
| Status | status | enum | yes |
| Αρ. Συμφωνιών | _computed: agreementCount | number | no |
| Ενεργές Συμφωνίες | _computed: activeAgreementCount | number | no |
| Σύνολο Προμηθειών | _computed: commissionTotal | currency | no |

---

## Phase 4c: Tier 2 Export Engine + Deferred Features

### Tier 2 Export Engine (Generic)

**Pattern**: Salesforce/SAP Row Repetition

**Αρχιτεκτονική**: Generic engine που δουλεύει σε ΟΠΟΙΟΔΗΠΟΤΕ domain με nested arrays.

**Input**: Array of field definitions marked as `tier2Array: true`

**Behavior per output format**:

| Format | Handling |
|--------|---------|
| **Excel** | Row repetition — parent record repeats 1 row per child. Max children across all arrays determines row count |
| **PDF** | Joined values — array values concatenated with ", " separator in single cell |
| **On-screen** | Tier 1 only (primary value shown, badge with count) |

**Domains with Tier 2 Arrays**:

| Domain | Arrays |
|--------|--------|
| B1 Individuals | emails[], phones[], addresses[], personas[], socialMedia[] |
| B2 Companies & Services | emails[], phones[], addresses[], contactPersons[] |
| C1 Payment Plans (Phase 5) | installments[], loans[] |
| C2 Cheques (Phase 5) | endorsementChain[] |
| C6 Purchase Orders (Phase 5) | items[] |
| F1 Invoices (Phase 6) | lineItems[], payments[] |

**Row Expansion Algorithm**:
```
Input: record { name: "Γιάννης", emails: [a, b], phones: [x, y, z] }
Output: 3 rows (max of 2 emails, 3 phones)
  Row 1: { name: "Γιάννης", email: a, phone: x }
  Row 2: { name: "Γιάννης", email: b, phone: y }
  Row 3: { name: "Γιάννης", email: null, phone: z }
```

### Q47: Bucket/Range Grouping

**Τι είναι**: Ομαδοποίηση αριθμητικών τιμών σε εύρη (π.χ. Τιμή: 0-50K, 50-100K, 100-200K, 200K+)

**Τύποι buckets**:
- Fixed ranges (manual: user ορίζει breakpoints)
- Equal width (auto: min-max / N buckets)
- Quantile (auto: ίσος αριθμός records ανά bucket)

**UI**: Dropdown "Ομαδοποίηση" → αν επιλεχθεί numeric field → εμφανίζεται "Τύπος: Εύρη / Ίσο Πλάτος / Ποσοτημόρια" + "Αρ. Buckets"

### Q49: Conditional Highlighting Subtotals

**Τι είναι**: Χρωματική επισήμανση aggregated τιμών βάσει thresholds

**Rules**:
- SUM/AVG > median → light green background
- SUM/AVG < 25th percentile → light red background
- COUNT = 0 → gray text

**UI**: Toggle "Χρωματική επισήμανση" (default: off)

---

## UI Domain Selector Layout

```
📋 Report Builder — Επιλέξτε τομέα:

  Ακίνητα:        Έργα | Κτίρια | Όροφοι | Μονάδες | Parking | Αποθήκες
  Πρόσωπα:        Φυσικά Πρόσωπα | Εταιρείες & Υπηρεσίες | Αγοραστές
  Ειδικότητες:    Μηχανικοί | Εργάτες | Νομικοί | Μεσίτες | Προμηθευτές
```

---

## Εκτιμώμενα Αρχεία

### Phase 4a (~8-10 αρχεία):
- 4 domain config files (parking, storage, individuals, companies)
- 1 updated domain-definitions.ts (imports + exports)
- 1 updated report-builder-types.ts (VALID_DOMAIN_IDS + new enums)
- 2 test files
- 1 ADR update

### Phase 4b (~8-10 αρχεία):
- 5-6 domain config files (buyers, suppliers, engineers, workers, legal, agents)
- 1 updated domain-definitions.ts
- 1 updated report-builder-types.ts
- 2 test files
- 1 ADR update

### Phase 4c (~6-8 αρχεία):
- 1 tier2-row-expansion.ts (generic engine)
- 1 bucket-grouping.ts
- 1 conditional-highlighting.ts
- Updated exporter files (PDF + Excel)
- 3 test files
- 1 ADR update

---

## Κανόνες Υλοποίησης

1. Ακριβή field names θα προκύψουν από Firestore schema κατά την υλοποίηση (κώδικας = SSoT)
2. Persona fields accessed via `personas[].{field}` — χρειάζεται resolver στο query engine
3. B3 Buyers: cross-domain query (units → resolve buyerContactId)
4. B7 Lawyers: cross-join με legal_contracts για ρόλο (optional filter)
5. Tier 2 engine: generic, config-driven, δεν γνωρίζει domains
6. 0 new npm packages
7. Κάθε αρχείο < 500 γραμμές (Google SRP)
