# ADR-711 — Modal Keyboard Scope + Focus Restore (SSoT)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **APPROVED** 2026-07-26 — υλοποιήθηκε και **επαναμετρήθηκε ζωντανά** (Ε1 σε 2D+3D, Ε2, Ε4). 🟡 Ένα ζωντανό μισό του Ε3 εκκρεμεί (βλ. §7). |
| **Date** | 2026-07-26 |
| **Category** | Cross-cutting — Accessibility & Keyboard |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-711-modal-keyboard-scope-and-focus-restore.md` |
| **Author** | Claude Opus 5 + Γιώργος Παγώνης |
| **Canonical** | `src/lib/a11y/keyboard-scope.ts` · `src/subapps/dxf-viewer/keyboard/global-shortcut-listener.ts` |
| **Related ADRs** | ADR-364 §10.15 (Escape Command Bus — οι μετρήσεις και η ένταξη), ADR-366 §12 (BIM comments/lightbox), ADR-294 (SSoT Ratchet), ADR-040 (Preview Canvas Perf) |

---

## 1. Context — δύο κενά, ένα αρχέτυπο

Και τα δύο ζούσαν επί μήνες **με πράσινα unit tests**. Το jest δεν ρωτά ποτέ «ποιος άλλος ακούει
αυτό το πλήκτρο;» ούτε «τι κάνει ο browser όταν κλείσει το dialog».

### 1.1 Το πληκτρολόγιο δεν είχε ιδιοκτήτη

Ο DXF viewer έχει **43** window-level keydown listeners. Ο καθένας έγραφε μόνος του έναν φύλακα
«γράφει ο χρήστης σε πεδίο;» — μετρημένα **δέκα και πλέον αντίγραφα με τέσσερα ονόματα**
(`isTypingInFormField`, `isEditableFocus`, `isInputFocused`, + inline παραλλαγές) — και **κανένας**
δεν ρωτούσε αν υπάρχει ανοιχτό modal. Μέσα σε modal το focus κάθεται σε `<button>`, άρα ο φύλακας
δεν έπιανε ποτέ:

- `use3DShortcuts.ts` αντιστοιχούσε το `Tab` σε `ACTION_FOCUS_NEXT_3D` και έκανε
  `preventDefault + stopPropagation` ⇒ **η πλοήγηση με πληκτρολόγιο μέσα σε κάθε dialog του viewer
  ήταν νεκρή** (παραβίαση WAI-ARIA APG: σε dialog το Tab οφείλει να κυκλώνει τα εστιάσιμα).
- `useKeyboardShortcuts.ts:220` (`PAN_STEP = 80`) μετακινούσε το viewport **±80px ανά πάτημα**
  βέλους πίσω από ανοιχτό modal.

### 1.2 Το focus δεν επέστρεφε ποτέ — 161 από 170 αρχεία

`@radix-ui/react-dialog/dist/index.mjs:146-149` — το **modal** `DialogContent` κάνει
`event.preventDefault()` στο `onCloseAutoFocus` (σκοτώνοντας τη γενική επαναφορά του `FocusScope`)
και εστιάζει **μόνο** το `context.triggerRef`. Μετρημένο στο δέντρο:

```
αρχεία με DialogContent            : 170
αρχεία με DialogTrigger            :  31
DialogContent ΧΩΡΙΣ DialogTrigger  : 161   ← triggerRef === null ⇒ ?.focus() = no-op
```

⇒ **καθολικό a11y κενό της εφαρμογής**, όχι bug ενός component.

## 2. Τι απορρίφθηκε — και γιατί (μην τα ξανακυνηγήσεις)

| Υποψήφιο | Γιατί όχι |
|---|---|
| **`inert` στο app root** | Αφαιρεί focusability / hit-testing **του υποδέντρου**· **δεν** σταματά listeners σε `window`/`document`. Το dialog ζει σε **portal εκτός** του inert υποδέντρου ⇒ το keydown φτάνει άθικτο στο window capture. Χρήσιμο συμπλήρωμα, όχι λύση. |
| **Νέα εξάρτηση hotkeys** (TanStack Hotkeys, react-hotkeys-hook) | Δίνουν ακριβώς αυτό το σχήμα (scope stack), αλλά θα απαιτούσαν μετανάστευση και των 43 listeners σε δικό τους μοντέλο. Το σχήμα υλοποιείται ντόπια σε ~60 γραμμές. |
| **Φύλακας σε κάθε listener** | Σαπίζει στον 44ο listener. Ο φύλακας πρέπει να είναι **δομικός**. |
| **Ο ESC bus ως πηγή «ανοιχτό modal;»** | Ο bus ξέρει μόνο τους δικούς του (dxf-viewer). Τα 170 dialogs της εφαρμογής δεν εγγράφονται σε αυτόν. |
| **DOM query `[aria-modal="true"]` ανά keydown** | Λειτουργεί χωρίς εγγραφή, αλλά είναι σάρωση DOM σε hot path (βέλη σε key-repeat). Κρατήθηκε ως **ιδέα**, όχι ως υλοποίηση. |

## 3. Decision

### 3.1 `src/lib/a11y/keyboard-scope.ts` — framework-free SSoT

```ts
// ── ΟΙ ΔΥΟ ΕΡΩΤΗΣΕΙΣ (§5.6, 2026-07-27) — μία υλοποίηση η καθεμία ──
isTextEntryTarget(target): boolean            // Ε1: «γράφει ο χρήστης ΚΕΙΜΕΝΟ;»
consumesTypedCharacters(target): boolean      // Ε2: «θα ΚΑΤΑΝΑΛΩΣΕΙ τον χαρακτήρα;» ⊃ Ε1
isTextEntryFocused(): boolean                 // Ε1 πάνω στο activeElement, SSR-safe
focusConsumesTypedCharacters(): boolean       // Ε2 πάνω στο activeElement, SSR-safe
// ── ο σωρός ──
pushModalKeyboardScope(): () => void          // σωρός· ιδempotent release
isModalKeyboardScopeActive(): boolean
inspectModalKeyboardScope(): { depth }        // dev/test — το ανάλογο του escapeBus.inspect()
shouldGlobalShortcutYield(event): boolean     // η ΜΙΑ ερώτηση των global accelerators (ρωτά Ε2)
```

- **Σωρός, όχι σημαία**: dialog → ConfirmDialog από πάνω· το κλείσιμο του δεύτερου δεν πρέπει να
  ξεκλειδώνει τους accelerators όσο ζει το πρώτο.
- **Ιδempotent release**: το διπλό effect του React StrictMode δεν αφήνει αρνητικό βάθος.
- **Ε1 ⊂ Ε2, και η διαφορά τους είναι ο λόγος ύπαρξης δύο ονομάτων** (§5.6): `<select>` /
  `role="combobox"` απαντούν **ΝΑΙ** στην Ε2 (type-ahead) και **ΟΧΙ** στην Ε1 (το `Escape` σε
  dropdown πρέπει να κλείνει τον dialog, ADR-364). Το `isEditableTarget` — που ήταν εδώ ως «η ΜΙΑ
  υλοποίηση» — ρωτούσε **μόνο** την Ε1 με όνομα που υπονοούσε και τις δύο· γι' αυτό ένα δεύτερο,
  ομώνυμο και **διαφορετικό** σώμα ζούσε allowlisted στο `radial-command-ring-helpers`.
  ⚠️ Η προηγούμενη διατύπωση εδώ («δεν είναι γνήσιο υπερσύνολο όλων») ήταν **σωστή περιγραφή λάθους
  μοντέλου**: η επιδιόρθωση δεν ήταν να γίνει το ένα υπερσύνολο, αλλά να **χωριστούν οι ερωτήσεις**.
- **Ε1 πιάνει ό,τι έχαναν τα δέκα**: `isContentEditable` (κληρονομημένο) και `contenteditable=""`.
- **Ε2 είναι ΡΟΛΟΥ, όχι `tagName`**: το canonical dropdown (ADR-001, **237 αρχεία**) είναι
  `<button role="combobox">`. Κάλυψη κατά WAI-ARIA APG + `FORM_TAGS_AND_ROLES` του
  react-hotkeys-hook, **συν** τα item-level roles (`option`, `menuitem*`, `treeitem`) γιατί όσο ένα
  Radix Select είναι **ανοιχτό** το focus κάθεται στο `option` ενώ ο handler ζει στον πρόγονο
  `listbox` — έλεγχος μόνο του widget ρόλου θα το έχανε. **Εκτός επίτηδες**: `slider`, `radio`,
  `tab`, `grid` — πλοηγούνται με **βέλη**, άρα θα σκότωναν accelerators χωρίς λόγο.
- `shouldGlobalShortcutYield` = **belt-and-suspenders** (N.7.2 #4): scope (πρωτεύον, O(1))
  **ή** στόχος/`activeElement` που καταναλώνει τον χαρακτήρα (δίχτυ για layers εκτός των κοινών
  primitives).

### 3.2 Τροφοδοσία — ΕΝΑ σημείο, 170 καταναλωτές

`<ModalKeyboardScope />` αποδίδεται **μέσα** στο Radix `Content` των `dialog.tsx`,
`alert-dialog/parts/Content.tsx`, `sheet.tsx`.

🔴 **ΤΟ ΛΕΠΤΟ ΣΗΜΕΙΟ**: η συνάρτηση του `DialogContent` εκτελείται σε **κάθε** render του γονέα,
**ακόμη και με `open={false}`** (ο γονέας κρατά το element στα children του και το Portal/Presence
αποφασίζει αν θα αποδοθεί). Hook στο ίδιο το `DialogContent` θα κρατούσε το scope **μόνιμα
πατημένο** και θα σκότωνε τους global accelerators για πάντα. Μέσα στο `Content` το υποδέντρο
υπάρχει **μόνο όταν είναι ανοιχτό**.

### 3.3 Επαναφορά focus — `useDialogFocusRestore()`

Το επίσημα αναγνωρισμένο pattern (radix-ui/primitives Discussion #3319):

- `onOpenAutoFocus` → κατέγραψε το `document.activeElement`. Το `FocusScope` εκπέμπει
  AUTOFOCUS_ON_MOUNT **πριν** μετακινήσει το focus, άρα εκεί ο opener είναι ακόμη ενεργός.
  (Καταγραφή σε render/effect του `Content` θα ήταν **λάθος** — βλ. §3.2.)
- `onCloseAutoFocus` → **πρώτα** ο handler του καταναλωτή· αν έκανε `preventDefault`, σεβόμαστε.
  Αλλιώς, αν ο opener είναι `isConnected` → `preventDefault()` + `opener.focus()`.
  Αν χάθηκε από το DOM → **δεν** κάνουμε `preventDefault` (αφήνουμε τη διαδρομή του Radix).
- Ο Radix συνθέτει `composeEventHandlers(props.onCloseAutoFocus, internal)` ⇒ ο δικός μας τρέχει
  **πρώτος** και παρακάμπτει το `triggerRef`. Όταν υπάρχει `<DialogTrigger>`, opener === trigger
  ⇒ **ταυτόσημο αποτέλεσμα, μηδέν παλινδρόμηση** στα 31 αρχεία.

### 3.4 `addGlobalShortcutListener()` — ο φύλακας γίνεται δομικός

`src/subapps/dxf-viewer/keyboard/global-shortcut-listener.ts`. Χρησιμοποιείς τον wrapper → παίρνεις
τον φύλακα δωρεάν.

`allowWhenEditable` — **ίδιο λεξιλόγιο με το `EscapeHandler`** (ADR-364 §3.4) και για τον ίδιο
λόγο: υπάρχουν handlers που **κατέχουν** τον χρόνο πληκτρολόγησης. Μετρημένο παράδειγμα:
`useDimensionKeyboardRouting` δέχεται `Enter` ενώ το Dynamic Input έχει focus, κάνει blur για να
δεσμευτεί η τιμή, και μετά προωθεί. Καθολικός φύλακας εκεί θα ήταν **παλινδρόμηση**, όχι διόρθωση
— βρέθηκε κατά την υλοποίηση, όχι μετά.

### 3.5 Όρια — ποιος ΔΕΝ ρωτά

- **`EscapeCommandBus`**: καταναλώνει μόνο `isEditableTarget`, **ποτέ** `shouldGlobalShortcutYield`.
  Ο bus οφείλει να δουλεύει ΜΕΣΑ στα modals — εκεί ζει το `ESC_PRIORITY.MODAL_DIALOG`.
- **Listeners που ανήκουν σε input/overlay** (Dynamic Input, Command Line, Radial ring): το πεδίο
  τους **είναι** ο ιδιοκτήτης του πλήκτρου.

## 4. Εύρος αυτής της φάσης

Μετανάστευσαν οι **7** ιδιοκτήτες `Tab` / βελών — δηλαδή **όλα** τα μετρημένα ελαττώματα:
`use3DShortcuts`, `useKeyboardShortcuts`, `use2DKeyboardFocus`, `useBimMaterialCycler`,
`use-column-anchor-tab-cycle`, `useFoundationTool`, `useDimensionKeyboardRouting`.

Οι υπόλοιποι ~23 global accelerators μεταναστεύουν **Boy-Scout στο άγγιγμα** (N.0.2).

## 5. Ratchet — ΕΝΕΡΓΟΣ, σε **δύο** όργανα (2026-07-26)

**Κατάσταση: 🟢 ΕΝΕΡΓΟΣ.** Η αρχική προσπάθεια απέτυχε με τεκμηριωμένο λόγο· το ζητούμενο
επιτεύχθηκε αλλάζοντας **ποιο** όργανο φυλάει **τι**.

### 5.1 Γιατί το ένα καθολικό pattern ήταν λάθος εργαλείο

Το προφανές μπλοκ ήταν `forbiddenPatterns: ["window\\.addEventListener\\(.keydown."]`. Μετρημένο:
ταιριάζει **38 αρχεία** (ts/tsx, χωρίς `coverage/`+`reports/`) και **κανένα** δεν υπάρχει στο
`.ssot-violations-baseline.json` ⇒ ως blocking check θα **μόνο** μπλόκαρε. Το `npm run ssot:baseline`
που θα το θεράπευε:

- έτρεχε **>22 λεπτά χωρίς έξοδο** σε Windows. **Η αιτία βρέθηκε**: το `scripts/ssot-audit.sh` κάνει
  ένα full-`src` `grep -rE` **ανά module**, και τα modules είναι **349** ⇒ 349 σαρώσεις ~12.600
  αρχείων. Δεν είναι κρέμασμα, είναι O(modules × files).
- ξαναγράφει **κοινό** αρχείο, αποτυπώνοντας μέσα του τα uncommitted ευρήματα όποιου άλλου πράκτορα
  δουλεύει στο ίδιο δέντρο — ακριβώς αυτό που το repo προειδοποιεί να μη γίνεται.

Είναι το **ίδιο σχήμα με το `numeric-field`** (ADR-706): ένα καθολικό pattern σε 38 σημεία δίνει
**μηδέν σήμα** (παγίδα N.12). Η διόρθωση δεν ήταν «περίμενε ήσυχο δέντρο» — ήταν **χώρισε την
ερώτηση στα δύο**.

### 5.2 Όργανο Α — registry module (CHECK 3.7): φυλάει κατά **re-implementation**

Ενεργό στο `.ssot-registry.json`, `ssotFile: src/lib/a11y/keyboard-scope.ts`, tier 2. Απαγορεύει
**δεύτερη υλοποίηση** των δύο predicates:

| Pattern | Τι σταματά |
|---|---|
| `function\s+(shouldGlobalShortcutYield\|isModalKeyboardScopeActive\|pushModalKeyboardScope\|addGlobalShortcutListener)\s*\(` | δεύτερος σωρός scope / δεύτερος wrapper |
| `function\s+(isTypingInFormField\|isEditableTarget\|isEditableFocus\|isInputFocused\|isTypingTarget\|isTextInputFocused)\s*\(` | ο **11ος** αντίγραφος του «γράφει ο χρήστης;» |

🟢 **Μηδέν ευρήματα εκτός allowlist** (επαληθευμένο με προσομοίωση της λογικής του `audit.sh`:
grep → allowlist prefix skip) ⇒ **δεν χρειάζεται καθόλου `ssot:baseline`** ⇒ **ασφαλές σε κοινό
δέντρο**, που ήταν όλο το εμπόδιο. Ίδιο κόλπο με το `impact-guard-hook` (ADR-664).
Επαληθεύτηκε από `npm run test:registry-golden` → **96/96** (ERE εγκυρότητα + fixtures).

5 εγγραφές allowlist, κάθε μία με λόγο: το `a11y/` (SSoT), ο wrapper, το
`bim-3d/ui/is-typing-in-form-field.ts` (λεπτό re-export), ο `EscapeCommandBus` (**delegate-άρει**
στο SSoT) και το `radial-command-ring-helpers.ts` (**καταγεγραμμένο χρέος** — §5.4).

### 5.3 Όργανο Β — structural jest anchor: ratchet του **πληθυσμού**

`src/subapps/dxf-viewer/keyboard/__tests__/raw-keydown-listener-ratchet.test.ts`

Ο αριθμός ζει σε **δικό μας** αρχείο, όχι σε κοινό baseline: καμία 22-λεπτη regeneration, καμία
ρύπανση από ξένη δουλειά, και το σήμα είναι **ονομαστικό** — «`hooks/foo.ts`», όχι «+1 violation».

- `BY_DESIGN` — **10** listeners που *οφείλουν* να είναι ωμοί, **με τον λόγο γραμμένο ανά εγγραφή**
  (wrapper, modifier tracker, escape bus ×2 + tests ×2, dynamic-input ×3, ένα παράδειγμα τεκμηρίωσης).
- `PENDING_MIGRATION` — **27** μη μεταναστευμένοι· Boy-Scout στο άγγιγμα (§4).
- Πιάνει **και τις δύο** κατευθύνσεις: νέο αρχείο ⇒ κόκκινο ονομαστικά· μεταναστευμένο που έμεινε
  στη λίστα ⇒ κόκκινο «βγάλ' το» (ο ratchet **μόνο μικραίνει** — λίστα που δεν αδειάζει είναι σχόλιο).
- Φύλακας κενής σάρωσης (>500 αρχεία, >10 offenders) ώστε ένα σπασμένο path να μη διαβαστεί ως «καθαρό».

**Mutation-verified ×2**: (α) βγάζοντας το `statusbar/CadStatusBar.tsx` από τη λίστα εμφανίστηκε ως
ΝΕΟ ⇒ ο έλεγχος όντως διαβάζει τα αρχεία· (β) επαναφέροντας τον ωμό listener στο
`useLayerCommandShortcuts` έσπασαν **δύο** φύλακες — ο ratchet ονομαστικά **και** το behavioural test
«ΔΕΝ δρα όσο modal κατέχει το πληκτρολόγιο».

### 5.4 🔴 ΠΕΡΙΣΤΑΤΙΚΟ (stage race) — και η κατάληξή του

Το αρχικό module γράφτηκε στο `.ssot-registry.json` και ενώ γινόταν ο έλεγχος επιπτώσεων ο
**παράλληλος agent (ADR-710) έκανε `git add` του ίδιου αρχείου** και το commit-άρισε
(`48f0b4e9` / `347d7bd3`) **μαζί με τη δική του δουλειά** — δηλαδή ενεργό `forbiddenPatterns`
**χωρίς baseline** στο HEAD. Η αφαίρεση έμεινε στο working tree και **μπήκε στο HEAD με τα
`1ae7c8e8` / `198d0762` του ίδιου agent** (επαληθευμένο: το `modal-keyboard-scope` δεν υπάρχει πια
στο HEAD, 349 modules, το αρχείο καθαρό έναντι HEAD). Η δουλειά του άλλου agent ήταν **ανέπαφη** σε
όλη τη διαδρομή.

**Δίδαγμα (και ο λόγος που το §5.2 είναι στενό):** σε κοινό working tree ένα κοινό αρχείο δεν είναι
δικό σου να το γράψεις «για λίγο». Ένα module που **δεν χτυπά κανένα υπάρχον αρχείο** είναι ακίνδυνο
ακόμη κι αν το commit-άρει άλλος κατά λάθος. Ένα με 38 ευρήματα είναι μίνα.

### 5.5 Boy-Scout που έγινε στην ίδια συνεδρία

`hooks/useLayerCommandShortcuts.ts` μετανάστευσε (ratchet **28 → 27**). Έφερε τρία μαζί:

1. **Ενδέκατο αντίγραφο εξαλείφθηκε**: ο τοπικός `isInputFocused()` σύγκρινε `contenteditable` με
   τη συμβολοσειρά `'true'` ⇒ έχανε `contenteditable=""` **και** το κληρονομημένο.
2. **N.18**: οι δύο isolate διαδρομές ήταν αντίγραφο η μία της άλλης (**9 γρ. / 57 tokens**,
   εντοπισμένο από `jscpd:diff`, **προϋπάρχον**) — διέφεραν μόνο στην κλάση εντολής. Έγιναν μία με
   όρισμα `inverse`, mutation-verified (αντιστροφή πολικότητας ⇒ 2 tests κόκκινα).
3. **N.7.1**: το `onKeyDown` ήταν **47** γραμμές (προϋπάρχουσα παραβίαση) → **34**, με τον helper
   έξω από τον handler.

**Νέα κάλυψη** (το hook δεν είχε **καμία**): `hooks/__tests__/useLayerCommandShortcuts.test.ts`,
**5 tests** — πολικότητα **και προς τις δύο** κατευθύνσεις (ένα test μόνο για το ένα πλήκτρο θα
περνούσε ακόμη κι αν οι δύο εντολές είχαν ανταλλάξει θέσεις), οι άλλες τρεις διαδρομές, ο φύλακας
modal, η αποδέσμευση στο unmount.

⚠️ **Παγίδα που κόστισε**: mock του `resolveLayerIsolateSettings` **σβήνει** το `inverseMode` του
ίδιου module, που ο `LayerIsolateInverseCommand` καλεί στον constructor ⇒ το test έσκαγε **μέσα σε
listener** και διαβαζόταν ως «η inverse διαδρομή δεν πυροδοτεί». Ο resolver μένει **πραγματικός**.

### 5.6 ✅ ΕΚΛΕΙΣΕ (2026-07-27) — μία λέξη κουβαλούσε **δύο** ερωτήσεις

**Το χρέος όπως καταγράφηκε (2026-07-26):** τέταρτη ζωντανή υλοποίηση
(`radial-command-ring-helpers.isEditableTarget`), **allowlisted αντί να ενοποιηθεί**, γιατί ελέγχει
**και `SELECT`** που το SSoT δεν έλεγχε. Βιαστική ενοποίηση θα άλλαζε συμπεριφορά σε δύο σημεία
ταυτόχρονα: το δαχτυλίδι θα έκλεβε πλήκτρα από focused `<select>` (type-ahead του browser)· και —
αν αντ' αυτού προστεθεί το `SELECT` στο SSoT — ο **escape bus** καταναλώνει το ίδιο predicate, οπότε
το `Escape` με focus σε `<select>` **μέσα σε dialog** θα έπαυε να κλείνει τον dialog.

**Γιατί έμεινε άλυτο μια ολόκληρη μέρα — και ποιο ήταν το πραγματικό λάθος:** τα δύο σημεία **δεν
ήταν αντίγραφα**. Η λέξη «editable» κουβαλούσε **δύο διαφορετικές ερωτήσεις**:

| Ερώτηση | Ποιος ρωτά | `<select>` |
|---|---|---|
| «Θα **καταναλώσει** αυτό το element τον εκτυπώσιμο χαρακτήρα;» | heads-up accelerator του δαχτυλιδιού | **ΝΑΙ** (type-ahead) |
| «**Πληκτρολογεί** ο χρήστης κείμενο, ώστε το `Escape` να σημαίνει ακύρωση-πεδίου κι όχι κλείσιμο-στρώματος;» | escape bus | **ΟΧΙ** |

Κάθε μονόπλευρη διόρθωση έσπαγε τον άλλο τομέα — γι' αυτό καμία δεν «έπιανε». Η λύση δεν ήταν να
διαλέξουμε πλευρά αλλά να **ονομάσουμε και τις δύο**: `isTextEntryTarget` και
`consumesTypedCharacters`, συν τους δύο `activeElement` readers `isTextEntryFocused` /
`focusConsumesTypedCharacters`.

**Πέμπτο, πιο ήσυχο διπλότυπο που αποκαλύφθηκε στην πορεία:** το μοτίβο
`predicate(document.activeElement)` ήταν γραμμένο σε **πέντε** σημεία με **τρία** διαφορετικά SSR
guards — και σε ένα, **κανένα**. Οι δύο readers το κλείνουν.

**Το μετρημένο ελάττωμα που διορθώθηκε:** με focus στο canonical Radix dropdown (ADR-001,
`<button role="combobox">`, **237 αρχεία**) η πληκτρολόγηση ενός γράμματος άνοιγε τη γραμμή εντολών
του viewer αντί να τρέξει το type-ahead του Radix — επειδή ο έλεγχος ρωτούσε **`tagName`**, όπου ένα
`<button>` απαντά «όχι». Κανένας έλεγχος tagName δεν μπορεί να το δει: η ερώτηση είναι **ρόλου**,
όπως ορίζει το WAI-ARIA APG (και όπως κάνει το `FORM_TAGS_AND_ROLES` του react-hotkeys-hook).

**Κατάσταση allowlist:** έμεινε **ένα** entry (`bim-3d/ui/is-typing-in-form-field.ts`)· τα δύο άλλα
(`EscapeCommandBus`, `radial-command-ring-helpers`) αφαιρέθηκαν — είναι πλέον καταναλωτές του SSoT.
**N.7.1**: ο `RadialCommandRing.tsx` πέρασε τις 500 γραμμές με την αλλαγή, οπότε ο accelerator
βγήκε σε δικό του hook (`use-ring-heads-up-key.ts`) — εκεί ζει τώρα και η εξήγηση «ρώτα ρόλο».

## 6. Tests — και τι ΔΕΝ πιάνουν

| Αρχείο | Τι κλειδώνει |
|---|---|
| `src/lib/a11y/__tests__/keyboard-scope.test.ts` | nesting σωρού, ιδempotent release, **και τα δύο** predicates (§5.6) + οι δύο readers· ρητά: `role="combobox"` ⇒ Ε1 **false** / Ε2 **true**, και `slider`/`radio`/`tab`/`grid` ⇒ Ε2 **false** (πήχης υπερδιόρθωσης) |
| `src/lib/a11y/__tests__/inline-editable-predicate-ratchet.test.ts` | **δεύτερη εμφάνιση του Οργάνου Β** (§5.3): ratchet του **ανώνυμου** πληθυσμού — 12 inline `tagName === 'INPUT'` αντίγραφα, ονομαστικά, **μόνο μικραίνει**. Το registry (Όργανο Α) πιάνει re-implementation **με όνομα** και σε αυτά είναι τυφλό |
| `src/components/ui/__tests__/dialog-focus-restore.test.tsx` | **η αληθινή δικλείδα του Ε2** — χωρίς trigger, με trigger (μη-παλινδρόμηση), opener που χάθηκε |
| `src/subapps/dxf-viewer/keyboard/__tests__/global-shortcut-listener.test.ts` | το gate, το `allowWhenEditable`, η αποδέσμευση |
| `systems/escape-bus/__tests__/escape-dev-audit.test.ts` | δηλωμένος Κ3 ⇒ `ok`· **αδήλωτος ⇒ ακόμη `shadow-owner`**· `starved` δεν καλύπτεται από δήλωση |
| `keyboard/__tests__/raw-keydown-listener-ratchet.test.ts` | **ο ratchet του §5.3** — νέος ωμός listener ονομαστικά· μπαγιάτικη εγγραφή· φύλακας κενής σάρωσης |
| `hooks/__tests__/useLayerCommandShortcuts.test.ts` | **η μετανάστευση του §5.5** — πολικότητα isolate/inverse (και προς τις δύο), οι άλλες 3 διαδρομές, φύλακας modal, unmount |

**Αρνητικός έλεγχος (εκτελεσμένος)**: με απενεργοποιημένους τους handlers του `dialog.tsx`, πέφτει
**μόνο** το controlled test· το DialogTrigger test παραμένει πράσινο (διαδρομή Radix). Αυτή η
υπογραφή αποδεικνύει ότι το test μετρά τη διόρθωση και όχι κάτι άλλο.

### 🔴 Ό,τι το jsdom ΔΕΝ μπορεί να πιάσει — απαιτεί ζωντανή μέτρηση

- **Διαδοχική πλοήγηση focus** με Tab (το jsdom δεν την εκτελεί) — Ε1.
- **Μετακίνηση `ox`/`oy`** του viewport (δεν αποδίδεται canvas) — Ε4.
- **Κληρονομημένο `contenteditable`** (`isContentEditable` δεν υλοποιείται στο jsdom).
- ⚠️ **Το `FocusScope` του Radix εκπέμπει `AUTOFOCUS_ON_UNMOUNT` σε `setTimeout(…, 0)`** ⇒ η
  επαναφορά focus **δεν είναι σύγχρονη**. Σύγχρονο assert βγάζει πάντα `body` και διαβάζεται
  λανθασμένα ως «δεν δουλεύει». Όλα τα tests χρησιμοποιούν `await waitFor`.

## 7. Ζωντανή επαναμέτρηση — 2026-07-26

Πλήρης πίνακας: **ADR-364 §10.15.Δ**. Περίληψη: Ε1 πράσινο σε **2D και 3D**, Ε2 πράσινο, Ε4
πράσινο, Ε3 πράσινο στο jest + **ζωντανό θετικό control**.

🟡 **Εκκρεμές**: ότι η λίστα @-mention δεν τυπώνει πλέον. Η διαδρομή απαιτεί επιλεγμένο έργο, και
το `ProjectHierarchyContext` **μηδενίστηκε δύο φορές** από HMR remount του παράλληλου agent
(μετρημένο: τα `window.__*` επιβίωσαν ⇒ remount, όχι document reload).

🔴 **Τρίτη απόπειρα, 2026-07-26 (β' συνεδρία)** — το εμπόδιο **δεν** ήταν η άδεια της επέκτασης· αυτή
δόθηκε και το `window.__escapeAudit` επιβεβαιώθηκε ζωντανό στο dev. Η μέτρηση σταμάτησε ξανά στην
**ίδια** υπογραφή remount (`window.__*` επιβίωσαν, τα query params του viewport χάθηκαν), συνοδευόμενη
από CDP timeouts σε `Runtime.evaluate` / `captureScreenshot` / `dispatchMouseEvent`. ⇒ **Η
προϋπόθεση του Ε3 δεν είναι εργαλείο — είναι ήσυχο δέντρο.** Μην ξαναδοκιμάσεις τη διαδρομή όσο
γράφει άλλος agent σε `src/`.

📌 **Βαθμονόμηση**: **K = 1,0** αυτή τη συνεδρία. 🔴 Ο τύπος `1568/innerWidth` παλαιότερου handoff
έδινε **0,653 — λάθος**. Βαθμονόμησε με `hover` + `clientX` σε **κάθε** συνεδρία.

### 7.1 Επαναμέτρηση σε **production build** — 2026-07-26

Οι μετρήσεις του §7 έγιναν σε **dev**. Το production είναι άλλο build (minified, `NODE_ENV=production`,
χωρίς το διπλό effect του StrictMode) — και η διόρθωση είναι ήδη εκεί. Επαναμετρήθηκε ζωντανά στο
`www.nestorconstruct.gr/dxf/viewer`, με φορτωμένο πραγματικό σχέδιο (`Ισόγειο 1.dxf`, 549 στοιχεία,
**auto-save ενεργό**), **μόνο με πληκτρολόγιο** — μηδέν κλικ, μηδέν εγγραφή δεδομένων.

| Έλεγχος | Μέτρηση | Αποτέλεσμα |
|---|---|---|
| **Ε4** | **Controlled A/B, ίδιο πλήκτρο, ίδια συνεδρία**: 4× `ArrowRight` **χωρίς** modal ⇒ `ox` 615 → 295 (**−320px = 4 × 80px**, ακριβώς το τεκμηριωμένο ελάττωμα)· 4× `ArrowRight` **με** modal ανοιχτό ⇒ `ox` 295 → **295 (0px)**, ενώ και τα 4 keydown **έφτασαν** στο window (καταγράφηκαν σε capture listener) | 🟢 |
| **Ε1** | 12× `Tab` μέσα σε `ui/dialog` ⇒ **12 μετακινήσεις focus, 0 διαφυγές**, καθαρός κύκλος 3 στοιχείων ×4 (`Κλείσιμο → INPUT → Ακύρωση`). Πριν: το `Tab` καταναλωνόταν ⇒ **0** μετακινήσεις | 🟢 |
| **Ε2** | Επαναφορά focus στο trigger: `restoredToTrigger === true` σε **δύο** layers — popover (κλείσιμο με `Escape`) **και** `ui/dialog` (κλείσιμο με κουμπί) | 🟢 |

🔴 **Επιβεβαιώθηκε το §1.Β του handoff**: `typeof window.__escapeAudit === 'undefined'` στο production
(guard `NODE_ENV !== 'production'`) ⇒ **το Ε3 είναι αμέτρητο εκεί by design** — μην το ψάξεις.

⚠️ **Παγίδα επιλογής στόχου (νέα, μετρημένη)**: `role="dialog"` **δεν** σημαίνει «σπρώχνει modal scope».
Το scope το σπρώχνουν **μόνο** `ui/dialog.tsx`, `ui/sheet.tsx`, `ui/alert-dialog/parts/Content.tsx`. Στον
viewer, «Ρυθμίσεις Polar» είναι **Popover** (`aria-modal: null`) και «Ρυθμίσεις Κέρσορα AutoCAD» είναι
**non-modal floating panel** (`aria-modal: "false"`) — και τα δύο έχουν `role="dialog"` και **κανένα** δεν
είναι έγκυρος στόχος για Ε1/Ε4. Έγκυρος στόχος που επιβεβαιώθηκε: **«Εισαγωγή Κάτοψης (Wizard)»**.

⚠️ Ο ίδιος wizard **δεν κλείνει με `Escape`** (παραμένει `data-state="open"`) — σκόπιμο για multi-step
ροή, **όχι** αποτυχία του Ε2. Και επιβεβαιώθηκε ξανά η παγίδα §6/`data-state="closed"`: αμέσως μετά το
κλείσιμο ο dialog **ζει ακόμη** στο DOM με `data-state="closed"` και το `activeElement` είναι ακόμη
**μέσα** του· η επαναφορά διαβάζεται μόνο σε **επόμενη** κλήση, μετά το unmount.

📌 Κατάσταση επαναφέρθηκε όπως βρέθηκε (`ox` 615, μηδέν ανοιχτά dialogs).

## 8. Google-level declaration

✅ **Google-level: ΝΑΙ** — μία ερώτηση με έναν ιδιοκτήτη, δομικά επιβαλλόμενη στο σημείο εγγραφής
αντί για φύλακα σε N σημεία· ιδempotent, re-entrant, SSR-safe· belt-and-suspenders· ρητά όρια
(bus, input-owned listeners) με τεκμηριωμένο λόγο· και η διόρθωση των 161 αρχείων ζει σε **ένα**
αρχείο.

✅ **Ο ratchet έκλεισε (2026-07-26, §5)** — ήταν το ένα μερικό σημείο. Ο 44ος listener **πιάνεται
πλέον ονομαστικά**, από δύο όργανα που φυλάνε διαφορετικά πράγματα: το CHECK 3.7 τη
**re-implementation** (μηδέν ευρήματα ⇒ χωρίς κοινό baseline ⇒ ασφαλές σε κοινό δέντρο) και ένα
structural jest anchor τον **πληθυσμό** (27, μόνο μικραίνει). Mutation-verified ×2 — και τα δύο
όργανα πυροδότησαν όταν ο ωμός listener επανήλθε.

📌 **Το δίδαγμα του §5 δεν ήταν «περίμενε ήσυχο δέντρο»** — ήταν ότι ένα καθολικό pattern σε 38
σημεία δίνει **μηδέν σήμα** και είναι ταυτόχρονα μίνα σε κοινό δέντρο. Ένα module που δεν χτυπά
κανένα υπάρχον αρχείο είναι ακίνδυνο ακόμη κι αν το commit-άρει άλλος κατά λάθος. Και, από το
περιστατικό stage race: **σε κοινό working tree, ένα κοινό αρχείο δεν είναι δικό σου να το γράψεις
«για λίγο».**

✅ **Ε1/Ε2/Ε4 επαληθεύτηκαν και στο production build (§7.1)** — με controlled A/B για το Ε4 (ίδιο
πλήκτρο: −320px χωρίς modal, 0px με modal). Δεν μένει ζωντανή μέτρηση για αυτά τα τρία.

🟡 **Παραμένει εκκρεμές, δικού του περάσματος**: το ένα ζωντανό μισό του Ε3 (§7 — **απαιτεί dev
server**, §7.1) και η ενοποίηση του `radial-command-ring-helpers.isEditableTarget` (§5.6, αγγίζει τον
escape bus).

## 9. Changelog

### 2026-07-26 — `escape-dev-audit.__getLastAuditFinding` διαγράφηκε (CHECK 3.30)

**Αφορμή**: το gate barrel dead-export (CHECK 3.30, ADR-700) ήταν κόκκινο και το ανέφερε ονομαστικά.

**Κρίση: πλεονασμός, ΟΧΙ κενό wiring** — και γι' αυτό διαγραφή αντί rebaseline. Το `lastFinding` έχει
**κανονικό** καταναλωτή στο `exposeAuditToDevConsole().last()` (`escape-dev-audit.ts:142`), δηλαδή τον
δρόμο που προορίζεται για dev console· τα tests **δεν** περνούν από εκεί — κρίνουν σύγχρονα μέσω
`__judgeForTests`. Άρα ο named export δεν είχε καταναλωτή **ούτε** στο runtime **ούτε** στα tests: ήταν
τρίτη πόρτα στο ίδιο δωμάτιο. **Το gate είχε δίκιο.**

**Τι έγινε**: ο export αφαιρέθηκε· στη θέση του μπήκε σχόλιο (`escape-dev-audit.ts:236-238`) που
καταγράφει **γιατί** το τελευταίο εύρημα δεν εκτίθεται ονομαστικά, ώστε να μην ξαναπροστεθεί «για
ευκολία». Το `lastFinding` (module-scoped) και ο καθαρισμός του στο `__resetAuditForTests` έμειναν
αυτούσια.

**Επαλήθευση**: escape-bus tests **39/39 GREEN**· `barrel-deadcode:check` πράσινο. **ΟΧΙ tsc (N.17).**

⚠️ **Γιατί αυτή η εγγραφή άργησε**: τη στιγμή της αλλαγής το ίδιο το ADR-711 το έγραφε **άλλος
πράκτορας** (υπήρχε `.tmp.7780.*` δίπλα του). Κατά το δίδαγμα του §5.4/§8 — *σε κοινό working tree ένα
κοινό αρχείο δεν είναι δικό σου να το γράψεις «για λίγο»* — η Phase 3 (N.0.1) αναβλήθηκε αντί να
ρισκάρει stage race, καταγράφηκε ως χρέος στο handoff, και κλείνει εδώ.
