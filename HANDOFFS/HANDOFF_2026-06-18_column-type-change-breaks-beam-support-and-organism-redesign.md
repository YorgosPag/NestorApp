# HANDOFF — Αλλαγή τύπου κολόνας (ορθογωνική→L/T/U/I/τοιχείο) σπάει τη στήριξη δοκαριού + ο οργανισμός δεν ξαναστέκεται αυτόματα

**Ημ/νία:** 2026-06-18 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλους agents. `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. tsc = ένας τη φορά (N.17 — έλεγξε running tsc πρώτα). **ΜΗΝ αγγίξεις** uncommitted ADR-484/483/488/489/490/491/492 αρχείων άλλων agents/προηγούμενης δουλειάς.

**Απαιτήσεις Giorgio:** full enterprise + full SSOT, Revit-grade (όπως οι μεγάλοι παίκτες). **ΠΡΙΝ γράψεις κώδικα → πραγματικό SSoT audit (grep)** (τα anchors είναι έτοιμα στο §4/§5 — ΕΠΕΚΤΕΙΝΕ, μηδέν διπλότυπα). **Plan mode** (cross-cutting) πριν υλοποιήσεις, **ζήτα έγκριση**.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (στιγμιότυπο-απόδειξη)

`C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-18 231904.jpg`

Στήσιμο: 2 κολόνες 40×40 cm με πέδιλα, ενωμένες στην κορυφή με ένα δοκάρι (`w=250 d=700`) που πλαισιωνόταν στις **εσωτερικές παρειές** και των δύο (clear span, fully designed organism — οπλισμός/τάσεις/διατομές υπολογισμένα).

Ο χρήστης **άλλαξε τον τύπο της αριστερής κολόνας** από `rectangular` → **`L-shape`** (Γ κεφαλαίο / L). Στο στιγμιότυπο: αριστερά L-κολόνα `w=400 d=517`, δεξιά ορθογωνική `w=400 d=400`.

**Σύμπτωμα (από το διάγραμμα ροπών M):** η κόκκινη καμπύλη «κρέμεται» σαν **πρόβολος** — ~0 kNm στο αριστερό άκρο (στην L-κολόνα), μεγάλες τιμές (23.6, 30.8 kNm) προς τα δεξιά. Δηλαδή **το δοκάρι θεωρείται ότι στηρίζεται ΜΟΝΟ στη δεξιά ορθογωνική κολόνα· η L-κολόνα ΔΕΝ αναγνωρίζεται πλέον ως στήριξη**.

**Giorgio (όραμα — 2 μηνύματα):**
> «Όταν έχει υπολογιστεί ο οπλισμός, οι τάσεις, οι διατομές του οπλισμού των κολόνων/δοκαριών και αλλάξω τύπο κολόνας, το πρόγραμμα δεν συμπεριφέρεται σωστά και δεν αναγνωρίζει την αλλαγή τύπου.»
> «Όταν ο χρήστης αλλάξει τύπο κολόνας, το σύστημα να ξεκινά αμέσως να υπολογίζει πάλι διατομές/φορτία και να εμφανίζει τον οργανισμό **ολόκληρο, πλήρως μελετημένο, πλήρως ενοποιημένο**. Θέλω πλήρη αυτοματοποίηση. Ο οργανισμός να **στέκεται χωρίς προβλήματα** όταν ξεκινήσει η κατασκευή.» (ADR-487 living organism vision)

---

## 2. ROOT CAUSE ANALYSIS (από τον κώδικα — ακριβείς γραμμές)

### 🎯 ΚΥΡΙΟ root cause (ορατό bug): η framing/support detection βασίζεται στο `params.position` (σημείο), ΟΧΙ στο πραγματικό **footprint** → σπάει για ασύμμετρες/μη-ορθογωνικές διατομές.

Αλυσίδα στήριξης (διάγραμμα/FEM):
`beamFramesColumn` → `findColumnsFramedByBeamForGraph` → `buildStructuralGraph` (column-bearing edges) → `beamSupportColumnIds` → `derive-beam-support` (**count===1 → 'cantilever'/πρόβολος**).

- **`bim/columns/column-structural-attach-coordinator.ts:171-187` `beamFramesColumn`**:
  ```ts
  const { along: t, perp } = projectColumnCenterOnAxis(column, s.x, s.y, ux, uy);
  if (perp > halfWidth + tol) return false;   // ← εδώ απορρίπτεται η L-κολόνα
  ```
  `halfWidth = beam.width/2` (= 125mm για `w=250`), `tol = FRAMING_TOL_MM = 5mm`. Άρα `perp` πρέπει ≤ 130mm.

- **`bim/columns/column-face-trim.ts:66-76` `projectColumnCenterOnAxis`**: `perp` = κάθετη απόσταση του **`column.params.position`** (insertion point) από τον άξονα του δοκαριού. **ΔΕΝ** κοιτά το footprint.

- **`bim/columns/column-face-trim.ts:44-53` `columnSupportAlong`**: max projection των footprint vertices **από το `position`** → η «παρειά». Για ασύμμετρη διατομή το `position` δεν είναι το κεντροειδές/σημείο επαφής.

**Γιατί σπάει στην L-shape:** η L (`column-types.ts:50-60`, `ColumnLshapeParams` 77-87) είναι **ασύμμετρη** γύρω από το `position` (9-position `ColumnAnchor` 66-69 + `armLength`/`armWidth`). Το `d=517` (vs αρχικό 400) δείχνει ότι το bbox μεγάλωσε ασύμμετρα → το `position`/κεντροειδές μετατοπίστηκε κάθετα στον άξονα. Για **edge-justified** δοκάρι (`w=250` μέσα σε κολόνα `w=400` → ήδη ~75mm offset) + L-depth growth (~+58mm) → `perp` ξεπερνά τα 130mm → **return false** → χάνεται η στήριξη → πρόβολος.

> Το ίδιο position-based κριτήριο χρησιμοποιεί και το **ADR-492 `reframeBeamEndpointsToColumns`** (`beam-column-reframe.ts` — perp ≤ halfWidth+collinearTol με `projectColumnCenterOnAxis`). Άρα **και ο reframe** θα αποτυγχάνει για L/T/U/I κολόνες — ίδια ρίζα, ίδιο fix.

### Δευτερεύον (όραμα full-automation): το re-trigger ΥΠΑΡΧΕΙ ήδη — το πρόβλημα είναι το λάθος topology, ΟΧΙ ότι δεν τρέχει ο επανυπολογισμός.

- **`ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts:59`** εκπέμπει `EventBus.emit('bim:column-params-updated', …)` σε ΚΑΘΕ αλλαγή params (περιλαμβάνει την αλλαγή `kind`).
- `bim:column-params-updated` ∈ **`ORGANISM_EVENTS`** (`useStructuralOrganism.ts:51`) **∩ `AUTO_DESIGN_EVENTS`** (`useAutoFoundationDesign.tsx:87`). Άρα ο οργανισμός **re-derive-άρει** + ο engaged proactive κύκλος (ADR-488 organism→ADR-491 reinforce/loads/sizing→FEM→utilization) **τρέχει ήδη**.
- **Συμπέρασμα:** «δεν αναγνωρίζει την αλλαγή» = ο επανυπολογισμός ΤΡΕΧΕΙ, αλλά πάνω σε **λάθος στατικό σύστημα** (πρόβολος αντί αμφιέρειστο) λόγω του geometry bug. **Διορθώνοντας το framing-detection geometry, ο ήδη-υπάρχων proactive κύκλος θα παράγει σωστό, πλήρως-ενοποιημένο οργανισμό αυτόματα** — ακριβώς το όραμα του Giorgio.

> 🔎 **VERIFY στο plan:** ότι ΟΛΟΙ οι proactive hooks (sizing ADR-475, reinforce ADR-459-Φ8/491, loads ADR-467/478, FEM ADR-481, utilization ADR-485) ακούν `bim:column-params-updated` και συγκλίνουν χωρίς freeze στην αλλαγή **kind** (όχι μόνο dimension). Αν κάποιος ακούει μόνο dimension-specific event → κενό αυτοματοποίησης.

---

## 3. ΖΗΤΟΥΜΕΝΟ (Revit-grade) — plan mode + έγκριση

**Πυρήνας:** η αναγνώριση «δοκάρι στηρίζεται σε κολόνα» πρέπει να είναι **kind-agnostic** — να δουλεύει για ΚΑΘΕ διατομή (rectangular/circular/**L/T/U/I**/polygon/shear-wall/composite), βασισμένη στο **πραγματικό footprint** της κολόνας (τέμνει/εφάπτεται/είναι εντός halfWidth από τον άξονα του δοκαριού), ΟΧΙ στο σημείο `position`. Όταν αυτό διορθωθεί, ο ήδη-υπάρχων proactive κύκλος ξαναστήνει τον οργανισμό αυτόματα (full automation).

---

## 4. SSoT AUDIT (κάνε ΕΣΥ grep — επιβεβαίωσε/επέκτεινε· ΜΗΔΕΝ διπλότυπα)

| Concept | SSoT (extend, ΜΗΝ διπλασιάσεις) |
|---|---|
| **Framing/collinearity detection** | `bim/columns/column-structural-attach-coordinator.ts` → `beamFramesColumn` (171), `findColumnsFramedByBeam(ForGraph)` (198/224). **ΕΔΩ μπαίνει το fix** (footprint-based perp/coverage). |
| **Center→axis projection** | `bim/columns/column-face-trim.ts` → `projectColumnCenterOnAxis` (66). Position-based — χρειάζεται footprint-aware variant (ή νέο `projectColumnFootprintOnAxis` δίπλα, ΚΟΙΝΟ για framing + reframe). |
| **Face offset** | `bim/columns/column-face-trim.ts` → `columnSupportAlong` (44). Ήδη footprint-vertex projection **αλλά από `position`** — έλεγξε ότι δίνει σωστή παρειά για ασύμμετρη διατομή (ή μέτρα ως προς τον άξονα, όχι το position). |
| **Beam reframe (ADR-492)** | `bim/beams/beam-column-reframe.ts` `reframeBeamEndpointsToColumns` — **ΙΔΙΟ position-based κριτήριο** → ίδιο fix το θεραπεύει. ΜΗΝ το διπλασιάσεις. |
| **Support count / cantilever** | `bim/structural/organism/derive-beam-support.ts` (`beamSupportColumnIds`→count===1→cantilever) + `bim/structural/loads/load-path-walk.ts` (`beamSupportColumnIds`). **Καταναλωτές** — όχι σημείο fix· θα διορθωθούν αυτόματα όταν ο graph ξαναβλέπει τη στήριξη. |
| **Polygon geometry helpers (REUSE για το fix)** | `bim/geometry/shared/polygon-utils.ts` (exported `pointInPolygon` :124), `bim/geometry/shared/segment-polygon-coverage.ts` (segment↔polygon), `rendering/hitTesting/hit-test-entity-tests.ts` `closestPointOnLine` (:311). **Αν χρειαστείς distance-footprint-to-axis → reuse/extend αυτά, ΜΗΝ γράψεις νέο point-in-polygon.** |
| **Column footprint** | `column.geometry.footprint.vertices` (παράγεται από `computeColumnGeometry` ανά kind — L/T/U/I/polygon). Είναι ΗΔΗ το πραγματικό περίγραμμα κάθε διατομής → η framing detection πρέπει να το χρησιμοποιεί. |
| **Re-derive triggers** | `useStructuralOrganism.ts` `ORGANISM_EVENTS` (51) + `useAutoFoundationDesign.tsx` `AUTO_DESIGN_EVENTS` (87). `bim:column-params-updated` ΥΠΑΡΧΕΙ ήδη και στα δύο. |

---

## 5. Anchors προς υλοποίηση (ΕΠΕΚΤΕΙΝΕ, μηδέν duplicate)

1. **Footprint-based collinearity SSoT.** Αντικατέστησε το position-perp κριτήριο με «**το footprint της κολόνας είναι εντός halfWidth+tol από την ευθεία του άξονα ΚΑΙ η διαμήκης επικάλυψη είναι εντός span**». Πιθανό: NEW exported `projectColumnFootprintOnAxis(column, ax, ay, ux, uy)` στο `column-face-trim.ts` (δίπλα στο `projectColumnCenterOnAxis`) που επιστρέφει `{ alongMin, alongMax, perpMin }` από τα **footprint vertices** (όχι το position). Κοινό για `beamFramesColumn` ΚΑΙ `reframeBeamEndpointsToColumns` (boy-scout — μηδέν διπλή geometry, ίδιο μάθημα ADR-492 §3 `projectColumnCenterOnAxis`).
2. **`columnSupportAlong` ως προς τον άξονα.** Βεβαιώσου ότι η παρειά μετριέται ως προς το σημείο τομής footprint↔άξονα (ώστε το reframe να κάθεται στη σωστή παρειά της L), όχι ως max-projection-από-position.
3. **Kind-agnostic verify:** δοκίμασε rectangular/circular/L/T/U/I/shear-wall/polygon. Edge: shear-wall (μακρόστενο) δεν πρέπει να πιάνεται ως στήριξη όταν ο άξονας δεν το τέμνει.
4. **Full-automation verify (§2 δευτερεύον):** μετά το geometry fix, η αλλαγή τύπου → ο proactive κύκλος ξαναστήνει σωστά διατομές/φορτία/οπλισμό/FEM/utilization αυτόματα. Αν εντοπίσεις proactive hook που ΔΕΝ ακούει `bim:column-params-updated` → πρόσθεσέ το (command-time/event, **ΟΧΙ reactive re-emit** — §6).

### Edge cases
- Edge-justified δοκάρι (η αρχική περίπτωση): η L-κολόνα να αναγνωρίζεται ακόμη κι όταν το position είναι offset.
- Πραγματικός πρόβολος (1 στήριξη) → να παραμένει 'cantilever' (μην «κολλήσεις» ψεύτικη 2η στήριξη).
- L με arm προς/μακριά από το δοκάρι (flipY) → footprint είναι το SSoT, να δουλεύει και στις δύο.
- circular/polygon: footprint = προσέγγιση πολυγώνου → ΟΚ με footprint-based.

---

## 6. 🚨 ΜΑΘΗΜΑΤΑ (μη τα ξεχάσεις)

- **ADR-492 FREEZE LESSON:** ΠΟΤΕ reactive effect που re-emit-άρει geometry event (`bim:entities-moved`/`*-params-updated`) μέσα στον engaged proactive στατικό κύκλο → storm/freeze στο «Ανάλυση». Κάθε νέο re-trigger = **command-time** (μέσα στην εντολή), ΕΝΑ emit, μηδέν reactive loop.
- **CODE = SOURCE OF TRUTH (N.0.1):** το `column.geometry.footprint` είναι ΗΔΗ ο σωστός φορέας του περιγράμματος κάθε διατομής — χρησιμοποίησέ το, μην ξαναϋπολογίσεις διατομή.
- **Boy-scout (N.0.2):** αν εξάγεις footprint-projection SSoT, κάν' το ΚΟΙΝΟ για framing + reframe (όπως ήδη το `projectColumnCenterOnAxis`).

---

## 7. ❌ ΜΗΝ
- ΜΗΝ commit/push (Giorgio μόνο). ΜΗΝ `git add -A` (shared tree).
- ΜΗΝ διπλασιάσεις `pointInPolygon`/`closestPointOnLine`/`projectColumnCenterOnAxis`/`columnSupportAlong` — reuse/extend.
- ΜΗΝ φτιάξεις reactive effect που re-emit-άρει geometry event (freeze).
- ΜΗΝ αγγίξεις uncommitted ADR-484/483/488/489/490/491/492 άλλων.

---

## 8. ΕΚΤΕΛΕΣΗ
1. Διάβασε στιγμιότυπο + §2 root cause + ADR-486 (topology-aware beam support) + ADR-487 (living organism vision) + ADR-492 (reframe, ίδια ρίζα) + ADR-363 §5.6 (column kinds).
2. **SSoT grep audit** (επιβεβαίωσε τα anchors §4/§5 + βρες τυχόν proactive hook που χάνει το kind-change).
3. **Plan mode** → footprint-based collinearity SSoT + (αν χρειαστεί) automation gaps· **ζήτα έγκριση**.
4. Υλοποίηση + jest (column-structural-attach-coordinator + reframe με L/T/U/I fixtures) + tsc background (N.17, ένας τη φορά).
5. **ADR:** έλεγξε `adr-index.md` για επόμενο ελεύθερο (493 φαίνεται πιασμένο από άλλο handoff → πιθανό **≥494**) Ή **επέκτεινε ADR-486** (topology-aware beam support — το geometry detection ανήκει εκεί). + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15).
6. **ΜΗΝ** commit — ο Giorgio.

## 9. Σχετικά αρχεία (anchors)
`bim/columns/column-structural-attach-coordinator.ts` (`beamFramesColumn` 171, `findColumnsFramedByBeamForGraph` 224) · `bim/columns/column-face-trim.ts` (`projectColumnCenterOnAxis` 66, `columnSupportAlong` 44) · `bim/beams/beam-column-reframe.ts` (ADR-492, ίδια ρίζα) · `bim/structural/organism/derive-beam-support.ts` · `bim/structural/loads/load-path-walk.ts` (`beamSupportColumnIds`) · `bim/types/column-types.ts` (ColumnKind 50, ColumnLshapeParams 77) · `bim/geometry/shared/polygon-utils.ts` (REUSE) · `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts:59` (event emit) · `hooks/useStructuralOrganism.ts` (ORGANISM_EVENTS) · `hooks/useAutoFoundationDesign.tsx` (AUTO_DESIGN_EVENTS).
