# HANDOFF — Νέος τοίχος (και εν γένει νέα οντότητα) ΔΕΝ ζωγραφίζεται live μέχρι αλλαγή εργαλείου

**Ημερομηνία:** 2026-07-01
**Προτεραιότητα:** 🔴 BLOCKER — μπλοκάρει τη δοκιμή/συνέχεια της δουλειάς στις ενώσεις τοίχων.
**Τρόπος εργασίας νέας συνεδρίας:** **PLAN MODE** — βαθιά διερεύνηση ΠΡΙΝ κώδικα.

---

## 🎯 ΤΟ ΠΡΟΒΛΗΜΑ (ακριβές σύμπτωμα)

1. Ο χρήστης **σχεδιάζει τοίχο** (wall tool) → ο τοίχος **ΔΕΝ εμφανίζεται** στον καμβά.
2. Ο τοίχος **ΔΕΝ** εμφανίζεται ούτε μετά από αναμονή 1-2s (άρα **ΔΕΝ** είναι απλώς timing του Firestore round-trip).
3. Μόλις ο χρήστης **πατήσει το εργαλείο «Επιλογή»** (αλλαγή `activeTool` → React re-render) → ο τοίχος **εμφανίζεται αμέσως**.
4. Συνοδό σύμπτωμα (ήδη διορθωμένο, βλ. §«ΤΙ ΕΓΙΝΕ ΗΔΗ»): οι **λαβές/επιλογή** είχαν σπάσει καθολικά (DXF+BIM).

**Ερμηνεία:** Ο νέος τοίχος **μπαίνει σωστά στη σκηνή** (`setLevelScene` γράφει στο `levelScenesRef`), αλλά **δεν σκανδαλίζεται redraw του καμβά** σε αλλαγή περιεχομένου σκηνής. Μόνο ένα React re-render (αλλαγή εργαλείου / pan / επιλογή) ξαναζωγραφίζει και τότε φαίνεται. Δηλαδή **ο scene-content-change → canvas-redraw trigger είναι σπασμένος**.

Παρατήρηση: **hover δουλεύει** (φωτίζει) και **pan/zoom δουλεύει** → ο καμβάς ΞΕΡΕΙ να ζωγραφίζει σε cursor/transform events. Αυτό που ΔΕΝ σκανδαλίζει redraw είναι η **αλλαγή περιεχομένου σκηνής** (νέα οντότητα) και (πριν τη διόρθωση) η **αλλαγή επιλογής** (λαβές).

---

## 🔬 ΤΙ ΕΙΝΑΙ ΕΠΙΒΕΒΑΙΩΜΕΝΟ (μη το ξανακάνεις)

- **A/B TEST (git stash) → το bug ΕΙΝΑΙ ΣΕ COMMITTED ΚΩΔΙΚΑ, ΟΧΙ στις uncommitted αλλαγές μου.** Έγινε `git stash` ΜΟΝΟ των δικών μου uncommitted (Phase 1O `wall-geometry.ts` + Phase 1N-rev2 `wall-trims-corner-resolve.ts` + tests + ADRs). Με το tree στο **καθαρό committed HEAD**, ο χρήστης ξαναδοκίμασε → **ίδιο bug**. Άρα οι δικές μου wall-join αλλαγές είναι **αθώες** για το render bug.
- **Δούλευε στην αρχή της συνεδρίας** (HEAD `0cc131b3`, στιγμιότυπο ~03:13) — οι τοίχοι εμφανίζονταν live.
- **Έσπασε μετά το commit `4473705a`** «feat(dxf): entity body-drag + wall-trim/member-snap refine» (03:20, **άλλος agent / Haiku**). Αυτό είναι το ΜΟΝΟ commit που προστέθηκε στο HEAD μέσα στη συνεδρία (`0cc131b3` → `4473705a`).

### Τι άγγιξε το `4473705a` (υποψήφια σημεία για το render bug)
```
components/dxf-layout/canvas-layer-stack-preview-mounts.tsx        (+9)   ← RENDER TREE (πρόσθεσε EntityBodyDragPreviewMount)
components/dxf-layout/canvas-layer-stack-tool-preview-mounts.tsx   (+15)  ← RENDER TREE (πρόσθεσε useEntityBodyDragPreview hook)
systems/cursor/useCentralizedMouseHandlers.ts                     (+28)  ← mousedown (body-drag arm) — ΗΔΗ διορθώθηκε το select-part
systems/cursor/mouse-handler-up.ts                                (+35)  ← mouseup (body-drag commit)
systems/drag/EntityBodyDragStore.ts / body-drag-target.ts (NEW)          ← body-drag store
hooks/tools/useEntityBodyDragPreview.ts / useEntityBodyDragCommit.ts (NEW)
systems/events/drawing-event-map.ts                               (+8)   ← event map (νέα events)
hooks/tools/useModifyTools.ts (+9) / useEntityClipboard.ts               ← ενσωμάτωση
bim/transforms/build-entity-clone-command.ts (NEW)
bim/walls/wall-trims-corner-resolve.ts (+80) / wall-trims-geometry.ts (+34) ← ΔΙΚΗ ΜΟΥ Phase 1M/1N-rev1 (μαζεύτηκε στο commit)
bim/framing/member-end-reference-snap.ts                                 ← άλλου agent (framing)
```

**Ισχυρότερη υποψία:** το `useEntityBodyDragPreview` (always-mounted ghost preview) + οι δύο `canvas-layer-stack-*preview-mounts.tsx` — άλλαξαν το **render tree** των preview layers. Πιθανό να σπάει το shared preview/overlay canvas ή τον scene-redraw trigger. **ΟΜΩΣ:** έλεγξα ότι το `useCanvasGhostPreview` όταν `isActive:false` είναι **inert** (δεν subscribe-άρει, δεν clear-άρει) → οπότε ΔΕΝ αποδείχθηκε ένοχο, ΑΛΛΑ δεν αποκλείστηκε πλήρως (π.χ. side-effect στο mount, ή αλληλεπίδραση με το UnifiedFrameScheduler). **Χρειάζεται deeper trace.**

---

## 🧭 ΠΟΥ ΝΑ ΨΑΞΕΙΣ (render/redraw pipeline — κάνε SSoT AUDIT με grep ΠΡΩΤΑ)

Ζητούμενο: **πώς μια αλλαγή ΠΕΡΙΕΧΟΜΕΝΟΥ σκηνής (νέα οντότητα) σκανδαλίζει redraw του main DXF canvas** — και γιατί δεν σκανδαλίζεται μετά το `addWallToScene`.

- `bim/walls/add-wall-to-scene.ts` → `addWallToScene()`: κάνει `accessor.setLevelScene(levelId, {...scene, entities: patched})` + `EventBus.emit('drawing:entity-created', {entity, tool:'wall'})`. **Το `setLevelScene` γράφει σε REF (`levelScenesRef`, ADR-527) → ΔΕΝ σκανδαλίζει React re-render από μόνο του.** Ποιος κάνει το redraw;
- Grep: ποιος **subscribe-άρει** σε αλλαγή σκηνής και καλεί redraw; (π.χ. `drawing:entity-created` listeners που κάνουν render, ή scene-version counter, ή `canvasEventBus`).
- `rendering/core/UnifiedFrameScheduler.ts` — ο RAF orchestrator (ADR-040). Πώς γίνεται dirty/invalidate σε scene change;
- `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` + `DxfRenderer.ts` — **bitmap cache** (ADR-040). **ΚΡΙΣΙΜΟ:** αν το cache key δεν αλλάζει όταν προστίθεται οντότητα, ο καμβάς δείχνει **στάλε cached bitmap** μέχρι invalidation (η αλλαγή εργαλείου το invalidate-άρει). Έλεγξε το cache-key/invalidation σε entity-add.
- `hooks/scene/useSceneState.ts` — scene state hook.
- `components/dxf-layout/CanvasSection.tsx` / `CanvasLayerStack.tsx` / `canvas-layer-stack-leaves.tsx` — micro-leaf subscribers (ADR-040). Τι σκανδαλίζει το redraw τους σε scene change vs tool change;
- Σύγκρινε: **τι κάνει η αλλαγή `activeTool`** που ΠΕΤΥΧΑΙΝΕΙ το redraw (React re-render του stack) — και γιατί το scene-content change ΔΕΝ το πετυχαίνει. Αυτό είναι το κλειδί.
- Grep επίσης για `bitmap` / `invalidate` / `sceneVersion` / `renderKey` / `requestRedraw` / `markDirty` στο `canvas-v2` + `rendering`.

**Πιθανές ρίζες (υποθέσεις προς επαλήθευση):**
1. Το bitmap cache δεν invalidate-άρεται σε entity-add (cache-key λείπει entity hash/count) → η αλλαγή εργαλείου το invalidate-άρει έμμεσα. **(πιο πιθανό)**
2. Ένας micro-leaf subscriber (ADR-040) που πριν άκουγε scene-change έσπασε τη subscription του λόγω του νέου preview mount στο layer stack.
3. Regression σε `UnifiedFrameScheduler` dirty-flag από το commit `4473705a`.

---

## 🏛️ ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ (Revit / AutoCAD / Maxon C4D / Figma)

- Οι μεγάλοι κάνουν **immediate incremental redraw** της επηρεαζόμενης περιοχής **τη στιγμή του commit** μιας οντότητας — **ΠΟΤΕ** δεν περιμένουν round-trip/επόμενο interaction για να φανεί. Το «σχεδιάζω → φαίνεται ΤΩΡΑ» είναι θεμελιώδες.
- **FULL ENTERPRISE + FULL SSOT** αλλά **αν οι μεγάλοι δεν προτείνουν βαρύ SSoT μηχανισμό → ακολούθησε την πρακτική τους** (Giorgio, ρητό). Πιθανότατα η σωστή λύση είναι **reuse του ΥΠΑΡΧΟΝΤΟΣ redraw/invalidate trigger** (αυτού που χρησιμοποιεί η αλλαγή εργαλείου/pan) στο σημείο του entity-commit — **ΟΧΙ** νέος μηχανισμός.

---

## ⛔ ΠΕΡΙΟΡΙΣΜΟΙ

- **COMMIT: ο Giorgio, ΟΧΙ ο agent** (N.(-1)). Ετοίμασε, σταμάτα.
- **Shared working tree με ΑΛΛΟΝ agent** (body-drag = Haiku, ADR-560· framing = member-end-reference). Άγγιξε προσεκτικά, **ΠΟΤΕ `git add -A`**, stage μόνο specific αρχεία.
- **ΟΧΙ tsc** (N.17)· jest επιτρέπεται.
- **ΜΗΝ ξαναϋλοποιήσεις** πράγματα που ήδη υπάρχουν → **SSoT audit (grep) ΠΡΩΤΑ**.

---

## ✅ ΤΙ ΕΓΙΝΕ ΗΔΗ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (UNCOMMITTED — μη τα χαλάσεις, μη τα ξανακάνεις)

**Όλα uncommitted (ο Giorgio θα κάνει commit). Τρέχον `git status`:**
```
 M docs/centralized-systems/reference/adr-index.md
 M docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 M src/subapps/dxf-viewer/bim/geometry/wall-geometry.ts                       ← Phase 1O (axis-join)
 M src/subapps/dxf-viewer/bim/walls/__tests__/wall-trims.test.ts
 M src/subapps/dxf-viewer/bim/walls/wall-trims-corner-resolve.ts              ← Phase 1N rev2 (sign-based)
 M src/subapps/dxf-viewer/systems/drag/__tests__/body-drag-target.test.ts     ← διόρθωση select/grips
 M src/subapps/dxf-viewer/systems/drag/body-drag-target.ts                    ← διόρθωση select/grips
?? docs/centralized-systems/reference/adrs/ADR-560-entity-body-drag-move-copy.md  (άλλου agent)
```

### 1) ΔΙΟΡΘΩΣΗ επιλογής/λαβών (ΕΤΟΙΜΟ, δουλεύει) — `body-drag-target.ts`
Το committed body-drag (`resolveBodyDragTarget`) όπλιζε body-drag για **κάθε hovered** οντότητα (ακόμη κι ασύνδετη) και έκανε `return` στο mousedown → κατάπινε το πρώτο κλικ → «επιλογή στα κρυφά χωρίς λαβές», **καθολικά (DXF+BIM)**. **Fix (AutoCAD select-first):** το body-drag οπλίζει **μόνο για ήδη-επιλεγμένη** οντότητα· ασύνδετη → `return null` → πέφτει στο κανονικό click-select (επιλέγει + λαβές). 12/12 jest πράσινα. **Αυτό ΔΕΝ έλυσε το render-of-new-wall (ξεχωριστό).**

### 2) ΔΟΥΛΕΙΑ ΣΤΙΣ ΕΝΩΣΕΙΣ ΤΟΙΧΩΝ (Phase 1M/1N/1O — UNCOMMITTED, εκκρεμεί browser-verify+commit)
Στόχος: γωνίες τοίχων «όπως οι μεγάλοι». Έγιναν (ADR-363 §12 changelog ενημερωμένο):
- **Phase 1M** (COMMITTED στο 4473705a): angle miter-limit (SVG/Figma ratio 4 ⇒ ~29°) — **αλλά ο Giorgio το flag-άρισε ΛΑΘΟΣ μοντέλο για τοίχους** (Revit/ArchiCAD μητράρουν αιχμηρά ακόμη & οξείες)· **εκκρεμεί απόφαση revert** — κάνε το με πραγματικό παράδειγμα μπροστά.
- **Phase 1N rev2** (uncommitted, `wall-trims-corner-resolve.ts`): ελεύθερα άκρα-L **κλείνουν** (sign-based: both-short→square/κενό-κολώνας, T→bevel, cross→miter). 491/491 bim/walls jest.
- **Phase 1O** (uncommitted, `wall-geometry.ts`): location-line join — οι **κεντρικοί άξονες (διακεκομμένες)** κλείνουν στη μήτρα (axis endpoint = midpoint(miter.outer,inner) = J). 942/942 bim/geometry jest.
- Λεπτομέρειες: auto-memory `reference_wall_corner_miter_limit_bigplayers.md` + ADR-363 §12.
- **Ροή Giorgio:** σταδιακή διόρθωση ενώσεων **μία-μία με ground-truth από DB** `floorplan_walls` (Firestore MCP `firestore_query`) → αναπαραγωγή jest → fix → next. ΟΧΙ pixels από στιγμιότυπα. Baseline: 0 walls καθαρό.

**➡️ ΜΕΤΑ το render bug, επιστρέφουμε στις ενώσεις τοίχων (σταδιακά, ground-truth από DB).**

---

## 🚦 ΠΡΟΤΕΙΝΟΜΕΝΑ ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ

1. **Καθαρό restart dev server** πρώτα (2 ώρες hot-reload churn σε αυτή τη συνεδρία): `Ctrl+C` → `npx kill-port 3000` → `npm run dev` → hard refresh. Επιβεβαίωσε ότι το bug αναπαράγεται σε καθαρό περιβάλλον (θα αναπαράγεται — είναι deterministic committed).
2. **PLAN MODE** + **SSoT audit (grep)** του redraw/invalidate pipeline (βλ. §«ΠΟΥ ΝΑ ΨΑΞΕΙΣ»).
3. Εντόπισε τον **ΥΠΑΡΧΟΝΤΑ** redraw trigger (αυτόν που χρησιμοποιεί η αλλαγή εργαλείου) → reuse στο entity-commit. Big-players: immediate incremental redraw.
4. Παρουσίασε «μεγάλοι κάνουν Χ / εμείς Υ / πρόταση Ζ», πάρε ΟΚ, μετά υλοποίηση + jest (ΟΧΙ tsc).
```
