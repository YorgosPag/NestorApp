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
| 2026-04-07 | Full audit: 78 namespaces, 17,245 keys, 100% EL/EN parity. BUG found: `communications` namespace missing from `namespace-loaders.ts` (4 components affected). ~2,372 hardcoded Greek strings identified (60% comments, 25% production UI, 15% demo) | Claude (Opus 4.6) + Georgios Pagonis |
| 2026-04-07 | Full i18n compliance pass: (1) Fixed communications loader bug in namespace-loaders.ts. (2) Removed ~30 Greek defaultValue fallbacks from 11 Batch 1 files. (3) Added useTranslation + ~43 new i18n keys to 17 Batch 2 files. (4) Added ~86 locale entries (43 el + 43 en). Total: 28 files modified, 0 i18n violations remaining. Audit: 0 violations | Claude (Opus 4.6) + Georgios Pagonis |
| 2026-04-11 | **Service form section/field runtime-reachability regression + CHECK 3.13**. Reported by Γιώργος: the "Δημόσια Υπηρεσία → Βασικά Στοιχεία" tab rendered `contacts.service.sections.basicInfo.title`, `contacts.service.fields.name.helpText`, etc. as raw dotted keys instead of Greek text. **Root cause — direct aftermath of the 2026-04-11 13:50 CHECK 3.12 commit (0d6bd160)**: when `translateFieldValue` was extracted as the single source of truth, its `SERVICE_FORM_NAMESPACES` was initialized as `['contacts','contacts-form','forms']`. But ADR-280 namespace splitting (2026-04-03, commit 5f9529e8) had already moved the entire `contacts.service.*` catalog (sections + fields) out of the monolithic `contacts.json` and into `contacts-relationships.json`. Classic `t('contacts.service.x')` calls still worked because `namespace-compat.ts → LEGACY_NESTED_MAP` reroutes `contacts.service.*` → `contacts-relationships`. But the new resolver bypasses compat and calls `i18next.exists(key, { ns: SERVICE_FORM_NAMESPACES })` directly — `contacts-relationships` was not in the list, so every service-form section title and field helpText silently rendered raw. **Why CHECK 3.8 and CHECK 3.12 both passed**: both scanners verify that a key exists *somewhere* in `src/i18n/locales/el/*.json`. The keys did exist (in `contacts-relationships.json`); they were just unreachable at runtime because the resolver's namespace list did not include their home. The existing CHECK 3.12 commit message (0d6bd160) already warned: *"CHECK 3.12 would NOT have caught this specific bug — the keys exist in locales, they were just unreachable at runtime."* That warning materialized within 8 days. **Runtime fix**: added `'contacts-relationships'` to `SERVICE_FORM_NAMESPACES` in `translate-field-value.ts`, with a docblock explaining why. Both `ServiceFormRenderer` and `ServiceFormTabRenderer` already call `useTranslation(SERVICE_FORM_NAMESPACES)` so the new namespace propagates automatically. **New enforcement layer — Pre-commit CHECK 3.13**: Added `scripts/check-i18n-resolver-reachability.js` which (1) parses `SERVICE_FORM_NAMESPACES` out of the resolver module as the single source of truth, (2) loads `src/i18n/locales/el/<ns>.json` for each listed namespace and flattens each to a per-namespace Set of dotted keys, (3) scans every staged config file in the CHECK 3.12 scope for dotted i18n key candidates appearing after `label:`, `placeholder:`, `helpText:`, `title:`, `description:`, `empty:`, `info:`, `searchPlaceholder:`, `noResults:` (or inside `_LABELS` const tables), and (4) for each candidate, simulates the runtime resolver exactly — direct hit in any listed namespace, then `contacts.` prefix-strip fallback. Keys that fail both paths are flagged as **unreachable** and block the commit. This is the semantic upgrade CHECK 3.12 lacked: instead of asking "does the key exist anywhere?", CHECK 3.13 asks "can the actual runtime resolver find it?". **Ratchet**: baseline `.i18n-resolver-reachability-baseline.json`: 378 legacy unreachable keys across 13 files (dropdown-misc-labels 130, modal-select status 86, modal-select toolbar/configurations 52, modal-select navigation 29, company-config 27, crm-dashboard-tabs-config 10, period-selector-config 8, search-index-config 8, modal-select encoding 8, service-config 8, unified-tabs-factory 6, project-tabs-config 3, modal-select tabs 3). Counts can only decrease per file; new files = zero tolerance. Commands: `npm run resolver-reach:audit` / `npm run resolver-reach:baseline`. **Regression-proofing verified**: synthetic test — removing `'contacts-relationships'` from the list produced 16 new unreachable key errors in `service-config.ts` and correctly failed the check with exit 1. **Rollback note**: the intermediate fix where I duplicated `service.sections.*` + `service.fields.*` into `contacts-form.json` was reverted; duplicating locale data across namespaces would have violated SSoT and left 13 downstream fields (`administrative`, `contact`, `services`, `legalStatus`, `establishmentLaw`, `headTitle`, `headName`, `mainResponsibilities`, etc.) still unreachable. Fixing the resolver's namespace list is the root-cause fix. | Claude (Opus 4.6) + Georgios Pagonis |
| 2026-04-11 | **Service form option-label regression + structural fix**. Reported by Γιώργος: the "Κατηγορία" dropdown in `contacts → δημόσια υπηρεσία → Βασικά Στοιχεία` rendered raw keys (`options.serviceCategories.ministry`, etc.) instead of Greek labels. **Root cause**: `ServiceFormRenderer.tsx` + `ServiceFormTabRenderer.tsx` both carried inline `translateFieldValue` helpers whose lookup filter only matched keys starting with `contacts.`. Option catalogs keyed `options.serviceCategories.*` live in the `contacts-form` namespace and were silently skipped by the filter — `t()` was never called for them, so the raw string reached the UI. The component also used `useTranslation('contacts')` (single namespace), which would have missed the keys even without the filter bug. **Why existing checks did not catch it**: `check-i18n-missing-keys.js` only inspects explicit `t('key')` calls; the offending keys were string literals inside `MODAL_SELECT_SERVICE_CATEGORIES` (a static config array) and never passed through `t()` as a static argument, so the static scanner had nothing to grep for. The keys themselves exist in `contacts-form.json` — this was a **runtime resolution bug**, not a missing-translation bug. **Structural fix**: (1) Extracted the resolver into `src/components/generic/i18n/translate-field-value.ts` — single source of truth for both renderers, with a proper multi-namespace contract using `i18next.exists(key, { ns: ['contacts','contacts-form','forms'] })` as the primary lookup path and the legacy `contacts.` strip as a backwards-compat fallback. (2) Both renderers now call `useTranslation(SERVICE_FORM_NAMESPACES)` with the array form, so react-i18next cascades across all three namespaces. (3) Unit tests (`translate-field-value.test.ts`, 12/12 pass) lock in the regression: literal pass-through, option catalog resolution (the exact bug), contacts.* legacy fallback, negative tests for unrelated prefixes, and missing-key behaviour. (4) Removed a stale `legalStatus` debug logger block left over from a previous investigation. **New enforcement layer — Pre-commit CHECK 3.12**: Added `scripts/check-option-i18n-keys.js` that scans static option/label configurations under `src/config/**`, `src/subapps/**/config/modal-select/**` and `src/constants/domains/dropdown-*.ts` for string literals that look like dotted i18n keys (matched by `/^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/`) and verifies every candidate exists in at least one `src/i18n/locales/el/*.json`. This is the complement to CHECK 3.8: CHECK 3.8 catches missing keys referenced by `t('key')`, CHECK 3.12 catches orphan keys referenced by `label: 'key'` in config arrays — the two together close the dynamic-resolution blind spot that let this bug ship. Ratchet baseline `.option-i18n-keys-baseline.json`: 246 legacy violations across 6 files (dropdown-misc-labels.ts 139, status.ts 81, fields.ts 12, search-index-config.ts 8, individual-config.ts 3, service-config.ts 3). New files = zero tolerance, existing files = counts can only decrease. Commands: `npm run option-keys:audit <files...>`, `npm run option-keys:baseline`. **Note**: The new check would NOT have caught this specific bug (keys were present in locales, just unreachable at runtime) — the runtime fix + unit tests are the primary defense. CHECK 3.12 protects against the sibling class of bugs: configurations referencing keys that do not exist anywhere, a failure mode equally invisible to static `t()` scanning. | Claude (Opus 4.6) + Georgios Pagonis |
| 2026-04-11 | **Defense in Depth — 3-layer enforcement for CHECK 3.13 (ADR-279 Phase 9.2)**. Follow-up to the service-form runtime-reachability regression earlier today. **Problem statement (answer to Γιώργος's direct questions)**: (1) Is there a pre-commit check? Partially — the `scripts/check-i18n-resolver-reachability.js` script was committed but its wire-up lived in `.git/hooks/pre-commit`, which git does not track. A fresh clone, a new agent, or any `git commit --no-verify` bypass meant the check did not run. (2) Is it SSoT? Yes — the scanner parses `SERVICE_FORM_NAMESPACES` directly from the resolver module, with no duplication. (3) Can the regression reoccur? **Yes, under the untracked-hook architecture** — three vectors: untracked hook on fresh clone, `--no-verify` bypass, agent sessions without the hook installed. (4) Does the baseline need updating? No — it was generated after the resolver fix and already reflects the correct state. **Google-level response — three independent layers of enforcement, each sufficient on its own**: **Layer 1 (tracked pre-commit, local)**: moved the entire 846-line `.git/hooks/pre-commit` pipeline (CHECK 3.0 through CHECK 3.14) into `scripts/git-hooks/pre-commit`, tracked in git, and added `scripts/install-hooks.sh` which sets `core.hooksPath=scripts/git-hooks` via a `prepare` npm lifecycle script. Fresh clones activate the hook automatically on the first `pnpm install`. This is the approach used by Google, Chromium and LLVM — a native git feature with zero new dependencies (no husky, no lefthook, no pnpm-lock churn). **Layer 2 (CI mirror)**: new `.github/workflows/i18n-governance.yml` runs `check-i18n-resolver-reachability.js` (CHECK 3.13) + `check-audit-value-catalogs.js` (CHECK 3.14) + `check-i18n-missing-keys.js` (CHECK 3.8) on every PR and every push to main. The workflow is intentionally narrow and dependency-free (pure Node, no `pnpm install`, ~30s total) so that it does not get disabled under time pressure the way `quality-gates.yml` / `unit.yml` / the old `i18n-validation.yml` have been in the past (all three are currently `.disabled`). This layer **cannot be bypassed with `--no-verify`** — branch protection blocks merge if it fails. **Layer 3 (integration test)**: new `src/components/generic/i18n/__tests__/translate-field-value.integration.test.ts` (20 tests, all passing) that loads the **real** Greek locale JSON files (`src/i18n/locales/el/contacts.json`, `contacts-form.json`, `contacts-relationships.json`, `forms.json`), initialises a real i18next instance with `SERVICE_FORM_NAMESPACES`, and asserts that representative keys from the service-form config tree resolve end-to-end through `translateFieldValue`. Three attack surfaces covered: (a) `options.serviceCategories.*` — the exact 5 keys from the Δημόσια Υπηρεσία → Βασικά Στοιχεία dropdown, plus a full-catalog parameterised sweep (≥19 keys) proving every live option resolves; (b) `service.sections.*` — the namespace-split-survivor keys that moved to `contacts-relationships.json` via ADR-280; (c) `service.fields.*.label` — deeply nested field labels to catch the next class of ADR-280 fallout. Plus a direct `SERVICE_FORM_NAMESPACES.toContain('contacts-relationships')` sanity assertion that fails with a clear error message if someone removes the entry again. **Why three layers and not one**: pre-commit can be bypassed, CI can be misconfigured, tests can be skipped — but the probability of all three failing simultaneously is negligible. This is Defense in Depth per Google's release engineering playbook. **Files added**: `scripts/git-hooks/pre-commit` (846 lines, verbatim copy of the previously untracked local hook, now tracked), `scripts/install-hooks.sh` (prepare-time installer, ~40 lines), `.github/workflows/i18n-governance.yml` (~70 lines, 3 ratchet check steps), `src/components/generic/i18n/__tests__/translate-field-value.integration.test.ts` (~210 lines, 20 passing tests). **Files modified**: `package.json` (added `prepare` script). **Verification**: ran `bash scripts/install-hooks.sh` → `core.hooksPath=scripts/git-hooks` confirmed via `git config --get core.hooksPath`. Ran `npx jest src/components/generic/i18n/__tests__/translate-field-value.integration.test.ts` → 20/20 pass in 2.1s. Rolling back any layer in isolation still leaves the other two as fallbacks — the invariant holds. | Claude (Opus 4.6) + Georgios Pagonis |
| 2026-04-13 | **CHECK 3.13 Phase A — SERVICE_FORM_NAMESPACES extended (14 new namespaces, 378 → 214 violations)**. Analysis of the 378-violation baseline revealed two root causes: (1) 164 keys ARE in locale files but in namespaces not listed in `SERVICE_FORM_NAMESPACES` — config files in scope (company-config, service-config, crm-dashboard-tabs-config, period-selector-config, project-tabs-config, unified-tabs-factory, dxf-viewer modal-select files, dropdown-misc-labels) reference keys from `building`, `building-filters`, `building-tabs`, `common`, `common-shared`, `common-status`, `contacts-core`, `contacts-lifecycle`, `crm`, `dxf-viewer`, `filters`, `navigation`, `projects-data`, `reports-extended` which were invisible to the resolver. (2) 214 keys remain as genuine violations: keys with namespace-prefix patterns (`projects.status.planning` where locale stores `status.planning` in `projects.json`) or keys genuinely absent from all locale files. **Fix (Phase A)**: added 14 namespaces to `SERVICE_FORM_NAMESPACES` in `translate-field-value.ts`. Baseline updated 378 → 214 (5 files). **Verification**: `npm run resolver-reach:audit` → ✅ 119 config files pass. **Remaining 214** (company-config 21, dxf-viewer/status 78, dropdown-misc-labels 105, search-index-config 8, unified-tabs-factory 2). **Phase B** (future): prefix-strip fallback for `projects./units./properties./storage.` → fixes ~78. **Phase C** (CHECK 3.8 overlap): add missing locale keys for genuinely absent entries. | Claude (Sonnet 4.6) |
| 2026-04-13 | **CHECK 3.13 Phase C — missing locale keys added (79 → 0 violations, baseline ZEROED)**. Phase C resolved the final 79 violations by adding the genuinely absent locale entries to 9 namespace files (el + en). Keys added: (1) `contacts-core.json`: new `company.sections.*` (5 section titles) + `company.fields.*` (11 fields with placeholder/helpText) — 21 keys. (2) `storage.json`: `card.stats.level/value/stage/priority/dueDate` + root `types.parking` — 6 keys. (3) `building-tabs.json`: `tabs.floorplan.description` + `tabs.protocols.description` — 2 keys. (4) `building.json`: `propertyTypes.studio/garsoniera/apartment/maisonette` — 4 keys. (5) `properties-enums.json`: `status.underConstruction/blocked` + new `saleStatus.notSold/sold/reserved/pending` — 6 keys. (6) `dxf-viewer.json`: new `steps.*` (7 keys) for wizard step labels. (7) `contacts-relationships.json`: `relationships.status.active/inactive/pending/terminated/suspended` + 22 additional `relationships.types.*` (director, executive, intern, etc.). (8) `crm.json`: new `stages.lead/closing/won/lost` — 4 keys. (9) `filters.json`: `allPrices` — 1 key. All additions in both el and en (SOS N.11 compliance). **CHECK 3.13 baseline**: 79 → 0. **Status: COMPLETE** — 3-phase cleanup (Phase A: 378→214, Phase B: 214→79, Phase C: 79→0). | Claude (Sonnet 4.6) |
| 2026-04-13 | **CHECK 3.13 Phase B — namespace-prefix strip fallback + 3 new namespaces (214 → 79 violations)**. Root cause of residual 214 violations: config files use keys like `common.priority.none`, `building.floors.ground`, `projects.status.planning`, `properties.status.available`, `storage.general.status.x` where the namespace name is the first dotted component. But locale JSON files store only the suffix — `projects.json` has `{ "status": { "planning": "..." } }` (set contains `status.planning`, NOT `projects.status.planning`). So `i18next.exists('projects.status.planning', { ns: ['projects', ...] })` → FALSE even though `projects` was listed in SERVICE_FORM_NAMESPACES. **Fix (Phase B)**: (1) Added `projects`, `properties-enums`, `storage` to `SERVICE_FORM_NAMESPACES` (now 21 total). (2) Added prefix-strip fallback to `translateFieldValue`: strip the first dotted component and re-check the remainder across all loaded namespaces. (3) Mirrored identical logic in `scripts/check-i18n-resolver-reachability.js` `resolves()` so the pre-commit scanner and the runtime resolver remain in sync (SSoT parity). **Violations eliminated**: dxf-viewer/status 78→6 (-72), dropdown-misc-labels 105→44 (-61), search-index-config 8→6 (-2). **Baseline updated**: 214 → 79 (5 files: company-config 21, search-index-config 6, unified-tabs-factory 2, dxf-viewer/status 6, dropdown-misc-labels 44). **Phase C** (deferred, CHECK 3.8 overlap): remaining 79 are keys genuinely absent from all locale files — need new locale entries, not resolver fixes. | Claude (Sonnet 4.6) |
| 2026-04-17 | **Property mutation impact dialog i18n — SSoT consumer formatter (commit c85eb47c)**. Reported by Γιώργος: the property impact preview dialog rendered raw identifiers (`areas`, `interiorFeatures`, `systemsOverride`) and raw JSON payloads (`{"gross":35,"net":30}`, `["security-door","alarm"]`) instead of Greek labels and human text. **Root cause — two independent defects**: (1) `properties.impactGuard.fields/kinds/dependencies` catalog in el/en was frozen at an earlier shape of `PropertyMutationImpactPreview` — 14 new fields (`areas`, `commercial*`, `linkedSpaces`, `layout`, `orientations`, `condition`, `energy`, `systemsOverride`, `finishes`, `interiorFeatures`, `securityFeatures`, `buildingId`, `floorId`), new kinds (`commercial`, `structure`, `features`), and new dependency ids (`paymentPlans`, `payments`, `cheques`, `legalContracts`, `accountingInvoices`) were absent. The obsolete entries (`status`/`hierarchy`/`data` kinds, `contacts`/`contracts`/`invoices`/`tasks` deps) had zero live references. PropertyMutationImpactDialog.tsx fell back to `defaultValue: field` which exposed the raw identifier. (2) `previewPropertyMutationImpact` (server) uses `normalizeValue = JSON.stringify` for non-primitive fields, so `previousValue`/`nextValue` arrived at the dialog as JSON strings. The dialog rendered them verbatim. **Fix — pure SSoT consumer, zero new enum keys**: (1) Synced `impactGuard.*` in el+en with the current `PropertyMutationImpactPreview` type. (2) Added `src/features/property-details/utils/impact-value-formatter.ts` — `formatImpactValue(t, field, raw)` parses JSON per field and resolves every token through the **existing** `properties-enums` catalog (`condition.*`, `systems.heating.*`, `systems.cooling.*`, `finishes.flooring.*`, `finishes.frames.*`, `finishes.glazing.*`, `features.interior.*`, `features.security.*`, `commercialStatus.*`, `units.orientation.*`, `units.sqm`, `energy.class`) plus the area/layout sub-labels from `properties-detail:fields.areas.*` / `fields.bedrooms` / `fields.bathrooms` / `fields.layout.wc`. Unknown tokens fall back via `defaultValue` (never a blank string). Unknown fields pass through untouched. Malformed JSON for a structured field returns the raw payload. (3) `PropertyMutationImpactDialog.tsx` pipes both `previousValue` and `nextValue` through the formatter. **Why this is the correct layering**: the server-side normalizer (`JSON.stringify`) is the audit-trail contract — it must stay stable for replayability. The human rendering lives in the UI layer where translation state is available. Duplicating enum labels into a new `impactGuard.values.*` sub-tree would have violated SSoT (the same enum is also rendered by property-details forms and audit logs, already reading from `properties-enums`). **Tests**: `src/features/property-details/utils/__tests__/impact-value-formatter.test.ts` — 13/13 pass covering every field branch: null → emptyValue label, each structured field → expected joined format, primitive enum lookup, malformed JSON → raw pass-through, unknown enum token → defaultValue fallback, unknown field → raw pass-through. **Files changed**: `src/features/property-details/utils/impact-value-formatter.ts` (new, 181 lines), `src/features/property-details/utils/__tests__/impact-value-formatter.test.ts` (new, 112 lines), `src/components/properties/dialogs/PropertyMutationImpactDialog.tsx` (wire-up), `src/i18n/locales/el/properties.json` + `src/i18n/locales/en/properties.json` (impactGuard sub-tree sync). Pre-commit: 17 checks green (including CHECK 3.8 missing-keys and CHECK 3.13 resolver-reachability). No ADR gap for property-mutation-impact existed — this entry documents the work under ADR-279 i18n governance. | Claude (Opus 4.7, 1M context) + Georgios Pagonis |
| 2026-04-23 | **ServiceFormRenderer select-placeholder raw-key leak (sibling of the 2026-04-11 runtime-reachability class)**. Reported by Γιώργος: opening "Νέα Επαφή → Δημόσια Υπηρεσία → Βασικά Στοιχεία" rendered the literal key `contacts.service.fields.category.label` inside the empty **Κατηγορία** dropdown, while the outer `<FormField>` label showed the correct Greek text "Κατηγορία". **Root cause**: in `ServiceFormRenderer.tsx`, the per-field translation pass computed `translatedLabel`/`translatedPlaceholder`/`translatedHelpText` correctly, but when building the `translatedField` config for `renderField()` it only forwarded the translated `placeholder` and `helpText` — `label` was left as the raw i18n key via spread. `renderSelectField()` then computed its fallback as `const placeholder = field.placeholder || field.label;` — for the `category` field (which has no explicit placeholder in `service-config.ts`) this fell through to the raw key, and `<SelectValue placeholder={...}>` rendered it verbatim because no value was selected yet. The `<FormField label>` prop received the correctly translated string via a separate local variable, which is why the outer label looked fine. **Why the integration test did not catch it**: `translate-field-value.integration.test.ts` verifies that the resolver returns non-raw strings for representative keys — the resolver itself was working. The bug was in the **consumer** (`ServiceFormRenderer`) which dropped the translated label before handing it to the select placeholder path. **Fix**: added `label: translatedLabel` to the `translatedField` construction in `ServiceFormRenderer.tsx` so `renderSelectField`'s placeholder fallback (`field.placeholder || field.label`) no longer sees the raw key. Single line of code, with an inline comment explaining why the translated label must propagate. **Tests**: `translate-field-value.integration.test.ts` — 20/20 pass unchanged (confirms the resolver remains correct). No new test added at the ServiceFormRenderer level yet — the class of bug ("component receives translated label via one prop but forwards the raw key via another") is narrow enough that a dedicated component-level render test would over-index on this specific field. **Files changed**: `src/components/generic/ServiceFormRenderer.tsx` (1-line fix + 3-line comment). No locale changes, no resolver changes, no baseline shifts. | Claude (Opus 4.7, 1M context) + Georgios Pagonis |
| 2026-04-11 | **Canonical catalog convention ratified — camelCase enum keys + CHECK 3.14 guard-rail**. Formalizes the implicit ADR-279 convention that was violated by the 2026-04-11 audit-trail regression (see ADR-195 Phase 9.1 for the full root cause). **Rule**: every i18n catalog referenced by a dynamic runtime resolver (form option labels, audit value catalogs, enum-keyed dropdowns) MUST use **camelCase** enum keys — never snake_case or kebab-case. Rationale: forms persist raw enum values to Firestore as snake_case tokens (e.g. `fire_department`, historical convention from the `MODAL_SELECT_*` catalogs), but catalogs need a single canonical form for deterministic resolution. camelCase was selected as the canonical form because it matches JavaScript identifier conventions, avoids collisions with composite labels (e.g. `NAME_A_TO_Z` SCREAMING_SNAKE sentinels, `ΑΕ`/`ΕΠΕ` Greek abbreviations), and enables a **one-way** snake→camel normalization in resolvers without ambiguity. **Runtime normalization contract**: resolvers that bridge stored form values to catalog labels MUST apply `snake_case → camelCase` as a lossless one-way conversion (implementation reference: `src/components/shared/audit/audit-value-resolver.ts:toCamelCase`). The conversion is safe **if and only if** catalogs contain no lowercase snake/kebab keys — otherwise two distinct entries could collapse to the same camelCase form and silently shadow each other. **Enforcement — CHECK 3.14 extended**: `scripts/check-audit-value-catalogs.js` was extended with a `findSnakeCaseKeys()` guard (`/^[a-z][a-z0-9]*[_-][a-z0-9_-]+$/`) that rejects any snake_case or kebab-case key in a referenced catalog, in both el and en locales. Zero tolerance — no baseline. Allowed by design: camelCase (`fireDepartment`), SCREAMING_SNAKE enum sentinels (`NAME_A_TO_Z`, only uppercase), and non-Latin abbreviations (`ΑΕ`, `ΕΠΕ`). Only lowercase snake/kebab is blocked. Sanity test: temporarily renamed `fireDepartment` → `fire_department` in `el/contacts-form.json` → validator correctly aborted with `[category] el:contacts-form:options.serviceCategories → keys must be camelCase (ADR-279); found snake/kebab: fire_department`. **Scope of the ratified convention**: applies to any catalog referenced via `AUDIT_VALUE_CATALOGS` or equivalent runtime-resolver registries. Does not apply to catalogs that are only ever consumed by static `t('key')` calls — those can use any key format since the keys are hardcoded and reviewed at commit time. **Cross-references**: ADR-195 Phase 9.1 (audit resolver snake→camel normalization + full motivation), this ADR § Canonical Catalog Conventions (new section — to be added in a follow-up doc pass). **Files changed**: `scripts/check-audit-value-catalogs.js` (+guard function + integration), `src/components/shared/audit/audit-value-resolver.ts` (+`toCamelCase` + 6-layer resolution), `src/components/shared/audit/__tests__/audit-value-resolver.test.ts` (new, 6/6 pass), ADR-195 (Phase 9.1 entry), ADR-279 (this entry). | Claude (Opus 4.6) + Georgios Pagonis |
