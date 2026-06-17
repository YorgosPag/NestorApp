# HANDOFF — ADR-476 Unified Slab Reinforcement → Slice 5 (PDF Detail Sheet)

**Ημερομηνία:** 2026-06-18 (Opus) · **Επόμενη δουλειά:** Slice 5 (φύλλο λεπτομέρειας οπλισμού πλάκας + PDF) · **Status εισόδου:** Slices 0-4 DONE UNCOMMITTED, tsc-clean (για τα δικά μας)

> ⚠️ **COMMIT/PUSH = ΜΟΝΟ ο Giorgio** (N.(-1)). Το **working tree μοιράζεται με άλλον agent** → `git add` ΜΟΝΟ τα δικά σου αρχεία, ΠΟΤΕ `git add -A`.
> 🎯 Εντολή Giorgio: **«όπως η Revit — full enterprise + full SSOT, μηδέν διπλότυπα.»**
> 🧱 **GOL + SSOT**: 40-line functions, 500-line files, μηδέν `any`/`as any`/inline-styles, i18n keys ΠΡΩΤΑ (N.11), Plan Mode πρώτα.

---

## 1. Τι έγινε ήδη (ADR-476 Slices 0-4) — ΜΗΝ το ξανακάνεις

Ενοποιημένος οπλισμός **ΟΛΩΝ** των πλακών (εδαφόπλακα/raft + αναρτημένη δάπεδο/οροφή). Πλήρες ADR: `docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md`.

- **S0-S3 (data + auto re-study + 2Δ + 3Δ):** μοντέλο σχάρας `SlabFoundationReinforcement` (4 σχάρες `bottomMeshX/Y`+`topMeshX/Y` + `coverMm` + `auto?`)· kind-aware suggester· `resolveActiveSlabReinforcement`/`resolveActiveSlabReinforcementForEntity` (auto re-study)· 2Δ overlay (`slab-rebar-2d.ts`)· 3Δ κλωβός (`bim-3d/converters/slab-rebar-3d.ts` → `buildSlabRebarCage(slab, bottomY, levelId?)` + `attachSlabRebar`).
- **S4 (Properties panel + structural ribbon):** `ui/slab-advanced-panel/*` + `slab-structural-bridge.ts` + `useSlabParamsDispatcher.ts`· structural keys/visibility/actions στο `slab-command-keys.ts`· RC-gated ribbon panel `slab-reinforcement-actions` (toggle «Οπλισμός» + «Αυτόματος Οπλισμός»→`bim:auto-reinforce-requested`)· i18n `slabAdvancedPanel.*` + `ribbon.commands.slabStructural.*`.

**Κρίσιμα SSoT που ΘΑ ΧΡΕΙΑΣΤΕΙΣ στο S5:**
- `resolveActiveSlabReinforcementForEntity(slab)` (`bim/structural/active-reinforcement.ts`) → ο ΕΝΕΡΓΟΣ οπλισμός (auto-aware). **ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟΝ** ώστε detail === panel === 2Δ === 3Δ.
- `buildSlabFoundationSectionContext(slab)` (`bim/structural/section-context.ts`) → `{widthMm, lengthMm, thicknessMm, grossAreaMm2, kind, …}` (mm space).
- `computeSlabFoundationReinforcementQuantities(ctx, r)` (`bim/structural/reinforcement/slab-foundation-reinforcement-compute.ts`) → `{bottomLengthM, bottomWeightKg, topLengthM, topWeightKg, totalSteelWeightKg, ratio}`.
- `formatSlabFoundationMainLabel(r)` / `formatSlabFoundationTopLabel(r)` (`…/slab-foundation-reinforcement-types.ts`) → «Ø12/200» / «Ø10/250».
- `buildSlabRebarCage(slab, bottomY, levelId?)` (S3) — **ήδη** καλεί τον active-resolver· έτοιμο για το 3D capture.

---

## 2. ⚠️ ΠΡΟΣΟΧΗ πριν ξεκινήσεις S5

- **Τρέξε πρώτα `tsc` (N.17 — ένα instance, έλεγξε ότι δεν τρέχει άλλος).** Στο S0-4 υπήρχαν **4 σφάλματα σε beam αρχεία** (`beam-command-keys.ts` broken import `../../../bim/types/beam-types`· `beam-structural-bridge.ts` `concreteGrade`· `beam-structural-param.ts` `BeamSectionContext` export) — **WIP άλλου agent (ADR-471), ΟΧΙ δικά μας.** Αν παραμένουν → **ΜΗΝ τα διορθώσεις** (feedback «don't touch / only X»). Είναι ο μόνος «θόρυβος» στο tsc — αγνόησέ τα.
- **Analog = FOOTING detail sheet** (`ADR-463`, `bim/structural/detail-sheet/footing-detail-*` + `ui/components/foundation-detail/FoundationDetailHost.tsx`). Είναι ο ιδανικός δίδυμος γιατί **κι αυτό mesh-model** (σχάρες, ΟΧΙ stirrups). Δευτερεύον analog = **beam detail sheet** (`beam-detail-*`, 5 ζώνες χωρίς design-summary — αυτό ΑΚΡΙΒΩΣ θες· η πλάκα ΔΕΝ έχει bearing/punching checks σαν το πέδιλο).
- **Όλο το σύστημα είναι ΗΔΗ χτισμένο** — εσύ φτιάχνεις ΜΟΝΟ τους slab-specific builders + το host + το wiring. Μηδέν νέα infra.

---

## 3. Slice 5 — τι να φτιάξεις (mirror footing/beam detail sheet, full SSoT)

### Αρχιτεκτονική (ίδια με κολόνα/πέδιλο/δοκό)
ΕΝΑ pure `DetailSheetModel` (sheet-mm) → **δύο backends** (Canvas preview + jsPDF) ώστε **preview === PDF**. Ο γενικός `DetailSheetDialog` + `detail-3d-capture-core` + `detail-sheet-layout` (A3 landscape, 5 ζώνες: elevation/plan/schedule/perspective/title-block) είναι **έτοιμα**. Όλα τα primitives (`DetailPrimitive`: line/rect/text/dim/raster) στο `detail-sheet-types.ts`.

### Ζώνες πλάκας (5, ΟΠΩΣ το beam — ΧΩΡΙΣ design-summary)
| Ζώνη | Τι δείχνει | Mirror |
|---|---|---|
| **PLAN** (κάτοψη) | περίγραμμα πλάκας (outline) + δι-διευθυντική κάτω σχάρα (συμπαγείς) + άνω σχάρα (διακεκομμένες) + διαστάσεις (πλάτος/μήκος/βήμα/cover) + caption κλίμακας 1:N | `footing-detail-plan.ts` |
| **SECTION** (τομή) | πάχος πλάκας × αντιπροσωπευτικό πλάτος· **τελείες** ράβδων κάτω (στο `cover`) + άνω (στο `thickness−cover`) + cover dims | `footing-detail-elevation.ts` / `beam-detail-section.ts` |
| **3D** (perspective) | offscreen WebGL iso (αχνό prism σκυροδέματος + crimson σχάρες) + projected W/L/H dims | `footing-detail-3d-capture.ts` (+ `buildColumnPerspectiveRegion` kind-neutral region) |
| **SCHEDULE** (ποσότητες) | πίνακας: κάτω σχάρα (μήκος/βάρος), άνω σχάρα, σύνολο χάλυβα, ρ% — από `computeSlabFoundationReinforcementQuantities` | `footing-detail-schedule.ts` |
| **TITLE-BLOCK** | kind/πάχος/σκυρόδεμα/cover/κάτω+άνω σχάρα labels | `footing-detail-titleblock.ts` |

### Αρχεία να ΔΗΜΙΟΥΡΓΗΣΕΙΣ
| Αρχείο | Ενέργεια | Mirror |
|---|---|---|
| `bim/structural/detail-sheet/slab-detail-plan.ts` | `buildSlabPlanRegion(slab, rect)` → `{primitives, caption}`. Outline-based (όχι rect σαν το πέδιλο). **Reuse** `pickScaleDenominator` (`detail-sheet-fit`) + `detail-sheet-dim` + `REBAR_COLOR_HEX`. | `footing-detail-plan.ts` |
| `bim/structural/detail-sheet/slab-detail-section.ts` | `buildSlabSectionRegion(slab, rect)` → `{primitives, caption}`. Τελείες κάτω/άνω σχάρας + cover. | `beam-detail-section.ts` |
| `bim/structural/detail-sheet/slab-detail-schedule.ts` | `buildSlabScheduleRegion(slab, rect, labels)`. **Reuse** `computeSlabFoundationReinforcementQuantities` + `buildSlabFoundationSectionContext`. | `footing-detail-schedule.ts` |
| `bim/structural/detail-sheet/slab-detail-titleblock.ts` | `buildSlabTitleBlockRegion(slab, rect, fields, kindValue)`. | `footing-detail-titleblock.ts` |
| `bim/structural/detail-sheet/slab-detail-sheet.ts` | `buildSlabDetailSheet(input): DetailSheetModel` — orchestrator (5 ζώνες, **ΧΩΡΙΣ** design-summary). `SlabDetailSheetInput { slab, labels, layoutInput?, perspective3d? }`. | `footing-detail-sheet.ts` / `beam-detail-sheet.ts` |
| `bim/structural/detail-sheet/render/slab-detail-3d-capture.ts` | `captureSlabDetail3d(slab, {widthPx,heightPx}): SlabDetail3dCapture \| null`. **Reuse** `detail-3d-capture-core` (`buildConcretePrism`/`frameCamera`/`renderSceneToDataUrl`/`projectNorm`/`disposeOwned`/`disposeCageGeometry`) + `buildSlabRebarCage(slab, bottomY, levelId?)` (S3). Prism από `slab.params.outline.vertices` (scaled σε m) + ύψος=`thickness`. 🚨 dispose gotcha (ADR-457): dispose ΜΟΝΟ geometry του cage (shared `REBAR_MATERIAL`)· dispose πλήρως prism. | `footing-detail-3d-capture.ts` |
| `ui/components/slab-detail/SlabDetailHost.tsx` | dialog lifecycle· subscribe `bim:slab-detail-requested`· resolve slab· build model· async 3D capture· `<DetailSheetDialog>`. Mounted lazy (ADR-040: zero high-freq subs). | `FoundationDetailHost.tsx` |
| `bim/structural/detail-sheet/__tests__/slab-detail-sheet.test.ts` | Pure model test (ζώνες, primitives non-empty, schedule ποσότητες, καθόλου mutation). | `footing-detail-sheet.test.ts` |

### Αρχεία να ΑΛΛΑΞΕΙΣ (wiring — ΟΛΑ μικρά, additive)
| Αρχείο | Ενέργεια |
|---|---|
| `bim/structural/detail-sheet/detail-sheet-types.ts` | NEW `SlabDetailSheetLabels` (mirror `FootingDetailSheetLabels`/`BeamDetailSheetLabels` @ γραμμές 242/283· χωρίς designSummary) + `SlabScheduleLabels`. |
| `systems/events/drawing-event-map-bim.ts` | NEW `'bim:slab-detail-requested': { slabId: string; levelId: string }` (δίπλα στο `bim:foundation-detail-requested` @ γρ.362). |
| `ui/ribbon/hooks/bridge/slab-command-keys.ts` | ADD `reinforcementDetail: 'slab.actions.reinforcementDetail'` στο `SLAB_RIBBON_KEYS_ACTIONS`. |
| `ui/ribbon/hooks/useRibbonSlabBridge.ts` | `onAction`: handle `reinforcementDetail` → `EventBus.emit('bim:slab-detail-requested', { slabId, levelId })` (mirror foundation bridge @ γρ.370). |
| `ui/ribbon/data/contextual-slab-tab.ts` | ADD button «Λεπτομέρεια Οπλισμού» (icon `column-reinforcement-detail`) — βάλ' το στο **υπάρχον** RC-gated panel `slab-reinforcement-actions` (3ο κουμπί, ίδιο με foundation panel) ή νέο panel `slab-detail` gated `SLAB_STRUCTURAL_VISIBILITY_KEYS.structural`. |
| `app/dxf-viewer-lazy-components.tsx` | NEW lazy `SlabDetailHost` (mirror `FoundationDetailHost` @ γρ.32). |
| `app/DxfViewerDialogs.tsx` | mount `<React.Suspense …><SlabDetailHost levelManager={levelManager} /></React.Suspense>` (δίπλα στο `FoundationDetailHost` @ γρ.149) + import @ γρ.35. |
| `src/i18n/locales/el/*.json` + `en/*.json` | **ΠΡΩΤΑ** (N.11): NEW `slabDetail.*` block (mirror `foundationDetail` @ el γρ.4526 — regions/scheduleTable/titleFields/kindValues + dialog labels title/description/previewAlt/close/exportPdf/print/zoom*) + `ribbon.commands.slabStructural.reinforcementDetail` (+`…Tooltip`). |

### Revit-grade αποφάσεις (πάρε τες μόνος σου — [[feedback_make_revit_grade_decisions_yourself]])
- **PLAN = outline-based, ΟΧΙ rect.** Η πλάκα είναι πολύγωνο (το πέδιλο ήταν ορθογώνιο). Σχεδίασε το πραγματικό `outline` (bbox-fit στη ζώνη) με τη σχάρα **clipped στο πολύγωνο**. **Reuse** τη λογική polygon-clip του S2 (`slab-rebar-2d.ts`) αν εξάγεται καθαρά — αλλιώς bbox-mesh για v1 + **DEFER** true polygon-clip στο detail (γράψ' το στο DEFER, μη το κρύψεις). Ο 3Δ κλωβός (`buildSlabRebarCage`) ήδη bbox-based → συνέπεια.
- **q_Ed / span caption** στο title-block ΜΟΝΟ για αναρτημένες (suspended)· εδαφόπλακα = χωρίς (αγνοεί q). `kind` από `resolveSlabReinforcementKind`.
- **kindValues**: floor/ceiling/roof/ground/foundation (5 — mirror `SLAB_KIND_OPTIONS` στο `contextual-slab-tab.ts`).
- **Gate**: το κουμπί + το host μόνο για RC πλάκα (`resolveSlabPanelVisibility`). Μη-RC → καμία λεπτομέρεια.

### SSoT reuse (μηδέν διπλότυπα — N.0.2)
`detail-sheet-layout`/`detail-sheet-types`/`detail-sheet-dim`/`detail-sheet-fit`· `DetailSheetDialog` (generic)· `detail-3d-capture-core`· `buildColumnPerspectiveRegion` (kind-neutral)· `REBAR_COLOR_HEX`· `computeSlabFoundationReinforcementQuantities`· `buildSlabRebarCage` (S3)· `resolveActiveSlabReinforcementForEntity` (S1)· `formatSlabFoundation*Label`.

---

## 4. Verification (browser, http://localhost:3000/dxf/viewer)
1. Επίλεξε RC πλάκα → ribbon «Λεπτομέρεια Οπλισμού» → ανοίγει dialog με 5 ζώνες (κάτοψη/τομή/3Δ/πίνακας/title-block).
2. **preview === PDF**: «Εξαγωγή PDF» → ίδιο σχέδιο με το preview.
3. Οι σχάρες/βάρη/ρ% στο φύλλο = ίδια με το Properties panel (S4) + 2Δ/3Δ (ίδιος active-resolver).
4. Άλλαξε πάχος/σχάρα → ξανα-άνοιξε → το φύλλο ακολουθεί (auto re-study, S1).
5. Σύμμικτη/ξύλινη πλάκα → κανένα κουμπί λεπτομέρειας.
6. tsc (ένα instance, N.17) clean (πλην των 4 beam WIP που ΔΕΝ είναι δικά σου).

---

## 5. Μετά το S5 → ADR-476 ΟΛΟΚΛΗΡΩΘΗΚΕ
- **DEFER (γράψ' τα στο ADR §4):** true polygon-clip mesh στο detail plan (αν έκανες bbox v1)· serviceability/deflection check summary (η πλάκα δεν έχει bearing/punching σαν πέδιλο)· multilayer-DNA slabs· ξεχωριστά X/Y mesh.

## 6. Υποχρεώσεις τέλους (N.0.1 / N.15)
Ενημέρωσε στο ίδιο πακέτο: **ADR-476** (changelog: S5 DONE + status → Slices 0-5 DONE· §3 S5 ✅) + **adr-index** (2 entries — status) + **`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`** (entry ADR-476: S5 DONE, μένει browser-verify+commit· DEFER) + **MEMORY** (`project_adr476_unified_slab_reinforcement.md` + index pointer). **ΜΗΝ commit** — ο Giorgio το κάνει. `git add` ΜΟΝΟ τα δικά σου. Το S5 είναι UI/detail (offscreen 3D) → **ΔΕΝ** αγγίζει canvas-critical → πιθανότατα **δεν** χρειάζεται staging ADR-040 (τα S2-3 DxfRenderer/3D-converter που χρειάζονται ADR-040 έγιναν ήδη).

---

## 7. Εκτίμηση
~9 NEW + ~7 MOD αρχεία, 2 domains (detail-sheet builders + UI host/ribbon). **Plan Mode** πρώτα (N.8). Όλα τα analogs σταθερά & committed (footing/beam detail). Μηδέν νέα infra — μόνο slab-specific builders + wiring.
