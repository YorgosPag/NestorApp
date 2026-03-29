# SPEC-008: Πλήρης Χαρτογράφηση — Φυσικά Πρόσωπα (Individuals)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/contacts/contracts.ts`, `src/types/contacts/personas.ts`)

---

## 1. Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `contacts` (WHERE `type = 'individual'`) |
| **TypeScript** | `IndividualContact` extends `BaseContact` |
| **ID Pattern** | Enterprise ID: `cont_XXXXX` (`enterprise-id.service.ts`) |
| **Tenant Isolation** | `companyId` (ADR-029) |
| **Form Config** | `src/config/individual-config.ts` (8 sections + persona sections) |

---

## 2. Πλήρης Κατάλογος Πεδίων

### 2.1 Βασικά Στοιχεία (BaseContact)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | - | Enterprise ID (`cont_XXXXX`) |
| 2 | `type` | `'individual'` | Yes | Discriminator |
| 3 | `status` | enum | Yes | `active` / `inactive` / `archived` |
| 4 | `isFavorite` | boolean | Yes | Αγαπημένο |
| 5 | `tags` | string[] | No | Ετικέτες κατηγοριοποίησης |
| 6 | `notes` | string | No | Σημειώσεις |
| 7 | `customFields` | Record | No | Custom πεδία ανά οργανισμό |
| 8 | `companyId` | string | Yes | Tenant isolation (ADR-029) |
| 9 | `createdAt` | Timestamp | Yes | Ημ/νία δημιουργίας |
| 10 | `updatedAt` | Timestamp | Yes | Ημ/νία ενημέρωσης |
| 11 | `createdBy` | string | No | User ID δημιουργού |
| 12 | `lastModifiedBy` | string | No | User ID τελευταίας αλλαγής |
| 13 | `displayName` | string | No | Computed: `firstName lastName` |
| 14 | `name` | string | No | Alias για displayName |

### 2.2 Προσωπικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 15 | `firstName` | string | **Yes** | Όνομα |
| 16 | `lastName` | string | **Yes** | Επώνυμο |
| 17 | `fatherName` | string | No | Πατρώνυμο |
| 18 | `motherName` | string | No | Μητρώνυμο |
| 19 | `middleName` | string | No | Μεσαίο όνομα (legacy) |
| 20 | `nickname` | string | No | Παρατσούκλι |
| 21 | `birthDate` | ISO date | No | Ημ/νία γέννησης |
| 22 | `birthCountry` | string | No | Χώρα γέννησης |
| 23 | `gender` | enum | No | `male` / `female` / `other` |
| 24 | `amka` | string (11) | No | ΑΜΚΑ |

### 2.3 Ταυτοποιητικά Έγγραφα

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 25 | `documentType` | enum | No | `identity_card` / `passport` / `drivers_license` / `other` |
| 26 | `documentNumber` | string | No | Αριθμός εγγράφου |
| 27 | `documentIssuer` | string | No | Εκδούσα αρχή |
| 28 | `documentIssueDate` | ISO date | No | Ημ/νία έκδοσης |
| 29 | `documentExpiryDate` | ISO date | No | Ημ/νία λήξης |

### 2.4 Φορολογικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 30 | `vatNumber` | string (9) | No | ΑΦΜ |
| 31 | `taxOffice` | string | No | ΔΟΥ |

### 2.5 Επαγγελματικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 32 | `profession` | string | No | Επάγγελμα |
| 33 | `specialty` | string | No | Ειδικότητα |
| 34 | `employer` | string | No | Εργοδότης |
| 35 | `employerId` | string | No | Company contact ID (ADR-177) |
| 36 | `position` | string | No | Θέση/Ρόλος |
| 37 | `workAddress` | string | No | Διεύθυνση εργασίας |
| 38 | `workWebsite` | string | No | Επαγγελματική ιστοσελίδα |

### 2.6 ESCO Ταξινόμηση (ADR-034, ADR-132)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 39 | `escoUri` | string | No | EU ESCO occupation URI |
| 40 | `escoLabel` | string | No | Cached ESCO label |
| 41 | `iscoCode` | string (4) | No | ISCO-08 4ψήφιος κωδικός |
| 42 | `escoSkills` | EscoSkill[] | No | EU ESCO δεξιότητες |

### 2.7 Οικογενειακή Κατάσταση

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 43 | `maritalStatus` | enum | No | `single` / `married` / `divorced` / `widowed` |
| 44 | `spouse` | string | No | Σύζυγος |
| 45 | `children` | string[] | No | Παιδιά |

### 2.8 Φωτογραφίες

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 46 | `photoURL` | string | No | Κύρια φωτογραφία |
| 47 | `multiplePhotoURLs` | string[] | No | Gallery (5+ φωτογραφίες) |
| 48 | `multiplePhotos` | PhotoMetadata[] | No | Φωτογραφίες με metadata |

### 2.9 Επικοινωνία (Nested Arrays)

#### Emails (`emails[]`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `email` | string | Διεύθυνση email |
| `type` | `'personal'` / `'work'` / `'other'` | Τύπος |
| `isPrimary` | boolean | Κύριο email |
| `label` | string? | Custom ετικέτα |

#### Τηλέφωνα (`phones[]`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `number` | string | Αριθμός |
| `type` | `'mobile'` / `'home'` / `'work'` / `'fax'` / `'other'` | Τύπος |
| `isPrimary` | boolean | Κύριο τηλέφωνο |
| `countryCode` | string? | Κωδικός χώρας (+30) |
| `label` | string? | Custom ετικέτα |

#### Διευθύνσεις (`addresses[]`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `street` | string | Οδός |
| `number` | string? | Αριθμός |
| `city` | string | Πόλη |
| `postalCode` | string | Τ.Κ. |
| `region` | string? | Περιφέρεια |
| `country` | string | Χώρα |
| `type` | `'home'` / `'work'` / `'billing'` / `'shipping'` / `'other'` | Τύπος |
| `isPrimary` | boolean | Κύρια διεύθυνση |
| `coordinates` | `{ lat, lng }` | GPS |
| `municipality` | string? | Δήμος |
| `municipalityId` | string? | ID Δήμου |
| `regionalUnit` | string? | Περ. Ενότητα |
| `settlement` | string? | Οικισμός |
| `community` | string? | Κοινότητα |
| `municipalUnit` | string? | Δημοτική Ενότητα |

#### Ιστοσελίδες (`websites[]`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `url` | string | URL |
| `type` | `'personal'` / `'company'` / `'portfolio'` / `'blog'` / `'other'` | Τύπος |
| `label` | string? | Custom ετικέτα |

#### Social Media (`socialMedia[]` / `socialMediaArray[]`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `platform` | `'facebook'` / `'twitter'` / `'linkedin'` / `'instagram'` / `'youtube'` / `'github'` / `'other'` | Platform |
| `username` | string | Username/handle |
| `url` | string? | Profile URL |
| `label` | string? | Custom ετικέτα |

---

## 3. Personas — Ρόλοι Φυσικού Προσώπου (ADR-121)

Κάθε φυσικό πρόσωπο μπορεί να έχει **πολλαπλά personas** ταυτόχρονα (discriminated union).

### 3.1 Κοινά πεδία (όλα τα personas)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `personaType` | PersonaType | Discriminator |
| `status` | `'active'` / `'inactive'` | Κατάσταση persona |
| `activatedAt` | ISO date | Ενεργοποίηση |
| `deactivatedAt` | ISO date? | Απενεργοποίηση |
| `notes` | string? | Σημειώσεις |

### 3.2 Εργάτης Οικοδομής (`construction_worker`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `ikaNumber` | string | ΑΜ ΙΚΑ |
| `insuranceClassId` | number (1-28) | Ασφαλιστική κλάση ΚΠΚ 781 |
| `triennia` | number | Τριετίες |
| `dailyWage` | number (€) | Ημερομίσθιο |
| `specialtyCode` | string | Κωδικός ειδικότητας ΕΦΚΑ |
| `efkaRegistrationDate` | ISO date | Ημ/νία εγγραφής ΕΦΚΑ |

### 3.3 Μηχανικός (`engineer`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `teeRegistryNumber` | string | Μητρώο ΤΕΕ |
| `engineerSpecialty` | enum | `civil` / `architect` / `mechanical` / `electrical` / `surveyor` / `chemical` / `mining` |
| `licenseClass` | `'A'`/`'B'`/`'C'`/`'D'` | Κλάση αδείας |
| `ptdeNumber` | string | ΠΤΔΕ αριθμός |

### 3.4 Λογιστής (`accountant`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `oeeNumber` | string | Μητρώο ΟΕΕ |
| `accountingClass` | string | Κλάση λογιστή (A/B/C/D) |

### 3.5 Δικηγόρος (`lawyer`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `barAssociationNumber` | string | Αριθμός μητρώου ΔΣ |
| `barAssociation` | string | Δικηγορικός Σύλλογος (ΔΣΑ, ΔΣΘ, κλπ) |

### 3.6 Ιδιοκτήτης Ακινήτων (`property_owner`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `propertyCount` | number | Αριθμός ακινήτων |
| `ownershipNotes` | string | Σημειώσεις ιδιοκτησίας |

### 3.7 Πελάτης/Αγοραστής (`client`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `clientSince` | ISO date | Πελάτης από |

### 3.8 Προμηθευτής (`supplier`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `supplierCategory` | enum | `materials` / `equipment` / `subcontractor` / `services` / `other` |
| `paymentTermsDays` | number | Όροι πληρωμής (ημέρες) |

### 3.9 Συμβολαιογράφος (`notary`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `notaryRegistryNumber` | string | Αριθμός μητρώου |
| `notaryDistrict` | string | Περιφέρεια |

### 3.10 Μεσίτης (`real_estate_agent`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `licenseNumber` | string | Αριθμός αδείας |
| `agency` | string | Μεσιτικό γραφείο |

---

## 4. Τραπεζικοί Λογαριασμοί (Subcollection)

**Path**: `contacts/{contactId}/bankAccounts/{accountId}`

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `id` | string | Yes | Auto-generated |
| `bankName` | string | Yes | Τράπεζα |
| `bankCode` | string | No | SWIFT/BIC |
| `iban` | string | Yes | IBAN (validated) |
| `accountNumber` | string | No | Legacy αριθμός |
| `branch` | string | No | Υποκατάστημα |
| `accountType` | enum | Yes | `checking` / `savings` / `business` / `other` |
| `currency` | enum | Yes | `EUR` / `USD` / `GBP` / `CHF` |
| `isPrimary` | boolean | Yes | Κύριος λογαριασμός |
| `holderName` | string | No | Όνομα δικαιούχου |
| `notes` | string | No | Σημειώσεις |
| `isActive` | boolean | Yes | Ενεργός |

---

## 5. Σχέσεις μεταξύ Προσώπων (`contact_relationships`)

**Collection**: `contact_relationships`

### 5.1 Βασική Δομή

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `sourceContactId` | string | Πρόσωπο Α |
| `targetContactId` | string | Πρόσωπο Β |
| `relationshipType` | enum (63 τύποι) | Τύπος σχέσης |
| `status` | enum | `active` / `inactive` / `pending` / `terminated` / `suspended` |

### 5.2 Τύποι Σχέσεων (63)

| Κατηγορία | Τύποι |
|-----------|-------|
| **Εργασιακές (9)** | `employee`, `manager`, `director`, `executive`, `intern`, `contractor`, `consultant`, `civil_servant`, `department_head` |
| **Εταιρικές (6)** | `shareholder`, `board_member`, `chairman`, `ceo`, `representative`, `partner` |
| **Δημόσιες (8)** | `elected_official`, `appointed_official`, `ministry_official`, `mayor`, `deputy_mayor`, `regional_governor` + 2 |
| **Επαγγελματικές (10)** | `advisor`, `mentor`, `protege`, `colleague`, `vendor`, `client`, `competitor`, `friend`, `family`, `supplier` |
| **Ακίνητα (3)** | `property_buyer`, `property_co_buyer`, `property_landowner` (ADR-244) |
| **Εμπορικές (2)** | `customer`, `other` |

### 5.3 Πρόσθετα Πεδία Σχέσης

| Κατηγορία | Πεδία |
|-----------|-------|
| **Θέση** | `position`, `department`, `team`, `seniorityLevel`, `reportingLevel` |
| **Εργασιακά** | `employmentStatus`, `employmentType`, `employeeId` |
| **Χρονικά** | `startDate`, `endDate`, `expectedDuration`, `renewalDate`, `probationEndDate` |
| **Οικονομικά** | `ownershipPercentage`, `salaryRange`, `annualCompensation`, `contractValue`, `billingRate` |
| **Αξιολόγηση** | `performanceRating`, `lastReviewDate`, `currentGoals`, `achievements` |
| **Metadata** | `priority`, `relationshipStrength`, `communicationFrequency`, `lastInteractionDate` |

---

## 6. Σχέσεις με ΟΛΕΣ τις Οντότητες (Relationship Map)

### 6.1 Διάγραμμα Σχέσεων

```
                              ┌──────────────┐
                              │   ΦΥΣΙΚΟ     │
                              │   ΠΡΟΣΩΠΟ    │
                              │  (contacts)  │
                              └──────┬───────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
    ┌─────┴─────┐            ┌───────┴───────┐          ┌──────┴──────┐
    │ ΑΚΙΝΗΤΑ   │            │ ΟΙΚΟΝΟΜΙΚΑ    │          │ CRM         │
    │           │            │               │          │             │
    ├───────────┤            ├───────────────┤          ├─────────────┤
    │ projects  │            │ payment_plans │          │ opportunities│
    │ buildings │            │ cheques       │          │ communic.   │
    │ units     │            │ legal_contr.  │          │ tasks       │
    │ parking   │            │ brokerage_agr.│          │ activities  │
    │ storage   │            │ commission_rec│          │ appointments│
    │ ownership │            │ purchase_ord. │          └─────────────┘
    │ _tables   │            │ acct_invoices │
    └───────────┘            └───────────────┘
          │                          │
    ┌─────┴─────┐            ┌───────┴───────┐
    │ ΚΑΤΑΣΚΕΥΗ │            │ OMNICHANNEL   │
    │           │            │               │
    ├───────────┤            ├───────────────┤
    │ constr.   │            │ external_     │
    │ _phases   │            │  identities   │
    │ (via      │            │ conversations │
    │  contact_ │            │ ai_chat_      │
    │  links)   │            │  history      │
    └───────────┘            └───────────────┘
```

### 6.2 Αναλυτικός Πίνακας Σχέσεων

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Ρόλος Contact | Περιγραφή |
|---|------------|-------------------|-------|---------------|-----------|
| 1 | **contact_relationships** | `sourceContactId`, `targetContactId` | N:M | Πρόσωπο ↔ Πρόσωπο | 63 τύποι σχέσεων (εργασιακές, εταιρικές, οικογενειακές) |
| 2 | **contact_links** | `sourceContactId` → `targetEntityId` | N:M | Πρόσωπο → Έργο/Κτίριο/Μονάδα | Junction collection, ρόλος (engineer, contractor, buyer, κλπ) |
| 3 | **external_identities** | `linkedContactId` | 1:N | Πρόσωπο ← Telegram/WhatsApp/Email | Omnichannel identity mapping |
| 4 | **units** | `commercial.buyerContactId` | 1:N | Αγοραστής μονάδας | Ποιος αγόρασε ποια μονάδα |
| 5 | **units** | `commercial.owners[]` | N:M | Ιδιοκτήτης/Συν-αγοραστής | ADR-244: multi-buyer, ownership % |
| 6 | **projects** | `landowners[].contactId`, `landownerContactIds[]` | N:M | Οικοπεδούχος | Αντιπαροχή (bartex) |
| 7 | **payment_plans** | `buyerContactId`, `ownerContactId` | 1:N | Αγοραστής → Πλάνο πληρωμών | Subcollection: `units/{id}/payment_plans` |
| 8 | **legal_contracts** | `buyerContactId` | 1:N | Αγοραστής σε συμβόλαιο | Προσυμφωνητικό → Οριστικό |
| 9 | **legal_contracts** | `sellerLawyer.contactId` | 1:N | Δικηγόρος πωλητή | Immutable snapshot (ADR-230) |
| 10 | **legal_contracts** | `buyerLawyer.contactId` | 1:N | Δικηγόρος αγοραστή | Immutable snapshot |
| 11 | **legal_contracts** | `notary.contactId` | 1:N | Συμβολαιογράφος | Immutable snapshot |
| 12 | **cheques** | `context.contactId` | 1:N | Εκδότης/Αποδέκτης | Αξιόγραφα (εισερχόμενα/εξερχόμενα) |
| 13 | **brokerage_agreements** | `agentContactId` | 1:N | Μεσίτης | Μεσιτική συμφωνία |
| 14 | **commission_records** | `agentContactId`, `buyerContactId` | 1:N | Μεσίτης, Αγοραστής | Καταγραφή προμηθειών |
| 15 | **purchase_orders** | `supplierId` | 1:N | Προμηθευτής | Παραγγελίες αγοράς (ADR-267) |
| 16 | **opportunities** | `contactId`, `referredBy` | 1:N | Lead/Prospect, Referrer | CRM pipeline |
| 17 | **communications** | `contactId` | 1:N | Αποδέκτης επικοινωνίας | Email, SMS, κλήσεις, σημειώσεις |
| 18 | **tasks** | `contactId` | 1:N | Σχετική επαφή | CRM εργασίες |
| 19 | **appointments** | `requester.contactId` | 1:N | Αιτών ραντεβού | AI pipeline appointments |
| 20 | **conversations** | `linkedEntities.linkedContactId` | 1:N | Συνομιλητής | Omnichannel conversations |
| 21 | **ownership_tables** | `rows[].buyerContactId`, `landownerEntry.contactId` | N:M | Ιδιοκτήτης μονάδας | Πίνακας χιλιοστών |
| 22 | **accounting_invoices** | `contactId` | 1:N | Πελάτης τιμολογίου | Λογιστικά παραστατικά |
| 23 | **bankAccounts** (subcol) | `contacts/{id}/bankAccounts` | 1:N | Κάτοχος λογαριασμού | Τραπεζικοί λογαριασμοί |
| 24 | **employment_records** | `contactId` | 1:N | Εργαζόμενος | Ιστορικό απασχόλησης |
| 25 | **attendance_events** | `contactId` | 1:N | Εργαζόμενος | QR + GPS παρουσίες (ADR-170) |
| 26 | **digital_work_cards** | `contactId` | 1:N | Εργαζόμενος | Ψηφιακή κάρτα εργασίας |

---

## 7. Report Builder Impact — Τι σημαίνει αυτό για τα Domains

### 7.1 Domain B1 (Φυσικά Πρόσωπα) — Ενημερωμένες Στήλες

Βάσει της πλήρους χαρτογράφησης, το SPEC-001 domain B1 πρέπει να επεκταθεί:

**Tier 1 (Flat Table) — Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Όνομα | `firstName` | text | |
| Επώνυμο | `lastName` | text | |
| Πατρώνυμο | `fatherName` | text | |
| ΑΦΜ | `vatNumber` | text | |
| ΔΟΥ | `taxOffice` | text | |
| ΑΜΚΑ | `amka` | text | |
| Φύλο | `gender` | enum | |
| Ημ/νία Γέννησης | `birthDate` | date | |
| Επάγγελμα | `profession` | text | |
| Ειδικότητα | `specialty` | text | |
| Εργοδότης | `employer` | text | |
| Θέση | `position` | text | |
| Email (κύριο) | `emails[isPrimary].email` | text | Flat: μόνο primary |
| Τηλέφωνο (κύριο) | `phones[isPrimary].number` | text | Flat: μόνο primary |
| Πόλη | `addresses[isPrimary].city` | text | Flat: μόνο primary |
| Τ.Κ. | `addresses[isPrimary].postalCode` | text | |
| Δήμος | `addresses[isPrimary].municipality` | text | |
| Status | `status` | enum | |
| Personas | computed: join personaTypes | text | π.χ. "Μηχανικός, Εργολάβος" |
| Αγαπημένο | `isFavorite` | boolean | |
| Οικ. Κατάσταση | `maritalStatus` | enum | |
| Ημ/νία Δημιουργίας | `createdAt` | date | |

**Tier 1 — Computed/Joined columns (cross-entity):**

| Στήλη | Join | Τύπος | Σημείωση |
|-------|------|-------|----------|
| Αρ. Μονάδων | COUNT units WHERE buyerContactId | number | Πόσες μονάδες αγόρασε |
| Αξία Μονάδων | SUM units.finalPrice | currency | Συνολική αξία αγορών |
| Αρ. Έργων | COUNT contact_links WHERE role | number | Σε πόσα έργα συμμετέχει |
| Αρ. Συμβολαίων | COUNT legal_contracts | number | |
| Αρ. Αξιογράφων | COUNT cheques | number | |
| Συν. Αξιογράφων | SUM cheques.amount | currency | |
| Αρ. Παραγγελιών | COUNT purchase_orders | number | Αν είναι supplier |
| Αρ. Ευκαιριών | COUNT opportunities | number | CRM pipeline |
| Αρ. Επικοινωνιών | COUNT communications | number | |
| Αρ. Τιμολογίων | COUNT accounting_invoices | number | |
| Ώρες Εργασίας | SUM attendance_events | number | Αν είναι worker |
| Αρ. Μεσιτικών | COUNT brokerage_agreements | number | Αν είναι agent |
| Σύν. Προμηθειών | SUM commission_records | currency | |

### 7.2 Ποια Personas ξεκλειδώνουν ποια Joined Data

| Persona | Ξεκλειδώνει |
|---------|-------------|
| `client` | units, payment_plans, legal_contracts, cheques |
| `supplier` | purchase_orders |
| `engineer` | contact_links (role=engineer), projects |
| `construction_worker` | employment_records, attendance_events, digital_work_cards |
| `lawyer` | legal_contracts (sellerLawyer/buyerLawyer) |
| `notary` | legal_contracts (notary) |
| `real_estate_agent` | brokerage_agreements, commission_records |
| `property_owner` | units (owners[]), ownership_tables |
| `accountant` | (no direct collection link, advisory role) |

### 7.3 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `emails[]` | type, email, isPrimary | ~5 |
| `phones[]` | type, number, countryCode, isPrimary | ~5 |
| `addresses[]` | type, street, city, postalCode, municipality, isPrimary | ~3 |
| `websites[]` | type, url | ~3 |
| `socialMedia[]` | platform, username, url | ~5 |
| `personas[]` | personaType, status + per-type fields | ~9 (max) |
| `children[]` | name (string) | ~5 |
| `escoSkills[]` | skillUri, skillLabel | ~10 |

### 7.4 Tier 3 (Contact Card PDF) — Sections

```
┌─────────────────────────────────────────┐
│ [ΦΩΤΟ] ΟΝΟΜΑ ΕΠΩΝΥΜΟ                   │
│        Επάγγελμα | Status               │
├─────────────────────────────────────────┤
│ ΤΑΥΤΟΤΗΤΑ                                │
│ ΑΦΜ | ΔΟΥ | ΑΜΚΑ | Φύλο | Γέννηση     │
│ Ταυτότητα: Αρ. | Εκδούσα | Ημ/νίες     │
├─────────────────────────────────────────┤
│ ΕΠΙΚΟΙΝΩΝΙΑ                              │
│ [πίνακας emails]                        │
│ [πίνακας phones]                        │
│ [πίνακας addresses]                     │
│ [πίνακας websites + social]             │
├─────────────────────────────────────────┤
│ ΕΠΑΓΓΕΛΜΑ                                │
│ Θέση | Εργοδότης | Ειδικότητα           │
│ ESCO: URI + Label + ISCO Code           │
│ Skills: [λίστα δεξιοτήτων]             │
├─────────────────────────────────────────┤
│ PERSONAS (conditional per active)        │
│ ✅ Μηχανικός: ΤΕΕ, Ειδικότητα, Κλάση   │
│ ✅ Προμηθευτής: Κατηγορία, Όροι πληρ.  │
├─────────────────────────────────────────┤
│ ΤΡΑΠΕΖΙΚΟΙ ΛΟΓ/ΣΜΟΙ                     │
│ [πίνακας: Τράπεζα, IBAN, Τύπος]        │
├─────────────────────────────────────────┤
│ ΑΚΙΝΗΤΑ (via units + contact_links)      │
│ [πίνακας: Έργο, Κτίριο, Μονάδα, Ρόλος]│
├─────────────────────────────────────────┤
│ ΟΙΚΟΝΟΜΙΚΑ (via cheques + payments)      │
│ [πίνακας: Αξιόγραφα, Πληρωμές]         │
├─────────────────────────────────────────┤
│ ΣΧΕΣΕΙΣ (via contact_relationships)      │
│ [πίνακας: Πρόσωπο, Τύπος, Status]      │
├─────────────────────────────────────────┤
│ ΟΙΚΟΓΕΝΕΙΑ                               │
│ Κατάσταση | Σύζυγος | Παιδιά           │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [notes]                                 │
└─────────────────────────────────────────┘
```

---

## 8. Στατιστικά

| Μέτρηση | Τιμή |
|---------|------|
| Πεδία BaseContact | 14 |
| Πεδία IndividualContact | 48 (direct) |
| Πεδία nested arrays (emails, phones, κλπ) | ~40 (across arrays) |
| Persona types | 9 |
| Persona-specific fields | ~40 (σύνολο) |
| Τραπεζικοί λογαριασμοί (subcollection) | 12 fields |
| Relationship types | 63 |
| Relationship fields | 65+ |
| Cross-entity references | 26 collections |
| **Σύνολο πεδίων (πλήρες φυσικό πρόσωπο)** | **~220+** |
