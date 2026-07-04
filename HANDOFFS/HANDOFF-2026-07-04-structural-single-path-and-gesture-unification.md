# HANDOFF — DXF Viewer: δομοστατικό single-path (DONE) + gesture/cyan (OPEN)

**Ημ/νία:** 2026-07-04 · **Subapp:** `src/subapps/dxf-viewer/` · **Μοντέλο:** Opus 4.8
**ADRs:** ADR-459 (v17→v18→v19), ADR-560, ADR-562/357/508 (alignment tracking), ADR-040 (preview perf)
**⚠️ SHARED TREE:** ΕΝΕΡΓΟΣ **explode agent** (commit-άρει ζωντανά). `git add <specific>` ΜΟΝΟ · verify `git diff --cached` · ΠΟΤΕ bulk reset/restore. **Commit/push → ΜΟΝΟ Giorgio.** ΟΧΙ tsc (jest μόνο). ΟΧΙ `any`.

---

## ✅ ΟΛΟΚΛΗΡΩΘΗΚΕ & ΕΠΙΒΕΒΑΙΩΘΗΚΕ ΑΠΟ GIORGIO (μην τα ξαναφτιάξεις)

### Θέμα 1 — Δομοστατικός recompute σε μη-δομικό move → **ΛΥΘΗΚΕ**
- **Σύμπτωμα:** σύρσιμο απλής **γραμμής DXF** → toast «N μέλη έλαβαν φορτίο» + έτρεχε full load-takedown/οπλισμός σε όλο το κτίριο. Εμφανιζόταν **μόνο 1η φορά μετά από hard refresh**.
- **Root (instrumentation stack-trace, ΟΧΙ υπόθεση):** ο `useWallRetrimEffect` άκουγε generic `bim:entities-moved` για ΚΑΘΕ entity → line-move → `recomputeWallTrims` → (cold, 1η φορά) walls «άλλαζαν» → re-emit structural → proactive loads → toast. Idempotent → μετά όχι.
- **Λύση v19 SINGLE-PATH (Giorgio order «ένα μονοπάτι, big-player»):**
  - NEW `hooks/useStructuralRelevanceRouter.ts` = **το ΕΝΑ chokepoint**: ακούει `bim:entities-moved`+`drawing:entity-created`, φιλτράρει με SSoT `isStructuralMemberEntity`, εκπέμπει σημασιολογικό **`bim:structural-geometry-changed`** μόνο για δομικά.
  - ΟΛΟΙ οι 6 reactors (loads/reinforce/sizing/foundation/organism/wall-retrim) ακούν ΑΥΤΟ → **μηδέν per-subscriber gate** (αδύνατο να ξεχαστεί ξανά).
  - Διαγράφηκε το superseded `structural-relevant-trigger.ts`(+test)· gate αφαιρέθηκε από `useGroupedStructuralReaction`.
- **Επιβεβαίωση Giorgio (browser):** μετακίνηση γραμμής = **μηδέν toast** ✓ · μετακίνηση κολόνας = δομοστατικά δουλεύουν ✓.
- **Tests:** 48 structural jest GREEN (νέο `useStructuralRelevanceRouter.test.ts` 6 + relevance tests end-to-end + 27 cores).

### Θέμα 2 — Body-drag alignment resolve-in-draw (robustness) → committed
- `useEntityBodyDragPreview` υπολογίζει tracking **τοπικά στο draw** (mirror useMovePreview) αντί cross-tick store. Σωστή βελτίωση ΑΛΛΑ **ΔΕΝ** ήταν το ορατό fix των cyan (βλ. Θέμα 4).

### Commit state
- **Committed ήδη** (Giorgio/explode bundling): `eeb066db` (v17 + body-drag base), `0f76850a` (v18 wall-retrim gate + body-drag resolve-in-draw + explode work).
- **UNCOMMITTED = v19, ΔΙΚΑ ΜΟΥ (stage ΜΟΝΟ αυτά):**
  `hooks/useStructuralRelevanceRouter.ts`(NEW) · `hooks/__tests__/useStructuralRelevanceRouter.test.ts`(NEW) · `hooks/tools/__tests__/wall-retrim-relevance.test.ts` · `hooks/useProactiveStructuralLoads.ts` · `hooks/useProactiveOrganismReinforce.ts` · `hooks/useProactiveMemberSizing.ts` · `hooks/useAutoFoundationDesign.tsx` · `hooks/useStructuralOrganism.ts` · `hooks/useGroupedStructuralReaction.ts` · `hooks/structural-geometry-edit-triggers.ts` · `types/structural-entity-types.ts` · `hooks/tools/useSpecialTools-wall-retrim.ts` · `systems/events/drawing-event-map-bim.ts` · `app/DxfViewerContent.tsx` · `hooks/__tests__/useProactiveStructuralLoads-relevance.test.ts` · `docs/.../ADR-459-structural-organism-connectivity.md` · **ΔΙΑΓΡΑΦΗ (D):** `hooks/structural-relevant-trigger.ts` + `hooks/__tests__/structural-relevant-trigger.test.ts`.
- **ΟΧΙ δικά μου (explode agent — ΜΗΝ σταθεροποιήσεις):** `bim/columns/__tests__/add-column-to-scene.test.ts`, `systems/explode/*`, `core/commands/entity-commands/ExplodeEntityCommand.ts`+index, `ui/ribbon/**` (RibbonButtonIcon, WallSingleIcon, home-tab-modify, useDxfViewerRibbon, useExplodeRibbonAction), `systems/entity-creation/inherit-entity-style.ts`, `ADR-443`, `ADR-510`, `HANDOFF-explode-*`.

---

## 🔴 ΑΝΟΙΧΤΑ ΠΡΟΒΛΗΜΑΤΑ (νέα συνεδρία)

### ΠΡΟΒΛΗΜΑ Α (κύριο) — τα «κυανά ίχνη ευθυγράμμισης» ΔΕΝ εμφανίζονται ΠΟΥΘΕΝΑ
- **Επιβεβαιωμένο (Giorgio):** ούτε body-drag ούτε **2-click Move tool** δείχνουν κυανά — με **POLAR=ON, ΟΡΘΟ=OFF** (σωστές προϋποθέσεις). Move tool δείχνει μόνο κίτρινη rubber-band + κόκκινο σταυρό + πινακίδα.
- **Καθολικό, ΟΧΙ gesture-specific, ΟΧΙ από τις αλλαγές μου.** Το feature (ADR-562/560, πρόσφατο) μάλλον **ποτέ δεν δούλεψε οπτικά** στο drag.
- **«Λευκή πινακίδα ΚΑΤΑ το σύρσιμο» = ίδιο πρόβλημα:** είναι το else-branch (κανένα tracking → πινακίδα). Φτιάξε τα cyan → η πινακίδα κρύβεται μόνη (either/or). **ΔΕΝ** χρειάζεται ξεχωριστό cleanup/B4.
- **ΠΛΗΡΗΣ ΧΑΡΤΗΣ (traced):**
  `useMovePreview`/`useEntityBodyDragPreview` (draw) → `resolveActionAlignmentTracking` (`hooks/dimensions/dim-alignment-tracking.ts:101`) → `resolveDimAlignmentTracking` (:56 — anchor μπαίνει ως refAnchor, tolerance=`pixelsToWorld(3,scale)`) → `composeTrackingSnap` (`systems/tracking/ambient-tracking-compose.ts:61`) → **`resolveTrackingSnap` (`systems/tracking/tracking-resolver.ts:94`) επιστρέφει null** (γρ. 119 intersection / 122 projection).
- **ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ:**
  1. Baseline: επιβεβαίωσε αν το **creation flow** (σχεδίαση γραμμής, `drawing-hover-handler.ts:124-130`) ΟΝΤΩΣ δείχνει cyan. Αν ΟΧΙ → σπασμένο παντού. Αν ΝΑΙ → σύγκρινε τι διαφέρει (acquisition points; tolerance;).
  2. Διάβασε `buildAlignmentPaths` + `findClosestProjection` (`tracking-resolver.ts`) — γιατί null για ΕΝΑ anchor.
  3. **Ύποπτος #1:** ανοχή **3px** πολύ στενή για hand-drag → δοκίμασε ~6-8px για action-drag ροές (ή pull-to-line μαγνήτη). Ίσως το creation flow «πιάνει» επειδή ο cursor snap-άρει σε osnap πρώτα.
  4. Toggles Giorgio κατά το test: **POLAR=ON, ΟΡΘΟ=OFF, AutoAlign=ON**.

### ΠΡΟΒΛΗΜΑ Β — οπτική διαφορά gestures (ενοποίηση, Giorgio: «πλήρης ενοποίηση ΟΛΩΝ»)
- **Επιβεβαιωμένο:** Move tool (2-click) = rubber-band(#FFD700) + crosshair(#FF4444) + πινακίδα. Body-drag = **μόνο** πινακίδα (χωρίς rubber-band/crosshair). Grip = δικό του leader/πινακίδα.
- **3 move paths:** body-drag (`EntityBodyDragStore`+`useEntityBodyDragPreview`) · 2-click Move (`activeTool='move'`+`useMovePreview`+`useMoveTool`) · grip (`GripDragStore`+`useGripGhostPreview`). Όλα → `MoveEntityCommand`.
- **Ενοποίηση (design choice Giorgio):** πρόσθεσε rubber-band+crosshair στο body-drag (ή αφαίρεσέ τα από Move) ώστε να δείχνουν ίδια. + κοινό paint SSoT για πινακίδα/cyan (`drawMoveDistanceOverlay`).
- **Origin dimming (B3):** `movePreviewActive` (`CanvasLayerStack.tsx`, ADR-040 micro-leaf) είναι true μόνο για Move tool → το πρωτότυπο θαμπώνει· σε body-drag ΟΧΙ (δύο συμπαγή αντίγραφα). Ενοποίησε (⚠️ perf-critical, leaf subscriber pattern).
- **Grip resolve-in-draw (consistency):** extraction `resolveGripDragTracking(gripState,scene,scale)` από το σώμα του `applyGripDragAlignmentTracking` (`systems/cursor/grip-drag-alignment-tracking.ts:30`) που καλούν ΚΑΙ mouse-handler-move ΚΑΙ το `useGripGhostPreview` draw (:301/:325 store-read). ⚠️ Χαμηλή προτεραιότητα — πρώτα λύσε το ΠΡΟΒΛΗΜΑ Α (αλλιώς grip resolve-in-draw δίνει κι αυτό null).
- **Naming smell:** τα «κυανά» είναι στην πράξη `#CCCCCC` (γκρι, `OVERLAY_LINE_COLORS.alignment`)· cyan `#29B6F6`=listeningDim.

### ΠΡΟΒΛΗΜΑ Γ — pre-existing failing test (explode agent, ΟΧΙ δικό μου)
- `bim/columns/__tests__/add-column-to-scene.test.ts › commitHotGripCopy → copy` αποτυγχάνει (expected 2 entities, got 1). Το τροποποίησε ο explode agent· αποτυγχάνει και σε isolated run **χωρίς** τα αρχεία μου. Δικό τους domain.

---

## 📋 ΣΕΙΡΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. (Αν δεν έγινε) commit v19 δομοστατικά αρχεία (μόνο δικά μου).
2. **ΠΡΟΒΛΗΜΑ Α** (cyan resolver) — το πιο σημαντικό, ξεμπλοκάρει και το grip.
3. **ΠΡΟΒΛΗΜΑ Β** (visual unification + origin dimming + grip) αφού λυθεί το Α.
4. Screenshot-driven επιβεβαίωση σε κάθε βήμα. jest μόνο.

---

## 📎 PASTE-PROMPT ΓΙΑ ΝΕΑ ΣΥΝΕΔΡΙΑ
> Διάβασε ΠΡΩΤΑ: `C:\Nestor_Pagonis\HANDOFFS\HANDOFF-2026-07-04-structural-single-path-and-gesture-unification.md`
>
> Το δομοστατικό single-path (v19) είναι DONE & confirmed (μην το ξαναφτιάξεις — απλώς βεβαιώσου ότι έγινε commit). ΘΕΜΑ ΤΩΡΑ: **ΠΡΟΒΛΗΜΑ Α — τα κυανά ίχνη ευθυγράμμισης δεν εμφανίζονται σε ΚΑΝΕΝΑ move gesture** (ούτε στο 2-click Move tool), με POLAR=ON/ΟΡΘΟ=OFF/AutoAlign=ON. Καθολικό bug στον tracking resolver (`resolveTrackingSnap` επιστρέφει null), ΟΧΙ gesture-specific. Ο πλήρης χάρτης διάγνωσης είναι στο handoff.
>
> ΚΑΝΕ: (1) Plan Mode + SSoT audit (grep) πριν κώδικα. (2) Baseline: επιβεβαίωσε αν το creation flow (σχεδίαση γραμμής) δείχνει cyan — αν ναι, βρες τι διαφέρει από το drag· αν όχι, το feature είναι σπασμένο παντού. (3) Διάβασε `buildAlignmentPaths`+`findClosestProjection` (tracking-resolver.ts)· έλεγξε την υποψία της ανοχής 3px. (4) Screenshot-driven. (5) jest μόνο (ΟΧΙ tsc), ΟΧΙ any, commit μόνο Giorgio, shared tree με explode agent → git add specific.
