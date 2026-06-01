# HANDOFF — ADR-363 «Δομικά στοιχεία από περίγραμμα» — Φάσεις 2-3 (Τοιχία Ο.Σ.)

**Ημερομηνία:** 2026-06-01
**Συντάκτης:** Opus 4.8 — μετά την ολοκλήρωση **Φ0+Φ1** («Τοίχος από περίγραμμα»).
**ADR:** ADR-363 §6 Phase «Από περίγραμμα» (το Φ0+Φ1 είναι ήδη γραμμένο εκεί + §12 changelog).
**Προηγούμενο handoff (πλήρες context/αποφάσεις §2):** `2026-06-01_ADR-363_from-perimeter-walls-and-shearwalls_PLAN_handoff.md`.
**Γλώσσα:** Ελληνικά πάντα. **Commit/push:** ΜΟΝΟ Giorgio. **Shared working tree:** `git add <specific>`, ΠΟΤΕ `-A`/`checkout`/`restore` σε ξένα.

---

## ✅ ΤΙ ΕΓΙΝΕ ΗΔΗ (Φ0+Φ1 — μην το ξανακάνεις)

- **Φ0 κοινό SSoT:** `src/subapps/dxf-viewer/bim/walls/perimeter-from-faces.ts` — **ΕΤΟΙΜΟ & TESTED**, χρησιμοποιείται ΚΑΙ από τα τοιχία:
  - `extractClosedPolygons(entities, tol): Point2D[][]`
  - `classifyPerimeter(polygon, tol): 'rectangle'|'L'|'T'|'U'|'composite'`
  - `decomposeRectilinear(polygon, tol): DetectedRectangle[]` (κενό για composite)
  - `perimeterFacesToRects(entities, tol): { perimeters: ClosedPerimeter[]; rects; ignoredCount }`
  - `ClosedPerimeter = { polygon, shape, rects }`
- **Φ1 «Τοίχος από περίγραμμα»:** tool `'wall-from-perimeter'`, placementMode `'outer-perimeter'`, box-select → αλυσίδα `WallEntity` ανά σκέλος + miter (μέσω `addWallToScene.computeWallTrims`). Tests 23/23 + 449/449 wall regression, tsc clean.

**Για τα τοιχία θα ΚΑΤΑΝΑΛΩΣΕΙΣ το `classifyPerimeter` + `ClosedPerimeter.polygon` — ΟΧΙ `decomposeRectilinear` (τα τοιχία είναι ΕΝΑ ενιαίο entity, δεν σπάνε σε σκέλη).**

---

## 🔒 ΑΠΟΦΑΣΕΙΣ ΤΟΙΧΙΩΝ (κλειδωμένες από Giorgio — βλ. PLAN handoff §2)

| Σχήμα | ColumnKind | Κατάσταση |
|---|---|---|
| Ευθύ τοιχίο | `'shear-wall'` | ✅ ΥΠΑΡΧΕΙ |
| Γ | `'L-shape'` | ✅ ΥΠΑΡΧΕΙ |
| Τ | `'T-shape'` | ✅ ΥΠΑΡΧΕΙ |
| Π | `'U-shape'` | ❌ **ΝΕΟ (Φ2)** |
| Σταυρός/ακανόνιστο | `'composite'` | ❌ **ΝΕΟ (Φ2)** — γενική διατομή από αυθαίρετο κλειστό πολύγωνο |

**ΣΤΑΤΙΚΑ (κρίσιμο):** τοιχία **ΠΑΝΤΑ ΕΝΑ ενιαίο σύνθετο entity** — **ΠΟΤΕ** αυτόματη αποσύνθεση σε ανεξάρτητα κομμάτια (Eurocode 8: σύνθετη στατική λειτουργία + boundary elements/κρυφοκολώνες στις συμβολές· reflex corners = μελλοντικές ζώνες οπλισμού). Future-proof στατικό module.

---

## ✅ ΦΑΣΗ 2 — DONE 2026-06-01 (Opus 4.8) — pending commit, 🔴 verify (ΜΗΝ την ξανακάνεις)

`ColumnKind` 7→9: `'U-shape'` + `'composite'` **polygon-backed** (απόφαση industry ETABS Section Designer/Revit/Tekla — ακριβές πολύγωνο = SSoT για στατικές ιδιότητες). U-shape=explicit polygon (από-περίγραμμα) Ή παραμετρικό Π σταθερού πάχους (`ColumnUshapeParams{legThickness?,baseThickness?,flipY?,polygon?}`)· composite=`ColumnCompositeParams{polygon}` (πάντα ακριβές). Files: column-types.ts/column.schemas.ts (+Boy-Scout: enum έλειπε polygon/shear-wall/I-shape)/column-geometry.ts (`buildUshapeLocal`/`buildCompositeLocal`/`polygonToLocal`)/3 exhaustive `Record<ColumnKind>` maps (palette/ghost/atoe)/column-validator.ts/column-dim-labels.ts + i18n. **3D/BOQ/hatch μηδέν αλλαγή** (kind-agnostic). NEW test 15/15· 1002 regression· tsc clean. **Φ3 ΤΩΡΑ καταναλώνει αυτά τα kinds** (map `shape→ColumnKind` παρακάτω).
**Deferred Φ2b:** resize grips (column-variant-grips/column-grips) + mirror flipY (bim-mirror-geometry.ts) + section-profile + panel kind-picker.

## 📂 ΦΑΣΗ 2 (αρχικό πλάνο — ΥΛΟΠΟΙΗΘΗΚΕ, αναφορά μόνο) — Νέες διατομές κολώνας `U-shape` + `composite`

**RECOGNITION πρώτα:** διάβασε τα ΥΠΑΡΧΟΝΤΑ L-shape/T-shape paths σε ΟΛΟ το pipeline και mirror-άρέ τα.

Αρχεία-κλειδιά (αλυσίδα — άγγιξε με τη σειρά, tests ανά κομμάτι):
1. `bim/types/column-types.ts` — `ColumnKind` += `'U-shape' | 'composite'`. Param blocks: `ColumnUshapeParams` (παράμετρα όπως L/T: width/length/thickness ανά σκέλος ή bbox+flange/web), `ColumnCompositeParams { polygon: Point2D[] }`. + anchors.
2. `bim/types/column.schemas.ts` — Zod επέκταση (mirror L-shape schema).
3. `bim/geometry/column-geometry.ts` — `computeColumnGeometry` footprint polygon ανά kind: U-shape παραμετρικό· composite = το ίδιο το polygon (pass-through).
4. `bim/renderers/ColumnRenderer.ts` + `bim/columns/column-hatch-patterns.ts` — 2D render + hatch σκυροδέματος (mirror L/T).
5. `bim-3d/converters/BimToThreeConverter.ts` — 3D extrude (το composite polygon → extrude· U-shape → polygon → extrude).
6. BOQ feed (`column-boq-feed.ts` ή ό,τι αντίστοιχο) — εμβαδόν από polygon (shoelace) × ύψος.
7. `bim/validators/column-validator.ts` — Eurocode 8 thickness ≥150mm κ.λπ. (mirror).
8. `bim/columns/section-catalog.ts` / `column-section-profile.ts` — presets αν χρειάζονται.

⚠️ ADR-040 CHECK 6B/6D: αγγίζεις renderer/converter → stage ADR-363 (ή ADR-040) μαζί. Files ≤500γρ (N.7.1). i18n keys → locale el+en.

---

## 📂 ΦΑΣΗ 3 — «Τοιχίο από περίγραμμα» (Columns) → browser verify

1. **NEW** `bim/columns/column-from-faces.ts` (ή `bim/walls/`):
   - `perimeterFacesToColumns(entities, tol)` → reuse `perimeterFacesToRects`/`classifyPerimeter` + `extractClosedPolygons`.
   - Map `shape → ColumnKind`: rectangle→rectangular, L→L-shape, T→T-shape, U→U-shape, composite→composite. Ευθύ λεπτό ορθογώνιο → προαιρετικά `shear-wall` (Giorgio: «τοιχίο ευθύ = shear-wall»).
   - Κάθε περίμετρος → **ΕΝΑ** `ColumnEntity` (ΠΟΤΕ αποσύνθεση). Πάχος/διαστάσεις από τη γεωμετρία (bbox/parallel-face distance). Enterprise ID από `enterprise-id.service` (column generator).
2. **NEW** `AddColumnsFromFacesCommand` (ΕΝΑ undo για ΟΛΑ τα τοιχία της επιλογής) — mirror του column placement command (`hooks/drawing/column-completion.ts`).
3. Tool mode: νέο `'column-from-perimeter'` (ToolType + tool-definitions + box-select gates — mirror ΑΚΡΙΒΩΣ τα 4 gates που έβαλε το Φ1 για `'wall-from-perimeter'`: `useCentralizedMouseHandlers`, `mouse-handler-move`, `mouse-handler-up`, `useCanvasClickHandler` + `dxf-canvas-renderer` grips + `ribbon-contextual-config`). Reuse `bim:wall-region-box-select` EventBus (ή νέο `bim:column-region-box-select` αν θες καθαρότητα).
4. Ribbon entry «Τοιχίο από περίγραμμα» στο `home-tab-draw.ts` (flat variant, commandKey `'column-from-perimeter'`) + i18n el+en.
5. Toast `bim:columns-from-perimeter { built, ignored }` + `useDxfViewerNotifications` (mirror `bim:walls-from-perimeter`).
6. Tests: Γ→ένα L-shape, Π→ένα U-shape, σταυρός→composite, μικτή→ignored+toast.

---

## 📌 N.15 (trackers) σε ΚΑΘΕ φάση
ADR-363 §6/§5.6 + §12 changelog + `adr-index.md` + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr363_from_perimeter_walls.md`.

## ⚠️ Παγίδες
- **Pending uncommitted ΞΕΧΩΡΙΣΤΑ (ΜΗΝ πειράξεις):** 2 gizmo fixes (units 1000× vanish + tilted rotate) + το ΔΙΚΟ μου Φ0+Φ1. `git add <specific>` + verify `git diff --cached`.
- Repo **jest-only**. Commit/push = Giorgio.
- 🔴 Πριν ξεκινήσεις: ζήτα από Giorgio να **browser-verify το Φ1** (Γ/Π τοίχος από περίγραμμα) — αν υπάρχει bug εκεί, ίσως επηρεάζει το κοινό SSoT.
