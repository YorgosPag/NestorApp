# ADR-601: Async Autocomplete Picker SSoT (`useAsyncPickerSearch` + picker primitives)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the hand-rolled async autocomplete pickers under `src/components/shared/`. `EmployerPicker`, `EscoOccupationPicker` and `EscoSkillPicker` each re-implemented the same search/debounce/loading/highlight/keyboard-navigation machinery, the same `<ul role="listbox">` (result rows + no-results + separator + free-text row + scroll-into-view), the same search-input anchor, and (the two single-selects) the same value↔input sync + free-text-on-change + clear-button shell. Collapsed onto a headless hook + presentational primitives: **`useAsyncPickerSearch`** (base mechanics), **`useLinkedSinglePicker`** + **`LinkedSinglePickerView`** (linked single-select composition), **`PickerResultsList`**, **`PickerSearchInput`**, and the promoted **`PickerPopoverShell`** (from ADR-325). jscpd (min-tokens 50) on the three pickers: **14 exact clones / 206 dup-lines → 0**. `jscpd:diff` on the staged fileset: **✅ 0 clones**. Public API (exports, prop names, component signatures) is unchanged — internal refactor only.

**Related:**
- **ADR-585 … ADR-596** — same 2026-07-08 de-duplication sweep, same **shared shell/hook/primitive + per-instance binding** archetype across successive buckets («Κουβάδες Α–Θ»). This ADR is «Κουβάς Ι».
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates re-introduction.
- **ADR-325** (ESCO Picker Popover Shell) — its `EscoPickerPopoverShell` was promoted here to the domain-neutral `PickerPopoverShell`; the old path now re-exports it.
- **ADR-177** (Employer entity link), **ADR-034** (ESCO occupations), **ADR-132** (ESCO skills) — the three hosts.
- **ADR-001** (Radix Select/Popover canonical) — the shell wraps Radix `PopoverAnchor`/`PopoverContent`.

---

## Context

`src/components/shared/` holds three autocomplete pickers that each turn a debounced text query into a picked entity + free-text fallback:

| Component | Lines (before) | Shape | Data source |
|---|---|---|---|
| `EmployerPicker` | 475 | single-select + LINKED badge | `ContactsService` (client cache) |
| `EscoOccupationPicker` | 417 | single-select + ESCO badge | `EscoService.searchOccupations` |
| `EscoSkillPicker` | 423 | **multi-select** + chips + max limit | `EscoService.searchSkills` |

A **real SSoT audit (grep + jscpd, min-tokens 50)** found only a *partial* prior centralization — `EscoPickerPopoverShell` (ADR-325), used by the two ESCO pickers but **not** by `EmployerPicker`, which still used the raw `<PopoverTrigger>` the shell was created to replace (the zero-height empty-dropdown flash). The adjacent `KadCodePicker` is **not** a twin: it delegates to the generic static-option `SearchableCombobox` and was left untouched.

jscpd measured the three at **14 clones / 206 dup-lines** (pair `Employer↔EscoOccupation` alone: 133). The shared surface: the `performSearch` skeleton, the inline debounce + cleanup, the 34-line `handleKeyDown`, the scroll-into-view effect, the whole results listbox, and the search-input anchor. The genuinely-divergent surface is small: the **data source**, the **emit payload** (single value+id vs multi-select array append), and per-row/badge/icon presentation.

Big-player practice for autocomplete (Radix Combobox, downshift, MUI Autocomplete) is a **headless state hook exposing prop-getters/bindings + thin presentational parts fed by render props**, not N parallel picker components. The fix generalises that, in two tiers so the multi-select variant is not forced through a single-select God-hook.

> **i18n note (N.11):** no user-facing literals were introduced. The six-namespace `useTranslation([...])` was consolidated into `useContactPickerTranslation`; the `LINKED`/`ESCO` hardcoded `defaultValue`s were **removed** (Boy-Scout) since `employer.linkedBadge` and `esco.badge` already exist in `el`+`en`. Zero new baseline entries.

---

## Decision

### Tier 1 — base headless hook `use-async-picker-search.ts`
`useAsyncPickerSearch<TResult>({ search, onSelectResult, onFreeText, onBackspaceEmpty? })` owns everything all three shared: `isOpen`/`inputValue`/`results`/`isLoading`/`highlightedIndex`, `inputRef`/`listRef`, debounced `triggerSearch`, `syncQuery`, `handleFocus`, `clearInput`, and the `handleKeyDown` navigation. Commit callbacks receive a `PickerCommitCtx` (the hook's own setters + live inputValue + inputRef) so each host writes its emit logic inline without a use-before-defined cycle; `commitResult`/`commitFreeText` are the single source shared by keyboard Enter **and** the listbox click path. State-model-agnostic — no `if (multiSelect)`.

### Presentational primitives
| Module | Owns |
|---|---|
| `PickerPopoverShell` | Radix `PopoverAnchor`+`PopoverContent` wrapper (promoted from ADR-325; fixes the trigger-flash bug for all three). |
| `PickerSearchInput` | Left icon + combobox `<Input>` (identical aria contract) + spinner; per-variant badge/clear injected via `children`. Binds to the hook via a structural `PickerInputBindings`. |
| `PickerResultsList` | The `<ul role="listbox">` (rows + no-results + separator + free-text row + scroll-into-view); per-row content injected via `renderItemContent`. Binds via `PickerListBindings`. |

### Tier 2 — linked single-select composition
`useLinkedSinglePicker` (value↔input sync, "linked" flag, free-text-on-change, clear) + `LinkedSinglePickerView` (the full shell+input+badge+clear+list render) capture the shape shared by `EmployerPicker` and `EscoOccupationPicker`. Each host now supplies only its data source + payload builders (`buildSelected`/`buildFreeText`) + icon/badge/row renderer. `EscoSkillPicker` (multi-select) uses the **base** hook directly with `onBackspaceEmpty` (chip removal) — not the single-select composition.

### Shared helpers
`esco-label.ts` — `pickBilingualLabel` + `resolveEscoLang` (the EL/EN + secondary-language derivation shared by the two ESCO pickers). `contact-picker-i18n.ts` — `useContactPickerTranslation` (the six-namespace call shared by all three). A `pickers/index.ts` barrel gives one import surface (also keeps the import-block clone down).

---

## Verification
- **jscpd** (`Employer` + `EscoOccupation` + `EscoSkill`, min-tokens 50): **14 clones / 206 dup-lines → 0**. `jscpd:diff` on the 13 staged files: **0 clones** (reached iteratively — the picker-object bindings, the tier-2 composition hook, and finally `LinkedSinglePickerView` each removed a residual layer of same-shell twins).
- **Tests** (jest + RTL): `pickers/__tests__/async-pickers.test.tsx` (8) — free-text emit + search→select for all three, clear button (single-select), multi-select append + Backspace-removal + chips. Existing `esco/__tests__/esco-picker-popover-shell.test.tsx` (8) still green via the backward-compat re-export.
- **Line counts:** Employer 475→176, EscoOccupation 417→99, EscoSkill 423→188 (all well under the 500 ceiling — extract, not trim).
- **No behaviour change** except two intentional improvements: `EmployerPicker` now routes through `PickerPopoverShell` (fixes the empty-dropdown flash), and the unified ref-based navigation. Public exports/props/signatures unchanged.

---

## Changelog
- **2026-07-08** — Initial version. Created `use-async-picker-search`, `use-linked-single-picker`, `LinkedSinglePickerView`, `PickerResultsList`, `PickerSearchInput`, `contact-picker-i18n`, `esco-label`, the `pickers/` barrel; promoted `EscoPickerPopoverShell` → `PickerPopoverShell` (old path re-exports); migrated the three pickers; added 1 test suite (8 tests). «Κουβάς Ι» of the 2026-07-08 de-duplication sweep.
