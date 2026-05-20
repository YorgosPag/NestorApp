# ADR-370 — BIM Read-Only Visualization in Properties Floorplan Tab

- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-05-20
- **Author**: Giorgio Pagonis + Claude (Opus 4.7)
- **Related**: ADR-040 (Preview Canvas Performance), ADR-294 (SSoT Ratchet), ADR-356 (Tenant SSoT), ADR-361 (Firestore Subscribe Equality Guard), ADR-363 (BIM Drawing Mode), ADR-366 (3D BIM Viewer)
- **Scope**: Properties subapp read-only floorplan tab — show BIM entities (`walls`, `slabs`, `beams`, `columns`, `openings`, `slab-openings`) drawn in the DXF Viewer subapp.
- **Impact**: 🟢 Additive — new render layer, no schema/persistence changes.

---

## 1. Context

Ο χρήστης σχεδιάζει BIM entities (τοίχοι, πλάκες, δοκάρια, κολόνες, κουφώματα, διανοίξεις πλάκας) στον `/dxf/viewer` (DXF Viewer subapp). Αυτά persistάρουν σωστά σε Firestore (`floorplan_walls`, `floorplan_slabs`, `floorplan_beams`, `floorplan_columns`, `floorplan_openings`, `floorplan_slab_openings`), scoped by `(companyId, projectId, floorplanId)` per ADR-363 §5.10.

Όμως στο read-only floorplan tab του Properties subapp στο URL pattern `/properties?view=floorplan&selected=<propertyId>&mediaTab=floorplan-floor` **δεν εμφανίζονται**. Ο χρήστης εύλογα περιμένει να βλέπει τα BIM στοιχεία που σχεδίασε.

### 1.1 Root cause

Δύο εντελώς ξεχωριστά render pipelines:

1. **DXF Viewer subapp** (`src/subapps/dxf-viewer/`): έχει τους class-based BIM renderers (`WallRenderer`, `SlabRenderer`, `BeamRenderer`, `ColumnRenderer`, `OpeningRenderer`, `SlabOpeningRenderer`) που κάνουν extend `BaseEntityRenderer` και χρησιμοποιούν `CoordinateTransforms.worldToScreen` (με `COORDINATE_LAYOUT.MARGINS` offset).
2. **Properties read-only floorplan tab** (`src/components/shared/files/media/FloorplanGallery.tsx`): χρησιμοποιεί `floorplan-dxf-renderer.ts` που ζωγραφίζει **μόνο raw DXF geometry** (lines/polylines/arcs/circles/text) + `floorplan-overlay-system.ts` για unit selection polygons. Καμία αναφορά στα BIM collections, κανένα import από τους BIM renderers.

Render chain στο Properties tab:
```
PropertiesPageContent → ReadOnlyMediaViewer → FloorFloorplanTabContent
  → FloorplanGallery → floorplan-dxf-renderer + floorplan-overlay-system
```

Επιπλέον τα δύο pipelines χρησιμοποιούν **διαφορετικό coordinate transform**:
- `renderDxfToCanvas`: `screenX = (worldX - bounds.min.x) * scale + offsetX`, `screenY = (bounds.max.y - worldY) * scale + offsetY`, με `offsetX/Y = (canvas.size - drawing*scale)/2 + panOffset` και `scale = min(canvas.w/dW, canvas.h/dH) * zoom`. Κανένα margin.
- `CoordinateTransforms.worldToScreen`: `screenX = MARGINS.left + worldX * scale + transform.offsetX`, `screenY = (viewport.height - MARGINS.top) - worldY * scale - transform.offsetY`. Με `MARGINS.left = MARGINS.top = 30px` για rulers (που στο Properties tab δεν υπάρχουν).

Άρα ακόμη και αν περάσει κανείς ίδιο `scale`, οι BIM renderers θα ζωγραφίζουν μετατοπισμένα κατά `(30, 30)` pixels.

---

## 2. Decision

**Façade layer** στο Properties pipeline που:

1. **Subscribes** στα 6 BIM Firestore collections by `floorplanId` (μέσω `firestoreQueryService.subscribe`, με auto-applied `companyId` constraint από ADR-356 tenant SSoT, και ADR-361 equality guard + δεύτερο layer hash compare με `dequal`).
2. **Hydrates** τα Firestore docs σε scene entities καλώντας τα ίδια SSoT `computeXxxGeometry()` που χρησιμοποιεί ο DXF Viewer. Καμία αντιγραφή geometry logic.
3. **Builds a synthetic `ViewTransform`** που εξουδετερώνει το `COORDINATE_LAYOUT.MARGINS` offset, ώστε οι BIM renderers να ζωγραφίζουν στο ακριβές pixel space του `renderDxfToCanvas`.
4. **Calls `render(entity, { grips: false, hovered: false })`** στους υπάρχοντες BIM renderers — read-only, no edit affordances. Καμία αντιγραφή renderer logic.
5. **Inserts the BIM render pass** στο `useFloorplanCanvasRender` ανάμεσα στο `renderDxfToCanvas` και στο `drawOverlayPolygons`. Z-order: DXF geometry → BIM entities → unit selection polygons (selection UI πάντα πάνω).

### 2.1 Synthetic transform math

Έστω `bounds`, `canvas.{width,height}`, `zoom`, `panOffset` που χρησιμοποιεί `renderDxfToCanvas`:

```
drawingWidth  = bounds.max.x - bounds.min.x
drawingHeight = bounds.max.y - bounds.min.y
baseScale     = min(canvas.w / drawingWidth, canvas.h / drawingHeight)
scale         = baseScale * zoom
dxfOffsetX    = (canvas.w - drawingWidth  * scale) / 2 + panOffset.x
dxfOffsetY    = (canvas.h - drawingHeight * scale) / 2 + panOffset.y
```

Synthetic `ViewTransform` που ταυτίζει `CoordinateTransforms.worldToScreen` με `renderDxfToCanvas`:

```
transform.scale   = scale
transform.offsetX = dxfOffsetX - bounds.min.x * scale - MARGINS.left
transform.offsetY = canvas.h - MARGINS.top - bounds.max.y * scale - dxfOffsetY
viewport          = { width: canvas.w, height: canvas.h }
```

Η math ζει σε ένα μέρος (`buildBimViewTransform()`). Καμία αλλαγή στους renderers ή στο `CoordinateTransforms`.

### 2.2 Data scope & link

- **Query key**: `where('floorplanId', '==', floorplanId)` μόνο. Tenant `companyId` constraint αυτόματα από `firestoreQueryService` (ADR-294 / ADR-356).
- **`floorplanId` source**: `FloorplanGallery.currentFile.id` (= `FileRecord.id` του εκάστοτε floorplan). Συμβατό με `DxfViewerTopBar.tsx`'s `levelManager.fileRecordId`.
- **Synthetic fallback guard**: αν `floorplanId` ταιριάζει `/^floor_floorplan_/` (synthetic id από `adaptFloorFloorplanToFileRecord` όταν δεν υπάρχει `fileRecordId`), το hook επιστρέφει `EMPTY_SNAPSHOT` χωρίς subscriptions. Σωστή συμπεριφορά: όταν δεν υπάρχει πραγματικό `FileRecord.id`, δεν μπορεί να υπάρχουν BIM entities (το `floorplanId` δεν υπήρχε όταν σχεδιάστηκαν).

### 2.3 Rationale (alternatives considered)

| Alternative | Why rejected |
|---|---|
| Embed DxfViewer canvas σε iframe μέσα στο Properties tab | Cross-frame complexity· σπάει SSoT isolation· υπερβολικό για read-only. |
| Duplicate τους BIM renderers σε `src/components/shared/files/media/` | SSoT violation (ADR-294)· διπλό maintenance· memory rule "3D mirrors 2D SSoT" παραβιάζεται. |
| Extract pure render functions από τους renderers (geometry-only) | Rework × 6 entity types χωρίς όφελος έναντι του façade· χάνεις και τα phase-based styles. |

Φάκαδα = reuse + zero duplication + minimum touchpoints.

---

## 3. Consequences

### Θετικά

- BIM entities ορατά στο Properties read-only viewer χωρίς edit affordances (read-only by design).
- Reuse renderers + geometry + persistence services (ADR-294 SSoT preserved).
- Zero coupling proliferation στο DXF Viewer subapp· το Properties pipeline μένει αυτόνομο.
- ADR-040 compliance: ο φάκαδος δεν προσθέτει state σε hot path· `FloorplanGallery` δεν είναι μέρος της DXF Viewer micro-leaf αρχιτεκτονικής.

### Όρια

- **Read-only**: edit BIM entities γίνεται μόνο από το `/dxf/viewer`. Phase 2 αν ζητηθεί.
- **No layer filter UI** στο Properties tab — όλα τα BIM entities ορατά. Phase 2 (εύκολη προσθήκη μέσω props).
- **No hover affordance** για BIM entities (`hovered: false` πάντα στους renderers). Phase 2 αν ζητηθεί.

### Performance

6 subscriptions ανά floorplan view. Διπλό equality guard (ADR-361 service-level + consumer hash compare) εξουδετερώνει spurious re-renders. Renderer instances δημιουργούνται per render call — lightweight canvas state machine, αμελητέο cost για << 1000 entities.

---

## 4. File impacts

### Νέα αρχεία

| Path | Ρόλος |
|---|---|
| `src/components/shared/files/media/bim-canvas-transform.ts` | Pure `buildBimViewTransform()` — synthetic ViewTransform/Viewport bridge. |
| `src/components/shared/files/media/bim-readonly-hydration.ts` | Pure `hydrateWall/Slab/Beam/Column/Opening/SlabOpening()` — docs → entities via SSoT geometry functions. |
| `src/components/shared/files/media/useFloorplanBimEntities.ts` | Hook: 6 παράλληλα Firestore subscriptions με equality guard + memoized hydration. |
| `src/components/shared/files/media/bim-readonly-render.ts` | Façade: instantiates BIM renderers, sets synthetic transform, calls `render()` no-grips/no-hover. |
| `docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md` | Αυτό το ADR. |

### Modified αρχεία

| Path | Αλλαγή |
|---|---|
| `src/components/shared/files/media/useFloorplanCanvasRender.ts` | + `bimEntities?: FloorplanBimSnapshot \| null` param. Renders BIM ανάμεσα σε DXF και overlays. |
| `src/components/shared/files/media/floorplan-gallery-config.ts` | + `floorplanId?: string \| null` στο `FloorplanGalleryProps`. |
| `src/components/shared/files/media/FloorplanGallery.tsx` | Καλεί `useFloorplanBimEntities`, περνά `bimEntities` σε inline + modal render hooks. |
| `src/features/read-only-viewer/components/ReadOnlyMediaSubTabs.tsx` | `FloorFloorplanTabContent` passes `floorplanId={files[0]?.id ?? null}` στο `FloorplanGallery`. |
| `.ssot-registry.json` | + module `bim-readonly-render` (Tier 3) — forbidden `new (Wall\|Slab\|Beam\|Column\|Opening\|SlabOpening)Renderer(` outside `src/subapps/dxf-viewer/` και του façade. |

---

## 5. Verification

### Visual smoke test

1. Άνοιξε `/dxf/viewer`, φόρτωσε floorplan ενός project, σχεδίασε από έναν 6 BIM entities (τοίχο, πλάκα, δοκάρι, κολόνα, κούφωμα σε τοίχο, διάνοιξη πλάκας).
2. Auto-save 500ms (ADR-363 §5.10).
3. Άνοιξε `/properties?view=floorplan&selected=<propertyId>&mediaTab=floorplan-floor` για property που χρησιμοποιεί την ίδια `floorplanId`.
4. Verify: όλα τα BIM entities εμφανίζονται στις σωστές θέσεις, ίδιο pixel space με DXF geometry, χωρίς grips ή hover affordances. Unit overlay polygons πάνω από τα BIM fills.

### Type/lint

- `npx tsc --noEmit` — background run.
- `npm run lint -- src/components/shared/files/media/`.
- `npm run ssot:audit` — verify το νέο `bim-readonly-render` module προστέθηκε σωστά.

---

## 6. Changelog

| Date | Change |
|---|---|
| 2026-05-20 | Initial implementation. Façade + transform bridge + hook + 4 modified files + SSoT registry entry. |
| 2026-05-20 | **Phase 2 wiring** — single-level `floorplan-floor` branch in `ReadOnlyMediaViewer.tsx` (γρ. 283-297) δεν περνούσε `floorplanId` prop στο `FloorplanGallery`. Στο URL `?view=floorplan&selected=<propertyId>&mediaTab=floorplan-floor` (single-level property) ο `FloorplanGallery` έπεφτε στο fallback `currentFile?.id` που, σε περιπτώσεις legacy floorplan χωρίς `fileRecordId` (π.χ. αμετάβατο entry στο `files` collection), παρήγαγε synthetic id `floor_floorplan_*` → `SYNTHETIC_FLOORPLAN_PREFIX` guard στο `useFloorplanBimEntities.isQueryable()` → `EMPTY_SNAPSHOT` → καμία BIM render. Fix: explicit `floorplanId={floorFloorplansData.files[0]?.id ?? null}` (mirror του `FloorFloorplanTabContent` pattern). Multi-file branches (`floorplans` unit single-level, `UnitFloorplanTabContent`) παραμένουν στο `currentFile?.id` fallback γιατί ο index αλλάζει per navigation — εκεί το fallback είναι το σωστό δυναμικό SSoT. |
| 2026-05-20 | **Phase 3 diagnosis + fix** — μετά τα Phase 1+2, οι BIM entities παρέμεναν αόρατες στο Properties tab παρά τα σωστά subscriptions. Διάγνωση: temporary diagnostic logs στο `useFloorplanBimEntities` εκτύπωσαν `[bim-readonly][error] code: "permission-denied"` σε όλα 6 collections. Cause: τα Firestore rules για τα 6 `floorplan_*` collections (που είχαν προστεθεί στον commit `05275d03` ADR-363 Phase 0) **ΔΕΝ είχαν deployed** στο production Firestore — μόνο το local `firestore.rules` αρχείο τα είχε. Auth token claims verified σωστά (`globalRole: super_admin`, `companyId: pzNUy8ksddGCtcQMqumR`). Fix: `firebase deploy --only firestore:rules --project pagonis-87766`. Μετά το deploy, τα 5/6 subscriptions επέστρεψαν `count: 0` (κανονικά — προηγουμένως δεν υπήρχαν persisted docs), και μετά από σχεδίαση walls στο `/dxf/viewer` οι τοίχοι εμφανίστηκαν σωστά στο read-only Properties canvas. Diagnostic logs αφαιρέθηκαν (production noise). **Verification finding**: τα `floorplan_*` collections αρχικά δεν υπήρχαν στο Firestore Console γιατί το test DB ήταν wiped — οι BIM persistence hosts (`WallPersistenceHost` κ.λπ.) στο `DxfViewerTopBar` λειτουργούν σωστά εφόσον `companyId && projectId && floorplanId && userId` είναι όλα present (guard στο `useWallPersistence.ts:165`). |
