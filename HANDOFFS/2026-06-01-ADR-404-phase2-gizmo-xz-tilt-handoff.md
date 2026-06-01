# HANDOFF — ADR-404 Phase 2: Gizmo X/Z rings → tilt εντολές (ο χρήστης γέρνει με το gizmo)

**Ημερομηνία:** 2026-06-01
**Συντάκτης:** Opus 4.8 (Plan Mode, Developer A SOLO) — μετά το Phase 1 (data model + 3Δ converters)
**ADR:** ADR-404 — 3D BIM Element Tilt (Slope-Based, All Axes)
**Plan file:** `C:\Users\user\.claude\plans\sprightly-moseying-mccarthy.md` (APPROVED)
**Μοντέλο:** Opus 4.8 (gizmo math + εντολές + live preview = 5+ αρχεία, architecture)
**Commit:** **Ο Giorgio κάνει το commit — ΠΟΤΕ ο agent** (N.(-1)).

---

## 0. ΠΡΩΤΟ ΒΗΜΑ
1. **`git status` / `git log`** — δες τι έχει κάνει commit ο Giorgio. Το working tree έχει δουλειά πολλών ADR (401/402/403/404/396). **ΜΗΝ τα αγγίξεις, ΠΟΤΕ `git add -A`, ΠΟΤΕ commit/push.**
2. **Διάβασε ADR-404** (`docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md`) — ειδικά «Phase 1 DONE» + «Phase 2 PENDING».
3. **Διάβασε memory:** `project_adr404_3d_bim_tilt.md` (+ `project_adr402_genarc_gizmo_port.md` για το gizmo).
4. **Phase 1 RECOGNITION** πριν κώδικα (βλ. §3) — ΚΥΡΙΩΣ: επιβεβαίωσε ότι μπορείς να **reuse `Update{Column,Wall,Beam,Slab}ParamsCommand`** για το patch της κλίσης (όπως κάνει ήδη το resize), αντί για νέες εντολές.

---

## 1. ΤΙ ΕΓΙΝΕ ΣΤΟ PHASE 1 (η βάση — μη το σπάσεις)
Η κλίση **αποθηκεύεται + φαίνεται στο 3Δ**, αλλά μόνο προγραμματιστικά (δεν υπάρχει χειριστήριο):
- **Νέα πεδία:** `ColumnTilt {direction, angle}` + `tilt?` σε `ColumnParams`· `WallTilt {angle}` (signed) + `tilt?` σε `WallParams` (+ Zod schemas, optional → absent/angle=0 = κατακόρυφο).
- **Νέα SSoT:** `bim/geometry/column-tilt.ts` (`isColumnTilted`, `columnTiltShearAt(params, heightAboveBase)→{dx,dy}`) + `bim/geometry/wall-tilt.ts` (`isWallTilted`, `wallTiltShearAt`). **Unit-safe** (`tan` αδιάστατο), αδέλφια `beam-slope.ts`/`slab-slope.ts`.
- **3Δ converter:** `BimToThreeConverter.ts` → κοινό `applyHorizontalTiltShear` + `applyColumnTilt`/`applyWallTilt` (shear X/Z βάσει `pos.getY`=ύψος· coords μετά ROT_X_NEG_90: `worldX+=dx`, `worldZ+=−dy`). Στο **flat solid path** των `columnToMesh`/`wallToMesh`. Beam/slab ήδη shear-άρουν.
- **Tests:** `column-tilt.test.ts` (10) + `wall-tilt.test.ts` (9) = 19/19 PASS, tsc 0.
- **Limitation:** flat path μόνο (attached-to-host + τοίχος με ανοίγματα δεν γέρνουν — follow-up).

**ΟΡΙΟ:** το rotate-Y / move / resize / live-preview / vertical-move πρέπει να μείνουν **ακριβώς** όπως είναι.

---

## 2. Ο ΣΤΟΧΟΣ ΤΟΥ PHASE 2
Επιλέγεις BIM στοιχείο στο 3Δ → εμφανίζονται **X/Z rotate rings** (ανά τύπο) → τα σέρνεις → το στοιχείο **γέρνει ζωντανά** → release → **persist (Update*ParamsCommand)** + **ΕΝΑ undo** · **snap** 5/15/30/45° + Shift=free.

### Αποφάσεις ΗΔΗ κλειδωμένες (ΜΗ ξαναρωτήσεις):
- Στοιχεία: **κολώνα + δοκάρι + τοίχος + πλάκα** (ΟΧΙ σκάλα).
- **Slope-based** ανά τύπο (ΟΧΙ quaternion). Τοίχος = lean ⟂ run (1 DOF). Tilt = shear.
- 2Δ projection = **Phase 3** (όχι τώρα — η κάτοψη μένει flat στο Phase 2).
- Snap **5/15/30/45° + Shift=free**.

---

## 3. PHASE 1 RECOGNITION (κάν' το ΠΡΙΝ κώδικα)
Το gizmo plumbing είναι **σχεδόν έτοιμο** (έρευνα Phase 1):
- **`gizmo-types.ts`** (γρ.39-44): `GizmoDragConstraint.rotate` **ΗΔΗ έχει `axis: GizmoAxis`**. `parseHandleId`/`handleToConstraint` ΗΔΗ περνούν `axis`. **Μηδέν αλλαγή τύπων.**
- **`gizmo-geometry.ts`** (γρ.273-317): `rotate-x`/`rotate-y`/`rotate-z` rings **ΗΔΗ χτισμένα** ως visuals+hitboxes (`makeRotateRing` × 3). Απλά κρυφά.
- **`gizmo-projection.ts`** (γρ.57-71): υπάρχει `projectOntoPlane(point, planeNormal, …)` — το primitive για γενίκευση.

**ΚΡΙΣΙΜΟ recognition:** ψάξε `buildResizeCommand` στο `bim3d-edit-interaction-handlers.ts` — το resize **ήδη dispatch-άρει `Update{Column,Wall,Beam,Slab}ParamsCommand`** ανά τύπο. **Κάνε ΤΟ ΙΔΙΟ για tilt** (patch `tilt`/`topElevationEnd`/`slope`) → **ΚΑΜΙΑ νέα εντολή** (το plan έλεγε `SetColumnTiltCommand` — προτίμησε reuse αν το Update*ParamsCommand δέχεται partial patch· επιβεβαίωσέ το).

---

## 4. ΥΛΟΠΟΙΗΣΗ — βήμα-βήμα

### 4.1 Drag bridge `bim-3d/gizmo/bim-gizmo-drag-bridge.ts`
- **Γενίκευσε** το rotate σε άξονα: `ROTATE_AXIS_Y` (γρ.51) → axis vector από `constraint.axis` (`x`→(1,0,0), `y`→(0,1,0), `z`→(0,0,1)). `projectRotateVector` (γρ.237-249) + `updateRotate` (γρ.225-232) δέχονται axisDir· signed = `atan2(axisDir·cross, dot)`.
- **Νέο outcome** `{kind:'tilt'; axis:'x'|'z'; angleDeg; pivotDxf}` (το rotate-y μένει `kind:'rotate'`). Στο `getOutcome` (γρ.174): αν `constraint.kind==='rotate' && axis!=='y'` → `tilt` outcome· axis==='y' → `rotate` (όπως τώρα).
- **Angle snap:** μετά το raw angle για x/z, `AngleUtils.snapAngleToStep(deg, step, tol)` (`systems/constraints/constraints-geometry.ts` γρ.32-42)· step 15° (+5/30/45 candidates ή πέρασε COMMON_ANGLES από `systems/constraints/config.ts` γρ.416)· **Shift→free** (πέρασε `shiftHeld` flag από τον handler στο `start`/`update`). NB: το snap **ΜΟΝΟ** για tilt (x/z), όχι rotate-y/move/resize.

### 4.2 Μετατροπή gizmo→per-type tilt patch (Η ΚΑΡΔΙΑ)
Στο `bim3d-edit-interaction-handlers.ts` `buildEditCommand`, νέο `case 'tilt'`:
- **Κολώνα:** X-ring → lean σε plan-Y (direction 90/270), Z-ring → plan-X (direction 0/180). Πρόσημο angle → ποια από τις δύο. Πιο απλό: `direction = (axis==='z' ? 0 : 90)`, `angle = |angleDeg|`, και το πρόσημο μπαίνει στο direction (+180 αν αρνητικό). → `UpdateColumnParamsCommand({ tilt: {direction, angle} })`. ⚠️ Απόφαση: **set-per-plane** (κάθε ring αντικαθιστά την κλίση στο δικό του επίπεδο) ή **accumulate** (σύνθεση με υπάρχον tilt σε tan-space). Ξεκίνα με **set-per-plane** (απλό, καλύπτει «γέρνω μια κολώνα 15°»)· accumulate = follow-up αν το ζητήσει ο Giorgio.
- **Τοίχος:** μόνο το ring ⟂ run → `UpdateWallParamsCommand({ tilt: { angle: signedAngleDeg } })` (πρόσημο = πλευρά).
- **Δοκάρι:** το ring ⟂ axis → υπολόγισε `topElevationEnd = topElevation + axisLengthMm·tan(angle)` → `UpdateBeamParamsCommand({ topElevationEnd })`.
- **Πλάκα:** `UpdateSlabParamsCommand({ geometryType:'tilted', slope:{ direction, angle } })` (το `SlabSlope.angle` είναι **%** — μετέτρεψε `tan(deg)·100`).
- `EditCommand` union (γρ.67-76): πρόσθεσε ό,τι λείπει. `resolveEntityLevelId` (γρ.295) ίδιο. Multi-select tilt = εκτός scope (single μόνο, mirror resize).

### 4.3 Overlay `bim-3d/gizmo/bim-gizmo-overlay.ts`
- Νέο `TILT_HANDLES_BY_TYPE` (δίπλα στο `RESIZE_HANDLES_BY_TYPE`, γρ.55): `column:['rotate-x','rotate-z']`, `slab:['rotate-x','rotate-z']`, `wall:[<μόνο το ⟂ run>]`, `beam:[<μόνο το ⟂ axis>]`. Πρόσθεσέ τα στο `activeHandlesFor` (γρ.68). NB: για wall/beam το «ποιο ring» εξαρτάται από τον προσανατολισμό — ίσως απλούστερο να δείχνεις **και τα δύο** x/z και να αγνοείς το roll στο bridge (roll = ring κατά μήκος του άξονα → no-op). Επιβεβαίωσε visually.

### 4.4 Live preview — **per-frame rebuild** (ΟΧΙ rigid rotate)
Το tilt = shear, **όχι** rigid rotation (η κορυφή μένει στο Z) → rigid `applyRotate` θα ήταν λάθος. Reuse το **resize-rebuild** μονοπάτι:
- `bim3d-preview-rebuild.ts` ήδη ξαναχτίζει τη ΜΙΑ οντότητα μέσω converters. Πρόσθεσε tilt path: στο live drag, set **temp** `tilt`/`topElevationEnd`/`slope` στα params + rebuild (οι converters Phase 1 `applyColumnTilt`/`applyWallTilt` + οι υπάρχοντες beam/slab ήδη το ζωγραφίζουν). Commit→resync (μηδέν πήδημα)· Esc/no-op→reset.
- `bim-gizmo-controller.ts` `getLivePreview` (γρ.114-126) + `GizmoLivePreview` (γρ.33-35): πρόσθεσε `kind:'tilt'` variant (axis + angleRad) → ο handler κάνει rebuild αντί `applyRotate`.

---

## 5. REFERENCE (θέσεις-κλειδιά)
- Drag bridge rotate: `bim-gizmo-drag-bridge.ts` γρ.51 (`ROTATE_AXIS_Y`), 174 (`getOutcome`), 225-249 (`updateRotate`/`projectRotateVector`).
- Constraint types: `gizmo-types.ts` γρ.39-65 (rotate ΗΔΗ έχει axis).
- Rings geometry: `gizmo-geometry.ts` γρ.273-317.
- Projection primitive: `gizmo-projection.ts` γρ.57-71 (`projectOntoPlane`).
- Overlay handles: `bim-gizmo-overlay.ts` γρ.38 (`BASE_HANDLES`), 55 (`RESIZE_HANDLES_BY_TYPE`), 68 (`activeHandlesFor`).
- Dispatch + resize precedent: `bim3d-edit-interaction-handlers.ts` (`buildEditCommand` ~309, `buildResizeCommand` ~ resize branch, `EditCommand` ~67-76, `resolveEntityLevelId` ~295).
- Live preview: `bim3d-edit-live-preview.ts` (`applyRotate` ~93), `bim3d-preview-rebuild.ts` (resize rebuild via converters), `bim-gizmo-controller.ts` (`getLivePreview` ~114).
- Angle snap (reuse): `systems/constraints/constraints-geometry.ts` `AngleUtils.snapAngleToStep` (γρ.32-42), `systems/constraints/config.ts` `COMMON_ANGLES` (γρ.416).
- Tilt SSoT (Phase 1): `bim/geometry/column-tilt.ts`, `wall-tilt.ts`.

---

## 6. ΠΑΓΙΔΕΣ
- **Roll = no-op:** το ring κατά μήκος του άξονα (κολώνα: rotate-y είναι ήδη plan· τοίχος/δοκάρι: το ring παράλληλο στον άξονα) δεν έχει νόημα → μη γράψεις τίποτα.
- **SlabSlope.angle = ποσοστό (%)**, όχι μοίρες → `tan(deg)·100`. Τα column/wall tilt.angle = **μοίρες**. Μην τα μπερδέψεις.
- **Units:** το tilt είναι αδιάστατο (γωνία)· κανένα mm/scene factor στη γωνία. Το beam `topElevationEnd` είναι **mm**· το `axisLengthMm` πρέπει να είναι mm (πρόσεξε σχέδια μέτρων — δες `mmToEntityUnitFactor`/`inferSceneUnitsFromWidth` precedents).
- **DXF↔world:** world z = −DXF y. Μια X-tilt στο world ΔΕΝ είναι προφανώς X στο DXF — χαρτογράφησε προσεκτικά (βλ. shear convention Phase 1).
- **Flat path limitation** παραμένει: τοίχος με ανοίγματα / attached δεν θα δείχνει tilt live ούτε στο commit (Phase 1 follow-up). Πες το στον Giorgio αν το δοκιμάσει.
- **ADR-040 CHECK 6B/6D:** αγγίζεις gizmo/converter/handler → **stage ADR-404**. manager ≤500.
- **ΜΗΝ** διαβάσεις full bg `.output` (φουσκώνει).

---

## 7. DEFINITION OF DONE
- [ ] Phase 1 Recognition (reuse Update*ParamsCommand επιβεβαιωμένο)
- [ ] Drag bridge: axis-generalized rotate + `tilt` outcome + angle snap (5/15/30/45 + Shift=free)
- [ ] Overlay: `TILT_HANDLES_BY_TYPE` (X/Z rings ορατά ανά τύπο)
- [ ] Dispatch: `case 'tilt'` → per-type `Update*ParamsCommand` (column/wall `tilt`, beam `topElevationEnd`, slab `slope`)
- [ ] Live preview: per-frame rebuild (temp param + converters), commit/reset lifecycle
- [ ] `npx jest src/subapps/dxf-viewer/bim-3d` PASS + `npx tsc --noEmit` 0 (φιλτράρισε στα αρχεία σου)
- [ ] ADR-404 changelog «Phase 2» + trackers N.15 (ΕΚΚΡΕΜΟΤΗΤΕΣ + adr-index status + memory `project_adr404_3d_bim_tilt`)
- [ ] 🔴 Browser verify Giorgio: επιλογή→X/Z ring→drag→γέρνει live→release μένει→undo· snap 15°· Shift=free· κάτοψη ακόμα flat (Phase 3)
- [ ] **Ο Giorgio κάνει το commit — ΟΧΙ εσύ**

---

## 8. ΜΕΤΑ ΤΟ PHASE 2 → Phase 3 (2Δ cut-plane projection)
Κοινό `cut-plane-tilt.ts` (`tiltPlanShift`) → `compute{Column,Wall,Beam,Slab}Geometry` + section parity (`toSlabPlan`/`toWallPlan`). BOQ αμετάβλητο. (Βλ. plan file §Phase 3.)
