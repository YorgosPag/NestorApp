# HANDOFF — Column/Beam Finish Skin (σοβάς γύρω από στατικό πυρήνα, χωρίς αλλοίωση στατικής διάστασης)

**Ημερομηνία:** 2026-06-12
**Από:** Opus session (ADR-447) → **Προς:** νέο session
**Working tree:** SHARED με άλλον agent. **Commit:** ΜΟΝΟ ο Giorgio. Ποτέ `git add -A`, ποτέ `--no-verify`. Ελληνικά πάντα.
**Quality bar:** FULL ENTERPRISE + FULL SSOT, όπως Revit. Παίρνεις εσύ τις professional αποφάσεις, ζητάς μόνο έγκριση plan.

---

## ΜΕΡΟΣ Α — ΠΡΟΗΓΟΥΜΕΝΗ ΔΟΥΛΕΙΑ (κατάσταση git)
- **ADR-447** (default concrete textures σε δομικά/θεμελίωση + Revit wall-type catalog 25/25+EPS/20/10 + EPS↔ETICS dedup) **COMMITTED** στο `bbe02bec` (ο Giorgio το committαρε, μπαντλαρισμένο με ξένη ADR-441 slab δουλειά). 275 jest pass, tsc καθαρό στα δικά μου.
- **ADR-446** (3D Visual Styles Manager) — committed νωρίτερα, browser-verified («λειτουργεί σωστά»).
- **UNCOMMITTED δικά μου:** `ADR-412` + `ADR-413` cross-ref changelog edits (ο Giorgio θα τα κάνει commit).
- **⚠️ tsc exit=2** από **ΞΕΝΑ** αρχεία (ADR-441/ADR-040 άλλων agents): `foundation-level`, `slab-grid-commit`, `mesh-to-object3d`, `proposal-ghost-3d-builders`, `ProposalGhost3DMount`, `useDxfSceneConversion`. ΟΧΙ δικά μου — μην τα αγγίξεις.

---

## ΜΕΡΟΣ Β — ΝΕΟ TASK: Finish skin (σοβάς) σε ΚΟΛΟΝΕΣ + ΔΟΚΑΡΙΑ

### Το πρόβλημα (λόγια Giorgio)
Τα στατικά δίνουν κολόνα 50×50cm. Στην πραγματικότητα σοβατίζεται περιμετρικά → αν φτιάξω 50×50 και «σοβατίσω», η κολόνα **αλλάζει διάσταση** = αλλοιώνω τα στατικά. Όμως θέλω (α) **να μην αλλοιώνω τα στατικά**, (β) **πραγματική όψη**, (γ) **ποσότητες σοβά**. Τι κάνει η Revit;

### 🏛️ Τι κάνουν οι μεγάλοι παίκτες / Revit (RESEARCH — η απάντηση)
- **Revit Structural Columns = single-material, ΧΩΡΙΣ compound layers** (σε αντίθεση με walls/floors/roofs που ΕΧΟΥΝ). Η στατική διάσταση **ΕΙΝΑΙ** η κολόνα — αμετάβλητη, αναλυτικό μοντέλο ποτέ δεν αλλάζει.
- Τα finishes **ΔΕΝ ψήνονται** μέσα στη στατική κολόνα. Μοντελοποιούνται ως **πρόσθετα αρχιτεκτονικά** (finish walls γύρω, Parts, ή room-finish surface στα schedules).
- **Αρχή (big-player):** στατικός πυρήνας = **immutable SSoT**· finish = **additive offset skin** (δικό υλικό+πάχος, render γύρω, BOQ-tracked)· η «πραγματική» όψη = πυρήνας + 2×σοβάς είναι **derived** (display/clash), ΟΧΙ αποθηκευμένη στατική.

### Αρχιτεκτονική πρόταση (καλύτερη από native Revit — έχουμε ήδη το DNA pattern)
Εφάρμοσε το ΙΔΙΟ layered-finish SSoT που φτιάξαμε για τοίχους (ADR-363/447), με **ΚΡΙΣΙΜΗ διάκριση**:
- Τοίχος: `thickness === dna.totalThickness` (το DNA ορίζει το σύνολο).
- **Κολόνα/Δοκάρι: `width`/`depth` = στατικός ΠΥΡΗΝΑΣ = SSoT (αμετάβλητο, = 50×50 του μηχανικού).** Ο σοβάς = **additive περιμετρικό skin**, ΟΧΙ μέρος της στατικής διάστασης.

**Μοντέλο (πρόταση v1):**
- NEW optional στο `ColumnParams`/`BeamParams`: `finish?: { materialId: string; thickness: number }` (ομοιόμορφος περιμετρικός σοβάς) — ή πληρέστερο `finishDna` με per-face στρώσεις (Plan Mode decision).
- **Derived (display only):** `finishedWidth = width + 2·finishThickness`, `finishedDepth = depth + 2·finishThickness`. ΠΟΤΕ δεν γράφεται πίσω στο `width/depth`.
- **3D render:** core mesh (structural material) + λεπτό περιμετρικό shell (plaster material) — ΑΚΡΙΒΩΣ όπως τα wall plaster sub-solids (`wallToMesh` per-DNA-layer, ADR-413 v1.0). REUSE `mat-plaster-ext`/`-int` (ADR-447 υλικά).
- **2D render:** finished outline + structural core hatch (διπλή γραμμή: στατικό + σοβατισμένο).
- **Visibility/discipline:** structural view/style → πυρήνας (50×50)· architectural/realistic → finished. REUSE ADR-446 Visual Style ή ADR-405 discipline ή dedicated «Εμφάνιση τελειωμάτων» toggle (Plan Mode).
- **BOQ (ΚΡΙΣΙΜΟ για Giorgio):** ξεχωριστή ΑΤΟΕ γραμμή σοβά = `perimeter(core) × height × finishThickness` (m³) + area (m²). Το structural schedule κρατά 50×50 + σκυρόδεμα = ΜΟΝΟ ο πυρήνας. REUSE `bimToBoqBridge`/multi-layer BOQ.

**SSoT αρχές (μη παραβιάσιμες):**
1. `width/depth` (στατικό) ΠΟΤΕ δεν αλλάζει από finish. Ο σοβάς = additive metadata.
2. ΕΝΑ shared «perimeter finish» SSoT για κολόνες + δοκάρια (consistency).
3. Finish materials = τα ΥΠΑΡΧΟΝΤΑ (`mat-plaster-ext/-int`, `wall-material-catalog` με λ/cp/ρ).
4. BOQ σοβά = ξεχωριστή γραμμή (όχι merge στο structural concrete).

### Phase 1 RECOGNITION (κάνε ΠΡΩΤΑ — N.0.1)
1. ADRs: **ADR-363** (column/beam §5.6 + wall DNA §5.3), **ADR-447** (wall types/materials), **ADR-396** (column ήδη παίρνει `EnvelopeLayer` additive skin — precedent!), **ADR-412** (family types — μήπως column/beam types παίρνουν finish param), **ADR-175/ΑΤΟΕ** (BOQ). Next-free ADR από adr-index = **448** (highest 447· ΜΗΝ μαντέψεις — διάβασε index).
2. Grep/Read: `bim/types/column-types.ts` + `beam-types.ts` (ColumnParams/BeamParams: `width`/`depth`/`kind`/`anchor`· ΗΔΗ import `EnvelopeLayer`), `bim/geometry/column-geometry.ts`/`beam-geometry.ts`, `bim-3d/converters/*column*`/`*beam*` (3D mesh), 2D renderers κολόνας/δοκαριού, `bimToBoqBridge`/multi-layer BOQ, `wall-material-catalog.ts` (plaster materials), `wallToMesh` per-layer (πρότυπο για το perimeter shell).
3. Εντόπισε ΠΩΣ ο σοβάς θα γίνει additive skin χωρίς να αγγίξει `width/depth`· πώς το BOQ θα πάρει ξεχωριστή γραμμή.

### Plan Mode — ανοιχτές αποφάσεις για Giorgio (όπως EPS marriage)
- **Finish model:** ομοιόμορφος `finish:{materialId,thickness}` (1 σοβάς γύρω) vs `finishDna` per-face στρώσεις. (Πρόταση: v1 ομοιόμορφος· per-face later.)
- **Default πάχος σοβά κολόνας/δοκαριού** (π.χ. 25mm; ή 15 εσωτ./25 εξωτ. ανάλογα θέση). Research/Giorgio.
- **Toggle structural↔finished:** Visual Style / discipline / dedicated toggle;
- **BOQ:** ξεχωριστή γραμμή σοβά (confirm).
- **Δοκάρια:** σοβάς σε ποιες παρειές (κάτω+πλαϊνά· η πάνω συνήθως μέσα σε πλάκα);

### Μοντέλο
Cross-cutting (column+beam types/geometry/3D/2D/BOQ + finish SSoT, 5+ αρχεία) → **Opus**, Plan Mode.

---

## ΥΠΑΡΧΟΥΣΑ ΥΠΟΔΟΜΗ (FULL SSOT = ΕΠΕΚΤΕΙΝΕ, ΜΗ διπλασιάσεις)
- **Wall DNA pattern (πρότυπο):** `bim/types/wall-dna-types.ts` (layers + totalThickness), `wallToMesh` per-layer sub-solids (ADR-413).
- **Plaster materials:** `bim/walls/wall-material-catalog.ts` (`mat-plaster-ext/-int` + λ/cp/ρ), `bim/materials/material-catalog-defs.ts` + `bim-texture-registry.ts` (concrete/plaster textures — ADR-447).
- **Column/Beam:** `bim/types/column-types.ts`/`beam-types.ts`, geometry + converters, `EnvelopeLayer` additive precedent (ADR-396).
- **BOQ/ΑΤΟΕ:** `bimToBoqBridge`, multi-layer BOQ builder, `material-to-atoe-mapping.ts`.
- **Visual Style (ADR-446):** structural↔finished toggle candidate.

## ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
Ελληνικά. ΟΧΙ commit/push (Giorgio). ΟΧΙ `git add -A` (shared tree, ονομαστικά). ΟΧΙ `--no-verify`. ΕΝΑ tsc τη φορά (N.17). N.7.1 (40/500) + N.7.2 checklist. ADR-driven (code=SoT· ADR+ΕΚΚΡΕΜΟΤΗΤΕΣ ίδιο commit). ADR-446/447 committed — μην τα αγγίξεις· τα tsc errors ξένων αρχείων ΟΧΙ δικά σου.
