# HANDOFF — 3D canvas: ΟΥΤΕ DXF ΟΥΤΕ BIM οντότητες εμφανίζονται (INVESTIGATE, plan mode)

> **Ημερομηνία:** 2026-07-05
> **Κατάσταση:** ΝΕΑ ΕΡΕΥΝΑ — καμία υλοποίηση ακόμη. **Plan mode ΠΡΩΤΑ.**
> **Subapp:** `src/subapps/dxf-viewer`
> **Τύπος:** deep-dive root-cause investigation (cross-cutting· πιθανώς Opus)

---

## 0. START HERE — τι ζητά ο Giorgio

Όταν πηγαίνω στον **τρισδιάστατο καμβά (3D canvas)**, **ΔΕΝ εμφανίζονται**:
- ❌ οι οντότητες **DXF** (γραμμές/κείμενα/κύκλοι κ.λπ.)
- ❌ οι οντότητες **BIM** (κολόνες/δοκοί/πλάκες/τοίχοι κ.λπ.)

Ο 3D καμβάς φαίνεται **άδειος** (ή/και δείχνει μόνο grid/axes/ViewCube).

**ΖΗΤΟΥΜΕΝΟ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ:** βαθιά βουτιά → **plan mode** → πες στον Giorgio **ΓΙΑΤΙ** συμβαίνει
(root cause), με συγκεκριμένα αρχεία/γραμμές. **ΜΗΝ** γράψεις κώδικα πριν εγκρίνει το plan.

---

## 1. 🔑 ΤΟ ΚΡΙΣΙΜΟ ΣΤΟΙΧΕΙΟ (ξεκίνα από εδώ)

**Λείπουν ΚΑΙ τα δύο (DXF + BIM) ταυτόχρονα.** DXF και BIM περνούν από **ΔΙΑΦΟΡΕΤΙΚΟΥΣ converters**
(`DxfToThreeConverter` vs `BimToThreeConverter`). Αν λείπουν **και τα δύο**, η πιθανότερη αιτία είναι
**ΚΟΙΝΗ, ανάντη (upstream)** — ΟΧΙ per-domain bug. Ιεράρχησε υποθέσεις που εξηγούν **και τα δύο μαζί**:

1. **Camera / framing** — οι οντότητες υπάρχουν αλλά η κάμερα δεν τις πλαισιώνει (off-screen / bad fit).
   ⚠️ Υπάρχει γνωστό regression: camera-fit hotfix έσπασε ViewCube → reverted (mem: `camera_fit_3d_regression`).
2. **Scale bug** — τα meshes χτίζονται σε λάθος κλίμακα → αόρατα/μικροσκοπικά/τεράστια.
   ⚠️ Γνωστό incident (mem `3d_bim_mesh_scale_mm_scenes`, ADR-568/421 §A6): διαστάσεις `×MM_TO_M`,
   θέση `×sceneToM`· λάθος `mmToSceneUnits` σε mm/γεωαναφερμένες σκηνές → mesh αόρατο.
3. **Scene mount / canvas size 0** — ο `managerRef`/renderer δεν έχει mount, ή το canvas έχει 0×0
   (WebGL renderer χωρίς μέγεθος → μαύρο/κενό).
4. **Visibility gate** — `effectiveVisible` / `is3D` / isolate-scopes / view-range / cut-plane slider
   κρύβουν τα πάντα (mem: `isolate_scopes_ssot`, cut-plane gotcha στο `3d_bim_mesh_scale_mm_scenes`).
5. **Store/sync δεν τροφοδοτεί** — `resyncBimScene` / `useBim3DStoreSync` δεν τρέχει ή παίρνει άδειο
   input (π.χ. `externalEntitiesMode` vs store-driven mismatch → κανένα entity φτάνει στον converter).

**Non-εξήγηση:** «ο ένας converter είναι buggy» — δεν εξηγεί γιατί λείπουν ΚΑΙ οι δύο. Κράτα το στοίχημα
σε κοινή αιτία εκτός αν το grep αποδείξει δύο ανεξάρτητα προβλήματα.

---

## 2. Concrete anchors (πραγματικά αρχεία — από scan 2026-07-05)

| Ρόλος | Αρχείο |
|---|---|
| **3D viewport (mount + sync orchestration)** | `bim-3d/viewport/BimViewport3D.tsx` — δες `resyncBimScene(managerRef.current, {externalEntitiesMode, bimEntities})`, `effectiveVisible` (γρ. ~110), `externalEntitiesMode` (γρ. ~93), `managerRef` |
| **DXF → Three** | `bim-3d/converters/DxfToThreeConverter.ts` |
| **BIM → Three** | `bim-3d/converters/BimToThreeConverter.ts` |
| **DXF overlay στη 3D σκηνή** | `bim-3d/scene/scene-sync-dxf-overlay.ts` |
| **BIM envelope scene builder** | `bim-3d/scene/bim-envelope-scene-builder.ts` |
| **Store sync hooks** | `bim-3d/viewport/use-bim3d-store-sync.ts` · `use-bim3d-multifloor-sync.ts` · `use-bim3d-vg-resync.ts` · `use-bim3d-render-controls.ts` |
| **Mount στο layout (3D leaf)** | `components/dxf-layout/canvas-layer-stack-3d-leaf.tsx` |
| **Camera/framing** | `bim-3d/viewport/viewport-camera.ts` · `viewport-framing.ts` · `viewport-poi.ts` |
| **Scale/coords SSoT** | `bim-3d/viewport/coordinate-transforms.ts` + `converters/bim-three-shape-helpers.ts` (mm→scene) |

**Ψάξε `resyncBimScene`**: είναι το σημείο που ΚΑΙ τα δύο (external ή store) μπαίνουν στη σκηνή —
αν αυτό δεν τρέχει/παίρνει άδειο, εξηγεί ΚΑΙ τα δύο.

---

## 3. Μέθοδος (Google/Revit/Maxon-grade)

1. **Ίχνευσε ΟΛΟ το pipeline** (mem `trace_full_pipeline_not_isolated_hooks`): entities store → sync hook →
   converter → `THREE.Object3D` add-to-scene → camera fit → render. Βρες **σε ποιο σκαλί χάνονται**.
2. Ρώτα/επιβεβαίωσε repro (mem `confirm_repro_before_reimplementing`): συμβαίνει σε **κάθε** αρχείο ή
   συγκεκριμένο; Σε 2D φαίνονται κανονικά; Το grid/axes/ViewCube φαίνονται (→ renderer ζει, άρα camera/scale/feed);
   Δείχνει κάτι στιγμιαία και μετά εξαφανίζεται (→ resync/clear); Console errors (WebGL/NaN bbox);
3. **SSoT AUDIT (grep) ΠΡΙΝ οποιαδήποτε πρόταση κώδικα** — δες αν η διόρθωση ανήκει σε υπάρχον SSoT
   (camera-fit, coordinate-transforms, scene-sync) ώστε **να μη δημιουργήσεις διπλότυπο**.
4. Στο plan: root cause + το ΕΝΑ σημείο διόρθωσης (single source), με εναλλακτικές αν αβέβαιο.

---

## 4. ΚΑΝΟΝΕΣ (απαράβατοι)

- 🏢 **Big-player-grade** (Revit / Maxon Cinema 4D / Figma-level) + **full enterprise + full SSoT**.
  Αν οι μεγάλοι δεν προτείνουν κάτι → ακολούθησε την πρακτική τους.
- 🔎 **ΠΡΙΝ κώδικα → πραγματικό SSoT audit (grep)**: βρες υπάρχον αντίστοιχο κώδικα → **χρησιμοποίησέ τον**,
  **ΜΗΝ φτιάξεις διπλότυπα**. Αν βρεις προϋπάρχον διπλότυπο (που δεν το έφτιαξες) → **κεντρικοποίησέ το** (εντολή).
- 🧭 **Plan mode ΠΡΩΤΑ.** Καμία αλλαγή πριν έγκριση plan.
- 💾 **COMMIT ΤΟ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ Ο AGENT.** Ποτέ commit/push από agent.
- 🌿 **SHARED WORKING TREE** (δουλεύει κι άλλος agent): `git add <specific files>` μόνο· verify `git diff --cached`·
  **ΠΟΤΕ** `git add -A` / `git restore .` / `git reset --hard` / checkout αρχείων άλλου agent.
- 🚫 **Χωρίς tsc** (N.17)· **jest επιτρέπεται** (στοχευμένα).
- 📄 **ADR-040** είναι υποχρεωτικό διάβασμα/ενημέρωση για performance-critical canvas αρχεία.
  Νέο ADR → **ξανα-glob** τον επόμενο ελεύθερο αριθμό (το **ADR-573 πιάστηκε** από color SSoT, uncommitted → **574+**).

---

## 5. Σχετική μνήμη (τεχνικά gotchas — έλεγξέ τα)
- `reference_3d_bim_mesh_scale_mm_scenes` — 3D mesh αόρατο σε mm/γεωαναφερμένες σκηνές = scale bug (ADR-568/421).
- `reference_invisible_hoverable_entity_is_cull_not_reactivity` — αόρατο-αλλά-υπαρκτό = cull/render-gate.
- `reference_bim_3d_vertical_datum_ssot` — vertical datum (foundation=absolute, υπόλοιπα floor-relative).
- `feedback_camera_fit_3d_regression` — camera-fit hotfix έσπασε ViewCube (reverted 2026-05-21).
- `reference_2d_dxf_pipeline_bim_entity` — 6 render + 3 selection σημεία/entity (2D)· χρήσιμο για σύγκριση 2D vs 3D.
- `feedback_3d_mirror_2d_ssot` — 3D ίδια SSoT tokens με 2D.

---

## 6. ΜΗΝ κάνεις
- ΜΗΝ υποθέσεις «ένας converter buggy» χωρίς να εξηγήσεις γιατί λείπουν ΚΑΙ οι δύο.
- ΜΗΝ γράψεις κώδικα/νέο store/helper πριν grep-audit + plan approval.
- ΜΗΝ αγγίξεις αρχεία εκτός task (shared tree).
- ΜΗΝ τρέξεις tsc.

## 7. Εκκρεμότητα από προηγούμενη συνεδρία (άσχετη — μόνο ενημέρωση)
Υπάρχει **uncommitted color-conversion SSoT** εργασία (ADR-573) στο working tree, pending commit από Giorgio.
Μην την πειράξεις· απλώς μην μπερδευτείς αν δεις color αρχεία modified.
