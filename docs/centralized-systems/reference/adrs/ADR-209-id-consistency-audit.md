# ADR-209: ID Consistency Audit & Remediation Roadmap

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED (Phases 1-4) |
| **Date** | 2026-03-12 |
| **Category** | Security / Data Integrity |
| **Author** | Claude Agent |

## Context

Μετά την επιτυχημένη κεντρικοποίηση του `companyId` (ADR-201), πραγματοποιήθηκε **εκτεταμένο audit σε ΟΛΑ τα ID fields** της εφαρμογής. Σκοπός ήταν να εντοπιστούν ασυνέπειες, fallbacks, type mismatches, και security gaps πριν αυτά φτάσουν σε production.

### Σχέσεις με Υπάρχοντα ADRs

| ADR | Σχέση |
|-----|-------|
| **ADR-017** | Enterprise ID Generation — Ορίζει πώς δημιουργούνται IDs |
| **ADR-201** | CompanyId Resolver — Κεντρικοποίηση companyId, αφετηρία αυτού του audit |
| **ADR-063** | Company Isolation via Custom Claims — Tenant isolation model |
| **ADR-206** | Phase 5 — Math.random migration → `generateEnterpriseId()` |

---

## Findings Overview

| Category | Severity | Instances | Κεφάλαιο |
|----------|----------|-----------|-----------|
| A: Fallback IDs στο Firestore | 🔴 CRITICAL | 11+ | [View](#category-a-fallback-ids-στο-firestore-critical) |
| B: Email ως userId | 🔴 CRITICAL | 6 | [View](#category-b-email-ως-userid-critical) |
| C: Non-null Assertions (!) σε IDs | 🔴 CRITICAL | 35+ | [View](#category-c-non-null-assertions--σε-ids-critical) |
| D: Type Assertions (as string) χωρίς Validation | 🟠 HIGH | 6+ | [View](#category-d-type-assertions-as-string-χωρίς-validation-high) |
| E: projectId String/Number Σύγχυση | 🟠 HIGH | 4 routes | [View](#category-e-projectid-stringnumber-σύγχυση-high) |
| F: Empty String Defaults | 🟠 HIGH | 10+ | [View](#category-f-empty-string-defaults-high) |
| G: Telegram ID Conversions | 🟢 LOW | Consistent ✅ | [View](#category-g-telegram-id-conversions-low) |

---

## Category A: Fallback IDs στο Firestore (CRITICAL)

**Πρόβλημα**: Fallback τιμές (`'unknown'`, `'system'`, `'anonymous'`, `'GLOBAL_ACCESS'`) γράφονται στο Firestore, καταστρέφοντας audit trails και data integrity.

### A1: `'unknown'` Fallbacks — Firestore Writes

| # | File | Line | Code | Field | Collection |
|---|------|------|------|-------|------------|
| 1 | `src/subapps/dxf-viewer/overlays/overlay-store.tsx` | 129 | `createdBy: user?.uid ?? 'unknown',` | createdBy | overlays |
| 2 | `src/subapps/dxf-viewer/overlays/overlay-store.tsx` | 195 | `createdBy: overlay.createdBy \|\| user?.uid \|\| 'unknown',` | createdBy | overlays |
| 3 | `src/app/api/communications/webhooks/telegram/message/process-message.ts` | 27 | `const userId = message.from?.id?.toString() \|\| 'unknown';` | userId | logging |
| 4 | `src/database/migrations/003_enterprise_database_architecture_consolidation.ts` | 220 | `entityId: sourceData.entityId \|\| sourceData.buildingId \|\| ... \|\| 'unknown',` | entityId | consolidated DB |
| 5 | `src/database/migrations/003_enterprise_database_architecture_consolidation.ts` | 339 | `entityId: sourceData.entityId \|\| sourceData.projectId \|\| 'unknown',` | entityId | consolidated DB |
| 6 | `src/services/file-record/file-record-core.ts` | 469 | `entityLabel: \`...${input.source.chatId \|\| 'unknown'}\`` | entityLabel | files |
| 7 | `src/subapps/dxf-viewer/snapping/engines/shared/snap-engine-utils.ts` | 262 | `entityId: entity.id \|\| 'unknown',` | entityId | snap results (non-persisted) |
| 8 | `src/app/api/relationships/create/route.ts` | 65, 77, 181 | `entityId: parentId \|\| 'unknown'` | entityId | error responses only |
| 9 | `src/app/api/contacts/[contactId]/units/route.ts` | 205, 209 | `String(unit.buildingId \|\| 'unknown')` | buildingId, projectId | response mapping |

**Κρίσιμα** (γράφονται στο Firestore): #1, #2, #4, #5
**Μέτρια** (logging/responses): #3, #6, #7, #8, #9

### A2: `'system'` ως userId — Χωρίς Proper System Identity

| # | File | Line | Code | Context |
|---|------|------|------|---------|
| 1 | `src/services/security/EnterpriseSecurityService.ts` | 835, 853, 871 | `createdBy: 'system'` | Policy creation |
| 2 | `src/services/contact-relationships/core/RelationshipCRUDService.ts` | 165-166 | `createdBy: data.createdBy \|\| 'system'` | Relationship creation |
| 3 | `src/services/contact-relationships/core/RelationshipCRUDService.ts` | 298 | `changedBy: updates.lastModifiedBy \|\| 'system'` | Relationship update |
| 4 | `src/services/teams/EnterpriseTeamsService.ts` | 522, 729 | `updatedBy: 'system'` | Team updates |
| 5 | `src/services/polygon/EnterprisePolygonStyleService.ts` | 569, 591, 613 | `createdBy: 'system'` | Polygon styles |
| 6 | `src/services/obligations/InMemoryObligationsRepository.ts` | 393, 499, 546, 555 | `changedBy: 'system'` | Obligation updates |
| 7 | `src/services/file-record/file-record-core.ts` | 466 | `createdBy: 'system:ingestion'` | File ingestion |

**Αξιολόγηση**: Τα #1, #4, #5, #7 είναι **intentional system actions** αλλά χρησιμοποιούν magic string αντί για centralized `SYSTEM_USER_ID` constant. Τα #2, #3, #6 είναι **fallbacks** που κρύβουν missing user context.

### A3: `'GLOBAL_ACCESS'` — Logging Only (OK)

| # | File | Line | Code |
|---|------|------|------|
| 1 | `src/services/communications.service.ts` | 304 | `companyId: companyId \|\| 'GLOBAL_ACCESS',` |
| 2 | `src/services/communications.service.ts` | 313 | `companyId: companyId \|\| 'GLOBAL_ACCESS',` |
| 3 | `src/services/communications.service.ts` | 341 | `companyId: companyId \|\| 'GLOBAL_ACCESS',` |
| 4 | `src/services/communications.service.ts` | 402 | `companyId: companyId \|\| 'GLOBAL_ACCESS',` |

**Αξιολόγηση**: Χρησιμοποιούνται **μόνο για logging**, ΔΕΝ γράφονται στο Firestore. Αποδεκτό pattern αλλά θα ωφελούνταν από constant.

### A4: `'anonymous'` — GeoCanvas

| # | File | Line | Code |
|---|------|------|------|
| 1 | `src/subapps/geo-canvas/app/GeoCanvasContent.tsx` | 160 | `const userId = user?.email \|\| 'anonymous';` |

**Αξιολόγηση**: Χρησιμοποιεί **email** αντί uid ΚΑΙ fallback σε `'anonymous'`. Διπλό πρόβλημα — βλ. Category B.

---

## Category B: Email ως userId (CRITICAL)

**Πρόβλημα**: Σε ορισμένα σημεία χρησιμοποιείται `user.email` αντί `user.uid` ως identifier. Αυτό είναι ασφαλιστικό ρίσκο (emails αλλάζουν, expose PII) και δημιουργεί inconsistent document keys.

### B1: Email ως Firestore Document Key

| # | File | Line | Code | Impact |
|---|------|------|------|--------|
| 1 | `src/services/ai-pipeline/chat-history-service.ts` | 74 | `db.collection(COLLECTION_NAME).doc(channelSenderId)` | Για email channel: `email_user@example.com` → **invalid Firestore doc ID** (@ character) |
| 2 | `src/services/ai-pipeline/shared/admin-session.ts` | 150-151 | `return \`email_${sender.email}\`;` | Session key: `email_user@example.com` |

**Severity**: CRITICAL — Firestore doc IDs δεν πρέπει να περιέχουν `@` character. Πιθανό runtime error.

### B2: Email σε Audit/Identity Fields

| # | File | Line | Code | Impact |
|---|------|------|------|--------|
| 3 | `src/services/ai-pipeline/audit-service.ts` | 54-56 | `initiatedBy: ctx.intake.normalized.sender.email ?? ctx.intake.normalized.sender.name ?? 'unknown',` | PII exposure σε audit records |
| 4 | `src/subapps/geo-canvas/app/GeoCanvasContent.tsx` | 160 | `const userId = user?.email \|\| 'anonymous';` | Email ως userId στο GeoCanvas |

### B3: Email σε Channel Sender ID Pattern

| # | File | Line | Code | Impact |
|---|------|------|------|--------|
| 5 | `src/services/ai-pipeline/feedback-service.ts` | 50 | `channelSenderId: string; // Format: "email_user@example.com"` | Email exposed στο composite key |
| 6 | `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | 38 | `channelSenderId` usage | Propagates email-based key |

**Remediation**: Για email channel, χρησιμοποίησε hash ή sanitized version: `email_${hashEmail(sender.email)}` ή `email_${sender.email.replace(/[^a-zA-Z0-9]/g, '_')}`.

---

## Category C: Non-null Assertions (!) σε IDs (CRITICAL)

**Πρόβλημα**: Non-null assertion (`!`) σε ID fields σημαίνει ότι αν ποτέ το ID είναι undefined/null, ο κώδικας θα γράψει `undefined` στο Firestore ή θα κρασάρει.

### C1: High-Risk (Service/API Layer)

| # | File | Line | Code |
|---|------|------|------|
| 1 | `src/services/communications/inbound/email-inbound-service.ts` | 678 | `tenantId: routing.companyId!,` |
| 2 | `src/services/integrations/EmailIntegration.ts` | 173 | `const template = this.getTemplate(message.templateId!);` |
| 3 | `src/services/photo-upload.service.ts` | 219 | `contactId: options.contactId!,` |
| 4 | `src/services/photo-upload.service.ts` | 220 | `companyId: options.companyId!,` |
| 5 | `src/app/api/accounting/setup/presets/route.ts` | 114 | `presetId: p.presetId!,` |
| 6 | `src/app/api/buildings/fix-project-ids/route.ts` | 53 | `targetProjectId: targetProjectId!,` |
| 7 | `src/services/projects/services/ProjectsService.ts` | 110, 113 | `contactId: contact.id!,` / `customerUnitCount[contact.id!]` |
| 8 | `src/services/contact-relationships/bulk/ImportExportService.ts` | 414 | `sourceContactId: sourceContact.id!,` |
| 9 | `src/services/contact-relationships/hierarchy/DepartmentManagementService.ts` | 97, 143, 172, 207, 244 | Multiple `.id!` assertions (5x) |

### C2: Medium-Risk (UI/Hook Layer)

| # | File | Line | Code |
|---|------|------|------|
| 10 | `src/components/navigation/core/ContextualNavigationHandler.tsx` | 82 | `navigation.selectProject(params.projectId!);` |
| 11 | `src/subapps/dxf-viewer/app/DxfViewerContent.tsx` | 850 | `universalSelection.get(primarySelectedId!);` |
| 12 | `src/subapps/dxf-viewer/core/commands/AuditTrail.ts` | 96 | `e.affectedEntities.includes(filter.entityId!)` |
| 13 | `src/subapps/dxf-viewer/hooks/grips/grip-commit-adapters.ts` | 352, 359 | `grip.overlayId!` (2x) |
| 14 | `src/subapps/dxf-viewer/hooks/grips/useUnifiedGripInteraction.ts` | 400, 411, 476, 481, 687, 700 | `.overlayId!` / `.entityId!` (6x) |
| 15 | `src/subapps/dxf-viewer/rendering/hitTesting/HitTester.ts` | 459, 485 | `id: entity.id!,` (2x) |
| 16 | `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx` | 231 | `loadProjectsForCompany(company.id!);` |
| 17 | `src/components/contacts/ContactsPageContent.tsx` | 413, 439, 846 | `selectedContact.id!` (3x) |
| 18 | `src/components/contacts/relationships/hooks/useRelationshipForm.ts` | 349 | `relationship.id!` |
| 19 | `src/components/projects/tabs/ProjectMeasurementsTab.tsx` | 172 | `projectId: project.id!,` |
| 20 | `src/app/obligations/new/page.tsx` | 186, 189 | `mapping.set(company.id!, company.id!);` |

**Σύνολο**: 35+ non-null assertions σε ID fields.

**Remediation**: Αντικατάσταση `id!` → early return guard ή explicit validation:
```typescript
// ❌ Πριν
contactId: options.contactId!,

// ✅ Μετά
if (!options.contactId) throw new Error('contactId is required');
contactId: options.contactId,
```

---

## Category D: Type Assertions (as string) χωρίς Validation (HIGH)

**Πρόβλημα**: `as string` σε Firestore data reads χωρίς runtime validation. Αν η τιμή είναι `number` ή `undefined`, το `as string` δεν θα σπάσει αλλά θα δώσει λάθος τύπο.

| # | File | Line | Code |
|---|------|------|------|
| 1 | `src/services/measurements/boq-repository.ts` | 90 | `companyId: (data.companyId as string) ?? '',` |
| 2 | `src/services/measurements/boq-repository.ts` | 136 | `companyId: (data.companyId as string) ?? '',` |
| 3 | `src/utils/contactForm/fieldMappers/companyMapper.ts` | 138 | `municipalityId as string \| null` |
| 4 | `src/utils/contactForm/fieldMappers/companyMapper.ts` | 144 | `settlementId as string \| null` |

**Remediation**: Χρήση runtime validation:
```typescript
// ❌ Πριν
companyId: (data.companyId as string) ?? '',

// ✅ Μετά
companyId: typeof data.companyId === 'string' ? data.companyId : '',
```

---

## Category E: projectId String/Number Σύγχυση (HIGH)

**Πρόβλημα**: Μερικά API routes μεταχειρίζονται το `projectId` ως number (`parseInt`, `Number()`), ενώ η εφαρμογή αλλού το χρησιμοποιεί ως string. Αυτό δημιουργεί Firestore query mismatches.

| # | File | Line | Code | Conversion |
|---|------|------|------|------------|
| 1 | `src/app/api/projects/structure/[projectId]/route.ts` | 126-129 | `.where('projectId', '==', parseInt(projectId))` | `parseInt()` |
| 2 | `src/app/api/projects/[projectId]/customers/route.ts` | 97 | `.where('projectId', '==', parseInt(projectId))` | `parseInt()` |
| 3 | `src/app/api/buildings/route.ts` | 64-66 | `.where('projectId', '==', Number(projectId))` | `Number()` |
| 4 | `src/app/api/floors/route.ts` | 97 | `const projectIdValue = isNaN(Number(projectId)) ? projectId : Number(projectId)` | Conditional |

**Root Cause**: Legacy data στο Firestore μπορεί να έχει `projectId` ως number (παλιό migration), ενώ νέα records χρησιμοποιούν string. Τα routes #1-#3 θα **αποτύχουν** αν τα data είναι αποθηκευμένα ως string (`.where('projectId', '==', 5)` δεν ταιριάζει `"5"`).

Το route #4 (floors) χρησιμοποιεί **smart dual approach** — δοκιμάζει και τα δύο. Αυτό πρέπει να γίνει standard pattern μέχρι πλήρη normalization.

**Remediation**: Phase 3 migration — normalize ALL projectId values σε string στο Firestore.

---

## Category F: Empty String Defaults (HIGH)

**Πρόβλημα**: `companyId ?? ''` ή `companyId || ''` δημιουργεί documents/queries με empty string ως companyId, που bypasses tenant isolation.

### F1: React Components (useCompanyId() ?? '')

| # | File | Line | Code |
|---|------|------|------|
| 1 | `src/components/projects/general-tab/GeneralProjectTab.tsx` | 51 | `const fallbackCompanyId = useCompanyId()?.companyId ?? '';` |
| 2 | `src/components/file-manager/FileManagerPageContent.tsx` | 357 | `useCompanyId({ selectedCompanyId: activeWorkspace?.companyId })?.companyId ?? '';` |
| 3 | `src/components/building-management/tabs/MeasurementsTabContent.tsx` | 47 | `const resolvedCompanyId = useCompanyId({ building })?.companyId ?? '';` |
| 4 | `src/components/building-management/tabs/GeneralTabContent.tsx` | 59 | `const resolvedCompanyId = useCompanyId({ building })?.companyId ?? '';` |

### F2: Service/Repository Layer

| # | File | Line | Code |
|---|------|------|------|
| 5 | `src/services/calendar/mappers.ts` | 96 | `companyId: task.companyId ?? '',` |
| 6 | `src/services/obligations/InMemoryObligationsRepository.ts` | 175 | `companyId: data.companyId \|\| '',` |
| 7 | `src/components/building-management/building-services.ts` | 246 | `companyId: project.companyId \|\| '',` |
| 8 | `src/app/obligations/new/page.tsx` | 161 | `useCompanyRelationships(formData.companyId \|\| '');` |
| 9 | `src/app/obligations/new/page.tsx` | 279 | `companyId: project.companyId \|\| String(formData.companyId \|\| ''),` |
| 10 | `src/app/obligations/new/page.tsx` | 548 | `value={formData.companyId \|\| ""}` |

**Αξιολόγηση F1**: Τα React components (#1-#4) χρησιμοποιούν empty string ως **UI fallback** (disabled state). Αποδεκτό εφόσον ΔΕΝ γράφουν στο Firestore με empty companyId.

**Αξιολόγηση F2**: Τα service-level (#5-#7) είναι πιο ανησυχητικά — empty string μπορεί να φτάσει σε Firestore write.

---

## Category G: Telegram ID Conversions (LOW)

**Status**: ✅ Consistent Pattern — Δεν απαιτεί remediation.

| Direction | Pattern | Usage |
|-----------|---------|-------|
| To Number | `Number(telegramChatId)` | Telegram API calls (expects number) |
| To String | `String(message.from?.id)` | Internal storage (all IDs stored as string) |

| File | Line | Code |
|------|------|------|
| `src/services/ai-pipeline/shared/channel-reply-dispatcher.ts` | 187 | `chat_id: Number(telegramChatId),` |
| `src/services/ai-pipeline/pipeline-orchestrator.ts` | 422, 429 | `chat_id: Number(telegramChatId),` |
| `src/app/api/communications/webhooks/telegram/handler.ts` | 175 | `const userId = String(webhookData.message.from?.id ?? '');` |
| `src/app/api/communications/webhooks/telegram/handler.ts` | 296 | `const messageId = String(message.message_id);` |

**Αξιολόγηση**: Telegram IDs είναι numbers αλλά stored ως strings εσωτερικά. Η μετατροπή γίνεται consistent σε all adapters. Ο μόνος edge case (`?? ''` στη γραμμή 175) είναι minor.

---

## Remediation Roadmap

### Phase 1: Critical Security — userId + GLOBAL_ACCESS (Εβδομάδα 1)

**Στόχος**: Εξάλειψη invalid IDs που γράφονται στο Firestore.

| Task | Files | Effort |
|------|-------|--------|
| 1a. Δημιουργία `SYSTEM_USER_ID` constant | `src/config/system-constants.ts` | S |
| 1b. Replace `'system'` → `SYSTEM_USER_ID` | 7 services | M |
| 1c. Replace `'unknown'` → throw/early-return στα critical paths | `overlay-store.tsx`, migrations | M |
| 1d. Fix email-as-doc-key (hash/sanitize) | `chat-history-service.ts`, `admin-session.ts` | M |
| 1e. Replace `'anonymous'` → `user.uid` στο GeoCanvas | `GeoCanvasContent.tsx` | S |

### Phase 2: Type Safety — Non-null Assertions + as string (Εβδομάδα 2-3)

**Στόχος**: Κάθε ID access έχει explicit validation.

| Task | Files | Effort |
|------|-------|--------|
| 2a. Service-layer `!` → validation guards | 9 files (C1 list) | L |
| 2b. UI-layer `!` → conditional rendering | 11 files (C2 list) | L |
| 2c. `as string` → `typeof` validation | `boq-repository.ts`, `companyMapper.ts` | S |

**Strategy**: Migrate on touch — fix assertions μόνο σε αρχεία που ήδη αγγίζονται.

### Phase 3: projectId Normalization (Εβδομάδα 3-4)

**Στόχος**: Ένας τύπος (string) για projectId παντού.

| Task | Files | Effort |
|------|-------|--------|
| 3a. Audit Firestore: ποια documents έχουν numeric projectId | Migration script | M |
| 3b. Migration: `Number(projectId)` → `String(projectId)` στα documents | One-time migration | M |
| 3c. Update API routes: remove `parseInt`/`Number()` | 4 route files | S |
| 3d. Add runtime validation: `typeof projectId !== 'string'` guard | API middleware | S |

### Phase 4: Empty String Elimination (Εβδομάδα 4-5)

**Στόχος**: Αντικατάσταση `?? ''` patterns με proper nullable handling.

| Task | Files | Effort |
|------|-------|--------|
| 4a. Service-layer `?? ''` → `?? null` ή throw | `mappers.ts`, `building-services.ts` | S |
| 4b. UI-layer: Ensure empty-string companyId never reaches Firestore writes | 4 components | M |
| 4c. Add Firestore rule: reject documents with `companyId: ''` | `firestore.rules` | S |

---

## Safe Patterns (Reference — ΔΕΝ χρειάζονται αλλαγή)

Αυτά τα patterns είναι **σωστά** και πρέπει να χρησιμοποιηθούν ως πρότυπο:

```typescript
// ✅ Proper type guard (floors/route.ts)
if (!body.buildingId || typeof body.buildingId !== 'string') {
  return NextResponse.json({ error: 'Invalid buildingId' }, { status: 400 });
}

// ✅ Proper ID validation (FirestoreProjectsRepository.ts)
if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
  throw new Error('Invalid projectId');
}

// ✅ Proper auth check (floors/route.ts line 287)
createdBy: ctx.uid,  // Always from auth context, never fallback

// ✅ Proper nullable for Firestore (AppointmentsRepository.ts)
companyId: companyId ?? null,  // null, not empty string
```

---

## Implementation Artifacts

| Artifact | Path |
|----------|------|
| Firestore Helpers (sanitize + normalize) | `src/utils/firestore-helpers.ts` |
| SYSTEM_IDENTITY constant (extended) | `src/config/domain-constants.ts` |

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-12 | **Phase 1**: Replace magic `'system'` strings with `SYSTEM_IDENTITY.ID` (8 files), fix `'unknown'` fallback in overlay-store (early guard), fix email→uid in GeoCanvas, sanitize email doc keys in chat-history + admin-session | Claude Agent |
| 2026-03-12 | **Phase 2**: Add runtime guards for 7 non-null assertions in DepartmentManagementService (5), ImportExportService (1), photo-upload.service (1) | Claude Agent |
| 2026-03-12 | **Phase 3**: Normalize projectId queries with `normalizeProjectIdForQuery()` — removed dual-query pattern from 3 routes, replaced inline ternary in floors | Claude Agent |
| 2026-03-12 | **Phase 4**: Replace `?? ''` / `|| ''` with `?? null` / `|| null` for companyId in mappers.ts, InMemoryObligationsRepository, building-services.ts — updated corresponding type interfaces | Claude Agent |
| 2026-03-12 | Initial audit — 7 categories, 80+ instances documented | Claude Agent |
