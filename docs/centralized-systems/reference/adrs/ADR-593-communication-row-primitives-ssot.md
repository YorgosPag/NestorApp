# ADR-593: Communication Row Primitives SSoT (`communication-row-primitives`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the four copy-pasted desktop-row renderers under `src/components/contacts/dynamic/communication/renderers/` (Email / Phone / Website / Social). All four shared a byte-identical desktop `grid` frame — Type-select cell, Label-input cell, Actions cell (Primary badge gated on `config.supportsPrimary` + Delete) — and a byte-identical props contract; only the middle channel cells and the column count genuinely differed. Collapsed onto a shared **row shell + typed primitive cells + shared prop contracts** (`renderers/shared/communication-row-primitives.tsx`). jscpd (min-tokens 50) on the renderers folder: **0 clones** (was 51 exact clones / 780 dup-lines across the `contacts/` tree → **33 / 394** after; the whole Email↔Phone↔Social↔Website cluster is gone). `jscpd:diff` on the staged fileset: **✅ no new clones**. Per-channel field wiring and example placeholders stay per-file — only frame/cell primitives are shared (no God-shell).

**Related:**
- **ADR-585** (Domain Card View-Model Hook), **ADR-586** (Meta Webhook Shared Core), **ADR-588** (Space Media Tab Shell), **ADR-590** (Email Template Shared Primitives), **ADR-591** (Impact-Preview Primitives), **ADR-592** (BIM Entity Factory Base) — same 2026-07-08 de-duplication sweep, same **shared shell/primitive + per-instance binding** archetype across successive buckets («Κουβάδες Α–ΣΤ»). This ADR is «Κουβάς Ζ».
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates re-introduction.

---

## Context

`src/components/contacts/dynamic/communication/renderers/` holds the four specialised **desktop-table-row** renderers used by `DesktopTableLayout` (and re-exported through `UniversalCommunicationManager`). Each renderer is a `React.FC` that, on desktop, returns a single `grid grid-cols-N` row and, on mobile, returns `null` (the vertical layout is handled elsewhere by `renderItemFields`).

A **real SSoT audit (grep + jscpd, min-tokens 50)** found **no** existing shared row/cell primitive — and four near-identical files:

- **Identical imports** (icon-sizes, border-tokens, badge, button, input, radix select, i18n, design-system) — 4 copies.
- **Identical props interface** (`item / index / isDesktop / config / disabled? / updateItem / removeItem` + Email/Phone's `setPrimary`) — 4 copies, splitting cleanly into "with Primary" (Email, Phone) and "without Primary" (Website, Social).
- **Identical Type-select cell** — the `<Select value={item.type} …>{config.types.map…}</Select>` block, 4 copies.
- **Identical Label-input cell** — `<Input value={item.label} placeholder={t(config.labelPlaceholder)} …>`, 4 copies.
- **Identical Actions cell** — the Primary `CommonBadge` (already gated on `config.supportsPrimary`) + Delete `Button`, 4 copies.
- **Identical row frame** — `grid grid-cols-N gap-2 items-center py-2 {separatorH} last:border-b-0` + the `if (!isDesktop) return null` tail.

jscpd measured the cluster at Email↔Phone **137**, Email↔Social **103**, Social↔Website **88**, Email↔Website **32** dup-lines (plus spill into `MobileCommunicationLayout`). The genuinely-divergent part is small: the **middle cells** (Email: email; Website: url; Phone: countryCode+number+extension; Social: platform+username+url) and the **column count** (`grid-cols-4` for Email/Website, `grid-cols-6` for Phone/Social, where `columns = middleCount + 3`).

Big-player practice for tabular property editors (Figma property rows, Revit family-parameter rows, Cinema 4D attribute rows) is exactly a **generic row/cell frame + per-field slot binding**, not a per-type row component. The fix generalises that.

> **i18n note (N.11):** the only literals in these files are format-example placeholders (`john@example.com`, `+30`, `2310 123456`, `https://example.com`, `john-doe`, `https://...`). They were already hardcoded in the originals and **remain in their per-channel renderer files** (passed as a `placeholder` prop) — same file, zero new baseline entries. The translated `t(config.labelPlaceholder)` and the phone-extension `t('communication.placeholders.phoneExtension')` stay i18n.

---

## Decision

### New module `renderers/shared/communication-row-primitives.tsx`

Frame/cell primitives + shared prop contracts, deliberately free of any per-channel field logic:

| Export | Owns |
|---|---|
| `CommunicationSelectCell` | The dropdown cell (`value / options: TypeOption[] / disabled? / onValueChange`). Used for Type **and** Social platform. |
| `CommunicationInputCell` | The text-input cell (`value / placeholder / disabled? / onValueChange / inputType? / className?`). Covers every middle input **and** the Label. |
| `CommunicationActionsCell` | The `justify-end` actions cell — Primary `CommonBadge` (rendered only when `config.supportsPrimary && setPrimary`) + Delete `Button`. |
| `CommunicationRowShell` | The desktop `grid` frame. Renders `[Type] → {children} → [Label] → [Actions]`, maps `columns: 4 \| 6` to a **static** Tailwind class (`GRID_COLS`, no dynamic string — JIT requirement), and returns `null` on mobile. |
| `CommunicationRendererProps` | Shared channel-renderer contract **without** Primary (Website, Social). |
| `PrimaryCommunicationRendererProps` | `extends CommunicationRendererProps` + `setPrimary` (Email, Phone). |

`CommunicationRowShellProps extends CommunicationRendererProps` (+ `columns`, optional `setPrimary`, `children`) — a single source for the whole prop shape, so the shared contracts are reused, not re-declared. i18n namespaces live in one `COMMUNICATION_I18N_NS` const.

### Each channel renderer → shell composition

Each file drops its local interface (uses the shared contract) and spreads its props into the shell, supplying only its middle cells:

```tsx
export const EmailRenderer: React.FC<PrimaryCommunicationRendererProps> = (props) => (
  <CommunicationRowShell {...props} columns={4}>
    <CommunicationInputCell inputType="email" value={props.item.email || ''}
      placeholder="john@example.com" disabled={props.disabled}
      onValueChange={(v) => props.updateItem(props.index, 'email', v)} />
  </CommunicationRowShell>
);
```

- **Email / Phone** → `PrimaryCommunicationRendererProps`, `columns={4/6}`, Primary shown.
- **Website / Social** → `CommunicationRendererProps` (no `setPrimary`), `columns={4/6}`, Primary absent (`config.supportsPrimary === false`).
- Each renderer collapses from ~125–165 lines to ~25–40; the `...RowRenderer` aliases in `renderers/index.ts` are preserved. The primitives are also barrel-exported for reuse.

### Public contract preserved
The four exported components keep their names, their (now shared-typed) prop shapes and their render output — `DesktopTableLayout`, `UniversalCommunicationManager` and the barrel are untouched. Desktop DOM is structurally identical (same grid columns, same cells, same order); mobile still returns `null`.

---

## Verification

- **jscpd** (min-tokens 50) on `renderers/`: **0 exact clones** (`jscpd:diff` on the staged fileset ✅ no new clones). Whole-`contacts/` scan: **51 → 33** clones, **780 → 394** dup-lines (−18 clones / −386 lines; the entire communication-renderer cluster eliminated). Global `.jscpd-baseline.json` re-locked by Giorgio at commit.
- **jest render-verify** — `renderers/__tests__/communication-renderers.test.tsx` (7 tests, all green): column count (4 vs 6), value flow, `onValueChange → updateItem(index, field, value)` wiring, Primary gating (present for Email, absent for Website/Social), Delete → `removeItem`, and `isDesktop === false → null`.
- **No `tsc`** run by the agent (N.17); per-cell/per-renderer typed props let Giorgio's periodic type-check + the pre-commit hook catch any drift.

---

## Changelog

- **2026-07-08** — Initial. Created `renderers/shared/communication-row-primitives.tsx` (`CommunicationRowShell` + `CommunicationSelectCell` + `CommunicationInputCell` + `CommunicationActionsCell` + `CommunicationRendererProps` / `PrimaryCommunicationRendererProps`). Migrated Email / Phone / Website / Social renderers to shell composition; barrel-exported the primitives. Added `communication-renderers.test.tsx` (7). jscpd cluster 51→33 clones / 780→394 dup-lines in `contacts/`, 0 clones in `renderers/`, `jscpd:diff` clean. Public component API unchanged. **Κουβάς Ζ** of the 2026-07-08 de-duplication sweep (ADR-585/586/588/590/591/592).
