# HANDOFF — Combi Λέβητας v2 (full water path) ✅ DONE · ΕΠΟΜΕΝΟ: DHW RECIRCULATION (DHWR)

**Ημερομηνία:** 2026-06-09
**Μοντέλο:** Opus 4.8 (Plan Mode)
**Γλώσσα:** Ελληνικά πάντα.
**Commit:** ΘΑ ΤΟ ΚΑΝΕΙ Ο GIORGIO — όχι ο agent (N.(-1)). **SHARED working tree** με άλλον agent (θέρμανση).
**Ποιότητα:** «όπως οι μεγάλοι, σαν Revit — FULL ENTERPRISE + FULL SSOT».

---

## ⚠️ ΚΡΙΣΙΜΟ — ΠΑΡΑΛΛΗΛΟΣ HEATING ΠΡΑΚΤΟΡΑΣ
Δουλεύει ταυτόχρονα στη **θέρμανση**: radiator/pipe **sizing** (ADR-422 L2/L3), **3D gizmo edits**
(ADR-408 Φ-C/Φ-D — rotate/vertical/endpoint move), heat-load engine.
- **ΜΕΝΕ ΜΑΚΡΙΑ** από: `bim/thermal/*`, `mep-radiator-*`, `mep-segment-*`, `mep-system-store`,
  `bim-3d/animation/*` (gizmo), `bim/transforms/*`, `bim3d-edit-*`.
- **git add ΜΟΝΟ δικά σου αρχεία**, ΠΟΤΕ `-A`. **ΜΗΝ adr-index** (shared). **ΕΝΑ tsc** (N.17 — process-check πρώτα· ο heating agent τρέχει tsc συχνά).

---

## 🟢 ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτή η συνεδρία) — 🔴 pending browser-verify + commit (Giorgio)

**COMBI ΛΕΒΗΤΑΣ — FULL water path (v2).** Ο `mep-boiler` με `producesDhw` είναι πλέον πραγματικός
Revit combi: **παίρνει κρύο νερό και το θερμαίνει** (όχι ζεστό «απ' το πουθενά»).
- **2 DHW connectors** (όταν `producesDhw`): hot outlet `boiler-dhw-hot` (`domestic-hot-water`, flow:out,
  `{+hw,+hl}` → πηγάζει DHW δίκτυο) + cold inlet `boiler-dhw-cold` (`domestic-cold-water`, flow:in,
  `{-hw,+hl}` → μέλος cold δικτύου). Combi = **4 connectors**, plain = 2.
- **Dedicated** `dhwConnectorDiameterMm` (default DN15· fallback `connectorDiameterMm`).
- **Classification-aware source resolver** (v1, μένει): `findPipeNetworkSourceConnectorId(source, classification?)`
  + `sourceOutConnectorClassifications` + γεωμετρική inference στο `resolvePipeNetworkFromSelection`
  (`inferTargetClassificationByGeometry`) — μόνο όταν source έχει >1 out-classifications (combi)· μονο-out
  πηγές αμετάβλητες → regression-free.
- **UI = proper Revit Yes/No toggle button** (`type:'toggle'`, mirror roof `slopeUnitPercent`) + contextual
  **«ΖΝΧ» panel** (DHW διάμετρος) που εμφανίζεται μόνο όταν combi (`visibilityKey: combi`).
- **Re-seed «δωρεάν»:** `UpdateMepBoilerParamsCommand` + `seedDefaultConnectors` + `useMepConnectorReconciliation`
  boiler branch ήδη καλούν `buildBoilerConnectors`.
- **jest:** boiler-geometry +4 / NEW `pipe-network-source` 9 / from-selection +3 = 40 νέα· **78 MEP suites / 748
  πράσινα** + boiler bridge 63. tsc καθαρό δικά μου (μόνο pre-existing `mesh-to-object3d:124`).
- **Αρχεία (boiler+connector+bridge+resolver isolated):** `bim/types/mep-connector-types.ts`,
  `bim/mep-boilers/mep-boiler-geometry.ts`, `bim/types/mep-boiler-types.ts` + `.schemas.ts`,
  `bim/mep-systems/pipe-network-source.ts`, `bim/mep-systems/mep-pipe-network-from-selection.ts`,
  `ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts`, `ui/ribbon/hooks/useRibbonMepBoilerBridge.ts`,
  `ui/ribbon/hooks/useRibbonCommands.ts` (additive toggle routing), `ui/ribbon/data/contextual-mep-boiler-tab.ts`,
  i18n el+en. + 3 test files.
- **Docs ✅:** ADR-408 changelog (v2 entry) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr408_combi_boiler` + MEMORY.md.
- **ΕΚΤΟΣ ADR-040.** ΜΗΝ adr-index.

**memory pointers:** `project_adr408_combi_boiler` · `project_adr408_water_heater_dhw` · `project_adr408_boiler_model_catalog` · `project_adr422_l2_boiler_sizing` · `MEMORY.md`.

---

## 🎯 ΕΠΟΜΕΝΗ ΕΡΓΑΣΙΑ: DHW RECIRCULATION (DHWR) — boiler-isolated

### Το πρόβλημα / στόχος (Revit «Domestic Hot Water + Recirculation»)
Σε πολυώροφα/μεγάλα κτίρια το ζεστό νερό **ανακυκλοφορεί** (recirculation loop) ώστε να φτάνει άμεσα
στις βρύσες χωρίς αναμονή/σπατάλη νερού. Ο combi/λέβητας αποκτά **recirculation return inlet** —
το ζεστό επιστρέφει στον λέβητα και ξαναθερμαίνεται. Σήμερα ο combi έχει hot-out + cold-in αλλά **όχι** recirc.

### 🔑 Σχεδιαστική απόφαση (recognition πρώτα — code = SoT)
Reuse classification `domestic-hot-water` με `flow:'in'` για τον recirc inlet — **ΟΧΙ** νέο union member
στο `PlumbingSystemClassification` (αποφυγή αλλαγής shared union/schemas/resolvers). Ο recirc inlet γίνεται
**μέλος του ΙΔΙΟΥ DHW δικτύου** από την επιστροφή. (Future: dedicated `domestic-hot-water-recirculation`
classification αν χρειαστεί ξεχωριστό colour-by-system — flag, μη το κάνεις τώρα.)

### Σχέδιο (Plan Mode → ExitPlanMode· ίδιο pattern με το combi v2)
1. **`bim/types/mep-connector-types.ts`** — NEW `BOILER_DHW_RECIRC_CONNECTOR_ID = 'boiler-dhw-recirc'` +
   `buildBoilerDhwRecircInletConnector` (`domestic-hot-water`, `flow:'in'`· mirror του cold-inlet builder).
2. **`bim/mep-boilers/mep-boiler-geometry.ts` `buildBoilerConnectors`** — όταν `producesDhw && dhwRecirculation`,
   append recirc inlet σε διακριτή γωνία (π.χ. `{-hw, -hl}` back-left· οι 4 άλλες είναι +hl/0 → distinct).
   Διάμετρος = `dhwConnectorDiameterMm ?? connectorDiameterMm`.
3. **`bim/types/mep-boiler-types.ts`** + **`.schemas.ts`** — `dhwRecirculation?: boolean` (additive optional).
4. **UI toggle** — «Ανακυκλοφορία ΖΝΧ» στο υπάρχον **«ΖΝΧ» panel** (visibilityKey `combi`):
   `mep-boiler-command-keys.ts` (+`toggles.dhwRecirculation` στο `MEP_BOILER_RIBBON_TOGGLE_KEYS` set·
   το `isMepBoilerToggleKey` ήδη υπάρχει)· `useRibbonMepBoilerBridge.ts` (`onToggle`/`getToggleState`
   ήδη υπάρχουν — διάκρινε με commandKey: producesDhw vs dhwRecirculation)· `contextual-mep-boiler-tab.ts`
   (`type:'toggle'` button στο «ΖΝΧ» panel). **useRibbonCommands routing ΗΔΗ wired** (isMepBoilerToggleKey)
   → μηδέν νέο routing.
5. **i18n** el+en: `ribbon.commands.mepBoilerEditor.dhwRecirculation`.
6. **Tests:** `buildBoilerConnectors` με `producesDhw + dhwRecirculation` → 5 connectors (recirc domestic-hot-water
   flow:in)· gated από `producesDhw` (αν !producesDhw → όχι recirc ακόμη κι αν flag set)· MEP regression πράσινο.
7. **Docs (N.15):** ADR-408 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory (`project_adr408_combi_boiler` «Next»).

### Πρότυπα reuse (ΜΗΝ ξαναγράψεις)
- **Combi v2 (αυτή η συνεδρία):** το cold-in/hot-out builder + gated connector pattern στο `buildBoilerConnectors`.
- **«ΖΝΧ» panel + combi toggle:** ήδη υπάρχει η υποδομή (toggle keys set, bridge onToggle/getToggleState,
  visibilityKey combi) — ο recirc toggle είναι +1 entry στο ίδιο pattern.
- **Θερμοσίφωνας** (`mep-water-heater`): το connector vocabulary.

### Εκτίμηση: ~7-8 αρχεία, 1 domain → **Plan Mode** (όχι orchestrator). ΕΚΤΟΣ ADR-040.

### Εναλλακτικό επόμενο (αν ο Giorgio προτιμά): fuel/efficiency για ΚΕΝΑΚ
`fuelType` υπάρχει ήδη (από Type Catalog). Λείπει efficiency (η/COP) + ενεργειακός δείκτης. **ΠΡΟΣΟΧΗ:** αυτό
αγγίζει sizing/energy readout → πιθανή σύγκρουση με τον heating agent (ADR-422 ΤΟΤΕΕ/ΚΕΝΑΚ). **Προτίμησε DHWR**
(καθαρά isolated) εκτός αν ο Giorgio πει ρητά αλλιώς.

---

## ❌ ΜΗΝ
- ΜΗΝ commit/push χωρίς εντολή (N.(-1))· ΠΟΤΕ `git add -A`.
- ΜΗΝ πειράξεις heating-agent αρχεία (sizing/heat-load/segment/radiator/system-store/3D-gizmo/transforms).
- ΜΗΝ τρέξεις 2ο tsc ταυτόχρονα (N.17 — process-check πρώτα).
- ΜΗΝ adr-index (shared). ΜΗΝ νέο `PlumbingSystemClassification` union member για το recirc (reuse domestic-hot-water flow:in).
- `any`/inline styles/hardcoded i18n απαγορεύονται.

## Πρώτα βήματα νέας συνεδρίας
1. Recognition: διάβασε `buildBoilerConnectors` (combi v2 — cold/hot/dedicated diameter), το «ΖΝΧ» panel +
   combi toggle υποδομή (`mep-boiler-command-keys` toggles/`isMepBoilerToggleKey`, `useRibbonMepBoilerBridge`
   onToggle/getToggleState, `contextual-mep-boiler-tab` ΖΝΧ panel), τον cold-inlet builder.
2. Plan Mode → ExitPlanMode (DHWR connector + gating + toggle = τα σημεία έγκρισης).
3. Υλοποίηση· tests (+MEP regression)· ΕΝΑ tsc· docs (N.15). Commit → Giorgio.
