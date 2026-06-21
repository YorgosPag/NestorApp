# HANDOFF — ADR-510 Φ3c: Multifunctional Grips (Convert↔Arc/Line, Add/Remove Vertex, Bulge Drag)

> **Ημερομηνία:** 2026-06-22 · **Status:** Φ3a+Φ3b DONE (UNCOMMITTED), Φ3c = ΜΗΔΕΝ κώδικας.
> **Commit: ΜΟΝΟ ο Giorgio.** Shared working tree (ενεργοί agents) → `git add` ΜΟΝΟ δικά σου αρχεία.
> **Απάντα στα Ελληνικά.** Στόχος: **Revit-grade, FULL ENTERPRISE + FULL SSoT.**

---

## 0. ΤΙ ΕΓΙΝΕ ΗΔΗ (Φ3a + Φ3b — backbone, 35 jest GREEN, UNCOMMITTED)

**Φ3a — Bulge geometry SSoT** → NEW `rendering/entities/shared/geometry-bulge-utils.ts` (pure):
- `bulgeToArc(p0,p1,bulge) → {center,radius,startAngle,endAngle,sweep,counterclockwise,sagitta}` (cot formula· bulge=tan(θ/4)).
- `bulgeToPolyline(p0,p1,bulge,maxSegDeg=12)` — tessellated points (pins exact endpoints).
- `bulgeApexPoint(p0,p1,bulge)` — το apex/sagitta σημείο = **η θέση της λαβής τόξου** (grip).
- `bulgeFromApexPoint(p0,p1,t)` — **inverse: σύρσιμο apex handle → signed bulge** (projects στην κάθετο· side-drag δεν αλλάζει bulge). ← ΑΥΤΟ τροφοδοτεί το bulge-drag του Φ3c.
- `expandPolyline(vertices,bulges,closed,maxSegDeg)` — flat tessellated path (render + hit-test SSoT).
- `bulgeSegmentExtremes`, `hasAnyBulge`, `isStraightSegment`, `BULGE_STRAIGHT_EPS`.
- **private** `tessellateSignedArc` (CW/signed· ΟΧΙ public — υπάρχει ήδη `GeometryUtils.arcToPolyline` degree/CCW-only).

**Φ3b — Vertex model + arc render/hit-test:**
- `types/entities.ts`: `PolylineEntity` + `LWPolylineEntity` πήραν **parallel arrays** (απόφαση Giorgio «Επιλογή A»):
  `bulges?: number[]` / `startWidths?: number[]` / `endWidths?: number[]` — **index-aligned με `vertices`**, AutoCAD/DXF
  semantics: `bulges[i]` = OUTGOING segment `vertices[i] → [i+1]` (closed: `bulges[n-1]` = n-1 → 0). `vertices` έμεινε
  `Point2D[]` ΑΜΕΤΑΒΛΗΤΟ (μηδέν breakage στους ~12 consumers· stretch preserves bulge δωρεάν).
- `PolylineRenderer.ts`: bulge branch (`hasAnyBulge`→`expandPolyline` τessellated stroke, dash/linetype ρέει στο τόξο)
  + **hit-test bulge-aware** (`expandPolyline`· το τόξο βγαίνει εκτός chord).

**git add (Φ3a/Φ3b, αν δεν έγινε ήδη commit):** `rendering/entities/shared/geometry-bulge-utils.ts`(+`__tests__/`),
`rendering/entities/PolylineRenderer.ts`, `types/entities.ts` (⚠️ shared — έχει ΚΑΙ `HatchGradient` import άλλου agent),
`docs/.../ADR-510-line-creation-system.md`, `.claude-rules/pending-ratchet-work.md`.
⚠️ **ADR-040 CHECK 6B/6D** (PolylineRenderer) → stage `ADR-040`.

> **ΜΑΘΗΜΑ Φ3a (Giorgio SSoT audit):** είχα φτιάξει 2ο public `arcToPolyline` → name-collision με
> `utils/geometry/GeometryUtils.arcToPolyline` (ADR-166). Διορθώθηκε σε private helper. **Re-grep ΠΑΝΤΑ πριν
> δημιουργήσεις function — ειδικά κοινά ονόματα (arc/grip/vertex/bulge).**

---

## 1. 🚨 ΠΡΩΤΟ ΒΗΜΑ — RE-VERIFY SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΓΡΑΜΜΗ

Το audit μου (2026-06-22, 5 παράλληλα Explore) βρήκε **έτοιμη grip υποδομή — REUSE, ΜΗΝ ξαναγράψεις.**
**ΞΑΝΑ-κάνε grep ανά domain** (grip / vertex-command / context-menu / adapter) — μην βασιστείς μόνο στη λίστα:

### Α) Grip declaration + render (MOD, ADR-040-safe):
- `rendering/types/Types.ts:108-138` — **`GripInfo`** interface (`id, position, type, entityId, isVisible, gripIndex?,
  shape?, glyphRotationRad?, moveHoveredZone?`). `type: 'corner'|'midpoint'|'center'|'control'|'vertex'|'edge'`.
- `rendering/entities/BaseEntityRenderer.ts` — `getGrips()` (abstract, ~149), `renderGrips()` (~153-208),
  `findGripAtPoint()` (~295-304, event-time read — ADR-040 cardinal #2).
- `rendering/entities/shared/grip-utils.ts:53` — `createVertexGrip(entityId,position,gripIndex)`.
- `rendering/entities/shared/line-utils.ts:21` — `createEdgeGrips(entityId,vertices,closed,baseIndex)` (midpoints).
- `rendering/entities/PolylineRenderer.ts:140-170` — **`getGrips()` ΗΔΗ βγάζει vertex grips + edge(midpoint) grips.**
- `config/grip-size-default.ts` — `GRIP_SIZE_DEFAULT = 7` (ADR-107 SSoT).
- `rendering/grips/grip-temperature.ts:102-136` — `resolveGripTemperature` (cold/warm/hot/armed/snappable).
- ADR-501: `systems/grip/GripArmedStore.ts` (`armedKeys`, `gripKey(entityId,gripIndex)`). ADR-397: `bim/grips/rotation-snap-store.ts`.

### Β) Context menu — **PURE resolver, ΗΔΗ extensible (το κλειδί του Φ3c):**
- `systems/grip/grip-context-menu-resolver.ts:166-178` — **`resolveContextMenuSections(entity,grip)` PURE.**
  `buildVertexOpsSection(grip)` (~124-153) **ΗΔΗ** επιστρέφει vertex-ops «Delete/Add Corner» όταν
  `grip.slabGripKind|slabOpeningGripKind|roofGripKind` ταιριάζει (`*-vertex-*` → deleteCorner· `*-edge-midpoint-*` → addCorner).
- `systems/grip/grip-context-menu-actions.ts:120-149` — `bindContextMenuAction` cases:
  `'vertex-ops:deleteCorner'` / `'vertex-ops:addCorner'` → `ctx.onSlabVertexOp(grip, 'delete-corner'|'add-corner')`.
- `UnifiedGripInfo` — έχει τους discriminators `slabGripKind` κ.λπ. **→ ΠΡΟΣΘΕΣΕ `polylineGripKind`.**
- `GripHoverMenuStore` — hover-menu infra ΥΠΑΡΧΕΙ (όχι wired σε polyline grips ακόμη).

### Γ) Vertex commands (REUSE skeleton):
- `core/commands/vertex-commands/{MoveVertexCommand,AddVertexCommand,RemoveVertexCommand}.ts` — undo/redo/merge
  skeleton **100% reusable**, position-only. `MoveVertexCommand` merge = `(vertexIndex + isDragging + merge-window)`
  → **το πατρόν για live bulge-drag**.
- `core/commands/entity-commands/PolylineVertexCommand.ts` (ADR-349) — whole-entity snapshot add/remove·
  ρητό σχόλιο «convert-to-arc deferred — no bulges[] field» → **ΤΩΡΑ υπάρχει το πεδίο, ξεμπλόκαρε**.
- `core/commands/CommandHistory.ts` — `execute(cmd)` με merge. `core/commands/interfaces.ts:318-363` — **`ISceneManager`**
  `updateVertex/insertVertex/removeVertex/getVertices` (**position-only → χρειάζεται bulge/width extension**).
- `hooks/grip-scene-adapter.ts:77-145` + `systems/entity-creation/LevelSceneManagerAdapter.ts` — οι υλοποιήσεις.
- Command bases: `MergeableUpdateCommand<TPatch>` + `SnapshotTransformCommand` (ADR-507 §8) — reuse merge skeleton.
- `hooks/state/useGripMovement.ts:399-406` — δείγμα: `new MoveVertexCommand(...)` → `execute(command)`.
- `systems/grip/grip-to-vertex-refs.ts` — gripIndex → `VertexRef` mapping (line-start/line-end/polyline-vertex).

### Δ) Bulge math = ΗΔΗ ΕΤΟΙΜΟ στο Φ3a → **import, μην ξαναγράψεις:**
`bulgeApexPoint` (θέση λαβής τόξου), `bulgeFromApexPoint` (drag→bulge), `bulgeToArc`, `expandPolyline`.

---

## 2. SPEC Φ3c (ADR-510 §2.7 γρ.158-163) — Revit-grade multifunctional grips

| Λαβή | Hover/right-click menu | Σύρσιμο (drag) |
|---|---|---|
| **Κορυφή πολυγραμμής** (vertex) | Stretch (default) / **Add Vertex** / **Remove Vertex** / **Convert to Arc** | μετακίνηση κορυφής (MoveVertex) |
| **Μέσο ευθύγραμμου τμήματος** (segment-midpoint) | **Add Vertex** / **Convert to Arc** | — (ή Add+drag) |
| **Μέσο τόξου** (arc-midpoint, στο `bulgeApexPoint`) | **Convert to Line** | **αλλάζει bulge/καμπυλότητα** (live, `bulgeFromApexPoint`) |
| **Άκρο** (endpoint) → **Φ3e**, ΟΧΙ τώρα | Stretch / Lengthen | — |

**Συγκεκριμένο παράδειγμα (lead-with-concrete):** τετράγωνο 1×1m. Κλικ κορυφή κάτω-αριστερά → hover →
«Convert to Arc» → εμφανίζεται λαβή τόξου στο μέσο της κάτω πλευράς (apex) → σύρω προς τα κάτω →
`bulges[0]: 0 → 0.41` (τεταρτοκύκλιο) live → «Convert to Line» στη λαβή τόξου → `bulges[0]: 0.41 → 0`.
**Κάθε ενέργεια = ΕΝΑ undo βήμα.**

**Ανοιχτό decision (κλείδωσέ το με τον Giorgio, lead-with-concrete):** τι **default bulge** βάζει το «Convert to Arc»;
Πρόταση: ξεκίνα με μικρό αισθητό τόξο (π.χ. `bulge=0.5` ≈ 53° ή sagitta=10% χορδής) **και μπες ΑΜΕΣΩΣ σε bulge-drag**
(Revit/AutoCAD style) ώστε ο χρήστης να ορίσει την καμπυλότητα με το χέρι.

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΗ ΥΛΟΠΟΙΗΣΗ Φ3c (reuse-first, SSoT)

1. **Grip discriminator (PolylineRenderer.getGrips).** Tag τα grips: vertex → `polylineGripKind='vertex'`·
   edge-midpoint → ευθύ τμήμα `'segment-midpoint'` (chord midpoint)· τόξο `'arc-midpoint'` **στο `bulgeApexPoint(p0,p1,bulge)`**
   (ΟΧΙ chord midpoint). Πρόσθεσε `polylineGripKind?` στο `GripInfo`/`UnifiedGripInfo`.
2. **Context menu MOD (PURE).** Επέκτεινε `buildVertexOpsSection` να αναγνωρίζει `polylineGripKind` → polyline-ops
   section ανά τύπο λαβής (vertex: Add/Remove/Convert-to-Arc· segment-midpoint: Add/Convert-to-Arc· arc-midpoint:
   Convert-to-Line). Πρόσθεσε στο `grip-context-menu-actions` τα bind cases `'polyline-ops:addVertex|removeVertex|
   convertToArc|convertToLine'` → `ctx.onPolylineVertexOp(grip, op)`. **i18n el+en ΠΡΩΤΑ** (keys στα locale JSON, ΟΧΙ defaultValue).
3. **Commands.** Add → reuse `AddVertexCommand`· Remove → reuse `RemoveVertexCommand`· Convert-to-Arc/Line + bulge-drag
   → **NEW `SetBulgeCommand`** (sets `bulges[segIdx]`· convert-to-line = 0· merge = `MoveVertexCommand` pattern
   `segIdx+isDragging+merge-window` για live drag). Reuse `merge-window.ts`/`snapshot-geometry.ts` (ADR-507 §8).
4. **Adapter extension (ISceneManager — SSoT seam).** NEW `updateVertexBulge(entityId,segIdx,bulge)` (+ width αργότερα
   Φ3d)· Add/Remove να κρατούν `bulges/startWidths/endWidths` **index-aligned** (insert/remove στο ίδιο index, default 0).
   Υλοποίηση σε `grip-scene-adapter.ts` **και** `LevelSceneManagerAdapter.ts`.
5. **Wiring.** Δώσε `ctx.onPolylineVertexOp` εκεί που δίνεται το `onSlabVertexOp` (grip context-menu controller)·
   dispatch → φτιάχνει command → `execute()` (undoable, 1 βήμα). Bulge-drag: arc-midpoint grip drag →
   `bulgeFromApexPoint(p0,p1,cursor)` → `SetBulgeCommand(isDragging=true)` coalesced.
6. **jest + ADR changelog ανά υπο-βήμα.** ⚠️ grip/render αρχεία → **stage ADR-040** (CHECK 6B/6D).

---

## 4. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **Commit: ΜΟΝΟ ο Giorgio.** `git add` ΜΟΝΟ δικά σου αρχεία (shared tree· `types/entities.ts` & grip files = κοινά).
- **⚠️ ADR-040 CHECK 6B/6D:** PolylineRenderer/BaseEntityRenderer/PhaseManager/GripPhaseRenderer/DxfRenderer/canvas-v2
  → **stage ADR-040** μαζί. Event handlers = getters (ΟΧΙ snapshots). Orchestrators ΧΩΡΙΣ `useSyncExternalStore`.
- **N.17 single tsc:** πριν τρέξεις tsc έλεγξε ότι δεν τρέχει άλλος (`Get-CimInstance ... node.exe ...tsc`). ΕΝΑ τη φορά.
- **i18n el+en** για κάθε νέο label (N.11) — keys ΠΡΩΤΑ στα locale JSON.
- **Μηδέν `any`/`as any`/`@ts-ignore`.** ≤500 γρ./αρχείο, ≤40/συνάρτηση. Enterprise IDs αν δημιουργείς οντότητες.
- **SSoT audit (grep) ΠΡΙΝ από ΚΑΘΕ νέο module** — re-grep ανά domain, reuse, μηδέν διπλότυπα.

---

## 5. VERIFICATION
1. jest: νέο `SetBulgeCommand` + adapter bulge-aware + regression στα vertex-command tests + Φ3a/Φ3b (35) GREEN.
2. tsc (N.17).
3. Browser `/dxf/viewer`: σχεδίασε polyline → grip κορυφής → **Convert to Arc** → σύρε bulge → **Convert to Line** →
   **Add/Remove Vertex** → κάθε ενέργεια **undo (1 βήμα)**. (Variable width = Φ3d· export = Φ9.)
4. Commit **ΜΟΝΟ ο Giorgio**.

---

## 6. ΜΕΘΟΔΟΛΟΓΙΑ (ο Giorgio θα σε ελέγξει σκληρά για SSoT)
Μετά από κάθε κομμάτι περίμενε: «κεντρικοποιημένο; υπάρχει ήδη SSoT; διπλότυπο; θα το έκανε έτσι η Google;».
**Απάντα με grep evidence, ΟΧΙ με λόγια.** Αν φτιάξεις κάτι που υπάρχει ήδη → παραδέξου & διόρθωσε αμέσως (reuse).
100% ειλικρίνεια. Μετά την υλοποίηση: update ADR-510 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + `pending-ratchet-work.md`
+ MEMORY (N.15), όλα στο ίδιο commit με τον κώδικα.

**ΕΠΟΜΕΝΑ μετά Φ3c:** Φ3d μεταβλητό πλάτος (tapered render + DXF 40/41), Φ3e endpoint Stretch/Lengthen (reuse
`LengthenCommand` ADR-349), Φ9 DXF round-trip 42/40/41.
