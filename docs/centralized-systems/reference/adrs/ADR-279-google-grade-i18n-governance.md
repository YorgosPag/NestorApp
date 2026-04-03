# ADR-279: Google-Grade i18n Governance & Localization Operating Model

| Metadata | Value |
|----------|-------|
| **Status** | ACTIVE |
| **Date** | 2026-04-03 |
| **Category** | Infrastructure / Data & State |
| **Canonical Location** | `src/i18n/` |
| **Author** | Georgios Pagonis + Claude Code (OpenAI) |

---

## 1. Context

The application already has a serious i18n foundation:

- namespace-based catalogs under `src/i18n/locales/{el,en,pseudo}`
- lazy-loaded namespaces via `src/i18n/lazy-config.ts`
- runtime config in `src/i18n/config.ts`
- shared hooks in `src/i18n/hooks/`
- generated TypeScript key definitions in `src/types/i18n.ts`
- a pseudo locale for development validation

However, the current system is not yet "Google-grade" in governance, consistency, or operational safety.

### Current Observed State

1. **Catalog footprint is large and uneven**
   - `el`: 40 JSON files
   - `en`: 40 JSON files
   - `pseudo`: 21 JSON files

2. **Some catalogs are too large for safe ownership**
   - `src/i18n/locales/el/building.json`: 2437 lines
   - `src/i18n/locales/el/common.json`: 2429 lines
   - `src/i18n/locales/el/dxf-viewer.json`: 1845 lines
   - `src/i18n/locales/el/report-builder-domains.json`: 1572 lines
   - `src/i18n/locales/el/contacts.json`: 1567 lines
   - `src/i18n/locales/el/properties.json`: 955 lines

3. **Fallback-heavy UI usage exists**
   - Repo scan found `602` `defaultValue:` usages in `src/`
   - This indicates that components frequently compensate for missing or unstable catalogs at render time

4. **Generated typings are stale relative to active namespaces**
   - `src/types/i18n.ts` was generated on `2025-12-13`
   - `src/types/i18n.ts` exports `19` namespaces
   - active locale files currently represent `40` namespaces per main language

5. **Validation tooling is incomplete**
   - `scripts/validate-translations.js` validates only `el` and `en`
   - `pseudo` is not part of validation coverage
   - `package.json` references missing scripts:
     - `scripts/validate-i18n-config.js`
     - `scripts/extract-hardcoded-strings.js`

6. **Pseudo locale is not first-class**
   - `src/i18n/config.ts` loads pseudo `common` and `landing`
   - pseudo `navigation` and `admin` fall back to Greek resources
   - this weakens pseudo-locale testing as a layout and raw-string detector

7. **Raw-key and namespace drift have already been observed**
   - existing internal audits document raw-key rendering and namespace resolution issues:
     - `docs/open ai analysis/i18n-raw-key-audit-2026-02-13.md`
     - `docs/open ai analysis/buildings-storage-i18n-investigation-2026-02-15.md`
   - recent application issues also exposed naming drift such as `unit` vs `property`

8. **Notification key resolution is heuristic**
   - `src/providers/NotificationProvider.tsx` attempts best-effort namespace resolution
   - this is resilient, but it also hides upstream contract problems instead of preventing them

### The Real Problem

The application has **i18n infrastructure**, but not yet **i18n governance**.

Google-grade localization is not defined by "many JSON files" or "having translations". It is defined by:

- stable string ownership
- deterministic catalog topology
- strict locale parity
- translator-safe context
- CI-enforced completeness
- minimal runtime fallback behavior
- typed, synchronized catalogs
- first-class pseudo-locale verification

Today, the repo is closer to "capable and growing" than to "fully governed".

---

## 2. Decision

Adopt a **Google-grade localization operating model** built on six mandatory rules.

### Rule 1: Locale parity becomes a hard requirement

All product namespaces must exist in:

- `el`
- `en`
- `pseudo`

No namespace is considered complete unless all three locales are present and schema-equivalent.

### Rule 2: Catalogs are split by product surface and string class

Large mixed-purpose catalogs must be decomposed.

Required separation:

- product chrome and navigation
- forms and placeholders
- domain enums/statuses/types
- validation and errors
- empty states and notifications
- long-form helper/explanatory copy

This means that giant mixed files such as `common.json`, `building.json`, and `contacts.json` must stop accumulating unrelated strings.

### Rule 3: Runtime `defaultValue` becomes exceptional, not normal

`defaultValue` is allowed only for:

- temporary migration boundaries
- explicitly approved compatibility shims
- non-user-facing diagnostics

It is not acceptable as the standard delivery path for product UI strings.

### Rule 4: Generated typing must be rebuilt from the live catalogs

`src/types/i18n.ts` must be treated as a generated artifact that always reflects the real active locale set.

Generated typing is invalid if:

- it omits active namespaces
- it lags behind current locale files
- it does not participate in quality gates

### Rule 5: Pseudo locale becomes first-class

`pseudo` is not optional dev sugar. It becomes a required QA surface used to detect:

- hardcoded strings
- missing keys
- layout overflow
- untranslated enum values
- namespace fallback bugs

### Rule 6: Translation delivery is governed as a platform contract

Localization is not owned ad hoc by whichever feature happens to render text. It is governed by:

- stable namespace ownership
- catalog budgets
- migration rules
- CI validation
- documented naming rules

---

## 3. Target Operating Model

### 3.1 Namespace Topology

Each namespace must represent one bounded surface, not a loose bucket.

Target examples:

- `common-ui`
- `common-actions`
- `common-validation`
- `properties-detail`
- `properties-form`
- `properties-enums`
- `building-management`
- `building-reports`
- `contacts-form`
- `contacts-relationships`
- `notifications`

Exact naming may vary, but the rule does not: **single ownership, single purpose, low ambiguity**.

### 3.2 String Classes

Every string must belong to one of these classes:

1. **UI Chrome**
   - navigation, tabs, buttons, shared labels

2. **Domain Vocabulary**
   - statuses, enums, property types, conditions, orientations

3. **Input/Form Copy**
   - field labels, placeholders, section titles, help text

4. **Validation & Error Copy**
   - user-corrective messages, blocking errors, warning states

5. **Notifications**
   - toasts, snackbars, confirm flows, banners

6. **Long-form Explanatory Content**
   - educational paragraphs, formula descriptions, legal/process help

Google would not mix all six classes inside one giant domain JSON unless there were hard operational reasons.

### 3.3 Key Naming Standard

Keys must be:

- semantic, not presentation-based
- stable over time
- independent from implementation details
- consistent across domains

Required conventions:

- no synonym drift like `unit` / `property`
- no mixed singular/plural concepts for the same entity
- no key names that expose component internals unless the component is itself the domain boundary
- no silent alias trees kept forever

### 3.4 Translator Context Standard

All non-trivial strings should eventually carry context metadata outside the runtime JSON shape, such as:

- feature owner
- screen/context
- screenshots or UI references
- interpolation parameter meaning
- allowed length constraints
- whether the string is a label, CTA, error, or help text

Without this, you can localize, but not at Google-grade quality.

---

## 4. Enforcement Model

### 4.1 Mandatory Quality Gates

The i18n platform must enforce these checks:

1. namespace existence in all supported locales
2. exact key parity across `el`, `en`, `pseudo`
3. stale generated type detection
4. duplicate semantic key detection where feasible
5. missing-script detection in package contracts
6. raw-key render prevention for notifications, dialogs, and error states
7. `defaultValue` budget enforcement

### 4.2 Required Tooling Changes

Current scripts are insufficient for the target state.

Required changes:

- upgrade `scripts/validate-translations.js` to validate `pseudo`
- add or restore the missing scripts referenced in `package.json`
- make `generate-i18n-types.js` part of the standard i18n pipeline
- fail CI if generated types differ from committed output
- produce machine-readable reports for:
  - missing keys
  - extra keys
  - namespace drift
  - file-size budgets
  - `defaultValue` counts

### 4.3 Runtime Contract Tightening

The application should stop relying on heuristic resolution where deterministic contracts are possible.

Examples:

- notifications should receive translated text or fully qualified typed keys through one canonical API
- confirm dialogs should never accept raw key strings
- config objects that carry labels should either carry final display strings or typed translation references with mandatory resolution at the render boundary

---

## 5. What Google Would Do

If Google were operating this system, it would likely do the following:

1. **Reduce entropy first**
   - stop key drift
   - stop giant mixed files from growing
   - stop fallback-first rendering

2. **Treat localization as a platform**
   - one governed pipeline
   - one source of truth
   - one set of policies

3. **Make pseudo-locale non-negotiable**
   - complete coverage
   - visual QA usage
   - regression detection

4. **Separate vocabulary from UI**
   - enums and domain statuses live in controlled catalogs
   - helper copy lives elsewhere

5. **Enforce contracts in tooling, not in tribal knowledge**
   - scripts must exist
   - scripts must run
   - generated types must be current
   - parity must be machine-checked

6. **Require context for translators**
   - names alone are not enough
   - key quality and metadata matter as much as translation text

7. **Measure localization health**
   - missing-key count
   - fallback count
   - pseudo coverage
   - namespace size
   - raw-key incidents

---

## 6. Migration Plan

### Phase 0: Freeze Entropy

- prohibit new mixed-purpose additions to oversized files
- prohibit new `unit`/`property` synonym drift
- prohibit new raw-key notification patterns
- require namespace selection for all new feature work

### Phase 1: Repair the Toolchain

- implement `scripts/validate-i18n-config.js`
- implement `scripts/extract-hardcoded-strings.js`
- extend translation validation to `pseudo`
- regenerate `src/types/i18n.ts`
- wire i18n script correctness into the documented workflow

### Phase 2: Establish Hard Budgets — ✅ COMPLETE (2026-04-03)

Budgets established via `namespace-manifest.json` (77 entries). Each namespace has a `budget` (line count) and `warnOnly` flag. Enforced by `validate:i18n` pipeline.

### Phase 3: Split High-Risk Catalogs — ✅ COMPLETE (2026-04-03)

Implemented via ADR-280. 30 new namespaces created across 4 phases:

- Phase 1: `building` → 5 splits, `common` → 4 splits
- Phase 2: `dxf-viewer` → 5 splits, `contacts` → 5 splits
- Phase 3: `projects` → 2 splits, `payments` → 2 splits
- Phase 4: 6 splits (geo-canvas, crm, accounting, files, navigation, reports)

Validation: 16,317/16,317 keys (100% — zero key loss). Full el/en/pseudo parity.

### Phase 4: Remove Fallback-First Rendering

- audit top `defaultValue` hotspots
- replace component-local copy with canonical keys
- convert raw dynamic status rendering to enum catalogs
- centralize notification and dialog translation contracts

### Phase 5: Make Pseudo QA Real

- complete pseudo coverage for all namespaces
- stop falling back to Greek for pseudo-only missing resources
- require pseudo-locale checks for major UI surfaces

### Phase 6: Translator-Grade Metadata

Create a non-runtime string registry or manifest with:

- namespace owner
- feature route
- key description
- parameter description
- screenshot reference
- string class

---

## 7. Success Criteria

The application reaches "Google-grade direction" only when all of the following are true:

- `el`, `en`, and `pseudo` have full namespace parity
- generated i18n types match all active namespaces
- missing i18n scripts no longer exist in package contracts
- `defaultValue` usage drops from hundreds to tightly controlled exceptions
- no user-facing raw keys are rendered in notifications, dialogs, errors, cards, or tabs
- oversized catalogs are split into bounded, owned namespaces
- pseudo locale is usable as an actual QA mode rather than a partial dev aid

---

## 8. Consequences

### Positive

- much lower localization drift
- safer feature delivery across languages
- better translator throughput and quality
- fewer runtime fallback bugs
- tighter type safety and namespace correctness
- real pseudo-locale testing value

### Negative

- multi-phase migration cost across app surfaces
- temporary increase in documentation and tooling work
- some namespace churn during decomposition
- stricter delivery discipline for feature teams

---

## 9. Prohibitions (after this ADR)

- adding new feature strings into giant catch-all files without explicit justification
- shipping namespaces only in `el/en` but not `pseudo`
- relying on stale generated `src/types/i18n.ts`
- keeping broken script references in `package.json`
- normalizing missing translations through widespread `defaultValue`
- passing raw i18n keys as end-user strings to toasts, dialogs, and UI cards

---

## 10. References

- `src/i18n/config.ts`
- `src/i18n/lazy-config.ts`
- `src/i18n/hooks/useTranslation.ts`
- `src/i18n/hooks/useTranslationLazy.ts`
- `src/i18n/hooks/useNamespace.ts`
- `src/providers/NotificationProvider.tsx`
- `src/types/i18n.ts`
- `src/types/i18n-params.ts`
- `scripts/generate-i18n-types.js`
- `scripts/validate-translations.js`
- `package.json`
- `docs/open ai analysis/i18n-raw-key-audit-2026-02-13.md`
- `docs/open ai analysis/buildings-storage-i18n-investigation-2026-02-15.md`
- Related: `ADR-269-unit-to-property-rename.md`
- Related: `ADR-172-pre-production-audit-remediation.md`
- **Implementation Plan**: `ADR-280-i18n-namespace-splitting-plan.md`

---

## 11. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-04-03 | Initial ADR created after repo-wide i18n governance audit | Georgios Pagonis + Claude Code (OpenAI) |
| 2026-04-03 | Status PLANNING --> ACTIVE. Concrete splitting plan created in ADR-280. 14 over-budget namespaces identified, 4-phase plan with ~33 new namespaces | Georgios Pagonis + Claude Code |
| 2026-04-03 | Phase 2 (Hard Budgets) COMPLETE — namespace-manifest.json with 77 entries. Phase 3 (Split High-Risk Catalogs) COMPLETE — 30 new namespaces via ADR-280 implementation | Georgios Pagonis + Claude Code |
