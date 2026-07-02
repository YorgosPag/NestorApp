# ADR-565 — Καμπύλα & Κυκλικά Δομικά BIM Στοιχεία: Έρευνα Αγοράς + Πρόταση Υλοποίησης (τοίχοι/δοκάρια/κολόνες/πέδιλα/συνδετήρια)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🔵 RESEARCH / PROPOSED — τεκμηρίωση αγοράς + σύσταση αρχιτεκτονικής· καμία υλοποίηση ακόμη |
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

## 10. Changelog

- **2026-07-02** — Δημιουργία. Deep-research workflow (103 agents, 5.1M tokens, 5 γωνίες, 21 πηγές, 25 claims verified → 23 confirmed / 2 refuted). Τεκμηρίωση αγοράς + πρόταση αρχιτεκτονικής (storage παραμετρικό + display faceted). Status RESEARCH/PROPOSED — αναμονή απόφασης Giorgio στα 4 ανοιχτά ερωτήματα (§7.4) πριν οποιαδήποτε υλοποίηση.
