# HANDOFF — ADR-535 Φ5b: depth occlusion λαβών 3D (Revit/Maxon-grade, FULL ENTERPRISE + FULL SSOT)

**Date:** 2026-06-26 · **ADR:** ADR-535 (`docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md`)
**Στόχος (εντολή Giorgio):** Οι λαβές (grips) επεξεργασίας στην 3D προβολή να εμφανίζουν **μόνο το πρώτο πλάνο** — μια λαβή κρυμμένη πίσω από οποιαδήποτε στερεή επιφάνεια (άλλη οντότητα **Ή** το ίδιο το σώμα της επιλεγμένης οντότητας) να **μην** φαίνεται. «Όπως οι μεγάλοι — Revit / Maxon (Cinema 4D). FULL ENTERPRISE + FULL SSOT.»

---

## 0. ⚠️ ΔΙΑΒΑΣΕ ΠΡΩΤΑ — ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ

1. **SHARED WORKING TREE** — δουλεύουν **ΚΑΙ άλλοι agents** ταυτόχρονα. Τρέξε `git status` στην αρχή. **ΜΗΝ** αγγίξεις/κάνεις stage αρχεία που δεν αναγνωρίζεις. Ξένα αρχεία αυτή τη στιγμή (ADR-536 Cinema4D selection outline + ADR-534 BOQ): `SelectionOutlinePass.ts`, `selection-outline-tokens.ts`, `BimSelectionHighlighter.ts`, `ssao-modulator.ts`, `ThreeJsSceneManager.ts`, `scene-render-frame.ts`, `scene-rendering-subsystems.ts`, `ADR-534-*.md`, `beam-rebar-3d.ts`, `bim-three-structural-converters.ts`. **ΘΑ τα διαβάσεις (SSoT audit) αλλά ΔΕΝ τα τροποποιείς χωρίς λόγο.**
2. **COMMIT/PUSH ΤΟΝ ΚΑΝΕΙ Ο GIORGIO — ΕΣΥ ΠΟΤΕ** (όχι `git add`, όχι commit, όχι push — N.(-1)).
3. **FULL ENTERPRISE + FULL SSOT:** **ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep** (δες §4). Αν υπάρχει ήδη κεντρικά → reuse, ΜΗΔΕΝ διπλότυπα. Zero `any`/`as any`/`@ts-ignore` (N.2)· functions ≤40 γρ., files ≤500 γρ. (N.7.1)· μηδέν inline styles (N.3, εξαίρεση δυναμική θέση)· zero hardcoded strings i18n (N.11).
4. **tsc: ΕΝΑΣ τη φορά (N.17)** — έλεγξε running tsc ΠΡΙΝ (`Get-CimInstance Win32_Process … '*tsc*'`). Full-project `tsc --noEmit` κάνει OOM → προτίμησε colocated jest (ts-jest = full type-check) + temp `import *` smoke test.
5. **Απάντα στον Giorgio ΣΤΑ ΕΛΛΗΝΙΚΑ** (language rule).
6. **ADR-040 / CHECK 6B/6D:** αγγίζεις bim-3d edit + canvas αρχεία → στο commit ο Giorgio κάνει **stage ADR-535 + ADR-040**.

---

## 1. ΤΙ ΥΠΑΡΧΕΙ ΣΗΜΕΡΑ (Φ5 ΟΛΟΚΛΗΡΩΘΗΚΕ, UNCOMMITTED)

Οι λαβές 3D **είναι πλέον 2D σύμβολα σε overlay `<canvas>`** πάνω από το WebGL (ADR-535 Φ5), που ζωγραφίζονται με τον **ΙΔΙΟ** 2D `UnifiedGripRenderer` + τα ΙΔΙΑ settings → ίδιο μέγεθος/σχήμα/χρώμα με τη 2D κάτοψη, τέλειο κεντράρισμα, συνεχές zoom. **Browser-verified από Giorgio: «οι λαβές είναι σωστές, ίδιο μέγεθος με τις 2D».**

### Δικά μου αρχεία Φ5 (working, λαβές ΠΑΝΤΑ ορατές — ON TOP, χωρίς occlusion):
| Αρχείο | Ρόλος |
|---|---|
| `bim-3d/viewport/grips/BimGripOverlay2D.tsx` | React leaf· Canvas2D overlay· RAF 60fps (mirror `CropRegionOverlay`)· DPR· ζωγραφίζει με `new UnifiedGripRenderer(ctx, project).renderGripSetBatched(configs, settings)`. Mount στο `BimViewport3D.tsx`. **Εδώ θα μπει το occlusion cull.** |
| `bim-3d/grips/grip-3d-screen-project.ts` | PURE `makeGripPlanToCanvas(camera, canvas, elevFor)` → plan-mm→canvas-local px (reuse `dxfPlanToWorld`+`worldToScreen`). **ΕΝΑ projection SSoT** overlay+hit-test. behind-camera→`GRIP_OFFSCREEN`. |
| `bim-3d/grips/grip-3d-screen-hit-test.ts` | PURE `findGripAtScreen(grips, project, x, y, radiusPx, accept?)` nearest-wins screen-space. **Έχει ήδη optional `accept` predicate** για occlusion-aware pick. |
| `bim-3d/stores/Grip3DOverlayStore.ts` | LOW-freq zustand `{grips, elevFor}` + setGrips/clear· **non-reactive** mutable `grip3DOverlayInteraction {hoverIndex, drag.livePlanPos}` (ADR-040 zero React state, mirror HoverStore· ο RAF το διαβάζει imperatively). |
| `bim-3d/grips/bim-grip-controller-3d.ts` | screen-space FSM (hover/drag/`gripAt`)· `hitTest()` καλεί `findGripAtScreen`. drag projection ray∩plane ΜΕΝΕΙ 3D. |
| `bim-3d/animation/bim3d-grip-drag.ts` | `refreshReshapeGrips` → `useGrip3DOverlayStore.setGrips(grips, elevFor)`· 4 `PlanElevationMmFor` resolvers (slab `slabTopZmmAt`/roof `roofZmm`/slab-opening host/floor-finish flat). |
| `bim-3d/animation/use-bim3d-edit-interaction.ts` | δημιουργεί `BimGripController3D`. |
| `bim-3d/animation/bim3d-edit-interaction-handlers.ts` | pointer wiring (grip-first hit-test, drag, contextmenu Φ4). |

**Tests (176/176 GREEN):** `grip-3d-screen-project` (3), `grip-3d-screen-hit-test` (4), + Φ1–Φ4 suites αμετάβλητα. Baseline: `npx jest "src/subapps/dxf-viewer/bim-3d/grips" "src/subapps/dxf-viewer/bim-3d/animation/__tests__"`.

---

## 2. ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙΣ (occlusion) + ΤΙ ΑΠΕΤΥΧΕ ΗΔΗ

**Ζητούμενο (AskUserQuestion, Giorgio επέλεξε Option B):** «Πλήρες βάθος — μόνο πρώτο πλάνο, ΚΑΙ για την ίδια την οντότητα». Δηλ. πλάκα οροφής που την κοιτάς από κάτω → οι **πάνω** λαβές της **κρύβονται** (πίσω από το σώμα της)· γυρνάς από πάνω → εμφανίζονται. Λαβή πίσω από τοίχο → κρύβεται.

**ΤΙ ΔΟΚΙΜΑΣΑ ΚΑΙ ΑΠΕΤΥΧΕ (CPU raycaster-per-grip — ΜΗΝ το ξαναδοκιμάσεις):**
- Έφτιαξα `grip-3d-occlusion.ts` με `isGripOccluded` = `THREE.Raycaster` από κάμερα→λαβή, `far = dist − ε`, occlusion μόνο από στερεά `THREE.Mesh` (αγνοούσε lines), `RAY.camera` set.
- **(α)** Full-depth (χωρίς εξαιρέσεις) → **έκοβε ΚΑΙ τις μπροστινές λαβές** → «ΔΕΝ ΒΛΕΠΩ ΚΑΘΟΛΟΥ ΤΙΣ ΛΑΒΕΣ». **ROOT CAUSE (υπόθεση):** οι λαβές πατάνε στο `elevFor` (slabTopZmmAt+base) αλλά μάλλον **βυθίζονται ελάχιστα κάτω** από τη rendered mesh-επιφάνεια → το raycast χτυπά την επιφάνεια λίγο πιο κοντά → occluded ακόμα κι από πάνω. (Οπτικά φαίνονται κεντραρισμένες γιατί το Z-error προβάλλεται σε αμελητέο screen offset.)
- **(β)** `selfIds` (εξαίρεσε το mesh της επιλεγμένης οντότητας από το raycast) → λαβές εμφανίζονταν αλλά **«μέσα από» το σώμα** (όχι foreground-only) → Giorgio: όχι.
- **(γ)** Back-face cull (κάθετος επιφάνειας `(−∂e/∂x,1,∂e/∂y)` vs κάμερα) → έκρυβε **τα πάντα κάτω από τον ισημερινό** → Giorgio: «θέλω να βλέπω και από κάτω… όχι, τελικά μόνο πρώτο πλάνο» (= Option B).

**ΣΥΜΠΕΡΑΣΜΑ:** το **CPU raycast-per-grip είναι λάθος εργαλείο** (coplanar self-cull + per-frame κόστος + float drift). Όλος αυτός ο κώδικας **ΔΙΑΓΡΑΦΗΚΕ**· οι λαβές είναι τώρα **πάντα ορατές (ON TOP)** = καθαρή λειτουργική βάση.

---

## 3. Ο ΣΩΣΤΟΣ ΤΡΟΠΟΣ (Revit / Maxon-grade) — GPU DEPTH

Οι «μεγάλοι» κάνουν occlusion handles με τη **GPU depth** της σκηνής, όχι με CPU raycast. Δύο enterprise δρόμοι — διάλεξε μετά το SSoT audit:

### Δρόμος A — depth-buffer sampling (κρατά το Canvas2D overlay SSoT του Φ5)
1. Από τη σκηνή υπάρχει ήδη **depth** (το `SSAOPass` τρέχει normal/depth pre-pass — δες §4). Πάρε/φτιάξε ένα `DepthTexture` (ή reuse του SSAOPass).
2. Στον overlay, για κάθε λαβή: NDC depth της (από `worldToNdc`/`project`) vs το **scene depth** στο grip pixel. Αν scene_depth < grip_depth − bias → occluded → skip.
3. Το διάβασμα depth: είτε GPU (shader/RT) είτε throttled `readRenderTargetPixels` (≈20 λαβές → λίγα pixels· πρόσεξε sync stall — μην το κάνεις per-frame αλόγιστα· cache ανά frame).
4. **Bias** (μερικά mm σε NDC) απορροφά το «βύθισμα» — λύνει το root cause του (α).

### Δρόμος B — in-scene billboarded depth-tested handles (ο πιο «Cinema 4D» τρόπος)
Αντί Canvas2D overlay, ζωγράφισε τις λαβές ως **screen-space-sized billboard quads ΜΕΣΑ στη WebGL σκηνή** με `depthTest: true, depthWrite: false` + `polygonOffset`/depth bias, με texture/shader που μιμείται ΑΚΡΙΒΩΣ το 7px τετράγωνο του `UnifiedGripRenderer`. Η GPU κάνει το occlusion **σωστά** (με bias για coplanar). **Trade-off:** χάνεις το «literally ο ίδιος Canvas2D κώδικας» — πρέπει να αναπαραστήσεις το look. **ΠΡΟΗΓΟΥΜΕΝΟ:** το Φ1 (pre-Φ5) ήταν 3D meshes με `depthTest+polygonOffset` και το occlusion **δούλευε** — απλώς ο Giorgio ήθελε 2D look. Ο δρόμος B = «2D look + GPU depth».

**Σύσταση:** ξεκίνα από SSoT audit του depth infra (§4). Αν το `SSAOPass`/composer εκθέτει εκμεταλλεύσιμο depth texture → Δρόμος A (ελάχιστη αλλαγή, κρατά Φ5). Αλλιώς Δρόμος B (billboards). **ΡΩΤΑ τον Giorgio ποιον δρόμο προτιμά αν είναι αμφίσημο** (μεγάλη αρχιτεκτονική απόφαση).

---

## 4. SSoT AUDIT — ΥΠΟΧΡΕΩΤΙΚΟ grep ΠΡΙΝ ΓΡΑΨΕΙΣ (μηδέν διπλότυπα)

Υπάρχει ΗΔΗ depth / post-processing / depth-aware compositing infrastructure — **ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟ, μη φτιάξεις νέο depth pass:**

| Ανάγκη | Πού να ψάξεις (grep) |
|---|---|
| Scene depth / normal buffer | `bim-3d/lighting/ssao-modulator.ts` — `EffectComposer` + `SSAOPass` (subclass `BimSSAOPass`)· έχει εσωτερικά normal/depth render targets. Grep `SSAOPass`, `normalRenderTarget`, `depthTexture`, `beautyRenderTarget`. |
| **Cinema4D-style depth-aware pass (το ΑΚΡΙΒΕΣ precedent του αιτήματος Giorgio)** | `bim-3d/systems/selection/SelectionOutlinePass.ts` (ADR-536, «Cinema4D selection silhouette outline»). Δες πώς κάνει depth-aware composite πάνω από τη σκηνή — **πιθανότατα ο ίδιος μηχανισμός που χρειάζεσαι**. (ξένου agent — διάβασε, μην το σπάσεις.) |
| Render orchestration / πού μπαίνει pass | `bim-3d/scene/scene-render-frame.ts`, `bim-3d/scene/scene-rendering-subsystems.ts`, `bim-3d/scene/ThreeJsSceneManager.ts` (`getCamera`, `bimLayer.group`, `renderer`, `composer`). |
| world→NDC / depth math | `bim-3d/viewport/coordinate-transforms.ts` — `worldToNdc`, `worldToScreen`, `getPixelWorldSize`, `dxfPlanToWorld` (ΗΔΗ τα χρησιμοποιεί ο overlay). |
| 2D grip draw SSoT (ΜΗΝ το αγγίξεις) | `rendering/grips/UnifiedGripRenderer.ts` + `getGripPreviewStyle` (`hooks/useGripPreviewStyle.ts`). |
| frame scheduling | `rendering/core/UnifiedFrameScheduler.ts` + `manager.markSceneDirty()`. |

**Επίσης ξανα-grep ΚΑΘΕ symbol/path του §1 — shared tree, μπορεί να άλλαξε.**

---

## 5. ΣΧΕΔΙΟ (αφού κάνεις audit)

1. **SSoT audit** §4 → αποφάσισε Δρόμος A vs B (ρώτα Giorgio αν αμφίσημο).
2. Φτιάξε **ΕΝΑ** pure occlusion module (π.χ. `grips/grip-3d-depth-occlusion.ts`) που reuse-άρει το υπάρχον depth infra — `isGripVisibleAtDepth(gripWorld/ndc, sceneDepth, bias)`.
3. Wire στο **overlay** (cull πριν το `configs.push`) **και** στον **controller** `hitTest` (μέσω του ΗΔΗ υπάρχοντος `accept` param του `findGripAtScreen`) → κρυμμένη λαβή ούτε φαίνεται ούτε επιλέγεται.
4. **Η σερνόμενη λαβή πάντα ορατή** (drag leads the edit) — μην την κόβεις.
5. Colocated jest (PURE depth test με γνωστά depths/bias) + browser-verify με Giorgio (πλάκα από κάτω→κρυμμένες, από πάνω→ορατές, πίσω από τοίχο→κρυμμένες).
6. ADR-535 changelog Φ5b + πίνακας φάσεων (Φ5b 🔴→✅).

---

## 6. ΚΡΙΣΙΜΕΣ ΠΑΓΙΔΕΣ
1. **Coplanar self-cull** (το root cause του CPU raycast): η μπροστινή λαβή πατάει στην επιφάνειά της → χρειάζεσαι **bias** ώστε να ΜΗΝ κρύβεται από τη δική της επιφάνεια, αλλά ΝΑ κρύβεται όταν είναι πραγματικά πίσω. Το depth-bias το λύνει φυσικά (όπως το `depthTest` με `polygonOffset`).
2. **Per-frame κόστος:** μη κάνεις sync `readRenderTargetPixels` αλόγιστα κάθε frame — cache/throttle.
3. **Section cut / multi-floor:** το `SelectionOutlinePass` σχόλιο λέει ότι κάποια paths bypass-άρουν τον SSAO composer — βεβαιώσου ότι το depth είναι διαθέσιμο σε ΟΛΑ τα render paths.
4. **Shared tree:** το depth infra ανήκει σε ξένο agent (ADR-536) — αν χρειαστεί να το επεκτείνεις, συντόνισε/ρώτα Giorgio.

## 7. ΠΗΓΕΣ (γρήγορα links)
- ADR: `docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md` (changelog Φ5 + πίνακας φάσεων· Φ5b = DEFER).
- Φ5 overlay: `bim-3d/viewport/grips/BimGripOverlay2D.tsx`.
- depth precedent: `bim-3d/lighting/ssao-modulator.ts` + `bim-3d/systems/selection/SelectionOutlinePass.ts` (ADR-536).
- Memory: `reference_3d_viewport_entity_grips.md`.
