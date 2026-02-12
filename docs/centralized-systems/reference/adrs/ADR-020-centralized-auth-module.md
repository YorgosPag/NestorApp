# ADR-020: Centralized Auth Module

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Security & Auth |
| **Canonical Location** | `src/auth/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `src/auth/` module
- **Deleted**: `FirebaseAuthContext.tsx`, `UserRoleContext.tsx`
- **Import**: `import { AuthProvider, useAuth } from '@/auth'`

### Changelog

| Date | Change |
|------|--------|
| 2026-02-12 | **CRITICAL FIX**: Removed `NODE_ENV === 'development'` bypass in `AdminGuard` (`src/app/dxf/viewer/page.tsx`). The guard was completely skipped in development mode. `useUserRole()` works correctly in both dev and prod — no bypass needed. |
