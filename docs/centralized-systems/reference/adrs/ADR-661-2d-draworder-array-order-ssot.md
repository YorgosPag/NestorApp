# ADR-661 — 2D DRAWORDER: Array-Order Render SSoT + Per-Entity & Topo Send-to-Back

- **Status**: 🟢 IMPLEMENTED (εκκρεμεί ζωντανός έλεγχος Giorgio)
- **Date**: 2026-07-15
- **Category**: DXF Viewer / 2D Rendering / Z-Order
- **Σχετικά**: ADR-650 (τοπογραφικές ισοϋψείς — M10d #Γ, superseded από αυτό το ADR),
  ADR-040 (canvas performance — Phase X line batching, Phase IX viewport cull, micro-leaf αρχιτεκτονική),
  ADR-363 §11.Q3 (slab-opening two-pass punch), ADR-639 Στάδιο 5 (WebGL line layer),
  ADR-640 (TYPE-gated batched-line suppression), ADR-642 (complex linetype exclusion),
  ADR-358 §5.6.bis (layer/isolate/cut-plane skip), ADR-507 (single-entity sendToBack — προϋπάρχον)

---

## Context (το πρόβλημα / γιατί)

**Σύμπτωμα (ζωντανός έλεγχος Giorgio, screenshot 2026-07-15):** στη **2D** κάτοψη οι
δημιουργημένες καφέ ισοϋψείς γραμμές (ADR-650) ζωγραφίζονταν **ΠΑΝΩ** από την κάτοψη του κτιρίου
(τοίχους/hatches/entities) αντί να μένουν context από πίσω.

**Πρώτη προσπάθεια (ADR-650 M10d #Γ, v27) — ΑΝΕΠΑΡΚΗΣ:** προστέθηκε ένα ειδικό «background pass»
στην αρχή του `DxfRenderer.render` που ζωγράφιζε τα topo contour entities πρώτα, με predicate
`isTopoContourEntity` βασισμένο σε layer-name lookup μέσω `options.layersById`. Ζωντανός έλεγχος #1
απέτυχε: ο **bitmap-cache render path** (`dxf-canvas-renderer.ts`, το path που πραγματικά εμφανίζεται
στην οθόνη σε normal state) καλεί το `DxfRenderer.render` μέσω ενός `skipInteractive` κλάδου που
ξαναχτίζει το `effectiveOptions` **ΧΩΡΙΣ** `layersById` → το predicate έπαιρνε πάντα `undefined` →
ποτέ match → οι ισοϋψείς έμεναν μπροστά, αν και το «fix» ήταν σωστό στο μη-cached path.

**Ρίζα (δεύτερη, βαθύτερη διάγνωση — grep στον renderer):** ακόμη κι αν το layer-lookup gotcha
διορθωνόταν επιτόπου, το πρόβλημα ήταν **δομικό**, όχι απλώς ένα σπασμένο predicate: ο
`DxfRenderer` ζωγράφιζε **ΟΛΕΣ** τις γραμμές πρώτα σε ένα ενιαίο batched πέρασμα (ADR-040 Phase X
line-batching, «line-batch-first → `renderMatching` για όλα τα υπόλοιπα»), **ΚΑΤΩ** από κάθε
μη-γραμμή entity, **ανεξάρτητα από τη σειρά του πίνακα** `scene.entities`. Δηλαδή η θέση ενός
entity στον πίνακα **δεν ήταν** πραγματική z-σειρά για γραμμές — μόνο για non-lines. Ένα ειδικό
«topo background pass» θα ήταν πάντα ένα ακόμη ειδικό-case patch πάνω σε ένα μη-γενικό μοντέλο,
ευάλωτο στο ίδιο class of bug (νέο consumer, νέο ξεχασμένο `layersById` πέρασμα, κ.ο.κ.).

---

## Decision (απόφαση Giorgio, 2026-07-15)

**Η σειρά του πίνακα `scene.entities` γίνεται η ΜΙΑ SSoT για draw-order, για ΟΛΟΥΣ τους τύπους
entity — συμπεριλαμβανομένων των γραμμών.** Τελευταίο index = πιο πάνω (πιο πρόσφατο draw).
Αυτό είναι ακριβώς το **AutoCAD DRAWORDER** μοντέλο (και το ισοδύναμο Photoshop/Illustrator layer
stack): μία λίστα, η θέση = η οπτική στοίβα, «Send to Back» / «Bring to Front» = μετακίνηση μέσα
στη λίστα.

Πάνω σε αυτή τη γενική βάση, δύο συγκεκριμένα χαρακτηριστικά:

- **(A) Τοπογραφικές ισοϋψείς → αυτόματα στο ΠΙΣΩ μέρος** κατά τη δημιουργία (καμία πλέον ειδική
  μεταχείριση στον renderer — απλώς γεννιούνται στην αρχή του πίνακα).
- **(B) Γενικό per-entity «Αποστολή πίσω / Μεταφορά μπροστά»** για οποιαδήποτε επιλογή (ένα ή
  πολλά entities), με UI σε keyboard/context-menu, πάνω από το ήδη υπάρχον single-entity
  `ReorderEntityCommand` (ADR-507).

**Γιατί array-order και όχι ένα δεύτερο ειδικό pass:** ένα μοντέλο, μία αλήθεια. Κάθε future
«αυτό το πράγμα πρέπει να είναι πάντα πίσω/μπροστά» λύνεται με «βάλ' το στην αρχή/τέλος του
πίνακα κατά τη δημιουργία» — όχι με ένα ακόμη named-type ειδικό πέρασμα στον renderer που μπορεί
να ξαναπάθει το ίδιο layer-lookup gotcha.

---

## Architecture

### 1. `DxfRenderer.render` — single array-order pass (ήταν: line-batch-first + `renderMatching`)

Ο βρόχος διατρέχει **μία** φορά το `scene.entities`, με τη σειρά του πίνακα:

- Κάθε επιλέξιμη **συμπαγής (solid) LINE** που περνά τα ίδια gates με πριν (ορατή, μέσα στο
  viewport culling — ADR-040 Phase IX, όχι layer-skipped — ADR-358, όχι selected/hovered, όχι
  WebGL-owned, όχι complex linetype — ADR-642) **επεκτείνει το τρέχον «run»**: ένα
  style-keyed (`color\0lineWidth\0alpha\0dash@celtscale` — ίδιο key με πριν) `Map` από batches
  γραμμών, συσσωρευμένο στο νέο private helper `tryLineBatchEntry`.
- Μόλις εμφανιστεί ένα entity που **δεν** μπορεί να μπει στο run (οποιοδήποτε non-line, ή μια
  γραμμή που αποκλείεται — selected/hovered/measurement/μη-συμπαγής/complex linetype), το run
  **flush-άρεται** (ένα `stroke()` per style-batch, ADR-040 Phase X batching **διατηρημένο μέσα
  σε κάθε run**) και μετά ζωγραφίζεται το entity σε array-σειρά μέσω `drawInOrder`.
- Έτσι το global z-order τηρείται **και** για γραμμές **και** για μη-γραμμές — το batching
  παραμένει performance optimization *μέσα* σε συνεχόμενα runs, όχι πλέον προτεραιότητα πάνω
  από τη σειρά του πίνακα.

Το παλιό «topo background pass» (M10d #Γ) **αφαιρέθηκε εντελώς** — δεν χρειάζεται πια ειδικό
predicate/lookup στον renderer, γιατί το array position από μόνο του καθορίζει τη στοίβα.

### 2. Δύο position-independent carve-outs (ΕΠΙΤΗΔΕΣ, όχι array-order)

- **Slab-openings** (ADR-363 §11.Q3): συλλέγονται σε `deferredSlabOpenings` καθώς περνά ο βρόχος
  και ζωγραφίζονται σε ένα **τελικό sub-pass**, ΜΕΤΑ από όλα τα slabs. Λόγος: το
  `destination-out` punch ενός slab θα έσβηνε ήδη-ζωγραφισμένο άνοιγμα αν το άνοιγμα προηγείται
  του slab του στον πίνακα (μπορεί να συμβεί μετά από Firestore snapshot merge). Αυτό είναι
  **ανεξάρτητο** από το ADR-661 draw-order μοντέλο — είναι ένας ξεχωριστός, στενός κανόνας
  ζωγραφικής (punch πρέπει να δει το ήδη-ζωγραφισμένο άνοιγμα) που προϋπήρχε και διατηρείται
  ρητά ως εξαίρεση.
- **Τοπογραφικές ισοϋψείς**: ΔΕΝ είναι πια ειδική περίπτωση στον renderer. Αντί για ένα
  named-type background pass, «κάθονται» στην αρχή του πίνακα **στην πηγή** (βλ. §3 (A)) — το
  array-order μοντέλο τις χειρίζεται σαν οτιδήποτε άλλο.

### 3. (A) Durable send-to-back για τοπογραφικές ισοϋψείς

Το «durable» site είναι το **`regenerate-topo.ts`**, όχι κάποιο interactive undo step: οι
ισοϋψείς **δεν** αποθηκεύονται ποτέ ως persisted geometry — ξαναχτίζονται από το survey SSoT σε
κάθε load / αλλαγή ορόφου / αλλαγή geo-reference (ADR-650 M9/M10). Άρα «πίσω» πρέπει να
επιβάλλεται **εδώ**, αλλιώς κάθε rebuild θα το ακύρωνε.

```ts
deps.commitScene({
  ...scene,
  layersById,
  entities: [...(fresh as unknown as AnySceneEntity[]), ...kept],
});
```

`fresh` (οι μόλις παραγμένες ισοϋψείς) μπαίνουν **πρώτες** στον πίνακα (index 0 = ζωγραφίζονται
πρώτες = πίσω), `kept` (όλα τα υπόλοιπα entities του σχεδίου) ακολουθούν. Η εσωτερική σχετική
σειρά και του `fresh` και του `kept` διατηρείται.

Το interactive «Δημιουργία ισοϋψών» path (`useTopoContours`) κάνει το ίδιο seat-at-back, με
**ένα** undo step: `CreateEntityCommand`(s) + `BatchReorderEntityCommand` τυλιγμένα σε
`CompoundCommand` (mirror του προϋπάρχοντος ADR-507 §5δ hatch pattern — δημιουργία + reorder =
ένα atomic undo, όχι δύο).

### 4. (B) Γενικό per-entity reorder (πολλαπλή επιλογή)

- **`entity-zorder-ops.ts`** — νέα pure `moveEntitiesInList(entities, ids, direction)`: χωρίζει
  τον πίνακα σε `moved` (τα ids που ζητήθηκαν, με τη σχετική τους σειρά αμετάβλητη) και `rest`
  (όλα τα υπόλοιπα), μετά επανασυνθέτει `[...moved, ...rest]` (back) ή `[...rest, ...moved]`
  (front) — **ένα** split + concat, ατομικό. Looping του προϋπάρχοντος single-id
  `moveEntityInList` ανά id θα ανακάτευε τη σειρά μέσα στο επιλεγμένο σύνολο (κάθε 'back' θα
  ξανα-έμπαινε στο index 0, αντιστρέφοντας τα).
- **`ISceneManager`** αποκτά `reorderEntities(ids, direction)` / `getEntityOrder()` /
  `setEntityOrder(order)` — υλοποιημένα στο `LevelSceneManagerAdapter` (mirror του
  προϋπάρχοντος single-entity reorder adapter method).
- **`BatchReorderEntityCommand`** (`core/commands/entity-commands/`) — ένα atomic commit για N
  entities: `execute()` παίρνει snapshot `orderBefore = getEntityOrder()` πριν καλέσει
  `reorderEntities`, `undo()` επαναφέρει το snapshot αυτούσιο. Snapshot-based undo (όχι
  per-id restore) γιατί η επαναφορά ενός id σε ένα captured index δεν αντιστρέφεται σωστά όταν
  N entities μετακινούνται μαζί — τα indices των γειτόνων μετατοπίζονται.
- **Wiring**: `useCanvasEditActions.handleReorderEntity` έγινε multi-select-aware (ήταν
  single-only) · πληκτρολόγιο `PageUp`/`PageDown` (`useCanvasKeyboardShortcuts.ts`,
  `config/keyboard-shortcuts.ts`) · δεξί-κλικ context menu «Μεταφορά μπροστά» / «Μεταφορά πίσω»
  (`canvas-section-entity-menu.ts`, `EntityContextMenu.tsx`).

---

## Invariants διατηρημένα (τίποτα από αυτά δεν άλλαξε συμπεριφορά)

- **ADR-040 Phase X** line batching — ένα `stroke()` per style ανά run (όχι global πλέον, αλλά
  run-local· βλ. Perf tradeoff §παρακάτω).
- **ADR-040 Phase IX** viewport culling — υπολογίζεται μία φορά/frame, εφαρμόζεται σε κάθε
  entity (batchable ή όχι) όπως πριν.
- **ADR-640** TYPE-gated batched-line suppression — container members (block/group/array) που
  μοιράζονται id με μια batched γραμμή συνεχίζουν να ζωγραφίζονται.
- **ADR-639 Στάδιο 5** WebGL line-layer suppression — μια GPU-owned γραμμή παραλείπεται από το
  Canvas2D draw εκτός αν είναι selected/hovered (η εξαίρεση highlight-πάνω-από-GPU-γραμμή
  παραμένει).
- **ADR-642** complex-linetype exclusion από το batching — αμετάβλητο.
- **ADR-358 §5.6.bis** layer/isolate/cut-plane skip — ελέγχεται ανά entity, ίδιο predicate.
- **ADR-363 §11.Q3** slab-opening two-pass — παραμένει, βλ. §2 παραπάνω.
- Οι 4 structural-overlay scene passes (finish-skin, member/foundation/slab reinforcement) —
  τρέχουν στη σειρά τους ΜΕΤΑ τα entities, πριν το `ctx.restore()`, όπως πριν.

---

## Perf tradeoff (ειλικρινής καταγραφή)

Το run-based batching συσσωρεύει **συνεχόμενες** γραμμές του ίδιου style. Αν οι γραμμές
εναλλάσσονται πυκνά με μη-γραμμές στον πίνακα, θα υπάρξουν **περισσότερα, μικρότερα** flushes
από το παλιό global batch (που έβαζε ΟΛΕΣ τις γραμμές σε ένα πέρασμα, ανεξάρτητα από ενδιάμεσα
non-lines). Στην πράξη τα DXF entities συνήθως ομαδοποιούνται κατά τύπο/layer κατά το import/
σχεδίαση, οπότε τα runs παραμένουν μακριά και η επίπτωση είναι αμελητέα σε τυπικά σχέδια.

Η σειρά **μέσα** σε ένα run (διαφορετικά styled, επικαλυπτόμενες γειτονικές γραμμές) παραμένει
grouped-by-style, **όχι** αυστηρά total-ordered ανά μεμονωμένη γραμμή — ένα pathological/σπάνιο
edge case (π.χ. δύο γραμμές διαφορετικού χρώματος interleaved pixel-για-pixel) θα μπορούσε να μη
δείξει την ακριβή relative σειρά τους μέσα στο ίδιο run. Θεωρείται αμελητέο για CAD σχέδια όπου
γραμμές του ίδιου layer/style είναι σχεδόν πάντα ομαδοποιημένες νοηματικά.

---

## Αρχεία που άλλαξαν

| Αρχείο | Αλλαγή |
|---|---|
| `canvas-v2/dxf-canvas/DxfRenderer.ts` | `render()` ξαναγράφτηκε σε single array-order pass· νέο private `tryLineBatchEntry`· αφαιρέθηκε το M10d #Γ background pass/predicate |
| `systems/topography/persistence/regenerate-topo.ts` | `entities: [...fresh, ...kept]` (contours πρώτες = πίσω) |
| `systems/topography/useTopoContours.ts` | interactive generate path: seat-at-back μέσω `CompoundCommand` + `BatchReorderEntityCommand`, ένα undo step |
| `systems/entity-creation/entity-zorder-ops.ts` | νέα pure `moveEntitiesInList(entities, ids, direction)` |
| `systems/entity-creation/LevelSceneManagerAdapter.ts` | υλοποίηση `reorderEntities`/`getEntityOrder`/`setEntityOrder` |
| `core/commands/interfaces.ts` | `ISceneManager` +`reorderEntities`/`getEntityOrder`/`setEntityOrder` |
| `core/commands/entity-commands/BatchReorderEntityCommand.ts` | νέο — atomic multi-entity reorder command, snapshot undo |
| `hooks/canvas/useCanvasEditActions.ts` | `handleReorderEntity` → multi-select-aware |
| `hooks/canvas/useCanvasKeyboardShortcuts.ts` / `.types.ts` | `PageUp`/`PageDown` reorder shortcuts |
| `config/keyboard-shortcuts.ts` | shortcut entries |
| `components/dxf-layout/canvas-section-entity-menu.ts` / `ui/components/EntityContextMenu.tsx` | «Μεταφορά μπροστά» / «Μεταφορά πίσω» context-menu items |
| `components/dxf-layout/CanvasSection.tsx` | wiring του νέου reorder action |

---

## Tests

- `bim-3d/__tests__/canonical-views.test.ts` και σχετικά DXF viewer suites θιγμένα από τη
  renderer αλλαγή — τρέξιμο μέσω jest (ΟΧΙ tsc, N.17).
- `entity-zorder-ops` / `BatchReorderEntityCommand` — καινούριο pure-function + command
  behaviour, καλύπτονται από targeted jest tests.
- `jscpd:diff` — τρέχει πριν το «done» (N.18) στα staged αρχεία της αλλαγής.

---

## Changelog

- **2026-07-15 (v1)** — **ΥΛΟΠΟΙΗΘΗΚΕ.** Array-order γίνεται η ΜΙΑ SSoT για 2D draw-order,
  συμπεριλαμβανομένων των γραμμών (ήταν: όλες οι γραμμές πάντα κάτω από όλα τα non-lines,
  ανεξάρτητα από τη σειρά του πίνακα). `DxfRenderer.render` single-pass rewrite με per-style
  run-batching (αντικαθιστά το line-batch-first + `renderMatching` δύο-περασμάτων μοντέλο).
  Αφαιρέθηκε το ADR-650 M10d #Γ topo background pass/predicate (superseded). Νέο (A) durable
  auto-send-to-back για τοπογραφικές ισοϋψείς (`regenerate-topo` prepend + interactive
  `useTopoContours` compound undo) και (B) γενικό multi-select «Send to Back / Bring to Front»
  (`entity-zorder-ops.moveEntitiesInList`, `BatchReorderEntityCommand`, `ISceneManager`
  επέκταση, keyboard `PageUp`/`PageDown` + context-menu wiring). Slab-opening two-pass
  (ADR-363 §11.Q3) διατηρήθηκε ως deferred τελικό sub-pass, ανεξάρτητο από το array-order
  μοντέλο. Perf tradeoff τεκμηριωμένος: run-local αντί για global line-batching — αμελητέο σε
  τυπικά σχέδια (γραμμές ομαδοποιημένες κατά type/layer), sub-order μέσα σε ένα run παραμένει
  grouped-by-style. **Status: IMPLEMENTED (εκκρεμεί ζωντανός έλεγχος Giorgio).**
