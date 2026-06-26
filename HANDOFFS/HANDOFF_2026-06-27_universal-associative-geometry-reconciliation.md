# HANDOFF — Universal Associative Geometry Reconciliation (SSoT)

> **STATUS:** READY TO START (Plan Mode). Νέο μεγάλο cross-cutting refactor + 4 UNCOMMITTED fixes από την προηγούμενη συνεδρία (να μη χαθούν/αλλοιωθούν).
> **Ημερομηνία:** 2026-06-27
> **Commit:** ❌ ΜΟΝΟ ο Giorgio (N.(-1)). Ο agent ΠΟΤΕ δεν κάνει commit/push.
> **⚠️ SHARED WORKING TREE:** Το working tree μοιράζεται με ΑΛΛΟΝ agent. Πριν από κάθε `git add` → `git status`/`git diff` και **stage ΜΟΝΟ τα δικά σου αρχεία** (ποτέ `git add -A`). Μην αγγίξεις/σβήσεις αλλαγές που δεν αναγνωρίζεις.

---

## 🎯 ΤΟ ΖΗΤΟΥΜΕΝΟ (νέο task)

Ο Giorgio θέλει να **γενικευτεί** η διόρθωση «οι λαβές/γεωμετρία εξαρτημένων μελών μένουν stale μετά από αλλαγή» ώστε **να μη συμβαίνει ΠΟΤΕ, για ΚΑΜΙΑ BIM οντότητα**.

Στόχος: **ΕΝΑ κεντρικό SSoT** «associative geometry reconciliation» που τρέχει μετά από **ΚΑΘΕ** geometry-mutating command, ώστε τα εξαρτημένα μέλη να ακολουθούν πάντα → οι λαβές (που διαβάζουν τα params) να είναι **πάντα** στη σωστή θέση.

**Ποιότητα:** Revit / Maxon (Cinema 4D)-grade. **FULL ENTERPRISE + FULL SSoT.** Μηδέν διπλότυπα.
**ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΤΟΝ ΚΩΔΙΚΑ:** πραγματικό **SSoT audit (grep)** για επαναχρήση υπάρχοντος κώδικα (βλ. §SSoT AUDIT παρακάτω).

---

## 🔍 Η ΓΕΝΙΚΗ ΡΙΖΑ (audit προηγούμενης συνεδρίας — επιβεβαιωμένο)

Το «πρόβλημα stale λαβών» **δεν** είναι UI bug. Είναι ότι τα **params εξαρτημένων μελών δεν re-derive-άρονται** όταν αλλάζει η σχετική γεωμετρία. Οι λαβές υπολογίζονται σωστά από τα params (`computeDxfEntityGrips`) — αλλά τα params είναι stale.

Υπάρχουν **5 associative-geometry cascades**, καθένα ΗΔΗ σε ΕΝΑ module:

| # | Cascade module | Re-derives | Entry function |
|---|---|---|---|
| 1 | `bim/walls/wall-opening-coordinator.ts` | ανοίγματα ακολουθούν τοίχο | `cascadeHostedOpeningsForWalls(wallIds)` |
| 2 | `bim/beams/beam-column-reframe-cascade.ts` | άκρα δοκαριού → παρειές κολόνας | `cascadeBeamReframe(ids)` / `reframeBeamsAndEmit(...)` |
| 3 | `bim/mep-segments/cascade-connected-pipes.ts` | σωλήνες → connectors | `cascadeConnectedPipes(ids, computeNext)` |
| 4 | `bim/cascade/cascade-transformed-slab-openings.ts` | τρύπες πλάκας ακολουθούν πλάκα | `cascadeTransformedSlabOpenings(ids, computePatch)` |
| 5 | `bim/walls/wall-structural-attach-coordinator.ts` | (μόνο **detection**/warning σε host delete) | `notifyWallsOnHostDeletion(ids)` |

**ΤΟ ΚΕΝΟ (= η ρίζα όλων των bugs):**
- Τα 4 geometry cascades τρέχουν **command-time ΜΟΝΟ μέσα στο `core/commands/entity-commands/SnapshotTransformCommand.ts`** (base των Move/Rotate/Scale/Mirror) + το wall-opening cascade τρέχει επιπλέον σε 5 wall commands (`UpdateWallParams`, `AssignWallType`, `AttachWallsTop/Base`, `DetachWalls`).
- **Τα `UpdateColumnParamsCommand` / `UpdateBeamParamsCommand` / `UpdateFoundationParamsCommand` ΔΕΝ τρέχουν ΚΑΝΕΝΑ cascade.** Γι' αυτό η **προαγωγή σε Γ** (που είναι `UpdateColumnParamsCommand`) δεν reframe-άρισε το δοκάρι → stale λαβές. (Το μπαλώσαμε ad-hoc μέσα στο `useColumnBeamPromote` — βλ. Task C — αλλά αυτό είναι ΑΚΡΙΒΩΣ ο σκόρπιος κώδικας που πρέπει να εξαλειφθεί.)

**Άλλα ευρήματα:**
- `systems/events/emit-bim-entity-params-updated.ts` = kind→event SSoT (ΗΔΗ υπάρχει, ~20 entity types). Reuse.
- `hooks/useStructuralOrganism.ts` = central event hub (`ORGANISM_EVENTS` named array) — proactive **analysis** (M/V/N, reinforce), ΟΧΙ geometry reconciliation. **ΜΗΝ** βάλεις το reconcile εδώ ως reactive (βλ. κίνδυνο).
- **Grips refresh:** 2D = `hooks/grips/grip-registry.ts` `useMemo` (auto-reactive όταν αλλάζει το scene entity). 3D = `bim-3d/animation/bim3d-grip-drag.ts` `refreshReshapeGrips(...)` (καλείται on selection — **πρέπει να επιβεβαιωθεί** ότι ξανατρέχει όταν αλλάζει η γεωμετρία ΕΝΩ είναι επιλεγμένο· πιθανό δευτερεύον κενό).

**⚠️ ΚΡΙΣΙΜΟΣ ΚΙΝΔΥΝΟΣ — ADR-492 §4 (freeze):** Ένα **reactive effect** που ακούει `bim:entities-moved`/`bim:*-params-updated` και **ξαναεκπέμπει** geometry event → βρόχος με τον proactive analysis cycle → **storm/freeze** στο «Ανάλυση». Το reconcile SSoT **ΠΡΕΠΕΙ** να τρέχει **command-time** (σύγχρονα, ΕΝΑ emit), ΟΧΙ ως reactive listener. Αυτό είναι ήδη το pattern· κράτησέ το.

---

## 🏗️ ΠΡΟΤΕΙΝΟΜΕΝΟ ΣΧΕΔΙΟ (Plan Mode — προς επικύρωση Giorgio)

1. **SSoT AUDIT (grep) ΠΡΩΤΑ** — επιβεβαίωσε τα 5 cascades + ψάξε για επιπλέον associative re-derivations που ίσως ξέφυγαν (column foot↔beam `resyncPromotedBoundaryArmsForBeam`, stair host, railing host, mep manifold, thermal-space, space-separator, slab-opening host-lookup). Στόχος: πλήρης λίστα «όταν αλλάζει το Α, ποιο Β re-derive-άρεται».
2. **Νέο SSoT module** `reconcileAssociativeGeometry(changedEntityIds, sceneManager)` (π.χ. `bim/cascade/associative-geometry-reconcile.ts`):
   - Τρέχει **ΟΛΑ** τα cascades σε σωστή **dependency order** (π.χ. column/wall reframe ΠΡΙΝ openings που εξαρτώνται).
   - **Idempotent** (αμετάβλητο → null/skip, μηδέν churn), επιστρέφει ΟΛΑ τα cascaded entities για **ΕΝΑ** `bim:entities-moved` emit.
   - Reuse τα 5 υπάρχοντα cascade modules (ΜΗΝ τα ξαναγράψεις — delegate).
3. **ΕΝΑ command-time σημείο κλήσης** (όχι σκόρπιο): ιδανικά μια κοινή βάση/hook που τρέχει μετά το `applyPatch` **κάθε** geometry-mutating command (Snapshot transform ΚΑΙ Update*Params ΚΑΙ Attach/Detach). Διερεύνησε `MergeableUpdateCommand` (base των Update*Params) + `SnapshotTransformCommand` για κοινό ancestor / hook point.
   - **Undo/redo ordering:** κράτησε το race-guard pattern (`emitRestoredEntities` πρώτα → restore → reconcile → emit· βλ. `beam-column-reframe-cascade.ts`).
4. **Κατάργησε τα σκόρπια call-sites** → delegate στο SSoT: το ad-hoc promote-fix (Task C `useColumnBeamPromote`), τα inline calls στο `SnapshotTransformCommand`, τα 5 wall commands. **Μετά το refactor το Task C reframe πρέπει να γίνεται αυτόματα από το SSoT** (αφαίρεσε το ad-hoc, αν το SSoT το καλύπτει).
5. **Grip refresh σύνδεση:** εξασφάλισε ότι μετά το reconcile οι 3D λαβές (`refreshReshapeGrips`) + 2D (auto useMemo) δείχνουν τη νέα γεωμετρία.
6. **Tests** (colocated, Google presubmit-grade) + **νέο ADR** «Universal Associative Geometry Reconciliation» (επόμενο ελεύθερο ADR — έλεγξε `docs/centralized-systems/reference/adrs/` + adr-index· >535).

---

## 📦 UNCOMMITTED αλλαγές προηγούμενης συνεδρίας (4 ανεξάρτητα σύνολα — ΜΗ ΧΑΘΟΥΝ)

Όλα GREEN στα jest, tsc SKIP (N.17 full-project OOM — verified via colocated/ts-jest). **Commit = Giorgio.**

**Task A — ADR-535 Φ9: 3D reshape λαβές για ΔΟΚΑΡΙΑ** (mirror Φ7/Φ8 + αφαίρεση cyan endpoint rings)
- `bim-3d/animation/bim3d-grip-preview-builders.ts` (νέο `buildBeamReshapePreviewObject` + imports)
- `bim-3d/animation/bim3d-grip-drag.ts` (`RESHAPE_BIM_TYPES`+='beam', bbox elevations, dispatch)
- `bim-3d/grips/grip-3d-reshape-grips.ts` (filter += `beamGripKind`, εξαίρεση `beam-rotation`)
- `bim-3d/grips/grip-3d-commit.ts` (forward `beamGripKind`)
- `bim-3d/gizmo/bim-gizmo-overlay.ts` (αφαίρεση `beam` από `ENDPOINT_HANDLES_BY_TYPE`)
- tests: `grip-3d-reshape-grips.test.ts`, `bim-gizmo-overlay.test.ts`, `bim3d-grip-preview-builders.test.ts`
- doc: `ADR-535` (Φ9 phase row + changelog)

**Task B — ADR-529 §top-attach-fix: πόδι Γ «έπεφτε» στο soffit στο 3D**
- `bim/geometry/column-vertical-profile.ts` (`classifyTopHosts`: host `hostType==='beam'` → ΠΑΝΤΑ framing, ΠΟΤΕ covering)
- test: `bim/geometry/__tests__/column-vertical-profile.test.ts` (helpers default `hostType:'slab'` + 3 beam-framing tests)
- doc: `ADR-529` changelog §top-attach-fix

**Task C — ADR-529 §reframe: λαβές δοκαριού stale μετά την προαγωγή** ⚠️ *ad-hoc — θα ενσωματωθεί στο νέο SSoT*
- `hooks/useColumnBeamPromote.ts` (reframe του προαχθέντος δοκαριού μετά τα promotion commands + διόρθωση λάθος doc)
- test: `bim/beams/__tests__/beam-column-reframe.test.ts` (+2 ADR-529 cases: endpoint→νέα παρειά· idempotent)
- doc: `ADR-529` changelog §reframe

**Task D — ADR-535 Φ9 fix: δοκάρι έδειχνε ΠΡΑΣΙΝΕΣ reshape λαβές**
- `bim-3d/grips/grip-3d-twin-overlay.ts` (`buildTwinSurfaceConfigs`: render-type `'edge'→'vertex'` → μπλε square, match 2D + κολόνες· `'midpoint'` insert grips αμετάβλητα)
- test: `bim-3d/grips/__tests__/grip-3d-twin-overlay.test.ts` (+render-type case)
- doc: `ADR-535` changelog (Φ9 fix)

> 🔴 Όλα τα παραπάνω εκκρεμούν **browser-verify + commit (Giorgio)**. Όταν γίνει commit, αυτό το handoff μένει ως ιστορικό του πλαισίου.

---

## 🚦 ΚΑΝΟΝΕΣ (μην τους παραβείς)
- **Commit/push = ΜΟΝΟ Giorgio** (N.(-1)). Ποτέ `git add -A` (shared tree).
- **SSoT audit (grep) ΠΡΙΝ τον κώδικα** (N.0 / N.12). Reuse, μηδέν διπλότυπα.
- **ADR-driven** (N.0.1): διάβασε κώδικα → ενημέρωσε/φτιάξε ADR → υλοποίηση → ξανα-ADR.
- **ADR-492 §4:** reconcile = command-time, ΟΧΙ reactive (freeze).
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε διεργασία πριν· shared computer).
- **N.8:** είναι Orchestrator-class (5+ files, 2 domains) → Plan Mode + έγκριση Giorgio πριν μαζική υλοποίηση.
- **Γλώσσα:** απαντάς ΠΑΝΤΑ στα Ελληνικά.

## 🔎 SSoT AUDIT — έτοιμα grep (τρέξε ΠΡΩΤΑ)
- Cascades/coordinators: `grep -rE "cascade|reframe|retrim|resync|coordinator|reconcile" src/subapps/dxf-viewer/bim --include=*.ts -l`
- Command call-sites: `grep -rn "cascade\|reframe\|cascadeHostedOpenings\|reframeBeamsAndEmit\|cascadeConnectedPipes\|cascadeTransformedSlabOpenings" src/subapps/dxf-viewer/core/commands`
- Command bases: `SnapshotTransformCommand.ts`, `MergeableUpdateCommand` (κοινός ancestor;)
- Grip refresh: `grep -rn "refreshReshapeGrips\|computeDxfEntityGrips" src/subapps/dxf-viewer`
- Event hubs: `hooks/useStructuralOrganism.ts` (`ORGANISM_EVENTS`), `systems/events/emit-bim-entity-params-updated.ts`
