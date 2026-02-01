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
