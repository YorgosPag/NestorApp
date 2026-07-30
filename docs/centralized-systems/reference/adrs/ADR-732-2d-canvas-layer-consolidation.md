# ADR-732 — Μοχλός Δ: Ενοποίηση των 13 full-viewport 2D καμβάδων (compositing footprint)

**Status:** 🔨 **Batch 1 ΥΛΟΠΟΙΗΜΕΝΟ (2026-07-30, uncommitted)** — ζώνη Β 4→1
(`Overlay2DDispatchCanvas`)· Batches 2-3 εκκρεμούν· μέτρηση-απόδειξη στο τέλος (Batch 4).
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

### Ζώνη Α — «underlay-dispatch» (z0, ΚΑΤΩ από το dxf) — 3 → 1

`grid-underlay` → `floorplan-background` → `floor-underlay`, με σειρά ζωγραφικής = σημερινό
DOM order. Ένας καμβάς, passes με `active`/`isDirty`/`paint` (πρότυπο `bim-overlay-pass`).
Όλα στατικά περιεχόμενα που αλλάζουν ΜΟΝΟ με το transform ⇒ μία texture upload ανά καρέ
χειρονομίας αντί για τρεις, μηδέν στρώμα σε ηρεμία χωρίς περιεχόμενο.

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

- `webgl-line`: κάτω από το gate εντολών ήδη δεν χτίζει τίποτα — αλλά ο καμβάς μένει. Unmount
  του canvas element κάτω από το gate (μικρές σκηνές = οι περισσότερες).
- `layer` (LayerCanvas): unmount όταν `colorLayers.length === 0 && !draft` — ΚΑΙ το Φ2-κενό
  του (`canvas:layer`, ADR-726 «Εκκρεμεί από τους 9») κλείνει δωρεάν όταν δεν υπάρχει. Η πλήρης
  ένταξή του στη Ζώνη Α είναι ξεχωριστή, ΔΕΥΤΕΡΗ απόφαση (imperative renderer με 2 διαδρομές
  unified/legacy — δεν πιέζεται, βλ. §6 παγίδα 4).

### Αποτέλεσμα

| Κατάσταση | Σήμερα | Μετά |
|---|---|---|
| Ηρεμία, τυπικό σχέδιο χωρίς MEP/ανάλυση/regions | 13 | **4** (underlay, dxf, overlay-dispatch*, preview) — *και αυτός unmount-άρεται αν όλα τα passes inactive ⇒ **3** |
| Χειρονομία με όλα ενεργά (μεγάλη σκηνή, MEP, ανάλυση) | 13 | **6** (+ webgl-line + layer) |

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

| Μετρικό | Πριν (Φ5 baseline) | Στόχος |
|---|---|---|
| Ζωντανά canvas στρώματα σε ηρεμία | 13 | ≤ 4 |
| Καρέ > 33ms υπό χειρονομία | 11,5% | αισθητή πτώση (report με αριθμό) |
| Καρέ p90 υπό χειρονομία | 49,8ms | < 40ms (κατεύθυνση· το δάπεδο ορίζει το φυσικό όριο) |
| p50 | 16,7ms (60 FPS) | ΑΜΕΤΑΒΛΗΤΟ — καμία παλινδρόμηση |
| Οπτική ισοδυναμία | — | pixel-ίδιο z-αποτέλεσμα σε όλα τα modes |

## Changelog

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
