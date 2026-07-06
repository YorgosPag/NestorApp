# ADR-578 — Scene entity-id integrity: crypto-unique write-time ids + «Audit»-on-open heal

**Status:** ✅ IMPLEMENTED (UNCOMMITTED)
**Date:** 2026-07-06
**Domain:** DXF Viewer · Scene data integrity · Entity creation & load/persistence
**Related:** ADR-065 (`generateEntityId` crypto-secure SSoT), ADR-057 (unified entity completion), ADR-031 (Command pattern), ADR-390 Φ4 (`reconcileLoadedSceneBim` load policy), ADR-507 §5δ.9 (post-create compound-command needs id up front), ADR-040 (canvas orchestration / equality guards), ADR-186 (Entity Join — αποκάλυψε το bug)

---

## Context

Debugging της **Ένωσης (JOIN)** έδειξε στα console logs το `scene.entities` να περιέχει **δύο εγγραφές με ίδιο id** (`entity_8` ×2). Το `useEntityJoin` κάνει ένα μόνο `scene.entities.filter(...)`, οπότε δύο `entity_8` σημαίνει **πραγματικό data-integrity bug** στο scene, όχι σφάλμα του JOIN.

### Ρίζα (write-time)

Το pipeline δημιουργίας οντότητας:

```
useUnifiedDrawing.createEntityFromTool → completeEntity → CreateEntityCommand.execute
        (mint id)                        (id ως existingId)   (τιμά το existingId αυτούσιο)
```

Το id γεννιόταν από **αφελή per-hook counter**:

```ts
const nextEntityIdRef = useRef(1);              // useUnifiedDrawing.tsx
const id = `entity_${nextEntityIdRef.current++}`;
```

Ο counter έσπαγε με **3 τρόπους**:

1. **Per-instance** — το `useUnifiedDrawing()` instantiate-άρεται σε **6+ σημεία** (`useDrawingHandlers`, `useEntityCreation` ×3, `EntityCreationSystem`, `DrawingOrchestrator`, `useUnifiedOverlayCreation`). Κάθε instance έχει **δικό του `useRef(1)`** → δύο μονοπάτια βγάζουν και τα δύο `entity_1`, `entity_8`… → σύγκρουση.
2. **Reset σε κάθε remount** — ξαναρχίζει από 1 ενώ το scene κρατά τα ήδη-υπάρχοντα `entity_N`.
3. **Ποτέ δεν κοιτάζει το scene** — δεν seed-άρεται από το max υπάρχον id.

Το `CreateEntityCommand.execute` (γρ. 53) τιμά το `existingId` αυτούσιο: `id: this.options.existingId ?? generateEntityId()` → ο crypto-secure SSoT παρακαμπτόταν **μόνο** στο drawing path. Όλος ο υπόλοιπος κώδικας (AI tools, text/vertex/overlay commands) ήδη χρησιμοποιεί `generateEntityId()` (ADR-065). Το drawing hook ήταν η **μοναδική** παράκαμψη + η μοναδική πηγή `entity_N` ids.

### Big-player πρακτική

Enterprise CAD/BIM/design εργαλεία εγγυώνται **globally-unique σταθερά ids** στο write-time **ΚΑΙ** τρέχουν integrity **audit/repair στο open**:

- **Revit** → μοναδικό `ElementId`, ποτέ reused· «Audit» στο open επιδιορθώνει corrupt/duplicate element ids.
- **Figma** → globally-unique node GUID (session-counter + session-id)· consistency checks.
- **Maxon C4D** → unique object markers.

Άρα η σωστή λύση = **και τα δύο**: root fix στο write-time + idempotent heal στο load-time.

## Decision

**1) Write-time root fix (SSoT).** Το drawing id γεννιέται από τον υπάρχοντα crypto-unique SSoT `generateEntityId()` (ADR-065), minted στο `useUnifiedDrawing.createEntityFromTool` — ώστε το id να είναι γνωστό **πριν** το execute (κρατά το ADR-507 §5δ.9 post-create compound-command συμβόλαιο). Ο `nextEntityIdRef` counter **αφαιρέθηκε**. Καμία νέα υποδομή — reuse υπάρχοντος SSoT.

**2) Load-time integrity heal («Revit Audit»-on-open).** Νέα **pure + idempotent** SSoT `ensureUniqueEntityIds(scene)` στο `scene-bim-load-policy.ts` (δίπλα στα υπόλοιπα load policies), που τρέχει στο **μοναδικό** load chokepoint (`useLevelSceneLoader`) μετά το `reconcileLoadedSceneBim`. Επιδιορθώνει **ήδη αποθηκευμένα** corrupted snapshots (legacy `entity_N` διπλότυπα):

- Κράτα την **πρώτη** εμφάνιση κάθε id σταθερή (υπάρχουσες αναφορές παραμένουν έγκυρες), ξανα-mint-άρε **μόνο** τα επόμενα διπλότυπα με `generateEntityId()`.
- **Same-reference no-op** όταν όλα τα ids είναι μοναδικά (equality-guard friendly, ADR-040) → μηδέν κόστος στο κανονικό load.
- Το healed scene γράφεται πίσω στο επόμενο auto-save → **μόνιμη** διόρθωση· δεύτερο load = clean = no-op.
- WARN log (`dxf-scene-integrity`) μόνο όταν βρεθεί διπλότυπο (Revit-style audit report).

**Τοποθέτηση:** load-time, ΟΧΙ σε κάθε `setLevelScene` — το heal χρειάζεται μόνο όταν δεδομένα μπαίνουν από untrusted source (persisted snapshot). Το write-time fix εγγυάται ότι τα νέα entities είναι ήδη μοναδικά (όπως το Revit audit-άρει στο open, όχι σε κάθε edit).

## Changes

| Αρχείο | Αλλαγή |
|--------|--------|
| `hooks/drawing/useUnifiedDrawing.tsx` | Αφαίρεση `nextEntityIdRef` counter· `createEntityFromTool` → `generateEntityId()` (SSoT). |
| `systems/levels/scene-bim-load-policy.ts` | **ΝΕΟ** `ensureUniqueEntityIds(scene)` — pure/idempotent id-integrity heal + `dxf-scene-integrity` logger. |
| `systems/levels/hooks/useLevelSceneLoader.ts` | Wire `ensureUniqueEntityIds(reconcileLoadedSceneBim(...))` στο load chokepoint. |
| `systems/levels/__tests__/scene-bim-load-policy.test.ts` | +6 tests (no-op clean, heal keeps-first/re-mints-later, multi-collision, idempotent, payload preserved, scene-fields spread). |

## Consequences

- ✅ **Νέα** διπλότυπα ids αδύνατα (crypto-unique στο write-time, single SSoT).
- ✅ **Υπάρχοντα** corrupted scenes αυτο-θεραπεύονται στο load + persist-back (idempotent).
- ✅ Zero νέος μηχανισμός· reuse ADR-065 `generateEntityId`. Zero perf regression (same-ref no-op fast-path).
- ✅ Κρατά το ADR-507 post-create συμβόλαιο (id γνωστό πριν το execute).
- ⚠️ Τα legacy `entity_N` ids ήδη-αποθηκευμένων μοναδικών entities **δεν** αλλάζουν (μόνο τα διπλότυπα re-mint-άρονται) — σταθερότητα αναφορών.

## Changelog

| Ημ/νία | Αλλαγή |
|--------|--------|
| 2026-07-06 | Αρχική υλοποίηση: write-time SSoT id + load-time `ensureUniqueEntityIds` heal + 6 unit tests. Root cause του `entity_8` ×2 (αποκαλύφθηκε από JOIN debugging, ADR-186). |
