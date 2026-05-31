# HANDOFF — ADR-402 «Επόμενη Φάση»: Πλήρη Revit-style 3Δ grips για σκάλα

**Ημερομηνία σύνταξης:** 2026-06-01
**Συντάκτης:** Developer A (Opus 4.8, SOLO) — μετά την ολοκλήρωση **Sub-Phase 1 (stair gizmo resize)**
**Θέμα:** ADR-402 — 3D Viewport BIM Element Editing
**Φάση:** Πλήρη **3Δ grips πάνω στη σκάλα** (Revit/ArchiCAD-style) — η «deferred» φάση που συμφώνησε ο Giorgio.
**Κατάσταση εκκίνησης:** Phase A + B + C + **Sub-Phase 1 stair gizmo resize** ✅ DONE — **pending commit + 🔴 browser verify (ΟΛΩΝ)**.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ ΟΤΑΝ ΞΕΚΙΝΗΣΕΙΣ
1. **`git log` / `git status`** — έλεγξε αν ο Giorgio έκανε commit (Phase A/B/C + Sub-Phase 1) ή αν είναι ακόμα uncommitted. **ΜΗΝ υποθέσεις.** Το working tree έχει ΚΑΙ δουλειά άλλων ADR (401 wall-base, 396 envelope, beam-slope) — **ΜΗΝ τα αγγίξεις, ΠΟΤΕ `git add -A`.**
2. **🚨 ΕΠΑΛΗΘΕΥΣΕ ΣΤΟΝ BROWSER ΠΡΩΤΑ (Sub-Phase 1):** επίλεξε σκάλα στο 3Δ → εμφανίζονται **2 resize τετραγωνάκια (X/Z)**; (α) σύρε κατά πλάτος → φαρδαίνει/στενεύει συμμετρικά· (β) σύρε κατά μήκος (φορά ανόδου) → προστίθενται/αφαιρούνται βαθμίδες (snap σε ακέραιες, σταθερό πάτημα)· (γ) undo = ένα βήμα. Αν κάτι σπάει → fix ΠΡΙΝ τη νέα φάση.
3. **Διάβασε memory:** `project_adr402_genarc_gizmo_port.md` (πλήρες state A/B/C + Sub-Phase 1) + `project_adr402_3d_bim_editing.md` (Sub-Phase 4 = parametric 3Δ grips, deferred) + `project_adr393_stair_extended_grips.md` (το 2Δ stair grip system 5→13 grips — η ΠΗΓΗ που θα φέρουμε στο 3Δ).
4. **Διάβασε** ADR-402 doc (status + «Τίμια όρια» + Changelog Sub-Phase 1).

---

## 1. ΤΙ ΕΙΝΑΙ ΑΥΤΗ Η ΦΑΣΗ (& γιατί ξεχωριστή)
Στο **Sub-Phase 1** δώσαμε στη σκάλα **gizmo resize handles** (τα ίδια τετραγωνάκια με wall/column/beam/slab) — γρήγορο & συνεπές, αλλά **όχι** πλήρως Revit. Οι **μεγάλοι (Revit/ArchiCAD)** χρησιμοποιούν **grips/hotspots πάνω στο ίδιο το στοιχείο** (βελάκι πλάτους στην παρειά, run-handle που προσθέτει/αφαιρεί βαθμίδες, γωνιακά grips για L/U/Γ).

**Στόχος αυτής της φάσης:** Φέρε το ΥΠΑΡΧΟΝ 2Δ stair grip σύστημα (ADR-393, **5-13 grips**, `getStairGrips`) στο **3Δ** — draggable 3Δ handles πάνω στη σκάλα, που καλούν το **ΙΔΙΟ** `applyStairGripDrag` / `commitStairGripDrag` SSoT. Είναι ουσιαστικά το **Sub-Phase 4 «parametric 3Δ grips»** του αρχικού πλάνου, εστιασμένο στη σκάλα.

⚠️ **Μέγεθος:** Νέο 3Δ grip render + pick + drag σύστημα → **σχεδόν σίγουρα >3 αρχεία → N.8 Plan Mode. ΡΩΤΑ τον Giorgio πρώτα** (Plan Mode ή orchestrator;).

---

## 2. DESIGN QUESTIONS — ρώτησε τον Giorgio (ΑΠΛΑ ελληνικά + παραδείγματα, ΕΝΑ-ΕΝΑ)
1. **Τα 3Δ grips ΑΝΤΙΚΑΘΙΣΤΟΥΝ ή ΣΥΜΠΛΗΡΩΝΟΥΝ το gizmo;** Δηλ. όταν επιλέγεις σκάλα: (α) φεύγουν τα resize τετραγωνάκια του gizmo και μένουν μόνο τα grips πάνω στη σκάλα (καθαρό Revit)· ή (β) μένουν ΚΑΙ τα δύο (gizmo move/rotate + grips για διαστάσεις); _(Πρόταση: για τη σκάλα, grips αντικαθιστούν τα resize τετραγωνάκια· move/rotate gizmo μένει.)_
2. **Ποια grips στο 3Δ;** Όλα τα 2Δ (move arc-midpoint, rotation, 4 γωνίες σε ίσια/L/U/Γ, landing edges, landing-depth), ή ένα υποσύνολο για αρχή (π.χ. μόνο γωνίες + width); _(ADR-393: ίσια κρύβει width/length, οι 4 γωνίες αναλαμβάνουν· L/U/Γ = 4 flight-based γωνίες + landing.)_
3. **Σχήμα/glyph 3Δ;** Billboard sprite τετράγωνα (όπως `Dim3DGripsRenderer`/grips 2Δ) με glyphs (move=4-βέλη, rotation=καμπύλο βέλος) ή απλά χρωματιστά κουτάκια;
4. **Γενίκευση;** Μόνο σκάλα τώρα, ή να χτιστεί **γενικό `Bim3DGripRenderer`** που μετά εξυπηρετεί ΟΛΟΥΣ τους τύπους (wall/column/beam corner grips στο 3Δ); _(Completeness rule λέει γενικό — αλλά πιο μεγάλο build· ρώτα.)_

---

## 3. REFERENCE (θέσεις-κλειδιά — μίμηση, μηδέν re-invent)
**3Δ grip render + pick + drag (το πρότυπο):**
- `bim-3d/dimensions/Dim3DGripsRenderer.ts` — **billboard Sprite grips + raycaster pick via `userData`** (cold/warm/hot states, `CAD_UI_COLORS.grips`). Το ακριβές pattern για render + hit-test.
- `bim-3d/animation/WaypointDragHandle.ts` + `use-waypoint-drag-interaction.ts` + `waypoint-drag-controller.ts` — **AbortController-gated 3Δ drag** lifecycle (pointer listeners, OrbitControls off κατά drag).
- `bim-3d/gizmo/use-bim3d-edit-interaction.ts` + `bim3d-edit-interaction-handlers.ts` — πώς συνδέεται το gizmo με commands (auto-on-selection μέσω `Selection3DStore`, single-commit-on-release). Το νέο grip σύστημα μπαίνει δίπλα/μέσα εδώ.
- `bim-3d/viewport/coordinate-transforms.ts` — `dxfPlanToWorld` / `worldToDxfPlan` (plan 2Δ ↔ world 3Δ). Τα grips ζουν σε plan (2Δ), τα ζωγραφίζεις σε world (3Δ) μέσω αυτών.

**Stair SSoT (ΜΟΝΟ κλήση — ΜΗΝ αλλάξεις λογική):**
- `bim/stairs/stair-grips.ts` → `getStairGrips(entity): GripInfo[]` (position 2Δ plan, `stairGripKind`, glyph shape). **Η πηγή των grip θέσεων** (read-from-geometry SSoT).
- `bim/stairs/stair-grip-transforms.ts` → `applyStairGripDrag(kind, input)` (pure transform).
- `hooks/grips/grip-parametric-commits.ts` → `commitStairGripDrag(grip, delta, deps)` (το command path· `currentPos = grip.position + delta` → `UpdateStairParamsCommand`). **Μπορείς να το reuse αυτούσιο** για το commit-on-release.
- `core/commands/entity-commands/UpdateStairParamsCommand.ts`.

**Sub-Phase 1 (μόλις έγινε — δες πώς λύθηκαν τα units):**
- `bim-3d/gizmo/bim3d-resize-bridge.ts` → `computeStairResizeParams` (units: `mmToSceneUnits(inferSceneUnitsFromWidth)`, anchor από params, RELATIVE drag).

---

## 4. ΟΡΙΑ (ΑΥΣΤΗΡΑ)
- **ΜΗΝ σπάσεις:** Phase A/B/C (gizmo move/rotate/resize/snap/multi-select) + **Sub-Phase 1 stair gizmo resize**. Αν τα grips αντικαθιστούν τα resize τετραγωνάκια της σκάλας (Q1), κάν' το με **gate** (π.χ. `RESIZE_HANDLES_BY_TYPE.stair` → κενό όταν grips ενεργά), ΟΧΙ διαγραφή.
- **ΜΗΝ αγγίξεις:** `bim/stairs/*` λογική (μόνο κλήση `getStairGrips`/`applyStairGripDrag`/`commitStairGripDrag`/`computeStairGeometry`), `core/commands` λογική, `snapping/*`. **ΜΗΝ** αγγίξεις δουλειά άλλων ADR στο working tree (401/396/beam-slope).
- **ADR-040:** αν αγγίξεις canvas-drawing/scene files → stage ADR/doc (CHECK 6B/6D). Το 3Δ grip render μπαίνει στο `bim-3d/`, μέσω `manager.scene` (όπως gizmo/waypoint) — **manager ≤500 γρ.**, render στο hook.
- **ΠΟΤΕ** `git add -A`· **ΠΟΤΕ** commit/push χωρίς εντολή Giorgio (N.(-1)).

## 5. ΠΑΓΙΔΕΣ
- **Units (mm↔scene):** τα grip positions (`getStairGrips`) είναι σε **drawing/scene units** (geometry-derived). Ο 3Δ drag δίνει world delta → `worldToDxfPlan` → plan delta σε **ΙΔΙΑ units με τα grips**. Reuse `commitStairGripDrag` (κάνει ήδη `currentPos = grip.position + delta`). Δες πώς το Sub-Phase 1 χειρίστηκε mm→units (`mmToSceneUnits(inferSceneUnitsFromWidth)`).
- **Grip positions = read-from-geometry** (feedback `grip_positions_read_geometry`), ΠΟΤΕ re-derive από raw mm (off-screen-σε-metre-scenes class of bug).
- **ADR-393 v2:** ίσια σκάλα **κρύβει** width/length grips (οι 4 γωνίες resize-άρουν)· L/U/Γ = 4 flight-based γωνίες + landing. Το `getStairGrips` ήδη τα δίνει σωστά — απλά ζωγράφισέ τα στο 3Δ.
- **PowerShell deny** → χρησιμοποίησε bash `grep`/`wc`, Grep/Read/Glob tools.
- **ΜΗΝ** διαβάσεις full bg-task `.output` (φουσκώνουν) — Grep/tail.

## 6. DEFINITION OF DONE
- [ ] Browser verify Sub-Phase 1 (gizmo resize) ΠΡΩΤΑ
- [ ] Plan Mode + έγκριση Giorgio (>3 αρχεία)
- [ ] 3Δ stair grips render + pick + drag → `commitStairGripDrag`/`UpdateStairParamsCommand` (reuse SSoT)
- [ ] Q1 (grips vs gizmo coexistence) υλοποιημένο με gate, χωρίς να σπάσει Sub-Phase 1
- [ ] `npx jest src/subapps/dxf-viewer/bim-3d` PASS + `npx tsc --noEmit` 0
- [ ] ADR-402 + trackers N.15 (ΕΚΚΡΕΜΟΤΗΤΕΣ + adr-index status + memory)
- [ ] 🔴 browser verify Giorgio
