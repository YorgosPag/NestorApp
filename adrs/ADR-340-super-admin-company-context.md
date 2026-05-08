# ADR-340: Super Admin Company Context Switcher

**Status:** ✅ IMPLEMENTED  
**Date:** 2026-05-09  
**Domain:** Auth / UI / Tenant Management  

---

## Context

Super admin users (`globalRole === 'super_admin'`) have a null `companyId` in Firebase
claims, allowing cross-tenant API access. However, UI modules (CRM calendar, contacts,
projects) assume a non-null `companyId` from the resolver chain. Without an active
company selection, super admin operations produce orphaned documents or are blocked
by Firestore security rules.

---

## Decision

Implement a **global company context switcher** — Procore/Salesforce pattern:

1. `SuperAdminCompanyProvider` wraps the app (inside `AuthProvider`)
2. Loads `companies` collection on mount (super admin only)
3. Persists selection to `localStorage` (`super_admin_active_company_id`)
4. Auto-selects first company when no persisted selection exists
5. `CompanySwitcher` in `AppHeader` — visible only to super admin (amber badge)
6. `useCompanyId` consumes `activeCompanyId` as `selectedCompanyId` fallback

**Priority chain in `resolveCompanyId`:**
1. `building.companyId` — Firestore source of truth
2. `user.companyId` — user's own tenant (null for super admin)
3. `selectedCompanyId` ← **super admin active company injected here**

---

## Files

| File | Change |
|------|--------|
| `src/contexts/SuperAdminCompanyContext.tsx` | NEW — context + provider + hook |
| `src/components/header/CompanySwitcher.tsx` | NEW — header UI |
| `src/hooks/useCompanyId.ts` | MODIFIED — injects superAdminCompanyId |
| `src/components/app-header.tsx` | MODIFIED — adds CompanySwitcher |
| `src/app/layout.tsx` | MODIFIED — wraps with SuperAdminCompanyProvider |
| `src/i18n/locales/{el,en}/admin.json` | MODIFIED — companySwitcher keys |

---

## Consequences

- Regular users: zero impact (context provides `isSuperAdmin: false`, CompanySwitcher renders null)
- Super admin: must select a company before CRM operations work correctly
- Auto-selection of first company prevents forced-redirect complexity
- localStorage persistence survives page refresh

---

## Changelog

| Date | Version | Description |
|------|---------|-------------|
| 2026-05-09 | 1.0.0 | Initial implementation |
