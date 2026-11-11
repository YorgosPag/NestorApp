# ADR-937: Προσανατολισμός ακινήτου — πυξίδα 3×3, ηλιασμός στην αγγελία, πρόταση από κάτοψη και χάρτης

| Metadata | Value |
|----------|-------|
| **Status** | 🟡 ΓΡΑΜΜΕΝΟ 2026-11-11 — Φάσεις 0·Α·Β·Γ υλοποιημένες, **tests δεν έτρεξαν** (αναμένουν έγκριση), χωρίς οπτικό έλεγχο |
| **Date** | 2026-11-11 |
| **Category** | Properties / Listings / DXF-BIM / Maps |
| **Canonical Location** | `src/constants/orientation-compass.ts` · `src/lib/solar/` · `src/lib/geometry/{azimuth-orientation,polygon-azimuth}.ts` · `src/lib/property/{orientation-proposal,orientation-from-map}.ts` · `src/subapps/dxf-viewer/bim/orientation-proposal/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Related** | ADR-287 (λεξιλόγιο προσανατολισμού) · ADR-422 L7.2 (αζιμούθιο κουφωμάτων, θερμικά) · ADR-583 (βέλος Βορρά) · ADR-369 (`northRotation`) · ADR-650 (γεωαναφορά) · ADR-777 §8.56 (σύνορο χάρτη) · ADR-891 (υπόβαθρο) · ADR-920 Β4.9 (κατωφέρεια) · ADR-236 (πολυώροφα) |

---

## 1. Το ερώτημα

Ο χρήστης έβλεπε οκτώ πλήκτρα `Β · ΒΑ · Α · ΝΑ · Ν · ΝΔ · Δ · ΒΔ` και έπρεπε να ξέρει τι σημαίνει «ΝΔ» **και** πού είναι
ο Βορράς. Ο αγοραστής διάβαζε στην αγγελία «ΝΔ», ενώ αυτό που θέλει να μάθει είναι *πόσο ήλιο παίρνει το σπίτι*.

Απόφαση Giorgio: **μεικτό σύστημα** — το σύστημα προτείνει όπου έχει δεδομένα, ο άνθρωπος επιβεβαιώνει και έχει τον
τελευταίο λόγο· η δημόσια αγγελία δείχνει ηλιασμό σε απλή γλώσσα.

## 2. Απόφαση

| Φάση | Τι | Πού |
|---|---|---|
| **UI** | Πυξίδα 3×3 (Βορράς πάνω, πολλαπλή επιλογή, ολογράφως όνομα σε tooltip/`aria-label`, σύνοψη από κάτω) | `OrientationCompassGrid.tsx` · διάταξη `COMPASS_GRID_LAYOUT` |
| **0** | SSoT: θέση ήλιου, αζιμούθιο ⇄ προσανατολισμός, εξωτερική κάθετος ακμής → `src/lib` (τα αρχεία του dxf-viewer / terrain **επανεξάγουν**) | `lib/solar/solar-position.ts` · `lib/geometry/azimuth-orientation.ts` · `lib/geometry/polygon-azimuth.ts` |
| **Α** | Ηλιασμός στη δημόσια αγγελία: ώρες άμεσου ήλιου + πότε (πρωί/μεσημέρι/απόγευμα) σε χειμώνα · ισημερία · καλοκαίρι | `lib/solar/facade-sun-exposure.ts` · `ListingSunExposure.tsx` |
| **Β** | Πρόταση από την κάτοψη: ανοίγματα σε **εξωτερικούς** τοίχους πάνω στο όριο του overlay ακινήτου → εξωτερική κάθετος → αληθινός Βορράς → οκτάντας | `derive-property-orientations.ts` · `usePropertyOrientationProposal` · `OverlayOrientationProposal` (πάνελ overlay) · `PropertyOrientationProposalSlot` (καρτέλα) |
| **Γ** | Από τον χάρτη: ο άνθρωπος πατά το κτίριο (στρώση `buildings` του Protomaps) και τις πλευρές με ανοίγματα | `lib/property/orientation-from-map.ts` · `OrientationFromMapDialog` · `PropertyOrientationMapAction` |

### 2.1 Ηλιασμός (Φάση Α)
- Μια κατακόρυφη όψη «βλέπει» τον ήλιο όταν ύψος > 0 **και** γωνία ήλιου–καθέτου < 90°. Ένωση όψεων (μια στιγμή μετρά μία φορά). Δείγμα ανά 10′, **ηλιακή** ώρα (καμία ζώνη ώρας· μόνο το πλάτος αλλάζει το αποτέλεσμα).
- **Καμία νέα βιβλιοθήκη**: υπήρχε ήδη ο `computeSolarPosition` (±5°) του φωτισμού 3D. Η SunCalc (BSD-2) δεν χρειάστηκε.
- Υπολογίζεται **κατά την απόδοση** από `PublicListing.orientations` + `position.point` — καμία αλλαγή στην προβολή / Firestore.
- Χωρίς όψεις **ή** χωρίς γνωστή θέση ⇒ η ενότητα δεν αποδίδεται. Η σημείωση «εκτίμηση· χωρίς σκιές γειτονικών κτιρίων» είναι μέρος της ενότητας (το ίδιο όριο ομολογεί και το Redfin Sunscore / Shadowmap).

### 2.2 Πρόταση από κάτοψη (Φάση Β)
- Νέο πεδίο `Property.orientationProposal = { values, source, northAssumed, proposedAt }` — **ποτέ** δεν γράφει το `orientations`. Σχήμα + αναγνώστης: `lib/property/orientation-proposal.ts`· ρητό στο PATCH (`.passthrough()`)· `null` = απόρριψη (`PROPERTY_CLEARABLE_FIELDS`).
- Ροή: πάνελ overlay `kind:'property'` → «Πρόταση στο ακίνητο» (ρητή πράξη) → καρτέλα ακινήτου: «Πρόταση από την κάτοψη: … [Εφαρμογή] [Απόρριψη]». Η «Εφαρμογή» αλλάζει **μόνο** τη φόρμα· ο άνθρωπος αποθηκεύει. Όταν η πρόταση συμπίπτει με το δηλωμένο, η λωρίδα σιωπά.
- Εξωτερικοί τοίχοι: `resolveExteriorWallIds` (εξήχθη από `useHeatLoadInputs` → `bim/geometry/exterior-wall-ids.ts`, ίδια απάντηση με τα θερμικά). Ανοχή «στο όριο» 0,6 m.
- Χωρίς γεωαναφορά ο Βορράς θεωρείται +Y και **λέγεται** (`northAssumed`).
- **Η κενή πρόταση λέει ΓΙΑΤΙ** (`FloorplanOrientationProposal.status`): `no-model` = καμία οντότητα τοίχου BIM στη σκηνή (σκέτες γραμμές DXF) · `no-envelope` = τοίχοι χωρίς αναγνωρισμένο εξωτερικό κέλυφος · `derived` = υπάρχει κέλυφος (οι `values` μπορεί να είναι κενές ⇒ «δεν βρέθηκαν ανοίγματα»). Το «δεν βρέθηκαν ανοίγματα» λέγεται **μόνο** όταν υπήρχε μοντέλο να ψάξει· η σημείωση `northAssumed` μόνο στο `derived`. Όπως Revit («Use Building Elements») και ArchiCAD (Energy Evaluation): ο προσανατολισμός βγαίνει **μόνο** από στοιχεία μοντέλου — καμία μαντεψιά από γραμμές σχεδίου. Στο `no-model` η λωρίδα δίνει τον επόμενο δρόμο: πλήκτρο «Τοίχοι από το σχέδιο» (ADR-929 / ADR-911 Φ3β) που στέλνει το **ίδιο** σήμα με το ribbon (`dxf:model-from-drawing-requested` → `ModelFromDrawingHost`) και διαβάζει την **ίδια** ετικέτα (`dxf-viewer-shell` `ribbon.commands.bim.wallsFromDrawing.label`) — όχι δεύτερος δρόμος, όχι δεύτερη ετικέτα.

### 2.3 Χάρτης (Φάση Γ)
- Τις πλευρές τις διαλέγει ο **άνθρωπος** — δεν είναι μαντεψιά του συστήματος ⇒ η «Εφαρμογή» γράφει κατευθείαν στη φόρμα (όχι σε πρόταση). Απόκλιση από το αρχικό σχέδιο, σκόπιμη: λιγότερες εγγραφές, ίδιος τελικός κριτής.
- Το περίγραμμα OSM (ODbL) **δεν** αποθηκεύεται· μόνο οι κατευθύνσεις.
- Κέντρο χάρτη = `Building.latitude/longitude`· χωρίς θέση το πλήκτρο είναι ανενεργό και το λέει. Ο διάλογος φορτώνεται με `next/dynamic` μόνο όταν ανοίξει.
- Δορυφορικό υπόβαθρο **δεν** υπάρχει στο μητρώο (ADR-891)· το διανυσματικό έχει περιγράμματα κτιρίων, που αρκούν.

## 3. Ευρήματα

1. ✅ **Ασυμφωνία πρόσημου Βορρά — ΔΙΟΡΘΩΘΗΚΕ 2026-11-11**: `geo-transform.ts` `forwardRigidMap` ορίζει `world = R(rotationDeg)·local` (αριστερόστροφα), άρα ο αληθινός Βορράς στη σκηνή είναι `(sin r, cos r)`· το `services/ifc/ifc-units.ts` `appendTrueNorth` έγραφε `(−sin r, cos r)` ⇒ καθρεφτισμένος Βορράς στο IFC για κάθε r ≠ 0. Κατά IFC4 το `IfcGeometricRepresentationContext.TrueNorth` είναι η κατεύθυνση του Βορρά **στο σύστημα του έργου**, και η σημασία του `Project.northRotation` ορίζεται από τον μετασχηματισμό της εφαρμογής (χάρτης, έδαφος, Φάση Β) ⇒ διορθώθηκε το IFC, όχι ο μετασχηματισμός. Η σημασία του πεδίου ζει πλέον σε **ΕΝΑ** φύλλο, `lib/geo/project-geo-frame.ts`, που το διαβάζουν ο μετασχηματισμός του viewer (`geoReferenceFromProject`) **και** ο εξαγωγέας IFC. Επιπλέον το IFC4 γράφει πλέον και **`IfcProjectedCRS` (EPSG:2100) + `IfcMapConversion`** (`services/ifc/ifc-georeference.ts`) — πού κάθεται το έργο στον κάνναβο, όχι μόνο πού είναι ο Βορράς (LoGeoRef 50, όπως Revit/ArchiCAD). Άγκυρες: `services/ifc/__tests__/ifc-georeference.test.ts` (IFC ≡ φύλλο + φυσική r = 90° ⇒ `(1, 0)`, συνεπές με την Κ3) και `geo-referencing/__tests__/project-geo-frame-agreement.test.ts` (φύλλο ≡ `forwardRigidMap`, μέσα στο subapp ώστε καμία εισαγωγή να μην περνά το σύνορο της CHECK 3.62). Μετάλλαξη του πρόσημου ⇒ 7 κόκκινα και στις δύο.
2. Το βέλος Βορρά του ADR-583 είναι χειροκίνητο και **δεν** διαβάζεται από πουθενά ως αληθινός Βορράς — η Φάση Β χρησιμοποιεί `Project.northRotation` (μέσω `GeoReference.rotationDeg`).
3. Ο `polygon-azimuth-utils` του ADR-422 υπέθετε «+Y = αληθινός Βορράς» για τα θερμικά — αμετάβλητο εδώ (εκτός εμβέλειας).

## 4. Όρια (καταγεγραμμένα)

- **Πολυώροφα**: η λωρίδα πρότασης και ο χάρτης εμφανίζονται μόνο για ακίνητο ενός επιπέδου — στα πολυώροφα το `orientations` είναι άθροισμα των ορόφων (ADR-236) και θα ξαναγραφόταν.
- Ηλιασμός χωρίς σκιές (γειτονικά κτίρια, ανάγλυφο, προεξοχές).
- Πλακίδια: ένα κτίριο κομμένο σε όριο πλακιδίου μπορεί να δώσει ψεύτικη ακμή — ο άνθρωπος απλώς δεν την επιλέγει.

## 5. Επαλήθευση

Tests (εγκρίθηκαν 2026-11-11) — **5 σουίτες / 36 tests πράσινα**, μαζί με το υπάρχον `terrain-downslope-orientation.test.ts`:
`lib/geometry/__tests__/azimuth-orientation.test.ts` · `lib/solar/__tests__/facade-sun-exposure.test.ts` ·
`subapps/dxf-viewer/bim/orientation-proposal/__tests__/derive-property-orientations.test.ts` ·
`lib/property/__tests__/orientation-from-map.test.ts`. Οπτικός έλεγχος: μόνο μετά από push (δεν τρέχει dev server).

## 6. Changelog

- **2026-11-11** — Δημιουργία. Πυξίδα 3×3 · Φάση 0 (SSoT σε `src/lib`, επανεξαγωγές στο dxf-viewer / terrain) · Φάση Α (ηλιασμός αγγελίας) · Φάση Β (πρόταση από κάτοψη + πεδίο `orientationProposal`) · Φάση Γ (χάρτης). Εύρημα §3.1 αναφέρθηκε, όχι διόρθωση.
- **2026-11-11** — Ολοκλήρωση: tests πράσινα (5/36) · τύποι i18n + shell slice ξαναπαράχθηκαν· το `/listing/[id]` **ξανασφραγίστηκε** 15.987 → 20.525 bytes (μετρημένο: +3.719 προϋπάρχουσα απόκλιση στο HEAD + 819 του ADR-937· SSR αντί `next/dynamic`, όπως `legality`/κατοικίδια — ο ηλιασμός είναι στοιχείο του ακινήτου στο πρώτο καρέ) · αφαιρέθηκε το νεκρό `ORIENTATION_OPTIONS` · **διορθώθηκε το πρόσημο του IFC `TrueNorth`** (§3.1) και προστέθηκε `IfcProjectedCRS` + `IfcMapConversion` με ΜΙΑ ανάγνωση των πεδίων (`lib/geo/project-geo-frame.ts`).
- **2026-11-11** — Ζωντανή διάγνωση: η λωρίδα στο DXF overlay («Ισόγειο» `lvl_9f2c7d41-…` → `flr_5c28e0b9-…`, `_AfrPolGO.dxf`) έλεγε «Δεν βρέθηκαν ανοίγματα» ενώ η κάτοψη δείχνει παράθυρα. Μετρημένο στο Firestore: `floorplan_walls` = 0 και `floorplan_openings` = 0 για τον όροφο (κατά `floorId`, `floorplanId`, `layerId`) ⇒ ο υπολογισμός ήταν σωστός, το **μήνυμα** παραπλανούσε (τα «παράθυρα» είναι γραμμές DXF). Προστέθηκε `status` (`no-model` · `no-envelope` · `derived`) στο `usePropertyOrientationProposal` και ένα μήνυμα ανά αιτία στο `OverlayOrientationProposal` (§2.2)· νέα κλειδιά `noModel` / `noEnvelope` (el + en), τύποι i18n ξαναπαράχθηκαν. Το `derivePropertyOrientations` αμετάβλητο.
- **2026-11-11** — Στο `no-model` πλήκτρο «Τοίχοι από το σχέδιο» (ίδιο σήμα + ίδια ετικέτα με το ribbon, §2.2). Άγκυρα της διακλάδωσης: `hooks/data/__tests__/usePropertyOrientationProposal.test.ts` (Κ1 `no-model` · Κ2 `no-envelope` · Κ3 `derived` με/χωρίς ανοίγματα · Κ4 `null`).
