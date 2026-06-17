# ADR-468 — Διαχείριση Ορόφων/Υψομέτρων από τον DXF Viewer

**Status:** 🟢 DONE 2026-06-17 (Opus, UNCOMMITTED — browser-verify + commit).
**Discipline:** DXF Viewer / Building Levels UX.
**Builds on:** ADR-399 (floor navigation tabs), ADR-461 (special levels), ADR-450/451 (floor cascade SSoT).

## 1. Context / Problem

Ο μηχανικός για να ρυθμίσει ορόφους/υψόμετρα (καρτέλα «Όροφοι Κτιρίου») έπρεπε να φύγει από τον DXF
viewer (`/dxf/viewer`) και να πάει στα «Κτίρια» (`/buildings`). Σπάει το authoring workflow — στο Revit
τα Levels διαχειρίζονται **μέσα** από το authoring περιβάλλον (Manage → Levels).

## 2. Decision

Άνοιγμα του **ίδιου** panel `FloorsTabContent` (καρτέλα «Όροφοι») σε **modal** μέσα στον viewer. Δύο
entry points:
- **⚙️** στο header του panel «Επίπεδα Έργου» (`LevelPanel`).
- **Δεξί κλικ** στη γραμμή σταθμών πάνω από τον καμβά (`FloorTabBar`).

**FULL SSoT:** επαναχρησιμοποιείται **ως έχει** το `FloorsTabContent` (μηδέν διπλότυπο). Δέχεται
explicit `building` prop (μηδέν coupling με `useProjectHierarchy`/buildings router) → renderάρεται
standalone. Γράφει στα **ΙΔΙΑ** FLOORS docs → οι στάθμες/3D + το cascade υψομέτρων (ADR-450/461)
ανανεώνονται αυτόματα.

## 3. Architecture

- **NEW `hooks/data/useBuildingById.ts`** — real-time subscription σε `BUILDINGS/{id}` μέσω
  `firestoreQueryService.subscribeDoc` (mirror `useFloorsByBuilding`). `enabled=isOpen` → κανένας
  listener όταν το modal είναι κλειστό. Φέρνει το full `Building` (id/projectId/companyId +
  hasFoundation/foundationDepth/… ζωντανά → μηδέν stale μετά το vertical-setup write).
- **NEW `stores/FloorManagementDialogStore.ts`** — singleton `{ isOpen }` (zero React), mirror του
  `AdminLayerManagerDialogStore`. `open()`/`close()`/`subscribe`/`getSnapshot`.
- **NEW `ui/components/FloorManagementDialog.tsx`** — Radix `Dialog size="2xl"`, `useSyncExternalStore`
  στο store, `useBuildingById(buildingId, isOpen)` → `<FloorsTabContent building={building} />` (spinner
  όσο loading / μήνυμα όταν δεν υπάρχει συνδεδεμένο κτίριο).
- **NEW `app/FloorManagementDialogHost.tsx`** — host (mirror AdminLayerManagerDialogHost).
- **MOD `app/dxf-viewer-lazy-components.tsx`** — lazy export του host.
- **MOD `app/DxfViewerDialogs.tsx`** — mount (Suspense)· `buildingId` υπολογίζεται από
  `levelManager.levels.find(l => l.buildingId)?.buildingId` (ίδια canonical πηγή με το `projectId`).
- **MOD `ui/components/LevelPanel.tsx`** — κουμπί ⚙️ στο header → `FloorManagementDialogStore.open()`.
- **MOD `components/dxf-layout/FloorTabBar.tsx`** — `onContextMenu` στο `<nav>` → `preventDefault` +
  `open()`.
- **MOD i18n** — `floorManagementDialog.{title,description,loading,noBuilding}` (dxf-viewer-shell el/en)
  + `panels.levels.manageFloors` (dxf-viewer-panels el/en).

**ADR-040:** όλα τα σημεία είναι εκτός του high-freq canvas path → καμία επίπτωση στο micro-leaf pattern.

## 4. Consequences / DEFER
- Το `BuildingVerticalSetupForm` γράφει στο building doc· το `useBuildingById` subscription το ανανεώνει
  → μηδέν stale state στο modal.
- **DEFER:** context menu με πολλαπλά items στο δεξί κλικ (σήμερα ανοίγει απευθείας το modal, όπως
  ζητήθηκε)· per-level δεξί κλικ actions στις κάρτες του LevelPanel.

## 5. Changelog
- **2026-06-17 (Opus) — SSoT audit fixes (Giorgio):** (Α) εξήχθη `resolveActiveBuildingId(levels)` στο
  `systems/levels/level-floor-resolution.ts` — το `levels.find(l => l.buildingId)?.buildingId` ήταν
  γραμμένο 2× (LevelPanel + DxfViewerDialogs)· πλέον ΕΝΑ SSoT, 2 callers. (Β) NEW `createToggleStore()`
  factory (`stores/createToggleStore.ts`) — το `FloorManagementDialogStore` ήταν το 12ο copy-paste του
  ίδιου `{ isOpen }` singleton boilerplate· πλέον one-liner `createToggleStore()`. Τα υπόλοιπα 11
  προϋπάρχοντα stores → pending-ratchet (migrate-on-touch).
- **2026-06-17 (Opus) — Slices 1-9 DONE (UNCOMMITTED):** νέο modal `FloorManagementDialog` που
  επαναχρησιμοποιεί το `FloorsTabContent` (SSoT), `useBuildingById` hook, store, host, mount, ⚙️ trigger
  στο LevelPanel + δεξί-κλικ trigger στο FloorTabBar, i18n el/en. 🔴 browser-verify + commit.
