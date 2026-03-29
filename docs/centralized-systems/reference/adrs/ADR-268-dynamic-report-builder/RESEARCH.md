# ADR-268 Research: Dynamic Report Builder

**Date**: 2026-03-29
**Scope**: Έρευνα κώδικα + διαδίκτυο

---

## 1. Έρευνα Κώδικα

### 1.1 Υπάρχουσα Report Υποδομή (ADR-265)

- 9 Report Pages, 8 API Routes, 9 Hooks, 12 Core UI Components
- PDF Export (jsPDF + autotable, Greek Roboto)
- Excel Export (ExcelJS, 4-sheet workbook)
- Design Tokens, i18n, Export Center
- **Δεν χρειάζεται καμία νέα βιβλιοθήκη**

### 1.2 Χαρτογράφηση Οντοτήτων (68 collections)

| Κατηγορία | Collections |
|-----------|------------|
| **Επαφές & Εταιρείες** (5) | contacts, companies, contact_relationships, contact_links, external_identities |
| **Έργα & Ακίνητα** (4) | projects, buildings, units, floors |
| **Χώροι** (2) | parking_spots, storage_units |
| **Οικονομικά** (8) | payment_plans, payments, cheques, legal_contracts, brokerage_agreements, commission_records, ownership_tables, purchase_orders |
| **Κατασκευή** (5) | construction_phases, construction_tasks, construction_baselines, construction_resource_assignments, building_milestones |
| **CRM** (5) | opportunities, communications, conversations, tasks, activities |
| **Αρχεία** (7+) | files, file_audit_log, file_shares, file_comments, file_folders, file_approvals, document_templates |
| **Λογιστική** (7+) | accounting_invoices, accounting_journal_entries, accounting_bank_transactions, accounting_fixed_assets, accounting_depreciation_records, accounting_efka_payments, accounting_expense_documents |
| **Εργασιακά** (3) | employment_records, attendance_events, digital_work_cards |
| **Υποχρεώσεις** (1) | obligations |
| **Σύστημα** (5+) | workspaces, workspace_members, assignment_policies, entity_audit_trail, settings |
| **Προμήθειες** (2) | purchase_orders, purchase_order_counters |
| **AI** (3) | ai_chat_history, ai_pipeline_queue, email_ingestion_queue |

### 1.3 Persona System (ADR-121)

| Persona | Ελληνικά | Ειδικά Πεδία |
|---------|---------|-------------|
| `construction_worker` | Εργάτης | ΑΜ ΙΚΑ, ασφ. κλάση, τριετίες, ημερομίσθιο, κωδ. ΕΦΚΑ |
| `engineer` | Μηχανικός | ΤΕΕ, ειδικότητα, κλάση, ΠΤΔΕ |
| `accountant` | Λογιστής | ΟΕΕ, κλάση |
| `lawyer` | Δικηγόρος | Μητρώο ΔΣ |
| `property_owner` | Ιδιοκτήτης | Αρ. ιδιοκτησιών |
| `client` | Πελάτης | Ημ/νία εγγραφής |
| `supplier` | Προμηθευτής | Κατηγορία, όροι πληρωμής |
| `notary` | Συμβολαιογράφος | Μητρώο, περιφέρεια |
| `real_estate_agent` | Μεσίτης | Αρ. αδείας, γραφείο |

### 1.4 Ιεραρχία Οντοτήτων

```
COMPANY (tenant)
  └─ PROJECT
      ├─ landowners[] (οικοπεδούχοι, bartex%)
      └─ BUILDING
          ├─ FLOOR
          │   └─ UNIT
          │       ├─ commercial{} (τιμές, αγοραστής, νομική φάση)
          │       ├─ linkedSpaces[] → PARKING / STORAGE
          │       ├─ payment_plans → payments
          │       └─ legal_contracts
          ├─ PARKING_SPOT
          ├─ STORAGE_UNIT
          ├─ CONSTRUCTION_PHASE → TASK → RESOURCE_ASSIGNMENT
          ├─ BUILDING_MILESTONE
          ├─ BOQ_ITEM
          └─ OWNERSHIP_TABLE

CONTACT (individual | company | service)
  ├─ personas[] (9 ρόλοι)
  ├─ contact_links → project/building/unit
  ├─ contact_relationships
  ├─ opportunities, communications, tasks
  ├─ employment_records, attendance_events
  └─ cheques

ACCOUNTING (subapp)
  ├─ invoices, journal entries, bank transactions
  ├─ fixed assets, depreciation
  └─ expense documents (AI scan)
```

---

## 2. Έρευνα Διαδικτύου

### 2.1 Μεγάλες Κατασκευαστικές

Vinci, Bouygues, Skanska, Hochtief, AECOM χρησιμοποιούν custom platforms + Oracle Primavera + Power BI.

Βασικοί τύποι αναφορών: cost variance, schedule performance (EVM), safety/compliance, subcontractor performance, cash flow forecasting, monthly status reports, portfolio dashboards.

### 2.2 Construction Software

| Εργαλείο | Report Builder | Export | Ξεχωριστό |
|----------|---------------|--------|-----------|
| **Procore** | Drag-and-drop, multi-criteria, GROUP BY, aggregations | PDF, XLSX | AI Agent Builder |
| **Oracle P6** | 70+ reports + Report Wizard | PDF, CSV, XML | WBS hierarchy |
| **Sage 300** | 1,400+ prebuilt + custom | PDF, XLSX, CSV | 6 cost types |
| **Autodesk ACC** | Insight Builder | Power BI | Predictive Analytics |
| **SmartPM** | Role-based templates | PDF, XLSX | AI scheduling |

### 2.3 Best Practices Report Builder UI

- Data Source Selection (dropdown/wizard)
- Column Selection (checkboxes / drag-and-drop)
- Multi-Criteria Filters (AND/OR, type-aware)
- Grouping (1-3 levels, subtotals)
- Aggregations (COUNT, SUM, AVG, MIN, MAX)
- Drill-Down (Portfolio → Project → Phase → Task)
- Saved Reports (personal + shared)
- Export (PDF branded, XLSX multi-sheet, CSV)

### 2.4 Ελληνική Αγορά

| Αναφορά | Data |
|---------|------|
| ΕΣΠΑ Προόδου | projects, construction_phases, boq_items |
| myDATA Reconciliation | accounting_invoices |
| ΠΕΑ Status | buildings.energyClass, units.energy |
| e-Άδειες Tracking | projects (permits) |
| ΕΝΦΙΑ/E9 | buildings, units |
| ΦΠΑ Κατασκευής | boq_items, accounting_invoices |

### 2.5 Nested Entity Export — Industry Standard

| Platform | Flat Table | Row Repetition | Multi-Sheet | Contact Card PDF |
|----------|:---:|:---:|:---:|:---:|
| **Salesforce** | ✅ Primary | ✅ | ❌ | ❌ (3rd party) |
| **SAP S/4HANA** | ✅ ALV | ✅ | ❌ | ❌ (Smart Forms) |
| **Dynamics 365** | ✅ | ✅ | ✅ Word Templates | ✅ Word Templates |
| **Procore** | ✅ CSV | ✅ | ❌ | ✅ PDF Directory |
| **Oracle/Primavera** | ✅ | ✅ | ❌ | ✅ BI Publisher |
| **HubSpot** | ✅ + semicolons | ✅ Reports | ❌ | ❌ |
| **Zoho CRM** | ✅ | ✅ | ❌ | ✅ Print Layout |

**Συμπεράσματα:**
1. Flat table with row repetition = universal standard
2. Multi-sheet Excel = σπάνιο (μόνο Dynamics 365)
3. Contact Card PDF = premium feature (Procore, Dynamics, Oracle, Zoho)
4. Semicolon concatenation (HubSpot) = pragmatic αλλά μοναδικό

---

## 3. Phase 2 UX Research: Grouping, Charts, KPIs (2026-03-29)

### 3.1 "Group By" Selector — Ποιο Pattern;

**Σύσταση: Chip Bar (Pills) με Dropdown Trigger + Drag-to-Reorder**

| Pattern | Πλεονεκτήματα | Μειονεκτήματα | Ποιος το χρησιμοποιεί |
|---------|--------------|---------------|----------------------|
| **Dropdown (single)** | Απλό, γνωστό | 1 μόνο group level, κρύβει επιλογή | Basic BI tools |
| **Multi-select dropdown + chips** | Πολλαπλά levels, ορατή επιλογή | Δεν δείχνει order/priority | Looker, Metabase |
| **Drag-and-drop zone** | Ισχυρό, flexible | Steep learning curve, accessibility issues | Power BI, SSRS |
| **Chip bar (pills) + dropdown** | Ορατό, reorderable, removable, intuitive | Χώρος στη toolbar | Google Sheets pivot, AG Grid |

**Βέλτιστη υλοποίηση (Google-level):**
1. **Dropdown trigger**: "Group By" κουμπί ανοίγει dropdown με searchable πεδία
2. **Chip rendering**: Κάθε επιλεγμένο πεδίο εμφανίζεται ως chip/pill στη toolbar
3. **Reorder**: Drag-to-reorder chips (chip 1 = primary group, chip 2 = secondary, κλπ.)
4. **Remove**: X button σε κάθε chip για αφαίρεση
5. **Max levels**: 3 (περισσότερα = cognitive overload)
6. **"Clear All"**: Κουμπί για reset

**Accessibility:** Κάθε chip εκφράζεται ως `role="listitem"` σε `role="list"`, με `aria-label="Group by [field], level [n]"`. Reorder γίνεται και με keyboard (Up/Down arrows αλλάζουν θέση).

**Πηγές:**
- [Dropdown Cheat Sheet (Medium)](https://medium.com/design-bootcamp/dropdown-cheat-sheet-a-practical-guide-for-ui-ux-designers-3d07903aaaa4)
- [Badges vs Pills vs Chips vs Tags (Smart Interface Design)](https://smart-interface-design-patterns.com/articles/badges-chips-tags-pills/)
- [Material Web Chips](https://material-web.dev/components/chip/)
- [Smartsheet Report Builder Grouping](https://help.smartsheet.com/articles/2482082-configure-grouping-to-organize-results-in-report-builder)

---

### 3.2 Subtotal Rows — Οπτική Διαφοροποίηση

**Σύσταση: Bold + Subtle Background + Indent**

| Τεχνική | Ρόλος | Παράδειγμα |
|---------|-------|-----------|
| **Bold font-weight** | Primary differentiator | `font-weight: 600` στο subtotal row |
| **Background tint** | Secondary differentiator | `bg-muted/50` ή `bg-accent/10` ανά level |
| **Indentation** | Δείχνει ιεραρχία | Level 0: 0px, Level 1: 24px, Level 2: 48px |
| **Border-top** | Οπτικός διαχωριστής | 1px solid border πάνω από subtotal |
| **Row height** | Emphasis | Subtotals λίγο ψηλότερα (48px vs 40px data rows) |

**Κανόνες ανά Level:**
- **Group Header (Level 0)**: Bold, darker background (`bg-muted`), chevron expand/collapse, full-width span
- **Subtotal (Level 1)**: Semi-bold, lighter background (`bg-muted/30`), indented, aggregation values
- **Grand Total**: Extra bold, distinct background (`bg-primary/10`), top border 2px

**AG Grid pattern (industry standard):**
- Group rows span across columns by default
- `groupTotalRow: 'bottom'` places subtotal at bottom of each group
- Child rows auto-indent with padding-left
- Custom `rowClassRules` for conditional styling per level

**Best practice (Nested Tables UX - Medium/Bootcamp):**
- Max 2 levels deep (Parent > Child > Grandchild)
- Bold parent rows, consistent typography across levels
- Soft background shading to distinguish nesting layers
- "Humans can comfortably hold 5-9 items in working memory" (Miller's Law)

**Πηγές:**
- [Designing Nested Tables UX (Medium)](https://medium.com/design-bootcamp/designing-nested-tables-the-ux-of-showing-complex-data-without-creating-chaos-0b25f8bdd7d9)
- [Enterprise Data Tables UX (Pencil & Paper)](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- [AG Grid Row Grouping](https://www.ag-grid.com/react-data-grid/grouping-group-rows/)
- [AG Grid Aggregation Total Rows](https://www.ag-grid.com/javascript-data-grid/aggregation-total-rows/)

---

### 3.3 Grand Total Row — Top, Bottom, ή Both;

**Σύσταση: Bottom (default) + Option for Top**

| Θέση | Use Case | Ποιος το κάνει |
|------|----------|---------------|
| **Bottom (default)** | Standard αναφορές, accounting pattern, "read then summarize" | Excel, Tableau, AG Grid, SSRS |
| **Top** | Executive dashboards, "answer first", KPI-first view | Power BI matrix, Syncfusion Pivot |
| **Both** | Πολύ μεγάλα datasets (100+ rows), scrolling χωρίς να χάνεται context | Excel pivot (custom), Intacct |

**Reasoning:**
- **Bottom = accounting convention** — Λογιστές/μηχανικοί αναμένουν σύνολα στο τέλος
- **Top = executive convention** — Managers θέλουν "the answer" πρώτα
- **Both = power user** — Για μεγάλα datasets, sticky footer ή duplicated row

**Πρόταση για Nestor:**
1. **Default: Bottom** (ταιριάζει στο construction/accounting persona)
2. **User preference toggle**: "Show grand total at top" checkbox στο report config
3. **Sticky footer**: Αν τo dataset > 20 rows, grand total κάνει `position: sticky; bottom: 0`

**Πηγές:**
- [Excel Pivot Grand Total at Top (ExtendOffice)](https://www.extendoffice.com/documents/excel/1962-excel-pivot-table-grand-total-at-top.html)
- [Power BI Grand Totals at Top (P3 Adaptive)](https://p3adaptive.com/grand-total-mania-totals-at-top-multiple-totals/)
- [Syncfusion Pivot Table Totals](https://blazor.syncfusion.com/documentation/pivot-table/show-hide-totals)
- [Tableau Show Totals](https://help.tableau.com/current/pro/desktop/en-us/calculations_totals_grandtotal_turnon.htm)

---

### 3.4 Chart-Table Interaction (Bidirectional Linked Views)

**Σύσταση: Cross-Filter + Cross-Highlight (Power BI pattern)**

**Pattern: Click Chart Segment → Filter Table**

| Interaction Type | Περιγραφή | Πότε |
|-----------------|-----------|------|
| **Cross-filter** | Click chart segment → table δείχνει ΜΟΝΟ εκείνα τα rows | Pie chart, bar chart segments |
| **Cross-highlight** | Click chart → table highlight (dim others, don't remove) | Stacked bars, area charts |
| **Drill-through** | Click chart → navigate to detail page/view | Deep analysis |
| **No impact** | Charts και table ανεξάρτητα | Side-by-side comparison |

**Υλοποίηση (Google-level):**
1. **Click pie segment** → table filters to show only that group's rows
2. **Active state**: Chart segment gets `opacity: 1`, rest get `opacity: 0.3`
3. **Breadcrumb/chip**: "Filtered by: [segment name]" chip appears above table
4. **Click again or X**: Removes filter, restores full view
5. **Hover**: Tooltip on chart + highlight corresponding rows in table

**Bidirectional:**
- Click table row → highlight corresponding segment in chart
- Η table selection ΔΕΝ φιλτράρει το chart (μόνο highlight) — αλλιώς confusion

**Power BI model (industry standard):**
- Default: Cross-filter + cross-highlight ενεργά
- Per-visual override: Filter / Highlight / None
- Drill-down in one visual can optionally filter others (`Drilling filters other visuals: On`)
- Sort in table auto-syncs linked chart

**Πηγές:**
- [Power BI Visual Interactions (Microsoft)](https://learn.microsoft.com/en-us/power-bi/create-reports/service-reports-visual-interactions)
- [SSRS Linked Data Regions (Microsoft)](https://learn.microsoft.com/en-us/sql/reporting-services/report-design/linking-multiple-data-regions-to-the-same-dataset-report-builder-and-ssrs)
- [Dashboard UX Patterns (Pencil & Paper)](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)

---

### 3.5 Accessibility — Expand/Collapse Grouped Rows

**Σύσταση: WAI-ARIA Treegrid Pattern**

**Required ARIA attributes:**

| Attribute | Πού | Τιμή |
|-----------|-----|------|
| `role="treegrid"` | Container `<table>` | — |
| `role="row"` | Κάθε `<tr>` | — |
| `role="gridcell"` | Κάθε `<td>` | — |
| `aria-expanded="true/false"` | Parent row `<tr>` | Expand state |
| `aria-level="1/2/3"` | Κάθε row | Ιεραρχικό level |
| `aria-setsize` | Row | Αριθμός siblings |
| `aria-posinset` | Row | Θέση μέσα στο set |
| `aria-rowcount` | `<table>` | Σύνολο rows (visible + hidden) |
| `aria-label` / `aria-labelledby` | `<table>` | Table title |

**Keyboard Navigation (W3C APG):**

| Πλήκτρο | Ενέργεια |
|---------|---------|
| `Right Arrow` | Expand collapsed parent / Move to next cell |
| `Left Arrow` | Collapse expanded parent / Move to prev cell |
| `Up Arrow` | Move to row above |
| `Down Arrow` | Move to row below |
| `Enter` / `Space` | Toggle expand/collapse on parent row |
| `Home` | First cell in row |
| `End` | Last cell in row |
| `Ctrl+Home` | First cell in treegrid |
| `Ctrl+End` | Last cell in treegrid |

**Screen Reader Considerations:**
- Treegrids operate in **application mode** — screen readers hear only focusable elements
- ALL meaningful content must be either focusable or label a focusable element
- Visual design MUST distinguish between selected items and focused item
- `aria-expanded` is ONLY valid on rows within a treegrid (not plain table/grid)

**Fallback for Simple Cases:**
Αν η ιεραρχία είναι 1 level only, μπορεί να χρησιμοποιηθεί απλό `<details>/<summary>` pattern αντί για full treegrid.

**Πηγές:**
- [W3C WAI Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/)
- [MDN: ARIA treegrid role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/treegrid_role)
- [MDN: aria-expanded](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-expanded)
- [AG Grid Accessibility](https://www.ag-grid.com/javascript-data-grid/accessibility/)

---

### 3.6 "Percentage of Total" Column σε Grouped Views

**Σύσταση: NAI — ως Optional Column**

| Τύπος % | Υπολογισμός | Use Case |
|---------|------------|----------|
| **% of Grand Total** | `group_sum / grand_total * 100` | "Πόσο % είναι κάθε project στο σύνολο;" |
| **% of Parent Group** | `child_sum / parent_sum * 100` | "Πόσο % είναι κάθε building στο project;" |
| **% of Row Total** | `cell_value / row_total * 100` | Pivot tables, matrix views |

**Best Practices:**
1. **Μην δείχνεις % by default** — θόρυβος. Μόνο αν ο user το ζητήσει
2. **Toggle option**: "Show % of total" checkbox στις column options
3. **Formatting**: 1 decimal place (`12.3%`), right-aligned
4. **Visual**: Optional mini bar (ala GitHub language bar) μέσα στο cell
5. **Salesforce formula**: `RowCount / PARENTGROUPVAL(RowCount, GRAND_SUMMARY)`

**Πρόταση για Nestor:**
- Phase 2: "% of Grand Total" ως aggregation type στο column config
- Phase 3: "% of Parent Group" (πιο complex, χρειάζεται hierarchy awareness)

**Πηγές:**
- [Salesforce Group Comparisons (Trailhead)](https://trailhead.salesforce.com/content/learn/projects/rd-summary-formulas/rd-compare-groups)
- [SSRS Matrix Percentage Total (WiseOwl)](https://www.wiseowl.co.uk/report-builder/videos/report-builder-2016/ssrs-matrix-percentage-total/)

---

### 3.7 Running Total / Cumulative Sum σε Grouped Reports

**Σύσταση: NAI — ως Power User Feature**

| Τύπος | Behavior | Use Case |
|-------|----------|----------|
| **Running Total (per group)** | Reset σε κάθε νέο group | "Σωρευτικό κόστος ανά building" |
| **Running Total (grand)** | Δεν κάνει reset, συνεχίζει | "Σωρευτικό κόστος across ALL buildings" |
| **Running Average** | Moving avg μέσα στο group | Trend analysis |
| **Running Count** | Αριθμός rows μέχρι εδώ | Sequencing |

**Implementation Patterns:**

**SSRS RunningValue:**
```
=RunningValue(Fields!Amount.Value, Sum, "GroupName")
```
- Resets per group automatically
- "Over All" option for grand running total

**Metabase:**
- Cumulative sum/count ως built-in aggregation στο Summarize step
- Μόνο στο query builder, ΟΧΙ σε custom columns

**Microsoft Access:**
- "Over Group" = reset per group
- "Over All" = accumulate to end of report

**Πρόταση για Nestor:**
- Phase 2: ΟΧΙ (πολυπλοκότητα, limited demand)
- Phase 3+: "Running Total" ως aggregation type, with option "Reset per group" / "Grand"
- Η υλοποίηση είναι απλή: sort data, iterate, accumulate. Δεν χρειάζεται library.

**Πηγές:**
- [SSRS RunningValue (Steve Novoselac)](https://stevenovoselac.com/2007/07/02/ssrs-runningvalue-to-get-cumulative-totals/)
- [Metabase Cumulative Sum](https://www.metabase.com/docs/latest/questions/query-builder/expressions/cumulative)
- [SSRS Grouped Report Running Total (TutorialGateway)](https://www.tutorialgateway.org/calculate-running-total-in-ssrs-grouped-report/)

---

### 3.8 KPI Cards Above Table — Design Pattern

**Σύσταση: Top Rail (3-5 cards) + Chart Zone + Table**

**Layout Hierarchy (Z-pattern reading):**
```
┌─────────────────────────────────────────────────┐
│  [KPI 1]    [KPI 2]    [KPI 3]    [KPI 4]      │  ← Top Rail: Headline metrics
├─────────────────────────────────────────────────┤
│  [  Chart Area (bar/pie/line)  ] [Filters]      │  ← Middle: Visual summary
├─────────────────────────────────────────────────┤
│  [  Data Table with Grouping   ]                │  ← Bottom: Detail data
│  ...                                             │
└─────────────────────────────────────────────────┘
```

**KPI Card Anatomy (Google-level):**
```
┌──────────────────────┐
│  Orders MTD          │  ← Label (concise, 2-3 words)
│  €518K               │  ← Primary Value (large, bold, rounded)
│  ▲ 12.3% vs LY      │  ← Trend/Gap (color-coded, with direction symbol)
│  ▂▃▅▆▇█▆▅           │  ← Sparkline (optional, shows trend)
│  Target: €500K       │  ← Target (small, muted)
└──────────────────────┘
```

**Best Practices (Tabular Editor / DataCamp / UXPin):**
1. **Max 5 KPI cards** per page (working memory limit)
2. **Primary value = largest element**, target and gap smaller
3. **Color on gap, NOT on primary value** — πράσινο/κόκκινο στο delta, όχι στον αριθμό
4. **Blue/orange** instead of red/green for accessibility (color blindness)
5. **Aggressive rounding**: "518K" not "517,893" — precision doesn't help at KPI level
6. **Consistent formatting**: Same font size, decimal places, across all cards
7. **Pair with context**: Always show target, prior period, or benchmark
8. **Lazy load**: KPIs load first (above fold), table loads after (progressive disclosure)
9. **Top-left = most important** (Western F-pattern reading)
10. **Units in labels**: "Revenue (EUR)", "Hours (h)", "Tasks (%)"

**Sparkline Recommendation:**
- Include moving average line to smooth noise
- 30-day or 12-month mini trend
- No axes, no labels — just the shape

**Πηγές:**
- [KPI Card Best Practices (Tabular Editor)](https://tabulareditor.com/blog/kpi-card-best-practices-dashboard-design)
- [Dashboard Design Tutorial (DataCamp)](https://www.datacamp.com/tutorial/dashboard-design-tutorial)
- [Dashboard Design Principles (UXPin)](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
- [Dashboard UX Patterns (Pencil & Paper)](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [Dashboard Design Best Practices (Justinmind)](https://www.justinmind.com/ui-design/dashboard-design-best-practices-ux)

---

### 3.9 Σύνοψη Αποφάσεων Phase 2

| # | Θέμα | Απόφαση | Priority |
|---|------|---------|----------|
| 1 | Group By Selector | **Chip bar + dropdown**, max 3 levels, reorderable | P0 |
| 2 | Subtotal Rows | **Bold + background tint + indent**, per level styling | P0 |
| 3 | Grand Total | **Bottom default**, sticky footer, toggle for top | P1 |
| 4 | Chart-Table Interaction | **Cross-filter on click**, highlight on hover, chip indicator | P1 |
| 5 | Accessibility (expand/collapse) | **Treegrid ARIA pattern**, full keyboard nav | P0 |
| 6 | % of Total Column | **Optional toggle**, % of Grand Total first | P2 |
| 7 | Running Total | **Phase 3+**, low demand, simple implementation | P3 |
| 8 | KPI Cards | **Top rail (3-5 cards)**, sparklines, color on gap | P1 |
