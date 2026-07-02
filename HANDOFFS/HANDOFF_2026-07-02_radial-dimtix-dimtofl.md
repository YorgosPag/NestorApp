# HANDOFF — Radial dim text placement (DIMTIX / DIMTOFL) — κείμενο μέσα/έξω κύκλου

**Ημ/νία:** 2026-07-02
**Feature:** Radius / Diameter / ArcLength / JoggedRadius — σεβασμός **DIMTIX** (force text μέσα στον
κύκλο/τόξο) + **DIMTOFL** (dim line/leader μέσα στον κύκλο ακόμη κι όταν το κείμενο πάει έξω), όπως
οι μεγάλοι (AutoCAD/Revit). Είναι **ξεχωριστό** από το DIMATFIT overlap-fit (linear/angular) — άλλη
συμπεριφορά, άλλη αρχιτεκτονική.
**Σχετικό ADR:** **ADR-362** (Enterprise Dimension System) — επιβεβαιωμένο (`adr-index.md:354`,
`ADR-362-enterprise-dimension-system.md`).
**Κατάσταση:** Το **Phase M (linear/aligned)** + **Phase M2 (angular)** του text-fit **ΟΛΟΚΛΗΡΩΘΗΚΑΝ**
(UNCOMMITTED, ADR-362 Round 29· 25/25 dim-text-fit + 473/473 dimensions/renderer jest). Αυτό εδώ =
**Phase M3 (radial)** — το τελευταίο κομμάτι για πληρότητα «όπως οι μεγάλοι».

> ⚠️ **ΤΟ WORKING TREE ΜΟΙΡΑΖΕΤΑΙ ΜΕ ΑΛΛΟΝ AGENT.** Ο κοινός dimension renderer/geometry έχει ήδη
> **SRP-split** (βλ. §2 ΝΕΑ ΔΟΜΗ). Additive, μηδέν regression. **Ο Giorgio κάνει commit/push — ΟΧΙ ο agent.**

---

## 0. Κανόνες συνεδρίας (ΑΠΑΡΑΒΑΤΟΙ)
- 🌐 **Απάντα ΠΑΝΤΑ στα Ελληνικά.**
- 🏢 **Enterprise + FULL SSoT.** «Όπως οι μεγάλοι» (**Revit / Maxon Cinema 4D / Figma-level**). Full
  enterprise + full SSoT· **ΑΛΛΑ** αν οι μεγάλοι δεν προτείνουν κάτι, ακολουθούμε **την πρακτική τους**
  — δεν εφευρίσκουμε δική μας. (Εδώ ο κανόνας των μεγάλων = AutoCAD **DIMTIX/DIMTOFL/DIMTMOVE** για radial.)
- 🔎 **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα** — reuse, **ΜΗΔΕΝ διπλότυπα**.
- 🔬 **Ερεύνησε ξανά (WebSearch)** τι κάνουν οι μεγάλοι: AutoCAD **DIMTIX** (radius/diameter → text
  inside vs outside circle), **DIMTOFL** (dim line inside even when text outside), **DIMTMOVE** (leader).
- 📐 **Plan Mode** (ADR-driven). Στο clarify: **ξεκίνα με συγκεκριμένο ASCII/αριθμητικό παράδειγμα**
  (ο Giorgio σκέφτεται σε γεωμετρία — δώσε νούμερα/σχέδιο, όχι αφηρημένη ερώτηση).
- ❌ **ΜΗΝ τρέξεις `tsc`** (N.17). ✅ **jest επιτρέπεται** (γρήγορα, στοχευμένα).
- ❌ **ΜΗΝ commit / push** (N.(-1)). Στο τέλος: update ADR-362 + jest + πρότεινε browser-verify+commit.
- 🚨 **CHECK 6D (pre-commit):** τροποποίηση entity renderers / canvas drawing files → πρέπει να γίνει
  **stage ADR-362**. Το ξέρεις από πριν.

---

## 1. ΤΟ ΕΥΡΗΜΑ-ΚΛΕΙΔΙ (verify με grep — ΜΗΝ το εμπιστευτείς τυφλά)

**Τα `dimtix`/`dimtofl` υπάρχουν end-to-end αλλά είναι DORMANT για radial** (ίδιο μοτίβο με το
dimatfit/dimtmove του Phase M):
- `types/dimension.ts:187-189` → `DimStyle.dimtix` (DIMTIX force text inside) + `dimtofl` (DIMTOFL
  force dim line inside).
- DXF I/O: `utils/dxf-table-parsers.ts` + `utils/dxf-dimstyle-writer.ts` (parse/sink).
- Templates: `systems/dimensions/dim-style-templates.ts` (dimtix:false, dimtofl:false defaults).
- **ΤΩΡΑ διαβάζονται ΜΟΝΟ για linear/angular** (Phase M via `resolveTextFit`). Ο **`radial-builder.ts`
  ΔΕΝ διαβάζει dimtix/dimtofl** → το radial text κάθεται πάντα στην ίδια θέση (radius: `leaderMid`
  έξω· diameter: `center` μέσα) ό,τι κι αν λέει το style. **Grep επιβεβαίωσε: κανένα hit dimtix/dimtofl
  στον radial-builder / renderer.**

**Άρα Phase M3 = ΕΝΕΡΓΟΠΟΙΗΣΗ των dimtix/dimtofl για radial — ΟΧΙ νέο σύστημα / νέο DimStyle field / νέο DXF I/O.**

---

## 2. ⚠️ ΝΕΑ ΔΟΜΗ (μετά το SRP split — ΜΗΝ ψάξεις στα παλιά σημεία)

Το fit logic **δεν είναι πια inline** στους renderers. Μοιράζεται ως εξής (verify με Read):

| Αρχείο | Ρόλος |
|--------|-------|
| `systems/dimensions/builders/dim-text-fit.ts` | **Pure core**: `resolveTextFit` (DIMATFIT/DIMTMOVE/DIMTIX/DIMTOFL decision) + `computeLinearFitPlacement` + `computeAngularFitPlacement` + types `TextFitResult`/`DimFitPlacement`. |
| `systems/dimensions/builders/dim-fit-assemble.ts` | **Κοινό SSoT** `assembleDimFit(input)`: measure→gap→resolveTextFit→placement. **`if (geometry.kind === 'radial') return null`** (γρ.57) — το radial short-circuit-άρει ΕΔΩ. |
| `rendering/entities/dimension/dimension-renderer-support.ts` | `computeDimFitForRender(ctx,...)` (measure + delegate σε assembleDimFit)· `resolveDimensionRender`· grips/hit-test. **`if (geom.kind === 'radial') return null`** (γρ.164). |
| `canvas-v2/preview-canvas/preview-dimension-fit.ts` | `computePreviewFit` (preview counterpart, ίδιο assembleDimFit). |
| `rendering/entities/DimensionRenderer.ts` | Canvas drawing: `drawDimLineOrArc` (radial→`strokeLeader`), `drawArrowheads`, `drawFitLeader`, `drawCenterMark`, outside stubs. |
| `canvas-v2/preview-canvas/preview-dimension-renderer.ts` | Preview drawing (mirror). |
| `systems/dimensions/builders/radial-builder.ts` | **Radial geometry builder** (pure): `buildRadiusGeometry`/`buildDiameterGeometry`/`buildArcLengthGeometry`/`buildJoggedRadiusGeometry` → `RadialDimGeometry` (leaderPath + arrows + textAnchor + centerPoint + isDiameter). |

---

## 3. ΑΡΧΙΤΕΚΤΟΝΙΚΟΣ ΚΟΜΒΟΣ (το radial διαφέρει από linear/angular!)

- Το **linear/angular fit** χρειάζεται **render-time `ctx.measureText`** (χωράει ο αριθμός στο gap;)
  → γι' αυτό ζει στο `assembleDimFit` (measured width in).
- Το **radial DIMTIX/DIMTOFL** είναι **geometry-level flag** (text μέσα ή έξω κύκλου) — **ΔΕΝ**
  χρειάζεται measured width (η απόφαση είναι «DIMTIX on → μέσα, off → έξω», όχι «χωράει;»). Άρα:
  - Πιθανότατα **pure, στον builder ή σε νέο `radial-text-fit.ts`** — χωρίς ctx.
  - Το `assembleDimFit` short-circuits radial σε `null` **σκόπιμα** — **ΜΗΝ** το ζορίσεις να χειριστεί
    radial με το linear μοντέλο (arrows-flip/gap δεν ισχύουν). Είτε επέκτεινέ το με **ξεχωριστό radial
    branch** που επιστρέφει radial-specific placement, είτε (καθαρότερο SSoT) βάλε τη radial λογική
    **μέσα στον `radial-builder.ts`** (reads dimtix/dimtofl → τοποθετεί textAnchor/leaderPath).
- **Απόφαση σχεδιασμού (ρώτησε τον Giorgio με ASCII):** που κάθεται το radius/diameter text σε κάθε
  συνδυασμό DIMTIX/DIMTOFL — μέσα στον κύκλο, έξω με leader, dim-line-inside. Δώσε οπτικό παράδειγμα.

---

## 4. REUSE LEVERS (verify με Read — ΜΗΔΕΝ διπλότυπα)
- **`radial-builder.ts`**: `leaderPath` (radius=`[arcPoint, leaderEnd]`· diameter=`[side1, side2]`
  χορδή), `textAnchor` (radius=`leaderMid` έξω· diameter=`center` μέσα), `centerPoint`, `isDiameter`,
  `arrowDirection1/2`. Εδώ μπαίνει το DIMTIX/DIMTOFL branching.
- **`geometry-vector-utils`**: `pointOnCircle` / `getUnitVector` / `scalePoint` / `addPoints` /
  `calculateMidpoint` / `calculateDistance` (ήδη imported στον radial-builder).
- **`dim-text-fit.ts`**: αν το radial placement θέλει «text έξω σε απόσταση», δες αν γενικεύεται κάτι·
  αλλιώς νέα pure `resolveRadialTextPlacement` (μη το χώσεις στο linear).
- **`DimensionRenderer.strokeLeader` + `drawCenterMark`**: ο radial render path — εδώ θα καταναλωθεί
  τυχόν νέο flag (π.χ. draw dim-line-inside για DIMTOFL). Το `renderDimensionText` έχει ήδη
  `textAnchorOverride` (Phase M) — reuse για το radial moved text.
- **`measureDimPrimaryText`** (`dim-text-renderer.ts`): μόνο **αν** αποφασίσεις ότι το radial θέλει
  «text inside μόνο αν χωράει» (AutoCAD DIMTIX+DIMATFIT combo) — αλλιώς δεν το χρειάζεσαι.

---

## 5. SSoT AUDIT — ΥΠΟΧΡΕΩΤΙΚΟ grep ΠΡΙΝ γράψεις (μη-εξαντλητικό)
1. `grep -rn "dimtix\|dimtofl"` → επιβεβαίωσε ότι radial-builder/renderer **δεν** τα διαβάζουν (dormant).
2. `radial-builder.ts`: πώς χτίζονται `leaderPath`/`textAnchor`/`centerPoint` ανά variant.
3. `DimensionRenderer.ts` + `preview-dimension-renderer.ts`: το radial render path (`strokeLeader`,
   `drawCenterMark`, radial case στο `drawDimLineOrArc`).
4. `dim-fit-assemble.ts:57` + `dimension-renderer-support.ts:164`: τα radial short-circuits (πού
   επεκτείνεις ή παρακάμπτεις).
5. `dim-hit-geometry.ts`: το radial hit-test (αν μετακινηθεί το text, μη σπάσει το pick).
6. `dim-style-templates.ts`: τα DIMTIX/DIMTOFL defaults (false/false) — ISO/ASME/Arch.

---

## 6. Τι πιθανότατα θα κάνεις (ΕΠΙΒΕΒΑΙΩΣΕ στο audit — μην το πάρεις έτοιμο)
- **Νέα pure λογική** (builder-level ή `radial-text-fit.ts`): reads `dimtix`/`dimtofl`/`dimtmove` →
  αποφασίζει text μέσα/έξω κύκλου + αν το dim-line/leader τραβιέται μέσα (DIMTOFL) + leader (DIMTMOVE=1).
- Radius: DIMTIX on → text κοντά στο center (μέσα)· off → ήδη έξω (leaderMid). Diameter: DIMTIX off →
  text έξω από περιφέρεια + leader· on → ήδη center. (Verify με AutoCAD research.)
- Renderer: κατανάλωσε το αποτέλεσμα (textAnchorOverride + τυχόν dim-line-inside segment).
- **jest**: table-driven `resolveRadialTextPlacement` (dimtix on/off × radius/diameter × dimtofl × dimtmove).
- **Μηδέν** νέο DimStyle field / DXF I/O (dimtix/dimtofl υπάρχουν).

## 7. Τι ΝΑ ΜΗΝ κάνεις
- ❌ Μη σπάσεις το **linear/angular fit** (Phase M/M2 ολοκληρώθηκε — `assembleDimFit` +
  `computeLinear/AngularFitPlacement`). Additive μόνο.
- ❌ Μη χώσεις radial στο linear μοντέλο (arrows-flip/gap/stubs δεν ισχύουν για radial leader).
- ❌ Μην αγγίξεις auto-dimension αρχεία (`systems/dimensions/auto/*`) ούτε `dim-association-service`.
- ❌ Μη διπλασιάσεις geometry helpers — reuse `geometry-vector-utils` / `radial-builder`.
- ❌ Μην commit/push. ❌ Μην τρέξεις tsc.

## 8. Verification
- **jest:** `npx jest "src/subapps/dxf-viewer/systems/dimensions"` + το νέο radial-fit suite.
- **Browser (Giorgio):** κύκλος/τόξο με radius/diameter dim → άλλαξε **DIMTIX** στο `FitSection` → text
  μετακινείται μέσα/έξω κύκλου· **DIMTOFL** → dim line τραβιέται μέσα ενώ text έξω· **DIMTMOVE=1** → leader.
- **ADR-362**: section «Radial DIMTIX/DIMTOFL placement» + changelog (Round 30). Ίδιο commit-set.
  Stage **ADR-362** (CHECK 6D).
