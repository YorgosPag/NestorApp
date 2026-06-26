# HANDOFF — Section-cut **zoom/orbit performance** (Revit/Maxon-grade smooth navigation)

**Ημ/νία:** 2026-06-26 · **Γλώσσα στον Giorgio: ΕΛΛΗΝΙΚΑ πάντα.**
**Τύπος:** Performance — 3D viewport render loop (section stencil caps). Cross-cutting, perf-critical.

---

## 🎯 ΣΤΟΧΟΣ (τι ζήτησε ο Giorgio)

Όταν υπάρχει **ενεργό section cut** και ο χρήστης κάνει **zoom (ροδέλα)** ή περιστροφή, υπάρχει
**lag — δυσάρεστο zoom**. Θέλει **ομαλή πλοήγηση επιπέδου Revit / Maxon (Cinema 4D)**, με
**FULL enterprise + FULL SSoT**. **ΠΡΙΝ γράψεις κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep/read)** για
reuse υπάρχοντος, μηδέν διπλότυπα.

## 🔬 ΕΥΡΗΜΑ (από Firefox Profiler call-tree, στιγμιότυπο 21:07 — κατά το zoom)

Δέντρο κλήσεων κατά το zoom (% / samples):
- `RefreshDriver tick` 54% → `renderSceneFrame` 37% (123) → **`renderFrameWithCaps` 37% (123)** →
  `renderAxisCutCap` 23% (75) → **`renderScene` 22% (75)** → renderObjects/renderObject/
  renderBufferDirect/setProgram.

**Root cause:** ο **section stencil cap renderer ξανα-ζωγραφίζει ΟΛΗ τη σκηνή πολλές φορές/frame.**
Η stencil τεχνική ανά cut plane κάνει `renderer.render(scene, camera)` **2× (back-faces + front-faces)**
→ για N axis-cut planes = `~2×N` full-scene renders/frame, **ΑΚΟΜΑ ΚΑΙ στο γκρι `'fast'`** tier
(η `renderAxisCutCap`/`renderCapForPlane` re-render-άρει τη σκηνή για τη μάσκα, ανεξαρτήτως quality).
Στο αδύναμο GPU του Giorgio = ο zoom lag.

## 🔬 ΕΥΡΗΜΑ #2 (React DevTools profiler — `profiling-data...21-12-28.json`, ίδιο zoom)
**Η React είναι ΑΘΩΑ.** Όλη η συνεδρία zoom = **μόνο 6 commits** (αν η React ξανα-render-άρε ανά frame
θα ήταν εκατοντάδες). 4 commits τετριμμένα (~6ms «Script» baseline + άσχετα nodes). **2 commits**
(0 & 4) = full-tree re-render 233 fibers (~27ms) `CanvasSection`+DxfCanvas+RenderFinalDialog+
PreviewCanvas — **περιστασιακά** (μάλλον selection/tool-change), **ΟΧΙ** ανά zoom-tick. → επιβεβαιώνει:
ο per-frame zoom lag είναι ο **WebGL render loop (section caps)**, ΟΧΙ React (ADR-040 κρατάει).
**Δευτερεύον (προαιρετικό):** αν τα 2 big CanvasSection re-renders πέφτουν κατά την αλληλεπίδραση,
αξίζει ξεχωριστή ματιά (orchestrator re-render ~27ms = hitch)· ΟΧΙ προτεραιότητα, ΟΧΙ ο zoom lag.

## ⚠️ ΥΠΟΨΙΑ #1 — wheel-zoom μπορεί να μη μένει σε `'fast'`
Η σημερινή tiering (ADR-452) δίνει `'fast'` όταν `interacting || camMoved`. Το **wheel-zoom ΔΕΝ θέτει
`interacting`** (δεν είναι drag). Αν το zoom είναι «άμεσο» (όχι animated), τότε **ανάμεσα** στα διακριτά
wheel ticks η κάμερα είναι στατική → `camMoved=false` → frame γίνεται **`'full'`** (βαρύ: per-material
colours + hatch + emphasis). Δηλαδή κατά το rapid scroll μπορεί να εναλλάσσεται `'fast'` (jump frame)
με `'full'` (settle frame) → παραμένει βαρύ. **ΕΠΑΛΗΘΕΥΣΕ** (βάλε προσωρινό log του `quality` στο
`renderFrameWithCaps`) ΠΡΙΝ υλοποιήσεις — μπορεί ο γρηγορότερος win να είναι ένα **wheel-debounce** που
κρατά `'fast'` για ~150ms μετά το τελευταίο wheel event (μέχρι να ηρεμήσει το zoom).

## 📐 ΠΙΘΑΝΕΣ ΚΑΤΕΥΘΥΝΣΕΙΣ (αξιολόγησε με SSoT audit — μην υλοποιήσεις τυφλά)
1. **Wheel-as-motion**: treat το wheel-zoom σαν συνεχή κίνηση (debounce) → `'fast'` σε όλο το zoom,
   `'full'` μόνο στο πραγματικό settle. **Φθηνότερο, μικρότερο ρίσκο** (μόνο η συνθήκη quality).
2. **Caps σε reduced resolution κατά την κίνηση** (refine-on-idle, όπως ήδη κάνω σε grips/outline):
   render τα stencil caps σε μισό RT όσο κινείται η κάμερα → full-res στο settle.
3. **Μείωση των per-frame scene re-renders** της stencil τεχνικής (π.χ. cache του cap mask όταν cut+camera
   στατικά — αλλά το camera-move το ακυρώνει· δες αν αξίζει).
4. Συνδυασμός 1+2 (Revit-style adaptive degradation).

**Πρόταση εκκίνησης:** ξεκίνα με **#1 (wheel-debounce → 'fast')** — επαλήθευσε αν το zoom χτυπά `'full'`.
Αν ναι, αυτό μόνο μπορεί να λύσει το μεγαλύτερο μέρος με ελάχιστο ρίσκο. Μετά #2 αν χρειαστεί.

## 🔬 SSoT AUDIT — ΑΡΧΕΙΑ ΓΙΑ GREP/READ ΠΡΙΝ ΓΡΑΨΕΙΣ (reuse, ΜΗΝ διπλασιάσεις)
| Αρχείο | Τι έχει ΗΔΗ |
|---|---|
| `bim-3d/scene/section-scene-controller.ts` | `renderFrameWithCaps` — η απόφαση `quality` (`cutMoving?'colors':(interacting\|\|camMoved)?'fast':'full'`), `camMoved` detection, `armRefine()` (refine-on-idle timer, `REFINE_DELAY_MS`). **ΕΔΩ μπαίνει το wheel-debounce / motion-quality.** |
| `bim-3d/systems/section/section-stencil-renderer.ts` | `render`/`renderAxisCutCap`/`renderCapForPlane` — η stencil τεχνική (τα `renderer.render(scene)` re-renders). 3 quality tiers `'fast'/'colors'/'full'`. **ΕΔΩ το reduced-res / λιγότερα passes.** |
| `bim-3d/scene/axis-cut-composer.ts` | `detectCutMoving`, σύνθεση cut entries. |
| `bim-3d/lighting/ssao-modulator.ts` | πρότυπο **refine-on-idle** (SSAO idle ramp) — ίδιο pattern να μιμηθείς για caps. |
| `bim-3d/systems/selection/SelectionOutlinePass.ts` | (δικό μου, committed) πρότυπο reduced-res / RT compositing αν χρειαστείς. |
| Viewport wheel handling | grep `onWheel`/`wheel`/`resolveSurfacePoint`/zoom στο `viewport/` + `initViewportCamera` — βρες πού φτάνει το wheel event (για debounce/interacting signal). |
ADRs: **ADR-452** (cut-plane + cap tiering — UPDATE το changelog), **ADR-455** (axis cuts), **ADR-040**
(render-loop governance — stage μαζί, CHECK 6B/6D).

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ
- **COMMIT/PUSH μόνο ο Giorgio.** ΠΟΤΕ εσύ.
- **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent (ADR-535 grips/animation, ADR-534 converters/finishes).**
  **ΠΟΤΕ `git add -A` — μόνο specific files.** Re-grep + `git status` στην αρχή.
- **ΠΡΑΓΜΑΤΙΚΟ SSoT audit ΠΡΙΝ τον κώδικα** (Giorgio: «θα το έκανε έτσι η Revit/Maxon;»).
- **N.17:** ΕΝΑ `tsc` τη φορά (OOM) — verify με ts-jest. **Όχι** `any`/`@ts-ignore`· functions ≤40γρ· files ≤500.
- **Browser-verify από Giorgio** (perf = αισθητό· δήλωσε τι έλεγξες με jest, τι μένει για εκείνον).
- **Μοντέλο:** Opus (render-loop, perf, cross-cutting).

## 📦 UNCOMMITTED ΑΠΟ ΤΗΝ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (ο Giorgio θα κάνει commit — ΜΗΝ τα αγγίξεις/αναιρέσεις)
Σχετίζονται άμεσα — είναι η βάση πάνω στην οποία θα χτίσεις:
- `bim-3d/scene/section-scene-controller.ts` — cap-quality tiering split (γκρι στην κίνηση κάμερας).
- `bim-3d/viewport/grips/BimGripOverlay2D.tsx` — κρύψιμο λαβών στην κίνηση (grip occluder skip).
- `ADR-536` (διορθωμένο → mask-dilate), `ADR-452` & `ADR-535` (changelog).
Selection outline (mask-dilate, `#FFAA16`) = **ΗΔΗ COMMITTED** (ddec50b0), browser-verified, αγαπήθηκε.

## ✅ ΟΡΙΟ ΕΠΙΤΥΧΙΑΣ
Zoom (ροδέλα) + orbit **με ενεργό cut** = **ομαλά**, χωρίς αισθητό lag, με τα χρώματα τομής να
επιστρέφουν ακαριαία στο settle. Επίπεδο Revit/Maxon adaptive-degradation.
