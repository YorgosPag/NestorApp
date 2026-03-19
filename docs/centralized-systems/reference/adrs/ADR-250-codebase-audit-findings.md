# ADR-250: Codebase Audit Findings — Security, Indexes, Centralization

| Metadata | Value |
|----------|-------|
| **Status** | PARTIALLY IMPLEMENTED (P0 fixes done) |
| **Date** | 2026-03-19 |
| **Category** | Infrastructure / Security / Data Integrity |
| **Type** | AUDIT (documentation-only — zero code changes) |
| **Trigger** | Post-SPEC-245B3 comprehensive codebase scan |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Αφορμή

Μετά την ολοκλήρωση του **SPEC-245B3** (κεντρικοποίηση hardcoded strings — doc IDs, field names, status values σε 92 αρχεία), έγινε **δεύτερη καθολική σάρωση** του codebase για να εντοπιστούν **ΟΛΑ** τα εναπομείναντα προβλήματα. Αυτό το ADR τεκμηριώνει τα ευρήματα **χωρίς καμία αλλαγή κώδικα**.

### Σχετικά ADRs/SPECs

| ADR/SPEC | Τίτλος | Σχέση |
|----------|--------|-------|
| SPEC-245B3 | Centralize Hardcoded Strings | Trigger — ολοκληρώθηκε, τώρα τι μένει |
| ADR-210 | Document ID Audit | Collection names centralization |
| ADR-245 | API Routes Centralization | Zero hardcoded endpoints |
| ADR-249 | Server-Side Integrity Audit | Παράλληλο audit — entity relationships |
| ADR-247 | Entity Relationship Integrity Guards | Implemented guards |

---

## 2. Ολοκληρωμένα (SPEC-245B3 + Predecessors)

| Κατηγορία | Κατάσταση | Commit/ADR |
|-----------|-----------|------------|
| Collection Names | ✅ 100% κεντρικοποιημένα | ADR-210 |
| API Routes | ✅ 100% κεντρικοποιημένα | ADR-245 |
| Firestore Field Names | ✅ Top 14 fields (80% coverage) | SPEC-245B3 |
| Document IDs | ✅ 100% via enterprise-id.service | SPEC-245B3 |
| Status Values (Queue/Entity) | ✅ Core domains | SPEC-245B3 |
| Event Names | ✅ 100% | Pre-existing (notification-events.ts) |

---

## 3. Κρίσιμα Security Bugs

### S-1: Units query χωρίς companyId filter

| Field | Value |
|-------|-------|
| **Αρχείο** | `src/services/financial-intelligence/portfolio-aggregator.ts` |
| **Γραμμές** | 137–140 |
| **Κίνδυνος** | 🔴 **CRITICAL** — Data isolation breach |
| **Κατάσταση** | ✅ **FIXED** (2026-03-19) |

**Πρόβλημα:** Η query για units φιλτράρει ΜΟΝΟ με `projectId`, χωρίς `companyId`.

**Fix:** Πρόσθεση `.where(FIELDS.COMPANY_ID, '==', companyId)` στη units query. Ο `companyId` ήδη υπάρχει ως παράμετρος της `aggregatePortfolio()`.

---

### S-2: getProjectGeofence() χωρίς tenant validation

| Field | Value |
|-------|-------|
| **Αρχείο** | `src/services/attendance/attendance-server-service.ts` |
| **Γραμμές** | 115–127 |
| **Κίνδυνος** | 🔴 **CRITICAL** — Security bypass |
| **Κατάσταση** | ✅ **FIXED** (2026-03-19) |

**Πρόβλημα:** Η function δέχεται μόνο `projectId` χωρίς tenant validation.

**Fix (2 σημεία):**
1. `getProjectGeofence()` — accepts optional pre-fetched `projectData`, validates `companyId` exists (orphan detection), logs warning if missing
2. `processQrCheckIn()` — reads project doc ONCE early, validates existence + `companyId`, passes data to `getProjectGeofence()` (no duplicate read), propagates `companyId` to attendance event

---

## 4. Σιωπηλά Firestore Bugs

### F-1: Missing composite index — email queue

| Field | Value |
|-------|-------|
| **Αρχείο** | `src/services/communications/inbound/email-queue-service.ts` |
| **Γραμμές** | 461–469 |
| **Κατάσταση** | ✅ **ΗΔΗΗ RESOLVED** — Index deployed (ADR-071) |

Composite index `(status ASC, createdAt ASC)` on `email_ingestion_queue`. Είναι ήδη deployed μέσω `firestore.indexes.json` και τεκμηριωμένο στο ADR-071 Production Incident Report. **Δεν απαιτείται ενέργεια.**

---

### F-2: Missing composite index — telegram unit search

| Field | Value |
|-------|-------|
| **Αρχείο** | `src/app/api/communications/webhooks/telegram/search/repo.ts` |
| **Γραμμές** | 63–70 |
| **Κίνδυνος** | 🟠 **HIGH** — Silent empty results |
| **Κατάσταση** | ✅ **FIXED** (2026-03-19) — Indexes added |

**Πρόβλημα:** Compound query `where(status) + where(type) + orderBy(price)` χωρίς composite indexes.

**Fix:** Πρόσθεση 2 composite indexes στο `firestore.indexes.json`:
- `units: (status ASC, price ASC)` — χωρίς type filter
- `units: (status ASC, type ASC, price ASC)` — με type filter

**Σημείωση:** Telegram search είναι intentionally public (δεν χρειάζεται companyId). Deploy: `firebase deploy --only firestore:indexes --project pagonis-87766`.

---

## 5. Εκκρεμείς Κεντρικοποιήσεις

### C-1: Pagination Defaults

| Field | Value |
|-------|-------|
| **Εύρος** | 95+ `.limit()` calls σε 40+ αρχεία, **9 διαφορετικές τιμές** |
| **Κίνδυνος** | 🔴 Unbounded reads (missing limits) + inconsistency |
| **Προτεραιότητα** | ΥΨΗΛΗ |

**Τρέχουσα κατάσταση:** Pagination limits scattered: `10`, `20`, `25`, `30`, `50`, `100`, `200`, `500`, `1000`. Δεν υπάρχει centralized config.

**Προτεινόμενη λύση:** Νέο config αρχείο `src/config/pagination-config.ts` με:
- `PAGE_SIZE.DEFAULT` (25)
- `PAGE_SIZE.TABLE` (50)
- `PAGE_SIZE.DROPDOWN` (100)
- `PAGE_SIZE.EXPORT` (500)
- `PAGE_SIZE.MAX` (1000)

---

### C-2: Role Strings

| Field | Value |
|-------|-------|
| **Εύρος** | **408 hardcoded** role strings σε **176 αρχεία** |
| **Κίνδυνος** | 🟠 Typo = broken RBAC |
| **Προτεραιότητα** | ΥΨΗΛΗ |

**Τρέχουσα κατάσταση:** Strings όπως `'admin'`, `'manager'`, `'employee'`, `'viewer'` scattered παντού.

**Προτεινόμενη λύση:** `src/config/roles.ts` → `ROLES.ADMIN`, `ROLES.MANAGER`, etc. (ίδιο pattern με FIELDS).

---

### C-3: Omnichannel Channel Strings

| Field | Value |
|-------|-------|
| **Εύρος** | `'telegram'`/`'whatsapp'`/`'email'` σκόρπια σε **148 αρχεία** |
| **Κίνδυνος** | 🟡 Inconsistency |
| **Προτεραιότητα** | ΜΕΣΑΙΑ |

**Προτεινόμενη λύση:** Extend υπάρχον `notification-events.ts` ή νέο `src/config/channels.ts`.

---

### C-4: Storage Paths (legacy)

| Field | Value |
|-------|-------|
| **Εύρος** | 6 hardcoded `'contacts/photos'` paths |
| **Κίνδυνος** | 🟡 Inconsistency |
| **Προτεραιότητα** | ΧΑΜΗΛΗ |

Υπάρχει ήδη `STORAGE_PATHS` config αλλά 6 legacy references δεν χρησιμοποιούν.

---

### C-5: Env Vars Validation

| Field | Value |
|-------|-------|
| **Εύρος** | **1,046** `process.env.X` χωρίς startup check |
| **Κίνδυνος** | 🟡 Silent `undefined` στο runtime |
| **Προτεραιότητα** | ΧΑΜΗΛΗ |

**Προτεινόμενη λύση:** Zod-based env validation στο startup (ήδη pattern σε πολλά Next.js projects).

---

## 6. Αρχιτεκτονικές Ασυνέπειες

### A-1: Timestamp field names

**4 ονόματα, ίδια σημασία:**
- `createdAt` (κυρίαρχο — 80%)
- `timestamp` (παλαιά modules)
- `lastUpdated` (μερικά entities)
- `timestampIso` (telegram pipeline)

**Σημείωση:** Η κεντρικοποίηση απαιτεί migration strategy λόγω Firestore backward compatibility.

---

### A-2: Soft-delete patterns

**3 διαφορετικά patterns:**
1. `isDeleted: true` (boolean flag) — κύριο pattern
2. `status: 'archived'` — σε κάποια entities
3. Hard delete — σε helper/temporary collections

**Σημείωση:** Ενοποίηση χρειάζεται ADR-level decision (ποιο pattern κερδίζει).

---

### A-3: Date formats

**Κύριο pattern:** `toISOString()` (90%+ coverage)
**Exceptions:** 3 custom `formatDate()` implementations σε legacy modules

**Σημείωση:** Χαμηλή προτεραιότητα — λειτουργεί, απλά inconsistent.

---

## 7. Προτεινόμενη Σειρά Υλοποίησης

| Προτεραιότητα | Εργασία | Εκτίμηση Effort | Εξάρτηση |
|---------------|---------|-----------------|-----------|
| **P0** | Security bugs S-1, S-2 | 2-3 γραμμές η κάθε μία | Καμία |
| **P0** | Firestore index F-2 | `firebase deploy --only firestore:indexes` | Καμία |
| **P1** | Pagination defaults C-1 | Νέο config + 40+ αρχεία migration | Καμία |
| **P1** | Role constants C-2 | Νέο config + 176 αρχεία migration | Καμία |
| **P2** | Omnichannel channels C-3 | Extend existing config + 148 αρχεία | Μετά C-2 |
| **P3** | Storage paths C-4 | 6 αρχεία migration | Καμία |
| **P3** | Env validation C-5 | Νέο startup check | Καμία |
| **P3** | Timestamp unification A-1 | Firestore migration required | ADR decision |
| **P3** | Soft-delete unification A-2 | Firestore migration required | ADR decision |

---

## 8. Changelog

| Date | Change |
|------|--------|
| 2026-03-19 | Initial documentation — audit findings from post-SPEC-245B3 scan |
| 2026-03-19 | **P0 fixes**: S-1 (companyId filter on units query), S-2 (tenant validation in geofence + processQrCheckIn), F-2 (2 composite indexes for telegram search) |
