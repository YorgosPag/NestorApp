# ADR-685 — Έδραση βάσης σκάλας στην πλάκα δαπέδου + SSoT μηδενικής διπλομέτρησης σκυροδέματος

- **Status**: 🟡 Φ1 DONE (ανίχνευση/ταξινόμηση + attach-coordinator seat gate ✅ · BOQ
  διπλομέτρηση-guard wired ✅) + **Φ1b DONE** (3D terminating trim του μηρού στην underside της
  πλάκας-έδρασης, §4.3 · **uncommitted**) — Φ2 (pass-through opening) 🔵 PROPOSED
- **Ημερομηνία**: 2026-07-22
- **Domain**: DXF Viewer / BIM 3D (σκάλες · πλάκες · BOQ)
- **Σχετικά**: ADR-632 (stairwell auto-opening — ο mirror/δίδυμος αυτού του ADR) · ADR-401 Phase G
  (attach-to-structural — ξαναχρησιμοποιείται εδώ) · ADR-358 (stair tool) · ADR-395 (stair BOQ
  quantities) · ADR-441 (raft δεν είναι auto-attach host) · ADR-499 / ADR-534 (structural organism
  sizing πλακών)

---

## 1. Context — το πρόβλημα

Μια μονολιθική σκάλα, στη **βάση** της, συχνά βυθίζεται μέσα στον οπλισμένο πυρήνα (180mm) της
πλάκας δαπέδου. Ο όγκος σκυροδέματος της σκάλας και ο όγκος σκυροδέματος της πλάκας
**επικαλύπτονται** στη ζώνη βάσης → η ίδια «φέτα» μπετόν μετριέται **δύο φορές** στην Προμέτρηση
(BOQ): μία ως πλάκα, μία ως σκάλα.

Απαίτηση (Giorgio): **πλήρως αυτοματοποιημένη** λύση, επιπέδου Revit/ArchiCAD —

1. **Διάκριση** αν η σκάλα **διαπερνά** την πλάκα (κατεβαίνει σε υπόγειο/κατώτερο όροφο → χρειάζεται
   άνοιγμα) ή απλώς **τερματίζει** πάνω της (κάθεται στην πλάκα → έδραση + ένας ιδιοκτήτης κοινού
   σκυροδέματος).
2. **Real-time** ανάγνωση πάχους πλάκας από τον structural organism (αν το πάχος αλλάξει, η έδραση
   ακολουθεί αυτόματα, χωρίς χειροκίνητο re-sync).

## 2. Ground truth βιομηχανίας (Revit / ArchiCAD)

| Περίπτωση | Revit/ArchiCAD συμπεριφορά |
|---|---|
| **Τερματίζουσα σκάλα** (terminating) | Η βάση κάθεται στην **άνω παρειά** της πλάκας (Revit *Base Offset* = 0 σχετικά με το host). Ο κοινός/επικαλυπτόμενος όγκος ανήκει σε **έναν** ιδιοκτήτη — ποτέ διπλομέτρηση (Revit *Join Geometry*). |
| **Διαπερνούσα σκάλα** (pass-through) | Η πλάκα ανοίγει (Shaft/Slab opening), **ασσοσιατιβικά** — παρακολουθεί/regenerate σε κάθε αλλαγή θέσης/γεωμετρίας. |

## 3. Αποφάσεις (Giorgio, 2026-07-22)

1. Δύο ξεχωριστές σχέσεις βάσης↔πλάκας: `seat` (έδραση) / `pass-through` (διάτρηση, Φάση 2) /
   `floating` (αιωρούμενη — ο ήδη υπάρχων ADR-401 pull-down τη χειρίζεται).
2. **Reuse-first**: καμία νέα μηχανική — ο υπάρχων base-attach μηχανισμός (ADR-401 Phase G.3)
   επεκτείνεται, ΔΕΝ αντικαθίσταται.
3. Ο κοινός όγκος σκυροδέματος αφαιρείται από τη γραμμή BOQ **της σκάλας** (η πλάκα κρατά τον πλήρη
   όγκο της — «ένας ιδιοκτήτης», Revit Join Geometry parity).
4. Φάση 2 (άνοιγμα σε pass-through) **ΔΕΝ** υλοποιείται τώρα — μόνο σχεδιάζεται (§8).

## 4. Αρχιτεκτονική — reuse-first (SSoT)

Το βασικό μηχανισμό **ΗΔΗ** υπήρχε: ο αυτόματος base-attach της σκάλας (ADR-401 Phase G.3—
`findStairsToAutoAttachBaseToHost` + `AttachStairsCommand('base', …)` + `resolveStairBaseZmm`,
που τοποθετεί τη βάση στην ψηλότερη top-face host όταν `baseBinding === 'attached'`). Τόσο το 3D
όσο και το 2D διαβάζουν **αποκλειστικά** το ψημένο `basePoint.z` μέσω
`resolveEffectiveStairParams` / `applyStairVerticalProfile` → `computeStairGeometry` — **όχι** μέσω
του ξεχωριστού `baseY` του 3D converter. Άρα υπάρχει ήδη **ένα** SSoT που οδηγεί ταυτόχρονα 2D+3D,
και το real-time πάχος πλάκας έρχεται **δωρεάν**: μόλις η σκάλα γίνει `attached`, το
`resolveStairBaseZmm` ξαναδιαβάζει τη ζωντανή top-face της πλάκας σε κάθε render — μια αλλαγή
πάχους από τον organism μετακινεί τη βάση αυτόματα.

**Το κενό ήταν μόνο ανίχνευσης.** Η υπάρχουσα Z-πύλη
(`bim/stairs/stair-structural-attach-coordinator.ts`, βλ. §4.1) τραβούσε ΜΟΝΟ μια **αιωρούμενη**
σκάλα ΠΡΟΣ ΤΑ ΚΑΤΩ σε χαμηλότερο host· **ποτέ** δεν ανασήκωνε μια **βυθισμένη/co-planar** βάση
πάνω στην πλάκα στην οποία βυθίζεται.

### 4.1 Νέα modules (Φ1, uncommitted)

| Module | Ρόλος |
|---|---|
| `bim/geometry/stairs/stair-base-slab.ts` **(NEW)** | Καθαρή (pure) ταξινόμηση: `classifyStairBaseRelation(baseZmm, slabTopZmm, slabUndersideZmm, eps) → 'seat' \| 'pass-through' \| 'floating'` (`base < underside−eps` → pass-through· `underside−eps ≤ base ≤ top+eps` → seat· αλλιώς floating) + `findSlabToSeatStairBase` (καλύτερη υποψήφια πλάκα, ψηλότερη top-face προτεραιότητα) + `computeStairWaistSlabOverlapVolumeM3` (waist-prism εντός ζώνης πλάκας: `width·waist·min(t/sinθ, steps·hyp)`, ΟΧΙ bbox×thickness — βλ. §4.2). Είναι ο **mirror** του `stair-slab-overlap.ts` (ADR-632, που ανιχνεύει την πλάκα ΑΠΟ ΠΑΝΩ) — εδώ ανιχνεύεται η πλάκα ΣΤΗ ΒΑΣΗ. Reuse: `footprintOverlapArea`, `HOST_Z_EPS`, τα candidate types του ADR-632. |
| `bim/stairs/stair-structural-attach-coordinator.ts` **(MODIFIED)** | Νέα κοινή SSoT πύλη `stairBaseAttachesToHost(baseZmm, hostInput)` (γρ. 70-81) = `pullsDown \|\| seats` (`seats` μέσω `classifyStairBaseRelation(...) === 'seat'`), απορρίπτει ρητά `pass-through`. Τη χρησιμοποιούν **και** το επεκταμένο `findStairsToAutoAttachBaseToHost` (host-πρώτα) **και** το νέο αντίστροφο `findHostsToSeatStairBase` (σκάλα-πρώτα, mirror του `findHostsToAttachWallBase` του τοίχου) — mirror του pattern πλάκα-πρώτα/τοίχος-πρώτα. Εξαιρεί ρητά τα `foundation` raft slabs (ADR-441 parity, γρ. 169). |
| `hooks/useStructuralAutoAttach.ts` **(MODIFIED)** | Νέο `attachStairBaseToSurroundingHosts` (γρ. 189-200), καλείται σε `drawing:entity-created` όταν `isStairEntity(created)` (γρ. 258) — «νέα σκάλα πάνω σε υπάρχον δάπεδο» φορά, που το host-created path (φορά 1) δεν πιάνει (η σκάλα σχεδιάζεται ΜΕΤΑ την πλάκα). |

**N.6 (enterprise IDs):** καμία νέα Firestore οντότητα — η έδραση είναι update υπάρχουσας σκάλας
μέσω του ήδη υπάρχοντος `AttachStairsCommand`.

**N.18 (jscpd self-guard):** ο κοινός gate `stairBaseAttachesToHost` μοιράζεται και τις δύο
κατευθύνσεις (host-πρώτα / σκάλα-πρώτα) — αποφεύγει sibling-clone του ίδιου Z-ελέγχου σε δύο σημεία.

### 4.2 BOQ διπλομέτρηση-guard — DONE (μοντέλο waist-prism + wiring)

Η ίδια η έδραση **ΔΕΝ** αφαιρεί το διπλομέτρημα: αφού η βάση ανασηκωθεί στο top-face της πλάκας,
το μονολιθικό «σκαρί» (waist) της σκάλας συνεχίζει να βυθίζεται ~ένα ριχτί + πάχος σκαριού
(+40mm) ≈ ~430mm κάτω από την top-face — διαπερνώντας πλήρως τον πυρήνα των 180mm. Αυτό είναι
**εγγενές** σε μονολιθικό σκαρί, όχι bug· άρα ο **guard όγκου** στο BOQ δεν είναι απλώς
belt-and-suspenders, είναι **απαραίτητος**.

Ο guard είναι **πλήρως wired** (Φ1):

- **Μοντέλο όγκου (`computeStairWaistSlabOverlapVolumeM3`, `stair-base-slab.ts`):** ο κοινός όγκος =
  διατομή σκαριού × κεκλιμένο μήκος εντός της ζώνης πλάκας = `width · waist · min(slabThickness/sinθ,
  stepCount·hyp)`. ⚠️ **ΟΧΙ** `overlapArea × thickness`: το bbox footprint καλύπτει ΟΛΟ το αποτύπωμα,
  αλλά μόνο ο μηρός των πρώτων ~2 βαθμίδων τέμνει τη ζώνη πλάκας (οι υπόλοιπες ανεβαίνουν πάνω) — το
  naive μοντέλο υπερ-αφαιρούσε ~10× (σοβαρή υπο-μέτρηση). Η έδραση (§4.1) ΔΕΝ αλλάζει αυτόν τον όγκο
  (ο τύπος ποσοτήτων είναι Z-ανεξάρτητος) → **όλη η διόρθωση διπλομέτρησης βαραίνει αυτόν τον guard**.
- **Bridge (`bim/services/stair-slab-embedment.ts`):** scene→pure — χτίζει `StairFootprintInput` (bbox +
  effective `baseZmm`/`topZmm`) + `StairwellSlabCandidate[]` (`buildStairwellSlabCandidates`), βρίσκει
  την πλάκα-έδρασης (`findSlabToSeatStairBase`), υπολογίζει τη διατομή από τα **effective** params
  (`resolveEffectiveStairParams` — ΙΔΙΑ SSoT με το BOQ concrete). `undefined` όταν αιωρείται/διαπερνά/
  χωρίς σκηνή.
- **Context + αφαίρεση (`stair-boq-sync.ts`):** νέο προαιρετικό `StairBoqContext.embeddedOverlapVolumeM3`·
  στο `upsertStairBoq` αφαιρείται από το `q.concreteVolumeM3` με `Math.max(0, …)` **μόνο** στη γραμμή
  σκυροδέματος της σκάλας (`OIK-2.05`) — η πλάκα κρατά πλήρη όγκο (ένας ιδιοκτήτης).
- **Wiring (`bim/hooks/use-stair-persistence.ts`):** `resolveEmbeddedOverlapVolumeM3(entity)` (ΙΔΙΟ
  scene access με `buildStairHostResolver`) → περνά στο context του `upsertStairBoq` σε κάθε save.

### 4.3 3D terminating trim — Φ1b (η σκάλα ΠΑΤΑΕΙ στην πλάκα, δεν κρέμεται από κάτω)

**Πρόβλημα:** η έδραση της Φ1 (`basePoint.z` στο slab top) είναι Z/οπτική ΜΟΝΟ και **δεν κόβει τον
μονολιθικό μηρό**. Ο waist βυθίζεται `rise + waist/cosθ (+40mm WAIST_DROP) ≈ 430mm` κάτω από το
top-face → με πλάκα 285mm **διαπερνά και κρέμεται κάτω από την κάτω παρειά** (screenshot 2026-07-22).
Big-player parity (Revit *Join Geometry*): ο μηρός **γεμίζει μονολιθικά τη ζώνη πλάκας** και κόβεται
flush με το **soffit** της — ποτέ δεν προεξέχει από κάτω· ο κοινός όγκος μετριέται μία φορά (= το Φ1
BOQ dedup).

**Λύση (reuse-first, ΕΝΑΣ detector):** επέκταση του bridge `stair-slab-embedment.ts` με
`resolveStairBaseSlabSeat(stair, slabs, ctx) → { slabTopZmm, slabUndersideZmm, slabThicknessMm,
baseZmm, embeddedVolumeM3 }`. **ΙΔΙΟ** `findSlabToSeatStairBase` με το BOQ → μηδέν απόκλιση. Το
`computeStairBaseSlabEmbeddedVolumeM3` έγινε thin wrapper (`?.embeddedVolumeM3`).

| Αρχείο | Ρόλος |
|---|---|
| `bim/services/stair-slab-embedment.ts` **(MODIFIED)** | Νέα `resolveStairBaseSlabSeat` (ΕΝΑ detection → BOQ όγκος + underside για trim)· volume-fn = wrapper. |
| `bim-3d/converters/stair-waist-slabs.ts` **(MODIFIED)** | `flightSectionPoints(…, soffitFloorY?)` κόβει τον soffit της **base flight** επίπεδα στο `soffitFloorY` (εισάγει την κορυφή τομής → επίπεδη έδραση, ο upper soffit αμετάβλητος). `buildFlightWaist`/`buildWaistSlabMeshes` δέχονται world-Y clip (μόνο gi===0). Νέο SSoT predicate `stairHasSolidWaist` (gate μονολιθικού μηρού, μοιράζεται με το seat resolution). |
| `bim-3d/converters/StairToThreeConverter.ts` **(MODIFIED)** | `stairToMeshes(…, baseSlabUndersideZmm?)` → `buildWaistMeshes` υπολογίζει `soffitClipWorldY = baseY + underside·sceneToM + waistDropM` (**pre-compensate** το επακόλουθο `−=WAIST_DROP` ώστε το επίπεδο base να προσγειώνεται flush στην underside). **+ base-tread skip:** όταν εδράζεται (`baseSlabUndersideZmm !== undefined`), το `buildTreadMeshes(…, skipBaseTread)` παραλείπει **μόνο** το finish πάτημα (40mm) της **χαμηλότερης** βαθμίδας — το δάπεδο (πλακίδια) το καλύπτει· το ρίχτι + οι υπόλοιπες βαθμίδες μένουν (Giorgio 2026-07-22). pass-through → κρατά το πάτημα. |
| `bim-3d/scene/BimSceneLayer.ts` **(MODIFIED)** | `syncStairs`: `stairHasSolidWaist(stair) ? resolveStairBaseSlabSeat(stair, entities.slabs, {resolveHostInput}) : undefined` → περνά `seat?.slabUndersideZmm`. Ίδιο slab set με τον host resolver· **ανεξάρτητο του attach** (self-correcting για ήδη-σχεδιασμένες σκάλες). |

**Datum:** `slabUndersideZmm` level-relative mm (ίδιο datum με `basePoint.z`)· ρέει μέσα από `sceneToM`
πανομοιότυπα με τις re-entrant corners → μηδέν μετατροπή. **pass-through / floating / no-slab → `undefined`
→ κανένα trim** (ο μηρός διαπερνά σωστά προς την τρύπα Φ2).

## 5. Tests (Φ1, uncommitted)

- `bim/geometry/stairs/__tests__/stair-base-slab.test.ts` — **14/14 πράσινα** (ταξινόμηση seat/
  pass-through/floating στα όρια eps, `findSlabToSeatStairBase` επιλογή ψηλότερης top-face,
  `computeStairWaistSlabOverlapVolumeM3` waist-prism μοντέλο + cap + clamp + «≪ naive bbox×thickness»).
- `bim/stairs/__tests__/stair-structural-attach-coordinator.test.ts` — **21/21 πράσινα** (επέκταση:
  seat-case attach και για τις δύο κατευθύνσεις, pass-through ΔΕΝ attach-άρει, raft foundation
  εξαιρείται, pull-down αμετάβλητο regression).
- `bim/services/__tests__/stair-slab-embedment.test.ts` — bridge (θετικός waist-prism όγκος σε seated
  σκάλα, undefined σε null-scene/χωρίς πλάκες/floating/pass-through/χωρίς overlap).
- `bim/services/__tests__/stair-boq-sync.test.ts` — αφαίρεση `embeddedOverlapVolumeM3` από concrete row,
  clamp ≥0 (→ delete row), absent → nominal. **Συνολικά BOQ+pure: 40/40 πράσινα.**

**N.17**: tsc/typecheck **ΔΕΝ** τρέχει από τον πράκτορα (ratchet CHECK 3.29 στο CI καλύπτει το
dxf-viewer subapp).

## 6. Google-level checklist (N.7.2)

| # | Ερώτηση | Απάντηση |
|---|---|---|
| 1 | Proactive/reactive; | **Proactive** — η ανασήκωση γίνεται στο creation/attach lifecycle moment (ίδιο σημείο με το υπάρχον ADR-401 pull-down), όχι side-effect. |
| 2 | Race condition; | Όχι — καθαρές (pure) `classifyStairBaseRelation`/`findSlabToSeatStairBase`, μηδέν shared mutable state. |
| 3 | Idempotent; | Ναι — ο detector ξαναϋπολογίζει κάθε φορά· `stairBaseAttachesToHost` επιστρέφει ίδιο αποτέλεσμα σε επαναληπτική κλήση. |
| 4 | Belt-and-suspenders; | Ναι — primary path η γεωμετρική έδραση (attach coordinator)· safety-net η BOQ αφαίρεση (§4.2), wired στο `use-stair-persistence`. |
| 5 | Single Source of Truth; | Ναι — ένα `classifyStairBaseRelation`, ένας κοινός gate `stairBaseAttachesToHost` και για τις δύο κατευθύνσεις· ένα waist-prism μοντέλο όγκου. |
| 6 | Fire-and-forget/await; | Το attach τρέχει μέσα από undoable command (`AttachStairsCommand`, awaited από `execute`)· η BOQ αφαίρεση είναι σύγχρονη στο upsert path. |
| 7 | Ποιος κατέχει το lifecycle; | Ρητά ο `stair-structural-attach-coordinator.ts` (γεωμετρία/έδραση) + `stair-boq-sync.ts`/`use-stair-persistence.ts` (BOQ guard). |

**Δήλωση:**
```
✅ Google-level (Φ1): YES — γεωμετρική έδραση πλήρης/idempotent/SSoT (reuse ADR-401 attach, μηδέν
   νέος μηχανισμός) ΚΑΙ BOQ διπλομέτρηση-guard wired με φυσικά-σωστό waist-prism μοντέλο (ένας
   ιδιοκτήτης). Εκκρεμεί μόνο η Φ2 (pass-through opening) — ρητά scoped, ΟΧΙ gap της Φ1.
```

## 7. Phase plan

| Φ | Τι | Status |
|---|---|---|
| **1** | Ανίχνευση/ταξινόμηση σχέσης βάσης↔πλάκας (`stair-base-slab.ts`) + attach-coordinator seat gate (και οι δύο κατευθύνσεις) + BOQ waist-prism guard (wired) | ✅ DONE |
| **1b** | 3D terminating trim — ο μονολιθικός μηρός κόβεται flush στην underside της πλάκας-έδρασης (Revit *Join Geometry*), ίδιος detector με το BOQ (§4.3) | ✅ DONE (uncommitted) |
| **2** | Pass-through → άνοιγμα σε πλάκα/δάπεδο βάσης όταν η σκάλα συνδέει λειτουργικά κατώτερο όροφο | 🔵 PROPOSED (§8) |

## 8. Φάση 2 (pending — ΔΕΝ υλοποιείται τώρα)

**Πρόβλημα:** όταν η σκάλα είναι `pass-through` (η βάση της κατεβαίνει κάτω από την underside της
πλάκας βάσης — δηλ. συνδέει λειτουργικά έναν κατώτερο όροφο, π.χ. υπόγειο), χρειάζεται **άνοιγμα**
στην πλάκα/δάπεδο βάσης, ασσοσιατιβικό (regenerate-on-change) — mirror του ADR-632 (stairwell
auto-opening στην **οροφή**, εδώ στο **δάπεδο**).

**Πού ανήκει:** `hooks/data/useCrossLevelStairwellOpenings.ts` — το **μοναδικό** σημείο με την
πλήρη λίστα ορόφων κτιρίου (`buildingFloors: FloorOption[]`, με προσημασμένο `number`/`kind`/
`elevation`) + entities ανά όροφο + FFL. «Κατώτερος όροφος» = `StoreyFloorRef.number < current`.

**Νέα έννοια που απαιτείται:** «λειτουργική σύνδεση» — εξυπηρετεί ΑΥΤΗ η σκάλα το υπόγειο, ή κάποια
άλλη; **Deterministic από γεωμετρία**, όχι από ρητή σήμανση χρήστη: μια σκάλα είναι pass-through
**αν και μόνο αν** η βάση της διαπερνά κάτω από την underside της πλάκας βάσης (§4, `stair-base-
slab.ts`). Αν μια **άλλη** σκάλα ήδη εξυπηρετεί το υπόγειο, αυτή εδώ απλά δεν θα διαπεράσει
(θα βρει πλάκα να εδραστεί) → γίνεται τερματίζουσα by-construction. Καμία επιπλέον disambiguation
χρειάζεται.

**Reuse-first (Φ2 draft):** `resolveFloorElevationMm`, `buildActiveStoreyContext`,
`useFloorsByBuilding` — ήδη υπαρκτά precedents από το cross-level opening του ADR-632 (§8b εκεί).

## 9. Changelog

- **2026-07-22** — **Φάση 1b DONE (3D terminating trim), uncommitted.** Ο μονολιθικός μηρός κρεμόταν
  ~430mm κάτω από την πλάκα δαπέδου (285mm) → διαπερνούσε την κάτω παρειά (η Φ1 έδραση είναι Z/οπτική,
  δεν κόβει τον μηρό). Big-player parity (Revit *Join Geometry*): trim του base-flight soffit **flush
  στην underside** της πλάκας-έδρασης (§4.3). Επέκταση `stair-slab-embedment.ts` με
  `resolveStairBaseSlabSeat` (**ΕΝΑΣ** `findSlabToSeatStairBase` detector → BOQ όγκος + underside· το
  volume-fn έγινε wrapper → μηδέν drift). Geometry trim στο `stair-waist-slabs.ts`
  (`flightSectionPoints(…, soffitFloorY?)` επίπεδη έδραση + νέο SSoT gate `stairHasSolidWaist`)·
  threading `StairToThreeConverter.stairToMeshes(…, baseSlabUndersideZmm?)` με **WAIST_DROP
  pre-compensation** **+ base-tread skip** (seated → το finish πάτημα της χαμηλότερης βαθμίδας
  παραλείπεται, το δάπεδο το καλύπτει· ρίχτι/υπόλοιπα ανέπαφα, Giorgio 2026-07-22 screenshot)·
  `BimSceneLayer.syncStairs` resolve seat (ίδιο slab set με host resolver,
  **ανεξάρτητο του attach** → self-correcting για ήδη-σχεδιασμένες σκάλες). pass-through/floating/no-slab
  → κανένα trim (διαπερνά προς τρύπα Φ2). **Tests: νέα/επεκταμένα πράσινα** (`stair-waist-slabs.test.ts`
  +5 terminating-trim +2 base-tread-skip, `stair-slab-embedment.test.ts` +2 `resolveStairBaseSlabSeat`)·
  **regression πράσινα** (converters+scene 93 suites/707· stairs/embedment). N.17: tsc SKIP. N.6: καμία νέα οντότητα.
  ✅ N.18 `jscpd:diff` clone **ΚΕΝΤΡΙΚΟΠΟΙΗΘΗΚΕ** (Giorgio 2026-07-22): ο προϋπάρχων clone στο param-tail
  `BimSceneLayer.sync`/`syncMultiFloor` (γρ. 110-115 vs 141-146) λύθηκε ομαδοποιώντας τα 5 κοινά
  visibility params σε **ένα** options-object `FloorVisibilityScope` — το SSoT type έβγηκε από το
  `scene-manager-actions.ts` σε δικό του leaf module `bim-3d/scene/floor-visibility-scope.ts` (ώστε ο
  low-level `BimSceneLayer` να μην εξαρτάται από το actions module· re-export για backward-compat).
  `sync`/`syncMultiFloor`/`buildContext` + callers (`scene-manager-actions`, export `build-mesh3d-scene`,
  2 test suites) περνούν πλέον το scope bag. `jscpd:diff` → **no new clones**· 32/32 BimSceneLayer tests πράσινα.
- **2026-07-22** — **Φάση 1 DONE (γεωμετρία + BOQ guard), uncommitted.** Νέο pure module
  `bim/geometry/stairs/stair-base-slab.ts` (`classifyStairBaseRelation` / `findSlabToSeatStairBase` /
  `computeStairWaistSlabOverlapVolumeM3`, mirror του ADR-632 `stair-slab-overlap.ts` αλλά για την πλάκα
  ΣΤΗ ΒΑΣΗ). Επέκταση `bim/stairs/stair-structural-attach-coordinator.ts`: κοινή SSoT πύλη
  `stairBaseAttachesToHost` (pull-down ΕΙΤΕ seat, αποκλείει pass-through) — χρησιμοποιείται από το
  επεκταμένο `findStairsToAutoAttachBaseToHost` (host-πρώτα) **και** το νέο αντίστροφο
  `findHostsToSeatStairBase` (σκάλα-πρώτα, mirror `findHostsToAttachWallBase`). Wiring στο
  `hooks/useStructuralAutoAttach.ts` (νέο `attachStairBaseToSurroundingHosts`, στο
  `drawing:entity-created` όταν `isStairEntity`). Raft foundation slabs εξαιρούνται (ADR-441 parity).
  **BOQ guard wired:** bridge `bim/services/stair-slab-embedment.ts` (scene→pure, effective params),
  προαιρετικό `StairBoqContext.embeddedOverlapVolumeM3` (`stair-boq-sync.ts`, αφαίρεση+clamp≥0 μόνο στη
  γραμμή σκυροδέματος σκάλας), `resolveEmbeddedOverlapVolumeM3` στο `use-stair-persistence.ts`.
  **Διόρθωση μοντέλου (in-review):** το αρχικό `overlapArea × thickness` υπερ-αφαιρούσε ~10× (bbox
  footprint) → αντικαταστάθηκε από φυσικά-σωστό **waist-prism εντός ζώνης πλάκας** (§4.2).
  **Tests: 40/40 πράσινα** — `stair-base-slab.test.ts` (14), επεκταμένο
  `stair-structural-attach-coordinator.test.ts` (21), `stair-slab-embedment.test.ts` + νέο block στο
  `stair-boq-sync.test.ts`· γειτονικά stair suites 33/33 regression. `jscpd:diff` καθαρό (6 αρχεία).
  N.17: tsc SKIP (CI CHECK 3.29 καλύπτει το subapp). N.6: καμία νέα Firestore οντότητα (update
  υπάρχουσας σκάλας μέσω `AttachStairsCommand`). **Φάση 2** (pass-through → άνοιγμα σε πλάκα βάσης,
  §8) παραμένει PROPOSED — καμία γραμμή κώδικα ακόμη.
