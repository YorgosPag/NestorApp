# ADR-540 — Universal Associative Geometry Reconciliation (SSoT)

**Status:** ✅ Implemented (UNCOMMITTED 2026-06-27) — browser-verify pending
**Date:** 2026-06-27
**Σχετικά:** ADR-492 (beam↔column reframe cascade — γενικεύεται εδώ) · ADR-363 §5.4 (`cascadeHostedOpeningsForWalls` — wall→openings) · ADR-529 (beam promotes column → Γ· το ad-hoc reframe του §reframe αντικαθίσταται) · ADR-408 Φ-C / ADR-507 §8 (delta-followers: pipes + slab-openings — ΠΑΡΑΜΕΝΟΥΝ transform-only) · ADR-492 §4 (freeze lesson — reconcile = command-time, ΟΧΙ reactive) · ADR-040 (low-freq grip stores)

---

## 1. Πρόβλημα

«Οι λαβές (grips) μιας BIM οντότητας μένουν **stale** μετά από αλλαγή σε γειτονικό/host μέλος.» Παράδειγμα-ρίζα (Giorgio 2026-06-27): η **προαγωγή** γωνιακής κολόνας σε Γ (ADR-529) μεγάλωνε το footprint, αλλά το άκρο του δοκαριού (`BeamParams.endPoint`) έμενε στην παλιά παρειά → οι λαβές «σημείο 1/2» δεν συνέπιπταν με το ορατό κομμένο άκρο.

**Root cause (από τον κώδικα — audit):** το πρόβλημα **δεν** είναι UI. Οι λαβές υπολογίζονται σωστά από τα params (`computeDxfEntityGrips`). Το πρόβλημα είναι ότι τα **params των εξαρτημένων μελών δεν re-derive-άρονται** όταν αλλάζει ο host. Υπήρχε **ασυμμετρία** στα commands:

| Command base | Associative cascades command-time |
|---|---|
| `SnapshotTransformCommand` (Move/Rotate/Scale/Mirror) | ✅ έτρεχε 4 cascades |
| `MergeableUpdateCommand` (Column/Beam/Foundation/Roof/MEP/…) | ❌ **κανένα** — μόνο η `UpdateWallParams` καλούσε inline το opening-cascade |

Άρα κάθε `Update*ParamsCommand` (ribbon edit, grip-resize, προαγωγή) άφηνε τα εξαρτημένα μέλη stale. Το ADR-529 το μπάλωσε ad-hoc μέσα στο `useColumnBeamPromote` — ακριβώς ο σκόρπιος κώδικας που έπρεπε να εξαλειφθεί.

## 2. Απόφαση

**ΕΝΑ κεντρικό SSoT** `reconcileAssociativeGeometry(changedIds, sceneManager, { announceEntities? })` που τρέχει μετά από **ΚΑΘΕ** geometry-mutating command και re-derive-άρει όλα τα **scene-derived** εξαρτημένα μέλη, ώστε οι λαβές τους να είναι **ΠΑΝΤΑ** σωστές. Revit / Cinema 4D-grade.

**Διάκριση δύο κατηγοριών associative re-derivation (κρίσιμη):**

1. **Scene-derived reconcilers** — idempotent, διαβάζουν την ΤΡΕΧΟΥΣΑ σκηνή, **ΧΩΡΙΣ delta**:
   - openings → wall (`cascadeHostedOpeningsForWalls`, ADR-363 §5.4)
   - beams → column faces (`cascadeBeamReframe`, ADR-492)

   → ζουν **μέσα** στο reconcile· τρέχουν μετά από **οποιαδήποτε** αλλαγή host (transform **Ή** params).

2. **Delta-followers** — χρειάζονται το transform delta (dx,dy): connected pipes (ADR-408 Φ-C) + slab-openings (ADR-049/507 §8).

   → **ΔΕΝ** ζουν στο reconcile· ένα params-edit δεν παράγει delta γι' αυτά. Παραμένουν transform-only μέσα στο `SnapshotTransformCommand.runForwardFollowerCascades` (αμετάβλητα).

## 3. SSoT — μηδέν νέα γεωμετρία, reuse των υπαρχόντων cascades

Το `associative-geometry-reconcile.ts` **delegate-άρει** στα υπάρχοντα cascade modules — δεν ξαναγράφει γεωμετρία:

```
reconcileAssociativeGeometry(changedIds, sm, options):
  (1) cascadeHostedOpeningsForWalls(changedIds, sm)   // derived geometry only → no emit
  (2) reframed = cascadeBeamReframe(changedIds, sm)    // persisted params change → must emit
  (3) byId = merge(options.announceEntities, reframed) // reframed wins by id (dedup)
      if byId non-empty → EventBus.emit('bim:entities-moved', { movedEntities: byId })
```

- **Dependency order:** openings πρώτα (καθαρά derived), beams μετά.
- **Idempotent:** αμετάβλητα εξαρτημένα + κανένα `announceEntities` → **κανένα emit** (μηδέν persist churn).
- **Γενίκευση των παλιών helpers:** το `reconcile` απορρόφησε τα `reframeBeamsAndEmit` (announceEntities set = transform hosts+followers) + `reframeBeamsAndEmitAfterRestore` (announceEntities empty = μόνο reframed) σε **ΕΝΑ** API. Τα δύο πρώην functions αφαιρέθηκαν από το `beam-column-reframe-cascade.ts`· έμειναν το pure `cascadeBeamReframe` (building block) + το `emitRestoredEntities` (undo race-guard — πρέπει να τρέξει ΠΡΙΝ το scene-restore).

## 4. Γιατί command-time, ΟΧΙ reactive effect (μάθημα ADR-492 §4)

Ένας reactive effect που άκουγε `bim:entities-moved`/`bim:*-params-updated` και ξανα-εξέπεμπε geometry event → βρόχος με τον proactive analysis cycle (organism → reinforce/FEM → params-updated → effect → emit → …) → **storm/freeze** στο «Ανάλυση». Το reconcile τρέχει **σύγχρονα μέσα στην εντολή**, με **ΕΝΑ** `bim:entities-moved` και **idempotency** → ο κύκλος συγκλίνει, μηδέν reactive re-trigger.

## 5. Σημεία κλήσης (command-time)

- **`MergeableUpdateCommand` base** (params family): `reconcileAssociativeGeometry([entityId], sm)` μετά το `applyPatch` σε execute/undo/redo. Καλύπτει **ΟΛΑ** τα `Update*ParamsCommand` με ΕΝΑ σημείο. Ασφαλές για μη-δομικά subclasses (hatch/dim/furniture): οι cascades κάνουν fast early-exit (όχι wall/column/beam → no-op, μηδέν emit).
- **`SnapshotTransformCommand`** (transform family): αντικατέστησε τα δύο inline calls (`cascadeHostedOpeningsForWalls` + `reframeBeamsAndEmit`/`AfterRestore`) με `reconcileAssociativeGeometry`. Οι delta-followers + το undo race-guard (`emitRestoredEntities` **πρώτο**) παραμένουν αμετάβλητα.
- **`UpdateWallParamsCommand`**: αφαιρέθηκε το inline `cascadeHostedOpeningsForWalls` (καλύπτεται πλέον από το base reconcile).
- **`useColumnBeamPromote` (ADR-529 §reframe)**: αφαιρέθηκε το ad-hoc reframe block. Η προαγωγή (`UpdateColumnParamsCommand`) reframe-άρει πλέον το δοκάρι **αυτόματα** μέσω του base reconcile → **ΕΝΑ** undo step αντί δύο.

## 6. Grip refresh (auto — μηδέν νέος κώδικας)

Το `bim:entities-moved` ενημερώνει τον entities store →
- **2D λαβές:** `grip-registry.ts` `useMemo` auto-reactive στο scene entity.
- **3D λαβές:** `use-bim3d-edit-interaction.ts` subscribe-άρει στον `useBim3DEntitiesStore` → `refreshReshapeGrips` ξανα-κάθεται στη νέα γεωμετρία ΕΝΩ η οντότητα είναι επιλεγμένη.

Επιβεβαιωμένο command-time path: ο reconcile εκπέμπει → οι λαβές ανανεώνονται αυτόματα.

## 7. Αρχεία

**NEW:** `bim/cascade/associative-geometry-reconcile.ts` (+ `__tests__/associative-geometry-reconcile.test.ts`).
**MOD:** `core/commands/entity-commands/MergeableUpdateCommand.ts` (reconcile σε execute/undo/redo), `SnapshotTransformCommand.ts` (delegate στο reconcile), `UpdateWallParamsCommand.ts` (−inline cascade), `bim/beams/beam-column-reframe-cascade.ts` (−`reframeBeamsAndEmit`/`AfterRestore`, absorbed), `hooks/useColumnBeamPromote.ts` (−ad-hoc reframe block + unused imports).
**Tests MOD:** `SnapshotTransformCommand.followers.test.ts` (mock reconcile), `beam-column-reframe-cascade.test.ts` (drop absorbed-fn blocks).

## 8. Όρια / DEFER

- **Delta-followers (pipes, slab-openings):** ΔΕΝ μετακινήθηκαν στο reconcile (transform-only, ορθά σήμερα).
- **Επιπλέον associative re-derivations** (`resyncPromotedBoundaryArmsForBeam` foot↔beam width, stair host, railing host, mep manifold connectors): παραμένουν στους δικούς τους proactive κύκλους· μπορούν να ενταχθούν στο reconcile σε επόμενη φάση αν χρειαστεί (το API είναι ήδη extensible — προσθήκη ενός ακόμη cascade στη dependency order).

## 9. Changelog

| Ημ/νία | Αλλαγή |
|--------|--------|
| 2026-06-27 | Αρχική υλοποίηση. NEW `reconcileAssociativeGeometry` SSoT (delegate openings + beam-reframe + ΕΝΑ emit, idempotent). Κλήση από `MergeableUpdateCommand` base (κλείνει το params-family κενό) + `SnapshotTransformCommand` (delegate). Absorbed `reframeBeamsAndEmit`/`AfterRestore`. Αφαιρέθηκε το ad-hoc promote reframe (ADR-529 §reframe). 8 suites / 83 + 5 reconcile jest GREEN. tsc SKIP (N.17). UNCOMMITTED — browser-verify pending. |
