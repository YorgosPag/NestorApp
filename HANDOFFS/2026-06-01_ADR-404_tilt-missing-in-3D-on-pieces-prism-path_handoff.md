# HANDOFF — ADR-404 · Η κλίση (tilt) τοίχου/κολώνας ΔΕΝ φαίνεται στο 3D όταν το στοιχείο είναι attached ή έχει ανοίγματα

- **Ημερομηνία**: 2026-06-01
- **Συντάκτης**: Claude (Opus 4.8)
- **Για**: ΝΕΑ συνεδρία (καθαρό context) — **3D geometry fix**, ADR-404 (tilt) ↔ ADR-401 (attach pieces/prism path).
- **🎯 Μοντέλο (N.14)**: **Opus** — cross-cutting geometry (δύο τύποι × δύο 3D paths), ~2-4 αρχεία, 2 domains (ADR-404 tilt shear ↔ ADR-401 pieces/prism builders).
- **⚠️ COMMIT/PUSH**: **ΤΑ ΚΑΝΕΙ Ο GIORGIO**, ΟΧΙ ο agent.
- **🚨 Multi-agent**: το working tree **μοιράζεται με άλλον agent**. Stage **ΜΟΝΟ** τα δικά σου hunks (λίστα §6).

---

## 0. ΠΡΩΤΟ ΒΗΜΑ
`"C:\Program Files\Git\cmd\git.exe" log --oneline -5` + `git status`. **ΠΡΟΣΟΧΗ:** πολλά αρχεία είναι **uncommitted/pending** (ο Giorgio θα κάνει commit). Συγκεκριμένα τα `BimToThreeConverter.ts`, `wall-top-clip.ts`, `column-piece-geometry.ts`, `wall-opening-pieces.ts`, `bim3d-edit-live-preview.ts`, `bim3d-preview-rebuild.ts`, `bim3d-edit-interaction-handlers.ts`, `ADR-401-*.md` είναι **δουλειά προηγούμενων ADR-401 sessions (face-crossing clip + live re-clip)** — **εξαρτάσαι** από αυτήν (το pieces/prism path που θα πειράξεις ζει εκεί). ΜΗΝ υποθέσεις τι έγινε commit.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (Giorgio live, 2026-06-01)

**Σενάριο:** τοίχος **ενωμένος (attached) με δοκάρι** (η ένωση δουλεύει σωστά). Ο χρήστης επιλέγει τον τοίχο, πιάνει **ένα από τα δύο δακτυλίδια κλίσης** του gizmo (ΟΧΙ το οριζόντιο Y-ring = plan rotate· τα X/Z rings = **tilt**, ADR-404 Phase 2) και δίνει κλίση ώστε ο τοίχος να γίνει **πλάγιος** (όχι κατακόρυφος).

**Σύμπτωμα:** η κλίση **εμφανίζεται στην 2D κάτοψη** (cut-plane projection) **αλλά ΟΧΙ στον 3D καμβά** — στο 3D ο τοίχος μένει κατακόρυφος.

---

## 2. ROOT CAUSE (ΕΠΙΒΕΒΑΙΩΜΕΝΟ — code = source of truth)

Το `wallToMesh` (`bim-3d/converters/BimToThreeConverter.ts`) έχει **ΔΥΟ** 3D paths:

### Δρόμος Α — «ίσιο solid» (γρ. ~305-322) — ΕΦΑΡΜΟΖΕΙ tilt ✅
Μπαίνεις εδώ μόνο όταν ο τοίχος **δεν** έχει ανοίγματα **ΟΥΤΕ** attach.
```ts
const geo = extrudeAndRotate(shape, wall.params.height * MM_TO_M);
applyWallTilt(geo, wall.params);   // γρ.313 — η μόνη κλήση tilt για τοίχο
```

### Δρόμος Β — «κομμάτια» `buildStraightWallWithOpenings` (γρ. ~185-261) — ΔΕΝ εφαρμόζει tilt ❌
Η συνθήκη επιλογής (γρ. ~292):
```ts
if (openings.length > 0 || wallTop || wallBase)   // → Δρόμος Β (pieces)
else                                              // → Δρόμος Α (solid + applyWallTilt)
```
Ο **attached** τοίχος έχει `wallTop`/`wallBase`/`topClip` (από ADR-401) → **πάντα Δρόμος Β**. Ο Δρόμος Β χτίζει per-piece geometries:
- `extrudeAndRotate(shape, depth)` (επίπεδη κορυφή+πάτος), Ή
- `buildSlopedWallPieceGeometry(pc)` (κεκλιμένη κορυφή/πάτος = ADR-401 wedge), Ή
- `buildColumnPrismGeometry(...)` (footprint-clip prisms = ADR-401 γωνιακή διασταύρωση)

…και **ΠΟΥΘΕΝΑ δεν καλεί `applyWallTilt`** → η κλίση χάνεται στο 3D.

### Γιατί η 2D κάτοψη το δείχνει
Το 2D cut-plane (ADR-404 Phase 3: `toWallPlan` + render-time `ctx.translate` στον `WallRenderer`) διαβάζει το `wall.params.tilt` **ανεξάρτητα** — δεν περνά από τα δύο 3D paths. Γι' αυτό η ασυμφωνία.

### ⚠️ Ευρύτερο — ισχύει ΚΑΙ για κολώνα
`columnToMesh` (γρ. ~325-364): ο attached **prism path** (γρ. ~342-352, `buildAttachedColumnPrism`) **δεν** καλεί `applyColumnTilt`· μόνο ο flat path (γρ.359). Άρα **κάθε τοίχος/κολώνα που μπαίνει σε pieces/prism path (attached ή με ανοίγματα) χάνει την κλίση στο 3D.**

### Επιβεβαίωση (grep)
`applyWallTilt` → μόνο γρ.313. `applyColumnTilt` → μόνο γρ.359. `wall-top-clip.ts` / `column-piece-geometry.ts` / `wall-opening-pieces.ts` → **καμία** αναφορά tilt/shear.

---

## 3. RECOGNITION (Phase 1 — διάβασε ΠΡΩΤΑ)
1. `bim-3d/converters/BimToThreeConverter.ts` — `wallToMesh` (δύο paths· γρ.292 η συνθήκη), `buildStraightWallWithOpenings` (γρ.185-261· εδώ το `group` + το `emit(geo, yOffset)` per piece), `columnToMesh` (γρ.325· prism path γρ.342).
2. `bim-3d/converters/mesh-slope-shear.ts` — `applyWallTilt(geo, params)` (γρ.66) + `applyColumnTilt`. **ΚΑΤΑΛΑΒΕ ΠΩΣ shear-άρει**: ποιο επίπεδο είναι το anchor (Y=0 floor-local; shear X/Z ∝ Y;) και τι διαβάζει από `params.tilt` (axis + γωνία/κλίση). Αυτό καθορίζει αν μπορείς να εφαρμόσεις ΕΝΑ shear στο group.
3. `bim/types/*` — `WallParams.tilt` / `ColumnParams.tilt` (τι σχήμα έχει: axis 'x'|'z' + slope/angle· no-op όταν flat).
4. `bim-3d/converters/wall-opening-pieces.ts` — πώς βγαίνουν τα `pc` (quad + zBot/zTop σε floor-local Y) — για να ξέρεις σε ποιο Y-frame ζουν τα pieces πριν το shear.
5. `bim-3d/converters/column-piece-geometry.ts` — `buildColumnPrismGeometry` (non-indexed πλέον· ADR-401 follow-up).
6. ADR-404 doc — πώς ορίζεται η κλίση + Phase 3 (2D cut-plane) ώστε **3D === 2D** (ίδια ερμηνεία tilt· μην αποκλίνεις).
7. ADR-401 doc §2.4 — γιατί υπάρχει ο Δρόμος Β (pieces/prism)· μην σπάσεις το face-crossing clip.

---

## 4. Η ΛΥΣΗ (προτεινόμενη — επιβεβαίωσέ την με Plan Mode)

**Στόχος: 3D === 2D** (ghost/render === cut-plane). Η κλίση να εφαρμόζεται και στον Δρόμο Β, χωρίς να σπάσει το ADR-401 clip.

**Προτιμώμενη (καθαρή, «όπως Revit»): ΕΝΑ shear matrix στο `group`** του `buildStraightWallWithOpenings` (και στο column prism mesh), αγκυρωμένο στο **επίπεδο δαπέδου** (Y = floor base), αντί να shear-άρεις per-piece geometry.
- Γιατί group-level: τα pieces emit-άρονται με διαφορετικά `mesh.position.y` (yOffset) ΚΑΙ geometries σε floor-local Y → ένα ομοιόμορφο shear matrix στο group γέρνει τα πάντα συνεπώς γύρω από το ΙΔΙΟ base plane (μηδέν per-piece arithmetic).
- Πρέπει το anchor του shear να είναι το **floor base Y** (το `group` ζει σε world· τα pieces έχουν +floorY). Πρόσεξε: αν εφαρμόσεις shear στο group με origin world-0, η κλίση θα «μεγεθύνεται» με το ύψος ορόφου → λάθος. Κάνε shear γύρω από το base plane (translate −baseY → shear → translate +baseY, ή ισοδύναμο matrix).
- **Επαναχρησιμοποίησε την ΙΔΙΑ μαθηματική ερμηνεία** με το `applyWallTilt` (ίδιος άξονας, ίδια φορά, ίδια γωνία) ώστε attached === μη-attached === 2D. Ιδανικά εξήγαγε ένα κοινό SSoT helper `wallTiltShearMatrix(params, baseY)` / `columnTiltShearMatrix(...)` στο `mesh-slope-shear.ts` που το χρησιμοποιούν ΚΑΙ ο flat path (αντί του in-place `applyWallTilt`) ΚΑΙ ο pieces/prism path → μία πηγή αλήθειας (N.0.2 Boy Scout).

**Εναλλακτική (αν το group-shear μπλέκει με το live-preview/edit gizmo):** shear κάθε `geo` μέσα στο `emit()` πριν το `mesh.position.y = yOffset`, αλλά τότε πρέπει να συνυπολογίσεις το yOffset στο shear (το geometry είναι σε τοπικό Y, το mesh ανεβαίνει). Πιο επιρρεπές σε λάθη — προτίμησε το group matrix.

### Κρίσιμα σημεία
- **3D === 2D:** μην εφεύρεις νέα tilt ερμηνεία· διάβασε ADR-404 Phase 3 (`toWallPlan`) + `applyWallTilt` και βγάλε ΤΟ ΙΔΙΟ.
- **No-op flat:** όταν `tilt` απουσιάζει/0 → καμία αλλαγή (byte-for-byte regression guard).
- **Μην σπάσεις ADR-401:** το face-crossing clip / wedge / prism πρέπει να μένουν σωστά· το shear εφαρμόζεται **μετά** το χτίσιμο των pieces, σαν τελικός μετασχηματισμός.
- **Edges projection:** `attachEdgesProjection` καλείται per-piece· αν κάνεις group shear, βεβαιώσου ότι τα edges ακολουθούν (συνήθως ναι, είναι child meshes).
- **Live preview (ADR-402, μόλις προστέθηκε):** `bim3d-preview-rebuild.ts` ξαναχτίζει τον τοίχο μέσω `wallToMesh` → αν διορθώσεις το `wallToMesh`, το **live tilt preview attached τοίχου ΔΙΟΡΘΩΝΕΤΑΙ αυτόματα** (περνά ήδη `topClip`). Επιβεβαίωσέ το (ghost === commit).
- **gizmo anchor:** ο τοίχος γέρνει — το edit gizmo overlay (ADR-402) ίσως χρειαστεί re-anchor μετά το commit (πιθανώς ήδη δουλεύει via bounding box· verify).

---

## 5. SCOPE
- **IN:** attached/with-openings **τοίχος** tilt στο 3D (Δρόμος Β) + attached **κολώνα** tilt (prism path). 3D === 2D.
- **OUT (follow-up αν προκύψει):** δοκάρι/πλάκα (έχουν δικό slope, όχι το ίδιο pieces issue — verify ότι ισχύουν)· σκάλα (no tilt by design)· τυχόν tilt+attach combined edge cases στο BOQ (η κλίση δεν αλλάζει όγκο σημαντικά — επιβεβαίωσε αν χρειάζεται).

---

## 6. Multi-agent — ΜΗΝ αγγίξεις (uncommitted, άλλου agent)
Έλεγξε `git status` στην αρχή. Ο άλλος agent δουλεύει **ADR-363 «from-perimeter walls»** — ΜΗΝ αγγίξεις:
`ribbon-contextual-config.ts`, `bim/walls/wall-from-entity.ts`, `bim/walls/perimeter-from-faces.ts` (+tests), `dxf-canvas-renderer.ts`, `useCanvasClickHandler.ts`, `use-wall-commit.ts`, `use-wall-tool-event-listeners.ts`, `useWallTool.ts`, `wall-tool-types.ts`, `useSpecialTools.ts`, `useDxfViewerNotifications.ts`, `mouse-handler-move/up.ts`, `useCentralizedMouseHandlers.ts`, `EventBus.ts`, `tool-definitions.ts`, `home-tab-draw.ts`, `toolbar/types.ts`, `adr-index.md`, `ADR-363*.md`, i18n `dxf-viewer-shell.json`, `bim/geometry/column-*` (U-shape/composite — ADR-363 Φ2), `column-types.ts`/`column.schemas.ts`/`column-validator.ts`.

**⚠️ ΣΥΝ-ΕΠΕΞΕΡΓΑΣΙΑ (pending ADR-401, θα γίνουν commit από Giorgio):** τα `BimToThreeConverter.ts`, `wall-top-clip.ts`, `column-piece-geometry.ts`, `wall-opening-pieces.ts` είναι **ήδη modified** από ADR-401. Θα τα πειράξεις ΚΙ ΕΣΥ — **κάνε surgical edits, stage ΜΟΝΟ τα δικά σου hunks** (`git add -p`), verify `git diff --cached` πριν πεις «έτοιμο». ΜΗΝ κάνεις `git checkout/restore` σε αυτά (memory: NEVER checkout other agent files).

**Δικά σου (νέα/κύρια):** `mesh-slope-shear.ts`, και τα tilt-hunks στο `BimToThreeConverter.ts` (+ πιθανώς `column-piece-geometry.ts`), + νέο/επεκταμένο test (`mesh-slope-shear.test.ts` ή `wall-tilt-3d.test.ts`), + `ADR-404-*.md`.

---

## 7. Verification (στόχος)
1. NEW/extended unit test: attached τοίχος με `tilt` → το `wallToMesh` group έχει shear-αρισμένες κορυφές (top X/Z μετατοπισμένο ∝ ύψος, base αμετάβλητο)· flat τοίχος → byte-for-byte (no shear). Ίδιο για κολώνα prism. Ghost === 2D (ίδια κλίση με `toWallPlan`).
2. `npx tsc --noEmit` → 0 νέα errors (filter τα touched αρχεία).
3. Existing πράσινα: `npx jest wall-top-angled-crossing wall-stepped-solid wall-opening-pieces column-piece-geometry mesh-slope-shear bim3d-edit-live-preview`.
4. 🔴 Browser (Giorgio): attached τοίχος+δοκάρι → tilt X/Z ring → **ο τοίχος γέρνει στο 3D** (όπως ήδη στην κάτοψη)· η ένωση με το δοκάρι παραμένει σωστή· live preview κατά το drag δείχνει την κλίση· ίσιος/μη-attached αμετάβλητος. Ίδιο για κολώνα.

## 8. Refs
- ADR: `ADR-404-*.md` (tilt, Phase 1 converter shear + Phase 3 2D cut-plane)· `ADR-401-*.md` §2.4 (pieces/prism path)· ADR-402 (3D gizmo tilt rings).
- Memory: `project_adr404_3d_bim_tilt.md`, `project_adr401_wall_top_constraints.md`.
- Feedback: `feedback_derived_geometry_central_cascade.md`, `feedback_3d_mirror_2d_ssot.md` (3D πρέπει να καθρεφτίζει το 2D SSoT).
- Code: `BimToThreeConverter.ts` γρ.292/305-322 (paths), `mesh-slope-shear.ts` γρ.66 (`applyWallTilt`).
