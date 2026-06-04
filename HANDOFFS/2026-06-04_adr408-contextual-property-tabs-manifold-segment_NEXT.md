# HANDOFF — ADR-408: Contextual Property Tabs «Ιδιότητες Συλλέκτη» + «Ιδιότητες Σωλήνα» — NEXT

**Ημερομηνία:** 2026-06-04
**Μοντέλο:** Opus. **Σχετικό ADR:** `docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md`
**Πρότυπο 1:1:** Contextual property tab φωτιστικού («Ιδιότητες Φωτιστικού», ADR-406 v0.7) + δοκαριού/κολώνας (editable comboboxes/fields μέσω bridge).

---

## ⚠️ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)
- 🌐 **Ελληνικά πάντα.**
- 🚫 **COMMIT/PUSH μόνο ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`.
- 🌳 **SHARED working tree** με άλλον agent (ADR-415 floorplan-symbol). `git add` **ΜΟΝΟ δικά σου**· **ΠΟΤΕ** `-A`. **ΜΗΝ αγγίξεις adr-index** (shared).
- 🔬 tsc: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep "error TS" | tee /dev/stderr`. **Γνωστό non-mine error (ΑΓΝΟΗΣΕ):** `mesh-to-object3d.ts:124` (string-not-narrow, προϋπάρχον). ⚠️ /tmp ΔΕΝ persist-άρει μεταξύ Bash invocations.
- 🧪 Bash tool = bash. Test scene units = **cm/mm**. Firebase project = **pagonis-87766**.
- 🧠 Κανόνες N.0.1 (ADR-driven 4 φάσεις), N.7.2 (Google-level checklist), N.14 (μοντέλο = Opus, ήδη δηλωμένο εδώ), N.15 (update ΕΚΚΡΕΜΟΤΗΤΕΣ+ADR+memory, ΟΧΙ adr-index).

---

## ✅ ΤΙ ΕΓΙΝΕ ΗΔΗ (committed από Giorgio)

**ADR-408 Φ13 — Δίκτυο Ύδρευσης από Συλλέκτη DONE + ✅ browser-verified + committed.** Επιλογή συλλέκτη+σωλήνες → plumbing `MepSystem`. FULL SSOT μηδέν fork: γενίκευση `resolveManagedCircuits`→`resolveManagedSystems` (entity-type-agnostic), reuse widgets picker/name/color (ήδη system-agnostic). NEW `mep-pipe-network-from-selection.ts` + contextual tab + bridge + command-keys. Όλη η plumbing αλυσίδα (Φ8 σωλήνες/αεραγωγοί, Φ9-Φ10 network, Φ11 auto-fittings, Φ12 συλλέκτης, Φ13 network-from-manifold) είναι **committed**.

---

## 🎯 ΕΠΟΜΕΝΟ ΘΕΜΑ (απόφαση Giorgio): CONTEXTUAL PROPERTY TABS — 2 deferred items

Δύο deferred contextual property tabs (όπως το «Ιδιότητες Φωτιστικού») ώστε ο χρήστης να επεξεργάζεται τις παραμέτρους μετά την τοποθέτηση:

### A) «Ιδιότητες Συλλέκτη» (mep-manifold) — deferred από Φ12
Editable params (βλ. `bim/types/mep-manifold-types.ts` `MepManifoldParams`):
- `outletCount` (αριθμός outlets, MIN 1 / MAX 12 — `MIN/MAX_MANIFOLD_OUTLET_COUNT`)
- `inletDiameterMm`, `outletDiameterMm`
- `mountingElevationMm` (ύψος δαπέδου)
- `width` / `length` / `bodyHeightMm` (footprint/box)
- ⚠️ `outletCount` αλλαγή → **πρέπει να re-seed-άρει connectors** (`buildMepManifoldConnectors`) — επιβεβαίωσε ότι το update path ξανατρέχει το connector seed (αλλιώς outlets/connectors ξεσυγχρονίζονται). Δες πώς το χειρίζεται το completion (Φ12).

### B) «Ιδιότητες Σωλήνα» (mep-segment) — deferred από Φ8
Editable params (βλ. `bim/types/mep-segment-types.ts` `MepSegmentParams`):
- `domain` ('duct'/'pipe') — μάλλον **read-only** indicator (αλλάζει discipline/IFC/BOQ· μην το κάνεις editable στο πρώτο slice)
- `sectionKind` ('rectangular'/'round')
- διαστάσεις διατομής (width/height για rectangular, diameter για round)
- `centerlineElevationMm` (Revit «Middle Elevation»)
- Ισχύει ΚΑΙ για αεραγωγό ΚΑΙ για σωλήνα (ΕΝΑ tab, narrowing μέσω domain για labels/μονάδες αν χρειαστεί).

---

## 🏗️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ — καθρέφτης του «Ιδιότητες Φωτιστικού» (ADR-406 v0.7)

**Πρότυπο (διάβασέ το ΠΡΩΤΟ στο Recognition):**
- `ui/ribbon/data/contextual-mep-fixture-tab.ts` — tab data (panels με `type:'widget'` combobox/string fields)
- `ui/ribbon/hooks/useRibbonMepFixtureBridge.ts` — bridge (`onComboboxChange`/`getComboboxState`/string getters → dispatch `UpdateMepFixtureParamsCommand`)
- `ui/ribbon/hooks/bridge/mep-fixture-command-keys.ts` — `isMepFixtureRibbonKey`/`isMepFixtureRibbonStringKey`/`isMepFixtureActionKey`
- Wiring: `useRibbonCommands.ts` (combobox/string/action routing branches), `useDxfBimBridges.ts` + `useDxfViewerRibbon.ts` (assembly), `app/ribbon-contextual-config.ts` (`resolveContextualTrigger` case).

**Undoable commands ΥΠΑΡΧΟΥΝ ΗΔΗ** (μην φτιάξεις νέα):
- `core/commands/entity-commands/UpdateMepManifoldParamsCommand.ts`
- `core/commands/entity-commands/UpdateMepSegmentParamsCommand.ts`

**Triggers:** `resolveContextualTrigger(entity)` στο `ribbon-contextual-config.ts` — πρόσθεσε `case 'mep-segment'` → segment-props trigger. Για το `mep-manifold` δες το ⚠️ DECISION παρακάτω.

---

## 🚦 ⚠️ ΚΡΙΣΙΜΟ DECISION (λύσε στο Recognition/Plan Mode, ρώτησε Giorgio)

**Trigger precedence για επιλεγμένο ΣΥΛΛΕΚΤΗ:** Το Φ13 ΗΔΗ έβαλε στο `ribbon-contextual-config.ts` (~γραμμή 130-140) branch: «επιλεγμένος `mep-manifold` που πηγάζει δίκτυο → `MEP_PIPE_NETWORK_CONTEXTUAL_TRIGGER` (manage mode)». Αν προσθέσεις «Ιδιότητες Συλλέκτη» tab για κάθε επιλεγμένο manifold → **σύγκρουση** (δύο contextual tabs, ένα μόνο ενεργό).

**Πρότυπο που ΛΥΝΕΙ το ίδιο πρόβλημα (electrical):** Το φωτιστικό (fixture) δείχνει «Ιδιότητες Φωτιστικού» ΩΣ ΠΡΩΤΟ tab, με panel «Κύκλωμα» **μέσα του** (`RibbonMepFixtureCircuitWidget` — read-only info + «Επεξεργασία Κυκλώματος» button που κάνει select τον πίνακα). Ο πίνακας (panel/source) ΔΕΝ έχει props tab — δείχνει μόνο το circuit-manage tab.

**ΣΥΣΤΑΣΗ (Revit-consistent):** Κάνε «Ιδιότητες Συλλέκτη» το ΠΡΩΤΟ tab για επιλεγμένο manifold, και **fold μέσα του** το pipe-network management (reuse τα picker/name/color widgets + add/remove/create actions που έφτιαξε το Φ13) ως panel «Δίκτυο» — ώστε ΕΝΑ tab να κάνει «properties + system» (όπως circuit tab έχει properties+actions). Τότε το Φ13 manage-mode branch (manifold→network tab) **αντικαθίσταται** από το manifold-props branch (το create-mode multi-select manifold+pipes ΜΕΝΕΙ ως έχει). Εναλλακτικά (πιο απλό, λιγότερο κομψό): manifold-props tab μόνο όταν ΔΕΝ πηγάζει δίκτυο. **Ρώτησε Giorgio με AskUserQuestion ποιο θέλει** πριν υλοποιήσεις.

Ο **σωλήνας** δεν έχει τέτοια σύγκρουση (κανένα contextual tab σήμερα για `mep-segment`) → καθαρό.

---

## ⚠️ ΜΑΘΗΜΑΤΑ (από Φ13 — μην τα ξαναπατήσεις)
- **Έλεγξε ΠΡΙΝ copy αν υπάρχει domain-agnostic SSoT** (τα widgets picker/name/color του Φ6 ήταν ήδη system-agnostic → reuse χωρίς fork).
- **Rename export = grep ΟΛΟΥΣ τους consumers** (στο Φ13 ξέχασα 2 fixture consumers → build error «Export … doesn't exist»). Αν αγγίξεις shared SSoT, ψάξε όλα τα call-sites.
- **Radix Select no-value = `SELECT_CLEAR_VALUE`, ΟΧΙ `''`** (ADR-001 canonical `@/components/ui/select`).
- i18n: ΟΛΑ τα keys σε `el` **ΚΑΙ** `en` (`src/i18n/locales/*/dxf-viewer-shell.json`)· ΟΧΙ hardcoded strings (N.11). Πρόσθεσε keys ΠΡΙΝ τα χρησιμοποιήσεις στο `t()`.
- **Function/file limits** (N.7.1): 40 γρ/function, 500 γρ/file.

---

## 🚦 Execution mode (N.8)
**Plan Mode.** ~12-16 αρχεία, 1 domain (ui + λίγο bim), 2 entities. Αν διογκωθεί (>15) ή θέλεις τα 2 entities ξεχωριστά → ρώτησε Giorgio αν να σπάσει σε 2 συνεδρίες (συλλέκτης πρώτα, σωλήνας μετά). Ξεκίνα με **Recognition**: διάβασε `contextual-mep-fixture-tab.ts` + `useRibbonMepFixtureBridge.ts` + `mep-fixture-command-keys.ts` + `mep-manifold-types.ts` + `mep-segment-types.ts` + `UpdateMepManifold/SegmentParamsCommand.ts` + το trigger-precedence στο `ribbon-contextual-config.ts`.

## 🔑 ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ
- Πρότυπο: `ui/ribbon/data/contextual-mep-fixture-tab.ts`, `ui/ribbon/hooks/useRibbonMepFixtureBridge.ts`, `ui/ribbon/hooks/bridge/mep-fixture-command-keys.ts`, `RibbonMepFixtureCircuitWidget.tsx` (in-tab «sub-system» panel pattern).
- Types: `bim/types/mep-manifold-types.ts`, `bim/types/mep-segment-types.ts`.
- Commands (υπάρχουν): `UpdateMepManifoldParamsCommand.ts`, `UpdateMepSegmentParamsCommand.ts`.
- Wiring: `app/ribbon-contextual-config.ts`, `ui/ribbon/hooks/useRibbonCommands.ts`, `app/useDxfBimBridges.ts`, `app/useDxfViewerRibbon.ts`.
- Φ13 reuse (αν fold-άρεις network στο manifold tab): `contextual-mep-pipe-network-tab.ts`, `useRibbonMepPipeNetworkBridge.ts`, `mep-pipe-network-command-keys.ts`.

## 🟡 Προαιρετικά follow-ups (μετά)
- Manifold grips add/remove outlet (δυναμικός outletCount με λαβές).
- Duct (air) systems (grouping+routing, αντίστοιχο plumbing network).
- Φ14 System Browser / Sizing.
