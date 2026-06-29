# HANDOFF — ADR-550 Φ2: Unified Entity Render Contract Registry (NEXT)

**Ημερομηνία:** 2026-06-29
**Subapp:** `src/subapps/dxf-viewer`
**Σχετικά ADR:** ADR-549 (census), ADR-550 (Unified Entity Render Contract), ADR-040 (2D perf), ADR-366 (3D), ADR-527 (SceneManager SSoT), ADR-535/542/545 (ήδη-ενιαία overlays)

---

## 🎯 ΣΤΟΧΟΣ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ — Φ2

Υλοποίηση του **Entity Contract Registry**: ΕΝΑ canonical registration object ανά renderable entity type που δηλώνει σε **ένα σημείο** πώς αποδίδεται η οντότητα:
`geometry` (ήδη SSoT) · `draw2D` · `build3D` · `getGrips` (ήδη ενιαίο) · `ghost`.

**Όφελος:** νέα οντότητα = **ένα** registration → αυτόματα 2D + 3D + ghost + grips. Σήμερα ορίζεται σε 2-3 ξεχωριστά σημεία (κίνδυνος «φαίνεται 2D αλλά όχι 3D»).

**Πρότυπο μεγάλων παικτών (επιβεβαιωμένο):**
- **AutoCAD:** `worldDraw()` / `viewportDraw()` — ΕΝΑ entity, N contexts. Το πιο κοντινό στο ζητούμενο.
- **Revit:** element → geometry → N view representations (plan/3D/section).
- **Cinema 4D (Maxon):** scene-graph object + draw methods, N render backends.
> Όλοι: **ΕΝΑ data model + ΕΝΑ geometry + ΕΝΑ entity contract → N backends**. Κανείς δεν ενοποιεί τα backends.

---

## ⚠️⚠️ ΑΠΑΡΑΒΑΤΕΣ ΟΔΗΓΙΕΣ ΓΙΟΡΓΟΥ (ΔΙΑΒΑΣΕ ΠΡΩΤΑ)

1. **ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep).** Ψάξε αν υπάρχει ήδη registry/contract/dispatch μηχανισμός ώστε να τον **επεκτείνεις**, όχι να φτιάξεις διπλότυπο. (Στο παρελθόν η υπόθεση «διπλό geometry» ΔΙΑΨΕΥΣΤΗΚΕ από audit — μη βιαστείς.) Συγκεκριμένα grep: `Registry`, `register(`, `Map<string`, `EntityRendererComposite`, `getSupportedEntityTypes`, `contract`, `dispatch`, `worldDraw`.
2. **FULL ENTERPRISE + FULL SSoT** — αλλά **αν οι μεγάλοι παίκτες (Revit/Maxon/AutoCAD) δεν προτείνουν** κάποια προσέγγιση, **ακολούθησε τη δική τους πρακτική**, όχι θεωρητική τελειότητα. Επιβεβαίωσε το pattern πριν το χτίσεις.
3. **ADAPTER, ΟΧΙ REWRITE.** Strangler-fig: οι υπάρχοντες ~57 renderers/converters γίνονται **adapters** πίσω από το contract. ΜΗΝ ξαναγράψεις renderers. ΜΗΝ ενοποιήσεις Canvas2D + Three (μένουν 2 backends).
4. **⚠️ SHARED WORKING TREE με άλλον agent.** Άγγιξε **μόνο** τα αρχεία του Φ2. ΠΟΤΕ `git add -A`. Δες `git status` πριν/μετά. Υπάρχουν ήδη uncommitted αλλαγές άλλων + ~21 προϋπάρχοντα tsc errors **που ΔΕΝ είναι δικά μας** (beam `concreteGrade`, `PlacementAlignmentGuide`, `bvh-setup`, `foundation-grips`, `BimPropertiesRouterProps`…). ΜΗΝ τα «διορθώσεις».
5. **COMMIT ΤΟ ΚΑΝΕΙ Ο ΓΙΟΡΓΟΣ — ΟΧΙ ΕΣΥ** (N.(-1)). Ετοίμασε, σταμάτα, ανέφερε.
6. **N.17 single-tsc:** πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει άλλος (shared PC). ΕΝΑ tsc τη φορά.
7. **Plan Mode πρώτα** (Φ2 αγγίζει render-critical αρχεία → N.8). CHECK 6B/6D: stage **ADR-040 + ADR-550** όταν committαρει ο Γιόργος.

---

## ✅ ΤΙ ΕΧΕΙ ΗΔΗ ΓΙΝΕΙ (Φ0 + Φ3 + Φ4, UNCOMMITTED)

| Αρχείο | Ρόλος |
|---|---|
| `rendering/contract/renderable-entity-type.ts` | **Φ0** — `RENDERABLE_ENTITY_TYPES` (17 DXF + 24 BIM), `BIM_RENDERABLE_TYPES`, `DXF_RENDERABLE_TYPES`, `RenderableEntityType` + compile-time bridge `⊆ EntityType` |
| `rendering/contract/entity-render-surfaces.ts` | Δηλωτικό `Record<RenderableEntityType, {d2,d3}>` + `BIM_2D_ONLY_TYPES` |
| `bim-3d/scene/bim-3d-renderable-types.ts` | `BIM_3D_CONVERTER_TYPES` (21, SSoT των `BimSceneLayer.sync*()`) |
| `rendering/contract/__tests__/entity-render-coverage.test.ts` | **Φ3** — δένει δηλωτικό ↔ ζωντανά dispatchers + symmetry 2D↔3D (7 jest GREEN) |
| `rendering/entities/StairRenderer.ts` | **ΔΙΑΓΡΑΦΗΚΕ** (Φ4, orphan shim) |

ADR-549/550 ενημερωμένα (Φ0/Φ3/Φ4 + διόρθωση «διπλό geometry» → ήδη SSoT).

---

## 📐 ΚΡΙΣΙΜΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (επιβεβαιωμένη από κώδικα)

- **Data model:** ΕΝΑ SSoT (ADR-527 SceneManager).
- **Geometry:** ΗΔΗ SSoT ανά οντότητα — `bim/geometry/{entity}-geometry.ts` (`computeColumnGeometry`/`computeBeamGeometry`/`computeSlabGeometry`), cached στο `entity.geometry.footprint.vertices`, διαβασμένο ΚΑΙ από 2D ΚΑΙ από 3D. **ΜΗΝ ξαναφτιάξεις geometry layer.**
- **2D dispatch:** `rendering/core/EntityRendererComposite.ts` — `Map<type, BaseEntityRenderer>` (introspectable: `getSupportedEntityTypes()`). ~38 renderers.
- **3D dispatch:** `bim-3d/scene/BimSceneLayer.ts` → `syncFloorEntities()` — **imperative per-family loops** (ΟΧΙ map). Καλεί converters από `bim-3d/converters/`.
- **Grips:** `rendering/grips/UnifiedGripRenderer.ts` — ΗΔΗ ενιαίο 2D+3D (ADR-535). **Reuse, μην το πειράξεις.**
- **Ghosts:** 3D = `bim-3d/placement/placement-ghost-overlay.ts` (SSoT)· 2D = per-family `*-ghost-renderer`.

---

## 🧭 ΠΡΟΤΕΙΝΟΜΕΝΗ ΠΡΟΣΕΓΓΙΣΗ Φ2 (προς επικύρωση στο Plan Mode μετά το audit)

Concept (όχι τελικό API — επικύρωσε με audit + Revit/Maxon practice):
```ts
interface EntityRenderContract<E> {
  readonly type: RenderableEntityType;
  draw2D(entity: E, ctx2d): void;          // adapter → υπάρχων renderer
  build3D(entity: E, sceneCtx): Object3D;  // adapter → υπάρχων converter
  getGrips(entity: E): GripInfo[];         // → UnifiedGripRenderer (ήδη ενιαίο)
  ghost(entity: E): GhostSpec;             // → υπάρχοντα ghost seams
}
```
- ΕΝΑ `EntityContractRegistry` (mirror του `EntityRendererComposite` Map pattern — **πιθανό reuse/επέκταση αυτού** αντί νέου).
- `EntityRendererComposite` και `BimSceneLayer` **διαβάζουν** από το registry (adapter wrap, μηδέν αλλαγή drawing logic).
- Το Φ3 coverage test γίνεται πιο ισχυρό: αντλεί από το registry αντί δηλωτικού `entity-render-surfaces.ts`.

**Σκέψου σοβαρά:** μήπως το ζητούμενο επιτυγχάνεται **επεκτείνοντας το `EntityRendererComposite`** (που είναι ήδη το 2D registry) σε cross-backend registry, αντί νέου παράλληλου μηχανισμού. Αυτό είναι το SSoT-σωστό. Επικύρωσέ το στο audit.

---

## 🚫 ΜΗ-ΣΤΟΧΟΙ
- ❌ Συγχώνευση Canvas2D + Three backends.
- ❌ Rewrite renderers/converters (adapter μόνο).
- ❌ Νέο geometry layer (υπάρχει ήδη SSoT).
- ❌ Άγγιγμα overlays grips/crosshair/snap/HUD (ήδη ενιαία — ADR-535/542/545).
- ❌ Big-bang. Ανεξάρτητα shippable, μηδέν regression.

## ✅ VERIFICATION
- `npx jest "src/subapps/dxf-viewer/rendering/contract"` → πρέπει GREEN (μη σπάσεις το Φ3).
- Single tsc (N.17): τα νέα/αλλαγμένα αρχεία καθαρά· αγνόησε τα ~21 προϋπάρχοντα errors άλλων agents.
- Browser-verify αν αλλάξει render path (το adapter wrap **δεν** πρέπει να αλλάξει συμπεριφορά).
