# SPEC-010: Πλήρης Χαρτογράφηση — Δημόσιες Υπηρεσίες (Services)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/contacts/contracts.ts`, `src/utils/contactForm/mappers/service.ts`, `src/config/service-config.ts`)

---

## 1. Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `contacts` (WHERE `type = 'service'`) |
| **TypeScript** | `ServiceContact` extends `BaseContact` |
| **ID Pattern** | Enterprise ID: `cont_XXXXX` (`enterprise-id.service.ts`) |
| **Tenant Isolation** | `companyId` (ADR-029) |
| **Form Config** | `src/config/service-config.ts` (7 sections: basicInfo, address, communication, logo, relationships, files, banking) |
| **Forward Mapper** | `src/utils/contactForm/mappers/service.ts` (Form → Contact) |
| **Reverse Mapper** | `src/utils/contactForm/fieldMappers/serviceMapper.ts` (Contact → Form) |
| **Registry** | PublicServicePicker → ΥΠΕΣ registry (Greek public services) |
| **Ministry Data** | `src/data/greek-ministries.ts` (21 entries) |

---

## 2. Πλήρης Κατάλογος Πεδίων

### 2.1 Βασικά Στοιχεία (BaseContact)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | - | Enterprise ID (`cont_XXXXX`) |
| 2 | `type` | `'service'` | Yes | Discriminator |
| 3 | `status` | enum | Yes | `active` / `inactive` / `archived` |
| 4 | `isFavorite` | boolean | Yes | Αγαπημένο |
| 5 | `tags` | string[] | No | Ετικέτες κατηγοριοποίησης |
| 6 | `notes` | string | No | Σημειώσεις |
| 7 | `customFields` | Record | No | Custom πεδία |
| 8 | `companyId` | string | Yes | Tenant isolation (ADR-029) |
| 9 | `createdAt` | Timestamp | Yes | Ημ/νία δημιουργίας |
| 10 | `updatedAt` | Timestamp | Yes | Ημ/νία ενημέρωσης |
| 11 | `createdBy` | string | No | User ID δημιουργού |
| 12 | `lastModifiedBy` | string | No | User ID τελευταίας αλλαγής |
| 13 | `displayName` | string | No | Alias (= serviceName) |
| 14 | `name` | string | No | Alias for displayName |

### 2.2 Στοιχεία Υπηρεσίας (ServiceContact type definition)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 15 | `serviceName` | string | **Yes** | Ονομασία υπηρεσίας |
| 16 | `serviceType` | enum | **Yes** | `ministry` / `tax_office` / `municipality` / `public_organization` / `other` |
| 17 | `parentOrganization` | string | No | Μητρικός οργανισμός |
| 18 | `serviceCode` | string | No | Κωδικός υπηρεσίας |
| 19 | `registryNumber` | string | No | Αριθμός μητρώου |
| 20 | `department` | string | No | Τμήμα |
| 21 | `division` | string | No | Διεύθυνση |
| 22 | `responsibleMinistry` | string | No | Αρμόδιο υπουργείο |

### 2.3 Στοιχεία Form/Mapper (επιπλέον πεδία — αποθηκεύονται στο document)

Πεδία που δεν ορίζονται στο TypeScript interface αλλά αποθηκεύονται μέσω του mapper:

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 23 | `shortName` | string | No | Συντομογραφία (π.χ. "ΑΑΔΕ", "ΕΦΚΑ") |
| 24 | `category` | string | **Yes** | Κατηγορία φορέα (select via centralized options) |
| 25 | `supervisionMinistry` | string | No | Εποπτεύον Υπουργείο (via MinistryPicker) |
| 26 | `legalStatus` | string | No | Νομικό καθεστώς (ΝΠΔΔ, ΝΠΙΔ, κλπ) |
| 27 | `establishmentLaw` | string | No | Ιδρυτικός νόμος (π.χ. "Ν. 4389/2016") |
| 28 | `headTitle` | string | No | Τίτλος επικεφαλής (π.χ. "Διοικητής", "Γενικός Γραμματέας") |
| 29 | `headName` | string | No | Όνομα επικεφαλής |
| 30 | `fax` | string | No | Αριθμός fax |

### 2.4 Υπηρεσίες Φορέα (Παρεχόμενες Υπηρεσίες)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 31 | `servicesProvided` | string[] | No | Λίστα παρεχόμενων υπηρεσιών (type definition) |
| 32 | `mainResponsibilities` | string | No | Κύριες αρμοδιότητες (text) |
| 33 | `citizenServices` | string | No | Υπηρεσίες προς πολίτες |
| 34 | `onlineServices` | string | No | Ηλεκτρονικές υπηρεσίες (URLs/περιγραφή) |
| 35 | `serviceHours` | string | No | Ώρες εξυπηρέτησης (text) |

### 2.5 Ωράριο Λειτουργίας (`operatingHours`)

Structured object για αναλυτικό ωράριο:

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `monday` – `sunday` | DayHours | Ημερήσιο ωράριο |
| `exceptions` | string[] | Αργίες / εξαιρέσεις |

**DayHours:**

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `isOpen` | boolean | Ανοιχτό/Κλειστό |
| `openTime` | string? | Ώρα ανοίγματος (π.χ. "07:30") |
| `closeTime` | string? | Ώρα κλεισίματος (π.χ. "15:30") |
| `breakStart` | string? | Έναρξη διαλείμματος |
| `breakEnd` | string? | Λήξη διαλείμματος |

### 2.6 Λογότυπο & Φωτογραφίες

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 36 | `logoURL` | string | No | Λογότυπο υπηρεσίας |
| 37 | `photoURL` | string | No | Φωτογραφία εκπροσώπου |
| 38 | `multiplePhotoURLs` | string[] | No | Gallery φωτογραφιών |
| 39 | `multiplePhotos` | PhotoMetadata[] | No | Φωτογραφίες με metadata |

### 2.7 Επικοινωνία (Nested Arrays)

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

### 2.8 Αρμόδιοι/Υπεύθυνοι (`responsiblePersons[]`)

Embedded array μέσα στο service contact document:

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `name` | string | Yes | Ονοματεπώνυμο |
| `position` | string | No | Θέση/Ρόλος |
| `department` | string | No | Τμήμα |
| `email` | string | No | Email |
| `phone` | string | No | Τηλέφωνο |
| `isPrimary` | boolean | Yes | Κύριος υπεύθυνος |
| `responsibilities` | string[] | No | Αρμοδιότητες (extends ContactPerson) |
| `availableHours` | string | No | Ώρες διαθεσιμότητας |

> **Σημείωση**: Επεκτείνει τη `ContactPerson` δομή (κοινή με companies) με πρόσθετα πεδία `responsibilities` και `availableHours`.

---

## 3. Δεν υπάρχει Persona System για Υπηρεσίες

Όπως και οι Εταιρείες (SPEC-009), οι Δημόσιες Υπηρεσίες **ΔΕΝ** έχουν persona system. Ο ρόλος/τύπος της υπηρεσίας ορίζεται από:

| Ρόλος/Τύπος | Πώς ορίζεται | Πεδίο |
|-------------|-------------|-------|
| **Υπουργείο** | `serviceType = 'ministry'` | Discriminator |
| **ΔΟΥ** | `serviceType = 'tax_office'` | Discriminator |
| **Δήμος** | `serviceType = 'municipality'` | Discriminator |
| **Δημόσιος Οργανισμός** | `serviceType = 'public_organization'` | Discriminator |
| **Άλλο** | `serviceType = 'other'` | Discriminator |

---

## 4. Τραπεζικοί Λογαριασμοί (Subcollection)

**Path**: `contacts/{contactId}/bankAccounts/{accountId}`

Ίδια δομή με Φυσικά Πρόσωπα (SPEC-008 §4) και Εταιρείες (SPEC-009 §4):

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

## 5. Σχέσεις μεταξύ Υπηρεσίας ↔ Προσώπων/Εταιρειών (`contact_relationships`)

**Collection**: `contact_relationships`

### 5.1 Βασική Δομή

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `sourceContactId` | string | Υπηρεσία ή Πρόσωπο/Εταιρεία |
| `targetContactId` | string | Πρόσωπο/Εταιρεία ή Υπηρεσία |
| `relationshipType` | enum (63 τύποι) | Τύπος σχέσης |
| `status` | enum | `active` / `inactive` / `pending` / `terminated` / `suspended` |

### 5.2 Σχετικοί Τύποι Σχέσεων (Service-relevant)

| Κατηγορία | Τύποι |
|-----------|-------|
| **Εργασιακές (5)** | `employee`, `manager`, `director`, `civil_servant`, `department_head` |
| **Δημόσιες (8)** | `elected_official`, `appointed_official`, `ministry_official`, `mayor`, `deputy_mayor`, `regional_governor` + 2 |
| **Εποπτεία (3)** | `advisor`, `consultant`, `representative` |

### 5.3 Πρόσθετα Πεδία Σχέσης (ίδια με SPEC-008/009)

| Κατηγορία | Πεδία |
|-----------|-------|
| **Θέση** | `position`, `department`, `team`, `seniorityLevel`, `reportingLevel` |
| **Εργασιακά** | `employmentStatus`, `employmentType`, `employeeId` |
| **Χρονικά** | `startDate`, `endDate`, `expectedDuration`, `renewalDate`, `probationEndDate` |
| **Metadata** | `priority`, `relationshipStrength`, `communicationFrequency`, `lastInteractionDate` |

---

## 6. Σχέσεις με ΟΛΕΣ τις Οντότητες (Relationship Map)

### 6.1 Διάγραμμα Σχέσεων

```
                              ┌──────────────┐
                              │  ΔΗΜΟΣΙΑ     │
                              │  ΥΠΗΡΕΣΙΑ    │
                              │  (contacts   │
                              │  type=service)│
                              └──────┬───────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
    ┌─────┴─────┐            ┌───────┴───────┐          ┌──────┴──────┐
    │ ΑΝΘΡΩΠΟΙ  │            │ ΑΚΙΝΗΤΑ       │          │ CRM         │
    │           │            │               │          │             │
    ├───────────┤            ├───────────────┤          ├─────────────┤
    │ contact_  │            │ contact_links │          │ opportunities│
    │ relation- │            │ (service →    │          │ communic.   │
    │ ships     │            │  project/     │          │ tasks       │
    │ responsible│           │  building)    │          │ appointments│
    │ Persons[] │            └───────────────┘          └─────────────┘
    │ (embedded)│
    └───────────┘                                ┌─────────────┐
                                                 │ OMNICHANNEL │
                                                 ├─────────────┤
                                                 │ external_   │
                                                 │  identities │
                                                 │ conversations│
                                                 └─────────────┘
```

### 6.2 Αναλυτικός Πίνακας Σχέσεων

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Ρόλος Service | Περιγραφή |
|---|------------|-------------------|-------|---------------|-----------|
| 1 | **contact_relationships** | `sourceContactId`, `targetContactId` | N:M | Υπηρεσία ↔ Πρόσωπο/Εταιρεία | Σχέσεις εποπτείας, εργασίας, δημόσιας διοίκησης |
| 2 | **contact_links** | `sourceContactId` → `targetEntityId` | N:M | Υπηρεσία → Έργο/Κτίριο | Junction collection, ρόλος (regulator, inspector, κλπ) |
| 3 | **external_identities** | `linkedContactId` | 1:N | Υπηρεσία ← Telegram/Email | Omnichannel identity mapping |
| 4 | **conversations** | `linkedEntities.linkedContactId` | 1:N | Συνομιλητής | Omnichannel conversations |
| 5 | **communications** | `contactId` | 1:N | Αποδέκτης επικοινωνίας | Email, SMS, κλήσεις, σημειώσεις |
| 6 | **tasks** | `contactId` | 1:N | Σχετική υπηρεσία | CRM εργασίες (π.χ. "Υποβολή αίτησης στη ΔΟΥ") |
| 7 | **opportunities** | `contactId` | 1:N | Σχετικός φορέας | CRM pipeline (σπάνια χρήση) |
| 8 | **appointments** | `requester.contactId` | 1:N | Αιτών ραντεβού | AI pipeline appointments |
| 9 | **bankAccounts** (subcol) | `contacts/{id}/bankAccounts` | 1:N | Κάτοχος λογαριασμού | Τραπεζικοί λογαριασμοί |

### 6.3 Contact Subcollections

| # | Subcollection | Path | Περιγραφή |
|---|--------------|------|-----------|
| 1 | `activities` | `contacts/{id}/activities` | Δραστηριότητες |
| 2 | `communications` | `contacts/{id}/communications` | Επικοινωνίες |
| 3 | `notes` | `contacts/{id}/notes` | Σημειώσεις |
| 4 | `bankAccounts` | `contacts/{id}/bankAccounts` | Τραπεζικοί λογαριασμοί |

---

## 7. Διαφορές Υπηρεσίας vs Φυσικού Προσώπου vs Εταιρείας

| Χαρακτηριστικό | Φυσικό Πρόσωπο (008) | Εταιρεία (009) | Δημόσια Υπηρεσία (010) |
|---------------|----------------------|----------------|------------------------|
| **Personas** | ✅ 9 types | ❌ | ❌ |
| **Ονοματολογία** | firstName + lastName | companyName | serviceName + shortName |
| **ΑΦΜ** | Optional | **Required** | ❌ Δεν ισχύει |
| **ΓΕΜΗ** | ❌ | ✅ 16 πεδία | ❌ |
| **Νομική μορφή** | ❌ | legalForm (7 τύποι) | legalStatus (ΝΠΔΔ/ΝΠΙΔ κλπ) |
| **Τύπος φορέα** | ❌ | ❌ | serviceType (5 τύποι) |
| **Υπεύθυνοι** | ❌ | contactPersons[] | responsiblePersons[] (extended) |
| **Ωράριο** | ❌ | ❌ | ✅ operatingHours (7 ημέρες) |
| **Παρεχόμενες υπηρεσίες** | ❌ | ❌ | ✅ servicesProvided[], citizenServices, onlineServices |
| **Εποπτεύον υπουργείο** | ❌ | ❌ | ✅ supervisionMinistry (MinistryPicker, 21 entries) |
| **Ιδρυτικός νόμος** | ❌ | ❌ | ✅ establishmentLaw |
| **Επικεφαλής** | ❌ | ❌ | ✅ headTitle + headName |
| **Σύνδεση Ακινήτων** | contact_links, units.buyerContactId | linkedCompanyId (direct FK) | contact_links (regulator/inspector) |
| **Σύνδεση POs** | supplierId | supplierId | ❌ (δεν αγοράζει/πωλεί) |
| **Σύνδεση Τιμολ.** | contactId | contactId | ❌ (σπάνια χρήση) |
| **Registry** | ❌ | ❌ | ✅ ΥΠΕΣ PublicServicePicker |

---

## 8. Report Builder Impact — Τι σημαίνει αυτό για τα Domains

### 8.1 Domain B3 (Δημόσιες Υπηρεσίες) — Ενημερωμένες Στήλες

**Tier 1 (Flat Table) — Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Ονομασία | `serviceName` | text | **Required** |
| Συντομογραφία | `shortName` | text | π.χ. "ΑΑΔΕ", "ΕΦΚΑ" |
| Τύπος Φορέα | `serviceType` | enum | ministry/tax_office/municipality/public_organization/other |
| Κατηγορία | `category` | text | Centralized options |
| Εποπτεύον Υπουργείο | `supervisionMinistry` | text | MinistryPicker (21 options) |
| Μητρικός Οργανισμός | `parentOrganization` | text | |
| Κωδικός Υπηρεσίας | `serviceCode` | text | |
| Αρ. Μητρώου | `registryNumber` | text | |
| Τμήμα | `department` | text | |
| Διεύθυνση (org) | `division` | text | |
| Νομικό Καθεστώς | `legalStatus` | text | ΝΠΔΔ, ΝΠΙΔ, κλπ |
| Ιδρυτικός Νόμος | `establishmentLaw` | text | |
| Επικεφαλής (τίτλος) | `headTitle` | text | Διοικητής, Γ.Γ., κλπ |
| Επικεφαλής (όνομα) | `headName` | text | |
| Email (κύριο) | `emails[isPrimary].email` | text | Flat: μόνο primary |
| Τηλέφωνο (κύριο) | `phones[isPrimary].number` | text | Flat: μόνο primary |
| Fax | `fax` | text | |
| Πόλη | `addresses[isPrimary].city` | text | |
| Τ.Κ. | `addresses[isPrimary].postalCode` | text | |
| Δήμος | `addresses[isPrimary].municipality` | text | |
| Κύριος Υπεύθυνος | `responsiblePersons[isPrimary].name` | text | Primary responsible |
| Ώρες Εξυπηρέτησης | `serviceHours` | text | Free text |
| Status | `status` | enum | active/inactive/archived |
| Αγαπημένο | `isFavorite` | boolean | |
| Ημ/νία Δημιουργίας | `createdAt` | date | |

**Tier 1 — Computed/Joined columns (cross-entity):**

| Στήλη | Join | Τύπος | Σημείωση |
|-------|------|-------|----------|
| Αρ. Σχέσεων | COUNT contact_relationships | number | Σχέσεις με πρόσωπα/εταιρείες |
| Αρ. Συνδεδεμένων Έργων | COUNT contact_links WHERE targetEntityType | number | Έργα που σχετίζονται |
| Αρ. Επικοινωνιών | COUNT communications WHERE contactId | number | |
| Αρ. CRM Tasks | COUNT tasks WHERE contactId | number | |
| Αρ. Υπεύθυνων | LENGTH responsiblePersons[] | number | Embedded count |
| Αρ. Παρεχόμενων Υπηρεσιών | LENGTH servicesProvided[] | number | Embedded count |

### 8.2 Τύπος Φορέα → Τυπικά Δεδομένα

| serviceType | Τυπικά joined data | Σημειώσεις |
|-------------|-------------------|------------|
| `ministry` | contact_relationships (υπάλληλοι, αξιωματούχοι) | Πολλοί δημόσιοι υπάλληλοι |
| `tax_office` | contact_relationships (υπάλληλοι) | ΔΟΥ — σχέση με φυσικά/νομικά πρόσωπα (ΑΦΜ) |
| `municipality` | contact_links (σχετικά έργα), tasks | Δημαρχεία — σχετίζονται με κατασκευαστικά έργα |
| `public_organization` | contact_relationships, communications | ΕΦΚΑ, ΑΑΔΕ, ΤΕΕ, κλπ |
| `other` | γενικά | Λοιποί φορείς |

### 8.3 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `emails[]` | type, email, isPrimary | ~5 |
| `phones[]` | type, number, countryCode, isPrimary | ~5 |
| `addresses[]` | type, street, city, postalCode, municipality, isPrimary | ~3 |
| `websites[]` | type, url | ~3 |
| `socialMedia[]` | platform, username, url | ~3 |
| `responsiblePersons[]` | name, position, department, email, phone, isPrimary, responsibilities, availableHours | ~10 |
| `servicesProvided[]` | service (string) | ~20 |
| `operatingHours` | day, isOpen, openTime, closeTime, breakStart, breakEnd | 7 (Mon-Sun) |

### 8.4 Tier 3 (Service Card PDF) — Sections

```
┌─────────────────────────────────────────┐
│ [ΛΟΓΟΤΥΠΟ] ΟΝΟΜΑΣΙΑ ΥΠΗΡΕΣΙΑΣ          │
│            Τύπος Φορέα | Status         │
├─────────────────────────────────────────┤
│ ΤΑΥΤΟΤΗΤΑ ΥΠΗΡΕΣΙΑΣ                    │
│ Συντομογραφία | Κατηγορία              │
│ Κωδικός | Αρ. Μητρώου                  │
│ Εποπτεύον Υπουργείο                    │
│ Μητρικός Οργανισμός                    │
│ Νομικό Καθεστώς | Ιδρυτικός Νόμος     │
│ Τμήμα | Διεύθυνση                       │
├─────────────────────────────────────────┤
│ ΔΙΟΙΚΗΣΗ                                │
│ Επικεφαλής: [headTitle] [headName]      │
├─────────────────────────────────────────┤
│ ΕΠΙΚΟΙΝΩΝΙΑ                              │
│ [πίνακας emails]                        │
│ [πίνακας phones + fax]                  │
│ [πίνακας addresses]                     │
│ [πίνακας websites + social]             │
├─────────────────────────────────────────┤
│ ΥΠΕΥΘΥΝΟΙ                               │
│ [πίνακας: Όνομα, Θέση, Τμήμα,         │
│  Email, Τηλ., Αρμοδιότητες, Ώρες]     │
├─────────────────────────────────────────┤
│ ΩΡΑΡΙΟ ΛΕΙΤΟΥΡΓΙΑΣ                      │
│ [πίνακας 7 ημερών: Ημέρα, Ώρες,       │
│  Διάλειμμα]                             │
│ Εξαιρέσεις: [λίστα]                    │
├─────────────────────────────────────────┤
│ ΠΑΡΕΧΟΜΕΝΕΣ ΥΠΗΡΕΣΙΕΣ                  │
│ Κύριες αρμοδιότητες: [text]            │
│ Υπηρεσίες πολιτών: [text]             │
│ Ηλεκτρονικές υπηρεσίες: [text]        │
│ [λίστα servicesProvided]                │
├─────────────────────────────────────────┤
│ ΤΡΑΠΕΖΙΚΟΙ ΛΟΓΑΡΙΑΣΜΟΙ                  │
│ [πίνακας: Τράπεζα, IBAN, Τύπος]        │
├─────────────────────────────────────────┤
│ ΣΧΕΣΕΙΣ (via contact_relationships)      │
│ [πίνακας: Πρόσωπο/Εταιρεία, Τύπος]    │
├─────────────────────────────────────────┤
│ ΣΥΝΔΕΔΕΜΕΝΑ ΕΡΓΑ (via contact_links)    │
│ [πίνακας: Έργο, Ρόλος, Status]         │
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
| Πεδία ServiceContact (type definition) | 22 (service-specific) |
| Πεδία Form/Mapper (extended) | 35 (including shortName, category, legalStatus, κλπ) |
| Πεδία ωραρίου (operatingHours) | 7×5 + exceptions = ~37 |
| Πεδία nested arrays (emails, phones, κλπ) | ~40 (across arrays) |
| ResponsiblePerson fields | 8 (extends ContactPerson + responsibilities + availableHours) |
| Persona types | 0 (τύπος ορίζεται via serviceType enum) |
| serviceType values | 5 (ministry, tax_office, municipality, public_organization, other) |
| Τραπεζικοί λογαριασμοί (subcollection) | 12 fields |
| Cross-entity references | 9 collections |
| Contact subcollections | 4 (activities, communications, notes, bankAccounts) |
| **Σύνολο πεδίων (πλήρης δημόσια υπηρεσία)** | **~130+** |
