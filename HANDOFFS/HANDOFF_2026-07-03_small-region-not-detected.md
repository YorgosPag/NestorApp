# HANDOFF — Μικρό κλειστό πλαίσιο ΔΕΝ εντοπίζεται από το wall region/perimeter detection

**Ημερομηνία:** 2026-07-03
**Subapp:** DXF Viewer (`src/subapps/dxf-viewer`)
**Μοντέλο:** Opus 4.8 (geometry/detection — κράτα Opus)
**Screenshot αναφοράς:** `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-07-03 143935.jpg` (κόκκινος κύκλος = το πλαίσιο που δεν πιάνεται)

---

## 🎯 ΣΤΟΧΟΣ (τι θέλει ο Giorgio)

Με το εργαλείο **«Τοίχος μέσα σε περιοχή» (`wall-region-inside`)**, η πράσινη διακεκομμένη preview
εντοπίζει σωστά τους μεγάλους τοίχους (στο screenshot: «1.75×0.25», «0.95×0.10», «0.60×0.10» — 3 τοίχοι
πλήρους πάχους, ο νέος centerline split δουλεύει ✅). **ΟΜΩΣ** ένα **μικρό κλειστό πλαίσιο** (magenta,
πάνω-δεξιά, κυκλωμένο κόκκινο) **ΔΕΝ εντοπίζεται** — καμία preview όταν ο κέρσορας πάει εκεί.

**Ζητούμενο:** να εντοπίζεται ΚΑΙ το μικρό πλαίσιο (να βγαίνει πράσινη preview + να γεμίζει με τοίχο/μέλος
σαν τα υπόλοιπα). Βρες **γιατί δεν το πιάνει** και διόρθωσέ το.

---

## 🔍 ΚΥΡΙΑ ΥΠΟΘΕΣΗ (audit lead — ΕΠΑΛΗΘΕΥΣΕ, μην την εμπιστευτείς τυφλά)

**Tolerance node-collapse σε μικρά features.** Η region ανοχή έχει **floor 50mm**
(`REGION_PERIMETER_LIMITS.LOOP_JOIN_TOLERANCE_MM`, `config/tolerance-config.ts`), που εφαρμόζεται ως
`max(SNAP_DEFAULT/zoom, 50mm×scale)` στο `resolveRegionLoopTolWorld` (`bim/walls/region-tolerance.ts`).
Ο corner-graph (`mergeNodes` στο `wall-in-region.ts`) και ο planar detector
(`findClosedPolygonsFromLines` στο `systems/auto-area/auto-area-geometry.ts`, μέσω `buildSegmentGraph`)
**συγχωνεύουν κορυφές εντός `tol`**. Αν το μικρό πλαίσιο έχει πλευρά **≲ 2×tol (~100mm)**, οι απέναντι
κορυφές του merge-άρονται → το πλαίσιο **εκφυλίζεται** (degenerate) → κανένα έγκυρο loop → δεν εμφανίζεται.
Δες επίσης `auto-area-hit.ts:151-155` (tol CAP στο 50mm — σκόπιμο για να ΜΗΝ ενώνει διακριτές παρειές,
αλλά καταπίνει μικρά κλειστά features).

**Big-player πρακτική (κατεύθυνση λύσης — επιβεβαίωσε ότι έτσι κάνουν Revit/AutoCAD):** adaptive/feature-aware
tolerance — η ανοχή ΔΕΝ πρέπει να ξεπερνά ένα κλάσμα (π.χ. τη μισή) της μικρότερης ακμής του υποψήφιου loop.
AutoCAD `HPGAPTOL` δεν κλείνει κενά μεγαλύτερα από το ίδιο το feature. Πιθανή λύση: per-feature clamp της
`tol` (min edge length aware) στο node-merge, ΩΣΤΕ μικρά πλαίσια να μην collapse-άρουν, ΧΩΡΙΣ να χαλάσει
το gap-closure των μεγάλων (μηδέν regression στα υπάρχοντα tests).

## 🔀 ΕΝΑΛΛΑΚΤΙΚΕΣ ΑΙΤΙΕΣ (αν η κύρια δεν ισχύει — τσέκαρέ τες με grep/DOM)

1. **Τύπος entity**: το magenta πλαίσιο ίσως είναι `rectangle`/`lwpolyline`/`polyline`, όχι `line`. Έλεγξε
   ότι το `extractLineSegments` (`wall-in-region.ts`) το εκθέτει (πιάνει line/polyline/lwpolyline/rect —
   επιβεβαίωσε ότι το συγκεκριμένο entity type περνάει· ίσως είναι `RectEntity` vs `RectangleEntity`).
2. **Layer visibility**: το magenta ίσως είναι σε layer εκτός των entities που δίνει το `getSceneEntities`
   (κρυφό/frozen), ή filtered. Έλεγξε τι επιστρέφει το scene στο σημείο.
3. **`isPointInPolygon` / smallest-containing**: `pickSmallestContainingPerimeter` κρατά το ΕΛΑΧΙΣΤΟ loop
   που περιέχει το σημείο — αν το μικρό πλαίσιο ΔΕΝ σχηματίζει loop, δεν το βρίσκει· αν σχηματίζει αλλά
   είναι φωλιασμένο, θα έπρεπε να το προτιμήσει. Δες αν πιάνεται καθόλου (log του `getCachedRegionPerimeters`).
4. **Undersized filter**: ψάξε μήπως υπάρχει min-area/min-thickness cut που το απορρίπτει (δεν βρέθηκε
   προφανές undersized filter — αλλά τσέκαρε `perimeter-measure.ts` + `auto-area` min-area).

**ΠΡΩΤΟ ΒΗΜΑ ΣΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ:** βάλε προσωρινό debug log στο `getCachedRegionPerimeters` /
`resolvePerimeterPreview` (`useRegionPerimeterMouseMove.ts`) όταν ο κέρσορας είναι πάνω στο μικρό πλαίσιο,
για να δεις αν το loop ανιχνεύεται καθόλου (→ διακρίνει «tolerance collapse» από «entity/layer/type»).

---

## 📁 KEY FILES (region/perimeter detection SSoT)

- `bim/walls/region-tolerance.ts` — `resolveRegionLoopTolWorld` (η ανοχή· 50mm floor).
- `config/tolerance-config.ts` — `REGION_PERIMETER_LIMITS.LOOP_JOIN_TOLERANCE_MM=50`, `MAX_MEMBER_THICKNESS_MM=3000`, `SNAP_DEFAULT=6`.
- `bim/walls/wall-in-region.ts` — `extractLineSegments`, `mergeNodes`, `findEnclosingRectangle`, `findRectanglesFromSegments`.
- `bim/walls/perimeter-from-faces.ts` — `perimeterFacesToRects`, `getCachedRegionPerimeters`, `pickRegionPerimeterAt`, `pickSmallestContainingPerimeter`, `buildSegmentGraph`.
- `systems/auto-area/auto-area-geometry.ts` — `findClosedPolygonsFromLines` (planar face SSoT· `planarizeSegments`/`bridgeCollinearGaps`).
- `systems/auto-area/auto-area-hit.ts:151-155` — tol CAP στο 50mm.
- `hooks/canvas/useRegionPerimeterMouseMove.ts` — preview producer (`resolvePerimeterPreview` → zones).
- `hooks/drawing/use-wall-region-clicks.ts` — click commit («inside» split path).

---

## ⚠️ ΚΑΤΑΣΤΑΣΗ WORKING TREE (ΔΙΑΒΑΣΕ — κρίσιμο)

**Μοιραζόμενο tree με ΑΛΛΟΝ agent.** Υπάρχει UNCOMMITTED δουλειά — **δική μου** (μόλις ολοκληρώθηκε,
ADR-419 v1.7/v1.8/v1.9 + ribbon-wall + gap-markers) **ΚΑΙ** πιθανώς άλλου agent
(`HANDOFFS/HANDOFF-wall-merge-command-2026-07-03.md`, αρχεία renderers). **ΠΟΤΕ `git add -A`.**
Stage/άγγιξε ΜΟΝΟ τα δικά σου αρχεία. **Commit/push τα κάνει ο Giorgio, ΟΧΙ εσύ** (N.(-1)).

**Τι μόλις υλοποιήθηκε (uncommitted, μπορεί να έχει γίνει commit από Giorgio στο μεταξύ — τσέκαρε `git log`):**
- **ADR-419 §thickness-zones + §wall-centerline-split (v1.8→v1.9):** NEW `bim/walls/wall-footprint-decompose.ts`
  (`decomposeWallsFromFootprint` — grid decomposition, junction=μακρύτερος· ΑΝΤΙΚΑΤΕΣΤΗΣΕ το slab-sweep
  για τοίχους). Zone-based preview (`RegionPerimeterPreviewStore` → `RegionPerimeterZone[]`). Το split
  ΔΟΥΛΕΥΕΙ σωστά τώρα (screenshot επιβεβαιώνει 3 σωστούς τοίχους).
- **ADR-419 §Layer 5b (gap markers):** `RegionGapMarkersStore` + `RegionGapMarkersOverlay` (κόκκινα ○ στα ανοιχτά άκρα).
- **ADR-419 §gap-close:** `gap-close-confirm-store.ts` + `GapCloseConfirmDialog.tsx` + `use-region-gap-close.ts`
  («Να κλείσω το κενό;» → προσθέτει γραμμή-ένωσης).
- Το πρόβλημα ΑΥΤΟΥ του handoff (μικρό πλαίσιο) είναι ΞΕΧΩΡΙΣΤΟ/ΝΕΟ — ΔΕΝ σχετίζεται με regression των παραπάνω.

---

## 🚨 ΚΑΝΟΝΕΣ (υποχρεωτικοί)

1. **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις κώδικα** — ψάξε υπάρχοντα detection/tolerance μηχανισμό,
   reuse, ΟΧΙ διπλότυπα. Επαλήθευσε τη διάγνωση με δικό σου grep + debug log (μην εμπιστευτείς τυφλά την υπόθεση).
2. **Big-player level (Revit / Maxon-Cinema4D / Figma).** FULL enterprise + FULL SSoT. Αν οι μεγάλοι δεν
   προτείνουν κάτι, ακολούθησε την πρακτική τους.
3. **ADR-driven (N.0.1):** ενημέρωσε το **ADR-419** (owner του region/perimeter detection) στο ίδιο βήμα.
4. **i18n el+en** για κάθε νέο label (ΟΧΙ hardcoded).
5. **ΟΧΙ tsc / typecheck** (N.17) — μόνο jest, στοχευμένα. Πρόσθεσε test για το μικρό-feature case
   (π.χ. πλαίσιο 80×120mm με tol 50 → πρέπει να ανιχνεύεται· + regression στα μεγάλα).
6. **ΜΗΔΕΝ regression:** τρέξε `npx jest bim/walls/__tests__/perimeter-from-faces.test.ts wall-footprint-decompose.test.ts wall-from-perimeter.test.ts` — πρέπει να μένουν πράσινα.
7. **Shared tree:** ΠΟΤΕ `git add -A`· stage μόνο δικά σου. **Commit/push = Giorgio.**

## 🧪 Verification
- **jest** στοχευμένα (μικρό-feature detection + regression μεγάλων).
- **Browser** (`localhost:3000/dxf`): φόρτωσε το ίδιο DXF (`Αδείας.Κάτοψη ισογείου-EXPLODE_ΧΩΡΙΣ_ΧΑΤΣ.dxf`),
  εργαλείο «Τοίχος μέσα σε περιοχή», hover πάνω στο μικρό πλαίσιο → πρέπει να βγαίνει πράσινη preview.
