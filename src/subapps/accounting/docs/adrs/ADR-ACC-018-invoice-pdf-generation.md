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
| Τραπεζικοί Λογαριασμοί | `bankAccounts.length > 0` — εμφανίζονται **ΟΛΟΙ** οι καταχωρημένοι, ανεξαρτήτως τρόπου πληρωμής |
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

Τα στοιχεία εκδότη, IBAN, κλπ. αποθηκεύονται στο Firestore:

```
accounting/{companyId}/settings/invoicing
```

Σχήμα (από ACC-002 §10):

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
| `bankAccounts` | `Array<{ bankName: string; iban: string }>` | Τραπεζικοί λογαριασμοί κατά την έκδοση |

**Γιατί snapshot αντί settings:**
- **Νομική ακεραιότητα** — Τιμολόγιο 2024 δείχνει στοιχεία 2024, ακόμα κι αν αλλάξει τηλέφωνο/IBAN
- **Self-contained** — Το PDF δεν χρειάζεται δεύτερο query στα settings
- **Ελεγκτική ικανότητα** — Ο εφοριακός βλέπει ακριβώς τι ίσχυε κατά την έκδοση
- **Enterprise standard** — SAP, Oracle Financials, Stripe κάνουν το ίδιο

**Backward compatibility:** Παλιά τιμολόγια χωρίς τα νέα πεδία → fallback στα settings (graceful degradation)

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
| 2026-03-17 | Email πελάτη ΔΕΝ εμφανίζεται στο PDF — GDPR + φορολογικό έγγραφο (μόνο: Επωνυμία, ΑΦΜ, ΔΟΥ, Διεύθυνση) | Claude (enterprise pattern) |
| 2026-03-17 | ΦΠΑ breakdown: αναλυτικά ΑΝΑ συντελεστή (μία γραμμή per rate) — myDATA compliance | Γιώργος |
| 2026-03-17 | Payment status stamp: PAID (πράσινο), PARTIAL (πορτοκαλί), PENDING (τίποτα). Enterprise pattern Stripe/QuickBooks | Γιώργος + Claude |
| 2026-03-17 | Due date: στο header δίπλα στην ημ/νία έκδοσης (conditional — μόνο αν dueDate !== null). Enterprise pattern Stripe/FreshBooks | Γιώργος + Claude |
| 2026-03-17 | Footer: website + email εταιρείας + σελίδα. ΟΧΙ ημ/νία εκτύπωσης, ΟΧΙ "ευχαριστούμε", ΟΧΙ ΑΜ ΤΕΕ | Γιώργος + Claude |
| 2026-03-17 | InvoiceIssuer snapshot: +email, +website (πέρα από phone, mobile, bankAccounts). Υπάρχουν ήδη στο company.ts | Γιώργος + Claude |
| 2026-03-17 | Χρωματική παλέτα: Pagonis Energo brand colors από `base-email-template.ts`. Navy headers, gray body, ελάχιστο χρώμα | Γιώργος |
| 2026-03-17 | **IMPLEMENTED** — Phase 1 complete. 3 νέα αρχεία (template, exporter, logo-data), 4 τροποποιημένα (invoice.ts, company.ts, InvoiceActionsMenu, InvoiceDetails, InvoiceForm). Zero TS errors. | Claude Code |
| 2026-03-17 | InvoiceIssuer: +mobile, +website, +bankAccounts fields. CompanyProfileBase: +mobile field. InvoiceForm: snapshot from company settings | Claude Code |
| 2026-03-17 | Logo: nestor-app-logo.png (47KB) — embedded as base64 via lazy import (same pattern as roboto-font-data.ts) | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
