# ADR-676 — Παραμετρική Βιβλιοθήκη Εξαρτημάτων Κουφώματος (editable presets + custom-mesh, scoped libraries)

- **Status**: 🔵 DESIGN (Phase 2/3 — σχεδίαση· ΚΑΜΙΑ υλοποίηση σε αυτή τη φάση. Υλοποίηση = Phase 3, πιλότος = frame/casing library)
- **Category**: DXF Viewer — BIM / Parametric Building Modeling / Openings / Component Libraries
- **Related**: ADR-611 (Opening Frame Profile — catalog + resolver + `frameProfileId`· **η βάση του πιλότου, επεκτείνεται από editable → user-library**),
  ADR-672 (Editable per-opening materials — `OpeningMaterials`, per-part resolver-fold· το idiom του preset-id binding),
  ADR-674 (Opening hardware take-off — `OpeningHardwareOverrides`, catalog→type→instance fold, type→BOQ path),
  ADR-422 (Glazing U-value catalog — `glazingPanes`, `resolveOpeningUValue`· η βάση της glazing library),
  ADR-412 (Family-Type effective-param resolution — "type wins, overrides win last" merge idiom),
  ADR-652 (ScopedLibraryService M2 — `createSubcollectionScopedLibrary`, το generic scoped-library engine),
  ADR-358 (Stair Presets — `SavePresetInput`/scope preset pattern· το «save my model» πρότυπο),
  ADR-411 (BIM mesh library — glTF loading/caching ανά category+assetId· η βάση του Στρώματος 2 custom-mesh),
  ADR-330/363 (BIM Material library — `bmat_*`, `MaterialLibraryService`· το «αλλάζω υλικό»),
  ADR-376 (Opening BOQ signature grouping — consumer, ΟΧΙ μέσω `BimToBoqBridge`),
  ADR-409 (Third-party BIM library licensing — governs catalog/mesh provenance),
  N.6 (enterprise-id), N.11 (i18n SSoT), N.18 (jscpd anti-duplication)

> **Πηγή:** Research report `HANDOFFS/2026-07-18_opening-component-library-RESEARCH-REPORT.md` (6 read-only research agents, 2026-07-18). Οι αποφάσεις Giorgio (§6 report) είναι κλειδωμένες και ενσωματωμένες εδώ.

---

## 1. Context (το πρόβλημα)

Ο χρήστης θέλει να **επιλέγει, να επεξεργάζεται και να αποθηκεύει ως δικά του** τα εξαρτήματα ενός κουφώματος:
χειρολαβές, άξονες, κλειδαριές, πλακέτες, **μεντεσέδες**, **πλαίσια/κάσες** και **υαλοπίνακες** — αλλάζοντας
**σχήμα** + **υλικό**, αποθηκεύοντας παραλλαγές ως **δικά του μοντέλα** και φτιάχνοντας **βιβλιοθήκες** (scoped).
Δηλαδή: **παραμετρική βιβλιοθήκη εξαρτημάτων** με επιλογή / επεξεργασία / αποθήκευση / scoped libraries,
Revit / ArchiCAD-level.

Σήμερα κάθε εξάρτημα είναι **hardcoded**: ένα σχήμα ανά family (ADR-672 §8 3Δ hardware geometry), χωρίς δυνατότητα
επιλογής/αποθήκευσης. Το μόνο editable κατάλογο-concept που υπάρχει είναι τα **frame profiles** (ADR-611) — αλλά
κι αυτά είναι **static const array** χωρίς user-library / save / derive.

### 1.1 Πώς το λύνουν οι μεγάλοι παίκτες (convergence)

| Εργαλείο | Μηχανισμός | Αναλογία εδώ |
|---|---|---|
| **Revit** | *Loadable Families* (.rfa παραμετρικά) + *Types* (named παραλλαγές params). Door hardware = **nested families** μέσα στην πόρτα. **«Duplicate Type»** → αντιγράφεις έναν type, αλλάζεις params, σώζεις ως νέο. Built-in types = δεν αλλάζουν, δημιουργείς αντίγραφο. | Στρώμα 1 = παραμετρικό preset + named types. Nested families = per-component preset-ids στο opening. **«Duplicate Type» = το edit/derive-from-builtin** (§2.1). |
| **ArchiCAD** | *Library Parts* (GDL) + *Favorites* (αποθηκευμένα param sets), scoped ανά project/office. **«Duplicate & edit favorite»**. Accessories = subtype objects. | Scoped libraries (company=office / user / project). Favorites = named presets. Duplicate&edit = §2.1. |
| **MAXON C4D / Figma** | Assets / Components / Presets με **overrides** (instance παρακάμπτει το master χωρίς να το αλλάζει). | type-level preset (master) + instance-level override (§2.3). |
| **Custom family import** (Revit .rfa / ArchiCAD .gsm / γενικά .obj/.gltf) | Ο χρήστης εισάγει **δικό του 3D μοντέλο** όταν το παραμετρικό δεν αρκεί. Advanced, χάνει την παραμετρικότητα. | Στρώμα 2 (§2.6) — custom mesh import. |

**Κοινός παρονομαστής και των 4:** *παραμετρικό εξάρτημα + named presets σε scoped βιβλιοθήκη, με «duplicate & edit»
πάνω σε immutable built-ins* = default. *Ελεύθερο mesh* = δεύτερη, advanced επιλογή. **Επιβεβαιώνει τη 2-στρωματική
αρχιτεκτονική.**

### 1.2 Υπάρχοντα building blocks (ώριμα — επεκτείνονται, ΟΧΙ ξαναχτίζονται)

| Ρόλος | Αρχείο | Τι δίνει |
|---|---|---|
| **Generic scoped-library engine** | `bim/services/scoped-library-service.ts` (ADR-652) | `ScopedLibraryService<T>` + `createSubcollectionScopedLibrary()` — buckets system/company/project/user, cache 5min, tenant isolation (CHECK 3.10), `setDoc`-only (N.6), builtin-immutability guard. **Χτίζουμε πάνω του — μηδέν νέος engine.** |
| **«Save my model» pattern** | `bim/stairs/stair-presets-service.ts` (ADR-358) + `bim/family-types/bim-family-type-service.ts` (ADR-412) | `SavePresetInput`/`SaveTypeInput` (name+scope+params), `savePreset`/`saveType`/`updateType`/`deleteType`, live Zustand store (`getType(id)` «type always wins»), `origin: built-in/user/auto`. |
| **Picker-με-βιβλιοθήκη** | `bim/family-types/opening-material-catalog.ts` + `ui/ribbon/hooks/useOpeningMaterialCatalog.ts` (ADR-672) | merge **preset + library + custom** σε optgroups· `createOpeningMaterialCatalog(entries)`· SSR-safe default. |
| **Editable catalog + resolver-fold** | `bim/family-types/resolve-opening-frame-profile.ts` + `FRAME_PROFILE_CATALOG` (ADR-611) | catalog → type → instance → override fold· η **βάση του πιλότου**. |
| **Preset-id binding (type+instance)** | `bim/types/opening-types.ts` (`OpeningParams`) + `bim/types/bim-family-type.ts` (`OpeningTypeParams`) + `opening.schemas.ts` | το ακριβές μοτίβο ADR-672/674 (νέα optional πεδία, auto persistence via generic spread). |
| **3Δ γεωμετρία εξαρτημάτων** | `bim-3d/converters/opening-hardware-builders.ts` + `opening-mesh-builders.ts` + `opening-mesh.ts` (`makeBoxMesh`) | builders χειρολαβής/άξονα/κλειδαριάς/μεντεσέδων/leaf/υαλοπίνακα — σήμερα **μόνο κουτιά** (`THREE.BoxGeometry`). |
| **Custom mesh (Στρώμα 2)** | `bim-3d/library/bim-mesh-library/` (ADR-411) + `bim/services/BlockLibraryService.ts` + `bim/block-library/block-geometry-storage.ts` | glTF load/cache ανά (category, assetId)· Storage-blob upload + scope metadata doc pattern. **Δεν υπάρχει σήμερα user-upload 3D — νέο έδαφος.** |
| **«Αλλάζω υλικό»** | `bim/services/MaterialLibraryService.ts` (`bmat_*`, ADR-330/363) | user υλικά scoped, `saveMaterial`/`updateMaterial`. |
| **Glazing** | `bim/thermal/glazing-u-catalog.ts` (ADR-422) | `glazingPanes 1|2|3 → Ug`· **μόνο U-value tag, χωρίς γεωμετρία/spacer/υλικό ανά τζάμι**. |
| **Enterprise-id** | `src/services/enterprise-id-*.ts` (N.6) | generators· υπάρχει **δεσμευμένο-αχρησιμοποίητο `BIM_PRESET: 'bpst'`** (§2.2). |

### 1.3 Το κενό

- **Καμία επιλογή σχήματος**: κάθε εξάρτημα = ένα hardcoded σχήμα ανά family.
- **Καμία αποθήκευση «δικού μου»**: μόνο σκάλες/υλικά/family-types έχουν save· τα εξαρτήματα κουφώματος όχι.
- **Frame profiles static**: το `FRAME_PROFILE_CATALOG` δεν είναι editable/derivable/user-scoped.
- **Γεωμετρία μόνο κουτιά**: `makeBoxMesh` → `THREE.BoxGeometry`· ρεαλιστικά σχήματα (καμπύλες, στρογγυλές γωνίες,
  extruded προφίλ, πολλαπλά τζάμια) απαιτούν **νέο geometry spec type**.
- **Glazing = tag**: μονό/διπλό/τριπλό οπτικά ίδια (ένα κουτί)· BOQ αγνοεί το τζάμι.

---

## 2. Decision — αρχιτεκτονική

### 2.0 Δύο στρώματα (απόφαση Giorgio: **και τα δύο**)

- **Στρώμα 1 — Παραμετρικό component preset (default, ~90%).** Κάθε εξάρτημα = named preset με
  (α) **shape variant / cross-section** (enum + optional editable outline), (β) **διαστάσεις** (numeric params),
  (γ) **material id**. Scoped (company κύριο / user / project). Κρατά **παραμετρικότητα + BOQ + editability**.
- **Στρώμα 2 — Custom mesh (advanced, «δικά μου μοντέλα»).** Import `.obj/.gltf`, προσάρτηση ως component
  (§2.6). Πλήρης ελευθερία σχήματος· χάνει το παραμετρικό/BOQ.

Και τα δύο μοιράζονται τον **ίδιο preset-id binding μηχανισμό** (§2.3) και τον **ίδιο scoped-library engine** (§2.1) —
ένα custom mesh είναι απλώς ένα preset του οποίου η γεωμετρία δείχνει σε Storage blob αντί για παραμετρικό builder.

### 2.1 Generic preset-library pattern (SSoT — χτισμένο πάνω στο ScopedLibraryService)

Κάθε τύπος εξαρτήματος (frame / handle / hinge / lock / glazing / …) αποκτά ένα domain service **που συνθέτει**
`createSubcollectionScopedLibrary()` (ADR-652) — **ΟΧΙ** χειρόγραφα Firestore queries (θα το flag-άρει το
CHECK 3.18 / N.18 ως sibling clone).

**Τρία στρώματα δεδομένων ανά τύπο** (mirror `opening-material-catalog` merge):
1. **Builtin layer** — `const` catalog array (π.χ. το υπάρχον `FRAME_PROFILE_CATALOG`). **Immutable** — δεν το αγγίζει ο χρήστης.
2. **User-library layer** — scoped Firestore docs (company/user/project) μέσω `ScopedLibraryService`. Εδώ ζουν τα «δικά μου».
3. **Custom sentinel** — inline ad-hoc override χωρίς αποθήκευση (το υπάρχον `CATALOG_CUSTOM_SENTINEL`).

**«Edit built-in / derive variant» (η κρίσιμη απαίτηση Giorgio — Revit «Duplicate Type» / ArchiCAD «duplicate & edit»):**
- Ο χρήστης επιλέγει ένα builtin (ή user) preset → «Επεξεργασία» ή «Αποθήκευση ως νέο».
- Τα builtins **μένουν immutable**· το «edit» παράγει **derived αντίγραφο στο user-library layer** (νέο enterprise-id,
  `derivedFrom: <sourceId>`, scope company/user), το οποίο μετά είναι πλήρως editable/deletable.
- Το «Αποθήκευση ως νέο» = ίδια ροή, ξεκινώντας από τις τρέχουσες (ίσως χειροκίνητα πειραγμένες) τιμές.

**Doc shape (generic, ανά τύπο preset)** — extends `ScopedLibraryDoc`:
```ts
export interface ComponentPresetDoc<TSpec> extends ScopedLibraryDoc {
  readonly id: string;                 // enterprise-id, §2.2
  readonly kind: OpeningComponentKind; // 'frame' | 'handle' | 'hinge' | 'lock' | 'glazing' | ...
  readonly name: string;               // user-visible (data, όχι i18n)
  readonly scope: 'company' | 'user' | 'project';
  readonly origin: 'user' | 'derived'; // builtins ΔΕΝ αποθηκεύονται εδώ (ζουν στο const array)
  readonly derivedFrom?: string;       // source builtin/user id (provenance για «duplicate & edit»)
  readonly spec: TSpec;                // ο παραμετρικός ορισμός (§2.4) ή { meshRef } για Στρώμα 2
  readonly materialId?: string;        // bmat_* ή preset material id
  // + ownerId/companyId/createdAt/... (server-added από το engine)
}
```

### 2.2 Enterprise-id (N.6)

Δύο επιλογές — **προς απόφαση Giorgio (§4 Q3)**:
- **(Α, σύσταση)** Νέα per-type prefixes + subcollections για καθαρά queries/scope:
  `frmpst` (frame presets), `hwpst` (handle/hardware), `hngpst` (hinge), `glzpst` (glazing), `setpst` (composite set),
  `cmesh` (custom mesh Στρώμα 2). Καθένα → νέα subcollection `companies/{cid}/opening_<x>_presets`.
- **(Β)** Reuse του **δεσμευμένου-αχρησιμοποίητου `BIM_PRESET: 'bpst'`** (collection `bim_presets`, ήδη «system/company/project/user scope») ως **ενιαίο** component-preset collection με `kind` discriminator.

Νέο generator = 3 touch points (`enterprise-id-prefixes.ts` + `enterprise-id-class.ts` + `enterprise-id-convenience.ts`) + re-export
στο `enterprise-id.service.ts` facade.

### 2.3 Preset-id binding (type + instance + resolver-fold) — το ADR-611/672/674 idiom

Κάθε τύπος εξαρτήματος αποκτά **optional preset-id πεδία** και στα δύο επίπεδα, ίδιο μοτίβο με `frameProfileId`/`materials`/`hardwareOverrides`:

```ts
// bim/types/opening-types.ts — OpeningParams (instance)
readonly framePresetId?: string;    // ADR-676 — ΕΠΕΚΤΑΣΗ του frameProfileId (§2.9)
readonly handlePresetId?: string;
readonly hingePresetId?: string;
readonly lockPresetId?: string;
readonly glazingPresetId?: string;
readonly componentSetId?: string;   // composite «σετ» (§2.5)

// bim/types/bim-family-type.ts — OpeningTypeParams (type default) — τα ίδια πεδία
```

**Resolver-fold ανά τύπο** (νέο `resolve-opening-<part>-preset.ts`, mirror `resolve-opening-frame-profile.ts`):
```
builtin/user catalog default
  < typeParams.<x>PresetId       (Revit "type default")
  < params.<x>PresetId           (instance override)
  < params.<x>PresetOverrides    (inline χειροκίνητα — custom sentinel)
```
- Persistence: **auto** — τα optional πεδία round-trip μέσω του generic spread (`opening-firestore-service.ts`), καμία migration.
- Zod: `<x>PresetId: z.string().min(1).optional()` και στα δύο schemas (`opening.schemas.ts`).

### 2.4 Ρεαλιστική γεωμετρία — νέος shape-spec SSoT (απόφαση Giorgio: **ρεαλιστικά εξαρχής**)

Η σημερινή γεωμετρία είναι **μόνο κουτιά** (`makeBoxMesh` → `THREE.BoxGeometry`). Για καμπύλες/στρογγυλεμένες
γωνίες / extruded προφίλ / πολλαπλά τζάμια εισάγεται **ένα SSoT shape-spec union** που ο builder ξέρει να υλοποιεί:

```ts
// bim-3d/converters/component-shape-spec.ts (ΝΕΟ — SSoT)
export type ComponentShapeSpec =
  | { readonly geom: 'box'; readonly sx: number; readonly sy: number; readonly sz: number }
  | { readonly geom: 'cylinder'; readonly radius: number; readonly height: number; readonly axis: 'x'|'y'|'z' }
  | { readonly geom: 'rounded-box'; readonly sx: number; readonly sy: number; readonly sz: number; readonly radius: number }
  | { readonly geom: 'extrude'; readonly section: readonly Vec2[]; readonly depth: number }   // swept 2D cross-section
  | { readonly geom: 'lathe'; readonly profile: readonly Vec2[] };                             // rotational
```
- **Ένας** dispatcher `makeShapeMesh(spec, material, basis)` (SSoT, δίπλα στο `makeBoxMesh` — το `makeBoxMesh`
  γίνεται special-case `geom:'box'`). Οι builders (`opening-hardware-builders`, `opening-mesh-builders`) εκπέμπουν
  `ComponentShapeSpec[]` αντί για `BoxSpec[]`.
- **Shape variant enum → spec**: κάθε preset ορίζει shape variant (π.χ. χειρολαβή `straight`/`curved`/`L`,
  πλακέτα `rect`/`rounded`, μεντεσές `barrel`/`piano`, τζάμι `single`/`double`/`triple`) που ένας pure builder
  μεταφράζει σε `ComponentShapeSpec[]`. Καθαρό σημείο εισόδου: `handleAssembly`/`hingesAt` (ήδη παίρνουν shape param
  `leverLen`/`count`, ADR-672 §8).
- **Παραμετρικό cross-section για frames** (§2.9): το `extrude` spec επιτρέπει ρεαλιστικό προφίλ κάσας (rebate,
  θερμοδιακοπή) ως editable 2D outline — swept, Revit-style. Το ορθογώνιο `faceWidth×depth` του ADR-611 = το default
  `section` (4 κορυφές).
- **Parity guard**: `openingHasOperableHardware(kind)` παραμένει **kind-only** (ADR-674) — **ΔΕΝ σπάει** από shape variants.

> ⚠️ **Απόσπαση scope (§4 Q2):** σήμερα quantity ↔ geometry είναι **αποσυνδεδεμένα** — override `hinge:5` στο BOQ
> ΔΕΝ ζωγραφίζει 5 μεντεσέδες (τα counts είναι hardcoded 2/3 ανά family). Το να σεβαστεί η γεωμετρία τις ποσότητες
> είναι **ξεχωριστό, μεγαλύτερο** scope από τα shape variants — flagged, όχι σιωπηλά μαζί.

### 2.5 Composite «set» preset (απόφαση Giorgio: **ξεχωριστές βιβλιοθήκες + σετ**)

Πέρα από per-component presets, ο χρήστης αποθηκεύει ένα **«σετ κουφώματος»** = συνδυασμός preset-ids:
```ts
export interface OpeningComponentSetDoc extends ScopedLibraryDoc {
  readonly kind: 'set';
  readonly name: string;
  readonly members: {
    readonly framePresetId?: string;
    readonly handlePresetId?: string;
    readonly hingePresetId?: string;
    readonly lockPresetId?: string;
    readonly glazingPresetId?: string;
  };
}
```
Εφαρμογή σετ = γράφει τα member preset-ids στα type/instance params (§2.3) σε **μία** εντολή. Το σετ **αναφέρεται**
στα per-component presets (δεν τα αντιγράφει) → αλλαγή σε ένα preset ενημερώνει όσα σετ το χρησιμοποιούν (SSoT).

### 2.6 Στρώμα 2 — custom mesh import (νέο έδαφος)

Δεν υπάρχει σήμερα user-upload 3D. Συνδυασμός τριών υπαρχόντων patterns:
- **Upload**: Storage blob (μίμηση `block-geometry-storage.ts`) — `.obj/.gltf` σε `opening-component-mesh/<companyId>/<presetId>.glb`.
- **Load/cache**: glTF loader + template-group cache (μίμηση `bim-mesh-library` ADR-411).
- **Metadata/scope**: `ComponentPresetDoc` με `spec: { geom: 'mesh', meshRef: <storagePath>, boundsMm }`, scope μέσω `ScopedLibraryService`.
- **License gate**: `BlockLicense`-style provenance/redistributable (ADR-409).
- Χάνει: παραμετρικότητα, BOQ ποσότητες (το mesh = αδιαφανές). Ο resolver επιστρέφει `meshRef` αντί για `ComponentShapeSpec[]`·
  ο converter φορτώνει το glTF αντί να τρέξει builder.

### 2.7 UI (extend, ΟΧΙ νέα dialogs)

| Ανάγκη | Επέκταση | Πηγή |
|---|---|---|
| Picker εξαρτήματος (preset + library + custom optgroups) | κλωνοποίηση `OpeningMaterialSelectCell` + `useOpeningMaterialCatalog` → `Opening<X>SelectCell` + `use<X>Catalog` | ADR-672 |
| Type-level edit | νέες picker γραμμές στο `EditOpeningTypeDialog.tsx` (δίπλα στα 4 material rows) | ADR-611/672 |
| Instance-level edit | μίμηση triple `EditOpeningHardwareDialog` + `edit-opening-<x>-store` + `RibbonOpening<X>Widget` | ADR-674 |
| «Αποθήκευση ως δικό μου» / «Duplicate & edit» (inline name+scope) | μίμηση `StairPresetsSection` (Save→name input+scope select→Confirm) | ADR-358 |
| Full library manager (κάρτες, φίλτρα, edit/delete-confirm) | μίμηση `MaterialsLibraryPanel` + `LibraryFilterBar` + `DeleteConfirmDialog` | ADR-363 |
| Ribbon exposure | `RibbonPanel.tsx` switch + `contextual-opening-tab.ts` widget declaration | ADR-674 |

Commit πάντα μέσω **υπάρχοντος** `UpdateOpeningParamsCommand` (undoable + persist + BOQ re-feed). i18n: όλα μέσω
`t('...')` σε **el + en** `dxf-viewer-shell.json` **πριν** χρησιμοποιηθούν (N.11)· catalog data (κατασκευαστής/σειρά/mm)
**δεν** μεταφράζεται (ίδια εξαίρεση με `formatIShapePresetLabel`, ADR-611 §2.2).

### 2.8 BOQ altitude (ΟΧΙ μέσω BimToBoqBridge)

Το `BimToBoqBridge.upsertBoqItemForBim` **απορρίπτει openings** (ADR-376 §B.2). Τα preset-driven quantities/costs
περνούν μέσω των **υπαρχόντων** `opening-boq-sync.ts` / `opening-hardware-boq-sync.ts`, με **effective-typeParams-per-row**
resolution (ADR-674 §Δ) ώστε το type-level default να φτάνει στο aggregated row ενώ το instance override κερδίζει.
Ανά preset dimension: αν επηρεάζει μόνο schedule labels → `schedule-preset-mappers.ts` (ADR-672 §Γ)· αν επηρεάζει
priced line → `opening-hardware-boq-sync`-style path.

> ⚠️ Το `opening-boq-sync.ts` / `boq-firestore-sync.ts` / `BimToBoqBridge.ts` τα δουλεύει **άλλος agent (ADR-675
> baseline-drift)**. Ο Phase 3 agent: **read-only** εκεί όσο τρέχει το ADR-675· συντονισμός με Giorgio πριν άγγιγμα.

### 2.9 🎯 ΠΙΛΟΤΟΣ (Phase 3, πρώτο) — Frame/Casing library (επέκταση ADR-611)

**Γιατί πιλότος:** το ADR-611 έχει **ήδη** `FRAME_PROFILE_CATALOG` + `resolveOpeningFrameProfile` + `frameProfileId`
σε params/typeParams + 2D/3D wiring + ribbon panel. Άρα ο πιλότος **δεν προσθέτει νέο data-model concept** — προσθέτει
**μόνο** το preset-library-generic pattern (§2.1) πάνω σε ήδη-παραμετρικό/resolved concept. Δοκιμάζει ΟΛΟ το
edit+library+save+derive μοτίβο με ελάχιστο ρίσκο· μετά αντιγράφεται σε handle/hinge/glazing.

**Τι αλλάζει στο ADR-611:**
1. **Builtin layer**: το `FRAME_PROFILE_CATALOG` (const) μένει ως έχει, immutable = builtin layer.
2. **User-library layer** (ΝΕΟ): `frame-profile-library-service.ts` = `createSubcollectionScopedLibrary()` στο
   `companies/{cid}/opening_frame_profiles`, enterprise-id `frmpst` (ή `bpst`, §4 Q3), scope company(κύριο)/user.
   Doc = `OpeningFrameProfile` + `{ scope, origin: 'user'|'derived', derivedFrom?, name }`.
3. **Merge provider** (ΝΕΟ, μίμηση `opening-material-catalog`): `createFrameProfileCatalog(libraryEntries)` → optgroups
   **Builtin / Η βιβλιοθήκη μου / Custom**. `useFrameProfileCatalog()` hook wiring `companyId/userId/projectId`.
4. **Resolver** (`resolve-opening-frame-profile.ts`): επεκτείνεται να ψάχνει **builtin ΚΑΙ user library** για το
   `frameProfileId` (σήμερα μόνο builtin `getFrameProfileById`). Fold σειρά αμετάβλητη (§2.3).
5. **Realistic cross-section** (§2.4): προαιρετικό `section?: readonly Vec2[]` στο `OpeningFrameProfile` (default =
   ορθογώνιο από `faceWidth×depth`). Ο 3D `frameBars()` → `extrude` spec όταν υπάρχει `section`, αλλιώς box (zero-regression).
6. **Edit/derive UI**: στο υπάρχον `'opening-frame-profile'` ribbon panel προστίθενται κουμπιά **«Αποθήκευση ως δικό μου»**
   (inline name+scope, μίμηση `StairPresetsSection`) + **«Duplicate & edit»** (derive από builtin/user· τα builtins immutable).
7. **Library manager**: νέο tab/panel (μίμηση `MaterialsLibraryPanel`) list/rename/delete των user frame profiles.
8. **BOQ**: frame profile σήμερα ΔΕΝ αλλάζει BOQ signature — παραμένει (§2.8)· καμία αλλαγή στο grouper στον πιλότο.

**N.8 μέγεθος πιλότου:** ~10-14 αρχεία σε 2-3 domains (types+resolver+service+catalog-provider+hook+2 UI+i18n+tests)
→ **Orchestrator** (2+ domains). 1 dimension/session.

---

## 3. Consequences

- ✅ **Revit/ArchiCAD-level**: παραμετρικό preset + named library + duplicate&edit πάνω σε immutable builtins.
- ✅ **Μηδέν νέος engine**: όλα πάνω σε `ScopedLibraryService` (ADR-652)· κανένα Firestore query χειρόγραφα (N.18).
- ✅ **Auto persistence**: preset-id πεδία round-trip μέσω generic spread· καμία migration.
- ✅ **Zero-regression πιλότος**: `section` προαιρετικό (default ορθογώνιο = σημερινή γεωμετρία)· builtin catalog immutable.
- ✅ **Επεκτάσιμο**: το ίδιο μοτίβο αντιγράφεται handle→hinge→lock→glazing μετά τον πιλότο.
- ⚠️ **Realistic geometry = νέος shape-spec SSoT** (§2.4) — μεγαλύτερη δουλειά από box-only· σταδιακά.
- ⚠️ **Στρώμα 2 (custom mesh) = νέο έδαφος** — Storage upload + license gate + glTF cache· δεύτερη προτεραιότητα μετά τον πιλότο.
- ⚠️ **Glazing = από το μηδέν γεωμετρία** (σήμερα ένα κουτί)· BOQ glazing = νέο.
- ⚠️ **BOQ coordination** με ADR-675 agent (§2.8).

---

## 4. Αποφάσεις Giorgio (κλειδωμένες 2026-07-18 — δεσμευτικές για Phase 3)

- **Q1 — Στρώμα 2 (custom mesh) → ΜΕΤΑ τον πιλότο.** ✅ Ο **πιλότος frame = ΜΟΝΟ Στρώμα 1** (παραμετρικό preset).
  Το Στρώμα 2 (upload `.obj/.gltf`) σχεδιάζεται/υλοποιείται στο **2ο dimension (χειρολαβές)**, όπου έχει πραγματικό
  νόημα το «ανεβάζω δικό μου 3D».
- **Q2 — Geometry-σέβεται-ποσότητες → ΝΑΙ, μαζί με το σχετικό dimension.** ✅ Η γεωμετρία να ζωγραφίζει τον
  πραγματικό αριθμό τεμαχίων (π.χ. 6 μεντεσέδες αντί hardcoded 3).
  > ⚠️ **ΔΙΕΥΚΡΙΝΙΣΗ (κρίσιμη για Phase 3):** ο **πιλότος = κάσες**, και οι κάσες **ΔΕΝ έχουν έννοια ποσότητας**
  > (δεν υπάρχει «Ν κάσες» — μία κάσα ανά κούφωμα). Άρα το quantity↔geometry coupling **δεν αφορά τον πιλότο-κάσα**·
  > εφαρμόζεται στο **hardware/hinge dimension** (2ο-3ο εξάρτημα). «Μαζί με τον πιλότο» = **μη το αναβάλλεις ως
  > ξεχωριστή μελλοντική φάση** — υλοποιείται μαζί με το εξάρτημα που έχει ποσότητες (μεντεσέδες), όχι αργότερα
  > αποκομμένο. Ο `hingesAt(count)` builder (ADR-674 §8) διαβάζει το resolved quantity αντί για hardcoded 2/3.
- **Q3 — Enterprise-id → νέα per-type prefixes** (`frmpst`/`hwpst`/`hngpst`/`glzpst`/`setpst`/`cmesh`), ξεχωριστές
  subcollections. ✅ (Τεχνική απόφαση agent· καθαρότερα queries/scope από το ενιαίο `bpst`.)
- **Q4 — Frame realistic cross-section → ΠΡΩΤΑ απλό (ορθογώνιο), ρεαλιστικό μετά.** ✅ Ο πιλότος υλοποιεί
  **library + save + derive** με το υπάρχον ορθογώνιο `faceWidth×depth`. Το editable `section` outline (§2.4/§2.9-5)
  = **2ο βήμα** του frame dimension (ή επόμενο), αφού δουλέψει το preset-library μηχανισμός. (Το «ρεαλιστικά εξαρχής»
  του γενικού πλάνου ισχύει· εδώ ο πιλότος σπάει σε 2 βήματα για γρήγορο πρώτο αποτέλεσμα.)
- **Q5 — Scope default στο «Αποθήκευση ως δικό μου» → Εταιρείας (company).** ✅ (Ο χρήστης αλλάζει σε user/project
  τη στιγμή του save· company = το προτεινόμενο.)

---

## 5. References

- **ADR-611** — Opening Frame Profile (catalog + resolver + `frameProfileId`) — **η βάση του πιλότου**· επεκτείνεται με user-library + save + derive + realistic `section`.
- **ADR-672** — Editable per-opening materials — το preset-id binding idiom (type+instance+per-part resolver-fold) + picker-με-βιβλιοθήκη (`opening-material-catalog`).
- **ADR-674** — Opening hardware take-off — catalog→type→instance fold, type→BOQ effective-typeParams-per-row, instance dialog+ribbon triple.
- **ADR-422** — Glazing U-value catalog — `glazingPanes`/`resolveOpeningUValue`· η βάση glazing library.
- **ADR-412** — Family-Type effective-param resolution — "type wins, overrides win last".
- **ADR-652** — ScopedLibraryService M2 — `createSubcollectionScopedLibrary`· ο generic engine κάθε νέας βιβλιοθήκης.
- **ADR-358** — Stair Presets — `SavePresetInput`/scope· το «save my model» UI+service πρότυπο.
- **ADR-411** — BIM mesh library — glTF load/cache· η βάση Στρώματος 2.
- **ADR-330/363** — BIM Material library — `bmat_*`· το «αλλάζω υλικό».
- **ADR-376** — Opening BOQ signature grouping — γιατί ΟΧΙ μέσω `BimToBoqBridge`.
- **ADR-409** — Third-party BIM library licensing — provenance catalog/mesh.
- Research report — `HANDOFFS/2026-07-18_opening-component-library-RESEARCH-REPORT.md`.

---

## Changelog

- **2026-07-18 (Phase 2 — DESIGN)** — ADR δημιουργήθηκε από το research report (6 read-only research agents, Phase 1).
  Ορίστηκε η 2-στρωματική αρχιτεκτονική (παραμετρικό preset + custom mesh), το generic preset-library pattern πάνω στο
  `ScopedLibraryService` με builtin/user/custom merge + «duplicate & edit» (Revit «Duplicate Type» / ArchiCAD
  «duplicate & edit favorite»), το preset-id binding (type+instance+resolver-fold, idiom ADR-611/672/674), ο νέος
  `ComponentShapeSpec` SSoT για ρεαλιστική γεωμετρία, το composite «set» preset, η αρχιτεκτονική Στρώματος 2 (custom
  mesh), το UI (extend), και το BOQ altitude. **Κλειδωμένες αποφάσεις Giorgio (2026-07-18):** και τα δύο στρώματα·
  ρεαλιστικά εξαρχής· ξεχωριστές βιβλιοθήκες + σετ· scope company(κύριο)+user· `framePresetId` = ΕΠΕΚΤΑΣΗ του
  `frameProfileId` (ADR-611) με edit-υφιστάμενων + derive-παραλλαγών· **πιλότος Phase 3 = frame/casing library**.
  **Q1-Q5 (§4) απαντήθηκαν από Giorgio την ίδια μέρα** (βλ. §4 για πλήρη): Q1 custom-mesh→2ο dimension (χειρολαβές),
  ΟΧΙ στον πιλότο· Q2 geometry-σέβεται-ποσότητες→ναι, στο hardware/hinge dimension (ο πιλότος-κάσα δεν έχει ποσότητες)·
  Q3 νέα per-type prefixes (`frmpst`/`hwpst`/…)· Q4 πιλότος πρώτα ορθογώνιο, realistic `section` σε 2ο βήμα·
  Q5 default scope=company. **ΚΑΜΙΑ υλοποίηση κώδικα σε αυτή τη φάση.** — *Ο agent του Phase 3 (πιλότος frame)
  θα προσαρτήσει εδώ την implementation entry, code = source of truth.*
