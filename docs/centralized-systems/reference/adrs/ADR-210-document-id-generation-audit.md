# ADR-210: Document ID Generation — Full Codebase Audit & Compliance Report

| Field | Value |
|-------|-------|
| **Status** | ✅ APPROVED — Phase 1 + P1/P2 IMPLEMENTED |
| **Date** | 2026-03-12 |
| **Category** | Security / Data Integrity |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Related ADRs** | ADR-017, ADR-031, ADR-065, ADR-209 |

---

## 1. Σκοπός

Πλήρης αναγνώριση και τεκμηρίωση του **κεντρικοποιημένου συστήματος δημιουργίας document IDs** στο Firestore. Εξέταση αν χρησιμοποιείται σε **όλα** τα σημεία της εφαρμογής ή αν υπάρχει διάσπαρτος κώδικας. Στόχος: **Google-grade enterprise consistency**.

### Scope Boundary με ADR-209

| Θέμα | ADR-210 (αυτό) | ADR-209 |
|------|----------------|---------|
| **Πώς δημιουργούνται** τα IDs (generation method, addDoc vs setDoc, enterprise service adoption) | ✅ Εδώ | ❌ |
| **Πώς χρησιμοποιούνται** τα IDs μετά τη δημιουργία (fallbacks, `!` assertions, type safety, `?? ''`) | ❌ | ✅ Εκεί |
| Inline `Date.now()` / `crypto.randomUUID()` violations | ✅ Εδώ | ❌ |
| Email σε Firestore doc keys (PII exposure) | 🔗 Cross-ref μόνο | ✅ Πλήρης κάλυψη στο ADR-209 Cat.B |

> **Κανόνας**: Αν ο agent που υλοποιεί ADR-210 βρει fallback values (`'unknown'`, `'system'`, `?? ''`) ή non-null assertions (`!`) σε IDs, **ΔΕΝ τα διορθώνει** — αυτά ανήκουν στο ADR-209.

---

## 2. Κεντρικοποιημένα Συστήματα ID Generation

Η εφαρμογή διαθέτει **2 συμπληρωματικά** centralized συστήματα:

### 2.1 Client-Side: Enterprise ID Service (UUID v4)

| Πεδίο | Τιμή |
|-------|------|
| **Αρχείο** | `src/services/enterprise-id.service.ts` |
| **Μέγεθος** | ~950 γραμμές |
| **Αλγόριθμος** | `crypto.randomUUID()` (CSPRNG) |
| **Entropy** | 128-bit (2^122 possible values) |
| **Format** | `{prefix}_{uuid-v4}` |
| **ADR** | ADR-017 |

**50+ εξειδικευμένοι generators ανά κατηγορία:**

| Κατηγορία | Prefix | Generator | Παράδειγμα |
|-----------|--------|-----------|------------|
| **Core Business** | | | |
| Company | `comp` | `generateCompanyId()` | `comp_a1b2c3d4-e5f6-4789-...` |
| Project | `proj` | `generateProjectId()` | `proj_a1b2c3d4-e5f6-4789-...` |
| Building | `bldg` | `generateBuildingId()` | `bldg_a1b2c3d4-e5f6-4789-...` |
| Unit | `unit` | `generateUnitId()` | `unit_a1b2c3d4-e5f6-4789-...` |
| Storage | `stor` | `generateStorageId()` | `stor_a1b2c3d4-e5f6-4789-...` |
| Parking | `park` | `generateParkingId()` | `park_a1b2c3d4-e5f6-4789-...` |
| Contact | `cont` | `generateContactId()` | `cont_a1b2c3d4-e5f6-4789-...` |
| Floor | `flr` | `generateFloorId()` | `flr_a1b2c3d4-e5f6-4789-...` |
| Document | `doc` | `generateDocumentId()` | `doc_a1b2c3d4-e5f6-4789-...` |
| **Legal** | | | |
| Obligation | `obl` | `generateObligationId()` | `obl_a1b2c3d4-e5f6-4789-...` |
| **Runtime** | | | |
| Session | `sess` | `generateSessionId()` | `sess_a1b2c3d4-e5f6-4789-...` |
| Task | `task` | `generateTaskId()` | `task_a1b2c3d4-e5f6-4789-...` |
| Event | `evt` | `generateEventId()` | `evt_a1b2c3d4-e5f6-4789-...` |
| Message | `msg` | `generateMessageId()` | `msg_a1b2c3d4-e5f6-4789-...` |
| **UI/CAD** | | | |
| Layer | `lyr` | `generateLayerId()` | `lyr_a1b2c3d4-e5f6-4789-...` |
| Entity | `ent` | `generateEntityId()` | `ent_a1b2c3d4-e5f6-4789-...` |
| **Accounting** | | | |
| Journal Entry | `je` | `generateJournalEntryId()` | `je_a1b2c3d4-e5f6-4789-...` |
| Invoice | `inv` | `generateInvoiceAccId()` | `inv_a1b2c3d4-e5f6-4789-...` |
| Bank Transaction | `btxn` | `generateBankTransactionId()` | `btxn_a1b2c3d4-e5f6-4789-...` |
| Fixed Asset | `fxa` | `generateFixedAssetId()` | `fxa_a1b2c3d4-e5f6-4789-...` |
| EFKA Payment | `efka` | `generateEfkaPaymentId()` | `efka_a1b2c3d4-e5f6-4789-...` |
| **Files** | | | |
| File | `file` | `generateFileId()` | `file_a1b2c3d4-e5f6-4789-...` |
| Photo | `photo` | `generatePhotoId()` | `photo_a1b2c3d4-e5f6-4789-...` |
| Share | `share` | `generateShareId()` | `share_a1b2c3d4-e5f6-4789-...` |
| **Temp** | | | |
| Optimistic | `opt` | `generateOptimisticId()` | `opt_a1b2c3d4-e5f6-4789-...` |
| Temporary | `tmp` | `generateTempId()` | `tmp_a1b2c3d4-e5f6-4789-...` |

**Βοηθητικά:**
- `validateEnterpriseId(id)` — Validation UUID v4 format
- `parseEnterpriseId(id)` — Extract prefix + UUID
- `getIdType(id)` — Get entity type from ID
- `isLegacyId(id)` — Detect non-UUID IDs

**React Hooks:** `src/hooks/useEnterpriseIds.ts`
- `useEnterpriseIdGeneration()` — Memoized generators
- `useIdValidation()` — Runtime validation
- `useIdResolution()` — Legacy-to-enterprise migration
- `useMigrationStatus()` — Track migration progress

**Migration Service:** `src/services/enterprise-id-migration.service.ts`
- 4 phases: LEGACY_ONLY → DUAL_SUPPORT → ENTERPRISE_PREFERRED → ENTERPRISE_ONLY
- Zero-downtime, backward compatible, rollback capable

---

### 2.2 Server-Side: SHA-256 Deterministic IDs

| Πεδίο | Τιμή |
|-------|------|
| **Αρχείο** | `src/server/lib/id-generation.ts` |
| **Μέγεθος** | ~192 γραμμές |
| **Αλγόριθμος** | SHA-256 (deterministic hashing) |
| **Entropy** | 96-bit (16 chars base64url) |
| **Format** | `{type}_{channel}_{sha256_hash}` |
| **ADR** | ADR-031 |
| **Περιορισμός** | Server-only (Node.js `crypto` module) |

**Generators:**

| Function | Format | Χρήση |
|----------|--------|-------|
| `generateConversationId(channel, userId)` | `conv_{channel}_{hash}` | Omnichannel conversations |
| `generateMessageDocId(channel, chatId, msgId)` | `msg_{channel}_{hash}` | Chat-scoped messages (Telegram) |
| `generateGlobalMessageDocId(channel, msgId)` | `msg_{channel}_{hash}` | Globally unique messages (Email) |
| `generateExternalIdentityId(provider, userId)` | `eid_{provider}_{hash}` | External identity mapping |
| `isValidDocumentId(id)` | boolean | Firestore ID validation |
| `validateIdGeneration()` | self-test | Development validation |

**Γιατί SHA-256 (και όχι UUID) στο server:**
- **Deterministic**: Ίδιο input = ίδιο output (idempotent processing)
- **No PII**: External user IDs hashάρονται (GDPR compliance)
- **Chat-scoped**: Telegram `message_id` + `chatId` = μοναδικότητα
- **Collision-resistant**: 2^96 possible values (96-bit truncation)

---

## 3. Πλήρης Χάρτης Συλλογών — ID Strategy ανά Collection

### 3.1 Collections με Custom Enterprise IDs (setDoc) ✅

| Collection | ID Generator | ID Format | Αρχείο |
|------------|-------------|-----------|--------|
| `accounting_journal_entries` | `generateJournalEntryId()` | `je_uuid` | `firestore-accounting-repository.ts` |
| `accounting_invoices` | `generateInvoiceAccId()` | `inv_uuid` | `firestore-accounting-repository.ts` |
| `accounting_bank_transactions` | `generateBankTransactionId()` | `btxn_uuid` | `firestore-accounting-repository.ts` |
| `accounting_fixed_assets` | `generateFixedAssetId()` | `fxa_uuid` | `firestore-accounting-repository.ts` |
| `accounting_depreciation_records` | `generateDepreciationId()` | `depr_uuid` | `firestore-accounting-repository.ts` |
| `accounting_efka_payments` | `generateEfkaPaymentId()` | `efka_uuid` | `firestore-accounting-repository.ts` |
| `accounting_import_batches` | `generateImportBatchId()` | `batch_uuid` | `firestore-accounting-repository.ts` |
| `conversations` | `generateConversationId()` | `conv_channel_hash` | `telegram/crm/store.ts` |
| `messages` (server) | `generateMessageDocId()` | `msg_channel_hash` | `telegram/crm/store.ts`, `email-inbound-service.ts` |
| `external_identities` | `generateExternalIdentityId()` | `eid_provider_hash` | `telegram/crm/store.ts` |
| `ai_chat_history` | Manual composite | `{channel}_{senderId}` | `chat-history-service.ts` | ⚠️ Email channel: PII σε doc key — βλ. **ADR-209 Cat.B** για remediation |
| `cadLayers` | `generateLayerId()` | `lyr_uuid` | `EnterpriseLayerStyleService.ts` |

### 3.2 Collections με Deterministic Compound Keys ✅ (Αποδεκτό)

| Collection | ID Pattern | Λογική | Αρχείο |
|------------|-----------|--------|--------|
| `accounting_settings` | `'company_profile'`, `'partners'` | Singleton documents | `firestore-accounting-repository.ts` |
| `settings` | `'app_settings'`, `'company'` | System singletons | Admin routes |
| `building_floorplans` | `building_floorplan_{buildingId}_{type}` | Deterministic compound key | `BuildingFloorplanService.ts` |
| `floor_floorplans` | `floor_floorplan_{buildingId}_{floorId}` | Deterministic compound key | `ReadOnlyMediaViewer.tsx` |
| `association_links` | `cl_{contactId}_{type}_{targetId}` | Relationship compound key | `association.service.ts` |
| `dxf_files` | Sanitized filename | Deterministic from filename | `dxf-firestore.service.ts` |

### 3.3 Collections Migrated to Enterprise IDs ✅ (2026-03-12)

| Collection | Generator | Migrated From |
|------------|-----------|---------------|
| `contacts` | `generateContactId()` | `addDoc` auto-ID |
| `units` | `generateUnitId()` | `addDoc` auto-ID |
| `tasks` | `generateTaskId()` | `addDoc` auto-ID |
| `opportunities` | `generateOpportunityId()` | `addDoc` auto-ID (2 files) |
| `obligations` | `generateObligationId()` | `addDoc` auto-ID |
| `obligation_transmittals` | `generateTransmittalId()` | `addDoc` auto-ID |
| `notifications` | `generateNotificationId()` | `addDoc` auto-ID |

### 3.4 Collections με Firestore Auto-Generated IDs (addDoc) ⚠️ — Remaining

| Collection | Αρχείο | Σχόλιο |
|------------|--------|--------|
| `communications` | `communications.service.ts:193` | Auto-ID (legacy) |
| `messages` (client) | `communications-client.service.ts:65`, `messageRouter.ts:240`, `orchestrator.ts:275` | Auto-ID (3 σημεία) |
| `file_comments` | `file-comment.service.ts:75` | Auto-ID |
| `file_shares` | `file-share.service.ts:151` | Auto-ID |
| `file_approvals` | `file-approval.service.ts:101` | Auto-ID |
| `file_folders` | `file-folder.service.ts:85` | Auto-ID |
| `file_audit_log` | `file-audit.service.ts:142` | Auto-ID |
| `document_templates` | `document-template.service.ts:99` | Auto-ID |
| `tasks` (CRM) | `TasksRepository.ts:80` | Auto-ID αντί `generateTaskId()` |
| `boq_items` | `boq-repository.ts:245,321` | Auto-ID (2 σημεία) |
| `bank_accounts` | `BankAccountsService.ts:295` | Auto-ID |
| `attendance_events` | `useAttendanceEvents.ts:179` | Auto-ID |
| `attendance_qr_tokens` | `qr-token-service.ts` | Auto-ID + HMAC token |
| `navigation_companies` | `navigation-companies.service.ts:44` | Auto-ID |
| `dxfViewerLevels` | `LevelsSystem.tsx:191` | Auto-ID |
| `dxf overlay items` | `overlay-store.tsx:137` | Auto-ID (subcollection) |

**Σύνολο: 24+ collections χρησιμοποιούν Firestore auto-IDs αντί Enterprise IDs.**

---

## 4. Violations — Διάσπαρτος Κώδικας ID Generation

### 4.1 CRITICAL: `Date.now()` για ID Generation

| # | Αρχείο | Γραμμή | Κώδικας | Κίνδυνος |
|---|--------|--------|---------|----------|
| V1 | `src/services/workspace.service.ts` | 319 | `` `ws_personal_${Date.now()}` `` | Collision risk (ms granularity), predictable |
| V2 | `src/services/workspace.service.ts` | 323 | `` `ws_${type}_${Date.now()}` `` | Collision risk, fallback path |
| V3 | `src/services/ai-pipeline/shared/admin-session.ts` | 156 | `` `unknown_${Date.now()}` `` | Collision risk, no audit trail |
| V4 | `src/app/api/units/final-solution/route.ts` | 128 | `` `temp_contact_${Date.now()}_${index}` `` | Predictable, non-enterprise |
| V5 | `src/app/test-upload/page.tsx` | 43 | `` `test_${Date.now()}_${file.name}` `` | Test-only, αλλά κακό pattern |

### 4.2 HIGH: Inline `crypto.randomUUID()` (Bypasses Enterprise Service)

| # | Αρχείο | Γραμμή | Κώδικας | Πρόβλημα |
|---|--------|--------|---------|----------|
| V6 | `src/types/project/address-helpers.ts` | 167 | `id: data.id \|\| crypto.randomUUID()` | Δεν περνά από enterprise service — no prefix, no audit |
| V7 | `src/types/project/address-helpers.ts` | 227 | `` `proj_${crypto.randomUUID()}` `` | Σωστό prefix αλλά inline — no collision detection, no audit |

### 4.3 HIGH: Hardcoded Sequential IDs

| # | Αρχείο | Γραμμή | Κώδικας | Πρόβλημα |
|---|--------|--------|---------|----------|
| V8 | `src/app/api/units/real-update/route.ts` | 100 | `` `real_contact_${index + 1}` `` | Sequential, guessable, non-unique across calls |

---

## 5. Αξιολόγηση Συμμόρφωσης

### 5.1 Βαθμολογία Κεντρικοποίησης

| Μέτρηση | Αποτέλεσμα | Στόχος |
|---------|------------|--------|
| **Collections με Enterprise IDs** | 19/36 (53%) | 100% |
| **Collections με Firestore Auto-IDs** | 17/36 (47%) | 0% |
| **Inline ID Generation Violations** | 0 instances (8 fixed) | 0 ✅ |
| **Server-side SHA-256 (σωστά)** | 4 generators | ✅ |
| **Deterministic compound keys (σωστά)** | 6 patterns | ✅ |

### 5.2 Σύγκριση με Google Enterprise Standards

| Κριτήριο | Google Standard | Τρέχουσα Κατάσταση | Βαθμός |
|----------|----------------|-------------------|---------|
| **Μοναδικότητα ID** | UUID v4 / SHA-256 | ✅ Centralized system exists | 🟡 70% |
| **Prefixed Namespacing** | Κάθε entity type = ξεχωριστό prefix | ✅ 50+ prefixes ορισμένα | 🟡 33% adopted |
| **Collision Detection** | Retry mechanism | ✅ Max 5 retries στο enterprise service | ✅ 100% (όπου χρησιμοποιείται) |
| **Audit Trail** | Logging σε dev mode | ✅ Development audit logging | ✅ 100% (όπου χρησιμοποιείται) |
| **PII Protection** | No PII σε document IDs | ✅ SHA-256 hashing server-side | 🟡 Partial — **ΕΩΣ ADR-209 Cat.B remediation** (email σε doc keys, fallback IDs, type safety) |
| **Determinism** | Idempotent server operations | ✅ SHA-256 server-side | ✅ 100% |
| **Predictability Prevention** | No `Date.now()`, no sequential | ✅ All 8 violations fixed | ✅ 100% |
| **Consistency** | Single format ανά collection | 🟡 53% enterprise IDs (P1+P2 done) | 🟡 53% |

**Συνολική Βαθμολογία: 78% Enterprise Compliance** (was 60%, +18% after Phase 1 + P1/P2)
**Στόχος: 100% (Zero inline ID generation, zero auto-IDs σε business entities)**

---

## 6. Remediation Plan — Φάσεις Διόρθωσης

### Phase 1: Εξάλειψη Violations (URGENT — 8 fixes)

**Στόχος**: Zero inline ID generation.

| # | Violation | Fix | Effort |
|---|-----------|-----|--------|
| V1 | `ws_personal_${Date.now()}` | `generateSessionId()` | S |
| V2 | `ws_${type}_${Date.now()}` | `generateSessionId()` | S |
| V3 | `unknown_${Date.now()}` | `generateTempId()` | S |
| V4 | `temp_contact_${Date.now()}_${index}` | `generateTempId()` | S |
| V5 | `test_${Date.now()}_${file.name}` | `generateTempId()` | S |
| V6 | `crypto.randomUUID()` | `generateProjectId()` or keep without prefix for address sub-IDs | S |
| V7 | `` `proj_${crypto.randomUUID()}` `` | `generateProjectId()` | S |
| V8 | `` `real_contact_${index + 1}` `` | `generateContactId()` | S |

### Phase 2: Migration — addDoc → setDoc + Enterprise IDs (INCREMENTAL)

**Στρατηγική**: Migrate-on-touch. Όταν αγγίζεται ένα service file, αντικατάσταση `addDoc()` → `setDoc(doc(collection, enterpriseId), data)`.

**Priority Order:**

| Priority | Collection | Service File | Generator |
|----------|-----------|--------------|-----------|
| 🔴 P1 | `contacts` | `contacts.service.ts` | `generateContactId()` |
| 🔴 P1 | `units` | `units.service.ts` | `generateUnitId()` |
| 🔴 P1 | `tasks` | `TasksRepository.ts` | `generateTaskId()` |
| 🟠 P2 | `opportunities` | `opportunities.service.ts` + client | `generateOpportunityId()` (create if needed) |
| 🟠 P2 | `obligations` | `InMemoryObligationsRepository.ts` | `generateObligationId()` |
| 🟠 P2 | `notifications` | `notificationService.ts` | `generateNotificationId()` |
| 🟡 P3 | `file_comments` | `file-comment.service.ts` | `generateDocumentId()` |
| 🟡 P3 | `file_shares` | `file-share.service.ts` | `generateShareId()` |
| 🟡 P3 | `file_approvals` | `file-approval.service.ts` | `generateDocumentId()` |
| 🟡 P3 | `file_folders` | `file-folder.service.ts` | `generateDocumentId()` |
| 🟡 P3 | `boq_items` | `boq-repository.ts` | New `generateBoqItemId()` |
| 🟢 P4 | `attendance_events` | `useAttendanceEvents.ts` | `generateEventId()` |
| 🟢 P4 | `bank_accounts` | `BankAccountsService.ts` | New `generateBankAccountId()` |
| 🟢 P4 | `document_templates` | `document-template.service.ts` | `generateTemplateId()` |
| ⚪ P5 | `navigation_companies` | `navigation-companies.service.ts` | Auto-ID OK (internal) |
| ⚪ P5 | `file_audit_log` | `file-audit.service.ts` | `generateAuditId()` |
| ⚪ P5 | `dxfViewerLevels` | `LevelsSystem.tsx` | `generateLayerId()` |

**Μετατροπή Pattern:**
```typescript
// ❌ ΠΡΙΝ (Firestore auto-ID)
const docRef = await addDoc(collection(db, COLLECTIONS.CONTACTS), contactData);
return docRef.id; // Random 20-char Firestore ID

// ✅ ΜΕΤΑ (Enterprise ID)
import { generateContactId } from '@/services/enterprise-id.service';

const id = generateContactId();
await setDoc(doc(db, COLLECTIONS.CONTACTS, id), { ...contactData, id });
return id; // cont_a1b2c3d4-e5f6-4789-90ab-cdef12345678
```

### Phase 3: Νέοι Generators (αν χρειάζονται)

Generators που **ΔΕΝ υπάρχουν** ακόμα στο `enterprise-id.service.ts` αλλά χρειάζονται:

| Generator | Prefix | Collection | Status |
|-----------|--------|------------|--------|
| ~~`generateOpportunityId()`~~ | `opp` | opportunities | ✅ Added 2026-03-12 |
| ~~`generateTransmittalId()`~~ | `xmit` | obligation_transmittals | ✅ Added 2026-03-12 |
| ~~`generateWorkspaceId()`~~ | `ws` | workspaces | ✅ Added 2026-03-12 |
| ~~`generateAddressId()`~~ | `addr` | address sub-IDs | ✅ Added 2026-03-12 |
| `generateBoqItemId()` | `boq` | boq_items | Pending (P3) |
| `generateBankAccountId()` | `bacc` | bank_accounts | Pending (P4) |
| `generateFolderId()` | `fold` | file_folders | Pending (P3) |
| `generateApprovalId()` | `appr` | file_approvals | Pending (P3) |
| `generateCommentId()` | `cmnt` | file_comments | Pending (P3) |

---

## 7. Αρχιτεκτονικές Αποφάσεις

### 7.1 Πότε χρησιμοποιούμε Enterprise ID (UUID v4)
- **Business entities** που αποθηκεύονται στο Firestore (contacts, projects, buildings, etc.)
- **Ephemeral entities** (sessions, tasks, events)
- **File operations** (comments, shares, approvals)
- **Accounting records** (invoices, journal entries, etc.)

### 7.2 Πότε χρησιμοποιούμε SHA-256 Deterministic IDs
- **Server-side** communications (conversations, messages, external identities)
- **Idempotent operations** (same input = same ID, webhook replay safety)
- **PII protection** (external user IDs hashed)

### 7.3 Πότε αποδεκτά τα Compound Keys
- **Singleton documents** (`accounting_settings/company_profile`)
- **Relationship keys** (`cl_{contactId}_{type}_{targetId}`)
- **Deterministic lookups** (`building_floorplan_{buildingId}_{type}`)

### 7.4 Πότε ΠΟΤΕ δεν χρησιμοποιούμε
- ❌ `Date.now()` — collision risk, predictable
- ❌ `Math.random()` — not crypto-secure (ADR-017)
- ❌ Sequential integers — guessable, security risk
- ❌ Inline `crypto.randomUUID()` — bypasses audit, no prefix
- ❌ Firestore auto-IDs σε business entities — inconsistent format

---

## 8. Σύνοψη Ευρημάτων

### Θετικά ✅
1. **Υπάρχει enterprise-grade κεντρικοποιημένο σύστημα** με 50+ generators
2. **Crypto-secure** (UUID v4 + SHA-256) — κανένα `Math.random()`
3. **Collision detection** με retry mechanism
4. **PII protection** στο server-side (SHA-256 hashing)
5. **Migration service** για zero-downtime transition
6. **React hooks** για εύκολη client-side χρήση
7. **Accounting subapp** χρησιμοποιεί πλήρως enterprise IDs ✅

### Αρνητικά ❌
1. **67% των collections** (24/36) χρησιμοποιούν ακόμα Firestore auto-IDs
2. **8 violations** διάσπαρτου inline ID generation (`Date.now()`, `crypto.randomUUID()`, sequential)
3. **Ασυνέπεια format**: Μερικά IDs = `cont_uuid`, άλλα = random 20-char Firestore strings
4. **Ελλιπής adoption**: Το σύστημα υπάρχει αλλά δεν χρησιμοποιείται παντού
5. **7 generators λείπουν** (opportunities, boq, bank accounts, folders, approvals, comments, transmittals)

### Κρίσιμο Συμπέρασμα

> Το **κεντρικοποιημένο σύστημα** (ADR-017) είναι **enterprise-grade** και σωστά σχεδιασμένο.
> Το πρόβλημα δεν είναι η ποιότητα του — αλλά η **ελλιπής υιοθέτηση** του.
>
> Χρειάζεται **incremental migration** (Phase 2) για να φτάσουμε 100% compliance.
> Στρατηγική: **Migrate-on-touch** — κάθε φορά που αγγίζεται ένα service file, αντικατάσταση `addDoc` → `setDoc` + enterprise ID.

---

## 9. Verification Commands

```bash
# Εύρεση Date.now() σε ID generation (πρέπει να είναι 0)
grep -rn "Date\.now()" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v "timestamp\|createdAt\|updatedAt\|expiresAt\|TTL\|Timestamp\|lastAction\|\.getTime"

# Εύρεση addDoc (πρέπει να μειώνεται σταδιακά)
grep -rn "addDoc(" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | wc -l

# Εύρεση inline crypto.randomUUID (πρέπει να είναι 0, εκτός enterprise-id.service.ts)
grep -rn "crypto\.randomUUID" src/ --include="*.ts" --include="*.tsx" | grep -v "enterprise-id"

# Verification: Enterprise ID service imports
grep -rn "from.*enterprise-id" src/ --include="*.ts" --include="*.tsx" | wc -l
```

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-12 | Initial full codebase audit — 36 collections, 8 violations, 24 addDoc patterns, remediation roadmap | Claude Code (Anthropic AI) |
| 2026-03-12 | **Phase 1 + P1/P2 IMPLEMENTED**: 4 new generators (ws, addr, opp, xmit), 8 violations fixed, 7 collections migrated addDoc→setDoc. Compliance: 33%→53% | Claude Code (Anthropic AI) |
| 2026-03-13 | **Phase 2: 6 core API endpoints migrated** — projects (.add→.doc(proj_).set + projectCode PRJ-xxx), buildings (bldg_), units (unit_), parking (park_), storages (stor_), contacts (cont_). All server-side entity creation now uses enterprise IDs. | Claude Code (Anthropic AI) |
