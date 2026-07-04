# HANDOFF — Δομοστατικός recompute σε μετακίνηση ΜΗ-δομικού entity + ΔΙΑΦΟΡΕΣ μεταξύ 2 gestures μετακίνησης

**Ημ/νία:** 2026-07-04
**Subapp:** DXF Viewer (`src/subapps/dxf-viewer/`)
**ADRs:** ADR-459 (structural organism connectivity / proactive reactions) · ADR-507 §8 (SnapshotTransformCommand) · ADR-540 (associative-geometry-reconcile) · ADR-470 (structural component visibility) · ADR-040 (preview canvas)
**Κατάσταση working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** — `git add <specific>` ΜΟΝΟ, verify `git diff --cached`, ΠΟΤΕ `git restore .`/`reset --hard`/checkout άλλων αρχείων. **Commit τον κάνει ΜΟΝΟ ο Giorgio.**
**Μοντέλο:** Opus 4.8 (debug + αρχιτεκτονική, cross-cutting).
**Κανόνες:** ΟΧΙ `tsc` (N.17) — μόνο jest. ΟΧΙ `any`/`as any`. **Plan Mode ΠΡΩΤΑ** + **πραγματικό SSoT audit (grep)** πριν οποιονδήποτε κώδικα. Υλοποίηση **FULL ENTERPRISE + FULL SSOT**, με πρότυπο **Revit / Maxon Cinema 4D / Figma-level**· αν οι μεγάλοι παίκτες ΔΕΝ προτείνουν full-SSoT κάπου, ακολουθούμε **τη δική τους πρακτική**.

---

## 🔴 ΤΟ ΠΡΟΒΛΗΜΑ (παρατηρήσεις Giorgio — ΑΝΟΙΧΤΑ, ΜΗ ΛΥΜΕΝΑ)

Ο Giorgio επιλέγει μια **απλή γραμμή DXF** και τη μετακινεί. Παρατηρεί:

1. **Δομοστατικός σε όλο το κτίριο σε μετακίνηση γραμμής.** Μόλις αφήνει τη γραμμή στη νέα θέση, εμφανίζονται toasts:
   - 🟢 «N μέλη έλαβαν αυτόματο φορτίο» (`structural.loadsComputed`)
   - 🔵 «Κανένα μέλος δεν χρειαζόταν οπλισμό» (`structural.autoReinforced`)
   → τρέχει πραγματικός load-takedown + οπλισμός σε ΟΛΟ το κτίριο. **ΛΑΘΟΣ** — γραμμή = μη-δομικό.
   **Συμβαίνει και με τα ΔΥΟ gestures μετακίνησης** (βλ. §Gestures).

2. **Τα δύο gestures μετακίνησης ΔΕΝ συμπεριφέρονται ίδια — ο Giorgio βλέπει ΔΙΑΦΟΡΕΣ** (ρητά: «ΟΧΙ ΔΕΝ ΤΟ ΚΑΝΟΥΝ, ΒΛΕΠΩ ΔΙΑΦΟΡΕΣ»):
   - **(3)** Μια **λευκή πινακίδα με μαύρα γράμματα** ΔΕΝ εξαφανίζεται (persist μετά τη μετακίνηση).
   - **(4)** **Κυανές γραμμές ΔΕΝ εμφανίζονται** (σε ένα από τα δύο gestures λείπουν — προφανώς selection/preview highlight).

   ➡️ **Ζητούμενο Giorgio:** τα δύο gestures να χρησιμοποιούν **τον ΙΔΙΟ κώδικα / τη μία SSoT** (input adapter → μία move transaction), όπως οι μεγάλοι παίκτες. Χρειάζεται **οπτική διερεύνηση side-by-side** των δύο gestures για να εντοπιστούν ΟΛΕΣ οι διαφορές (πινακίδα, κυανές γραμμές, toasts) + ενοποίηση.

---

## 🟡 ΤΑ ΔΥΟ GESTURES ΜΕΤΑΚΙΝΗΣΗΣ (τι βρέθηκε μέχρι τώρα)

| Gesture | Πώς ξεκινά | Commit path |
|---|---|---|
| **A. Select → drag** | επιλογή γραμμής, μετά σύρσιμο | `MoveEntityCommand` / `MoveMultipleEntitiesCommand` |
| **B. Body-drag** | κλικ + **παρατεταμένο πάτημα στο σώμα** + σύρσιμο | `useEntityBodyDragCommit.ts:79-82` → **ίδιες** `MoveEntityCommand` / `MoveMultipleEntitiesCommand` |

**Στο επίπεδο ΕΝΤΟΛΗΣ φαίνονται ενοποιημένα** (και τα δύο → `MoveEntityCommand` → `SnapshotTransformCommand.executeInPlace` → `reconcileAssociativeGeometry` → emit `bim:entities-moved`). **ΟΜΩΣ ο Giorgio βλέπει οπτικές/συμπεριφορικές διαφορές** → η ενοποίηση **ΔΕΝ είναι πλήρης** σε επίπεδο **preview / selection / cleanup**:
- Το **preview** του body-drag ζει σε ξεχωριστό hook: `hooks/tools/useEntityBodyDragPreview.ts` (ghost + rubber-band + dim-pill).
- Το **preview** του Move tool ζει σε `useMovePreview` (διαφορετικό hook).
- Πιθανή ρίζα των «διαφορών»: διαφορετικά preview/selection/label lifecycles μεταξύ των δύο gestures (η «λευκή πινακίδα» + «κυανές γραμμές» πιθανόν είναι preview/selection artifacts που καθαρίζονται στο ένα path αλλά όχι στο άλλο).

---

## ✅ ΤΙ ΕΓΙΝΕ ΗΔΗ (UNCOMMITTED — jest-proven ΑΛΛΑ ΔΕΝ έλυσε το browser σύμπτωμα)

Structural-relevance gate — ώστε μη-δομικό move/create να μην τρέχει δομοστατικό. **Αποδεδειγμένα σωστό στο jest** (mount πραγματικού hook + emit `bim:entities-moved` με γραμμή → ο `runStructuralLoadTakedown` ΔΕΝ καλείται· με κολόνα → καλείται). **19/19 GREEN.**

**Αρχεία (uncommitted):**
- 🆕 `src/subapps/dxf-viewer/types/structural-entity-types.ts` — SSoT `STRUCTURAL_MEMBER_TYPES` (column/beam/wall/slab/stair/foundation) + `isStructuralMemberType`/`isStructuralMemberEntity`.
- 🆕 `src/subapps/dxf-viewer/hooks/structural-relevant-trigger.ts` — `eventTouchesStructuralMember(ev, payload)` gate.
- ✏️ `src/subapps/dxf-viewer/hooks/useGroupedStructuralReaction.ts` — gate στο `schedule()` (καλύπτει και τα 4 proactive hooks).
- ✏️ `src/subapps/dxf-viewer/hooks/useStructuralComponentOverride.ts` — Boy-Scout: private `isStructuralEntity` → delegate στο SSoT.
- 🆕 `src/subapps/dxf-viewer/hooks/__tests__/structural-relevant-trigger.test.ts` (16 predicate assertions).
- 🆕 `src/subapps/dxf-viewer/hooks/__tests__/useProactiveStructuralLoads-relevance.test.ts` (3 wiring assertions).
- ✏️ `docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md` — changelog v17.

**⚠️ ΤΟ ΠΑΡΑΔΟΞΟ (το κλειδί της επόμενης έρευνας):** ο gate είναι jest-proven, αλλά ο Giorgio βλέπει **ΑΚΟΜΑ** το toast στον browser. Άρα ΕΙΤΕ (α) stale dev bundle (τα 2 νέα modules θέλουν restart `npm run dev`), ΕΙΤΕ **(β) υπάρχει ΑΛΛΟ, μη-gated μονοπάτι** που εκπέμπει `bim:structural-loads-computed`/`bim:structural-auto-reinforced` σε move γραμμής, το οποίο **δεν βρέθηκε ακόμα**. → **ΠΡΩΤΗ ΔΟΥΛΕΙΑ ΤΗΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ: instrumentation για να βρεθεί ο ΠΡΑΓΜΑΤΙΚΟΣ caller.**

---

## 🗺️ ΧΑΡΤΗΣ PIPELINE (ό,τι ιχνηλατήθηκε — μη τον ξανα-βρίσκεις)

**Move → event:**
- `hooks/tools/useEntityBodyDragCommit.ts:79-82` — body-drag → `MoveEntityCommand`.
- `core/commands/entity-commands/MoveEntityCommand.ts` — `MoveEntityCommand`/`MoveMultipleEntitiesCommand extends MoveCommandBase extends SnapshotTransformCommand` (κανένα δικό του emit).
- `core/commands/entity-commands/SnapshotTransformCommand.ts:142-168` — `executeInPlace` → `reconcileAssociativeGeometry(...)`.
- `bim/cascade/associative-geometry-reconcile.ts:92` — **emit `bim:entities-moved` { movedEntities }** (byId = announceEntities + reframed beams).

**Proactive hooks (όλα μέσω του gated `useGroupedStructuralReaction`):**
- `hooks/useProactiveStructuralLoads.ts:57` (`bim:entities-moved` στο PROACTIVE_LOAD_EVENTS) → `runStructuralLoadTakedown`.
- `hooks/useProactiveOrganismReinforce.ts:43` → `runOrganismAutoReinforce`.
- `hooks/useProactiveMemberSizing.ts:49` → `runMemberAutoSize`.
- `hooks/useAutoFoundationDesign.tsx:38` → `runAutoFoundationDesign`.
- Gate SSoT: `hooks/useGroupedStructuralReaction.ts` → `eventTouchesStructuralMember` (`hooks/structural-relevant-trigger.ts`).

**Toast εκπομπείς (οι ΜΟΝΟΙ που εκπέμπουν τα δύο events — grep-verified):**
- `hooks/structural-load-takedown-core.ts:86` → emit `bim:structural-loads-computed`.
- `hooks/structural-auto-reinforce-core.ts:125` → emit `bim:structural-auto-reinforced`.
- Callers: **(1)** τα 2 gated proactive hooks · **(2)** `structural-auto-study-core.ts` `runAutoStudy` (γρ. 189/192) — καλείται ΜΟΝΟ από `useStructuralAutoStudy.ts:48` σε ρητό `bim:auto-study-requested` (κουμπί) · **(3)** ribbon `useStructuralLoadTakedown`/`useStructuralAutoReinforce` (ρητά κουμπιά).

**Toast surface:** `hooks/notifications/structural-attach-notifications.ts:71` (auto-reinforced) + `:104` (loads-computed).

**Άλλοι subscribers του `bim:entities-moved` (ΟΧΙ gated από το fix — έλεγξε αν κάποιος τρέχει loads/reinforce έμμεσα):**
- `hooks/useStructuralOrganism.ts:38` — **δικό του `queueMicrotask`** (ΟΧΙ useGroupedStructuralReaction). Τρέχει `runOrganismDiagnostics` (`structural-organism-core.ts`) → **μόνο diagnostics + emit `bim:structural-organism-updated`**. ⚠️ Επιβεβαιώθηκε ότι ΔΕΝ τρέχει loads/reinforce — ΑΛΛΑ ξανα-έλεγξέ το (μήπως `organism-updated` πυροδοτεί κάτι που δεν είδα).
- `hooks/data/useBimEntityMovedPersistEffect.ts:47` — persistence.
- `hooks/tools/useSpecialTools-wall-retrim.ts:33` — wall retrim.
- `hooks/useProactiveStructuralAnalysis.ts:94` — ακούει `bim:structural-loads-computed`/`organism-updated`, **engaged-gated + silent** (ΟΧΙ toast).

---

## 🎯 ΣΧΕΔΙΟ ΓΙΑ ΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ (Plan Mode → deep research → impl)

**ΒΗΜΑ 0 — SSoT AUDIT (grep) ΠΡΙΝ ΚΩΔΙΚΑ (υποχρεωτικό):**
- grep: `runStructuralLoadTakedown|runOrganismAutoReinforce|structural-loads-computed|structural-auto-reinforced` → επιβεβαίωσε ΟΛΟΥΣ τους callers.
- grep: `MoveEntityCommand|MoveMultipleEntitiesCommand|useMovePreview|useEntityBodyDragPreview|EntityBodyDragStore` → χαρτογράφησε πλήρως τα ΔΥΟ move gestures (command + preview + selection + cleanup) για να βρεις τις ΔΙΑΦΟΡΕΣ.
- grep για υπάρχον unify/adapter: μήπως υπάρχει ήδη κοινός move-preview/selection SSoT να χρησιμοποιηθεί (μη φτιάξεις διπλότυπο).

**ΒΗΜΑ 1 — ΒΡΕΣ ΤΟΝ ΠΡΑΓΜΑΤΙΚΟ ΕΚΠΟΜΠΕΑ ΤΩΝ TOASTS (instrumentation, ΟΧΙ υπόθεση):**
- Βάλε προσωρινό `logger.warn('[LOADS EMIT]', new Error().stack)` στα emit points (`structural-load-takedown-core.ts:86` + `structural-auto-reinforce-core.ts:125`).
- Ζήτα από Giorgio να μετακινήσει γραμμή → διάβασε το stack trace στην κονσόλα → βρες ΠΟΙΟΣ ακριβώς καλεί τον core (proactive hook; auto-study; κάτι άλλο;).
- Παράλληλα: επιβεβαίωσε αν το stale-bundle ισχύει (restart `npm run dev` + hard refresh) ΠΡΙΝ κατηγορήσεις τον κώδικα.

**ΒΗΜΑ 2 — ΕΝΟΠΟΙΗΣΗ GESTURES (big-player practice):**
- Revit/Cinema4D/Figma: κάθε gesture μετακίνησης = λεπτός input adapter → **ΜΙΑ** move transaction + **ΕΝΑ** preview/selection lifecycle. Η reactive ανάλυση φιλτράρεται με (α) τι άλλαξε + (β) analysis engaged.
- Εντόπισε γιατί το body-drag αφήνει **λευκή πινακίδα** (persist) + γιατί λείπουν **κυανές γραμμές** (selection/preview) σε σχέση με το select→drag. Ενοποίησε preview/selection/cleanup στη μία SSoT.
- Screenshot-driven: ζήτα από Giorgio screenshots και των δύο gestures (πριν/κατά/μετά) για να ταυτοποιήσεις κάθε artifact (λευκή πινακίδα = ; κυανές γραμμές = selection highlight;).

**ΒΗΜΑ 3 — ΥΛΟΠΟΙΗΣΗ (FULL ENTERPRISE + FULL SSOT):**
- Ο structural-relevance gate (ήδη γραμμένος) μένει ως βάση — αλλά επιβεβαίωσε ότι πιάνει ΟΛΟ το πρόβλημα αφού βρεθεί ο πραγματικός εκπομπέας.
- ADR update (Phase 3) + jest (ΟΧΙ tsc).

---

## 🚫 ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ κάνεις commit/push (μόνο Giorgio).
- ΜΗΝ bulk `git restore .`/`reset --hard` (κοινό tree).
- ΟΧΙ `tsc` (N.17) — μόνο jest.
- ΜΗΝ γράψεις κώδικα πριν το SSoT audit (grep) + Plan Mode.
- ΜΗΝ υποθέσεις ότι το toast φταίει ο κώδικας πριν το instrumentation stack-trace (μπορεί να είναι stale bundle).
