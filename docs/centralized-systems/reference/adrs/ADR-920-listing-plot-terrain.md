# ADR-920 — Τοπογραφικό στην αγγελία οικοπέδου: ανάγλυφο 3D, ισοϋψείς και ενδεικτικός όγκος δόμησης

| | |
|---|---|
| **Status** | 🟠 PROPOSED — 2026-10-23 · Β0 (αποφάσεις + πλάνο) ✅ · **Β1 (καθαρός πυρήνας στο `src/lib/terrain/`) ✅** · **Β2 (συμβόλαιο + builder στιγμιοτύπου) ✅** · **Β3α (πόρτα server) ✅** · **Β3β (κρίκος 26 + δημόσιο ράφι + CHECK 3.105 + i18n) ✅** · **Β4 σε εξέλιξη** (Β4.1α ✅ · Β4.1β ✅ · Β4.2 ✅ · Β4.3+5 ✅ · Β4.6 ✅ · Β4.4 ✅ · Β4.7 ✅ · **Β4.8 ✅** · **Β4.9 ✅ (ζωντανή δοκιμή ✅ 2026-11-20 ⇒ §13.10)** · **Β4.11 Α ✅ (κώδικας)**, §13) · **Β6 σε εξέλιξη** (Β6.1 ✅ · Β6.2 ✅ · Β6.3 ✅ · Β6.4 ✅ · Β6.5 ✅ · Β6.6 ✅ κώδικας · Β6.7 ✅ · **Β6.8 ✅ (tests + ζωντανά ✅ 2026-11-22)** · **Β6.9 ✅ (Α · Β · Γ· tests ✅ 379/379 · μεταλλάξεις 2/2)**, §14) · Β5, Β7, Β8 δεν ξεκίνησαν |
| **Date** | 2026-10-23 |
| **Category** | Marketplace / Public listing / Topography / 3D |
| **Canonical Location** | πυρήνας `src/lib/terrain/` · στιγμιότυπο `src/lib/terrain/publication/` · κινητήρας δημοσίευσης `src/server/listing-material/` · πόρτες `src/app/api/properties/[id]/terrain/route.ts` + `src/app/api/owner-properties/[ownerPropertyId]/terrain/route.ts` · ράφι + binder `src/services/listings/*terrain*` · πύλη CHECK 3.105 · *(σχεδιασμένο)* θεατής `src/components/listing-detail/terrain/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Σχετικά** | **ADR-650** (τοπογραφικό, CDT/TIN, ισοϋψείς) · **ADR-718** (κοπή στο όριο, παγίδα γεωαναφοράς) · **ADR-720** (σημεία χωρίς Ζ) · **ADR-665** (τομή εδάφους) · **ADR-759** (`SurveyRecord`, όροι με πηγή) · **ADR-909** (δημοσίευση από το σχέδιο, ίδιο μοτίβο) · **ADR-845** (υλικό αγγελίας, `MATERIAL_DOORS`) · **ADR-839/841** (σχήμα δημόσιας αγγελίας) · **ADR-796** (δημόσια επιφάνεια `dxf-viewer`, CHECK 3.62) · **ADR-872** (ιδεμποτία) · **ADR-919** (διαθεσιμότητα, κρίκος σχήματος 25) |

---

## 1. Το πρόβλημα

Όταν κάποιος καταχωρεί **οικόπεδο** (`plot`) ή **αγροτεμάχιο** (`parcel`) για πώληση ή αντιπαροχή,
ο ενδιαφερόμενος βλέπει σήμερα **εμβαδόν και φωτογραφίες**. Δεν βλέπει το πράγμα που καθορίζει την
αξία ενός οικοπέδου περισσότερο από κάθε άλλο, δηλαδή **πόσο κατηφορίζει και τι χωράει να χτιστεί**.

Ο ιδιοκτήτης έχει συχνά **πλήρες τοπογραφικό** (κορυφές, υψόμετρα, ισοϋψείς). Ο DXF Viewer ήδη ξέρει
να το κάνει TIN, ισοϋψείς και 3D ανάγλυφο (ADR-650). Η αγγελία όμως δεν έχει τρόπο να το δείξει.

**Στόχος**: ο ιδιοκτήτης ή ο εξουσιοδοτημένος του ανεβάζει το τοπογραφικό. Ο επισκέπτης βλέπει
**ανάγλυφο σε 3D, ισοϋψείς, χάρτη κλίσεων και ενδεικτικό όγκο επιτρεπόμενης δόμησης**, όλα από
**τον ίδιο** πυρήνα με τον viewer.

## 2. Τι κάνουν οι μεγάλοι *(έρευνα web 2026-10-23)*

| Παίκτης | Τι δείχνει για οικόπεδα | Τι λείπει |
|---|---|---|
| **Land.id** (πρώην MapRight) | Ισοϋψείς ανά 2 ft, επίπεδο κλίσεων, εδάφη, πλημμυρικές ζώνες, **3D Tour** (εναέρια περιήγηση με ανάγλυφο και όρια), embed σε σελίδα μεσίτη | **Όροι δόμησης / όγκος**. Το «land use» είναι φορολογική χρήση, όχι πολεοδομία |
| **Autodesk Forma / Archistar / TestFit / Giraffe** | Έδαφος, όγκος βάσει όρων, ήλιος, άνεμος, θόρυβος | Είναι **επαγγελματικά** εργαλεία μελέτης σκοπιμότητας για developers, όχι για τον επισκέπτη αγγελίας |
| **Zillow / Idealista / Rightmove** | Φίλτρα, χάρτης, φωτογραφίες | Δεν βρέθηκε ανάγλυφο, ισοϋψείς ή όγκος στις αγγελίες οικοπέδων *(ανεπιβεβαίωτο, όχι αποδεδειγμένη απουσία)* |
| **Addland** (UK) | Πολύγωνο οικοπέδου με τονισμένα γειτονικά στοιχεία | Ανάγλυφο, όροι |

**Το κενό**: το ανάγλυφο υπάρχει στις καταναλωτικές πλατφόρμες, ο όγκος στις επαγγελματικές.
**Κανείς δεν βάζει και τα δύο μπροστά στον αγοραστή.** Επιπλέον όλοι χρησιμοποιούν δημόσιο DEM
(US 3DEP / Copernicus 30 m). Εμείς έχουμε **μετρημένο TIN τοπογράφου**, με ακρίβεια εκατοστού.

## 3. Τι υπάρχει ήδη *(SSoT audit 2026-10-23, grep + ανάγνωση)*

| Ανάγκη | Υπάρχον | Συμπέρασμα |
|---|---|---|
| TIN | `dxf-viewer/systems/topography/tin-builder.ts` → `buildTin(points, breaklines)` (cdt2d, MIT, κρατά ασυνέχειες — ⚠️ 2026-10-25: Delaunator + Constrainautor, ISC, βήμα Τ §13.8· ο cdt2d **ΔΕΝ** κρατούσε τεμνόμενες ασυνέχειες) | **Χρήση.** Καθαρό, χωρίς store |
| Κοπή στο όριο | `tin-clip-to-boundary.ts` → `clipTinToBoundary` | Καθαρό, αλλά τραβά `bim/geometry/shared/polygon-utils` + `rendering/types/Types` |
| Ισοϋψείς | `contour-generator.ts` (`generateContoursFromSurface`) · `marching-triangles.ts` · `contour-chainer.ts` · `graph-chain.ts` | **Χρήση.** Καθαρά, in-house |
| Δειγματοληψία | `tin-sampler.ts` | Καθαρό |
| Εισαγωγή | `parse-topo-points.ts` · `topo-delimited-reader.ts` · `topo-excel-reader.ts` · `topo-dxf-points.ts` · `topo-column-*` | **Χρήση** στην πόρτα του ιδιοκτήτη |
| Έλεγχος ποιότητας | `qa/check-*` (καθαρά) · `qa/run-topo-qa.ts` (**δεμένο** στο `TopoPointStore`) | Μόνο τα `check-*` |
| Επιφάνεια του editor | `topo-surface.ts` → `getTopoSurface*` (διαβάζει `TopoPointStore`, γραμμή 36) | **Μένει στον viewer** |
| 3D στον viewer | `bim-3d/scene/terrain/*Layer.ts`: δεμένα σε `terrain-3d-store`, `geo-reference-store`, ενότητα τομών | **Όχι.** Καθαρή ραφή: `bim-3d/converters/tin-to-three.ts`, `contour-to-three.ts` |
| Όροι δόμησης | `SurveyBuildingTerms` (`src/types/project-survey-record.ts:142`), κάθε τιμή με πηγή· `declaredMaxHeight` είναι **κείμενο** | Πηγή όρων με προέλευση |
| Αποτύπωμα | `src/services/building-code/engines/setback-calculator.ts` → `computeSetbackResult` (`buildableFootprint`, m) · `site-calculator.ts` | **Χρήση.** Η **εξώθηση σε 3D δεν υπάρχει** |
| Δημοσίευση από σχέδιο | ADR-909: `api/properties/[id]/floorplan/route.ts` · `_shared/publish-property-material.ts` | **Ίδιο μοτίβο** |
| Σχήμα αγγελίας | `PUBLIC_LISTING_SCHEMA_VERSION = 25` · `public-listing-migrations-21-30.ts` | Νέο πεδίο = κρίκος 26 |
| Τύποι ακινήτου | `src/constants/property-types.ts`: `plot` + `parcel` → `land` · `isLandProperty` | Κριτήριο ενεργοποίησης |
| Φόρμα | `src/app/(light)/offers/new/page.tsx` → `OwnerPropertyFields.tsx` (μόνο `isLand` σήμερα) | Σημείο εισόδου |
| 3D σε δημόσια σελίδα | `ListingModelCanvas.tsx`: `@google/model-viewer` (.glb, αυτόνομο build, **χωρίς three**) · `spatial-tour/viewer/tour-panorama-engine.ts` (σκέτο three) | Το model-viewer **δεν αποδίδει σωστά γραμμές** ⇒ θεατής στο πρότυπο του tour |
| Γεωαναφορά | `src/lib/geo/egsa87-projection.ts` (καθαρό, εκτός subapp) · `topo-local-origin.ts` | Χρήση |
| Προηγούμενο για την πύλη 3.62 | `src/lib/geometry/planar-polygon.ts`: μετακινήθηκε στο `lib`, re-export από την παλιά διαδρομή | **Ίδια συνταγή** |

## 4. Αποφάσεις

### 4.1 Αποφάσεις του Giorgio *(2026-10-23)*
- **Δ1. Ποιος ανεβάζει**: ο ιδιοκτήτης **και** ο εξουσιοδοτημένος του (μηχανικός ή μεσίτης), μέσω της
  **υπάρχουσας** επιμέλειας αγγελίας (CHECK 3.56). Νέο μοντέλο δικαιωμάτων **δεν** φτιάχνεται.
- **Δ2. Συναίνεση**: **υποχρεωτική δήλωση** «έχω δικαίωμα δημοσίευσης αυτού του τοπογραφικού», μαζί με
  όνομα τοπογράφου και ημερομηνία ως **πηγή**. Δημοσιεύεται **μόνο παράγωγο**, ποτέ τα ωμά σημεία ή το DXF.
- **Δ3. Θέση**: **προσεγγιστική ως προεπιλογή** (κύκλος περιοχής στον χάρτη, χωρίς συντεταγμένες ΕΓΣΑ στο
  3D). Το ακριβές πολύγωνο δείχνεται **μόνο με ρητή επιλογή** του ιδιοκτήτη.

### 4.2 Αρχιτεκτονικές αποφάσεις
- **Α1. Ένας πυρήνας εδάφους, κανένα δεύτερο TIN.**
  - Νέο `src/lib/terrain/` με τους τύπους (`TinSurface`, `TopoPoint`, `TopoPoint3D`, `Breakline`,
    `ContourLine`) και τα `buildTin`, `clipTinToBoundary`, ισοϋψείς, `tin-sampler`, `check-*`, μαζί με
    τα καθαρά μαθηματικά γεωμετρίας των converters.
  - Οι παλιές διαδρομές στο `dxf-viewer` κάνουν **re-export** (προηγούμενο `planar-polygon`).
  - Οι μεταβατικές εξαρτήσεις (`polygon-utils`, `Point2D`) αντικαθίστανται από `src/lib/geometry/planar-polygon`.
  - Το `getTopoSurface` μένει στον viewer και καλεί τον πυρήνα.
  - **Χωρίς barrel** (ADR-796) και χωρίς νέες εγγραφές στο `.dxf-viewer-public-api.json`: ο δημόσιος
    κώδικας εισάγει από το `lib`, όχι από το subapp.
- **Α2. Δημοσιεύουμε στιγμιότυπο, όχι ζωντανό editor** (ίδιο με το ADR-909). Το
  `ListingTerrainSnapshot` είναι εκδοσιοποιημένο, κλειδωμένο ανά αναθεώρηση πηγής, και περιέχει:
  - **απλοποιημένο** mesh σε **σχετικό τοπικό πλαίσιο** (κβαντισμένο, χωρίς απόλυτες συντεταγμένες ΕΓΣΑ)·
  - ισοϋψείς με διάστημα που προσαρμόζεται στο ανάγλυφο (κύριες και δευτερεύουσες, με επιπλέον
    ετικέτες υψομέτρου)·
  - κλάση κλίσης ανά τρίγωνο·
  - όριο, εμβαδόν, ελάχιστο και μέγιστο υψόμετρο, μέση και μέγιστη κλίση, διεύθυνση κύριας κλίσης·
  - όγκο δόμησης (Α3).

  Το αρχείο ζει στο **Storage**. Η αγγελία κρατά `terrain: SourcedAttribute<ListingTerrain>` (κρίκος
  σχήματος 26 + κριτής σχήματος).
- **Α3. Ενδεικτικός όγκος δόμησης χωρίς σιωπηλή μαντεψιά.**
  - Αποτύπωμα από `computeSetbackResult`, ύψος από **αριθμητική** τιμή που δήλωσε μηχανικός ή ιδιοκτήτης.
  - Το `declaredMaxHeight` του `SurveyRecord` είναι κείμενο («κατά ΝΟΚ») ⇒ **δεν** μετατρέπεται αυτόματα.
  - Χωρίς αριθμητικό ύψος δείχνουμε **μόνο το αποτύπωμα**, όχι πρίσμα.
  - Κάθε τιμή εμφανίζεται με την πηγή της («δήλωσε: Τοπογράφος Χ, ημερομηνία»), μαζί με τη ρητή ένδειξη
    **«ενδεικτικό: δεν αντικαθιστά βεβαίωση πολεοδομίας»**.
- **Α4. Δύο πόρτες εισόδου, ένας server.**
  - (α) **Φόρμα αγγελίας οικοπέδου**: ανέβασμα DXF / CSV / Excel, με τους υπάρχοντες parsers, έλεγχο
    `check-*`, προεπισκόπηση και δήλωση Δ2.
  - (β) **DXF Viewer**: πράξη «Δημοσίευση εδάφους στην αγγελία», στο πρότυπο του ADR-909.
  - Και οι δύο καταλήγουν σε **ένα** route με: `withAuth` (CHECK 3.90), `Idempotency-Key` (CHECK 3.92),
    γραμμή πολιτικής ρυθμού (CHECK 3.78), επιμέλεια (CHECK 3.56), γραμμή στο `MATERIAL_DOORS` και
    επαναπροβολή (CHECK 3.76), enterprise IDs (N.6) και ιστορικό οντότητας (CHECK 3.17).
- **Α5. Θεατής: πρώτα 2D, μετά 3D.**
  - **2D SVG χάρτης ισοϋψών και κλίσεων**, αποδοσμένος στον server: προσβάσιμος, λειτουργεί χωρίς
    WebGL, επαναχρησιμοποιείται στο PDF του showcase.
  - Στο κλικ φορτώνει **lazy** 3D θεατής σε σκέτο `three@0.170`, στο πρότυπο του `tour-panorama-engine`.
    Περιέχει: περιστροφή, **κάθετη υπερβολή με ορατή ένδειξη** (1× προεπιλογή), ετικέτες ισοϋψών,
    εναλλαγή χάρτη κλίσεων, ημιδιάφανο όγκο, βορρά και κλίμακα.
  - Το `@google/model-viewer` **δεν** χρησιμοποιείται, γιατί οι ισοϋψείς είναι γραμμές.
- **Α6. Κλάσεις κλίσης ρυθμιζόμενες και επισημασμένες ως ενδεικτικές.** Οι πηγές διαφωνούν (Cupertino:
  15–30 % «πολύ σημαντική»· Washington Co. Utah: από 20 %). Τα όρια ζουν σε **ένα** config, ποτέ
  σκορπισμένα, και **δεν** παρουσιάζονται ως εκτίμηση κόστους.
- **Α7. Νέα πύλη (πρόταση)**: «ένας γραφέας του `PublicListing.terrain`», στο μοτίβο των CHECK 3.104
  και 3.76, ώστε κανείς να μην γράφει το πεδίο έξω από την πόρτα της Α4.

## 5. Πέρα από τους μεγάλους *(μεταγενέστερες φάσεις)*
- **Ήλιος και σκιά** πάνω στον όγκο, ανά εποχή και ώρα (υπάρχει στο Forma για μηχανικούς, ποτέ σε αγγελία).
- **Εκτίμηση εκσκαφών και επιχώσεων** για εξομάλυνση πλατείας στο αποτύπωμα, με το υπάρχον `cut-fill-geometry`.
- **Βέλη απορροής νερού** από το TIN. → ✅ ως «σταγόνα νερού» στο **Β6.10 Ε3** (§14.10).
- **Εφεδρεία δημόσιου DEM** (Copernicus GLO-30, ελεύθερη άδεια με υποχρεωτική αναφορά DLR/Airbus και
  αποποίηση ευθύνης) με ένδειξη **«χαμηλή ακρίβεια»**, όταν δεν υπάρχει τοπογραφικό.

## 6. Ανοιχτά
- **DEM 5 m Κτηματολογίου**: δεν βρέθηκε διαθεσιμότητα ούτε άδεια. Χρειάζεται έλεγχος στο geodata.gov.gr
  και στα ανοικτά δεδομένα του Κτηματολογίου.
- **Χωρικά δεδομένα πολεοδομίας (ΗΛ.Ε.ΠΟΛ.)**: δεν βρέθηκε API ούτε άδεια αναδιανομής. Μέχρι να
  επιβεβαιωθεί, οι όροι δόμησης **εισάγονται από ανθρώπους** με πηγή.
- ~~**Απλοποίηση mesh**~~ → **ΛΥΘΗΚΕ στο Β2 (§10): καμία απλοποίηση, καμία νέα εξάρτηση.**
- **Πνευματική ιδιοκτησία τοπογράφου**: η Δ2 είναι η προστασία μας. Η νομική διατύπωση της δήλωσης θέλει
  έγκριση (ADR-861, νομικά κείμενα με έκδοση).

## 7. Βήματα *(ένα τη φορά, «ΠΡΟΧΩΡΑ» σε καθένα)*

| Βήμα | Περιεχόμενο | Κατάσταση |
|---|---|---|
| **Β0** | Αυτό το ADR: αποφάσεις, audit, πλάνο | ✅ 2026-10-23 |
| **Β1** | Εξαγωγή καθαρού πυρήνα στο `src/lib/terrain/` + re-exports · jest του topography · CHECK 3.62 | ✅ 2026-10-23 (§9) |
| **Β2** | Συμβόλαιο και builder του `ListingTerrainSnapshot` (καθαρό) · tests: ισοϋψείς, κλίσεις, όγκος, **απουσία απόλυτων συντεταγμένων** | ✅ 2026-10-23 (§10) |
| **Β3α** | Πόρτα server: πηγή, δήλωση Δ2, ξαναχτίσιμο, ιδιωτική αποθήκευση, διαδοχή, ιστορικό (§11) | ✅ 2026-10-23 |
| **Β3β** | `PublicListing.terrain` (κρίκος 26) · τρίτο κεφάλι του δημόσιου ραφιού · πύλη ενός γραφέα (CHECK 3.105) · i18n | ✅ 2026-10-23 (§12) |
| **Β4** | Εισαγωγή από τον ιδιοκτήτη στη φόρμα οικοπέδου (Δ2) — 11 υποβήματα (§13) | 🔄 Β4.1α ✅ · Β4.1β ✅ · Β4.2 ✅ · Β4.3+5 ✅ · Β4.6 ✅ · Β4.4 ✅ · Β4.7 ✅ · Β4.8 ✅ · Β4.9 ✅ |
| **Β5** | Πόρτα δημοσίευσης από τον DXF Viewer | ⏳ |
| **Β6** | Θεατής: 2D SVG → 3D lazy — κάτοψη (Υψόμετρα \| Κλίσεις) + 3Δ με κύβο, στη δημόσια αγγελία και στο «Βελτίωσε» (§14) | 🔄 Β6.1 ✅ · Β6.2 ✅ (κώδικας) |
| **Β7** | Ιδιωτικότητα θέσης στον χάρτη αγγελιών (Δ3) | ⏳ |
| **Β8** | Φάσεις §5 | ⏳ |

## 8. Πηγές
- Land.id 3D Tour: https://id.land/product/3d-tour · https://support.id.land/visualize-maps-in-3d · https://id.land
- Archistar για Forma: https://www.archistar.ai/autodesk-forma/page/105/
- Addland: https://thenegotiator.co.uk/news/land-marketplace-hits-new-listings-milestone/
- Άδεια Copernicus DEM GLO-30: https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf · https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- Ηλεκτρονική Πολεοδομία: https://www.odigostoupoliti.eu/ilektroniki-poleodomia-e-poleodomia-ypoxreotiki-leitourgia-apo-01-01-2019/
- Κλάσεις κλίσης: https://cupertino.org/home/showpublisheddocument/12738/636317565299200000 · https://agisprodvm.washco.utah.gov/arcgis/rest/services/SepticData/MapServer/0/iteminfo
- Προσεγγιστική θέση (Airbnb): https://www.airbnb.com/help/article/2141
- Άδειες: @mapbox/martini ISC · meshoptimizer MIT · Draco Apache-2.0 · cdt2d MIT (επαληθευμένο στο `node_modules`)

## 9. Β1 — ο καθαρός πυρήνας στο `src/lib/terrain/` *(2026-10-23)*

**Τι μετακινήθηκε** (ίδια σώματα, ίδια σημασιολογία· οι παλιές διαδρομές κάνουν `export *` από το `lib`):

| Νέο σπίτι | Από | Σημείωση |
|---|---|---|
| `src/lib/terrain/terrain-types.ts` | `topography/topo-types.ts` | Μόνο οι γεωμετρικοί τύποι (`TopoPoint`, `TopoPoint3D`, `Breakline`, `LocalOrigin`, `TopoBounds`, `TinSurface`, `ContourSegment`, `ContourLine`). Οι τύποι του editor (ids επιφανειών, σύνδεσμος ορίου, κοπή, αποτέλεσμα όγκων, στυλ σκίασης) **μένουν** εκεί |
| `src/lib/terrain/tin-builder.ts` · `tin-clip-to-boundary.ts` · `tin-sampler.ts` | ομώνυμα | `cdt2d` (MIT). Οι τύποι του ζουν ήδη στη γέφυρα του ADR-719 (`src/types/dxf-viewer-ambient.d.ts`), άρα το root τους βλέπει — ⚠️ 2026-10-25: αντικαταστάθηκε από `delaunator` + `@kninnug/constrainautor` (ISC, δικοί τους τύποι), βήμα Τ §13.8 |
| `src/lib/terrain/contour-generator.ts` · `marching-triangles.ts` · `contour-chainer.ts` · `graph-chain.ts` | ομώνυμα | — |
| `src/lib/terrain/topo-local-origin.ts` · `topo-point-elevation.ts` | ομώνυμα | — |
| `src/lib/terrain/contour-config.ts` | `topography/contour-config.ts` | Μόνο `ContourConfig` + `DEFAULT_CONTOUR_CONFIG`. Η παρουσίαση DXF (στρώσεις, χρώματα, πάχη) μένει στον viewer |
| `src/lib/terrain/dz-plane.ts` | `topography/cut-fill-geometry.ts` | Μόνο το επίπεδο Δz (`fitDzPlane`, `dzAt`, `attachDz`, `DzVertex`, `DzPlane`). Οι όγκοι πρισμάτων μένουν στον viewer |
| `src/lib/geometry/planar-polygon-clip.ts` | `bim/geometry/shared/polygon-clip-utils.ts` | `clipPolygonBySH` + `clipPolygonByConvex2D`. Το `polygonIntersectionAreaMm2` (θέλει `xy-bounds`) μένει εκεί |

**Τύπος σημείου**: στο `lib` χρησιμοποιείται το `PlanarPoint` (`src/lib/geometry/planar-polygon.ts`) στη θέση του
`Point2D` του `rendering/types/Types`. Τα πεδία ήταν ήδη `readonly`, και κανένα αρχείο του topography δεν
μεταλλάσσει σημείο (έλεγχος με grep) ⇒ καμία αλλαγή για τους καταναλωτές.

**Τι ΔΕΝ μετακινήθηκε, επίτηδες**: `topo-surface.ts` (`getTopoSurface*`, διαβάζει το `TopoPointStore`) ·
`run-topo-qa.ts` · `remove-elevation-spikes.ts` · `vertical-datum.ts` · τα layers του `bim-3d/scene/terrain/`.
Είναι κώδικας του editor.

**Επαλήθευση**: jest `systems/topography` + `bim/geometry/shared` + `lib/geometry` + `bim-3d/converters` +
`ambient-declaration-ssot`: **176 σουίτες / 1.591 tests πράσινα**. CHECK 3.62: 0 αδήλωτες (391 σύμβολα,
αμετάβλητο — καμία νέα εγγραφή στο registry). CHECK 3.28 (jscpd diff): 0 κλώνοι. Κανένα αρχείο του `lib`
δεν εισάγει από το subapp.

⚠️ **Ξένο εύρημα (όχι από το Β1)**: το `scripts/__tests__/point-vocabulary-gate.test.js` Π2 είναι κόκκινο,
γιατί περιμένει `PlanarPoint` **δηλωμένο** στο `bim-base.ts`, ενώ από το `e2f41c59` (2026-09-28, ADR-884) είναι
**επανεξαγωγή** από το `lib`. Το `bim-base.ts` δεν άλλαξε από τότε.

## 10. Β2 — το στιγμιότυπο που δημοσιεύει η αγγελία *(2026-10-23)*

**Αρχεία** (`src/lib/terrain/publication/`, καθαρά, χωρίς store):

| Αρχείο | Ρόλος |
|---|---|
| `listing-terrain-types.ts` | Συμβόλαιο: `ListingTerrainSnapshot` (v1), `ListingTerrainInput`, `ListingTerrainBuildResult` (επιτυχία **ή** ονομασμένη απόρριψη) |
| `listing-terrain-config.ts` | **Όλα** τα «κουμπιά» σε ένα σημείο: ζώνες κλίσης 5/15/25 %, κλίμακα ισοδιαστάσεων, όριο 60.000 τριγώνων, στρογγύλευση σε εκατοστό |
| `contour-interval.ts` | `chooseContourConfig(relief)`: η **λεπτότερη** ισοδιάσταση της χαρτογραφικής κλίμακας (1·2·2,5·5 × 10ⁿ) με ≤ 30 ισοϋψείς. Κύρια κάθε 5η (κάθε 4η για την οικογένεια του 2,5). Τροφοδοτεί τον **ίδιο** `generateContoursFromSurface`. ⚠️ **Από το Β6.8 (§14.8)**: `chooseContourConfig(ContourDensityInput)`, όπου μετρά και η **πυκνότητα στην οθόνη** |
| `terrain-slope.ts` | Κλίση ανά τρίγωνο με το **ίδιο** `fitDzPlane` των όγκων (Δz = z ⇒ `hypot(a,b)·100` = %), κλάση, μέση κλίση σταθμισμένη με εμβαδόν, μέγιστη, αζιμούθιο κατωφέρειας (`null` σε επίπεδο) |
| `listing-terrain-frame.ts` | Το **ΕΝΑ** σημείο όπου μια παγκόσμια συντεταγμένη γίνεται δημοσιευμένη (μέτρα από το κέντρο της επιφάνειας) + τοποθέτηση του όγκου πάνω στο έδαφος |
| `listing-terrain-snapshot.ts` | `buildListingTerrainSnapshot(input)`: TIN → κοπή → ισοϋψείς → κλίσεις → όγκος → πλαίσιο |

**Αποφάσεις του Β2**
- **Καμία απλοποίηση του mesh, καμία νέα βιβλιοθήκη.** Οι κορυφές του τοπογράφου **είναι** η μέτρηση: η
  απλοποίηση θα επινοούσε έδαφος. Η είσοδος είναι ήδη αραιή: ένα τοπογραφικό οικοπέδου έχει εκατοντάδες ως
  λίγες χιλιάδες σημεία, και τα νέφη σημείων αραιώνονται στον viewer (`voxelDecimate`) **πριν** γίνουν
  σημεία. Πάνω από 60.000 τρίγωνα ⇒ ρητή απόρριψη `too-dense`, όχι σιωπηλή περικοπή. *(Οι μεγάλοι
  απλοποιούν επειδή σερβίρουν DEM ηπείρων· εμείς σερβίρουμε ένα μετρημένο οικόπεδο.)*
- **Θέση**: οι οριζόντιες συντεταγμένες είναι μέτρα από το κέντρο, αλλά ο **βορράς διατηρείται** (χρειάζεται
  για ήλιο και προσανατολισμό). Τα **υψόμετρα μένουν απόλυτα**, γιατί ο αγοραστής διαβάζει «124 m» και ένα
  υψόμετρο από μόνο του δεν εντοπίζει οικόπεδο.
- **Ο όγκος ακολουθεί το έδαφος**: `groundM[i] + maxHeightM` ανά κορυφή, επειδή ο ΝΟΚ μετρά το ύψος από το
  έδαφος σε κάθε σημείο. Κορυφή αποτυπώματος έξω από την επιφάνεια ⇒ ο όγκος **παραλείπεται με λόγο**
  (`outside-surface`), δεν μαντεύεται. Ύψος `null` / ≤ 0 / μη πεπερασμένο ⇒ μόνο αποτύπωμα.
- **Απορρίψεις με όνομα**: `insufficient-surface` · `empty-after-clip` (ποτέ το ακομμάτιαστο αντί για το
  κομμένο) · `too-dense`.
- **Ντετερμινισμός**: ίδια είσοδος ⇒ ίδια bytes (στρογγύλευση σε εκατοστό, `-0` → `0`).
- **Δεν μπαίνει στο `src/lib/listings/`**, που το επεξεργάζεται τώρα ο άλλος agent (ADR-919). Το
  συμβόλαιο αφορά το έδαφος, άρα ζει δίπλα στον πυρήνα του. Το `PublicListing.terrain` (κρίκος 26) είναι Β3.

**Επαλήθευση**:
- 16 tests (`publication/__tests__/listing-terrain-snapshot.test.ts`) σε οικόπεδο 20 × 20 m με μεγέθη
  ΕΓΣΑ'87 και κλίση 10 % προς ανατολή, όπου κάθε αναμενόμενη τιμή βγαίνει με το χέρι.
- **Μεταλλάξεις 2/2 κόκκινες**: χωρίς αφαίρεση κέντρου ⇒ κοκκινίζει το test απορρήτου· αντεστραμμένο
  πρόσημο κατωφέρειας ⇒ κοκκινίζει το αζιμούθιο.
- CHECK 3.28 (diff): 0 κλώνοι. CHECK 3.47: PASS.
- ⚠️ Τα exports δεν έχουν ακόμα καταναλωτή εκτός των tests (έρχεται στο Β3). Αν το knip (CHECK 3.22) τα
  μετρήσει ως νεκρά στο commit, ο καταναλωτής είναι το Β3.

## 11. Β3α — η πόρτα του server *(2026-10-23)*

Το Β3 χωρίστηκε στα δύο, επειδή ο κρίκος 25 του ADR-919 είναι ακόμη **staged** στα ίδια αρχεία (σχήμα
αγγελίας, προβολή, `src/types/i18n.ts`). Το Β3α δεν αγγίζει **κανένα** από αυτά.

**Ροή**
```
πελάτης (Β4 φόρμα · Β5 viewer): CSV/Excel/DXF ─(υπάρχοντες parsers)─▶ κανονική πηγή JSON + δήλωση Δ2
POST /api/properties/[id]/terrain   withHeavyRateLimit(withAuth(…, properties:properties:update))
  └─ publishPropertyMaterial(TERRAIN_DOOR)          ← ο ΚΟΙΝΟΣ κορμός του ADR-909, μηδέν αντίγραφο
       read: αρχείο → δήλωση → «είναι γη;» → σχήμα πηγής → buildListingTerrainSnapshot (ξηρή εκτέλεση)
       record: DRAWINGS · application/json · public · publicationIdentity 'terrain/measured'
       bytes: η ΚΑΝΟΝΙΚΗ πηγή + δήλωση ως custom metadata, στο ΙΔΙΟ save()
       διαδοχή → ιστορικό ακινήτου (πεδίο `terrain`) → επαναπροβολή
```

**Αρχεία**

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/terrain/publication/listing-terrain-source.ts` | Συμβόλαιο σύρματος v1. Σημεία `[x,y]`/`[x,y,z]` σε WORLD mm, breaklines, όριο, αποτύπωμα + δηλωμένο ύψος. `parseListingTerrainSource` (zod, όρια, ποτέ προεπιλογή) → κανονική μορφή (ακέραια mm, `-0` → `0`). `encodeListingTerrainSource`: μία σειριοποίηση. `toListingTerrainInput` → builder Β2 |
| `src/lib/terrain/publication/terrain-survey-declaration.ts` | Δήλωση Δ2: `surveyorName`, `surveyedOn` (πραγματική ημέρα), `rightsAffirmed: true` (κυριολεκτικό). Ποιος/πότε = γεγονότα του server (`createdBy`/`createdAt`), όχι ισχυρισμός. «Στο μέλλον» = μετά τη σημερινή ημέρα **οπουδήποτε στη Γη** (UTC+14), ώστε server σε UTC να μην αρνείται αποτύπωση Αθήνας στη 01:00 |
| `src/lib/terrain/publication/terrain-publication-contract.ts` | Πεδία multipart, τύπος, κλειστή λίστα 13 κωδικών, `refusalOfTerrainRejection` (εξαντλητικό `switch`) |
| `src/lib/listings/terrain-file-record.ts` | Αδελφός των `floorplan-`/`model-file-record` |
| `src/app/api/properties/[id]/terrain/route.ts` | Η πόρτα (`TERRAIN_DOOR`) |
| `listing-terrain-config.ts` | + όρια πηγής (8 MB, 100.000 σημεία, 2.000 breaklines, 5.000 κορυφές δακτυλίου, \|συντ.\| ≤ 10¹⁰ mm, όνομα ≤ 160) |
| `scripts/lib/listing-model-custody/material-doors-contract.js` | Γραμμή `MATERIAL_DOORS` (`refresh`, CHECK 3.76) |

**Αποφάσεις του Β3α**
- **Ο πελάτης στέλνει μετρήσεις, ο server ξαναχτίζει τα πάντα.** Οι parsers τρέχουν στον browser, όπου
  χρειάζονται ούτως ή άλλως για την προεπισκόπηση (Β4) και τον viewer (Β5). Μία μορφή εισόδου για τις δύο
  πόρτες. Ο parser του DXF **δεν** μεταφέρθηκε στον server, γιατί σέρνει μεγάλο μέρος του viewer.
- **Ο builder τρέχει ήδη στην πόρτα (ξηρή εκτέλεση).** Ό,τι δεν θα δημοσιευόταν ποτέ αρνείται με όνομα
  (`TERRAIN_INSUFFICIENT_SURFACE` / `_EMPTY_AFTER_CLIP` / `_TOO_DENSE`) όσο ο άνθρωπος είναι παρών, όχι
  σιωπηλά στο ψήσιμο. Η απάντηση επιστρέφει τα `stats` του **server** για επιβεβαίωση.
- **Ιδιωτική πηγή, παράγωγο από το ράφι** (μοτίβο ADR-845). Αποθηκεύεται η **κανονική** πηγή, ποτέ η ωμή
  του πελάτη (αφαιρούνται πεδία που κανείς δεν επικύρωσε). Δεν κρατιούνται κωδικοί ή αριθμοί σημείων.
  Όταν αλλάξει το `LISTING_TERRAIN_SNAPSHOT_VERSION`, το ράφι (Β3β) ξαναψήνει χωρίς τον ιδιοκτήτη.
- **Κατηγορία `DRAWINGS`, όχι νέα.** Το τοπογραφικό είναι τεχνικό παραδοτέο, με ίδια διάρκεια διατήρησης.
  Το `DRAWINGS` **δεν** είναι στις `PUBLISHABLE_CATEGORIES`, άρα η πηγή δεν βγαίνει από τη διαδρομή των
  φωτογραφιών. Μια νέα κατηγορία θα απαιτούσε, μέσω του `Record<FileCategory,…>`, αλλαγή στο
  `handover-disposition.ts` (ADR-916) και στα locales, που ανήκουν τώρα σε άλλη εργασία.
- **Μία ταυτότητα ανά ακίνητο** (`terrain/measured`): νέα δημοσίευση **διαδέχεται** την προηγούμενη
  (ISO 19650), με ίχνος στο ιστορικό του ακινήτου (`changes: terrain`, παλιά → νέα).
- **Μόνο γη** (Δ1): `isLandProperty` (ο ισχυρός κριτής). Ελέγχεται πριν διαβαστεί η πηγή.
- **Αναβλήθηκε συνειδητά**: η αποφυγή διπλής εγγραφής ίδιου περιεχομένου. Η ιδεμποτία ανά αίτημα
  (`Idempotency-Key`, `withAuth`) ήδη ισχύει· η διπλή εγγραφή ίδιου περιεχομένου θα ήθελε αλλαγή στον κοινό κορμό.

**Επαλήθευση**
- jest: `lib/terrain/publication` (4 σουίτες, 47 tests) και η πόρτα (16 tests). Μαζί με όλες τις σουίτες του
  `api/properties/[id]`: **18 σουίτες / 252 tests πράσινα**. Οι πόρτες κάτοψης και μοντέλου έμειναν ανέγγιχτες.
- **Μεταλλάξεις 5/5 κόκκινες**:
  - αποθήκευση της ωμής πηγής του πελάτη·
  - χωρίς έλεγχο γης·
  - χωρίς όριο συντεταγμένων·
  - κωδικός-φάντασμα στην πόρτα (άγκυρα Σ1)·
  - χωρίς ονομαστική άρνηση του builder.
- Πύλες: **3.76** ✅ (μετά τη γραμμή `MATERIAL_DOORS`) · 3.78 ✅ (82/110, αμετάβλητο) · 3.90 ✅ · 3.92 ✅ ·
  3.100 ✅ (`intent: 'write'`) · 3.17 ✅ · 3.47 ✅ · 3.28 (diff) ✅ 0 κλώνοι.
- ✅ Τα μηνύματα i18n των 13 κωδικών μπήκαν στο Β3β, με άγκυρα **Σ5** (§12). Το UI που τα δείχνει είναι Β4/Β5.

## 12. Β3β — το έδαφος στη δημόσια αγγελία *(2026-10-23)*

**Ροή**
```
πόρτα (Β3α) ─▶ ιδιωτική πηγή (DRAWINGS · application/json · public · publicationIdentity 'terrain/measured')
επαναπροβολή ─▶ listing-media-sources: createTerrainResolver ─ currentTerrainSource (μόνο γη · νεότερο νικά)
             ─▶ publish-public-listing-shelf: partition 'terrain' ─▶ reconcilePublicTerrainShelf (παράλληλο κεφάλι)
                  readPrivateOrigin → bakeListingTerrain (ΞΑΝΑΧΤΙΖΕΙ από την κανονική πηγή) → gzip → ράφι
             ─▶ withPublishedTerrain (ο ΕΝΑΣ binder) ─▶ PublicListing.terrain: SourcedAttribute<ListingTerrain> | null
```

**Αρχεία**

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/terrain/publication/listing-terrain-card.ts` | `ListingTerrainCard` (έκδοση στιγμιοτύπου, stats, ισοδιάσταση, όγκος `volume\|footprint\|omitted\|null`, survey). **Μία** παραγωγή (`listingTerrainCardOf`), **ένας** αναγνώστης (`readListingTerrainCard`, κρίνει το survey με το υπάρχον `readTerrainSurveyDeclaration`) |
| `src/types/public-listing.ts` | `ListingTerrain extends ListingTerrainCard { url }` · `PublicListing.terrain` |
| `public-listing-shape-judges.ts` · `public-listing-migrations-21-30.ts` · `public-listing-schema.ts` | `readStoredTerrain` (βαθύς, μόνο `measured`, ποτέ προεπιλογή) · **κρίκος 26** (`adds: ['terrain']`) · έκδοση σχήματος **26** |
| `listing-disclosure.ts` · `public-listing-projection.ts` | `terrain: 'media'` · η καθαρή προβολή γράφει `null` |
| `listing-material.ts` · `public-listing-gallery-projection.ts` | είδος υλικού `'terrain'` (**όχι** δηλώσιμο από ιδιοκτήτη) · ονομαστική άρνηση στη γκαλερί |
| `src/services/listings/terrain.reader.ts` | `currentTerrainSource` (καθαρό) + `createTerrainResolver`: ερώτημα **μόνο ισοτήτων** (ίδιο με το `findSupersededMaterial`), φίλτρο ταυτότητας `TERRAIN_PUBLICATION_IDENTITY` · JSON · `public` · παραδοτέο |
| `public-shelf-encoding.ts` · `storage-path-public-shelf.ts` · `public-shelf-kinds.ts` · `public-shelf-terrain-kind.ts` | `TerrainShelfEncoding` (συνταγή `json:terrain-s{v}-w{v}`) · επέκταση `json` · είδος `LISTING_TERRAIN_SHELF` |
| `public-shelf-terrain-bake.ts` · `public-shelf-terrain.service.ts` · `public-shelf-bucket.ts` | ψήσιμο (καθαρό + `zlib`) · κεφάλι πάνω στα `readPrivateOrigin`/`reconcileOnePerSource` · `contentEncoding: 'gzip'` |
| `public-listing-terrain-projection.ts` · `listing-shelf-projected.ts` · `publish-public-listing-shelf.ts` | ο binder (`LISTING_TERRAIN_SOURCE_REF = 'property-terrain:measured'`) · οι μεταφραστές `toProjected*` **εξήχθησαν αυτούσιοι** (N.7.1) + `toProjectedTerrain` · ενορχήστρωση, αντιστάθμιση, απόσυρση |
| `scripts/check-listing-terrain-authority.js` · `.listing-terrain-authority.json` · `docs/gates/3.105.md` | **CHECK 3.105** (παρακάτω) |
| `property-market.json` (el/en) | `terrainPublication.refusals.<CODE>` — 13 μηνύματα |

**Αποφάσεις του Β3β**
- **Το ράφι ξαναχτίζει, δεν αντιγράφει.** Ο ψήστης διαβάζει την **κανονική** πηγή που αποθήκευσε η πόρτα και τρέχει
  ξανά τον builder του Β2. Δημόσιο γίνεται μόνο το παράγωγο (Δ2). Αλλαγή του `LISTING_TERRAIN_SNAPSHOT_VERSION`
  αλλάζει τη συνταγή ⇒ νέο κλειδί ⇒ ξαναψήσιμο χωρίς τον ιδιοκτήτη.
- **Κλειδί = sha256 των ΑΣΥΜΠΙΕΣΤΩΝ bytes, μεταφορά gzip.** Το κλειδί δεν εξαρτάται από το επίπεδο συμπίεσης· ο
  browser αποσυμπιέζει διαφανώς (`Content-Encoding: gzip`).
- **Η κάρτα κρατιέται στα metadata του αντικειμένου.** Στο cache hit ούτε κατεβαίνει ούτε ξαναψήνεται τίποτα· κάρτα
  που δεν διαβάζεται ⇒ ξαναψήσιμο, ποτέ σιωπηλή προεπιλογή.
- **Ένας γραφέας**: το `PublicListing.terrain` το γράφει **μόνο** το `withPublishedTerrain`, από την αναφορά του ραφιού.
  Κενή αναφορά (απόσυρση · άρνηση ψήστη) ⇒ `null`, ποτέ το παλιό έδαφος.

**Αποκλίσεις από το πλάνο (ο κώδικας κερδίζει)**
- `terrain: 'media'` στη γνωστοποίηση, **όχι** στο `UNASKED_LISTING_ATTRIBUTES`: εκεί μπαίνουν μόνο πεδία `'attribute'`.
- Αναγνώστης **ταυτότητας** (`publicationIdentity`) αντί για το `agencyMediaMaterial`: η πηγή είναι `DRAWINGS`, εκτός
  `PUBLISHABLE_CATEGORIES`, άρα η διαδρομή των φωτογραφιών δεν θα την έβλεπε ποτέ — επίτηδες (§11).
- Άγκυρα μηνυμάτων **Σ5**, όχι Σ3: το Σ3 είναι ήδη η αντιστοίχιση απορρίψεων του builder.
- Το `publish-public-listing-shelf.ts` θα ξεπερνούσε τις 500 γραμμές ⇒ εξαγωγή των μεταφραστών στο
  `listing-shelf-projected.ts` (αυτούσιοι, χωρίς αλλαγή σημασιολογίας).

**CHECK 3.105 — ένας γραφέας του εδάφους της αγγελίας** (Α7)
- **Κ1**: `terrain: { provenance … }` ή χρήση του `LISTING_TERRAIN_SOURCE_REF` μόνο στον binder· `terrain: readStoredTerrain(…)`
  μόνο στον κρίκο 26. Το κριτήριο είναι το **σχήμα** (`SourcedAttribute`), όχι η λέξη: το συντακτικό «`terrain:` όχι
  null» μετρήθηκε με **4** ψευδώς θετικά (σώμα απάντησης της πόρτας · `'media'` · destructuring · BIM), που έγιναν δίδυμα.
- **Κ2**: `buildPublishedTerrainFileRecord` μόνο σε πόρτα με `refresh` στο `MATERIAL_DOORS` — **διαβάζεται** από εκεί,
  χωρίς αντίγραφο. Η 3.76 βλέπει όποιον καλεί τον κορμό· δεν βλέπει όποιον χτίζει την εγγραφή και τη γράφει αλλιώς.
- **Κ3**: `buildListingTerrainSnapshot` / `listingTerrainCardOf` έξω από `src/lib/terrain/` μόνο στην πόρτα (ξηρή
  εκτέλεση) και στον ψήστη. **Κ4**: λόγος ≥ 40, νεκρές δηλώσεις, source-drift.
- **Μηδέν διπλότυπο με τη 3.76**: τον **έναν καλούντα** του `withPublishedTerrain` τον φυλά η 3.76 (`GUARDED_SYMBOLS`
  + άγκυρα «ADR-920 Β3β — ΤΟ ΕΔΑΦΟΣ…» στο `REQUIRED_ANCHORS`).
- **Μηδέν δίδυμο με τη 3.104**: το CHECK 3.28 (jscpd --diff) βρήκε τον σκελετό των δύο πυλών διπλό. Εξήχθη στο
  `scripts/lib/write-authority/gate-runner.js` (`defineRegistryGate`: σάρωση με προφίλτρο → κρίση μητρώου → κατάστιχο →
  παράκαμψη), και στο `ast.js` μπήκαν `trailingName` · `calleeName` · `walk` · `callSiteOf`. Κάθε πύλη κρατά μόνο ό,τι τη
  διαφοροποιεί. Μετά: **0 κλώνοι σε 21 αρχεία**, και οι δύο σουίτες πράσινες.

**i18n (Β3β.4)**: namespace **`property-market`** — η πόρτα ανήκει στο ακίνητο και η φόρμα Β4 το φορτώνει ήδη. Ο
viewer (Β5) θα το φορτώνει **μόνο όταν ανοίγει** ο διάλογος δημοσίευσης εδάφους (240 KB, έναντι 450 KB του
`dxf-viewer-shell` που ήδη φορτώνει)· νέο namespace για 13 μηνύματα θα άγγιζε 5 κοινά αρχεία i18n. **Κανένας αριθμός
στο κείμενο**: τα όρια μπαίνουν ως ICU `{maxMegabytes}` · `{maxPoints}` · `{maxTriangles}`, με τιμές από το
`listing-terrain-config` (η κάτοψη γράφει «20 MB» στο κείμενο· εδώ δεν επαναλήφθηκε).

**Επαλήθευση**
- jest: 171 σουίτες / 3.058 tests (listings · terrain · upload · owner-property · mandate · properties)· τα 6 που έπεσαν
  στο μεγάλο πέρασμα ήταν timeouts φόρτου και πέρασαν μόνα τους. Σουίτες πυλών 3.105 + 3.104 + 3.76: 45/45 · 3.66: 16/16.
- **Μεταλλάξεις 18/18 κόκκινες**: κρίκος/σχήμα/ράφι/binder/απόσυρση **9/9** · πύλη 3.105 **4/4** (ξεδίπλωμα `as` ·
  `exempt` ως πόρτα · δείκτης προέλευσης · σιωπηλός binder) · άγκυρα 3.76 **1/1** · Σ5 **4/4** (κωδικός χωρίς en ·
  ορφανό el · «60.000» αντί για `{maxTriangles}` · ασυμφωνία placeholders).
- Πύλες: 3.105 ✅ · 3.104 ✅ · 3.76 ✅ · 3.74 ✅ · 3.80 ✅ · 3.91 ✅ (κανένα σημείο του εδάφους· τα 12 Κ2 είναι παλιά, εντός
  baseline) · 3.17 ✅ · 3.28 ✅ · 3.22 ✅ · 3.47 ✅ · 3.62 ✅ · 3.9 ✅ · 3.33 ✅ · 3.34 ✅ · 3.36 ✅ · 3.71 ✅ · 3.66 ✅ ·
  3.49 ✅ · 3.53 ✅. Τελικό jest: 135 σουίτες / 2.600 tests (terrain · listings · upload · `api/properties/[id]` · πύλες).

⚠️ **Γνωστός περιορισμός**: όταν αλλάξει η έκδοση του στιγμιοτύπου, το έδαφος ξαναψήνεται στην **επόμενη επαναπροβολή**
της αγγελίας ή με `POST /api/admin/rebuild-public-listings`. Το νυχτερινό πέρασμα **δεν** το πιάνει, γιατί το
αποτύπωμα των μέσων περιλαμβάνει τις πηγές, όχι τη συνταγή. Ίδιο ισχύει για το μοντέλο (ADR-845). → **Λύθηκε στο §14.9 Γ** (αποτύπωμα v3 με συνταγές, για όλα τα ράφια).
⚠️ **Αμέτρητο ζωντανά**: χρειάζεται deploy + `rebuild-public-listings` για να γραφτεί ο κρίκος 26 στις υπάρχουσες αγγελίες.

## 13. Β4 — εισαγωγή τοπογραφικού από τον ιδιοκτήτη *(σε εξέλιξη, 2026-10-23)*

**Ευρήματα του audit που άλλαξαν το brief**
- Οι αγγελίες ιδιοκτήτη ζουν στο `owner_properties` (`ownp_*`)· η πόρτα του Β3α κρίνει μόνο `properties` ⇒ θα
  απαντούσε 404. **Απόφαση** (πρακτική των μεγάλων, Giorgio 2026-10-23): **δεύτερη πόρτα**
  `POST /api/owner-properties/[ownerPropertyId]/terrain` πάνω στον **ΕΝΑ** κορμό του ADR-909, γενικευμένο με «θύρα
  υποκειμένου» (εταιρικό ακίνητο | ακίνητο ιδιοκτήτη) — όχι δεύτερος κορμός.
- Η δημοσίευση ιδιοκτήτη (`republishOwnerProperty` → `writeWithShelf`) περνά **ήδη** από το ίδιο ράφι
  (partition `terrain` → `reconcilePublicTerrainShelf` → `withPublishedTerrain`). Λείπει μόνο η πηγή εδάφους στο
  `ownerListingMediaSources`, από τον φάκελο του ακινήτου (`files_personal`, ADR-866) ⇒ κανένα δεύτερο κεφάλι ή binder.
- ✅ ~~Το `match /files_personal` δεν έχει `publicationBornAbsent()` / `publicationCustodyUnchanged()`~~ — **έκλεισε στο Β4.6**
  (§13.5), πριν η γραμμή ιδιοκτήτη (Β4.4) αρχίσει να εμπιστεύεται αυτά τα πεδία.
- Τίποτα δεν ξαναπροβάλλει αγγελία ιδιοκτήτη όταν αλλάζει αρχείο φακέλου ⇒ η πόρτα ιδιοκτήτη καλεί η ίδια την επαναπροβολή.
- **Έρευνα web**: Revit = μόνο CSV με X/Y/Z πρώτες στήλες, **σιωπηλή** αραίωση πάνω από 10.000 σημεία· ArchiCAD = στήλες
  κατά θέση, χωρίς αντιστοίχιση· Forma = έδαφος μόνο από OBJ/IFC. Εμείς: DXF + CSV + XLSX, αυτόματη αναγνώριση στηλών
  με διόρθωση, πρόταση μονάδων από το μέγεθος, ρητή αναφορά ορίων, προεπισκόπηση με την **ίδια** ετυμηγορία του server.

**Υποβήματα**: Β4.1α parsers πινάκων → `lib` · Β4.1β DXF scanner → `lib` · Β4.2 καθαρός κριτής/πηγή/προέλεγχοι/μονάδες/
μοντέλο SVG · Β4.3 γενίκευση κορμού · Β4.4 η γραμμή ιδιοκτήτη επιλέγει την πηγή · Β4.5 πόρτα ιδιοκτήτη · Β4.6 κανόνες
`files_personal` · Β4.7 client/θύρες/hook · Β4.8 προεπισκόπηση · Β4.9 ενότητα «Βελτίωσε την αγγελία» + Δ2 ·
Β4.10 φόρμα δημιουργίας · Β4.11 ADR.

### 13.1 Β4.1α — οι parsers πινάκων στο `src/lib/terrain/survey-import/` ✅
- Μετακινήθηκαν αυτούσια (μοτίβο Β1, `export *` από τις παλιές διαδρομές του viewer): `topo-import-types` ·
  `topo-text-lines` · `topo-delimited-reader` · `topo-excel-reader` (`exceljs` MIT, δυναμικό import) ·
  `topo-column-mapping` · `topo-column-sniffer` · `topo-order-presets`. Το `TopoPoint` από το
  `@/lib/terrain/terrain-types`. Κανένας καταναλωτής του viewer δεν άλλαξε.
- ⚠️ **Το `parse-topo-points` (ο δρόμος «χωρίς οδηγό») μένει στον viewer.** Δεν έχει καταναλωτή στη ρίζα, και το
  CHECK 3.19 (knip — ο viewer είναι χωριστό workspace, το `export *` του δεν μετρά ως χρήση) το είδε ως νεκρό αρχείο.
  Μετακινείται όταν αποκτήσει καταναλωτή (Β4.7), όχι πριν. Πατά ήδη στα `topo-column-mapping`/`topo-text-lines` του
  `lib`, άρα η ερμηνεία των κελιών μένει μία.
- **Η μία αλλαγή σημασίας**: ο κριτής «αριθμητικό κελί» της αναγνώρισης επικεφαλίδων ήταν το `normalizeNumber` του
  viewer (το `lib` δεν εισάγει από το subapp). Έγινε το `parseTopoField`, ο **ίδιος** κριτής με τον sniffer και τον
  αντιστοιχιστή ⇒ γραμμή = «δεδομένα» ακριβώς όταν τη διαβάζει ο αντιστοιχιστής. Απορρίφθηκε το `parseLocaleNumber`:
  αφαιρεί γράμματα, άρα το «P1» θα γινόταν ο αριθμός 1 και η επικεφαλίδα δεδομένα.
- 🔴 **Προϋπάρχον σφάλμα που διορθώθηκε (N.0.2)**: σε ελληνικό CSV του Excel (`345678,123;4201234,456;125,30`) το
  `detectDelimiter` διάλεγε το **κόμμα** (4 κελιά έναντι 3 του `;`) ⇒ το αρχείο διαβαζόταν σκουπίδια, σιωπηλά. Νέος
  όρος **καθαρότητας κελιών** (`cellPurity`, η ιδέα του `csv.Sniffer`): διαχωριστικό του οποίου τα κελιά περιέχουν ακόμη
  άλλο υποψήφιο δεν δόμησε τη γραμμή· κελί που διαβάζεται ως αριθμός μετρά καθαρό (εκεί το κόμμα είναι υποδιαστολή).
- **Επαλήθευση**: jest 69 σουίτες / 683 tests (όλο το `systems/topography` μέσω shims + `bim/table/import` + panels +
  νέα σουίτα `lib/terrain/survey-import/__tests__/survey-import-lib.test.ts`: όριο «κανένα import από `subapps/`» σε
  **όλο** το `src/lib/terrain`, ελληνικό `;`, «P1» επικεφαλίδα, συμφωνία με `parseTopoField`). Μεταλλάξεις **4/4
  κόκκινες** (καθαρότητα πάντα 1 · υποδιαστολή «ακάθαρτη» · κάθε κελί αριθμός · import από subapp). Πύλες: 3.62 ✅
  (0 αδήλωτες, 391 αμετάβλητο) · 3.28 ✅ (0 κλώνοι, 17 αρχεία) · 3.47 ✅.

### 13.2 Β4.1β — σημεία DXF χωρίς τον viewer ✅
- **Γιατί**: το `topo-dxf-points` διάβαζε μέσω του `DxfEntityParser`, που σέρνει ~359 αρχεία του subapp. Νέος καθαρός
  **`src/lib/terrain/survey-import/dxf-survey-points.ts`** πάνω στα **ίδια** φύλλα που χρησιμοποιεί ο parser του
  viewer, μετακινημένα στο **`src/lib/dxf/`** με re-export: `dxf-section-scan` · `dxf-line-stream` ·
  `dxf-embedded-object` (μένουν φύλλα **χωρίς imports**, ADR-736) + νέο `dxf-insunits` (ο πίνακας `INSUNITS_TO_MM`,
  επανεξάγεται από το `dxf-parser-types`).
- **Δύο φάσεις**: `scanDxfSurvey` → σημεία σε **μονάδες σχεδίου** + `declaredInsunits` (`null` = το αρχείο δεν λέει·
  `0` = «χωρίς μονάδες», τιμή)· `scaleSurveyPoints` → mm. Η πολιτική μονάδων είναι του **καλούντα**: ο viewer κρατά
  τις ιστορικές του προεπιλογές (`0` → m · απόν → mm), η φόρμα του ιδιοκτήτη θα **ρωτά** όταν το αρχείο δεν λέει.
- **Ισοδυναμία αποδεδειγμένη πρώτα**: 11 tests χαρακτηρισμού γράφτηκαν και πέρασαν **πάνω στον παλιό κώδικα** (χωρίς
  `$INSUNITS` ⇒ mm · `0` ⇒ m · BLOCKS αγνοούνται · χωρίς ENTITIES ⇒ όλο το αρχείο · τομή στο `101` · τελευταία τιμή
  νικά · ομάδα POLYLINE · CRLF · ελληνική υποδιαστολή στην ετικέτα) και ξαναπέρασαν **αμετάβλητα** μετά. Άγκυρα «δύο
  αναγνώστες του `$INSUNITS`, μία απάντηση»: `readDxfInsunits ?? 4 ≡ parseHeader().insunits`.
- 🔴 **Τρία προϋπάρχοντα σφάλματα διορθώθηκαν (N.0.2)**, όλα σιωπηλά:
  - εκθέτης σε DXF real: το `parseLocaleNumber` αφαιρεί γράμματα ⇒ `1.5E+02` → **1,502**. Τώρα `Number` πρώτα, με τον
    τοπικό αναγνώστη μόνο ως εφεδρεία για χειροποίητα αρχεία·
  - `$INSUNITS 17` = γιγάμετρα (10¹² mm), όχι «ναυτικό μίλι» (1.852.000)·
  - `$INSUNITS 21–24` (US survey feet / inch / yard / mile) **έλειπαν** ⇒ 1 mm ανά μονάδα. Πηγή: πίνακας `INSUNITS`
    AutoCAD + BricsCAD. Ο **μόνος** καταναλωτής του πίνακα είναι ο εξαγωγέας σημείων ⇒ καμία εισαγωγή σχεδίου δεν άλλαξε κλίμακα.
- **Επαλήθευση**: jest **199 σουίτες / 2.084 tests** (`lib/terrain` · `lib/dxf` · `systems/topography` · `utils` · `io` ·
  `bim/table/import` · panels). Μεταλλάξεις **7/7 κόκκινες** (εκθέτης · 101 όχι τομή · σάρωση BLOCKS · 17 ξανά
  1.852.000 · δηλωμένο 0 ως απόν · viewer: `0` ως mm · επίπεδο σημείο παίρνει z = 0). Πύλες: 3.28 ✅ (0 κλώνοι, 13
  αρχεία) · 3.62 ✅ (0/391) · 3.47 ✅ · 3.80 ✅ (0 νέοι θανάσιμοι κύκλοι). Το test ορίου σαρώνει πλέον και το `src/lib/dxf`.

### 13.3 Β4.2 — ο καθαρός πυρήνας της εισαγωγής ✅
| Αρχείο | Ρόλος |
|---|---|
| `publication/listing-terrain-judge.ts` | **`judgeListingTerrainSource`** — η **ΜΙΑ** ετυμηγορία: σχήμα → `TERRAIN_SOURCE_MALFORMED`, επιφάνεια → το όνομα του builder. Επιστρέφει την **κανονική** πηγή + το στιγμιότυπο. Την καλεί **ήδη** η πόρτα του Β3α (σχήμα ⇒ 400, επιφάνεια ⇒ 422, όπως πριν) και θα την καλεί η προεπισκόπηση |
| `survey-import/survey-upload-preparation.ts` | `prepareSurveyUpload(points)` → ακριβώς το σώμα που θα σταλεί (`encodeListingTerrainSource`), με την ετυμηγορία της πόρτας και το όριο bytes της· `surveySourceOf` (σημείο χωρίς Z μένει `[x, y]`)· **`surveyFactsOf`** |
| `survey-import/survey-units.ts` | `suggestSurveyUnit` → `{ unit, evidence: 'greek-grid' \| 'extent' }` ή `null` |
| `survey-import/survey-file-kind.ts` | `surveyFileKindOf(name, head)` — τα bytes αποφασίζουν (ZIP ⇒ xlsx · OLE2 ⇒ `xls-legacy` · `AutoCAD Binary DXF` ⇒ `dxf-binary` · δομή `0/SECTION` ⇒ dxf ακόμη κι αν λέγεται `.txt`) |
| `@/lib/geo/greek-grid.ts` | + `GREEK_GRID_AREA_OF_USE_M` / `isWithinGreekGridAreaOfUse` — η περιοχή χρήσης του **EPSG:2100** από το μητρώο EPSG (E 94.874,71–892.934,13 · N 3.859.448,36–4.631.226,44 m) |

**Αποφάσεις του Β4.2**
- **Μία ετυμηγορία, δύο καλούντες.** Η πόρτα δεν καλεί πλέον τον builder απευθείας ⇒ η δήλωσή της στο
  `derivationOwners` της 3.105 **αφαιρέθηκε** (αλλιώς Κ4: νεκρή δήλωση). Μένει ένας κάτοχος παραγωγής: ο ψήστης.
  *(Απόκλιση από την §12 Κ3, ο κώδικας κερδίζει: η ξηρή εκτέλεση ζει πλέον μέσα στο `src/lib/terrain/`.)*
- **Ό,τι οι μεγάλοι λύνουν σιωπηλά, εμείς το λέμε.** Το TIN κρατά το **πρώτο** από δύο σημεία στην ίδια θέση (το
  Revit το ψηλότερο). Στην κανονική πηγή (ακέραια mm) «ίδια θέση» = ακριβώς ό,τι συγχωνεύει το TIN ⇒ μετριούνται τα
  `coincident` και, χωριστά, τα `conflictingElevations` (ίδια θέση, άλλο υψόμετρο: αντίφαση της μέτρησης).
- **Πρόταση μονάδων με αιτιολόγηση, ποτέ σιωπηλή.** Revit και ArchiCAD ρωτούν πάντα τη μονάδα, αλλά δεν λένε τι
  δείχνει το αρχείο. Εμείς: ≥ 90 % των σημείων μέσα στην περιοχή χρήσης του ΕΓΣΑ'87 (ως m ή mm) ⇒ `greek-grid`·
  αλλιώς η διαγώνιος του οικοπέδου (2–3.000 m) ⇒ `extent`· όπου ισχύουν και οι δύο αναγνώσεις ⇒ `null`, αποφασίζει ο
  άνθρωπος. Πόδια δεν προτείνονται ποτέ (ένα ξένο DXF τα δηλώνει μόνο του).
- Αφαιρέθηκε πρώιμος έλεγχος αριθμού σημείων: έδινε το **ίδιο** αποτέλεσμα με το όριο του σχήματος (καμία μετάλλαξη
  δεν τον σκότωνε ⇒ νεκρός κώδικας).
- **Το μοντέλο SVG μεταφέρθηκε στο Β4.8**, μαζί με τον πρώτο του καταναλωτή (αλλιώς νεκρά exports, CHECK 3.22).
  ⚠️ Οι υπόλοιπες εξαγωγές του Β4.2 αποκτούν καταναλωτή στο Β4.7 (hook), όπως έγινε στο Β2.

**Επαλήθευση**: jest **84 σουίτες / 1.111 tests** (`lib/terrain` · `lib/geo` · όλο το `api/properties/[id]` ·
πύλες 3.105 + 3.76). Μεταλλάξεις **7/7 κόκκινες** (άρνηση builder ως MALFORMED · πόρτα: MALFORMED ως 422 · κάθε
σύμπτωση ως αντίφαση · επίπεδο σημείο με z = 0 · ένα outlier ακυρώνει το ΕΓΣΑ · το όνομα αποφασίζει αντί για τα
bytes · όριο northing αγνοείται). Πύλες: 3.28 ✅ · 3.62 ✅ · 3.47 ✅ · 3.105 ✅ · 3.76 ✅ · 3.100 ✅ · 3.92 ✅ · 3.66 ✅
(αναπαραγωγή του πίνακα στο `CLAUDE.md`: μόνο το αποτύπωμα).

### 13.4 Β4.3+5 — ένας κινητήρας, δύο κηδεμονίες ✅
**Απόφαση (Giorgio 2026-10-23)**: τα Β4.3 (γενίκευση κορμού) και Β4.5 (πόρτα ιδιοκτήτη) **ενώθηκαν** σε ένα βήμα τριών
φάσεων: η θύρα υποκειμένου επικυρώνεται μόνο από τον **δεύτερο** καταναλωτή της, αλλιώς σχεδιάζεται στα τυφλά και ο
κλάδος του ιδιοκτήτη μένει νεκρός (CHECK 3.22). Σειρά: **α** κινητήρας · **β** κοινός κώδικας εδάφους · **γ** πόρτα
ιδιοκτήτη. Η πόρτα γράφει με Admin SDK, άρα δεν εξαρτάται από τους κανόνες· το Β4.6 (`files_personal`) μπαίνει **πριν**
το Β4.4, όπου η γραμμή ιδιοκτήτη αρχίζει να εμπιστεύεται τα πεδία δημοσίευσης.

| Αρχείο | Ρόλος |
|---|---|
| `src/server/listing-material/publish-listing-material.ts` | **Ο κινητήρας**: η σειρά του ADR-909 (ανάγνωση → `revision` → εγγραφή → προκάτοχοι → bytes → `ready` → διαδοχή → δήλωση → επαναπροβολή) πάνω σε `ListingMaterialSubject<TEnv, TBirth>` + `ListingMaterialDoor<…>` |
| `src/server/listing-material/material-source-lookup.ts` | Μετακίνηση αυτούσια από το `_shared/` (εταιρικά σχέδια και προκάτοχοι) |
| `src/server/listing-material/material-supersession.ts` | Μετακίνηση· το `archiveSuperseded` παίρνει **έτοιμο** `ContainerActor` αντί για `AuthContext` |
| `src/app/api/properties/[id]/_shared/publish-property-material.ts` | Το **εταιρικό υποκείμενο**: φρουρός μισθωτή + `mayChangePublication` + γέννηση με `companyId` + `refreshListingAfterMediaChange`. Η υπογραφή `publishPropertyMaterial(request, ctx, door)` **δεν άλλαξε** |

**Αποφάσεις της φάσης α**
- **Η συλλογή δεν είναι πεδίο της θύρας: προκύπτει από τον δράστη.** Ο `transitionContainer` διαλέγει ήδη συλλογή και
  κριτή από το `actor.custody`· η εγγραφή ρωτά το **ίδιο** πεδίο (`COLLECTIONS[FILE_COLLECTION[custodyKindOfScope(…)]]`,
  γραμμένο στο σημείο κλήσης, όπως το θέλουν οι 3.15/3.35). Ένα χωριστό `filesCollection` (πρόταση του handoff) θα ήταν
  δεύτερη απάντηση στο «σε ποιον ανήκει;»: το υλικό θα μπορούσε να γεννηθεί στο `files` και η διαδοχή να ψάξει στο
  `files_personal`. Το ίδιο και το `createdBy`: είναι το `actor.uid`.
- **Η γέννηση είναι γενική (`TBirth`) και την παρέχει το υποκείμενο** (`birthOf(sourceRevisions)`). Το `MaterialBirth`
  των πορτών μοντέλου/κάτοψης/εδάφους έμεινε **αμετάβλητο**.
- **Η επαναπροβολή είναι υποχρεωτικό σκέλος του υποκειμένου** (`refresh`), με τύπο `ListingMediaRefreshOutcome`, ώστε
  κανένα υποκείμενο να μην μπορεί να την παραλείψει. Κάθε υποκείμενο ονομάζει στατικά τον βοηθό του (CHECK 3.76).
- **Η εταιρική πόρτα κρίνεται πριν διαβαστεί το σώμα**, όπως πριν: ξένο ακίνητο δεν πληρώνει την ανάγνωση megabytes.
- Μητρώα: `MATERIAL_DOORS` (3.76): η γραμμή `exempt` της διαδοχής μετακόμισε στη νέα διαδρομή, με λόγο που ονομάζει
  τον κινητήρα· self-test 3.105: `EXEMPT_DOOR` στη νέα διαδρομή. Τα `model/route.ts` και `terrain/route.ts` άλλαξαν **μόνο**
  τη γραμμή εισαγωγής του `readSceneFileIds`.

**Επαλήθευση**: jest `api/properties/[id]` **18 σουίτες / 264 tests πράσινα χωρίς αλλαγή** · νέα άγκυρα
`server/listing-material/__tests__/publish-listing-material.test.ts` (6 tests: προσωπικός δράστης ⇒ `files_personal` ·
εταιρικός ⇒ `files` · ίδιος δράστης γράφει και αρχειοθετεί · γέννηση από το υποκείμενο · σειρά · αποτυχία ⇒ καμία
διαδοχή/επαναπροβολή). Μεταλλάξεις **4/4 κόκκινες** (συλλογή πάντα `files` · επαναπροβολή πριν τη δήλωση · διαδοχή με
άλλον δράστη · `createdBy` όχι από τον δράστη). Πύλες: 3.76 ✅ (ζωντανή + 42 tests) · 3.105 ✅ (ζωντανή + 14) · 3.28 ✅
(0 κλώνοι) · 3.47 ✅.

**Φάση β — ο κοινός κώδικας εδάφους** ✅

| Αρχείο | Ρόλος |
|---|---|
| `src/server/listing-terrain/terrain-upload.server.ts` | **Νέο.** `readTerrainUpload(formData, propertyType)` (αρχείο → δήλωση Δ2 → «είναι γη;» → ο ΕΝΑΣ κριτής → κανονική πηγή) · `terrainMaterialDoor<TEnv, TBirth>({ propertyTypeOf, recordOf, recordPublished })` · `TERRAIN_DOOR_CODES` · `terrainResponseOf` · `terrainPublishedFacts` · τύποι `TerrainUpload` / `TerrainPublicationResponse` |
| `src/lib/listings/terrain-file-record.ts` | `PublishedTerrainFileRequest = { home, createdBy, sourceRevisions }`· **`TerrainSourceHome`** = `{ companyId, propertyId }` \| `{ userId, dossierId }` — ο τύπος **ζευγαρώνει** κάτοχο και δοχείο (`PROPERTY` ή `PROPERTY_DOSSIER`). Ίδια ταυτότητα, κατηγορία, διαβάθμιση |
| `src/app/api/properties/[id]/terrain/route.ts` | 212 → 114 γρ.: μένουν μόνο ό,τι είναι του γραφείου — φρουρός μισθωτή (κυριολεκτικό `intent: 'write'`, 3.100), γέννηση με `home: { companyId, propertyId }` (3.105 Κ2), ιστορικό `EntityAuditService` |

**Αποφάσεις της φάσης β**
- **Η πηγή του ιδιοκτήτη ΔΕΝ φαίνεται σε καρτέλα του φακέλου** (επαληθευμένο με τις πραγματικές εμβέλειες,
  `propertyDossierFileTabOf`, για οικόπεδο και κατοικία). Είναι κανονικό JSON του διακομιστή, όχι έγγραφο του ανθρώπου:
  στα «Έγγραφα» θα μετονομαζόταν ή θα μεταφερόταν σαν οποιοδήποτε αρχείο χωρίς να το μάθει η επαναπροβολή. Η ορατή
  διαχείριση (αφαίρεση τοπογραφικού, φύλαξη του αρχικού DXF/CSV) μένει ανοιχτή ερώτηση (§4 του handoff).
- **Η γενίκευση του `currentTerrainSource` μεταφέρθηκε στο Β4.4**, μαζί με τον δεύτερο καταναλωτή της (τον επιλογέα του
  φακέλου). Ίδια αρχή με την ένωση Β4.3+5: καμία γενίκευση χωρίς δεύτερο καταναλωτή (CHECK 3.22).
- Η άγκυρα Σ1/Σ2 του συμβολαίου διαβάζει πλέον **την ένωση** των πηγών που στέλνουν κωδικούς (πόρτα + κοινός αναγνώστης).
  Αλλιώς ένας κωδικός που μετακόμισε θα έμοιαζε φάντασμα, ή ένας νέος κωδικός στον κοινό αναγνώστη θα περνούσε αόρατος.
- **Κενό ελέγχου που έκλεισε**: η σουίτα της εταιρικής πόρτας δεν ρωτούσε τον **κάτοχο** της εγγραφής. Μετάλλαξη
  «η εταιρική πόρτα γεννά στον φάκελο» επέζησε· η Τ2 ελέγχει τώρα `companyId` + `entityType: property` και απουσία `userId`.

**Επαλήθευση φάσης β**: jest 26 σουίτες / 330+ tests (πόρτες `api/properties/[id]` · `lib/terrain/publication` · κινητήρας ·
νέα `lib/listings/__tests__/terrain-file-record.test.ts` · ράφι/αναγνώστης εδάφους). Μεταλλάξεις **5/5 κόκκινες** (φάκελος ως
`PROPERTY` · πηγή σε καρτέλα «Έγγραφα» · χωρίς έλεγχο γης · κωδικός-φάντασμα στον κοινό αναγνώστη · εταιρική πόρτα γεννά στον
φάκελο). Πύλες: 3.105 ✅ · 3.76 ✅ · 3.100 ✅ · 3.47 ✅ · 3.28 ✅ (0 κλώνοι).

**Φάση γ — η πόρτα του ιδιοκτήτη** ✅

| Αρχείο | Ρόλος |
|---|---|
| `src/server/listing-material/publish-owner-property-material.ts` | **Νέο. Το υποκείμενο του ιδιοκτήτη**: `publishOwnerPropertyMaterial(request, actor, ownerPropertyId, door)`. Φρουρός `mayAdminister` (ξένη ⇒ 404 **πριν** το σώμα) → προσωπική κηδεμονία + `dossierId` + φάκελος **του ίδιου** ανθρώπου (αλλιώς 409 `TERRAIN_NO_DOSSIER`) → δράστης `personalContainerActorOf` · `readSourceRevisions → []` · προκάτοχοι στον φάκελο · `refreshOwnerListingAfterMediaChange` |
| `src/app/api/owner-properties/[ownerPropertyId]/terrain/route.ts` | **Νέο.** `withHeavyRateLimit(withPersonalOrOrgAuth(…))` (ιδεμποτία από το σύνορο, 3.92). Γέννηση `home: { userId, dossierId }` γραμμένη **εδώ** (3.105 Κ2) · ιστορικό `owner_property` / πεδίο `terrain` στο βιβλίο του χώρου του ανθρώπου (`auditLedgerScopeOf(custodyWorkspace(…))`) |
| `src/server/listing-material/material-source-lookup.ts` | `findSupersededDossierMaterial`: ακριβώς τα σκέλη του `readDossierMedia` (`userId · entityType · entityId · status=ready`) + κάδος **στη μνήμη** ⇒ **0 νέα ευρετήρια**. Το σώμα «ερώτημα → `supersededByPublication` → ονομασμένη αποτυχία» είναι πλέον **ένα** (`supersededAmong`) για τα δύο δοχεία |
| `src/services/listings/listing-media-refresh.ts` | `refreshOwnerListingAfterMediaChange(adminDb, ownerPropertyId, userId)`: διαβάζει **τώρα**, ξαναρωτά κηδεμονία (άλλου / χώρος γραφείου ⇒ `absent`), καλεί τον **υπάρχοντα** `republishOwnerProperty` (προβολή + αποτύπωμα δημοσίευσης) · δεν πετά |
| `src/server/listing-terrain/terrain-upload.server.ts` · `terrain-publication-contract.ts` · locales `el`/`en` | Νέος κωδικός **`TERRAIN_NO_DOSSIER`** στο κλειστό σύνολο, με μήνυμα στις δύο γλώσσες (Σ1/Σ2/Σ5 πράσινα) |
| `scripts/lib/listing-model-custody/material-doors-contract.js` | `MATERIAL_DOORS` + η πόρτα ιδιοκτήτη (`refresh`) · `REFRESH_HELPERS` + `publishOwnerPropertyMaterial`, `refreshOwnerListingAfterMediaChange` |

**Αποφάσεις της φάσης γ**
- **Τρεις περιπτώσεις, μία άρνηση με όνομα**: αγγελία χωρίς φάκελο, φάκελος που δεν υπάρχει, φάκελος **άλλου** ανθρώπου
  ⇒ `TERRAIN_NO_DOSSIER` (409). Σε καμία δεν υπάρχει δοχείο του ιδιοκτήτη όπου να ζήσει η πηγή. Αγγελία ιδιοκτήτη σε χώρο
  **γραφείου** ⇒ ο άνθρωπος δεν τη διαχειρίζεται ⇒ 404 (ποτέ «υπάρχει»). Οι μεσιτευόμενες αγγελίες χωρίς φάκελο μένουν
  ανοιχτή ερώτηση του Giorgio.
- **Δεύτερος έλεγχος κηδεμονίας στην επαναπροβολή** (όπως το εταιρικό `companyId`): αν η αγγελία περάσει σε γραφείο ανάμεσα
  στην πόρτα και στην επαναπροβολή, **δεν** ξαναγράφεται εξαιτίας υλικού του ανθρώπου.
- **Το `API_ROUTES` δεν άγγιξε**: ο πρώτος πελάτης της διαδρομής έρχεται στο Β4.7, και εκεί μπαίνει η σταθερά. Μια σταθερά
  χωρίς καταναλωτή θα ήταν νεκρός κώδικας (3.22).
- Η πόρτα **ακόμα δεν φαίνεται** στην αγγελία: η γραμμή ιδιοκτήτη δεν διαλέγει ακόμα πηγή εδάφους από τον φάκελο (Β4.4,
  μετά το Β4.6). Η επαναπροβολή τρέχει ήδη, ώστε τη μέρα του Β4.4 να μη χρειαστεί καμία αλλαγή στην πόρτα.

**Επαλήθευση φάσης γ**: νέα άγκυρα `owner-properties/[ownerPropertyId]/terrain/__tests__/owner-property-terrain-route.test.ts`
(Ι1–Ι7: γέννηση στον φάκελο, ποτέ `companyId`, μόνο `files_personal`, σειρά · ξένη ⇒ 404 χωρίς ανάγνωση σώματος · χώρος γραφείου /
χωρίς φάκελο / ανύπαρκτος φάκελος · φάκελος άλλου · προκάτοχοι ίδιου φακέλου και κάδου + ιστορικό στο βιβλίο του ανθρώπου ·
επαναπροβολή με τον κάτοχο · Δ1) + ΙΔ-1…3 στο `listing-media-refresh.test.ts`. Ευρύ jest **177 σουίτες / 3046 tests πράσινα**.
Μεταλλάξεις **6/6 κόκκινες** (εταιρικό σπίτι · φάκελος άλλου δεκτός · χωρίς φίλτρο κάδου · επαναπροβολή χωρίς κάτοχο ·
επαναπροβολή χωρίς κηδεμονία · σώμα πριν την πόρτα). Πύλες στο δέντρο: 3.76 ✅ · 3.105 ✅ · 3.92 ✅ · 3.78 ✅ (82/110,
αμετάβλητο) · 3.100 ✅ · 3.56 ✅ · 3.58 ✅ · 3.80 ✅ (0 θανάσιμες ακμές) · 3.91 ✅ · 3.47 ✅ · 3.33 ✅ (παραγόμενοι τύποι
ξαναχτίστηκαν) · 3.28 ✅ (0 κλώνοι σε 7 αρχεία). ⚠️ Η 3.17 δείχνει **1** νέα παραβίαση σε **ξένο** αρχείο
(`property-handover-progress-write.ts`, ADR-916) — δεν αγγίχθηκε.

### 13.5 Β4.6 — ο φάκελος ιδιοκτήτη δεν γεννά «δημόσιο από κούνια» ✅

**Πρόβλημα**: το `match /files` φυλά τη θεματοφυλακή δημοσίευσης (`classification`, `publicationIdentity` — ADR-845 §7.17 Α4α)·
το `match /files_personal` **όχι**. Ο κάτοχος μπορούσε από την κονσόλα να γεννήσει ή να αλλάξει αρχείο φακέλου ως
«δημόσιο» — δημοσίευση που δεν έκρινε κανείς και που καμία πράξη διακομιστή δεν ξαναπρόβαλε. Αδρανής τρύπα ως σήμερα,
πραγματική από τη μέρα που η γραμμή ιδιοκτήτη (Β4.4) διαβάζει τον φάκελο ⇒ μπήκε **πριν** το Β4.4.

**Απόφαση**: επανάχρηση των **ΙΔΙΩΝ** καθολικών συναρτήσεων — καμία δεύτερη λίστα πεδίων, κανένα δεύτερο `match`.
- `create` → `&& publicationBornAbsent()` (δίπλα στα `holdBornAbsent()` · `handoverOriginBornAbsent()` κλπ).
- `update` (το **ένα** σκέλος: οριστικοποίηση · κάδος · επαναφορά · σύνδεση · μετονομασία) → `&& publicationCustodyUnchanged()`.
- **Όχι** `publicationPredicateUnchanged()`: εδώ ΠΡΕΠΕΙ να αλλάζουν `status`/`isDeleted` (ο κάδος του φακέλου μένει πράξη
  πελάτη, ADR-866 §2.6.11) — ίδια επιλογή με το σκέλος οριστικοποίησης του `/files`.
- `delete` αμετάβλητο (δεν γράφει πεδία).

⚠️ **Ανοιχτό για το Β4.4**: ο κάτοχος αλλάζει ακόμα `category`/`entityId` των **δικών** του αρχείων. Όχι θέμα εξουσίας (όλα
δικά του) αλλά **φρεσκάδας**: η αγγελία δεν ξαναπροβάλλεται ώσπου να γίνει πράξη διακομιστή. Κρίνεται στο Β4.4, όπου η
γραμμή ιδιοκτήτη αρχίζει να διαβάζει αυτά τα πεδία.

**Επαλήθευση**: σουίτα emulator `files-personal.rules.test.ts` νέα ενότητα **Π9** (για κάθε πεδίο: γέννηση · προσθήκη ·
αλλαγή · αφαίρεση · προσθήκη μέσα στην οριστικοποίηση ⇒ άρνηση· με τα πεδία του διακομιστή: σημείωση, κάδος με τη γραμμή
του, διαγραφή ⇒ επιτροπή) — **70/70**. Στατική άγκυρα `listing-file-publication-rules.test.ts` νέο **Κ6** (+ παρονομαστής
του μπλοκ) — **7/7**. Μεταλλάξεις **2/2 κόκκινες σε ΔΥΟ όργανα** (άγκυρα + emulator: αφαίρεση φρουρού `create` · αφαίρεση
φρουρού `update`), επαναφορά στο ίδιο tool call με έλεγχο sha1. Πύλες: 3.16 ✅ (18/18) · 3.86 ✅ (138/138) · 3.96 — βλ. changelog.
⚠️ **commit ≠ deploy** (3.86): ο κανόνας ισχύει στην παραγωγή μόνο μετά το `firebase deploy --only firestore:rules`.

### 13.6 Β4.4 — η γραμμή ιδιοκτήτη διαλέγει την πηγή εδάφους από τον φάκελο ✅

**SSoT audit**: ο αναγνώστης φακέλου (`readDossierMedia`) φέρνει **ήδη** όλα τα έτοιμα αρχεία του φακέλου χωρίς φίλτρο
κατηγορίας ⇒ το τοπογραφικό της πόρτας είναι ήδη στη μνήμη: **κανένα** νέο ερώτημα, κανένας νέος δείκτης (3.15 · 3.91).
Ο επιλογέας `currentTerrainSource` ήταν καθαρός αλλά ζούσε σε αρχείο `server-only`, ενώ η γραμμή ιδιοκτήτη
(`ownerListingMediaSources`) φορτώνεται και από τον browser ⇒ **εξαγωγή**, όχι αντίγραφο.

**Απόφαση**:
- `services/listings/terrain-source-selection.ts` (νέο, καθαρό): ο **ένας** κριτής `currentTerrainSource(files, entityType)`.
  Ο τύπος οντότητας είναι πλέον **ρητή** παράμετρος — αρχείο φακέλου δεν γίνεται έδαφος εταιρικού ακινήτου, ούτε αντίστροφα.
  Ο `terrain.reader` τον καλεί με `property`.
- `dossierTerrainSource(dossier, files)` στο `dossier-media-publication.ts`: **ζώνη ασφαλείας** `entityId === dossier.id &&
  userId === dossier.userId` πάνω από τον αναγνώστη, μετά ο ίδιος κριτής με `property_dossier`.
- `ownerListingMediaSources`: **μόνο με φάκελο και μόνο για γη** (Δ1, `isLandProperty(listing.type)`), η πηγή μπαίνει
  δίπλα στα μέσα· το ράφι τη χωρίζει από το υλικό της (`partitionListingSources` → `terrain`). Κανένα δεύτερο κεφάλι ή binder.
  Το `type` είναι **υποχρεωτικό** στην είσοδο: καλών που το ξεχνά δεν χάνει το έδαφος σιωπηλά.
- 🔑 **Η εξουσιοδότηση είναι η ΠΡΑΞΗ της πόρτας, όχι το `publishedFileIds`**: η δήλωση Δ2 γράφει `classification` +
  `publicationIdentity` με Admin SDK, και από το Β4.6 κανένας πελάτης δεν τα γεννά ούτε τα αλλάζει στο `files_personal`.
  Ίδιο δόγμα με το εταιρικό ακίνητο. Δηλωμένη πηγή εδάφους **δεν** φεύγει ποτέ ως εικόνα (δεν είναι αποκωδικοποιήσιμη).

**Το ανοιχτό του Β4.6 (`category`/`entityId`)**: η ζώνη ασφαλείας κλείνει την **εξουσία** — αρχείο που μετακινήθηκε σε
άλλον φάκελο δεν δημοσιεύεται εδώ. Μένει η **φρεσκάδα**: κάδος ή μετακίνηση από τον πελάτη δεν ξαναπροβάλλει την αγγελία ως
την επόμενη πράξη διακομιστή — **ίδιο** συμβόλαιο με τις φωτογραφίες του φακέλου σήμερα. Ανήκει στο ήδη ανοιχτό ερώτημα
«νυχτερινό δίχτυ ασφαλείας για αγγελίες ιδιοκτήτη», όχι σε ειδική λύση για το έδαφος.

**Επαλήθευση**: `dossier-media-publication.test.ts` νέα ενότητα **Α41.3** (7 tests: έδαφος χωρίς δήλωση · Δ1 μη γη / `null` ·
χωρίς φάκελο · ξένος φάκελος / ξένος άνθρωπος · χωρίς διαβάθμιση / ταυτότητα · η νεότερη νικά · ποτέ ως εικόνα) +
`terrain-reader.test.ts` (λάθος τύπος οντότητας) — **29/29**. Μεταλλάξεις **4/4 κόκκινες** (χωρίς φρουρά κατόχου · χωρίς
«μόνο γη» · ο κριτής αγνοεί τον τύπο · η πηγή δεν προστίθεται), επαναφορά στο ίδιο tool call με sha1. Ευρύ jest **139 σουίτες
/ 2610 tests**: 2609 πράσινα + 1 ασταθές υπό φορτίο (`set-mandate-guard`, 15,8″ — 8/8 σε απομόνωση, κανένας δεσμός με το
Β4.4). Πύλες: 3.105 ✅ · 3.76 ✅ · 3.70 ✅ · 3.74 ✅ · 3.80 ✅ (0 θανάσιμες ακμές) · 3.28 ✅ (0 κλώνοι σε 4 αρχεία).

### 13.7 Β4.7 — client, θύρες, hook εισαγωγής ✅

**Απόφαση για το `parseTopoPoints`: ΔΕΝ μετακινείται** (αναιρεί το «μετακινείται στο Β4.7» του §13.1). Η φόρμα παίρνει τον
δρόμο του **πίνακα**, όχι τον «χωρίς οδηγό»: ο `parseTopoPoints` σπάει κάθε γραμμή και στο κόμμα ⇒ το ελληνικό CSV
`345678,123;4201234,456;125,30` γίνεται έξι κελιά (το σφάλμα που το `cellPurity` του §13.1 διόρθωσε **μόνο** στον πίνακα)·
έχει σταθερή σειρά `X Y Z` χωρίς αναγνώριση/διόρθωση στηλών· παίρνει τη μονάδα ως παράμετρο αντί να την προτείνει.

```
αρχείο ─→ readSurveyFile ─→ πίνακας (CSV/XLSX + πρόταση στηλών) │ DXF (σημεία + $INSUNITS) │ άρνηση με όνομα
       ─→ surveyPointsOf (μονάδα: δηλωμένη · προτεινόμενη · του ανθρώπου) ─→ σημεία mm
       ─→ prepareSurveyUpload (ΙΔΙΑ ετυμηγορία με την πόρτα) ─→ judgeTerrainSurveyDeclaration (ΙΔΙΟΣ κριτής)
       ─→ publishListingTerrain (ένα Idempotency-Key ανά προετοιμασία) ─→ πόρτα του κατόχου
```

| Αρχείο | Ρόλος |
|---|---|
| `services/listings/publish-listing-terrain.client.ts` | Ο **ένας** client: multipart δύο πεδίων (πηγή = το `encoded` της προεπισκόπησης byte προς byte · δήλωση)· κλειδί ιδεμποτίας γεννιέται με την προετοιμασία και ξαναχρησιμοποιείται για ίδια bytes + ίδια δήλωση (`reuseTerrainPublication`)· αρνήσεις με όνομα από τον κλειστό κατάλογο· τα `stats` της απάντησης **δεν** ξαναδιαβάζονται (τα έχει ήδη η προεπισκόπηση από τον ίδιο κριτή) |
| `lib/terrain/publication/terrain-publish-target.ts` | Οι δύο θύρες ως **καθαρές συναρτήσεις**, όχι hooks (ο browser δεν ανεβάζει αρχείο — δεν χρειάζεται συνεδρία για το «πού»): γραφείο = σωσμένο + γη · ιδιοκτήτης = προσωπική θεματοφυλακή + φάκελος + σωσμένο + γη. `null` ⇒ κανένα κουμπί αντί για κουμπί που η πόρτα αρνείται |
| `lib/terrain/survey-import/survey-file-read.ts` | Τα bytes αποφασίζουν τον δρόμο· UTF-8 αυστηρά, αλλιώς **windows-1253** (το ελληνικό Excel)· XLS / DXF binary / άγνωστο / κενό / μη αναγνώσιμο = άρνηση με όνομα, ποτέ εξαίρεση |
| `lib/terrain/survey-import/survey-points.ts` | Μονάδα: DXF με `$INSUNITS` μήκους ⇒ **δηλωμένη** (ο άνθρωπος δεν ρωτιέται)· `0`/απόν ή πίνακας ⇒ `suggestSurveyUnit` προεπιλεγμένη προς επιβεβαίωση· καμία ένδειξη ⇒ **κανένα** σημείο ώσπου να διαλέξει. Ένας δρόμος κλίμακας (`scaleSurveyPoints`) για πίνακα και DXF |
| `lib/terrain/survey-import/topo-mapping-edit.ts` | `proposeColumnMapping` · `padMapping` · `assignRole` — **μεταφέρθηκαν** από τον οδηγό του viewer (`useTopoImport`), που τα εισάγει πλέον |
| `hooks/listings/useTerrainSurveyImport.ts` | Η ενορχήστρωση: μετρά μόνο το τελευταίο αρχείο· η έκβαση της δημοσίευσης είναι **δεμένη στα bytes** που έφυγαν (αλλαγή στήλης/μονάδας ⇒ ξανά «δεν δημοσιεύτηκε», ποτέ μπαγιάτικη επιτυχία)· ένα αίτημα σε πτήση |

**Κεντρικοποιήσεις που προέκυψαν (N.0.2)**
- `judgeTerrainSurveyDeclaration` στο `terrain-survey-declaration.ts`: η πόρτα και η φόρμα τρέχουν τον **ίδιο** κριτή πάνω στο
  ίδιο wire string· η πόρτα κρατά μόνο την αντιστοίχιση σε HTTP (400 / 422). Η άγκυρα Σ1 του συμβολαίου διαβάζει πλέον και
  αυτό το αρχείο, αφού εκεί γεννιούνται οι δύο κωδικοί.
- `namedRefusalOf` / `NamedRefusal` στο `lib/api/api-client-types.ts` (δεύτερος καλών μετά την κάτοψη, που το χρησιμοποιεί πλέον).
- `announceSupersededFiles` μετακόμισε από `dxf-viewer/io/publish-shared/` στο `services/filesystem/` (τρίτος καλών, εκτός viewer).
- `API_ROUTES.PROPERTIES.TERRAIN` + νέο μπλοκ `API_ROUTES.OWNER_PROPERTIES` (μόνο `TERRAIN`· πέντε χειρόγραφες διαδρομές
  ιδιοκτήτη καταγράφηκαν στο `pending-ratchet-work.md`).
- `lib/properties/unsaved-property.ts` (`UNSAVED_PROPERTY_ID` · `isPersistedPropertyId`) — το ΠΕΑ το χρησιμοποιεί πλέον·
  πέντε χειρόγραφα `'__new__'` ακινήτου καταγράφηκαν.

⚠️ **Μία αλλαγή συμπεριφοράς στον viewer**: αρχείο **χωρίς** επικεφαλίδα δεν ανοίγει πλέον ολόκληρο «αγνόησε» — ρωτιέται ο
sniffer των δεδομένων, όπως ήδη στον δρόμο του νέφους (M8β/Δ). Χωρίς τρεις στήλες συντεταγμένων δεν προτείνει τίποτα (όπως πριν).

**Επαλήθευση** (2026-10-24, πάνω στο `1200e8cc`): στοχευμένο jest **100 σουίτες / 1124 tests** πράσινα (hook, πυρήνας
εισαγωγής, `lib/api`, client, οι δύο πόρτες, τοπογραφικό viewer, κάτοψη, μοντέλο) · μεταλλάξεις **11/11 κόκκινες**
(H1 μόνο-το-τελευταίο · H2 μπαγιάτικη επιτυχία · H3 κριτής δήλωσης · H4 ίδιο κλειδί · L1 windows-1253 · L2 «χωρίς
μονάδες» · L3 σιωπηλή προεπιλογή m · L4 sniffer δεδομένων · L5 μετακόμιση ρόλου · D1 ημερολόγιο κριτή · D2 400 vs 422),
όλες με επαναφορά sha1 · πύλες 3.28 ✅ (0 κλώνοι / 7 αρχεία) · 3.70 ✅ (0) · 3.80 ✅ (0/0) · 3.62 ✅ (0/391) ·
3.22 ✅ (1 καθαρισμένο vs baseline 9) · 3.105 (σουίτα πύλης) 14/14.

### 13.8 Β4.8 — μοντέλο SVG του χάρτη εδάφους ✅ *(2026-10-24 → 2026-10-26)*

**Αποφάσεις Giorgio (2026-10-24)**: σημάνσεις αντιφατικών / συμπιπτόντων σημείων **πάνω** στον χάρτη τώρα · «αραιή
περιοχή» τώρα, σκίαση ανάγλυφου στο Β6 · μέτρηση `prepareSurveyUpload` σε 10k / 100k σημεία μέσα στο Β4.8 πριν από
απόφαση για Web Worker.

**Υπο-βήμα 1 — ΕΝΑ σπίτι για την κλίμακα 1-2-5** ✅: το `snapScaleBarLength` μετακόμισε αυτούσιο στο
`src/lib/geometry/scale-bar-length-snap.ts`· το `dxf-viewer/bim/scale-bar/scale-bar-length-snap.ts` το επανεξάγει
(ADR-583 changelog). Οι άλλοι κώδικες 1-2-5 (`RulerRenderer`, `niceScaleAtLeast`, σκάλα πλέγματος) απαντούν άλλη ερώτηση.

**Υπο-βήμα 2 — μοντέλο + σημάνσεις** ✅

| Αρχείο | Ρόλος |
|---|---|
| `lib/terrain/tin-boundary-loops.ts` | **Μετακόμισε** από το `topo-surface-perimeter.ts` του viewer: σύνορο ΟΠΟΙΟΥΔΗΠΟΤΕ συνόλου τριγώνων (ακμή που ανήκει σε ΕΝΑ τρίγωνο) ως δακτύλιοι δεικτών. Το DXF κρατά μόνο το LOCAL→WORLD |
| `lib/geometry/angle.ts` | + `normalizeTextAngle` / `RIGHT_ANGLE` (μετακόμισαν από το `geometry-angle-utils.ts`, που τα επανεξάγει). ⚠️ Το παλιό παράδειγμα «−π/2 → π/2» ήταν **λάθος** (ακριβώς ±90° δεν στρίβει) — αφαιρέθηκε |
| `publication/listing-terrain-{types,snapshot,judge}.ts` | Το επιτυχές αποτέλεσμα κουβαλά και το **`frame`** του στιγμιοτύπου (ποτέ σειριοποιημένο). Η μετατροπή κόσμος→δημοσιευμένο μένει **μία** (Δ3) |
| `survey-import/survey-upload-preparation.ts` | **Μία** απογραφή θέσεων (`censusOf`) τροφοδοτεί `surveyFactsOf` **και** `surveyMarksOf`· `marks` στο `ok: true` (μία ανά επαναλαμβανόμενη θέση, η αντίφαση νικά). Wire και στιγμιότυπο αμετάβλητα |
| `publication/terrain-map-svg.ts` | Το **ένα** σημείο όπου το πλαίσιο γίνεται χώρος SVG: 1 μονάδα = 1 m, `svgY = −y`, στρογγύλευση `roundPublished` |
| `publication/terrain-map-regions.ts` | Έκταση αποτύπωσης · **ένα** path ανά κλάση κλίσης (`fill-rule="evenodd"`) · % **εμβαδού** από τα τρίγωνα · αραιή περιοχή (μέγιστη ακμή > 3 × διάμεσος ακμών, πρότυπο Civil 3D «maximum triangle length») |
| `publication/terrain-map-contours.ts` | Ένα path δευτερευουσών + ένα κυρίων · ετικέτες μόνο στις κύριες, στο **ευθύτερο** παράθυρο (δύο δείκτες, O(n)), πάντα όρθιες, χωρίς συγκρούσεις, με άλω αντί για κομμένη γραμμή |
| `publication/terrain-map-furniture.ts` | View box + περιθώριο · βέλος βορρά (`northArrowSvgPath`, πάντα north-up) · κλίμακα 1-2-5 στο ¼ του πλάτους, με μέρη που είναι κι αυτά 1-2-5 (4 για το 2·10ⁿ, αλλιώς 5) — όλα **μέσα στο περιθώριο** |
| `publication/terrain-map-model.ts` | `terrainMapModelOf(snapshot, marks?)` — σύνθεση· **διαβάζει** το στιγμιότυπο, δεν το ξαναπαράγει |
| `publication/listing-terrain-config.ts` | + τα «κουμπιά» του χάρτη (περιθώριο, κλίμακα, βορράς, ύψος κειμένου, `0,6 em` ανά ψηφίο — **εκτίμηση**, CHECK 3.64, συντελεστής αραιότητας) |

**Επαλήθευση** (2026-10-24): jest **86 σουίτες / 1210 tests** (`lib/terrain` · γωνίες · περίγραμμα DXF · hooks/services
αγγελιών · πόρτα εδάφους) · μεταλλάξεις **11/11 κόκκινες** + 3/3 του υπο-βήματος 1, όλες με επαναφορά sha1 · πύλες
3.28 ✅ (0 κλώνοι / 14 αρχεία) · 3.62 ✅ (0/391) · 3.70 ✅ (0 / 20.702) · 3.80 ✅ (0/0) · 3.105 ✅ · 3.47 ✅.
⚠️ Τα exports του μοντέλου δεν έχουν ακόμα καταναλωτή εκτός των tests: ο καταναλωτής είναι το `TerrainContourMap`
(υπο-βήμα 4)· το CHECK 3.22 τρέχει στο βήμα των πυλών.

**Υπο-βήμα 3 — tokens + παλέτα** ✅
- `--terrain-slope-1..4` στο `globals.css`, **ίδια** στα δύο θέματα (χαρτί — και το PDF). **Διατεταγμένη** κλίμακα (όχι
  κατηγορική): **μία** απόχρωση, πορτοκαλί (η δεύτερη διαδοχική απόχρωση της μεθόδου dataviz· το μπλε είναι ήδη τιμή στο
  `--map-seq-*`). Παράχθηκε σε OKLCH (απόχρωση του `#eb6834`, L 0,76/0,65/0,54/0,43) και **μετρήθηκε** με τον validator
  (`--ordinal`, χαρτί `#ffffff`): μονότονο L · ΔL ≥ 0,06 · ανοιχτό άκρο 2,26:1 ≥ 2:1 · μία απόχρωση ✅. ⚠️ Το YlOrRd της
  έρευνας **απορρίφθηκε**: πολλαπλές αποχρώσεις σε διατεταγμένη κλίμακα αντιβαίνουν στον κανόνα «ordinal = μία απόχρωση».
- Ισοϋψείς / ετικέτες / βέλος / κλίμακα σε **`--plan-ink`** (το ένα μελάνι σχεδίου σε χαρτί) με **λευκό περίβλημα** —
  διαβάζονται και στη σκουρότερη κλάση (καφέ ισοϋψείς USGS απορρίφθηκαν: ίδια απόχρωση με την κλάση ≥ 25 %).
- ⚠️ **Αλλαγή από την πρόταση**: **καμία** διαγράμμιση ανά κλάση εξ ορισμού — η υφή είναι κανάλι προσβασιμότητας
  (forced-colors / εκτύπωση), όχι διακόσμηση. Διαγράμμιση φορά **μόνο** η «αραιή περιοχή» (άλλο νόημα).
- `components/listing-detail/terrain/terrain-map-palette.ts`: το **ΕΝΑ** σημείο που ονομάζει τις κλάσεις· επαναχρησιμοποιεί
  `PLAN_NORTH_CLASS` / `SPACE_LABEL_CLASS` της κάτοψης.
- Επαλήθευση: σουίτα παλέτας (πλήθος = κλάσεις του config · ίδια τιμή στα δύο θέματα · μονότονη φωτεινότητα · clamp)·
  μεταλλάξεις **4/4**· πύλες 3.32 ✅ · 3.39 ✅ (35/54 = baseline) · 3.41 ✅ · 3.42 ✅ (182/220 = baseline) · 3.43 ✅ · 3.28 ✅.

**Υπο-βήμα 4: `TerrainContourMap`** ✅ (`components/listing-detail/terrain/`)

| Αρχείο | Ρόλος |
|---|---|
| `TerrainContourMap.tsx` | `<figure>`: SVG → λεζάντα (ισοδιάσταση) → πίνακας κλάσεων → ένδειξη «ενδεικτικές» (Α6) → υπόμνημα συμβόλων. Δέχεται **έτοιμο** `TerrainMapModel`. **Μία** όψη για δημόσια αγγελία και προεπισκόπηση: η διαφορά είναι μόνο αν το μοντέλο κουβαλά `marks` |
| `TerrainMapSvg.tsx` | `role="img"` + `<title>`/`<desc>` (`aria-labelledby`). Στρώματα: χαρτί → κλάσεις (`evenodd`) → αραιή (pattern) → έκταση / όριο → δευτερεύουσες → κύριες → ετικέτες → σημάνσεις → βορράς · κλίμακα. Γραμμές σε css px (`non-scaling-stroke`), κείμενα σε μέτρα (`labelHeightM`) |
| `terrain-map-symbols.tsx` | `TerrainLine` (περίβλημα **ξεχωριστό** path κάτω από το μελάνι) · `SparseHatchPattern` · `MarkGlyph` (σταυρός / δαχτυλίδι) · δείγματα υπομνήματος. **Το δείγμα ζωγραφίζεται με τον ΙΔΙΟ κώδικα με τον χάρτη** (μάθημα `FloorPlateSwatch`) |
| `TerrainSlopeTable.tsx` | 🔑 **Ο πίνακας ΕΙΝΑΙ το υπόμνημα του χρώματος**: δείγμα · εύρος · % εμβαδού, ορατός. Όχι υπόμνημα + κρυφός πίνακας με το ίδιο περιεχόμενο δύο φορές (ακούγεται διπλό, αποκλίνει). Πέρα από Civil 3D / ArcGIS, που δείχνουν μόνο το εύρος: το % του εμβαδού απαντά «**πόσο** είναι απότομο;». Οι κενές κλάσεις μένουν με 0 % |
| `terrain-map-words.ts` | Αριθμοί → κείμενο με το `@/lib/intl-formatting` (το ένα σημείο). **Ακρίβεια υψομέτρου = της ισοδιάστασης** (0,25 → 2 δεκαδικά, 1 → κανένα). Ίχνος > 0 και < 0,1 % = «κάτω από 0,1 %», ποτέ «0 %» |
| `terrain-map-palette.ts` | + `TERRAIN_STROKE_PX` (κύρια ≈ 2 × δευτερεύουσα, USGS). Οι κλάσεις κλίσης παίρνουν **και περίγραμμα ίδιου χρώματος** (0,5 px), που κλείνει τη ραφή anti-aliasing ανάμεσα σε γειτονικές περιοχές |
| `market/MapRampLegend.tsx` | + `swatch.kind: 'symbol'` (δείγμα SVG του καλούντα). Οι 2 υπάρχοντες καταναλωτές δεν άλλαξαν. Το υπόμνημα δείχνει **μόνο** όσα σύμβολα υπάρχουν στον χάρτη (υπόμνημα φύλλου, Revit / ArchiCAD) |
| `terrain-map-model.ts` | + `majorContourIntervalM` (το ονομάζουν το υπόμνημα και η λεζάντα) |
| i18n `listing-detail:terrain.map.*` (el + en) | Τίτλος, περιγραφή, λεζάντα, «ενδεικτικές», γράμμα βορρά, πίνακας, 8 λέξεις υπομνήματος. Μονάδα `m` (SI) και στις δύο γλώσσες |

**Boy scout (N.0.2)**: `hooks/media/useSvgFragmentId.ts`, το ΕΝΑ καθαρό `useId` για `url(#…)` (χάρτης + `FloorPlateUnitLayer`).
Τα άλλα 3 αντίγραφα, σε άλλους τομείς, μπήκαν στο `pending-ratchet-work.md`. Επίσης `lib/geometry/hatch-tile.ts`: το ΕΝΑ πλακίδιο
διαγράμμισης 45° χωρίς ραφή (ζούσε μέσα στο `FloorPlateUnitLayer`· ο χάρτης θα ήταν δεύτερο αντίγραφο).

**Ανοιχτό για το υπο-βήμα 5**: το ύψος κειμένου είναι 2,8 % της μεγάλης πλευράς. Σε πλάτος ~340 px βγαίνει ~9,5 px, κάτω από τα
12 px που μέτρησε η κάτοψη ορόφου (ADR-907 §11.14). Η μεγέθυνση στην όψη θα ακύρωνε την εγγύηση «χωρίς συγκρούσεις» του
μοντέλου (που μετρά με αυτό το ύψος), οπότε η απόφαση (ελάχιστο πλάτος σχεδίου ή ύψος από τον καλούντα) παίρνεται με
πραγματική απόδοση στο `TerrainPreview`. Οι παραγόμενοι τύποι i18n (`src/types/i18n.ts`, CHECK 3.33) **δεν** ξαναπαράχθηκαν:
το αρχείο είναι σταδιοποιημένο από άλλη συνεδρία, άρα παράγεται στο βήμα των πυλών.

**Υπο-βήμα 5α — μέτρηση του κόστους προεπισκόπησης** ✅ (`survey-import/__tests__/survey-preparation.perf.test.ts`,
πρότυπο `geo-auto-match.perf.test.ts`: μετρά και γράφει, **κανένα** χρονικό όριο· ελέγχει μόνο την απάντηση στο μέγεθος)

Συνθετικός κάνναβος 1 m σε μεγέθη ΕΓΣΑ'87, μετατόπιση ±0,3 m (κανένα ομοκυκλικό τετράγωνο), λόφοι ±3 m + κλίση 2 %.
Node 20 / jest, μηχάνημα 4 πυρήνων, 2026-10-24. Ψυχρή = πρώτη κλήση · διάμεσος 5 θερμών.

| Σημεία | Τρίγωνα | `prepareSurveyUpload` | εκ των οποίων κριτής (TIN + στιγμιότυπο) | `terrainMapModelOf` | Μοντέλο / σώμα | Έκβαση |
|---|---|---|---|---|---|---|
| 10.000 | 19.980 | **10,5 s** ψυχρή / 10,7 s | 10,3 s | **0,30 s** | 168 / 293 KiB | ✅ |
| 28.900 | 57.774 | **40,8 s** / 30,5 s | 30–51 s | **0,92 s** | 279 / 847 KiB | ✅ (η βαρύτερη που περνά) |
| 99.856 | — | **271 s** / 203 s | 170–198 s | — | — | `TERRAIN_TOO_DENSE` |

Facts, κωδικοποίηση και σημάνσεις: ≤ 60 ms σε όλα τα μεγέθη. Δεύτερη σύντομη μέτρηση στα 10k: 7,5 s / 0,27 s.

⚠️ **Ο πίνακας πάνω είναι μετρημένος ΜΕΣΑ στο jest, και το jest φουσκώνει τον τριγωνισμό ~6×**: ο **ίδιος** `cdt2d`
στα **ίδια** 10k σημεία = **10,0 s** μέσα στο jest (προσωρινό test, σβήστηκε στην ίδια εντολή· `buildTin` 10,9 s · κριτής
10,1 s ⇒ ο τριγωνισμός είναι ΟΛΟ το κόστος) έναντι **1,7 s** σε σκέτο Node. Το `cdt2d` **δεν** μετασχηματίζεται από το
swc (`transformIgnorePatterns`) — η διαφορά είναι του περιβάλλοντος. Οι **πραγματικοί** αριθμοί είναι αυτοί που ακολουθούν.

**Σύγκριση σε σκέτο Node 20** (`tri-bench.mjs` στο scratchpad της συνεδρίας, ίδιος κάνναβος, πακέτα σε απομονωμένο φάκελο με
`--ignore-scripts`, **όχι** στο έργο)· «ίδια τρίγωνα» = ίδιο σύνολο τριάδων κορυφών, όχι απλώς ίδιο πλήθος:

| Σημεία | `cdt2d` (σήμερα) | Delaunator 5.1 (+ Constrainautor 4.1 για ακμές θραύσης) | Λόγος | Ίδια τρίγωνα |
|---|---|---|---|---|
| 10.000 | 1.668 ms | **22 ms** | ×74 | ✅ |
| 10.000 + 99 ακμές θραύσης | 1.499 ms | **20 ms** | ×74 | ✅ |
| 28.900 | 6.280 ms | **59 ms** | ×107 | ✅ |
| 28.900 + 169 ακμές θραύσης | 6.154 ms | **108 ms** | ×57 | ✅ |
| 99.856 | 28.518 ms | **344 ms** | ×83 | (το `cdt2d` δεν συγκρίθηκε τρίγωνο-τρίγωνο στο 100k) |
| 99.856 + 315 ακμές θραύσης | — | **391 ms** | — | — |

🔴 **Η απάντηση ΔΕΝ είναι «Web Worker»**. Ο worker ξεκλειδώνει το νήμα, αλλά ο άνθρωπος περιμένει πάλι 1,7–6 s σε
**κάθε** αλλαγή στήλης ή μονάδας (το `useMemo` του hook)· και η **πόρτα του server** τρέχει τον ίδιο κριτή, άρα ένα
αίτημα 100k σημείων κρατά το Node ~29 s για να απαντήσει άρνηση. **Προφίλ CPU** (`--cpu-prof`, 10k): **71 %**
`linearExpansionSum` (`robust-sum`) + `exactInSphere4` / `robustSubtract` / `scaleLinearExpansion` + ο ίδιος ο
`cdt2d` ≈ **85 %** του χρόνου στον τριγωνισμό του `lib/terrain/tin-builder.ts`. Οι συντεταγμένες είναι **ήδη** τοπικές
ακέραια mm (`computeLocalOrigin`), άρα δεν φταίει το μέγεθος ΕΓΣΑ. Ο `cdt2d` κάνει **κάθε** τεστ κύκλου με ακριβή
αριθμητική (χωρίς γρήγορο φίλτρο)· ο Delaunator χρησιμοποιεί τα **προσαρμοστικά** κατηγορήματα Shewchuk
(`robust-predicates`): ακριβή μόνο όταν το γρήγορο αποτέλεσμα είναι αμφίβολο — **ίδια** απάντηση, ~×80 φθηνότερη.
Το `terrainMapModelOf` (0,3–0,9 s **στο jest** — άγνωστο πόσο φουσκωμένο) είναι **δεύτερο**, ξεχωριστό εύρημα.

**Άδειες** (από το `package.json` των εγκατεστημένων πακέτων): `delaunator` **ISC** · `@kninnug/constrainautor` **ISC** ·
`robust-predicates` **Unlicense**. Καμία δεν είναι στη λίστα του N.5 (MIT / Apache 2.0 / BSD) ⇒ **ρητή έγκριση Giorgio**.
Το Constrainautor υλοποιεί τον αλγόριθμο του Sloan (1992) πάνω σε τριγωνισμό Delaunator.

⚠️ Ο `tin-builder` είναι **κοινός** με τον DXF Viewer (ADR-650) και την πόρτα του server ⇒ η διόρθωση είναι απόφαση
πέρα από το Β4.8 (εκκρεμεί απόφαση Giorgio). Ο σύντομος τρόπος της σουίτας τρέχει μόνο 10k / μία ψυχρή κλήση (~9 s)·
ο πλήρης πίνακας: `TERRAIN_PERF=full` (κόστισε 2.923 s).

**Αποφάσεις Giorgio (2026-10-25)** — «προχώρα όπως προτείνεις»:
1. ✅ **Εγκρίνονται οι άδειες** `delaunator` (ISC) · `@kninnug/constrainautor` (ISC) · `robust-predicates` (Unlicense) —
   ρητή εξαίρεση από τη λίστα του N.5 **για αυτά τα τρία πακέτα**.
2. ✅ **Νέο βήμα πριν το `TerrainPreview`**: ο τριγωνισμός του `buildTin` γίνεται Delaunator + Constrainautor με το **ίδιο**
   API (ADR-650 + ADR-920) — φορά τριγώνων, διπλά σημεία, τεμνόμενες ακμές θραύσης, σύγκριση τρίγωνο-τρίγωνο με `cdt2d`,
   αφαίρεση `cdt2d` αν μείνει χωρίς καταναλωτή· μετά **ξαναμέτρηση** και απόφαση worker με τους νέους αριθμούς.
3. ⏳ **Αργότερα** (όχι στο Β4.8): απλοποίηση με **δηλωμένο** μέγιστο υψομετρικό σφάλμα (Garland–Heckbert / Delatin)
   αντί για άρνηση `TERRAIN_TOO_DENSE` — ούτε σιωπηλή αραίωση (Revit) ούτε τοίχος.
4. Για το `TerrainPreview`: ετικέτες σε **pixels οθόνης** (ο καλών μετρά πλάτος με `ResizeObserver`, κλάσεις 320/480/640/960 ⇒
   `labelHeightM` προς το μοντέλο) · αρνήσεις **ανάγνωσης αρχείου** και **στατιστικά αγοραστή** στο Β4.9.

**Βήμα Τ — ο τριγωνισμός του `buildTin`: `cdt2d` → Delaunator + Constrainautor** ✅ (2026-10-25 · ADR-650 v35)

**Ίδιο API**, κανένας καταναλωτής δεν άλλαξε. Η σειρά ήταν: tests χαρακτηρισμού **πάνω στον `cdt2d`** (πράσινα πριν
την αλλαγή) → αλλαγή → τα ίδια tests πράσινα.

| Ελέγχθηκε (μετρημένο σε σκέτο Node, `cdt2d` vs νέος) | `cdt2d` | Delaunator + Constrainautor | Απόφαση |
|---|---|---|---|
| φορά τριγώνων | CCW | **CW** σε σύστημα y-πάνω | αντιστροφή στο `tin-triangulate`, μία φορά |
| συνευθειακά · διπλά · κοίλο σχήμα | 0 τρίγωνα · 1 · κυρτό περίβλημα | ίδια | — |
| ακριβής κάνναβος (ομοκυκλικά) | κάποιες διαγώνιοι | **άλλες** διαγώνιοι | και τα δύο έγκυρο Delaunay· το test ελέγχει «κενός κύκλος» |
| ακμή θραύσης μέσα από κορυφή | τη σπάει | **εξαίρεση**, χάνει την ακμή | σπάσιμο στο `tin-breakline-resolve` |
| **τεμνόμενες** ακμές θραύσης | 🔴 **τρύπες + χαμένες κορυφές**, σιωπηλά | εξαίρεση, κρατά την πρώτη | κόμβος στην τομή, σπάνε και οι δύο |

**Η πολιτική για δύο υψόμετρα σε μία θέση** (έρευνα: Civil 3D «Resolve Crossing Breaklines» — υψηλότερο / χαμηλότερο /
μέσο / νέο· Trimble Business Center — κόμβος σε κάθε τομή, «breaklines must not cross»· Carlson — «Highlight Crossing
Breaklines» με φίλτρο ανοχής): **ο ίδιος κανόνας με τα αντιφατικά σημεία** του `surveyFactsOf` — κρατιέται η **πρώτη**
δήλωση, η άλλη **ονομάζεται** (`buildTinWithReport` → `BreaklineElevationConflict`, τρία είδη: τομή · κορυφή πάνω σε
ακμή · κορυφή ακμής πάνω σε σημείο — το τρίτο ήταν **κι αυτό σιωπηλό** ως σήμερα). Συμφωνία = μόνο θόρυβος float· η
σοβαρότητα ενός Δz είναι δουλειά του QA, όχι της γεωμετρίας. Πέρα από τους τρεις: κατηγορήματα **ακριβή** (καμία τομή
δεν χάνεται από στρογγυλοποίηση) και πλέγμα υποψηφίων (σχεδόν γραμμικό, όχι όλα τα ζεύγη).

**Παράπλευρο εύρημα (boy scout, ADR-718)**: η κοπή στο όριο έβγαζε επικαλυπτόμενα τρίγωνα σε κοίλο όριο (Γ 300 → 304 m²)
— κρυμμένο από την τύχη των διαγωνίων στον κάνναβο. Διορθώθηκε με `ring-convex-pieces` (όριο → κυρτά κομμάτια μία φορά).

**Επαλήθευση**: 80 σουίτες / 876 tests (`lib/terrain` · viewer `systems/topography` · πόρτα εδάφους · `tin-to-three` ·
φύλακας ambient) · μεταλλάξεις **10/10** με επαναφορά sha1 · CHECK 3.65 ✅ · 3.84 ✅ (ξαναπαράχθηκαν notices/SBOM:
1083 → 1076 στοιχεία) · 3.28 ✅ (ένας δίδυμος βρόχος ορίων βρέθηκε και ενοποιήθηκε σε `planarBoundsOf`) · 3.79 ✅ ·
3.80 ✅ · 3.70 ✅. Ενδεικτικά **στο jest** (φουσκωμένο — όχι χρόνος χρήστη): `prepareSurveyUpload` 10k ψυχρή
**10,5 s → 0,82 s**· οι πραγματικοί αριθμοί στο 5β.

⚠️ **Δεν ελέγχθηκε**: τύποι (N.17 — το Constrainautor δηλώνει τύπους με το **ίδιο του το `.ts`**, που το `skipLibCheck`
δεν καλύπτει· θα φανεί στον έλεγχο του Giorgio / στο hook) · knip (3.22, βαρύ — στις πύλες του κλεισίματος).

**Βήμα Τ.3 — οι αντιφάσεις ακμών θραύσης φτάνουν στον άνθρωπο** ✅ viewer (2026-10-25 · ADR-650 v36) · ⏸️ προεπισκόπηση

**Viewer (QA M5α)** — νέο είδος `breakline-conflict` με έλεγχο `qa/check-breakline-conflicts.ts`, που **μόνο μεταφράζει**
την αναφορά του builder. Η αναφορά ζει στον **όροφο 1** του memo του `topo-surface` (`getTopoBuildReport`): ο ίδιος, μοναδικός
τριγωνισμός δίνει επιφάνεια **και** αποφάσεις (`getTopoSurfaceFull() === getTopoBuildReport().surface` — άγκυρα). Το
πάνελ, τα ⊙ markers 2Δ/3Δ και το zoom-to είναι ήδη γενικά (`messageKey` + `at` + `atZMm`) ⇒ **καμία γραμμή UI**.

| Ερώτημα | Απόφαση | Γιατί |
|---|---|---|
| Ανοχή (Carlson: φίλτρο που **κρύβει** ό,τι είναι κάτω από αυτήν) | **Τίποτα κρυφό**: < 0,10 m `low` · ≥ 0,10 `medium` · ≥ 1,00 `high` | ο builder φιλτράρει ήδη μόνο τον θόρυβο float· η ακμή που ακυρώθηκε **έχει ήδη λυγίσει** |
| Ζώνες Δz | **Οι ίδιες** με τα διπλά σημεία (`COINCIDENT_Z_*`, δηλωμένες μία φορά στο `topo-qa-config`) | «δύο υψόμετρα σε μία θέση» είναι **ένας** κανόνας (ADR-650 v35) |
| Θέση | LOCAL + `origin` της αναφοράς → WORLD· 3Δ στο `keptZ` | ο ⊙ κάθεται στο έδαφος που βλέπει ο μηχανικός |
| Όνομα | η ακμή που **ακυρώθηκε**, `#n` (1-based, όπως στο `check-boundary-closure`) | Civil 3D «Resolve Crossing Breaklines»: ζεύγος + Δz + Zoom To |
| Εμβέλεια | όλη η αποτύπωση, όχι μόνο εντός ορίου | ιδιότητα της μέτρησης (όπως `duplicate-point`), όχι της κοπής |

i18n `dxf-viewer-panels:topography.qa.flag.breaklineCrossing` / `.breaklineVertexOn` (el + en, ICU)· ξαναπαράχθηκε το
`src/types/i18n.ts` (3.33 ✅). Tests `qa/__tests__/topo-breakline-conflicts` (12) · μεταλλάξεις **8/8** με επαναφορά sha1 ·
397 σουίτες / 3.742 tests (`lib/terrain` · viewer `systems/topography` · `bim-3d` · `server/listing-terrain`) · 3.28 ✅.

**Προεπισκόπηση ιδιοκτήτη ⏸️ — μετρημένα, όχι αναβολή από βολή**: η μόνη πηγή εδάφους που φτιάχνει ο client
(`surveySourceOf`) στέλνει **πάντα** `breaklines: []`, και καμία εισαγωγή του ιδιοκτήτη (CSV/DXF) δεν διαβάζει ακμές. Ένας
μετρητής στα `SurveyFacts` ή ένα νέο `kind` στο `SurveyPointMark` θα ήταν σήμερα **πάντα 0** — νεκρός κώδικας (3.22) και ένα
«0» που σημαίνει «κανείς δεν κοίταξε». Μπαίνει **μαζί** με την πρώτη εισαγωγή ακμών στη φόρμα ή με το 5γ, πάνω στο ίδιο
`buildTinWithReport` και στο `SnapshotFrame.planM`.

**Υπο-βήμα 5β — ξαναμέτρηση έξω από το jest + main thread του viewer** ✅ (2026-10-25)

*(α) TIN, σκέτο Node, τα ΙΔΙΑ δεδομένα με τον viewer* (25 σημεία z = 2 + 3 ασυνέχειες, 2 διασταυρώσεις με σύγκρουση z,
20 επαναλήψεις `buildTinWithReport`): 0 ασυνέχειες, διάμεσος **0,22 ms** · 3 ασυνέχειες **0,66–0,80 ms** (max 10,5 ms),
40 τρίγωνα, 2 conflicts, 0 refused. Το ίδιο σε κλίμακα ×1000 (mm). ⇒ **ο CDT ΔΕΝ είναι αιτία καθυστέρησης**· το memo ανά
ταυτότητα του `topo-surface` δίνει **ένα** rebuild ανά αλλαγή.

*(β) Main thread του viewer* (Long Animation Frames με script attribution, dev server):

| Ενέργεια | Χρόνος | Ποιος |
|---|---|---|
| «Καθαρισμός ασυνεχειών» | 138–145 ms | React click |
| ενεργοποίηση εργαλείου | 203–245 ms | React click |
| 1ο κλικ σε γραμμή | **303–308 ms** | React: η επιλογή ανοίγει «Ιδιότητες» + ribbon «Στυλ Γραμμής» (UI, όχι έδαφος) |
| 2ο/3ο κλικ | 51–70 ms (+~100 ms scheduler) | React |
| debounced save | 125–188 ms | εσωτερικά του Firestore SDK (το echo φιλτράρεται από `topoStateSignature`) |
| άνοιγμα 3Δ (μία φορά) | 1.564 ms | κατασκευή σκηνής |
| 3Δ σε αδράνεια | καρέ έως 627 ms | render/GPU — `blockingDuration` 0, **κανένα** script |

Το αναφερόμενο «πάγωμα δευτερολέπτων» **δεν αναπαράχθηκε** (ούτε από agent ούτε με το χέρι)· πιθανή αιτία, **αναπόδεικτη**:
μεταγλώττιση chunks του dev server στην πρώτη χρήση.

*(γ) Δημοσίευση, σκέτο Node* (ψυχρή / **διάμεσος 5**):

| Σημεία | `prepareSurveyUpload` | `terrainMapModelOf` | κριτής |
|---|---|---|---|
| 10k | 739 / **288** ms | 234 / **166** ms | 131 / 172 ms |
| ~29k | 613 / **380** ms | 738 / **479** ms | 348 / 304 ms |
| ~100k | 385 / 357 ms → `TERRAIN_TOO_DENSE` (σωστό) | — | 331 / 354 ms |

(jest 10,5 s έναντι Node 0,29 s στα 10k ⇒ ο πίνακας του 5α μετρούσε το περιβάλλον.)

*(δ) Απόφαση* (RAIL: > 50 ms αισθητό, > 100 ms ⇒ εκτός main thread):
- **Viewer / ασυνέχειες: κανένας worker, καμία αλλαγή στον υπολογισμό.**
- **5γ `TerrainPreview`: worker** για `prepareSurveyUpload` + `terrainMapModelOf` πάνω στο **υπάρχον**
  `src/lib/workers/worker-rpc-client.ts` (`createWorkerRpcClient`, `latestOnly`) + `worker-rpc-host.ts` — πρότυπο το
  `spatial-tour/space-detect/space-detect-client.ts` + `.worker.ts`.
- Τα 303 ms του 1ου κλικ είναι UI επιλογής· μετριούνται σε production build πριν από οποιαδήποτε διόρθωση (εκτός εμβέλειας).

**Ευρήματα του 5β στη ζωντανή δοκιμή → νέα βήματα «ορατότητα ασυνεχειών»** (ADR-650 M2-Β): οι επιλεγμένες ασυνέχειες
**δεν σχεδιάζονται** ούτε στην 2Δ ούτε στην 3Δ· το «σύνολο» του hint έμενε μπαγιάτικο· ορφανές ασυνέχειες μετά από νέα
εισαγωγή είναι αόρατες. Σειρά: **Γ** hint από το store ✅ → **Β1** κάτοψη → **Β2** 3Δ → **Β3** λίστα «Ασυνέχειες επιφάνειας»
(Zoom To, υψόμετρα κορυφών, υγεία δεσμού, συγκρούσεις μέσα στη λίστα — Civil 3D Prospector + Resolve Crossing σε ένα).

**Βήμα Γ — το hint λέει πάντα το ζωντανό πλήθος** ✅ (2026-10-25 · ADR-650 v38): πέντε γραφείς ασυνεχειών (κλικ · ribbon
«Καθαρισμός» · έγκριση αυτόματων · επαναφορά επιπέδου · cascade νέας εισαγωγής), μόνο ο πρώτος ενημέρωνε το μήνυμα. Πλέον
**ένας παρατηρητής** (`hooks/canvas/topo-breakline-hint.ts`) όσο το εργαλείο είναι ενεργό· κανένας γραφέας δεν καλεί hint.

**Βήμα Β1 — οι ασυνέχειες φαίνονται στην κάτοψη** ✅ (2026-10-25 · ADR-650 v39 · ADR-040): πάντα ορατές, κίτρινες με
περίβλημα, μοτίβο = πηγή του z (`Breakline.elevationSource`, νέο), κουκκίδες στις κορυφές. Ένας painter
(`components/dxf-layout/topo-breakline-paint/`) για δεσμευμένες **και** υποψήφιες· ο κοινός δρόμος WORLD→οθόνη διόρθωσε
δύο overlays (υποψήφιες, ⊙ QA) που δεν πρόβαλλαν ΕΓΣΑ→DISPLAY.

**Βήμα Β2 — οι ασυνέχειες στην 3Δ** ✅ (2026-10-25 · ADR-650 v40 · ADR-452)

| Υπο-βήμα | Τι | Αρχεία |
|---|---|---|
| Β2.0 | Λεξιλόγιο σε **ορατά px** + προσαρμογείς SVG (στρογγυλά άκρα: dash−w / gap+w) και 3Δ (επίπεδα)· κανόνας «παύλα ποτέ κοντύτερη από το πάχος». Διορθώνει το Ε2 (`8 4` → 11/1 με round caps) | `systems/topography/topo-breakline-style.ts` |
| Β2.1 | Παύλα σε **px οθόνης** στο fat line (4 άγκυρες στο shader του three 0.170, pin test στο πραγματικό shader) | `bim-3d/lines/scene-fat-line{,-screen-dash}.ts` |
| Β2.2 | Κοινός κατάλογος fat υλικών + `screen-dot-material` (εξαγωγή από τις υποψήφιες, N.18) · υλικά casing/core/κουκκίδων | `bim-3d/materials/` |
| Β2.3 | Καθαρός μετατροπέας: πραγματικό z, projector + datum, crop με `coveredIntervals`, ομάδες ανά μοτίβο (≤ 3) · `filterPointsBelowCutY` | `bim-3d/converters/topo-breakline-to-three.ts` · `bim-3d/scene/edge-cut-trim.ts` |
| Β2.4 | `TopoBreaklineLayer` + `resolveTopoHorizontalCutWorldY` + ομαδοποίηση των topo layers | `bim-3d/scene/terrain/{TopoBreaklineLayer,topo-scene-layers,terrain-clip-plane,terrain-clip-math}.ts` |

Ευρήματα του audit του Β2.4:
- **Α3** — η CPU κοπή των ακμών (ADR-452, `applyEdgeCutTrim`) τρέχει **μόνο** μέσα στο `renderFrameWithCaps`, δηλαδή μόνο με
  τομή **κτιρίου**· η κοπή μόνο του εδάφους (η συνηθισμένη: αλλαγή ορόφου) δεν την ενεργοποιεί ποτέ. Γι' αυτό το layer κόβεται
  μόνο του, με τα ίδια καθαρά `clipLineSegmentsToCutY` / `filterPointsBelowCutY`.
- **Α6** — οι παχιές γραμμές θα έμπαιναν στο stencil parity όταν το section box τέμνει το έδαφος· `excludeFromSectionParity` σε κάθε pass.
- **Α9** (καταγραφή, εκτός εμβέλειας) — το `resolveActiveBuildingBaseElevationM` διαβάζει `Bim3DEntitiesStore`, που δεν το ακούει
  ούτε ο cap, ούτε ο controller, ούτε το νέο layer· αλλαγή της βάσης του κτιρίου χωρίς άλλο συμβάν αφήνει την κοπή στην παλιά στάθμη.
- Γνωστό όριο: X/Y τομές + section box δεν κόβουν fat lines (ίδιο με τις ακμές, ADR-452/455).

Επαλήθευση: 33 tests στο `scene/terrain` (layer · σύνολο · resolver) · 193 σουίτες / 1.756 tests (`bim-3d/{scene,converters,materials,lines}` +
`systems/topography`) · μεταλλάξεις **5/5** με επαναφορά sha1 · 3.28 ✅ · ζωντανά: έδαφος on/off, κοπή στάθμης on/off (η ασυνέχεια
των 3 m κόβεται μαζί με την κορυφογραμμή), καμία κονσόλα σφαλμάτων. Μη επαληθευμένα ζωντανά: τα μοτίβα διακεκομμένης/στικτής
(τα δεδομένα δοκιμής έχουν μόνο συνεχείς) και το section box.

**Βήμα Β3 — η λίστα «Ασυνέχειες επιφάνειας»** ✅ (2026-10-26 · ADR-650 v41 · ADR-040) — Civil 3D Prospector ›
Definition › Breaklines **και** η vista «Crossing Breaklines» σε ένα πάνελ, χτισμένο μόνο πάνω σε ό,τι υπάρχει ήδη.

| Υπο-βήμα | Τι | Αρχεία |
|---|---|---|
| Β3.0 | Επαλήθευση Ε5: το επίπεδο δοκιμής είναι «Χωρίς γεωαναφορά» (identity projector) ⇒ το σφάλμα 2Δ Zoom To αποδεικνύεται με test, όχι ζωντανά | — |
| Β3.1 | **Zoom To SSoT**: `topoReviewFocusFrame` (pure, WORLD → DISPLAY κουτί + WORLD κέντρο) + `focusTopoReviewTarget(points, padMm, resolveWorld, preserveZoom)`· QA + αυτόματες ασυνέχειες περνούν από εκεί. `TOPO_REVIEW_FOCUS_PAD_MM = {point 15 m, line 5 m}` (οι τοπικές σταθερές των δύο sections διαγράφηκαν). Το `review-focus.ts` (DISPLAY, ModelFromDrawing) αμετάβλητο | `systems/topography/topo-review-focus.ts` |
| Β3.2 | **Ζεύγος σύγκρουσης**: `BreaklineElevationConflict.keptBreaklineId?` (απόν ⇒ κράτησε σημείο αποτύπωσης)· owner κάθε κόμβου, και του νέου κόμβου διασταύρωσης· μήνυμα QA με ICU `select` (`keptLine`) | `src/lib/terrain/{terrain-types,tin-breakline-resolve,tin-builder}.ts` · `qa/check-breakline-conflicts.ts` |
| Β3.3 | **Undo**: `SetTopoBreaklinesCommand` (`add` / `remove` / `clear`, snapshot, `null` όταν τίποτα δεν αλλάζει) — εργαλείο, ribbon «Καθαρισμός», έγκριση αυτόματων (Ν γραμμές = ΕΝΑ undo). Διαγράφηκαν `addBreakline`/`removeBreakline` (δεύτερη, μη αναιρέσιμη πόρτα) | `core/commands/entity-commands/SetTopoBreaklinesCommand.ts` · `TopoPointStore.ts` |
| Β3.4 | **Μάτι + focus**: `topo-breakline-display-store` `{visible (αποθηκεύεται, προεπιλογή true), focusedId (εφήμερο)}`· 2Δ overlay `null` όταν κρυφό, η εστιασμένη γραμμή τελευταία με πάχος focus + halo (`BREAKLINE_FOCUS_HALO`, κοινό με τις υποψήφιες)· 3Δ πύλη `visible ∧ isLayerShown()` στη βάση των topo layers· toggle στο tab Τοπογραφία **και** στο contextual tab επιφάνειας· το hint του εργαλείου λέει «κρυφές» όσο είναι κρυφές | `topo-breakline-display-store.ts` · `TopoBreaklineOverlay.tsx` · `topo-scene-layer-support.ts` · `TopoBreaklineLayer.ts` · `TopoRibbonToggleWidgets.tsx` · `topo-breakline-hint.ts` |
| Β3.5 | **Πάνελ**: pure `buildBreaklineInventory` (γραμμές: #n του QA, πηγή z σε λέξη, μήκος, εύρος Z, κορυφές, υγεία δεσμού, πλήθος συγκρούσεων· συγκρούσεις = **τα ίδια** flags με το QA) + `TopoBreaklineListSection/Row/PatternSwatch` + `TopoQaFlagRow` (εξαγωγή από το QA). Zoom To με περιθώριο γραμμής· κλικ σε σύγκρουση φωτίζει τη γραμμή που **λύγισε**· αφαίρεση = η ΜΙΑ αναιρέσιμη εντολή· κλείσιμο πάνελ ⇒ καμία γραμμή φωτισμένη. Πέμπτο `TopoReviewPanel` (slot 4) + κουμπί `topo.breaklineList.open` | `topo-breakline-inventory.ts` · `ui/panels/topography/TopoBreaklineList*.tsx` · `TopoQaFlagRow.tsx` · `app/TopoRibbonHost.tsx` |

Αποφάσεις και ευρήματα:
- **Τίποτα δεν παράγεται δεύτερη φορά**: γραμμές από τον ορισμό (`TopoPointStore`), συγκρούσεις από την αναφορά του **ενός**
  τριγωνισμού (`getTopoBuildReport`, κανένα δεύτερο `buildTin`), ταξινόμηση/μήνυμα/σοβαρότητα από τα εξαγόμενα
  `rankBreaklineConflicts` / `breaklineConflictFlag` / `breaklineLabelsOf` — το test καρφώνει την ισότητα με το `checkBreaklineConflicts`.
- **Υγεία δεσμού derived**, ποτέ αποθηκευμένη: `live` / `missing` (σβήστηκε η πηγαία γραμμή — η επιφάνεια κρατά το τελευταίο
  σχήμα, όπως στο Civil 3D, αλλά **το λέμε**) / `none` (εγκεκριμένη αυτόματη)· χωρίς σκηνή ⇒ `null`, ποτέ ψευδές «σβήστηκε».
- **Το μάτι κρύβει, δεν αφαιρεί**: η επιφάνεια κόβεται ακόμα (σημείωση στο πάνελ + στο hint) — Civil 3D «Breaklines» component off.
- Πέρα από το Prospector: Zoom To σε γραμμή του ορισμού (ζητείται στο AUGI από το 2008), η πηγή του z σε λέξη **και** ως
  μοτίβο, η υγεία δεσμού, η σύγκρουση που φωτίζει τη γραμμή.
- Σημάδι SSoT (N.0.2): ο resolver 3Δ των υποψηφίων έγινε κοινός — `resolveTopoLineWorld` / `meanLineElevationMm`
  (`bim-3d/coordination/auto-breakline-world.ts`, πρώην `resolveAutoBreaklineCandidateWorld` / `meanCandidateElevationMm`)·
  `committedBreaklinePaint` κοινό για overlay και swatch.
- Persistence: προαιρετικό `breaklineDisplay` στο topo doc (απουσία ⇒ `visible: true`, παλιά έγγραφα αμετάβλητα· rules χωρίς
  allowlist ⇒ κανένα deploy). Το `topoStateSignature` έγινε `stableStringify({surfaces, ...topoSettingsDocFields(state)})`:
  δομικά πλήρες — κάθε νέο πεδίο ρυθμίσεων μπαίνει αυτόματα στο φίλτρο echo (έκλεισε και κλώνο jscpd).

Επαλήθευση: 130 σουίτες / 1.327 tests (2 skipped) · μεταλλάξεις 4/4 (Β3.4) + 4/4 (Β3.5) με επαναφορά sha1 · 3.28 ✅ · CHECK
3.43 αμετάβλητο (theme tokens). 
Ζωντανά (Chrome, 2026-10-26): 3 γραμμές «άγνωστη πηγή» + 2 συγκρούσεις (1,00/3,00 · 3,00/2,00)· Zoom To 2Δ (εστιασμένη με halo) και 3Δ· κλικ σε σύγκρουση φωτίζει τη #2 που λύγισε με την κλίμακα διατηρημένη· μάτι 2Δ + 3Δ + ribbon συγχρονισμένα, `breaklineDisplay` στο έγγραφο, επιβιώνει reload· αφαίρεση → «Καμία σύγκρουση» → Ctrl+Z → 3 + 2 (έγγραφο ταυτόσημο με πριν)· κλείσιμο πάνελ σβήνει την εστίαση· «σβήστηκε» **αληθινό** (οι `polyline_0..2` δεν υπάρχουν στη σκηνή — επιβεβαιώθηκε επιλέγοντας κάτω από τη γραμμή)· 0 σφάλματα κονσόλας στις αλληλεπιδράσεις.
Ανοιχτά (καταγραφή): Α10 το Zoom To πλαισιώνει όλον τον καμβά — το πλωτό πάνελ μπορεί να κρύψει άκρο της γραμμής·
Α11 η εστίαση φαίνεται μόνο στην 2Δ· Α12 τα id του DXF import είναι ανά δείκτη (`polyline_${index}`) ⇒ μετά από **άλλο**
αρχείο ο δεσμός μπορεί να βγει ψευδώς `live`. Στο commit: `npm run generate:i18n-types` (3.33) +
`npm run text-measure:census` με το `.text-measure-census.json` στο ίδιο commit (3.64).

**Βήμα Β3.6 — επίλυση διασταυρούμενων ασυνεχειών** (2026-10-26 · ADR-650 v42) — Civil 3D «Crossing Breaklines» ›
Use Higher / Lower / Average / Specify Level, μέσα στη λίστα του Β3.

*Έρευνα.* Civil 3D: ανά σημείο τομής κάθε ζεύγους, επιλογή Higher / Lower / Average / Specify + Resolve· ψηλότερη μπλε,
χαμηλότερη κόκκινη· Zoom To / Auto Zoom· Trim για λάθη μήκους· εμβέλεια βάση αποτύπωσης (περνά στην πηγή) ή επιφάνεια
(μένει εκεί). **Δεν τεκμηριώνεται** αν μπαίνει κορυφή, αν αλλάζουν και οι δύο γραμμές, ούτε το undo· καμία μαζική επίλυση,
καμία προεπισκόπηση. Carlson: μόνο επισήμανση. Softree: χειροκίνητα (κορυφή στη μία γραμμή, κουμπωμένη στην άλλη).
Trimble TBC: κόμβος σε κάθε τομή (ήδη το κάνουμε). 12d: δεν βρέθηκε τεκμηρίωση. Για σημείο αποτύπωσης πάνω σε ασυνέχεια
δεν βρέθηκε επίσημη απάντηση· η πρακτική είναι να **βγει** το σημείο από την επιφάνεια (surface edit «Delete Point»).

*Αποφάσεις.*
1. **Κανόνας, όχι ψημένη κορυφή.** Η απόφαση αποθηκεύεται ως `Breakline.crossingResolutions[]`
   `{withBreaklineId, x, y (WORLD mm), rule, z?}` και την εφαρμόζει **ο ένας** resolver σε κάθε χτίσιμο — όπως το Civil 3D
   ξανατρέχει τα surface edits. Λόγος (μετρημένος στον κώδικα): το `rebuiltBreakline` (`topo-source-cascade.ts`)
   ξαναπαράγει τις κορυφές μιας ζωντανής ασυνέχειας από τη γραμμή-πηγή ⇒ μια ψημένη κορυφή θα χανόταν σιωπηλά στην πρώτη
   αλλαγή του σχεδίου. Ο κανόνας επιβιώνει (το cascade αλλάζει μόνο `vertices/closed/elevationSource`), και το «Ψηλότερο»
   μένει ψηλότερο όταν αλλάξει το z μιας γραμμής.
2. **Αντιστοίχιση = ζεύγος (χωρίς σειρά) + θέση** μέσα σε `CROSSING_RESOLUTION_MATCH_MM` = 10 mm. Σημείο που μετακινήθηκε
   πιο μακριά είναι **άλλη ερώτηση**: ο κανόνας δεν εφαρμόζεται αλλού στα τυφλά — αναφέρεται (`unappliedCrossingResolutions`)
   μαζί με εταίρο που χάθηκε ή γραμμές που πλέον συμφωνούν.
3. **Σημείο αποτύπωσης ⇒ υπερισχύει η μέτρηση** (ADR-720): καμία επιλογή κανόνα· το πάνελ το λέει. Η «εξαίρεση σημείου από
   την επιφάνεια» (Civil 3D «Delete Point») είναι ξεχωριστό χαρακτηριστικό ⇒ **Α14**.
4. **Η 3Δ γραμμή περνά από τον κόμβο** (`breaklinesAsCarried`): κάθε σημείο συνάντησης ως κορυφή στο z που κουβαλά η
   επιφάνεια — διορθώνει και την ίδια απόκλιση με τον προεπιλεγμένο κανόνα «νικά η πρώτη» (Ε8).

| Υπο-βήμα | Τι | Αρχεία |
|---|---|---|
| Β3.6.0 | Τύποι (`BreaklineCrossingRule`, `BreaklineCrossingResolution`, `AppliedCrossingResolution`, `CrossingResolutionKey`) + καθαρός κανόνας `crossingRuleZ` + ευρετήριο ανά ζεύγος | `src/lib/terrain/{terrain-types,breakline-crossing-rule}.ts` |
| Β3.6.1 | **Μία πόρτα** `Resolution.decide` για διασταύρωση, κορυφή-πάνω-σε-ασυνέχεια και συγχωνευμένη κορυφή· η σύγκρουση αναφέρεται **με** `resolution` (κανόνας + η δήλωση της γραμμής που κρατήθηκε). Σειρά: κορυφές **πριν** από τις διασταυρώσεις (ένας κανόνας αλλάζει z υπάρχουσας κορυφής, η διασταύρωση παρεμβάλλει από αυτήν) | `tin-breakline-resolve.ts` · `tin-builder.ts` |
| Β3.6.2 | `SetTopoBreaklinesCommand.resolve(Ν αποφάσεις)` / `unresolve(keys)` — Ν = 1 undo· νέα απόφαση για το ίδιο σημείο αντικαθιστά την παλιά (σε όποια γραμμή κι αν ήταν)· `remove` παίρνει μαζί τις ορφανές αποφάσεις στο ίδιο βήμα | `SetTopoBreaklinesCommand.ts` · `breakline-crossing-rule.ts` |
| Β3.6.3 | QA: η λυμένη σύγκρουση **δεν** είναι εύρημα (κατάταξη όλων, μετά φίλτρο ⇒ τα id μένουν ίδια σε QA και λίστα)· Δz = πόσο **διαφώνησαν** οι δύο δηλώσεις (`conflictStatements`). Inventory: ανοιχτές · λυμένες · αποφάσεις που δεν εφαρμόζονται | `check-breakline-conflicts.ts` · `topo-breakline-inventory.ts` |
| Β3.6.4 | Φόρμα κάτω από την επιλεγμένη σύγκρουση (SegmentedControl · «Τιμή» σε μέτρα με κόμμα ή τελεία · `<output>` προεπισκόπησης · Εφαρμογή / Επαναφορά)· «Επίλυση όλων» (Ψηλότερο/Χαμηλότερο/Μέσος όρος — το «Τιμή» δεν έχει νόημα μαζικά), ένα undo ανά επιφάνεια· λίστα αποφάσεων που δεν εφαρμόζονται με «Διαγραφή»· ουδέτερη ταινία στη λυμένη | `topo-breakline-crossing-preview.ts` · `TopoBreaklineConflict{List,Resolve}.tsx` · `TopoQaFlagRow.tsx` · `TopoBreaklineListSection.tsx` · `topo-qa-config.ts` · i18n |
| Β3.6.5 | Η 3Δ γραμμή περνά από κάθε σημείο συνάντησης στο z της επιφάνειας, από την **ίδια** memo αναφορά, με memo ταυτότητας (η cache της προβολής μένει ζεστή) | `src/lib/terrain/breakline-carried.ts` · `TopoBreaklineLayer.ts` |

Πέρα από το vista: **προεπισκόπηση πριν την εφαρμογή** — z, μετατόπιση κάθε γραμμής, αλλαγή κλίσης δίπλα στο σημείο
(rise/run ως την πλησιέστερη κορυφή) με προειδοποίηση πάνω από `BREAKLINE_RESOLUTION_GRADE_WARN` = 0,25 (1:4)· η απόφαση
**μένει ορατή** (λυμένες, με κανόνα και αποτέλεσμα) και αλλάζει/αναιρείται· «Επίλυση όλων»· ο κανόνας κάνει το αποτέλεσμα
**ανεξάρτητο από τη σειρά** των γραμμών (ο προεπιλεγμένος δεν είναι)· απόφαση που δεν εφαρμόζεται πια ονομάζεται, δεν
χάνεται ούτε μετακινείται.

Όρια: η δημοσίευση αγγελίας χτίζει από το αρχείο αποτύπωσης (`listing-terrain-source.ts`), όχι από τον viewer ⇒ εκεί
ισχύει ο προεπιλεγμένος κανόνας. Η 2Δ κάτοψη δεν αλλάζει (το z δεν σχεδιάζεται σε κάτοψη).
**Α14** (ανοιχτό): «εξαίρεση σημείου αποτύπωσης από την επιφάνεια» (Civil 3D «Delete Point» surface edit) — η μόνη
επίλυση που μένει όταν ο μηχανικός εμπιστεύεται την ασυνέχεια περισσότερο από τη μέτρηση.

Επαλήθευση: 248 σουίτες / 2.282 tests (2 skipped) σε `src/lib/terrain` + `systems/topography` + `ui/panels/topography` +
`core/commands/entity-commands` + `bim-3d/scene/terrain` + `bim-3d/converters` · μεταλλάξεις **11/11** με επαναφορά sha1
(+1 ισοδύναμη: ο φρουρός «σημείο αποτύπωσης» στο `decide` — τα σημεία δεν έχουν ποτέ owner, άρα κανένας κανόνας δεν τα
βρίσκει· ο έλεγχος υπάρχει για τον τύπο) · 3.28 ✅ · οι δύο τοπικές «προβολές σε τμήμα» αντικαταστάθηκαν από το
`closestPointOnSegment` / `distanceToSegment` του `src/lib/geometry/planar-polygon.ts` (N.0.2).
**Ζωντανά (Chrome, 2026-10-26) — ΜΕΡΙΚΩΣ**: η λίστα δείχνει 2 ανοιχτές συγκρούσεις + «Επίλυση όλων (2)»· κλικ στη
σύγκρουση 1,00/3,00 ⇒ Zoom To + φόρμα· «Ψηλότερο» ⇒ προεπισκόπηση «→ 3,00 μ · #1 +2,00 μ · #2 0,00 μ» και ⚠ «απότομη
αλλαγή κλίσης έως 27%» (σωστό: 2 m σε ~7,5 m). **Εύρημα → διορθώθηκε**: η φόρμα ζούσε ΜΕΣΑ στη λίστα με `max-height`
και το «Εφαρμογή» κρυβόταν από την κύλιση ⇒ πλέον κάτω από τη λίστα (όπως στο vista: πλέγμα πάνω, επιλογές κάτω).
Ο dev server (ξένη συνεδρία) έπεσε πριν από Εφαρμογή / 3Δ / Ctrl+Z ⇒ ολοκληρώθηκαν στη δεύτερη δοκιμή:
**Ζωντανά (Chrome, 2026-10-26, δεύτερη δοκιμή) ✅**: «Εφαρμογή» ορατό κάτω από τη λίστα · «Μέσος όρος» ⇒ «→ 2,00 μ · #1
+1,00 μ · #2 −1,00 μ», έως 13 % χωρίς ⚠ (κάτω από το 1:4) ⇒ Εφαρμογή ⇒ «1 επιλυμένη σύγκρουση» (πράσινη ταινία +
Επαναφορά), οι ισοϋψείς ξαναχτίστηκαν γύρω από τον κόμβο · 3Δ: οι δύο γραμμές συναντώνται σε **κοινό** κόμβο (η μακριά
«λυγίζει» εκεί) · Ctrl+Z ⇒ 2 ανοιχτές, ισοϋψείς ίδιες με πριν · «Επίλυση όλων (2)» με «Ψηλότερο» ⇒ 2 λυμένες · **ένα**
Ctrl+Z ⇒ και οι δύο ανοιχτές ξανά (έγγραφο δοκιμής ταυτόσημο, undo κενό). **Εύρημα → διορθώθηκε**: το «2 issues» του
Next.js ήταν **δικό μας** — το `ResolveAllBar` τύλιγε το `SegmentedControl` (`<div>`) σε `<p>` ⇒ «`<div>` cannot be a
descendant of `<p>`» (σφάλμα hydration). Τώρα `<div role="group">`. Επειδή το React το αναφέρει **μόνο** με
`console.error` (ποτέ αποτυχία), η σουίτα `TopoBreaklineConflictResolve` απέκτησε φρουρό: κανένα test της δεν εκπέμπει
σφάλμα εμφώλευσης DOM — μετάλλαξη (`<p>` πίσω) **1/1 κόκκινη**, επαναφορά sha1. Επιβεβαίωση ότι το badge χάθηκε μετά το
reload: ο renderer του Chrome πάγωσε στη μεταγλώττιση ⇒ **εκκρεμεί** (καλύπτεται από τον φρουρό).

**Υπο-βήμα 5γ — η προεπισκόπηση εκτός κύριου νήματος** ✅ (2026-10-26 · απόφαση (δ) του 5β · απόφαση 4)

*Έρευνα*: ο Civil 3D ξαναχτίζει την επιφάνεια **στο κύριο νήμα** — το «Out of date» και το «Rebuild – Automatic»
υπάρχουν ακριβώς επειδή μια μεγάλη επιφάνεια παγώνει το πρόγραμμα (αναφορές έως 5′)· το Autodesk προτείνει snapshots
ώστε το επόμενο rebuild να ξεκινά από αποθηκευμένα δεδομένα. Στον ιστό το maplibre-contour βγάζει τις ισοϋψείς σε worker
και το MapLibre ακυρώνει αιτήματα που δεν χρειάζονται πια. Για TBC / 12d / Carlson δεν βρέθηκε δημοσιευμένη πρακτική.

| Αρχείο | Ρόλος |
|---|---|
| `survey-import/survey-preview-points.ts` | Σημεία ⇄ **ένα** `Float64Array` `[x, y, z, …]` — το buffer **μεταφέρεται** (zero-copy) αντί να κλωνοποιηθούν δεκάδες χιλιάδες αντικείμενα. Χωρίς υψόμετρο ⇒ `NaN` ⇒ πάλι χωρίς υψόμετρο, ποτέ `z = 0` (ADR-720). Χωρίς απώλεια: η πόρτα διαβάζει μόνο x, y, z |
| `survey-import/survey-preview-host.ts` | Ο καθαρός χειριστής: `prepareSurveyUpload` (η **ίδια** ετυμηγορία με τον server) + `terrainMapModelOf`. **Κρατά την τελευταία αποτύπωση ανά `key`** (η ιδέα των snapshots του Civil 3D): ίδιο κλειδί ⇒ **κανένας** νέος τριγωνισμός, αλλαγή πλάτους ξαναζωγραφίζει μόνο τον χάρτη· ίδιο κλειδί + πλάτος ⇒ η ίδια απάντηση |
| `survey-import/survey-preview-client.ts` · `.worker.ts` · `-worker-spawn.ts` | Πάνω στο **υπάρχον** RPC (`createWorkerRpcClient` + `latestOnly` + δίχτυ = ο ίδιος χειριστής στο κύριο νήμα)· `transferOf` για το buffer· `warm()` γεννά τον Worker μόλις αρχίσει η ανάγνωση του αρχείου. Το αίτημα σε πτήση **δεν** ακυρώνεται: ≤ 0,5 s στη μεγαλύτερη αποδεκτή αποτύπωση (5β), και ο τερματισμός θα πέταγε την αποτύπωση που κρατά ο Worker |
| `publication/terrain-map-model.ts` + config | `terrainMapModelOf(snapshot, marks, display?)` · `terrainMapWidthClassOf` (κλάσεις 320/480/640/960, **προς τα κάτω** ⇒ ετικέτα για την κλάση ≥ ίδιου μεγέθους στην πραγματική οθόνη). Ύψος ετικέτας = της αναλογίας του σχεδίου, **υψωμένο** στο πάτωμα αναγνωσιμότητας 12 px (`lib/media/legible-screen-text` — το **ίδιο** με την κάτοψη ορόφου, ADR-907). Υπολογίζεται **πριν** τοποθετηθούν οι ετικέτες ⇒ η εγγύηση «χωρίς συγκρούσεις» ισχύει για το ύψος που ζωγραφίζεται. Χωρίς `display` (δημόσια αγγελία · PDF) ⇒ αμετάβλητο |
| `hooks/listings/useSurveyPreview.ts` | **Δύο αλήθειες, χωριστά**: ο **χάρτης** μένει ο τελευταίος που ήρθε, με `updating` όσο ο νεότερος είναι καθ' οδόν (ποτέ κενό, ποτέ πάγωμα)· η **ετυμηγορία** δίνεται **μόνο** για τα τρέχοντα σημεία ⇒ η δημοσίευση **δομικά** δεν μπορεί να στείλει bytes παλιών σημείων. Κλειδί = ταυτότητα πίνακα (`WeakMap`, καθαρό στο StrictMode)· `failed` αντί για αιώνιο «ενημερώνεται»· `disposed` (unmount / StrictMode) **δεν** είναι αποτυχία |
| `hooks/listings/useTerrainSurveyImport.ts` | Το σύγχρονο `useMemo(prepareSurveyUpload)` αντικαταστάθηκε· + `preview`, `setPreviewWidth`. `canPublish` = ετυμηγορία των **τρεχόντων** σημείων |
| `components/listing-detail/terrain/TerrainPreview.tsx` | Λεπτή όψη: μετρά το πλάτος (`useSizeObserver`, content-box), `aria-busy`, ζωντανή περιοχή που μένει **πάντα** στο DOM, παλιός χάρτης αχνός (σεβασμός `prefers-reduced-motion`). i18n `listing-detail:terrain.map.preview.*` (el + en) |

**Πέρα από τους μεγάλους**: ο Civil 3D ή παγώνει ή δείχνει παλιά επιφάνεια **χωρίς να το λέει**· εδώ η οθόνη δεν
παγώνει ποτέ, ό,τι είναι παλιό δηλώνεται, και η αλλαγή πλάτους **δεν** ξανατριγωνίζει.

**Boy scout (N.0.2)**: το πάτωμα 12 px (ADR-907 §11.14) έγινε SSoT· ο ψεύτικος Worker των test βγήκε σε κοινό αρχείο με
πραγματικό `structuredClone` (ADR-884 §4.14). **Εύρημα των μεταλλάξεων**: κανένα test δεν έλεγχε ότι μια **παλιά**
απάντηση που φτάνει μετά την αλλαγή ερώτησης δείχνεται ως παλιός χάρτης και όχι ως ετυμηγορία ⇒ προστέθηκε (Σ1β).

**Επαλήθευση**: 123 σουίτες / 1.620 tests (`lib/terrain` · `lib/workers` · `lib/spatial-tour` · `lib/media` ·
`hooks/listings` · `components/listing-detail` · `server/listing-terrain` · `components/spatial-tour`) · μεταλλάξεις
**12/12** κόκκινες με επαναφορά sha1 · πύλες 3.28 ✅ (0 κλώνοι / 14) · 3.70 ✅ · 3.80 ✅ (0 θανάσιμες) · 3.62 ✅ (0/391) ·
3.47 ✅ · 3.8 ✅ · 3.97 ✅ · **3.22 ✅** (knip) · 3.33 ✅ (`npm run generate:i18n-types` έτρεξε· το `src/types/i18n.ts`
μπήκε στο ίδιο commit με τα κλειδιά, `e3a90fa7`).
⚠️ **Ζωντανά: όχι ακόμη** — το `TerrainPreview` δεν έχει θέση στη σελίδα· τη φόρμα του ιδιοκτήτη τη φέρνει το **Β4.9**.
Ούτε η ροή αρχείο → Worker → χάρτης σε πραγματικό browser (Turbopack `new URL(…, import.meta.url)`) έχει ιδωθεί· το ίδιο
πρότυπο δουλεύει ζωντανά στο `space-detect` (ADR-884 Γ3γ-2β).

**Κλείσιμο Β4.8** ✅ (2026-10-26): τα πέντε υπο-βήματα + βήμα Τ + Β3 έκλεισαν σε commit (`b16210dd` · `e3a90fa7` ·
`d9668974` · `e4249689` · `a1a4f29d` και τα προηγούμενα). Περνούν στο **Β4.9** (ρητά, όχι σιωπηλά): η θέση του
`TerrainPreview` στη φόρμα και η **πρώτη** ζωντανή δοκιμή αρχείο → Worker → χάρτης · αρνήσεις ανάγνωσης αρχείου ·
στατιστικά αγοραστή. Ανοιχτό μικρό: επιβεβαίωση σε browser ότι το badge «2 issues» χάθηκε (καλύπτεται ήδη από τον φρουρό
εμφώλευσης DOM).

### 13.9 Β4.9 — η ενότητα «Τοπογραφικό» στο «Βελτίωσε την αγγελία σου» (+ Δ2) ✅ *(2026-10-26 · ζωντανά: εκκρεμεί)*

**Έρευνα web (2026-10-26, ειλικρινά φτωχή)**: Idealista / Zillow δεν δημοσιεύουν UI «βελτίωσε την αγγελία» — από τρίτους
μόνο: η πληρότητα (ΠΕΑ, κάτοψη) ανεβάζει την κατάταξη, ~15 % των αγγελιών έχει κάτοψη. Land.id: ισοϋψείς ανά 2 ft, χωρίς
% κλίσης· φάκελοι μεσιτών: μέση κλίση %, εύρος υψομέτρου, πηγή + ισοδιάσταση, «επαλήθευσε». Civil 3D: λάθος διαχωριστικό /
δεκαδικό / σύστημα συντεταγμένων αποτυγχάνουν συχνά **σιωπηλά** (φόρουμ Autodesk). Δηλώσεις δικαιωμάτων: καμία
δημοσιευμένη διατύπωση από τους μεγάλους. WAI: χάρτης = «σύνθετη εικόνα» ⇒ κειμενική εναλλακτική.

**SSoT audit**: ο **καταχωρητής** `improve-sections.ts` υπήρχε ⇒ μία γραμμή + ένα component, καμία νέα σελίδα. Ο πίνακας
στηλών/μονάδας του viewer (`TopoColumnMapTable` · `TopoUnitSelect`) ήταν η ΙΔΙΑ ερώτηση ⇒ **μετακόμιση**, όχι δίδυμο.
Οι αρνήσεις της πόρτας ζούσαν στο `property-market` (**245 KB**) — μη φορτώσιμο σε σελίδα ιδιοκτήτη ⇒ μετακόμιση.
Ο προσανατολισμός είχε ήδη λεξιλόγιο (`Orientation`, 8 σημεία). Καμία οθόνη δεν έδειχνε `ListingTerrainStats`.

| Αρχείο | Ρόλος |
|---|---|
| `components/terrain/survey-import/TerrainSurveyImportPanel.tsx` | Όλη η ροή, **ανεξάρτητη από τον κάτοχο** (πόρτα + κάρτα): τι δημοσιεύεται τώρα · αρχείο · στήλες/μονάδες · «αυτό θα δει ο αγοραστής» · Δ2 · δημοσίευση. Το γραφείο (Β4.10) τη φιλοξενεί ίδια. Περιμένει τους χώρους ονομάτων του (`isNamespaceReady`) — ποτέ ωμά κλειδιά |
| `…/SurveyFilePicker.tsx` | Η **μία** ζώνη αρχείων (`FileUploadZone`)· η άρνηση ανάγνωσης λέει την **πράξη** (`role="alert"`). `accept` = `SURVEY_FILE_ACCEPT`, **παράγωγο** των λιστών του sniffer — `.xls` προσφέρεται επίτηδες ώστε να πάρει την ονομασμένη άρνηση |
| `…/SurveyPointsStep.tsx` | Μονάδα: δηλωμένη · προτεινόμενη **με αιτιολόγηση** (ΕΓΣΑ'87 / έκταση) · ζητούμενη. Πλήθος σημείων · γραμμές που παραλείφθηκαν **με αριθμό** (`skipped-rows-summary`) · επαναλήψεις · αντιφάσεις · η ετυμηγορία της πόρτας με το μήνυμα του ίδιου καταλόγου |
| `…/SurveyColumnMapTable.tsx` · `SurveyUnitSelect.tsx` | **Μετακόμισαν από τον viewer** (ADR-650 v43): θεματικά tokens (τα λευκά-διάφανα περιγράμματα ήταν αόρατα στο φωτεινό), κείμενο ≥ 12 px, `<caption>`, όνομα προσβασιμότητας ανά dropdown στήλης, `unit: null` = «διάλεξε» αντί για σιωπηλή προεπιλογή, χωρίς `as` |
| `…/SurveyDeclarationForm.tsx` | Δ2: τοπογράφος (όριο `LISTING_TERRAIN_SURVEYOR_NAME_MAX`) · ημερομηνία (`max` = σήμερα) · κουτάκι δικαιώματος με την εξήγηση «δημοσιεύεται μόνο το παράγωγο» **δίπλα του**. Δεν κρίνει — τον κρίνει ο κριτής της πόρτας. «Αντικατάσταση» όταν υπάρχει δημοσιευμένο. Η έκβαση της αγγελίας (`published · withdrawn · failed · absent · unknown`) με λέξεις |
| `…/PublishedTerrainSummary.tsx` | «Δημοσιευμένο τώρα»: πηγή (τοπογράφος + ημερομηνία) + αριθμοί, από την **κάρτα** (χωρίς mesh) |
| `components/listing-detail/terrain/TerrainStatsList.tsx` | **Στατιστικά αγοραστή** (`<dl>`): έκταση · υψόμετρο · υψομετρική διαφορά · μέση/μέγιστη κλίση · «κατηφορίζει προς» · ισοδιάσταση. Μία όψη για προεπισκόπηση, «δημοσιευμένο τώρα» και τη δημόσια σελίδα (Β5) |
| `lib/terrain/publication/terrain-downslope-orientation.ts` | Αζιμούθιο → ένας από τους **οκτώ** του `Orientation` (τομείς 45°, το όριο στον επόμενο)· επίπεδο ⇒ `null` |
| `lib/terrain/publication/terrain-improve-subject.ts` · `owner-improve-subject.ts` | Ο κάτοχος: `{ target, listingId }`. Ιδιώτης ⇒ `ownerPropertyTerrainTarget` (θεματοφυλακή + φάκελος) · η δημόσια αγγελία έχει την ταυτότητα της καταχώρησης |
| `owner-property/improve/TerrainImproveSection.tsx` + γραμμή `terrain` | Μόνο γη (Δ1, `isLandProperty`), μετά το ΠΕΑ και πριν την αντικειμενική. Διαβάζει ζωντανά τη δημόσια αγγελία (`usePublicListing`) ⇒ το «δημοσιευμένο τώρα» αλλάζει μόνο του μετά την επαναπροβολή |
| i18n **νέος χώρος ονομάτων `terrain-survey`** | Στήλες/ρόλοι/μορφές/μονάδες (από `dxf-viewer-panels`, **88 KB**) · αρνήσεις ανάγνωσης · σημεία · Δ2 · αρνήσεις πόρτας (από `property-market`) **+ `network` / `rejected`** · τρέχον. `listing-detail:terrain.stats.*` · `objective-value:improve.sections.terrain.*` |

**Κεντρικοποιήσεις (N.0.2)**: `CLIENT_REFUSALS` (`lib/api/api-client-types`) — οι δύο αρνήσεις του client ως τιμές, ώστε το
Σ5 να απαιτεί μήνυμα για **κάθε** τιμή του `NamedRefusal` (πριν: η οθόνη θα έβαφε ωμό κλειδί για `network`) ·
`TERRAIN_REFUSAL_MESSAGE_LIMITS` στο συμβόλαιο (ήταν ιδιωτικό αντίγραφο στο test) · `SURVEY_FILE_ACCEPT` στον sniffer
(ο viewer κρατά δικό του `ACCEPT` επειδή δέχεται και LAS/LAZ — άλλη ερώτηση) · fixture `terrain-survey-file-fixture.ts`
κοινό για hook + πάνελ.

**Όριο φόρτωσης (CHECK 3.34 Κ2)**: στατικά το πάνελ φούσκωνε το slice της `/offers/[offerId]/improve` **19.775 → 34.373
bytes** (+74 %) για **κάθε** αγγελία. Θεραπεία = `next/dynamic` **μέσα** στην ενότητα (ο καταχωρητής το ορίζει), όχι
επανασφράγιση ⇒ **20.248 bytes**. Μόνο τα οικόπεδα πληρώνουν ανάγνωση Excel/DXF, Worker, χάρτη.

**Πέρα από τους μεγάλους**: (1) η προεπισκόπηση **δεν** είναι προσέγγιση — χάρτης και αριθμοί βγαίνουν από το ίδιο
στιγμιότυπο που θα δημοσιευτεί· (2) καμία σιωπηλή αποτυχία (αριθμοί γραμμών, ονομασμένη μονάδα, αντιφάσεις στον χάρτη)·
(3) η αξία φαίνεται **πριν** ζητηθεί οτιδήποτε — χωρίς φάκελο η προεπισκόπηση μένει, και λέγεται τι λείπει.

**Επαλήθευση** (2026-10-26): jest **71 σουίτες / 861 tests** πράσινα (topography viewer · `lib/terrain` · `hooks/listings` ·
`listing-detail/terrain` · `components/terrain` · `owner-property` · `lib/api` · `server/listing-terrain`)· νέες σουίτες: πάνελ
(9 — πραγματικός hook + πυρήνας + client, ψεύτικο μόνο το δίκτυο) · ενότητα (3) · προσανατολισμός · γραμμές· Σ5 του συμβολαίου
επεκτάθηκε. Μεταλλάξεις **8/8 κόκκινες** με επαναφορά sha1 (όριο τομέα · κρυμμένες γραμμές · φρουρός χώρων ονομάτων ·
ενότητα σε κάθε τύπο · δημοσίευση χωρίς δικαίωμα · μήνυμα `network` · πόρτα χωρίς φάκελο · χαμένη κάρτα). **Εύρημα των
μεταλλάξεων**: το «χωρίς το κουτάκι δικαιώματος» πέρασε αρχικά πράσινο (το test γέμιζε και τα τρία πεδία μαζί) ⇒ το Δ1 ελέγχει
πλέον ότι τοπογράφος + ημερομηνία **δεν** αρκούν. Πύλες: 3.8 ✅ · 3.9 ✅ · 3.22 ✅ (1 καθαρισμένο) · 3.23 ✅ · 3.28 ✅ (0 κλώνοι /
24) · 3.33 ✅ · 3.34 ✅ · 3.43 ✅ · 3.48 ✅ · 3.53 ✅ · 3.62 ✅ (0/391) · 3.70 ✅ · 3.71 ✅ · 3.73 ✅ · 3.80 ✅ (0) · 3.97 ✅ · μεγέθη ✅.

⚠️ **Ανοιχτά**: (α) **ζωντανή δοκιμή** αρχείο → Worker → χάρτης σε browser — η πρώτη, εκκρεμεί: ο dev server της θύρας 3000
(άλλη συνεδρία) απαντούσε **403 με κενό σώμα** σε κάθε διαδρομή· αγγελία δοκιμής: `ownp_c06bc6a2…` «ΟΙΚΟΠΕΔΟ ΑΝΤΙΠΑΡΟΧΗ
ΔΟΚΙΜΗ» (ιδιώτης, δημοσιευμένη, με φάκελο) · χωρίς φάκελο: `ownp_697570ad…` (TEST-6)· (β) η νομική διατύπωση της
δήλωσης Δ2 θέλει έγκριση (§6, ADR-861) — το κείμενο είναι στο `terrain-survey:declaration.*`, όχι νομικό έγγραφο με
έκδοση· (γ) το `src/types/i18n.ts` είναι παραγόμενο από **όλα** τα locales ⇒ η αναγέννηση περιέχει και ξένα κλειδιά σε εξέλιξη.

### 13.10 Β4.11 — ποιότητα χάρτη εδάφους, μετά την πρώτη ζωντανή δοκιμή *(2026-11-20 · σε εξέλιξη)*

> Ονομασία: η λίστα υποβημάτων του §13 είχε «Β4.11 ADR»· το όνομα «Β4.11» πήγε σε αυτή τη δουλειά (handoff 2026-11-20).

Η πρώτη ζωντανή δοκιμή της ροής αρχείο → Worker → χάρτης (παραγωγή `88622d7d`, TEST-2, `topo-test-ridge-dense.txt`:
`x y z` χωρίς επικεφαλίδα, 793 σημεία, πριόνι με κλίση 1:1 παντού) έβγαλε πέντε ευρήματα: **Α** σειρά στηλών ·
**Β** «Πρακτικά επίπεδο» σε κλίση 100 % · **Γ** ισοδιάσταση που δίνει «barcode» · **Δ** σχεδόν καμία ετικέτα ·
**Ε** χάρτης 719×2153 px. Ένα βήμα τη φορά, ένα commit ανά βήμα.

#### Α — η σειρά των στηλών σε αρχείο χωρίς επικεφαλίδα ✅ *(κώδικας · ζωντανά ✅ `7d2b099` · tests ✅ 73/73 · μεταλλάξεις 2/2)*
**Σύμπτωμα**: πρόταση «Υψόμετρο · Ψ · Χ» ⇒ «549 θέσεις έχουν δύο διαφορετικά υψόμετρα» — αντιφάσεις που **δημιούργησε η
ανάγνωση**, όχι η μέτρηση. **Ρίζα** (τρεις κρίκοι): (1) `topo-mapping-edit` έδινε στον μαντευτή τις **πρώτες 50** γραμμές —
στο αρχείο οι 61 πρώτες έχουν X = 0 και Z = 0· (2) `findElevationColumn` έκρινε τη **σταθερή** στήλη (meanAbs 0) «50× μικρότερη»
⇒ Z· (3) `assignHorizontal` συνέκρινε 24,5 με 0 ⇒ «βόρεια πρώτα» ⇒ αντιστροφή Χ/Ψ. Ο ίδιος μαντευτής τρέχει και στον DXF viewer.

**Λύση στην κλάση** (`src/lib/terrain/survey-import/`, κοινή για viewer και ιδιοκτήτη):
- `topo-mapping-edit`: δείγμα **κατανεμημένο σε όλο τον πίνακα** (`spreadRows`, πρώτη και τελευταία μέσα), 1.000 γραμμές αντί 50.
  Το `proposeColumnMapping` επιστρέφει `{ mapping, basis }`· το `SurveyFileRead` κουβαλά `mappingBasis` δίπλα στο `proposedMapping`.
- `topo-column-sniffer`: **σταθερή στήλη δεν κρίνει μέγεθος** — ούτε ως Ζ ούτε στο «βόρεια πρώτα».
- **Σήμα επιφάνειας** (πέρα από τους μεγάλους — το Civil 3D **δεν** μαντεύει, ζητά μορφή αρχείου): ένα έδαφος είναι
  συνάρτηση z(x, y). Για καθεμία από τις **3** υποψήφιες στήλες Ζ μετριέται πόσες θέσεις δηλώνονται δύο φορές με άλλο υψόμετρο
  (οι 6 μεταθέσεις ανάγονται σε 3: η εναλλαγή Χ↔Ψ δεν αλλάζει το πλήθος). Αποφασιστικό όταν η απορριφθείσα δεύτερη έχει
  ≥ 3 αντιφάσεις **και** ≥ 10× του νικητή. Σειρά ισχύος: επιφάνεια → μέγεθος (×50) → σειρά αρχείου.
  ⚠️ Τα 3 / 10× / 1.000 είναι **εκτίμηση**, όχι αριθμοί από πηγή.
- **Ένας ορισμός** του «ίδια θέση, άλλο υψόμετρο»: το `censusOf` / `surveyFactsOf` **μετακινήθηκε** (όχι αντιγράφηκε) από το
  `survey-upload-preparation` στο νέο `survey-position-census` — ο μαντευτής ρωτά την ίδια μέτρηση που βλέπει ο ιδιοκτήτης,
  χωρίς να φέρει κριτή/κωδικοποιητή στον viewer. Το `survey-upload-preparation` την ξαναεξάγει (κανένας εισαγωγέας δεν άλλαξε).
- **Ορατή βεβαιότητα**: `SurveyPointsStep` → `MappingNote`, κλειδιά `terrain-survey:columns.basis.{surface,magnitude,file-order}`
  (el + en). Σιωπά για επικεφαλίδες και μόλις ο άνθρωπος αλλάξει την πρόταση (πρότυπο `unit.suggested.*`). Το `file-order`
  λέει ρητά «δεν βρήκαμε ένδειξη — έλεγξε τις στήλες».

⚠️ **Όριο**: ο viewer για **νέφος ASCII** διαβάζει μόνο την αρχή του αρχείου (stream στον Worker, `ASCII_SNIFF_ROWS` = 50) ⇒
εκεί δεν υπάρχει δείγμα όλου του αρχείου και το σήμα επιφάνειας σπάνια μιλά· λύνει ο φρουρός σταθερής (στο ridge-dense:
σωστό Χ · Ψ · Ζ με `file-order`). Ο viewer **δεν** δείχνει ακόμη τη σημείωση βεβαιότητας.
⚠️ **Δεν αγγίχτηκε**: ο κανόνας «βόρεια πρώτα ×4» σε **τοπικές** συντεταγμένες μπορεί να αντιστρέψει Χ/Ψ σε μικρό τοπικό σύστημα.
**Άγκυρες**: `topo-column-sniffer.test.ts` (πριόνι πλήρες ⇒ `surface` · 50 πρώτες ⇒ `file-order` · `z x y` ⇒ `surface` ·
PENZD ⇒ `magnitude`) · `survey-file-read.test.ts` Π1 στο νέο σχήμα.
✅ **Έτρεξαν 2026-11-20** (με έγκριση): `topo-column-sniffer` · `survey-file-read` · `survey-preparation` · `useTerrainSurveyImport` ·
`TerrainSurveyImportPanel` ⇒ **5/5 σουίτες, 73/73**. **Μεταλλάξεις** στο `topo-column-sniffer.ts` (επαναφορά μετά από καθεμία):
| Μετάλλαξη | Κόκκινα |
|---|---|
| Μ1 — χωρίς φρουρό σταθερής στο `findElevationColumn` | 1 — «first 50 rows … a constant column judges no magnitude» |
| Μ2 — `findElevationBySurface` πάντα `null` | 2 — «`z x y` … magnitude cannot tell» · «whole sawtooth … from the SURFACE» |

**Ζωντανός έλεγχος** (παραγωγή `7d2b099` κατά `/api/build-info`, TEST-2 `/offers/ownp_330a5a4b…/improve`, μόνο
προεπισκόπηση — τίποτα δεν δημοσιεύτηκε):

| Αρχείο | Στήλες | Βάση | Αντιφάσεις | Αποτέλεσμα |
|---|---|---|---|---|
| `topo-test-ridge-dense.txt` (793) | Χ · Ψ · Υψόμετρο | `surface` | 0 (ήταν 549) | ✅ |
| `topo-test-ridge-zigzag.txt` (793) | Χ · Ψ · Υψόμετρο | `surface` | 0 · ανάγλυφο 3,0 m | ✅ |
| `topo-test-ridge.txt` (117, 728 bytes) | — | — | — | ⚠️ δεν φορτώθηκε |

⚠️ Το zigzag η πρόβλεψη το έλεγε `file-order` — το σήμα επιφάνειας αποφάσισε (σωστά): η πρόβλεψη ήταν λάθος, όχι ο κώδικας.
🔴 **Νέο εύρημα (εκτός Α)**: το κοινό `FileUploadZone` απορρίπτει αρχεία < 1 KB (`UPLOAD_LIMITS.MIN_FILE_SIZE` = 1024,
`src/config/file-upload-config.ts:140`) ⇒ ένα έγκυρο μικρό τοπογραφικό (117 σημεία) δεν φτάνει ποτέ στον αναγνώστη· η
άρνηση είναι μόνο ένα toast «Το αρχείο είναι πολύ μικρό» που χάνεται, η ζώνη μένει άδεια.
✅ **Λύθηκε (κώδικας, 2026-11-20 · ADR-054 «Κάτω όριο μεγέθους»)**: «άδειο» = 0 bytes (`MIN_FILE_SIZE` 1024 → 1, ίδιο με τους
servers και το Uppy)· νέο prop `minSize` στη ζώνη· το τοπογραφικό περνά `minSize={0}` ⇒ ακόμη και το κενό φτάνει στον αναγνώστη,
που το λέει **inline** (`read.refusals.empty`) αντί για toast. Και οι αρνήσεις της ίδιας της ζώνης (κενό · πολύ μεγάλο)
έγιναν inline (`FileUploadRefusals`, ADR-054 «Αρνήσεις inline»). Άγκυρα `upload-zone-min-size.test.tsx` (Ζ1–Ζ4).
✅ **Έτρεξαν 2026-11-20** (με έγκριση): `upload-zone-min-size` · `TerrainSurveyImportPanel` · `upload-zone-offers` ⇒ **15/15**.
Μεταλλάξεις: `MIN_FILE_SIZE` 1024 ⇒ 2 κόκκινα (Ζ1, Ζ4) · χωρίς `minSize={0}` ⇒ 1 (Ζ3) · πίσω σε toast ⇒ 2 (Ζ2, Ζ4). Ζωντανός έλεγχος με `topo-test-ridge.txt` μετά το deploy.
Επίσης ορατό, αναμενόμενο: «Πρακτικά επίπεδο — καμία κύρια κατεύθυνση» σε κλίση 100 % (βήμα **Β**).

#### Ζωντανός έλεγχος μικρού αρχείου — `topo-test-ridge.txt` ✅ *(2026-11-21, παραγωγή `a69a98c3`, Chrome)*
Πριν από το `a69a98c3` (ADR-054) το ανέβασμα έκοβε κάθε αρχείο κάτω από `MIN_FILE_SIZE` = 1024 bytes ως «πολύ μικρό». Τώρα
«άδειο» σημαίνει 0 bytes. Δοκιμή: TEST-2 `/offers/ownp_330a5a4b…/improve` → «Τοπογραφικό και ανάγλυφο» → επιλογή του
`HANDOFFS/topo-test-ridge.txt` (**728 bytes**, `x y z` χωρίς επικεφαλίδα, 117 σημεία).
- Έγινε δεκτό ✅. Δεν εμφανίστηκε κανένα toast ή άρνηση («μικρό»/«άδειο») και η κονσόλα δεν έδειξε σφάλματα.
- Ο αναγνώστης έδειξε στήλες **Χ (Easting) · Ψ (Northing) · Υψόμετρο**, με τη σημείωση βάσης «Βρήκαμε το υψόμετρο από τα ίδια τα
  σημεία…» (`surface`, άρα ζωντανή επιβεβαίωση και της **Α** για αυτό το αρχείο). Μονάδες: πρόταση «Μέτρα». «117 σημεία · 117 με
  υψόμετρο». Εμφανίστηκε η προεπισκόπηση «Αυτό θα δει ο αγοραστής».
- Μόνο προεπισκόπηση. Δεν πατήθηκε κανένα κουμπί αποθήκευσης ή δημοσίευσης. Το «Δημοσιευμένο τώρα» έμεινε «η αγγελία δεν έχει
  ακόμη ανάγλυφο εδάφους».

## 14. Β6 — θεατής εδάφους: κάτοψη + 3Δ στη σελίδα του ιδιώτη *(σε εξέλιξη, 2026-11-21)*

**Αίτημα Giorgio (2026-11-21)**: «τέτοιου τύπου ανάγλυφο να φαίνεται στη σελίδα του ιδιώτη, σε κάτοψη και σε 3Δ, όπως
στα τοπογραφικά του DXF viewer».

**Αποφάσεις Giorgio (2026-11-21)**:
- και στη δημόσια αγγελία **και** στην προεπισκόπηση του «Βελτίωσε», με μία κοινή όψη·
- η κάτοψη αποκτά διακόπτη **Υψόμετρα | Κλίσεις**·
- πλήρες 3Δ **με τον κύβο του viewer**: τοιχώματα, ισοϋψείς, περιστροφή με ποντίκι και αφή, επαναφορά, κάθετη υπερβολή
  με ορατή ένδειξη.

**Τι ΔΕΝ χρειάζεται**: το δημοσιευμένο στιγμιότυπο κουβαλά **ήδη** το mesh (`positions` x,y,z σε τοπικό πλαίσιο,
`triangles`, `slopeClass`, §10). Άρα δεν απαιτείται αλλαγή server, νέος γραφέας (3.105) ή νέα απόφαση αποκάλυψης.

**Υποβήματα** (ένα commit το καθένα): Β6.1 μία υψομετρική κλίμακα · Β6.2 κάτοψη με υψομετρικές ζώνες + διακόπτης ·
Β6.3 κύβος του viewer στο `src/lib/three/view-cube/` (re-export) · Β6.4 καθαρή γεωμετρία 3Δ + αναγνώστης στιγμιοτύπου ·
Β6.5 θεατής 3Δ (σκέτο three, lazy) · Β6.6 καρτέλα «Ανάγλυφο» στη δημόσια αγγελία · Β6.7 προεπισκόπηση «Βελτίωσε».

### 14.1 Β6.1 — μία υψομετρική κλίμακα για viewer και αγγελία *(κώδικας ✅ · tests γραμμένα, δεν έτρεξαν)*

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/terrain/elevation-ramp.ts` | **Νέο σπίτι**: οι 5 στάσεις (`TERRAIN_ELEVATION_RAMP`), ο **ένας** αξιολογητής (`writeLinearRampColor`, χωρίς δέσμευση μνήμης ανά κορυφή), `writeTerrainElevationColor` (γραμμικό, για 3Δ) και `terrainElevationHex` (sRGB, για το SVG). Χωρίς three |
| `src/lib/color/srgb-transfer.ts` | **Μετακόμισαν αυτούσια** τα `srgbToLinearUnit` / `linearToSrgbUnit` (IEC 61966-2-1) μαζί με τον σχολιο-φρουρό του `0.04045`. Το `dxf-viewer/config/color-math.ts` τα επανεξάγει (ADR-694 Φ10) |
| `src/lib/color/true-color.ts` | **Μετακόμισαν αυτούσια** τα `trueColorToHex` / `hexToTrueColor`. Το `dxf-viewer/utils/dxf-true-color.ts` τα επανεξάγει (30 εισαγωγείς, κανένας δεν άλλαξε) |
| `dxf-viewer/bim-3d/converters/terrain-elevation-ramp.ts` | Κρατά τις υπογραφές `writeTerrainRampColor` / `writeTerrainCutFillColor` (το `tin-to-three.ts` δεν άλλαξε) και **καλεί** τον πυρήνα. Το cut/fill ramp μένει εδώ ως **δεδομένα** (αφορά μόνο τον viewer) |

**Αποφάσεις**
- **Τα μαθηματικά του three.js, χωρίς το three.js**: στάσεις sRGB → γραμμικό (ό,τι κάνει το `THREE.Color.setHex` με το
  ColorManagement ενεργό) → παρεμβολή στον γραμμικό χώρο. Το hex της κάτοψης είναι το **ίδιο** γραμμικό χρώμα,
  κωδικοποιημένο πίσω σε sRGB. Έτσι κάτοψη και 3Δ δείχνουν το ίδιο υψόμετρο με το ίδιο χρώμα, χωρίς δεύτερη παρεμβολή.
- **Μετακόμιση, όχι αντίγραφο** (Α1): το `src/lib` δεν εισάγει από το subapp, και κανένα νέο σύμβολο δεν μπαίνει στο
  `.dxf-viewer-public-api.json`.
- ⚠️ **Εντοπίστηκε, δεν αγγίχτηκε** (κανόνες 2026-11-05): το `src/lib/landing/hero-legibility.ts:59` κρατά ιδιωτικό
  αντίγραφο του EOTF (`linear`). Μπορεί πλέον να εισάγει το `@/lib/color/srgb-transfer`.

**Tests (γραμμένα, δεν έτρεξαν — αναμένουν έγκριση)**
- `bim-3d/converters/__tests__/terrain-elevation-ramp.test.ts`: χαρακτηρισμός με μάρτυρα την **παλιά** υλοποίηση
  (`THREE.Color.setHex` + `lerp`), 19 δείγματα ανά κλίμακα, μαζί με NaN/±∞ και εκτός εύρους.
- `src/lib/terrain/__tests__/elevation-ramp.test.ts`: κάθε στάση δίνει το δικό της hex · περιορισμός · το hex είναι το
  γραμμικό χρώμα σε sRGB · η παρεμβολή γίνεται σε γραμμικό χώρο.
- Υπάρχουσες που πρέπει να μείνουν πράσινες: `config/__tests__/color-math-srgb-transfer.test.ts` (μέσω re-export).
- ✅ **Έτρεξαν 2026-11-21** (με έγκριση): 3 σουίτες, **16/16**. Μετάλλαξη: χωρίς μετατροπή του κόκκινου καναλιού σε
  γραμμικό ⇒ **4 κόκκινα**· επαναφορά byte προς byte. Commit `3858de3d` (πύλες ✅).

### 14.2 Β6.2 — κάτοψη με υψομετρικές ζώνες + διακόπτης «Υψόμετρα | Κλίσεις» *(κώδικας ✅ · tests ✅ 52/52 · μεταλλάξεις 2/2)*

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/terrain/publication/terrain-map-elevation-bands.ts` | `elevationBandsOf` · `contourLevelsOf`: **ακριβείς** ζώνες ανάμεσα σε διαδοχικά επίπεδα ισοϋψών. Κάθε τρίγωνο κόβεται (Sutherland–Hodgman) στα δύο επίπεδα κάθε ζώνης που διασχίζει. Τα κομμάτια είναι κυρτά, οπότε τριγωνοποιούνται με βεντάλια |
| `terrain-map-regions.ts` | Το `regionPathData` δέχεται πλέον `Pick<ListingTerrainMesh, 'positions'>`, ώστε οι ζώνες να ζωγραφίζονται από την **ίδια** συνάρτηση (τύπος μόνο, καμία αλλαγή συμπεριφοράς). Το `triangleArea` **εξάγεται**: το CHECK 3.28 βρήκε δίδυμο `areaOf` στις ζώνες (7 γρ. / 76 tokens), που αφαιρέθηκε |
| `terrain-map-model.ts` | + `elevationBands` · `elevationRangeM` (από τα `stats` του στιγμιοτύπου) |
| `components/listing-detail/terrain/TerrainMapSvg.tsx` | + `ElevationLayer` · prop `fill: 'elevation' \| 'slope'` |
| `TerrainElevationLegend.tsx` (νέο) | Λωρίδα των ζωνών **σε αναλογία** εύρους (διακοσμητική, `aria-hidden`) + «Χαμηλότερο / Υψηλότερο» σε κείμενο |
| `TerrainContourMap.tsx` | Διακόπτης με τον κοινό `SegmentedControl`. Προεπιλογή **Υψόμετρα**, όπως στον viewer. Στις «Κλίσεις» εμφανίζονται ο πίνακας κλάσεων και η ένδειξη «ενδεικτικές» (Α6), που αφορούν **μόνο** τις κλάσεις κλίσης |
| `listing-detail.json` (el/en) · `src/types/i18n.ts` (παραγόμενο) | `terrain.map.descriptionElevation` · `fill.{label,elevation,slope}` · `elevation.{caption,low,high}` |

**Αποφάσεις**
- **Τα όρια των ζωνών είναι τα επίπεδα που ήδη ζωγραφίζονται** (`contours[].levelM` του στιγμιοτύπου), όχι δεύτερη
  γεννήτρια επιπέδων. Έτσι το χρώμα αλλάζει ακριβώς πάνω στη γραμμή. Ο χρωματισμός ολόκληρων τριγώνων με το μέσο ύψος τους
  θα έδινε «σκαλοπάτια» που διασχίζουν τις ισοϋψείς, γι' αυτό απορρίφθηκε.
- **Χωρίς ραφές**: το σημείο τομής κλειδώνεται ανά **αρχική ακμή + επίπεδο** και υπολογίζεται από τις αρχικές κορυφές.
  Δύο τρίγωνα με κοινή ακμή παίρνουν **τις ίδιες** κορυφές, το εκλεπτυσμένο πλέγμα είναι συμβατό, και κάθε ζώνη βγαίνει
  ένα path από το `tinBoundaryLoops`. Κορυφή ακριβώς πάνω σε επίπεδο ανήκει στη ζώνη από πάνω· κομμάτια μηδενικού
  εμβαδού πετιούνται.
- **Χρώμα ως `fill` από το μοντέλο, όχι token CSS** (απόκλιση από την αρχή της παλέτας, Β4.8 υπο-βήμα 3). Η κλίμακα είναι
  **συνεχής** (ένα χρώμα ανά ύψος), όχι κλειστή λίστα κλάσεων. Και η **ίδια** τιμή πρέπει να φτάνει στο three (Β6.5), που δεν
  διαβάζει CSS. Μία πηγή λοιπόν: το `@/lib/terrain/elevation-ramp`. Καμία πύλη χρώματος δεν κρίνει `fill` από δεδομένα
  (ελέγχθηκε: 3.7 μόνο ωμές κλάσεις Tailwind· προηγούμενα `WorkerPin`, γραφήματα).
- **Λωρίδα, όχι πίνακας**, για το κλειδί των υψομέτρων: έως ~30 ζώνες θα έκαναν πίνακα που κρύβει τον χάρτη.

**Tests**
- `publication/__tests__/terrain-map-elevation-bands.test.ts`, πάνω σε αληθινά στιγμιότυπα:
  - **επίπεδο** 10 %: συνέχεια ζωνών · όρια = επίπεδα ισοϋψών · μερίδιο = εύρος / ανάγλυφο (ακριβώς) · **ένας** δακτύλιος
    ανά ζώνη (χωρίς ραφή) · κάθε κορυφή στο όριο ή πάνω στην ισοϋψή της · χρώμα = κλίμακα στο μέσο ύψος. Κορυφές ακριβώς
    πάνω σε επίπεδα·
  - **λόφος**: άθροισμα 1, κορυφή = ένας δακτύλιος·
  - **επίπεδο έδαφος**: μία ζώνη.
- `components/listing-detail/terrain/__tests__/TerrainContourMap.test.tsx`:
  - τα 4 tests κλάσεων κλίσης πατούν πρώτα «Κλίσεις»·
  - νέα: προεπιλογή Υψόμετρα (ζώνες με `fill` του μοντέλου, χωρίς στρώμα/πίνακα κλίσης, χωρίς «ενδεικτικές»), λωρίδα με
    κείμενο, η περιγραφή του SVG ακολουθεί τον χρωματισμό.
- ✅ **Έτρεξαν 2026-11-21** (με έγκριση): `terrain-map-elevation-bands` · `TerrainContourMap` · `TerrainPreview` ·
  `terrain-map-model` · `terrain-map-palette` ⇒ **5 σουίτες, 52/52**. Μεταλλάξεις (επαναφορά μετά από καθεμία):

| Μετάλλαξη | Κόκκινα |
|---|---|
| Μ1 — σημείο τομής **χωρίς** κοινό κλειδί ανάμεσα σε γειτονικά τρίγωνα | 2 — «ΕΝΑΣ δακτύλιος» (επίπεδο · λόφος) |
| Μ2 — χρώμα στο κάτω όριο της ζώνης αντί για το μέσο | 2 — «χρώμα = κλίμακα στο μέσο ύψος» (επίπεδο · λόφος) |

### 14.3 Β6.3 — ο κύβος του viewer στο `src/lib/three/view-cube/` *(μετακόμιση αυτούσια, συνταγή `planar-polygon`)*

**Γιατί**: ο θεατής 3Δ της αγγελίας (Β6.5) θέλει **τον ίδιο** κύβο με τον viewer (απόφαση Giorgio). Ο κύβος ζούσε πίσω από το
σύνορο του subapp (CHECK 3.62)· ένα δεύτερο αντίγραφο θα ήταν ακριβώς ο διπλασιασμός που απαγορεύει ο N.18.

**Audit (grep, 2026-11-21)**: ο κύβος εξαρτάται μόνο από `three`, 4 τύπους του `viewport-types.ts`, το `matchIsoCanonicalView`
και το `trueColorToHex` (ήδη στο `@/lib/color/true-color`, Β6.1). Εισαγωγείς απ' έξω: `view-cube.ts` ← 6 αρχεία του
`bim-3d/scene/*` · `canonical-views.ts` ← 4 αρχεία του viewport + `canonical-views.test.ts` · τα `-mesh` / `-overlay` /
`-highlight` **κανείς** · το `-scissor` μόνο το δικό του test. Τα κείμενα του κύβου έρχονται από τον καταναλωτή (`labels`).

| Νέο σπίτι (`src/lib/three/view-cube/`) | Παλιά διαδρομή (`dxf-viewer/bim-3d/viewport/`) |
|---|---|
| `view-cube.ts` · `-mesh` · `-overlay` · `-highlight` · `-scissor` (`git mv`, μόνο διαδρομές εισαγωγής) | `view-cube/view-cube.ts` = **re-export** (`createViewCube`, `ViewCubeEngine`)· τα άλλα 4 **δεν** αφήνουν re-export (κανένας εισαγωγέας ⇒ θα ήταν νεκρό, CHECK 3.22) |
| `canonical-views.ts` | `canonical-views.ts` = **re-export** των 5 συμβόλων που ζητούνται |
| `canonical-view-types.ts` (**νέο**: `ProjectionMode` · `CanonicalViewId` · `OrthoCanonicalViewId` · `CanonicalViewDef`) | `viewport-types.ts` = `export type … from` ⇒ οι 15 καταναλωτές ανέγγιχτοι |
| `__tests__/view-cube-scissor.test.ts` (μετακόμισε μαζί με τον κώδικά του) | — |

- Μένει στον viewer: `view-cube-context-menu.tsx` (React + i18n `bim3d`). Χωρίς barrel, χωρίς γραμμή στο
  `.dxf-viewer-public-api.json`: το `lib` δεν εισάγει από subapp, άρα το 3.62 δεν εμπλέκεται.
- Το `CanonicalViewDef.labelKey` κουβαλά κλειδιά του namespace `bim3d`· μένουν ως έχουν (η αγγελία δεν τα διαβάζει).
- **Εύρημα για αφή**: στη μετακόμιση έμεινε ως είχε· διορθώθηκε χωριστά στο §14.3β.

### 14.3β Β6.3β — ο κύβος σε οθόνη αφής *(κώδικας ✅ · tests ✅ 23/23 · μετάλλαξη 1/1)*

**Τι έλειπε** (επαληθευμένο στον κώδικα): (1) το επίπεδο αφής δεν είχε `touch-action: none` ⇒ η σύρση με το δάχτυλο γινόταν
κύλιση σελίδας και ο browser έστελνε `pointercancel`· (2) δεν υπήρχε χειριστής `pointercancel` / `lostpointercapture` ⇒ το
`isPointerDown` έμενε «κολλημένο» και η επόμενη κίνηση περιέστρεφε την όψη· (3) το σπίτι και τα βέλη εμφανίζονταν μόνο με
`mouseenter` ⇒ σε αφή ήταν **απρόσιτα**.

**Αλλαγές** (μόνο `src/lib/three/view-cube/view-cube.ts`, 490 γρ.):
- `touchAction: 'none'` στο ίδιο `Object.assign(canvas.style, …)` (imperative DOM, όχι JSX ⇒ ο N.3 δεν εμπλέκεται).
- `endPointerGesture()` για `pointercancel` + `lostpointercapture`: καθαρίζει την κατάσταση **χωρίς** κλικ· ιδεμποτές· οι
  listeners αφαιρούνται στο `dispose`.
- `deviceLacksHover()` = `matchMedia('(hover: none)')` (ίδιο κριτήριο με το `[@media(hover:none)]` του `SnapGallery`)· χωρίς
  `matchMedia` ⇒ false. Σε αφή το σπίτι + τα βέλη μένουν **μόνιμα** ορατά· η αδιαφάνεια του κύβου εξακολουθεί να ακολουθεί το hover.
- Έρευνα: η τεκμηρίωση της Autodesk περιγράφει μόνο desktop (το σπίτι κρύβεται ή εξασθενεί όταν ο κέρσορας απομακρύνεται,
  ρυθμιζόμενη αδιαφάνεια). Για αφή **δεν βρέθηκε** τεκμηρίωση· χωρίς hover δεν υπάρχει «απομάκρυνση», άρα το «πάντα ορατό» είναι
  η μόνη επιλογή που κρατά το σπίτι προσβάσιμο.

**Επίδραση στον viewer**: καμία στο desktop (ενεργοποιείται μόνο σε αφή ή ακύρωση)· σε tablet κερδίζει τα ίδια.

**Tests** (με έγκριση, 2026-11-21): νέο `__tests__/view-cube-touch.test.ts` (6, με θετικά controls) + `view-cube-scissor` +
`canonical-views` ⇒ **23/23**. Μετάλλαξη «το `endPointerGesture` δεν κάνει τίποτα» ⇒ **2 κόκκινα** (`pointercancel` ·
`lostpointercapture`), επαναφορά επαληθευμένη. `jscpd:diff` καθαρό.

### 14.4 Β6.4 — αναγνώστης στιγμιοτύπου + καθαρή γεωμετρία 3Δ *(κώδικας ✅ · tests ✅ 33/33 · μεταλλάξεις 2/2)*

**`listing-terrain-snapshot-reader.ts`** — ο ΕΝΑΣ αναγνώστης του gzip JSON του ραφιού. `readListingTerrainSnapshot(raw)` ⇒
`{ok, snapshot}` ή ονομασμένη άρνηση: `unknown-version` · `malformed` · `non-finite` · `positions-not-triples` ·
`index-out-of-range` · `slope-class-mismatch` · `empty-mesh` · `too-dense` · `inconsistent-stats`. Ποτέ προεπιλογή.
Δύο στρώσεις: **zod** για το σχήμα (ίδιο εργαλείο με το `listing-terrain-source.ts`) + **ένας σφιχτός βρόχος** για τους
μεγάλους επίπεδους πίνακες (τριάδες, δείκτες εντός ορίων, μία κλάση ανά τρίγωνο).

**`terrain-3d-geometry.ts`** — `buildTerrain3dGeometry(snapshot, {verticalExaggeration})`, χωρίς three, έξοδος typed arrays:
- άξονες Y-up: X = ανατολή, **−Z = βορράς** (η πυξίδα του κύβου), Y = (υψόμετρο − min) × υπερβολή·
- **επιφάνεια** με χρώμα ανά κορυφή από τη ΜΙΑ κλίμακα, κανονικοποιημένο στα `stats.min..max` (ίδιο με την κάτοψη Β6.2 και τον
  viewer)·
- **όγκος εδάφους** = τοιχώματα + **πάτος**. Τα τοιχώματα από το `tinBoundaryEdges`, που δίνει κάθε ακμή συνόρου με τη φορά
  του τριγώνου της ⇒ το εσωτερικό είναι πάντα αριστερά, άρα το «έξω» είναι γνωστό **χωρίς μαντεψιά, και στις τρύπες**. Ο πάτος
  είναι τα ίδια τρίγωνα στη βάση, αντεστραμμένα (ακριβώς το αποτύπωμα). Έρευνα: Cesium «skirts» + PR #11460 (skirt χωρίς πάτο
  αφήνει το φως να διαρρέει)·
- βάθος βάσης `max(5 % της μεγαλύτερης διάστασης, 1 m)`, **ανεξάρτητο** από την υπερβολή·
- **ισοϋψείς** ως ζεύγη σημείων (`LineSegments2`), κύριες/δευτερεύουσες χωριστά, στο `levelM` χωρίς ανύψωση (το z-fighting
  λύνεται με `polygonOffset` στον θεατή)·
- υπερβολή μόνο από το κλειστό σύνολο `LISTING_TERRAIN_3D_EXAGGERATIONS = [1, 2, 3]` (config) ⇒ αλλιώς άρνηση, όχι κλάδεμα.

**Tests** (με έγκριση, 2026-11-21): `listing-terrain-snapshot-reader.test.ts` (ό,τι γράφει ο **αληθινός** builder, μετά από
JSON, διαβάζεται αυτούσιο + κάθε άρνηση) · `terrain-3d-geometry.test.ts` (τοιχώματα = 2 × ακμές συνόρου σε επιφάνεια **με
τρύπα**, κάθε τοίχωμα κοιτά έξω, πάτος προς τα κάτω, υπερβολή μόνο στο Y, βορράς = −Z, Y ισοϋψούς, άκρα κλίμακας) ⇒
**33/33**. Fixture: `__tests__/fixtures/terrain-3d-fixtures.ts`.

| Μετάλλαξη | Κόκκινα |
|---|---|
| Μ1 — τοίχωμα με ανάποδη φορά | 1 — «κάθε τοίχωμα κοιτά ΕΞΩ» |
| Μ2 — η υπερβολή κλιμακώνει και το X | 1 — «αλλάζει ΜΟΝΟ το Y» |

### 14.5 Β6.5 — ο θεατής 3Δ + «Κάτοψη | 3Δ» *(κώδικας ✅ · tests ✅ 85/85 · μεταλλάξεις 4/4)*

**SSoT audit (grep, 2026-11-21)**: εκτός subapp **κανείς** δεν χρησιμοποιεί `OrbitControls` / `LineSegments2`. Ξαναχρησιμοποιούνται:
ο κύβος (`@/lib/three/view-cube/*`), η πλαισίωση του viewer (μετακόμισε, βλ. κάτω), `@/lib/motion/animate-frames` +
`easing` + `@/lib/a11y/reduced-motion` για τις πτήσεις, `isWebGLAvailable`, `ListingStageFailure`,
`MODEL_STAGE_ASPECT_CLASS`, `Tabs` / `SegmentedControl`, `@/hooks/useEventCallback`. Το `viewport-animation.ts` του viewer
**δεν** μετακόμισε: οδηγείται από το δικό του RAF loop, ενώ εδώ το `animateFrames` (με `AbortSignal`) είναι ήδη το SSoT της
δημόσιας σελίδας (περιήγηση).

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/three/camera/viewport-framing.ts` | **Μετακόμισε αυτούσιο** (`git mv`) από το `dxf-viewer/bim-3d/viewport/` — μόνο διαδρομές εισαγωγής. Ένας εισαγωγέας (`viewport-camera.ts`, 1 γραμμή)· χωρίς re-export στην παλιά διαδρομή |
| `src/lib/three/camera/framing-constants.ts` (νέο) | `DEFAULT_ORTHO_SIZE` · `ORTHO_CAMERA_UP` · `FRAME_PADDING_FACTOR`. Το `viewport-constants.ts` (που εισάγει `DXF_TIMING`, άρα δεν μετακομίζει όλο) τα **επανεξάγει** ⇒ οι καταναλωτές του viewer ανέγγιχτοι |
| `components/listing-detail/terrain/3d/terrain-3d-camera.ts` | Καθαρά μαθηματικά: `terrainBox` · `terrainOrbitLimits` · `clampAboveHorizon` · `terrainPoseFor` (πάνω στο `computePerspectiveFraming`) · `orbitAround` |
| `…/3d/terrain-3d-scene.ts` | Ανέβασμα των buffers του Β6.4: επιφάνεια, χώμα, ισοϋψείς (`LineSegments2`), φώτα· `replace` · `setLineResolution` · `dispose` |
| `…/3d/terrain-3d-flight.ts` | Πτήση κάμερας με ακύρωση· μία τη φορά |
| `…/3d/terrain-3d-engine.ts` | Renderer (DPR ≤ 2, διαφανές), `OrbitControls`, κύβος, καρέ κατ' απαίτηση, context-lost, `dispose` |
| `…/3d/terrain-3d-palette.ts` | Χώμα, μελάνι ισοϋψών (= `--plan-ink` / `--plan-ink-muted`), φως |
| `…/3d/useTerrain3dEngine.ts` · `…/3d/Terrain3dCanvas.tsx` | Κάτοχος στο React (`ResizeObserver`) · ο καμβάς (μόνο μέσω `dynamic`), ένδειξη υπερβολής, «Αρχική όψη», `figcaption` |
| `terrain/TerrainViewStage.tsx` | Καρτέλες «Κάτοψη \| 3Δ», κάρτα εισόδου, χωρίς WebGL, 1×/2×/3×. Καταναλωτές: Β6.6 / Β6.7 |
| `listing-detail.json` (el/en) · `src/types/i18n.ts` | `terrain.view.{tabs,threeD,exaggeration,cube}` |

**Αποφάσεις**
- **Έρευνα**: three.js manual «Rendering on Demand» (το `change` ζητά καρέ, το `controls.update()` μέσα στο καρέ συνεχίζει την
  αδράνεια) · Sketchfab (1 δάχτυλο περιστροφή, 2 μετατόπιση, τσίμπημα ζουμ = προεπιλογή `OrbitControls`) · Cesium
  `maximumTiltAngle` (καμία κάμερα κάτω από την επιφάνεια).
- **Προοπτική μόνο**: η όψη του κύβου είναι **κατεύθυνση**, όχι εναλλαγή σε ορθογραφική.
- **Ποτέ κάτω από το έδαφος**: πολική γωνία ≤ 85°· ό,τι ζητά ο κύβος πιο χαμηλά («Κάτω») κλαδεύεται από την **ίδια**
  συνάρτηση. Η όψη «Πάνω» παίρνει 0,5° κλίση **από τον νότο** ⇒ ο βορράς πάνω στην οθόνη, όπως η κάτοψη.
- **Η μετατόπιση μένει στο οικόπεδο**: `screenSpacePanning = false` + `cursor` / `maxTargetRadius` (εγγενή του `OrbitControls`).
- **Επίπεδη σκίαση από το υλικό** (`flatShading`) αντί για `toNonIndexed()` του viewer: ίδια εικόνα, χωρίς τριπλασιασμό κορυφών.
- **Φως hillshade**: ΒΔ, 315° / 45°· ημισφαιρικό + κατευθυντικό με άθροισμα ≈ π ⇒ η οριζόντια επιφάνεια δείχνει ακριβώς το
  χρώμα της κλίμακας.
- **Διαφανές φόντο** ⇒ σωστό στα δύο θέματα χωρίς ανάγνωση CSS από JS.
- **Ετικέτες κύβου = σημεία του ορίζοντα** (Ν / Β / Δ / Α, ΠΑΝΩ / ΚΑΤΩ) αντί για FRT/BCK: σε έδαφος το «εμπρός» δεν σημαίνει
  τίποτα· η πρόσοψη +Z είναι ο **νότος** (−Z = βορράς).
- **Χωρίς `onRoll`**: η κύλιση γύρω από τον άξονα θέασης δεν έχει νόημα σε έδαφος. Ο κύβος έδειχνε τα βέλη κύλισης
  **πάντα**, οπότε εδώ θα ήταν ορατά και νεκρά. Διόρθωση στο `src/lib/three/view-cube/view-cube.ts` (απόφαση Giorgio):
  χωρίς `onRoll` τα βέλη **δεν μπαίνουν** ούτε στη σκηνή ούτε στους στόχους κλικ. Ο viewer δίνει πάντα `onRoll` ⇒ ανέγγιχτος.
  Test: `view-cube-roll.test.ts` (με θετικό control). Το αδρανές 2D context των tests του κύβου έγινε κοινό fixture
  (`__tests__/fixtures/inert-2d-context.ts`)· το ίδιο και το `t` του `TerrainContourMap.test.tsx` (κοινό
  `el-listing-detail-t.ts`), ώστε να μη μείνουν δίδυμα.
- **Η κάτοψη κρατά την κατάστασή της** (`forceMount`)· το 3Δ αποπροσαρτάται όταν κρύβεται (η GPU ελευθερώνεται).

**Tests** (με έγκριση, 2026-11-21 — `terrain/` + `view-cube/` + `canonical-views` ⇒ **12 σουίτες, 85/85** · `jscpd:diff`
καθαρό σε 13 αρχεία): `3d/__tests__/terrain-3d-camera.test.ts` (κλάδεμα ορίζοντα, «Πάνω» από
τον νότο, όλες οι γωνίες του όγκου στο οπτικό πεδίο, όρια) · `terrain-3d-scene.test.ts` (ίδια buffers, υλικά, `replace`
απελευθερώνει, `dispose`) · `Terrain3dCanvas.test.tsx` (ένδειξη μόνο ≠ 1×, «Αρχική όψη») · `__tests__/TerrainViewStage.test.tsx`
(προεπιλογή κάτοψη, κάρτα εισόδου, χωρίς WebGL, υπερβολή στον καμβά, η κάτοψη κρατά «Κλίσεις»). Κοινό `t` με τα αληθινά
ελληνικά κλειδιά: `terrain/__tests__/fixtures/el-listing-detail-t.ts`.

| Μετάλλαξη | Κόκκινα |
|---|---|
| Μ1 — χωρίς κλάδεμα στον ορίζοντα (όριο π αντί 85°) | 3 — «Κάτω ⇒ ορίζοντας» · «κρατά το αζιμούθιο» · «ποτέ κάτω από το κέντρο» |
| Μ2 — ένδειξη υπερβολής πάντα ορατή | 1 — «1×: καμία ένδειξη» |
| Μ3 — `replace` χωρίς `dispose` των παλιών γεωμετριών | 1 — «τα παλιά απελευθερώνονται» |
| Μ4 — βέλη κύλισης πάντα στη σκηνή | 1 — «χωρίς onRoll: κανένα βέλος» (το θετικό control μένει πράσινο) |

### 14.6 Β6.6 — καρτέλα «Ανάγλυφο» στη δημόσια αγγελία *(κώδικας ✅ · tests ✅ 310/310 · μεταλλάξεις 3/3 · πύλες ✅)*

**Εύρημα audit (grep, 2026-11-21)**: το `PublicListing.terrain` γραφόταν από το Β3β και **καμία δημόσια οθόνη δεν το
διάβαζε** — μοναδικός αναγνώστης το `TerrainImproveSection` του ιδιοκτήτη. Το Β6.6 είναι ο πρώτος δημόσιος καταναλωτής του
και του `TerrainViewStage`.

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/listings/listing-spatial-media.ts` | `presentableTerrain` — ο **ίδιος** κριτής του Α7 με τα μοντέλα· τον ρωτούν καρτέλα και σκηνή. **Δεν** τροφοδοτεί το σήμα/φίλτρο «3D» |
| `src/lib/terrain/publication/listing-terrain-snapshot-fetch.ts` (νέο) | `fetchListingTerrainSnapshot(url, signal, fetchImpl)` ⇒ `ready` · `refused` (λόγος του αναγνώστη· μη-JSON = `malformed`) · `unreachable` (HTTP ≠ 2xx · δίκτυο). Η ακύρωση **ξαναπετιέται** |
| `src/hooks/listings/useListingTerrainSnapshot.ts` (νέο) | Σχήμα `usePlaceOutline`: `AbortController` ανά `url`/προσπάθεια, `retry()`, ο λόγος της άρνησης στο ημερολόγιο |
| `src/components/listing-detail/terrain/ListingTerrainPanel.tsx` (νέο) | Στατικά μόνο τα ελαφριά: fetch, μέτρηση πλάτους, κατάσταση στο **ίδιο** κουτί · από κάτω, **πάντα**, τοπογράφος + `TerrainStatsList` από την κάρτα |
| `…/terrain/TerrainSnapshotStage.tsx` (νέο) | `terrainMapModelOf` για την κλάση πλάτους → `TerrainViewStage`. Φορτώνεται **μόνο** ως επιφάνεια |
| `…/terrain/terrain-surfaces.tsx` (νέο) | Μητρώο `defineLazySurfaces`: `TerrainSnapshotStage` + `Terrain3dCanvas` (κώδικας + κείμενα ως ένα αίτημα) · `TERRAIN_STAGE_NOTICE_BOX` (το ένα κουτί, πριν σε 3 σημεία) · `TerrainStagePending`. Στο `lazyRouteRegistries` |
| `…/terrain/terrain-surface-props.ts` (νέο) | Μόνο τύποι props — ο γράφος της 3.34 μετρά και το `import type` ως ακμή (μετρημένο) |
| `TerrainViewStage.tsx` · `3d/Terrain3dCanvas.tsx` | Το 3Δ από το μητρώο αντί για σκέτο `next/dynamic`· τα props του καμβά στο αρχείο τύπων |
| `.i18n-shell-slice.json` · `src/i18n/generated/*` | +2 δηλώσεις αναμονής, σφράγιση **119 → 121** (ρητό «ΝΑΙ» Giorgio) · slice `/listing/[id]` 22.971 bytes (ταβάνι 25.656, **χωρίς** νέα σφράγιση) |
| `src/components/listing-detail/media/ListingMediaViewer.tsx` | Καρτέλα `terrain` («Ανάγλυφο», `Mountain`), τελευταία των σχεδίων |
| `listing-detail.json` (el/en) · `src/types/i18n.ts` | `media.tabs.terrain` · `terrain.panel.{label,loading,unreachable,retry,refused,survey}` |

**Αποφάσεις**
- **Έρευνα**: Zillow Showcase — μόνιμες καρτέλες μέσων (φωτογραφίες · 3D · κάτοψη · βίντεο)· Land.com Network — χάρτης
  εδάφους/τοπογραφίας και 3Δ ως όψεις της αγγελίας γης. Κανένας δεν δείχνει μετρημένο mesh τοπογράφου.
- **Κατεβαίνει μόνο όταν ανοίξει, χωρίς μηχανισμό**: το `MediaViewerShell` δεν κάνει `forceMount`, άρα η σκηνή προσαρτάται
  μόνο στην ενεργή καρτέλα, και το fetch γίνεται στην προσάρτηση. Κλείσιμο καρτέλας ⇒ `abort`.
- **Οι αριθμοί δεν περιμένουν το δίκτυο**: η κάρτα ταξιδεύει ήδη στην αγγελία ⇒ τοπογράφος, έκταση, υψόμετρα, κλίσεις
  φαίνονται αμέσως, και μόνο η σκηνή περιμένει, σε κουτί σταθερής αναλογίας (μηδέν μετατόπιση).
- **Δύο αποτυχίες, δύο προτάσεις**: `unreachable` ⇒ «δεν φόρτωσε» + «Δοκιμή ξανά»· `refused` ⇒ «δεν μπορεί να εμφανιστεί»
  χωρίς επανάληψη (δεν θα βοηθούσε). Και στις δύο οι αριθμοί μένουν.
- **Χάρτης για το πλάτος που φαίνεται**: το πλάτος μετριέται (`useSizeObserver` → `terrainMapWidthClassOf`) όσο κατεβαίνει το
  στιγμιότυπο, άρα το `terrainMapModelOf` τρέχει μία φορά· χωρίς μέτρηση ⇒ οι αναλογίες του σχεδίου.
- **Όχι `useAsyncData`** (ADR-223): δεν δίνει `AbortSignal` και κάνει κάθε αποτυχία `string`, χάνοντας την ονομασμένη άρνηση.
- **CORS**: ο κάδος του ραφιού έχει ήδη `origin: ['*']` (Ο-21, `config/gcs-buckets.ts`)· `Content-Encoding: gzip` ⇒
  `response.json()` αρκεί. Χωρίς διαπιστευτήρια (`credentials: 'omit'`).

- **CHECK 3.34 — η σκηνή είναι επιφάνεια, όχι μέρος της σελίδας** (εντοπίστηκε από τον γεννήτορα, μετρημένο):
  στατικά ο χάρτης ανέβαζε το slice της αγγελίας 20.525 → 26.321 bytes (> 25.656)· με σκέτο `next/dynamic` το 3Δ άφηνε
  +1 τριάδα χρέους εισδοχής (ωμά κλειδιά). Λύση: μητρώο επιφανειών, όπως το `improve-surfaces.tsx`. Μπόνους: fetch και
  chunk του χάρτη κατεβαίνουν **παράλληλα**, και ο κώδικας του χάρτη βγήκε από το bundle κάθε αγγελίας.

⚠️ **Αμέτρητο**: το `terrainMapModelOf` τρέχει στο κύριο νήμα (στην προεπισκόπηση τρέχει σε Worker). Για οικόπεδο είναι
φθηνό· στο όριο των 60.000 τριγώνων δεν μετρήθηκε.

**Μεταλλάξεις 3/3** (η καθεμία κοκκινίζει ΑΚΡΙΒΩΣ το test της, και πριν και μετά τη μετακίνηση σε επιφάνειες): καρτέλα
χωρίς τον κριτή ⇒ Π9 · fetch χωρίς `abort` ⇒ «αποπροσάρτηση ⇒ ακύρωση» · «Δοκιμή ξανά» και στην άρνηση ⇒ «άρνηση χωρίς
retry». Πύλες: 3.8 ✅ · 3.33 ✅ · 3.34 ✅ (644/644 + έλεγχος slice) · 3.36 ✅ · 3.22 ✅ · 3.28 ✅ (15 αρχεία, 0 κλώνοι).

**Tests** (✅ 310/310 σε `terrain/` · `media/` · `lib/terrain/publication` · `components/terrain` · spatial-media): `ListingTerrainPanel.test.tsx` (fetch μία φορά στην προσάρτηση · τοπογράφος + αριθμοί
πριν την απάντηση · άρνηση χωρίς retry · 503 ⇒ retry που φέρνει τη σκηνή · αποπροσάρτηση ⇒ `abort`) ·
`listing-terrain-snapshot-fetch.test.ts` · `listing-spatial-media.test.ts` (`presentableTerrain`) · `ListingMediaViewer.test.tsx`
(Π9: θέση, κριτής, σκηνή μόνο όταν ανοίξει, `?mediaTab=terrain`). Fixture: `publishedTerrainOf` στο `terrain-3d-fixtures.ts`.

### 14.7 Β6.7 — «Κάτοψη | 3Δ» στην προεπισκόπηση του «Βελτίωσε» *(κώδικας ✅ · tests ✅ 91/91 · μεταλλάξεις 2/2 · 3.34 ✅ 644/644)*

**Εύρημα audit (ανάγνωση, 2026-11-22)**: η απάντηση του Worker (`survey-preview-host.ts`) κουβαλούσε **ήδη** το
`preparation.snapshot` — το ίδιο που θα δημοσιευτεί. Δεν χρειάστηκε νέος υπολογισμός, νέο μήνυμα Worker ή αλλαγή server.
Δύο παγίδες εντοπίστηκαν πριν τον κώδικα:
- **Ταυτότητα**: κάθε απάντηση του Worker φτάνει ως νέο αντικείμενο (structured clone)· το `Terrain3dCanvas` χτίζει
  γεωμετρία με `useMemo([snapshot, …])` ⇒ μια σκέτη αλλαγή πλάτους θα ξανάχτιζε τη γεωμετρία 3Δ για τα ίδια σημεία.
- **Αχνό «ενημερώνεται»**: ο επιλογέας `[&>figure]` έπιανε μόνο σκέτη κάτοψη· μέσα στο «Κάτοψη | 3Δ» θα χανόταν σιωπηλά.

| Αρχείο | Αλλαγή |
|---|---|
| `src/hooks/listings/useSurveyPreview.ts` | Νέο πεδίο `snapshot`: από την **ίδια** απάντηση με τον χάρτη (ζευγάρι πάντα συνεπές)· `answerOf` κρατά το στιγμιότυπο που ήδη υπάρχει όσο το κλειδί (= τα σημεία) μένει ίδιο |
| `src/components/listing-detail/terrain/TerrainPreview.tsx` | Δείχνει `TerrainViewStage` (η ΜΙΑ όψη της δημόσιας αγγελίας) αντί για σκέτο `TerrainContourMap`· σκηνή μόνο με χάρτη **και** στιγμιότυπο· αχνό σε `[data-terrain-view-stage]` |
| `useTerrainSurveyImport.ts` | Αμετάβλητο — το `preview` (`Omit<SurveyPreviewState, 'preparation'>`) περνά το `snapshot` από μόνο του |

**Αποφάσεις**
- **Η σκηνή δεν αποπροσαρτάται** όσο ενημερώνεται: καρτέλα, «Υψόμετρα | Κλίσεις», υπερβολή και κάμερα 3Δ μένουν όπως τα
  άφησε ο ιδιοκτήτης (η μηχανή κάνει ήδη `setGeometry` χωρίς να κουνά την κάμερα, §14.5).
- **Οι σημάνσεις** (διπλά / αντιφατικά σημεία, Β4.8) μένουν στην κάτοψη. Στο 3Δ — καρφίτσες στο ύψος τους — είναι
  πρόταση για αργότερα, εκτός Β6.7.
- **Κανένα νέο κλειδί i18n**: τα `terrain.view.*` υπάρχουν ήδη στο `listing-detail`, που το πάνελ ήδη περιμένει
  (`TERRAIN_SURVEY_IMPORT_NAMESPACES`). Το 3Δ φτάνει από το μητρώο επιφανειών (`terrain-surfaces.tsx`) ⇒ το three
  κατεβαίνει μόνο μετά το «Προβολή σε 3Δ».

**Μεταλλάξεις 2/2** (η καθεμία κοκκινίζει ΑΚΡΙΒΩΣ το test της): νέο στιγμιότυπο σε κάθε απάντηση ⇒ Σ5 · σκηνή με χάρτη
χωρίς στιγμιότυπο ⇒ Ο5.

**Tests** (✅ 91/91 σε `components/listing-detail/terrain` · `components/terrain/survey-import` · `useSurveyPreview` ·
`useTerrainSurveyImport`): `TerrainPreview.test.tsx` Ο4 (κάτοψη πρώτα, καμβάς 3Δ μόνο μετά την αποκάλυψη) · Ο5 ·
`useSurveyPreview.test.tsx` Σ5 (στιγμιότυπο μαζί με τον χάρτη· άλλο πλάτος ⇒ ίδιο· άλλα σημεία ⇒ νέο).

**Ζωντανή επαλήθευση (εκκρεμεί, μετά από push με εντολή Giorgio)**: TEST-2 `/offers/ownp_330a5a4b…/improve` με
`HANDOFFS/topo-test-ridge-dense.txt` — Υψόμετρα/Κλίσεις, 3Δ, κύβος, αφή, 390px. Μόνο προεπισκόπηση, τίποτα δεν δημοσιεύεται.

### 14.8 Β6.8 — ισοϋψείς χωρίς «barcode»: διάστημα από την πυκνότητα + τοπικό αραίωμα *(κώδικας ✅ · tests ✅ 80/80 + 1958 ευρύτερα · μεταλλάξεις 5/5 · 3.28 ✅)*

**Πρόβλημα (2026-11-22, ερώτηση Giorgio με στιγμιότυπο)**: το `chooseContourConfig(reliefMm)` διάλεγε διάστημα **μόνο από το
ανάγλυφο**. Στο συνθετικό αρχείο 13 × 61 m (3 m, κλίση 100 %) έβγαινε 0,1 m, δηλαδή ~120 γραμμές σε 13 m. Οι υψομετρικές
ζώνες (Β6.2) άλλαζαν χρώμα σε **κάθε** γραμμή και ενίσχυαν τις λωρίδες.

**Έρευνα web**
| Πηγή | Πρακτική |
|---|---|
| Ordnance Survey (Mackaness & Steven 2006, «contour segment removal») | ελάχιστη απόσταση γραμμών **0,4 mm** στο χαρτί· σε απότομο έδαφος σβήνονται **τοπικά** κομμάτια των ενδιάμεσων· οι κύριες μένουν πάντα |
| USGS (US Topo) · swisstopo | ένα διάστημα ανά χάρτη, γραμμένο στο υπόμνημα· σε πολύ απότομο έδαφος μόνο οι κύριες |
| Esri «Contour» raster function, «Number of contours» | το «ωραίο» διάστημα επιλέγεται από τη στοχευμένη πυκνότητα |
| maplibre-contour · Mapbox Terrain | πίνακας διαστημάτων **ανά zoom**. Ο δικός μας χάρτης δεν έχει zoom: το οικόπεδο γεμίζει το πλαίσιο |
| Civil 3D | σταθερό διάστημα, το ορίζει ο χρήστης (ίδιο κάνει και ο DXF viewer μας, 0,5 m). Ανάλυση «Elevations» με «number of ranges» ως ρύθμιση στυλ (προεπιλογή που δεν βρέθηκε δημοσιευμένη) |
| Land id | «το διάστημα γράφεται πάντα στο υπόμνημα» |

Δεν βρέθηκε δημοσιευμένο κατώφλι για **οθόνη**. Οι τιμές σε px είναι δικές μας και βαθμονομούνται με πραγματικά τοπογραφικά.

**Αποφάσεις** (Giorgio: «όπως οι μεγάλοι»)
1. **Ένα διάστημα ανά οικόπεδο**, ίδιο σε στατιστικά, υπόμνημα, 3Δ και PDF, αλλά διαλεγμένο από την **πυκνότητα**: το
   λεπτότερο της ίδιας σκάλας που (α) κρατά το όριο `MAX_MINOR_LEVELS` και (β) κρατά το
   `LISTING_TERRAIN_CONTOUR_SLOPE_QUANTILE` (90 %) του **εμβαδού** με απόσταση ≥ `LISTING_TERRAIN_CONTOUR_MIN_SPACING_PX`
   (**8 px** μετά τη ζωντανή βαθμονόμηση, αρχικά 6) στο πλάτος αναφοράς `LISTING_TERRAIN_CONTOUR_REFERENCE_WIDTH_PX` (480 px). Ένας τοίχος ή πρανές δεν
   «χοντραίνει» όλο το οικόπεδο.
2. **Τοπικό αραίωμα των ενδιάμεσων** στο πλάτος που **πραγματικά** φαίνεται ο χάρτης (κλάση πλάτους, §13.8 απόφαση 4·
   χαρτί/PDF ⇒ πλάτος αναφοράς). Η απόφαση παίρνεται ανά **τμήμα**, από το τρίγωνο κάτω από το μέσο του (ακριβές σε TIN), και
   εξομαλύνεται σε **διαδρομές** `LISTING_TERRAIN_MAP_THINNING_MIN_RUN_PX` (16 px): πρώτα κλείνουν οι μικρές τρύπες, μετά
   σβήνουν τα μικρά θραύσματα. Έτσι δεν βγαίνουν διακεκομμένες γραμμές, κάτι πιο καθαρό από το CSR. Οι **κύριες δεν αγγίζονται
   ποτέ**.
3. **Το υπόμνημα το λέει**: «Ισοϋψής ανά {interval} · στα απότομα σημεία φαίνονται μόνο οι κύριες» (`legend.minorThinned`).
4. **Ζώνες υψομέτρων**: τα όρια είναι **πάντα** γραμμές που ζωγραφίζονται, αλλά η πιο λεπτή επιλογή από τη σκάλα «όλα τα
   επίπεδα → κύριες → πολλαπλάσια κυρίων (2, 5, 10 …)» που δίνει ≤ `LISTING_TERRAIN_MAP_MAX_ELEVATION_BANDS` (10) ζώνες.
   Αν αραιώθηκαν ενδιάμεσες, καμία ενδιάμεση δεν γίνεται όριο, γιατί εκεί μπορεί να λείπει η γραμμή. **Ούτε** όταν μια ζώνη
   ενός διαστήματος θα ήταν στην οθόνη στενότερη από `LISTING_TERRAIN_MAP_MIN_BAND_WIDTH_PX` (24 px, ίδιο μέτρο και ίδιο
   ποσοστημόριο κλίσης με το διάστημα: `intermediateBandsNarrow`), γιατί τότε το χρώμα θα άλλαζε σε κάθε γραμμή (ζωντανή
   βαθμονόμηση, παρακάτω). Η απόφαση του Β6.2 («το χρώμα αλλάζει πάνω σε γραμμή») μένει.
5. **Κανένα σχήμα δεν αλλάζει**: το στιγμιότυπο κρατά τα ίδια πεδία (`contourIntervalM`, `contours[]`). Αλλάζει μόνο το
   **περιεχόμενο** για νέα ψησίματα. Ο DXF viewer **δεν** αλλάζει (δικό του, ρυθμιζόμενο διάστημα).
6. **Ένα μέτρο, ένας δείκτης**: η απόσταση σε px ζει στο `terrain-contour-density.ts` (builder **και** χάρτης)· το πλάτος του
   view box στο `terrainMapWidthM` (το ίδιο περιθώριο με το `viewBoxOf`)· ο εντοπισμός τριγώνου **βγήκε** από το
   `tin-sampler.ts` στο `triangle-locator.ts` (ο sampler τον καλεί με ίδια συμπεριφορά). Δεν υπάρχει δεύτερος δείκτης.

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/terrain/triangle-locator.ts` (νέο) | πλέγμα κάδων + βαρυκεντρικά, ανεξάρτητο μονάδων. Μετακόμιση από το `tin-sampler.ts` |
| `src/lib/terrain/tin-sampler.ts` | `zAtMm` = εντοπισμός + βαρυκεντρική ανάμειξη (ίδια συμπεριφορά) |
| `publication/terrain-contour-density.ts` (νέο) | `contourSpacingPx` · `contoursCrowded` · `mapPxPerM` · `referencePxPerM` · `areaWeightedGradientQuantile` |
| `publication/contour-interval.ts` | `chooseContourConfig(ContourDensityInput)` + `contourDensityInputOf(tin)` |
| `publication/listing-terrain-snapshot.ts` | περνά την πυκνότητα της επιφάνειας |
| `publication/terrain-map-contour-thinning.ts` (νέο) | `thinMinorContours` |
| `publication/terrain-map-elevation-bands.ts` | `bandLevelsOf` |
| `publication/terrain-map-furniture.ts` | `terrainMapWidthM` (κοινό περιθώριο με το `viewBoxOf`) |
| `publication/terrain-map-model.ts` | ενδιάμεσες αραιωμένες + `minorContoursThinned` · ζώνες από `bandLevelsOf` |
| `publication/listing-terrain-config.ts` | 5 νέες σταθερές (παραπάνω) |
| `TerrainContourMap.tsx` · `listing-detail.json` (el/en) · `src/types/i18n.ts` (παραγόμενο) | σημείωση υπομνήματος |

**Tests (✅ 2026-11-22, με έγκριση)**: 6 σουίτες **80/80**. Ευρύτερα (`src/lib/terrain` · `listing-detail/terrain` ·
`components/terrain` · `dxf-viewer/systems/topography` · `bim-3d/converters` · `hooks/listings` · ράφι · σχήμα αγγελίας):
**196 σουίτες, 1958 ✅ / 2 skipped**. Ο sampler μέσα από τον κοινό εντοπιστή κρατά πράσινες όλες τις σουίτες του viewer.
Μεταλλάξεις 5/5 (επαναφορά byte προς byte, ίδιο sha1): χωρίς κριτήριο πυκνότητας ⇒ 2 κόκκινα · χωρίς εξομάλυνση
διαδρομών ⇒ 1 («όχι διακεκομμένες») · ζώνες που αγνοούν το αραίωμα ⇒ 1 · αραίωμα που αγγίζει κύριες ⇒ 3 · υπόμνημα που
αγνοεί το αραίωμα ⇒ 1. Το test «οι κύριες δεν αγγίζονται» **ενισχύθηκε** μετά από έλεγχο: σε 3 px/m δεν μπορούσε να
κοκκινίσει, γιατί οι κύριες θα έσβηναν ούτως ή άλλως· τώρα ελέγχει και σε 20 px/m. CHECK 3.28 (`jscpd:diff`, 10 αρχεία) ✅.
Σουίτες: `contour-interval.test.ts` (νέο: μέτρο, ποσοστημόριο εμβαδού,
ράχη «barcode» ⇒ 0,5 m αντί 0,1 m, ήπιο χωράφι ⇒ 0,1 m) · `terrain-map-contour-thinning.test.ts` (νέο: ήπιο ⇒ ίδιο path
byte προς byte · όλο απότομο ⇒ καμία ενδιάμεση + σημαία · «βεντάλια» ⇒ κομμάτια ≥ ελάχιστη διαδρομή, μόνο αρχικές κορυφές,
ντετερμινισμός) · `terrain-map-elevation-bands.test.ts` (+`bandLevelsOf`) · `listing-terrain-snapshot.test.ts` (νέα
υπογραφή) · `TerrainContourMap.test.tsx` (σημείωση υπομνήματος).

**Ζωντανή δοκιμή ✅ (2026-11-22, παραγωγή `6772fb4`, μόνο προεπισκόπηση TEST-2)** με το **πραγματικό** τοπογραφικό
«ΔΟΚΙΜΗ Κτίριο Β» (`…_84_ΣΗΜΕΙΑ_EYOSMOS_G753.txt`: 84 σημεία, ανάγλυφο 3,0 m, μέγ. κλίση 61 %) και με το συνθετικό
`topo-test-ridge-dense.txt` (793 σημεία, 100 %), σε 360 / 640 / 960 px (στένεμα πλαισίου με JS):
| | Πραγματικό | Συνθετικό |
|---|---|---|
| Λεζάντα | «ανά 0,1 m · κύριες ανά 0,5 m» | «ανά 0,5 m · κύριες ανά 2,5 m» |
| Υπόμνημα | «…στα απότομα σημεία φαίνονται μόνο οι κύριες» | χωρίς σημείωση (καμία αραίωση) |
| Ζώνες | 6 | 6 — **μία ανά γραμμή** |
| Διακεκομμένες ισοϋψείς | 0 (διακεκομμένη μόνο η «Έκταση αποτύπωσης», σκόπιμα) | 0 |
| 3Δ | ✅ | ✅ |

🔴 **Εύρημα**: στο συνθετικό οι **γραμμές** περνούσαν το όριο (≈ 7,5 px στα 360 px, κλάση 320), αλλά η εικόνα ήταν ακόμη
«barcode»: οι ζώνες άλλαζαν χρώμα σε **κάθε** ισοϋψή (5 επίπεδα ≤ 10 ⇒ όλα όρια), ριγέ λωρίδες ανά 7,5–13 px. Το
«barcode» το έφτιαχνε το **χρώμα**. (Η αλλαγή «Κάτοψη → 3Δ» που φάνηκε μία φορά κατά τη δοκιμή ήταν χειρισμός του
Giorgio, όχι σφάλμα.)

**Βαθμονόμηση (Giorgio: «ναι σε όλα»)**: `MIN_SPACING_PX` 6 → **8** · νέος κανόνας + σταθερά
`LISTING_TERRAIN_MAP_MIN_BAND_WIDTH_PX = 24` (απόφαση 4) · `REFERENCE_WIDTH_PX` 480 · `SLOPE_QUANTILE` 0,9 ·
`THINNING_MIN_RUN_PX` 16 · `MAX_ELEVATION_BANDS` 10 **μένουν** (τίποτα στη δοκιμή δεν τα αμφισβήτησε). Μέτρηση εκτός
browser με τον ίδιο builder + μοντέλο χάρτη (`ts-node --transpile-only`, script στο scratchpad):
| Αρχείο | Διάστημα | χαρτί / 320 / 480 / 640 / 960: αραίωμα · ζώνες |
|---|---|---|
| Πραγματικό | 0,1 m (**αμετάβλητο**) | ναι · 6 σε όλα (όρια 98,5 … 100,5, **αμετάβλητα**) |
| Συνθετικό | 0,5 m (αμετάβλητο) | όχι / **ναι** / όχι / όχι / όχι · **2** σε όλα (όριο 2,5) |
⚠️ Τίμημα: στο συνθετικό (3 m σε ράχες 100 %) η υψομετρική απόχρωση πέφτει σε **2** ζώνες — είναι η ειλικρινής
απάντηση σε έδαφος όπου ζώνη ενός διαστήματος είναι 10–20 px.

**Ζωντανός έλεγχος της βαθμονόμησης ✅ (2026-11-22, παραγωγή `6d81873` ⊇ `6c4d7d4d`, μόνο προεπισκόπηση TEST-2)**, ίδια
δύο αρχεία, πλάτη 360 / 640 / 768 px:
| | 360 px | 640 px | 768 px | 3Δ |
|---|---|---|---|---|
| Πραγματικό | 0,1 m · 6 ζώνες · αραίωμα + «…μόνο οι κύριες» | ίδιο | ίδιο | ✅ |
| Συνθετικό | 0,5 m · **2** ζώνες (όριο 2,5) · αραίωμα | 0,5 m · 2 ζώνες · χωρίς αραίωμα | ίδιο με 640 | ✅ |
Σε όλα τα πλάτη, διακεκομμένη μόνο η «Έκταση αποτύπωσης». Ταυτίζεται με τη μέτρηση εκτός browser.

🔴 **Διόρθωση μεθόδου**: το πλάτος του χάρτη το μετρά το `section[data-terrain-preview]` (`TerrainPreview.tsx`,
`useSizeObserver`), **όχι** το `[data-terrain-view-stage]`. Στένεμα του δεύτερου με JS αφήνει την κλάση πλάτους ίδια, και
μετρήθηκε: γεωμετρία ενδιάμεσων ίδια byte προς byte σε 320–768 px. Οι μετρήσεις παραπάνω έγιναν στο `section`. Η πρώτη
ζωντανή δοκιμή (πίνακας πιο πάνω, «σε 360 / 640 / 960 px») φαίνεται να στένεψε επίσης το `stage`. Η γραμμή της «χωρίς
σημείωση (καμία αραίωση)» για το συνθετικό ταιριάζει με αυτό. Δεν είναι βέβαιο ότι ελέγχθηκε πάνω από ένα πλάτος.

⚠️ **Ανοιχτό (δεν ψάχτηκε)**: στο συνθετικό στα 360 px αραιώνονται **όλες** οι ενδιάμεσες. Τότε το υπόμνημα δεν γράφει
«…μόνο οι κύριες» αλλά παραλείπει τη γραμμή των ενδιάμεσων (μένουν «Κύρια ισοϋψής ανά 2,5 m» + «Έκταση αποτύπωσης»).
Δεν έχει αποφασιστεί αν αυτή είναι η επιθυμητή συμπεριφορά. → **Αποφασίστηκε και υλοποιήθηκε: §14.9 Α.**

⚠️ **Δεν επαληθεύτηκε**: αν η κρυφή μνήμη του δημόσιου ραφιού (`META_TERRAIN_CARD`) ξαναψήνει ήδη δημοσιευμένα στιγμιότυπα
όταν αλλάζει ο builder, ή αν χρειάζεται επαναδημοσίευση.

### 14.9 Β6.9 — ό,τι δηλώνεται = ό,τι σχεδιάζεται · έκδοση builder στη συνταγή · βραδινό πέρασμα *(κώδικας ✅ · tests ✅ 379/379 · μεταλλάξεις 2/2 · 2026-11-22)*

Κλείνει τα δύο «ανοιχτά» του §14.8. Εγκρίθηκε από τον Giorgio (2026-11-22) με την οδηγία «πρακτική των μεγάλων, χωρίς
εκπτώσεις». Έρευνα: USGS US Topo (το διάστημα δηλώνεται στο περιθώριο, κάτω από την κλίμακα) · Esri multi-scale contours ·
maplibre `thresholds` ανά zoom ⇒ **το διάστημα που δηλώνει ο χάρτης είναι αυτό που σχεδιάζει σε αυτό το μέγεθος**.

#### Α — τριμερής `minorShown` ✅ *(κώδικας · tests ✅)*
- Το `thinMinorContours` (`terrain-map-contour-thinning.ts`) επιστρέφει `shown: 'all' | 'some' | 'none'` αντί για
  `thinned: boolean`. **Μία** απόφαση, σε **ένα** σημείο:
  - καμία επιλέξιμη ενδιάμεση ⇒ `'all'` (δεν αποσιωπήθηκε τίποτα)·
  - όλες έπεσαν ⇒ `'none'`·
  - κάποια αραιώθηκε ⇒ `'some'`.
  
  Το μοντέλο (`TerrainMapModel.minorShown`) και ο κανόνας ορίων ζωνών (`BandLevelRule.minorShown`: ενδιάμεσες ως όρια
  **μόνο** στο `'all'`) τη μεταφέρουν αυτούσια. Κανένα component δεν την ξανασυμπεραίνει από `pathData.length`.
- `TerrainContourMap.tsx`, στο `'none'`:
  - η λεζάντα (`captionIndexOnly`) και η περιγραφή του SVG (`descriptionIndexOnly` / `descriptionElevationIndexOnly`)
    δηλώνουν **μόνο** τις κύριες·
  - η γραμμή υπομνήματος των ενδιάμεσων **δεν** μπαίνει, γιατί δείγμα για γραμμή που δεν σχεδιάστηκε θα έλεγε ψέματα·
  - μια **σημείωση περιθωρίου** `data-terrain-minor-hidden` (`minorHidden`, ίδιο σχήμα με την ένδειξη «ενδεικτικές»)
    λέει το διάστημα που λείπει και πού φαίνεται.
- ⚠️ **Απόκλιση από το handoff, με λόγο**: το handoff έγραφε «φαίνονται … στο PDF και στο 3Δ». Το **3Δ** επαληθεύτηκε, γιατί το
  `terrain-3d-geometry.ts` σχεδιάζει **όλες** τις ισοϋψείς. Το **PDF όχι**: κανένα PDF δεν καταναλώνει τον χάρτη (grep), και
  στο πλάτος αναφοράς (480 px, όπου πέφτει και το χαρτί) το αραίωμα **μπορεί** να συμβεί. Γράφτηκε «σε ευρύτερη προβολή
  και στο 3Δ».
- Το διάστημα του οικοπέδου (στατιστικά · 3Δ · κάρτα) **δεν** αλλάζει (απόφαση 1 του §14.8).
- i18n el+en (+4 κλειδιά) · `src/types/i18n.ts` ξαναπαράχθηκε (CHECK 3.33).
- Tests: αραίωμα (`'all'`/`'some'`/`'none'`) · ζώνες (`'some'` **και** `'none'` ⇒ όχι ενδιάμεσα όρια) · μοντέλο · χάρτης
  (λεζάντα/περιγραφή χωρίς το διάστημα των ενδιάμεσων, σημείωση, κανένα δείγμα `contourMinor`, σιωπή σε `'all'`/`'some'`).

#### Β — έκδοση builder στη συνταγή + ανανέωση της εγγραφής για ίδια bytes ✅ *(κώδικας · tests ✅)*
- Το ⚠️ «Δεν επαληθεύτηκε» του §14.8 επαληθεύτηκε: **δεν** ξαναψήνονταν. Το cache hit = `sourceRef` + συνταγή
  `json:terrain-s${snapshotVersion}-w${sourceVersion}`. Ο builder άλλαξε στο Β6.8 χωρίς να αλλάξει τίποτα από αυτά.
- Μοτίβο των μεγάλων: Mapbox MTS (αλλαγή recipe ⇒ πλήρες publish), Cloudinary (named transformations), Bazel (κλειδί
  ενέργειας). Η **έκδοση του παραγωγού** μπαίνει στο κλειδί cache, **χωριστά** από την έκδοση σχήματος.
  - Νέα `LISTING_TERRAIN_BUILDER_REVISION = 2` (`listing-terrain-types.ts`, δίπλα στο `LISTING_TERRAIN_SNAPSHOT_VERSION`·
    1 = ως Β6.7, 2 = Β6.8).
  - Στο `TerrainShelfEncoding.builderRevision` ⇒ συνταγή `json:terrain-s1-w1-b2`.
  - ⛔ Το `LISTING_TERRAIN_SNAPSHOT_VERSION` **δεν** ανέβηκε, γιατί ο reader (`z.literal`) θα απέρριπτε κάθε παλιό στιγμιότυπο.
  - Σχήμα, reader και binder αμετάβλητα (CHECK 3.105).
- 🔴 **Εύρημα για όλα τα ράφια**: το `uploadMissing` παρέλειπε κλειδί που υπάρχει, και το κλειδί είναι το sha256 του
  περιεχομένου. Νέα συνταγή που βγάζει **ίδια** bytes άφηνε τα μεταδεδομένα στην **παλιά** συνταγή. Το
  `cachedShelfFile` αστοχούσε τότε σε **κάθε** συμφιλίωση και το αντικείμενο ξαναψηνόταν **για πάντα** (μοντέλο:
  εκ νέου GLB).
  - **Πρότυπο Bazel REAPI**: τα bytes είναι το CAS και το `sourceRef` + `recipe` είναι η εγγραφή «ενέργεια → αποτέλεσμα»
    (ActionCache).
  - Τώρα, κλειδί που υπάρχει με **άλλα** μεταδεδομένα παίρνει **ένα** `setMetadata` μόνο με τα κλειδιά του παραγωγού,
    χωρίς εκ νέου εγγραφή bytes. Είναι αληθές: ίδιο digest ⇒ ίδια bytes.
  - Αποτυχία ⇒ η επόμενη συμφιλίωση ξαναπροσπαθεί (ιδεμποτικό).
  - Το `ShelfScan.keys` αφαιρέθηκε: ο μόνος αναγνώστης του ήταν το `uploadMissing`, που διαβάζει πλέον τα `files`.
- Τα παλιά `.json` με **άλλα** bytes σβήνονται από το `deleteExtra`, όπως πάντα (test).
- Rebuild `POST /api/admin/rebuild-public-listings`: **δεν** έτρεξε. Ξαναψήνουν η επόμενη επαναπροβολή και το βραδινό
  πέρασμα (Γ).

#### Γ — το βραδινό πέρασμα ελέγχει και τη συνταγή, για όλα τα ράφια ✅ *(κώδικας · tests ✅)*
Κλείνει τον «γνωστό περιορισμό» του §12: το αποτύπωμα μέσων (ADR-845 §7.17 Α5) είχε μόνο τις πηγές.

- **Αποτύπωμα v3 σε δύο μέρη**: `v3:<sha256 πηγών>:<sha256 συνταγών>`.
  - Το μέρος των πηγών είναι **ακριβώς** το hash του v2. Ένα v2 συγκρίνεται λοιπόν κανονικά στο υλικό: **καμία**
    πλημμύρα `unknown`, **κανένα** ψευδές «ΠΟΡΤΑ ΠΟΥ ΞΕΦΥΓΕ» την πρώτη νύχτα.
  - Δύο ερωτήσεις, δύο συναρτήσεις: `mediaAgreement` (υλικό, αμετάβλητη σημασία) και νέα `recipeAgreement`
    (`current | outdated`· το v2 ή ό,τι δεν διαβάζεται ⇒ `outdated`).
  - Η καρτέλα του γραφείου (`judgeListingMedia`) και ο βρόχος ορόφου ρωτούν **μόνο** το υλικό. Ο άνθρωπος δεν βλέπει
    αναβάθμιση της μηχανής ως «η αγγελία διαφέρει από τα αρχεία σου».
- **Συνταγές ανά πηγή, από ΕΝΑ σημείο**: νέο `listing-shelf-routing.ts`.
  - Ο εξαντλητικός διακόπτης `listingShelfLaneOf` (μεταφέρθηκε από το `partitionListingSources`, που γίνεται λεπτό)
    απαντά και στον γραφέα και στο αποτύπωμα, άρα δεν υπάρχουν δύο αντίγραφα να διαφωνήσουν.
  - Το `listingShelfRecipesOf` δίνει την **ίδια** συμβολοσειρά `shelfRecipe` που γράφει το ράφι. Το βίντεο δίνει δύο
    (MP4 + raster εξώφυλλο).
  - Αλλαγή συνταγής αλλάζει το αποτύπωμα **μόνο** των αγγελιών με τέτοιο υλικό.
- **Δύο ουρές στο βραδινό** (`listing-media-reconciliation.service.ts`):
  - Η απόκλιση υλικού διορθώνεται **πάντα, όλη**, με `error` όπως πριν.
  - Η απόκλιση **μόνο** συνταγής (`recipeOutdated`, μετρά μέσα στο `agreed`) ξαναψήνεται **με ρυθμό**: ως
    `LISTING_RECIPE_BACKFILL_PER_RUN = 25` ανά πέρασμα, με `info`. Το υπόλοιπο μετριέται ως `recipeDeferred`.
- 🏆 **Πέρα από το «τα πρώτα Ν»** (`lib/listings/listing-recipe-backfill.ts`, καθαρό): το παράθυρο **κυλά**, με αρχή
  `μέρα × όριο`, κυκλικά. Αγγελίες που αποτυγχάνουν μόνιμα δεν κρατούν τις ίδιες θέσεις κάθε βράδυ (head-of-line
  blocking), και σε ⌈n/25⌉ νύχτες **κάθε** υποψήφια έχει δοκιμαστεί. Πρότυπο: GitLab batched background migrations,
  Mapbox MTS incremental publish.
- Cron: `recipe outdated N (deferred M)` στη σύνοψη, και τα δύο νέα μεγέθη στα metrics.
- **Επίπτωση μετά το deploy**: όλες οι δημοσιευμένες αγγελίες γραφείου έχουν v2 ⇒ `outdated` ⇒ ~25 ανά νύχτα.
  - Όπου η συνταγή δεν άλλαξε, η επαναπροβολή είναι φτηνή: cache hit στο ράφι, και μετά το Β δεν ξαναψήνεται.
  - Το έδαφος ξαναψήνεται πραγματικά **μία** φορά.
  - ⚠️ Ο αριθμός των αγγελιών είναι **άγνωστος**, γιατί δεν ρωτήθηκε η βάση.
- Εμβέλεια: μόνο τα ράφια **αγγελιών**. Η βιτρίνα (`SHOWCASE_SHELF`) δεν έχει βραδινό πέρασμα. Οι αγγελίες **ιδιώτη**
  δεν κρίνονται από το βραδινό (ADR-845: «άλλη κλάση, άλλος γραφέας») και ξαναψήνονται στην επόμενη επαναπροβολή
  τους, όπως πριν.
- Tests: μορφή v3 + συμβατότητα v2 + `recipeAgreement` · ρυθμός/παράθυρο · δρομολόγηση (κάθε είδος ⇒ ράφι + ίδια
  συνταγή) · βραδινό (Γ1–Γ5).

#### Ζωντανός έλεγχος ✅ *(2026-11-22, παραγωγή `7a870f90`, μόνο προεπισκόπηση TEST-2)*
Το `/api/build-info` απάντησε `deploymentId` `7a870f90…`. Σελίδα: «Βελτίωσε την αγγελία σου» του TEST-2. Τίποτα δεν
δημοσιεύτηκε. Στένεμα με JS του `section[data-terrain-preview]` (`style.width`), μέτρηση σε DOM 2 s μετά. Επιβεβαιώθηκε
`svg[data-terrain-map]` = ίδιο πλάτος με το `section`. Και οι δύο λειτουργίες: «Υψόμετρα» και «Κλίσεις».

**Συνθετικό** (`topo-test-ridge-dense.txt`, 793 σημεία, 0,0–3,0 m, κλίση 100 %):
| | 360 px | 640 px | 768 px |
|---|---|---|---|
| Λεζάντα | «Ισοϋψείς ανά 2,5 m, με υψόμετρο» | «Ισοϋψείς ανά 0,5 m · κύριες, με υψόμετρο, ανά 2,5 m» | ίδιο με 640 |
| `<desc>` (Υψόμετρα · Κλίσεις) | «Κύριες ισοϋψείς ανά 2,5 m, με υψόμετρο, και …» · ίδιο | «Ισοϋψείς καμπύλες ανά 0,5 m, κύριες ανά 2,5 m, και …» · ίδιο | ίδιο με 640 |
| `[data-terrain-minor-hidden]` | «Οι ενδιάμεσες ισοϋψείς ανά 0,5 m δεν χωρούν σε αυτό το πλάτος· φαίνονται σε ευρύτερη προβολή και στο 3Δ.» (μέσα στο `figure`) | — | — |
| Υπόμνημα (δείγματα) | `contourMajor` · `extent` (+ `slope-0…3` στις Κλίσεις)· **κανένα** `contourMinor` | `contourMinor` · `contourMajor` · `extent` | ίδιο με 640 |
| `g[data-terrain-line=contourMinor]` | **δεν υπάρχει** | υπάρχει (2 paths) | ίδιο με 640 |

**Πραγματικό** («ΔΟΚΙΜΗ Κτίριο Β», 84 σημεία, 98,0–101,0 m, μέγ. κλίση 61 %): σε **360, 640 και 768 px**, και στις δύο
λειτουργίες, βγαίνει `'some'`. Λεζάντα «Ισοϋψείς ανά 0,1 m · κύριες, με υψόμετρο, ανά 0,5 m». Υπόμνημα «Ισοϋψής ανά
0,1 m · στα απότομα σημεία φαίνονται μόνο οι κύριες». `<desc>` με 0,1 m και 0,5 m. **Καμία** σημείωση
`data-terrain-minor-hidden`. Δείγμα `contourMinor` παρόν.

**3Δ**: η γεωμετρία που φτάνει στον κινητήρα (`appliedRef` του `useTerrain3dEngine`, ανάγνωση μέσω React fiber) **δεν**
εξαρτάται από το πλάτος:
- συνθετικό: **1717** τμήματα ενδιάμεσων + **866** κύριων, ίδια στα 360 και στα 768 px·
- πραγματικό: **427** ενδιάμεσων + **86** κύριων, ίδια στα 360 και στα 768 px.

Στο πραγματικό, στα 768 px, φαίνονται οπτικά λεπτές γκρι ενδιάμεσες και σκούρες κύριες. ⚠️ **Δεν επαληθεύτηκε ζωντανά**:
- το `visible` των αντικειμένων `LineSegments2` της σκηνής. Ο κινητήρας δεν βρέθηκε μέσα από το fiber· ο κώδικας
  (`terrain-3d-scene.ts`) το θέτει `= contours.minor.length > 0`·
- στο συνθετικό, οι ενδιάμεσες **δεν** ξεχωρίζουν οπτικά από τις ζώνες χρώματος στο στιγμιότυπο.

**Β/Γ (συνταγή + βραδινό)**: **δεν** ελέγχθηκαν ζωντανά. Δεν διαβάστηκαν μεταδεδομένα ραφιού ή σύνοψη του cron, και
δεν έτρεξε rebuild.

### 14.10 Β6.10 — διαδραστικό έδαφος: επιθεώρηση σημείου · προφίλ · σταγόνα νερού *(σε εξέλιξη, 2026-11-22)*

**Εντολή Giorgio (2026-11-22):** «να ξεπεράσουμε CalTopo / Mapbox / ArcGIS / Civil 3D — ΟΛΑ όσα προτάθηκαν». Ο αγοραστής
δείχνει ένα σημείο και μαθαίνει υψόμετρο, κλίση, φορά κατηφόρας και την ισοϋψή του· σέρνει γραμμή προφίλ· ρίχνει
«σταγόνα νερού». Σειρά: **Ε1** κάτοψη → **Ε2** 3Δ → **Ε3** προφίλ + σταγόνα.

> Ονομασία: το handoff το έλεγε «Β7», αλλά το §7 έχει ήδη **Β7 = ιδιωτικότητα θέσης** και **Β8 = φάσεις §5**. Επειδή
> είναι δουλειά του **θεατή** (Β6), καταγράφεται ως **Β6.10**. Η σταγόνα (Ε3) είναι η υλοποίηση του «Βέλη απορροής
> νερού» του §5.

**Απόφαση συντεταγμένων** (Giorgio: «όπως οι μεγάλοι παίκτες»). Ακολουθούμε τη **Δ3** και την πρακτική Revit / Civil 3D:
δύο συστήματα, το έργο (τοπικό) και η αποτύπωση (παγκόσμιο). Το Idealista δείχνει θέση, αλλά ο αγγελιοδότης μπορεί να την
κρύψει.
- **Δημόσια αγγελία**: μόνο θέση **ως προς το κέντρο** («12 m Α · 8 m Β από το κέντρο»). Το snapshot **δεν άλλαξε**:
  καμία παγκόσμια συντεταγμένη, κανένα bump σε `LISTING_TERRAIN_SNAPSHOT_VERSION` / `BUILDER_REVISION`, η CHECK 3.105
  δεν αγγίζεται.
- **Προεπισκόπηση ιδιοκτήτη** (έχει ήδη το αρχείο, άρα δεν του αποκαλύπτεται τίποτα): επιπλέον οι συντεταγμένες του
  αρχείου. Αν πέφτουν στην περιοχή χρήσης του EPSG:2100 (`isWithinGreekGridAreaOfUse`) ⇒ **ΕΓΣΑ'87 E/N + WGS84 φ/λ**
  (`greekGridToGeoPoint`)· αλλιώς ουδέτερα «Αρχείο X / Y» — ποτέ ετικέτα συστήματος που δεν επαληθεύτηκε. Κουμπί αντιγραφής.
- **Δημόσιες παγκόσμιες συντεταγμένες**: μόνο μετά τη ρητή επιλογή της Δ3, δηλαδή το **Β7**. Εκτός εμβέλειας.
- Μηχανισμός: `SnapshotFrame.centreWorldMm` (`listing-terrain-frame.ts`) → `SurveyUploadPreparation.centreWorldMm` (κλάδος
  ok) → `useSurveyPreview().worldCentreMm` (ίδια ζωή/ταυτότητα με το snapshot) → `TerrainViewStage worldCentreMm` →
  `TerrainInspectProvider`. Το `encoded` χτίζεται από το `source` μόνο: το κέντρο **δεν** φτάνει στο wire.

#### Ε1 — καθαρός πυρήνας + επιθεώρηση στην κάτοψη *(κώδικας ✅ · tests γραμμένα, δεν έτρεξαν)*

**Πυρήνας `src/lib/terrain/inspect/`** (καθαρός, σε μέτρα του snapshot, κανένα DOM):
- `terrain-inspect-index.ts` — **ένα** ευρετήριο ανά snapshot (`WeakMap`, χτίζεται στην **πρώτη ερώτηση**, όχι στην απόδοση):
  `createTriangleLocator` (το **ίδιο** με τον κινητήρα όγκων), επίπεδα `fitDzPlane`, `sparseTriangleFlags`, γειτονιά
  τριγώνων, μοναδικές ακμές, ευρετήριο ισοϋψών, όριο, αποτύπωμα όγκου. `elevationAt` = βαρυκεντρικά.
- `terrain-point-reading.ts` — `readTerrainAt` → υψόμετρο, πάνω από το χαμηλότερο / κάτω από το υψηλότερο, κλίση % και °,
  η **δημοσιευμένη** κλάση του τριγώνου (ίδια με το χρώμα του χάρτη), φορά (`downslopeAzimuth` — η **ίδια** σύμβαση με τα
  στατιστικά) + `orientationOfAzimuth`, μετρημένο/παρεμβολή, όριο (μέσα/έξω + απόσταση), κάτω από τον όγκο, πλησιέστερη
  ισοϋψής. Εκτός επιφάνειας ⇒ `null`: τίποτα δεν επινοείται.
- `terrain-contour-index.ts` — πλησιέστερη ισοϋψής από τα **`contours` του snapshot** (όχι από τα paths του χάρτη, που είναι
  συγχωνευμένα και στο `'none'` δεν έχουν ενδιάμεσες). Πλέγμα κάδων τμημάτων, αναζήτηση σε δακτυλίους που σταματά μόλις
  κανένας μακρύτερος δεν μπορεί να κερδίσει.
- `terrain-profile.ts` — τομή Α→Β **ακριβής στο TIN** (σταθμός σε κάθε διάβαση ακμής· τα μεγάλα εργαλεία δειγματοληπτούν),
  κενά εκτός επιφάνειας **λέγονται**, ποτέ δεν γεφυρώνονται. *(Ε3 το απεικονίζει.)*
- `terrain-flow-path.ts` — σταγόνα: steepest descent σε TIN (Jones, Wright & Maidment 1990) με ρέμα κατά μήκος ακμής όπου
  συγκλίνουν οι ροές· τέλος σε λακκούβα / επίπεδο / έξοδο από την επιφάνεια / όριο βημάτων. *(Ε3 το απεικονίζει.)*
- **Εξαγωγές SSoT αντί για αντίγραφα**: `downslopeAzimuth` (`terrain-slope.ts`), `sparseTriangleFlags` και
  `slopeClassRange` (`terrain-map-regions.ts` — τα καλούν και οι περιοχές του χάρτη).

**Κατάσταση**: `terrain-inspect-store.ts` πάνω στο `createExternalStore` (σχήμα `review-hover-store`)· `TerrainInspectContext`
με **επιλογείς**. Κανόνας ADR-040: **καμία React state ανά κίνηση** — ο χάρτης και το `TerrainViewStage` δεν ξαναποδίδονται
από hover· μόνο τα φύλλα (σταυρόνημα, ισοϋψής, κάρτα, ζώνη υπομνήματος, γραμμή πίνακα). Ένας πάροχος γύρω από Κάτοψη **και** 3Δ.

**Κάτοψη**:
- `useTerrainMapPointer` — ποντίκι/γραφίδα: hover (1 εγγραφή/καρέ, rAF) + κλικ = καρφίτσωμα. **Αφή: πάτημα-κράτημα** =
  καρφίτσωμα (CalTopo · Google Maps)· απλό άγγιγμα/σύρσιμο μένει κύλιση. Κριτήριο το `pointerType` **του συμβάντος**, όχι
  ερώτηση media (laptop με οθόνη αφής). Πληκτρολόγιο: βέλη 1 m (Shift 10 m), Enter, Esc (`aria-keyshortcuts`).
- `TerrainInspectLayer` — σταυρόνημα, βέλος κατηφόρας, **ολόκληρη η ισοϋψής φωτισμένη** + «Ισοϋψής 99,5 m», γραμμή προφίλ,
  διαδρομή σταγόνας. `pointer-events: none`.
- `TerrainInspectCard` — `<dl>` στη γωνία **απέναντι** από το σημείο (με κλάσεις, όχι inline style). Ζωντανή περιοχή μόνο για
  το καρφιτσωμένο σημείο (το hover στα 60 fps θα έπνιγε τον αναγνώστη οθόνης).
- Υπόμνημα υψομέτρων: γραμμή στο υψόμετρο + περίγραμμα της ζώνης. Πίνακας κλίσεων: η γραμμή της κλάσης φωτίζεται.
- Ο `TerrainMapSvg` γίνεται διαδραστικός **μόνο** με `inspect` (υπάρχει πάροχος)· χωρίς αυτό, σκέτο σχέδιο (PDF).

**Esc** (`terrain-inspect-escape.ts`): το ΕΝΑ σημείο για κάτοψη ΚΑΙ 3Δ. Ακολουθεί το συμβόλαιο ιδιοκτησίας του
`lib/a11y/escape-layers.ts` (ADR-364 §10.15.γ, βαθμίδα «ιδιοκτήτης στο στοιχείο»): σέβεται `defaultPrevented` / IME /
modal, καταναλώνει **μόνο** όταν υπάρχει κάτι να καθαρίσει (`stopPropagation` + `claimEscape`), αλλιώς το πλήκτρο ανεβαίνει
(δύο στάδια, Figma / Revit). Δηλωμένο στο allowlist του `escape-command-bus` (CHECK 3.7) με T1/T2/T3. ⚠️ Μετρημένο: η
σύγκριση `!== 'Escape'` **δεν** πιάνεται από κανένα από τα 4 patterns της πύλης — δηλώθηκε παρ' όλα αυτά και γράφτηκε ως
τυφλό σημείο στην περιγραφή του module.

**Χρώματα**: `--terrain-inspect-contour` (ματζέντα #a21caf, 6,3:1) και `--terrain-water` (κυανό #0369a1, 5,9:1) στο
`globals.css`, **ίδια στα δύο θέματα** (χαρτί). Καμία από τις δύο αποχρώσεις δεν υπάρχει στο έδαφος από κάτω. Ποτέ μόνο
χρώμα: η ισοϋψής έχει γραμμένο το υψόμετρό της, το νερό είναι διακεκομμένο που «κυλά» (`motion-safe:animate-terrain-flow`,
keyframe στο `tailwind.config.ts`) και τελειώνει σε σταγόνα.

**Long-press**: το `useLongPress` του DXF viewer (ADR-176) **προήχθη** στο `src/hooks/gestures/useLongPress.ts`· το αρχείο του
viewer είναι shim που κρατά το `DXF_TIMING.gesture.LONG_PRESS` ως προεπιλογή. ⚠️ Μετρημένο: το shim **δεν έχει κανέναν
καταναλωτή** μέσα στον viewer.

**Tests γραμμένα** (`src/lib/terrain/inspect/__tests__/terrain-inspect.test.ts`): ανάγνωση σε γνωστό επίπεδο (10 % ⇒ 270°,
«δύση»), εκτός επιφάνειας = `null`, επίπεδο χωρίς φορά, ισοϋψής + απόσταση, όριο μέσα/έξω, προφίλ με 20 σταθμούς και ακριβή
υψόμετρα, κενό που δεν γεφυρώνεται, σταγόνα σε κώνο (λακκούβα), σε επίπεδο (φεύγει δυτικά, 12 m), σε επίπεδο έδαφος
(μένει), σε V-κοιλάδα (μπαίνει στο ρέμα και κατεβαίνει). ⏳ **Δεν έτρεξαν** (N.(-2): μόνο με έγκριση).

⚠️ **Δεν επαληθεύτηκαν ζωντανά**: τίποτα από την Ε1 — χρειάζεται push/rebuild (απόφαση Giorgio). Ειδικά: η κίνηση του
διακεκομμένου νερού με `pathLength` + `vector-effect: non-scaling-stroke`, και η αφή σε πραγματική συσκευή.

#### Ε2 — η ίδια επιθεώρηση στο 3Δ *(κώδικας ✅ · tests γραμμένα, δεν έτρεξαν)*

- **Pick** (`3d/terrain-3d-pick.ts`): `Raycaster` **μόνο** στην επιφάνεια (όχι στο χώμα, όχι στις γραμμές) ⇒ θέση σε
  κάτοψη μέσω `snapshotPlanOfScene`. **Το υψόμετρο ΔΕΝ βγαίνει από το χτύπημα**: η σκηνή είναι υπερβολή. Το διαβάζει ο
  πυρήνας (`readTerrainAt`) στο ίδιο (x, y) ⇒ **ίδιος αριθμός με την κάτοψη σε 1× / 2× / 3×** (Mapbox `exaggerated:false`).
  Ένα raycast ανά καρέ (rAF). Χωρίς BVH: σε ~60.000 τρίγωνα μένει σε λίγα ms. Αν μετρηθεί ακριβό, το επόμενο σκαλί είναι
  BVH. ⚠️ Δεν μετρήθηκε ζωντανά.
- **Αντιστοίχιση snapshot → σκηνή, ΜΙΑ** (`terrain-3d-geometry.ts`): `terrain3dScenePoint` · `snapshotPlanOfScene` ·
  `terrain3dPolylinePairs` · `terrain3dContourPairs` (τα ΙΔΙΑ τμήματα με τα buffers ισοϋψών) και `Terrain3dGeometry.vertical`
  (`{minM, exaggeration}` — με αυτό χτίστηκαν τα buffers).
- **Επικάλυψη** (`3d/terrain-3d-inspect-overlay.ts`): βελόνα + κεφάλι στο σημείο, καρφίτσα (λευκό κεφάλι), η πλησιέστερη
  ισοϋψής φωτισμένη σε **όλο** το μήκος (`LineSegments2`, 3,2 px), η τομή ντυμένη στο έδαφος (κομμάτια — κενά δεν
  γεφυρώνονται), το νερό διακεκομμένο που **κυλά** (`dashOffset`). Ξαναστήνεται σε κάθε αλλαγή υπερβολής (`setGeometry`).
- **Καρέ κατ' απαίτηση μένουν**: η μόνη αιτία συνεχών καρέ είναι το νερό που κυλά — και μόνο όσο φαίνεται και **επιτρέπεται
  κίνηση** (`prefersReducedMotion`, WCAG 2.3.3).
- **Καμία React state ανά κίνηση** (κανόνας ADR-040): `useTerrain3dEngine` γράφεται στο store και σπρώχνει `setInspect`
  απευθείας στη μηχανή. Νέα μηχανή (αλλαγή γλώσσας) ⇒ παίρνει αμέσως την τρέχουσα κατάσταση.
- **Δείκτης** (`3d/useTerrain3dPointer.ts`): η τροχιά έχει προτεραιότητα (κουμπί πατημένο ⇒ περιστροφή, όχι ένδειξη)·
  κλικ = πάτημα + άφημα ≤ 4 px· αφή = πάτημα-κράτημα ⇒ καρφίτσωμα· προφίλ = κλικ Α, λάστιχο, κλικ Β. Esc καθαρίζει· τα
  βέλη μένουν της τροχιάς (η πρόσβαση με πληκτρολόγιο γίνεται στην κάτοψη, με κοινό store — το σημείο φαίνεται και εδώ).
- **Κάρτα**: η ΙΔΙΑ `TerrainInspectCard` (πλέον με `cornerOf`): πάνω αριστερά (ο κύβος πιάνει πάνω δεξιά), ή κάτω αριστερά
  **πάνω** από την ένδειξη υπερβολής όταν ο δείκτης είναι πάνω αριστερά.

#### Ε3 — γραμμή προφίλ + σταγόνα νερού *(κώδικας ✅ · tests γραμμένα, δεν έτρεξαν)*

- **Εργαλείο «Σημείο | Προφίλ»** (`TerrainInspectToolbar`), **κοινό** για Κάτοψη και 3Δ, δίπλα στις καρτέλες: το εργαλείο
  μένει όταν αλλάζεις όψη (Figma). Στην κάτοψη σύρσιμο Α → Β (`touch-none` μόνο σε αυτό το εργαλείο)· στο 3Δ κλικ Α, κλικ Β.
- **Υψομετρική τομή** (`TerrainProfileChart` + καθαρό μοντέλο `lib/terrain/inspect/terrain-profile-chart.ts`):
  - σταθμός σε **κάθε** ακμή τριγώνου (ακριβής, όχι δειγματοληψία)·
  - **η κάθετη υπερβολή της τομής δηλώνεται** («κάθετη κλίμακα N× της οριζόντιας»): σταθερή αναλογία πλευρών, άρα ο αριθμός
    ισχύει σε κάθε πλάτος — CalTopo / ArcGIS δεν το λένε·
  - κενά εκτός επιφάνειας μένουν κενά· η παρεμβολή είναι **διακεκομμένη**·
  - λωρίδα κλίσεων με τις **ίδιες** κλάσεις με τον χάρτη (`classifySlope` στα bands του snapshot)·
  - σύνοψη: μήκος · ανάβαση · κατάβαση · μέγιστη κλίση· χαμηλότερο / υψηλότερο·
  - hover / ← → / Home / End στην τομή ⇒ `hoverProfile` ⇒ το **ίδιο** σημείο σε κάτοψη ΚΑΙ 3Δ (με κάρτα και ισοϋψή).
- **Σταγόνα νερού**: κουμπί στην κάρτα του καρφιτσωμένου σημείου ⇒ διαδρομή σε κάτοψη (κυανό διακεκομμένο που κυλά,
  `motion-safe`) και 3Δ· κείμενο «Κυλά 34 m προς τα νοτιοανατολικά και κατεβαίνει 2,1 m. Λιμνάζει σε βαθούλωμα…» +
  «Ενδεικτικό: μόνο από το σχήμα του εδάφους…» (`TerrainFlowSummary`). Υλοποιεί το «Βέλη απορροής νερού» του §5.
- Tests γραμμένα: `terrain-profile-chart.test.ts` (δηλωμένη υπερβολή = αυτή που σχεδιάζεται · λωρίδα με τις κλάσεις του
  χάρτη · κενό χωρίς έδαφος και λωρίδα · x ↔ απόσταση). ⏳ Δεν έτρεξαν.

#### Ζωντανός έλεγχος *(2026-11-23, παραγωγή `6c588d26`, πραγματικό αρχείο Εύοσμου, 84 σημεία, μόνο προεπισκόπηση)*

- ✅ Κάτοψη: hover ⇒ κάρτα + φωτισμένη ισοϋψής· κλικ καρφιτσώνει· 5× → = **ακριβώς +5,00 m** ανατολικά (N ίδιο)· η κάρτα
  πάει στην απέναντι γωνία· Esc ξεκαρφιτσώνει χωρίς να φύγει η σελίδα.
- ✅ Σταγόνα 2Δ: `pathLength` 204, `vector-effect: non-scaling-stroke`, το `dashoffset` μειώνεται ⇒ οι παύλες κινούνται
  από το σημείο προς το βαθούλωμα (κατάντη).
- ✅ 3Δ σε 1× και 3×: το σημάδι κάτω από τον κέρσορα, υψόμετρο **πραγματικό** (98,44 / 98,41 m από το ίδιο pixel· η μικρή
  οριζόντια διαφορά είναι αναμενόμενη, η επιφάνεια ψηλώνει). Το σημείο και η σταγόνα περνούν από την κάτοψη στο 3Δ.
- ✅ ΕΓΣΑ'87 στην προεπισκόπηση σωστό.
- ❌ → ✅ **WGS84**: έδειχνε ωμό `WGS84 {lat} · {lng}`. Αιτία (επιβεβαιωμένη ζωντανά μετά τη διόρθωση `177414ed`, σε κάτοψη + 3Δ: «WGS84 40,683578 · 22,911369»): το `lng` είναι **δεσμευμένη επιλογή
  του i18next** (γλώσσα απόδοσης), άρα δεν περνά ως παράμετρος. Διόρθωση: παράμετρος `{lon}` σε κώδικα και στα δύο locales.
  ⚠️ **ΜΗΝ** ονομάσεις παράμετρο `t()` `lng` / `ns` / `defaultValue` / `count` / `context` — είναι επιλογές, όχι τιμές.
- ⏳ Ανοιχτά: κόστος raycast (υπό αυτοματοποίηση το rAF στραγγαλίζεται, η μέτρηση δεν βγήκε)· φορά `dashOffset` στο 3Δ·
  πάτημα-κράτημα σε πραγματική συσκευή· εργαλείο Προφίλ.

⚠️ **Δεν επαληθεύτηκαν ζωντανά (Ε2/Ε3)**: η φορά κίνησης του `dashOffset` στο `LineMaterial`, το κόστος του raycast σε
πραγματικό τοπογραφικό, η συμπεριφορά της βελόνας όταν η κάμερα είναι από κάτω, το πάτημα-κράτημα σε πραγματική συσκευή.

### 14.11 Β6.11 — το τοπογραφικό σχέδιο ως ΔΕΥΤΕΡΗ πηγή · περίγραμμα οικοπέδου μέσα στο ανάγλυφο *(✅ ΕΓΚΡΙΘΗΚΕ 2026-11-23 · Ζ1 κώδικας ✅ · tests ✅ 15/15 · Ζ2 κώδικας ✅ · Ζ3 κώδικας ✅, tests γραμμένα · Ζ4 κώδικας ✅ · tests ✅ 89)*

> **Απόφαση Giorgio (2026-11-23): «ναι σε όλα, DWG σε επόμενο βήμα».** Εγκρίθηκαν τα Π1–Π9 και η αλλαγή εκδόσεων
> (πηγή 1→2 · στιγμιότυπο 1→2 · `BUILDER_REVISION` 2→3, οι αναγνώστες δέχονται και το v1). Το DWG (Π10 · Ζ6) έρχεται
> **μετά** τα Ζ1–Ζ5· ως τότε το `.dwg` παίρνει ονομασμένη άρνηση «αποθήκευση ως DXF».

**Εντολή Giorgio (2026-11-23)**: δύο διαφορετικές πηγές, και ο χρήστης πρέπει να το καταλαβαίνει. (1) **Ισοϋψείς / σημεία**
(υπάρχει) ⇒ το ανάγλυφο μιας περιοχής **μεγαλύτερης** από το οικόπεδο. (2) **Τοπογραφικό σχέδιο** (DWG · DXF · PDF) ⇒ δική του
καρτέλα εισαγωγής και δική του καρτέλα προβολής. Από το σχέδιο περνά στο ανάγλυφο **μόνο το περίγραμμα του οικοπέδου**, σε
κάτοψη **και** 3Δ. **Q1 (από τη διατύπωση)**: το ανάγλυφο μένει **ολόκληρο**, το περίγραμμα **σχεδιάζεται** πάνω του —
**καμία** κοπή (Civil 3D: *show/hide* = μη καταστροφικό, όχι *outer/data clip*).

#### Έρευνα web (2026-11-23)
- **Revit**: Toposolid «Create from Import» από DWG/DXF/CSV (μόνο ισοϋψείς με Z)· η **property line** σχεδιάζεται **με το χέρι**
  με «Pick Lines» πάνω στο συνδεδεμένο CAD — και οι χρήστες παραπονιούνται ότι πιάνει μικρά τμήματα (λύση: `OVERKILL` στο
  AutoCAD πρώτα). Το API δεν εκθέτει τη γεωμετρία του εισαγμένου CAD.
- **Civil 3D**: όριο επιφάνειας *outer / data clip* (κόβει) έναντι *show / hide* (μη καταστροφικό)· όριο από parcel. Δηλαδή
  το «δείχνω χωρίς να κόβω» είναι **άλλη έννοια** από το «κόβω» — όχι παράμετρος του ίδιου πεδίου.
- **Zillow / Idealista / Regrid / Land.id**: δείχνουν **όριο γεωτεμαχίου**, ποτέ το σχέδιο του τοπογράφου.
- **Κτηματολόγιο (maps.ktimatologio.gr)**: όρια γεωτεμαχίων + ΚΑΕΚ **δημόσια** στον χάρτη. ⇒ 🔴 **το σχήμα του οικοπέδου
  εντοπίζει το οικόπεδο**, ακόμη και σε τοπικό πλαίσιο χωρίς συντεταγμένες (ταίριασμα σχήματος + εμβαδού στον δημόσιο χάρτη).
- **Ελληνικό τοπογραφικό διάγραμμα**: φέρει κατά κανόνα **πίνακα συντεταγμένων κορυφών σε ΕΓΣΑ'87** και εμβαδόν υπολογισμένο
  από αυτές (δείγματα Υπ. Ανάπτυξης, ΥΠΑΑΤ). ⚠️ Όχι ενιαία εθνική υποχρέωση για κάθε διάγραμμα — εξαρτάται από τη διαδικασία.
- **GeoPDF** (ISO 32000-2, Measure/VP με GPTS/LPTS): το pdf.js **δεν** έχει API· σπάνιο σε ελληνικά διαγράμματα.
- **DWG**: το **LibreDWG** (και όσα πατούν πάνω του, π.χ. `@mlightcad/libredwg-*`) είναι **GPL ⇒ απαγορεύεται** (N.5)· RealDWG / ODA
  = εμπορικές άδειες. **Υποψήφιο**: `@node-projects/acad-ts` — μεταφορά σε TypeScript του **ACadSharp** (MIT), διαβάζει DWG
  AC1009–AC1032. ⚠️ Η άδεια επιβεβαιώθηκε μόνο από npm/CDN· θέλει έλεγχο του `LICENSE` πριν από εγκατάσταση **με έγκριση Giorgio**.

#### SSoT audit (grep + ανάγνωση, 2026-11-23)

| Ανάγκη | Υπάρχον | Συμπέρασμα |
|---|---|---|
| Όριο στο στιγμιότυπο | `ListingTerrainSnapshot.boundary` (`listing-terrain-types.ts:110`) = «**κόπηκε** σε αυτό» · `ListingTerrainSource.boundary` (`listing-terrain-source.ts:54`) · `boundaryWorldMm` → `clipTinToBoundary` (`listing-terrain-snapshot.ts:53`) | **ΔΕΝ** επαναχρησιμοποιείται για το περίγραμμα: άλλη σημασία (Civil 3D). Μένει για την πόρτα του viewer (Β5) |
| Περίγραμμα στην κάτοψη | `terrain-map-model.ts:63,176` `boundaryPathData` · `terrain-map-symbols.tsx:34` `TERRAIN_BOUNDARY_CLASS` · πάχος `terrain-map-palette.ts:83` | **Χρήση** του συμβόλου· το μοντέλο αποκτά δεύτερη πηγή |
| Γραμμή στο 3Δ | `terrain-3d-scene.ts` `LineSegments2` των ισοϋψών (`contourLine`, `swapGeometry`) · δειγματοληψία TIN `tin-sampler.ts` / `inspect/terrain-inspect-index.ts` | **Χρήση**: ίδιος τύπος γραμμής, το περίγραμμα «ντυμένο» στο TIN |
| Κλειστή πολυγραμμή → δακτύλιος | viewer `topo-boundary-pick.ts` (`closedRingVerticesOf`: κλειστή, ≥ 3 κορυφές — **αγνοεί bulges**) · `rendering/entities/shared/geometry-bulge-utils.ts` (`bulgeToPolyline`) | Το κατηγόρημα **μετακομίζει** στο `lib` (συνταγή `planar-polygon` / Β1, re-export)· τα bulges επίσης — όρια οικοπέδων έχουν τόξα |
| Ανάγνωση DXF εκτός viewer | `src/lib/dxf/` (`dxf-section-scan` · `dxf-line-stream` · `dxf-insunits` · `dxf-ocs`) · `survey-import/dxf-survey-points.ts` (μόνο POINT/TEXT) | **Επέκταση**: σαρωτής LWPOLYLINE / POLYLINE πάνω στα **ίδια** φύλλα |
| Ζωγραφική σχεδίου εκτός viewer | `src/lib/dxf-scene/canvas-scene-painter.ts` (line/polyline/circle/arc) · `scene-fit-transform.ts` · `scene-bounds.ts` | **Χρήση** για την καρτέλα προβολής DXF/DWG |
| PDF στη συσκευή | `components/file-manager/pdf-canvas-config.ts` (`loadPdfJs`) · `PdfCanvasViewer.tsx` · `lib/pdf/pdf-page-text.ts` · `objective-value/read-pdf-on-device.ts` (ADR-949) | **Χρήση**: απόδοση + κείμενο, το αρχείο δεν φεύγει από τη συσκευή |
| Διανύσματα PDF | `services/pdf/pdf-path-walker.ts` (ADR-941, καθαρό, κωδικοί εγχέονται) | **Χρήση** για κλειστές διαδρομές· **χωρίς** γεωαναφορά δεν δίνουν ΕΓΣΑ |
| Είδος αρχείου | `survey-import/survey-file-kind.ts` (ξέρει `dxf-binary`) | **Επέκταση**: `dwg` (`AC10xx`), `pdf` (`%PDF-`) |
| ΕΓΣΑ / WGS84 | `lib/geo/greek-grid.ts` `isWithinGreekGridAreaOfUse` · `egsa87-projection.ts` | **Χρήση** |
| Εμβαδόν / απλό πολύγωνο | `src/lib/geometry/planar-polygon.ts` | **Χρήση** |
| Ενότητα «Βελτίωσε» | `improve-sections.ts` · `TerrainImproveSection.tsx` · `TerrainSurveyImportPanel.tsx` · `SurveyFilePicker` (`FileUploadZone`) | **Επέκταση**: δύο καρτέλες μέσα στην **ίδια** ενότητα, όχι νέα ενότητα |
| Πόρτα · κινητήρας · ράφι | `owner-properties/[id]/terrain/route.ts` · `publish-listing-material.ts` · `public-shelf-terrain-bake.ts` (μία πηγή ανά προέλευση) · CHECK 3.105 | **Χρήση** — καμία δεύτερη πόρτα δημοσίευσης εδάφους |
| DWG | **Τίποτα** (`geo-canvas/.../DwgParser.ts` = `throw 'not implemented'`) | Νέο, **μόνο** με εγκεκριμένη βιβλιοθήκη |

#### Προτεινόμενες αποφάσεις
- **Π1 — Δύο έννοιες, δύο πεδία.** Το `boundary` (κοπή) μένει όπως είναι. Νέο `plotOutline` (δακτύλιος, WORLD mm στην πηγή,
  πλαίσιο στιγμιοτύπου στο snapshot), που **δεν** αγγίζει TIN, ισοϋψείς, κλίσεις ή στατιστικά. Ο builder το μεταφέρει από το
  **ίδιο** `SnapshotFrame` (Δ3) και μετρά επιπλέον: εμβαδόν περιγράμματος και ποσοστό του που καλύπτει το ανάγλυφο.
- **Π2 — Μία πηγή εδάφους, ένας γραφέας του περιγράμματος.** Το περίγραμμα μπαίνει στην **κανονική** πηγή εδάφους
  (ένα αρχείο προέλευσης ⇒ ράφι, ψήστης και 3.105 μένουν ίδια). Το γράφει **μία** καθαρή συνάρτηση (`withPlotOutline(source, outline)`)
  που καλούν και οι δύο πράξεις:
  - **Δημοσίευση ισοϋψών**: η πόρτα **του server** συμπληρώνει το επιβεβαιωμένο περίγραμμα του φακέλου (ο browser δεν το στέλνει).
  - **Επιβεβαίωση περιγράμματος**: νέο σκέλος της **ίδιας** πόρτας εδάφους. Παίρνει την τρέχουσα πηγή, βάζει το περίγραμμα και
    ξαναδημοσιεύει από τον **ίδιο** κινητήρα. Αν δεν υπάρχει ανάγλυφο ακόμη, φυλάγεται μόνο το περίγραμμα και μπαίνει στο πρώτο ανάγλυφο.
- **Π3 — Το αρχικό σχέδιο είναι έγγραφο του ανθρώπου.** Φυλάγεται στον **φάκελο** (`files_personal`, ADR-866). Απαντά και στο
  ανοιχτό «φύλαξη του αρχικού» (§13.4 φάση β). Ποτέ στο ράφι. ⚠️ **Διορθώθηκε στο Ζ3 (2026-11-23):** η αρχική διατύπωση έλεγε
  «νέα κατηγορία, ορατό στα Έγγραφα» — συγκρουόταν με την **υπάρχουσα** είσοδο `study-admin-topographic` («Τοπογραφικό
  Διάγραμμα») και με τον κανόνα Giorgio 2026-09-19 (άγκυρα Α38.1: το τοπογραφικό ζει **πάντα** στην πρώτη καρτέλα, ποτέ στα
  «Έγγραφα»). Με εντολή «όπως οι μεγάλοι» (Procore: τα σχέδια σε δικό τους εργαλείο, χωριστά από τα έγγραφα) ⇒ **καμία** νέα
  κατηγορία· το σχέδιο γεννιέται με τα domain/category/purpose **της εισόδου** και φαίνεται στην καρτέλα «Τοπογραφικό».
- **Π4 (Q3) — Αυτόματη πρόταση με απόδειξη και ένα πάτημα επιβεβαίωσης.** Πάνω από το Revit (μόνο χειροκίνητο Pick Lines).
  Υποψήφια: κάθε κλειστή πολυγραμμή (με τόξα), με **ονομασμένα** τεκμήρια κατάταξης:
  - όνομα στρώσης (`ΟΡΙΟ` · `ΟΙΚΟΠΕΔΟ` · `ΙΔΙΟΚΤΗΣΙΑ` · `BOUNDARY` · `PARCEL` · `PROPERTY`, σε ένα config)·
  - εμβαδόν κοντά στο δηλωμένο της αγγελίας·
  - επικάλυψη με το ανάγλυφο·
  - ετικέτες κορυφών (Α, Β, Γ…) δίπλα στις κορυφές·
  - απλό πολύγωνο (χωρίς αυτοτομή).

  Ο άνθρωπος βλέπει το σχέδιο με το προτεινόμενο τονισμένο και **επιβεβαιώνει** ή **πατά άλλο** — ποτέ σιωπηλή επιλογή.
  Ισοβαθμία ⇒ καμία προεπιλογή.
- **Π5 — PDF: ο πίνακας συντεταγμένων είναι η γεωαναφορά.** Από το κείμενο της σελίδας (`pdf-page-text`) διαβάζεται ο πίνακας
  κορυφών ΕΓΣΑ'87 ⇒ **ακριβής** δακτύλιος χωρίς βαθμονόμηση. Διασταύρωση με το γραμμένο εμβαδόν «Ε = …». Αν δεν υπάρχει πίνακας,
  το PDF **προβάλλεται** αλλά **δεν** δίνει περίγραμμα, και αυτό λέγεται ρητά (ποτέ μαντεμένη θέση — παγίδα ADR-718).
  GeoPDF: αργότερα, αν φανεί πραγματικό αρχείο.
- **Π6 — Ίδιο σύστημα ή καμία συγχώνευση.** Περίγραμμα και ανάγλυφο πρέπει να επικαλύπτονται στο ίδιο πλαίσιο (ΕΓΣΑ, ίδιες
  μονάδες μέσω `$INSUNITS` και ίδιας πολιτικής με τα σημεία). Μηδενική επικάλυψη ⇒ ονομασμένη άρνηση «διαφορετικό σύστημα ή
  περιοχή», ποτέ μετατόπιση. Μερική ⇒ δημοσιεύεται, με το ποσοστό που δεν καλύπτει το ανάγλυφο.
- **Π7 — 3Δ**: το περίγραμμα «ντύνεται» στο TIN: τεμαχίζεται στις ακμές των τριγώνων και παίρνει Z από την **ίδια** επιφάνεια.
  Ό,τι πέφτει έξω από το ανάγλυφο **δεν** σχεδιάζεται (κανένα επινοημένο υψόμετρο). Ίδιο `LineSegments2`, χρώμα και πάχος από
  την **ίδια** παλέτα με την κάτοψη.
- **Π8 (Q2) — Η καρτέλα του σχεδίου μόνο για τον ιδιοκτήτη.** Στο κοινό φτάνει **μόνο** το περίγραμμα μέσα στο «Ανάγλυφο». Λόγοι:
  - Δ2: «δημοσιεύεται μόνο παράγωγο»·
  - πνευματική ιδιοκτησία του τοπογράφου·
  - το διάγραμμα ονομάζει **όμορους ιδιοκτήτες** (προσωπικά δεδομένα)·
  - κανένας από τους μεγάλους δεν δημοσιεύει σχέδιο τοπογράφου.
- **Π9 — Το δημόσιο περίγραμμα θέλει ρητή επιλογή (Δ3).** Επειδή το σχήμα εντοπίζει το οικόπεδο στο Κτηματολόγιο, το περίγραμμα
  δημοσιεύεται **μόνο** με κουτάκι «να φαίνεται το περίγραμμα στην αγγελία». Στην προεπισκόπηση του ιδιοκτήτη φαίνεται **πάντα**.
- **Π10 — DWG στη συσκευή, σε Worker, μόνο μετά από έγκριση άδειας.** Μέχρι τότε το `.dwg` παίρνει ονομασμένη άρνηση με οδηγία
  «αποθήκευση ως DXF» (όπως το `.xls`).

#### Ερωτήματα προς Giorgio (πριν από κώδικα)
1. Έγκριση Π8 (σχέδιο μόνο για τον ιδιοκτήτη) και Π9 (ρητή επιλογή για το δημόσιο περίγραμμα);
2. Έγκριση Π4 (αυτόματη πρόταση + επιβεβαίωση);
3. Το Π1 απαιτεί `LISTING_TERRAIN_SOURCE_VERSION` 1→2, `LISTING_TERRAIN_SNAPSHOT_VERSION` 1→2 και `BUILDER_REVISION` 2→3 (οι αναγνώστες
   δέχονται και το v1, χωρίς περίγραμμα). Έγκριση;
4. DWG: έλεγχος `LICENSE` και εγκατάσταση του `@node-projects/acad-ts` (Π10) — τώρα ή σε επόμενο βήμα;

#### Υποβήματα (ένα commit το καθένα, «ΠΡΟΧΩΡΑ» σε καθένα)
- **Ζ1** — καθαρός πυρήνας: σαρωτής πολυγραμμών DXF · τόξα · υποψήφια + κατάταξη · πίνακας συντεταγμένων PDF · έλεγχοι Π6 ·
  περίγραμμα ντυμένο στο TIN.
- **Ζ2** — συμβόλαιο: `plotOutline` σε πηγή, snapshot και αναγνώστη· `withPlotOutline`.
- **Ζ3** — πόρτα και φάκελος: σκέλος επιβεβαίωσης · συμπλήρωση στη δημοσίευση ισοϋψών · αρχικό σχέδιο στον φάκελο · ιστορικό ·
  ιδεμποτία.
- **Ζ4** — UI ιδιοκτήτη: καρτέλες «Ισοϋψείς | Τοπογραφικό» στην ενότητα · προβολή σχεδίου (DXF/PDF) με τονισμένα υποψήφια ·
  επιβεβαίωση · κουτάκι Π9. *(✅ κώδικας 2026-11-23 — βλ. «Ζ4» παρακάτω)*
- **Ζ5** — περίγραμμα στην κάτοψη και στο 3Δ, σε προεπισκόπηση και δημόσια αγγελία. *(✅ κώδικας 2026-11-24 για κάτοψη + 3Δ — βλ. «Ζ5» παρακάτω· ο χάρτης του ιδιοκτήτη στη «Βελτίωσε» = «Ζ5β»)*
- **Ζ6** — DWG (μετά το ερώτημα 4).

#### Ζ1 — ο καθαρός πυρήνας *(κώδικας ✅ 2026-11-23 · tests ✅ 15/15 σουίτες · 257 tests, με έγκριση Giorgio)*

Μόνο `src/lib` (+ re-exports στον viewer + 2 κλειδιά i18n). Κανένα UI, server ή συμβόλαιο — αυτά είναι Ζ2–Ζ5.

**Μετακομίσεις SSoT (συνταγή `planar-polygon`, re-export από την παλιά διαδρομή):**
- `bulge` ⇒ **`src/lib/geometry/polyline-bulge.ts`** (από `dxf-viewer/rendering/entities/shared/geometry-bulge-utils.ts`, που
  πλέον επανεξάγει· οι εισαγωγές του viewer δεν άλλαξαν). Σημεία = η δηλωμένη ρίζα `PlanarPoint` (CHECK 3.59), όχι δεύτερο
  `Point2D`· είναι readonly — μετρημένο ότι **κανένας** καλών του viewer δεν αλλάζει επί τόπου σημείο που επιστρέφεται.
- «κάνει για όριο;» ⇒ **`src/lib/geometry/closed-polyline-ring.ts`** (`qualifiesAsClosedRing`). Το `closedRingVerticesOf` του
  viewer (`topo-boundary-pick.ts`) το καλεί — ένα κατηγόρημα. Ο ίδιος φάκελος δίνει `closedRingWithArcs` (δακτύλιος με
  τεμαχισμένα τόξα, βήμα 3° ⇒ σφάλμα χορδής < 0,035 % της ακτίνας).
- Ο πυρήνας «τμήμα πάνω στο TIN» του προφίλ ⇒ **`profileTraceOf`** (`inspect/terrain-profile.ts`). Το `terrainProfileOf` το
  καλεί· η συμπεριφορά του προφίλ δεν άλλαξε (το όριο 0,5 m μένει δικό του).

**Νέα αρχεία:**

| Αρχείο | Ρόλος | Σημεία που κρίνουν |
|---|---|---|
| `lib/dxf/dxf-polylines.ts` | LWPOLYLINE + POLYLINE/VERTEX/SEQEND σε κάτοψη, μονάδες σχεδίου, `$INSUNITS` | Η εξώθηση του LWPOLYLINE γράφεται **μετά** τις κορυφές· (0,0,−1) ⇒ x→−x **και** αντιστροφή κάθε bulge· κεκλιμένο επίπεδο ⇒ `tilted-plane` (μετρημένο, όχι λυγισμένο)· πλέγματα ⇒ `mesh`· σημεία πλαισίου spline (VERTEX 70 bit 16) πετιούνται· μόνο ENTITIES |
| `lib/dxf/dxf-text-labels.ts` | TEXT (OCS→WCS, σημείο στοίχισης αν 72/73 ≠ 0) + απλό MTEXT | MTEXT με κωδικούς μορφοποίησης **μετριέται**, δεν μαντεύεται (ADR-745 §2.3 Παγίδα Α) |
| `terrain/plot-outline/plot-outline-config.ts` | όλες οι λέξεις και τα κατώφλια, με το «γιατί» | Ρίζες στρώσεων + **ΓΕΩΤΕΜΑΧ** + **PLOT** (Giorgio 2026-11-23). Ετικέτα γωνίας = **γράμμα** (Α, Κ1)· τα σκέτα νούμερα είναι αριθμοί σημείων αποτύπωσης σε **κάθε** σημείο |
| `terrain/plot-outline/plot-outline-types.ts` | υποψήφιο · τεκμήριο · απόρριψη · κατάταξη | WORLD mm, δακτύλιος χωρίς επανάληψη της πρώτης κορυφής |
| `terrain/plot-outline/plot-area-statement.ts` | «Ε = 1.364,05 τ.μ.» → m² | **Μονάδα υποχρεωτική** (αλλιώς το «E = 0.9996» του συντελεστή κλίμακας θα γινόταν εμβαδόν)· `parseStrictDecimal` |
| `terrain/plot-outline/dxf-plot-outline-candidates.ts` | DXF → υποψήφια (Π4), δύο φάσεις όπως τα σημεία | Κλειστό = σημαία **ή** τελευταία κορυφή πάνω στην πρώτη· απορρίψεις με όνομα `self-intersecting` (ελέγχεται **πρώτο**: το παπιγιόν έχει εμβαδόν 0) · `zero-area` · `too-many-corners` (> 1000: κλειστή ισοϋψής, αυτοτομή O(n²)) |
| `terrain/plot-outline/plot-outline-ranking.ts` | κατάταξη Π4 | Τεκμήρια με όνομα: `layer-name` · `declared-area` (το πλησιέστερο: σχέδιο ή αγγελία, με την πηγή του) · `relief-overlap` (Π6) · `corner-labels`. Πρόταση **μόνο** με μοναδικό πρώτο **και** τεκμήριο υπέρ· αλλιώς `tie` / `no-evidence` |
| `terrain/plot-outline/plot-outline-coverage.ts` | Π6: `covered` · `partial` (με ποσοστό) · `disjoint` | Εμβαδόν του `clipTinToBoundary(relief, outline)` — η **ίδια** κοπή, σωστή για κοίλο όριο· ποτέ μετατόπιση |
| `terrain/plot-outline/pdf-coordinate-rows.ts` | γραμμές πίνακα από το `pdf-page-text` | Ζεύγος = δύο αριθμοί **μέσα** στην περιοχή χρήσης του EPSG:2100· Ε και Ν ξεχωρίζουν από το **μέγεθος** (τα εύρη δεν επικαλύπτονται), σε οποιαδήποτε σειρά στηλών |
| `terrain/plot-outline/pdf-coordinate-table.ts` | Π5: πίνακες → δακτύλιος ΕΓΣΑ | Στήλες από το x της ετικέτας· διακοπή σε κενό ≫ βήμα γραμμής· πίνακας σε **δύο στήλες** ενώνεται (και τα μέρη μένουν υποψήφια)· **δύο** διασταυρώσεις: εμβαδόν (ανοχή = περίμετρος × 0,01 m²/m) και πλευρές (±2 cm, και οι δύο συμβάσεις)· `unreadable` / `no-coordinate-table` με όνομα |
| `terrain/plot-outline/plot-outline-drape.ts` | Π7: το περίγραμμα πάνω στο ανάγλυφο | `profileTraceOf` ανά ακμή· εκτός αναγλύφου **σπάει**, κανένα επινοημένο Z· ολόκληρο πάνω ⇒ **ένα** κλειστό κομμάτι· τα ζεύγη `LineSegments2` από το υπάρχον `terrain3dPolylinePairs` (Ζ5) |

**Είδος αρχείου:** το `survey-file-kind` γνωρίζει `dwg` (`AC10xx` / `AC1.x` / `AC2.x` **και** δυαδική κεφαλίδα — ένα CSV με
πρώτο κελί «AC1012» μένει CSV) και `pdf` (`%PDF-` μέσα στα πρώτα bytes). Στην καρτέλα σημείων: άρνηση με όνομα
`read.refusals.dwg` («αποθήκευσε ως DXF») και `read.refusals.pdf` («ζήτα τα σημεία σε CSV/TXT/Excel/DXF»), πρότυπο Revit/Figma:
ποτέ σιωπηλό γκρίζο. Το μήνυμα του PDF **δεν** παραπέμπει σε καρτέλα που δεν υπάρχει ακόμη (Ζ4). Το `accept` του διαλόγου
προσφέρει και `.dwg` / `.pdf`, για τον ίδιο λόγο με το `.xls`.

**Tests (✅ έτρεξαν 2026-11-23 με έγκριση: 15/15 σουίτες, 257 πράσινα, 2 skipped σε υπάρχουσες):** `lib/geometry/__tests__/closed-polyline-ring.test.ts` · `lib/dxf/__tests__/dxf-polylines.test.ts` ·
`lib/terrain/plot-outline/__tests__/{plot-outline-dxf,pdf-coordinate-table,plot-outline-relief}.test.ts`. Αλλαγμένα:
`survey-preparation.test.ts` (PDF: `unsupported` → `pdf`, + DWG) · `survey-import-lib.test.ts` (τα νέα αρχεία στη σάρωση ορίου).

**Εύρημα της πρώτης εκτέλεσης (διορθώθηκε):** το εμβαδόν δακτυλίου σε ωμά ΕΓΣΑ mm (~4·10⁹) έχανε ψηφία στο float64 —
τετράγωνο 100 m² ⇒ **99,999744 m²** (τα γινόμενα του shoelace ~10¹⁹). Νέο `plot-outline/plot-outline-area.ts` (`ringAreaM2`):
μετατόπιση στην πρώτη κορυφή και μετά άθροισμα — η ίδια θεραπεία με το τοπικό πλαίσιο του TIN. Το καλούν DXF, PDF και κάλυψη.

**(Α) Η θεραπεία μετακόμισε στο ΚΟΙΝΟ SSoT (2026-11-23, έγκριση Giorgio).** Το ίδιο κενό είχε το `lib/geometry/planar-polygon.ts`
(`shoelaceArea` / `polygonArea`) για **κάθε** καλούντα σε ΕΓΣΑ mm — π.χ. πίνακας εμβαδού οικοπέδου (`survey-tables.ts`), έλεγχος
εκφυλισμένου δακτυλίου (`check-boundary-closure.ts`), όλη η γεωμετρία BIM σε γεωαναφερμένο σχέδιο. Μετρημένο (ακέραια mm,
x=412.345.679, y=4.498.765.432): 100 m² ⇒ −256 mm² · κολόνα 30×30 cm ⇒ **−0,16%** · κύκλος 2000 κορυφών ⇒ −2.635 mm². Το
απόλυτο σφάλμα είναι ~σταθερό, άρα το **σχετικό** μεγαλώνει όσο μικραίνει το σχήμα. Θεραπεία: το `shoelaceArea` αθροίζει **γύρω
από την πρώτη κορυφή** — ίδιο εμβαδόν, ίδιο πρόσημο, δύο αφαιρέσεις ανά κορυφή, μηδέν δέσμευση μνήμης. Η αφαίρεση είναι ακριβής
(Sterbenz: ίδια τάξη μεγέθους) και τα γινόμενα πέφτουν στα ~10¹⁰ ⇒ μετρημένο ακριβές στα ορθογώνια, 0,0009 mm² στον κύκλο·
Kahan/`fma` **ελέγχθηκαν και δεν χρειάζονται**. Το `ringAreaM2` έμεινε μόνο ως βήμα mm² → m² (`polygonArea / 1e6`), όχι δεύτερο εμβαδόν.
Άγκυρα: `lib/geometry/__tests__/planar-polygon.test.ts` «εμβαδόν μακριά από την αρχή των αξόνων» (3 `it`, `toBe` ακριβές).
Μένουν **εκτός** (μόνο αναφορά, N.0.2): ~20 ενσωματωμένα δίδυμα shoelace στο dxf-viewer (`wall-footprint-union`, `tek-geometry`,
`perimeter-polygon-math`, `polygon-offset-utils`, `stair-region-classifier` …) και τα ομώνυμα `measure-overlay-draw.polygonArea`,
`overlay-persistence-utils.polygonArea`, `building-code/utils/geometry.shoelaceArea` — **δεν** παίρνουν τη διόρθωση.

**Ανοιχτά (προτάσεις, όχι εντολές):** (α) ο viewer κλείνει το όριο όγκων **χωρίς** τόξα — θα μπορούσε να καλεί το
`closedRingWithArcs`· (β) το `dxf-survey-points` διαβάζει τη θέση του TEXT χωρίς OCS→WCS, ενώ το `dxf-text-labels` τη μετατρέπει.

#### Ζ2 — το συμβόλαιο *(κώδικας ✅ 2026-11-23 · tests γραμμένα)*

**SSoT audit (grep):** κανένα δεύτερο πεδίο/τύπος περιγράμματος στο συμβόλαιο· το `boundary` (κοπή) έμεινε ανέγγιχτο. Καταναλωτές
των εκδόσεων: `public-shelf-kinds.ts` (συνταγή ραφιού `json:terrain-s{snap}-w{src}-b{rev}`) · `listing-terrain-card.ts`
(`snapshotVersion`, δέχεται κάθε θετικό ακέραιο) · ο αναγνώστης. Κατασκευαστές πηγής: **μόνο** το `surveySourceOf`
(`survey-upload-preparation.ts`). Καλούντες του `toListingTerrainInput`: **μόνο** ο κριτής και ο ψήστης.

| Κομμάτι | Αρχείο | Τι |
|---|---|---|
| Πηγή v2 | `publication/listing-terrain-source.ts` | `plotOutline: { ring, showInListing } \| null` (WORLD mm, ίδιο σχήμα δακτυλίου με το `boundary`) · `LISTING_TERRAIN_SOURCE_VERSION` **2** · το **v1** διαβάζεται ως v2 με `plotOutline: null` (`discriminatedUnion` στην έκδοση — μιλά η έκδοση, όχι προεπιλογή) και αποθηκεύεται ως v2 · κωδικοποίηση με το `plotOutline` τελευταίο |
| Ο ΕΝΑΣ γραφέας | `withPlotOutline(source, { ringWorldMm, showInListing } \| null)` | περνά από το **ίδιο** σχήμα + κανονική μορφή (mm, όρια, πλήθος κορυφών) · `null` αφαιρεί · ταυτοδύναμο · άκυρος δακτύλιος ⇒ `null`, ποτέ μισογραμμένη πηγή |
| Κοινό (Π9) | `toListingTerrainInput(source, audience)` | `'owner'` ⇒ περίγραμμα **πάντα** (κριτής = προεπισκόπηση) · `'public'` ⇒ **μόνο** με `showInListing` (ψήστης ραφιού) · **χωρίς** προεπιλογή: κάθε καλών δηλώνει για ποιον χτίζει. Το κρυφό περίγραμμα **δεν μπαίνει** στη δημόσια είσοδο ⇒ τίποτα να «κρυφτεί» μετά |
| Τοποθέτηση | `plot-outline/plot-outline-placement.ts` (`placePlotOutline`) | ίδιο σχήμα με το `placeEnvelope`: «το βάζω ή λέω γιατί όχι» · `degenerate-outline` (< 3 κορυφές · μηδενικό εμβαδόν · αυτοτομή) · `outside-surface` (Π6: μηδενική επικάλυψη, **ποτέ** μετατόπιση) · αλλιώς δακτύλιος στο `SnapshotFrame` (Δ3) + `areaM2` + `coverage` (`covered`/`partial`) + `coveredFraction` (από το `plotOutlineCoverage` του Ζ1) |
| Στιγμιότυπο v2 | `publication/listing-terrain-types.ts` · `-snapshot.ts` | `plotOutline` + `plotOutlineOmission` · `LISTING_TERRAIN_SNAPSHOT_VERSION` **2** · `LISTING_TERRAIN_BUILDER_REVISION` **3** · το mesh/ισοϋψείς/κλίσεις/στατιστικά χτίζονται **χωρίς** να κοιτάξουν το περίγραμμα (Π1). Η συναρμολόγηση βγήκε σε `snapshotOf` (όριο 40 γραμμών) |
| Αναγνώστης | `publication/listing-terrain-snapshot-reader.ts` | δέχεται v1 **και** v2· το v1 γίνεται v2 χωρίς περίγραμμα **στη μνήμη** · v2 χωρίς τα πεδία ⇒ `malformed` · μη πεπερασμένο στο περίγραμμα ⇒ `non-finite` |

**Συνέπεια στο ράφι:** νέα συνταγή (`s2-w2-b3`) ⇒ τα δημοσιευμένα στιγμιότυπα ξαναψήνονται στην επόμενη συμφιλίωση/νυχτερινό
πέρασμα· ως τότε τα v1 αρχεία διαβάζονται κανονικά.

**Για το Ζ3 (δεν έγινε εδώ):** η πόρτα παίρνει την πηγή του browser και **πάντα** εφαρμόζει `withPlotOutline` με το
επιβεβαιωμένο περίγραμμα του φακέλου (ή `null`) — ένα περίγραμμα που στέλνει ο browser μαζί με το τοπογραφικό **δεν** είναι
επιβεβαίωση.

**Tests (γραμμένα, δεν έχουν τρέξει):** `listing-terrain-source.test` (+5 · + 3 περιπτώσεις άρνησης · `toListingTerrainInput`
με κοινό) · `listing-terrain-snapshot.test` (+5: Π1 «δεν κόβει τίποτα», Π6 partial 400/900, disjoint, εκφυλισμένο, απουσία) ·
`listing-terrain-snapshot-reader.test` (+8: v1→v2, v2 χωρίς πεδία, roundtrip, 4 malformed, non-finite) ·
`public-shelf-terrain.test` (+1 Π9 στον ψήστη · συνταγή `s2-w2` · έκδοση 2). Fixtures στιγμιοτύπου σε v2: `terrain-3d-fixtures`,
`terrain-inspect`, `terrain-profile-chart`, `plot-outline-relief`.

#### Ζ3 — πόρτα και φάκελος *(κώδικας ✅ 2026-11-23 · tests γραμμένα, δεν έχουν τρέξει)*

**SSoT audit (grep + ανάγνωση):** δύο σπίτια της ίδιας πόρτας (`properties/[id]/terrain` γραφείο · `owner-properties/[…]/terrain`
ιδιοκτήτης), κοινός κώδικας `terrain-upload.server`, ο ΕΝΑΣ κινητήρας `publish-listing-material` · η είσοδος `study-admin-topographic`
υπάρχει ήδη και ζει στην πρώτη καρτέλα του φακέλου · τα πεδία που γράφει **μόνο** ο server στο `files_personal` ζουν στο
`measuredKeys()` των κανόνων (με αγκυρωμένα tests) · ο server ήδη τρέχει pdf.js (`pdf-rasterize.service`) και η συσκευή έχει
μετατροπή σελίδας **με θέσεις** (`read-pdf-on-device`) — ο server όχι · το `canonicalMimeForExt` δίνει τον τύπο από το είδος ·
κανένας φρουρός `isTopoUnit`.

**Αποφάσεις (εντολή Giorgio «όπως οι μεγάλοι, χωρίς εκπτώσεις»):**
- **Ο browser ονομάζει ΥΠΟΨΗΦΙΟ, ο server δίνει τον δακτύλιο** — για DXF **και** PDF. Το αίτημα είναι `{ candidateId, showInListing }`
  (+ μονάδα για DXF χωρίς `$INSUNITS`)· ο server ξαναδιαβάζει τα bytes με τον **ίδιο** πυρήνα του Ζ1 και βρίσκει το υποψήφιο με το
  id του. Καμία σύγκριση float, καμία εμπιστοσύνη σε παράγωγο του πελάτη (όπως ο κριτής εδάφους, §13.3). Πρότυπο Figma/Google.
- **Προέλευση πέρα από τους μεγάλους**: το επιβεβαιωμένο κρατά υποψήφιο, προέλευση (στρώση/handle ή σελίδα PDF), μονάδα και sha256
  του σχεδίου — το Revit ξεχνά από ποια γραμμή του CAD πήρε το property line, το Civil 3D κρατά το parcel μόνο ως xref.
- **Πού ζει το επιβεβαιωμένο**: πεδίο `plotOutline` στην εγγραφή του σχεδίου (`files_personal`), στο `measuredKeys()` ⇒ ο πελάτης
  δεν το γράφει ποτέ. **Όχι** custom metadata του Storage: δακτύλιος με τόξα ξεπερνά το όριο των 8 KiB. Η εγγραφή φέρει
  `publicationIdentity: 'terrain/plot-drawing'` (μόνο ο server τη γράφει — `publicationBornAbsent`) ⇒ διαδοχή ISO 19650 **και** κηδεμονία.
- **Γραφείο**: δεν έχει φάκελο ⇒ `confirmedOutlineOf: async () => null` — το περίγραμμα του browser **αφαιρείται**.
- **Fail-closed**: φάκελος/πηγή που δεν διαβάζεται ⇒ `TERRAIN_PLOT_OUTLINE_UNREADABLE` / `TERRAIN_CURRENT_SOURCE_UNREADABLE` (503),
  ποτέ σιωπηλό «κανένα περίγραμμα» / «κανένα ανάγλυφο».

| Κομμάτι | Αρχείο | Τι |
|---|---|---|
| Συμβόλαιο | `publication/terrain-publication-contract.ts` · `plot-outline/plot-outline-config.ts` | `PLOT_OUTLINE_CONFIRM_FIELDS` (`drawing` · `plotOutline` · `drawingUnit`) · 12 νέοι κωδικοί (σχέδιο · επιλογή · Π6 · μη αναγνώσιμα) με el/en · ταβάνια `PLOT_DRAWING_MAX_BYTES` (DXF = `UPLOAD_LIMITS.MAX_FILE_SIZE`, PDF = `DOCUMENT_TEXT_MAX_BYTES`) |
| Επιβεβαιωμένο | `plot-outline/plot-outline-confirmation.ts` | αίτημα (zod) · `confirmedPlotOutlineOf` · `readConfirmedPlotOutline` · `plotOutlineChoiceOf` — δακτύλιος ως `{x,y}` (το Firestore δεν έχει πίνακες πινάκων)· το χιλιοστό εφαρμόζεται **μία** φορά, από το `withPlotOutline` |
| Εγγραφή σχεδίου | `lib/listings/topographic-drawing-file-record.ts` | domain/category/purpose **από την είσοδο** · **χωρίς** `classification` (ιδιωτικό, Π8) · ταυτότητα `terrain/plot-drawing` · τύπος από `canonicalMimeForExt` |
| Κανόνες | `firestore.rules` `measuredKeys()` + `plotOutline` · `tests/firestore-rules/suites/files{,-personal}.rules.test.ts` | ο πελάτης δεν γεννά/αλλάζει το πεδίο (⚠️ θέλει deploy κανόνων) |
| PDF στον server | `lib/pdf/pdf-page-text.ts` `positionedPageOf` · `services/pdf/pdf-positioned-text.service.ts` · `pdf-rasterize.service.ts` `mapPdfPages` | **μία** μετατροπή σε θέσεις οθόνης (τη χρησιμοποιεί πλέον και η συσκευή) · **ένας** βρόχος σελίδων για διάταξη · κείμενο · κείμενο με θέσεις |
| Σχέδιο στον server | `server/listing-terrain/plot-drawing-upload.server.ts` | είδος από τα bytes (`surveyFileKindOf`) · ταβάνι ανά είδος · DWG ⇒ «αποθήκευσε ως DXF» (Π10) · μονάδα: αρχείου ή ανθρώπου, ποτέ μαντεψιά (`isTopoUnit`, νέο, δίπλα στη ρίζα) |
| Φάκελος | `server/listing-terrain/dossier-terrain.reader.ts` | ίδιο ερώτημα με τη βιτρίνα · νεότερο **ενεργό** σχέδιο (`isDeliverableListingFile` — σχέδιο στον κάδο δεν δίνει περίγραμμα) · τρέχουσα πηγή + Δ2 από τον κάδο της εγγραφής |
| Επιβεβαίωση | `server/listing-terrain/plot-outline-confirmation.server.ts` | Π6 **πριν** από κάθε εγγραφή · **σχέδιο πρώτα** (`writeMaterial`, ίδιος κύκλος PENDING→READY/FAILED) · μετά επαναδημοσίευση από τον ΙΔΙΟ κινητήρα (`publishOwnerMaterialIn`, με την πόρτα της διαδρομής ώστε το `buildPublishedTerrainFileRecord` να μένει στο `route.ts`, 3.105 Κ2) |
| Δημοσίευση ισοϋψών | `server/listing-terrain/terrain-upload.server.ts` | `confirmedOutlineOf` ανά πόρτα · `withConfirmedOutline` **πάντα** · `terrainUploadOfSource` (ένας κριτής για POST και επαναδημοσίευση) · απάντηση + `plotOutline`/`plotOutlineOmission` |
| Πόρτα | `owner-properties/[…]/terrain/route.ts` | `PUT` στο **ίδιο** αρχείο (ίδιο `withPersonalOrOrgAuth` ⇒ `runIdempotently`, 3.92) · ιστορικό `plotOutline` (σχέδιο → διάδοχος) με τον ίδιο γραφέα ιστορικού του `terrain` |

**Σειρά της επιβεβαίωσης:** φρουρός κηδεμονίας/φακέλου (πριν το σώμα) → επιλογή → σχέδιο + υποψήφια → τρέχουσα πηγή → Π6 →
σχέδιο στον φάκελο + διαδοχή → (αν υπάρχει ανάγλυφο) επαναδημοσίευση → ιστορικό. «Σχέδιο πρώτα»: αν πέσει η επαναδημοσίευση, η
επόμενη δημοσίευση παίρνει το περίγραμμα από τον φάκελο· ανάποδα, θα το έσβηνε.

**Ανοιχτά (προτάσεις, όχι εντολές):** (α) το σχέδιο στον κάδο σταματά να δίνει περίγραμμα, αλλά ο κάδος του `files_personal` είναι
πράξη πελάτη χωρίς επαναπροβολή ⇒ το ήδη δημοσιευμένο ανάγλυφο κρατά το περίγραμμα μέχρι την επόμενη δημοσίευση· (β) αλλαγή του
κουτιού Π9 ή αφαίρεση περιγράμματος **χωρίς** νέο ανέβασμα (θα τη χρειαστεί το Ζ4)· (γ) το 3.76 βλέπει την πόρτα από το `route.ts`
(`publishOwnerPropertyMaterial`)· το `publishOwnerMaterialIn` δεν είναι στους `REFRESH_HELPERS`.

**Tests (γραμμένα, δεν έχουν τρέξει — μόνο με έγκριση Giorgio):** `owner-property-plot-outline-route.test` (Ε1–Ε8: σχέδιο πρώτα +
επαναδημοσίευση με τον δακτύλιο του server · μόνο σχέδιο χωρίς ανάγλυφο · Π6 disjoint · υποψήφιο εκτός σχεδίου · PDF · 6 αρνήσεις ·
ξένη αγγελία · διαδοχή σχεδίου) · `owner-property-terrain-route.test` (Ι1 + ερώτημα φακέλου · Ι8 το περίγραμμα του browser
αφαιρείται · Ι9 το επιβεβαιωμένο αντικαθιστά · Ι10 χαλασμένο ⇒ 503 · Ι11 σχέδιο στον κάδο) · `plot-outline-confirmation.test` ·
`topographic-drawing-file-record.test` (πρώτη καρτέλα, ιδιωτικό) · `pdf-page-text.test` (`positionedPageOf`) · κανόνες
`files{,-personal}.rules.test` (+`plotOutline`) · `terrain-publication-contract.test` (η πόρτα = + 3 αρχεία του σκέλους).

#### Ζ3b — ο κάδος του φακέλου ως πράξη διακομιστή *(κώδικας ✅ 2026-11-23 · tests γραμμένα, ΔΕΝ έχουν τρέξει)*

**Πρόβλημα**: ο κάδος/η επαναφορά του `files_personal` γραφόταν από τον browser ⇒ φωτογραφία/ΠΕΑ/σχέδιο του φακέλου που
πεταγόταν **έμενε** στην αγγελία ιδιοκτήτη (ίδια κλάση Ο-35 με το εταιρικό, ADR-845 §7.17 Α2).

**Λύση — ο ΕΝΑΣ δρόμος, και στα δύο διαμερίσματα**:

| Τι | Πού | Σημείωση |
|---|---|---|
| Πόρτα | `app/api/files/trash/route.ts` | `withFileCustodyAuth`: απουσία/`company` ⇒ ό,τι ίσχυε · `?custody=personal` ⇒ `withPersonalOrOrgAuth` |
| Σκελετός | `app/api/files/_shared/file-batch-act.ts` | `runPersonalFileBatch` (PEP `personalFileResource`) · κοινά `actOnBatch`/`respondBatch` με το `runFileBatch` |
| Γραφέας | `services/file-record/file-trash.service.ts` | `writePersonalFileTrashState`: ιδεμποτία · `not-ready` · `not-in-trash` · **χωρίς** κριτή record/ικανότητας (ίδιο με τον κανόνα) · αλλαγή + γραμμή Δραστηριότητας + `lastActivityId` σε **μία** δέσμη Admin (`stagePairedFileActivity`) |
| Επαναπροβολή | `services/listings/listing-media-refresh.ts` | `refreshListingsAfterFileChanges` + σκέλος `property_dossier`: `owner_properties where dossierId ==` (μία ισότητα) ⇒ `refreshOwnerListingAfterMediaChange` ανά αγγελία |
| Πελάτης | `file-trash.client.ts` · `file-record-lifecycle.ts` | `requestFileTrash(ids, action, custody)` · ένα αίτημα **ανά διαμέρισμα** · γεγονότα μετά την επιβεβαίωση |
| Κανόνες | `firestore.rules` | `personalTrashUnchanged()` (= πεδία `fileTrashFields` ∪ `fileRestoreFields` − `updatedAt`, άγκυρα Α35.2) · `personalActivityKeys` = `displayName` · `FILE_ACTIVITY_PAIRED_ACTIONS` = `['rename']` ⚠️ θέλει deploy |
| Πύλη 3.76 | `material-doors-contract.js` | `runPersonalFileBatch` στους `REFRESH_HELPERS` |

**🔴 Το περίγραμμα ΔΕΝ ακολουθεί τον κάδο του σχεδίου — επίτηδες.** Ζει στην **πηγή εδάφους** (Π2), όχι στο σχέδιο· η
επαναπροβολή ξαναψήνει την ίδια πηγή. Πρακτική Revit: τοπογραφία από DWG μένει όταν αφαιρεθεί το DWG — το παράγωγο είναι
ανεξάρτητο, η αφαίρεση είναι **ρητή** πράξη. ⇒ Αφαίρεση/απόκρυψη περιγράμματος ΜΟΝΟ από το Π9 (βήμα 2).
**✅ Έκλεισε στο Ζ3c (ήταν «Ανοιχτό, θέλει ναι»)**: το `POST` ισοϋψών παίρνει το περίγραμμα από το **σχέδιο** του φακέλου ⇒ σχέδιο στον κάδο
⇒ νέο ανάγλυφο **χάνει αθόρυβα** το περίγραμμα — αντίθετο στην παραπάνω πρακτική· πρόταση: μεταφορά από την τρέχουσα πηγή.
**✅ Έκλεισε στο Ζ3c**: η βραδινή συμφιλίωση δεν κάλυπτε αγγελίες ιδιοκτήτη (το «δεν γράφουν αποτύπωμα» ήταν λάθος — γράφουν).

#### Ζ3c — το περίγραμμα που ΙΣΧΥΕΙ · αλλαγή χωρίς σχέδιο (Π9) · δίχτυ για τον ιδιοκτήτη *(κώδικας ✅ 2026-11-23 · tests γραμμένα, ΔΕΝ έχουν τρέξει)*

Εγκρίθηκαν από τον Giorgio και τα τέσσερα ανοιχτά του Ζ3b (α · β · γ · δ).

**(α) Ποια απόφαση ισχύει: η ΝΕΟΤΕΡΗ.** Ένα απλό «αντίγραφο από την πηγή» θα **έσπαγε** το δίχτυ «ΣΧΕΔΙΟ ΠΡΩΤΑ» του Ζ3:
όταν πέσει η επαναδημοσίευση μετά από επιβεβαίωση, η πηγή δεν έχει το περίγραμμα και μόνο το σχέδιο το ξέρει. Δύο εγγραφές
κρατούν απόφαση —το **σχέδιο** (επιβεβαίωση) και η **τρέχουσα πηγή** (ό,τι δημοσιεύεται)— και τις κρίνει ο **ίδιος** συγκριτής
με όλο το υλικό (`compareAgencyMediaForPublication`: `createdAt`, ισοπαλία στο `id`), στο `plotOutlineAuthorityOf`:

| Κατάσταση | Νικά | Γιατί |
|---|---|---|
| πηγή νεότερη από το σχέδιο, ή κανένα **ενεργό** σχέδιο | η πηγή | copy semantics (Revit: η τοπογραφία μένει όταν φύγει το DWG)· και η ρητή αλλαγή (β) γράφει νέα πηγή |
| σχέδιο νεότερο από την πηγή | το σχέδιο | επιβεβαίωση που δεν έφτασε στην πηγή (έπεσε η επαναδημοσίευση) |
| μόνο σχέδιο | το σχέδιο | Π2: περιμένει το πρώτο ανάγλυφο |

⇒ Ο κάδος του σχεδίου **δεν** αφαιρεί το περίγραμμα· το σχέδιο απλώς παύει να διεκδικεί. Η πηγή κατεβαίνει **μόνο** όταν νικά.
Πηγή που νικά και δεν διαβάζεται ⇒ 503 `TERRAIN_CURRENT_SOURCE_UNREADABLE` (fail-closed, ποτέ σιωπηλό «χωρίς περίγραμμα»).

**(β) `PATCH` — αλλαγή χωρίς νέο σχέδιο**: `{ kind: 'visibility', showInListing }` | `{ kind: 'remove' }` (αυστηρό σχήμα — ποτέ
δακτύλιος από τον browser). Ίδιος φρουρός (`enterOwnerDoor`), ίδια πόρτα `TERRAIN_DOOR` (η γέννηση μένει στο `route.ts`, CHECK
3.105 Κ2), ίδιος κινητήρας ⇒ νέα πηγή που **διαδέχεται** την τρέχουσα + επαναπροβολή· ιστορικό `plotOutline` από τον ίδιο γραφέα.
**Ταυτοδύναμο**: αν η πηγή λέει ήδη και ό,τι ισχύει και ό,τι ζητήθηκε ⇒ `changed: false`, καμία εγγραφή. Και οι δύο όροι
χρειάζονται: με σχέδιο νεότερο, ένα «ήδη αφαιρεμένο» χωρίς εγγραφή θα το ξανάφερνε το επόμενο POST. Χωρίς ανάγλυφο ⇒ 409
`TERRAIN_PLOT_OUTLINE_NO_RELIEF`· Π9 χωρίς περίγραμμα ⇒ 409 `TERRAIN_PLOT_OUTLINE_NONE`· άκυρο σώμα ⇒ 400
`TERRAIN_PLOT_OUTLINE_AMENDMENT_INVALID`. Το σχέδιο **δεν** αγγίζεται: είναι η απόδειξη του τι βρέθηκε στα bytes του.

**(γ) Δίχτυ Α5 για τον ιδιοκτήτη** — ADR-845 §10 (2026-11-23). 🔎 Η υπόθεση του handoff («ο γραφέας ιδιοκτήτη δεν γράφει
αποτύπωμα») ήταν **ψευδής**: γράφει, μέσω `writeWithShelf`. Έλειπε μόνο η σάρωση.

| Τι | Πού |
|---|---|
| Περίγραμμα που ισχύει | `server/listing-terrain/dossier-terrain.reader.ts` — `plotOutlineAuthorityOf` · `loadDossierPlotOutline` (POST) · `loadDossierTerrainState` (PATCH) · ένα ερώτημα φακέλου |
| Εγγραφή πηγής | `services/listings/terrain-source-selection.ts` — `currentTerrainSourceRecord` (ο ίδιος κριτής με το `currentTerrainSource`) |
| Αντίστροφος δρόμος | `lib/terrain/publication/listing-terrain-source.ts` — `plotOutlineChoiceIn` (πηγή → επιλογή, ταυτοτικό με το `withPlotOutline`) |
| Λεξιλόγιο αλλαγής | `lib/terrain/plot-outline/plot-outline-confirmation.ts` — `PlotOutlineAmendment` · `parsePlotOutlineAmendment` · `amendedPlotOutline` |
| Σκέλος server | `server/listing-terrain/plot-outline-confirmation.server.ts` — `amendOwnerPlotOutline` · κοινό `reliefUploadWith` με την επιβεβαίωση |
| Επαναδημοσίευση | `server/listing-material/publish-owner-property-material.ts` — `republishOwnerMaterial` (PUT + PATCH· το `publishOwnerMaterialIn` έγινε ιδιωτικό) |
| Πόρτα | `app/api/owner-properties/[ownerPropertyId]/terrain/route.ts` — `confirmedOutlineOf` = `loadDossierPlotOutline` · `PATCH` |
| Κωδικοί + μηνύματα | `terrain-publication-contract.ts` + `locales/{el,en}/terrain-survey.json` (+3) · `types/i18n.ts` |
| Δίχτυ | `services/listings/listing-media-reconciliation.service.ts` (`judgeOwnerListings`, `judgementOf`) · `owner-property-publication.service.ts` (`currentOwnerListingProjection`) |

**Tests (γραμμένα, δεν έχουν τρέξει — μόνο με έγκριση Giorgio):** `owner-property-terrain-route.test` (Ι11 ξαναγράφτηκε: κάδος
**χωρίς** ανάγλυφο · Ι12 copy semantics · Ι13 «ΣΧΕΔΙΟ ΠΡΩΤΑ», η πηγή δεν κατεβαίνει · Ι14 ρητή αφαίρεση δεν επιστρέφει · Ι15 Π9
της πηγής · Ι16 πηγή που δεν διαβάζεται ⇒ 503) · `owner-property-plot-outline-route.test` (Π1–Π8 του PATCH) ·
`plot-outline-confirmation.test` · `listing-terrain-source.test` · `listing-media-reconciliation.test` (Ι1–Ι5 ιδιοκτήτη).
**Μένει**: Ζ4 (UI: Π9 και αφαίρεση πάνω στον `PATCH` · «να αφαιρεθεί και το περίγραμμα;» στον κάδο σχεδίου + προέλευση) · Ζ5 · Ζ6.
⇒ Το Ζ4 έγινε (παρακάτω)· η ερώτηση του κάδου **άλλαξε** μετά από έρευνα (βλ. «Ζ4 — κάδος»).

#### Ζ4 — UI ιδιοκτήτη *(κώδικας ✅ 2026-11-23 · tests ✅ 5/5 σουίτες · 89 tests, με έγκριση Giorgio · ζωντανός έλεγχος Σ3–Σ10 εκκρεμεί)*

**Ζωντανός έλεγχος Ζ1–Ζ3c πριν από τον κώδικα (2026-11-23, μόνο ανάγνωση):** ✅ η παραγωγή τρέχει `e11826ca` (περιέχει
`8c4b3d91`, run 45257245503) · ✅ οι κανόνες του Ζ3/Ζ3b **αναπτύχθηκαν** (run 45243945670: πλάνο `OutOfSync` → ανάπτυξη με
έγκριση → `Synced · Healthy`· πηγή `6c909957`: `plotOutline` στο `measuredKeys()`, `personalTrashUnchanged()`) · ⏸ τα δεδομένα
**δεν** ελέγχονται: στην παραγωγή **0** πηγές `terrain/measured` (`files_personal` και `files`), **0** σχέδια `terrain/plot-drawing`,
**0** αρχεία στον κάδο του `files_personal`. Απόφαση Giorgio: ο ζωντανός έλεγχος Σ3–Σ10 γίνεται **μέσα από αυτό το UI**, σε
δοκιμαστική αγγελία, με έγκριση εγγραφής στην παραγωγή.

**Αρχές:** ο browser ονομάζει υποψήφιο, ο server δίνει δακτύλιο (Ζ3) · τα υποψήφια υπολογίζονται **στη συσκευή** με τον
**ίδιο** πυρήνα με την πόρτα (το αρχείο φεύγει μόνο στο «Επιβεβαίωση») · ποια απόφαση ισχύει το κρίνει **μόνο** ο server.

| Κομμάτι | Αρχείο | Τι |
|---|---|---|
| Κατάσταση (server) | `route.ts` `GET` (`withStandardRateLimit`, ίδιος φρουρός `enterOwnerDoor`) · `dossier-terrain.reader.ts` `loadDossierPlotOutlineStatus` | `{ hasRelief, outline: { showInListing, areaM2, authority } \| null, drawing }` — ο **ίδιος** κανόνας «νικά η νεότερη» (ένα ερώτημα, η πηγή κατεβαίνει μόνο αν νικά) · το σχέδιο αναφέρεται **και στον κάδο** (`place: 'trash'`) · `isOutlineSource` = ο δακτύλιός του ταυτίζεται με το ισχύον στο **κανονικό χιλιοστό** (`samePlotOutlineRing`, δίπλα στον ΕΝΑ γραφέα) ⇒ ειλικρινής προέλευση ή «από σχέδιο που δεν είναι πια στον φάκελο» |
| Συμβόλαιο κατάστασης | `lib/terrain/plot-outline/plot-outline-status.ts` | τύποι **παραγόμενοι από zod** (`parsePlotOutlineStatus`) — ο browser δεν κάνει cast· τα «γεγονότα σχεδίου» από το **ίδιο** σχήμα με την εγγραφή (`confirmedDrawingFactsShape`, `plotOutlineOriginSchema` εξήχθησαν από το `plot-outline-confirmation.ts`) |
| Ένας κοινός πυρήνας ανάγνωσης | `lib/terrain/plot-outline/plot-drawing-read.ts` | `plotDrawingKindOf` (είδος από τα bytes + ταβάνι ανά είδος · DWG ⇒ ονομασμένη άρνηση) · `dxfDrawingScaleToMm` / `dxfDeclaresUnit` (μονάδα αρχείου ή ανθρώπου, ποτέ μαντεψιά) · `rankedDxfDrawing` / `rankedPdfReading` (`relief: null`: το Π6 το κρίνει η πόρτα) · `PLOT_DRAWING_ACCEPT`. **Ο server τον καλεί πλέον κι αυτός** (`plot-drawing-upload.server.ts`) ⇒ συσκευή και πόρτα δεν μπορούν να διαβάσουν διαφορετικά |
| Σελίδες PDF | `plot-outline-config.ts` `PLOT_DRAWING_MAX_PDF_PAGES` (= 10, ο server το περνά ρητά) · `components/file-manager/pdf-device-pages.ts` | **μία** συνταγή σελίδων στη συσκευή, εξήχθη από το `objective-value/read-pdf-on-device` (ADR-949), που την καλεί πλέον· αντίγραφο του buffer (το pdf.js το μεταφέρει στον worker) |
| Client | `services/listings/plot-outline.client.ts` | `fetchPlotOutlineStatus` · `confirmPlotOutline` (multipart `PLOT_OUTLINE_CONFIRM_FIELDS`, **ένα `Idempotency-Key` ανά πρόθεση**: ίδιο αρχείο + ίδια επιλογή ⇒ ίδιο κλειδί) · `amendPlotOutline` · ίδιος κατάλογος αρνήσεων (`namedRefusalOf`) |
| Hooks | `hooks/listings/usePlotDrawingImport.ts` · `usePlotOutlineStatus.ts` | μετρητής «τελευταίο αρχείο» · προεπιλογή **μόνο** η πρόταση της κατάταξης · Π9 ατσεκάριστο · αλλαγή αρχείου/μονάδας/επιλογής/Π9 σβήνει την έκβαση · μετά από κάθε πράξη η κατάσταση **ξαναδιαβάζεται** · μία πράξη τη φορά · επαναφορά σχεδίου με τον ΕΝΑ δρόμο (`restoreFileFromTrashWithPolicy`) |
| UI | `components/terrain/plot-outline/` (`PlotOutlineTab` · `PlotOutlineStatusCard` · `PlotDrawingImport` · `PlotCandidateList` · `PlotDxfDrawingView` · `PlotPdfDrawingView` · `read-plot-drawing-on-device`) · `TerrainSurveyImportPanel` | καρτέλες «Ισοϋψείς και σημεία \| Τοπογραφικό σχέδιο» στην **ίδια** ενότητα (μόνο πόρτα ιδιοκτήτη· `forceMount` ⇒ η αλλαγή καρτέλας δεν σβήνει δουλειά) · **DXF**: όλο το σχέδιο αχνό, υποψήφια διακεκομμένα, επιλεγμένο κόκκινο σημειο-παύλα, κλικ στη γραμμή (στόχος 24 px), ζουμ στο `ListingZoomStage` · **PDF**: η σελίδα στον ΕΝΑ θεατή (`blob:` URL, το αρχείο δεν φεύγει) με τονισμένη τη **ζώνη** του πίνακα (`pdfTableBandOf`) + δίπλα το περίγραμμα από τις συντεταγμένες με τα γράμματα κορυφών — **καμία** επικάλυψη στη σελίδα (Π5, χωρίς γεωαναφορά) · λίστα υποψηφίων (`fieldset`/radio) με τα **ονομασμένα** τεκμήρια σε λέξεις και τον λόγο «καμία πρόταση» · DXF χωρίς μονάδα ⇒ `SurveyUnitSelect` (ο ίδιος) · κάρτα: εμβαδόν · «περιμένει το πρώτο ανάγλυφο» · προέλευση (αρχείο · στρώση/οντότητα ή σελίδα · μονάδα · 12 ψηφία sha256) · Π9 · αφαίρεση με `ConfirmDialog` |
| Χρώμα | `globals.css` `--terrain-plot-outline` (#b91c1c, 6,5:1 σε χαρτί, ίδιο στα δύο θέματα) · `terrain-map-palette.ts` `TERRAIN_PLOT_OUTLINE_CLASS` / `_STROKE_PX` | κόκκινο **και** σημειο-παύλα (ο τύπος γραμμής ορίου ιδιοκτησίας του CAD) — ποτέ μόνο χρώμα (CHECK 3.41)· η ΙΔΙΑ γραφή θα χρησιμοποιηθεί στον χάρτη και στο 3Δ (Ζ5) |
| i18n | `terrain-survey.json` (`tabs.*` · `plotOutline.*`) · `files.json` (`fileMutationPreview.plotDrawing.*`) · `types/i18n.ts` (γεννήτορας) | ICU πληθυντικοί· το `read.refusals.pdf` της καρτέλας σημείων παραπέμπει πλέον στην καρτέλα «Τοπογραφικό σχέδιο» |

**Ζ4 — κάδος του σχεδίου: ΑΛΛΑΞΕ η απόφαση (εντολή Giorgio «όπως οι μεγάλοι», έρευνα 2026-11-23).** Το αρχικό «να αφαιρεθεί
και το περίγραμμα;» στον διάλογο του κάδου **δεν** το κάνει κανείς: Revit — η τοπογραφία από DWG μένει όταν φύγει το DWG
(διαγράφεται χωριστά)· Civil 3D — «Copy Deleted Dependent Objects», η αφαίρεση από τον ορισμό είναι ρητή πράξη («Remove From
Definition»)· Figma — η διαγραφή του main component αφήνει τα instances, με «Restore component» από το instance. Ακολουθούμε
(και συμφωνεί με το copy semantics του Ζ3c) ⇒ **κανένα κουτάκι**. Εκεί που αποτυγχάνουν (Civil 3D: η εξάρτηση κρυμμένη ·
Figma: τα ορφανά δεν βρίσκονται) κάνουμε καλύτερα: ο διάλογος του κάδου στον φάκελο (`services/property-dossier/plot-drawing-trash-preview.ts`,
στο `entity-files-manager-surface` `handleDelete`, ίδιο σχήμα με το `buildPropertyFileDeletePreview`) **λέει** ότι το περίγραμμα
μένει, από πού ήρθε (στρώση ή σελίδα, εμβαδόν) και **πού** αφαιρείται· και η καρτέλα δείχνει μετά το σχέδιο **στον κάδο** με
«Επαναφορά σχεδίου». Πηγές: help.autodesk.com (Revit «Create a Toposurface», Civil 3D «About Issues When Deleting AutoCAD Objects
From a Surface») · help.figma.com/hc/en-us/articles/360038663154.

**Ανοιχτά (προτάσεις, όχι εντολές):** (α) ο διάλογος του κάδου δεν έχει **σύνδεσμο** προς την καρτέλα της αγγελίας: ο φάκελος
στον browser δεν ξέρει ποια αγγελία του ανήκει (ο server το ξέρει — `refreshDossierListings`)· (β) η **μαζική** διαγραφή
(`handleBatchDelete`) δεν δείχνει τον διάλογο του σχεδίου.

**Tests (✅ έτρεξαν 2026-11-23 με έγκριση: 5/5 σουίτες, 89 πράσινα· γειτονικές 48/49 σουίτες, 561 πράσινα):**
`lib/terrain/plot-outline/__tests__/plot-drawing-read.test.ts` (Κ είδος από bytes · Μ μονάδα · Τ κατάταξη συσκευής · Δ ίδιος
δακτύλιος στο χιλιοστό · Σ συμβόλαιο κατάστασης · Π προβολή) · `hooks/listings/__tests__/usePlotDrawingImport.test.tsx` (πρόταση ·
ισοβαθμία ⇒ καμία προεπιλογή · μονάδα DXF ως την πόρτα · DWG/PDF αρνήσεις · ίδιο κλειδί ανά πρόθεση · αγώνας δρόμου · διάλογος
κάδου) · `owner-property-plot-outline-route.test.ts` **+ Κ1–Κ7 του `GET`** (άδειος φάκελος · μόνο σχέδιο · νικά η πηγή · σχέδιο
στον κάδο · άλλο περίγραμμα ⇒ `isOutlineSource:false` · ρητή αφαίρεση · ξένη αγγελία 404). Αλλαγμένα: τα δύο tests της πόρτας
(mock `withStandardRateLimit`) · `TerrainSurveyImportPanel.test` (stub της νέας καρτέλας + νέο prop).
⚠️ **Δεν** καλύπτονται με test: τα components της καρτέλας (`PlotOutlineStatusCard`, προβολές DXF/PDF, λίστα) και το
`usePlotOutlineStatus` — τα κρίνει ο ζωντανός έλεγχος. 🔴 Προϋπάρχον κόκκινο, **όχι** του Ζ4: `files-without-workspace-provider.test`
(2 tests) διαβάζει το `EntityFilesManager.tsx`, του οποίου το σώμα μετακόμισε στο `entity-files-manager-surface.tsx` σε άλλο commit.

**Ζ4 — ζωντανός έλεγχος (2026-11-24, παραγωγή `3bd0fd39`) και διόρθωση: η προβολή του σχεδίου έβγαινε ΚΕΝΗ.** ✅ Σ3 · Σ5 · Σ6 (Π9) ·
Σ7 · Σ8 · Σ9 · θεατής PDF με ζώνη πίνακα · DXF χωρίς μονάδα ρωτά · DWG ονομασμένη άρνηση. 🔴 Το πλαίσιο του DXF
(`PlotDxfDrawingView`) και το περίγραμμα δίπλα στο PDF (`TableRingDiagram`) ήταν άδεια — με συνθετικά αρχεία **και** με πραγματικό
DXF. **Αιτία (μετρημένη ζωντανά):** το SVG έγραφε απόλυτα WORLD mm ΕΓΣΑ'87 (`viewBox="409987600 -4498044900 64800 64800"`)· το
`getBoundingClientRect` των paths ήταν σωστό (διπλή ακρίβεια), αλλά ο ζωγράφος του Chrome είναι float32 — στο 4,5·10⁹ το βήμα του
είναι εκατοντάδες mm — και δεν έβγαζε τίποτα. Κλώνος του ίδιου SVG με `viewBox="0 0 w h"` ζωγραφιζόταν σωστά.
**Διόρθωση (στην πηγή, `plot-drawing-view.ts`):** το `PlanViewBox` κρατά πλέον την **τοπική αρχή** του (`origin`, η πάνω-αριστερή
γωνία σε WORLD mm) αντί για `minX`/`minY`· το `viewBoxAttribute` γράφει πάντα `0 0 w h`· **κάθε** συντεταγμένη περνά από το ένα
`planSvgPoint(point, box)` (αφαίρεση με το SSoT `worldToLocal` του `topo-local-origin`, ADR-650 — σε διπλή ακρίβεια, πριν φτάσει
στο SVG) και το `planPathData` χτίζεται πάνω του. Το `box` είναι **υποχρεωτικό όρισμα** ⇒ δεν υπάρχει δρόμος να γραφτεί απόλυτη
συντεταγμένη: γραμμές σχεδίου, υποψήφια, ο στόχος κλικ (διαφανές stroke 24px — ίδιο `d`) και οι ετικέτες κορυφών μετατοπίζονται
μαζί. **Γιατί δεν το έπιασαν τα tests:** η ενότητα «Π» δοκίμαζε 0…30 m. Νέα άγκυρα στο `plot-drawing-read.test.ts` («μέγεθος
ΕΓΣΑ»): δακτύλιος γύρω από E 410000 / N 4498000 ⇒ `viewBox` από το 0 και κάθε αριθμός του `d` μέσα στο `[0, πλάτος]`.
⚠️ Tests **γραμμένα, δεν έχουν τρέξει** (N.(-2))· ο ζωντανός επανέλεγχος θέλει push. Μένουν ανέλεγκτα: διάλογος κάδου στον φάκελο ·
δημόσια σελίδα της αγγελίας.
⇒ **Επανέλεγχος (2026-11-24, παραγωγή `5ca7fa02`, με έγκριση Giorgio):** `plot-drawing-read.test.ts` ✅ 20/20 · συνθετικό DXF ✅
(`viewBox="0 0 64800 64800"`) · PDF ✅ (περίγραμμα με A–D) · πραγματικό DXF Ευόσμου ✅ (236 γραμμές, 65 υποψήφια) · κλικ πάνω
στη γραμμή ✅ · δημόσια σελίδα ✅ (καρτέλα «Ανάγλυφο»). 🔴 **Νέο εύρημα**: υποψήφιο ΜΕΣΑ στο επιλεγμένο δεν διαλέγεται με κλικ.

**Ζ4 — επιλογή πάνω στο σχέδιο: την κρίνει η γεωμετρία, όχι η σειρά ζωγραφικής (2026-11-24, εντολή Giorgio «όπως οι μεγάλοι»).**
**Αιτία του ευρήματος (μετρημένη ζωντανά με `elementFromPoint`):** το κλικ το έκρινε το DOM — κέρδιζε ό,τι ζωγραφίστηκε
τελευταίο. Το γέμισμα του επιλεγμένου σκέπαζε κάθε υποψήφιο μέσα του· και στο πραγματικό DXF δύο **ταυτόσημοι** δακτύλιοι σε δύο
στρώσεις («Orio» · «ktimatologio») άφηναν τον έναν απρόσιτο από το σχέδιο. Ένα `pointer-events-none` θα έλυνε μόνο το πρώτο.
**Πρακτική των μεγάλων** *(από γνώση, όχι από νέα έρευνα web)*: AutoCAD/Revit πιάνουν τη γραμμή από την **ακμή** με pick box
σταθερό σε pixels, και λύνουν την επικάλυψη με **κύκλο επιλογής** (selection cycling · Tab) και **προ-τονισμό** πριν από το κλικ·
Figma/GIS δίνουν από το εσωτερικό το **πιο μέσα** σχήμα και πηγαίνουν βαθύτερα με επανάληψη.
**Απόφαση — ένας κριτής, καθαρός** (`lib/terrain/plot-outline/plot-candidate-pick.ts`, πάνω στα SSoT `distanceToRing` ·
`pointInPolygon`): (1) βαθμίδα `edge` — ακμή μέσα στην ανοχή, πλησιέστερη πρώτη, ισοπαλία ⇒ μικρότερο εμβαδόν ⇒ ταυτότητα·
(2) βαθμίδα `inside` — το μικρότερο σχήμα που περιέχει τον δείκτη· ακμή νικά πάντα εσωτερικό. (3) **Κύκλος**: ξανά κλικ στο ίδιο
σημείο ⇒ το επόμενο της **ίδιας** βαθμίδας (μία μόνο ακμή ⇒ μένει — δεν πηδά στο σχήμα που απλώς την περιέχει).
(4) **Προ-τονισμός** (`candidateHover`: η παύλα του υποψηφίου στο κόκκινο και το πάχος του περιγράμματος — όχι μόνο χρώμα): δείχνει
ό,τι **θα** διαλέξει το κλικ, και μετά το κλικ το **επόμενο** του κύκλου. **Πάνω από τους μεγάλους**: ο κύκλος δεν θέλει
πλήκτρο που πρέπει να ξέρεις (Tab / Shift+Space) — είναι το ίδιο κλικ, και ο προ-τονισμός το λέει πριν γίνει.
**Καλωδίωση** (`usePlotCandidatePointer`): οθόνη → σχέδιο με το `getScreenCTM()` του SVG (μεγέθυνση + περιστροφή της σκηνής) και
το νέο `planWorldPoint` (αντίστροφο του `planSvgPoint`)· η ανοχή = ο μισός στόχος των 24 px (WCAG 2.5.8) **σε css px σε κάθε
ζουμ**. `onClick` (όχι `pointerdown`) ⇒ η σκηνή συνεχίζει να καταπίνει το κλικ μετά από σύρσιμο. Η αόρατη γραμμή-στόχος
(`hitArea`, κλάση) **αφαιρέθηκε**. Πληκτρολόγιο/βοηθητική τεχνολογία: κάθε σχήμα μένει κουμπί (Enter/Space· «κλικ» με
`detail === 0`). Αφή: χωρίς hover, το άγγιγμα διαλέγει.
Άγκυρες `plot-candidate-pick.test.ts` (Α ακμή μέσα στο επιλεγμένο · Ε εσωτερικό · Τ ταυτόσημοι · Κ κύκλος στη βαθμίδα · Μ μέγεθος
ΕΓΣΑ · Π αντίστροφο) — ✅ **12/12** (μαζί με `plot-drawing-read.test.ts` 20/20, με έγκριση Giorgio).

**Ζωντανός έλεγχος ✅ (2026-11-24, παραγωγή `42fafc8e`, Chrome, «ΟΙΚΟΠΕΔΟ ΑΝΤΙΠΑΡΟΧΗ ΔΟΚΙΜΗ»).** `dokimi-topografiko.dxf`: ακμή του
120 με επιλεγμένο το 1.200 ⇒ 120 (ήταν το 🔴) · εσωτερικό του 120 τρεις φορές ⇒ 120 → 1.200 → 120 · προ-τονισμός + `cursor-pointer`
πάνω σε υποψήφιο, τίποτα έξω · ζουμ 225 % **και** «Περιστροφή» 90° ⇒ το κλικ πέφτει σωστά (το `getScreenCTM` κρίθηκε) · σύρσιμο
που ξεκινά και τελειώνει πάνω σε ακμή ⇒ δεν διαλέγει. `evosmos-G753.dxf` (65 υποψήφια): η ακμή του 1.364 **δεν** είναι καθαρή
εναλλαγή «Orio» ⇄ «ktimatologio» — ο κύκλος περνά και από τα γειτονικά που έχουν ακμή μέσα στην ανοχή (δεξιά: newidiok 4.092 ·
Periferia 4.089 · PPL 157). Και τα δύο 1.364 μένουν προσβάσιμα από κάθε σημείο· **ανοιχτό** αν ο κύκλος θέλει στένεμα.
Μικρό: `cursor-pointer` πάνω στην ακμή του ήδη επιλεγμένου όταν είναι το μόνο εκεί (το κλικ δεν αλλάζει τίποτα).

#### Ζ5 — το περίγραμμα πάνω στο ανάγλυφο, σε κάτοψη και 3Δ *(κώδικας ✅ 2026-11-24 · tests ✅ 53/53 · ζωντανός έλεγχος ✅ `19fd6cb`)*

**Αφορμή (Giorgio, 2026-11-24):** «γιατί πάνω στις ισοϋψείς και στο 3Δ δεν εμφανίζεται η θέση του οικοπέδου;» — το 1.200 τ.μ.
επιβεβαιώθηκε ζωντανά, μπήκε στο στιγμιότυπο (`plotOutline`), και **κανένα** αρχείο του viewer δεν το διάβαζε.

| Τι | Πού | Πώς |
|---|---|---|
| Κάτοψη — μοντέλο | `terrain-map-model.ts` `plotOutline` (`pathData` · `coverage` · `coveredFraction`) | Ο δακτύλιος του στιγμιοτύπου ως **ένα** κλειστό path. Μπαίνει στα σημεία του φύλλου: περίγραμμα που βγαίνει έξω από το ανάγλυφο φαίνεται **ολόκληρο**. Έκταση, ισοϋψείς, ζώνες **αμετάβλητα** (Π1) |
| Κάτοψη — σύμβολο | `terrain-map-symbols.tsx` `TerrainLine kind="plotOutline"` · `TERRAIN_PLOT_OUTLINE_STROKE_PX.outlineCasing` | Η **ίδια** γραφή με την προβολή του σχεδίου (κόκκινο σημειο-παύλα, Ζ4) πάνω σε λευκό περίβλημα, όπως οι ισοϋψείς. Στρώμα: μετά τις κύριες ισοϋψείς, κάτω από τις ετικέτες |
| Υπόμνημα | `TerrainContourMap.tsx` · `listing-detail:terrain.map.legend.plotOutline` / `plotOutlinePartial` | Δείγμα από το **ίδιο** `TerrainLine`. Μερική κάλυψη (Π6) ⇒ «το ανάγλυφο καλύπτει το {share} του» |
| 3Δ — γεωμετρία | `terrain-3d-geometry.ts` `plotOutline: Float32Array` | `drapePlotOutline` (Ζ1) πάνω στο `terrainInspectIndexOf(snapshot)` (ήδη memo ανά στιγμιότυπο) → `terrain3dPolylinePairs`. Ό,τι πέφτει έξω από το ανάγλυφο **δεν** σχεδιάζεται (Π7) |
| 3Δ — σκηνή | `terrain-3d-scene.ts` `objects.plotOutline` · `terrain-3d-palette.ts` | Ίδιο `LineSegments2` με τις ισοϋψείς, #b91c1c, 2,5 px, **διακεκομμένο** (το `LineMaterial` δεν έχει σημειο-παύλα· παύλα = 1/40 και κενό = 1/100 της μεγαλύτερης πλευράς). Κρυφό όταν δεν υπάρχει· `replace` / `dispose` / `setLineResolution` το καλύπτουν |

**Ποιος το βλέπει (Π9, όπως ήδη ίσχυε):** ο viewer ζωγραφίζει ό,τι κουβαλά το στιγμιότυπο· το δημόσιο στιγμιότυπο έχει περίγραμμα
**μόνο** με τσεκαρισμένο το «να φαίνεται στη δημόσια αγγελία» (`toListingTerrainInput(source, 'public')`).

**Ζ5β — ο χάρτης του ιδιοκτήτη στη σελίδα «Βελτίωσε»** *(κώδικας ✅ 2026-11-24 · tests πόρτας ✅ 37/37 · ζωντανός έλεγχος ✅ `19fd6cb`, με Π9 ατσεκάριστο)*

Το Π9 λέει «στην προεπισκόπηση του ιδιοκτήτη φαίνεται πάντα», αλλά τέτοια όψη **δεν υπήρχε**: η σελίδα «Βελτίωσε» έδειχνε για
το δημοσιευμένο ανάγλυφο μόνο στατιστικά, και η κατάσταση του `GET …/terrain` δεν μεταφέρει δακτύλιο ⇒ με ατσεκάριστη ορατότητα
ο ιδιοκτήτης δεν έβλεπε το περίγραμμα **πουθενά** πάνω στο ανάγλυφο.

**Απόφαση (Giorgio, 2026-11-24): ΜΟΝΟ στη «Βελτίωσε», ΟΧΙ και στη σελίδα της αγγελίας.** (α) ο χάρτης ανήκει δίπλα στο κουτάκι
που εγκρίνει τη δημόσια ορατότητα· (β) η σελίδα της αγγελίας μένει ο καθρέφτης του κοινού — αν έδειχνε στον ιδιοκτήτη το
ιδιωτικό περίγραμμα, θα νόμιζε ότι το βλέπουν όλοι· (γ) ιδιωτικό δεδομένο μέσα στη δημόσια σελίδα = δεύτερη διαδρομή που ένα
λάθος cache/ελέγχου τη δείχνει σε ξένο· (δ) μία πόρτα αντί για δύο.

| Τι | Πού | Πώς |
|---|---|---|
| Πόρτα | `GET …/owner-properties/[id]/terrain?view=relief` (`OWNER_TERRAIN_VIEW_PARAM` · `OWNER_TERRAIN_RELIEF_VIEW` στο `plot-outline-status.ts`) | Η **ίδια** πόρτα και ο **ίδιος** φρουρός κηδεμονίας/φακέλου με την κατάσταση (καμία νέα διαδρομή ⇒ καμία νέα γραμμή σε μητρώο πυλών). Απάντηση `{ snapshot }` · `null` = δεν δημοσιεύτηκε ποτέ ανάγλυφο |
| Αναγνώστης | `dossier-terrain.reader.ts` `loadDossierOwnerReliefSnapshot` | `loadDossierTerrainState` (τρέχουσα πηγή + το περίγραμμα που **ισχύει**, Ζ3c — και όταν το κρατά ακόμη μόνο το σχέδιο) → `withPlotOutline` → ο **ΕΝΑΣ** κριτής `judgeListingTerrainSource` (κοινό `'owner'`). Χτίζεται ανά αίτημα· **δεν** γράφει ράφι ούτε αγγελία (CHECK 3.105: ο κριτής ζει στο `src/lib/terrain/`). Άρνηση του κριτή ⇒ 503 `TERRAIN_CURRENT_SOURCE_UNREADABLE` |
| Client | `plot-outline.client.ts` `fetchOwnerRelief` | Κρίνει την απάντηση με τον **ίδιο** `readListingTerrainSnapshot` της δημόσιας αγγελίας· ό,τι δεν σχεδιάζεται ⇒ `rejected` |
| Hook | `hooks/listings/useOwnerRelief.ts` | Ζητείται μόνο όταν υπάρχουν **και** ανάγλυφο **και** περίγραμμα (`ownerReliefApplies`)· ξαναζητείται σε κάθε νέα ανάγνωση της κατάστασης· η προηγούμενη σκηνή μένει όσο έρχεται η νεότερη· μετρητής κατά της μπαγιάτικης απάντησης |
| UI | `components/terrain/plot-outline/PlotOutlineOnRelief.tsx` (στην `PlotOutlineTab`, κάτω από την κάρτα κατάστασης) | Η **ίδια** σκηνή «Κάτοψη \| 3Δ» της δημόσιας αγγελίας (`LazyTerrainSnapshotStage`). Λέει ρητά **ποιος** το βλέπει: Π9 ατσεκάριστο ⇒ «Μόνο εσύ το βλέπεις έτσι…» · τσεκαρισμένο ⇒ «Έτσι φαίνεται και στη δημόσια αγγελία». Αποτυχία ⇒ ονομασμένη άρνηση + «Δοκιμή ξανά». Κείμενα `terrain-survey:plotOutline.onRelief.*` |

**Tests Ζ5 ✅ 53/53** (2026-11-24, με έγκριση Giorgio): `terrain-map-model.test.ts` (+4: κανένα · path βορράς-πάνω · ανάγλυφο
αμετάβλητο · φύλλο που μεγαλώνει) · `terrain-3d-geometry.test.ts` (+4: κανένα · Y πάνω στο έδαφος × υπερβολή · κλείνει · τίποτα
έξω από το ανάγλυφο) · `terrain-3d-scene.test.ts` (+3: κρυφό · ορατό και διακεκομμένο · `replace`).

**Tests Ζ5β ✅ 37/37** (2026-11-24, με έγκριση Giorgio): `owner-property-plot-outline-route.test.ts` (+5: Ρ1 χωρίς
ανάγλυφο ⇒ `null` · Ρ2 Π9 ατσεκάριστο ⇒ περίγραμμα παρ’ όλα αυτά, καμία εγγραφή · Ρ3 σχέδιο νεότερο από την πηγή ⇒ το
περίγραμμα του σχεδίου · Ρ4 ανάγλυφο χωρίς περίγραμμα · Ρ5 ξένη αγγελία ⇒ 404). Hook και component **χωρίς** tests: κρίνονται μόνο ζωντανά.

**Ζωντανός έλεγχος Ζ5 + Ζ5β ✅ (2026-11-24, παραγωγή `19fd6cb` ⊇ `f082dea6`, Chrome, «ΟΙΚΟΠΕΔΟ ΑΝΤΙΠΑΡΟΧΗ ΔΟΚΙΜΗ», μόνο ανάγνωση —
καμία εγγραφή, το κουτάκι Π9 έμεινε ατσεκάριστο).** Περίγραμμα 1.200 τ.μ. (`dokimi-topografiko.dxf`).
- ✅ «Βελτίωσε» → «Τοπογραφικό σχέδιο»: κάτω από την κάρτα κατάστασης η ενότητα «Το περίγραμμα πάνω στο ανάγλυφο», με το
  «Μόνο εσύ το βλέπεις έτσι. Στη δημόσια αγγελία το ανάγλυφο φαίνεται χωρίς το περίγραμμα, μέχρι να το επιλέξεις παραπάνω.»
- ✅ Κάτοψη: κόκκινη σημειο-παύλα με λευκό περίβλημα, πάνω από τις ισοϋψείς, μέσα στην έκταση αποτύπωσης. Υπόμνημα: «Περίγραμμα
  οικοπέδου, από το τοπογραφικό σχέδιο» (πλήρης κάλυψη ⇒ χωρίς ποσοστό· η μερική κάλυψη **δεν** ελέγχθηκε ζωντανά).
- ✅ 3Δ: δακτύλιος ντυμένος στο έδαφος, κόκκινος διακεκομμένος· μένει στη θέση του σε περιστροφή και σε υπερβολή 3×.
- ✅ «Υψόμετρα | Κλίσεις» και «Κάτοψη | 3Δ | Κάτοψη»: το περίγραμμα δεν χάνεται.
- ✅ Δημόσια αγγελία, καρτέλα «Ανάγλυφο», κάτοψη **και** 3Δ: κανένα περίγραμμα, καμία γραμμή του στο υπόμνημα (Π9). Ελέγχθηκε με
  συνδεδεμένο τον ιδιοκτήτη· ανώνυμος επισκέπτης **δεν** δοκιμάστηκε.
- ✅ `GET …/terrain` 200 · `GET …/terrain?view=relief` 200 · κονσόλα χωρίς σφάλμα της εφαρμογής.
- ⚠️ Παρατήρηση: στον χρωματισμό «Κλίσεις» το κόκκινο του περιγράμματος πάνω στο πορτοκαλί των κλίσεων ξεχωρίζει κυρίως χάρη
  στο λευκό περίβλημα — διαβάζεται, αλλά αχνότερα από ό,τι στα «Υψόμετρα». **Διόρθωση (εντολή Giorgio, 2026-11-24):**
  `TERRAIN_PLOT_OUTLINE_STROKE_PX.outlineCasing` 4,5 → **6,5** px (2 px λευκό από κάθε πλευρά). Το κόκκινο `#b91c1c` έχει
  σχεδόν ίδια απόχρωση και φωτεινότητα με την κλάση 15–25 % (`#ba4203`), άρα εκεί δουλεύει **μόνο** το περίβλημα. Το χρώμα
  **δεν** άλλαξε (ίδια γραφή με Ζ4 και 3Δ). **Ζωντανός έλεγχος της διόρθωσης ✅ (2026-11-24, παραγωγή `4a9cce9`):** στις
  «Κλίσεις» το περίγραμμα ξεχωρίζει καθαρά από το πορτοκαλί, με ορατό λευκό περίβλημα και στις δύο πλευρές.
- ✅ **Τσεκαρισμένο Π9 (εντολή Giorgio, 2026-11-24, ίδια παραγωγή):** `PATCH …/terrain` 200, «Έγινε.» · το κείμενο γίνεται «Έτσι
  φαίνεται και στη δημόσια αγγελία» · η δημόσια αγγελία δείχνει το περίγραμμα στην κάτοψη, με γραμμή στο υπόμνημα (το δημόσιο
  3Δ με τσεκαρισμένο **δεν** ανοίχτηκε). Ξετσεκαρίστηκε αμέσως: κείμενο και δημόσια αγγελία γύρισαν χωρίς περίγραμμα.

### 14.12 Β6.12 — το ανάγλυφο πάνω σε χάρτη, στην πραγματική του θέση *(✅ ΕΓΚΡΙΘΗΚΕ 2026-11-24 — «ναι σε όλα» · φάση Α κώδικας ✅ · ζωντανά ✅ (8β) · φάση Β: σχέδιο εγκεκριμένο, κανένας κώδικας · φάσεις Γ–Δ: κανένας κώδικας)*

> **Αίτημα Giorgio (2026-11-24):** νέα καρτέλα όπου το ανάγλυφο φαίνεται **πάνω σε χάρτη** (OpenStreetMap ή Google Maps), σε
> κάτοψη **και** 3Δ, στην ακριβή του θέση — «όπως οι μεγάλοι», με **την καλύτερη δωρεάν λύση**.

#### Πώς το κάνουν οι μεγάλοι

| Ποιος | Τι κάνει | Τι κρατάμε |
|---|---|---|
| Revit · ArchiCAD · Civil 3D | Γεωαναφορά μοντέλου (survey point + σύστημα συντεταγμένων)· το Civil 3D ντύνει αεροφωτογραφία πάνω στην επιφάνεια. Μόνο desktop του μελετητή | Η θέση προκύπτει από τις **συντεταγμένες της αποτύπωσης**, ποτέ από γεωκωδικοποίηση διεύθυνσης |
| Esri ArcGIS Scene · Cesium · Google Earth | Ένας χάρτης με παγκόσμιο (χοντρό) ανάγλυφο και, πάνω του, η ακριβής μετρημένη επιφάνεια ως **ξεχωριστό** στρώμα | Δύο ανάγλυφα με **δηλωμένη** ακρίβεια το καθένα — το μετρημένο δεν «λιώνει» μέσα στο χοντρό |
| Zillow · Idealista | Χάρτης, δορυφορική εικόνα, περίγραμμα γεωτεμαχίου — **μόνο κάτοψη**, κανένα μετρημένο ανάγλυφο | Τίποτα να αντιγράψουμε· εδώ τους ξεπερνάμε |

#### Έρευνα παρόχων (2026-11-24) — τι είναι πράγματι δωρεάν για εμπορική χρήση

| Ανάγκη | Υποψήφιος | Όροι, όπως βρέθηκαν | Ετυμηγορία |
|---|---|---|---|
| Οδικό υπόβαθρο | Το **δικό μας** αρχείο OSM (`nestor`, ήδη στο μητρώο ADR-891) | ODbL· μόνος όρος η απόδοση· κανένα όριο, κανένας τρίτος | ✅ **υπάρχει ήδη** |
| Ανάγλυφο του γύρω χώρου | **Mapterhorn** (πλακίδια υψομέτρου Terrarium 512 px, διανέμονται ως **PMTiles**) | Κώδικας BSD-3· δεδομένα από ανοιχτές πηγές (βάση: Copernicus GLO-30), απόδοση «© Mapterhorn» + λίστα πηγών. Για τον **φιλοξενούμενο** διακομιστή τους δεν βρέθηκαν όροι/όρια | ✅ **με δικό μας αντίγραφο** (απόσπασμα Ελλάδας, όπως το αρχείο OSM) — όχι εξάρτηση από τον διακομιστή τους |
| » | Copernicus DEM GLO-30 (η πηγή) | Δωρεάν παγκόσμια άδεια με υποχρεωτική σημείωση απόδοσης. ⚠️ Η υπηρεσία **θέασης** περιορίστηκε από 28/07/2026 — αφορά την υπηρεσία, όχι τα ληφθέντα δεδομένα | ✅ ως δεδομένα· ❌ ως ζωντανή υπηρεσία |
| Δορυφορική / αεροφωτογραφία | Ορθοφωτοχάρτες **Κτηματολογίου** (WMS) | Το Κτηματολόγιο γράφει ρητά ότι **απαγορεύεται κάθε εμπορική χρήση** της υπηρεσίας θέασης, μέχρι να ανακοινώσει πολιτική διάθεσης | ❌ |
| » | **Sentinel-2 cloudless** (EOX) | Έκδοση **2016**: CC BY 4.0 (εμπορική χρήση επιτρέπεται, με απόδοση). Εκδόσεις 2018+: CC BY-NC-SA (μη εμπορικές) ή εμπορική άδεια επί πληρωμή | ⚠️ μόνο η 2016· ανάλυση ~10 m/pixel ⇒ ένα οικόπεδο 1.000 τ.μ. είναι ~3×3 pixels: **άχρηστη** σε κλίμακα οικοπέδου |
| » | Esri World Imagery (ArcGIS Location Platform) | 2.000.000 πλακίδια/μήνα δωρεάν, μετά $0,15/1.000. Η εμπορική χρήση στο δωρεάν επίπεδο αναφέρεται μόνο από δευτερογενείς πηγές· για το World Imagery ειδικά **δεν επιβεβαιώθηκε** | ⚠️ δωρεάν **εντός ορίου**, όχι «δωρεάν»· θέλει ανάγνωση των όρων της Esri πριν μπει στο μητρώο |
| Όλα μαζί | **Google Maps** | Χρέωση ανά αίτημα πάνω από το δωρεάν όριο (2D πλακίδια: 100.000/μήνα, μετά $0,60/1.000· φωτορεαλιστικά 3Δ: 1.000/μήνα). Η ρήτρα «όχι περιεχόμενο Google σε μη-Google χάρτη» επιβεβαιώθηκε για επιμέρους υπηρεσίες· η γενική ρήτρα **δεν διαβάστηκε** | ❌ για «δωρεάν»· και θα απαιτούσε **δεύτερο** χάρτη δίπλα στη MapLibre |

Πηγές: [Κτηματολόγιο — θέαση ορθοφωτογραφιών](https://www.ktimatologio.gr/e-services/22) ·
[Mapterhorn](https://mapterhorn.com/) · [Mapterhorn — attribution](https://mapterhorn.com/attribution/) ·
[Άδεια Copernicus DEM 30](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf) ·
[EOX — άδεια Sentinel-2 cloudless](https://cloudless.eox.at/documentation/license) ·
[Esri — Basemaps API](https://www.esri.com/en-us/arcgis/products/arcgis-location-platform/services/basemaps-mapping) ·
[Google — τιμολόγηση](https://developers.google.com/maps/billing-and-pricing/pricing-categories) ·
[MapLibre — three.js πάνω σε ανάγλυφο](https://www.maplibre.org/maplibre-gl-js/docs/examples/add-3d-model-with-terrain/).

#### Πρόταση — η καλύτερη **δωρεάν** λύση

**Ένας χάρτης MapLibre (ήδη στο έργο), με δικά μας δεδομένα από άκρη σε άκρη: κανένα κλειδί, κανένα όριο, κανένας τρίτος.**

- **Μ1 — Μηχανή: MapLibre GL, όχι Google.** Έχουμε ήδη `maplibre-gl` 5.9, το σύνορο χάρτη (CHECK 3.75) και το μητρώο υποβάθρων
  (CHECK 3.95). Η Google χρεώνει και θέλει δικό της χάρτη.
- **Μ2 — Υπόβαθρο: το δικό μας αρχείο OSM** (`nestor`). Καμία νέα πηγή για το οδικό.
- **Μ3 — Ανάγλυφο του γύρω χώρου: Mapterhorn, ως δικό μας αντίγραφο PMTiles** (απόσπασμα Ελλάδας στον **ίδιο** κάδο με το αρχείο
  OSM). Νέα γραμμή παρόχου στο μητρώο με την απόδοση Copernicus. Δίνει **σκίαση αναγλύφου** στην κάτοψη και **έδαφος** στο 3Δ.
- **Μ4 — Το μετρημένο ανάγλυφο ως ξεχωριστό στρώμα πάνω από το χοντρό.** Κάτοψη: ισοϋψείς, ζώνες κλίσης και περίγραμμα ως
  GeoJSON από το **ίδιο** στιγμιότυπο. 3Δ: το **ίδιο** `buildTerrain3dGeometry` μέσα σε custom layer της MapLibre (three, ήδη
  στο έργο). Η ραφή με το χοντρό ανάγλυφο (30 m) **φαίνεται και δηλώνεται** («μετρημένο» ⇄ «ενδεικτικό γύρω»), δεν κρύβεται.
- **Μ5 — Θέση από την αποτύπωση**: ΕΓΣΑ'87 → WGS84 με το υπάρχον `src/lib/geo/greek-grid.ts`. Αποτύπωση χωρίς ΕΓΣΑ'87 (τοπικό
  σύστημα) ⇒ η καρτέλα **δεν εμφανίζεται**, με ονομασμένο λόγο· ποτέ τοποθέτηση «κατά προσέγγιση».
- **Μ6 — Αεροφωτογραφία: ΟΧΙ στην πρώτη φάση.** Δωρεάν **και** εμπορικά επιτρεπτή **και** χρήσιμη σε κλίμακα οικοπέδου δεν
  βρέθηκε. Το μητρώο δέχεται αργότερα πάροχο `aerial` (Esri, εντός ορίου) **αν** διαβαστούν οι όροι και το εγκρίνεις.
- **Μ7 — 🔴 Ιδιωτικότητα (ανατρέπει το Δ3).** Το δημόσιο στιγμιότυπο **δεν** κουβαλά σήμερα καμία συντεταγμένη, επίτηδες. Πρόταση,
  ίδιο σχήμα με το Π9: ο **ιδιοκτήτης** βλέπει την καρτέλα πάντα (στη «Βελτίωσε», από την ίδια πόρτα `?view=relief`)· το
  **κοινό** μόνο με ρητό κουτάκι «να φαίνεται η ακριβής θέση». Η θέση ταξιδεύει ως **ένα** πεδίο (κέντρο + στροφή πλέγματος) που
  μπαίνει στο δημόσιο στιγμιότυπο **μόνο** με τη συγκατάθεση — τίποτα να «κρυφτεί» μετά.

**Πέρα από τους μεγάλους:** (α) κάθε στρώμα γράφει την ακρίβειά του και την πηγή του — κανείς από τους παραπάνω δεν λέει στον
αγοραστή πού τελειώνει η μέτρηση και πού αρχίζει η εκτίμηση· (β) η δημόσια θέση είναι ρητή επιλογή του ιδιοκτήτη, όχι
προεπιλογή· (γ) μηδενική εξάρτηση από τρίτο διακομιστή ⇒ κανένα κόστος που μεγαλώνει με την επισκεψιμότητα.

#### Αποφάσεις Giorgio (2026-11-24: «ναι σε όλα»)

1. ✅ **Μ1–Μ5 εγκρίθηκαν**: MapLibre + δικά μας δεδομένα + Mapterhorn ως δικό μας αντίγραφο PMTiles.
2. ✅ **Μ6 εγκρίθηκε**: χωρίς αεροφωτογραφία στην πρώτη φάση.
3. ✅ **Μ7 εγκρίθηκε**: η ακριβής θέση δημόσια **μόνο** με ρητό κουτάκι του ιδιοκτήτη (αλλαγή του Δ3, ίδιο σχήμα με το Π9).
4. ✅ **Θέση στο UI**: τρίτη επιλογή «Στον χάρτη» δίπλα στο «Κάτοψη | 3Δ» — όχι ξεχωριστή καρτέλα μέσων.

Όρος Giorgio: «η καλύτερη **δωρεάν** λύση» — κανένα κλειδί, κανένα όριο αιτημάτων, κανένας πάροχος επί πληρωμή.

#### Έρευνα εφικτότητας (2026-11-24, μόνο ανάγνωση πηγών — τίποτα δεν εκτελέστηκε)

| Ερώτημα | Τι βρέθηκε | Πηγή |
|---|---|---|
| Διανομή Mapterhorn | Ένα `planet.pmtiles` **355,6 GB**, ζουμ 0–12, Terrarium 512 px WebP, με range requests. Πάνω από το 12 υπάρχουν αρχεία ανά πλακίδιο z6 (`6-X-Y.pmtiles`) μόνο όπου υπάρχει λεπτότερη πηγή | `download.mapterhorn.com/download_urls.json` |
| Απόσπασμα Ελλάδας | Τεκμηριωμένο από τους ίδιους: `pmtiles extract --bbox=… planet.pmtiles out.pmtiles` (με `--dry-run` για το μέγεθος). **Εκτίμηση** 0,4–1 GB — δική μας πρόχειρη αριθμητική, **όχι** μέτρηση | `mapterhorn.com/data-access` |
| Λεπτότερο από 30 m | **Όχι.** Στις 151 πηγές, την Ελλάδα την καλύπτει μόνο το Copernicus GLO-30· μέγιστο ζουμ **12** (~29 m/pixel στο πλάτος μας). Κανένα ελληνικό DEM | `download.mapterhorn.com/attribution.json` |
| Όροι | Εμπορική χρήση, cache και **δική μας φιλοξενία** επιτρέπονται· τα δεδομένα κρατούν την άδεια της πηγής τους. Απόδοση: σύνδεσμος στο `mapterhorn.com/attribution` + η εγγραφή `glo30` (DLR / Airbus, «provided under COPERNICUS by the European Union and ESA») | `mapterhorn.com/faq` |
| three πάνω σε `setTerrain` | Επίσημο παράδειγμα (v5.9.0, `adding-3d-models-using-threejs-on-terrain`): custom layer `renderingMode: '3d'`, μητρώο `args.defaultProjectionData.mainMatrix`, ύψος από `queryTerrainElevation`· το `'3d'` μοιράζεται το depth buffer με το έδαφος (`draw_custom.ts`) | αποθετήριο `maplibre-gl-js` |
| 🔴 Γνωστά προβλήματα | **#6701** — `queryTerrainElevation` ασυνεπές ανά ζουμ/κλίση (έως 300 m), αναφέρθηκε σε 5.8/5.11, διορθωμένο κατά τον αναφέροντα στη **5.15.0** ⇒ η **5.9 μας το έχει**. **#5222** ανοιχτό — custom 3Δ στρώμα χάνεται σε μεγάλη κλίση κάμερας. **#7660** ανοιχτό — σφαίρα + έδαφος: τα μοντέλα αιωρούνται (μένουμε σε mercator) | GitHub issues |
| `raster-dem` από PMTiles | Υποστηρίζεται στη 5.x με `encoding: 'terrarium'`· ασφαλέστερο ρητό `tileSize: 512` (το δικό μας πρωτόκολλο τρέχει με `metadata: false`) | παράδειγμα Protomaps |

**Συνέπειες για το σχέδιο:** (α) το 3Δ πάνω σε χάρτη θέλει **MapLibre ≥ 5.15** — αναβάθμιση που αγγίζει κάθε χάρτη της εφαρμογής·
(β) το γύρω ανάγλυφο είναι 30 m ⇒ η ραφή με το μετρημένο **θα φαίνεται** (Μ4 την δηλώνει)· (γ) το δημόσιο στιγμιότυπο **δεν**
κουβαλά σήμερα καμία θέση: το κέντρο (`SnapshotFrame.centreWorldMm`) κόβεται στο `frameOf` και «δεν σειριοποιείται ποτέ» ⇒ το Μ7
είναι **νέο πεδίο** στο στιγμιότυπο, όχι αποκάλυψη υπάρχοντος· (δ) το μητρώο υποβάθρων δεν έχει είδος πηγής υψομέτρου.

#### Τι ΔΕΝ ελέγχθηκε

- Το **ακριβές** μέγεθος του αποσπάσματος Ελλάδας (θέλει `pmtiles extract --dry-run`) και το κόστος φιλοξενίας στον κάδο μας.
- Το κείμενο της ίδιας της άδειας Copernicus GLO-30 (διαβάστηκε μόνο η απόδοση όπως τη γράφει το Mapterhorn).
- Η **ζωντανή** συμπεριφορά custom layer three πάνω σε `setTerrain` — καμία δοκιμή δεν έτρεξε· τα παραπάνω είναι από πηγές.
- Οι τρέχοντες όροι της Esri για το World Imagery και η γενική ρήτρα της Google — διαβάστηκαν μόνο δευτερογενείς πηγές.

#### Προαπαιτούμενο — αναβάθμιση MapLibre 5.15 → 6.19.0 *(2026-11-24 · κώδικας ✅ · jest χαρτών ✅ 70 σουίτες / 820 tests · ζωντανά ✅ 2026-11-24, παραγωγή `4a9cce9`)*

Απόφαση Giorgio: 6.x και όχι ≥ 5.15. Η 5.x παίρνει μόνο διορθώσεις ασφαλείας· μόνο η 6.x έχει στρώμα ντυμένο πάνω στο έδαφος
(6.13, πειραματικό), διορθώσεις κάμερας πάνω σε έδαφος (6.7 · 6.9.1 · 6.14) και έδαφος με χαμηλό `maxzoom` (6.15 · 6.16).
Δικό της commit, χωρίς κώδικα του Β6.12.

| Τι άλλαξε η 6.x | Τι κάναμε |
|---|---|
| Μεταβατική εξάρτηση `@mapbox/jsonlint-lines-primitives 2.0.3` ζητά **Node ≥ 22** (`engine-strict=true`) | Node 22 τοπικά (22.23.5) και στο CI — χωριστό commit `88499a00` (43 workflows + `firebase-identity`). Το `.nvmrc` και το `Dockerfile` έλεγαν ήδη 22 |
| ESM-only, ο worker χωριστό αρχείο — μέσα σε bundler θέλει `setWorkerUrl()` | `src/lib/maps/maplibre-worker-url.ts` (το μόνο `import.meta.url`) + **μία** κλήση στο σύνορο `maplibre.ts`, πριν από κάθε χάρτη |
| Αφαιρέθηκε το `map.transform` | `react-map-gl` 8.1.1 → **8.1.3** (διαβάζει την κάμερα από δημόσιους getters). Κανένα δικό μας σημείο |
| `styleimagemissing` μόνο ειδοποίηση | `useHatchImage` (`choropleth-sync.ts`) → `map.setMissingStyleImageResolver()`. ⚠️ **Μία θέση ανά χάρτη**: δεύτερος καταναλωτής στον ίδιο χάρτη θέλει συνθέτη |
| `exports` μόνο με συνθήκη `import` | `jest.config.js`: ρητό `moduleNameMapper` στο `dist/maplibre-gl.mjs` + εγγραφή στο `transformIgnorePatterns` |
| WebGL2 υποχρεωτικό (`GPUInitializationError` από τον constructor) | Κανένας κώδικας: το περιτύλιγμα πιάνει το σφάλμα κατασκευής και το δίνει στο `onError` — η σελίδα δεν πέφτει (διαβάστηκε στον κώδικα του 8.1.3, **δεν** δοκιμάστηκε σε συσκευή χωρίς WebGL2) |
| Απώλεια context | Ο χειριστής **ακόμη** γράφει `this.style = null` (η «προκείμενη» του `map-boundary-context-loss.test.tsx` το διαβάζει από το `maplibre-gl-dev.mjs`) |

Νέες εξαρτήσεις, όλες επιτρεπτές (N.5): `zustand` · `bidi-js` · `@maplibre/vt-pbf` · `protocol-buffers-schema` MIT ·
`@maplibre/mlt` MIT/Apache-2.0 · `pbf@5` · `@mapbox/vector-tile@3` BSD-3 · `@mapbox/tiny-sdf` · `@mapbox/unitbezier` BSD-2 ·
`@maplibre/geojson-vt` · `earcut` · `kdbush` · `@maplibre/maplibre-gl-style-spec` ISC. Το lockfile έχει πλέον **δύο** εκδόσεις
των `pbf` (4.0.1 δική μας · 5.2.0 της MapLibre), `@mapbox/vector-tile` (2.0.4 · 3.0.0) και `zustand` (5.0.9 · 5.1.0).

**Τι ΔΕΝ ελέγχθηκε:** `next build` και τύποι (N.17) — άρα **δεν** ξέρουμε ακόμη αν το webpack εκπέμπει τον worker όπως λένε οι
οδηγίες (Next ≥ 15, έχουμε 15.5.22)· κανένας χάρτης ζωντανά (39 αρχεία-καταναλωτές του συνόρου)· το `zoomLevelsToOverscale`
(προεπιλογή 4 — μπορεί να αλλάξει `queryRenderedFeatures` και ετικέτες)· το CI σε Node 22.

**Ζωντανός έλεγχος (2026-11-24, παραγωγή `4a9cce9`, μόνο ανάγνωση):**
- ✅ `/search/results`: ο χάρτης γεμίζει· ο worker `/_next/static/media/maplibre-gl-worker.<hash>.mjs` κατεβαίνει με 200 — το
  webpack **τον εκπέμπει**, και το `next build` της ανάπτυξης πέρασε.
- ✅ `PriceMapLayer`: χρώματα, ετικέτες τιμών και **διαγράμμιση** («τιμή του Δήμου») στο ζουμ της Αττικής — ο
  `setMissingStyleImageResolver` δουλεύει. Κλικ σε περιοχή ⇒ επιλογή + τιμή στο πλαίσιο.
- ✅ `AreaChildPriceLayer` (`/area/regional_unit:46`) και ζώνες αντικειμενικών (`/area/municipal_unit:461101`): χρώματα, ετικέτες,
  κλικ σε Δήμο. Διαγράμμιση εκεί **δεν** φάνηκε — όλοι οι Δήμοι της Π.Ε. έχουν τιμή.
- ✅ Συστάδα ⇒ ζουμ, ετικέτες τιμών στις πινέζες. Καμία ορατή αλλαγή από το `zoomLevelsToOverscale: 4`.
- **Δεν** ελέγχθηκαν: popup αγγελίας από κλικ σε μεμονωμένη πινέζα · η κονσόλα κατά τη φόρτωση (η καταγραφή ξεκίνησε αργά) ·
  συσκευή χωρίς WebGL2.

**CI σε Node 22 (`4a9cce9`):** 28 ✅ · 15 ❌ · 3 ακυρωμένα. Κανένα log δεν δείχνει αποτυχία εκκίνησης λόγω Node. Δέκα από τα
κόκκινα ήταν κόκκινα και στο `19fd6cb8`. Τα άλλα πέντε (η σύγκριση **δεν** είναι πλήρης — στο `19fd6cb8` έτρεξαν μόνο 28
workflows): Firestore Verified Fake (Q14, σειρά αποτελεσμάτων του emulator) · Camera Motion 3.77 (`terrain-3d-engine.ts`) ·
Dependency-CVE (44 εκτός λίστας) · ESLint «security» 208 → 957 · Dependency-Graph (595 νέοι κύκλοι).

Τα δύο που έμοιαζαν ύποπτα **προϋπήρχαν** της αναβάθμισης (ιστορικό εκτελέσεων ανά workflow):
- **Firestore Verified Fake**: κόκκινο από `8a3f77ed` (2026-11-09), τη μέρα που μπήκε το Q14. Το ερώτημα `where('at','<',…)`
  δεν έχει `orderBy`· ο αληθινός emulator απαντά `['old','mid']` (σειρά κατά `at`), το test περιμένει `['mid','old']`. Η
  προσδοκία γράφτηκε πάνω στο ψεύτικο, όχι στον emulator. ✅ **Έκλεισε 2026-11-24** (ADR-742 §7sexdecies.8): το ψεύτικο
  εφαρμόζει πλέον την υπονοούμενη ταξινόμηση· 248 εξαρτώμενες σουίτες μετρήθηκαν. Ο emulator κρίνει στο CI, μετά το push.
- **Camera Motion 3.77**: κόκκινο από `6d818733` (2026-11-22). Ο κανόνας `\.(flyTo|fitBounds|easeTo|jumpTo)\(` πιάνει το
  `rig.flight.flyTo(…)` της κάμερας **three.js** του 3Δ εδάφους (`terrain-3d-engine.ts`), που δεν είναι κάμερα χάρτη.
  ✅ **Έκλεισε 2026-11-24** (ADR-847 §10.9): δηλωμένη, ξανακρινόμενη εξαίρεση στην άγκυρα — jest 20/20· το CI κρίνει μετά το push.

#### Φάση Α — γεωαναφορά *(κώδικας ✅ 2026-11-24 · στην παραγωγή `2cc1dc01` · ζωντανά: άρνηση ✅ · **επιτυχής διαδρομή ✅ 8β, παραγωγή `33ecb679`** · tsc / `next build` **δεν** έτρεξαν τοπικά)*

Το στιγμιότυπο αποκτά **ένα** πεδίο θέσης — κέντρο WGS84 + στροφή πλέγματος — από το οποίο οι φάσεις Β–Δ τοποθετούν κάθε
σημείο του πλαισίου στον χάρτη (Revit: Survey Point + γωνία προς αληθή βορρά · IFC4: `IfcMapConversion`).

**Μέτρηση πριν από τον κώδικα (2026-11-24, `ownp_c06bc6a2…`, μόνο ανάγνωση).** Το δημόσιο `position` αγγελίας ιδιοκτήτη
είναι **αυτούσιο** το σημείο που δήλωσε: `placeKnowledgeFromOwnerProperty` → `addressToPositionCandidate`, χωρίς
στρογγύλευση ή θόλωμα (ιδιωτικό `40.6276164, 22.9586211` = δημόσιο, `geocoded` / `interpolated`, σχήμα `pin-with-ring`)·
το δημόσιο έγγραφο κουβαλά και δείκτη σε κτίριο του επιπέδου Α. ⇒ Το νέο κουτάκι **δεν υπόσχεται ιδιωτικότητα**: λέει μόνο
τι προσθέτει (τη **μετρημένη** θέση). Πραγματική αναβάθμιση αποκάλυψης είναι μόνο για θέση `approximate` / `center`.

**Τι κάνουν οι μεγάλοι (έρευνα 2026-11-24).** Airbnb: προεπιλογή «γενική θέση» (κύκλος < 1 km), ρητό «specific location».
Revit · Civil 3D: το σύστημα αναφοράς είναι ιδιότητα του μοντέλου και μένει όταν αλλάζουν τα δεδομένα. ArcGIS · QGIS ·
Civil 3D: **κανένας** δεν διασταυρώνει αυτόματα μια δήλωση συστήματος — το αφήνουν στο μάτι πάνω σε υπόβαθρο.

| # | Απόφαση | Πού ζει |
|---|---|---|
| Α1 | **Πηγή v3**: `coordinateSystem: 'EPSG:2100' \| 'local' \| null` (`null` = δεν ρωτήθηκε) + `showLocationInListing`. v1/v2 διαβάζονται ως «δεν ρωτήθηκε» / «όχι». Ένας γραφέας ανά πεδίο. | `listing-terrain-source.ts` (`withCoordinateSystem` · `withLocationConsent` · `withGeoreferenceChoice`) |
| Α2 | **Το σύστημα δηλώνεται, δεν μαντεύεται.** Ό,τι δείχνουν τα σημεία είναι **πρόταση** με τεκμήριο (όλα μέσα στην περιοχή χρήσης ⇒ ΕΓΣΑ'87 · κανένα ⇒ τοπικές · μικτά ⇒ καμία). | `listing-terrain-georeference.ts` (`suggestCoordinateSystem`) |
| Α3 | **Στιγμιότυπο v3**: `georeference` + `georeferenceOmission` (`crs-undeclared` · `crs-local` · `outside-area-of-use`). Builder 3 → 4 ⇒ το ράφι ξαναψήνει. Η γεωμετρία μένει σε σχετικό πλαίσιο· το `centreWorldMm` εξακολουθεί να **μη** σειριοποιείται. | `listing-terrain-types.ts` · `listing-terrain-snapshot.ts` · `listing-terrain-snapshot-reader.ts` |
| Α4 | **Ποιος βλέπει θέση**: ο ιδιοκτήτης πάντα· το κοινό **μόνο** με συγκατάθεση. Χωρίς αυτήν ο builder δεν λαμβάνει καν αίτημα ⇒ το δημόσιο αρχείο δεν έχει ούτε θέση ούτε σημείωση ότι υπάρχει. | `toListingTerrainInput(source, audience)` |
| Α5 | **Διασταύρωση με τη θέση της αγγελίας** (πέρα από τους μεγάλους): `ανοχή = max(αβεβαιότητα θέσης, 250 m) + μισή διαγώνιος`. Η αβεβαιότητα είναι ο **υπάρχων** πίνακας `LISTING_UNCERTAINTY_KM` (μέσω `listingSearchArea`)· μόνη νέα σταθερά το δάπεδο 250 m. Άγνωστη θέση αγγελίας ⇒ άρνηση. | `crossCheckWithListing` · `LISTING_TERRAIN_GEOREFERENCE_MIN_TOLERANCE_M` |
| Α6 | **Ίδιος κριτής δείχνει και αποφασίζει**: η κάρτα δείχνει «πέφτει Χ m από τη θέση της αγγελίας (ανοχή Υ m)» **πριν** δηλώσει ο άνθρωπος, και η πόρτα επιβάλλει το ίδιο αποτέλεσμα. | `terrain-georeference-declaration.ts` (`readAsGreekGrid`) |
| Α7 | **Πόρτα**: `PATCH …/terrain` δέχεται και `{ kind: 'coordinate-system', system }` · `{ kind: 'location-visibility', showInListing }` (κλειστά, `.strict()`, χωριστά από το `PlotOutlineAmendment`)· `GET ?view=georeference` δίνει την κατάσταση **χωρίς** συντεταγμένη. Ίδιος κινητήρας (`republishOwnerMaterial`), ταυτοδυναμία με `encodeListingTerrainSource`. | `terrain-georeference.server.ts` · `route.ts` |
| Α8 | **Αμετάβλητο: συγκατάθεση ⇒ δηλωμένο ΕΓΣΑ'87.** Συγκατάθεση χωρίς σύστημα ⇒ 409· «τοπικές» αίρει τη συγκατάθεση. | `amendedSource` |
| Α9 | **Νέο ανάγλυφο μεταφέρει δήλωση + συγκατάθεση** αν η δήλωση στέκει για τα **νέα** σημεία (ίδιος κριτής)· αλλιώς αδήλωτο και χωρίς συγκατάθεση. Ό,τι έστειλε ο browser στα δύο πεδία αντικαθίσταται πάντα. Το γραφείο δηλώνει ρητά «καμία» (`NO_TERRAIN_INHERITANCE`). | `carriedOwnerGeoreference` (καθαρή) · `terrainMaterialDoor.inheritedOf` · `loadDossierTerrainInheritance` |
| Α10 | **UI**: κάρτα «Θέση στον χάρτη» κάτω από το ανάγλυφο του ιδιοκτήτη, ορατή **και χωρίς** περίγραμμα· το ΕΓΣΑ'87 δεν πατιέται όταν η ανάγνωση δεν συμφωνεί, το κουτάκι θέσης μένει ανενεργό μέχρι να δηλωθεί **και λέει γιατί** (`aria-describedby`). Δύο **ονομασμένες** ομάδες με διαχωριστικό — «σύστημα» / «στη δημόσια αγγελία» (2026-11-24: στον ζωντανό έλεγχο το κουτάκι διαβαζόταν ως τρίτο ραδιόφωνο). | `components/terrain/georeference/` · `components/terrain/ListingVisibilityConsent` (κοινό με το Π9) · `useTerrainGeoreference` |

**Νέοι κωδικοί άρνησης** (κλειστή λίστα, μηνύματα `el` + `en`): `TERRAIN_GEOREFERENCE_NO_RELIEF` ·
`…_OUTSIDE_AREA_OF_USE` · `…_FAR_FROM_LISTING` · `…_LISTING_POSITION_UNKNOWN` · `…_NOT_DECLARED`.

**Γνωστά όρια.**
- Η διασταύρωση τρέχει στην **πόρτα**, όχι στο ράφι: ο ψήστης βλέπει μόνο bytes πηγής. Στο ψήσιμο ξανακρίνεται μόνο η
  περιοχή χρήσης. Αν ο ιδιοκτήτης αλλάξει **αργότερα** τη διεύθυνση, η γεωαναφορά δεν ξανακρίνεται (η μετρημένη θέση είναι
  ούτως ή άλλως ισχυρότερη πηγή: `survey` > `geocoded`).
- Δεν πιάνει λάθος μικρότερο της ανοχής· στο `center` η ανοχή είναι 10 km.
- Κάθε δημοσίευση ισοϋψών **κατεβάζει μία φορά** την προηγούμενη πηγή (η δήλωση ζει μόνο μέσα της), ακόμη κι όταν το
  περίγραμμα το κρατά το σχέδιο (Ι13). ✅ **2026-11-24**: το επιπλέον **ερώτημα** φακέλου και το **δεύτερο** κατέβασμα
  (όταν η πηγή κρατούσε και το περίγραμμα) έφυγαν — ένας αναγνώστης `loadDossierTerrainInheritance`, ένα μέρος πόρτας
  `inheritedOf` (Ι1: 3 → 2 ερωτήματα · Ι17 · Ι18).
- Η πηγή της δοκιμαστικής αγγελίας είναι συνθετική και **μετρήθηκε ζωντανά** ότι πέφτει 1.789 m από τη δηλωμένη
  διεύθυνση (ανοχή 290 m) — γι' αυτό η επιτυχής διαδρομή ελέγχθηκε (8β, παρακάτω) με **δεύτερη** συνθετική αποτύπωση,
  γραμμένη πάνω στη δηλωμένη διεύθυνση.

**Ζωντανός έλεγχος (2026-11-24, παραγωγή `2cc1dc01`, μόνο ανάγνωση).** Το build του Netcup πέρασε (η σελίδα σερβίρει τον
νέο κώδικα). `/offers/ownp_c06bc6a2…/improve` → «Τοπογραφικό και ανάγλυφο» → «Τοπογραφικό σχέδιο»:

- ✅ Η κάρτα «Θέση στον χάρτη» εμφανίζεται κάτω από το ανάγλυφο· το ανάγλυφο του ιδιοκτήτη φορτώνει με στιγμιότυπο v3.
- ✅ Ανάγνωση: «…πέφτει **1.789 m** από τη θέση που δηλώνει η αγγελία — πέρα από την ανοχή των **290 m**» (η αποτύπωση
  της δοκιμαστικής αγγελίας είναι συνθετική) ⇒ το ραδιόφωνο ΕΓΣΑ '87 **ανενεργό**, οι «Τοπικές» διαθέσιμες, το κουτάκι θέσης
  ανενεργό και ατσεκάριστο. Η πρόταση «Όλα τα σημεία πέφτουν στην περιοχή του ΕΓΣΑ '87…» εμφανίζεται.
- 🔶 Εύρημα: το κουτάκι θέσης διαβαζόταν ως τρίτο ραδιόφωνο — διορθώθηκε (Α10, changelog).
- **Δεν** ελέγχθηκαν: η επιτυχής διαδρομή (δήλωση ΕΓΣΑ '87 → συγκατάθεση → θέση στο **δημόσιο** στιγμιότυπο) · η δημόσια
  αγγελία μετά το ξαναψήσιμο (builder 4) · κονσόλα και αιτήματα δικτύου (`GET ?view=georeference`, `PATCH`) · η δήλωση
  «Τοπικές συντεταγμένες» · η μεταφορά δήλωσης σε νέο ανέβασμα (Α9) · ο ανώνυμος επισκέπτης. Η επιτυχής διαδρομή θέλει
  αποτύπωση κοντά στη δηλωμένη διεύθυνση — **γράφει στην παραγωγή**, άρα μόνο με ρητή εντολή.

**Ζωντανός έλεγχος 8α (2026-11-24, παραγωγή `6ecb257e`, μόνο ανάγνωση).**

- ✅ Κάρτα «Θέση στον χάρτη» μετά το Α10: δύο `fieldset` με `legend` και διαχωριστικό· το ανενεργό κουτάκι γράφει τον λόγο
  του, δεμένο με `aria-describedby`.
- ✅ `GET …/terrain?view=georeference` → 200: `coordinateSystem: null`, `showLocationInListing: false`,
  `suggestion: EPSG:2100`, `greekGrid: far-from-listing` (1.789 m, ανοχή 290 m).
- ✅ `public_listings/ownp_c06bc6a2…`: κανένα `georeference`· δημόσιο στιγμιότυπο εδάφους `version: 2`, `plotOutline: null`,
  καμία απόλυτη συντεταγμένη. Το HTML του ανώνυμου επισκέπτη δεν έχει ίχνος θέσης.
- ✅ CI: Firestore Verified Fake (Q14/Q15/Q16 στον emulator) · Camera Motion 3.77 · Shell Slice 3.34 · TypeScript Error Gate.
- 🔶 Εύρημα — **διπλό `GET ?view=georeference`** στο ίδιο φόρτωμα. Αιτία: το `PlotOutlineTab` έδινε στο
  `useTerrainGeoreference` ως «αναθεώρηση» το `status.view` του περιγράμματος, που αλλάζει **μόνο του** μία φορά (από
  «φορτώνει» σε «έτοιμο») ⇒ ένα αίτημα στο mount και ένα όταν απαντήσει ο φάκελος. Διόρθωση: όσο ο φάκελος φορτώνει δίνεται
  `null` και το hook περιμένει ⇒ **ένα** αίτημα. Ζωντανή επαλήθευση: ✅ παραγωγή `9c31d339` (παρακάτω).
- 🔶 Εύρημα — το `Checkbox` μετρήθηκε με ακτίνα **4px**, όχι 2px όπως έγραφαν το ADR-770 και το σχόλιο του κώδικα. Λάθος ήταν
  το κείμενο (ADR-770 changelog, διορθωμένο)· ο κώδικας δεν άλλαξε.
- 🔶 Εύρημα — δημόσια αγγελία: προειδοποίηση MapLibre `Image "townhall" could not be loaded`. Αιτία
  **μετρημένη**: το στυλ του `@protomaps/basemaps` 5.7.2 ζητά εικονίδιο με το όνομα του `kind` (layer `pois`, λίστα με
  `townhall`), αλλά το `sprites/v4` **δεν** έχει `townhall` — 53 εικονίδια, ίδια στο bundle μας και στο τρέχον upstream
  (`028c18f713ba`, στο οποίο είμαστε ήδη καρφωμένοι). Κενό του upstream, όχι δικό μας κάρφωμα. **Διορθώθηκε**
  («ναι» Giorgio): το δημαρχείο παίρνει το εικονίδιο `building` στον χτίστη του στυλ → ADR-891 changelog.
- **Δεν** ελέγχθηκαν ακόμη: η επιτυχής διαδρομή (8β — γράφει στην παραγωγή → ελέγχθηκε, παρακάτω) · το `Checkbox` πέρα
  από 2 από τις ~88 χρήσεις.

**Ζωντανός έλεγχος 8β — η επιτυχής διαδρομή (2026-11-24, παραγωγή `33ecb679`, με ρητό «ναι» — **γράφει**).** Αγγελία
`ownp_c06bc6a2-8bf6-4e95-9ca9-c2d4bf492dec`, «Βελτίωσε» → «Τοπογραφικό και ανάγλυφο».

- ✅ Δήλωση «Τοπικές συντεταγμένες» → `PATCH …/terrain` 200. Το ΕΓΣΑ '87 έμενε ανενεργό (1.789 m, ανοχή 290 m).
- ✅ Ανέβασμα συνθετικής αποτύπωσης πάνω στη δηλωμένη διεύθυνση (`topo-test-egsa87-thessaloniki.txt`, 99 σημεία): οι στήλες
  E / N / Z αναγνωρίστηκαν αυτόματα, 720 m², υψόμετρα 18,6–22,6 m, `POST` 200.
- ✅ Μετά από επαναφόρτωση: «**0 m** από τη θέση της αγγελίας (ανοχή **270 m**)», το ραδιόφωνο ΕΓΣΑ '87 ενεργό (Α5 · Α6).
- ✅ Δήλωση ΕΓΣΑ '87 + κουτάκι θέσης → δημόσιο στιγμιότυπο **v3** με
  `georeference: { centre: { lat: 40.6276164, lng: 22.9586211 }, gridConvergenceDeg: -0.6792 }` (Α3 · Α4).
- ✅ Δεύτερο ανέβασμα της ίδιας αποτύπωσης: δήλωση και συγκατάθεση **μεταφέρθηκαν**, το `georeference` έμεινε (Α9).
- ✅ Ξετσεκάρισμα του κουτιού → **νέο** στιγμιότυπο με `georeference: null`· η αγγελία δείχνει στο νέο αρχείο.
- **Δεν** ελέγχθηκαν: ο κωδικός άρνησης `…_NOT_DECLARED` (συγκατάθεση χωρίς σύστημα, Α8) από το UI · αλλαγή διεύθυνσης μετά
  τη δήλωση (γνωστό όριο) · πραγματική (μη συνθετική) αποτύπωση.

**Εύρημα 1 του 8β — το παλιό στιγμιότυπο με τη θέση, μετά το ξετσεκάρισμα.**

- Στον έλεγχο 8β το παλιό αρχείο (`…/public-media/listings/ownp_c06bc6a2…/ee7c61cb….json`) απάντησε **HTTP 200** με τις
  συντεταγμένες μέσα, ενώ η αγγελία έδειχνε ήδη στο `ef90d777….json`.
- Ξαναμετρήθηκε αργότερα την ίδια μέρα (ανώνυμο `curl` στο `storage.googleapis.com/pagonis-87766-public-media/…`):
  **404 `NoSuchKey`**. Το αρχείο **σβήστηκε** — δεν είναι μόνιμη διαρροή.
- Ο καθαρισμός υπάρχει στον κώδικα: `deleteExtra` (`src/services/listings/public-shelf-bucket.ts`), από το
  `reconcileOnePerSource` (`public-shelf-origin.ts`).
- Το 200 **ταιριάζει** με το edge cache του ραφιού: `PUBLIC_SHELF_CACHE_CONTROL = 'public, max-age=300, immutable'`
  (`src/services/upload/utils/storage-path-public-shelf.ts`, ADR-845 §7.17 Α7). ⚠️ Εξήγηση που ταιριάζει, **όχι
  αποδεδειγμένη**: δεν καταγράφηκε πόσος χρόνος πέρασε από το ξετσεκάρισμα ως τη μέτρηση του 200.
- **Συνέπεια για το Μ7** («τίποτα να κρυφτεί μετά»): ισχύει για το αντικείμενο, όχι για το παράθυρο κρυφής μνήμης — ως
  5 λεπτά μετά την ανάκληση το παλιό URL μπορεί να σερβίρεται από το edge, και αντίγραφο που κατέβασε ήδη browser επισκέπτη
  δεν ανακαλείται από κανέναν. Η αλλαγή (στιγμιότυπο εδάφους χωρίς edge cache) είναι το βήμα **Β7** της φάσης Β· η
  διατύπωση του Μ7 διορθώνεται στο κλείσιμο της φάσης (Β8). **Κανένας κώδικας δεν άλλαξε.**

**Εύρημα 2 του 8β — η καρτέλα «Τοπογραφικό σχέδιο» μένει μπαγιάτικη μετά το ανέβασμα.** 🔶 **Ανοιχτό.** Μετά το ανέβασμα
στην καρτέλα «Ισοϋψείς και σημεία», η «Τοπογραφικό σχέδιο» έδειχνε χωρίς επαναφόρτωση το **παλιό** ανάγλυφο (99–104,2 m),
«1.789 m» και το ΕΓΣΑ '87 ανενεργό· κανένα νέο `GET ?view=georeference` δεν έφυγε. Με επαναφόρτωση της σελίδας τα σωστά.
Η αιτία **δεν** ερευνήθηκε στον κώδικα. Εκτός φάσης Β — χωριστή διόρθωση, με δική της εντολή.

**Ζωντανή επαλήθευση των διορθώσεων του 8α (2026-11-24, παραγωγή `9c31d339`, μόνο ανάγνωση).**

- ✅ **Ένα** `GET …/terrain?view=georeference` στο φόρτωμα του `/improve` (πριν: δύο).
- ✅ Καμία προειδοποίηση `Image "townhall"` στη δημόσια αγγελία, με τον χάρτη φορτωμένο (ADR-891).
- ✅ Συλλογή φωτογραφιών σε επιφάνεια εργασίας (ADR-884 §4.12)· πλάτος κινητού **αμέτρητο**.
- `Checkbox`: καμία νέα μέτρηση.

**Κατάσταση της δοκιμαστικής αγγελίας μετά τον έλεγχο:** συνθετική αποτύπωση ΕΓΣΑ '87 πάνω στη διεύθυνση, δήλωση
`EPSG:2100`, κουτάκι θέσης **ξετσεκαρισμένο** (δημόσιο στιγμιότυπο χωρίς θέση).

**Φάση Β — κατάσταση (2026-11-24).** Το σχέδιο εγκρίθηκε από τον Giorgio (σύντηξη υψομέτρων σε **ένα** έδαφος της MapLibre
αντί για πλέγμα three πάνω στο χοντρό — αντικαθιστά το Μ4· βήματα Β0–Β8, ένα τη φορά). **Κανένας κώδικας.** Οι αποφάσεις
του σχεδίου γράφονται εδώ όταν υλοποιούνται· η αντικατάσταση του Μ4 και η διόρθωση του Μ7 στο Β8.


**Tests.** Νέα: `listing-terrain-georeference.test.ts` (άγκυρα Σύνταγμα από την **αντίστροφη** διαδρομή της προβολής) ·
`terrain-georeference-declaration.test.ts` · `TerrainGeoreferenceCard.test.tsx` · Γ1–Γ10 στο
`owner-property-terrain-route.test.ts`. Ενημερωμένα: πηγή, αναγνώστης, συμβόλαιο κωδικών, ράφι.

## Changelog
- **2026-11-24** — **Β6.12 φάση Α — ζωντανός έλεγχος 8β (επιτυχής διαδρομή) + επαλήθευση των διορθώσεων του 8α** (§14.12, μόνο κείμενο): παραγωγή `33ecb679`, με ρητό «ναι»: «Τοπικές» → ανέβασμα συνθετικής αποτύπωσης πάνω στη διεύθυνση (99 σημεία) → «0 m, ανοχή 270 m» → δήλωση ΕΓΣΑ '87 + συγκατάθεση → δημόσιο στιγμιότυπο v3 με `georeference` → δεύτερο ανέβασμα μεταφέρει δήλωση και συγκατάθεση (Α9) → ξετσεκάρισμα ⇒ `georeference: null` ✅. **Εύρημα 1**: το παλιό αρχείο με τη θέση απάντησε 200 στον έλεγχο και **404 `NoSuchKey`** αργότερα την ίδια μέρα — ο καθαρισμός υπάρχει (`deleteExtra`)· το 200 ταιριάζει με το `max-age=300` του ραφιού, **όχι αποδεδειγμένο** εκ των υστέρων· το παράθυρο κλείνει στο βήμα Β7. **Εύρημα 2** (ανοιχτό): η καρτέλα «Τοπογραφικό σχέδιο» μένει μπαγιάτικη μετά το ανέβασμα, αιτία αδιάγνωστη. Παραγωγή `9c31d339`, μόνο ανάγνωση: ένα `GET ?view=georeference` ✅ · καμία προειδοποίηση `townhall` ✅. Φάση Β: σχέδιο εγκεκριμένο, κανένας κώδικας. Κανένα test δεν έτρεξε.
- **2026-11-24** — **Β6.12 φάση Α — ζωντανός έλεγχος 8α + ένα αίτημα γεωαναφοράς αντί για δύο** (§14.12): γράφτηκαν τα ευρήματα του 8α στην παραγωγή `6ecb257e` (κάρτα, πόρτα, δημόσιο στιγμιότυπο, ανώνυμος επισκέπτης ✅). Το διπλό `GET ?view=georeference` διορθώθηκε: το `useTerrainGeoreference` περιμένει (`reliefRevision === null`) όσο ο φάκελος φορτώνει. Η ακτίνα του `Checkbox` είναι 4px — διορθώθηκε το κείμενο (ADR-770), όχι ο κώδικας. Το `townhall` που έλειπε από το sprite → ADR-891. Jest ✅ `useTerrainGeoreference` 5/5 (Μ1–Μ3 · Ξ1–Ξ2, νέο) · `protomaps-style` (άγκυρα ΣΤ, νέα). Ζωντανή επαλήθευση των διορθώσεων: εκκρεμεί· η επιτυχής διαδρομή 8β παραμένει αδοκίμαστη.
- **2026-11-24** — **Β6.12 φάση Α — τα τρία «ναι» του Giorgio**: το κοινό `Checkbox` έγινε τετράγωνο (ADR-770 §11 — έκλεισε το «ανοιχτό, εκτός κάρτας» της προηγούμενης γραμμής) · οι κανόνες πολλών πεδίων ανισότητας μπήκαν στο συμβόλαιο του emulator ως Q16 (ADR-742 §7sexdecies.8) · το `listing-media-route.test.ts` ήταν κόκκινο (7/9) από **μπαγιάτικο fixture** — έστελνε `material: 'photo'` ενώ το υλικό είναι αντικείμενο `{ kind }`· τώρα `PHOTO_MATERIAL`, 9/9.
- **2026-11-24** — **Β6.12 φάση Α — ζωντανός έλεγχος + τα δύο παλιά κόκκινα του CI** (§14.12): γράφτηκε ο ζωντανός έλεγχος της παραγωγής `2cc1dc01` (άρνηση ✅ με 1.789 m / ανοχή 290 m· επιτυχής διαδρομή, δημόσια αγγελία, δίκτυο, «τοπικές», μεταφορά δήλωσης, ανώνυμος επισκέπτης **δεν** ελέγχθηκαν). Camera Motion 3.77 → ADR-847 §10.9· Firestore Verified Fake (Q14) → ADR-742 §7sexdecies.8. Η διαρροή κλειστότητας του `quotes` → ADR-744 §36.
- **2026-11-24** — **Β6.12 φάση Α — η συγκατάθεση θέσης σε δική της ομάδα** (§14.12 Α10): στον ζωντανό έλεγχο το κουτάκι θέσης, στοιχισμένο κάτω από τα δύο ραδιόφωνα, διαβαζόταν ως τρίτη επιλογή συστήματος. Η κάρτα έχει πλέον δύο ονομασμένες ομάδες (`fieldset` + `legend`) με διαχωριστικό, και το ανενεργό κουτάκι γράφει τον λόγο του (όχι όσο τρέχει πράξη — τότε θα ήταν ψέμα). Τα δίδυμα `PlotOutlineVisibilityCheckbox` / `TerrainLocationVisibilityCheckbox` μοιράζονται το `ListingVisibilityConsent`. Jest ✅ 19/19 (Κ3 · Κ6 ενημερωμένα · Κ8 νέο). ⚠️ **Ανοιχτό, εκτός κάρτας**: μετρήθηκε ότι το κοινό `Checkbox` ζωγραφίζεται **κύκλος** παντού (`quick.rounded` = `rounded-lg` σε κουτί 16 px) — θέμα design system, δεν αγγίχτηκε.
- **2026-11-24** — **Β6.12 φάση Α — ένα ερώτημα, ένα κατέβασμα στο ανέβασμα ισοϋψών** (§14.12 «Γνωστά όρια» · Α9): το περίγραμμα και η γεωαναφορά ρωτούσαν χωριστά τον φάκελο. Νέος αναγνώστης `loadDossierTerrainInheritance` (πάνω του εκφράζεται και το `loadDossierTerrainState`), τα δύο μέρη της πόρτας `confirmedOutlineOf` + `carriedGeoreferenceOf` έγιναν ένα `inheritedOf`, το `carriedOwnerGeoreference` έγινε καθαρή συνάρτηση. Το `loadDossierPlotOutline` αφαιρέθηκε. Jest διαδρομών εδάφους ✅ 83/83 (Ι1 ενημερωμένο · Ι17 · Ι18 νέα).
- **2026-11-24** — **Β6.12 φάση Α — γεωαναφορά** (§14.12 «Φάση Α»): πηγή v3 (ρητή δήλωση `EPSG:2100` / «τοπικές» + συγκατάθεση θέσης), στιγμιότυπο v3 με `georeference` (κέντρο WGS84 + στροφή πλέγματος), builder 4. Διασταύρωση με τη θέση της αγγελίας (ανοχή από `LISTING_UNCERTAINTY_KM`, δάπεδο 250 m). `PATCH` + `GET ?view=georeference`, κάρτα «Θέση στον χάρτη». Μετρήθηκε ότι το δημόσιο `position` είναι ήδη το ακριβές δηλωμένο σημείο. Jest φάσης ✅· tsc, build, πύλες, ζωντανά **όχι**.
- **2026-11-24** — **Β6.12 προαπαιτούμενο — MapLibre 6.19.0 ✅ ζωντανά** (§14.12 «Προαπαιτούμενο» · §14.11): παραγωγή `4a9cce9`, μόνο ανάγνωση. Πλακίδια, worker 200, διαγράμμιση τιμών, κλικ σε περιοχές, χάρτες περιοχής ✅· περίγραμμα στις «Κλίσεις» ✅. CI σε Node 22: 15 κόκκινα, κανένα από εκκίνηση Node· πέντε χωρίς προηγούμενο κόκκινο προς σύγκριση.
- **2026-11-24** — **Β6.12 προαπαιτούμενο — MapLibre 5.15 → 6.19.0** (§14.12): `react-map-gl` 8.1.3, `setWorkerUrl` στο σύνορο του χάρτη, `setMissingStyleImageResolver` στο choropleth, jest για ESM-only. Node 20 → 22 (τοπικά + CI, `88499a00`). Jest χαρτών 70 σουίτες / 820 tests ✅. `next build`, τύποι και ζωντανός έλεγχος **εκκρεμούν**.
- **2026-11-24** — **Β6.12 — ΕΓΚΡΙΘΗΚΕ + έρευνα εφικτότητας** (§14.12): Giorgio «ναι σε όλα» (Μ1–Μ7, «Στον χάρτη» ως τρίτη όψη). Mapterhorn: πλανήτης 355,6 GB z0–12, απόσπασμα Ελλάδας με `pmtiles extract` (~0,4–1 GB, εκτίμηση), τίποτα λεπτότερο από 30 m. MapLibre 5.9 έχει το σφάλμα #6701 του `queryTerrainElevation` ⇒ το 3Δ πάνω σε χάρτη θέλει ≥ 5.15. Κανένας κώδικας.
- **2026-11-24** — **Β6.11 Ζ5 — τσεκαρισμένο Π9 ✅ ζωντανά + παχύτερο περίβλημα περιγράμματος** (§14.11): με το κουτάκι τσεκαρισμένο το περίγραμμα βγαίνει στη δημόσια αγγελία και το κείμενο αλλάζει· ξετσεκαρίστηκε. `outlineCasing` 4,5 → 6,5 px ώστε το περίγραμμα να ξεχωρίζει στις «Κλίσεις». Χωρίς test· ζωντανός έλεγχος μετά το deploy.
- **2026-11-24** — **Β6.11 Ζ5 + Ζ5β — ζωντανός έλεγχος ✅** (§14.11): παραγωγή `19fd6cb`, μόνο ανάγνωση. Περίγραμμα σε κάτοψη και 3Δ στη «Βελτίωσε», ρητό «μόνο εσύ το βλέπεις», δημόσια αγγελία χωρίς περίγραμμα (Π9), `?view=relief` 200. Ανοιχτά: τσεκαρισμένο Π9 (θέλει εντολή) · αντίθεση του περιγράμματος στις «Κλίσεις».
- **2026-11-24** — **Β6.12 — ΠΡΟΤΑΣΗ: το ανάγλυφο πάνω σε χάρτη** (§14.12): έρευνα παρόχων και πρόταση «MapLibre + δικά μας δεδομένα (OSM + Mapterhorn ως δικό μας PMTiles), χωρίς Google, χωρίς αεροφωτογραφία στην πρώτη φάση, ακριβής θέση δημόσια μόνο με ρητή επιλογή». Κανένας κώδικας· περιμένει έγκριση Giorgio.
- **2026-11-24** — **Β6.11 Ζ5β — ο χάρτης του ιδιοκτήτη στη «Βελτίωσε»** (§14.11 «Ζ5β»): `GET …/terrain?view=relief` δίνει το στιγμιότυπο με κοινό `'owner'` (το περίγραμμα πάντα, Π9) από τον ΕΝΑ κριτή, χωρίς καμία εγγραφή· `PlotOutlineOnRelief` κάτω από το κουτάκι Π9, με ρητό «μόνο εσύ το βλέπεις». Απόφαση Giorgio: **όχι** και στη σελίδα της αγγελίας. Tests Ζ5 ✅ 53/53· tests πόρτας Ζ5β ✅ 37/37.
- **2026-11-24** — **Β6.11 Ζ5 — το περίγραμμα οικοπέδου πάνω στο ανάγλυφο** (§14.11 «Ζ5»): κάτοψη (μοντέλο `plotOutline`, σύμβολο `TerrainLine`, υπόμνημα με ποσοστό κάλυψης) και 3Δ (ντυμένο στο TIN, διακεκομμένο `LineSegments2`). Ο viewer δεν διάβαζε το `plotOutline` του στιγμιοτύπου. + ζωντανός έλεγχος της επιλογής από γεωμετρία ✅ (`42fafc8e`). Ανοιχτό: προεπισκόπηση ιδιοκτήτη (Π9). Tests γραμμένα, δεν έτρεξαν.
- **2026-11-24** — **Β6.11 Ζ4 — επιλογή υποψηφίου πάνω στο σχέδιο από τη γεωμετρία** (§14.11 «Ζ4 — επιλογή πάνω στο σχέδιο»):
  υποψήφιο μέσα στο επιλεγμένο (και ταυτόσημοι δακτύλιοι) δεν διαλεγόταν με κλικ — το έκρινε η σειρά ζωγραφικής. Νέος καθαρός
  κριτής `plot-candidate-pick` (ακμή → πιο μέσα σχήμα → κύκλος στο ξανά-κλικ) + `usePlotCandidatePointer` (ανοχή σε css px,
  προ-τονισμός) + `planWorldPoint`. Και: επανέλεγχος της διόρθωσης κενής προβολής ✅ ζωντανά (`5ca7fa02`) · tests ✅ 20/20.
- **2026-11-24** — **Β6.11 Ζ4 — διόρθωση: η προβολή του σχεδίου έβγαινε κενή** (§14.11 «Ζ4 — ζωντανός έλεγχος»): απόλυτα WORLD mm
  ΕΓΣΑ στο SVG ⇒ ο float32 ζωγράφος του browser δεν έβγαζε τίποτα. Τοπική αρχή στο `PlanViewBox` (`origin`), `viewBox` από το 0,
  κάθε συντεταγμένη μέσω `planSvgPoint(point, box)` πάνω στο SSoT `worldToLocal`. Άγκυρα «μέγεθος ΕΓΣΑ» (γραμμένη, δεν έτρεξε).
- **2026-11-23** — **Β6.11 Ζ4 — UI ιδιοκτήτη για το τοπογραφικό σχέδιο** (§14.11 «Ζ4»): ζωντανός έλεγχος Ζ1–Ζ3c (κώδικας + κανόνες
  αναπτυγμένοι ✅· δεδομένα 0 ⇒ ο έλεγχος Σ3–Σ10 μέσα από το UI) · `GET` κατάστασης στην ίδια πόρτα (`loadDossierPlotOutlineStatus`,
  ίδιος κανόνας «νικά η νεότερη», σχέδιο και στον κάδο, `isOutlineSource`) · **ένας** πυρήνας ανάγνωσης σχεδίου για συσκευή **και**
  πόρτα (`plot-drawing-read`) · σελίδες PDF στη συσκευή σε κοινό module (`pdf-device-pages`) · καρτέλες «Ισοϋψείς και σημεία |
  Τοπογραφικό σχέδιο» · προβολή DXF με κλικ στα υποψήφια, PDF με ζώνη πίνακα + περίγραμμα δίπλα · τεκμήρια σε λέξεις · Π9 · αφαίρεση ·
  επαναφορά σχεδίου · token `--terrain-plot-outline` · ο κάδος του σχεδίου **ενημερώνει** (δεν ρωτά «και το περίγραμμα;» — πρακτική
  Revit/Civil 3D/Figma). Tests: 5/5 σουίτες, 89 πράσινα.
- **2026-11-23** — **Β6.11 Ζ3c — το περίγραμμα που ισχύει + PATCH Π9/αφαίρεση + δίχτυ ιδιοκτήτη** (§14.11 «Ζ3c»): νικά η **νεότερη** απόφαση (σχέδιο ⇄ πηγή, ίδιος συγκριτής) ⇒ ο κάδος του σχεδίου δεν χάνει το περίγραμμα και το «ΣΧΕΔΙΟ ΠΡΩΤΑ» μένει· `PATCH` στην ίδια πόρτα (ταυτοδύναμο, νέα πηγή + επαναπροβολή)· η Α5 του ADR-845 σαρώνει και `owner_properties` με τον ίδιο κριτή· ADR-845 §7.17/§10 + ADR-866 §2.6.11 ενημερώθηκαν.
- **2026-11-23** — **Β6.11 Ζ3b — κάδος φακέλου = πράξη διακομιστή** (§14.11 «Ζ3b»): `POST /api/files/trash?custody=personal`, ζευγαρωμένη Δραστηριότητα σε δέσμη Admin, επαναπροβολή αγγελίας ιδιοκτήτη ανά `dossierId`, κανόνες κλείνουν τον κάδο πελάτη στο `files_personal`. Το περίγραμμα μένει (Π2 · πρακτική Revit).
- **2026-11-23** — **Β6.11 Ζ3 — πόρτα και φάκελος του περιγράμματος** (§14.11 «Ζ3»): `PUT` επιβεβαίωσης στην **ίδια** πόρτα
  εδάφους του ιδιοκτήτη — ο server ξαναβρίσκει το υποψήφιο στα bytes (DXF + PDF), Π6 ⇒ `TERRAIN_PLOT_OUTLINE_DISJOINT`, σχέδιο στον
  φάκελο (καρτέλα «Τοπογραφικό», ιδιωτικό, `terrain/plot-drawing`, περίγραμμα στο `measuredKeys()`) και επαναδημοσίευση από τον ΙΔΙΟ
  κινητήρα · η δημοσίευση ισοϋψών βάζει **πάντα** το επιβεβαιωμένο του φακέλου (γραφείο ⇒ `null`) · Π3 διορθώθηκε (καμία νέα
  κατηγορία) · SSoT: `positionedPageOf` + `mapPdfPages` (ένας βρόχος σελίδων PDF) · `isTopoUnit`.
- **2026-11-23** — **Β6.11 Ζ2 — το συμβόλαιο του περιγράμματος** (§14.11 «Ζ2»): πηγή v2 (`plotOutline` + `showInListing`) με
  τον ΕΝΑ γραφέα `withPlotOutline` · κοινό (Π9) ρητό στο `toListingTerrainInput(source, audience)` · `placePlotOutline`
  (Π1 χωρίς κοπή, Π6 κάλυψη/παράλειψη) · στιγμιότυπο v2 · `BUILDER_REVISION` 3 · οι αναγνώστες δέχονται και το v1.
- **2026-11-23** — **Β6.11 (Α) ακρίβεια εμβαδού στο κοινό SSoT** (§14.11 «Ζ1», παράγραφος «(Α)»): το `shoelaceArea` του
  `lib/geometry/planar-polygon.ts` αθροίζει γύρω από την πρώτη κορυφή — ΕΓΣΑ mm χωρίς απώλεια float64 για **όλους** τους
  καλούντες (μετρημένο: κολόνα 30×30 cm −0,16% ⇒ ακριβές). Το `ringAreaM2` απλοποιήθηκε σε `polygonArea / 1e6`. Άγκυρα: 3 νέα
  `it` στο `planar-polygon.test.ts`. Συντονισμός: ADR-884 (κάτοχος του επίπεδου πυρήνα).
- **2026-11-23** — **Β6.11 Ζ1 ✅ (κώδικας + tests 15/15)** (§14.11 «Ζ1»): καθαρός πυρήνας του περιγράμματος
  οικοπέδου. Σαρωτές πολυγραμμών και ετικετών DXF, υποψήφια + κατάταξη με ονομασμένα τεκμήρια (Π4), πίνακας συντεταγμένων ΕΓΣΑ
  από PDF με διπλή διασταύρωση (Π5), κάλυψη από το ανάγλυφο (Π6), περίγραμμα ντυμένο στο TIN (Π7), `dwg`/`pdf` στο είδος αρχείου
  με ονομασμένη άρνηση. Μετακομίσεις SSoT: bulge → `lib/geometry/polyline-bulge`, κατηγόρημα δακτυλίου →
  `lib/geometry/closed-polyline-ring`, πυρήνας προφίλ → `profileTraceOf`.
- **2026-11-23** — **Β6.11 ΠΡΟΤΑΣΗ** (§14.11): το τοπογραφικό σχέδιο ως δεύτερη πηγή, μόνο το περίγραμμα μέσα στο ανάγλυφο,
  χωρίς κοπή. Έρευνα (Revit, Civil 3D, Κτηματολόγιο, DWG/GPL) · SSoT audit · αποφάσεις Π1–Π10 · 4 ερωτήματα. Κανένας κώδικας.
  **Εγκρίθηκε** την ίδια μέρα (Π1–Π9 + bump εκδόσεων)· DWG σε επόμενο βήμα. §14.10: η αιτία του WGS84 σημειώθηκε επιβεβαιωμένη.
- **2026-11-23** — **Β6.10 ζωντανός έλεγχος** (§14.10) στο `6c588d26`: κάτοψη, σταγόνα 2Δ, 3Δ 1×/3×, ΕΓΣΑ ✅. Βρέθηκε ωμό
  `WGS84 {lat} · {lng}` (δεσμευμένο `lng` του i18next) ⇒ παράμετρος `{lon}`. Ανοιχτά: raycast, `dashOffset` 3Δ, αφή, Προφίλ.
- **2026-11-22** — **Β6.10 Ε2 + Ε3** (§14.10): επιθεώρηση στο 3Δ (raycast μόνο στην επιφάνεια, υψόμετρο **πάντα
  πραγματικό** από τον πυρήνα, βελόνα / καρφίτσα / φωτισμένη ισοϋψής / τομή / νερό ως επικάλυψη, καμία React state ανά
  κίνηση)· εργαλείο «Σημείο | Προφίλ» κοινό σε κάτοψη και 3Δ· υψομετρική τομή με **δηλωμένη** κάθετη υπερβολή, κενά και
  παρεμβολή ορατά, λωρίδα κλίσεων· σταγόνα νερού με κείμενο και ένδειξη «ενδεικτικό». Tests γραμμένα, δεν έτρεξαν.
- **2026-11-22** — **Β6.10 Ε1 — επιθεώρηση σημείου στην κάτοψη** (§14.10): καθαρός πυρήνας `src/lib/terrain/inspect/`
  (ανάγνωση σημείου · πλησιέστερη ισοϋψής · ακριβές προφίλ στο TIN · σταγόνα νερού), εξωτερικό store με φύλλα (ADR-040),
  hover / πάτημα-κράτημα / πληκτρολόγιο, ολόκληρη η ισοϋψής φωτισμένη, κάρτα σημείου, φωτισμός υπομνήματος και πίνακα.
  Συντεταγμένες: δημόσια μόνο ως προς το κέντρο (Δ3, snapshot αμετάβλητο)· στην προεπισκόπηση ιδιοκτήτη και ΕΓΣΑ'87/WGS84
  (`centreWorldMm`, ποτέ στο wire). `useLongPress` προήχθη σε `src/hooks/gestures/`. Tests γραμμένα, δεν έτρεξαν.
- **2026-11-22** — **Β6.9 ζωντανός έλεγχος ✅** (§14.9): παραγωγή `7a870f90`, προεπισκόπηση TEST-2, 360/640/768 px,
  Υψόμετρα + Κλίσεις.
  - Συνθετικό στα 360 px ⇒ `'none'`: λεζάντα και `<desc>` μόνο με τις κύριες, σημείωση `data-terrain-minor-hidden`,
    καμία γραμμή υπομνήματος ενδιάμεσων.
  - Συνθετικό στα 640/768 px ⇒ κανονικό.
  - Πραγματικό ⇒ `'some'` σε όλα τα πλάτη.
  - 3Δ: η γεωμετρία των ενδιάμεσων δεν εξαρτάται από το πλάτος.
  - Δεν ελέγχθηκαν ζωντανά: το `visible` της σκηνής 3Δ και το Β/Γ.
- **2026-11-22** — **Β6.9 tests ✅** (§14.9), με έγκριση Giorgio: 23 σουίτες, **379/379**.
  - Το πρώτο πέρασμα έβγαλε 3 κόκκινα, όλα **στα tests**:
    - (α) δύο renders στο ίδιο test του χάρτη·
    - (β) το αναμενόμενο διάστημα υπολογιζόταν κατά τη φόρτωση με άλλο locale («0,1» έναντι «0.1»). Αυτό έκανε κάθε
      `not.toContain` **κενό**. Τώρα υπολογίζεται μέσα στο test, με θετικό έλεγχο στο `'some'`·
    - (γ) το ψεύτικο bucket του βίντεο δεν είχε `setMetadata`. Το Κ6 (ίδια bytes, χαλασμένο μεταδεδομένο) είναι
      **ακριβώς** η περίπτωση του Β: τώρα καρφώνει ότι η εγγραφή διορθώνεται χωρίς εγγραφή bytes και ότι το επόμενο
      πέρασμα είναι γρήγορο.
  - Μεταλλάξεις **2/2**:
    - χωρίς ανανέωση εγγραφής ⇒ 2 κόκκινα (έδαφος + βίντεο)·
    - `recipeAgreement` πάντα `current` ⇒ 7 κόκκινα.
- **2026-11-22** — **Β6.9 Γ** (§14.9): το βραδινό πέρασμα κρίνει και τη συνταγή. Αποτύπωμα v3
  `v3:<πηγές>:<συνταγές>`, συμβατό με το v2 στο υλικό. Συνταγές ανά πηγή από τον ΕΝΑ διακόπτη `listingShelfLaneOf`
  (`listing-shelf-routing.ts`). Η απόκλιση μόνο συνταγής ξαναψήνεται με ρυθμό (25/πέρασμα, παράθυρο που κυλά) χωρίς
  `error`. Νέα μεγέθη `recipeOutdated` / `recipeDeferred`.
- **2026-11-22** — **Β6.9 Β** (§14.9): `LISTING_TERRAIN_BUILDER_REVISION = 2` στη συνταγή του ραφιού εδάφους
  (`json:terrain-s1-w1-b2`), χωρίς αλλαγή σχήματος/reader. Εύρημα για όλα τα ράφια: ίδια bytes με νέα συνταγή έμεναν
  με την παλιά εγγραφή ⇒ αιώνιο ξαναψήσιμο. Το `uploadMissing` ανανεώνει πλέον μόνο τα μεταδεδομένα (πρότυπο
  ActionCache/CAS του Bazel).
- **2026-11-22** — **Β6.9 Α** (§14.9): τριμερής `minorShown` (`'all' | 'some' | 'none'`) από το `thinMinorContours`. Στο
  `'none'` η λεζάντα και η περιγραφή δηλώνουν μόνο τις κύριες, και μια σημείωση περιθωρίου λέει ότι οι ενδιάμεσες
  φαίνονται σε ευρύτερη προβολή και στο 3Δ. Το «στο PDF» του handoff **δεν** γράφτηκε, γιατί δεν επαληθεύεται.
- **2026-11-22** — **Β6.8 ζωντανός έλεγχος της βαθμονόμησης ✅** (§14.8): παραγωγή `6d81873`, TEST-2, πραγματικό +
  συνθετικό σε 360/640/768 + 3Δ. Πραγματικό ίδιο (0,1 m · 6 ζώνες)· συνθετικό 2 ζώνες, αραίωμα μόνο στα 360. Διόρθωση
  μεθόδου: στενεύεται το `section[data-terrain-preview]`, όχι το `stage`. Ανοιχτό: το υπόμνημα όταν αραιώνονται **όλες**
  οι ενδιάμεσες.
- **2026-11-22** — **Β6.8 ζωντανή δοκιμή + βαθμονόμηση** (§14.8): προεπισκόπηση TEST-2 με το πραγματικό «ΔΟΚΙΜΗ Κτίριο Β»
  και το συνθετικό σε 360/640/960 ✅. Εύρημα: το «barcode» του συνθετικού το έφτιαχναν οι **ζώνες** (χρώμα ανά γραμμή).
  `MIN_SPACING_PX` 6 → 8· οι ενδιάμεσες γίνονται όρια ζωνών μόνο αν η ζώνη ενός διαστήματος είναι ≥ 24 px
  (`LISTING_TERRAIN_MAP_MIN_BAND_WIDTH_PX`, `intermediateBandsNarrow`). Το πραγματικό τοπογραφικό μένει ίδιο (0,1 m, 6 ζώνες).
  `meshTriangleGradients` εξήχθη από το αραίωμα (ένας υπολογισμός κλίσης ανά τρίγωνο για αραίωμα **και** ζώνες).
  Tests 6 σουίτες **84/84** ✅ (με έγκριση) · CHECK 3.28 ✅.
- **2026-11-22** — **Β6.8** (§14.8): ισοϋψείς χωρίς «barcode». Το διάστημα επιλέγεται από την **πυκνότητα στην οθόνη**
  (90 % του εμβαδού ≥ 6 px στα 480 px), όχι μόνο από το ανάγλυφο. Οι ενδιάμεσες **αραιώνουν τοπικά**, σε διαδρομές, εκεί που
  στριμώχνονται, και οι κύριες μένουν πάντα (OS/USGS/swisstopo). Το υπόμνημα το λέει. Οι ζώνες υψομέτρων πατούν σε
  ζωγραφισμένα επίπεδα με όριο 10. Ο εντοπισμός τριγώνου βγήκε από το `tin-sampler` σε κοινό `triangle-locator`. Tests
  80/80 (+1958 ευρύτερα) · μεταλλάξεις 5/5 · 3.28 ✅. Ζωντανή δοκιμή: εκκρεμεί.
- **2026-11-22** — **Β6.7** (§14.7): η προεπισκόπηση του «Βελτίωσε» δείχνει την ΙΔΙΑ σκηνή «Κάτοψη | 3Δ» με τη δημόσια
  αγγελία. Το στιγμιότυπο έρχεται με τον χάρτη από την ίδια απάντηση του Worker και κρατά την ταυτότητά του όσο μένουν τα
  ίδια σημεία (αλλαγή πλάτους ⇒ καμία ανοικοδόμηση 3Δ). Tests 91/91 · μεταλλάξεις 2/2 · 3.34 ✅.
- **2026-11-21** — **Β6.6β** (ADR-777 §8.88.5 · §8.89.5): το μετρημένο ανάγλυφο είναι το **τρίτο χωρικό μέσο** — σήμα
  κάρτας «3D ανάγλυφο» (`Mountain`), τελευταίο κατά σειρά (το «ΕΝΑ σήμα» μένει), και το φίλτρο «Μόνο με 3D» το πιάνει χωρίς
  δεύτερη διατύπωση. Κριτής ο ίδιος `presentableTerrain` με την καρτέλα. Έρευνα: Land id «3D tour» = πτήση πάνω από το
  έδαφος· LandWatch «virtual tour» = «Matterport ή 3D tour». Tests 2.979 · μεταλλάξεις 2/2 · πύλες ✅.
- **2026-11-21** — **Β6.6α** (§14.6): η πηγή «Τοπογράφος: … · αποτύπωση …» σε ΕΝΑ σημείο — `TerrainSurveyCredit`
  (κείμενο + μορφή ημερομηνίας), καταναλωτές η δημόσια αγγελία και το «Βελτίωσε» (`PublishedTerrainSummary`). Κλειδί
  `listing-detail:terrain.survey`· διαγράφηκαν τα `terrain-survey:current.survey` και `terrain.panel.survey`. Ο ιδιοκτήτης
  βλέπει πλέον την πηγή με την ίδια (μικρή, ήπια) τυπογραφία με τον αγοραστή. Tests 172/172 · πύλες ✅.
- **2026-11-21** — **Β6.6** (§14.6): καρτέλα «Ανάγλυφο» στη δημόσια αγγελία — το στιγμιότυπο κατεβαίνει μόνο όταν ανοίξει,
  με ακύρωση· τοπογράφος και αριθμοί από την κάρτα αμέσως· ονομασμένα «δεν φόρτωσε» (με επανάληψη) και «δεν μπορεί να
  εμφανιστεί» (χωρίς). Χάρτης και 3Δ ως τεμπέλικες επιφάνειες (CHECK 3.34, σφράγιση 119 → 121 με «ΝΑΙ» Giorgio).
  Tests 310/310 · μεταλλάξεις 3/3 · πύλες ✅.
- **2026-11-21** — **Β6.5** (§14.5): θεατής 3Δ εδάφους (κύβος του viewer, τροχιά με ποντίκι/αφή/πληκτρολόγιο, καρέ κατ'
  απαίτηση, υπερβολή 1×/2×/3× με ένδειξη) + `TerrainViewStage` «Κάτοψη | 3Δ». Η πλαισίωση του viewer μετακόμισε στο
  `src/lib/three/camera/`. Ο κύβος δεν δείχνει πια βέλη κύλισης χωρίς `onRoll`. Tests 85/85 · μεταλλάξεις 4/4.
- **2026-11-21** — **Β6.4** (§14.4): αυστηρός αναγνώστης του δημοσιευμένου στιγμιοτύπου + καθαρή γεωμετρία 3Δ (επιφάνεια,
  τοιχώματα + πάτος, ισοϋψείς, κάθετη υπερβολή 1×/2×/3×). Tests 33/33 · μεταλλάξεις 2/2.
- **2026-11-21** — **Β6.3β** (§14.3β): ο κύβος σε αφή: `touch-action: none`, καθαρισμός σε `pointercancel` /
  `lostpointercapture`, σπίτι + βέλη μόνιμα ορατά χωρίς hover. Tests 23/23 · μετάλλαξη 1/1.
- **2026-11-21** — **Β6.3** (§14.3): ο κύβος πλοήγησης (5 αρχεία) + `canonical-views` + οι 4 τύποι κανονικών όψεων μετακόμισαν
  αυτούσια στο `src/lib/three/view-cube/`, με re-export μόνο όπου υπάρχει εισαγωγέας. Καμία αλλαγή συμπεριφοράς.
- **2026-11-21** — **Β6.2** (§14.2): κάτοψη με ακριβείς υψομετρικές ζώνες ανάμεσα στις ισοϋψείς (ίδια κλίμακα με το 3Δ) και
  διακόπτης «Υψόμετρα | Κλίσεις», με προεπιλογή τα Υψόμετρα. Tests 52/52 · μεταλλάξεις 2/2.
- **2026-11-21** — **Β6.1** (§14.1): μία υψομετρική κλίμακα για viewer και αγγελία στο `src/lib/terrain/elevation-ramp.ts`.
  Μετακόμισαν αυτούσια στο `src/lib/color/` η μεταφορά sRGB (από `color-math`) και το `trueColorToHex` (από `dxf-true-color`),
  με re-export από τις παλιές διαδρομές. Tests γραμμένα, **δεν** έτρεξαν. Status: Β6 σε εξέλιξη.
- **2026-11-21** — §13.10: ζωντανός έλεγχος του `topo-test-ridge.txt` (728 bytes) στο `a69a98c3`. Έγινε δεκτό χωρίς άρνηση
  «μικρό», στήλες Χ · Ψ · Ζ με βάση `surface`, 117 σημεία, μόνο προεπισκόπηση. Κώδικας δεν άλλαξε.
- **2026-11-20** — **Όριο 1 KB ανεβάσματος** (§13.10, ADR-054): «άδειο» = 0 bytes · `minSize` ανά καταναλωτή · τοπογραφικό
  `minSize={0}` (η κενότητα κρίνεται από τον αναγνώστη, inline) · αρνήσεις της ζώνης inline αντί για toast. Tests 15/15 ·
  μεταλλάξεις 3/3.
- **2026-11-20** — **Β4.11 Α tests ✅** (§13.10): 5 σουίτες 73/73· μεταλλάξεις φρουρού σταθερής (1 κόκκινο) και σήματος
  επιφάνειας (2 κόκκινα) πιάνονται.
- **2026-11-20** — **Β4.11 Α ζωντανά ✅** (§13.10, παραγωγή `7d2b099`): ridge-dense και zigzag ⇒ Χ · Ψ · Υψόμετρο, βάση `surface`,
  0 αντιφάσεις. Νέο εύρημα: όριο 1 KB του `FileUploadZone` απορρίπτει μικρό έγκυρο τοπογραφικό.
- **2026-11-20** — **Β4.11 Α** (§13.10): σωστή σειρά στηλών σε αρχείο χωρίς επικεφαλίδα — δείγμα σε όλο το αρχείο, φρουρός
  σταθερής στήλης, σήμα επιφάνειας (`survey-position-census`, μεταφορά από `survey-upload-preparation`), ορατή βάση της πρότασης.
  Tests γραμμένα, **δεν** έτρεξαν· ζωντανός έλεγχος μετά το deploy.
- **2026-10-29** — **Β4.7 κατάλοιπο ✅ (διαδρομές)**: το μπλοκ `API_ROUTES.OWNER_PROPERTIES` (γεννήθηκε εδώ μόνο με `TERRAIN`)
  ολοκληρώθηκε — όλοι οι πελάτες `/api/owner-properties/…` εισάγουν από εκεί (ADR-245 Decision Log 2026-10-29).
- **2026-10-29** — **Β4.7 κατάλοιπο ✅**: οι 4 χειρόγραφοι αναγνώστες `'__new__'` για **ακίνητο** περνούν στο SSoT
  `lib/properties/unsaved-property` — `api/properties/[id]` PATCH · `PropertyDetailsContent` (auto-save) · `usePropertyMediaCounts` (2×)
  → `isPersistedPropertyId` · `UnitQuickCreateSheet` → `UNSAVED_PROPERTY_ID`. Το audit βρήκε **5 ακόμη** εκτός λίστας:
  `property-mutation-gateway` (4 φρουροί) · `usePropertyMutationImpactGuard` → `isPersistedPropertyId`. Και **τρίτο αντίγραφο της τιμής**:
  `UNSAVED_PROPERTY_ID` = `DRAFT_ENTITY_ID` (`lib/draft-entity-id`, ADR-777 §8.31.12) · `NEW_PROPERTY_SELECTION_ID` = `UNSAVED_PROPERTY_ID`.
  Τα `'__new__'` κτιρίου/μέλους/διεύθυνσης μένουν σκόπιμα.
- **2026-10-26 (v26)** — **Β4.9 ✅** (§13.9): η ενότητα «Τοπογραφικό» στο «Βελτίωσε την αγγελία σου» (μόνο γη)· κοινό πάνελ
  `components/terrain/survey-import/` (αρχείο · στήλες/μονάδες · «αυτό θα δει ο αγοραστής» · Δ2 · δημοσίευση · «δημοσιευμένο τώρα»)·
  στατιστικά αγοραστή `TerrainStatsList` · αρνήσεις ανάγνωσης με την πράξη · γραμμές που παραλείφθηκαν με αριθμό · νέος χώρος
  ονομάτων `terrain-survey` · ο πίνακας στηλών του viewer μετακόμισε (ADR-650 v43) · `CLIENT_REFUSALS` · όριο φόρτωσης (3.34).
- **2026-10-26 (v25)** — **Β4.8 ✅ κλειστό** (§13.8): διορθώθηκε η μπαγιάτικη σημείωση «δεν έγινε `generate:i18n-types`»
  (έγινε στο `e3a90fa7`, CHECK 3.33)· όσα περνούν στο Β4.9 καταγράφηκαν ρητά. Μόνο τεκμηρίωση.
- **2026-10-26 (v24)** — **Β4.8 υπο-βήμα 5γ ✅** (§13.8): η προεπισκόπηση (ετυμηγορία της πόρτας + χάρτης) σε Web Worker
  πάνω στο υπάρχον RPC — σημεία ως μεταφερόμενο `Float64Array`, αποτύπωση στη μνήμη του Worker ανά κλειδί (η αλλαγή πλάτους
  δεν ξανατριγωνίζει), `latestOnly`, δίχτυ = ίδιος κώδικας. Χάρτης «παλιός αλλά δηλωμένος» όσο έρχεται ο νέος· ετυμηγορία
  μόνο για τα τρέχοντα σημεία. Ετικέτες σε pixels οθόνης (κλάσεις πλάτους + πάτωμα 12 px, SSoT με την κάτοψη ορόφου —
  ADR-907). `TerrainPreview` (όψη)· τη θέση του στη φόρμα τη φέρνει το Β4.9. RPC: `transferOf` + `WORKER_RPC_DISPOSED` +
  κοινός ψεύτικος Worker (ADR-884 §4.14). Μεταλλάξεις 12/12.
- **2026-10-26 (v23)** — **Β3.6 ζωντανά ✅** (§13.8): Εφαρμογή · λυμένες · κόμβος 3Δ · Ctrl+Z · «Επίλυση όλων» + ένα
  Ctrl+Z. Δύο ευρήματα διορθώθηκαν: φόρμα κάτω από τη λίστα (το «Εφαρμογή» κρυβόταν) και `<p>` → `<div role="group">`
  στο `ResolveAllBar` (σφάλμα hydration «2 issues»), με φρουρό εμφώλευσης DOM στη σουίτα.
- **2026-10-26 (v22)** — **Β4.8 βήμα Β3.6** (§13.8): επίλυση διασταυρούμενων ασυνεχειών (Civil 3D Higher / Lower /
  Average / Specify) ως **κανόνας** `Breakline.crossingResolutions` που εφαρμόζει ο ένας resolver σε κάθε χτίσιμο
  (επιβιώνει από το `rebuiltBreakline`), αντιστοίχιση ζεύγος + θέση ≤ 10 mm, αποφάσεις που δεν εφαρμόζονται πια
  αναφέρονται· `SetTopoBreaklinesCommand.resolve/unresolve`· QA χωρίς τις λυμένες· φόρμα με προεπισκόπηση z / μετατόπισης /
  κλίσης, «Επίλυση όλων», λυμένες ορατές· η 3Δ γραμμή περνά από τον κόμβο (`breaklinesAsCarried`). Σημείο αποτύπωσης ⇒
  υπερισχύει η μέτρηση· Α14 (εξαίρεση σημείου). Ζωντανά εκκρεμεί (ADR-650 v42).
- **2026-10-26 (v21)** — **Β4.8 βήμα Β3 ✅** (§13.8, Β3.0–Β3.5): η λίστα «Ασυνέχειες επιφάνειας» — Zoom To SSoT
  (`focusTopoReviewTarget`), ζεύγος σύγκρουσης (`keptBreaklineId`), undo (`SetTopoBreaklinesCommand`), μάτι + focus
  (`topo-breakline-display-store`, 2Δ + 3Δ + ribbon + hint, αποθηκεύεται), πάνελ πάνω σε `buildBreaklineInventory` με τα
  ίδια flags με το QA (ADR-650 v41 · ADR-040). Μετονομασία `resolveAutoBreaklineCandidateWorld` → `resolveTopoLineWorld`·
  `topoStateSignature` δομικά πλήρες. Ζωντανά ✅ (Chrome)· ανοιχτά Α10–Α12· Β3.6 (Resolve Crossing) προαιρετικό.
- **2026-10-25 (v20)** — **Β4.8 βήμα Β2 ✅** (§13.8): οι δεσμευμένες ασυνέχειες στην 3Δ — λεξιλόγιο σε ορατά px (+ fix Ε2),
  παύλα σε px οθόνης στο fat line, `TopoBreaklineLayer` με CPU κοπή στη στάθμη του `'topo'` scope, εκτός stencil parity,
  ομαδοποίηση των topo layers (ADR-650 v40 · ADR-452). Καταγράφηκαν Α3 (το trim του ADR-452 δεν τρέχει σε κοπή μόνο εδάφους) και Α9.
- **2026-10-25 (v19)** — **Β4.8 υπο-βήμα 5β ✅** (§13.8): μετρήσεις σε σκέτο Node + LoAF στον viewer — ο CDT < 1 ms στα
  δεδομένα του viewer, η δημοσίευση 10k–29k 166–479 ms ⇒ worker **μόνο** στο 5γ, καμία αλλαγή στον viewer. Νέα βήματα
  ορατότητας ασυνεχειών (Γ → Β1 → Β2 → Β3)· **Γ ✅**: το hint του εργαλείου παράγεται από το store (ADR-650 v38)· **Β1 ✅**: οι ασυνέχειες φαίνονται στην κάτοψη, μοτίβο = πηγή του z, + fix προβολής 2 overlays (ADR-650 v39).
- **2026-10-25 (v18)** — **Β4.8 βήμα Τ.3 ✅ viewer** (§13.8): QA `breakline-conflict` πάνω στην αναφορά του **ενός**
  τριγωνισμού (`getTopoBuildReport`, όροφος 1 του memo)· κανένα εύρημα κρυφό κάτω από ανοχή, ζώνες Δz κοινές με τα διπλά
  σημεία· i18n el/en (ADR-650 v36). Η προεπισκόπηση ιδιοκτήτη ⏸️: η φόρμα δεν στέλνει ακμές θραύσης (μετρημένο).
- **2026-10-25 (v17)** — **Β4.8 βήμα Τ ✅** (§13.8): ο τριγωνισμός του `buildTin` έγινε Delaunator + Constrainautor
  με ίδιο API (ADR-650 v35)· τεμνόμενες ακμές θραύσης → κόμβος + αναφορά αντιφάσεων (`buildTinWithReport`) αντί για
  τις σιωπηλές τρύπες του `cdt2d`· αφαιρέθηκε το `cdt2d`. Παράπλευρα: η κοπή στο κοίλο όριο (ADR-718) διορθώθηκε.
- **2026-10-24 (v16)** — **Β4.8 υπο-βήματα 3–4 ✅** (§13.8): tokens `--terrain-slope-*` + παλέτα· `TerrainContourMap` (SVG ·
  πίνακας κλάσεων που είναι και το υπόμνημα του χρώματος · υπόμνημα συμβόλων με `MapRampLegend` `kind: 'symbol'` · i18n
  `listing-detail:terrain.map`). Κεντρικοποιήσεις: `useSvgFragmentId` · `hatchTilePathData`.
- **2026-10-24 (v15)** — **Β4.8 σε εξέλιξη** (§13.8): υπο-βήματα 1–2 ✅ — ένα σπίτι για `snapScaleBarLength`, `tinBoundaryLoops`, `normalizeTextAngle` στο `lib`· `frame` στο αποτέλεσμα του builder/κριτή· σημάνσεις σημείων στην προετοιμασία· καθαρό μοντέλο χάρτη (`terrain-map-*`).
- **2026-10-24 (v14)** — **Β4.7 ✅** (§13.7): client τοπογραφικού · θύρες ανά κάτοχο (καθαρές) · ανάγνωση αρχείου με
  windows-1253 · πολιτική μονάδας «δηλωμένη / προτεινόμενη / ρωτιέται» · hook εισαγωγής· ο `parseTopoPoints` μένει στον viewer.
  Κεντρικοποιήσεις: κριτής δήλωσης · `namedRefusalOf` · ανακοίνωση διαδοχής · `OWNER_PROPERTIES` · `UNSAVED_PROPERTY_ID`.
- **2026-10-24 (v13)** — **Β4.4 ✅** (§13.6): ο κριτής εδάφους εξήχθη σε καθαρό `terrain-source-selection` με ρητό τύπο
  οντότητας· `dossierTerrainSource` (ζώνη ασφαλείας κατόχου)· η γραμμή ιδιοκτήτη δημοσιεύει το έδαφος του φακέλου μόνο για γη.
- **2026-10-24 (v12)** — **Β4.6 ✅** (§13.5): `files_personal` `create` → `publicationBornAbsent()` · `update` →
  `publicationCustodyUnchanged()` (ίδιες καθολικές συναρτήσεις με το `/files`)· emulator Π9 · άγκυρα Κ6 · μεταλλάξεις 2/2.
- **2026-10-24 (v11)** — **Β4.3+5 ✅ — φάση γ** (§13.4): πόρτα ιδιοκτήτη `POST /api/owner-properties/[ownerPropertyId]/terrain` πάνω στον
  ίδιο κινητήρα· υποκείμενο φακέλου (`publish-owner-property-material.ts`), προκάτοχοι φακέλου χωρίς νέο ευρετήριο,
  `refreshOwnerListingAfterMediaChange`, κωδικός `TERRAIN_NO_DOSSIER`, γραμμές 3.76.
- **2026-10-23 (v10)** — **Β4.3+5 φάση β ✅** (§13.4): κοινός κώδικας εδάφους `server/listing-terrain/terrain-upload.server.ts`· η πηγή
  εδάφους γεννιέται σε δύο σπίτια (`TerrainSourceHome`: εταιρικό ακίνητο | φάκελος ιδιοκτήτη)· η εταιρική πόρτα 212 → 114 γρ.
  Η γενίκευση της επιλογής πηγής πήγε στο Β4.4.
- **2026-10-23 (v9)** — **Β4.3+5 φάση α ✅** (§13.4): ένωση Β4.3 + Β4.5 (απόφαση Giorgio). Ο κοινός κορμός του ADR-909
  έγινε κινητήρας δύο κηδεμονιών στο `src/server/listing-material/` (θύρα υποκειμένου, γενική γέννηση, συλλογή από τον
  δράστη)· το `publishPropertyMaterial` είναι πλέον το εταιρικό υποκείμενο με την ίδια υπογραφή.
- **2026-10-23 (v8)** — **Β4.2 ✅** (§13.3): `judgeListingTerrainSource` (μία ετυμηγορία· την καλεί ήδη η πόρτα,
  αφαιρέθηκε η δήλωσή της από το `derivationOwners` της 3.105) · `prepareSurveyUpload` + `surveyFactsOf` (συμπίπτοντα
  και αντιφατικά σημεία) · `suggestSurveyUnit` (ΕΓΣΑ'87 / έκταση) · `surveyFileKindOf` · περιοχή χρήσης EPSG:2100 στο
  `greek-grid`. Το μοντέλο SVG πήγε στο Β4.8.
- **2026-10-23 (v7)** — **Β4.1β ✅** (§13.2): καθαρός scanner σημείων DXF (`scanDxfSurvey` + `scaleSurveyPoints`) στο
  `lib`, πάνω στα φύλλα `src/lib/dxf/*` (re-exports)· ο viewer αναθέτει και κρατά μόνο την πολιτική μονάδων του.
  Διορθώσεις: εκθέτης σε DXF real · `$INSUNITS` 17 · 21–24.
- **2026-10-23 (v6)** — **Β4 ξεκίνησε** (§13): απόφαση δεύτερης πόρτας ιδιοκτήτη πάνω στον ένα κορμό, πλάνο 11
  υποβημάτων. **Β4.1α ✅**: parsers πινάκων στο `src/lib/terrain/survey-import/` με re-exports· κριτής επικεφαλίδων =
  `parseTopoField`· διόρθωση του `detectDelimiter` για ελληνικά CSV (`cellPurity`).
- **2026-10-23 (v5)** — **Β3β ✅**: `PublicListing.terrain` (κρίκος σχήματος 26, κριτής `readStoredTerrain`), τρίτο
  κεφάλι του δημόσιου ραφιού (ψήσιμο από την κανονική πηγή, gzip, κάρτα στα metadata), ο ένας binder
  `withPublishedTerrain`, **CHECK 3.105** (ένας γραφέας · πόρτα με `refresh` · ένας ψήστης) και `withPublishedTerrain`
  στη 3.76, μηνύματα i18n el/en των 13 κωδικών με άγκυρα Σ5 (§12).
- **2026-10-23 (v4)** — **Β3α ✅**: πόρτα `POST /api/properties/[id]/terrain` πάνω στον κοινό κορμό του
  ADR-909, συμβόλαιο πηγής v1, δήλωση Δ2, κλειστή λίστα κωδικών, γραμμή `MATERIAL_DOORS` (§11). Το Β3
  χωρίστηκε σε Β3α/Β3β λόγω των staged αρχείων του ADR-919.
- **2026-10-23 (v3)** — **Β2 ✅**: συμβόλαιο + builder του `ListingTerrainSnapshot` στο
  `src/lib/terrain/publication/` (§10). Απόφαση: χωρίς απλοποίηση mesh και χωρίς νέα εξάρτηση.
- **2026-10-23 (v2)** — **Β1 ✅**: ο καθαρός πυρήνας εδάφους μετακινήθηκε στο `src/lib/terrain/` και το S-H
  στο `src/lib/geometry/planar-polygon-clip.ts`, με re-export από τις παλιές διαδρομές (§9).
- **2026-10-23 (v1)** — Δημιουργία (Β0). Έρευνα web για τους μεγάλους παίκτες, τα δημόσια DEM και τις
  άδειες. SSoT audit του τοπογραφικού πυρήνα (ADR-650), της δημοσίευσης ADR-909, του σχήματος αγγελίας
  και των όρων δόμησης. Αποφάσεις Giorgio Δ1–Δ3. Status PROPOSED, χωρίς κώδικα.
