# ADR-565 — Καμπύλα & Κυκλικά Δομικά BIM Στοιχεία: Έρευνα Αγοράς + Πρόταση Υλοποίησης (τοίχοι/δοκάρια/κολόνες/πέδιλα/συνδετήρια)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 Φ1 IMPLEMENTED (UNCOMMITTED) — καμπύλος (κυκλικό τόξο) τοίχος· research + απόφαση αναπαράστασης παρακάτω |
| **Date** | 2026-07-02 |
| **Category** | DXF Viewer · BIM · Geometry · Research |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-565-curved-circular-structural-bim-elements.md` |
| **Author** | Opus 4.8 (Giorgio order — deep-research workflow, 103 agents / 5.1M tokens) |
| **Related ADRs** | ADR-GEOMETRY (geometry & math SSoT), ADR-363 (BIM drawing mode / wall framing), ADR-398 (column placement), ADR-417 (roof straight-skeleton — υπάρχουσα καμπύλη/wavefront μηχανή), ADR-514 (unified BIM cursor snap), ADR-508 (unified linear-member framing), ADR-550 (unified entity render contract), ADR-040 (preview-canvas micro-leaf perf — CHECK 6B/6D) |

---

## 1. Πρόβλημα / Κίνητρο

Ο DXF Viewer BIM subapp υποστηρίζει σήμερα **μόνο ευθύγραμμα** δομικά μέλη (τοίχους, δοκάρια, κολόνες, πέδιλα, συνδετήρια δοκάρια ως ευθύγραμμα segments). Ο Giorgio ζήτησε **βαθιά έρευνα αγοράς** για το πώς τα κορυφαία BIM/CAD εργαλεία (Revit, ArchiCAD, Tekla, AutoCAD/Civil 3D, Vectorworks, Allplan, Bentley) μοντελοποιούν **καμπύλα & κυκλικά** δομικά στοιχεία, ώστε να τα εφαρμόσουμε κι εμείς:

1. 🧱 **Καμπύλοι/τοξωτοί τοίχοι**
2. 🏗️ **Καμπύλα δοκάρια**
3. ⭕ **Καμπύλες/κυκλικές κολόνες**
4. 🔵 **Κυκλικά/καμπύλα πέδιλα & θεμελιώσεις** (pad, δακτυλιοειδή/ring)
5. ↪️ **Καμπύλα συνδετήρια/δοκάρια σύνδεσης** (tie/grade/strap beams)

Για κάθε στοιχείο: γεωμετρική αναπαράσταση (arc/spline/sweep/NURBS), εκτιθέμενες παράμετροι (ακτίνα, γωνία τόξου, χορδή, faceting), χειρισμός ενώσεων καμπύλου↔ευθύγραμμου (miter/tangent), best practices & περιορισμοί.

---

## 2. Μεθοδολογία έρευνας (100% ειλικρίνεια για την ποιότητα πηγών)

- **Εργαλείο:** deep-research workflow — 5 παράλληλες γωνίες αναζήτησης → 21 πηγές fetched → 56 claims εξαχθέντα → **25 claims επαληθεύτηκαν adversarially** (3-vote, χρειάζεται 2/3 refute για kill) → **23 confirmed, 2 refuted**.
- **Ισχυρότερες πηγές (primary, τρέχουσες):** buildingSMART IFC 4.3 specs (IfcSweptDiskSolid, IfcBeam), επίσημα Tekla docs (2024/2025), επίσημο BricsCAD BIM help.
- **Ασθενέστερες πηγές (forum/blog/KB, χαμηλότερη βεβαιότητα):** ArchiCAD faceting (Graphisoft Community — ένας poster είναι Graphisoft admin), Revit Wall Joins (RevitCity forum + Autodesk KB), Chief Architect (KB — **residential** εργαλείο, ενδεικτικό όχι authoritative).

### ⚠️ Κενά που ΔΕΝ καλύφθηκαν από primary evidence (open questions — μην τα θεωρήσεις απαντημένα):
- **Δεν βρέθηκε** primary evidence για **Vectorworks, Allplan, Bentley (MicroStation/OpenBuildings), AutoCAD/Civil 3D** συγκεκριμένα.
- **Δεν βρέθηκε** ειδική τεκμηρίωση για **κυκλικά/δακτυλιοειδή πέδιλα** και **καμπύλα συνδετήρια/tie/grade beams** — η έρευνα κάλυψε καμπύλους τοίχους, καμπύλα δοκάρια & γενικά swept solids, αλλά **όχι** αυτούς τους ειδικούς τύπους θεμελίωσης/σύνδεσης. Καλύπτονται εδώ **κατ' αναλογία** (tie beam = γραμμικό μέλος → ίδιο μοντέλο με δοκάρι· ring footing = revolve/sweep κλειστής directrix), όχι από άμεση πηγή.
- Οι δύο **απορριφθείσες** claims (§8) δείχνουν πού η αρχική διατύπωση ήταν λάθος.

---

## 3. Κεντρικό εύρημα: ΔΥΟ επίπεδα αναπαράστασης (storage ≠ display)

**Το πιο σημαντικό μοτίβο, επαναλαμβανόμενο σε ΟΛΑ τα εργαλεία:**

> Η καμπύλη αποθηκεύεται **παραμετρικά** (ακτίνα + τόξο, ή 3 σημεία, ή IFC directrix) ως η **αυθεντική πηγή αλήθειας** — ενώ το κτισμένο/renderαρισμένο στερεό είναι μια **τμηματοποιημένη (faceted) προσέγγιση** ελεγχόμενη από αριθμό segments ή από ανοχή απόκλισης χορδής (chord-deviation tolerance).

**ΜΗΝ συγχέεις την αναπαράσταση αποθήκευσης με την τμηματοποίηση εμφάνισης.** Αυτό είναι ο ακρογωνιαίος λίθος της πρότασής μας (§7).

Δύο στρατηγικές συγκλίνουν:

| Στρατηγική | Ποιος | Περιγραφή |
|---|---|---|
| **A. Παραμετρική + faceted προσέγγιση** | Tekla, ArchiCAD, BricsCAD | Αποθηκεύει radius+arc (ή 3-point pick)· χτίζει faceted polyline/polygon με segment count ή chord-tolerance |
| **B. IFC swept-solid (interchange standard)** | buildingSMART IFC 4.3 | Επισημοποιεί την «αληθινή» γεωμετρία: profile/disk swept κατά μήκος directrix, ή revolve με arc-axis |

---

## 4. Ευρήματα ανά αναπαράσταση

### 4.1 IFC data model (ισχυρότερη, πιο σχετική με υλοποίηση evidence)

**IfcSweptDiskSolid** — για μέλη **κυκλικής διατομής** που ακολουθούν καμπύλη (καμπύλα δοκάρια, πάσσαλοι, οπλισμός, σωληνωτά μέλη):
- Ένας **κυκλικός δίσκος** σαρώνεται (swept) κατά μήκος μιας 3D **Directrix** (καθοδηγητικής καμπύλης).
- `Radius` = εξωτερική ακτίνα· προαιρετικό `InnerRadius` = κυκλική οπή στο κέντρο (κοίλοι σωλήνες), με περιορισμό `Radius > InnerRadius`.
- Η Directrix μπορεί να είναι `IfcCompositeCurve`, tangent-continuous μεταξύ segments.

**Κανόνας προσανατολισμού διατομής (κρίσιμος για υλοποίηση):**
> «Το κάθετο διάνυσμα (normal) στο επίπεδο του κυκλικού δίσκου έχει τη διεύθυνση της **εφαπτομένης της directrix**, και το κέντρο του δίσκου βρίσκεται πάνω στη directrix.» (buildingSMART IFC4x3, per ISO 10303-42)

Δηλαδή: κατά τη σάρωση, **το επίπεδο της διατομής μένει κάθετο στην εφαπτομένη της διαδρομής**. Αυτόν τον κανόνα οφείλει να αναπαράγει οποιαδήποτε υλοποίηση sweep-along-curve.

**IfcBeam / IfcColumn ως swept solids:**
- Δοκάρια (καμπύλα ή ευθύγραμμα): ένα **2D profile swept κατά μήκος directrix**, με προαιρετικό ομοιόμορφο **taper**.
- `SweptSolid` (= `IfcExtrudedAreaSolid`) → **μόνο ευθύγραμμα** extrusions.
- `AdvancedSweptSolid` → **γνήσια καμπύλες** διαδρομές· υποστηρίζει `IfcSurfaceCurveSweptAreaSolid`, `IfcFixedReferenceSweptAreaSolid`, `IfcExtrudedAreaSolidTapered`, `IfcRevolvedAreaSolidTapered`.
- Καμπύλα δοκάρια «πιο σύνθετα από απλή ευθεία extrusion» → `IfcFixedReferenceSweptAreaSolid` πάνω σε alignment curve.

**Καθαρά κυκλικά-τόξου δοκάρια (pure arc):**
- `IfcRevolvedAreaSolid` με άξονα `IfcTrimmedCurve` που έχει `BasisCurve` τύπου `IfcCircle`.
- → **παραμετρικό τόξο**: ακτίνα από το `IfcCircle`, γωνία από το trim. (Το revolve είναι μία επιλογή, όχι αποκλειστική — η IFC δεν την επιβάλλει.)

### 4.2 Tekla Structures (Στρατηγική A — παραμετρική + faceted)

- Δημιουργεί **καμπύλα δοκάρια, μέρη/κολόνες, strip footings** με: **ακτίνα + αριθμό segments**, ή **3-point pick** (αρχή, σημείο-πάνω-στο-τόξο, τέλος).
- Το κτισμένο στερεό είναι **faceted polybeam**, ΟΧΙ συνεχές τόξο. Tekla κυριολεκτικά: *«a real beam cannot be determined by a finite number of segments»*.
- **Δύο κύριες παράμετροι χρήστη:** `Radius` + `Number of segments` («όσο περισσότερα segments, τόσο λιγότερο γωνιώδες φαίνεται»). Προαιρετικό: **plane of curvature** (σχετικό με το τρέχον work plane).
- **Όριο:** max **59 segments** ανά καμπύλο δοκάρι — **για λόγους performance**.

### 4.3 ArchiCAD (Στρατηγική A — surface modeler, ΟΧΙ NURBS) — *medium confidence, forum*

- **Polygonal surface modeler:** καμπύλες επιφάνειες → 3D πολυγωνικά επίπεδα· 3D καμπύλες → segments χορδής.
- Segment count = ο **ελάχιστος** αριθμός που κρατά την απόκλιση χορδής < **1.0 mm**, με **cap default 36** ανά πλήρη κύκλο (όποιο από τα δύο είναι μικρότερο), με ~8-segment κατώφλι.
- Worked examples: R=250mm→36, R=100mm→24, R=20mm→12, R=10mm→8.
- ⚠️ **ΔΙΟΡΘΩΣΗ (refuted claim):** το 1.0mm **ΔΕΝ** είναι απαράβατο hard floor — απορρίφθηκε στο verification (§8).

### 4.4 BricsCAD BIM (Στρατηγική A — true arc segments)

- Καμπύλοι τοίχοι = **γνήσια arc segments**, σχεδιασμένα διαδραστικά με toggle line-mode (`L`) ↔ arc-mode (πληκτρολόγησε `A` = Draw arcs).
- Ο χρήστης εισάγει **degree & length** του τόξου σε πεδίο dynamic input.

### 4.5 Ενώσεις / miters καμπύλου ↔ ευθύγραμμου (medium confidence)

- **Revit «Wall Joins» tool** (Butt / Miter / Square-off): μπορεί να κάνει miter καμπύλης-σε-ευθεία ένωση τοίχων, ακόμη και stacked walls.
  - ⚠️ **Γνωστός περιορισμός:** το αυτόματο mitering **επιλύει μόνο τα layers/components που ταιριάζουν**· σε junctions με μη-συμβατά stacked-wall layers αποτυγχάνει στα mismatched components. (Επίσης το miter αποτυγχάνει όταν οι τοίχοι είναι attached σε floors.)
- **Tangent join (radius-driven):** εργαλείο τύπου «Make Arc Tangent» (τεκμηριωμένο σε Chief Architect KB) — ένας καμπύλος τοίχος συνδέεται εφαπτομενικά σε δύο ευθύγραμμους, και οι ευθύγραμμοι **αυτόματα κονταίνουν/μακραίνουν** ώστε να τηρηθεί η δοθείσα ακτίνα.
  - **Μαθηματικός έλεγχος εφαπτομενικότητας:** η γραμμή από το τέλος του ευθύγραμμου segment (=αρχή του τόξου) προς το **κέντρο του τόξου** πρέπει να είναι **κάθετη** στο ευθύγραμμο segment.
  - ⚠️ Chief Architect = residential εργαλείο (όχι enterprise BIM)· το μοτίβο radius+tangent **γενικεύεται**, αλλά η πηγή είναι ενδεικτική.

---

## 5. Σύνθεση ανά ζητούμενο στοιχείο

| Στοιχείο | Αναπαράσταση στους «μεγάλους» | Παράμετροι χρήστη | Πηγή/βεβαιότητα |
|---|---|---|---|
| **1. Καμπύλος τοίχος** | Arc segments (BricsCAD)· παραμετρικό radius + faceted (γενικό μοτίβο) | Radius (μετρήσιμη ανά layer, default wall-center)· degree+length | BricsCAD primary· Chief Arch. secondary |
| **2. Καμπύλο δοκάρι** | IFC: profile swept κατά directrix (`AdvancedSweptSolid` / `IfcFixedReferenceSweptAreaSolid`)· pure arc → `IfcRevolvedAreaSolid`+`IfcTrimmedCurve`/`IfcCircle`· Tekla: faceted polybeam | Radius + arc angle/length· plane of curvature· segments (Tekla max 59) | IFC primary· Tekla primary |
| **3. Κυκλική/καμπύλη κολόνα** | IFC: swept solid ίδιο με δοκάρι· κυκλική διατομή → `IfcSweptDiskSolid` (Radius + optional InnerRadius) | Radius διατομής· (καμπύλη κολόνα → directrix) | IFC primary· Tekla «parts» primary |
| **4. Κυκλικό/δακτυλιοειδές πέδιλο** | ⚠️ **Χωρίς άμεση πηγή.** Κατ' αναλογία: κυκλικό pad → revolve/extrude κυκλικού profile· ring → κλειστή κυκλική directrix ή revolve με InnerRadius | Radius (+ InnerRadius για ring)· βάθος | **Αναλογία** (IFC swept-disk / revolve) |
| **5. Καμπύλο συνδετήριο/tie/grade beam** | ⚠️ **Χωρίς άμεση πηγή.** Κατ' αναλογία: γραμμικό μέλος → **ίδιο μοντέλο με δοκάρι** (profile swept κατά directrix) | Ίδιες με δοκάρι | **Αναλογία** (IFC beam) |

---

## 6. Best practices & περιορισμοί (από την έρευνα)

- ✅ **Αποθήκευσε παραμετρικά** (radius+arc ή directrix) — ΟΧΙ ως pre-tessellated polyline στο μοντέλο οντότητας.
- ✅ **Tessellate κατά το render** με segment count παραγόμενο από **chord-deviation tolerance** (industry norm).
- ✅ **Κράτα τη διατομή κάθετη στην εφαπτομένη** της directrix (IFC/ISO κανόνας) — αλλιώς στρεβλώνει το swept profile.
- ✅ **Εφαπτομενικές ενώσεις**: line-to-arc-center κάθετη στο segment· auto-trim γειτονικών ευθύγραμμων.
- ⚠️ **Performance cap** στα segments (Tekla: 59)· χρειάζεται όριο.
- ⚠️ **Miter μη-συμβατών layers**: το mitering επιλύει μόνο ταιριαστά layers — ελέγξτε αν ισχύει στο δικό μας layered wall/beam μοντέλο.
- ⚠️ **Λάθος τρόποι** (από 8020 BIM, ενδεικτικά): σπάσιμο σε πολλά welded ευθύγραμμα, ή αντικατάσταση beam family με wall/sweep — αποφύγετέ τα.

---

## 7. ΠΡΟΤΑΣΗ ΓΙΑ ΤΟΝ DXF VIEWER (PROPOSED — προς έγκριση Giorgio)

### 7.1 Μοντέλο οντότητας (storage = παραμετρικό)
Επέκταση κάθε γραμμικού/footprint μέλους με προαιρετική **καμπύλη directrix**:
- **Απλό μοτίβο (σύσταση για Φ1):** `curve?: { kind: 'arc', radius, sweepDeg, plane }` ή **3-point** (start / on-arc / end) — ταιριάζει με Tekla/BricsCAD UX και με τη γεωμετρία που ήδη χειρίζεται το `ADR-GEOMETRY`.
- **Μελλοντικό (Φ-N):** IFC-style `directrix` (composite curve) για export interoperability.
- **SSoT reuse:** ελέγξτε ΠΡΩΤΑ τι υπάρχει ήδη — `ADR-417` straight-skeleton/wavefront μηχανή, `geometry-vector-utils`, `ADR-GEOMETRY` arc helpers. **Μην φτιάξεις νέο arc math αν υπάρχει.**

### 7.2 Tessellation (display = faceted, παραγόμενο)
- ΕΝΑ κεντρικό SSoT helper: `tessellateArc(radius, sweepDeg, chordToleranceMm) → Point2D[]`, με:
  - segment count = min-count ώστε chord-deviation < tolerance,
  - **cap** (π.χ. 64, mirror Tekla 59 / ArchiCAD 36) για performance,
  - προαιρετικά **zoom-adaptive** tolerance (η οθόνη μας κάνει live zoom — βλ. ADR-040).
- Το tessellation τρέφει τους υπάρχοντες ευθύγραμμους renderers (polyline) — **μηδέν νέο render pipeline**, σύμφωνα με `ADR-550` unified entity render contract.

### 7.3 Ενώσεις (miter/tangent)
- Επέκταση της υπάρχουσας wall/beam framing (ADR-363/ADR-508) με **tangent-join test** (line-to-center ⟂ segment) + auto-trim.
- Προσοχή στον περιορισμό «μη-συμβατά layers δεν κάνουν miter» στο δικό μας layered μοντέλο.

### 7.4 Ανοιχτά ερωτήματα προς απόφαση Giorgio (πριν την υλοποίηση)
1. **Default chord-tolerance & cap;** (υιοθέτηση ArchiCAD <1.0mm/36, Tekla 59, ή zoom-adaptive;)
2. **Storage:** radius+arc vs 3-point vs IFC-directrix για Φ1;
3. **Ποιο στοιχείο πρώτο;** (πρόταση: **καμπύλος τοίχος** — έχει την πιο καθαρή πηγή/UX, μετά δοκάρι→tie beam→κολόνα→πέδιλο).
4. **Ring footings & κυκλικά pads:** revolve profile vs swept-disk με InnerRadius;

---

## 8. Απορριφθέντα claims (adversarial verification, 1-2 votes)

1. ❌ *«Chief Architect σχεδιάζει καμπύλο τοίχο ως απλό τόξο μεταξύ δύο ευθύγραμμων με dedicated Curved Wall tool»* — απορρίφθηκε (1-2).
2. ❌ *«Ο ArchiCAD επιβάλλει hard-coded 1.0mm chord-tolerance ως απόλυτο floor»* — απορρίφθηκε (1-2)· το 1.0mm είναι default/υπολογιστικό, όχι απαράβατο.

---

## 9. Πηγές (verified)

**Primary (buildingSMART IFC 4.3):**
- `https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcSweptDiskSolid.htm`
- `https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcBeam.htm`
- `https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcBeam.htm`

**Primary (vendor):**
- Tekla: `https://support.tekla.com/doc/tekla-structures/2025/mod_bending`
- Tekla: `https://support.tekla.com/doc/tekla-structures/2024/mod_creating_curved_beam`
- Tekla: `https://teklastructures.support.tekla.com/en/support-articles/number-segments-curved-beam`
- BricsCAD: `https://help.bricsys.com/en-us/document/bricscad-bim/modeling-techniques/creating-walls`
- Revit KB: `https://knowledge.autodesk.com/support/revit-products/learn-explore/caas/CloudHelp/cloudhelp/2018/ENU/Revit-Model/files/GUID-130A65BC-8C57-4C31-8C07-F96041771539-htm.html`

**Secondary / forum / blog (χαμηλότερη βεβαιότητα):**
- ArchiCAD: `https://community.graphisoft.com/t5/Modeling/SEGMENTATION-RESOLUTION-of-Curves-in-Complex-Profiles-in-3D/td-p/234701`
- Revit miter: `https://www.revitcity.com/forums.php?action=viewthread&thread_id=26346`
- Chief Architect: `https://www.chiefarchitect.com/support/article/KB-00692/drawing-a-curved-wall-that-is-tangent-to-two-straight-walls.html`
- IFC parametric: `http://geometrygym.blogspot.com/2013/10/parametric-ifc.html`

---

## 11. Υλοποίηση Φ1 — Καμπύλος (κυκλικό τόξο) τοίχος (2026-07-03)

**Απόφαση αναπαράστασης (Giorgio scope):** επέκταση του υπάρχοντος `WallKind='curved'` (που ήταν **quadratic Bézier**) με ΕΝΑ canonical πεδίο `WallParams.arc?: number` = **DXF bulge** (`tan(sweep/4)` μεταξύ start/end). Το bulge κωδικοποιεί πλήρως το κυκλικό τόξο (center/radius/sweep derivable), είναι DXF-native, και έχει ήδη ολόκληρο SSoT (`geometry-bulge-utils`, ADR-510). Τα 3 input methods (3-point / radius / IFC) **normalize στο ΕΝΑ bulge** (SSoT — όχι 3 redundant πεδία). Bézier `curveControl` μένει legacy (precedence: `arc` > `curveControl`).

**Draw UX:** 3-σημείων (Tekla/AutoCAD 3-point ARC) — το 3ο κλικ είναι σημείο απ' όπου περνά το τόξο· το FSM `awaitingCurveControl` επαναχρησιμοποιήθηκε. **Πλήκτρο:** το ΥΠΑΡΧΟΝ **`W`→`2`** («Καμπύλος» = τόξο)· **κανένα ξεχωριστό arc chord** (βλ. §12 big-player practice).

**Tessellation:** deviation-adaptive segment count (`adaptiveArcSegDeg`, chord-deviation `CHORD_DEVIATION_MM=2mm` world) στο commit-time· cap 59 (Tekla) / floor 4· render-time zoom-adaptive axis = Φ1.x follow-up.

**Αρχεία (NEW):** `bim/geometry/shared/curve-tessellation.ts` (κεντρικό `adaptiveArcSegDeg` + `tessellateArcAxis` + centralized `subdivideQuadraticBezier`), `bim/walls/wall-arc-descriptor.ts` (`bulgeFrom3Points`/`bulgeFromRadius`/`arcCurveFromBulge`), `config/tolerance-config.ts` `ADAPTIVE_ARC_TESSELLATION`. **(MOD):** `wall-types.ts`+`wall.schemas.ts` (`arc?`), `wall-geometry.ts` (arc branch στο `pickAxisVertices`), `use-wall-commit.ts` (3-point→bulge), `wall-preview-store.ts`+`use-wall-preview-sync.ts`+`wall-preview-helpers.ts` (live arc preview via `arcEndPoint`), `wall-grips.ts`+`wall-grip-transforms.ts`+`grip-kinds.ts` (`wall-arc-apex` radius grip), `wall-tool-status-text.ts`+locales (`statusArcThrough`).

**Boy Scout:** `subdivideQuadraticBezier` ήταν verbatim duplicate wall+beam → κεντρικοποιήθηκε στο `curve-tessellation.ts` (beam+wall imports).

**3D:** μηδέν αλλαγή — ο 3D wall path διαβάζει `getWallAxisVertices`/footprint (τώρα arc-aware).

**Tests:** 3 νέα suites (`wall-arc-descriptor` / `curve-tessellation` / `wall-geometry-arc`) + update `useWallTool` curved test. bim/walls+bim/geometry: **1515/1515 GREEN**· 2 pre-existing 3D failures (wall-tilt/column-base-offset) άσχετα (fail & σε καθαρό δέντρο).

**Deferred (Φ2+):** tangent-miter καμπύλου↔ευθύγραμμου (γενίκευση `wall-trims.ts classifyPair` με end-tangent), arc `wall-split`, radius-input dynamic-input + IFC directrix import/export, render-time zoom-adaptive axis, endpoint sweep-preserve grip, **beam/κολόνα/πέδιλο arc** (reuse `curve-tessellation` + `wall-arc-descriptor` pattern).

## 12. Big-player UX research — πώς εκθέτουν το curve drawing (2026-07-03)

**Ερώτημα Giorgio:** «κάνε το όπως οι μεγάλοι (Revit / Maxon Cinema 4D / Figma-level)· αν οι μεγάλοι δεν το προτείνουν [ξεχωριστά πλήκτρα Bézier vs τόξο], ακολουθούμε την πρακτική τους.» Έρευνα (verified web sources):

| Εργαλείο | Πώς εκθέτει το curve drawing | Δομικός τοίχος |
|---|---|---|
| **Revit** | Ο **τοίχος** σχεδιάζεται με **Line / Arc / Circle / Pick Lines** από **Draw panel gallery** στο ribbon. Το Arc έχει variants (Start-End-Radius / Center-Ends / Tangent / Fillet) — όλα στο ίδιο gallery. Ο χρήστης αλλάζει mode από on-screen gallery, **ΟΧΙ πλήκτρο ανά σχήμα**. | **ΚΑΝΕΝΑ spline/Bézier** για τη διαδρομή τοίχου (spline μόνο σε profile edit). Καμπύλος τοίχος = **κυκλικό τόξο**. |
| **Cinema 4D (Maxon)** | Τύπος καμπύλης (Linear/Bézier/B-Spline/Akima/Cubic) = **dropdown/attribute** στο spline object· Arc/Circle = ξεχωριστά primitives. | General 3D — όχι BIM structural. |
| **Figma** | **ΕΝΑ Pen tool** (+ Bend) για όλες τις καμπύλες (Bézier via handles)· κανένα ξεχωριστό «arc tool». | Vector design — Bézier. |

**Σύνθεση / απόφαση:**
- **Βιομηχανική νόρμα = ΕΝΑ εργαλείο με sub-modes** (Revit Draw gallery, Figma Pen), **ΟΧΙ** πολλά πλήκτρα ανά variant.
- **Δομικός τοίχος = κυκλικό τόξο**, όχι Bézier/spline (Revit + IFC/Tekla από §2–§5).
- **Άρα:** (1) **κανένα ξεχωριστό arc chord** — ένα «Καμπύλος τοίχος» = τόξο (`W2`)· το προσωρινό `W4` **καταργήθηκε** (αντι-SSoT, δεν το κάνουν οι μεγάλοι). (2) **Bézier `curveControl` = deprecated** για τοίχους (legacy render μόνο). (3) **Full Revit-parity (PROPOSED Φ1.x):** arc draw-variants (3-σημείων default τώρα· + κέντρο-άκρα / αρχή-τέλος-ακτίνα / εφαπτομενικό) ως **contextual options bar** στο ribbon του τοίχου (mirror Revit Draw gallery), όχι νέα πλήκτρα.

**Πηγές:** Autodesk KB «Sketching Arcs» + Revit wall overview/forums (no-spline-wall)· Maxon C4D spline docs· Figma Learn (Pen/Bend).

## 10. Changelog

- **2026-07-03 (β)** — Big-player UX research (§12): Revit/Cinema4D/Figma → ΕΝΑ εργαλείο με sub-modes, όχι πλήκτρο ανά variant· δομικός τοίχος = τόξο όχι Bézier. **Απόφαση:** κατάργηση του προσωρινού `W4` chord (ένα `W2`=«Καμπύλος»=τόξο)· Bézier deprecated για τοίχους· arc-variants σε contextual options bar = PROPOSED Φ1.x.
- **2026-07-03** — Φ1 IMPLEMENTED (UNCOMMITTED): καμπύλος κυκλικό-τόξο τοίχος (§11). Storage=canonical `arc` bulge, 3-point draw, deviation-adaptive tessellation, apex radius grip, live preview, Boy-Scout dedup του `subdivideQuadraticBezier`. 3 νέα jest suites· 1515/1515 walls+geometry green. Αναμονή browser-verify + commit από Giorgio.
- **2026-07-02** — Δημιουργία. Deep-research workflow (103 agents, 5.1M tokens, 5 γωνίες, 21 πηγές, 25 claims verified → 23 confirmed / 2 refuted). Τεκμηρίωση αγοράς + πρόταση αρχιτεκτονικής (storage παραμετρικό + display faceted).
