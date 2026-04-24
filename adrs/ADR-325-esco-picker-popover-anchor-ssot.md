# ADR-325: ESCO Picker Popover Anchor SSoT (CHECK 5B — ESCO Pickers)

**Status:** ✅ IMPLEMENTED — 2026-04-25
**Date:** 2026-04-25
**Category:** UI Components / SSoT Enforcement / Popover Semantics
**Author:** Γιώργος Παγώνης + Claude Code
**Related ADRs:** ADR-001 (Radix canonical), ADR-034 (ESCO Occupation), ADR-132 (ESCO Skills), ADR-294 (SSoT Ratchet), ADR-324 (Clearable Select SSoT)

---

## 1. Context

Κατά το QA session της 2026-04-25 ο Γιώργος ανέφερε ότι στο tab **"Επαγγελματικά Στοιχεία"** το ESCO picker για επάγγελμα και δεξιότητες συμπεριφερόταν λάθος:

> Κάνοντας κλικ στο πεδίο, για κλάσμα του δευτερολέπτου εμφανίζεται ένα **πολύ μικρό dropdown** (σχεδόν μηδενικού ύψους) και μετά κλείνει. Πρέπει να πληκτρολογήσει κανείς για να δουλέψει κανονικά.

Το ίδιο symptom είχε ήδη φτιαχτεί **λίγες ώρες νωρίτερα** στο `SearchableCombobox` (δες commento σε `src/components/ui/searchable-combobox.tsx:275-278`): first click flashes & closes, second click opens.

### 1.1 Root cause

Και τα δύο ESCO pickers (`EscoOccupationPicker`, `EscoSkillPicker`) χρησιμοποιούσαν το pattern:

```tsx
<Popover open={isOpen} onOpenChange={setIsOpen}>
  <PopoverTrigger asChild>
    <div className="relative w-full">
      <Input onChange={handleInputChange} onFocus={...} />
    </div>
  </PopoverTrigger>
  <PopoverContent>...</PopoverContent>
</Popover>
```

Το `PopoverTrigger` του Radix **εγκαθιστά έναν built-in click handler** στο child που κάνει `onOpenChange(!open)`. Αυτό συγκρούεται με το application-level gate που έχουν τα pickers:

```tsx
if (inputValue.trim().length >= MIN_CHARS) {
  setIsOpen(true);
  debouncedSearch(inputValue);
}
```

Σε κενό input:
1. User κλικ → `PopoverTrigger` καλεί `onOpenChange(true)` → popover ανοίγει
2. Τα `results` είναι `[]`, το `inputValue` είναι `''` → το `<ul>` δεν έχει παιδιά
3. Το `PopoverContent` φαίνεται με zero rendered rows → **"μικρό / flash dropdown"**
4. Focus / blur cycle κλείνει τοπικά → φαίνεται σαν glitch

### 1.2 Γιατί SSoT και όχι patch ανά αρχείο

Και τα δύο ESCO pickers **επαναλαμβάνουν ακριβώς την ίδια δομή**: `Popover > PopoverTrigger asChild > (div > Input) + PopoverContent (max-h-80)`. Αν κάναμε patch τοπικά σε κάθε αρχείο:

- Δύο εκδόσεις του σωστού pattern θα γινόταν trivially drift-prone (βλ. ADR-294 Phase C policy)
- Κάθε μελλοντικό ESCO picker (π.χ. `EscoActivityPicker`, `EscoQualificationPicker`) θα μπορούσε να ξανακάνει το ίδιο λάθος
- Ο pre-commit ratchet δεν θα είχε ένα single file να προστατέψει

Google policy: **"The fix is the primitive"**. Ένα shared wrapper με σαφή contract + test + pre-commit CHECK + SSoT registry entry.

## 2. Decision

Νέο SSoT component — **`src/components/shared/esco/esco-picker-popover-shell.tsx`** — εκθέτει `EscoPickerPopoverShell`, που enkapsulώνει το Popover + PopoverAnchor pattern:

```tsx
<EscoPickerPopoverShell
  open={isOpen && !disabled}
  onOpenChange={setIsOpen}
  anchor={<div>…Input + icons…</div>}
>
  <ul role="listbox">…results…</ul>
</EscoPickerPopoverShell>
```

Internals:

```tsx
export function EscoPickerPopoverShell({ open, onOpenChange, anchor, children }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 max-h-80 overflow-y-auto"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
```

### 2.1 Γιατί `PopoverAnchor` αντί για `PopoverTrigger`

Το `PopoverAnchor` του Radix είναι positioning-only: τοποθετεί το popover σε σχέση με το DOM node, **χωρίς να εγκαθιστά click handler**. Αυτό σημαίνει ότι η ιδιοκτησία του `open` state ανήκει 100% στο parent component — το οποίο ήδη έχει σωστό gate (`MIN_CHARS`).

Ο ίδιος ακριβώς τρόπος εφαρμόστηκε σήμερα (2026-04-25) και στο `SearchableCombobox` για το ίδιο bug στο dropdown ΔΟΥ. Το `popover.tsx` ήδη εξάγει το `PopoverAnchor` με JSDoc που εξηγεί τη σημασιολογία.

### 2.2 Search-first UX (δεν ανοίγει σε κενό click)

Η συμπεριφορά που βλέπει τώρα ο χρήστης:

- **Click σε κενό πεδίο** → τίποτα. Καρσόρας μπαίνει, αναμένει input.
- **Πληκτρολόγηση 1 χαρακτήρα** → τίποτα (κάτω από το `MIN_CHARS = 2`).
- **Πληκτρολόγηση 2+ χαρακτήρων** → debounced search (300ms), popover ανοίγει με τα αποτελέσματα.
- **Focus σε πεδίο με ήδη 2+ χαρακτήρες που δεν είχε ESCO selection** → popover ανοίγει άμεσα με τα αποτελέσματα.
- **Escape / outside click** → popover κλείνει.

Αυτή είναι η "search-first" προσέγγιση που προτάθηκε (option B) και υλοποιείται σωστά πλέον χωρίς race.

## 3. Consequences

### ✅ Benefits

- **Zero flash bug**: το click σε κενό input δεν ανοίγει popover.
- **SSoT**: μία υλοποίηση, δύο consumers (μελλοντικοί ESCO pickers πέφτουν αυτόματα μέσα).
- **Regression test**: 6 tests στο `esco-picker-popover-shell.test.tsx` κλειδώνουν το contract (ιδίως το "click anchor does NOT open").
- **Pre-commit CHECK 5B "ESCO Pickers"**: εκτελεί τα tests όταν αγγίζουμε `src/components/shared/esco/` ή τα Esco*Picker files.
- **SSoT Ratchet**: module `esco-picker-popover` στο `.ssot-registry.json` (Tier 3) — απαγορεύει διπλοεγκατάσταση της function `EscoPickerPopoverShell` έξω από το SSoT file.

### ⚠️ Trade-offs

- Το `anchor` είναι prop τύπου `ReactNode`. Καλείς έπρεπε να παραμείνουν υπεύθυνοι για το positioning/styling του input/icons. Αυτό είναι σκόπιμο: ο shell είναι λεπτός, όχι πλήρες πεδίο. Αν αργότερα χρειαστεί ενοποίηση του input + search icon + loading spinner + clear button, θα προστεθεί ένα δεύτερο primitive (`EscoPickerInput`) σε follow-up ADR.

### 🔄 Migration

- `EscoOccupationPicker.tsx`: εισαγωγή του shell, αφαίρεση `PopoverTrigger` / `PopoverContent` / `Popover` imports.
- `EscoSkillPicker.tsx`: ίδια αλλαγή.
- Καμία άλλη αλλαγή στη λογική search / keyboard nav / free-text fallback — το shell είναι wrapper μόνο.

## 4. Contract Tests

`src/components/shared/esco/__tests__/esco-picker-popover-shell.test.tsx` — 6 tests / 1 group:

1. Renders the anchor element
2. Does NOT render popover content when open=false
3. Renders popover content when open=true
4. **Does NOT call onOpenChange when clicking anchor while closed** ← bug guard
5. **Does NOT call onOpenChange(true) when clicking anchor while open** ← bug guard
6. Fires onOpenChange(false) when Escape is pressed while open

Run: `npm run test:esco-pickers` → 6/6 verde (~13s).

## 5. Google-level checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | **Proactive** — shell guarantees correct Popover semantics upfront. |
| 2 | Race condition possible? | **No** — `PopoverAnchor` δεν εγκαθιστά click handler, ο parent έχει exclusive ownership του `open`. |
| 3 | Idempotent? | **Yes** — το shell είναι stateless wrapper. |
| 4 | Belt-and-suspenders? | **Yes** — shell + contract tests + pre-commit CHECK 5B + SSoT registry module. |
| 5 | Single Source of Truth? | **Yes** — ένα file, δύο consumers, registry-enforced. |
| 6 | Fire-and-forget or await? | N/A — καθαρά rendering, no async. |
| 7 | Who owns the lifecycle? | **Explicit** — ο parent picker έχει 100% ownership του `open` state. |

✅ **Google-level: YES** — SSoT + test + pre-commit + registry + ADR σε ένα atomic bundle.

## 6. Changelog

- **2026-04-25 — v1.0** — Initial version. Δημιουργία `EscoPickerPopoverShell`, migration `EscoOccupationPicker` + `EscoSkillPicker`, tests (6/6 verde), pre-commit CHECK 5B "ESCO Pickers", SSoT registry module `esco-picker-popover`.
- **2026-04-25 — v1.1** — Ο shell πλέον ιδιοκτητεί και το `<div className="relative w-full">` wrapper και εφαρμόζει `focus-within:ring-2 ring-ring ring-offset-2` ως belt-and-suspenders πάνω από το native `focus-visible` του `<Input>`. Αιτία: στο QA της 2026-04-25 ο χρήστης παρατήρησε ότι το πεδίο **Δεξιότητες ESCO** δεν "άναβε" περιμετρικά στο click, ενώ τα Επάγγελμα / Ειδικότητα άναβαν. Η διαφορά δεν ήταν εμφανής σε code-level (ίδιο `<Input>` + ίδια shell) αλλά runtime: σε συγκεκριμένες συνθήκες ο `focus-visible` του Input δεν εκκινούσε. Μετακινώντας τον visual cue στον shell wrapper (`focus-within` — ανεξάρτητο από modality), όλα τα ESCO picker τώρα εμφανίζουν ενιαίο, προβλέψιμο ring. Οι consumers (`EscoOccupationPicker`, `EscoSkillPicker`) απλοποιήθηκαν: παραδίδουν πλέον fragment (`<>…</>`) στο `anchor` prop, χωρίς δικό τους positioning wrapper. Tests: 7/7 verde (προστέθηκε regression test για τη παρουσία του ring στον wrapper DOM node).
- **2026-04-25 — v1.2** — Το CSS-only `:focus-within` path της v1.1 συνέχισε να μην εμφανίζει ring στο **Δεξιότητες ESCO** κατά το live QA. Δεν ήταν δυνατό να αναπαραχθεί ντετερμινιστικά: ίδιο DOM tree, ίδιες Tailwind classes, διαφορετικό runtime αποτέλεσμα (πιθανή αλληλεπίδραση Radix Slot + JIT ή `focus-within` specificity). Αντικαθιστούμε το CSS path με **imperative React state** μέσα στο shell: `const [focused, setFocused] = useState(false)` + `onFocusCapture` / `onBlurCapture`. Οι focus classes (`ring-2 ring-ring ring-offset-2 ring-offset-background`) εφαρμόζονται όταν το state είναι `true`, με `transition-shadow` για ομαλή εμφάνιση. Το imperative path είναι specified σε React level και δεν μπορεί να κλείσει short-circuit από CSS specificity ή JIT purge ή browser heuristics. Tests: 8/8 verde (νέο regression test κάνει `user.click(input)` και βεβαιώνει ότι ο wrapper αποκτά `ring-2`).
