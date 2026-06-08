# HANDOFF — ADR-422 L4: Υδραυλική Εξισορρόπηση (Hydraulic Balancing — Darcy index-circuit + balancing valves)

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
| **L3** | **Pipe sizing (velocity+friction)** — προτεινόμενη DN ανά σωλήνα + overlay | ✅ engine+viz (🔴 **Apply command pending** — δες §6) |
| **L4** | **Υδραυλική εξισορρόπηση** ← **ΑΥΤΟ ΤΟ HANDOFF** | ⬜ |
| L5 | Report PDF (μηχανολογική μελέτη printout) | ⬜ |

**Γιατί L4 τώρα (και όχι L3-Apply):** το L3-Apply περνά από το shared `useRibbonCommands.ts`, **που αυτή τη στιγμή το επεξεργάζεται ο παράλληλος boiler agent** (`mepBoilerBridge` ήδη εκεί) → concurrent edit = conflict. Το L4 είναι **καθαρός engine + transient overlay** (όπως το L3b), μηδέν shared ribbon-command αρχείο → πλήρως απομονωμένο. Το L3-Apply μένει ως μικρό follow-up όταν ελευθερωθεί το αρχείο (§6).

---

## 1) ΤΙ ΘΑ ΚΑΝΕΙΣ (L4 — Hydraulic Balancing)

Παίρνεις το **διαστασιολογημένο** δίκτυο του L3 (per-segment DN/ταχύτητα/τριβή + per-terminal παροχή) και:

1. **Πτώση πίεσης ανά τμήμα** `ΔP_seg = R·L + Σζ·(ρ·v²/2)` (τριβή κατά μήκος + τοπικές αντιστάσεις fittings).
2. **Κύκλωμα ανά τερματικό** — η διαδρομή πηγή→καλοριφέρ→πηγή (supply path + terminal + return path)· συνολική πτώση `ΔP_circuit = Σ ΔP_seg κατά μήκος της διαδρομής`.
3. **Index circuit** = το δυσμενέστερο κύκλωμα (μέγιστο `ΔP_circuit`) — αυτό ορίζει την απαιτούμενη μανομετρική του κυκλοφορητή.
4. **Εξισορρόπηση** — για κάθε ΑΛΛΟ κύκλωμα, η υπερβάλλουσα πίεση `ΔP_index − ΔP_circuit` πρέπει να «καεί» σε **balancing valve** → προτεινόμενη **προρρύθμιση/kv** ανά τερματικό (Revit/4M «balancing schedule»).

**Αποτέλεσμα:** ο μελετητής βλέπει ανά καλοριφέρ: ΔP κυκλώματος + απαιτ. προρρύθμιση βαλβίδας + ποιο είναι το index circuit + απαιτ. μανομετρικό κυκλοφορητή. Όλα **derived** (transient read-model, μηδέν persist).

**ΠΡΩΤΟ ΒΗΜΑ: Plan Mode** — διάβασε κώδικα (L3 + topology), σχεδίασε engine + path-finding + balancing + UI, πάρε τις αποφάσεις, ζήτα έγκριση.

---

## 2) ΑΠΟΦΑΣΕΙΣ ΝΑ ΚΛΕΙΔΩΣΕΙΣ ΣΤΟ PLAN MODE (πρότεινε + δικαιολόγησε)

- **D-A (τοπικές αντιστάσεις fittings):** δύο νόμιμες οδοί — **διάλεξε & δικαιολόγησε**:
  - **(A) Topology-derived (προτεινόμενο v1):** ζ από τον βαθμό (degree) του κόμβου-junction του γράφου (2 ακμές=γωνία/elbow ζ≈0.5· 3+=ταυ/tee ζ≈1.0-1.5)· μηδέν εξάρτηση από `mep-fitting` entities. Config SSoT ζ-table.
  - **(B) Entity-driven:** διάβασε τα πραγματικά `mep-fitting` (auto-reconciler — ADR-408) και χρησιμοποίησε τον τύπο τους. Πιο ακριβές αλλά εξαρτάται από fittings που μπορεί να λείπουν.
- **D-B (path-finding source→terminal — ΚΡΙΣΙΜΟ SSoT):** το L3 `pipe-network-sizing.ts` ήδη χτίζει γράφο + BFS δέντρο (`bfsTree`, **όχι exported**). **Reuse, ΜΗΝ fork**: είτε (i) export μιας `resolveCircuitPaths(...)` API από το L3 module (μοιραζόμενοι graph helpers), είτε (ii) extract των graph helpers (`buildGraph`/`computeComponents`/`bfsTree`) σε `bim/thermal/sizing/pipe-network-graph.ts` που καταναλώνουν **και** L3 **και** L4. Πρότεινε το (ii) (καθαρό SSoT· το L3 γίνεται thin consumer). Η διαδρομή πηγή→terminal = parent-chain από τη ρίζα μέχρι τον κόμβο του τερματικού.
- **D-C (supply + return κύκλωμα):** το κύκλωμα = supply path + return path. Επειδή το L3 βγάζει supply/return ως **ξεχωριστά δέντρα** (τα τερματικά δεν είναι segments), συνέδεσέ τα ανά terminal (το ίδιο σώμα ανήκει και στα δύο). Πρότεινε: `ΔP_circuit = ΔP_supply_path + ΔP_terminal + ΔP_return_path` (το `ΔP_terminal` = ονομαστική πτώση σώματος, config/μηδέν v1 με flag).
- **D-D (balancing valve proposal):** προτεινόμενη μορφή — **kv** (`ΔP_surplus = (ṁ/kv)²·…` → απαιτ. kv) ή **preset step** από κατάλογο βαλβίδας. Πρότεινε kv-based v1 (standard, αγνωστικό βαλβίδας)· preset-catalog = future.
- **D-E (UI surface):** **mirror L3b** — transient view-store `state/hydraulic-balancing-view-store.ts` + overlay `HydraulicBalancingOverlay.tsx` (badge ανά τερματικό: ΔP + kv· highlight index circuit) + toggle `ShowBalancingToggle` + view-tab button + RibbonPanel dispatch. **ΜΗΝ** αγγίξεις `useRibbonCommands.ts` (boiler agent). i18n el+en (keys ΠΡΩΤΑ).

---

## 3) SSoT ΘΕΜΕΛΙΟ — REUSE, ΜΗΝ FORK (επιβεβαιωμένο code)

- **L3 sizing (η είσοδός σου):** `bim/thermal/sizing/pipe-network-sizing.ts` → `sizePipeNetwork(...)` → `Map<segmentId, PipeSegmentSizing>` με **έτοιμα** `{ dnMm, innerMm, velocityMS, frictionPaM (R, Pa/m), massFlowKgS, cumulativeLoadW }`. ⚠️ **ΔΕΝ** περιέχει `length` — πάρε το από `segment.geometry.length` (m, ήδη υπολογισμένο από `computeMepSegmentGeometry`).
- **L3 hook:** `hooks/data/usePipeSizing.ts` → reactive read-model. Reuse για να πάρεις το sizing στο L4 hook.
- **L3 engine pieces:** `pipe-sizing.ts` (ρ/c/μ config, `pipeVelocity`/`pipeFriction`), `pipe-sizing-config.ts` (`WATER_DENSITY_KG_M3` κ.λπ.), `velocity-friction-standard.ts`.
- **Topology / graph:** μέσα στο `pipe-network-sizing.ts` (buildGraph/computeComponents/bfsTree — δες D-B για extract σε shared module).
- **Per-terminal φορτίο/παροχή:** `useRadiatorSizing` (L2) + `computePipeMassFlow` (L3) — ήδη τα συνδυάζει το `usePipeSizing`.
- **Source:** `bim/mep-systems/pipe-network-source.ts` → `isPipeNetworkSourceEntity` / `findPipeNetworkSourceConnectorId`.
- **UI pattern (mirror ΑΚΡΙΒΩΣ):** `state/pipe-sizing-view-store.ts` + `components/dxf-layout/PipeSizingOverlay.tsx` + `ui/ribbon/components/ShowPipeSizingToggle.tsx` + `ui/ribbon/data/view-tab-bim-settings.ts` (`PIPE_SIZING_BUTTON`) + `RibbonPanel.tsx` dispatch (case `show-pipe-sizing-toggle`). **Το L4 είναι 1:1 κλώνος αυτού του pattern.**
- **Overlay primitives:** `rendering/utils/canvas-pill` (`pillPath`/`PILL_BG_COLOR`/`contrastTextColor`), `CoordinateTransforms.worldToScreen`, `getDevicePixelRatio`.

---

## 4) ΚΕΝΑ ΠΟΥ ΠΡΟΣΘΕΤΕΙ ΤΟ L4

1. **NEW pure config** `bim/thermal/balancing/balancing-config.ts` — ζ-coefficients (elbow/tee/valve), ρ (reuse L3 `WATER_DENSITY_KG_M3`), kv reference. (config — εξαιρείται 500/40.)
2. **NEW pure** `bim/thermal/balancing/pressure-drop.ts` — `segmentPressureDropPa({ frictionPaM, lengthM, localZetaSum, velocityMS })` → Pa. Pure, full unit-tests.
3. **NEW pure** `bim/thermal/balancing/circuit-balancing.ts` — `balanceNetwork({ sizing, graph, terminals, sources })` → ανά terminal `{ circuitDropPa, isIndex, requiredKv, surplusPa }` + `pumpHeadPa`/`indexTerminalId`. Reuse graph path-finding (D-B).
4. **(ίσως) NEW** `bim/thermal/sizing/pipe-network-graph.ts` — extract των L3 graph helpers (D-B opt ii) → κοινό SSoT για L3+L4.
5. **NEW hook** `hooks/data/useHydraulicBalancing.ts` — reactive (reuse `usePipeSizing` + engine).
6. **UI (mirror L3b):** view-store + `HydraulicBalancingOverlay` (STAGE ADR-040 mount `CanvasLayerStack`) + toggle + view-tab button + RibbonPanel dispatch + i18n el+en.
7. **NEW tests:** `pressure-drop.test.ts` (worked ΔP) + `circuit-balancing.test.ts` (index circuit = δυσμενέστερο· kv surplus· δέντρο path).

---

## 5) ΜΟΝΑΔΕΣ + SSoT ΠΑΓΙΔΕΣ

- **Πιέσεις σε Pa** (R σε Pa/m × μήκος σε **m**). Το `segment.geometry.length` είναι **m**. Η `frictionPaM` (R) είναι **Pa/m**. ΜΗΝ μπερδέψεις kPa/bar.
- **Τοπικές αντιστάσεις:** `ΔP_local = ζ · (ρ·v²/2)`, ζ αδιάστατο, v = **m/s** από το L3 (εσωτ. διάμετρος). ρ = `WATER_DENSITY_KG_M3` (L3 config).
- **Διαδρομή:** οι θέσεις/άκρες σε **scene units** (το graph tol είναι ήδη scene-aware) — αλλά τα **μήκη** για ΔP θέλουν **m** (`geometry.length`, ΟΧΙ scene-unit απόσταση).
- **Δέντρο, όχι loop:** ίδια αρχή με L3 — supply & return ξεχωριστά δέντρα· το «κύκλωμα» τα ενώνει per-terminal. ΜΗΝ ψάξεις loop-path· είναι parent-chain στο δέντρο.
- **ΜΗΝ persist-άρεις** ΔP/kv — transient read-model (mirror L1/L2/L3).
- **ΜΗΝ** ξαναγράψεις sizing/topology/φορτίο — reuse L3.

## 6) PENDING ΑΠΟ ΤΟ L3 (ξεχωριστό μικρό slice — ΟΧΙ μέρος του L4)

- **L3 Apply command:** ribbon action «Εφαρμογή Διαστασιολόγησης» → `CompoundCommand` από `UpdateMepSegmentParamsCommand` (γράφει `diameter = outerMm` ανά σωλήνα, ένα undo). **Mirror `useRibbonWaterAutoSupplyBridge.ts`** (ADR-426 Slice 2 — `useCommandHistory().execute` + `LevelSceneManagerAdapter` + `CompoundCommand`). Χρειάζεται: action-keys file + bridge hook + wiring στο **shared `useRibbonCommands.ts`** (props + dispatch line + deps array) + ribbon button.
- **🔴 Γιατί δεν έγινε:** ο παράλληλος boiler agent επεξεργάζεται το `useRibbonCommands.ts`. Κάνε το **σε καθαρό pass όταν είναι ελεύθερο** (ρώτα τον Giorgio αν ο boiler agent τελείωσε), ΟΧΙ concurrent.

## 7) ΚΑΝΟΝΕΣ ΠΟΙΟΤΗΤΑΣ (CLAUDE.md)

- **FULL ENTERPRISE + FULL SSOT**, Revit/4M-FineHEAT grade. No `any`/`as any`/`@ts-ignore`. Functions **≤40 γρ.**, code files **≤500 γρ.** (engines/config/types εξαιρούνται). Semantic HTML, no inline styles.
- **i18n SSoT:** όλα τα labels `t('...')`, keys πρώτα σε `el` **και** `en` (`src/i18n/locales/{el,en}/dxf-viewer-shell.json`). Numeric+unit («Pa»/«kPa»/«m/s») επιτρεπτά (μοτίβο L3 overlay).
- **TSC (N.17):** ΠΡΙΝ τρέξεις `tsc` έλεγξε ότι δεν τρέχει άλλος: `powershell -NoProfile -Command 'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -like "*tsc*--noEmit*" } | Select-Object ProcessId'`. Αν τρέχει → περίμενε. ΕΝΑ tsc τη φορά, background. **Γνωστό pre-existing error (αγνόησέ το):** `bim-3d/converters/mesh-to-object3d.ts(124)`.
- **Jest:** `npx tsc` ΟΧΙ απαραίτητο για τρέξιμο tests — `npx jest "<path>"`. Τα tests χρησιμοποιούν **jest globals** (describe/it/expect), ΟΧΙ vitest import. Factories περνούν `params` αυτούσια (μπορείς να βάλεις explicit `connectors`).
- **ADR-040:** ο L4 engine **ΕΚΤΟΣ**. Το overlay (mount στο `CanvasLayerStack`, mirror `PipeSizingOverlay`) → **STAGE ADR-040** (CHECK 6B/6D) με το commit.
- **N.15 (μετά):** `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + **ADR-422 changelog (L4 entry)** + memory `project_adr422_thermal_space.md` + `MEMORY.md`. **ΜΗΝ** `adr-index.md` (shared tree).

## 8) ISOLATION (shared tree με boiler agent)

- `git add` **ΜΟΝΟ** δικά σου: `bim/thermal/balancing/*`, `bim/thermal/sizing/pipe-network-graph.ts` (αν extract), `hooks/data/useHydraulicBalancing.ts`, `components/dxf-layout/HydraulicBalancingOverlay.tsx`, `state/hydraulic-balancing-view-store.ts`, `ui/ribbon/components/ShowBalancingToggle.tsx`. **ΠΟΤΕ `-A`**.
- Shared αρχεία που αγγίζεις **προσεκτικά** (μόνο δικές σου γραμμές, additive): `ui/ribbon/data/view-tab-bim-settings.ts` (νέο button), `ui/ribbon/components/RibbonPanel.tsx` (νέο dispatch case), `CanvasLayerStack.tsx` (mount overlay), i18n locales. **ΜΗΝ** αγγίξεις `useRibbonCommands.ts` (boiler agent).
- ⚠️ Αν κάνεις extract των L3 graph helpers (D-B ii), τροποποιείς το `pipe-network-sizing.ts` (δικό σου από το L3) — OK, αλλά πρόσεξε ότι ίσως έχει committed· κάνε καθαρό refactor + ξανατρέξε τα 19 L3 tests.
- **Commit/push τα κάνει ο Giorgio**, όχι εσύ.

## 9) ΠΗΓΕΣ ΝΑ ΔΙΑΒΑΣΕΙΣ ΠΡΩΤΑ

- `docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md` (§3 L4, §4 changelog L3 — η νέα είσοδος έχει όλες τις L3 αποφάσεις).
- memory `project_adr422_thermal_space.md` (L0→L3 + μαθήματα μονάδων/SSoT/δέντρου).
- `bim/thermal/sizing/pipe-network-sizing.ts` (graph + bfsTree + sizing — η βάση του L4) + `pipe-sizing.ts` + `pipe-sizing-config.ts` + `velocity-friction-standard.ts`.
- `hooks/data/usePipeSizing.ts` (read-model να καταναλώσεις).
- `components/dxf-layout/PipeSizingOverlay.tsx` + `state/pipe-sizing-view-store.ts` + `ShowPipeSizingToggle.tsx` + `view-tab-bim-settings.ts` (`PIPE_SIZING_BUTTON`) + `RibbonPanel.tsx` (case `show-pipe-sizing-toggle`) — το UI pattern να κλωνοποιήσεις.
- `ui/ribbon/hooks/useRibbonWaterAutoSupplyBridge.ts` (μόνο αν πιάσεις το L3-Apply του §6 — CompoundCommand template).
- `bim/types/mep-segment-types.ts` (`MepSegmentGeometry.length` — m).
