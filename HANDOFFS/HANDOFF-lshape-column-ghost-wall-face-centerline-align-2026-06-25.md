# HANDOFF — Φάντασμα κολόνας L: ευθυγράμμιση παρειών/κέντρου-άξονα σε οριζόντιο τοίχο (Revit-style)

- **Ημερομηνία:** 2026-06-25
- **Επόμενος ελεύθερος ADR:** **ADR-522** (επιβεβαίωσε στην αρχή — τρέχει ταυτόχρονα ο codex agent· 519/520/521 committed)
- **Commit:** ΟΧΙ ο agent — **ο Giorgio κάνει commit**. **Shared working tree με άλλον agent (codex)** → minimal edits σε κοινά αρχεία, βάλε νέα λογική σε ΝΕΑ αρχεία.
- **Ποιότητα:** Revit-grade, **FULL ENTERPRISE + FULL SSoT, μηδέν διπλότυπα**. SSoT audit (grep) έγινε ήδη (παρακάτω) — **REUSE, μη ξαναγράψεις**.

---

## 1. Τι ζητάει ο Giorgio (από στιγμιότυπο `Στιγμιότυπο οθόνης 2026-06-25 010254.jpg`)

Όταν σχεδιάζεται **φάντασμα κολόνας σχήματος L (κεφαλαίο λατινικό)** κοντά σε **οριζόντιο τοίχο**, το
**οριζόντιο σκέλος** του L πρέπει να **αγκυρώνει + ολισθαίνει** πάνω στις γραμμές αναφοράς του τοίχου,
Revit-style, καθώς ο κέρσορας κατεβαίνει **Βορρά→Νότο**.

### Γεωμετρία — 3 γραμμές αναφοράς η καθεμιά
**Οριζόντιο σκέλος του φαντάσματος L** (3 παράλληλες ευθείες, κάθετες στον προσανατολισμό του σκέλους):
- **Βόρεια παρειά** = `Δ1-Δ2` (πάνω ακμή σκέλους)
- **Κέντρο-άξονας** = `Γ1` (μέση)
- **Νότια παρειά** = `Α-Β` (κάτω ακμή σκέλους) — ο Giorgio τη λέει και **«θέση X»**

**Οριζόντιος τοίχος** (3 παράλληλες ευθείες):
- **Βόρεια παρειά** = `1-2` (πάνω παρειά τοίχου)
- **Κέντρο-άξονας** = `Γ2` (location line τοίχου)
- **Νότια παρειά** = `Z` (κάτω παρειά τοίχου)

### Συμπεριφορά (καθώς ο κέρσορας κατεβαίνει Β→Ν)
ΟΛΑ με **αγκύρωση + ολίσθηση** κατά μήκος του τοίχου (slide along the wall direction):

| Βήμα | Γραμμή φαντάσματος | → ταυτίζεται/αγκυρώνει σε γραμμή τοίχου | Αποτέλεσμα |
|---|---|---|---|
| 1 | νότια παρειά σκέλους **Α-Β** | βόρεια παρειά τοίχου **1-2** | το L κάθεται ΠΑΝΩ στον τοίχο (κάτω παρειά flush στην πάνω παρειά) |
| 2 | κέντρο-άξονας σκέλους **Γ1** | κέντρο-άξονας τοίχου **Γ2** | το L κεντράρει στον άξονα του τοίχου |
| 3 | βόρεια παρειά σκέλους **Δ1-Δ2** | βόρεια παρειά τοίχου **1-2** | το L επικαλύπτει, πάνω παρειά flush |
| (επιπλέον) | νότια παρειά **Α-Β** | νότια παρειά τοίχου **Z** | όταν ο κέρσορας είναι πάνω από τη νότια γραμμή του τοίχου |

Η επιλογή «ποια γραμμή φαντάσματος → ποια γραμμή τοίχου» γίνεται από την **κάθετη θέση του κέρσορα**
σε σχέση με τον τοίχο (zone-based, Β→Ν). Η ολίσθηση είναι κατά μήκος του τοίχου (E-W).

> ΣΗΜΕΙΩΣΗ ΚΑΤΕΥΘΥΝΣΗΣ: ο **τοίχος είναι ο στόχος (υφιστάμενος)**, το **φάντασμα L μετακινείται**.
> Άρα ευθυγραμμίζουμε τις 3 γραμμές ΤΟΥ ΦΑΝΤΑΣΜΑΤΟΣ προς τις 3 γραμμές ΤΟΥ ΤΟΙΧΟΥ — όχι το αντίστροφο.

---

## 2. SSoT AUDIT (grep έγινε) — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ → REUSE

Το pipeline placement-snap είναι ώριμο. **Preview ≡ Commit** (καλούν το ίδιο brain). **Όλα τα παρακάτω υπάρχουν** — μην τα ξαναγράψεις.

### 2.1 Το ενιαίο brain
- `bim/placement/bim-cursor-snap.ts` → **`resolveBimCursorSnap(input)`** (ADR-514). Ένα entry point για όλα τα tools (`toolKind:'column'`). Επιστρέφει `BimCursorSnap` union (`column-placement` | `member-placement` | `point`). **Preview (`generateColumnPreview`) ΚΑΙ commit (`mouse-handler-up.ts`) το καλούν ΙΔΙΑ** → άλλαξε τη λογική snap → ωφελούνται και τα δύο.

### 2.2 Pre-collected targets (μία φορά ανά tool-activation)
- `bim/framing/scene-snap-targets.ts` → **`SceneSnapTargets`** + **`sceneSnapTargetsStore`** (`refresh/get/reset`) + **`collectSceneSnapTargets(entities)`** (ADR-398 §3.10). Περιέχει `wallTargets`, `footprintEdgeTargets`, `footprints`, κ.λπ.
- `bim/framing/member-snap-targets.ts` → **`collectMemberSnapTargets`**, **`collectFootprintEdgeTargets`** (πέδιλα/μη-κυκλικές κολόνες/**τοίχοι** ως zero-width edges), **`wallOutlineRing(wall)`** (outer + reversed inner ring).
  - **Ο τοίχος αποθηκεύεται ήδη ως `{ id, axis:[Point2D], outline:[Point2D] }`** — `axis` = centerline (location line), `outline` = κλειστό ring. **Καμία νέα συλλογή για τις γραμμές τοίχου δεν χρειάζεται.**

### 2.3 Οι ΓΡΑΜΜΕΣ ΤΟΙΧΟΥ (βόρεια/κέντρο/νότια) — ΥΠΑΡΧΟΥΝ
- `bim/columns/column-face-snap-helpers.ts` → **`buildMemberAxisFrame(axis, outline)`** → `MemberAxisFrame { a, u, alongMin, alongMax, halfThickness }`. `u` = διεύθυνση τοίχου, `halfThickness` = ±απόσταση παρειάς. **Οι 3 γραμμές τοίχου = `a + along·u + {−halfThickness | 0 | +halfThickness}·perp`** (perp = `{u.y, −u.x}`). (Χρησιμοποιεί `projectPolygonOnAxis` → `perpMin/perpMax`.)
- **`resolveAxisCenterFoot(cursor, a, u, alongMin, alongMax, perpThreshold)`** → προβολή κέρσορα στον άξονα + έλεγχος κάθετης ζώνης → `{position, along, perp} | null`. (Αυτό κάνει ήδη το «κέντρο στον άξονα».)
- `geometry/shared/polygon-axis-projection.ts` → **`projectPointOnAxis`**, **`projectPolygonOnAxis`**.

### 2.4 Ο face-snap resolver (ο πυρήνας — nearest-wins)
- `bim/columns/column-face-snap.ts` → **`resolveColumnFaceSnapFromTargets(cursor, targets, sceneUnits, opts)`** → `ColumnFaceSnap | null`. Dispatcher με tiers (**`nearestHit(...)`**): `resolveColumnEdgeSnap`, **`resolveFootprintEdgeSnap`** (slant-following flush — πέδιλα/μη-κυκλικές κολόνες/**τοίχοι**), `resolveCircularTangentHit`, `resolvePolarDiskHit`, **`resolveForTarget`/`resolveMemberAxisCenter`** (bbox face-snap + **wall axis-center**), `resolveRectHit`.
  - **`ColumnFaceSnap { position, anchor, status, rotation, targetId, face, third, faceFrame }`** — `rotation`=flush-to-edge (slant-following μέσω `axisAlignmentRotationDeg`), `anchor`=ποια από τις 9 λαβές ακουμπά.
  - **`resolveMemberAxisCenter`** ήδη κάνει: κέρσορας κάθετα κοντά στον άξονα → κέντρο κολόνας on-axis· αλλιώς flush στην πλησιέστερη παρειά (`resolveForTarget`).

### 2.5 Ολίσθηση/αγκύρωση κατά μήκος (slide)
- `bim/framing/linear-member-face-snap.ts` → **`proportionalSlideStep(faceLen, memberWidth, dominantUnit)`** + **`resolveLinearMemberFaceSnap`**.
- `bim/framing/member-column-face-snap.ts` → **`slideAlongFace(c, lo, hi, half, dominantUnit)`** + constants **`MEMBER_GHOST_LEN_MM=1200`, `MEMBER_GHOST_CAPTURE_MM=600`, `DOMINANT_DIVISION_MM=10`**.
- `systems/tracking/adaptive-distance-snap.ts` → **`quantizeMagnitude(value, step)`**.

### 2.6 Helpers γεωμετρίας/anchor (reuse library)
- `geometry/shared/footprint-face-frame.ts` → **`footprintBounds`**, **`pickDominantFace`**, **`distanceToFootprintBounds`**.
- `column-face-snap-helpers.ts` → **`anchorForHorizontalFace(face, third)`**, **`anchorForVerticalFace`**, **`edgeFlushAnchor`**, **`axisAlignmentRotationDeg`**, **`isAxisAligned`**, **`buildCenteredAxisFaceFrame`** (GhostFaceFrame για listening dims), **`isShortEndFace`**.
- `framing/member-face-third.ts` → **`pickThird(pos, min, max)`** → `'lo'|'mid'|'hi'`.

### 2.7 Ghost assembly + consumers
- `bim/placement/placement-ghost-assembly.ts` → **`assemblePlacementGhost(args)`** / **`assemblePlacementRotationGhost`** — χτίζει το WYSIWYG ghost από το snap (entity-agnostic· entity-specific μόνο στο `buildEntity` lambda). **Listening dims «δωρεάν»** μέσω `faceSnap.faceFrame` → `resolveGhostFaceDimensionsMeta`.
- `hooks/drawing/column-preview-helpers.ts` → **`generateColumnPreview(cursor, sceneUnits)`** (ο consumer στο preview).
- `systems/cursor/mouse-handler-up.ts` → ο consumer στο commit (ίδιο brain).
- `bim/geometry/column-geometry.ts` → **`computeColumnGeometry`**, **`buildLshapeLocal`** (οι κορυφές του L), **`buildLocalFootprint`/`transformFootprint`** (anchor offset + rotation).

### 2.8 Σχετική ΠΡΟΣΦΑΤΗ δουλειά (ΠΡΟΣΟΧΗ — coordinate)
- **ADR-398 §3.18 / ADR-514 Φ6e** — «Φάντασμα ακολουθεί ΛΟΞΕΣ/ΠΟΛΥΓΩΝΙΚΕΣ παρειές κολόνας+τοίχου» (`collectFootprintEdgeTargets` + `resolveFootprintEdgeSnap`). **UNCOMMITTED 2026-06-25 (codex)** — δες `HANDOFFS/HANDOFF_2026-06-24_ghost-follow-slanted-polygonal-faces-columns-walls.md` + MEMORY. **Αυτό είναι το ΑΜΕΣΩΣ γειτονικό feature** — η νέα δουλειά πιθανότατα επεκτείνει τον ίδιο μηχανισμό. Συγχρόνισε με codex πριν αγγίξεις `column-face-snap.ts` / `member-snap-targets.ts` / `scene-snap-targets.ts`.

---

## 3. ΤΟ ΚΕΝΟ (τι είναι ΝΕΟ) + προτεινόμενη προσέγγιση

Ο υπάρχων face-snap χρησιμοποιεί το **bbox** της κολόνας ως «πλευρά κολόνας». Για το L, η σωστή αναφορά
είναι οι **3 γραμμές του ΟΡΙΖΟΝΤΙΟΥ ΣΚΕΛΟΥΣ** (Α-Β νότια, Γ1 κέντρο, Δ βόρεια) — ΟΧΙ το bbox. Άρα:

### ΝΕΟ #1 — εξαγωγή των 3 γραμμών του σκέλους L (ΝΕΟ αρχείο)
`bim/columns/column-lshape-reference-lines.ts` (ΝΕΟ) → **`resolveLshapeHeadReferences(params): LshapeHeadReferences | null`**
- Από `params` (kind `L-shape` + `lshape` override + anchor + rotation) δίνει: `leg.origin`, `leg.direction` (κατά μήκος σκέλους), `southFace/centerLine/northFace` (signed offsets από το κέντρο σκέλους), `alongMin/alongMax`.
- **REUSE** την ίδια γεωμετρία με το `buildLshapeLocal` (μην ξαναγράψεις διαστάσεις σκέλους — εξήγαγε ΚΟΙΝΟ `lshapeMetrics(width, depth, s, override)` και κάλεσέ το ΚΑΙ από το `buildLshapeLocal`, ώστε footprint ≡ reference lines, μηδέν drift). ⚠️ **Πρόσεξε:** το `buildLshapeLocal` είναι στο `column-geometry.ts` (μεγάλο, ίσως κοινό με codex) — εξαγωγή του `lshapeMetrics` εκεί = κοινό αρχείο, συγχρόνισε.

### ΝΕΟ #2 — ο resolver ευθυγράμμισης σκέλους-L ↔ γραμμών τοίχου (ΝΕΟ tier)
**Κρίσιμο — αυτή είναι η ιδιάζουσα συμπεριφορά:** δοθέντος (α) των 3 γραμμών τοίχου (από `buildMemberAxisFrame`)
και (β) των 3 γραμμών σκέλους-L (από #1), επίλεξε **ζεύγος (γραμμή-φαντάσματος → γραμμή-τοίχου)** βάσει της
**κάθετης θέσης του κέρσορα** ως προς τον τοίχο, υπολόγισε τη θέση/anchor ώστε η επιλεγμένη γραμμή σκέλους να
κάθεται flush στην επιλεγμένη γραμμή τοίχου, και **ολίσθησε κατά μήκος** (`proportionalSlideStep` + `quantizeMagnitude`).
- Map ζευγών (Β→Ν): `AB→1-2` (πάνω) → `Γ1→Γ2` (κέντρο) → `Δ→1-2` → (`AB→Z` όταν ο κέρσορας πάνω από Z).
- Έξοδος = **`ColumnFaceSnap`** (ίδιος τύπος): `rotation = axisAlignmentRotationDeg(wall.u)` (το L ακολουθεί κλίση τοίχου), `anchor` = αυτό που βάζει τη σωστή γραμμή σκέλους στη θέση, `faceFrame` = `buildCenteredAxisFaceFrame(...)` για listening dims.
- **REUSE:** `projectPointOnAxis`, `resolveAxisCenterFoot`, `proportionalSlideStep`, `quantizeMagnitude`, `pickThird`, `axisAlignmentRotationDeg`, `buildCenteredAxisFaceFrame`. Μην ξαναγράψεις project/slide/anchor math.
- **anchor:** το offset της επιλεγμένης γραμμής σκέλους (π.χ. `southFace`) σε σχέση με το `params.position`/anchor δίνει τη μετατόπιση ώστε το `ColumnFaceSnap.position` να τοποθετεί τη γραμμή στη θέση τοίχου. (Πρόσεξε: το L δεν είναι συμμετρικό — το `resolveLshapeHeadReferences` πρέπει να δίνει τα offsets σε σχέση με το ίδιο σύστημα anchor που χρησιμοποιεί ο builder.)

### ΣΥΝΔΕΣΗ — προτίμησε ΝΕΟ tier μέσα στο dispatcher
Πρόσθεσε ΕΝΑ νέο tier στο **`resolveColumnFaceSnapFromTargets`** `nearestHit(... lshapeWallAlignHit ...)` — ενεργό
ΜΟΝΟ όταν `toolKind` σχεδιάζει `L-shape` ΚΑΙ υπάρχει wall target κοντά. **Minimal edit** στο `column-face-snap.ts`
(ένα import + μία γραμμή στο `nearestHit`)· όλη η ουσία στο ΝΕΟ αρχείο. (Δες §2.8 — συγχρόνισε με codex.)

> ⚠️ ΠΡΟΣΟΧΗ στην απόκλιση από το πρόχειρο: ο πρώτος χάρτης πρότεινε «έκθεση σκέλους-L ως **target**» (για να
> κουμπώνει ΑΛΛΟ φάντασμα σε υφιστάμενο L). Εδώ είναι το **αντίστροφο**: το φάντασμα-L κουμπώνει στον **τοίχο**.
> Άρα δεν χρειάζεται `lshapeHeadTargets` bucket στο store — οι γραμμές σκέλους υπολογίζονται από τα **params του
> φαντάσματος** (live), όχι από scene entities. (Αν αργότερα ζητηθεί ΚΑΙ το αντίστροφο, τότε προστίθεται bucket.)

---

## 4. ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ (φάσεις)

1. **Plan mode + ADR-522** — επιβεβαίωσε επόμενο ελεύθερο ADR (≥522, codex τρέχει). Γράψε ADR-522 (cross-link ADR-398/514/357).
2. **Φ1:** `lshapeMetrics` SSoT (εξαγωγή, κοινό με `buildLshapeLocal`) + `resolveLshapeHeadReferences` (ΝΕΟ αρχείο). Unit tests (γεωμετρία ταυτίζεται με footprint).
3. **Φ2:** ΝΕΟ resolver `resolveLshapeWallAlignSnap(cursor, wallFrames, legRefs, sceneUnits)` (το map ζευγών Β→Ν + flush + slide). Unit tests (επιλογή ζεύγους ανά κάθετη ζώνη, slide, clamp, rotation=κλίση τοίχου).
4. **Φ3:** σύνδεση ΕΝΟΣ tier στο `resolveColumnFaceSnapFromTargets` (gated σε L-shape + wall κοντά). Integration test preview≡commit.
5. **Φ4:** browser-verify με το ακριβές σενάριο του στιγμιότυπου (L πάνω από οριζόντιο τοίχο, κατέβασμα κέρσορα → 3 στάδια αγκύρωσης + ολίσθηση).

---

## 5. Περιορισμοί / κανόνες (ΥΠΟΧΡΕΩΤΙΚΟ)
- **FULL SSoT, μηδέν διπλότυπα** — REUSE τη §2 λίστα. **ΞΑΝΑ-grep** για `project*Axis`, `slide`, `faceFrame`, `anchorFor*`, `axisAlignment*` ΠΡΙΝ γράψεις οτιδήποτε.
- **Shared working tree (codex)** — νέα λογική σε ΝΕΑ αρχεία· minimal edits στα κοινά (`column-face-snap.ts`, `member-snap-targets.ts`, `scene-snap-targets.ts`, `column-geometry.ts`). Έλεγξε `git status` + το codex handoff (§2.8) πριν αγγίξεις κοινά.
- **N.17:** ΕΝΑ tsc τη φορά — έλεγξε `Get-CimInstance ... tsc` πριν τρέξεις (codex τρέχει tsc).
- **ΠΟΤΕ commit/push** (N.(-1)) — ο Giorgio committαρει. CHECK 6B/6D: αν αγγίξεις snap/cursor/preview αρχεία → stage ADR-040 + το νέο ADR.
- **Revit parity:** ευθυγράμμιση παρειών & centerlines, αγκύρωση + ολίσθηση — όπως Revit «align».

## 6. Επαλήθευση
- jest: νέα unit suites (lshape refs + wall-align resolver) + regression `column-face-snap`/`bim-cursor-snap`/`member-*-face-snap`.
- browser `/dxf/viewer`: εργαλείο Κολόνα → τύπος «Σχήμα Γ» (L) → φέρε φάντασμα πάνω από οριζόντιο τοίχο → κατέβασε κέρσορα Β→Ν → επιβεβαίωσε τα 3 στάδια (AB→βόρεια τοίχου, Γ1→Γ2, Δ→βόρεια τοίχου) + ολίσθηση κατά μήκος + AB→νότια (Z).

## 7. Χάρτης pipeline (περίληψη)
```
tool activate → sceneSnapTargetsStore.refresh → collectSceneSnapTargets (wallTargets {axis,outline} έτοιμα)
preview/commit → resolveBimCursorSnap(toolKind:'column') → resolveColumnFaceSnapFromTargets
    → nearestHit( … , [ΝΕΟ] resolveLshapeWallAlignSnap(cursor, buildMemberAxisFrame(wall), resolveLshapeHeadReferences(ghostParams)), … )
    → ColumnFaceSnap {position, anchor, rotation, faceFrame}
→ assemblePlacementGhost → WYSIWYG L ghost (flush + slide + listening dims)
```
Πλήρης χάρτης (52KB) στο: `scratchpad/snap-map.md` (session 0a316210) — αν χαθεί, ξανατρέξε Explore agent με το ίδιο prompt.
