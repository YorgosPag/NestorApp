# SPEC-021: Πλήρης Χαρτογράφηση — CRM & Επικοινωνία

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/crm.ts`, `src/types/appointment.ts`, `src/types/recurrence.ts`, `src/schemas/ai-analysis.ts`, `src/constants/triage-statuses.ts`)

---

## Περιεχόμενα

- [Οντότητα 1: Opportunities (Pipeline)](#οντότητα-1-opportunities-pipeline)
- [Οντότητα 2: CRM Tasks (Εργασίες)](#οντότητα-2-crm-tasks-εργασίες)
- [Οντότητα 3: Communications (Επικοινωνίες)](#οντότητα-3-communications-επικοινωνίες)
- [Οντότητα 4: Appointments (Ραντεβού)](#οντότητα-4-appointments-ραντεβού)
- [§5. Σχέσεις μεταξύ CRM Οντοτήτων + Εξωτερικές](#5-σχέσεις-μεταξύ-crm-οντοτήτων--εξωτερικές)
- [§6. Report Builder Impact](#6-report-builder-impact)
- [§7. Στατιστικά](#7-στατιστικά)

---

# Οντότητα 1: Opportunities (Pipeline)

## 1.1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `opportunities` (`COLLECTIONS.OPPORTUNITIES`) |
| **TypeScript** | `Opportunity` (`src/types/crm.ts`) |
| **ID Pattern** | Enterprise ID: `opp_XXXXX` (`enterprise-id.service.ts`) |
| **Tenant Isolation** | Implicit via `contactId` → contact.companyId |
| **Search Index** | `title` (title), `stage`, `status` (subtitle), `fullName`, `email`, `phone`, `notes` (searchable) |
| **API Route** | `/crm/opportunities/{id}` (via search index) |
| **Deletion** | Blocking dependency on `contact` (via `contactId`) |

## 1.2 Πλήρης Κατάλογος Πεδίων

### Βασικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | — | Enterprise ID (`opp_XXXXX`) |
| 2 | `title` | string | **Yes** | Τίτλος ευκαιρίας |
| 3 | `contactId` | string | **Yes** | Contact ID (lead/prospect) |
| 4 | `fullName` | string | No | Denormalized όνομα επαφής |
| 5 | `email` | string | No | Denormalized email |
| 6 | `phone` | string | No | Denormalized τηλέφωνο |
| 7 | `notes` | string | No | Σημειώσεις |
| 8 | `stage` | OpportunityStage | **Yes** | 8-stage pipeline (βλ. §1.4) |
| 9 | `probability` | number | No | Πιθανότητα κλεισίματος (0-100%) |
| 10 | `estimatedValue` | number | No | Εκτιμώμενη αξία (€) |
| 11 | `expectedCloseDate` | Timestamp | No | Αναμενόμενη ημ/νία κλεισίματος |
| 12 | `assignedTo` | string | **Yes** | User ID υπεύθυνου |
| 13 | `team` | string[] | No | User IDs ομάδας |
| 14 | `lastActivity` | Timestamp | No | Τελευταία δραστηριότητα |
| 15 | `nextAction` | string | No | Περιγραφή επόμενης ενέργειας |
| 16 | `nextActionDate` | Timestamp | No | Ημ/νία επόμενης ενέργειας |
| 17 | `source` | OpportunitySource | No | Πηγή lead (βλ. §1.4) |
| 18 | `campaign` | string | No | Campaign/καμπάνια |
| 19 | `referredBy` | string | No | Contact ID — ποιος σύστησε |
| 20 | `status` | OpportunityStatus | **Yes** | 4 καταστάσεις (βλ. §1.4) |
| 21 | `wonDate` | Timestamp | No | Ημ/νία κλεισίματος (αν won) |
| 22 | `createdAt` | Timestamp | **Yes** | Ημ/νία δημιουργίας |
| 23 | `updatedAt` | Timestamp | **Yes** | Ημ/νία ενημέρωσης |

### Nested: `interestedIn` (Ενδιαφέρον Αγοραστή)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 24 | `interestedIn.projectIds` | string[] | No | Έργα ενδιαφέροντος |
| 25 | `interestedIn.buildingIds` | string[] | No | Κτίρια ενδιαφέροντος |
| 26 | `interestedIn.unitIds` | string[] | No | Μονάδες ενδιαφέροντος |
| 27 | `interestedIn.propertyType` | enum | No | `apartment` / `maisonette` / `store` / `office` / `parking` / `storage` |
| 28 | `interestedIn.budget.min` | number | No | Ελάχιστος προϋπολογισμός (€) |
| 29 | `interestedIn.budget.max` | number | No | Μέγιστος προϋπολογισμός (€) |
| 30 | `interestedIn.desiredArea.min` | number | No | Ελάχιστο εμβαδόν (m²) |
| 31 | `interestedIn.desiredArea.max` | number | No | Μέγιστο εμβαδόν (m²) |
| 32 | `interestedIn.locations` | string[] | No | Περιοχές ενδιαφέροντος |

## 1.3 Subcollections

Η οντότητα Opportunity **ΔΕΝ έχει subcollections**.

## 1.4 Enums

### OpportunityStage (8 στάδια — pipeline)

| Τιμή | Περιγραφή |
|------|-----------|
| `initial_contact` | Αρχική επαφή |
| `qualification` | Αξιολόγηση |
| `viewing` | Επίσκεψη/Προβολή |
| `proposal` | Πρόταση |
| `negotiation` | Διαπραγμάτευση |
| `contract` | Συμβόλαιο |
| `closed_won` | Κλείσιμο — Επιτυχία |
| `closed_lost` | Κλείσιμο — Αποτυχία |

### OpportunitySource (6 τιμές)

| Τιμή | Περιγραφή |
|------|-----------|
| `website` | Ιστοσελίδα |
| `referral` | Σύσταση |
| `agent` | Μεσίτης |
| `social` | Social media |
| `phone` | Τηλέφωνο |
| `walkin` | Walk-in |

### OpportunityStatus (4 τιμές)

| Τιμή | Περιγραφή |
|------|-----------|
| `active` | Ενεργή |
| `on_hold` | Σε αναμονή |
| `lost` | Χαμένη |
| `won` | Κερδισμένη |

### PropertyType (6 τιμές — interestedIn)

`apartment` | `maisonette` | `store` | `office` | `parking` | `storage`

---

# Οντότητα 2: CRM Tasks (Εργασίες)

## 2.1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `tasks` (`COLLECTIONS.TASKS`) |
| **TypeScript** | `CrmTask` (`src/types/crm.ts`) |
| **ID Pattern** | Enterprise ID: `task_XXXXX` (`enterprise-id.service.ts`) |
| **Tenant Isolation** | `companyId` (ADR-029) |

## 2.2 Πλήρης Κατάλογος Πεδίων

### Βασικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | — | Enterprise ID (`task_XXXXX`) |
| 2 | `companyId` | string | No* | Tenant isolation (*server-injected) |
| 3 | `title` | string | **Yes** | Τίτλος εργασίας |
| 4 | `description` | string \| null | No | Περιγραφή |
| 5 | `type` | CrmTaskType | **Yes** | 8 τύποι (βλ. §2.4) |
| 6 | `leadId` | string | No | Legacy Lead ID |
| 7 | `opportunityId` | string | No | Linked opportunity |
| 8 | `contactId` | string \| null | No | Σχετική επαφή |
| 9 | `projectId` | string \| null | No | Σχετικό έργο |
| 10 | `unitId` | string | No | Σχετική μονάδα |
| 11 | `assignedTo` | string | **Yes** | User ID υπεύθυνου |
| 12 | `assignedBy` | string | No | User ID ανάθεσης |
| 13 | `dueDate` | Timestamp \| null | No | Ημ/νία λήξης |
| 14 | `reminderDate` | Timestamp \| null | No | Ημ/νία υπενθύμισης |
| 15 | `completedAt` | Timestamp | No | Ημ/νία ολοκλήρωσης |
| 16 | `status` | CrmTaskStatus | **Yes** | 4 καταστάσεις (βλ. §2.4) |
| 17 | `priority` | CrmTaskPriority | **Yes** | 4 επίπεδα (βλ. §2.4) |
| 18 | `createdAt` | Timestamp | **Yes** | Ημ/νία δημιουργίας |
| 19 | `updatedAt` | Timestamp | **Yes** | Ημ/νία ενημέρωσης |
| 20 | `reminderSent` | boolean | No | Αν στάλθηκε υπενθύμιση |
| 21 | `metadata` | Record<string, unknown> | No | Extensible metadata |
| 22 | `endDate` | string \| null | No | ISO date — τέλος multi-day event |
| 23 | `attendees` | string[] | No | User IDs παρευρισκομένων (Phase 3) |

### Nested: `viewingDetails` (Αν type = 'viewing')

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 24 | `viewingDetails.location` | string | Yes | Τοποθεσία επίσκεψης |
| 25 | `viewingDetails.units` | string[] | Yes | Unit IDs προβολής |
| 26 | `viewingDetails.attendees` | string[] | Yes | Παρευρισκόμενοι |
| 27 | `viewingDetails.notes` | string | Yes | Σημειώσεις επίσκεψης |

### Nested: `recurrence` (RecurrencePattern — Phase 3)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 28 | `recurrence.frequency` | enum | Yes | `daily` / `weekly` / `monthly` / `yearly` |
| 29 | `recurrence.interval` | number | Yes | Κάθε Ν (π.χ. κάθε 2 εβδομάδες) |
| 30 | `recurrence.daysOfWeek` | number[] | No | 0=Κυρ..6=Σάβ (αν weekly) |
| 31 | `recurrence.endType` | enum | Yes | `never` / `date` / `count` |
| 32 | `recurrence.endDate` | string | No | ISO date (αν endType=date) |
| 33 | `recurrence.occurrences` | number | No | Μέγιστος αριθμός (αν endType=count) |

## 2.3 Subcollections

Η οντότητα CrmTask **ΔΕΝ έχει subcollections**.

## 2.4 Enums

### CrmTaskType (8 τιμές)

| Τιμή | Περιγραφή |
|------|-----------|
| `call` | Τηλεφώνημα |
| `email` | Email |
| `meeting` | Συνάντηση |
| `viewing` | Επίσκεψη ακινήτου |
| `document` | Έγγραφο |
| `follow_up` | Follow-up |
| `complaint` | Παράπονο |
| `other` | Άλλο |

### CrmTaskStatus (4 τιμές)

| Τιμή | Περιγραφή |
|------|-----------|
| `pending` | Εκκρεμεί |
| `in_progress` | Σε εξέλιξη |
| `completed` | Ολοκληρωμένη |
| `cancelled` | Ακυρωμένη |

### CrmTaskPriority (4 τιμές)

| Τιμή | Περιγραφή |
|------|-----------|
| `low` | Χαμηλή |
| `medium` | Μεσαία |
| `high` | Υψηλή |
| `urgent` | Επείγουσα |

---

# Οντότητα 3: Communications (Επικοινωνίες)

## 3.1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `communications` (`COLLECTIONS.COMMUNICATIONS`) |
| **TypeScript** | `Communication` (`src/types/crm.ts`) |
| **ID Pattern** | Auto-generated (Firestore) — δεν χρησιμοποιεί enterprise-id |
| **Tenant Isolation** | `companyId` (ADR-029) |
| **Search Index** | `subject` ή content preview (title), `type`/`direction` (subtitle) |
| **Deletion** | Blocking dependency on `contact` (via `contactId`) |

## 3.2 Πλήρης Κατάλογος Πεδίων

### Βασικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | — | Firestore auto-generated |
| 2 | `companyId` | string | No* | Tenant isolation (*enterprise added 2026-02-03) |
| 3 | `contactId` | string | **Yes** | Σχετική επαφή |
| 4 | `projectId` | string | No | Σχετικό έργο |
| 5 | `unitId` | string | No | Σχετική μονάδα |
| 6 | `opportunityId` | string | No | Σχετική ευκαιρία |
| 7 | `type` | CommunicationType | **Yes** | 7 τύποι (βλ. §3.4) |
| 8 | `direction` | CommunicationDirection | **Yes** | `inbound` / `outbound` |
| 9 | `from` | string | No | Αποστολέας |
| 10 | `to` | string | No | Παραλήπτης |
| 11 | `subject` | string | No | Θέμα |
| 12 | `content` | string | **Yes** | Περιεχόμενο |
| 13 | `attachments` | string[] | No | URLs συνημμένων |
| 14 | `duration` | number | No | Διάρκεια κλήσης (sec) |
| 15 | `meetingDate` | Timestamp | No | Ημ/νία συνάντησης |
| 16 | `location` | string | No | Τοποθεσία συνάντησης |
| 17 | `attendees` | string[] | No | Παρευρισκόμενοι |
| 18 | `createdBy` | string | **Yes** | User ID δημιουργού |
| 19 | `createdAt` | Timestamp | **Yes** | Ημ/νία δημιουργίας |
| 20 | `updatedAt` | Timestamp | **Yes** | Ημ/νία ενημέρωσης |
| 21 | `status` | CommunicationStatus | **Yes** | 7 καταστάσεις (βλ. §3.4) |
| 22 | `requiresFollowUp` | boolean | No | Αν απαιτεί follow-up |
| 23 | `followUpDate` | Timestamp | No | Ημ/νία follow-up |
| 24 | `metadata` | Record<string, unknown> | No | Extensible metadata |

### AI Analysis Fields (Enterprise — Phase 1 Omnichannel Intake)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 25 | `intentAnalysis` | MessageIntentAnalysis | No | AI ανάλυση intent (βλ. §3.5) |
| 26 | `triageStatus` | TriageStatus | No | Κατάσταση triage: `pending` / `reviewed` / `approved` / `rejected` |
| 27 | `linkedTaskId` | string | No | Auto-created CRM task ID |

## 3.3 Subcollections

Η οντότητα Communication **ΔΕΝ έχει subcollections**.

## 3.4 Enums

### CommunicationType (7 τιμές)

| Τιμή | Περιγραφή |
|------|-----------|
| `email` | Email |
| `phone` | Τηλέφωνο |
| `sms` | SMS |
| `whatsapp` | WhatsApp |
| `telegram` | Telegram |
| `meeting` | Συνάντηση |
| `note` | Σημείωση |

### CommunicationDirection (2 τιμές)

| Τιμή | Περιγραφή |
|------|-----------|
| `inbound` | Εισερχόμενη |
| `outbound` | Εξερχόμενη |

### CommunicationStatus (7 τιμές)

| Τιμή | Περιγραφή |
|------|-----------|
| `completed` | Ολοκληρωμένη |
| `scheduled` | Προγραμματισμένη |
| `cancelled` | Ακυρωμένη |
| `pending` | Εκκρεμεί |
| `sent` | Αποσταλμένη |
| `delivered` | Παραδόθηκε |
| `failed` | Απέτυχε |

### TriageStatus (4 τιμές — SSoT: `src/constants/triage-statuses.ts`)

| Τιμή | Περιγραφή |
|------|-----------|
| `pending` | Εκκρεμεί αξιολόγηση |
| `reviewed` | Αξιολογήθηκε |
| `approved` | Εγκρίθηκε |
| `rejected` | Απορρίφθηκε |

## 3.5 AI Analysis — MessageIntentAnalysis (Nested Object)

SSoT: `src/schemas/ai-analysis.ts` — Zod schema `MessageIntentAnalysisSchema`

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `kind` | `'message_intent'` | Discriminator |
| `intentType` | IntentTypeValue | 20+ intent types (appointment_request, property_search, invoice, κλπ) |
| `extractedEntities` | ExtractedBusinessEntities | Εξαγόμενα business entities |
| `confidence` | number (0-1) | Βαθμός εμπιστοσύνης |
| `needsTriage` | boolean | Αν χρειάζεται manual review |
| `aiModel` | string | AI model used |
| `analysisTimestamp` | string (ISO 8601) | Χρονοσήμανση ανάλυσης |
| `rawMessage` | string | Αρχικό μήνυμα |

**IntentTypeValue** (20+ τιμές — SSoT: `ai-analysis.ts`):
`delivery`, `appointment`, `issue`, `payment`, `info_update`, `triage_needed`, `appointment_request`, `property_search`, `invoice`, `document_request`, `outbound_send`, `report_request`, `dashboard_query`, `status_inquiry`, `defect_report`, `procurement_request`, `payment_notification`, + admin intents

---

# Οντότητα 4: Appointments (Ραντεβού)

## 4.1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `appointments` (`COLLECTIONS.APPOINTMENTS`) |
| **TypeScript** | `AppointmentDocument` (`src/types/appointment.ts`) |
| **ID Pattern** | Enterprise ID: `appt_XXXXX` (`enterprise-id.service.ts`) |
| **Tenant Isolation** | `companyId` (ADR-029) |
| **Created By** | UC-001 AppointmentModule (AI Pipeline) |
| **Deletion** | Blocking dependency on `contact` (via `requester.contactId`) |

## 4.2 Πλήρης Κατάλογος Πεδίων

### Βασικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | — | Enterprise ID (`appt_XXXXX`) |
| 2 | `companyId` | string | **Yes** | Tenant isolation |
| 3 | `pipelineRequestId` | string | **Yes** | Correlation ID → `ai_pipeline_queue` |
| 4 | `assignedTo` | string | No | User ID υπεύθυνου |
| 5 | `assignedRole` | string | **Yes** | Ρόλος υπεύθυνου |
| 6 | `status` | AppointmentStatus | **Yes** | 5 καταστάσεις (βλ. §4.4) |
| 7 | `createdAt` | string (ISO 8601) | **Yes** | Ημ/νία δημιουργίας |
| 8 | `updatedAt` | string (ISO 8601) | **Yes** | Ημ/νία ενημέρωσης |
| 9 | `approvedBy` | string \| null | No | User ID εγκρίνοντα |
| 10 | `approvedAt` | string \| null | No | Ημ/νία έγκρισης |

### Nested: `source` (Προέλευση)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 11 | `source.channel` | string | **Yes** | Κανάλι (telegram, email, κλπ) |
| 12 | `source.messageId` | string | **Yes** | Communication/message ID |

### Nested: `requester` (Αιτών)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 13 | `requester.email` | string \| null | No | Email αιτούντα |
| 14 | `requester.name` | string \| null | No | Όνομα αιτούντα |
| 15 | `requester.contactId` | string \| null | No | Contact ID (null αν unknown) |
| 16 | `requester.isKnownContact` | boolean | **Yes** | Αν βρέθηκε στο contacts |

### Nested: `appointment` (Λεπτομέρειες)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 17 | `appointment.requestedDate` | string \| null | No | Ημ/νία αιτήματος (YYYY-MM-DD) |
| 18 | `appointment.requestedTime` | string \| null | No | Ώρα αιτήματος (HH:mm) |
| 19 | `appointment.confirmedDate` | string | No | Επιβεβαιωμένη ημ/νία (μετά approval) |
| 20 | `appointment.confirmedTime` | string | No | Επιβεβαιωμένη ώρα |
| 21 | `appointment.description` | string | **Yes** | Περιγραφή αιτήματος (AI summary) |
| 22 | `appointment.notes` | string | No | Σημειώσεις (operator/AI) |

## 4.3 Subcollections

Η οντότητα Appointment **ΔΕΝ έχει subcollections**.

## 4.4 Enums

### AppointmentStatus (5 τιμές — Lifecycle FSM)

```
pending_approval → approved → completed
                 → rejected
                 → cancelled
```

| Τιμή | Περιγραφή |
|------|-----------|
| `pending_approval` | Αναμένει έγκριση |
| `approved` | Εγκρίθηκε |
| `rejected` | Απορρίφθηκε |
| `cancelled` | Ακυρώθηκε |
| `completed` | Ολοκληρώθηκε |

---

# §5. Σχέσεις μεταξύ CRM Οντοτήτων + Εξωτερικές

## 5.1 Διάγραμμα Σχέσεων

```
                         ┌──────────────┐
                         │   CONTACTS   │
                         │  (contacts)  │
                         └──────┬───────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
   ┌─────┴──────┐       ┌──────┴───────┐       ┌──────┴──────┐
   │OPPORTUNITY │       │COMMUNICATION │       │ APPOINTMENT │
   │(opportuni- │       │(communicat-  │       │(appointments│
   │ ties)      │       │ ions)        │       │)            │
   └─────┬──────┘       └──────┬───────┘       └──────┬──────┘
         │                     │                      │
         │              ┌──────┴───────┐              │
         ├──────────────┤  CRM TASK    ├──────────────┘
         │              │  (tasks)     │    (via pipelineRequestId
         │              └──────┬───────┘     → ai_pipeline_queue)
         │                     │
   ┌─────┴──────┐       ┌──────┴───────┐
   │ ΑΚΙΝΗΤΑ    │       │ AI PIPELINE  │
   │            │       │              │
   ├────────────┤       ├──────────────┤
   │ projects   │       │ ai_pipeline_ │
   │ buildings  │       │  queue       │
   │ units      │       │ ai_chat_     │
   └────────────┘       │  history     │
                        └──────────────┘
```

## 5.2 Αναλυτικός Πίνακας Σχέσεων

### Opportunity (E1)

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Περιγραφή |
|---|------------|-------------------|-------|-----------|
| 1 | **contacts** | `contactId` | N:1 | Lead/prospect |
| 2 | **contacts** | `referredBy` | N:1 | Referrer (ποιος σύστησε) |
| 3 | **projects** | `interestedIn.projectIds[]` | N:M | Έργα ενδιαφέροντος |
| 4 | **buildings** | `interestedIn.buildingIds[]` | N:M | Κτίρια ενδιαφέροντος |
| 5 | **units** | `interestedIn.unitIds[]` | N:M | Μονάδες ενδιαφέροντος |
| 6 | **tasks** | `tasks.opportunityId` = `opp.id` | 1:N | CRM tasks linked |
| 7 | **communications** | `communications.opportunityId` = `opp.id` | 1:N | Επικοινωνίες linked |

### CRM Task (E2)

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Περιγραφή |
|---|------------|-------------------|-------|-----------|
| 8 | **contacts** | `contactId` | N:1 | Σχετική επαφή |
| 9 | **opportunities** | `opportunityId` | N:1 | Σχετική ευκαιρία |
| 10 | **projects** | `projectId` | N:1 | Σχετικό έργο |
| 11 | **units** | `unitId` | N:1 | Σχετική μονάδα |
| 12 | **communications** | `communications.linkedTaskId` = `task.id` | 1:1 | Auto-created task ← communication |

### Communication (E3)

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Περιγραφή |
|---|------------|-------------------|-------|-----------|
| 13 | **contacts** | `contactId` | N:1 | Σχετική επαφή |
| 14 | **projects** | `projectId` | N:1 | Σχετικό έργο |
| 15 | **units** | `unitId` | N:1 | Σχετική μονάδα |
| 16 | **opportunities** | `opportunityId` | N:1 | Σχετική ευκαιρία |
| 17 | **tasks** | `linkedTaskId` | 1:1 | Auto-created CRM task |

### Appointment (E4)

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Περιγραφή |
|---|------------|-------------------|-------|-----------|
| 18 | **contacts** | `requester.contactId` | N:1 | Αιτών (αν known) |
| 19 | **ai_pipeline_queue** | `pipelineRequestId` | 1:1 | Pipeline correlation |
| 20 | **companies** | `companyId` | N:1 | Tenant isolation |

---

# §6. Report Builder Impact

## 6.1 E1 — Opportunities (Ευκαιρίες Pipeline)

### Tier 1 (Flat Table) — Primary columns

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Τίτλος | `title` | text |
| Στάδιο | `stage` | enum |
| Status | `status` | enum |
| Εκτ. Αξία | `estimatedValue` | currency |
| Πιθανότητα | `probability` | percentage |
| Πηγή | `source` | enum |
| Τύπος Ακινήτου | `interestedIn.propertyType` | enum |
| Budget Min | `interestedIn.budget.min` | currency |
| Budget Max | `interestedIn.budget.max` | currency |
| Εμβαδόν Min | `interestedIn.desiredArea.min` | number |
| Εμβαδόν Max | `interestedIn.desiredArea.max` | number |
| Υπεύθυνος | `assignedTo` | text |
| Επόμενη Ενέργεια | `nextAction` | text |
| Ημ/νία Επόμενης | `nextActionDate` | date |
| Ημ/νία Κλεισίματος | `expectedCloseDate` | date |
| Ημ/νία Won | `wonDate` | date |
| Campaign | `campaign` | text |
| Ημ/νία Δημιουργίας | `createdAt` | date |

### Tier 1 — Computed/Joined

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Επαφή | JOIN contacts ON contactId | text |
| Email Επαφής | JOIN contacts → email | text |
| Τηλ. Επαφής | JOIN contacts → phone | text |
| Σύσταση από | JOIN contacts ON referredBy | text |
| Αρ. Εργασιών | COUNT tasks WHERE opportunityId | number |
| Αρ. Επικοινωνιών | COUNT communications WHERE opportunityId | number |
| Τελ. Δραστηριότητα | `lastActivity` | date |

### Tier 2 (Row Repetition)

| Array | Πεδία ανά row | Μέγιστο |
|-------|---------------|---------|
| `interestedIn.projectIds[]` | project name (via JOIN) | ~5 |
| `interestedIn.buildingIds[]` | building name (via JOIN) | ~5 |
| `interestedIn.unitIds[]` | unit code (via JOIN) | ~10 |
| `interestedIn.locations[]` | location text | ~5 |
| `team[]` | user display name | ~5 |

### Tier 3 (Opportunity Card PDF)

```
┌─────────────────────────────────────────┐
│ [ΤΙΤΛΟΣ ΕΥΚΑΙΡΙΑΣ]                     │
│ Stage: ████████░░░░ | Status            │
├─────────────────────────────────────────┤
│ ΕΠΑΦΗ                                    │
│ Όνομα | Email | Τηλέφωνο               │
│ Σύσταση από: [referrer name]           │
├─────────────────────────────────────────┤
│ ΕΝΔΙΑΦΕΡΟΝ                               │
│ Τύπος: Apartment | Budget: €X - €Y     │
│ Εμβαδόν: X - Y m² | Περιοχές: [list]  │
│ Έργα: [project names]                  │
│ Μονάδες: [unit codes]                  │
├─────────────────────────────────────────┤
│ ΟΙΚΟΝΟΜΙΚΑ                               │
│ Εκτ. Αξία | Πιθανότητα | Αναμ. Close  │
├─────────────────────────────────────────┤
│ ΕΝΕΡΓΕΙΕΣ                                │
│ Υπεύθυνος | Ομάδα                      │
│ Επόμενη ενέργεια | Ημ/νία             │
│ Tasks: X | Communications: Y           │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [notes]                                 │
└─────────────────────────────────────────┘
```

---

## 6.2 E2 — CRM Tasks (Εργασίες)

### Tier 1 (Flat Table)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Τίτλος | `title` | text |
| Τύπος | `type` | enum |
| Προτεραιότητα | `priority` | enum |
| Status | `status` | enum |
| Υπεύθυνος | `assignedTo` | text |
| Ανατέθηκε από | `assignedBy` | text |
| Ημ/νία Λήξης | `dueDate` | date |
| Ημ/νία Ολοκλήρωσης | `completedAt` | date |
| Υπενθύμιση | `reminderDate` | date |
| Περιγραφή | `description` | text |
| Ημ/νία Δημιουργίας | `createdAt` | date |

### Tier 1 — Computed/Joined

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Επαφή | JOIN contacts ON contactId | text |
| Ευκαιρία | JOIN opportunities ON opportunityId | text |
| Έργο | JOIN projects ON projectId | text |
| Μονάδα | JOIN units ON unitId | text |
| Overdue | computed: dueDate < now AND status != completed | boolean |

### Tier 2 (Row Repetition)

| Array | Πεδία ανά row | Μέγιστο |
|-------|---------------|---------|
| `viewingDetails.units[]` | unit code (via JOIN) | ~5 |
| `viewingDetails.attendees[]` | attendee name | ~5 |
| `attendees[]` | user display name | ~5 |

### Tier 3 (Task Card PDF)

```
┌─────────────────────────────────────────┐
│ [ΤΙΤΛΟΣ ΕΡΓΑΣΙΑΣ]                       │
│ Type: call | Priority: high | Status    │
├─────────────────────────────────────────┤
│ ΑΝΑΘΕΣΗ                                  │
│ Υπεύθυνος | Ανατέθηκε από              │
│ Λήξη | Υπενθύμιση | Ολοκλήρωση        │
├─────────────────────────────────────────┤
│ CONTEXT                                  │
│ Επαφή | Ευκαιρία | Έργο | Μονάδα      │
├─────────────────────────────────────────┤
│ VIEWING DETAILS (αν type=viewing)        │
│ Τοποθεσία | Μονάδες | Παρευρισκόμενοι  │
│ Σημειώσεις                              │
├─────────────────────────────────────────┤
│ ΠΕΡΙΓΡΑΦΗ                                │
│ [description]                           │
└─────────────────────────────────────────┘
```

---

## 6.3 E3 — Communications (Επικοινωνίες)

### Tier 1 (Flat Table)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Θέμα | `subject` | text |
| Τύπος | `type` | enum |
| Κατεύθυνση | `direction` | enum |
| Status | `status` | enum |
| Από | `from` | text |
| Προς | `to` | text |
| Διάρκεια (sec) | `duration` | number |
| Τοποθεσία | `location` | text |
| Follow-up | `requiresFollowUp` | boolean |
| Ημ/νία Follow-up | `followUpDate` | date |
| Triage | `triageStatus` | enum |
| AI Intent | `intentAnalysis.intentType` | text |
| AI Confidence | `intentAnalysis.confidence` | number |
| Ημ/νία Δημιουργίας | `createdAt` | date |

### Tier 1 — Computed/Joined

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Επαφή | JOIN contacts ON contactId | text |
| Έργο | JOIN projects ON projectId | text |
| Μονάδα | JOIN units ON unitId | text |
| Ευκαιρία | JOIN opportunities ON opportunityId | text |
| Linked Task | JOIN tasks ON linkedTaskId | text |

### Tier 2 (Row Repetition)

| Array | Πεδία ανά row | Μέγιστο |
|-------|---------------|---------|
| `attachments[]` | URL | ~10 |
| `attendees[]` | attendee name | ~5 |

### Tier 3 (Communication Card PDF)

```
┌─────────────────────────────────────────┐
│ [ΘΕΜΑ ή content preview]               │
│ Type: email | Direction: inbound        │
├─────────────────────────────────────────┤
│ ΑΠΟΣΤΟΛΕΑΣ / ΠΑΡΑΛΗΠΤΗΣ                  │
│ Από | Προς | Επαφή                      │
├─────────────────────────────────────────┤
│ CONTEXT                                  │
│ Έργο | Μονάδα | Ευκαιρία               │
├─────────────────────────────────────────┤
│ ΠΕΡΙΕΧΟΜΕΝΟ                              │
│ [content - truncated for PDF]           │
├─────────────────────────────────────────┤
│ AI ANALYSIS (αν υπάρχει)                 │
│ Intent: appointment_request | Conf: 0.9 │
│ Triage: approved                        │
├─────────────────────────────────────────┤
│ FOLLOW-UP                                │
│ Required: ✅ | Date: [followUpDate]     │
│ Linked Task: [taskId]                   │
└─────────────────────────────────────────┘
```

---

## 6.4 E4 — Appointments (Ραντεβού)

### Tier 1 (Flat Table)

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Περιγραφή | `appointment.description` | text |
| Status | `status` | enum |
| Κανάλι | `source.channel` | text |
| Αιτών | `requester.name` | text |
| Email Αιτούντα | `requester.email` | text |
| Γνωστός | `requester.isKnownContact` | boolean |
| Ζητ. Ημ/νία | `appointment.requestedDate` | date |
| Ζητ. Ώρα | `appointment.requestedTime` | text |
| Επιβ. Ημ/νία | `appointment.confirmedDate` | date |
| Επιβ. Ώρα | `appointment.confirmedTime` | text |
| Ρόλος | `assignedRole` | text |
| Υπεύθυνος | `assignedTo` | text |
| Εγκρίθηκε από | `approvedBy` | text |
| Ημ/νία Έγκρισης | `approvedAt` | date |
| Ημ/νία Δημιουργίας | `createdAt` | date |

### Tier 1 — Computed/Joined

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Επαφή | JOIN contacts ON requester.contactId | text |
| Pipeline Request | `pipelineRequestId` | text |

### Tier 2 (Row Repetition)

Η οντότητα Appointment **ΔΕΝ έχει arrays** που χρειάζονται expansion.

### Tier 3 (Appointment Card PDF)

```
┌─────────────────────────────────────────┐
│ ΡΑΝΤΕΒΟΥ — [status]                      │
│ [appointment.description]               │
├─────────────────────────────────────────┤
│ ΑΙΤΩΝ                                    │
│ Όνομα | Email | Γνωστός: ✅/❌          │
│ Κανάλι: telegram | Pipeline: [id]      │
├─────────────────────────────────────────┤
│ ΗΜΕΡΟΜΗΝΙΕΣ                              │
│ Ζητούμενη: DD/MM/YYYY HH:mm            │
│ Επιβεβαιωμένη: DD/MM/YYYY HH:mm        │
├─────────────────────────────────────────┤
│ ΑΝΑΘΕΣΗ                                  │
│ Ρόλος | Υπεύθυνος                       │
│ Εγκρίθηκε από | Ημ/νία                 │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [appointment.notes]                     │
└─────────────────────────────────────────┘
```

---

# §7. Στατιστικά

## Ανά Οντότητα

| Οντότητα | Πεδία Direct | Πεδία Nested | Enums | Τιμές Enum | Subcollections | Cross-Entity Refs |
|----------|-------------|--------------|-------|------------|----------------|-------------------|
| **Opportunity** | 23 | 9 (interestedIn) | 4 | 24 | 0 | 7 |
| **CRM Task** | 23 | 10 (viewing + recurrence) | 3 | 16 | 0 | 5 |
| **Communication** | 24 | 3 (AI analysis) | 5 | 25 | 0 | 5 |
| **Appointment** | 10 | 12 (source + requester + appointment) | 1 | 5 | 0 | 3 |

## Σύνολα

| Μέτρηση | Τιμή |
|---------|------|
| Οντότητες | 4 |
| Πεδία direct (σύνολο) | 80 |
| Πεδία nested (σύνολο) | 34 |
| Enums (σύνολο) | 13 |
| Τιμές enum (σύνολο) | 70 |
| Subcollections | 0 |
| Cross-entity references (σύνολο) | 20 |
| Tier 1 flat columns (σύνολο) | 58 |
| Tier 1 computed/joined (σύνολο) | 19 |
| Tier 2 expansion arrays (σύνολο) | 9 |
| **Σύνολο πεδίων (CRM group)** | **~114** |
