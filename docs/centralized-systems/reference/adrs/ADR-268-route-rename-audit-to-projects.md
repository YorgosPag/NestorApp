# ADR-268: Route Rename /audit to /projects

## Status: ✅ IMPLEMENTED (2026-03-31)

## Context

Η σελίδα των Έργων (Projects) είχε URL path `/audit` αντί για `/projects`. Αυτό ήταν ιστορικό κατάλοιπο — το route δημιουργήθηκε ως `/audit` και δεν μετονομάστηκε ποτέ.

Όλα τα user-facing labels (sidebar, breadcrumbs, i18n) έγραφαν σωστά "Έργα/Projects", αλλά το URL παρέμενε `/audit`. Στο `smart-navigation-factory.ts` υπήρχε ειδικό mapping:

```typescript
'audit': 'projects'  // Special mapping to hide inconsistency
```

### Σημαντική διάκριση

Τα audit-trail, audit-logging, audit_logs (Firestore collections) είναι **εντελώς διαφορετικά συστήματα** και **ΔΕΝ επηρεάστηκαν** από αυτή την αλλαγή.

---

## Decision

Rename `/audit` → `/projects` σε όλα τα σημεία: folder structure, navigation config, links, router pushes, API routes.

**Γιατί:** Semantic consistency — το URL πρέπει να αντικατοπτρίζει το domain concept (Projects, όχι Audit).

---

## Changes (Commit: 0cc7c9ff)

### 1. Folder Renames

| Πριν | Μετά |
|------|------|
| `src/app/audit/` | `src/app/projects/` |
| `src/app/api/audit/bootstrap/` | `src/app/api/projects/bootstrap/` |

### 2. Navigation Config

| Αρχείο | Αλλαγή |
|--------|--------|
| `smart-navigation-factory.ts` | href `/audit` → `/projects` |
| `smart-navigation-factory.ts` | pathMappings `'audit':'projects'` → `'projects':'projects'` |
| `ContextualNavigationService.ts` | basePath `/audit` → `/projects` |

### 3. Links & Router Pushes

| Αρχείο | Αλλαγή |
|--------|--------|
| `QuickActionsStrip.tsx` | href `/audit` → `/projects` |
| `DashboardHome.tsx` | href `/audit` → `/projects` |
| `BuildingAddressesCard.tsx` | `router.push('/audit?...')` → `'/projects?...'` |
| `search-backfill/route.ts` | routeTemplate `/audit?...` → `/projects?...` |

### 4. API Routes Constant

| Αρχείο | Αλλαγή |
|--------|--------|
| `domain-constants.ts` | `API_ROUTES.AUDIT.BOOTSTRAP` → `API_ROUTES.PROJECTS_BOOTSTRAP.BOOTSTRAP` |
| `useNavigationData.ts` | Updated to use new key |

### 5. Component Renames & Comments

| Αρχείο | Αλλαγή |
|--------|--------|
| `error.tsx` | `AuditError` → `ProjectsError`, `@route /projects` |
| `bootstrap/route.ts` | `@module api/projects/bootstrap` |
| `NavigationBreadcrumb.tsx` | Updated comments |
| `useFirestoreProjects.ts` | Updated comments |
| `projectMappings.ts` | Updated comments |

### 6. Bootstrap SRP Split (Commit: a1bc52eb)

Το `bootstrap/route.ts` (513 γραμμές) χωρίστηκε σε 3 modules:

| Αρχείο | Ευθύνη | Γραμμές |
|--------|--------|---------|
| `route.ts` | HTTP handler, caching, response assembly | 176 |
| `bootstrap-helpers.ts` | Types (BootstrapCompany, BootstrapProject, BootstrapResponse) + document mapper | 74 |
| `bootstrap-queries.ts` | Firestore data-fetching (companies, projects, building counts) | 235 |

Επιπλέον:
- Comment fix: `audit:data:view` → `projects:projects:view` (line 14)
- Dead permission `audit:data:view` αφαιρέθηκε από `types.ts` + `roles.ts` (pending commit — types.ts >500 lines)

---

## What Did NOT Change (and MUST NOT change)

Τα ακόλουθα αρχεία/συστήματα χρησιμοποιούν τη λέξη "audit" με τη σημασία **audit trail / audit logging** και είναι εντελώς ανεξάρτητα:

- `src/components/shared/audit/ActivityTab.tsx` — audit trail component
- `src/types/audit-trail.ts` — audit trail types
- `src/config/audit-tracked-fields.ts` — tracking config
- `src/lib/auth/audit.ts` — audit event logging
- `src/services/ai-pipeline/audit-service.ts` — pipeline audit
- `src/app/api/audit-trail/` — audit trail API endpoints
- `src/app/api/admin/role-management/audit-log/` — admin audit logs
- Firestore collections: `audit_logs`, audit entries — ακέραιες

---

## Pending

Κανένα — όλες οι εκκρεμότητες ολοκληρώθηκαν.

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-31 | Initial implementation — route rename /audit → /projects | Claude + Γιώργος |
| 2026-03-31 | Comprehensive cleanup — 16 files with stale audit→projects references (cache keys, logger, function names, docs, scripts) | Claude + Γιώργος |
| 2026-03-31 | Final cleanup: split bootstrap/route.ts (SRP), fix comment audit:data:view→projects:projects:view, fix VERCEL_PRODUCTION_SETUP.md UI URL, remove dead permission audit:data:view from auth types/roles | Claude + Γιώργος |
