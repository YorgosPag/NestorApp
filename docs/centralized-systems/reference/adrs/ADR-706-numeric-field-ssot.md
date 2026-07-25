# ADR-706 — NumericField SSoT: το ΕΝΑ δεκαδικό input της εφαρμογής

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED (UNCOMMITTED) |
| **Date** | 2026-07-25 |
| **Domain** | App-wide · Forms / Input · Building-code · Property · κάθε δεκαδικό πεδίο |
| **Canonical Location** | `src/components/ui/numeric-field/` |
| **Related** | ADR-576 (locale-number parse SSoT) · ADR-314 (`intl-formatting` SSoT) · ADR-082 (DXF FormatterRegistry — **διαφορετικό domain**) |

---

## 1. Context — πώς βρέθηκε

Κατά το E2E verify των «Έργων» (Φάση 2, browser automation) στην καρτέλα **Όροι Δόμησης**:

| Πληκτρολογήθηκε | Έμεινε στο πεδίο | Τι αποθηκευόταν |
|---|---|---|
| `2.4` (ΣΔ) | `04` | **4** |
| `0.8` (ΣΔ) | `08` | **8** |
| `21.5` (Μέγιστο ύψος) | `05` | **5** |
| `70.5` (Κάλυψη) | `05` | **5** |
| `2,4` (κόμμα) | `2.4` | 2,4 ✅ |

**Αναπαραγώγιμο 5/5**, και στα **τρία** αριθμητικά πεδία. Δεν είναι Fast Refresh artifact — ανιχνεύθηκε
από τα ίδια τα attributes του DOM (React `value="4"` ενώ το DOM `.value="04"`).

**Σοβαρότητα ΥΨΗΛΗ:** ο ΣΔ είναι ο πιο κρίσιμος αριθμός μιας οικοδομικής άδειας. ΣΔ 2,4 → 4 σημαίνει
**+67% δόμηση** σε αποθηκευμένο δεδομένο, **σιωπηλά**, χωρίς κανένα μήνυμα λάθους.

### Ο μηχανισμός

```tsx
<Input type="number" value={draft.sd} onChange={e => setSd(parseNumber(e.target.value))} />
```

Όταν ο χρήστης πληκτρολογεί `2` → `.` → `4`:

1. `2` → `e.target.value === "2"` → state `2` → render `"2"`. OK.
2. `.` → η ενδιάμεση τιμή `"2."` είναι **invalid** για `type="number"`, οπότε ο browser επιστρέφει
   `e.target.value === ""` → `parseNumber("")` → `null ?? 0` → **state `0`** → render `"0"`.
3. `4` → το DOM έχει πλέον `"0"` + `"4"` = `"04"` → state `4`.

Το κόμμα επιβίωνε μόνο επειδή σε el locale ο Chrome δέχεται το `,` ως έγκυρο δεκαδικό χαρακτήρα και
δεν αδειάζει το `value`.

**Το ADR-576 είχε διορθώσει το parse layer** (`parseLocaleNumber` δέχεται σωστά `.` και `,`) — αλλά ο
χαρακτήρας **δεν έφτανε ποτέ** στον parser. Το ελάττωμα ήταν στο **input layer**.

### Είναι γνωστό πρόβλημα του πεδίου

Δεν είναι ιδιαιτερότητα του Nestor: React [#11877](https://github.com/facebook/react/issues/11877),
[#17609](https://github.com/facebook/react/issues/17609). Adobe Spectrum, GOV.UK Design System και το
MDN συστήνουν όλα `type="text" inputMode="decimal"` αντί για `type="number"` σε δεκαδικά.

---

## 2. Decision

**ΕΝΑ κεντρικό `NumericField`** στο `src/components/ui/numeric-field/`, χτισμένο ως **thin consumer**
των υπαρχόντων SSoT — μηδέν νέος κανόνας parse ή format:

- parse → `parseLocaleNumber` / `normalizeDecimalString` (ADR-576)
- display → `formatNumber` (ADR-314 `intl-formatting`)

### Θεμέλιο: view/model separation

| | Τύπος | Ιδιοκτήτης |
|---|---|---|
| **View** | `string` draft | το input όσο έχει focus |
| **Model** | `number` | η εφαρμογή |

Συμφιλίωση στο commit. Το `type="text" inputMode="decimal"` σημαίνει ότι ο browser **δεν αγγίζει ποτέ**
την τιμή, άρα κανένας χαρακτήρας δεν χάνεται.

### Επίπεδο μεγάλων παικτών (Figma · Revit · ArchiCAD · Cinema 4D)

| # | Δυνατότητα | Ποιος το κάνει |
|---|---|---|
| 1 | `.` **και** `,` ως υποδιαστολή | όλοι (locale-aware) |
| 2 | **Μαθηματικές εκφράσεις** — `1200/2`, `(18+3)*2`, `2,4*1,1` | Figma («κάθε πεδίο είναι calculator»), Revit, C4D |
| 3 | **Arrow nudge** ↑/↓ = step· **Shift** = ×10· **Alt** = fine | Figma (small/big nudge), Adobe |
| 4 | **PageUp/PageDown** = ×10 · **Home/End** = min/max | WAI-ARIA `spinbutton` |
| 5 | **Escape** = αναίρεση · **Enter** = commit | όλοι |
| 6 | **Scrub** — σύρσιμο στο label αλλάζει την τιμή | Figma, C4D signature gesture |
| 7 | **Clamp-on-commit**, όχι clamp-while-typing | React Aria |
| 8 | **Format-on-blur** (grouping), raw ενώ γράφεις | Excel, Sheets, Figma |
| 9 | `role="spinbutton"` + `aria-valuenow/min/max/valuetext` | WAI-ARIA |

**Πέρα από τους μεγάλους (#10):** επικόλληση με μονάδες/σύμβολα δουλεύει άμεσα — `21,5 m`,
`€ 1.200,50`, `70%`, `12 τ.μ.` παρσάρονται σωστά (κληρονομιά της garbage-strip σύμβασης του ADR-576).
Το Figma απορρίπτει το `21,5 m`.

### Το Escape είναι διβάθμιο — και γιατί δεν πάει από τον bus (ADR-364)

Το `key === 'Escape'` στο `use-numeric-field.ts` **μπλόκαρε το CHECK 3.7** (module
`escape-command-bus`, NEW FILE ⇒ μηδενική ανοχή). Εφαρμόστηκε το κριτήριο **T1/T2/T3** του
ADR-364 §10 — «**υπάρχει ανταγωνιστής;**», όχι «είναι input field;»:

| Υποψήφιος ανταγωνιστής | Πού ακούει | Ανταγωνίζεται; |
|---|---|---|
| Escape Command Bus | `window`, capture | **ΟΧΙ** — σκιπάρει `INPUT`/`TEXTAREA`/`contentEditable` εκ κατασκευής (`EscapeCommandBus.ts:80`) |
| Radix `DismissableLayer` του host dialog | `document` | **ΝΑΙ** |

Άρα το ζήτημα **δεν** ήταν το allowlisting αλλά η συμπεριφορά: χωρίς φύλαξη, **ένα** πάτημα ESC σε
πεδίο δεκαδικού μέσα σε διάλογο θα ανέτρεπε την τιμή **ΚΑΙ** θα έκλεινε τον διάλογο. Υλοποίηση:

- το ESC καταναλώνεται (`preventDefault` + `stopPropagation`) **μόνο όσο υπάρχει εκκρεμές draft**·
- με τίποτα να αναιρεθεί, το πλήκτρο **συνεχίζει** και κλείνει τον διάλογο.

Διβάθμια σημασιολογία Figma / VS Code / Revit. Ο hook είναι ήδη καταχωρημένο SSoT (module
`numeric-field`) και ο bus ζει στο subapp (εκτός root `tsconfig`) ⇒ αυτό παραμένει **ΕΝΑ** σημείο
με το literal για όλη την κύρια εφαρμογή — ίδιο προηγούμενο με το `inline-rename-keyboard.ts`,
επεκταμένο εκτός viewer. Allowlist + description του module ενημερώθηκαν.

### Ασφάλεια των εκφράσεων

**ΚΑΝΕΝΑ `eval` / `new Function`.** Tokenizer γραμμένος στο χέρι → shunting-yard → RPN evaluator.
Εκτελούνται **μόνο** οι 5 δηλωμένοι τελεστές (`+ - * / ^`). Κακόβουλη είσοδος το πολύ επιστρέφει `null`.
Καλύπτεται από pinned test (`never executes injected code`).

---

## 3. Δομή

```
src/components/ui/numeric-field/
├── numeric-expression.ts     # ασφαλής evaluator (tokenizer + shunting-yard)
├── numeric-field-core.ts     # καθαρές συναρτήσεις: clamp / nudge / step / display
├── use-numeric-field.ts      # headless hook (draft, commit, nudge, scrub, a11y)
├── NumericField.tsx          # το component
├── index.ts                  # barrel
└── __tests__/                # 57 tests
```

Κάθε αρχείο < 500 γραμμές, κάθε συνάρτηση < 40 (N.7.1) ✅

### API

```tsx
<NumericField
  id="bc-sd"
  label={t('sd.label')}   // προαιρετικό — ενεργοποιεί το scrub gesture
  value={draft.sd}        // number — το μοντέλο μένει number
  onValueChange={hook.setSd}
  step={0.01} min={0}
/>
```

Όταν δίνεται `label`, το component εκπέμπει **fragment** (Label + Input), όχι wrapper `<div>` — το
spacing το ορίζει ο caller, μηδέν div soup (N.4).

---

## 4. Consumers (migrated)

| Consumer | Πριν | Μετά |
|---|---|---|
| `components/projects/building-code/BuildingCodeForm.tsx` (×3: ΣΔ, Κάλυψη, Ύψος) | `<Input type="number">` + τοπικό `parseNumber` | `<NumericField>` |
| `components/core/FormFields/FormField.tsx` — ο κλάδος `case 'number'` του **κεντρικού** `UnifiedFormField` | `<Input type="number">` + `parseFloat` | `<FormFieldNumericInput>` → `useNumericField` |
| `features/property-details/.../PropertyCommercialPriceFields.tsx` (`PriceInputField`) | τοπικό format-on-blur, δικό του `toLocaleString('el-GR')` | display από `formatForDisplay` SSoT |

**Το `UnifiedFormField` ήταν χειρότερη περίπτωση**: έσπαγε **και τους δύο** διαχωριστές — το `2.` γύριζε
κενό από τον browser (reset), και το `parseFloat('2,4')` επιστρέφει **σιωπηλά `2`**. Σήμερα έχει μόνο
**1 call site** με `type="number"`, αλλά είναι κεντρικό component: κάθε **μελλοντική** χρήση θα
κληρονομούσε το ελάττωμα. Διορθώθηκε κατά N.0.2 (boy scout). Ο κλάδος εξήχθη σε ξεχωριστό αρχείο ώστε
το hook να καλείται άνευ όρων (Rules of Hooks) και το `FormField.tsx` να μείνει κάτω από τις 500 γρ.

**Σημείωση για το `PriceInputField`:** δεν έπασχε από το ελάττωμα (ήταν ήδη `type="text"`) — ήταν το
prior art του ADR-576. Παραμένει ξεχωριστό component επειδή έχει **διαφορετική σύμβαση μοντέλου**
(nullable `string`: μια τιμή μπορεί να είναι «καμία τιμή», ένας συντελεστής όχι). Βεβιασμένη ενοποίηση
θα παρήγαγε over-parameterised factory. Μοιράζεται πλέον τη σημασιολογία **display** με το SSoT.
Ελέγχθηκε με `npm run jscpd:diff` → **μηδέν clones** (N.18).

---

## 5. Tests

**61 tests, 61 GREEN** (57 στο SSoT + 4 στον κλάδο του `UnifiedFormField`)

`src/components/ui/numeric-field/__tests__/`

- `numeric-expression.test.ts` (38): literals με `.`/`,`, μικτοί separators, αριθμητική,
  προτεραιότητα/προσεταιριστικότητα, unary minus, μονάδες/σύμβολα, **injection safety**.
- `NumericField.test.tsx` (19): **regression pin** — «commits 2.4 when the user types "2.4"» = ακριβώς η
  ακολουθία πλήκτρων που παρήγαγε 4. Επίσης: half-typed `"2."` επιβιώνει, εκφράσεις, nudge/Shift/Home/End/
  Escape, clamp-on-commit, empty handling, ARIA, **και ρητό `expect(type).toBe('text')`**.

- `FormFields/__tests__/FormFieldNumericInput.test.tsx` (4): ο κεντρικός `UnifiedFormField` δεν
  επιστρέφει σε `type="number"`, και δέχεται `2.4` / `2,4` / `21.5`.

Εντολή: `npx jest src/components/ui/numeric-field FormFieldNumericInput`

> Το `commits 2.4 → 2.4` είναι το anchor. Αν κοκκινίσει, η παλινδρόμηση επέστρεψε.

---

## 6. Υπόλοιπο χρέος (ratchet)

`grep 'type="number"' src/ --exclude-dir=dxf-viewer` → **187 σημεία σε 81 αρχεία** (μετρημένο 2026-07-25).

**ΔΕΝ πάσχουν όλα**: το ελάττωμα χτυπά μόνο εκεί που η τιμή είναι **δεκαδική**. Ακέραια πεδία (αριθμός
ορόφων, τεμάχια) είναι ασφαλή με `type="number"`. Χρειάζεται ανάγνωση ανά σημείο — **ΟΧΙ blanket sed**.
Καταγράφηκε στο `.claude-rules/pending-ratchet-work.md`.

---

## 7. Consequences

- ✅ Ο ΣΔ / ύψος / κάλυψη δέχονται πλέον **και τελεία και κόμμα** — η αρχική απαίτηση.
- ✅ ΕΝΑ σημείο ορίζει τη συμπεριφορά κάθε δεκαδικού πεδίου· κάθε νέο πεδίο την κληρονομεί δωρεάν.
- ✅ Εκφράσεις/nudge/scrub/a11y έρχονται μαζί — δεν χρειάζεται να τα ξαναγράψει κανείς.
- ⚠️ Το `NumericField` κάνει **live commit** ενώ ο χρήστης γράφει (για ζωντανό validation) αλλά
  **clamp μόνο στο commit** — ενδιάμεσα εκτός ορίων είναι ορατά μέχρι το blur. Σκόπιμο: το clamping
  ενώ πληκτρολογείς εμποδίζει να γράψεις `150` σε πεδίο με `max=100` για να το κάνεις μετά `15`.
- ⚠️ Τα υπόλοιπα ~80 αρχεία παραμένουν στο παλιό pattern μέχρι να μεταναστεύσουν (ratchet).

## 8. Changelog

- **2026-07-25:** Δημιουργία. Εντοπισμός ελαττώματος στο E2E verify Έργων (Φάση 2), κεντρικό
  `NumericField` + evaluator + core + hook, 2 consumers migrated, 57 tests, registry guard,
  ratchet entry για τα υπόλοιπα 81 αρχεία.
- **2026-07-26:** Το ESC έγινε **διβάθμιο** (νέο §2 «Το Escape είναι διβάθμιο») μετά από μπλόκο
  του CHECK 3.7 — `stopPropagation` όσο υπάρχει draft, αλλιώς το πλήκτρο φτάνει στον διάλογο.
  Allowlist `escape-command-bus` +1· changelog ADR-364 ενημερώθηκε.
