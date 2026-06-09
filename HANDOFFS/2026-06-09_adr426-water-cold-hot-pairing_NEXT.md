# 🧠 HANDOFF — ADR-426/429 **Ύδρευση: Parallel Cold/Hot Pairing** (γενίκευση του heating 3B σε κοινό SSoT πυρήνα): υλοποίηση

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** το **cold/hot pairing της ύδρευσης** — η γραμμή ζεστού (hot) να τρέχει **παράλληλα με σταθερό offset** από τη γραμμή κρύου (cold), όπως Revit/MagiCAD/4M FINE, αντί να επικαλύπτεται. **ΚΑΙ** ταυτόχρονα να **γενικευτεί ο γεωμετρικός πυρήνας του pairing σε ένα κοινό SSoT module** ώστε heating + water να τον μοιράζονται (FULL ENTERPRISE, μηδέν copy-paste — Boy Scout N.0.2).
>
> **Προαπαιτούμενο — ΗΔΗ DONE:** Το **ADR-429 Slice 3B (heating supply/return pairing)** ολοκληρώθηκε & verified (76/76 mep-design tests). Δες `systems/mep-design/heating/pair-supply-return.ts` (ο γεωμετρικός πυρήνας ΖΕΙ ΕΔΩ τώρα) + ADR-429 §5 + μνήμη `[[project_adr429_routing_brain]]`.
>
> **Η μεγάλη ιδέα (FULL SSOT):** Σήμερα το `design-water-supply.ts` δρομολογεί cold & hot **ανεξάρτητα** από **δύο διαφορετικές πηγές** (cold manifold + hot manifold/θερμοσίφωνας) → όπου οι δύο spines συμπίπτουν (κοινός διάδρομος, fixtures με cold+hot), επικαλύπτονται. Revit-grade: **cold = reference (μένει), hot = lateral offset** κατά σταθερή απόσταση. **Η απόφαση είναι ΗΔΗ LOCKED στον κώδικα:** `WaterSupplyDiscipline.hotSpineOffsetMm = 80` υπάρχει ήδη με σχόλιο *"Lateral offset (mm) of the hot spine from the cold spine (parallel runs)"* — απλώς δεν χρησιμοποιείται ακόμα.
>
> **⚠️ ΔΙΑΦΟΡΑ ΑΠΟ ΤΟ HEATING (γιατί χρειάζεται refactor, όχι αντιγραφή):** στο heating, supply & return έχουν **ίδιο root** (λέβητας) + **ίδια τερματικά** (κάθε radiator έχει supply+return) → ο return χτίστηκε **ΑΠΟ τη γεωμετρία του supply**. Στην ύδρευση, cold & hot έχουν **διαφορετικές πηγές** + **διαφορετικά fixtures** (WC=μόνο cold, νιπτήρας=cold+hot) → ΔΕΝ μπορείς να χτίσεις το hot από το cold. Λύση: το hot δρομολογείται ανεξάρτητα (όπως τώρα) και μετά **offset-άρεται ΠΑΝΩ ΣΤΟ ΔΙΚΟ ΤΟΥ spine**. Ο **γεωμετρικός πυρήνας είναι ο ίδιος** και στις δύο περιπτώσεις («δοθέντων trunk arms + root + retap targets + offset → offset trunks + stub + re-tap branches») — αυτό ακριβώς εξάγουμε σε SSoT.

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / Revit / MagiCAD / 4M FINE»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ. **Ο refactor σε κοινό πυρήνα ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ** (N.0.2 Boy Scout: μην κάνεις copy-paste το pairing pattern σε 2 disciplines).
- **SHARED working tree** με άλλον agent (codex/boiler). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. ΠΑΝΤΑ `git status` + `git diff <file>` πριν αγγίξεις shared αρχείο. Το pairing είναι **καθαρά headless geometry** → ελάχιστη επικάλυψη.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push. **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **Plan Mode προαιρετικό** — το approach είναι LOCKED (κάτω §1-2). Μπορείς να πας απευθείας σε υλοποίηση. ΠΑΡΕ ΕΣΥ τις Revit λεπτομέρειες (offset side, branch re-tap).
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος (ο codex τρέχει συχνά). Αν ο `Get-CimInstance` έλεγχος μπλοκάρει στον Bash tool, **πρότεινε στον Giorgio `! npx tsc --noEmit`** ή defer (jest αρκεί για headless geometry).
- **N.11 i18n:** headless → **ΚΑΝΕΝΑ νέο UI string** (v1 = default-on pairing, μηδέν UI/toggle).
- **N.15:** μετά υλοποίηση → **ADR-426 changelog** (cold/hot pairing entry) + **ADR-429 changelog** (μία γραμμή: «pairing core γενικεύτηκε σε SSoT, 2ος consumer = water») + ADR-423 changelog (μία γραμμή) + μνήμη (update `[[project_adr426_water_supply_auto_design]]` + `[[project_adr429_routing_brain]]`) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (νέα 🟢 γραμμή).
- **ADR-040:** **ΕΚΤΟΣ** (headless, μόνο `systems/mep-design/`). Κανένα CHECK 6B/6C/6D.

---

## 0) ΚΑΤΑΣΤΑΣΗ — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (reuse, μην το ξαναχτίσεις)

**🟢 Ο γεωμετρικός πυρήνας του pairing (heating 3B) — `heating/pair-supply-return.ts`:** περιέχει `reconstructArms`, offset μέσω `offsetPolyline`, root stub, re-tap branches μέσω `getNearestPointOnLine`. **ΑΥΤΟΝ γενικεύεις** — δες §1.

**🟢 Ο water orchestrator — `water/design-water-supply.ts`:**
```ts
for (const service of discipline.services) {        // ['cold','hot']
  const demands = demandModel.demands.filter(d => d.service === service && d.loadingUnits > 0);
  const source = resolveWaterSource(entities, classification);
  networks.push(buildNetwork(service, source, demands, discipline, obstacles));   // <-- το hot ΑΥΤΟ θα γίνει offset
}
```

**🟢 Τα types (διαφέρουν από heating — πρόσεξέ τα):**
- `ProposedSegment` (water): `{ start, end, service, classification, diameterMm, cumulativeLU, role }` — **`service`** (όχι `networkRole`), **`cumulativeLU`** (όχι `cumulativeFlowLps`). (`water/water-design-types.ts`)
- `ProposedNetwork` (water): `{ service, classification, sourceEntityId/ConnectorId, sourcePoint, sourceElevationMm, segments, servedTerminalIds, servedConnectors, totalLU }`.
- `FixtureDemand`: `{ terminalId, entityId, service, loadingUnits, connectorId, point }` — **`point`** (όχι `returnPoint`), **`loadingUnits`**.
- `WaterSupplyDiscipline.hotSpineOffsetMm = 80` (ΗΔΗ ορισμένο, το offset distance του hot). `discipline.sizingStandard.diameterForLU(lu)`.

**🟢 SSoT helpers (ίδιοι με heating 3B):** `offsetPolyline` (ADR-358, Point3D, +offset=left of travel), `getNearestPointOnLine` (ADR-065), `PAIRING_CLEARANCE_SCENE`.

**🔴 ΤΙ ΛΕΙΠΕΙ (αυτό ΕΙΝΑΙ η εργασία):** (a) ο εξαγμένος SSoT πυρήνας, (b) το heating wrapper πάνω του (zero-regression), (c) το water cold/hot pairing, (d) το wiring στο `design-water-supply.ts`.

---

## 1) ΤΙ ΘΑ ΦΤΙΑΞΕΙΣ

### Βήμα Α — **NEW SSoT πυρήνας** `routing/offset-pairing.ts` (discipline-agnostic, pure)
Εξάγαγε τον γεωμετρικό πυρήνα. Δουλεύει σε **generic** runs (μηδέν heating/water types):
```ts
export interface OffsetRun { readonly start: Point2D; readonly end: Point2D; }
export interface OffsetTrunkRun  extends OffsetRun { readonly sourceTrunkIndex: number; }  // index στο referenceTrunks
export interface OffsetStubRun   extends OffsetRun { readonly armFirstTrunkIndex: number; } // για copy meta του stub
export interface OffsetBranchRun extends OffsetRun { readonly targetIndex: number; }         // index στο retapTargets
export interface OffsetPairing {
  readonly trunks:   readonly OffsetTrunkRun[];
  readonly stubs:    readonly OffsetStubRun[];
  readonly branches: readonly OffsetBranchRun[];
}

export function buildOffsetPairing(
  referenceTrunks: readonly OffsetRun[],   // τα trunk runs (role-filtered από τον caller, ΜΕ τη σειρά τους)
  referenceSourcePoint: Point2D,           // η πηγή του reference δικτύου (απ' όπου αλυσώνουν τα arms)
  root: Point2D,                           // η ρίζα του offset δικτύου (από εδώ ο stub)
  retapTargets: readonly Point2D[],        // κάθε branch πρέπει να φτάσει ένα
  offsetMm: number,
): OffsetPairing
```
**Εσωτερικά** (μετακίνησε αυτούσια από `pair-supply-return.ts`): `reconstructArms` (chain referenceTrunks head-to-tail από referenceSourcePoint → ≤2 arms ως **index lists** στο referenceTrunks), για κάθε arm → polyline (start του 1ου + ends) → `offsetPolyline(+offsetMm, miter)` → z→drop σε Point2D → offset trunks **tagged με sourceTrunkIndex**, stub `root → offsetPts[0]` **tagged με armFirstTrunkIndex**, και re-tap κάθε target μέσω `getNearestPointOnLine` πάνω σε ΟΛΑ τα offset trunks → branch **tagged με targetIndex**. **ΚΑΜΙΑ μεταβολή στη γεωμετρία/λογική** σε σχέση με το σημερινό heating — απλώς agnostic + index tagging αντί για typed building.

### Βήμα Β — **MOD** `heating/pair-supply-return.ts` → thin wrapper (ZERO-REGRESSION)
`buildPairedReturnNetwork` καλεί `buildOffsetPairing(supplyTrunks, supply.sourcePoint, returnSink.point, demands.map(d=>d.returnPoint), maxTrunkDN+PAIRING_CLEARANCE_SCENE)`, μετά map κάθε run → `ProposedHeatingSegment`:
- offset trunk → copy `cumulativeFlowLps`+`diameterMm` από `supplyTrunks[sourceTrunkIndex]`, `networkRole:'return'`, `classification:'hydronic-return'`, `role:'trunk'`.
- stub → copy από `supplyTrunks[armFirstTrunkIndex]`, `role:'trunk'`.
- branch → `demands[targetIndex]`: `cumulativeFlowLps=flowLps`, `diameterMm=diameterForFlowLps(flowLps)`, `role:'branch'`.
**Στόχος: τα 8 υπάρχοντα heating pairing tests + integration ΠΑΡΑΜΕΝΟΥΝ πράσινα ΑΜΕΤΑΒΛΗΤΑ.**

### Βήμα Γ — **NEW** `water/pair-cold-hot.ts` → thin wrapper (water types)
```ts
export function buildOffsetHotNetwork(
  hot: ProposedNetwork,                 // ο ΗΔΗ routed hot (cold μένει reference, ΔΕΝ αγγίζεται)
  hotDemands: readonly FixtureDemand[], // για retap points + branch DN
  discipline: WaterSupplyDiscipline,
): ProposedNetwork
```
Καλεί `buildOffsetPairing(hotTrunks, hot.sourcePoint, hot.sourcePoint, hotDemands.map(d=>d.point), discipline.hotSpineOffsetMm)` (root = referenceSourcePoint = hot source· offset πάνω στο δικό του spine). Map → `ProposedSegment` (`service:'hot'`, `cumulativeLU`, `diameterForLU`). Επέστρεψε `ProposedNetwork` ίδια metadata με το `hot` (sourceXxx, servedTerminalIds, servedConnectors, **`totalLU` = hot.totalLU ΑΜΕΤΑΒΛΗΤΟ**), `segments = [stubs, offset trunks, branches]`.

### Βήμα Δ — **MOD** `water/design-water-supply.ts` → gate
Κράτα reference στο cold (μένει) και offset το hot ΜΟΝΟ no-walls + έχει trunk:
```ts
const net = buildNetwork(service, source, demands, discipline, obstacles);
const canPair = service === 'hot' && obstacles.length === 0 && net.segments.some(s => s.role === 'trunk');
networks.push(canPair ? buildOffsetHotNetwork(net, demands, discipline) : net);
```
*(το cold ΠΟΤΕ δεν offset-άρεται — είναι το reference)*.

---

## 2) ΟΙ ΑΠΟΦΑΣΕΙΣ (Revit-grade, LOCKED)
1. **Reference = cold** (μένει στη θέση του), **hot = offset** κατά `hotSpineOffsetMm` (80, ΗΔΗ ορισμένο). Σταθερό `+offset` (left of travel).
2. **Offset distance:** `discipline.hotSpineOffsetMm` για water (ΟΧΙ DN-aware — η απόφαση είναι ήδη σταθερό 80· pluggable). Heating κρατά το δικό του DN-aware `maxTrunkDN + PAIRING_CLEARANCE_SCENE`. **Ο πυρήνας δέχεται `offsetMm` param** → καθένας περνά το δικό του.
3. **Gate:** pairing μόνο `obstacles.length === 0` + το network έχει ≥1 trunk. Με τοίχους → independent (known limitation, ίδιο με heating).
4. **Branch re-tap:** πάντα `getNearestPointOnLine` → κάθε connector συνδεδεμένο.
5. **Stub:** root → αρχή κάθε offset arm (carries arm total = 1ου trunk meta).

---

## 3) ΤΙ ΝΑ ΜΗΝ ΣΠΑΣΕΙΣ (regression invariants)
- **`water-design.test.ts`** (unit): ελέγχει `service` sorting, `totalLU` (cold=6/hot=5/hot=3), warnings, cold trunk DN ≥ branch — **ΚΑΝΕΝΑ assertion σε hot coords** → ελευθερία γεωμετρίας. **Κράτα `hot.totalLU` ΑΜΕΤΑΒΛΗΤΟ** (copy από original).
- **`water-design.integration.test.ts`**: cold αμετάβλητο (reference)· ελέγχει services=['cold','hot'], warnings 0, cold.totalLU=6, hot.totalLU=5, cold trunk≥branch. → κράτα totalLU + μην αγγίξεις cold.
- **`water-supply-commit.test.ts`**: hand-built proposals → δεν περνά από `designWaterSupply` → άστο.
- **ΤΑ 8 HEATING PAIRING TESTS + heating integration**: ο refactor (Βήμα Β) πρέπει να τα κρατήσει **ΑΚΡΙΒΩΣ** πράσινα (zero behaviour change).
- ΜΗΝ αλλάξεις `offsetPolyline`/`getNearestPointOnLine`/`routeWallAware`/Stage 0.
- ΜΗΝ `git add -A`. ΜΗΝ commit/push/adr-index/`--no-verify`. ΜΗΝ 2ο tsc (N.17). ΜΗΝ νέο i18n/UI.
- **Τρέξε `npx jest "systems/mep-design"` → ΠΡΕΠΕΙ 76 (heating) + νέα water pairing tests, ΟΛΑ πράσινα.**

---

## 4) ΛΕΠΤΑ ΣΗΜΕΙΑ
- **Διαφορετικά roots/fixtures:** το hot offset-άρεται πάνω στο **δικό του** spine (root = hot source), ΟΧΙ πάνω στο cold. Όπου cold/hot spines φυσικά συμπίπτουν (κοινός manifold, fixtures με cold+hot) → το offset τα κάνει δίδυμα· όπου αποκλίνουν → ήδη διαφορετικά.
- **2 arms:** ίδιο με heating — κάθε arm offset χωριστά, δεξί +y / αριστερό −y.
- **Index tagging:** ο πυρήνας ΔΕΝ ξέρει types — γι' αυτό επιστρέφει `sourceTrunkIndex`/`armFirstTrunkIndex`/`targetIndex`. Ο caller κρατά το ΙΔΙΟ φιλτραρισμένο `trunks` array (ίδια σειρά) για copy meta. **ΠΡΟΣΟΧΗ:** φίλτραρε trunks με την ΙΔΙΑ σειρά που τα περνάς στον πυρήνα.
- **WC = cold only:** το hot έχει λιγότερα fixtures — φυσιολογικό, ο πυρήνας re-tap-άρει μόνο τα hot demands.
- **Heating wrapper:** πρόσεξε ότι το heating offset = `maxTrunkDN + PAIRING_CLEARANCE_SCENE` (DN-aware), ΟΧΙ σταθερό. Πέρνα το σωστό `offsetMm` στον πυρήνα.

---

## 5) ΝΕΑ αρχεία / MOD (git add ΜΟΝΟ αυτά)
| Αρχείο | Τύπος | Σκοπός |
|---|---|---|
| `routing/offset-pairing.ts` | NEW | SSoT γεωμετρικός πυρήνας (`buildOffsetPairing`, agnostic) |
| `routing/__tests__/offset-pairing.test.ts` | NEW | πυρήνας: arms/offset/stub/retap/index tagging |
| `heating/pair-supply-return.ts` | MOD | thin wrapper πάνω στον πυρήνα (zero-regression) |
| `water/pair-cold-hot.ts` | NEW | `buildOffsetHotNetwork` (water wrapper) |
| `water/__tests__/pair-cold-hot.test.ts` | NEW | hot offset· cold αμετάβλητο· totalLU· κάθε connector συνδεδεμένος |
| `water/design-water-supply.ts` | MOD | gate: no-walls + hot → offset |
| `water/index.ts` / `heating/index.ts` | MOD (αν χρειάζεται export) | barrels |
| ADR-426 + ADR-429 + ADR-423 changelogs, ΕΚΚΡΕΜΟΤΗΤΕΣ, μνήμη | MOD | N.15 |

---

## 6) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus)
1. Διάβασε αυτό + `heating/pair-supply-return.ts` (ο πυρήνας προς εξαγωγή) + `water/design-water-supply.ts` + `water/water-design-types.ts` + `water/water-supply-discipline.ts` (`hotSpineOffsetMm`) + μνήμη `[[project_adr429_routing_brain]]` `[[project_adr426_water_supply_auto_design]]`.
2. Βήμα Α (πυρήνας) → test πυρήνα → Βήμα Β (heating wrapper) → `npx jest "systems/mep-design/heating"` (76 πράσινα, zero-regression) → Βήμα Γ+Δ (water) → water pairing test → `npx jest "systems/mep-design"` (όλα).
3. N.15 updates.
4. **ΜΗΝ commit** — άσε τον Giorgio. Δώσ' του λίστα δικών σου αρχείων + context indicator (N.9) + Google-level declaration (N.7.2).

## 7) ΜΕΤΑ ΑΠΟ ΑΥΤΟ
- **4η discipline: Ηλεκτρολογικά ΙΣΧΥΡΑ** (ADR-423 §6 σειρά) — τώρα με A* router + κοινό pairing core έτοιμα.
- Pairing + A\* detour συνδυασμός με τοίχους (offset path που ακολουθεί detour).
