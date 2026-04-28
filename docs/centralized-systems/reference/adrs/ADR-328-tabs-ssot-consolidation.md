# ADR-328 — Tabs SSoT Consolidation

**Status:** ✅ APPROVED — Phase I complete
**Date:** 2026-04-28
**Owner:** Procurement / UI Navigation
**Supersedes (partially):** in-place tabs duplication across `TabsComponents.tsx` and `TabsNav.tsx`
**Related:** ADR-267 (Procurement module §Phase F sub-nav extraction), CHECK 3.7 (SSoT registry), CHECK 3.24 (this ADR's enforcement gate)

---

## Context

The Tabs UI domain was fragmented across three layers with overlapping responsibilities and duplicated logic:

1. **`src/components/ui/tabs.tsx`** — Radix primitive (`Tabs / TabsList / TabsTrigger / TabsContent`) with centralized theming via `useSemanticColors` / `useSpacingTokens`. SSoT-friendly — untouched by this ADR.
2. **`src/components/ui/navigation/TabsComponents.tsx`** (229 LOC) — three near-overlapping components:
   - `TabsContainer` (uncontrolled, in-page, auto-renders `tab.content`)
   - `ToolbarTabs` (1-line alias of `TabsContainer`)
   - `TabsOnlyTriggers` (controlled OR uncontrolled, renders `<TabsList>` only, consumer owns `<TabsContent>` via `children`, hard-codes flex-column layout)

   All three independently re-implemented theme resolution, icon sizing, `useTransition` for INP, and per-tab icon mapping.

3. **`src/components/shared/TabsNav.tsx`** (132 LOC) — sub-nav routing-aware tabs with two visual variants:
   - `link` — Next.js `<Link>` styled as tabs (border-bottom underline, default).
   - `radix` — Radix Tabs + `router.push()` on change (added in ADR-267 Phase F to align with the centralized Trigger Tabs).

   Helpers `isTabActive` / `findActiveHref` lived inline.

Phase A→H of ADR-267 had already aligned the **visual** layer between the two families, but the **code path** remained tripled. Every new tabs feature required deciding which wrapper to use, with subtly different INP behavior, layout assumptions, and theming branches.

---

## Decision

Introduce **one canonical pure renderer** (`BaseTabs`) and **two thin wrappers** (`StateTabs`, `RouteTabs`). Migrate the 26 existing consumers via `@deprecated` aliases — zero call-site churn — and enforce the new SSoT with an AST-based ratchet (CHECK 3.24).

```
                ┌─────────────────────────────────┐
                │   BaseTabs   (pure renderer)    │
                │   no state · no routing         │
                └──────────────┬──────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
   ┌──────────────────────┐        ┌─────────────────────┐
   │   StateTabs          │        │   RouteTabs         │
   │   controlled/uncontr.│        │   pathname/router   │
   │   selection banner   │        │   isTabActive       │
   │   fillHeight opt-in  │        │   findActiveHref    │
   └──────────┬───────────┘        └─────────┬───────────┘
              │                              │
              ▼                              ▼
   ┌──────────────────────────────┐  ┌──────────────────────────────────┐
   │ DEPRECATED aliases           │  │ DEPRECATED alias                 │
   │ - TabsContainer              │  │ - TabsNav variant='radix'        │
   │ - ToolbarTabs                │  │   (variant='link' stays inline,  │
   │ - TabsOnlyTriggers           │  │   distinct visual contract)      │
   │ (TabsComponents.tsx shims)   │  │                                  │
   └──────────────────────────────┘  └──────────────────────────────────┘
```

---

## Architecture

### `src/components/ui/navigation/tabs-types.ts`

Canonical home for tabs interfaces and shared style constants:

```ts
export interface BaseTabDef {
  id: string;
  label: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconColor?: string;
  disabled?: boolean;
}

export interface TabDefinition extends BaseTabDef {
  icon: LucideIcon | React.ComponentType<{ className?: string }>; // required (legacy)
  content: React.ReactNode;
}

export interface TabsNavTab {
  href: string;
  labelKey: string;
  exactMatch?: boolean;
  excludeStartsWith?: readonly string[];
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconColor?: string;
}

export const TABS_STYLES = { /* ... */ } as const;
```

### `BaseTabs` (`base-tabs.tsx`, ~130 LOC)

Pure renderer. No internal state. Two content modes:

| Mode | Trigger condition | Behavior |
|------|-------------------|----------|
| **array** (default) | `children` is undefined | Renders `<TabsContent>` per `tab.content` |
| **children** | `children` provided | Renders `children` after `<TabsList>`; `tab.content` ignored |

If both `children` AND any `tab.content` are present, `children` wins and a dev-only `console.warn` flags the conflict.

**Props:** `tabs`, `value`, `onValueChange`, `theme`, `className`, `listClassName`, `ariaLabel`, `alwaysShowLabels`, `children`.

### `StateTabs` (`state-tabs.tsx`, ~95 LOC)

Adds:
- **Controlled** (`value`) **or uncontrolled** (`defaultTab` + `useState`) mode, gated by `value` prop presence.
- **`useTransition`** for INP-defer on uncontrolled state updates.
- **Selection banner** above the tabs strip when `selectedItems.length > 0 && selectionMessage`.
- **`fillHeight`** opt-in: applies `flex-1 flex flex-col min-h-0` on the wrapper + `flex-shrink-0` on the inner `TabsList` (parity with the legacy `TabsOnlyTriggers` flex-column behavior). Default `false`.

`onTabChange` is invoked in both modes, mirroring the original `TabsOnlyTriggers` semantics.

### `RouteTabs` (`route-tabs.tsx`, ~70 LOC)

Adds pathname/router awareness:
- `usePathname()` derives the active `href` via `findActiveHref(pathname, tabs)`.
- `onValueChange` triggers `router.push(href)`.
- `isTabActive` and `findActiveHref` are exported pure helpers (verbatim extraction from `TabsNav.tsx:56-64`, identical behavior).

Translates each `TabsNavTab` into a `BaseTabDef` at render time (resolves `labelKey` via `useTranslation(i18nNamespace)`).

### Alias adapters (`TabsComponents.tsx`)

Reduced from 229 LOC to ~50 LOC of `@deprecated` shims:

```tsx
/** @deprecated Use StateTabs from '@/components/ui/navigation/state-tabs'. ADR-328. */
export function TabsContainer(props) { return <StateTabs {...props} fillHeight={false} />; }

/** @deprecated identical to TabsContainer. ADR-328. */
export const ToolbarTabs = TabsContainer;

/** @deprecated Use StateTabs with fillHeight=true. ADR-328. */
export function TabsOnlyTriggers(props) { return <StateTabs {...props} fillHeight />; }

export { TabsContent } from '@/components/ui/tabs';
export type { TabDefinition, BaseTabDef, TabsNavTab } from './tabs-types';
export { TABS_STYLES } from './tabs-types';
```

The 23 consumers of `TabsOnlyTriggers`, the 2 of `ToolbarTabs`, and the consumer of `TabsContainer` keep their import statements unchanged — `@deprecated` only surfaces in IDE hover/lint feedback.

### `TabsNav.tsx` (post-refactor, ~95 LOC)

`variant='radix'` becomes a single-line forward to `RouteTabs`. `variant='link'` remains inline (Next.js `<Link>` styled, distinct visual contract — kept verbatim). The deprecation note lives on the `radix` JSDoc, **not** on the component export, so consumers using `variant='link'` are not flagged.

### `ProcurementSubNav.tsx` (direct consumer, canonical pattern)

Migrated from `TabsNav variant='radix'` to `RouteTabs` direct import. Demonstrates the canonical sub-nav pattern for new code. The remaining ~25 deprecated consumers stay on aliases (no Phase II direct migration in scope).

---

## Enforcement — CHECK 3.24

`scripts/check-tabs-import-ratchet.js` (AST-based, mirroring CHECK 3.23 baseline pattern). Two detectors:

| Detector | Pattern | Catches |
|----------|---------|---------|
| **A** | `ImportDeclaration` with source `@/components/ui/navigation/TabsComponents` and specifiers ∈ {`TabsOnlyTriggers`, `TabsContainer`, `ToolbarTabs`} | New imports of deprecated symbols |
| **B** | `JSXOpeningElement` with name `TabsNav` and `variant` attribute literal value `"radix"` | New `<TabsNav variant="radix">` JSX usage |

**Allowlist:** alias home (`TabsComponents.tsx`), navigation tests, and `TabsNav.tsx` itself.

**Baseline:** `.tabs-import-baseline.json` — 25 files / 25 violations as of 2026-04-28.

**Ratchet semantics** (zero tolerance for new files; existing files monotonically decrease):
- New file with violations → BLOCK
- Existing baselined file with MORE violations → BLOCK
- Existing baselined file SAME or FEWER → allow

**Commands:**
| Command | Purpose |
|---------|---------|
| `npm run tabs-import:audit` | Full codebase scan (report only) |
| `npm run tabs-import:baseline` | Regenerate baseline after migrations |
| `SKIP_TABS_IMPORT=1 git commit` | Emergency skip |

**Defense-in-depth:** the SSoT registry module `tabs-primitive` (Tier 2, in `.ssot-registry.json`) adds a regex-based forbidden-pattern check on top of CHECK 3.7 — the AST detector remains authoritative; the regex layer is a safety net.

---

## Consequences

**Positive:**
- Single rendering path (`BaseTabs`) for all tabs UI. Theme/icon/INP changes happen once.
- New consumers choose between `StateTabs` (in-page state) and `RouteTabs` (URL-driven) — explicit semantics, no decision tree.
- AST-based enforcement ratchets the deprecation count downward without flag-day rewrites.
- Type-only `tabs-types.ts` eliminates the circular-export risk of co-locating types with components.

**Trade-offs:**
- Aliases remain indefinitely until a Phase II ADR sweeps the 25 remaining consumers. Until then, the SSoT lives in two physical files (canonical + alias), which CHECK 3.24 baseline tracks.
- `TabsNav variant='link'` stays — its visual contract differs (Next.js `<Link>` underline) and merging it into RouteTabs would change behavior. Phase II decision.

**Risks accepted:**
- Layer 4 produced a single 5-file commit: refactor + alias + 1 direct migration. tsc and 3-suite test pass before commit; Vercel CI catches any residual.

---

## Migration Path

**Now (Phase I):** Aliases + ratchet active. New code uses `StateTabs` / `RouteTabs` / `BaseTabs`.

**Phase II (separate ADR, when scheduled):** Direct migration of the 25 alias consumers. Boy Scout rule applies: every touched file converts.

**Final state:** `TabsComponents.tsx` and `TabsNav.tsx` removed; baseline `.tabs-import-baseline.json` reaches 0.

---

## Changelog

| Date | Phase | Change |
|------|-------|--------|
| 2026-04-28 | Phase I | Initial implementation. `tabs-types.ts` + `base-tabs.tsx` (130 LOC, 15 tests, 95% coverage, jest-axe a11y) + `state-tabs.tsx` (95 LOC, 14 tests) + `route-tabs.tsx` (70 LOC, 12 tests). `TabsComponents.tsx` reduced to 50 LOC of `@deprecated` shims. `TabsNav.tsx` `radix` branch → `RouteTabs` alias. `ProcurementSubNav` migrated to direct `RouteTabs`. CHECK 3.24 active with 25-file baseline. SSoT registry +`tabs-primitive` (Tier 2). |
