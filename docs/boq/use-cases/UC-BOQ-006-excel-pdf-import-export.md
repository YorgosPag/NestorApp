# UC-BOQ-006: Excel/PDF Import-Export

**Parent ADR:** ADR-175 — Σύστημα Επιμετρήσεων (Quantity Surveying / BOQ)
**Phase:** 1C (Excel Import/Export) + 1D (PDF Export)
**Status:** Draft — Implementation Contract
**Date:** 2026-02-11
**Depends on:** UC-BOQ-001, UC-BOQ-002
**Blocks:** —

---

## 1. Σκοπός

Import και Export BOQ δεδομένων σε **Excel (.xlsx)** + Export σε **PDF (μορφή ΑΤΟΕ)**. Dual PDF mode: Tender (δημόσιο) + Detailed (εσωτερικό). Στόχος: Έλληνες μηχανικοί που **ήδη** έχουν επιμετρήσεις σε Excel μπορούν να τις εισάγουν αμέσως.

Πρότυπο: ACE-Hellas ΕΡΓΟΛΗΠΤΗΣ, PlanSwift Export, CostX Reports.

---

## 2. Actors

| Actor | Ρόλος | Ενέργειες |
|-------|-------|-----------|
| **Μηχανικός** | Κύριος | Import Excel, export PDF/Excel |
| **Εργοδηγός** | Field | Export quick report (PDF) |
| **Λογιστήριο** | Finance | Export summary for budgeting |
| **Τράπεζα / Δημόσιο** | External | Λήψη PDF σε format ΑΤΟΕ |

---

## 3. Preconditions

1. UC-BOQ-001: BOQ items + categories
2. UC-BOQ-002: Τιμές resolved (για Excel/PDF export)
3. Για import: .xlsx αρχείο σε αναγνωρίσιμο format

---

## 4. Excel Format Specification

### 4.1 Template — 3 Sheets

**Sheet 1: BOQ_Items** (κύρια δεδομένα — 22 στήλες)

| # | Στήλη | Τύπος | Required | Παράδειγμα |
|---|-------|-------|----------|-----------|
| 1 | `α/α` | number | Ν | 1 |
| 2 | `categoryCode` | string | Υ | OIK-2 |
| 3 | `categoryName` | string | Ν | Σκυροδέματα |
| 4 | `articleCode` | string | Ν | 2.1 |
| 5 | `description` | string | Υ | Θεμέλια C25/30 |
| 6 | `specifications` | string | Ν | Σκυρόδεμα C25/30, XC2 |
| 7 | `scope` | string | Ν | building |
| 8 | `unitName` | string | Ν | A-101 (μονάδα) |
| 9 | `unit` | string | Υ | m³ |
| 10 | `estimatedNetQty` | number | Υ | 45 |
| 11 | `wastePct` | number | Ν | 5% |
| 12 | `grossQty` | number | Ν | 47.25 (computed) |
| 13 | `materialUnitCost` | number | Ν | 85.00 |
| 14 | `laborUnitCost` | number | Ν | 35.00 |
| 15 | `equipmentUnitCost` | number | Ν | 13.00 |
| 16 | `totalUnitCost` | number | Ν | 133.00 (computed) |
| 17 | `totalCost` | number | Ν | 6,284.25 (computed) |
| 18 | `linkedPhase` | string | Ν | Σκυροδέματα |
| 19 | `status` | string | Ν | draft |
| 20 | `source` | string | Ν | manual |
| 21 | `certifiedQty` | number | Ν | |
| 22 | `notes` | string | Ν | |

**Sheet 2: Dictionaries** (αναφοράς — για validation)

| Στήλη | Περιεχόμενο |
|-------|-----------|
| Units | m², m³, m, pcs, kg, lt, set, day, lump |
| Categories | Code + Name (12 groups) |
| Statuses | draft, submitted, approved, certified, locked |
| Scopes | building, unit |

**Sheet 3: Summary** (rollup — μόνο export)

| Κατηγορία | Items | Υλικά | Εργασίες | Εξοπλ. | Σύνολο |
|-----------|-------|-------|----------|--------|--------|
| ΟΙΚ-2: Σκυροδέματα | 5 | 12.400€ | 5.200€ | 1.800€ | 19.400€ |
| ΟΙΚ-5: Δάπεδα | 8 | 15.200€ | 7.300€ | 0€ | 22.500€ |
| ... | | | | | |
| **ΣΥΝΟΛΟ** | **35** | **45.200€** | **28.100€** | **3.400€** | **76.700€** |

### 4.2 Import Column Mapping (Smart Detection)

```typescript
interface ColumnMapping {
  // Ελληνικά aliases → canonical field
  'Περιγραφή' | 'Description' | 'Εργασία' → description
  'Μονάδα' | 'Μον.' | 'Unit' → unit
  'Ποσότητα' | 'Ποσ.' | 'Qty' | 'Quantity' → estimatedNetQty
  'Τιμή Υλικού' | 'Material' | 'Υλικό' → materialUnitCost
  'Τιμή Εργασίας' | 'Labor' | 'Εργασία €' → laborUnitCost
  'Φύρα' | 'Waste' | '%Φύρας' → wastePct
  'Κατηγορία' | 'Category' | 'ΑΤΟΕ' → categoryCode | categoryName
}
```

---

## 5. Happy Path

### 5.1 Flow: Excel Import

```
1. Χρήστης → Building → Tab "Επιμετρήσεις"
2. Click "📥 Import Excel"
3. Upload .xlsx αρχείο
4. Step 1 — Column Mapping:
   ┌──────────────────────────────────────────────┐
   │ Αντιστοίχιση Στηλών                          │
   │                                               │
   │ Στήλη Excel       →  Πεδίο BOQ               │
   │ ───────────────────────────────────────────── │
   │ [Α] "Περιγραφή"   →  [description      ▼]   │
   │ [Β] "μον"         →  [unit             ▼]   │
   │ [Γ] "Ποσότητα"    →  [estimatedNetQty  ▼]   │
   │ [Δ] "Τιμή μονάδας"→  [materialUnitCost ▼]   │
   │ [Ε] "Σημειώσεις"  →  [notes            ▼]   │
   │                                               │
   │ [🔄 Auto-detect]  [Next →]                   │
   └──────────────────────────────────────────────┘

5. Step 2 — Validation Preview:
   ┌──────────────────────────────────────────────┐
   │ Προεπισκόπηση Εισαγωγής                      │
   │                                               │
   │ ✅ 18 γραμμές OK                              │
   │ ⚠️ 3 γραμμές με warnings                      │
   │ ❌ 2 γραμμές με errors                        │
   │                                               │
   │ ┌───┬──────────┬────┬──────┬────────────────┐│
   │ │Row│Περιγραφή │Unit│Qty   │Status           ││
   │ ├───┼──────────┼────┼──────┼────────────────┤│
   │ │ 2 │Θεμέλια   │ m³ │  45  │ ✅ OK           ││
   │ │ 3 │Πλάκα ορ. │ m³ │  38  │ ✅ OK           ││
   │ │ 4 │Πλακάκια  │ μ  │ 120  │ ⚠️ Unit → m²?   ││
   │ │ 5 │Κολώνες   │ m³ │  -5  │ ❌ Qty < 0      ││
   │ │ 6 │          │ m² │  30  │ ❌ No desc       ││
   │ └───┴──────────┴────┴──────┴────────────────┘│
   │                                               │
   │ [☑ Skip errors] [Import 18+3 rows]           │
   └──────────────────────────────────────────────┘

6. Step 3 — Category Assignment:
   • Αν η κατηγορία δεν αναγνωρίστηκε:
     "Πλακάκια δαπέδου" → best match: [ΟΙΚ-5: Δάπεδα ▼]
   • Smart matching via synonymsEl

7. Click "Import"
8. Items δημιουργούνται ως status = 'draft'
9. Summary: "Εισήχθησαν 21 items, 2 απορρίφθηκαν"
10. Rejection report download (.xlsx) — lines + error reasons
```

### 5.2 Flow: Excel Export

```
1. Χρήστης → Building → Tab "Επιμετρήσεις"
2. Click "📤 Export Excel"
3. Options:
   ┌──────────────────────────────────────────────┐
   │ Εξαγωγή Excel                                │
   │                                               │
   │ Εύρος:                                        │
   │ (●) Ολόκληρο κτίριο                          │
   │ ( ) Μόνο κατηγορία: [ΟΙΚ-2 ▼]               │
   │ ( ) Μόνο φίλτρο (τρέχον)                     │
   │                                               │
   │ Περιεχόμενο:                                  │
   │ [☑] Κόστη (material, labor, equipment)        │
   │ [☑] Variance (estimated vs certified)         │
   │ [☑] Sheet Summary                             │
   │ [☑] Sheet Dictionaries                        │
   │                                               │
   │ [Ακύρωση] [📥 Λήψη .xlsx]                    │
   └──────────────────────────────────────────────┘

4. Download .xlsx (3 sheets)
5. Filename: "{BuildingName}_BOQ_{date}.xlsx"
```

### 5.3 Flow: PDF Export — Dual Mode

```
1. Χρήστης → Click "🖨️ PDF"
2. Options:
   ┌──────────────────────────────────────────────┐
   │ Εξαγωγή PDF                                  │
   │                                               │
   │ Μορφή:                                        │
   │ (●) ΑΤΟΕ — Τιμολογιακή (Tender mode)         │
   │     Τελική τιμή μονάδας + ΓΕ/ΟΕ στο τέλος    │
   │ ( ) Αναλυτική (Internal/Detailed mode)        │
   │     Υλικά / Εργασίες / Εξοπλισμός ανά γραμμή │
   │                                               │
   │ Εύρος:                                        │
   │ (●) Ολόκληρο κτίριο                          │
   │ ( ) Μόνο κατηγορία: [ΟΙΚ-2 ▼]               │
   │                                               │
   │ Extras:                                       │
   │ [☑] Variance column (est. vs certified)       │
   │ [☑] Company logo                              │
   │ [☑] Signature line                            │
   │                                               │
   │ [Ακύρωση] [📄 Προεπισκόπηση] [📥 Λήψη PDF]   │
   └──────────────────────────────────────────────┘
```

### 5.4 PDF Layout — Tender Mode (ΑΤΟΕ)

```
┌──────────────────────────────────────────────────────┐
│ [LOGO]  ΑΝΑΛΥΤΙΚΗ ΕΠΙΜΕΤΡΗΣΗ                         │
│         Κτίριο: Πολυκατοικία Α                       │
│         Έργο: Παγώνης Α.Ε. #12                       │
│         Ημερομηνία: 11/02/2026                        │
├────┬──────┬────────────────┬────┬───────┬──────┬─────┤
│ Α/Α│Άρθρο │ Περιγραφή      │Μον │ Ποσ.  │Τιμή  │Δαπ. │
├────┼──────┼────────────────┼────┼───────┼──────┼─────┤
│    │      │ ΟΙΚ-2: ΣΚΥΡΟΔ. │    │       │      │     │
│ 1  │2.1   │ Θεμέλια C25/30 │ m³ │ 47.25 │133€  │6.284│
│ 2  │2.2   │ Πλάκα οροφής   │ m³ │ 39.90 │140€  │5.586│
│ 3  │2.3   │ Κολώνες Φ40    │ m³ │ 23.10 │147€  │3.396│
│    │      │ Υποσύνολο      │    │       │      │15.27│
├────┼──────┼────────────────┼────┼───────┼──────┼─────┤
│    │      │ ΟΙΚ-5: ΔΑΠΕΔΑ  │    │       │      │     │
│ 4  │5.1   │ Πλακάκια 60x60 │ m² │129.60 │ 40€  │5.184│
│ ...│      │                │    │       │      │     │
├────┴──────┴────────────────┴────┴───────┴──────┴─────┤
│ ΜΕΡΙΚΟ ΑΘΡΟΙΣΜΑ:                          76.700,00€  │
│ ΓΕ & ΟΕ (18%):                            13.806,00€  │
│ Απρόβλεπτα (9%):                           6.903,00€  │
│ ΓΕΝΙΚΟ ΣΥΝΟΛΟ:                            97.409,00€  │
├──────────────────────────────────────────────────────┤
│                                                       │
│ Ο Μηχανικός                     Ο Εργοδότης           │
│ _______________                 _______________        │
│                                                       │
│ Ημερομηνία: ___/___/______                            │
└──────────────────────────────────────────────────────┘
```

### 5.5 PDF Layout — Detailed Mode (Internal)

Ίδιο layout αλλά:
- 3 extra στήλες: Υλικό/μ, Εργασία/μ, Εξοπλ./μ (αντί τελικής τιμής)
- Waste column visible
- Variance column (αν checked)
- Δεν περιλαμβάνει ΓΕ/ΟΕ/Απρόβλεπτα (εσωτερική χρήση)

---

## 6. Import Validation Rules

| # | Κανόνας | Σοβαρότητα | Ενέργεια |
|---|---------|-----------|----------|
| 1 | description κενό | ❌ Error | Skip row |
| 2 | estimatedNetQty ≤ 0 | ❌ Error | Skip row |
| 3 | unit δεν αναγνωρίζεται | ❌ Error | Skip row (suggest alternatives) |
| 4 | unit δεν ανήκει σε allowedUnits κατηγορίας | ❌ Error | Skip row |
| 5 | wastePct > 30% | ⚠️ Warning | Allow with highlight |
| 6 | materialUnitCost < 0 | ❌ Error | Skip row |
| 7 | Duplicate (building + category + description) | ⚠️ Warning | Allow (flag in UI) |
| 8 | Κατηγορία δεν αναγνωρίζεται | ⚠️ Warning | Manual mapping required |
| 9 | Κατηγορία deprecated | ⚠️ Warning | Auto-map to replacement |
| 10 | File > 1000 rows | ⚠️ Warning | Allow, batch processing |

### Import Normalization

```typescript
// Synonym matching for category detection
function matchCategory(input: string, categories: BOQCategory[]): MatchResult {
  // 1. Exact code match
  const exact = categories.find(c => c.code === input || c.legacyCode === input);
  if (exact) return { category: exact, confidence: 1.0 };

  // 2. Synonym match (Greek)
  const synonym = categories.find(c =>
    c.synonymsEl.some(s => input.toLowerCase().includes(s.toLowerCase()))
  );
  if (synonym) return { category: synonym, confidence: 0.85 };

  // 3. Fuzzy match
  const fuzzy = bestFuzzyMatch(input, categories.map(c => c.nameEl));
  if (fuzzy.score > 0.7) return { category: fuzzy.category, confidence: fuzzy.score };

  return { category: null, confidence: 0 };
}
```

---

## 7. Edge Cases

| # | Σενάριο | Συμπεριφορά |
|---|---------|-------------|
| 1 | Excel χωρίς header row | Auto-detect: αν row 1 = all strings → header, αλλιώς → "Επιλέξτε header row" |
| 2 | Mixed Greek/English columns | Normalize via column mapping aliases |
| 3 | Decimal comma vs dot (1.234 vs 1,234) | Detect locale, normalize to dot |
| 4 | Excel formulas αντί values | Read computed values (openpyxl/SheetJS reads values) |
| 5 | Very large Excel (5000+ rows) | Batched processing, progress indicator |
| 6 | Import into building with existing items | Merge mode: add new, skip duplicates, update existing (user choice) |
| 7 | PDF with > 100 items | Multi-page, page break ανά κατηγορία |
| 8 | Price List import (separate Excel) | Separate flow: Settings → Import τιμοκατάλογο (UC-BOQ-002 bridge) |
| 9 | PDF preview slow (large data) | Lazy render, pagination |
| 10 | Export while items are being edited | Snapshot at export time, no locks |

---

## 8. Service Operations

```typescript
interface ImportExportService {
  // Excel Import
  parseExcelFile(file: File): Promise<ParsedExcelData>;
  mapColumns(parsedData: ParsedExcelData, mapping: ColumnMapping): MappedRows[];
  validateRows(rows: MappedRows[]): ValidationResult[];
  importRows(buildingId: string, validRows: MappedRows[]): Promise<ImportResult>;
  generateRejectionReport(rejectedRows: ValidationResult[]): Blob;

  // Excel Export
  exportBuildingToExcel(buildingId: string, options: ExcelExportOptions): Promise<Blob>;
  exportProjectToExcel(projectId: string): Promise<Blob>;
  exportPriceListToExcel(priceListId: string): Promise<Blob>;

  // PDF Export
  generateBuildingPDF(buildingId: string, options: PDFExportOptions): Promise<Blob>;
  generateProjectPDF(projectId: string, options: PDFExportOptions): Promise<Blob>;
  previewPDF(buildingId: string, options: PDFExportOptions): Promise<string>;  // URL

  // Price List Import (bridge to UC-BOQ-002)
  importPriceListFromExcel(file: File, priceListId: string): Promise<ImportResult>;
}

interface ExcelExportOptions {
  scope: 'building' | 'category' | 'filter';
  categoryCode?: string;
  includeCosts: boolean;
  includeVariance: boolean;
  includeSummary: boolean;
  includeDictionaries: boolean;
}

interface PDFExportOptions {
  mode: 'tender' | 'detailed';
  scope: 'building' | 'category';
  categoryCode?: string;
  includeVariance: boolean;
  includeLogo: boolean;
  includeSignatureLine: boolean;
  geOePct?: number;        // ΓΕ & ΟΕ % (tender mode)
  contingencyPct?: number; // Απρόβλεπτα % (tender mode)
}
```

---

## 9. Affected Files

### 9.1 Νέα Αρχεία

```
src/services/measurements/excel-import-service.ts        # Parse + validate + import
src/services/measurements/excel-export-service.ts        # Generate .xlsx
src/services/measurements/pdf-export-service.ts          # Generate PDF (ΑΤΟΕ format)
src/services/measurements/column-mapper.ts               # Smart column mapping
src/services/measurements/category-matcher.ts            # Synonym-based category matching
src/components/building-management/measurements/ExcelImportWizard.tsx
src/components/building-management/measurements/ExcelImportColumnMapper.tsx
src/components/building-management/measurements/ExcelImportPreview.tsx
src/components/building-management/measurements/ExcelExportDialog.tsx
src/components/building-management/measurements/PDFExportDialog.tsx
src/components/building-management/measurements/PDFPreviewModal.tsx
```

### 9.2 Τροποποιούμενα Αρχεία

```
src/components/building-management/measurements/BOQActionsBar.tsx   # Import/Export/PDF buttons
src/services/measurements/index.ts                                  # +import/export exports
src/i18n/locales/el/measurements.json                               # +import/export translations
src/i18n/locales/en/measurements.json
```

### 9.3 Αξιοποίηση Υπάρχοντος Κώδικα

```
src/components/obligations/pdf.ts                  # Existing PDF engine → reuse patterns
src/components/obligations/pdf-export-button.tsx   # Existing export button → reference
```

---

## 10. Technical Dependencies

| Dependency | Σκοπός | License | Status |
|-----------|--------|---------|--------|
| **SheetJS (xlsx)** | Excel parse/generate | Apache 2.0 ✅ | Community edition |
| **jsPDF** ή **@react-pdf/renderer** | PDF generation | MIT ✅ | Ελέγχεται existing usage |
| **pdfmake** | Alternative PDF | MIT ✅ | If needed |

**Σημείωση:** Ελεγχθεί αν ήδη υπάρχει Excel/PDF library στο project (obligations module).

---

## 11. Acceptance Criteria

### Excel Import
- [ ] Upload .xlsx → parsed successfully
- [ ] Smart column mapping: auto-detect Greek/English headers
- [ ] Validation preview: ✅/⚠️/❌ per row
- [ ] Category matching: exact code → synonym → fuzzy
- [ ] Import creates items with status='draft'
- [ ] Rejection report (.xlsx) downloadable
- [ ] Duplicate detection (warning, not block)
- [ ] Decimal comma/dot normalization
- [ ] Batch processing for large files (1000+ rows)

### Excel Export
- [ ] Export .xlsx with 3 sheets (Items, Dictionaries, Summary)
- [ ] Scope: building / category / filter
- [ ] Costs columns optional
- [ ] Variance column optional
- [ ] Filename: "{BuildingName}_BOQ_{date}.xlsx"

### PDF Export
- [ ] Tender mode: ΑΤΟΕ format, τελική τιμή, ΓΕ/ΟΕ/Απρόβλεπτα
- [ ] Detailed mode: 3-way cost split, waste column
- [ ] Multi-page with page breaks ανά κατηγορία
- [ ] Company logo placement
- [ ] Signature line
- [ ] Preview modal before download
- [ ] Print button (direct print without download)

### Price List Import (bridge)
- [ ] Import price items from Excel → price list
- [ ] Same validation rules as BOQ import

---

## 12. Out of Scope

- Import from PDF (OCR-based) → Future
- Import from other software formats (PlanSwift, CostX) → Future
- Automated email send of PDF → Future
- Multi-language PDF (EL + EN in same document) → Future
- Digital signature (qualified electronic signature) → Future

---

*Implementation contract for ADR-175 Phase 1C (Excel) + 1D (PDF). Excel template follows the 22-column spec from parallel research. PDF follows ΑΤΟΕ format per Greek construction practice.*
