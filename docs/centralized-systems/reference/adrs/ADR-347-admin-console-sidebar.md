# ADR-347: Admin Console Sidebar

**Status:** ACCEPTED  
**Date:** 2026-05-14  
**Author:** Giorgio Pagonis + Claude Code  

---

## Context

All `/admin/*` pages shared no common navigation. Users had no way to move between admin sections without editing the URL manually. The `/admin/users/claims-repair` page was effectively hidden. Each page existed as an isolated island.

## Decision

Add a Google Admin Console-style sidebar to the shared `src/app/admin/layout.tsx`. The sidebar is a client component (`AdminSidebar`) that receives an `isSuperAdmin` boolean derived server-side from `AdminContext`.

### Architecture

```
src/app/admin/layout.tsx          (Server Component — auth gate)
  └─ AdminSidebar (Client)        src/components/admin/layout/AdminSidebar.tsx
       ├─ Desktop: <aside> w-64, permanent, lg+ only
       └─ Mobile: <Sheet> drawer, hamburger trigger, hidden on lg+
```

### Role gating

`requireAdminForPage()` returns `AdminContext.role`. The layout passes `isSuperAdmin = role === 'super_admin'` to `AdminSidebar`. The sidebar filters `superAdminOnly` nav items client-side. Server-side auth gate already blocks non-admins entirely.

### Navigation structure

| Group | Route | Super-admin only |
|-------|-------|-----------------|
| User Management | `/admin/role-management` | No |
| User Management | `/admin/users/claims-repair` | **Yes** |
| Data & Audit | `/admin/audit-log` | No |
| Data & Audit | `/admin/backup` | No |
| System | `/admin/setup` | No |
| System | `/admin/database-update` | No |
| System | `/admin/enterprise-migration` | No |
| System | `/admin/search-backfill` | No |
| Communications | `/admin/ai-inbox` | No |
| Communications | `/admin/operator-inbox` | No |

### i18n

All labels in `src/i18n/locales/el/admin.json` and `en/admin.json` under the `sidebar` key. Zero hardcoded strings in TSX.

## GOL Checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | Proactive — sidebar created at layout level |
| 2 | Race condition possible? | No — role resolved server-side before render |
| 3 | Idempotent? | Yes — static nav config |
| 4 | Belt-and-suspenders? | Yes — server auth gate + client-side link hiding |
| 5 | SSoT? | Yes — one `AdminSidebar` component, `NAV_GROUPS` constant |
| 6 | Fire-and-forget or await? | Await — layout awaits `requireAdminForPage` |
| 7 | Who owns lifecycle? | `AdminLayout` owns sidebar, pages own content |

✅ Google-level: YES — server-derived role + client active state, zero extra round-trips

## Files Changed

- `src/app/admin/layout.tsx` — added sidebar shell, captures AdminContext
- `src/components/admin/layout/AdminSidebar.tsx` — new component (created)
- `src/i18n/locales/el/admin.json` — added `sidebar` section
- `src/i18n/locales/en/admin.json` — added `sidebar` section

## Consequences

- All `/admin/*` pages now have a shared sidebar navigation
- `claims-repair` is accessible to super_admin without URL knowledge
- Mobile users get a Sheet drawer via hamburger button
- Dev bypass returns `role: 'admin'` → `isSuperAdmin = false` in development (expected)

## Changelog

| Date | Change |
|------|--------|
| 2026-05-15 | Replaced hardcoded `bg-white`/`border-gray-200` with semantic Tailwind tokens (`bg-background`, `border-border`) in `AdminSidebar.tsx` and `AdminLayout` — dark mode compatible |
| 2026-05-14 | Initial implementation |
