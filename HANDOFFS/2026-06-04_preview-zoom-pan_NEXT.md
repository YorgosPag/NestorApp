# HANDOFF — Zoom (ροδάκι) + Pan μέσα στο παράθυρο ΠΡΟΕΠΙΣΚΟΠΗΣΗΣ τύπου (Edit Type preview)

**Ημερομηνία:** 2026-06-04
**Μοντέλο:** Opus 4.8 (UI/3D interaction — μικρό scope, 2-4 αρχεία)
**Γλώσσα:** Ελληνικά πάντα.
**Commit/Push:** ΜΟΝΟ ο Giorgio (N.(-1)). **ΕΣΥ ΔΕΝ ΚΑΝΕΙΣ COMMIT.**
**Working tree = SHARED με άλλον agent** → stage/git add ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `git add -A`, ΜΗΝ αγγίξεις `adr-index.md` ούτε MEP/furniture αρχεία άλλου agent.
**Test framework = jest** (όχι vitest). Git: `"C:\Program Files\Git\cmd\git.exe"`.

---

## 0. Η ΔΟΥΛΕΙΑ (αυτό ζήτησε ο Giorgio αυτολεξεί)
> «ΘΕΛΩ ΝΑ ΜΠΟΡΩ ΝΑ ΚΑΝΩ ΖΟΟΜ ΜΕ ΤΟ ΡΟΔΑΚΙ ΤΟΥ ΠΟΝΤΙΚΙΟΥ ΚΑΙ PAN ΜΕΣΑ ΣΤΟ ΠΑΡΑΘΥΡΟ ΠΡΟΕΠΙΣΚΟΠΗΣΗΣ»

Το «παράθυρο προεπισκόπησης» = το αριστερό 3D panel μέσα στο floating dialog **«Επεξεργασία Τύπου»** (πλάκας ΚΑΙ τοίχου), όπου φαίνονται οι **στρώσεις** ως textured bands. Αυτή τη στιγμή η κάμερα είναι **σταθερή** (fixed 3/4 view, μηδέν interaction εκτός hover-highlight). Θέλουμε:
- **Zoom** με το ροδάκι (mouse wheel) μέσα στο panel.
- **Pan** (μετακίνηση) με drag μέσα στο panel.
- (Bonus, ρώτα τον Giorgio: rotate ή ΟΧΙ — προτείνω **ΟΧΙ rotate** για να κρατηθεί η καμπυλωμένη 3/4 γωνία που έστησε ο Giorgio· αν θέλει, ενεργοποιείται εύκολα.)

---

## 1. ΠΟΥ ΖΕΙ Ο ΚΩΔΙΚΑΣ (recognition done)

### Slab preview (νέο, Φάση Δ ADR-412 — δες §3):
- **`src/subapps/dxf-viewer/bim-3d/preview/SlabTypePreviewRenderer.ts`** — standalone mini-THREE. `PerspectiveCamera` τοποθετείται από `private fitCamera()` κατά μήκος `VIEW_DIR` σε υπολογισμένη απόσταση, `lookAt(0,0,0)`. **RENDER-ON-DEMAND** (`private render()` — ΟΧΙ RAF loop· καλείται σε κάθε state change). Lifecycle: `setDna` / `setHighlight` / `applyTextures` / `resize` / `dispose`. Raycast band-pick: `pickLayerAt(ndcX,ndcY)`.
- **`src/subapps/dxf-viewer/ui/ribbon/components/SlabTypePreviewPanel.tsx`** — κατέχει το `<div ref={containerRef}>` + τα pointer events. ΗΔΗ έχει `onPointerMove`/`onPointerLeave` → καλεί `renderer.pickLayerAt` για hover-highlight band↔row. **Εδώ θα προστεθούν wheel + drag-pan handlers** (ή θα ανατεθεί interaction στον renderer).

### Wall preview (πρωτότυπο, ADR-414 — PARITY):
- **`src/subapps/dxf-viewer/bim-3d/preview/WallTypePreviewRenderer.ts`** — 1:1 ίδια δομή (bands κατά Z αντί Y· `VIEW_DIR` διαφορετικό· ίδιο `fitCamera`/`render`/`pickLayerAt`).
- **`src/subapps/dxf-viewer/ui/ribbon/components/WallTypePreviewPanel.tsx`** — ίδιο pattern με το slab panel.

> **PARITY:** Ο Giorgio είπε «το παράθυρο προεπισκόπησης» — εφάρμοσε το zoom/pan **ΚΑΙ στα δύο** (slab + wall). Οι δύο renderers είναι ~95% ίδιοι → **σκέψου SSoT**: εξήγαγε κοινό helper (π.χ. `bim-3d/preview/preview-orbit-controls.ts` ή ένα `BasePreviewRenderer`) αντί να διπλασιάσεις (N.0.2 boy-scout). Ελάχιστο: ίδιος μηχανισμός και στους δύο.

---

## 2. ΠΡΟΤΕΙΝΟΜΕΝΗ ΠΡΟΣΕΓΓΙΣΗ (διάλεξε, μη δεσμευτικό)

### Επιλογή A — OrbitControls (συνιστάται, λιγότερος κώδικας)
`three/examples/jsm/controls/OrbitControls` **χρησιμοποιείται ήδη** στο repo (3D MEP wire editing → grep `OrbitControls`). Στήσε:
```ts
const controls = new OrbitControls(this.camera, this.renderer.domElement);
controls.enableRotate = false;     // κράτα τη σταθερή 3/4 γωνία (ρώτα Giorgio)
controls.enableZoom = true;        // ροδάκι
controls.enablePan = true;         // drag pan
controls.enableDamping = false;    // render-on-demand, ΟΧΙ inertia loop
controls.target.set(0, 0, 0);
controls.addEventListener('change', () => this.render()); // ΚΡΙΣΙΜΟ: re-render on demand
```
**Προσοχές:**
1. **RENDER-ON-DEMAND**: μην βάλεις `requestAnimationFrame` loop. Το `'change'` event → `this.render()` αρκεί. `controls.update()` καλείται μόνο όταν χρειάζεται (damping off → δεν χρειάζεται per-frame).
2. **`fitCamera()` conflict**: το `setDna`/`resize` καλούν `fitCamera()` που επαναφέρει camera position + lookAt → **σβήνει** το user zoom/pan. Απόφαση: στο `setDna` (νέος τύπος) ΟΚ να γίνεται reset (`controls.target.set(0,0,0)` + `controls.update()`)· στο **edit στρώσεων** (ίδιος τύπος, αλλάζει `dna`) ΚΑΛΥΤΕΡΑ να **διατηρείται** το view. Σκέψου flag «πρώτο setDna → fit· επόμενα → κράτα camera» ή ξεχωριστό `setDnaPreserveView`. Συντόνισε με `fitCamera` ώστε OrbitControls + manual placement να μη μάχονται (μετά το `fitCamera` κάνε `controls.update()`).
3. **Band-pick hover δεν πρέπει να σπάσει**: το `SlabTypePreviewPanel.onPointerMove` κάνει pick για highlight. OrbitControls δρα μόνο σε button-down (pan/zoom)· το hover (no button) μένει για pick. Βεβαιώσου ότι το pan button δεν συγκρούεται (π.χ. pan = αριστερό drag· αν θες, pan=middle/right και κράτα αριστερό για μελλοντικό). Ρώτα Giorgio ποιο κουμπί για pan.
4. **dispose()**: πρόσθεσε `controls.dispose()` στο `dispose()`.
5. **Import path**: `import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'` (έλεγξε πώς το κάνει το existing MEP 3D wire αρχείο για το σωστό path/version three 0.170).

### Επιλογή B — manual (περισσότερος έλεγχος, περισσότερος κώδικας)
Wheel listener → dolly (scale `distance` γύρω από `VIEW_DIR`)· pointer drag → μετατόπιση camera `target` κατά camera-`right`/`up`. Κράτα `userZoom` + `userPan` state, εφάρμοσέ τα μετά το `fitCamera` base. Render σε κάθε event. Πιο πολλά maths, αλλά πλήρης έλεγχος (π.χ. zoom-to-cursor).

**Σύσταση:** Επιλογή A (OrbitControls, rotate off) — γρήγορο, δοκιμασμένο, parity εύκολο.

---

## 3. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (τι έγινε στην προηγούμενη συνεδρία — ΜΗΝ το ξανακάνεις)
- **ADR-412 Slab Family Types Φάση Γ (engine) + Φάση Δ (UI) DONE** (uncommitted, pending Giorgio commit). Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr412_slab_family_types.md`.
  - Φάση Δ έφτιαξε το floating «Επεξεργασία Τύπου» panel πλάκας + το `SlabTypePreviewRenderer`/`SlabTypePreviewPanel` (το αντικείμενο αυτού του handoff).
  - tsc 0 own· 108 family-types + 343 slab jest PASS.
- **Υφές**: κατέβηκαν CC0 Poly Haven (wood/tile/stone/metal) στο `public/textures/` → διορθώθηκαν τα local 404. **`*.jpg` είναι gitignored** (.gitignore:31) → δεν μπαίνουν σε git, μόνο local dev. Production (Vercel) θέλει Firebase Storage upload (ADR-413 switchable source) — **εκκρεμεί** (Giorgio το αποφασίζει).
- **⚠️ Pre-existing tsc error (ΟΧΙ δικό σου, ΜΗΝ το πειράξεις)**: `src/subapps/dxf-viewer/bim-3d/converters/mesh-to-object3d.ts:124` `getElementMaterial3D(matId:string)` — committed ADR-411 mesh-library (de57f9d5). Όταν τρέχεις tsc, φίλτραρέ το: `npx tsc --noEmit 2>&1 | grep -v mesh-to-object3d`.
- **Εκκρεμεί Φάση Ε (ADR-412 slab, N.15)**: NEW ADR + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + cross-link ADR-412/414 (ΜΗΝ αγγίξεις adr-index). Χαμηλή προτεραιότητα — ο Giorgio αποφασίζει πότε.

---

## 4. ΚΑΝΟΝΕΣ (απαράβατοι)
- **N.(-1):** commit/push ΜΟΝΟ Giorgio. ΠΟΤΕ `--no-verify`.
- **ADR-040:** Τα preview renderers είναι **standalone THREE, ΕΚΤΟΣ** του high-frequency canvas path → **ΔΕΝ** χρειάζεται ADR-040 staging. (Άρα ΟΧΙ CHECK 6B/6D blockers.)
- **SHARED tree:** stage ΜΟΝΟ δικά σου· ΠΟΤΕ `git add -A`· ΜΗΝ adr-index/MEP/furniture.
- **TS:** μηδέν `any`/`as any`/`@ts-ignore`. Function ≤40 γρ, file ≤500 γρ (N.7.1).
- **Verify:** μετά → browser: άνοιξε «Επεξεργασία Τύπου» (πλάκας & τοίχου), δοκίμασε ροδάκι=zoom, drag=pan, και βεβαιώσου ότι το **hover-highlight στρώσης** ΔΕΝ έσπασε. tsc 0 own (φίλτραρε mesh-to-object3d). Αν προσθέσεις λογική με maths → πρόσθεσε jest.

---

## 5. ΓΡΗΓΟΡΟ START
1. `grep -rn "OrbitControls" src/subapps/dxf-viewer` → δες το existing import path + χρήση (three 0.170).
2. Διάβασε `SlabTypePreviewRenderer.ts` + `WallTypePreviewRenderer.ts` (σχεδόν ίδια).
3. Διάλεξε SSoT helper vs per-renderer. Υλοποίησε zoom+pan (rotate off). Σύνδεσε `'change'→render()`. Λύσε το `fitCamera` reset/preserve. `dispose()` cleanup.
4. Parity σε wall + slab. Browser verify. Ενημέρωσε τον Giorgio· **commit τον κάνει αυτός**.
