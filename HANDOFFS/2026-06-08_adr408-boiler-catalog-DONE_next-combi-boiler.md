# HANDOFF — Λέβητας: Type Catalog + L2 Sizing + DHW θερμοσίφωνας ✅ DONE · ΕΠΟΜΕΝΟ: COMBI ΛΕΒΗΤΑΣ (θέρμανση + ΖΝΧ)

**Ημερομηνία:** 2026-06-08
**Μοντέλο:** Opus 4.8 (Plan Mode)
**Γλώσσα:** Ελληνικά πάντα.
**Commit:** ΘΑ ΤΟ ΚΑΝΕΙ Ο GIORGIO — όχι ο agent (N.(-1)). **SHARED working tree** με άλλον/ους agent(s).
**Ποιότητα:** «όπως οι μεγάλοι, σαν Revit — FULL ENTERPRISE + FULL SSOT».

---

## ⚠️ ΚΡΙΣΙΜΟ — ΠΑΡΑΛΛΗΛΟΣ HEATING ΠΡΑΚΤΟΡΑΣ
Δουλεύει ταυτόχρονα στη **θέρμανση** — συγκεκριμένα **διαστασιολόγηση σωμάτων/σωλήνων** (ADR-422 L2 radiator-sizing, L3 pipe-sizing). 
- **ΜΕΝΕ ΜΑΚΡΙΑ** από: `mep-system*`, radiator/pipe sizing (`bim/thermal/sizing/*`), heat-load engine (`bim/thermal/heat-load/*`), `mep-radiator-*`, `mep-segment-*`.
- **git add ΜΟΝΟ δικά σου αρχεία**, ΠΟΤΕ `-A`. **ΜΗΝ adr-index** (shared).
- Ονοματολογική επικάλυψη «ADR-422 L2»: εκείνος=radiator sizing, εγώ=boiler sizing — διακριτά sub-features, ήδη σημειωμένο στο ΕΚΚΡΕΜΟΤΗΤΕΣ.

---

## 🟢 ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτή η συνεδρία) — όλα 🔴 pending browser-verify + commit
1. **Θερμοσίφωνας DHW** (`mep-water-heater`) — νέο point-based source ζεστού νερού χρήσης, mirror λέβητα 1:1 (cold-in/hot-out, ids wh-cold/wh-hot). ~80 αρχεία· jest 94/94· tsc 0. **Χρειάζεται firebase deploy** (rules/indexes). memory: `project_adr408_water_heater_dhw`.
2. **Διαστασιολόγηση Λέβητα** (ADR-422 L2) — readout «Διαστασιολόγηση» (Απαιτούμενη vs Εγκατεστημένη kW + επάρκεια), network-aware. NEW pure `heating-equipment-sizing.ts` + `resolve-source-served-spaces.ts`. jest 66/66· tsc 0. memory: `project_adr422_l2_boiler_sizing`.
3. **Κατάλογος Μοντέλων Λέβητα** (ADR-408) — dropdown «Μοντέλο» 7 μοντέλα → auto-fill thermalOutputW+διαστάσεις+fuelType. NEW `boiler-model-catalog.ts`. jest 47/47· tsc 0. memory: `project_adr408_boiler_model_catalog`.

Όλα: ΕΚΤΟΣ ADR-040· docs (ADR changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory) ✅· ΟΧΙ adr-index.

---

## 🎯 ΕΠΟΜΕΝΗ ΕΡΓΑΣΙΑ: COMBI ΛΕΒΗΤΑΣ (θέρμανση + ΖΝΧ) — boiler-isolated

### Το πρόβλημα / στόχος
Πραγματικοί combi λέβητες (οι περισσότεροι οικιακοί) παράγουν **και** ζεστό νερό χρήσης, όχι μόνο θέρμανση χώρου. Σήμερα: ο λέβητας=hydronic θέρμανση μόνο· το ΖΝΧ καλύπτεται από ξεχωριστό θερμοσίφωνα. Στόχος: ο λέβητας **προαιρετικά** τροφοδοτεί και το `domestic-hot-water` δίκτυο.

### 🔑 Ο ΣΧΕΔΙΑΣΤΙΚΟΣ ΚΟΜΠΟΣ (recognition πρώτα — code=SoT)
Με `producesDhw`, ο λέβητας θα έχει **ΔΥΟ** `flow:'out'` connectors: hydronic-supply (θέρμανση) **και** domestic-hot-water (ΖΝΧ). Ο `findPipeNetworkSourceConnectorId` στο `bim/mep-systems/pipe-network-source.ts` σήμερα παίρνει «το πρώτο `flow==='out'`» → **θα διαλέγει λάθος** για το ένα από τα δύο δίκτυα.
**FIX: classification-aware source-connector** — ο resolver δέχεται το target classification και επιλέγει τον out-connector ΑΥΤΗΣ της classification. Ο `resolvePipeNetworkFromSelection` ήδη γνωρίζει το classification του δικτύου → πέρασέ το. **⚠️ Shared MEP αρχείο (όχι του heating agent)· κράτα τα 70 MEP tests πράσινα (regression).**

### Σχέδιο (Plan Mode → ExitPlanMode)
1. **`bim/types/mep-boiler-types.ts`** — `MepBoilerParams += producesDhw?: boolean` (additive optional).
2. **`bim/types/mep-boiler.schemas.ts`** — `producesDhw: z.boolean().optional()`.
3. **`bim/mep-boilers/mep-boiler-geometry.ts` `buildBoilerConnectors`** — όταν `producesDhw`, πρόσθεσε 3ο connector DHW hot-out (`domestic-hot-water`, `flow:'out'`, NEW id `boiler-dhw`, builder `buildBoilerDhwConnector` στο `mep-connector-types.ts`). (cold-in DHW feed = follow-up.)
4. **`bim/mep-systems/pipe-network-source.ts`** — classification-aware `findPipeNetworkSourceConnectorId` (βλ. κόμπο). Ο λέβητας ΗΔΗ είναι στο `isPipeNetworkSourceEntity`.
5. **UI toggle** — boiler tab «Παραγωγή ΖΝΧ (Combi)» ως **boolean toggle** (όχι combobox): `mep-boiler-command-keys.ts` (+toggle key + `isMepBoilerToggleKey`), `contextual-mep-boiler-tab.ts` (toggle button), `useRibbonMepBoilerBridge.ts` (+`onToggle`/`getToggleState`), `useRibbonCommands.ts` (toggle routing — δες πώς το κάνει το wall toggle, additive). Toggle ON → `dispatchParams({...params, producesDhw:true})` (το UpdateCommand ξανα-seed-άρει connectors από width — επιβεβαίωσε ότι περιλαμβάνει το DHW connector· αλλιώς seed στο completion+command).
6. **completion/seed** — `mep-connector-seed.ts` boiler branch ήδη υπάρχει· βεβαιώσου ότι reseed-άρει και το DHW connector όταν `producesDhw` (kind-aware self-heal).
7. **i18n** el+en: `ribbon.commands.mepBoilerEditor.producesDhw` / panel label αν χρειαστεί.
8. **Tests:** `buildBoilerConnectors` με producesDhw → 3 connectors (DHW hot-out)· `pipe-network-source` classification-aware (hydronic source connector ≠ DHW source connector)· MEP regression 70 πράσινα. **Docs:** ADR-408 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory (`project_adr408_boiler_model_catalog` έχει «Next: combi»).

### Πρότυπα reuse (ΜΗΝ ξαναγράψεις)
- **Θερμοσίφωνας** (`mep-water-heater`): cold-in/hot-out DHW connectors + DHW source pattern — το ακριβές connector vocabulary.
- **Generalized `isPipeNetworkSourceEntity`** (manifold|boiler|water-heater) — ο λέβητας ΗΔΗ μέσα.
- **Wall toggle** (`isWallRibbonToggleKey` + `wallBridge.onToggle` + `useRibbonCommands` onToggle routing) — το toggle UI pattern.

### Εκτίμηση: ~9-11 αρχεία, 1-2 domains → **Plan Mode** (όχι orchestrator). ΕΚΤΟΣ ADR-040.

---

## ❌ ΜΗΝ
- ΜΗΝ commit/push χωρίς εντολή (N.(-1))· ΠΟΤΕ `git add -A`.
- ΜΗΝ πειράξεις adr-index / heating-agent αρχεία (sizing/heat-load/radiator/segment/mep-system).
- ΜΗΝ τρέξεις 2ο tsc ταυτόχρονα (N.17 — process-check πρώτα).
- `any`/inline styles/hardcoded i18n απαγορεύονται.

## Πρώτα βήματα νέας συνεδρίας
1. Recognition: διάβασε `pipe-network-source.ts` (`findPipeNetworkSourceConnectorId`) + `buildBoilerConnectors` + το DHW connector pattern του θερμοσίφωνα + το wall-toggle pattern.
2. Plan Mode → ExitPlanMode (classification-aware source connector = το κρίσιμο σημείο έγκρισης).
3. Υλοποίηση· tests (+MEP regression)· ΕΝΑ tsc· docs (N.15).

**Memory σχετικά:** `project_adr408_boiler_model_catalog` · `project_adr422_l2_boiler_sizing` · `project_adr408_water_heater_dhw` · `project_adr408_eyros_b2_boiler` · `MEMORY.md`.
