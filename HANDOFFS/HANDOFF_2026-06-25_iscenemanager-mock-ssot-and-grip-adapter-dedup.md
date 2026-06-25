# HANDOFF — SSoT cleanup: ISceneManager test-mock SSoT + grip-adapter dedup + tooling gaps

**Ημερομηνία:** 2026-06-25
**Προτεινόμενο ADR:** ADR-528 (επιβεβαίωσε το highest — μπορεί άλλος agent να πήρε νούμερο· ADR-527 = δικό μας, ADR-526 = tekton)
**Προτεινόμενο μοντέλο:** Sonnet (κυρίως μηχανικό migration) → escalate σε Opus ΜΟΝΟ για τον grip-adapter dedup αν χρειαστεί
**Σχετικά ADR:** ADR-527 (singleton LevelSceneManagerAdapter — η βάση), ADR-294 (SSoT ratchet)

---

## 0. ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ (Giorgio, ρητά)

1. **ΠΡΙΝ ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep** (βλ. §4). Ψάξε αν υπάρχει ΗΔΗ μηχανισμός για να τον χρησιμοποιήσεις — ΜΗΝ φτιάξεις διπλότυπο.
2. **FULL ENTERPRISE + FULL SSoT** — «όπως η Revit / οι μεγάλοι παίκτες». Όχι μπαλώματα.
3. **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO** — ΟΧΙ εσύ. Ετοίμασε, σταμάτα, ανέφερε.
4. **Shared working tree** — άλλος agent δουλεύει ΤΑΥΤΟΧΡΟΝΑ. **Διάβαζε φρέσκο πριν κάθε Edit.** ΜΗΝ αγγίξεις `useColumnTool.ts`.
5. **N.17 single-tsc** — ΕΝΑ `tsc` τη φορά (έλεγξε running πρώτα). **ΠΡΟΣΟΧΗ: το tsc κάνει OOM** στο μηχάνημα — βασίσου σε jest (ts-jest compile) + static checks αντί full tsc.
6. **Staged batches** (όπως ζήτησε ο Giorgio) — ανά domain, verify ανά batch.

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (ADR-527 — context, ΜΗΝ το ξανακάνεις)

Ο `LevelSceneManagerAdapter` έγινε: singleton-per-level (cached factory `createLevelSceneManagerAdapter`) + stateless pass-through (αφαιρέθηκε το `pendingScene`) + 107 `new` σε 88 αρχεία migrated στο factory + ratchet guard + **ENA** entry point (ο `levelSceneManagerFor` wrapper ενοποιήθηκε/αφαιρέθηκε). Όλα UNCOMMITTED (ο Giorgio θα κάνει commit). Δες ADR-527.

**ΚΑΙ ο SSoT helper για τα test mocks ΥΠΑΡΧΕΙ ΗΔΗ:**
`src/subapps/dxf-viewer/core/commands/__tests__/mock-scene-manager.ts` →
`createMockSceneManager(entities?, overrides?): MockSceneManager` (Map-backed πλήρες ISceneManager + `.store` για assertions + overridable). **ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟΝ** — μην φτιάξεις άλλον.

---

## 2. Η ΔΟΥΛΕΙΑ (3 SSoT cleanups + 2 flags)

### ΕΡΓΑΣΙΑ Α (κύρια) — ~56 inline ISceneManager mocks → `createMockSceneManager`
~56 test files ορίζουν το καθένα **δικό του inline** Map-backed `ISceneManager` mock
(`makeMockScene` / `mockSceneManager` / `sceneManagerOf` / `capturingSceneManager` /
`makeSceneManager` …) = copy-paste duplication. Μετέφερέ τα ΟΛΑ στο `createMockSceneManager`.
- Κυρίως: `src/subapps/dxf-viewer/core/commands/entity-commands/__tests__/*` (~40) + `bim/**/__tests__/*`.
- **Επίσης:** `core/commands/text/__tests__/test-fixtures.ts` → το `makeScene()` του να γίνει **delegate** στο `createMockSceneManager` (όχι δεύτερη υλοποίηση).
- **ΑΦΗΣΕ** τα τετριμμένα `{} as unknown as ISceneManager` (5 αρχεία) — δεν είναι duplication.
- Προσοχή στις παραλλαγές: κάποια mocks **capture params** ή έχουν **custom snapshot** → χρησιμοποίησε το `overrides` param του helper, μην χάσεις τη συμπεριφορά.
- Verify ανά batch: `npx jest <τα touched suites>` πρέπει να μένουν GREEN.

### ΕΡΓΑΣΙΑ Β — `createGripSceneAdapter` duplicate (3ος ISceneManager adapter)
`src/subapps/dxf-viewer/hooks/grip-scene-adapter.ts` → `createGripSceneAdapter(access): ISceneManager`
**ξαναϋλοποιεί inline ΟΛΟ το ISceneManager** (addEntity/removeEntity/getEntity/updateEntity/
updateEntities/getEntityIndex/reorderEntity/moveEntityToIndex) — copy-paste του `LevelSceneManagerAdapter`.
ΜΟΝΗ ουσιαστική διαφορά: rich `updateVertex`/`getVertices` (grip geometry: polyline/line/circle-
quadrant/arc/rect-corners/angle). Έχει ΚΑΙ δικό του 2ο `LevelSceneAccess` interface.
- **Στόχος (SSoT):** ο `createGripSceneAdapter` να **reuse** τον `createLevelSceneManagerAdapter`
  για τις «βαρετές» μεθόδους και να **override** ΜΟΝΟ `updateVertex`/`getVertices` με τη grip
  geometry. Δηλ. `return { ...createLevelSceneManagerAdapter(access.getLevelScene, access.setLevelScene, access.currentLevelId), updateVertex: gripUpdateVertex, getVertices: gripGetVertices }`.
- Εξήγαγε τη grip geometry (updateVertex/getVertices switch) σε καθαρές συναρτήσεις.
- ⚠️ ΜΗΝ αλλάξεις τη grip συμπεριφορά — verify με `MoveVertexCommand` + grip tests.

### FLAG 1 (tooling gap — αποφάσισε με Giorgio αν θα διορθωθεί) — flat registry stale
`.ssot-registry-flat.txt` (που διαβάζει το pre-commit CHECK 3.7 / `check-ssot-imports.js`)
είναι **gitignored + stale** (327 JSON modules vs 302 flat = 25 modules behind) και **ΚΑΝΕΝΑ
script δεν το αναγεννά** από το JSON (`generate-ssot-baseline.sh` γράφει baseline, ΟΧΙ flat).
→ Νέα modules στο JSON δεν enforced αυτόματα. Το ADR-527 module μπήκε ΚΑΙ JSON (committed) ΚΑΙ
local flat (append). **Πρόταση:** φτιάξε γεννήτρια JSON→flat + κάλεσέ την στο pre-commit/CI.
ΠΡΟΣΟΧΗ: regenerating το flat θα ενεργοποιήσει enforcement και για τα 24 άλλα drifted modules
→ μπορεί να μπλοκάρει commits → κάνε baseline πρώτα + συζήτησε με Giorgio.

### FLAG 2 (ratchet drift) — `src/types/building/derived-foundation-depth.ts`
Committed file (f6f1507d) με 1 violation άλλου module, **λείπει από το baseline** (stale 2026-06-03).
ΔΕΝ folded στο baseline (μηδέν masking). Ξεχωριστό ratchet item — centralize ή baseline με Giorgio.

---

## 3. SCOPE / ΣΕΙΡΑ
1. Εργασία Α (56 mocks) — staged batches: `core/commands/entity-commands/__tests__/` πρώτα, μετά `bim/**`, μετά λοιπά. Verify ανά batch.
2. Εργασία Β (grip-adapter) — 1 αρχείο + verify (πιο λεπτό, ίσως Opus).
3. Flags 1-2 — ανέφερε στον Giorgio, μην τα κάνεις χωρίς έγκριση (tooling-wide ρίσκο).

---

## 4. ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT — ΤΡΕΞΕ ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

```
# 1. Ο SSoT helper υπάρχει ΗΔΗ — διάβασέ τον, χρησιμοποίησέ τον:
cat src/subapps/dxf-viewer/core/commands/__tests__/mock-scene-manager.ts

# 2. Όλα τα inline ISceneManager mocks (Εργασία Α):
grep -rlnE "new Map<string, SceneEntity>|function (makeMockScene|mockSceneManager|makeSceneManager|sceneManagerOf|capturingSceneManager)" src/subapps/dxf-viewer --include="*.test.ts" --include="*.test.tsx"

# 3. Τα τετριμμένα stubs (ΑΦΗΣΕ τα):
grep -rln "{} as unknown as ISceneManager" src/subapps/dxf-viewer --include="*.test.ts"

# 4. Ο grip-adapter duplicate (Εργασία Β):
cat src/subapps/dxf-viewer/hooks/grip-scene-adapter.ts
grep -rn "createGripSceneAdapter" src/subapps/dxf-viewer    # call-sites

# 5. Ο canonical factory (reuse target για Εργασία Β):
grep -n "export function createLevelSceneManagerAdapter" src/subapps/dxf-viewer/systems/entity-creation/LevelSceneManagerAdapter.ts

# 6. Επιβεβαίωσε ότι ΚΑΝΕΝΑ νέο `new LevelSceneManagerAdapter` δεν μπήκε (ratchet):
grep -rn "new LevelSceneManagerAdapter(" src/subapps/dxf-viewer | grep -v "LevelSceneManagerAdapter.ts:"
```

---

## 5. VERIFICATION
- Jest ανά batch (ts-jest = compile check). tsc: **OOM** — ΜΗΝ βασιστείς σε full tsc· static import-check + jest.
- Μηδέν regression στα touched suites. Ο `createMockSceneManager` πρέπει να καλύπτει κάθε mock shape (αλλιώς overrides).
- Browser: άσχετο (test-only + grip dedup → verify grip drag χειροκίνητα αν αγγίξεις Εργασία Β).

## 6. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ commit/push (ο Giorgio).
- ΜΗΝ φτιάξεις 2ο mock helper — υπάρχει `createMockSceneManager`.
- ΜΗΝ αγγίξεις `useColumnTool.ts` (άλλος agent).
- ΜΗΝ αλλάξεις grip geometry συμπεριφορά στην Εργασία Β.
- ΜΗΝ regenerate-άρεις το flat registry χωρίς έγκριση (24 άλλα modules).
