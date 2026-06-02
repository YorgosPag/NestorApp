# ADR-409 — Πολιτική αδειοδότησης & redistribution εξωτερικών BIM βιβλιοθηκών/περιεχομένου

| Field | Value |
|---|---|
| Status | ✅ **ACCEPTED (policy + research reference)** — Καθορίζει ποιες εξωτερικές πηγές BIM (κώδικας/περιεχόμενο/δεδομένα) ΕΠΙΤΡΕΠΕΤΑΙ να ενσωματωθούν & να **αναδιανεμηθούν** μέσα στο κλειστό εμπορικό app, και ποιες ΑΠΑΓΟΡΕΥΟΝΤΑΙ. Τεκμηρίωση deep-research 2026-06-02 ώστε να **μην ξαναγίνει** η έρευνα από άλλον developer. |
| Date | 2026-06-02 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | N.5 CLAUDE.md (license check — MIT/Apache/BSD μόνο, ΟΧΙ GPL/LGPL/AGPL), ADR-034 Appendix C (license policy), ADR-407 (railings — parametric path-based, ο «δρόμος C» στην πράξη), ADR-405/406/408 (BIM/MEP parametric entities), ADR-040 (three.js canvas stack) |
| Σκοπός χρήσης | Ο τελικός **χρήστης** να επιλέγει δομικά/MEP στοιχεία από κατάλογο **μέσα στην εφαρμογή** (κλειστό εμπορικό προϊόν, three.js stack). |

---

## ⚠️ Disclaimer

Αυτό είναι **τεχνική ανάλυση αδειών**, ΟΧΙ νομική συμβουλή. Άδειες & Terms of Service αλλάζουν — οι παρακάτω επιβεβαιώθηκαν **current 2026-06-02**. Για redistribution υψηλής αξίας → έλεγχος από νομικό.

---

## Context — γιατί υπάρχει αυτό το ADR

Ο Giorgio ρώτησε: υπάρχουν **εντελώς δωρεάν** BIM βιβλιοθήκες που μπορούμε να **ενσωματώσουμε & αναδιανείμουμε** μέσα στο κλειστό εμπορικό app, ώστε ο χρήστης να επιλέγει στοιχεία από κατάλογο — χωρίς:
1. υποχρέωση δημοσίευσης δικού μας κώδικα (→ **permissive only**: MIT / Apache-2.0 / BSD / CC0 / public-domain· **ΟΧΙ** GPL/LGPL/AGPL),
2. αγορά ή συνδρομή,
3. και **ΜΕ** ρητό δικαίωμα **αναδιανομής** (όχι απλώς «δωρεάν download για δικά σου έργα»).

### 🪤 Η κρίσιμη παγίδα (επιβεβαιωμένη)

> **«Δωρεάν να το κατεβάσω» ≠ «ελεύθερο να το αναδιανείμω μέσα στο προϊόν μου».**

Οι content πλατφόρμες είναι δωρεάν για **τα δικά σου έργα**, αλλά το ToS τους **σχεδόν πάντα απαγορεύει bundling/redistribution** σε δικό σου προϊόν. Αυτό επιβεβαιώθηκε πλήρως (βλ. Κατηγορία B).

---

## Decision — η πολιτική σε 3 γραμμές

1. **Engine:** Χρησιμοποιούμε **web-ifc / ThatOpen (MPL-2.0)** *unmodified* — νόμιμο bundling σε κλειστό app χωρίς δημοσίευση δικού μας κώδικα. ΑΠΑΓΟΡΕΥΟΝΤΑΙ: xeokit (AGPL), IfcOpenShell (LGPL), Open CASCADE/occt-import-js (LGPL).
2. **Έτοιμο περιεχόμενο (3D αρχεία):** ΑΠΑΓΟΡΕΥΕΤΑΙ από BIMobject / SketchUp 3D Warehouse / Polantis — τα ToS τους απαγορεύουν ρητά την αναδιανομή σε προϊόν μας. Επιτρέπεται **μόνο** CC0/public-domain περιεχόμενο: **Poly Haven = CC0, redistribution σε προϊόν που πουλάς ✅ χωρίς attribution (PASS 2 verified)**· Khronos glTF-Sample-Assets = mixed per-model (μόνο CC0 subset). ⚠️ Κανένα δεν είναι BIM-grade (μόνο geometry). Επίσης ❌ Autodesk Forge/APS = proprietary metered SaaS (A.1).
3. **Κατάλογος «ο χρήστης επιλέγει» (ΠΡΟΤΙΜΩΜΕΝΟΣ ΔΡΟΜΟΣ):** **Παραμετρικά presets** από public-domain μηχανική γνώση (τυποποιημένες διατομές HEA/HEB/IPE κ.λπ.). Είναι **δεδομένα/facts** → μηδέν νομικό ρίσκο (νομική βάση: C.1). Αντλούμε από **steelpy (Apache-2.0)** / **sectionproperties (MIT)**, ΟΧΙ verbatim από το AISC spreadsheet (C.3). Είναι ήδη η αρχιτεκτονική μας (ADR-407 RailingType, parametric columns/beams).

---

## (A) CODE / ENGINES — όλα copyleft· μόνο το web-ifc είναι αξιοποιήσιμο

| Engine | Πραγματική άδεια | Closed-app redistribution; | Verdict | Verify |
|---|---|---|---|---|
| **web-ifc / ThatOpen** (`engine_web-ifc`) | **MPL-2.0** ⚠️ (ΟΧΙ MIT, όπως ευρέως πιστεύεται) | ✅ *unmodified* bundling νόμιμο σε κλειστό app· ΔΕΝ μολύνει το δικό μας app· ΜΟΝΟ αν τροποποιήσουμε τα MPL αρχεία → πρέπει να δημοσιευτούν **εκείνα** | ✅ **ΑΞΙΟΠΟΙΗΣΙΜΟ** (με όρο: μην τροποποιείς τα source files του) | 3-0 |
| **xeokit SDK** | **AGPL-3.0** | ❌ network-copyleft (§13): υποχρέωση να δώσεις τον source σε όποιον το χρησιμοποιεί ως web service· εναλλακτικά **αγορά** commercial license | ❌ ΑΠΟΚΛΕΙΣΤΕΟ (παραβιάζει #1 & #2) | 3-0 |
| **IfcOpenShell** | **LGPL-3.0-or-later** (+ GPL-3.0 Bonsai/BlenderBIM) | ❌ copyleft | ❌ ΑΠΟΚΛΕΙΣΤΕΟ (#1) | 3-0 |
| **Open CASCADE (OCCT)** | **LGPL-2.1 + OCCT Exception 1.0** | ⚠️ το exception χαλαρώνει μόνο το header-linking· πρακτικά bundle-able αλλά τυπικά μη-permissive | ❌ ΑΠΟΚΛΕΙΣΤΕΟ by-name (#1)· *passes in practice* | 3-0 |
| **occt-import-js** (kovacsv) | **LGPL-2.1** (wrap-άρει OCCT) | ⚠️ ίδιο με OCCT | ❌ ΑΠΟΚΛΕΙΣΤΕΟ (#1) | 3-0 |

### 🔑 Η σημαντικότερη διόρθωση: web-ifc = MPL-2.0, ΟΧΙ MIT
Το αρχικό framing υπέθετε «MIT». **Λάθος** — είναι **MPL-2.0** (file-level weak copyleft). Πρακτική σημασία:
- ✅ Bundle-άρεται *unmodified* σε κλειστό εμπορικό προϊόν, **χωρίς αγορά**, **χωρίς να δημοσιεύσουμε τον δικό μας κώδικα**.
- ❗ Αν τροποποιήσουμε τα δικά του αρχεία, πρέπει να δημοσιεύσουμε **μόνο εκείνες τις αλλαγές** (όχι όλο το app — αυτό το κάνει η AGPL, γι' αυτό η xeokit αποκλείεται).
- Συμπέρασμα: «κόβεται με το όνομα» (strict permissive-only) αλλά «περνά στην πράξη». **Απόφαση Giorgio:** εφόσον δεν πειράζουμε τα γρανάζια του, είναι ασφαλές & ταιριάζει στο three.js stack.

### A.1 — Autodesk Forge / APS (Autodesk Platform Services) Viewer → ❌ ΑΠΟΚΛΕΙΣΤΕΟ (PASS 2 verified)

| Πηγή | Φύση | Όρος | Verdict | Verify |
|---|---|---|---|---|
| **Autodesk Forge / APS Viewer** | Proprietary, **subscription/metered SaaS** (Flex tokens) | ToS: «limited, **terminable, revocable, nontransferable**… license **during the Service Term**»· §6.1 απαγορεύει «sublicense, sell, resell, transfer, distribute… incorporate any portion of the Developer Offerings into Your Applications» (εκτός ρητής άδειας)· «All rights not expressly granted… are reserved (implied or otherwise)» | ❌ ΑΠΟΚΛΕΙΣΤΕΟ — proprietary, metered, ΟΧΙ redistributable· παραβιάζει #1+#2+#3 | 3-0 |

> Μόνη εξαίρεση: τα Autodesk-designated **redistributable Sample Code** repos (ξεχωριστά **MIT-licensed** στο GitHub, π.χ. `aps-extensions`, `aps-simple-viewer-nodejs`) μπορούν να ενσωματωθούν — αλλά **όχι ο Viewer/platform** ο ίδιος. Ασύμβατο με το «δωρεάν, χωρίς συνδρομή» — δεν είναι δρόμος για εμάς.

---

## (B) CONTENT PLATFORMS — η παγίδα επιβεβαιώθηκε· ΟΛΕΣ απαγορεύουν redistribution

| Πλατφόρμα | Όρος (verbatim) | Verdict | Verify |
|---|---|---|---|
| **BIMobject** | EULA §4.7(f): «rent, lease, distribute, sell, sublicense… to a third party» + §4.7(g): «incorporate any Services into a product or service you provide to a third party» — απαγορευμένα. Grant = «non-sublicensable and non-transferable», μόνο για δικά σου έργα. (effective 2025-06-24) | ❌ ΑΠΟΚΛΕΙΣΤΕΟ | 3-0 |
| **SketchUp 3D Warehouse** | FAQ verbatim: *«Can I incorporate models into my website for use by my members? **No, this is impermissible aggregation.**»* ToS: απαγόρευση «aggregate any content… for redistribution» + χρήση «that competes with 3D Warehouse». Grant «without the right to sublicense». | ❌ ΑΠΟΚΛΕΙΣΤΕΟ | 3-0 |
| **Polantis** | CGU: μόνο «limited personal non-commercial use»· απαγόρευση copy/reproduce/redistribute/derivative. (Εξαγοράστηκε από BIMobject 2019 → ίδια restrictive πολιτική) | ❌ ΑΠΟΚΛΕΙΣΤΕΟ | 2-1 |
| **MEPcontent / NBS** | Δεν επαληθεύτηκε πλήρως· εμπίπτουν στο ίδιο μοτίβο (δωρεάν για δικά σου έργα, ΟΧΙ redistribution) | ⚠️ ΘΕΩΡΗΣΕ ΑΠΑΓΟΡΕΥΜΕΝΟ μέχρι ρητή επιβεβαίωση | — |

**Αναλογία (για μη-τεχνικούς):** δωρεάν δείγμα σαμπουάν από super market — μπορείς να το βάλεις στο μπάνιο σου (δικό σου έργο), ΔΕΝ μπορείς να μαζέψεις 1.000 και να ανοίξεις δικό σου μαγαζί που τα πουλάει (το app σου).

---

## (B-θετικό) CC0 / PUBLIC-DOMAIN 3D CONTENT — οι ΜΟΝΕΣ πηγές που επιτρέπουν redistribution (PASS 2 verified)

| Πηγή | Άδεια | Redistribution κλειστό app; | Attribution; | Μορφή | BIM-grade; | Verify |
|---|---|---|---|---|---|---|
| **Poly Haven** (polyhaven.com/license) | **CC0 1.0** (όλα — HDRIs/textures/3D models) | ✅ ΝΑΙ — ρητά «redistribute… or even **in a product you sell**» | ❌ ΟΧΙ («do not need to give credit… although appreciated») | high-poly photogrammetry + PBR textures + HDRIs | ❌ ΟΧΙ — απλό geometry/PBR, **καμία IFC property** | 3-0 |
| **Khronos glTF-Sample-Assets** | **MIXED per-model** (CC0 / CC-BY 4.0 / proprietary) ⚠️ | ⚠️ ΜΟΝΟ το CC0 subset χωρίς attribution· CC-BY 4.0 → με attribution· proprietary → ΟΧΙ | εξαρτάται/ανά μοντέλο | app-ready glTF (κατάλληλα για three.js) | ❌ ΟΧΙ — plain geometry | 3-0 |

> 🔑 **Poly Haven = η καθαρότερη θετική πηγή.** CC0 → modify + redistribute σε προϊόν που πουλάς, **χωρίς attribution**. Ταιριάζει απόλυτα στο Δ.1 («CC0 σχήμα + δικά μας δεδομένα»). ⚠️ Caveat: high-poly → χρειάζεται decimation/retopo για realtime· οι μόνες απαγορεύσεις CC0 = «μην ισχυριστείς δική σου authorship» & «μην re-license» (εγγενή). Logos/branding & real-world trademark/likeness = ξεχωριστά ζητήματα.

> ⚠️ **glTF-Sample-Assets = ΑΝΑ ΜΟΝΤΕΛΟ έλεγχος.** Το repo είναι CC-BY 4.0 αλλά κάθε μοντέλο **υπερισχύει** με δικό του README.md. Παραδείγματα: «CC0 1.0» (Duck;), «© 2021 Wayfair, LLC. CC BY 4.0», proprietary (SCEA Shared Source, Cryengine Limited, 3DRT). **Κανόνας:** vet κάθε asset· μόνο τα CC0 περνούν το no-attribution φίλτρο.

> ❗ **ΕΠΙΒΕΒΑΙΩΘΗΚΕ το πόρισμα PASS 1: «σχεδόν κανένα CC0 δεν είναι BIM-grade».** Poly Haven + CC0 glTF subset = **μόνο geometry/PBR, καμία IFC property**. Άρα BIM εμπλουτισμός = δική μας δουλειά (ταυτίζεται με Δ.1). Για IFC-grade → ο μόνος καθαρός δρόμος υπό το φίλτρο = **parametric presets από facts** (δρόμος C).

> ⚠️ **ΜΗ-ΕΠΑΛΗΘΕΥΜΕΝΑ με 3-vote (budget):** Smithsonian Open Access (CC0), Wikimedia Commons (mixed CC0/CC-BY), ambientCG (CC0 textures). Πιθανότατα CC0/permissive αλλά **έλεγξε ανά asset** πριν χρήση — δεν μπήκαν στο verified top-25. Βλ. §Open Questions.

---

## (C) PUBLIC-DOMAIN DATA CATALOGS — ο ΑΣΦΑΛΕΣΤΕΡΟΣ δρόμος ⭐

**Αρχή:** Οι τυποποιημένες διαστάσεις δομικών στοιχείων (π.χ. χάλυβας HEA/HEB/IPE/UB/W-shapes — Eurocode/DIN/EN 10025/AISC) είναι **δεδομένα/γεγονότα**, όχι πνευματική ιδιοκτησία. Όπως «το νερό βράζει στους 100°C» ή τα νούμερα παπουτσιών — κανείς δεν έχει πατέντα στο «HEB 200 = ύψος 200mm».

**Συνέπεια:** Αντί να αποθηκεύουμε χιλιάδες έτοιμα αρχεία (που έχουν ιδιοκτήτη), αποθηκεύουμε **τις παραμέτρους** και το app **παράγει** τη γεωμετρία. Ο χρήστης επιλέγει «HEB 200» από λίστα → το app το ζωγραφίζει. **Μηδέν νομικό ρίσκο.** Είναι ήδη η αρχιτεκτονική μας (ADR-407 παραμετρικά κάγκελα, parametric κολώνες/δοκάρια).

### C.1 — Νομική ανάλυση: είναι οι διαστάσεις διατομών «δεδομένα» ή «πνευματική ιδιοκτησία»; (PASS 2 verified)

Τρία ανεξάρτητα νομικά επίπεδα — και τα τρία ευνοϊκά για εμάς:

| Επίπεδο | Πόρισμα | Πηγή (primary) | Verify |
|---|---|---|---|
| **Copyright περιεχομένου** | Οι αριθμητικές διαστάσεις είναι **μη-προστατεύσιμα γεγονότα**. Το database copyright προστατεύει ΜΟΝΟ την πρωτότυπη επιλογή/διάταξη, ΟΧΙ το περιεχόμενο. | EU Directive 96/9/EC Art. 3(2) + Recital 45· US *Feist* | 3-0 |
| **EU sui generis database right** | **ΔΕΝ** προστατεύει την επένδυση στη **ΔΗΜΙΟΥΡΓΙΑ** δεδομένων — μόνο στη **συλλογή** προϋπαρχόντων. Αφού η AISC **παράγει/τυποποιεί** τις διαστάσεις (δεν τις «μαζεύει»), πιθανότατα **εκτός** sui generis προστασίας. | CJEU **C-46/02** (Fixtures Marketing) + **C-203/02** (British Horseracing Board v William Hill), 9 Νοε 2004, Grand Chamber | 3-0 |
| **Contract / ToS** | Το AISC site ToS απαγορεύει ρητά verbatim copy της **compilation** του (βλ. C.2). Αυτό είναι **συμβατικός**, όχι copyright, φραγμός → λύνεται αντλώντας τα δεδομένα από permissive code, ΟΧΙ από το αρχείο της AISC. | steeltools.org/terms | 2-1 (primary-verified) |

> **🔑 Πρακτικό συμπέρασμα:** Οι **τιμές** (HEB 200 → ύψος 200mm) είναι ελεύθερες. Ο μόνος πραγματικός κίνδυνος είναι η **verbatim αντιγραφή της συγκεκριμένης compilation/αρχείου** ενός εκδότη. **Λύση:** αντλούμε τις διαστάσεις από **permissively-licensed πακέτα** (κάτω), ΟΧΙ από το AISC spreadsheet απευθείας.
>
> ⚠️ **CAVEAT (μη-νομική συμβουλή):** Το sui generis **μπορεί** ακόμη να μπλοκάρει εξαγωγή ουσιώδους μέρους όπου υπάρχει qualifying «obtaining» επένδυση (γραμμή C-762/19). Ο συντηρητικός δρόμος παραμένει: **permissive code, όχι verbatim AISC table.**

### C.2 — AISC Steel Shapes Database: ❌ ΟΧΙ ελεύθερη πηγή

| Πηγή | Όρος | Verdict | Verify |
|---|---|---|---|
| **AISC Shapes Database** (steeltools.org / aisc.org) | Footer: «©2026 AISC. **All Rights Reserved**». Terms: «limited to **personal, internal and noncommercial purposes only**» + «**shall not copy, reproduce, distribute… or create derivative works**». Ξεχωριστή **paid Commercial License** για embedding σε revenue-producing software. | ❌ ΑΠΟΚΛΕΙΣΤΕΟ ως άμεση πηγή (η **compilation** προστατεύεται συμβατικά· οι **τιμές** όχι — βλ. C.1) | 2-1 (primary-verified) |

### C.3 — Έτοιμες permissive πηγές διατομών → ✅ ΑΞΙΟΠΟΙΗΣΙΜΕΣ (αντλούμε ΑΠΟ ΕΔΩ)

| Πηγή | Άδεια | Redistribution κλειστό app; | Attribution; | Δεδομένα | Verify |
|---|---|---|---|---|---|
| **`steelpy`** (evanfaler/steelpy) | **Apache-2.0** ✅ | ✅ ΝΑΙ | ✅ ΝΑΙ (κράτα LICENSE + NOTICE) | Διατομές «**consistent with AISC Steel Construction Manual, 16th Ed.**» (imperial) ως Python objects | 3-0 |
| **`sectionproperties`** (robbievanleeuwen/section-properties) | **MIT** ✅ | ✅ ΝΑΙ | ✅ ΝΑΙ (κράτα copyright+permission notice) | Steel/structural section properties + υπολογισμός (release Ιαν 2026) | 3-0 |
| **`civilpy`** | **AGPL-3.0-or-later** | ❌ ΟΧΙ (network-copyleft §13) | — | AISC shapes ως Python classes — ΑΛΛΑ αποκλείεται από φίλτρο | 3-0 |

> ❗ **REFUTED (0-3):** Ο ισχυρισμός ότι το `steelpy` αντλεί ειδικά από «AISC Shapes Database v16.0» **ΔΕΝ** επιβεβαιώθηκε. Επικαλούμαστε ΜΟΝΟ το verified wording «**consistent with the 16th Ed. Manual**» — ΟΧΙ άμεση database-file provenance.

> ⚠️ **EN/DIN ΕΚΚΡΕΜΕΣ:** Το PASS 2 επαλήθευσε US/AISC-oriented πακέτα (steelpy/sectionproperties). Δεν βρέθηκε/επαληθεύτηκε permissive npm `steel-section` ή confirmed-license πηγή για **EN/DIN** διατομές (HEA/HEB/IPE/UB/UC, EN 10025, DIN 1025). Η νομική ανάλυση C.1 ισχύει εξίσου (facts), αλλά χρειάζεται ξεχωριστή verified code-πηγή. Βλ. §Open Questions.

**📌 Πρακτική σύσταση:** Αντλούμε τις παραμετρικές διαστάσεις από **`steelpy` (Apache-2.0)** ή/και **`sectionproperties` (MIT)** — κράτημα του LICENSE/NOTICE — και τις αποθηκεύουμε ως δικά μας parametric presets. ΟΧΙ verbatim copy του AISC spreadsheet.

---

## (D) ΥΒΡΙΔΙΚΟΣ ΚΑΤΑΛΟΓΟΣ — CC0 enrichment + parametric (επίσημη κατεύθυνση)

**Αρχή:** Συνδυάζουμε δύο νόμιμα-καθαρές πηγές ανάλογα με τη φύση του στοιχείου.

### Δ.1 — «CC0 σχήμα + δικά μας δεδομένα» (fixed-shape στοιχεία)
Παίρνουμε ένα **CC0 / public-domain** 3D μοντέλο (geometry χωρίς καμία δέσμευση) και του **προσθέτουμε εμείς** το BIM επίπεδο: properties (υλικό, διαστάσεις, κατηγορία, κωδικός, τιμή), IFC classification, ΑΤΟΕ BOQ link.

> 🔑 **Νομικά ισχυρότατο:** το CC0 επιτρέπει ρητά modification + redistribution χωρίς attribution. Μόλις προσθέσουμε τα δεδομένα, **εμείς είμαστε ο δημιουργός** του BIM αντικειμένου — geometry ελεύθερο, metadata δικό μας → 100% καθαρό για εμπορική αναδιανομή.

**Κατάλληλο για:** είδη υγιεινής (νιπτήρες/λεκάνες/μπαταρίες), φωτιστικά, έπιπλα, ντουλάπια, MEP εξοπλισμό (κλιματιστικά/ψυγεία/μηχανήματα) — οτιδήποτε έχει **σταθερό σχήμα** (δεν «τεντώνει» παραμετρικά).

### Δ.2 — Parametric presets (structural στοιχεία)
Στοιχεία που πρέπει να **αλλάζουν διάσταση** (δοκάρι, κολώνα, κάγκελο, τοίχος) ΔΕΝ ταιριάζουν με παγωμένο CC0 mesh — παραμορφώνονται. Παραμένουν στον δρόμο (C): parametric generation από public-domain διαστάσεις. (Ήδη υλοποιημένο: ADR-407 railings, parametric columns/beams.)

### Συνεπαγωγή για το UI «ο χρήστης επιλέγει»
Ένας **ενιαίος κατάλογος** με δύο τύπους εγγραφών: (α) fixed-shape items (CC0-derived mesh + properties) και (β) parametric types (presets). Ο χρήστης διαλέγει διαφανώς κι από τα δύο.

### ⚠️ Καveat ποιότητας
Πολλά CC0 (ειδικά photogrammetry/μουσειακά σαρώματα, π.χ. Smithsonian) είναι **high-poly & ακατάστατα** → ακατάλληλα για realtime app χωρίς retopo/decimation. Προτίμηση σε **app-ready** πηγές (π.χ. Khronos glTF Sample Assets — ήδη στη μορφή του three.js stack). Το manual enrichment ανά αντικείμενο έχει κόστος → οικονομικό μόνο για επιλεγμένα «hero» στοιχεία, όχι μαζικά χιλιάδες.

---

## Open Questions / Εκκρεμή

### ✅ ΕΚΛΕΙΣΑΝ στο PASS 2 (2026-06-02)
- ~~(C) AISC Shapes Database terms~~ → ❌ All Rights Reserved, paid commercial license (C.2)· οι **τιμές** όμως ελεύθερες (C.1).
- ~~(C) EN/DIN copyright σε πίνακες διαστάσεων~~ → facts, μη-προστατεύσιμα (C.1)· **ΑΛΛΑ** χωρίς verified EN/DIN code-πηγή ακόμη (βλ. παρακάτω).
- ~~(C) άδειες έτοιμων πηγών~~ → **steelpy=Apache-2.0 ✅, sectionproperties=MIT ✅, civilpy=AGPL ❌** (C.3).
- ~~(B-θετικό) Poly Haven / Khronos glTF~~ → **Poly Haven=CC0 ✅ no-attribution· glTF=mixed per-model ⚠️** (B-θετικό).
- ~~Είναι κανένα CC0 BIM-grade;~~ → **ΟΧΙ** (επιβεβαιώθηκε)· μόνο geometry/PBR.
- ~~Autodesk Forge/APS~~ → ❌ proprietary metered SaaS, ΟΧΙ redistributable (A.1).

### 🔴 ΑΚΟΜΗ ΕΚΚΡΕΜΗ
1. **EN/DIN verified code-πηγή:** βρες/επαλήθευσε permissive (MIT/BSD/CC0) npm ή lib με **EN/DIN** διατομές (HEA/HEB/IPE/UB/UC, EN 10025, DIN 1025) — το PASS 2 επαλήθευσε μόνο US/AISC (steelpy/sectionproperties). Ο `steel-section` (npm) & StructPy ΔΕΝ επαληθεύτηκαν με license.
2. **CC0 app-ready λίστα:** ποια συγκεκριμένα CC0 μοντέλα (glTF-Sample-Assets κ.ά.) είναι clean/low-poly έτοιμα για BIM viewer χωρίς decimation.
3. **Smithsonian / Wikimedia / ambientCG:** επιβεβαίωσε ανά-asset CC0 (κατέβηκαν αλλά όχι 3-vote verified).
4. **AISC paid Commercial License:** όροι & κόστος — αξίζει ως καθαρή εναλλακτική του facts-extraction δρόμου;
5. **Απόφαση Giorgio (εκκρεμεί):** Δεχόμαστε weak-copyleft engines (web-ifc=MPL) που νόμιμα bundle-άρονται *unmodified* — ή κρατάμε αυστηρά permissive-only;

---

## Sources (primary, cited)

**Engines:**
- web-ifc / ThatOpen — https://github.com/ThatOpen/engine_web-ifc · https://www.mozilla.org/MPL/2.0/
- xeokit — https://github.com/xeokit/xeokit-sdk/wiki/License · https://xeokit.io/docs/terms/affero-gpl-agpl/
- IfcOpenShell — https://github.com/ifcopenshell/ifcopenshell · https://docs.ifcopenshell.org/
- Open CASCADE — https://github.com/Open-Cascade-SAS/OCCT · https://spdx.org/licenses/OCCT-exception-1.0.html · https://dev.opencascade.org/resources/licensing
- occt-import-js — https://github.com/kovacsv/occt-import-js

**Content ToS:**
- BIMobject EULA — https://business.bimobject.com/terms-of-service-eula/
- SketchUp 3D Warehouse — https://help.sketchup.com/en/3d-warehouse/understanding-terms-use · https://3dwarehouse.sketchup.com/tos
- Polantis CGU — https://www.polantis.com/CGU/

**(C) structural data — PASS 2 verified:**
- AISC Shapes Database ToS (❌ All Rights Reserved) — https://www.steeltools.org/shapes.php · https://www.steeltools.org/terms.php
- **steelpy (Apache-2.0 ✅)** — https://github.com/evanfaler/steelpy · https://pypi.org/project/steelpy/
- **section-properties (MIT ✅)** — https://github.com/robbievanleeuwen/section-properties · https://doi.org/10.21105/joss.06105
- civilpy (AGPL-3.0 ❌) — https://pypi.org/project/civilpy/
- StructPy (εκκρεμεί license-verify) — https://github.com/BrianChevalier/StructPy

**Νομική βάση (C) — primary:**
- EU Database Directive 96/9/EC — https://eur-lex.europa.eu/eli/dir/1996/9/oj/eng
- CJEU C-203/02 (British Horseracing Board v William Hill) — https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:62002CJ0203
- CJEU C-46/02 (Fixtures Marketing) — https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:62002CJ0046

**(B-θετικό) CC0 content — PASS 2 verified:**
- **Poly Haven (CC0 ✅)** — https://polyhaven.com/license · https://github.com/Poly-Haven/polyhaven.com/blob/master/LICENSE
- **Khronos glTF Sample Assets (mixed per-model ⚠️)** — https://github.com/KhronosGroup/glTF-Sample-Assets
- awesome-cc0 — https://github.com/madjin/awesome-cc0

**(A.1) Autodesk Forge/APS — PASS 2 verified:**
- APS Platform ToS (❌ proprietary metered) — https://www.autodesk.com/company/legal-notices-trademarks/terms-of-service-autodesk360-web-services/forge-platform-web-services-api-terms-of-service

---

## Μεθοδολογία επαλήθευσης

**PASS 1** (A+B engines/content): 5 search angles → 22 πηγές → 84 claims → top 25 με **3-vote adversarial verification** (≥2/3 refutes = kill). 24 confirmed / 1 killed. 104 agents, ~41 λεπτά. Όλα A+B = high confidence (3-0), εκτός Polantis (2-1).

**PASS 2** (C structural data + B-θετικό CC0 + Forge/APS): 6 search angles → 24 πηγές → 71 claims → top 25 με 3-vote verification. **23 confirmed / 2 killed.** 107 agents, ~41 λεπτά, 2026-06-02. Killed: steelpy «v16.0 provenance» (0-3), «AISC page no-EULA» (0-3). Νομική βάση C.1 = primary CJEU/EUR-Lex (3-0).

---

## Changelog

| Έκδοση | Ημ/νία | Αλλαγή |
|---|---|---|
| v1.0 | 2026-06-02 | Αρχική δημιουργία. Τεκμηρίωση deep-research: engine licenses (A), content-ToS trap (B), parametric-presets δρόμος (C). Πολιτική: web-ifc (MPL) OK· content platforms ΑΠΑΓΟΡΕΥΜΕΝΕΣ· parametric presets = προτιμώμενος δρόμος. (C) & (B-θετικό) εκκρεμούν 2ο pass. Opus 4.8. |
| v1.1 | 2026-06-02 | +Κατηγορία (D) ΥΒΡΙΔΙΚΟΣ ΚΑΤΑΛΟΓΟΣ (επίσημη κατεύθυνση μετά συζήτηση Giorgio): Δ.1 «CC0 σχήμα + δικά μας δεδομένα» για fixed-shape στοιχεία (είδη υγιεινής/φωτιστικά/έπιπλα/MEP εξοπλισμός — νομικά καθαρό, εμείς ο BIM δημιουργός)· Δ.2 parametric presets για structural (τεντώνουν)· ενιαίο UI κατάλογος· caveat ποιότητας (app-ready vs high-poly scans). Opus 4.8. |
| v1.2 | 2026-06-02 | **PASS 2 deep-research (107 agents, 23 confirmed / 2 killed, 24 sources).** Έκλεισε τα Open Questions των κατηγοριών (C) & (B-θετικό) + Forge/APS: **(C)** νομική ανάλυση 3 επιπέδων (C.1: facts μη-προστατεύσιμα EU 96/9/EC Art.3· sui generis ΔΕΝ καλύπτει creation per CJEU C-46/02 & C-203/02· μόνο ToS-φραγμός στη verbatim compilation)· **C.2** AISC Shapes DB = ❌ All Rights Reserved/paid· **C.3** ✅ steelpy (Apache-2.0) + sectionproperties (MIT) ως αξιοποιήσιμες code-πηγές, civilpy (AGPL) ❌· REFUTED η «v16.0 provenance» του steelpy (μόνο «consistent w/ 16th Ed.»). **(B-θετικό)** ✅ Poly Haven = CC0 no-attribution redistributable· glTF-Sample-Assets = mixed per-model ⚠️· επιβεβαιώθηκε «κανένα CC0 δεν είναι BIM-grade». **(A.1)** ❌ Autodesk Forge/APS = proprietary metered SaaS, ΟΧΙ redistributable. Εκκρεμή: EN/DIN verified code-πηγή, CC0 app-ready λίστα, Smithsonian/Wikimedia/ambientCG per-asset. Opus 4.8. |
