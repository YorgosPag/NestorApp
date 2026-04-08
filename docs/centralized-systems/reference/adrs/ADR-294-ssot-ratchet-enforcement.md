# ADR-294: SSoT Ratchet Enforcement System

## Status
✅ IMPLEMENTED — 2026-04-08

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
CHECK 3.7 in `.git/hooks/pre-commit` — after i18n checks (3.5, 3.6), before file size check (4).

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
