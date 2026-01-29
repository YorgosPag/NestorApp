# Migration Plan: companyId Field Backfill

**Created**: 2026-01-29
**Status**: PENDING
**Priority**: CRITICAL (Security Gate Blocker)

---

## 1. OVERVIEW

This document describes the migration strategy for adding `companyId` to all Firestore collections that currently lack tenant isolation.

**Root Cause**: Many collections were created before enterprise multi-tenant architecture was implemented. Documents are missing the `companyId` field required for tenant isolation.

**Risk**: Without `companyId`, cross-tenant data leakage is possible.

---

## 2. AFFECTED COLLECTIONS

### 2.1 PR-1A (CRITICAL HOTFIX) - Buildings
| Collection | Current State | Migration Strategy |
|------------|---------------|-------------------|
| `buildings` | Some have `companyId`, some only have `projectId` | Derive from project→companyId lookup |

### 2.2 PR-1B (CRITICAL) - CRM + Messaging
| Collection | Current State | Migration Strategy |
|------------|---------------|-------------------|
| `projects` | Has `company` field (string name, not ID) + should have `companyId` | Verify all have `companyId` |
| `tasks` | May have `projectId` or `leadId` | Derive from project/lead→companyId |
| `leads` | May have `companyId` or not | Add companyId from creator's company |
| `opportunities` | May have `projectId` | Derive from project→companyId |
| `activities` | May have `contactId` or `projectId` | Derive from contact/project→companyId |
| `communications` | Unknown | Add companyId from conversation |
| `conversations` | Unknown | Add companyId from first participant |
| `messages` | Has `conversationId` | Inherit from conversation→companyId |
| `external_identities` | Unknown | Add companyId from linked contact |
| `relationships` | Unknown | Add companyId from source entity |
| `analytics` | Unknown | Add companyId from user claim |
| `workspaces` | Unknown | Should be company-scoped |

### 2.3 PR-1C (HIGH) - DXF/Floorplans
| Collection | Current State | Migration Strategy |
|------------|---------------|-------------------|
| `project_floorplans` | Has `projectId` | Derive from project→companyId |
| `building_floorplans` | Has `buildingId` | Derive from building→companyId |
| `unit_floorplans` | Has `unitId` | Derive via unit→project→companyId |
| `floorplans` | Unknown | Derive from parent entity |
| `layers` | Unknown | Add companyId from creator |
| `layerGroups` | Unknown | Add companyId from creator |
| `dxf-viewer-levels` | Unknown | Add companyId from creator |
| `dxf-overlay-levels` | Unknown | Add companyId from creator |

### 2.4 PR-1D (MED/HIGH) - Obligations + Infra + CRM FIX
| Collection | Current State | Migration Strategy |
|------------|---------------|-------------------|
| `obligations` | May have `projectId` | Derive from project→companyId |
| `obligationTemplates` | Unknown | Add companyId from creator |
| `obligation-sections` | Unknown | Derive from obligation→companyId |
| `floors` | Has `buildingId` | Derive from building→companyId |
| `storage_units` | Has `buildingId` | Derive from building→companyId |
| `parking_spots` | Has `buildingId` | Derive from building→companyId |
| `teams` | Should be company-scoped | Add companyId |
| `admin_building_templates` | Unknown | Add companyId from creator |
| `opportunities` | May have `projectId` | Derive from project→companyId (**FIX**) |
| `leads` | May have `companyId` or not | Add companyId from creator (**FIX**) |
| `activities` | May have `contactId` or `projectId` | Derive from contact/project→companyId (**FIX**) |
| `counters` | Global (project codes) | **KEEP GLOBAL** - no tenant isolation needed |

---

## 3. MIGRATION STRATEGY

### 3.1 Approach: Gradual Backfill

**Phase 1: Firestore Rules (Transitional)**
- Rules allow `get` for creator-only (legacy docs without companyId)
- Rules deny `list` without companyId (prevents enumeration)
- Rules require `companyId == getUserCompanyId()` on update (forces backfill)

**Phase 2: Batch Migration Script**
- Admin-only Cloud Function or one-off script
- For each collection:
  1. Query all docs without `companyId`
  2. Derive `companyId` from parent reference (project, building, contact, etc.)
  3. Batch update with `companyId`
  4. Log migration audit

**Phase 3: Verification**
- Query each collection for docs without `companyId`
- Success criteria: 0 documents without `companyId`
- Remove transitional fallback from rules

### 3.2 Migration Script Template

```typescript
// scripts/migrate-companyId.ts
import { adminDb } from '@/lib/firebaseAdmin';

async function migrateCollection(
  collectionName: string,
  deriveCompanyId: (doc: FirebaseFirestore.DocumentData) => Promise<string | null>
) {
  const snapshot = await adminDb
    .collection(collectionName)
    .where('companyId', '==', null) // or use != check
    .get();

  const batch = adminDb.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const companyId = await deriveCompanyId(doc.data());
    if (companyId) {
      batch.update(doc.ref, { companyId, _migratedAt: new Date() });
      count++;
    }
  }

  await batch.commit();
  console.log(`Migrated ${count} documents in ${collectionName}`);
}

// Example: buildings
await migrateCollection('buildings', async (data) => {
  if (data.projectId) {
    const project = await adminDb.collection('projects').doc(data.projectId).get();
    return project.data()?.companyId || null;
  }
  return null;
});
```

---

## 4. ROLLOUT PLAN

### Week 1: PR-1A + PR-1B
1. Deploy Firestore rules with transitional fallback
2. Monitor for access denials (audit logs)
3. Run migration script for `buildings`
4. Run migration script for CRM collections

### Week 2: PR-1C + PR-1D
1. Deploy remaining rules updates
2. Run migration scripts for DXF/Floorplans
3. Run migration scripts for Obligations/Infra
4. Verify 0 documents without companyId

### Week 3: Remove Transitional Fallback
1. Query all collections for missing companyId
2. If 0 remaining, remove transitional fallback from rules
3. Final security audit

---

## 5. SUCCESS CRITERIA

- [ ] All collections have `companyId` field requirement in Firestore rules
- [ ] 0 documents without `companyId` in any tenant-scoped collection
- [ ] Cross-tenant read/write tests pass (deny Tenant A → Tenant B)
- [ ] Transitional fallback removed from all rules
- [ ] Audit logs show no unauthorized access attempts

---

## 6. RELATED DOCUMENTS

- [03-auth-rbac-security.md](./03-auth-rbac-security.md) - Security audit findings
- [10-risk-register-and-decisions.md](./10-risk-register-and-decisions.md) - Risk R-001
- `firestore.rules` - Security rules implementation

---

**Owner**: Security Team
**Reviewer**: Γιώργος
