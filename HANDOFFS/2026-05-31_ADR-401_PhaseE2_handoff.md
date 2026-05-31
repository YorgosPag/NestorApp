# HANDOFF — ADR-401 Phase E2 (Κεκλιμένη στέγη host adapter) + επόμενα βήματα

**Ημερομηνία:** 2026-05-31
**Μοντέλο:** Opus 4.8
**Κατάσταση:** Phase E2 ΥΛΟΠΟΙΗΜΕΝΟ — **pending commit** + 🔴 browser verify
**Επόμενο:** 3 out-of-scope items (α/β/γ) — βλ. §4. Giorgio: «προχωράμε σταδιακά».

---

## 1. ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (Phase E2)

**Στόχος:** ο attached τοίχος (`topBinding='attached'`) να ακολουθεί την **κεκλιμένη** κάτω-παρειά μιας tilted στέγης/πλάκας (z0mm ≠ z1mm), αντί να μένει οριζόντιος.

**ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ (code = source of truth):** το `SlabSlope` (`direction`°/`angle`%/`pivotEdge`) ορίζεται σε `slab-types.ts` + `slab.schemas.ts` + `slab-completion.ts` αλλά **ΔΕΝ καταναλώνεται πουθενά** στη γεωμετρία — ούτε καν το ίδιο το `slabToMesh` (render-άρει επίπεδο box). Άρα το E2 **καθιέρωσε** την κανονική ερμηνεία της κλίσης.

### Αρχεία (5 — όλα δικά μου, pending commit)

| Αρχείο | Τύπος | Τι |
|--------|-------|-----|
| `bim/geometry/slab-slope.ts` | **NEW** | SSoT slope-plane: `slabUndersideZmmAt`/`slabTopZmmAt`/`slabSlopeOffsetZmm`. Single-plane tilt: `dir=(cos,sin)(direction°)` ανηφόρα, offset = `(pt−pivot)·dir × angle/100` (mm/mm), pivot = κέντρο AABB (default) ή μέσο ακμής N/S/E/W. underside(pt) = `level+heightOffset+slopeOffset(pt) − thickness`. Flat (non-tilted) → 0 fast-path. |
| `bim/geometry/wall-host-plan-builder.ts` | MOD | `HostFootprintInput` += optional `undersideZmmAt?: (pt)=>number`· `buildHostUndersidePlans` αποτιμά την παρειά στα **plan-points των άκρων (t0/t1) του covered span** → z0mm≠z1mm. Flat host = scalar (byte-for-byte back-compat). `slabHostInput`: tilted → attach `undersideZmmAt` + `hostType='roof'` όταν `kind='roof'`. |
| `bim/geometry/__tests__/slab-slope.test.ts` | **NEW** | 10 tests (flat, pivot center/N/S/E/W/W-edge, direction+Y, top/underside parallel). |
| `bim/geometry/__tests__/wall-host-plan-builder.test.ts` | MOD | +4 Phase-E2 integration (roof hostType, box no-slope, sloped plan z0≠z1, full chain `evaluateWallTopAt` 0≠1). |
| ADR-401 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + memory | MOD | Κανόνας N.15. |

**Αυτόματη διάχυση (μηδέν επιπλέον κώδικας):** το 3D wedge (B2 `buildSlopedWallPieceGeometry` ήδη έτοιμο), η 2D τομή και το BOQ ακολουθούν — όλα χτίζουν τους hosts μέσω του κοινού `buildWallHostInputs`/`slabHostInput`.

**Μονάδες:** το `pt` πρέπει να είναι mm (params space), όπως ο scalar adapter· όλα τα call sites (syncWalls / section-scene-sync / wall-boq-feed / addEnvelopeShell) είναι ήδη mm.

### Verification
- **31/31** (slab-slope 10 + builder 21) + **75/75** regression (wall-top-profile + stepped-solid + section-intersect-wall-profile + wall-geometry + envelope-wall-top) PASS.
- **tsc --noEmit = exit 0** (καθαρό).

---

## 2. PENDING COMMIT (ΔΕΝ ΕΓΙΝΕ COMMIT — περιμένει εντολή Giorgio, N.(-1))

Τα **δικά μου** αρχεία E2:
```
?? src/subapps/dxf-viewer/bim/geometry/slab-slope.ts
?? src/subapps/dxf-viewer/bim/geometry/__tests__/slab-slope.test.ts
 M src/subapps/dxf-viewer/bim/geometry/wall-host-plan-builder.ts
 M src/subapps/dxf-viewer/bim/geometry/__tests__/wall-host-plan-builder.test.ts
 M docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 M docs/centralized-systems/reference/adr-index.md
 M local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```
⚠️ **ΟΧΙ `git add -A`** — μόνο specific files (multi-agent stage race). Το `ΥΠΟΧΡΕΩΤΙΚΑ_ΒΗΜΑΤΑ.txt` (M) είναι **ΑΛΛΟΥ** — ΜΗΝ το κάνεις stage.

---

## 3. 🔴 BROWSER VERIFY (εκκρεμεί)

Φτιάξε **tilted roof slab** (πλάκα `kind='roof'`, `geometryType='tilted'`, `slope`) πάνω από attached τοίχο → ο τοίχος πρέπει να **κλίνει** στο 3D ακολουθώντας την παρειά.
⚠️ **Αναμενόμενο πρόβλημα:** η ίδια η πλάκα θα φαίνεται **επίπεδη** (item α παρακάτω) — ο τοίχος θα κλίνει σωστά αλλά δεν θα «αγγίζει» την επίπεδα-rendered πλάκα μέχρι να κλείσει το item α.

---

## 4. ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ — Giorgio: «προχωράμε σταδιακά» (σειρά προτεινόμενη)

### (α) Tilted slab 3D rendering — consume το `slab-slope.ts` SSoT  ⭐ ΠΡΟΤΕΡΑΙΟΤΗΤΑ
Το `slabToMesh` (`bim-3d/converters/BimToThreeConverter.ts:328`) render-άρει πάντα **επίπεδο box** (ExtrudeGeometry, `mesh.position.y = (slabTop − thickness)`), αγνοώντας το slope.
- **Στόχος:** όταν `geometryType==='tilted'`, η πλάκα να render-άρεται **κεκλιμένη** (top & bottom face = παράλληλα κεκλιμένα επίπεδα).
- **Reuse:** `slabTopZmmAt`/`slabUndersideZmmAt` από το `slab-slope.ts` (ήδη το SSoT). Πιθανό pattern: custom BufferGeometry με per-vertex z από `slabTopZmmAt(params, vertex)` (mirror `buildSlopedWallPieceGeometry` του B2).
- **Έλεγξε επίσης:** 2D section (`section-intersect.toSlabPlan:166` — flat bottomY), slab grips, BOQ volume (κεκλιμένη → ίδιος όγκος για σταθερό πάχος, οπότε μάλλον OK). ADR-369 §9 Q7 είναι το σχετικό ADR (όχι μόνο ADR-401).
- **Μετά:** το browser-verify του E2 θα δείχνει τοίχο+πλάκα να εφάπτονται σωστά.

### (β) Κεκλιμένο δοκάρι
Το `BeamParams` (`beam-types.ts`) έχει μόνο single `topElevation` (χωρίς slope/2ο elevation). Για κεκλιμένο δοκάρι χρειάζεται **νέο param** (π.χ. `topElevationEnd?` ή `slope`) + γεωμετρία. Μεγαλύτερη δουλειά — ξεχωριστό design.
- Όταν γίνει, ο `beamHostInput` παίρνει `undersideZmmAt` (ίδιο pattern με το E2 slabHostInput) → ο τοίχος ακολουθεί αυτόματα.

### (γ) Base-attach (δοκός θεμελίωσης)
Η **ΒΑΣΗ** του τοίχου κολλάει προς τα κάτω σε δοκό θεμελίωσης — το αντίστροφο του top-attach. `WallBaseBinding` + `attachBaseToIds` (mirror του `attachTopToIds`). Ο resolver έχει ήδη `resolveWallBaseZmm` — χρειάζεται «upper-envelope» για base.

---

## 5. ΑΡΧΙΤΕΚΤΟΝΙΚΑ ΣΗΜΕΙΑ-ΚΛΕΙΔΙΑ (για να μη χαθεί χρόνος)

- **Resolver SSoT:** `bim/geometry/wall-top-profile.ts` — `HostUndersidePlan{z0mm,z1mm}` υποστηρίζει ήδη sloped· `resolveWallTopProfile` = lower-envelope· `evaluateWallTopAt(profile,t)` = linear interp.
- **Host builder SSoT:** `bim/geometry/wall-host-plan-builder.ts` — `buildWallHostInputs(beams,slabs)` = ΕΝΑΣ τόπος σύνθεσης (4 consumers).
- **3D wedge:** `bim-3d/converters/wall-piece-geometry.ts` `buildSlopedWallPieceGeometry` (8-vertex, έτοιμο για reuse στο item α).
- **EventBus:** `systems/events/EventBus.ts`, API = `EventBus.emit(type,payload)` / `EventBus.on(...)`, interface `DrawingEventMap`. (⚠️ ΟΧΙ `core/events/...` — λάθος που έγινε σε προηγούμενο session μετά από PC freeze.)
- **i18n ns:** `dxf-viewer-shell.json` (ΟΧΙ `dxf-viewer-bim` — δεν υπάρχει).
- **Pre-commit:** CHECK 6B/6D μπλοκάρουν αλλαγές σε BimToThreeConverter/converters χωρίς staged ADR → στο item α κάνε stage και το ADR-369 (ή ADR-401).

## 6. ΣΧΕΤΙΚΑ MEMORY / DOCS
- `project_adr401_wall_top_constraints.md` (κύριο — πλήρες detail, E2 ενημερωμένο)
- ADR-401 §5 (φάσεις) + §8 changelog
- ADR-369 §9 Q7 (tilted slab — σχετικό για item α)
- `feedback_derived_geometry_central_cascade.md`, `feedback_multi_agent_stage_race.md`
