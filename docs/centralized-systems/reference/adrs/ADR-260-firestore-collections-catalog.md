# ADR-260: Καθολικός Κατάλογος Firestore Collections

| Field | Value |
|-------|-------|
| **ADR** | 260 |
| **Status** | ACTIVE |
| **Date** | 2026-03-24 |
| **Category** | Data & State |
| **SSoT** | `src/config/firestore-collections.ts` |

---

## 1. Σκοπός

Πλήρης καταγραφή και κατηγοριοποίηση **ΟΛΩΝ** των Firestore collections της εφαρμογής Nestor. Αποτελεί αναφορά για συζήτηση, cleanup, και αρχιτεκτονικές αποφάσεις.

---

## 2. Στατιστικά Σύνοψη

| Μετρική | Τιμή |
|---------|------|
| Top-level Collections | **97** |
| Subcollections | **25** |
| System Documents (singletons) | **18** |
| Enterprise ID Prefixes | **72+** |
| Αρχεία με read operations | **326+** |
| Αρχεία με write operations | **61+** |
| Composite Indexes | **50+** |
| Collections στο Security Rules | **40+** |

---

## 3. Πλήρης Κατάλογος Top-Level Collections (97)

### 3.1 Core Business Entities (10)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 1 | `CONTACTS` | `contacts` | — | Φυσικά πρόσωπα & εταιρείες |
| 2 | `COMPANIES` | `companies` | — | **Legacy** — backward compatibility |
| 3 | `PROJECTS` | `projects` | — | Κατασκευαστικά έργα |
| 4 | `BUILDINGS` | `buildings` | — | Κτίρια εντός projects |
| 5 | `UNITS` | `units` | — | Ακίνητα (διαμερίσματα, γραφεία, parking, αποθήκες) |
| 6 | `FLOORS` | `floors` | — | Όροφοι (IFC IfcBuildingStorey) |
| 7 | `PARKING_SPACES` | `parking_spots` | — | Θέσεις στάθμευσης |
| 8 | `STORAGE` | `storage_units` | — | Αποθηκευτικοί χώροι |
| 9 | `WORKSPACES` | `workspaces` | ADR-032 | Multi-tenancy workspaces |
| 10 | `WORKSPACE_MEMBERS` | `workspace_members` | ADR-032 | Μέλη workspace |

### 3.2 CRM & Sales (8)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 11 | `LEADS` | `leads` | — | Sales leads |
| 12 | `OPPORTUNITIES` | `opportunities` | — | Ευκαιρίες πώλησης |
| 13 | `ACTIVITIES` | `activities` | — | CRM activities (calls, meetings) |
| 14 | `TASKS` | `tasks` | — | Task management |
| 15 | `OBLIGATIONS` | `obligations` | — | Υποχρεώσεις πληρωμών |
| 16 | `OBLIGATION_TEMPLATES` | `obligationTemplates` | — | Templates υποχρεώσεων |
| 17 | `OBLIGATION_TRANSMITTALS` | `obligation_transmittals` | — | Transmittals PDFs |
| ~~18~~ | ~~`OBLIGATION_SECTIONS`~~ | ~~`obligationSections`~~ | — | **ΑΦΑΙΡΕΘΗΚΕ** (2026-04-07): Orphan collection — sections αποθηκεύονται ως nested array σε obligations |
| 18 | `ASSIGNMENT_POLICIES` | `assignment_policies` | — | Routing policies |

### 3.3 Communications & Omnichannel (5)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 20 | `COMMUNICATIONS` | `communications` | — | Ιστορικό επικοινωνιών (Telegram, email) |
| 21 | `MESSAGES` | `messages` | — | AI pipeline messages, email inbound |
| 22 | `NOTIFICATIONS` | `notifications` | — | System notifications |
| 23 | `CONVERSATIONS` | `conversations` | — | Omnichannel conversations |
| 24 | `EXTERNAL_IDENTITIES` | `external_identities` | — | Εξωτερικές ταυτότητες (Telegram ID κλπ) |

### 3.4 Relationships & Linking (4)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 25 | `RELATIONSHIPS` | `relationships` | — | Γενικές σχέσεις entities |
| 26 | `CONTACT_RELATIONSHIPS` | `contact_relationships` | ADR-252 | Contact-to-contact connections |
| 27 | `CONTACT_LINKS` | `contact_links` | ADR-032 | Links contacts → projects/buildings/units |
| 28 | `FILE_LINKS` | `file_links` | — | Links files → entities |

### 3.5 AI Pipeline & Machine Learning (7)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 29 | `AI_PIPELINE_QUEUE` | `ai_pipeline_queue` | ADR-080 | Task queue για AI processing |
| 30 | `AI_PIPELINE_AUDIT` | `ai_pipeline_audit` | ADR-080 | AI operation logs |
| 31 | `AI_CHAT_HISTORY` | `ai_chat_history` | ADR-171 | Conversation memory (20 msgs, 24h TTL) |
| 32 | `AI_AGENT_FEEDBACK` | `ai_agent_feedback` | ADR-173 | Feedback for learning |
| 33 | `AI_LEARNED_PATTERNS` | `ai_learned_patterns` | ADR-173 | Learned patterns |
| 34 | `AI_QUERY_STRATEGIES` | `ai_query_strategies` | — | Query strategy memory per collection |
| 35 | `AI_USAGE` | `ai_usage` | ADR-259A | Per-user monthly token/cost tracking |

### 3.6 Email Pipeline (1)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 36 | `EMAIL_INGESTION_QUEUE` | `email_ingestion_queue` | ADR-071 | Webhook queue pattern |

### 3.7 File & Document Management (11)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 37 | `FILES` | `files` | — | **Unified SSoT** για όλα τα αρχεία |
| 38 | `ATTACHMENTS` | `attachments` | — | Συνημμένα |
| 39 | `FILE_AUDIT_LOG` | `file_audit_log` | ADR-191 Ph.3.1 | Audit trail αρχείων |
| 40 | `FILE_SHARES` | `file_shares` | ADR-191 Ph.4.2 | Shared files |
| 41 | `FILE_COMMENTS` | `file_comments` | ADR-191 Ph.4.3 | Σχόλια σε αρχεία |
| 42 | `FILE_FOLDERS` | `file_folders` | ADR-191 Ph.4.4 | Δομή φακέλων |
| 43 | `FILE_APPROVALS` | `file_approvals` | ADR-191 Ph.3.3 | Approval workflows |
| 44 | `DOCUMENT_TEMPLATES` | `document_templates` | ADR-191 Ph.4.1 | Templates εγγράφων |
| 45 | `FILE_WEBHOOKS` | `file_webhooks` | ADR-191 Ph.5.4 | Webhook integrations |
| 46 | `FLOORPLANS` | `floorplans` | — | Κατόψεις |
| 47 | `PROJECT_FLOORPLANS` | `project_floorplans` | — | Κατόψεις ανά project |
| 48 | `FLOOR_FLOORPLANS` | `floor_floorplans` | — | **Legacy** — PDF κατόψεις ανά όροφο |

### 3.8 CAD & Technical Drawings (5)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 49 | `CAD_FILES` | `cadFiles` | — | **DEPRECATED** — dual-write ενεργό, χρήση FILES |
| 50 | `CAD_LAYERS` | `cadLayers` | — | CAD layer metadata |
| 51 | `CAD_SESSIONS` | `cadSessions` | — | CAD editing sessions |
| 52 | `DXF_OVERLAY_LEVELS` | `dxfOverlayLevels` | — | DXF overlay levels |
| 53 | `DXF_VIEWER_LEVELS` | `dxfViewerLevels` | — | DXF viewer configurations |

### 3.9 Accounting Subapp (15)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 54 | `ACCOUNTING_JOURNAL_ENTRIES` | `accounting_journal_entries` | ACC-001 | Διπλογραφικές εγγραφές |
| 55 | `ACCOUNTING_INVOICES` | `accounting_invoices` | ACC-002 | Τιμολόγια λογιστικής |
| 56 | `ACCOUNTING_INVOICE_COUNTERS` | `accounting_invoice_counters` | ACC-002 | Αρίθμηση τιμολογίων |
| 57 | `ACCOUNTING_SETTINGS` | `accounting_settings` | ACC-003 | Ρυθμίσεις λογιστικής |
| 58 | `ACCOUNTING_BANK_TRANSACTIONS` | `accounting_bank_transactions` | ACC-004 | Τραπεζικές κινήσεις |
| 59 | `ACCOUNTING_BANK_ACCOUNTS` | `accounting_bank_accounts` | ACC-004 | Τραπεζικοί λογαριασμοί |
| 60 | `ACCOUNTING_FIXED_ASSETS` | `accounting_fixed_assets` | ACC-005 | Πάγια στοιχεία |
| 61 | `ACCOUNTING_DEPRECIATION_RECORDS` | `accounting_depreciation_records` | ACC-005 | Αποσβέσεις |
| 62 | `ACCOUNTING_EFKA_PAYMENTS` | `accounting_efka_payments` | ACC-006 | Πληρωμές ΕΦΚΑ |
| 63 | `ACCOUNTING_EFKA_CONFIG` | `accounting_efka_config` | ACC-006 | Ρυθμίσεις ΕΦΚΑ |
| 64 | `ACCOUNTING_EXPENSE_DOCUMENTS` | `accounting_expense_documents` | ACC-007 | Παραστατικά δαπανών |
| 65 | `ACCOUNTING_IMPORT_BATCHES` | `accounting_import_batches` | ACC-008 | Import batches |
| 66 | `ACCOUNTING_TAX_INSTALLMENTS` | `accounting_tax_installments` | ACC-009 | Δόσεις φόρων |
| 67 | `ACCOUNTING_APY_CERTIFICATES` | `accounting_apy_certificates` | ACC-010 | ΑΠΥ certificates |
| 68 | `ACCOUNTING_CUSTOM_CATEGORIES` | `accounting_custom_categories` | — | Custom κατηγορίες |

### 3.10 Construction & BOQ (7)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 69 | `CONSTRUCTION_PHASES` | `construction_phases` | ADR-034 | Φάσεις κατασκευής (Gantt) |
| 70 | `CONSTRUCTION_TASKS` | `construction_tasks` | ADR-034 | Tasks ανά φάση |
| 71 | `BUILDING_MILESTONES` | `building_milestones` | — | Timeline milestones |
| 72 | `BOQ_ITEMS` | `boq_items` | ADR-175 | Επιμετρήσεις (ΑΤΟΕ) |
| 73 | `BOQ_CATEGORIES` | `boq_categories` | ADR-175 | Κατηγορίες ΑΤΟΕ |
| 74 | `BOQ_PRICE_LISTS` | `boq_price_lists` | ADR-175 | Τιμοκατάλογοι |
| 75 | `BOQ_TEMPLATES` | `boq_templates` | ADR-175 | Templates επιμετρήσεων |

### 3.11 Labor Compliance & Attendance (4)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 76 | `ATTENDANCE_EVENTS` | `attendance_events` | ADR-090 | Check-in/out — **IMMUTABLE** (write-once) |
| 77 | `ATTENDANCE_QR_TOKENS` | `attendance_qr_tokens` | ADR-170 | QR tokens (server-only) |
| 78 | `EMPLOYMENT_RECORDS` | `employment_records` | ADR-090 | Εργασιακά αρχεία |
| 79 | `DIGITAL_WORK_CARDS` | `digital_work_cards` | ADR-090 | Ψηφιακές κάρτες εργασίας |

### 3.12 Financial & Legal (6)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 80 | `INVOICES` | `invoices` | — | Τιμολόγια (CRM module) |
| 81 | `PAYMENTS` | `payments` | — | Πληρωμές |
| 82 | `TRANSACTIONS` | `transactions` | — | Οικονομικές κινήσεις |
| 83 | `CHEQUES` | `cheques` | ADR-234 Ph.3 | Μητρώο επιταγών |
| 84 | `LEGAL_CONTRACTS` | `legal_contracts` | ADR-230 | Συμβάσεις |
| 85 | `BROKERAGE_AGREEMENTS` | `brokerage_agreements` | ADR-230 | Συμφωνίες μεσιτείας |
| 86 | `COMMISSION_RECORDS` | `commission_records` | ADR-230 | Προμήθειες |
| 87 | `OWNERSHIP_TABLES` | `ownership_tables` | ADR-235 | Πίνακας χιλιοστών |

### 3.13 User Management & Security (10)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 88 | `USERS` | `users` | — | Χρήστες |
| 89 | `TEAMS` | `teams` | — | Ομάδες |
| 90 | `ROLES` | `roles` | — | Ρόλοι |
| 91 | `PERMISSIONS` | `permissions` | — | Δικαιώματα |
| 92 | `SESSIONS` | `sessions` | — | Sessions |
| 93 | `TOKENS` | `tokens` | — | Auth tokens |
| 94 | `SECURITY_ROLES` | `security_roles` | — | Security role definitions |
| 95 | `EMAIL_DOMAIN_POLICIES` | `email_domain_policies` | — | Email domain policies |
| 96 | `COUNTRY_SECURITY_POLICIES` | `country_security_policies` | — | Country security |
| 97 | `USER_NOTIFICATION_SETTINGS` | `user_notification_settings` | — | Ρυθμίσεις ειδοποιήσεων |
| 98 | `USER_2FA_SETTINGS` | `user_2fa_settings` | — | 2FA settings |
| 99 | `USER_PREFERENCES` | `user_preferences` | — | Προτιμήσεις χρήστη |

### 3.14 System & Configuration (5)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 100 | `SYSTEM` | `system` | — | System-level documents |
| 101 | `CONFIG` | `config` | — | Configuration |
| 102 | `SETTINGS` | `settings` | — | Global settings (email routing, integrations) |
| 103 | `NAVIGATION` | `navigation_companies` | — | Navigation config |
| 104 | `COUNTERS` | `counters` | ADR-017 | Sequential ID generation |

### 3.15 Analytics & Audit (7)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 105 | `ANALYTICS` | `analytics` | — | Analytics data |
| 106 | `METRICS` | `metrics` | — | Metrics tracking |
| 107 | `EVENTS` | `events` | — | Event logging |
| 108 | `LOGS` | `logs` | — | General logs |
| 109 | `AUDIT` | `audit` | — | Audit trail |
| 110 | `ERRORS` | `errors` | — | Error logging |
| 111 | `SYSTEM_AUDIT_LOGS` | `system_audit_logs` | — | Webhook/system audit |
| 112 | `CLOUD_FUNCTION_AUDIT_LOG` | `audit_log` | — | Cloud Function audit log (orphan cleanup, system events) |
| 113 | `ENTITY_AUDIT_TRAIL` | `entity_audit_trail` | ADR-195 | Per-entity change history |

### 3.16 Forms, Surveys & Search (4)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 113 | `FORMS` | `forms` | — | Form definitions |
| 114 | `SUBMISSIONS` | `submissions` | — | Form submissions |
| 115 | `SURVEYS` | `surveys` | — | Surveys |
| 116 | `SEARCH_DOCUMENTS` | `searchDocuments` | — | Global search index |

### 3.17 Bots & Voice (4)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 117 | `BOT_CONFIGS` | `bot_configs` | — | Bot configurations (Telegram) |
| 118 | `BOT_CATALOGS` | `bot_catalogs` | — | Bot command catalogs |
| 119 | `BOT_INTENTS` | `bot_intents` | — | Bot intent definitions |
| 120 | `VOICE_COMMANDS` | `voice_commands` | ADR-164 | Voice AI pipeline |

### 3.18 Calendar & Scheduling (4)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 121 | `CALENDAR` | `calendar` | — | Calendar events |
| 122 | `APPOINTMENTS` | `appointments` | — | Ραντεβού |
| 123 | `BOOKINGS` | `bookings` | — | Κρατήσεις |
| 124 | `BOOKING_SESSIONS` | `booking_sessions` | — | Telegram booking sessions |

### 3.19 Inventory & Assets (2)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 124 | `INVENTORY` | `inventory` | — | Αποθεματικά |
| 125 | `ASSETS` | `assets` | — | Περιουσιακά στοιχεία |

### 3.20 Localization (2)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 126 | `TRANSLATIONS` | `translations` | — | Μεταφράσεις |
| 127 | `LOCALES` | `locales` | — | Locale definitions |

### 3.21 Legacy Collections (4)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 128 | `LAYERS` | `layers` | — | **Legacy** — backward compatibility |
| 129 | `LAYER_GROUPS` | `layerGroups` | — | **Legacy** |
| 130 | `PROPERTY_LAYERS` | `property-layers` | — | **Legacy** |
| 131 | `LAYER_EVENTS` | `layer-events` | — | **Legacy** |

### 3.22 EU Professional Classification (2)

| # | COLLECTIONS Key | Firestore Name | ADR | Σημειώσεις |
|---|----------------|----------------|-----|------------|
| 132 | `ESCO_CACHE` | `system/esco_cache/occupations` | ADR-034 | ~3,039 EU ESCO επαγγέλματα (EL+EN) |
| 133 | `ESCO_SKILLS_CACHE` | `system/esco_cache/skills` | ADR-132 | ~13,485 EU ESCO δεξιότητες (EL+EN) |

---

## 4. Subcollections (25)

### 4.1 Contact Subcollections

| Subcollection Key | Name | Path Pattern |
|-------------------|------|-------------|
| `CONTACT_ACTIVITIES` | `activities` | `contacts/{id}/activities` |
| `CONTACT_COMMUNICATIONS` | `communications` | `contacts/{id}/communications` |
| `CONTACT_NOTES` | `notes` | `contacts/{id}/notes` |

### 4.2 Project Subcollections

| Subcollection Key | Name | Path Pattern |
|-------------------|------|-------------|
| `PROJECT_TASKS` | `tasks` | `projects/{id}/tasks` |
| `PROJECT_DOCUMENTS` | `documents` | `projects/{id}/documents` |
| `PROJECT_TIMELINE` | `timeline` | `projects/{id}/timeline` |

### 4.3 Building Subcollections

| Subcollection Key | Name | Path Pattern |
|-------------------|------|-------------|
| `BUILDING_FLOORS` | `floors` | `buildings/{id}/floors` |
| `BUILDING_UNITS` | `units` | `buildings/{id}/units` |
| `BUILDING_MAINTENANCE` | `maintenance` | `buildings/{id}/maintenance` |

### 4.4 Unit Subcollections

| Subcollection Key | Name | Path Pattern |
|-------------------|------|-------------|
| `UNIT_PHOTOS` | `photos` | `units/{id}/photos` |
| `UNIT_DOCUMENTS` | `documents` | `units/{id}/documents` |
| `UNIT_HISTORY` | `history` | `units/{id}/history` |
| `UNIT_PAYMENT_PLANS` | `payment_plans` | `units/{id}/payment_plans` |
| `UNIT_PAYMENTS` | `payments` | `units/{id}/payments` |

### 4.5 User Subcollections

| Subcollection Key | Name | Path Pattern |
|-------------------|------|-------------|
| `USER_PREFERENCES` | `preferences` | `users/{uid}/preferences` |
| `USER_SESSIONS` | `sessions` | `users/{uid}/sessions` |
| `USER_NOTIFICATIONS` | `notifications` | `users/{uid}/notifications` |

### 4.6 RBAC Subcollections (Company/Project/Unit)

| Subcollection Key | Name | Path Pattern |
|-------------------|------|-------------|
| `COMPANY_PROJECTS` | `projects` | `companies/{id}/projects` |
| `COMPANY_UNITS` | `units` | `companies/{id}/units` |
| `PROJECT_MEMBERS` | `members` | `companies/{id}/projects/{id}/members` |
| `COMPANY_MEMBERS` | `members` | `companies/{id}/members` |
| `UNIT_GRANTS` | `grants` | `companies/{id}/units/{id}/grants` |
| `COMPANY_AUDIT_LOGS` | `audit_logs` | `companies/{id}/audit_logs` |

### 4.7 Contact Banking Subcollections

| Subcollection Key | Name | Path Pattern |
|-------------------|------|-------------|
| `BANK_ACCOUNTS` | `bankAccounts` | `contacts/{id}/bankAccounts` |

### 4.8 File & Ownership Subcollections

| Subcollection Key | Name | Path Pattern |
|-------------------|------|-------------|
| `FILE_VERSIONS` | `versions` | `files/{id}/versions` |
| `OWNERSHIP_REVISIONS` | `revisions` | `ownership_tables/{id}/revisions` |

---

## 5. System Documents — Singletons (18)

| Key | Collection | Document ID | ADR | Σκοπός |
|-----|-----------|-------------|-----|--------|
| `COMPANY_CONFIG` | system | `company` | — | Company-level config |
| `APP_SETTINGS` | system | `app_settings` | — | App-wide settings |
| `FEATURE_FLAGS` | system | `feature_flags` | — | Feature flags |
| `MAINTENANCE_MODE` | system | `maintenance` | — | Maintenance status |
| `API_LIMITS` | system | `api_limits` | — | Rate limiting config |
| `TENANT_CONFIG` | system | `tenant` | — | Multi-tenant config |
| `SYSTEM_SETTINGS` | system | `settings` | ADR-245B | Global config, email routing |
| `SUPER_ADMIN_REGISTRY` | settings | `super_admin_registry` | ADR-145 | Super admin registry |
| `LABOR_COMPLIANCE_SETTINGS` | settings | `labor_compliance` | ADR-090 | IKA/EFKA rates |
| `EURIBOR_RATES` | settings | `euribor_rates` | ADR-234 | ECB rates (24h TTL) |
| `BANK_SPREADS` | settings | `bank_spreads` | ADR-234 | Bank spreads |
| `AI_TOOL_ANALYTICS` | settings | `ai_tool_analytics` | ADR-245B | AI usage analytics |
| `ACCT_COMPANY_PROFILE` | accounting_settings | `company_profile` | ADR-245B | Στοιχεία εταιρείας |
| `ACCT_PARTNERS` | accounting_settings | `partners` | ADR-245B | Εταίροι |
| `ACCT_MEMBERS` | accounting_settings | `members` | ADR-245B | Μέλη |
| `ACCT_SHAREHOLDERS` | accounting_settings | `shareholders` | ADR-245B | Μέτοχοι |
| `ACCT_SERVICE_PRESETS` | accounting_settings | `service_presets` | ADR-245B | Presets υπηρεσιών |
| `ACCT_EFKA_USER_CONFIG` | accounting_efka_config | `user_config` | ADR-245B | EFKA user config |

---

## 6. Σύγκριση Κώδικα vs Live Βάση (2026-03-24)

### 6.1 Collections στη Live Firestore (9 ενεργές)

| # | Collection (Live) | Documents | Αντιστοιχία Κώδικα | Status |
|---|-------------------|-----------|---------------------|--------|
| 1 | `accounting_invoice_counters` | 1 | `COLLECTIONS.ACCOUNTING_INVOICE_COUNTERS` | OK |
| 2 | `accounting_settings` | 1 | `COLLECTIONS.ACCOUNTING_SETTINGS` | OK |
| 3 | `config` | 5 | `COLLECTIONS.CONFIG` | OK |
| ~~4~~ | ~~`obligation-sections`~~ | ~~2~~ | — | **ΑΦΑΙΡΕΘΗΚΕ** (2026-04-07): Orphan — sections nested σε obligations |
| 5 | `obligations` | 8 | `COLLECTIONS.OBLIGATIONS` | OK |
| 6 | `settings` | 3 | `COLLECTIONS.SETTINGS` | OK |
| 7 | `system` | 1 | `COLLECTIONS.SYSTEM` | OK |
| 8 | `user_2fa_settings` | 1 | `COLLECTIONS.USER_2FA_SETTINGS` | OK |
| 9 | `users` | 2 | `COLLECTIONS.USERS` | OK |

### 6.2 ~~ΚΡΙΣΙΜΗ ΑΣΥΝΕΠΕΙΑ~~: `obligation-sections` — ✅ RESOLVED (2026-04-07)

**Λύση**: `OBLIGATION_SECTIONS` αφαιρέθηκε εντελώς από `firestore-collections.ts` και migration script. Τα sections αποθηκεύονται ως nested array μέσα στα `obligations` documents — δεν χρειάζεται standalone collection. Τα orphan data στο Firestore θα διαγραφούν χειροκίνητα.

### 6.3 Γιατί μόνο 9 collections;

Η εφαρμογή είναι σε **development stage**. Οι υπόλοιπες 124+ collections ορίζονται στον κώδικα αλλά δημιουργούνται **lazily** — μόνο κατά την πρώτη εγγραφή (Firestore auto-create on first write).

---

## 7. Write Operations Analysis (205+ operations σε 118+ αρχεία)

### 7.1 Ανάλυση ανά Τύπο Operation

| Operation | Count | Αρχεία | Κίνδυνος |
|-----------|-------|--------|----------|
| `setDoc()` | ~57 | 34 | LOW-MEDIUM |
| `updateDoc()` | ~73 | 39 | MEDIUM |
| `deleteDoc()` | ~16 | 13 | MEDIUM-HIGH |
| `writeBatch()` | ~46 | 24 | HIGH |
| `runTransaction()` | ~13 | 8 | CRITICAL |
| **ΣΥΝΟΛΟ** | **~205** | **118** | — |

### 7.2 Write Files ανά Collection (Top Collections)

| Collection | setDoc | updateDoc | deleteDoc | batch | transaction | Κύρια Αρχεία |
|-----------|--------|-----------|-----------|-------|-------------|-------------|
| `contacts` | 1 | 1 | - | 1 | - | `contacts.service.ts`, `telegram/crm/store.ts` |
| `messages` | 3 | 2 | 1 | 1 | - | `communications*.service.ts`, `messageRouter.ts`, `orchestrator.ts`, webhooks |
| `files` | 2 | 10 | - | 2 | - | `file-record.service.ts`, `FileManagerPageContent.tsx`, `useBatchFileOperations.ts` |
| `users` | 3 | 2 | - | 1 | - | `AuthContext.tsx`, `ensure-user-profile/route.ts`, `auth/session/route.ts` |
| `units` | 1 | 2 | - | 2 | - | `units/route.ts`, `units/[id]/route.ts` |
| `ai_pipeline_queue` | 1 | 1 | - | - | 3 | `pipeline-queue-service.ts` |
| `email_ingestion_queue` | 1 | 1 | - | - | 3 | `email-queue-service.ts`, `mailgun/inbound/route.ts` |
| `payments` | 1 | 1 | - | - | 6 | `payment-plan.service.ts` |
| `obligations` | 2 | 3 | - | - | - | `InMemoryObligationsRepository.ts` |
| `notifications` | 1 | 3 | 1 | 1 | - | `notificationService.ts`, `notifications/*.ts` |

### 7.3 Critical Transaction Points

| Αρχείο | Collection | Transactions | Σκοπός |
|--------|-----------|-------------|--------|
| `pipeline-queue-service.ts` | `ai_pipeline_queue` | 3 | Deduplication — CRITICAL |
| `email-queue-service.ts` | `email_ingestion_queue` | 3 | Queue claiming — CRITICAL |
| `payment-plan.service.ts` | `payments` | 6 | Financial recording — HIGH |
| `project-code.service.ts` | `counters` | 4 | Sequential ID — MEDIUM |
| `version-check.ts` | (dynamic) | 1 | Optimistic locking — HIGH |
| `chat-history-service.ts` | `ai_chat_history` | 1 | Atomic upsert — MEDIUM |
| `EnterpriseTwoFactorService.ts` | `user_2fa_settings` | 1 | MFA enrollment — MEDIUM |
| `ownership-table-service.ts` | `ownership_tables` | 2 | Ownership sync — MEDIUM |
| `firestore-accounting-repository.ts` | accounting collections | 1 | Ledger operations — MEDIUM |

### 7.4 Collections Read-Only (Χωρίς Write Operations)

Οι παρακάτω ορίζονται στον κώδικα αλλά **κανένα write operation δεν βρέθηκε**:

`leads`, `activities`, `obligationTemplates`, `obligation_transmittals`, `analytics`, `metrics`, `teams`, `roles`, `permissions`, `relationships`, `forms`, `submissions`, `surveys`, `attachments`, `cadLayers`, `cadSessions`, `project_floorplans`, `calendar`, `bookings`, `logs`, `audit`, `inventory`, `assets`, `invoices`, `transactions`, `tokens`, `security_roles`, `email_domain_policies`, `country_security_policies`, `translations`, `locales`, `bot_configs`, `bot_catalogs`, `bot_intents`, `construction_tasks`, `digital_work_cards`, `boq_categories`, `boq_price_lists`, `boq_templates`, `cheques`, `legal_contracts`, `brokerage_agreements`, `commission_records`, `floor_floorplans`, `layer-events`, `layerGroups`

> Αυτές χρησιμοποιούνται μόνο για reads, ή είναι σε σχεδιαστική φάση (spec exists, implementation pending).

---

## 8. Top 20 Collections κατά Χρήση (αναφορές σε κώδικα)

| # | Collection | Αναφορές | Κύρια χρήση |
|---|-----------|----------|-------------|
| 1 | UNITS | 133 | Property/unit CRUD |
| 2 | PROJECTS | 102 | Project management |
| 3 | CONTACTS | 95 | Contact CRM |
| 4 | BUILDINGS | 94 | Building data |
| 5 | FILES | 55 | File management |
| 6 | FLOORS | 46 | Floor data |
| 7 | PARKING_SPACES | 40 | Parking |
| 8 | MESSAGES | 40 | Email/comms |
| 9 | STORAGE | 35 | Storage units |
| 10 | COMPANIES | 25 | Legacy entities |
| 11 | SYSTEM | 24 | System config |
| 12 | NAVIGATION | 24 | Nav config |
| 13 | CONTACT_LINKS | 24 | Entity linking |
| 14 | USERS | 18 | User management |
| 15 | CAD_FILES | 17 | Legacy CAD |
| 16 | APPOINTMENTS | 16 | Calendar |
| 17 | AI_PIPELINE_QUEUE | 16 | AI processing |
| 18 | CONVERSATIONS | 15 | Omnichannel |
| 19 | CONSTRUCTION_PHASES | 14 | Construction |
| 20 | TASKS | 13 | Task management |

---

## 9. Write Patterns (Πώς γράφονται τα documents)

### Pattern 1: Enterprise ID + setDoc (Standard)
```typescript
const id = generateContactId(); // cont_uuid
await setDoc(doc(db, COLLECTIONS.CONTACTS, id), { ...data });
```

### Pattern 2: Atomic Transaction (Deduplication)
```typescript
await runTransaction(db, async (tx) => {
  const existing = await tx.get(query);
  if (!existing.empty) return existing.docs[0].id;
  tx.set(docRef, newData);
});
```

### Pattern 3: Batch Write (Multi-document)
```typescript
const batch = writeBatch(db);
batch.set(docRef1, data1);
batch.update(docRef2, data2);
await batch.commit(); // max 500 operations
```

### Pattern 4: Immutable Append-Only (Compliance)
```typescript
// attendance_events — write-once, never update/delete
await setDoc(doc(db, COLLECTIONS.ATTENDANCE_EVENTS, eventId), {
  ...event, createdAt: serverTimestamp()
});
```

---

## 10. Ζητήματα & Συστάσεις

### 10.1 Εντοπισμένα Ζητήματα

| # | Σοβαρότητα | Ζήτημα | Τοποθεσία |
|---|-----------|--------|-----------|
| 1 | **HIGH** | Ασυνέπεια ονόματος: `obligation-sections` (live) vs `obligationSections` (κώδικας) | `COLLECTIONS.OBLIGATION_SECTIONS`, live Firestore |
| 2 | Low | Hardcoded `'dxf_files'` string αντί `COLLECTIONS.CAD_FILES` | `src/database/migrations/003_*.ts` (line 325) |
| ~~3~~ | ~~Low~~ ✅ | ~~Cloud Functions χρησιμοποιούν τοπικά COLLECTIONS~~ — **FIXED 2026-04-09**: `functions/src/config/firestore-collections.ts` + `functions/src/config/enterprise-id.ts` created. All Cloud Functions now import centralized COLLECTIONS. | `functions/src/config/` |
| 4 | Medium | `CAD_FILES` deprecated αλλά dual-write ακόμα ενεργό | Πολλαπλά αρχεία |
| 5 | Info | 4 legacy layer collections χωρίς σχέδιο αποκομμάτωσης | `LAYERS`, `LAYER_GROUPS`, `PROPERTY_LAYERS`, `LAYER_EVENTS` |
| 6 | Info | 47 collections ορισμένες χωρίς write operations (read-only ή pending impl) | Βλ. §7.4 |
| 7 | ~~MEDIUM~~ ✅ | ~~`system_audit_logs` χρησιμοποιεί `.add()` (auto-ID)~~ — **FIXED 2026-03-24**: `.doc(generateAuditId()).set()` | `src/lib/auth/audit.ts` |
| 8 | ~~MEDIUM~~ ✅ | ~~`audit_logs` subcollection χρησιμοποιεί `.add()` (auto-ID)~~ — **FIXED 2026-03-24**: `.doc(generateAuditId()).set()` | `src/lib/auth/audit.ts` |
| 9 | ~~HIGH~~ ✅ | ~~`employment_records` χρησιμοποιεί `collRef.doc()` (auto-ID)~~ — **FIXED 2026-03-24**: `collRef.doc(generateEmploymentRecordId())` | `src/app/api/ika/employment-records/route.ts` |

### 10.2 Συστάσεις

1. ~~**ΑΜΕΣΟ — obligation-sections fix**~~ ✅ **RESOLVED 2026-04-07**: Collection αφαιρέθηκε — sections αποθηκεύονται ως nested array σε obligations. Orphan data διαγράφονται χειροκίνητα.
2. ~~**ΑΜΕΣΟ — Enterprise ID violations fix**~~ ✅ **FIXED 2026-03-24**: Όλα τα enterprise ID violations διορθώθηκαν (11 call sites σε 9 αρχεία). Νέοι generators: `generateEmploymentRecordId()` (`emprec`), `generateAppointmentId()` (`appt`), `generateRouteConfigId()` (`rcfg`)
3. **Deprecation Plan**: Ορισμός χρονοδιαγράμματος sunset για `CAD_FILES` → `FILES`
4. **Legacy Cleanup**: Αξιολόγηση αν τα 4 layer collections χρησιμοποιούνται ακόμα
5. ~~**Cloud Functions Sync**: Import COLLECTIONS constant στα Cloud Functions~~ ✅ **DONE 2026-04-09**: `functions/src/config/firestore-collections.ts` created
6. **Dead Collection Cleanup**: Αξιολόγηση αν οι 47 read-only collections χρειάζονται πραγματικά
7. **Index Review**: Ποιες composite indexes δεν χρησιμοποιούνται πλέον;

---

## 11. Enterprise ID Compliance Audit (ADR-017)

### 11.1 Επισκόπηση

| Μετρική | Τιμή |
|---------|------|
| Συνολικοί generators στο `enterprise-id.service.ts` | **73+** |
| Collections με write operations | **~55** |
| COMPLIANT (enterprise ID generator) | **~55** (100%) |
| EXEMPT (Firebase UID / Singleton / Deterministic) | **~11** |
| VIOLATION (παραβίαση ADR-017) | **0** ✅ (fixed 2026-03-24) |
| `addDoc()` / `.add()` χρήσεις σε Firestore | **0** |

**SSoT**: `src/services/enterprise-id.service.ts` (1460+ γραμμές, 72+ prefixed generators)
**Pattern**: `{prefix}_{UUIDv4}` via `crypto.randomUUID()` + collision detection + retry

---

### 11.2 Πλήρης Πίνακας Συμμόρφωσης ανά Collection

#### COMPLIANT — Χρησιμοποιούν Enterprise ID Generator

| # | Collection | Generator | Prefix | Αρχείο που γράφει |
|---|-----------|-----------|--------|-------------------|
| 1 | `contacts` | `generateContactId()` | `cont` | `contacts.service.ts` |
| 2 | `companies` | `generateCompanyId()` | `comp` | `admin/bootstrap-company/route.ts` |
| 3 | `projects` | `generateProjectId()` | `proj` | `projects/list/route.ts` |
| 4 | `buildings` | `generateBuildingId()` | `bldg` | `buildings/route.ts` |
| 5 | `units` | `generateUnitId()` | `unit` | `units/route.ts` |
| 6 | `floors` | `generateFloorId()` | `flr` | `admin/seed-floors/route.ts` |
| 7 | `messages` | `generateMessageId()` | `msg` | `communications-client.service.ts`, `messageRouter.ts`, `orchestrator.ts` |
| 8 | `notifications` | `generateNotificationId()` | `notif` | `notificationService.ts`, `calendar/reminders/route.ts` |
| 9 | `opportunities` | `generateOpportunityId()` | `opp` | `opportunities.service.ts` |
| 10 | `tasks` | `generateTaskId()` | `task` | `TasksRepository.ts` |
| 11 | `obligations` | `generateObligationId()` | `obl` | `InMemoryObligationsRepository.ts` |
| 12 | `sessions` | `generateSessionId()` | `sess` | `EnterpriseSessionService.ts` |
| 13 | `files` | `generateFileId()` | `file` | `file-record.service.ts` |
| 14 | `file_audit_log` | `generateAuditId()` | `audit` | `file-audit.service.ts` |
| 15 | `file_shares` | `generateShareId()` | `share` | `file-share.service.ts` |
| 16 | `file_comments` | `generateCommentId()` | `cmt` | `file-comment.service.ts` |
| 17 | `file_folders` | `generateFolderId()` | `fldr` | `file-folder.service.ts` |
| 18 | `file_approvals` | `generateApprovalId()` | `appr` | `file-approval.service.ts` |
| 19 | `document_templates` | `generateTemplateId()` | `tpl` | `document-template.service.ts` |
| 20 | `file_webhooks` | `generateWebhookId()` | `whk` | `files/webhook/route.ts` |
| 21 | `contact_relationships` | `generateRelationshipId()` | `rel` | `FirestoreRelationshipAdapter.ts` |
| 22 | `contact_links` | enterprise ID | — | `association.service.ts` |
| 23 | `file_links` | enterprise ID | — | `association.service.ts` |
| 24 | `navigation_companies` | `generateNavigationId()` | `nav` | `navigation-companies.service.ts` |
| 25 | `workspaces` | `generateWorkspaceId()` | `ws` | `admin/bootstrap-company/route.ts` |
| 26 | `dxfOverlayLevels` | `generateOverlayId()` | `ovrl` | `overlay-store.tsx` |
| 27 | `dxfViewerLevels` | `generateLevelId()` | `lvl` | `LevelsSystem.tsx` |
| 28 | `cadFiles` | `generateFileId()` | `file` | `dxf-firestore.service.ts` (dual-write) |
| 29 | `floorplans` | enterprise ID | — | `FloorplanService.ts`, `migrations/003_*.ts` |
| 30 | `parking_spots` | `generateParkingId()` | `park` | `admin/seed-parking/route.ts` |
| 31 | `construction_phases` | `generateConstructionPhaseId()` | `cphase` | `construction-phases/route.ts` |
| 32 | `building_milestones` | `generateMilestoneId()` | `mile` | `milestones/route.ts` |
| 33 | `attendance_events` | `generateAttendanceEventId()` | `attev` | `attendance/qr/validate/route.ts` |
| 34 | `attendance_qr_tokens` | `generateAttendanceQrTokenId()` | `qrtok` | `attendance/qr/generate/route.ts` |
| 35 | `ai_pipeline_queue` | `generatePipelineQueueId()` | `pq` | `pipeline-queue-service.ts` |
| 36 | `ai_pipeline_audit` | `generatePipelineAuditId()` | `paud` | `pipeline-queue-service.ts` |
| 37 | `ai_agent_feedback` | `generateFeedbackId()` | `fb` | `feedback-service.ts` |
| 38 | `ai_learned_patterns` | `generateLearnedPatternId()` | `lp` | `learning-service.ts` |
| 39 | `voice_commands` | `generateVoiceCommandId()` | `vcmd` | `voice/command/route.ts` |
| 40 | `boq_items` | `generateBoqItemId()` | `boq` | `boq-repository.ts` |
| 41 | `ownership_tables` | enterprise ID | — | `ownership-table-service.ts` |
| 42 | `entity_audit_trail` | `generateEntityAuditId()` | `eaud` | `cascade-propagation.service.ts` |
| 43 | `assignment_policies` | enterprise ID | — | `AssignmentPolicyRepository.ts` |
| 44 | `errors` | `generateErrorId()` | `err` | `error-report/route.ts` |
| 45 | `email_ingestion_queue` | enterprise ID | — | `email-queue-service.ts` |
| 46 | `searchDocuments` | enterprise ID | — | `search-backfill/route.ts` |
| 47 | `counters` | deterministic key | — | `enterprise-id.service.ts`, `project-code.service.ts` |
| 48 | `two_factor_enrollments` | enterprise ID | — | `EnterpriseTwoFactorService.ts` |

#### COMPLIANT — Accounting Subapp (10 dedicated generators)

| # | Collection | Generator | Prefix |
|---|-----------|-----------|--------|
| 49 | `accounting_journal_entries` | `generateJournalEntryId()` | `je` |
| 50 | `accounting_invoices` | `generateInvoiceAccId()` | `inv` |
| 51 | `accounting_bank_transactions` | `generateBankTransactionId()` | `btxn` |
| 52 | `accounting_fixed_assets` | `generateFixedAssetId()` | `fxa` |
| 53 | `accounting_depreciation_records` | `generateDepreciationId()` | `depr` |
| 54 | `accounting_efka_payments` | `generateEfkaPaymentId()` | `efka` |
| 55 | `accounting_expense_documents` | `generateExpenseDocId()` | `exdoc` |
| 56 | `accounting_import_batches` | `generateImportBatchId()` | `batch` |
| 57 | `accounting_apy_certificates` | `generateApyCertificateId()` | `apy` |
| 58 | `accounting_custom_categories` | `generateCustomCategoryId()` | `custcat` |

#### EXEMPT — Δεν χρειάζονται Enterprise ID (by design)

| # | Collection | ID Pattern | Λόγος Εξαίρεσης |
|---|-----------|-----------|-----------------|
| 1 | `users` | Firebase Auth UID (`user.uid`) | Ταυτότητα Auth — σωστό pattern |
| 2 | `system` | Fixed keys (`'company'`, `'settings'`) | Singleton documents — σχεδιασμένο |
| 3 | `settings` | Fixed keys (`'super_admin_registry'`) | Singleton documents — σχεδιασμένο |
| 4 | `config` | Fixed keys | Singleton documents — σχεδιασμένο |
| 5 | `ai_chat_history` | Deterministic `${channel}_${senderId}` | ADR-171 — fast lookup by design |
| 6 | `conversations` | SHA-256 hash `conv_{channel}_{hash}` | ADR-031 — deterministic deduplication |
| 7 | `ai_usage` | Composite `${userId}_${yearMonth}` | ADR-259A — per-user monthly aggregation |
| 8 | `accounting_settings` | Fixed keys (`'company_profile'`) | Singleton documents |
| 9 | `accounting_invoice_counters` | Fixed keys | Sequential counter documents |
| 10 | `accounting_efka_config` | Fixed key (`'user_config'`) | Singleton config |
| 11 | `external_identities` | Deterministic `${channel}_${externalId}` | ADR-031 — deduplication |

#### ~~VIOLATION~~ ✅ ALL FIXED (2026-03-24)

Όλες οι παραβάσεις enterprise ID διορθώθηκαν. **9 call sites** σε **7 αρχεία** αλλάχθηκαν από `.add()` / `.doc()` → `.doc(enterpriseId).set()`.

| # | Collection | Αρχείο | Generator | Status |
|---|-----------|--------|-----------|--------|
| 1 | `employment_records` | `employment-records/route.ts` | `generateEmploymentRecordId()` (NEW: `emprec`) | ✅ FIXED |
| 2 | `system_audit_logs` | `auth/audit.ts` | `generateAuditId()` (`audit`) | ✅ FIXED |
| 3 | `audit_logs` (subcol) | `auth/audit.ts` | `generateAuditId()` (`audit`) | ✅ FIXED |
| 4 | `tasks` | `communications.service.ts` | `generateTaskId()` (`task`) | ✅ FIXED |
| 5 | `appointments` | `uc-001-appointment/appointment-module.ts` | `generateAppointmentId()` (NEW: `appt`) | ✅ FIXED |
| 6 | `ai_pipeline_audit` | `uc-003-property-search/property-search-module.ts` | `generatePipelineAuditId()` (`paud`) | ✅ FIXED |
| 7 | `ai_pipeline_audit` | `uc-004-complaint/complaint-module.ts` | `generatePipelineAuditId()` (`paud`) | ✅ FIXED |
| 8 | `ai_pipeline_audit` | `uc-005-general-inquiry/general-inquiry-module.ts` | `generatePipelineAuditId()` (`paud`) | ✅ FIXED |
| 9 | `ai_pipeline_audit` | `uc-006-document-request/document-request-module.ts` | `generatePipelineAuditId()` (`paud`) | ✅ FIXED |
| 10 | `contacts` (import) | `contacts.service.ts` | `generateContactId()` (`cont`) | ✅ FIXED |
| 11 | `config` (route) | `EnterpriseRouteConfigService.ts` | `generateRouteConfigId()` (NEW: `rcfg`) | ✅ FIXED |

---

### 11.3 Collections χωρίς Write Operations (Read-Only — δεν αφορά Enterprise ID)

Οι παρακάτω 47 collections δεν έχουν write operations στον κώδικα, άρα δεν αφορούνται από το Enterprise ID audit:

`leads`, `activities`, `obligationTemplates`, `obligation_transmittals`, `analytics`, `metrics`, `teams`, `roles`, `permissions`, `relationships`, `forms`, `submissions`, `surveys`, `attachments`, `cadLayers`, `cadSessions`, `project_floorplans`, `calendar`, `bookings`, `logs`, `audit`, `inventory`, `assets`, `invoices`, `transactions`, `tokens`, `security_roles`, `email_domain_policies`, `country_security_policies`, `translations`, `locales`, `bot_configs`, `bot_catalogs`, `bot_intents`, `construction_tasks`, `digital_work_cards`, `boq_categories`, `boq_price_lists`, `boq_templates`, `cheques`, `legal_contracts`, `brokerage_agreements`, `commission_records`, `floor_floorplans`, `layer-events`, `layerGroups`, `obligationSections`

> **Σημείωση**: Όταν αυτές οι collections αποκτήσουν write operations στο μέλλον, ΠΡΕΠΕΙ να χρησιμοποιήσουν enterprise ID generators (ADR-017).

---

### 11.4 Πλήρης Λίστα Enterprise ID Generators (70+)

#### Core Business (18)
`generateCompanyId` (comp), `generateProjectId` (proj), `generateBuildingId` (bldg), `generateUnitId` (unit), `generateStorageId` (stor), `generateParkingId` (park), `generateContactId` (cont), `generateFloorId` (flr), `generateNavigationId` (nav), `generateDocumentId` (doc), `generateUserId` (usr), `generateAssetId` (ast), `generateRelationshipId` (rel), `generateMemberId` (mbr), `generateLandownerId` (lown), `generateWorkspaceId` (ws), `generateAddressId` (addr), `generateOpportunityId` (opp)

#### Legal & Obligations (5)
`generateSectionId` (sec), `generateArticleId` (art), `generateParagraphId` (par), `generateObligationId` (obl), `generateTransmittalId` (xmit)

#### Runtime (8)
`generateSessionId` (sess), `generateTransactionId` (txn), `generateNotificationId` (notif), `generateTaskId` (task), `generateEventId` (evt), `generateRequestId` (req), `generateMessageId` (msg), `generateJobId` (job)

#### DXF/CAD (4)
`generateOverlayId` (ovrl), `generateLevelId` (lvl), `generateLayerId` (lyr), `generateElementId` (elem)

#### File Operations (9)
`generatePhotoId` (photo), `generateAttachmentId` (att), `generateFileId` (file), `generateShareId` (share), `generatePendingId` (pending), `generateSubscriptionId` (sub), `generateFolderId` (fldr), `generateCommentId` (cmt), `generateApprovalId` (appr)

#### Accounting (10)
`generateJournalEntryId` (je), `generateInvoiceAccId` (inv), `generateBankTransactionId` (btxn), `generateFixedAssetId` (fxa), `generateDepreciationId` (depr), `generateEfkaPaymentId` (efka), `generateImportBatchId` (batch), `generateExpenseDocId` (exdoc), `generateApyCertificateId` (apy), `generateCustomCategoryId` (custcat)

#### Construction (3)
`generateConstructionPhaseId` (cphase), `generateConstructionTaskId` (ctask), `generateMilestoneId` (mile)

#### Attendance (2)
`generateAttendanceQrTokenId` (qrtok), `generateAttendanceEventId` (attev)

#### AI Pipeline (8)
`generateFeedbackId` (fb), `generatePipelineAuditId` (paud), `generateEntityAuditId` (eaud), `generateContractId` (lc), `generatePipelineQueueId` (pq), `generateVoiceCommandId` (vcmd), `generateWebhookId` (whk), `generateLearnedPatternId` (lp)

#### Financial (7)
`generateBrokerageId` (brk), `generateCommissionId` (com), `generatePaymentPlanId` (pp), `generatePlanGroupId` (ppg), `generatePaymentRecordId` (pay), `generateLoanId` (loan), `generateChequeId` (chq)

#### BOQ (4)
`generateBoqItemId` (boq), `generateBoqCategoryId` (boqcat), `generateBoqPriceListId` (boqpl), `generateBoqTemplateId` (boqtpl)

#### Observability (7)
`generateErrorId` (err), `generateMetricId` (metric), `generateAlertId` (alert), `generateTraceId` (trace), `generateSpanId` (span), `generateSearchId` (search), `generateAuditId` (audit)

#### Banking & Finance Intelligence (3)
`generateBankAccountId` (bacc), `generateDebtMaturityId` (dmt), `generateBudgetVarianceId` (bvar)

#### Utility (2)
`generateOptimisticId` (opt) — temporary UI IDs, `generateTempId` (tmp) — ephemeral

---

## 12. Σχετικά Αρχεία

| Αρχείο | Σκοπός |
|--------|--------|
| `src/config/firestore-collections.ts` | **SSoT** — Collections, Subcollections, System Docs |
| `src/config/firestore-schema-map.ts` | Schema definitions για AI awareness |
| `src/config/firestore-field-constants.ts` | Field name constants (14 πεδία) |
| `src/services/enterprise-id.service.ts` | Enterprise ID generation (60+ prefixes) |
| `firestore.rules` | Security rules (40+ collections) |
| `firestore.indexes.json` | Composite indexes (50+) |

---

## Changelog

| Ημερομηνία | Αλλαγή |
|-----------|--------|
| 2026-03-24 | Αρχική δημιουργία — Καθολική έρευνα 133 collections + 25 subcollections + 18 system docs |
| 2026-03-24 | Εμπλουτισμός: Live DB σύγκριση (9 ενεργές collections), Write Operations Analysis (205+ ops σε 118+ αρχεία), Ασυνέπεια `obligation-sections`, 47 read-only collections, Critical Transaction Points |
| 2026-03-24 | Enterprise ID Compliance Audit (§11): 70+ generators, 58 COMPLIANT collections, 11 EXEMPT, 1 VIOLATION (`employment_records` — `collRef.doc()` auto-ID), 47 read-only (N/A) |
| 2026-03-24 | Δεύτερη έρευνα Enterprise ID: +2 VIOLATIONS εντοπίστηκαν — `system_audit_logs` & `audit_logs` subcollection χρησιμοποιούν `.add()` (auto-ID) στο `src/lib/auth/audit.ts` (lines 199, 762). Σύνολο: 3 παραβιάσεις |
| 2026-04-09 | SSoT κεντρικοποίηση collection names: +3 νέα entries (`BOOKING_SESSIONS`, `CLOUD_FUNCTION_AUDIT_LOG`, `BANK_ACCOUNTS` subcol). Cloud Functions mirror (`functions/src/config/firestore-collections.ts` + `enterprise-id.ts`). Fix `DXF_OVERLAY_LEVELS` name (`dxfOverlayLevels` → `dxf-overlay-levels`). 15+ αρχεία migrated από hardcoded strings → `COLLECTIONS.*` / `SUBCOLLECTIONS.*`. SSoT baseline updated (23 violations resolved). |
