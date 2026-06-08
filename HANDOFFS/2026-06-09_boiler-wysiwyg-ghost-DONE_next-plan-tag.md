# HANDOFF — WYSIWYG PLACEMENT GHOST ✅ DONE · ΕΠΟΜΕΝΟ: BOILER 2D PLAN TAG (Revit «Mechanical Equipment Tag»)

**Ημερομηνία:** 2026-06-09
**Μοντέλο:** Opus 4.8 (Plan Mode)
**Γλώσσα:** Ελληνικά πάντα.
**Commit:** ΘΑ ΤΟ ΚΑΝΕΙ Ο GIORGIO — όχι ο agent (N.(-1)). **SHARED working tree** με άλλον agent (θέρμανση).
**Ποιότητα:** «όπως οι μεγάλοι, σαν Revit — FULL ENTERPRISE + FULL SSOT».

---

## ⚠️ ΚΡΙΣΙΜΟ — ΠΑΡΑΛΛΗΛΟΣ HEATING/GIZMO ΠΡΑΚΤΟΡΑΣ (επιβεβαιωμένο ξανά από Giorgio)
Δουλεύει ΤΑΥΤΟΧΡΟΝΑ στη **θέρμανση**: radiator/pipe **sizing** (ADR-422 L2/L3/L4), **3D gizmo edits**
(ADR-408 Φ-C/Φ-D/Φ-E), heat-load engine, thermal study PDF, **grip host commits**.
- **ΜΕΝΕ ΜΑΚΡΙΑ** από: `bim/thermal/*` (incl. `heating-equipment-sizing`, `resolve-source-served-spaces`,
  `sizing/*`, `balancing/*`, `report/*`), `mep-radiator-*`, `mep-segment-*`, `mep-system-store`,
  `bim-3d/animation/*` (gizmo), `bim-3d/gizmo/*`, `bim/transforms/*`, `bim3d-edit-*`,
  `bim-three-point-converters.ts`/`BimToThreeConverter.ts` (shared 3D converters),
  **`hooks/grips/*`** (incl. `grip-parametric-heating-host-commits.ts`, `grip-commit-adapters.ts`),
  **`hooks/grip-kinds-mep-heating.ts`**, **`hooks/grip-types.ts`/`unified-grip-types.ts`**,
  `bim/mep-segments/mep-move-propagation.ts`, `hooks/data/useSpaceHeatLoads`/`usePipeSizing`/`useHydraulicBalancing`.
- **git add ΜΟΝΟ δικά σου αρχεία**, ΠΟΤΕ `-A`. **ΜΗΝ adr-index** (shared). **ΕΝΑ tsc** (N.17 — process-check
  πρώτα· ο heating agent τρέχει tsc συχνά· στήσε background .ps1 που ΠΕΡΙΜΕΝΕΙ το slot — pattern στο τέλος).
- **ΠΡΟΣΟΧΗ στο `useRibbonMepBoilerBridge.ts` / `mep-boiler-command-keys.ts` / `contextual-mep-boiler-tab.ts`:**
  περιέχουν ΗΔΗ το **ADR-422 L2 sizing readout** (heating-agent feature). Αλλαγές εκεί = **ΚΑΘΑΡΑ ADDITIVE**·
  ΜΗΝ αγγίξεις τα `readouts.*` / sizing branches. (Το tag βήμα μάλλον ΔΕΝ τα χρειάζεται.)

---

## 🟢 ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτή η συνεδρία) — 🔴 pending browser-verify + commit (Giorgio)

**WYSIWYG PLACEMENT GHOST ΛΕΒΗΤΑ** — το 2D placement preview δείχνει πλέον ΟΛΟ το σύμβολο (connector
stubs + flue vent chevron + divider/flame glyph), byte-for-byte ίδιο με το committed entity.

### Λύση (FULL SSOT reuse, μηδέν νέα γεωμετρία)
NEW getter `useMepBoilerTool.getGhostSymbol(cursor)` → καλεί το ΙΔΙΟ `buildMepBoilerSymbol(params,
computeMepBoilerGeometry(params))` SSoT που χρησιμοποιεί ο placed `MepBoilerRenderer`. Boy-scout extract
κοινού `resolveGhostParams(cursor)` ώστε `getGhostFootprint` + `getGhostSymbol` να μοιράζονται ΕΝΑΝ params
builder (μηδέν drift). Ο ghost renderer δέχεται optional `symbol?` και σχεδιάζει `strokes`+`ventStrokes`
(GHOST_LINE_WIDTH) + `glyphStrokes` (thinner ~1.25) σε ίδιο warm-red palette.

### Αρχεία (boiler-isolated, ADDITIVE)
- `hooks/drawing/useMepBoilerTool.ts` — `resolveGhostParams` + `getGhostSymbol`.
- `bim/mep-boilers/MepBoilerGhostRenderer.ts` — optional `symbol` input + `drawSymbol`/`traceStroke`.
- `hooks/tools/useMepBoilerGhostPreview.ts` — νέο prop `getGhostSymbol` → `drawFrame`.
- `components/dxf-layout/canvas-layer-stack-mep-boiler-ghost.tsx` (mount prop) ·
  `components/dxf-layout/canvas-layer-stack-types.ts` (payload type) ·
  `components/dxf-layout/CanvasSection.tsx:465` (additive `getGhostSymbol`· καμία αλλαγή radiator/heating/sizing).
- NEW `hooks/drawing/__tests__/useMepBoilerTool.test.tsx` (4 tests).

### Verify
- **jest: 40 boiler πράσινα** (4 νέα + 12 symbol + 24 bridge) · **209 dxf-viewer renderers** πράσινα.
  (Το μόνο fail = pre-existing `PropertyShowcaseRenderer.test.ts`, Next.js env `Request is not defined`, ΑΣΧΕΤΟ.)
- **tsc (N.17, background, wait-for-slot): καθαρό** — μηδέν `error TS` στα δικά μου.
- **ADR-040 STAGED** (CHECK 6B/6D — CanvasSection orchestrator + mount/hook architecture-critical· ΑΛΛΑ μόνο
  pass-through ενός pure getter, μηδέν νέα subscription/cache-key).

### Docs ✅ (N.15)
ADR-408 changelog ✅ · ADR-040 changelog ✅ · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` ✅ (top) ·
memory `project_adr408_combi_boiler` ✅. **ΜΗΝ adr-index.**

### Files για git add (Giorgio)
```
src/subapps/dxf-viewer/hooks/drawing/useMepBoilerTool.ts
src/subapps/dxf-viewer/bim/mep-boilers/MepBoilerGhostRenderer.ts
src/subapps/dxf-viewer/hooks/tools/useMepBoilerGhostPreview.ts
src/subapps/dxf-viewer/components/dxf-layout/canvas-layer-stack-mep-boiler-ghost.tsx
src/subapps/dxf-viewer/components/dxf-layout/canvas-layer-stack-types.ts
src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx
src/subapps/dxf-viewer/hooks/drawing/__tests__/useMepBoilerTool.test.tsx
docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```

---

## 🎯 ΕΠΟΜΕΝΗ ΕΡΓΑΣΙΑ: BOILER 2D PLAN TAG (Revit «Mechanical Equipment Tag»)

### Γιατί ΑΥΤΟ (conflict-free + Revit-grade + φυσική συνέχεια)
Στη Revit κάθε Mechanical Equipment family έχει **tag** στην κάτοψη: ετικέτα-leader που δείχνει τα κρίσιμα
παραμετρικά. Μόλις κάναμε WYSIWYG το **σύμβολο**· το φυσικό επόμενο = να **ονοματίσουμε** τον λέβητα στο σχέδιο.
Δείχνει: **μοντέλο** (Type Catalog), **ισχύς** (thermalOutputW → kW), **καύσιμο** (fuelType), **Ø καπναγωγού**
(flueDiameterMm, μόνο αν gas/oil). 100% **boiler-isolated** — μηδέν επικάλυψη με heating/gizmo/grip/sizing.

### 🔑 Recognition-first (ΔΙΑΒΑΣΕ ΠΡΩΤΑ)
- **`bim/renderers/OpeningTagRenderer.ts`** — το ΚΑΝΟΝΙΚΟ Revit-tag pattern (leader + κουτί + text). Πρότυπο styling.
- **`bim/renderers/MepSegmentRenderer.ts`** (γρ. ~350-400, `drawSlopeLabel`) — inline `ctx.fillText` label
  precedent ΜΕΣΑ σε MEP renderer (fixed pixel size, zoom-invariant, perpendicular offset). Το πιο κοντινό πρότυπο.
- **`bim/renderers/MepBoilerRenderer.ts`** — εδώ μπαίνει το tag (inline, μετά το symbol/finalizeRender).
- **`config/text-rendering-config.ts`** — `RENDER_LINE_WIDTHS` ΗΔΗ imported· ψάξε font-size/text SSoT (ΜΗΝ hardcode px).
- **`bim/mep-boilers/boiler-model-catalog`** — από εδώ το μοντέλο (assetId → product name· `isLiteralLabel`).
- **i18n:** labels («Ισχύς», «Καύσιμο», «Καπναγωγός», μονάδες kW/DN) → `t('...')`· **ΠΡΩΤΑ** keys σε
  `src/i18n/locales/el/dxf-viewer-shell.json` **ΚΑΙ** `en/...` (N.11· ΟΧΙ hardcoded Greek/English· fuelType enum→i18n map).

### Σχέδιο (Plan Mode → έγκριση: tag layout + ποια πεδία + styling)
1. **NEW pure SSoT** `bim/mep-boilers/mep-boiler-tag.ts` — `buildBoilerTagLines(params): string[]` (i18n-keys +
   formatted values· μοναδική πηγή «τι γράφει το tag»). Καθαρό, unit-test-able. ΜΗΝ format μέσα στον renderer.
2. **`MepBoilerRenderer.ts`** — NEW private `drawTag()` (mirror `MepSegmentRenderer.drawSlopeLabel`): leader από
   bbox corner + κουτί + γραμμές κειμένου, fixed-pixel (zoom-invariant), warm-red/neutral. Κλήση μετά το symbol.
   Gated από visibility (ακολουθεί το ίδιο `resolveIsEntityVisible` που ήδη τρέχει· tag κρύβεται με το entity).
   **Προαιρετικά** ξεχωριστό toggle «Ετικέτα» (αν θες· αλλιώς πάντα-on σαν Revit auto-tag — απόφαση στο plan).
3. **i18n keys** (el+en) για labels + fuelType enum map + μονάδες.
4. **Tests:** `mep-boiler-tag.test.ts` (pure: gas combi → γραμμές με kW+fuel+flue Ø· electric → χωρίς flue
   γραμμή· μηδέν μοντέλο → fallback). Κράτα τον renderer draw out-of-scope (canvas).
5. **ADR-040:** `MepBoilerRenderer.ts` είναι entity-drawing → πιθανόν CHECK 6D (drawing file χωρίς ADR doc
   staged). **Stage ADR-408** (το ενημερώνεις ούτως ή άλλως)· αν το hook μπλοκάρει για 6D → stage ADR-040 changelog.
6. **Docs (N.15):** ADR-408 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory (`project_adr408_combi_boiler` «Next»). **ΜΗΝ adr-index.**

### Εκτίμηση: ~3 αρχεία (NEW tag SSoT + MepBoilerRenderer + i18n) + 1 test, 1 domain → **Plan Mode**.

### Εναλλακτικά επόμενα — DEFERRED (επιβεβαιωμένος conflict με heating/gizmo agent):
- **Boiler 2D grips** (move/rotate/resize κάτοψη): ⚠️ **HIGH conflict** — το `UpdateMepBoilerParamsCommand` είναι
  ΗΔΗ wired στα **`hooks/grips/grip-parametric-heating-host-commits.ts`**, **`hooks/grip-kinds-mep-heating.ts`**,
  `hooks/grips/grip-commit-adapters.ts` (heating-agent zone). Defer μέχρι να τελειώσει ο gizmo agent.
- **Flue 3D stub** (κατακόρυφος κύλινδρος από κορυφή): shared 3D converter (`bim-three-point-converters`/
  `BimToThreeConverter`) = ΥΨΗΛΟΣ conflict. Defer.
- **Vent terminal / καμινάδα** (νέο point entity στην κορυφή): conflict-free αλλά **μεγάλο** (νέα οικογένεια:
  entity type + schema + renderer + tool + 3D mesh). Defer ως ξεχωριστό μεγαλύτερο slice.
- **Flue duct routing** (duct segment από flue connector): `mep-segment` = heating zone → conflict. Defer.
- **fuel/efficiency ΚΕΝΑΚ** / **DHWR pump-flow sizing**: ΥΨΗΛΟΣ conflict με ADR-422 sizing/energy (heating). Defer.

---

## ❌ ΜΗΝ
- ΜΗΝ commit/push χωρίς εντολή (N.(-1))· ΠΟΤΕ `git add -A`.
- ΜΗΝ πειράξεις heating/gizmo αρχεία (thermal/sizing/balancing/segment/radiator/system-store/3D-gizmo/transforms/
  shared 3D converters/**hooks/grips\***/**grip-kinds-mep-heating**/mep-move-propagation).
- ΜΗΝ αγγίξεις τα **sizing readouts** (`readouts.*`) στο boiler bridge/command-keys/tab.
- ΜΗΝ τρέξεις 2ο tsc ταυτόχρονα (N.17 — process-check + wait-for-slot πρώτα).
- ΜΗΝ adr-index (shared). `any`/inline styles/hardcoded i18n απαγορεύονται.

## Πρώτα βήματα νέας συνεδρίας
1. Recognition: `OpeningTagRenderer.ts` + `MepSegmentRenderer.ts` (`drawSlopeLabel`) + `MepBoilerRenderer.ts`
   + `text-rendering-config.ts` + `boiler-model-catalog`. Έλεγξε ποια πεδία είναι διαθέσιμα στο `boiler.params`.
2. Plan Mode → έγκριση (tag layout + πεδία + always-on vs toggle + styling).
3. Υλοποίηση· tests· ΕΝΑ tsc (process-check + wait-for-slot)· docs (N.15). Commit → Giorgio.

## tsc serialization (N.17 — pattern που δούλεψε)
Γράψε `.ps1` (το bash-on-Windows τρώει τα `$_`/`$f` σε inline `-Command`· χρησιμοποίησε `-File` με forward slashes):
```powershell
$waited = 0
while ($waited -lt 600) {
  $busy = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*tsc*' }
  if (-not $busy) { break }
  Start-Sleep -Seconds 15; $waited += 15
}
Set-Location C:\Nestor_Pagonis
npx tsc --noEmit 2>&1 | Select-String -Pattern 'mep-boiler|boiler-tag|error TS' | Select-Object -First 40
"TSC_DONE"
```
Τρέξε: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:/Nestor_Pagonis/<name>.ps1"` (run_in_background).
Σβήσε το ps1 μετά.
