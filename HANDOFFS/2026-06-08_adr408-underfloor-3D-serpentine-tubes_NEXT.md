# HANDOFF — Ενδοδαπέδια Θέρμανση: 3D Πραγματικές Σπείρες (TubeGeometry) «σαν Revit»

**Ημερομηνία:** 2026-06-08
**Εντολή Giorgio:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ (Revit/4M-FineHEAT) — FULL ENTERPRISE + FULL SSOT.»
**Μοντέλο:** Opus 4.8 (3D γεωμετρία/converter).
**Scope (κλειδωμένο):** Αναβάθμισε το 3D της ενδοδαπέδιας ώστε να σχεδιάζει τις **πραγματικές σπείρες ως 3D σωλήνες** (TubeGeometry κατά μήκος του `geometry.loopPath`, ακτίνα = διάμετρος/2, στη στάθμη screed) — αντί για το σημερινό επίπεδο έγχρωμο layer.

**⚠️ COMMIT/PUSH: ΜΟΝΟ ο Giorgio.** Working tree **SHARED** με άλλον agent. `git add` ΜΟΝΟ δικά σου αρχεία — **ΠΟΤΕ `-A`**. ΜΗΝ `--no-verify`. ΜΗΝ adr-index. **N.17: ένας tsc τη φορά** (έλεγξε για τρέχοντα tsc πριν).

---

## 0) ΤΙ ΕΓΙΝΕ ΗΔΗ (προηγούμενη συνεδρία, code = source of truth)

### Α. ADR-422 L0 — Θερμικός Χώρος (thermal-space / IfcSpace) — ΟΛΟΚΛΗΡΩΜΕΝΟ (🔴 pending browser-verify + commit Giorgio)
Νέα area-based οντότητα `thermal-space`, Revit «Place Space» (κλικ μέσα σε δωμάτιο → footprint auto-derive από κλειστό βρόχο τοίχων, reuse ADR-419 `perimeter-from-faces`). useType (ΤΟΤΕΕ)→setpoint Ti+ACH+ύψος→όγκος. Contextual tab. tsc 0 δικά μου· 9 tests. ~38 αρχεία. ADR-422 γραμμένο. **ΜΗΝ το ξαναφτιάξεις.** Επόμενο μετά το 3D: **ADR-422 L1 heat-load engine**.

### Β. Ενδοδαπέδια 2D σπείρες — UNIT-BUG FIXED + ✅ BROWSER-VERIFIED (Giorgio «τώρα βλέπω»)
`computeMepUnderfloorGeometry` υπέθετε footprint σε mm ενώ είναι σε **scene-units** (το σχέδιο του Giorgio ≈ μέτρα/cm). Ο guard `minSpan <= 2*edgeClearanceMm` έσκαγε πάντα → degenerate → καμία σπείρα. **Fix (FULL SSOT, `mmScaleFor`):** clearance/spacing/entry-off ×`mmScaleFor(params)` (mm→scene), areaM2/totalLengthM ×`sceneToM`. mm scene = ×1 (zero regression). Αρχείο `bim/mep-underfloor/mep-underfloor-geometry.ts` + meters test (14/14). **ΠΑΛΙΕΣ ενδοδαπέδιες θέλουν re-create/reload (cached geometry).**

### Γ. thermal-space geometry — ίδιο units-fix (δικό μου L0 code) DONE.

> ΟΛΑ τα παραπάνω 🔴 pending commit (Giorgio). 24/24 tests pass συνολικά.

---

## 1) ΣΤΟΧΟΣ (αυτό το task)

3D: το `mep-underfloor` να δείχνει τον **serpentine βρόχο ως πραγματικούς 3D σωλήνες** (Revit/4M radiant floor), όχι επίπεδη πλάκα.

---

## 2) RECOGNITION (PHASE 1 — διάβασε ΠΡΙΝ κώδικα)

1. **`src/subapps/dxf-viewer/bim-3d/converters/mep-underfloor-to-three.ts`** (~70 γραμμές) — ΤΟ ΚΥΡΙΟ αρχείο. Σήμερα: `buildShape(footprint)` → `extrudeAndRotate(shape, thickness)` = λεπτή πλάκα στη στάθμη screed. Πρέπει να **προστεθεί/αντικατασταθεί** με σωλήνες κατά μήκος `entity.geometry.loopPath`.
2. **SSoT δεδομένων:** `entity.geometry.loopPath` (`Point3D[]`, **scene-units**, ΗΔΗ units-correct μετά το fix). ΜΗΝ ξαναϋπολογίσεις σερπαντίνα — reuse το loopPath. Κενό loopPath (degenerate) → fallback στην πλάκα ή null.
3. **Units (κρίσιμο):** XY scene-units → μέτρα με `sceneUnitsToMeters(units)` (όπως ήδη κάνει ο converter, γραμμή 52). Ακτίνα σωλήνα = `connectorDiameterMm/2 * MM_TO_M`. Στάθμη = `floorElevationMm + screedOffsetMm` → μέτρα (`* MM_TO_M`) + `buildingBaseM`.
4. **Axis convention (κρίσιμο):** ο υπάρχων converter χρησιμοποιεί `extrudeAndRotate` (XY→XZ, world Y = ύψος). Για τους σωλήνες ΠΡΕΠΕΙ να αντιστοιχίσεις plan (x,y) → world. Δες `bim-three-shape-helpers.ts` (`extrudeAndRotate`, `buildShape`) + ένα point-based converter (π.χ. `floor-finish-to-three.ts` / connectors) για το ΑΚΡΙΒΕΣ mapping (πιθανότατα `world = (x, elevationM, -y)`). Επιβεβαίωσε από τον κώδικα, μην μαντέψεις.
5. **Caller:** `src/subapps/dxf-viewer/bim-3d/scene/BimSceneLayer.ts` → `syncUnderfloors(...)` καλεί `underfloorToMesh(...)` και περιμένει `THREE.Mesh | null`. **ΑΠΟΦΑΣΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ:**
   - (Προτεινόμενο, enterprise) επέστρεψε **`THREE.Group`** = λεπτή πλάκα screed (faint translucent) **+** σωλήνες (κόκκινο pipe) → άλλαξε signature σε `THREE.Object3D | null` + ενημέρωσε τον caller (`syncUnderfloors`, type, dispose). Δες πώς χειρίζονται Group άλλοι (π.χ. railing/furniture αν επιστρέφουν Group).
   - ή (πιο απλό) επέστρεψε ΜΟΝΟ τους σωλήνες ως Mesh (χάνεις την πλάκα). **Giorgio θέλει Revit-grade → προτίμησε Group (σωλήνες + λεπτό screed).**
6. **TubeGeometry:** το loopPath είναι polyline με γωνίες. Επιλογές: `THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.0)` (στρογγυλεύει ελαφρώς τις στροφές — μοιάζει με αληθινές κάμψεις σωλήνα) → `new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false)`. `radialSegments` ΧΑΜΗΛΑ (6-8). `tubularSegments` ανάλογα του μήκους (π.χ. `clamp(loopPath.length*2, 32, 4000)`).
7. **Performance:** μεγάλος χώρος (250τ.μ. @ 150mm ≈ 1600m) → πολλά segments. Κράτα radialSegments=6, λογικά tubularSegments· σκέψου merged geometry αν χρειαστεί. Μην το παρακάνεις.
8. **Material:** pipe material (hydronic-supply κόκκινο). Δες `MaterialCatalog3D` / `material-catalog-defs.ts` — υπάρχει key για pipe/segment ή χρησιμοποίησε/πρόσθεσε ένα `elem-mep-underfloor-pipe`. Reuse `getMaterial3D` + `tagMesh`.
9. **ADR-040:** οι 3D converters ΔΕΝ είναι στο 2D micro-leaf perf path — δεν χρειάζεται staging ADR-040 (επιβεβαίωσε ότι δεν αγγίζεις τα CHECK 6B/6C αρχεία).
10. **Επόμενος ADR:** ΟΧΙ νέος — είναι follow-up του ADR-408 Εύρος Β #3 (ενδοδαπέδια). Ενημέρωσε ADR-408 changelog (όχι adr-index).

## 3) ΥΛΟΠΟΙΗΣΗ
- Edit `mep-underfloor-to-three.ts`: build serpentine tubes από `geometry.loopPath` (units-correct), στη στάθμη screed + radius, + (προτεινόμενο) faint screed band → `THREE.Group`.
- Ενημέρωσε `BimSceneLayer.syncUnderfloors` + signature αν γυρίσεις Group (return type, mesh tagging, dispose/cleanup).
- (Προαιρετικό) material key για τον σωλήνα στο `material-catalog-defs.ts`.
- Tests: pure helper για το tube-path building αν εξαχθεί· αλλιώς smoke (loopPath→points count > 0). Μην σπάσεις τα 14 υπάρχοντα underfloor tests.

## 4) VERIFY
- `npx tsc --noEmit` (N.17 — έλεγξε τρέχοντα tsc πρώτα). Pre-existing errors (π.χ. `mesh-to-object3d:124`, locale `en/dxf-viewer-shell.json`) **μην τα κυνηγήσεις**.
- jest: `npx jest mep-underfloor` (διατήρησε 14/14).
- Browser (Giorgio): 3D προβολή → η ενδοδαπέδια δείχνει σπείρες-σωλήνες στη στάθμη δαπέδου (όχι επίπεδο layer). Παλιές → re-create.
- **STOP — commit ο Giorgio.** `git add` ΜΟΝΟ: `mep-underfloor-to-three.ts` (+ caller `BimSceneLayer.ts` + τυχόν material-defs/test). N.15: ADR-408 changelog + memory.

## 5) ΕΚΚΡΕΜΟΤΗΤΕΣ (μετά το 3D, ΟΧΙ τώρα)
- 🔴 browser-verify + commit ADR-422 **L0 θερμικός χώρος** (όλα τα αρχεία της προηγ. συνεδρίας).
- ⚠️ `floor-finish` έχει **ΤΟ ΙΔΙΟ latent units-bug** στο εμβαδό (`computeFloorFinishGeometry` hardcode `MM_TO_M`) → λάθος m² σε μη-mm σχέδια. Flagged — διόρθωσε με `mmScaleFor` αν το ζητήσει ο Giorgio.
- ▶️ Επόμενο μεγάλο: **ADR-422 L1 — heat-load engine** (Φ = ΣU·A·ΔΤ + 0.34·n·V·ΔΤ· Te ανά ζώνη στο kenak-thermal-config· Ug ανοιγμάτων). Στρώμα-στρώμα με Plan Mode.

## 6) ΚΑΝΟΝΕΣ
- Giorgio γράφει ΕΛΛΗΝΙΚΑ → απαντάς ΕΛΛΗΝΙΚΑ.
- FULL ENTERPRISE + FULL SSOT, code = source of truth (διάβασε πριν γράψεις). Reuse `geometry.loopPath`/`sceneUnitsToMeters`/`getMaterial3D`/`tagMesh`.
- Plan Mode αν το 3D αποδειχθεί >3 αρχεία/πολύπλοκο (caller Group refactor). N.8: 5+ αρχεία/2+ domains → πρότεινε mode + περίμενε.
- **COMMIT/PUSH μόνο Giorgio. Shared tree → git add μόνο δικά σου. ΜΗΝ adr-index. ΜΗΝ --no-verify. N.17 ένας tsc.**
- Μην ρωτάς τον Giorgio να διαλέξει standard professional options — πάρε εσύ την Revit-grade απόφαση, δήλωσέ την, ζήτα μόνο έγκριση plan.
