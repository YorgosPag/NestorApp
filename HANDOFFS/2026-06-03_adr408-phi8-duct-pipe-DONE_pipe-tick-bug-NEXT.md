# HANDOFF — ADR-408 Φ8 Duct/Pipe DONE · ΕΠΟΜΕΝΟ: bug «μεγάλη κάθετη γραμμή στον σωλήνα»

**Ημερομηνία:** 2026-06-03
**Μοντέλο:** Sonnet 4.6 αρκεί (1 αρχείο, καθαρό bugfix units). Opus μόνο αν θες ταυτόχρονα refactor.
**Σχετικό ADR:** ADR-408 §Φ8 (`docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md`).

---

## ⚠️ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)
- 🌐 **Ελληνικά πάντα.**
- 🚫 **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`. (N.(-1))
- 🌳 **SHARED working tree με άλλον agent (ADR-412 BIM family types + ADR-410 sofas).** `git add` **ΜΟΝΟ** τα δικά σου αρχεία· **ΠΟΤΕ** `git add -A`.
- 🐞 **ΓΝΩΣΤΑ tsc errors που ΔΕΝ είναι δικά σου (μην τα «διορθώσεις» ως δικά σου):**
  - `bim-3d/converters/mesh-to-object3d.ts:124` — pre-existing matId:string (committed `de57f9d5`).
  - `ui/ribbon/components/EditWallTypeDialog.tsx:52` — `WallDna` not exported, **WIP του ADR-412 agent** (wall-types refactor).
- 🔬 **tsc:** `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit` (ΑΛΛΙΩΣ OOM → ΨΕΥΔΩΣ «0 errors»). Περίμενε ΑΚΡΙΒΩΣ τα 2 παραπάνω + 0 νέα.

---

## 📦 ΤΙ ΕΓΙΝΕ (ADR-408 Φ8 — DUCT/PIPE ELEMENT PIPELINE) — pending commit (Giorgio), 🔴 browser verify

ΕΝΑ **ενοποιημένο** linear MEP entity `type: 'mep-segment'` με 2 ορθογώνιους discriminators:
- `domain: 'duct' | 'pipe'` → discipline (mechanical/plumbing) + BimCategory + IFC (`IfcDuctSegment`/`IfcPipeSegment`) + BOQ.
- `sectionKind: 'rectangular' | 'round'` → swept διατομή (rect extrude / circle sweep).

(Απόφαση Giorgio: ΕΝΑ entity, ΟΧΙ δύο — όπως το δοκάρι ενοποίησε rectangular+I-shape. Template = **ΔΟΚΑΡΙ**, γραμμικό 2-click, units-safe `MM_TO_M` basis-matrix sweep· elevation = centreline «Middle Elevation».)

**Pipeline πλήρες:** placement (2-click tool `useMepSegmentTool`, εργαλεία `mep-duct`/`mep-pipe`) → persist (`setDoc` + `generateMepSegmentId`, collection `FLOORPLAN_MEP_SEGMENTS`) → 2D (`MepSegmentRenderer`) → 3D (`mep-segment-to-mesh` + `BimSceneLayer.syncMepSegments`) → BOQ/audit/delete/restore/grips/ghost. ~34 global registrations + ribbon 2 buttons (Αεραγωγός DU / Σωλήνας PP) + i18n el/en.
**Tests:** `mep-segment-geometry.test` **15/15 PASS**. tsc **0** στα δικά μου.
**STAGE ADR-040** (CHECK 6B `BimSceneLayer`/`canvas-layer-stack-leaves` + 6D ghost renderers) μαζί με ADR-408.

**Deferred (roadmap):** duct/pipe **systems** (grouping+routing — αντίστοιχο Φ2/Φ7 electrical)· contextual props tab (edit size/elevation)· 3D 2-click placement.

---

## 🐞 ΤΟ BUG ΠΟΥ ΘΑ ΔΙΟΡΘΩΣΕΙΣ — «μεγάλη κάθετη γραμμή στον σωλήνα»

**Συμπτωμα (Giorgio):** όταν σχεδιάζεις **σωλήνα**, κάθετα σε αυτόν στο μέσον εμφανίζεται μια **πολύ μεγάλη γραμμή**.

**Τι είναι:** ΟΧΙ bug placement — είναι το **σύμβολο σωλήνα** by-design (plumbing convention: κάθετο tick στο midpoint που δηλώνει την κυκλική διατομή). Ζωγραφίζεται από:
- `src/subapps/dxf-viewer/bim/mep-segments/mep-segment-symbol.ts` → `buildSegmentSymbol()` (pipe branch, γρ. 81-102)
- το οποίο καταναλώνει ο `src/subapps/dxf-viewer/bim/renderers/MepSegmentRenderer.ts` (`render()`).

**ROOT CAUSE (units bug — ίδια κλάση με τα γνωστά meter-scale issues):** στο `mep-segment-symbol.ts` γρ. **92-94**:
```ts
const MIN_TICK_HALF = 4;   // ← world units!
const MAX_TICK_HALF = 20;  // ← world units!
const tickHalf = Math.min(MAX_TICK_HALF, Math.max(MIN_TICK_HALF, outlineHalfWidth * 0.7));
```
Το `tickHalf` είναι σε **world canvas units**, αλλά το clamp `[4, 20]` είναι **absolute σταθερές**. Σε σχέδιο **μέτρων** (`sceneUnits='m'`) το `MIN_TICK_HALF = 4` σημαίνει **4 μέτρα** → τεράστια κάθετη γραμμή. (Σε mm-scene θα ήταν 4mm = μικροσκοπικό· γι' αυτό «δουλεύει» σε κάποια σχέδια αλλά όχι σε meter-scene.) Επιπλέον το `outlineHalfWidth` (γρ. 85-89) βγαίνει από το `geometry.bbox` με `Math.min` των X/Y spans — για λεπτό σωλήνα = το section width σε canvas units (π.χ. 0.05 σε m-scene) → το clamp `MIN_TICK_HALF` κυριαρχεί.

**ΣΩΣΤΗ ΛΥΣΗ (διάλεξε, προτίμησε Α):**

- **(Α) Screen-constant tick (ΣΩΣΤΟ «σαν Revit», zoom-independent) — ΠΡΟΤΕΙΝΟΜΕΝΟ:** βγάλε το tick από το pure symbol SSoT και ζωγράφισέ το **render-time** στον `MepSegmentRenderer` με **σταθερό μήκος σε pixels** (π.χ. ~10px half), εφαρμόζοντας το `transform.scale` (μοτίβο grips/handles — δες πώς το κάνουν τα grip glyphs ή το `MepWireRenderer` conductor ticks `mep-wire-conductor-ticks.ts` που είναι ΗΔΗ screen-space). Έτσι το tick φαίνεται ίδιο σε κάθε zoom/scene.
- **(Β) Unit-safe χωρίς absolute clamp (γρήγορο, λιγότερο τέλειο):** `tickHalf = outlineHalfWidth` (όσο το μισό section width, μηδέν absolute clamp) → κλιμακώνεται σωστά με το scene· ΟΜΩΣ σε πολύ λεπτό σωλήνα γίνεται ανεπαίσθητο σε zoom-out. Αν κρατήσεις clamp, κάν' το **σε mm** και πέρασέ το από `mmToSceneUnits(params.sceneUnits)` ώστε να είναι unit-safe.

**Επαλήθευση:** σχεδίασε σωλήνα σε σχέδιο **μέτρων** ΚΑΙ σε σχέδιο **mm** → το tick να φαίνεται μικρό/λογικό και στα δύο, ανεξάρτητα zoom. Πρόσθεσε/επέκτεινε test στο `mep-segment-geometry.test` ή νέο `mep-segment-symbol.test` (assert tickHalf ≈ ίδιο visual size σε mm vs m scene).

**ΕΚΤΑΣΗ:** 1 αρχείο (`mep-segment-symbol.ts`) ή 2 (αν πας screen-space → +`MepSegmentRenderer.ts`). Καθαρό, isolated. **MepSegmentRenderer ζει στο `bim/renderers/`** (όπως MepWireRenderer) → **ΕΚΤΟΣ** CHECK 6D pattern (`rendering/entities/`) → **ΔΕΝ χρειάζεται ADR-040 staging** αν αγγίξεις μόνο αυτά τα δύο.

---

## 📎 ΠΡΩΤΑ ΒΗΜΑΤΑ (νέα συνεδρία)
1. Διάβασε `mep-segment-symbol.ts` (γρ. 81-102) + δες πώς ο `MepSegmentRenderer.render()` το ζωγραφίζει.
2. Δες το `bim/mep-systems/mep-wire-conductor-ticks.ts` ως πρότυπο **screen-space tick** (Α).
3. Fix (Α ή Β) + unit-parity test (mm vs m).
4. `NODE_OPTIONS=8GB tsc` (περίμενε ΜΟΝΟ τα 2 known errors) + `npx jest "mep-segment"`.
5. Πες στον Giorgio: browser verify (σωλήνας σε meter-scene + mm-scene) + commit (λίστα δικών σου αρχείων· STAGE μόνο αυτά).

---

## ⚠️ COMMIT (το κάνει ο Giorgio) — staging list Φ8 (μόνο αν δεν έγινε ήδη commit)
NEW: `bim/types/mep-segment-types.ts` · `mep-segment.schemas.ts` · `bim/geometry/mep-segment-geometry.ts` · `bim/geometry/shared/round-profile.ts` · `bim/geometry/__tests__/mep-segment-geometry.test.ts` · `bim/mep-segments/*` (firestore-service, audit-client, add-to-scene, grips, symbol, GhostRenderer) · `bim/renderers/MepSegmentRenderer.ts` · `bim-3d/converters/mep-segment-to-mesh.ts` · `hooks/drawing/mep-segment-completion.ts` + `useMepSegmentTool.ts` · `hooks/data/useMepSegmentPersistence.ts` · `hooks/tools/useMepSegmentGhostPreview.ts` · `app/MepSegmentPersistenceHost.tsx` · `core/commands/entity-commands/UpdateMepSegmentParamsCommand.ts` · `services/factories/mep-segment.factory.ts` · `components/dxf-layout/canvas-layer-stack-mep-segment-ghost.tsx`
MOD (registrations — δες ΕΚΚΡΕΜΟΤΗΤΕΣ Φ8 entry για πλήρη λίστα· **STAGE ADR-040** για BimSceneLayer/canvas-layer-stack-leaves/draw-ghost-entity/apply-entity-preview) + ADR-408 + ΕΚΚΡΕΜΟΤΗΤΕΣ.
⚠️ `enterprise-id-*` / `firestore-collections.ts` / `firestore.rules` co-edited με ADR-412 → ξεμπλέκεις τα hunks. Πρόσθεσα Boy-Scout `bim_family_type: ''` σε `propagate-entity-rename/route.ts` + `incremental-backup.service.ts` (ADR-412 incomplete maps) — αν τα θες στο δικό τους commit, μετάφερέ τα.
