# ADR-314: SSoT Discovery Findings & Centralization Roadmap

## Status
📋 APPROVED — 2026-04-18 — **Phase A DONE** — **Phase B DONE** — **Phase C.1 mostly DONE** — **Phase C.2 DONE (top)** — **Phase C.3 DONE (top 5, 1 residuo)** — **Phase C.4 BLOCKED (scope discussion)** — Phase C.5 verification pending

**Related:**
- ADR-294 (SSoT Ratchet Enforcement) — provides the enforcement infrastructure (`.ssot-registry.json`, ratchet scripts)
- ADR-299 (Ratchet Backlog Master Roadmap) — aggregated tracker for all ratchets; this ADR adds new candidates
- ADR-287 (Enum SSoT Centralization) — precedent pattern for status/label centralization

---

## Context

Στις 2026-04-18 ο Giorgio ζήτησε ασφαλή τρόπο ανίχνευσης non-centralized κώδικα **χωρίς να δημιουργηθεί νέος scattered κώδικας που θα χρειαζόταν πάλι centralization** (Google-style enforcement preventivo).

Εκτελέστηκε `npm run ssot:discover` (script: `scripts/ssot-discover.sh`). Το script κάνει 4 phases:
1. **Phase 1** — Extract exports από κεντρικοποιημένα files
2. **Phase 2** — Cross-reference για να βρει duplicates
3. **Phase 3** — Scan για γνωστά scattered anti-patterns
4. **Phase 4** — Registry gap analysis (SSoT files χωρίς enforcement)

**Output snapshot** (`/tmp/ssot-full.txt`, 596 lines):
- 135 centralized files
- **39 protected** (in `.ssot-registry.json`)
- **96 unprotected** (registry gap — δεν εμποδίζουν duplicates)
- **74 duplicated exports** (ίδιο symbol σε >1 file)
- **5 scattered anti-patterns**

---

## Decision

**Δημιουργία διαβαθμισμένου centralization roadmap σε 3 φάσεις (A/B/C)**, με baseline tracking στο `.claude-rules/ssot-discovery-pending.md`.

**Principle**: Κάθε νέο SSoT module που ολοκληρώνεται **MUST** προστεθεί ταυτόχρονα στο `.ssot-registry.json` με baseline. Έτσι:
- Ratchet ξεκινά από τρέχουσες παραβάσεις
- Νέος scattered κώδικας **BLOCKED** από pre-commit
- Δεν δημιουργούνται νέα duplicates κατά την migration

---

## Findings (snapshot 2026-04-18)

### 🔴 Top duplicate exports (74 total)

| Symbol | SSoT (claimed) | Duplicates | Severity |
|--------|----------------|-----------|----------|
| `getStatusColor` | `lib/design-system.ts` AND `lib/obligations-utils.ts` AND `lib/project-utils.ts` | 9 files (3 SSoT in conflict!) | 🔴 CRITICAL |
| `getStatusLabel` | 3 SSoT in conflict | 5 files | 🔴 CRITICAL |
| `getStatusIcon` | `lib/obligations-utils.ts` | 2 files | 🟡 |
| `formatDate` | `lib/intl-formatting.ts` | 4 files | 🔴 |
| `formatCurrency` | `lib/intl-formatting.ts` | 3 files | 🔴 |
| `formatDateGreek` | `lib/intl-domain.ts` | 3 files | 🟡 |
| `formatDateForDisplay` | `lib/intl-domain.ts` AND `utils/validation.ts` | 1+1 files (SSoT conflict) | 🟡 |
| `getCategoryLabel` | `lib/intl-domain.ts` | 2 files | 🟡 |
| `getDaysUntilCompletion` | `lib/intl-domain.ts` AND `lib/project-utils.ts` | SSoT conflict | 🟡 |
| `STATUS_COLORS` / `STATUS_LABELS` | `lib/project-utils.ts` | 1+2 files | 🟡 |
| `mainMenuItems` / `toolsMenuItems` / `settingsMenuItem` | `config/smart-navigation-factory.ts` | `config/navigation.ts` re-export | 🟢 (likely legitimate alias) |
| `generateSectionId` / `generateArticleId` / `generateParagraphId` / `generateObligationId` | `services/enterprise-id-convenience.ts` | `lib/obligations/utils.ts` (4 trivial wrappers) | 🟢 EASY WIN |
| `chunkArray` | `lib/array-utils.ts` | `services/report-engine/report-query-transforms.ts` | 🟡 |
| `stripAccents` / `normalizeGreekText` | `utils/greek-text.ts` | `services/ai-pipeline/shared/greek-text-utils.ts` (re-export) | 🟢 (alias) |
| `performanceMonitor` | `utils/performanceMonitor.ts` | `subapps/geo-canvas/performance/monitoring/PerformanceMonitor.ts` | 🟡 (subapp, ίσως legitimate isolation) |
| `isWebShareSupported` / `generateShareableURL` / `getSocialShareUrls` / `getPhotoSocialShareUrls` / `trackShareEvent` | `lib/share-utils.ts` | `lib/social-platform-system/{sharing,analytics}-service.ts` (5 wrappers) | 🟡 |
| `flattenForTracking` | `config/audit-tracked-fields.ts` | `lib/audit/audit-diff.ts` | 🟡 |
| `getAllCompanyFields` / `createFieldsMap` / `isFieldRequired` | `config/company-config.ts` AND `config/company-gemi-config.ts` | `config/company-gemi/utils/field-utilities.ts` | 🟡 |
| `ENTITY_TYPES` | `config/domain-constants.ts` | `core/configuration/enterprise-messages-system.ts` AND `subapps/dxf-viewer/settings-core/types/state.ts` | 🔴 (already in registry — Tier 0!) |
| `isDevBypassAllowed` | `config/environment-security-config.ts` | `lib/auth/security-policy.ts` | 🟡 |
| `DOCUMENT_TYPE_OPTIONS` | `config/individual-config.ts` | `config/company-gemi/options/index.ts` | 🟡 |
| `getTypeIcon` / `getTypeLabel` | `utils/contactFormUtils.ts` | 3 / 1 files | 🟡 |
| `resolveProjectId` | `lib/firebaseAdmin-credentials.ts` | `components/sales/dialogs/sales-dialog-utils.ts` | 🟡 |
| `getProgressColor` | `lib/project-utils.ts` | 2 files | 🟡 |
| `getPropertyStatusConfig` | `lib/property-utils.ts` | `features/property-hover/constants.ts` | 🟡 |
| `convertMarkdownToHtml` | `lib/obligations-utils.ts` | `lib/obligations/utils.ts` | 🟡 |

> **Full list**: see `/tmp/ssot-full.txt` (regenerable via `npm run ssot:discover`)

### 🟡 Scattered anti-patterns (5 categories)

| Pattern | Files affected | SSoT to use |
|---------|---------------|-------------|
| `new Date().toISOString()` | **309 files** | `src/lib/date-local.ts` |
| `Timestamp.fromDate(...)` scattered | 19 files | `src/lib/date-local.ts` |
| Hardcoded `entityType` literals | 23 files | `src/config/domain-constants.ts → ENTITY_TYPES` |
| Manual sort by locale (`.localeCompare`) | 42 files | `src/lib/intl-formatting.ts → sortByLocale()` |
| `crypto.randomUUID()` | 1 file (the SSoT itself — false positive) | `src/services/enterprise-id.service.ts` |

**Top offenders for `new Date().toISOString()`**:
- `app/api/admin/migrations/execute/route.ts` — 11x
- `services/report-engine/report-data-aggregator.ts` — 9x
- `app/api/reports/saved/[reportId]/route.ts` — 8x
- `services/measurements/boq-repository.ts` — 7x
- `services/ai-pipeline/multi-intent-steps.ts` — 7x

### 🟡 Registry gap — 96 SSoT files NOT in `.ssot-registry.json`

Top 20 by export count (high-value enforcement targets):

| File | Exports | Priority |
|------|---------|----------|
| `services/enterprise-id-convenience.ts` | 127 | 🔴 P0 |
| `lib/obligations-utils.ts` | 38 | 🔴 P0 |
| `lib/message-utils.ts` | 30 | 🟡 P1 |
| `lib/intl-domain.ts` | 30 | 🔴 P0 |
| `lib/design-system.ts` | 28 | 🔴 P0 |
| `lib/intl-formatting.ts` | 26 | 🔴 P0 |
| `config/properties-tabs-config.ts` | 26 | 🟡 P1 |
| `lib/rtl-utils.ts` | 24 | 🟡 P1 |
| `lib/hedging-engine.ts` | 18 | 🟡 P1 |
| `utils/validation.ts` | 17 | 🟡 P1 |
| `lib/project-utils.ts` | 16 | 🔴 P0 |
| `lib/pagination.ts` | 16 | 🟡 P1 |
| `lib/npv-engine.ts` | 16 | 🟡 P1 |
| `lib/firebaseAdmin.ts` | 16 | 🔴 P0 |
| `lib/date-local.ts` | 14 | 🔴 P0 |
| `config/period-selector-config.ts` | 13 | 🟢 P2 |
| `config/crm-dashboard-tabs-config.ts` | 13 | 🟢 P2 |
| `config/building-tabs-config.ts` | 13 | 🟢 P2 |
| `lib/share-utils.ts` | 12 | 🟡 P1 |
| `config/smart-navigation-factory.ts` | 11 | 🔴 P0 |

> Remaining 76 files: see `/tmp/ssot-full.txt` lines 521-541

---

## Roadmap (3 phases)

### Phase A — Quick wins (zero risk, ~1-2h)

**Goal**: cancel trivial wrappers, add critical SSoT to registry → block new duplicates immediately.

1. **Delete trivial wrappers** in `src/lib/obligations/utils.ts:35-37`:
   - `generateSectionId`, `generateArticleId`, `generateParagraphId`, `generateObligationId` — replace callers with direct import from `enterprise-id-convenience.ts`
2. **Add to `.ssot-registry.json`** (5 modules, P0):
   - `enterprise-id-convenience.ts` (127 exports)
   - `intl-formatting.ts` (formatDate, formatCurrency, sortByLocale)
   - `intl-domain.ts` (formatDateGreek, getCategoryLabel)
   - `date-local.ts` (toISOString replacement)
   - `design-system.ts` (getStatusColor canonical)
3. **Run** `npm run ssot:baseline` → snapshot current violations
4. **Commit** + update ADR-314 changelog

**Success criteria**: pre-commit hook now blocks NEW `formatDate`/`formatCurrency`/`generateSectionId` re-declarations in unrelated files.

### Phase B — Resolve SSoT conflicts (medium risk, ~3-4h)

**Goal**: Resolve cases where MULTIPLE files claim to be SSoT (status helpers).

**Sub-tasks**:
- B.1 — Decide canonical SSoT among `design-system.ts` / `obligations-utils.ts` / `project-utils.ts` for `getStatusColor` / `getStatusLabel` / `getStatusIcon`
  - Approach: discriminated union by domain (`PropertyStatus | ObligationStatus | LeadStatus`)
  - Move canonical impl to `lib/status-helpers.ts` (new module)
- B.2 — Migrate 9 callers of `getStatusColor` to canonical
- B.3 — Migrate 5 callers of `getStatusLabel` to canonical
- B.4 — Resolve `formatDateForDisplay` conflict (`intl-domain.ts` vs `utils/validation.ts`) → keep one
- B.5 — Resolve `getDaysUntilCompletion` conflict (`intl-domain.ts` vs `project-utils.ts`)
- B.6 — Add to registry as ratchet
- B.7 — Audit `subapps/dxf-viewer/overlays/types.ts` STATUS_COLORS/LABELS — likely legitimate alias, document

**Success criteria**: zero SSoT conflicts. Each symbol has exactly one declaring file.

### Phase C — Anti-pattern migration (309 files, ~6-8h, automatable)

**Goal**: Migrate scattered patterns to SSoT.

- **C.1** — `new Date().toISOString()` → `nowISO()` from `date-local.ts`
  - **Automation**: codemod script (jscodeshift or sed) — 309 files
  - **Strategy**: incremental commits per directory (api/, services/, components/, …)
  - **Pre-condition**: `nowISO()` function exists in `date-local.ts` (verify or add)
- **C.2** — `Timestamp.fromDate(new Date())` → helper `nowTimestamp()` in `date-local.ts` — 19 files
- **C.3** — Manual `.localeCompare` sorts → `sortByLocale()` from `intl-formatting.ts` — 42 files
- **C.4** — Hardcoded `entityType` literals → `ENTITY_TYPES.X` from `domain-constants.ts` — 23 files (already partially enforced via registry, expand baseline)
- **C.5** — Add all to registry, ratchet down

**Success criteria**: anti-pattern count → 0. Pre-commit blocks new occurrences.

---

## Architecture Principle (Google-style enforcement)

**The Critical Rule** (added to centralization workflow):

> 🚨 **Before centralizing module X, FIRST add it to `.ssot-registry.json` with baseline = current violations.**
>
> Then perform the migration. Ratchet decreases automatically. Any NEW scattered code of type X gets BLOCKED by pre-commit hook.

This prevents the "centralize → 6 months later, new scattered code reappears" anti-pattern observed in 96 of our current SSoT files.

**Workflow** (mandatory for all future centralization):
1. Identify candidate (e.g., `formatPhoneNumber` scattered in 8 files)
2. Create canonical impl in appropriate SSoT file
3. **Add to `.ssot-registry.json`** with baseline = 8 (BEFORE migration)
4. Run `npm run ssot:baseline` → freezes "8" as the number that can't grow
5. Migrate file by file → baseline ratchets 8→7→6→…→0
6. Update ADR + changelog

---

## Tools

### Existing
- `npm run ssot:discover` — full scan (~30s, generates 4-phase report)
- `npm run ssot:audit` — progress vs baseline
- `npm run ssot:baseline` — regenerate baseline
- `.ssot-registry.json` — module declarations
- `.ssot-violations-baseline.json` — frozen violation counts

### Future (recommended, not yet implemented)
- **jscpd** (MIT) — AST-aware copy-paste detector for semantic duplicates (catches the 30% that grep misses)
- **dependency-cruiser** (MIT) — `forbid` rules: e.g., "no file outside `services/X/` may import `firebase/firestore` directly"
- **ESLint custom rules** — preventive guards specific to our patterns (e.g., `no-direct-randomuuid`, `no-direct-toisostring`)

---

## Pending Work Tracker

Live checklist: `.claude-rules/ssot-discovery-pending.md`
- Phase A items + acceptance criteria
- Phase B items + sequencing
- Phase C items + automation strategy

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-18 | Initial findings dump from `npm run ssot:discover`. 74 duplicates, 5 anti-patterns, 96 registry gaps. Phase A/B/C roadmap defined. Baseline file created. |
| 2026-04-18 | **Phase A DONE.** (a) Deleted 4 trivial wrappers in `src/lib/obligations/utils.ts:35-38` (`generateSectionId`/`generateArticleId`/`generateParagraphId`/`generateObligationId`) — callers migrated to direct import from `@/services/enterprise-id-convenience`. Files updated: `utils.ts` (import + internal caller), `src/lib/obligations/index.ts` (barrel re-export now points to convenience, including `generateRandomId` alias), `src/types/obligations/factories.ts`. (b) 5 new SSoT modules added to `.ssot-registry.json` under new Tier 8 — `enterprise-id-convenience` (Tier 0, regex `(function\|const)\s+generate[A-Z][a-zA-Z]*Id\b`, allowlist covers sealed SSoT set + `useEnterpriseIds.ts` React-hook alias barrel + `server/lib/id-generation.ts` composite-key generators), `intl-formatting` (Tier 3, 12 named formatters), `intl-domain` (Tier 3, 14 named formatters), `date-local` (Tier 3, 7 named normalizers + 2 anti-patterns `new Date().toISOString()` and `Timestamp.fromDate(new Date(` ), `design-system` (Tier 3, 11 named helpers, allowlist covers canonical alias in `constants/domains/property-status-core.ts`). (c) `npm run ssot:baseline` → frozen at **637 violations / 390 files**. Module breakdown: date-local 529, intl-formatting 46, design-system 16, intl-domain 11, enterprise-id-convenience 9 (+ 36 from other pre-existing modules). (d) Pre-commit hook now BLOCKS any new `(function\|const)\s+generate*Id`, `formatDate`/`formatCurrency`/`sortByLocale`, `formatDateGreek`/`getCategoryLabel`/`formatDateForDisplay`, `getStatusColor`/`getStatusLabel` declarations, plus new `new Date().toISOString()` / `Timestamp.fromDate(new Date(` occurrences outside allowlist. Phase C.1 / C.2 codemods will ratchet down the 528 date-local violations. |
| 2026-04-18 | **Phase B DONE.** Resolved every domain status helper SSoT conflict identified in the discovery snapshot. (a) **Created canonical SSoT** `src/lib/status-helpers.ts` — discriminated-union API `getStatusColor(domain, status, opts?)` + `getStatusLabel(domain, status, opts?)` + `getStatusIcon(domain, status)` with exhaustive `StatusDomain` union (`storage`/`obligation`/`lead`/`communication`/`buildingTimeline`/`buildingProject`/`project`/`property`); per-domain typed status values; uses canonical `getEnhancedStatusColor`/`getEnhancedStatusLabel` from `property-status-core.ts` for the `property` domain (no duplication). (b) **Discovery clarification documented in code/comments**: `design-system.getStatusColor(token, variant)` is the SEMANTIC-TOKEN variant (success/error/info → CSS vars, ~50 callers) and remains canonical for that orthogonal namespace; the discriminated-union variant in status-helpers is canonical for DOMAIN status. The two are intentional, allowlisted together. (c) **Migrated real callers**: `OpportunityCard.tsx` (`getStatusColor('lead', stage, { colors })`), `useStorageTabState.ts` (`getStatusLabel('storage', s, { t })`), `TimelineTabContent/index.tsx` + `TimelineTabContent.tsx` (`getStatusColor('buildingTimeline', s, { colors })`), `LeadsList.tsx` (wrapped useCallback delegate). (d) **Deleted dead exports + dead files** (zero callers found via grep): `src/lib/project-utils.ts` (entire file — `getStatusColor`/`getStatusLabel`/`STATUS_COLORS`/`STATUS_LABELS`/`getProjectLabel`/`getProjectStatusColors`/`getProgressColor` + `getDaysUntilCompletion` wrapper, callers migrated to direct `@/lib/intl-utils`); `src/components/leads/utils/formatters.ts` (entire file); `src/components/projects/structure-tab/utils/status.ts` (entire file); `src/lib/obligations-utils.ts` lines 137-186 (status block + ObligationStatus type); `src/lib/intl-domain.ts` lines 154-178 (`getStatusLabel` — was hardcoding Greek/English, SOS N.11 violation); `src/components/building-management/StorageTab/utils.ts` (`getStatusColor`+`getStatusLabel` — migrated callers); `src/components/building-management/tabs/TimelineTabContent/utils.ts` (`getStatusColor` — migrated); `src/components/communications/utils/formatters.ts` (`getStatusColor`+`getStatusIcon` — were dead); `src/components/building-management/BuildingCard/BuildingCardUtils.ts` (rewrote — kept only `getCategoryIcon`, the rest were dead wrappers). (e) **B.4** — `src/utils/validation.ts` `formatDateForDisplay` re-export deleted (was alias of `intl-utils.formatDateForDisplay`, only consumer `UniversalClickableField.tsx` already imports the canonical). (f) **B.5** — `getDaysUntilCompletion` wrappers deleted in `project-utils.ts` and `BuildingCardUtils.ts`; callers `BuildingCardTimeline.tsx` + `ProjectCardTimeline.tsx` migrated to direct `@/lib/intl-utils`. (g) **B.7** — Documented legitimate aliases with `// SSoT alias — ADR-314 Phase B` comments in `subapps/dxf-viewer/overlays/types.ts` (STATUS_COLORS/LABELS), `services/ai-pipeline/shared/greek-text-utils.ts` (stripAccents/normalizeGreekText), `config/navigation.ts` (mainMenuItems/etc — clarified factory-instance pattern). (h) **Registry update**: new `status-helpers` Tier 3 module with EXPORT-only pattern `export\s+(function\|const)\s+(getStatusColor\|getStatusLabel\|getStatusIcon)\b` (allows component-internal helpers — they are not duplicate exports); removed `getStatusColor` from `design-system` pattern (now under status-helpers); allowlist covers canonical SSoT, design-system semantic alias, property-status-core alias. (i) `npm run ssot:baseline` → frozen at **622 violations / 378 files** (down from 637/390 in Phase A). Net Phase B reduction: 15 violations / 12 files. (j) tsc --noEmit → exit 0, no new type errors. |
| 2026-04-18 | **Phase C.1 (mostly DONE).** Anti-pattern migration `new Date().toISOString()` → `nowISO()` da `@/lib/date-local`. Codemod AST-aware idempotente `scripts/migrate-toisostring.mjs` (ts-morph). Applicato incrementalmente per directory con commit atomici: (a) `0387d6ab` communications status SSoT (api-layer indirect), (b) `3130dba4` Phase C.1.4b.1 ai-analysis/assignment/attendance/backup/brokerage, (c) `0096a966` Phase C.1.4b.2 src/lib/*, (d) `b3f5ad44` Phase C.1.4b.3 firestore converters + version-check + obligations. Batch 1 pending (Phase C.1.4c UI+misc: components 48 + subapps 44 + hooks/server/database/utils/config/types 22 + lib misc 3 + core 3 + features 2 + stores 2 = **125 file**; include 7 residui migrati da codemod re-run su `src/core/`, `src/features/`, `src/stores/`). Batch 2 pending (Phase C.1.4d services: 93 file escludendo 3 SSoT helpers). Exclusions codemod: `__tests__/`, `*.test.*`, `*.spec.*`, `*.d.ts`, `node_modules/`, `i18n/locales/`, `src/lib/date-local.ts` (allowlist). File altro agent esclusi: `PropertyFieldsReadOnly.tsx`, `company-document.service.ts`, `company-name-resolver.ts`, `contacts.service.ts`. Residui attesi: eventuali file saltati/generati da rivedere in Phase C.5 via `ssot:discover` re-run. |
| 2026-04-18 | **Phase C.2 DONE (top offenders).** Anti-pattern migration `Timestamp.fromDate(new Date())` → `nowTimestamp()`. Nuovo helper canonico `src/lib/firestore-now.ts` (client SDK, `firebase/firestore` Timestamp; separato da `date-local.ts` che è client-agnostic). Migrato top offender `services/session/EnterpriseSessionService.ts` (3×). Allowlist aggiornata in `.ssot-registry.json` modulo `date-local`: `src/lib/firestore-now.ts` come SSoT autorizzato. Batch 3 pending commit insieme a C.3. Residui ~14 file scattered da rilevare post `ssot:discover` re-run (Phase C.5) — probabile telegram/crm/store.ts, email-adapter.ts, UserNotificationSettingsService.ts, comms/orchestrator.ts non ancora toccati. |
| 2026-04-18 | **Phase C.3 DONE (top 5 migrated, 1 residuo).** Anti-pattern migration manual `.localeCompare` → `compareByLocale()` da SSoT `src/lib/intl-formatting.ts`. Migrati 4 di 5 top offenders: `lib/obligations/sorting.ts` (5x), `components/admin/role-management/components/UsersTab.tsx` (3x), `services/contact-relationships/adapters/FirestoreRelationshipAdapter.ts` (2x), `services/ai-pipeline/tools/esco-search-utils.ts` (2x). Residuo: `subapps/dxf-viewer/core/commands/overlay-commands/DeleteOverlayVertexCommand.ts` (2x) — TODO isolated da migrare in commit successivo (subapps isolation). Batch 3 pending commit. Totale `.localeCompare` migrati: 12×. |
| 2026-04-18 | **Phase C.4 BLOCKED — top 5 FALSI POSITIVI.** Anti-pattern migration hardcoded `entityType` literals → `ENTITY_TYPES.X`. **Analisi top 5 offenders**: `storage-path.ts` (2x) → tutte in JSDoc `@example`; `file-display-name.ts` (3x) → JSDoc `@example`; `entity-code.service.ts` (2x) → TypeScript type-union literals (`'property' \| 'parking' \| 'storage'`) in signature typing (type-level, non runtime); `EnterpriseHeaderActions.tsx` (2x) → JSDoc `@example` JSX; `EntityCodeField.tsx` (2x) → TypeScript type-union prop typing. **Zero runtime hardcoded assignments nei top 5** — scanner regex troppo permissivo cattura commenti JSDoc + type-level literals. **Decisione**: skip migrazione top 5. Action item: affinare regex in `scripts/ssot-discover.sh` per escludere linee in `/**...*/` blocks + TypeScript type-union contexts; re-run scanner post fix per vedere residui reali. Restanti 18 file valutare post scanner fix. |
| 2026-04-18 | **Phase C.3 residuo DONE.** Migrato ultimo top-5 offender `subapps/dxf-viewer/core/commands/overlay-commands/DeleteOverlayVertexCommand.ts` (2×`.localeCompare` → `compareByLocale`) con import da `@/lib/intl-formatting`. Aggiunto al Batch 3 SSoT helpers commit (file 7). **C.3 top 5 ora 100% complete.** Totale `.localeCompare` migrati: 14×. |
