# SPEC-214-09: Enterprise Config Services Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 9 |
| **Status** | COMPLETED |
| **Risk** | LOW |
| **Αρχεία** | 9 modified (6 services + 1 context + 2 infrastructure) |
| **Depends On** | SPEC-214-01 |
| **Completed** | 2026-03-13 |

---

## Στόχος

Migration Enterprise Configuration services. Αυτά ΗΔΗ χρησιμοποιούν tenantId filter — χαμηλό ρίσκο.

---

## Αρχεία που Άλλαξαν

### Infrastructure
1. `src/config/firestore-collections.ts` — +3 keys: SECURITY_ROLES, EMAIL_DOMAIN_POLICIES, COUNTRY_SECURITY_POLICIES
2. `src/services/firestore/tenant-config.ts` — +3 entries (mode: 'none')

### Services Migrated
3. `src/services/company/EnterpriseCompanySettingsService.ts` — 4 queries migrated, 1 raw setDoc kept (merge)
4. `src/services/filesystem/EnterpriseFileSystemService.ts` — 1 query migrated, 1 raw setDoc kept (merge)
5. `src/services/layer/EnterpriseLayerStyleService.ts` — 6 queries migrated (3 getAll + 2 create + 1 update), fully migrated
6. `src/services/polygon/EnterprisePolygonStyleService.ts` — 3 queries migrated (1 getAll + 1 create + 1 update), fully migrated
7. `src/services/user/EnterpriseUserPreferencesService.ts` — 3 queries migrated, 1 raw setDoc kept (merge)
8. `src/services/security/EnterpriseSecurityService.ts` — 3 queries migrated, removed initialize/ensureInitialized/getDb pattern
9. `src/auth/contexts/UserRoleContext.tsx` — Removed securityService.initialize(db) + securityInitialized state

---

## Ιδιαιτερότητα

- All queries use `tenantOverride: 'skip'` since services manage manual `tenantId`/`environment` constraints
- `setDoc` with `{ merge: true }` kept as raw — `firestoreQueryService.create()` does not support merge
- SecurityService architecture simplified: no more manual Firestore initialization

---

## Verification Checklist

- [x] Company settings load correctly
- [x] Layer styles apply correctly
- [x] Polygon styles apply correctly
- [x] User preferences persist
- [x] Security configs load
- [x] UserRoleContext works without initialize()
- [x] `npx tsc --noEmit` — verified via Vercel build
