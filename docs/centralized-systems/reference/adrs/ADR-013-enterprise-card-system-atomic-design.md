# ADR-013: Enterprise Card System (Atomic Design)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | UI Components |
| **Canonical Location** | `@/design-system` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `@/design-system` + `@/domain/cards`
- **Pattern**: Atomic Design (Primitives → Components → Domain Cards)
- **Result**: 64% code reduction (22→7 domain cards)

---

## Context

Cards are the most-repeated surface in the app: contacts, projects, properties,
sales, procurement, CRM and notifications all render "an icon, a name, some
status badges, a few stats, and actions on hover". Left alone, every domain
reinvented that shell.

---

## Decision

Three layers, each with one job:

| Layer | Location | Owns |
|-------|----------|------|
| **Primitives** (atoms) | `design-system/primitives/Card/` | One visual/behavioural concern each. No domain knowledge. |
| **Components** (molecules) | `design-system/components/{GridCard,ListCard}/` | A **layout**. Composes primitives into a card shell. |
| **Domain Cards** | `domain/cards/**` | Maps a domain entity to a shell's props via a view-model hook (ADR-585). |

### The two shells are deliberately NOT one component

`GridCard` (vertical tile) and `ListCard` (horizontal row) are **separate
components that share primitives** — not one shell behind a `variant="grid|list"`
flag. Grid and list are genuinely different layouts, and a God-shell with a
layout switch is how those layouts start leaking into each other. This mirrors
Revit/Figma practice: keep per-type surfaces, share only the primitives.

What legitimately differs (and must stay per-shell):

| | GridCard | ListCard |
|---|---|---|
| Stats layout | `vertical` (labelled) | `horizontal` (values only) |
| Padding | `md`, `sm` when compact | `sm` |
| Hover | `COMPLEX_HOVER_EFFECTS.FEATURE_CARD` | `hoverVariant`: standard / subtle / none |
| Selected | `ring-2` + `shadow-lg` | `shadow-sm` |
| Badge row overflow | `flex-wrap` (a tile has vertical room) | `overflow-hidden` (a row must keep its height) |
| Toolbar | `overlay` chips over dense tile content | flat, with tooltips |
| Extras | — | `ref`, external hover sync, `inlineBadges`, `role`, `allowOverflow` |

### Primitives

| Primitive | Owns |
|-----------|------|
| `CardIcon` | Entity icon + colour, resolved from `NAVIGATION_ENTITIES` |
| `CardStats` | The stats strip (`horizontal` / `vertical` / `grid`) |
| `CardHeaderBlock` | The header: title block + badge row. Owns the **max-2 badges** cap (1 when inline). |
| `CardTitleBlock` | Icon + truncating title + subtitle. Owns the truncation contract. |
| `CardBadges` | Renders badges through the centralized `Badge`. Returns a fragment — the caller owns the row layout. |
| `CardBody` | Everything below the header: stats, then custom content |
| `CardActionsToolbar` | The reveal-on-hover favorite + actions toolbar |
| `CardSelectionIndicator` | The selection accent rail |
| `useCardShell` | The tokens + handlers a shell needs to draw its own element |
| `useCardInteraction` | The activation contract: click **and** Enter/Space → `onClick` |
| `pickCardIdentity` | The one place that knows which props make up a card's identity |

### Type vocabulary (`primitives/Card/types.ts`)

- `CardBadgeVariant` is derived from the centralized `Badge` component
  (`NonNullable<BadgeVariantProps['variant']>`). The Badge owns the vocabulary;
  cards merely speak it. Because each shell's union is a **subset**, badges reach
  `<Badge>` with no cast.
- `CardBadge<TVariant>` / `CardAction` / `CardIdentityProps` / `CardBaseProps<TVariant>`
  are the shared contract. `GridCardProps = CardBaseProps<GridCardBadgeVariant>`;
  `ListCardProps` extends it with the list-only props.

> ⚠️ **Load-bearing invariant**: `GridCardBadgeVariant ⊂ ListCardBadgeVariant`.
> Domain card models (`domain/cards/**`) type badges as `GridCardBadge[]` precisely
> so one array feeds **both** shells. Widening Grid's union or narrowing List's
> breaks that, silently, at ~20 call sites.

---

## Consequences

- ✅ A card behaviour is fixed once. Keyboard activation, the badge cap, and the
  action-vs-card click isolation cannot drift between the two shells.
- ✅ The shells' public API (`GridCardProps` / `ListCardProps` and the
  `@/design-system` exports) is the contract for **112 consumer files** — it is
  changed only with an explicit decision, never as refactor fallout.
- ⚠️ Adding a prop to `CardIdentityProps` reaches both shells automatically; adding
  one to `CardBaseProps` still needs each shell to render it.
- ⚠️ `CardHeaderBlock` is deliberately **not** named `CardHeader`: shadcn's
  `CardHeader` (`@/components/ui/card`) is used in 202 files and the collision
  would be a permanent auto-import trap.

---

## Changelog

- **2026-01-01** — ADR created. Atomic-design card system: primitives → components → domain cards.
- **2026-07-16** — **Rebuilt both shells on shared primitives** (CHECK 3.28 / ADR-584 clone cluster: 8 clones / 151 duplicated lines = 21.3% between `GridCard.tsx` and `ListCard.tsx` → **0**). Extracted 6 new primitives (`CardHeaderBlock`, `CardTitleBlock`, `CardBadges`, `CardBody`, `CardActionsToolbar`, `CardSelectionIndicator`), 2 hooks (`useCardShell`, `useCardInteraction`) and `pickCardIdentity`. **Public API unchanged** — no consumer touched.
  - **Dead code removed**: `ListCardBaseProps` / `ListCardSelectionState` / `ListCardBadge` in `primitives/Card/types.ts`, written 2026-01-08 "for future ListCard component" and **never imported by anything** — the ListCard shipped the same day and ignored them. They had also diverged from reality (`selection?: {isSelected, onSelect}` vs the actual flat `isSelected`+`onClick`; a 6-member badge union missing `info`), so adopting them would have been a worse design forced onto 112 files. Their removal also resolves the name collision that forced the `ListCardBadge as ListCardBadgeConfig` alias in `design-system/index.ts`.
  - **Bogus cast removed**: both shells cast `badge.variant as '…'|'error'` — `'error'` is in *neither* shell's union. Deriving `CardBadgeVariant` from the Badge component makes every shell's union a subset, so the cast is gone.
  - **Barrels**: `design-system/index.ts` and `primitives/index.ts` now `export *` from the layer below instead of re-listing it — the list was itself a clone.
  - **Tests**: `design-system/__tests__/card-shells.test.tsx` — **34 tests, the design-system's first**. Covers the shared contract against both shells (`describe.each`) plus each shell's own differences. Verified: `jscpd:diff` on all 18 files = 0 clones (was 8), ESLint 0 errors.

---

## Related

- **ADR-585** — Domain Card View-Model Hook (how `domain/cards/**` feeds these shells)
- **ADR-584** — Token-based clone ratchet (CHECK 3.28), which drove the 2026-07-16 pass
- **ADR-001** — Select/Dropdown canonical component
