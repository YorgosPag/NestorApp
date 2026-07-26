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

### `blankValue` — η κενή κατάσταση ενός `number` μοντέλου (Phase 3)

Η μετανάστευση του `sales` έδειξε ότι **το ελάττωμα δεν ήταν το μόνο εμπόδιο**: 45 από τα ~50 σημεία
ήταν πεδία **εισαγωγής δεδομένων** που ανοίγουν **κενά** με placeholder (`value={amount || ''}` —
**58 εμφανίσεις** σε όλο το `src/components`). Χωρίς αντίστοιχη έννοια στο SSoT, κάθε τέτοιο πεδίο θα
άνοιγε σε ένα `0` που ο χρήστης πρέπει να σβήσει πρώτος — **οπισθοδρόμηση UX**, και ο μόνος τρόπος να
αποφευχθεί θα ήταν ένα wrapper ανά domain (**ακριβώς η παγίδα N.18**).

```tsx
<NumericField value={amount} onValueChange={setAmount} blankValue={0} placeholder="€" />
```

Σημασιολογία:

| Κατάσταση | Συμπεριφορά |
|---|---|
| `value === blankValue`, χωρίς focus | display κενό ⇒ φαίνεται το `placeholder` |
| focus σε blank πεδίο | draft `''` — το πρώτο πλήκτρο δεν αντικαθιστά τίποτα |
| πεδίο αδειάζει | commit `emptyValue`, που **default-άρει στο `blankValue`** |
| `value === blankValue` | **εξαιρείται από τα bounds** |
| a11y | χωρίς `aria-valuenow`/`aria-valuetext` ⇒ WAI-ARIA "indeterminate" spinbutton |

**Η εξαίρεση από τα bounds είναι λειτουργική απαίτηση, όχι λεπτομέρεια:** ένα πεδίο ποσού είναι
ταυτόχρονα `min={0.01}` **και** blank-στο-0. Αν το clamp εφαρμοζόταν στην κενή κατάσταση, το σβήσιμο
θα την ανέβαζε στο `0.01` και **ο placeholder δεν θα ξαναγύριζε ποτέ** — τα όρια θα κατέστρεφαν σιωπηλά
την κενή κατάσταση. Το «δεν συμπληρώθηκε» δεν είναι αριθμός εκτός ορίων.

**Γιατί ΟΧΙ `value: number | null`** (React Aria / Spectrum): θα ανάγκαζε κάθε caller state, validator
και payload να γίνει nullable για ένα καθαρά **παρουσιαστικό** ζήτημα, και θα έσπαγε τον τύπο του
`onValueChange` στα δύο (union ή generic component + `forwardRef` cast). Η blank κατάσταση είναι
**view state** — καταρρέει τη στιγμή που ο χρήστης αλλάζει ενεργά την τιμή (typing / nudge / scrub),
γι' αυτό την τιμούν **μόνο** το unfocused display και το αρχικό draft του focus.

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

## 5.1 Sales domain — anchors (Phase 3)

`src/components/sales/__tests__/sales-numeric-fields.test.tsx` — **165 tests**, δύο **διαφορετικού
είδους** anchors:

1. **Behavioural** — το `AppurtenancesSection` οδηγείται πλήκτρο-πλήκτρο με `1250.5` και `1250,5`.
   **Mutation-verified:** με επαναφορά του `<Input type="number">` το test κοκκίνισε δείχνοντας
   `1250.5 → 0.5` — **το ελάττωμα αναπαράχθηκε ζωντανά μέσα στο test**, όχι θεωρητικά.
2. **Structural** — σάρωση όλου του `src/components/sales`: αποτυγχάνει μόλις οποιοδήποτε αρχείο
   ξαναφέρει δεκαδικό number-typed input. **Γιατί χρειάζεται:** μεταναστεύθηκαν **18 αρχεία**· ένα
   behavioural test για ένα από αυτά δεν εμποδίζει τα άλλα 17 να παλινδρομήσουν, και το ελάττωμα είναι
   **σιωπηλό** (κανένα σφάλμα — απλώς λάθος αριθμός στη βάση), άρα η παλινδρόμηση θα έφτανε σε production.
   Τα επιτρεπόμενα σημεία (2× Recharts `XAxis`, 2× ακέραια Monte Carlo) είναι **ρητό allowlist** με
   αιτιολόγηση, συν test που κόβει τις μπαγιάτικες εγγραφές του.

⚠️ Και οι δύο markers (`type=…`, fractional `step=…`) **συναρμολογούνται από τμήματα** μέσα στο test —
γραμμένοι αυτούσιοι, το ίδιο το αρχείο θα απαντούσε σε **κάθε grep με το οποίο μετριέται το ratchet**
και θα φούσκωνε τον αριθμό του υπόλοιπου χρέους (η παγίδα «το σχόλιο που παραθέτει το pattern **είναι**
εμφάνιση του pattern»).

---

## 6. Υπόλοιπο χρέος (ratchet)

| Μέτρηση | 2026-07-25 | **2026-07-26 (μετά το sales)** | Δ |
|---|---|---|---|
| `type="number"` σημεία (εκτός dxf-viewer) | 193 | **138** | **−55** |
| αρχεία | 85 | **69** | **−16** |
| 🎯 `step="0.x"` — **βεβαιωμένα δεκαδικά** | 68 | **46** | **−22** |
| αρχεία | 36 | **24** | **−12** |

> Οι αριθμοί της 2026-07-25 (187/81) ήταν παλαιότερο μέτρημα· το 193/85 είναι η επαναμέτρηση της
> 2026-07-26 με τις ίδιες εντολές, ώστε το Δ να είναι συγκρίσιμο.

**ΔΕΝ πάσχουν όλα**: το ελάττωμα χτυπά μόνο εκεί που η τιμή είναι **δεκαδική**. Ακέραια πεδία (αριθμός
ορόφων, τεμάχια, πλήθος σεναρίων, RNG seed) είναι ασφαλή ως number inputs. Χρειάζεται ανάγνωση ανά
σημείο — **ΟΧΙ blanket sed**. Επόμενα domains κατά προτεραιότητα:
`building-management` (5 αρχεία) · `projects/ika` (3) · `procurement` (3) · `accounting` (3).
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
- **2026-07-26 — Phase 3, domain `sales` (ratchet):**
  - **SSoT +1 έννοια:** `blankValue` (νέο §3) — η κενή κατάσταση ενός `number` μοντέλου, με
    `emptyValue` να default-άρει σε αυτήν και **εξαίρεση από τα bounds**. Απαιτήθηκε από 45 από τα ~50
    σημεία του domain· χωρίς αυτήν η εναλλακτική ήταν wrapper ανά domain (παγίδα N.18).
    **+9 tests** στο υπάρχον suite (**69 GREEN**), **4 mutations** επαληθευμένα (isBlank, draft του
    focus, default του `emptyValue`, εξαίρεση bounds — κάθε ένα κοκκίνισε τα σχετικά anchors).
  - **18 αρχεία μεταναστεύθηκαν** (~45 πεδία): 4 sales dialogs · 2 financial-intelligence ·
    7 payments · 5 payments/financial-intelligence. Ό,τι είναι γνήσια ακέραιο έμεινε number input
    (πλήθος σεναρίων, RNG seed) — **καμία blanket αντικατάσταση**.
  - **Νέο anchor suite** `sales-numeric-fields.test.tsx` (**165 GREEN**, §5.1) — behavioural +
    structural. Mutation-verified: η επαναφορά του παλιού input αναπαρήγαγε ζωντανά `1250.5 → 0.5`.
  - **Boy scout (N.0.2 / N.11 / ADR-314):** 5 hardcoded placeholders (`"€ Budget"`, `"€ Actual"`,
    `"Category…"`, `"Project…"`, `"Tier name…"`, `"Floor"`/`"Cap"`) → `aria-label` με υπάρχοντα
    κλειδιά· **+2 νέα κλειδιά** `collarFloor`/`collarCap` σε **el ΚΑΙ en**· ένα
    `toLocaleString('el-GR')` → `formatCurrency` (Intl SSoT)· νεκρός τοπικός `parseInput` διαγράφηκε.
  - **N.18 (jscpd):** **0 νέα clones**. Τα 8 ευρήματα του `jscpd:diff` επαληθεύτηκαν ένα προς ένα ως
    **προϋπάρχοντα** — οι εκδόσεις του `HEAD` εξήχθησαν σε ξεχωριστό δέντρο και έδωσαν **τις ίδιες
    ακριβώς περιοχές γραμμών** (import blocks + dispatch λογική μεταξύ των αδελφών
    `ReserveDialog`/`SellDialog` και `EditInstallment`/`RecordPayment`).
