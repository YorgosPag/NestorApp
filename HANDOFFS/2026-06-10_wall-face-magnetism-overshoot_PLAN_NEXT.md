# 🧠 HANDOFF — ADR-363 Φ1G.5 Slice 2j: Revit-grade face-to-face magnetism ΧΩΡΙΣ αλληλοδιείσδυση (sidedness) + ένταση έλξης

> **Σύνταξη:** Opus 4.8, 2026-06-10. **Στόχος:** Recognition → Plan Mode → έγκριση Giorgio → υλοποίηση **FULL ENTERPRISE + FULL SSOT, «όπως η Revit»**. Καθαρό context (το προηγούμενο γέμισε στο ~92%).
> **Συνέχεια του:** Slice 2i (face magnetism + glyph + dashed line) + Slice 2i-fix (3Δ tolerance + snap label + base-point world-vertex). **ΟΛΑ 🔴 pending commit (ο Giorgio committάρει).**

---

## ⚠️ ΚΑΝΟΝΕΣ (ΠΡΩΤΑ — ΑΠΑΡΑΒΑΤΟΙ)
- **Ελληνικά** πάντα στον Giorgio.
- **FULL ENTERPRISE + FULL SSOT, «όπως η Revit»** — ρητή, επαναλαμβανόμενη απαίτηση. Reuse τη ΜΙΑ μηχανή έλξης (`ProSnapEngineV2`/`getGlobalSnapEngine`). **ΜΗΝ** νέα snap/intersection μηχανή. Αρχεία ≤500 γρ., functions ≤40, μηδέν `any`/`as any`/`@ts-ignore`.
- **SHARED working tree** με άλλον agent → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ `git add -A`**. Read-before-Edit (αλλάζουν κάτω από τα πόδια σου — ιδίως `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, `ADR-363`).
- **COMMIT/PUSH = ΜΟΝΟ ο Giorgio** (N.(-1)). **ΜΗΝ** commit, **ΜΗΝ** `adr-index`.
- **N.17:** ΕΝΑΣ tsc τη φορά — process-check ΠΡΩΤΑ (`Get-CimInstance Win32_Process | ? CommandLine -like '*tsc*'`). Έτρεχαν tsc άλλων agents — ΠΕΡΙΜΕΝΕ/watcher, μην ξεκινήσεις 2ο.
- **ADR-040:** overlays = scene-leaves· gizmo overlay = shared → stage `ADR-363` για CHECK 6B/6D.
- **N.14 model:** Opus (cross-cutting snapping + 3Δ). **N.8:** ~5-8 αρχεία → Plan Mode.
- **Πάρε ΕΣΥ τις Revit αποφάσεις** + ζήτα ΜΟΝΟ έγκριση plan ([[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]]).

---

## 0) ΤΟ ΑΙΤΗΜΑ (Giorgio, browser feedback 2026-06-10)
1. **BUG overshoot:** «Το Ctrl+click τοποθετεί πλέον το gizmo στην κορυφή σωστά. ΑΛΛΑ όταν κοντοζυγώνω στον σταθερό τοίχο, η έλξη **τραβάει τον μετακινούμενο τοίχο πιο μέσα/πέρα από την παρειά/πλευρά/ακμή** του σταθερού τοίχου» (αντί να σταματήσει flush στην παρειά → αλληλοδιείσδυση).
2. **Ένταση:** «Πρέπει να **αυξηθεί ακόμη λίγο η ένταση** της έλξης.»

## 1) ΔΙΑΓΝΩΣΗ (έτοιμη — επιβεβαίωσέ την στο Recognition)
**Ρίζα overshoot = έλλειψη sidedness (επίγνωση πλευράς):**
- Το `buildDragSnapFn` ταΐζει **και τις 4 face-corners** του κινούμενου τοίχου ως probes (`getWallCornerWorldPoints`).
- Ο `WallFaceSnapEngine` εκθέτει **2 face lines** ανά static τοίχο (outer `corners[0→1]`, inner `corners[3→2]`) και επιστρέφει την **πλησιέστερη** (`nearestFaceOnWall`).
- Το `makeMoveSnapFn` διαλέγει το ζεύγος (probe→target) με τη **μικρότερη ευκλείδεια απόσταση** — **ΧΩΡΙΣ επίγνωση ποια παρειά «κοιτάει» ποια**.
- Αποτέλεσμα: μπορεί να κουμπώσει η **«πίσω» παρειά** του κινούμενου τοίχου στην παρειά του σταθερού (ή corner→far-face), οπότε ο κινούμενος τοίχος **πατάει πάνω/μέσα** στον σταθερό (μετατόπιση κατά ~πάχος τοίχου). Αυτό είναι το «πιο μέσα από την παρειά».
- **Δευτερεύον:** με το μεγαλύτερο 3Δ tolerance (Slice 2i-fix), η far face μπαίνει στο range νωρίτερα → εντείνει το overshoot.

**Το σωστό Revit μοντέλο (decision για το Plan):** face-to-face = **directional line alignment**: η **αντικριστή (confronting)** παρειά του κινούμενου τοίχου ευθυγραμμίζεται με την **αντικριστή** παρειά του σταθερού, ώστε οι δύο τοίχοι να γίνουν **flush/εφαπτόμενοι ΧΩΡΙΣ αλληλοδιείσδυση**. Δηλ. το snap πρέπει να επιλέγει το ζεύγος (moving-face, static-face) με βάση **κανονικά διανύσματα/πλευρά**, όχι μόνο απόσταση:
  - Παράλληλοι τοίχοι (side-by-side flush): η δεξιά παρειά του ενός ↔ αριστερή παρειά του άλλου (αντίθετα normals, μη-overlapping).
  - Κάθετο T-junction: η END παρειά του κινούμενου σταματά στην πλευρική παρειά του σταθερού (butt, χωρίς να μπαίνει).
  - Collinear continuation: outer↔outer & inner↔inner ευθυγραμμίζονται.

## 2) ΠΡΟΤΑΣΗ ΣΧΕΔΙΟΥ (οριστικοποίησε στο Plan — Revit αποφάσεις δικές σου)
Πιθανές προσεγγίσεις (διάλεξε/συνδύασε, FULL SSOT):
1. **Sidedness στο `WallFaceSnapEngine`:** το candidate να κουβαλά το **face normal** (outward) + ποια πλευρά (outer/inner). Στο `bim3d-snap-bridge`/`buildDragSnapFn`, ταΐζοντας τις moving faces, να φιλτράρεις/βαθμολογείς ζεύγη όπου τα normals είναι **αντίθετα** (confronting) και η ευθυγράμμιση **δεν προκαλεί overlap** (ο κινούμενος μένει στην «έξω» μεριά). Reuse `wall-trims.ts` `sinAngleBetween`/normals SSoT.
2. **Move-aware filtering:** προτίμησε το ζεύγος που ευθυγραμμίζει τη **leading** παρειά (αυτή που κινείται προς τον σταθερό) → μηδέν penetration. Η κατεύθυνση κίνησης = `liveTranslation`.
3. **Anti-penetration guard:** απόρριψε λύσεις snap όπου τα δύο wall footprints **τέμνονται** (reuse υπάρχον polygon-overlap/`pointInPolygon` SSoT· βλ. `REGION_PERIMETER_LIMITS`/wall geometry). Κράτα μόνο flush/touching.
4. **Ένταση έλξης (Giorgio):** αύξησε το px tolerance του `BIM_WALL_FACE` (τώρα **10**, `perModePxTolerance` στο `extended-types.ts`) σε ~**16-20** (ή χωριστή σταθερά), ΚΑΙ/Ή δες ότι το 3Δ `syncSnapEngineViewportFor3D` (στο `bim3d-edit-interaction-handlers.ts`) δίνει αρκετά γενναιόδωρο `worldPerPixel`. Revit-feel: ~150-250mm pull σε τυπικό zoom.

**ΠΡΟΣΟΧΗ:** μην σπάσεις τα corner snaps (priority -2) — αυτά πρέπει να κερδίζουν στα άκρα. Ο `BIM_WALL_FACE` είναι priority **9.5** (γραμμικό, κάτω από διακριτά σημεία). Κράτα το.

## 3) 🧩 SSOT ΧΑΡΤΗΣ — ΤΑ ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΑΓΓΙΞΕΙΣ (όλα ΗΔΗ τροποποιημένα στο Slice 2i/2i-fix, pending commit)
| Τι | Αρχείο |
|----|--------|
| **Face engine (η καρδιά του fix)** | `snapping/engines/WallFaceSnapEngine.ts` — `nearestFaceOnWall` (outer/inner projection· εδώ μπαίνει sidedness/normal) |
| Wall corners SSoT | `bim/walls/wall-corner-anchors.ts` (`getWallCornerWorldPoints` → outer-start/outer-end/inner-end/inner-start) |
| Move snap multi-grab | `bim-3d/gizmo/bim3d-snap-bridge.ts` (`makeMoveSnapFn` nearest-by-distance — εδώ ίσως directional scoring) |
| Face offsets feeding | `bim-3d/animation/bim3d-edit-interaction-handlers.ts` (`buildDragSnapFn` ταΐζει face corners· `syncSnapEngineViewportFor3D`) |
| Priority/tolerance | `config/tolerance-config.ts` (`SNAP_ENGINE_PRIORITIES.BIM_WALL_FACE=9.5`) · `snapping/extended-types.ts` (`perModePxTolerance[BIM_WALL_FACE]=10`) |
| Wall-trim normals/junction SSoT (reuse) | `bim/walls/wall-trims.ts` (`sinAngleBetween`, `MIN_ANGLE_RAD`, `JOIN_THRESHOLD_MM` — γωνία/παραλληλία) |
| Drag snap math | `bim-3d/gizmo/bim-gizmo-drag-bridge.ts` (`applySnap` → `liveTranslation`, `activeSnapWorld`, `activeAlignmentWorld`, `activeSnapLabel`) |
| Dashed alignment line | `bim-3d/placement/TempAlignmentLineOverlay.ts` |
| Snap-type label | `bim-3d/placement/TempSnapLabelOverlay.ts` + `snapping/snap-description-keys.ts` (SSoT 2D+3Δ) |

## 4) ΤΙ ΗΔΗ ΕΓΙΝΕ (Slice 2i + 2i-fix — ΜΗΝ το ξαναφτιάξεις· όλα 🔴 pending commit Giorgio)
**Slice 2i (face magnetism + glyph + dashed line):**
- NEW `snapping/engines/WallFaceSnapEngine.ts` (`BIM_WALL_FACE` priority 9.5· projection στις 2 face lines· candidate κουβαλά `referenceSegment`).
- `extended-types.ts` (+`BIM_WALL_FACE` enum/enabled/priority/tolerance + `referenceSegment?` στο `SnapCandidate`)· `BaseSnapEngine.createCandidate` +referenceSegment· `SnapEngineRegistry` register· `tolerance-config.ts` priority 9.5.
- Bridge: `SnapResolution += alignmentRef/snapDescription/snapType`· `makeMoveSnapFn` κουβαλά reference/description· `bim-gizmo-drag-bridge` `activeAlignmentWorld`/`activeSnapLabel` + `bim-gizmo-controller` passthrough.
- `buildDragSnapFn`: ταΐζει wall face-corner offsets (flush face-to-face).
- Glyph: `gizmo-constants` `SNAP_MARKER_MOVE_SCREEN_SCALE=0.045`· `bim-gizmo-overlay` `snapMarkerScaleOverride` (αντικατέστησε `suppressSnapMarker` → marker μικρός, όχι hidden).
- NEW `TempAlignmentLineOverlay.ts` (dashed μπλε `0x4a90d9`)· driven στο `bim3d-edit-live-preview-apply` (`updateAlignmentLine`).

**Slice 2i-fix (3 browser fixes):**
- **(1) ROOT CAUSE «δεν κολλάει»:** το 3Δ ΔΕΝ έθετε viewport στη snap μηχανή → `worldPerPixel~1` → tolerance ~10mm. FIX: NEW `syncSnapEngineViewportFor3D(ctx, engine)` στο `buildDragSnapFn` (`getPixelWorldSize×1000`, 1 Three μέτρο=1000 DXF mm· self-healing).
- **(2) Snap-type label** «Παρειά τοίχου»/«Γωνία τοίχου»: NEW `snapping/snap-description-keys.ts` SSoT (εξήχθη από `SnapIndicatorOverlay`, +`wallFace`)· i18n el/en· bridge `snapDescription/snapType`· NEW `TempSnapLabelOverlay.ts` (reuse exported `createLabelTexture` του `Dimension3DRenderer`)· hook `useTranslation`/`resolveSnapLabel`· `updateSnapLabel` (apply).
- **(3) Ctrl+click base point ΔΕΝ έπεφτε στην κορυφή:** `bim-3d/dimensions/dim3d-snap-engine-adapter.ts` `nearestEndpoint` έπαιρνε local bbox corners ΧΩΡΙΣ world transform (+AABB≠πραγματικές γωνίες σε διαγώνιο). FIX: scan **πραγματικών mesh vertices σε WORLD** (`applyMatrix4(matrixWorld)`, cap 4000→bbox fallback).

**Tests (όλα PASS):** `WallFaceSnapEngine` 8· `bim3d-snap-bridge` +3· `TempAlignmentLineOverlay` 5· `TempSnapLabelOverlay` 4· `snap-description-keys` 4· `dim3d-snap-engine-adapter` 2· `bim-gizmo-overlay` (updated)· **464 consolidated regression**. **tsc exit 0** (καθαρό, ×2 επιβεβαιωμένο).

## 5) ΑΡΧΕΙΑ ΜΟΥ (git add ΜΟΝΟ αυτά όταν committάρει ο Giorgio — shared tree)
**NEW:** `snapping/engines/WallFaceSnapEngine.ts` (+test), `snapping/snap-description-keys.ts` (+test), `bim-3d/placement/TempAlignmentLineOverlay.ts` (+test), `bim-3d/placement/TempSnapLabelOverlay.ts` (+test), `bim-3d/dimensions/__tests__/dim3d-snap-engine-adapter.test.ts`.
**MOD:** `snapping/extended-types.ts`, `config/tolerance-config.ts`, `snapping/shared/BaseSnapEngine.ts`, `snapping/orchestrator/SnapEngineRegistry.ts`, `canvas-v2/overlays/SnapIndicatorOverlay.tsx`, `bim-3d/gizmo/{bim3d-snap-bridge,bim-gizmo-drag-bridge,bim-gizmo-controller,gizmo-constants,bim-gizmo-overlay}.ts` (+ `__tests__/bim-gizmo-overlay.test.ts`, `__tests__/bim3d-snap-bridge.test.ts`), `bim-3d/dimensions/{dim3d-snap-engine-adapter,Dimension3DRenderer}.ts`, `bim-3d/animation/{bim3d-edit-interaction-handlers,use-bim3d-edit-interaction,bim3d-edit-live-preview-apply}.ts`, `i18n/locales/{el,en}/dxf-viewer-shell.json`.
**DOCS:** `ADR-363-bim-drawing-mode.md` §12 (Slice 2i + 2i-fix) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr363_2d_move_from_point.md`. **ΜΗΝ** adr-index.

## 6) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ νέα snap/intersection μηχανή (reuse engine + `wall-trims` normals SSoT). ΜΗΝ μαύρο περίγραμμα σε γραμμές/βέλη. ΜΗΝ ξαναφέρεις τον ΤΕΡΑΣΤΙΟ κύβο marker.
- ΜΗΝ χαλάσεις τα corner snaps (-2) ή τα discrete points — η παρειά μένει 9.5.
- ΜΗΝ commit/push/adr-index/`git add -A`/2ο tsc.

## 7) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
`git log -5` + `git status` → Recognition (επιβεβαίωσε §1 διάγνωση: τύπωσε/σκέψου ποιο face-pair κερδίζει σε flush vs overshoot· δες `nearestFaceOnWall` + `makeMoveSnapFn`) → επιβεβαίωσε repro με Giorgio (παράλληλοι τοίχοι; T-junction; ποια ακριβώς πλευρά μπαίνει μέσα) → **Plan Mode** (§2 + Revit decisions: sidedness model + anti-penetration + tolerance bump) + εκτίμηση → περίμενε έγκριση. **GOL + SSOT.**

## 8) ΜΝΗΜΕΣ
[[project_adr363_2d_move_from_point]] (πλήρες ιστορικό Slice 2d→2i-fix)· [[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]].
