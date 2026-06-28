# HANDOFF 2026-06-28 — 3D ποιότητα/κέρσορας ΧΕΙΡΟΤΕΡΕΨΑΝ μετά από 3 agents → διάγνωση + σωστή big-player λύση

> Γράφτηκε για **ΚΑΘΑΡΟ session**. Διάβασέ το ΠΡΩΤΟ. **Όλα UNCOMMITTED. Commit ΜΟΝΟ ο Giorgio** (N.(-1)).
> **Working tree SHARED** με ≥2 άλλους agents. ❌ ΟΧΙ `--no-verify`. ❌ ΟΧΙ `git add -A`. ❌ ΟΧΙ 2ο tsc (N.17).
> Big-player doctrine (Revit / Maxon Cinema4D). FULL ENTERPRISE + FULL SSOT. **ΠΡΙΝ κώδικα → πραγματικό SSoT audit (grep).**

---

## 0. ΤΑ 4 ΣΥΜΠΤΩΜΑΤΑ (λόγια Giorgio, 2026-06-28 — μετά τις αλλαγές 3 agents «η κατάσταση άλλαξε δραματικά προς το χειρότερο»)

1. **Μετάβαση 2D → 3D (κουμπί) πολύ χρονοβόρα / αργή.**
2. **3D ποιότητα οντοτήτων πολύ χαμηλή — και κατά την περιστροφή γίνεται ακόμη χαμηλότερη.**
3. **Όταν ΣΤΑΜΑΤΑΩ την κίνηση/περιστροφή, οι ΑΚΜΕΣ γίνονται πολύ μικρής ανάλυσης** (μένουν blurry/χαμηλής ποιότητας).
4. **Ο κέρσορας καθυστερεί ΚΑΙ «κολυμπάει» (swim) σε 2D ΚΑΙ 3D — χειρότερα σε full screen.**

## 1. ΤΙ ΑΛΛΑΞΕ (3 agents, ΟΛΑ uncommitted — αυθεντικό `git status` 2026-06-28)

Πηγές που ΠΡΕΠΕΙ να διαβάσεις:
- `C:\Nestor_Pagonis\local_ΑΝΑΦΟΡΑ_5.txt` — πλήρες log των 3 agents (1373 γρ.· i18n preload + FPS-metric fix [ΗΔΗ committed] + fill-rate).
- `HANDOFFS/HANDOFF_2026-06-28_3d-perf-fillrate-6-fixes.md` — οι **6 fixes** του «agent Β» (αναλυτικά).

**Uncommitted αρχεία (git status):**
| Αρχείο | Agent / lane | Τι |
|--------|--------------|----|
| `scene/scene-setup.ts` | **A (Round-1)** | `antialias:true→false` (**MSAA OFF**), `PCFSoftShadowMap→PCFShadowMap`, shadow `2048→1024`, **`preserveDrawingBuffer:true→false`** (+ `createOffscreenCaptureRenderer` SSoT) |
| `scene/ThreeJsSceneManager.ts` | A/B | `captureFrameDataURL` on-demand (αντικ. preserveDrawingBuffer) |
| `bim-3d/animation/MP4Exporter.ts`, `print/capture/capture-3d.ts`, `performance/performance-snapshot-service.ts` | B (fix #6/#5) | ενοποίηση offscreen renderer + on-demand capture |
| **`lighting/resolution-modulator.ts` (NEW)** + `__tests__` | **Γ = ΕΓΩ (Round-2)** | **dynamic resolution 0.6× κατά την κίνηση** |
| `scene/scene-rendering-subsystems.ts`, `scene/scene-idle-handlers.ts` (+test) | **Γ = ΕΓΩ** | wiring του resolution-modulator στο camera active/idle |
| **`materials/MaterialCatalog3D.ts`** | **Γ = ΕΓΩ** | `buildMat` `DoubleSide → FrontSide` (backface culling) |
| `ADR-040`, `ADR-366` | A+B+Γ | changelogs |

> Επιπλέον στο `local_ΑΝΑΦΟΡΑ_5.txt` αναφέρονται **ΗΔΗ COMMITTED** (όχι στο git status): i18n preload (`config.ts`/`lazy-config.ts`), FPS-metric fix (`PerformanceCollector.ts`), Performance-HUD accuracy (`scene-render-stats.ts`). Ο **σπασμένος μετρητής FPS διορθώθηκε** — **αγνόησε παλιές ενδείξεις 4-5 FPS** (ήταν artifact μέτρησης).
> Επίσης agent Β: DXF underlay idempotent sync, BVH per-pick skip, snap-overlay granularity, section-caps γκρι-στο-hover (βλ. το 6-fixes handoff).

## 2. ΔΙΑΓΝΩΣΗ ΑΝΑ ΣΥΜΠΤΩΜΑ (υποθέσεις — επαλήθευσε με grep/trace ΠΡΙΝ δράσεις)

### 🔴 #2 + #3 (χαμηλή ποιότητα, χειρότερη στην περιστροφή, ακμές blurry στο σταμάτημα) — ΠΡΩΤΟΣ ΥΠΟΠΤΟΣ: το δικό μου Round-2 + MSAA-off
**100% ειλικρίνεια — το πιθανότερο το προκάλεσα ΕΓΩ.** Συνδυασμός:
- **MSAA OFF** (Round-1 `antialias:false`) → **κανένα** anti-aliasing → aliased ακμές **πάντα**. Ο Round-1 σχολίασε «cheap FXAA αργότερα» — **ΔΕΝ μπήκε ποτέ** → η σκηνή έμεινε χωρίς AA.
- **Το δικό μου dynamic resolution 0.6×** στην κίνηση → ακόμη πιο blurry/aliased κατά orbit/zoom (= ακριβώς το «χειρότερη στην περιστροφή»).
- **Ακμές blurry στο ΣΤΑΜΑΤΗΜΑ (#3) = BUG στο restore μου.** Το `ResolutionModulator.onCameraIdle()` (α) τρέχει μόνο μετά από `DXF_TIMING.gesture.CAMERA_IDLE` καθυστέρηση (μένει blurry ~1s), ΚΑΙ (β) **δεν συγχρονίζει το `bimEdgeResolutionStore`** (το LineMaterial `resolution` uniform των BIM ακμών — `ThreeJsSceneManager.resize()` το κάνει, ο modulator μου το **παρακάμπτει**) → οι `LineSegments2` ακμές render-άρονται σε λάθος resolution. Πιθανό και να **μην ξαναζωγραφίζει** full-res (markSceneDirty race) → μένει στο 0.6×.

➡️ **Big-player αλήθεια:** Revit/Maxon **ΔΕΝ** αφήνουν blurry/aliased viewport. Χρησιμοποιούν **TAA/SMAA/FXAA** + adaptive resolution που επαναφέρει **ΑΚΑΡΙΑΙΑ + κρυστάλλινα**. Το naive «0.6× χωρίς AA με σπασμένο restore» είναι **λάθος πρακτική**.

### 🔴 #1 (αργή μετάβαση 2D→3D)
Ύποπτοι (grep/trace): full scene rebuild (`BimSceneLayer.sync()` → `clearGroup()`+recreate ΟΛΩΝ, βλ. report γρ.307), envmap generation στο mount, ή το νέο on-demand capture path. Χρειάζεται trace της μετάβασης (record → πάτα 3D → stop).

### 🔴 #4 (κέρσορας lag + «swim» σε 2D & 3D, full screen χειρότερα)
Πιθανώς **ξεχωριστό** workstream. «Swim» = ο crosshair/κέρσορας ακολουθεί με καθυστέρηση. Full-screen χειρότερα = **fill-rate** (κάθε pointer-move → redraw· περισσότερα pixels → πιο αργό). Ύποπτοι: το snap-overlay granularity change (agent Β fix #3), το dynamic-resolution που μπερδεύει το coordinate mapping του `CrosshairCompositor` στο 3D, ή προϋπάρχον (memory [[reference_3d_cursor_lag_decoupling]], [[reference_3d_crosshair_2d_parity]]). **Θέλει δικό του trace** — ΜΗΝ το μπλέξεις με το #2/#3.

## 3. 🔴 ΣΤΡΑΤΗΓΙΚΗ (πρότασή μου — επικύρωσέ τη με τον Giorgio)

**Βήμα 0 — BISECT για να επιβεβαιώσεις την αιτία (ΠΡΙΝ νέο κώδικα).**
Η ποιότητα χειροτέρεψε μετά από πολλές ταυτόχρονες αλλαγές. Απομόνωσε:
1. **Revert μόνο τα ΔΙΚΑ ΜΟΥ Round-2** (`resolution-modulator.ts`+test, το wiring σε `scene-rendering-subsystems.ts`/`scene-idle-handlers.ts`+test, `MaterialCatalog3D.ts` `FrontSide→DoubleSide`) → hard reload → δες αν η ποιότητα (#2/#3) επανέρχεται. **Αν ναι → επιβεβαιώθηκε ότι το dynamic-resolution/FrontSide έφταιγε.**
2. Αν χρειαστεί, δοκίμασε και `antialias:false→true` (Round-1) προσωρινά για να δεις αν το MSAA-off ήταν συν-υπεύθυνο.

**Βήμα 1 — Σωστή big-player λύση (αφού ξέρεις τι έφταιγε):**
- **AA:** αφού αφαιρέθηκε MSAA, βάλε **post-AA (FXAA ή SMAA)** ως pass — SSoT audit: υπάρχει ήδη `EffectComposer` (`ssao-modulator.ts`) + `three/addons` FXAA/SMAA shaders· **reuse**, μην φτιάξεις νέο composer.
- **Dynamic resolution (αν κρατηθεί):** πρέπει (α) restore **ΑΚΑΡΙΑΙΟ** (όχι μετά από idle-threshold), (β) **sync `bimEdgeResolutionStore`** (route μέσω `ThreeJsSceneManager.resize` ή κάλεσέ το), (γ) εγγυημένο full-res repaint. **Ή** προτίμησε τον φθηνότερο/ασφαλέστερο μοχλό: **σκιές OFF κατά την κίνηση** (reuse `systems/pointer-activity.ts` του agent Β — βλ. 6-fixes handoff «επόμενα #3») που **κρατά κρυστάλλινη ανάλυση**.
- **FrontSide:** κράτησέ το ΜΟΝΟ αν δεν προκαλεί «βλέπεις πέρα» σε τομές/εσωτερικά/λεπτά φινιρίσματα (browser-verify). Αλλιώς revert.

**Βήμα 2 — #1 (μετάβαση) + #4 (κέρσορας):** ξεχωριστά traces, ξεχωριστές διορθώσεις. Μην τα μπλέξεις.

## 4. ΚΑΝΟΝΕΣ / CONSTRAINTS
- **Commit ΜΟΝΟ ο Giorgio** (N.(-1)). ❌ `--no-verify`. ❌ `git add -A`.
- **SHARED tree** (claude/codex1/codex2). Δικά σου να αλλάξεις ελεύθερα = **μόνο τα Round-2 (Γ)**. Τα Round-1 (`scene-setup.ts`) + τα 6-fixes (agent Β) = **συντονισμός, μην τα πατήσεις**.
- **ΠΡΙΝ ΚΑΘΕ νέο κώδικα → SSoT audit (grep)** — reuse υπάρχοντα (composer/FXAA/pointer-activity/edge-resolution-store). Μηδέν διπλότυπα.
- **CHECK 6B/6D (ADR-040):** αν αγγίξεις canvas/scene render αρχεία → stage ADR-040. Τα δικά μου bim-3d/lighting/scene αρχεία δεν είναι στη λίστα micro-leaf, αλλά τεκμηρίωσε σε ADR-366 §B.5.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε process πρώτα· τρέχουν άλλοι agents).
- Big-player: αν Revit/Maxon δεν προτείνουν κάτι → ακολούθησε τη δική τους πρακτική (crisp viewport, post-AA, instant restore).

## 5. ΤΕΣΤ ΕΠΑΛΗΘΕΥΣΗΣ (όταν διορθώσεις)
Hard reload localhost dev → 3D:
- Ακμές **κρυστάλλινες** ακίνητα ΚΑΙ αποδεκτές στην κίνηση (#2/#3).
- Σταμάτημα → **ακαριαία** crisp, όχι blurry (#3).
- Μετάβαση 2D→3D γρήγορη (#1).
- Κέρσορας κολλάει στο σημείο, χωρίς swim, και σε full screen (#4).

## 6. ADRs
- **ADR-366 §B.5** — η fill-rate ιστορία (Round-1 + Round-2 + 6-fixes· SSoT, αντί νέου ADR — αποφυγή collision).
- **ADR-040** — micro-leaf (agent Β τα stage-άρει).
- **ADR-547/548** — ribbon (ΗΔΗ committed/ξεχωριστά· άσχετα με 3D ποιότητα).
