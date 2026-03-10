# ADR-195: Entity Audit Trail — Κεντρικοποιημένο Σύστημα Ιστορικού Αλλαγών

> **Status**: APPROVED (Documentation Only — Implementation Pending)
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
- **Props**: `entityType`, `entityId`
- **Features**:
  - Timeline layout (vertical, newest first)
  - Field-level diffs with old → new values
  - User avatars/initials
  - Relative timestamps ("2 hours ago")
  - Infinite scroll pagination (20 entries per page)
  - Empty state ("No activity recorded yet")
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
