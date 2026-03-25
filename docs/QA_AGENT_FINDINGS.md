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
- **Fix**: Fuzzy matching ή Greek morphology normalization

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
| Phones/Emails (admin) | ❌ **BLOCKED** | `append_contact_info` μόνο για customers |
| Φωτογραφίες upload | ❌ Missing | Graceful response ("παρέχετε αρχείο") |
| Σχέσεις επαφών | ⚠️ **Bypass** | Agent χρησιμοποιεί firestore_write αντί proper tool |
| Τραπεζικά στοιχεία | ⚠️ **Bypass** | Agent γράφει flat field αντί structured banking |
| Έγγραφα upload | ❌ Missing | Graceful response ("παρέχετε αρχείο") |

---

## Ιεράρχηση Fixes

| Priority | Finding | Impact | Effort | Status |
|----------|---------|--------|--------|--------|
| 🔴 P0 | FINDING-004: Phone/Email blocked for admin | Βασική λειτουργία admin broken | Medium | ✅ FIXED |
| 🔴 P0 | FINDING-006: firestore_write bypass (relationships) | Unvalidated data σε arbitrary collections | Medium | ✅ FIXED |
| 🔴 P0 | FINDING-007: firestore_write bypass (IBAN) | Data model corruption, no validation | Medium | ✅ FIXED |
| 🟡 P1 | FINDING-002: ESCO disambiguation leak | Auto-selects χωρίς consent | Medium | ⏳ OPEN |
| 🟡 P1 | FINDING-001: documentNumber prefix stripped | Data loss | Low | ⏳ OPEN |
| 🟢 P2 | FINDING-005: Search γενική πτώση | UX issue | Medium | ⏳ OPEN |
| 🟢 P2 | FINDING-003: Skills free-text flow | UX improvement | Low | ⏳ OPEN |

---

## Θετικά Ευρήματα

1. ✅ **Δημιουργία επαφής**: Λειτουργεί άψογα, ακόμη και με τηλέφωνο στη δημιουργία
2. ✅ **Βασικά στοιχεία**: 5/5 tests pass, format conversions (date, country ISO)
3. ✅ **ΑΜΚΑ validation**: Απέρριψε 10-ψήφιο (production)
4. ✅ **ΔΟΥ lookup**: Σωστός 4-ψήφιος κωδικός
5. ✅ **ESCO disambiguation**: Μπλοκάρει ambiguous, αφήνει unambiguous
6. ✅ **Διεύθυνση**: Structured storage (street, number, city, postalCode)
7. ✅ **Graceful decline**: Φωτογραφίες + Έγγραφα ζητούν αρχείο αντί να κάνουν crash
