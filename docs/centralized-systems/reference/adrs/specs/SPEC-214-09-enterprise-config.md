# SPEC-214-09: Enterprise Config Services Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 9 |
| **Status** | PENDING |
| **Risk** | LOW |
| **Αρχεία** | 6 modified |
| **Depends On** | SPEC-214-01 |

---

## Στόχος

Migration Enterprise Configuration services. Αυτά ΗΔΗΔ χρησιμοποιούν tenantId filter ✅ — χαμηλό ρίσκο.

---

## Αρχεία προς Αλλαγή

### 1. `src/services/company/EnterpriseCompanySettingsService.ts`
- 3 queries, tenantId ✅

### 2. `src/services/filesystem/EnterpriseFileSystemService.ts`
- 2 queries, tenantId ✅

### 3. `src/services/layer/EnterpriseLayerStyleService.ts`
- 4+ queries (3 with tenantId), tenantId ✅

### 4. `src/services/polygon/EnterprisePolygonStyleService.ts`
- 2 queries, tenantId ✅

### 5. `src/services/user/EnterpriseUserPreferencesService.ts`
- 2 queries, tenantId ✅

### 6. `src/services/security/EnterpriseSecurityService.ts`
- 3 queries, tenantId ✅

---

## Ιδιαιτερότητα

Αυτά τα services χρησιμοποιούν `tenantId` (ΟΧΙ `companyId`). Ο `FirestoreQueryService` πρέπει να γνωρίζει ποιο field χρησιμοποιεί κάθε collection (βλ. SPEC-214-01, Tenant Field Detection).

---

## Verification Checklist

- [ ] Company settings load correctly
- [ ] Layer styles apply correctly
- [ ] Polygon styles apply correctly
- [ ] User preferences persist
- [ ] Security configs load
- [ ] Teams load
- [ ] `npx tsc --noEmit` clean
