# ADR-262: AI Agent Testing & Production Standards

**Status**: ACTIVE
**Date**: 2026-03-25
**Category**: AI Architecture / Quality Standards / Operations
**Related**: ADR-171 (Autonomous AI Agent), ADR-145 (Super Admin AI Assistant)

## Context

Η εφαρμογή εισέρχεται σε φάση δοκιμών με στόχο ο AI Agent να λειτουργεί ως πλήρης προσωπική γραμματέας. Αυτό το ADR καταγράφει 4 κρίσιμες αποφάσεις για τη φάση δοκιμών και τη μετάβαση σε production.

---

## Απόφαση 1: AI Agent ως Προσωπική Γραμματέας

### Στόχος

Ο AI Agent αντικαθιστά πλήρως προσωπική γραμματέα — πανταχού παρών, 100% γραφειοκρατίας. Κάθε εργασία που θα έκανε μία γραμματέας, την κάνει ο agent μέσω φυσικής γλώσσας.

### Κανάλι δοκιμών

Telegram (κύριο). Η λειτουργικότητα ισχύει σε όλα τα κανάλια (email, Messenger, Instagram, in-app).

### Υπάρχουσες δυνατότητες (2026-03-25)

| Κατηγορία | Λειτουργία |
|-----------|-----------|
| Επαφές | Αναζήτηση, δημιουργία, ενημέρωση (phone/email/social append) |
| Επικοινωνία | Αποστολή email (branded), Telegram, Messenger, Instagram |
| Data queries | Query σε Firestore (projects, buildings, units, payments, tasks κλπ) |
| Tasks | Δημιουργία tasks, complaints με admin notification |
| Αρχεία | Αποστολή φωτογραφιών, κατόψεων, εγγράφων στο chat |
| Knowledge base | Αναζήτηση νομικών διαδικασιών & απαιτούμενων εγγράφων |
| Lookup | Αναζήτηση κωδικών ΔΟΥ |
| Reasoning | Multi-step queries (3-7 iterations αυτόνομα) |

### Ελλείψεις (θα προστεθούν on-demand)

1. Δημιουργία/ενημέρωση projects, buildings, units
2. Scheduling — ραντεβού, reminders, follow-ups
3. Upload εγγράφων μέσω Telegram (φωτο → Storage → Firestore)
4. Αναφορές/aggregations (π.χ. summary πληρωμών μήνα)
5. Σύνδεση επαφών με projects/units (contact links)
6. Email inbox read ("τι emails ήρθαν σήμερα;")

### Μεθοδολογία

**Real-world testing drives development.** Ο Γιώργος δοκιμάζει από Telegram — ό,τι λείπει ή δεν δουλεύει σωστά, προστίθεται/διορθώνεται αμέσως.

---

## Απόφαση 2: Google-Level File Size Standards

### Πηγή

Google Engineering Practices, SonarQube defaults, Clean Code (Robert Martin).

### Αρχές

- **Single Responsibility Principle (SRP)**: κάθε αρχείο = 1 ευθύνη
- **Cognitive Complexity**: αν δεν καταλαβαίνεις ένα αρχείο σε 5 λεπτά, είναι πολύ μεγάλο
- **Readability**: >500 γραμμές = code smell, >1000 = σχεδόν πάντα bug

### Κανόνες

| Τύπος αρχείου | Μέγιστο όριο | Δράση |
|---------------|-------------|-------|
| Handler, Service, Utility, Component | **500 γραμμές** | ΥΠΟΧΡΕΩΤΙΚΟ split |
| Config / Types / Data | Χωρίς όριο | Δεν περιέχουν λογική |
| Function | **40 γραμμές** | Extract helper function |

### Επιβολή

1. **CLAUDE.md κανόνας N.7.1** — Κάθε agent τον διαβάζει αυτόματα σε κάθε συνεδρία
2. **Pre-commit hook CHECK 4** — Μπλοκάρει commit αν staged .ts/.tsx αρχείο >500 γραμμές
3. **Εξαιρέσεις hook**: `config/`, `types/`, `data/`, `*.config.*`, `*.d.ts`, `*.test.*`, `*.spec.*`, `tool-definitions`

### Audit αρχείων (2026-03-25)

Αρχεία που ξεπερνούν το όριο και χρειάζονται σταδιακό refactoring:

| Αρχείο | Γραμμές | Κατάσταση |
|--------|---------|-----------|
| `pipeline-orchestrator.ts` | 1448 | Χρειάζεται split |
| `contact-lookup.ts` | 897 | Χρειάζεται split |
| `agentic-loop.ts` | 874 | Χρειάζεται split |
| `channel-reply-dispatcher.ts` | 748 | Χρειάζεται split |
| `ai-reply-generator.ts` | 655 | Χρειάζεται split |
| `customer-handler.ts` | 558 | Borderline — παρακολουθούμε |
| `executor-shared.ts` | 519 | Borderline — παρακολουθούμε |

**Πολιτική:** Refactorings σταδιακά, ΟΧΙ όλα μαζί. Προτεραιότητα στα αρχεία που αγγίζουμε (migrate-on-touch).

---

## Απόφαση 3: Φάσεις Περιβάλλοντος — TESTING vs PRODUCTION

### ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ — ΜΗΔΕΝΙΚΗ ΕΞΑΙΡΕΣΗ

### Τρέχουσα φάση: TESTING

- Όλα τα δεδομένα (Firestore + Storage) είναι **δοκιμαστικά & πρόχειρα**
- Μπορούν να διαγραφούν, τροποποιηθούν, ξαναδημιουργηθούν ελεύθερα
- Ο agent δοκιμάζεται χωρίς κίνδυνο
- Σκοπός: εντοπισμός bugs, missing features, βελτιώσεις

### Επόμενη φάση: PRODUCTION

- Τα δεδομένα είναι **πραγματικά & αμετάκλητα**
- **ΑΠΑΓΟΡΕΥΕΤΑΙ**: διαγραφή, bulk τροποποίηση, δοκιμαστικές καταχωρήσεις
- **ΑΠΑΓΟΡΕΥΕΤΑΙ**: developer/agent να "δοκιμάσει" σε production data
- Κάθε αλλαγή σε data απαιτεί **ρητή εντολή Γιώργου**

### Μετάβαση TESTING → PRODUCTION

- Θα γίνει **ΜΟΝΟ** με ρητή απόφαση Γιώργου
- Πριν τη μετάβαση: καθαρισμός ΟΛΩΝ των test data
- Μετά τη μετάβαση: ο κανόνας "ελεύθερη διαγραφή" **ΑΚΥΡΩΝΕΤΑΙ ΟΡΙΣΤΙΚΑ**

---

## Απόφαση 4: Test Script & Σειρά Δοκιμών

### Φάση Α: Δοκιμή υπαρχουσών λειτουργιών (ΠΡΩΤΑ)

Εντολές Telegram — αποστέλλονται μία-μία, ελέγχεται η απάντηση:

**A1. Αναζήτηση επαφών:**
- "Βρες τον Παπαδόπουλο"
- "Δείξε μου όλες τις επαφές"
- "Ποιες επαφές έχουν email;"

**A2. Δημιουργία επαφής:**
- "Δημιούργησε επαφή: Γιάννης Νικολάου, τηλ 6971234567, email giannis@test.com"
- "Φτιάξε εταιρεία: ΤΕΣΤ ΑΕ"

**A3. Ενημέρωση επαφής:**
- "Πρόσθεσε στον Νικολάου email: giannis2@test.com"
- "Πρόσθεσε τηλέφωνο 2101234567 στον Νικολάου"

**A4. Projects & Buildings:**
- "Δείξε μου τα projects"
- "Πόσα κτήρια έχει το project X;"
- "Ποιες μονάδες έχει το κτήριο Y;"

**A5. Αποστολή email:**
- "Στείλε email στον Νικολάου με θέμα Δοκιμή και κείμενο Γεια σου"

**A6. Tasks:**
- "Δημιούργησε task: Έλεγχος εγγράφων, προτεραιότητα υψηλή"
- "Δείξε τα ανοιχτά tasks"

**A7. ΔΟΥ Lookup:**
- "Ποιος είναι ο κωδικός ΔΟΥ Ιωνίας Θεσσαλονίκης;"

**A8. Multi-step reasoning:**
- "Ποιες μονάδες δεν έχουν πληρώσει στο project X;"
- "Βρες τον αγοραστή του διαμερίσματος Α1 και στείλε του email"

### Φάση Β: Δοκιμή ελλείψεων (θα αποτύχουν — καταγράφονται)

| Test | Εντολή | Ελλιπής λειτουργία |
|------|--------|-------------------|
| B1 | "Κλείσε ραντεβού αύριο στις 10 με τον Νικολάου" | Scheduling |
| B2 | (Στείλε φωτογραφία) "Αποθήκευσε αυτό στα αρχεία" | File upload via Telegram |
| B3 | "Δώσε μου summary πληρωμών Μαρτίου" | Aggregation/reports |
| B4 | "Σύνδεσε τον Νικολάου με το project X ως αγοραστή" | Contact links |
| B5 | "Τι emails ήρθαν σήμερα;" | Email inbox read |

### Σειρά προτεραιότητας

1. **ΠΡΩΤΑ** Φάση Α — βρες bugs σε αυτά που ήδη δουλεύουν
2. **ΜΕΤΑ** Φάση Β — κάθε αποτυχία = νέο feature request
3. Κάθε bug/έλλειψη καταγράφεται αμέσως στο changelog αυτού του ADR

---

## Consequences

### Positive
- Ξεκάθαρος διαχωρισμός testing/production — μηδενικός κίνδυνος data loss
- Αυτόματη επιβολή file size limits (pre-commit hook) — αδύνατο να ξεχαστεί
- Δομημένο test script — τίποτα δεν ξεχνιέται στις δοκιμές
- On-demand development — χτίζουμε μόνο ό,τι χρειάζεται πραγματικά

### Negative
- Τα 5 oversized αρχεία χρειάζονται σταδιακό refactoring (κόστος χρόνου)
- Η μετάβαση σε production απαιτεί manual data cleanup

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-25 | Initial: 4 αποφάσεις — AI agent scope, file size standards, testing/production phases, test script |
