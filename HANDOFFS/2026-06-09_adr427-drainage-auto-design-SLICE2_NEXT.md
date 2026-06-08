# 🧠 HANDOFF — ADR-427 Drainage Auto-Design **Slice 2** (preview + commit): PLAN MODE → υλοποίηση

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** υλοποίηση του **Slice 2** της αυτόματης αποχέτευσης = Revit «Generate → review → accept» στον καμβά (ribbon «Αυτόματη Αποχέτευση»). Το **Slice 1 (headless engine)** είναι **DONE** (22 tests πράσινα: 9 drainage + 13 water regression). **Αντιγράφεις 1:1 το ADR-426 water Slice 2** — όλη η υποδομή (proposal-store / ghost / batch command / bridge) υπάρχει ΗΔΗ ως πρότυπο· οι μόνες διαφορές είναι οι ιδιότητες αποχέτευσης (μία classification, κλίση, per-endpoint z, καφέ χρώμα).

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / η Revit / MagiCAD / 4M FINE»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ., semantic HTML, no inline styles.
- **SHARED working tree** με άλλον agent (codex). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push. **ΜΗΝ αγγίξεις adr-index** (shared tree — εκκρεμεί ήδη για 423/424/425/426/427).
- **Plan Mode πρώτα.** Πάρε ΕΣΥ τις Revit/SSOT αποφάσεις (μην ρωτάς τετριμμένα)· ζήτα μόνο έγκριση plan.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος. ⚠️ Ο process-check είναι σε PowerShell· αν το `Bash`-PowerShell είναι μπλοκαρισμένο, ζήτα από τον Giorgio να τρέξει `npx tsc --noEmit` (ή να επιβεβαιώσει ότι ο codex δεν τρέχει tsc).
- **N.11 i18n:** ribbon/toast strings → keys el+en ΠΡΩΤΑ (reuse υπάρχοντα labels όπου γίνεται).
- **N.15:** μετά υλοποίηση → ADR-427 changelog + ADR-423 changelog + μνήμη + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ο Giorgio committάρει).
- **ADR-040:** Slice 2 **ΑΓΓΙΖΕΙ** canvas (ghost mount) → **STAGE ADR-040** (CHECK 6B/6D) με το commit. Low-freq proposal store = CHECK 6C-safe (το shell ΔΕΝ subscribe-άρει· μόνο το leaf).

---

## 0) ΚΑΤΑΣΤΑΣΗ — ΤΙ ΕΙΝΑΙ ΗΔΗ ΕΤΟΙΜΟ (Slice 1, reuse)

**🟢 ADR-427 Slice 1 engine** (`systems/mep-design/drainage/`) — DONE 2026-06-09. Δίνει το **`DrainageNetworkProposal`** (pure data) που το Slice 2 μετατρέπει σε οντότητες:
- `designDrainage(model: RecognitionModel, entities, sceneUnits, discipline?)` → `DrainageNetworkProposal` (orchestrator· **ΠΡΟΣΟΧΗ: δέχεται `sceneUnits` 3ο όρισμα**, αντίθετα με το `designWaterSupply`).
- `DrainageNetworkProposal = { networks: ProposedDrainageNetwork[], warnings, storeyId }`.
- `ProposedDrainageNetwork = { classification:'sanitary-drainage', outfallEntityId, outfallConnectorId, outfallPoint, outfallInvertElevationMm, segments, servedTerminalIds, servedConnectors: MepSystemMember[], totalDU }`.
- `ProposedDrainageSegment = { start, end, classification, diameterMm, cumulativeDU, role, slopePercent, startElevationMm, endElevationMm }` — **έχει ΗΔΗ έτοιμα** το `slopePercent` + τα per-endpoint `startElevationMm`/`endElevationMm` (φθίνον z προς το φρεάτιο). Το commit builder απλώς τα περνάει.
- Barrel: `systems/mep-design/drainage/index.ts`.
- §A Γενίκευση DONE: shared `systems/mep-design/routing/orthogonal-router.ts` + `shared/connector-resolve.ts` + `registry/mep-discipline-registry.ts`.

**🟢 ADR-426 water Slice 2 = ΤΟ ΠΡΟΤΥΠΟ ΠΟΥ ΑΝΤΙΓΡΑΦΕΙΣ 1:1.** Αρχεία (διάβασέ τα ΟΛΑ):
- `systems/mep-design/water/water-proposal-store.ts` — low-freq store (`set`/`reset`/`get` + `useWaterProposal()`).
- `systems/mep-design/water/commit/build-water-supply-commit.ts` — **pure** `WaterNetworkProposal → {segmentEntities, systemEntities, skippedSegments}`.
- `core/commands/entity-commands/CreateMepSegmentsCommand.ts` — **batch segment create (1 undo)** — **GENERIC, REUSE ΑΥΤΟΥΣΙΟ** (δεν φτιάχνεις νέο).
- `core/commands/entity-commands/CreateMepSystemCommand.ts` — REUSE.
- `hooks/tools/useWaterProposalGhostPreview.ts` + `components/dxf-layout/canvas-layer-stack-water-proposal-ghost.tsx` — micro-leaf ghost (reuse `bim/mep-segments/MepSegmentGhostRenderer.ts` με `strokeOverride`/`fillOverride`).
- `ui/ribbon/hooks/useRibbonWaterAutoSupplyBridge.ts` + `ui/ribbon/hooks/bridge/water-auto-supply-command-keys.ts` — Generate/Accept/Reject bridge.

---

## 1) ΤΙ ΘΑ ΦΤΙΑΞΕΙΣ (Slice 2 = drainage mirror του water Slice 2)

**NEW αρχεία (δικά σου — git add ΜΟΝΟ αυτά):**

| Αρχείο | Ρόλος (mirror water) |
|---|---|
| `systems/mep-design/drainage/drainage-proposal-store.ts` | low-freq store (`set` on Generate, `reset` on Accept/Reject) + `useDrainageProposal()`. `DrainageProposalReview = { proposal, sceneUnits }`. **Αρχίζει με το ADR-040 header warning** (όπως το water store). |
| `systems/mep-design/drainage/commit/build-drainage-commit.ts` | **pure** `DrainageNetworkProposal → {segmentEntities, systemEntities, skippedSegments}`. Δες §2. |
| `hooks/tools/useDrainageProposalGhostPreview.ts` | ghost hook (mirror water· **καφέ** override). Δες §3. |
| `components/dxf-layout/canvas-layer-stack-drainage-proposal-ghost.tsx` | canvas leaf mount του ghost. |
| `ui/ribbon/hooks/useRibbonDrainageAutoBridge.ts` | Generate/Accept/Reject bridge. Δες §4. |
| `ui/ribbon/hooks/bridge/drainage-auto-command-keys.ts` | action keys (`DRAINAGE_AUTO_RIBBON_ACTIONS = {generate, accept, reject}`). |
| `systems/mep-design/drainage/__tests__/build-drainage-commit.test.ts` | commit builder tests (segment count, slope+z περνιούνται, 1 system, classification, members=endpoints∪servedConnectors). |

**MOD shared αρχεία (additive, ΜΟΝΟ δικές σου γραμμές — πρόσεξε concurrent edits):**
- `systems/mep-design/drainage/index.ts` — export τα νέα (store/commit).
- `components/dxf-layout/canvas-layer-stack-leaves.tsx` — mount το drainage ghost leaf (**STAGE ADR-040**).
- `ui/ribbon/data/home-tab-draw.ts` — κουμπί «Αυτόματη Αποχέτευση» (sibling του «Αυτόματη Ύδρευση»· ίδιο group αυτόματου σχεδιασμού).
- **`ui/ribbon/hooks/useRibbonCommands.ts`** — compose το νέο bridge (props + dispatch + deps). **🔴 ΚΡΙΣΙΜΟ: SHARED με codex/boiler agent — ΕΛΕΓΞΕ ΟΤΙ ΕΙΝΑΙ ΕΛΕΥΘΕΡΟ ΠΡΩΤΑ** (ρώτα τον Giorgio αν ο άλλος agent τελείωσε· το water Slice 2 + το ADR-422 L3-Apply περιμένουν κι αυτά αυτό το αρχείο). Αν είναι κατειλημμένο → κάνε ΟΛΑ τα υπόλοιπα, άσε ΜΟΝΟ αυτή τη γραμμή wiring τελευταία/σε καθαρό pass.
- `app/useDxfBimBridges.ts` — compose bridge (αν χρειάζεται, mirror water).
- `hooks/useDxfViewerNotifications.ts` — toasts (`bim:drainage-*` events → i18n μηνύματα).
- `systems/events/drawing-event-map.ts` — register events `bim:drainage-generated` / `bim:drainage-empty` / `bim:drainage-committed`.
- `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — keys ΠΡΩΤΑ («Αυτόματη Αποχέτευση», system name «Αποχέτευση», toasts). Reuse pattern `ribbon.commands.waterSupply.*` → `ribbon.commands.drainage.*`.

---

## 2) build-drainage-commit.ts (pure) — οι ΔΙΑΦΟΡΕΣ από το water

Per network: κάθε `ProposedDrainageSegment` → `completeMepSegmentFromTwoClicks(seg.start, seg.end, layerId, 'pipe', { classification: 'sanitary-drainage', diameter: seg.diameterMm, slopePercent: seg.slopePercent }, sceneUnits, seg.startElevationMm, seg.endElevationMm)`.
- **Per-endpoint z (descending) ΑΠΟ ΤΟ PROPOSAL** → περνιούνται ως 7ο/8ο όρισμα (start/end elevationMm). Επειδή είναι **διακριτά** υψόμετρα, το completion τα χρησιμοποιεί ως «real connected run» (μηδέν re-projection). Το `slopePercent` αποθηκεύεται ως instance metadata (params). **Verify στο test:** τα endpoints του committed segment έχουν φθίνον z + το `slopePercent` set.
- `MepSystem` (Revit «System Type» = Αποχέτευση): `buildDefaultPipeNetworkParams(name, 'sanitary-drainage', network.outfallEntityId, network.outfallConnectorId, members)` με `members = [...segments.flatMap(pipeSegmentMembers), ...network.servedConnectors]`. **Source = το φρεάτιο outlet** (outfallEntityId/outfallConnectorId) — αντί manifold/boiler.
- Skip-on-invalid (count), μην abort-άρεις όλο το network (όπως water).
- Fittings (φρεάτιο/elbows): **ΟΧΙ εδώ** — ο auto-reconciler τα φτιάχνει μόλις πέσουν τα segments.

---

## 3) Ghost (καφέ) — FULL SSOT, ΟΧΙ literal hex

Mirror `useWaterProposalGhostPreview.ts`, αλλά **μία** classification (όχι cold/hot split):
- Το χρώμα → **`resolveSegmentClassificationColor('sanitary-drainage')`** (SSoT καφέ, `config/bim-object-styles.ts` / `bim/mep-systems/mep-system-color.ts` — βρες τον ακριβή SSoT resolver που χρησιμοποιεί ο `MepSegmentRenderer` για drain-pipe). **ΜΗΝ** βάλεις hardcoded `#`-hex όπως το water (εκείνο είναι τεχνικό χρέος· εσύ κάν' το SSOT-καθαρό). Παράγαγε το fill ως ημιδιαφανή εκδοχή του stroke.
- `sectionWidthCanvas = seg.diameterMm * mmToSceneUnits(review.sceneUnits)`.
- Subscribe ΜΟΝΟ στο `useDrainageProposal()` (low-freq) — **ΟΧΙ** στον 60fps cursor (ADR-040). Repaint on proposal-change + `transform` (pan/zoom).

---

## 4) Bridge — οι ΔΙΑΦΟΡΕΣ από το water bridge

Mirror `useRibbonWaterAutoSupplyBridge.ts`:
- **Generate:** `recognizeSceneFromRegistry({entities, storeyId: levelId, sceneUnits})` (αφού `registerMepRecognition()`) → `designDrainage(model, entities, sceneUnits)` **(σωστό: 3ο όρισμα sceneUnits!)** → `drainageProposalStore.set({ proposal, sceneUnits })`. Αν `networks.length===0` → `reset()` + emit `bim:drainage-empty` ({reason: warnings? 'no-collector' : 'no-fixtures'}).
- **Accept:** `buildDrainageCommit(review.proposal, layerId, review.sceneUnits, resolveName)` → `CompoundCommand('Generate drainage', [ new CreateMepSegmentsCommand(segmentEntities, adapter), ...systemEntities.map(e => new CreateMepSystemCommand(e)) ])` → `executeCommand(...)` → `reset()` + emit `bim:drainage-committed`. Ένα atomic undo.
- **Reject:** `drainageProposalStore.reset()`.
- `resolveName` → i18n key `ribbon.commands.drainage.networkName` (π.χ. «Αποχέτευση {n}»). Μην βάλεις literal.

---

## 5) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗ γράψεις κώδικα πριν την έγκριση του plan.
- ΜΗΝ ξαναγγίξεις το Slice 1 engine (`systems/mep-design/drainage/*` εκτός store/commit/index) — κράτα τα 22 tests πράσινα.
- ΜΗΝ φτιάξεις νέο `CreateMepSegmentsCommand`/`CreateMepSystemCommand`/ghost renderer — **ΟΛΑ υπάρχουν, REUSE**.
- ΜΗΝ commit/push/adr-index. ΜΗΝ `git add -A`. ΜΗΝ `--no-verify`.
- ΜΗΝ τρέξεις 2ο tsc (N.17). ΜΗΝ persist-άρεις το proposal (transient).
- ΜΗΝ βάλεις literal χρώμα στο ghost (SSOT resolver) ούτε literal strings (i18n).

## 6) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus)
1. Διάβασε αυτό το handoff + ADR-427 doc (`docs/.../ADR-427-sanitary-drainage-auto-design.md`) + μνήμη [[project_adr427_drainage_auto_design]] [[project_adr426_water_supply_auto_design]].
2. Διάβασε ΟΛΑ τα water Slice 2 αρχεία (§0) — το πρότυπο.
3. Επιβεβαίωσε signatures: `completeMepSegmentFromTwoClicks` (overrides `{classification, diameter, slopePercent}` + 7ο/8ο per-endpoint elevation), `buildDefaultPipeNetworkParams`, `pipeSegmentMembers`, `CreateMepSegmentsCommand` ctor, `CreateMepSystemCommand`, `resolveSegmentClassificationColor`, `recognizeSceneFromRegistry`, `designDrainage(model, entities, sceneUnits)`.
4. **Plan Mode** → plan (7 NEW + ~8 MOD shared additive· ghost SSOT καφέ· isolation warning για `useRibbonCommands.ts`) + ζήτα έγκριση.
5. Μετά έγκριση → υλοποίηση → `npx jest "systems/mep-design/drainage"` (νέο commit test + τα 9 παλιά) + `npx jest "systems/mep-design/water"` (13 regression). tsc background (N.17 guard). **Browser-verify με Giorgio** (Generate → καφέ ghost → Accept → sloped drain segments + φρεάτιο network + auto-fittings). N.15 updates.

## 7) ΜΕΤΑ ΑΠΟ ΑΥΤΟ
3η discipline = **Θέρμανση** (hydronic closed-loop: radiator/boiler/underfloor primitives ήδη functional· demand=heat-load ADR-422). Παράλληλα: water/drainage Slice 3 **A\* wall-aware** router (ωφελεί ΟΛΕΣ τις disciplines· ίδιο contract). Drainage future: risers Φ15 cross-floor, vent stack (EN12056 secondary ventilation), ομβρίων/storm, λιποσυλλέκτες, auto-place collector.
