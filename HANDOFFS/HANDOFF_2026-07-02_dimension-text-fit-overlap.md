# HANDOFF — Dimension Text-Fit / Overlap handling (το παλιό «Γ»)

**Ημ/νία:** 2026-07-02
**Feature:** Αποφυγή επικάλυψης κειμένου διάστασης όταν ο αριθμός ΔΕΝ χωράει ανάμεσα στις προεκτάσεις
— η **DIMATFIT / DIMTMOVE** συμπεριφορά των μεγάλων (AutoCAD/Revit: το κείμενο πετάγεται έξω / τα βέλη
αναστρέφονται / προστίθεται leader). Αφορά **ΟΛΕΣ** τις διαστάσεις (auto + χειροκίνητες), όχι μόνο το Auto-Dimension.
**Σχετικό ADR:** πιθανότατα **ADR-362** (Enterprise Dimension) — **επιβεβαίωσέ το** στο `adr-index.md`.
**Κατάσταση:** Το ADR-563 Auto-Dimension **ΟΛΟΚΛΗΡΩΘΗΚΕ** (Φ1+Φ2+Φ3+Φ4-Δ+Φ4-Β+Φ4-Α, UNCOMMITTED). Αυτό
είναι **ξεχωριστό** επόμενο βήμα στον **κοινό dimension renderer**.

> ⚠️ **ΤΟ WORKING TREE ΜΟΙΡΑΖΕΤΑΙ ΜΕ ΑΛΛΟΝ AGENT.** Αυτό το feature αγγίζει τον **ΚΟΙΝΟ** dimension
> renderer/geometry (ΟΧΙ auto-dim-only). Να είσαι **εξαιρετικά προσεκτικός** — additive, μηδέν regression
> στις υπάρχουσες διαστάσεις. **Ο Giorgio κάνει commit/push — ΟΧΙ ο agent.**

---

## 0. Κανόνες συνεδρίας (ΑΠΑΡΑΒΑΤΟΙ)
- 🌐 **Απάντα ΠΑΝΤΑ στα Ελληνικά.**
- 🏢 **Enterprise + FULL SSoT.** «Όπως οι μεγάλοι» (**Revit / Maxon Cinema 4D / Figma-level**). Θέλουμε
  full-enterprise + full-SSoT· **ΑΛΛΑ** αν οι μεγάλοι δεν προτείνουν κάτι, ακολουθούμε **την πρακτική
  των μεγάλων** — **δεν εφευρίσκουμε δική μας**. (Εδώ ο κανόνας των μεγάλων = AutoCAD **DIMATFIT/DIMTMOVE**.)
- 🔎 **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα** — reuse, **ΜΗΔΕΝ διπλότυπα**.
- 🔬 **Ερεύνησε ξανά (WebSearch)** τι κάνουν οι μεγάλοι: AutoCAD **DIMATFIT** (0/1/2/3) + **DIMTMOVE** (0/1/2),
  Revit dimension text auto-position + leader όταν δεν χωράει.
- 📐 **Plan Mode** (ADR-driven). Στο clarify: **ξεκίνα με συγκεκριμένο ASCII/αριθμητικό παράδειγμα**.
- ❌ **ΜΗΝ τρέξεις `tsc`** (N.17). ✅ **jest επιτρέπεται**.
- ❌ **ΜΗΝ commit / push** (N.(-1)). Στο τέλος: update ADR + jest + πρότεινε browser-verify+commit.
- 🚨 **CHECK 6D (pre-commit):** τροποποίηση entity renderers/canvas drawing files → πρέπει να γίνει
  **stage κάποιο ADR/doc** (π.χ. ADR-362). Το ξέρεις από πριν.

---

## 1. ΤΟ ΕΥΡΗΜΑ-ΚΛΕΙΔΙ (κάνε το verify με grep πρώτος — ΜΗΝ το εμπιστευτείς τυφλά)

**Οι ρυθμίσεις υπάρχουν ΗΔΗ end-to-end — αλλά είναι DORMANT (δεν τις διαβάζει ο renderer).**

- `types/dimension.ts:191-194` → `DimStyle.dimatfit` (**DIMATFIT** 0=both outside, 1=arrows first,
  2=text first, 3=best fit) + `DimStyle.dimtmove` (**DIMTMOVE** 0=with dim line, 1=add leader, 2=free move).
- DXF I/O: `utils/dxf-table-parsers.ts` (parse 289/279) + `utils/dxf-dimstyle-writer.ts` (sink 289/279).
- UI: **`ui/panels/dimensions/sections/FitSection.tsx`** — dropdowns για dimatfit/dimtmove (ήδη editable!).
- Templates: `systems/dimensions/dim-style-templates.ts` (dimatfit:3, dimtmove:0).
- **ΑΛΛΑ:** grep `dimatfit`/`dimtmove` σε `systems/dimensions/dim-geometry-builder.ts`,
  `systems/dimensions/builders/linear-aligned-builder.ts`, `rendering/entities/dimension/*` →
  **ΚΑΝΕΝΑ hit**. Το κείμενο σχεδιάζεται ΠΑΝΤΑ στο κέντρο, ό,τι κι αν χωράει.

**Άρα το «Γ» = ΕΝΕΡΓΟΠΟΙΗΣΗ (consumption) των υπαρχόντων settings — ΟΧΙ νέο σύστημα.** Πλήρες SSoT:
UI + DXF + type + templates έτοιμα· λείπει μόνο η συμπεριφορά στο render/geometry.

---

## 2. ΤΑ REUSE LEVERS (πού μπαίνει η λογική — verify με Read)

- **Geometry (pure):** `systems/dimensions/builders/linear-aligned-builder.ts` — υπολογίζει ήδη:
  - `arrowDirection1/2` (`getUnitVector(foot2,foot1)` / αντίστροφα) → **αναστροφή βελών έξω** = invert.
  - `textAnchor = computeTextAnchor(foot1, foot2, entity.textMidpoint)` → **μετατόπιση κειμένου έξω** =
    shift πέρα από foot.
  - Το «gap» = `|foot1 − foot2|` (η απόσταση ανάμεσα στις προεκτάσεις).
  - `leaderPoints`/`leaderLength` fields υπάρχουν ΗΔΗ στο `types/dimension.ts` (DIMTMOVE=1 → leader).
  Ο dispatcher `systems/dimensions/dim-geometry-builder.ts` (`buildDimensionGeometry`) καλεί τους builders.
- **Render-time text width:** `rendering/entities/dimension/dim-text-renderer.ts:359` — ΗΔΗ κάνει
  `ctx.measureText(text).width`. ⚠️ **ΑΡΧΙΤΕΚΤΟΝΙΚΟΣ ΚΟΜΒΟΣ:** η απόφαση «χωράει;» θέλει **πλάτος
  κειμένου** που μετριέται με `ctx.measureText` = **render-time** (ο pure geometry builder δεν έχει ctx).
  Οι μεγάλοι το λύνουν είτε (α) με εκτίμηση πλάτους από ύψος×χαρακτήρες στο geometry, είτε (β) fit
  decision στο renderer. **Δες πώς το κάνει η AutoCAD/Revit στην έρευνα** και ΜΗΝ εφεύρεις δικό σου.
- **Βέλη:** `rendering/entities/dimension/dim-arrowhead-renderer.ts` (`renderArrowhead`) — καταναλώνει
  τα `arrowDirection` του geometry· αναστροφή = γεωμετρικό, όχι νέος renderer.
- **Text box measurement SSoT (ΓΙΑ REUSE):** `canvas-v2/preview-canvas/overlay-label-layout.ts` →
  `measureOverlayLabelBox` / `clearanceForBox` (box-aware clearance) + `drawTextBackgroundMask`
  (dim-text-renderer, ήδη μετράει textWidth+dimgap). Grep το πριν γράψεις δικό σου measure.
- **Manual text move:** `entity.textMidpoint` (χειροκίνητη θέση) + DIMTMOVE=2 (free move) — δες πώς
  παίζει με το auto-fit (το manual override κερδίζει).

---

## 3. SSoT AUDIT — ΥΠΟΧΡΕΩΤΙΚΟ grep ΠΡΙΝ γράψεις (μη-εξαντλητικό)
1. `grep -rn "dimatfit\|dimtmove"` → επιβεβαίωσε ότι **κανείς renderer/builder δεν τα διαβάζει** (dormant).
2. `linear-aligned-builder.ts` + `dim-geometry-builder.ts`: πώς χτίζονται `textAnchor`/`arrowDirection`/gap.
   Υπάρχει ήδη `computeTextAnchor`? `outside`/`fit` λογική? (grep `outside`, `fit`, `flip`).
3. `dim-text-renderer.ts`: πού μετριέται `textWidth`, πού γίνεται translate/rotate, render order.
4. `dim-arrowhead-renderer.ts`: πώς περνάει το arrow direction (για αναστροφή έξω).
5. Leader: grep `leaderPoints`, `leaderLength`, `leader` — υπάρχει render leader path για δείξε reuse.
6. Radial/ordinate/angular: DIMATFIT αφορά κυρίως **linear/aligned** — τσέκαρε αν οι άλλες οικογένειες
   έχουν δικό fit (μην τις σπάσεις· scope = linear/aligned πρώτα, όπως AutoCAD).
7. `FitSection.tsx` + templates: επιβεβαίωσε τα enum values (0/1/2/3, 0/1/2) για συνέπεια στο switch.

---

## 4. Τι πιθανότατα θα κάνεις (ΕΠΙΒΕΒΑΙΩΣΕ στο audit — μην το πάρεις έτοιμο)
- **Νέο pure helper** `systems/dimensions/builders/dim-text-fit.ts` (ή μέσα στον linear-aligned-builder):
  `resolveTextFit({ gapScene, textWidthScene, arrowSizeScene, dimatfit, dimtmove }) →
  { textPlacement:'inside'|'outside'; arrowsOutside:boolean; leader?:Point2D[] }`. Pure, unit-testable.
- Ο builder καταναλώνει το αποτέλεσμα → invert `arrowDirection` όταν `arrowsOutside`, shift `textAnchor`
  όταν `outside`, γεμίζει `leaderPoints` όταν DIMTMOVE=1.
- Το `textWidthScene` έρχεται είτε ως εκτίμηση (geometry, ύψος×char SSoT — grep το `charWidth` fallback
  στο dim-text-renderer:359/201) είτε ως render-time measure που ανατροφοδοτεί (δες τι κάνουν οι μεγάλοι).
- **Μηδέν νέο DimStyle field** (dimatfit/dimtmove υπάρχουν). **Μηδέν νέο DXF I/O** (parse/write υπάρχουν).
- **jest:** `resolveTextFit` (chars: κείμενο χωράει → inside· δεν χωράει + dimatfit=0 → both outside·
  =1 arrows first· =2 text first· =3 best fit· dimtmove=1 → leader points). Table-driven.

## 5. Τι ΝΑ ΜΗΝ κάνεις
- ❌ Μη διπλασιάσεις text-width measurement / box layout — **reuse** `measureOverlayLabelBox` /
  `drawTextBackgroundMask` / τον υπάρχοντα `ctx.measureText` κόμβο.
- ❌ Μη σπάσεις radial/ordinate/angular ούτε τις υπάρχουσες linear/aligned χωρίς fit (default dimatfit=3
  = best fit· βεβαιώσου ότι το «χωράει» keeps σημερινή εμφάνιση → μηδέν regression σε ό,τι ήδη χωράει).
- ❌ Μην αγγίξεις auto-dimension αρχεία (ολοκληρώθηκαν)· μην αγγίξεις `dim-association-service`.
- ❌ Μην commit/push. ❌ Μην τρέξεις tsc.

## 6. Verification
- **jest:** `npx jest "src/subapps/dxf-viewer/systems/dimensions"` + το νέο `dim-text-fit` suite.
- **Browser (Giorgio):** στενή διάσταση (π.χ. 2 κοντινές κολόνες, ~50mm) → ο αριθμός **δεν** επικαλύπτει
  τις προεκτάσεις: πετάγεται έξω / βέλη έξω / leader (κατά dimatfit/dimtmove του style). Άλλαξε
  dimatfit στο `FitSection` → αλλάζει η συμπεριφορά **live**. Πλατιά διάσταση → **αμετάβλητη** (inside).
- **ADR-362** (ή το σωστό): section «Text-fit (DIMATFIT/DIMTMOVE) rendering» + changelog. Ίδιο commit-set.
