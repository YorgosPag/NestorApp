# ADR-314: SSoT Discovery Findings & Centralization Roadmap

## Status
📋 APPROVED — 2026-04-18 — Phase A pending

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
