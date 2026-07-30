# ADR-732 — Μοχλός Δ: Ενοποίηση των 13 full-viewport 2D καμβάδων (compositing footprint)

**Status:** ✅ **Batches 1-4 ΟΛΟΚΛΗΡΩΜΕΝΑ (2026-07-30, uncommitted)** — ζώνη Β 4→1
(`Overlay2DDispatchCanvas`) + ζώνη Α grid/floorplan→1 (`UnderlayDispatchCanvas`) +
mount-on-demand (floor-underlay, topo-grid, focus-2d, webgl-line) + zone hook SSoT
(`use-overlay-zone-dispatch`) + **Batch 4 μέτρηση σε production: DOM 13→5 ✓, p90
49,8→33,3ms ✓, p50 60 FPS αμετάβλητο ✓** (πλήρη νούμερα: §7.1). ΕΚΚΡΕΜΟΥΝ: LayerCanvas
unmount-when-empty (αναβλήθηκε — βλ. §3) + οπτική επαλήθευση calibration click σε level
με αποθηκευμένη raster κάτοψη (§7.1 σημ. 3).
Εγκεκριμένο από τον Giorgio 2026-07-30 («Δ τώρα» + N.8: batch-by-batch).
**Ημερομηνία:** 2026-07-30
**Σχετικά:** **ADR-726 §4.Γ/§6** (η διάγνωση: software compositing 13 στρωμάτων = ο ΕΝΑΣ
εναπομείνας μετρημένος περιοριστής) · **ADR-040** (cardinal rules — ΑΠΑΡΑΒΙΑΣΤΑ εδώ) ·
**ADR-552** (analytical dispatch 7→1 — το 2D πρότυπο που γενικεύουμε) · **ADR-554** (proposal
dispatch 7→1) · ADR-726 Φ2 (`paintOverlayDispatchFrame` + clear ledger — το primitive που
κληρονομούμε) · ADR-639 Στάδιο 5 (webgl-line layer) · ADR-399 Phase D (floor underlay) ·
ADR-396 P4 (envelope) · ADR-656 M11 (topo graticule) · 3D πρότυπο:
`bim-3d/viewport/overlay-dispatch/bim-overlay-pass.ts` (N→1 με passes, έλυσε ΤΟ ΙΔΙΟ πρόβλημα)
**Κώδικας που γράφτηκε σε Phase 0:** **ΚΑΝΕΝΑΣ.**

---

## 1. Το πρόβλημα (μετρημένο, production)

Production build (BUILD_ID `MSiFeQyJAWdg0RRzZFKbG`, πρωτόκολλο F5 handoff §4), PC χωρίς GPU
(AMD HD 5450/2010, software rasterization):

- Καρέ p50 16,7ms = 60 FPS (το JS ΛΥΘΗΚΕ: ADR-726 Φ3/Φ3.1, ADR-728 Φ1, ADR-040 XXII.B).
- **Καρέ p90 49,8ms · ζώνη 33-50ms = 11,5% των καρέ.**
- LoAF attribution (2 τρεξίματα): scripts ≈9ms/καρέ, styleAndLayout 0, **median 42ms αναμονή
  ΠΡΙΝ το renderStart με ΑΔΕΙΟ main thread** ⇒ ο χρόνος πάει σε software
  compositing/rasterization των στρωμάτων — ΟΧΙ σε React, ΟΧΙ σε JS, αόρατος στο `frame:TOTAL`.
- ADR-726 §4.Γ: 9 καμβάδες μετρήθηκαν να κάνουν ΜΟΝΟ `clearRect` (η Φ2 τούς γλίτωσε το clear,
  **ΟΧΙ το στρώμα**): κάθε ζωντανό full-viewport canvas = ένα layer που ο compositor
  ξανασυνθέτει· 13 στρώματα × ~1MP = ο φόρτος.

**Απόφαση αρχής (Giorgio, ADR-726 §7.1):** ΟΧΙ νέα μηχανή render (WebGL single-surface
απορρίφθηκε ρητά). Ο Δ = **λιγότερα ζωντανά στρώματα μέσα στην υπάρχουσα στοίβα**, πρακτική
μεγάλων παιχτών (Figma/Maps/Docs: λίγα στρώματα, διαχωρισμός στατικού/δυναμικού· δεκάδες
transparent overlays = γνωστό anti-pattern για software compositing).

## 2. Απογραφή — οι 13 καμβάδες (DOM census, production :3000, 2026-07-30)

Μετρημένο στο ζωντανό DOM (`/dxf/viewer`, αποθηκευμένο level): **13 canvases, ΟΛΑ μέσα στο
`.canvas-stack`**, όλα full-viewport 1464×704 εκτός του webgl. Μόνο ο `canvas:dxf` έχει
pointer-events — όλοι οι άλλοι `pointer-events: none` (η συγχώνευση ΔΕΝ αγγίζει input paths).

| # | z | Ταυτότητα | Ιδιοκτήτης (mount) | Περιεχόμενο | Repaint trigger | Πότε άδειος |
|---|---|---|---|---|---|---|
| 0 | 0 | grid-underlay | `GridUnderlayCanvas` (shell, πάντα) | Βοηθητικό grid F7 | `subscribeImmediateTransformFrame('grid-underlay')` | grid off |
| 1 | 0 | floorplan-background | `FloorplanBackgroundCanvas` (shell, αν `floorId`) | Raster κάτοψη | `'floorplan-background'` | χωρίς κάτοψη |
| 2 | 5 | floor-underlay | `FloorUnderlayOverlay` (self-unmount αν 0 όροφοι) | Άλλοι όροφοι faded (ADR-399 D) | `'floor-underlay'` | scope≠all |
| 3 | 0 | layer | `LayerCanvas` ← `DraftLayerSubscriber` (αν `showLayerCanvas`) | Region color layers + draft polygon | δικά του hooks (`layer-canvas-hooks`) | χωρίς regions· ⚠️ ο ΜΟΝΟΣ που έμεινε ΕΚΤΟΣ Φ2 gate (`LayerRenderer.ts:189`) |
| 4 | auto | webgl-line (three.js r170) | `WebglLineLayerManager` (appends δικό του canvas) | Bulk LINE/POLYLINE, camera-matrix pan/zoom (ADR-639 Σ5) | δικός του tick | σκηνή < `WEBGL_LINE_LAYER_MIN_ENTITIES` (χτίζει τίποτα, καμβάς όμως ΥΠΑΡΧΕΙ) |
| 5 | 10 | **dxf** (pe:auto) | `DxfCanvas` ← `DxfCanvasSubscriber` | Entities/grips/selection — bitmap cache Φ3/Φ3.1 | `UnifiedFrameScheduler` | χωρίς σκηνή |
| 6 | 20 | topo-grid-underlay | `TopoGridUnderlayCanvas` (πάντα mounted· `visible` = prop) | ΕΓΣΑ87 graticule (ADR-656 M11) | `'topo-grid-underlay'` | toggle off (**η συνήθης κατάσταση**) |
| 7 | 15 | preview | `PreviewCanvas` (shell, πάντα) | Tool ghosts (move/rotate/grip-drag κ.λπ., ADR-049) | 60fps ΜΟΝΟ σε ενεργό preview | χωρίς ενεργό εργαλείο |
| 8 | 14 | proposal-dispatch | `ProposalDispatchCanvas` (ADR-554: ήδη 7→1) | MEP auto-design ghosts | `'proposal-dispatch'` | χωρίς proposal |
| 9 | 10 | analytical-dispatch | `AnalyticalDispatchCanvas` (ADR-552: ήδη 7→1) | Riser/heat-load/pipe-sizing/balancing/utilization/diagrams/warnings | `'analytical-dispatch'` | χωρίς ανάλυση |
| 10 | 18 | focus-2d | `Focus2DOverlay` (accessibility) | Dashed κυανό focus outline | `'focus-2d-overlay'` | χωρίς keyboard focus (**σχεδόν πάντα**) |
| 11 | 11 | envelope | `EnvelopeOverlay` (πάντα mounted) | ETICS θερμοπρόσοψη (ADR-396 P4) | `'envelope-overlay'` | χωρίς spec (μέχρι το command) |
| 12 | 11 | mep-wires | `HomeRunWiresOverlay` (self-unmount αν 0 συστήματα) | Home-run καλωδιώσεις | `'home-run-wires'` | χωρίς MEP συστήματα |

Εκτός καμβάδων αλλά στον ίδιο transform-frame: `clash-markers-2d`, `topo-qa-markers-2d`
(SVG reproject) και ο snap glyph (SVG `SnapIndicatorGlyph`) — ΔΕΝ είναι canvas στρώματα,
δεν τους αφορά ο Δ.

**Κρίσιμη παρατήρηση:** 10 από τους 13 είναι συνδρομητές του ΙΔΙΟΥ
`subscribeImmediateTransformFrame` και οι 6 από αυτούς περνούν ήδη από το ΙΔΙΟ primitive
`paintOverlayDispatchFrame` (ADR-726 Φ2) με μοντέλο «painter-hook ή null». Η συγχώνευση δεν
εισάγει νέο σχήμα — **προάγει το υπάρχον σχήμα από «ένας καμβάς ανά dispatch» σε «ένας καμβάς
ανά ζώνη z»**.

## 3. Η απόφαση — τρεις ζώνες, ένας καμβάς η καθεμιά

Το z-συμβόλαιο του χρήστη (τι φαίνεται πάνω από τι) διατηρείται **ακέραιο**: η σειρά των
στρωμάτων γίνεται σειρά ζωγραφικής **μέσα** στον καμβά της ζώνης. Οι ζώνες ορίζονται από τα
δύο αμετακίνητα δυναμικά στρώματα (dxf z10, preview z15):

### Ζώνη Α — «underlay-dispatch» (z0, ΚΑΤΩ από το dxf) — 2 → 1 (+ floor-underlay: mount-on-demand)

**Όπως υλοποιήθηκε (Batch 2 — δύο ευρήματα διόρθωσαν το αρχικό «3 → 1»):**

- `grid-underlay` → `floorplan-background` σε ΕΝΑΝ καμβά (`UnderlayDispatchCanvas`, z0)·
  σειρά ζωγραφικής = «κάναβος ΚΑΤΩ από την κάτοψη» (ADR-040, Giorgio 2026-06-05). Μία
  texture upload ανά καρέ χειρονομίας αντί για δύο. Η διάδραση βαθμονόμησης της κάτοψης
  (calibration point picking — η ΜΟΝΗ διάδραση της ζώνης) μεταφέρθηκε στον κοινό καμβά,
  ενεργή ΜΟΝΟ κατά τη διάρκεια calibration session.
- **Ο `floor-underlay` ΔΕΝ συγχωνεύεται** — δύο δομικά εμπόδια που βρέθηκαν στην ανάγνωση:
  (α) ο AutoCAD xref fade του είναι `destination-out` fillRect σε ΟΛΟ τον καμβά — σε κοινό
  καμβά θα έσβηνε ό,τι ζωγραφίστηκε από κάτω (grid/κάτοψη)· (β) κάθεται (z5) ΠΑΝΩ από το
  LayerCanvas (z0, DOM-μεταγενέστερο) — merge στο z0 θα άλλαζε το z-συμβόλαιο (§6 παγίδα 2).
  Αντ' αυτού: **mount-on-demand** (outer gate / inner canvas) — στη συνήθη περίπτωση
  (ένας όροφος ή scope≠all) δεν υπάρχει καν canvas element ⇒ μηδέν στρώμα.

### Ζώνη Β — «overlay-dispatch-2d» (z11, ΠΑΝΩ από dxf, ΚΑΤΩ από preview) — 4 → 1

`analytical-dispatch` (z10) → `envelope` (z11) → `mep-wires` (z11) → `proposal-dispatch` (z14),
σειρά ζωγραφικής = σημερινή σειρά σύνθεσης. Και οι 4 είναι ΗΔΗ painter-hook αρχιτεκτονικής
πάνω στο ίδιο primitive — η συγχώνευση είναι μηχανική: οι painter hooks μετακομίζουν σε ΕΝΑΝ
dispatch (ή εγγράφονται σε registry), `paintOverlayDispatchFrame` δέχεται τη συνενωμένη λίστα.
Το άθροισμα subscriptions είναι ίδιο με σήμερα (επιχείρημα ADR-552) — όλα low-freq.

### Ζώνη Γ — mount-on-demand (τα «πάνω από το preview») — 2 → 0 συνήθως

- `topo-grid-underlay` (z20): το leaf gate-άρει στο `visible` **στο mount** — χωρίς toggle,
  ΚΑΝΕΝΑ canvas element (σήμερα: πάντα mounted, visible ως prop).
- `focus-2d` (z18): ήδη έχει active gate — επαλήθευση ότι πράγματι unmount-άρει χωρίς focus,
  αλλιώς διόρθωση στο ίδιο σχήμα.

Δεν συγχωνεύονται με τη Ζώνη Β γιατί κάθονται ΠΑΝΩ από το preview (z15) — η συγχώνευση θα
άλλαζε το z-συμβόλαιο. Ως mount-on-demand, κοστίζουν στρώμα μόνο όταν προσφέρουν pixel.

### Επιπλέον unmount-when-empty (χωρίς συγχώνευση)

- `webgl-line` ✅ (Batch 3): το large-scene gate (κατώφλι **50.000** οντότητες —
  δηλαδή σχεδόν ΚΑΘΕ σκηνή είναι από κάτω) έγινε gate-at-mount: ούτε container, ούτε
  WebGL context, ούτε το `gl.clear`-ανά-καρέ του ADR-726 §4.Δ. Σε software rasterization
  αυτό ήταν ολόκληρο ζωντανό στρώμα + context για μηδέν draws.
- `layer` (LayerCanvas) ⏳ **ΑΝΑΒΛΗΘΗΚΕ με λόγο** (2026-07-30): το «είναι άδειος;» ΔΕΝ
  κρίνεται από έξω μόνο με `colorLayers.length === 0 && !draft` — το `LayerCanvas` δέχεται
  `renderOptions.showSnapIndicators: true` και 6 ομάδες ρυθμίσεων (ADR-726 Φ2: «θέλει δικό
  του predicate»)· ένα λάθος unmount θα έκοβε περιεχόμενο που δεν είναι color layer (π.χ.
  ό,τι ζωγραφίζει το unified path). Απαιτεί ανάγνωση του `LayerRenderer` (unified/legacy)
  και δικό του predicate + tests — δική της απόφαση, ΟΧΙ βιαστικό μέρος του Batch 3
  (§6 παγίδα 4). Μέχρι τότε ο `canvas:layer` μένει το ΕΝΑ γνωστό Φ2-κενό.

### Αποτέλεσμα (όπως υλοποιήθηκε, Batches 1-3)

| Κατάσταση | Πριν | Μετά |
|---|---|---|
| Τυπικό σχέδιο (χωρίς MEP συστήματα/ανάλυση/topo toggle/focus) | 13 | **5** (underlay-dispatch, layer†, dxf, overlay-dispatch-2d, preview) |
| Όλα ενεργά (≥50k σκηνή, MEP, ανάλυση, όλοι οι όροφοι) | 13 | **7** (+ webgl-line + floor-underlay) |

† Το LayerCanvas μένει ζωντανό — το unmount-when-empty του ΑΝΑΒΛΗΘΗΚΕ (βλ. παραπάνω)·
όταν γίνει, το τυπικό σενάριο πέφτει στο **4**. Επιπλέον ο overlay-dispatch-2d θα μπορούσε
μελλοντικά να unmount-άρεται με όλα τα passes null (⇒ 3) — ΔΕΝ έγινε στο Batch 1: τα painter
hooks πρέπει να τρέχουν για να ξέρουμε πότε παύουν να είναι null, άρα απαιτεί outer/inner
split με τα 16 hooks στον outer — κόστος/όφελος αμφίβολο, ο άδειος καμβάς με Φ2 πύλη δεν
ακυρώνεται ποτέ.

## 4. Αρχιτεκτονική — SSoT και ιδιοκτησία

- **Primitive ζωγραφικής:** το ΥΠΑΡΧΟΝ `paintOverlayDispatchFrame` +
  `overlay-canvas-clear-state.ts` (ledger). ΚΑΜΙΑ νέα έκδοση — επέκταση μόνο αν χρειαστεί
  (π.χ. named passes για attribution).
- **Πύλη καρέ:** το ΥΠΑΡΧΟΝ `subscribeImmediateTransformFrame(id, name, repaint)` — ένα id ανά
  ζώνη αντί για 10. Το per-stage attribution του `__dxfPerf` διατηρείται μέσω per-pass
  χρονομέτρησης ΜΟΝΟ αν το flag είναι ενεργό (μηδέν κόστος off).
- **Transform:** `getImmediateTransform()` στο draw time (ADR-040 XXII.B) — ποτέ React prop.
- **Χειρονομία:** αν χρειαστεί gesture-aware συμπεριφορά, ΜΟΝΟ `isNavigationGesture()`
  (ADR-728 Φ1) — κανένα νέο `isPanning`.
- **Ιδιοκτήτης κύκλου ζωής:** ο shell `CanvasLayerStack` mount-άρει ΕΝΑ leaf ανά ζώνη· κάθε
  ζώνη-leaf συνθέτει τους painter hooks των μελών της (μοτίβο ADR-552: hooks self-subscribe +
  self-gate, το leaf μένει ADR-040-συμμορφωμένο — καμία νέα subscription στον shell, CHECK 6C).
- **Πρότυπο:** `bim-3d/viewport/overlay-dispatch/bim-overlay-pass.ts` — ίδια σημασιολογία
  passes (`active`/`isDirty`/`paint`), προσαρμοσμένη στο 2D transform-frame αντί για
  camera-motion gate.

## 5. Υλοποίηση σε batches (κάθε batch χτίζει και στέκεται μόνο του)

| Batch | Τι | Ρίσκο | Αρχεία (εκτίμηση) |
|---|---|---|---|
| 1 | Ζώνη Β (4→1): overlay-dispatch-2d | Χαμηλό — ίδιο pattern, ίδιο primitive | ~7 (νέο zone leaf, 4 πρώην mounts, shell, ADR-040) |
| 2 | Ζώνη Α (3→1): underlay-dispatch | Μέτριο — floorplan raster pass | ~6 |
| 3 | Ζώνη Γ + unmount-when-empty (topo, focus, webgl-line, layer-empty) | Χαμηλό | ~5 |
| 4 | Μέτρηση-απόδειξη σε production (νέο build) | — | 0 |

Κάθε batch: jest tests (mutation-verified), `jscpd:diff` πριν το «done» (N.18), ADR-040
staged στο ίδιο commit (CHECK 6B/6D), ΟΧΙ tsc (N.17).

## 6. Παγίδες (πληρωμένες αλλού — μην ξαναπληρωθούν)

1. **Το κέρδος ΔΕΝ φαίνεται σε dev** — μόνο production build, ορατό tab, πρωτόκολλο F5
   handoff §4· `frame:INTERVAL` ΜΟΝΟ percentiles (avg/max δηλητηριασμένα από idle gaps).
2. **Z-συμβόλαιο:** η σειρά passes μέσα στη ζώνη = η σημερινή σειρά σύνθεσης. Καμία «τακτοποίηση»
   z τιμών επ' ευκαιρία.
3. **Pointer events:** όλα τα συγχωνευόμενα είναι `pe:none` — ο dxf μένει ο ΜΟΝΟΣ interactive.
   Αν ποτέ ένα pass χρειαστεί input, ΔΕΝ αποκτά ο zone canvas pe:auto — το input πάει στον dxf
   handler path όπως σήμερα.
4. **LayerCanvas:** ΟΧΙ βίαιη ένταξη στη Ζώνη Α «για να κλείσει το νούμερο» — ίδιο σκεπτικό με
   ADR-726 Φ2 που ΔΕΝ πίεσε το `canvas:layer` στο primitive. Unmount-when-empty πρώτα· πλήρης
   ένταξη = δική της απόφαση με δικά της tests.
5. **Ένα grep `clearRect` βρίσκει call sites, ΟΧΙ wrappers** (μάθημα Φ2.1/Focus2D) — η απογραφή
   εδώ έγινε από το DOM (αδιάψευστο), όχι μόνο από grep.
6. **Canvas census στο κρυφό tab = ψέματα** — το `__dxfPerf` απορρίπτει κρυφά καρέ· κάθε
   μέτρηση με ορατό tab.

## 7. Κριτήρια επιτυχίας (production, 47_ergasia.dxf ή ισοδύναμο ~3k οντοτήτων)

| Μετρικό | Πριν (Φ5 baseline) | Στόχος | **Αποτέλεσμα (2026-07-30, §7.1)** |
|---|---|---|---|
| Ζωντανά canvas στρώματα σε ηρεμία | 13 | ≤ 4 | **5** (το ≤4 περιμένει το LayerCanvas unmount, §3) |
| Καρέ > 33ms υπό χειρονομία | 11,5% | αισθητή πτώση (report με αριθμό) | **15,9%** — ΔΕΝ έπεσε ως ποσοστό· ΑΛΛΑΞΕ φύση (βλ. §7.1) |
| Καρέ p90 υπό χειρονομία | 49,8ms | < 40ms (κατεύθυνση· το δάπεδο ορίζει το φυσικό όριο) | **33,3ms** ✅ |
| p50 | 16,7ms (60 FPS) | ΑΜΕΤΑΒΛΗΤΟ — καμία παλινδρόμηση | **16,7ms** ✅ |
| Οπτική ισοδυναμία | — | pixel-ίδιο z-αποτέλεσμα σε όλα τα modes | ✅ σε όσα modes ελέγχθηκαν (§7.1 σημ. 3) |

### 7.1 Batch 4 — Η μέτρηση (2026-07-30, production BUILD_ID `T-mlZj7zMYXP22PFETbIm`)

**Πρωτόκολλο:** F5 handoff §4 — production `next start` :3000, tab ορατό+εστιασμένο,
αποθηκευμένο level «Γεν. Κάτοψη Έργου ΕΡΓΟ Α» = 47_ergasia.dxf **2.909 στοιχεία** (ίδιο
πλήθος με το Φ5 baseline), ανθρώπινο συνεχόμενο pan/zoom από τον Giorgio 18,4s ενεργής
πλοήγησης / 841 καρέ (2ο τρέξιμο — το 1ο, 36,6s με παύσεις hover, απορρίφθηκε ως μη
συγκρίσιμο: το `frame:snap-detection` μόλυνε το δείγμα με hover κόστος άσχετο του Δ).

**DOM census: 13 → 5** (underlay-dispatch z0 · layer z0 · dxf z10 pe:auto · overlay-dispatch-2d
z11 · preview z15) — ακριβώς η αναμονή του §3· μόνο ο dxf έχει pointer-events.

| Δείκτης | Φ5 baseline | Batch 4 |
|---|---|---|
| Καρέ p50 / p75 | 16,7 / 16,7 | **16,7 / 16,8** |
| Καρέ p90 / p95 | 49,8 / — | **33,3 / 33,4** |
| Καρέ p99 | 83,4 | 116,6 (n=841 ⇒ ~8 καρέ, θόρυβος) |
| Καρέ >33ms / >70ms | 11,5% / 1,8% | **15,9% / 2,0%** |
| `frame:underlay-dispatch` (νέο id ζώνης Α) | — | **p99 0,1ms** |
| `frame:overlay-dispatch-2d` (νέο id ζώνης Β) | — | **p99 0,1ms** |
| `frame:TOTAL` | p95 1,4ms | p90 7,6 / p95 9,8ms |
| `frame:dxf-canvas` | p90 74,6 / p95 111,7 / p99 167,9 | **p90 11,9** / p95 100,5 / p99 142,1 |

**Ανάγνωση (τίμια):**

1. **Το compositing stall εξαφανίστηκε.** Στο baseline η ζώνη 33-50ms ήταν διάσπαρτη
   (p90 49,8ms = αυθαίρετες αναμονές compositor με άδειο main thread — η διάγνωση του
   ADR-726 §4.Γ). Τώρα p90=p95=33,3-33,4ms: τα «αργά» καρέ είναι σχεδόν όλα καθαρό
   double-vsync beat, όχι compositing ουρά. Οι δύο zone καμβάδες κοστίζουν **μηδέν**
   (p99 0,1ms) και το στρώμα-φόρτος του compositor έπεσε 13→5.
2. **Το >33% ΔΕΝ έπεσε (11,5→15,9%) — και το λέμε.** Η ουρά που έμεινε ΔΕΝ είναι
   compositing: είναι (α) τα Φ3.1 idle re-rasters του `frame:dxf-canvas` (p95 100ms —
   αγοράζουν το κοφτερό zoom, by design) και (β) `frame:snap-detection` που στο δικό μας
   δείγμα έτρεχε (n=518, p95 34,9ms) ενώ στο baseline ήταν **τελείως απόν** — άρα τα δύο
   >33% δεν είναι αυστηρά συγκρίσιμα· το δικό μας δείγμα κουβαλά και snap κόστος.
   Ο επόμενος μοχλός για την ουρά είναι το snap/hover και το re-raster budget, ΟΧΙ άλλα
   στρώματα.
3. **Οπτικά:** grid pass ζωγραφίζει ΚΑΤΩ από τις οντότητες στον κοινό καμβά ζώνης Α
   (pixel-έλεγχος: grid on → 1,08M px στον underlay, off → 0 px, η Φ2 πύλη καθαρίζει)·
   σχέδιο/χρώματα/κείμενα/πίνακες σωστά σε όλα τα zoom· θολούρα μέσα στη χειρονομία =
   Φ3.1 by design. **Calibration click ΔΕΝ ελέγχθηκε οπτικά** — το level δεν έχει
   αποθηκευμένη raster κάτοψη· καλύπτεται από τα unit tests του Batch 2 (floorplan pass
   null χωρίς floorId, XXII.B φρουρός §4/§5) και εκκρεμεί ως χειροκίνητος έλεγχος στην
   πρώτη πραγματική βαθμονόμηση.
4. **Build fix στο πέρασμα:** το πρώτο production build ΕΣΠΑΣΕ στο prerender του
   `/demo/floorplan-background-image` (import του καταργημένου `FloorplanBackgroundCanvas`).
   Η demo σελίδα ξαναγράφτηκε με demo-local canvas πάνω στο provider SSoT
   (`provider.render()`) — ήταν ο ΜΟΝΑΔΙΚΟΣ live καταναλωτής εκτός viewer (grep όλων των
   καταργημένων ονομάτων Batches 1-3 σε όλο το `src/`).

## Changelog

- **2026-07-30 (ε) — Batch 4 ΕΓΙΝΕ: μέτρηση-απόδειξη σε production (BUILD_ID
  `T-mlZj7zMYXP22PFETbIm`).** DOM census **13 → 5** ✓· p90 καρέ **49,8 → 33,3ms** ✓·
  p50 60 FPS αμετάβλητο ✓· >33ms 11,5→15,9% (ΔΕΝ έπεσε — άλλαξε φύση: η διάσπαρτη
  compositing ουρά 33-50ms έγινε καθαρό double-vsync· η εναπομείνασα ουρά είναι Φ3.1
  re-rasters + snap-detection, όχι στρώματα — πλήρης ανάλυση §7.1). Τα νέα zone ids
  `underlay-dispatch`/`overlay-dispatch-2d` μετρήθηκαν p99 0,1ms. Στο πέρασμα: το πρώτο
  build έσπασε στο prerender του `/demo/floorplan-background-image` (import καταργημένου
  component) — η demo σελίδα ξαναγράφτηκε πάνω στο provider SSoT (§7.1 σημ. 4)· ο grep
  όλων των καταργημένων ονομάτων βρήκε ΜΟΝΟ αυτόν τον καταναλωτή εκτός viewer.
- **2026-07-30 (δ) — Batch 3 ΥΛΟΠΟΙΗΜΕΝΟ (mount-on-demand + zone hook SSoT).**
  `TopoGridUnderlayLeaf` → null χωρίς toggle ΕΓΣΑ87· `Focus2DOverlay` → outer gate / inner
  canvas (focus-state hygiene στο mode flip μένει στον outer· το `clearFocus2DOverlay`
  ΔΙΑΓΡΑΦΗΚΕ μαζί με το test του — ο teardown που το καλούσε δεν υπάρχει πια)·
  `WebglLineLayerSubscriber` → gate-at-mount στο 50k κατώφλι (inner mount, ίδιο
  unregister-before-dispose). ΝΕΟ SSoT `overlay-dispatch/use-overlay-zone-dispatch.ts`:
  ο κοινός zone κύκλος ζωής — εξήχθη όταν το CHECK 3.28 έπιασε τους δύο zone canvases ως
  sibling clones (N.18). LayerCanvas unmount ΑΝΑΒΛΗΘΗΚΕ με τεκμηριωμένο λόγο (§3 —
  showSnapIndicators/unified path: θέλει δικό του predicate). Tests: 94+61 πράσινα στα
  επηρεαζόμενα suites· jscpd:diff καθαρό σε 10 αρχεία.
- **2026-07-30 (γ) — Batch 2 ΥΛΟΠΟΙΗΜΕΝΟ (ζώνη Α: grid+floorplan → 1 · floor-underlay
  mount-on-demand).** Νέο: `overlay-dispatch/UnderlayDispatchCanvas.tsx` (z0, scheduler id
  `underlay-dispatch`, grid pass ΚΑΤΩ από floorplan pass — mutation-verified: αντιστροφή
  σειράς → κόκκινο). Μετατροπές σε painter hooks: `GridUnderlayCanvas.tsx` →
  `useGridUnderlayPainter`, `FloorplanBackgroundCanvas.tsx` → `useFloorplanBackgroundPainter`
  (+ calibration interactivity εκτεθειμένη στον κοινό καμβά· barrel export ενημερωμένο —
  ΠΡΟΣΟΧΗ: ο καμβάς κάνει deep import, ΟΧΙ το barrel, γιατί το barrel τραβά τη
  levels/firestore αλυσίδα). `FloorUnderlayOverlay.tsx` → outer gate / inner canvas
  (mount-on-demand)· το §3 Ζώνη Α διορθώθηκε από «3→1» σε «2→1 + mount-on-demand» με τα
  δύο δομικά ευρήματα (destination-out fade, z5 πάνω από LayerCanvas). Ο φρουρός XXII.B
  §4/§5 μεταφέρθηκε στον νέο καμβά (+ νέο test: floorplan pass null χωρίς floorId).
- **2026-07-30 (β) — Batch 1 ΥΛΟΠΟΙΗΜΕΝΟ (ζώνη Β: 4 → 1).** Νέα: `overlay-dispatch/
  Overlay2DDispatchCanvas.tsx` (ο καμβάς της ζώνης, z-[11], scheduler id `overlay-dispatch-2d`),
  `overlay-dispatch/overlay-2d-zone.ts` (pure z-συμβόλαιο) + φρουρός `overlay-2d-zone.test.ts`
  (mutation-verified: αντιστροφή σειράς → 2 κόκκινα), `use-analytical-painters.ts`,
  `use-proposal-painters.ts`. Μετατροπές σε painter hooks: `EnvelopeOverlay.tsx` →
  `useEnvelopePainter`, `HomeRunWiresOverlay.tsx` → `useHomeRunWiresPainter` (το
  `buildResolver` export άθικτο — έχει δικό του test). ΔΙΑΓΡΑΦΗΚΑΝ:
  `AnalyticalDispatchCanvas.tsx`, `ProposalDispatchCanvas.tsx`. Mounts: shell mount-άρει τον
  ενιαίο καμβά· αφαιρέθηκαν από `canvas-layer-stack-2d-overlays-leaf` + `canvas-layer-stack-
  preview-mounts`. Tests: 6 suites / 50 πράσινα (μαζί ο ενημερωμένος φρουρός XXII.B §4)·
  jscpd:diff καθαρό σε 9 αρχεία. DOM αναμενόμενο: 13 → 10 canvases με ίδιο ορατό αποτέλεσμα.
- **2026-07-30** — Δημιουργία (Phase 0, σχέδιο). Απογραφή 13 καμβάδων από ζωντανό DOM census
  σε production :3000. Καμία γραμμή κώδικα.
