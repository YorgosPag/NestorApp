# ADR-534 — Αυτόματη πλάκα οροφής ανά φάτνωμα (Auto-Ceiling-Slab per Structural Bay)

**Status:** ✅ APPROVED (Φάσεις 1+2+3a+3b+4 implemented, UNCOMMITTED) · **Date:** 2026-06-26
**Type:** Feature (DXF/BIM Viewer — slab discipline). Revit/ETABS-grade, μονολιθική πλακοδοκός.
**Builds on:** ADR-441 (slabs from grid · `buildSlabBaysFromGuides`) · ADR-528/529 (beam auto-span) · ADR-436 (slab discipline) · ADR-369 (elevation convention)
**Related:** ADR-507 (hatch room detection) · ADR-423/424 (space recognition) · ADR-420 (floor finishes — mirror target για Φ4)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-06-26)

Ο μηχανικός τοποθετεί κολόνες + δοκάρια (freehand, ADR-528/529). Τα τεμνόμενα δοκάρια δημιουργούν
**φατνώματα** (bays). Ζητείται **αυτόματη πλάκα οροφής**, **ομοεπίπεδη στην κορυφή των δοκαριών**
(μονολιθική κατασκευή), **μία πλάκα ανά φάτνωμα** — όπως το συνεχές δοκάρι = N δοκάρια ανά άνοιγμα.

## 2. Μηχανική απόφαση (EC2/EC8 — επίσημη πρακτική)

**Μονολιθική πλακοδοκός (T-beam, EC2 §5.3.2.1):** σε χυτό RC, πλάκα + δοκάρια χύνονται μαζί →
**πάνω όψη πλάκας = πάνω όψη δοκαριού** = στάθμη ορόφου. Η πλάκα είναι το **θλιβόμενο πέλμα** του
δοκαριού (effective flange `b_eff`). Το ολικό ύψος δοκαριού `h` περιλαμβάνει την πλάκα· το ορατό
downstand κάτω από την πλάκα = `h − t_slab`. Το δοκάρι ΔΕΝ μεγαλώνει σε `h + t_slab`.

**«Ενιαία» πλάκα ≠ σταθερό πάχος:** η ενότητα είναι η μονολιθική **συνέχεια** (σκυρόδεμα + οπλισμός
πάνω από τα δοκάρια). Διαφορετικό πάχος ανά φάτνωμα (EC2 §7.4.2 l/d) είναι θεμιτό: **πάνω όψη
ομοεπίπεδη**, το πάχος επεκτείνεται **προς τα κάτω** (το **soffit κάνει σκαλοπάτι στη γραμμή του
δοκαριού**). Big players: SAFE/ETABS = slab-property zones ανά area· Revit = floor elements ανά
περιοχή. → **Per-bay μοντέλο** (μία πλάκα ανά φάτνωμα, κοινή κορυφή, συνέχεια στα δοκάρια).

## 3. Λύση — Φασικό roadmap

| Φάση | Περιεχόμενο | Κατάσταση |
|------|-------------|-----------|
| **Φ1** | **Auto-πλάκα οροφής ανά φάτνωμα** (ανίχνευση από δοκάρια+κολόνες, flush top, ενιαίο πάχος) | ✅ **IMPLEMENTED** (αυτό το ADR) |
| **Φ2** | **Υποδιαίρεση σε φατνώματα** (άξονες εσωτ. δοκαριών/τοιχίων) + per-bay **πάχος** (EC2 §7.4.2 l/d) | ✅ **IMPLEMENTED** (UNCOMMITTED) |
| **Φ3a** | BOQ **net-of-overlap** σκυροδέματος (πλάκα αφαιρεί `∩×min(beamDepth,slabThk)`) | ✅ **ΗΔΗ** (υπό ADR-363 §5.5i+) |
| **Φ3b** | T-beam **`b_eff`** (EC2 §5.3.2.1) — section property + report + flexural-cap (sagging→b_eff) | ✅ **IMPLEMENTED** (COMMITTED) |
| **Φ3c-A** | `b_eff` read-only γραμμή στο **αριστερό panel** δοκού (Revit instance property) | ✅ **IMPLEMENTED** (COMMITTED aa1a0cd0) |
| **Φ3c-B1** | **Live organism injection** του `b_eff` (`BeamFlangeStore`) → ρ/οπλισμός panel+2Δ/3Δ/PDF καταναλώνουν b_eff | ✅ **IMPLEMENTED** (UNCOMMITTED) |
| Φ3c-B2 | Edge/L-beam detection (`flangeSides:1` — πλάκα μία πλευρά → περιμετρική δοκός) | DEFER |
| Φ3c-B3 | Soffit step finish/rebar clip (ορατός σοβάς+οπλισμός κόβονται στο soffit) + I-shape steel clip | DEFER |
| **Φ4** | Per-bay **ceiling finishes** στο soffit (μπλε/κίτρινο/σπατουλαριστό/σοβάς, Revit RCP) | ✅ **IMPLEMENTED** (UNCOMMITTED) |

## 4. Φάση 1 — Υλοποίηση (room-based, FULL SSoT reuse)

**ΚΡΙΣΙΜΟ (root fix v2):** οι τοίχοι/περίμετρος μιας κάτοψης είναι συνήθως **DXF γραμμές** (από αρχείο
DXF), ΟΧΙ BIM οντότητες. → Ανίχνευση δωματίων με τον **ΙΔΙΟ proven μηχανισμό** της γραμμοσκίασης /
θερμαινόμενων χώρων (ADR-507 Φ3), που διαβάζει DXF γραμμές:

1. **Segments = `extractLineSegments(entities, {tessellateCurves})`** — DXF γραμμές + πολυγραμμές +
   separators + καμπύλα. **Τα δοκάρια/κολόνες ΔΕΝ μπαίνουν** → καμία λωρίδα-πάνω-σε-δοκάρι.
2. **`findClosedPolygonsFromLines(segments, mergeTol, 0)`** — half-edge planar faces = ο ΣΩΣΤΟΣ room
   detector (`auto-area-geometry`). `mergeTol = resolveRegionLoopTolWorld(sceneUnits)` (SSoT).
3. **Φίλτρο λωρίδων τοίχων:** ο διαμερισμός δίνει ΚΑΙ τα λεπτά faces ανάμεσα στις διπλές γραμμές
   τοίχων· κόβονται με **υδραυλικό πλάτος** `2·area/perimeter < MIN_ROOM_WIDTH (350mm)` + ελάχ. εμβαδόν.
4. **Flush top:** `levelElevation = max(beam.topElevation)` → ομοεπίπεδα με την κορυφή των δοκαριών.
5. **Δημιουργία:** `completeSlabFromPolygonClicks(room, layerId, {kind:'ceiling', levelElevation}, …)`
   (SSoT slab builder)· `kind='ceiling'` ήδη έγκυρο· persistence/render/3D αμετάβλητα.
6. **Trigger:** ribbon action **«Πλάκα οροφής (auto)»** (Δομικά → Πλάκες· one-shot, idempotent by
   room centroid). `commitCeilingSlabsFromStructure` → `CreateSlabsCommand` (undoable).

**Αρχεία (Φ1):** NEW `bim/slabs/ceiling-slab-from-structure.ts` (room detection + builder) · NEW
`bim/slabs/ceiling-slab-commit.ts` (orchestrator, idempotent) · `slab-command-keys.ts`
(+`fromStructureCeiling`) · `useRibbonSlabBridge.ts` (handler) · `structural-tab.ts` (κουμπί) · i18n el/en.
(Το `slab-from-grid.ts` πήρε internal refactor — `regionMinusSubtrahends` εξαγωγή από `bayOutline` — που
έμεινε αν και το ceiling δεν το χρησιμοποιεί πλέον.)

**DEFER:** beam-subdivision (δωμάτιο → δομικά φατνώματα από άξονες δοκαριών)· holes/αίθρια· gap-bridging
για πόρτες (gapTol=0 → κλειστοί βρόχοι). Sliver filter = heuristic (browser-verify/tunable).

## 5. Επαλήθευση
- **jest:** `ceiling-slab-from-structure` (4 φατνώματα 12×12 σκηνή Giorgio· flush top· no-footprint) +
  `ceiling-slab-commit` (idempotency: 1η→4, 2η→0 up-to-date) + `slab-from-grid`/`slab-grid-commit`
  regression GREEN (το `bayOutline` refactor). ts-jest (N.17).
- **Firestore MCP:** μετά το action → query `floorplan_slabs` → N docs `kind:'ceiling'`,
  `levelElevation == beam.topElevation`.
- **Browser (Giorgio):** η σκηνή των screenshots → «Πλάκα οροφής (auto)» → πλάκες ομοεπίπεδες στην
  κορυφή των δοκαριών σε 3D, μία ανά φάτνωμα.

## 6. Changelog

- **2026-06-26 (Φ3c-B1 — Live organism injection του `b_eff`, UNCOMMITTED)** — Giorgio order: «το ρ/οπλισμός
  να ΧΡΗΣΙΜΟΠΟΙΟΥΝ το b_eff real-time» (λύση της επιφύλαξης του Φ3c-A — η γραμμή ήταν πληροφοριακή). **RECOGNITION
  (N.0.1, trace full pipeline):** το flexural-cap wiring ήταν ΗΔΗ έτοιμο (Φ3b: `flexuralCompressionWidthMm` →
  `M_Rd,lim` σαγκ. χρησιμοποιεί `b_eff`)· λείπε μόνο ο **live producer** (store) + η κατανάλωσή του. ΕΥΡΗΜΑ:
  η bridge `effectiveReinforcement` του panel καλούσε την **pure** `resolveActiveBeamReinforcement(beam, provider)`
  ΧΩΡΙΣ overrides → ο πίνακας ρ% **δεν** ήταν topology-aware (drift από το docstring που υπόσχεται parity με
  2Δ/3Δ/PDF). **Υλοποίηση (FULL SSoT, mirror `BeamTorsionStore`):** NEW transient `BeamFlangeStore`
  (`createDerivedMapStore<number>`, N.0.2 boilerplate)· NEW **pure** `buildBeamFlangeWidthMap(entities,
  coveringHosts, supportTypeByBeamId)` που **reuse-άρει τον ΙΔΙΟ detector** `resolveBeamEffectiveFlangeWidthMm`
  (μένει pure — ο organism core χτίζει τα hosts μέσω `buildCeilingSlabHosts`, όπως `BeamDetailHost`/`BeamPropertiesTab`)·
  ο `supportType` έρχεται από τον topology-aware χάρτη του ίδιου pass → το `l_0` του b_eff συνεπές με τον οπλισμό.
  **Writer:** `structural-organism-core.runOrganismDiagnostics` γράφει το store στο ΙΔΙΟ low-freq pass (ADR-040
  safe) δίπλα στα Torsion/Span/MaxWidth. **Reader:** `resolveActiveBeamFlangeWidthMm(beamId)` (mirror
  `resolveActiveBeamTorsion`). **Consumers:** `resolveActiveBeamReinforcement` πήρε 6ο optional param
  `effectiveFlangeWidthMm` → `buildBeamSectionContext`· `resolveActiveBeamReinforcementForEntity` περνά πλέον το
  store value (→ live 2Δ/3Δ rebar + PDF schedule). **Bridge unification (SSoT fix του drift):** η panel
  `effectiveReinforcement` δρομολογείται πλέον μέσω του store-coupled `resolveActiveBeamReinforcementForEntity`
  (αντί της pure χωρίς overrides) → ο πίνακας καταναλώνει τα ΙΔΙΑ DERIVED μεγέθη (b_eff **+ στρέψη/στήριξη/άνοιγμα**,
  που έλειπαν λόγω drift) με 2Δ/3Δ/PDF· fallback (απών οπλισμός) επίσης flange/support-aware. **⚠️ Behavioral
  implication (flag → browser-verify):** η ενοποίηση φέρνει στο panel ρ% ΚΑΙ τα topology effects (cantilever/
  continuous/torsion) που το docstring ήδη υπόσχεται αλλά ο κώδικας δεν εφάρμοζε — όχι μόνο b_eff. Σωστή SSoT
  σύγκλιση, αλλά ορατή αλλαγή στο ρ% topology-aware δοκών. **Scope boundary:** ο member-agnostic facade
  `resolveActiveMemberReinforcement` (organism `reinforcement-checks`) ΔΕΝ άλλαξε (μένει b_w → μηδέν regression
  στους ρ-checks). **Tests: +4 GREEN** (`derive-beam-flange-width`: covered→b_eff / continuous→μικρότερο /
  no-host→empty / non-beam skip)· flange regression 22/22 GREEN. ⚠️ Pre-existing HEAD failures (όχι δικά μου,
  handoff-flagged): `reinforcement-checks` raft (`maxFreeSpanM`). **ADR-040 ΔΕΝ αφορά** (organism core = low-freq
  pass· bridge = panel· μηδέν canvas/3D converter — CHECK 6B/6D εκτός). tsc SKIP (N.17 OOM)· verify με ts-jest +
  static import check. 🔴 browser-verify (Giorgio): δοκός-πλακοδοκός κάτω από πλάκα → υψηλότερος cap σαγκ. ροπής
  → πιθανώς λιγότερος κάτω διαμήκης σε φορτισμένη T-δοκό (vs ορθογώνια)· panel ρ% === PDF schedule. **DEFER:**
  Φ3c-B2 (edge/L-beam `flangeSides:1`), Φ3c-B3 (finish/rebar soffit clip).
- **2026-06-26 (Φ3c-A — `b_eff` read-only γραμμή στο ΑΡΙΣΤΕΡΟ panel δοκού, COMMITTED aa1a0cd0)** — Giorgio order
  (μετά το Φ3b): η DERIVED `b_eff` να φαίνεται και ως Revit instance property στο docked Properties panel
  («Στατικά / Οπλισμός»), όχι μόνο στο A3 title block. **RECOGNITION (N.0.1):** το panel δεν είχε geometry
  section — render-άρει τα `BEAM_PROPERTY_GROUPS` (editable rebar + read-only readouts όγκοι/ρ%) μέσω του
  κοινού `BimPropertyRow`. **FULL SSoT reuse (μηδέν νέος μηχανισμός):** ο υπολογισμός είναι ΑΚΡΙΒΩΣ ο ίδιος
  με το title block — `BeamPropertiesTab` (έχει ήδη `currentScene`) → `buildCeilingSlabHosts(slabs)` +
  `resolveBeamEffectiveFlangeWidthMm(beam, hosts, supportType)` + topology-aware `resolveActiveBeamSupportType`
  (mirror του μπλοκ στο `BeamDetailHost`) → `effectiveFlangeWidthMm?` prop στο `BeamAdvancedPanel`.
  **Υλοποίηση:** NEW data descriptor `BEAM_EFFECTIVE_FLANGE_FIELD` (read-only `BimPropertyField`, **εκτός**
  των groups γιατί είναι **scene-conditional** — όχι pure-from-beam bridge readout)· εξαγωγή
  `BeamAdvancedSection` subcomponent (functions ≤40γρ) που εισάγει τη γραμμή `b_eff` **ακριβώς πάνω από τα
  readouts** (κεφαλή του παραγόμενου μπλοκ)· value = `round(b_eff)` mm (ίδιο format με title block)· label i18n
  `beamAdvancedPanel.sections.structural.fields.effectiveFlangeWidth` = «b_eff (mm)» (el+en, N.11). Ορατή ΜΟΝΟ
  όταν πλάκα καλύπτει τη δοκό· γυμνή/ορθογώνια δοκός → `undefined` → καμία γραμμή. **Επιφύλαξη (πληροφοριακό):**
  το ρ/οπλισμός του panel ΔΕΝ καταναλώνει ακόμα το `b_eff` (αυτό = Φ3c-B1 live organism injection) — η γραμμή
  εδώ είναι καθαρή derived ετικέτα (ίδια σημασία με το title block σήμερα). **Tests: +1 GREEN** (descriptor:
  read-only / μη-bridge-key / εκτός groups)· `beam-property-fields` 10/10 GREEN. **ADR-040 ΔΕΝ αφορά** (UI
  panel, μηδέν canvas/3D converter — CHECK 6B/6D εκτός). tsc SKIP (N.17 OOM)· τα 2 `.tsx` επαληθεύτηκαν
  στατικά (import paths + signatures), όχι browser. 🔴 browser-verify (Giorgio): δοκός κάτω από πλάκα →
  γραμμή `b_eff` στο panel· γυμνή δοκός → κρυφή. **DEFER (Φ3c-B):** live auto-design injection (B1),
  edge/L-beam `flangeSides:1` (B2), finish/rebar soffit clip (B3).
- **2026-06-26 (Φ3b — T-beam `b_eff` EC2 §5.3.2.1, UNCOMMITTED)** — Giorgio order «όπως οι μεγάλοι
  παίκτες (Revit), full enterprise + full SSoT». **RECOGNITION (N.0.1, code=SoT):** το **BOQ net-of-overlap
  σκυροδέματος ΥΠΗΡΧΕ ΗΔΗ** (Φ3a) — `computeSlabGeometry.sumBeamDeductionsM3` (η πλάκα αφαιρεί
  `∩(πλάκα,δοκάρι)×min(beamDepth,slabThk)`, Revit Material Takeoff convention), wired μέσω
  `slab-boq-feed.collectBeamFootprints`, 28 jest GREEN (υλοποιήθηκε υπό **ADR-363 §5.5i+**, ο παλιός
  roadmap «Φ3 DEFER» ήταν stale → διορθώθηκε §3). Το δοκάρι κρατά πλήρη όγκο· **+ADR-458** net column-joint
  («η κολόνα νικάει»). → Το ουσιαστικό Φ3b = **T-beam `b_eff`**. **Υλοποίηση (FULL SSoT):** NEW pure
  `codes/effective-flange-width.ts` (`computeEffectiveFlangeWidthMm`, EC2 §5.3.2.1: `b_eff = b_w + Σ b_eff,i`,
  `b_eff,i = min(0.2·b_i+0.1·l_0, 0.2·l_0, b_i)`· `zeroMomentSpanFactor` l_0 = 1.0/0.7/2.0·l simple/συνεχ./
  πρόβολος, EC2 Σχ. 5.2)· NEW pure detector `beam-flange-context.ts` (`resolveBeamEffectiveFlangeWidthMm`,
  **reuse `hostUndersideAt`+`polygon2DCentroid`+`buildCeilingSlabHosts`** SSoT — καλύπτουσα πλάκα→T-beam·
  γυμνή δοκός→`undefined`→`b_w`, μηδέν regression). **Section property:** `BeamSectionContext.effectiveFlangeWidthMm?`
  (DERIVED, geometry-is-SSoT optional override όπως `supportTypeOverride`/`designTorsionKnm`)· `buildBeamSectionContext`
  6ο optional param (κρατιέται μόνο `> b_w`). **Flexural-cap wiring (πραγματική μηχανική αξία):** στο
  `suggestBeamReinforcementFrom` η **σαγκ. (θετική) ροπή** χρησιμοποιεί `b_eff` ως πλάτος θλιβόμενης ζώνης
  (`flexuralCompressionWidthMm`: simple→b_eff, hogging συνεχ./πρόβολος→`b_w` κορμός) → υψηλότερο `M_Rd,lim`
  του T-beam· **regression-safe** (ο cap ενεργοποιείται μόνο υπό φορτίο M_Ed>0· αφόρτιστα→byte-for-byte).
  **Report:** title block δοκού «b_eff (mm)» (host υπολογίζει scene-aware μέσω του detector· i18n `beamDetail.
  titleFields.effectiveFlangeWidth` el+en). **Tests: 27 νέα GREEN** (10 flange-width + 5 detector + 3 cap-wiring
  + 9 detail-sheet incl. b_eff row)· **180/180 structural codes+detail-sheet regression GREEN**. ⚠️ Pre-existing
  HEAD failure (όχι δικό μου): `reinforcement-checks` raft fixture χωρίς `maxFreeSpanM` (git-verified αμετάβλητο
  στο working tree). **DEFER (Φ3c):** live **auto-design** injection του `b_eff` μέσω organism store (mirror
  `BeamTorsionStore` — το cap wiring είναι έτοιμο)· edge/L-beam (πλάκα μία πλευρά→`flangeSides:1`) auto-detect·
  finish/rebar soffit clip· I-shape steel clip. ADR-040 ΔΕΝ αφορά (μηδέν αλλαγή canvas/3D converters· ο
  detector είναι pure structural). tsc SKIP (N.17 OOM — verified με 207 ts-jest). 🔴 browser-verify (άνοιγμα
  beam detail δοκού κάτω από πλάκα → γραμμή «b_eff» στο title block) + commit (Giorgio· stage ADR-534 + adr-index).
- **2026-06-26 (Φ4 — ceiling soffit finishes, Revit-grade, UNCOMMITTED)** — Giorgio: «όπως οι μεγάλοι
  παίκτες (Revit), full enterprise + full SSoT». **Μοντέλο (D, Revit-correct):** το ceiling finish είναι
  **property της πλάκας** (`SlabParams.soffitFinish = {materialId}`), ΟΧΙ free-floating οντότητα — όπως η
  Revit μοντελοποιεί το ceiling finish ως υλικό/βαφή στην παρειά (RCP), bay=πλάκα 1:1. **FULL SSoT:** reuse
  του υπάρχοντος `wall-covering-material-catalog` (μία πηγή paint/plaster για τοίχους **ΚΑΙ** οροφές· +`paint-
  yellow` +`plaster-spackle` σπατουλαριστό)· reuse `UpdateSlabParamsCommand` (undoable/mergeable), slab
  contextual tab, slab persistence (**δωρεάν** — params serialized wholesale· +`soffitFinish` στο `.strict()`
  Zod schema), render helpers (`hexToRgba`/`adaptFillTintForCanvas`/`extrudeAndRotate`). **Render:** 2D RCP
  swatch (`SlabRenderer.drawSoffitFinishTint`, ceiling-gated) + 3D λεπτή χρωματιστή στρώση κάτω από το soffit
  (`bim-three-slab-converter.attachSoffitFinish`, Group upgrade). **UI:** panel «Φινίρισμα οροφής» στο slab
  contextual tab, gated `kind==='ceiling'` (νέο visibility key `ceilingFinish` + `resolveSlabPanelVisibility`)·
  bridge string-branch (`SELECT_CLEAR_VALUE` → undefined, mirror fireRating). Κάθε φάτνωμα ανεξάρτητο finish.
  **Tests: 132 GREEN** (catalog +2 υλικά· `.strict()` schema round-trip soffitFinish· ceilingFinish visibility
  gating· + slab/renderer/converter/dna regression). ⚠️ Radix Select fix (linter): `value=''`→`SELECT_CLEAR_
  VALUE` στο tab + bridge. ADR-040 ΔΕΝ αφορά (slab discipline). **DEFER:** IFC IfcCovering CEILING export·
  bulk «apply to all bays»· auto-default finish στη δημιουργία bay· texture/PBR (paint=flat χρώμα). 🔴
  browser-verify (μπλε/κίτρινο/σοβάς ανά φάτνωμα σε 3D soffit + 2D swatch) + Firestore re-check + commit.
- **2026-06-26 (Φ2 — υποδιαίρεση σε φατνώματα + per-bay πάχος, UNCOMMITTED)** — Giorgio order μετά το v4.
  Το ενιαίο περίγραμμα (v4 union) γίνεται **master region** και **υποδιαιρείται σε φατνώματα** από τους
  **άξονες των εσωτερικών δοκαριών** (location lines, ADR-529) + τις **κεντρικές γραμμές τοιχίων**, με τον
  ΙΔΙΟ SSoT `findClosedPolygonsFromLines` (NEW `bim/slabs/ceiling-bay-subdivision.ts`). **DXF χωρίσματα +
  τόξα πορτών ΔΕΝ μπαίνουν** στους κόπτες → μηδέν artifacts v3. **Internal-only φίλτρο:** οι άξονες
  περιμετρικών δοκαριών (hug την παρειά) απορρίπτονται → η πλάκα καλύπτει ΟΛΟ το περίγραμμα (T-beam flange,
  όπως v4)· επέκταση κοπτών πέρα από το όριο (ο άξονας σταματά half-width πριν την παρειά → δεν τεμαχίζει).
  **Per-bay πάχος (EC2 §7.4.2 l/d):** NEW `ceiling-bay-thickness.ts` → structural SSoT. Στο `slab-sizing.ts`
  ο κοινός πυρήνας **`sizeSlabFromContext`** εξήχθη (μηδέν duplicate)· NEW **`suggestSupportedSlabThickness`**
  (αμφιέρειστη K=1.0 / συνεχής K=1.5· span = `maxFreeSpanMm` shorter-dim· χωρίς φορτίο → κυριαρχεί το l/d).
  **Scoped (Giorgio):** το `suggestSlabThickness` μένει **byte-for-byte cantilever-only** → ο proactive
  auto-sizer ΔΕΝ αγγίζει υπάρχουσες στηριζόμενες πλάκες (μηδέν regression, συμβατό ADR-499). Ο orchestrator
  (`ceiling-slab-commit`) resolve-άρει τον active provider (ίδιο SSoT με τον member auto-sizer) → inject
  `bayThickness` callback· ο pure builder μένει provider-agnostic (optional callback). K-table ήδη υπήρχε
  (`eurocodeSpanDepthSystemFactor`, slab basic l/d=20). **Tests:** ceiling-bay-subdivision (5: χωρίς κόπτες→1,
  1 εσωτ.→2, σταυρός→4, hugging→φιλτράρεται, ασύμμετρος→διαφορετικά spans) + ceiling-slab-from-structure (+3:
  σταυρός→4, per-bay πάχος από span, DXF χώρισμα→1) + slab-sizing (+6: supported 4m→230, continuous λεπτότερο,
  μονότονο, regression `suggestSlabThickness(simple)`→ΑΚΟΜΗ undefined). 93 tests GREEN (incl. regression).
  ADR-040 ΔΕΝ αφορά (καθαρά slab discipline, καμία αλλαγή 3D converters). **DEFER:** clip boundary-beam στο
  χαμηλότερο γειτονικό soffit· shear-wall κολόνες ως dividers· two-way continuity ανά πλευρά· BOQ net (Φ3).
  🔴 browser-verify (σκηνή Giorgio: N φατνώματα, λεπτότερα→λεπτότερη πλάκα, soffit step) + commit.
- **2026-06-26 (§monolithic-cut — καθαρό 3D, μηδέν z-fighting)** — Giorgio: η πλάκα φτάνει σωστά στην
  εξωτερική παρειά & καλύπτει δοκάρια/κολόνες (T-beam, σωστό), αλλά στο 3D «παλεύουν τα χρώματα» (z-fighting:
  beam top == slab top == 3000 → επικάλυψη όγκων). **Fix (render-only, Revit «Join Geometry»):** το ορατό 3D
  στερεό δοκαριού/κολόνας **κόβεται στο soffit της καλύπτουσας πλάκας** (`levelElevation − thickness`) → η
  πλάκα καπακώνει καθαρά, κρέμεται το downstand κάτω, μηδέν z-fighting. **Δομικό ύψος αμετάβλητο** (η πλάκα =
  πέλμα). **FULL SSoT reuse:** `slabHostInput` (soffit) + `hostUndersideAt` (point-in-slab) — οι ΙΔΙΕΣ που
  κόβουν ΗΔΗ τις attached κολόνες. NEW `bim-3d/scene/monolithic-slab-clip.ts` (`buildCeilingSlabHosts` +
  `resolveMemberTopClipZmm`)· `beamToMesh`/`columnToMesh` += optional `clipTopZmm` (box-extrude / flat+attached
  paths· no-op όταν δεν δοθεί → byte-for-byte)· wiring σε `BimSceneLayer.syncBeams` + `bim-scene-attach-syncs.
  syncColumns`. 5 helper + 73 converter regression GREEN. **DEFER:** BOQ net-of-overlap· finish/rebar exact
  clip· I-shape steel clip. 🔴 browser-re-verify (stage ADR-040+534 — CHECK 6B/6D 3D converters).
- **2026-06-26 (v4 — DXF+BIM combined, ΕΝΙΑΙΟ περίγραμμα)** — **Browser-verify v3:** «no-footprint» toast.
  **Ρίζα (Firestore-verified):** το δομικό πλαίσιο του Giorgio **ΔΕΝ κλείνει** μόνο από δοκάρια+κολόνες —
  η **πάνω πλευρά δεν έχει δοκάρι** (κενό ~4.85m ανάμεσα στην πάνω-αριστερή & πάνω-δεξιά κολόνα)· κλείνει
  από **DXF τοίχο**. Το v3 (`computeBuildingFootprint`, μόνο BIM) δεν την έβλεπε → κανένα hole. **Giorgio:
  πώς να χειριστούμε DXF+BIM συνύπαρξη;** **Fix v4:** ΕΝΑ γράφημα ακμών = **DXF γραμμές + ΑΚΜΕΣ δοκαριών/
  κολόνων** → `findClosedPolygonsFromLines` (gap-bridging πορτών) → όλα τα faces → **`safeUnion`** → **ΕΝΙΑΙΟ
  περίγραμμα κτιρίου** (outer ring κάθε union polygon, γεμάτο). Έτσι: πλευρά-DXF + πλευρά-δοκάρι κλείνουν
  μαζί· εσωτερικά χωρίσματα + τόξα πορτών **διαλύονται**· η πλάκα καλύπτει & τα δομικά μέλη (μονολιθικά).
  Φίλτρο **υδραυλικού πλάτους** (≥600mm) κόβει μεμονωμένα δοκάρια (thin strips). Tests: καθαρό πλαίσιο→1,
  **μικτό 3 DXF + 1 δοκάρι→1**, DXF+χώρισμα→1 (διαλυμένο), single beam→no-bays. 7 ceiling + 25 slab GREEN.
  🔴 browser-re-verify. **DEFER:** υποδιαίρεση σε φατνώματα από **εσωτερικά** δοκάρια (τώρα→ΕΝΙΑΙΑ).
- **2026-06-26 (v3 — οριστική προδιαγραφή Giorgio)** — **Browser-verify v2:** κάλυψε ΜΟΝΟ το ένα δωμάτιο
  (το άλλο είχε ευθύ άνοιγμα πόρτας) + ακολούθησε τόξα πορτών. **Οριστική προδιαγραφή Giorgio:** η
  ανίχνευση πρέπει να γίνεται από την **ύπαρξη/θέση ΔΟΚΑΡΙΩΝ & ΚΟΛΩΝΩΝ** (+ τοιχία), ΟΧΙ από DXF γραμμές·
  **ΕΝΙΑΙΑ** πλάκα όσο δεν διακόπτεται από δομικό μέλος· DXF εσωτερικοί τοίχοι + τόξα πορτών **αγνοούνται**.
  **Fix:** χρήση των **`computeBuildingFootprint(walls, columns, beams).holes`** = τα **εσωτερικά κενά** που
  περικλείει το δομικό πλαίσιο. 1 hole (καμία εσωτερική διακοπή) → 1 ΕΝΙΑΙΑ πλάκα· εσωτερικά δοκάρια/τοιχία
  → N holes = N φατνώματα (το union τα διαχωρίζει). Μόνο BIM μέλη μετράνε → DXF/πόρτες αγνοούνται by
  construction. Tests ξαναγράφτηκαν: περιμετρικό→1, σταυρός→4, single beam→no-bays, DXF-only→no-bays. 7
  ceiling + 25 slab regression GREEN. 🔴 browser-re-verify. **DEFER:** εξωτερική-παρειά επέκταση (κάλυψη &
  των δοκαριών — τώρα φτάνει στο εσωτερικό κενό).
- **2026-06-26 (v2 — root fix)** — **Browser-verify v1 ΑΠΕΤΥΧΕ:** οι πλάκες έβγαιναν **λεπτές λωρίδες
  ΠΑΝΩ στα δοκάρια** αντί να σκεπάζουν τα δωμάτια (Firestore-verified: 5 slabs με outline = beam strips
  210/200/188mm). **Ρίζα:** η περίμετρος/τοίχοι ήταν **DXF γραμμές**, αλλά το `computeBuildingFootprint`
  βλέπει **μόνο BIM** δοκάρια/κολόνες → το «αποτύπωμα» ήταν το πλαίσιο δοκαριών. **Fix:** μετάβαση σε
  **room detection** (`extractLineSegments` → `findClosedPolygonsFromLines`, ο ΙΔΙΟΣ μηχανισμός με τη
  γραμμοσκίαση· διαβάζει DXF γραμμές, ΟΧΙ δοκάρια) + sliver filter (υδραυλικό πλάτος). Builder signature
  `(entities, …)`. Tests ξαναγράφτηκαν: 1 δωμάτιο→1 πλάκα, διπλός τοίχος→2 (λωρίδα φιλτράρεται),
  beam-only→no-rooms (το v1 bug). 6 ceiling + 25 slab regression GREEN. 🔴 browser-re-verify + undo των 5
  λάθος v1 slabs.
- **2026-06-26 (v1)** — **Φ1 IMPLEMENTED (UNCOMMITTED).** Bay detection member-based (computeBuildingFootprint
  ΜΕΙΟΝ εσωτερικά δοκάρια+κολόνες, εξωτερική ακμή = εξωτερική παρειά)· flush top = beam.topElevation·
  `kind='ceiling'`· ribbon action «Πλάκα οροφής (auto)». **SSoT extraction:** `regionMinusSubtrahends`
  + `collectSubtrahends` εξήχθησαν από `bayOutline` (κοινά grid + ceiling). **Bug fix (cut bridge):**
  εσωτερικοί κόπτες επεκτείνονται πέρα από το όριο ώστε να κόβουν πλήρως τα φατνώματα (τα περιμετρικά
  δοκάρια προεξέχουν → 125mm γέφυρα κρατούσε 1 region). Tests: ceiling-slab-from-structure (3) +
  ceiling-slab-commit (3) + slab-from-grid/grid-commit regression (25) GREEN. ⚠️ Προϋπάρχον (HEAD)
  failing test: `structural-tab` type-88 (`type:'dropdown'` του ADR-521 column-types — άλλος agent, ΟΧΙ
  αυτή η αλλαγή). 🔴 browser-verify + Firestore re-check + commit (Giorgio· stage ADR-534 + adr-index +
  ADR-436 pointer). DEFER Φ2-4.
