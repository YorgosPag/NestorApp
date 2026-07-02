# HANDOFF — Ενιαίος περιμετρικός σοβάς «κουβέρτα» + διαφορετικό υλικό/χρώμα/επιμέτρηση ανά πλευρά

> **Ημ/νία:** 2026-07-02
> **Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
> **ADR:** ADR-449 (Structural Finish Skin / σοβάς) — κύριο· cross-ref ADR-511 (wall-covering per-room), ADR-040 (canvas perf)
> **Status:** 🔴 TODO — feature (2 κομμάτια). ΠΡΩΤΑ Plan/ADR, ΜΕΤΑ υλοποίηση.

---

## 0. ΤΙ ΘΕΛΕΙ Ο GIORGIO (ακριβώς — δικά του λόγια)

Ο περιμετρικός σοβάς (finish-skin) στην κάτοψη/3Δ πρέπει να είναι **μία συνεχής «κουβέρτα»** που
ντύνει ΟΛΟΚΛΗΡΟ τον οργανισμό (όσες οντότητες κι αν συνδεθούν), **ΑΚΡΙΒΩΣ όπως ήδη κάνει το καπάκι
(top-cap) στην κορυφή** — γίνεται ΕΝΑ ενιαίο, όσες οντότητες κι αν ενωθούν.

1. **Ενιαία επιφάνεια ανά ευθεία πλευρά:** πάνω σε ΕΥΘΥΓΡΑΜΜΗ (collinear) περιμετρική επιφάνεια ο
   σοβάς **ΠΟΤΕ** να μη διακόπτεται. Οι **κάθετες γραμμές/ραφές** στις συνδέσεις διαδοχικών τοίχων
   (structural junctions) **να ΜΗΝ εμφανίζονται ποτέ**. Διακοπή **ΜΟΝΟ στις αλλαγές διεύθυνσης
   (γωνίες)**.
2. **Διαφορετικό υλικό ανά πλευρά:** ταυτόχρονα, ο χρήστης να μπορεί να δηλώσει σε **κάθε πλευρά/όψη**
   διαφορετικό **υλικό σοβά** (π.χ. Knauf / παραδοσιακό), διαφορετικό **χρώμα**, και να παίρνει
   **ξεχωριστές επιμετρήσεις (BOQ)** ανά είδος σοβά + χρώμα.
3. **Αλλαγή υλικού στη ΜΕΣΗ ευθείας (διευκρίνιση Giorgio):** π.χ. ένας τοίχος μέσα σε πλευρά δωματίου,
   μισός λευκός/παραδοσιακός & μισός κόκκινος/Knauf. **ΝΑΙ, το θέλει.** Συμφωνήσαμε: εκεί εμφανίζεται
   **ΚΑΘΑΡΟ ΣΥΝΟΡΟ ΧΡΩΜΑΤΟΣ** (μία γραμμή όπου το ένα χρώμα συναντά το άλλο) — **ΟΧΙ** δομική ραφή
   (κενό/διπλή/βήμα/z-fighting). Ίδιο με το να βάφεις πραγματικό τοίχο μισό-μισό: πάντα υπάρχει το
   σύνορο, αλλά είναι καθαρό (coplanar, κολλητά).

**Ο Giorgio τόνισε:** «δες και την ΠΛΑΚΑ ΟΡΟΦΗΣ, νομίζω κάτι ανάλογο χτίσαμε εκεί». → Υπάρχει
**per-room floor/slab finish** (Revit-style) που κάνει ΑΚΡΙΒΩΣ αυτό (μία επιφάνεια → υποδιαιρεμένη
σε περιοχές ανά δωμάτιο → διαφορετικό υλικό/χρώμα ανά περιοχή → καθαρά σύνορα). **ΤΟ ΜΟΝΤΕΛΟ ΠΡΟΣ
REUSE.**

### Το νοητικό μοντέλο (locked):
> **ΜΙΑ συνεχής επιφάνεια → υποδιαιρεμένη σε περιοχές (regions) → διαφορετικό υλικό/χρώμα/επιμέτρηση
> ανά region → καθαρά σύνορα, μηδέν δομική ραφή στις συνδέσεις.**
- **Σύνδεση τοίχων** (ίδιο υλικό, ευθεία) → **καμία γραμμή** (ενιαίο).
- **Γωνία** (αλλαγή διεύθυνσης) → γραμμή (φυσιολογικό).
- **Σύνορο υλικού/χρώματος** (όπου το ορίζει ο χρήστης, ακόμα & στη μέση ευθείας) → **μία καθαρή
  γραμμή-σύνορο** (region boundary), όχι ραφή-ελάττωμα.

---

## 1. 🚨 ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)

1. **Ελληνικά ΠΑΝΤΑ** στις απαντήσεις προς τον Giorgio.
2. **Big-player quality:** Revit / Maxon (Cinema 4D) / Figma-level, **FULL ENTERPRISE + FULL SSOT**.
   Αν οι μεγάλοι δεν προτείνουν κάτι → ακολούθησε **την πρακτική τους**.
3. **SSoT AUDIT ΠΡΩΤΑ (πραγματικό grep)** πριν γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → §4. Reuse υπάρχοντα, **ΜΗΝ
   δημιουργήσεις διπλότυπα** (N.0 / N.12 / N.0.2).
4. **❌ COMMIT/PUSH ΤΑ ΚΑΝΕΙ Ο GIORGIO** — ΠΟΤΕ εσύ (N.-1). Ετοίμασε, σταμάτα, ανέφερε.
5. **⚠️ SHARED WORKING TREE** με άλλον agent → **ΠΟΤΕ `git add -A`**. Άγγιξε/stage ΜΟΝΟ δικά σου αρχεία.
6. **❌ ΟΧΙ `tsc` / typecheck** (N.17). ✅ jest επιτρέπεται (στοχευμένα).
7. **i18n (N.11):** νέα UI labels (π.χ. «Υλικό σοβά ανά πλευρά», ονόματα υλικών) → πρώτα key σε `el` ΚΑΙ `en`.
8. **Enterprise TS:** ❌ `any`/`as any`/`@ts-ignore`. Αρχεία ≤500 γρ., functions ≤40 γρ.
9. **ADR-040 CHECK 6B/6D:** αν αγγίξεις canvas/preview/renderer αρχεία → stage ADR-040 + ADR-449.
10. **ΠΡΩΤΑ Plan Mode / ADR** (ο Giorgio το ζήτησε ρητά: «σχεδίασέ το» → συμφωνία μοντέλου ΠΡΙΝ κώδικα).

---

## 2. 🎯 ΤΟ FEATURE — 2 ΚΟΜΜΑΤΙΑ

### ΚΟΜΜΑΤΙ Α — Ενιαία επιφάνεια (εξαφάνιση κάθετων ραφών σε ευθεία)
Ο κάθετος σοβάς χτίζεται ήδη ως **merged silhouette** (union πυρήνων ανά z-band → ΕΝΑ εξωτερικό
περίγραμμα). Το περίγραμμα είναι γεωμετρικά συνεχές, ΑΛΛΑ σπάει σε επιμέρους «όψεις» (segments) στις
collinear κολλήσεις τοίχων → σχεδιάζονται **κάθετες ραφές**.
- **Στόχος:** **συγχώνευση των συνευθειακών (collinear) διαδοχικών όψεων** σε ΜΙΑ συνεχή όψη πριν τη
  σχεδίαση (2Δ) / εξώθηση (3Δ) → η γραμμή μένει **ΜΟΝΟ** όπου αλλάζει η διεύθυνση.
- **Προσοχή:** στο 3Δ οι κάθετες γραμμές είναι edge-overlay (`LineSegments2`) — η συγχώνευση πρέπει να
  γίνει **πριν** το `EdgesGeometry` (μάθημα ADR-449 tilt-follow). Στο 2Δ = πριν το outline draw.

### ΚΟΜΜΑΤΙ Β — Υλικό/χρώμα/επιμέτρηση ανά πλευρά (region model)
Σήμερα ο σοβάς είναι **binary**: `FinishClassification = 'interior' | 'exterior'` με ΜΟΝΟ
`interiorMaterialId` / `exteriorMaterialId` (`structural-finish-types.ts`). Χρειάζεται **per-face /
per-region** μοντέλο:
- Κάθε συνεχής όψη (region μεταξύ δύο γωνιών **ή** μεταξύ δύο user-defined συνόρων) = ένα **face id**
  με δικό του **materialId + color** (override από χρήστη).
- **Χρώμα ανά region** στον renderer (ήδη ζωγραφίζει ανά όψη → επέκταση σε per-region color).
- **BOQ ανά υλικό/χρώμα:** το `bandedFinishAreasM2` μετράει ήδη interior/exterior ξεχωριστά → επέκταση
  σε **group-by-materialId** (Σ area ανά υλικό). Πιθανό reuse του BOQ bridge (`structural-finish-boq`).
- **Αλλαγή στη μέση ευθείας:** ο χρήστης ορίζει σημείο/σύνορο → η όψη υποδιαιρείται σε 2 regions
  (region boundary = καθαρό σύνορο χρώματος). **ΑΝΑΛΟΓΟ του per-room slab finish subdivision.**

---

## 3. ✅ ΤΙ ΞΕΡΟΥΜΕ ΗΔΗ (από την τρέχουσα συνεδρία — code=SoT)

- **Ο κάθετος σοβάς** = `computeStructuralSilhouetteBands` (`bim/finishes/structural-finish-silhouette.ts`):
  union cores ανά z-band → `resolveBandFaces` → `resolveStructuralFinishFaces` → **segments** (exposed faces).
- **Γωνιακή γεωμετρία (miter/end-cap)** = `computeMiteredOuter` (`structural-finish-outline-geometry.ts`) —
  ΚΟΙΝΟ 2Δ+3Δ engine. Εδώ (ή στον καταναλωτή του) θα γίνει η **collinear merge** (Κομμάτι Α).
- **Το top-cap (καπάκι)** που ο Giorgio θέλει ως πρότυπο = `mergeCoresToFinishedRings` +
  `computeMergedStructuralFinishTopCap` (`structural-finish-horizontal.ts` / `-scene-horizontal.ts`) —
  ΕΝΑ filled ring από union ΠΥΡΗΝΩΝ. **Το «ενιαίο» μοντέλο υπάρχει ήδη εκεί.**
- **Wall footprint** για τον σοβά = `wallFootprintPolygon` (`structural-finish-scene.ts`). ⚠️ **ΜΟΛΙΣ
  ΑΛΛΑΞΕ (UNCOMMITTED, ΔΟΚΙΜΗ):** επιστρέφει τώρα `union(raw, mitered)` — §angled-wall-miter-close
  (ADR-449 changelog «2026-07-02 (β)»). Ο Giorgio θα αποφασίσει αν το κρατήσει. **ΜΗΝ το χαλάσεις.**
- **Binary material** σήμερα: `structural-finish-types.ts` (`FinishClassification`, `resolveFinishForClass`,
  `read/applyFinishParam`, `StructuralFinishSpec` με interior/exterior materialId+thickness).
- **Classifier** interior/exterior = `buildStructuralFinishClassifier` (`structural-finish-scene.ts`,
  building-footprint based). Θα χρειαστεί επέκταση/παράκαμψη για per-face override.

---

## 4. 🔍 SSoT AUDIT TARGETS (GREP ΠΡΙΝ ΓΡΑΨΕΙΣ — reuse, μη διπλασιάσεις)

| Ανάγκη | grep | Αναμενόμενο SSoT / σημείωση |
|---|---|---|
| **Per-room slab/floor finish** (ΤΟ ΠΡΟΤΥΠΟ REUSE) | `floor.*finish`, `per-room`, `roomFinish`, `IfcCovering`, `FloorFinish` | Βρες το system (handoff `2026-06-06-floor-finish-per-room-revit-style-handoff.md`). **ΜΕΛΕΤΗΣΕ region subdivision + per-region material + BOQ.** |
| **Wall covering per-room (ADR-511)** | `wall-covering`, `WallCovering`, `covering-preview` | `hooks/drawing/wall-covering-preview-helpers.ts` + ADR-511. Manual per-room finish — πιθανό reuse μηχανισμού region/material. |
| Κάθετος σοβάς (segments/faces) | `computeStructuralSilhouetteBands`, `resolveBandFaces`, `resolveStructuralFinishFaces` | `bim/finishes/structural-finish-silhouette.ts` + `structural-finish-resolver.ts` |
| Γωνία/miter engine (ΕΔΩ collinear-merge) | `computeMiteredOuter`, `closeOpenOuterEnds`, `segOffsetVec` | `bim/finishes/structural-finish-outline-geometry.ts` (κοινό 2Δ+3Δ) |
| Top-cap «ενιαίο» πρότυπο | `mergeCoresToFinishedRings`, `computeMergedStructuralFinishTopCap`, `computeFinishedOutline` | `structural-finish-horizontal.ts` / `structural-finish-scene-horizontal.ts` |
| Material model (binary→per-face) | `FinishClassification`, `resolveFinishForClass`, `StructuralFinishSpec`, `interiorMaterialId` | `bim/finishes/structural-finish-types.ts` |
| Classifier interior/exterior | `buildStructuralFinishClassifier`, `collectExteriorEdges` | `bim/finishes/structural-finish-scene.ts` |
| BOQ σοβά (→ per-material grouping) | `structural-finish-boq`, `FinishBoqContribution`, `bandedFinishAreasM2` | `bim/services/structural-finish-boq.ts` + `structural-finish-scene.ts` |
| 2Δ draw σοβά (κάθετες γραμμές) | `drawStructuralFinishSkin2D`, `drawStructuralFinishOutline` | `canvas-v2/dxf-canvas/dxf-renderer-structural-overlays.ts` + `structural-finish-outline-2d.ts` |
| 3Δ σοβάς (edge overlay = ραφές) | `structural-finish-3d`, `buildFinishSkinFromFaces`, `EdgesGeometry` | `bim-3d/converters/structural-finish-3d.ts` (merge ΠΡΙΝ το EdgesGeometry!) |
| Per-face UI (χρώμα/υλικό ανά πλευρά) | `ShowFinishSkinToggle`, `finish-param`, ribbon contextual finish | `ui/ribbon/.../ShowFinishSkinToggle.tsx` + finish contextual tab |
| Color ανά υλικό/region | `resolveEntityColorHex`, plaster color SSoT, `STRUCTURAL_FINISH_*_MATERIAL` | grep material→color mapping |
| Color dialog (reuse) | `EnterpriseColorDialog` | αν χρειαστεί picker χρώματος ανά region |

**Κρίσιμο:** Το per-room slab/floor finish **ήδη λύνει** «μία επιφάνεια → regions → υλικό/χρώμα ανά
region → BOQ». **ΜΗΝ φτιάξεις νέο region/subdivision/material engine — reuse-άρε το.**

---

## 5. 🏗️ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (big-player: Revit «finish by face»)

**ΠΡΩΤΑ Plan/ADR — να συμφωνηθεί με Giorgio ΠΡΙΝ κώδικα.** Σκελετός:

1. **Κομμάτι Α (continuity):** pure `mergeCollinearFinishFaces(segments, tolAngle)` → συγχωνεύει
   διαδοχικά collinear segments σε ΜΙΑ όψη. Wire στο 2Δ draw + 3Δ builder (πριν EdgesGeometry).
   Break ΜΟΝΟ όταν |Δangle| > tol. **Δεν αλλάζει γεωμετρία/BOQ**, μόνο τα visual seams. (Μικρό, χαμηλού ρίσκου — μπορεί να πάει πρώτο.)
2. **Κομμάτι Β (per-face material):** επέκταση `StructuralFinishSpec` από binary → **per-face map**
   (`faceMaterials?: Record<faceId, {materialId, color, thicknessMm?}>`) + fallback στο interior/exterior.
   - **faceId** = σταθερό, deterministic (π.χ. hash της κατεύθυνσης+θέσης όψης· ή reuse του id μοντέλου
     του per-room slab finish).
   - **Subdivision στη μέση ευθείας** = reuse του region-subdivision του slab/floor finish.
   - **Renderer:** χρώμα ανά region (per-face color).
   - **BOQ:** group-by materialId (reuse `structural-finish-boq`).
   - **UI:** contextual «Σοβάς ανά πλευρά» → επιλογή όψης → υλικό + χρώμα (reuse `EnterpriseColorDialog`).
3. **SSoT:** ΕΝΑ face model, κοινό 2Δ/3Δ/BOQ (όπως ήδη ο σοβάς). Μηδέν παράλληλο σύστημα.

**Απόφαση προς Giorgio (AskUserQuestion στο Plan):** πώς ορίζει ο χρήστης το σύνορο «στη μέση ευθείας»
(κλικ σημείο; per-wall segment; drag divider;) — να διαλέξει με **συγκεκριμένο παράδειγμα** (feedback:
lead with concrete example).

---

## 6. VERIFICATION
- **jest** στοχευμένα: `mergeCollinearFinishFaces` (collinear→1, γωνία→2, tol)· per-face material resolve
  (override vs fallback)· BOQ group-by-material (Σ area ανά υλικό)· region subdivision (μέση ευθείας → 2 regions).
- **browser-verify (Giorgio):** ευθεία πολλών τοίχων → μηδέν κάθετες ραφές· γωνία → γραμμή· 2 υλικά/χρώματα
  ανά πλευρά + μισός-μισός τοίχος → καθαρό σύνορο χρώματος, μηδέν ραφή-ελάττωμα· BOQ ξεχωριστά ανά υλικό.
- ❌ ΟΧΙ `tsc`. ✅ jest OK.

## 7. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ❌ Νέο region/subdivision/material engine — **reuse** το per-room slab/floor finish + ADR-511.
- ❌ `git commit/push/add -A` (shared tree· commit = Giorgio).
- ❌ `tsc` / typecheck.
- ❌ Να χαλάσεις το UNCOMMITTED §angled-wall-miter-close (`wallFootprintPolygon` = union raw+mitered).
- ❌ Άγγιγμα άσχετων αρχείων άλλου agent (shared tree).

## 8. ΠΛΑΙΣΙΟ — UNCOMMITTED στο working tree (ΜΗΝ τα αγγίξεις)
- **§angled-wall-miter-close** (δικό μου, δοκιμή): `structural-finish-scene.ts` + `wall-finish-source.test.ts`.
- **Άλλος agent:** i18n, column-aspect, column-becomes-wall, grip-ghost-preview κ.λπ. — ΑΣΧΕΤΑ.
