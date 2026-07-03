# HANDOFF — Section-cut «κούφια λεπτά πανό» σε βαριές κατόψεις (solid poché cap)

**Ημερομηνία:** 2026-07-03
**Status:** 🔵 RESEARCH + PLAN — καμία γραμμή κώδικα ακόμη. Πρώτα SSoT audit, μετά υλοποίηση.
**ADR:** ADR-452 (3D section / cut-plane stencil caps) — θα ενημερωθεί ΜΕΤΑ την υλοποίηση (N.0.1).
**Commit:** ⚠️ ΤΟΝ ΚΑΝΕΙ Ο GIORGIO — ΠΟΤΕ ο agent (N.(-1)). ΟΧΙ `git add -A`.
**Working tree:** ⚠️ ΜΟΙΡΑΖΕΤΑΙ με άλλον agent — άγγιξε ΜΟΝΟ τα αρχεία της feature.
**Γλώσσα:** Απαντάς στον Giorgio ΠΑΝΤΑ ΕΛΛΗΝΙΚΑ (CLAUDE.md language rule).
**tsc:** ❌ ΜΗΝ τρέχεις tsc/typecheck (N.17). Μόνο jest (στοχευμένα).

---

## 🎯 ΤΟ ΠΡΟΒΛΗΜΑ (repro)
Στον **3Δ** καμβά, το slider «οριζόντιας τομής» (δεξιά, `CutPlaneSlider3DLeaf`) στα ~3m. Μόλις το
μετακινείς προς τα κάτω, οι κολόνες/τοίχοι **παύουν να φαίνονται γεμάτα 3Δ στερεά** και εμφανίζονται
ως **λεπτά ΚΑΘΕΤΑ «πανό/φέτες»** (κούφια, ανοιχτά στην κορυφή). Σε **βαριά** κάτοψη (808 στοιχεία,
FPS ~4) μένει **μόνιμα** έτσι — δεν «ηρεμεί» ώστε να ξαναγεμίσει.

Screenshots: `Στιγμιότυπο οθόνης 2026-07-03 214705.jpg` (2.59m) & `...214720.jpg` (3.00m).

## 🔍 ΡΙΖΑ (διαγνωσμένη — μηχανισμός, με file:line)
Το slider ΔΕΝ κόβει πραγματικά τη γεωμετρία — ενεργοποιεί **THREE.js clipping plane**
(`renderer.localClippingEnabled = true`). Το GPU clipping αφήνει το στερεό **κούφιο** (ανοιχτή τομή,
όχι γεμάτο πρόσωπο) → βλέπεις μόνο τα πλαϊνά φατσάκια = «λεπτά κάθετα πανό».

Για να δείχνει **γεμάτη** η τομή (poché «καπάκι»), τρέχει ξεχωριστό **stencil-cap pass**:
- `src/subapps/dxf-viewer/bim-3d/scene/section-scene-controller.ts` — `SectionSceneController`
  - `applyState()` (γρ. 159): συνθέτει τα clip planes (`applyClippingPlanes`).
  - `renderFrameWithCaps()` (γρ. 306): render + stencil caps ανά quality tier.
  - **Quality tiers (γρ. 351-359):**
    - `cutMoving` (σέρνεις slider) → `'colors'` (χρωματιστά caps, γεμάτο)
    - `interacting || camMoved || pointerActive` (περιστροφή/zoom/κίνηση κέρσορα) → **`'fast'` = γκρι
      βάση ΜΟΝΟ, ΧΩΡΙΣ caps → κούφιο = τα λεπτά πανό**
    - settled → `'full'` (caps + hatch + emphasis)
  - `armRefine()` (γρ. 432): timer `REFINE_DELAY_MS` για ΕΝΑ `'full'` καρέ μόλις ηρεμήσει.
- `src/subapps/dxf-viewer/bim-3d/systems/section/section-stencil-renderer.ts` — `SectionStencilRenderer`
  (το ίδιο το cap render· εδώ ζει το `SectionCapQuality`).
- **Το κόστος:** το coloured cap ξανα-render-άρει ΟΛΗ τη BIM σκηνή ~2×(1+N_χρωμάτων) φορές/καρέ →
  γι' αυτό υποβαθμίζεται σε draft στην κίνηση. Σε FPS-4 σκηνή η κατάσταση **σχεδόν ποτέ δεν «ηρεμεί»**
  (κάθε μικροκίνηση κέρσορα/κάμερας την κρατά σε `'fast'`) → μένεις μόνιμα στο **κούφιο draft**.

**Συμπέρασμα:** τα «λεπτά πανό» = clipped στερεό **χωρίς solid cap** (draft ποιότητα). Ο draft-στην-κίνηση
είναι σκόπιμος (ADR-452), αλλά το «κούφιο» ως draft-look + το «δεν επανέρχεται σε βαριά σκηνή» είναι το θέμα.

## 🏛️ ΠΡΑΚΤΙΚΗ ΜΕΓΑΛΩΝ ΠΑΙΧΤΩΝ (hypothesis — ΕΠΑΛΗΘΕΥΣΕ την στο νέο session, π.χ. WebSearch)
- **Revit:** η τομή δείχνει **πάντα** γεμάτο poché (section fill/cut pattern) — και στην πλοήγηση. Δεν
  πέφτει ποτέ σε «κούφιο». Το cut fill είναι σταθερό επίπεδο χρώμα/μοτίβο, όχι ακριβό per-material re-render.
- **Cinema 4D / Maxon:** real-time viewport clipping → **single-pass stencil cap** (back faces →
  stencil, μετά ΕΝΑ fill quad όπου stencil≠0). Τρέχει **κάθε καρέ φθηνά**, ανεξάρτητα από πλήθος υλικών.
- **Figma-level αρχή:** ΠΟΤΕ μη δείχνεις σπασμένο/draft state στον χρήστη κατά την αλληλεπίδραση· κράτα
  το «committed» οπτικό σταθερό, ρίξε το ακριβό εκτός interaction path (cache/incremental).

**Σύνθεση / προτεινόμενη ΚΑΤΕΥΘΥΝΣΗ (enterprise + SSoT):**
Οι μεγάλοι **δεν πέφτουν σε κούφιο**. Κράτα ένα **φθηνό, ΠΑΝΤΑ-ενεργό solid cap** (flat poché χρώμα,
single stencil pass) που τρέχει σε ΚΑΘΕ καρέ — έτσι η τομή **δεν φαίνεται ποτέ κούφια**, ανεξαρτήτως
βάρους σκηνής. Το ακριβό (per-material χρώματα + hatch + emphasis) μένει ως **settle-time refine**
(progressive enhancement). Δηλαδή: **αποσύνδεσε το «solid base cap» από το «coloured/hatch cap»**·
το `'fast'` tier να παράγει **γκρι ΓΕΜΑΤΟ** αντί για κούφιο.
→ Αυτό διορθώνει άμεσα τα «λεπτά πανό» (γίνονται συμπαγή γκρι στην κίνηση, Revit-style) και είναι το πιο
κοντινό στη βιομηχανία. Αν η έρευνα δείξει κάτι καλύτερο, ακολούθησέ το.

## ✅ ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ — SSoT AUDIT (grep, ΠΡΙΝ κώδικα)
Ο Giorgio απαιτεί: **grep τον υπάρχοντα κώδικα** ώστε να χρησιμοποιήσεις ό,τι υπάρχει, ΟΧΙ διπλότυπα.
Ψάξε ΤΟΥΛΑΧΙΣΤΟΝ:
1. `section-stencil-renderer.ts` — υπάρχει ΗΔΗ γκρι/flat/base cap path; Τι κάνει το `quality='fast'`
   σήμερα (render γκρι cap ή SKIP cap;). **Εδώ είναι το κλειδί** — μπορεί το fix να είναι «το 'fast' να
   βγάζει solid γκρι cap αντί να παραλείπει τα caps».
2. `SectionCapQuality` type + όλοι οι consumers (grep) — μην προσθέσεις παράλληλο enum.
3. `section-clip-applicator.ts`, `axis-cut-composer.ts`, `scene/cut-plane-3d.ts` — υπάρχουσα σύνθεση planes.
4. `SectionBox` / `section/` module — τυχόν υπάρχον flat-cap material/χρώμα (SSoT για poché colour).
5. Grep για `stencil`, `cap`, `poché/poche`, `SECTION_` constants, `DXF_TIMING.ui.SECTION_REFINE`.
6. Ίχνευσε ΟΛΟ το pipeline (feedback: μην κρίνεις απομονωμένα) — camMoved/pointerActive/cutMoving →
   quality → stencilRenderer. Βεβαιώσου ΠΟΥ ακριβώς χάνεται το cap.

## 🧭 ΠΙΘΑΝΗ ΥΛΟΠΟΙΗΣΗ (ΜΟΝΟ μετά το audit — μη δεσμεύεσαι τυφλά)
- Αν το `'fast'` σήμερα SKIP-άρει caps → κάν' το να τρέχει **ΕΝΑ φθηνό solid γκρι cap** (reuse του
  υπάρχοντος stencil path, flat colour, χωρίς per-material loop/hatch). Το «κούφιο» εξαφανίζεται.
- Κράτα `'colors'`/`'full'` ως refine (progressive). Το `armRefine` μένει.
- Αν χρειάζεται SSoT για το poché χρώμα → πάρ' το από υπάρχον config/material (μη hardcode· N.11 i18n
  δεν αφορά χρώματα, αλλά χρησιμοποίησε central colour constant αν υπάρχει).
- Στόχος: σε βαριά κάτοψη (FPS 4) η τομή να φαίνεται **συμπαγής** σε κάθε στιγμή.

## 📁 KEY FILES
- `bim-3d/scene/section-scene-controller.ts` (quality tiers + render loop) — ΚΥΡΙΟ
- `bim-3d/systems/section/section-stencil-renderer.ts` (το cap render + `SectionCapQuality`) — ΚΥΡΙΟ
- `bim-3d/systems/section/section-clip-applicator.ts`
- `bim-3d/scene/axis-cut-composer.ts`, `bim-3d/scene/cut-plane-3d.ts`
- `bim-3d/viewport/CutPlaneSlider3DLeaf.tsx` + `components/dxf-layout/CutPlaneSliderControl.tsx` (UI, μάλλον δεν αλλάζει)
- `config/dxf-timing.ts` (`SECTION_REFINE`, `POINTER_SETTLE`, `EDGE_TRIM`)

## 🚫 ΜΗΝ
- Μην αγγίξεις άσχετα αρχεία (shared tree με άλλον agent).
- Μην κάνεις commit/push (N.(-1)) — ο Giorgio.
- Μην τρέξεις tsc (N.17). Jest μόνο.
- Μη δημιουργήσεις νέο enum/store/cap-path αν υπάρχει ήδη (SSoT audit πρώτα).

## 🔬 VERIFY (μετά το fix, ο Giorgio)
1. jest στοχευμένα (section stencil/controller αν υπάρχουν tests).
2. Browser: βαριά κάτοψη, μετακίνηση slider τομής → οι κολόνες/τοίχοι μένουν **συμπαγείς** (όχι λεπτά
   πανό) και ΚΑΤΑ την κίνηση ΚΑΙ όταν σταματάς. FPS αποδεκτό.
3. ADR-452 changelog update (ίδιο commit).

## 📌 ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ TREE (μην τα πειράξεις/επαναφέρεις)
UNCOMMITTED από προηγούμενο session (ADR-568 «Γεφύρωση με Κούφωμα» — ΟΛΟΚΛΗΡΩΘΗΚΕ & browser-verified):
`bim-3d/converters/opening-mesh.ts` (+test), `hooks/tools/useWallGapOpeningTool.ts`,
`canvas-v2/dxf-canvas/dxf-viewport-culling.ts`, ADR-568/ADR-040. Ξένα προς αυτό το task — **μην τα αγγίξεις**.
