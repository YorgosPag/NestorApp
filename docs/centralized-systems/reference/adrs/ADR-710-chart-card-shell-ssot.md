# ADR-710 — ChartCard: το ΕΝΑ κέλυφος καρτών γραφήματος

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED — Φάση 0 + Α + Β (UNCOMMITTED) |
| **Date** | 2026-07-26 |
| **Domain** | App-wide · Data visualization · Sales/financial-intelligence · Reports · Building-management · Procurement |
| **Canonical Location** | `src/components/ui/chart-card/` (κέλυφος) · `src/components/ui/chart/` (recharts primitives) |
| **Related** | ADR-265 (`ReportChart` — type-driven wrapper, βλ. §7) · ADR-294 (SSoT ratchet) · ADR-584 (jscpd) · ADR-700 (barrel dead exports) · ADR-706 (`NumericField`) |

---

## 1. Context — τι πραγματικά βρέθηκε

Η αρχική ερώτηση ήταν στενή: «τα `BudgetVarianceChart` και `DebtMaturityWall` είναι σχεδιαστικά
δίδυμα». Το SSoT audit έδειξε τρία μεγαλύτερα ευρήματα.

### 1.1 Το SSoT γραφημάτων υπάρχει και το παρακάμπτουν σχεδόν όλοι

Το `src/components/ui/chart/` είναι πλήρες shadcn/ui chart σύστημα (`ChartContainer`,
`ChartStyle`, `ChartTooltip`, `ChartLegend`).

| Μέτρηση | Πλήθος |
|---|---|
| Αρχεία που αγγίζουν το `recharts` | **28** |
| Από αυτά, εισάγουν **απευθείας** τον responsive wrapper (πριν τη Φάση Α) | **22** |
| Περνούσαν από το SSoT (`ReportChart`, `ReportFunnel`) | 2 |
| Μεταπτώθηκαν στη Φάση Α | 2 |
| **Απομένουν** | **20** |

Κατανομή των 28:

| Τομέας | Αρχεία |
|---|---|
| `sales/financial-intelligence` | 3 |
| `sales/payments/financial-intelligence` | 7 |
| `reports/` | 4 (+36 downstream που εισάγουν μόνο `type ChartConfig`) |
| `app/procurement/analytics/_components` | 7 |
| `building-management/.../dashboard` | 3 |
| `projects/procurement/overview/kpi` | 1 |
| `app/admin/bim-diagnostics` | 1 |

> ⚠️ Το προηγούμενο handoff μετρούσε **17**. Το grep του ήταν περιορισμένο σε `src/components` με
> ακριβές `from 'recharts'` — έχανε ολόκληρο το `src/app/`. **Ο πραγματικός αριθμός είναι 28.**

**Γιατί το jscpd σιωπά:** κάθε γράφημα ζωγραφίζει άλλα δεδομένα. Μοιράζονται **σχήμα**, όχι
**tokens**. Ο ανιχνευτής κλώνων δεν το βλέπει ποτέ — ούτε το CHECK 3.28 ούτε το 3.18.

### 1.2 Το ίδιο το SSoT είχε διπλότυπο μέσα του (Φάση 0)

Υπήρχαν **δύο** αρχεία chart στο `ui/`:

- `src/components/ui/chart.tsx` → export `Chart`
- `src/components/ui/chart/index.ts` → export `ChartContainer`

Το `@/components/ui/chart` **λύνεται στο `chart.tsx`** — αρχείο νικά φάκελο στο module resolution.
Άρα και οι 36 καταναλωτές των reports έπαιρναν το `chart.tsx`, ενώ ο φάκελος ήταν πρακτικά
απρόσιτος με το ίδιο path. Και το `chart.tsx` έκανε `<ChartContext.Provider>` και μέσα του καλούσε
`ChartContainer`, που κάνει **ξανά** `<ChartContext.Provider>` — **διπλό nested provider** συν
αντιγραμμένο `useId`/`chartId`.

Κανένα gate δεν το έβλεπε: δεν είναι token clone (3.28), δεν είναι στα 3 πυρηνικά δέντρα του 3.18,
και το barrel-deadcode ratchet μετράει exports όχι shadowing.

### 1.3 Δύο κάρτες ξαναγράφουν τη διαδικασία καταχώρησης

`BudgetVarianceChart` (370 γρ.) και `DebtMaturityWall` (380 γρ.) είχαν η καθεμιά τη δική της
mini-CRUD φόρμα με δικό της `saving`/`submitting`, δικό της validity guard μέσα στον handler, δικό
της `try/finally`. Διαφορετικά ονόματα πεδίων → **αόρατο στο jscpd**.

---

## 2. Decision

Compound κέλυφος `<ChartCard>` στο `src/components/ui/chart-card/`, χτισμένο **πάνω** στα recharts
primitives του `ui/chart/` (δεν τα αντικαθιστά).

**Ο κανόνας στον οποίο κρίνεται το κέλυφος: δεν διακλαδώνει ποτέ ανάλογα με το ποιος το καλεί.**
Κάθε απόφαση διαβάζεται από την περιγραφή των δεδομένων. Legend εμφανίζεται επειδή υπάρχουν δύο
σειρές — όχι επειδή κάποιος το ζήτησε με prop.

### 2.1 Η μία δήλωση, τέσσερις αναγνώστες

Το `series: ChartSeries[]` δηλώνεται **μία φορά** ανά γράφημα και τροφοδοτεί:

| # | Αναγνώστης | Πώς |
|---|---|---|
| 1 | Theming | `toChartConfig()` → `<ChartContainer config>` → `ChartStyle` εκπέμπει `--color-<key>` |
| 2 | Legend | `<ChartCardFigure>` |
| 3 | Πίνακας δεδομένων | `<ChartCardDataTable>` — το κειμενικό ισοδύναμο |
| 4 | Τα ίδια τα marks | `seriesColorVar(key)` |

Αυτό είναι το μοντέλο «attribute manager οδηγούμενος από περιγραφή δεδομένων» (Maxon C4D) και είναι
**ένα σκαλί πάνω από το shadcn**, όπου το `ChartConfig` τροφοδοτεί μόνο το theming και πίνακας
δεδομένων δεν υπάρχει καθόλου.

### 2.2 Slots

```tsx
<ChartCard series={…} data={…} categoryKey="year" categoryLabel={…} formatValue={…}>
  <ChartCard.Header title={…}>{actions}</ChartCard.Header>
  <ChartCard.Figure caption={…} emptyMessage={…} size="lg">
    <BarChart data={…}>… <ChartCard.Tooltip /> …</BarChart>
  </ChartCard.Figure>
  <ChartCard.Summary><ChartCard.SummaryItem … /></ChartCard.Summary>
  <ChartCard.Editor>…</ChartCard.Editor>
</ChartCard>
```

Τα props του root είναι **περιγραφή δεδομένων**, όχι διακόπτες συμπεριφοράς. Δεν υπάρχει `type`
prop, άρα δεν υπάρχει switch που πρέπει να μεγαλώσει όταν προστεθεί τύπος γραφήματος.

### 2.3 Η φόρμα: κοινή διαδικασία, ιδιωτικά πεδία

Δύο hooks + δομικό chrome, **ποτέ** schema-driven φόρμα:

| Module | Τι κάνει |
|---|---|
| `useEntrySubmit` | κύκλος υποβολής: idempotent (drop διπλού click), unmount-safe, validity gate, `try/finally` |
| `useRepeatingRows` | add/update/remove γραμμών, **keyed re-seed** |
| `ChartCardEditor.*` | `Disclosure` / `Grid` / `Field` / `Rows` / `RowHeader` / `Row` / `AddRow` / `Remove` / `Actions` / `Submit` / `Cancel` |

Το κέλυφος **δεν ξέρει πεδία**. Ο προϋπολογισμός ενός έργου και οι όροι ενός δανείου δεν είναι η
ίδια φόρμα· ένα `schema` prop απλώς θα μετακόμιζε τη διαφορά στο config — η ακριβής παγίδα του
`reference_over_parameterised_factory_clone.md` (ADR-698/699/321).

**Δύο ιδιότητες που τα χειρόγραφα αντίγραφα ΔΕΝ είχαν:**

- **Idempotent.** Δεύτερο κλικ ενώ τρέχει η εγγραφή → αγνοείται (συγχρονισμένος `useRef`, όχι state).
  Τα αντίγραφα ξανακαλούσαν το `onSave` σε κάθε κλικ.
- **Keyed re-seed.** Το `BudgetVarianceChart` ξανάσπερνε τις γραμμές από `useEffect` πάνω στο
  αντικείμενο `analysis`. Σωστό μόνο όσο ο γονιός επιστρέφει σταθερή αναφορά — γονιός που το
  ξαναχτίζει ανά render **έσβηνε ό,τι πληκτρολογούσε ο χρήστης**, και τίποτα στην υπογραφή δεν το
  έλεγε. Τώρα ο caller ονομάζει την εγγραφή με `seedKey` και το re-seed γίνεται μόνο όταν αλλάζει
  **ποια** εγγραφή είναι φορτωμένη.

---

## 3. Έρευνα — τι κάνουν οι μεγάλοι

| Πηγή | Τι πήραμε |
|---|---|
| **Radix UI / React Aria / Headless UI** | compound components ως απάντηση στο «prop soup»· ο γονιός κρατά state, τα παιδιά συνθέτουν |
| **Figma component properties** | boolean/variant properties αντί για combinatorial explosion component-ων· εδώ: slots + ένα named size, όχι δεκάδες booleans |
| **IBM Carbon** | προσβασιμότητα ψημένη στο component, όχι annotation ανά χρήση |
| **Adobe Spectrum** | component schemas ως δεδομένα — η περιγραφή σειρών εδώ παίζει τον ίδιο ρόλο |
| **Highcharts a11y module** | κειμενικό ισοδύναμο + πίνακας δεδομένων· **ρητά συνιστά ορατό, όχι visually-hidden**, γιατί ωφελεί και τη γνωσιακή προσβασιμότητα |
| **shadcn/ui charts** | `--color-<key>` μέσω `ChartStyle` — το κρατήσαμε· το ξεπερνάμε προσθέτοντας legend/table/spacer ως δομική υποχρέωση |

**Πού πάμε ένα σκαλί πάνω:** στους μεγάλους ο πίνακας δεδομένων και το legend είναι *επιλογές*. Εδώ
είναι **δομικά** — κανένα γράφημα δεν μπορεί να τα παρακάμψει, γιατί (§4) η παλέτα τα οφείλει.

---

## 4. Μετρημένη κατάσταση παλέτας — `dataviz/scripts/validate_palette.js`

Τα `--chart-1..5` του `globals.css` μετρήθηκαν με τον validator, στις **πραγματικές** επιφάνειες
καρτών (`--card`), όχι στις προεπιλεγμένες του εργαλείου.

### Light — surface `#e7f1fe`

```
[PASS] Lightness band       all 5 inside L 0.43–0.77
[PASS] Chroma floor         all 5 >= 0.1
[WARN] CVD separation       worst adjacent #f97415 ↔ #21c45d  ΔE 6.2 (deutan) · tritan 12.7
[PASS] Normal-vision floor  worst adjacent ΔE 22.5
[WARN] Contrast vs surface  #21c45d 2.02:1 · #f97415 2.44:1   (< 3:1)
→ ALL CHECKS PASS με όρους
```

### Dark — surface `#1d283a`

```
[FAIL] Lightness band       και τα 5 πάνω από το ταβάνι L 0.77 (0.716–0.798)
[PASS] Chroma floor         all 5 >= 0.1
[FAIL] CVD separation       worst adjacent #faa94c ↔ #3bde77  ΔE 5.4 (deutan)  ← κάτω από το κατώφλι 6.0
[PASS] Normal-vision floor  worst adjacent ΔE 18.3
[PASS] Contrast vs surface  all 5 >= 3:1
→ FAILED
```

**Ερμηνεία.** ΔE στη ζώνη 6–8 είναι νόμιμο **μόνο** με δευτερεύουσα κωδικοποίηση. Mark κάτω από
3:1 υποχρεώνει σε ορατά labels ή πίνακα δεδομένων. Το **dark mode αποτυγχάνει κανονικά** — κανείς
δεν είχε κοιτάξει ποτέ.

**Τι κάνει γι' αυτό το κέλυφος (δομικά, χωρίς opt-out):**

1. `ChartCardFigure` αποδίδει **πάντα** legend όταν οι σειρές είναι ≥ 2 (ταυτότητα ποτέ μόνο με χρώμα)
2. `ChartCardDataTable` είναι **πάντα** προσβάσιμο — native `<details>`, ορατό σε όλους
3. `CHART_STACK_SPACER` βάζει διάκενο 2px στο χρώμα της επιφάνειας ανάμεσα σε εφαπτόμενα fills

**Τι ΔΕΝ κάνει:** δεν διορθώνει τα ίδια τα `--chart-*`. Αυτό είναι αλλαγή στο `globals.css` που
**ξαναβάφει και τα 28 γραφήματα** και είναι ξεχωριστή απόφαση του Giorgio (βλ. §8).

---

## 5. Consequences

**Θετικά**

- Αλλαγή σε theming / tooltip / legend / empty state / πίνακα δεδομένων → **ένα** αρχείο
- Τα δύο μεταπτωμένα γραφήματα έχασαν και τα δύο `eslint-disable` (`no-hardcoded-strings`,
  `no-hardcoded-colors`). Έφυγαν 7 hardcoded hex (`#ef4444`, `#10b981`, `#3b82f6`, `#f59e0b`,
  `#888`) και ένα inline style — άρα το `DebtMaturityWall` **δουλεύει επιτέλους σε dark mode**,
  όπου πριν ζωγράφιζε την light ράμπα ανεξαρτήτως θέματος
- Οι αγγλικές ετικέτες τύπων δανείου / κατηγοριών κόστους πέρασαν σε `payments.json` (el + en)
- Νέα δομική εγγύηση προσβασιμότητας που **δεν υπήρχε πουθενά** στο έργο

**Αρνητικά / κόστος**

- Ακόμη 20 αρχεία εκτός κελύφους (Φάσεις Β/Γ/Δ) — καταγεγραμμένα, όχι σιωπηλά
- Το `ReportChart` (ADR-265) μένει προς το παρόν παράλληλο κέλυφος (§7)

---

## 6. Τι υλοποιήθηκε

### Φάση 0 — εξάλειψη του διπλού SSoT

- ❌ `src/components/ui/chart.tsx` — διαγράφηκε
- ✏️ `src/components/ui/chart/index.ts` — ρητά exports αντί για `export *` (οι προηγούμενοι star
  re-exports δήλωναν `ChartTooltipContent`/`ChartLegendContent` από δύο modules ο καθένας· νόμιμο
  μόνο επειδή και οι δύο διαδρομές κατέληγαν στο ίδιο binding) + προστέθηκε `ChartStyle`

### Φάση Α — το κέλυφος + απόδειξη σε 2 γραφήματα

| Αρχείο | Ρόλος |
|---|---|
| `chart-card-series.ts` | περιγραφή σειρών, παλέτα, polarity, spacer, radius· **η μετρημένη κατάσταση του §4 είναι τεκμηριωμένη εδώ** |
| `chart-card-context.ts` | τι επιτρέπεται να ξέρει κάθε slot |
| `ChartCard.tsx` | root + compound surface |
| `ChartCardHeader.tsx` | τίτλος (φέρει το accessible name) + actions |
| `ChartCardFigure.tsx` | `<figure>`, sized box, legend, empty state, πίνακας |
| `ChartCardTooltip.tsx` | hover layer δεμένο στο `formatValue` της κάρτας |
| `ChartCardDataTable.tsx` | κειμενικό ισοδύναμο (WCAG 1.1.1) |
| `ChartCardSummary.tsx` | `<dl>` σύνοψη με tone tokens |
| `editor/use-entry-submit.ts` | κύκλος υποβολής |
| `editor/use-repeating-rows.ts` | γραμμές με keyed re-seed |
| `editor/ChartCardEditor.tsx` | chrome φόρμας, χωρίς γνώση πεδίων |
| `index.ts` | barrel |

**Μεταπτώσεις:** `BudgetVarianceChart.tsx` (370 → 341 γρ.), `DebtMaturityWall.tsx` (380 → 395 γρ.)

### 6.1 Παγίδα που πιάστηκε πριν φύγει — `displayName` και το recharts

Το `<ChartCard.Tooltip>` γράφτηκε αρχικά ως απλό wrapper component. **Θα ήταν σιωπηλά νεκρό.**

Το recharts **δεν** αποδίδει τα παιδιά του απευθείας: το `generateCategoricalChart` τα ψάχνει με
`findChildByType(children, Tooltip)`, που ταιριάζει σε **`type.displayName`**, και μετά περνά τα
δεδομένα του hover στο στοιχείο που βρήκε μέσω `cloneElement`
(`node_modules/recharts/lib/util/ReactUtils.js:99`, `.../chart/generateCategoricalChart.js:1263,1278`).

Wrapper με οποιοδήποτε άλλο όνομα **δεν βρίσκεται ποτέ**: το γράφημα αποδίδεται, τίποτα δεν σκάει,
απλώς το tooltip δεν εμφανίζεται ποτέ. Καμία ένδειξη, κανένα σφάλμα.

Διόρθωση: το component παίρνει `displayName = 'Tooltip'` και **προωθεί όλα τα props** — και όσα
διαβάζει το recharts *πριν* (`active`, `trigger`, `shared`) και όσα εισάγει *μετά* (`payload`,
`label`, `coordinate`, `viewBox`). Το `displayName` κατοχυρώνεται με test· είναι το μόνο είδος
αστοχίας που μπορεί να παράξει αυτό το αρχείο και είναι αόρατο.

> **Γενικός κανόνας:** κάθε νέο compound slot που πρόκειται να ζήσει **μέσα** σε σύνθεση recharts
> (Tooltip / Legend / Brush / ReferenceLine) πρέπει είτε να είναι το ίδιο το primitive είτε να
> δανείζεται το `displayName` του και να προωθεί props. Slots **έξω** από το `<BarChart>`
> (`Header`, `Summary`, `Editor`) δεν το χρειάζονται.

**i18n:** `common.json` → `chart.*` (3 κλειδιά, el + en)· `payments.json` → `maturity.{year,caption,
removeEntry,monthsToMaturity,types.*}` και `variance.{caption,emptyState,removeRow,
defaultCategories.*}` (el + en). Πληθυντικός σε **ICU** (`{count, plural, …}`), όχι i18next `{{count}}`
— το CHECK 3.9 απορρίπτει τις διπλές αγκύλες.

---

### 6.2 Φάση Β — τα 8 υπόλοιπα γραφήματα των πωλήσεων

| Αρχείο | Τι έγινε |
|---|---|
| `InterestReserveChart` | 131 → 146 γρ.· έφυγαν 2 eslint-disable· η ράμπα εξάντλησης πέρασε σε `CHART_STATUS_RAMP` |
| `DrawTimelineChart` | 148 → 138 γρ.· **έφυγαν 9 hardcoded hues φάσεων** (βλ. παρακάτω) |
| `monte-carlo-charts` | fan chart + ιστόγραμμα· τα 5 percentile bands πέρασαν σε polarity + fillOpacity |
| `ForwardCurveChart` | ο χειρόγραφος πίνακας επιτοκίων **διαγράφηκε** — ήταν ο πίνακας δεδομένων του κελύφους ξαναγραμμένος |
| `SensitivityTab` | tornado στο κέλυφος· έφυγαν 3 eslint-disable· ο διπλός selector του heat map ενοποιήθηκε |
| `EquityWaterfallDialog` | 426 → **150** γρ.· σπάσιμο σε `equity-waterfall-inputs` + `equity-waterfall-results`· ο πίνακας ανά βαθμίδα διαγράφηκε |
| `CounterproposalTab` | 429 → **253** γρ.· σπάσιμο σε `counterproposal-negotiation` + `counterproposal-chart` |
| `FinancialQueryChat` | το plot βγήκε σε `FinancialQueryChart`· το chat **δεν αγγίζει πλέον recharts** |

**Διαγραφή:** `FinancialTooltip.tsx` (90 γρ.) — έμεινε χωρίς κανέναν καταναλωτή μόλις και τα 8
πέρασαν στο `ChartCard.Tooltip`. Ήταν το χειρόγραφο διπλότυπο του `ChartTooltipContent`.

**Νέο module του τομέα:** `financial-chart-axes.tsx` — `financialAxisFrame()`. Πλέγμα + δύο άξονες +
hover layer, **συνάρτηση που επιστρέφει πίνακα στοιχείων**, όχι component: το recharts ξετυλίγει
fragments αλλά **όχι** components (§6.1), άρα ένα `<ChartFrame />` θα ήταν σιωπηλά νεκρό. Ζει στον
τομέα και **όχι** στο κέλυφος, γιατί το τι ζωγραφίζει ένα plot παραμένει υπόθεση του καλούντος (§2).

**Τρεις προσθήκες στο κέλυφος** — όλες περιγραφή δεδομένων, καμία διακλάδωση ανά καλούντα:

| Προσθήκη | Γιατί |
|---|---|
| `CHART_STATUS_RAMP` (healthy/caution/critical) | ποσότητα που **στραγγίζει** — ούτε ταυτότητα (categorical) ούτε πρόσημο (polarity)· η polarity θα έχανε το μεσαίο σκαλί, που είναι το μόνο που λέει «όχι ακόμη πρόβλημα» |
| `description?` σε σειρά + `categoryDescription` στη ρίζα | ο πίνακας δεδομένων εξηγεί τους όρους του· έτσι ο χειρόγραφος πίνακας του `ForwardCurveChart`, που ήταν ο **μόνος** που είχε επεξηγήσεις, μπόρεσε να φύγει χωρίς απώλεια |
| `ChartCardTooltip` → `formatCategory` | η επικεφαλίδα του tooltip και η επικεφαλίδα γραμμής του πίνακα ονομάζουν το ίδιο datum· τώρα δεν μπορούν να διαφωνήσουν |

**Δύο διορθώσεις ορθότητας που βγήκαν στην πορεία:**

- `formatCurrencyCompact` συνέκρινε την **προσημασμένη** τιμή με τα κατώφλια → κάθε αρνητικό ποσό
  έμενε ασυντόμευτο (`€-50000` αντί `-€50K`). Άξονας που περνά από το μηδέν — αποθεματικό που
  εξαντλείται — το χτυπούσε πάντα.
- `ChartCardDataTable` έγραφε `0` για πεδίο που **δεν υπάρχει**. Ένα tenor χωρίς forward rate
  διάβαζε «0%», δηλαδή λάθος δεδομένο. Τώρα γράφει «—», όπως το plot που δεν ζωγραφίζει τίποτα εκεί.

#### Γιατί έφυγαν οι 9 χρωματισμοί φάσης του `DrawTimelineChart`

Κάθε μπάρα βαφόταν ανά φάση κατασκευής από ιδιωτικό πίνακα εννέα κυριολεκτικών hues, με λίστα
δειγμάτων από κάτω ως μοναδικό υπόμνημα. **Εννέα είναι πέρα από ό,τι μπορεί να κωδικοποιήσει το
θέμα**: το `globals.css` ορίζει πέντε κατηγορικά σκαλιά και η μετρημένη διάκριση αυτών των πέντε
είναι ήδη οριακή υπό deuteranopia (§4). Δηλαδή ταυτότητα με **μόνο** χρώμα, σε περισσότερες
κατηγορίες από όσες υπάρχουν, σε χρώματα που αγνοούσαν το dark mode.

Η φάση δεν χρειαζόταν χρώμα — **ονοματίζει τον μήνα**. Πέρασε στο `formatCategory`, που το διαβάζουν
και η επικεφαλίδα του tooltip και ο πίνακας δεδομένων. Η πληροφορία είναι πλέον σε **δύο** σημεία
αντί για ένα, και τα δύο επιβιώνουν αλλαγής θέματος.

### 6.3 Μετρημένη πρόοδος

| Μέτρηση | Πριν τη Φάση Β | Μετά |
|---|---|---|
| Αρχεία που εισάγουν απευθείας τον responsive wrapper | **20** | **12** |
| eslint-disable χρωμάτων/strings στα 8 αρχεία | 14 | **0** |
| Hardcoded hues στα 8 αρχεία | 20+ | **0** |
| Αρχεία >500 γρ. στον τομέα | 0 (αλλά 2 render functions ~270 γρ.) | 0, μεγαλύτερη render function πολύ κάτω από το όριο |

Επαλήθευση (όχι `ssot:audit` — τρέχει >20 λεπτά):
```bash
printf '^[[:space:]]*ResponsiveContainer,?[[:space:]]*$\nimport[^;]*ResponsiveContainer[^;]*from[^;]*recharts\n' > /tmp/pat.txt
grep -rlE -f /tmp/pat.txt src --include=*.tsx --include=*.ts | sort
```
Τα 12 που μένουν είναι Φάση Γ/Δ, συν 2 δικά μας false positives (`chart-card/index.ts`, το test).

### 6.4 Anchors

Το regression scan έγινε **παραμετρικό ανά τομέα** (`MIGRATED_DOMAINS`) και καλύπτει πλέον και το
`sales/payments/financial-intelligence`. Και οι δύο λίστες εκκρεμών είναι **άδειες**. Προστέθηκε
τρίτος έλεγχος: «κάθε αρχείο γραφήματος του τομέα φτάνει στο κέλυφος» — το να μην εισάγεις τον
responsive wrapper είναι μόνο το μισό· ένα αρχείο θα μπορούσε να ζωγραφίζει σύνθεση recharty χωρίς
καμία κάρτα γύρω και να περνούσε το πρώτο scan. Σύνολο: **30 anchors**, όλα πράσινα, μαζί με τα
178 του `sales/__tests__`.

---

### 6.5 Browser verify (2026-07-27) — δύο σιωπηλά ελαττώματα που τα 206 tests δεν έβλεπαν

Ο μόνος προσβάσιμος κόμβος ήταν το `DebtMaturityWall` (§8, εκκρεμότητα #8). Έφτασε.

**Τι επαληθεύτηκε ζωντανά** (DOM, όχι pixels — οι διαδοχικές λήψεις μετακινούνται λόγω
animation): `CartesianGrid` **8 γραμμές**, `xAxis` 1, `yAxis` 1, ticks `0 € … 600.000 €`,
`bars` 4, `tooltipWrapper` 1. Δηλαδή **ο πίνακας του `financialAxisFrame()` δουλεύει** και το
recharts **βρίσκει** το `ChartCardTooltip` — οι δύο παγίδες του §6.1 δεν έχουν χτυπήσει.
Ο πίνακας δεδομένων αποδίδει `scope="col"` / `scope="row"` και ίδιους αριθμούς με το plot.
Το γράφημα **ξαναβάφεται** στην εναλλαγή θέματος (ανοιχτό γαλάζιο → βαθύ μπλε).

**❌ Εύρημα 1 — η επικεφαλίδα του tooltip έδειχνε το όνομα της πρώτης σειράς.**
Hover στη στήλη `2027` έβγαζε επικεφαλίδα **«Κατασκευαστικό»**. Αιτία στο
`useTooltipLabel`: `!labelKey && typeof label === 'string' ? … : itemConfig?.label`. Μόλις η
κατηγορία είναι **αριθμός** — έτος, δείκτης μήνα, bucket — η συνθήκη πέφτει και η επικεφαλίδα
γίνεται σιωπηλά η ετικέτα της πρώτης σειράς. Καμία εξαίρεση, κανένα warning.
**Διόρθωση:** το `ChartCardTooltip` διαβάζει πλέον την κατηγορία από το ίδιο το `categoryKey`
της κάρτας — το κλειδί που ήδη τροφοδοτεί τον άξονα και τον πίνακα — με fallback στο `label`
του recharts μόνο όταν το payload δεν φέρει datum.

**❌ Εύρημα 2 — οι γραμμές του tooltip έχαναν όνομα σειράς και χρωματικό δείγμα.**
Το `ChartTooltipItem` έχει `formatter ? formatter(…) : (<>swatch + name + value</>)` — δηλαδή
ένα `formatter` αντικαθιστά **ολόκληρη** τη γραμμή. Το κέλυφος περνούσε ένα για να μορφοποιήσει
έναν αριθμό, οπότε μια στοίβα 4 τύπων δανείου διαβαζόταν ως **τέσσερα γυμνά ποσά**.
**Διόρθωση:** νέο προαιρετικό `valueFormatter` στο `ui/chart` που μορφοποιεί **μόνο** τον αριθμό
και αφήνει τη γραμμή ανέπαφη· αντικαθιστά και το ωμό `item.value.toLocaleString()` που αγνοούσε
το `formatValue` της κάρτας. Κανένας υπάρχων καταναλωτής δεν περνά `formatter` (μόνο το κέλυφος
το έκανε), άρα η προσθήκη είναι αμιγώς προσθετική.

Και τα δύο ελαττώματα ήταν **στο κέλυφος** ⇒ η διόρθωση πιάνει **και τις 10 κάρτες**.
Anchors: 2 νέα στο `chart-card.test.tsx` (**33 GREEN**), **mutation-verified** — η επαναφορά
της παλιάς συμπεριφοράς κοκκινίζει ακριβώς αυτά τα 2 και κανένα άλλο.

**Παράπλευρη επαλήθευση ADR-706:** η φόρμα δανείου του `DebtMaturityWall` δέχτηκε
πληκτρολόγηση **χαρακτήρα-προς-χαρακτήρα** `4.5` → `4,5`, `1.35` → `1,35`, `500000` → `500.000`.
Το ελάττωμα `2.4 → 04` **δεν αναπαράγεται** σε αυτό το call site.

---

## 7. Ανοιχτή απόφαση — `ReportChart` (ADR-265)

Το `src/components/reports/core/ReportChart.tsx` **είναι ήδη κέλυφος γραφημάτων** και το
χρησιμοποιούν 36 αρχεία. Είναι όμως **type-driven**: `type: 'bar'|'line'|'area'|'pie'|'stacked-bar'`
+ ~15 προαιρετικά props. Δηλαδή ακριβώς το σχήμα που το §2 απορρίπτει.

Άρα το `reports/` **δεν** είναι ακεντρικοποίητο — είναι κεντρικοποιημένο **με λάθος σχήμα**.

**Πρόταση (Φάση Γ):** το `ReportChart` μένει ως public API — τα 36 call-sites δεν αγγίζονται — αλλά
ξαναγράφεται **λεπτό preset** πάνω στο `ChartCard`. Ο switch των 5 τύπων πεθαίνει, το κέλυφος μένει
καθαρό. Αυτό είναι το «variants over props» της Figma: το κέλυφος ορίζει δομή, τα presets είναι
ονοματισμένες συνθέσεις.

---

## 8. Εκκρεμότητες

| # | Εκκρεμότητα | Κατάσταση |
|---|---|---|
| 1 | **Διόρθωση των dark `--chart-1..5`** — μετρημένο FAIL (§4). Αλλαγή στο `globals.css`, ξαναβάφει 28 γραφήματα | ⏸️ απόφαση Giorgio |
| 2 | Φάση Γ — `reports/` (§7) | ⏸️ |
| 3 | Φάση Δ — `app/procurement/analytics` (5) + `building-management` (3) + `projects/procurement` (1) + `bim-diagnostics` (1) + `ReportSparkline` + `CashFlowChart` = τα **12** που μένουν | ⏸️ |
| 4 | `npm run ssot:baseline` μετά το commit — το module `chart-card-shell` έχει πλέον **12** προϋπάρχουσες παραβιάσεις προς baseline (ήταν 20) | ⏸️ |
| 5 | `fmtCurrency` / `fmtPercent` στο `CounterproposalScenarioRow.tsx` είναι locale-hardcoded (`'el-GR'`) διπλότυπα των `formatCurrencyWhole` / `formatPercentage`. 4 αρχεία | ✅ **DONE 2026-07-27** (§8.1) |
| 6 | `InfoLabel` / `InfoDt` / `InfoTableHead` ζουν στο `sales/payments/financial-intelligence/` αλλά τα χρησιμοποιούν **14 αρχεία** σε 5 τομείς. Το `ChartCardDataTable` χρειάστηκε την ίδια χειρονομία και δεν μπορούσε να την εισάγει (`ui/` → `components/sales/` = ανάποδη κατεύθυνση), οπότε την έχει δικιά του | ✅ **DONE 2026-07-27** (§8.2) |
| 8 | **ΝΕΟ — τα 8 από τα 9 γραφήματα παραμένουν ΜΗ επαληθευμένα στον browser.** Δύο φράγματα: (α) το extension καρφώνει την καρτέλα σε **ένα** URL — ακόμη και το κλικ στο sidebar επιστρέφει στο `/sales/financial-intelligence`· (β) **η βάση είναι άδεια**: 1 ακίνητο *for-sale*, **καμία** collection `paymentPlans`, 0 μονάδες. Τα 7 της Διαδρομής Β ζουν πίσω από το `InterestCostDialog` που θέλει ακίνητο **με πρόγραμμα δόσεων**. Δεδομένου ότι ο **ένας** προσβάσιμος κόμβος έβγαλε **δύο** ελαττώματα κελύφους (§6.5), το υπόλοιπο δεν είναι διεκπεραίωση | ⏸️ **απόφαση Giorgio** |
| 7 | **ΝΕΟ — `new Intl.NumberFormat('el-GR', …)` καρφωμένο σε 27 ακόμη αρχεία**, εκτός των 4 του #5: 8 `hooks/reports/*`, 4 showcase specs, 4 `reports/`, 2 `services/payment-plan-installments`, `report-engine/grouping-engine` ×2, `overdue-alert.service`, `KPIAlertCard`, `EditInstallmentDialog`, `KpiTotalCommittedSpend`, `QuoteList`, `rfq-dashboard-stats`, `lib/number/greek-decimal`, `showcase-email-shared`. Όλα αγνοούν τον language switcher. **Δεν καταπίνεται εδώ** (5+ τομείς). Εντολή: `grep -rn "NumberFormat('el-GR'" src/` | ⏸️ **απόφαση Giorgio** |

### 8.1 `fmtCurrency` / `fmtPercent` → `intl-utils` (εκκρεμότητα #5)

Οι δύο βοηθοί διαγράφηκαν από το `CounterproposalScenarioRow.tsx`· και τα 4 αρχεία καλούν πλέον
`formatCurrencyWhole` / `formatPercentage` από το `@/lib/intl-utils`, που διαβάζουν το locale από
το i18n τη στιγμή της κλήσης. Επαλήθευση: `grep -rn "fmtCurrency\|fmtPercent" src/` → **μηδέν**.

⚠️ **Αλλάζει ορατή μορφοποίηση, σκόπιμα.** Το `fmtPercent` έδινε πάντα `12.34%` — αγγλική υποδιαστολή
και δύο δεκαδικά ακόμη και σε στρογγυλό ποσοστό. Το `formatPercentage` δίνει `12,3%` στα ελληνικά και
`30%` όταν δεν υπάρχει δεκαδικό. Αυτό είναι το ζητούμενο: ο πίνακας αντιπρότασης διαβάζεται δίπλα
στον selector παρακράτησης, που ήδη έδειχνε `30%`.

### 8.2 `InfoLabel` → `ui/` (εκκρεμότητα #6)

Το αρχείο μετακινήθηκε σε **`src/components/ui/InfoLabel.tsx`** και τα **14** αρχεία-καταναλωτές
(συν ο barrel του `financial-intelligence`) δείχνουν εκεί. Το `ChartCardColumnHead` **διαγράφηκε** —
το `ChartCardDataTable` εισάγει πλέον το κανονικό `InfoTableHead`.

Τρεις προσθήκες που απαίτησε η συγχώνευση, καμία τους παραμετροποίηση για χάρη ενός call site:

1. **`InfoUnderlinedTerm`** — η ίδια η χειρονομία (διακεκομμένη υπογράμμιση + Radix tooltip)
   εξήχθη ως το κοινό στοιχείο που μοιράζονται και οι τρεις υποδοχείς.
2. **`tooltip` προαιρετικό** — χωρίς επεξήγηση ο όρος αποδίδεται σκέτος. Το χρειαζόταν ήδη το
   κέλυφος (σειρά χωρίς `description`)· τώρα το έχουν και οι τρεις.
3. **`border-current` αντί για `border-muted-foreground`** — η υπογράμμιση ακολουθεί το χρώμα του
   ίδιου του όρου. Στα υπάρχοντα σημεία είναι ταυτόσημο (το `TableHead` και το προεπιλεγμένο `<dt>`
   είναι ήδη `text-muted-foreground`)· αλλάζει **μόνο** εκεί που ο όρος είναι destructive, όπου η
   γκρίζα γραμμή ήταν ασυνέπεια — ένα από τα χειρόγραφα αντίγραφα το είχε ήδη διορθώσει τοπικά.

**Επιπλέον εύρημα, διορθωμένο επιτόπου (N.0.2):** η ίδια χειρονομία ήταν γραμμένη με το χέρι **11
ακόμη φορές** σε 2 αρχεία που το ADR δεν ανέφερε — `interest-cost-tabs.tsx` (6 σε `<TableHead>`
+ 1 ελεύθερο) και `interest-cost-pricing-settings.tsx` (4 σε `<dt>`). Δηλαδή το πραγματικό πλήθος
αντιγράφων ήταν **13**, όχι 2. Μεταναστεύθηκαν και τα 11. Σήμερα το
`grep -rn "cursor-help border-b border-dashed" src/` επιστρέφει **μία** γραμμή: το SSoT.

---

## 9. Changelog

| Ημερομηνία | Φάση | Τι έγινε |
|---|---|---|
| 2026-07-26 | **Φάση 0** | Διαγραφή `ui/chart.tsx` (double provider + module shadowing)· ρητά exports στο `ui/chart/index.ts` |
| 2026-07-26 | **Φάση Α** | Νέο SSoT `src/components/ui/chart-card/` (12 αρχεία)· μετάπτωση `BudgetVarianceChart` + `DebtMaturityWall`· i18n κλειδιά el+en· registry module `chart-card-shell`· 18 jest anchors |
| 2026-07-26 | **Μέτρηση** | Πρώτη ποτέ επικύρωση της παλέτας `--chart-*` — light PASS με 2 WARN, **dark FAIL** (§4) |
| 2026-07-26 | **Φάση Β** | Μετάπτωση 8 γραφημάτων (§6.2)· **20 → 12** αρχεία εκτός κελύφους· διαγραφή `FinancialTooltip.tsx` και δύο χειρόγραφων πινάκων· νέο `financial-chart-axes.tsx`· 3 προσθήκες περιγραφής δεδομένων στο κέλυφος· 2 διορθώσεις ορθότητας (`formatCurrencyCompact` αρνητικά, κενό κελί ≠ 0)· anchors παραμετρικά ανά τομέα, 19 → **30** |
| 2026-07-27 | **Browser verify** | Πρώτη φορά που κάποιος είδε το κέλυφος να τρέχει (§6.5). Άξονες/πλέγμα/tooltip/πίνακας/dark mode **επιβεβαιωμένα** στο `DebtMaturityWall`· **2 σιωπηλά ελαττώματα** στο κέλυφος διορθώθηκαν (επικεφαλίδα tooltip σε αριθμητική κατηγορία· γραμμές χωρίς όνομα σειράς) ⇒ νέο `valueFormatter` στο `ui/chart`. 2 anchors, **mutation-verified**, **33 GREEN**. Τα 8/9 γραφήματα μένουν ανεπαλήθευτα (εκκρεμότητα #8) |
| 2026-07-27 | **Κεντρικοποίηση** | Εκκρεμότητες #5 + #6 έκλεισαν (§8.1, §8.2). `fmtCurrency`/`fmtPercent` → `intl-utils` σε 4 αρχεία· `InfoLabel`/`InfoTableHead`/`InfoDt` → `src/components/ui/InfoLabel.tsx` με 14 καταναλωτές repointed· `ChartCardColumnHead` διαγράφηκε· **13 → 1** υλοποιήσεις της διακεκομμένης υπογράμμισης (11 από αυτές ήταν άγνωστες στο ADR)· νέα εκκρεμότητα #7 (27 ακόμη `'el-GR'` καρφωμένα). Tests **206/206**, `jscpd:diff` καθαρό στα 8 αρχεία |
