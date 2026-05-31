# HANDOFF — ADR-401 Phase F.2 (Column attach consumers: 3D / 2D / BOQ / ETICS)

**Ημερομηνία:** 2026-05-31
**Προηγούμενο:** **F.1 ✅ DONE** (column attach **core engine**) — pending commit (ο Giorgio committαρει).
**Επόμενο:** **F.2** = οι **consumers** που διαβάζουν το νέο profile ώστε η κολώνα να ψηλώνει/χαμηλώνει/γέρνει πραγματικά σε 3Δ/2Δ/μετρήσεις/θερμοπρόσοψη.

---

## 0. ΚΑΤΑΣΤΑΣΗ ΤΩΡΑ — ΔΙΑΒΑΣΕ ΠΡΩΤΑ

### Phase F context (Giorgio decisions 2026-05-31)
Phase F = γενίκευση του top/base attach-to-structural **από τοίχο → κολώνα** (Revit «Attach Top/Base» για columns). Δύο αποφάσεις:
- **(α) ΣΥΝΘΕΤΟ profile** — η κολώνα ακολουθεί **κεκλιμένη** κορυφή/βάση (π.χ. κάτω από κεκλιμένη στέγη), όχι μόνο ίσιο κόψιμο.
- **(β) ΠΛΗΡΕΣ mirror** — core + auto-attach + ribbon + 3D grip + edit-break.

Σπασμένο σε **F.1 (core) → F.2 (consumers) → F.3 (auto+ribbon+grip+edit-break)** («phase per session ≤70%»).

### ✅ F.1 — τι ΗΔΗ υπάρχει (κωδικά πλήρες, pending commit)
1. **`bim/types/column-types.ts`**: `ColumnParams += attachTopToIds?/attachBaseToIds?: readonly string[]` (mirror wall).
2. **`bim/types/column.schemas.ts`**: τα 2 πεδία + **4 Zod refinements** `attached ⇔ ≥1 id` (mirror `wall.schemas.ts`).
3. **NEW `bim/geometry/column-vertical-profile.ts`** (ο resolver SSoT — **το κλειδί για το F.2**):
   - Scalars: `resolveColumnBaseZmm(params, ctx)` / `resolveColumnNominalTopZmm(params, ctx)` (mirror wall).
   - **Per-corner** profiles:
     - `resolveColumnTopProfile(params, footprint, ctx) → ColumnTopProfile`
     - `resolveColumnBaseProfile(params, footprint, ctx) → ColumnBaseProfile`
   - `makeColumnHostResolver(hosts) → (id)=>HostFootprintInput|null`
   - Types: `ColumnVerticalParams`, `ColumnVerticalContext`, `ColumnTopProfile`, `ColumnBaseProfile`, const `COLUMN_Z_EPS`.
4. **NEW `__tests__/column-vertical-profile.test.ts`** — 19/19 PASS. tsc 0 errors.

### 🔑 ΑΡΧΙΤΕΚΤΟΝΙΚΟ ΜΟΝΤΕΛΟ ΤΟΥ RESOLVER (πρέπει να το καταλάβεις πριν τους consumers)
Ο τοίχος έχει **άξονα** → 1D profile κατά μήκος `t` (0→1). Η κολώνα **δεν έχει άξονα** (σημειακό footprint) → το profile αποτιμάται **ΑΝΑ ΓΩΝΙΑ του footprint**:
- **`ColumnTopProfile.cornerTopZmm: readonly number[]`** — ένα Z (absolute mm) ανά γωνία του footprint, **ίδια σειρά με το footprint polygon** που έδωσες.
  - top = lower-envelope: `min{ nominalTop, [κάτω-παρειές των hosts που καλύπτουν τη γωνία] }`.
- **`ColumnBaseProfile.cornerBaseZmm: readonly number[]`** — base ανά γωνία.
  - base = upper-envelope bidirectional: `max{ άνω-παρειές των hosts που καλύπτουν τη γωνία }`· ακάλυπτη γωνία → nominal base.
- Όταν διαφορετικές γωνίες πέφτουν σε διαφορετικά / κεκλιμένα hosts → **οι γωνίες διαφέρουν** ⇒ **κεκλιμένη/στρεβλή κορυφή** (το «σύνθετο profile»). Flat host → όλες οι γωνίες ίσες (back-compat ίσια κολώνα).
- Επίσης διαθέσιμα: `maxTopZmm`/`minTopZmm`/`maxBaseZmm`/`minBaseZmm` (για bbox/scalar consumers), `hasAttach`, `missingHostIds`, `baseZmm`/`nominalBaseZmm`.
- **REUSE (μην διπλασιάσεις):** ο resolver καταναλώνει αυτούσια τα `HostFootprintInput` που φτιάχνουν τα `beamHostInput`/`slabHostInput`/`buildWallHostInputs` (στο `bim/geometry/wall-host-plan-builder.ts`). Coverage μέσω `isPointInPolygon` (GeometryUtils).

### ⚠️ COMMIT STATUS
**ΤΡΕΞΕ `git log --oneline -5` + `git status` ΠΡΩΤΑ.** Το F.1 θα είναι committed από τον Giorgio πριν ανοίξει αυτή η session (μήνυμα στόχος: `feat(bim): ADR-401 F.1 column attach core engine ...`). Μην υποθέσεις — multi-agent repo. Αν ΔΕΝ είναι committed, τα αρχεία F.1 είναι στο working tree (μην τα ξαναγράψεις).
> 💡 Το `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` είναι **untracked** (πρόθεμα `local_`) — `git status` το αγνοεί, ζει μόνο στον δίσκο. Μην πανικοβληθείς.

---

## 1. PHASE F.2 — SCOPE (consumers)  [Opus, μεσαίο-μεγάλο, 3D = το βαρύ]

**Στόχος:** να καταναλώσουν οι 4 consumers το `ColumnTopProfile`/`ColumnBaseProfile` ώστε η attached κολώνα να εμφανίζεται/μετριέται σωστά. **Flat/μη-attached = byte-for-byte fast path παντού** (μηδέν regression — όπως έκανε ο τοίχος σε όλα τα B-phases).

### Consumer #1 — 3D `columnToMesh` (ΤΟ ΒΑΡΥ — κάν' το πρώτο/μόνο του αν χρειαστεί)
- **Αρχείο:** `bim-3d/converters/BimToThreeConverter.ts`, `columnToMesh(column, floorElevationMm=0, levelId?, buildingBaseElevationM=0)` (~γρ. 289).
- **Τώρα:** `extrudeAndRotate(shape, column.params.height * MM_TO_M)` + `mesh.position.y = floorElevationMm*MM_TO_M + buildingBaseElevationM`. Flat scalar extrusion.
- **Στόχος:** μεταβλητό/κεκλιμένο top **και** base ανά γωνία footprint.
- **ΟΔΗΓΟΣ = ο τοίχος:** δες πώς το `wallToMesh(..., profile?: WallTopProfile, baseProfile?: WallBaseProfile)` (~γρ. 236) κάνει routing flat→`ExtrudeGeometry` / sloped→`buildSlopedWallPieceGeometry` (στο `bim-3d/converters/wall-piece-geometry.ts`) μέσω `makeWallTopLocalFn`/`makeWallBaseLocalFn` (mm→local m).
- **ΠΡΟΣΟΧΗ:** ο wall wedge είναι **8-vertex** (επίπεδη βάση + κεκλιμένη κορυφή κατά μήκος **ενός** άξονα). Η κολώνα έχει **footprint polygon** με **per-corner** top/base → χρειάζεται **per-vertex shear** του prism (μοιάζει περισσότερο με `applySlabSlope`/`applyBeamSlope` — affine shear στο world-Y που διαβάζει το cornerTopZmm/cornerBaseZmm — παρά με τον 8-vertex wall wedge). **Σχεδίασε το prima:** πιθανότατα νέο helper `bim-3d/converters/column-piece-geometry.ts` (ή reuse applySlabSlope pattern) που:
  1. extrude το footprint από `minBaseZmm` έως `maxTopZmm` (ή base→top),
  2. shear-άρει τα top vertices στο `cornerTopZmm[i]` και τα bottom στο `cornerBaseZmm[i]`.
- **Wiring scene:** βρες πού καλείται το `columnToMesh` (μάλλον `BimSceneLayer.syncColumns`/`sync*`) και χτίσε εκεί το context: `buildWallHostInputs(beams, slabs)` + `makeColumnHostResolver` + `resolveColumnTop/BaseProfile(params, footprint, ctx)` **μόνο όταν** `column.params.topBinding==='attached' || baseBinding==='attached'` (guard, μηδέν κόστος αλλιώς). `floorElevationMm` = active-level σύμβαση (δες παρακάτω). footprint = `computeColumnGeometry(params).footprint.vertices` (mm/params space — **ίδιο space με τους hosts**).
- **Units:** profile z = absolute mm → local m = `(z − floorElevationMm) * MM_TO_M`. footprint/host coverage σε params space (mm). Δες το wall `makeWallTopLocalFn`.

### Consumer #2 — 2D `ColumnRenderer` (cut-state)
- **Αρχείο:** `bim/renderers/ColumnRenderer.ts` (~γρ. 100, `render`). Διαβάζει `params.baseOffset`/`params.height` μόνο για **cut-state** (`zBottomMm`/`zTopMm`, ~γρ. 133-135, 352-353) — τι ζωγραφίζεται στο cut plane.
- **Πιθανότατα NO-OP (όπως ο τοίχος B3c):** ο `WallRenderer` είναι render leaf (ADR-040 — **δεν σκανάρει hosts**)· το cut plane (~1.2m) πέφτει πάντα μεταξύ base & attached-top → ίδιο cut-state. **Πρώτα επιβεβαίωσε** αν διαφέρει κάτι· αν όχι → doc σχόλιο μόνο (όπως B3c), μηδέν αλλαγή λογικής. (Διαφορά μόνο σε extreme: host underside κάτω από το cut plane → εκτός scope.)

### Consumer #3 — BOQ `computeColumnGeometry` (ύψος/όγκος)
- **Αρχείο:** `bim/geometry/column-geometry.ts`, `computeColumnGeometry(params)` (~γρ. 57). `heightMm = Math.max(0, params.height)`· `volumeM3 = areaM2 * heightMm * MM_TO_M` (~γρ. 79).
- **ΟΔΗΓΟΣ = τοίχος B3a:** `computeWallGeometry(params, kind, openings?, profile?)` — πρόσθεσε optional `topProfile?`/`baseProfile?` params → effective height = **μέσο ύψος ανά footprint** (π.χ. `avg(cornerTopZmm) − avg(cornerBaseZmm)` ή ολοκλήρωμα· για column με ~ομοιόμορφο footprint, `avg` αρκεί· δες `profileGrossAreaM2` του wall για το pattern). volume = areaM2 × effHeight. bbox από `min/maxBaseZmm`..`min/maxTopZmm`. **Flat/χωρίς profile = byte-for-byte fast path.**
- **BOQ feed:** βρες τον column BOQ feed (mirror `hooks/data/wall-boq-feed.ts` → `resolveAttachedWallProfile`). Αν δεν υπάρχει column boq feed που recompute-άρει profile-aware, χτίσε `resolveAttachedColumnProfiles(entity, scene)` (filter beams+slabs → `buildWallHostInputs` → `makeColumnHostResolver` → resolvers, `floorElevationMm:0`).

### Consumer #4 — ETICS (θερμοπρόσοψη)
- **Αρχείο:** `bim/geometry/envelope-column-bridge.ts` (2D plan-only: footprint/centroid· `prepareColumns`/`columnExteriorArc`/`columnNodeKey`...). Το Z extent χειρίζεται αλλού (`EnvelopeToThree` + `envelope-wall-top/base.ts` + `bim-envelope-scene-builder`).
- **ΟΔΗΓΟΣ = τοίχος B3b/γ3:** αν το ETICS κέλυφος ντύνει την κολώνα με μεταβλητό Z, χρειάζεται column-analog του `resolveEnvelopeEdgeTops`/`resolveEnvelopeEdgeBases` + `addProfiledBand`. **⚠️ ΑΥΤΟ ΜΠΟΡΕΙ ΝΑ ΕΙΝΑΙ ΜΕΓΑΛΟ** — αν φανεί ότι ξεπερνά το context budget, **κάν' το F.2-δ ξεχωριστά** (handoff στη μέση) ή ρώτα τον Giorgio αν η κολώνα-θερμοπρόσοψη είναι όντως σε scope τώρα (συχνά οι κολώνες είναι εσωτερικές → μηδέν ETICS).

### Σειρά προτεινόμενη
**3D πρώτο** (το ορατό + βαρύ· κάνε εδώ το σχεδιασμό του per-corner shear), μετά **BOQ**, μετά **2D** (πιθανό no-op), μετά **ETICS** (ή handoff). Αν το context φτάσει ~70% μετά το 3D → **σταμάτα, handoff τα υπόλοιπα**.

---

## 2. ⚠️ ΚΡΙΣΙΜΑ ΣΗΜΕΙΑ (CLAUDE.md + lessons)

- **N.(-1):** ΟΧΙ commit/push. **Ο Giorgio κάνει τα commits — ΟΧΙ εσύ.** ΟΧΙ `git add -A`.
- **N.8/N.14:** F.2 = 3-5+ αρχεία → Opus. Plan Mode αν χρειαστεί.
- **CHECK 6B/6D:** αγγίζεις `BimToThreeConverter`/`BimSceneLayer`/renderer/converter/scene → **stage ADR-401** (+ADR-369 αν section/datum, +ADR-402 αν gizmo — δεν αφορά F.2). Χωρίς staged ADR → pre-commit block.
- **Units παγίδα (ΚΡΙΣΙΜΟ):** profile z = **absolute mm**. footprint + host footprints = **params/plan space (mm)**. click worldPoint = scene units. Conversion μόνο στο boundary (`* MM_TO_M`, `(z−FFL)*MM_TO_M`). ⚠️ Ιστορικό: ColumnAnchor `localToWorld` χωρίς `mmScaleFor` → meter-scene 1000× off (ADR-398). Reuse computed geometry, μην re-derive. [[feedback_grip_positions_read_geometry]]
- **Active-level σύμβαση:** όλα τα wall consumers χρησιμοποιούν `floorElevationMm: 0` (datum 0, level-relative). Κάνε το ίδιο στους column consumers.
- **i18n (N.11):** αν προσθέσεις labels (μάλλον ΟΧΙ στο F.2 — UI έρχεται στο F.3) → keys πρώτα σε `el/` **ΚΑΙ** `en/dxf-viewer-shell.json`. ΟΧΙ hardcoded/`defaultValue`.
- **orchestrator/Explore αναξιόπιστος** στα internal details — **re-read το αληθινό αρχείο πριν κάθε edit**.
- **tsc background:** `npx tsc --noEmit` (run_in_background) πριν θεωρήσεις πλήρες· grep μόνο τα δικά σου αρχεία (ΜΗΝ full-Read τα `.output` — φουσκώνουν, [[feedback_no_read_bg_output_files]]).
- **Tests:** mirror τα wall consumer tests (`wall-stepped-solid.test.ts`, `wall-geometry.test.ts` profile-aware describe). Profile literals decoupled από resolver (φτιάξε `ColumnTopProfile` literals στα tests, μην τρέχεις resolver).
- **N.15 (στο τέλος F.2):** ADR-401 §5 (F.2 status) + §8 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ΟΜΑΔΑ ΑΥΔ) + memory `project_adr401_wall_top_constraints.md`. Ένα commit (από Giorgio).

---

## 3. ΡΟΗ ΕΡΓΑΣΙΑΣ (ADR-driven N.0.1)
1. **Recognition:** `git log -5`+`git status`· **re-read** `column-vertical-profile.ts` (το API που θα καταναλώσεις) + `BimToThreeConverter.columnToMesh` & `wallToMesh` (mirror) + `wall-piece-geometry.ts`/`applySlabSlope`/`applyBeamSlope` (shear patterns) + `column-geometry.ts` + `wall-boq-feed.ts` (mirror BOQ feed).
2. **Σχεδίασε το 3D per-corner shear πρώτα** (το μόνο μη-τετριμμένο). Μετά implement → tests → tsc background.
3. **N.15 docs** + **ΟΧΙ commit** (Giorgio committαρει).
4. Αν context ~70% μετά το 3D → handoff τα υπόλοιπα (BOQ/2D/ETICS) σε F.2-rest.

---

## 4. ΑΝΑΦΟΡΕΣ
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-401-...attach-to-structural.md` §5 (Phase F: F.1✅/F.2/F.3) + §5.1 consumer map (wall — οδηγός) + §8 changelog.
- **Resolver (F.1, η είσοδος του F.2):** `bim/geometry/column-vertical-profile.ts` + test.
- **Mirror sources (wall consumers):** `bim-3d/converters/BimToThreeConverter.ts` (`wallToMesh`), `bim-3d/converters/wall-piece-geometry.ts`, `bim/geometry/wall-geometry.ts` (B3a profile-aware), `hooks/data/wall-boq-feed.ts`, `bim/renderers/WallRenderer.ts:189` (B3c no-op).
- **Shear patterns:** `applySlabSlope`/`applyBeamSlope` στο `BimToThreeConverter` (per-vertex world-Y shear — το πιο κοντινό μοντέλο στο per-corner column top).
- **Host adapters (reuse):** `bim/geometry/wall-host-plan-builder.ts` (`buildWallHostInputs`/`beamHostInput`/`slabHostInput`).
- **Memory:** `project_adr401_wall_top_constraints.md` (state, A→F.1 done).
- 🔴 **Browser verify** όλου του ADR-401 (A→F) εκκρεμεί.

---

## 5. F.3 (μετά το F.2 — για context)
auto-attach coordinator (`findColumnsToAutoAttachToHost`/`...Base`) · `AttachColumns{Top|Base}Command`/`DetachColumnsCommand` · column branch στο `useStructuralAutoAttach` · `useColumnAttachTool`+ToolTypes+`contextual-column-tab`+`useRibbonColumnBridge` · `RESIZE_HANDLES_BY_TYPE.column += 'resize-m-y'` + `computeColumnResizeParams` axis-Y detach-guard · **γενίκευση `wall-attach-detach.ts` → shared `entity-attach-detach.ts`** (Boy Scout N.0.2, τα binding fields είναι ίδια). Δευτερεύον (ξεχωριστό): Sub-Phase 1 stair 3D grips.
