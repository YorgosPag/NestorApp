# ADR-ACC-018: Invoice PDF Generation — Δημιουργία PDF Τιμολογίων

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-03-17 |
| **Category** | Accounting / Invoicing / PDF Export |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-002](./ADR-ACC-002-invoicing-system.md) — Invoicing System |
| **Related** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) — Founding Decision |
| **Related** | [ADR-ACC-003](./ADR-ACC-003-mydata-aade-integration.md) — myDATA Integration |
| **Module** | M-003: Invoicing (Extension) |

---

## 1. Context

Η τιμολόγηση (ACC-002) είναι πλήρως υλοποιημένη: CRUD, line items, VAT, withholding tax, σειρές αρίθμησης, CRM integration. Ωστόσο **λείπει η δημιουργία PDF** — κρίσιμη λειτουργία για:

- **Καθημερινή χρήση**: Αποστολή τιμολογίου σε πελάτη
- **Νομική υποχρέωση**: Φύλαξη παραστατικών σε εκτυπώσιμη μορφή
- **myDATA**: Μετά την αποδοχή (MARK), το PDF πρέπει να περιέχει τον αριθμό MARK
- **Αποστολή email**: Prerequisite — χωρίς PDF δεν υπάρχει attachment (ACC-002 §7.1, βήμα 5)

### Τρέχουσα κατάσταση

- `InvoiceActionsMenu.tsx` — 3 placeholder buttons (Print, Download, Email) **χωρίς handlers**
- `InvoicePreview.tsx` — Βασικό preview (σύνολα + VAT breakdown), **ΟΧΙ πλήρες template**
- ADR-ACC-002 §8 — PDF layout σχεδιασμένο αλλά **μη υλοποιημένο**

---

## 2. Υπάρχουσα Υποδομή (Centralized Systems — ΕΠΑΝΑΧΡΗΣΗ)

### 2.1 PDF Libraries (ΗΔΗ εγκατεστημένες — `package.json`)

| Library | Version | License | Σκοπός | Χρήση στο project |
|---------|---------|---------|--------|--------------------|
| **jsPDF** | 3.0.3 | MIT | Client/Server PDF generation | Gantt export, Milestone export, Obligations |
| **jspdf-autotable** | 5.0.2 | MIT | Table rendering σε PDF | Gantt export (task tables) |
| **pdf-lib** | 1.17.1 | MIT | Low-level PDF manipulation | `/api/files/generate-pdf`, watermarking |
| **html-to-image** | 1.11.13 | MIT | DOM → PNG/SVG capture | Gantt image export |

**Δεν χρειάζεται νέο npm package.**

### 2.2 Company Logo (ΥΠΑΡΧΕΙ)

| Αρχείο | Τι είναι |
|--------|----------|
| `Pagonis Energeiaki. Logo.png` (project root) | Logo "PAGONIS energo — ΕΝΕΡΓΕΙΑΚΗ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε." |

- Εμφανίζεται **πάνω αριστερά** στο PDF header, δίπλα στα στοιχεία εκδότη
- Μέγεθος στο PDF: ~60×60 pt (scaled proportionally)
- Φορτώνεται ως base64 data URL για embedding στο jsPDF (`pdf.addImage()`)
- **Σημείωση**: Το logo πρέπει να μετατραπεί σε base64 string κατά το build ή να φορτωθεί runtime

### 2.3 Greek Font Support (ΥΠΑΡΧΕΙ)


| Αρχείο | Τι κάνει |
|--------|----------|
| `src/services/gantt-export/roboto-font-data.ts` | Roboto Regular + Bold, base64 encoded (~687KB) |

**Pattern** (από `gantt-pdf-exporter.ts`):
```typescript
// Εγγραφή Roboto font για ελληνικούς χαρακτήρες
pdf.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', undefined, 'Identity-H');
// Χωρίς Identity-H → τα ελληνικά φαίνονται ως σκουπίδια
```

### 2.3 Formatting Utilities (ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ)

| Αρχείο | Functions | Χρήση |
|--------|-----------|-------|
| `src/lib/intl-utils.ts` | `formatCurrency()`, `formatDate()`, `formatPercentage()` | Centralized, locale-aware (el default) |
| `src/subapps/accounting/utils/format.ts` | `formatCurrency()` (EUR, 2 decimals), `formatDate()` | Thin wrappers για accounting |
| `src/lib/date-local.ts` | `normalizeToDate()`, `normalizeToISO()` | Firestore Timestamp → Date |

### 2.4 Existing PDF Export Services (PATTERNS)

| Service | Location | Pattern |
|---------|----------|---------|
| **GanttPDFExporter** | `src/services/gantt-export/gantt-pdf-exporter.ts` | jsPDF + Roboto font + AutoTable + download trigger |
| **MilestonePDFExporter** | `src/services/milestone-export/milestone-pdf-exporter.ts` | jsPDF + header + stats boxes + progress bars + page footers |
| **PDFExportService** | `src/services/pdf/PDFExportService.ts` | Adapter pattern (JSPDFAdapter), composable renderers |
| **ObligationsPDF** | `src/components/obligations/pdf.ts` | quickExport, customExport, preview, print helpers |

### 2.5 Download Infrastructure (ΥΠΑΡΧΕΙ)

| Route | Method | Σκοπός |
|-------|--------|--------|
| `/api/download` | GET | Firebase Storage proxy, UTF-8 Greek filenames |
| `/api/files/generate-pdf` | POST | HTML → PDF (pdf-lib, A4) |
| `/api/files/batch-download` | POST | ZIP πολλαπλών αρχείων |

### 2.6 Middleware (ΥΠΑΡΧΕΙ)

| Middleware | Location | Σκοπός |
|------------|----------|--------|
| `withAuth` | `src/lib/auth/` | Authentication check |
| `withHeavyRateLimit` | `src/lib/middleware/with-rate-limit.ts` | Rate limiting for heavy operations |

---

## 3. Invoice PDF — Σχεδιασμός Template

### 3.1 Layout (από ADR-ACC-002 §8.1 — ΕΓΚΕΚΡΙΜΕΝΟ)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [LOGO]                              ΤΙΤΛΟΣ         │
│  PAGONIS energo                      ΠΑΡΑΣΤΑΤΙΚΟΥ    │
│  ─────────────────                                   │
│  Παγώνης Νέστ. Γεώργιος                             │
│  Αρχιτέκτων Μηχανικός               Σειρά: Α       │
│  ΑΦΜ: xxxxxxxxx                     Αρ.: 42        │
│  ΔΟΥ: xxxxxxxx                      Ημ/νία: ...    │
│                                     Λήξη: ...      │
│  Σαμοθράκης 16, 563 34                              │
│  Ελευθέριο Κορδελιό, Θεσσαλονίκη                   │
│  Τ: 2310 55 95 95 | Μ: 6974 050 023                │
│                                                     │
│─────────────────────────────────────────────────────│
│                                                     │
│  ΠΕΛΑΤΗΣ (Customer)                                  │
│  ─────────────────                                   │
│  Επωνυμία: ...                                       │
│  ΑΦΜ: ...                ΔΟΥ: ...                   │
│  Διεύθυνση: ...                                      │
│                                                     │
│─────────────────────────────────────────────────────│
│                                                     │
│  ΓΡΑΜΜΕΣ ΤΙΜΟΛΟΓΙΟΥ (Line Items Table)               │
│  ┌───┬───────────────┬─────┬────┬───────┬─────┬────┬────────┐│
│  │ # │ Περιγραφή     │ Μ.Μ.│Ποσ.│ Τιμή  │ Έκπ.│ΦΠΑ│ Σύνολο ││
│  ├───┼───────────────┼─────┼────┼───────┼─────┼────┼────────┤│
│  │ 1 │ Ενεργ. Πιστ.  │ τεμ.│  1 │500,00 │  —  │ 24%│ 500,00 ││
│  │ 2 │ Τοπογρ. Μελ.  │ τεμ.│  1 │300,00 │ 10% │ 24%│ 270,00 ││
│  └───┴───────────────┴─────┴────┴───────┴─────┴────┴────────┘│
│                                                     │
│  ΣΗΜΕΙΩΣΗ: Στήλη "Έκπ." εμφανίζεται ΜΟΝΟ αν       │
│  τουλάχιστον 1 γραμμή έχει discount > 0.           │
│                                                     │
│─────────────────────────────────────────────────────│
│                                                     │
│  ΣΥΝΟΛΑ / TOTALS (δεξιά στοίχιση)                    │
│                            Καθαρό / Net:    800,00€   │
│                            ΦΠΑ 24% / VAT:  144,00€   │
│                            ΦΠΑ 13% / VAT:   39,00€   │
│                            Μικτό / Gross:   983,00€   │
│                            Παρακρ. 20%:    -160,00€   │
│                            ─────────────────          │
│                            ΠΛΗΡΩΤΕΟ / DUE:  823,00€   │
│                                                      │
│  (ΦΠΑ breakdown: μία γραμμή ΑΝΑ συντελεστή —        │
│   υποχρεωτικό για myDATA compliance)                  │
│                                                     │
│─────────────────────────────────────────────────────│
│                                                     │
│  ΤΡΟΠΟΣ ΠΛΗΡΩΜΗΣ: Τραπεζική κατάθεση                 │
│                                                     │
│  ΤΡΑΠΕΖΙΚΟΙ ΛΟΓΑΡΙΑΣΜΟΙ                              │
│  ┌──────────────────┬───────────────────────────────┐│
│  │ ΕΘΝΙΚΗ ΤΡΑΠΕΖΑ   │ GR68 0110 2230 0000 2234 ... ││
│  │ ΠΕΙΡΑΙΩΣ         │ GR12 0172 0350 0050 3510 ... ││
│  │ ALPHA BANK       │ GR45 0140 1234 1234 0026 ... ││
│  └──────────────────┴───────────────────────────────┘│
│  (Εμφανίζονται ΟΛΟΙ οι καταχωρημένοι λογαριασμοί)   │
│                                                     │
│─────────────────────────────────────────────────────│
│                                                     │
│  myDATA MARK: XXXXXXXXXXXXXXXX (αν accepted)         │
│  ΚΑΔ: 71112000                                       │
│                                                     │
│─────────────────────────────────────────────────────│
│                                                     │
│  ΚΑΤΑΣΤΑΣΗ ΠΛΗΡΩΜΗΣ (visual stamp, κάτω δεξιά)       │
│  ┌─────────────────────┐                             │
│  │  ✓ ΕΞΟΦΛΗΘΗΚΕ       │  ← πράσινο (μόνο αν paid)  │
│  │    PAID              │                             │
│  └─────────────────────┘                             │
│                                                     │
│  ΣΗΜΕΙΩΣΕΙΣ: ...                                     │
│                                                     │
│─────────────────────────────────────────────────────│
│  www.pagonisenergo.gr    info@pagonisenergo.gr       │
│  Σελίδα / Page 1/1                                   │
└─────────────────────────────────────────────────────┘
```

### 3.2 Γλώσσα: Δίγλωσση (Ελληνικά + Αγγλικά)

Όλες οι ετικέτες εμφανίζονται **δίγλωσσα** — ελληνικά πρώτα, αγγλικά από κάτω ή σε παρένθεση.

**Pattern ετικετών:**
```
ΠΕΛΑΤΗΣ / CUSTOMER
Περιγραφή / Description
Ποσότητα / Qty
Καθαρό / Net Amount
ΠΛΗΡΩΤΕΟ / TOTAL DUE
```

### 3.3 Τίτλοι Παραστατικών (ανά τύπο)

| `InvoiceType` | Τίτλος EL | Τίτλος EN | myDATA |
|---------------|-----------|-----------|--------|
| `service_invoice` | ΤΙΜΟΛΟΓΙΟ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ | SERVICE INVOICE | 2.1 |
| `sales_invoice` | ΤΙΜΟΛΟΓΙΟ ΠΩΛΗΣΗΣ | SALES INVOICE | 1.1 |
| `retail_receipt` | ΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ ΠΩΛΗΣΗΣ | RETAIL RECEIPT | 11.1 |
| `service_receipt` | ΑΠΟΔΕΙΞΗ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ | SERVICE RECEIPT | 11.2 |
| `credit_invoice` | ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ | CREDIT NOTE | 5.1 |

### 3.4 Conditional Sections

| Section | Εμφανίζεται όταν |
|---------|-------------------|
| Στήλη "Έκπτωση" στον πίνακα | Τουλάχιστον 1 line item έχει `discount > 0` |
| Στήλη "ΦΠΑ" ανά γραμμή | **Πάντα** — κάθε γραμμή δείχνει τον δικό της συντελεστή |
| Στήλη "Μ.Μ." (Μονάδα Μέτρησης) | **Πάντα** — τεμ., ώρες, τ.μ., κ.α. |
| Παρακράτηση φόρου | `withholdingTaxAmount > 0` |
| myDATA MARK | `mydataStatus === 'accepted'` && `mydataMark !== null` |
| Οδηγίες πληρωμής (λογαριασμοί · αιτιολογία · EPC QR) | `issuer.bankAccounts.length > 0` **και** `showsPaymentInstructions(invoice)` — μόνο τρόπος πληρωμής με μεταφορά (`bank_transfer` · `credit` · `mixed`), ποτέ σε πιστωτικό. Έως 3 λογαριασμοί, ο προεπιλεγμένος πρώτος (§15 — αντικαθιστά το «ΟΛΟΙ, ανεξαρτήτως τρόπου πληρωμής» του 2026-03-17) |
| Payment stamp "ΕΞΟΦΛΗΘΗΚΕ / PAID" | `paymentStatus === 'paid'` — πράσινο visual stamp |
| Payment stamp "ΜΕΡΙΚΗ ΕΞΟΦΛΗΣΗ / PARTIALLY PAID" | `paymentStatus === 'partial'` — πορτοκαλί visual stamp |
| (Τίποτα για pending — default κατάσταση) | `paymentStatus === 'pending'` — κανένα stamp |
| Σημειώσεις | `notes` δεν είναι κενό |
| Ημ/νία ολοκλήρωσης | `serviceDate !== null` && `serviceDate !== issueDate` |
| Ημ/νία πληρωμής | `dueDate !== null` |
| Πιστωτικό — Σχετ. Παραστατικό | `type === 'credit_invoice'` — **ΥΠΟΧΡΕΩΤΙΚΟ** (Ν.4308/2014 ΕΛΠ, αρ.10). Εμφανίζεται κάτω από τον τίτλο: `Σχετ. Παραστατικό: Α-42 (17/03/2026)` |
| Πιστωτικό — Αιτιολογία | `type === 'credit_invoice'` && `creditReason !== null` — **ΠΡΟΑΙΡΕΤΙΚΟ**, μόνο αν συμπληρώθηκε |

---

## 4. Αρχιτεκτονική Υλοποίησης

### 4.1 Approach: Client-Side jsPDF (ΟΧΙ Server)

**Γιατί client-side:**
- Τα δεδομένα τιμολογίου ήδη υπάρχουν στο client (React state)
- Δεν χρειάζεται Vercel serverless timeout
- Instant — χωρίς network round-trip
- Pattern ίδιο με Gantt/Milestone export (δοκιμασμένο)
- Δεν χρειάζεται headless browser (Puppeteer)

**Γιατί ΟΧΙ server-side:**
- Ο server `/api/files/generate-pdf` κάνει simple HTML strip — δεν υποστηρίζει tables/layout
- Puppeteer δεν είναι εγκατεστημένο + Vercel Hobby = 10s timeout
- pdf-lib δεν υποστηρίζει high-level layout (μόνο low-level draw)

### 4.2 Component Architecture

```
┌─────────────────────────────────────────────────────┐
│ InvoiceActionsMenu.tsx (UI Layer)                    │
│   ├── Download → generateInvoicePDF()                │
│   ├── Print   → generateInvoicePDF() → window.print │
│   └── Email   → (Phase 2 — ACC-019 μελλοντικό)      │
└────────────────────────┬────────────────────────────┘
                         │ calls
┌────────────────────────▼────────────────────────────┐
│ invoice-pdf-exporter.ts (Service Layer)              │
│   - Orchestrates PDF generation                      │
│   - Uses InvoicePDFTemplate for layout               │
│   - Triggers download / returns blob                 │
└────────────────────────┬────────────────────────────┘
                         │ uses
┌────────────────────────▼────────────────────────────┐
│ invoice-pdf-template.ts (Template Layer)             │
│   - Page setup (A4, margins)                         │
│   - Section renderers (issuer, customer, lines...)   │
│   - Greek font registration (Roboto)                 │
│   - Auto-pagination                                  │
└────────────────────────┬────────────────────────────┘
                         │ depends on
┌────────────────────────▼────────────────────────────┐
│ CENTRALIZED (Re-use — NO duplication)                │
│   ├── jsPDF + jspdf-autotable (installed)            │
│   ├── roboto-font-data.ts (Greek fonts)              │
│   ├── intl-utils.ts (formatCurrency, formatDate)     │
│   ├── accounting/utils/format.ts (EUR wrappers)      │
│   └── accounting/types/invoice.ts (Invoice types)    │
└─────────────────────────────────────────────────────┘
```

### 4.3 File Structure (Νέα αρχεία)

```
src/subapps/accounting/
  └── services/
      └── pdf/
          ├── invoice-pdf-exporter.ts     ← Orchestrator (export, download, print)
          └── invoice-pdf-template.ts     ← Template renderer (layout, sections)
```

**Γιατί μέσα στο accounting subapp** (όχι στο κεντρικό `src/services/`):
- Portable — αν αποσπαστεί η εφαρμογή, πηγαίνει μαζί
- Εξαρτάται αποκλειστικά από accounting types
- Pattern: κάθε module κρατάει τα services του (ACC-010 Portability)

**Γιατί 2 αρχεία αντί 1:**
- **Separation of concerns** — template (τι φαίνεται) vs exporter (τι κάνει)
- **Testability** — template μπορεί να τεστάρεται ανεξάρτητα
- **Extensibility** — αν χρειαστούν πολλαπλά templates (π.χ. credit note layout)

---

## 5. Dependencies — Τι ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ, Τι ΔΗΜΙΟΥΡΓΕΙΤΑΙ

### 5.1 Επαναχρησιμοποίηση (ZERO duplication)

| Dependency | Πηγή | Τι παίρνουμε |
|------------|-------|--------------|
| jsPDF | `package.json` (ΗΔΗ) | PDF document creation |
| jspdf-autotable | `package.json` (ΗΔΗ) | Line items table |
| Roboto font | `src/services/gantt-export/roboto-font-data.ts` | Greek character rendering |
| `formatCurrency()` | `src/lib/intl-utils.ts` | `€800,00` formatting |
| `formatDate()` | `src/lib/intl-utils.ts` | `17/03/2026` formatting |
| `Invoice` type | `src/subapps/accounting/types/invoice.ts` | Full invoice interface |
| `InvoiceIssuer` | Same | Issuer data shape |
| `InvoiceCustomer` | Same | Customer data shape |
| `InvoiceLineItem` | Same | Line item shape |

### 5.2 Νέος κώδικας (ΜΟΝΟ αυτά δημιουργούνται)

| Αρχείο | Σκοπός | Εκτίμηση γραμμών |
|--------|--------|------------------|
| `invoice-pdf-template.ts` | Template renderer — A4 layout, sections, pagination | ~300-400 |
| `invoice-pdf-exporter.ts` | Orchestrator — export, download, print, blob return | ~80-120 |
| **Τροποποίηση**: `InvoiceActionsMenu.tsx` | Σύνδεση buttons με handlers | ~20 γραμμές diff |
| **Τροποποίηση**: `InvoiceDetails.tsx` | Πέρασμα invoice prop στο actions menu | ~5 γραμμές diff |
| **Τροποποίηση**: `types/invoice.ts` | Προσθήκη phone, mobile, bankAccounts στο InvoiceIssuer | ~5 γραμμές diff |
| **Τροποποίηση**: Invoice creation logic | Snapshot phone/mobile/bankAccounts κατά την έκδοση | ~10 γραμμές diff |

### 5.3 ΔΕΝ χρειάζεται

| Αυτό | Γιατί ΟΧΙ |
|------|-----------|
| Νέο npm package | jsPDF + AutoTable ήδη εγκατεστημένα |
| Server-side route | Client-side generation αρκεί |
| Νέο font αρχείο | Roboto ήδη υπάρχει |
| Νέο formatting utility | `intl-utils.ts` καλύπτει τα πάντα |
| Firestore collection | Το PDF δεν αποθηκεύεται — on-demand generation |

---

## 6. Invoicing Settings — Δεδομένα Template

> ⚠️ **Διόρθωση 2026-11-10 (ο κώδικας είναι η αλήθεια)**: η διαδρομή `accounting/{companyId}/settings/invoicing` **δεν
> υπάρχει**. Το προφίλ εκδότη ζει στο `accounting_settings/{companyId}` (`CompanyProfile`, ADR-439 Φ2) και οι τραπεζικοί
> λογαριασμοί στο **μητρώο** `accounting_bank_accounts` (ADR-ACC-008 §2 · §15 εδώ) — **όχι** μέσα στο προφίλ.
> Ο πίνακας παρακάτω μένει ως ιστορικό παράδειγμα τιμών.

Σχήμα (από ACC-002 §10, ιστορικό):

| Πεδίο | Παράδειγμα | Πηγή |
|-------|------------|-------|
| `issuer.displayName` | "Παγώνης Νέστ. Γεώργιος" | Company Setup |
| `issuer.profession` | "Αρχιτέκτων Μηχανικός" | Company Setup |
| `issuer.address` | "Σαμοθράκης 16, 563 34, Ελευθέριο Κορδελιό" | Company Setup |
| `issuer.phone` | "2310 55 95 95" | Company Setup |
| `issuer.mobile` | "6974 050 023" | Company Setup |
| `bankAccounts[0].bankName` | "ΕΘΝΙΚΗ ΤΡΑΠΕΖΑ" | Company Setup |
| `bankAccounts[0].iban` | "GR68 0110 2230 0000 2234 0068 448" | Company Setup |

**Τα στοιχεία πελάτη** αποθηκεύονται ως **snapshot** μέσα στο Invoice document (ACC-002 §6.2).

### 6.2 ΑΛΛΑΓΗ: Επέκταση InvoiceIssuer Snapshot

**Enterprise pattern (Google/SAP/Oracle):** Το τιμολόγιο πρέπει να είναι **self-contained** — δεν εξαρτάται από τρέχουσες ρυθμίσεις.

**Τρέχον InvoiceIssuer** (ACC-002 §3.1): name, vatNumber, taxOffice, address, profession, kadCode

**Νέα πεδία στο snapshot** (προστίθενται):

| Πεδίο | Τύπος | Σκοπός |
|-------|-------|--------|
| `phone` | `string \| null` | Τηλέφωνο εκδότη κατά την έκδοση |
| `mobile` | `string \| null` | Κινητό εκδότη κατά την έκδοση |
| `email` | `string \| null` | Email εταιρείας (footer) |
| `website` | `string \| null` | Website εταιρείας (footer) |
| `bankAccounts` | `InvoicePaymentAccount[]` = `{ bankName; iban; bic?; holderName? }` | Οδηγίες πληρωμής κατά την έκδοση — τις γράφει **ο διακομιστής** από το μητρώο (§15) |

**Γιατί snapshot αντί settings:**
- **Νομική ακεραιότητα** — Τιμολόγιο 2024 δείχνει στοιχεία 2024, ακόμα κι αν αλλάξει τηλέφωνο/IBAN
- **Self-contained** — Το PDF δεν χρειάζεται δεύτερο query στα settings
- **Ελεγκτική ικανότητα** — Ο εφοριακός βλέπει ακριβώς τι ίσχυε κατά την έκδοση
- **Enterprise standard** — SAP, Oracle Financials, Stripe κάνουν το ίδιο

**Backward compatibility (διορθώθηκε 2026-11-10, §15):** **καμία** εφεδρεία από τις σημερινές ρυθμίσεις για τους λογαριασμούς. Ένα παλιό τιμολόγιο τυπώνει μόνο ό,τι έγραφε όταν εκδόθηκε: αν τυπωνόταν το σημερινό IBAN, θα έδειχνε κάτι που δεν έγραφε ποτέ, ακόμη και σε απόδειξη μετρητών. Τα `bic` / `holderName` λείπουν από τα παλιά snapshots, οπότε η σχεδίαση γράφει «—» και την επωνυμία του εκδότη.

---

## 7. A4 Page Specifications

| Parameter | Value |
|-----------|-------|
| Page size | A4 (595.28 × 841.89 pt) |
| Orientation | Portrait |
| Margins | top: 40, right: 40, bottom: 50, left: 40 |
| Content width | 515.28 pt |
| Font | Roboto (Greek support via Identity-H) |
| Font sizes | Title: 14pt, Section headers: 11pt, Body: 9pt, Fine print: 7pt |
| Line spacing | 1.3× |
| Table | jspdf-autotable — alternating row colors, header bold |

### 7.1 Χρωματική Παλέτα (Pagonis Energo Brand)

Ίδια χρώματα με τα email templates (`base-email-template.ts`) — ενιαίο brand identity.

| Χρώμα | Hex | Χρήση στο PDF |
|-------|-----|---------------|
| **Navy** | `#1E3A5F` | Τίτλος παραστατικού, section headers, header line, table header background |
| **Navy Dark** | `#152D4A` | Κεφαλίδα εκδότη (όνομα, επάγγελμα) |
| **Gray** | `#4A4A4A` | Body text (ΑΦΜ, ΔΟΥ, διεύθυνση, line items) |
| **Gray Light** | `#6B7280` | Ετικέτες πεδίων (labels), footer text |
| **Background Light** | `#F7F8FA` | Alternating table rows, totals section background |
| **White** | `#FFFFFF` | Page background, κείμενο σε navy headers |
| **Border** | `#E5E7EB` | Διαχωριστικές γραμμές sections, table borders |
| **Green (Paid)** | `#16A34A` | Payment stamp "ΕΞΟΦΛΗΘΗΚΕ / PAID" |
| **Orange (Partial)** | `#EA580C` | Payment stamp "ΜΕΡΙΚΗ ΕΞΟΦΛΗΣΗ / PARTIALLY PAID" |
| **Red (Credit)** | `#DC2626` | Πιστωτικό τιμολόγιο — τίτλος (ίδιο με cancellation email template) |

**Πηγή:** `src/services/email-templates/base-email-template.ts` — centralized BRAND object.

**Αρχή:** Ελάχιστο χρώμα — navy σε τίτλους/γραμμές, ασπρόμαυρο body, χρώμα μόνο σε stamps + headers. Εκτυπώνεται καθαρά σε ασπρόμαυρο εκτυπωτή.

---

## 8. Filename Convention

```
{DisplayNumber}_{CustomerName}_{IssueDate}.pdf
```

**Παραδείγματα:**
- `Α-42_ΠΑΠΑΔΟΠΟΥΛΟΣ_ΑΕ_2026-03-17.pdf`
- `Α-43_ΙΩΑΝΝΙΔΗΣ_ΓΕΩΡΓΙΟΣ_2026-03-18.pdf`
- `ΠΙΣ-5_ΔΗΜΟΣ_ΘΕΣΣΑΛΟΝΙΚΗΣ_2026-03-20.pdf`

**Sanitization**: Αφαίρεση ειδικών χαρακτήρων, αντικατάσταση κενών με `_`.

---

## 9. Σχέση με Μελλοντικά Features

| Feature | Σχέση με PDF | ADR |
|---------|--------------|-----|
| **Invoice Email** | PDF ως attachment στο Mailgun email | Μελλοντικό ACC-019 |
| **ΑΠΥ Certificate** | Ίδιο template pattern, διαφορετικό layout | ACC-000 §7.3 |
| **myDATA Submission** | MARK εμφανίζεται στο PDF μετά αποδοχή | ACC-003 |
| **Batch Export** | Πολλαπλά PDF → ZIP (batch-download route υπάρχει) | Μελλοντικό |

Η υλοποίηση αυτού του ADR **ξεμπλοκάρει**:
1. Invoice Email (χρειάζεται PDF blob)
2. Print (χρειάζεται PDF blob → browser print dialog)
3. ΑΠΥ Certificate (reuse template pattern)

---

## 10. Acceptance Criteria

| # | Κριτήριο | Τύπος |
|---|----------|-------|
| 1 | Download button → PDF κατεβαίνει με σωστό filename | FUNCTIONAL |
| 2 | Print button → browser print dialog ανοίγει | FUNCTIONAL |
| 3 | Ελληνικοί χαρακτήρες εμφανίζονται σωστά | QUALITY |
| 4 | Ποσά σε ευρωπαϊκή μορφή (`€1.500,00`) | QUALITY |
| 5 | Ημερομηνίες σε `DD/MM/YYYY` | QUALITY |
| 6 | Παρακράτηση εμφανίζεται μόνο αν > 0 | LOGIC |
| 7 | MARK εμφανίζεται μόνο αν myDATA accepted | LOGIC |
| 8 | ΟΛΟΙ οι καταχωρημένοι τραπεζικοί λογαριασμοί εμφανίζονται (1, 3, ή 10 — όσοι υπάρχουν) | LOGIC |
| 9 | Multi-page λειτουργεί (>10 line items) | PAGINATION |
| 10 | Zero νέα npm packages | ARCHITECTURE |
| 11 | Χρήση centralized formatters (intl-utils) | ARCHITECTURE |
| 12 | Χρήση existing Roboto font (gantt-export) | ARCHITECTURE |
| 13 | TypeScript strict — zero `any` | COMPLIANCE |
| 14 | Πιστωτικό τιμολόγιο δείχνει αναφορά στο αρχικό | LOGIC |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Roboto font δεν υποστηρίζει κάποιο ελληνικό glyph | Σπάνιο — Roboto έχει πλήρες Greek coverage | Test με edge cases (τόνους, κεφαλαία) |
| jsPDF AutoTable δεν χωράει μεγάλες περιγραφές | Layout σπάει | Word-wrap στο description column, max width |
| Πολλές line items → overflow σελίδας | Pagination issues | jspdf-autotable auto-pagination (built-in) |
| Issuer settings δεν έχουν συμπληρωθεί | Κενά πεδία στο PDF | Validation: warn αν λείπουν required fields |

---

## 12. Phases

### Phase 1: Core PDF Generation (αυτό το ADR)
- Template renderer
- Download & Print
- Σωστή μορφοποίηση (Greek, EUR, dates)

### Phase 2: Invoice Email (μελλοντικό ADR ACC-019)
- Mailgun integration
- PDF ως attachment
- Email template (branded)

### Phase 3: Batch Export (μελλοντικό)
- Πολλαπλά τιμολόγια → ZIP
- Date range filter
- Χρήση existing `/api/files/batch-download`

### Phase 4: ΑΠΥ Certificate (μελλοντικό)
- Βεβαίωση παρακράτησης (ACC-000 §7.3)
- Reuse template pattern

---

## 13. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-03-17 | ADR Created — Invoice PDF Generation design | Γιώργος + Claude Code |
| 2026-03-17 | Client-side jsPDF (ΟΧΙ server/Puppeteer) — same pattern as Gantt/Milestone | Claude Code |
| 2026-03-17 | Reuse Roboto font from gantt-export (ΟΧΙ νέο font αρχείο) | Claude Code |
| 2026-03-17 | Reuse intl-utils formatters (ΟΧΙ custom formatting) | Claude Code |
| 2026-03-17 | 2 νέα αρχεία: template + exporter (separation of concerns) | Claude Code |
| 2026-03-17 | Files inside accounting subapp (portability per ACC-010) | Claude Code |
| 2026-03-17 | Zero νέα npm packages required | Claude Code |
| 2026-03-17 | PDF ΔΕΝ αποθηκεύεται στο Firestore — on-demand generation | Claude Code |
| 2026-03-17 | Template layout: ADR-ACC-002 §8.1 (ήδη εγκεκριμένο) | Γιώργος (2026-02-09) |
| 2026-03-17 | Logo: `Pagonis Energeiaki. Logo.png` — πάνω αριστερά στο header (~60×60 pt) | Γιώργος |
| 2026-03-17 | Line items table: 8 στήλες (#, Περιγραφή, Μ.Μ., Ποσ., Τιμή, Έκπτωση, ΦΠΑ%, Σύνολο). Έκπτωση εμφανίζεται μόνο αν ≥1 γραμμή έχει discount > 0 | Γιώργος |
| 2026-03-17 | Τραπεζικοί λογαριασμοί: ΟΛΟΙ οι καταχωρημένοι εμφανίζονται (1 ή 10), ανεξαρτήτως payment method | Γιώργος |
| 2026-03-17 | Πιστωτικό: Σχετ. Παραστατικό ΥΠΟΧΡΕΩΤΙΚΟ (Ν.4308/2014), αιτιολογία ΠΡΟΑΙΡΕΤΙΚΗ (μόνο αν creditReason !== null) | Γιώργος + Claude |
| 2026-03-17 | InvoiceIssuer snapshot: προσθήκη phone, mobile, bankAccounts — self-contained document (enterprise pattern SAP/Oracle/Stripe) | Γιώργος + Claude |
| 2026-03-17 | Γλώσσα: Δίγλωσση (EL + EN) — αλλαγή από "μόνο ελληνικά" (ACC-002 §16). Ετικέτες: ελληνικά πρώτα + αγγλικά | Γιώργος |
| 2026-03-17 | ~~Email πελάτη ΔΕΝ εμφανίζεται στο PDF — GDPR~~ **Αντικαταστάθηκε 2026-11-10** (βλ. εκεί) | Claude (enterprise pattern) |
| 2026-03-17 | ΦΠΑ breakdown: αναλυτικά ΑΝΑ συντελεστή (μία γραμμή per rate) — myDATA compliance | Γιώργος |
| 2026-03-17 | Payment status stamp: PAID (πράσινο), PARTIAL (πορτοκαλί), PENDING (τίποτα). Enterprise pattern Stripe/QuickBooks | Γιώργος + Claude |
| 2026-03-17 | Due date: στο header δίπλα στην ημ/νία έκδοσης (conditional — μόνο αν dueDate !== null). Enterprise pattern Stripe/FreshBooks | Γιώργος + Claude |
| 2026-03-17 | Footer: website + email εταιρείας + σελίδα. ΟΧΙ ημ/νία εκτύπωσης, ΟΧΙ "ευχαριστούμε", ΟΧΙ ΑΜ ΤΕΕ | Γιώργος + Claude |
| 2026-03-17 | InvoiceIssuer snapshot: +email, +website (πέρα από phone, mobile, bankAccounts). Υπάρχουν ήδη στο company.ts | Γιώργος + Claude |
| 2026-03-17 | Χρωματική παλέτα: Pagonis Energo brand colors από `base-email-template.ts`. Navy headers, gray body, ελάχιστο χρώμα | Γιώργος |
| 2026-03-17 | **IMPLEMENTED** — Phase 1 complete. 3 νέα αρχεία (template, exporter, logo-data), 4 τροποποιημένα (invoice.ts, company.ts, InvoiceActionsMenu, InvoiceDetails, InvoiceForm). Zero TS errors. | Claude Code |
| 2026-03-17 | InvoiceIssuer: +mobile, +website, +bankAccounts fields. CompanyProfileBase: +mobile field. InvoiceForm: snapshot from company settings | Claude Code |
| 2026-03-17 | Logo: nestor-app-logo.png (47KB) — embedded as base64 via lazy import (same pattern as roboto-font-data.ts) | Claude Code |
| 2026-11-09 | **Ενότητα «ΑΠΑΛΛΑΓΗ ΦΠΑ / VAT EXEMPTION»** κάτω από τα σύνολα (`invoice-pdf-vat-exemption.ts`): μία γραμμή ανά αιτία εξαίρεσης με τις γραμμές που καλύπτει — ν. 4308/2014 άρθρο 9 (παραπομπή στη διάταξη). Κείμενο από το namespace `accounting-vat-exemptions` μέσω `createBundleTranslate`, διάταξη ν. 2859/2000 ή ν. 5144/2024 ανά ημερομηνία έκδοσης (ADR-ACC-003 §22.1). Το `INVOICE_DOCUMENT_LANGUAGE` μετακόμισε στο `invoice-pdf-constants.ts` (μία γλώσσα εγγράφου για μονάδα και αιτία) | Giorgio + Claude Code |
| 2026-11-10 | **Μπλοκ «ΑΝΤΙΣΤΡΟΦΗ ΕΠΙΒΑΡΥΝΣΗ / REVERSE CHARGE»** πριν από την παραπομπή απαλλαγής, στην ίδια σημείωση ΦΠΑ (`invoice-pdf-vat-exemption.ts`): ν. 4308/2014 άρθρο 9 §1 ιγ, φράση «Αντίστροφη επιβάρυνση» κατά λέξη (ΔΕΕ C-247/21). Γραμμές από το `services/tax/reverse-charge.ts` (κατηγορία EN 16931 `AE`). Κοινός σχεδιαστής μπλοκ `drawVatNoteBlock` για τα δύο μπλοκ (ADR-ACC-003 §22.9) | Giorgio + Claude Code |
| 2026-11-10 | **§14 — Διάταξη μερών: προϋπολογισμός στηλών + πλήρης διεύθυνση πελάτη.** Κεφαλίδα και πελάτης μετακόμισαν στο `invoice-pdf-parties.ts`· η δεξιά στήλη μετριέται πρώτα, ο εκδότης αναδιπλώνεται στο υπόλοιπο πλάτος (τέλος η επικάλυψη «Δραστηριότητα» ↔ «Ημ/νία Έκδοσης»)· το πλαίσιο πελάτη μετριέται πριν σχεδιαστεί· διεύθυνση από `formatContactAddressLine` (πόλη + Τ.Κ. χωρίς οδό), χώρα δίγλωσση από `countryLabelIn` (ν. 4308/2014 άρθρο 9 §1 ε) | Giorgio + Claude Code |
| 2026-11-10 | **Email πελάτη στο PDF = ΝΑΙ** (απόφαση Giorgio): στη στήλη του πελάτη, όπως ήδη τυπώνει ο κώδικας· παραλείπεται όταν είναι κενό. Πρακτική Stripe («Bill to»)· EN 16931 BT-58 (προαιρετικό email επαφής αγοραστή). Η αιτιολογία «GDPR» του 2026-03-17 δεν στέκει: το έγγραφο πηγαίνει στον **ίδιο** τον πελάτη (καμία κοινοποίηση σε τρίτο) και τα στοιχεία τιμολόγησης έχουν νόμιμη βάση (σύμβαση + φορολογική υποχρέωση). Κλείνει το ανοιχτό §14 (δ) | Giorgio + Claude Code |
| 2026-11-10 | **§15 — Οδηγίες πληρωμής: μητρώο λογαριασμών + snapshot από τον διακομιστή + RF (ISO 11649) + EPC QR (EPC069-12 v3.1).** Αντικαθιστά τα «ΟΛΟΙ οι λογαριασμοί, ανεξαρτήτως τρόπου πληρωμής» (2026-03-17) και «fallback στα settings» (§6.2) | Giorgio + Claude Code |
| 2026-11-10 | **§15 — Διόρθωση BIC στον κατάλογο τραπεζών** (`src/constants/greek-banks.ts`, ο ΕΝΑΣ κατάλογος). Η ζωντανή επαλήθευση αποκωδικοποίησε το EPC QR του Α-7 και βρήκε `PIABORAA` αντί για `PIRBGRAA` (Πειραιώς): ο κατάλογος είχε επινοημένα BIC (`EFABORAA`, `ATABORAA`, BIC 7 χαρακτήρων) και λάθος κωδικούς IBAN (Optima = 069, που είναι η Συν. Χανίων). Πηγές: HEBIC Ένωσης Τραπεζών 2026 (κωδικοί/φορείς) + HEBIC 2022 (BIC)· εξαίρεση CrediaBank `ATTIGRAA` (μόνο τρίτοι κατάλογοι). Άγκυρα: `src/constants/__tests__/greek-banks.test.ts` (εγκυρότητα ISO 9362, μοναδικότητα, συμφωνία των δύο πινάκων, 8 επίσημες τιμές). Ήδη αποθηκευμένα BIC (επαφές, snapshots) ΔΕΝ μεταφέρθηκαν | Giorgio + Claude Code |
| 2026-11-10 | **§15.1 — Κύκλος ζωής λογαριασμού + αρνήσεις εκτός ERROR + αναφορά BIC.** (α) Οι ανενεργοί λογαριασμοί φαίνονται σε συμπτυγμένη ομάδα (πρακτική Xero «Archived»)· νέα πράξη `POST …/bank-accounts/[id]/reactivate` (ρήμα-ενέργεια όπως Stripe `/void`), ίχνος `BANK_ACCOUNT_REACTIVATED`. (β) `DomainRefusal` (`src/lib/errors/domain-refusal.ts`): το `safeFirestoreOperation` καταγράφει τις αποφασισμένες αρνήσεις ως `info` χωρίς stack. (γ) `scripts/report-greek-bank-bic.ts`: μέτρηση μόνο ανάγνωσης των αποθηκευμένων BIC | Giorgio + Claude Code |
| 2026-11-11 | **§15.2 — Ο BIC ακολουθεί το IBAN + ζωντανές οδηγίες πληρωμής πρόχειρου.** (α) Ένας κριτής `bicAgreementWithIBAN` (`greek-banks.ts`) για φόρμα · γραφέα · αναφορά· άρνηση `BicIbanMismatchError` (422, `DomainRefusal`). (β) Η φόρμα ξαναγράφει τράπεζα/BIC σε κάθε αλλαγή IBAN όσο είναι παράγωγα (`bankSource`). (γ) Πρόχειρο ⇒ οι λογαριασμοί του σημερινού μητρώου σε GET και email (`withCurrentPaymentAccounts`)· εκδομένο ⇒ το στιγμιότυπο, αμετάβλητο (Stripe draft → finalize) | Giorgio + Claude Code |
| 2026-11-11 | **§16 — Δημόσια σελίδα πληρωμής τιμολογίου.** Νέο είδος κοινοποίησης `invoice_payment` πάνω στο υπάρχον σύστημα (`src/server/sharing/*` + `ShareEntityRegistry`), χωρίς δεύτερο σύστημα. Όψη + PDF μέσω `GET /api/shares/[shareId]/invoice-payment[/pdf]` με κουπόνι επίσκεψης. EPC QR ανά λογαριασμό με το υπόλοιπο. Σύνδεσμος στο email + στο συνημμένο PDF. Ίχνος `INVOICE_PAYMENT_LINK_OPENED`. Οι οδηγίες πληρωμής ως δεδομένα (`invoice-payment-instructions.ts`) και το PDF ως έγγραφο (`invoice-pdf-document.ts`) έγιναν από ένα | Giorgio + Claude Code |
| 2026-11-11 | **§16.1 — Κανάλια συνομιλίας του εκδότη (Φάση 1).** Νέο SSoT `lib/contact/social-chat-links.ts` (Viber · WhatsApp · Messenger · Telegram · Instagram, επίσημα πρότυπα, έτοιμο κείμενο μόνο με τον αριθμό). Νέα πλατφόρμα `viber` στη ρίζα `SOCIAL_PLATFORMS` (δωρεάν σύνδεσμος `viber.me`, όχι bot). `InvoicePublicView.issuerChatChannels` = **τρέχοντα** κανάλια του μισθωτή (`resolveTenantSocialAccounts`). Μπλοκ `InvoiceIssuerContact.tsx`. Άγκυρα `lib/contact/__tests__/social-chat-links.test.ts` (Σ1–Σ5) | Giorgio + Claude Code |
| 2026-11-11 | **§16.2 — Ευρήματα ζωντανής επαλήθευσης.** Λογότυπο PDF συμπιεσμένο (`drawPdfLogo`: 4,1 MB → 36 KB) · μονάδα στη γλώσσα του επισκέπτη (`unitLabel` από το `uomLabelIn`) · προεπισκόπηση email σε απομονωμένο λευκό χαρτί (`SandboxedHtmlFrame`) · θεματικό εικονίδιο στο `ShareSurfaceShell` | Giorgio + Claude Code |
| 2026-11-11 | **§16 → ADR-ACC-030.** Τα δύο «εκτός εμβέλειας» της σελίδας (κάρτα/IRIS · γραφέας πληρωμών) κλείνουν στο ADR-ACC-030. Ο σύνδεσμος πληρωμής δίνεται πλέον και σε τιμολόγιο «κάρτα» / «IRIS» (`isPayableByLink`)· οι λογαριασμοί στο PDF μένουν στον κανόνα `showsPaymentInstructions` | Giorgio + Claude Code |
| 2026-11-12 | **§16.1 (δ′) — Viber μόνο με λογαριασμό Business.** Ζωντανή επαλήθευση Φάσης 1: τα 5 κανάλια ανοίγουν σωστά· με προσωπικό αριθμό το Viber γράφει «λογαριασμός μη διαθέσιμος», όπως δηλώνει η Viber (chat link μόνο Business). Απόφαση Giorgio: μένουμε στο επίσημο `viber.me`, χωρίς το ανεπίσημο `viber://chat`. Καμία αλλαγή κώδικα | Giorgio + Claude Code |
| 2026-11-12 | **§16.1 Φάση 2 → ADR-939.** «Γράψτε μας» στη σελίδα παραστατικού: κανάλι `portal` στα ενιαία εισερχόμενα CRM, απάντηση εκδότη στη σελίδα + email. Το email του παραστατικού παίρνει το πλαίσιο του εκδότη από το νέο SSoT `invoiceIssuerEmailFrame` | Giorgio + Claude Code |
| 2026-11-13 | **§16 (γ) — Η επίσκεψη ζει όσο ζει ο άνθρωπος (ADR-315 Α19).** Ζωντανό εύρημα: η σελίδα πέθαινε στο 16′ (`visit-expired`). Αδράνεια 15′ ανανεώσιμη σε κάθε θετική κρίση συνδέσμου + απόλυτη 8 ώρες· ένας σκελετός διαδρομών (`_shared/invoice-visit-route.ts`, αντί για τέσσερα αντίγραφα του ελέγχου κουπονιού)· αθόρυβη νέα επίσκεψη στη σελίδα (ADR-ACC-030 §5.6). |

---

## 14. Διάταξη μερών: προϋπολογισμός στηλών + πλήρης διεύθυνση (2026-11-10)

**Πρόβλημα (ζωντανή επαλήθευση ADR-ACC-003 §22.9, Α-3 / Α-4 / Α-5)**:
- (α) Ο εκδότης γραφόταν **χωρίς όριο πλάτους** και η δεξιά στήλη σε **καρφωτά** y (y+5/10/17/23/27). Η γραμμή «Δραστηριότητα» (y+22) έπεφτε πάνω στην «Ημ/νία Έκδοσης» (y+23) σε **κάθε** τιμολόγιο.
- (β) Η γραμμή διεύθυνσης του πελάτη γραφόταν **μόνο αν υπήρχε οδός**: πελάτης με πόλη και Τ.Κ. αλλά χωρίς οδό έβγαινε **χωρίς διεύθυνση**. Η χώρα έβγαινε ωμός κωδικός («DE»), και το πλαίσιο είχε σταθερό ύψος 22mm.

**Πηγή**: ν. 4308/2014 άρθρο 9 §1 **περ. ε** — «την πλήρη επωνυμία και την πλήρη διεύθυνση του πωλητή και του πελάτη» · Οδηγία 2006/112/ΕΚ άρθρο 226 §5.

| Αρχείο | Ρόλος |
|---|---|
| `services/pdf/invoice-pdf-parties.ts` | §1 κεφαλίδα + §2 πελάτης (μετακόμισαν από το `invoice-pdf-sections.ts`). Η δεξιά στήλη (`rightBlockLines`) **μετριέται πρώτα** (`getTextWidth` στο μέγεθος κάθε γραμμής)· ο εκδότης παίρνει `δεξί άκρο − φαρδύτερη γραμμή − 6mm − αρχή εκδότη` (ελάχιστο 60mm) και αναδιπλώνεται· η κεφαλίδα τελειώνει στο `max(αριστερή, δεξιά, 30mm) + 3`. Πελάτης: δύο στήλες (επωνυμία · διεύθυνση · email | ΑΦΜ · ΔΟΥ · χώρα), ύψος πλαισίου **από τις γραμμές** (ελάχιστο 22mm, το παλιό) |
| `services/pdf/invoice-pdf-constants.ts` | `drawWrappedLines(pdf, text, y, box)`: αναδίπλωση στο πλάτος του κουτιού, το ύψος μετρά **πραγματικές** γραμμές· `LABELS.country` |
| `utils/address/country-label-text.ts` | `countryLabelIn(country, language)`: το όνομα χώρας **εκτός React**, από τα ίδια `common:countries.*` με την οθόνη (`countryLabelKey`)· άγνωστη χώρα ⇒ η αποθηκευμένη τιμή. Ξεχωριστό αρχείο για να μη φέρει το `country-codes.ts` locale σε κάθε καταναλωτή (ιδίωμα `global-role-text.ts`) |

**Αποφάσεις**:
- (α) Η διεύθυνση του πελάτη βγαίνει από τη **μία** μορφή `formatContactAddressLine` («Οδός, Πόλη, Τ.Κ.»). Τα κενά παραλείπονται, και ο ελληνικός Τ.Κ. γράφεται «546 30».
- (β) Η χώρα είναι δίγλωσση («Γερμανία / Germany»), όπως κάθε ετικέτα του εγγράφου. Για ελληνικό πελάτη παραλείπεται, όπως πριν.
- (γ) Η διεύθυνση του **εκδότη** κρατά τη σημερινή μορφή της (`οδός, πόλη Τ.Κ.`): αλλάζει μόνο η αναδίπλωση.
- (δ) Το email του πελάτη τυπώνεται, όπως τύπωνε ήδη ο κώδικας. ✅ **Αποφασίστηκε 2026-11-10 (Giorgio): ΝΑΙ**, βλ. Decision Log.

**Εκτός εμβέλειας**:
- Το διπλό κείμενο της δραστηριότητας («γενικός ανάδοχος…/γενικός ανάδοχος…»). Έρχεται αυτούσιο από το `profile.profession`, δηλαδή από τα δεδομένα του προφίλ και όχι από το PDF.
- Η χρήση του `drawWrappedLines` στις σημειώσεις και στη σημείωση ΦΠΑ, που έχουν τοπικό `splitTextToSize`.

---

## 15. Οδηγίες πληρωμής: λογαριασμοί · αιτιολογία RF · EPC QR (2026-11-10)

**Πρόβλημα**:
- (α) Η ενότητα λογαριασμών του PDF υπήρχε, αλλά **δεν έδειχνε ποτέ τίποτα**: το snapshot `issuer.bankAccounts` γραφόταν πάντα `[]` (φόρμα **και** γέφυρα πωλήσεων ακινήτων), και δεν υπήρχε πουθενά UI ή API καταχώρισης λογαριασμών.
- (β) Το `issuer` το έστελνε **ο browser** (σχήμα `.passthrough()`). Αν είχε συνδεθεί ως είχε, ένα πειραγμένο αίτημα θα αποφάσιζε **ποιο IBAN τυπώνεται** στο τιμολόγιο.
- (γ) Το `getBankAccounts` (Admin SDK) φιλτράριζε μόνο `isActive`, **χωρίς `companyId`** ⇒ θα επέστρεφε λογαριασμούς **άλλων εταιρειών**. Δεν προκάλεσε ζημιά, γιατί η συλλογή ήταν άδεια.

**Πηγές (επαληθευμένες)**:
- **EN 16931 BG-16** Payment instructions: BT-81 τρόπος, BT-83 αιτιολογία, BT-84 IBAN, BT-85 δικαιούχος, BT-86 BIC.
- **ISO 11649** (RF): «RF» + 2 ψηφία ελέγχου (mod 97) + έως 21 αλφαριθμητικά. Επαλήθευση στο δημοσιευμένο παράδειγμα `RF18 5390 0754 7034`.
- **EPC069-12 v3.1** (19/03/2024, επίσημο PDF του EPC), §2.1–2.2:
  - `BCD` / `002` / charset `1` = UTF-8 / `SCT`
  - BIC προαιρετικό εντός ΕΟΧ
  - δικαιούχος ≤ 70 · IBAN ≤ 34
  - `EUR` 0.01–999999999.99
  - structured ≤ 35 **ή** unstructured ≤ 140, ποτέ και τα δύο
  - διαχωριστής LF, κανένας μετά το τελευταίο πεδίο
  - **≤ 331 bytes** · error level **M**
  - «it is optional for PSPs». Η υποστήριξη από τις ελληνικές τραπεζικές εφαρμογές **δεν επιβεβαιώθηκε**, γι' αυτό το QR **συμπληρώνει** τον πίνακα και δεν τον αντικαθιστά.
- ν. 4308/2014 άρθρο 9: δεν απαιτεί IBAN. Είναι καλή πρακτική (Stripe, Xero, QuickBooks).

**Αρχιτεκτονική**:

| Αρχείο | Ρόλος |
|---|---|
| `services/repository/accounting-repo-bank-accounts.ts` | Ο **ΕΝΑΣ** γραφέας του `accounting_bank_accounts` (ADR-ACC-008 §2). Κάθε πράξη τρέχει σε μία συναλλαγή που διαβάζει όλους τους λογαριασμούς του μισθωτή: μοναδικό IBAN ανάμεσα στους ενεργούς · **ακριβώς ένας** προεπιλεγμένος ανάμεσα σε όσους τυπώνονται (`resolveInvoiceDefault`) · απενεργοποίηση, ποτέ διαγραφή. Φράχτης `companyId` σε κάθε ανάγνωση. Το IBAN **δεν αλλάζει**: άλλο IBAN = νέος λογαριασμός |
| `services/audited-repository-wrapper.ts` | Ίχνη `BANK_ACCOUNT_CREATED / _UPDATED / _DEACTIVATED` με καλυμμένο IBAN. Μια σιωπηλή αλλαγή του IBAN που τυπώνεται είναι το κλασικό μοτίβο απάτης «αλλάξαμε τράπεζα» |
| `app/api/accounting/bank-accounts/` | GET/POST + PATCH/DELETE (`defineRoute`, `sensitive`). Ο διακομιστής ξαναελέγχει IBAN (`validateIBAN`) και BIC (`isValidBIC`, ISO 9362). Διπλό IBAN ⇒ 409, ξένος λογαριασμός ⇒ 404 |
| `services/payments/invoice-payment-accounts.ts` | Ο **ΕΝΑΣ** κανόνας «ποιοι λογαριασμοί, πότε»: `showsPaymentInstructions` (μεταφορά · `credit` · `mixed`, ποτέ πιστωτικό) · `selectInvoicePaymentAccounts` (ενεργοί + «Στα τιμολόγια», ο προεπιλεγμένος πρώτος, έως 3, δικαιούχος ή επωνυμία εκδότη) · `resolveInvoicePaymentAccounts` (διαβάζει το μητρώο **μόνο** όταν χρειάζεται) · `compareBankAccounts` (η μία σειρά) |
| `services/repository/accounting-repo-financial.ts` → `createInvoice` | Η **γέννηση** κάθε τιμολογίου (φόρμα · γέφυρα πωλήσεων · πιστωτικό) γράφει το snapshot από το μητρώο. Ό,τι φέρει ο καλών αγνοείται |
| `app/api/accounting/invoices/invoice-payment-snapshot.ts` | PATCH πρόχειρου: αλλαγή `issuer`/`paymentMethod`/`type` ⇒ το snapshot ξαναχτίζεται με τον ίδιο resolver. GET + email πρόχειρου ⇒ `withCurrentPaymentAccounts` (§15.2). Τα διαβιβασμένα τα φυλά το `IMMUTABLE_STATUSES` |
| `services/payments/creditor-reference.ts` | ISO 11649: `buildCreditorReference` · `isValidCreditorReference` · `formatCreditorReference` · `findCreditorReferences` (μέσα σε κείμενο τράπεζας, το μακρύτερο έγκυρο πρόθεμα) |
| `services/engines/matching-reference.ts` | `invoiceCreditorReference(series, number)`: κωδικός σειράς διπλωμένος στα λατινικά (ίδια ομόγλυφα με τις αιτιολογίες) + αριθμός **πάντα 9 ψηφία**, ώστε «A1»+23 ≠ «A»+123. Σειρά με χαρακτήρα εκτός [A-Z0-9] (π.χ. «Γ») ⇒ **κανένα** RF. Η συμφωνία τράπεζας **αποκωδικοποιεί** τα RF των αιτιολογιών σε (σειρά, αριθμό), από το ίδιο κανάλι `InvoiceReference` |
| `services/payments/epc-qr-payload.ts` | Το payload EPC κατά γράμμα του v3.1. Αδύνατο ⇒ `null` + λόγος, ποτέ κομμένο όνομα |
| `services/pdf/invoice-pdf-payment-qr.ts` | Το QR **διανυσματικά** (`qrModuleRuns`, level M, 26mm): ίδιο σε browser και email, χωρίς PNG |
| `services/pdf/invoice-pdf-sections.ts` → `drawBankAccountsSection` | Τράπεζα · IBAN · BIC · Δικαιούχος + «Αιτιολογία πληρωμής: RF… (σειρά-αριθμός)» + QR δεξιά για τον προεπιλεγμένο. Ποσό QR = `invoicePayableAmount`, ο **ίδιος** αριθμός με το «ΠΛΗΡΩΤΕΟ» |
| `components/setup/BankAccountsSection.tsx` · `BankAccountDialog.tsx` · `bank-account-form-state.ts` · `hooks/useCompanyBankAccounts.ts` | Οθόνη ρυθμίσεων. Επαναχρησιμοποιεί `IBANInput` + `BankSelector` (κατάλογος με BIC, αυτόματη τράπεζα από IBAN). Αποθήκευση ανά λογαριασμό, και μετά επανανάγνωση: η οθόνη δείχνει ό,τι αποφάσισε ο γραφέας |

**Αποφάσεις**:
- (α) **Μία πηγή** για τους λογαριασμούς της εταιρείας: το μητρώο της συμφωνίας τράπεζας (`BankAccountConfig`), επεκταμένο. **Όχι** οι λογαριασμοί επαφών, που ανήκουν σε **τρίτους**.
- (β) Το snapshot το γράφει **ο διακομιστής**, και η σχεδίαση τυπώνει **μόνο** το snapshot. Η εφεδρεία «σημερινές ρυθμίσεις» αφαιρέθηκε από exporter / μενού / email.
- (γ) Το RF **δεν αποθηκεύεται**: είναι καθαρή συνάρτηση της (αμετάβλητης) σειράς + αριθμού, άρα δεν υπάρχει δεύτερη αλήθεια ούτε ενημέρωση παλιών εγγράφων.
- (δ) Το QR κωδικοποιεί τον **προεπιλεγμένο** λογαριασμό (ένα QR = ένα IBAN) και μόνο ευρώ.
- (ε) Ο αριθμός τιμολογίου μένει ορατός δίπλα στο RF, για όποια τράπεζα δεν δέχεται RF.

**Εκτός εμβέλειας / γνωστά**:
- **Παρακράτηση στο πληρωτέο**: όλοι οι καλούντες περνούν `withholdingAmount: 0`, ενώ το τιμολόγιο έχει `withholdingAmount`. Το QR ακολουθεί το τυπωμένο «ΠΛΗΡΩΤΕΟ» και δεν διορθώνει μόνο του τη διαφορά.
- Υποστήριξη EPC QR / RF από ελληνικές τραπεζικές εφαρμογές: **ανεπιβεβαίωτη**. Το μενού «Πληρωμή με RF» των ελληνικών τραπεζών αφορά δικαιούχους εγγεγραμμένους στη ΔΙΑΣ. Το RF εδώ είναι αιτιολογία μεταφοράς (SEPA).
- Δημόσια σελίδα πληρωμής (link + QR): **§16**. IRIS: μόνο μέσω PSP, εκτός εμβέλειας.

### 15.1 Κύκλος ζωής λογαριασμού · αρνήσεις ≠ βλάβες · αναφορά BIC (2026-11-10)

**Πρόβλημα**: (α) Το σήμα «Ανενεργός» δεν εμφανιζόταν ποτέ: το hook ζητούσε μόνο τους ενεργούς, και δεν υπήρχε επανενεργοποίηση. (β) Το κοινό `safeFirestoreOperation` έγραφε **κάθε** σφάλμα ως `ERROR` με stack, και τον έλεγχο διπλού IBAN (περιστατικό 19:17:27 UTC): οι αρνήσεις έμοιαζαν με βλάβες. (γ) Τα BIC που αποθηκεύτηκαν πριν το `61679b87` μπορεί να είναι λάθος.

**Αποφάσεις**:
- (α) Ενεργοί πάνω· ανενεργοί σε **συμπτυγμένη** ομάδα με σήμα και κουμπί επανενεργοποίησης (Xero «Archived», QuickBooks «Include inactive»). Η επανενεργοποίηση είναι **ρήμα-ενέργεια** (`POST /api/accounting/bank-accounts/[id]/reactivate`, όπως `POST /v1/invoices/:id/void` στο Stripe), όχι `PATCH { isActive }`, γιατί έχει δικό της κανόνα. Ο γραφέας (`reactivateBankAccount`) ξανατρέχει τον έλεγχο μοναδικού ενεργού IBAN **μέσα** στη συναλλαγή (409) και ο λογαριασμός επιστρέφει **εκτός τιμολογίων, χωρίς προεπιλογή**: το IBAN που βλέπει ο πελάτης αλλάζει μόνο με ρητή απόφαση (αντι-απάτη, BEC). Ίχνος `BANK_ACCOUNT_REACTIVATED`. Ο διάλογος επιβεβαίωσης είναι **ένας** για τις δύο κατευθύνσεις (`STATUS_COPY`).
- (β) `DomainRefusal` (`src/lib/errors/domain-refusal.ts`): το σφάλμα **δηλώνει** ότι είναι αποφασισμένη άρνηση (πρότυπο `http-errors` `expose` · Google SRE «alert on symptoms»). Το `safeFirestoreOperation` τις καταγράφει `info` χωρίς stack· όλα τα άλλα μένουν `ERROR`. Κληρονομούν: `DuplicateBankAccountError` (409), `OwnedDocumentNotFoundError` (404). Η μετάφραση σε HTTP **δεν** αλλάζει (μένει στον δρομολογητή κάθε πόρου).
- (γ) `scripts/report-greek-bank-bic.ts`: **μόνο ανάγνωση**, αναμενόμενο BIC αποκλειστικά από `getBankByIBAN`, κάδοι σωστά / λάθος / κενά / εκτός εμβέλειας για `accounting_bank_accounts` και `contacts/*/bank_accounts`. Καμία εγγραφή: η διόρθωση γίνεται από την εφαρμογή, όπου μένει ίχνος (CHECK 3.17). Τα snapshots τιμολογίων δεν διαβάζονται (αμετάβλητα).

### 15.2 Ο BIC ακολουθεί το IBAN · οι οδηγίες πληρωμής πρόχειρου είναι ζωντανές (2026-11-11)

**Πρόβλημα (ζωντανή επαλήθευση §15.1)**:
- (α) Η φόρμα συμπλήρωνε τράπεζα/BIC από το IBAN **μόνο αν ήταν κενά**. Διόρθωση IBAN σε ανοιχτό διάλογο κρατούσε την τράπεζα του **προηγούμενου** IBAN ⇒ μπορούσε να αποθηκευτεί BIC άλλης τράπεζας ⇒ λάθος ίδρυμα στο EPC QR. Ο διακομιστής έλεγχε μόνο τη **μορφή** του BIC (ISO 9362), όχι σε ποιον ανήκει.
- (β) Τα **πρόχειρα** κρατούσαν το snapshot λογαριασμών της **δημιουργίας**: το Α-7 θα έφευγε με `PIABORAA` παρότι ο κατάλογος διορθώθηκε (§15).

**Αποφάσεις**:
- (α) **Ένας κριτής** `bicAgreementWithIBAN(iban, bic)` στο `src/constants/greek-banks.ts` (`match` · `mismatch` · `unknown`). Συγκρίνει τους 8 πρώτους χαρακτήρες (ίδρυμα + χώρα + τοποθεσία, ISO 9362): το `PIRBGRAAXXX` είναι η ίδια τράπεζα με το `PIRBGRAA`. Ξένο IBAN ή άγνωστος κωδικός ⇒ `unknown` ⇒ **δεκτό** (ο κατάλογος δεν κρίνει ό,τι δεν ξέρει). Συγχωνεύσεις: `GREEK_SUCCESSOR_BICS` — για το 087 (Παγκρήτια → CrediaBank) δεκτά **και** `STPGGRAA` **και** `ATTIGRAA`, γιατί επίσημη πηγή για το ποιο δρομολογεί τα παλιά IBAN δεν βρέθηκε: καμία ψευδής άρνηση σωστού BIC. Τον χρησιμοποιούν φόρμα, γραφέας **και** `report-greek-bank-bic.ts` (πριν: ακριβής ισότητα, δηλαδή δεύτερος κανόνας).
- (β) Γραφέας: `BicIbanMismatchError extends DomainRefusal` (**422**). Στη δημιουργία κρίνεται πριν από τη συναλλαγή· στην αλλαγή, **μέσα** στη συναλλαγή απέναντι στο **αποθηκευμένο** IBAN (το IBAN δεν αλλάζει ποτέ) και μόνο όταν γράφεται BIC. Τα σφάλματα σχήματος μένουν 400, άρα το 422 σημαίνει μόνο αυτό. Μήνυμα φόρμας `setup.bankAccounts.errors.bicMismatch`.
- (γ) Φόρμα: `bankSource: 'derived' | 'manual'` (πρότυπο «παράγωγο μέχρι να το παρακάμψεις»). Παράγωγα ⇒ κάθε αλλαγή IBAN τα **ξαναγράφει** (και τα αδειάζει αν ο κατάλογος δεν ξέρει το νέο IBAN — ποτέ η τράπεζα του προηγούμενου). Ο χρήστης γράφει ή διαλέγει τράπεζα/BIC (`withManualBank`) ⇒ δεν τα αγγίζει τίποτα· αν δεν συμφωνούν με το IBAN, ο ίδιος κριτής σταματά την αποστολή.
- (δ) Πρότυπο Stripe (draft → finalize): οι οδηγίες πληρωμής ενός **μεταβλητού** παραστατικού (`draft` · `rejected`) είναι **προβολή** του σημερινού μητρώου· από τη διαβίβαση (`IMMUTABLE_STATUSES`) το αποθηκευμένο `issuer.bankAccounts` είναι **το** έγγραφο. `withCurrentPaymentAccounts` (`invoice-payment-snapshot.ts`, ίδιος resolver): το καλούν το **GET** τιμολογίου (προεπισκόπηση + PDF browser — καθαρή ανάγνωση, καμία εγγραφή) και η **αποστολή email** (το PDF που φεύγει· μετά από επιτυχή αποστολή πρόχειρου, το `issuer` που στάλθηκε γράφεται στην **ίδια** εγγραφή με το `emailHistory`). Το σχέδιο **εξακολουθεί** να τυπώνει μόνο ό,τι του δίνεται (§15 β) — καμία εφεδρεία μέσα στο PDF.
- ⚠️ **Διαβίβαση**: δεν υπάρχει ακόμη διαδρομή draft → sent (η διαβίβαση στην ΑΑΔΕ δεν έχει συνδεθεί). Ο γραφέας της **πρέπει** να παγώσει το αποτέλεσμα του `withCurrentPaymentAccounts` στην **ίδια** εγγραφή που αλλάζει την κατάσταση· γραμμένο στο docblock του `invoice-payment-snapshot.ts`.

## 16. Δημόσια σελίδα πληρωμής τιμολογίου (2026-11-11)

**Πρόβλημα**: ο πελάτης λάμβανε το τιμολόγιο μόνο ως συνημμένο PDF. Δεν υπήρχε ιδιωτικός σύνδεσμος «δες και πλήρωσε» όπως στα Stripe (Hosted Invoice Page), Xero (online invoice) και QuickBooks (invoice link).

**Τι κάνουν οι άλλοι** (επίσημες πηγές, 2026-11-11):
- **Stripe**: μυστικό τυχαίο URL. Λήγει 30 ημέρες μετά τη λήξη πληρωμής (το πολύ 120). Ο ληγμένος σύνδεσμος οδηγεί σε σελίδα με τα στοιχεία της επιχείρησης. Ο σύνδεσμος υπάρχει στο email και στο PDF. Μόνο για οριστικοποιημένο τιμολόγιο.
- **Xero**: όποιος έχει τον σύνδεσμο βλέπει **ζωντανή** εκδοχή, που μπορεί να διαφέρει από το PDF. Αυτό είναι γνωστό παράπονο χρηστών.
- **QuickBooks**: χωρίς σταθερή λήξη. Ο σύνδεσμος ζει ως την εξόφληση ή την ακύρωση.

**Αποφάσεις**:
- (α) **Ένα σύστημα συνδέσμων.** Νέο είδος `invoice_payment` στο `ShareEntityType`, με resolver `invoice-payment.resolver.ts`. Πολιτική: `{ password: false, labelRequired: false, accessLimit: false, openNotice: true, defaultExpiresInHours: 720 }`. Κωδικός δεν υπάρχει, όπως και στους τρεις. Προστασία: token 256 bit, αποθηκεύεται μόνο το hash, υποχρεωτική λήξη, ανάκληση. Το νέο πεδίο πολιτικής `defaultExpiresInHours` (όλα τα άλλα είδη 72) το διαβάζουν **και** ο διακομιστής (`share-create.ts`) **και** ο διάλογος (`initialLinkTokenDraftFor`).
- (β) **Ποιος δημιουργεί**: `invoicePaymentAuthority` (`share-create-authority.ts`). Τιμολόγιο του μισθωτή (`readTenantInvoice`, γιατί το `getInvoice` δεν ελέγχει μισθωτή) **και** `isPayableByLink`. Το δεύτερο σημαίνει απαίτηση (`isCollectibleInvoice`) που πληρώνεται με μεταφορά (`showsPaymentInstructions`), ο ίδιος κανόνας με τους λογαριασμούς του PDF. Αλλιώς `nothing-to-share` (422). Επιτρέπεται και για πρόχειρο, με τον κανόνα που ήδη ισχύει για το email πρόχειρου. Η σελίδα το δείχνει με ρητή ταινία «Προσχέδιο».
- (γ) **Ροή δεδομένων** (πρότυπο συνεδρίας θέασης περιήγησης): το `POST /api/shares/resolve` επιστρέφει μόνο `{ shareId, invoiceId }` και γράφει το κουπόνι επίσκεψης. Η σελίδα ζητά `GET /api/shares/[shareId]/invoice-payment` (όψη) και `…/pdf`. Το token δεν ξαναταξιδεύει. Ο διακομιστής (`invoice-public-session.ts`) ξαναελέγχει ότι ο σύνδεσμος είναι ενεργός και δεν έληξε (`findActiveShareOf`, που ως τώρα ήταν `activeTourShareId` της περιήγησης), τον μισθωτή και τις οδηγίες πληρωμής **που θα τύπωνε σήμερα** (`withCurrentPaymentAccounts`). Κεφαλίδες `no-store` + `X-Robots-Tag: noindex`. Η σελίδα `/shared/[token]` κληρονομεί `noindex` + `no-referrer`. Όριο ρυθμού STANDARD. **Επίσκεψη (2026-11-13, ADR-315 Α19)**: το κουπόνι ζει με αδράνεια 15′ που **ανανεώνεται** σε κάθε θετική κρίση του συνδέσμου (όψη · PDF · έναρξη πληρωμής · «Γράψτε μας», ένας σκελετός `invoice-payment/_shared/invoice-visit-route.ts`) και απόλυτη λήξη 8 ωρών· όταν λήξει, η σελίδα ανοίγει αθόρυβα νέα επίσκεψη με το token (`fetchInVisit` · `reopenVisit`, ADR-ACC-030 §5.6). Πριν, η σελίδα πέθαινε 15′ μετά το άνοιγμα.
- (δ) **Δημόσια όψη = ρητή λίστα πεδίων** (`buildInvoicePublicView`, τύπος `InvoicePublicView`). **Ποτέ**: `companyId`, `createdBy`, ids επαφών, email πελάτη, `emailHistory`, αιτιολογία ακύρωσης, εσωτερικά myDATA. Οι **σημειώσεις** περιέχονται, γιατί ήδη τυπώνονται στο PDF.
- (ε) **Κατάσταση και ποσό** (`invoice-payment-link.ts`): `payable` · `paid` · `cancelled` · `not-payable`. Ακυρωμένο **δεν** είναι «δεν βρέθηκε»: ο πελάτης μαθαίνει ότι δεν οφείλει (Stripe: σελίδα void). Γι' αυτό η ακύρωση **δεν** ανακαλεί τον σύνδεσμο. Η σελίδα διαβάζει πάντα τη ζωντανή κατάσταση. Ποσό QR = **υπόλοιπο** (`invoiceOpenAmount`, όπως το `amount_remaining` του Stripe). Ένα QR **ανά λογαριασμό**. Το «ληξιπρόθεσμο» το κρίνει ο διακομιστής.
- (στ) **Ένας ορισμός οδηγιών πληρωμής**: `invoicePayableAmount`, `invoicePaymentReference` (+ `remittance`), `paymentBeneficiaryOf`, `paymentQrPayload` μετακόμισαν από τα αρχεία σχεδίασης του PDF (jsPDF) στο καθαρό `services/payments/invoice-payment-instructions.ts`. Το PDF σχεδιάζει, η σελίδα προβάλλει, η αιτιολογία και το QR είναι ίδια. Το QR της σελίδας ζωγραφίζεται συγχρονισμένα από το `qrModuleRuns`, το ίδιο σύμβολο με το PDF.
- (ζ) **Ένα έγγραφο PDF**: `invoice-pdf-document.ts` (λογότυπο, όνομα αρχείου, ΚΑΔ, απόδοση). Το χρησιμοποιούν exporter, email και δημόσια λήψη. Πριν, το λογότυπο και το όνομα αρχείου ήταν γραμμένα δύο φορές. Το PDF μορφοποιεί πλέον το IBAN με τον ΕΝΑ μορφοποιητή της εφαρμογής (`formatIBAN`, `types/contacts/banking.ts`): το αντίγραφό του στο `invoice-pdf-constants.ts` διαγράφηκε. Οι κεφαλίδες ιδιωτικής απάντησης (`no-store` + `noindex`) ζουν στο `lib/http/private-response-headers.ts`, κοινές με τα κανάλια της επαγγελματικής σελίδας.
- (η) **Email + PDF από τον ίδιο γραφέα** (`invoice-email-payment-link.ts`): το `send-email` γεννά σύνδεσμο (ετικέτα = παραλήπτης) όταν οφείλεται ποσό. Ο σύνδεσμος μπαίνει ως κουμπί στο σώμα και ως γραμμή στην ενότητα πληρωμής του **συνημμένου** PDF (`paymentPageUrl`). Γράφεται `paymentLinkShareId` στο `EmailSendRecord`. Αποτυχία αποστολής (ή PDF > 10MB) ⇒ ανάκληση. Χωρίς `NEXT_PUBLIC_APP_URL` το email φεύγει χωρίς σύνδεσμο. Το PDF που κατεβάζει ο χρήστης από την εφαρμογή μένει χωρίς σύνδεσμο.
- (θ) **Ίχνος**: δημιουργία/ανάκληση = ίχνος του συστήματος κοινοποίησης. Άνοιγμα (πρώτο ή νέα συσκευή) ⇒ `INVOICE_PAYMENT_LINK_OPENED` στο ίχνος λογιστικής (το «Viewed» του Stripe), με δράστη τον **κάτοχο** του συνδέσμου (`share:<shareId>`). Η άγκυρα «openNotice μόνο με ετικέτα» απέκτησε κλειστή εξαίρεση: ο παραλήπτης είναι εξ ορισμού ο πελάτης.
- (ι) **Γλώσσα**: τη διαλέγει ο επισκέπτης (αποθηκευμένη προτίμηση, αλλιώς γλώσσα browser: ο υπάρχων κανόνας του `i18n/config.ts`), όχι η χώρα του πελάτη. Μικρό namespace `accounting-public-payment`, lazy.
- (κ) **Διαχείριση από την εφαρμογή**: «Σύνδεσμος πληρωμής» στο μενού του τιμολογίου ⇒ ο ΕΝΑΣ διάλογος `UnifiedShareDialog` (δημιουργία + αντιγραφή, λίστα, ανάκληση).

**Εκτός εμβέλειας / γνωστά**:
- ~~Πληρωμή με κάρτα ή IRIS: απαιτεί PSP.~~ → **[ADR-ACC-030](./ADR-ACC-030-online-invoice-payments.md)** (Everypay, «Πληρωμή τώρα»).
- ~~Δεν υπάρχει γραφέας καταγραφής πληρωμών.~~ → **ADR-ACC-030 §3**: ο ΕΝΑΣ `recordInvoicePayment` + αυτόματη καταγραφή από webhook / συμφιλίωση.
- Η σελίδα ληγμένου συνδέσμου δείχνει τη γενική άρνηση, χωρίς στοιχεία εκδότη. Το Stripe τα δείχνει, και αυτό θα απαιτούσε `invoiceMeta` στο έγγραφο κοινοποίησης.
- `qrUrl` myDATA (πριν από την πρώτη διαβίβαση). Η σελίδα δείχνει ήδη τον ΜΑΡΚ όταν υπάρχει.
- Παρακράτηση στο πληρωτέο (όπως στο §15).

### 16.1 Κανάλια συνομιλίας του εκδότη (2026-11-11, Φάση 1)

**Πρόβλημα**: το μπλοκ «Επικοινωνία με τον εκδότη» έδειχνε μόνο email, τηλέφωνο και ιστότοπο. Οι εταιρείες έχουν ήδη δηλωμένους λογαριασμούς Viber/WhatsApp/Messenger/Telegram/Instagram, και στην Ελλάδα αυτά είναι τα κανάλια που ο πελάτης χρησιμοποιεί πραγματικά.

**Τι κάνουν οι άλλοι** (2026-11-11): κανείς (Stripe, Xero, QuickBooks, Zoho) δεν δείχνει κουμπιά εφαρμογών μηνυμάτων στη σελίδα τιμολογίου. Ο Zoho έχει σχόλια πάνω στο τιμολόγιο.

**Αποφάσεις** (Giorgio):
- (α) **Τρέχοντα κανάλια της εταιρείας, όχι στιγμιότυπο.** Το πεδίο `InvoicePublicView.issuerChatChannels` είναι **έξω** από το `issuer` (που είναι στιγμιότυπο της έκδοσης). Πηγή: οι λογαριασμοί social του μισθωτή (`resolveTenantSocialAccounts`, ίδιο `pickAllSocials` με τη βιτρίνα). Ένα παλιό τιμολόγιο δεν δείχνει ποτέ κανάλι που καταργήθηκε.
- (β) **Ένα SSoT «άνοιξε συνομιλία με έτοιμο κείμενο»**: `src/lib/contact/social-chat-links.ts`. Τρίτη οικογένεια συνδέσμων, δίπλα στο **προφίλ** (`social-platform-profiles.ts`) και στην **κοινοποίηση** (`social-platform-system`), όπου ο χρήστης διαλέγει παραλήπτη. Κάθε κανάλι **προκύπτει** από λογαριασμό της ρίζας `SOCIAL_PLATFORMS`: Messenger από τη σελίδα Facebook, Instagram Direct από το Instagram. Ο δείκτης επικυρώνεται ανά κανάλι (`handlePattern`) και ό,τι δεν ταιριάζει δεν γίνεται σύνδεσμος. Ο server βγάζει τα κανάλια (`chatChannelsOf`) και ο client χτίζει τον σύνδεσμο (`buildChatLink`) με κείμενο στη γλώσσα του επισκέπτη.
- (γ) **Επίσημα πρότυπα** (επαληθευμένα 2026-11-11): WhatsApp `wa.me/<E164>?text=` · Viber `viber.me/<E164>?draft=` (help.viber.com, chat link λογαριασμού Business) · Messenger `m.me/<σελίδα>?text=` (developers.facebook.com, m.me links) · Telegram `t.me/<χρήστης>?text=` (core.telegram.org/api/links) · Instagram `ig.me/m/<χρήστης>`, **χωρίς** κείμενο. Το `viber://chat?number=` **δεν** είναι τεκμηριωμένο και απορρίφθηκε.
- (δ) **Viber = δωρεάν σύνδεσμος, όχι bot.** Νέα πλατφόρμα `viber` στη ρίζα (`.domain-vocabulary.json`, CHECK 3.73), με «όνομα χρήστη» τον αριθμό (μόνο ψηφία, όπως το WhatsApp). Το Viber bot κοστίζει στον κάτοχό του και θα έρθει ως «σύνδεσε το δικό σου bot» μαζί με τη Φάση 3, με χρέωση της εταιρείας απευθείας από τη Viber.
- (δ′) **Ο αριθμός Viber πρέπει να είναι λογαριασμός Viber Business** (απόφαση Giorgio 2026-11-12, μετά τη ζωντανή επαλήθευση). ΜΕΤΡΗΜΕΝΟ: με **προσωπικό** αριθμό το `viber.me/<E164>` ανοίγει την εφαρμογή και γράφει «αυτός ο λογαριασμός δεν είναι διαθέσιμος». Η Viber το δηλώνει ρητά: οι chat links/QR λειτουργούν **μόνο** για καταχωρημένους λογαριασμούς Business (help.viber.com, «Get your Viber chat link and QR code for Business accounts»). Απορρίφθηκε ξανά το `viber://chat?number=` για προσωπικούς αριθμούς: η σελίδα deep links (developers.viber.com) τεκμηριώνει μόνο σχήματα bot (`viber://pa?…`), οι μαρτυρίες λειτουργίας είναι κοινοτικές και αντιφατικές, δεν υπάρχει τεκμηριωμένο έτοιμο κείμενο και χωρίς εγκατεστημένο Viber δεν ανοίγει τίποτα. Η πρακτική των παρόχων (Respond.io, Sinch) είναι επίσης μόνο Business/bot. Ο κώδικας **δεν** αλλάζει· η μελλοντική οθόνη social της εταιρείας ονομάζει το πεδίο «αριθμός Viber Business».
- (ε) **Έτοιμο κείμενο = μόνο ο αριθμός του παραστατικού** (`contact.chatDraft`). Ποτέ ποσό, ποτέ PII, **ποτέ ο σύνδεσμος**, που είναι διαπιστευτήριο (W3C capability URLs) και δεν φεύγει προς τρίτους.
- (στ) **UI**: `InvoiceIssuerContact.tsx` (εξήχθη από τη σελίδα), λίστα κουμπιών με εικονίδιο (`CHAT_CHANNEL_ICONS`, Simple Icons CC0 για Viber/Messenger), `target=_blank` + `noopener noreferrer`, κρυφή στην εκτύπωση. Στο Instagram, που δεν δέχεται έτοιμο κείμενο, το κλικ **αντιγράφει** το μήνυμα (`useCopyToClipboard`) και ανακοινώνεται σε `role=status` (εδώ ξεπερνάμε το απλό «άνοιξε συνομιλία»).

**Φάση 2 → [ADR-939](../../../../../docs/centralized-systems/reference/adrs/ADR-939-customer-page-write-to-us.md)** (2026-11-12): «Γράψτε μας» μέσα στη σελίδα, κανάλι `portal` στα ενιαία εισερχόμενα CRM (ADR-174· η αναφορά «ADR-029» ήταν λάθος). **Επόμενα (σχέδιο, όχι υλοποίηση)**: Φάση 3: αυτόματη σύνδεση συνομιλίας ↔ παραστατικό μέσω `ref` (Messenger/Instagram) και `start` (Telegram) με σύντομο κωδικό του server.

### 16.2 Ευρήματα ζωντανής επαλήθευσης (2026-11-11, live `561f201`)

Επαληθεύτηκαν ζωντανά στο πρόχειρο Α-7: δημιουργία (λήξη 30 μέρες) · ανώνυμη όψη και PDF με `no-store`/`noindex` · άρνηση χωρίς κουπόνι επίσκεψης (`visit-expired`) · EPC QR με `PIRBGRAA` · αντιγραφή χωρίς κενά · άρνηση πλαισίωσης · el/en · email με κουμπί και σύνδεσμο · ετικέτα = παραλήπτης · ανάκληση. Τέσσερα ευρήματα, τα τρία προϋπήρχαν:

- (α) **Λογότυπο ασυμπίεστο στο PDF** (προϋπήρχε). Το jsPDF αποκωδικοποιεί το PNG και, χωρίς ρητή συμπίεση, γράφει ωμά pixels. ΜΕΤΡΗΜΕΝΟ: PDF Α-7 4,4 MB, από τα οποία 4,0 MB το λογότυπο 1024×1024 (3 MB χρώμα + 1 MB διαφάνεια)· email 6,1 MB. Λύση: ο ΕΝΑΣ `drawPdfLogo` (`services/pdf/pdf-logo.ts`, Flate `'FAST'` + alias) για τιμολόγιο και βεβαίωση ΑΠΥ. ΜΕΤΡΗΜΕΝΟ με το jsPDF: 4.100 KB → 36 KB (`'SLOW'` 33 KB, όχι αξιόλογο κέρδος).
- (β) **Μονάδα «pcs» στη δημόσια σελίδα** (από το §16). Η όψη έδινε τον αποθηκευμένο κωδικό. Τώρα η προβολή δίνει `unitLabel` σε κάθε γλώσσα από τον ΙΔΙΟ μορφοποιητή με το PDF (`uomLabelIn`), και η σελίδα διαλέγει τη γλώσσα του επισκέπτη. Όχι `useUomLabel` στη σελίδα: θα έφερνε όλο το namespace `uom` στην επιφάνεια και νέο ζεύγος στη σφράγιση `lazyRouteMountSeal`, για μία λέξη.
- (γ) **«Άσπρα κουτιά» στην προεπισκόπηση email** (προϋπήρχε, ADR-ACC-019). Το HTML του email χυνόταν με `dangerouslySetInnerHTML` μέσα σε σκοτεινή επιφάνεια και κληρονομούσε το θέμα. Τώρα ο ΕΝΑΣ `SandboxedHtmlFrame` (`components/ui/sandboxed-html-frame.tsx`: iframe `srcDoc`, `sandbox` χωρίς σενάρια, λευκό χαρτί) για προεπισκόπηση τιμολογίου, υπενθύμισης ΑΠΥ και αρχείου HTML (`HtmlPreview`).
- (δ) **Αόρατο εικονίδιο στον διάλογο κοινοποίησης** (προϋπήρχε). Το `text-primary` στο σκοτεινό θέμα = `--card` (CHECK 3.38). Το κέλυφος `ShareSurfaceShell` παίρνει πλέον το θεματικό `colors.text.info`, ζεύγος του κύκλου `--bg-info`, για όλους τους διαλόγους.

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
