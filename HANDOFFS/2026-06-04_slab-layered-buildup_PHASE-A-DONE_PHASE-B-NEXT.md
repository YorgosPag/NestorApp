# HANDOFF — Πλάκες με ΣΤΡΩΣΕΙΣ (composite Slab Types) + Live 3D Preview · ΦΑΣΗ Α DONE → ΦΑΣΗ Β NEXT

**Ημερομηνία:** 2026-06-04
**Μοντέλο:** Opus (cross-cutting — N.14)
**Γλώσσα:** Ελληνικά πάντα.
**Commit/Push:** ΜΟΝΟ ο Giorgio (N.(-1)). **Working tree = SHARED με άλλον agent** → stage ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `git add -A`, ΜΗΝ αγγίξεις `adr-index.md`.
**Στόχος Giorgio (αυτολεξεί):** «ΟΠΩΣ ΤΟ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ ΟΠΩΣ Η REVIT. ΥΛΟΠΟΙΗΣΗ ΜΕ ΣΥΣΤΗΜΑ FULL ENTERPRISE + FULL SSOT.»

---

## 0. ΑΜΕΣΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ → **ΦΑΣΗ Β: 3D per-layer slab rendering + materials**
Η **Φάση Α (domain foundation) είναι ΟΛΟΚΛΗΡΩΜΕΝΗ & VERIFIED** (βλ. §2). Συνέχισε με τη **Φάση Β** (§4). ΜΗΝ ξανασχεδιάσεις — το **plan είναι ΕΓΚΕΚΡΙΜΕΝΟ** (§3). Συνέχισε σειριακά σε Plan-Mode φάσεις, commit ανάμεσα από Giorgio.

---

## 1. ΤΟ FEATURE (τι ζήτησε ο Giorgio)
Για τις **ΠΛΑΚΕΣ** ό,τι έγινε για τους τοίχους (ADR-412 family-types + ADR-414 live preview):
**floating panel — δεξιά ρυθμίσεις στρώσεων (build-up), αριστερά ζωντανή 3D προεπισκόπηση**, σε επίπεδο Revit/ArchiCAD
(composite **Floor/Slab Types**: Function/Material/Thickness + Core Boundary· "type always wins"· edit-type → re-flow σε όλα τα instances).
Default στρώσεις **ανά kind** (floor/ceiling/roof/ground/foundation). **MEP (ενδοδαπέδια/ύδρευση/αποχέτευση) = ΕΚΤΟΣ scope** (ξεχωριστά δίκτυα ADR-408· η πλάκα τα φιλοξενεί/διαπερνά).

---

## 2. ΦΑΣΗ Α — DONE & VERIFIED (2026-06-04 Opus) — pending Giorgio commit
**Αρχιτεκτονική απόφαση-ΚΛΕΙΔΙ (Revit-correct, ΜΗΝ την αλλάξεις):** το composite build-up ζει στον **TYPE**, ΟΧΙ στο instance default.
Το instance μένει **200mm / single-layer / untyped** → **κανένα από τα ~30 υπάρχοντα slab tests δεν σπάει**. Το composite έρχεται μέσω family-type + reresolution στη **Φάση Γ**.

**Νέα αρχεία (stage ΜΟΝΟ αυτά + τα modified):**
- `src/subapps/dxf-viewer/bim/types/layered-buildup.ts` — **entity-agnostic SSoT** για composite cross-sections: `LayeredBuildupLayer<Z>`, `LayeredBuildup<Z>`, `BuildupThicknessSource`, `computeBuildupTotalThickness`, `buildupBoundaryFractions`. **Κοινό τοίχου+πλάκας.**
- `src/subapps/dxf-viewer/bim/types/slab-dna-types.ts` — `SlabLayerZone='top'|'core'|'bottom'`, `SlabDna`, `SlabDnaLayer`, **`getDefaultSlabBuildupForKind(kind)`** (per-kind defaults, βλ. §6), `computeSlabTotalThickness`, `isMultiLayerSlab`.
- `src/subapps/dxf-viewer/bim/types/__tests__/layered-buildup.test.ts` (12 tests)
- `src/subapps/dxf-viewer/bim/types/__tests__/slab-dna-types.test.ts` (18 tests)

**Modified (δικά μου):**
- `bim/types/slab-types.ts` — `+ dna?: SlabDna` στο `SlabParams` (optional, non-breaking· thickness=totalThickness όταν υπάρχει· type-only import → circular-safe).
- `bim/types/slab.schemas.ts` — `SlabLayerZoneSchema`, `SlabDnaLayerSchema`, `SlabDnaSchema`, `dna` στο `SlabParamsBaseSchema`, + superRefine `thickness===dna.totalThickness` (tol 1e-3).
- `hooks/drawing/slab-completion.ts` — `SlabParamOverrides.dna?` + `buildDefaultSlabParams` derive thickness από dna (αν δεν δοθεί dna → **ίδια συμπεριφορά**).
- `bim-3d/converters/wall-layer-geometry.ts` — `layerBoundaryFractions` τώρα delegate στον generic `buildupBoundaryFractions` (**boy-scout SSOT**· μηδέν αλλαγή API/συμπεριφοράς· wall regression PASS).

**Verification:** `npx tsc --noEmit` → **exit 0, μηδέν σφάλματα στα αρχεία μου**. **30/30 tests PASS** (+ wall-layer-geometry regression PASS).

---

## 3. ΕΓΚΕΚΡΙΜΕΝΟ PLAN (full roadmap — 4 φάσεις, SSOT principle)
**SSOT generalization principle:** ΟΧΙ copy-paste τοίχου→πλάκας. Γενίκευσε τους κοινούς πυρήνες, fork μόνο τα λεπτά category wrappers:
1. **Data model** → `layered-buildup.ts` (DONE Φάση Α).
2. **Layer editor** (Φάση Δ) → NEW entity-agnostic `LayeredBuildupEditor` + `BuildupLayerRow`· `WallDnaEditor`/`SlabDnaEditor` = thin consumers (zone vs side).
3. **Family-types registries** (Φάση Γ) → ήδη generic (`resolveEffectiveParams`/store/service/audit-route/enterprise-id `bimftype`)· πρόσθεσε **slab arm** στα discriminated σημεία· fork μόνο controller/commands/ui-helpers/side-effects (κοινό core όπου >80% διπλό).

Plan file (αν υπάρχει): `C:\Users\user\.claude\plans\bright-roaming-eagle.md`.

---

## 4. ΦΑΣΗ Β — 3D PER-LAYER RENDERING (η επόμενη δουλειά σου, ~6-7 αρχεία)
**Στόχος:** η πλάκα με `dna` γίνεται στοίβα sub-solids ανά στρώση (top→bottom στον άξονα Y), units-safe. **2D plan view ΔΕΝ αλλάζει** (στρώσεις μόνο σε 3D + section).

1. **NEW `bim-3d/converters/slab-multilayer-solid-3d.ts`** — πρότυπο `wall-multilayer-solid-3d.ts`, ΑΛΛΑ split **ΚΑΘΕΤΑ**: ίδιο plan `THREE.Shape` ανά layer, accumulating Y offset (`layerTopY = slabTopY − Σ_prev thickness`), slope per layer, `getMaterial3D(layer.materialId)`, `userData.layerId`, returns `THREE.Group`. **Reuse:** `buildupBoundaryFractions` (layered-buildup), `extrudeAndRotate`+`buildShape` (`bim-three-shape-helpers.ts`), `ensureWorldUvs` (`bim-uv-helpers.ts`), `applySlabSlope` (`mesh-slope-shear.ts`), `pushHoles` (για slab-openings — όλα τα layers ίδιο footprint).
2. **`bim-3d/converters/BimToThreeConverter.ts:463 slabToMesh()`** — guard `isMultiLayerSlab(slab.params.dna)` → delegate στο νέο builder· αλλιώς **legacy single-extrude (μένει ως έχει)**. Return type widen `THREE.Mesh | THREE.Group | null`. Πρόσεξε: position.y, slope shear, `tagMesh`/`matId` userData, `attachEdgesProjection`.
3. **`bim-3d/scene/BimSceneLayer.ts:370 syncSlabs`** — `const result = slabToMesh(...); if (result) this.group.add(result)` (Group ή Mesh)· propagate `bimId`/`buildingId` στο group userData (όχι μόνο mesh).
4. **`bim-3d/materials/MaterialCatalog3D.ts`** — `+ mat-screed, mat-insulation, mat-membrane, mat-gravel, mat-finish` στο `MAT_DEFS` (PBR fallbacks). **ΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ ΗΔΗ στα §6 build-ups** — χωρίς αυτά → `getMaterial3D` fallback σε `mat-concrete` (σιωπηλό grey).
5. **`bim/materials/bim-texture-registry.ts`** — map νέων keys → υπάρχοντα slugs (screed→plaster, insulation→plaster, membrane→plaster/stone, gravel→stone, finish→tile) μέχρι dedicated textures.
6. **`bim-3d/systems/section/section-hatch-cap.ts`** — `MAT_PREFIX_TO_HATCH` entries για per-layer section hatch (αλλιώς grey fallback). `mat-concrete`→'rc' υπάρχει· πρόσθεσε για τα νέα.
7. **Tests:** multilayer slab mesh (layer count / Y-stack order / per-layer material) + slope per-layer.

⚠️ **ADR-040 STAGING:** Ο Explore agent βρήκε ότι `BimSceneLayer`/`BimToThreeConverter` **ΔΕΝ** είναι CHECK 6B/6D files (είναι ADR-366 scene layer, όχι 2D micro-leaf). **ΟΜΩΣ** προηγούμενα MEP/furniture features στάγιαραν ADR-040 για `BimSceneLayer`. **Αν το pre-commit CHECK 6B/6D μπλοκάρει → STAGE `ADR-040` (read + changelog entry).** Έλεγξέ το όταν φτιάξει ο Giorgio το commit.

---

## 5. ΦΑΣΕΙΣ Γ + Δ + Ε (μετά τη Β — περίληψη· λεπτομέρειες στο handoff/plan)
- **Φάση Γ — Family-types μηχανή (~14 αρχεία):** `SlabTypeParams` + `BimTypeParamsByCategory.slab` (`bim-family-type.ts:173`) + schema 3ο arm (`bim-family-type.schemas.ts:194`) + `getBuiltInSlabTypes` (ένας built-in ανά kind, dna=§6) + `resolveEffectiveSlabParams` + NEW `slab-type-auto-assign.ts` (`resolveAutoSlabTypeId`, wire σε `slab-completion buildSlabEntity` + `bim/slabs/slab-firestore-service docToEntity`) + service `schemaByCategory` (`bim-family-type-service.ts:109`) + ui-helpers (`asSlabFamilyType`/`listSlabTypes`/`SLAB_OVERRIDABLE_KEYS`) + side-effects BOQ re-feed (reuse `slab-boq-feed.ts`) + NEW `edit-slab-type-store.ts` + audit (`bim-family-type-audit-client.ts` + `config/audit-tracked-fields.ts:943`) + NEW commands `AssignSlabTypeCommand`/`UpdateSlabFamilyTypeCommand`/`DeleteSlabFamilyTypeCommand` + **`useSlabTypeReresolution`** (mirror `hooks/data/useWallTypeReresolution.ts` — αυτό φέρνει το type.dna ΜΕΣΑ στο instance → ενεργοποιεί τη Φάση Β rendering). **Persistence round-trip:** βεβαιώσου ότι `useSlabPersistence`/`slab.factory`/`slab-firestore-service` διατηρούν το `dna` (αν parse μέσω schema → ΟΚ ήδη).
- **Φάση Δ — Preview + Dialog + Ribbon + i18n (~14 αρχεία):** NEW `slab-type-preview-geometry.ts` (`buildSlabTypePreviewBands`, reuse `buildupBoundaryFractions`) + NEW `bim-3d/preview/SlabTypePreviewRenderer.ts` (fork `WallTypePreviewRenderer`· standalone THREE· **ΕΚΤΟΣ ADR-040**· stub=wide+thin πλάκα) + NEW `SlabTypePreviewPanel.tsx` (fork) + NEW entity-agnostic `LayeredBuildupEditor`+`BuildupLayerRow` (wall+slab thin consumers· zone top|core|bottom) + NEW `EditSlabTypeDialog.tsx` (fork `EditWallTypeDialog`· SSOT `FloatingPanel`· draft structuredClone· built-in guard + Duplicate-to-edit· follow-selection· Save-keeps-open) + NEW `useSlabFamilyTypeController.ts` (`isSlabEntity`) + mount `<EditSlabTypeDialog/>` στο `app/SlabPersistenceHost.tsx` + ribbon widgets (`RibbonSlabFamilyTypeWidget`/`RibbonSlabTypePropertiesWidget` στο `contextual-slab-tab.ts`+`useRibbonSlabBridge.ts`) + **i18n el+en ΠΡΩΤΑ στα locales** (N.11· `slabFamilyType.*`, `layeredBuildup.zone.*`).
- **Φάση Ε — Docs/tracking:** NEW ADR (έλεγξε επόμενο free στο `adrs/` — likely **ADR-416**· **ΜΗΝ αγγίξεις adr-index.md**) + cross-link ADR-412/414 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory (`project_adrXXX_slab_layered_buildup.md` + MEMORY.md γραμμή). N.15.

---

## 6. PER-KIND DEFAULT BUILD-UPS (ΗΔΗ ΥΛΟΠΟΙΗΜΕΝΑ στο `slab-dna-types.ts` — SSoT, μην τα ξαναγράψεις)
Σειρά top→bottom· zones top/core/bottom· materialId (τα νέα mat-* μπαίνουν Φάση Β):
- **floor (285mm):** tile 10 [top,mat-tile] · screed 60 [top,mat-screed] · acoustic 20 [top,mat-insulation] · **RC core 180 [core,mat-concrete]** · soffit 15 [bottom,mat-plaster]
- **roof (434mm):** gravel 50 [top,mat-gravel] · membrane 5 [top,mat-membrane] · XPS 80 [top,mat-insulation] · vapour 4 [top,mat-membrane] · screed 80 [top,mat-screed] · **RC core 200 [core,mat-concrete]** · soffit 15 [bottom,mat-plaster]
- **ground (405mm):** tile 10 [top,mat-tile] · screed 60 [top,mat-screed] · XPS 80 [top,mat-insulation] · **RC core 200 [core,mat-concrete]** · waterproof 5 [bottom,mat-membrane] · blinding 50 [bottom,mat-concrete]
- **foundation (500mm):** **RC core 400 [core,mat-concrete]** · blinding 100 [bottom,mat-concrete]
- **ceiling (142.5mm):** acoustic 30 [top,mat-insulation] · plenum 100 [core,mat-insulation] · gypsum 12.5 [bottom,mat-plaster]

---

## 7. ΚΑΝΟΝΕΣ (απαράβατοι)
- **N.(-1):** commit/push ΜΟΝΟ Giorgio. ΠΟΤΕ `--no-verify`.
- **N.14:** Opus. **N.15:** ενημέρωσε ΕΚΚΡΕΜΟΤΗΤΕΣ+ADR+memory στο ίδιο commit (Φάση Ε).
- **SHARED tree:** stage ΜΟΝΟ δικά σου· ΠΟΤΕ `git add -A`· ΜΗΝ αγγίξεις adr-index/MEP/furniture/cursor αρχεία.
- **ADR-040:** preview ΕΚΤΟΣ high-freq path· per-layer 3D ίσως απαιτήσει staging (§4 ⚠️).
- **Test framework = jest** (ΟΧΙ vitest — globals, χωρίς import).
- **Slab path:** `src/subapps/dxf-viewer/`. Git: `"C:\Program Files\Git\cmd\git.exe"`.

---

## 8. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (recognition done — code wins)
- Φάση Α (DONE): §2.
- Φάση Β: `bim-3d/converters/{slab-multilayer-solid-3d(NEW),BimToThreeConverter:463,wall-multilayer-solid-3d,bim-three-shape-helpers,bim-uv-helpers,mesh-slope-shear}`, `bim-3d/scene/BimSceneLayer:370`, `bim-3d/materials/MaterialCatalog3D`, `bim/materials/bim-texture-registry`, `bim-3d/systems/section/section-hatch-cap`.
- Wall templates (Φάσεις Γ/Δ): `bim/family-types/*`, `core/commands/entity-commands/{Assign,Update,Delete}WallFamilyTypeCommand`, `hooks/data/useWallTypeReresolution`, `ui/ribbon/components/{EditWallTypeDialog,WallTypePreviewPanel}`, `bim-3d/preview/WallTypePreviewRenderer`, `bim-3d/converters/wall-type-preview-geometry`, `ui/wall-advanced-panel/sections/WallDnaEditor`, `app/{WallPersistenceHost,SlabPersistenceHost}`.
- Memory: `project_adr412_bim_family_types.md`, `project_adr414_wall_type_live_preview.md`.
