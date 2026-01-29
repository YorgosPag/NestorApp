# PR-2: Data Migration - companyId Backfill

**Status**: Pending (Blocked by PR-1A, PR-1B, PR-1C)
**Created**: 2026-01-29
**Author**: Claude (Anthropic AI)
**Priority**: Required for full tenant isolation

---

## Executive Summary

This PR implements an **idempotent migration script** to backfill `companyId` to all legacy documents that are missing this field. This is required to complete the tenant isolation work started in PR-1A.

### Prerequisites

- [x] PR-1A: Firestore Tenant Isolation (rules in place)
- [ ] PR-1B: MFA Enforcement
- [ ] PR-1C: Rate Limiting

---

## Problem Statement

Some documents were created before the tenant isolation model was implemented. These documents:

1. **Have NO `companyId` field**
2. **Currently use fail-closed fallback** (creator-only access via `createdBy`)
3. **Need `companyId` added** to restore company-wide access

### Affected Collections

Based on PR-1A analysis, documents without `companyId` exist in:

| Collection | Estimated Count | Fallback Mode |
|------------|-----------------|---------------|
| `projects` | Unknown | Creator-only |
| `buildings` | Unknown | Project lookup |
| `contacts` | Unknown | Creator-only |
| `units` | N/A | Always via project |

---

## Solution Architecture

### Migration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Migration Script                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. DRY RUN MODE (default)                          │    │
│  │     - Count documents without companyId             │    │
│  │     - Log what would be migrated                    │    │
│  │     - NO actual writes                              │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │ --execute flag                    │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  2. EXECUTE MODE (with flag)                        │    │
│  │     - Batch documents (500 per batch)               │    │
│  │     - Lookup companyId from createdBy user profile  │    │
│  │     - OR from project reference                     │    │
│  │     - Update documents in batches                   │    │
│  │     - Log every operation to audit collection       │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  3. VERIFICATION                                    │    │
│  │     - Count migrated documents                      │    │
│  │     - Verify no documents remain without companyId  │    │
│  │     - Generate migration report                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### companyId Lookup Strategy

```typescript
// Priority order for determining companyId:
async function lookupCompanyId(doc: DocumentData): Promise<string | null> {
  // 1. Check if document has projectId → lookup project's companyId
  if (doc.projectId) {
    const project = await getDoc(doc(db, 'projects', doc.projectId));
    if (project.exists() && project.data().companyId) {
      return project.data().companyId;
    }
  }

  // 2. Check if document has createdBy → lookup user's company
  if (doc.createdBy) {
    const user = await getDoc(doc(db, 'users', doc.createdBy));
    if (user.exists() && user.data().companyId) {
      return user.data().companyId;
    }
  }

  // 3. Fallback: Cannot determine company - flag for manual review
  return null;
}
```

---

## Implementation

### Migration Script

**File**: `scripts/migrations/backfill-companyId.ts`

```typescript
/**
 * Migration Script: Backfill companyId to legacy documents
 *
 * Usage:
 *   # Dry run (default) - no changes
 *   npx ts-node scripts/migrations/backfill-companyId.ts
 *
 *   # Execute migration
 *   npx ts-node scripts/migrations/backfill-companyId.ts --execute
 *
 *   # Specify collection
 *   npx ts-node scripts/migrations/backfill-companyId.ts --collection projects
 */

interface MigrationConfig {
  dryRun: boolean;
  collection?: string;
  batchSize: number;
}

interface MigrationResult {
  collection: string;
  totalScanned: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: MigrationError[];
}
```

### Idempotency

The script is **idempotent** - running it multiple times has no adverse effects:

1. **Skip condition**: Documents with `companyId` already set are skipped
2. **Batch commits**: Each batch is atomic
3. **Audit trail**: Every operation is logged

### Rollback Strategy

If migration causes issues:

1. **Audit logs**: Every migration is logged with before/after state
2. **Rollback script**: Can revert specific documents using audit trail
3. **Manual override**: Admin SDK can override any document

---

## Testing Plan

### Phase 1: Local Emulator

1. Seed emulator with test data (some with, some without companyId)
2. Run migration in dry-run mode
3. Verify counts match expectations
4. Run migration in execute mode
5. Verify all documents have companyId
6. Run tenant isolation tests to confirm access works

### Phase 2: Staging Environment

1. Create staging project snapshot
2. Run migration in dry-run mode
3. Review migration report
4. Run migration in execute mode
5. Verify via Firebase Console
6. Test application functionality

### Phase 3: Production

1. Schedule maintenance window (if needed)
2. Create Firestore backup
3. Run migration in dry-run mode
4. Review and approve migration report
5. Run migration in execute mode
6. Monitor for errors
7. Verify via application testing

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Wrong companyId assigned | Low | High | Double-check via project lookup |
| Documents orphaned | Low | Medium | Manual review queue |
| Performance impact | Medium | Low | Batching, off-peak hours |
| Rollback needed | Low | Medium | Audit trail + rollback script |

---

## Acceptance Criteria

- [ ] **AC-1**: Migration script runs in dry-run mode without errors
- [ ] **AC-2**: Migration script has --execute flag for actual execution
- [ ] **AC-3**: All operations logged to audit collection
- [ ] **AC-4**: No documents remain without companyId after migration
- [ ] **AC-5**: Tenant isolation tests pass after migration
- [ ] **AC-6**: Rollback script tested and documented

---

## Local_Protocol Compliance

- [ ] No `any` types in migration script
- [ ] No hardcoded collection names (use constants)
- [ ] Proper error handling
- [ ] TypeScript strict mode

---

## Dependencies

This PR depends on:

1. **PR-1A**: Firestore rules with tenant isolation
2. **PR-1B**: MFA enforcement (for secure admin access)
3. **PR-1C**: Rate limiting (to prevent abuse)

---

## Timeline

| Phase | Duration | Notes |
|-------|----------|-------|
| Development | 1 day | Script implementation |
| Local testing | 1 day | Emulator testing |
| Staging testing | 1 day | Staging environment |
| Production execution | 1 day | With monitoring |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial documentation |
