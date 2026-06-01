# HANDOFF — ADR-402 «Νέα Φάση»: 3Δ περιστροφή BIM οντοτήτων σε ΟΛΟΥΣ τους άξονες (X/Z tilt)

**Ημερομηνία σύνταξης:** 2026-06-01
**Συντάκτης:** Opus 4.8 (SOLO) — μετά από συζήτηση με Giorgio για το γιατί εμφανίζεται μόνο το δαχτυλίδι rotate-Y
**Θέμα:** ADR-402 — 3D Viewport BIM Element Editing
**Φάση:** Πραγματική **3Δ περιστροφή σε όλους τους άξονες** (rotate-X / rotate-Z = tilt/κλίση), όχι μόνο rotate-Y (κάτοψη).
**Κατάσταση εκκίνησης:** Όλο το ADR-402 (Phase A/B/C + Sub-Phase 1 stair + Live preview + axis-Y move + 3 bug fixes) = **pending commit + 🔴 browser verify**. Ο **Giorgio κάνει ΜΟΝΟΣ ΤΟΥ τα commit** — εσύ ΠΟΤΕ.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ ΟΤΑΝ ΞΕΚΙΝΗΣΕΙΣ
1. **`git log` / `git status`** — έλεγξε τι έχει κάνει commit ο Giorgio. **ΜΗΝ υποθέσεις.** Το working tree έχει δουλειά πολλών ADR (401/396/402/403) — **ΜΗΝ τα αγγίξεις, ΠΟΤΕ `git add -A`, ΠΟΤΕ commit/push** (N.(-1)).
2. **Διάβασε ADR-402** (`docs/centralized-systems/reference/adrs/ADR-402-3d-bim-element-editing.md`) — ειδικά «Τίμια όρια Phase A» (γρ. 95-108) που εξηγεί γιατί κρύβονται τα X/Z rings.
3. **Διάβασε memory:** `project_adr402_genarc_gizmo_port.md` + `project_adr402_3d_bim_editing.md`.
4. **🚨 Phase 1 RECOGNITION (ADR-driven N.0.1) ΠΡΙΝ γράψεις κώδικα** — βλ. §1 παρακάτω. Αυτή η φάση **ΔΕΝ είναι απλή γέφυρα** όπως οι προηγούμενες· σπάει το θεμελιώδες αξίωμα του ADR-402.

---

## 1. ΤΟ ΚΕΝΤΡΙΚΟ ΠΡΟΒΛΗΜΑ (γιατί αυτή η φάση είναι ΔΙΑΦΟΡΕΤΙΚΗ από όλες τις προηγούμενες)

Όλο το ADR-402 μέχρι τώρα στηρίχθηκε σε ΕΝΑ αξίωμα: **«3Δ editing = γέφυρα προς υπάρχουσες, view-agnostic 2Δ εντολές. Μηδέν νέα μαθηματικά/εντολές.»**

**Αυτή η φάση σπάει το αξίωμα.** Λόγος:
- Η `RotateEntityCommand` (`core/commands/entity-commands/RotateEntityCommand.ts`) δέχεται **μόνο** `pivot: Point2D` + `angleDeg: number` → είναι **plan-rotation γύρω από τον κατακόρυφο άξονα** (ADR-188). Δεν υπάρχει έννοια 3Δ άξονα ή 3Δ orientation.
- Στο `bim-gizmo-drag-bridge.ts` όλη η περιστροφή γίνεται γύρω από `ROTATE_AXIS_Y` με `v.y = 0` (projection στο οριζόντιο επίπεδο). Τα `rotate-x`/`rotate-z` **δεν χειρίζονται πουθενά** — γι' αυτό κρύβονται στο `bim-gizmo-overlay.ts` (`BASE_HANDLES` περιέχει μόνο `rotate-y`).
- **Το BIM data model δεν αποθηκεύει 3Δ orientation.** Οι τοίχοι/κολώνες/δοκάρια/πλάκες ορίζονται με 2Δ γεωμετρία κάτοψης + ύψος/elevation. Υπάρχουν **μερικές** εξαιρέσεις κλίσης (ADR-401: κεκλιμένο δοκάρι `topElevationEnd`, κεκλιμένη πλάκα `SlabSlope` dir/angle) — αλλά αυτές είναι **ειδικές παράμετροι**, ΟΧΙ γενικό 3Δ rotation transform.

**Συνέπεια:** Το «να ξεκρύψουμε τα δύο δαχτυλίδια» **ΔΕΝ αρκεί** — θα ήταν νεκρά handles. Χρειάζεται:
1. Απόφαση **τι σημαίνει** X/Z περιστροφή για κάθε τύπο (έχει νόημα; πώς αποθηκεύεται;).
2. Πιθανή **επέκταση data model** (3Δ orientation/rotation πεδία) **+ νέα εντολή** (`Rotate3DEntityCommand` ή επέκταση).
3. **2Δ↔3Δ parity:** πώς εμφανίζεται μια κεκλιμένη οντότητα στην 2Δ κάτοψη; (Revit: η κάτοψη δείχνει projection.)

---

## 2. ΕΡΕΥΝΑ Phase 1 (κάν' την ΠΡΙΝ προτείνεις πλάνο)
- **BIM entity types:** `src/subapps/dxf-viewer/types/entities.ts` + `bim/**/types` — βρες αν υπάρχει ΟΠΟΙΟΔΗΠΟΤΕ 3Δ rotation/orientation πεδίο σήμερα. (Υποψία: ΟΧΙ, εκτός slope-specific.)
- **Slope precedents (ADR-401):** `bim/slabs/slab-slope.ts`, `bim/beams/beam-slope.ts` — πώς μοντελοποιείται η κλίση σήμερα (dir°/angle%, topElevationEnd). **Αυτό είναι το πιο κοντινό υπάρχον pattern** — ίσως η X/Z «περιστροφή» να εκφράζεται ως slope, ΟΧΙ ως αυθαίρετο quaternion.
- **3Δ converters:** `bim-3d/converters/*ToMesh` (`wallToMesh`/`columnToMesh`/`beamToMesh`/`slabToMesh`/`stairToMeshes`) — πώς θα εφαρμοστεί η κλίση στο mesh.
- **RotateEntityCommand + bim-rotate-geometry** (`bim/transforms/bim-rotate-geometry.ts`) — η υπάρχουσα plan-rotation ανά τύπο.

---

## 3. DESIGN QUESTIONS — ρώτησε τον Giorgio (ΑΠΛΑ ελληνικά + παραδείγματα, ΕΝΑ-ΕΝΑ — feedback `adr_questions_style`)
1. **Ποια στοιχεία θες να γέρνουν;** Έχει αρχιτεκτονικό νόημα να γέρνει: κεκλιμένο δοκάρι/στέγη ✅, κεκλιμένη κολώνα (raking column) ✅, κεκλιμένος τοίχος (battered wall) ✅. Αλλά: θες **όλα** τα στοιχεία να μπορούν να γέρνουν αυθαίρετα, ή **συγκεκριμένα** (δοκάρι/κολώνα/στέγη); _(Παράδειγμα: «θέλω να γέρνω κολώνα 15° για στέγαστρο» vs «θέλω ελεύθερη 3Δ περιστροφή σαν να ήταν generic mesh».)_
2. **Πώς το βλέπεις στην κάτοψη (2Δ);** Όταν γείρεις μια κολώνα, στην 2Δ κάτοψη θες να δείχνει: (α) την προβολή της (Revit-style)· (β) ένα σύμβολο κλίσης· (γ) τίποτα/αμετάβλητη; _(Αυτό καθορίζει αν σπάει το 2Δ rendering.)_
3. **Slope-based ή free-rotation;** Να εκφραστεί ως **γωνία κλίσης + διεύθυνση** (συμβατό με ADR-401 slab/beam slope, πιο «BIM-native») ή ως **πλήρης 3Δ orientation** (quaternion, σαν generic 3Δ μοντέλο); _(Πρόταση: slope-based — ευθυγραμμίζεται με υπάρχον pattern, αποφεύγει «generic mesh» που δεν είναι BIM.)_
4. **Όρια γωνίας / snap;** Snap σε τυπικές γωνίες (15°/30°/45°), ελεύθερη γωνία, ή και τα δύο (Shift=free);

⚠️ **Μέγεθος:** data model + command + gizmo + converters + 2Δ render + persistence → **σίγουρα 5+ αρχεία / 2+ domains → N.8 Orchestrator ή τουλάχιστον Plan Mode. ΣΤΑΜΑΤΑ και ρώτα τον Giorgio** (μην τρέξεις orchestrator χωρίς έγκριση — ~2.5-3.5× tokens).

---

## 4. REFERENCE (θέσεις-κλειδιά)
- **Gizmo handles visibility:** `bim-3d/gizmo/bim-gizmo-overlay.ts` → `BASE_HANDLES` (γρ. 38-40, εδώ προσθέτεις `rotate-x`/`rotate-z` ΟΤΑΝ υποστηρίζονται).
- **Gizmo rotate math:** `bim-3d/gizmo/bim-gizmo-drag-bridge.ts` → `projectRotateVector` (γρ. 236-249, `ROTATE_AXIS_Y` + `v.y=0`). Εδώ θα γενικευτεί ανά άξονα.
- **Gizmo types/constraints:** `bim-3d/gizmo/gizmo-types.ts` (`handleToConstraint`, rotate constraint).
- **Gizmo geometry (τα 3 rings υπάρχουν ήδη στη γεωμετρία):** `bim-3d/gizmo/gizmo-geometry.ts` — τα rotate-X/Z rings **είναι ήδη χτισμένα**, απλά κρυμμένα.
- **Plan-rotation command (ADR-188):** `core/commands/entity-commands/RotateEntityCommand.ts` (Point2D pivot + angleDeg — plan only).
- **Slope precedents (ADR-401, το πιο κοντινό BIM-native μοντέλο κλίσης):** `bim/slabs/slab-slope.ts`, `bim/beams/beam-slope.ts`.
- **Live preview (αν θες live tilt):** `bim-3d/gizmo/bim3d-edit-live-preview.ts` (rigid transform για move/rotate-Y· για X/Z tilt θα θέλει επέκταση).

---

## 5. ΟΡΙΑ (ΑΥΣΤΗΡΑ)
- **ΜΗΝ σπάσεις:** Phase A/B/C + Sub-Phase 1 + Live preview + axis-Y move (όλα pending commit/verify). Το rotate-Y πρέπει να μείνει **ακριβώς** όπως είναι.
- **ΜΗΝ ξεκρύψεις τα X/Z rings χωρίς πίσω-υποστήριξη** — νεκρά handles = χειρότερο UX από το να λείπουν.
- **ΜΗΝ κάνεις «generic mesh» περιστροφή** που σπάει την BIM φύση (BOQ, τομές, κάτοψη) — εκτός αν ο Giorgio το ζητήσει ρητά. Προτίμησε BIM-native slope (feedback `bim_native_type_driven`).
- **ADR-040 / CHECK 6B/6D:** αν αγγίξεις gizmo/scene/converter files → stage ADR-402 (+ νέο ADR αν χρειαστεί). manager ≤500 γρ.
- **ΠΟΤΕ** `git add -A` · **ΠΟΤΕ** commit/push (ο Giorgio τα κάνει) · **ΠΟΤΕ** `--no-verify`.

## 6. ΠΑΓΙΔΕΣ
- **Units (mm↔scene):** σκάλα = drawing units, υπόλοιπα = mm (βλ. `mmToEntityUnitFactor` στο `bim3d-edit-math.ts`). Κάθε νέα γωνιακή μετατροπή πρέπει να σέβεται αυτό.
- **DXF↔world άξονες:** world z = −DXF y (βλ. `worldToDxfPlan`). Μια X-tilt στο world ΔΕΝ είναι προφανώς X στο DXF — χαρτογράφησε προσεκτικά.
- **2Δ↔3Δ parity:** κάθε αλλαγή στο data model πρέπει να αντικατοπτρίζεται στο 2Δ render, στις τομές (sections) και στο BOQ — αλλιώς «το βλέπω στο 3Δ αλλά όχι στην κάτοψη».
- **PowerShell:** `$null` deny σε bash — χρησιμοποίησε Grep/Read/Glob tools ή PowerShell σύνταξη.
- **ΜΗΝ** διαβάσεις full bg-task `.output` (φουσκώνουν — feedback `no_read_bg_output_files`).

## 7. DEFINITION OF DONE
- [ ] Phase 1 Recognition: επιβεβαίωσε τι υποστηρίζει το data model σήμερα + ενημέρωσε ADR-402 αν αποκλίνει από κώδικα
- [ ] Απαντήσεις Giorgio στα §3 design questions (ΕΝΑ-ΕΝΑ)
- [ ] N.8: Plan Mode/Orchestrator έγκριση Giorgio (5+ αρχεία)
- [ ] data model + command + gizmo X/Z rings + converters + 2Δ render + persistence (όσα συμφωνηθούν)
- [ ] `npx jest src/subapps/dxf-viewer/bim-3d` PASS + `npx tsc --noEmit` 0
- [ ] **Νέο ADR** (αν είναι μεγάλο feature) ή επέκταση ADR-402 + trackers N.15 (ΕΚΚΡΕΜΟΤΗΤΕΣ + adr-index + memory)
- [ ] 🔴 browser verify Giorgio
- [ ] **Ο Giorgio κάνει το commit — ΟΧΙ εσύ**
