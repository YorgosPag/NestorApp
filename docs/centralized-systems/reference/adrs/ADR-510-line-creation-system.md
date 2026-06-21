# ADR-510 — Line Creation System (Δημιουργία Γραμμών στο DXF Viewer — «ανώτεροι από την AutoCAD»)

> ⚠️ **Renumber 508→510 (2026-06-20):** οι αριθμοί ADR-508 (Unified Linear-Member Framing) & ADR-509 (Adaptive Entity Color) είχαν δεσμευτεί από άλλον agent. Αυτό το ADR μετονομάστηκε σε ADR-510.

> **Status:** 🟡 Φ2 RENDERING SSoT COMPLETE (UNCOMMITTED· Φ1 core committed `8ab4143a`) — spec v3. **Φ1** 🟢
> (Q2 polar 15°, Q3 OSNAP, E2 math, Q7 ghost angle). **Φ2 (Unified Linetype System, Revit-grade)** 🟡: SSoT audit
> βρήκε 3 ασύμβατα dash subsystems (ADR-358 mm / ADR-377 bim px-fixed / legacy enum px)· απόφαση Giorgio = **όλα
> zoom-scaled mm, μηδέν διπλότυπα**. ΟΛΟΚΛΗΡΩΘΗΚΕ rendering SSoT (Φ2A-D): ΕΝΑ catalog (27 mm patterns
> `linetype-iso-catalog` + `linetype-aliases.resolveAnyLinetype`) → ΕΝΑΣ resolver (zoom×LTSCALE×CELTSCALE) → ΟΛΟΙ
> οι consumers (DXF entity + 8 BIM renderers μέσω `bim-dash-resolver` + legacy `getDashArray`). ~250 jest GREEN.
> **Φ2E #1** 🟡 (selected-line contextual tab + linetype editing UI, Revit-grade dual-mode bridge — επιλεγμένη
> γραμμή εμφανίζει tab & επεξεργάζεται linetype/lineweight/color με undo, live registry dropdown). **🔴 ΕΚΚΡΕΜΕΙ:**
> Φ2E #2 (LTSCALE status-bar control + custom-creation pattern editor) + Φ2F (DXF LTYPE round-trip + persistence =
> Φ9) — orchestrator-scale το καθένα, επόμενη συνεδρία (δες HANDOFF). Επόμενο spec: **Φ3** (bulge+grips).
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

### 2.10 Επιπλέον υπαρκτοί αυτοματισμοί που ΔΕΝ είχαμε καλύψει ρητά (gaps — να μπουν)

*(Κυρίως από SketchUp inference engine + AutoCAD precision tools — πράγματα που λείπαν από την 1η έρευνα.)*

| Αυτοματισμός | Τι κάνει | Παράδειγμα |
|---|---|---|
| **Κλείδωμα άξονα με βελάκια** | Πλήκτρα ←/→/↑ κλειδώνουν κατεύθυνση χωρίς να βασίζεσαι στον μαγνήτη | Τραβάς γραμμή, πατάς → → κλειδώνει οριζόντια όσο σύρεις |
| **Shift-lock κατά μήκος ίχνους** | Κλειδώνεις μια κατεύθυνση και μετά δείχνεις άλλο σημείο ως αναφορά | «ευθεία με αυτή τη γραμμή, αλλά μήκος μέχρι εκείνη τη γωνία» |
| **«From» snap (offset από σημείο)** | Ξεκινάς μετρώντας από ένα σημείο αναφοράς | «10εκ μέσα από τη γωνία» |
| **Μέσο 2 σημείων (M2P)** | Κουμπώνει στο μέσο ανάμεσα σε δύο σημεία | Κέντρο πόρτας ανάμεσα σε 2 κολώνες |
| **Προσωρινά σημεία ίχνους** | Βοηθητικά σημεία που εμφανίζουν μονοπάτια ευθυγράμμισης | Ευθυγράμμιση με 2 μακρινά σημεία ταυτόχρονα |
| **Ισομετρική σχεδίαση** | Λειτουργία 2.5D iso | Σχέδιο σε ισομετρία |
| **Auto-close** | Αυτόματο κλείσιμο σχήματος | Πλησιάζεις την αρχή → «κλείσε;» |
| **Auto-trim/auto-join σε τομές & γωνίες** | Καθάρισμα γωνιών τοίχων αυτόματα (wall cleanup) | Δύο τοίχοι τέμνονται → καθαρή γωνία μόνη της |
| **Ελεύθερο χέρι (SKETCH)** | Σχεδίαση με το χέρι | Σκαρίφημα καμπύλης |
| **Ζωντανές συντεταγμένες (coordinate readout)** | Δείχνει X,Y του κέρσορα συνεχώς | Κάτω-κάτω: X=12.30 Y=4.50 |
| **Tab-to-lock στα δυναμικά πεδία** | Κλειδώνεις ένα πεδίο (μήκος ή γωνία) και αλλάζεις το άλλο | Κλειδώνεις 30°, αλλάζεις μόνο μήκος |
| **Reverse / Convert / Explode** | Αλλαγή φοράς, μετατροπή γραμμή↔πολυγραμμή, διάσπαση | Αντιστροφή κατεύθυνσης για linetype με βέλη |

### 2.11 Σύγχρονη AI που ΥΠΑΡΧΕΙ ήδη (για να ξέρουμε τι ΔΕΝ είναι πρωτότυπο)

- **AutoCAD 2026 / Autodesk AI:** Smart Blocks (AI detect & convert επαναλαμβανόμενης γεωμετρίας), **Markup
  Assist** (διαβάζει markup από PDF/εικόνα και τα εφαρμόζει), **Activity Insights** («τι άλλαξε» στη συνεδρία).
- **BricsCAD:** **AI Predict** / predictive Quad (ML που προβλέπει επόμενη κίνηση), Copy/Move Guided, Blockify.
- **Ακαδημαϊκή έρευνα (papers — ΟΧΙ shipped σε εργαλείο γραμμής):** **Text2CAD**, **CADialogue** (conversational
  CAD με κείμενο/φωνή/εικόνα), **NURBGen** (text→NURBS), CadVLM, cadrille — δηλαδή το «text-to-CAD» **υπάρχει σε
  πειράματα** αλλά **όχι** ως ζωντανό εργαλείο σχεδίασης γραμμής.

### 2.12 🚀 ΠΡΩΤΟΠΟΡΙΑΚΕΣ AI μαγείες — κανείς δεν τις έχει σε εργαλείο γραμμής ΑΚΟΜΗ

*(Εδώ γινόμαστε πραγματικά ανώτεροι. Ιδέες που σήμερα ΔΕΝ υπάρχουν shipped — ευκαιρία να είμαστε πρώτοι.
Σημ.: φιλοδοξία· κάθε μία θα γίνει ρητή απόφαση Q&A πριν μπει σε φάση.)*

| # | Μαγεία AI | Τι κάνει (απλά) | Παράδειγμα |
|---|---|---|---|
| **N1** | **Προβλεπτικό φάντασμα επόμενης γραμμής** | Όπως το autocomplete στο κινητό, αλλά για σχέδιο: μαντεύει την επόμενη γραμμή και τη δείχνει αχνά· Tab=αποδοχή | Σχεδίασες 3 πλευρές δωματίου → προτείνει την 4η για να κλείσει |
| **N2** | **Σχεδίαση με φυσική γλώσσα/φωνή** | Λες/γράφεις τι θες κι εμφανίζεται | «τοίχος 4μ παράλληλος στη βόρεια όψη, 20εκ από το παράθυρο» |
| **N3** | **«Ζωγράφισε το αποτέλεσμα»** | Δηλώνεις το ζητούμενο, η AI φτιάχνει τη γεωμετρία | «ορθογώνιο 20τμ εδώ» ή «κάνε αυτή τη γραμμή ίση με εκείνη» |
| **N4** | **Σημασιολογικές έλξεις** | Κουμπώνει σε «έννοιες», όχι μόνο σημεία | κέντρο δωματίου, άξονας συμμετρίας, μέση 2 κολωνών |
| **N5** | **Αυτο-θεραπεία ενώ σχεδιάζεις** | Κλείνει μικρο-κενά, σβήνει διπλές, ισιώνει στραβά live (με undo) | 2 γραμμές «σχεδόν» ακουμπάνε → τις ενώνει μόνη της |
| **N6** | **Έξυπνη επέκταση μοτίβου** | Βλέπει επανάληψη και προτείνει να τη συνεχίσει | Σχεδίασες 2 σκαλιά → «να βάλω τα υπόλοιπα μέχρι εκεί;» |
| **N7** | **Καθάρισμα ελεύθερου σκίτσου** | Τραβάς πρόχειρα με το χέρι → γίνεται τέλεια γεωμετρία | Στραβό τετράπλευρο → τέλειο ορθογώνιο με ίσιες γωνίες |
| **N8** | **Ζωντανός έλεγχος κανονισμού** | Σε προειδοποιεί ΕΝΩ σχεδιάζεις, πριν τελειώσεις | Τραβάς διάδρομο 70εκ → «κάτω από το ελάχιστο ΝΟΚ» |
| **N9** | **Αυτόματο layer + στυλ από πρόθεση** | Καταλαβαίνει τι σχεδιάζεις και βάζει σωστό layer/linetype μόνο του | Κρυφή ακμή → αυτόματα hidden linetype + σωστό layer |
| **N10** | **Προσωπικός co-pilot που μαθαίνει εσένα** | Θυμάται στυλ/πάχη/layers/αποστάσεις σου & τα προεπιλέγει | Πάντα βάζεις τοίχους 25εκ → προεπιλέγεται 25εκ |
| **N11** | **Ιχνηλάτηση από φωτογραφία/σκαρίφημα** | Βάζεις φωτο/σκαναρισμένη κάτοψη, η AI βρίσκει ακμές & κουμπώνεις πάνω | Φωτο χειρόγραφης κάτοψης → ξανασχεδιάζεις πάνω της |
| **N12** | **«Εξήγησέ μου / διόρθωσέ μου»** | Δείχνεις γραμμή & ρωτάς· η AI απαντά + προτείνει διόρθωση | «γιατί βγήκε στραβή;» → «λάθος snap· να το φτιάξω;» |
| **N13** | **Generative διάταξη από περιορισμούς** | Λες τι θες, προτείνει εναλλακτικές διατάξεις γραμμών/τοίχων | «σκελετός 3 δωματίων εδώ» → 3 προτάσεις |
| **N14** | **Σημασιολογικοί δεσμοί σε φυσική γλώσσα** | Κλειδώνεις σχέση με λόγια, χωρίς να ξέρεις «παραμετρικά» | «αυτή η γραμμή πάντα μισή από εκείνη» → μένει έτσι |
| **N15** | **Αυτόματη διαστασιολόγηση/ετικέτες** | Σχεδιάζεις γραμμές → μπαίνουν μόνες οι σωστές διαστάσεις & ενημερώνονται live | Τραβάς δωμάτιο → εμφανίζονται αυτόματα τα μήκη πλευρών |
| **N16** | **Geo/context-aware AI** | Ξέρει βορρά/ήλιο/όρια οικοπέδου & προτείνει ευθυγραμμίσεις | «ευθυγράμμισε με τον βορρά» / «μέσα στο όριο δόμησης» |

### 2.13 Εξωτικές/προχωρημένες λειτουργίες (adversarial γύρος 2 — να μπουν στο scope)

*(2ος γύρος έρευνας μετά από ερώτηση Giorgio «είσαι σίγουρος;». Πηγές: AutoCAD parametric/QuickCalc/dynamic
blocks, MicroStation SmartLine, Civil 3D feature lines, Rhino history/georeferencing, CADStudio 2DPlot.)*

| # | Λειτουργία | Τι κάνει | Πού δένει |
|---|---|---|---|
| E1 | **Παραμετρικοί διαστατικοί δεσμοί με τύπους** | Το μήκος/γωνία οδηγείται από εξίσωση· `D2 = 0.85·D` → αλλάζεις μία τιμή, αλλάζουν όλες οι εξαρτημένες | Επεκτείνει Q4 (υβριδικοί δεσμοί) → Parameters Manager |
| E2 | **Αριθμητικές πράξεις & υπολογιστής στα πεδία** | Γράφεις «1500+300» ή `(* 6 7)` ή χρήση QuickCalc ζωντανά κατά την εισαγωγή | Επεκτείνει Q1 (input) — parser με math |
| E3 | **Καμπύλες από μαθηματική συνάρτηση** | Polyline/curve από εξίσωση (ημίτονο, σπείρα, παραβολή) | Φ4 (spline) — equation curve mode |
| E4 | **SmartLine (line+arc+rounded/chamfer εν κινήσει)** | Ένα εργαλείο που αλλάζει vertex σε rounded/chamfered καθώς σχεδιάζεις | Επιβεβαιώνει Q9 + «✨ Έξυπνη Γραμμή» (Q6) |
| E5 | **Associative feature lines (με υψόμετρο)** | Γραμμές συνδεδεμένες με άξονα/προφίλ· αλλάζει ο άξονας → αλλάζουν· έχουν Z | Συγγενές Q4· χρήσιμο για στάθμες/κλίσεις |
| E6 | **Αυτόματες/συσχετισμένες διαστάσεις & fields** | Ετικέτα μήκους/εμβαδού που ενημερώνεται μόνη της όταν αλλάζει η γραμμή | Magic φάση· βλ. N15 |
| E7 | **Γεωαναφορά (georeferencing)** | Γραμμές σε πραγματικό σύστημα συντεταγμένων (GIS)· βορράς/προσανατολισμός | Βλ. N16· χρήσιμο για οικόπεδα/τοπογραφικά |
| E8 | **History-based associativity** | «Μνήμη» πράξης χωρίς πλήρες parametric (Rhino-style) | Ελαφρύτερη εκδοχή Q4 |
| E9 | **Scripting / API** | Προγραμματιστική δημιουργία γραμμών (AutoLISP-like) | Μελλοντικό· power users |
| E10 | **Αφή & χειρονομίες (touch/gestures)** | Σχεδίαση/zoom/pan με αφή σε tablet | UX φάση· web-friendly |

**Verdict (τίμιο):** Οι περισσότερες E1-E10 είναι **φυσικές επεκτάσεις** αυτών που ήδη αποφασίσαμε, όχι νέα
άγνωστα. Τα πιο αξιόλογα να μπουν ρητά: **E1** (formula-driven δεσμοί), **E2** (math στα πεδία — εύκολο & wow),
**E3** (equation curves), **E6** (auto-updating fields). Τα E7 (georeferencing) & E9 (scripting) = μελλοντικά.

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

> **Q&A status:** 🟢 ΚΛΕΙΣΤΟ — 16 ερωτήσεις (15 βασικές + Q16 στρατηγική AI). Πρωτοποριακές AI: όλες στο
> roadmap, 3 tiers (§4.9). Κάθε AI μαγεία = δική της απόφαση/φάση πριν υλοποιηθεί.

### 3.1 Πρωτοποριακές AI μαγείες — αποφάσεις (Q16+)

| # | Ερώτηση (απλά) | Απάντηση Giorgio | Επίπτωση |
|---|---|---|---|
| Q16 | Πώς χειριζόμαστε τις 13 πρωτοποριακές AI μαγείες; | **Όλες στο roadmap** — ο agent τις ιεραρχεί σε επίπεδα | Και οι 13 (N1-N13) μπαίνουν στο σχέδιο. Ιεράρχηση σε 3 tiers ανά εφικτότητα/κόστος → §4.9. Καμία δεν χάνεται· οι βαριές (LLM/CV) πάνε σε μελλοντικές φάσεις. Κάθε μία θα γίνει δική της απόφαση/φάση πριν υλοποιηθεί. |

---

## 4. Αρχιτεκτονική (ΟΡΙΣΤΙΚΗ μετά το Q&A)

### 4.1 Αρχή SSoT

**«Μία γεωμετρία → canvas + DXF + μέτρηση»** — η ίδια περιγραφή γραμμής/καμπύλης τροφοδοτεί canvas renderer,
DXF writer ΚΑΙ τα live measurements/preview, μέσω κεντρικών pure modules. Καμία διπλή υλοποίηση γεωμετρίας.

### 4.2 Μοντέλο οντοτήτων (επεκτάσεις)

| Entity | Αλλαγή | Q |
|---|---|---|
| `LineEntity` | + προαιρετικά `constraints?` (γεωμετρικοί δεσμοί), `linetype`/`ltscale`/`lineweight` | Q4, Q5 |
| `PolylineEntity` | + **per-segment bulge** (`vertices` → `{point, bulge?, startWidth?, endWidth?}[]`), arc segments | Q9 |
| `SplineEntity` | ενεργοποίηση για drawing· `mode: 'fit' \| 'cv'`, fit points / control vertices / knots | Q12 |
| **NEW** `MultiLineEntity` | n παράλληλες (offsets[], justification) ή γράψιμο ως n LWPOLYLINE σε DXF | Q11 |
| Όλα | `linetype` (Q5), `lineweight`, `ltscale` ως κοινά πεδία γραμμικών | Q5 |

### 4.3 Επίπεδο εισαγωγής & ακρίβειας (input/precision)

- **Direct Distance Entry = κύριο** (Q1): κατεύθυνση από κέρσορα + πληκτρολόγηση μήκους. Δευτερεύοντα:
  dynamic fields (μήκος/γωνία Tab) + συντεταγμένες (@dx,dy / @d<a).
- **Polar tracking 15°** default (Q2) + Ortho (0/90) ως υποσύνολο· toggle/increment από status bar.
- **OSNAP πλήρες σετ** default (Q3): endpoint/midpoint/center/intersection/perpendicular/tangent/extension.
- **Object Snap Tracking** (alignment paths) ως follow-up.
- **Parser μονάδων** (Q15): δέχεται m & mm, εμφάνιση σε m με δεκαδικά.

### 4.4 Modules — ομάδες (NEW/MOD)

| Ομάδα | Modules (ενδεικτικά) | NEW/MOD |
|---|---|---|
| Input/precision SSoT | `drawing/direct-distance-input.ts`, `drawing/polar-tracking.ts`, `snap/osnap-resolver.ts` (reuse `BimCharacteristicSnapEngine`), `units/length-format.ts` | NEW/MOD |
| Linetypes | `data/linetype-catalog.ts`, `rendering/linetype-dash-renderer.ts`, `linetype/complex-linetype-text-shape.ts`, `export` LTYPE table | NEW |
| Geometry SSoT | `geometry/bulge-arc.ts` (Q9), `geometry/nurbs-spline.ts` (Q12), `geometry/parallel-offset.ts` (reuse `useLineParallel`), `geometry/line-intersection.ts` (Q13) | NEW |
| Tools (δημιουργία) | ολοκλήρωση `line/polyline/xline/ray`, NEW `useSplineTool`, `useMultiLineTool`, NEW `useSmartLineTool` (Q6 orchestrator) | NEW/MOD |
| Tools (επεξεργασία) | `modify/offset.ts`, `trim.ts`, `extend.ts`, `join.ts`, `break.ts`, `fillet.ts`, `chamfer.ts` (Q13) | NEW |
| Grips | multifunctional grips (Q8) — reuse ADR-501 + ADR-107 | MOD |
| Constraints (υβριδικό) | `constraints/constraint-store.ts`, `constraints/solver.ts`, UI «κλείδωμα σχέσης» (Q4) | NEW |
| Magic/AI | `preview/command-preview.ts` (Q10.1), `ui/rollover-tooltip.ts` (Q10.2), `modify/guided-copy-move.ts` (Q10.3), `selection/cycling.ts` (Q10.4) | NEW |
| Live preview | `preview/line-ghost-overlay.ts` (μήκος+γωνία+σχέση+snap, Q7) — reuse ghost/`getImmediateSnap` | NEW |
| Ribbon/UI | `ui/ribbon/data/home-tab-draw.ts` (κουμπιά + ✨), contextual panels (linetype/width/constraint) | MOD |
| i18n | `i18n/locales/{el,en}/dxf-viewer*.json` | MOD |

### 4.5 ADR-040 compliance

- Όλα τα overlays (ghost/preview, rollover, snap indicators, command preview) = **leaf consumers** (μόνο leaf
  `useSyncExternalStore`)· **καμία** high-freq subscription σε `CanvasSection`/`CanvasLayerStack`.
- Event handlers διαβάζουν με getters (`getImmediateSnap`, `getImmediateTransform`) — όχι snapshots.
- Geometry computations = pure functions· caching όπου χρειάζεται (linetype dash, spline tessellation).

### 4.6 DXF round-trip

- Writer: `LINE`, `LWPOLYLINE` (με bulge `42`, widths `40/41`), `SPLINE`, `XLINE`, `RAY`, `MLINE`/n-polylines,
  `LTYPE` table (linetypes), entity `linetype`/`ltscale`/`lineweight`.
- Reader: αντίστοιχοι converters (`utils/dxf-entity-converters.ts`) — bulge→arc, spline knots/CVs, linetypes.
- Συνεργασία με ADR-505 (Unified Export).

### 4.7 «Ανώτεροι από AutoCAD» — οι διαφοροποιήσεις (από §2.9)

1. Live ghost με μήκος+γωνία+**σχέση γειτονικών**+snap (Q7) — όλα ταυτόχρονα, μοντέρνο UI.
2. Υβριδικοί έξυπνοι δεσμοί με Shift-override (Q4) — η ισχύς του parametric χωρίς την πολυπλοκότητα.
3. «✨ Έξυπνη Γραμμή» (Q6) — ένα εργαλείο που μαντεύει line/polyline/wall.
4. Καθαρό web UX (Direct Distance + dynamic fields, Q1) — χωρίς command-line μυσταγωγία.
5. Σωστό DXF round-trip linetypes/lineweights (§4.6).

### 4.8 Φάσεις υλοποίησης (πρόταση)

| Φάση | Περιεχόμενο | Q |
|---|---|---|
| **Φ1** | Input/precision SSoT (Direct Distance + polar 15° + OSNAP full) + live ghost basic (μήκος/γωνία) | Q1,Q2,Q3,Q7 |
| **Φ2** | Linetypes (έτοιμα) + lineweight + μονάδες m + contextual panel | Q5,Q15 |
| **Φ3** | Polyline με bulge (γραμμή↔τόξο) + multifunctional grips | Q8,Q9 |
| **Φ4** | Spline tool (fit+CV) + MultiLine tool | Q11,Q12 |
| **Φ5** | Modify suite (offset/trim/extend πρώτα, μετά join/break/fillet/chamfer) + command preview | Q10.1,Q13 |
| **Φ6** | Magic: rollover tooltip + guided copy/move + selection cycling | Q10.2,Q10.3,Q10.4 |
| **Φ7** | Υβριδικοί έξυπνοι δεσμοί (constraint store + solver + UI) + live «σχέση γειτονικών» στο ghost | Q4,Q7 |
| **Φ8** | «✨ Έξυπνη Γραμμή» orchestrator + σύνθετα linetypes (κείμενο/σύμβολο) | Q6,Q5 |
| **Φ9** | DXF round-trip πλήρες (LTYPE, bulge, spline, MLINE) | §4.6 |
| **Φ10** | Επόμενα modern: AI palette (Quad-style), command autocomplete/autocorrect, Object Snap Tracking | §2.8 |

### 4.9 Roadmap πρωτοποριακών AI μαγειών (Q16 — και οι 13, σε 3 επίπεδα)

**Tier A — «Τώρα» (ντετερμινιστικές/rule-based, μηδέν ή ελάχιστο ML — μεγάλο wow με χαμηλό ρίσκο):**

| # | Μαγεία | Γιατί εφικτή σύντομα |
|---|---|---|
| N4 | Σημασιολογικές έλξεις | Καθαρή γεωμετρία (κέντρο/μέση/άξονας) — επέκταση του snap engine |
| N5 | Αυτο-θεραπεία ενώ σχεδιάζεις | Ανοχές γεωμετρίας (κενά/διπλές/σχεδόν-συνευθειακά) |
| N6 | Έξυπνη επέκταση μοτίβου | Ανίχνευση ίσων αποστάσεων/επανάληψης — γεωμετρικά |
| N8 | Ζωντανός έλεγχος κανονισμού | Κανόνες ΝΟΚ (πλάτη διαδρόμου/σκάλας/πόρτας) — reuse structural checks |
| N9 | Αυτόματο layer/στυλ από πρόθεση | Ευρετικές (κρυφή ακμή→hidden, άξονας→center) |
| N12 | «Εξήγησέ μου / διόρθωσέ μου» (βασικό) | Rule-based «τι είναι» + «λάθος snap → fix» |
| N1 | Προβλεπτικό φάντασμα (v1, rule-based) | «κλείσε το σχήμα;» / «επανάλαβε την απόσταση;» χωρίς ML |
| N15 | Αυτόματη διαστασιολόγηση/ετικέτες (v1) | Auto-dimensions + fields που ενημερώνονται — γεωμετρικά (συγγενές E6) |

**Tier B — «Μεσαία» (χρειάζονται learning/ML ή CV — μέτριο κόστος):**

| # | Μαγεία | Τι χρειάζεται |
|---|---|---|
| N1 | Προβλεπτικό φάντασμα (v2, ML) | Μοντέλο ακολουθίας ενεργειών (μαθαίνει μοτίβα χρήστη) |
| N7 | Καθάρισμα ελεύθερου σκίτσου | Geometry fitting (deterministic core + ML βελτίωση) |
| N10 | Προσωπικός co-pilot που μαθαίνει εσένα | Usage logging (privacy-safe) + προτιμήσεις/ML |
| N11 | Ιχνηλάτηση από φωτογραφία/σκαρίφημα | Edge detection (computer vision) + βαθμονόμηση κλίμακας |
| N16 | Geo/context-aware AI | Γεωαναφορά (E7) + προσανατολισμός/ήλιος/όρια οικοπέδου + προτάσεις |

**Tier C — «Μελλοντικές» (βαριά AI / LLM — υψηλό κόστος, μέγιστο wow):**

| # | Μαγεία | Τι χρειάζεται |
|---|---|---|
| N2 | Σχεδίαση με φυσική γλώσσα/φωνή | LLM → εντολές γεωμετρίας (mirror Text2CAD/CADialogue, αλλά live σε γραμμές) |
| N3 | «Ζωγράφισε το αποτέλεσμα» | LLM/solver: περιγραφή/περιορισμός → γεωμετρία |
| N13 | Generative διάταξη από περιορισμούς | Generative model: προτάσεις διατάξεων |
| N14 | Σημασιολογικοί δεσμοί σε φυσική γλώσσα | NLP → παραμετρικός δεσμός (πάνω στο E1 formula-driven engine) |

> **Εξωτικές E1-E10 (§2.13):** οι E1 (formula δεσμοί), E2 (math στα πεδία), E3 (equation curves), E6 (auto fields)
> εντάσσονται στις βασικές φάσεις (E2→Φ1, E3→Φ4, E1→Φ7, E6→Φ6). E7/E9/E10 = μελλοντικά (με N16/scripting/touch).

> **Φ11 = Tier A, Φ12 = Tier B, Φ13 = Tier C** (μετά τις Φ1-Φ10 της βασικής δημιουργίας/επεξεργασίας).
> Κάθε AI μαγεία = ξεχωριστή απόφαση Q&A + φάση πριν υλοποιηθεί (privacy/κόστος/ακρίβεια ανά περίπτωση).

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
- **2026-06-20** — Κλείσιμο Q&A (15 ερωτήσεις): Q1 Direct Distance κύριο· Q2 polar 15°· Q3 πλήρες OSNAP·
  Q4 υβριδικοί δεσμοί· Q5 πλήρης βιβλιοθήκη linetypes (+σύνθετα)· Q6 ξεχωριστά κουμπιά + ✨Έξυπνη Γραμμή·
  Q7 πλήρες live ghost· Q8 multifunctional grips· Q9 polyline με bulge (γραμμή+τόξο+width)· Q10 και οι 4
  magic πρώτες· Q11 γενικό MultiLine· Q12 spline fit+CV· Q13 πλήρες modify suite· Q14 συνεχής σχεδίαση·
  Q15 μέτρα με δεκαδικά. Συγγραφή αρχιτεκτονικής §4 + 10 φάσεις. Status → SPECIFICATION COMPLETE.
- **2026-06-20** — Επέκταση έρευνας μετά από ερώτηση Giorgio «προβλέψαμε τα πάντα;»: NEW §2.10 (υπαρκτά gaps —
  axis-lock βελάκια, From/M2P snap, tracking points, auto-close, auto-trim γωνιών, freehand, coord readout,
  Tab-lock…), §2.11 (υπαρκτή AI: Smart Blocks/Markup Assist/Activity Insights/BricsCAD AI Predict + research
  Text2CAD/CADialogue/NURBGen), §2.12 (**13 πρωτοποριακές AI μαγείες N1-N13** που κανείς δεν έχει shipped:
  predictive next-line, NL/voice drawing, draw-by-result, semantic snap, live self-healing, pattern auto-extend,
  sketch beautify, live code-compliance, semantic auto-styling, personal co-pilot, photo trace, explain/fix,
  generative layout). Q&A ξανά ανοιχτό (Q16+).
- **2026-06-20** — Q16: «όλες οι 13 AI μαγείες στο roadmap». NEW §4.9 (ιεράρχηση 3 tiers: A=ντετερμινιστικές
  τώρα N4/N5/N6/N8/N9/N12/N1v1· B=ML/CV N1v2/N7/N10/N11· C=LLM N2/N3/N13· φάσεις Φ11/Φ12/Φ13). Status → SPEC v2
  COMPLETE (16 Q&A, 13 φάσεις). Έτοιμο για υλοποίηση.
- **2026-06-20** — 2ος (adversarial) γύρος έρευνας μετά από αίτημα Giorgio: NEW §2.13 (10 εξωτικές E1-E10 —
  formula-driven δεσμοί, math στα πεδία/QuickCalc, equation curves, MicroStation SmartLine, Civil 3D feature
  lines, auto-updating fields, georeferencing, history-based associativity, scripting/API, touch/gestures) +
  NEW AI μαγείες **N14-N16** (semantic NL constraints, auto-dimensioning, geo/context-aware). §4.9 ενημερωμένο.
  Status → SPEC v3. Verdict: οι εξωτικές = κυρίως φυσικές επεκτάσεις· E1/E2/E3/E6 εντάσσονται στις βασικές φάσεις.
- **2026-06-20** — **Φ1 SSoT audit (γύρος 2) + υλοποίηση αληθινών ελλείψεων.** Στοχευμένο grep ανά domain
  αποκάλυψε ότι ο πυρήνας της Φ1 **ήδη υπάρχει & είναι wired** (το handoff audit είχε χάσει τα subsystems
  `systems/constraints/` + `systems/dynamic-input/`): polar tracking (`polar-tracking-store` + `applyPolar`,
  ADR-357), Direct Distance/dynamic fields (length/angle + Tab + live cursor-angle auto-fill,
  `useDynamicInputRealtime`), OSNAP πλήρες engine roster, length SSoT (`config/display-length-format`),
  angle formatter (`distance-label-utils.formatAngle/formatAngleLocale`). Υλοποιήθηκαν **μόνο** οι πραγματικές
  ελλείψεις, χειρουργικά, σε καθαρά (μη hatch-owned) αρχεία:
  • **Q2** default polar increment **90°→15°** (`systems/constraints/polar-tracking-store.ts` `DEFAULT_INCREMENT`·
    ήδη wired live στο drawing hover· user-overridable + localStorage-preserving).
  • **Q3** full smart OSNAP **default** — προσθήκη MIDPOINT/CENTER/INTERSECTION/PERPENDICULAR/TANGENT/EXTENSION
    στο default snapState (`snapping/context/SnapContext.tsx`· gated πίσω από global OSNAP toggle· new-users-only).
  • **E2** (math στα numeric πεδία) — NEW SSoT `systems/dynamic-input/numeric-expression.ts` (`evalExpr`,
    recursive-descent· `+ - * / ()`, unary, decimals· μηδέν `eval`/`Function`· div-by-zero→null). Wired σε
    `coordinate-parser.parseValue` (math σε cartesian/polar components· V→`[^,<]+?`, parseValue=μοναδικός validator)
    + `keyboard-handlers/line-keyboard-handler.ts` (length/angle πεδία). 29 jest (numeric-expression) +
    7 νέα (coordinate-parser) — 91/91 GREEN στο dynamic-input+constraints.
  **Q1 (Direct Distance) & Q7 (live μήκος+γωνία) — ~λειτουργικά ήδη** μέσω ADR-357 (live angle auto-fill + readout).
- **2026-06-21** — **Φ1 polish (μετά το commit `8ab4143a` του core).** Core Φ1 committed. **Q7 (α)**: γωνία-label
  δίπλα στο μήκος στο canvas line-ghost (`canvas-v2/preview-canvas/preview-entity-renderers.ts` `renderLine` —
  NEW pure `segmentHeadingDeg` 0..360 AutoCAD-convention + `renderInfoLabel` με locale-aware `formatAngleLocale`
  SSoT· gated στο ίδιο `showEdgeDistances`/measurement flag· μηδέν hardcoded string). Έτσι το rubber-band ghost
  δείχνει **ΚΑΙ** μήκος **ΚΑΙ** γωνία απευθείας στον καμβά (όχι μόνο στο dynamic-input overlay). **SSoT angle pipeline
  (de-dup μετά από SSOT audit Giorgio):** ΚΑΜΙΑ νέα συνάρτηση γωνίας — reuse `calculateAngle` (rad, `geometry-vector-utils`)
  → `radToDeg` → `normalizeAngleDeg` (0..360, `geometry-angle-utils`). **(β) plain-length+
  Enter edge — ΚΑΜΙΑ ΕΝΕΡΓΕΙΑ (by design):** το `handleLineEnter` δεν έχει τη live θέση κέρσορα/polar-snapped
  γωνία (context = μόνο `firstClickPoint`)· το DDE ήδη λειτουργεί όταν ο κέρσορας έχει κινηθεί (η `angleValue`
  γεμίζει live). Το υπόλοιπο (commit αγνοεί polar-snap στη live γωνία) = βαθύτερο, χρειάζεται cursor-threading →
  **DEFER σε Φ7** (constraints), ΟΧΙ επέμβαση στο delicate keyboard handler τώρα. Φ1 → 🟢 COMPLETE. UNCOMMITTED
  polish (1 αρχείο: `preview-entity-renderers.ts` — ⚠️ ADR-040 CHECK 6D: stage ADR doc μαζί). 🔴 browser-verify
  (γραμμή ghost δείχνει μήκος+γωνία) + commit. **Επόμενο: Φ2 Linetypes** (orchestrator-scale, νέα συνεδρία).
  **Εκκρεμότητες Φ1 (DEFER, μη-blocking):** (α) γωνία-label στο canvas line-ghost (`preview-entity-renderers`
  `renderLine` — locale-aware via υπάρχον `formatAngleLocale`· σήμερα μόνο μήκος μέσω `showEdgeDistances`,
  γωνία φαίνεται στο dynamic-input overlay)· (β) plain-length-only + Enter (χωρίς mouse move) edge στο
  `handleLineEnter` (όταν `angleValue` κενό → να κουμπώνει στη live polar γωνία αντί jump σε angle field)· (γ)
  η wiring αυτών ακουμπά **hatch-owned drawing αρχεία** (ADR-507 uncommitted) → αναμονή commit για conflict-free.
  Status → 🟡 Φ1 IN PROGRESS. UNCOMMITTED. 🔴 browser-verify (15° μαγνήτης, OSNAP set, `1500+300` σε πεδίο) + commit.
- **2026-06-21** — **Φ2 (Linetypes) core gaps — SSoT audit (γύρος 2) + canvas dash wiring.** Στοχευμένο grep ανά
  domain αποκάλυψε ότι η **Φ2 είναι ~80% ήδη υλοποιημένη & wired** μέσω **ADR-358** (layer linetype/lineweight
  SSoT) + **ADR-357** (Quick Style). Το handoff audit είχε ξανά χάσει ολόκληρο subsystem (lesson #1). **Ήδη
  υπάρχουν & ΔΕΝ ξαναφτιάχτηκαν:** `config/linetype-iso-catalog.ts` (8 ISO linetypes, metric mm patterns +
  `LinetypeDef`), `stores/LinetypeRegistry.ts` (runtime registry, custom-capable), `config/lineweight-iso-catalog.ts`
  (24 ISO, `lineweightToPx`, DXF 370), `config/default-lineweight-resolver.ts`, `systems/properties/resolve-entity-style.ts`
  (πλήρες ByLayer/ByBlock cascade → `ResolvedStyle.linetype.pattern`), `ui/ribbon/data/contextual-line-tool-tab.ts`
  + `useRibbonLineToolBridge.ts` + `stores/QuickStyleStore.ts` (contextual panel: lineweight/linetype/color), και
  **entity wiring** (`completeEntity.ts:218-224` περνά ήδη `quickStyle.linetypeName` στο `CreateEntityCommand`).
  Το lineweight px ✅ ήδη εφαρμοζόταν στο canvas.
  **Το ΟΥΣΙΑΣΤΙΚΟ κενό:** ο `DxfRenderer` resolve-άρει `resolved.linetype.pattern` (mm) αλλά **ποτέ δεν το περνούσε
  στο `ctx.setLineDash`** → γραμμές Dashed/Hidden/Center/Phantom/DashDot/Border/Divide **φαίνονταν συνεχείς**.
  **Υλοποιήθηκαν μόνο τα αληθινά κενά (SSoT, zero-regression):**
  • NEW `rendering/linetype-dash-resolver.ts` — `dashMmToScreenPx(patternMm, worldToScreenScale, ltscale)`: |v| folds
    gaps→positive, 0 (dot)→`MIN_DOT_PX`, [] solid→[], degenerate scale guard. Reuse `scaleDashPattern` (ADR-083) για
    το multiply· **όχι** νέος `setLineDash` wrapper. Dash = zoom-AWARE (σε αντίθεση με το zoom-independent LWT).
  • NEW `stores/LinetypeScaleStore.ts` — global **LTSCALE** knob (default 1.0, micro-leaf useSyncExternalStore,
    localStorage `dxf:ltscale`, mirror QuickStyleStore· UI status-bar control = DEFER).
  • **Wiring** (`+dashMm` στο `ResolvedStyle` render path, ΕΝΑ σημείο, δύο paths): `DxfRenderer.resolveStyleForRender`
    + `applyIsolateAlpha` + `toEntityModel` (`+dashMm`)· **line-batch** key += dash signature + `setLineDash(dashMmToScreenPx(...))`·
    **EntityModel path** μέσω `buildEntityModelFromDxf` (`base.dashMm`) → `BaseEntityRenderer.setupStyle` εφαρμόζει το
    dash ΜΕΤΑ το `applyPhaseStyle` (zoom + LTSCALE)· `types/base-entity.ts` `+ dashMm?`. **ADR-040-safe** (pure read
    στο stroke time, καμία νέα subscription). Legacy `lineType` short-circuit (DxfRenderer `:152`) ΑΘΙΚΤΟ → zero regression.
  20 jest (8 dash-resolver + 6 LTSCALE + 6 regression dxf-canvas) GREEN· 37 με το style-cascade. **DEFER:** σύνθετα
  linetypes (text/.SHX), custom-creation UI (Phase 6+), DXF `LTYPE` round-trip (Φ9/ADR-505), LTSCALE status-bar UI,
  WallRenderer/preview dash (ξεχωριστό `config/bim-line-patterns.ts`). Status → 🟡 **Φ2 CORE COMPLETE**. UNCOMMITTED.
  ⚠️ entity render touch → ADR-040 CHECK 6B/6D (stage ADR-040 + ADR-510). 🔴 browser-verify (Quick Style linetype
  Dashed/Hidden/Center → διακεκομμένη· zoom scale· Continuous → συνεχής) + commit. **Επόμενο: Φ3** (polyline bulge + grips).
- **2026-06-21** — **Φ2 UNIFIED LINETYPE SYSTEM (Revit-grade, FULL SSoT) — απόφαση Giorgio «όπως η Revit, μηδέν
  διπλότυπα».** Μετά SSoT audit (3 Explore agents) βρέθηκαν **3 ανεξάρτητα entity-dash subsystems**: ADR-358
  catalog (8, mm, zoom-scaled), ADR-377 `bim-line-patterns` (28, **px, FIXED**), legacy `getDashArray` (5 enum, px
  ×dashScale) — ασύμβατα (μια dashed DXF γραμμή & ένας dashed BIM τοίχος φαίνονταν διαφορετικά). Giorgio: **όλα
  zoom-scaled mm (model-space) + ΤΑ ΠΑΝΤΑ τώρα**. **Rendering SSoT ΟΛΟΚΛΗΡΩΘΗΚΕ (Φ2A-D):**
  • **Φ2A** `config/linetype-iso-catalog.ts` επεκτάθηκε σε **27 mm patterns** (8 ISO base + 14 density variants 2/X2
    + 3 Dot family + 2 BIM specials Double/Zigzag· `LINETYPE_CATALOG_NAMES`· `isIsoBaselineLinetype`→`origin==='iso-baseline'`
    ώστε ο writer να γράφει LTYPE μόνο για non-standard). NEW `config/linetype-aliases.ts` — `resolveAnyLinetype(input)`:
    ΕΝΑΣ resolver που χαρτογραφεί legacy enum + 28 BIM keys + case-variant DXF names → canonical `LinetypeDef`.
  • **Φ2B** `dashMmToScreenPx(mm, zoom, ltscale, celtscale)` — προστέθηκε **CELTSCALE** (per-object, DXF grp 48,
    `entity.ltscale`)· DxfRenderer line-batch + `BaseEntityRenderer` περνούν celtscale (batch key += ltscale).
  • **Φ2C** **8 BIM renderers → zoom-scaled** μέσω NEW `config/bim-dash-resolver.ts` (`bimDashPx(key,scale)`/`bimDashMm(key)`
    → catalog mm). Wall/Beam/Stair/Slab/SlabOpening/Opening (2D) + `bim-3d-edge-overlay-builder` (3D world-units,
    `DASH_WORLD_SCALE_M=0.006`, |gap| fold). `bim-line-patterns` `BUILT_IN_DASH_ARRAYS`+`linePatternToDashArray`
    → **@deprecated** (key-list + type μένουν canonical). BIM wiring tests → SSoT-aligned (`bimDashPx` expected, όχι hardcoded).
  • **Φ2D** legacy `settings-core/defaults.ts getDashArray` → thin wrapper πάνω στο catalog
    (`dashMmToScreenPx(resolveAnyDashMm(lineType), LEGACY_PREVIEW_MM_TO_PX, dashScale)`)· `DASH_PATTERNS` @deprecated.
  **ΑΠΟΤΕΛΕΣΜΑ:** ΕΝΑ pattern catalog (mm) → ΕΝΑΣ resolver (zoom×LTSCALE×CELTSCALE) → ΟΛΟΙ οι on-screen consumers
  (DXF entity + 8 BIM renderers + legacy preview/settings). DXF & BIM dashed πλέον **ταυτόσημα zoom-scaled**.
  ~250 jest GREEN (Φ2 core 48 + BIM 204 + settings 61), tsc clean. **ΕΚΤΟΣ scope (UI chrome):** `LINE_DASH_PATTERNS`
  (cursor/hover/selection overlays) μένει ξεχωριστό. Status → 🟡 **Φ2 RENDERING SSoT COMPLETE**. UNCOMMITTED.
  ⚠️ ADR-040 CHECK 6B/6D + ADR-377/358 touch → stage ADR-040+358+377+510. 🔴 browser-verify (DXF+BIM dashed zoom-scaled
  ίδια· LTSCALE) + commit. **🔴 ΕΚΚΡΕΜΕΙ (επόμενη συνεδρία, το καθένα orchestrator-scale):** **Φ2E** UI (LTSCALE
  status-bar control + linetype dropdown από live `LinetypeRegistry` + custom-creation pattern editor)· **Φ2F** DXF
  LTYPE round-trip (entity grp 6/48/370 read+write + `DxfSceneBuilder` wire `parseLinetypeTable`→`registerLinetypes`
  + export LTYPE table + `LinetypeRegistry` Firestore/localStorage persistence) = Φ9. Δες HANDOFF.
- **2026-06-21** — **Φ2E #1 SELECTED-LINE CONTEXTUAL TAB + linetype editing UI (Revit-grade, FULL SSoT).**
  Πρόβλημα (Giorgio): «όταν επιλέγω μια γραμμή δεν εμφανίζεται δικό της contextual tab». SSoT audit (grep): το
  `resolveContextualTrigger` είχε `case` για κάθε BIM/annotation entity αλλά **έλειπε** για τα καθαρά γεωμετρικά
  primitives → επιλεγμένη γραμμή = `return null` = καμία tab. Λύση **mirror του hatch (ΕΝΑ trigger, δύο modes)**,
  ΟΧΙ 2ο bridge/tab (μηδέν διπλότυπο):
  • NEW `types/style-editable-primitives.ts` — SSoT set+predicate (`isStyleEditablePrimitiveType`: line/polyline/
    lwpolyline/circle/arc/ellipse/spline/rectangle/rect)· κοινό από ribbon-config + bridge ώστε να μην αποκλίνουν.
  • `app/ribbon-contextual-config.ts` `resolveContextualTrigger` → grouped case επιστρέφει το ΥΠΑΡΧΟΝ
    `LINE_TOOL_CONTEXTUAL_TRIGGER` για selected primitive (το ίδιο tab με τη σχεδίαση).
  • `useRibbonLineToolBridge` αναβαθμίστηκε σε **dual-mode** (αντί νέου bridge): selected primitive →
    read/write μέσω generic `UpdateEntityCommand` (undoable, μηδέν νέα command class)· καμία/μη-primitive επιλογή →
    `QuickStyleStore` draw-defaults (αμετάβλητη συμπεριφορά ADR-357). Color→ByLayer καθαρίζει concrete fields.
  • Linetype options = **live `LinetypeRegistry`** (`getComboboxState` δυναμικά: ByLayer + 27 ISO + runtime custom),
    ΟΧΙ στατικό `LINETYPE_ISO_NAMES`. Lineweight/color = static tab options.
  • `app/useDxfViewerRibbon.ts` περνά `{levelManager, universalSelection}` στο bridge.
  Μηδέν νέα i18n (ίδιο tab/labels). 12 jest GREEN (νέο `useRibbonLineToolBridge.test.tsx`). Status → 🟡 **Φ2E #1
  COMPLETE**. UNCOMMITTED. ⚠️ ADR-040 CHECK 6B/6D δεν αφορά (ribbon files). 🔴 browser-verify (επίλεξε γραμμή →
  tab «Στυλ Γραμμής»· άλλαξε linetype→διακεκομμένη με undo) + commit. **🔴 ΕΚΚΡΕΜΕΙ Φ2E #2:** LTSCALE status-bar
  control + custom-linetype creation pattern editor (→ `registerLinetype`). Δες HANDOFF.
- **2026-06-21** — **Boy-Scout SSoT cleanup (κατά τη διάγνωση Φ2E):** Στο `rendering/entities/BaseEntityRenderer.ts`
  υπήρχαν **δύο** μέθοδοι style-setup: η ζωντανή `setupStyle` (phase-aware· εφαρμόζει το ADR-510 Φ2 linetype dash
  μέσω `applyEntityLinetypeDash`) και η legacy `applyEntityStyle` (έκανε `setLineDash([])` → μηδένιζε dash). Audit
  (grep) έδειξε ότι η `applyEntityStyle` είχε **ΜΗΔΕΝ callers** (η ομώνυμη στο `passes/EntityPass.ts` είναι άλλη
  κλάση/υπογραφή) — νεκρός κώδικας που γλίτωσε το dead-code ratchet επειδή ήταν `protected`. **Διαγράφηκε** → ΕΝΑ
  style-setup SSoT. ΔΕΝ ήταν η αιτία τυχόν linetype-render issue (ποτέ δεν καλούνταν). ⚠️ render αρχείο (ADR-040
  CHECK 6D) → stage μαζί. Μηδέν λειτουργική αλλαγή.
- **2026-06-22** — **Φ2E RENDER BUG FIX — επιλεγμένη γραμμή: αλλαγή linetype δεν φαινόταν στο canvas (ΡΙΖΑ).**
  Σύμπτωμα (Giorgio): επιλεγμένη γραμμή → άλλαξε linetype (π.χ. DashDot) → καμία οπτική αλλαγή· ακόμη και μετά
  την αποεπιλογή έμενε **συμπαγής** (test αποεπιλογής = ΟΧΙ → μηδέν repaint του νέου dash· το «πράσινο» = το χρώμα
  της ίδιας της γραμμής, ΟΧΙ selection highlight). **ΡΙΖΑ (static trace, FULL SSoT audit):** το
  `DxfRenderer.resolveStyleForRender` έχει δύο fallback κλάδους — `!layersById` και «layer δεν βρέθηκε» — που
  επέστρεφαν **hard-coded `dashMm: []`**, αγνοώντας το **δικό** linetype της οντότητας (`entity.linetypeName`).
  Δύο paths περνούν ΠΑΝΤΑ από αυτό το fallback: (1) το **bitmap-cache rebuild** (ADR-040 Φ.D ρίχνει σκόπιμα το
  `layersById`) → κάθε cached normal-state γραμμή· (2) **φρεσκο-σχεδιασμένα primitives** που το `layerId` τους δεν
  υπάρχει (ακόμη) στο `scene.layersById`. Άρα το explicit linetype της γραμμής χανόταν → solid παντού (selected
  overlay ΚΑΙ cached blit). **FIX (SSoT, ΜΗΔΕΝ νέα συνάρτηση):** ο fallback καλεί τώρα το **ΥΠΑΡΧΟΝ**
  `resolveAnyDashMm(entity.linetypeName)` (`config/linetype-aliases.ts`) — τον ΙΔΙΟ resolver «όνομα → mm pattern»
  που ήδη χρησιμοποιούν οι **8 BIM renderers** (μέσω `bim-dash-resolver.ts`) ΚΑΙ το legacy preview
  (`settings-core/defaults.ts getDashArray`). ByLayer/ByBlock/Continuous/empty/unknown ⇒ `[]` (solid) εγγενώς
  (δεν είναι catalog/alias names). Το full-cascade path (layer βρέθηκε) ΑΘΙΚΤΟ — το entity-level linetype ήδη
  υπερισχύει εκεί μέσω `resolveLinetypeName`, μηδέν διπλή εφαρμογή. **ΔΙΟΡΘΩΣΗ ΕΝΔΙΑΜΕΣΟΥ ΛΑΘΟΥΣ (Giorgio SSoT
  push):** αρχικά έφτιαξα NEW `resolveOwnLinetypeDashMm` στο resolve-entity-style.ts — ο Giorgio ρώτησε «διπλότυπο;»
  → audit έδειξε ότι το σώμα ήταν σχεδόν ταυτόσημο με το in-use `resolveAnyDashMm` → **διαγράφηκε**, reuse του
  υπάρχοντος. Καθάρισμα: αφαιρέθηκε το TEMP diagnostic `console.warn` + αχρησιμοποίητο `resolveLinetype` import από
  το `useRibbonLineToolBridge.ts`. +2 jest στο `linetype-aliases.test.ts` (sentinels→[] lock· 39 total στα 2 suites
  GREEN). Αρχεία: `canvas-v2/dxf-canvas/DxfRenderer.ts` (⚠️ render, ADR-040 CHECK 6D → stage ADR-040),
  `ui/ribbon/hooks/useRibbonLineToolBridge.ts`, `config/__tests__/linetype-aliases.test.ts`, ADR-510. Status: Φ2E #1
  πλήρως λειτουργικό. 🔴 browser-verify (επίλεξε γραμμή → DashDot → διακεκομμένη ΑΜΕΣΩΣ· αποεπίλεξε → παραμένει
  διακεκομμένη) + commit.
