# HANDOFF — ADR-449 σοβάς PART B Slice C (2D) → interaction wiring: PAINTBRUSH MODE (Option B)

**Ημερομηνία:** 2026-07-02 · **ADR:** ADR-449 (structural-finish-skin) + ADR-539 (Cinema4D polygon mode)
**Κατάσταση:** UNCOMMITTED · tsc SKIP (N.17) · ⚠️ **shared working tree με άλλον agent** — re-read κάθε αρχείο ΠΡΙΝ edit.
**COMMIT: ΜΟΝΟ ο Giorgio** (N.(-1)). Ο agent ΔΕΝ κάνει commit/push.

---

## 0. ΤΙ ΘΑ ΚΑΝΕΙΣ (μία γραμμή)

Υλοποίησε το **2D «Βαφή σοβά» paintbrush mode** (Revit «Paint» / Cinema 4D «Polygon Mode» / Figma-level):
ribbon toggle → floating panel με swatches υλικού + custom χρώμα → κλικ σε όψη σοβά στην 2D κάτοψη
→ βάφεται. **Mirror του υπάρχοντος 3D `PolygonMaterialPanel` + polygon mode.** Ο πυρήνας (pick +
writer + apply) είναι ΗΔΗ έτοιμος & tested — απομένει ΜΟΝΟ το 2D interaction/UI wiring.

**Big-player alignment (Giorgio απαίτηση):** Revit/C4D/Figma κάνουν per-face paint ΜΕΣΩ mode + material
picker (ακριβώς το Option B). Επιβεβαιωμένα big-player-aligned. FULL enterprise + FULL SSoT.

---

## 1. 🔴 ΠΡΩΤΟ ΒΗΜΑ — SSoT AUDIT (grep) ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ (Giorgio απαράβατο)

Τρέξε ΠΡΑΓΜΑΤΙΚΟ grep audit για να ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ, όχι να διπλασιάσεις:

```bash
# Ο pick πυρήνας + writer (ΗΔΗ ΕΤΟΙΜΑ — reuse αυτούσια):
grep -rn "pickFinishFaceAtPoint\|collectFinishPickElements" src/subapps/dxf-viewer/bim/finishes/
grep -rn "SetFinishFaceOverrideCommand\|applyFinishFaceOverrideToFaces" src/subapps/dxf-viewer/
# Ο armed one-shot pick precedent (mirror ΑΥΤΟ για το mode):
grep -rn "hatch-select-mode-store\|isHatchSelectArmed\|armHatchSelect\|createToggleStore" src/subapps/dxf-viewer/
# Το 2D click pipeline (εδώ κουμπώνει ο pick — ΕΧΕΙ ήδη το world clickPoint):
grep -rn "handleCanvasClick\|PRIORITY" src/subapps/dxf-viewer/hooks/canvas/useCanvasClickHandler.ts
# Το ribbon toggle pattern (mirror hatch-select command activation):
grep -rn "hatch" src/subapps/dxf-viewer/systems/tools/tool-definitions.ts
grep -rn "activeTool\|deselectTool\|toolStateStore" src/subapps/dxf-viewer/systems/tools/
# Το 3D panel να το mirror-άρεις (swatches + custom color + apply):
sed -n '1,200p' src/subapps/dxf-viewer/bim-3d/ui/PolygonMaterialPanel.tsx
# Πού mount-άρεται 2D floating overlay (βρες τη σωστή θέση mount):
grep -rn "absolute.*z-\[" src/subapps/dxf-viewer/components/dxf-layout/ | head
# Swatch source + color helper (reuse):
grep -rn "FINISH_MATERIAL_OPTIONS" src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/finish-param.ts
grep -rn "getMaterialFlatColorHex" src/subapps/dxf-viewer/bim/materials/material-catalog-defs.ts
```

**Αν οι μεγάλοι παίκτες δεν κάνουν κάτι έτσι → ακολούθησε τη δική τους πρακτική** (Giorgio).

---

## 2. ✅ ΕΤΟΙΜΟΣ & TESTED ΠΥΡΗΝΑΣ (reuse αυτούσιο — ΜΗΝ ξαναγράψεις)

| Αρχείο | Τι δίνει |
|---|---|
| `bim/finishes/finish-face-pick-2d.ts` | **`pickFinishFaceAtPoint(point, elements, scale, tol)`** → `{elementId, edgeIndex, ref}`. Πλησιέστερη ακμή footprint εντός band=πάχος σοβά. Reuse guides `pointToSegmentDistance`. |
| `bim/finishes/finish-pick-scene.ts` | **`collectFinishPickElements(entities)`** → κολόνες(footprint)+δοκάρια(outline) με ενεργό σοβά → `FinishPickElement[]`. |
| `bim/finishes/finish-face-override-ops.ts` | `finishFaceRefForFaceKey(footprint, 'side:i')` + `withFinishFaceOverride(spec, ref, ov\|null)` (immutable). |
| `core/commands/entity-commands/SetFinishFaceOverrideCommand.ts` | **Undoable writer** — γράφει `params.finish.faceOverrides[ref]`. faceKey `side:i` → footprint edge. no-op χωρίς σοβά / σε top/bottom. |
| `bim-3d/ui/apply-finish-face-override.ts` | **`applyFinishFaceOverrideToFaces(levels, faces, value)`** — UI-agnostic (recon-confirmed)! Καλείται ΑΥΤΟΥΣΙΟ από 2D με `[{bimId, faceKey:'side:'+edgeIndex}]`. Batch = ΕΝΑ undo. |

**Η ΓΕΦΥΡΑ 2D→writer:** `pickFinishFaceAtPoint(...).edgeIndex` → `faceKey = 'side:' + edgeIndex` → `applyFinishFaceOverrideToFaces(levels, [{bimId, faceKey}], override)`. Μηδέν δεύτερο write path (κοινό με 3D).

**Reuse για το UI:** `FINISH_MATERIAL_OPTIONS` (`ui/ribbon/hooks/bridge/finish-param.ts`) + `getMaterialFlatColorHex` (`bim/materials/material-catalog-defs.ts`) για swatches· `EnterpriseColorDialog` (`ui/color/EnterpriseColorDialog.tsx`) για custom χρώμα. Ο 3D `PolygonMaterialPanel.tsx` είναι το ΑΚΡΙΒΕΣ πρότυπο (swatches + toggle + dialog + apply).

`FinishFaceOverride` = `{materialId?, colorOverride?, thickness?}`. Panel swatch → `{materialId}`· custom color → `{colorOverride: hex}`.

---

## 3. ΒΗΜΑΤΑ ΥΛΟΠΟΙΗΣΗΣ (Option B — paintbrush mode)

1. **NEW `finish-paint-mode-store.ts`** (mirror `bim/hatch/hatch-select-mode-store.ts`): zustand/`createToggleStore` — `active: boolean` + **`brush: FinishFaceOverride | null`** (το τρέχον «πινέλο»: υλικό ή χρώμα· null = eraser/clear) + setters (`setActive`, `setBrush`).
2. **Ribbon toggle «Βαφή σοβά»** — mirror του hatch-select command activation (tool-definitions + ribbon data). Ενεργοποιεί `setActive(true)`. i18n key (el+en). *(Ψάξε πώς αρματώνεται ο hatch-select από ribbon.)*
3. **Intercept στο `hooks/canvas/useCanvasClickHandler.ts`** (ΕΧΕΙ ήδη το world `clickPoint`· mirror hatch PRIORITY ~0.6): αν `active` → `pickFinishFaceAtPoint(clickPoint, collectFinishPickElements(scene.entities), s, tolWorld)` → αν hit → `applyFinishFaceOverrideToFaces(levels, [{bimId: pick.elementId, faceKey: 'side:'+pick.edgeIndex}], brush)`. **Consume το click** (μην περάσει σε selection). `s = mmToSceneUnits(sceneUnits)`· `tolWorld` = λίγα px→world. Παραμένει armed (paintbrush = πολλαπλές όψεις)· disarm σε Esc/tool deselect. ⚠️ **event-time reads** (`store.getState()`), ΟΧΙ subscriptions (ADR-040).
4. **NEW `FinishPaint2DPanel.tsx`** (mirror `PolygonMaterialPanel.tsx`, ADR-040 leaf): εμφανίζεται όταν `active`· swatches = `FINISH_MATERIAL_OPTIONS.map(o => ({id:o.value, color: getMaterialFlatColorHex(o.value), label: t(o.labelKey)}))` + κουμπί custom χρώμα → `EnterpriseColorDialog` + κουμπί «Καθαρισμός» (brush=null). Κλικ swatch/χρώμα → `setBrush(...)`. Hint «διάλεξε υλικό/χρώμα, μετά κλικ στις όψεις». Mount στο 2D canvas overlay layer.
5. **i18n** (el+en) για ribbon label + panel labels/hints. ΟΧΙ hardcoded strings (N.11).
6. **Tests (jest μόνο, ΟΧΙ tsc):** store toggle/brush· wiring (pick→apply) όπου γίνεται· ο pure πυρήνας έχει ήδη tests.
7. **ADR:** ενημέρωσε ADR-449 changelog (νέο entry `δ.PART-B-Slice-C-2D-wiring`) + ADR-539 cross-ref. **ADR-040 CHECK 6D:** αγγίζεις `useCanvasClickHandler`/canvas → **stage ADR-040** μαζί (μαζί με ADR-449).

**Προαιρετικό (nice-to-have, big-player):** hover highlight της όψης σοβά κάτω από τον κέρσορα όταν armed (mirror 3D face hover). Το 2D finish σχεδιάζεται στο `canvas-v2/dxf-canvas/DxfRenderer.ts:229` → `drawStructuralFinishSkin2D`. Αν είναι πολύ, DEFER.

---

## 4. SCENE ACCESS + WRITE PATH (recon-confirmed)

- Entities: `scene.entities` (prop, flows down). Footprints: κολόνα `geometry.footprint.vertices`, δοκάρι `geometry.outline.vertices` (canvas units) — ΙΔΙΑ που διαβάζει ο command.
- Write: `applyFinishFaceOverrideToFaces(levels, faces, value)` → μέσα του `createLevelSceneManagerAdapter(levels.getLevelScene, levels.setLevelScene, levels.currentLevelId)` + `getGlobalCommandHistory().execute(...)` + `signalEntitiesAttached` (persist). `levels` = `useLevels()` (`systems/levels/useLevels`).
- Το γραμμένο `faceOverrides[ref]` → η σιλουέτα (Slice B `pushFinishOverrideEdges`) το διαβάζει → χρωματίζει το blanket 2D **ΚΑΙ** 3D αυτόματα (attribution + renderer έτοιμα).

---

## 5. ΚΡΙΣΙΜΟ CONTEXT / DO-NOT

- ❌ **ΜΗΝ commit/push** (μόνο Giorgio, N.(-1)). ❌ ΜΗΝ `--no-verify`. ❌ ΜΗΝ τρέχεις `tsc`/typecheck (N.17· **jest OK**).
- ❌ ΜΗΝ `any`/`as any`/`@ts-ignore`. ❌ ΜΗΝ hardcoded Greek strings (i18n, N.11). ❌ ΜΗΝ inline styles (εξαίρεση: data-driven catalog χρώμα σε swatch, όπως ήδη το PolygonMaterialPanel).
- ⚠️ **Shared working tree** — re-read κάθε αρχείο ΠΡΙΝ edit.
- ✅ **SSoT audit (grep) ΠΡΙΝ κώδικα** (§1). Reuse: `pickFinishFaceAtPoint`, `collectFinishPickElements`, `SetFinishFaceOverrideCommand`, `applyFinishFaceOverrideToFaces`, `FINISH_MATERIAL_OPTIONS`, `getMaterialFlatColorHex`, `EnterpriseColorDialog`, `hatch-select-mode-store` (pattern), `PolygonMaterialPanel` (pattern). ΜΗΝ φτιάξεις νέο pick/writer/command.
- ✅ **Big-player**: mode + material picker = Revit/C4D/Figma parity. Αν βρεις καλύτερο big-player pattern → ακολούθησέ το.
- 🔴 **Browser-verify (Giorgio)** μετά: 2D κάτοψη → «Βαφή σοβά» ON → panel → διάλεξε υλικό/χρώμα → κλικ 2 όψεις κολόνας διαφορετικά → διαφορετικό χρώμα στην 2D κάτοψη + BOQ 2 γραμμές (materialId split).

---

## 6. ΤΙ ΕΓΙΝΕ ΗΔΗ (context — UNCOMMITTED, μην το ξαναφτιάξεις)

- **Slice B** (blanket attribution + renderer χρώματος): `structural-finish-attribution.ts` (+silhouette/scene-silhouette/plan-geometry mods)· 3D `MaterialCatalog3D.getFinishColorOverrideMaterial3D` + `structural-finish-3d.ts addFinishPrism colorOverride`· 2D `plan-geometry colorHex = colorOverride ?? material`. Το per-face χρώμα ΦΑΙΝΕΤΑΙ 2D+3D.
- **Slice C 3D**: `finish-face-override-ops.ts` + `SetFinishFaceOverrideCommand.ts` + `apply-finish-face-override.ts` + `PolygonMode3DStore.targetLayer` + `PolygonMaterialPanel` toggle «Σώμα|Σοβάς». 3D paint λειτουργεί (reuse 539 picking).
- **Slice C 2D core**: `finish-face-pick-2d.ts` + `finish-pick-scene.ts` (§2).
- Όλα finishes tests GREEN (185+· 3D+commands +38). ADR-449 changelog entries: `δ.PART-B-Slice-B` / `-C-3D` / `-C-2D-core`. ADR-539 cross-ref.

**Επόμενο ADR number αν χρειαστεί: ADR-370+ (δες CLAUDE.md ADR-370=next free).** Πιθανόν δεν χρειάζεται νέο — επεκτείνεις ADR-449.
