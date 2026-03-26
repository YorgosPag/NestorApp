# QA Agent Testing — Findings Report

**Ημερομηνία**: 2026-03-25
**Environment**: Production (nestor-app.vercel.app)
**Test Contact 1**: Δημήτριος Οικονόμου (`cont_a60b466d-4139-4ff0-81ba-714df02faf83`)
**Test Contact 2**: Μαρία Παπαδοπούλου (`cont_ffc75581-6210-49f0-8e93-065edf362bde`)
**Tester**: Claude Agent via production webhook (super admin: 5618410820)

---

## Σύνοψη

| Κατηγορία | Tests | Pass | Fail | Concern |
|-----------|-------|------|------|---------|
| Δημιουργία επαφής | 2 | 2 | 0 | 0 |
| Βασικά στοιχεία | 5 | 5 | 0 | 0 |
| Ταυτότητα | 2 | 1 | 0 | 1 |
| Φορολογικά | 2 | 2 | 0 | 0 |
| Επαγγελματικά (ESCO) | 4 | 2 | 1 | 1 |
| Επικοινωνία (phone/email) | 3 | 0 | 3 | 0 |
| Διεύθυνση | 1 | 1 | 0 | 0 |
| Σχέσεις | 1 | 0 | 0 | 1 |
| Φωτογραφίες | 1 | 1 | 0 | 0 |
| Τραπεζικά | 1 | 0 | 0 | 1 |
| Έγγραφα | 1 | 1 | 0 | 0 |
| **ΣΥΝΟΛΟ** | **23** | **15** | **4** | **4** |

---

## Test Results Detail

### ΦΑΣΗ 1: Δημιουργία επαφής
| Test | Input | Expected | Result |
|------|-------|----------|--------|
| 1.1 Δημιουργία | "Δημιούργησε νέα επαφή: Δημήτριος Οικονόμου" | Contact created | ✅ PASS |
| 7.1 2η Επαφή | "Δημιούργησε: Μαρία Παπαδοπούλου, τηλ 6988111222" | Created + phone | ✅ PASS |

### ΦΑΣΗ 2: Βασικά στοιχεία
| Test | Input | Expected | Result |
|------|-------|----------|--------|
| 2.1 Πατρώνυμο+Μητρώνυμο | "βάλε πατρώνυμο Αθανάσιος και μητρώνυμο Νικολέτα" | 2 fields set | ✅ PASS |
| 2.2 Φύλο+Ημ/νία (φυσική γλώσσα) | "είναι άνδρας, γεννήθηκε 15 Μαρτίου 1990" | gender=male, birthDate=15/03/1990 | ✅ PASS |
| 2.3 Χώρα γέννησης | "γεννήθηκε στην Ελλάδα" | birthCountry=GR | ✅ PASS |
| 2.4 ΑΜΚΑ σωστό (11ψ) | "Βάλε ΑΜΚΑ 15039012345" | Write | ✅ PASS |
| 2.5 ΑΜΚΑ λάθος (10ψ) | "Άλλαξε ΑΜΚΑ σε 1234567890" | Reject | ✅ PASS (rejected!) |

### ΦΑΣΗ 3: Ταυτότητα + Φορολογικά
| Test | Input | Expected | Result |
|------|-------|----------|--------|
| 3.1 Ταυτότητα (5 πεδία) | "αστυνομική ταυτότητα, ΑΚ 582946, ..." | 5 fields set | ⚠️ FINDING-001 |
| 3.2 ΑΦΜ | "ΑΦΜ 123456789" | vatNumber set | ✅ PASS |
| 3.3 ΔΟΥ (lookup) | "ΔΟΥ Καλαμαριάς" | lookup→4ψήφιο κωδικό | ✅ PASS (1312) |
| 3.4 Αλλαγή τύπου | "Άλλαξε σε διαβατήριο" | documentType=passport | ✅ PASS |

### ΦΑΣΗ 4: Επαγγελματικά (ESCO)
| Test | Input | Expected | Result |
|------|-------|----------|--------|
| 4.1 Unambiguous επάγγελμα | "αρχιτέκτονας τοπίου" | Write with ESCO URI | ✅ PASS |
| 4.2 Ambiguous επάγγελμα | "μηχανικός" | Block + ask disambiguation | ✅ PASS |
| 4.3 Δεξιότητες | "δεξιότητα σχεδιασμός κτιρίων" | ESCO search + write | ❌ FINDING-003 |
| 4.4 Εργοδότης+Θέση | "Senior Engineer στην ΑΕΔΑΚ ΑΕ" | employer + position set | ⚠️ FINDING-002 |

### ΦΑΣΗ 5: Επικοινωνία
| Test | Input | Expected | Result |
|------|-------|----------|--------|
| 5.1 Κινητό | "Πρόσθεσε κινητό 6974050026" | phones array append | ❌ FINDING-004 |
| 5.2 Email | "Πρόσθεσε email dimitrios@example.com" | emails array append | ❌ FINDING-004 |
| 5.3 Δεύτερο τηλέφωνο | "Πρόσθεσε σταθερό 2310123456" | phones array append | ❌ FINDING-004 |

### ΦΑΣΗ 6: Διεύθυνση
| Test | Input | Expected | Result |
|------|-------|----------|--------|
| 6.1 Διεύθυνση | "Τσιμισκή 42, Θεσσαλονίκη 54623" | address set | ✅ PASS (structured!) |

**Bonus**: Ο agent αποθήκευσε structured: `{street: "Τσιμισκή", streetNumber: "42", city: "Θεσσαλονίκη", postalCode: "54623"}`

### ΦΑΣΗ 8: Σχέσεις
| Test | Input | Expected | Result |
|------|-------|----------|--------|
| 8.1 Σχέση σύζυγος | "Η Μαρία είναι σύζυγος του Δημητρίου" | Δεν υπάρχει tool | ⚠️ FINDING-006 |

### ΦΑΣΗ 9: Φωτογραφίες
| Test | Input | Expected | Result |
|------|-------|----------|--------|
| 9.1 Upload φωτο | "Ανέβασε φωτογραφία Δημητρίου" | Δεν υπάρχει tool | ✅ Graceful ("παρέχετε αρχείο") |

### ΦΑΣΗ 10: Τραπεζικά
| Test | Input | Expected | Result |
|------|-------|----------|--------|
| 10.1 IBAN | "IBAN GR16011012500000000123... Εθνική" | Δεν υπάρχει tool | ⚠️ FINDING-007 |

### ΦΑΣΗ 11: Έγγραφα
| Test | Input | Expected | Result |
|------|-------|----------|--------|
| 11.1 Upload έγγραφο | "Ανέβασε πιστοποιητικό γέννησης" | Δεν υπάρχει tool | ✅ Graceful ("παρέχετε αρχείο") |

---

## Findings

### [MEDIUM] FINDING-001: documentNumber αφαιρεί πρόθεμα

- **Test**: 3.1 — Ταυτότητα (5 πεδία μαζί)
- **Input**: "αριθμός ΑΚ 582946"
- **Expected**: documentNumber = `"ΑΚ 582946"`
- **Actual**: documentNumber = `"582946"` (χωρίς πρόθεμα)
- **Severity**: MEDIUM
- **Category**: Data
- **Ανάλυση**: Ο agent αφαίρεσε το "ΑΚ" (πρόθεμα σειράς ταυτότητας). Στην AI response αναφέρεται σωστά "ΑΚ 582946" αλλά στο Firestore αποθηκεύτηκε χωρίς.
- **Fix**: Validate ότι documentNumber αποθηκεύεται as-is (string, not stripped)

---

### [MEDIUM] FINDING-002: position δεν αποθηκεύτηκε — ESCO disambiguation leak

- **Test**: 4.4 — Εργοδότης + Θέση
- **Input**: "Ο Δημήτριος δουλεύει ως Senior Engineer στην ΑΕΔΑΚ ΑΕ"
- **Expected**: employer = "ΑΕΔΑΚ ΑΕ", position = "Senior Engineer"
- **Actual**: employer = "ΑΕΔΑΚ ΑΕ" ✅, position = undefined ❌, **profession changed** to "μηχανικός δομικών έργων"
- **Severity**: MEDIUM
- **Category**: UX / Data
- **Ανάλυση**: Pending disambiguation ("ποιο μηχανικός;") πιάνει subsequent message. "Senior Engineer" ερμηνεύτηκε ως επιλογή "μηχανικός δομικών έργων". Position χάθηκε.
- **Fix**: (a) position extract ξεχωριστά, (b) disambiguation context δεν πρέπει να leak σε unrelated messages

---

### [LOW] FINDING-003: ESCO skill "σχεδιασμός κτιρίων" — 0 matches

- **Test**: 4.3 — Δεξιότητες
- **Input**: "Πρόσθεσε δεξιότητα σχεδιασμός κτιρίων"
- **Expected**: ESCO search → write (ή free-text)
- **Actual**: "Δεν βρέθηκε στα ESCO. Θέλεις ελεύθερο κείμενο;" — δεν αποθηκεύτηκε
- **Severity**: LOW
- **Category**: UX
- **Fix**: Optional — auto-save free-text skills αν δεν υπάρχει ESCO match

---

### [MEDIUM] FIND-B: Error message shown despite success

- **Test**: Session 2 — retry scenario
- **Input**: Εντολή που αρχικά αποτυγχάνει, μετά πετυχαίνει σε retry
- **Expected**: Μήνυμα επιτυχίας μετά το retry
- **Actual**: Εμφανίζεται error μήνυμα ενώ η ενέργεια πέτυχε
- **Severity**: MEDIUM (P2)
- **Category**: UX
- **Ανάλυση**: Μετά από retry, ο AI στέλνει error response από το αρχικό αποτυχημένο attempt αντί για success από το retry
- **Fix**: AI response πρέπει να βασίζεται στο τελικό αποτέλεσμα, όχι στο πρώτο

---

### [LOW] FIND-C: Unnecessary ESCO search for "Άνδρας"

- **Test**: Session 2 — gender assignment
- **Input**: "Ο Νίκος είναι άνδρας"
- **Expected**: Απλό `update_contact_field` → gender=male
- **Actual**: AI ψάχνει ESCO occupation database για "Άνδρας" πριν κάνει gender update
- **Severity**: LOW (P3)
- **Category**: Efficiency
- **Ανάλυση**: Ο AI μπερδεύει "είναι άνδρας" (φύλο) με "είναι [επάγγελμα]" pattern. Κάνει περιττό ESCO search πριν τελικά θέσει σωστά το gender
- **Fix**: System prompt clarification — "είναι άνδρας/γυναίκα" = gender, not occupation

---

### [CRITICAL] FINDING-004: Phone/Email — BLOCKED για admin

- **Test**: 5.1, 5.2, 5.3 — Κινητό, Email, Σταθερό
- **Input**: "Πρόσθεσε κινητό/email/σταθερό"
- **Expected**: phones/emails arrays populated
- **Actual**: "❌ Απαιτείται αναγνώριση χρήστη" — **phones: [], emails: []**
- **Severity**: CRITICAL
- **Category**: Auth / Data
- **Ανάλυση**: `append_contact_info` σχεδιάστηκε για customers (ο sender ενημερώνει τη δική του επαφή). Admin δεν μπορεί να κάνει append phones/emails σε **οποιαδήποτε** επαφή.
- **Fix**: Νέο admin tool ή επέκταση `update_contact_field` για phones/emails arrays

---

### [MEDIUM] FINDING-005: Search γενική πτώση — agent δεν βρίσκει contact

- **Test**: Localhost — "Σβήσε πατρώνυμο Δημητρίου"
- **Input**: Clean history + "Δημητρίου" (γενική πτώση)
- **Expected**: Βρίσκει contact
- **Actual**: "Δεν βρέθηκε" — search failed
- **Severity**: MEDIUM
- **Category**: Search
- **Fix**: ✅ `stripDiacritics()` + `stemGreekWord()` στο search_text handler.
  Τώρα "Δημητρίου" → strip accents → "δημητριου" → stem (-ου) → "δημητρι",
  "Δημήτριος" → strip accents → "δημητριος" → stem (-ος) → "δημητρι" → MATCH

---

### [HIGH] FINDING-006: Σχέσεις — firestore_write bypass (unvalidated data)

- **Test**: 8.1 — "Η Μαρία είναι σύζυγος του Δημητρίου"
- **Input**: Relationship request
- **Expected**: Graceful decline (δεν υπάρχει relationship tool) ή proper relationship creation
- **Actual**: AI λέει "✅ Ολοκληρώθηκε" — χρησιμοποίησε **firestore_write** για να δημιουργήσει document σε `contact_links` collection
- **Severity**: HIGH
- **Category**: Security / Data Integrity
- **Ανάλυση**: Ο agent παράκαμψε την απουσία dedicated tool και χρησιμοποίησε το generic `firestore_write` για να γράψει σε **arbitrary collection**. Τα data δεν περνούν από validation:
  ```json
  {
    "collection": "contact_links",
    "sourceContactId": "cont_a60b...",
    "targetEntityId": "cont_ffc7...",
    "role": "spouse"
  }
  ```
- **Κίνδυνος**: `firestore_write` μπορεί να γράψει **οτιδήποτε** σε **οποιαδήποτε** collection χωρίς business logic validation
- **Fix**:
  - (a) Restrict `firestore_write` σε allowlisted collections
  - (b) Ή δημιουργία proper `manage_relationship` tool
  - (c) Ή block `firestore_write` σε collections χωρίς explicit tool

---

### [HIGH] FINDING-007: IBAN — firestore_write bypass (flat field, no validation)

- **Test**: 10.1 — "IBAN GR1601101250000000012300695, Εθνική Τράπεζα"
- **Input**: Banking details
- **Expected**: Graceful decline (δεν υπάρχει banking tool)
- **Actual**: AI λέει "✅ Ολοκληρώθηκε" — χρησιμοποίησε **firestore_write** για να γράψει `iban` ως **flat field** πάνω στο contact document
- **Severity**: HIGH
- **Category**: Security / Data Integrity
- **Ανάλυση**:
  - IBAN γράφτηκε ως `contact.iban = "GR1601101250000000012300695"` (flat field)
  - ΕPΡΕΠΕ να χρησιμοποιηθεί structured `bankAccounts[]` array με `validateIBAN()`
  - Δεν έγινε IBAN validation (ISO 13616)
  - `bankName` δεν αποθηκεύτηκε
- **Κίνδυνος**: Invalid IBAN μπορεί να αποθηκευτεί, data model corruption
- **Fix**: Ίδιο με FINDING-006 — restrict `firestore_write` ή δημιούργησε dedicated banking tool

---

## Missing Agent Capabilities (δεν υπάρχει tool)

| Capability | Status | Σημείωση |
|------------|--------|----------|
| Phones/Emails (admin) | ✅ **WORKS** | `append_contact_info` δουλεύει για admin (με contactId) |
| Φωτογραφίες upload | ✅ **IMPLEMENTED** | `attach_file_to_contact` tool (profile_photo, gallery_photo) |
| Σχέσεις επαφών | ✅ **IMPLEMENTED** | `manage_relationship` tool (add/list/remove, Greek support) |
| Τραπεζικά στοιχεία | ✅ **IMPLEMENTED** | `manage_bank_account` tool (IBAN ISO 13616, auto-detect bank) |
| Έγγραφα upload | ✅ **IMPLEMENTED** | `attach_file_to_contact` tool (document purpose) |

---

## Ιεράρχηση Fixes

| Priority | Finding | Impact | Effort | Status |
|----------|---------|--------|--------|--------|
| 🔴 P0 | FINDING-004: Phone/Email blocked for admin | Βασική λειτουργία admin broken | Medium | ✅ FIXED |
| 🔴 P0 | FINDING-006: firestore_write bypass (relationships) | Unvalidated data σε arbitrary collections | Medium | ✅ FIXED |
| 🔴 P0 | FINDING-007: firestore_write bypass (IBAN) | Data model corruption, no validation | Medium | ✅ FIXED |
| 🟡 P1 | FINDING-002: ESCO disambiguation leak | Auto-selects χωρίς consent | Medium | ✅ FIXED |
| 🟡 P1 | FINDING-001: documentNumber prefix stripped | Data loss | Low | ✅ FIXED |
| 🟢 P2 | FINDING-005: Search γενική πτώση | UX issue | Medium | ✅ FIXED |
| 🟢 P2 | FINDING-003: Skills free-text flow | UX improvement | Low | ✅ FIXED |

### Session 2 — E2E Telegram Bot Testing (2026-03-25)

| Priority | Finding | Impact | Effort | Status |
|----------|---------|--------|--------|--------|
| 🔴 **P0** | **FIND-F: AI hallucination → data corruption** | Anti-fabrication guardrail: server blocks + prompt | High | ✅ FIXED |
| 🟡 P1 | FIND-E: ESCO disambiguation loop | ESCO context injection + prompt rule | Medium | ✅ FIXED |
| 🟢 P2 | FIND-D: Employer χάνεται μετά ESCO | Prompt rule: πολυμερείς εντολές | Low | ✅ FIXED |
| 🟢 P2 | FIND-B: Error message despite success | Prompt rule: τελική κατάσταση μόνο | Low | ✅ FIXED |
| 🟢 P2 | FIND-A: Hallucinated contactId | Ενισχυμένος κανόνας fresh search | Low | ✅ FIXED |
| 🟢 P3 | FIND-C: Unnecessary ESCO search for "Άνδρας" | Prompt rule: gender ≠ occupation | Low | ✅ FIXED |

### Session 3 — E2E Dev Bot Testing via Simulated Webhook (2026-03-25)

**Test Contact**: Νίκος Τεστόπουλος (`cont_095e89ef-2808-4165-8429-56d8ed160f09`)
**Test Contact 2**: Μαρία Τεστοπούλου (`cont_f629e289-690e-4dbb-a2eb-8aa73a4277e4`)
**Method**: Simulated webhook POST → localhost:3000 (dev bot)

#### Σύνοψη Tests

| Test | Input | Tool Used | Result |
|------|-------|-----------|--------|
| Δημιουργία επαφής | "Δημιούργησε νέα επαφή: Νίκος Τεστόπουλος" | `create_contact` | ✅ PASS |
| Κινητό τηλέφωνο | "Πρόσθεσε κινητό 6974050026" | `append_contact_info` | ✅ PASS |
| Email | "Πρόσθεσε email nikos.test@example.com" | `append_contact_info` | ✅ PASS |
| Διεύθυνση | "Βάλε διεύθυνση Τσιμισκή 42, Θεσσαλονίκη 54623" | `update_contact_field` | ⚠️ FIND-G |
| Σταθερό τηλέφωνο | "Πρόσθεσε σταθερό τηλέφωνο 2310123456" | `append_contact_info` | ⚠️ FIND-H |
| Ιστοσελίδα | "Πρόσθεσε ιστοσελίδα www.testopoulos.gr" | `append_contact_info` | ⚠️ FIND-I |
| LinkedIn | "Πρόσθεσε LinkedIn https://linkedin.com/in/..." | `append_contact_info` | ✅ PASS |
| IBAN | "Πρόσθεσε IBAN GR16... Εθνική Τράπεζα" | `manage_bank_account` | ✅ PASS |
| 2η Επαφή | "Δημιούργησε: Μαρία Τεστοπούλου" | `create_contact` | ✅ PASS |
| Σχέση σύζυγος | "Η Μαρία είναι σύζυγος του Νίκου" | `manage_relationship` | ✅ PASS |
| Φωτογραφία | Photo message + caption | `attach_file_to_contact` | ✅ PASS (download → vision preview → classify → link) |
| Έγγραφο PDF | Document message + caption | `attach_file_to_contact` | ✅ PASS (download → vision preview → classify → link) |

#### Findings Detail

---

### [MEDIUM] FIND-G: Διεύθυνση αποθηκεύεται ως flat string

- **Test**: Διεύθυνση — "Βάλε διεύθυνση Τσιμισκή 42, Θεσσαλονίκη 54623"
- **Expected**: `addresses: [{street: "Τσιμισκή", streetNumber: "42", city: "Θεσσαλονίκη", postalCode: "54623"}]`
- **Actual**: `address: "Τσιμισκή 42, Θεσσαλονίκη 54623"` (flat string), `addresses: []` (κενό)
- **Severity**: MEDIUM
- **Category**: Data Model
- **Tool Used**: `update_contact_field` αντί structured address tool
- **Ανάλυση**: Ο AI χρησιμοποίησε `update_contact_field` με `field: "address"` αντί να κάνει parse τη διεύθυνση σε structured object. Στο Session 1 (production) η ίδια εντολή αποθήκευσε structured. Η διαφορά: Session 1 είχε πιο αναλυτικό prompt ή διαφορετικό tool routing.
- **Fix**: (a) AI prompt rule: "address → χρησιμοποίησε `addresses[]` array", ή (b) `update_contact_field` handler να κάνει auto-parse addresses, ή (c) Νέο `update_address` tool

---

### [MEDIUM] FIND-H: Σταθερό τηλέφωνο αποθηκεύεται ως type: "mobile"

- **Test**: "Πρόσθεσε σταθερό τηλέφωνο 2310123456"
- **Expected**: `{number: "2310123456", type: "landline"}`
- **Actual**: `{number: "2310123456", type: "mobile", label: "σταθερό"}`
- **Severity**: MEDIUM
- **Category**: Data
- **Ανάλυση**: Ο `append_contact_info` handler αποθηκεύει πάντα `type: "mobile"`. Δεν υπάρχει phone type classification βάσει prefix (2xxx = landline) ή label ("σταθερό" = landline).
- **Fix**: (a) Handler: αν label="σταθερό" ή number ξεκινάει με 2 → `type: "landline"`, ή (b) AI prompt: pass σωστό type στο tool call

---

### [LOW] FIND-I: Ιστοσελίδα + hallucinated contactId + error despite success

- **Test**: "Πρόσθεσε ιστοσελίδα www.testopoulos.gr"
- **Issue 1**: AI χρησιμοποίησε **hallucinated contactId** (`cont_c56a003d` — δεν υπάρχει) στο πρώτο attempt
- **Issue 2**: Μετά το retry με σωστό ID, η απάντηση ήταν "Η εγγραφή δεν ολοκληρώθηκε" παρόλο που πέτυχε
- **Issue 3**: Website αποθηκεύτηκε στο `socialMedia[]` ως `platform: "other", label: "website"` αντί dedicated field
- **Severity**: LOW (self-corrected, data saved correctly)
- **Category**: UX / Data Model
- **Ανάλυση**: (1) contactId hallucination — FIND-A regression, (2) Error message παρά success — FIND-B regression, (3) Δεν υπάρχει `website` πεδίο στο contact schema
- **Fix**: (1-2) Regressions — ελέγξτε prompt rules, (3) Optional: add `websites[]` field

---

### [CRITICAL → ✅ RESOLVED] FIND-J: Photo/Document attachments pipeline

- **Test**: Photo message (with photo array) + Document message (with document object)
- **Αρχικό πρόβλημα**: Ο `TelegramChannelAdapter` δεν εξήγαγε `photo[]`/`document` στα `normalized.attachments`
- **Severity**: ~~CRITICAL~~ → **RESOLVED**
- **Category**: Pipeline / Channel Adapter
- **Υλοποιημένη λύση — Πλήρης 5-σταδίου pipeline**:
  1. **Download**: Telegram webhook → `getTelegramFile()` → download binary → upload σε Firebase Storage → FileRecord (PENDING)
  2. **Extraction**: `telegram-channel-adapter.ts` → `mapAttachments()` → `IntakeAttachment[]` με fileRecordId
  3. **Document Preview** (ADR-264): `document-preview-service.ts` → OpenAI Vision (base64) → σύνοψη, τύπος, γλώσσα, προτεινόμενες ενέργειες → enrich AI context
  4. **Document Classification**: `contact-document-classifier.ts` → OpenAI Vision → 117+ κατηγορίες (ταυτότητα, τιμολόγιο, CV, συμβόλαιο κλπ) με confidence score
  5. **AI Agent Processing**: Enriched μήνυμα φτάνει στο agentic loop → AI καλεί `attach_file_to_contact` → auto-classify → link σε επαφή
- **Υποστηριζόμενοι τύποι**: Images (JPEG, PNG, GIF, WebP), PDF, DOCX, XLSX
- **Όρια**: Max 4MB για Vision analysis, 2 previews ανά μήνυμα, 15s timeout
- **Status**: ✅ **FULLY IMPLEMENTED** — Production-grade document ingestion με vision AI, quarantine, idempotency, audit trail

---

#### Ιεράρχηση Fixes — Session 3

| Priority | Finding | Impact | Effort | Status |
|----------|---------|--------|--------|--------|
| 🔴 **P0** | **FIND-J: Attachments pipeline** | Photo/document upload | Medium | ✅ FULLY IMPLEMENTED (5-stage pipeline: download → preview → classify → enrich → tool call) |
| 🟡 P1 | FIND-G: Address ως flat string | Data model inconsistency | Low | ✅ FIXED |
| 🟡 P1 | FIND-H: Landline → type: "mobile" | Wrong phone type classification | Low | ✅ FIXED |
| 🟡 P1 | **FIND-K: Search δεν βρίσκει "Τεστοπούλου"** | search_text_tokens missing σε AI-created contacts | Medium | ✅ FIXED (search-indexer.ts → searchDocuments) |
| 🟢 P2 | FIND-I: Website + hallucinated ID + error msg | UX regression + data model | Low | ✅ FIXED (fieldType: 'website' + prompt hardening) |

---

## Θετικά Ευρήματα

1. ✅ **Δημιουργία επαφής**: Λειτουργεί άψογα, ακόμη και με τηλέφωνο στη δημιουργία
2. ✅ **Βασικά στοιχεία**: 5/5 tests pass, format conversions (date, country ISO)
3. ✅ **ΑΜΚΑ validation**: Απέρριψε 10-ψήφιο (production)
4. ✅ **ΔΟΥ lookup**: Σωστός 4-ψήφιος κωδικός
5. ✅ **ESCO disambiguation**: Μπλοκάρει ambiguous, αφήνει unambiguous
6. ✅ **Διεύθυνση (Session 1)**: Structured storage (street, number, city, postalCode)
7. ✅ **IBAN (Session 3)**: `manage_bank_account` tool → sub-collection `contacts/{id}/bankAccounts` — IBAN validated + formatted
8. ✅ **Σχέσεις (Session 3)**: `manage_relationship` tool → `contact_relationships` collection — σωστό
9. ✅ **Phone/Email append (Session 3)**: Κινητό + email αποθηκεύονται σωστά στα arrays
10. ✅ **LinkedIn (Session 3)**: Αποθηκεύεται στο `socialMedia[]` με `platform: "linkedin"` + URL
11. ✅ **Self-correction (Session 3)**: AI κάνει search + retry όταν contactId αποτυγχάνει

---

## Κανόνες Automated Enforcement (Pre-commit)

### ESLint (αυτόματο σε κάθε commit)

1. `any` type → BLOCKED
2. `as any` assertions → BLOCKED
3. Unused imports → BLOCKED (auto-removed)
4. Unused variables → BLOCKED (εκτός `_prefix`)
5. `console.log` → WARNING (χρήση Logger)
6. Hardcoded colors/spacing → BLOCKED (design system)
7. Hardcoded Greek strings → WARNING (χρήση i18n `t()`)

### Custom Project Rules (validate-project-rules.sh)

8. Hardcoded storage paths (π.χ. `'floor-plans/'`) → BLOCKED — χρήση `LEGACY_STORAGE_PATHS` ή `buildStoragePath()`
9. `crypto.randomUUID()` inline → BLOCKED — χρήση `enterprise-id.service`
10. `addDoc()` → BLOCKED — χρήση `setDoc()` με enterprise ID
11. `@ts-ignore` → BLOCKED — φτιάξε το TypeScript error σωστά
12. Purge χωρίς Storage delete → BLOCKED — όταν κάνεις `lifecycleState: 'purged'`, πρέπει να διαγράφεις και το binary

### File Size (Google Standard)

13. Αρχεία >500 γραμμές → BLOCKED — σπάσε σε μικρότερα modules
    - Εξαιρούνται: `config/`, `types/`, `data/`, `.d.ts`, `.test.`, `.spec.`, `tool-definitions`

### Windows Protection

14. Reserved filenames (CON, PRN, NUL, COM0-9, LPT0-9) → BLOCKED

---

## Firestore Collections Reset — QA Clean Slate

> **Σκοπός**: Όταν ο Γιώργος δώσει εντολή **"καθάρισε collections"** / **"reset QA"** / **"άδειασε τις συλλογές"**, αδειάζουμε **ΜΟΝΟ** αυτές τις 12 συλλογές για καθαρό testing context.

| # | Collection | Περιγραφή |
|---|-----------|-----------|
| 1 | `ai_agent_feedback` | Feedback από AI agent interactions |
| 2 | `ai_chat_history` | Chat history context (20 msgs / user) |
| 3 | `ai_pipeline_audit` | Audit logs του AI pipeline |
| 4 | `ai_pipeline_queue` | Queue items για processing |
| 5 | `ai_usage` | Token usage tracking |
| 6 | `contacts` | Επαφές |
| 7 | `conversations` | Συνομιλίες |
| 8 | `external_identities` | External identity mappings |
| 9 | `files` | Αρχεία / documents |
| 10 | `messages` | Μηνύματα (email, telegram, κλπ) |
| 11 | `file_links` | Συνδέσεις αρχείων με entities (project→building κλπ) |
| 12 | `searchDocuments` | Search index documents για full-text αναζήτηση |

**ΠΡΟΣΟΧΗ**: ΔΕΝ αγγίζουμε καμία άλλη συλλογή (settings, projects, buildings, κλπ).

---

## Session 4 — Νομικά Πρόσωπα (Company Contacts) QA Testing (2026-03-26)

**Method**: Simulated webhook POST → localhost:3000 (dev bot)
**Scope**: Δημιουργία & διαχείριση εταιρικών επαφών (`contactType: "company"`)

### Pre-Test Ανάλυση Κώδικα — Τι Υποστηρίζεται

#### ✅ ΛΕΙΤΟΥΡΓΕΙ για Εταιρείες

| Λειτουργία | Tool | Σημείωση |
|-----------|------|----------|
| Δημιουργία εταιρείας | `create_contact` | `contactType: 'company'` + `companyName` (υποχρεωτικό) |
| Email / Phone / Address / Website / Social | `append_contact_info` | Ίδιο με ατομικά, generic handler |
| ΑΦΜ, ΔΟΥ | `update_contact_field` | Στο `CONTACT_UPDATABLE_FIELDS` |
| Τραπεζικοί λογαριασμοί | `manage_bank_account` | IBAN + auto-detect τράπεζα, generic |
| Σχέσεις | `manage_relationship` | Εταιρικοί τύποι: `shareholder`, `director`, `representative`, `client`, `vendor` |
| Συνημμένα αρχεία | `attach_file_to_contact` | Documents, photos — generic handler |
| Missing fields check | `getContactMissingFields()` | Ελέγχει `registrationNumber`, `legalForm`, `taxOffice` για companies |

#### ❌ ΔΕΝ ΛΕΙΤΟΥΡΓΕΙ — Κενά στον Κώδικα

| Πεδίο/Feature | Πρόβλημα | Αρχείο |
|--------------|----------|--------|
| `legalForm` (ΑΕ/ΕΠΕ/ΙΚΕ/ΟΕ/ΕΕ) | Δεν είναι στο `CONTACT_UPDATABLE_FIELDS` | `contact-field-update-handler.ts` |
| `registrationNumber` (ΓΕΜΗ) | Δεν είναι στο `CONTACT_UPDATABLE_FIELDS` | `contact-field-update-handler.ts` |
| `companyName` (αλλαγή) | Δεν είναι στο `CONTACT_UPDATABLE_FIELDS` | `contact-field-update-handler.ts` |
| `legalName` / `tradeName` | Δεν είναι στο `CONTACT_UPDATABLE_FIELDS` | `contact-field-update-handler.ts` |
| `industry` / `sector` | Δεν είναι στο `CONTACT_UPDATABLE_FIELDS` | `contact-field-update-handler.ts` |
| `foundedDate` | Δεν είναι στο `CONTACT_UPDATABLE_FIELDS` | `contact-field-update-handler.ts` |
| `contactPersons[]` | Κανένα tool για append/manage | Δεν υπάρχει handler |
| Λογότυπο εταιρείας | Δεν υπάρχει `purpose: 'company_logo'` | `attachment-handler.ts` |
| Upload entries (ΓΕΜΗ κλπ) | ΜΗΔΕΝ entries με `contactTypes: ['company']` | `entries-contact.ts` |

#### ⚠️ Validation Gaps

- Εταιρεία δημιουργείται μόνο με `companyName` — χωρίς ΑΦΜ validation
- `legalForm` δεν ελέγχεται πουθενά
- Ο AI δεν γνωρίζει ποια πεδία χρειάζεται μια εταιρεία (δεν υπάρχει prompt guidance)

#### Κύρια Αρχεία Αναφοράς

| Αρχείο | Γραμμές | Ρόλος |
|--------|---------|-------|
| `types/contacts/contracts.ts` | 159-195 | `CompanyContact` interface |
| `tools/handlers/contact-handler.ts` | 73-180 | Create contact handler |
| `tools/handlers/contact-field-update-handler.ts` | 1-86 | Update field handler + `CONTACT_UPDATABLE_FIELDS` |
| `shared/contact-lookup.ts` | 655-694 | `getContactMissingFields()` |
| `config/upload-entry-points/entries-contact.ts` | — | Upload entry points (0 company entries) |

---

### Test Plan — Νομικά Πρόσωπα

| # | Test | Input | Expected | Result |
|---|------|-------|----------|--------|
| 4.1 | Δημιουργία εταιρείας | "Δημιούργησε νέα εταιρεία: ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ ΑΕ" | `contactType: company`, `companyName` set | |
| 4.2 | ΑΦΜ εταιρείας | "Βάλε ΑΦΜ 094519370" | `vatNumber` set | |
| 4.3 | ΔΟΥ εταιρείας | "ΔΟΥ Α' Θεσσαλονίκης" | `taxOffice` set via lookup | |
| 4.4 | Νομική μορφή | "Η νομική μορφή είναι ΑΕ" | `legalForm: 'ΑΕ'` ή reject (δεν είναι στα updatable fields) | |
| 4.5 | Αριθμός ΓΕΜΗ | "Αριθμός ΓΕΜΗ 0133652920" | `registrationNumber` ή reject | |
| 4.6 | Τηλέφωνο εταιρείας | "Πρόσθεσε τηλέφωνο 2310567890" | `phones[]` append, `type: landline` | |
| 4.7 | Email εταιρείας | "Πρόσθεσε email info@pagonis-construction.gr" | `emails[]` append | |
| 4.8 | Διεύθυνση έδρας | "Διεύθυνση Εγνατίας 154, Θεσσαλονίκη 54636" | `addresses[]` structured | |
| 4.9 | Ιστοσελίδα | "Πρόσθεσε ιστοσελίδα www.pagonis-construction.gr" | `websites[]` append | |
| 4.10 | IBAN εταιρείας | "IBAN GR1601101250000000012300695, Εθνική" | `bankAccounts` sub-collection | |
| 4.11 | 2η εταιρεία | "Δημιούργησε εταιρεία: DELTA ENGINEERING ΙΚΕ" | 2nd company created | |
| 4.12 | Σχέση client | "Η DELTA ENGINEERING είναι πελάτης της ΠΑΓΩΝΗΣ" | `manage_relationship` type: client | |
| 4.13 | Υπεύθυνος επικοινωνίας | "Υπεύθυνος επικοινωνίας: Νίκος Παπαδόπουλος, 6974050026" | `contactPersons[]` ή graceful decline | |
| 4.14 | Αλλαγή ονόματος εταιρείας | "Άλλαξε το όνομα σε ΠΑΓΩΝΗΣ ΤΕΧΝΙΚΗ ΑΕ" | `companyName` update ή reject | |
| 4.15 | Ίδρυση | "Ιδρύθηκε το 2005" | `foundedDate` ή reject | |

---

### Test Results — Session 4

**Test Contact 1**: ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ ΑΕ → ΠΑΓΩΝΗΣ ΤΕΧΝΙΚΗ ΑΕ (`comp_9d4154fb-7d1d-4a76-8ddd-66a9405984a9`)
**Test Contact 2**: DELTA ENGINEERING ΙΚΕ (`comp_742045a0-5152-4bbc-8157-e756ba5953fe`)
**Method**: Simulated webhook POST → localhost:3000/api/communications/webhooks/telegram (dev bot, Python UTF-8)

| # | Test | Input | Tool Used | Result |
|---|------|-------|-----------|--------|
| 4.1 | Δημιουργία εταιρείας | "Δημιούργησε νέα εταιρεία: ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ ΑΕ" | `create_contact` | ✅ PASS — type: company, comp_ prefix |
| 4.2 | ΑΦΜ εταιρείας | "Βάλε ΑΦΜ 094519370" | `update_contact_field` | ✅ PASS — vatNumber: "094519370" |
| 4.3 | ΔΟΥ εταιρείας | "ΔΟΥ Α΄ Θεσσαλονίκης" | `lookup_doy_code` → `update_contact_field` | ✅ PASS — taxOffice: "1301" |
| 4.4 | Νομική μορφή | "Η νομική μορφή είναι ΑΕ" | `update_contact_field` | ✅ PASS — legalForm: "ΑΕ" |
| 4.5 | Αριθμός ΓΕΜΗ | "Αριθμός ΓΕΜΗ 0133652920" | — | ❌ FIND-L — AI μπέρδεψε ΓΕΜΗ (10ψ) με ΑΦΜ (9ψ) |
| 4.6 | Τηλέφωνο εταιρείας | "Πρόσθεσε τηλέφωνο 2310567890" | `append_contact_info` | ✅ PASS — type: "work" (auto-detect 2310) |
| 4.7 | Email εταιρείας | "Πρόσθεσε email info@pagonis-construction.gr" | `append_contact_info` | ✅ PASS |
| 4.8 | Διεύθυνση έδρας | "Διεύθυνση Εγνατίας 154, Θεσσαλονίκη 54636" | `append_contact_info` | ✅ PASS — structured address, type: "work" |
| 4.9 | Ιστοσελίδα | "Πρόσθεσε ιστοσελίδα www.pagonis-construction.gr" | `append_contact_info` | ⚠️ FIND-M — Αποθηκεύτηκε αλλά AI εμφάνισε error message |
| 4.10 | IBAN εταιρείας | "IBAN GR16...695, Εθνική Τράπεζα" | `manage_bank_account` | ✅ PASS |
| 4.11 | 2η εταιρεία | "Δημιούργησε εταιρεία: DELTA ENGINEERING ΙΚΕ" | `create_contact` | ✅ PASS — comp_ prefix |
| 4.12 | Σχέση client | "Η DELTA ENGINEERING είναι πελάτης της ΠΑΓΩΝΗΣ" | `manage_relationship` | ⚠️ FIND-N — Σχέση αποθηκεύτηκε αλλά AI εμφάνισε error |
| 4.13 | Υπεύθυνος επικοινωνίας | "Υπεύθυνος: Νίκος Παπαδόπουλος, 6974050026" | — | ⚠️ EXPECTED — Δεν υπάρχει contactPersons[] tool |
| 4.14 | Αλλαγή ονόματος | "Άλλαξε σε ΠΑΓΩΝΗΣ ΤΕΧΝΙΚΗ ΑΕ" | `update_contact_field` | ✅ PASS — companyName + displayName auto-sync |
| 4.15 | Ίδρυση | "Ιδρύθηκε το 2005" | `update_contact_field` | ✅ PASS — foundedDate: "01/01/2005" |

#### Σύνοψη Session 4

| Κατηγορία | Tests | Pass | Fail | Concern |
|-----------|-------|------|------|---------|
| Δημιουργία εταιρείας | 2 | 2 | 0 | 0 |
| Βασικά στοιχεία (ΑΦΜ/ΔΟΥ/Μορφή/ΓΕΜΗ) | 4 | 3 | 1 | 0 |
| Επικοινωνία (phone/email/address/web) | 4 | 3 | 0 | 1 |
| Τραπεζικά | 1 | 1 | 0 | 0 |
| Σχέσεις | 1 | 0 | 0 | 1 |
| Υπεύθυνος επικοινωνίας | 1 | 0 | 0 | 1 |
| Αλλαγή στοιχείων | 2 | 2 | 0 | 0 |
| **ΣΥΝΟΛΟ** | **15** | **11** | **1** | **3** |

---

### Findings Detail — Session 4

---

### [MEDIUM] FIND-L: Αριθμός ΓΕΜΗ μπερδεύεται με ΑΦΜ

- **Test**: 4.5 — "Αριθμός ΓΕΜΗ 0133652920"
- **Expected**: `update_contact_field(field: "registrationNumber", value: "0133652920")`
- **Actual**: AI νόμισε ότι ο αριθμός `0133652920` (10 ψηφία) σχετίζεται με ΑΦΜ `094519370` (9 ψηφία) και απέρριψε
- **Severity**: MEDIUM
- **Category**: AI Prompt / Classification
- **Ανάλυση**: Ο AI δεν αναγνωρίζει τη λέξη "ΓΕΜΗ" ως σημαντικό keyword για `registrationNumber`. Αντ' αυτού, σύγκρινε τον αριθμό με το υπάρχον ΑΦΜ.
- **Fix**: Prompt rule: "Αριθμός ΓΕΜΗ" / "ΓΕΜΗ" → `update_contact_field(field: "registrationNumber")`. Δεν σχετίζεται με ΑΦΜ.
- **Status**: OPEN

---

### [LOW] FIND-M: Error message παρά success (website)

- **Test**: 4.9 — "Πρόσθεσε ιστοσελίδα www.pagonis-construction.gr"
- **Expected**: "✅ Προστέθηκε η ιστοσελίδα"
- **Actual**: "❌ Αποτυχία: Η προσθήκη δεν πραγματοποιήθηκε" — αλλά η ιστοσελίδα ΑΠΟΘΗΚΕΥΤΗΚε
- **Severity**: LOW
- **Category**: UX (FIND-B regression)
- **Ανάλυση**: Ο AI χρησιμοποίησε hallucinated contactId στο πρώτο attempt, μετά retry πέτυχε, αλλά η τελική απάντηση βασίστηκε στο αρχικό αποτυχημένο attempt
- **Fix**: Prompt hardening — τελική απάντηση βασισμένη στο ΤΕΛΕΥΤΑΙΟ tool result
- **Status**: OPEN

---

### [LOW] FIND-N: Error message παρά success (relationship)

- **Test**: 4.12 — "Η DELTA ENGINEERING είναι πελάτης της ΠΑΓΩΝΗΣ"
- **Expected**: "✅ Καταχωρήθηκε η σχέση πελάτη"
- **Actual**: "⚠️ Αποτυχία: Δεν πραγματοποιήθηκε" — αλλά η σχέση ΑΠΟΘΗΚΕΥΤΗΚε στο `contact_relationships`
- **Severity**: LOW
- **Category**: UX (FIND-B regression)
- **Ανάλυση**: Ίδιο pattern — retry πετυχαίνει αλλά ο AI εμφανίζει error
- **Status**: OPEN

---

### [INFO] FIND-O: firstName/lastName populated on company contacts

- **Test**: 4.1, 4.11 — Δημιουργία εταιρείας
- **Observation**: `firstName: "ΠΑΓΩΝΗΣ"`, `lastName: "ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ"` — ο AI σπάει το companyName σε firstName/lastName
- **Severity**: INFO (δεν σπάει τίποτα)
- **Category**: Data Model
- **Ανάλυση**: Το create_contact tool παίρνει firstName/lastName ως παραμέτρους ακόμα και για companies. Ο AI τα γεμίζει αντί να τα αφήσει κενά.
- **Fix**: Optional — prompt rule: "Για companies, firstName/lastName null ή κενό"
- **Status**: OPEN

---

#### Ιεράρχηση Fixes — Session 4

| Priority | Finding | Impact | Effort | Status |
|----------|---------|--------|--------|--------|
| 🟡 P1 | FIND-L: ΓΕΜΗ → registrationNumber | Βασικό εταιρικό πεδίο δεν λειτουργεί | Low (prompt rule) | OPEN |
| 🟢 P2 | FIND-M: Error despite success (website) | UX — FIND-B regression | Low (prompt rule) | OPEN |
| 🟢 P2 | FIND-N: Error despite success (relationship) | UX — FIND-B regression | Low (prompt rule) | OPEN |
| 🟢 P3 | FIND-O: firstName/lastName on company | Cosmetic — data model noise | Low (prompt rule) | OPEN |

---

#### Θετικά Ευρήματα — Session 4

1. ✅ **Δημιουργία εταιρείας**: `type: "company"`, `comp_` prefix, `companyName` σωστό
2. ✅ **ΑΦΜ/ΔΟΥ/Νομική μορφή**: Όλα λειτουργούν σωστά μέσω `update_contact_field`
3. ✅ **Τηλέφωνο**: Auto-detect `type: "work"` για σταθερά (2310) σε εταιρεία
4. ✅ **Διεύθυνση**: Structured address με `type: "work"` και `country: "GR"`
5. ✅ **IBAN**: `manage_bank_account` λειτουργεί και για εταιρείες
6. ✅ **Αλλαγή companyName**: `update_contact_field` + auto-sync `displayName`
7. ✅ **foundedDate**: Νέο πεδίο λειτουργεί σωστά ("2005" → "01/01/2005")
8. ✅ **Σχέσεις μεταξύ εταιρειών**: `manage_relationship` type: "client" λειτουργεί
9. ✅ **2η εταιρεία**: Δημιουργία χωρίς conflict, ξεχωριστά IDs

---

## Session 5 — Company Contacts Extended QA (2026-03-26)

**Method**: Simulated webhook POST → localhost:3000 (dev bot)
**Scope**: Ενημέρωση εταιρικών πεδίων (legalName, tradeName, industry, sector, ΓΕΜΗ) + regression tests

### Test Results — Session 5

| # | Test | Input | Result |
|---|------|-------|--------|
| 5.1 | Δημιουργία εταιρείας | "Δημιούργησε εταιρεία: ΑΛΦΑ ΤΕΧΝΙΚΗ ΑΕ" | ✅ PASS — FIND-O FIXED (firstName: "") |
| 5.2 | ΑΦΜ | "ΑΦΜ 040817944" | ✅ PASS — FIND-P FIXED (vatNumber, no DOY lookup) |
| 5.3 | ΔΟΥ | "ΔΟΥ Ιωνίας Θεσσαλονίκης" | ✅ PASS — FIND-Q FIXED (2-step: lookup→update) |
| 5.4 | Νομική μορφή | "Η νομική μορφή είναι ΑΕ" | ⚠️ FIND-R — legalForm ✅ αλλά gender: "male" fabricated |
| 5.5 | ΓΕΜΗ | "Αριθμός ΓΕΜΗ 0133652920" | ✅ PASS — FIND-L FIXED |
| 5.6 | Πλήρης επωνυμία | "Πλήρης επωνυμία ΑΛΦΑ ΤΕΧΝΙΚΗ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ" | ⚠️ FIND-S — legalName ✅ αλλά companyName αντικαταστάθηκε |
| 5.7 | Διακριτικός τίτλος | "Βάλε διακριτικό τίτλο ΑΛΦΑ ΤΕΧΝΙΚΗ" | ❌ FAIL — cascade: ψάχνει "ΑΛΦΑ ΤΕΧΝΙΚΗ ΑΕ" που δεν υπάρχει πια |
| 5.8 | Κλάδος | "Κλάδος: Κατασκευές" | ❌ FAIL — cascade: ίδιο πρόβλημα search |
| 5.9 | Τομέας | "Τομέας: Ιδιωτικός" | ❌ FAIL — cascade: δεν κάλεσε tool |

#### Σύνοψη Session 5

| Κατηγορία | Tests | Pass | Fail | Concern |
|-----------|-------|------|------|---------|
| Regression (FIND-O/P/Q/L) | 4 | 4 | 0 | 0 |
| Νέα εταιρικά πεδία | 5 | 0 | 3 | 2 |
| **ΣΥΝΟΛΟ** | **9** | **4** | **3** | **2** |

---

### [MEDIUM] FIND-R: AI πρόσθεσε gender σε εταιρεία

- **Test**: 5.4 — "Η νομική μορφή είναι ΑΕ"
- **Expected**: `legalForm: "ΑΕ"` ΜΟΝΟ
- **Actual**: `legalForm: "ΑΕ"` ✅ + `gender: "male"` ❌ fabricated
- **Severity**: MEDIUM
- **Category**: AI Hallucination / Data Integrity
- **Ανάλυση**: Ο AI πρόσθεσε gender σε εταιρεία χωρίς να ζητηθεί. Δεν υπήρχε server-side guard.
- **Fix**: (a) Server guard: INDIVIDUAL_ONLY_FIELDS blocked on company contacts, (b) Prompt rule: εταιρείες δεν έχουν ατομικά πεδία
- **Status**: ✅ FIXED

---

### [MEDIUM] FIND-S: legalName αντικατέστησε ΚΑΙ companyName

- **Test**: 5.6 — "Πλήρης επωνυμία ΑΛΦΑ ΤΕΧΝΙΚΗ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ"
- **Expected**: `legalName: "ΑΛΦΑ ΤΕΧΝΙΚΗ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ"`, `companyName: "ΑΛΦΑ ΤΕΧΝΙΚΗ ΑΕ"` (unchanged)
- **Actual**: `legalName` ✅ αλλά `companyName` αντικαταστάθηκε σε "ΑΛΦΑ ΤΕΧΝΙΚΗ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ"
- **Severity**: MEDIUM
- **Category**: AI Prompt / Data Integrity
- **Ανάλυση**: AI ερμήνευσε "πλήρης επωνυμία" ως αλλαγή ΚΑΙ του companyName. Cascade failure: 5.7/5.8/5.9 ψάχνουν "ΑΛΦΑ ΤΕΧΝΙΚΗ ΑΕ" που δεν υπάρχει πια.
- **Fix**: Prompt rule: legalName ≠ companyName, ΠΟΤΕ ταυτόχρονη ενημέρωση χωρίς ρητή εντολή
- **Status**: ✅ FIXED

---

### [LOW] FIND-T: AI fabricates contactId (comp_xxx) — FIND-A regression

- **Test**: 5.7, 5.8 — Ψάχνει εταιρεία
- **Expected**: Fresh search → σωστό UUID contactId
- **Actual**: AI χρησιμοποίησε fabricated IDs (comp_xxx, comp_1) → blocked by server
- **Severity**: LOW (self-corrects μετά retry, αλλά σπαταλά iterations)
- **Category**: AI Prompt / Efficiency
- **Ανάλυση**: Regression του FIND-A. Ο κανόνας δεν αναφέρει ρητά comp_ prefix patterns.
- **Fix**: Ενίσχυση anti-fabrication prompt με comp_xxx examples + UUID format reference
- **Status**: ✅ FIXED

---

#### Ιεράρχηση Fixes — Session 5

| Priority | Finding | Impact | Effort | Status |
|----------|---------|--------|--------|--------|
| 🟡 P1 | FIND-R: gender σε εταιρεία | Data integrity — ατομικά πεδία σε εταιρεία | Low (server guard + prompt) | ✅ FIXED |
| 🟡 P1 | FIND-S: legalName→companyName overwrite | Cascade failure 5.7/5.8/5.9 | Low (prompt rule) | ✅ FIXED |
| 🟢 P2 | FIND-T: comp_xxx fabricated IDs | Efficiency — retry σπατάλη | Low (prompt hardening) | ✅ FIXED |
