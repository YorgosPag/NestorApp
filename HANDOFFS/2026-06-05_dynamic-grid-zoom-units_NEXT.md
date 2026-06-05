# HANDOFF — Δυναμικό Πλέγμα: δεν δημιουργεί κύριες/δευτερεύουσες γραμμές στο zoom-IN (μόνο στο zoom-out)

**Ημερομηνία:** 2026-06-05
**Από:** Opus 4.8 (συνεδρία ADR-418 View Scale)
**Προς:** επόμενη συνεδρία
**Μοντέλο που προτείνεται:** Opus (debug + πιθανό cross-cutting units/grid)

---

## 🎯 ΤΟ ΝΕΟ TASK (η ερώτηση του Giorgio)

Στο DXF Viewer → floating panel αριστερά → καρτέλα **«Ρυθμίσεις DXF»** → υποκαρτέλα **«Ειδικές ρυθμίσεις»** → **Πλέγμα και Χάρακες** → **Πλέγμα** → **Δυναμικό πλέγμα**.

**Συμπτωμα:** Όταν φορτώνεις κάτοψη και κάνεις **zoom IN**, το δυναμικό πλέγμα **ΔΕΝ** δημιουργεί
κύριες (major) + δευτερεύουσες (minor) γραμμές — δεν υπάρχουν «περιθώρια» για να πυκνώσει.
**Μόνο στο zoom OUT** δημιουργούνται σωστά τα levels.

**Ερώτηση Giorgio:** μήπως η κάτοψη είναι «βαλμένη λάθος», ή μήπως το πλέγμα δεν είναι σωστά ρυθμισμένο;

---

## 🔑 ΚΡΙΣΙΜΗ ΥΠΟΘΕΣΗ (διάβασέ την ΠΡΩΤΑ — εξοικονομεί ώρες)

**Πιθανότατα ΟΧΙ «λάθος κάτοψη».** Στην προηγούμενη συνεδρία (ADR-418) **αποδείχθηκε στον κώδικα** ότι:
- Η κάτοψη φορτώνεται σε **ΜΕΤΡΑ** (`scene.units = 'm'`, μέσω `$INSUNITS` → ADR-358).
- DXF(μέτρα) + BIM(mm) **συνυπάρχουν σωστά** — δεν υπάρχει 1000× σφάλμα.
- Το «scale» του transform = **CSS px ανά scene-unit** (όχι mm). Ένα κτίριο ~18 μέτρα = ~18 scene-units.

**Άρα η πιθανή ρίζα του grid bug:** το δυναμικό πλέγμα μάλλον υπολογίζει το spacing/τα levels
(πότε εμφανίζονται major/minor) με **σταθερά κατώφλια σε pixels ή υποθέτοντας μονάδες mm**, ενώ
η σκηνή είναι σε **μέτρα** (πολύ μικροί αριθμοί συντεταγμένων). Όταν κάνεις zoom-in σε σκηνή μέτρων,
το «world spacing» ανά κελί παραμένει π.χ. 1 unit = 1 μέτρο, και το logic που αποφασίζει
subdivisions δεν «βλέπει» χώρο να πυκνώσει επειδή τα thresholds δεν είναι **units-aware**.

➡️ **Συσχέτισέ το με το νέο SSoT `utils/view-scale.ts` + `config/dpi-config.ts` (ADR-418).**
Το grid spacing ΠΡΕΠΕΙ να γίνει units-aware όπως έγινε το view-scale (μέσω `mmToSceneUnits` / DPI),
αλλιώς θα παλεύεις με σύμπτωμα αντί ρίζας.

**Πρώτο βήμα RECOGNITION (N.0.1):** διάβασε τον κώδικα του δυναμικού πλέγματος ΠΡΙΝ γράψεις κώδικα,
και επιβεβαίωσε το repro (ζήτα από Giorgio το ακριβές gesture — δες lesson `feedback_confirm_repro`).

### Σημεία εκκίνησης (grep/read)
- `src/subapps/dxf-viewer/systems/rulers-grid/` — config + grid logic (SSoT πλέγματος/χαράκων).
- Ψάξε: `dynamicGrid`, `gridSpacing`, `majorLine`, `minorLine`, `subdivision`, `gridLevel`,
  `adaptiveGrid`, `pixelsPerCell`, `minPixelSpacing`.
- Η UI ρύθμιση: «Ειδικές ρυθμίσεις → Πλέγμα» — βρες το panel component (grep «δυναμικό πλέγμα» /
  «Δυναμικό» / `RulersGrid` settings panel) για να δεις ποιες παραμέτρους εκθέτει.
- Χρήσιμα SSoT: `utils/scene-units.ts` (`mmToSceneUnits`, `resolveSceneUnits`),
  `config/dpi-config.ts` (`SCREEN_DPI`, `pxPerMmCss`), `systems/zoom/ZoomStore.ts` (scale).
- ADR-040: το grid rendering είναι canvas leaf — σεβάσου micro-leaf (CHECK 6B/6D αν αγγίξεις canvas-v2).

---

## ✅ ΚΑΤΑΣΤΑΣΗ ΠΡΟΗΓΟΥΜΕΝΗΣ ΔΟΥΛΕΙΑΣ (ADR-418 — View Scale 1:N) — ΟΛΟΚΛΗΡΩΜΕΝΗ, UNCOMMITTED

Αντικαταστάθηκε το άχρηστο pixel-% («5496%») με πραγματική κλίμακα προβολής **«1:N»** (Revit-style,
DPI + scene-units aware). tsc 0 (δικά μου), view-scale tests 11/11 PASS. **🔴 browser verify + commit
εκκρεμούν (ο Giorgio κάνει το commit).**

**ΔΙΚΑ ΜΟΥ αρχεία ADR-418** (το working tree είναι SHARED με ≥3 άλλους agents — boiler/radiator/
drainage/materials/roof — **κάνε `git add` ΜΟΝΟ αυτά** αν χρειαστεί, ΠΟΤΕ `git add -A`):

NEW:
- `src/subapps/dxf-viewer/config/dpi-config.ts`
- `src/subapps/dxf-viewer/utils/view-scale.ts`
- `src/subapps/dxf-viewer/utils/__tests__/view-scale.test.ts`
- `src/subapps/dxf-viewer/systems/zoom/hooks/useViewScale.ts`
- `docs/centralized-systems/reference/adrs/ADR-418-view-scale-ssot.md`

MODIFIED (δικά μου):
- `systems/zoom/ZoomManager.ts`, `systems/zoom/hooks/useZoom.ts`, `systems/zoom/zoom-types.ts`
- `contexts/CanvasContext.tsx`
- `components/dxf-layout/CanvasLayerStack.tsx`, `canvas-layer-stack-types.ts`
- `canvas-v2/overlays/RulerCornerBox.tsx`  ⚠️ canvas-v2 → CHECK 6B/6D απαιτεί ADR-418 staged μαζί
- `ui/toolbar/ToolbarStatusBar.tsx`, `StandaloneStatusBar.tsx`, `ZoomControls.tsx`, `MobileToolbarLayout.tsx`
- `ui/ribbon/components/ZoomControlsWidget.tsx`
- `hooks/useDxfViewerState.ts`, `layout/SidebarSection.tsx`
- `app/useAutoFitOnFileChange.ts`, `config/transform-config.ts` (+`MIN_VISIBLE_CONTENT_PX`)
- DELETED: `ui/toolbar/ScaleControls.tsx` (dead)
- SHARED (περιέχουν ΚΑΙ αλλαγές άλλων agents — προσοχή στο commit): τα 4 i18n JSON
  (`el|en × dxf-viewer-panels|dxf-viewer-shell`), `adr-index.md`, `pending-ratchet-work.md`,
  `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`

**Τι κάνει:** «1:N» στα: RulerCornerBox (ένδειξη+presets 1:1…1:500+«Πραγματικό μέγεθος»), κάτω status
bar, ribbon dropdown, sidebar. Νέες μέθοδοι `zoomToRatio`/`zoomToActualSize` (αντί `zoomTo100`).
Reload degenerate-guard (λύνει stale `?s=1` κουκκίδες). Διακριτό από annotation `DrawingScaleWidget`
(ADR-375). **Units/import pipeline ΑΜΕΤΑΒΛΗΤΟ.**

---

## 🚫 ΜΗΝ ΚΑΝΕΙΣ
- **ΟΧΙ commit / push** — ο Giorgio κάνει commit ο ίδιος (N.(-1)).
- **ΟΧΙ `git add -A`** — shared tree· μόνο specific αρχεία.
- **ΟΧΙ μονομερές `adr-index.md`** αν το επεξεργάζεται άλλος agent.
- **ΟΧΙ** να «διορθώσεις» το import/units pipeline — είναι σωστό (επιβεβαιωμένο ADR-418).

## 📌 ΠΡΩΤΗ ΚΙΝΗΣΗ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Δήλωσε μοντέλο (N.14) και περίμενε «ok».
2. RECOGNITION: διάβασε `systems/rulers-grid/` (dynamic grid logic) + επιβεβαίωσε repro με Giorgio.
3. Έλεγξε αν τα grid thresholds είναι units-aware· αν όχι → η ρίζα είναι εκεί (όπως ADR-418).
