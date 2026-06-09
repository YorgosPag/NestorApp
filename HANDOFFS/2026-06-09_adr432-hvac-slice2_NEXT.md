# 🧠 HANDOFF — ADR-432 HVAC Auto-Design **Slice 2** (preview/commit + ribbon): υλοποίηση

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** ΜΟΝΟ το **Slice 2 του HVAC** — το «Generate → review → accept» layer που κάνει τη μηχανή HVAC (ήδη έτοιμη, headless) **ορατή & χρησιμοποιήσιμη**: ribbon «Αυτόματος Αερισμός» → ghost preview αεραγωγών → commit σε πραγματικούς duct `mep-segment` + `duct-network` `MepSystem`. **FULL ENTERPRISE + FULL SSOT, όπως Revit / MagiCAD / 4M FINE.** Κλείνει το ADR-432.

---

## ⚠️ ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ — ΔΙΑΒΑΣΕ ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
1. **Μνήμη:** `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr432_hvac_auto_design.md` (πλήρης κατάσταση Slices 0a/0b/1 + όλα τα αρχεία).
2. **Code = SoT — διάβασε ΟΛΟΚΛΗΡΟ το Slice 2 του water ως ΠΡΟΤΥΠΟ** (το HVAC = πιστό mirror):
   - `systems/mep-design/water/water-proposal-store.ts` (low-freq store, ADR-040)
   - `systems/mep-design/water/commit/build-water-supply-commit.ts` (pure commit builder)
   - `hooks/tools/useWaterProposalGhostPreview.ts` (ghost preview hook, ADR-040)
   - `components/dxf-layout/canvas-layer-stack-water-proposal-ghost.tsx` (leaf mount)
   - `ui/ribbon/hooks/useRibbonWaterAutoSupplyBridge.ts` (Generate/Accept/Reject bridge)
   - `ui/ribbon/hooks/bridge/water-auto-supply-command-keys.ts` (action keys + isXActionKey guard)
3. **Δικά μου Slice-1 outputs που θα καταναλώσει το Slice 2** (ΗΔΗ έτοιμα):
   - `systems/mep-design/hvac/design-hvac.ts` → `designHvac(model, entities): DuctNetworkProposal`
   - `systems/mep-design/hvac/hvac-design-types.ts` → `ProposedDuctNetwork`/`ProposedDuctSegment`/`DuctNetworkProposal` (service='supply', classification='supply-air')
   - `systems/mep-design/hvac/index.ts` (barrel)

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT «όπως Revit»** — μηδέν `any`/`as any`/`@ts-ignore`· αρχεία ≤500 γρ.· functions ≤40 γρ.· ΠΑΝΤΑ Grep/Glob για υπάρχον πριν γράψεις (reuse/mirror, ΜΗΝ duplicate). Μηδέν hardcoded χρώματα/strings — χρησιμοποίησε SSoT (`resolveSegmentClassificationColor`/`ductClassificationDefaultColor`).
- **SHARED working tree με άλλον agent (codex).** `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. **ΠΑΝΤΑ `git status` + `git diff <file>` πριν αγγίξεις shared αρχείο** (ribbon integration = κοινά αρχεία με codex).
- **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push, ΟΥΤΕ `--no-verify`. **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **N.11 i18n:** ΚΑΘΕ νέο user-facing string → ΠΡΩΤΑ key σε `src/i18n/locales/el/dxf-viewer-shell.json` ΚΑΙ `en/...`. ΟΧΙ hardcoded.
- **ADR-040:** Slice 2 ghost = leaf στο `canvas-layer-stack-leaves.tsx` → **STAGE το ADR-040** (`docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md`) στο ίδιο commit (CHECK 6B/6D μπλοκάρουν αλλιώς). Ο proposal-store + ghost hook έχουν ⚠️ ADR-040 header (όπως οι water).
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε με `powershell -File`/`Get-CimInstance Win32_Process` ότι δεν τρέχει άλλος tsc· τρέξε ΕΝΑΝ στο background, ΜΗΝ μπλοκάρεις. Ο Bash tool = /usr/bin/bash (ΟΧΙ PowerShell).
- **N.14 Model:** Opus (cross-cutting· αγγίζει shared ribbon).
- **N.15 (στο ΤΕΛΟΣ, ίδιο commit):** ADR-432 NEW doc + ADR-423 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + `MEMORY.md`/`project_adr432_hvac_auto_design.md`. **ΜΗΝ adr-index** (shared).

---

## 🔑 ΚΡΙΣΙΜΑ ΤΕΧΝΙΚΑ ΣΗΜΕΙΑ (μη τα χάσεις)
1. **Ο duct `mep-segment` ΔΕΝ κρατά classification** (το `classification` είναι pipe-only στο `mep-segment-types.ts`). Το **MepSystem owns** το classification (`buildDefaultDuctNetworkParams(..., 'supply-air', ...)`). Άρα:
   - **Commit segment:** `completeMepSegmentFromTwoClicks(seg.start, seg.end, layerId, 'duct', { sectionKind: 'round', diameter: seg.diameterMm }, sceneUnits, elevationMm, elevationMm)` — **ΕΠΑΛΗΘΕΥΣΕ το override type** του duct στο `hooks/drawing/mep-segment-completion.ts` (round → `{ sectionKind:'round', diameter }`· ΟΧΙ `classification` για duct). Σταθερό `elevationMm = network.sourceElevationMm` (Revit «Connect To», flat plenum datum — όπως water).
   - **MepSystem:** `buildDefaultDuctNetworkParams(name, 'supply-air', network.sourceEntityId, network.sourceConnectorId, members)` (ΗΔΗ υπάρχει στο `mep-system-types.ts`). members = `[...segments.flatMap(pipeSegmentMembers), ...network.servedConnectors]` (`pipeSegmentMembers` είναι domain-agnostic → δουλεύει για duct). color seed = `ductClassificationDefaultColor('supply-air')` (`#38bdf8`).
2. **Ghost χρώμα = SSoT, μηδέν hardcode:** στο `useHvacProposalGhostPreview` χρησιμοποίησε `resolveSegmentClassificationColor(seg.classification)` ή `ductClassificationDefaultColor('supply-air')` για το stroke· `domain: 'duct'` στο `MepSegmentGhostRenderer.render(...)` (το width = `seg.diameterMm * mmScale`).
3. **ΕΠΑΛΗΘΕΥΣΕ ότι τα commands δέχονται duct-network:** `CreateMepSegmentsCommand` (domain-agnostic ✓) + `CreateMepSystemCommand` + ο `mep-system-store`/Firestore service — το `systemType:'duct-network'` πέρασε ΗΔΗ στο zod (`mep-system.schemas.ts`), αλλά **τσέκαρε** αν κάποιο store/coordinator κάνει `if pipe/electrical` exhaustive (τα guards που είδα είναι if-checks → ασφαλή, αλλά επιβεβαίωσε στον `mep-system-coordinator`/`mep-system-store`/persistence).

---

## 📦 ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΦΤΙΑΞΕΙΣ/ΑΓΓΙΞΕΙΣ (mirror water Slice 2)

**ΝΕΑ (δικά σου — ασφαλή):**
- `systems/mep-design/hvac/hvac-proposal-store.ts` (mirror `water-proposal-store`· `HvacProposalReview { proposal: DuctNetworkProposal; sceneUnits }`· `hvacProposalStore` set/reset/get + `useHvacProposal()`· ⚠️ ADR-040 header)
- `systems/mep-design/hvac/commit/build-hvac-commit.ts` (mirror `build-water-supply-commit`· pure· `HvacCommitPlan { segmentEntities, systemEntities, skippedSegments }`· δες ΚΡΙΣΙΜΑ #1)
- `hooks/tools/useHvacProposalGhostPreview.ts` (mirror `useWaterProposalGhostPreview`· ⚠️ ADR-040 header· `domain:'duct'`· χρώμα SSoT #2)
- `components/dxf-layout/canvas-layer-stack-hvac-proposal-ghost.tsx` (mirror `canvas-layer-stack-water-proposal-ghost`· ⚠️ ADR-040 header· `HvacProposalGhostPreviewMount`)
- `ui/ribbon/hooks/useRibbonHvacAutoBridge.ts` (mirror `useRibbonWaterAutoSupplyBridge`· Generate=recognize+`designHvac`+store.set· Accept=`buildHvacCommit`+CompoundCommand· Reject=store.reset)
- `ui/ribbon/hooks/bridge/hvac-auto-command-keys.ts` (mirror `water-auto-supply-command-keys`· `HVAC_RIBBON_ACTIONS {generate,accept,reject}` keys `hvacAuto.actions.*` + `isHvacActionKey`)
- Tests: `systems/mep-design/hvac/commit/__tests__/build-hvac-commit.test.ts` (mirror `build-water-supply-commit.test` — duct segments + duct-network system + members + skipped). Προαιρετικά bridge test.

**SHARED (⚠️ git diff ΠΡΩΤΑ — κοινά με codex):**
- `components/dxf-layout/canvas-layer-stack-leaves.tsx` — import + render `<HvacProposalGhostPreviewMount transform=.../>` δίπλα στα Water/Drainage/Heating/Electrical mounts (~γραμμές 32-35 imports, 447-454 render). **STAGE ADR-040.**
- `ui/ribbon/hooks/useRibbonCommands.ts` + `useRibbonCommands-types.ts` — σύνδεσε το νέο bridge `onAction` + `isHvacActionKey` (μίμηση πώς συνδέεται το water/drainage bridge — grep `useRibbonWaterAutoSupplyBridge`/`isWaterSupplyActionKey`).
- `app/useDxfViewerRibbon.ts` + `app/useDxfBimBridges.ts` — instantiate/thread το `useRibbonHvacAutoBridge` (grep πώς γίνεται για water/drainage· **ΗΔΗ modified από codex** → git diff).
- `ui/ribbon/data/home-tab-draw.ts` — νέο submenu «Αυτόματος Αερισμός / HVAC» (action buttons Generate/Accept/Reject, `commandKey: 'hvacAuto.actions.generate'` κ.λπ., icon `bim-duct`) — mirror του «Αυτόματη Ύδρευση»/«Αυτόματος Ηλεκτρολογικός» submenu.
- `src/i18n/locales/el|en/dxf-viewer-shell.json` — keys: `ribbon.commands.bim.hvacAuto*.{label,tooltip}` (Generate/Accept/Reject) + `ribbon.commands.hvac.networkName`/`service.supply` (system display name) + όποια toast keys. **el ΚΑΙ en.**
- (προαιρετικό polish) EventBus events `bim:hvac-generated`/`-empty`/`-committed` + `useDxfViewerNotifications` toasts (mirror water).

**Προαιρετικό (cosmetic):** `RibbonMepCircuitPickerWidget` δείχνει «circuit» label για duct-network (μη-pipe). Κάν' το network-aware ΜΟΝΟ αν προλαβαίνεις — όχι blocker.

---

## ✅ DEFINITION OF DONE
- jest πράσινο (νέο build-hvac-commit test + zero regression σε όλα τα `mep-design` + `recognition` + `mep-fixture` suites).
- tsc --noEmit exit 0 (ΕΝΑΣ tsc, background, N.17).
- Browser smoke (αν ζητηθεί): τοποθέτησε ΚΚΜ + 2-3 στόμια → «Αυτόματος Αερισμός → Generate» → μπλε ghost αεραγωγών → Accept → πραγματικοί duct segments + 1 duct-network MepSystem (1 atomic undo).
- **N.15 docs** (ADR-432 NEW doc + ADR-423 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY.md). **ΜΗΝ adr-index.**
- Λίστα δικών σου αρχείων + context indicator (N.9) + Google-level declaration (N.7.2). **ΜΗΝ commit** — άσε τον Giorgio.

---

## 🧩 ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΚΛΗΡΟΝΟΜΕΙΣ (Slices 0a/0b/1 — DONE, tsc 0, mep-design 127/127)
- **duct-network domain:** `MepSystemType`+='duct-network'· `MepDuctSystemParams`+`isDuctSystemParams`+`buildDefaultDuctNetworkParams`· `DuctSystemClassification` +supply-air/return-air· `ductClassificationDefaultColor`+widened `resolveSegmentClassificationColor`· air connectors (`buildAirTerminalSupplyConnector` flow:in, `buildAhuSupplyAirConnector` flow:out).
- **fixture kinds:** `air-terminal` (στόμιο, Ø125) + `ahu` (ΚΚΜ, Ø250 plenum 2800mm) = mep-fixture kinds (ΟΧΙ standalone· **απόφαση που πήρα — ο Giorgio μπορεί να ζητήσει βαριά standalone AHU entity**). Πλήρης συρμάτωση + tool «Στόμιο Αέρα»/«ΚΚΜ» + air-terminal recognizer (flow-aware).
- **engine:** `designHvac` (reuse routeWallAware) + ASHRAE equal-friction duct sizing (pluggable) + constant 150 m³/h demand (pluggable) + connector-driven AHU source resolve. **Registry hvac→active.**
- v1 = **supply-air ΜΟΝΟ**. Return-air = επόμενο follow-up (όχι σε αυτό το Slice).
