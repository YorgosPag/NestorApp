# PR Documentation Index

**Status**: Active
**Last Updated**: 2026-01-29
**Maintainer**: Architecture Team

---

## Purpose

This directory contains documentation for all Pull Requests (PRs) in the security hardening and production readiness phases. Each PR follows the enterprise template with:

- What/Why/How tested
- Risk Assessment
- Rollback Plan
- Acceptance Criteria
- Local_Protocol Compliance

---

## PR Sequence

The PRs follow a strict dependency order:

```
PR-0 (Quality Gates) ────────────┐
                                 │
PR-1A (Tenant Isolation) ────────┼──→ PR-2 (Data Migration)
PR-1B (MFA Enforcement) ─────────┤
PR-1C (Rate Limiting) ───────────┘
                                 │
                                 ▼
                          PR-3 (Production Readiness)
                                 │
                                 ▼
                    Strategic Implementation PRs
```

---

## PR Status Dashboard

### Security Gate Phase (Current)

| PR | Title | Status | Blocker | Doc |
|----|-------|--------|---------|-----|
| **PR-0** | Quality Gates & CI | ✅ Ready | - | [PR-0-quality-gates.md](PR-0-quality-gates.md) |
| **PR-1A** | Firestore Tenant Isolation | ✅ Ready | BLOCKER #1 | [PR-1A-firestore-tenant-isolation.md](PR-1A-firestore-tenant-isolation.md) |
| **PR-1B** | MFA Enforcement | ✅ Ready | BLOCKER #2 | [PR-1B-mfa-enforcement.md](PR-1B-mfa-enforcement.md) |
| **PR-1C** | Rate Limiting | ✅ Ready | BLOCKER #3 | [PR-1C-rate-limiting.md](PR-1C-rate-limiting.md) |

### Data Migration Phase

| PR | Title | Status | Depends On | Doc |
|----|-------|--------|------------|-----|
| **PR-2** | Data Migration (companyId) | ⏳ Blocked | PR-1A, 1B, 1C | [PR-2-data-migration-companyId.md](PR-2-data-migration-companyId.md) |

### Production Readiness Phase

| PR | Title | Status | Depends On | Doc |
|----|-------|--------|------------|-----|
| **PR-3** | Production Readiness & Observability | 📝 Pending | PR-2 | TBD |

---

## Quality Gates (PR-0)

Every PR must pass these gates before merge:

| Gate | Command | Required |
|------|---------|----------|
| **Lint** | `pnpm lint` | ✅ YES |
| **TypeCheck** | `pnpm typecheck` | ✅ YES |
| **Unit Tests** | `pnpm test` | ✅ YES |
| **Build** | `pnpm build` | ✅ YES |
| **Firestore Rules Tests** | `pnpm test:firestore-rules` | For rules changes |

---

## Local_Protocol Compliance

Every PR must comply with Local_Protocol (CLAUDE.md):

| Rule | Check |
|------|-------|
| **ZERO `any`** | No TypeScript `any` types |
| **ZERO `as any`** | No type casting to `any` |
| **ZERO `@ts-ignore`** | No TypeScript ignores |
| **ZERO inline styles** | Use design tokens only |
| **ZERO duplicates** | Use centralized systems |
| **ZERO hardcoded values** | Use config/constants |

---

## PR Documentation Template

When creating a new PR doc, use this template:

```markdown
# PR-N: Title

**Status**: Draft | Ready | Merged
**Created**: YYYY-MM-DD
**Author**: Name

---

## What

Brief description of changes.

## Why

Business justification.

## How Tested

Testing methodology.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|

## Rollback Plan

Steps to revert if needed.

## Acceptance Criteria

- [ ] AC-1: ...
- [ ] AC-2: ...

## Local_Protocol Compliance

- [ ] No `any` types
- [ ] ...

## Files Changed

| File | Change |
|------|--------|
```

---

## Next Steps

1. **Immediate**: Merge PR-0 (Quality Gates)
2. **Next**: Complete PR-1A tests, then merge
3. **Then**: PR-1B (MFA), PR-1C (Rate Limiting)
4. **Finally**: PR-2 (Migration), PR-3 (Production)

---

## Related Documentation

- **Strategy Documents**: [docs/strategy/00-index.md](../strategy/00-index.md)
- **Architecture Review**: [docs/architecture-review/00-index.md](../architecture-review/00-index.md)
- **Centralized Systems**: [src/subapps/dxf-viewer/docs/centralized_systems.md](../../src/subapps/dxf-viewer/docs/centralized_systems.md)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial PR index |
