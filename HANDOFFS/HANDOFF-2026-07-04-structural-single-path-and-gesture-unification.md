# HANDOFF — Structural single-path relevance (DONE) + gesture unification (PENDING)

**Ημ/νία:** 2026-07-04 · **Subapp:** DXF Viewer · **Μοντέλο:** Opus 4.8
**ADRs:** ADR-459 (v17→v18→v19), ADR-560 (body-drag), ADR-040 (preview perf)
**⚠️ Shared tree:** ΕΝΕΡΓΟΣ explode agent (commits ζωντανά). `git add <specific>` ΜΟΝΟ. Commit → μόνο Giorgio.

---

## ✅ ΟΛΟΚΛΗΡΩΘΗΚΕ (uncommitted v19 + committed v18)

### 1. Δομοστατικός recompute σε μη-δομικό move — ΛΥΘΗΚΕ πλήρως
- **Root (instrumentation stack-trace, όχι υπόθεση):** ο `useWallRetrimEffect` άκουγε generic `bim:entities-moved` → σε line-move έτρεχε `recomputeWallTrims` → (cold, 1η φορά) walls «άλλαζαν» → re-emit structural → proactive loads → toast «45 μέλη». Γι' αυτό **μόνο 1η φορά** μετά από hard refresh.
- **v19 SINGLE-PATH (Giorgio order «ένα μονοπάτι, big-player»):** NEW `hooks/useStructuralRelevanceRouter.ts` = το ΕΝΑ chokepoint· ακούει `bim:entities-moved`+`drawing:entity-created`, φιλτράρει με SSoT `isStructuralMemberEntity`, εκπέμπει σημασιολογικό **`bim:structural-geometry-changed`** μόνο για δομικά. ΟΛΟΙ οι 6 reactors (loads/reinforce/sizing/foundation/organism/wall-retrim) ακούν ΑΥΤΟ → μηδέν per-subscriber gate.
- **Superseded/διαγράφηκαν:** `hooks/structural-relevant-trigger.ts`(+test) (v17 predicate)· gate αφαιρέθηκε από `useGroupedStructuralReaction`+wall-retrim (v18).
- **Tests:** NEW `useStructuralRelevanceRouter.test.ts`(6) + relevance tests ξαναγράφτηκαν end-to-end. **48 structural jest GREEN** (21 relevance/router/edit-triggers + 27 cores).

### 2. Body-drag κυανά ίχνη flaky — ΛΥΘΗΚΕ (v18, committed 0f76850a)
- `useEntityBodyDragPreview` υπολογίζει tracking **resolve-in-draw** (mirror useMovePreview, self-contained) αντί cross-tick store → τέλος timing-skew.

### Αρχεία v19 (ΔΙΚΑ ΜΟΥ — stage μόνο αυτά):
`hooks/useStructuralRelevanceRouter.ts`(NEW) + test(NEW) · `useProactiveStructuralLoads/OrganismReinforce/MemberSizing.ts` · `useAutoFoundationDesign.tsx` · `useStructuralOrganism.ts` · `useGroupedStructuralReaction.ts` · `structural-geometry-edit-triggers.ts` · `types/structural-entity-types.ts` · `hooks/tools/useSpecialTools-wall-retrim.ts` · `systems/events/drawing-event-map-bim.ts` · `app/DxfViewerContent.tsx` · `__tests__/useProactiveStructuralLoads-relevance.test.ts` · `hooks/tools/__tests__/wall-retrim-relevance.test.ts` · `docs/.../ADR-459.md` · **ΔΙΑΓΡΑΦΗ** `structural-relevant-trigger.ts`(+test).
**ΟΧΙ δικά μου (explode agent):** `add-column-to-scene.test.ts`, `systems/explode/*`, `RibbonButtonIcon.tsx`, `WallSingleIcon.tsx`, `ADR-443`, `ADR-510`, `HANDOFF-explode-*`.

---

## 🔴 ΑΝΟΙΧΤΟ — hover/click regression (ο Giorgio το κοιτά)
Δεν δουλεύει hover/highlight/click-select-to-drag. **Αποκλείστηκε ότι είναι δικό μου:** (α) v19 δεν αγγίζει hover/hit-test/selection/mouse-handlers· (β) grep-verified ότι ο router ΔΕΝ κάνει event-loop (load-takedown δεν ξανα-εκπέμπει `bim:entities-moved`)· (γ) body-drag preview τρέχει μόνο σε active drag (όχι hover). **Πιθανά:** Fast-Refresh hook-order (πρόσθεσα hook στο DxfViewerContent → hard refresh το λύνει) Ή commit `0f76850a` (explode: ribbon/tool-state/commands). **Χρειάζεται console error για βεβαιότητα.**

---

## 🔬 ΝΕΟ ΕΥΡΗΜΑ (2026-07-04) — τα «κυανά ίχνη» ΔΕΝ εμφανίζονται ΠΟΥΘΕΝΑ (global bug, ΟΧΙ δικό μου)
**Giorgio confirmed:** ούτε το body-drag ούτε το **2-click Move tool** δείχνουν κυανά — με **POLAR=ON, ΟΡΘΟ=OFF** (σωστές προϋποθέσεις). Το Move tool δείχνει μόνο κίτρινη rubber-band (#FFD700) + κόκκινο σταυρό (#FF4444) + πινακίδα. Η «λευκή πινακίδα ΚΑΤΑ το σύρσιμο» = απλώς το else-branch (κανένα tracking → πινακίδα). **Άρα cyan+πινακίδα = ΕΝΑ σύμπτωμα: ο resolver δίνει null.**
**Το body-drag ΠΟΤΕ δεν έδειχνε cyan** — και ΠΡΙΝ το resolve-in-draw fix μου (το store το γέμιζε ο ΙΔΙΟΣ resolver). Άρα το fix μου (v18, committed) είναι σωστή robustness βελτίωση ΑΛΛΑ **ΟΧΙ** το ορατό fix.
**Χάρτης διάγνωσης (traced):** `useMovePreview`/`useEntityBodyDragPreview` → `resolveActionAlignmentTracking` (dim-alignment-tracking.ts:101) → `resolveDimAlignmentTracking` (:56, anchor μπαίνει ως refAnchor) → `composeTrackingSnap` (ambient-tracking-compose.ts:61) → **`resolveTrackingSnap` (tracking-resolver.ts:94) επιστρέφει null**. Ύποπτα: (α) `worldTolerance = pixelsToWorld(3, scale)` = **μόλις 3px** → σχεδόν αδύνατο να «πιάσεις» την H/V γραμμή με το χέρι κατά το drag· (β) `findClosestProjection`/`buildAlignmentPaths` για ΕΝΑ μόνο anchor (ΔΕΝ διαβάστηκαν ακόμα). **Το creation flow ΔΕΙΧΝΕΙ cyan (;) → σύγκρινε πώς διαφέρει (acquisition/tolerance).**
**ΕΠΟΜΕΝΟ (fresh session):** διάβασε `buildAlignmentPaths` + `findClosestProjection` (tracking-resolver.ts)· έλεγξε αν το 3px tolerance είναι ο ένοχος (πιθανό fix: μεγαλύτερη ανοχή για action-drag, π.χ. 6-8px, ή pull-to-line)· επιβεβαίωσε ότι το creation flow όντως δείχνει cyan για baseline.

## ⏳ PENDING — gesture unification (σκέλος Β, Giorgio: «πλήρης ενοποίηση ΟΛΩΝ»)
**Επιπλέον οπτική διαφορά (επιβεβαιωμένη):** Move tool = rubber-band + crosshair + πινακίδα· body-drag = μόνο πινακίδα. Ενοποίηση = πρόσθεσε rubber-band+crosshair στο body-drag (ή αφαίρεσε από Move) — design choice Giorgio.
Πρότυπο = #2 Move tool (self-contained). Απομένουν:
- **B2-grip:** grip resolve-in-draw. Χρειάζεται extraction: shared `resolveGripDragTracking(gripState,scene,scale)` (από το σώμα του `applyGripDragAlignmentTracking`, `grip-drag-alignment-tracking.ts`) που καλούν ΚΑΙ ο mouse-handler-move ΚΑΙ το `useGripGhostPreview` draw (αντί getGripAlignmentTracking store-read στο :301/:325). Grip-kind-specific anchors (dim/line).
- **B3 origin dimming:** `movePreviewActive` (CanvasLayerStack, ADR-040 micro-leaf) → true και σε body-drag+grip. ⚠️ perf-critical.
- **B4 cleanup:** ρητό canvas clear στο commit body-drag/grip (mirror useMoveTool.ts:204) + guard-gap `mouse-handler-up.ts:149` (`EntityBodyDragStore.clear()` πριν τον `button===0&&!wasPanning`).
- **Οπτική απόφαση (χρειάζεται screenshot Giorgio):** πινακίδα «additive» (Move) vs «either/or» (body/grip· σκόπιμο — trace tooltip ήδη δείχνει απόσταση). Οι «κυανές» είναι `#CCCCCC` (naming smell· cyan `#29B6F6`=listeningDim).
- **RESUME όταν:** (1) hover σταθερό, (2) Giorgio στέλνει screenshot «λευκή πινακίδα».

## Κανόνες: ΟΧΙ tsc (jest μόνο) · ΟΧΙ any · commit/push μόνο Giorgio · git add specific.
