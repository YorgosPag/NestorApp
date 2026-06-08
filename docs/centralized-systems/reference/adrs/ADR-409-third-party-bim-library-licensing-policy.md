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

## Decision — η πολιτική σε 4 γραμμές

1. **Engine:** Χρησιμοποιούμε **web-ifc / ThatOpen (MPL-2.0)** *unmodified* — νόμιμο bundling σε κλειστό app χωρίς δημοσίευση δικού μας κώδικα. ΑΠΑΓΟΡΕΥΟΝΤΑΙ: xeokit (AGPL), IfcOpenShell (LGPL), Open CASCADE/occt-import-js (LGPL).
2. **Έτοιμο περιεχόμενο (3D αρχεία):** ΑΠΑΓΟΡΕΥΕΤΑΙ από BIMobject / SketchUp 3D Warehouse / Polantis — τα ToS τους απαγορεύουν ρητά την αναδιανομή σε προϊόν μας. Επιτρέπεται **μόνο** CC0/public-domain περιεχόμενο: **Poly Haven = CC0, redistribution σε προϊόν που πουλάς ✅ χωρίς attribution (PASS 2 verified)**· Khronos glTF-Sample-Assets = mixed per-model (μόνο CC0 subset). ⚠️ Κανένα δεν είναι BIM-grade (μόνο geometry). Επίσης ❌ Autodesk Forge/APS = proprietary metered SaaS (A.1).
3. **Κατάλογος «ο χρήστης επιλέγει» (ΠΡΟΤΙΜΩΜΕΝΟΣ ΔΡΟΜΟΣ):** **Παραμετρικά presets** από public-domain μηχανική γνώση (τυποποιημένες διατομές HEA/HEB/IPE κ.λπ.). Είναι **δεδομένα/facts** → μηδέν νομικό ρίσκο (νομική βάση: C.1). Αντλούμε από **steelpy (Apache-2.0)** / **sectionproperties (MIT)** (US/AISC) ή **eurocodepy (MIT)** (EN/DIN), ΟΧΙ verbatim από το AISC spreadsheet (C.3/C.4). Είναι ήδη η αρχιτεκτονική μας (ADR-407 RailingType, parametric columns/beams).
4. **🔒 ΚΑΝΟΝΑΣ «facts vs derived works» (PASS 3, ΔΕΣΜΕΥΤΙΚΟΣ):** Οι **ονομαστικές διαστάσεις** (b/h/tf/tw) = facts → ελεύθερη ανατρανσκριβή/αναδιανομή από οποιαδήποτε δημόσια πηγή (ΟΧΙ verbatim compilation, ΟΧΙ ToS-restricted πηγή). ΟΜΩΣ οι **υπολογισμένες structural properties** (A, mass, Iy, Iz, Wel, Wpl) = **derived/computed works** με μεγαλύτερο copyright/sui-generis ρίσκο → επιτρέπεται να ενσωματωθούν **ΜΟΝΟ από permissive-licensed πηγή** (MIT/Apache/BSD/CC0, π.χ. eurocodepy), **ΠΟΤΕ** από Blue Book (SCI © all-rights-reserved) ή eurocodeapplied (ToS). Αιτιολογία/πηγές: C.4.

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
| **Kenney** (kenney.nl, Furniture Kit License.txt) | **CC0 1.0** (verbatim: «free to use in personal, educational **and commercial** projects») | ✅ ΝΑΙ — CC0, redistribution σε εμπορικό προϊόν ελεύθερη· crediting «not mandatory» | ❌ ΟΧΙ | **app-ready low-poly** game-art `.glb`/OBJ/FBX/glTF (ιδανικό μέγεθος για realtime) | ❌ ΟΧΙ — plain geometry, καμία IFC property· **stylized look** (όχι PBR/φωτορεαλιστικό) | manual-verified 2026-06-03 (License.txt στο kit) |
| **Khronos glTF-Sample-Assets** | **MIXED per-model** (CC0 / CC-BY 4.0 / proprietary) ⚠️ | ⚠️ ΜΟΝΟ το CC0 subset χωρίς attribution· CC-BY 4.0 → με attribution· proprietary → ΟΧΙ | εξαρτάται/ανά μοντέλο | app-ready glTF (κατάλληλα για three.js) | ❌ ΟΧΙ — plain geometry | 3-0 |

> 🔑 **Poly Haven = η καθαρότερη θετική πηγή.** CC0 → modify + redistribute σε προϊόν που πουλάς, **χωρίς attribution**. Ταιριάζει απόλυτα στο Δ.1 («CC0 σχήμα + δικά μας δεδομένα»). ⚠️ Caveat: high-poly → χρειάζεται decimation/retopo για realtime· οι μόνες απαγορεύσεις CC0 = «μην ισχυριστείς δική σου authorship» & «μην re-license» (εγγενή). Logos/branding & real-world trademark/likeness = ξεχωριστά ζητήματα.

> ⚠️ **glTF-Sample-Assets = ΑΝΑ ΜΟΝΤΕΛΟ έλεγχος.** Το repo είναι CC-BY 4.0 αλλά κάθε μοντέλο **υπερισχύει** με δικό του README.md. Παραδείγματα: «CC0 1.0» (Duck;), «© 2021 Wayfair, LLC. CC BY 4.0», proprietary (SCEA Shared Source, Cryengine Limited, 3DRT). **Κανόνας:** vet κάθε asset· μόνο τα CC0 περνούν το no-attribution φίλτρο.

> ❗ **ΕΠΙΒΕΒΑΙΩΘΗΚΕ το πόρισμα PASS 1: «σχεδόν κανένα CC0 δεν είναι BIM-grade».** Poly Haven + CC0 glTF subset = **μόνο geometry/PBR, καμία IFC property**. Άρα BIM εμπλουτισμός = δική μας δουλειά (ταυτίζεται με Δ.1). Για IFC-grade → ο μόνος καθαρός δρόμος υπό το φίλτρο = **parametric presets από facts** (δρόμος C).

> ⚠️ **ΜΗ-ΕΠΑΛΗΘΕΥΜΕΝΑ με 3-vote (budget):** Smithsonian Open Access (CC0), Wikimedia Commons (mixed CC0/CC-BY), ambientCG (CC0 textures). Πιθανότατα CC0/permissive αλλά **έλεγξε ανά asset** πριν χρήση — δεν μπήκαν στο verified top-25. Βλ. §Open Questions.

### (B-θετικό.2) ΕΠΕΚΤΑΣΗ ΠΟΛΙΤΙΚΗΣ — CC-BY 4.0 ΕΠΙΤΡΕΠΕΤΑΙ ΓΙΑ MESH CONTENT (απόφαση Giorgio 2026-06-03, v1.5)

**Πρόβλημα:** μοντέρνο **φωτορεαλιστικό PBR** έπιπλο **ΔΕΝ υπάρχει σε καθαρό CC0**. Επιβεβαιώθηκε εμπειρικά (2026-06-03): Poly Haven sofas = ΟΛΟΙ vintage· Kenney/Quaternius = low-poly stylized· Sketchfab CC0 downloadable sofas = **0**. Ο περιορισμός «μόνο CC0» απέκλειε εξ ορισμού κάθε μοντέρνο PBR έπιπλο.

**Απόφαση:** για **mesh-based content** (έπιπλα/φωτιστικά/props — ΟΧΙ structural δεδομένα) επιτρέπεται πλέον **CC0 + CC-BY 4.0**. Η CC-BY είναι πλήρως permissive για κλειστό/εμπορικό προϊόν: επιτρέπει modification + redistribution + commercial use, με **μοναδική υποχρέωση την αναφορά δημιουργού (attribution)**.

| Άδεια | Redistribution κλειστό/εμπορικό app | Υποχρέωση |
|---|---|---|
| CC0 1.0 | ✅ | καμία |
| **CC-BY 4.0** | ✅ | **αναφορά δημιουργού (όνομα + πηγή + άδεια)** |
| CC-BY-SA | ⚠️ μόνο αν δεχόμαστε ShareAlike σε παράγωγα | attribution + same-license derivatives |
| CC-BY-NC / -ND | ❌ ΑΠΑΓΟΡΕΥΜΕΝΕΣ | non-commercial / no-derivatives → ασύμβατες |

> 🔑 **Συμμόρφωση:** κάθε catalog entry έχει ΗΔΗ πεδίο `source` (`furniture-catalog.ts`). Για CC-BY asset → `source: '<Όνομα έργου> by <Δημιουργός> (CC-BY) — <URL>'`. **Νομικό caveat (HONESTY):** η CC-BY απαιτεί η αναφορά να είναι «reasonable to the medium» — ένα **κρυφό DB πεδίο δεν αρκεί** από μόνο του. Χρειάζεται (deferred) ορατή οθόνη **«Credits / Άδειες»** στην app που να λιστάρει τα `source`. Μέχρι τότε κρατάμε πλήρη attribution metadata ανά asset ώστε η credits-UI να παραχθεί αυτόματα. ⚠️ Ισχύει ΜΟΝΟ για content (CC-BY)· για **npm/engine code** ο κανόνας **N.5 παραμένει** (MIT/Apache/BSD μόνο, CC-BY δεν αφορά κώδικα).

> **Πηγές CC-BY mesh:** Sketchfab (φίλτρο `license=by` + `downloadable=true`· επιβεβαιωμένα άφθονοι μοντέρνοι PBR καναπέδες), BlenderKit free tier, Khronos glTF-Sample-Assets CC-BY subset. ⚠️ **Sketchfab download = OAuth/API-token** (όχι direct link όπως Poly Haven/Kenney).

> 🛏️ **ΕΥΡΗΜΑ 2026-06-03 (ADR-410 v1.9 — κρεβάτια):** Αναζήτηση μοντέρνου CC0 κρεβατιού στις δύο verified-φιλικές πηγές απέτυχε: **Poly Haven** έχει μόνο vintage `GothicBed_01`· **Sketchfab CC0** corpus (API `licenses=cc0`) είναι ~αποκλειστικά μουσειακά/απολιθώματα/αρχαιολογικά scans (high-poly) — **μηδέν μοντέρνο app-ready κρεβάτι ή καναπές**. Συμπέρασμα: **φωτορεαλιστικό μοντέρνο CC0 έπιπλο-κρεβάτι ουσιαστικά δεν υπάρχει** στις redistribution-safe πηγές. **Η ΜΟΝΗ γνήσια-CC0 + app-ready κατηγορία με μοντέρνα κρεβάτια = game-asset libraries (Kenney.nl, Quaternius)** — low-poly stylized (όχι PBR), αλλά CC0 + ιδανικό poly-count (δεν χρειάζονται decimation σε αντίθεση με το Poly Haven caveat §D). Trade-off: stylized look ≠ φωτορεαλιστικές Poly Haven καρέκλες/τραπέζια (απόφαση Giorgio: αποδεκτό για κρεβάτια).

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

> ✅ **EN/DIN ΕΚΛΕΙΣΕ στο PASS 3 (2026-06-03):** Βρέθηκε & επαληθεύτηκε permissive EN πηγή — **`eurocodepy` (MIT)**. Βλ. **§C.4** για πλήρη ανάλυση + verdict στον υπάρχοντα `ISHAPE_CATALOG`.

**📌 Πρακτική σύσταση (US/AISC):** Αντλούμε τις παραμετρικές διαστάσεις από **`steelpy` (Apache-2.0)** ή/και **`sectionproperties` (MIT)** — κράτημα του LICENSE/NOTICE — και τις αποθηκεύουμε ως δικά μας parametric presets. ΟΧΙ verbatim copy του AISC spreadsheet. **Για EN/DIN → βλ. §C.4 (`eurocodepy`).**

### C.4 — EN/DIN διατομές: VERIFY υπάρχοντος καταλόγου + permissive πηγή (PASS 3 verified, 2026-06-03)

Deep-research PASS 3 (102 agents, 6 angles → 19 πηγές → 68 claims → top-25 με 3-vote, 23 confirmed / 2 killed, ~44 λεπτά). Δύο στόχοι: **(Α)** νομική στερεότητα του **υπάρχοντος** `ISHAPE_CATALOG` (75 EN 10365 διατομές, hand-curated, `src/subapps/dxf-viewer/bim/columns/section-catalog.ts`) και **(Β)** permissive EN/DIN πηγή για cross-check + επέκταση.

#### Α) VERDICT στον υπάρχοντα `ISHAPE_CATALOG` → ✅ **ΝΟΜΙΚΑ ΑΣΦΑΛΗΣ — ΚΡΑΤΑ ΤΟΝ ΩΣ ΕΧΕΙ**

Η αποθήκευση/αναδιανομή των **ονομαστικών αριθμητικών διαστάσεων** (b, h, tf, tw) είναι νομικά ασφαλής στην ΕΕ, σε τρία επίπεδα — και τα τρία ευνοϊκά:

| Επίπεδο | Πόρισμα | Πηγή (primary) | Verify |
|---|---|---|---|
| **Copyright περιεχομένου** | Το copyright βάσης προστατεύει **μόνο τη δομή** (επιλογή/διάταξη), **ΟΧΙ το περιεχόμενο** — οι μεμονωμένες αριθμητικές τιμές = μη-προστατεύσιμα γεγονότα | Οδηγία 96/9/ΕΚ **Art. 3(2)** («copyright protection… shall not extend to their contents») + europa.eu | 3-0 |
| **EU sui generis** | Προστατεύει επένδυση στην **ΑΠΟΚΤΗΣΗ/επαλήθευση/παρουσίαση** προϋπαρχόντων δεδομένων, **ΟΧΙ στη ΔΗΜΙΟΥΡΓΙΑ** τους· η ανεξάρτητη ανατρανσκριβή γεγονότων δεν εμπίπτει | CJEU **C-203/02** (BHB v William Hill, Grand Chamber 9.11.2004) + **C-46/02** (Fixtures Marketing)· **C-762/19** (CV-Online Latvia, 2021) εκλεπτύνει αλλά **ΔΕΝ** ανατρέπει τη διάκριση obtaining-vs-creating | 3-0 |
| **CEN/DIN/SCI** | Διεκδικούν copyright **ΜΟΝΟ στο κείμενο/έγγραφο/layout** του προτύπου (μέσω συμβάσεων μεταβίβασης), **ΟΧΙ** στις ανεξάρτητα ξαναπληκτρολογημένες αριθμητικές τιμές (idea/expression dichotomy) | din.de/…/standards-and-copyright· EU General Court **T-185/19** (Public.Resource.Org, 14.7.2021) | 3-0 |

> 🔑 **Μόνος υπολειπόμενος κίνδυνος = ΣΥΜΒΑΤΙΚΟΣ (ToS), ΟΧΙ copyright:** το **eurocodeapplied.com** (μία από τις 4 πηγές που χρησιμοποιήθηκαν) φέρει «© All rights reserved» + Terms: *«You must not republish the material… without prior written permission.»* Αυτή η συμβατική απαγόρευση είναι ανεξάρτητη από το copyright (που δεν καλύπτει τα γεγονότα), αλλά παραμένει μη-μηδενική έκθεση για ό,τι αντλήθηκε ΑΠΟ ΕΚΕΙ. **Μετριασμός (ήδη ισχύει):** οι τιμές αντλήθηκαν από **πολλαπλές ανεξάρτητες πηγές** (wermac.org, structolution.com, projectmaterials, eurocodeapplied) → ανεξάρτητη φύση των γεγονότων· οι ίδιες τιμές βρίσκονται σε δεκάδες πηγές. **Σύσταση:** τεκμηρίωσε την προέλευση στο doc-header ως «ανεξάρτητη ανατρανσκριβή ονομαστικών γεγονότων από πολλαπλές δημόσιες πηγές» (ήδη γίνεται) — προαιρετικά αφαίρεσε το eurocodeapplied από τη λίστα πηγών για μηδενισμό και της συμβατικής έκθεσης (οι τιμές υπάρχουν στις άλλες 3).

> ⚠️ **ΚΡΙΣΙΜΗ ΔΙΑΚΡΙΣΗ — ονομαστικές διαστάσεις vs structural properties:** Το «facts» επιχείρημα είναι **ισχυρό** για τις bare ονομαστικές διαστάσεις (b, h, tf, tw) που ΗΔΗ έχει ο κατάλογος. Οι **υπολογισμένες ιδιότητες** (Iy, Iz, Wel, Wpl, A, mass) είναι **derived/computed works** → φέρουν **μεγαλύτερο** επιχείρημα copyright/sui-generis (π.χ. SCI-computed Blue Book). Άρα η μελλοντική **επέκταση σε properties** πρέπει να γίνει **ΜΟΝΟ από MIT πηγή** (eurocodepy), **ΟΧΙ** από Blue Book / eurocodeapplied.

#### Β) Permissive EN/DIN πηγή → ✅ **ΝΙΚΗΤΗΣ: `eurocodepy` (MIT)**

| Πηγή | Άδεια | Redistribution closed app; | Δεδομένα | Verify |
|---|---|---|---|---|
| **`eurocodepy`** (pcachim) | **MIT** ✅ (LICENSE.md verbatim + PyPI classifier «OSI Approved :: MIT») | ✅ ΝΑΙ — closed-source εμπορικό bundling, μόνη υποχρέωση = διατήρηση notice | **IPE / HEA / HEB / HEM** + CHS/RHS/SHS ως named dataclasses με **A, Iy, Iz, Wpl_y, It, Iw** (JSON `eurocodes.json`, παράγωγο EN 10365) | 3-0 |
| **`sectionproperties`** (robbievanleeuwen) | **MIT** ✅ | ✅ ΝΑΙ | ⚠️ **ΥΠΟΛΟΓΙΖΕΙ** properties από user-geometry (FEM)· **ΔΕΝ** φέρνει named-section lookup (κανένα `IPE300 → dims`) | 3-0 |

> 🔑 **Σύσταση Β:** Χρησιμοποίησε το **`eurocodepy` (MIT)** ως **ανεξάρτητη τρίτη πηγή cross-check** των 75 υπαρχουσών τιμών, και ως πηγή για μελλοντική επέκταση σε structural properties (A/Iy/Iz/Wpl). Κράτημα του MIT notice. Το `sectionproperties` (MIT) είναι χρήσιμο για **επαλήθευση properties μέσω FEM** από geometry, ΟΧΙ ως catalog.

> ✅ **CROSS-CHECK ΕΚΤΕΛΕΣΤΗΚΕ 2026-06-03:** Σύγκριση και των 75 τιμών του `ISHAPE_CATALOG` (b/h/tf/tw) έναντι του dataset `src/eurocodepy/data/i_profiles_euro.json` (MIT, σε εκατοστά → ×10 mm) → **75/75 ακριβής ταύτιση, 0 mismatch, 0 missing.** Ανεξάρτητη τρίτη επιβεβαίωση ορθότητας + κατοχύρωση «multiple independent sources» για το facts επιχείρημα. **+Provenance fix στον κώδικα:** αφαιρέθηκε το `eurocodeapplied.com` (μόνη ToS-restricted πηγή) από το doc-header → μηδενισμός συμβατικής έκθεσης.

**⚠️ Caveats `eurocodepy`:**
1. **GitHub auto-detector → «NOASSERTION/Other»** (cosmetic artifact: header `# License` + curly quotes) — το LICENSE.md είναι **verbatim MIT**· ίσως χρειαστεί manual confirmation σε SBOM/license-scan.
2. «Copyright **2026**» = future-dated notice (cosmetic).
3. Το repo δηλώνει *«not affiliated with CEN — verify against official Eurocode»* → η **ορθότητα** των τιμών χρειάζεται πραγματικό cross-check (όχι μόνο license verification· βλ. §Open Questions).
4. **ΠΕΡΙΟΡΙΣΜΟΣ:** ΔΕΝ περιέχει βρετανικά **UB/UC** (universal beams/columns) — καλύπτει μόνο τις 4 ευρωπαϊκές οικογένειες (που είναι ακριβώς αυτές που έχει ο κατάλογός μας).

#### ❌ ΑΠΟΚΛΕΙΣΤΗΚΑΝ (verified)

| Πηγή | Λόγος | Verify |
|---|---|---|
| **Blue Book** (steelforlifebluebook.co.uk) | © SCI «All rights reserved»· «may not be reproduced… without prior permission in writing»· οι structural properties = SCI-computed derived works (πραγματικό copyright/DB-right ρίσκο, ΟΧΙ απλά γεγονότα). «Freely available» = δωρεάν ΘΕΑΣΗ, ΟΧΙ άδεια αναδιανομής | 3-0 |
| **FreeCAD `profiles.csv`** | **LGPL-2.1** (copyleft) → εκτός permissive φίλτρου. (Οι raw τιμές μπορεί να είναι γεγονότα, αλλά το **πακέτο/αρχείο** δεν είναι permissive candidate) | 3-0 |
| **eurocodeapplied.com** | ToS: ρητή απαγόρευση republication (συμβατικός φραγμός — βλ. Α παραπάνω) | 3-0 |

#### 🔪 2 REFUTED claims (3-vote kill — η συνολική ασφάλεια ΔΕΝ εξαρτάται από αυτά)
- **(0-3)** «Η σελίδα DIN *αφήνει ρητά ανοιχτό* το fact-argument» → απορρίφθηκε: απλώς **δεν το θίγει** (δεν το επιβεβαιώνει ρητά).
- **(0-3)** «Το sui generis *συνεπάγεται* ότι μη-ουσιώδη μέρη είναι αυτομάτως ελεύθερα» → απορρίφθηκε ως overreach (το δικαίωμα αφορά εξαγωγή **ουσιώδους** μέρους· δεν «νομιμοποιεί αυτόματα» τα insubstantial).

> ⚠️ **Disclaimer:** technical/legal research, ΟΧΙ formal legal advice. Για εμπορική προϊοντική απόφαση → έλεγχος από νομικό IP της ΕΕ.

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

### ✅ ΕΚΛΕΙΣΑΝ στο PASS 3 (2026-06-03)
- ~~(C) EN/DIN verified permissive code-πηγή~~ → ✅ **`eurocodepy` = MIT** (IPE/HEA/HEB/HEM + properties)· `sectionproperties`=MIT (compute-only)· **Blue Book ❌ SCI all-rights-reserved**, FreeCAD profiles.csv ❌ LGPL-2.1, eurocodeapplied ❌ ToS (C.4).
- ~~(C) VERIFY υπάρχοντος `ISHAPE_CATALOG`~~ → ✅ **ΝΟΜΙΚΑ ΑΣΦΑΛΗΣ, ΚΡΑΤΑ ΤΟΝ ΩΣ ΕΧΕΙ** (facts, 3 επίπεδα ευνοϊκά)· μόνος υπολειπόμενος = συμβατικός ToS του eurocodeapplied (μετριασμένος από πολλαπλές πηγές) (C.4-Α).

### 🔴 ΑΚΟΜΗ ΕΚΚΡΕΜΗ
1. **UB/UC (βρετανικές) permissive πηγή:** κανείς verified candidate (eurocodepy/sectionproperties) ΔΕΝ φέρνει UB/UC named-section catalog. Αν χρειαστούν → ανεξάρτητη re-transcription (facts, δρόμος C.4-Α) από non-Blue-Book πηγή. **Δεν είναι blocker** — ο κατάλογός μας έχει τις 4 ευρωπαϊκές οικογένειες.
2. **eurocodepy properties ορθότητα:** πραγματικό cross-check των Iy/Iz/Wpl με επίσημες EN 10365 / ECCS τιμές (το PASS 3 επαλήθευσε **άδεια**, ΟΧΙ αριθμητική ακρίβεια). Απαιτείται πριν επέκταση σε properties.
3. **eurocodepy data provenance:** ο maker δηλώνει «not affiliated with CEN» — από ποια public πηγή· υπάρχει μεταβιβαζόμενο ToS/provenance ρίσκο;
4. **CC0 app-ready λίστα:** ποια συγκεκριμένα CC0 μοντέλα (glTF-Sample-Assets κ.ά.) clean/low-poly για BIM viewer χωρίς decimation. → **ΕΞΕΛΙΞΗ (2026-06-03):** ο δρόμος §D.1 ενεργοποιείται μέσω **ADR-410** (mesh-import subsystem για CC0 έπιπλα από Poly Haven). Το ADR-410 αντιμετωπίζει το poly-count caveat με build-time decimation + manual «hero» επιλογή (ξεκινώντας με λίγα). Η εξαντλητική app-ready λίστα παραμένει ανοιχτή — το ADR-410 ξεκινά per-asset (vertical slice: 1 καρέκλα).
5. **Smithsonian / Wikimedia / ambientCG:** επιβεβαίωσε ανά-asset CC0.
6. **AISC paid Commercial License:** όροι & κόστος — αξίζει ως καθαρή εναλλακτική;
7. **Απόφαση Giorgio (εκκρεμεί):** Δεχόμαστε weak-copyleft engines (web-ifc=MPL) που νόμιμα bundle-άρονται *unmodified* — ή κρατάμε αυστηρά permissive-only;

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

**(C.4) EN/DIN — PASS 3 verified (2026-06-03):**
- **`eurocodepy` (MIT ✅)** — https://github.com/pcachim/eurocodepy · https://raw.githubusercontent.com/pcachim/eurocodepy/master/LICENSE.md · https://pypi.org/project/eurocodepy/
- **`sectionproperties` (MIT ✅, compute-only)** — https://github.com/robbievanleeuwen/section-properties · https://pypi.org/project/sectionproperties/
- Blue Book (❌ SCI All Rights Reserved) — https://www.steelforlifebluebook.co.uk/about/ · https://www.steelforlifebluebook.co.uk/explanatory-notes/
- FreeCAD profiles.csv (❌ LGPL-2.1) — https://github.com/FreeCAD/FreeCAD/blob/master/src/Mod/Arch/Presets/profiles.csv · https://github.com/FreeCAD/FreeCAD/blob/main/LICENSE
- eurocodeapplied.com (❌ ToS no-republish) — https://eurocodeapplied.com/faq
- DIN copyright — https://www.din.de/en/about-standards/standards-and-the-law/standards-and-copyright
- EU sui generis scope (secondary) — https://legalblogs.wolterskluwer.com/copyright-blog/databases-sui-generis-protection-and-copyright-protection/ · https://europa.eu/youreurope/business/running-business/intellectual-property/database-protection/index_en.htm
- EU General Court T-185/19 (Public.Resource.Org v Commission, harmonised standards copyright)

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

**PASS 3** (C.4 — EN/DIN VERIFY υπάρχοντος καταλόγου + permissive πηγή): 6 search angles → 19 πηγές → 68 claims → top 25 με 3-vote. **23 confirmed / 2 killed.** 102 agents, ~44 λεπτά, 2026-06-03. Verdict Α: `ISHAPE_CATALOG` νομικά ασφαλής (facts, 3 επίπεδα 3-0). Verdict Β: `eurocodepy`=MIT (3-0). Killed: «DIN page αφήνει ρητά ανοιχτό fact-arg» (0-3), «sui generis συνεπάγεται insubstantial-free» (0-3).

---

## Changelog

| Έκδοση | Ημ/νία | Αλλαγή |
|---|---|---|
| v1.6 | 2026-06-08 | **CREDITS UI ΥΛΟΠΟΙΗΘΗΚΕ — κλείνει η εκκρεμότητα §B-θετικό.2 (ορατή «Credits/Άδειες» οθόνη).** Η deferred υποχρέωση attribution της v1.5 παραδόθηκε: NEW `bim/licensing/asset-credits.ts` (SSoT aggregator — διαβάζει `FURNITURE_CATALOG.source` + `TEXTURE_SET_DEFS.license/attribution` + `HDRI_PRESETS` + `SANITARY_MESH_CATALOG`· parse `'<title> by <author> (CC-BY) — url'`· CC-BY ΠΡΩΤΑ ανά-asset/CC0 grouped per source)· NEW `ui/components/CreditsDialog.tsx` (Radix Dialog + Table, CC-BY με ορατή ένδειξη υποχρεωτικής αναφοράς)· ribbon Settings → «Άδειες & Αναφορές» (`settings-tab-credits.ts`· action `open-credits` wired σε `useDxfViewerCallbacks` + UI state + DxfViewerDialogs render). i18n el+en. Αφορμή: 1η CC-BY ντουζιέρα (ADR-411 v1.2). NEW test `asset-credits.test.ts` (5)· tsc 0. Opus 4.8. 🔴 browser verify + commit. |
| v1.5 | 2026-06-03 | **ΕΠΕΚΤΑΣΗ ΠΟΛΙΤΙΚΗΣ: CC-BY 4.0 επιτρέπεται για mesh content (απόφαση Giorgio).** Νέο §B-θετικό.2. Αφορμή: κατά την προσθήκη καναπέδων (ADR-410) επιβεβαιώθηκε εμπειρικά ότι **μοντέρνο φωτορεαλιστικό PBR έπιπλο ΔΕΝ υπάρχει σε καθαρό CC0** — Poly Haven sofas όλοι vintage, Kenney/Quaternius low-poly stylized, Sketchfab CC0 downloadable sofas = **0** (API-verified). Ο «μόνο CC0» περιορισμός απέκλειε εξ ορισμού κάθε μοντέρνο PBR. **Νέα πολιτική για mesh content (έπιπλα/φωτιστικά/props, ΟΧΙ structural data):** CC0 **+ CC-BY 4.0** (full permissive: modify/redistribute/commercial, μοναδική υποχρέωση = attribution). ❌ CC-BY-NC/-ND παραμένουν απαγορευμένες· CC-BY-SA μόνο με αποδοχή ShareAlike. Συμμόρφωση: πεδίο `source` ανά catalog entry (`'<έργο> by <δημιουργός> (CC-BY) — <URL>'`). **Νομικό caveat:** attribution «reasonable to medium» → κρυφό DB πεδίο δεν αρκεί· χρειάζεται (deferred) ορατή «Credits/Άδειες» οθόνη που παράγεται από τα `source`. **N.5 (npm/engine code) ΑΜΕΤΑΒΛΗΤΟ** — CC-BY δεν αφορά κώδικα. Πηγές: Sketchfab (`license=by`+downloadable, άφθονοι μοντέρνοι PBR καναπέδες API-verified· download=OAuth/token), BlenderKit free, glTF-Sample-Assets CC-BY subset. Opus 4.8. |
| v1.4 | 2026-06-03 | **+Kenney.nl ως verified CC0 πηγή (§B-θετικό)** + εύρημα «μοντέρνα κρεβάτια». Κατά την υλοποίηση ADR-410 v1.9 (νέο `kind: 'bed'`): φωτορεαλιστικό μοντέρνο CC0 κρεβάτι ΔΕΝ υπάρχει στο Poly Haven (μόνο vintage GothicBed_01) ούτε στο Sketchfab CC0 (corpus = μουσειακά/απολιθώματα high-poly scans). Η μόνη γνήσια-CC0 + app-ready κατηγορία με μοντέρνα κρεβάτια = **game-asset libraries**. **Kenney Furniture Kit = CC0 1.0 verbatim** (License.txt: «free to use in… commercial projects», crediting not mandatory) → προστέθηκε στον πίνακα CC0 (app-ready low-poly, μηδέν decimation, αλλά stylized όχι PBR). Manual-verified (όχι 3-vote). Trade-off look αποδεκτό από Giorgio (AskUserQuestion). Opus 4.8. |
| v1.0 | 2026-06-02 | Αρχική δημιουργία. Τεκμηρίωση deep-research: engine licenses (A), content-ToS trap (B), parametric-presets δρόμος (C). Πολιτική: web-ifc (MPL) OK· content platforms ΑΠΑΓΟΡΕΥΜΕΝΕΣ· parametric presets = προτιμώμενος δρόμος. (C) & (B-θετικό) εκκρεμούν 2ο pass. Opus 4.8. |
| v1.1 | 2026-06-02 | +Κατηγορία (D) ΥΒΡΙΔΙΚΟΣ ΚΑΤΑΛΟΓΟΣ (επίσημη κατεύθυνση μετά συζήτηση Giorgio): Δ.1 «CC0 σχήμα + δικά μας δεδομένα» για fixed-shape στοιχεία (είδη υγιεινής/φωτιστικά/έπιπλα/MEP εξοπλισμός — νομικά καθαρό, εμείς ο BIM δημιουργός)· Δ.2 parametric presets για structural (τεντώνουν)· ενιαίο UI κατάλογος· caveat ποιότητας (app-ready vs high-poly scans). Opus 4.8. |
| v1.3 | 2026-06-03 | **PASS 3 deep-research (102 agents, 23 confirmed / 2 killed, 19 sources).** Έκλεισε το Open Question #1 (EN/DIN). **+§C.4:** (Α) VERDICT στον υπάρχοντα `ISHAPE_CATALOG` (75 EN 10365 διατομές) = ✅ **ΝΟΜΙΚΑ ΑΣΦΑΛΗΣ — ΚΡΑΤΑ ΩΣ ΕΧΕΙ**· τρία επίπεδα ευνοϊκά (copyright δεν καλύπτει content 96/9/EC Art.3· sui generis καλύπτει obtaining ΟΧΙ creation per C-203/02 & C-46/02, C-762/19 δεν ανατρέπει· CEN/DIN/SCI copyright μόνο στο έγγραφο per T-185/19)· μόνος υπολειπόμενος = **συμβατικός ToS eurocodeapplied** (μετριασμένος: πολλαπλές πηγές)· ΚΡΙΣΙΜΗ διάκριση: ονομαστικές διαστάσεις=facts ισχυρό, computed properties=derived works→επέκταση ΜΟΝΟ από MIT πηγή. (Β) ✅ **`eurocodepy`=MIT** (IPE/HEA/HEB/HEM+A/Iy/Iz/Wpl) ως cross-check + expansion source· `sectionproperties`=MIT compute-only· ❌ Blue Book (SCI all-rights-reserved), FreeCAD profiles.csv (LGPL-2.1), eurocodeapplied (ToS). Killed: DIN «αφήνει ανοιχτό fact-arg» (0-3), sui generis «insubstantial-free» (0-3). Εκκρεμή: UB/UC πηγή, eurocodepy properties ορθότητα/provenance. **+Decision 3→4 γραμμές: νέος ΔΕΣΜΕΥΤΙΚΟΣ κανόνας #4 «facts vs derived works» (ονομαστικές διαστάσεις=facts ελεύθερα· computed properties=ΜΟΝΟ από permissive πηγή, ΠΟΤΕ Blue Book/eurocodeapplied).** **+CROSS-CHECK εκτελέστηκε: 75/75 ακριβής ταύτιση των τιμών μας με eurocodepy MIT dataset (0 mismatch).** **+Provenance fix στον `section-catalog.ts` doc-header: αφαίρεση eurocodeapplied (ToS-restricted) → μηδενισμός συμβατικής έκθεσης.** Opus 4.8. |
| v1.2 | 2026-06-02 | **PASS 2 deep-research (107 agents, 23 confirmed / 2 killed, 24 sources).** Έκλεισε τα Open Questions των κατηγοριών (C) & (B-θετικό) + Forge/APS: **(C)** νομική ανάλυση 3 επιπέδων (C.1: facts μη-προστατεύσιμα EU 96/9/EC Art.3· sui generis ΔΕΝ καλύπτει creation per CJEU C-46/02 & C-203/02· μόνο ToS-φραγμός στη verbatim compilation)· **C.2** AISC Shapes DB = ❌ All Rights Reserved/paid· **C.3** ✅ steelpy (Apache-2.0) + sectionproperties (MIT) ως αξιοποιήσιμες code-πηγές, civilpy (AGPL) ❌· REFUTED η «v16.0 provenance» του steelpy (μόνο «consistent w/ 16th Ed.»). **(B-θετικό)** ✅ Poly Haven = CC0 no-attribution redistributable· glTF-Sample-Assets = mixed per-model ⚠️· επιβεβαιώθηκε «κανένα CC0 δεν είναι BIM-grade». **(A.1)** ❌ Autodesk Forge/APS = proprietary metered SaaS, ΟΧΙ redistributable. Εκκρεμή: EN/DIN verified code-πηγή, CC0 app-ready λίστα, Smithsonian/Wikimedia/ambientCG per-asset. Opus 4.8. |
