# HANDOFF — Auto-Dimension Φ4+ (big-player gaps Δ → Γ → Β → Α)

**Ημ/νία:** 2026-07-02
**Feature:** Αυτόματη διαστασιολόγηση κάτοψης (DXF Viewer) — **ADR-563**
**Κατάσταση:** Φ1 (περιμετρικό) + Φ2 (BIM associativity) + Φ3 (interior grid) **ΥΛΟΠΟΙΗΘΗΚΑΝ, UNCOMMITTED**.
**Επόμενο:** 4 «big-player» κενά, **ΕΝΑ feature ανά συνεδρία**, με σειρά **Δ → Γ → Β → Α**.

> ⚠️ **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Άγγιξε **ΜΟΝΟ** αρχεία του Auto-Dimension·
> μην πειράξεις άσχετα uncommitted αρχεία. **Ο Giorgio κάνει commit/push — ΟΧΙ ο agent.**

---

## 0. Κανόνες συνεδρίας (ΑΠΑΡΑΒΑΤΟΙ)
- 🌐 **Απάντα ΠΑΝΤΑ στα Ελληνικά** (native γλώσσα Giorgio· CLAUDE.md LANGUAGE RULE).
- 🏢 **Enterprise + FULL SSoT.** «Όπως οι μεγάλοι» (**Revit / Maxon Cinema 4D / Figma-level**).
  Θέλουμε σύστημα full-enterprise + full-SSoT· **ΑΛΛΑ** αν οι μεγάλοι δεν προτείνουν κάτι,
  ακολουθούμε **την πρακτική των μεγάλων**, δεν εφευρίσκουμε δική μας.
- 🔎 **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα** — ψάξε αν υπάρχει
  ήδη helper/store/util και κάν' τον **reuse**· **ΜΗΔΕΝ διπλότυπα** (N.0.2 / N.12).
- 🔬 **Ερεύνησε ξανά (WebSearch/deep-research) τι κάνουν οι μεγάλοι** για το εκάστοτε feature
  πριν σχεδιάσεις.
- 📐 **Plan Mode πρώτα** (ADR-driven, N.0.1). Στο clarify: **ξεκίνα με συγκεκριμένο οπτικό/
  αριθμητικό ASCII παράδειγμα**, όχι αφηρημένη ερώτηση (feedback Giorgio).
- ❌ **ΜΗΝ τρέξεις `tsc`/typecheck** (N.17). ✅ **jest επιτρέπεται** (στοχευμένα).
- ❌ **ΜΗΝ commit / push** — τα κάνει ο Giorgio (N.(-1)).
- ➡️ **ΕΝΑ feature ανά συνεδρία.** Στο τέλος: update ADR-563 + jest + πρότεινε browser-verify+commit,
  ΜΕΤΑ `/clear` για το επόμενο.

---

## 1. Τι υπάρχει ήδη (Φ1+Φ2+Φ3) — ΚΑΝ' ΤΟ REUSE, ΜΗΝ ΤΟ ΞΑΝΑΓΡΑΨΕΙΣ

**Pure engine** — `src/subapps/dxf-viewer/systems/dimensions/auto/`:
- `auto-dimension-types.ts` — `AutoDimensionOptions` (tiers/sides/referenceBasis/includeOpenings/
  **interior**/distanceBetweenLines/offsetFromModel), `AUTO_DIMENSION_DEFAULTS`, `ReferencePoint`,
  **`PlannedSegment { axis:'x'|'y'; side?; tier?; defPoints; rotation; source1?; source2? }`**
  (το `axis` = SSoT μετρούμενου άξονα για associativity· `side/tier` = optional perimeter metadata).
- `auto-dimension-reference-extraction.ts` — `extractReferencePoints`. **Exported reuse:**
  `classifyElement`, `detailCoordsFor`, `projectBoundsOntoAxis(bounds, measuresX)`, `AxisProjection`,
  `ElementClass`. Reuse `calculateBimEntity2DBounds` (`bim/utils/bim-bounds.ts`).
- `auto-dimension-chain-planner.ts` — `planChains` (περιμετρικό, 3 tiers offset outward).
  **Exported reuse:** `dedupSorted(points)` (χρησιμοποιεί **`snapToGrid`** ADR-049), `CoordSource`.
- `auto-dimension-interior-planner.ts` — **(Φ3, ΝΕΟ)** `planInteriorChains(elements, options, overall)`
  → 2 ορθογώνιες αλυσίδες μέσα από **centroid** (οριζόντια X + κατακόρυφη Y). Ανοίγματα εκτός.
  Βάση: smart/axes→κέντρα, faces→παρειές. **Witness lines μηδενικές** (defPoints[2]==defPoints[0],
  dim line πάνω στο centroid). ← **ΕΔΩ αγγίζει το Δ + το Γ.**
- `auto-dimension-entity-factory.ts` — `buildAutoDimensionEntities(segments, ctx)`. `associationsFor`
  διαβάζει **`seg.axis`**. associations = **`bimExtent`** (+`bimAnchor:{axis,edge}`), id via
  `generateDimensionId()` (N.6), sanity via `buildDimensionGeometry`.
- `auto-dimension-engine.ts` — `runAutoDimension` = extract→planChains(perimeter)+
  planInteriorChains(interior αν `options.interior`)→factory. `computeOverallBounds` reuse `unionBounds`.
- `auto-dimension-dialog-store.ts` + `run-auto-dimension-flow.ts` — dialog→engine→commit.

**Commit:** `bim/scene/add-dimensions-to-scene.ts` → `appendEntitiesToScene(...'dim-auto',...)`
(batch = 1 undo, persistence, associativity observer αυτόματα).

**UI/wiring:** `ui/dialogs/AutoDimensionOptionsDialog.tsx` (self-subscribing· checkbox
«Εσωτερικές διαστάσεις»)· ribbon `action:'auto-dimension'` σε `ui/ribbon/data/home-tab-dimensions.ts`
(Home → Διαστάσεις)· routing σε `app/dxf-special-actions.ts`· i18n `autoDimension.dialog.*`
σε `src/i18n/locales/{el,en}/dxf-viewer-shell.json`.

**Associativity engine:** `systems/dimensions/dim-association-service.ts` — branch `bimExtent`
(γρ. ~179): ενημερώνει μόνο τον μετρούμενο άξονα, κρατά την κάθετη baseline. Δουλεύει για
περιμετρικά **και** εσωτερικά.

**Geometry builder:** `systems/dimensions/builders/linear-aligned-builder.ts` — `buildLinearGeometry`
(linear, στραμμένο κατά `rotation`) + `buildAlignedGeometry` (**aligned = παράλληλο στο
extOrigin1→extOrigin2** — ΣΗΜΑΝΤΙΚΟ για το Β). Δέχεται μηδενική προεξοχή (witness=null).

**Tests (πράσινα, 87):** `npx jest "src/subapps/dxf-viewer/systems/dimensions/auto" "dim-association"`.

**Docs:** `ADR-563-auto-dimension-engine.md` (Status: Φ1+Φ2+Φ3), `adr-index.md`.

**🔴 ΠΡΙΝ ΤΟ ΠΡΩΤΟ FEATURE:** ιδανικά ο Giorgio κάνει **browser-verify Φ3 + commit** ώστε τα
νέα features να χτιστούν σε καθαρή, δοκιμασμένη βάση. (Αν όχι, προχώρα — απλά σημείωσέ το.)

---

## 2. Τα 4 features — σειρά Δ → Γ → Β → Α (μικρό → μεγάλο)

### Δ — Witness lines στα εσωτερικά (Scope: Μικρό) ← ΞΕΚΙΝΑ ΑΠΟ ΕΔΩ
**Πρόβλημα:** Οι εσωτερικές αλυσίδες (Φ3) έχουν **μηδενικές** προεκτάσεις (dim line πάνω στο
centroid, `defPoints[2]==defPoints[0]`). Καθαρό αλλά «γυμνό».
**Μεγάλοι:** ArchiCAD Interior Dimensioning τραβά **witness lines** από τη γραμμή διάστασης **ως
το κάθε στοιχείο** (κολόνα/τοίχο) που μετρά. Ερεύνησε το exact behavior (μήκος/gap witness).
**Ιδέα υλοποίησης (grep-audit πρώτα):** Στον `interior-planner`, αντί `defPoints[2]` πάνω στο
centroid, κράτα ανά coord το **πραγματικό y (ή x) του κέντρου του host** ώστε το witness να
φτάνει στο στοιχείο· ή δώσε προεξοχή προς την πλησιέστερη σειρά στοιχείων. **Reuse** τα DIMEXO/
DIMEXE του style (τα χειρίζεται ήδη το `buildExtLine` στο linear-aligned-builder — μην ξαναγράψεις
witness geometry). Πιθανώς αρκεί σωστό `dimLineRef` + per-source baseline.
**Αρχεία:** `auto-dimension-interior-planner.ts` (+ ίσως `-types.ts` αν χρειαστεί per-source y).
**Verify:** εσωτερική αλυσίδα δείχνει witness lines ως τις κολόνες· jest για defPoints· browser.

### Γ — Collision avoidance (Scope: Μεσαίο)
**Πρόβλημα:** Η εσωτερική αλυσίδα στο **centroid** μπορεί να πέσει πάνω σε σειρά κολόνων/κείμενο.
**Μεγάλοι:** Revit/ArchiCAD **μετατοπίζουν** αυτόματα τη γραμμή διάστασης σε καθαρή ζώνη
(offset/nudge) ώστε να μην επικαλύπτει elements ή άλλες αλυσίδες. Ερεύνησε (dimension line
spacing / auto-offset / DIMDLI stacking).
**Ιδέα (grep-audit):** πριν οριστικοποιήσεις το baseline (cy/cx) στον interior-planner, ψάξε
για ελεύθερη λωρίδα (καμία footprint bbox να μην τέμνει τη γραμμή). **Reuse** bounds/intersection
utils (grep: `bim-bounds`, `GeometryUtils`, segment-polygon coverage) — **ΜΗΝ** γράψεις νέο
intersection. Πιθανώς και στο περιμετρικό (stacking) — αλλά κράτα το scope στο interior πρώτα.
**Αρχεία:** `auto-dimension-interior-planner.ts` (+ ίσως νέο μικρό pure `*-placement.ts`).
**Verify:** αλυσίδα δεν πέφτει πάνω σε κολόνα· browser σε πυκνή κάτοψη.

### Β — Λοξές / στραμμένες κατόψεις (Scope: Μεσαίο)
**Πρόβλημα:** Όλο το engine είναι **axis-aligned (X/Y)**· διαγώνιοι τοίχοι πέφτουν σε
bbox-projection. **Aligned** dims σε στραμμένο άξονα δεν υποστηρίζονται.
**Μεγάλοι:** Revit/ArchiCAD διαστασιολογούν **παράλληλα στον άξονα του στοιχείου** (aligned).
Ερεύνησε (aligned dimensions on rotated grids / skewed walls).
**Ιδέα (grep-audit):** **Reuse `buildAlignedGeometry`** (linear-aligned-builder — υπάρχει ήδη!)
+ `dimensionType:'aligned'`. Χρειάζεται: εξαγωγή του **κύριου άξονα** ανά wall/element (grep:
`beam-axis-scene-frame`, `buildMemberAxisFrame`, `member-snap-targets`, wall centerline) αντί
bbox· projection πάνω σε στραμμένο άξονα. **ΜΗΝ** ξαναγράψεις aligned geometry.
**Αρχεία:** πιθανώς νέο `auto-dimension-aligned-*.ts` + engine option + type `axis` → γενίκευση
σε διάνυσμα. Προσοχή: μεγαλύτερη αλλαγή — Plan Mode προσεκτικό.
**Verify:** στραμμένος τοίχος → aligned dim παράλληλο· jest· browser.

### Α — Διαδραστική γραμμή τομής (Scope: Μεγάλο) ← ΤΕΛΕΥΤΑΙΟ
**Πρόβλημα/Μεγάλοι:** «καθαρή ArchiCAD» — ο χρήστης **τραβά γραμμή** (cut line), ό,τι τη
διασχίζει διαστασιολογείται σε μία αλυσίδα κατά μήκος της. (Η Φ3 το κάνει auto στο centroid·
το Α το κάνει interactive.)
**Ιδέα (grep-audit ΥΠΟΧΡΕΩΤΙΚΟ — υπάρχει πολλή υποδομή):** νέο **tool** (ToolStateStore /
activeTool pattern — grep: `useColumnTool`, `wall` tool, `mouse-handler-up`, drawing preview
generators, `ToolStateStore`, `RadialCommandRing`). **Reuse** το preview/ghost pipeline + snap
(`findSnapPoint` κεντρικά στο mouse-up) + line-cross intersection (grep intersection utils).
Το «ό,τι διασχίζει» = reuse `classifyElement`/`projectBoundsOntoAxis` + segment∩bbox· μετά
**reuse `dedupSorted` + factory + bimExtent** (ίδιο pipeline με Φ3). ΜΗΝ ξαναγράψεις tool/preview
υποδομή — υπάρχει.
**Αρχεία:** νέο tool hook + wiring (ribbon/keyboard) + reuse engine. Δική του καθαρή συνεδρία.
**Verify:** τραβάς γραμμή σε κάτοψη → live preview → commit αλυσίδας· follow-on-move· Ctrl+Z.

---

## 3. Τι ΝΑ ΜΗΝ κάνεις
- ❌ Μην ξαναγράψεις engine/factory/dialog/associativity/geometry-builder — **reuse/extend**.
- ❌ Μην γράψεις νέο intersection/bounds/snap/witness/aligned geometry — **υπάρχουν, grep πρώτα**.
- ❌ Μην commit/push (Giorgio). ❌ Μην τρέξεις tsc. ❌ Μην αγγίξεις άσχετα uncommitted αρχεία.
- ❌ Μην κάνεις 2 features μαζί — ένα ανά συνεδρία.

## 4. Verification (γενικό, ανά feature)
- jest στοχευμένα (`npx jest "src/subapps/dxf-viewer/systems/dimensions/auto" "dim-association"`).
- Browser: κουμπί Home→Διαστάσεις→«Αυτόματη Διαστασιολόγηση» (ή το νέο tool για το Α).
- Update `ADR-563` (section + changelog) στο ίδιο commit-set. Πρότεινε browser-verify+commit στον Giorgio.
