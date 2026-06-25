# ADR-527 — ΕΝΑΣ μακρόβιος SceneManager/level (singleton adapter, Revit Document model)

- **Status:** Implemented (UNCOMMITTED)
- **Date:** 2026-06-25
- **Owner:** DXF Viewer / entity-creation + command system
- **Domain:** Scene write pipeline — adapter lifecycle (cross-cutting)
- **Related:** ADR-511 (slab batch create / `appendEntitiesToScene` / `CompoundCommand`), ADR-459 (`CommandHistory.appendToLast` transaction grouping), ADR-390 (symmetric BIM create/undo / `CreateBimEntityCommand`), ADR-524 (column batch-fill — §6b περιγράφει το ίδιο race), ADR-040 (scene-write / store-subscription layer)

---

## 1. Πλαίσιο (Context)

Το `appendEntityToScene` (και ~123 ακόμη call-sites σε 96 αρχεία) έκαναν
**`new LevelSceneManagerAdapter(...)` σε ΚΑΘΕ κλήση**. Ο adapter κρατά ένα per-instance
`pendingScene` cache (γρ. 57-117 του `LevelSceneManagerAdapter.ts`) που λύνει ένα
read-after-write μέσα σε ένα synchronous batch mutations (π.χ. `JoinEntityCommand` =
removeEntity + removeEntity + addEntity).

**Η μηχανική του bug:** N× single appends (π.χ. batch κολόνες) → N ανεξάρτητοι adapters →
N ανεξάρτητα `pendingScene` caches → κάθε προσθήκη διαβάζει stale running scene, οι αλλαγές
πατούν η μία την άλλη και downstream readers (auto-foundation κ.λπ.) δεν βλέπουν όλο το set.
Αυτό **δεν είναι enterprise** — η Revit κρατά **ΕΝΑ μακρόβιο `Document`/level** (SSoT) και
ανοίγει Transactions πάνω του.

## 2. Εύρημα audit — ο live-scene SSoT ΥΠΑΡΧΕΙ ΗΔΗ (κώδικας = αλήθεια)

Πριν αποφασιστεί «νέο SceneManager», το SSoT audit (grep + πλήρης ανάγνωση) έδειξε ότι ο
live SSoT **υπάρχει ήδη στη ρίζα**:

- `hooks/scene/useSceneManager.ts` — `levelScenesRef` (γρ. 27-28) **γράφεται ΣΥΓΧΡΟΝΑ**
  μέσα στο `setLevelScene` (γρ. 43, **πριν** το React `setLevelScenes`) και το
  `getLevelScene` διαβάζει **πάντα** από αυτό το ref (γρ. 49). Το σχόλιο (γρ. 37-42) το λέει
  ρητά: *«Critical for multi-entity commands: a CompoundCommand applies its children
  sequentially … each child reads getLevelScene() to rebuild the scene»*. **Αυτό ΕΙΝΑΙ το
  Revit Document** — ένα μακρόβιο live store/level.
- Η αλυσίδα διατηρεί τα live-ref semantics παντού: `useSceneManager` →
  `useAutoSaveSceneManager` (γρ. 203 base sync setter) → `LevelsSystem` (stable `useCallback`,
  empty deps) → `useLevels`. Και τα 96 call-sites περνούν το **ΙΔΙΟ**
  `levelManager.getLevelScene/setLevelScene`.

**Συνέπεια:** Το `pendingScene` είναι **διπλότυπο** του live ref (per-instance αναπαραγωγή
του ίδιου read-after-write). Δεν λείπει SSoT — απλώς ο adapter **γινόταν `new` ανά κλήση**,
σπάζοντας τη μοναδικότητα. Τα transaction primitives υπάρχουν ήδη: `CompoundCommand`
(atomic N), `CommandHistory.appendToLast` (ADR-459 grouping), `appendEntitiesToScene`
(ADR-511 batch).

## 3. Απόφαση (Decision)

**ΟΧΙ νέο σύστημα — centralization.** Ένας **cached singleton adapter ανά (scene-accessor,
levelId)**:

1. `createLevelSceneManagerAdapter(getLevelScene, setLevelScene, levelId)` επιστρέφει
   **cached instance** αντί `new`. Keyed by `getLevelScene` fn identity (μέσω `WeakMap` →
   GC-safe, μηδέν leak) + match `setLevelScene` + `levelId`. Επειδή οι accessor fns είναι
   stable, προκύπτει **ένας adapter/level** για όλη τη ζωή της εφαρμογής· αν αλλάξουν
   (HMR / tenant switch) → νέος, ποτέ stale binding.
2. `levelSceneManagerFor(levelManager, levelId)` delegate → παίρνει το ίδιο cache δωρεάν.
   **Μοναδικό construction site** (SSoT).
3. `appendEntityToScene` / `appendEntitiesToScene` χρησιμοποιούν πλέον `levelSceneManagerFor`
   (το hot path των batch κολόνων → ΕΝΑΣ adapter αντί N).
4. `clearLevelSceneManagerCache(getLevelScene, levelId?)` για ρητή invalidation
   (tests / teardown). Production δεν το χρειάζεται (WeakMap GC).
5. **Αφαίρεση του `pendingScene`** → ο adapter γίνεται **stateless pass-through**: κάθε
   read στο `getLevelSceneFn`, κάθε write στο `setLevelSceneFn`. Το read-after-write
   εγγυάται πλέον **αποκλειστικά** το `levelScenesRef` της ρίζας (sync-write). Κλείνει το
   διπλότυπο: **ΜΙΑ** πηγή αλήθειας (root ref), όχι δύο (root ref + per-instance cache).

**Γιατί ασφαλής τώρα:** το §8 του handoff απαγόρευε αφαίρεση «πριν υπάρξει live-SSoT
αντικαταστάτης». Το audit απέδειξε ότι ο αντικαταστάτης **υπάρχει** (`levelScenesRef`,
sync-write στο `useSceneManager` γρ. 43) και ΟΛΑ τα production multi-command paths περνάνε
αυτόν τον accessor. Κανένα production test δεν βασιζόταν στο `pendingScene`.

## 4. Πλήρης κεντρικοποίηση όλων των call-sites (Giorgio order)

Τα **107 direct `new LevelSceneManagerAdapter(...)` σε 88 αρχεία** μεταφέρθηκαν σε
`createLevelSceneManagerAdapter(...)` (ίδια args, παίρνουν το singleton cache). Μετά: **0**
`new` εκτός του factory (η μόνη νόμιμη χρήση = μέσα στο `createLevelSceneManagerAdapter`).
Codemod με ασφαλές import rewrite (κρατά την class import όπου χρησιμοποιείται ως type).

### 4.1 Ratchet guard (enforcement — όπως η Google)
Νέο module **`level-scene-manager-adapter`** στο `.ssot-registry.json` (forbidden
`new LevelSceneManagerAdapter\(`, allowlist = μόνο ο factory). Κάθε νέο `new` εκτός factory
→ **COMMIT BLOCKED** (CHECK 3.7, ADR-294). Verified: existing migrated → exit 0, νέο `new` →
exit 1.

### 4.2 Προϋπάρχον tooling gap (flagged, ΟΧΙ fixed εδώ)
- `.ssot-registry-flat.txt` (που διαβάζει το CHECK 3.7) είναι **gitignored + stale** (327
  JSON modules vs 302 flat = 25 modules behind) και **κανένα script δεν το αναγεννά** από το
  JSON. Το module προστέθηκε ΚΑΙ στο committed JSON (durable SSoT) ΚΑΙ στο local flat (guard
  ενεργός τοπικά). Η ευρύτερη flat-staleness αφορά 25 modules — ξεχωριστό tooling task.
- Baseline: ΔΕΝ έγινε grandfathering (όλα migrated σε 0)· το `.ssot-violations-baseline.json`
  έμεινε αμετάβλητο (μηδέν masking). Εντοπίστηκε προϋπάρχον unrelated drift
  `src/types/building/derived-foundation-depth.ts` (committed f6f1507d) — **δεν** folded στο
  baseline (δεν το «καταπίνω»)· ξεχωριστό ratchet item.

## 5. Συνέπειες

- **+** ΕΝΑΣ adapter/level (Revit Document), zero «new-per-call» race στο append path,
  μηδέν νέο παράλληλο σύστημα, **ΜΙΑ** πηγή αλήθειας (το `pendingScene` διπλότυπο έφυγε).
- **−** Module-scope cache (WeakMap) — GC-safe, αλλά απαιτεί προσοχή σε tests (γι' αυτό το
  `clearLevelSceneManagerCache`).
- **Backward-compatible:** τα direct-`new` sites δουλεύουν αμετάβλητα (απλώς δεν cache-άρουν).

## 6. Verification

- Jest: `LevelSceneManagerAdapter.singleton` (7) + **23 colocated suites / 290 tests** στα
  migrated domains (bim grid-commits, structural cores, ribbon bridges, copy tool) GREEN.
  `useBimCopyTool` mock ενημερώθηκε (mock-άρει πλέον `createLevelSceneManagerAdapter`).
- Static import verification: όλα τα 91 αρχεία έχουν σωστό import (0 πραγματικά προβλήματα,
  2 false positives σε comment/string).
- tsc: **OOM** στο μηχάνημα (N.17 — γνωστό heap limit), δεν ολοκλήρωσε· η ορθότητα
  επιβεβαιώθηκε από τα 290 ts-jest tests (compile + runtime) + static import check.
- Browser: batch κολόνες → ΟΛΕΣ μπαίνουν + πέδιλα· ΕΝΑ Ctrl+Z = όλο το batch· single
  placement αμετάβλητο.

## 7. Changelog

- **2026-06-25** — Initial. Singleton cache στο `createLevelSceneManagerAdapter` +
  `clearLevelSceneManagerCache`; `appendEntityToScene`/`appendEntitiesToScene` → factory.
  Εύρημα: ο live-scene SSoT προϋπήρχε (`useSceneManager.levelScenesRef`). 7 νέα jest GREEN.
- **2026-06-25 (b)** — **Αφαίρεση `pendingScene`** από τον adapter → stateless pass-through.
  Κλείνει το διπλότυπο read-after-write: ΜΙΑ πηγή (root `levelScenesRef`). Επανέλεγχος
  command suites (move/join/array/compound/dimension) — μηδέν regression.
- **2026-06-25 (c)** — **Πλήρης κεντρικοποίηση (Giorgio order):** 107 `new` σε 88 αρχεία →
  `createLevelSceneManagerAdapter`. 0 `new` εκτός factory. + ratchet guard module
  `level-scene-manager-adapter`. 23 colocated suites / 290 tests GREEN + `useBimCopyTool`
  mock update. Flagged: flat-staleness tooling gap + `derived-foundation-depth.ts` drift.
