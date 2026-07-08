# ADR-160: Internal Angle Arc Rendering (dot product logic)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Drawing System |
| **Canonical Location** | `drawInternalAngleArc()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `drawInternalAngleArc()` from `rendering/entities/BaseEntityRenderer.ts`
- **Decision**: Use dot product logic for ALWAYS rendering INTERNAL angle arcs
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: `AngleMeasurementRenderer` used simple arc logic (angle1 → angle2), sometimes rendering EXTERNAL arcs
- **Existing Correct Logic**: `drawInternalArc()` (lines 667-718) uses dot product to select correct CCW/CW direction
- **Solution**: New method `drawInternalAngleArc(vertex, point1, point2, radiusWorld)` that:
  1. Calculates unit vectors from vertex to each point
  2. Delegates to `drawInternalArc()` which uses dot product for correct direction
- **Algorithm** (from drawInternalArc — **FIXED 2026-02-13**):
  ```typescript
  // dCCW = CW angular distance in canvas coords (Y-down, increasing angle = CW)
  const dCCW = norm(a2 - a1);
  // Σχεδίασε ΠΑΝΤΑ το μικρότερο τόξο:
  // - dCCW < π → CW path μικρό → useCCW = false (σχέδιασε CW)
  // - dCCW > π → CW path μεγάλο → useCCW = true (σχέδιασε CCW)
  const useCCW = dCCW > Math.PI;
  addArcPath(ctx, v, rPx, a1, a2, useCCW);
  ```
- **Files Changed**:
  - `BaseEntityRenderer.ts`: Added `drawInternalAngleArc()` method
  - `AngleMeasurementRenderer.ts`: Changed from `drawCentralizedArc()` to `drawInternalAngleArc()`
- **Benefits**:
  - Τόξα ΠΑΝΤΑ εσωτερικά (μικρότερη γωνία)
  - Consistent με Polyline/Rectangle angle rendering
  - CAD-standard behavior (AutoCAD dimension arcs)
- **Companion**: ADR-140 (Angle Measurement Constants), ADR-159 (Measurement Colors)

---

## Changelog

### 2026-02-13 — Fix: Τόξα γωνιών σχεδιάζονταν εξωτερικά αντί εσωτερικά

| Field | Value |
|-------|-------|
| **Bug** | Τα τόξα γωνιών (σε angle-measurement ΚΑΙ polygon vertices) σχεδιάζονταν στην εξωτερική πλευρά (μεγαλύτερο τόξο) αντί στην εσωτερική (μικρότερο τόξο) |
| **Root Cause** | Η συνθήκη `useCCW = dCCW < Math.PI` στο `drawInternalArc()` ήταν **ανεστραμμένη**. Στο canvas coordinate system (Y-down), `dCCW` είναι η CW angular distance. Όταν `dCCW < π` (CW path κοντό), ο κώδικας χρησιμοποιούσε `useCCW = true` (CCW path = μακρύ τόξο) αντί `useCCW = false` (CW path = κοντό τόξο) |
| **Fix** | Αλλαγή `dCCW < Math.PI` → `dCCW > Math.PI` — μία γραμμή, ένα χαρακτήρα |
| **File** | `src/subapps/dxf-viewer/rendering/entities/BaseEntityRenderer.ts` (γραμμή ~721) |
| **Impact** | Διορθώνει ΟΛΑ τα τόξα γωνιών: standalone angle-measurement, polygon vertex angles, area measurement angles — όλα περνούν από τη μοναδική `drawInternalArc()` |

### 2026-07-08 — Απόσυρση τόξων+μοιρών γωνιών από πολύγραμμη & εργαλείο ΕΜΒΑΔΟΝ (Giorgio)

| Field | Value |
|-------|-------|
| **Αίτημα** | Ο Giorgio: κατά τη σχεδίαση πολυγώνου / χρήση του εργαλείου «ΕΜΒΑΔΟΝ» (measure-area) **δεν** θέλει να εμφανίζονται τα τόξα και οι μοίρες στις κορυφές — μόνο οι γραμμές. Στην ολοκλήρωση θέλει ένα κείμενο με το εμβαδόν μέσα στην περιοχή. |
| **Root Cause** | Δύο render paths ζωγράφιζαν per-vertex εσωτερικές γωνίες: (1) `PolylineRenderer.renderPolygonAngles()` στη φάση measurements (preview polygon/polyline/measure-area + committed measurement:true), (2) `renderHoverAngleAtVertex()` στο hover/selection overlay (`utils/hover/polyline-renderer.ts`). |
| **Fix** | (1) Αφαιρέθηκε η κλήση `renderPolygonAngles` + οι νεκρές πλέον `renderPolygonAngles`/`isRectangleShape` από τον `PolylineRenderer` (μαζί με τα μη-χρησιμοποιούμενα imports). Το κείμενο εμβαδού/περιμέτρου στο centroid **παραμένει** (measurement:true → πάντα render). (2) Αφαιρέθηκε το `renderHoverAngleAtVertex` από το `renderPolylineHover`. |
| **Files** | `rendering/entities/PolylineRenderer.ts`, `utils/hover/polyline-renderer.ts` |
| **Impact** | Οι εσωτερικές γωνίες κορυφών δεν εμφανίζονται πλέον σε πολύγραμμη/πολύγωνο/measure-area (preview + committed + hover). Το `drawInternalArc()` SSoT μένει ενεργό μόνο για standalone angle-measurement + rectangle. Το εμβαδόν εξακολουθεί να εμφανίζεται ως κείμενο στο κέντρο της κλειστής περιοχής. |

### 2026-07-08 (β) — Fix: το κείμενο εμβαδού δεν εμφανιζόταν στην ΟΛΟΚΛΗΡΩΜΕΝΗ μέτρηση

| Field | Value |
|-------|-------|
| **Bug** | Ο Giorgio: μετά την ολοκλήρωση του εργαλείου ΕΜΒΑΔΟΝ (measure-area) **δεν** εμφανιζόταν κείμενο με το εμβαδόν μέσα στο πολύγωνο — ενώ κατά τη σχεδίαση (preview) φαινόταν. |
| **Root Cause** | Στον `PolylineRenderer.renderPolylineMeasurements` το κείμενο εμβαδού/περιμέτρου σχεδιαζόταν μέσω `renderStyledTextWithOverride`, που έχει `if (!style.enabled) return` δεμένο στο γενικό «Κείμενο» preview toggle (`getTextPreviewStyleWithOverride().enabled`). Στην committed οντότητα αυτό το gate έκρυβε το κείμενο. Το preview (canvas-v2 `preview-entity-renderers`) σχεδιάζει με ξεχωριστό ungated path → γι' αυτό φαινόταν μόνο εκεί. Αποδεικτικό: τα τόξα (ungated stroke) φαίνονταν, το εμβαδόν (gated text) όχι. |
| **Fix** | Το εμβαδόν είναι ΑΠΟΤΕΛΕΣΜΑ μέτρησης, όχι preview text → σχεδιάζεται πλέον ΑΠΕΥΘΕΙΑΣ με `ctx.fillText` (μετά `applyCenterMeasurementTextStyle` για font/χρώμα dimension style), ανεξάρτητα από το preview toggle. Αφαιρέθηκε το import `renderStyledTextWithOverride`. |
| **File** | `src/subapps/dxf-viewer/rendering/entities/PolylineRenderer.ts` |
| **Impact** | Το εμβαδόν (+περίμετρος) εμφανίζεται πάντα στο κέντρο της κλειστής μέτρησης/πολυγώνου. Εκκρεμεί απόφαση Giorgio αν θα μείνει μόνο το εμβαδόν (χωρίς περίμετρο/αποστάσεις ακμών). |

### 2026-07-08 (γ) — SSoT κεντρικοποίηση του label εμβαδού/περιμέτρου (Giorgio: «όπως οι μεγάλοι παίχτες»)

| Field | Value |
|-------|-------|
| **Αίτημα** | Ο Giorgio: full-enterprise / full-SSoT υλοποίηση όπως Revit / Maxon (Cinema 4D) / Figma. |
| **Πρόβλημα (root)** | Το label «εμβαδόν + περίμετρος» της κλειστής πολυγράμμης ήταν ξαναγραμμένο σε **3+ σημεία** με drift: committed (`PolylineRenderer`, area-weighted centroid), preview (`preview-entity-renderers`, inline shoelace + **λάθος** vertex-average centroid + **αντίστροφη** σειρά Περ→Ε + gated στο «Κείμενο» toggle), hover (`utils/hover`, area-only). Το drift ήταν ακριβώς η αιτία του bug (β). |
| **SSoT** | Νέο module `rendering/entities/shared/polygon-measurement-label.ts`: `computePolygonAreaMetrics()` (συνθέτει ΜΟΝΟ τους υπάρχοντες SSoT calculators `calculatePolygonArea`/`calculatePolygonCentroid`/`calculatePerimeter`), `buildAreaPerimeterLabelLines()` (canonical σειρά Ε→Περ, prefixes μέσω i18n `areaMeasureLabel.*`), `paintStackedMeasurementLabel()` / `paintPolygonAreaLabel()` (ΕΝΑΣ ungated painter, κοινό style ADR-159). |
| **Call sites** | committed + preview + hover καλούν πλέον το SSoT. Διαγράφηκε το `utils/hover/render-utils.ts#renderAreaLabel` (dead). Προστέθηκαν i18n keys σε el+en `dxf-viewer-shell.json`. |
| **4ος duplicate — ΕΝΟΠΟΙΗΘΗΚΕ** | `systems/phase-manager/drag-measurements/PolylineDragMeasurement.ts` (live label στο grip-drag) χρησιμοποιεί πλέον `computePolygonAreaMetrics` για μήκος/εμβαδόν/κέντρο (κρατά το δικό του `MeasurementData`/`renderMeasurementsAtCenter` contract — όχι ο SSoT painter). Διαγράφηκαν 3 τοπικοί helpers (inline shoelace/length/vertex-average centroid). **Latent bug fixed**: το «μήκος» (L) τώρα μετρά την κλείνουσα ακμή ΜΟΝΟ σε closed (threaded actual `closed` flag· open μένει open). Placement → area-weighted centroid. Ίδια labels/σειρά/μονάδες. |

### 2026-07-08 (δ) — Πλήρης κεντρικοποίηση ΟΛΩΝ των center measurement labels (ένας painter atom)

| Field | Value |
|-------|-------|
| **Αίτημα** | Ο Giorgio (διαταγή): «αν βρεις προϋπάρχοντα διπλότυπα, κεντρικοποίησέ τα κι αυτά». Audit αποκάλυψε ότι το ίδιο center-label ζωγραφιζόταν από **3 painters** (`renderStyledTextWithOverride` committed, `renderInfoLabel` preview, ο νέος polygon painter) + πανομοιότυπο content σε rectangle/ellipse/circle/arc. |
| **SSoT** | Το module `polygon-measurement-label.ts` **μετονομάστηκε → `measurement-label.ts`** (σερβίρει όλα τα σχήματα). Νέο `paintMeasurementText(ctx,text,x,y,{gate,style})` = **ΕΝΑ** per-line atom: `gate:true` → delegate στο canonical `renderStyledTextWithOverride` (κρατά decorations/super-sub + «Κείμενο» gate, μηδέν διπλασιασμός λογικής)· ungated → fixed measurement style. `paintStackedMeasurementLabel` περνά κι αυτό από το atom. |
| **Μετανάστευση (behavior-preserving)** | Committed labels σε `RectangleRenderer`/`EllipseRenderer`/`ArcRenderer`/`CircleRenderer`/`circle-text-utils` → `paintMeasurementText(gate:true)` (ίδιες θέσεις/χρώματα/gate = μηδέν οπτική regression). Rectangle area+perimeter → `buildAreaPerimeterLabelLines` (kills exact content dup + hardcoded Greek). |
| **Διατηρήθηκε σκόπιμα** | `renderStyledTextWithOverride` **ΔΕΝ** διαγράφηκε (9 legit non-measurement importers — canonical gated text primitive). |
| **Εκκρεμεί (honest, cosmetic)** | (α) `renderInfoLabel` (preview) = ξεχωριστό **layout** (below-anchor, gated)· μοιράζεται το concept, θα μπορούσε να delegate-άρει στο atom με marginal super/sub nuance. (β) Preview circle/rectangle/arc content: **perimeter-first** ενώ committed **area-first** → ασυνέπεια σειράς. Και τα δύο αλλάζουν ΟΡΑΤΑ το preview → απόφαση Giorgio (canonical σειρά). |
