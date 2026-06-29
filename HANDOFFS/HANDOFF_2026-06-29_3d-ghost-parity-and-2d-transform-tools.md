# HANDOFF — 3D ghost parity (original→φάντασμα) + 2D transform-tools WYSIWYG

**Ημ/νία:** 2026-06-29 · **ADR:** 550 (Unified Entity Render Contract) + 040 + 049 · **Model:** Opus 4.8
**Working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** (γράφει σε `bim-3d/scene/*`, beam-structural, foundation-grips κ.ά. — έχει **προϋπάρχοντα tsc errors που ΔΕΝ είναι δικά μας**).
**COMMIT/PUSH μόνο ο Giorgio.** Ποτέ `--no-verify`, ποτέ `git add -A`. Όλα **UNCOMMITTED**. Απάντα **Ελληνικά**.

---

## 0. ΤΙ ΖΗΤΗΘΗΚΕ (νέα συνεδρία)
Εφάρμοσε την **ΙΔΙΑ ακριβώς λογική φαντασμάτων** του 2D καμβά και στον **3D καμβά**, σε **ΟΠΟΙΑΔΗΠΟΤΕ όψη** (top/perspective/…).
**Συμπτωμα (Giorgio):** στο 3D top-view, όταν μετακινώ entity, το **φάντασμα μετακινείται** αλλά το **αρχικό ΕΞΑΦΑΝΙΖΕΤΑΙ** και μένουν μόνο οι λαβές.
**Στόχος:** το μετακινούμενο αντίγραφο = **πραγματική μορφή** (ήδη ισχύει στο 3D για rigid move), και το αρχικό στη θέση εκκίνησης = **dimmed φάντασμα** (ΟΧΙ κρυμμένο). **ΜΙΑ πηγή αλήθειας 2D + 3D.**
**Επιπλέον (εγκεκριμένο):** **Phase 2** — τα 2D ribbon εργαλεία Stretch/Scale/Rotate να περάσουν από το ίδιο `drawRealEntityPreview` (τώρα έχουν δικό τους simplified ghost).

**Doctrine (Giorgio):** big-player parity (**Revit / Maxon Cinema 4D / Figma-level**). **FULL ENTERPRISE + FULL SSOT.** Αν οι μεγάλοι δεν το προτείνουν → ακολούθησε την πρακτική τους.
**🚨 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ:** πραγματικό **SSoT audit με grep** — βρες αν υπάρχει ήδη αντίστοιχος κώδικας ώστε να τον **reuse**-άρεις, ΜΗΝ φτιάξεις διπλότυπο. Ο Giorgio θα ρωτήσει σκληρά «κεντρικοποιημένο; υπάρχει SSoT; διπλότυπο; θα το έκανε έτσι η Google;».

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (2D — Phase 1, UNCOMMITTED) — Η ΒΑΣΗ ΓΙΑ MIRROR
Το 2D moving-copy preview πλέον περνά από τον **ΠΡΑΓΜΑΤΙΚΟ** renderer (όχι simplified silhouette), με το αρχικό = dimmed ghost. **Αυτά τα SSoT primitives να τα ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ/MIRROR-άρεις:**

| Αρχείο (2D) | Ρόλος — SSoT |
|---|---|
| `rendering/ghost/draw-real-entity-preview.ts` | `drawRealEntityPreview(bimPreview, transformed, layersById, t, vp)` — κοινός glue· **Phase 2 το καλεί** |
| `canvas-v2/preview-canvas/bim-preview-render.ts` | `BimPreviewRenderer` — real `EntityRendererComposite` σε preview ctx (2D) |
| `canvas-v2/dxf-canvas/dxf-renderer-style-resolve.ts` | `resolveEntityRenderStyle(entity, layersById?)` — style SSoT canvas+preview |
| `hooks/tools/useBimPreviewRenderer.ts` | lazy renderer-per-ctx (κοινό) |
| `rendering/ghost/apply-entity-preview.ts` | μετασχηματισμένο entity (full geometry, incl. slab/roof/floor-finish recompute) |
| 2D inverted-ghost dimming | `dxf-types.ts gripDraggedEntityId` + `dxf-canvas-renderer.ts` (`movePreviewActive \|\| selId===gripDraggedEntityId`) + `CanvasLayerStack.tsx` |

**Η 2D «policy»:** moving copy = real (full opacity)· original = ghost (`GHOST_DEFAULTS.alpha` = 0.45, `rendering/ghost/index.ts`).
**Διαγράφηκε** το interim `ghost-solid-color.ts` (superseded). Followers (pipes/partners) μένουν translucent.
**Verify 2D:** 60 jest GREEN· tsc καθαρό στα δικά μας αρχεία.

---

## 2. PART A — 3D GHOST PARITY (κύριο task)

### 2.1 Ρίζα (επιβεβαιωμένη με grep)
`bim-3d/animation/bim3d-edit-live-preview.ts` — κατά το rigid move/rotate **ΚΡΥΒΕΙ** τα originals:
- γρ.50-52: «Originals captured for a rigid move/rotate preview (restored on cancel)» / «Originals hidden for a resize preview».
- πολλαπλά `o.visible = false` (γρ.200/236/271/300 …) για originals + dependents (walls/conduits/pipes/fittings).
Δηλαδή το moving mesh **είναι ήδη πραγματικό** (rebuild = ghost≡commit), αλλά το original **εξαφανίζεται** αντί να γίνεται φάντασμα → ακριβώς το σύμπτωμα.

### 2.2 Συνεργαζόμενα 3D αρχεία (ξεκίνα grep audit εδώ)
- `bim-3d/animation/bim3d-edit-live-preview.ts` (capture/hide/restore originals — **εδώ ζει η αλλαγή**)
- `bim-3d/animation/bim3d-edit-live-preview-apply.ts` · `bim3d-edit-interaction-handlers.ts` · `use-bim3d-edit-interaction.ts`
- 3D grips overlay (2D-drawn): `bim-3d/viewport/grips/BimGripOverlay2D.tsx`, `stores/Grip3DOverlayStore.ts` (γιατί «μένουν μόνο οι λαβές»)
- `bim-3d/scene/ThreeJsSceneManager.ts` (⚠️ άλλος agent γράφει εδώ — προσοχή)

### 2.3 SSoT audit ΥΠΟΧΡΕΩΤΙΚΟ (grep ΠΡΙΝ κώδικα) — υπάρχει ήδη 3D ghost material;
- **ΨΑΞΕ** `bim-3d/placement/placement-ghost-overlay.ts` (ADR-537 — mustard ghost, unlit + post-fx, «11 ghosts migrated»). Πιθανότατα **ΥΠΑΡΧΕΙ ΗΔΗ** SSoT για 3D ghost material/χρώμα/opacity → **reuse**, ΜΗΝ φτιάξεις νέο.
- ΨΑΞΕ επίσης: `bim-3d/proposal/ProposalGhost3DOverlay.tsx`, `bim-3d/scene/post-fx-overlay-pass.ts`, τυχόν `ghost`/`silhouette`/`unlit` material factory.
- **Στόχος SSoT:** ΕΝΑΣ «ghost-ize a three mesh» helper (apply ghost material/opacity, restore) — αν δεν υπάρχει, φτιάξ' τον **κεντρικό** και κάν' τον reuse από placement + edit-preview.

### 2.4 Προτεινόμενη κατεύθυνση (επιβεβαίωσε με audit)
Στο `bim3d-edit-live-preview.ts`: αντί `original.visible = false`, εφάρμοσε **ghost material** (semi-transparent, ίδια «policy» με 2D alpha) στο original (restore on commit/cancel). Το moving mesh μένει real. **Καθολικό για κάθε όψη** (το material δουλεύει σε όλες τις camera views — δεν εξαρτάται από projection).

### 2.5 «ΜΙΑ πηγή αλήθειας 2D+3D» (Giorgio)
2D=Canvas2D, 3D=WebGL → δεν μοιράζονται render code. Αλλά **η policy** μπορεί: εξέτασε ΕΝΑ shared SSoT για τον κανόνα «original=ghost, moving=real» + το **alpha** (το 2D `GHOST_DEFAULTS.alpha=0.45`). Πρότεινε στον Giorgio κοινό `ghost-policy` constant/SSoT αν αξίζει (μην over-engineer αν οι μεγάλοι δεν το κάνουν — Revit/C4D έχουν χωριστά render backends αλλά κοινή UX policy).

---

## 3. PART B — Phase 2: 2D Stretch/Scale/Rotate → real renderer (εγκεκριμένο)
Τα `hooks/tools/useStretchPreview.ts` (χρησιμοποιεί shared `drawGhostEntity`), `useScalePreview.ts` + `useRotationPreview.ts` (έχουν **LOCAL** `drawGhostEntity` με basePoint+angle/scale) → να περάσουν από `drawRealEntityPreview` (όπως useGripGhostPreview/useMovePreview).
- ⚠️ Scale/Rotate χρειάζονται τον μετασχηματισμό μέσω `applyEntityPreview` (rotate/scale-aware) ή ισοδύναμο — **grep** πώς παράγουν το transformed entity· αν δεν περνούν από `applyEntityPreview`, βρες/φτιάξε κοινό path (μην διπλασιάσεις geometry math).
- Original = ghost: τα transform tools θέλουν το ίδιο dimming (movePreviewActive-style) — έλεγξε αν εφαρμόζεται ήδη.

---

## 4. VERIFY / ΕΚΚΡΕΜΗ
- **tsc:** το full-project OOM-άρει στα 8GB λόγω **errors άλλων agents** (shared tree). Verify με **jest + στατικό grep** στα δικά σου αρχεία (καθιερωμένη πρακτική N.17).
- **Browser-verify** (http://localhost:3000/dxf/viewer): 3D move σε top **ΚΑΙ** perspective → original=ghost ορατό, moving=real· grips σωστά· κάθε entity type· + 2D Stretch/Scale/Rotate real.
- **CHECK 6B/6D:** οποιοδήποτε ADR-040-sensitive αρχείο → stage **ADR-040** (+049/550). 3D edit αρχεία: έλεγξε αν είναι στη λίστα ADR-040· αλλιώς stage ADR-550.
- **Commit:** ΜΟΝΟ ο Giorgio.

## 5. ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ κρύψεις/πειράξεις δουλειά του άλλου agent στο `ThreeJsSceneManager.ts` / beam-structural / foundation-grips (προϋπάρχοντα tsc errors = δικά τους).
- ΜΗΝ φτιάξεις νέο 3D ghost material αν υπάρχει ήδη (audit `placement-ghost-overlay.ts` ΠΡΩΤΑ).
- ΜΗΝ διπλασιάσεις geometry/transform math για Scale/Rotate — reuse `applyEntityPreview`/υπάρχοντα.
- ΜΗΝ commit/push. ΜΗΝ `--no-verify`. ΜΗΝ `git add -A`.
