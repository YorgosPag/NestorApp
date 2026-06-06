# HANDOFF — ADR-417 Φ4: «Attach Top» τοίχων στη στέγη (Revit-true) — FULL ENTERPRISE + FULL SSOT

**Ημερομηνία:** 2026-06-06 · **Μοντέλο:** Opus 4.8 · **Mode:** Plan Mode (~8-12 αρχεία, 2+ domains — αξιολόγησε N.8 πριν ξεκινήσεις)

> **ΓΛΩΣΣΑ:** Ο Giorgio γράφει & διαβάζει **Ελληνικά**. ΑΠΑΝΤΑΣ ΠΑΝΤΑ ΣΤΑ ΕΛΛΗΝΙΚΑ.
> **ΠΟΙΟΤΗΤΑ:** «όπως οι μεγάλοι παίχτες, Revit» — **FULL ENTERPRISE + FULL SSOT + ΠΛΗΡΗ ΑΛΗΘΟΦΑΝΕΙΑ**. Μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n SSoT el+en πρώτα), μηδέν duplicate, αρχεία ≤500 / συναρτήσεις ≤40 γραμμές.
> **COMMIT:** Τα commit τα κάνει **ΜΟΝΟ ο Giorgio** (N.(-1)). Ο agent ΔΕΝ κάνει commit/push.
> **⚠️ SHARED WORKING TREE** με άλλον agent (ADR-408 MEP) — `git add` ΜΟΝΟ specific δικά σου αρχεία, **ΠΟΤΕ `git add -A`**, ΜΗΝ αγγίξεις `adr-index.md`, ΜΗΝ committ-άρεις MEP αρχεία (`mep-*`, `grip-parametric-*`).

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ

**Revit «Attach Top/Base → roof»**: οι τοίχοι κάτω από μια κεκλιμένη στέγη ακολουθούν το ανηφορικό προφίλ της — η κορυφή κάθε τοίχου κόβεται σε κεκλιμένο επίπεδο αντί για οριζόντιο. Αυτό ονομάζεται «Wall Attach Top to Roof» στο Revit.

**Το ADR-401 «Attach Top» ΥΠΑΡΧΕΙ ΗΔΗ** και δουλεύει άψογα για `beam` / `slab`. Η **νέα στέγη `RoofEntity` (ADR-417)** δεν είναι ακόμα registered ως structural host. Χρειάζονται **5 στοχευμένες επεμβάσεις** σε υπάρχοντα SSoT αρχεία — μηδέν νέα αρχιτεκτονική.

---

## ✅ ΤΙ ΕΧΕΙ ΗΔΗ ΓΙΝΕΙ (UNCOMMITTED — commit μόνο Giorgio)

### ADR-417 Φ1 + Φ1-part-2 + Φ2a + Φ2b — Στέγη entity + hips + γείσο (2026-06-04→06)
Όλα DONE (βλ. `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-417 §9/§10). tsc 0 πλην pre-existing `mesh-to-object3d.ts:124` (ADR-411 — άγνοησέ το).

**NEW κρίσιμα αρχεία που χρειάζεσαι:**
- `bim/geometry/roof-lower-envelope.ts` — `roofZmm(planes, basePivotZ, s, pt)` + `resolveEavePlanes(edges, footprint, unit)` (SSoT υπολογισμού ύψους στέγης σε κάθε plan-point)
- `bim/types/roof-types.ts` — `RoofEntity`, `RoofParams { outline, edges, slopeUnit, basePivotZ, thickness }`
- `types/entities.ts:784` — `isRoofEntity` type guard

---

## 🗺️ ΤΕΧΝΙΚΟΣ ΧΑΡΤΗΣ — 5 ΕΠΕΜΒΑΣΕΙΣ

### ΕΠΕΜΒΑΣΗ 1 — NEW `roofHostInput()` adapter
**Αρχείο:** `src/subapps/dxf-viewer/bim/geometry/wall-host-plan-builder.ts` (γρ. 260-327)

Υπάρχουν ήδη `beamHostInput(beam)` + `slabHostInput(slab)`. Πρόσθεσε:

```typescript
import type { RoofEntity } from '../types/roof-types';
import { resolveEavePlanes, roofZmm } from './roof-lower-envelope';

/**
 * Roof → host input. Footprint = canvas-unit outline (mirror slabHostInput).
 * Underside = roofZmm(planes, basePivotZ, s, pt) − thickness:
 * η κεκλιμένη κάτω-παρειά στέγης σε κάθε plan-point (SSoT roofZmm).
 * Nominal flat fallback = basePivotZ − thickness (eaves datum − πάχος).
 * ΔΕΝ δίνει topsideZmm — η στέγη attach-από-κάτω (top-only, ΟΧΙ base-attach).
 */
export function roofHostInput(roof: RoofEntity): HostFootprintInput {
  const { planes } = resolveEavePlanes(
    roof.params.edges,
    roof.params.outline.vertices,
    roof.params.slopeUnit,
  );
  const footprint = roof.params.outline.vertices.map((v) => ({ x: v.x, y: v.y }));
  const basePivotZ = roof.params.basePivotZ;
  const thickness = roof.params.thickness;
  const s = roof.params.slopeUnit;
  return {
    hostId: roof.id,
    hostType: 'roof',          // ήδη μέλος HostUndersidePlan['hostType'] union
    footprint,
    undersideZmm: basePivotZ - thickness,   // flat-roof / eaves nominal
    undersideZmmAt: (pt) => roofZmm(planes, basePivotZ, s, pt) - thickness,
  };
}
```

**Σημαντικό:** `roof.params.outline.vertices` είναι σε **canvas units** (ίδιο plan space με τα `e.params.start.x` τοίχων). Το `roofZmm` δέχεται canvas-unit points → επιστρέφει mm. Ίδια σύμβαση με `slabHostInput`. Μηδέν unit conversion χρειάζεται.

---

### ΕΠΕΜΒΑΣΗ 2 — Επέκταση `buildWallHostInputs()` (+roofs)
**Αρχείο:** `src/subapps/dxf-viewer/bim/geometry/wall-host-plan-builder.ts` (γρ. 322-327)

```typescript
// ΠΡΙΝ (γρ. 322-327):
export function buildWallHostInputs(
  beams: readonly BeamEntity[],
  slabs: readonly SlabEntity[],
): HostFootprintInput[] {
  return [...beams.map(beamHostInput), ...slabs.map(slabHostInput)];
}

// ΜΕΤΑ (backward-compat: roofs optional):
export function buildWallHostInputs(
  beams: readonly BeamEntity[],
  slabs: readonly SlabEntity[],
  roofs: readonly RoofEntity[] = [],
): HostFootprintInput[] {
  return [
    ...beams.map(beamHostInput),
    ...slabs.map(slabHostInput),
    ...roofs.map(roofHostInput),
  ];
}
```

**Consumers — πού πρέπει να περάσεις `roofs`:**

| Αρχείο | Γρ. | Τωρινή κλήση | Διόρθωση |
|--------|-----|--------------|----------|
| `bim-3d/scene/BimSceneLayer.ts` | 220 | `buildWallHostInputs(entities.beams, entities.slabs)` | + `, entities.roofs ?? []` |
| `bim-3d/2d-section/section-scene-sync.ts` | 62 | `buildWallHostInputs(beams, slabs)` | + `, roofs` (πρόσθεσε `const { walls, columns, beams, slabs, roofs } = useBim3DEntitiesStore.getState()`) |
| `hooks/data/wall-boq-feed.ts` | 70-72 | `buildWallHostInputs(scene.entities.filter(isBeamEntity), scene.entities.filter(isSlabEntity))` | + `, scene.entities.filter(isRoofEntity)` |
| `bim-3d/scene/bim-envelope-scene-builder.ts` | 165, 191 | `buildWallHostInputs(entities.beams, entities.slabs)` | + `, entities.roofs ?? []` |
| `bim-3d/animation/bim3d-preview-rebuild.ts` | 117, 167, 211, 226, 254 | `buildWallHostInputs(s.beams, s.slabs)` | + `, s.roofs ?? []` |

**⚠️ ΠΡΟΣΕΞΕ:** Ελέγξε αν το `useBim3DEntitiesStore` έχει `roofs` field (βλ. `useFloors3DAggregator.ts:64` — ήδη φιλτράρει `roofs: e.filter(isRoofEntity)`). Πιθανόν να χρειαστεί να το προσθέσεις και στο store interface.

---

### ΕΠΕΜΒΑΣΗ 3 — `resolveStructuralHostId` + `findStructuralHostAtPoint` (wall-attach-pick.ts)
**Αρχείο:** `src/subapps/dxf-viewer/bim/walls/wall-attach-pick.ts`

**3A — `resolveStructuralHostId` (γρ. 71-79):**
```typescript
// ΠΡΙΝ:
import { isWallEntity, isBeamEntity, isSlabEntity, isColumnEntity, isStairEntity } from '../../types/entities';
// ...
return isBeamEntity(e) || isSlabEntity(e) ? e.id : null;

// ΜΕΤΑ:
import { isWallEntity, isBeamEntity, isSlabEntity, isColumnEntity, isStairEntity, isRoofEntity } from '../../types/entities';
// ...
return isBeamEntity(e) || isSlabEntity(e) || isRoofEntity(e) ? e.id : null;
```

**3B — `findStructuralHostAtPoint` (γρ. 97-114):**
```typescript
// Πριν το beam loop, πρόσθεσε roof check (outline = canvas-unit polygon):
for (const e of entities) {
  if (isRoofEntity(e) && pointInPolygon(pointMm, e.params.outline.vertices)) {
    return e.id;
  }
}
```

⚠️ **ΜΟΝΑΔΕΣ**: `findStructuralHostAtPoint` δέχεται `pointMm` = mm space (ο καλών μετατρέπει). Το `params.outline.vertices` είναι canvas units. Αν το canvas-unit ≠ mm space → θα χρειαστείς canvas-unit `pointCanvas`. Έλεγξε τι unit δίνει ο καλών (`useWallAttachTool.ts`). Αν ο καλών ήδη μετατρέπει σε mm, τότε πρέπει να μετατρέψεις και το roof outline σε mm (× `mmToSceneUnits` inverse) — ΟΧΙ κόστος, κάνε early. Πιθανώς η πιο καθαρή λύση: πρόσθεσε `pointCanvas: Point2D` param ΚΑΙ canvas outline check — αν δεν υπάρχει, κάνε fallback.

**Απλούστερη προσέγγιση (πιθανώς ΟΚ):** Ελέγξε τον `useWallAttachTool.ts` για το τι unit χρησιμοποιεί. Αν χρησιμοποιεί canvas units ήδη → πρόσθεσε second param `pointCanvas?: Point2D` και κάνε roof check εκεί.

---

### ΕΠΕΜΒΑΣΗ 4 — `findWallsToAutoAttachToHost` (wall-structural-attach-coordinator.ts)
**Αρχείο:** `src/subapps/dxf-viewer/bim/walls/wall-structural-attach-coordinator.ts` (γρ. 114-137)

```typescript
// ΠΡΙΝ (γρ. 118-121):
import { isBeamEntity, isSlabEntity, isWallEntity } from '../../types/entities';
// ...
let hostInput: HostFootprintInput;
if (isBeamEntity(host)) hostInput = beamHostInput(host);
else if (isSlabEntity(host)) hostInput = slabHostInput(host);
else return [];

// ΜΕΤΑ:
import { isBeamEntity, isSlabEntity, isWallEntity, isRoofEntity } from '../../types/entities';
import { beamHostInput, slabHostInput, roofHostInput, ... } from '../geometry/wall-host-plan-builder';
// ...
let hostInput: HostFootprintInput;
if (isBeamEntity(host)) hostInput = beamHostInput(host);
else if (isSlabEntity(host)) hostInput = slabHostInput(host);
else if (isRoofEntity(host)) hostInput = roofHostInput(host);
else return [];
```

Μετά από αυτό, **αυτόματα** όταν ο χρήστης τοποθετεί στέγη → `findWallsToAutoAttachToHost` την ανιχνεύει και `AttachWallsTopCommand` αποτυπώνει τους τοίχους.

---

### ΕΠΕΜΒΑΣΗ 5 — ADR-417 + ADR-401 changelog + N.15 updates
Μετά την υλοποίηση:
- **ADR-417** (`docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md`) §9 +Φ4 changelog entry + §10 #8 DONE
- **ADR-401** (`docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md`) §9 ή §changelog: roof host support
- **`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`**: άλλαξε `❌ ΕΚΚΡΕΜΕΙ` → `✅ ΥΛΟΠΟΙΗΜΕΝΟ` για το Φ4
- **Memory:** `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr417_roof.md` + `MEMORY.md`
- **⚠️ ΜΗΝ αγγίξεις `adr-index.md`** (άλλος agent, shared tree)

---

## 🔑 ΚΡΙΣΙΜΕΣ ΛΕΠΤΟΜΕΡΕΙΕΣ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ

### Πώς δουλεύει το υπάρχον top-attach (ADR-401)
1. `WallParams.topBinding = 'attached'` + `attachTopToIds: string[]` (ήδη persist-αρισμένο)
2. `resolveWallTopProfile(params, ctx)` — SSoT `bim/geometry/wall-top-profile.ts` — παράγει `WallTopProfile.segments[]` με `z0mm/z1mm` (sloped κορυφή)
3. `buildSlopedWallPieceGeometry` (`bim-3d/converters/wall-piece-geometry.ts`) χτίζει wedge
4. `clipWallBandTopRegions` (`bim-3d/converters/wall-top-clip.ts`) κόβει τα 2D bands
5. **Το μόνο που λείπει:** `RoofEntity` ως valid host στα 3 σημεία παραπάνω

### `HostUndersidePlan.hostType`
```typescript
// bim/geometry/wall-top-profile.ts (ήδη υπάρχει):
hostType: 'beam' | 'slab' | 'roof'
```
Η τιμή `'roof'` **ΗΔΗ ΥΠΑΡΧΕΙ** στο union — ο resolver ήδη τη δέχεται. Μηδέν αλλαγή στο `wall-top-profile.ts`.

### `roofZmm` signature
```typescript
// bim/geometry/roof-lower-envelope.ts:116-129
export function roofZmm(
  planes: readonly EavePlane[],
  basePivotZ: number,           // mm
  s: RoofSlopeUnit,             // 'deg' | 'percent'
  pt: { x: number; y: number }, // canvas units (ίδιο με outline)
): number // mm (absolute)
```

### `resolveEavePlanes` signature
```typescript
// bim/geometry/roof-lower-envelope.ts:91-113
export function resolveEavePlanes(
  edges: readonly RoofEdgeSlope[],
  footprint: readonly { x: number; y: number }[], // canvas units
  unit: RoofSlopeUnit,
): { planes: EavePlane[]; slopeEdgeIndices: number[] }
```

### Flat roof edge case
Flat roof: `planes` είναι empty (ή όλα slopes=0). `roofZmm([], basePivotZ, s, pt) === basePivotZ`. Άρα `undersideZmmAt` επιστρέφει `basePivotZ − thickness` παντού → ίδιο με `undersideZmm`. **Σωστό behavior, χωρίς special case.**

---

## 📁 ΑΡΧΕΙΑ ΑΝΑΦΟΡΑΣ

### Αρχεία που ΑΛΛΑΖΕΙΣ (5 επεμβάσεις)
| Αρχείο | Αλλαγή |
|--------|--------|
| `bim/geometry/wall-host-plan-builder.ts` | + `roofHostInput()` + `buildWallHostInputs` 3rd param |
| `bim/walls/wall-attach-pick.ts` | `resolveStructuralHostId` + `findStructuralHostAtPoint` + `isRoofEntity` |
| `bim/walls/wall-structural-attach-coordinator.ts` | `findWallsToAutoAttachToHost` + `isRoofEntity` branch |
| `bim-3d/scene/BimSceneLayer.ts:220` | + `entities.roofs ?? []` |
| `bim-3d/2d-section/section-scene-sync.ts:62` | + `roofs` from store |
| `hooks/data/wall-boq-feed.ts:70-72` | + `scene.entities.filter(isRoofEntity)` |
| `bim-3d/scene/bim-envelope-scene-builder.ts:165,191` | + `entities.roofs ?? []` |
| `bim-3d/animation/bim3d-preview-rebuild.ts:117,167,211,226,254` | + `s.roofs ?? []` |

### Αρχεία που ΔΙΑΒΑΖΕΙΣ (κατανόηση, ΟΧΙ αλλαγή)
| Αρχείο | Γιατί |
|--------|-------|
| `bim/geometry/wall-top-profile.ts` | `resolveWallTopProfile`, `HostUndersidePlan`, `WallVerticalContext` |
| `bim-3d/converters/wall-piece-geometry.ts` | `buildSlopedWallPieceGeometry` — χτίζει wedge |
| `bim-3d/converters/wall-top-clip.ts` | `clipWallBandTopRegions` — 2D section |
| `core/commands/entity-commands/AttachWallsTopCommand.ts` | command που εκτελεί attach |
| `systems/tools/useWallAttachTool.ts` | manual attach tool (units!) |
| `bim/entities/entity-attach-detach.ts` | `detachEntitySide`, `isEntitySideAttached` |
| `bim/geometry/roof-lower-envelope.ts` | `roofZmm`, `resolveEavePlanes`, `EavePlane` |
| `bim/types/roof-types.ts` | `RoofEntity`, `RoofParams` |
| `types/entities.ts:784` | `isRoofEntity` type guard |

---

## 🧪 TESTS + TSC

**Tests να γράψεις:**
1. `roofHostInput` — flat roof → `undersideZmmAt` επιστρέφει `basePivotZ − thickness` παντού
2. `roofHostInput` — gable roof → eave point επιστρέφει `basePivotZ − thickness`, ridge midpoint επιστρέφει `basePivotZ + height − thickness`
3. `buildWallHostInputs` — με roofs → διπλό length (beams+slabs+roofs)
4. `findWallsToAutoAttachToHost` — roof host → βρίσκει τοίχους κάτω από τη στέγη
5. `resolveStructuralHostId` — roof entity → επιστρέφει id

**TSC:** `npx tsc --noEmit | grep -v "mesh-to-object3d.ts(124"` → 0 errors.

**Test suite (υπάρχον):** `npx jest "roof\|wall-host\|wall-attach"` — ήδη 55+ tests PASS. ΜΗΝ σπάσεις κανέναν.

---

## ⚠️ ΚΡΙΣΙΜΑ ΣΗΜΕΙΑ / ΠΑΓΙΔΕΣ

1. **Unit mismatch στο `findStructuralHostAtPoint`**: ο καλών μετατρέπει σε mm. Η slab outline είναι canvas units. Ελέγξε `useWallAttachTool.ts` — αν δίνει canvas-unit point, τότε πρόσθεσε second param. Αν δίνει mm, πρέπει να μετατρέψεις το roof outline. **Πρώτα διάβασε τον tool.**

2. **`useBim3DEntitiesStore` — roofs field**: ελέγξε αν υπάρχει. Πιθανόν χρειαστεί να προσθέσεις στον store interface (mirror του `useFloors3DAggregator` που ήδη έχει `roofs`).

3. **`bim3d-preview-rebuild.ts` — `s.roofs`**: ελέγξε τον τύπο του `s` (preview state snapshot). Αν δεν έχει `roofs`, πρόσθεσε optional field ή filter από `s.entities`.

4. **ADR-040 compliance**: `bim-3d/converters/wall-piece-geometry.ts` + `wall-top-clip.ts` = converters (ΟΧΙ micro-leaf — ΟΧΙ ADR-040). `wall-host-plan-builder.ts`, `wall-attach-pick.ts`, `wall-structural-attach-coordinator.ts` = pure geometry (ΟΧΙ ADR-040). Δεν αγγίζεις canvas/renderer = δεν χρειάζεται CHECK 6B/6D.

5. **`topBinding='storey-ceiling'` μόνο**: `findWallsToAutoAttachToHost` ήδη skip-άρει τοίχους με `topBinding !== 'storey-ceiling'` — σωστό Revit behavior (δεν πειράζουμε χειροκίνητα attached / unconnected).

6. **Flat roof**: `buildWallHostInputs` δέχεται `slabs` που μπορεί να έχουν `kind='roof'` (παλιά flat roof ως slab). ΜΗΝ συγχύσεις την παλιά `SlabEntity kind='roof'` με τη νέα `RoofEntity`. Το `roofHostInput` δέχεται ΜΟΝΟ `RoofEntity` (ADR-417).

---

## 🧭 ΕΚΤΕΛΕΣΗ (N.8 — Execution Mode)

Αυτό είναι **~8-12 αρχεία, 2 domains** (geometry + scene sync) → **Plan Mode** (N.8). Πρότεινε Sonnet 4.6 (N.14) — είναι στοχευμένο refactor, ΟΧΙ νέα αρχιτεκτονική.

**Ακολούθησε αυτή τη σειρά:**
1. Διάβασε `useWallAttachTool.ts` (units για `findStructuralHostAtPoint`)
2. Υλοποίησε Επέμβαση 1 + 2 (adapter + buildWallHostInputs)
3. Υλοποίησε Επέμβαση 3 (wall-attach-pick)
4. Υλοποίησε Επέμβαση 4 (auto-attach coordinator)
5. Ενημέρωσε consumers (Επέμβαση 2 — 8 αρχεία)
6. Tests + tsc
7. Επέμβαση 5 (ADR changelog + N.15)

**Μη ρωτήσεις τον Giorgio** για τα open decisions — η αρχιτεκτονική είναι κλειστή (SSoT reuse). Ρώτα μόνο αν βρεις unit mismatch που δεν ξεκαθαρίζεται από τον κώδικα.
