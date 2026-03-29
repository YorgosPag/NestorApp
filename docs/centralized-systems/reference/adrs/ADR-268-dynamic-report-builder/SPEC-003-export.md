# SPEC-003: Export System (3-Tier) + Enterprise Excel + Charts

**ADR**: 268 — Dynamic Report Builder
**Version**: 2.0
**Last Updated**: 2026-03-29

---

## Θεμελιώδης Αρχή (Απαίτηση Γιώργου)

> **Κάθε αναφορά ΠΡΕΠΕΙ να υποστηρίζει και τα 3 outputs πλήρως:**
> 1. **On-screen** — Table + Charts + KPIs (interactive)
> 2. **PDF** — Branded, με πίνακες + διαγράμματα (εκτυπώσιμο)
> 3. **Excel** — Enterprise-grade: πολλαπλές καρτέλες, τύποι μεταξύ κελιών, conditional formatting, embedded charts
>
> **Ό,τι μπορεί να γίνει chart, γίνεται chart** — και στα 3 outputs.

---

## Branding — Υπάρχουσα υποδομή (REUSE)

Το Report Builder **δεν δημιουργεί νέο branding** — χρησιμοποιεί τα υπάρχοντα:

### Logos

| Logo | Αρχείο | Χρήση στο Report Builder |
|------|--------|--------------------------|
| Company (Pagonis Energo) | `public/images/pagonis-energo-logo.png` | **Header** PDF + Excel Sheet 1 |
| App (Nestor) | `public/images/nestor-app-logo.png` | **Footer** PDF + Excel Sheet 1 |

### Brand Colors (από `base-email-template.ts`)

```typescript
const BRAND = {
  navy: '#1E3A5F',        // Header background, PDF header bar
  navyDark: '#152D4A',    // Excel header row bg
  gray: '#4A4A4A',        // Body text
  grayLight: '#6B7280',   // Secondary text, footer
  bgLight: '#F7F8FA',     // Alternating row bg
  white: '#FFFFFF',
  border: '#E5E7EB',      // Table borders
  accent: '#2563EB'       // Highlights, links
};
```

> **Σημαντικό**: Τα ίδια brand colors χρησιμοποιούνται ήδη σε 6 email templates, 2 PDF templates (invoice, APY certificate), και τον PDF Header/Footer Renderer. Το Report Builder θα τα reuse.

### PDF Header/Footer Pattern (από `HeaderFooterRenderer.ts` + `invoice-pdf-template.ts`)

**Header:**
```
┌─────────────────────────────────────────────────────┐
│ [Company Logo 25x25]  ΑΝΑΦΟΡΑ: {title}   {date}    │
│ {companyName}         Φίλτρα: {applied filters}     │
│ ─────────── navy line ──────────────────────────── │
└─────────────────────────────────────────────────────┘
```

**Footer:**
```
┌─────────────────────────────────────────────────────┐
│ ─────────── navy line ──────────────────────────── │
│ {companyName}    Σελ. {X} από {Y}    [Nestor Logo]  │
│ {phone} | {email}              Powered by Nestor App │
└─────────────────────────────────────────────────────┘
```

### Υπάρχοντα templates που ήδη χρησιμοποιούν αυτό το branding

| Template | Αρχείο | Τι κάνει |
|----------|--------|----------|
| Reservation email | `email-templates/reservation-confirmation.ts` | Βεβαίωση κράτησης → αγοραστής |
| Sale email | `email-templates/sale-confirmation.ts` | Βεβαίωση πώλησης → αγοραστής |
| Cancellation email | `email-templates/cancellation-confirmation.ts` | Ακύρωση → αγοραστής |
| Professional assignment | `email-templates/professional-assignment.ts` | Ανάθεση → δικηγόροι, συμβολαιογράφος |
| Accounting notification | `sales-accounting/accounting-notification.ts` | Ειδοποίηση → λογιστήριο |
| PO email | `procurement/po-email-template.ts` | Παραγγελία → προμηθευτής |
| Invoice PDF | `accounting/services/pdf/invoice-pdf-template.ts` | Τιμολόγιο PDF (jsPDF) |
| APY Certificate PDF | `accounting/services/pdf/apy-certificate-pdf-template.ts` | Βεβαίωση παρακράτησης |

---

## 3-Tier Architecture

Βάσει έρευνας σε Salesforce, SAP, Dynamics 365, Procore, Oracle, HubSpot, Zoho.

### Tier 1: Flat Table Export (Universal Standard)

**Τι**: 1 row per record, μόνο primary values
**Πώς**: Υπάρχουσα υποδομή ADR-265 (exportReportToPdf, exportReportToExcel) — **αναβαθμισμένη**
**Πότε**: Phase 1 (table), Phase 2 (charts), Phase 3 (export)

---

#### On-Screen Output

- **KPI cards**: COUNT, SUM, AVG, MIN, MAX (αυτόματα βάσει domain + columns)
- **Table**: Sortable, grouped (expandable rows), paginated
- **Charts**: Auto-generated βάσει grouping & aggregations:
  - Enum grouping (π.χ. status) → **Bar chart** (horizontal) ή **Pie chart**
  - Date grouping (π.χ. μήνας) → **Line chart** ή **Area chart**
  - 2-level grouping → **Stacked bar chart**
  - Currency aggregation → **Horizontal bar** (ranked, μεγαλύτερο πρώτα)
- **Chart Type Selector**: Ο χρήστης μπορεί να αλλάξει τύπο chart (bar/pie/line/area/stacked)

---

#### PDF Output

**Layout (A4 landscape, branded):**

```
┌─────────────────────────────────────────────────────┐
│ 🏢 NESTOR APP                        29/03/2026    │
│ ─────────────────────────────────────────────────── │
│ Αναφορά: Μονάδες ανά Κτίριο — Κορδελιό             │
│ Φίλτρα: Έργο = Κορδελιό | Status = Πωλημένο        │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│ │ 156      │ │ €12.5M   │ │ 89       │              │
│ │ Μονάδες  │ │ Αξία     │ │ Πωλημένα │              │
│ └──────────┘ └──────────┘ └──────────┘              │
│                                                      │
│ ┌── Chart (rendered as image) ──────────────────┐   │
│ │  Κτίριο Α  ██████████████████  52 (€4.2M)    │   │
│ │  Κτίριο Β  ████████████████    48 (€3.8M)    │   │
│ │  Κτίριο Γ  ██████████         35 (€2.8M)     │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ┌── Table (auto-paginated) ─────────────────────┐   │
│ │ Κωδικός │ Κτίριο │ Τύπος   │ Status   │ Τιμή │   │
│ │ A-101   │ Α      │ Στούντιο│ Πωλημένο │ €65K │   │
│ │ ...     │ ...    │ ...     │ ...      │ ...  │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ Σελ. 1/3                    Nestor App — 29/03/2026 │
└─────────────────────────────────────────────────────┘
```

**Τεχνική υλοποίηση PDF charts:**
- `html-to-image` → renders recharts component σε PNG
- PNG embeds σε jsPDF πριν τον πίνακα
- Ανάλυση: 2x DPR (retina-quality)

---

#### Excel Output (Enterprise-Grade)

**Πολυ-καρτέλα αρχιτεκτονική (multi-sheet):**

| Sheet # | Όνομα | Περιεχόμενο |
|---------|-------|-------------|
| 1 | **Σύνοψη** | KPI metrics + embedded chart(s) + φίλτρα |
| 2 | **Δεδομένα** | Detail table: auto-filters, conditional formatting, freeze panes |
| 3 | **Ανάλυση** | Grouped aggregations + pivot-ready layout + chart(s) |
| 4 | **Raw** | Unformatted data (για Power BI / Tableau import) |

**Sheet 1 — Σύνοψη:**

```
┌────────────────────────────────────────────────────┐
│ A1: "Αναφορά: Μονάδες ανά Κτίριο"  (merged, bold) │
│ A2: "Ημ/νία: 29/03/2026"                           │
│ A3: "Φίλτρα: Έργο = Κορδελιό | Status = Πωλημένο" │
│                                                     │
│ A5: "Σύνολο Εγγραφών"  B5: =COUNTA(Δεδομένα!A:A)-1│
│ A6: "Συνολική Αξία"    B6: =SUM(Δεδομένα!E:E)     │
│ A7: "Μέση Τιμή"        B7: =AVERAGE(Δεδομένα!E:E) │
│ A8: "Μέγιστη Τιμή"     B8: =MAX(Δεδομένα!E:E)     │
│ A9: "Ελάχιστη Τιμή"    B9: =MIN(Δεδομένα!E:E)     │
│                                                     │
│ A11-F25: [Embedded Excel Chart — Bar/Pie]           │
│          Data source: Sheet "Ανάλυση"               │
└────────────────────────────────────────────────────┘
```

**Sheet 2 — Δεδομένα (Detail):**

```
┌─────────────────────────────────────────────────────┐
│ Row 1: Headers (bold, bg: #1F2937, text: white)     │
│ Row 2+: Data                                         │
│                                                      │
│ Features:                                            │
│ • Auto-filters on Row 1                              │
│ • Freeze panes (Row 1 + Column A)                    │
│ • Column widths: auto-fit                            │
│ • Number format: currency → €#,##0, % → 0.0%        │
│ • Date format: DD/MM/YYYY                            │
│ • Conditional formatting:                            │
│   - Currency > median → green bg                     │
│   - Status = "Πωλημένο" → green text                 │
│   - Status = "Κρατημένο" → orange text               │
│   - Overdue dates → red text                         │
│ • Last row: TOTALS (=SUM, =AVERAGE, =COUNT formulas)│
│                                                      │
│ Named range: "ReportData" (for chart references)     │
└─────────────────────────────────────────────────────┘
```

**Sheet 3 — Ανάλυση (Grouped):**

```
┌─────────────────────────────────────────────────────┐
│ Αν υπάρχει groupBy:                                  │
│                                                      │
│ A1: Group Label  B1: Count  C1: Sum  D1: Avg  E1: % │
│ A2: "Κτίριο Α"  B2: =COUNTIFS(Δεδομένα!B:B,A2)     │
│                  C2: =SUMIFS(Δεδομένα!E:E,...)       │
│                  D2: =AVERAGEIFS(Δεδομένα!E:E,...)   │
│                  E2: =B2/SUM(B:B)*100                │
│                                                      │
│ Τελευταία γραμμή: GRAND TOTAL                        │
│ B99: =SUM(B2:B98)  C99: =SUM(C2:C98)               │
│                                                      │
│ [Embedded Excel Chart — mirrors on-screen chart]     │
│ Chart type: Bar/Pie/Line (ίδιο με on-screen)        │
│ Data source: Named range "AnalysisData"              │
└─────────────────────────────────────────────────────┘
```

**Sheet 4 — Raw:**

```
┌─────────────────────────────────────────────────────┐
│ Ίδια δεδομένα με Sheet 2, ΧΩΡΙΣ formatting           │
│ • Αριθμοί ως αριθμοί (όχι formatted currency)       │
│ • Ημ/νίες ως ISO 8601 (YYYY-MM-DD)                  │
│ • Χωρίς merged cells, χωρίς colors                   │
│ • Ready for Power BI / Tableau / pandas import       │
└─────────────────────────────────────────────────────┘
```

**Excel Τύποι — Κατάλογος (ExcelJS formulas):**

| Τύπος | Χρήση | Παράδειγμα |
|-------|-------|------------|
| `=COUNTA()` | Count records | `=COUNTA(Δεδομένα!A:A)-1` |
| `=SUM()` | Σύνολο currency/number | `=SUM(Δεδομένα!E2:E500)` |
| `=AVERAGE()` | Μέσος όρος | `=AVERAGE(Δεδομένα!E2:E500)` |
| `=MIN()` / `=MAX()` | Ακραίες τιμές | `=MIN(Δεδομένα!E2:E500)` |
| `=COUNTIFS()` | Count per group | `=COUNTIFS(Δεδομένα!B:B,A2)` |
| `=SUMIFS()` | Sum per group | `=SUMIFS(Δεδομένα!E:E,Δεδομένα!B:B,A2)` |
| `=AVERAGEIFS()` | Avg per group | `=AVERAGEIFS(Δεδομένα!E:E,Δεδομένα!B:B,A2)` |
| `=B2/SUM(B:B)*100` | Ποσοστό group | Αυτόματος υπολογισμός % |
| `=IF()` | Conditional logic | Status labels, thresholds |

**Excel Charts (embedded via ExcelJS addChart):**

| Τύπος Chart | Πότε | Sheet |
|-------------|------|-------|
| Bar (horizontal) | Enum grouping (status, type) | Σύνοψη + Ανάλυση |
| Pie / Donut | Κατανομή % | Σύνοψη |
| Line | Date grouping (μήνας, τρίμηνο) | Σύνοψη + Ανάλυση |
| Stacked Bar | 2-level grouping | Ανάλυση |

**ExcelJS chart API:**
```typescript
// ExcelJS supports addChart() for .xlsx files
const chart = workbook.addChart('bar', {
  title: 'Μονάδες ανά Κτίριο',
  series: [{ name: 'Count', values: 'Ανάλυση!B2:B10' }],
  categories: 'Ανάλυση!A2:A10',
});
worksheet.addChart(chart, 'A11');
```

**Περιορισμοί**: Nested arrays (πολλαπλά emails, personas) δείχνουν μόνο primary value ή comma-separated στο Tier 1.

---

### Tier 2: Row Repetition Export (Salesforce/SAP Pattern)

**Τι**: Ο parent record επαναλαμβάνεται 1 φορά ανά child record
**Πώς**: Νέο mode "Αναλυτική Εξαγωγή" στο Report Builder
**Πότε**: Phase 4

**Παράδειγμα** — Contact "Γιάννης Παπαδόπουλος" με 2 emails, 2 phones:

| Όνομα | Επώνυμο | Email Type | Email | Phone Type | Phone |
|-------|---------|-----------|-------|-----------|-------|
| Γιάννης | Παπαδόπουλος | work | g.papa@company.gr | mobile | 6971234567 |
| Γιάννης | Παπαδόπουλος | personal | giannis@gmail.com | home | 2310123456 |

**Πλεονεκτήματα**: Κάθε value σε δικό του κελί — filterable/sortable στο Excel
**Μειονεκτήματα**: Duplicate rows, μεγαλύτερο file size

**Ποια domains χρειάζονται Tier 2:**

| Domain | Nested Arrays |
|--------|-------------|
| B1 Individuals | emails[], phones[], addresses[], personas[], socialMedia[] |
| B2 Companies | contactPersons[], emails[], phones[], addresses[] |
| C2 Cheques | endorsementChain[] |
| C1 Payment Plans | installments[], loans[] |
| C6 Purchase Orders | items[] |
| F1 Invoices | lineItems[], payments[] |

---

### Tier 3: Contact Card PDF (Procore/Dynamics 365 Pattern)

**Τι**: Formatted "κάρτα" — ΟΛΑ τα στοιχεία nested σε sections
**Πώς**: Νέο button "Εκτύπωση Καρτέλας" στη σελίδα επαφής + batch mode στο Builder
**Πότε**: Phase 6+

**Layout (1 contact per page):**

```
┌─────────────────────────────────────────┐
│ 📷 Φωτογραφία   ΓΙΑΝΝΗΣ ΠΑΠΑΔΟΠΟΥΛΟΣ   │
│                 Πολιτικός Μηχανικός      │
│                 Status: Ενεργός          │
├─────────────────────────────────────────┤
│ ΤΑΥΤΟΤΗΤΑ                                │
│ ΑΦΜ: 123456789  ΔΟΥ: Α' Θεσσαλονίκης  │
│ ΑΜΚΑ: 12345678901  Φύλο: Άρρεν         │
│ Ημ. Γέννησης: 15/03/1985               │
│ Ταυτότητα: ΑΒ 123456 (01/2020)         │
├─────────────────────────────────────────┤
│ ΕΠΙΚΟΙΝΩΝΙΑ                              │
│ ┌─────────┬────────────────────────┐    │
│ │ work    │ g.papa@company.gr      │    │
│ │ personal│ giannis@gmail.com      │    │
│ ├─────────┼────────────────────────┤    │
│ │ mobile  │ +30 697 123 4567       │    │
│ │ office  │ +30 2310 123456        │    │
│ ├─────────┼────────────────────────┤    │
│ │ work    │ Εγνατίας 12, Θεσ/νίκη │    │
│ │ home    │ Κορδελιό, 56334        │    │
│ └─────────┴────────────────────────┘    │
├─────────────────────────────────────────┤
│ PERSONAS                                 │
│ ✅ Μηχανικός                             │
│   ΤΕΕ: 12345 | Πολιτικός | Κλάση Α    │
│ ✅ Εργολάβος                             │
│   Κατηγορία: Υπεργολάβος               │
├─────────────────────────────────────────┤
│ ΕΡΓΑ (μέσω contact_links)               │
│ ┌──────────┬──────────┬──────────┐      │
│ │ Κορδελιό │ Engineer │ Active   │      │
│ │ Θέρμη    │ Engineer │ Active   │      │
│ └──────────┴──────────┴──────────┘      │
├─────────────────────────────────────────┤
│ ΟΙΚΟΓΕΝΕΙΑ                               │
│ Έγγαμος | Σύζυγος: Μαρία | Παιδιά: 2  │
└─────────────────────────────────────────┘
```

**Batch Mode**: Στο Report Builder, button "Εκτύπωση Καρτελών" → PDF με 1 contact per page (Procore Directory pattern).

---

## Comparison Matrix

| Feature | Tier 1 | Tier 2 | Tier 3 |
|---------|--------|--------|--------|
| Format | Flat table | Flat + row repetition | Formatted card |
| Output | PDF + Excel | Excel (primary) | PDF (primary) |
| 1 row = | 1 entity | 1 child record | 1 page |
| Nested data | Primary only | All values, separate rows | All values, nested sections |
| Filterable | ✅ | ✅ | ❌ (read-only) |
| Use case | Lists, summaries | Data analysis, BI | Print, archive, share |
| Effort | Reuse ADR-265 | New mode | New renderer |
