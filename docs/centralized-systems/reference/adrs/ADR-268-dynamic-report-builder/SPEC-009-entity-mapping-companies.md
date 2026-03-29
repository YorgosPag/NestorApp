# SPEC-009: Πλήρης Χαρτογράφηση — Νομικά Πρόσωπα (Companies)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/contacts/contracts.ts`, `src/utils/contactForm/mappers/company.ts`, `src/config/company-config.ts`)

---

## 1. Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `contacts` (WHERE `type = 'company'`) |
| **TypeScript** | `CompanyContact` extends `BaseContact` |
| **ID Pattern** | Enterprise ID: `cont_XXXXX` (`enterprise-id.service.ts`) |
| **Tenant Isolation** | `companyId` (ADR-029) |
| **Form Config** | `src/config/company-config.ts` (5 sections: basicInfo, gemi, contact, logo, relationships) |
| **GEMI Config** | `src/config/company-gemi-config.ts` (enterprise legal forms, statuses, KAD codes) |
| **Mapper** | `src/utils/contactForm/mappers/company.ts` |
| **Legacy Collection** | `companies` (materialized docs with `contactId` FK → `contacts`) |

---

## 2. Πλήρης Κατάλογος Πεδίων

### 2.1 Βασικά Στοιχεία (BaseContact)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | - | Enterprise ID (`cont_XXXXX`) |
| 2 | `type` | `'company'` | Yes | Discriminator |
| 3 | `status` | enum | Yes | `active` / `inactive` / `archived` |
| 4 | `isFavorite` | boolean | Yes | Αγαπημένο |
| 5 | `tags` | string[] | No | Ετικέτες κατηγοριοποίησης |
| 6 | `notes` | string | No | Σημειώσεις |
| 7 | `customFields` | Record | No | Custom πεδία (GEMI data αποθηκεύεται εδώ) |
| 8 | `companyId` | string | Yes | Tenant isolation (ADR-029) |
| 9 | `createdAt` | Timestamp | Yes | Ημ/νία δημιουργίας |
| 10 | `updatedAt` | Timestamp | Yes | Ημ/νία ενημέρωσης |
| 11 | `createdBy` | string | No | User ID δημιουργού |
| 12 | `lastModifiedBy` | string | No | User ID τελευταίας αλλαγής |
| 13 | `displayName` | string | No | Alias (= companyName) |
| 14 | `name` | string | No | Alias για displayName |

### 2.2 Στοιχεία Εταιρείας (Company-Specific)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 15 | `companyName` | string | **Yes** | Επωνυμία εταιρείας |
| 16 | `legalName` | string | No | Πλήρης νομική επωνυμία |
| 17 | `tradeName` | string | No | Εμπορική επωνυμία / Διακριτικός τίτλος |
| 18 | `legalForm` | enum | No | `ΑΕ` / `ΕΠΕ` / `ΟΕ` / `ΕΕ` / `ΙΚΕ` / `ΚΟΙΝΣΕΠ` / `OTHER` |
| 19 | `vatNumber` | string (9) | **Yes** | ΑΦΜ |
| 20 | `registrationNumber` | string | No | Αρ. ΓΕΜΗ |
| 21 | `taxOffice` | string | No | ΔΟΥ |

### 2.3 Πληροφορίες Εταιρείας

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 22 | `industry` | string | No | Κλάδος δραστηριότητας |
| 23 | `sector` | string | No | Τομέας |
| 24 | `numberOfEmployees` | number | No | Αριθμός εργαζομένων |
| 25 | `annualRevenue` | number | No | Ετήσιος τζίρος (€) |

### 2.4 Λογότυπο & Φωτογραφίες

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 26 | `logoURL` | string | No | Λογότυπο εταιρείας |
| 27 | `representativePhotoURL` | string | No | Φωτογραφία εκπροσώπου |
| 28 | `photoURL` | string | No | Φωτογραφία (inherited) |
| 29 | `multiplePhotoURLs` | string[] | No | Gallery φωτογραφιών |
| 30 | `multiplePhotos` | PhotoMetadata[] | No | Φωτογραφίες με metadata |

### 2.5 ΓΕΜΗ Στοιχεία (via customFields)

Τα πεδία ΓΕΜΗ αποθηκεύονται στο `customFields` object (βλ. `company.ts` mapper):

| # | Πεδίο (customFields.X) | Τύπος | Required | Περιγραφή |
|---|------------------------|-------|----------|-----------|
| 31 | `gemiNumber` | string | No | Αριθμός ΓΕΜΗ (= registrationNumber) |
| 32 | `gemiStatus` | enum | No | `active` / `inactive` / `suspended` / `dissolution` |
| 33 | `gemiStatusDate` | ISO date | No | Ημ/νία κατάστασης ΓΕΜΗ |
| 34 | `activityCodeKAD` | string | No | Κωδικός ΚΑΔ (κύριος) |
| 35 | `activityDescription` | string | No | Περιγραφή δραστηριότητας |
| 36 | `activityType` | string | No | Τύπος δραστηριότητας |
| 37 | `activities` | KadActivity[] | No | Πολλαπλοί ΚΑΔ (multi-KAD) |
| 38 | `chamber` | string | No | Επιμελητήριο εγγραφής |
| 39 | `capitalAmount` | string | No | Κεφάλαιο (€) |
| 40 | `currency` | string | No | Νόμισμα κεφαλαίου |
| 41 | `extraordinaryCapital` | string | No | Εγγυημένα κεφάλαια |
| 42 | `registrationDate` | ISO date | No | Ημ/νία εγγραφής ΓΕΜΗ |
| 43 | `lastUpdateDate` | ISO date | No | Ημ/νία τελευταίας μεταβολής |
| 44 | `gemiDepartment` | string | No | Τοπική υπηρεσία ΓΕΜΗ |
| 45 | `prefecture` | string | No | Περιφέρεια έδρας |
| 46 | `municipality` | string | No | Δήμος έδρας |

### 2.6 Επικοινωνία (Nested Arrays)

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
| `isPrimary` | boolean | Κύρια διεύθυνση (= Έδρα) |
| `coordinates` | `{ lat, lng }` | GPS |
| `municipality` | string? | Δήμος |
| `municipalityId` | string? | ID Δήμου |
| `regionalUnit` | string? | Περ. Ενότητα |
| `settlement` | string? | Οικισμός |
| `community` | string? | Κοινότητα |
| `municipalUnit` | string? | Δημοτική Ενότητα |

> **Σημείωση**: Η εταιρεία μπορεί να έχει πολλαπλές διευθύνσεις — Έδρα (headquarters) + Υποκαταστήματα (branches). Βλ. `companyAddresses[]` στο `customFields`.

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

### 2.7 Υπεύθυνοι Επικοινωνίας (`contactPersons[]`)

Embedded array μέσα στο company contact document:

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `name` | string | Yes | Ονοματεπώνυμο |
| `position` | string | No | Θέση/Ρόλος |
| `department` | string | No | Τμήμα |
| `email` | string | No | Email |
| `phone` | string | No | Τηλέφωνο |
| `isPrimary` | boolean | Yes | Κύριο πρόσωπο επικοινωνίας |

> **Σημαντικό**: Αυτό είναι **embedded array** — ΟΧΙ linked contacts. Για σχέσεις με Φυσικά Πρόσωπα βλ. §5 (`contact_relationships`).

---

## 3. Δεν υπάρχει Persona System για Εταιρείες

Σε αντίθεση με τα Φυσικά Πρόσωπα (ADR-121: 9 persona types), οι εταιρείες **ΔΕΝ** έχουν persona system. Ο ρόλος της εταιρείας (προμηθευτής, εργοδότης, κλπ) προκύπτει εμμέσως από:

| Ρόλος | Πώς ορίζεται | Collection/Πεδίο |
|-------|-------------|------------------|
| **Εργοδότης** | Individual.`employerId` → Company.id | `contacts` (individual) |
| **Προμηθευτής** | PO.`supplierId` → Company.id | `purchase_orders` |
| **Εργολάβος/Ανάδοχος** | Project.`linkedCompanyId` → Company.id | `projects` |
| **Ιδιοκτήτης Ακινήτου** | contact_links (role) | `contact_links` |
| **Πελάτης (τιμολόγηση)** | Invoice.`contactId` → Company.id | `accounting_invoices` |

---

## 4. Τραπεζικοί Λογαριασμοί (Subcollection)

**Path**: `contacts/{contactId}/bankAccounts/{accountId}`

Ίδια δομή με Φυσικά Πρόσωπα (SPEC-008 §4):

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

## 5. Σχέσεις μεταξύ Εταιρείας ↔ Προσώπων (`contact_relationships`)

**Collection**: `contact_relationships`

### 5.1 Βασική Δομή

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `sourceContactId` | string | Εταιρεία ή Πρόσωπο |
| `targetContactId` | string | Πρόσωπο ή Εταιρεία |
| `relationshipType` | enum (63 τύποι) | Τύπος σχέσης |
| `status` | enum | `active` / `inactive` / `pending` / `terminated` / `suspended` |

### 5.2 Σχετικοί Τύποι Σχέσεων (Company-relevant)

| Κατηγορία | Τύποι |
|-----------|-------|
| **Εργασιακές (9)** | `employee`, `manager`, `director`, `executive`, `intern`, `contractor`, `consultant`, `civil_servant`, `department_head` |
| **Εταιρικές (6)** | `shareholder`, `board_member`, `chairman`, `ceo`, `representative`, `partner` |
| **Εμπορικές (4)** | `vendor`, `client`, `supplier`, `customer` |

### 5.3 Πρόσθετα Πεδία Σχέσης (ίδια με SPEC-008 §5.3)

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
                              │   ΕΤΑΙΡΕΙΑ   │
                              │  (contacts   │
                              │  type=company)│
                              └──────┬───────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
    ┌─────┴─────┐            ┌───────┴───────┐          ┌──────┴──────┐
    │ ΑΚΙΝΗΤΑ   │            │ ΑΝΘΡΩΠΟΙ      │          │ ΟΙΚΟΝΟΜΙΚΑ  │
    │           │            │               │          │             │
    ├───────────┤            ├───────────────┤          ├─────────────┤
    │ projects  │            │ contacts      │          │ purchase_   │
    │ (linkedCo │            │ (individual)  │          │  orders     │
    │  mpanyId) │            │ via employerId│          │ accounting_ │
    │ buildings │            │ contact_      │          │  invoices   │
    │ units     │            │  relationships│          │ cheques     │
    │ parking   │            │ contactPersons│          │ brokerage_  │
    │ storage   │            │ (embedded)    │          │  agreements │
    │ contact_  │            └───────────────┘          │ commission_ │
    │  links    │                                       │  records    │
    └───────────┘                                       └─────────────┘
          │                                                    │
    ┌─────┴─────┐            ┌──────────────┐          ┌──────┴──────┐
    │ ΚΑΤΑΣΚΕΥΗ │            │ CRM          │          │ OMNICHANNEL │
    │           │            │              │          │             │
    ├───────────┤            ├──────────────┤          ├─────────────┤
    │ constr.   │            │ opportunities│          │ external_   │
    │ _phases   │            │ communic.    │          │  identities │
    │ (via      │            │ tasks        │          │ conversations│
    │ contact_  │            │ appointments │          │ ai_chat_    │
    │ links)    │            │              │          │  history    │
    └───────────┘            └──────────────┘          └─────────────┘
```

### 6.2 Αναλυτικός Πίνακας Σχέσεων

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Ρόλος Company | Περιγραφή |
|---|------------|-------------------|-------|---------------|-----------|
| 1 | **contacts** (individual) | `employerId` | 1:N | Εργοδότης | Φυσικά πρόσωπα που εργάζονται στην εταιρεία (ADR-177) |
| 2 | **contact_relationships** | `sourceContactId`, `targetContactId` | N:M | Εταιρεία ↔ Πρόσωπο/Εταιρεία | 63 τύποι σχέσεων (εργασιακές, εταιρικές, εμπορικές) |
| 3 | **contact_links** | `sourceContactId` → `targetEntityId` | N:M | Εταιρεία → Έργο/Κτίριο/Μονάδα | Junction collection, ρόλος (contractor, developer, κλπ) |
| 4 | **projects** | `linkedCompanyId` | 1:N | Εργολάβος/Ανάδοχος | ADR-232: Business entity link — ποια εταιρεία κατασκευάζει το έργο |
| 5 | **projects** | `linkedCompanyName` | - | (denormalized) | Cached company name |
| 6 | **buildings** | `linkedCompanyId` | 1:N | Κατασκευαστής | Σύνδεση κτιρίου με εταιρεία |
| 7 | **units** | `linkedCompanyId` | 1:N | Κατασκευαστής | Σύνδεση μονάδας με εταιρεία |
| 8 | **parking** | `linkedCompanyId` | 1:N | Κατασκευαστής | Σύνδεση parking με εταιρεία |
| 9 | **storage_rooms** | `linkedCompanyId` | 1:N | Κατασκευαστής | Σύνδεση αποθήκης με εταιρεία |
| 10 | **purchase_orders** | `supplierId` | 1:N | Προμηθευτής | Παραγγελίες αγοράς (ADR-267) |
| 11 | **accounting_invoices** | `contactId` | 1:N | Πελάτης/Προμηθευτής | Λογιστικά παραστατικά |
| 12 | **cheques** | `context.contactId` | 1:N | Εκδότης/Αποδέκτης | Αξιόγραφα εταιρείας |
| 13 | **brokerage_agreements** | `agentContactId` | 1:N | Μεσιτικό γραφείο | Μεσιτικές συμφωνίες (αν η εταιρεία = μεσιτικό) |
| 14 | **commission_records** | `agentContactId` | 1:N | Μεσιτικό γραφείο | Προμήθειες μεσιτικού |
| 15 | **opportunities** | `contactId`, `referredBy` | 1:N | Lead/Partner | CRM pipeline |
| 16 | **communications** | `contactId` | 1:N | Αποδέκτης επικοινωνίας | Email, SMS, κλήσεις, σημειώσεις |
| 17 | **tasks** | `contactId` | 1:N | Σχετική εταιρεία | CRM εργασίες |
| 18 | **appointments** | `requester.contactId` | 1:N | Αιτών ραντεβού | AI pipeline appointments |
| 19 | **external_identities** | `linkedContactId` | 1:N | Εταιρεία ← Telegram/Email/WhatsApp | Omnichannel identity mapping |
| 20 | **conversations** | `linkedEntities.linkedContactId` | 1:N | Συνομιλητής | Omnichannel conversations |
| 21 | **bankAccounts** (subcol) | `contacts/{id}/bankAccounts` | 1:N | Κάτοχος λογαριασμού | Τραπεζικοί λογαριασμοί |
| 22 | **ownership_tables** | `rows[].buyerContactId` | N:M | Ιδιοκτήτης (νομικό πρόσωπο) | Πίνακας χιλιοστών |
| 23 | **legal_contracts** | `buyerContactId` | 1:N | Αγοραστής (νομικό πρόσωπο) | Νομικά πρόσωπα ως αγοραστές ακινήτων |
| 24 | **companies** (legacy) | `contactId` → Company.id | 1:1 | Materialized company doc | Legacy collection — workspace/tenant management |

### 6.3 Company Subcollections (via `companies` collection)

| # | Subcollection | Path | Περιγραφή |
|---|--------------|------|-----------|
| 1 | `projects` | `companies/{id}/projects` | Έργα εταιρείας |
| 2 | `units` | `companies/{id}/units` | Μονάδες εταιρείας |
| 3 | `members` | `companies/{id}/members` | Μέλη/χρήστες εταιρείας |
| 4 | `audit_logs` | `companies/{id}/audit_logs` | Audit trail |

### 6.4 Contact Subcollections

| # | Subcollection | Path | Περιγραφή |
|---|--------------|------|-----------|
| 1 | `activities` | `contacts/{id}/activities` | Δραστηριότητες |
| 2 | `communications` | `contacts/{id}/communications` | Επικοινωνίες |
| 3 | `notes` | `contacts/{id}/notes` | Σημειώσεις |
| 4 | `bankAccounts` | `contacts/{id}/bankAccounts` | Τραπεζικοί λογαριασμοί |

---

## 7. Διαφορές Εταιρείας vs Φυσικού Προσώπου

| Χαρακτηριστικό | Φυσικό Πρόσωπο (SPEC-008) | Εταιρεία (SPEC-009) |
|---------------|---------------------------|---------------------|
| **Personas** | ✅ 9 persona types (ADR-121) | ❌ Δεν υπάρχει — ρόλος implicit |
| **Ονοματολογία** | firstName + lastName | companyName + legalName + tradeName |
| **Φορολογικά** | vatNumber (optional) | vatNumber (**required**) |
| **ΓΕΜΗ** | ❌ Δεν υπάρχει | ✅ Πλήρη ΓΕΜΗ στοιχεία (16 πεδία) |
| **Νομική μορφή** | ❌ | ✅ legalForm (7 τύποι ελληνικών εταιρειών) |
| **Contact Persons** | ❌ | ✅ contactPersons[] (embedded) |
| **Λογότυπο** | photoURL | logoURL + representativePhotoURL |
| **Έγγραφα ταυτότητας** | ✅ documentType/Number/Issuer | ❌ |
| **Οικογένεια** | ✅ maritalStatus, spouse, children | ❌ |
| **ESCO** | ✅ escoUri, escoLabel, escoSkills | ❌ |
| **Σύνδεση με Έργα** | via contact_links (engineer, buyer, κλπ) | via `linkedCompanyId` (direct FK) |
| **Σύνδεση με POs** | via supplierId (individual supplier) | via supplierId (company supplier) |

---

## 8. Report Builder Impact — Τι σημαίνει αυτό για τα Domains

### 8.1 Domain B2 (Νομικά Πρόσωπα) — Ενημερωμένες Στήλες

Βάσει της πλήρους χαρτογράφησης, το SPEC-001 domain B2 πρέπει να επεκταθεί:

**Tier 1 (Flat Table) — Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Επωνυμία | `companyName` | text | **Required** |
| Εμπορική Επωνυμία | `tradeName` | text | |
| Νομική Επωνυμία | `legalName` | text | |
| Νομική Μορφή | `legalForm` | enum | ΑΕ, ΕΠΕ, ΟΕ, ΕΕ, ΙΚΕ, ΚΟΙΝΣΕΠ |
| ΑΦΜ | `vatNumber` | text | **Required** |
| ΔΟΥ | `taxOffice` | text | |
| Αρ. ΓΕΜΗ | `registrationNumber` | text | |
| Κατάσταση ΓΕΜΗ | `customFields.gemiStatus` | enum | active/inactive/suspended/dissolution |
| ΚΑΔ | `customFields.activityCodeKAD` | text | Κωδικός δραστηριότητας |
| Περιγραφή | `customFields.activityDescription` | text | |
| Επιμελητήριο | `customFields.chamber` | text | |
| Κεφάλαιο | `customFields.capitalAmount` | currency | |
| Κλάδος | `industry` | text | |
| Τομέας | `sector` | text | |
| Εργαζόμενοι | `numberOfEmployees` | number | |
| Ετήσιος Τζίρος | `annualRevenue` | currency | |
| Email (κύριο) | `emails[isPrimary].email` | text | Flat: μόνο primary |
| Τηλέφωνο (κύριο) | `phones[isPrimary].number` | text | Flat: μόνο primary |
| Πόλη (έδρα) | `addresses[isPrimary].city` | text | Flat: μόνο primary |
| Τ.Κ. | `addresses[isPrimary].postalCode` | text | |
| Δήμος | `addresses[isPrimary].municipality` | text | |
| Κύριος Υπεύθυνος | `contactPersons[isPrimary].name` | text | Primary contact person |
| Status | `status` | enum | active/inactive/archived |
| Αγαπημένο | `isFavorite` | boolean | |
| Ημ/νία Εγγραφής ΓΕΜΗ | `customFields.registrationDate` | date | |
| Ημ/νία Δημιουργίας | `createdAt` | date | |

**Tier 1 — Computed/Joined columns (cross-entity):**

| Στήλη | Join | Τύπος | Σημείωση |
|-------|------|-------|----------|
| Αρ. Εργαζομένων (linked) | COUNT contacts WHERE employerId | number | Πόσα φυσικά πρόσωπα ως εργαζόμενοι |
| Αρ. Έργων | COUNT projects WHERE linkedCompanyId | number | Σε πόσα έργα ως εργολάβος |
| Αρ. Παραγγελιών (POs) | COUNT purchase_orders WHERE supplierId | number | Αν είναι supplier |
| Αξία Παραγγελιών | SUM purchase_orders.totalAmount | currency | Συνολική αξία POs |
| Αρ. Τιμολογίων | COUNT accounting_invoices WHERE contactId | number | |
| Αξία Τιμολογίων | SUM accounting_invoices.totalAmount | currency | |
| Αρ. Αξιογράφων | COUNT cheques WHERE contactId | number | |
| Σύν. Αξιογράφων | SUM cheques.amount | currency | |
| Αρ. Μονάδων (owner) | COUNT units WHERE linkedCompanyId | number | Μονάδες που κατέχει |
| Αρ. Ευκαιριών | COUNT opportunities WHERE contactId | number | CRM pipeline |
| Αρ. Επικοινωνιών | COUNT communications WHERE contactId | number | |
| Αρ. Σχέσεων | COUNT contact_relationships | number | |
| Αρ. Μεσιτικών | COUNT brokerage_agreements | number | Αν είναι μεσιτικό |
| Σύν. Προμηθειών | SUM commission_records | currency | |

### 8.2 Ποιοι Ρόλοι ξεκλειδώνουν ποια Joined Data

| Ρόλος (implicit) | Ξεκλειδώνει |
|------------------|-------------|
| **Εργοδότης** (employerId) | contacts (individuals), employment_records |
| **Εργολάβος/Ανάδοχος** (linkedCompanyId) | projects, buildings, units, parking, storage |
| **Προμηθευτής** (supplierId) | purchase_orders, supplier_metrics |
| **Πελάτης τιμολόγησης** (invoice contactId) | accounting_invoices |
| **Μεσιτικό γραφείο** (agentContactId) | brokerage_agreements, commission_records |
| **Αγοραστής ακινήτου** (buyerContactId) | legal_contracts, cheques, payment_plans |

### 8.3 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `emails[]` | type, email, isPrimary | ~5 |
| `phones[]` | type, number, countryCode, isPrimary | ~5 |
| `addresses[]` | type, street, city, postalCode, municipality, isPrimary | ~5 (έδρα + υποκαταστήματα) |
| `websites[]` | type, url | ~3 |
| `socialMedia[]` | platform, username, url | ~5 |
| `contactPersons[]` | name, position, department, email, phone, isPrimary | ~10 |
| `customFields.activities[]` | KAD code, description | ~10 (multi-KAD) |
| `customFields.companyAddresses[]` | type, street, city, postalCode | ~5 (headquarters + branches) |

### 8.4 Tier 3 (Company Card PDF) — Sections

```
┌─────────────────────────────────────────┐
│ [ΛΟΓΟΤΥΠΟ] ΕΠΩΝΥΜΙΑ ΕΤΑΙΡΕΙΑΣ          │
│            Νομική Μορφή | Status        │
├─────────────────────────────────────────┤
│ ΤΑΥΤΟΤΗΤΑ ΕΤΑΙΡΕΙΑΣ                     │
│ ΑΦΜ | ΔΟΥ | Αρ. ΓΕΜΗ | Κατάσταση ΓΕΜΗ│
│ Νομική Μορφή | Εμπορικός Τίτλος        │
│ Κλάδος | Τομέας | Εργαζόμενοι | Τζίρος │
├─────────────────────────────────────────┤
│ ΓΕΜΗ ΣΤΟΙΧΕΙΑ                           │
│ ΚΑΔ | Περιγραφή Δραστηριότητας         │
│ Επιμελητήριο | Κεφάλαιο | Νόμισμα      │
│ Ημ/νία Εγγραφής | Τελ. Μεταβολή        │
│ Περιφέρεια | Δήμος | Υπηρ. ΓΕΜΗ        │
│ [πίνακας multi-KAD activities]          │
├─────────────────────────────────────────┤
│ ΕΠΙΚΟΙΝΩΝΙΑ                              │
│ [πίνακας emails]                        │
│ [πίνακας phones]                        │
│ [πίνακας addresses — Έδρα + Υποκατ.]   │
│ [πίνακας websites + social]             │
├─────────────────────────────────────────┤
│ ΥΠΕΥΘΥΝΟΙ ΕΠΙΚΟΙΝΩΝΙΑΣ                  │
│ [πίνακας: Όνομα, Θέση, Τμήμα,         │
│  Email, Τηλ., Primary]                  │
├─────────────────────────────────────────┤
│ ΤΡΑΠΕΖΙΚΟΙ ΛΟΓΑΡΙΑΣΜΟΙ                  │
│ [πίνακας: Τράπεζα, IBAN, Τύπος]        │
├─────────────────────────────────────────┤
│ ΕΡΓΑ (via projects.linkedCompanyId)      │
│ [πίνακας: Έργο, Τοποθεσία, Status]     │
├─────────────────────────────────────────┤
│ ΕΡΓΑΖΟΜΕΝΟΙ (via employerId)             │
│ [πίνακας: Όνομα, Θέση, Τηλ., Email]   │
├─────────────────────────────────────────┤
│ ΠΑΡΑΓΓΕΛΙΕΣ (via purchase_orders)        │
│ [πίνακας: PO#, Ημ/νία, Ποσό, Status]  │
├─────────────────────────────────────────┤
│ ΤΙΜΟΛΟΓΙΑ (via accounting_invoices)      │
│ [πίνακας: Αρ., Ημ/νία, Ποσό, Τύπος]  │
├─────────────────────────────────────────┤
│ ΑΞΙΟΓΡΑΦΑ (via cheques)                  │
│ [πίνακας: Αρ., Ποσό, Ημ/νία, Status]  │
├─────────────────────────────────────────┤
│ ΣΧΕΣΕΙΣ (via contact_relationships)      │
│ [πίνακας: Πρόσωπο/Εταιρεία, Τύπος]    │
├─────────────────────────────────────────┤
│ CRM PIPELINE (via opportunities)         │
│ [πίνακας: Ευκαιρία, Stage, Αξία]       │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [notes]                                 │
└─────────────────────────────────────────┘
```

---

## 9. Στατιστικά

| Μέτρηση | Τιμή |
|---------|------|
| Πεδία BaseContact | 14 |
| Πεδία CompanyContact (direct) | 30 (company-specific) |
| Πεδία ΓΕΜΗ (customFields) | 16 |
| Πεδία nested arrays (emails, phones, κλπ) | ~40 (across arrays) |
| ContactPerson fields | 6 |
| Persona types | 0 (δεν υπάρχει persona system) |
| Implicit roles | 6 (employer, contractor, supplier, client, broker, buyer) |
| Τραπεζικοί λογαριασμοί (subcollection) | 12 fields |
| Cross-entity references | 24 collections |
| Company subcollections (legacy) | 4 (projects, units, members, audit_logs) |
| Contact subcollections | 4 (activities, communications, notes, bankAccounts) |
| **Σύνολο πεδίων (πλήρης εταιρεία)** | **~120+** |
