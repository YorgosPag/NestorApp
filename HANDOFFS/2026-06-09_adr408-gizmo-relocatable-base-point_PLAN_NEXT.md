# 🧠 HANDOFF — ADR-408 «3D Gizmo: Relocatable Base Point / Rotation Center (Revit-faithful)» — PLAN MODE

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας: PLAN MODE → υλοποίηση.** Ο Giorgio θέλει να μπορεί, στο 3D, να **μετακινεί το σημείο αναφοράς (base point / rotation center) του gizmo σε ΟΠΟΙΟΔΗΠΟΤΕ σημείο** μιας οντότητας BIM — **ακριβώς όπως η Revit** (όχι δικά μας «θέλω», αλλά ό,τι κάνει ο «βασιλιάς»). **FULL ENTERPRISE + FULL SSOT.**

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως η Revit»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ.
- **Πάρε ΕΣΥ τις Revit-grade αποφάσεις** — μη ρωτάς τον Giorgio να διαλέξει standard professional options· πρότεινε την enterprise/Revit λύση + ζήτα μόνο έγκριση plan (μνήμη `feedback_make_revit_grade_decisions_yourself`).
- **SHARED working tree** με άλλον agent (codex — δουλεύει heating/ADR-429/`mep-design`). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **Plan Mode πρώτα** → file-level σχέδιο + έγκριση **ΠΡΙΝ** κώδικα.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε `Get-CimInstance Win32_Process … *tsc*` πριν ξεκινήσεις.
- **N.15:** μετά → ADR-408 changelog + μνήμη + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ίδιο commit).
- **ADR-040:** τα `bim-3d/gizmo` + `bim-3d/animation` είναι **ΕΚΤΟΣ** της canvas micro-leaf λίστας (CHECK 6B/6D δεν εφαρμόζονται) — δεν χρειάζεται staging ADR-040.

---

## 0) ΚΑΤΑΣΤΑΣΗ — τι ΗΔΗ δουλεύει (ΜΗΝ το ξαναγγίξεις χωρίς λόγο)

🟢 **3D gizmo (ολοκληρωμένα, ο Giorgio θα κάνει commit):**
- **Φ-C** Connectivity-preserving move + 3D rotate/vertical persistence + connected-pipe live follow.
- **Φ-D** Per-endpoint shape handles για **σωλήνες** (`endpoint` constraint, camera-facing).
- **Φ-E** Entity-aware DOF (planar 2-άξ. δομικά vs free-3D MEP) + combined H+V move.
- **Φ1 (μόλις τελείωσε, 2026-06-09):** Revit length shape-handles σε **τοίχο/δοκό** (`endpoint` constraint με **mode** `'free-3d'`/`'horizontal'`) + αφαίρεση thickness/section resize (column/wall→μόνο `resize-y`/`resize-m-y`· beam/slab→καμία resize· section=μόνο Τύπος). 301/301 jest· tsc 0. Δες μνήμη `project_adr408_gizmo_structural_length`.

⚠️ **Άλλος agent (codex) έκανε refactor** στο `bim3d-edit-command-builders.ts`: εξήγαγε τα `mepVerticalCommand`/`mepUpdateCommandFromNext`/`mepVerticalNextParams` σε **NEW `bim3d-edit-mep-commands.ts`**. **Επιβεβαίωσε το τρέχον state (`git status` + read) ΠΡΙΝ αγγίξεις gizmo/animation αρχεία** — το tree αλλάζει.

---

## 1) ΤΟ ΠΡΟΒΛΗΜΑ (τι ζητάει ο Giorgio)
Στο 3D, το gizmo **κουμπώνει ΠΑΝΤΑ στο γεωμετρικό κέντρο** της οντότητας (`computeEditAnchor` → `box.getCenter`, `bim3d-edit-interaction-handlers.ts:88`). Άρα:
- Η **περιστροφή** γίνεται πάντα γύρω από το κέντρο (όχι π.χ. γύρω από μια γωνία).
- Η **μετακίνηση** δεν έχει επιλέξιμο base point (το snapping χρησιμοποιεί ΟΛΑ τα grips ως υποψήφια, «nearest-wins», αλλά δεν διαλέγεις ΕΣΥ το σημείο-βάση).
- **Δεν υπάρχει** τρόπος να μεταφέρεις το σημείο αναφοράς σε αυθαίρετο σημείο.

## 2) ΤΙ ΚΑΝΕΙ Η REVIT (η αλήθεια — στόχος)
Η Revit **ΔΕΝ έχει μόνιμο σερνόμενο gizmo**. Το «σημείο αναφοράς» το **επαναορίζεις κάθε φορά**:
1. **Direct drag** — το σημείο που πιάνεις την οντότητα = το base point.
2. **Move (MV)** — Select → Move → «**specify base point**» (κλικ σε ΟΠΟΙΟΔΗΠΟΤΕ σημείο, με snap σε άκρο/μέσο/τομή ή αυθαίρετο) → «specify destination». Διάνυσμα base→dest = η μετακίνηση.
3. **Rotate (RO)** — το **κέντρο περιστροφής** είναι εικονίδιο που το **σέρνεις σε ΟΠΟΙΟΔΗΠΟΤΕ σημείο** πριν περιστρέψεις (το πιο κοντινό ανάλογο στο «μετακίνησε το gizmo»).

## 3) ΤΟ ΣΧΕΔΙΟ (πρότεινε στο Plan Mode — FULL SSOT)
**Στόχος: relocatable base point/rotation center για το gizmo.**

**Κεντρική ιδέα (minimal, υψηλό reuse):** το rotate pivot **είναι ήδη** το `startAnchor = overlay.getPosition()` (`bim-gizmo-controller.ts:26,75`). Άρα αν:
1. αποθηκεύσουμε ένα **base-point override** (world point) σε νέο low-freq state,
2. το `gizmo origin = override ?? centroid` (το `computeEditAnchor` σέβεται το override — δεν το επαναφέρει στο κέντρο),
→ **η περιστροφή κουμπώνει στο επιλεγμένο σημείο σχεδόν δωρεάν.**

**Φάση A — Set-base-point interaction (Revit «pick base point»):**
- Νέος τρόπος ορισμού: **modifier + click** (πρότεινε: `Ctrl`+click στο 3D, ή dedicated mode toggle) πάνω σε σημείο της επιλεγμένης οντότητας → raycast στο bim mesh → **snap** σε vertex/edge/midpoint (REUSE `dim3d-snap-engine-adapter.ts` — ήδη κάνει 3D snap-to-geometry για διαστάσεις· ΟΧΙ νέα snap math) → world point.
- Fallback: αν δεν βρει snap target, αυθαίρετο σημείο πάνω στην επιφάνεια (raycast hit point).

**Φάση B — Base-point override state (SSoT):**
- Νέο πεδίο στο `Bim3DEditStore` (low-freq, ADR-040-safe — μην subscribe-άρει ο shell): `basePointOverride: THREE.Vector3 | null` (+ setter/clear). **ΕΝΑ SSoT** για το base point.
- `computeEditAnchor`: αν υπάρχει override → `overlay.updatePosition(override)` (ΟΧΙ centroid)· αλλιώς centroid (σημερινή συμπεριφορά, zero regression).
- **Reset:** το override καθαρίζει σε deselect / αλλαγή entity / Esc / νέα επιλογή (μην «κολλήσει» σε λάθος σημείο).

**Φάση C — Move base point (snap-from-base):**
- Όταν υπάρχει override, το `buildDragSnapFn` πρέπει να χρησιμοποιεί το **override ως ΤΟ σημείο-βάση** για το snap (αντί για όλα τα grips) → «πιάσε από αυτό το σημείο, κούμπωσέ το εκεί» (Revit Move base→dest). REUSE `makeMoveSnapFn` με single offset = `(override − groupAnchorPlan)`.
- Η ίδια η translation είναι base-independent (delta), οπότε το move command **δεν αλλάζει** — αλλάζει μόνο ποιο σημείο snap-άρει.

**Φάση D — Visual marker (Revit-style):**
- Διακριτό glyph στο base point (π.χ. το Revit «⊙» rotation-center icon / base-point cross), screen-constant μέγεθος (μοτίβο `snapMarker` στο `bim-gizmo-overlay.ts`). Δείχνει ξεκάθαρα ότι το σημείο αναφοράς μετακινήθηκε.

**Αποφάσεις Revit (πάρ' τες εσύ):** modifier+click για set base (μην προσθέσεις βαρύ UI)· override καθαρίζει σε deselect/Esc· rotation center + move base = το ΙΔΙΟ override (ένα SSoT)· marker = Revit rotation-center glyph.

## 4) REUSE SURFACE (κλειδιά — επιβεβαίωσε offsets, το tree αλλάζει)
- `bim-3d/animation/bim3d-edit-interaction-handlers.ts` — `computeEditAnchor` (εδώ μπαίνει το override precedence)· `buildDragSnapFn` (Φάση C snap-from-base)· `onEditPointerDown` (εδώ ή σε νέο handler το modifier+click set-base).
- `bim-3d/gizmo/bim-gizmo-controller.ts` — `startAnchor = overlay.getPosition()` (:26), rotate `pivot = startAnchor` (:75) → **ήδη σωστό**, μην το αλλάξεις.
- `bim-3d/gizmo/bim-gizmo-overlay.ts` — `updatePosition()` (δέχεται κάθε world point)· `snapMarker` builders (πρότυπο για το base-point marker).
- `bim-3d/stores/Bim3DEditStore.ts` — εδώ το `basePointOverride` SSoT (low-freq).
- `bim-3d/dimensions/dim3d-snap-engine-adapter.ts` — **REUSE** 3D snap-to-geometry (vertex/edge/midpoint) για το pick του base point. ΜΗΝ γράψεις νέα snap math.
- `bim-3d/animation/waypoint-drag-controller.ts` / `WaypointDragHandle.ts` — πρότυπο 3D `Raycaster` pick (αν χρειαστείς raycast στο bim mesh).
- `bim-3d/animation/use-bim3d-edit-interaction.ts` — wiring (subscribe/reset override σε selection change).
- `bim-3d/snapping/global-snap-engine` (`getGlobalSnapEngine`) — η ΜΙΑ snap engine (ήδη χρησιμοποιείται στο `buildDragSnapFn`).

## 5) ΤΕΣΤ
- Pure/unit: override precedence (`computeEditAnchor` με/χωρίς override)· snap-from-base offset (single offset = override−anchor)· reset σε deselect.
- `bim-gizmo-overlay` marker visibility (override set → marker visible· clear → hidden).
- tsc background (N.17). Browser-verify με Giorgio (3D: Ctrl+click γωνία → gizmo/κέντρο εκεί → rotate κουμπώνει στη γωνία· move snap από εκείνο το σημείο).

## 6) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗ γράψεις κώδικα πριν την έγκριση plan.
- ΜΗΝ αλλάξεις το rotate pivot flow (`startAnchor`) — είναι ήδη σωστό· αρκεί το override στο `updatePosition`/`computeEditAnchor`.
- ΜΗΝ γράψεις νέα snap math — REUSE `dim3d-snap-engine-adapter` / `getGlobalSnapEngine`.
- ΜΗΝ κάνεις τον shell/orchestrator να subscribe-άρει high-freq (ADR-040· το override = low-freq).
- ΜΗΝ commit/push/adr-index. ΜΗΝ `git add -A`. ΜΗΝ 2ο tsc (N.17).
- ΜΗΝ σπάσεις Φ-C/Φ-D/Φ-E/Φ1 (endpoint handles, fitting-follow, DOF, length handles).

## 7) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ
1. Διάβασε αυτό + επιβεβαίωσε τρέχον state (`git status`· `computeEditAnchor`· `bim-gizmo-controller` startAnchor/pivot· `dim3d-snap-engine-adapter` API· Bim3DEditStore shape). Το tree αλλάζει (codex).
2. Επιβεβαίωσε ότι Φ-C/Φ-D/Φ-E/Φ1 είναι ακέραια.
3. **Plan Mode** → file-level σχέδιο (Φάσεις A–D) + ζήτα έγκριση.
4. Μετά έγκριση → υλοποίηση + tests + ADR-408 changelog + N.15.

## 8) ΜΝΗΜΕΣ
`project_adr408_gizmo_structural_length` (Φ1, μόλις έγινε), `project_adr408_3d_endpoint_drag` (Φ-D), `project_adr408_gizmo_dof` (Φ-E), `project_adr408_connectivity_preserving_move` (Φ-C), `feedback_make_revit_grade_decisions_yourself`.
