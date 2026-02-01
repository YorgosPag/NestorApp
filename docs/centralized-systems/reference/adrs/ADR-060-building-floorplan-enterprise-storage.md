# ADR-060: Migrate BuildingFloorplanService to Enterprise Storage Architecture

| Metadata | Value |
|----------|-------|
| **Category** | Backend Systems |
| **Status** | ✅ Active |
| **Date** | 2026-01-11 |
| **Owners** | Platform / Storage |

## Related
  - DxfFirestoreService (dxf-viewer/services/)
  - DXF_STORAGE_ENTERPRISE_AUDIT_REPORT.md
  - Collection: building_floorplans

## Context

The `BuildingFloorplanService` was storing DXF scene data directly in Firestore documents:

```typescript
// BEFORE (Legacy)
interface BuildingFloorplanData {
  scene: any; // No type safety
}

await setDoc(doc(db, 'building_floorplans', docId), {
  scene: data.scene, // 177K+ entities in single document
});
```

Problems identified:
1. **Firestore 1MB Document Limit**: DXF scenes with 177K+ entities risk exceeding document size limits.
2. **Expensive Reads**: Large documents = higher Firestore read costs.
3. **No Type Safety**: `scene: any` violates enterprise TypeScript standards.
4. **Duplicate Architecture**: Enterprise-grade DXF storage already exists in `DxfFirestoreService`.

Meanwhile, `DxfFirestoreService` in dxf-viewer already implements enterprise-class storage:
- Scene data → Firebase Storage (unlimited size, cheap)
- Metadata → Firestore (fast queries, small documents)
- Version control and checksum validation

## Decision

Migrate `BuildingFloorplanService` to use the existing `DxfFirestoreService` architecture:

```typescript
// AFTER (Enterprise)
interface BuildingFloorplanData {
  scene?: SceneModel | null;  // Type-safe
  fileType?: 'dxf' | 'pdf';   // Format discriminator
  pdfImageUrl?: string;       // PDF support
  pdfDimensions?: { width: number; height: number } | null;
}

// DXF: Use enterprise storage
await DxfFirestoreService.saveToStorage(fileId, fileName, scene);

// PDF: Firestore metadata only (lightweight)
await setDoc(doc(db, collection, docId), { pdfImageUrl, pdfDimensions });
```

## Rationale

This approach:
- **Zero New Infrastructure**: Reuses proven `DxfFirestoreService` patterns.
- **Single Source of Truth**: All DXF storage follows same architecture.
- **Cost Reduction**: Firebase Storage is significantly cheaper than Firestore for large blobs.
- **No Size Limits**: Firebase Storage has no 1MB document limit.
- **Type Safety**: `scene: any` → `scene?: SceneModel | null`.
- **Backward Compatible**: Intelligent fallback loads legacy Firestore data.

## Implementation

### Storage Strategy

| File Type | Storage Location | Rationale |
|-----------|-----------------|-----------|
| DXF | Firebase Storage via `DxfFirestoreService` | Large scenes, unlimited size |
| PDF | Firestore metadata only | Small metadata, PDF image stored separately |

### Loading Strategy (Intelligent Fallback)

```
loadFloorplan(buildingId, type)
  ├── 1. Check Firestore for PDF → Return if found
  ├── 2. Check Firestore for legacy DXF → Return if found
  └── 3. Check Firebase Storage (enterprise) → Return if found
```

### Migration Path

1. **New saves**: Go to Firebase Storage (DXF) or Firestore metadata (PDF).
2. **Existing loads**: Fallback to legacy Firestore format.
3. **Optional**: `migrateToEnterpriseStorage()` helper for bulk migration.

## Consequences

### Positive
- Eliminates 1MB document size risk.
- Reduces Firestore read costs for large DXF scenes.
- Type-safe interface with `SceneModel`.
- Consistent architecture across all DXF storage.
- PDF floorplans continue to work unchanged.

### Negative / Trade-offs
- Two storage locations during transition (Storage + legacy Firestore).
- Additional network hop for Storage-based loads.
- Legacy data remains in Firestore until explicitly migrated.

## Guardrails

- **Do not** store raw DXF scene data directly in Firestore documents.
- **Always** use `DxfFirestoreService.saveToStorage()` for DXF scenes.
- **PDF metadata** may remain in Firestore (small payload).
- **Type safety**: Never use `scene: any` - always `SceneModel`.

## Files Changed

| File | Change |
|------|--------|
| `src/services/floorplans/BuildingFloorplanService.ts` | Complete rewrite to v2.0.0 |
| `src/hooks/useBuildingFloorplans.ts` | No changes (auto-inherits types) |

## Validation

- TypeScript compilation passes with no `any` type violations.
- Legacy Firestore data loads correctly via fallback.
- New DXF saves go to Firebase Storage.
- PDF floorplans save/load correctly.
- No 1MB limit errors on large DXF scenes.

## Related Commits

- `62db9cc` - perf(floorplans): migrate BuildingFloorplanService to enterprise storage architecture
