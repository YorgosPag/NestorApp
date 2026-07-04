# HANDOFF — Μέγεθος Κειμένου Διαστάσεων (Annotative / Annotation-Scale, big-player)

**Ημερομηνία:** 2026-07-04
**Μοντέλο για συνέχεια:** Opus (σχεδιασμός + cross-cutting, ~4-6 αρχεία, 2 domains)
**ADRs:** ADR-344 (annotation-scale SSoT) · ADR-362 (dimension system) · ADR-418 (drawing scale / zoom-to-scale)
**Στόχος ποιότητας:** Revit / Maxon (Cinema 4D) / Figma-level · **FULL ENTERPRISE + FULL SSOT**

---

## 🎯 ΤΙ ΖΗΤΑΕΙ Ο GIORGIO

Τα **κείμενα των διαστάσεων φαίνονται μεγάλα** (επαναλαμβανόμενο, σε γεωαναφερμένο DXF). Θέλει λύση που:
1. **Να ρυθμίζεται** (ο χρήστης αλλάζει μέγεθος εύκολα).
2. **Να εκτυπώνεται σωστά** (WYSIWYG — τα mm στο χαρτί να είναι ακριβή).
3. **Να ακολουθεί την πρακτική των μεγάλων παιχτών** (Revit annotative / AutoCAD annotation scale).

**Ρητή εντολή:** Αν οι μεγάλοι παίκτες ΔΕΝ προτείνουν κάτι enterprise-custom, **ακολουθούμε ΤΗΝ ΠΡΑΚΤΙΚΗ ΤΟΥΣ**. FULL SSoT — **μηδέν διπλότυπα**.

---

## 🔑 Η ΑΡΧΗ (big-player = Annotative)

> Το ύψος κειμένου ορίζεται ΜΙΑ φορά σε **mm χαρτιού** (π.χ. 2.5mm ISO). Μια **Κλίμακα Σχολιασμού**
> (1:50, 1:100…) το μεγαλώνει/μικραίνει για ΟΛΕΣ τις διαστάσεις μαζί. Εκτύπωση στην ίδια κλίμακα
> → βγαίνει ΑΚΡΙΒΩΣ 2.5mm στο χαρτί.

Παράδειγμα: `2.5mm × 100 (κλίμακα) = 250mm στο μοντέλο` · τυπώνεις 1:100 → `250/100 = 2.5mm` στο χαρτί. ✅

---

## ✅ ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (verified με grep, 2026-07-04 — ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕ, ΜΗΝ ΔΙΠΛΑΣΙΑΣΕΙΣ)

Η μηχανή είναι **ήδη annotative** — τα μισά κομμάτια υπάρχουν:

| Κομμάτι | Αρχείο / σύμβολο | Τι κάνει |
|---|---|---|
| **Math SSoT** | `utils/annotation-scale.ts` → `paperHeightToModel(paperMm, dimscale, sceneUnits)` + `resolveEffectiveDimscale(rawDimscale, drawingScale)` (ADR-344 Round 7) | paper mm → model units· heal του effective dimscale |
| **Text size** | `rendering/entities/dimension/dim-text-renderer.ts` → `primaryTextHeightPx` = `paperHeightToModel(dimtxt, dimscale, units) × viewScale` | το πραγματικό ύψος κειμένου |
| **Resolve pipeline** | `rendering/entities/dimension/dimension-renderer-support.ts` → `resolveDimensionRender` (`dimscale: resolveEffectiveDimscale(...)`) + `scaleGeometryOffsets` (dimexo/dimexe/dimdli/dimcen/breakGap) | εφαρμόζει effective scale παντού |
| **Arrowheads** | `rendering/entities/dimension/dim-arrowhead-renderer.ts` (`dimasz × dimscale × pxPerMm`) | βέλη ακολουθούν κλίμακα |
| **Scale store** | `state/bim-render-settings-store.ts` → `drawingScale`, `setDrawingScale`, `DRAWING_SCALE_PRESETS`· selector `useDrawingScaleStore` | ο ΕΝΑΣ SSoT της κλίμακας σχολιασμού |
| **Auto scale (ΕΝΟΧΟΣ)** | `systems/dimensions/auto-drawing-scale.ts` | αυτόματο fit-to-paper → βγάζει **περίεργο 1:126** |
| **Widgets** | `RibbonAnnotationScaleWidget` (widgetId `annotation-scale`, καρτέλα Διάσταση «Κλίμακα Σχολιασμού») · `DrawingScaleWidget` (widgetId `drawing-scale`, View tab, «1:100» + 6 presets + custom) · contextual dim «Ύψος Κειμένου» (2.5/3.5/5.0mm, key `dim.text.height`) | UI controls (υπάρχουν!) |
| **DimStyle type** | `types/dimension.ts` (`dimtxt`/`paperTextHeight`, `dimscale`, `dimexo/dimexe/dimdli/dimcen`, `breakGap`, `dimasz`) | |
| **Templates** | `systems/dimensions/dim-style-templates.ts` (ISO_129: `dimscale:1, paperTextHeight:2.5`) | |
| **Preview parity** | `canvas-v2/preview-canvas/preview-dimension-renderer.ts` + `preview-dimension-fit.ts` | ghost πρέπει να ταιριάζει με main |
| **Print path** | `ui/components/print/PrintOutputControls.tsx` | ΕΠΑΛΗΘΕΥΣΕ ότι χρησιμοποιεί `drawingScale` (WYSIWYG) |

---

## 🐛 Η ΡΙΖΑ ΤΟΥ «ΜΕΓΑΛΑ» (2 αιτίες)

1. **Auto scale = περίεργος αριθμός**: το `auto-drawing-scale.ts` βγάζει fit-to-paper `1:126` → κείμενο `2.5×126 = 315mm`. Οι μεγάλοι snap-άρουν σε **πρότυπες** (1:50/100/200).
2. **Ασυνέπεια εισαγόμενων**: το `resolveEffectiveDimscale` έχει κανόνα «imported DIMSCALE>1 **νικάει** το drawingScale» → οι εισαγόμενες διαστάσεις ΔΕΝ ακολουθούν την κλίμακα του φύλλου → άλλες μεγάλες, άλλες όχι. ⚠️ Αυτό ήταν **σκόπιμη** επιλογή της ADR-344 (import fidelity) — **ΚΑΤΑΛΑΒΕ ΤΟ ΓΙΑΤΙ πριν το αλλάξεις** (μάλλον θέλει «Make annotative / Normalize» mode, ΟΧΙ κατάργηση).

---

## 📐 ΠΛΑΝΟ (annotative completion — big-player)

Ο σκελετός υπάρχει· χτίζουμε τα 3 κενά **πάνω στα υπάρχοντα SSoT** (μηδέν νέο math/store):

1. **Standard-scale snapping**: το auto (`auto-drawing-scale.ts`) να **snap-άρει στην πλησιέστερη πρότυπη** από `DRAWING_SCALE_PRESETS` (1:126 → 1:100/150), αντί για αυθαίρετο αριθμό. Ή default σε σταθερή (1:100) μέχρι ο χρήστης αλλάξει.
2. **Annotative normalization εισαγόμενων**: κουμπί/mode «Κάν' τες Annotative» → οι εισαγόμενες αγνοούν το baked DIMSCALE και ακολουθούν το `drawingScale` (μέσω `resolveEffectiveDimscale` policy toggle ή per-dim flag). Συνεπές μέγεθος σε όλο το φύλλο.
3. **Print WYSIWYG**: επιβεβαίωσε ότι το `PrintOutputControls` plot-άρει στην ίδια `drawingScale` → σωστά mm. (Πιθανώς ήδη σωστό — verify, μην ξαναγράψεις.)
4. **Ύψος σε paper-mm** = ο «πόσο μεγάλο στο χαρτί» μοχλός (ήδη: «Ύψος Κειμένου»). Global + διατήρηση per-dim override.

---

## ⚠️ ΠΡΟΣΟΧΗ (μην κάνεις)

- **ΠΡΩΤΑ ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** — εντολή Giorgio. Ψάξε `annotation-scale.ts`, `bim-render-settings-store`, `DRAWING_SCALE_PRESETS`, `resolveEffectiveDimscale`, `paperHeightToModel`, `auto-drawing-scale`, print path. **ΧΡΗΣΙΜΟΠΟΙΗΣΕ τα υπάρχοντα, μην φτιάξεις νέο store/helper.**
- **ADR-040 preview parity**: το κείμενο σε main canvas + preview canvas ΠΡΕΠΕΙ να ταιριάζει (`preview-dimension-renderer`/`preview-dimension-fit`).
- **ADR-344 «imported wins»** ήταν σκόπιμο (import fidelity) — κατάλαβε το γιατί, πρόσθεσε **override mode**, μην το σβήσεις τυφλά.
- **ΜΗΝ** τρέξεις tsc (N.17). jest OK.
- **Working tree μοιράζεται με άλλον agent** → explicit pathspec, ΠΟΤΕ bulk `git restore .`/`reset --hard`.
- **UNCOMMITTED στο working tree**: Round 34 (Επιλογή Σειράς) + Round 35 (Λαβές Μετακίνησης Σειρών) — **ΜΗΝ τα αγγίξεις**.
- **COMMIT = Giorgio** (N.(-1)). Εσύ ετοιμάζεις, δεν committάρεις.

---

## ❓ ΕΡΩΤΗΣΕΙΣ ΓΙΑ ΤΟΝ GIORGIO (πριν κώδικα — απλά ελληνικά + παραδείγματα)

1. **Πρότυπες κλίμακες**: ποιες ακριβώς θες στη λίστα (1:20 / 25 / 50 / 100 / 200 / 500) + ελεύθερη τιμή; (υπάρχουν ήδη `DRAWING_SCALE_PRESETS` — επιβεβαίωση/επέκταση).
2. **Εισαγόμενες με baked DIMSCALE**: να γίνονται annotative **πάντα** (ακολουθούν το φύλλο), ή **μόνο** με ρητό κουμπί «Κάν' τες Annotative»;
3. **Auto scale**: να **snap-άρει** στην πλησιέστερη πρότυπη (1:126→1:100), ή default σταθερή **1:100** μέχρι να αλλάξεις;

---

## ΚΑΤΑΣΤΑΣΗ GIT
Working tree μοιράζεται με άλλον agent· Round 34 + Round 35 uncommitted. Ο Giorgio αποφασίζει commit.
