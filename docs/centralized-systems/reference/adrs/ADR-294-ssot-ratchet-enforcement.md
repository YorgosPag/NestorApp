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

### Modules (v1.0)
| Module | SSoT File | Pattern |
|--------|-----------|---------|
| firestore-collections | `src/config/firestore-collections.ts` | `.collection('hardcoded')` / `.doc('hardcoded')` |
| enterprise-id | `src/services/enterprise-id.service.ts` | `crypto.randomUUID()` |
| domain-constants | `src/config/domain-constants.ts` | Hardcoded `entityType`/`senderType` literals |
| intent-badge-utils | `src/components/admin/shared/intent-badge-utils.ts` | Re-declared badge functions |
| addDoc-prohibition | `src/services/enterprise-id.service.ts` | `addDoc()` usage |

### Ratchet Rules
1. Per-file violation count can only **decrease** (ratchet down)
2. New files (not in baseline) = **zero tolerance**
3. Existing legacy violations allowed until file is touched
4. Run `npm run ssot:baseline` after cleanup commits to persist lower counts

### Commands
- `npm run ssot:audit` — progress report vs baseline
- `npm run ssot:baseline` — regenerate baseline

### How to Add New Module
1. Add entry to `.ssot-registry.json` under `modules`
2. Run `npm run ssot:baseline` to capture current violations
3. Pre-commit hook will automatically enforce the new module

### Pre-commit Hook Integration
CHECK 3.7 in `.git/hooks/pre-commit` — after i18n checks (3.5, 3.6), before file size check (4).

## Baseline (2026-04-08)
- **92 files** with violations
- **137 total violations**
- Top module: `domain-constants` (122 violations)

## Changelog
| Date | Change |
|------|--------|
| 2026-04-08 | Initial implementation — 5 modules, 92 files baseline |
