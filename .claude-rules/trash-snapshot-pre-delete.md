# Trash Snapshot — Pre-Deletion Audit

**Date:** 2026-04-20
**Company:** `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`
**Mode:** read-only inspection (no writes)

---

## 1) FIRESTORE — `properties` (status='deleted')

**Total: 5 documents**

| ID | Code | Name | Type | Floor | Area | deletedAt | Linked spaces |
|----|------|------|------|-------|------|-----------|---------------|
| `prop_66d49a7a-ead4-4446-a18a-3e6cde03539e` | A-DI-1.11 | ΔΙΑΜΕΡΙΣΜΑ | apartment | 1 | 100 m² | 2026-04-20T07:26:49Z | — |
| `prop_690d3389-7d77-470c-b8df-47cb6c38375a` | A-GR-0.03 | Γραφείο | office | 0 | 20 m² | 2026-04-20T07:26:34Z | — |
| `prop_9c6221ac-14ee-4acc-b4c5-c132bc4be49c` | A-GR-0.02 | Γραφείο 50 τ.μ. | office | 0 | 50 m² | 2026-04-20T07:26:42Z | — |
| `prop_c39bef0b-d8ab-443e-badf-f471bedb676c` | A-DI-2.01 | ΔΙΑΜΕΡΙΣΜΑ 2 | apartment | 2 | 95 m² | 2026-04-20T07:27:04Z | — |
| `prop_d3082c0d-e61a-4311-944d-a4dd8dae7d41` | A-DI-1.10 | Διαμέρισμα 130 τ.μ. | apartment | 1 | 130 m² | 2026-04-20T07:26:56Z | **parking:** `park_406a6bdd-6cb7-49ed-918b-2b62ca1091a9`, **storage:** `stor_0c741bc6-cbff-400d-bf8f-e793458d4d5b` |

All deleted by `ITjmw0syn7WiYuskqaGtzLPuN852` (Pagonis TEK). `previousStatus: "reserved"` for all.

---

## 2) DXF OVERLAYS — subcollection `dxf_overlay_levels/default/items`

**Top-level collection** `dxf_overlay_levels`: 0 docs (only subcollection `items` under level `default`).
**Subcollection** `dxf_overlay_levels/default/items`: **3 overlays total**, of which **2 linked to deleted props**:

| Overlay ID | Label | linked.propertyId | Status |
|------------|-------|-------------------|--------|
| `ovrl_26573a1d-28dc-4617-8960-96deaaa63335` | Διαμέρισμα 130 τ.μ. | `prop_d3082c0d` (DELETED) | for-sale |
| `ovrl_5fa7c9f5-c02f-44cf-8555-3c67dea69a7d` | ΔΙΑΜΕΡΙΣΜΑ | `prop_66d49a7a` (DELETED) | unavailable |
| `ovrl_8e179a1c-c1c1-483c-a07f-5dfe2d68d3bd` | τεστ 35 τ.μ. | `prop_80a4b1bc` (ACTIVE) | for-sale |

**Note:** these overlays are currently **hidden** in UI by `useLiveOverlaysForLevel` filter (commit 5223e2c2) but remain in Firestore. Orphaned after hard-delete.

**DXF viewer level anchor:** `dxf_viewer_levels/default` (1 doc, unchanged).

---

## 3) FIRESTORE CASCADE — references to deleted property IDs

| Collection | Count | Cascade in `deletion-registry.ts`? | Notes |
|------------|-------|------------------------------------|-------|
| `search_documents` | **5** | ✅ YES (auto-cascade) | One doc per deleted prop, `_id = property_<propId>` |
| `searchDocuments` (camelCase) | 0 | — | Stale/legacy collection — empty for this company |
| `entity_audit_trail` | **45** | ❌ NO | Will PERSIST after deletion (historical log, no FK cleanup) |
| `files` | **10** | ❌ NO | Will PERSIST — see breakdown §4 |
| `dxf_overlay_levels/default/items` | **2** | ❌ NO | Will PERSIST (UI-hidden but orphan in Firestore) |
| `shares` (property_showcase) | **54** | ❌ NO | All linked to `prop_d3082c0d`. Will PERSIST |
| `file_shares` | 0 | — | — |
| `photo_shares` | 0 | — | — |
| `notifications` | 0 | — | — |
| `audit_log` | 0 | — | — |
| `contact_links` | (not checked per-prop) | ✅ YES (blocking dep, not cascade) | Blocks deletion if exists |
| `accounting_invoices` | (not queried, total 1) | ✅ YES (blocking dep) | Check before hard delete |
| `opportunities` / `communications` / `boq_items` / `obligations` | — | ✅ YES (blocking deps) | Not queried (collections absent from list) |

### `entity_audit_trail` distribution (45 entries)
- `prop_66d49a7a`: 4 (created + file_upload + updated + soft_deleted)
- `prop_690d3389`: 2 (created + soft_deleted)
- `prop_9c6221ac`: 16 (created + renames + cascade_renames + updates + soft_deleted)
- `prop_c39bef0b`: 2 (created + soft_deleted)
- `prop_d3082c0d`: 21 (created + 5 file_uploads + email_sent ×5 + updates + soft_deleted)

### `files` collection (10 docs, all `isDeleted: false`)
| propertyId | Count | Kinds |
|------------|-------|-------|
| `prop_66d49a7a` | 1 | DXF floorplan (`file_53f89f6a`) |
| `prop_690d3389` | 0 | — |
| `prop_9c6221ac` | 2 | Photos (`file_8f74b2a4`, `file_ac1dfe20`) |
| `prop_c39bef0b` | 0 | — |
| `prop_d3082c0d` | 7 | 1 DXF floorplan (`file_c4c6d2c2`) + 5 photos + 1 construction photo |

---

## 4) STORAGE (Firebase) — files under deleted property paths

Storage base: `companies/comp_9c7c1a50-.../entities/property/{propId}/domains/...`

| propertyId | Files | Total size | Breakdown |
|------------|-------|------------|-----------|
| `prop_66d49a7a` | **2** | ~165.6 KB | floorplan: 1 .dxf (139.7 KB) + 1 .processed.json (25.9 KB) |
| `prop_690d3389` | **0** | — | no storage folder |
| `prop_9c6221ac` | **2** | ~182.3 KB | photos: 2 .jpg (86.7 + 95.6 KB) |
| `prop_c39bef0b` | **0** | — | no storage folder |
| `prop_d3082c0d` | **70** | **~80 MB** | photos (5) ~594 KB + floorplan (3: .dxf + .json + .thumbnail) ~220 KB + **share PDFs (62) ~79 MB** |

**TOTAL STORAGE TO CLEAN: 74 files / ~80.3 MB** (vast majority = PDF showcases for `prop_d3082c0d`)

---

## 5) CASCADE GAPS — will NOT be cleaned automatically by current `deletion-registry.ts`

After hard delete of properties, the following **will remain orphaned**:

1. ❌ **`entity_audit_trail`** — 45 entries with `entityId` pointing to deleted IDs
2. ❌ **`files`** collection — 10 docs with `entityId` pointing to deleted IDs
3. ❌ **`dxf_overlay_levels/default/items`** — 2 overlays with `linked.propertyId` deleted
4. ❌ **`shares`** (property_showcase) — 54 active/revoked share tokens
5. ❌ **Storage files** — 74 objects (~80 MB), no Cloud Function cleans them
6. ❌ **`linkedSpaces`** on `prop_d3082c0d` — `park_406a6bdd` and `stor_0c741bc6` remain (parking/storage docs unaffected, but the backlink from property is gone)

**Only auto-cascade:** `search_documents` (5 docs will be deleted).

---

## 6) TWO ACTIVE PROPERTIES (reference — MUST survive deletion)

| ID | Code | Name |
|----|------|------|
| `prop_1772f88e-3a52-4694-a9cd-f15706ac05b7` | A-ST-2.03 | Στούντιο 35 τ.μ. |
| `prop_80a4b1bc-e728-4cc4-a71c-19675637a88c` | A-GK-1.05 | τεστ 35 τ.μ. |

Active overlay: `ovrl_8e179a1c` → `prop_80a4b1bc` (must remain after deletion).

---

## POST-DELETION AUDIT — what to re-check

After "οριστική διαγραφή done", I re-verify:

1. `properties` count where status=='deleted' → expect **0**
2. `search_documents` for 5 deleted IDs → expect **0** (auto-cascade)
3. `entity_audit_trail` for 5 deleted IDs → **whatever remains = orphan**
4. `files` for 5 deleted entityIds → **whatever remains = orphan**
5. `dxf_overlay_levels/default/items` count → expect **1** (only `ovrl_8e179a1c`), **orphans = gap**
6. `shares` with entityId in deleted IDs → **whatever remains = orphan**
7. Storage folders for 5 deleted props → **expect empty or gone**, **remaining bytes = orphan**
8. Active props untouched: 2 docs (`prop_1772f88e`, `prop_80a4b1bc`) + `ovrl_8e179a1c` + their storage folders
