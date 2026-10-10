# ADR-567 — Καμία δομική BIM οντότητα πάνω σε υπάρχουσα (no-overlap placement guard)

**Status:** ✅ 🟢 IMPLEMENTED (UNCOMMITTED)
**Date:** 2026-07-03
**Domains:** DXF Viewer · BIM · Placement · Geometry
**Author:** Giorgio (order) + agent (impl)

---

## Context

Ο Giorgio (2026-07-03) ζήτησε: **ΠΟΤΕ** να μην μπορεί να τοποθετηθεί τοίχος σε περιοχή που
ήδη καταλαμβάνει άλλος τοίχος — και το ίδιο για **ΟΛΕΣ τις δομικές BIM οντότητες** («Δομικά»).

**Κανόνας (επιβεβαιωμένος):**
- **BLOCK** ουσιαστική επικάλυψη εμβαδού/όγκου — πλήρης (Α) ή μερική (Β) — **εντός ίδιας
  collision group** (Φ1b, βλ. §1.1).
- **ALLOW** γωνίες/ενώσεις/διασταυρώσεις που μοιράζονται μόνο παρειά/σημείο ή ένα μικρό
  τετράγωνο πάχος×πάχος (C) — αλλιώς δεν χτίζεται κανονική κάτοψη.
- **ALLOW** οριζόντιο μέλος (δοκάρι/πλάκα) πάνω σε κατακόρυφο (τοίχο/κολόνα) — κάθεται σε
  διαφορετικό Z (Φ1b· γι' αυτό «Δοκάρι από τοίχο» / «πλάκα πάνω σε τοίχους» είναι νόμιμα).
- **ALLOW** τοίχος πάνω/ανάμεσα σε κολόνα(ες) — και συμμετρικά κολόνα σε τοίχο (§wall-column,
  Giorgio 2026-07-18· Revit: η κολόνα ενσωματώνεται στον τοίχο, το άκρο κόβεται flush μέσω
  ADR-363 §wall-column-end-miter). Ήταν το bug: ο τοίχος που ένωνε 2 κολόνες μπλοκαριζόταν.

### Κατάσταση πριν
- Οι τοίχοι είχαν **στενό** guard: `isMemberCollinearOverlap` (axis-based, `use-wall-commit.ts`) —
  μπλόκαρε μόνο **ομοαξονικό/παράλληλο** διπλότυπο «πάνω-πάνω». Δεν έπιανε επικάλυψη υπό γωνία,
  ούτε άλλες οντότητες.
- **Κολόνες, δοκοί, πλάκες, θεμελιώσεις: κανένας hard guard** — μπαίναν οπουδήποτε.

---

## Decision

### 1. ΕΝΑ SSoT overlap guard — `bim/placement/structural-placement-overlap.ts`

Καθαρό (pure) module. **Reuse μόνο υπάρχοντα primitives** (N.0.2):
`safeIntersection` + `multiPolygonArea` (boolean/area SSoT), `wallFootprintPolygon` (miter-aware),
`resolveMemberFootprintVertices` (column/beam).

- `STRUCTURAL_OVERLAP_TYPES = { wall, column, beam, slab, foundation }` (Φ1).
- `structuralFootprintOf(entity): Point2D[] | null` — dispatch ανά τύπο στην υπάρχουσα geometry
  πηγή (wall→union footprint· column/beam→member footprint· foundation→`geometry.footprint`·
  slab→`geometry.polygon`).
- `findStructuralOverlap(candidateFootprint, existing, { excludeIds?, ratioThreshold? })` →
  `{ blockedById, ratio } | null`.

**Κατώφλι (ratio-based):** `ratio = εμβαδόν_τομής / min(area_candidate, area_existing)`.
- `DEFAULT_OVERLAP_RATIO_THRESHOLD = 0.25`.
- Άγγιγμα-μόνο (εμβαδόν τομής ≈ 0) → allow. `ratio ≥ κατώφλι` → block.

### 1.1 Collision groups (Φ1b — fix «Δεν επιτρέπεται τοποθέτηση πάνω σε υπάρχουσα δομική»)

Το footprint overlap είναι **2D** — αγνοεί το Z. Δύο δομικές μπλοκάρουν **μόνο αν ανήκουν στην ΙΔΙΑ
`StructuralCollisionGroup`** (`structuralCollisionGroupOf(type)`):

| Ομάδα | Τύποι | Σκεπτικό |
|---|---|---|
| `wall` | `wall` | Μόνο τοίχος↔τοίχος μπλοκάρει (διπλότυπο). ⚠️ ΔΕΝ μπλοκάρεται από κολόνα (§wall-column). |
| `column` | `column` | Μόνο κολόνα↔κολόνα μπλοκάρει. ⚠️ ΔΕΝ μπλοκάρεται από τοίχο (§wall-column). |
| `beam` | `beam` | Οριζόντιο· κάθεται ΠΑΝΩ (ring/tie beam στην κορυφή τοίχου). Μόνο δοκάρι↔δοκάρι μπλοκάρει. |
| `slab` | `slab` | Οριζόντιο· πλάκα πάνω σε δοκάρια/τοίχους. Μόνο πλάκα↔πλάκα μπλοκάρει. |
| `foundation` | `foundation` | Υπόβαση, κάτω από όλα. Μόνο πέδιλο↔πέδιλο μπλοκάρει. |

Ο `findStructuralOverlap` δέχεται `candidateType` και φιλτράρει existing εκτός ομάδας ΠΡΙΝ το clipping.
Έτσι **δοκάρι/πλάκα πάνω σε τοίχο/κολόνα → allow** (νόμιμο, διαφορετικό Z) και **τοίχος↔κολόνα → allow**
(§wall-column — τοίχος που ενώνεται σε κολόνα, Revit-grade). Κάθε συμπαγής τύπος μπλοκάρεται **μόνο από
ομοειδή** (διπλότυπο). Χωρίς `candidateType` → legacy (όλες οι δομικές μαζί).

> **§wall-column (Giorgio 2026-07-18).** Αρχικά (Φ1b) τοίχος & κολόνα ήταν κοινή ομάδα `vertical` ώστε
> «κολόνα μέσα σε τοίχο δεν μπαίνει». Αυτό μπλόκαρε **λάθος** τον τοίχο που πλαισίωνε/ένωνε 2 κολόνες:
> το άκρο του κάλυπτε >25% του **μικρού** footprint της κολόνας → guard = «διπλότυπο». Όμως τοίχος που
> ενώνεται σε κολόνα είναι θεμελιώδης πράξη (η κολόνα ενσωματώνεται στον τοίχο· το άκρο κόβεται flush
> μέσω ADR-363 §wall-column-end-miter). Χωρίστηκαν σε ξεχωριστές ομάδες → **wall↔column ΠΟΤΕ δεν
> μπλοκάρουν μεταξύ τους** (συμμετρικά). Διπλότυπο τοίχος-σε-τοίχο & κολόνα-σε-κολόνα παραμένουν block.

**ΓΙΑΤΙ (root cause):** Το «Δοκάρι από τοίχο» (ADR-363) χτίζει δοκάρι στον άξονα τοίχου με ίδιο
footprint (100% overlap) → ο flat guard το μπλόκαρε πάντα. Ίδιο λανθάνον bug: πλάκα πάνω σε τοίχους,
δοκάρι πάνω σε κολόνα.

Παράδειγμα (τοίχος 3m × 0.2m, area 0.6m²):
| Σενάριο | overlap | ratio | Αποτέλεσμα |
|---|---|---|---|
| Διασταύρωση (+/T) | 0.04m² | 6.7% | ✅ ALLOW |
| Μισός-πάνω-στον-άλλο | 0.30m² | 50% | ❌ BLOCK |
| Διπλότυπο | ~0.60m² | ~100% | ❌ BLOCK |
| Γωνία (κοινή παρειά) | 0 | 0% | ✅ ALLOW |

**Host-child εξαιρέσεις εγγενείς:** `opening`/`slab-opening` δεν ανήκουν στο type set
(ζουν μέσα σε τοίχο/πλάκα) → ποτέ δεν μπλοκάρουν. Construction points/guides δεν είναι στο
`SceneModel.entities` → φυσικά εκτός.

### 1.2 Η ένωση τοίχων δεν είναι κατάληψη (§join-is-not-occupation — ADR-911 Φ3α-2, 2026-10-11)

**Το πρόβλημα.** Δύο τοίχοι που ενώνονται μοιράζονται εμβαδό **εκ κατασκευής**: το άκρο του ενός φτάνει στον
άξονα του άλλου. Αυτό το κομμάτι έχει μέγεθος `μισό πάχος γείτονα × πάχος τοίχου` — **δεν εξαρτάται από το
μήκος** του τοίχου. Ο λόγος «τομή / μικρότερο εμβαδό» το διαιρούσε όμως με το εμβαδό του τοίχου, άρα για
κοντό τοίχο έβγαινε 33–55 % ⇒ ψευδές «κατειλημμένο». Τοίχος πάχους 100 ενωμένος σε γείτονα 250 κοβόταν για
κάθε καθαρό μήκος ≤ 375 mm. Ήταν το «known limitation» της πρώτης έκδοσης αυτού του ADR.

**Πρακτική των μεγάλων.** Revit: η προειδοποίηση «Highlighted walls overlap» αφορά τοίχους στον ίδιο χώρο
(ομοαξονικά διπλότυπα, τοίχος που «έτρεξε παραπάνω»)· η ένωση είναι ξεχωριστός μηχανισμός (butt / miter /
square off) που καθαρίζει τη γεωμετρία. ArchiCAD: οι τοίχοι κόβονται μεταξύ τους, **εκτός όταν είναι
παράλληλοι**. Και στους δύο η επικάλυψη κρίνεται πάνω στη γεωμετρία **μετά** την ένωση. (Πηγές: σελίδες
βοήθειας Autodesk για wall joins και warnings, νήματα Autodesk / Graphisoft Community — διαβάστηκαν
περιλήψεις αναζήτησης· ο ακριβής αλγόριθμος της προειδοποίησης του Revit δεν είναι δημοσιευμένος.)

**Ο κανόνας** (`bim/placement/wall-join-overlap.ts`, ένας καταναλωτής: το SSoT). Για ζεύγος **ευθύγραμμων**
τοίχων με γωνία αξόνων ≥ `MIN_ANGLE_RAD` (15°, η υπάρχουσα σταθερά «παράλληλου τοίχου»), κάθε άκρο που
βρίσκεται μέσα στο σώμα του άλλου κόβεται πίσω προς την παρειά του κατά

`κόψιμο = (μισό πάχος γείτονα − απόσταση άκρου από τον άξονα του γείτονα) / sin(γωνία)`

— το **ίδιο** `penetrationBevel` που χρησιμοποιεί ο λύτης ενώσεων (ADR-363 Phase 1L). Ο κανόνας του 25 %
εφαρμόζεται **μετά**, πάνω στα κομμένα αποτυπώματα. Το κατώφλι δεν άλλαξε.

*(ADR-911 Φ3α-3: ως τότε ο κριτής καλούσε το `penetrationBevel` με `stemLen = Infinity` για να παρακάμψει το
όριο σχεδίασης 40 %. Το όριο έφυγε από τη ρίζα, άρα και η παράκαμψη. Το «ο τοίχος καταπίνεται» κρίνεται με το
**ίδιο** `resolveOpposingEndCuts` που εφαρμόζει η γεωμετρία, με μηδενικό ελάχιστο σώμα — ίδιο αποτέλεσμα με
πριν. Ο κριτής εξακολουθεί να μετρά τη διείσδυση **χωρίς πρόσημο**: το προσημασμένο κόψιμο έναντι γνήσιου
διαμπερούς είναι του λύτη σχεδίασης και μόνο.)*

| Περίπτωση | Πριν | Τώρα |
|---|---|---|
| Κοντός τοίχος με το άκρο στον άξονα γείτονα | 33–55 % ⇒ block | 0 ⇒ allow |
| Μακρύς τοίχος με το άκρο στον άξονα **κοντού** γείτονα | block | 0 ⇒ allow |
| Γωνία Γ με κοινό άκρο αξόνων | μικρό τετράγωνο | 0 |
| Ομοαξονικό διπλότυπο (και πάνω σε κοντό τοίχο) | block | block — παράλληλοι, καμία έκπτωση |
| Τετράγωνος τοίχος ξανά με **κάθετο** άξονα | block | block — τα άκρα κάθονται στις παρειές ⇒ κόψιμο 0 |
| Κοντός τοίχος θαμμένος εγκάρσια μέσα σε χοντρό | block | block (`swallowed` ή ~100 %) |
| Άκρο που διαπερνά ως την απέναντι παρειά | block (κοντός) | block — κόψιμο 0, δεν είναι ένωση |
| Διασταύρωση Χ στη μέση | όπως πάντα | όπως πάντα |

**Γιατί αυτός ο τύπος και όχι άλλος.**
- Είναι **συνεχής**: μέγιστο όταν το άκρο κάθεται στον άξονα (γνήσια ένωση), μηδέν στην παρειά — και στις
  **δύο** παρειές. Άκρο που πέρασε τον άξονα παίρνει μικρότερη έκπτωση, γιατί δεν είναι πια ένωση αλλά
  διείσδυση. Θόρυβος 0,001 mm αλλάζει το αποτέλεσμα κατά 0,001 mm· κανένα όριο πάνω σε τιμή των δεδομένων.
- Δεν διαβάζει αποθηκευμένα miter / bevel ⇒ ίδια κρίση στην προεπισκόπηση, στο χτίσιμο και στην εγγραφή.
- Απορρίφθηκαν: (α) κρίση στο αποτύπωμα **πριν** την επέκταση — δεν καλύπτει τον adapter εγγραφής, που βλέπει
  μόνο επεκταμένους τοίχους· (β) «κάθετοι τοίχοι = ποτέ κατάληψη» — αφήνει να περάσει διπλότυπο τετράγωνου
  τοίχου με κάθετο άξονα· (γ) πλήρες `computeWallTrims` πριν από τον έλεγχο — Ν περάσματα ανά υποψήφιο σε
  κάθε καρέ hover, και εξάρτηση από το όριο σχεδίασης 40 %.

**Μία είσοδος με οντότητα.** `findStructuralOverlapForEntity(entity, existing)` βγάζει αποτύπωμα, εξαιρεί
τον εαυτό, περιορίζει στην ομάδα σύγκρουσης και δίνει στο SSoT την οντότητα. Αντικατέστησε την ίδια τετράδα
κλήσεων σε **τέσσερις** καλούντες (`partitionByStructuralOverlap`, `append-entity-to-scene`,
`filling-walls-compute`, `wall-ghost-build`). Το `findStructuralOverlap` με σκέτο πολύγωνο μένει για το
`markOccupiedZones` (ζώνη χωρίς οντότητα).

**Δηλωμένα όρια.**
- Καμπύλοι / polyline τοίχοι: καμία έκπτωση ένωσης — κρίνονται στα πλήρη αποτυπώματα, όπως πριν.
- Ζεύγη με γωνία κάτω από 15° κρίνονται ως παράλληλα. Το όριο είναι σε **γωνία** (οι γωνίες των σχεδίων
  συσσωρεύονται σε 90° / 45° / 30°), όχι σε μήκος· οξεία ένωση κάτω από 15° πάνω σε κοντό τοίχο μπορεί ακόμη
  να κοπεί.
- Διασταύρωση Χ κοντού τοίχου (κανένα άκρο μέσα στον άλλον) δεν παίρνει έκπτωση.

### 2. Enforcement — 2 chokepoints (καλύπτουν όλα τα interactive draws)

- **`bim/scene/append-entity-to-scene.ts`** — `appendEntityToScene` (single) + `appendEntitiesToScene`
  (batch/region-fill). Guard ΠΡΙΝ το `CommandHistory.execute`. Batch: φιλτράρει τα overlapping ΚΑΙ
  εναντίον των ήδη-αποδεκτών του ίδιου batch· `count` = πόσα κόπηκαν.
- **`bim/walls/add-wall-to-scene.ts`** — `addWallToScene`. Guard ΠΡΙΝ trim-recompute/emit· no-op χωρίς
  `drawing:entity-created` → μηδέν persist. Το υπάρχον commit-time `isMemberCollinearOverlap`
  (κόκκινο ghost) **μένει** — ο append-guard είναι καθολικό belt-and-suspenders (N.7.2 #4).

### 3. Feedback

- **Toast:** νέο event `bim:placement-blocked { entityType, blockedById, count }` → non-blocking warning
  (`registerPerimeterBuildNotifications`, `sonner`). i18n `placementBlock.overlap` / `overlapBatch`.
- **Κόκκινο ghost (ευθύς τοίχος):** το wall preview (`wall-ghost-build.buildWallGhostEntity`) γίνεται 🔴
  όταν το footprint του φαντάσματος επικαλύπτει υπάρχουσα δομική — ΟΧΙ μόνο ομοαξονικά (το στενό
  `isMemberCollinearOverlap` έχανε τις κάθετες/υπό-γωνία). Ίδιο SSoT + κατώφλι με τον commit-guard →
  preview ≡ commit. Πηγή: `sceneSnapTargetsStore.structuralEntities` (νέο πεδίο, ίδια σκηνή).
- **Κόκκινο region highlight («Τοίχος/Κολόνα σε περιοχή»):** το hover preview
  (`useRegionPerimeterMouseMove` → `RegionPerimeterPreviewOverlay`) χρωματίζει **ανά ζώνη** — κάθε ζώνη
  που πέφτει πάνω σε υπάρχουσα δομική γίνεται 🔴 (νέο `RegionPerimeterZone.occupied`), οι ελεύθερες
  μένουν 🟢. `markOccupiedZones` καλεί το ΙΔΙΟ `findStructuralOverlap` με τα ΙΔΙΑ live `scene.entities`
  του append guard → preview ≡ commit. (Αυτό ήταν το path που έβλεπε ο Giorgio — region mode, όχι ευθύ.)
- **Perf:** AABB fast-reject στο `findStructuralOverlap` πριν το polygon-clipping (per-frame hover, N.17).
- Κόκκινο ghost για τα ΑΛΛΑ tools (κολόνα/δοκός/πλάκα/θεμελίωση) = Φ2 (ο append-guard τα μπλοκάρει ήδη).

---

## Consequences

- ✅ Google-level: YES — proactive (guard στη δημιουργία, πριν το scene mutation), idempotent,
  SSoT (ΕΝΑ overlap module), reuse όλων των geometry primitives, μονάδο-ανεξάρτητο (ratio).
- **Εκτός Φ1 (flag):**
  - Grid-generated walls/columns (`CreateWallsCommand` / adapter `addEntity`) παρακάμπτουν τα 2
    chokepoints — το grid δεν αυτο-επικαλύπτεται· Φ2 guard αν χρειαστεί.
  - stair / railing / roof — thin/σύνθετα footprints (παραγωγή από treads/bbox) → Φ2.
  - Καθολικό κόκκινο ghost (preview) για όλες τις οντότητες → Φ2 μέσω `placement-ghost-assembly.ts`.
  - ~~Πολύ μικροί τοίχοι-stub (μήκος ≈ πάχος) σε ένωση → πιθανό ratio ≥ 25% (known limitation).~~
    **ΛΥΘΗΚΕ 2026-10-11** — §1.2: η ένωση δεν είναι κατάληψη.

---

## Files

| Αρχείο | Αλλαγή |
|---|---|
| `bim/placement/structural-placement-overlap.ts` | **NEW** — SSoT guard |
| `bim/placement/wall-join-overlap.ts` | §1.2 — αποτυπώματα ζεύγους τοίχων μετά την ένωση |
| `bim/placement/__tests__/wall-join-overlap.test.ts` | §1.2 — άγκυρες «ένωση ≠ κατάληψη» |
| `bim/placement/__tests__/structural-placement-overlap.test.ts` | **NEW** — 17 jest ✅ |
| `bim/scene/append-entity-to-scene.ts` | guard (single + batch) |
| `bim/walls/add-wall-to-scene.ts` | guard (walls) |
| `systems/events/drawing-event-map-bim.ts` | `bim:placement-blocked` event |
| `hooks/notifications/perimeter-build-notifications.ts` | toast registrar |
| `i18n/locales/{el,en}/dxf-viewer-shell.json` | `placementBlock.*` |
| `hooks/drawing/wall-ghost-build.ts` | 🔴 ghost όταν footprint overlap (ευθύς τοίχος, preview ≡ commit) |
| `bim/framing/scene-snap-targets.ts` | νέο πεδίο `structuralEntities` |
| `systems/region-preview/RegionPerimeterPreviewStore.ts` | `RegionPerimeterZone.occupied` |
| `components/dxf-layout/RegionPerimeterPreviewOverlay.tsx` | per-zone χρώμα (🔴 occupied/oversized) |
| `hooks/canvas/useRegionPerimeterMouseMove.ts` | `markOccupiedZones` (region hover → 🔴) |

---

## Verification (browser, N.17 — ΟΧΙ tsc)
1. `/dxf/viewer` — τοίχος πάνω σε τοίχο (ίδιος άξονας) → δεν μπαίνει· κάθετα (T/+) → μπαίνει.
2. Κολόνα μέσα σε κολόνα/τοίχο → δεν μπαίνει· στη γωνία (touch) → OK.
3. Πλάκα-σε-πλάκα, πέδιλο-σε-πέδιλο → block· διπλανά/εφαπτόμενα → allow.
4. Region-fill → γεμίζει μόνο τα κενά κελιά. Toast στο μπλοκάρισμα.
5. `npx jest structural-placement-overlap` → 17/17 ✅.

---

## Changelog
- **2026-10-11 (ADR-911 Φ3α-3)** — Ο κριτής ένωσης μοιράζεται πλέον **και** το φράγμα των δύο κοψιμάτων
  (`geometry/wall-end-cuts.ts`) με τη γεωμετρία· έφυγε το `stemLen = Infinity`. Καμία αλλαγή κρίσης (οι 15
  άγκυρες του §1.2 αμετάβλητες). Στο `computeFillingWalls` η σειρά **κρίσης** μέσα σε μια παρτίδα είναι πλέον
  ιδιότητα της γεωμετρίας (ο μακρύτερος τοίχος κρίνεται πρώτος), όχι της σειράς εισόδου: δύο υποψήφιοι στον
  ίδιο χώρο δίνουν το ίδιο αποτέλεσμα με όποια σειρά κι αν έρθουν. Το `partitionByStructuralOverlap` (εγγραφή)
  δεν άλλαξε: κρίνει με τη σειρά που του δίνεται, και του δίνονται τοίχοι που έχουν ήδη περάσει την κρίση.
- **2026-10-10 (ADR-911 Φ2)** — `partitionByStructuralOverlap` στο SSoT module: το **ένα** φίλτρο
  παρτίδας (αποδεκτές / κομμένες, με το σύνολο ελέγχου να μεγαλώνει ανά αποδεκτή). Το σώμα ζούσε inline
  στο `appendEntitiesToScene`· τώρα το μοιράζεται με το `addWallsToScene`. Ο φρουρός τοίχου δεν είναι πια
  ξεχωριστή ανά-τοίχο υλοποίηση στο `add-wall-to-scene.ts`. Νέα πολιτική καλούντος `onOverlap: 'refuse'`
  (καμία μερική εγγραφή όταν κοπεί έστω ένα μέλος) — η απόφαση ανήκει στον καλούντα, όχι στο φίλτρο.
- **2026-07-03** — Initial implementation (UNCOMMITTED). SSoT module + 2 chokepoints + event/toast/i18n
  + 17 jest. Φ1 = wall/column/beam/slab/foundation. Threshold default 25% (Giorgio-tunable).
- **2026-07-03** — Preview red-ghost fix (Giorgio browser-report: ghost έμενε πράσινο πάνω σε τοίχους).
  Wall ghost γίνεται 🔴 σε footprint overlap (όχι μόνο ομοαξονικό) μέσω `structuralEntities` +
  `findStructuralOverlap` + AABB fast-reject. 227 jest πράσινα.
- **2026-07-03** — Region-mode fix (stack trace: `use-wall-region-clicks` → «Τοίχος σε περιοχή»). Το
  πράσινο περίγραμμα ήταν το region hover highlight, όχι το wall ghost. Προστέθηκε per-zone `occupied`
  → 🔴 highlight πάνω σε υπάρχουσα δομική (`markOccupiedZones`, ίδια entities/κατώφλι με τον commit).
  ✅ Browser-verified από Giorgio (κόκκινο σε κατειλημμένες ζώνες, πράσινο στις ελεύθερες). 653 jest.
- **2026-07-03 (Φ1b)** — **Collision groups** (Giorgio browser-report: «Δεν δημιουργείται δοκάρι —
  *Δεν επιτρέπεται τοποθέτηση πάνω σε υπάρχουσα δομική οντότητα*»). Root: το «Δοκάρι από τοίχο» χτίζει
  δοκάρι με ίδιο footprint με τον τοίχο (100% overlap) → ο flat guard το μπλόκαρε (+ λανθάνον: πλάκα
  πάνω σε τοίχους, δοκάρι πάνω σε κολόνα). Fix: `StructuralCollisionGroup` + `structuralCollisionGroupOf`
  + `candidateType` στο `findStructuralOverlap` — overlap μπλοκάρει μόνο εντός ίδιας ομάδας
  (`vertical`=τοίχος/κολόνα· `beam`/`slab`/`foundation` = ξεχωριστά). Threaded σε όλους τους 6 callers
  (append single/batch, add-wall, filling-walls, wall-ghost, region-preview). +8 jest (32 total στο suite).
- **2026-07-18 (§wall-column)** — **Τοίχος↔κολόνα ΔΕΝ μπλοκάρουν** (Giorgio browser-report: «ΤΟ ΣΥΣΤΗΜΑ
  ΔΕΝ ΜΟΥ ΕΠΙΤΡΕΠΕΙ ΝΑ ΔΗΜΙΟΥΡΓΗΣΩ ΤΟΙΧΟ ΑΝΑΜΕΣΑ ΣΕ 2 ΚΟΛΩΝΕΣ»). Root: τοίχος & κολόνα ήταν κοινή
  ομάδα `vertical` → το άκρο τοίχου flush σε κολόνα κάλυπτε >25% του μικρού footprint κολόνας → block ως
  «διπλότυπο». Fix: χωρισμός `vertical` → ξεχωριστές ομάδες `wall` + `column` (`COLLISION_GROUP_BY_TYPE`,
  κάθε τύπος = δική του ομάδα) → wall↔column ποτέ block (συμμετρικά, Revit-grade· end-miter ADR-363 κόβει
  το άκρο flush). Τοίχος-σε-τοίχο & κολόνα-σε-κολόνα διπλότυπα παραμένουν block. Μηδέν αλλαγή στους
  callers (ίδιο `candidateType`). Test suite ενημερώθηκε → 27/27 ✅.
