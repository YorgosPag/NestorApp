# HANDOFF — BIM Characteristic-Point Snap (corner + midpoint + center) → ΕΝΑ SSoT για ΟΛΕΣ τις BIM οντότητες (Revit-grade, FULL ENTERPRISE + FULL SSOT)

**Date:** 2026-06-11 · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα) · **Model:** Opus

> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree). N.17: **ΕΝΑ tsc τη φορά** — έλεγξε διεργασίες πρώτα (`Get-CimInstance Win32_Process … *tsc*` μέσω `powershell.exe -Command`). **Απάντα στον Giorgio ΕΛΛΗΝΙΚΑ.**
>
> 🎯 **Στόχος (Giorgio, ρητό):** «όπως οι μεγάλοι παίχτες, όπως η **Revit** — FULL ENTERPRISE + FULL SSOT. Χρησιμοποίησε **τον ΙΔΙΟ κώδικα του τοίχου** παντού, **ΟΧΙ διπλότυπο**.»

---

## 0. ΤΙ ΖΗΤΑΕΙ Ο GIORGIO (ρητά)

Σήμερα: όταν ο κέρσορας πλησιάζει **τοίχο**, στις **γωνίες** εμφανίζονται σήματα «**L**» + δίπλα κείμενο «**Γωνία τοίχου**» (snap point). Το ίδιο υπάρχει και στα **δοκάρια**.

Θέλει:
1. **Corner snap (L + label) σε ΟΛΕΣ τις BIM οντότητες** — όχι μόνο στις 5 που το έχουν σήμερα.
2. **+ ΜΕΣΟ (midpoint)** της οντότητας (π.χ. «μέσο τοίχου») με **αντίστοιχο σήμα + label** + snap point εκεί (όταν OSNAP on).
3. **+ ΚΕΝΤΡΟ (center)** με **αντίστοιχο σήμα κέντρου + label**, να λειτουργεί **όπως τώρα λειτουργούν τα σήματα στις γωνίες**.
4. **Σε κάποιες οντότητες ΜΗΝ εμφανίζεται το κείμενο** (label) γιατί έχουν «περίεργα σχήματα» — το snap point μπορεί να υπάρχει, αλλά χωρίς confusing text.
5. **FULL SSOT — ΙΔΙΟΣ κώδικας παντού, ΜΗΔΕΝ διπλότυπο.**

---

## 1. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ — ΤΟ ΠΡΟΒΛΗΜΑ ΕΙΝΑΙ ΗΔΗ ΔΙΠΛΟΤΥΠΟ (5 σχεδόν-πανομοιότυπα engines)

### 1.1 Τα 5 corner snap engines (ADR-370) = 97% structural duplicates
Καθένα κληρονομεί `BaseSnapEngine` και έχει ΤΟ ΙΔΙΟ 4-μερές template· διαφέρουν ΜΟΝΟ σε (α) `ExtendedSnapType`, (β) spatial-index slot string, (γ) `description`, (δ) τη συνάρτηση `extract*Corners` που καλεί το per-entity `get*CornerWorldPoints`:

| Engine | File | Type | description | Πηγή γωνιών (SSoT) |
|---|---|---|---|---|
| Wall | `snapping/engines/WallCornerSnapEngine.ts` | `BIM_WALL_CORNER` | `'bim-wall-corner'` | `bim/walls/wall-corner-anchors.ts getWallCornerWorldPoints` (4 face corners) |
| Beam | `snapping/engines/BeamCornerSnapEngine.ts` | `BIM_BEAM_CORNER` | `'bim-beam-corner'` | `bim/beams/beam-corner-anchors.ts getBeamCornerWorldPoints` (4) |
| Slab | `snapping/engines/SlabCornerSnapEngine.ts` | `BIM_SLAB_CORNER` | `'bim-slab-corner'` | `bim/slabs/slab-corner-anchors.ts getSlabCornerWorldPoints` (N polygon vertices) |
| Column | `snapping/engines/ColumnCornerSnapEngine.ts` | `BIM_COLUMN_CORNER` | `'bim-column-corner'` | `bim/columns/column-corner-anchors.ts getColumnCornerWorldPoints` (4 από 9-anchor) |
| Opening | `snapping/engines/OpeningCornerSnapEngine.ts` | `BIM_OPENING_CORNER` | `'bim-opening-corner'` | `bim/walls/opening-corner-anchors.ts getOpeningCornerWorldPoints` (4) |

Δες `WallCornerSnapEngine.ts:30-82` ως πρότυπο. Κοινά helpers στο `snapping/shared/BaseSnapEngine.ts` (`initializeSpatialIndex` :142, `normalizeSnapResults` :219, `createCandidate` :56). **ΔΕΝ υπάρχει shared BIM-corner base** — πέντε φορές γραμμένο το ίδιο.

### 1.2 Το «L» glyph + το label «Γωνία τοίχου»
- **L glyph:** `canvas-v2/overlays/SnapIndicatorOverlay.tsx:217-235` — ένα `case 'bim_wall_corner' | 'bim_beam_corner' | 'bim_slab_corner' | 'bim_column_corner' | 'bim_opening_corner':` → `<polyline>` L-bracket. **⊕ center** = `case 'bim_column_center':` (`:201-215`). Default fallback = X (`:309`).
- **Label SSoT:** `snapping/snap-description-keys.ts` → `BIM_SNAP_DESCRIPTION_KEY` (description → i18n key) + `resolveSnapLabelKey(type, description)`. «Γωνία τοίχου» = key `snapModes.labels.bim.wallCorner` σε `src/i18n/locales/{el,en}/dxf-viewer-shell.json`. Το overlay δείχνει label ΜΟΝΟ αν `BIM_DESCRIPTION_KEY[description]` υπάρχει (`SnapIndicatorOverlay.tsx:332-333`) → **κενό/άγνωστο description = glyph χωρίς κείμενο** (αυτό λύνει το #4 «περίεργα σχήματα»: emit χωρίς label).
- **Priorities:** `config/tolerance-config.ts SNAP_ENGINE_PRIORITIES` (`BIM_*_CORNER: -2`, `BIM_COLUMN_CENTER: -1`). **Tolerances/enabledTypes/priority array:** `snapping/extended-types.ts` (enum :21, `DEFAULT_PRO_SNAP_SETTINGS` :120). **Registry:** `snapping/orchestrator/SnapEngineRegistry.ts:75 initializeEngines`. **Toggle UI list:** `snapping/context/SnapContext.tsx ALL_MODES` + `ui/components/ProSnapToolbar.tsx SNAP_MODE_KEYS` (complete `Record<ExtendedSnapType,string>` — **πρόσεξε**, νέο enum value ΧΩΡΙΣ entry εδώ = tsc error· κρυφό αν φιλτράρεις tsc output).

### 1.3 ΤΙ ΛΕΙΠΕΙ (midpoint + center για BIM)
- **BIM midpoints:** υπάρχει SSoT `bim/utils/bim-entity-points.ts getBimEntityEdgeMidpoints2D` (wall axis, beam axis, slab/opening edges) ΑΛΛΑ τροφοδοτεί τον **generic** `MidpointSnapEngine` (type `MIDPOINT`, τρίγωνο glyph, **χωρίς BIM label**). ΔΕΝ υπάρχει `BIM_MIDPOINT` type/glyph/label.
- **BIM center:** ΜΟΝΟ ο `ColumnCenterSnapEngine` (`BIM_COLUMN_CENTER`, ⊕). ΔΕΝ υπάρχει generic BIM center για wall/beam/slab/foundation/fixtures.
- **Per-entity capability flag:** ΔΕΝ υπάρχει registry «αυτή η οντότητα υποστηρίζει corner/mid/center». Η γνώση είναι implicit στο τι emit-άρει κάθε `get*Grips`.

---

## 2. ΟΛΕΣ ΟΙ BIM ΟΝΤΟΤΗΤΕΣ + ΠΗΓΗ ΧΑΡΑΚΤΗΡΙΣΤΙΚΩΝ ΣΗΜΕΙΩΝ (reuse, ΟΧΙ νέα γεωμετρία)

Canonical list: `types/entities.ts` `Entity` union (:597) + `isBimEntity` (:874) + type guards (:780-870). Πίνακας (✅=καθαρό ορθογ. footprint, label OK· ⚠️=περίεργο σχήμα → snap χωρίς label):

| Entity | Corners (reuse) | Midpoints (reuse) | Center | Label; |
|---|---|---|---|---|
| `wall` straight | `getWallCornerWorldPoints` | `getBimEntityEdgeMidpoints2D` | axis-mid | ✅ |
| `wall` curved/polyline | start/end μόνο | — | — | ⚠️ (όχι label, ίσως μόνο endpoints) |
| `opening` | `getOpeningCornerWorldPoints` | `getBimEntityEdgeMidpoints2D` | centroid | ✅ |
| `slab` / `slab-opening` | polygon vertices (`getSlabCornerWorldPoints` / `getBimEntityKeyPoints2D`) | `getBimEntityEdgeMidpoints2D` | polygon centroid | ✅ corners/mid· ⚠️ center αν concave |
| `column` rect/shear-wall | `getColumnCornerWorldPoints` (4 από 9-anchor) | width/depth edge-mids | `getColumnAnchorWorldPoints` find `'center'` | ✅ |
| `column` L/T/I/U/polygon/circular | bbox ή polygon-backed vertices | — | center anchor | ⚠️ (περίεργο σχήμα → snap χωρίς label) |
| `beam` straight | `getBeamCornerWorldPoints` | `getBimEntityEdgeMidpoints2D` | axis-mid | ✅ |
| `beam` curved | 4 face-end | — | — | ⚠️ |
| `foundation` pad | `centred-anchor-frame` corner handles | width/length edge-mids | `centredCentroidWorld` | ✅ |
| `foundation` strip/tie-beam | `getAxisBoxGrips` corners | axis-box edge-mids | axis-mid | ✅ |
| `mep-fixture`/`electrical-panel`/`mep-manifold`/`mep-radiator`/`mep-boiler`/`mep-water-heater`/`furniture`/`floorplan-symbol` (centred-box) | `getCentredBoxGrips` filter role `corner-*` → `rectCornerWorld` | centred-box edge-mids (`rect-frame rectEdgeWorld`) | `params.position` | ✅ rect· ⚠️ circular fixture (no corners)· floorplan-symbol/furniture ίσως ⚠️ label |
| `roof` / `floor-finish` / `mep-underfloor` | polygon vertices (`getBimEntityKeyPoints2D`) | `getBimEntityEdgeMidpoints2D`/footprint edge-mids | centroid | ✅ corners/mid |
| `stair` straight | 4 corners (stair-grips) | — | — | ⚠️ |
| `stair` L/U/Γ/curved/spiral | flight-based / irregular | — | — | ⚠️ (snap χωρίς label ή skip) |
| `mep-segment` | endpoints (όχι corners) | axis midpoint | riser center | ⚠️ (γραμμικό — ίσως μόνο midpoint/center) |
| `railing` / `thermal-space` / `space-separator` / `mep-fitting` | **καμία grip σήμερα** | — | — | skip v1 (δες §6 DEFER) |

**Λεπτομερής χάρτης πηγών (file:line) στο body των explorers — δες §7.** Κλειδί: ΟΛΑ τα `get*CornerWorldPoints`, `getBimEntityEdgeMidpoints2D`, `getColumnAnchorWorldPoints`, `getCentredBoxGrips`+`rectCornerWorld`/`rectEdgeWorld`, `centredCentroidWorld`, `columnFootprintDims` **ΥΠΑΡΧΟΥΝ ΗΔΗ** και είναι pure/tested → **reuse, ΜΗΝ ξαναγράψεις γεωμετρία**.

---

## 3. ΤΟ ΖΗΤΟΥΜΕΝΟ — ΕΝΑ SSoT (FULL ENTERPRISE)

### 3.1 NEW SSoT dispatcher — `bim/utils/bim-characteristic-points.ts` (ΝΕΟ, pure)
ΜΙΑ συνάρτηση που για ΚΑΘΕ BIM entity επιστρέφει τα χαρακτηριστικά σημεία, **delegating στις υπάρχουσες per-entity SSoT συναρτήσεις** (μηδέν νέα γεωμετρία):
```ts
export type BimCharCategory = 'corner' | 'midpoint' | 'center';
export interface BimCharPoint { point: Point2D; category: BimCharCategory; }
export interface BimCharPoints {
  corners: Point2D[];
  midpoints: Point2D[];
  center: Point2D | null;
  /** null = «περίεργο σχήμα» → emit snap ΧΩΡΙΣ label. Αλλιώς το description root, π.χ. 'wall'. */
  labelRoot: string | null;
}
export function getBimCharacteristicPoints(entity: Entity): BimCharPoints
```
Dispatch ανά `entity.type` (type-guards) → καλεί τα υπάρχοντα helpers. Για centred-box entities: thin wrapper πάνω στο `getCentredBoxGrips` (filter `role.startsWith('corner-')` → `rectCornerWorld`). Για polygon entities: `params.outline/footprint.vertices`. `labelRoot=null` για ⚠️ entities (§2).

### 3.2 NEW generic engine — `snapping/engines/BimCharacteristicSnapEngine.ts` (ΕΝΑ class, αντικαθιστά τα 5)
ΜΙΑ παραμετρική κλάση (category: corner|midpoint|center) που:
- στο `initialize`: χτίζει spatial index από `getBimCharacteristicPoints(e)[category]` ΟΛΩΝ των BIM entities (reuse `initializeSpatialIndex`).
- στο `findSnapCandidates`: query + `createCandidate(point, description, …)` όπου `description = labelRoot ? \`bim-${labelRoot}-${categorySuffix}\` : ''` (κενό description → glyph χωρίς label, λύνει #4).
- 3 instances στο registry: corner / midpoint / center.

### 3.3 Snap types — collapse σε 3 generic (FULL SSoT)
**Πρόταση (Revit-grade):** αντικατέστησε τους 5 per-entity corner types με **`BIM_CORNER`** + νέα **`BIM_MIDPOINT`** + **`BIM_CENTER`** (3 generic). Το label differentiation («Γωνία τοίχου» vs «Γωνία δοκαριού») έρχεται από το **`description`** (per-entity root), ΟΧΙ από τον type. Glyph: L=`bim_corner`, νέο midpoint glyph=`bim_midpoint`, ⊕=`bim_center` (reuse column ⊕). Migration touch-points (ΟΛΑ): enum + priorities + `DEFAULT_PRO_SNAP_SETTINGS` (enabledTypes/priority/perModePxTolerance) + `SnapEngineRegistry` (5→3 instances) + `SnapIndicatorOverlay` glyph cases (collapse 5→1 `bim_corner` + 2 νέα) + `BIM_SNAP_DESCRIPTION_KEY` (νέα `bim-*-corner/-mid/-center` keys ή composition) + `SnapContext.ALL_MODES` + `ProSnapToolbar.SNAP_MODE_KEYS` (complete Record!) + baseline tests (`snap-description-keys.test.ts`, corner-engine tests).
> **Εναλλακτική (λιγότερο disruptive, αν ο χρόνος/ρίσκο το επιβάλλει):** κράτα τους per-entity corner types, αλλά αντικατέστησε τις 5 duplicate ENGINE CLASSES με 1 generic class instantiated 5× (+ νέα BIM_MIDPOINT/BIM_CENTER). Λιγότερο SSoT στους types, αλλά μηδέν class duplicate. **Ο Giorgio θέλει «ΙΔΙΟ κώδικα, όχι διπλότυπο» → η collapse των types είναι το σωστό end-state· αν το κόψεις, εξήγησέ του γιατί.**

### 3.4 Labels (i18n)
Νέα keys κάτω από `snapModes.labels.bim.*` σε **el + en** (`dxf-viewer-shell.json`): π.χ. `wallMid`/`wallCenter`, `beamMid`/`beamCenter`, … ή **composition helper** (root noun «τοίχου/δοκαριού» + κατηγορία «Γωνία/Μέσο/Κέντρο») για αποφυγή key explosion (13×3). N.11: ΟΛΑ μέσω `t()`, ΜΗΔΕΝ hardcoded ελληνικό string σε .ts. Ενημέρωσε baseline αν χρειαστεί (CHECK 3.8).

### 3.5 Νέα glyphs (SnapIndicatorOverlay)
- `bim_corner`: το υπάρχον L (reuse).
- `bim_midpoint`: ΝΕΟ — διακριτό από το generic τρίγωνο (π.χ. «⊢» ή half-square / open-triangle), ώστε ο χρήστης να βλέπει «μέσο BIM».
- `bim_center`: reuse το ⊕ (column center) ως κοινό center glyph.
Μεγέθη/SSoT geometry: `SNAP_ICON_GEOMETRY` (ADR-137). ΜΗΝ αλλάξεις άλλα glyphs.

---

## 4. PHASED ΥΛΟΠΟΙΗΣΗ (rendering+snap critical — κάθε φάση jest + browser)
1. **Φ1 — SSoT dispatcher + tests:** `bim-characteristic-points.ts` (corners/midpoints/center/labelRoot ανά entity, reuse helpers) + unit tests (ανά entity type· labelRoot null για ⚠️). Μηδέν call-site αλλαγή.
2. **Φ2 — Generic engine + corner parity:** `BimCharacteristicSnapEngine` + αντικατάσταση των 5 corner engines (ίδια συμπεριφορά «Γωνία X»). Jest + **browser-verify**: τοίχος/δοκάρι/πλάκα/κολώνα/άνοιγμα γωνίες ίδιες με πριν.
3. **Φ3 — Midpoint + Center:** νέα `BIM_MIDPOINT`/`BIM_CENTER` types + glyphs + labels + 2 engine instances. Browser-verify: «Μέσο/Κέντρο τοίχου» + έλξη.
4. **Φ4 — Expand σε όλες τις BIM:** foundation, 8 centred-box, roof/floor-finish/mep-underfloor, stair/mep-segment (⚠️ χωρίς label όπου χρειάζεται). Browser-verify ανά κατηγορία.
5. Κάθε phase = δικό του commit (Giorgio).

---

## 5. VERIFICATION
- **Jest:** `npx jest src/subapps/dxf-viewer/snapping src/subapps/dxf-viewer/bim/utils --silent` (+ νέα tests). Γνωστό **pre-existing fail**: `hooks/grips/grip-commit-alt-bypass.test.ts` (`sceneManager.getEntity` mock gap) — **ΟΧΙ δικό σου**.
- **tsc:** N.17 (έλεγξε διεργασίες ΠΡΩΤΑ· background· **ΜΗΝ φιλτράρεις μόνο τα δικά σου** — η `ProSnapToolbar.SNAP_MODE_KEYS` complete Record σπάει σιωπηλά· τρέξε `| grep "error TS"` σε ΟΛΟ το output, total πρέπει να μείνει στα **6 γνωστά pre-existing**: FloorplanGallery/ParkingHistoryTab(×2)/LayerCanvas).
- **Browser (Giorgio):** κέρσορας κοντά σε κάθε BIM entity → L «Γωνία X» στις γωνίες, νέο σήμα «Μέσο X» στα μέσα, ⊕ «Κέντρο X» στο κέντρο· με OSNAP on έλκουν· σε ⚠️ entities snap ΧΩΡΙΣ confusing label.

## 6. N.15 — ΕΝΗΜΕΡΩΣΕΙΣ ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ
- **ADR-370** (BIM face-corner snap) — επέκταση σε corner+midpoint+center SSoT generalization + changelog. (Δες αν υπάρχει ADR-370· αλλιώς νέα ADR ή κάτω από ADR-397/ADR-363 §snap.)
- **`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`** (1-2 γραμμές 🔴 verify+commit, FORMAT header), **memory** (νέο reference SSoT entry), **`.claude-rules/pending-ratchet-work.md`** (η 5→1 engine consolidation = large-duplicate· κλείσε όταν γίνει). **ΟΧΙ adr-index** (shared tree).
- **ADR-040:** ΟΧΙ renderer-coupled (snap engines + overlay) — αλλά `SnapIndicatorOverlay` είναι canvas overlay· stage ADR-040 ΜΟΝΟ αν το ζητήσει ο hook (CHECK 6B/6D).
- **DEFER:** railing/thermal-space/space-separator/mep-fitting (καμία grip σήμερα) → v2.

## 7. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (file:line)
- Duplicate engines: `snapping/engines/{Wall,Beam,Slab,Column,Opening}CornerSnapEngine.ts` (template = `WallCornerSnapEngine.ts:30-82`).
- Base: `snapping/shared/BaseSnapEngine.ts` (`createCandidate:56`, `initializeSpatialIndex:142`, `normalizeSnapResults:219`).
- Glyph: `canvas-v2/overlays/SnapIndicatorOverlay.tsx` (L `:217-235`, ⊕ `:201-215`, label `:331-333`, default `:309`).
- Label SSoT: `snapping/snap-description-keys.ts` (`BIM_SNAP_DESCRIPTION_KEY:16`, `resolveSnapLabelKey:36`).
- Types/settings: `snapping/extended-types.ts` (enum :21, `DEFAULT_PRO_SNAP_SETTINGS:120`). Priorities: `config/tolerance-config.ts SNAP_ENGINE_PRIORITIES:420`. Registry: `snapping/orchestrator/SnapEngineRegistry.ts:75`. Toggle: `snapping/context/SnapContext.tsx ALL_MODES:18` + `ui/components/ProSnapToolbar.tsx SNAP_MODE_KEYS:22` (complete Record!).
- Points SSoT (reuse): corners `bim/{walls/wall-corner-anchors,beams/beam-corner-anchors,slabs/slab-corner-anchors,columns/column-corner-anchors,walls/opening-corner-anchors}.ts`· midpoints `bim/utils/bim-entity-points.ts getBimEntityEdgeMidpoints2D:122` + `getBimEntityKeyPoints2D:43`· column anchors `bim/columns/column-anchors.ts`· centred-box `bim/grips/centred-box-grips.ts:197` + `bim/grips/rect-frame.ts rectCornerWorld:78`/`rectEdgeWorld`· centroid `bim/grips/centred-anchor-frame.ts centredCentroidWorld`· `bim/columns/column-footprint-dims.ts:95`.
- Entity list: `types/entities.ts` (`Entity:597`, `isBimEntity:874`, guards :780-870). Full grip dispatcher (reference, ΟΧΙ snap SSoT): `hooks/grip-computation.ts computeDxfEntityGrips:75`.

## 8. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ ξαναγράψεις γεωμετρία — reuse τα `get*CornerWorldPoints`/`getBimEntityEdgeMidpoints2D`/`getCentredBoxGrips`/`centredCentroidWorld`.
- ΜΗΝ αφήσεις 5 duplicate corner engines — **ΕΝΟΠΟΙΗΣΕ** σε 1 generic (αυτή είναι όλη η ουσία του αιτήματος).
- ΜΗΝ προσθέσεις νέο `ExtendedSnapType` χωρίς entry στο `ProSnapToolbar.SNAP_MODE_KEYS` (complete Record → tsc error, κρυφό σε φιλτραρισμένο tsc).
- ΜΗΝ δείξεις label σε ⚠️ entities (περίεργα σχήματα) — emit candidate με **κενό** description.
- ΜΗΝ commit/push. ΜΗΝ `git add -A`. Shared tree — ΜΟΝΟ τα δικά σου.

## 9. ΣΧΕΤΙΚΟ ΠΡΟΗΓΟΥΜΕΝΟ (ίδια συνεδρία, ΟΛΟΚΛΗΡΩΜΕΝΟ — pending verify/commit Giorgio)
ADR-397 rotation snap + σιελ λαβές + grip-temperature 3→1 SSoT. NEW `rendering/grips/grip-temperature.ts` (`resolveGripTemperature`, cold/warm/hot/**snappable**), `bim/grips/rotation-snap-store.ts`, `snapping/engines/RotationSnapEngine.ts`. **Pattern για reuse:** η rotation-snap υλοποίηση δείχνει πώς ένα νέο snap engine + store + glyph + ExtendedSnapType + registry + SnapContext + ProSnapToolbar SNAP_MODE_KEYS + i18n wiring γίνεται end-to-end — **ίδιο μοτίβο** εδώ. Δες `HANDOFFS/HANDOFF_2026-06-11_grip-temperature-SSoT-unification.md` + memory `reference_rotation_pivot_marker_ssot.md`.
