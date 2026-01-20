# Quality Gates Remediation Plan

**Date**: 2026-01-18
**Status**: In Progress
**Related PR**: File Storage System Foundation

## Executive Summary

The lint and typecheck failures are **pre-existing technical debt** unrelated to the File Storage System changes. This document provides a remediation plan.

## Current State

| Gate | Status | Count | Category |
|------|--------|-------|----------|
| **npm run lint** | FAIL | ~995 issues | Design System + i18n migration |
| **npx tsc --noEmit** | FAIL | ~2716 errors | Type mismatches, missing properties |
| **npm test** | PASS | - | storage-path.test.ts passes |
| **npm run build** | PASS | - | Production build succeeds |

## Lint Error Categories

| Count | Rule | Category | Priority |
|-------|------|----------|----------|
| 657 | design-system/prefer-design-system-imports | Design System | Low |
| 330+ | design-system/enforce-semantic-colors | Design System | Low |
| 98 | react/self-closing-comp | Code Style | Low |
| 77+ | custom/no-hardcoded-strings | i18n Migration | Medium |
| 37 | no-useless-catch | Code Quality | Low |
| 30 | react/no-unescaped-entities | Code Style | Low |

**Key Insight**: 90%+ of lint errors are from custom ESLint rules for design system and i18n migration - NOT security or correctness issues.

## TypeScript Error Categories

| Category | Description | Priority |
|----------|-------------|----------|
| Canvas Adapters | DxfCanvasAdapter, GeoCanvasAdapter type mismatches | Medium |
| Polygon System | Missing design token exports | Low |
| Contact Form | Type incompatibilities (websites, addresses) | Medium |
| Various | Misc type errors across modules | Low |

## Waiver Request

### Justification

1. **File Storage System PR** focuses on security-critical storage rules
2. Lint/typecheck errors are **pre-existing** (not introduced by this PR)
3. Build passes (Next.js skips type checking in production)
4. Tests pass for File Storage functionality
5. Errors are primarily technical debt, not security risks

### Conditions for Waiver

- [x] Production build passes (`npm run build`)
- [x] Relevant tests pass (`storage-path.test.ts`)
- [x] Storage rules compile (`firebase deploy --dry-run`)
- [x] Security-critical code reviewed (storage.rules, file-record.service.ts)

## Remediation Roadmap

### Phase 1: Critical (Next Sprint)
- [ ] Fix TypeScript errors in canvas adapters (DxfCanvasAdapter, GeoCanvasAdapter)
- [ ] Fix contact form type incompatibilities

### Phase 2: Design System (Scheduled Migration)
- [ ] Migrate components to use design system imports
- [ ] Replace hardcoded colors with semantic functions

### Phase 3: i18n (Ongoing)
- [ ] Replace hardcoded strings with t() calls
- [ ] Already tracked in separate i18n migration project

### Phase 4: Code Quality (Low Priority)
- [ ] Fix self-closing components
- [ ] Remove useless try/catch wrappers
- [ ] Clean up unused variables

## Tracking

**Baseline Date**: 2026-01-18
**Initial Counts**:
- Lint issues: ~995
- TypeScript errors: ~2716

**Target** (End of Q1 2026):
- Reduce TypeScript errors by 50%
- Eliminate critical/security-related lint issues

## Approval

- [ ] Chief Manager Review: Waiver approved with remediation plan
- [ ] Remediation plan added to sprint backlog
