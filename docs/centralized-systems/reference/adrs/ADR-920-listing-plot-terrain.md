# ADR-920 — Τοπογραφικό στην αγγελία οικοπέδου: ανάγλυφο 3D, ισοϋψείς και ενδεικτικός όγκος δόμησης

| | |
|---|---|
| **Status** | 🟠 PROPOSED — 2026-10-23 · Β0 (αποφάσεις + πλάνο) ✅ · **Β1 (καθαρός πυρήνας στο `src/lib/terrain/`) ✅** · **Β2 (συμβόλαιο + builder στιγμιοτύπου) ✅** · **Β3α (πόρτα server) ✅** · **Β3β (κρίκος 26 + δημόσιο ράφι + CHECK 3.105 + i18n) ✅** · **Β4 σε εξέλιξη** (Β4.1α ✅ · Β4.1β ✅ · Β4.2 ✅ · Β4.3+5 ✅ · Β4.6 ✅ · Β4.4 ✅ · Β4.7 ✅ · **Β4.8 σε εξέλιξη**, §13) · Β5–Β8 δεν ξεκίνησαν |
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
- **Βέλη απορροής νερού** από το TIN.
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
| **Β4** | Εισαγωγή από τον ιδιοκτήτη στη φόρμα οικοπέδου (Δ2) — 11 υποβήματα (§13) | 🔄 Β4.1α ✅ · Β4.1β ✅ · Β4.2 ✅ · Β4.3+5 ✅ · Β4.6 ✅ · Β4.4 ✅ |
| **Β5** | Πόρτα δημοσίευσης από τον DXF Viewer | ⏳ |
| **Β6** | Θεατής: 2D SVG → 3D lazy | ⏳ |
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
| `contour-interval.ts` | `chooseContourConfig(relief)`: η **λεπτότερη** ισοδιάσταση της χαρτογραφικής κλίμακας (1·2·2,5·5 × 10ⁿ) με ≤ 30 ισοϋψείς. Κύρια κάθε 5η (κάθε 4η για την οικογένεια του 2,5). Τροφοδοτεί τον **ίδιο** `generateContoursFromSurface` |
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
αποτύπωμα των μέσων περιλαμβάνει τις πηγές, όχι τη συνταγή. Ίδιο ισχύει για το μοντέλο (ADR-845).
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

### 13.8 Β4.8 — μοντέλο SVG του χάρτη εδάφους *(σε εξέλιξη, 2026-10-24)*

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
**Ζωντανά: ΕΚΚΡΕΜΕΙ** — στις 2026-10-26 η πλοήγηση στο επίπεδο δοκιμής αποτύγχανε (Chrome γύριζε σε «νέα καρτέλα», `curl`
localhost:3000 → 403· dev server ξένης συνεδρίας). Σενάριο: λίστα → σύγκρουση 1,00/3,00 → «Μέσος όρος» → προεπισκόπηση
2,00 μ → Εφαρμογή → «λυμένες» + 3Δ γραμμή από τον κόμβο → Ctrl+Z → έγγραφο ταυτόσημο.

**Επόμενα**: ζωντανή επαλήθευση Β3.6 → **5γ** worker `TerrainPreview` → πύλες (μαζί 3.22) → κλείσιμο §13.8.

## Changelog
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
