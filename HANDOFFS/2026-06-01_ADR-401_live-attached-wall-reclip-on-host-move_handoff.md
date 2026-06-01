# HANDOFF — ADR-401 · Real-time re-clip attached τοίχου όταν μετακινείται ο host (δοκάρι/πλάκα) σε 3D

- **Ημερομηνία**: 2026-06-01
- **Συντάκτης**: Claude (Opus 4.8)
- **Για**: ΝΕΑ συνεδρία (καθαρό context) — **3D live-preview feature**, ADR-401 ↔ ADR-402. ΟΧΙ νέο geometry SSoT (το clip είναι έτοιμο).
- **🎯 Μοντέλο (N.14)**: **Opus** — cross-cutting (live-preview pipeline + cascade + coordinate transforms), ~4-6 αρχεία, 2 domains (ADR-401 geometry ↔ ADR-402 3D editing).
- **⚠️ COMMIT/PUSH**: **ΤΑ ΚΑΝΕΙ Ο GIORGIO**, ΟΧΙ ο agent.
- **🚨 Multi-agent**: το working tree **μοιράζεται με άλλον agent (ADR-363 «from-perimeter walls»)**. Stage **ΜΟΝΟ** τα δικά σου hunks. ΜΗΝ αγγίξεις τα δικά του (λίστα §6).

---

## 0. ΠΡΩΤΟ ΒΗΜΑ
`"C:\Program Files\Git\cmd\git.exe" log --oneline -5` + `git status`. **ΠΡΟΣΟΧΗ:** η προηγούμενη δουλειά ADR-401 (face-crossing breakpoints + flat-shading) είναι **uncommitted/pending** (ο Giorgio θα κάνει commit). Το feature σου **εξαρτάται** από αυτήν (βλ. §2). ΜΗΝ υποθέσεις τι έγινε commit/push.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (Giorgio live, 2026-06-01)

**Σενάριο:** τοίχος που τέμνει δοκάρι **υπό γωνία** (ήδη δουλεύει σωστά στατικά: ακριανά ορθογώνια, καθαρά τρίγωνα, κεντρικό παραλληλόγραμμο @κάτω-παρειά). Ο χρήστης **μετακινεί το δοκάρι** (3D move gizmo, ADR-402).

**Σύμπτωμα:** ΚΑΤΑ τη μετακίνηση, ο τοίχος δείχνει την **παλιά τρύπα** (το clip από την προηγούμενη θέση του δοκαριού — stale). Μόλις ο χρήστης **αφήνει** το δοκάρι (pointer-up → commit → resync), η παλιά τρύπα εξαφανίζεται και δημιουργείται **καινούργια** στη νέα θέση. → οπτικό «πήδημα».

**Ζητούμενο (Giorgio):** ΚΑΤΑ τη μετακίνηση, σε **πραγματικό χρόνο**, ο τοίχος να ξανα-κόβεται (re-clip) ακολουθώντας το δοκάρι — ο χρήστης ΔΕΝ πρέπει να βλέπει stale τρύπα. **«Έχουμε ήδη κώδικα real-time εμφάνισης — ψάξε τον κεντρικοποιημένο, δες αν είναι σωστό να τον χρησιμοποιήσεις εδώ.»**

---

## 2. ΑΠΑΝΤΗΣΗ ΣΤΗΝ ΕΡΩΤΗΣΗ ΤΟΥ GIORGIO — ο κεντρικοποιημένος real-time κώδικας

**ΝΑΙ, υπάρχει κεντρικοποιημένο SSoT και ΕΙΝΑΙ το σωστό να χρησιμοποιηθεί — αλλά χρειάζεται επέκταση.** Δύο αρχεία (ADR-402 Phase A, «live move/rotate/resize preview»):

1. **`bim-3d/animation/bim3d-edit-live-preview.ts`** — class `Bim3DEditLivePreview`. Ο per-frame μηχανισμός κατά το drag (single-commit-on-release: το command τρέχει ΜΙΑ φορά στο release· αυτό αλλάζει ΜΟΝΟ ό,τι ΒΛΕΠΕΙ ο χρήστης mid-drag):
   - **RIGID** (move/rotate): `captureTransform(group, ids)` → `applyMove(translation)` / `applyRotate(pivot, angle)` — μετακινεί **απευθείας τα meshes** των edited entities (position/quaternion). Render μέσω `markSceneDirty` + `UnifiedFrameScheduler` (ADR-040/366· ΠΟΤΕ δικό του rAF).
   - **RESIZE/TILT**: `captureResize(group, entityId)` (κρύβει originals) → `applyResize(rebuiltObject)` (swap-in fresh object). **Κρατά ΕΝΑ `previewObject`** (single entity).
   - `commit()` (drop refs, αφήνει το resync) / `reset()` (restore on Esc/no-op).

2. **`bim-3d/animation/bim3d-preview-rebuild.ts`** — `buildResizePreviewObject(entityId, drag)` + `buildTiltPreviewObject(...)`: ξαναχτίζει το mesh ΕΝΟΣ entity μέσω του ΙΔΙΟΥ converter SSoT με το commit path (`compute*ResizeParams` → `compute*Geometry` → `wallToMesh`/`columnToMesh`/…). **Ήδη ξανα-resolv-άρει attach profiles** (`wallPreviewProfiles`/`columnPreviewProfiles`, mirror του `BimSceneLayer.syncWalls/syncColumns`, `floorElevationMm=0`).

**Orchestration:** `bim-3d/animation/bim3d-edit-interaction-handlers.ts` → `applyLivePreview(ctx)` (γρ.198) τρέχει κάθε changed pointermove frame: `move`→`applyMove`, `rotate`→`applyRotate`, `resize`/`tilt`→`applyResize(build*PreviewObject(id, …))`.

### ⚠️ ΓΙΑΤΙ ΤΟ ΥΠΑΡΧΟΝ ΔΕΝ ΚΑΛΥΠΤΕΙ ΤΟ ΣΕΝΑΡΙΟ (δύο κενά)

**Κενό Α — ο move preview ξαναχτίζει ΜΟΝΟ το dragged entity, ΟΧΙ τους dependents.** Όταν σύρεις το **δοκάρι**, το `applyMove(t)` μετακινεί ΜΟΝΟ το mesh του δοκαριού (το δοκάρι είναι στο `editEntityIds`). Ο **attached τοίχος** ΔΕΝ είναι στο `editEntityIds` → δεν γίνεται capture/rebuild → κρατά την παλιά γεωμετρία (stale clip). Το clip του τοίχου εξαρτάται από το footprint του host → πρέπει να ξαναϋπολογιστεί με το **host στην preview θέση**.

**Κενό Β — το `bim3d-preview-rebuild` ΔΕΝ περνά `topClip` (8ο όρισμα του `wallToMesh`).** Δες γρ.191/106: `wallToMesh(preview, openings, 0, levelId, baseElev, profile, baseProfile)` — **7 ορίσματα**, χωρίς το `topClip`. Άρα ακόμη κι αν ξαναχτίζαμε τον τοίχο, θα έπαιρνε ΜΟΝΟ το axis-based stepped/sloped profile, **ΟΧΙ** το footprint-clip με τα 5/7 κομμάτια & τα τρίγωνα της γωνιακής διασταύρωσης. (Ιστορικά αυτό ήταν «ανέγγιχτο» επίτηδες — τώρα πρέπει να γεφυρωθεί.)

**Συμπέρασμα:** χρησιμοποίησε το ΙΔΙΟ SSoT (`Bim3DEditLivePreview` + converter-rebuild pattern), **επεκτείνοντάς** το ώστε: (Α) σε host move/rotate να ξαναχτίζει ΚΑΙ τους attached dependents με το host στην preview θέση, και (Β) ο wall rebuild να περνά `topClip` (με τα face-crossing breakpoints) υπολογισμένο από το host-preview-footprint.

---

## 3. RECOGNITION (Phase 1 — διάβασε ΠΡΩΤΑ, code = source of truth)

1. `bim-3d/animation/bim3d-edit-live-preview.ts` — ο preview μηχανισμός. **Κρατά ΕΝΑ `previewObject`** → χρειάζεται επέκταση σε **πολλά** dependent objects (ή νέο parallel module/μέθοδος `applyDependents(objects[])`).
2. `bim-3d/animation/bim3d-preview-rebuild.ts` — `buildResizePreviewObject` + `wallPreviewProfiles` (πώς χτίζονται hostInputs από `buildWallHostInputs(s.beams, s.slabs)` = STORE snapshot = **παλιά** θέση host). Εδώ μπαίνει η preview-θέση host + το `topClip`.
3. `bim-3d/animation/bim3d-edit-interaction-handlers.ts` — `onEditPointerDown` (γρ.73: capture), `applyLivePreview` (γρ.198: per-frame), `onEditPointerUp/Cancel` (commit/reset). Εδώ προστίθεται το dependent-capture (pointerdown) + dependent-rebuild (move/rotate frame).
4. `bim-3d/scene/BimSceneLayer.ts` `syncWalls` (γρ.~217-265) — **το ground-truth commit path**: πώς χτίζεται `topClip = { hosts, nominalTopMm, breakpoints: wallTopFaceCrossingBreakpoints(...) }` + `profile`/`baseProfile`. Ο live preview πρέπει να βγάλει **ΤΟ ΙΔΙΟ** (ghost === commit).
5. `bim-3d/converters/wall-top-clip.ts` — `WallTopClipContext` (`hosts`/`nominalTopMm`/`breakpoints`) + `wallTopFaceCrossingBreakpoints(geom, hosts)`. **(pending commit — εξαρτάσαι από αυτό.)**
6. `bim/cascade/bim-cascade-resolver.ts` `findAttachedWalls(hostIds, entities)` (γρ.88) — reverse lookup host→attached-wall. **ΜΟΝΟ `attachTopToIds` τοίχων** — ΟΧΙ base-attach, ΟΧΙ columns/stairs (βλ. §5 scope).
7. `bim/walls/wall-host-plan-builder.ts` `buildWallHostInputs(beams, slabs)` + `beamHostInput`/`slabHostInput` — πώς footprint host → `HostFootprintInput`. Ο preview πρέπει να τα χτίσει με το host **μετακινημένο**.
8. `bim-3d/viewport/coordinate-transforms.ts` `worldToDxfPlan` — η `live.translation`/`live.pivot` είναι **world** space· το host footprint είναι **plan/mm**. Χρειάζεται μετατροπή world-translation→plan για να μετακινηθεί σωστά το host footprint (anti-1000× — δες ADR-402/404 meter-scale fix, `mmScaleFor`, memory `project_adr402_meterscale_vanish_fix`).
9. `bim-3d/gizmo/bim-gizmo-controller.ts` `getLivePreview()` → `{kind:'move', translation}` / `{kind:'rotate', pivot, angleRad}` — η πηγή του live transform.

---

## 4. Η ΛΥΣΗ (προτεινόμενη — επιβεβαίωσέ την με Plan Mode)

**Live cascade preview:** όταν το dragged entity είναι structural host με attached dependents, ξαναχτίζε τους dependents κάθε frame με το host στην preview-θέση.

### Βήμα 1 — pointerdown (`onEditPointerDown`, move/rotate branch only)
Μετά το `captureTransform`, βρες τους attached dependents: `findAttachedWalls(new Set(ids), sceneEntities)`. Αν >0 → `preview.captureDependents(group, dependentIds)` (νέα μέθοδος: hide originals των dependents, σαν `captureResize` αλλά για **σετ**).

### Βήμα 2 — per-frame (`applyLivePreview`, `live.kind==='move'|'rotate'`)
Για κάθε dependent wall, χτίσε fresh mesh με NEW helper `buildDependentWallPreviewObject(wallId, hostIds, liveTransform)` στο `bim3d-preview-rebuild.ts`:
- Πάρε τον host (beam/slab) από snapshot, εφάρμοσε το **liveTransform** στο footprint του (world-translation→plan μέσω `worldToDxfPlan`· rotate γύρω από pivot).
- Χτίσε `HostFootprintInput` από το **μετακινημένο** footprint (reuse `beamHostInput`/`slabHostInput` με transformed geometry, ή transform-άρισε το `HostFootprintInput.footprint` απευθείας).
- Κάλεσε `resolveWallTopProfile` + `wallTopFaceCrossingBreakpoints` + φτιάξε `topClip` (mirror `syncWalls`).
- `wallToMesh(wall, openings, 0, levelId, baseElev, profile, baseProfile, **topClip**)` ← **πέρνα το 8ο όρισμα** (κενό Β).
- Swap-in μέσω `preview.applyDependents([...rebuiltObjects])`.

### Βήμα 3 — commit/reset
`commit()` → drop dependent refs (το command's resync τα ξαναχτίζει). `reset()` → restore dependent originals.

### ⚠️ Κρίσιμα σημεία
- **Ghost === commit:** ο preview ΠΡΕΠΕΙ να βγάλει ίδιο `topClip` με το `syncWalls` (ίδια breakpoints, ίδιος host-footprint). Μην ξανα-υλοποιήσεις geometry — reuse `wallTopFaceCrossingBreakpoints` + `resolveWallTopProfile`.
- **Units (anti-1000×):** world↔plan/mm μετατροπή — δες `worldToDxfPlan` + `mmScaleFor`. Λάθος εδώ → ο τοίχος «φεύγει» 1000×.
- **Multi-floor:** `floor3DScope==='all'` → ο preview επιστρέφει null (commit-on-release fallback, ήδη υπάρχει).
- **`Bim3DEditLivePreview` single previewObject:** χρειάζεται επέκταση σε σετ dependents (νέα `captureDependents`/`applyDependents`/restore). Κράτα την κλάση THREE-only/testable.
- **Rotate host:** ο attached τοίχος σπάνια έχει νόημα να ακολουθεί rotation host· **MVP = move μόνο** (Giorgio είπε «όταν μετακινώ»). Rotate = follow-up.

---

## 5. SCOPE (Giorgio = move host → wall re-clip)
- **IN (MVP):** beam/slab **move** → attached **wall** (top-attach) re-clip live.
- **OUT (follow-up, flag στο ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ):** base-attach dependents· attached **columns**/**stairs** (το `findAttachedWalls` δεν τα καλύπτει — χρειάζεται γενίκευση reverse-lookup)· host **rotate/resize** → dependent re-clip· multi-floor («Όλοι»).

---

## 6. Multi-agent — ΜΗΝ αγγίξεις (uncommitted, άλλου agent — ADR-363 from-perimeter)
`ribbon-contextual-config.ts`, `bim/walls/wall-from-entity.ts`, `dxf-canvas-renderer.ts`, `useCanvasClickHandler.ts`, `use-wall-commit.ts`, `use-wall-tool-event-listeners.ts`, `useWallTool.ts`, `wall-tool-types.ts`, `useSpecialTools.ts`, `useDxfViewerNotifications.ts`, `mouse-handler-move/up.ts`, `useCentralizedMouseHandlers.ts`, `EventBus.ts`, `tool-definitions.ts`, `home-tab-draw.ts`, `toolbar/types.ts`, `adr-index.md`, `ADR-363*.md`, i18n `dxf-viewer-shell.json`, `bim/walls/perimeter-from-faces.ts` + tests.

**Δικά σου (ADR-401, ήδη uncommitted από προηγ. session — θα τα κάνει commit ο Giorgio):** `wall-top-clip.ts`, `BimSceneLayer.ts`, `BimToThreeConverter.ts`, `wall-opening-pieces.ts`, `column-piece-geometry.ts`, `__tests__/wall-top-angled-crossing.test.ts`, `__tests__/column-piece-geometry.test.ts`, `ADR-401-*.md`. Τα animation/gizmo αρχεία (ADR-402) φαίνονται **committed** (όχι στο `git status` M) → ασφαλή να τα πειράξεις, αλλά επιβεβαίωσε με `git status` στην αρχή.

---

## 7. Verification (στόχος)
1. NEW unit test (`bim3d-preview-rebuild` ή νέο `bim3d-live-cascade.test.ts`): host move translation → dependent wall preview έχει `topClip`/breakpoints ίδια με το αντίστοιχο `syncWalls` output (ghost === commit). Non-attached host → καμία dependent rebuild (fast path).
2. `npx tsc --noEmit` → 0 νέα errors.
3. Existing: `npx jest bim3d-edit-live-preview bim3d-preview-rebuild wall-top-angled-crossing` πράσινα.
4. 🔴 Browser (Giorgio): τοίχος+δοκάρι υπό γωνία → «Σύνδεση Κορυφής» → **σύρε το δοκάρι** → ο τοίχος ξανα-κόβεται **live** (καμία stale τρύπα, καμία στιγμή χωρίς clip)· στο release καμία αλλαγή (ghost === commit)· Esc → restore· ίσιος/μη-attached αμετάβλητος.

## 8. Refs
- ADR: `ADR-401-...md` (§2.4 footprint-clip + face-crossing + flat-shading)· ADR-402 (3D editing live preview)· ADR-040/366 (rAF/dirty SSoT).
- Memory: `project_adr401_wall_top_constraints.md`, `project_adr402_genarc_gizmo_port.md`, `project_adr402_meterscale_vanish_fix.md`.
- Feedback: `feedback_derived_geometry_central_cascade.md` (derived geometry = ρητό cascade σε ΟΛΑ τα paths — εδώ το «path» είναι ο live drag).
