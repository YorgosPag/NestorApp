# ADR-193: Storage & Parking Tabs Alignment with Units (Prototype)

## Status
**ACCEPTED** | 2026-03-10

## Category
UI / Tabs / Space Management

## Context

The **Units** detail page serves as the PROTOTYPE for space entity detail views.
Its tab structure is: Πληροφορίες | Κάτοψη | Έγγραφα | Φωτογραφίες | Βίντεο, with inline editing support.

**Storage** and **Parking** had divergent tab structures:
- Storage: Γενικά | statistics | floorplans | Έγγραφα | photos | activity (6 tabs, no inline editing)
- Parking: Γενικά | Θέσεις Στάθμευσης | Έγγραφα | Φωτογραφίες | Βίντεο (misnamed tabs)

## Decision

Align Storage and Parking detail pages to match the Units prototype exactly:

### Tab Structure (all three entities)
1. **info** — Πληροφορίες (with inline editing)
2. **floor-plan** — Κάτοψη
3. **documents** — Έγγραφα
4. **photos** — Φωτογραφίες
5. **videos** — Βίντεο

### Storage Changes
- Tab IDs: `general` → `info`, `floorplans` → `floor-plan`
- Removed: `statistics` (StorageStatsTab), `activity` (StorageHistoryTab)
- Added: `videos` (StorageVideosTab) — new component
- Added: Inline editing support (isEditing, saveRef delegation pattern)

### Parking Changes
- Tab IDs: `general` → `info`, `parkingFloorplan` → `floor-plan`
- defaultTab: `"general"` → `"info"`

## Files Changed

| File | Change |
|------|--------|
| `unified-tabs-factory.ts` | Storage: 6→5 tabs; Parking: renamed tab IDs |
| `tabs.ts` (modal-select labels) | Updated interfaces + constants for both entities |
| `storageMappings.ts` | Removed Stats/History, added Videos |
| `mappings/index.ts` | Same barrel update |
| `StorageTabs.tsx` | Added inline editing props, defaultTab="info" |
| `StorageDetails.tsx` | Added editing state (ParkingDetails pattern) |
| `StorageDetailsHeader.tsx` | Added Edit/Save/Cancel/New/Delete buttons |
| `StorageGeneralTab.tsx` | Read-only → dual mode (view/edit) with Card layout |
| `StorageVideosTab.tsx` | **NEW** — EntityFilesManager for storage videos |
| `ParkingTabs.tsx` | defaultTab="general" → "info" |

## Consequences

- Consistent UX across all space entity detail views
- Storage now supports inline editing (same as Parking and Units)
- StorageStatsTab and StorageHistoryTab files remain but are no longer referenced
- All tab labels resolved via centralized i18n keys
