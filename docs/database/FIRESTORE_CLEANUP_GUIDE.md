# Firestore Database Cleanup Guide

## Overview

This guide documents the cleanup and consolidation tasks for the Nestor Firestore database.
The goal is to achieve enterprise-grade database architecture.

**Date**: 2026-01-11
**Status**: In Progress
**Priority**: P1 - High

---

## Phase 1: Manual Cleanup (Firebase Console)

### 1.1 Test/Mock Data Deletion

Navigate to [Firebase Console](https://console.firebase.google.com) > Firestore Database

#### Collection: `dxf_files`

Delete the following test documents:

| Document ID | Reason | Action |
|-------------|--------|--------|
| `_` | Test entry (invalid name) | DELETE |
| `_1` | Test entry (invalid name) | DELETE |
| `_afrpolgd` | Test entry (random test) | DELETE |

**Steps:**
1. Go to `dxf_files` collection
2. Click on each document ID listed above
3. Click "Delete document" (trash icon)
4. Confirm deletion

#### Collection: `floors`

Delete the following mock documents:

| Document ID | Reason | Action |
|-------------|--------|--------|
| `floor_-1` | Mock data (basement test) | DELETE |
| `floor_0` | Mock data (ground floor test) | DELETE |

**Steps:**
1. Go to `floors` collection
2. Click on each document ID listed above
3. Click "Delete document"
4. Confirm deletion

---

## Phase 2: Collection Consolidation (Migration 003)

### 2.1 Floorplans Unification

**Current State (Fragmented):**
```
building_floorplans/  → Individual building floorplans
project_floorplans/   → Individual project floorplans
unit_floorplans/      → Individual unit floorplans
```

**Target State (Enterprise Unified):**
```
floorplans/           → All floorplans with entityType field
  ├── entityType: 'building' | 'project' | 'unit'
  ├── entityId: string
  └── ... enterprise metadata
```

### 2.2 Naming Corrections

| Current (Wrong) | Target (Enterprise) | Type |
|-----------------|---------------------|------|
| `dxf-overlay-levels` | `dxfOverlayLevels` | Rename |
| `dxf-viewer-levels` | `dxfViewerLevels` | Rename |
| `dxf_files` | `cadFiles` | Rename + Migrate |
| `obligation-sections` | `obligationSections` | Rename |

### 2.3 Running Migration 003

**Location:** `src/database/migrations/003_enterprise_database_architecture_consolidation.ts`

**Prerequisites:**
- [ ] Phase 1 cleanup completed
- [ ] Full database backup created
- [ ] Development environment tested

**Command:**
```bash
# Via API endpoint (to be created)
curl -X POST http://localhost:3000/api/admin/run-migration?id=003

# Or via script
npx ts-node src/database/migrations/run-migration.ts 003
```

---

## Phase 3: ID Generation Standardization

### 3.1 Collections Needing ID Update

| Collection | Current Format | Target Format |
|------------|----------------|---------------|
| `contact_relationships` | `rel_timestamp_random` | `rel_uuid` |
| `storage_units` | Mixed (random + `stor_*`) | `stor_uuid` |
| `buildings` | Random Firestore ID | `bldg_uuid` |
| `units` | Random Firestore ID | `unit_uuid` |

### 3.2 Enterprise ID Service Integration

All new documents should use:
```typescript
import { enterpriseIdService } from '@/services/enterprise-id.service';

// For buildings
const id = enterpriseIdService.generateBuildingId();

// For units
const id = enterpriseIdService.generateUnitId();

// For floorplans
const id = enterpriseIdService.generateFloorplanId();
```

---

## Verification Checklist

### After Phase 1:
- [ ] `dxf_files` collection has no test documents (`_`, `_1`, `_afrpolgd`)
- [ ] `floors` collection has no mock documents (`floor_-1`, `floor_0`)

### After Phase 2:
- [ ] `floorplans` collection exists with unified data
- [ ] Legacy collections are empty or archived
- [ ] All collection names follow camelCase convention

### After Phase 3:
- [ ] All new documents use enterprise ID format
- [ ] No `Math.random()` usage in ID generation

---

## Rollback Plan

If migration fails:

1. **Restore from backup** (Firebase Console > Import)
2. **Check migration logs** for specific failures
3. **Contact development team** with error details

---

## Related Files

- Migration Script: `src/database/migrations/003_enterprise_database_architecture_consolidation.ts`
- Collections Config: `src/config/firestore-collections.ts`
- Enterprise ID Service: `src/services/enterprise-id.service.ts`
- ADR-003: `docs/adr/ADR-003-building-floorplan-enterprise-storage.md`

---

## Audit Trail

| Date | Action | By | Status |
|------|--------|-----|--------|
| 2026-01-11 | Initial audit completed | Claude Opus 4.5 | Done |
| 2026-01-11 | Cleanup guide created | Claude Opus 4.5 | Done |
| TBD | Phase 1 cleanup | Giorgos | Pending |
| TBD | Phase 2 migration | TBD | Pending |
| TBD | Phase 3 ID standardization | TBD | Pending |
