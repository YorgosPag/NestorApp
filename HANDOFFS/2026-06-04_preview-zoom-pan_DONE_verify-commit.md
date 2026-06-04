# HANDOFF — Zoom/Pan/Rotate + Alt-click pivot στο παράθυρο ΠΡΟΕΠΙΣΚΟΠΗΣΗΣ τύπου (Edit Type preview)

**Ημερομηνία:** 2026-06-04
**Μοντέλο:** Opus 4.8 (UI/3D interaction — μικρό scope)
**Γλώσσα:** Ελληνικά πάντα.
**Commit/Push:** ΜΟΝΟ ο Giorgio (N.(-1)). **ΕΣΥ ΔΕΝ ΚΑΝΕΙΣ COMMIT, ΔΕΝ ΚΑΝΕΙΣ PUSH.**
**Working tree = SHARED με άλλον agent** → stage/git add ΜΟΝΟ δικά σου αρχεία (τα 5 παρακάτω), ΠΟΤΕ `git add -A`, ΜΗΝ αγγίξεις `adr-index.md` ούτε MEP/furniture αρχεία άλλου agent.
**Test framework = jest** (όχι vitest). Git: `"C:\Program Files\Git\cmd\git.exe"`.

---

## 0. ΚΑΤΑΣΤΑΣΗ: Ο ΚΩΔΙΚΑΣ ΕΙΝΑΙ ΓΡΑΜΜΕΝΟΣ & tsc-CLEAN — ΕΚΚΡΕΜΕΙ ΜΟΝΟ (α) BROWSER VERIFY (β) COMMIT (Giorgio)

Ο Giorgio ζήτησε, στο αριστερό 3D panel του floating dialog **«Επεξεργασία Τύπου»** (πλάκας ΚΑΙ τοίχου):
1. **Zoom** με το ροδάκι ✅
2. **Pan** με **αριστερό drag** ✅ (επιλογή Giorgio)
3. **Rotate** με **δεξί drag** ✅ (ο Giorgio είπε «ναι, και rotate» — AskUserQuestion)
4. **Alt + αριστερό κλικ** → το σημείο του κλικ γίνεται το **κέντρο περιστροφής (orbit pivot)** ✅

Όλα υλοποιημένα, `npx tsc --noEmit` = **0 δικά μου σφάλματα** (φιλτράροντας το pre-existing `mesh-to-object3d.ts:124`).

---

## 1. ΤΙ ΑΛΛΑΞΕ (5 αρχεία — ΟΛΑ δικά σου, stage ΜΟΝΟ αυτά)

### NEW: `src/subapps/dxf-viewer/bim-3d/preview/preview-orbit-controls.ts`
SSoT helper `PreviewOrbitControls` (wrapper γύρω από `OrbitControls`, import `three/addons/controls/OrbitControls.js` — ίδιο path με `viewport-camera.ts:8`):
- `enableRotate=true`, `enableZoom=true`, `enablePan=true`, **`enableDamping=false`** (render-on-demand, ΟΧΙ RAF loop — re-render μέσω `'change'` event).
- `zoomToCursor=true`, `screenSpacePanning=true`.
- `mouseButtons = { LEFT: PAN, MIDDLE: DOLLY, RIGHT: ROTATE }`.
- **View-preservation**: getter `adjusted` (true μόλις ο χρήστης πειράξει κάμερα — μέσω `'change'`, με `programmatic` guard στα δικά μας `update()`). `recenter()` = target→origin χωρίς να μετράει ως user input.
- **Alt+click pivot**: native `pointerdown`/`pointerup` listeners στο dom. Στο down κρατά `altArmed = altKey && button===0` + θέση. Στο up, αν η μετακίνηση < `ALT_CLICK_SLOP_PX` (4px) → καλεί `onAltPick(clientX, clientY)`. Έτσι το στατικό Alt+αριστερό-κλικ θέτει pivot, ενώ το Alt+αριστερό-**drag** μένει pan (μηδενικό pan του OrbitControls στο click = no-op). Καθρέφτης του tumble convention του app (ADR-366 §A.6.Q5).
- `setPivot(point)` = `controls.target.copy(point); controls.update()` (κρατά θέση κάμερας, αλλάζει κέντρο περιστροφής — ίδια λογική με `viewport-camera.ts:353 setOrbitPivot`).
- `dispose()` αφαιρεί τους listeners + `controls.dispose()`.

### `SlabTypePreviewRenderer.ts` + `WallTypePreviewRenderer.ts` (1:1 parity)
- Νέο field `controls: PreviewOrbitControls`, init στον constructor (callbacks: `() => this.render()` + `(cx,cy) => this.setPivotAt(cx,cy)`).
- **`setDna`/`resize`**: `fitCamera()` + `controls.recenter()` ΜΟΝΟ όσο `!controls.adjusted` → auto-fit στις αλλαγές στρώσεων μέχρι ο χρήστης να πειράξει κάμερα· μετά διατηρείται το zoom/pan/rotate/pivot. (Στο resize, αν adjusted → μόνο `camera.updateProjectionMatrix()`.)
- Νέα private `setPivotAt(clientX, clientY)`: NDC από canvas rect → `raycaster.intersectObjects(bandGroup)` → αν hit, `controls.setPivot(hit.point.clone())` (miss → κρατά τρέχον pivot).
- `dispose()`: `controls.dispose()` πριν το `renderer.dispose()`.

### `SlabTypePreviewPanel.tsx` + `WallTypePreviewPanel.tsx`
- `onPointerMove`: early-return `if (e.buttons !== 0) return;` — κατά το drag (pan/rotate) δεν ξανα-pick-άρει band → **hover-highlight στρώσης (band↔row) ΑΝΕΠΑΦΟ**. Σε plain hover (no button) το pick δουλεύει κανονικά.

---

## 2. 🔴 ΤΙ ΠΡΕΠΕΙ ΝΑ ΓΙΝΕΙ ΤΩΡΑ

### (α) BROWSER VERIFY (πριν το commit)
Άνοιξε το DXF viewer → επίλεξε τοίχο/πλάκα με τύπο → «Επεξεργασία Τύπου». Στο αριστερό 3D preview:
1. **Ροδάκι** = zoom (προς cursor).
2. **Αριστερό drag** = pan.
3. **Δεξί drag** = rotate.
4. **Alt + αριστερό κλικ** πάνω σε στρώση → επόμενο δεξί-drag rotate περιστρέφεται γύρω από εκείνο το σημείο.
5. **Hover** σε στρώση → φωτίζεται το αντίστοιχο row (και αντίστροφα) — ΔΕΝ έσπασε.
6. Άλλαξε στρώσεις ΑΦΟΥ κάνεις zoom/pan → η κάμερα ΔΕΝ επαναφέρεται· ΠΡΙΝ πειράξεις κάμερα → auto-fit κρατά τις στρώσεις centered.
7. Parity: ίδια συμπεριφορά σε πλάκα ΚΑΙ τοίχο.

### (β) COMMIT — ΤΟ ΚΑΝΕΙ Ο GIORGIO
Stage ΜΟΝΟ τα 5 αρχεία (SHARED tree):
```
src/subapps/dxf-viewer/bim-3d/preview/preview-orbit-controls.ts   (NEW)
src/subapps/dxf-viewer/bim-3d/preview/SlabTypePreviewRenderer.ts
src/subapps/dxf-viewer/bim-3d/preview/WallTypePreviewRenderer.ts
src/subapps/dxf-viewer/ui/ribbon/components/SlabTypePreviewPanel.tsx
src/subapps/dxf-viewer/ui/ribbon/components/WallTypePreviewPanel.tsx
```
ΠΟΤΕ `git add -A`. ΜΗΝ adr-index/MEP/furniture.

---

## 3. ΚΑΝΟΝΕΣ / ΣΗΜΕΙΩΣΕΙΣ
- **ADR-040:** Τα preview renderers είναι **standalone THREE, ΕΚΤΟΣ** του high-frequency canvas path → **ΔΕΝ** χρειάζεται ADR-040 staging (ΟΧΙ CHECK 6B/6D).
- **tsc:** φίλτραρε το pre-existing `src/subapps/dxf-viewer/bim-3d/converters/mesh-to-object3d.ts:124` (ADR-411 mesh-library, ΟΧΙ δικό σου): `npx tsc --noEmit 2>&1 | grep -v mesh-to-object3d`.
- **jest:** δεν προστέθηκε νέα καθαρή maths λογική (μόνο OrbitControls config + boolean flag + alt-click slop, WebGL/DOM-dependent → μη unit-testable σε jsdom χωρίς βαρύ mocking) → gate = browser verify.
- **Reuse/SSoT:** το OrbitControls + pivot pattern καθρεφτίζει το `bim-3d/viewport/viewport-camera.ts` (κύριο viewport, ADR-366 §A.6.Q5).
- **TS:** μηδέν `any`/`as any`/`@ts-ignore`. Function ≤40 γρ, file ≤500 γρ — τηρούνται.

## 4. ΕΚΤΟΣ SCOPE (ΔΕΝ θα κάνεις — Giorgio αποφασίζει)
- Φάση Ε ADR-412 slab (NEW ADR + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + cross-link ADR-412/414) — χαμηλή προτεραιότητα.
- Production textures: `*.jpg` gitignored → Firebase Storage upload για Vercel (ADR-413 switchable source) — εκκρεμεί, Giorgio αποφασίζει.
