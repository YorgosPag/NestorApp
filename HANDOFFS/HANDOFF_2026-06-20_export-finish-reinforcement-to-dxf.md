# HANDOFF — Εξαγωγή Σοβάδων (finish skin) + Οπλισμού (reinforcement) στο DXF

**Ημερομηνία:** 2026-06-20
**Προηγούμενο:** ADR-505 Unified Export (DXF/IFC/PDF) — **COMMITTED & browser-verified** (Τέκτονας 2Δ + AutoCAD 2Δ/3Δ).
**Στόχος νέας συνεδρίας:** να εξάγονται στο DXF και οι **σοβάδες** + ο **οπλισμός** όταν είναι ενεργά στην εφαρμογή. Revit-grade, **FULL ENTERPRISE + FULL SSOT**.

⚠️ **ΚΑΝΟΝΕΣ:**
- **Το working tree μοιράζεται με άλλον agent** (δουλεύει σε structural: ADR-499/503/504/506). Stage/άγγιξε **ΜΟΝΟ** δικά σου αρχεία. ΜΗΝ `git add -A`.
- **Commit ΜΟΝΟ ο Giorgio** — εσύ ΠΟΤΕ (N.(-1)).
- **ΠΡΙΝ γράψεις κώδικα: πραγματικό SSoT audit (grep)** — βρες & χρησιμοποίησε υπάρχοντα, μηδέν διπλότυπα (ο Giorgio το απαίτησε ρητά).

---

## 1. Γιατί δεν εξάγονται σήμερα (root cause — verified)

Η εξαγωγή (ADR-505) διαβάζει το **`scene.entities[]`**. Σοβάδες & οπλισμός **ΔΕΝ είναι entities** — είναι **derived overlays** που υπολογίζονται/ζωγραφίζονται live (όπως τα διαγράμματα M/V/N). Άρα ο export pipeline δεν τα πιάνει.

## 2. SSoT AUDIT — υπάρχων κώδικας προς REUSE (μη ξαναγράψεις!)

### Σοβάς (finish skin) — ΕΥΚΟΛΟ (καθαρή γεωμετρία υπάρχει)
- **`bim/finishes/structural-finish-resolver.ts`** → `resolveStructuralFinishFaces(input): StructuralFinishFaces` → επιστρέφει **`FinishFaceSegment[]`** (καθαρή 2Δ γεωμετρία παρειών). ✅ ΑΥΤΟ είναι το SSoT γεωμετρίας — κάλεσέ το.
- `bim/finishes/structural-finish-outline-geometry.ts` → `computeMiteredOuter(...)`, `segOffsetVec(...)` (offset/mitre helpers).
- `bim/finishes/structural-finish-horizontal.ts` (πλάκες/οριζόντια finish).

### Οπλισμός (reinforcement) — ΠΙΟ ΔΥΣΚΟΛΟ (imperative draw, ΟΧΙ γεωμετρία)
- **`bim/renderers/{beam,column,footing,linear-member}-rebar-2d.ts`** → `drawXxxRebar2D(ctx, ..., worldToScreen): void` — **ζωγραφίζουν imperative στο canvas**, ΔΕΝ επιστρέφουν segments.
- **ΣΤΡΑΤΗΓΙΚΗ (SSoT-safe):** extract τη **γεωμετρία οπλισμού** (rebar paths/stirrups σε world coords) σε **καθαρές functions** πριν το draw, ΚΑΙ κάνε τους renderers να καταναλώνουν αυτές (renderer = draw της ίδιας γεωμετρίας). Έτσι: μία πηγή γεωμετρίας → canvas draw + DXF export. ΜΗΝ αντιγράψεις τη rebar-layout μαθηματική.
- Κοίτα ΠΡΩΤΑ: **`bim-3d/converters/bim-three-structural-converters.ts`** — **ΗΔΗ** μετατρέπει finish + reinforcement σε 3D geometry (gated στο `showReinforcement`/finish). Πιθανότατα υπάρχει ήδη εκεί geometry-generation που μπορείς να reuse/mirror αντί να αγγίξεις τους 2Δ renderers. **AUDIT το πρώτο.**

### Visibility toggles (SSoT — gate την εξαγωγή σε αυτά)
- **`bim/visibility/structural-component-visibility.ts`** → per-view flags `showStructuralCore` / `showFinishSkin` / `showReinforcement` (+ defaults). ✅ Η εξαγωγή πρέπει να συμπεριλαμβάνει finish/rebar **ΜΟΝΟ όταν το αντίστοιχο flag είναι ON** (Revit «export what's visible»).
- `bim/structural/reinforcement/rebar-visibility.ts` (rebar-specific visibility).

## 3. Export integration points (ADR-505 — εδώ πλugάρεις)
- `src/subapps/dxf-viewer/export/core/bim-to-dxf-primitives.ts` — `flattenSceneEntitiesForDxf(entities)`, `decomposeBimEntityToDxfPrimitives(entity)`. **Οι overlays ΔΕΝ είναι entities** → χρειάζεται **νέος collector** (π.χ. `collectOverlayDxfEntities(scene, visibilityFlags)`) που παράγει extra DXF primitives (LINE/POLYLINE) από finish + rebar γεωμετρία.
- `src/subapps/dxf-viewer/export/formats/dxf-export-adapter.ts` — `buildDxfExportRequest(scene, options)`: μετά το flatten, **append** τα overlay-entities. Σεβάσου το χρώμα (ACI) — οι σοβάδες/οπλισμός έχουν δικά τους χρώματα/layers (reuse `resolveEntityColorHex` ή το χρώμα του overlay renderer).
- `src/subapps/dxf-viewer/export/core/dxf-ascii-writer.ts` — γράφει ήδη LINE/POLYLINE/CIRCLE/TEXT + ACI(62) + extrusion(39) + dual-mode (polyline/lines). Πιθανότατα **δεν χρειάζεται αλλαγή** (τα overlays είναι γραμμές).
- `src/subapps/dxf-viewer/export/types.ts` — ίσως νέα optional πεδία στο `ExportRequest` (π.χ. `includeFinish?`, `includeReinforcement?`) ΑΛΛΑ προτίμησε: gate στα ΥΠΑΡΧΟΝΤΑ visibility flags (μηδέν νέο UI αν δεν χρειάζεται· ο Giorgio είπε «όταν είναι ενεργά»).

## 4. Αρχιτεκτονική (προτεινόμενη, full SSoT)
- NEW `export/core/overlay-dxf-collector.ts` (pure): δέχεται scene + visibility flags + (finish faces / rebar geometry SSoT) → επιστρέφει `Entity[]` (DXF-native primitives, με layer/χρώμα).
  - finish → `resolveStructuralFinishFaces()` → segments → LINE/closed POLYLINE.
  - rebar → (πρώτα extract geometry SSoT· βλ. §2) → LINE polylines ανά ράβδο/συνδετήρα.
- Wire στο `buildDxfExportRequest` + `mergeFloorsToSingleDxfScene` (all-single): append overlay entities μετά το flatten, **gated** στα flags.
- Layers: ξεχωριστά (π.χ. `FINISH`, `REBAR`) ή το layer του host element — απόφαση με Giorgio (Revit βάζει σε subcategories).
- 2Δ μόνο (όχι extrusion) για rebar/finish; ή finish με thickness; — **ρώτησε τον Giorgio** (lead με συγκεκριμένο παράδειγμα).

## 5. Tests + Verify
- jest: overlay-collector (finish faces → N LINEs· rebar → polylines· gated off → []).
- Browser: ενεργοποίησε σοβάδες+οπλισμό → Εξαγωγή → άνοιξε σε CAD → φαίνονται· απενεργοποίησε → δεν εξάγονται.
- **tsc:** background, ΕΝΑ τη φορά (N.17 — έλεγξε ότι δεν τρέχει άλλος agent tsc πρώτα).

## 6. ADR / tracking
- Επέκτεινε **ADR-505** (changelog + DEFER→DONE για finish/rebar). Ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15) + `adr-index.md` + memory `reference_unified_export_system.md`.
- Το ADR-505 status σήμερα: ✅ BROWSER-VERIFIED, committed. Finish/rebar = νέα φάση.

## 7. Reference (το ήδη υλοποιημένο export, για context)
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/reference_unified_export_system.md` (πλήρες — verify journey 8 γύρων, SSoT reuse map).
- ADR: `docs/centralized-systems/reference/adrs/ADR-505-unified-export-system.md`.
- SSoT που ήδη reuse-άρει το export: `isBimEntity`, `BimEntity.geometry`, `resolveEntityColorHex` (`systems/selection/select-similar-by-color`), `hexToAci` (`ui/text-toolbar/controls/aci-palette`), `mmToSceneUnits`, `IfcExportHost`, `PrintHost`.

---
**ΠΡΩΤΟ ΒΗΜΑ νέας συνεδρίας:** grep audit §2 (ειδικά `bim-three-structural-converters.ts` — μήπως η rebar/finish geometry υπάρχει ήδη ως pure function εκεί) → μετά Plan Mode → ρώτησε Giorgio τα §4 ανοιχτά (layers, 2Δ vs extrusion) → υλοποίηση.
