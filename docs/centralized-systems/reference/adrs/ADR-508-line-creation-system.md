# ADR-508 — Line Creation System (Δημιουργία Γραμμών στο DXF Viewer — «ανώτεροι από την AutoCAD»)

> **Status:** 🟡 RESEARCH COMPLETE — Q&A ΑΝΟΙΧΤΟ (research §2 ολοκληρωμένη· διευκρινιστικές ερωτήσεις σε εξέλιξη, μία-μία)
> **Date:** 2026-06-20
> **Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
> **Author:** Giorgio + agent
> **Related:** ADR-507 (Hatch Creation), ADR-505 (Unified Export), ADR-501 (DXF grip multi-arm), ADR-107 (grip size SSoT), ADR-040 (canvas performance), ADR-001 (Select component)

---

## 1. Πλαίσιο / Problem Statement

Ο Giorgio θέλει να ενσωματώσουμε στην υπο-εφαρμογή **DXF Viewer** **όλες** τις λειτουργίες δημιουργίας
γραμμών που έχουν οι μεγάλοι παίκτες (AutoCAD, BricsCAD, Fusion/Onshape) — **όλους τους τύπους γραμμών, όλους
τους τρόπους εισαγωγής, όλους τους αυτοματισμούς και όλες τις σύγχρονες «μαγικές» λειτουργίες** — και να τις
ξεπεράσουμε. Στόχος: **να είμαστε ανώτεροι και από την AutoCAD**.

### 1.1 Σημερινή κατάσταση στον κώδικά μας (τι υπάρχει ήδη)

| Δυνατότητα | Κατάσταση | Πηγή |
|---|---|---|
| Εργαλείο `line` (απλή γραμμή) | ✅ Υπάρχει | `DrawingTool` union, `hooks/drawing/useUnifiedDrawing.tsx` |
| Εργαλείο `polyline` (πολυγραμμή) | ✅ Υπάρχει | `DrawingTool` union |
| Εργαλεία `xline` (άπειρη) + `ray` (ημι-άπειρη) | ✅ Υπάρχουν | `DrawingTool` union, `xline-ray-preview-helpers.ts` |
| Εργαλεία `rectangle`, `polygon` | ✅ Υπάρχουν | `DrawingTool` union |
| Τύπος οντότητας `LineEntity` (`lineWidth`, `lineStyle`) | ✅ Ορισμένος | `types/entities.ts:20` |
| Τύπος `PolylineEntity` / `LWPolylineEntity` (`closed`, `constantWidth`, `elevation`) | ✅ Ορισμένος | `types/entities.ts:28/36` |
| Τύπος `SplineEntity` | ✅ Ορισμένος (κυρίως από DXF import) | `types/entities.ts:162` |
| Τύπος `XLineEntity` / `RayEntity` | ✅ Ορισμένοι | `types/entities.ts:569/577` |
| Βοηθοί `useLineParallel`, `useLinePerpendicular` | ✅ Υπάρχουν | `hooks/drawing/` |
| Μηχανή έλξεων (OSNAP-like), getImmediateSnap, ortho αναφορά | ✅ Υπάρχει | `BimCharacteristicSnapEngine`, `bim-ortho-reference` |
| Πολυγραμμή με τόξα (arc segments σε pline) | ❌ Δεν επιβεβαιώθηκε | — |
| Εργαλείο `mline` / διπλή-πολλαπλή παράλληλη γραμμή | ❌ Δεν υπάρχει | — |
| Εργαλείο σχεδίασης `spline` (fit/CV) | ⚠️ Τύπος υπάρχει, drawing tool όχι | — |
| Δημιουργία/διαχείριση **γραμμικών στυλ** (dashed/center/hidden…) με UI | ❌ Δεν επιβεβαιώθηκε ως πλήρες | — |
| Σύγχρονοι «έξυπνοι» αυτοματισμοί (auto-constraint, command preview, AI palette) | ❌ Δεν υπάρχουν | — |

**Συμπέρασμα:** Έχουμε γερά θεμέλια (βασικά εργαλεία + έλξεις + ortho). Λείπει το «μεγάλο πακέτο» των τύπων
γραμμών, των γραμμικών στυλ και — κυρίως — των **σύγχρονων έξυπνων αυτοματισμών** που θα μας κάνουν ανώτερους.

---

## 2. Έρευνα: Πώς οι μεγάλοι παίκτες δημιουργούν γραμμές

*(Πηγές: Autodesk AutoCAD Help 2020-2026, CADTutor, Peachpit, mycadsite, sourcecad, BricsCAD/Bricsys, Fusion 360 & Onshape docs, imaginit, novedge — λίστα στο τέλος.)*

### 2.1 Τύποι γραμμών (line entity types)

| Τύπος | Εντολή | Τι είναι | Σημείωση |
|---|---|---|---|
| **Απλή γραμμή** | `LINE` (L) | Διαδοχικά ευθύγραμμα τμήματα· κάθε τμήμα = ξεχωριστή οντότητα | Επιλογές: `Close`, `Undo` |
| **Πολυγραμμή** | `PLINE` (PL) | Πολλά τμήματα = **μία** οντότητα· μπορεί να έχει πλάτος & τόξα | Η ναυαρχίδα — επιλογές §2.6 |
| **Lightweight polyline** | (LWPOLYLINE) | Βελτιστοποιημένη μορφή pline· σταθερό πλάτος, elevation | Default στη σύγχρονη AutoCAD |
| **Κατασκευαστική (άπειρη)** | `XLINE` (XL) | Γραμμή άπειρη και προς τις δύο κατευθύνσεις | Για βοηθητικές/χαράξεις· σε non-plot layer |
| **Ακτίνα (ημι-άπειρη)** | `RAY` | Άπειρη μόνο προς μία κατεύθυνση | Βοηθητική χάραξη |
| **Πολλαπλή/παράλληλη** | `MLINE` (ML) | Πολλές παράλληλες γραμμές μαζί (π.χ. τοίχος) με «style» (offsets/χρώματα) | Multiline Style· κορυφές justification (top/zero/bottom) |
| **Διπλή γραμμή** | `DLINE` (σε variants) | Δύο παράλληλες γραμμές ταυτόχρονα | Απλούστερο MLINE |
| **Spline (καμπύλη)** | `SPLINE` (SPL) | Ομαλή καμπύλη NURBS· **fit points** (περνά από σημεία) ή **control vertices** (πλαίσιο ελέγχου) | `SPLINEDIT`, `PEDIT→Spline` |
| **Ορθογώνιο / πολύγωνο** | `RECTANG`, `POLYGON` | Κλειστές πολυγραμμές· πολύγωνο: εγγεγραμμένο/περιγεγραμμένο, n πλευρές | |
| **Τόξα μέσα σε pline** | `PLINE→Arc` | Εναλλαγή line/arc μέσα στην ίδια οντότητα | Παράμετροι: Angle/Center/Direction/Radius |
| **Έλικα (3D)** | `HELIX` | Σπειροειδής 3D γραμμή | Εκτός 2D scope προς το παρόν |

### 2.2 Γραμμικά στυλ / μοτίβα γραμμής (linetypes)

**Έτοιμα στυλ (built-in):** Continuous, Dashed (DASHED/DASHED2/DASHEDX2), Dotted (DOT), Center
(CENTER/CENTER2), Hidden (HIDDEN/HIDDEN2/HIDDENX2 — διαφορετική πυκνότητα), Phantom, Dashdot, Border, Divide.

**Δύο κατηγορίες:**
- **Απλό linetype (simple):** συνδυασμός παύλας/κενού/κουκκίδας. Π.χ. `ANSI` διακεκομμένη.
- **Σύνθετο linetype (complex):** ενσωματώνει **κείμενο** (π.χ. γραμμή αερίου με «GAS», περίφραξη με «X») ή
  **σχήμα** (`.SHX`: μόνωση, βέλη ροής, τοπογραφικά σύμβολα).

**Μορφή ορισμού (`.LIN` αρχείο):**
```
*PatternName, περιγραφή
A, dash1, dash2, ...        ; θετικό=παύλα, αρνητικό=κενό, 0=κουκκίδα
```
- Με κείμενο: `["GAS",STANDARD,S=.1,R=0,X=0,Y=-.05]` — `S=` ελέγχει το μέγεθος όταν height=0.
- Με σχήμα: αναφορά σε `.SHX` shape.

**Κρίσιμες παράμετροι κλίμακας:**
- `LTSCALE` — γενική κλίμακα μοτίβου σε όλο το σχέδιο.
- `CELTSCALE` — κλίμακα μοτίβου ανά αντικείμενο.
- `PSLTSCALE` — κλίμακα μοτίβου ανά viewport (paper space).
- **Συχνό λάθος:** «οι hidden/center γραμμές φαίνονται συνεχείς» = λάθος LTSCALE σε σχέση με το μέγεθος σχεδίου.

**Πάχος γραμμής (lineweight):** ανεξάρτητο από linetype· είτε «ByLayer» είτε ρητή τιμή (mm)· εμφάνιση
ελέγχεται από διακόπτη LWT.

### 2.3 Τρόποι εισαγωγής σημείων (point input methods)

| Τρόπος | Παράδειγμα | Τι κάνει |
|---|---|---|
| **Απόλυτες συντεταγμένες** | `100,50` | Σημείο από την αρχή (0,0) |
| **Σχετικές συντεταγμένες** | `@30,0` | Μετατόπιση από το προηγούμενο σημείο (`@` = «σχετικά») |
| **Πολικές σχετικές** | `@5<45` | Απόσταση 5 υπό γωνία 45° από το προηγούμενο σημείο |
| **Direct Distance Entry** | (σύρε προς τα δεξιά) + `3000` | Δείχνεις κατεύθυνση με τον κέρσορα, πληκτρολογείς **μόνο** το μήκος |
| **Dynamic Input (F12)** | πεδία δίπλα στον κέρσορα | Πληκτρολογείς απόσταση/γωνία χωρίς να κοιτάς command line· Tab μεταξύ πεδίων |

**Δυναμικά πεδία:** Στη σύγχρονη ροή ο χρήστης σχεδόν ποτέ δεν πληκτρολογεί `@` — δείχνει κατεύθυνση και
γράφει το μήκος (Direct Distance), ή χρησιμοποιεί τα heads-up πεδία (μήκος + γωνία, Tab για εναλλαγή).

### 2.4 Βοηθήματα ακρίβειας & αυτοματισμοί (drawing aids)

| Βοήθημα | Πλήκτρο | Τι κάνει |
|---|---|---|
| **Ortho mode** | F8 | Κλειδώνει τον κέρσορα σε οριζόντια/κατακόρυφη μόνο |
| **Polar tracking** | F10 | Δείχνει «μαγνητικές» κατευθύνσεις ανά γωνία (π.χ. κάθε 15°/30°/45°/90°) με tooltip απόστασης/γωνίας |
| **Object Snap (OSNAP)** | F3 | Κολλάει σε χαρακτηριστικά σημεία υπαρχόντων αντικειμένων |
| **Object Snap Tracking** | F11 | Τραβάει «μονοπάτια ευθυγράμμισης» από osnap σημεία (π.χ. «10 πάνω από τη γωνία») |
| **Snap & Grid** | F9 / F7 | Κουμπωτό πλέγμα + οπτικό grid |

**Πλήρης λίστα Object Snaps (έλξεις):** Endpoint (άκρο), Midpoint (μέσο), Center (κέντρο), Geometric Center
(γεωμετρικό κέντρο πολυγώνου), Node (κόμβος/σημείο), Quadrant (τεταρτημόρια κύκλου), Intersection (τομή),
Apparent Intersection (φαινομενική τομή), Extension (προέκταση), Insertion (σημείο εισαγωγής),
**Perpendicular** (κάθετο), **Tangent** (εφαπτόμενο), **Nearest** (πλησιέστερο), **Parallel** (παράλληλο).

**Object Snap Tracking + Direct Distance σε συνδυασμό:** ο «μαγικός» τρόπος της AutoCAD — π.χ. ξεκίνα γραμμή
10 μονάδες πάνω από τη γωνία ορθογωνίου: κάνε hover στη γωνία → τράβα πάνω → γράψε `10`.

### 2.5 Έξυπνοι περιορισμοί (parametric / geometric constraints)

**Γεωμετρικοί περιορισμοί** (η γραμμή «θυμάται» σχέσεις): Coincident (συμπίπτουν), Collinear (συνευθειακές),
Concentric, Equal (ίσες), Fix (καρφωμένο), **Horizontal**, **Vertical**, **Parallel**, **Perpendicular**,
Smooth, **Tangent**, Symmetric.

- **Inferred constraints (συναγόμενοι):** εφαρμόζονται **καθώς σχεδιάζεις** — π.χ. αν τελειώσεις γραμμή πάνω
  σε άκρο άλλης, μπαίνει αυτόματα Coincident· αν είναι σχεδόν οριζόντια, μπαίνει Horizontal. (Όριο: δεν
  συνάγει fix/collinear/equal/concentric/symmetric.)
- **AUTOCONSTRAIN:** εφαρμόζει περιορισμούς σε επιλεγμένο σύνολο **μαζικά**, με ανοχές (απόσταση για
  coincident/tangent/collinear, γωνία για horizontal/vertical/parallel/perpendicular).
- **Διαστατικοί περιορισμοί (dimensional):** μήκος/γωνία ως παράμετρος → αλλάζεις τον αριθμό, αλλάζει η γραμμή.

### 2.6 Επιλογές πολυγραμμής (PLINE options)

`Arc` (εναλλαγή σε τόξο: Angle/Center/Direction/Radius/Second pt), `Close` (γνήσιο κλείσιμο — «συγκόλληση»
άκρων, όχι απλό «ίδιο σημείο»), `Width` (πλάτος edge-to-edge, μπορεί να μειώνεται → βέλη), `Halfwidth`,
`Length` (νέο τμήμα δεδομένου μήκους στην ίδια κατεύθυνση), `Undo` (αναίρεση τελευταίου τμήματος).

### 2.7 Επεξεργασία γραμμών (modify) & έξυπνες λαβές (grips)

**Εντολές τροποποίησης:** Offset (παράλληλη σε απόσταση/μέσω σημείου), Trim (κόψιμο στην τομή), Extend
(προέκταση μέχρι όριο), **Lengthen** (ακριβές μήκος: Delta/Percent/Total/Dynamic), Join (ένωση τμημάτων),
Fillet (στρογγύλεμα γωνίας με τόξο· `Polyline` option σε όλες τις γωνίες μαζί), Chamfer (λοξότμηση), Break
(σπάσιμο σε 1 ή 2 σημεία), Stretch (τέντωμα με crossing window), Move/Copy/Rotate/Scale/Mirror/Array.

**Πολυλειτουργικές λαβές (multifunctional grips)** — η σύγχρονη «μαγική» επεξεργασία:
- Λαβή άκρου γραμμής: **Stretch** ή **Lengthen** (πληκτρολογείς τιμή· μπροστά=προσθήκη, πίσω=αφαίρεση).
- Λαβή κορυφής πολυγραμμής: Stretch / **Add Vertex** / Remove Vertex / **Convert to Arc**.
- Λαβή μέσου τμήματος: **Add Vertex** / Convert to Arc.
- Λαβή μέσου τόξου: **Convert to Line**.
- Hover στη λαβή → εμφανίζεται μενού επιλογών (ή δεξί κλικ).

### 2.8 Σύγχρονες «μαγικές» / AI λειτουργίες (το «ανώτεροι από AutoCAD»)

| Λειτουργία | Από | Τι κάνει |
|---|---|---|
| **Rubber-band preview** | όλοι | Ζωντανό «λάστιχο» από το προηγούμενο σημείο στον κέρσορα + δυναμικές διαστάσεις |
| **Command preview** | AutoCAD | Προεπισκόπηση αποτελέσματος (offset/trim/fillet) **πριν** το κλικ |
| **Selection cycling** | AutoCAD | Επικαλυπτόμενες γραμμές → λίστα επιλογής ποια εννοείς |
| **Rollover tooltips** | AutoCAD | Hover σε γραμμή → tooltip με ιδιότητες (μήκος, γωνία, layer) |
| **Command autocomplete / autocorrect** | AutoCAD | Πληκτρολογείς εντολή → προτάσεις/διόρθωση τυπογραφικών |
| **Auto-constraint inference + cursor indicators** | Fusion/Onshape | Δείκτες δίπλα στον κέρσορα δείχνουν τι περιορισμό θα μπει· **Shift = αγνόησέ τον** |
| **Smart Blocks (AI)** | AutoCAD 2024-2026 | Εντοπίζει επαναλαμβανόμενη γεωμετρία → προτείνει μετατροπή σε block |
| **The Quad (AI palette)** | BricsCAD | Παλέτα στον κέρσορα που **μαθαίνει** τις εντολές σου & προσαρμόζεται στο επιλεγμένο αντικείμενο |
| **Manipulator** | BricsCAD | Ένα widget: move/rotate/copy/mirror μαζί, κατά άξονα |
| **Copy/Move Guided (AI)** | BricsCAD | Εντοπίζει γειτονικές γραμμές ως οδηγούς → align/flip/snap/trim αυτόματα |
| **Predictive cursor (ML)** | BricsCAD | Προβλέπει την επόμενη κίνησή σου |

### 2.9 Πού μπορούμε να είμαστε ΑΝΩΤΕΡΟΙ από AutoCAD (ευκαιρίες)

1. **Ζωντανό «έξυπνο φάντασμα»** που δείχνει ταυτόχρονα: μήκος, γωνία, σχέση με γειτονικές γραμμές, και τι
   έλξη/περιορισμό θα κουμπώσει — με καθαρό μοντέρνο UI (έχουμε ήδη ghost/snap infrastructure στο BIM).
2. **Auto-constraint inference από την πρώτη μέρα** (η AutoCAD το έχει «κρυμμένο»/προαιρετικό· εμείς default-on,
   κομψό, με Shift-override όπως Onshape).
3. **Ένα ενιαίο «έξυπνο εργαλείο γραμμής»** που καταλαβαίνει μόνο του αν θες line/polyline/wall ανάλογα με το
   context (mirror του Quad αλλά απλούστερο).
4. **Καθαρό, σύγχρονο web UX** (heads-up δυναμικά πεδία, χωρίς command-line μυσταγωγία) — προσβάσιμο σε μη-CAD χρήστες.
5. **Άμεση διαλειτουργικότητα DXF** (σωστά linetypes/lineweights round-trip — δουλεύουμε ήδη στο ADR-505 export).

---

## 3. Αποφάσεις (Q&A — 🟡 ΑΝΟΙΧΤΟ, μία ερώτηση τη φορά)

> Οι ερωτήσεις γίνονται **μία-μία** στον Giorgio με απλά λόγια & παραδείγματα. Κάθε απάντηση καταγράφεται εδώ
> πριν τεθεί η επόμενη ερώτηση.

| # | Ερώτηση (απλά) | Απάντηση Giorgio | Επίπτωση στο σχέδιο |
|---|---|---|---|
| Q1 | Κύριος/προεπιλεγμένος τρόπος εισαγωγής όταν τραβάς γραμμή (και οι 3 διαθέσιμοι); | **Σύρε & γράψε μόνο το μήκος** (Direct Distance Entry) | Προεπιλεγμένη ροή = Direct Distance: κατεύθυνση με κέρσορα + πληκτρολόγηση μήκους. Τα δυναμικά πεδία (μήκος/γωνία με Tab) + πληκτρολόγηση συντεταγμένων (@dx,dy / @d<a) = δευτερεύοντες/διαθέσιμοι. Το input layer πρέπει να γεφυρώνει direct-distance → γωνία από κέρσορα (συνεργασία με polar του Q2). |
| Q2 | Σε ποιες γωνίες κουμπώνει μαγνητικά η γραμμή από μόνη της (προεπιλογή); | **Κάθε 15°** (πυκνό polar tracking) | Default polar increment = 15° (0/15/30/45/60/75/90…). Ορθογώνιες (0/90) καλύπτονται αυτόματα. Εμφάνιση: οδηγός ευθυγράμμισης + tooltip γωνίας. Toggle on/off + αλλαγή increment από ένα πλήκτρο/status bar. Συνεργάζεται με Direct Distance (Q1): ο μαγνήτης δίνει τη γωνία, ο χρήστης το μήκος. |
| Q3 | Ποιες έλξεις (snaps) σε υπάρχουσες γραμμές είναι ανοιχτές εξαρχής; | **Πλήρες έξυπνο σετ** | Default OSNAP = endpoint, midpoint, center, intersection, perpendicular, tangent, extension. Τα υπόλοιπα (nearest, quadrant, node, insertion, apparent intersection, parallel, geometric center) διαθέσιμα αλλά off by default. Πιθανή επαναχρήση `BimCharacteristicSnapEngine` + `getImmediateSnap` (ήδη στον κώδικα) — επιβεβαίωση κάλυψης ανά snap-type στην υλοποίηση. Οπτικοί δείκτες ανά τύπο (□ άκρο, △ μέσο, ○ κέντρο, ✕ τομή, ⊥ κάθετο, ◌ εφαπτόμενο, ┄ προέκταση). |
| Q4 | Οι γραμμές «θυμούνται» σχέσεις (παράλληλη/κάθετη/ίση) όταν μετακινείς μία; | **Υβριδικό** — default ανεξάρτητες, με δυνατότητα κλειδώματος σχέσης | Default = «απλή γεωμετρία» (dumb, snap-and-forget). Προαιρετικά ο χρήστης **κλειδώνει** γεωμετρικό περιορισμό (parallel/perpendicular/equal/collinear/horizontal/vertical/tangent/coincident) → η σχέση διατηρείται σε μετακίνηση/περιστροφή. Απαιτεί: (α) προαιρετικό constraint store ανά entity, (β) constraint solver (lightweight), (γ) UI «κλείδωμα σχέσης». Επαναχρήση φιλοσοφίας associative BIM (ADR-492/494). Inferred-constraint indicators (Onshape-style, Shift=αγνόηση) = πιθανό add-on σε επόμενη φάση. ⚠️ Όχι full-parametric sketch solver στη φάση 1. |
| Q5 | Πόσο πλούσια βιβλιοθήκη γραμμικών στυλ (linetypes); | **Πλήρης** — έτοιμα + σύνθετα (κείμενο/σύμβολο) + δημιουργία νέων | Καταλόγος linetypes: continuous, dashed (+2/x2), hidden, center, phantom, dash-dot, border, divide, dot. **Σύνθετα:** linetype με ενσωματωμένο κείμενο (π.χ. «ΑΕΡΙΟ») & με σύμβολο/shape (π.χ. περίφραξη). **Custom:** UI δημιουργίας νέου στυλ (μοτίβο παύλα/κενό/κουκκίδα + προαιρετικό κείμενο/σύμβολο). Απαιτεί: `data/linetype-catalog.ts` (PAT/LIN-derived), LTSCALE/CELTSCALE-like κλίμακα, canvas dash renderer + κείμενο/σύμβολο κατά μήκος, DXF round-trip (`LTYPE` table + entity `linetype`/`ltscale`). Lineweight (πάχος) ξεχωριστά από linetype. ⚠️ Σύνθετα με shape (.SHX) = πιο βαριά → πιθανή υπο-φάση. |
| Q6 | Ένα έξυπνο κουμπί ή ξεχωριστά κουμπιά ανά τύπο; | **Και τα δύο** — ξεχωριστά κουμπιά + ένα προαιρετικό «Έξυπνη Γραμμή» | Ribbon: διατήρηση/ολοκλήρωση ξεχωριστών εργαλείων (Γραμμή, Σπασμένη/Πολυγραμμή, Άπειρη/XLINE, Ακτίνα/RAY, Καμπύλη/Spline, Τοίχος, + Πολλαπλή) **ΣΥΝ** νέο «✨ Έξυπνη Γραμμή» mode που μαντεύει: 2 κλικ→γραμμή, πολλά κλικ→πολυγραμμή, σχεδίαση πάνω/δίπλα σε τοίχο→προτείνει τοίχο. Η «Έξυπνη Γραμμή» = orchestrator πάνω από τα υπάρχοντα tools (δεν αντικαθιστά — delegates). Default ribbon δείχνει τα σαφή κουμπιά· το ✨ είναι το «ανώτερο από AutoCAD» add-on. ⚠️ Η ευρετική (heuristic) του ✨ = ξεχωριστό SSoT module· πρέπει να είναι ντετερμινιστική & με δυνατότητα override (Tab/πλήκτρο για «όχι, θέλω αυτό»). |
| Q7 | Τι δείχνει ζωντανά το «φάντασμα» της γραμμής πριν το κλικ; | **Πλήρες** — μήκος + γωνία + σχέση με γειτονικές + τι θα κουμπώσει | Live preview overlay: μήκος (mm), γωνία (°), σχέση με γειτονικές γραμμές (π.χ. «∥ παράλληλη με τοίχο Α», «⊥ κάθετη»), και ένδειξη τι snap/constraint θα κουμπώσει (□ άκρο, △ μέσο…). Επαναχρήση υπάρχοντος ghost/preview pipeline (memory: `getImmediateSnap`, BIM ghost). ADR-040-safe: το preview είναι leaf overlay, **όχι** subscription σε orchestrators. Η «σχέση με γειτονικές» = ζωντανός ανιχνευτής (parallel/perpendicular/collinear με ανοχή) — ίδια ευρετική με Q4 inferred constraints. ⚠️ Φόρτος: υπολογισμός σχέσης μόνο για κοντινές γραμμές (spatial cull), throttled στο RAF. |
| Q8 | Πόσο έξυπνες οι λαβές (grips) σε υπάρχουσα γραμμή; | **Πλήρες έξυπνο** — multifunctional grips | Επιλογή γραμμής → grips· hover σε λαβή → μενού: Σύρε (stretch), Επιμήκυνση/Lengthen (πληκτρολόγηση π.χ. +500· μπροστά=προσθήκη, πίσω=αφαίρεση), Πρόσθεσε/Αφαίρεσε κορυφή (πολυγραμμή), Μετέτρεψε τμήμα σε τόξο↔γραμμή. Επαναχρήση grip infrastructure ADR-501 (multi-arm/group move) + ADR-107 (grip size SSoT). Λαβές: άκρα + μέσα τμημάτων. ADR-040-safe (grips = leaf). «Convert to arc» απαιτεί polyline με bulge per-segment → καλύπτεται από Q9. |
| Q9 | Πολυγραμμή με ίσια + καμπύλα τμήματα σε ένα αντικείμενο; | **Ναι, πλήρες** — εναλλαγή γραμμή↔τόξο + μεταβλητό πλάτος | Το `PolylineEntity` επεκτείνεται με **per-segment bulge** (AutoCAD bulge factor, group code `42`) ώστε κάθε τμήμα να είναι γραμμή ή τόξο, + μεταβλητό πλάτος ανά κορυφή (start/end width, group `40/41` → βέλη/tapers). Tool: επιλογή «Τόξο»/«Γραμμή» κατά τη σχεδίαση (PLINE Arc/Line modes §2.6). Canvas renderer: γραμμή vs arc-from-bulge. DXF round-trip με bulge. Επηρεάζει: grip «convert to arc» (Q8), hit-testing, length/area μέτρηση. ⚠️ Μεγάλη αλλαγή στο entity model + renderer + DXF I/O → δική της φάση. Επαναχρήση μαθηματικών bulge↔arc (πιθανό υπάρχον arc geometry SSoT). |
| Q10 | Ποιες σύγχρονες «μαγικές»/AI λειτουργίες μπαίνουν πρώτες; | **ΟΛΕΣ** οι 4 προτεινόμενες: (1) προεπισκόπηση πριν το κλικ, (2) info με hover, (3) έξυπνη αντιγραφή/μετακίνηση με οδηγούς, (4) επιλογή όταν συμπίπτουν | Φάσεις «magic»: (1) **Command preview** — ghost αποτελέσματος πριν το κλικ (line/offset/extend). (2) **Rollover tooltip** — hover σε γραμμή → μήκος/γωνία/layer/linetype (επαναχρήση rollover αν υπάρχει). (3) **Guided copy/move** — αντιγραφή/μετακίνηση με auto-align/snap/trim σε γειτονικές (BricsCAD Copy Guided· reuse snap engine + ghost). (4) **Selection cycling** — overlapping hit → λίστα επιλογής (reuse hit-test stack). **Υπόλοιπα modern (επόμενες φάσεις, όχι πρώτα):** AI palette τύπου Quad (μαθαίνει συνήθειες), command autocomplete/autocorrect. ⚠️ Όλα ADR-040-safe (leaf overlays, event-time reads). |
| Q11 | Γενικό εργαλείο πολλαπλών παράλληλων γραμμών (MLINE) ξεχωριστά από τον Τοίχο; | **Ναι, γενικό εργαλείο** «Πολλαπλή γραμμή» (καθαρά γεωμετρικό) | Νέο tool «Πολλαπλή/Διπλή γραμμή»: ορισμός πλήθους γραμμών (2+) + αποστάσεις/offsets + justification (top/zero/bottom όπως MLINE style). Καθαρά γεωμετρικό (όχι δομικό σαν Wall). Νέος τύπος οντότητας (ή MLINE-style entity με style offsets) + canvas renderer (n παράλληλες) + DXF (MLINE ή ως ομάδα polylines). Επαναχρήση parallel-offset μαθηματικών (`useLineParallel`). Διακριτό από Wall (που είναι BIM/structural). Χρήσεις: δρόμοι, κανάλια, αγωγοί. ⚠️ MLINE DXF είναι σύνθετο (MLINESTYLE table)· εναλλακτική = γράψιμο ως n LWPOLYLINE για διαλειτουργικότητα. |
| Q12 | Τρόπος ορισμού καμπύλης (spline); | **Και τα δύο** — fit points (περνά από σημεία) + control vertices (σημεία ελέγχου) | Spline drawing tool με 2 modes: (Α) **fit points** — NURBS που περνά ακριβώς από τα σημεία (default, διαισθητικό), (Β) **control vertices** — control frame που «τραβά» την καμπύλη. Το `SplineEntity` υπάρχει ήδη (κυρίως DXF import) → επέκταση/ενεργοποίηση για drawing. NURBS evaluation SSoT (de Boor/Bézier). Grips: μετακίνηση fit point ή CV (με «Convert fit↔CV» όπως SPLINEDIT). DXF round-trip (`SPLINE` group codes: knots/CVs/fit pts). ⚠️ Μαθηματικά NURBS = νέο SSoT module· canvas tessellation σε segments (adaptive). |
| Q13 | Πλήρες πακέτο επεξεργασίας γραμμών σε αυτό το έργο; | **Ναι, όλα τώρα** — offset/trim/extend/join/break/fillet/chamfer | Το ADR καλύπτει ΚΑΙ τη δημιουργία ΚΑΙ την επεξεργασία. Modify suite: **offset** (παράλληλη σε απόσταση/μέσω σημείου), **trim** (κόψιμο στην τομή), **extend** (προέκταση μέχρι όριο), **lengthen** (ακριβές μήκος — ήδη στο Q8 grip), **join** (ένωση), **break** (σπάσιμο σε 1/2 σημεία), **fillet** (στρογγύλεμα γωνίας με τόξο· option «όλες οι γωνίες πολυγραμμής»), **chamfer** (λοξότμηση). Κάθε εντολή με command-preview (Q10 #1). Επαναχρήση intersection/projection geometry SSoT. ⚠️ Μεγάλο εύρος → ξεχωριστή ομάδα φάσεων μέσα στο ADR. Trim/extend χρειάζονται γρήγορο intersection engine (spatial index). |
| Q14 | Συμπεριφορά μετά το τέλος μιας γραμμής; | **Μένει ενεργό** — συνεχής σχεδίαση, ESC για έξοδο | Μετά το Enter (τέλος γραμμής) το tool παραμένει ενεργό για την επόμενη (CAD-standard repeat). ESC = έξοδος στο «επιλογή». Ισχύει για όλα τα line tools. Right-click/Enter μπορεί να επαναλαμβάνει & την τελευταία εντολή. ⚠️ Καθαρό state reset μεταξύ διαδοχικών γραμμών (να μην «κολλάνε» tempPoints) — ήδη υπάρχει `DrawingState` (`tempPoints`, `currentPoints`). |
| Q15 | Πώς εμφανίζονται οι διαστάσεις (μονάδες); | **Μέτρα με δεκαδικά** (π.χ. 3.25 m) | Display μήκους/απόστασης = μέτρα με δεκαδικά (default 2-3 δεκαδικά). Internal αποθήκευση παραμένει σε mm (συνέπεια με υπάρχον entity model). Κεντρικός formatter (πιθανό υπάρχον i18n number/unit util) — **όχι** hardcoded «m». Πιθανή ρύθμιση δεκαδικών στο μέλλον. ⚠️ Input: ο χρήστης μπορεί να πληκτρολογεί σε m ή mm — ο parser να δέχεται και τα δύο (π.χ. «3.25» → m, «3250mm» → mm). |

> **Q&A status:** 🟢 ΚΛΕΙΣΤΟ (15 ερωτήσεις απαντημένες, 2026-06-20). Επόμενο: υλοποίηση κατά φάσεις (§4.8).

---

## 4. Αρχιτεκτονική (ΘΑ ΟΡΙΣΤΕΙ μετά το Q&A)

*Θα συμπληρωθεί όταν κλείσει το Q&A: τύποι οντοτήτων, modules (SSoT «μία γεωμετρία → canvas + DXF»),
ribbon/contextual UI, ADR-040 compliance, DXF writer/reader, φάσεις υλοποίησης.*

---

## 5. Πηγές έρευνας

- AutoCAD Help (Autodesk) 2020-2026: MLINE, SPLINE, AUTOCONSTRAIN, Inferred Constraints, 2D Polar Coordinates, Dynamic Input, Rollover Tooltips, Selection Cycling, What's New 2026 (Smart Blocks).
- CADTutor — Drawing Objects, Direct Distance Entry, Modifying Objects.
- Peachpit — Object Snaps/Ortho/Polar; Osnap modes; Grips Add Vertex.
- mycadsite, sourcecad, novedge, imaginit, scan2cad — osnaps, linetypes, custom linetypes με text/shapes.
- Engineering.com / skill-lync — Polylines (Arc/Close/Width/Halfwidth/Length/Undo), Extend/Lengthen/Join.
- Bricsys / BricsCAD — Quad, Manipulator, Copy Guided, Blockify, 2D AUTOCONSTRAIN, AI-driven tools, V26.
- Fusion 360 & Onshape docs/forums — auto-constraint inference, snapping indicators, Shift-to-ignore.

---

## 6. Changelog

- **2026-06-20** — Δημιουργία ADR. Ολοκλήρωση έρευνας §2 (τύποι γραμμών, linetypes, input methods, drawing aids,
  constraints, pline options, modify/grips, modern/AI features, ευκαιρίες υπεροχής). Καταγραφή σημερινής
  κατάστασης κώδικα §1.1. Q&A ανοιχτό — ξεκινά Q1.
