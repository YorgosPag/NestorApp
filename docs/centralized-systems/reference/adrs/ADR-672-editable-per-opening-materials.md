# ADR-672 — Επεξεργάσιμο υλικό ανά κούφωμα (Revit family surfaces: κάσα/φύλλο/υαλοστάσιο/χειρολαβή)

**Status:** ✅ ACTIVE — υλοποιημένο 2Δ+3Δ+export+UI+persistence+library-dropdown+hardware-3Δ+BOQ/schedule+2Δ handle glyph (όλα τα follow-ups §8 ΟΛΟΚΛΗΡΩΘΗΚΑΝ)
**Ημερομηνία:** 2026-07-18
**Σχετικά:** ADR-611 (opening frame profile — το resolver-idiom που αντιγράφτηκε),
ADR-412/421 (BIM family types — type→instance «type wins»), ADR-668 (3Δ export OBJ/glTF — ονομάζει το
`matId`), ADR-669 (mesh identity stamping — `matId` = νόμιμο raw augmentation, element boundary §6.1),
ADR-363/358 (wall/stair material catalog — το catalog-idiom), CLAUDE.md N.0.2 / N.11 / N.18

> **Σημείωση doc-trail:** τα commits της feature αναφέρουν «ADR-669» και ένα «ADR-449 opening material
> parity notes» — **και τα δύο λάθος** (ADR-669 = mesh identity stamping· ADR-449 = structural finish skin).
> Αυτό το ADR είναι το **σωστό, ενιαίο σπίτι** της feature. Τα δύο άλλα ADRs κρατούν μόνο ό,τι τους αφορά.

---

## 1. Το πρόβλημα

> «Θέλω ο χρήστης να επιλέγει το υλικό **ανά κούφωμα** — αυτή η πόρτα δρυς, εκείνη αλουμίνιο — όπως
> Revit / ArchiCAD, αντί για το σημερινό σταθερό ξύλο/γυαλί.» — Giorgio, 2026-07-18

Πριν: **κάθε** πόρτα έβγαινε ξύλο και **κάθε** παράθυρο γυαλί, hardcoded (`OPENING_FRAME_MATERIAL_ID='mat-wood'`,
`OPENING_GLASS_MATERIAL_ID='mat-glass'` στο `bim-three-wall-opening-attach.ts`). Το πεδίο `OpeningParams.material`
υπήρχε αλλά ήταν **νεκρό** — δεν διαβαζόταν πουθενά στο 3Δ/2Δ build.

## 2. SSoT Audit (2026-07-18 — grep, όχι υπόθεση)

| Ερώτημα | Εύρημα | Απόφαση |
|---|---|---|
| Υπάρχει πεδίο υλικού; | `OpeningParams.material?` + `OpeningTypeParams.material?` (νεκρά, single) | **Επέκταση** → per-part `materials`, legacy single κρατιέται ως base layer |
| Υπάρχει resolver-idiom; | `resolveOpeningFrameProfile` (fold: default→type→instance→overrides, LAST wins) | **Αντιγραφή** → `resolveOpeningMaterial`, ίδιο σχήμα |
| Υπάρχει «υλικό ανά υπο-μέρος»; | ΣΚΑΛΕΣ: `StairMaterials {tread,riser,stringer,landing}` | **Καθρέφτης** → `OpeningMaterials {frame,leaf,glass,hardware}` |
| Λύνεται οποιοδήποτε id σε υλικό; | `getMaterial3D(id)` (catalog `mat-*` + user `bmat_*`) | Επαναχρήση αυτούσιο |
| Υπάρχει 2Δ material→χρώμα SSoT; | `getMaterialFlatColorHex(id)` (`material-catalog-defs.ts`) — precedent finishes | Επαναχρήση (ΟΧΙ το wall hatch system) |
| Υπάρχει material picker UI; | `MaterialSwatch`· catalog-per-domain (`wall/stair-material-catalog.ts`) | Επαναχρήση swatch + **νέο** `opening-material-catalog` (mirror) |

## 3. Το μοντέλο των μεγάλων

- **Revit:** door/window family = υλικό ανά sub-category (Panel/Frame/Glass/Hardware), στον **Τύπο**, με **instance override**.
- **ArchiCAD:** door/window objects με **surfaces** ανά μέρος (frame/leaf/glass).
- **Κοινό:** υλικό **ανά μέρος**, στον **Τύπο**, override ανά instance. Ταιριάζει 1-1 με `StairMaterials` + το type→instance idiom.

## 4. Η απόφαση (Giorgio)

- **Granularity: πλήρες Revit sub-category (Γ)** — `OpeningMaterials { frame?, leaf?, glass?, hardware? }`.
- **2Δ parity: ΝΑΙ** — ενιαίο υλικό 2Δ + 3Δ + export (+ μελλοντικά BOQ), όπως Revit.

## 5. Αρχιτεκτονική — ένα SSoT id ανά μέρος οδηγεί όλο το pipeline

```
UI (EditOpeningTypeDialog + OpeningMaterialSelectCell)
   └─ γράφει OpeningTypeParams.materials.<part>   (catalog: opening-material-catalog.ts)
          │  (type→instance: resolveEffectiveOpeningParams spread «type wins»)
          ▼
   OpeningParams.materials  ──►  resolveOpeningMaterial(params, typeParams?)
                                    → ResolvedOpeningMaterials { frame,leaf,glass,hardware }  (πάντα populated)
                                    │
              ┌─────────────────────┼─────────────────────────┐
              ▼                     ▼                         ▼
     3Δ: getMaterial3D(id)   2Δ: getMaterialFlatColorHex   export: matId (ADR-668)
     per sub-mesh +          → elementOverride.color        (stampOpeningMaterialIds, ADR-669)
     stampOpeningMaterialIds   fallback (OpeningRenderer)
```

**Resolution order (LAST wins, ανά μέρος)** στο `resolveOpeningMaterial`:
1. Part default — frame/leaf=`mat-wood`, glass=`mat-glass`, hardware=`mat-metal`.
2. `typeParams.material` (LEGACY single) → frame + leaf.
3. `typeParams.materials.<part>` — ο Τύπος.
4. `params.material` (LEGACY single) → frame + leaf.
5. `params.materials.<part>` — instance override.

## 6. Zero regression

Κούφωμα **χωρίς** επιλεγμένο υλικό → resolver επιστρέφει τα part defaults → **ίδιο** ξύλο/γυαλί με πριν
(3Δ + export). Το legacy single `material` εφαρμόζεται μόνο στις στερεές παρειές (frame+leaf)· το γυαλί
μένει `mat-glass` εκτός αν οριστεί ρητά `materials.glass`. Στο 2Δ, ο χρωματισμός συνθέτει `elementOverride`
**μόνο** όταν υπάρχει ρητό material — legacy κουφώματα περνούν `styleOverride` αυτούσιο (byte-identical).

## 7. Το 2Δ bug που βρέθηκε & διορθώθηκε (§ live production)

Η πρώτη υλοποίηση 2Δ parity (`OpeningRenderer.ts`) έθετε `ctx.strokeStyle = _frameColor` **πριν** το
`resolveSubcategoryStyle()`, το οποίο μετά το **πατούσε** με τον subcategory default (`DEFAULT_OBJECT_STYLES`
βάζει non-null χρώμα σε κάθε opening subcategory) → **το material χρώμα δεν εμφανιζόταν ποτέ**· η parity ήταν
ουσιαστικά νεκρή. **Fix:** το material χρώμα δρομολογείται ως `elementOverride.color` **fallback** (το
top-priority `elem` hook του resolver, ADR-375 C.5) → κερδίζει τον subcategory default, ενώ ένα ρητό
`opening.styleOverride.color` του χρήστη κερδίζει ακόμα το material. Το test ενισχύθηκε ώστε να ελέγχει το
χρώμα τη στιγμή του `stroke()` (το παλιό loose `toContain` περνούσε ΚΑΙ με το bug). 15/15 ✅.

## 8. Follow-ups

- ✅ **`bmat_*` user-library dropdown (DONE 2026-07-18):** το `OpeningMaterialCatalogProvider` seam έλαβε
  πραγματική υλοποίηση — `createOpeningMaterialCatalog(library)` που λιστάρει τα `companyId`/`projectId`-scoped
  `bmat_*` υλικά δίπλα στα presets, σε `<optgroup>` (Βασικά / Βιβλιοθήκη) + custom sentinel. Νέο hook
  `useOpeningMaterialCatalog` δένει το scope-SSoT (`useAuth` + `saveContext?.projectId`, idiom σκάλας/topography)
  με το `useMaterialLibrary`. Το picker κερδίζει swatch με το πραγματικό thumbnail/albedo του υλικού. Ένα id
  εκτός presets ΚΑΙ εκτός τρέχουσας βιβλιοθήκης (legacy/cross-company) πέφτει ακόμα στο free-text (zero
  regression). `classifyOpeningMaterial` έγινε catalog-aware (`listed|custom|empty`). Βλ. §10.
- ✅ **Hardware 3Δ geometry (DONE 2026-07-18):** νέος `opening-hardware-builders.ts` (sibling του
  `opening-mesh-builders.ts`) δίνει σχηματική γεωμετρία χειρολαβής ανά family — μοχλός+ροζέτα σε ανοιγόμενες
  πόρτες (και στις 2 όψεις, latch πλευρά από `params.handing`), κάθετη μπάρα σε συρόμενες, πόμολο σε
  φυσαρμόνικες, μικρή χειρολαβή σε ανοιγόμενα παράθυρα· **καμία** σε fixed/bay/overhead/revolving (χωρίς
  χειριζόμενη λαβή). Το `hardware` προστέθηκε στο `OpeningMeshMaterials`, γίνεται resolve+stamp `matId` στο
  attach, και οι λαβές μπαίνουν LAST στο specs array (frame/leaf indices αμετάβλητα). Inner-dims guard
  ενοποιήθηκε σε `openingInnerDims()` (N.18, κοινό leaf+hardware). Βλ. §10.
- ✅ **BOQ / schedule hookup (DONE 2026-07-18):** το per-part υλικό τροφοδοτεί πλέον το opening schedule.
  Τα `mapDoor`/`mapWindow` (`schedule-presets.ts`) καλούν `resolveOpeningMaterial(p)` (ίδιο idiom με το 3Δ
  attach — χωρίς typeParams) και βγάζουν per-part labels μέσω του υπάρχοντος `lookups.material` (πιάνει
  `mat-*` ΚΑΙ `bmat_*`). **Revit-grade curated στήλες ανά preset** (όχι μία σύνθετη): **πόρτα** → Υλικό
  κάσας / φύλλου / χειρολαβής· **παράθυρο** → Υλικό κάσας / υαλοπίνακα / χειρολαβής — καθρέφτης των Revit
  family sub-category material params (η πόρτα δεν δείχνει «γυαλί» σε συμπαγές φύλλο, το παράθυρο δεν δείχνει
  «φύλλο»). Η single legacy `col.material` στήλη door/window αντικαταστάθηκε (μηδέν απώλεια: το legacy single
  υλικό πέφτει σε frame+leaf μέσω resolver). Data-driven → οι exporters (csv/xlsx/pdf) παίρνουν τις στήλες
  αυτόματα. Zero regression: legacy κούφωμα → part defaults (frame/leaf=ξύλο, hardware=μέταλλο). Boy Scout:
  ο κοινός door+window preamble (+ frame/hardware/wall cells) ενοποιήθηκε σε `mapOpeningCommonCells` (N.18).
  Βλ. §10.
- ✅ **2Δ handle glyph (DONE 2026-07-18):** διακριτικό σύμβολο χειρολαβής σε κάτοψη στο `drawSwing`
  (`opening-overlay-drawing.ts`) — μικρό tick κάθετο στο φύλλο, στο latch (ελεύθερο) άκρο. **Latch side =
  εγγενές της γεωμετρίας** (leaf tip = ελεύθερο άκρο· το hingeArc είναι ήδη handing-aware) → συνεπές με το
  3Δ hardware (`latchSign`) ΧΩΡΙΣ re-derive του handing. Μόνο swing (door/double/french)· διπλή πόρτα → δύο
  λαβές. Additive + zero-regression: sliding/folding/overhead/revolving/glazing/bay αμετάβλητα (Revit δείχνει
  λαβή μόνο σε swing φύλλα σε αυτή την κλίμακα). Βλ. §10.
- **2Δ = μόνο χρωματισμός** (frame stroke + glass overlay)· τα κουφώματα είναι plan symbols, όχι poché fills —
  γι' αυτό `getMaterialFlatColorHex`, ΟΧΙ το wall `resolveAutoHatch`/`MATERIAL_HATCH_MAP` (διαφορετικό vocabulary).

## 9. Αρχεία (SSoT map)

| Αρχείο | Ρόλος |
|---|---|
| `bim/types/opening-types.ts` | `OpeningMaterials` interface + `OpeningParams.materials` |
| `bim/types/bim-family-type.ts` | `OpeningTypeParams.materials` (type default) |
| `bim/types/opening.schemas.ts` | `OpeningMaterialsSchema` (`.strict()`) — pre-write gate |
| `bim/family-types/resolve-opening-material.ts` | **Resolver SSoT** — fold ανά μέρος + defaults |
| `bim/family-types/opening-material-catalog.ts` | **Catalog SSoT** — presets + `createOpeningMaterialCatalog` (library-backed provider) + `classifyOpeningMaterial` |
| `ui/ribbon/hooks/useOpeningMaterialCatalog.ts` | Scope (`useAuth`+`saveContext.projectId`) + `useMaterialLibrary` → library-backed provider (memoized) |
| `bim-3d/converters/bim-three-wall-opening-attach.ts` | 3Δ — per-opening resolved `getMaterial3D` (frame/leaf/glass/hardware) + stamp `matId` |
| `bim-3d/converters/opening-mesh-builders.ts` | 3Δ leaf/panel specs + `OpeningMeshMaterials` (`hardware`) + `LEAF_DEPTH_RATIO`/`openingInnerDims` SSoT |
| `bim-3d/converters/opening-hardware-builders.ts` | **Hardware SSoT** — `buildHardwareSpecs` (χειρολαβή box specs ανά family) |
| `bim/renderers/OpeningRenderer.ts` | 2Δ — resolved χρώμα ως `elementOverride.color` fallback |
| `bim/renderers/opening-overlay-drawing.ts` | 2Δ plan symbols — `drawHandleGlyph` (handle tick στο latch άκρο) στο `drawSwing` |
| `bim/schedule/schedule-presets.ts` | BOQ — `mapDoor`/`mapWindow` → `resolveOpeningMaterial` per-part labels· `mapOpeningCommonCells` SSoT |
| `bim/schedule/schedule-preset-columns.ts` | BOQ — curated per-part material στήλες (`DOOR_COLUMNS`/`WINDOW_COLUMNS`) |
| `i18n/locales/{el,en}/dxf-schedule.json` | `col.frameMaterial`/`leafMaterial`/`glassMaterial`/`hardwareMaterial` |
| `ui/ribbon/components/EditOpeningTypeDialog.tsx` + `OpeningMaterialSelectCell.tsx` | UI — 4 rows ανά μέρος |
| `bim/walls/opening-firestore-service.ts` + `opening-doc-hydration.ts` | Persistence — generic pass-through (spread) |

## 10. Changelog

- **2026-07-18** — Αρχική έκδοση. Feature υλοποιημένη πλήρως (resolver + zod schema + 3Δ wiring + 2Δ parity +
  per-part UI + persistence) — commits `401222e5` (resolver), `fd327ccf` (schema), `ffc588fd` (3Δ attach),
  `ea670cb5`+`892417ab` (2Δ parity + fix §7), `7f5e915b` (UI). **Boy Scout (N.0.2):** νέο κεντρικό
  `opening-material-catalog.ts` (mirror `wall/stair-material-catalog.ts`) — έκλεισε το SSoT gap του hardcoded
  preset list μέσα στο `OpeningMaterialSelectCell`· 5 tests. Gates: family-types **19 suites / 217 ✅**,
  2Δ renderer **15/15 ✅**, `jscpd:diff` καθαρό ✅. Doc-trail ενοποιήθηκε εδώ (ήταν λάθος σε ADR-669/449).
- **2026-07-18** — **Follow-up Β (§8) — `bmat_*` user-library dropdown.** Ο `OpeningMaterialCatalogProvider`
  seam έλαβε πραγματική υλοποίηση `createOpeningMaterialCatalog(library)` (presets → `bmat_*` βιβλιοθήκη →
  custom, σε `<optgroup>`)· νέο hook `useOpeningMaterialCatalog` (scope-SSoT `useAuth`+`saveContext.projectId`
  → `useMaterialLibrary` → provider, memoized)· `OpeningMaterialSelectCell` πήρε `catalog` prop + swatch με
  library thumbnail/albedo· `classifyOpeningMaterial` → catalog-aware `listed|custom|empty` (legacy/unknown id
  = free-text, zero regression)· 2 νέες i18n keys (`materialGroupPresets/Library`, el+en). Καμία αλλαγή σε
  resolver/persistence (τα `bmat_` ήδη round-trip-άρουν opaque). Gates: opening-material-catalog **10/10 ✅**,
  family-types+2Δ parity regression **21 suites / 233 ✅**, `jscpd:diff` καθαρό ✅.
- **2026-07-18** — **Follow-up Α (§8) — Hardware 3Δ geometry.** Νέος `opening-hardware-builders.ts`
  (`buildHardwareSpecs`) δίνει σχηματική γεωμετρία χειρολαβής ανά family (door lever+rose και στις 2 όψεις,
  latch από `handing`· sliding pull bar· bifold knob· operable-window handle· καμία σε fixed/bay/overhead/
  revolving). `hardware` προστέθηκε στο `OpeningMeshMaterials`· resolve+`getMaterial3D`+stamp `matId` στο
  attach· λαβές appended LAST (frame/leaf indices σταθερά). Inner-dims degenerate guard ενοποιήθηκε σε
  `openingInnerDims()` (N.18, κοινό leaf+hardware). 2Δ handle glyph εκτός scope. Gates: hardware-builders +
  opening-mesh **30/30 ✅**, converters regression **65 suites / 477 ✅**, `jscpd:diff` καθαρό ✅.
- **2026-07-18** — **Follow-up Γ (§8) — BOQ / schedule hookup.** Τα `mapDoor`/`mapWindow` (`schedule-presets.ts`)
  καλούν `resolveOpeningMaterial(p)` και βγάζουν per-part material labels (`lookups.material`, πιάνει `bmat_*`).
  Revit-grade **curated στήλες ανά preset**: πόρτα = κάσα/φύλλο/χειρολαβή, παράθυρο = κάσα/υαλοπίνακα/χειρολαβή
  (`schedule-preset-columns.ts` `DOOR_COLUMNS`/`WINDOW_COLUMNS`, αντικατέστησαν το single `col.material`)· 4 νέες
  i18n keys `col.{frame,leaf,glass,hardware}Material` (el+en). Data-driven exporters → αυτόματες στήλες. Zero
  regression: legacy single υλικό → frame+leaf, hardware→default (test-locked). **Boy Scout (N.18):** ο κοινός
  door+window preamble + τα κοινά frame/hardware/wall cells ενοποιήθηκαν σε `mapOpeningCommonCells` (`mats`
  passed-in → single resolve). Gates: `opening-material-schedule.test.ts` (νέο) + `schedule-builder` + full
  `bim/schedule/__tests__` **6 suites / 117 ✅**. `jscpd:diff`: το ουσιαστικό door/window material διπλότυπο
  εξαλείφθηκε· απομένουν intra-file preamble clones (6 προϋπάρχοντα σε mapWall/Slab/Column/Beam/Foundation/
  Combined — εκτός diff· + 1 door/window function-preamble idiom) → baseline-unaware check, commit-time SKIP
  απόφαση Giorgio.
- **2026-07-18** — **Follow-up 2Δ handle glyph (§8).** `drawHandleGlyph` στο `drawSwing`
  (`opening-overlay-drawing.ts`) — διακριτικό tick κάθετο στο φύλλο, στο latch (ελεύθερο) άκρο, geometry-driven
  (leaf tip = handing-aware μέσω hingeArc → συνεπές με 3Δ `latchSign` χωρίς re-derive). Διπλή πόρτα → 2 λαβές·
  μόνο swing· sliding/folding/overhead/revolving/glazing/bay αμετάβλητα. `HANDLE_LEAF_FRACTION`/`HANDLE_TICK_RATIO`
  constants. Gates: `opening-handle-glyph.test.ts` (νέο) **3/3 ✅** (tick στο latch άκρο, όχι στον μεντεσέ·
  glazing χωρίς λαβή), `OpeningRenderer` parity regression **6/6 ✅**, `jscpd:diff` καθαρό ✅.
