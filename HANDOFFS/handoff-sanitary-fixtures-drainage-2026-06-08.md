# 🚽 HANDOFF — ADR-408 Φ14: Σύνδεση Ειδών Υγιεινής στο Δίκτυο Αποχέτευσης

> **Σύνταξη:** Opus 4.8, 2026-06-08. Έγινε ΜΟΝΟ exploration + design framing — **ΚΑΜΙΑ αλλαγή κώδικα** για αυτό το feature.
> **Ρόλος επόμενου agent:** agent ΑΠΟΧΕΤΕΥΣΗΣ (ADR-408 Φ14). ΟΧΙ θέρμανση/ύδρευση (codex agent, ίδιο tree).
> **Πρότυπο:** το **floor drain (σιφώνι)** μόλις υλοποιήθηκε — είναι το ΑΚΡΙΒΕΣ pattern. Δες `HANDOFFS/handoff-floor-drain-2026-06-07.md` + memory `project_adr408_phi14_drainage`.

---

## ⚠️ ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (αμετάβλητοι)
- **SHARED working tree** με codex (heating) → `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit (N.(-1)). Εσύ μόνο προετοιμάζεις + αναφέρεις.
- Απαντάς στα **Ελληνικά**. Quality: **FULL ENTERPRISE + FULL SSOT, Revit-grade** (ρητή εντολή Giorgio «όπως οι μεγάλοι παίχτες, όπως η Revit»).
- **STAGE ADR-040** (CHECK 6D) όταν αγγίξεις `MepFixtureRenderer.ts` ή άλλον 2D entity renderer στη λίστα CHECK 6B/6D. **ΜΗΝ** αγγίξεις `adr-index.md` (shared).
- **N.17:** ΠΡΙΝ τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος (codex agents συχνά τρέχουν tsc). ΕΝΑ tsc τη φορά.
- **N.8:** Αυτό είναι **Orchestrator-level** (~20-30 αρχεία, cross-cutting 2D+3D+δίκτυο+UI+i18n). **ΞΕΚΙΝΑ ΣΕ PLAN MODE** — υπάρχει μία πραγματική αρχιτεκτονική απόφαση που ΔΕΝ είναι κλειδωμένη (§3 παρακάτω) και χρειάζεται ρητή έγκριση Giorgio (AskUserQuestion) ΠΡΙΝ γράψεις κώδικα.

## ⚠️ ΕΚΚΡΕΜΕΣ ΑΠΟ ΠΡΟΗΓΟΥΜΕΝΗ ΔΟΥΛΕΙΑ (ίδιο tree)
Το **floor drain (Φ14 σιφώνι)** μπορεί να είναι ΑΚΟΜΑ uncommitted (ο Giorgio θα κάνει verify+commit). **ΜΗΝ το αναιρέσεις** — είναι το θεμέλιο pattern σου. 25 αρχεία (23 MOD + 2 NEW), 533 jest PASS. Δες memory `project_adr408_phi14_drainage` + το floor-drain handoff.

---

## 1) CONTEXT — γιατί γίνεται

Το σύστημα αποχέτευσης έχει: αγωγό (`mep-drain-pipe`), φρεάτιο (`drainage-collector`), δίκτυο, V/G toggle «Αποχέτευση», auto-fittings, **σιφώνι δαπέδου** (`mep-fixture` kind `floor-drain`). **Λείπει η «πηγή»:** τα είδη υγιεινής (WC/νιπτήρας/μπανιέρα/ντουζιέρα/μπιντές) ΔΕΝ συνδέονται στο δίκτυο. Σε Revit-true sanitary system κάθε **Plumbing Fixture** έχει drainage connector → trap → waste pipe → φρεάτιο → υπόνομος. Στόχος: κλείσιμο του κύκλου **είδος υγιεινής → σωλήνας → φρεάτιο → υπόνομος**, χτίζοντας στο floor-drain pattern (mep-fixture kind με `sanitary-drainage` connector).

---

## 2) ΥΠΑΡΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (μετά exploration — επιβεβαιωμένη)

- **Τα sanitary είδη ΥΠΑΡΧΟΥΝ ΗΔΗ** ως ADR-415 `floorplan-symbol` (2D-only, **dead-end, ΧΩΡΙΣ connectors**):
  - `FloorplanSymbolKind`: `'wc' | 'washbasin' | 'shower' | 'bathtub' | 'bidet'` (+ kitchen/furniture).
  - Catalog `FLOORPLAN_SYMBOL_CATALOG` (`bim/floorplan-symbols/floorplan-symbol-catalog.ts`) με authored διαστάσεις: **WC 380×680, νιπτήρας 600×460, ντουζιέρα 900×900, μπανιέρα 1700×750, μπιντές 360×560** (mm).
  - `sanitary` category → discipline `plumbing`, IFC `IfcSanitaryTerminal`, BimCategory `'sanitary'` (`floorplan-symbol-categories.ts`).
  - `FloorplanSymbolParams` **ΔΕΝ** extends `MepConnectorHostParams` → `getEntityConnectors` επιστρέφει `[]` → `collectHostConnectorEndpoints` το αγνοεί.
- **`IfcSanitaryTerminal` υπάρχει ήδη** στο `ifc-entity-mixin.ts` (γρ.44-46) — καλύπτει ΟΛΑ τα sanitary terminals (WC/νιπτήρα/μπάνιο/ντουζιέρα/μπιντέ· διαφοροποίηση με `PredefinedType` στο pset, ΟΧΙ νέο IFC class). **Μηδέν αλλαγή mixin.**
- **mep-fixture σήμερα:** `MepFixtureKind = 'light-fixture' | 'floor-drain'`. Το floor-drain απέδειξε ότι ένα νέο kind με pipe connector **συνδέεται ΑΥΤΟΜΑΤΑ στο δίκτυο** (zero αλλαγή σε `collectHostConnectorEndpoints`/`derivePipeJunctions`).
- **Trap/οσμοπαγίδα:** μηδενική υποδομή (αναμενόμενο — 3D detail, εκτός scope 2D modeler).

---

## 3) 🔴 ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ — **ΔΕΝ ΕΙΝΑΙ ΚΛΕΙΔΩΜΕΝΗ** (Plan Mode + AskUserQuestion Giorgio)

Το **σωστό IMPLEMENTATION VEHICLE είναι ΚΛΕΙΔΩΜΕΝΟ**: νέα **`mep-fixture` kinds** (όπως floor-drain), **ΟΧΙ** connector στο floorplan-symbol. Γιατί ΟΧΙ floorplan-symbol (Επιλογή Β απορρίφθηκε):
- `FloorplanSymbolParams` δεν extends `MepConnectorHostParams` → schema + Zod + Firestore migration.
- `collectHostConnectorEndpoints`/`getEntityConnectors`/`isMepConnectorHost` τυφλά στο floorplan-symbol.
- ADR-415 ορίζει το floorplan-symbol ρητά ως «pure annotation-grade 2D» — connector αλλάζει τον ρόλο.

**ΤΟ ΑΝΟΙΧΤΟ DILEMMA (αυτό κλειδώνεις σε Plan Mode με Giorgio):** τα sanitary είδη ΥΠΑΡΧΟΥΝ ΗΔΗ ως 2D-only floorplan-symbols. Αν φτιάξεις νέα mep-fixture kinds με τα ίδια ονόματα → **διπλά WC** (ένα 2D-only annotation + ένα connectable) = SSoT violation + σύγχυση χρήστη.

| Επιλογή | Τι κάνει | Trade-off |
|---|---|---|
| **A1 — Migration (Revit-true, SSoT-clean) [RECOMMEND]** | Τα 5 sanitary kinds (wc/washbasin/shower/bathtub/bidet) **μεταναστεύουν** σε `mep-fixture` kinds (connectable + 2D σύμβολο). Τα 2D-only sanitary floorplan-symbols **deprecate/αφαιρούνται από το ribbon** (kitchen/furniture μένουν floorplan-symbol). | ΕΝΑ WC (όπως Revit: Plumbing Fixture = 2D σύμβολο + connector). Καθαρό SSoT. **Κόστος:** data migration υπαρχόντων sanitary floorplan-symbols + αλλαγή ribbon «Αντικείμενα». |
| **A2 — Coexist (φθηνό, βρώμικο)** | Νέα mep-fixture sanitary kinds **παράλληλα** με τα 2D-only. | Διπλό catalog, σύγχυση «ποιο WC;». SSoT violation. ΟΧΙ Revit-true. |

**Σύσταση Opus:** **A1** — είναι το μόνο Revit-true + FULL SSOT. Η Revit ΔΕΝ έχει «2D-only WC» vs «connectable WC». Αλλά το migration cost (υπάρχοντα δεδομένα + ribbon) είναι πραγματικό → **ρώτα Giorgio με AskUserQuestion** (A1 migration vs A2 coexist) ΠΡΙΝ ξεκινήσεις. Αν A1, χρειάζεσαι και strategy για υπάρχοντα persisted sanitary floorplan-symbols (migrate-on-load vs script vs leave-legacy).

**Δευτερεύουσες αποφάσεις για το ίδιο AskUserQuestion:**
- **(β) BimCategory:** `'drain-pipe'` (V/G + καφέ μαζί με αποχέτευση, όπως floor-drain) **ή** η υπάρχουσα `'sanitary'` (δικό της toggle, plumbing χρώμα); Revit: τα fixtures είναι ξεχωριστή category από τα pipes. **Πρόταση:** κράτα `'sanitary'` για τα είδη υγιεινής (ώστε να μη χάνονται με το toggle «Αποχέτευση» σωλήνων) — αλλά ο connector τους ΕΙΝΑΙ `sanitary-drainage` (συνδέονται στο δίκτυο). Αυτό διαφέρει από το floor-drain (που πήρε 'drain-pipe' γιατί ΕΙΝΑΙ μέρος της αποχέτευσης). **Giorgio αποφασίζει.**
- **(γ) Connectors ανά fixture:** v1 = **1 sanitary-drainage outlet** (`flow:'out'`, όπως floor-drain) — αρκεί για «σύνδεση στο δίκτυο αποχέτευσης». Το water-supply inlet (cold/hot — WC/νιπτήρας έχουν και παροχή) = **flag ως future** (εκτός scope «αποχέτευση»). Giorgio confirm.
- **(δ) Trap/οσμοπαγίδα:** εκτός scope (3D detail) → flag στο `pending-ratchet-work.md`, ΟΧΙ fix.

---

## 4) IMPLEMENTATION — βήμα-βήμα (πρότυπο = floor-drain §4, ΑΚΡΙΒΩΣ)

> Όλα τα παρακάτω καθρεφτίζουν το floor-drain. Άνοιξε τα floor-drain diffs (memory `project_adr408_phi14_drainage` + git) ως template ανά αρχείο.

### A. Core data model
1. **`bim/types/mep-fixture-types.ts`**: `MepFixtureKind` += `'wc' | 'washbasin' | 'bathtub' | 'shower' | 'bidet'` (όσα εγκρίνει ο Giorgio). `resolveFixtureIfcType` → όλα `'IfcSanitaryTerminal'`. `resolveFixtureBimCategory` → κατά απόφαση (β) ('sanitary' ή 'drain-pipe'). NEW per-kind defaults (διαστάσεις από `FLOORPLAN_SYMBOL_CATALOG` — copy authored values WC 380×680 κλπ).
2. **`bim/types/mep-fixture.schemas.ts`**: `MepFixtureKindSchema` += νέα kinds. (`ifcType` enum ήδη έχει `IfcSanitaryTerminal` από floor-drain — verify.) **ΧΩΡΙΣ αυτό → silent-drop persistence.**
3. **`services/factories/mep-fixture.factory.ts`**: ήδη `resolveFixtureIfcType(kind)` από floor-drain → **μηδέν αλλαγή** (verify).

### B. Connector
4. **`bim/types/mep-connector-types.ts`**: NEW `buildSanitaryDrainConnector(localPosition, diameterMm)` (generic — όλα τα sanitary terminals έχουν ίδιο sanitary-drainage outlet· mirror `buildFloorDrainConnector`). Ø default ανά τύπο (WC ~100, νιπτήρας ~40, μπανιέρα/ντουζιέρα ~50).
5. **`hooks/drawing/mep-fixture-completion.ts`**: kind-aware `buildDefaultMepFixtureParams` — οι νέοι sanitary kinds → defaults + `[buildSanitaryDrainConnector(...)]`. **Διατήρησε light-fixture + floor-drain paths ανέπαφα.**
6/7. **VERIFY only** (αναμένεται μηδέν): `mep-host-connector-endpoints.ts` + `mep-connector-elevation.ts` (fixture-wide, kind-agnostic — επιβεβαιωμένο στο floor-drain).

### C. 2D σύμβολο + renderer
8. **`bim/mep-fixtures/mep-fixture-symbol.ts`**: kind-aware. **REUSE τους ADR-415 sanitary symbol drawers** (`bim/floorplan-symbols/floorplan-symbol-symbol.ts` — έχει ήδη WC/νιπτήρα/μπάνιο/ντουζιέρα 2D vectors). Μην ξαναζωγραφίσεις — import/adapt. (Αν είναι coupled με floorplan-symbol params, extract κοινό SSoT pure drawer.)
9. **`bim/renderers/MepFixtureRenderer.ts`** (STAGE ADR-040 CHECK 6D): category από `resolveFixtureBimCategory` (ήδη kind-aware από floor-drain) + χρώμα κατά απόφαση (β).

### D. 3D
10. **`bim-3d/converters/bim-three-point-converters.ts`** `fixtureToMesh`: kind-aware mesh ανά sanitary τύπο (απλά parametric boxes v1, ή reuse floorplan-symbol 3D αν υπάρχει). Units-safe (sceneUnitsToMeters, ΟΧΙ light-fixture meter-scene path — δες floor-drain branch).
11. **3D sync** `BimSceneLayer.syncFixtures`: ήδη `resolveFixtureBimCategory` από floor-drain → **μηδέν αλλαγή** (verify).

### E. UI (tool / ribbon / contextual / i18n)
12. **`useMepFixtureTool.ts`**: bridge publish kind ήδη `overrides.kind ?? 'light-fixture'` (floor-drain) → verify· status text kind-aware ανά τύπο.
13. **`useSpecialTools-placement-tools.ts`**: νέα tool ids (π.χ. `mep-wc`, `mep-washbasin`…) → ίδιο shared fixture tool με `setParamOverrides({ kind })` (μοτίβο floor-drain). **Ή** ΕΝΑ tool `mep-sanitary-fixture` + picker (όπως furniture/floorplan-symbol contextual library). **Πρόταση:** ENA tool + contextual picker «διάλεξε είδος» (λιγότερα ribbon entries· μοτίβο `FLOORPLAN_SYMBOL` library tab).
14. **`tool-definitions.ts` + `ui/toolbar/types.ts`**: νέα tool id(s).
15. **`useCanvasClickHandler.ts`**: routing (OR στο fixture branch, όπως floor-drain).
16. **`ui/ribbon/data/home-tab-draw.ts`**: ribbon entry/entries. Αν A1 migration → ΑΦΑΙΡΕΣΕ τα sanitary από το «Αντικείμενα» (floorplan-symbol) submenu + πρόσθεσέ τα στην Αποχέτευση (ή νέο «Είδη Υγιεινής»).
17. **Contextual tab** «Ιδιότητες Είδους Υγιεινής»: NEW `contextual-mep-sanitary-fixture-tab.ts` **reuse `useRibbonMepFixtureBridge` + `MEP_FIXTURE_RIBBON_KEYS`** (όπως floor-drain — **μηδέν νέος bridge**) + routing branch στο `app/ribbon-contextual-config.ts` (`readFixtureKind` ήδη υπάρχει από floor-drain — επέκτεινε το branch). Αν ENA tool+picker → και library picker tab (μοτίβο `MEP_FIXTURE_LIBRARY`).
18. **i18n el+en** (`dxf-viewer-shell.json`): tools.*, ribbon.tabs.*, ribbon.panels.*, ribbon.commands.bim.*, ribbon.commands.*Editor.*. **el+en parity, ΟΧΙ defaultValue (N.11).**

### F. Tests
- NEW `mep-fixture-sanitary.test.ts`: `resolveFixtureBimCategory`/`resolveFixtureIfcType` (sanitary→IfcSanitaryTerminal), `buildSanitaryDrainConnector` (flow out/domain pipe/sanitary-drainage), `buildDefaultMepFixtureParams({kind:'wc'})` (connector + defaults), symbol drawer per kind.
- Append schema test: sanitary kinds + IfcSanitaryTerminal round-trip.
- Αν A1 migration: test για migrate-on-load (floorplan-symbol sanitary → mep-fixture) ή ό,τι strategy επιλεγεί.
- Regression: `npx jest src/subapps/dxf-viewer/bim/mep-fixtures src/subapps/dxf-viewer/bim/types src/subapps/dxf-viewer/bim/mep-systems --silent`.

---

## 5) CRITICAL SSoT REUSE (import, ΜΗΝ αντιγράψεις)
- **floor-drain = ΑΚΡΙΒΕΣ πρότυπο** ανά αρχείο (mep-fixture-types/schemas/factory/connector/completion/symbol/renderer/3D/tool/contextual). Άνοιξε τα diffs.
- ADR-415 sanitary **2D symbol drawers** — `bim/floorplan-symbols/floorplan-symbol-symbol.ts` (WC/νιπτήρα/μπάνιο/ντουζιέρα ήδη ζωγραφισμένα· extract κοινό pure drawer αν χρειαστεί).
- ADR-415 **authored διαστάσεις** — `FLOORPLAN_SYMBOL_CATALOG` (WC 380×680 κλπ· copy αξιόπιστα).
- `buildFloorDrainConnector` — `mep-connector-types.ts` (πρότυπο για `buildSanitaryDrainConnector`).
- `useRibbonMepFixtureBridge` + `MEP_FIXTURE_RIBBON_KEYS` — reuse αυτούσια (το sanitary fixture ΕΙΝΑΙ mep-fixture· ο bridge kind-agnostic).
- Connector/junction/snap infrastructure — αυτόματο (fixture ήδη host-scanned).

## 6) ΕΚΤΟΣ scope (flag ΜΟΝΟ → `.claude-rules/pending-ratchet-work.md`)
- **Trap/οσμοπαγίδα** (3D plumbing detail).
- **Water-supply connectors** (cold/hot inlet σε WC/νιπτήρα) — εκτός «αποχέτευση»· future Revit-full plumbing.
- Ήδη flagged (floor-drain session): `collectHostConnectorEndpoints` radiator/boiler host-incident gap.

## 7) ΕΛΕΓΧΟΙ
- N.17 πρώτα → `npx tsc --noEmit 2>&1 | rg "mep-fixture|MepFixtureRenderer|sanitary|wc|washbasin"` → 0 δικά σου (αγνόησε pre-existing `mesh-to-object3d.ts:124` ADR-411 + codex radiator/boiler).
- `npx jest src/subapps/dxf-viewer/bim/mep-fixtures src/subapps/dxf-viewer/bim/types src/subapps/dxf-viewer/bim/mep-systems --silent` → PASS.
- **Browser verify (Giorgio):** ribbon → διάλεξε WC → κλικ· (α) 2D σύμβολο WC· (β) drain-pipe από WC → snap + κανένα spurious cap· (γ) σωλήνας→φρεάτιο→δίκτυο· (δ) contextual tab· (ε) 3D.

## 8) TRACKERS @ commit boundary (N.15 — κάνει ο Giorgio με το commit)
ADR-408 changelog (additive) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` Φ14 + memory `project_adr408_phi14_drainage`. **ΟΧΙ adr-index.md** (shared tree).

## 9) Σχετικές μνήμες
`project_adr408_phi14_drainage` (master αποχέτευσης· περιέχει floor-drain entry), `project_adr415_2d_floorplan_symbols` (τα υπάρχοντα sanitary symbols), `project_adr408_phi12_plumbing_manifold` (kind-aware contextual tab), `project_adr408_mep_connectors_systems` (connectors/network).

---

## 📌 ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΕΠΟΜΕΝΟΥ AGENT (νέα session, Opus)
1. Διάβασε αυτό + το floor-drain handoff + memory `project_adr408_phi14_drainage`.
2. **ΞΕΚΙΝΑ ΣΕ PLAN MODE.** Κλείδωσε §3 με **AskUserQuestion Giorgio**: (A1 migration vs A2 coexist) + BimCategory ('sanitary' vs 'drain-pipe') + connectors (drain-only v1) + kinds να συμπεριληφθούν. ΜΗ γράψεις κώδικα πριν.
3. Μετά την έγκριση: υλοποίησε §4 A→F με σειρά (πρότυπο floor-drain).
4. Έλεγχοι §7 → ανάφερε (ΟΧΙ commit). Trackers §8 ετοιμάζεις, commit-άρει ο Giorgio.
