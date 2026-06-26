# HANDOFF — Cinema 4D / Revit-style **selection silhouette outline** στο BIM 3D viewport

**Ημ/νία:** 2026-06-26 · **Γλώσσα στον Giorgio: ΕΛΛΗΝΙΚΑ πάντα.**
**Τύπος εργασίας:** UX/render — 3D selection highlight (cross-cutting: render loop + selection system).

---

## 🎯 ΣΤΟΧΟΣ (τι ζήτησε ο Giorgio)

Όταν επιλέγεις μια οντότητα στο BIM 3D (DXF Viewer), **να φωτίζεται ΜΟΝΟ το εξωτερικό
περίγραμμα (silhouette outline) με ΚΙΤΡΙΝΗ/πορτοκαλί γραμμή** — όπως κάνει το **Cinema 4D
(Maxon)** και το Revit. **ΟΧΙ** όλες οι ακμές· **ΟΧΙ** βάψιμο όλου του σώματος. Το σώμα
(mesh material) μένει **αναλλοίωτο**.

**Σήμερα (πρόβλημα):** `BimSelectionHighlighter` κλωνοποιεί το material και βάζει
**emissive κίτρινο σε ΟΛΟ το mesh** → «βάφεται όλο το σώμα» (ο Giorgio το θεωρεί άσχημο).

**Revit-grade, FULL enterprise + FULL SSoT.** Όχι `any`/`@ts-ignore`· functions ≤40γρ· files ≤500.

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH μόνο ο Giorgio.** ΠΟΤΕ εσύ. Όταν τελειώσεις → σταμάτα & ανάφερε.
- **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** (δουλεύει σε `bim-3d/animation/*`, `bim-3d/grips/*`,
  `bim/slab-openings/*`, `bim/floor-finishes/*`, `hooks/grip-computation.ts` — ADR-535).
  **ΠΟΤΕ `git add -A`/`git add .` — μόνο specific files.** **Re-grep + `git status` στην αρχή.**
- **ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep) ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα** → reuse, ΜΗΝ φτιάχνεις
  διπλότυπο. (Giorgio: «θα το έκανε έτσι η Maxon/Revit;»)
- **N.17:** ΕΝΑ `tsc` τη φορά (full tsc OOM — verify με ts-jest). Έλεγξε αν τρέχει ήδη άλλος.
- **N.11:** μηδέν hardcoded strings — i18n keys σε `el`+`en` ΠΡΙΝ τη χρήση (αν προστεθεί UI label/tooltip).
- 100% ειλικρίνεια: verify με jest· δήλωσε ρητά τι ΔΕΝ επιβεβαιώθηκε σε browser (selection = visual → ο Giorgio κάνει την τελική οπτική επιβεβαίωση).
- **Μοντέλο:** Opus (3D postprocessing pipeline + selection system, cross-cutting).

---

## ✅ ΑΠΟΦΑΣΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ (επιβεβαιωμένη από SSoT audit)

**Λύση = `OutlinePass`** (`three/addons/postprocessing/OutlinePass.js` — **ΥΠΑΡΧΕΙ** στο
`node_modules/three/examples/jsm/postprocessing/`). Είναι ΑΚΡΙΒΩΣ το Cinema 4D effect: silhouette
glow γύρω από τα `selectedObjects`, **χωρίς** αλλαγή του material τους. Δείχνει **μόνο το εξωτερικό
περίγραμμα** (όχι όλες τις ακμές) — ό,τι ζήτησε ο Giorgio.

**Εναλλακτικές που ΑΠΟΡΡΙΦΘΗΚΑΝ:** (α) `EdgesGeometry` → δείχνει ΟΛΕΣ τις ακμές (όχι silhouette).
(β) inverted-hull → χοντρό/ανακριβές σε σύνθετα σχήματα. **OutlinePass = ο σωστός Revit/Maxon τρόπος.**

---

## 🔬 SSoT REUSE POINTERS (ό,τι ΥΠΑΡΧΕΙ ΗΔΗ — REUSE, ΜΗΝ ξαναγράψεις)

| SSoT | Πού | Τι κάνει / πώς το χρησιμοποιείς |
|---|---|---|
| **`BimSelectionHighlighter`** | `bim-3d/systems/selection/BimSelectionHighlighter.ts` | Το **τρέχον** highlight (emissive `0xffd700` σε όλο το mesh). **ΕΔΩ είναι το πρόβλημα.** Έχει ΗΔΗ το lifecycle: group-traverse ανά `userData.bimId`, diff old/new set, clone+restore. **Reuse το lifecycle** — απλά αντί για emissive mutation → τάισε `OutlinePass.selectedObjects` με τα matching meshes. Instantiated: `ThreeJsSceneManager.ts:121` (`new BimSelectionHighlighter(this.bimLayer.group)`). |
| **callers του highlighter** | `bim-3d/scene/scene-manager-actions.ts:71,109,238` | `selectionHighlighter.onSelect(new Set(selectedIds))` / `onClear()`. **Μην αλλάξεις το API** — κράτα `onSelect/onClear` ίδια signature ώστε οι callers να μένουν ανέγγιχτοι. |
| **`Selection3DStore`** | `bim-3d/stores/Selection3DStore.ts` (`useSelection3DStore`, zustand `subscribeWithSelector`) | Η πηγή των selected ids (multi-select). Οι callers ήδη το διαβάζουν → σου δίνουν τα ids. Για το OutlinePass χρειάζεσαι τα **THREE.Mesh objects** → group-traverse ανά bimId (ίδιο pattern με τον highlighter). |
| **`SSAOModulator` + EffectComposer** | `bim-3d/lighting/ssao-modulator.ts` | Έχει ΗΔΗ `EffectComposer` (`RenderPass`+`ssaoPass`+`copyPass`, γρ.77-80) + `RenderPass`/`EffectComposer` imports από `three/addons`. **Reuse τα imports/pattern.** ⚠️ Τρέχει **μόνο on-idle** (δες κρίσιμο σημείο παρακάτω). |
| **render dispatch** | `bim-3d/scene/scene-render-frame.ts:58-83` | **3 paths:** (1) pathTracer· (2) `ssaoModulator.render()` = composer **ΜΟΝΟ όταν η κάμερα ηρεμήσει** (refine-on-idle)· (3) `ssaoModulator.renderRaster()` = plain `renderer.render` σε navigation/editing. |
| **`FocusOutlineRenderer`** | `bim-3d/accessibility/FocusOutlineRenderer.ts` | a11y focus ring — «Mirrors BimSelectionHighlighter's lifecycle». **Δες το** ως πρότυπο group-traverse + πιθανή αλληλεπίδραση (focus vs selection outline — μη συγκρουστούν). |
| **χρώμα SSoT** | `config/color-config.ts:848` (`glowColor: '#FFD700'`) + `BimSelectionHighlighter.ts:15` (`0xffd700`) | **Κεντρικοποίησε** το selection-outline χρώμα σε ΕΝΑ token στο `color-config.ts` (μη σκορπίσεις νέο hex). |
| **`UnifiedFrameScheduler` / dirty flag** | (δες ADR-040· `ssao-modulator.ts:97` «mark scene dirty») | Το outline πρέπει να ξανα-σχεδιάζεται όταν αλλάζει η επιλογή → mark dirty/schedule frame (μην προσθέσεις δικό σου RAF loop). |

---

## ⚠️ ΚΡΙΣΙΜΟ ΣΗΜΕΙΟ #1 — SSAO idle-only = ΣΩΣΤΟ· OUTLINE = ΠΑΝΤΑ ΟΡΑΤΟ

**Δύο ΔΙΑΦΟΡΕΤΙΚΑ πράγματα — μην τα μπερδέψεις:**

- **SSAO refine-on-idle (υπάρχον) = ΣΩΣΤΟ, C4D/Revit-grade — ΜΗΝ ΤΟ ΧΑΛΑΣΕΙΣ.** Το ambient occlusion
  είναι ακριβό· όλα τα μεγάλα εργαλεία (Revit Realistic, C4D viewport, Blender) κάνουν progressive
  refinement: raster κατά το orbit, ακριβές pass μόλις ηρεμήσει η κάμερα. Η αρχιτεκτονική του Nestor
  (`scene-render-frame.ts:72` composer-on-idle / γρ.83 plain raster σε navigation) **είναι σωστή**.
- **Selection outline = ΦΘΗΝΟ pass → ΠΑΝΤΑ ΟΡΑΤΟ (και κατά το orbit).** Στα C4D/Revit το κίτρινο
  περίγραμμα **δεν σβήνει ποτέ** κατά την κίνηση. Αν δέσεις το OutlinePass στον idle-only SSAO composer
  → **το outline θα τρεμοπαίζει/εξαφανίζεται κατά το orbit** (φαίνεται bug). ΛΑΘΟΣ.

**Άρα:** το outline μπαίνει σε **φθηνό always-on path** (τρέχει σε ΚΑΘΕ frame), **ΧΩΡΙΣ** να σύρει μαζί
του το ακριβό SSAO σε κάθε frame. SSAO μένει idle-only από πάνω.

**Πρέπει να αποφασίσεις (recognition → plan):**
- **Option A (προτεινόμενη, Cinema 4D-grade):** ξεχωριστό **always-on** composer (RenderPass +
  OutlinePass) που τρέχει σε **ΚΑΘΕ** frame (και idle ΚΑΙ navigation), αντικαθιστώντας το plain
  `renderer.render` του raster path. Το SSAO μένει refine-on-idle από πάνω. ⚠️ Πρόσεξε διπλό render/
  σειρά passes + κόστος (ένα pass/frame — Cinema/Revit το κάνουν άνετα).
- **Option B:** ενοποίησε σε ΕΝΑ composer (RenderPass → OutlinePass → SSAO on-idle → copy) που τρέχει
  πάντα, με το SSAO pass `enabled` μόνο on-idle. Πιο καθαρό αλλά αγγίζει περισσότερο το render dispatch.

**Μην το αφήσεις «outline μόνο on-idle».** Ο Giorgio θέλει Cinema 4D parity (πάντα ορατό).

---

## ⚠️ ΚΡΙΣΙΜΟ ΣΗΜΕΙΟ #2 — ADR-040 (render-loop ευαισθησία)

Αγγίζεις **`scene-render-frame.ts`** (render loop) — performance-critical. **ΔΙΑΒΑΣΕ ADR-040** πρώτα.
ΟΧΙ νέα `useSyncExternalStore`/subscriptions σε orchestrators· το outline ενημερώνεται μέσω της
υπάρχουσας dirty/scheduler ροής. **CHECK 6B/6D** αφορούν 2Δ canvas/micro-leaf — **δεν** αγγίζονται 2Δ
entity renderers εδώ, οπότε πιθανότατα εκτός· **stage όμως ADR-040 + το ADR επιλογής μαζί** για ασφάλεια
(CHECK 6B μπλοκάρει αν τροποποιηθεί αρχείο ADR-040-governed χωρίς staged ADR-040).

---

## 📐 ΠΛΑΝΟ ΥΛΟΠΟΙΗΣΗΣ (προτεινόμενο — επικύρωσε με recognition)

1. **Recognition:** διάβασε `ssao-modulator.ts` (πλήρες), `scene-render-frame.ts` (πλήρες),
   `ThreeJsSceneManager.ts` (πώς στήνεται το render + highlighter + composer), `FocusOutlineRenderer.ts`.
   Επιβεβαίωσε την Option A vs B.
2. **OutlinePass setup:** δημιούργησε thin wrapper (π.χ. `bim-3d/systems/selection/SelectionOutlinePass.ts`)
   που στήνει `OutlinePass` (edgeStrength/edgeThickness/visibleEdgeColor = κίτρινο token, edgeGlow ελαφρύ
   όπως Cinema 4D, `pulsePeriod=0`). Reuse το χρώμα token από `color-config.ts`.
3. **Wire selectedObjects:** μετέτρεψε τον `BimSelectionHighlighter` (ή νέο `OutlineSelectionController`
   που **reuse-άρει το ίδιο group-traverse lifecycle**) ώστε `onSelect/onClear` να ενημερώνουν
   `outlinePass.selectedObjects` (array των matching meshes) **αντί** για emissive mutation. **Αφαίρεσε**
   το emissive-σε-όλο-το-σώμα. Κράτα το API (`onSelect(Set)/onClear`) → callers ανέγγιχτοι.
4. **Render path:** βάλε το OutlinePass στο always-on path (Option A/B) → outline ορατό πάντα.
5. **Tunables (SSoT):** χρώμα/πάχος/ένταση σε ΕΝΑ config (color-config + σταθερές).
6. **ADR:** δες `docs/centralized-systems/reference/adr-index.md` — το selection highlight = **ADR-366**
   (A.1). Είτε **ενημέρωσε ADR-366** (αλλαγή μηχανισμού emissive→silhouette) είτε νέο ADR (πάρε το επόμενο
   ελεύθερο νούμερο από adr-index — ΟΧΙ ADR-145). Πρόσθεσε §recognition + §changelog (N.0.1).

---

## 🔬 VERIFICATION
- **jest (ts-jest):** προσάρμοσε/επέκτεινε `BimSelectionHighlighter.test.ts` (τώρα ελέγχει emissive
  `0xffd700` — θα αλλάξει: πλέον «το σώμα material ΔΕΝ αλλάζει» + «τα selected meshes μπαίνουν στο
  outlinePass.selectedObjects»). Νέο test για τον OutlinePass wrapper (selectedObjects sync onSelect/onClear).
- **N.17:** όχι full tsc (OOM) — ts-jest + static import check.
- **Browser (Giorgio):** η τελική οπτική επιβεβαίωση (κίτρινο silhouette, σώμα αναλλοίωτο, ορατό ΚΑΙ
  κατά το orbit). Εσύ δηλώνεις ΜΟΝΟ τι έλεγξες με jest.

## ⚠️ FLAGS
- Shared tree (ADR-535 agent) → re-grep + `git status` πριν αναφέρεις· **ΠΟΤΕ `git add -A`**.
- **Pre-existing uncommitted (ADR-534 Φ3c-B3a/B3b, δικά μου, περιμένουν commit Giorgio):**
  `bim-3d/converters/{linear-member-rebar-3d,beam-rebar-3d,bim-three-structural-converters}.ts` +
  `bim-3d/scene/bim-scene-structural-finish-sync.ts` + `bim/finishes/structural-finish-scene-silhouette.ts`
  + 2 νέα tests + `ADR-534`. **ΜΗΝ τα αγγίξεις** (άσχετο domain).
- Το OutlinePass θέλει `selectedObjects: Object3D[]` — αν ένα bimId αντιστοιχεί σε `THREE.Group`
  (σύνθετο: πυρήνας+σοβάς+οπλισμός), δώσε το **group** (το OutlinePass κάνει recurse) → silhouette του
  συνολικού στερεού, ΟΧΙ ξεχωριστά του οπλισμού. Επαλήθευσε με `userData.bimType`.
- Selection = **visual** → αδύνατο να επιβεβαιωθεί 100% με jest· δήλωσέ το τίμια.
