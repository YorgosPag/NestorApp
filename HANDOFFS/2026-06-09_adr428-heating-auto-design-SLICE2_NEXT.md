# 🧠 HANDOFF — ADR-428 Heating (Hydronic) Auto-Design **Slice 2** (preview + commit): PLAN MODE → υλοποίηση

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** το **Slice 2** της 3ης discipline (Θέρμανση, child ADR-423). Το **Slice 1 (headless engine) είναι ΗΔΗ DONE** (βλ. §0). Τώρα υλοποιείς το **preview + commit** layer — Revit «Generate → review → accept»: ribbon **«Αυτόματη Θέρμανση»** → ghost στον καμβά (supply κόκκινο / return μπλε) → atomic `CompoundCommand`. **ΕΝΤΟΣ ADR-040** (ghost mount = canvas leaf).
>
> **Η μεγάλη ιδέα (FULL SSOT):** το Slice 2 της θέρμανσης είναι **κλώνος 1:1 του water Slice 2** (ADR-426), ΟΧΙ του drainage. Λόγος: η θέρμανση έχει **2 networks** (supply+return) σε **flat elevation** (χωρίς slope) — ακριβώς όπως cold/hot της ύδρευσης. Το μόνο που δανείζεται από το drainage είναι ο **SSoT τρόπος χρωματισμού του ghost** (`resolveSegmentClassificationColor`, ΟΧΙ hardcoded hex όπως το water tech debt). Τα heating types του Slice 1 (`ProposedHeatingNetwork`) έχουν ΗΔΗ `sourceEntityId/sourceConnectorId/sourceElevationMm/servedConnectors/classification` → ταιριάζουν 1:1 με το `buildWaterSupplyCommit`.

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / η Revit / MagiCAD / 4M FINE»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ., semantic HTML, no inline styles.
- **SHARED working tree** με άλλον agent (codex). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. ⚠️ **ΚΡΙΣΙΜΟ ΓΙΑ ΤΟ SLICE 2:** πολλά MOD αρχεία είναι **shared** και ο codex τα πειράζει ΤΩΡΑ (βλ. §4 «shared-tree danger list»).
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push. **ΜΗΝ αγγίξεις adr-index**.
- **Plan Mode πρώτα.** Πάρε ΕΣΥ τις Revit/SSOT αποφάσεις· ζήτα μόνο έγκριση plan + slicing.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος (ο codex τρέχει συχνά). PowerShell: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -like '*tsc*' }`. Αν τρέχει → ΠΕΡΙΜΕΝΕ, μην τον σκοτώσεις.
- **N.11 i18n:** Slice 2 ΕΧΕΙ UI strings → **ΠΡΩΤΑ** keys σε `src/i18n/locales/el/dxf-viewer-shell.json` **ΚΑΙ** `en/dxf-viewer-shell.json`, μετά `t('key')`. ⚠️ αυτό το αρχείο είναι shared (codex) — πρόσθεσε ΜΟΝΟ τα δικά σου keys, μην ξαναγράψεις όλο το αρχείο.
- **N.15:** μετά υλοποίηση → ADR-428 changelog (Slice 2 entry) + ADR-423 changelog + μνήμη `[[project_adr428_heating_auto_design]]` + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ο Giorgio committάρει).
- **ADR-040:** Slice 2 αγγίζει **canvas leaf** (ghost mount) → **CHECK 6B/6D BLOCK** αν δεν κάνεις STAGE ADR doc. **STAGE ADR-428** (ή ADR-040) μαζί με την αλλαγή στο `canvas-layer-stack-leaves.tsx`. Ο proposal-store είναι **LOW-FREQUENCY** (set on Generate, reset on Accept/Reject — ΚΑΜΙΑ per-frame γραφή· CHECK 6C-safe: το shell ΔΕΝ subscribe-άρει, μόνο το leaf).

---

## 0) ΚΑΤΑΣΤΑΣΗ — SLICE 1 ΕΙΝΑΙ DONE (reuse, μην το ξαναχτίσεις)

**🟢 ADR-428 Slice 1 (headless engine)** — `systems/mep-design/heating/` (DONE 2026-06-09, 12 tests + regression PASS, tsc clean):
- `design-heating.ts` → `designHeating(model, entities, discipline?)` → **`HeatingNetworkProposal { networks: [supply, return], warnings, storeyId }`**. ⚠️ Υπογραφή: **(model, entities)** — ΔΕΝ παίρνει sceneUnits 3ο arg (αντίθετα με `designDrainage`). Το sceneUnits το χρειάζεσαι ΞΕΧΩΡΙΣΤΑ (από `resolveSceneUnits(scene)`) για το ghost (mm→canvas) και το commit (segment build) → βάλ' το στο `HeatingProposalReview` όπως water/drainage.
- `heating-design-types.ts`: `ProposedHeatingNetwork` έχει **`role:'supply'|'return'`, `classification` ('hydronic-supply'|'hydronic-return'), `sourceEntityId`, `sourceConnectorId`, `sourcePoint`, `sourceElevationMm`, `segments`, `servedConnectors`, `totalFlowLps`**. `ProposedHeatingSegment` έχει **`start`, `end`, `networkRole`, `classification`, `diameterMm`, `cumulativeFlowLps`, `role:'trunk'|'branch'`** — **ΟΧΙ slope** (closed loop).
- `index.ts` barrel — θα του προσθέσεις exports (store + commit).
- Recognizer/registry/discipline όλα active. Όλα τα heating primitives υπάρχουν (ADR-408 Εύρος Β + ADR-422 L2).

**🟢 WATER Slice 2 = ΤΟ ΠΡΟΤΥΠΟ 1:1** (διάβασέ τα ΟΛΑ — κλωνοποίησέ τα):
- `systems/mep-design/water/water-proposal-store.ts` — low-freq store (`WaterProposalReview {proposal, sceneUnits}`, `set/reset/get`, `useWaterProposal`).
- `systems/mep-design/water/commit/build-water-supply-commit.ts` — pure `buildWaterSupplyCommit(proposal, layerId, sceneUnits, resolveName)`: **flat elevation = `network.sourceElevationMm`** (και τα δύο endpoints), `completeMepSegmentFromTwoClicks(start,end,layerId,'pipe',{classification,diameter},sceneUnits,elev,elev)`, MepSystem με source=`sourceEntityId/sourceConnectorId`, members = `segments.flatMap(pipeSegmentMembers) ∪ servedConnectors`. **Heating = ΑΥΤΟ ΑΚΡΙΒΩΣ** (ΟΧΙ slope — ήδη flat).
- `hooks/tools/useWaterProposalGhostPreview.ts` — ghost leaf (2 networks cold/hot). ⚠️ Έχει **hardcoded HOT_/COLD_STROKE** (tech debt) → ΕΣΥ ΜΗΝ το αντιγράψεις· χρησιμοποίησε SSoT (κάτω).
- `components/dxf-layout/canvas-layer-stack-*-proposal-ghost.tsx` — micro-leaf mount (`React.memo`, returns null).
- `ui/ribbon/hooks/bridge/water-supply-command-keys.ts` (`WATER_SUPPLY_RIBBON_ACTIONS` + `isWaterSupplyActionKey`).
- `ui/ribbon/hooks/useRibbonWaterAutoSupplyBridge.ts` — Generate/Accept/Reject bridge.

**🟢 DRAINAGE Slice 2 = ΔΑΝΕΙΖΕΣΑΙ ΜΟΝΟ ΤΟΝ SSoT ΧΡΩΜΑΤΙΣΜΟ:**
- `hooks/tools/useDrainageProposalGhostPreview.ts` — χρησιμοποιεί `resolveSegmentClassificationColor(classification)` + `hexToRgba(stroke, 0.22)` αντί για hardcoded hex. **Αυτό το pattern υιοθετείς** (αλλά **per-segment**, γιατί η θέρμανση έχει 2 classifications).
- `systems/mep-design/drainage/commit/build-drainage-commit.ts` + `drainage-proposal-store.ts` + `useRibbonDrainageAutoBridge.ts` — δευτερεύον πρότυπο.

**🟢 SSoT χρώματα ΗΔΗ ορισμένα** — `bim/mep-systems/mep-system-color.ts`:
- `classificationDefaultColor('hydronic-supply')` → `#dc2626` (κόκκινο), `'hydronic-return'` → `#2563eb` (μπλε). `resolveSegmentClassificationColor(c)` + `hexToRgba(stroke, alpha)`. **Μηδέν νέο χρώμα, μηδέν hardcoded hex.**

---

## 1) ΤΙ ΘΑ ΦΤΙΑΞΕΙΣ (Slice 2 = preview + commit)

**ΑΡΧΙΤΕΚΤΟΝΙΚΗ:** `ribbon «Αυτόματη Θέρμανση»` → **Generate** (recognize storey + `designHeating` → low-freq `heatingProposalStore.set`) → **ghost** (supply κόκκινο / return μπλε, per-segment SSoT color) → **Accept** (`buildHeatingCommit` → ΕΝΑ `CompoundCommand`[`CreateMepSegmentsCommand` + per-network `CreateMepSystemCommand`]) → auto-fitting reconciler μεγαλώνει elbows/tees. **Reject** → `reset`.

**NEW αρχεία (δικά σου — git add ΜΟΝΟ αυτά):**
| Αρχείο | Πρότυπο (κλώνος) |
|---|---|
| `systems/mep-design/heating/heating-proposal-store.ts` | `water-proposal-store.ts` 1:1 → `HeatingProposalReview {proposal, sceneUnits}`, `heatingProposalStore` set/reset/get, `useHeatingProposal()`. ⚠️ ADR-040 header comment (low-freq). |
| `systems/mep-design/heating/commit/build-heating-commit.ts` | `build-water-supply-commit.ts` 1:1 → `buildHeatingCommit(proposal, layerId, sceneUnits, resolveName)`. Flat elevation = `network.sourceElevationMm`. `{classification, diameter}` (ΟΧΙ slopePercent). `resolveName(network,i)` ανά `network.role`. |
| `systems/mep-design/heating/commit/build-heating-commit.test.ts` | `drainage/__tests__/build-drainage-commit.test.ts` → 2 networks supply+return, flat z, members=endpoints∪servedConnectors, source=boiler, skip-on-invalid. |
| `hooks/tools/useHeatingProposalGhostPreview.ts` | drainage ghost (SSoT color) ΑΛΛΑ **per-segment**: `resolveSegmentClassificationColor(seg.classification)` → supply κόκκινο / return μπλε· `hexToRgba(stroke, 0.22)` fill· `seg.diameterMm * mmScale` width. ΟΧΙ hardcoded hex. ADR-040 header. |
| `components/dxf-layout/canvas-layer-stack-heating-proposal-ghost.tsx` | `canvas-layer-stack-drainage-proposal-ghost.tsx` → `HeatingProposalGhostPreviewMount` (`React.memo`, returns null). ADR-040 header. |
| `ui/ribbon/hooks/bridge/heating-auto-command-keys.ts` | `drainage-auto-command-keys.ts` → `HEATING_AUTO_RIBBON_ACTIONS {generate,accept,reject}` (`heatingAuto.actions.*`) + `isHeatingAutoActionKey`. |
| `ui/ribbon/hooks/useRibbonHeatingAutoBridge.ts` | `useRibbonDrainageAutoBridge.ts` ΑΛΛΑ **`designHeating(model, entities)`** (ΟΧΙ sceneUnits 3ο arg)· EventBus `bim:heating-generated/empty/committed`· resolveName ανά role. |

**MOD shared (additive, ΜΟΝΟ δικές σου γραμμές — ⚠️ ΟΛΑ shared με codex):**
- `systems/mep-design/heating/index.ts` — export store + commit + νέοι τύποι.
- `components/dxf-layout/canvas-layer-stack-leaves.tsx` — mount `<HeatingProposalGhostPreviewMount …>`. **⚠️ STAGE ADR-428/ADR-040 (CHECK 6B/6D BLOCK).**
- `ui/ribbon/data/home-tab-draw.ts` — submenu «Αυτόματη Θέρμανση» (Generate/Accept/Reject, commandKeys από τον registry).
- `ui/ribbon/hooks/useRibbonCommands.ts` + `useRibbonCommands-types.ts` — compose `useRibbonHeatingAutoBridge` + route μέσω `isHeatingAutoActionKey`.
- `app/useDxfBimBridges.ts` — instantiate `useRibbonHeatingAutoBridge({levelManager})`.
- `app/useDxfViewerRibbon.ts` — wire onAction.
- `hooks/.../useDxfViewerNotifications.*` — 3 toasts (heating-generated/empty/committed).
- `systems/events/drawing-event-map.ts` (ή όπου ορίζονται τα EventBus payloads) — `bim:heating-generated`/`bim:heating-empty`/`bim:heating-committed`.
- `src/i18n/locales/el/dxf-viewer-shell.json` + `en/dxf-viewer-shell.json` — ribbon labels + `ribbon.commands.heating.supplyName`/`returnName` + 3 toasts. ⚠️ shared — πρόσθεσε ΜΟΝΟ τα δικά σου keys.

---

## 2) ΟΙ ΑΠΟΦΑΣΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΠΑΡΕΙΣ ΣΤΟ PLAN MODE (πάρ' τες ΕΣΥ, Revit-grade)
1. **Naming των 2 MepSystems:** supply = «Θέρμανση Προσαγωγή», return = «Θέρμανση Επιστροφή» (2 i18n keys, resolve ανά `network.role`). Revit «System Type».
2. **Ghost χρώμα:** per-segment SSoT `resolveSegmentClassificationColor(seg.classification)` (supply κόκκινο / return μπλε). ΟΧΙ network-level (όπως water) — αλλά και τα δύο networks έχουν ομοιόμορφο classification, οπότε per-segment = per-network de facto. Διάλεξε per-segment (πιο γενικό, μηδέν branch).
3. **Empty handling:** αν `proposal.networks.length === 0` → `reset` + toast (διάκρισε «κανένας λέβητας» vs «κανένα σώμα» από `warnings`).
4. **Accept atomicity:** ΕΝΑ `CompoundCommand('Generate heating', [CreateMepSegmentsCommand, ...CreateMepSystemCommand×2])` → single undo (όπως drainage).
5. **Overlap supply/return ghost:** τα δύο networks μπορεί να συμπίπτουν γεωμετρικά (ίδια διαδρομή). v1 → ζωγράφισέ τα και τα δύο (offset pairing = Slice 3). Δήλωσέ το deferred.

---

## 3) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗ γράψεις κώδικα πριν την έγκριση του plan.
- ΜΗΝ αγγίξεις το Slice 1 engine (`design-heating.ts` κ.λπ.) — κράτα 12 heating tests πράσινα.
- ΜΗΝ αντιγράψεις το **hardcoded hex** του water ghost — χρησιμοποίησε SSoT `resolveSegmentClassificationColor`.
- ΜΗΝ βάλεις slope (closed loop, flat at source elevation).
- ΜΗΝ `git add -A`. ΜΗΝ commit/push/adr-index. ΜΗΝ `--no-verify`. ΜΗΝ 2ο tsc (N.17).
- ΜΗΝ ξαναγράψεις ολόκληρα τα shared αρχεία (i18n, useRibbonCommands, canvas-layer-stack-leaves) — additive edits ΜΟΝΟ.

## 4) ⚠️ SHARED-TREE DANGER LIST (ο codex πειράζει ΤΩΡΑ)
Στο τελευταίο `git status` ο codex είχε modified: `MepBoilerRenderer.ts`, `useRibbonThermalSpaceBridge.ts`, `thermal-space-command-keys.ts`, `contextual-thermal-space-tab.ts`, `mep-boiler-symbol.ts`, thermal/heat-load αρχεία, **`i18n/locales/*/dxf-viewer-shell.json`**, ADR-408/422 docs. **ΠΟΛΛΑ από τα MOD σου (§1) είναι τα ΙΔΙΑ αρχεία** (i18n, ribbon). **ΠΡΙΝ** edit-άρεις shared αρχείο → `git diff <file>` να δεις τι έχει αλλάξει ο codex· κάνε **μικρά, στοχευμένα** edits· `git add` ΜΟΝΟ το συγκεκριμένο αρχείο και ΜΟΝΟ αν είναι δικό σου change. Αν δεις conflict-prone αλλαγή → ρώτα τον Giorgio.

## 5) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus)
1. Διάβασε αυτό το handoff + μνήμη `[[project_adr428_heating_auto_design]]` (Slice 1) + ADR-428 doc + ADR-040 (preview contract).
2. Διάβασε ΟΛΑ τα water Slice 2 αρχεία (§0) + το drainage ghost (SSoT color) + `mep-system-color.ts`.
3. Επιβεβαίωσε signatures: `designHeating(model, entities)` (ΟΧΙ sceneUnits), `completeMepSegmentFromTwoClicks`, `buildDefaultPipeNetworkParams`, `pipeSegmentMembers`, `CreateMepSegmentsCommand`/`CreateMepSystemCommand`/`CompoundCommand`, `resolveSegmentClassificationColor`/`hexToRgba`, `MepSegmentGhostRenderer`, ο τρόπος που mount-άρονται τα ghost leaves στο `canvas-layer-stack-leaves.tsx` + composing στο `useRibbonCommands`.
4. **Plan Mode** → plan (7 NEW + ~9 additive shared MOD· naming· per-segment SSoT color· atomic accept· ΕΝΤΟΣ ADR-040 STAGE) + ζήτα έγκριση.
5. Μετά έγκριση → υλοποίηση → i18n keys ΠΡΩΤΑ → `npx jest "systems/mep-design/heating"` (νέο commit test + 12 παλιά) + regression water/drainage. tsc background (N.17 guard). N.15 updates.

## 6) ΜΕΤΑ ΑΠΟ ΑΥΤΟ
- **Heating Slice 3** = true parallel supply/return pairing (offset runs) — κοινό με A* wall-aware router.
- Επόμενη discipline (ADR-423 §6): **Ηλεκτρολογικά ΙΣΧΥΡΑ** (4η).
