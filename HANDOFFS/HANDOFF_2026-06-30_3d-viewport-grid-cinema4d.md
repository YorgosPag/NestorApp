# HANDOFF — 3D Viewport Grid «όπως το Cinema 4D»

| | |
|---|---|
| **Ημερομηνία** | 2026-06-30 |
| **Author** | Opus 4.8 (προηγ. session: Cinema 4D canvas theme) |
| **Status** | 🔴 NOT STARTED — research + plan first |
| **Working tree** | ⚠️ SHARED με άλλον agent — touch ΜΟΝΟ 3D-grid αρχεία |
| **Commit** | ❌ ΠΟΤΕ από agent — ο Giorgio κάνει commit (N.-1) |

---

## 🎯 ΑΠΟΣΤΟΛΗ
Πρόσθεσε **πλέγμα (grid) στην 3D προβολή** του DXF/BIM viewer, **πανομοιότυπο με το Cinema 4D**:
ίδια εμφάνιση, λογική, χρώματα, συμπεριφορά. Big-player level (Revit / Maxon / Figma).
Full **ENTERPRISE + Full SSoT**. Αν οι μεγάλοι παίκτες δεν προτείνουν enterprise-pattern,
ακολούθησε την **πρακτική των μεγάλων παικτών**.

---

## 🥇 ΥΠΟΧΡΕΩΤΙΚΑ ΠΡΩΤΑ ΒΗΜΑΤΑ (με τη σειρά)

### 1. ΒΑΘΙΑ ΕΡΕΥΝΑ στο εγκατεστημένο Cinema 4D (εντολή Giorgio)
Το C4D είναι εγκατεστημένο στον υπολογιστή του Giorgio:
```
C:\Program Files\MAXON\CINEMA 4D R15
```
- **Scheme VIEWCOLORS** (πηγή αλήθειας χρωμάτων): `...\resource\schemes\Dark\dark.col` → ενότητα `VIEWCOLORS`.
  Ήδη βρέθηκε (επιβεβαίωσέ το ξανά):
  | C4D key | RGB | Hex |
  |---|---|---|
  | `VIEWCOLOR_GRID_MAJOR` | 65,65,65 | **#414141** |
  | `VIEWCOLOR_GRID_MINOR` | 75,75,75 | **#4B4B4B** |
  | `VIEWCOLOR_C4DBACKGROUND` (solid) | 85,85,85 | #555555 |
  | gradient GRAD1/GRAD2 | 91/134 | #5B5B5B → #868686 |
  | `VIEWCOLOR_XAXIS` / `YAXIS` / `ZAXIS` | — | #E52D2D / #2DE52D / #2D2DE5 |
  | `VIEWCOLOR_WXAXIS`/WY/WZ (world, σκουρότερα) | — | #991E1E / #1E991E / #1E1E99 |
  | `VIEWCOLOR_HORIZON` | 150 | #969696 |
- **Grid spacing / subdivisions defaults**: ψάξε στο `...\resource` (`c4d_*.res`/`.str`) και στα user prefs
  `C:\Users\user\AppData\Roaming\MAXON\CINEMA 4D R15_53857526\prefs\` (binary `.prf` — δύσκολα,
  ανέφερε ειλικρινά αν δεν αποκωδικοποιείται). Το C4D «View Settings → Grid» έχει spacing + subdivisions.
- **Μοντέλο grid C4D** (επιβεβαίωσε με έρευνα, μην βασιστείς μόνο σε μνήμη): επίπεδο world grid,
  major γραμμές + minor subdivisions, **οι world άξονες τονισμένοι** (κόκκινο/μπλε γραμμές από origin),
  ορίζοντας. Δες αν είναι infinite/adaptive ή fixed-size.

### 2. ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (GREP) — ΠΡΙΝ γράψεις ΚΩΔΙΚΑ (εντολή Giorgio)
Grep για υπάρχοντα μηχανισμό ΠΡΙΝ φτιάξεις νέο. Κρίσιμα reuse targets:
- **2D grid SSoT** (μετρά πολύ — μην το διπλασιάσεις σε 3D): `systems/rulers-grid/` →
  `config.ts` (`DEFAULT_GRID_SETTINGS`, `GridSettings`, major/minor color+weight+subdivisions, adaptive/smoothFade),
  `RulersGridSystem.tsx` (context + `updateGridSettings`), `rendering/ui/grid/GridRenderer.ts` (Canvas2D draw,
  adaptive spacing, axis lines), `components/dxf-layout/GridUnderlayCanvas.tsx`.
  → Σκέψου αν το 3D grid πρέπει να μοιράζεται **spacing/subdivisions/colors SSoT** με το 2D (Revit/C4D:
  ίδιο grid concept 2D↔3D). Lead with concrete example στον Giorgio.
- **Χρώματα grid (ΗΔΗ tokens)**: `design-tokens.json` → `canvas.grid.cinema4d-major/minor`
  (#414141/#4B4B4B) + active `--canvas-grid-major/minor`. **Μην ξαναγράψεις τα χρώματα** — reuse.
  Reader: `resolveCssVarColor` / `readRootCssVar` (color-config.ts, NEW SSoT primitive — βλ. §προηγ. session).
- **3D scene infra**: `bim-3d/scene/scene-setup.ts` (εδώ δημιουργείται το `THREE.Scene` + lights + `scene.add`,
  γρ. ~212-219· ADR-452 αφαίρεσε `AxesHelper`), `bim-3d/scene/ThreeJsSceneManager.ts`,
  `bim-3d/viewport/BimViewport3D.tsx`. **ΔΕΝ υπάρχει κανένα GridHelper/floor grid σήμερα** (επιβεβαιωμένο grep).
- **Pattern για shader/texture-based grid**: `bim-3d/lighting/studio-background-texture.ts` (DataTexture),
  `bim-3d/scene/post-fx-overlay-pass.ts`. Reuse `color-math.ts` (parseHex/mixHex, ADR-509) για χρωματικά.
- **Up-axis**: ΕΠΙΒΕΒΑΙΩΣΕ τον προσανατολισμό ground plane (το BIM είναι κάτοψη XY + elevation Z mm·
  στο three.js δες αν Y-up ή Z-up — το grid πάει στο ground plane της κάτοψης). Grep camera/up.

### 3. ΑΡΧΙΤΕΚΤΟΝΙΚΗ — μεγάλοι παίκτες
- **Three.js**: `GridHelper`/`PolarGridHelper` (built-in, απλό) **vs** custom **shader-based infinite grid**
  (anti-aliased, fade-with-distance — η σύγχρονη big-player τεχνική, Blender/Babylon/three examples).
  Το C4D grid έχει major/minor + axis highlight → πιθανότατα χρειάζεται **custom shader grid** (το `GridHelper`
  δεν κάνει major/minor + fade καλά). Πρότεινε με concrete παράδειγμα.
- Adaptive spacing (zoom-aware) όπως το 2D `GridRenderer` adaptive — δες αν το φέρεις στο 3D.
- License check αν προτείνεις npm pkg (N.5: ΜΟΝΟ MIT/Apache2/BSD).

---

## 🧱 ΚΑΤΑΣΤΑΣΗ ΚΩΔΙΚΑ (από προηγ. session — UNCOMMITTED, ΜΗΝ τα clobber-άρεις)
Προηγ. session: **Cinema 4D canvas theme** (ADR-004 + ADR-446) — gradient φόντο 2D+3D + κάναβος 2D.
Αρχεία UNCOMMITTED (ο Giorgio θα κάνει commit):
- `design-tokens.json` (+regen `src/styles/design-system/generated/variables.css`,
  `src/styles/design-tokens/generated/tokens.ts`, `tailwind.tokens.js`) — palette `cinema4d`,
  `canvas.gradient.cinema4d-*`, `canvas.grid.cinema4d-*`, `canvas.background.dxf-image`.
- `src/subapps/dxf-viewer/config/color-config.ts` — `CANVAS_THEME.THEMES.CINEMA4D`,
  **`readRootCssVar`** (NEW SSoT primitive: read :root css var), `resolveDxfCanvasGradientStops`, `resolveCssVarColor`.
- `src/subapps/dxf-viewer/bim-3d/lighting/studio-background-texture.ts` — `explicitToStops` (reuse color-math).
- `src/subapps/dxf-viewer/bim-3d/lighting/envmap-generator.ts` — studio bg cache key base+stops.
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasLayerStack.tsx` — 2D gradient image class.
- `src/subapps/dxf-viewer/hooks/canvas/useCanvasSettings.ts` — (reverted to original).
- `src/subapps/dxf-viewer/ui/components/dxf-settings/categories/BackgroundCategory.tsx` — theme «Cinema 4D» + grid→context.
- `src/i18n/locales/{el,en}/dxf-viewer-settings.json` — `themes.cinema4d`.
- `src/subapps/dxf-viewer/systems/axis-cut/axis-cut-line-renderer.ts` — dedup (reuse resolveDxfCanvasBackgroundHex/readRootCssVar).
- `docs/.../ADR-004-canvas-theme-system.md` + `ADR-446-3d-visual-styles-manager.md` — changelogs.
- test: `bim-3d/lighting/__tests__/studio-background-texture.test.ts` (9 jest, GREEN).

⚠️ ΤΟ 3D ΚΑΝΑΒΟ ΕΙΝΑΙ ΝΕΟ — δεν καλύφθηκε από την προηγ. session (το 3D viewport δεν είχε grid).
Τα C4D grid χρώματα (#414141/#4B4B4B) ΥΠΑΡΧΟΥΝ ΗΔΗ ως tokens → reuse.

---

## 📏 ΚΑΝΟΝΕΣ (από CLAUDE.md)
- **N.0.1 ADR-driven**: βρες/ενημέρωσε ADR (νέο ADR; επόμενο free = **ADR-551** — επιβεβαίωσε στο adr-index).
  Code = source of truth· σύγκρινε ADR vs code πρώτα.
- **N.8 execution mode**: αξιολόγησε files/domains· αν 5+ files & 2+ domains → ρώτα Giorgio (Plan/Orchestrator).
- **N.14 model**: δήλωσε μοντέλο & περίμενε «ok» πριν υλοποίηση (εκτός αν Giorgio το δηλώσει).
- **N.17**: ❌ ΟΧΙ `tsc`/typecheck (agent)· ✅ jest στοχευμένα.
- **N.11**: i18n keys σε el+en (όχι hardcoded strings). **N.2/N.3**: όχι `any`, όχι inline styles.
- **N.-1**: ❌ ΟΧΙ commit/push — ο Giorgio. **Shared working tree** — touch ΜΟΝΟ 3D-grid αρχεία.
- **N.7.1**: ≤500 γρ/αρχείο, ≤40 γρ/function. **ADR-040**: αν αγγίξεις performance-critical canvas/3D
  αρχεία → stage ADR-040 (CHECK 6B/6D).
- **SSoT**: Grep ΠΡΙΝ· reuse· μηδέν διπλότυπα· αν βρεις προϋπάρχον διπλότυπο → κεντρικοποίησέ το (διαταγή).
- **Lead with concrete example** (αριθμοί/ASCII) όταν ρωτάς design choice — ο Giorgio σκέφτεται γεωμετρικά.

---

## ✅ DEFINITION OF DONE
3D grid πανομοιότυπο C4D (major #414141 / minor #4B4B4B, world-axis highlight, σωστό ground plane),
SSoT-shared όπου λογικό με το 2D grid + tokens, enterprise, jest για pure slices, ADR updated,
🔴 browser-verify από Giorgio, commit από Giorgio.
