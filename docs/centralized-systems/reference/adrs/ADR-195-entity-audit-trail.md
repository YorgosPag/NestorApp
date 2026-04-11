# ADR-195: Entity Audit Trail — Κεντρικοποιημένο Σύστημα Ιστορικού Αλλαγών

> **Status**: APPROVED — Phase 10 Client-side onSnapshot SSoT (ADR-214 composition) DONE (2026-04-11)
> **Date**: 2026-03-10
> **Author**: Claude Agent + Γιώργος Παγώνης
> **Category**: Entity Systems
> **Decision**: Option Γ — Header "Last Modified" + Dedicated Activity Tab

---

## Table of Contents

1. [Part 1: Τρέχουσα Κατάσταση](#part-1-τρέχουσα-κατάσταση)
2. [Part 2: Enterprise Benchmarking](#part-2-enterprise-benchmarking)
3. [Part 3: Προτεινόμενη Αρχιτεκτονική](#part-3-προτεινόμενη-αρχιτεκτονική)
4. [Part 4: Scope — Entity Priority](#part-4-scope--entity-priority)
5. [Part 5: Φάσεις Υλοποίησης](#part-5-φάσεις-υλοποίησης)
6. [Part 6: Risks & Mitigations](#part-6-risks--mitigations)

---

## Part 1: Τρέχουσα Κατάσταση

### 1.1 Υπάρχοντα Audit Systems (5 Διασπαρτά)

Η εφαρμογή διαθέτει **5 ανεξάρτητα** audit systems, καθένα σχεδιασμένο για διαφορετικό σκοπό. **Κανένα** δεν καλύπτει field-level change tracking σε entities.

#### System 1: File Audit Service
- **Αρχείο**: `src/services/file-audit.service.ts`
- **Collection**: `file_audit_log` (global, όχι tenant-scoped)
- **Τι κάνει**: Καταγράφει file operations (view, download, upload, rename, delete, restore, classify, AI ops, batch ops, version management, sharing, holds)
- **Entry**: `fileId`, `action`, `performedBy`, `timestamp` (server), `companyId`, `metadata`
- **Pattern**: Audit failures ποτέ δεν σπάνε την κύρια λειτουργία (returns empty ID on error)
- **Αξιολόγηση**: Καλά σχεδιασμένο για files, αλλά δεν καλύπτει entity changes

#### System 2: Auth Audit (RFC v6)
- **Αρχείο**: `src/lib/auth/audit.ts`
- **Collection**: `/companies/{companyId}/audit_logs/{autoId}` (tenant-scoped)
- **Τι κάνει**: Authorization events (role_changed, permission_granted/revoked), system bootstrap, migrations, data fixes, communications (created/approved/rejected), webhooks
- **Entry**: `companyId`, `action`, `actorId`, `targetId`, `targetType`, `previousValue`, `newValue`, `timestamp`, `metadata` (ipAddress, userAgent, path, reason)
- **Pattern**: `removeUndefinedValues()` sanitizer, console fallback αν Firebase Admin unavailable
- **Αξιολόγηση**: Πολύ mature, αλλά εστιάζει σε auth events, όχι σε entity field changes

#### System 3: AI Pipeline Audit Service
- **Αρχείο**: `src/services/ai-pipeline/audit-service.ts`
- **Collection**: `ai_pipeline_audit` (system-level, stores companyId as field)
- **Τι κάνει**: Pipeline execution decisions, AI understanding & intent, sender analysis, proposal execution, errors, duration tracking
- **Entry**: `requestId`, `timestamp`, `actionType`, `useCase`, `companyId`, `projectId`, `initiatedBy`, `handledBy`, `aiConfidence`, `aiModel`, `decision`, `details`, `durationMs`, `pipelineState`, `channel`
- **Αξιολόγηση**: Domain-specific για AI pipeline, δεν σχετίζεται με entity audit

#### System 4: Entity Linking Audit (Memory Buffer)
- **Αρχείο**: `src/services/entity-linking/utils/audit.ts`
- **Collection**: **ΚΑΝΕΝΑ** — In-memory circular buffer (max 1,000 entries)
- **Τι κάνει**: Entity linking/unlinking operations, cache operations, validation failures, retries
- **Entry**: `id`, `timestamp`, `action`, `severity`, `entityType`, `entityId`, `targetId`, `targetType`, `previousValue`, `newValue`, `success`, `errorMessage`, `durationMs`, `metadata`, `correlationId`
- **Αξιολόγηση**: Δεν persist σε Firestore — χάνεται με κάθε restart. Χρήσιμο μόνο για debugging

#### System 5: StorageHistoryTab (Unused UI)
- **Αρχείο**: `src/components/space-management/StoragesPage/StorageDetails/tabs/StorageHistoryTab.tsx`
- **Γραμμές**: ~337
- **Τι κάνει**: Comprehensive history timeline UI με events, statistics, current status summary
- **Status**: **EXISTS αλλά UNUSED** — Βασίζεται σε mock/demo data, δεν συνδέεται με πραγματικό audit backend
- **Αξιολόγηση**: Μπορεί να χρησιμεύσει ως UI reference για το Activity Tab design

### 1.2 Entity Timestamp Coverage

| Entity | `createdAt` | `updatedAt` | `createdBy` | `lastModifiedBy` | Coverage |
|--------|:-----------:|:-----------:|:-----------:|:-----------------:|:--------:|
| **Contact** | ✅ | ✅ | ✅ | ✅ | **100%** |
| **ParkingSpot** | ✅ | ✅ | ✅ | ❌ | **75%** |
| **Storage** | ❌ | ⚠️ `lastUpdated` | ❌ | ⚠️ `owner` | **25%** |
| **Building** | ✅ | ✅ | ❌ | ❌ | **50%** |
| **Unit** | ❌ | ⚠️ only `UnitCoverage.updatedAt` | ❌ | ❌ | **15%** |
| **Project** | ❌ | ⚠️ only `lastUpdate: string` | ❌ | ❌ | **15%** |

### 1.3 Field-Level Change Tracking: **0%**

Κανένα entity δεν έχει:
- Ιστορικό αλλαγών ανά πεδίο (field-level diff)
- Ποιος άλλαξε τι, πότε
- Activity timeline στο UI

### 1.4 Τι Λείπει (Gap Analysis)

| Gap | Σημασία | Σχόλιο |
|-----|---------|--------|
| Unified EntityAuditService | CRITICAL | Κανένα κεντρικό service για entity changes |
| Firestore collection `entity_audit_trail` | CRITICAL | Δεν υπάρχει collection |
| Field-level diff tracking | HIGH | Ποιο πεδίο, old value → new value |
| "Last Modified" header component | HIGH | Δεν υπάρχει reusable component |
| Activity Tab component | HIGH | StorageHistoryTab exists αλλά δεν συνδέεται |
| Consistent timestamps σε όλα τα entities | MEDIUM | Μόνο Contact έχει 100% coverage |
| User display name resolution | MEDIUM | userId → display name mapping |

---

## Part 2: Enterprise Benchmarking

### 2.1 Πώς το Κάνουν οι Μεγάλοι

| Platform | Audit Trail Approach | Storage | UI Pattern |
|----------|---------------------|---------|------------|
| **SAP S/4HANA** | Change Documents (CHANGEDOCUMENT) — automatic field-level logging | Dedicated tables per object | Header info + "Changes" tab |
| **Salesforce** | Field History Tracking — per-field enable, max 20 fields | `FieldHistoryArchive` object | "History" related list on record page |
| **Procore** | Change History on every entity | Dedicated `change_events` table | "Change History" tab in entity detail |
| **Microsoft Dynamics 365** | Auditing feature — entity-level + field-level | `AuditBase` table | "Audit History" tab |
| **Jira / Atlassian** | Activity Stream — every change logged | `changehistory` + `changegroup` + `changeitem` | "Activity" tab with timeline |

### 2.2 Common Patterns Observed

1. **Separate Audit Storage**: Κανείς δεν αποθηκεύει audit data μέσα στο entity document — πάντα ξεχωριστό
2. **Field-Level Granularity**: Όλοι καταγράφουν old value → new value ανά πεδίο
3. **Actor Tracking**: Ποιος (userId + display name) + πότε (timestamp)
4. **UI = Timeline**: Activity/History tab με χρονολογική σειρά (newest first)
5. **Header Summary**: "Last modified by X, 2 hours ago" στο header — quick glance info
6. **Performance**: Pagination/lazy loading για audit entries — ποτέ δεν φορτώνονται όλα

### 2.3 Industry-Standard Audit Entry Schema

```
{
  entityType: "contact" | "building" | "unit" | "project" | "parking" | "storage"
  entityId: string
  action: "created" | "updated" | "deleted" | "status_changed" | "linked" | "unlinked"
  actorId: string          // Firebase Auth UID
  actorName: string        // Display name (denormalized for performance)
  timestamp: Timestamp     // Server timestamp
  changes: [               // Field-level diffs
    {
      field: "status"
      oldValue: "available"
      newValue: "sold"
      label: "Κατάσταση"   // Human-readable field name
    }
  ]
  metadata?: {
    source: "web" | "api" | "import" | "ai"
    ipAddress?: string
    correlationId?: string
  }
}
```

---

## Part 3: Προτεινόμενη Αρχιτεκτονική (Option Γ)

### 3.1 Overview

Ο Γιώργος επέλεξε **Option Γ**: Συνδυασμός Header "Last Modified" + Dedicated Activity Tab.

```
┌─────────────────────────────────────────────┐
│  Entity Header                              │
│  ┌─────────────────────────────────────┐    │
│  │ Contact: Νίκος Παπαδόπουλος        │    │
│  │ Last modified by Γιώργος • 2h ago   │    │ ← Quick glance
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  [General] [Files] [Activity] [...]         │
│                      ^^^^^^^^               │
│                      Dedicated Tab          │
│  ┌─────────────────────────────────────┐    │
│  │ ● Γιώργος changed Status            │    │
│  │   "Available" → "Sold"              │    │
│  │   2 hours ago                       │    │
│  │                                     │    │
│  │ ● System linked to Building B-001   │    │
│  │   3 hours ago                       │    │
│  │                                     │    │
│  │ ● Μαρία created this contact        │    │
│  │   2 days ago                        │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 3.2 Core Components

#### Component 1: `EntityAuditService` (Backend)
- **Location**: `src/services/audit/entity-audit-service.ts`
- **Responsibility**: Write & query audit entries
- **Collection**: `entity_audit_trail` (global, with `companyId` field for tenant filtering)
- **Methods**:
  - `recordChange(params)` — Καταγράφει μία αλλαγή entity
  - `recordBatchChanges(params)` — Batch write πολλαπλών changes (transaction)
  - `getEntityHistory(entityType, entityId, options)` — Paginated query
  - `getLatestChange(entityType, entityId)` — Τελευταία αλλαγή (για header)
  - `diffFields(oldDoc, newDoc, fieldConfig)` — Υπολογίζει field-level diffs

#### Component 2: `LastModifiedBadge` (UI — Header)
- **Location**: `src/components/shared/audit/LastModifiedBadge.tsx`
- **Props**: `entityType`, `entityId`, `fallbackDate?`, `fallbackUser?`
- **Renders**: "Last modified by {name} • {relative time}" ή fallback σε entity timestamps
- **Pattern**: Real-time listener (onSnapshot) ή poll-on-mount

#### Component 3: `ActivityTab` (UI — Tab)
- **Location**: `src/components/shared/audit/ActivityTab.tsx`
- **Config**: `src/components/shared/audit/activity-tab-config.ts`
- **Props**: `entityType`, `entityId`
- **Features**:
  - Timeline layout (vertical, newest first)
  - Field-level diffs with old → new values
  - User avatars/initials
  - Relative timestamps ("2 hours ago")
  - Infinite scroll pagination (20 entries per page)
  - Empty state ("No activity recorded yet")
  - **i18n**: All labels use `t()` with keys under `audit.actions.*`, `audit.filters.*` — zero hardcoded strings
- **Config pattern**: `activity-tab-config.ts` stores `labelKey` (i18n key), not literal text. Resolved at render time via `t(config.labelKey)`
- **Reusable**: Ίδιο component σε κάθε entity (Contact, Building, Unit, κτλ.)

#### Component 4: `useEntityAudit` Hook
- **Location**: `src/hooks/useEntityAudit.ts`
- **Purpose**: Client-side wrapper για audit queries
- **Returns**: `{ history, isLoading, hasMore, loadMore, latestChange }`

### 3.3 Firestore Collection Schema

```
Collection: entity_audit_trail
Document ID: auto-generated

{
  // Identity
  companyId: string                    // Tenant isolation
  entityType: EntityType               // "contact" | "building" | "unit" | etc.
  entityId: string                     // The entity's Firestore document ID

  // Action
  action: AuditAction                  // "created" | "updated" | "deleted" | "status_changed" | "linked" | "unlinked"

  // Actor
  actorId: string                      // Firebase Auth UID
  actorName: string                    // Denormalized display name

  // Timestamp
  timestamp: Timestamp                 // Firestore server timestamp

  // Changes (for "updated" actions)
  changes: AuditFieldChange[]          // Array of field-level diffs
  // Each: { field: string, oldValue: unknown, newValue: unknown, label?: string }

  // Metadata
  metadata?: {
    source: "web" | "api" | "import" | "ai" | "system"
    module?: string                    // Which module triggered this
    correlationId?: string             // For batch operations
    note?: string                      // Optional human note
  }
}
```

### 3.4 Composite Indexes Required

```
// Query: Get entity history (paginated, newest first)
entity_audit_trail: entityType ASC, entityId ASC, timestamp DESC

// Query: Get latest change for entity
entity_audit_trail: entityType ASC, entityId ASC, timestamp DESC (limit 1)

// Query: Get all changes by actor (admin view)
entity_audit_trail: companyId ASC, actorId ASC, timestamp DESC
```

### 3.5 Integration Pattern

Κάθε entity save operation θα καλεί `EntityAuditService.recordChange()` **μετά** την επιτυχημένη αποθήκευση:

```typescript
// Pattern: Save entity → Record audit (non-blocking)
async function updateContact(contactId: string, updates: Partial<Contact>, actor: AuditActor) {
  // 1. Get old document for diff
  const oldDoc = await getContact(contactId);

  // 2. Save the update
  await firestore.doc(`contacts/${contactId}`).update(updates);

  // 3. Record audit (fire-and-forget — never blocks the save)
  entityAuditService.recordChange({
    companyId: actor.companyId,
    entityType: 'contact',
    entityId: contactId,
    action: 'updated',
    actorId: actor.uid,
    actorName: actor.displayName,
    changes: diffFields(oldDoc, { ...oldDoc, ...updates }, CONTACT_FIELD_CONFIG),
    metadata: { source: 'web' }
  }).catch(err => console.error('[EntityAudit] Failed to record:', err));
}
```

### 3.6 Relationship with Existing Systems

| Existing System | Relationship | Action |
|----------------|-------------|--------|
| File Audit Service | **Παράλληλο** — Συνεχίζει για file operations | Κανένα — κρατάμε as-is |
| Auth Audit | **Παράλληλο** — Συνεχίζει για auth/permission events | Κανένα — κρατάμε as-is |
| AI Pipeline Audit | **Παράλληλο** — Συνεχίζει για AI decisions | Κανένα — κρατάμε as-is |
| Entity Linking Audit | **Absorb** — Entity linking events θα καταγράφονται και στο entity_audit_trail | Μακροπρόθεσμα migrate |
| StorageHistoryTab | **Replace** — Θα αντικατασταθεί από το generic ActivityTab | UI reference κατά το development |

---

## Part 4: Scope — Entity Priority

### 4.1 Ποια Entities Χρειάζονται Audit

| Priority | Entity | Reason | Current Coverage | Effort |
|----------|--------|--------|-----------------|--------|
| **P0** | Contact | Core CRM entity, most edited | 100% timestamps | LOW |
| **P0** | Project | Business-critical, status changes | 15% timestamps | MEDIUM |
| **P1** | Building | Key real-estate entity | 50% timestamps | MEDIUM |
| **P1** | Unit | Sales pipeline, status tracking | 15% timestamps | MEDIUM |
| **P2** | ParkingSpot | Secondary space entity | 75% timestamps | LOW |
| **P2** | Storage | Secondary space entity | 25% timestamps | MEDIUM |
| **P3** | Appointment | Scheduling audit | TBD | LOW |
| **P3** | Communication | Message audit | TBD | LOW |

### 4.2 Fields Per Entity (Αξία Audit)

**Contact** (P0):
- `status` (lead → customer → inactive) — HIGH
- `email`, `phone` — MEDIUM
- `companyId` (employer change) — HIGH
- `assignedTo` — HIGH
- `tags` — LOW

**Project** (P0):
- `status` (planning → active → completed) — CRITICAL
- `budget`, `cost` — HIGH
- `startDate`, `endDate` — MEDIUM
- `manager` — HIGH

**Building** (P1):
- `status` — HIGH
- `address`, `coordinates` — MEDIUM
- `floors`, `units count` — MEDIUM

**Unit** (P1):
- `status` (available → reserved → sold) — CRITICAL
- `price` — HIGH
- `linkedContact` — HIGH
- `floor`, `area` — MEDIUM

**ParkingSpot** (P2):
- `status` — HIGH
- `assignedTo` — HIGH
- `price` — MEDIUM

**Storage** (P2):
- `status` — HIGH
- `owner` — HIGH
- `size`, `type` — LOW

---

## Part 5: Φάσεις Υλοποίησης (High Level)

### Phase 1: Foundation (Infrastructure)
- Δημιουργία `EntityAuditService` με `recordChange()` + `getEntityHistory()`
- Δημιουργία Firestore collection `entity_audit_trail`
- Deploy composite indexes
- Δημιουργία `diffFields()` utility
- TypeScript types + interfaces

### Phase 2: UI Components
- `LastModifiedBadge` component
- `ActivityTab` component (timeline, pagination, empty state)
- `useEntityAudit` hook
- Integration στο entity detail layout

### Phase 3: Entity Integration — P0 (Contact + Project)
- Contact save operations → audit recording
- Project save operations → audit recording
- Timestamp field normalization (createdAt, updatedAt, createdBy, lastModifiedBy)
- Header + Activity Tab ενεργοποίηση

### Phase 4: Entity Integration — P1 (Building + Unit)
- Building + Unit save operations → audit recording
- Timestamp fields addition where missing
- Header + Activity Tab ενεργοποίηση

### Phase 5: Entity Integration — P2+ (Parking, Storage, Others)
- Remaining entities integration
- StorageHistoryTab replacement με ActivityTab
- Entity Linking Audit migration (optional)

---

## Part 6: Risks & Mitigations

### Risk 1: Firestore Costs
- **Risk**: Κάθε entity save δημιουργεί +1 write στο `entity_audit_trail`
- **Impact**: Doubles write costs per entity update
- **Mitigation**:
  - Fire-and-forget pattern (audit failure δεν blocks save)
  - Batch writes όταν multiple fields change ταυτόχρονα (1 audit doc, πολλά `changes[]`)
  - TTL policy: Auto-delete entries >12 months (Firestore TTL policies)
  - Monitor costs weekly στο Firebase Console

### Risk 2: Vercel Serverless Timeouts
- **Risk**: Audit write + entity save + diff calculation = extra latency
- **Impact**: Πιθανό timeout σε slow connections
- **Mitigation**:
  - Audit recording is **fire-and-forget** (non-blocking `.catch()`)
  - `diffFields()` runs synchronously σε μνήμη (no network call)
  - Worst case: entity saves OK, audit entry χάνεται (acceptable trade-off)
  - `maxDuration: 60` σε API routes που χρησιμοποιούν audit

### Risk 3: GDPR Compliance
- **Risk**: Audit trail περιέχει PII (ποιος έκανε τι, old/new values μπορεί να περιέχουν emails/phones)
- **Impact**: GDPR Right to Erasure / Right to Access
- **Mitigation**:
  - `actorName` is denormalized → αν ο user ζητήσει deletion, χρειάζεται sweep
  - Προσθήκη `anonymizeAuditTrail(userId)` method (αντικαθιστά name με "Deleted User")
  - Sensitive field values (email, phone) → store masked version στο audit ("n***@gmail.com")
  - TTL policy βοηθάει (12-month auto-delete)
  - Data export: `exportUserAuditTrail(userId)` για GDPR access requests

### Risk 4: Performance (Read)
- **Risk**: Entity με πολλά audit entries → slow Activity Tab
- **Impact**: Poor UX σε entities με >100 changes
- **Mitigation**:
  - Pagination: 20 entries per page, infinite scroll
  - Composite index on `(entityType, entityId, timestamp DESC)` — efficient query
  - `getLatestChange()` uses `limit(1)` — fast header rendering
  - Optional: Cache latest change in entity document itself (denormalization)

### Risk 5: Data Consistency
- **Risk**: Entity saves OK αλλά audit write αποτυγχάνει → ιστορικό λείπει
- **Impact**: Incomplete audit trail
- **Mitigation**:
  - Αποδεκτό trade-off: entity integrity > audit completeness
  - Console logging on audit failure (monitoring)
  - Periodic reconciliation job (future): compare entity `updatedAt` vs latest audit entry
  - Pattern ίδιο με File Audit Service (proven in production)

### Risk 6: Schema Evolution
- **Risk**: Entity types αλλάζουν, fields προστίθενται/αφαιρούνται
- **Impact**: Old audit entries reference fields που δεν υπάρχουν πλέον
- **Mitigation**:
  - Audit entries είναι immutable snapshots — δεν χρειάζεται migration
  - `label` field στο `AuditFieldChange` → human-readable ακόμα κι αν το field αλλάξει
  - Graceful rendering: αν field δεν αναγνωρίζεται, εμφάνιση raw field name

---

## Appendix A: Related ADRs

| ADR | Σχέση |
|-----|-------|
| ADR-193 | Field Display Domain Separation — Αφαίρεση financial fields από General tabs |
| ADR-194 | Info Tab Section Consistency — Αφαίρεση Update Info cards (pending centralized audit) |
| ADR-012 | Entity Linking Service — Entity linking events θα migrate στο audit trail |
| ADR-191 | Enterprise Document Management — File audit companion system |

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Field-level diff** | Καταγραφή αλλαγής σε επίπεδο πεδίου: ποιο πεδίο, παλιά τιμή → νέα τιμή |
| **Fire-and-forget** | Pattern όπου η audit write εκτελείται async χωρίς να μπλοκάρει τη main operation |
| **Denormalization** | Αποθήκευση `actorName` μέσα στο audit entry για αποφυγή join query |
| **TTL policy** | Firestore Time-To-Live — αυτόματη διαγραφή documents μετά από X μήνες |
| **Composite index** | Firestore index σε πολλαπλά fields για efficient compound queries |

---

*Document created: 2026-03-10 | ADR-195 | Entity Audit Trail*

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-10 | ADR created — documentation only | Claude Agent |
| 2026-03-13 | **Phase 3 Contact Integration DONE**: Added "Ιστορικό" tab to individual contacts. Wired centralized `ActivityTab` via config-driven pattern (individual-config.ts section #10, custom renderer in UnifiedContactTabbedSection.tsx). i18n keys added (el/en). Zero new code — pure wire-up of existing centralized system. | Claude Agent |
| 2026-03-13 | **Phase 3 Project Integration DONE**: Added "Ιστορικό" tab (#14) to projects. Config-driven wire-up: `project-tabs-config.ts` (order 14), `projectMappings.ts` (ActivityTab mapping), `property-statuses-enterprise.ts` (HISTORY labels). `componentProps: { entityType: 'project' }` ensures correct entity filtering. i18n description added (el/en). | Claude Agent |
| 2026-03-13 | **Phase 4 Building Integration DONE**: Added "Ιστορικό" tab (#16, order 16) to buildings via Unified Factory pattern. Wire-up: `unified-tabs-factory.ts` (history tab after videos), `buildingMappings.ts` (ActivityTab mapping). `componentProps: { entityType: 'building' }` ensures correct entity filtering. i18n descriptions fixed to generic text (removed "του έργου"/"Project"). Unit already had History tab (order 6) — no changes needed. | Claude Agent |
| 2026-03-14 | **Phase 5 Parking + Storage Integration DONE**: Added "Ιστορικό" tab (order 6) to both Parking and Storage in `unified-tabs-factory.ts`. Added `ActivityTab` component mapping to `parkingMappings.ts` and `storageMappings.ts`. `componentProps: { entityType: 'parking' | 'storage' }` ensures correct entity filtering. Sales Sidebars already had inline History — no changes needed. | Claude Agent |
| 2026-04-08 | **i18n SSoT cleanup**: Replaced all hardcoded Greek labels in `ActivityTab.tsx` and `activity-tab-config.ts` with i18n keys (`audit.actions.*`, `audit.filters.*`, `audit.loadMore`, `audit.byUser`). Config interface changed `label: string` → `labelKey: string`. Added 31 new keys to `el/common.json` + `en/common.json`. Fixed `useTranslation.ts` to stop filtering out `common` namespace (broke `rawT` lookups for unsplit keys). Removed `eslint-disable` comments. Also fixed `ContactDetailsHeader.tsx` guard: `!isEditing` → `!isEditing && onStartEdit` to prevent runtime error when callback is undefined. | Claude Agent |
| 2026-04-08 | **3 audit bugs fixed**: (1) `performedByName` now passed to `softDelete()`/`restoreFromTrash()` via new optional param — all 8 callers pass `ctx.email`. (2) Hardcoded English labels (`"Moved to trash"`, `"Restored from trash"`) replaced with Greek field label `"Κατάσταση"` — action type already describes the operation. (3) `serializeValue()` normalizes `""` to `null` (server + client copies) — eliminates false `"— → —"` diffs when fields are empty-string vs null. | Claude Agent |
| 2026-04-08 | **Auto-resolve performedByName**: Added `resolvePerformerDisplayName()` in `entity-audit.service.ts`. On every `recordChange()`, if `performedByName` is null or an email → lookup `/users/{uid}` → store `"DisplayName (email)"`. Special values ("Σύστημα", "[GDPR ANONYMIZED]") preserved. Zero caller changes needed — all existing callers auto-enhanced. | Claude Agent |
| 2026-04-08 | **Full field coverage**: Expanded `CONTACT_TRACKED_FIELDS` from 20 → 65 fields. Added: individual identity (middleName, nickname, birthDate, birthCountry, gender, amka), identity documents (5 fields), professional (10 fields), family (3 fields), company-specific (legalName, tradeName, registrationNumber, sector, numberOfEmployees, annualRevenue, contactPersons), service-specific (9 fields), communication (websites, socialMediaArray), media (photoURL, multiplePhotoURLs, logoURL, representativePhotoURL), personas (personaTypes). Coverage: ~26% → ~85%. | Claude Agent |
| 2026-04-08 | **Value translations + Google-style stats**: (1) Added 24 `audit.values.*` translations (gender, maritalStatus, documentType, serviceType, legalForm, boolean) in el+en. (2) Enhanced `translateValue` with 3-layer resolution: enum values → country codes (GR→Ελλάδα) → ISO dates (2026-04-07→07/04/2026). (3) Replaced dynamic per-action stats cards with 4 fixed Google-style cards: Total, Last Change, Fields Changed, Users. | Claude Agent |
| 2026-04-08 | **3 identity impact bugs fixed**: (1) Missing Firestore composite index for `contact_links` (sourceContactId + targetEntityType + status) → query `FAILED_PRECONDITION` → identity impact preview blocked all saves. Added index to `firestore.indexes.json`. (2) API route schema missing `'administrative'` category → Zod validation 400 when taxOffice changed. Fixed in `identity-impact-preview/route.ts`. (3) `formatChangeValue` couldn't translate `identity_card` → added `snakeToCamel()` conversion so `identity_card` → `identityCard` matches locale key. | Claude Agent |
| 2026-04-11 | **Phase 6 Public Service Integration DONE**: Added "Ιστορικό" tab to public service contacts (`service-config.ts` → `historySection` appended to `SERVICE_SECTIONS`). Zero new components — reuses the same `ContactHistoryTab` renderer already wired in `contactRenderersCore.tsx` (type-agnostic via `contactId`). Zero new services — `contacts.service.ts` audit recording already covers service type via `getContactTrackedFieldsForType('service')`. Zero new collections — same `entity_audit_trail`. Expanded `CONTACT_TRACKED_FIELDS` with service form fields (`name`, `shortName`, `supervisionMinistry`) and added them to `SERVICE_ONLY_FORM_FIELDS` set (excluded from individual/company diffs to prevent noise from form defaults). Reused existing `sections.history` + `sectionDescriptions.history` i18n keys from `forms` namespace — no new keys needed. Full SSoT compliance. | Claude Agent |
| 2026-04-11 | **SSoT ratchet enforcement** (ADR-294): Added `entity-audit-trail` module to `.ssot-registry.json` with 3 forbidden patterns — (1) `(addDoc\|setDoc\|updateDoc)\s*\([^)]*(entity_audit_trail\|ENTITY_AUDIT_TRAIL)` blocks direct writes bypassing `EntityAuditService.recordChange()`, (2) `collection\s*\(\s*(COLLECTIONS\.ENTITY_AUDIT_TRAIL\|['"]entity_audit_trail['"])` blocks inline queries against the audit collection, (3) `(function\s+useEntityAudit\s*\(\|const\s+useEntityAudit\s*=)` blocks re-implementations of the canonical hook. Allowlist: `entity-audit.service.ts`, `useEntityAudit.ts`, `src/app/api/audit-trail/`, `firestore-collections.ts`. Baseline regenerated with zero violations for this module — pre-commit hook now enforces zero tolerance for new audit-trail bypass across all entity types (individual, company, service, project, building, property, parking, storage). Motivation: As Phase 6 extends history to more contact types, prevent future agents from reintroducing parallel audit collections or duplicate hooks. | Claude Agent |
| 2026-04-11 | **Phase 6 regression fix — service form fields missing from service audit**: When Phase 6 was added, `SERVICE_ONLY_FORM_FIELDS` (`name`, `shortName`, `supervisionMinistry`) was spread into **both** `COMPANY_EXCLUSIVE` and `INDIVIDUAL_EXCLUSIVE` in `audit-tracked-fields.ts`. Intent was to suppress those keys from individual/company diffs (already covered by `SERVICE_EXCLUSIVE`). Effect was that `getContactTrackedFieldsForType('service')`, whose `excludeSet = COMPANY_EXCLUSIVE ∪ INDIVIDUAL_EXCLUSIVE`, also stripped them — so edits to `shortName` (and `name`/`supervisionMinistry`) on a public-service contact silently produced an empty diff and **no audit entry was written**. Fix: removed `...SERVICE_ONLY_FORM_FIELDS` from both `COMPANY_EXCLUSIVE` and `INDIVIDUAL_EXCLUSIVE`; the fields remain correctly excluded for individual/company via `SERVICE_EXCLUSIVE`, and are now tracked for service contacts. Reported by Γιώργος after saving a shortName change on a δημόσια υπηρεσία and seeing no history entry. | Claude Agent |
| 2026-04-11 | **Phase 1 CDC PoC — Cloud Function audit trigger for contacts** (Google-native pattern). Motivation: the Phase 6 `shortName` regression exposed the structural weakness of maintaining a manual `CONTACT_TRACKED_FIELDS` allowlist + per-type exclude sets — one misplaced spread silently removed fields from the audit scope for an entire contact type, with no CI/runtime signal. The Google-native fix is to move audit production out of the service layer and into a database-level change data capture trigger that diffs every field automatically. **New module** `functions/src/audit/` with three files: (1) `ignored-fields.ts` — SSoT of system/computed field paths excluded from diffs (timestamps, search index metadata, performer stamps, Firestore internals); (2) `deep-diff.ts` — generic recursive diff that flattens nested objects to dot-notation paths, treats arrays and Firestore Timestamps as leaves, normalises null/undefined/'' equivalence, and sorts results for stable output; (3) `contact-audit-trigger.ts` — `functions.firestore.document('contacts/{docId}').onWrite` handler that classifies the write (`created`/`deleted`/`trashed`/`restored`/`archived`/`unarchived`/`status_changed`/`updated`), resolves the display name generically across all three contact types (individual/company/service), reads performer context from `_lastModifiedBy`/`_lastModifiedByName` on the document itself, and writes to `entity_audit_trail` tagged `source: 'cdc'`. **Wire-up**: exported from `functions/src/index.ts` as `auditContactWrite`; `functions/src/config/firestore-collections.ts` mirrors `ENTITY_AUDIT_TRAIL: 'entity_audit_trail'`; `functions/src/config/enterprise-id.ts` mirrors `generateEntityAuditId()` with prefix `eaud` (identical to `src/services/enterprise-id-prefixes.ts:152`). **Dual-write strategy**: both paths write simultaneously during the Phase 1 comparison window — service-level entries are now tagged `source: 'service'` in `entity-audit.service.ts` so coverage can be compared in Firestore with a simple query. **Client context**: `contacts.service.ts` `updateContact()` now stamps `_lastModifiedBy` (= `auth.currentUser.uid`), `_lastModifiedByName` (= displayName or email), and `_lastModifiedAt` on every Firestore write — these fields are in `IGNORED_FIELDS` so they never produce their own audit entries. Clients that still write without user context will produce CDC entries with `performedBy: 'cdc_unknown'` and a warning in Cloud Functions logs. **Known Phase 1 gaps** (to address before cutover): (a) labels are currently the raw field paths — the service-layer `CONTACT_TRACKED_FIELDS` map provides human-readable Greek labels that the CF does not yet consult; (b) no ID-to-name resolution (e.g. `buildingId → "ΚΤΙΡΙΟ Α"`); (c) coverage comparison is manual — a scheduled function to diff `source='service'` vs `source='cdc'` counts per day is Phase 2. **Deployment**: requires `firebase deploy --only functions:auditContactWrite`. Safe to deploy any time — dual-write is strictly additive. **Rollout gate**: after one week, Γιώργος reviews `entity_audit_trail` with `where('source','==','cdc')` and compares coverage against `source='service'`. If CDC matches or exceeds with zero false positives, Phase 2 will retire the service-layer path for contacts and extend the same trigger pattern to projects/buildings/units/parking/storage (one generic trigger factory, one entry per collection in `index.ts`). | Claude Agent |
| 2026-04-11 | **Phase 7 Global Audit Log Admin View DONE** (Google Workspace pattern): Dual-view audit trail — per-entity (existing, drill-down) + company-wide admin view at `/admin/audit-log`. **Refactor**: Extracted `AuditTimelineView.tsx` + `audit-timeline-entry.tsx` from `ActivityTab.tsx` (439→86 lines) so both views share the same renderer. `AuditTimelineView` is controlled/stateless; `AuditTimelineEntry` supports optional `showEntityLink` mode that renders an entity-type badge + clickable `Link` to the canonical detail route per `buildEntityHref()`. **Backend**: New `/api/audit-trail/global` route with `withAuth({ requiredGlobalRoles: ['super_admin','company_admin'] })` + rate limit. Filters: entityType, performedBy, action, fromDate, toDate. Tenant isolation via `ctx.companyId`. MVP indexing: single composite index `(companyId asc, timestamp desc)` — entity/action/user filters done in-memory with 5x overfetch to avoid composite-index explosion. **Client**: `useGlobalAuditTrail` hook mirrors `useEntityAudit` shape → feeds `AuditTimelineView` with zero duplication. `GlobalAuditLogView` wires hook + filter bar + timeline. `AuditLogFilters` uses Radix Select + native date inputs + free-text performedBy search. **Navigation**: New sub-item under Settings menu (`icon: History`, `permissions: ['admin_access']`). **Auth**: Defense in depth — `/admin/layout.tsx` gates the route + API enforces admin roles. **i18n**: `admin.auditLog.*` keys (title, description, refresh, filters.*) in el+en; `common.audit.entityTypes.*` for the entity-type badge in global mode. **Follow-up**: Γιώργος to deploy Firestore index — `firebase deploy --only firestore:indexes`. | Claude Agent |
| 2026-04-11 | **Phase 8 Global Audit Real-time + firestore-realtime SSoT ratchet** (Google pattern). Motivation: Γιώργος edited `shortName` on a public-service contact, saw the new entry appear immediately in the per-entity "Ιστορικό" tab, but **not** in the global `/admin/audit-log` view — the page had to be manually refreshed to see the change. Root cause: `useEntityAudit` already subscribed to `RealtimeService` events (via `ENTITY_EVENT_MAP`), whereas `useGlobalAuditTrail` was pure REST and never refetched after mount. **Fix #1 — global hook realtime subscription**: `useGlobalAuditTrail.ts` now subscribes on mount to a constant list of 23 audit-relevant entity events (`GLOBAL_AUDIT_WATCH_EVENTS`) covering contacts, buildings, projects, units, parking, storage, relationships, and entity linking. Each event triggers a 500 ms-debounced `refreshTrigger` bump so the server has time to complete the fire-and-forget audit write before the refetch. Same pattern as `useEntityAudit` — zero new infrastructure, pure reuse of the centralised singleton `RealtimeService`. **Fix #2 — ENTITY_EVENT_MAP full coverage**: `useEntityAudit.ts` `ENTITY_EVENT_MAP` previously only mapped 5 types (`contact`, `building`, `unit`, `project`, `purchase_order`) out of the 9 `AuditEntityType` values — so per-entity history tabs on parking, storage, property, floor, and company entities received zero live updates. Expanded to cover all 9 types, added `ENTITY_LINKED`/`ENTITY_UNLINKED` to building/property/project (entity linking surfaces through the audit trail as `linked`/`unlinked` actions), and kept both `property` and legacy `unit` keys as aliases to avoid breaking legacy call sites. **Fix #3 — firestore-realtime SSoT ratchet** (ADR-294): New module `firestore-realtime` in `.ssot-registry.json` with forbidden pattern `\bonSnapshot\s*\(` and allowlist restricted to `src/services/realtime/RealtimeService.ts` + `src/services/realtime/hooks/`. Motivation: a `RealtimeService` singleton already exists (60+ typed events, 2 generic `dispatch`/`subscribe` methods, cross-tab sync via CustomEvent + localStorage), but 22 legacy files still call `onSnapshot()` directly, bypassing the centralised error handling, permission-denied auto-unsubscribe, and subscription deduplication. Without enforcement, every new agent could silently reintroduce scattered subscriptions — the same class of regression that required this fix. Baseline regenerated with 23 files / 26 violations for the new module (ratchet down only; pre-commit blocks any new scattered `onSnapshot` introduction, existing files migrate gradually via the Boy Scout rule). **Why not a new generic `useFirestoreSubscription` hook**: the codebase already has the canonical `RealtimeService` — the gap was enforcement, not infrastructure. Adding a fourth subscription API would have increased the surface area instead of narrowing it. Google-level fix is always the minimal one that closes the loop. **Files changed**: `src/hooks/useGlobalAuditTrail.ts` (+realtime subscription effect, +watch-events constant), `src/hooks/useEntityAudit.ts` (+4 entity types in map, +unit alias, +ENTITY_LINKED events, stricter JSDoc), `.ssot-registry.json` (+firestore-realtime module), `.ssot-violations-baseline.json` (regenerated: 7→23 files, 16→26 violations — new module only, no regression in existing modules), ADR-195 (this entry). **Verification**: `npm run ssot:audit` → `firestore-realtime` module picked up in flat registry; baseline captures the 22 legacy scattered callers; pre-commit hook will block any new file introducing `onSnapshot(` outside the RealtimeService layer. **Follow-up** (Phase 2, no urgency): gradual migration of the 22 legacy `onSnapshot` call sites to `RealtimeService.subscribeToCollection` / `subscribeToDocument` — boy-scout rule, touch-when-you-edit, no dedicated refactor sprint needed. Ratchet guarantees the count only decreases over time. **Correction (see Phase 2A entry below)**: the original Phase 8 allowlist missed `firestoreQueryService` (ADR-214), which is in fact the **primary** canonical path. Phase 2A fixes this. | Claude Agent |
| 2026-04-11 | **Phase 9 — Audit Value i18n SSoT + CHECK 3.14 enforcement** (ADR-279 alignment). Motivation: Γιώργος reported that the audit trail on `/contacts` displayed a `category` change as `"Κατηγορία: Δήμος → region"` — one side translated, the other a raw enum key. Root cause: `ContactHistoryTab.tsx` and `audit-timeline-entry.tsx` both performed an ad-hoc `t('audit.values.${v}')` lookup against `common` namespace, but `audit.values.*` contained only `ministry` + `municipality` out of the 19-entry `options.serviceCategories` catalog that populates the `category` dropdown. New values added to the form catalog silently fell through to raw-key rendering, and existing pre-commit checks couldn't catch this because the `t()` call is dynamic (template literal) — CHECK 3.8 only scans static `t('key')` calls. **SSoT fix** (single source, compile-time enforcement pattern Γιώργος chose over the runtime-fallback alternative): (1) **New SSoT config** `src/config/audit-value-catalogs.ts` — canonical map `field → { ns, path }` pointing at the authoritative enum catalog inside the `contacts-form` (or other) locale namespace. Initial entries: `category → contacts-form:options.serviceCategories`, `legalStatus → contacts-form:options.legalStatuses`, `gender → contacts-form:options.gender`, `documentType → contacts-form:options.identity`. Zero duplication — the enum values live **only** in the form option catalogs. (2) **New runtime resolver** `src/components/shared/audit/audit-value-resolver.ts` — `resolveAuditValue(field, value, t)` with 4-layer strategy: canonical catalog lookup via `i18next.exists(key, { ns })` → legacy composite `"key — label"` split → `common:audit.values.*` fallback (kept as safety net for non-catalog fields like `status`, `gender` when not registered) → ISO-date formatting. Uses `i18next.exists()` to probe before translating so missing-key warnings stay clean. (3) **Renderer refactor**: `ContactHistoryTab.tsx` replaced its inline `translateValue` closure with a per-change `makeFieldTranslator(change.field)` that delegates to `resolveAuditValue`; `audit-timeline-entry.tsx` did the same and layered its country-code map on top (for non-enum fields like `birthCountry`). `formatDisplayValue` signature in `activity-tab-helpers.ts` left unchanged — the field-awareness is captured in the per-change closure. (4) **Pre-commit CHECK 3.14** — new `scripts/check-audit-value-catalogs.js` parses `AUDIT_VALUE_CATALOGS` via regex (no ts-node), loads each referenced `el/<ns>.json` + `en/<ns>.json`, verifies the dot-path exists in both locales, verifies it resolves to a non-empty `{ string: string }` map, and verifies key-level parity between el and en. Zero tolerance — no baseline. Only runs when the config file or any `el/en/*.json` locale is staged (cheap skip otherwise). New npm script `audit-values:audit`. Validator positive test: 4 fields validated against el/en (36 keys per locale) → green. Negative test: intentionally broke `options.serviceCategories` → `options.serviceCategoriesMISSING` → validator reported `[category] el:contacts-form:options.serviceCategoriesMISSING → path does not exist` and exit 1. (5) **Fallback preserved**: the 16 entries I added earlier to `common.json > audit.values.*` (region, publicEntity, independentAuthority, taxOffice, socialSecurity, urbanPlanning, landRegistry, fireDepartment, police, court, chamber, utility, military, university, hospital, school) are retained as the generic fallback layer — harmless, cover historical entries that may have stored Greek labels directly, and keep behaviour graceful if a future field drops out of the catalog without a registry update. **Files changed**: `src/config/audit-value-catalogs.ts` (new SSoT), `src/components/shared/audit/audit-value-resolver.ts` (new), `src/components/contacts/tabs/ContactHistoryTab.tsx` (refactor), `src/components/shared/audit/audit-timeline-entry.tsx` (refactor), `src/components/shared/audit/activity-tab-helpers.ts` (doc update), `scripts/check-audit-value-catalogs.js` (new validator), `.git/hooks/pre-commit` (CHECK 3.14 wire-up), `package.json` (audit-values:audit script), ADR-195 (this entry). **Verification**: validator green on current state; negative test confirms block-on-regression behaviour; 4 tracked enum fields are now SSoT-enforced end-to-end (config → runtime → CI). **Deployment**: commit only, push waits for Γιώργος' explicit order per CLAUDE.md N.(-1). **Follow-up**: add more fields to `AUDIT_VALUE_CATALOGS` incrementally as audit-tracked enum fields are identified (`companyType`, `serviceType`, `maritalStatus`, `gemiStatus`, etc.) — each addition is automatically enforced by CHECK 3.14. | Claude Agent |
| 2026-04-11 | **Phase 9.1 — Audit resolver snake→camel normalization + CHECK 3.14 camelCase guard-rail**. Reported by Γιώργος: after Phase 9 wired `AUDIT_VALUE_CATALOGS` → `resolveAuditValue`, the `category` audit trail still showed mixed output — `police → court`, `chamber → utility`, `Εφορία → social_security`, `fire_department → Αστυνομία`. **Root cause**: form option values in `src/subapps/dxf-viewer/config/modal-select/core/options/company.ts:50-70` persist as snake_case tokens (`fire_department`, `public_entity`, `social_security`, `urban_planning`, `land_registry`, `independent_authority`), while the canonical i18n catalog at `contacts-form:options.serviceCategories` normalizes enum keys to camelCase per ADR-279 (`fireDepartment`, `publicEntity`, ...). Phase 9's `lookupInCatalog` did a single direct lookup `{path}.{value}` — for single-word values (`ministry`, `police`, `court`, `chamber`, `utility`) the two representations coincide and resolved correctly; for multi-word values they diverged and silently fell through to the legacy `common:audit.values.*` fallback, which coincidentally had a stale `tax_office` entry (legacy seed) and nothing else for the new 16-entry catalog → raw snake_case tokens surfaced in the timeline. **Why Phase 9's CHECK 3.14 did not catch it**: the validator verified catalog existence + el/en parity but did not model the resolver's lookup semantics. The catalogs were perfectly valid — the resolver just couldn't reach them with the stored form value. **Fix #1 — resolver normalization** (`src/components/shared/audit/audit-value-resolver.ts`): Added `toCamelCase(value)` pure helper (`/[_-]([a-z0-9])/g` → uppercase) and `tryTranslate(key, opts, t)` probe. `lookupInCatalog` now does **direct → snake→camel fallback**: first tries `{path}.{value}` verbatim, then if the value contains `_` or `-` retries with the normalized form. Resolution order documented from 5 layers to 6 (new step #2). Zero data migration — existing audit entries render correctly on next read. Zero new config — the catalog stays the single source of truth. The conversion is strictly one-way (snake → camel), so it can never create ambiguity provided the catalogs themselves don't contain snake_case keys — which Fix #2 enforces. **Fix #2 — CHECK 3.14 guard-rail extension** (`scripts/check-audit-value-catalogs.js`): Added `findSnakeCaseKeys(catalog)` which flags keys matching `^[a-z][a-z0-9]*[_-][a-z0-9_-]+$`. Each referenced catalog is now validated for **camelCase-only enum keys** in both el and en; any snake_case or kebab-case drift aborts the commit. Allowed by design: SCREAMING_SNAKE sentinel enums (`NAME_A_TO_Z`), Greek/UTF-8 abbreviations (`ΑΕ`, `ΕΠΕ`), and camelCase (`fireDepartment`) — only lowercase snake/kebab is rejected. **Motivation**: the one-way `snake → camel` fallback is safe if and only if catalogs contain no snake_case keys; a mixed catalog could alias two distinct entries to the same camelCase form and silently shadow one of them. CHECK 3.14 now enforces the invariant at commit time. Sanity test: temporarily renamed `fireDepartment` → `fire_department` in `el/contacts-form.json` → validator correctly reported `[category] el:contacts-form:options.serviceCategories → keys must be camelCase (ADR-279); found snake/kebab: fire_department` + parity errors, exit 1. **Fix #3 — unit tests** (`src/components/shared/audit/__tests__/audit-value-resolver.test.ts`, new file, 6/6 pass in 7s): pin the regression with six scenarios — (a) direct camelCase hit (`ministry`), (b) snake→camel normalization for all six failing `serviceCategories` values (`public_entity`, `independent_authority`, `social_security`, `urban_planning`, `land_registry`, `fire_department`), (c) unknown-value passthrough (`does_not_exist` → undefined), (d) cross-field generalization (`documentType`: `identity_card` → `identityCard`), (e) unregistered-field legacy fallback (`status`: `approved` via `common:audit.values`), (f) ISO-8601 date formatting. Test harness mocks `i18next` with a simple Map-backed store so tests stay pure. **Files changed**: `src/components/shared/audit/audit-value-resolver.ts` (+37 lines: `toCamelCase`, `tryTranslate`, refactored `lookupInCatalog`, updated module docblock), `scripts/check-audit-value-catalogs.js` (+28 lines: `findSnakeCaseKeys` guard + integration into the validation loop), `src/components/shared/audit/__tests__/audit-value-resolver.test.ts` (new, 112 lines), ADR-195 (this entry). **Verification**: (1) `npx jest audit-value-resolver.test.ts` → 6/6 green in 7s; (2) `node scripts/check-audit-value-catalogs.js` → 4 fields validated, all camelCase-clean; (3) negative test (injected snake_case key into `el/contacts-form.json`) → validator blocks with clear error message; (4) the original failing trail (`public_entity → independent_authority → Εφορία → social_security → urban_planning → land_registry → fire_department → Αστυνομία → Δικαστήριο → Επιμελητήριο → ΔΕΚΟ`) will now render every segment translated on next page load because the resolver reaches the same `contacts-form:options.serviceCategories.*` entries as the form dropdown. **Deployment**: commit only, push waits for Γιώργος' explicit order per CLAUDE.md N.(-1). **No data migration** — audit entries stored before the fix will resolve correctly on display without rewriting Firestore. **Follow-up**: none required. The fix is structurally closed — (resolver normalization) × (CHECK 3.14 camelCase guard) × (unit test lock-in) × (ADR-279 catalog convention) = SSoT loop with compile-time + runtime + CI enforcement. | Claude Agent |
| 2026-04-11 | **Phase 10 — Client-side `onSnapshot` SSoT for audit trail** (Google-level real-time). Reported by Γιώργος: added a bank account to a legal-entity contact from the "Τραπεζικά" tab; the audit entry showed up immediately in the per-contact `ContactHistoryTab` (served from a different subcollection subscription) but **not** in the `/admin/audit-log` global view — a hard refresh was required. **Root cause**: `useGlobalAuditTrail` relied on a manually maintained `GLOBAL_AUDIT_WATCH_EVENTS` allowlist of `RealtimeService` events to trigger a debounced REST refetch (Phase 8 design). The banking write path (`ContactBankingTab` → `BankAccountsService.addAccount` → `/api/contacts/{id}/bank-accounts` → `bank-accounts-server.service.ts` → subcollection `contacts/{id}/bank_accounts/{accountId}` + `EntityAuditService.recordChange()`) never dispatches a `CONTACT_UPDATED` event, so the Phase 8 refresh was a no-op. `useEntityAudit` had the symmetric problem via `ENTITY_EVENT_MAP`. Structurally, any new audit write path that didn't also remember to fire a `RealtimeService` event would silently break live updates for both hooks — "coupling by convention", the exact anti-pattern Google-level SSoT is meant to eliminate. **Google-level fix — eliminate the event list entirely**: the `entity_audit_trail` Firestore collection **is** the source of truth, so the client subscribes directly to it via `onSnapshot` and fans out the moment any server write lands — no intermediate event bus, no debounce guesswork, zero maintenance when new audit write paths are added. This is the exact Firebase-native pattern Google uses for Firestore real-time fan-out. **Implementation**: (1) **New canonical client reader** `src/services/entity-audit-client.service.ts` — thin wrapper that composes `firestoreQueryService.subscribe` (ADR-214) rather than calling `onSnapshot` directly, so the tenant filter (`companyId == userCompanyId`) is auto-injected by `buildTenantConstraints()` and the existing `firestore-realtime` SSoT module stays intact. Exposes two methods: `subscribeGlobal({ limit, filters }, callback)` for the admin view (over-fetches by 3x when client-side filters are active) and `subscribeEntity({ entityType, entityId, limit }, callback)` for per-entity History tabs. Returns the standard Firestore `Unsubscribe`. (2) **`firestore.rules` hardening** — new `match /entity_audit_trail/{auditId}` block: `allow read: if isAuthenticated() && (isSuperAdminOnly() || (isCompanyAdminOfCompany(resource.data.companyId) && belongsToCompany(resource.data.companyId)))`, `allow write: if false`. Admin-only, tenant-scoped, read-only. Server writes continue to go through the Admin SDK which bypasses rules. Requires `firebase deploy --only firestore:rules`. (3) **`useGlobalAuditTrail` refactor** — replaced the entire HTTP-polling + `GLOBAL_AUDIT_WATCH_EVENTS` + 500 ms debounce block with a single `subscribeGlobal` effect keyed on `(user, pageSize, filtersKey)`. `loadMore` still uses the paginated `/api/audit-trail/global` endpoint for history beyond the live window (older than the last N entries the subscription holds); new state shape has `liveEntries` + `historyEntries` merged + deduped + sorted via `dedupeAndSort`. `refetch` kept as an API-compatible no-op that just clears transient error state — the subscription is already live. Removed imports: `RealtimeService`, `RealtimeEventMap`. Deleted constant: `GLOBAL_AUDIT_WATCH_EVENTS` (23 events). (4) **`useEntityAudit` refactor** — symmetric change with `subscribeEntity`. Removed `ENTITY_EVENT_MAP` (10 entity type entries), removed `RealtimeService` import, removed the 500 ms debounced refetch effect. `loadMore` still uses the paginated `/api/audit-trail/[entityType]/[entityId]` endpoint. (5) **SSoT registry tightening** — expanded `entity-audit-trail` module in `.ssot-registry.json`: added forbidden patterns `(function\s+useGlobalAuditTrail\s*\(|const\s+useGlobalAuditTrail\s*=)` to block hook re-implementations and `(GLOBAL_AUDIT_WATCH_EVENTS|ENTITY_EVENT_MAP)\s*=` as a regression guard against anyone reintroducing manual event allowlists. Added `src/services/entity-audit-client.service.ts` and `src/hooks/useGlobalAuditTrail.ts` to the allowlist. Rewrote the module `description` to name the full closed loop (server write via `EntityAuditService.recordChange` → client read via `EntityAuditClientService.subscribe*` → canonical hooks `useEntityAudit` + `useGlobalAuditTrail`). (6) **Composite indexes** — already present from Phase 7: `(companyId asc, timestamp desc)` for global subscription and `(entityType asc, entityId asc, companyId asc, timestamp desc)` for per-entity. No `firestore.indexes.json` changes needed. **Why compose `firestoreQueryService` instead of raw `onSnapshot`**: keeps this service aligned with the Phase 8/2A `firestore-realtime` SSoT ratchet — the canonical tenant-aware subscription layer is `firestoreQueryService.subscribe()` (ADR-214), not bespoke `onSnapshot(query(collection(...)))`. Phase 10 could have added `src/services/entity-audit-client.service.ts` to the `firestore-realtime` allowlist instead, but that would have meant introducing a second parallel canonical layer — the exact duplication the ratchet was built to prevent. Composing the existing service is strictly smaller in surface area. **Files changed**: `src/services/entity-audit-client.service.ts` (new, 223 lines), `src/hooks/useGlobalAuditTrail.ts` (full refactor: 212 → 218 lines — HTTP-polling removed, live subscription + historical pagination split), `src/hooks/useEntityAudit.ts` (full refactor: 157 → 201 lines — same pattern), `firestore.rules` (+22 lines: `match /entity_audit_trail/{auditId}` block), `.ssot-registry.json` (entity-audit-trail module tightened), `.ssot-violations-baseline.json` (regenerated), ADR-195 (this entry + status header), `docs/centralized-systems/reference/adr-index.md` (status update). **Verification**: `bash scripts/check-ssot-imports.sh` → exit 0; manual review confirms `firestore-realtime` SSoT intact (no raw `onSnapshot` in the new client service — routes through `firestoreQueryService.subscribe`). **Deployment**: commit only; Firestore rules deploy (`firebase deploy --only firestore:rules`) waits for Γιώργος' explicit order per CLAUDE.md N.(-1). **Before rollout, Γιώργος must deploy the rules** — until then the client subscription will fail with `permission-denied` because `entity_audit_trail` was previously server-only. **Follow-up**: none required. The loop is now structurally closed — any new audit write path (banking, contracts, documents, AI pipeline, …) will automatically surface in both the per-entity and global admin views in real time, with zero code changes. That is the Google-level invariant this phase establishes. | Claude Agent |
| 2026-04-11 | **Phase 2A — firestore-realtime SSoT correction + `useLegalContracts` migration** (ADR-195 ratchet-down kickoff). Follow-up to commit `7760e6d3` (Phase 8). Exploration for the Phase 2 legacy migration revealed a **structural mistake** in the Phase 8 allowlist: the `firestore-realtime` module named only `RealtimeService` + `services/realtime/hooks/` as canonical, missing `src/services/firestore/firestore-query.service.ts` (**ADR-214** — Unified Firestore Query Layer). The 3 `onSnapshot(` call sites inside `firestore-query.service.ts` (lines 261, 308, 360) are **framework internals** implementing `subscribe`/`subscribeDoc`/`subscribeSubcollection` with automatic `companyId`/`tenantId` tenant filtering via `buildTenantConstraints()` — not violations. Proof: the canonical `useRealtimeBuildings.ts:144` and `useRealtimeProperties.ts` hooks call `firestoreQueryService.subscribe()`, not `RealtimeService.subscribeToCollection()`. Architectural hierarchy is `firestoreQueryService` = primary (tenant-aware), `RealtimeService` = secondary (event bus + raw wrapping). **Fix #1 — allowlist correction**: Added `src/services/firestore/firestore-query.service.ts` to the `firestore-realtime` allowlist. Rewrote the module `description` to explicitly name both canonical layers and declare `firestoreQueryService` as the preferred migration target because it auto-injects tenant filters. **Fix #2 — `useLegalContracts.ts` migration** (first ratchet-down): Replaced raw `onSnapshot(query(collection(db, COLLECTIONS.BROKERAGE_AGREEMENTS), where('companyId','==',companyId), where('projectId','==',projectId)))` with `firestoreQueryService.subscribe<DocumentData>('BROKERAGE_AGREEMENTS', onData, onError, { constraints: [where('projectId','==',projectId)] })`. The `companyId` constraint was removed entirely — `BROKERAGE_AGREEMENTS` is not in `TENANT_OVERRIDES` at `tenant-config.ts:24-57`, so it defaults to `{ mode: 'companyId', fieldName: 'companyId' }` and `buildTenantConstraints()` auto-injects the filter. Removed unused imports (`collection`, `query`, `onSnapshot`, `db`, `COLLECTIONS`), kept `where` for the projectId constraint. Added `type DocumentData` + `type QueryResult` imports. Error handler signature unchanged (`(err: Error) => void`). The data mapping was simplified from `snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))` to `result.documents.map((d) => ({ ...d }))` because `firestoreQueryService.subscribe` already spreads `{ id, ...data }` internally at line 263. **Baseline regenerated**: 26 → 22 violations, 23 → 19 files (-4 total: -3 from the allowlist correction removing `firestore-query.service.ts` spurious count, -1 from the `useLegalContracts` migration). **Why `useLegalContracts.ts` first**: out of 22 legacy scattered callers it was the lowest-risk target — simple 2-constraint collection query, no subcollections, no waterfall dependencies, collection already uses the default `companyId` tenant mode. Serves as the **reference migration pattern** for the remaining 21 call sites (Phase 2B+): (1) swap imports, (2) remove `companyId` where (if default tenant mode), (3) call `firestoreQueryService.subscribe` with custom constraints, (4) map `result.documents`. Note that legitimately subcollection-backed hooks (like `useFloorOverlays.ts` with its 2-step waterfall) need `subscribeSubcollection` and are deferred until Phase 2C. **Files changed**: `.ssot-registry.json` (allowlist fix), `src/hooks/useLegalContracts.ts` (migration), `.ssot-violations-baseline.json` (regenerated), ADR-195 (this entry + status header + correction note on Phase 8). **Verification**: pre-commit hook passes; `npm run ssot:audit` confirms `firestore-realtime` module ratcheted down 4 violations; manual review of `useRealtimeBuildings.ts:130-184` confirms the pattern match. **No production deploy** — commit only, push waits for Γιώργος' explicit order per CLAUDE.md N.(-1). | Claude Agent |
| 2026-04-11 | **Phase 10 hotfix — `entity_audit_trail` rule restructure + super-admin composite index + CHECK 3.15 Firestore Index Coverage gate**. Reported by Γιώργος after the Phase 10 deploy: the Ιστορικό tab in `/projects/[id]`, the Settings → Activity log route, and the `/contacts` History tabs on φυσικά / νομικά / δημόσιες υπηρεσίες all returned `permission-denied`. **Root cause #1 — rule AND-chain short-circuit on LIST queries**: the Phase 10 rule was `allow read: if isAuthenticated() && resource.data.keys().hasAny(['companyId']) && (isSuperAdminOnly() || (isCompanyAdminOfCompany(resource.data.companyId) && belongsToCompany(resource.data.companyId)))`. Firestore evaluates LIST query rules per matched document, and any single legacy audit entry without a `companyId` key (known to exist from pre-production test data) failed the top-level `hasAny(['companyId'])` AND-guard **before** reaching the `isSuperAdminOnly()` short-circuit — denying the entire query even for super admins. **Fix #1**: restructured the rule to move the `hasAny` guard inside the company-admin branch only, mirroring the `/projects` rule pattern: `allow read: if isAuthenticated() && (isSuperAdminOnly() || (resource.data.keys().hasAny(['companyId']) && isCompanyAdminOfCompany(resource.data.companyId) && belongsToCompany(resource.data.companyId)))`. Deployed via `firebase deploy --only firestore:rules --project pagonis-87766`. **Root cause #2 — missing super-admin composite index**: with the rule fix in place, the `subscribeEntity` query (`where entityType + where entityId + orderBy timestamp desc`) now evaluated its super-admin variant (no `companyId` prefix) because `firestoreQueryService.buildTenantConstraints()` early-returns `[]` for `ctx.isSuperAdmin`. The only composite index covering that shape was `[companyId, entityType, entityId, timestamp desc]` — the super-admin path had no matching index and surfaced as `FAILED_PRECONDITION`. **Fix #2**: added `{entityType asc, entityId asc, timestamp desc}` to `firestore.indexes.json`. Deployed via `firebase deploy --only firestore:indexes --project pagonis-87766`. Index build latency is 2–5 minutes — during that window queries may still return empty / failed. **Fix #3 — CHECK 3.15 Firestore Index Coverage (zero-tolerance pre-commit gate)**: this exact class of bug (a SSoT query whose derived super-admin shape lacks a composite index) is now caught statically at commit time. Implementation: `scripts/check-firestore-index-coverage.js` (660 lines, Node + TypeScript AST) walks every staged `src/**/*.{ts,tsx}` file, picks out direct calls of the form `firestoreQueryService.subscribe(KEY, ..., { constraints: [...] })` or `.getAll(KEY, { constraints: [...] })`, **scope-aware-resolves** shorthand `{ constraints }` identifier references to their enclosing function's local `const constraints = [...]` declaration (critical — without scope awareness a module with two functions using the same identifier would silently collapse into one shape), parses inline `where('field', '==', ...)` and `orderBy('field', 'asc'|'desc')` helpers, then derives **both** tenant variants per call site: (a) the default variant with the tenant field auto-prefixed to the equality set, and (b) the super-admin variant with just the user-specified equality fields — mirroring `buildTenantConstraints()` + `ctx.isSuperAdmin` early-return exactly. A shared helper module `scripts/_shared/firestore-index-matcher.js` (232 lines) loads `firestore.indexes.json`, decides via `requiresCompositeIndex` whether each shape needs a composite (single-field queries skipped because Firestore auto-indexes them), and checks coverage via `indexCoversShape` — unordered set match on the equality prefix followed by a strict ordered match on the orderBy suffix, with prefix-match semantics so a longer index still serves a shorter query. Missing shapes emit a fail report with a ready-to-paste `firestore.indexes.json` snippet. Wired into `scripts/git-hooks/pre-commit` as CHECK 3.15 between CHECK 3.14 and CHECK 4. **Scope**: staged src files only — pre-existing backlog is grandfathered until the owning file is next touched (Boy Scout rule). A broken index is a production incident, not a tech-debt category, so **no baseline file** — the ratchet pattern (appropriate for i18n / SSoT legacy counts) does not apply. Staged-scope zero-tolerance is the Google presubmit equivalent for security / correctness gates: if you touched the file, it must be clean. `package.json` exposes `npm run firestore:indexes:audit` (`--all --verbose`) for CI and manual full scans. **Verification**: (1) regression test — `git stash push firestore.indexes.json` (simulates pre-fix state) + `node scripts/check-firestore-index-coverage.js src/services/entity-audit-client.service.ts` → exit 1, reports exactly the missing `[entityType, entityId, timestamp desc]` super-admin index on `entity-audit-client.service.ts:221:12` (would have caught today's bug pre-push); (2) positive test — same command against the current (fixed) indexes → exit 0, 3 composite shapes analysed; (3) full scan — `npm run firestore:indexes:audit` → 39 pre-existing missing shapes across 30 files, surfaced for Boy Scout triage but not blocking pre-commit. **Why a fingerprint dedupe in the reporter**: when a caller explicitly writes `where('companyId', '==', ...)` the default and super-admin shapes collapse onto the same equality set, so the report would otherwise list the same missing index twice per call. Dedupe key is the canonical `collection|sortedEq|orderBy|arrayContains` fingerprint. **Files changed**: `firestore.rules` (+4 / −2 lines in `match /entity_audit_trail/{auditId}`), `firestore.indexes.json` (+14 lines: new `[entityType, entityId, timestamp desc]` composite), `scripts/check-firestore-index-coverage.js` (new, 660 lines), `scripts/_shared/firestore-index-matcher.js` (new, 232 lines), `scripts/git-hooks/pre-commit` (+47 lines: CHECK 3.15 block between CHECK 3.14 and CHECK 4), `package.json` (+1 line: `firestore:indexes:audit` npm script), `src/components/generic/utils/IconMapping.ts` (unrelated percent-icon fix staged from an earlier session, committed together), ADR-195 (this entry). **Deployment**: Firestore rules + indexes already live on `pagonis-87766` (deployed as part of the hotfix). Commit remaining; push waits for Γιώργος' explicit order per CLAUDE.md N.(-1). **Follow-up**: the 39 pre-existing missing-index shapes from `npm run firestore:indexes:audit` should be triaged as a separate Boy Scout cleanup phase — most are in services / hooks that have worked in production because their queries happen to be served by single-field auto-indexes under the tenant-injected path, with the super-admin variant either unused or served by a coincidental covering index. CHECK 3.15 will force each one clean when the owning file is next touched. | Claude Agent |
| 2026-04-11 | **Project creation write path wired to `EntityAuditService`**. Γιώργος reported: after creating a project from `/projects`, the per-project History tab was empty — no `created` entry. Root cause: `src/app/api/projects/list/project-create.handler.ts` wrote the Firestore document and logged via legacy `logAuditEvent()` but never called `EntityAuditService.recordChange()`, so the `entity_audit_trail` collection that powers `ActivityTab` (wired via `project-tabs-config.ts` order 14, component `ActivityTab`, `componentProps: { entityType: 'project' }`) had no row to display. Symmetric gap to the Phase 3 wire-up — the reader side was done, the writer side for project *creation* was missing. **Fix**: after the `adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).set(...)` call, invoke `EntityAuditService.recordChange({ entityType: ENTITY_TYPES.PROJECT, entityId: projectId, entityName: body.name, action: 'created', changes: [name, projectCode, linkedCompanyId], performedBy: ctx.uid, performedByName: ctx.email, companyId: resolvedCompanyId })`. Uses `ENTITY_TYPES.PROJECT` from `@/config/domain-constants` (canonical enum) and `resolvedCompanyId` (honours super-admin tenant resolution via `linkedCompanyId`). Fire-and-forget by design — `recordChange` never throws, logs internally on failure. Legacy `logAuditEvent` call left intact (serves the separate `/admin/audit-log` view's legacy path; will be retired in a later phase once CDC coverage is verified). **Files changed**: `src/app/api/projects/list/project-create.handler.ts` (+23 lines), ADR-195 (this entry). **Verification**: manual — create project from `/projects`, open created project, switch to Ιστορικό tab, observe the `created` entry appear immediately via the Phase 10 `onSnapshot` live subscription. **Deployment**: commit only, push waits for Γιώργος' explicit order per CLAUDE.md N.(-1). **Follow-up**: the same pattern needs to be applied to project *update* and *delete* paths for full coverage — tracked as separate work. | Claude Agent |
| 2026-04-11 | **CHECK 3.17 — Entity Audit Coverage scanner + pre-commit gate**. Symmetric closure to the reader-side SSoT entry `entity-audit-trail` in `.ssot-registry.json` (which forbids direct writes to the `entity_audit_trail` collection). New file-level ratchet scanner `scripts/check-entity-audit-coverage.js` flags any `src/**/*.{ts,tsx}` file that writes to a tracked collection (`projects`, `contacts`, `buildings`, `properties`, `floors`, `parking`, `storage`, `purchase_orders`, `companies` via `COLLECTIONS.<KEY>` + `setDoc`/`updateDoc`/`deleteDoc`/`addDoc`/`.set(`/`.update(`/`.delete(`/`.add(`) **without** a matching `EntityAuditService.recordChange(` call in the same file. Baseline: `.entity-audit-coverage-baseline.json` (70 legacy files grandfathered, full `src/` scan 2026-04-11). Wired into `scripts/git-hooks/pre-commit` as CHECK 3.17 — runs on staged `src/**/*.{ts,tsx}`. Commands: `npm run audit-coverage:audit` (full verbose scan), `npm run audit-coverage:baseline` (refresh). `CLAUDE.md` N.12 gets a new section below CHECK 3.16. Rationale: the reader-side registry entry guarantees audit rows are immutable and only written via the canonical service — it does NOT guarantee that every mutation on a tracked entity produces a row. The writer-side gap manifested as the 2026-04-11 project-creation incident above (UI wire-up fine, writer missing). File-level v1 granularity is deliberately coarse (a file with one covered + one uncovered write currently passes); existing migrated handlers are 1-write-per-file, and the ratchet + boy-scout rule will surface remaining gaps on touch. Scope-aware (per-function) refinement is a v2 follow-up if false-negatives show up. **Files changed**: `scripts/check-entity-audit-coverage.js` (new, 397 lines), `.entity-audit-coverage-baseline.json` (new, 70 files), `scripts/git-hooks/pre-commit` (+CHECK 3.17 block, ~45 lines), `package.json` (+2 scripts), `CLAUDE.md` (+N.12 section), ADR-195 (this entry). Scanner + baseline landed in commit `377bbdc4` earlier today; this commit completes the wire-up. | Claude Agent |
| 2026-04-11 | **Project update + delete write paths wired to `EntityAuditService`**. Closes the follow-up noted in the 2026-04-11 project-creation entry: `src/app/api/projects/[projectId]/project-mutations.service.ts` — both `handleUpdateProject` and `handleDeleteProject` were writing via `withVersionCheck()` / `softDelete()` and logging through the legacy `logAuditEvent()` only, so the per-project History tab missed every update and every move-to-trash event. **Fix**: after the version-checked write in `handleUpdateProject`, invoke `EntityAuditService.recordChange({ action: 'updated', changes: <one AuditFieldChange per dirty field with oldValue from projectData.data() and newValue from cleanData>, entityType: ENTITY_TYPES.PROJECT, entityId: projectId, entityName: projectData.name, performedBy: ctx.uid, performedByName: ctx.email, companyId: projectData.companyId ?? ctx.companyId })`. Same pattern in `handleDeleteProject` after `softDelete()` with `action: 'deleted'` and a single `status` change entry (`oldValue: projectData.status`, `newValue: 'deleted'`). Legacy `logAuditEvent()` calls left intact in both handlers for the `/admin/audit-log` legacy path. Uses `ENTITY_TYPES.PROJECT` from `@/config/domain-constants` and preserves the existing tenant resolution (`projectData.companyId ?? ctx.companyId`). **Ratchet**: CHECK 3.17 baseline ticked down from 70 → 69 files after the baseline refresh (`npm run audit-coverage:baseline`). **Files changed**: `src/app/api/projects/[projectId]/project-mutations.service.ts` (+45 lines), `.entity-audit-coverage-baseline.json` (1 file removed from baseline), `.ssot-registry.json` (added writer-side cross-reference to `entity-audit-trail` description pointing at CHECK 3.17), ADR-195 (this entry). **Verification**: manual — edit a project from `/projects/[id]`, open the Ιστορικό tab, observe the `updated` entry with per-field old/new values; move the project to trash, observe the `deleted` entry. **Follow-up**: same pattern now needs to propagate to contacts / buildings / properties / floors / parking / storage / purchase_orders / companies write paths — tracked under the CHECK 3.17 ratchet backlog (69 remaining files). | Claude Agent |
