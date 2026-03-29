# SPEC-004: UI Wireframes & User Flow

**ADR**: 268 — Dynamic Report Builder
**Version**: 2.0
**Last Updated**: 2026-03-29

---

## Main Layout

```
┌──────────────────────────────────────────────────────┐
│  /reports/builder                                     │
│                                                       │
│  ┌── Domain ──────┐  ┌── Saved Reports ────────────┐ │
│  │ [Μονάδες    ▼] │  │ [Επιλέξτε αποθηκευμένη.. ▼]│ │
│  └────────────────┘  └─────────────────────────────┘ │
│                                                       │
│  ┌── Φίλτρα ─────────────────────────────────────┐   │
│  │ Εταιρεία: [Όλες ▼]  Έργο: [Κορδελιό ▼]       │   │
│  │ Status: [Πωλημένο ▼]  [+ Φίλτρο]             │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  ┌── Στήλες ──────────┐  ┌── Group By ───────────┐  │
│  │ ☑ Κωδικός          │  │ [Κτίριο ▼] [Status ▼]│  │
│  │ ☑ Κτίριο           │  └──────────────────────┘  │
│  │ ☑ Τύπος            │                             │
│  │ ☑ Τιμή             │  [🔍 Εκτέλεση]             │
│  └────────────────────┘                              │
│                                                       │
│  ┌── KPIs ───────────────────────────────────────┐   │
│  │ 📊 156 μονάδες │ 💰 €12.5M │ ✅ 89 πωλημένα  │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  ┌── Chart ──────────────────────────────────────┐   │
│  │ Chart Type: [Bar ▼] [Pie] [Line] [Stacked]   │   │
│  │                                                │   │
│  │  Κτίριο Α  ██████████████████  52  (€4.2M)   │   │
│  │  Κτίριο Β  ████████████████    48  (€3.8M)   │   │
│  │  Κτίριο Γ  ██████████         35  (€2.8M)    │   │
│  │                                                │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  ┌── Πίνακας (grouped) ─────────────────────────┐   │
│  │ ▼ Κτίριο Α (52, Σύνολο: €4.2M)              │   │
│  │   A-101 │ Στούντιο │ Πωλημένο │ €65K         │   │
│  │ ▼ Κτίριο Β (48, Σύνολο: €3.8M)              │   │
│  │   B-101 │ 3αρι    │ Κρατημένο │ €120K        │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  ┌── Export Bar ─────────────────────────────────┐   │
│  │ [💾 Save] [📄 PDF] [📊 Excel] [📋 Tier 2/3] │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

> **Σημαντικό**: Το Chart εμφανίζεται **ΠΑΝΩ** από τον πίνακα (visual-first approach).
> Ό,τι έχει grouping ή aggregation → αυτόματα παράγεται chart.
> Ο χρήστης μπορεί να αλλάξει τύπο chart (Bar/Pie/Line/Stacked).
> Το ίδιο chart εξάγεται ως εικόνα στο PDF + ως native Excel chart στο Excel.

## Component Tree

```
ReportBuilderPage
├── DomainSelector          (Radix Select — 20 domains grouped)
├── SavedReportSelector     (Radix Select — load/save/delete)
├── FilterPanel
│   ├── FilterRow × N       (field + operator + value)
│   └── AddFilterButton
├── ColumnSelector          (Checkbox list, scrollable)
├── GroupBySelector          (1-2 Radix Selects)
├── ExecuteButton
└── ReportResults
    ├── ReportKPIGrid       (reuse ADR-265)
    ├── ReportChartSection
    │   ├── ChartTypeSelector   (toggle: bar/pie/line/area/stacked)
    │   └── ReportChart         (reuse ADR-265, recharts)
    ├── ReportTable         (reuse ADR-265, grouped mode)
    └── BuilderExportBar
        ├── SaveButton          (💾 → saved_reports)
        ├── PdfExportButton     (📄 → KPIs + chart image + table)
        ├── ExcelExportButton   (📊 → 4-sheet enterprise workbook)
        └── AdvancedExportMenu  (📋 → Tier 2 row repetition / Tier 3 card)
```

## Domain Selector Groups

```
[Domain ▼]
├── 🏗️ Ακίνητα
│   ├── Έργα
│   ├── Κτίρια
│   ├── Όροφοι
│   ├── Μονάδες
│   ├── Θέσεις Στάθμευσης
│   └── Αποθήκες
├── 👥 Άνθρωποι
│   ├── Φυσικά Πρόσωπα
│   ├── Εταιρείες
│   ├── Αγοραστές
│   ├── Προμηθευτές
│   ├── Μηχανικοί
│   ├── Εργάτες
│   ├── Δικηγόροι / Συμβολαιογράφοι
│   └── Μεσίτες
├── 💰 Οικονομικά
│   ├── Πλάνα Πληρωμών
│   ├── Αξιόγραφα
│   ├── Συμβόλαια
│   ├── Μεσιτικές Συμφωνίες
│   ├── Προμήθειες
│   ├── Παραγγελίες Αγοράς
│   └── Πίνακας Ιδιοκτησίας
├── 🔨 Κατασκευή
│   ├── Φάσεις
│   ├── Εργασίες
│   ├── Πόροι
│   └── Κοστολόγηση BOQ
├── 📞 CRM
│   ├── Ευκαιρίες Pipeline
│   └── Εργασίες
└── 📊 Λογιστική
    ├── Τιμολόγια
    └── Ημερολόγιο
```

## Responsive Behavior

- Desktop (>1024px): Side-by-side layout (filters left, results right)
- Tablet (768-1024px): Stacked layout (filters top, results bottom)
- Mobile: Not primary target — basic functionality
