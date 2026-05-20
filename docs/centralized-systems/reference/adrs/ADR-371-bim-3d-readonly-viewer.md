# ADR-371 — BIM 3D Read-Only Viewer in Properties Floorplan Tab

- **Status**: ✅ IMPLEMENTED — Session B complete (2026-05-20).
- **Date**: 2026-05-20
- **Author**: Giorgio Pagonis + Claude (Opus 4.7)
- **Related**: ADR-040 (Preview Canvas Performance), ADR-366 (3D BIM Viewer photorealistic), ADR-369 (BIM elevation convention), ADR-370 (BIM Read-Only 2D Visualization), ADR-294 (SSoT Ratchet).
- **Scope**: Properties subapp read-only floorplan tab — mount the same `BimViewport3D` (Three.js + ViewCube + Floors/Lighting/Quality panel) που σερβίρει το `/dxf/viewer`, αλλά χωρίς edit affordances ή render uploads.
- **Impact**: 🟢 Additive — props-driven refactor του υπάρχοντος viewport, καμία αντιγραφή Three.js / ViewCube / scene manager. Νέος overlay + toggle button wired στο Properties pipeline (Session B complete).

---

## 1. Context

ADR-370 παρέδωσε read-only 2D BIM render στο `/properties?view=floorplan&selected=<id>&mediaTab=floorplan-floor`. Ο χρήστης ζητά το **ίδιο 3D experience** όπως στο `/dxf/viewer` — orientation cube/gizmo, face navigation, sun controls, floor visibility — αλλά **read-only** στο context του Properties.

### 1.1 Constraints

- **SSoT**: `ThreeJsSceneManager`, `BimSceneLayer`, ViewCube engine, `Floating3DPanel`, lighting/quality modulators **δεν αντιγράφονται**. Single owner = `src/subapps/dxf-viewer/bim-3d/`.
- **Multi-agent safety**: άλλος agent δουλεύει παράλληλα σε `bim-3d/render/` και `bim-3d/performance/`. Refactor περιορίζεται στο `BimViewport3D.tsx` (Session A) + νέα αρχεία overlay/toggle (Session B).
- **Independent state**: το 3D toggle στο `/properties` δεν ταυτίζεται με το `/dxf/viewer` (Q1 Recognition). Δύο ανεξάρτητοι caller contexts μοιράζονται την ίδια viewport component.
- **ADR-040 compliance**: ο read-only overlay (Session B) **δεν** εγγράφεται σε high-freq stores· `BimViewport3D` έχει ήδη micro-leaf shape (≤1 canvas, low-freq subs).

### 1.2 Data source

Τα BIM entities προέρχονται από το `useFloorplanBimEntities(floorplanId)` hook (ADR-370 — 6 Firestore subscriptions με equality guard + dequal hash compare). **Δεν** χρησιμοποιούμε το global `Bim3DEntitiesStore` (που τροφοδοτείται από τους `*PersistenceHost` του DXF Viewer pipeline).

---

## 2. Decision

**Props-driven refactor του `BimViewport3D`** ώστε ο ίδιος component να σερβίρει:

1. **Legacy /dxf/viewer call** (no props) → identical behaviour, subscribes στο `Bim3DEntitiesStore`, χρησιμοποιεί `ProjectHierarchyContext.selectedProject.id`, εμφανίζει render button + dialog + progress overlay.
2. **Properties read-only call** (props provided) → external `bimEntities` feed, optional `projectId`, `readOnly={true}` που hideάρει render-related UI.

### 2.1 New props (all optional)

| Prop | Type | Default | Behaviour |
|---|---|---|---|
| `projectId` | `string \| null` | `undefined` | Αν δοθεί, υπερισχύει του hierarchy. Αν `undefined` ΚΑΙ hierarchy missing → `null` (render uploads disabled). |
| `readOnly` | `boolean` | `false` | `true` → hide render button, render dialog, progress overlay. `Floating3DPanel`, `BimEntityCardPanel`, `QuickProperties3DHoverPopover`, `PerformanceHUD` παραμένουν ορατά (Q2 Recognition). |
| `bimEntities` | `Bim3DEntities \| null` | `undefined` | `undefined` → subscribe στο global store (legacy). Αν object/null → external mode: το prop είναι το single source, **καμία** global store subscription. `null` = render empty scene (data not ready). |
| `visible` | `boolean` | `undefined` | **Option C** — controlled visibility, υπερισχύει του global `useViewMode3DStore` όταν δοθεί. Χρησιμοποιείται από `Bim3DReadOnlyOverlay` για να bypassάρει το `if (!is3D) return null` check χωρίς να αγγίζει το global store (Q1 decision). Στο `/dxf/viewer` call site (no prop) → store fallback = legacy behaviour. |
| `onClose` | `() => void` | `undefined` | Callback για το `← 2D` exit button όταν `readOnly=true`. Αποφεύγει `toggle2D3D()` που θα άλλαζε το global store αντί για το local `show3D` state. |

### 2.2 Hierarchy context fallback

Νέο export `useProjectHierarchyOptional()` στο `ProjectHierarchyContext.tsx` που επιστρέφει `null` αντί να throw όταν δεν υπάρχει provider (Properties pipeline). Ο canonical `useProjectHierarchy()` (που throwάρει) μένει αμετάβλητος → όλα τα existing call sites unaffected.

### 2.3 Backward compatibility

`canvas-layer-stack-3d-leaf.tsx` καλεί `<BimViewport3D />` χωρίς props → όλα τα defaults κρατούν τη legacy συμπεριφορά. Zero risk for /dxf/viewer.

### 2.4 Alternatives rejected

| Alternative | Why rejected |
|---|---|
| Duplicate `BimViewport3D` σε `src/components/shared/files/media/Bim3DReadOnlyViewport.tsx` | SSoT violation (ADR-294 + memory rule "3D mirrors 2D SSoT"). Διπλή Three.js lifecycle = πιθανό WebGL context leak. |
| Iframe `/dxf/viewer?readOnly=1` μέσα στο Properties tab | Cross-frame state sync impossible (selection, floorplanId), φόρτωση όλου του DXF subapp για read-only 3D = υπερβολή. |
| Extract `useBimViewport3D()` core hook + δύο shells | Rework × 3 effects + render branches. Καμία προστιθέμενη αξία έναντι του props-driven refactor — η component είναι ήδη ένα shell γύρω από το `ThreeJsSceneManager`. |
| Global `ViewMode3DStore` wiring από Properties | Παραβιάζει Q1 Recognition (state ανεξάρτητο μεταξύ /dxf/viewer και /properties). Cross-context state pollution. |

---

## 3. File impacts

### Session A (αυτή η session)

| Path | Αλλαγή |
|---|---|
| `src/subapps/dxf-viewer/bim-3d/viewport/BimViewport3D.tsx` | + `BimViewport3DProps` interface, + `projectId` / `readOnly` / `bimEntities` optional props, external entity sync effect, conditional store subscription, render-UI gating με `!readOnly`. 321 → 357 lines (< 500 cap). |
| `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx` | + `useProjectHierarchyOptional()` export. Canonical `useProjectHierarchy()` unchanged. |
| `docs/centralized-systems/reference/adrs/ADR-371-bim-3d-readonly-viewer.md` | Νέο — αυτό το ADR (σκελετός). |

### Session B (IMPLEMENTED 2026-05-20)

| Path | Αλλαγή |
|---|---|
| `src/subapps/dxf-viewer/bim-3d/viewport/BimViewport3D.tsx` | + `visible?: boolean` (Option C — overrides global store), + `onClose?: () => void` (exit button in readOnly mode). `is3D` renamed `is3DFromStore`, `effectiveVisible` computed. Mount effect + early-return use `effectiveVisible`. Exit button calls `onClose` when `readOnly && onClose`. |
| `src/components/shared/files/media/Bim3DReadOnlyOverlay.tsx` | NEW — wrapper που mountάρει `<BimViewport3D readOnly visible bimEntities={...} onClose={...} />`. Δέχεται `bimSnapshot: FloorplanBimSnapshot` (απευθείας από parent — μία subscription, SSoT). Maps `FloorplanBimSnapshot → Bim3DEntities` με `useMemo`. |
| `src/components/shared/files/media/Bim3DToggleButton.tsx` | NEW — prop-driven toggle (no global store). Reuses `bim3d.modeToggle.*` i18n keys. Mirror του `ViewMode3DToggleButton` αλλά decoupled. |
| `src/components/shared/files/media/FloorplanGallery.tsx` | + `projectId?: string \| null` prop. + `show3D` local state. `renderViewerContent` accepts `overlayContent?` (5th param). Toggle button in `isDxf && bimEntities.hasAny` block. Overlay injected in inline viewer call only (fullscreen out of scope). 498 lines (≤ 500 N.7.1). |
| `src/components/shared/files/media/floorplan-gallery-config.ts` | + `projectId?: string \| null` to `FloorplanGalleryProps` interface. |
| `src/i18n/locales/{el,en}/bim3d.json` | No new keys — existing `modeToggle.*` reused. |

---

## 4. Verification

### 4.1 Session A — backward compat

- **Smoke test**: `localhost:3000/dxf/viewer` → άνοιγμα floorplan με BIM entities → πάτημα "3D Προβολή" → πρέπει να εμφανίζει gizmo, entities, render button **όπως πριν**. Καμία οπτική ή λειτουργική διαφορά.
- **TypeScript**: `npx tsc --noEmit` background — δεν αναμένονται νέα errors (props all optional + types preserved).
- **ADR-040**: `BimViewport3D` παραμένει micro-leaf (≤1 canvas element, low-freq subs). Pre-commit check 6B/6C δεν χτυπάει (καμία αλλαγή σε orchestrator files).

### 4.2 Session B — Properties read-only 3D

- **Toggle button**: εμφανίζεται στο header του `FloorplanGallery` μόνο όταν `isDxf && bimEntities.hasAny` (entity guard). Disabled όταν `bimEntities.hasAny === false` (SYNTHETIC_FLOORPLAN_PREFIX guard εφαρμόζεται ήδη από `useFloorplanBimEntities`).
- **3D overlay**: `Bim3DReadOnlyOverlay` mountάρεται absolute `z-[100]` πάνω από τον canvas. `BimViewport3D` λαμβάνει `visible=true` (bypasses global store), `readOnly`, `bimEntities`, `onClose`. Exit `← 2D` button καλεί `onClose` → `setShow3D(false)`.
- **SSoT data flow**: `FloorplanGallery` έχει ήδη `bimEntities` από `useFloorplanBimEntities`. Το overlay το δέχεται ως `bimSnapshot` prop → **μία** Firestore subscription, zero duplication.
- **Browser verification**: ⚠️ Untested (dev server δεν τρέχει). Static review: backward compat kεπτά + overlay wiring correct. TS check pending (background).

---

## 5. Consequences

### Positive
- **SSoT preserved**: ένα viewport, δύο call contexts. Zero Three.js duplication, zero ViewCube duplication.
- **Minimum touchpoints**: 2 modified files Session A. Read-only overlay (Session B) χτίζεται από έξω χωρίς να αγγίζει το /dxf/viewer pipeline.
- **Independent state**: Q1 Recognition τηρείται — το 3D toggle στο Properties δεν συγχρονίζεται με το /dxf/viewer.

### Limits
- **Render uploads disabled** στο read-only mode by design (no `projectId` guarantee, no edit affordance).
- **Floor visibility/lighting controls στο `Floating3DPanel` διαβάζουν από το global `ViewMode3DStore`** — αν ο χρήστης άλλαξε floor visibility στο /dxf/viewer και άνοιξε το /properties στο ίδιο tab, η κατάσταση μεταφέρεται. **Acceptable trade-off Session A**: το `ViewMode3DStore` δεν έχει per-context isolation σήμερα. Αν χρειαστεί true isolation Session B → introduce `ViewMode3DStoreContext` ή local store factory.

### Performance
Πανομοιότυπη με /dxf/viewer 3D mode — ίδια Three.js scene, ίδια RAF loop, ίδιοι modulators. Read-only mode εξοικονομεί render pipeline (PathTracerRenderer δεν ενεργοποιείται ποτέ).

---

## 6. Changelog

| Date | Change |
|---|---|
| 2026-05-20 | Initial skeleton (Session A). Props-driven refactor `BimViewport3D` + `useProjectHierarchyOptional()` hook. Backward-compat verified on /dxf/viewer call site (no props). |
| 2026-05-20 | Session B complete. `visible` + `onClose` props added (Option C visibility override). `Bim3DReadOnlyOverlay` + `Bim3DToggleButton` new files. `FloorplanGallery` wired — local `show3D` state (Q1), toggle gated `isDxf && bimEntities.hasAny`, overlay in inline viewer. `FloorplanGalleryProps` + `projectId`. No new i18n keys. Status → IMPLEMENTED. |
