# HANDOFF — ADR-408 Εύρος Β: 3D CLICK-PLACEMENT ΚΑΛΟΡΙΦΕΡ (`mep-radiator`) + ΛΕΒΗΤΑ (`mep-boiler`)

**Ημερομηνία:** 2026-06-08
**Εντολή Giorgio:** «ΟΠΩΣ Η REVIT — FULL ENTERPRISE + FULL SSOT»
**Μοντέλο:** Opus 4.8
**⚠️ COMMIT/PUSH: ΜΟΝΟ ο Giorgio.** Working tree **SHARED** με άλλον agent (roof/IfcCovering + opening Family/Type WIP).
**⚠️ `git add` ΜΟΝΟ δικά σου αρχεία — ΠΟΤΕ `-A`. ΜΗΝ adr-index. ΜΗΝ `--no-verify`.**

---

## 0) Ο ΣΤΟΧΟΣ (μικρό scope, χαμηλό ρίσκο)

Τοποθέτηση **καλοριφέρ** + **λέβητα** με **κλικ μέσα στο 3D viewport** (single-click, point-based), όχι μόνο στην 2D κάτοψη. Συμπληρώνει το pattern που ήδη υπάρχει για **συλλέκτη** (`mep-manifold`, ADR-408 Φ12) και **σωλήνα** (`mep-segment`, 2-click, 2026-06-07).

**Template = `useBim3DMepManifoldPlacement` (point-based single-click).** ΟΧΙ ο σωλήνας (που είναι 2-click linear).

---

## 1) ✅ ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (μην το ξαναφτιάξεις — verify μόνο)

Το scaffolding είναι **ήδη σε μεγάλο βαθμό έτοιμο** και για τα δύο entities:

| Συστατικό | Κατάσταση |
|---|---|
| EventBus events `bim:place-mep-radiator-3d` + `bim:place-mep-boiler-3d` (`{ point: Point2D }`) | ✅ Δηλωμένα στο `systems/events/drawing-event-map.ts` (γρ. ~288, ~290) |
| 2D tool reserved listener (`EventBus.on('bim:place-mep-*-3d', ({point}) => onCanvasClick(point))`) | ✅ ΗΔΗ στο `useMepRadiatorTool.ts:141` + `useMepBoilerTool.ts:141` |
| Tool bridge-stores (read overrides + `getSceneUnits()` + `mountingElevationMm`) | ✅ `mep-radiator-tool-bridge-store.ts` + `mep-boiler-tool-bridge-store.ts` (γράφονται single-writer από τα tools) |
| 3D converters `radiatorToMesh` / `boilerToMesh` | ✅ exported από `bim-3d/converters/BimToThreeConverter.ts` (ήδη import στο `BimSceneLayer`) |
| Completion builders `buildDefaultMep{Radiator,Boiler}Params` + `buildMep{Radiator,Boiler}Entity` | ✅ στο `hooks/drawing/mep-{radiator,boiler}-completion.ts` |
| Geometry `computeMep{Radiator,Boiler}Geometry` | ✅ στο `bim/mep-{radiators,boilers}/mep-{radiator,boiler}-geometry.ts` |
| Παλέτα/χρώμα (warm-red) | ✅ — δες τον manifold ghost για το `resolveManifoldPalette` pattern· για radiator/boiler χρησιμοποίησε σταθερό warm-red (π.χ. `0xdc2626`) ή το αντίστοιχο symbol palette helper αν υπάρχει |

**Άρα το «δύσκολο» (το bridge wiring 2D↔3D) ΕΓΙΝΕ ΗΔΗ όταν φτιάχτηκαν τα entities.** Μένει μόνο ο 3D-side emitter + ghost.

---

## 2) ❌ ΤΙ ΛΕΙΠΕΙ (αυτό είναι όλη η δουλειά — 4 NEW + 2 mount γραμμές)

### Καλοριφέρ
1. **NEW** `bim-3d/placement/use-bim3d-mep-radiator-placement.ts` — **clone** του `use-bim3d-mep-manifold-placement.ts`:
   - Gate: `activeTool === 'mep-radiator'` && `selectIs3D(...)` (ΟΧΙ το manifold/drainage-collector OR).
   - Reads: `mepRadiatorToolBridgeStore` (`getSceneUnits` + `overrides.mountingElevationMm`· default = `DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM` ή ό,τι ισχύει στα radiator types).
   - Emit στο click: `EventBus.emit('bim:place-mep-radiator-3d', { point: planMmToScenePoint(hit.planMm, unitsNow()) })`.
   - Ghost: `new MepRadiatorPlacementGhost(manager.scene)`.
2. **NEW** `bim-3d/placement/MepRadiatorPlacementGhost.ts` — **clone** του `MepManifoldPlacementGhost.ts`:
   - `buildDefaultMepRadiatorParams` → `computeMepRadiatorGeometry` → `radiatorToMesh`.
   - reads `mepRadiatorToolBridgeStore`· `GHOST_LAYER_ID = '__ghost-mep-radiator__'`· warm-red translucent material.

### Λέβητας
3. **NEW** `bim-3d/placement/use-bim3d-mep-boiler-placement.ts` — clone όπως πάνω (`activeTool === 'mep-boiler'`, `mepBoilerToolBridgeStore`, emit `bim:place-mep-boiler-3d`).
4. **NEW** `bim-3d/placement/MepBoilerPlacementGhost.ts` — clone (`buildDefaultMepBoilerParams` → `computeMepBoilerGeometry` → `boilerToMesh`).

### Mount (additive, 1 αρχείο)
5. `bim-3d/viewport/BimViewport3D.tsx` — 2 imports + 2 κλήσεις δίπλα στο `useBim3DMepManifoldPlacement(...)` (γρ. ~293) και `useBim3DMepSegmentPlacement(...)` (γρ. ~296):
   ```ts
   useBim3DMepRadiatorPlacement({ managerRef, canvasEl });
   useBim3DMepBoilerPlacement({ managerRef, canvasEl });
   ```

**Δεν χρειάζεται:** καμία αλλαγή σε events, 2D tools, bridge-stores, converters, persistence, ribbon, i18n — όλα υπάρχουν.

---

## 3) ΑΡΧΙΤΕΚΤΟΝΙΚΕΣ ΣΗΜΕΙΩΣΕΙΣ (FULL SSOT — μην fork-άρεις)

- **Work-plane:** το καλοριφέρ/λέβητας είναι wall-mounted → ο cursor προβάλλεται στο work-plane `floorElev + mountingElevationMm` (mirror manifold). Η **ΙΔΙΑ** elevation τροφοδοτεί raycast + `radiatorToMesh`/`boilerToMesh` (FFL + mounting) ώστε ghost == cursor (WYSIWYG). Δες `mountingElevationMmNow()` στον manifold hook.
- **Commit path = ΕΝΑ με το 2D:** ο 3D hook ΜΟΝΟ υπολογίζει world point → `bim:place-mep-*-3d` → το 2D tool `onCanvasClick` κάνει το commit (FSM = single source of truth). Μηδέν διπλό commit logic.
- **OSNAP:** reuse `resolvePlacementSnap` (ίδιο move + click → WYSIWYG). Έρχεται δωρεάν από το manifold clone.
- **Orbit-drag guard:** `ORBIT_DRAG_PX = 5` (αν το pointer κουνήθηκε >5px → ήταν orbit, όχι placement). Στο manifold clone ήδη.
- **ADR-040:** **ΕΚΤΟΣ** — `bim-3d/placement/` είναι pure-Three, κανένα 2D canvas micro-leaf. Κανένα CHECK 6B/6C/6D αρχείο (όπως manifold/segment 3D placement). **ΔΕΝ** χρειάζεται staging ADR-040.
- **ΟΧΙ rotation/anchor στο v1:** το manifold placement τοποθετεί στο default rotation (όπως και το 2D single-click). Αν το radiator/boiler 2D tool έχει Tab-anchor/rotation, το v1 3D placement μπορεί να μείνει default (documented follow-up), όπως ο manifold.

---

## 4) ΕΠΑΛΗΘΕΥΣΗ (πριν παραδώσεις)

1. `npx tsc --noEmit 2>&1 | grep -iE "radiator|boiler|placement"` → πρέπει EMPTY στα δικά σου.
   - ⚠️ **Pre-existing/άλλου agent errors (ΜΗΝ τα κυνηγήσεις):** `mesh-to-object3d.ts:124`, `apply-entity-preview.ts:316`, `DeleteEntityCommand.ts:54` (roof), `useOpeningFamilyTypeController.ts` (opening family-type WIP).
2. Browser: 3D view → ενεργοποίησε εργαλείο «Καλοριφέρ» → ghost ακολουθεί cursor στο work-plane → κλικ → δημιουργείται + persist· ίδιο για «Λέβητα».
3. **N.15 docs (ΙΔΙΟ commit, ο Giorgio):** ADR-408 changelog entry + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ενημέρωσε το «PENDING: 3D-viewport click-placement» στα radiator/boiler entries σε ✅) + memory. **ΟΧΙ adr-index** (shared).

---

## 5) ❌ ΜΗΝ ΚΑΝΕΙΣ

- ΜΗΝ commit/push (μόνο Giorgio). ΜΗΝ `git add -A`. ΜΗΝ adr-index. ΜΗΝ `--no-verify`. ΜΗΝ revert άλλου agent.
- ΜΗΝ αγγίξεις τα 2D tools / bridge-stores / events / converters — **υπάρχουν ήδη**.
- ΜΗΝ προσθέσεις rotation/anchor στο v1 (default placement, mirror manifold).

---

## 6) ΠΛΑΙΣΙΟ — ΚΑΤΑΣΤΑΣΗ WORKING TREE (διάβασέ το, μη μπερδευτείς)

Στο shared tree υπάρχουν **uncommitted** τα εξής δικά μου (ΟΛΟΚΛΗΡΩΜΕΝΑ, 🔴 pending verify+commit από Giorgio· **ΜΗΝ τα αγγίξεις/revert-άρεις**):

- **ADR-408 Εύρος Β #3 — Ενδοδαπέδια (`mep-underfloor`) Waves A–F DONE** (tsc 0 δικά μου· geometry 13/13· 16 NEW + ~31 modified αρχεία· firestore rules+indexes×4 pending `firebase deploy`). Δες `HANDOFFS/2026-06-07_adr408-underfloor-heating_WAVE0-DONE-WAVES-A-F-PENDING.md` + το ADR-408 changelog (κορυφή).
- Επίσης uncommitted δουλειά **άλλου agent** (roof/IfcCovering, opening Family/Type) — **ΞΕΝΗ, ΜΗΝ την αγγίξεις**.

Μετά την ολοκλήρωση radiator/boiler 3D placement, το **εύρος θέρμανσης Εύρος Β** κλείνει πλήρως (δίκτυο + καλοριφέρ + λέβητας + ενδοδαπέδια, με 3D placement σε όλα τα point-based). Απομένει μόνο **BOQ θέρμανσης** = 🔴 BLOCKED (χρειάζεται κωδικό άρθρου ΗΛΜ· τα ΑΤΟΕ έχουν μόνο ΟΙΚ).
