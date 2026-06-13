# HANDOFF — ADR-448: 25 jest failures στο BimSceneLayer (params-less entity stubs)

**Ημερομηνία:** 2026-06-13
**Από:** Opus session (ADR-449 σοβάς + ADR-452 cut-plane) → **Προς:** ADR-448 agent (storey-aware DXF / `bim-scene-attach-syncs`)
**Προτεραιότητα:** 🟡 Test-only (δεν σπάει production· σπάει presubmit/CI για όποιον αγγίζει `bim-3d/scene`)
**ΔΕΝ προκλήθηκε από εμένα** — pre-existing, εμφανίζεται σε κάθε `jest` run του `bim-3d/scene/__tests__`.

---

## ΣΥΜΠΤΩΜΑ — 25 failed jest σε 2 suites

```
FAIL src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-visibility-resolver-3d.test.ts   (16 failed / 1 passed)
FAIL src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-vg-visibility.test.ts            (~9 failed)
```

Σφάλμα (όλα ίδιο root):
```
TypeError: Cannot read properties of undefined (reading 'start')
  at start    src/subapps/dxf-viewer/bim-3d/scene/bim-scene-attach-syncs.ts:46:36   (syncWalls)
  at syncColumns  src/subapps/dxf-viewer/bim-3d/scene/bim-scene-attach-syncs.ts:112:49  (syncColumns)
```

---

## ROOT CAUSE — code assumes `entity.params`, test stubs δεν το έχουν

Ο ADR-448 κώδικας στο `bim-scene-attach-syncs.ts` διαβάζει `entity.params.*` **χωρίς guard**:

```ts
// γρ. 46 (syncWalls) — ADR-448 Phase 1b storey-ceiling:
const start = { x: wall.params.start.x, y: wall.params.start.y };   // ❌ wall.params === undefined
const end   = { x: wall.params.end.x,   y: wall.params.end.y };

// γρ. 112 (syncColumns):
const rawColTop = resolveColumnNominalTopZmm(column.params, colVctx) - resolveColumnBaseZmm(column.params, colVctx);  // ❌ column.params === undefined
```

Πρόσεξε ότι ο **γύρω** κώδικας χρησιμοποιεί optional chaining (`wall.params?.topBinding`, `wall.params?.baseBinding`) — αλλά οι γρ. 46/47 (start/end) **όχι**.

Τα test fixtures δίνουν **params-less stubs**:
```ts
// BimSceneLayer-visibility-resolver-3d.test.ts:84
walls: [{ id: 'w1', layerId: 'walls-layer' } as unknown as ... ],   // ΧΩΡΙΣ params
// (ομοίως columns/τα άλλα entity stubs σε makeEntities() + στο vg-visibility suite)
```

Πριν το ADR-448 Phase 1b, ο wall-sync δεν διάβαζε `params.start/end` εδώ, οπότε τα thin stubs περνούσαν. Η νέα γραμμή έσπασε το συμβόλαιο.

**Δεν είναι production bug:** τα πραγματικά `WallEntity`/`ColumnEntity` ΠΑΝΤΑ έχουν `params` (με `start/end`/`height`). Είναι **mismatch test-fixture ↔ νέα code assumption**.

---

## FIX — 2 επιλογές (εσύ αποφασίζεις, δική σου περιοχή)

### Επιλογή A (προτεινόμενη) — γέμισε τα test fixtures
Δώσε στα wall/column stubs minimal έγκυρα `params`:
```ts
walls: [{ id: 'w1', layerId: 'walls-layer', kind: 'straight',
  params: { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, topBinding: 'storey-ceiling', /* ... */ } } as unknown as ...],
columns: [{ id: 'c1', layerId: 'cols-layer',
  params: { height: 3000, /* footprint/anchor όσα διαβάζει το resolveColumnNominalTopZmm */ } } as unknown as ...],
```
**Γιατί προτιμητέο:** code = source of truth· τα πραγματικά entities έχουν πάντα params· τα stubs ήταν απλώς πολύ φτωχά. Δεν αλλοιώνει production συμπεριφορά. (Δες ποια ακριβώς πεδία διαβάζει το `resolveColumnNominalTopZmm`/`resolveColumnBaseZmm` για το column stub.)

### Επιλογή B — defensive guard στον κώδικα
```ts
if (!wall.params?.start || !wall.params?.end) continue;   // skip degenerate (γρ. 46)
```
**Tradeoff:** κρύβει πιθανά πραγματικά degenerate entities αντί να σκάει· λιγότερο «honest». Ίσως ΟΚ αν θες ανθεκτικότητα σε partial data, αλλά για test-only πρόβλημα η A είναι καθαρότερη.

---

## VERIFY
```
npx jest src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-visibility-resolver-3d.test.ts ^
         src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-vg-visibility.test.ts
```
Στόχος: 0 failed (τώρα 25 failed). ΕΝΑ tsc τη φορά (N.17).

## ΚΑΝΟΝΕΣ
Ελληνικά. ΟΧΙ commit/push χωρίς εντολή Giorgio (N.(-1)). git add ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`, ΠΟΤΕ `--no-verify`. Shared tree — `bim-scene-attach-syncs.ts` & τα suites είναι **δικά σου** (ADR-448)· εγώ δεν τα άγγιξα.
