# HANDOFF — `MergeableMoveCommand` (?) base: η ΔΕΥΤΕΡΗ οικογένεια merge-commands (transform/vertex)

> **Ημερομηνία:** 2026-06-21
> **Origin:** ADR-507 §8 follow-up. Κατά την κεντρικοποίηση των `Update*ParamsCommand` σε `MergeableUpdateCommand<TPatch>` (DONE, committed) εντοπίστηκε ΔΕΥΤΕΡΗ οικογένεια commands με δικό της copy-pasted merge boilerplate (`canMergeWith`/time-window/`mergeWith`/`wasExecuted` guard) — αλλά **διαφορετικό μοντέλο** → σκόπιμα ΔΕΝ μπήκε στο `MergeableUpdateCommand`.
> **Στόχος ποιότητας:** FULL ENTERPRISE + FULL SSoT, Revit-grade. ΕΝΑ skeleton ανά cohesive cluster, μηδέν copy-paste — **ΑΛΛΑ ΟΧΙ forced abstraction** (δες §2, §4).
> **Reference (το πρότυπο που μόλις ολοκληρώθηκε):** `MergeableUpdateCommand.ts` + ADR-507 §8 changelog + `~/.claude/.../memory/reference_mergeable_update_command_base.md`.

---

## 0. ⚠️ ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Μην εμπιστευτείς αυτό το handoff τυφλά — **επιβεβαίωσε με grep** ότι (α) δεν προστέθηκε στο μεταξύ base/mixin για αυτή την οικογένεια, (β) δεν υπάρχει ήδη SSoT που να μπορείς να επεκτείνεις.

```
# Υπάρχει ήδη abstract base για transform/vertex commands;
grep -rn "abstract class .*Command\|extends .*Command" src/subapps/dxf-viewer/core/commands

# Όλη η οικογένεια merge-capable (εκτός των ParamsCommand που ΕΓΙΝΑΝ ήδη):
grep -rln "canMergeWith" src/subapps/dxf-viewer/core/commands | grep -vi "ParamsCommand\|MergeableUpdate"

# Ο μοναδικός υπάρχων command base που ΕΓΙΝΕ (πρότυπο, ΟΧΙ για reuse εδώ — διαφορετικό μοντέλο):
cat src/subapps/dxf-viewer/core/commands/entity-commands/MergeableUpdateCommand.ts

# ΖΩΤΙΚΟ — deserialization factories (αυτές διαβάζουν τα serialize data keys):
cat src/subapps/dxf-viewer/core/commands/CommandRegistry.ts
```

**Εύρημα συνεδρίας-origin (2026-06-21):** Ο μόνος abstract command base είναι το `MergeableUpdateCommand<TPatch>` (params family, ήδη committed). Για την transform/vertex οικογένεια **ΔΕΝ υπάρχει** base. Αν ο νέος grep δείξει ότι κάποιος έφτιαξε → χρησιμοποίησέ το.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (το διπλότυπο)

Κάθε ένα από τα παρακάτω επαναλαμβάνει το ΙΔΙΟ merge skeleton (`id`/`timestamp`/`wasExecuted` + `canMergeWith`: instanceof + same-id + both-dragging + `timestamp diff < DEFAULT_MERGE_CONFIG.mergeTimeWindow` + `mergeWith`):
`MoveEntityCommand`, `RotateEntityCommand`, (πιθανόν `ScaleEntityCommand` — δες §3), `MoveVertexCommand`, `AddVertexCommand`, `RemoveVertexCommand`, `MoveOverlayVertexCommand`, `InsertTextTokenCommand`.

---

## 2. ⚠️⚠️ ΚΡΙΣΙΜΗ ΔΙΑΦΟΡΑ ΑΠΟ ΤΑ PARAMS COMMANDS — ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ «ΕΝΑ BASE»

Το `MergeableUpdateCommand<TPatch>` δούλεψε γιατί τα 24 params commands ήταν **ομοιογενή**: symmetric `(patch, previousPatch)` applied via `applyPatch` σε `ISceneManager.updateEntity`. **Η transform/vertex οικογένεια ΔΕΝ είναι ομοιογενής** — έχει **3 undo models + 3 backing stores + ζωντανό deserialization contract**:

### (Α) Τρία διαφορετικά undo models:
1. **Snapshot/memento** — `MoveEntityCommand`, `RotateEntityCommand`: κρατούν `entitySnapshot(s): Map`, undo = restore snapshot. Forward = delta/angle (additive merge). **ΟΧΙ** symmetric previousPatch.
2. **Inverse-operation** — `AddVertexCommand` (undo = `removeVertex`), `RemoveVertexCommand` (undo = `insertVertex`): undo είναι **διαφορετική scene operation**, όχι «apply previous state».
3. **Symmetric old/new position** — `MoveVertexCommand`, `MoveOverlayVertexCommand`: undo = apply `oldPosition`. Το ΜΟΝΟ που μοιάζει με το params model.

### (Β) Τρία διαφορετικά backing stores (ΟΧΙ ένα `ISceneManager`):
- `ISceneManager` (updateVertex/insertVertex/removeVertex): MoveEntity, Rotate, MoveVertex, AddVertex, RemoveVertex.
- **`OverlayStoreVertexOperations`** (Firestore overlay store, **async fire-and-forget**!): MoveOverlayVertexCommand. ΕΝΤΕΛΩΣ διαφορετικό port.
- **text-engine**: InsertTextTokenCommand.

### (Γ) ΖΩΝΤΑΝΟ deserialization contract (ΑΝΤΙΘΕΤΑ με τα params!):
Το `CommandRegistry.registerBuiltInCommands` **έχει factories** για `move-vertex`, `add-vertex`, `remove-vertex` που διαβάζουν συγκεκριμένα `data` keys (`entityId`, `vertexIndex`, `oldPosition`, `newPosition`, `insertIndex`, `position`). **Άρα τα serialize keys ΕΔΩ είναι ΖΩΝΤΑΝΟ contract** — ΔΕΝ μπορείς να τα standardize-άρεις/σβήσεις όπως στα params (που δεν είχαν factory). Όποιο base φτιάξεις **πρέπει να κρατήσει το serialize shape** που διαβάζουν οι factories (αλλιώς σπάει session-restore). Verify με τα ίδια τα factories.

### ΣΥΜΠΕΡΑΣΜΑ §2 (Revit-grade honesty):
**ΜΗΝ ζορίσεις ένα `MergeableMoveCommand` για ΟΛΑ.** Θα ήταν leaky abstraction (η Google/Revit προτιμά διπλότυπο 5 γραμμών από λάθος abstraction). Το decision gate είναι στο §4.

---

## 3. INVENTORY + ΤΑΞΙΝΟΜΗΣΗ (επιβεβαίωσε με grep `canMergeWith` count + διάβασε κάθε ctor/undo)

| Command | Store | Undo model | isDragging; | ADR-487 hot; | Cluster |
|---|---|---|---|---|---|
| `MoveEntityCommand` | ISceneManager | snapshot+delta | ναι | **🔴 ΝΑΙ** (`reframeBeamsAndEmit`, `cascadeHostedOpeningsForWalls`, copyMode clones) | A |
| `RotateEntityCommand` | ISceneManager | snapshot+delta | ναι | **🔴 ΝΑΙ** (ίδια cascade + `calculateBimRotatedGeometry`) | A |
| `ScaleEntityCommand` (?) | ISceneManager | snapshot (;) | (;) | **🔴 πιθανόν** | A |
| `MoveVertexCommand` | ISceneManager | symmetric old/new | **ΟΧΙ** | μάλλον όχι | B |
| `MoveOverlayVertexCommand` | **OverlayStore (async)** | symmetric old/new | (;) | όχι (overlays) | B' |
| `AddVertexCommand` | ISceneManager | inverse (remove) | (;) | όχι | C |
| `RemoveVertexCommand` | ISceneManager | inverse (insert) | (;) | όχι | C |
| `InsertTextTokenCommand` | text-engine | (;) | (;) | όχι | D |

**ΕΚΤΟΣ scope (ήδη flagged):** `WallSplitCommand` (merge αλλά ειδικό), τα `construction-point-commands.ts` (έλεγξέ τα). Τα 24 `Update*ParamsCommand` + `UpdateMepSystemParams` = ΑΛΛΗ οικογένεια, ΕΓΙΝΕ/εκτός.

---

## 4. 🚦 DECISION GATE — ΤΙ ΝΑ ΦΤΙΑΞΕΙΣ (μετά το audit, ΠΡΙΝ τον κώδικα)

Αξιολόγησε ΑΝ αξίζει base ανά cluster. Πιθανές καθαρές υπο-ομάδες:

- **Cluster A (snapshot+delta transforms: Move/Rotate/Scale):** μοιράζονται πραγματικά μοντέλο (snapshot Map + additive delta merge + ίδιο reframe cascade). Candidate base `SnapshotTransformCommand`. **🔴 ΑΛΛΑ είναι ADR-487-hot** (living-structural-organism, ΕΝΕΡΓΟ domain άλλου agent — δες `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md`). **ΜΗΝ τα αγγίξεις χωρίς να ρωτήσεις τον Giorgio αν ο άλλος agent είναι «μέσα» τους.** Πιθανόν DEFER.
- **Cluster B (symmetric vertex-position: MoveVertex):** το ΜΟΝΟ που μοιάζει με params. Αλλά **B' (MoveOverlayVertex)** έχει διαφορετικό store (async Firestore) → μάλλον ΞΕΧΩΡΙΣΤΟ ή generic-over-store. Μικρό cluster (1-2 commands) → ίσως **δεν αξίζει** base (ROI χαμηλό).
- **Cluster C (inverse-op AddVertex/RemoveVertex):** trivial, 2 commands, ήδη μικρά → μάλλον **ΟΧΙ** base.
- **Cluster D (InsertTextToken):** μόνο του → ΟΧΙ base.

**Πιθανό τελικό συμπέρασμα (τίμιο):** Ίσως ΜΟΝΟ το Cluster A αξίζει base — και αυτό είναι ADR-487-hot. Αν ναι → το «επόμενο βήμα» μπορεί να είναι **«τεκμηρίωσε ότι δεν αξίζει ενιαίο base, κλείσε το flag»** αντί για νέο base. **Μη φτιάξεις base μόνο και μόνο επειδή το handoff το ανέφερε** — απόδειξε ότι αξίζει πρώτα.

---

## 5. ΥΠΑΡΧΟΝ SSoT — ΧΡΗΣΙΜΟΠΟΙΗΣΕ, ΜΗΝ ΔΙΠΛΑΣΙΑΣΕΙΣ
- `MergeableUpdateCommand<TPatch>` — **ΠΡΟΤΥΠΟ** (template-method + `canMergeWith` type-equality + `baseSerializedData()` helper), ΟΧΙ για άμεσο reuse (διαφορετικό model). Αν φτιάξεις 2ο base, ακολούθησε το ΙΔΙΟ pattern (abstract `applyX` + factory hook + canonical serialize helper).
- `generateEntityId` (`systems/entity-creation/utils`) — canonical command id.
- `DEFAULT_MERGE_CONFIG` (`interfaces.ts`) — ΜΗΝ hardcode 500ms.
- `deepClone` (`utils/clone-utils`) — snapshot cloning (Move/Rotate το χρησιμοποιούν ήδη).
- `reframeBeamsAndEmit` / `emitRestoredEntities` / `reframeBeamsAndEmitAfterRestore` (`bim/beams/beam-column-reframe-cascade`) — **ΗΔΗ SSoT** για το ADR-487 reframe (Move+Rotate το μοιράζονται). ΜΗΝ το διπλασιάσεις.
- `cascadeHostedOpeningsForWalls` (`bim/walls/wall-opening-coordinator`) — SSoT για hosted-opening recompute.
- `CommandRegistry` factories — **contract**: ό,τι base φτιάξεις, το `serialize().data` πρέπει να μένει συμβατό με τη factory που το διαβάζει.

---

## 6. TESTS
Υπάρχουν tests για move/vertex/rotate (`__tests__/`). **Πρέπει να μείνουν GREEN αυτούσια** (public behavior + serialize contract αμετάβλητα). + base test αν φτιάξεις base. **Verify deserialization**: μετά το refactor, `CommandRegistry.deserialize(cmd.serialize(), sm)` πρέπει να ξαναφτιάχνει ισοδύναμο command (round-trip) για move-vertex/add-vertex/remove-vertex.

---

## 7. ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ
- **COMMIT = Giorgio** (N.(-1)). Εσύ ΟΧΙ. Μετά το commit, αφαίρεσε το σχετικό flag από `.claude-rules/pending-ratchet-work.md`.
- **Shared tree** — `git add` ΜΟΝΟ δικά σου. **ΜΗΝ αγγίξεις MoveEntity/RotateEntity/Scale (ADR-487 hot) χωρίς Giorgio confirm.**
- **ΕΝΑ tsc** (N.17) — έλεγξε ότι δεν τρέχει άλλος πρώτα (`Get-CimInstance ... -like '*tsc*'`).
- **N.8 mode eval:** η οικογένεια είναι ~8 αρχεία 2+ domains → πιθανόν orchestrator-scale· **ζήτησε mode από Giorgio ΠΡΙΝ ξεκινήσεις υλοποίηση** (ή Plan). Πρότεινε: audit → decision gate (§4) → ΑΝ αξίζει, ξεκίνα ΜΟΝΟ από το πιο ασφαλές cluster.
- **N.15 docs μετά:** ADR (νέο ή υπάρχον) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + `pending-ratchet-work.md` + MEMORY — ίδιο commit με τον κώδικα.

---

## 8. BASELINE — τι ΕΓΙΝΕ ήδη (committed πριν ξεκινήσεις)
`MergeableUpdateCommand<TPatch>` base + 24 `Update*ParamsCommand` migrated (commits `3f6c4a0a` + `4d1a060e`) + serialize standardization (canonical `{entityId,patch,previousPatch,isDragging}`, Roof/Wall spread `baseSerializedData()`). `UpdateMepSystemParams` εκτός (port-based, no ISceneManager). Πλήρες context: ADR-507 §8 changelog.
