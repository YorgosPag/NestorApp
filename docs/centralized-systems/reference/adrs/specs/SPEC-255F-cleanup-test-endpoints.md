# SPEC-255F: Cleanup Test Endpoints

> **Parent**: [ADR-255](../ADR-255-security-hardening-phase-4.md)
> **Priority**: P0 (IMMEDIATE)
> **Effort**: 0.5h
> **Status**: 📋 PLANNED

---

## Problem

Diagnostic/test endpoint exists in production without authentication:

| Endpoint | File | Risk |
|----------|------|------|
| `GET /api/test-alert` | `src/app/api/test-alert/route.ts` | Exposes env var prefixes, unprotected |

This endpoint was created during Telegram alert debugging (commits `f7dcb48f`, `741009b5`) and should have been removed after testing.

---

## Action Required

**Delete the entire file**: `src/app/api/test-alert/route.ts`

No migration needed. No references from other code.

---

## Verification Steps

1. `grep -r "test-alert" src/` — Confirm no references
2. Delete the file
3. Verify build passes

---

## Acceptance Criteria

- [ ] `src/app/api/test-alert/route.ts` deleted
- [ ] No references to `/api/test-alert` remain in codebase
- [ ] Build passes
- [ ] Aligns with ADR-062 (No Debug Endpoints in Production)

---

## Related

- **ADR-062**: No Debug/Admin Analysis Endpoints in Production
- **Commits**: `f7dcb48f` (test: add direct sendTelegramAlert call), `741009b5` (test: diagnostic endpoint)
