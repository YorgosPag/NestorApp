# HANDOFF — Phase 3: Transform pipe self-cascade (ADR-049/ADR-408 Φ-C/ADR-507 §8) — «reactions live IN the command» για ROTATE/SCALE/MIRROR

**Ημ/νία:** 2026-06-21 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **COMMIT/PUSH = ΜΟΝΟ ο Giorgio (N.-1) — ΟΧΙ εσύ.**
> ⚠️ **Shared working tree** με άλλον agent. `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. Πριν edit κάθε αρχείου → `git status` σ' αυτό.
> ⚠️ **N.17 (ΕΝΑ tsc τη φορά):** πριν τρέξεις tsc έλεγξε ότι δεν τρέχει άλλος (`Get-CimInstance Win32_Process … tsc`), μετά background.
> 🎯 **Giorgio:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ, ΟΠΩΣ Η REVIT. FULL ENTERPRISE + FULL SSOT.»

---

## 0. ΤΟ ΖΗΤΟΥΜΕΝΟ
Μετά το **Phase 2** (vertical move ενοποιήθηκε στο `MoveEntityCommand` — committed `a751c40b`), έμεινε **ΜΙΑ ασυμμετρία** στην αρχή «οι associative αντιδράσεις ζουν ΜΕΣΑ στο command, όχι ανά entry point» (ADR-487 organism vision):

- **MOVE** → το connected-pipe follow ζει **ΜΕΣΑ στο command** (`cascadeConnectedPipesByDelta` στο `move-entity-cascade.ts`, τρέχει σε execute/undo/redo). → ΚΑΘΕ χειρονομία (2D move-tool / drag / nudge / 3D gizmo) ακολουθεί pipes.
- **ROTATE / SCALE / MIRROR** → το pipe-follow ζει **ΜΟΝΟ στον 3D builder** (`withConnectedPipeFollow` wrapper, `bim3d-edit-command-builders.ts:210`). **Στο 2D (`useRotationTool`/`useScaleTool`/`useMirrorTool`) ΔΕΝ υπάρχει καθόλου** → 2D rotate/scale/mirror MEP host → τα συνδεδεμένα pipes **μένουν πίσω** (ακριβώς το bug που το move είχε πριν το ADR-049 Φ1).

**Phase 3 = φέρε το pipe self-cascade ΜΕΣΑ στο transform command spine** (`SnapshotTransformCommand`), ώστε rotate/scale/mirror να ακολουθούν pipes σε ΚΑΘΕ χειρονομία (2D+3D), και **αφαίρεσε** το `withConnectedPipeFollow` wrap από τον rotate builder. Revit: «connected ends move with the element» — σε όλους τους μετασχηματισμούς, όχι μόνο μετακίνηση.

---

## 1. 🔴 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ — ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
Shared tree — τα paths/γραμμές ίσως μετακινήθηκαν. Επιβεβαίωσε ότι (α) δεν υπάρχει ήδη transform-agnostic pipe-cascade SSoT, (β) ο resolver είναι όντως pose-based (rotation-ready), (γ) ο άλλος agent δεν αγγίζει τα ίδια αρχεία.

```
# Το pipe-propagation SSoT (pose-based, transform-AGNOSTIC — διάβασε το header του):
grep -rn "resolveHostMoveConnectedPipePatches\|resolveSegmentMoveConnectedPipePatches\|SegmentEndpointMovePatch" src/subapps/dxf-viewer/bim/mep-segments
# Ο move self-cascade engine προς ΓΕΝΙΚΕΥΣΗ (delta-based → transform-agnostic):
grep -rn "cascadeConnectedPipesByDelta\|cascadeMovedSlabOpenings" src/subapps/dxf-viewer
# Το spine όπου ΜΠΑΙΝΕΙ το cascade (rotate/scale/mirror base):
grep -rn "executeInPlace\|undoInPlace\|redoInPlace\|computeUpdates\|reframeBeamsAndEmit" src/subapps/dxf-viewer/core/commands/entity-commands/SnapshotTransformCommand.ts
# Το builder wrapper προς ΑΦΑΙΡΕΣΗ από rotate (+ ποιος ακόμα το χρησιμοποιεί):
grep -rn "withConnectedPipeFollow" src/subapps/dxf-viewer
# ΟΛΑ τα transform entry points (2D + 3D) που πρέπει να κερδίσουν το follow:
grep -rn "new RotateEntityCommand\|new ScaleEntityCommand\|new MirrorEntityCommand" src/subapps/dxf-viewer
# Rotate geometry SSoT (το «next params» για το follow):
grep -rn "calculateBimRotatedGeometry\|calculateBimScaledGeometry\|calculateBimMirroredGeometry" src/subapps/dxf-viewer
# Άλλος agent στα ίδια αρχεία;
git status --short src/subapps/dxf-viewer/core/commands/entity-commands/ src/subapps/dxf-viewer/bim/mep-segments/ src/subapps/dxf-viewer/bim-3d/animation/
```

**Δες ΚΑΙ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (το όραμα — reactions in command), `ADR-408` §Φ-C (pipe propagation), `ADR-507` §8 (SnapshotTransformCommand), `ADR-492` (reframe+emit), `ADR-049` (το move precedent που αντιγράφεις).

---

## 2. ΤΙ ΥΠΑΡΧΕΙ ΣΗΜΕΡΑ (χάρτης — ΧΡΗΣΙΜΟΠΟΙΗΣΕ, ΜΗΝ ΔΙΠΛΑΣΙΑΣΕΙΣ)

| SSoT (υπάρχον) | Ρόλος | Σχέση με Phase 3 |
|---|---|---|
| `bim/mep-segments/mep-move-propagation.ts` → `resolveHostMoveConnectedPipePatches` / `resolveSegmentMoveConnectedPipePatches` | **Pure, pose-based OLD→NEW retarget.** Header: «Match on OLD, retarget to NEW… **rotation is covered for free**». | **ΕΤΟΙΜΟΣ — μηδέν αλλαγή.** Παίρνει OLD entity + NEW params· δουλεύει για move/rotate/scale/mirror αδιάκριτα. |
| `bim/mep-segments/cascade-connected-pipes-by-delta.ts` → `cascadeConnectedPipesByDelta(ids, delta, sm)` | Ο **move** self-cascade. Υπολογίζει next μέσω `calculateBimMovedGeometry(entity, delta)`, καλεί τους resolvers, batch `updateEntities`, επιστρέφει moved pipes για το emit. | **ΓΕΝΙΚΕΥΣΕ** σε transform-agnostic engine (computeNext callback). |
| `core/commands/entity-commands/SnapshotTransformCommand.ts` | **Το spine** για Rotate/Scale/Mirror. `executeInPlace`/`undoInPlace`/`redoInPlace`: snapshot → `computeUpdates` patch → `updateEntities` → `cascadeHostedOpeningsForWalls` → `reframeBeamsAndEmit`. **ΔΕΝ** κάνει pipe-cascade ΟΥΤΕ slab-opening-cascade. | **ΕΔΩ μπαίνει** το pipe self-cascade. Έχει ήδη `computeUpdates(entity)` → από εκεί βγαίνει το next-params (μηδέν νέο callback). |
| `core/commands/entity-commands/move-entity-cascade.ts` → `runMoveForwardCascade`/`runMoveUndoCascade` | Ο **move** cascade host (Move ΔΕΝ extends SnapshotTransformCommand). Έχει ήδη pipes+slab-openings+reframe. | Θα καλεί τον **ίδιο γενικευμένο engine** (μηδέν divergence move vs transform). |
| `bim-3d/animation/bim3d-edit-command-builders.ts:136 `withConnectedPipeFollow` + `:208-210` rotate wrap | builder-level pipe-follow (3D ΜΟΝΟ). | **ΑΦΑΙΡΕΣΕ** το wrap από rotate (το command θα self-cascade-άρει). Κράτα το ΜΟΝΟ για `endpoint-move` (`:278`) — αυτό είναι Update-command stretch, εκτός scope (βλ. §3 σημείωση). |
| `bim/transforms/bim-rotate-geometry.ts` → `calculateBimRotatedGeometry(entity, pivot, angle)` | per-type rotate geometry (mirror του `calculateBimMovedGeometry`). | Το «computeUpdates» για το rotate· ήδη το χρησιμοποιεί το `RotateEntityCommand.computeUpdates`. |
| Entry points (ΟΛΑ κερδίζουν το follow αυτόματα όταν μπει στο spine): `hooks/tools/useRotationTool.ts` (×2), `useScaleTool.ts`, `useMirrorTool.ts` (×2) [2D]· `bim3d-edit-command-builders.ts` [3D gizmo] | χτίζουν Rotate/Scale/Mirror commands. **2D ΔΕΝ έχει σήμερα pipe-follow.** | Καμία αλλαγή στους tools — κερδίζουν το follow «δωρεάν» μέσω του spine (όπως το 2D move κέρδισε με το ADR-049 Φ1). |

---

## 3. Ο ΣΧΕΔΙΑΣΜΟΣ Phase 3 (Revit-grade, FULL SSoT)
**Αρχή:** ΕΝΑΣ transform-agnostic pipe-cascade engine, καλούμενος ΑΠΟ το command spine, ώστε ΚΑΘΕ transform (move/rotate/scale/mirror) σε ΚΑΘΕ χειρονομία (2D+3D) ακολουθεί pipes — με **reuse** του pose-based resolver (μηδέν νέα geometry math).

1. **Γενίκευσε τον engine.** NEW transform-agnostic `cascadeConnectedPipes(transformedIds, sceneManager, computeNextParams: (entity) => unknown | null)` (re-home/extend στο `cascade-connected-pipes-by-delta.ts` ή NEW `cascade-connected-pipes.ts`). Κράτα thin `cascadeConnectedPipesByDelta` wrapper για back-compat (move) που περνά `(e) => nextParamsFromPatch(calculateBimMovedGeometry(e, delta))`. **Reuse** `resolveHostMoveConnectedPipePatches`/`resolveSegmentMoveConnectedPipePatches` ΑΥΤΟΥΣΙΟΥΣ (pose-based).
2. **Inject στο spine.** Στο `SnapshotTransformCommand.executeInPlace` (πριν το `updateEntities`, OLD→NEW anchors — όπως ο move), κάλεσε τον engine με `computeNextParams = (entity) => nextParamsFromPatch(this.computeUpdates(entity))`. Το `computeUpdates` ΕΙΝΑΙ «εφάρμοσε τον μετασχηματισμό μου σε αυτή την οντότητα» για ΚΑΘΕ subclass (rotate/scale/mirror) → ΕΝΑ μονοπάτι, μηδέν per-type branching. Πρόσθεσε τα moved pipes στη λίστα του `reframeBeamsAndEmit` (να μπουν στο ΕΝΑ `bim:entities-moved` → persist μέσω `useMepSegmentPersistence`/`useBimEntityMovedPersistEffect`).
3. **🔴 Undo symmetry (ΤΟ ΚΡΙΣΙΜΟ DESIGN GATE).** Το spine `undoInPlace` **restore-άρει hosts από snapshot** (όχι inverse-compute, αντίθετα με τον move που κάνει `reverseDelta`). Τα follower pipes ΔΕΝ είναι στο `entityIds` (δεν snapshot-άρονται από το command). Δύο επιλογές — **διάλεξε & τεκμηρίωσε**:
   - **(Α) Snapshot-symmetric (ΣΥΝΙΣΤΩΜΕΝΟ — ταιριάζει με τη φιλοσοφία του spine):** στο execute κράτα snapshots ΚΑΙ των followed pipes· στο undo restore-άρε τα από snapshot (μαζί με τα hosts). Καθαρό, μηδέν inverse math.
   - **(Β) Inverse-transform (mirror του move):** τρέξε τον engine στο undo με inverse computeNext (rotate −angle / scale 1÷factor / mirror=self-inverse). Απαιτεί ανά-subclass inverse — λιγότερο καθαρό.
   Δες πώς το `move-entity-cascade.runMoveUndoCascade` το λύνει (reverseDelta) ΚΑΙ το `undoInPlaceWith` — αλλά εδώ προτίμησε (Α) γιατί το spine είναι snapshot-restore-based.
4. **Αφαίρεση builder wrap.** Στο `bim3d-edit-command-builders.ts` το rotate branch (`:208-210`) → απλό `new RotateEntityCommand(...)` χωρίς `withConnectedPipeFollow` (το command self-cascade-άρει τώρα). Κράτα το `withConnectedPipeFollow` ΜΟΝΟ για το `endpoint-move` (Update-command stretch ενός άκρου — διαφορετικό domain, εκτός scope· αν μείνει μοναδικός χρήστης, OK).

**🟡 Σχετικό gap — slab-opening on transform (απόφαση: include ή gate):** Το spine ΔΕΝ κάνει ούτε slab-opening cascade → **rotate/scale slab με openings → τα openings μένουν πίσω** (ο move τα κουμπώνει μέσω `cascadeMovedSlabOpenings`). Πλήρες SSoT = γενίκευσε ΚΑΙ αυτό (`cascadeTransformedSlabOpenings(slabIds, sm, (op)=>this.computeUpdates(op))` — ο ΙΔΙΟΣ μετασχηματισμός στα openings). Αν το scope-άρεις χωριστά, **κατάγραψέ το ρητά** (μην το αφήσεις σιωπηλά — N.0.2).

**Scope check (ΡΩΤΑ τον Giorgio αν αμφιβάλλεις):** το spine-inject δίνει pipe-follow αυτόματα σε **rotate ΚΑΙ scale ΚΑΙ mirror**. Επιθυμητό (Revit: mirror/scale connected = follow). Επιβεβαίωσε ότι το θες και στα 3, ή gate σε rotate-only.

---

## 4. ΕΠΑΛΗΘΕΥΣΗ (Revit-grade — DB ground-truth)
- **DB:** Firestore `entity_audit_trail` (`mcp__firestore__*`), orderBy `timestamp` desc, reconstruct latest ανά `entityId`. Test floor `lvl_21982f3b` «Ισόγειο», companyId `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`, ύψος 3000mm. «ΔΕΣ ΤΩΡΑ» = ξανατράβα.
- **Browser:** **2D** rotate/mirror MEP host (manifold/fixture/radiator…) με συνδεδεμένο pipe → το pipe **ακολουθεί** (δεν μένει πίσω) + persist reload-survives + `Ctrl+Z` ΕΝΑ βήμα. **3D** gizmo rotate → ίδια συμπεριφορά (αλλά τώρα από command, όχι wrapper). Scale/mirror αντίστοιχα. Rotate slab με slab-opening → openings ακολουθούν (αν κάνεις το §3 🟡).

## 5. TESTS (πράσινα πριν & μετά)
```
npx jest src/subapps/dxf-viewer/bim/mep-segments/__tests__/        # cascade + propagation
npx jest src/subapps/dxf-viewer/core/commands/entity-commands/__tests__/  # Rotate/Scale/Mirror + SnapshotTransform
```
+ ΝΕΑ tests: `cascadeConnectedPipes` transform-agnostic (rotate/scale next-params)· spine self-cascade (rotate MEP host → pipe patch στο emit)· undo επαναφέρει τα pipes· 2D rotate path follow.
**Pre-existing (ΟΧΙ δικά σου):** `AssignWallTypeCommand «undo before execute»` + ~10 tsc errors άλλων agents σε beam/structural/foundation/converters/ribbon (shared tree· αγνόησέ τα — επιβεβαίωσε ότι ΚΑΝΕΝΑ δεν είναι σε ΔΙΚΟ σου αρχείο).

## 6. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.0.1 / N.15) — ίδιο commit με κώδικα (ο Giorgio commit-άρει)
- **ADR-507 §8** (SnapshotTransformCommand — πρόσθεσε το pipe self-cascade στο spine) + **ADR-408 §Φ-C** changelog (transform-agnostic propagation) + cross-ref στο **ADR-049** (move precedent).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γρ: τι εκκρεμεί) + `adr-index.md` (αν χρειαστεί) + `MEMORY.md` (`reference_unified_move_ssot_dxf_bim.md` → πρόσθεσε Phase 3· δες [[reference_mergeable_update_command_base]] για τη SnapshotTransform οικογένεια).

## 7. EXECUTION MODE (N.8)
~5-7 αρχεία, 2 domains (commands + bim/mep-segments + bim-3d builders). **Plan Mode** (όπως το Phase 2). Φασικά, lowest-risk-first: (Φ3a) γενίκευση engine → (Φ3b) inject στο spine + undo symmetry → (Φ3c) αφαίρεση builder wrap → (Φ3d) [προαιρετικό] slab-opening on transform. Ρώτησε mode ΠΡΙΝ γράψεις κώδικα.

---

## 8. ΚΑΤΑΣΤΑΣΗ ΒΑΣΗΣ (Phase 2 = COMMITTED)
Phase 2 (true 3D vertical move) είναι **committed**: `a751c40b` (unified move/vertical-move) + `490a3e29` (3d move-delta tests) + ADR-049 changelog. Working tree ήταν clean. Phase 3 χτίζει ΠΑΝΩ σ' αυτό. **Εκκρεμεί browser-verify του Phase 2** (3D gizmo axis-Y persist) — ανεξάρτητο, μπορεί να γίνει μαζί.
