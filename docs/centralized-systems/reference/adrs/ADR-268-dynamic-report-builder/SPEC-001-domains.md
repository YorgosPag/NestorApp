# SPEC-001: Domain Definitions

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29

---

## Σύνοψη

20 domains σε 6 groups. Κάθε domain = 1 Firestore collection (ή combination) με ορισμένες στήλες, τύπους, και computed fields.

---

## GROUP A: Ακίνητα & Ιεραρχία

### A1. Έργα (Projects)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Κωδικός | projectCode | text |
| Όνομα | name | text |
| Εταιρεία | company | text |
| Συνδεδεμένη Εταιρεία | linkedCompanyName | text |
| Status | status | enum: planning/in_progress/completed/on_hold/cancelled |
| Τύπος | type | enum: residential/commercial/industrial/mixed/infrastructure/renovation |
| Πρόοδος | progress | percentage |
| Αξία | totalValue | currency |
| Εμβαδόν | totalArea | number |
| Προτεραιότητα | priority | enum: low/medium/high/critical |
| Ρίσκο | riskLevel | enum |
| Πολυπλοκότητα | complexity | enum |
| Budget | budget | currency |
| Ημ/νία Έναρξης | startDate | date |
| Ημ/νία Ολοκλήρωσης | completionDate | date |
| Αρ. Κτιρίων | _computed | number |
| Αρ. Μονάδων | _computed | number |
| Αρ. Οικοπεδούχων | _computed: landowners.length | number |
| % Αντιπαροχής | bartexPercentage | percentage |
| Οικ. Άδεια | licenseNumber | text |
| Αρχή Έκδοσης | issuingAuthority | text |

### A2. Κτίρια (Buildings)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Όνομα | name | text |
| Έργο | _ref: project.name | text |
| Κατηγορία | category | enum: residential/commercial/industrial/mixed |
| Status | status | enum: planning/construction/completed/active |
| Πρόοδος | progress | percentage |
| Εμβαδόν | totalArea | number |
| Αξία | totalValue | currency |
| Όροφοι | floors | number |
| Ενεργειακή Κλάση | energyClass | enum: A+/A/B+/B/C/D/E/F/G |
| Ανακαίνιση | renovation | enum: none/partial/full/planned |
| Έτος Κατασκευής | constructionYear | number |
| Ασανσέρ | hasElevator | boolean |
| Parking | hasParking | boolean |
| Αρ. Μονάδων | _computed | number |
| Αρ. Parking | _computed | number |
| Αρ. Αποθηκών | _computed | number |

### A3. Όροφοι (Floors)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Όνομα | name | text |
| Αρ. Ορόφου | number | number |
| Κτίριο | _ref: building.name | text |
| Έργο | _ref: project.name | text |
| Αρ. Μονάδων | _computed | number |

### A4. Μονάδες (Units)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Κωδικός | code | text |
| Όνομα | name | text |
| Κτίριο | _ref: building.name | text |
| Έργο | _ref: project.name | text |
| Όροφος | floor | number |
| Τύπος | type | enum: studio/apartment_1br/.../villa/shop/office/hall |
| Κατάσταση Κατασκ. | operationalStatus | enum: ready/under-construction/inspection/maintenance/draft |
| Κατάσταση Πώλησης | commercialStatus | enum: unavailable/for-sale/for-rent/reserved/sold/rented |
| Εμβαδόν Μικτό | areas.gross | number |
| Εμβαδόν Καθαρό | areas.net | number |
| Μπαλκόνι | areas.balcony | number |
| Βεράντα | areas.terrace | number |
| Κήπος | areas.garden | number |
| Υπνοδωμάτια | layout.bedrooms | number |
| Μπάνια | layout.bathrooms | number |
| WC | layout.wc | number |
| Επίπεδα | layout.levels | number |
| Τιμή Ζητούμενη | commercial.askingPrice | currency |
| Τιμή Τελική | commercial.finalPrice | currency |
| Αγοραστής | _ref: buyer.displayName | text |
| Ημ/νία Πώλησης | commercial.saleDate | date |
| Νομική Φάση | commercial.legalPhase | enum |
| Κατ. Ενέργειας | energy.class | enum |
| Χιλιοστά | millesimalShares | number |
| Συνδ. Parking | _computed: linkedSpaces[parking].count | number |
| Συνδ. Αποθήκες | _computed: linkedSpaces[storage].count | number |
| Multi-level | isMultiLevel | boolean |

### A5. Θέσεις Στάθμευσης (Parking)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Κωδικός | code | text |
| Αριθμός | number | text |
| Κτίριο | _ref: building.name | text |
| Ζώνη | locationZone | enum: pilotis/underground/open_space/rooftop/covered_outdoor |
| Τύπος | type | enum: standard/handicapped/motorcycle/electric/visitor |
| Status | status | enum: available/occupied/reserved/sold/maintenance |
| Εμβαδόν | area | number |
| Τιμή | price | currency |
| Όροφος | floor | text |
| Κατ. Πώλησης | commercialStatus | enum |
| Αγοραστής | _ref: buyer | text |
| Συνδεδεμένη Μονάδα | _computed: via unit.linkedSpaces | text |

### A6. Αποθήκες (Storage)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Κωδικός | code | text |
| Όνομα | name | text |
| Κτίριο | _ref: building.name | text |
| Τύπος | type | enum: large/small/basement/ground/special/warehouse |
| Status | status | enum: available/occupied/maintenance/reserved/sold/unavailable |
| Εμβαδόν | area | number |
| Τιμή | price | currency |
| Κατ. Πώλησης | commercialStatus | enum |
| Αγοραστής | _ref: buyer | text |
| Ηλεκτρικό | hasElectricity | boolean |
| Νερό | hasWater | boolean |
| Κλιματισμός | hasClimateControl | boolean |
| Συνδεδεμένη Μονάδα | _computed | text |

---

## GROUP B: Άνθρωποι & Σχέσεις

### B1. Φυσικά Πρόσωπα (Individuals)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Όνομα | firstName | text |
| Επώνυμο | lastName | text |
| Πατρώνυμο | fatherName | text |
| ΑΦΜ | vatNumber | text |
| ΔΟΥ | taxOffice | text |
| ΑΜΚΑ | amka | text |
| Επάγγελμα | profession | text |
| Email | emails[primary] | text |
| Τηλέφωνο | phones[primary] | text |
| Πόλη | addresses[primary].city | text |
| Status | status | enum: active/inactive/archived |
| Personas | _computed: personas[].personaType.join | text |
| Πληρότητα | completenessRate | percentage |
| Εργοδότης | employer | text |

> **Σημείωση**: Αυτό είναι Tier 1 (flat). Για πλήρη στοιχεία βλ. SPEC-003-export.md (Tier 2 & 3).

### B2. Εταιρείες (Companies)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Επωνυμία | companyName | text |
| Νομική Μορφή | legalForm | enum: ΑΕ/ΕΠΕ/ΟΕ/ΕΕ/ΙΚΕ/ΚΟΙΝΣΕΠ |
| ΑΦΜ | vatNumber | text |
| ΓΕΜΗ | registrationNumber | text |
| Κλάδος | industry | text |
| Εργαζόμενοι | numberOfEmployees | number |
| Ετήσιος Τζίρος | annualRevenue | currency |
| Status | status | enum |
| Αρ. Έργων | _computed | number |

### B3. Αγοραστές (Buyers)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Όνομα | contact.displayName | text |
| Μονάδα | unit.code | text |
| Κτίριο | building.name | text |
| Έργο | project.name | text |
| Τιμή Πώλησης | unit.commercial.finalPrice | currency |
| Νομική Φάση | legalPhase | enum |
| Σύνολο Πληρωμής | paymentSummary.totalAmount | currency |
| Πληρωμένα | paymentSummary.paidAmount | currency |
| Υπόλοιπο | paymentSummary.remainingAmount | currency |
| % Πληρωμής | paymentSummary.paidPercentage | percentage |
| Δόσεις Σύνολο | paymentSummary.totalInstallments | number |
| Δόσεις Καθυστ. | paymentSummary.overdueInstallments | number |
| Δάνειο Status | paymentSummary.loanStatus | enum |
| Τράπεζα | paymentSummary.primaryLoanBank | text |

### B4. Προμηθευτές (Suppliers)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Επωνυμία | displayName | text |
| Κατηγορία | persona[supplier].supplierCategory | enum: materials/equipment/subcontractor/services |
| ΑΦΜ | vatNumber | text |
| Όροι Πληρωμής | persona[supplier].paymentTermsDays | number |
| Αρ. Παραγγελιών | _computed: purchase_orders.count | number |
| Σύνολο Παραγγ. | _computed: purchase_orders.total | currency |
| Παραδοθέντα | _computed: purchase_orders.delivered | currency |
| Εκκρεμή | _computed: purchase_orders.pending | currency |

### B5. Μηχανικοί (Engineers)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Όνομα | displayName | text |
| Ειδικότητα | persona[engineer].engineerSpecialty | enum: civil/architect/mechanical/electrical/surveyor |
| Μητρώο ΤΕΕ | persona[engineer].teeRegistryNumber | text |
| Κλάση Αδείας | persona[engineer].licenseClass | enum: A/B/C/D |
| ΠΤΔΕ | persona[engineer].ptdeNumber | text |
| Αρ. Έργων | _computed: contact_links[role=engineer].count | number |

### B6. Εργαζόμενοι / Εργάτες (Workers)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Όνομα | displayName | text |
| ΑΜ ΙΚΑ | persona[worker].ikaNumber | text |
| Ασφαλ. Κλάση | persona[worker].insuranceClassId | number |
| Τριετίες | persona[worker].triennia | number |
| Ημερομίσθιο | persona[worker].dailyWage | currency |
| Κωδ. Ειδικότητας ΕΦΚΑ | persona[worker].specialtyCode | text |
| Ώρες Εργασίας | _computed: attendance_events.totalHours | number |
| Υπερωρίες | _computed: employment_records.overtimeHours | number |

### B7. Δικηγόροι & Συμβολαιογράφοι

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Όνομα | displayName | text |
| Ρόλος | persona type | enum: lawyer/notary |
| Αρ. Μητρώου | barAssociationNumber / notaryRegistryNumber | text |
| Σύλλογος/Περιφέρεια | barAssociation / notaryDistrict | text |
| Αρ. Συμβολαίων | _computed: legal_contracts.count | number |
| Ρόλος σε Συμβ. | seller_lawyer / buyer_lawyer / notary | enum |

### B8. Μεσίτες (Real Estate Agents)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Όνομα | displayName | text |
| Αρ. Αδείας | persona[agent].licenseNumber | text |
| Γραφείο | persona[agent].agency | text |
| Αρ. Συμφωνιών | _computed: brokerage_agreements.count | number |
| Ενεργές | _computed: brokerage_agreements[active].count | number |
| Σύνολο Προμηθειών | _computed: commission_records.total | currency |

---

## GROUP C: Οικονομικά & Συναλλαγές

### C1. Πλάνα Πληρωμών (Payment Plans)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Μονάδα | _ref: unit.code | text |
| Αγοραστής | buyerName | text |
| Status | status | enum: negotiation/draft/active/completed/cancelled |
| Σύνολο | totalAmount | currency |
| Πληρωμένα | paidAmount | currency |
| Υπόλοιπο | remainingAmount | currency |
| Δόσεις | installments.length | number |
| Καθυστερημένες | _computed: overdue installments | number |
| Επόμενη Δόση | _computed: next installment amount | currency |
| Ημ/νία Επόμενης | _computed: next installment date | date |
| Δάνειο | loans[primary].status | enum |
| Τράπεζα | loans[primary].bankName | text |
| Ποσό Δανείου | loans[primary].approvedAmount | currency |

### C2. Αξιόγραφα (Cheques)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Αριθμός | chequeNumber | text |
| Τύπος | chequeType | enum: bank_cheque/personal_cheque |
| Ποσό | amount | currency |
| Τράπεζα | bankName | text |
| Εκδότης | drawerName | text |
| Ημ/νία Έκδοσης | issueDate | date |
| Λήξη | maturityDate | date |
| Status | status | enum (10 states) |
| Μεταχρονολογημένη | postDated | boolean |
| Δίγραμμη | crossedCheque | boolean |
| Κατάθεση | depositDate | date |
| Εκκαθάριση | clearingDate | date |
| Σφράγιση | bouncedDate | date |
| Λόγος Σφράγισης | bouncedReason | enum |
| ΤΕΙΡΕΣΙΑΣ | teiresiasFiled | boolean |
| Αστυνομία | policeCaseFiled | boolean |
| Κατεύθυνση | context.direction | enum: incoming/outgoing |
| Έργο | _ref: project.name | text |
| Μονάδα | _ref: unit.code | text |

### C3. Συμβόλαια (Legal Contracts)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Μονάδα | _ref: unit.code | text |
| Αγοραστής | _ref: buyer.displayName | text |
| Κτίριο | _ref: building.name | text |
| Φάση | phase | enum: preliminary/final/payoff |
| Status | status | enum: draft/pending_signature/signed/completed |
| Ποσό | contractAmount | currency |
| Προκαταβολή | depositAmount | currency |
| Δικηγόρος Πωλητή | sellerLawyer.displayName | text |
| Δικηγόρος Αγοραστή | buyerLawyer.displayName | text |
| Συμβολαιογράφος | notary.displayName | text |

### C4. Μεσιτικές Συμφωνίες (Brokerage)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Μεσίτης | agentName | text |
| Εύρος | scope | enum: project/unit |
| Έργο | _ref: project.name | text |
| Μονάδα | _ref: unit.code | text |
| Αποκλειστικότητα | exclusivity | enum: exclusive/non_exclusive/semi_exclusive |
| Τύπος Προμήθειας | commissionType | enum: percentage/fixed/tiered |
| % Προμήθειας | commissionPercentage | percentage |
| Status | status | enum: active/expired/terminated |
| Έναρξη | startDate | date |
| Λήξη | endDate | date |

### C5. Προμήθειες (Commissions)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Μεσίτης | agentName | text |
| Μονάδα | _ref: unit.code | text |
| Αγοραστής | _ref: buyer | text |
| Τιμή Πώλησης | salePrice | currency |
| Ποσό Προμήθειας | commissionAmount | currency |
| Status Πληρωμής | paymentStatus | enum: pending/paid/cancelled |
| Ημ/νία Πληρωμής | paidAt | date |

### C6. Παραγγελίες (Purchase Orders)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Αρ. Παραγγελίας | poNumber | text |
| Προμηθευτής | _ref: supplier.displayName | text |
| Έργο | _ref: project.name | text |
| Status | status | enum: draft/approved/ordered/partially_delivered/delivered/closed/cancelled |
| Υποσύνολο | subtotal | currency |
| ΦΠΑ | taxAmount | currency |
| Σύνολο | total | currency |
| Ημ/νία Δημιουργίας | dateCreated | date |
| Ημ/νία Παράδοσης | dateDelivered | date |
| Αρ. Ειδών | items.length | number |

### C7. Πίνακας Ιδιοκτησίας (Ownership Tables)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Κτίριο | _ref: building.name | text |
| Μέθοδος Υπολ. | calculationMethod | enum: area/value/volume |
| Status | status | enum: draft/finalized/registered |
| Αρ. Εγγραφών | rows.length | number |

---

## GROUP D: Κατασκευή

### D1. Φάσεις Κατασκευής

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Κωδικός | code | text |
| Όνομα | name | text |
| Κτίριο | _ref: building.name | text |
| Status | status | enum: planning/inProgress/completed/delayed/blocked |
| Πρόοδος | progress | percentage |
| Έναρξη (plan) | plannedStartDate | date |
| Λήξη (plan) | plannedEndDate | date |
| Έναρξη (actual) | actualStartDate | date |
| Λήξη (actual) | actualEndDate | date |
| Λόγος Καθυστ. | delayReason | enum: weather/materials/permits/subcontractor/other |
| Αρ. Tasks | _computed | number |

### D2. Εργασίες Κατασκευής (Tasks)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Κωδικός | code | text |
| Όνομα | name | text |
| Φάση | _ref: phase.name | text |
| Κτίριο | _ref: building.name | text |
| Status | status | enum: notStarted/inProgress/completed/delayed/blocked |
| Πρόοδος | progress | percentage |
| Έναρξη (plan) | plannedStartDate | date |
| Λήξη (plan) | plannedEndDate | date |
| Εξαρτήσεις | dependencies.length | number |
| Λόγος Καθυστ. | delayReason | enum |

### D3. Ανάθεση Πόρων (Resources)

> **Collection**: `construction_resource_assignments` — δημιουργήθηκε στο ADR-266 Phase C, Sub-phase 4.

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Εργασία | _ref: task.name | text |
| Φάση | _ref: phase.name | text |
| Κτίριο | _ref: building.name | text |
| Τύπος | resourceType | enum: worker/equipment |
| Όνομα | resourceName | text |
| Ώρες | allocatedHours | number |
| Εξοπλισμός | equipmentLabel | text |

### D4. Κοστολόγηση BOQ

> **Collection**: `boq_items` — ορίστηκε στο ADR-175 (BOQ System).

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Τίτλος | title | text |
| Κατηγορία ΑΤΟΕ | categoryCode | text |
| Κτίριο | _ref: building.name | text |
| Μονάδα Μέτρ. | unit | enum: m/m2/m3/kg/ton/pcs/lt/hr/day/lump |
| Εκτ. Ποσότητα | estimatedQuantity | number |
| Πραγμ. Ποσότητα | actualQuantity | number |
| Κόστος Υλικού/μ. | materialUnitCost | currency |
| Κόστος Εργασίας/μ. | laborUnitCost | currency |
| Κόστος Εξοπλ./μ. | equipmentUnitCost | currency |
| Συνολικό Κόστος | _computed: total | currency |
| Απόκλιση % | _computed: variance | percentage |
| Status | status | enum: draft/submitted/approved/certified/locked |
| QA | qaStatus | enum: pending/passed/failed |
| Πηγή | source | enum: manual/template/dxf_auto/imported |

---

## GROUP E: CRM & Επικοινωνία

### E1. Ευκαιρίες Pipeline

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Τίτλος | title | text |
| Επαφή | _ref: contact.displayName | text |
| Στάδιο | stage | enum (8 stages) |
| Εκτ. Αξία | estimatedValue | currency |
| Πιθανότητα | probability | percentage |
| Πηγή | source | enum: website/referral/agent/social/phone/walkin |
| Υπεύθυνος | assignedTo | text |
| Επόμενη Ενέργεια | nextAction | text |
| Ημ/νία Επόμενης | nextActionDate | date |
| Status | status | enum: active/on_hold/lost/won |

### E2. Εργασίες CRM (Tasks)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Τίτλος | title | text |
| Τύπος | type | enum: call/email/meeting/viewing/document/follow_up/complaint |
| Προτεραιότητα | priority | enum: low/medium/high/urgent |
| Status | status | enum: pending/in_progress/completed/cancelled |
| Υπεύθυνος | assignedTo | text |
| Ημ/νία Λήξης | dueDate | date |
| Επαφή | _ref: contact | text |
| Έργο | _ref: project | text |

---

## GROUP F: Λογιστική

### F1. Τιμολόγια (Invoices)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Σειρά-Αριθμός | series + number | text |
| Τύπος | type | enum: service_invoice/sales_invoice/retail_receipt/credit_invoice |
| Ημ/νία Έκδοσης | issueDate | date |
| Λήξη | dueDate | date |
| Πελάτης | customer.name | text |
| ΑΦΜ Πελάτη | customer.vatNumber | text |
| Καθαρό | totalNetAmount | currency |
| ΦΠΑ | totalVatAmount | currency |
| Μικτό | totalGrossAmount | currency |
| Κατ. Πληρωμής | paymentStatus | enum: unpaid/partial/paid |
| Πληρωμένα | totalPaid | currency |
| Υπόλοιπο | balanceDue | currency |
| myDATA Status | mydata.status | enum |
| myDATA MARK | mydata.mark | text |
| Παρακράτηση | withholdingAmount | currency |

### F2. Ημερολόγιο (Journal Entries)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Ημ/νία | date | date |
| Τύπος | type | enum: income/expense |
| Κατηγορία | category | enum (5 income + 19 expense) |
| Περιγραφή | description | text |
| Καθαρό | netAmount | currency |
| ΦΠΑ | vatAmount | currency |
| Μικτό | grossAmount | currency |
| Τρίμηνο | quarter | enum: 1/2/3/4 |
| Χρήση | fiscalYear | number |
| Επαφή | contactName | text |
