# SPEC-214-05: Communication Services Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 5 |
| **Status** | PENDING |
| **Risk** | LOW |
| **Αρχεία** | 3-4 modified |
| **Depends On** | SPEC-214-01 |

---

## Στόχος

Migration communication services (notifications, messages, conversations). Χαμηλό ρίσκο γιατί τα patterns είναι απλά.

---

## Αρχεία προς Αλλαγή

### 1. `src/services/notificationService.ts`

**Τρέχουσα κατάσταση**: 2 queries + 1 onSnapshot, userId filter ✅, enterprise IDs ✅ (ADR-210)

**Αλλαγή**: `fetchNotifications()` + `subscribeToNotifications()` → queryService

### 2. `src/services/communications.service.ts`

**Τρέχουσα κατάσταση**: 6 where clauses, companyId filter ✅

**Αλλαγή**: Standard migration.

### 3. `src/services/communications/inbound/email-inbound-service.ts`

**Τρέχουσα κατάσταση**: Company-scoped queries

**Αλλαγή**: Standard migration.

### 4. `src/lib/communications/core/messageRouter.ts`

**Τρέχουσα κατάσταση**: Message recording

**Αλλαγή**: Replace addDoc if still present (check ADR-210 status).

---

## Verification Checklist

- [ ] Notifications panel loads correctly
- [ ] Real-time notifications work (onSnapshot)
- [ ] Mark as read works
- [ ] Dismiss works
- [ ] Email pipeline unaffected
- [ ] Telegram pipeline unaffected
- [ ] `npx tsc --noEmit` clean
