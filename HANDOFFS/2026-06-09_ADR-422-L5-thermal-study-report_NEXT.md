# HANDOFF — ADR-422 L5: Μηχανολογική Μελέτη Θέρμανσης — Printout / PDF Report (4M-FineHEAT printout)

**Ημερομηνία:** 2026-06-09
**Μοντέλο:** Opus 4.8
**Εντολή Giorgio:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ (Revit / 4M-FineHEAT) — **FULL ENTERPRISE + FULL SSOT**. Πλήρης συμμόρφωση.»
**Εκτέλεση:** **Plan Mode πρώτα** (πάρε ΕΣΥ τις Revit-grade αποφάσεις + ζήτα έγκριση plan· μην ρωτάς τετριμμένα standard επιλογές — [[feedback_make_revit_grade_decisions_yourself]]). Μετά υλοποίηση στρώμα-στρώμα.
**⚠️ SHARED working tree** με άλλον agent (δουλεύει ΠΑΡΑΛΛΗΛΑ στον **ΛΕΒΗΤΑ** `mep-boiler`). `git add` **ΜΟΝΟ** δικά σου αρχεία — **ΠΟΤΕ `-A`**. **COMMIT τα κάνει ο Giorgio, ΟΧΙ εσύ** (N.(-1)).
**Απάντα στα ελληνικά.**

---

## 0) ΠΟΥ ΒΡΙΣΚΟΜΑΣΤΕ (ADR-422 — στρώμα-στρώμα)

Η μηχανολογική μελέτη θέρμανσης χτίζεται σε στρώματα. **Ολοκληρωμένα (code = source of truth):**

| Στρώμα | Τι κάνει | Κατάσταση |
|---|---|---|
| **L0** | Θερμικός χώρος (IfcSpace) + click-in-region «Place Space» + tab | ✅ |
| **L1** | Heat-load engine `Φ = ΣU·A·ΔΤ·b + 0.34·n·V·ΔΤ` + overlay | ✅ |
| **L2** | Radiator sizing (EN 442) — απαιτ. ονομαστική ισχύς σώματος | ✅ |
| **L3** | Pipe sizing (velocity+friction) — προτεινόμενη DN ανά σωλήνα + overlay | ✅ engine+viz (🔴 **Apply command pending** — §6) |
| **L4** | Hydraulic balancing (Darcy index-circuit + kv valves) + overlay | ✅ engine+viz (2026-06-09) |
| **L5** | **Μηχανολογική Μελέτη — Printout/PDF Report** ← **ΑΥΤΟ ΤΟ HANDOFF** | ⬜ |

**Γιατί L5 τώρα (και όχι L3-Apply):** το L3-Apply περνά από το shared `useRibbonCommands.ts`, **που το επεξεργάζεται ο παράλληλος boiler agent** (`mepBoilerBridge` εκεί) → concurrent edit = conflict. Το L5 είναι **καθαρός read-model consumer + PDF builder** που μπορεί να μείνει πλήρως απομονωμένο (δες §2 D-E για το πώς να ΑΠΟΦΥΓΕΙΣ το `useRibbonCommands.ts` στο ribbon action). Το L3-Apply μένει follow-up όταν ελευθερωθεί το αρχείο (§6).

---

## 1) ΤΙ ΘΑ ΚΑΝΕΙΣ (L5 — Μηχανολογική Μελέτη Printout)

Όλη η αριθμητική **υπάρχει ήδη** ως transient read-models (L1→L4). Το L5 **ΔΕΝ υπολογίζει τίποτα νέο** — **συγκεντρώνει** τα read-models σε ένα εκτυπώσιμο, πολυσέλιδο **report** (Revit «Schedules/Reports» / 4M-FineHEAT printout μελέτης):

1. **Header έργου** — κτίριο / όροφος / ημερομηνία / κανονισμοί (ΤΟΤΕΕ 20701, ΚΕΝΑΚ, EN 12831 / EN 442).
2. **Σύνοψη** — ΣΦ ορόφου (W), εγκατεστημένη ισχύς πηγής, index circuit, απαιτ. μανομετρικό + παροχή κυκλοφορητή.
3. **Πίνακας Θερμικών Φορτίων ανά χώρο** (L1) — Φ (W), W/m², breakdown (διαφανειακές/αερισμού) αν διαθέσιμο.
4. **Πίνακας Διαστασιολόγησης Σωμάτων** (L2) — ανά καλοριφέρ: regime, ΔΤ, απαιτ. ονομαστική @ΔΤ50K, κατάλογος, επάρκεια.
5. **Πίνακας Διαστασιολόγησης Σωληνώσεων** (L3) — ανά τμήμα: DN, παροχή (kg/s), v (m/s), R (Pa/m).
6. **Πίνακας Υδραυλικής Εξισορρόπησης** (L4) — ανά κύκλωμα: ΔP (kPa), index;, surplus, απαιτ. kv balancing valve.

**Έξοδος:** PDF (download) — μέσω του **υπάρχοντος SSoT PDF stack** (§3). Όλα **derived** (re-computable, μηδέν persist).

**ΠΡΩΤΟ ΒΗΜΑ: Plan Mode** — διάβασε τα read-models + το schedule/PDF SSoT, πάρε τις αποφάσεις (§2), ζήτα έγκριση.

---

## 2) ΑΠΟΦΑΣΕΙΣ ΝΑ ΚΛΕΙΔΩΣΕΙΣ ΣΤΟ PLAN MODE (πρότεινε + δικαιολόγησε)

- **D-A (multi-section PDF):** το υπάρχον `scheduleToPdfBlob` (§3) φτιάχνει **ΕΝΑ** autoTable ανά PDF (fresh jsPDF). Η μελέτη θέλει **πολλά sections** (σύνοψη + 4 πίνακες) στο ίδιο PDF. Δύο νόμιμες οδοί — **διάλεξε & δικαιολόγησε**:
  - **(A) Επέκταση SSoT (προτεινόμενο):** νέα `schedulesToPdfBlob(sections: {title, schedule}[], options)` δίπλα στην `scheduleToPdfBlob` (ίδιο αρχείο ή `thermal-study-pdf-exporter.ts`), που reuse-άρει `registerGreekFont` + `autoTable` (πολλά calls με `startY` από `previous.finalY`) + header/footer. Μηδέν fork του font/download SSoT.
  - **(B) Νέο standalone exporter** που reuse-άρει μόνο `registerGreekFont` + `triggerExportDownload`. Λιγότερο SSoT-reuse στα layout helpers.
- **D-B (analytical schedule vs entity schedule):** το υπάρχον `Schedule`/`ScheduleRow` είναι **entity-based** (`ScheduleEntityType` = door/wall/... με `entityId`). Τα δεδομένα θέρμανσης είναι **analytical** (per-space/per-terminal/per-segment/per-circuit read-models, ΟΧΙ raw entities). **Πρότεινε:** καθαρό **pure builder** `buildThermalStudyReport({ spaceLoads, radiatorSizing, pipeSizing, balancing, lookups }) → ThermalStudyReport` που παράγει `Schedule[]` (ή ένα ελαφρύ `ReportSection[]` με `{title, columns, rows}`) **χωρίς** να επεκτείνεις το shared `ScheduleEntityType` union (αποφεύγεις σύγκρουση με BOQ/schedule agents). Reuse `ScheduleColumnDef`/`ScheduleRow`/`formatCellForDisplay` types/formatters όπου ταιριάζουν.
- **D-C (read-model orchestration — ΚΡΙΣΙΜΟ SSoT):** τα 4 read-models είναι **hooks** (`useSpaceHeatLoads`/`useRadiatorSizing`/`usePipeSizing`/`useHydraulicBalancing`), δεν καλούνται on-click. **Πρότεινε:** ο **builder είναι pure** (δέχεται τα 4 resolved maps ως args) + ένα thin hook `useThermalStudyReport(scene, active)` που καλεί τα 4 hooks και τρέχει τον builder (mirror του `useHydraulicBalancing` που ήδη συνθέτει `usePipeSizing`+`useRadiatorSizing`). Το ribbon widget διαβάζει το hook (always-active ή gated) και on-click κατεβάζει το PDF από το ήδη-computed report.
- **D-D (scope — όροφος vs project):** **Πρότεινε per-active-floor v1** (mirror των overlays L1-L4 που δουλεύουν στο active-floor BIM scene μέσω `getLevelScene`). Multi-floor/project-wide = future. Δικαιολόγησε (το δίκτυο θέρμανσης + index circuit ορίζονται ανά floor scene).
- **D-E (UI surface — ΑΠΟΦΥΓΕ το `useRibbonCommands.ts`):** **mirror το pattern των self-contained view widgets** (`ShowPipeSizingToggle`/`ShowBalancingToggle`) — ένα **αυτόνομο ribbon widget** `ExportThermalStudyButton.tsx` που καλεί ΑΠΕΥΘΕΙΑΣ το `useThermalStudyReport` hook + `download...` on-click, wired μέσω `view-tab-bim-settings.ts` (νέο button) + `RibbonPanel.tsx` (νέο widget dispatch case). **ΜΗΝ** το περάσεις από το `useRibbonCommands.ts` (boiler agent). i18n el+en (keys ΠΡΩΤΑ).

---

## 3) SSoT ΘΕΜΕΛΙΟ — REUSE, ΜΗΝ FORK (επιβεβαιωμένο code)

**Read-models θέρμανσης (η είσοδός σου — ΟΛΑ transient, derived):**
- **L1:** `hooks/data/useSpaceHeatLoads.ts` → `{ spaces, results: Map<spaceId, SpaceHeatLoadResult>, ... }`. Φ (W), W/m², breakdown. Types: `bim/thermal/heat-load/heat-load-types.ts`.
- **L2:** `hooks/data/useRadiatorSizing.ts` → `RadiatorSizingMap` (`RadiatorSizingViewResult`: regime, ΔΤ, `requiredNominalW`, `catalogueW`, `adequate`).
- **L3:** `hooks/data/usePipeSizing.ts` → `PipeSizingMap` (`PipeSegmentSizing`: dnMm, massFlowKgS, velocityMS, frictionPaM, cumulativeLoadW).
- **L4:** `hooks/data/useHydraulicBalancing.ts` → `HydraulicBalancingResult` (`terminals: Map<id, TerminalBalancing>` με circuitDropPa/isIndex/surplusPa/requiredKv + `indexTerminalId`/`pumpHeadPa`).
- **Κοινό:** `buildTerminalContributions` (`bim/thermal/sizing/terminal-contributions.ts`) + ο κοινός γράφος `bim/thermal/sizing/pipe-network-graph.ts` (αν χρειαστείς τοπολογία — μάλλον όχι για report).

**PDF / Schedule SSoT (το export stack — REUSE):**
- `bim/schedule/exporters/pdf-exporter.ts` → `scheduleToPdfBlob` / `downloadScheduleAsPdf` (jsPDF + jspdf-autotable + Greek font + footer). **Το πρότυπο/βάση του D-A.**
- `bim/schedule/types.ts` → `Schedule` / `ScheduleColumnDef` / `ScheduleRow` / `ScheduleCellValue` / `ScheduleColumnValueType` / `ScheduleExportOptions`. **Reuse types/value-formatters.**
- `bim/schedule/exporters/value-formatters.ts` → `formatCellForDisplay(cell, valueType)` (mm→m, area-m2, count κ.λπ.).
- `bim/schedule/exporters/csv-exporter.ts` → `HeaderTranslator` type (header i18n adapter).
- `@/services/pdf/greek-font-loader` → `registerGreekFont(pdf)` (**MANDATORY** πριν από κάθε `pdf.text()` με Ελληνικά).
- `@/lib/exports/trigger-export-download` → `triggerExportDownload({ blob, filename })` (SSoT download).
- `@/lib/date-local` → `nowISO()` (ημερομηνία header — **ΟΧΙ** `new Date()`, banned στο harness).
- **Παράδειγμα entity→schedule builder** (pattern reference): `bim/schedule/exporters/opening-schedule-pdf-exporter.ts` + `bim/schedule/__tests__/exporters.test.ts`.

**Active-floor scene (mirror overlays L1-L4):** `useLevelsOptional()` → `currentLevelId` + `getLevelScene(id)`.

**Lookups (header/labels):** `ScheduleLookups` (floor label / building) — wire από `useFloors()`/project-org, ή απλό fallback v1.

---

## 4) ΚΕΝΑ ΠΟΥ ΠΡΟΣΘΕΤΕΙ ΤΟ L5

1. **NEW pure builder** `bim/thermal/report/thermal-study-report.ts` — `buildThermalStudyReport({...read-models, lookups}) → ThermalStudyReport` (sections: σύνοψη + 4 πίνακες). Pure, full unit-tests (worked rows + άδειο δίκτυο).
2. **NEW types** `bim/thermal/report/thermal-study-report-types.ts` (αν χρειαστεί `ReportSection`/`ThermalStudyReport`) — ή reuse `Schedule[]`.
3. **NEW exporter** (D-A) — `schedulesToPdfBlob`/`thermal-study-pdf-exporter.ts` (multi-section, reuse font/autoTable/download).
4. **NEW hook** `hooks/data/useThermalStudyReport.ts` — reactive (reuse τα 4 read-models + builder).
5. **NEW ribbon widget** `ui/ribbon/components/ExportThermalStudyButton.tsx` (mirror `ShowBalancingToggle`) + `view-tab-bim-settings.ts` button + `RibbonPanel.tsx` dispatch + i18n el+en. **ΜΗΝ** `useRibbonCommands.ts`.
6. **NEW tests:** `thermal-study-report.test.ts` (sections build, σύνοψη totals, index circuit στο summary, empty-scene) + (αν pure) exporter smoke.

---

## 5) ΜΟΝΑΔΕΣ + SSoT ΠΑΓΙΔΕΣ

- **Read-model μονάδες (μην τις ξαναμετατρέψεις λάθος):** Φ/φορτία **W**· DN **mm**· v **m/s**· R **Pa/m**· παροχή σωλήνα **kg/s**· ΔP κυκλώματος/μανομετρικό **Pa** (στο overlay δείχνεται kPa = ÷1000)· kv **αδιάστατο**. Στον πίνακα δείξε kPa για πιέσεις (÷1000), m/s/W/mm ως έχουν.
- **Greek font MANDATORY** πριν από κάθε `pdf.text()` με Ελληνικά (`registerGreekFont`) — αλλιώς τα Ελληνικά βγαίνουν κενά/tofu.
- **Ημερομηνία:** `nowISO()` (`@/lib/date-local`) — **ΟΧΙ** `new Date()`/`Date.now()` (banned).
- **i18n SSoT:** όλα τα labels/headers `t('...')`, keys ΠΡΩΤΑ σε `el` **ΚΑΙ** `en`. Numeric+unit («W»/«kPa»/«m/s»/«DN») επιτρεπτά. Schedule headers στο namespace `dxf-schedule` (entity schedules) — αλλά τα δικά σου ribbon/report labels πιθανώς στο `dxf-viewer-shell` (επιβεβαίωσε πού ζουν τα `ribbon.commands.*`).
- **ΜΗΝ persist-άρεις** το report — pure derive @click (mirror L1-L4).
- **ΜΗΝ** ξαναγράψεις φορτίο/sizing/balancing — **κατανάλωσε** τα read-models.
- **ΜΗΝ** επεκτείνεις το shared `ScheduleEntityType` union αν δεν χρειάζεται (αποφυγή σύγκρουσης με BOQ/schedule agents) — δες D-B.

## 6) PENDING ΑΠΟ ΤΟ L3 (ξεχωριστό μικρό slice — ΟΧΙ μέρος του L5)

- **L3 Apply command:** ribbon action «Εφαρμογή Διαστασιολόγησης» → `CompoundCommand` από `UpdateMepSegmentParamsCommand` (γράφει `diameter = outerMm` ανά σωλήνα, ένα undo). **Mirror `useRibbonWaterAutoSupplyBridge.ts`** (ADR-426 Slice 2 — `useCommandHistory().execute` + `LevelSceneManagerAdapter` + `CompoundCommand`). Χρειάζεται: action-keys file + bridge hook + wiring στο **shared `useRibbonCommands.ts`** (props + dispatch line + deps array) + ribbon button.
- **🔴 Γιατί δεν έγινε:** ο παράλληλος boiler agent επεξεργάζεται το `useRibbonCommands.ts`. Κάνε το **σε καθαρό pass όταν είναι ελεύθερο** (ρώτα τον Giorgio αν ο boiler agent τελείωσε), ΟΧΙ concurrent.

## 7) ΚΑΝΟΝΕΣ ΠΟΙΟΤΗΤΑΣ (CLAUDE.md)

- **FULL ENTERPRISE + FULL SSOT**, Revit/4M-FineHEAT grade. No `any`/`as any`/`@ts-ignore`. Functions **≤40 γρ.**, code files **≤500 γρ.** (engines/config/types εξαιρούνται). Semantic HTML, no inline styles.
- **License (N.5):** ΑΝ χρειαστείς νέο npm package (μάλλον ΟΧΙ — `jspdf`/`jspdf-autotable` ήδη υπάρχουν) → MIT/Apache/BSD μόνο, αλλιώς ρώτα.
- **TSC (N.17):** ΠΡΙΝ τρέξεις `tsc` έλεγξε ότι δεν τρέχει άλλος: `powershell -NoProfile -Command 'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -like "*tsc*--noEmit*" } | Select-Object ProcessId'`. Αν τρέχει → περίμενε (ο boiler agent τρέχει tsc συχνά). ΕΝΑ tsc τη φορά, background. **Γνωστό pre-existing error (αγνόησέ το):** `bim-3d/converters/mesh-to-object3d.ts(124)`.
- **Jest:** `npx jest "<path>"` (jest globals describe/it/expect, ΟΧΙ vitest). Factories περνούν `params` αυτούσια (explicit `connectors` ok). Δες `bim/thermal/balancing/__tests__/circuit-balancing.test.ts` για το factory pattern (makeSeg/makeRad/makeSource).
- **ADR-040:** ο L5 builder/exporter/hook **ΕΚΤΟΣ** (καθαρός data/PDF, μηδέν canvas). Ribbon widget = low-freq, ΕΚΤΟΣ. **Δεν χρειάζεται STAGE ADR-040** (κανένα canvas overlay).
- **N.15 (μετά):** `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + **ADR-422 changelog (L5 entry)** + memory `project_adr422_thermal_space.md` + `MEMORY.md`. **ΜΗΝ** `adr-index.md` (shared tree).

## 8) ISOLATION (shared tree με boiler agent)

- `git add` **ΜΟΝΟ** δικά σου: `bim/thermal/report/*`, `hooks/data/useThermalStudyReport.ts`, `ui/ribbon/components/ExportThermalStudyButton.tsx`, (αν D-A επέκταση) `bim/schedule/exporters/*` (πρόσεξε — shared με schedule/BOQ· προτίμησε ΝΕΟ `thermal-study-pdf-exporter.ts` αντί edit του `pdf-exporter.ts`).
- Shared αρχεία που αγγίζεις **προσεκτικά** (μόνο δικές σου γραμμές, additive): `ui/ribbon/data/view-tab-bim-settings.ts` (νέο button), `ui/ribbon/components/RibbonPanel.tsx` (νέο dispatch case), i18n locales. **ΜΗΝ** αγγίξεις `useRibbonCommands.ts` (boiler agent).
- **Commit/push τα κάνει ο Giorgio**, όχι εσύ.

## 9) ΠΗΓΕΣ ΝΑ ΔΙΑΒΑΣΕΙΣ ΠΡΩΤΑ

- `docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md` (§3 L5· §4 changelog L1-L4 — όλες οι αποφάσεις/read-model contracts).
- memory `project_adr422_thermal_space.md` (L0→L4 + μαθήματα μονάδων/SSoT/δέντρου/extract).
- Read-models: `hooks/data/{useSpaceHeatLoads,useRadiatorSizing,usePipeSizing,useHydraulicBalancing}.ts` + types (`heat-load-types.ts`, `useRadiatorSizing` result, `pipe-network-sizing.ts PipeSegmentSizing`, `circuit-balancing.ts HydraulicBalancingResult`).
- PDF SSoT: `bim/schedule/exporters/pdf-exporter.ts` + `bim/schedule/types.ts` + `value-formatters.ts` + `@/services/pdf/greek-font-loader` + `@/lib/exports/trigger-export-download` + `@/lib/date-local`.
- UI pattern (αυτόνομο widget, ΟΧΙ useRibbonCommands): `ui/ribbon/components/ShowBalancingToggle.tsx` + `view-tab-bim-settings.ts` (`BALANCING_BUTTON`) + `RibbonPanel.tsx` (case `show-balancing-toggle`).
- Entity→schedule builder pattern reference: `bim/schedule/exporters/opening-schedule-pdf-exporter.ts` + `bim/schedule/__tests__/exporters.test.ts`.
