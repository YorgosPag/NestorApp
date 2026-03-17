# ADR-ACC-020: Βεβαίωση Παρακράτησης Φόρου (ΑΠΥ Certificate)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-03-17 |
| **Category** | Accounting / Tax Compliance / Document Generation |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-002](./ADR-ACC-002-invoicing-system.md) — Invoicing System |
| **Depends On** | [ADR-ACC-009](./ADR-ACC-009-tax-engine.md) — Tax Engine, [ADR-ACC-018](./ADR-ACC-018-invoice-pdf-generation.md) — Invoice PDF, [ADR-ACC-019](./ADR-ACC-019-invoice-email-sending.md) — Invoice Email |
| **Related** | [ADR-ACC-001](./ADR-ACC-001-chart-of-accounts.md) — Chart of Accounts |
| **Module** | M-003: Invoicing (Extension) + M-009: Tax Compliance |

---

## 1. Context

### 1.1 Νομική Υποχρέωση

Στην Ελλάδα, η παρακράτηση φόρου επί ΤΠΥ (Τιμολόγιο Παροχής Υπηρεσιών) είναι **υποχρεωτική**:

- **Συντελεστής**: 20% επί του καθαρού ποσού (Ν. 4172/2013, άρθρο 64)
- **Υπόχρεος παρακράτησης**: Ο πελάτης (νομικό πρόσωπο ή ΙΚΕ/ΑΕ/ΟΕ/ΕΕ)
- **Φορολογική χρήση**: Ο Γιώργος **πιστώνει** τις παρακρατήσεις έναντι του ετήσιου φόρου εισοδήματος
- **Νόμιμη αποδοχή**: Ο Γιώργος **εκδίδει Βεβαίωση Παρακράτησης Φόρου** για τον πελάτη (Ε3-08 αρχικά, Ε3-09 σε τροποποιήσεις)

> **Σκοπός της βεβαίωσης**: Ο πελάτης αποδεικνύει ότι παρακράτησε και κατέβαλε τον φόρο στην ΑΑΔΕ. Ο Γιώργος αποδεικνύει στη φορολογική δήλωση (Ε1) ότι ο φόρος έχει ήδη παρακρατηθεί.

### 1.2 Τρέχουσα Κατάσταση

| Λειτουργία | Κατάσταση |
|-----------|-----------|
| Φορολογικός μηχανισμός (`TaxEngine`) | ✅ `totalWithholdings` στο `TaxResult` |
| `WithholdingReconciliation` interface | ✅ υπάρχει στο `tax.ts` (γραμμή 404) |
| Έκδοση PDF βεβαίωσης | ❌ ΛΕΙΠΕΙ |
| Αποστολή βεβαίωσης μέσω email | ❌ ΛΕΙΠΕΙ |
| Καταγραφή ανά τιμολόγιο (`withholdingAmount`) | ❌ ΛΕΙΠΕΙ στο `Invoice` interface |
| UI διαχείρισης βεβαιώσεων | ❌ ΛΕΙΠΕΙ |
| Firestore collection `accounting_apy_certificates` | ❌ ΛΕΙΠΕΙ |

### 1.3 Διαφορά από ADR-ACC-009

Ο `TaxEngine` (ADR-ACC-009) υπολογίζει `totalWithholdings` **ετήσια** για τη φορολογική δήλωση.
Αυτό το ADR αφορά την **έκδοση και αποστολή** βεβαίωσης παρακράτησης ανά πελάτη — ξεχωριστό document lifecycle.

---

## 2. Υπάρχουσα Υποδομή — ΠΛΗΡΗΣ ΑΝΑΛΥΣΗ

### 2.1 Τύποι & Interfaces (ΗΔΗ ΥΠΑΡΧΟΥΝ)

| Interface | Αρχείο | Γραμμές | Reuse Level |
|-----------|--------|---------|-------------|
| `WithholdingReconciliation` | `types/tax.ts` | 404-423 | **100%** — reuse ως base για per-invoice data |
| `totalWithholdings: number` | `types/tax.ts` | 74-75, 137 | **100%** — ετήσιο σύνολο |
| `InvoiceIssuer`, `InvoiceCustomer` | `types/invoice.ts` | 90-141 | **100%** — snapshot pattern |
| `EmailSendRecord` | `types/invoice.ts` | 187-200 | **85%** — ίδιο pattern για APY email history |

### 2.2 PDF Infrastructure (ΗΔΗ ΟΛΟΚΛΗΡΩΘΗΚΕ — ADR-ACC-018)

| Σύστημα | Αρχείο | Reuse |
|---------|--------|-------|
| `COLORS`, `LAYOUT`, `LOGO` constants | `services/pdf/invoice-pdf-template.ts` | **100%** |
| `drawHeader()` — Pagonis branded header | (ίδιο) | **100%** |
| `drawTotalsSection()` — νούμερα / ποσά | (ίδιο) | **85%** — διαφορετικά labels |
| `addPageFooters()` — footer με στοιχεία εταιρείας | (ίδιο) | **100%** |
| `loadLogo()` pattern | `services/pdf/invoice-pdf-exporter.ts` | **100%** |
| `getInvoicePDFBlob()` → `Blob` | (ίδιο) | **85%** — pattern, όχι function |

### 2.3 Email Infrastructure (ΗΔΗ ΟΛΟΚΛΗΡΩΘΗΚΕ — ADR-ACC-019)

| Σύστημα | Αρχείο | Reuse |
|---------|--------|-------|
| `sendReplyViaMailgun()` + attachments support | `src/services/ai-pipeline/shared/mailgun-sender.ts` | **100%** |
| `wrapInBrandedTemplate()` | `src/services/email-templates/base-email-template.ts` | **100%** |
| `escapeHtml()`, `formatEuro()`, `formatDateGreek()` | (ίδιο) | **100%** |
| Invoice email template **pattern** | `services/email/invoice-email-template.ts` | **85%** — ίδια δομή |
| API endpoint **pattern** | `src/app/api/accounting/invoices/[id]/send-email/route.ts` | **90%** |

### 2.4 Middleware (ΗΔΗ ΥΠΑΡΧΟΥΝ)

| Middleware | Αρχείο | Reuse |
|-----------|--------|-------|
| `withAuth` | `src/lib/middleware/with-auth.ts` | **100%** |
| `withSensitiveRateLimit` (20/min) | `src/lib/middleware/with-rate-limit.ts` | **100%** |

### 2.5 Enterprise ID Service (ΗΔΗ ΥΠΑΡΧΕΙ)

| Service | Αρχείο | Reuse |
|---------|--------|-------|
| `generateId()` | `src/services/enterprise-id.service.ts` | **100%** — νέος prefix `apy_` |

---

## 3. Gap Analysis — Τι ΛΕΙΠΕΙ

| Στοιχείο | Αρχείο | Κατάσταση |
|---------|--------|-----------|
| `withholdingRate?: number` στο `Invoice` | `types/invoice.ts` | ❌ ΛΕΙΠΕΙ |
| `withholdingAmount?: number` στο `Invoice` | `types/invoice.ts` | ❌ ΛΕΙΠΕΙ |
| `APYCertificate` interface | `types/tax.ts` ή `types/apy.ts` | ❌ ΛΕΙΠΕΙ |
| `APYCertificateSendRecord` interface | (ίδιο) | ❌ ΛΕΙΠΕΙ |
| Firestore collection `accounting_apy_certificates` | `src/config/firestore-collections.ts` | ❌ ΛΕΙΠΕΙ |
| Enterprise ID prefix `apy_` + generator | `enterprise-id.service.ts` | ❌ ΛΕΙΠΕΙ |
| PDF template βεβαίωσης | νέο: `services/pdf/apy-certificate-pdf-template.ts` | ❌ ΛΕΙΠΕΙ |
| PDF exporter βεβαίωσης | νέο: `services/pdf/apy-certificate-pdf-exporter.ts` | ❌ ΛΕΙΠΕΙ |
| Email template βεβαίωσης | νέο: `services/email/apy-certificate-email-template.ts` | ❌ ΛΕΙΠΕΙ |
| API: POST send-email βεβαίωσης | νέο: `api/accounting/apy-certificates/[id]/send-email/route.ts` | ❌ ΛΕΙΠΕΙ |
| API: POST create βεβαίωσης | νέο: `api/accounting/apy-certificates/route.ts` | ❌ ΛΕΙΠΕΙ |
| Repository methods APY CRUD | extend `IAccountingRepository` | ❌ ΛΕΙΠΕΙ |
| UI: Create/view βεβαίωση | νέα σελίδα ή InvoiceDetails button | ❌ ΛΕΙΠΕΙ (βλ. Ερώτημα 7) |

---

## 4. Αρχιτεκτονικές Αποφάσεις — ΑΝΟΙΧΤΑ ΕΡΩΤΗΜΑΤΑ

> **Σημείωση**: Τα παρακάτω 10 ερωτήματα είναι **ΑΝΟΙΧΤΑ** και χρειάζονται απόφαση από τον Γιώργο.
> Κάθε ερώτημα έχει **Προτεινόμενη Απόφαση** (σε κεντρικοποιημένη αρχιτεκτονική).

---

### Ερώτημα 1: Scope Βεβαίωσης

**Ερώτηση**: Η βεβαίωση αφορά **ένα μόνο τιμολόγιο** (per-invoice) ή **πολλά τιμολόγια ανά πελάτη/έτος** (annual grouped)?

**Επιλογές**:

| | Per-Invoice | Annual Grouped |
|--|-------------|----------------|
| **Πότε** | Αμέσως μετά κάθε ΤΠΥ | 1 φορά/χρόνο, ανά πελάτη |
| **Φορολογική Χρήση** | Επισυνάπτεται ανά τιμολόγιο στον πελάτη | Ετήσια φορολογική αντιστοίχιση |
| **Πολυπλοκότητα** | Απλή — 1:1 με τιμολόγιο | Μέτρια — aggregation logic |
| **Πρακτικότητα** | Ο πελάτης θέλει ένα doc ανά πληρωμή | Η ΑΑΔΕ δέχεται και τα δύο |
| **Υλοποίηση** | Phase 1 — άμεσα | Phase 1 ή 2 |

**✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΠΟΦΑΣΗ**: **Annual Grouped** (ανά πελάτη + φορολογικό έτος)

**Γιατί**: Αυτό αντιστοιχεί στον τρόπο που ο Γιώργος χρησιμοποιεί τις παρακρατήσεις στη φορολογική δήλωση (ετήσιο σύνολο). Το `WithholdingReconciliation` που ήδη υπάρχει έχει ακριβώς αυτή τη δομή. Μία βεβαίωση ανά πελάτη ανά έτος = ένα document, μηδέν duplication.

**📌 STATUS**: ✅ ΑΠΟΦΑΣΗ 2026-03-17 — Γιώργος Παγώνης → **Annual Grouped** (ανά πελάτη + φορολογικό έτος)

---

### Ερώτημα 2: `withholdingAmount` στο Invoice

**Ερώτηση**: Το ποσό παρακράτησης αποθηκεύεται ως **πεδίο στο Invoice** ή υπολογίζεται **on-the-fly** (totalNetAmount × 20%)?

**Επιλογές**:

| | Stored field | On-the-fly calculation |
|--|-------------|------------------------|
| **Ευελιξία** | Διαφορετικοί συντελεστές ανά τιμολόγιο (3%, 20%) | Μόνο 20% (hardcoded) |
| **Ακρίβεια** | Source of truth — ο χρήστης ορίζει | Δεν λαμβάνει υπόψη εξαιρέσεις |
| **Complexity** | +2 optional fields στο `Invoice` interface | Zero code change στο `Invoice` |
| **Storage** | +8 bytes/doc | 0 bytes |

**✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΠΟΦΑΣΗ**: **Stored fields** — `withholdingRate?: number` + `withholdingAmount?: number`

```typescript
// types/invoice.ts — προσθήκη στο Invoice interface
// — Παρακράτηση Φόρου (ADR-ACC-020) —
/**
 * Συντελεστής παρακράτησης φόρου (%).
 * Τυπικά 20 (ΤΠΥ) ή 3 (κατασκευή). Null αν δεν εφαρμόζεται.
 * Optional — backward compatible με existing invoices.
 */
withholdingRate?: number | null;
/**
 * Ποσό παρακράτησης (= totalNetAmount × withholdingRate / 100).
 * Αποθηκεύεται ως snapshot — ανεξάρτητο από μελλοντικές αλλαγές συντελεστή.
 */
withholdingAmount?: number | null;
```

**Γιατί**: Snapshot pattern (ίδιο με `InvoiceIssuer` στο ADR-ACC-018) — τα ποσά δεν αλλάζουν μετά την έκδοση. Επίσης, 3% για κατασκευαστικές εργασίες χρειάζεται stored field (βλ. Ερώτημα 9).

**📌 STATUS**: ✅ ΑΠΟΦΑΣΗ 2026-03-17 — Γιώργος Παγώνης → **Stored fields** (`withholdingRate?` + `withholdingAmount?` στο `Invoice` interface)

---

### Ερώτημα 3: Ρόλος Γιώργου — Εκδότης ή Αποδέκτης

**Ερώτηση**: Ο Γιώργος:
- (Α) **Εκδίδει** βεβαίωση παρακράτησης και τη **στέλνει στον πελάτη** (ο Γιώργος παρακρατεί από τον εκδότη); ή
- (Β) **Λαμβάνει** βεβαίωση από τον πελάτη και την **καταγράφει** στο σύστημα (tracking received)?

> **Νομική διευκρίνιση**: Σε ΤΠΥ, ο **πελάτης** είναι αυτός που παρακρατεί (υπόχρεος) και εκδίδει βεβαίωση προς τον **πάροχο** (Γιώργο). Άρα ο Γιώργος είναι **ΑΠΟΔΕΚΤΗΣ** της βεβαίωσης.

**Επιλογές**:

| | (Α) Εκδότης | (Β) Αποδέκτης / Tracking |
|--|-------------|--------------------------|
| **Νομική ορθότητα** | ❌ Λάθος — δεν εκδίδει ο πάροχος | ✅ Σωστό |
| **Πρακτική χρήση** | Πιθανώς για reminder / άτυπο doc | Καταγραφή παρακράτησης που έλαβε |
| **Φορολογική δήλωση** | — | ✅ Αποδεικτικό για credit έναντι φόρου |

**✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΠΟΦΑΣΗ**: **Επιλογή (Β) — Tracking received certificates**

Η εφαρμογή καταγράφει βεβαιώσεις που **λαμβάνει** ο Γιώργος από πελάτες. Optionally: αποστολή reminder email στον πελάτη αν δεν έχει στείλει τη βεβαίωση.

**📌 STATUS**: ✅ ΑΠΟΦΑΣΗ 2026-03-17 — Γιώργος Παγώνης → **(Α) + (Β) μαζί**: Tracking received certificates + sending reminders. **(Γ) έκδοση βεβαίωσης προς υπεργολάβους** → Future Extension (βλ. §9).

---

### Ερώτημα 4: Storage Strategy

**Ερώτηση**: Ξεχωριστή Firestore collection (`accounting_apy_certificates`) ή **embedded** στο Invoice document?

**Επιλογές**:

| | Ξεχωριστή Collection | Embedded στο Invoice |
|--|---------------------|----------------------|
| **Ανεξαρτησία** | ✅ Independent lifecycle | ❌ Δεμένη με ένα invoice |
| **Annual Grouped** | ✅ Ένα doc περιέχει N invoices | ❌ Imossible — scattered |
| **Query** | `where('customerId', '==', x).where('fiscalYear', '==', 2025)` | N invoice reads |
| **Complexity** | Νέα collection + enterprise ID + repo methods | Minimal diff |
| **Reuse existing ID** | `apy_` prefix (νέος) | Invoice ID |

**✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΠΟΦΑΣΗ**: **Ξεχωριστή collection** `accounting_apy_certificates`

**Γιατί**: Αν υιοθετηθεί Annual Grouped (Ερώτημα 1), η βεβαίωση αφορά πολλά τιμολόγια — δεν μπορεί να είναι embedded σε ένα. Separate lifecycle: η βεβαίωση έχει ημερομηνία έκδοσης, αρχείο PDF, email history — ξέχωρα από τα invoices.

**📌 STATUS**: ✅ ΑΠΟΦΑΣΗ 2026-03-17 — Γιώργος Παγώνης → **Ξεχωριστή collection** `accounting_apy_certificates`

---

### Ερώτημα 5: Rate Limiting

**Ερώτηση**: Ποιο rate limit για το APY send-email endpoint?

**Επιλογές**:

| | `withStandardRateLimit` (60/min) | `withSensitiveRateLimit` (20/min) |
|--|----------------------------------|-----------------------------------|
| **Χρήση** | Read-heavy operations | Side-effects (email, SMS) |
| **ADR-ACC-019 precedent** | — | ✅ `withSensitiveRateLimit` για invoices |
| **Consistency** | ❌ | ✅ |

**✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΠΟΦΑΣΗ**: `withSensitiveRateLimit` (20/min) — ίδιο με ADR-ACC-019

**Γιατί**: Email αποστολή = side-effect = sensitive operation. Consistency με υπάρχον pattern.

**📌 STATUS**: ✅ ΞΕΚΑΘΑΡΟ — Δεν χρειάζεται απόφαση

---

### Ερώτημα 6: PDF Layout

**Ερώτηση**: Απλή **single-page** βεβαίωση ή **multi-invoice table** (πίνακας με όλα τα ΤΠΥ του χρόνου)?

**Επιλογές**:

| | Single-page | Multi-invoice table |
|--|-------------|---------------------|
| **Περιεχόμενο** | Ένα τιμολόγιο, ένα ποσό, μια υπογραφή | Πίνακας: Α/Α, Αριθμός ΤΠΥ, Ημ/νία, Καθαρό Ποσό, Παρακράτηση |
| **Χρήση** | Per-invoice scope | Annual grouped scope |
| **Νομική Αξία** | Επαρκής | Πληρέστερη |
| **Complexity** | Χαμηλή — 1 page, 5-6 fields | Μέτρια — dynamic table, pagination |
| **jsPDF** | Trivial | Υπαρκτό pattern (βλ. `drawTotalsSection`) |

**✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΠΟΦΑΣΗ**: **Multi-invoice table** (αν Annual Grouped από Ερώτημα 1)

```
ΒΕΒΑΙΩΣΗ ΠΑΡΑΚΡΑΤΗΣΗΣ ΦΟΡΟΥ
Φορολογικό Έτος 2025
Εκδότης: Παγώνης Ενεργειακή (ΑΦΜ: ...)
Αποδέκτης: [Εταιρεία Πελάτη] (ΑΦΜ: ...)
─────────────────────────────────────────────
Α/Α | Αρ. ΤΠΥ | Ημερομηνία | Καθαρό Ποσό | Παρακράτηση
 1  | Α-042   | 17/03/2025 |  €1.000,00  |   €200,00
 2  | Α-051   | 15/05/2025 |  €2.000,00  |   €400,00
─────────────────────────────────────────────
ΣΥΝΟΛΟ ΠΑΡΑΚΡΑΤΗΣΗΣ 2025:     €600,00
─────────────────────────────────────────────
```

**📌 STATUS**: ✅ ΑΠΟΦΑΣΗ 2026-03-17 — Γιώργος Παγώνης → **Multi-invoice table** (πίνακας ανά ΤΠΥ + σύνολο παρακρατήσεων έτους)

---

### Ερώτημα 7: UI Placement

**Ερώτηση**: Πού θα βρίσκεται η διαχείριση βεβαιώσεων στο UI?

**Επιλογές**:

| | Ξεχωριστή Σελίδα | Button στο InvoiceDetails | Tab στο Tax Section |
|--|-----------------|--------------------------|---------------------|
| **URL** | `/accounting/apy-certificates` | N/A — modal | `/accounting/tax?tab=withholding` |
| **Navigation** | Νέο sidebar item | Δεν χρειάζεται | Ενσωματωμένο σε Tax |
| **Discovery** | Εύκολο | Κρυμμένο | Λογικό placement |
| **Scope** | Cross-invoice view | Per-invoice | Annual view |
| **Consistency** | ✅ Ακολουθεί existing pattern | — | — |

**✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΠΟΦΑΣΗ**: **Ξεχωριστή σελίδα** `/accounting/apy-certificates`

**Γιατί**: Annual view χρειάζεται cross-invoice aggregation — δεν ανήκει σε ένα InvoiceDetails. Sidebar item δίπλα στο "Τιμολόγια". Εναλλακτικά shortcut button στο InvoiceDetails → navigate to certificates page pre-filtered για αυτό το τιμολόγιο.

**📌 STATUS**: ✅ ΑΠΟΦΑΣΗ 2026-03-17 — Γιώργος Παγώνης → **Ξεχωριστή σελίδα** `/accounting/apy-certificates` + shortcut link από InvoiceDetails pre-filtered ανά πελάτη

---

### Ερώτημα 8: Fiscal Year Scope

**Ερώτηση**: Μία βεβαίωση ανά φορολογικό έτος ανά πελάτη ή unlimited?

**Επιλογές**:

| | 1 ανά έτος/πελάτη | Unlimited |
|--|-------------------|-----------|
| **Uniqueness** | Εύκολος έλεγχος duplicate | Χρειάζεται versioning |
| **Amendment** | Δύσκολο — αντικατάσταση ή τροποποίηση | Νέο doc κάθε φορά |
| **Νομική χρήση** | Standard ΑΑΔΕ format | — |
| **Resend** | Ίδιο doc, νέο `emailHistory` entry | Νέο doc με ίδια data |

**✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΠΟΦΑΣΗ**: **1 ανά πελάτη ανά φορολογικό έτος** — με resend επιτρεπτό

```typescript
// Unique constraint (Firestore rule):
// accounting_apy_certificates/{fiscalYear}_{customerVatNumber}
// Ή: query check before creation
```

**Εφόσον υπάρχει ήδη** → επιτρέπεται resend (νέο `emailHistory` entry), αλλά **δεν** δημιουργείται νέο certificate doc.

**📌 STATUS**: ✅ ΞΕΚΑΘΑΡΟ — Δεν χρειάζεται απόφαση

---

### Ερώτημα 9: Withholding Rates

**Ερώτηση**: Μόνο **20%** (τυπικό ΤΠΥ) ή και **3%** (κατασκευαστικές/τεχνικές εργασίες)?

**Νομικό πλαίσιο**:
- `20%` → Ν. 4172/2013 άρθρο 64 παρ. 1 — Υπηρεσίες
- `3%` → Ν. 4172/2013 άρθρο 64 παρ. 2 — Κατασκευαστικές εργασίες, τεχνικά έργα
- `1%` → Αμοιβές πωλητών/αντιπροσώπων — Phase 2+

**✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΠΟΦΑΣΗ**: **Και οι δύο (20% + 3%)** — stored field `withholdingRate` (Ερώτημα 2)

**Γιατί**: Η εταιρεία Παγώνης ασχολείται με κατασκευαστικά έργα → 3% είναι πιθανός συντελεστής. Με stored `withholdingRate` o χρήστης επιλέγει ανά τιμολόγιο.

```typescript
// Dropdown στο InvoiceForm:
// "Παρακράτηση Φόρου": Καμία | 3% (Κατασκευαστικές) | 20% (Υπηρεσίες)
```

**📌 STATUS**: ✅ ΑΠΟΦΑΣΗ 2026-03-17 — Γιώργος Παγώνης → **Configurable dropdown** με όλους τους νόμιμους συντελεστές: 0% (Καμία), 1% (Αντιπρόσωποι), 3% (Κατασκευαστικές εργασίες), 20% (Υπηρεσίες ΤΠΥ)

---

### Ερώτημα 10: Resend Policy

**Ερώτηση**: Επιτρέπεται resend (reminder) βεβαίωσης αν ο πελάτης δεν έχει αποστείλει;

> **Note**: Αφορά το σενάριο (Β) από Ερώτημα 3 — ο Γιώργος στέλνει **reminder** στον πελάτη να του αποστείλει τη βεβαίωση. ΌΧΙ να αποστείλει ο ίδιος τη βεβαίωση.

**✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΠΟΦΑΣΗ**: **Επιτρέπεται resend** — ίδια πολιτική με ADR-ACC-019

Κάθε αποστολή καταγράφεται στο `emailHistory` array του `APYCertificate` doc. Audit trail covers accountability.

**📌 STATUS**: ✅ ΞΕΚΑΘΑΡΟ — Δεν χρειάζεται απόφαση

---

## 5. Προτεινόμενη Αρχιτεκτονική

> **ΠΡΟΫΠΌΘΕΣΗ**: Η παρακάτω αρχιτεκτονική βασίζεται στις ΠΡΟΤΕΙΝΌΜΕΝΕΣ αποφάσεις.
> Μπορεί να τροποποιηθεί ανάλογα με τις τελικές αποφάσεις του Γιώργου.

### 5.1 Data Model

#### `APYCertificate` — Νέο Interface

```typescript
// ΤΟΠΟΘΕΣΙΑ: src/subapps/accounting/types/apy-certificate.ts (νέο)
// ΄Η: επέκταση του src/subapps/accounting/types/tax.ts

export interface APYCertificateLineItem {
  /** Firestore ID του τιμολογίου */
  invoiceId: string;
  /** Αριθμός τιμολογίου (display: "Α-042") */
  invoiceNumber: string;
  /** Ημερομηνία έκδοσης (ISO 8601) */
  issueDate: string;
  /** Καθαρό ποσό τιμολογίου */
  netAmount: number;
  /** Συντελεστής παρακράτησης (%) */
  withholdingRate: number;
  /** Ποσό παρακράτησης */
  withholdingAmount: number;
}

export interface APYCertificate {
  /** Μοναδικό ID (enterprise: "apy_2025_001") */
  certificateId: string;

  // — Φορολογικό Έτος —
  /** Φορολογικό έτος (π.χ. 2025) */
  fiscalYear: number;

  // — Εκδότης (Γιώργος — snapshot) —
  /** Στοιχεία παρόχου (ο Γιώργος) */
  provider: {
    name: string;
    vatNumber: string;
    taxOffice: string;
    address: string;
    city: string;
    postalCode: string;
    profession: string;
  };

  // — Αποδέκτης (Πελάτης που παρακράτησε) —
  /** Firestore contact ID */
  customerId: string | null;
  /** Στοιχεία πελάτη (snapshot) */
  customer: {
    name: string;
    vatNumber: string;
    taxOffice: string | null;
    address: string | null;
    city: string | null;
  };

  // — Τιμολόγια —
  /** Γραμμές τιμολογίων που περιλαμβάνει η βεβαίωση */
  lineItems: APYCertificateLineItem[];

  // — Σύνολα —
  /** Σύνολο καθαρών ποσών */
  totalNetAmount: number;
  /** Σύνολο παρακρατήσεων */
  totalWithholdingAmount: number;

  // — Κατάσταση —
  /** Έχει ληφθεί η βεβαίωση από τον πελάτη; */
  isReceived: boolean;
  /** Ημερομηνία λήψης (ISO 8601, null αν όχι ακόμα) */
  receivedAt: string | null;

  // — Email History (ADR-ACC-019 pattern) —
  /** Ιστορικό αποστολών reminder email */
  emailHistory?: APYEmailSendRecord[];

  // — Metadata —
  /** Σημειώσεις */
  notes: string | null;
  /** Timestamp δημιουργίας */
  createdAt: string;
  /** Timestamp τελευταίας ενημέρωσης */
  updatedAt: string;
}

/** Καταγραφή αποστολής reminder email (ίδιο pattern με EmailSendRecord) */
export interface APYEmailSendRecord {
  sentAt: string;
  recipientEmail: string;
  subject: string;
  mailgunMessageId: string | null;
  status: 'sent' | 'failed';
  error: string | null;
}
```

#### Επέκταση `Invoice` Interface

```typescript
// types/invoice.ts — 2 νέα optional fields (backward compatible)
// — Παρακράτηση Φόρου (ADR-ACC-020) —
withholdingRate?: number | null;    // 20 ή 3 (%)
withholdingAmount?: number | null;  // totalNetAmount × withholdingRate / 100
```

### 5.2 Firestore Collection

```typescript
// src/config/firestore-collections.ts
ACCOUNTING_APY_CERTIFICATES: 'accounting_apy_certificates',
// Path: accounting_apy_certificates/{certificateId}
// Index: (customerId, fiscalYear, createdAt)
// Index: (fiscalYear, isReceived, createdAt)
```

### 5.3 Enterprise ID

```typescript
// src/services/enterprise-id.service.ts — νέος prefix
generateApyCertificateId(): string  // "apy_2025_042"
// Pattern: "apy_{year}_{counter}"
```

### 5.4 Flow Diagram

```
                    ┌─────────────────────────────────────────┐
                    │        ΔΗΜΙΟΥΡΓΙΑ ΒΕΒΑΙΩΣΗΣ             │
                    └─────────────────────────────────────────┘
                                        │
              User: /accounting/apy-certificates → [+ Νέα Βεβαίωση]
                                        │
              CreateAPYCertificateDialog:
                - Select customer (Firestore contacts)
                - Select fiscal year (default: current)
                - Auto-fetch ΤΠΥ for that customer+year
                  (invoices with withholdingAmount > 0)
                - Preview: table with all matching invoices
                - [Δημιουργία]
                                        │
              POST /api/accounting/apy-certificates
                - Auth + Rate limit
                - Create APYCertificate doc (enterprise ID)
                - Set isReceived: false
                - Return certificateId
                                        │
              APYCertificateDetails page:
                - Display certificate info
                - [📥 Ελήφθη] → isReceived: true
                - [📄 PDF] → download PDF
                - [📧 Reminder] → send email to customer
                                        │
                    ┌─────────────────────────────────────────┐
                    │     ΑΠΟΣΤΟΛΗ REMINDER EMAIL             │
                    └─────────────────────────────────────────┘
                                        │
              POST /api/accounting/apy-certificates/[id]/send-email
                - Auth + withSensitiveRateLimit
                - Fetch APYCertificate
                - Generate PDF (apy-certificate-pdf-exporter.ts)
                - Build email HTML (apy-certificate-email-template.ts)
                - wrapInBrandedTemplate()
                - sendReplyViaMailgun({ to, subject, textBody, htmlBody,
                    attachments: [{ filename, content, contentType }] })
                - Update: push APYEmailSendRecord to emailHistory
                - Return { success, mailgunMessageId }
```

---

## 6. Implementation Plan

### Φάση 1: Data Foundation (ΠΡΟΤΕΡΑΙΟΤΗΤΑ — ~2h)

| # | Αρχείο | Αλλαγή | Εκτ. γραμμές |
|---|--------|--------|-------------|
| 1 | `src/subapps/accounting/types/invoice.ts` | +`withholdingRate?`, +`withholdingAmount?` στο `Invoice` | ~10 |
| 2 | `src/subapps/accounting/types/apy-certificate.ts` _(νέο)_ | `APYCertificate`, `APYCertificateLineItem`, `APYEmailSendRecord` | ~80 |
| 3 | `src/config/firestore-collections.ts` | +`ACCOUNTING_APY_CERTIFICATES` constant | ~3 |
| 4 | `src/services/enterprise-id.service.ts` | +`generateApyCertificateId()` + prefix `apy_` | ~5 |

### Φάση 2: PDF Template (~3h)

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 5 | `src/subapps/accounting/services/pdf/apy-certificate-pdf-template.ts` _(νέο)_ | jsPDF template: reuse `COLORS`, `LAYOUT`, `drawHeader()`, invoice table |
| 6 | `src/subapps/accounting/services/pdf/apy-certificate-pdf-exporter.ts` _(νέο)_ | `getAPYCertificatePDFBlob()`, `exportAPYCertificatePDF()` |

### Φάση 3: Email Template (~1h)

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 7 | `src/subapps/accounting/services/email/apy-certificate-email-template.ts` _(νέο)_ | `buildAPYEmailContent()`, subject, plain text — bilingual (GR/EN) |

### Φάση 4: Repository & API (~3h)

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 8 | Repository interface | +`createAPYCertificate()`, +`getAPYCertificate()`, +`listAPYCertificates()`, +`updateAPYCertificate()` |
| 9 | Repository implementation | Implement 4 methods |
| 10 | `src/app/api/accounting/apy-certificates/route.ts` _(νέο)_ | `POST` (create) + `GET` (list) |
| 11 | `src/app/api/accounting/apy-certificates/[id]/route.ts` _(νέο)_ | `GET` (detail) + `PATCH` (isReceived update) |
| 12 | `src/app/api/accounting/apy-certificates/[id]/send-email/route.ts` _(νέο)_ | `POST` (send reminder email) — ίδιο pattern με ADR-ACC-019 |

### Φάση 5: UI (~4h)

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 13 | `src/subapps/accounting/components/apy-certificates/` _(νέο folder)_ | `APYCertificatesList.tsx`, `APYCertificateDetails.tsx`, `CreateAPYCertificateDialog.tsx`, `SendReminderEmailDialog.tsx` |
| 14 | Accounting navigation | +νέο sidebar item "Βεβαιώσεις Παρακράτησης" |
| 15 | `src/app/(protected)/accounting/apy-certificates/page.tsx` _(νέο)_ | List page |
| 16 | `src/app/(protected)/accounting/apy-certificates/[id]/page.tsx` _(νέο)_ | Detail page |

### Φάση 6: ADR Update (Φάση 3 — ADR-Driven Workflow)

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 17 | `ADR-ACC-020-withholding-tax-certificate.md` | Status: PROPOSED → IMPLEMENTED |
| 18 | `ADR-ACC-002-invoicing-system.md` | Προσθήκη mention για withholdingRate/Amount fields |
| 19 | `ADR-ACC-009-tax-engine.md` | Link προς ADR-ACC-020 |
| 20 | `docs/centralized-systems/reference/adr-index.md` | +ADR-ACC-020 entry |

---

## 7. Zero New Dependencies

| Dependency | Πηγή | Σκοπός |
|-----------|------|--------|
| `jsPDF` | ΗΔΗ ΕΓΚΑΤΕΣΤΗΜΕΝΗ (ADR-ACC-018) | PDF generation |
| `sendReplyViaMailgun()` | ΗΔΗ ΥΠΑΡΧΕΙ (ADR-ACC-019) | Email sending + attachments |
| `wrapInBrandedTemplate()` | ΗΔΗ ΥΠΑΡΧΕΙ | Email HTML wrapper |
| `withAuth`, `withSensitiveRateLimit` | ΗΔΗ ΥΠΑΡΧΟΥΝ | Auth + rate limiting |
| Radix UI Dialog, Table | ΗΔΗ ΕΓΚΑΤΕΣΤΗΜΕΝΑ | UI components |

**Κανένα νέο npm πακέτο.**

---

## 8. Security & Edge Cases

### 8.1 Security

| Θέμα | Μέτρο |
|------|-------|
| Email content injection | `escapeHtml()` σε όλο το dynamic content (ADR-ACC-019 pattern) |
| Rate abuse (email spam) | `withSensitiveRateLimit` 20/min |
| Unauthorized access | `withAuth` — μόνο ο ιδιοκτήτης |
| PDF data accuracy | Server-side generation — zero client trust |

### 8.2 Edge Cases

| Scenario | Αντιμετώπιση |
|----------|-------------|
| Τιμολόγια χωρίς `withholdingAmount` | Φιλτράρισμα κατά `withholdingAmount > 0` |
| Πελάτης χωρίς email | Empty input στο dialog — ο χρήστης πληκτρολογεί |
| Duplicate certificate (ίδιο έτος/πελάτης) | Έλεγχος before creation + error message |
| ΤΠΥ ακυρωμένο (credit_invoice) | Εξαίρεση credit invoices από aggregation |
| Μερικές πληρωμές (partial) | Παρακράτηση βάσει τιμολογίου, όχι πληρωμής |
| Φορολογικός έλεγχος (ΑΑΔΕ) | PDF + email history = αποδεικτικό |

---

## 9. Future Extensions

| Feature | Προτεραιότητα |
|---------|-------------|
| Import PDF βεβαίωσης από πελάτη (αρχείο → attach στο doc) | HIGH |
| Auto-alert αν βεβαίωση δεν ληφθεί εντός X ημερών | MEDIUM |
| Bulk send (πολλοί πελάτες ταυτόχρονα) | MEDIUM |
| Export προς λογιστή (ZIP με όλες τις βεβαιώσεις έτους) | MEDIUM |
| Σύνδεση με myDATA ΑΑΔΕ electronic submission | LOW (Phase 3) |
| 1% rate (αντιπρόσωποι/πωλητές) | LOW |
| Αυτόματη δημιουργία βεβαίωσης μετά πληρωμή τιμολογίου | LOW |
| **(Γ) Έκδοση βεβαίωσης προς υπεργολάβους** — όταν ο Γιώργος παρακρατεί φόρο από δικούς του προμηθευτές/υπεργολάβους και εκδίδει βεβαίωση προς αυτούς | FUTURE |

---

## 10. Changelog

| Date | Decision | Author |
|------|----------|--------|
| 2026-03-17 | ADR-ACC-020 Created — Βεβαίωση Παρακράτησης Φόρου architecture, 10 ερωτήματα αρχιτεκτονικής (3 ξεκάθαρα, 7 pending), full implementation plan (6 φάσεις, 20 αρχεία) | Claude Code |
| 2026-03-17 | Όλα τα ανοιχτά ερωτήματα αποφασίστηκαν από τον Γιώργο Παγώνη: (1) Annual Grouped, (2) Stored fields withholdingRate+Amount, (3) Tracking received + reminders / (Γ) future, (4) Ξεχωριστή collection, (6) Multi-invoice table PDF, (7) Ξεχωριστή σελίδα + shortcut από InvoiceDetails, (9) Configurable dropdown 0%/1%/3%/20%. Status: PROPOSED → READY FOR IMPLEMENTATION | Γιώργος Παγώνης + Claude Code |
| 2026-03-17 | IMPLEMENTED — Full implementation complete. 20 αρχεία: types/apy-certificate.ts, firestore-collections.ts (ACCOUNTING_APY_CERTIFICATES), enterprise-id.service.ts (apy_ prefix), services/pdf/apy-certificate-pdf-template.ts + apy-certificate-pdf-exporter.ts, services/email/apy-certificate-email-template.ts, types/interfaces.ts (5 repository methods), firestore-accounting-repository.ts (5 methods), api/apy-certificates/route.ts (GET+POST), api/apy-certificates/[id]/route.ts (GET+PATCH), api/apy-certificates/[id]/send-email/route.ts (POST), hooks/useAPYCertificates.ts, components/APYCertificatesList.tsx, CreateAPYCertificateDialog.tsx, APYCertificateDetails.tsx, SendReminderEmailDialog.tsx, APYCertificatesPageContent.tsx, app/accounting/apy-certificates/page.tsx, lazyRoutes.tsx (+AccountingAPYCertificates), smart-navigation-factory.ts (+ClipboardCheck icon, +apyCertificates nav), i18n el+en (+apyCertificates key), InvoiceForm.tsx (+withholdingRate dropdown), InvoiceDetails.tsx (+shortcut banner). Status: IMPLEMENTED | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
