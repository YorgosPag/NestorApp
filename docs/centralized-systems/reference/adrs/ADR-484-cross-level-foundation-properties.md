# ADR-484 — Cross-level Foundation Properties (κοινός SSoT selection resolver) + διασαφήνιση ανάθεσης επιπέδου

**Status:** 🟢 DONE (UNCOMMITTED 2026-06-18 Opus) · **Σχετικά:** ADR-459 (foundation-level SSoT / cross-level organism — η πηγή των footings), ADR-463 (Foundation Reinforcement UX + Properties panel), ADR-436 (foundation discipline + UpdateFoundationParamsCommand), ADR-420/399 (BIM persistence scope — durable floorId), ADR-366/363 (BimPropertiesShell/Router), ADR-040 (low-freq store reads).
**Ημ/νία:** 2026-06-18 · **Γλώσσα:** Ελληνικά.
**Πηγή:** `HANDOFFS/HANDOFF_2026-06-18_FOUNDATION-cross-level-properties-and-level-assignment.md`.

---

## 1. Context — δύο συνδεδεμένα θέματα στα πέδιλα

### (A) BUG — cross-level Properties άδειο
Επιλέγοντας πέδιλο που ανήκει σε **άλλο** επίπεδο από τον ενεργό όροφο (π.χ. ενεργός = «Ισόγειο», πέδιλο στον foundation level), το δεξί panel «Ιδιότητες» έμενε **άδειο** και ΔΕΝ εμφανιζόταν contextual ribbon tab. Πέδιλο στον **ενεργό** όροφο → δούλευε κανονικά.

**Ρίζα:** ΟΛΟΙ οι consumers του primary-selected entity (`BimPropertiesShell`, `BimPropertiesRouter`, `FoundationPropertiesTab`, ο contextual resolver `useActiveContextualTrigger`) έψαχναν **ΜΟΝΟ** στο `currentScene.entities` του ενεργού ορόφου. Τα πέδιλα όμως ζουν cross-level (collection `floorplan_foundations`, στον foundation level) και αφαιρούνται ρητά από τα entities ενός μη-foundation ορόφου (`useFoundationLevelSync.stripFootings`). Άρα `find` → `null` → άδειο panel + κανένα tab.

### (B) Διασαφήνιση — γιατί «διαφορετικά επίπεδα»
**ΔΕΝ υπάρχει per-kind level assignment.** `building-foundation-level.ts` → `floors.find(f => f.kind === 'foundation')` = **ΕΝΑΣ** foundation level ανά κτίριο· όλα τα kinds (pad/strip/tie-beam) ανήκουν εκεί. Τα διαφορετικά **υψόμετρα** ανά kind (tie-beam ψηλότερα, EC8) = by design (`defaultFoundationTopElevationMm`). Η εικόνα «πράσινο στο Ισόγειο / καφέ στη θεμελίωση» οφείλεται στο **provenance του write-path**, ΟΧΙ στο kind:
- **Χειροκίνητο placement** (`useSpecialTools` → `addFoundationToScene` → `appendEntityToScene(currentLevelId)`) → το πέδιλο μπαίνει στο **active scene** + persist στο active-floor scope → είναι στο `currentScene` → panel δούλευε.
- **Cross-level writer** (auto-design / column-attach, `foundation-cross-level-writer`) → γράφει στο **foundation-level scope** → cross-level → ΟΧΙ στο `currentScene` → panel άδειο.

➡️ Το intended Revit-canonical model είναι «όλα τα πέδιλα στον foundation level». Το χειροκίνητο placement που τα αφήνει σε μη-foundation ενεργό όροφο είναι **ασυνέπεια ανάθεσης** (provenance-based, ΟΧΙ kind-based) — **DEFER** σε δικό του slice (write-path redirect = αλλαγή persistence scope/undo με ρίσκο). Το fix (A) κάνει το πέδιλο πλήρως λειτουργικό ανεξαρτήτως που ζει, άρα δεν είναι blocker.

## 2. Decision — ΜΙΑ αλήθεια επιλογής → ΕΝΑΣ resolver (Revit-grade)

Revit-canonical αρχή: ένα στοιχείο δείχνει/επεξεργάζεται τις ιδιότητές του **ανεξάρτητα** από το ενεργό view/level. ΕΝΑΣ κοινός SSoT resolver, reused από ΟΛΟΥΣ τους consumers — μηδέν διπλό lookup, μηδέν cross-level lookup «μόνο στο foundation tab».

## 3. Αρχιτεκτονική

### NEW — κοινός resolver (SSoT)
- **`systems/selection/resolve-selected-entity.ts`** — pure `resolveSelectedEntityFrom(id, sceneEntities, crossLevelEntities)`: ψάχνει (1) active scene, (2) fallback cross-level footings. Active πρώτα (anti-echo shadow). Zero React/Firestore deps.
- **`hooks/selection/useResolvedSelectedEntity.ts`** — reactive hook wrapper· πηγή cross-level = `useFoundationLevelStore.entities` (**low-freq** → ADR-040-safe, η ΙΔΙΑ πηγή που τροφοδοτεί 3D/organism, **μηδέν νέο Firestore subscription**).

### MODIFY — αντικατάσταση `currentScene.entities.find` με τον resolver
- `ui/bim-properties/BimPropertiesShell.tsx` (sub-tabs gate)
- `ui/wall-advanced-panel/BimPropertiesRouter.tsx` (per-type panel routing)
- `ui/foundation-advanced-panel/FoundationPropertiesTab.tsx` (read)
- `app/ribbon-contextual-config.ts` `useActiveContextualTrigger` (contextual tab cross-level· +`crossLevelEntities` dep)

### MODIFY — cross-level-aware write
- `ui/ribbon/hooks/bridge/useFoundationParamsDispatcher.ts`: αν το πέδιλο ζει στο active scene → υπάρχον **undoable** `UpdateFoundationParamsCommand`. Αλλιώς (cross-level) → `createFoundationCrossLevelWriter(scope, target, levelManager).update(...)` με geometry/validation recompute από τις **ΙΔΙΕΣ** pure SSoT (`computeFoundationGeometry` + `validateFoundationParams`) που χρησιμοποιεί το command — μηδέν duplication. **Trade-off:** cross-level edit = fire-and-forget (μη-undoable), συνεπές με το υπάρχον cross-level auto-design pattern.

## 4. Reuse vs New (SSoT audit)
**Reuse:** `useFoundationLevelStore` (πηγή footings), `foundation-cross-level-writer`, `computeFoundationGeometry`/`validateFoundationParams`, `resolveBimPersistenceScope`, `resolveContextualTrigger`.
**New:** ΕΝΑ pure resolver + 1 hook wrapper + 6 jest.

## 5. ADR-040 σημείωση
Η subscription στο `foundation-level-store` ΔΕΝ παραβιάζει τον micro-leaf κανόνα: είναι **low-freq** store (γράφεται μόνο σε αλλαγή ορόφου/δομική μεταβολή), ΟΧΙ high-freq (hover/cursor/transform) → μηδέν 60fps re-renders.

## 6. Tests
`systems/selection/__tests__/resolve-selected-entity.test.ts` — 6 GREEN (null/active/fallback/anti-shadow/null-scene/ghost). +202 foundation jest GREEN (regression).

## 7. DEFER
- (B) write-path redirect: χειροκίνητο foundation placement → foundation level (αντί active). Ξεχωριστό slice (persistence scope/undo).
- Cross-level edit undoable (cross-level command).
- Secondary cosmetics: `QuickProperties3DHoverPopover` (no `case 'foundation'`), `focus-order.ts` `SEMANTIC_TYPE_ORDER` (χωρίς `'foundation'`).

## Changelog
- **2026-06-18 (Opus, UNCOMMITTED):** Αρχική υλοποίηση. NEW pure resolver + hook· MODIFY 4 read consumers + cross-level-aware dispatcher· 6 jest GREEN +202 regression. 🔴 tsc (Giorgio) + browser-verify + commit. (B) DEFER.
