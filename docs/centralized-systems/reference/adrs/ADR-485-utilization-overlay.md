# ADR-485 — Reinforcement-Utilization Overlay (T3-UI / Slice 4c — χρωματισμός επάρκειας As,req/As,prov στον καμβά)

**Status:** 🟢 DONE (UNCOMMITTED 2026-06-18 Opus) · **Σχετικά:** ADR-483 (διαγράμματα M/V/N — αδελφό overlay, ίδιο view-store), ADR-472 (load-aware strength reinforcement — η πηγή του As,req), ADR-456/471 (active reinforcement — η πηγή του As,prov), ADR-459 (section-context), ADR-422 L1 (πρότυπο HeatLoadOverlay fill), ADR-040 (micro-leaf overlay), ADR-445 (structural colour identity — μην συγκρουστείς), ADR-467 (tributary — ζει ΠΑΡΑΛΛΗΛΑ).
**Ημ/νία:** 2026-06-18 · **Γλώσσα:** Ελληνικά.
**Roadmap:** «Δρόμος Α» — μετά τα *πληροφοριακά* διαγράμματα (ADR-483), το **«πρόβλημα ναι/όχι»**: Robot/SAP2000 stress map που δείχνει με μια ματιά ποια μέλη είναι επαρκή/οριακά/ανεπαρκή. Πηγή: `HANDOFFS/HANDOFF_2026-06-18_T3-UI-Slice4bc_diagram-tc-shear-loads-utilization.md`.

---

## 1. Context — γιατί

Τα διαγράμματα M/V/N (ADR-483) δείχνουν *εντατικά μεγέθη*, αλλά όχι **επάρκεια**. Ο μηχανικός θέλει, όπως σε Robot/SAP2000/ETABS, ένα ξεχωριστό layer που βάφει κάθε μέλος πράσινο→κόκκινο κατά βαθμό εκμετάλλευσης. Όλα τα συστατικά υπάρχουν ήδη: η **απαίτηση** αντοχής (`asStrength{Beam,Column}Mm2`, ADR-472) και ο **διαθέσιμος** οπλισμός (active reinforcement, ADR-456/471). Έλειπε μόνο ο λόγος + η οπτικοποίηση.

## 2. Decision — utilization = As,req / As,prov, reuse engine, ΟΧΙ νέος M_Rd

`utilizationRatio = As,απαιτούμενο / As,διαθέσιμο` (demand/capacity), **χωρίς νέο M_Rd engine**:
- **As,req** = η ίδια καμπτική/αξονική απαίτηση αντοχής που διαστασιολογεί τον αυτόματο οπλισμό (`asStrengthBeamMm2`/`asStrengthColumnMm2`, ADR-472, exported boy-scout).
- **As,prov** = ο **ενεργός** οπλισμός (auto → φρέσκο code-suggested από την τρέχουσα γεωμετρία· manual → stored· ADR-456/471).

Συνέπεια (self-consistent): auto μέλος sized-by-code → ratio ≤ 1· manual under-designed → ratio > 1 (κόκκινο)· αφόρτιστο → As,req=0 → ratio 0 (πράσινο). Το διάγραμμα ροπής (FEM, ADR-483) μένει **παράλληλο/πληροφοριακό** — ίδια αρχιτεκτονική engine↔presentation και tributary↔FEM (ADR-481/467).

Διακριτή κλίμακα (όχι gradient — ο μηχανικός θέλει pass/marginal/fail): **πράσινο ≤0.85 / πορτοκαλί 0.85–1.0 / κόκκινο >1.0**.

## 3. Αρχιτεκτονική

**Καθαρός διαχωρισμός pure-SSoT ↔ presentation (mirror ADR-483/422):**
- **NEW `bim/structural/utilization/member-utilization.ts`** (pure, provider-agnostic): `beamUtilization(beam, reinf)` / `columnUtilization(column, reinf)` → `MemberUtilization {entityId, asRequiredMm2, asProvidedMm2, ratio}`. As,req από `asStrength*` (μόνο section ctx)· As,prov από το `reinforcement` που δίνει ο caller (× `barAreaMm2`). `null` όταν δεν υπάρχει οπλισμός (μη-βαφόμενο)· ratio 0 χωρίς απαίτηση.
- **NEW `bim/structural/utilization/utilization-color.ts`** (pure): `utilizationBand(ratio)` → `'ok'|'warn'|'over'`· `utilizationFillColor` (translucent footprint)· `utilizationLegendColor` (solid legend). Κατώφλια `UTILIZATION_OK_MAX=0.85`/`UTILIZATION_WARN_MAX=1.0`.
- **NEW `components/dxf-layout/StructuralUtilizationOverlay.tsx`** (ADR-040 micro-leaf, mirror `HeatLoadOverlay`): subscribes ΜΟΝΟ εδώ — `useAnalysisDiagramViewStore` (`showUtilization`) + `ViewMode3DStore` (mode) + `useStructuralSettingsStore` (`codeId` — repaint σε αλλαγή κανονισμού) + active-floor scene via `getLevelScene`. Βάφει το **footprint** κάθε μέλους (κολόνα `geometry.footprint`· δοκάρι `geometry.displayOutline ?? outline`, ADR-458 cutback-aware) + υπόμνημα κάτω-αριστερά. Δικό του canvas + `pointer-events-none`.
- **NEW `ui/ribbon/components/ShowUtilizationToggle.tsx`**: toggle «Επάρκεια» (View tab). Mirror `ShowAnalysisDiagramsToggle`.
- **MOD `state/analysis-diagram-view-store.ts`** (ADR-483 store, κοινό για τα δύο analysis overlays): +`showUtilization` (default OFF).

**Wiring:** `view-tab-bim-settings.ts` (+`UTILIZATION_BUTTON`), `RibbonPanel.tsx` (+branch `show-utilization-toggle`), `canvas-layer-stack-2d-overlays-leaf.tsx` (+mount **πριν** τα διαγράμματα → fill κάτω από καμπύλες), i18n `ribbon.commands.utilization.*` (el+en, legend included).

## 4. Reuse (μηδέν διπλότυπο — N.0.2)
`asStrength{Beam,Column}Mm2` (ADR-472 — exported)· `buildBeamSectionContext`/`buildColumnSectionContext` (ADR-459)· `resolveActive{Beam}…ForEntity`/`resolveActiveColumn…ForParams` (active-reinforcement, store-coupled)· `barAreaMm2` (rebar-catalog)· `HeatLoadOverlay` (fill + legend πρότυπο)· `heat-load-color` (color-ramp πρότυπο)· `ShowAnalysisDiagramsToggle` (toggle πρότυπο)· `CoordinateTransforms.worldToScreen`.

## 5. ADR-040 συμμόρφωση
Overlay = leaf subscriber σε **low-freq** stores (`showUtilization`/`mode`/`codeId` + scene reads at memo time· ο active-reinforcement resolver κάνει synchronous `getState()`, ΟΧΙ subscription)· ο shell `CanvasLayerStack` δεν αποκτά νέο subscription (CHECK 6C safe)· δικό του canvas + `pointer-events-none` → μηδέν επίδραση σε hit-test/selection/bitmap cache. Additive overlay κατά το documented pattern.

## 6. Scope
- ✅ **ΕΝΤΟΣ:** utilization fill δοκαριών **και** κολονών + toggle (default OFF) + 3-band χρώμα + υπόμνημα + i18n el+en + jest (utilization-color GREEN).
- 🔜 **DEFER:** πέδιλα/πλάκες· per-combination utilization· shear/anchorage utilization (μόνο longitudinal flexural/axial v1)· tooltip με ακριβές ποσοστό.
- ❌ **ΕΚΤΟΣ:** νέος M_Rd/interaction-diagram engine (reuse As,req/As,prov)· solver touch· 3Δ· σεισμός T4.

## 7. Validation
- `utilization-color.test.ts` (GREEN): boundary-exact κατώφλια (0.85 κλειστό→ok· 1.0→warn· >1.0→over)· διακριτά χρώματα ανά βαθμίδα· solid legend.
- As,req: ήδη καλυμμένο από `suggest-reinforcement-load-aware.test.ts` (ADR-472)· As,prov + ratio = τετριμμένος πολλαπλασιασμός/διαίρεση.
- 🔴 **Εκκρεμεί:** tsc (Giorgio, N.17) + browser-verify (πλαίσιο → auto-οπλισμός → toggle «Επάρκεια» ON → πράσινα μέλη· υπο-διαστασιολόγηση manual → κόκκινο· υπόμνημα ορατό) + commit.

## 8. Changelog
- **2026-06-18 (Opus, UNCOMMITTED):** Αρχική υλοποίηση Slice 4c. NEW: member-utilization.ts, utilization-color.ts (+test), StructuralUtilizationOverlay.tsx, ShowUtilizationToggle.tsx. MOD: suggest-reinforcement.ts (export asStrength*), analysis-diagram-view-store.ts (+showUtilization), view-tab-bim-settings.ts, RibbonPanel.tsx, canvas-layer-stack-2d-overlays-leaf.tsx, i18n el/en dxf-viewer-shell.json.
