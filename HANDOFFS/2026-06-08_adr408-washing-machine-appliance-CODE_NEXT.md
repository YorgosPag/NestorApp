# HANDOFF — Connectable «Πλυντήριο» (Revit Plumbing Appliance) — CODE slices

**Ημ/νία:** 2026-06-08 · **Μοντέλο:** Opus 4.8 (Plan Mode εγκεκριμένο) · **ADR:** ADR-408 (Δρόμος B)
**Στόχος Giorgio:** Πλυντήριο ως **πλήρες Revit appliance** — τοποθετείται 2D/3D **ΚΑΙ συνδέεται** στο
δίκτυο (παροχή κρύου νερού + αποχέτευση). «FULL ENTERPRISE + FULL SSOT, σαν Revit.»

## ✅ ΤΙ ΕΓΙΝΕ (Slice 0 — mesh, ΧΩΡΙΣ καμία αλλαγή σε source code)
- Mesh **έτοιμο στο Storage:** `gs://pagonis-87766.firebasestorage.app/bim-mesh-library/appliance/washing_machine_01.glb`
- Pipeline: download (Sketchfab CC-BY) → **gltf-transform** (dedup/flatten/join/weld/simplify ratio 0.18 + center + scale→850mm ύψος) → upload. Raw 290k faces/16-24m messy Maya export → **105.389 triangles, real-world 597×850×587mm, min.y=0 (base στο πάτωμα), X/Z centered**.
- **Measured dims (για catalog):** widthMm **597**, depthMm **587**, heightMm **850**, mountingElevationMm **0**.
- **Attribution:** `Washing Machine (new) by nikita.bulgakov (CC-BY) — sketchfab.com/3d-models/washing-machine-new-82c91049303f4664a56cc0eaffa8d662`
- Temp artifacts καθαρά. **Tooling tip:** gltf-transform CLI latest θέλει node≥22· χρησιμοποίησε `@gltf-transform/cli@3.10.1` (node 20). Για scale-normalize (δεν υπάρχει CLI scale) → isolated temp `npm i --silent @gltf-transform/core@3.10.1 @gltf-transform/functions@3.10.1 meshoptimizer@0.20.0` + node script (wrap scene roots σε parent node, setScale, recenter). ⚠️ ο converter `mesh-to-object3d.ts` **υποθέτει glTF σε ΜΕΤΡΑ** (anchor=bbox `min.y`· ΟΧΙ fit-to-dims) → το glb ΠΡΕΠΕΙ να είναι real-world scale.

## 🎯 ΑΡΧΙΤΕΚΤΟΝΙΚΕΣ ΑΠΟΦΑΣΕΙΣ (εγκεκριμένες από Giorgio μέσω plan)
1. **ΟΧΙ νέο entity type** — νέο **`kind` του `mep-fixture`** (παίρνει connectors/placement/renderer/bounds/hit-test/persistence/selection/copy ΔΩΡΕΑΝ). Νέο entity θα ήταν 60 αρχεία· νέο kind = ~14.
2. **Διακριτή «οικογένεια Appliance», ΟΧΙ sanitary** — όχι μέσα στο `SANITARY_KINDS` (θα έλεγε ψέματα το `isSanitaryKind` + θα έμπαινε στα «Είδη Υγιεινής»). Νέο `APPLIANCE_KINDS` + unifying `isPlumbingFixtureKind = isSanitaryKind || isApplianceKind`.
3. **Connectors:** cold inlet (`domestic-cold-water`, flow `in`, DN15) + drain outlet (`sanitary-drainage`, flow `out`, DN50). **Cold-only** (σύγχρονο/EU). Reuse generic builders.
4. **UI:** νέα ribbon ομάδα **«Συσκευές»** (όχι «Είδη Υγιεινής»), κουμπί «Πλυντήριο».
5. **BimCategory:** reuse `'sanitary'` (αποφυγή νέας-BimCategory cascade). **IFC:** `IfcElectricAppliance` (νέο). **Mesh category folder:** `'appliance'`.
6. **BOQ:** deferred (κανένα mep-fixture δεν τροφοδοτεί BOQ σήμερα — ξεχωριστό task για ΟΛΑ τα fixtures).

## ⚠️ ΚΑΝΟΝΕΣ
- 🌐 Ελληνικά. 🚫 COMMIT/PUSH μόνο Giorgio. 🌳 SHARED tree → `git add` ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`.
- **ΕΚΤΟΣ ADR-040** (mep-fixture renderer getState-at-draw). N.17: ΕΝΑ tsc τη φορά (έλεγχος `wmic process where "name='node.exe'" get commandline | grep tsc` πριν).
- N.11: μηδέν hardcoded strings (i18n keys). N.2: μηδέν `any`.

## 📋 CODE SLICES (exact touch-points από 3 Explore agents — code = source of truth, επαλήθευσε)

### Slice 1 — SSoT οικογένεια Appliance
- **NEW `bim/appliances/appliance-symbol-spec.ts`** — mirror `bim/sanitary/sanitary-symbol-spec.ts`:
  `APPLIANCE_KINDS=['washing-machine'] as const`, `ApplianceKind`, `isApplianceKind`,
  `applianceFixtureToolKind(toolId)` (mep-${kind}), `APPLIANCE_SPEC: Record<ApplianceKind, SanitaryFixtureSpec>`
  (reuse type· washing-machine: 597/587/drain50/supply{cold:true,hot:false,dia15}/labelKey
  `'mepFixture.appliance.washingMachine'`), `APPLIANCE_DRAWERS` (απλό 2D footprint: rect + κύκλος πόρτας + control panel).
- **NEW `bim/mep-fixtures/plumbing-fixture-spec.ts`** — unifying SSoT: `PlumbingFixtureKind=SanitaryKind|ApplianceKind`,
  `isPlumbingFixtureKind`, `resolvePlumbingFixtureSpec(kind)` (dispatch APPLIANCE_SPEC/SANITARY_SPEC),
  `resolvePlumbingFixtureDrawer(kind)`, `plumbingFixtureToolKind(toolId)` (sanitary ?? appliance). (Προσοχή cycles: appliance imports type-only από sanitary· plumbing imports και τα δύο· κανένα cycle.)
- **MOD `bim/types/mep-fixture-types.ts`:** `MepFixtureKind += ApplianceKind`· `MepFixtureIfcType += 'IfcElectricAppliance'`·
  `resolveFixtureIfcType` (isApplianceKind→IfcElectricAppliance)· `resolveFixtureBimCategory` (isApplianceKind→'sanitary')·
  `resolveFixtureMeshCategory` (isApplianceKind→'appliance'). Import isApplianceKind/ApplianceKind.
- **MOD `bim/types/mep-fixture.schemas.ts`:** `MepFixtureKindSchema` += `'washing-machine'`· `MepFixtureIfcTypeSchema` += `'IfcElectricAppliance'` (αλλιώς silent Zod drop στο load).

### Slice 2 — Connectors + placement
- **MOD `bim/mep-fixtures/sanitary-fixture-connectors.ts`:** το `buildSanitaryFixtureConnectors(kind, sceneUnits)`
  διάβαζε `SANITARY_SPEC[kind]` → άλλαξε σε `resolvePlumbingFixtureSpec(kind)` + param type `PlumbingFixtureKind`
  (το hot:false δίνει αυτόματα cold+drain). (Ή rename σε `buildPlumbingFixtureConnectors` + update callers — διάλεξε.)
- **MOD `bim/mep-systems/mep-connector-seed.ts`:** το `isSanitaryKind` branch → `isPlumbingFixtureKind` (καλεί τον ίδιο builder). [διάβασε το αρχείο]
- **MOD `hooks/drawing/mep-fixture-completion.ts`** `resolveFixtureKindDefaults` (~line 117): `isSanitaryKind` branch → `isPlumbingFixtureKind`, dims από `resolvePlumbingFixtureSpec`. [διάβασε]
- **MOD `bim-3d/converters/mep-fixture-to-mesh.ts`** `resolveFixtureMeshRouting`: appliance → category `'appliance'`, anchor `'base'`, heightMm από appliance catalog preset (NEW resolveApplianceFixtureAsset).
- **Tool registration:** `ui/toolbar/types.ts` (`ToolType += 'mep-washing-machine'`)· `systems/tools/tool-definitions.ts` (entry: category 'drawing', requiresCanvas, canInterrupt, allowsContinuous)· `hooks/tools/useSpecialTools-placement-tools.ts` (~line 83-99: `plumbingFixtureToolKind` αντί sanitary, ώστε το `isMepFixtureTool` + setParamOverrides({kind}) να πιάνει το appliance)· `hooks/canvas/useCanvasClickHandler.ts` (~line 306-313: routing — γενίκευση sanitary→plumbing).

### Slice 3 — UI: ribbon group + contextual tab + 3D mesh picker
- **NEW `bim/mep-fixtures/appliance-fixture-mesh-catalog.ts`** — mirror `sanitary-fixture-mesh-catalog.ts`:
  `APPLIANCE_MESH_CATALOG` με entry `washing_machine_01` (kind 'washing-machine', 597/587/850, source CC-BY πάνω),
  `resolveApplianceFixtureAsset`, `applianceMeshPresetsForKind`.
- **MOD `ui/ribbon/hooks/useRibbonMepFixtureBridge.ts`:** το `getComboboxState(assetId)` (μόλις φτιάχτηκε v1.5)
  αντικατέστησε το `sanitaryMeshPresetsForKind(kind)` με dispatcher `fixtureMeshPresetsForKind(kind)`
  (sanitary→sanitary catalog, appliance→appliance catalog). Επίσης delete-confirm label branch για appliance.
- **MOD `ui/ribbon/data/home-tab-draw.ts`** (~line 661-708 «Είδη Υγιεινής»): πρόσθεσε ΞΕΧΩΡΙΣΤΟ split-button/group
  **«Συσκευές»** με leaf «Πλυντήριο» (commandKey `mep-washing-machine`).
- **MOD `app/ribbon-contextual-config.ts`** (~line 283-302 `resolveContextualTrigger`): branch appliance →
  NEW `MEP_APPLIANCE_FIXTURE_CONTEXTUAL_TRIGGER` (ΠΡΙΝ το isSanitaryKind)· register στο `RIBBON_CONTEXTUAL_TABS`.
- **NEW `ui/ribbon/data/contextual-mep-appliance-fixture-tab.ts`** — thin copy του `contextual-mep-sanitary-fixture-tab.ts`
  (ίδια `MEP_FIXTURE_RIBBON_KEYS` → reuse `useRibbonMepFixtureBridge` πλήρως), label «Ιδιότητες Συσκευής», 3D picker panel (parametric-only static fallback· τα appliance presets έρχονται από bridge).

### Slice 4 — i18n + tests + N.15
- **i18n el/en `dxf-viewer-shell.json`:** `mepFixture.appliance.washingMachine` («Πλυντήριο»/«Washing Machine»),
  `mepFixture.catalog.washingMachine01` («Πλυντήριο (3Δ)»/«Washing Machine (3D)»), ribbon group/tab/tool labels («Συσκευές»/«Appliances», «Ιδιότητες Συσκευής»).
- **MOD `bim/licensing/asset-credits.ts`:** aggregator να διαβάζει ΚΑΙ το `APPLIANCE_MESH_CATALOG` (CC-BY attribution washing machine).
- **Tests (4-5 suites):** appliance-symbol-spec· plumbing-fixture-spec (dispatch)· connector seed (washing-machine→cold+drain, DN/classification/flow)· mep-fixture-to-mesh appliance routing (category 'appliance', base)· resolveFixtureIfcType=IfcElectricAppliance· bridge appliance per-kind picker· appliance mesh catalog.
- **N.15:** `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + **ADR-408 changelog** (νέο appliance family + washing machine connectable) + memory `[[project_adr411_shower_mesh_credits]]`/νέο. ⚠️ Σκέψου αν χρειάζεται ξεχωριστό **ADR-423** για «Appliance family» (ADR workflow PHASE 3· next free ADR ~423).

## ✅ DEFINITION OF DONE
1. Ribbon «Συσκευές»→«Πλυντήριο»→click → 2D footprint + 3D mesh (105k, ομαλό).
2. Επιλογή → tab «Ιδιότητες Συσκευής» + 3D picker δείχνει «Πλυντήριο (3Δ)».
3. Τράβα σωλήνα ύδρευσης → κουμπώνει στον cold connector· σωλήνα αποχέτευσης → στον drain.
4. tsc 0 (δικά σου) · tests πράσινα.
5. 🔴 browser-verify (Giorgio) + commit (Giorgio).

## 📌 SSOT POINTERS
- Sanitary template (mirror): `bim/sanitary/sanitary-symbol-spec.ts` · `sanitary-fixture-connectors.ts` · `sanitary-fixture-mesh-catalog.ts` · `ui/ribbon/data/contextual-mep-sanitary-fixture-tab.ts`.
- Connectors SSoT: `bim/types/mep-connector-types.ts` (`buildSanitaryColdWaterConnector`/`buildSanitaryDrainConnector`, `PlumbingSystemClassification`).
- Mesh converter: `bim-3d/converters/mep-fixture-to-mesh.ts` + `mesh-to-object3d.ts` (anchor base=bbox min.y).
- Credits: `bim/licensing/asset-credits.ts`. Sketchfab token: `4f345c0954ac49178a955ed13acdd300`.
