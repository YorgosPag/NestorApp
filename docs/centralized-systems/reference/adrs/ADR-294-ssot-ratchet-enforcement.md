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

### Modules (v2.0 — 20 modules, 3 tiers)

**Original (v1.0):**
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
- Violation rate: **0.014%** (137 violations / 970K lines)

## Baseline (2026-04-08, v2.0)
- **93 files** with violations
- **139 total violations** across **20 modules**
- Module breakdown:
  - `domain-constants`: 122 violations (87.8%)
  - `firestore-collections`: 13 violations (9.4%)
  - `tenant-company-id`: 2 violations (1.4%)
  - `enterprise-id`: 2 violations (1.4%)
  - All other 16 modules: 0 violations (preventive protection)

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
