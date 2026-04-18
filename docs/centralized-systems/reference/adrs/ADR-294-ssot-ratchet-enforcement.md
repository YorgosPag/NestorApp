# ADR-294: SSoT Ratchet Enforcement System

## Status
✅ IMPLEMENTED — 2026-04-08

**Related:** ADR-299 (Ratchet Backlog Master Roadmap) — aggregated SSoT για όλα τα ratchets, συμπεριλαμβανομένου του SSoT ratchet που περιγράφεται εδώ. Οι συνολικές μετρήσεις και τα hour estimates διατηρούνται εκεί.

## Context
Η προστασία από scattered/duplicate κώδικα βασιζόταν μόνο σε CLAUDE.md κανόνες και μνήμη agent. Δεν υπήρχε automated enforcement — κάθε νέο session ή agent μπορούσε να γράψει duplicates χωρίς μπλοκάρισμα.

## Decision
Υλοποίηση SSoT Ratchet System — ίδιο pattern με i18n ratchet (ADR-i18n-ratchet) — για automated enforcement κεντρικοποιημένων modules.

## Architecture

### Files
| File | Purpose |
|------|---------|
| `.ssot-registry.json` | Machine-readable registry — modules, patterns, allowlists |
| `.ssot-violations-baseline.json` | Per-file violation counts (generated) |
| `.ssot-registry-flat.txt` | Intermediary for bash parsing (generated, gitignored) |
| `scripts/check-ssot-imports.sh` | Pre-commit ratchet enforcer |
| `scripts/generate-ssot-baseline.sh` | Baseline generator |
| `scripts/ssot-audit.sh` | Progress report |

### Modules (v3.0 — 40 modules, 6 tiers)

**Tier 0 — Core (5 modules):**
| Module | SSoT File | Pattern |
|--------|-----------|---------|
| firestore-collections | `src/config/firestore-collections.ts` | `.collection('hardcoded')` / `.doc('hardcoded')` |
| enterprise-id | `src/services/enterprise-id.service.ts` | `crypto.randomUUID()` |
| domain-constants | `src/config/domain-constants.ts` | Hardcoded `entityType`/`senderType` literals |
| intent-badge-utils | `src/components/admin/shared/intent-badge-utils.ts` | Re-declared badge functions |
| addDoc-prohibition | `src/services/enterprise-id.service.ts` | `addDoc()` usage |

**Tier 1 — Data Integrity (bypass = corruption):**
| Module | SSoT File | Pattern |
|--------|-----------|---------|
| tenant-company-id | `src/config/tenant.ts` | Hardcoded `comp_9c7c1a50` or legacy ID |
| deletion-registry | `src/config/deletion-registry.ts` | Re-declared `DELETION_REGISTRY` / `DependencyDef[]` |
| soft-delete-config | `src/lib/firestore/soft-delete-config.ts` | Re-declared `SOFT_DELETE_CONFIG` |
| entity-code-config | `src/config/entity-code-config.ts` | Re-declared `PROPERTY_TYPE_TO_CODE` / `PARKING_ZONE_TO_CODE` |

**Tier 2 — Security (bypass = vulnerability):**
| Module | SSoT File | Pattern |
|--------|-----------|---------|
| ai-role-access-matrix | `src/config/ai-role-access-matrix.ts` | Re-declared `AI_ROLE_ACCESS_MATRIX` / `RoleAccessConfig` |
| environment-security | `src/config/environment-security-config.ts` | Re-declared `ENVIRONMENT_SECURITY_CONFIG` |
| file-upload-limits | `src/config/file-upload-config.ts` | Re-declared `FILE_TYPE_CONFIG` |

**Tier 3 — Business Logic (bypass = inconsistency):**
| Module | SSoT File | Pattern |
|--------|-----------|---------|
| notification-events | `src/config/notification-events.ts` | Re-declared `NOTIFICATION_EVENT_TYPES` / `CHANNELS` / `SEVERITIES` |
| project-mutation-impact | `src/config/project-mutation-impact.ts` | Re-declared `PROJECT_MUTATION_*` |
| ai-pipeline-config | `src/config/ai-pipeline-config.ts` | Re-declared `PIPELINE_*_CONFIG` |
| feature-flags | `src/config/feature-flags.ts` | Re-declared `APP_FEATURE_FLAGS` |
| business-hours | `src/config/business-hours.ts` | Re-declared `BUSINESS_HOURS` |
| audit-tracked-fields | `src/config/audit-tracked-fields.ts` | Re-declared `*_TRACKED_FIELDS` |
| entity-audit-trail | `src/services/entity-audit.service.ts` | Direct writes to `entity_audit_trail` / duplicate `useEntityAudit` hook (ADR-195) |
| firestore-schema-map | `src/config/firestore-schema-map.ts` | Re-declared `FIRESTORE_SCHEMA_MAP` |

**Tier 4 — Enum/Status Constants, ADR-287 (bypass = inconsistency):**
| Module | SSoT File | Pattern |
|--------|-----------|---------|
| commercial-statuses | `src/constants/commercial-statuses.ts` | Re-declared `COMMERCIAL_STATUSES` / `LISTED_*` / `FINALIZED_*` |
| operational-statuses | `src/constants/operational-statuses.ts` | Re-declared `OPERATIONAL_STATUSES` / `IN_PROGRESS_*` |
| energy-classes | `src/constants/energy-classes.ts` | Re-declared `ENERGY_CLASSES` / `HIGH_EFFICIENCY_*` |
| building-types | `src/constants/building-types.ts` | Re-declared `BUILDING_TYPES` / `NON_RESIDENTIAL_*` |
| building-statuses | `src/constants/building-statuses.ts` | Re-declared `BUILDING_STATUSES` / `ACTIVE_*` / `IN_CONSTRUCTION_*` |
| project-statuses | `src/constants/project-statuses.ts` | Re-declared `PROJECT_STATUSES` / `ACTIVE_*` / `IN_PROGRESS_*` |
| project-types | `src/constants/project-types.ts` | Re-declared `PROJECT_TYPES` |
| priority-levels | `src/constants/priority-levels.ts` | Re-declared `PRIORITY_LEVELS` |
| renovation-statuses | `src/constants/renovation-statuses.ts` | Re-declared `RENOVATION_STATUSES` / `COMPLETED_*` |
| property-types | `src/constants/property-types.ts` | Re-declared `PROPERTY_TYPES` / `PROPERTY_TYPE_ALIASES` / `STANDALONE_*` |
| contact-types | `src/constants/contact-types.ts` | Re-declared `CONTACT_TYPES` / `CONTACT_TYPE_ALIASES` |
| entity-status-values | `src/constants/entity-status-values.ts` | Re-declared `ENTITY_STATUS` / `QUEUE_STATUS` |
| legal-phases | `src/constants/legal-phases.ts` | Re-declared `LEGAL_PHASES` / `PENDING_*` / `SIGNED_*` |
| greek-banks | `src/constants/greek-banks.ts` | Re-declared `GREEK_BANKS` / `GREEK_BANK_CODES` |
| triage-statuses | `src/constants/triage-statuses.ts` | Re-declared `TRIAGE_STATUSES` / `TRIAGE_STATUS_VALUES` |
| property-features-enterprise | `src/constants/property-features-enterprise.ts` | Re-declared `ORIENTATION_LABELS` / `VIEW_TYPE_LABELS` / `ENERGY_CLASS_*` |

**Tier 5 — Infrastructure (bypass = path inconsistency):**
| Module | SSoT File | Pattern |
|--------|-----------|---------|
| storage-path-construction | `src/services/upload/utils/storage-path.ts` | Hardcoded `companies/${...}` template literals |
| entity-creation-manual | `src/lib/firestore/entity-creation.service.ts` | Manual `createdBy: user.uid/auth.uid` assembly |

**Tier 6 — Config Consolidation (bypass = config drift):**
| Module | SSoT File | Pattern |
|--------|-----------|---------|
| search-index-config | `src/config/search-index-config.ts` | Re-declared `SEARCH_INDEX_CONFIG` |
| ai-analysis-config | `src/config/ai-analysis-config.ts` | Re-declared `AI_ANALYSIS_DEFAULTS` / `AI_COST_CONFIG` / schemas |
| admin-tool-definitions | `src/config/admin-tool-definitions.ts` | Re-declared `ADMIN_TOOL_DEFINITIONS` / `ADMIN_TOOL_SYSTEM_PROMPT` |
| persona-config | `src/config/persona-config.ts` | Re-declared `PERSONA_METADATA` / `PERSONA_SECTIONS` |

### Ratchet Rules
1. Per-file violation count can only **decrease** (ratchet down)
2. New files (not in baseline) = **zero tolerance**
3. Existing legacy violations allowed until file is touched
4. Run `npm run ssot:baseline` after cleanup commits to persist lower counts

### Commands
| Command | Purpose |
|---------|---------|
| `npm run ssot:audit` | Progress report vs baseline |
| `npm run ssot:baseline` | Regenerate baseline after cleanup |
| `npm run ssot:discover` | Discovery scanner — find duplicates, anti-patterns, registry gaps |

### How to Add New Module
1. Add entry to `.ssot-registry.json` under `modules`
2. Run `npm run ssot:baseline` to capture current violations
3. Pre-commit hook will automatically enforce the new module

### Pre-commit Hook Integration
CHECK 3.7 in `scripts/git-hooks/pre-commit` — after i18n checks (3.5, 3.6), before file size check (4).

**Hook distribution (ADR-279 Phase 9.2, 2026-04-11)**: The pre-commit pipeline
lives at `scripts/git-hooks/pre-commit` (tracked in git) and is activated on
every clone through the `prepare` npm lifecycle script, which calls
`scripts/install-hooks.sh` to run `git config core.hooksPath scripts/git-hooks`.
This replaces the previous untracked `.git/hooks/pre-commit` that could silently
drift between developers / agents / fresh clones. See ADR-279 changelog for the
full Defense in Depth rationale (Layer 1 tracked hook + Layer 2 CI mirror +
Layer 3 integration tests).

### Discovery Scanner (`scripts/ssot-discover.sh`)
Batch-optimized codebase scanner — 4 phases:
1. **Extract** exports from all centralized files (config/, utils/, lib/, services/)
2. **Cross-reference** for duplicate implementations (re-declared function names)
3. **Scan** for scattered anti-patterns (hardcoded collections, entityTypes, etc.)
4. **Gap analysis** — centralized files not yet in registry

## Codebase Metrics (2026-04-08)
- **5.195 αρχεία** `.ts` / `.tsx`
- **970.442 γραμμές κώδικα** (~1M lines)
- **130 centralized files** with **1.072 exports**
- Violation rate: **0.006%** (61 violations / 970K lines)

## Baseline (2026-04-09, v3.0)
- **51 files** with violations
- **61 total violations** across **40 modules**
- Module breakdown (top):
  - `domain-constants`: 29 violations (47.5%)
  - `entity-creation-manual`: 17 violations (27.9%)
  - `contact-types`: 4 violations (6.6%)
  - `tenant-company-id`: 2 violations (3.3%)
  - `storage-path-construction`: 2 violations (3.3%)
  - `property-features-enterprise`: 2 violations (3.3%)
  - 5 modules with 1 violation each (8.2%)
  - 29 modules with 0 violations — preventive protection

### ⚠️ Critical Fix: grep ERE Pattern Bug (v3.0)
GNU grep 3.0 ERE does **NOT** support `(?:...)` non-capturing groups.
The first alternative in every pattern was silently ignored.

**Impact**: v2.0 baseline (139 violations) was artificially high due to
broken patterns matching unrelated code. v3.0 baseline (61 violations)
uses `(...)` capturing groups — all patterns now work correctly.

**Rule**: ALL regex patterns in `.ssot-registry.json` MUST use `(...)`
capturing groups, NEVER `(?:...)`.

## Discovery Results (2026-04-08)
- **77 duplicate exports** (re-declared outside SSoT) — ~30-40 true positives, rest are same-name different-domain
- **6 scattered anti-patterns** detected
- **4/130** centralized files protected (registry coverage: 3%)
- Top anti-patterns: hardcoded entityType (84 files), `.localeCompare()` (37 files), `Timestamp.fromDate` (20 files)

## Changelog
| Date | Change |
|------|--------|
| 2026-04-08 | Initial implementation — 5 modules, 92 files baseline |
| 2026-04-08 | Added Discovery Scanner — 4-phase batch analysis, 77 duplicates found |
| 2026-04-08 | **v2.0** — Expanded from 5 → 20 modules (3 tiers: data integrity, security, business logic) |
| 2026-04-09 | **v3.0** — Expanded from 20 → 40 modules (6 tiers). Fixed critical grep ERE `(?:...)` bug. Added: 16 enum constants (Tier 4, ADR-287), storage-path + entity-creation (Tier 5), 4 config modules (Tier 6). Accurate baseline: 51 files, 61 violations |
| 2026-04-09 | **v3.1** — SSoT Violations Cleanup: 53 → 0 violations. Fixed comment filter bug in baseline/audit scripts (grep `-n` line numbers broke `^\s*\*` detection). 3 code fixes (search-index-config re-export, PROPERTY_TYPES/PRIORITY_LEVELS imports from SSoT). 28 files allowlisted (type annotations, migration scripts, client-side entity creation). |
| 2026-04-09 | **v3.2** — Registry expansion: 41 → 61 modules (Tier 7). Added 20 modules: firestore-field-constants, media-constants, file-upload-config, boq-categories, construction-templates, individual-config, photo-compression-config, procurement-units, environment-security-policies, legal-procedures-kb, payment-plan-templates, study-groups-config, versioning-config, toast-config, property-statuses-enterprise, role-mappings-config, address-config, company-config, geographic-config, auto-save-config. Fixed 4 FLOORPLAN_ACCEPT duplicates → import from SSoT. Baseline: 0 violations. |
| 2026-04-09 | **Collection Names SSoT** — 23 violations resolved: 15+ files migrated from hardcoded collection names → `COLLECTIONS.*` / `SUBCOLLECTIONS.*`. Includes banking-handler, booking-session, audit-core, vat-validation, floorplan routes, esco services, overlay store. Cloud Functions mirror created. Baseline updated. |
| 2026-04-09 | **Enterprise ID Enforcement** — Enhanced `addDoc-prohibition` module with 2 new patterns: `.add({` (Firebase Admin SDK) + `.collection().doc()` (auto-ID). Zero new violations found (codebase already clean). 2 false positives allowlisted (DXF overlay store). CLAUDE.md N.6 updated with pre-commit enforcement reference. |
| 2026-04-09 | **ICU Interpolation Enforcement** — New pre-commit check 3.9 (`check-icu-interpolation.sh`): blocks `{{var}}` in locale JSON files (must be `{var}` for i18next-icu). Bulk fix: 464 replacements across 60 files (el+en+pseudo). Baseline: 0 violations. CLAUDE.md N.11 updated. |
| 2026-04-10 | **Missing i18n Keys Check** — New pre-commit check 3.8 (`check-i18n-missing-keys.js`): verifies `t('key')` calls have matching entries in locale JSON. Detects namespace mismatch bugs. Baseline: 4762 legacy violations in 549 files (ratchet). CLAUDE.md N.11 updated. |
| 2026-04-11 | **Phase Β — Export Centralization** — New `export-file` SSoT module (Domain B) pointing to canonical `src/lib/exports/trigger-export-download.ts` (`triggerExportDownload` + `openBlobInNewTab`). Phase Β.1: 6 PDF sites migrated (2852dabb). Phase Β.3: 5 CSV/JSON sites migrated + `TransformationPreview` split into `TransformationPreview.geometry.ts` for 500-line SRP compliance (c28be7ff). Phase Β.4: 4 IFC/PNG/TXT sites migrated — ExportTab, PropertyViewerWithLayers, CanvasUtils, useTwoFactorEnrollment (c64b1b99). Baseline regenerated: 16 violations in 7 files (all Domain A — Firebase Storage user downloads). Remaining Domain A → `useFileDownload` hook migration deferred to Phase Γ. |
| 2026-04-11 | **Entity audit trail enforcement (ADR-195)** — New `entity-audit-trail` SSoT module (Tier 3) pointing to canonical `src/services/entity-audit.service.ts`. Forbids 3 bypass vectors: (1) direct `addDoc`/`setDoc`/`updateDoc` against `entity_audit_trail` (literal or `COLLECTIONS.ENTITY_AUDIT_TRAIL`), (2) inline `collection()` queries against the audit collection, (3) re-implementations of `useEntityAudit` hook. Allowlist: `entity-audit.service.ts`, `useEntityAudit.ts`, `src/app/api/audit-trail/`, `firestore-collections.ts`. Baseline zero — all existing usage goes through the canonical service. Prevents future agents from fragmenting the audit trail across parallel collections as Phase 6 extends coverage to public services and beyond. |
| 2026-04-11 | **Phase Γ — Export Centralization COMPLETE** 🎯 — Final 7 Domain A file-download sites migrated, `file-download` module baseline now **0 violations / 0 files**. **Γ.2** (e126f637): added `openRemoteUrlInNewTab(url)` helper in `trigger-export-download.ts` for preview "open in new tab" use cases (not downloads); migrated `FilePreviewPanel`, `InboxView`, `SharedFilePageContent` (preview sites) to the helper; migrated `VersionHistory` version download → `useFileDownload` hook; migrated `PurchaseOrderActions` PDF export + `AuditExport` CSV/JSON export → `triggerExportDownload` (Domain B). **Γ.3** (2c6b6472): `usePhotoPreviewState` migrated to hook-in-hook pattern — injects `useFileDownload` at top, delegates photo download to centralized proxy while preserving `FileNamingService` filename generation. Total SSoT export centralization (Phases Β + Γ): **21 sites → 0 violations**. Canonical SSoT files: `src/lib/exports/trigger-export-download.ts` (Domain B, generated exports) + `src/components/shared/files/hooks/useFileDownload.ts` (Domain A, Storage downloads). |
| 2026-04-11 | **firestore-realtime SSoT module introduced** (commit `7760e6d3`, ADR-195 Phase 8) — New ratchet module targeting direct `onSnapshot(` calls from `firebase/firestore` outside the canonical real-time layer. Pattern: `\bonSnapshot\s*\(`. Initial allowlist (later corrected — see next entry): `src/services/realtime/RealtimeService.ts` + `src/services/realtime/hooks/`. Motivation: Γιώργος reported that edits to contact `shortName` appeared instantly in the per-entity history tab but **not** in the global `/admin/audit-log` view — root cause was `useGlobalAuditTrail` missing RealtimeService subscription; the broader root cause was that no ratchet existed to prevent scattered `onSnapshot` introduction. Paired fix: `useGlobalAuditTrail.ts` subscribed to 23 entity events with 500ms-debounced refetch. Initial baseline (v3.2 + 1 module): **23 files / 26 violations** for the new module — all 22 legacy scattered callers + 1 count spike from `firestore-query.service.ts`. |
| 2026-04-11 | **Pre-commit hook distribution — now versioned (ADR-279 Phase 9.2)** (commits `f108f1b1` + `fbd4f473`). Structural fix to the ratchet enforcement architecture itself: the entire 846-line `pre-commit` pipeline (CHECK 3.0 Windows reserved names → CHECK 3.14 audit catalog parity, including the SSoT CHECK 3.7) was moved from the **untracked** `.git/hooks/pre-commit` to the **tracked** `scripts/git-hooks/pre-commit`. A new `scripts/install-hooks.sh` (~40 lines) is called from a fresh `prepare` npm lifecycle entry in `package.json` and runs `git config core.hooksPath scripts/git-hooks` on every `pnpm install` — so fresh clones activate the ratchet automatically with zero manual steps. **Why this was needed**: before this commit, any developer/agent on a fresh clone, or any commit made with `git commit --no-verify`, silently bypassed all 14 ratchet checks. The ADR-279 Phase 9.2 changelog has the full threat model. **Defense in Depth now in place**: Layer 1 = this tracked hook (local), Layer 2 = `.github/workflows/i18n-governance.yml` runs CHECK 3.13 + 3.14 on every PR (cannot be bypassed with `--no-verify`, blocks merge via branch protection), Layer 3 = `translate-field-value.integration.test.ts` integration test loading real Greek locale JSONs (20/20 pass). **Secondary fix**: the secret-detector block (Pattern 1-3 around line 690 of the hook) was self-triggering on the tracked copy because one of the grep patterns used to catch leaked PEM headers appears verbatim in the hook source — added a `scripts/git-hooks/**` skip at the top of the per-file loop. **Zero new dependencies**: chose `core.hooksPath` over husky/lefthook — no pnpm-lock churn, no new devDeps, native git feature used by Google/Chromium/LLVM. **Verification**: ran `git config --get core.hooksPath` → `scripts/git-hooks`; ran the integration test → 20/20 pass in 2.1s; committed through the new hook itself → all 14 checks executed successfully. |
| 2026-04-19 | **CHECK 3.18 added — SSoT Discover Ratchet (ADR-314)**. Closes the Google-level presubmit gap for *structural* duplicate detection: CHECK 3.7 only catches regressions of already-registered SSoT modules, but brand-new duplicate symbols + scattered anti-patterns escape until someone runs `npm run ssot:discover` manually (→ retroactive Phases C.5.1–C.5.21 cleanup). CHECK 3.18 wraps the existing `scripts/ssot-discover.sh` scanner with a baseline comparator (`scripts/check-ssot-discover-ratchet.js`) that blocks any raise of the three tracked totals: `duplicateExports`, `antiPatterns`, `unprotected`. Initial baseline: **46 duplicates / 5 anti-patterns / 91 registry gaps** (2026-04-19, post Phase C.5.21). **Defense in Depth (2 layers)**: Layer 1 = pre-commit smoke check (baseline file presence + JSON validity, ~0.2s) — full scan not feasible locally because scanner takes ~4 minutes on Windows Git Bash due to process-spawn overhead; Layer 2 = `.github/workflows/ssot-discover.yml` CI gate runs the full 4-phase scan on every PR against `src/**/*.{ts,tsx}` (~1-2 min on Linux runners), blocks merge via branch protection, cannot be bypassed with `git commit --no-verify`. **Local full-scan override**: `SSOT_DISCOVER_FULL=1 git commit …`. **New files**: `scripts/check-ssot-discover-ratchet.js`, `.ssot-discover-baseline.json`, `.github/workflows/ssot-discover.yml`. **Modified**: `scripts/git-hooks/pre-commit` (CHECK 3.18 block after 3.17, before 3.19), `package.json` (`ssot:discover:baseline`, `ssot:discover:check`), `CLAUDE.md` (N.12 bullet), `docs/centralized-systems/reference/precommit-checks.md` (table row + §3.18 detail), `adrs/ADR-299-ratchet-backlog-master-roadmap.md` (§2.2 backlog + §4 tracker). **Remediation ladder**: (1) centralize pattern into existing SSoT, (2) register new module in `.ssot-registry.json` + `ssot:baseline`, (3) refresh via `npm run ssot:discover:baseline` for legitimate cleanup debt only. |
| 2026-04-11 | **firestore-realtime v2 — allowlist correction + first ratchet-down** (commit `0c5df00a`, ADR-195 Phase 2A). Exploration for the legacy migration phase revealed that the Phase 8 allowlist **missed** `src/services/firestore/firestore-query.service.ts` (ADR-214 Unified Firestore Query Layer) — the 3 `onSnapshot(` call sites inside it (lines 261, 308, 360) are framework internals implementing `subscribe`/`subscribeDoc`/`subscribeSubcollection` with automatic tenant filtering, NOT violations. The canonical `useRealtimeBuildings.ts:144` and `useRealtimeProperties.ts` hooks call `firestoreQueryService.subscribe()` internally — architectural hierarchy is `firestoreQueryService` = **primary** (tenant-aware), `RealtimeService` = **secondary** (event bus + raw wrapping). **Fix #1**: Added `src/services/firestore/firestore-query.service.ts` to the `firestore-realtime` allowlist; rewrote module `description` to explicitly name both canonical layers and declare `firestoreQueryService` as the preferred migration target because it auto-injects `companyId`/`tenantId` filters. **Fix #2 — first ratchet-down migration**: `src/hooks/useLegalContracts.ts` migrated from raw `onSnapshot(query(collection(db, COLLECTIONS.BROKERAGE_AGREEMENTS), where('companyId','==',companyId), where('projectId','==',projectId)))` to `firestoreQueryService.subscribe<DocumentData>('BROKERAGE_AGREEMENTS', onData, onError, { constraints: [where('projectId','==',projectId)] })`. The `companyId` constraint was removed because `BROKERAGE_AGREEMENTS` has default tenant mode → service auto-injects it via `buildTenantConstraints()`. **Baseline**: `firestore-realtime` module ratcheted from **23 files / 26 violations** → **21 files / 22 violations** (-2 files / -4 violations: -3 from allowlist correction removing the spurious count on `firestore-query.service.ts`, -1 from the `useLegalContracts` migration). Serves as the **reference migration pattern** for the remaining 21 legacy scattered callers (Phase 2B+): (1) swap imports to `firestoreQueryService` + `QueryResult`, (2) remove `companyId` where clauses for default-tenant collections, (3) call `firestoreQueryService.subscribe<DocumentData>(KEY, onData, onError, { constraints: [...] })`, (4) map `result.documents`. Subcollection-backed hooks (e.g. `useFloorOverlays.ts` — 2-step waterfall over `dxf_overlay_levels` subcollection) are explicitly deferred to Phase 2C until the orchestration layer is extended. |
