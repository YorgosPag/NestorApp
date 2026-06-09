# 🧠 HANDOFF — ADR-429 **Slice 3B: Parallel Supply/Return Pairing** (θέρμανση, offset runs όπως Revit/MagiCAD): PLAN-CONFIRMED → υλοποίηση

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** το **Slice 3B** του MEP Routing Brain (ADR-429) — οι σωλήνες **προσαγωγής (supply) & επιστροφής (return)** της θέρμανσης να τρέχουν **παράλληλα με σταθερό offset** (όπως Revit/MagiCAD/4M FINE), αντί να επικαλύπτονται όπως σήμερα.
>
> **Προαπαιτούμενο — ΗΔΗ DONE:** Το **Slice 3A (A\* wall-aware router)** ολοκληρώθηκε & verified (68/68 mep-design tests). Δες `docs/centralized-systems/reference/adrs/ADR-429-mep-routing-brain.md` (πλήρες) + μνήμη `[[project_adr429_routing_brain]]`. Ο router (`routeWallAware`) είναι ο κοινός swap-point που χρησιμοποιούν και οι 3 disciplines.
>
> **Η μεγάλη ιδέα (FULL SSOT):** Σήμερα το `design-heating.ts` καλεί `buildNetwork` ×2 **ανεξάρτητα** (supply & return) → οι 2 κορμοί (trunks) τρέχουν επικαλυπτόμενοι (στο integration test τα rad-supply/rad-return είναι στο **ΙΔΙΟ** σημείο). Revit-grade: ο return κορμός = **lateral offset** του supply κορμού. **Δεν χρειάζεται 2ο A\*** — ο return **κληρονομεί** τη γεωμετρία του supply μέσω `offsetPolyline` (SSoT helper, ADR-358) → εγγυημένα παράλληλος.

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / Revit / MagiCAD / 4M FINE»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ.
- **SHARED working tree** με άλλον agent (codex/boiler). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. Στο τελευταίο `git status` ο άλλος agent είχε modified: `ADR-422`, `bim/thermal/heat-load/derive-annual-energy*`, `bim/thermal/report/thermal-study-report*`, `annual-gains-config*`, `MepBoilerRenderer.ts`, `mep-boiler-tag.ts`, `i18n/locales/*/dxf-viewer-shell.json`, `HANDOFFS/*`. Slice 3B είναι **καθαρά headless heating geometry** → ελάχιστη επικάλυψη, αλλά ΠΑΝΤΑ `git diff <file>` πριν αγγίξεις shared αρχείο.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push. **ΜΗΝ αγγίξεις adr-index**.
- **Plan Mode προαιρετικό** — το approach είναι ΗΔΗ LOCKED (κάτω §1-2). Μικρό scope (1 NEW + 1 MOD). Μπορείς να πας απευθείας σε υλοποίηση ή σύντομο plan· ΠΑΡΕ ΕΣΥ τις Revit λεπτομέρειες (offset side, branch re-tap).
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος (ο codex τρέχει συχνά). ⚠️ Στην προηγούμενη session ο **Bash tool ΜΠΛΟΚΑΡΕ** τον PowerShell έλεγχο διεργασίας (`Get-CimInstance`) — αν συμβεί ξανά, **πρότεινε στον Giorgio να τρέξει `! npx tsc --noEmit`** ή απλώς defer (jest αρκεί για headless geometry).
- **N.11 i18n:** Slice 3B είναι **headless** → **ΚΑΝΕΝΑ νέο UI string** (v1 = default-on pairing, μηδέν UI/toggle).
- **N.15:** μετά υλοποίηση → **ADR-429 changelog** (Slice 3B entry· flip §5 από PLANNED→IMPLEMENTED) + ADR-423 changelog (μία γραμμή) + μνήμη (update `[[project_adr429_routing_brain]]`) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (η εγγραφή ADR-429 υπάρχει ήδη — κλείσε το «🔴 PENDING Slice 3B»).
- **ADR-040:** Slice 3B = **headless** (μόνο `systems/mep-design/heating/`). **ΕΚΤΟΣ ADR-040** (κανένα CHECK 6B/6C/6D). Το ghost render μένει ως είναι — απλώς τα return segments έχουν διαφορετική γεωμετρία (offset).

---

## 0) ΚΑΤΑΣΤΑΣΗ — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (reuse, μην το ξαναχτίσεις)

**🟢 Ο A\* wall-aware router (Slice 3A, DONE):** `systems/mep-design/routing/route-wall-aware.ts` → `routeWallAware(root, targets, obstacles, opts?): readonly RoutedSegment[]`. Όλες οι 3 disciplines τον καλούν. **ΜΗΝ τον αλλάξεις** — το 3B είναι post-process πάνω στην έξοδό του.

**🟢 Ο heating orchestrator — `heating/design-heating.ts` (το ΜΟΝΟ MOD αρχείο):**
```ts
const obstacles = wallObstacles(entities);            // Slice 3A
// supply:
networks.push(buildNetwork(supplySource, demands, discipline, obstacles));
// return: ΣΗΜΕΡΑ ανεξάρτητο buildNetwork → ΑΥΤΟ αλλάζει στο 3B
networks.push(buildNetwork(returnSink, demands, discipline, obstacles));
```
- `buildNetwork(root: HeatingEndpoint, demands, discipline, obstacles): ProposedHeatingNetwork` (γρ. ~49). Κάνει map τα routed segments σε `ProposedHeatingSegment`.

**🟢 Τα δεδομένα που θα χρειαστείς (ΟΛΑ διαθέσιμα στο `designHeating`):**
- `demands: readonly TerminalHeatDemand[]` — κάθε ένα έχει: `supplyPoint`, **`returnPoint`** (Point2D, world), `returnConnectorId`, `entityId`, `flowLps`. (`heating/heating-design-types.ts`)
- `returnSink: HeatingEndpoint` — `point` (boiler return inlet), `entityId`, `connectorId`, `elevationMm`, `classification:'hydronic-return'`. (`heating/heating-source-resolve.ts`)
- `supply: ProposedHeatingNetwork` — έχει `segments` (με `role:'trunk'|'branch'`, `start/end`, `cumulativeFlowLps`, `diameterMm`), `sourcePoint`. (`heating/heating-design-types.ts`)
- `discipline.sizingStandard.diameterForFlowLps(flowLps): number`.

**🟢 SSoT helpers ΠΟΥ ΥΠΑΡΧΟΥΝ (ΧΡΗΣΙΜΟΠΟΙΗΣΕ, μην ξαναγράψεις):**
- **Parallel offset:** `rendering/entities/shared/geometry-offset-utils.ts` → `offsetPolyline(polyline: readonly Point3D[], offsetDistance, {join:'miter', miterLimit?}): readonly Point3D[]`. **+offset = LEFT of travel (CCW), −offset = RIGHT.** Δέχεται/επιστρέφει **Point3D** (z preserved) → κάνε map Point2D↔Point3D (z=0 placeholder· το commit ξαναβάζει z=sourceElevationMm).
- **Nearest point on segment (re-tap branches):** `rendering/entities/shared/geometry-utils.ts:56` → `getNearestPointOnLine(point, lineStart, lineEnd, clampToSegment=true): Point2D`. **Αυτό για το re-tap** κάθε terminal return connector στον offset κορμό.
- **Pairing offset const:** `systems/mep-design/routing/routing-constants.ts` → `PAIRING_CLEARANCE_SCENE = 30` (ΗΔΗ ορισμένο από 3A).
- **Heating types:** `ProposedHeatingNetwork` / `ProposedHeatingSegment` / `HEATING_ROLE_CLASSIFICATION` στο `heating/heating-design-types.ts`.

**🔴 ΤΙ ΛΕΙΠΕΙ (αυτό ΕΙΝΑΙ το Slice 3B):** ένα pure `heating/pair-supply-return.ts` που παράγει τον **return network ως offset του supply** + το wiring στο `design-heating.ts`.

---

## 1) ΤΙ ΘΑ ΦΤΙΑΞΕΙΣ (Slice 3B = offset-pairing return network)

**ΝΕΟ αρχείο (δικό σου):** `heating/pair-supply-return.ts` + `__tests__/pair-supply-return.test.ts`

```ts
export function buildPairedReturnNetwork(
  supply: ProposedHeatingNetwork,        // ο ΗΔΗ routed supply (πηγή γεωμετρίας)
  returnSink: HeatingEndpoint,           // boiler return inlet (root του return)
  demands: readonly TerminalHeatDemand[],// για τα returnPoint των τερματικών
  discipline: HeatingDiscipline,         // για diameterForFlowLps
): ProposedHeatingNetwork
```

**Αλγόριθμος (Revit-grade):**
1. **Reconstruct supply spine arms:** μάζεψε τα `supply.segments` με `role==='trunk'`, άλυσέ τα head-to-tail από το `supply.sourcePoint` προς τα έξω → 1 ή 2 arm polylines (ο Manhattan σπάει σε ≤2 arms αριστερά/δεξιά του root). *(Helper: chain segments όπου `seg.start ≈ prevEnd`.)*
2. **Offset distance (DN-aware):** `offsetMm = maxTrunkDN + PAIRING_CLEARANCE_SCENE` όπου `maxTrunkDN = max(diameterMm των trunk segments)`. (Το §5 ADR-429 λέει `(dnS+dnR)/2 + clearance` — supply≈return DN, οπότε `maxTrunkDN + clearance` είναι το ίδιο, απλούστερο.)
3. **Offset each arm** μέσω `offsetPolyline(arm3D, +offsetMm, {join:'miter'})` → return arm polyline (παράλληλη). **Σταθερό side** (πάντα +, ίδιο για όλα τα arms → καθαρό «δίδυμο» τρέξιμο).
4. **Return trunk segments:** διαδοχικά ζεύγη της offset polyline· `cumulativeFlowLps`/`diameterMm` **copy** από το αντίστοιχο supply trunk run (mapping κατά vertex index/απόσταση κατά μήκος του arm). `role:'trunk'`, `networkRole:'return'`, `classification:'hydronic-return'`.
5. **Root stub:** segment `returnSink.point → start του offset trunk` (γεφυρώνει τον λέβητα-return με τον offset κορμό). `role:'trunk'`, cumulative = total flow, DN = maxTrunkDN.
6. **Return branches (re-tap):** για ΚΑΘΕ demand → `getNearestPointOnLine(demand.returnPoint, …)` πάνω στο πλησιέστερο offset-trunk segment → branch από εκείνο το σημείο **έως** `demand.returnPoint`. `role:'branch'`, `cumulativeFlowLps = demand.flowLps`, `diameterMm = discipline.sizingStandard.diameterForFlowLps(demand.flowLps)`. **ΚΡΙΣΙΜΟ:** αυτό λύνει το «target χωρίς branch» — ΚΑΘΕ terminal connector ξαναβρίσκει το δίκτυο, ακόμη κι αν στον Manhattan ήταν πάνω στη spine.
7. **Επέστρεψε `ProposedHeatingNetwork`** με: `role:'return'`, `classification:'hydronic-return'`, `sourceEntityId/sourceConnectorId = returnSink.entityId/connectorId`, `sourcePoint = returnSink.point`, `sourceElevationMm = returnSink.elevationMm`, `segments = [stub, ...trunk, ...branches]`, `servedTerminalIds`/`servedConnectors` = τα return connectors (όπως τα φτιάχνει ήδη το `buildNetwork` για return), `totalFlowLps = supply.totalFlowLps`.

**MOD (δικό σου):** `heating/design-heating.ts` — αντικατέστησε το return `buildNetwork` με:
```ts
const independentReturn = () => buildNetwork(returnSink, demands, discipline, obstacles);
const ret = obstacles.length === 0
  ? buildPairedReturnNetwork(supply, returnSink, demands, discipline)   // καθαρή flat περίπτωση → παράλληλο
  : independentReturn();                                                // walls → κράτα wall-aware independent (gated)
networks.push(ret);
```
*(Χρειάζεσαι reference στο `supply` network — βγάλε το σε μεταβλητή πριν το push.)*

---

## 2) ΟΙ ΑΠΟΦΑΣΕΙΣ (Revit-grade, LOCKED — πάρε τις λεπτομέρειες ΕΣΥ)
1. **Offset side:** σταθερό `+offsetMm` (CCW/left of travel) — αρκεί να είναι ίδιο για όλα τα arms ώστε supply/return να είναι «δίδυμα». (Προαιρετικό polish: διάλεξε side μακριά από τα terminals· v1 = σταθερό +.)
2. **Offset distance:** DN-aware `maxTrunkDN + PAIRING_CLEARANCE_SCENE` (=30). Pluggable.
3. **Gate:** pairing **ΜΟΝΟ** όταν `obstacles.length === 0` (no-detour). Με τοίχους → independent wall-aware return (ο A\* detour + uniform offset δεν συνδυάζονται καθαρά στο v1· δηλώσέ το ως known limitation). **Αυτό κρατά zero-regression** στα tests (που δεν έχουν τοίχους → μπαίνει pairing· αλλά δες §3 invariants).
4. **Cumulative flow:** return mirror του supply (closed loop, ίδιες ροές). Copy, μην ξανα-αθροίζεις.
5. **Branch re-tap:** πάντα `getNearestPointOnLine` στο offset trunk → εγγυάται κάθε connector συνδεδεμένο.

---

## 3) ΤΙ ΝΑ ΜΗΝ ΣΠΑΣΕΙΣ (regression invariants — τα υπάρχοντα heating tests)
- **`build-heating-commit.test.ts`** = hand-built proposals → **ΔΕΝ επηρεάζεται** (δεν περνά από `designHeating`). Άστο.
- **`heating-design.integration.test.ts`** = geometry-**agnostic** για το return· ελέγχει: `ret.classification==='hydronic-return'`, `ret.segments.every(s=>s.classification==='hydronic-return')` (⚠️ **το stub σου ΠΡΕΠΕΙ** να έχει classification hydronic-return), `supply.totalFlowLps≈ret.totalFlowLps` (⚠️ **κράτα `totalFlowLps` ίσο**), trunk DN ≥ branch DN (⚠️ stub/trunk DN ≥ branch), `maxCumulative≈totalFlowLps`. **Κανένα assertion σε exact return coords** → ελευθερία γεωμετρίας. **Τρέξε `npx jest "systems/mep-design"` → ΠΡΕΠΕΙ 68+ πράσινα** (τα νέα pairing tests επιπλέον).
- ΜΗΝ αλλάξεις `RoutedSegment` / `routeWallAware` / Stage 0.
- ΜΗΝ βάλεις slope (closed loop, flat).
- ΜΗΝ `git add -A`. ΜΗΝ commit/push/adr-index/`--no-verify`. ΜΗΝ 2ο tsc (N.17). ΜΗΝ νέο i18n/UI.

---

## 4) ΛΕΠΤΑ ΣΗΜΕΙΑ (γι' αυτό ήταν χωριστό gate — πρόσεξέ τα)
- **2 arms:** ο Manhattan σπάει σε αριστερό+δεξί arm από το root. Offset-άρισε **κάθε arm χωριστά** (το `offsetPolyline` δουλεύει σε ένα open polyline). Ο stub γεφυρώνει το root με την αρχή κάθε offset arm (ή με το πλησιέστερο).
- **Target χωρίς branch:** στον Manhattan, αν target πέφτει πάνω στη spine δεν παράγεται branch. Με το **re-tap §1.6 το λύνεις** — ΚΑΘΕ demand παίρνει branch από τον offset κορμό προς το `returnPoint` του.
- **Cumulative-flow remap:** όταν κόβεις την offset polyline σε segments, αντιστοίχισε το `cumulativeFlowLps` από το supply trunk run που καλύπτει το ίδιο τμήμα (κατά απόσταση από το root). Κράτα monotonic (μεγάλο κοντά στον λέβητα).
- **Underfloor test:** supply & return connectors στο **ίδιο** σημείο (uf-supply/uf-return identity) → μετά το offset, ο return branch re-tap πάει στο `(2000,1000)`. Ο `supply` test ελέγχει supply (ανέγγιχτος). OK.
- **Single terminal:** 1 trunk, 0 branches στον supply → η offset arm + stub + 1 re-tap branch. Σιγουρέψου ότι το re-tap παράγει το τελικό drop στο connector.

---

## 5) ΝΕΑ αρχεία / MOD (git add ΜΟΝΟ αυτά)
| Αρχείο | Τύπος | Σκοπός |
|---|---|---|
| `heating/pair-supply-return.ts` | NEW | `buildPairedReturnNetwork` (pure) |
| `heating/__tests__/pair-supply-return.test.ts` | NEW | παράλληλο offset· κάθε connector συνδεδεμένος· flow/classification invariants |
| `heating/design-heating.ts` | MOD | gate: no-obstacles → paired return, αλλιώς independent |
| `heating/index.ts` | MOD (αν χρειάζεται export) | barrel |
| ADR-429 §5+changelog, ADR-423 changelog, ΕΚΚΡΕΜΟΤΗΤΕΣ, μνήμη | MOD | N.15 |

---

## 6) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus)
1. Διάβασε αυτό το handoff + ADR-429 (§5) + μνήμη `[[project_adr429_routing_brain]]` + `[[project_adr428_heating_auto_design]]`.
2. Διάβασε: `heating/design-heating.ts` (όλο), `heating/heating-design-types.ts` (`TerminalHeatDemand.returnPoint`, `ProposedHeatingNetwork/Segment`), `heating/heating-source-resolve.ts` (`HeatingEndpoint`), `geometry-offset-utils.ts` (`offsetPolyline` — Point3D!), `geometry-utils.ts:56` (`getNearestPointOnLine`), `routing-constants.ts` (`PAIRING_CLEARANCE_SCENE`).
3. Υλοποίηση pure-first: `pair-supply-return.ts` (arms-reconstruct → offset → trunk+stub+re-tap) → test → wire `design-heating.ts` (gate) → `npx jest "systems/mep-design"` (68+ + νέα) → N.15 updates.
4. **ΜΗΝ commit** — άσε τον Giorgio. Δώσ' του λίστα δικών σου αρχείων + context indicator (N.9) + Google-level declaration (N.7.2).

## 7) ΜΕΤΑ ΑΠΟ ΑΥΤΟ
- **Ύδρευση cold/hot pairing** (γενίκευσε το 3B στις άλλες disciplines).
- **4η discipline: Ηλεκτρολογικά ΙΣΧΥΡΑ** (ADR-423 §6 σειρά) — τώρα με A\* router + pairing έτοιμα.
- Pairing + A\* detour συνδυασμός (offset path που ακολουθεί detour) αν χρειαστεί με τοίχους.
