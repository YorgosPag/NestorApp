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
isEditableTarget(target): boolean          // η ΜΙΑ υλοποίηση των 10+ αντιγράφων
pushModalKeyboardScope(): () => void       // σωρός· ιδempotent release
isModalKeyboardScopeActive(): boolean
inspectModalKeyboardScope(): { depth }     // dev/test — το ανάλογο του escapeBus.inspect()
shouldGlobalShortcutYield(event): boolean  // η ΜΙΑ ερώτηση των global accelerators
```

- **Σωρός, όχι σημαία**: dialog → ConfirmDialog από πάνω· το κλείσιμο του δεύτερου δεν πρέπει να
  ξεκλειδώνει τους accelerators όσο ζει το πρώτο.
- **Ιδempotent release**: το διπλό effect του React StrictMode δεν αφήνει αρνητικό βάθος.
- `isEditableTarget` είναι **γνήσιο υπερσύνολο** των παλιών: πιάνει `isContentEditable`
  (κληρονομημένο) και `contenteditable=""`, που **και τα δέκα** αντίγραφα έχαναν.
- `shouldGlobalShortcutYield` = **belt-and-suspenders** (N.7.2 #4): scope (πρωτεύον, O(1))
  **ή** editable στόχος/`activeElement` (δίχτυ για layers εκτός των κοινών primitives).

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

## 5. Ratchet — ΕΚΚΡΕΜΕΙ (δεν εφαρμόστηκε, με λόγο)

**Κατάσταση: ΑΝΕΝΕΡΓΟ — αφαιρέθηκε από το working tree, με λόγο.**

🔴 **ΠΕΡΙΣΤΑΤΙΚΟ (stage race, 2026-07-26)**: το module γράφτηκε στο `.ssot-registry.json`, και ενώ
γινόταν ο έλεγχος επιπτώσεων ο **παράλληλος agent (ADR-710) έκανε `git add` του ίδιου αρχείου** και
το commit-άρισε (`48f0b4e9` / `347d7bd3`) **μαζί με τη δική του δουλειά**. Δηλαδή το module μπήκε στο
HEAD **χωρίς baseline**. Το working tree το **αφαιρεί**· η δουλειά του άλλου agent
(`chart-card-shell`, `contact-address-blankness`, `contact-session-storage`) είναι **ανέπαφη**
(επαληθευμένο: HEAD 384 → WT 385 = −1 δικό μου, +2 δικά του).

**Γιατί δεν μένει ενεργό**: το `forbiddenPatterns` ταιριάζει σε **38 αρχεία** και **κανένα** δεν
υπάρχει στο `.ssot-violations-baseline.json` ⇒ το CHECK 3.7 θα ΜΠΛΟΚΑΡΕ κάθε επόμενο commit που
αγγίζει έστω ένα από αυτά. Το `npm run ssot:baseline` που θα το θεράπευε (α) έτρεχε **>22 λεπτά
χωρίς έξοδο** σε Windows και (β) ξαναγράφει **κοινό** baseline αρχείο, αποτυπώνοντας μέσα του τα
uncommitted ευρήματα του παράλληλου agent — ακριβώς αυτό που το ίδιο το repo προειδοποιεί να μη
γίνεται («baseline μόνο μετά από νόμιμο cleanup»). **Ενεργοποίησέ το όταν το δέντρο είναι ήσυχο**:
πρόσθεσε το μπλοκ, τρέξε `npm run ssot:baseline`, commit τα δύο μαζί.

Έτοιμο μπλοκ:

```json
"modal-keyboard-scope": {
  "ssotFile": "src/subapps/dxf-viewer/keyboard/global-shortcut-listener.ts",
  "description": "ADR-711 — global accelerators του viewer εγγράφονται μέσω addGlobalShortcutListener, ποτέ με ωμό window.addEventListener('keydown'). Ο wrapper ρωτά shouldGlobalShortcutYield (modal scope + editable target). Ωμός listener = το πλήκτρο κλέβεται από ανοιχτό modal — η ρίζα των Ε1/Ε4 του ADR-364 §10.15.",
  "forbiddenPatterns": [
    "window\\.addEventListener\\('keydown'"
  ],
  "allowlist": [
    "src/subapps/dxf-viewer/keyboard/global-shortcut-listener.ts",
    "src/subapps/dxf-viewer/systems/escape-bus/EscapeCommandBus.ts",
    "src/subapps/dxf-viewer/systems/escape-bus/escape-dev-audit.ts",
    "src/subapps/dxf-viewer/keyboard/createModifierKeyTracker.ts",
    "src/subapps/dxf-viewer/systems/dynamic-input/",
    "src/subapps/dxf-viewer/ui/command-line/"
  ],
  "addedDate": "2026-07-26",
  "addedByAdr": "ADR-711",
  "tier": 2
}
```

Μετά την προσθήκη: `npm run ssot:baseline` (οι ~23 μη μεταναστευμένοι μπαίνουν σε baseline και
**μόνο μειώνονται**).

## 6. Tests — και τι ΔΕΝ πιάνουν

| Αρχείο | Τι κλειδώνει |
|---|---|
| `src/lib/a11y/__tests__/keyboard-scope.test.ts` | nesting σωρού, ιδempotent release, predicate, υπερσύνολο έναντι των παλιών αντιγράφων |
| `src/components/ui/__tests__/dialog-focus-restore.test.tsx` | **η αληθινή δικλείδα του Ε2** — χωρίς trigger, με trigger (μη-παλινδρόμηση), opener που χάθηκε |
| `src/subapps/dxf-viewer/keyboard/__tests__/global-shortcut-listener.test.ts` | το gate, το `allowWhenEditable`, η αποδέσμευση |
| `systems/escape-bus/__tests__/escape-dev-audit.test.ts` | δηλωμένος Κ3 ⇒ `ok`· **αδήλωτος ⇒ ακόμη `shadow-owner`**· `starved` δεν καλύπτεται από δήλωση |

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

📌 **Βαθμονόμηση**: **K = 1,0** αυτή τη συνεδρία. 🔴 Ο τύπος `1568/innerWidth` παλαιότερου handoff
έδινε **0,653 — λάθος**. Βαθμονόμησε με `hover` + `clientX` σε **κάθε** συνεδρία.

## 8. Google-level declaration

✅ **Google-level: ΝΑΙ** — μία ερώτηση με έναν ιδιοκτήτη, δομικά επιβαλλόμενη στο σημείο εγγραφής
αντί για φύλακα σε N σημεία· ιδempotent, re-entrant, SSR-safe· belt-and-suspenders· ρητά όρια
(bus, input-owned listeners) με τεκμηριωμένο λόγο· και η διόρθωση των 161 αρχείων ζει σε **ένα**
αρχείο.

⚠️ **Μερικό σε ένα σημείο**: ο ratchet (§5) είναι **ανενεργός**. Χωρίς αυτόν, ο 44ος listener μπορεί
να γραφτεί ωμός και να ξανασπάσει το `Tab` μέσα στα modals. Το μπλοκ είναι έτοιμο· χρειάζεται ήσυχο
δέντρο για το baseline. Το περιστατικό stage race του §5 είναι από μόνο του μάθημα: **σε κοινό
working tree, ένα αρχείο που ο άλλος agent σκοπεύει να commit-άρει δεν είναι δικό σου να το γράψεις
— ούτε «για λίγο».**
