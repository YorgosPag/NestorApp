# ADR-651 — Σύστημα Αυτόματης Δημιουργίας Πινακίδων Σχεδίου (Auto Title Block Generator) — Έρευνα Αγοράς + Αρχιτεκτονικό Blueprint

- **Status**: ✅ **ΟΛΟΚΛΗΡΩΜΕΝΟ (Φάσεις Α–Ι) — ΚΑΙ ΤΑ 7 must-have του §7 ΠΑΡΑΔΟΘΗΚΑΝ** — Α (data
  wiring) + Β (in-scene insert) + Γ (κορνίζα ISO 5457, parametric reflow, βιβλιοθήκη presets) +
  **Δ (AI ναυαρχίδα: Εικόνα→Πινακίδα · Φυσική-γλώσσα→Πινακίδα · AI compliance validation)** +
  Ε (σφραγίδα-εικόνα + rule-based έλεγχος πληρότητας + νέο `ImageEntity`) + ΣΤ (εκτύπωση/εξαγωγή —
  WYSIWYG: οθόνη === PDF === DXF) + Ζ (multi-sheet sets + auto-numbering — πολυσέλιδο PDF σετ αδείας)
  + **Η (πίνακας αναθεωρήσεων + AI auto-changelog — Απόφαση #9)** +
  **Θ (βιβλιοθήκη προτύπων γραφείου + master/κληρονομιά — must-have #5, #1)** +
  **Ι (batch editing φύλλων: αριθμός/τίτλος + μαζική επαναρίθμηση — must-have #3)**
  **ΥΛΟΠΟΙΗΜΕΝΕΣ** (2026-07-14)
- **Date**: 2026-07-14
- **Category**: DXF Viewer / Documentation / Sheets & Title Blocks / Research
- **Σχετικά**: ADR-344 (Enterprise Text Engine — placeholders/templates/resolver, το θεμέλιο),
  ADR-453 (Print/Export Engine — `drawTitleBlock`, paper SSoT, DEFERS multi-sheet), ADR-454 (Plot
  Style CTB), ADR-505 (Unified Export DXF/PDF), ADR-583 (Annotation Symbols — north arrow/scale
  bar), ADR-608 (Vector-PDF backend), ADR-622 (Structural Detail-Sheet SSoT — region/field-block/
  dual backend πρότυπο), ADR-636/644/648 (Professional DXF export — BLOCK/INSERT writer),
  ADR-612 (Opening Info Tag — ΔΙΑΦΟΡΕΤΙΚΟ context, ίδια λέξη «πινακίδα»), ADR-462 (canonical mm),
  ADR-034 (License policy — MIT/Apache/BSD μόνο)

> **Ιστορικό έρευνας**
> - **Round 1** (2026-07-13): βαθιά έρευνα με **3 παράλληλους πράκτορες** (έγκριση Giorgio) σε:
>   (α) Revit + AutoCAD, (β) ArchiCAD + Vectorworks + BricsCAD/DraftSight + cloud/AI + πρότυπα
>   ISO/ελληνική πρακτική, (γ) πλήρης χαρτογράφηση του δικού μας κώδικα (SSoT audit).
> - **Scope αυτού του ADR** = τεκμηρίωση ευρημάτων + αρχιτεκτονικό blueprint + roadmap. Δεν
>   προστίθεται κώδικας εδώ· η υλοποίηση (Φάσεις Α–ΣΤ) είναι ξεχωριστή, επόμενη απόφαση.

---

## Context (το πρόβλημα / γιατί)

Ερώτημα/εντολή Giorgio: *«Κάθε αρχιτεκτονικό πρόγραμμα χρησιμοποιεί πινακίδες. Θέλω ο χρήστης
αυτόματα να δημιουργεί τέτοιες πινακίδες.»* Πρόκειται για την **πινακίδα τίτλου σχεδίου (title
block)** — το πλαίσιο-κορνίζα με πεδία **ΤΙΤΛΟΣ ΕΡΓΟΥ, ΕΡΓΟΔΟΤΗΣ, ΘΕΣΗ ΕΡΓΟΥ, ΜΕΛΕΤΗΤΗΣ,
ΣΥΝΕΡΓΑΤΗΣ, ΗΜΕΡΟΜΗΝΙΑ, ΚΑΤΗΓΟΡΙΑ ΜΕΛΕΤΗΣ, ΕΙΔΟΣ ΣΧΕΔΙΟΥ, ΑΡΙΘΜΟΣ ΣΧΕΔΙΟΥ, ΚΛΙΜΑΚΑ, ΕΛΕΓΧΟΣ,
ΣΦΡΑΓΙΔΑ** — που περιβάλλει κάθε αρχιτεκτονικό σχέδιο (δείγμα: το στιγμιότυπο του χρήστη,
πινακίδα A2 · 1:50 · «ΑΡΧΙΤΕΚΤΟΝΙΚΑ / ΚΑΤΟΨΗ ΙΣΟΓΕΙΟΥ»).

Στόχος (Giorgio): **AI-native σύστημα που θα ξεπερνά Revit/AutoCAD/ArchiCAD** αξιοποιώντας ό,τι
«μαγικό & αυτοματοποιημένο» δίνει η εποχή της ΤΝ. **Ναυαρχίδα-όραμα (επιλογή Giorgio) = και τα
τρία AI χαρακτηριστικά**: (α) **Εικόνα→Πινακίδα**, (β) **Φυσική-γλώσσα→Πινακίδα**, (γ)
**Zero-config auto-fill**.

**Κρίσιμο εύρημα του κώδικα (SSoT):** ΔΕΝ ξεκινάμε από το μηδέν. Υπάρχει ήδη ~80% της υποδομής
*περιεχομένου* μέσω του **ADR-344 Text Engine**. Το κενό είναι κυρίως **integration** + η γραφική
κορνίζα + το AI. Άρα η αρχιτεκτονική αρχή είναι: **χτίζουμε ΠΑΝΩ στο ADR-344, ΟΧΙ παράλληλο
σύστημα** (κανόνας N.0/N.12).

---

## 1. Έρευνα Αγοράς — Πώς το κάνουν οι κορυφαίοι

| Εργαλείο | Μηχανισμός πινακίδας | Killer feature | Αδυναμία |
|---|---|---|---|
| **Autodesk Revit** 🏆 | Title Block *families* + **Label** params δεμένα με Project Information / Sheet parameters· shared parameters | Auto-fill μέσω labels· revision schedules· sheet lists | **Multi-step**, χειροκίνητο family-editing, shared-params setup |
| **AutoCAD / AutoCAD Architecture** | **Sheet Set Manager** (`.dst`) + `FIELD` objects μέσα σε block **ATTRIBUTES** → live auto-update (`FIELDEVAL`, ATTSYNC) | Custom properties (Client/Discipline/Phase) propagate σε **όλα** τα φύλλα του set | Πολυπλοκότητα .dst· fields μόνο σε ATTDEF default, όχι value |
| **Graphisoft ArchiCAD** | **Master Layouts** (real-time inheritance) + **Autotext** από `Project Info` | **Καλύτερο auto-fill UX**: αλλαγή στο Project Info → ενημερώνει άμεσα όλα τα instances σε όλα τα layouts | Title Block μέσα σε Worksheet συχνά προτιμότερο (ευελιξία) |
| **Vectorworks** | **Title Block Border tool** — ενιαίο εργαλείο (border **+** data): Project/Sheet/Revision/Issue panes | **Ενιαίο border+data**· auto revision/issue worksheets από τα ίδια δεδομένα· **batch-edit** πολλών φύλλων μονομιάς | — |
| **BricsCAD** | Sheet Set properties ως fields σε attributes | Κεντρική διαχείριση χωρίς άνοιγμα κάθε φύλλου | — |
| **DraftSight 2026** | Block Attributes + Fields + **DIESEL expressions** | Conditional/computed κείμενο μέσα στην πινακίδα (π.χ. prefix ανά discipline) | — |

**Κοινό μοτίβο όλων των ηγετών:** τα πεδία της πινακίδας **ΔΕΝ είναι static κείμενο** αλλά
**live references** σε ένα κεντρικό «Project Info / Project Data» object → μηδενική ασυμφωνία
μεταξύ φύλλων (single source of truth). Αυτό ακριβώς κάνει ήδη το δικό μας `PLACEHOLDER_REGISTRY`
(ADR-344).

---

## 2. Πρότυπα & Ελληνικό Πλαίσιο

**ISO 5457** (Sizes & layout of drawing sheets): μεγέθη A0–A4· frame περιγράμματος 0.7mm·
περιθώριο 20mm αριστερά (filing margin) / 10mm αλλού· **θέση πινακίδας κάτω-δεξιά για A0–A3
(landscape), κάτω για A4 (portrait)**.

**ISO 7200** (Data fields in title blocks): υποχρεωτικά πεδία → **αριθμός/κωδικός ταυτοποίησης,
τίτλος σχεδίου, νόμιμος κάτοχος (legal owner), ημερομηνία έκδοσης, δημιουργός, εγκρίνων,
τύπος εγγράφου**· δυναμικά (εκτός πλαισίου όταν χρειάζονται): κλίμακα, σύμβολο προβολής, ανοχές.

**Ελληνική πρακτική (ΤΕΕ / πολεοδομία):**
- **Δεν υπάρχει δεσμευτικό ΦΕΚ** που να ορίζει *ακριβή γεωμετρία* πινακίδας σχεδίου (σε αντίθεση
  με την **εργοταξιακή ταμπίδα** — Ν.4030/2011 Άρθρο 54, που ρυθμίζεται ρητά). Επιβεβαιώθηκε
  ανεξάρτητα (φόρουμ μηχανικών): *«κάθε μηχανικός έχει τη δική του πινακίδα/υπόμνημα»*.
- **De-facto υποχρεωτικά πεδία** πινακίδας σχεδίου άδειας δόμησης: στοιχεία **μελετητή/επιβλέποντα
  (όνομα, ειδικότητα, ΑΜ ΤΕΕ, υπογραφή/σφραγίδα)**, **ιδιοκτήτη/εργοδότη**, **θέση/διεύθυνση έργου
  (οδός, Δήμος, ΟΤ/οικόπεδο)**, **τίτλος/είδος σχεδίου** (π.χ. «Κάτοψη Ισογείου»), **κλίμακα**
  (τυπικά 1:50 κατόψεις/τομές/όψεις· 1:100/200 τοπογραφικά· 1:10/20 λεπτομέρειες),
  **αριθμός & ημ/νία σχεδίου / revision**, **πλαίσιο σφραγίδας υπηρεσίας δόμησης**.

> **Συνέπεια για εμάς:** το ελληνικό «χαλαρό» πλαίσιο είναι **ευκαιρία**, όχι εμπόδιο — μπορούμε να
> προσφέρουμε έτοιμο **ΤΕΕ/ISO-7200 preset** ως best-practice default που σήμερα κάθε γραφείο
> ξαναφτιάχνει χειροκίνητα.

---

## 3. 🎯 Το Κενό Αγοράς (κεντρικό επιχείρημα)

**Τα νέα AI/cloud «BIM 2.0» εργαλεία ΔΕΝ έχουν σύστημα πινακίδων/φύλλων:**

- **Autodesk Forma** — η ίδια η Autodesk: *«It's too early to comment»* για 2D drawings· η
  τεκμηρίωση μένει στο Revit (Forma ↔ Revit data sync).
- **Arcol** — αντί για sheets έχει «Boards» (live presentations)· δικό του doc σύστημα «όχι ακόμα».
- **Snaptrude** — LOD 300-350 → παραδίδει σε Revit «for final documentation».
- **Motif / TestFit** — δημοσιεύουν/κάνουν review sheets *από* Revit, δεν τα παράγουν.
- **Revit AI (2025–2027)** — η κατεύθυνση: AI scripts παράγουν «δεκάδες/εκατοντάδες φύλλα με
  πλήρη title blocks, views, αρίθμηση» (90%+ εξοικονόμηση)· Revit 2027 αναμένεται να παράγει
  δομημένο πλαίσιο φύλλων από metadata του μοντέλου.

**Συμπέρασμα:** το «τελευταίο μίλι» της τεκμηρίωσης (sheets, πινακίδες, σχέδια άδειας) είναι
**ανοιχτό πεδίο** — οι νέοι παίκτες το αποφεύγουν, οι παλιοί το κάνουν πολύπλοκα. **Εκεί χτυπάμε**:
ένα AI-native σύστημα πινακίδων που είναι *ταυτόχρονα* απλό (zero-config), έξυπνο (image/NL→
πινακίδα) και standards-compliant (ISO/ΤΕΕ) — κάτι που **κανείς δεν προσφέρει σήμερα ολοκληρωμένα**.

---

## 4. SSoT Audit — Τι υπάρχει ήδη στον κώδικά μας

### 4.1 Υπάρχουσα υποδομή (build-on, ΜΗΝ ξαναγράφεις)

| Σύστημα | Path | Ρόλος |
|---|---|---|
| **Text Engine templates** (ADR-344) | `src/subapps/dxf-viewer/text-engine/templates/` | AST `TextTemplate` με `{{ns.key}}` placeholders· categories `title-block/stamp/revision/notes/scale-bar/custom` |
| **Έτοιμο αρχιτεκτονικό title block** | `text-engine/templates/defaults/title-blocks.ts` | EL+EN default με `{{project.name/code/owner}}`, `{{drawing.title/scale/sheetNumber}}`, `{{user.fullName/checkerName}}`, `{{revision.*}}`, `{{date.today}}` — **σχεδόν ακριβώς τα ζητούμενα πεδία** |
| **Σφραγίδες** | `text-engine/templates/defaults/stamps.ts` | `signoff-stamp-el` («ΥΠΕΥΘΥΝΟΣ ΜΕΛΕΤΗΣ», `Α.Μ. ΤΕΕ: {{user.licenseNumber}}»`), `approval-stamp-el` |
| **Revision table** | `text-engine/templates/defaults/revision.ts` | Πίνακας αναθεωρήσεων (bilingual, tabular) |
| **Placeholder registry** | `text-engine/templates/resolver/variables.ts` | `PLACEHOLDER_REGISTRY` — 17 γνωστά paths (company/project/drawing/user/revision/date) |
| **Resolver (pure)** | `text-engine/templates/resolver/resolver.ts` | `resolvePlaceholdersInString/Node/Template()` |
| **Scope hydration (server)** | `text-engine/templates/resolver/scope-builder.ts` | `buildPlaceholderScope()` — γεμίζει από Firestore Project/Company/User |
| **Firestore CRUD + UI** | `text-engine/templates/text-template.service.ts`, `ui/text-templates/` | Πλήρες per-tenant CRUD (audit/Zod) + management UI με live preview |
| **Print title-block primitive** | `print/assemble/title-block-renderer.ts` (`drawTitleBlock`) | jsPDF frame + label:value rows |
| **Paper SSoT** | `print/config/paper-types.ts`, `paper-constants.ts`, `paper-math.ts` | ISO A4–A0, orientation, DPI, mm↔px, fit-to-page / 1:N |
| **Detail-sheet pattern** (ADR-622) | `bim/structural/detail-sheet/` | «sheet-with-regions» + `buildFieldBlock()` (label:value) + dual backend (**preview === PDF**) — **άριστο πρότυπο layout** |
| **DXF BLOCK/INSERT writer** | `export/core/dxf-ascii-insert-writer.ts` | Η πινακίδα μπορεί να εξαχθεί ως πραγματικό DXF BLOCK |
| **Annotation symbols** (ADR-583) | `config/annotation-symbol-catalog.ts`, `types/scale-bar.ts` | North-arrow glyphs + scale-bar entities, τοποθετήσιμα |
| **Data model** | `src/types/project.ts` | Έχει ΗΔΗ `client`, `location`, `title`, `projectCode`· `User.licenseNumber` = ΑΜ ΤΕΕ |

### 4.2 Τα Κενά (τι πρέπει να χτιστεί)

1. ~~**#1 missing link — καμία εντολή «εισαγωγή πινακίδας στη σκηνή».**~~ — **✅ RESOLVED (Φάση Β,
   2026-07-13)**: νέο single-click εργαλείο **«Πινακίδα»** (`ToolType 'title-block'`, ribbon Εισαγωγή)
   λύνει το built-in πρότυπο με **πραγματικό scope** και το τοποθετεί ως **`BlockEntity`** στο ενεργό
   σχέδιο — επιλέγεται/μετακινείται/undo/persist ως ΕΝΑ αντικείμενο (πρακτική μεγάλων: AutoCAD
   BLOCK/INSERT, Revit title-block family instance). Μηδέν νέος render/persist/export δρόμος: το
   `block` entity ήδη ζωγραφίζεται (ADR-640) και ήδη εξάγεται ως DXF BLOCK/INSERT (ADR-636/644/648).
2. ~~**Καμία γραφική περιμετρική κορνίζα-φύλλου ISO 5457**~~ — **✅ RESOLVED (Φάση Γ, 2026-07-13)**:
   νέο **μοντέλο φύλλου** (`text-engine/title-block/sheet-frame.ts`) παράγει `DetailPrimitive[]`
   (ADR-622) από `{paperSize, orientation}` **αντλώντας τις διαστάσεις από το paper SSoT**
   (`resolvePaperDimensionsMm`, ADR-453): περίγραμμα 0.7mm + περιθώριο αρχειοθέτησης 20mm αριστερά /
   10mm αλλού + πινακίδα κάτω-δεξιά, **παραμετρικά για A4…A0 × όρθιο/πλαγιαστό** (στο A4 όρθιο η
   πινακίδα πιάνει όλο το πλάτος = «κάτω», όπως ορίζει το πρότυπο — προκύπτει από τον ΙΔΙΟ κανόνα,
   καμία ειδική περίπτωση). Το παλιό `drawTitleBlock` του PDF **παραμένει** ως έχει (Φάση ΣΤ θα το
   ενοποιήσει με το ίδιο μοντέλο· βλ. §4.2 #5).
3. ~~**Multi-sheet / layout / paperspace**~~ — **✅ RESOLVED (Φάση Ζ, 2026-07-14)** για το κομμάτι
   **σετ φύλλων + auto-numbering**: νέο καθαρό **«Sheet Set» μοντέλο** (`text-engine/title-block/
   sheet-set.ts`) **παραγόμενο από τα levels** (ένα level = ένα scene = ένα φύλλο· μηδέν νέο
   persistence — πρακτική AutoCAD Sheet Set Manager / ArchiCAD Layout Book: live view πάνω σε ΕΝΑ
   project data model), με **ντετερμινιστική auto-numbering** (`sheet-numbering.ts` → Α-1, Α-2… ως
   `drawing.sheetNumber` override, ίδιο μοτίβο με το `scaleName` της Φάσης Ε) + τίτλο φύλλου = όνομα
   ορόφου (`drawing.title` override). Το export γίνεται **πολυσέλιδο PDF** (ένα αρχείο, `addPage()`
   ανά φύλλο) μέσω του **ίδιου** print pipeline (`runPrintSet`) — κάθε φύλλο = `buildPrintSheet` με
   το δικό του scene + sheetNumber + title, **ίδια** πινακίδα. Το DXF-σετ υπάρχει ήδη ως `all-zip`
   (ADR-505). Βλ. **§5.5**. **Παραμένει DEFERRED** (ADR-453): τα πραγματικά paperspace **LAYOUT/VPORT**
   records στο DXF (ο writer έχει μόνο το υποχρεωτικό `*Paper_Space` stub) — το σετ δεν τα χρειάζεται
   (πολυσέλιδο PDF + πολλαπλά DXF καλύπτουν την κατάθεση αδείας).
4. ~~**`PLACEHOLDER_REGISTRY` λείπει `project.location` / `project.client`**~~ — **✅ RESOLVED (Φάση Α,
   2026-07-13)**: προστέθηκαν `project.location` (ΘΕΣΗ ΕΡΓΟΥ) + `project.client` (ΕΡΓΟΔΟΤΗΣ) σε όλη
   την αλυσίδα του resolver (ADR-344 SSoT): `PlaceholderPath` union + `PLACEHOLDER_REGISTRY`
   (`variables.ts`), `PlaceholderScopeProject` (`scope.types.ts`), `readProject` (`resolver.ts`),
   `pickProject` (`scope-builder.ts` — διαβάζει `data.location`/`data.client` από το `Project` doc),
   + i18n labels EL (`Θέση Έργου`/`Εργοδότης`) & EN (`Location`/`Client`). Registry: 17 → **19 paths**.
   Coverage: resolver + scope-builder + variables tests (72 passing).
5. ~~**Print engine δεν διαβάζει το πλήρες Firestore `Project`**~~ — **✅ RESOLVED (Φάση ΣΤ,
   2026-07-13)**: το `PrintHost` προ-φορτώνει το **ίδιο** scope (`loadPlaceholderScope(projectId)`,
   route της Φάσης Β) μόλις ανοίξει ο διάλογος και το print engine λύνει το **ίδιο** πρότυπο με
   **event-time** getter ⇒ **owner / θέση / εργοδότης / Α.Μ. ΤΕΕ τυπώνονται στο PDF**. Μηδέν νέα
   υποδομή, μηδέν `await` στο μονοπάτι εκτύπωσης. Ταυτόχρονα έπαψε να υπάρχει **δεύτερη μηχανή
   πινακίδας**: το legacy `drawTitleBlock` (jsPDF, ~85mm, level-name/scale/date) **διαγράφηκε** και
   το PDF ζωγραφίζει τα ΙΔΙΑ `DetailPrimitive[]` με την οθόνη (βλ. **§5.3**). Ιστορικό: η Φάση Α
   είχε συνδέσει μόνο το **όνομα** του ενεργού Project (το client `ProjectHierarchyContext.Project`
   είναι φτωχό projection — δεν φέρει owner/location/client), και η Φάση Β έφτιαξε τον μηχανισμό
   (server route + client cache) χωρίς να τον καταναλώνει το print.
6. ~~**Καμία σφραγίδα-ως-εικόνα** (upload PNG σφραγίδας/λογότυπου) — μόνο κειμενική.~~ —
   **✅ RESOLVED (Φάση Ε, 2026-07-13)**: ο μηχανικός ανεβάζει **μία φορά** τη σφραγίδα/υπογραφή
   του (company-scoped Firebase Storage, `users/{userId}.stampImageUrl`) και αυτή εμφανίζεται
   **αυτόματα σε κάθε πινακίδα** — στην **οθόνη** (νέο `ImageEntity`), στο **PDF**
   (`RasterPrimitive` → `drawRaster`) και στο **DXF** (native `IMAGE`/`IMAGEDEF`). Το κενό
   κουτί (#6γ) και το κείμενο (#6β) παραμένουν εναλλακτικές: **τρεις τρόποι, ΕΝΑ κελί**.
   Μαζί: **rule-based έλεγχος πληρότητας** (Απόφαση #4) — η πινακίδα λέει τι λείπει πριν την
   κατάθεση. Βλ. **§5.4**.
7. ~~**Κανένα AI generation** (image→template, NL→template, AI validation· ο rule-based έλεγχος
   της Φάσης Ε **δεν** είναι AI).~~ — **✅ RESOLVED (Φάση Δ, 2026-07-14)**: και τα **τρία** AI
   χαρακτηριστικά της ναυαρχίδας (§8 #1/#2/#5). Ο μηχανικός **φωτογραφίζει** υπάρχουσα πινακίδα ή
   **περιγράφει** αυτή που θέλει, και το AI παράγει **επεξεργάσιμο `TextTemplate`** (vector, ΟΧΙ
   raster — Απόφαση #5), που τρέφει τον **υπάρχοντα** renderer (οθόνη/PDF/in-scene). Το AI output
   περνά **πάντα** από Zod schema **και** reconciliation με το `PLACEHOLDER_REGISTRY`
   (anti-hallucination: άγνωστα paths πέφτουν). Μαζί: **AI semantic compliance** που **επεκτείνει**
   (δεν αντικαθιστά) τον rule-based έλεγχο της Φάσης Ε — **προειδοποίηση, ποτέ φραγή**.
   Αρχιτεκτονική: **§5.6**.
8. ~~**Κανένας πίνακας αναθεωρήσεων**: τα `{{revision.number/date/author/description}}` υπήρχαν στο
   `PLACEHOLDER_REGISTRY` (ADR-344) και υπήρχε έτοιμο δίγλωσσο πρότυπο (`defaults/revision.ts`) —
   αλλά **κανείς δεν τα γέμιζε** (ίδιο μοτίβο με το `drawing.sheetNumber` πριν τη Φάση Ζ).~~ —
   **✅ RESOLVED (Φάση Η, 2026-07-14)**: το σύστημα κρατά **μόνο του** τον πίνακα αναθεωρήσεων
   (αριθμός + ημερομηνία, ντετερμινιστικά) και **προτείνει με AI τι άλλαξε** από την προηγούμενη
   έκδοση· ο χρήστης εγκρίνει/διορθώνει. **Απόφαση #9 — κλείνει.** Αρχιτεκτονική: **§5.7**.

9. ~~**Καμία βιβλιοθήκη προτύπων γραφείου & καμία σχέση master↔παραλλαγής.** Τα `text_templates`
   ήταν **επίπεδα** (μόνο `companyId`, χωρίς `scope`) και — το σοβαρότερο — το **εργαλείο πινακίδας
   δεν τα κατανάλωνε ποτέ**: το `titleBlockTemplateForLocale` διάβαζε **μόνο** τα 4 built-in presets
   ή το AI override. Δεν υπήρχε δρόμος «πρότυπο γραφείου → picker πινακίδας», άρα ούτε πρότυπα που
   ταξιδεύουν μεταξύ έργων (#5) ούτε master που ενημερώνει τα φύλλα (#1).~~ — **✅ RESOLVED (Φάση Θ,
   2026-07-14)**: `scope` + `parentId`/`parentSyncedAt` + ενωμένος picker + ζωντανή συνδρομή στο
   master. Αρχιτεκτονική: **§5.8**.

---

## 5. Προτεινόμενη Αρχιτεκτονική (Blueprint)

**Θεμελιώδης αρχή:** Title block = **ένα `TextTemplate` (category `'title-block'`)** [ADR-344 =
SSoT περιεχομένου] **+ γραφική κορνίζα ISO 5457** [πρότυπο: detail-sheet regions/layout, ADR-622]
**+ resolver δεμένος με το πραγματικό `Project`/`Company`/`User`**. Ένα backend-agnostic μοντέλο
(preview canvas === PDF === DXF BLOCK), όπως ήδη κάνει το detail-sheet.

```
Project/Company/User (Firestore)
        │  scope-builder.buildPlaceholderScope()
        ▼
PlaceholderScope ──► resolver ──► resolved TitleBlockTemplate (TextTemplate + frame layout)
        ▲                               │
   AI generation                        ├──► Canvas preview (leaf renderer)
 (image / NL → template)                ├──► PDF (drawTitleBlock + frame, ADR-608)
                                        └──► DXF BLOCK/INSERT (ADR-636/644/648)
```

Zero-config auto-fill = ο scope-builder τρέχει αυτόματα με το ενεργό Project → η πινακίδα «γεμίζει
μόνη της» χωρίς καμία πληκτρολόγηση (καλύτερο από το shared-params setup του Revit).

### 5.1 Πώς φτάνει το πλήρες scope στον client (απόφαση Φάσης Β, 2026-07-13)

Το in-scene command τρέχει **client-side**, ενώ ο `scope-builder` είναι **`server-only`** (admin SDK) και
το client `ProjectHierarchyContext.Project` είναι φτωχό projection (`{id,name,company,buildings}`) — δεν
φέρει owner/location/client. Επιλέχθηκε το **Option A (server route)**:

- **`POST /api/dxf/text-templates/placeholder-scope`** → `withAuth` (companyId **από τα claims**, ποτέ από
  το body) → `buildPlaceholderScope()` → γυρίζει το **Firestore-derived κομμάτι** του scope
  (`PlaceholderScopeSources` = company/project/user· JSON-safe — τα drawing/revision/formatting ανήκουν
  στο σχέδιο, όχι στη βάση, και τα βάζει ο client).
- **Γιατί όχι επέκταση του client projection (Option B)**: θα δημιουργούσε **δεύτερο data path** για τα
  ίδια πεδία ⇒ δύο πηγές αλήθειας. Το route επαναχρησιμοποιεί 100% τη Φάση Α και εξυπηρετεί **και** το
  print (κενό #5) με μία πηγή.
- **Χωρίς race / χωρίς αναμονή στο κλικ**: το scope φορτώνεται **μία φορά μόλις οπλιστεί το εργαλείο**
  (idempotent, per-project cache σε module singleton) και το κλικ το διαβάζει **σύγχρονα** με getter
  (ADR-040) ⇒ το commit path δεν περιέχει `await`. Αποτυχία δικτύου ⇒ **κενά πεδία, όχι μπλοκαρισμένη
  εισαγωγή** (η πινακίδα παραμένει επεξεργάσιμη).
- Ίδιο μοτίβο με τους μεγάλους: τα labels δένουν με **ΕΝΑ** resident «Project Information» record
  (Revit/ArchiCAD), όχι με αντίγραφα ανά φύλλο.

### 5.2 Πού ζει το μοντέλο φύλλου (αρχιτεκτονική απόφαση Φάσης Γ, 2026-07-13)

Η κορνίζα είναι **παραμετρική γεωμετρία ανά μέγεθος χαρτιού**. Το ερώτημα ήταν: νέο `sheet-frame`
module (Option A) ή επέκταση του `detail-sheet-assemble`/regions (Option B); **Επιλέχθηκε το A**, με
βάση τον κώδικα (Phase 1 recognition — ο κώδικας, όχι το ADR, είναι source of truth):

- Το `detail-sheet-layout.ts` **δεν είναι** γενικό μοντέλο φύλλου: είναι η **σταθερή 5-region δομική
  διάταξη** (plan / elevation / perspective / schedule / title-block) με καρφωμένα κλάσματα στηλών
  (0.30 / 0.40) για τα φύλλα οπλισμού (ADR-457/463/471/476). Το να «χωρέσει» εκεί μια ISO-5457
  κορνίζα θα σήμαινε ότι η δομική διάταξη αποκτά έννοιες που δεν την αφορούν (filing margin, θέση
  πινακίδας ανά μέγεθος) και θα διακινδύνευε **ενεργά** φύλλα λεπτομερειών.
- Το A **δεν** δημιουργεί τρίτη μηχανή διάταξης, γιατί δανείζεται και τα δύο SSoT που ήδη υπάρχουν:
  **διαστάσεις χαρτιού** από το print engine (`paper-math`/`paper-constants`) και **αναπαράσταση
  σχεδίου** από το ADR-622 (`DetailPrimitive`), ενώ οι γραμμές `label : value` στοιχίζονται από το
  **ίδιο** `buildFieldBlock`. Άρα τα τρία υπάρχοντα backends (preview canvas / PDF / in-scene
  entities) ζωγραφίζουν την κορνίζα **δωρεάν**, χωρίς νέο render path.
- Πρακτική μεγάλων: **Vectorworks Title Block Border** = ΕΝΑ εργαλείο που παράγει border **και**
  πινακίδα μαζί — ακριβώς το σχήμα που υλοποιείται εδώ (ο χρήστης επιλέγει «πλήρες φύλλο» ή «μόνο η
  πινακίδα»).

---

### 5.3 Πώς φτάνει η πινακίδα στο PDF (αρχιτεκτονική απόφαση Φάσης ΣΤ, 2026-07-13)

Το ερώτημα: το print assembler **αντικαθιστά** το legacy `drawTitleBlock` με το layout model της
Φάσης Γ (Option A), ή του δίνει απλώς καλύτερα δεδομένα (Option B); **Επιλέχθηκε το A** — ο κώδικας
απάντησε μόνος του (Phase 1 recognition):

- Το `detail-pdf-renderer.ts` (ADR-622) **ήδη** ζωγράφιζε `DetailPrimitive[]` σε jsPDF για τα φύλλα
  λεπτομερειών· ο ζωγράφος ήταν απλώς **ιδιωτικός**. Εξήχθη ως `detail-pdf-primitives.ts` και τον
  καλούν **δύο** καταναλωτές (detail sheet + print). Η σύμβαση συντεταγμένων ταιριάζει **εξ ορισμού**:
  sheet-mm (αρχή πάνω-αριστερά, +y κάτω) === jsPDF page-mm ⇒ **καμία μετατροπή, καμία αναστροφή**.
- Άρα το Option B θα δημιουργούσε **μόνιμα δύο μηχανές πινακίδας** (οθόνη ≠ PDF) για μηδενικό όφελος.
  Το Option A δεν προσθέτει renderer — **αφαιρεί** έναν (`title-block-renderer.ts` διαγράφηκε).
- **Ποιος κερδίζει σε σύγκρουση**: το **χαρτί** το ορίζει ο **διάλογος εκτύπωσης** (τυπώνεις σε ό,τι
  βάζεις στον εκτυπωτή· το ribbon store ορίζει το χαρτί του **in-scene** block). Η **κλίμακα** που
  γράφεται στην πινακίδα είναι αυτή που **ΟΝΤΩΣ τυπώνεται** (1:N του διαλόγου· fit-to-page ⇒ `—`),
  όχι της οθόνης. Ό,τι άλλο (preset, κορνίζα, δεδομένα έργου) το print **διαβάζει** από τους ίδιους
  SSoT που τροφοδοτούν την οθόνη — καμία δεύτερη επιλογή, καμία δεύτερη αλήθεια.
- **Πού μπαίνει το σχέδιο**: στην **ωφέλιμη περιοχή** (κορνίζα μείον πινακίδα — το Γ-σχήμα του
  `sheet-frame.ts`, **ο ίδιος** ορισμός που χρησιμοποιεί η πρόταση χαρτιού). Το legacy ζωγράφιζε
  αδιαφανές κουτί **πάνω** στο σχέδιο· οι μεγάλοι δεν το κάνουν — το σχέδιο ζει **μέσα** στην κορνίζα
  και ποτέ κάτω από την πινακίδα. Άρα «χωράει» (πρόταση) === «εκεί τυπώθηκε» (εκτύπωση).

### 5.4 Πού ζει η σφραγίδα & ποιος λέει τι λείπει (αρχιτεκτονικές αποφάσεις Φάσης Ε, 2026-07-13)

Τρία ερωτήματα, τρεις αποφάσεις — και οι τρεις με βάση τον **κώδικα** (Phase 1 recognition):

**(α) Πού ζει η εικόνα σφραγίδας;** Στον **μηχανικό**, όχι στο σχέδιο και όχι στο έργο: το
Α.Μ. ΤΕΕ είναι προσωπικό, άρα η σφραγίδα ζει δίπλα του — `users/{userId}.stampImageUrl`, με το
blob σε **company-scoped** path (`companies/{companyId}/engineer-stamps/{userId}.{ext}`, tenant
isolation· mirror του BIM material thumbnail κανόνα). Ταξιδεύει στην πινακίδα μέσα από το
**υπάρχον** `buildPlaceholderScope()` → `PlaceholderScopeUser` → το ίδιο route/cache της §5.1 ⇒
**μηδέν δεύτερο data path**. Πρακτική μεγάλων: ArchiCAD Project Info / Revit shared params — το
asset ανεβαίνει **μία φορά** και εμφανίζεται παντού, ποτέ αντίγραφο ανά φύλλο.

> ⚠️ Η σφραγίδα **ΔΕΝ** είναι placeholder και δεν μπαίνει ποτέ στο `PLACEHOLDER_REGISTRY`: το
> registry είναι SSoT για υποκατάσταση **κειμένου** — ένα `{{user.stampImageUrl}}` θα τύπωνε το
> URL μέσα στην πινακίδα. Είναι **εικόνα**, και ταξιδεύει ως δεδομένο του scope.

**(β) Πώς μπαίνει η εικόνα στο κελί;** Ως **`RasterPrimitive`** (ADR-622) μέσα στο `stamp` rect
του `sheet-frame` ⇒ **PDF και canvas τη ζωγραφίζουν δωρεάν** (ο ζωγράφος υπήρχε ήδη:
`drawRaster` + `containFitRectMm`). Το πραγματικό κενό ήταν το **τρίτο backend**
(`detail-primitives-to-entities`), που αγνοούσε σιωπηλά τα `raster` «μέχρι να υπάρξει
καταναλωτής». Τώρα υπάρχει.

**Η απόφαση του Giorgio εκεί: νέο `ImageEntity`** (native AutoCAD `IMAGE`/`IMAGEDEF`), **όχι**
παράκαμψη μέσω hatch-image-fill (ADR-643). Ο κώδικας έδειχνε ότι η σκηνή ζωγραφίζει raster
**μόνο** ως *γέμισμα υλικού* — μια σφραγίδα **δεν είναι υλικό**, και το να καταχωρηθεί ως
`bim_materials` doc θα ήταν σημασιολογικό ψέμα που θα πλήρωναν όλες οι επόμενες φάσεις. Το
`ImageEntity` είναι ο τύπος που λείπει από το μοντέλο, όχι μόνο από την πινακίδα: το κερδίζουν
και τα PDF underlays, τα λογότυπα, τα σκαναρισμένα σχέδια. **Reuse, μηδέν νέος μηχανισμός**:
render μέσω του υπάρχοντος `HatchImageCache` (async decode + dirty-frame, ADR-040), export μέσω
του υπάρχοντος `IMAGE`/`IMAGEDEF` writer του ADR-643 Φ5b.

> 🔒 **CORS/taint**: η εικόνα φορτώνεται με `crossOrigin='anonymous'` (τα Firebase download URLs
> σερβίρουν CORS). Χωρίς αυτό ο καμβάς **μολύνεται** και το `toDataURL` της **raster εκτύπωσης**
> πετά `SecurityError` — δηλαδή η σφραγίδα θα έσπαγε την ίδια την εκτύπωση που ήρθε να υπηρετήσει.

**(γ) Ποιος λέει τι λείπει;** Μια **καθαρή συνάρτηση** (`title-block-compliance.ts`) πάνω στο
πρότυπο + το scope — **rule-based, ΟΧΙ AI** (το AI validation μένει §8 #5). Η λίστα των
υποχρεωτικών πεδίων **δεν γράφεται πουθενά χειροκίνητα**: παράγεται από το
`PLACEHOLDER_REGISTRY` (νέο flag `permitRequired` στα 8 de-facto υποχρεωτικά της §2 — μελετητής,
ειδικότητα, **Α.Μ. ΤΕΕ**, εργοδότης, θέση, τίτλος έργου, είδος σχεδίου, κλίμακα). Τρία
**διακριτά** ευρήματα, γιατί έχουν **διαφορετική λύση**:

| Εύρημα | Τι σημαίνει | Τι κάνει ο χρήστης |
|---|---|---|
| `empty-value` | το πρότυπο έχει το πεδίο, τα **δεδομένα** λείπουν | συμπληρώνει (π.χ. Α.Μ. ΤΕΕ στο προφίλ) |
| `absent-field` | το **πρότυπο** δεν έχει καθόλου το πεδίο | αλλάζει preset (π.χ. «Άδεια δόμησης») |
| `no-stamp-image` | κελί σφραγίδας χωρίς εικόνα | ανεβάζει σφραγίδα **ή** σφραγίζει με το χέρι |

Τρέχει με **ακριβώς ό,τι θα τυπωθεί** (ίδιο preset, ίδιο scope, ίδια κλίμακα — fit-to-page ⇒ η
κλίμακα γράφεται `—` ⇒ **λείπει κλίμακα**, και ο μηχανικός το μαθαίνει ΠΡΙΝ καταθέσει).
**Προειδοποίηση, ποτέ φράγμα**: το κουμπί «Εκτύπωση» δεν απενεργοποιείται — ένα πρόχειρο
τυπώνεται ελεύθερα.

### 5.5 Πώς παράγεται & τυπώνεται το σετ φύλλων (αρχιτεκτονικές αποφάσεις Φάσης Ζ, 2026-07-14)

Τρία ερωτήματα, τρεις αποφάσεις — και οι τρεις με βάση τον **κώδικα** (Phase 1 recognition, SSoT
audit με πραγματικό grep):

**(α) Πού ζει το «Sheet Set»;** **Παραγόμενο από τα levels**, ΟΧΙ persisted data model. Ο κώδικας
έδειξε ότι το `ExportHost` **ήδη** μαζεύει `levelScenes: {level, scene}[]` (multi-floor iteration) —
η υποδομή υπάρχει· το σετ χτίζεται ΠΑΝΩ σε αυτό, δεν ξαναγράφεται. Big-player πρακτική (AutoCAD Sheet
Set Manager / ArchiCAD Layout Book / Revit Sheet List): το σετ είναι **live view** πάνω σε ΕΝΑ project
data model — μία αλλαγή στα στοιχεία έργου φαίνεται σε όλα τα φύλλα (§7 must-have #6), **χωρίς
αντίγραφο ανά φύλλο**. Άρα **μηδέν νέο Firestore persistence, μηδέν νέο service**: `buildSheetSet()`
είναι καθαρή, backend-agnostic συνάρτηση (`text-engine/title-block/sheet-set.ts`) που δέχεται τις
**ήδη ταξινομημένες** πηγές και τις αριθμεί. Η **σειρά** ορίζεται στον React layer (PrintHost), όπου
ζει το `level-display-order` SSoT — ώστε το μοντέλο να μένει decoupled από React/context + unit-testable.

**(β) Ποιος παράγει την αρίθμηση;** Μια **καθαρή, ντετερμινιστική συνάρτηση** (`sheet-numbering.ts`):
`autoSheetNumber(index, prefix)` → `${prefix}-${index+1}` (Α-1, Α-2…), με πρόθεμα ανά γλώσσα (ελληνικό
«Α» = Αρχιτεκτονικά ΤΕΕ / λατινικό «A» για ξένα έργα, Απόφαση #8). Η θέση στο σετ ⇒ ο αριθμός· **καμία
χειρόγραφη αρίθμηση, καμία δεύτερη πηγή**. Ο αριθμός φτάνει στην πινακίδα ως `drawing.sheetNumber`
override και ο τίτλος (όνομα ορόφου) ως `drawing.title` override — το **ίδιο μοτίβο** που η Φάση ΣΤ/Ε
χρησιμοποιεί για το `scaleName` (`TitleBlockScopeOverrides`). Το `drawing.sheetNumber` placeholder
**υπήρχε ήδη** στον resolver (ADR-344)· απλώς αποκτά επιτέλους παραγωγό.

**(γ) Πώς γίνεται export ολόκληρου σετ;** **Πολυσέλιδο PDF** (ένα αρχείο, `addPage()` ανά φύλλο) μέσω
του **ίδιου** print pipeline της Φάσης ΣΤ (`runPrintSet`). Ο κώδικας απάντησε: (1) ο assembler ήταν
**single-page** (`new jsPDF` μία φορά, καμία `addPage`) — αυτό ήταν το **μοναδικό** πραγματικό νέο
κομμάτι backend· λύθηκε **χωρίς διπλότυπο** (`assemblePrintPdfPages([...pages])` + κοινός `drawPrintPage`
ανά σελίδα· το single-page `assemblePrintPdf` έγινε thin wrapper — N.18). (2) το 2D capture ζωγραφίζει
από το **περασμένο** `scene`, ΟΧΙ από το live canvas — άρα κάθε όροφος (ακόμη κι ο μη-ενεργός)
capture-άρεται περνώντας το scene του· καμία αλλαγή στο capture. (3) κάθε φύλλο = το **ίδιο**
`buildPrintSheet` με το δικό του scene + sheetNumber + title + την **ίδια** πινακίδα (preset/κορνίζα/
στοιχεία έργου) ⇒ **ghost === οθόνη === PDF**, μία μηχανή. Όλα τα φύλλα μοιράζονται το **ίδιο χαρτί**
(συνεπής πινακίδα). Το **DXF-σετ** υπάρχει ήδη ως `all-zip` (ADR-505 `ExportFloorScope`) — δεν
ξαναγράφτηκε το `export-service`. Τα native paperspace LAYOUT/VPORT records παραμένουν DEFERRED
(ADR-453· το σετ δεν τα χρειάζεται).

**UI (Απόφαση #10):** ένα checkbox «όλο το σετ φύλλων ({N})» στον **υπάρχοντα** διάλογο εκτύπωσης
(`PrintOutputControls`, 2Δ μόνο, εμφανίζεται όταν υπάρχουν ≥2 φύλλα) — **κανένα νέο UI σύστημα**. Το
`PrintHost` μαζεύει τα level scenes (ίδιο μοτίβο με το `ExportHost`) και branch-άρει `runPrint` (ενεργό)
vs `runPrintSet` (σετ).

### 5.6 Πού τρέχει το AI, τι επιστρέφει, πού persist-άρει (αρχιτεκτονικές αποφάσεις Φάσης Δ, 2026-07-14)

Τρία ερωτήματα, τρεις αποφάσεις — και οι τρεις με βάση τον **κώδικα** (Phase 1 recognition, SSoT
audit με πραγματικό grep):

**(α) Πού τρέχει το AI;** **Server-only routes** (`app/api/dxf/text-templates/ai/{from-image,
from-text,validate}`), με το **ίδιο** κέλυφος ασφαλείας της Φάσης Β (`withStandardRateLimit` +
`withAuth`, companyId/userId **από τα claims**, ποτέ από το body). Το κλειδί OpenAI **δεν φτάνει
ποτέ στον client**.

> ⚠️ **Ο κώδικας διόρθωσε το σχέδιο**: ο `agentic-openai-client.ts` (raw fetch στο OpenAI) είναι
> **LEGACY — DISABLED** από τη μετάβαση σε Vercel AI SDK (2026-03-29). Ο **ενεργός** SSoT είναι ο
> **`getOpenAIProvider()`** (`@/services/ai/openai-provider`, ADR-294 ratchet: το `createOpenAI`
> επιτρέπεται **μόνο** εκεί) μέσω **`generateObject`** του `ai` SDK. Άρα η Φάση Δ **δεν** έφτιαξε
> νέο OpenAI client και **δεν** αντέγραψε το vision μοτίβο του accounting analyzer (που έχει δικό
> του raw-fetch client στο Responses API): χρησιμοποιεί το **ήδη αποδεδειγμένο** μοτίβο του
> `ai-query-translator.ts` (ADR-268: Zod schema → `generateObject` → validate/strip). Το usage
> καταγράφεται στον **υπάρχοντα** SSoT (`recordUsage`, ADR-259A) σε δικό του κανάλι
> (`dxf-title-block-ai`). **Καμία** τροποποίηση στο `src/services/ai-pipeline/` (άρα το N.10 δεν
> ενεργοποιείται) — μόνο κατανάλωση των κοινών provider/usage SSoT.

**(β) Τι επιστρέφει το AI;** **Δομημένο JSON** (Zod schema), **ΟΧΙ raster και ΟΧΙ ελεύθερο κείμενο**
— αυτό είναι που κάνει την Απόφαση #5 («ίδια διάταξη, αλλά **καθαρή**») να βγαίνει **φυσικά**: το
output είναι *πρότυπο*, όχι εικόνα, άρα ο υπάρχων renderer το ξανασχεδιάζει καθαρά. Το σχήμα
(`ai-title-block-schema.ts`) περιγράφει **μόνο περιεχόμενο** (επικεφαλίδα + γραμμές πεδίων +
`withStampBox`) — **ποτέ γεωμετρία**: την κορνίζα/θέση/μέγεθος τα κατέχουν ήδη το `sheet-frame.ts`
(ISO 5457) και το ενεργό φύλλο.

Ο κρίσιμος κρίκος είναι το **reconciliation** (`ai-title-block-reconcile.ts`, **καθαρή** συνάρτηση):
κάθε `placeholderPath` που προτείνει το μοντέλο περνά από `isKnownPlaceholder` — ό,τι δεν ανήκει στο
`PLACEHOLDER_REGISTRY` (hallucination/typo) **πέφτει** και καταγράφεται (`droppedPaths`, το UI το
λέει στον χρήστη). Έτσι το AI μπορεί να παράγει πινακίδα **μόνο** με γνωστά, ζωντανά δεδομένα —
ποτέ με σπασμένο `{{x.y}}`. Το ίδιο μοτίβο «μη εμπιστεύεσαι το LLM» με το `validateTranslatedQuery`
(ADR-268). Το `DxfTextNode` χτίζεται με τους **ίδιους** builders των built-in προτύπων
(`makeNode/makeParagraph/makeRun`) και τη **σύμβαση** που ήδη διαβάζει ο renderer
(`title-block-rows.ts`: επικεφαλίδα + «Ετικέτα: τιμή») ⇒ τα **τρία backends** (canvas/PDF/DXF)
ζωγραφίζουν την AI πινακίδα **δωρεάν**, μηδέν νέος render δρόμος.

**(γ) Πού persist-άρει;** Στο **υπάρχον** `text_templates` CRUD (ADR-344 two-tier: built-in immutable
+ user editable) — **μηδέν νέο collection, μηδέν νέο πεδίο**. Το AI route **δεν** γράφει: επιστρέφει
**draft** πρότυπο· ο χρήστης το βλέπει σε **live preview** (ο **ίδιος** resolver με την οθόνη/PDF, με
τα πραγματικά στοιχεία του έργου) και μετά αποφασίζει:
- **«Αποθήκευση προτύπου»** → το **υπάρχον** `POST /api/dxf/text-templates` (enterprise id
  `generateTextTemplateId` + `setDoc`, N.6) ⇒ γίνεται κανονικό user template, επεξεργάσιμο από το
  **υπάρχον** management UI.
- **«Εισαγωγή στη σκηνή»** → η AI πινακίδα μπαίνει ως **override** στο `title-block-options-store`
  (τον **ήδη υπάρχοντα** «ΕΝΑ ιδιοκτήτη του τι μπαίνει στο επόμενο κλικ») και οπλίζεται το
  **υπάρχον** εργαλείο «Πινακίδα» μέσω του **ήδη υπάρχοντος** `level-panel:tool-change` ⇒ ο χρήστης
  κάνει single-click τοποθέτηση με ghost/undo/persist της Φάσης Β. **Κανένας νέος μηχανισμός
  ενεργοποίησης, κανένα νέο commit path.** Η επιλογή preset από τον χρήστη **καθαρίζει** το override.

**Graceful (N.7.2 #4, Απόφαση #4):** κάθε αποτυχία (χωρίς κλειδί / δίκτυο / LLM) ⇒ το generation
γυρίζει `null` και ο διάλογος δείχνει i18n μήνυμα· ο μηχανικός **πέφτει σε manual preset**, ποτέ
crash και ποτέ μπλοκάρισμα. Το AI compliance αποτυγχάνει σε **κενή λίστα** ⇒ ο **rule-based** έλεγχος
της Φάσης Ε μένει η ασφαλής βάση.

### 5.7 Πού ζει η ιστορία αναθεωρήσεων & τι ακριβώς κάνει το AI (αρχιτεκτονικές αποφάσεις Φάσης Η, 2026-07-14)

Τρία ερωτήματα, τρεις αποφάσεις — και οι τρεις με βάση τον **κώδικα** (Phase 1 recognition, SSoT
audit με πραγματικό grep):

**(α) Πού ζει η ιστορία;** Σε **νέο persisted record** (`drawing_revisions`), **ανά ΕΡΓΟ**
(**απόφαση Giorgio 2026-07-14**). Ο κώδικας απάντησε στα δύο υποερωτήματα:

- **Γιατί χρειάζεται persistence** (σε αντίθεση με το sheet-set της Φάσης Ζ, που είναι *παραγόμενο*):
  η αναθεώρηση είναι **ιστορικό γεγονός** — δεν προκύπτει από την τρέχουσα κατάσταση του σχεδίου.
  Χωρίς αποθηκευμένο **αποτύπωμα** της προηγούμενης έκδοσης δεν υπάρχει «προηγούμενη έκδοση» να
  συγκριθεί, άρα ούτε AI diff.
- **Γιατί ΟΧΙ το `entity_audit_trail`** (ADR-195, το πρώτο που εξετάστηκε): grep έδειξε ότι καλύπτει
  **μόνο** BIM οντότητες (walls / foundations / MEP / family-types / BOQ) και σε επίπεδο **πεδίου** —
  όχι τα DXF entities της σκηνής. Είναι **άλλο επίπεδο** (audit πεδίων, όχι εκδόσεις σχεδίου) και
  είναι **ratchet-protected**. Άρα: μηδέν άγγιγμα. Ο ίδιος ο πίνακας αναθεωρήσεων είναι **append-only**
  (καταχώρηση, ποτέ update/delete) ⇒ **ΕΙΝΑΙ** το audit του — δεν χρειάζεται δεύτερο.
- **Επίπεδο = έργο** (Revit *Sheet Issues/Revisions*: μία λίστα ανά έργο, εφαρμόζεται στα φύλλα), όχι
  ανά φύλλο (AutoCAD/Vectorworks). Ταιριάζει με την ελληνική πρακτική: το **σετ αδείας** ξανακατατίθεται
  ως σύνολο ⇒ «1η Αναθεώρηση» σε **όλα** τα φύλλα, με **μία** καταχώρηση. Το AI λέει τι άλλαξε **ανά
  φύλλο**, οπότε δεν χάνεται η ακρίβεια.

**Idempotency δομική, όχι από τύχη** (N.7.2 #3): το doc id είναι **ντετερμινιστικό** ανά
`(projectId, digest του αποτυπώματος)` — μοτίβο `generateDeterministic*Id` (ADR-632 Φ5). Δύο κλικ «Νέα
αναθεώρηση» χωρίς ενδιάμεση αλλαγή ⇒ ίδιο digest ⇒ **ίδιο doc** ⇒ ο server επιστρέφει την υπάρχουσα
(`created: false`). Καμία διπλή «2η Αναθεώρηση», ούτε με διπλό κλικ ούτε με δύο καρτέλες.

**(β) Ποιος γεμίζει τα `revision.*`;** Το **υπάρχον** κανάλι `TitleBlockScopeOverrides` — **μηδέν
δεύτερο data path**. Τα placeholders **υπήρχαν ήδη** (ADR-344): `PLACEHOLDER_REGISTRY` + `readRevision`
στον resolver + `PlaceholderScopeRevision` + έτοιμο πρότυπο `defaults/revision.ts`. Έλειπε **μόνο ο
παραγωγός** — ακριβώς όπως το `drawing.sheetNumber` πριν τη Φάση Ζ. Πλέον η **τρέχουσα** αναθεώρηση
(τελευταία καταχωρημένη) φορτώνεται **μία φορά** στο ίδιο σημείο με το υπόλοιπο scope
(`loadTitleBlockAssets`) και διαβάζεται **σύγχρονα** στο κλικ/ghost/PDF (ADR-040: getters, μηδέν
`await` στο commit path) ⇒ **πινακίδα ΚΑΙ πίνακας αναθεωρήσεων γεμίζουν δωρεάν στα 3 backends**
(οθόνη / PDF / in-scene DXF BLOCK) — **μηδέν νέος render δρόμος** (§7 must-have #4: auto revision
worksheets χωρίς διπλή καταχώρηση).

> ⚠️ Το `revision.date` είναι `Date` ⇒ **client-owned** (δεν ταξιδεύει στο `PlaceholderScopeSources`
> του route — δεν είναι JSON-safe· §5.1). Ο αριθμός γράφεται με τη μορφή που τυπώνεται
> (`formatRevisionNumber`: ελληνικά «1η/2η/3η», αγγλικά «1/2/3» — Απόφαση #8).

**(γ) Τι ακριβώς κάνει το AI;** **Μόνο τη διατύπωση** — και αυτό είναι το κλειδί της ακρίβειας:

| Ποιος | Τι κάνει | Γιατί |
|---|---|---|
| **Ο κώδικας** | **μετράει** τον diff (`revision-diff.ts`, καθαρή/ντετερμινιστική) | κανένα LLM δεν μετράει σωστά 3.000 οντότητες |
| **Το AI** | **γράφει** την περιγραφή από τον έτοιμο diff | επαγγελματική διατύπωση στη γλώσσα του μηχανικού |
| **Ο χρήστης** | **εγκρίνει / διορθώνει** | Απόφαση #9 — **ποτέ** αυτόματη εγγραφή |

Το **αποτύπωμα** κάθε φύλλου κρατά **υπογραφή ανά οντότητα** (`idHash:contentHash:type`), όχι μόνο
πλήθη: αλλιώς μια **μετακίνηση** πόρτας (ίδιο πλήθος) θα ήταν αόρατη και η αυτόματη περιγραφή θα έλεγε
«καμία αλλαγή» — **ψέμα σε νομικό έγγραφο**. Άρα ο diff διακρίνει **προστέθηκε / αφαιρέθηκε /
τροποποιήθηκε** ανά τύπο. Πάνω από `MAX_SIGNATURES` (12.000) οντότητες οι υπογραφές παραλείπονται και η
σύγκριση πέφτει στα πλήθη — **δηλωμένο ρητά** (`coarse: true` → prompt **και** UI), ποτέ σιωπηλά.

Ο server ξαναϋπολογίζει τον diff (έχει και τις δύο πλευρές) και επιστρέφει **και τα δύο**: τον diff
(πάντα) **και** την πρόταση (`null` σε αποτυχία). **Graceful** (N.7.2 #4): χωρίς κλειδί / δίκτυο / LLM,
ο χρήστης βλέπει τι άλλαξε και γράφει μόνος του την περιγραφή — η αναθεώρηση **ποτέ** δεν μπλοκάρεται.
Το AI route ξαναχρησιμοποιεί το **κοινό κέλυφος** της Φάσης Δ (`_ai-route-helpers`: rate limit +
`withAuth` + try/catch· κλειδί OpenAI ποτέ στον client) + `getOpenAIProvider` + `generateObject` + Zod +
`recordUsage` (ίδιο κανάλι `dxf-title-block-ai`) — **καμία** τροποποίηση στο `src/services/ai-pipeline/`
(N.10 δεν ενεργοποιείται).

### 5.8 Πού ζει η βιβλιοθήκη & πώς κληρονομεί ένα πρότυπο (αρχιτεκτονικές αποφάσεις Φάσης Θ, 2026-07-14)

#### (α) Απόφαση Giorgio (2026-07-14): **Δρόμος 1 — αναφορά ή απόσπαση, ΠΟΤΕ μερική κληρονομιά**

Ερωτήθηκε ρητά, με τρεις εναλλακτικές. Η επιλογή είναι **η πρακτική των ηγετών**:

| | Τι κάνει | Ποιος το κάνει |
|---|---|---|
| **✅ Δρόμος 1 (επιλέχθηκε)** | Τα έργα **δείχνουν** στο master (ίδιο έγγραφο). Αλλαγή στο master ⇒ **όλα** ενημερώνονται αυτόματα. Παραλλαγή = ρητή **απόσπαση** (πλήρες αντίγραφο + `parentId`) + κουμπί **«Ενημέρωση από τον γονιό»** (pull). | **ArchiCAD** Master Layout, **Revit** title-block family |
| ❌ Ζωντανή σύνθεση | Το παιδί κρατά μόνο τα *overridden* πεδία και λύνει τα υπόλοιπα από τον γονιό. | **Figma** components — **κανένα CAD** |
| ❌ Απλό αντίγραφο | Κλώνος χωρίς σχέση γονέα. | — (δεν κλείνει το #1) |

**Γιατί ΟΧΙ η ζωντανή σύνθεση (το κρίσιμο τεχνικό επιχείρημα)**: απαιτεί **σταθερά ids ανά κόμβο**
του AST. Το `DxfTextNode` **δεν έχει** — τα overrides θα κλειδώνονταν σε **θέσεις** («η 2η
παράγραφος»), και μόλις ο γονιός αναδιατασσόταν, το override θα προσγειωνόταν **σε λάθος γραμμή,
σιωπηλά**, μέσα σε σχέδιο που κατατίθεται σε πολεοδομία. Το Figma το αντέχει επειδή έχει τη δομή·
εμείς όχι — και ούτε το ArchiCAD/Revit.

**Συνέπεια που εξαλείφει κώδικα**: το «αλλάζω το master → αλλάζουν όλα τα φύλλα» **δεν χρειάζεται
μηχανή κληρονομιάς**. Το πετυχαίνει **η ίδια η βιβλιοθήκη** (ένα έγγραφο, πολλοί καταναλωτές) —
γι' αυτό το **#5 είναι το θεμέλιο του #1**, όχι αδελφό χαρακτηριστικό.

#### (β) Πού ζει η βιβλιοθήκη: **read-scoped / write-server** (η ασυμμετρία, λυμένη)

Ο **κώδικας** (όχι το ADR) έδωσε την απάντηση — τρία ευρήματα του Phase-1 audit:

1. **`ScopedLibraryService` (ADR-652 M2) έχει ήδη 4 καταναλωτές** (materials, blocks, family-types,
   stair-presets) — **όχι 2** όπως υπέθετε το handoff. Η πινακίδα γίνεται ο **5ος**.
2. **Τα `firestore.rules` ΗΔΗ επιτρέπουν client-SDK ανάγνωση** του `text_templates`: «κάθε
   authenticated μέλος της εταιρείας διαβάζει τα πρότυπα της εταιρείας του» (ADR-344 Phase 7.E,
   γρ. 5324). Οι *γραφές* είναι κλειδωμένες σε company-admin (defense-in-depth) και ούτως ή άλλως
   περνούν από Admin SDK. ⇒ **Καμία αλλαγή rules, κανένα νέο index.**
3. **Το collection ήταν ΑΔΕΙΟ** (`firestore_count` = 0) ⇒ **κανένα backfill** για το νέο `scope`.

Άρα η ασυμμετρία «`ScopedLibraryService` = client / `text-template.service` = server-only (γιατί
γράφει `EntityAudit`, ADR-195)» λύνεται με **διαχωρισμό ρόλων**, όχι με δεύτερη μηχανή (N.18):

- **ΑΝΑΓΝΩΣΕΙΣ** → ο **υπάρχων** `ScopedLibraryService`: multi-scope merge + cache TTL +
  equality-guarded `subscribe` + tenant isolation. **Μηδέν γραμμή ξαναγράφτηκε.**
- **ΓΡΑΦΕΣ** → τα **υπάρχοντα** API routes ⇒ διατηρούνται audit trail + Zod + enterprise ids (N.6).

**Παρενέργεια που έπρεπε να διορθωθεί (N.18)**: οι γραφές τις χρειάζονται **δύο** καταναλωτές (ο
manager των προτύπων και η βιβλιοθήκη πινακίδας). Αντί για δύο σετ πανομοιότυπων `fetch` wrappers,
το σύρμα εξήχθη **μία φορά** → **NEW** `text-template-api.ts`· ο `useTextTemplateMutations` **ξαναγράφτηκε**
πάνω του (κρατά μόνο την optimistic σημασιολογία του). Επίσης η **λίστα πεδίων** του εγγράφου υπήρχε
**τρεις φορές** (Firestore doc / wire type / route helper) και ξέφευγε σιωπηλά σε κάθε νέο πεδίο ⇒
ενοποιήθηκε σε **ένα** generic `UserTextTemplateFields<TTime>` (`Timestamp` για το Firestore, `string`
για το σύρμα).

#### (γ) Το μοντέλο κληρονομιάς, συγκεκριμένα

Νέα πεδία στο `TextTemplate` / `text_templates`:

| Πεδίο | Τι λέει |
|---|---|
| `scope` | `system` (built-in, ζει σε TS) · `company` (**γραφείου** — ταξιδεύει σε κάθε έργο) · `project` · `user`. Το `system` **δεν γράφεται ποτέ** από client (ίδιο gate με ADR-652 M3). |
| `projectId` | Ο ιδιοκτήτης όταν `scope === 'project'`· αλλιώς `null`. |
| `parentId` | Η **προέλευση** μιας **αποσπασμένης** παραλλαγής. `null` στην κανονική περίπτωση (αναφορά). |
| `parentSyncedAt` | Το `updatedAt` **του γονιού** στον τελευταίο συγχρονισμό (ms). |
| `titleBlock` | `{withStampBox, stampLabel}` — ό,τι κρατά και ένα preset, ώστε ένα αποθηκευμένο πρότυπο να τυπώνεται **ακριβώς όπως σώθηκε**. |

**Γιατί υπάρχει το `parentSyncedAt` (και δεν αρκεί το `updatedAt`)**: αν η ερώτηση ήταν «ο γονιός
είναι νεότερος **από το παιδί**;», τότε **οποιαδήποτε** αλλαγή στο παιδί θα έσβηνε την ειδοποίηση και
η διόρθωση του γραφείου θα **χανόταν σιωπηλά**. Η σωστή ερώτηση είναι «άλλαξε ο γονιός **μετά τον
τελευταίο μου συγχρονισμό**;». Καρφωμένο με test (`template-inheritance.test.ts`, 14 tests).

**Γιατί δεν υπάρχει κίνδυνος κύκλου / άπειρου βρόχου**: η κληρονομιά **δεν λύνεται αναδρομικά** — το
αποσπασμένο πρότυπο κουβαλά ήδη ΟΛΟ του το περιεχόμενο, οπότε **καμία ανάγνωση δεν ανεβαίνει την
αλυσίδα γονέων**. Ο μόνος χειρισμός γονιού είναι **βάθους 1** και ρητός (pull).

#### (δ) Γιατί ζωντανή συνδρομή και όχι fetch-on-open

Ο `TitleBlockLibraryHost` (mirror του `BlockLibraryRegistryHost`) κρατά **ένα** live merge listener
για όλη τη ζωή του viewer και τρέφει τον `title-block-library-store` (vanilla, sync getter — ADR-040:
το κλικ/ghost/PDF διαβάζουν **χωρίς `await`**). **Αυτό ΕΙΝΑΙ το must-have #1**: μόλις το γραφείο
διορθώσει το master, η αλλαγή φτάνει σε **κάθε ανοιχτό έργο** χωρίς refresh. Ένα fetch-μία-φορά θα
έδειχνε μπαγιάτικη πινακίδα μέχρι το επόμενο reload.

Το `presetId` του `title-block-options-store` κρατά πλέον **είτε** built-in preset id **είτε**
enterprise id αποθηκευμένου προτύπου — **ένα** ενωμένο dropdown στο ribbon (Revit content library:
system content δίπλα σε office content). Άγνωστο/διαγραμμένο id ⇒ πέφτει στο default preset, **ποτέ
crash**.

---

### 5.9 Πώς γίνεται το batch editing χωρίς δεύτερο data path (αρχιτεκτονικές αποφάσεις Φάσης Ι, 2026-07-14)

#### (α) Το «batch» μίκρυνε — και αυτό είναι **νίκη**, όχι έλλειψη

Το must-have #3 γράφτηκε κοιτώντας το **Vectorworks**, όπου ο μηχανικός επιλέγει πολλά φύλλα και
αλλάζει μαζικά κοινά πεδία. Στη **δική μας** αρχιτεκτονική αυτό **έπαψε να χρειάζεται UI**:

| Τι αλλάζει ο χρήστης | Vectorworks | Εδώ (μετά τις Φάσεις Ζ/Θ) |
|---|---|---|
| Πρότυπο πινακίδας | batch σε επιλεγμένα φύλλα | **ΕΝΑ** έγγραφο βιβλιοθήκης, όλα τα φύλλα το **δείχνουν** ⇒ ήδη ζωντανά παντού (§5.8) |
| Στοιχεία έργου / μελετητή / σφραγίδα | batch | **ΕΝΑ** resident record (`scope-builder`) ⇒ ήδη παντού (§5.1) |
| Αναθεώρηση | batch | **ΕΝΑ** revision record ⇒ ήδη παντού (§5.7) |
| **Αριθμός & τίτλος φύλλου** | batch | **Εδώ ζει η Φάση Ι** — είναι τα **μόνα** πεδία που *οφείλουν* να διαφέρουν ανά φύλλο |

⇒ Η Φάση Ι είναι **UI πάνω στο υπάρχον κανάλι**, όχι νέο σύστημα. Το batch editing του Vectorworks
είναι *θεραπεία* για αντιγραμμένα δεδομένα· εμείς δεν τα αντιγράψαμε ποτέ.

#### (β) Πού ζει ο αριθμός φύλλου — **η απόφαση της φάσης**

Ο **τίτλος** ήδη persist-άρει: `sheetTitleForLevel(level) = level.entityLabel || level.name` — το
φύλλο **ΕΙΝΑΙ** ο όροφος (§5.5), άρα η ετικέτα του ορόφου **είναι** ο τίτλος του φύλλου. Μηδέν νέο
πεδίο, μηδέν δεύτερη αλήθεια.

Ο **αριθμός** μέχρι τη Φάση Ζ παραγόταν **μόνο** από τη ΘΕΣΗ (`autoSheetNumber(index)`). Αυτό δεν
επιτρέπει «Α-1, Α-2, **Α-5**» ούτε «ΑΡΧ-…» — που ο μηχανικός **χρειάζεται** σε τεύχος αδείας. Οι τρεις
δρόμοι ήταν: (Α) μόνο αυτόματος + αναδιάταξη, (Β) **προαιρετικό persisted override**, (Γ) session-only.
**Επιλέχθηκε ο (Β)** — είναι **ακριβώς** η πρακτική των ηγετών:

- **Revit**: `Sheet Number` = editable, persisted **ιδιότητα του φύλλου**.
- **AutoCAD Sheet Set Manager**: «Rename & Renumber» — ο αριθμός ζει στο sheet, όχι στη θέση.
- **ArchiCAD**: `Layout ID` με **ρητή** επιλογή «**αυτόματο κατά θέση** ή **δικό μου ID**».

⇒ **`Level.sheetNumberOverride?: string | null`** (προαιρετικό· `null`/κενό ⇒ **αυτόματη** αρίθμηση
θέσης). Ο (Γ) απορρίφθηκε ρητά: ο μηχανικός θα ξανα-πληκτρολογούσε την αρίθμηση σε **κάθε** εκτύπωση.

**Σειρά προτεραιότητας — ΜΙΑ, σε ένα σημείο** (`resolveSheetIdentity`, `sheet-set.ts`):

```
pending edit (ο χρήστης άγγιξε το πεδίο)  →  persisted (Level)  →  αυτόματο (θέση / όνομα ορόφου)
```

⚠️ **Κενό πεδίο = «αυτόματο», ΟΧΙ «κράτα το παλιό».** Ένα αγγιγμένο-και-κενό πεδίο **δεν** πέφτει πίσω
στο persisted override — αλλιώς ο χρήστης δεν θα μπορούσε ποτέ να **σβήσει** έναν χειρόγραφο αριθμό,
και η προεπισκόπηση θα έλεγε άλλα από το write (δύο αλήθειες). *Το λάθος αυτό υπήρξε στην πρώτη γραφή
της φάσης και το έπιασε το test — γι' αυτό είναι καρφωμένο εδώ.*

#### (γ) Μηδέν νέο data path — και μηδέν race με το Firestore

- **Γραφή**: ο πίνακας παράγει `SheetLevelUpdate[]` (καθαρή `sheetLevelUpdates`) → **ένα** write ανά
  **όντως** αλλαγμένο όροφο, μέσω του **ΥΠΑΡΧΟΝΤΟΣ** `updateLevelContext` (ADR-286 gateway: audit,
  tenancy, enterprise IDs). Καμία νέα υπηρεσία, κανένα direct Firestore write. Υποβολή χωρίς αλλαγές
  ⇒ **μηδέν writes** (N.7.2 #3 — idempotent).
- **Εκτύπωση**: τα ίδια edits περνούν **ρητά** στο `buildSheetSet(sources, { locale, edits })` ⇒ το PDF
  τυπώνει **ό,τι είδε ο χρήστης**, χωρίς να περιμένει το snapshot round-trip (N.7.2 #2 — **μηδέν race**).
- Από εκεί και πέρα η διαδρομή είναι η **ίδια** της Φάσης Ζ: `SheetSetItem` → `runPrintSet` →
  `TitleBlockScopeOverrides { title, sheetNumber }` → `{{drawing.*}}`. **Κανένα νέο κανάλι.**

#### (δ) Ποια μαζική πράξη χρειάζεται όντως ο μηχανικός

**Επαναρίθμηση** (πρόθεμα + αρχικός αριθμός) σε επιλεγμένα φύλλα, **στη σειρά του σετ** (όχι στη σειρά
επιλογής) — AutoCAD SSM «Rename & Renumber» / ArchiCAD «Renumber Layouts» — και η **αντίστροφη** πράξη
(«αυτόματη αρίθμηση» ⇒ καθαρίζει τα overrides· ο χρήστης δεν κλειδώνεται ποτέ). Ο **τίτλος** είναι εξ
ορισμού μοναδικός ανά φύλλο ⇒ γράφεται **inline** στη γραμμή του, όχι μαζικά (ίδια επιλογή με τους
ηγέτες: το «Rename» του SSM περπατά φύλλο-φύλλο).

**Νέα αρχεία**: `sheet-edits.ts` (καθαρές πράξεις), `SheetSetEditor.tsx` + `useSheetSetEdits.ts` (UI).
**Boy Scout (N.0.2)**: το `LevelContextUpdate` ήταν διπλογραμμένο inline σε `useLevels.ts` +
`level-panel-hooks.ts` → κεντρικοποιήθηκε στον **έναν** τύπο.

---

### 5.10 Τι σημαίνει «η πινακίδα μου στα αγγλικά» (αρχιτεκτονικές αποφάσεις Φάσης Κ, 2026-07-14)

#### (α) Το κενό ήταν **μικρότερο** απ' ό,τι έλεγε ο τίτλος του #8 #7

Το SSoT audit (κώδικας, όχι ADR) έδειξε ότι τα **τρία τέταρτα** του «auto-localization» υπήρχαν ήδη:

| Κομμάτι | Κατάσταση πριν τη Φάση Κ |
|---|---|
| **Ημερομηνίες / format** | **ήδη** locale-aware: `scope.formatting.locale` → `toShortDate` (`el-GR`/`en-US`), §5.1 |
| **Built-in presets** | **ήδη** δίγλωσσα: `titleBlockPreset(id).templates = { el, en }` + `stampLabel = { el, en }` |
| **Placeholders `{{…}}`** | **ποτέ** δεν μεταφράζονται — είναι **δεδομένα**, όχι κείμενο |
| **Στατικές ετικέτες ενός ΑΠΟΘΗΚΕΥΜΕΝΟΥ / AI προτύπου** | **❌ ΤΟ ΚΕΝΟ** — ένα content, καμία δεύτερη γλώσσα |

⇒ Το πραγματικό ερώτημα δεν ήταν «πώς μεταφράζουμε» αλλά **«τι είναι η αγγλική πινακίδα: το ίδιο
έγγραφο ή άλλο;»**

#### (β) Η απόφαση: **ξεχωριστή γλωσσική παραλλαγή** (Δρόμος Β) — έγκριση Giorgio 2026-07-14

| Δρόμος | Γιατί ΟΧΙ / ΝΑΙ |
|---|---|
| (Α) **Δίγλωσσο content** (`{ el, en }` σε κάθε αποθηκευμένο πρότυπο) | ❌ Θα άλλαζε το σχήμα του `text_templates` (σήμερα: **ένα** doc = **ένα** content), θα ήθελε migration + αλλαγή στον επεξεργαστή προτύπων — **και κανένα μεγάλο CAD δεν το κάνει έτσι**. |
| (Β) **Μεταγλώττιση → ΝΕΟ πρότυπο** με `parentId` στο ελληνικό | ✅ **ΕΠΙΛΕΧΘΗΚΕ.** Είναι **ακριβώς** η πρακτική των ηγετών: Revit → ξεχωριστή title-block **family** ανά γλώσσα· ArchiCAD → ξεχωριστό **Master Layout**. Ρητή, ελέγξιμη, **διορθώσιμη** μετάφραση. Και το κρίσιμο: **ο μηχανισμός υπάρχει ήδη** — είναι η **απόσπαση** της Φάσης Θ (`detach` + `parentId` + `parentSyncedAt`) με **μεταφρασμένο** περιεχόμενο. **Μηδέν νέο service, μηδέν νέο data path** (N.18). |
| (Γ) **Μετάφραση on-the-fly στο render** | ❌ Μη-ελέγξιμη μηχανική μετάφραση μέσα σε **κατατεθειμένο** σχέδιο. Απαγορεύεται. |

**Το τίμημα του (Β)** — και η μόνη αλλαγή σχήματος: το `locale` γίνεται **persisted** πεδίο του
`text_templates` (υπήρχε ήδη στον τύπο `TextTemplate`, αλλά **μόνο** για τα built-ins — ποτέ δεν
ταξίδευε στο Firestore). **Χωρίς αυτό, δύο πράγματα σπάνε σιωπηλά**:
1. το **«Ενημέρωση από τον γονιό»** θα αντέγραφε τα **ελληνικά** πάνω στην αγγλική πινακίδα και θα
   **κατέστρεφε τη μετάφραση** (η παγίδα που εντοπίστηκε πριν γραφτεί κώδικας),
2. η **εναλλαγή γλώσσας** δεν θα μπορούσε να βρει την παραλλαγή.

⇒ `buildDetachPayload` / `buildPullPayload` δέχονται πλέον `TemplateVariantOverrides`
(`content` + `locale` + `titleBlock`). Το `template-inheritance.ts` **δεν ξέρει από γλώσσες** — ο
καλών δίνει έτοιμο το μεταφρασμένο περιεχόμενο (μία μηχανή απόσπασης για **όλες** τις παραλλαγές).
Το pull μιας **γλωσσικής** παραλλαγής **ξανα-μεταφράζει** τον γονιό αντί να τον αντιγράψει.

#### (γ) Ποιος μεταφράζει: **λεξικό πρώτα, AI μόνο για τα άγνωστα, ο χρήστης πάντα τελευταίος**

1. **Ντετερμινιστικό λεξικό** — **δεν γράφτηκε· παράγεται**. Οι όροι ΤΕΕ είναι **ήδη** γραμμένοι δύο
   φορές (EL/EN σε κάθε built-in preset, §5.2). Ένα χειρόγραφο `GLOSSARY = {...}` θα ήταν **τρίτο**
   αντίγραφο, που θα έλεγε ψέματα την πρώτη φορά που κάποιος διόρθωνε ένα preset (N.18). Αντ' αυτού
   τα presets **ζευγαρώνονται κατά θέση** και τα literals (ό,τι δεν είναι placeholder) *είναι* το
   λεξικό. Προσθέτει κανείς πεδίο σε preset ⇒ το λεξικό το μαθαίνει **μόνο του**.
   *Το test το αποδεικνύει*: κάθε ελληνικό preset μεταφράζεται **ακριβώς** στο αγγλικό αδελφάκι του.
2. **AI fallback** (υπάρχον route Φάσης Δ, `+1 endpoint`) — **μόνο** για ό,τι δεν ξέρει το λεξικό
   (ετικέτες που έγραψε ο ίδιος ο μηχανικός). Σημασμένο ρητά ως «AI» στο UI.
3. **Ο χρήστης** — βλέπει κάθε ετικέτα, την **προέλευσή** της και ζωντανή προεπισκόπηση· διορθώνει
   ό,τι θέλει και **εγκρίνει**. Τίποτα δεν γράφεται πριν το «Δημιουργία» (μοτίβο Φάσης Η).
   Άγνωστος όρος που έμεινε κενός ⇒ **μένει ως έχει** — ποτέ κενό, ποτέ μαντεψιά.

#### (δ) Η εναλλαγή γλώσσας εναλλάσσει **μόνο σε εγκεκριμένη** παραλλαγή

`titleBlockTemplateForLocale(locale)`: για **built-in** preset αλλάζει ελεύθερα γλώσσα (δικά μας
κείμενα). Για **αποθηκευμένο** πρότυπο ψάχνει τη γλωσσική παραλλαγή (`findTitleBlockVariant`, βάθος 1:
παιδί / γονιός / αδελφή) — **δεν υπάρχει ⇒ δεν αλλάζει τίποτα**. Καμία μηχανική μετάφραση δεν μπαίνει
σε σχέδιο μόνη της.

**Boy Scout (N.0.2)**: το ενεργό **πρότυπο** και το ενεργό **κελί σφραγίδας** λύνονταν σε **δύο
παράλληλες** αναζητήσεις πάνω στις ίδιες τρεις βαθμίδες. Με τη γλωσσική παραλλαγή αυτό θα έσπαγε
σιωπηλά (αγγλικό κείμενο + **ελληνική** σφραγίδα) ⇒ ενοποιήθηκαν σε **έναν** resolver
(`resolveActiveTitleBlock`, N.7.2 #5).

---

## 6. Roadmap (6 Φάσεις — υλοποίηση αργότερα, 1 φάση/session)

- **Φάση Α — Data wiring** *(μικρό, ασφαλές θεμέλιο)* — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-13** (βλ. changelog):
  προσθήκη `project.location` + `project.client` στο `PLACEHOLDER_REGISTRY`· `scope-builder` διαβάζει
  τα πεδία· σύνδεση Print με πραγματικό `Project` name (αντί `level.name`)· i18n keys (ΘΕΣΗ/ΕΡΓΟΔΟΤΗΣ).
  ⚠️ owner/location/client → PDF εκκρεμεί (§4.2 #5, client projection gap).
- **Φάση Β — «Insert title block into scene» command** *(#1 gap)* — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-13** (βλ.
  changelog): resolve template με πραγματικό scope (νέο server route) → `DetailPrimitive[]` (ADR-622) →
  entities → **`BlockEntity`** στο ενεργό σχέδιο μέσω του υπάρχοντος `buildBlockEntityFromDef` +
  `addBlockToScene` (undoable). Νέο ToolType `title-block` + ribbon κουμπί «Πινακίδα» + i18n EL/EN.
  Μίνιμαλ πλαίσιο (περίγραμμα + κεφαλίδα + γραμμές)· η **πλήρης κορνίζα ISO 5457 = Φάση Γ**.
- **Φάση Γ — Γραφική κορνίζα ISO 5457 + reflow + presets** — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-13** (βλ.
  changelog): πλήρες περιμετρικό frame + πινακίδα κάτω-δεξιά **παραμετρικά ανά χαρτί** (A4↔A0 ×
  όρθιο/πλαγιαστό)· **έξυπνη πρόταση χαρτιού** από το bbox του σχεδίου ÷ την ενεργή κλίμακα (πρόταση,
  όχι κλείδωμα)· **βιβλιοθήκη 4 presets** («Τυπική» / «Άδεια δόμησης» με κελί σφραγίδας + ΤΕΕ πεδία /
  «Απλή» / «Λεπτομέρεια», EL+EN)· contextual ribbon tab «Πινακίδα Σχεδίου» (πρότυπο / μέγεθος /
  προσανατολισμό / κορνίζα / γωνία / κλίμακα).
- **Φάση Δ — AI ναυαρχίδα (3 δυνατότητες, όραμα Giorgio)** — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-14** (βλ.
  changelog): **κλείνει το κενό #7** (§4.2). Αρχιτεκτονική: **§5.6**.
  - **Εικόνα→Πινακίδα**: upload screenshot/φωτό υπάρχουσας πινακίδας → **vision LLM** (`generateObject`
    + `getOpenAIProvider`, μοντέλο `VISION_MODEL`) → **δομημένο σχήμα** → reconciliation με το
    `PLACEHOLDER_REGISTRY` → editable `TextTemplate`. *Κανένας ανταγωνιστής δεν το κάνει.*
  - **Φυσική-γλώσσα→Πινακίδα**: «φτιάξε πινακίδα A2 άδειας δόμησης» → LLM παράγει ΤΕΕ-συμβατό template
    (ίδιο σχήμα, ίδιο reconciliation — μία μηχανή, δύο είσοδοι).
  - **AI compliance validation** (§8 #5): semantic έλεγχος **πάνω** από τον rule-based της Φάσης Ε —
    **προειδοποίηση, όχι φραγή** (Απόφαση #4).
  - **Zero-config auto-fill**: αυτόματο γέμισμα από πραγματικό Project/Company/User — **ήδη κλειστό**
    από τη Φάση Α/Β (ο `scope-builder` γεμίζει από το ενεργό έργο· το AI preview το χρησιμοποιεί).
- **Φάση Ε — Ελληνική συμμόρφωση + σφραγίδα-εικόνα** — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-13** (βλ.
  changelog): **κλείνει το κενό #6**. Η πινακίδα γίνεται **καταθέσιμη**: (α) σφραγίδα/υπογραφή
  μηχανικού ως **εικόνα** (upload μία φορά → αυτόματα σε **κάθε** πινακίδα: οθόνη + PDF + DXF),
  (β) **rule-based έλεγχος πληρότητας** στον διάλογο εκτύπωσης (Α.Μ. ΤΕΕ / κλίμακα / θέση /
  σφραγίδα) — **προειδοποίηση, όχι μπλοκάρισμα** (Απόφαση #4), (γ) το preset **«Άδεια δόμησης»**
  επιβεβαιώθηκε ότι φέρει **όλα** τα de-facto υποχρεωτικά πεδία της §2. Αρχιτεκτονική: **§5.4**.
  *Εκτός φάσης*: **AI** validation (§8 #5 — εδώ μόνο rule-based), revision/issue table
  management (Απόφαση #9 — μένει ανοιχτό).
- **Φάση ΣΤ — Εκτύπωση & Εξαγωγή (WYSIWYG)** — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-13** (βλ. changelog):
  **κλείνει το κενό #5**. Το PDF τυπώνει την **ίδια** κορνίζα ISO 5457 + πινακίδα με την οθόνη, από το
  **ίδιο** layout model (§5.3), με **πραγματικά** στοιχεία έργου/μελετητή, στο χαρτί του διαλόγου
  εκτύπωσης· το σχέδιο τοποθετείται στην **ωφέλιμη** περιοχή (ποτέ κάτω από την πινακίδα)· ο διάλογος
  **προτείνει** πινακίδα όταν λείπει (Απόφαση #10β)· η πινακίδα εξάγεται ήδη ως πραγματικό **DXF
  BLOCK/INSERT** (ADR-636/644/648 — καρφώθηκε με test, μηδέν νέος writer). Το legacy `drawTitleBlock`
  **διαγράφηκε**. *Εκτός φάσης*: multi-sheet σετ (Ζ), paperspace layouts.
- **Φάση Ζ — Multi-sheet sets + auto-numbering (σετ αδείας μονομιάς)** — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-14**
  (βλ. changelog): **κλείνει το κενό #3** (§4.2) για το κομμάτι σετ+αρίθμηση. Ο μηχανικός παράγει
  **ολόκληρο σετ φύλλων** (κατόψεις όλων των ορόφων) **μονομιάς** ως ένα **πολυσέλιδο PDF**, με
  **αυτόματη αρίθμηση** (Α-1, Α-2…) και **συνεπή πινακίδα** σε όλα. Αρχιτεκτονική: **§5.5** — «Sheet
  Set» παραγόμενο από τα levels (μηδέν νέο persistence), auto-numbering καθαρή συνάρτηση → scope
  override, ίδιος print pipeline (assembler έγινε πολυσέλιδος χωρίς διπλότυπο). UI: checkbox «όλο το
  σετ» στον υπάρχοντα διάλογο εκτύπωσης (2Δ, ≥2 φύλλα). *Εκτός φάσης*: AI batch-δημιουργία (Φάση Δ,
  §8 #4), native paperspace LAYOUT/VPORT records (DEFERRED, ADR-453), revision/issue table
  (Απόφαση #9). Το DXF-σετ καλύπτεται ήδη από το `all-zip` (ADR-505).
- **Φάση Η — Πίνακας αναθεωρήσεων + AI auto-changelog** — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-14** (βλ.
  changelog): **κλείνει το κενό #8** (§4.2) και την **Απόφαση #9**. Το σύστημα κρατά **μόνο του** την
  ιστορία εκδόσεων του έργου (ντετερμινιστικός αριθμός + ημερομηνία + συντάκτης) και **προτείνει με AI
  τι άλλαξε** συγκρίνοντας τη νέα με την προηγούμενη έκδοση — ο χρήστης **εγκρίνει/διορθώνει**.
  Αρχιτεκτονική: **§5.7** (persisted ανά έργο = Revit· idempotent με ντετερμινιστικό doc id· ο κώδικας
  μετράει, το AI διατυπώνει· τα `revision.*` γεμίζουν μέσω του **υπάρχοντος** καναλιού overrides ⇒
  πινακίδα + πίνακας αναθεωρήσεων στα 3 backends δωρεάν). *Εκτός φάσης*: AI batch-δημιουργία σετ
  (§8 #4), native paperspace LAYOUT/VPORT (DEFERRED), mapping `accounting_settings` (§9).

- **Φάση Θ — Βιβλιοθήκη προτύπων γραφείου + master/κληρονομιά** — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-14** (βλ.
  changelog): **κλείνει τα must-have #5 και #1** (§7). Το πρότυπο πινακίδας παύει να είναι «ό,τι έχει
  αυτή η εταιρεία σε έναν σωρό» και αποκτά **εμβέλεια**: `company` (**γραφείου** — ταξιδεύει σε κάθε
  έργο) / `project` / `user`, μέσω του **υπάρχοντος** `ScopedLibraryService` (5ος καταναλωτής).
  Η κληρονομιά ακολουθεί την **πρακτική ArchiCAD/Revit** (απόφαση Giorgio «Δρόμος 1»): **αναφορά**
  στο master (μηδέν αντίγραφα ⇒ μία διόρθωση φτάνει παντού, ζωντανά) **ή** ρητή **απόσπαση**
  παραλλαγής έργου με **«Ενημέρωση από τον γονιό»** — **ποτέ** μερική κληρονομιά AST. Αρχιτεκτονική:
  **§5.8**. *Εκτός φάσης*: **batch editing** (#3) → **Φάση Ι**.
- **Φάση Ι — Batch editing πολλών φύλλων** — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-14** (βλ. changelog):
  **κλείνει το must-have #3** — και μαζί **και τα 7** του §7. Πίνακας φύλλων μέσα στον **υπάρχοντα**
  διάλογο εκτύπωσης (αριθμός/τίτλος ανά φύλλο + **μαζική επαναρίθμηση** επιλεγμένων), πάνω στο
  **υπάρχον** κανάλι `TitleBlockScopeOverrides` + `buildSheetSet`. **Μηδέν νέο data path.**
  Ο αριθμός φύλλου έγινε **προαιρετικό persisted πεδίο του ορόφου** (`Level.sheetNumberOverride`) —
  η πρακτική των ηγετών (Revit/AutoCAD SSM/ArchiCAD). Αρχιτεκτονική: **§5.9**.
- **Φάση Κ — Auto-localization EL↔EN** *(προαιρετικό AI-magic §8 #7)* — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-14**
  (βλ. changelog): η αγγλική/ελληνική πινακίδα ενός **αποθηκευμένου/AI** προτύπου ως **ξεχωριστή
  γλωσσική παραλλαγή** (απόσπαση με `parentId` — Revit family / ArchiCAD Master Layout), με **λεξικό
  παραγμένο από τα δίγλωσσα presets** + **AI fallback** για τα άγνωστα + **ρητή έγκριση**. Μηδέν νέο
  service, μηδέν νέο data path. Αρχιτεκτονική: **§5.10**.

---

## 7. Must-have features (από τους ηγέτες — τι πρέπει να έχει το σύστημά μας)

1. **Master/parent-child template + real-time inheritance** — αλλαγή στο master → όλα τα φύλλα (ArchiCAD).
   — **✅ ΠΑΡΑΔΟΘΗΚΕ (Φάση Θ, 2026-07-14)**: **αναφορά, όχι αντίγραφο** — τα έργα δείχνουν στο master
   και η ζωντανή συνδρομή το φέρνει σε **κάθε ανοιχτό έργο** χωρίς refresh· παραλλαγή = ρητή
   **απόσπαση** + **«Ενημέρωση από τον γονιό»** (pull, ποτέ σιωπηλό push). Απόφαση Giorgio «Δρόμος 1»
   (ArchiCAD/Revit). Βλ. **§5.8**.
2. **Two-way data binding με project metadata** — live references, όχι static κείμενο (Autotext/fields).
   — **✅** (Φάσεις Α/Β: `scope-builder` + resolver πάνω στο πραγματικό `Project`/`Company`/`User`).
3. **Batch/mass editing πολλών φύλλων ταυτόχρονα** (Vectorworks).
   — **✅ ΠΑΡΑΔΟΘΗΚΕ (Φάση Ι, 2026-07-14)**: πίνακας φύλλων στον διάλογο εκτύπωσης — **αριθμός** και
   **τίτλος** ανά φύλλο + **μαζική επαναρίθμηση** επιλεγμένων (πρόθεμα + αρχικός αριθμός). Ό,τι είναι
   **κοινό** στα φύλλα **δεν έχει καθόλου batch UI** — και δεν πρέπει: μετά τις Φάσεις Ζ/Θ όλα τα φύλλα
   λύνουν το **ΙΔΙΟ** πρότυπο και τα **ΙΔΙΑ** στοιχεία έργου ⇒ μία διόρθωση αλλάζει ήδη όλα τα φύλλα,
   ζωντανά (αυτό είναι **ισχυρότερο** από το batch editing του Vectorworks, όχι ασθενέστερο). Βλ. **§5.9**.
4. **Auto revision/issue worksheets** από τα ίδια δεδομένα, χωρίς διπλή καταχώρηση (Vectorworks).
   — **✅** (Φάση Η).
5. **Reusable template libraries μεταξύ έργων** (project templates / πρότυπα γραφείου).
   — **✅ ΠΑΡΑΔΟΘΗΚΕ (Φάση Θ, 2026-07-14)**: `scope` στα `text_templates` (`company`/`project`/`user`)
   μέσω του **υπάρχοντος** `ScopedLibraryService` (5ος καταναλωτής — καμία νέα υπηρεσία, N.18).
   Βλ. **§5.8**.
6. **Consistency/error-proofing** — αδύνατη ασυμφωνία μεταξύ φύλλων (μία πηγή αλήθειας).
   — **✅** (Φάση Ζ: σετ = live view πάνω σε ΕΝΑ μοντέλο· Φάση Θ: ΕΝΑ πρότυπο, πολλοί καταναλωτές).
7. **Multi paper-size** (A4→A0) με parametric reflow (ISO 5457).
   — **✅** (Φάση Γ).

---

## 8. AI-magic Differentiators (γιατί ξεπερνάμε τους ηγέτες)

**Ναυαρχίδα (Φάση Δ, εγκεκριμένο όραμα) — ✅ ΠΑΡΑΔΟΘΗΚΕ 2026-07-14:**
1. **Εικόνα → Πινακίδα** — ✅ φωτογραφίζεις/ανεβάζεις οποιαδήποτε υπάρχουσα πινακίδα, το AI την
   αναδημιουργεί ως editable template (vector, όχι raster). **Μοναδικό στην αγορά.**
2. **Φυσική γλώσσα → Πινακίδα** — ✅ «πινακίδα A2 άδειας δόμησης» → πλήρης ΤΕΕ-συμβατή πινακίδα.
3. **Zero-config auto-fill** — ✅ μηδέν πληκτρολόγηση (Φάσεις Α/Β)· έναντι πολύπλοκου shared-params
   του Revit.

**Μελλοντικές (καταγραφή για roadmap, όχι δέσμευση):**
4. **Auto batch-δημιουργία σετ φύλλων από πρόθεση** — «σετ αδείας: κατόψεις όλων ορόφων + 2 τομές +
   4 όψεις» → auto sheets με σωστή αρίθμηση/τίτλους (κατεύθυνση Revit 2027).
5. **AI compliance validation** — ✅ **ΠΑΡΑΔΟΘΗΚΕ (Φάση Δ)**: semantic έλεγχος πάνω από τον
   rule-based της Φάσης Ε (ο rule-based τρέχει πρώτος και δίνεται ως context, ώστε το AI να μην τον
   επαναλαμβάνει). Προειδοποίηση, ποτέ φραγή.
6. **Auto-changelog revision** — ✅ **ΠΑΡΑΔΟΘΗΚΕ (Φάση Η, 2026-07-14)**: diff του **μοντέλου** vs η
   προηγούμενη έκδοση (τον μετράει ο **κώδικας**, ντετερμινιστικά) → το AI **προτείνει** την περιγραφή
   αλλαγής· ο χρήστης εγκρίνει/διορθώνει (ποτέ αυτόματη εγγραφή). **Κανείς ανταγωνιστής δεν το κάνει** —
   Revit/Vectorworks/ArchiCAD κρατούν τον πίνακα, αλλά την περιγραφή τη γράφει πάντα ο μηχανικός. §5.7.
7. **Auto-localization EL↔EN** πινακίδας με ένα κλικ (όρους/μονάδες/format ημερομηνίας).
   — **✅ ΠΑΡΑΔΟΘΗΚΕ (Φάση Κ, 2026-07-14)**: format ημερομηνίας **ήδη** locale-aware (§5.1)· τα
   built-in presets **ήδη** δίγλωσσα (§5.2). Το κενό ήταν τα στατικά labels ενός **αποθηκευμένου /
   AI** προτύπου ⇒ λύθηκε ως **ξεχωριστή γλωσσική παραλλαγή** (απόσπαση με `parentId`, όπως Revit
   title-block family / ArchiCAD Master Layout), με **λεξικό παραγμένο από τα presets** + **AI
   fallback** για τα άγνωστα + **ρητή έγκριση** του χρήστη. Μηδέν νέο data path. **§5.10**.
8. **QR/version fingerprint** που συνδέει το τυπωμένο σχέδιο με το ζωντανό cloud μοντέλο.
9. **Έξυπνη πρόταση κλίμακας/χαρτιού** βάσει bbox αντικειμένου + κανόνων ISO 5457.
   — **✅ ΠΑΡΑΔΟΘΗΚΕ (Φάση Γ: in-scene· 2026-07-14: ΚΑΙ στην εκτύπωση)**: η **ίδια** καθαρή
   `suggestPaperSpec` έχει πλέον **δύο** καταναλωτές (N.18 — καμία δεύτερη υλοποίηση): το εργαλείο
   πινακίδας (πρόταση με την **κλίμακα οθόνης**) και ο **διάλογος εκτύπωσης** (πρόταση με την
   **τυπωμένη** κλίμακα — η μόνη που μετράει για το χαρτί). Στον διάλογο εμφανίζεται μόνο σε
   «κλίμακα σχεδίου» (στο fit-to-page **κάθε** χαρτί χωράει εξ ορισμού) και μόνο όταν διαφέρει από
   την επιλογή του χρήστη· εφαρμόζεται με **κουμπί** — **πρόταση, ποτέ κλείδωμα** (Giorgio).
   Η μετατροπή μονάδων (scene σε **μέτρα** ⇒ mm) ζει στο μοντέλο (`drawingExtentMmOf`), με την ΙΔΙΑ
   αριθμητική του print pipeline (`1 / mmToSceneUnits(units)`), **όχι** στο UI.

---

## 9. Ανοιχτά ερωτήματα (για επόμενες αποφάσεις)

- ~~**Πού «ζει» η πινακίδα;**~~ **✅ ΑΠΟΦΑΣΙΣΤΗΚΕ (Giorgio, 2026-07-13): ΚΑΙ ΤΑ ΔΥΟ** — (α) ως
  «κορνίζα» σε ξεχωριστό χαρτί εκτύπωσης (paperspace-style layout, έτοιμο για PDF/print) **ΚΑΙ**
  (β) ως τοποθετήσιμο αντικείμενο μέσα στο ίδιο το σχέδιο (model-space group/BLOCK, επιλέγεται/
  μετακινείται/undo). Υλοποιητική σειρά: πρώτα το in-scene (Φάση Β, απλούστερο), μετά το πλήρες
  paperspace layout. Βλ. §11 Αποφάσεις.
- **Νομικά στοιχεία γραφείου** (Επωνυμία μελέτης/ΑΦΜ/ΔΟΥ) ζουν στο `accounting_settings/{companyId}`
  (ADR-439), όχι στο `CompanyDocument` — χρειάζεται mapping αν θέλουμε πλήρη στοιχεία μελετητικού.
- **Persistence AI-generated template**: per-tenant στο `text_templates` (υπάρχον CRUD) — OK.
- **Άδεια βιβλιοθηκών** (αν χρειαστεί image-processing/QR): μόνο MIT/Apache/BSD (ADR-034).

---

## 11. Αποφάσεις Giorgio (διευκρινίσεις — Q&A)

Καταγραφή απαντήσεων σε διευκρινιστικές ερωτήσεις (μία-μία, απλή γλώσσα). Δεσμευτικές για την υλοποίηση.

1. **Θέση πινακίδας → ΚΑΙ ΤΑ ΔΥΟ** *(2026-07-13)*: Η πινακίδα πρέπει να υποστηρίζεται (α) ως
   **«κορνίζα» σε ξεχωριστό χαρτί εκτύπωσης** (paperspace layout, έτοιμο για PDF/print) **ΚΑΙ** (β)
   ως **τοποθετήσιμο αντικείμενο μέσα στο σχέδιο** (model-space, επιλέγεται/μετακινείται/undo).
   → Επηρεάζει §6: η Φάση Β παραδίδει το in-scene αντικείμενο· προστίθεται paperspace layout στο
   roadmap (πριν ή μαζί με τη Φάση ΣΤ export). Και οι δύο μορφές μοιράζονται το ΙΔΙΟ resolved
   μοντέλο (preview === PDF === in-scene), όπως το detail-sheet pattern (ADR-622).

2. **Μέγεθος & προσανατολισμός χαρτιού → ΕΛΕΥΘΕΡΗ ΕΠΙΛΟΓΗ + ΕΞΥΠΝΗ ΠΡΟΤΑΣΗ** *(2026-07-13)*:
   Ο χρήστης μπορεί να διαλέξει **οποιοδήποτε** μέγεθος (A4/A3/A2/A1/A0) και προσανατολισμό (όρθιο/
   πλαγιαστό) — η πινακίδα προσαρμόζεται (parametric reflow ανά ISO 5457). **ΕΠΙΠΛΕΟΝ**, το πρόγραμμα
   **προτείνει αυτόματα** το κατάλληλο μέγεθος βάσει του bbox του σχεδίου (+ τυπική κλίμακα 1:50),
   αλλά ο χρήστης μπορεί πάντα να το αλλάξει (default έξυπνο, όχι κλειδωμένο).
   → Επηρεάζει §6 Φάση Γ (parametric reflow = υποχρεωτικό, όχι μόνο ένα μέγεθος) και προωθεί το
   §8 στοιχείο #9 (έξυπνη πρόταση κλίμακας/χαρτιού) από «μελλοντικό» σε **core** χαρακτηριστικό.
   Reuse: υπάρχον paper SSoT (`print/config/paper-*.ts`, A4–A0/orientation/mm↔px).

3. **Πεδία πινακίδας → ΒΙΒΛΙΟΘΗΚΗ ΕΤΟΙΜΩΝ ΠΡΟΤΥΠΩΝ (presets) + επεξεργάσιμα** *(2026-07-13)*:
   Ο χρήστης **διαλέγει** από πολλές έτοιμες φόρμες ανά περίσταση — π.χ. **«Άδεια δόμησης»**
   (πλήρη ΤΕΕ πεδία: μελετητής/ΑΜ ΤΕΕ/εργοδότης/θέση/σφραγίδα), **«Απλή»**, **«Λεπτομέρεια»** —
   και μετά μπορεί να προσθέσει/αφαιρέσει/μετονομάσει πεδία. Δεν είναι ούτε ένα κλειδωμένο layout
   ούτε «άδεια φόρμα από το μηδέν».
   → Υλοποίηση: κάθε preset = ένα built-in `TextTemplate` (category `'title-block'`) στο
   `text-engine/templates/defaults/` (το `title-blocks.ts` = ήδη το πρώτο preset). Χρειάζονται
   **περισσότερα built-in presets** + ο χρήστης τα κλωνοποιεί/επεξεργάζεται → user template στο
   Firestore (`text_templates`, υπάρχον CRUD). Reuse: υπάρχον management UI + resolver. Ταιριάζει
   απόλυτα με το two-tier μοντέλο του ADR-344 (built-in immutable + user editable).

4. **Γέμισμα στοιχείων → ZERO-CONFIG AUTO-FILL + ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΕΛΛΕΙΨΕΩΝ** *(2026-07-13)*: Τα
   πεδία γεμίζουν **μόνα τους** από τα στοιχεία του ενεργού έργου (Project/Company/User) — ο χρήστης
   απλά διορθώνει. **ΕΠΙΠΛΕΟΝ**, το σύστημα **προειδοποιεί τι λείπει** πριν την εκτύπωση/κατάθεση
   (π.χ. λείπει Κλίμακα / ΑΜ ΤΕΕ / σφραγίδα).
   → Επιβεβαιώνει τη Φάση Α (scope-builder auto-hydrate) + **προωθεί το §8 στοιχείο #5 (AI/rule-based
   compliance validation) από «μελλοντικό» σε core** — μπαίνει στη Φάση Ε (ή νωρίτερα ως απλός
   rule-based έλεγχος υποχρεωτικών πεδίων, χωρίς AI). Χρειάζεται: mapping νομικών στοιχείων γραφείου
   από `accounting_settings/{companyId}` (ADR-439) — βλ. §9 ανοιχτό ερώτημα — ώστε να μη «λείπουν»
   ψευδώς πεδία που υπάρχουν αλλού.

5. **AI Εικόνα→Πινακίδα: πιστότητα → «ΙΔΙΑ ΔΙΑΤΑΞΗ, ΑΛΛΑ ΚΑΘΑΡΗ»** *(2026-07-13)*: Το vision AI
   **δεν** παράγει pixel-perfect αντίγραφο ούτε αγνοεί τη διάταξη. Κρατά τον **σκελετό/δομή** της
   φωτογραφίας (ποια πεδία υπάρχουν, σε ποια κελιά, σχετικές θέσεις/μεγέθη) και το **ξανασχεδιάζει
   καθαρά** στο δικό μας στυλ (ίσια, ευθυγραμμισμένα, editable).
   → Επηρεάζει §6 Φάση Δ (Εικόνα→Πινακίδα): το AI output = **δομημένο layout** (grid κελιών +
   αντιστοίχιση πεδίων), ΟΧΙ raster/εικόνα. Παράγει ένα `TextTemplate` + region layout που τρέφει
   τον ίδιο renderer (preview === PDF === in-scene). Το «καθαρό ξανασχεδίασμα» = φυσικό αποτέλεσμα
   του ότι το output είναι vector template, όχι εικόνα. Χρειάζεται: σχήμα (schema) που το vision
   model γεμίζει (πεδία + θέσεις σε πλέγμα), + reconciliation με τα υπάρχοντα placeholders.

6. **Σφραγίδα/υπογραφή → ΚΑΙ ΤΑ ΤΡΙΑ** *(2026-07-13)*: Το κελί «ΣΦΡΑΓΙΔΑ» υποστηρίζει (α)
   **ανεβασμένη εικόνα** σφραγίδας/υπογραφής (μπαίνει αυτόματα σε όλα τα σχέδια), (β) **γραπτά
   στοιχεία** (όνομα + ειδικότητα + ΑΜ ΤΕΕ — υπάρχει ήδη μέσω `defaults/stamps.ts`), (γ) **κενό
   κουτί** για χειροκίνητη σφράγιση μετά την εκτύπωση.
   → Επηρεάζει §6 Φάση Ε: **κλείνει το gap #6** (σφραγίδα-ως-εικόνα). Χρειάζεται: image upload +
   αποθήκευση (Firebase Storage, company-scoped, `storage.rules`) + νέος τύπος «image cell» στο
   template model (δίπλα στα text cells). Η κειμενική (β) και το κενό (γ) καλύπτονται ήδη/εύκολα.
   License: τυχόν image-processing βιβλιοθήκη μόνο MIT/Apache/BSD (ADR-034).

7. **Ένα ή πολλά → ΟΛΟΚΛΗΡΟ ΣΕΤ ΜΑΖΙ (multi-sheet), με αυτόματη αρίθμηση** *(2026-07-13)*: Ο
   χρήστης θέλει να παράγει **ολόκληρο σετ φύλλων ενός έργου μονομιάς** (κατόψεις όλων των ορόφων +
   τομές + όψεις), με **αυτόματη αρίθμηση** (Α-1, Α-2, Α-3…) και συνεπή πινακίδα σε όλα.
   → **ΣΗΜΑΝΤΙΚΟ scope change**: το multi-sheet/layout ήταν ρητά **DEFERRED** (ADR-453, gap #3 στο
   §4.2). Πλέον γίνεται **πρώτης γραμμής απαίτηση** — προστίθεται νέα **Φάση Ζ (Multi-sheet sets)**
   στο §6: έννοια «Sheet Set» (σύνολο φύλλων ανά έργο) + auto-numbering + batch εφαρμογή/ενημέρωση
   πινακίδας σε όλα τα φύλλα (όπως Vectorworks Title Block Manager / AutoCAD Sheet Set Manager).
   Ταιριάζει με το §7 must-have #3 (batch editing) & #4 (auto revision worksheets). Χρειάζεται
   νέο data model «SheetSet» + πιθανό ADR-συνέχεια για paperspace layouts (μεγαλύτερο κομμάτι).
   → **Αναθεωρημένη σειρά προτεραιότητας** (πρόταση): Α (data) → Β (in-scene insert) → Γ (κορνίζα
   ISO 5457/reflow) → Δ (AI: εικόνα/NL/auto-fill) → Ε (ελληνική συμμόρφωση/σφραγίδα-εικόνα/validation)
   → **Ζ (multi-sheet sets + auto-numbering)** → ΣΤ (export DXF/PDF ολόκληρου σετ).

8. **Γλώσσα τίτλων → ΕΛΛΗΝΙΚΑ + ΚΟΥΜΠΙ ΕΝΑΛΛΑΓΗΣ ΣΕ ΑΓΓΛΙΚΑ** *(2026-07-13)*: Προεπιλογή ελληνικά
   (όπως το δείγμα)· ένα κουμπί αλλάζει **όλους** τους σταθερούς τίτλους σε αγγλικά (για ξένα έργα).
   ΟΧΙ δίγλωσσο δίπλα-δίπλα ως default.
   → Εύκολο/φυσικό: τα built-in templates έχουν **ήδη** EL+EN εκδοχές (`defaults/title-blocks.ts`,
   `stamps.ts` bilingual). Η εναλλαγή = επιλογή locale του template. Οι **σταθεροί τίτλοι** (labels)
   είναι i18n keys (N.11)· οι **τιμές** (project data) μένουν ως έχουν. Προωθεί το §8 στοιχείο #7
   (auto-localization) σε άμεσα διαθέσιμο. Χρειάζεται: EN labels για τα νέα πεδία (ΘΕΣΗ→Location,
   ΕΡΓΟΔΟΤΗΣ→Client) στα locale JSONs.

9. ✅ **ΕΠΙΛΥΘΗΚΕ (Φάση Η, 2026-07-14 — βλ. §5.7)** — **Αναθεωρήσεις → ΑΥΤΟΜΑΤΟ ΙΣΤΟΡΙΚΟ + AI ΠΡΟΤΑΣΗ
   ΑΛΛΑΓΗΣ** *(2026-07-13)*. **Συμπληρωματική απόφαση Giorgio (2026-07-14): επίπεδο = ΑΝΑ ΕΡΓΟ**
   (τρόπος Revit — μία λίστα αναθεωρήσεων· η «1η Αναθεώρηση» τυπώνεται στην πινακίδα ΟΛΩΝ των φύλλων
   του σετ αδείας, ακόμη κι αν άλλαξε μόνο μία κάτοψη· το AI λέει τι άλλαξε **ανά φύλλο**). Το
   `entity_audit_trail` (ADR-195) **απορρίφθηκε** ως πηγή: είναι audit **πεδίων BIM οντοτήτων**, όχι
   εκδόσεων σχεδίου (λάθος επίπεδο) — αντ' αυτού το ίδιο το revision record είναι append-only ιστορικό.
   Αρχικό κείμενο: Το σύστημα κρατά
   **μόνο του** τον πίνακα αναθεωρήσεων (αριθμός 1η/2η/3η + ημερομηνία) και, επιπλέον, **προτείνει
   μόνο του τι άλλαξε** συγκρίνοντας τη νέα με την προηγούμενη έκδοση (ο χρήστης εγκρίνει/διορθώνει).
   → Προωθεί το §8 στοιχείο #6 (auto-changelog revision via model diff) σε **core** (μπαίνει στη
   Φάση Ε ή σε δικό της υπο-φάση). Υπάρχει ήδη revision template (`defaults/revision.ts`) + το
   entity-audit trail (ADR-195) που καταγράφει αλλαγές — δυνητική πηγή για το diff. Χρειάζεται:
   versioning/snapshot του σχεδίου + AI σύνοψη diff (reuse υπάρχον AI pipeline). Δένει με το
   §7 must-have #4 (auto revision worksheets).

10. **Σημείο έναρξης (UX) → ΚΑΙ ΤΑ ΔΥΟ** *(2026-07-13)*: (α) **Κουμπί «Πινακίδα»** στη γραμμή
    εργαλείων (ribbon) που το πατάς όποτε θες, **ΚΑΙ** (β) **αυτόματη υπενθύμιση/πρόταση** την ώρα
    της εκτύπωσης/εξαγωγής αν το σχέδιο δεν έχει ακόμα πινακίδα.
    → Επηρεάζει §6: νέο ribbon tool (Φάση Γ) + hook στο print/export flow (Φάση ΣΤ) που ανιχνεύει
    «λείπει πινακίδα» και προτείνει δημιουργία. Reuse: υπάρχον ribbon/contextual-tab σύστημα +
    PrintHost/export-service. Δένει με την Απόφαση #4 (προειδοποίηση ελλείψεων).

---

## 10. Πηγές (έρευνα 2026-07-13)

**Revit / AutoCAD:**
- Autodesk — Custom parameters σε title blocks: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Adding-custom-parameters-to-titleblocks.html
- Autodesk Knowledge Network — Apply Label to Title Block: https://knowledge.autodesk.com/support/revit-products/learn-explore/caas/CloudHelp/cloudhelp/2018/ENU/Revit-Customize/files/GUID-70588AF5-A2A1-4FA3-8171-7C4734BCBD41-htm.html
- Autodesk AutoCAD Blog — Automate Title Block Data (Sheet Sets): https://www.autodesk.com/blogs/autocad/automate-title-block-data-autocad/
- Novedge — AutoCAD Fields for live title block data: https://novedge.com/blogs/design-news/autocad-tip-autocad-fields-for-live-auto-updating-title-block-sheet-set-and-object-data

**ArchiCAD / Vectorworks / BricsCAD / DraftSight:**
- Graphisoft — New Autotext options (Master Layout): https://community.graphisoft.com/t5/Documentation/New-Autotext-Options-for-Master-Layout-and-Subset-Information/ta-p/339123
- Graphisoft — Insert Autotext: https://help.graphisoft.com/AC/27/INT/_AC27_Help/070_Documentation/070_Documentation-67.htm
- Vectorworks — Concept: Title block borders: https://app-help.vectorworks.net/2024/eng/VW2024_Guide/Setup/Concept_title_block_borders.htm
- Vectorworks — Revision/Issue history worksheets: https://app-help.vectorworks.net/2025/eng/VW2025_Guide/Setup/Project_revision_and_issue_history_worksheets.htm
- BricsCAD — Using Fields in Title Blocks (PDF): https://boa.bricsys.com/static/protected/forumAttach/27364/UsingFieldsInTitleBlocks.pdf
- DraftSight 2026 — Attributes/Fields/DIESEL: https://www.javelin-tech.com/blog/2026/01/how-to-use-block-attributes-linked-fields-and-diesel-expressions-in-draftsight-2026/

**Cloud / AI εργαλεία & τάσεις:**
- AEC Magazine — Arcol / BIM 2.0: https://aecmag.com/bim/arcol-unleashed-bim-2-0/
- AEC Magazine — Snaptrude: https://aecmag.com/bim/snaptrude-ai-conceptual-design-and-beyond/
- AEC Magazine — Forma building design: https://aecmag.com/bim/forma-building-design/
- ArchiLabs — Revit AI assistants benchmark 2025: https://archilabs.ai/posts/revit-ai-assistants-in-2025-a-real-world-benchmark
- adsknews — Neural CAD foundation models: https://adsknews.autodesk.com/en/news/upcoming-3d-generative-ai-foundation-models/

**Πρότυπα & Ελληνικό πλαίσιο:**
- ISO 7200:2004 — official: https://www.iso.org/standard/35446.html · Wikipedia: https://en.wikipedia.org/wiki/ISO_7200
- ISO 5457:1999 — official: https://www.iso.org/standard/29017.html · sample PDF: https://cdn.standards.iteh.ai/samples/29017/e46c0ec5d98f470aab82dae76889f229/ISO-5457-1999.pdf
- RoyMech — Title Blocks (ISO 7200 breakdown): https://www.roymech.co.uk/Useful_Tables/Drawing/Title_blocks.html
- Ν.4030/2011 Άρθρο 54 (εργοταξιακή πινακίδα): https://www.opengov.gr/minenv/?p=7692
- ΤΕΕ ΚΔΘ — Προδιαγραφές μελετών έκδοσης αδειών (PDF): https://tee-kdth.gr/wp-content/uploads/2017/09/prod_meleton_ekdosis_oikod_adeion.pdf
- michanikos.gr — «δεν υπάρχει τυποποίηση πινακίδας»: https://www.michanikos.gr/forums/topic/27370-υπόδειγμα-αρχιτεκτονικών/

**DXF προγραμματιστική αναπαράσταση (BLOCK/ATTRIB):**
- ezdxf — INSERT & auto attribs: https://ezdxf.readthedocs.io/en/stable/blocks/insert.html
- dxfwrite — ATTDEF/ATTRIB: https://dxfwrite.readthedocs.io/en/latest/entities/attdef.html

---

## Changelog

- **2026-07-14 (Φάση Κ — Auto-localization EL↔EN, §8 #7, ΥΛΟΠΟΙΗΣΗ)**: το **1ο** από τα τρία
  προαιρετικά AI-magic. Αρχιτεκτονική: **§5.10**.
  - **SSoT audit ΠΡΩΤΑ (ο κώδικας η αλήθεια)**: τα ¾ του «auto-localization» υπήρχαν ήδη —
    ημερομηνίες/format locale-aware (§5.1), built-in presets δίγλωσσα (§5.2), placeholders **ποτέ**
    μεταφράσιμα. Το κενό ήταν **μόνο** τα στατικά labels ενός **αποθηκευμένου/AI** προτύπου.
  - **Απόφαση (§5.10β), έγκριση Giorgio**: **ξεχωριστή γλωσσική παραλλαγή** (Δρόμος Β) — νέο πρότυπο
    με `parentId` στο αρχικό, **ακριβώς** όπως Revit title-block family / ArchiCAD Master Layout.
    **Ο μηχανισμός υπήρχε ήδη**: η **απόσπαση** της Φάσης Θ (`detach`) με μεταφρασμένο περιεχόμενο.
    Μηδέν νέο service, μηδέν νέο data path (N.18).
  - **Το `locale` έγινε persisted πεδίο** του `text_templates` (υπήρχε στον τύπο `TextTemplate`,
    μόνο για built-ins). **Χωρίς αυτό δύο πράγματα σπάνε σιωπηλά**: (1) το «Ενημέρωση από τον γονιό»
    θα έγραφε ελληνικά πάνω στην αγγλική πινακίδα (καταστροφή μετάφρασης), (2) η εναλλαγή γλώσσας
    δεν θα έβρισκε την παραλλαγή. Καμία αλλαγή `firestore.rules` (το `text_templates` δεν έχει field
    allowlist). Πέρασε από **όλα** τα layers: Zod → server `create`/`update` → serializer → wire →
    library service.
  - **Το λεξικό ΠΑΡΑΓΕΤΑΙ, δεν γράφτηκε** (`title-block-glossary.ts`): τα δίγλωσσα presets
    ζευγαρώνονται **κατά θέση παραγράφου**· τα literals *είναι* το λεξικό. Test-απόδειξη: κάθε
    ελληνικό preset μεταφράζεται **ακριβώς** στο αγγλικό αδελφάκι του. Ταίριασμα ανεξάρτητο από
    τόνους/πεζά-κεφαλαία.
  - **AI fallback** μόνο για τα άγνωστα (`+1 endpoint` στο υπάρχον AI route Φάσης Δ — γενίκευση του
    `runTitleBlockAi`, μηδέν δεύτερος provider/usage tracker), με **ρητή έγκριση** χρήστη πριν γραφτεί
    (μοτίβο AI changelog Φάσης Η). Άγνωστος όρος κενός ⇒ **μένει ως έχει**, ποτέ μαντεψιά.
  - **Boy Scout (N.0.2)**: πρότυπο + κελί σφραγίδας λύνονταν σε **δύο παράλληλες** αναζητήσεις (θα
    τύπωναν αγγλικό κείμενο με ελληνική σφραγίδα) → **ένας** resolver `resolveActiveTitleBlock`.
  - **Νέα αρχεία**: `localization/{title-block-glossary,localize-title-block,title-block-variant}.ts`,
    `ai/ai-title-block-translate.ts`, `ai/translate/route.ts`, `ui/…/{useTitleBlockLocalize.ts,
    TitleBlockLocalizeDialog.tsx}`. **Tests**: `localize-title-block` (15) + `title-block-variant` (9).
    Όλα τα υπάρχοντα text-engine tests (46 suites/576) πράσινα. N.18 `jscpd:diff` καθαρό.
- **2026-07-14 (§8 #9 — Έξυπνη πρόταση χαρτιού ΚΑΙ στην εκτύπωση)**: το SSoT audit της Φάσης Ι
  εντόπισε ότι η `suggestPaperSpec` (Φάση Γ) καλούνταν **μόνο** από το in-scene εργαλείο — ο
  διάλογος εκτύπωσης, εκεί δηλαδή που ο μηχανικός **επιλέγει** χαρτί, δεν την έβλεπε ποτέ.
  **Δεύτερος καταναλωτής της ίδιας καθαρής συνάρτησης** (N.18 — μηδέν δεύτερη υλοποίηση):
  - **MOD** `suggest-paper.ts`: **NEW** `drawingExtentMmOf(entities, units)` — το bbox σε **mm
    μοντέλου**. Η μετατροπή μονάδων ζει στο **μοντέλο**, όχι στο UI: το scene μπορεί να είναι σε
    **μέτρα** (ADR-368/462) ενώ ο `suggestPaperSpec` μιλά πάντα mm· ίδια αριθμητική με το print
    pipeline (`1 / mmToSceneUnits(units)`, `capture-2d.ts`) ⇒ η πρόταση αφορά **αυτό που θα τυπωθεί**.
  - **MOD** `PrintHost` (bbox μία φορά ανά άνοιγμα) → `PrintDialog` (πρόταση με την **τυπωμένη**
    κλίμακα, μόνο σε «κλίμακα σχεδίου» + 2Δ, μόνο όταν **διαφέρει** από την επιλογή) →
    `PrintPaperControls` (γραμμή πρότασης + κουμπί «Εφαρμογή»). **Πρόταση, ποτέ κλείδωμα** (Giorgio).
  - **Tests**: **NEW** `__tests__/suggest-paper.test.ts` (7 tests: μονάδες mm/μέτρα, κενό σχέδιο ⇒
    καμία πρόταση, μικρότερο φύλλο που χωράει, προσανατολισμός κατ' αναλογία, άκυρη κλίμακα ⇒ A0).
    Σύνολο title-block + print: **176 pass**. `jscpd:diff`: καθαρό. i18n: `print.paperSuggestion.*`.

- **2026-07-14 (Φάση Ι — Batch editing πολλών φύλλων, ΥΛΟΠΟΙΗΣΗ)**: **κλείνει το must-have #3** — και
  μαζί **ΚΑΙ ΤΑ 7** must-have του §7. Αρχιτεκτονική: **§5.9**.
  - **Phase 1 recognition — ο κώδικας επιβεβαίωσε το κανάλι**: `TitleBlockScopeOverrides { title,
    sheetNumber }` + `buildSheetSet` → `runPrintSet` υπάρχουν και δουλεύουν ⇒ **μηδέν νέο data path**.
    Ο **τίτλος** φύλλου ήδη persist-άρει (`level.entityLabel`, γραφή μέσω `updateLevelContext`) ⇒ η
    μόνη ανοιχτή απόφαση ήταν ο **αριθμός**.
  - **Απόφαση (§5.9β)**: ο αριθμός φύλλου γίνεται **προαιρετικό persisted πεδίο του ορόφου** —
    **`Level.sheetNumberOverride`** (κενό/`null` ⇒ αυτόματη αρίθμηση θέσης). Είναι **ακριβώς** η
    πρακτική των ηγετών (Revit `Sheet Number`· AutoCAD SSM «Rename & Renumber»· ArchiCAD `Layout ID`
    = «αυτόματο κατά θέση **ή** δικό μου ID»). Ο δρόμος «session-only overrides» **απορρίφθηκε** (ο
    μηχανικός θα ξανα-πληκτρολογούσε την αρίθμηση σε κάθε εκτύπωση).
  - **Μοντέλο (καθαρό, testable)** — **MOD** `sheet-set.ts`: `resolveSheetIdentity` = **η ΜΟΝΗ** σειρά
    προτεραιότητας (pending → persisted → αυτόματο)· `buildSheetSet(sources, { locale, edits })`·
    `buildSheetRows` (οι γραμμές του πίνακα)· `SheetSetItem.levelId` (ταυτότητα για write-back).
    **NEW** `sheet-edits.ts`: `mergeSheetEdits` (ίδια αναφορά όταν τίποτα δεν αλλάζει ⇒ idempotent),
    `renumberSheets` / `autoNumberSheets` (μαζικές πράξεις, **σειρά σετ** όχι σειρά επιλογής),
    `sheetLevelUpdates` (**μόνο** ό,τι όντως άλλαξε ⇒ μηδέν περιττά writes).
  - **🐞 Η παγίδα που έπιασε το test** (καρφωμένη στο §5.9β): στην πρώτη γραφή, κενό pending πεδίο
    **έπεφτε πίσω στο persisted override** ⇒ ο χρήστης **δεν θα μπορούσε ποτέ να σβήσει** έναν
    χειρόγραφο αριθμό, και η προεπισκόπηση θα έδειχνε άλλα από το write. Σωστός κανόνας: **αγγιγμένο
    κενό πεδίο = «αυτόματο»**.
  - **UI** — **NEW** `SheetSetEditor.tsx` + `useSheetSetEdits.ts` μέσα στον **υπάρχοντα** `PrintDialog`
    (εμφανίζεται μόνο με «όλο το σετ», 2Δ, ≥2 φύλλα): `[✓] | Φύλλο (όροφος) | Αριθμός | Τίτλος` +
    επαναρίθμηση επιλεγμένων (πρόθεμα + αρχικός αριθμός) + «αυτόματη αρίθμηση». Placeholder = η
    αυτόματη τιμή ⇒ «κενό = αυτόματο» φαίνεται, δεν εξηγείται. i18n: `print.sheets.*` (el+en).
  - **Γραφή**: `PrintHost` → `sheetLevelUpdates` → **ΥΠΑΡΧΟΝ** `updateLevelContext` (ADR-286 gateway),
    `await` **πριν** την εκτύπωση, και τα ίδια edits **ρητά** στο `buildSheetSet` ⇒ **μηδέν race** με
    το Firestore snapshot (N.7.2 #2). **MOD** persistence touch points: `levels/config.ts`,
    `dxf-levels.schemas.ts`, `dxf-levels.handlers.ts`, `useLevelOperations.ts`.
  - **Boy Scout (N.0.2)**: το `LevelContextUpdate` ήταν **διπλογραμμένο inline** σε `useLevels.ts` και
    `level-panel-hooks.ts` → κεντρικοποιήθηκε στον **έναν** τύπο.
  - **Tests**: **NEW** `__tests__/sheet-edits.test.ts` (18 tests: σειρά προτεραιότητας, σβήσιμο
    override, idempotency, μαζική επαναρίθμηση, άγνωστο `levelId` ⇒ ποτέ crash, «τι γράφεται όντως»).
    Σύνολο title-block + print: **125 pass**. `jscpd:diff`: καθαρό (N.18).

- **2026-07-14 (Φάση Θ — Βιβλιοθήκη γραφείου + master/κληρονομιά, ΥΛΟΠΟΙΗΣΗ)**: **κλείνει τα
  must-have #5 και #1** (§7). Αρχιτεκτονική: **§5.8**. Απόφαση Giorgio: **«Δρόμος 1»** — αναφορά ή
  απόσπαση, **ποτέ** μερική κληρονομιά AST (ArchiCAD Master Layout / Revit).
  - **Phase 1 recognition — ο κώδικας διόρθωσε τρεις υποθέσεις**: (α) ο `ScopedLibraryService` έχει
    ήδη **4** καταναλωτές (όχι 2)· (β) οι `firestore.rules` **ήδη επιτρέπουν** client-SDK ανάγνωση
    του `text_templates` ⇒ **καμία αλλαγή rules/indexes**· (γ) το collection ήταν **ΑΔΕΙΟ**
    (`firestore_count` = 0) ⇒ **κανένα backfill** για το νέο `scope`. Επίσης: το εργαλείο πινακίδας
    **δεν κατανάλωνε ποτέ** user templates (μόνο τα 4 built-in presets) ⇒ το κενό ήταν **μεγαλύτερο**
    απ' ό,τι έλεγε το handoff (δεν υπήρχε καν δρόμος «πρότυπο γραφείου → picker»).
  - **Μοντέλο**: νέα πεδία `scope` / `projectId` / `parentId` / `parentSyncedAt` / `titleBlock` στο
    `TextTemplate` + `text_templates` (types, Zod, service, routes, serializer). Το `system` scope
    **δεν γράφεται ποτέ** από client (gate ίδιο με ADR-652 M3). Η **«δημοσίευση»** αλλάζει το scope
    του **ΙΔΙΟΥ** εγγράφου (ποτέ δεύτερο αντίγραφο) — και μπαίνει στο **audit trail**.
  - **Κληρονομιά (καθαρή, testable)** — **NEW** `templates/template-inheritance.ts`:
    `isParentUpdateAvailable` / `findParentTemplate` (βάθος 1 ⇒ **αδύνατος** άπειρος βρόχος) /
    `canDetachFrom` / `buildDetachPayload` / `buildPullPayload`. **14 tests**
    (`__tests__/template-inheritance.test.ts`), με καρφωμένη την **παγίδα του `updatedAt`**: χωρίς
    `parentSyncedAt`, μια αλλαγή στο παιδί θα έσβηνε την ειδοποίηση και η διόρθωση του γραφείου θα
    **χανόταν σιωπηλά**.
  - **Βιβλιοθήκη (read-scoped / write-server)** — **NEW** `templates/text-template-library.service.ts`:
    **5ος** καταναλωτής του `ScopedLibraryService` (buckets: γραφείου + έργου + δικά μου· **όχι**
    `system` — τα built-in ζουν σε TS). Γραφές μέσω των **υπαρχόντων** routes ⇒ audit + Zod +
    enterprise ids διατηρούνται. **Καμία νέα μηχανή βιβλιοθήκης** (N.18).
  - **Ζωντανό master** — **NEW** `title-block/title-block-library-store.ts` (vanilla store, sync
    getter — ADR-040) + **NEW** `app/TitleBlockLibraryHost.tsx` (always-on live merge listener, mirror
    του `BlockLibraryRegistryHost`). `active-title-block.ts`: το ενεργό πρότυπο λύνεται πλέον από
    **τρεις** πηγές (AI override → βιβλιοθήκη → built-in preset), event-time, μηδέν `await`.
  - **UI** — **NEW** διάλογος «Βιβλιοθήκη Προτύπων Πινακίδας» (`TitleBlockLibraryDialog` +
    `useTitleBlockLibrary` + `TitleBlockLibraryDialogHost`, EventBus gate μοτίβο Φάσης Η) + κουμπί
    «Βιβλιοθήκη» στο contextual tab. Το ribbon dropdown «Πρότυπο» δείχνει πλέον **ενωμένα** built-ins
    + αποθηκευμένα πρότυπα (δυναμικά options από τον bridge). i18n EL+EN (`titleBlockLibrary.*`).
  - **N.18 εκκαθάριση που προέκυψε στη διαδρομή**: (α) το `fetch` σύρμα των προτύπων υπήρχε **δύο**
    φορές ⇒ **NEW** `text-template-api.ts` (ο ΕΝΑΣ HTTP client)· ο `useTextTemplateMutations`
    ξαναγράφτηκε πάνω του (κρατά μόνο την optimistic σημασιολογία). (β) η **λίστα πεδίων** του
    εγγράφου υπήρχε **τρεις** φορές (Firestore doc / wire / route helper) ⇒ ένα generic
    `UserTextTemplateFields<TTime>`. `jscpd:diff` σε 17 αρχεία: **καθαρό**.
  - **Tests**: 25 suites / **272 passing** (templates + title-block + text-templates UI) — μηδέν
    regression από το refactor του api client.
  - *Εκτός φάσης*: **batch editing** (#3) → **Φάση Ι** (το κανάλι υπάρχει· λείπει το UI).

- **2026-07-14 (Φάση Η — Πίνακας αναθεωρήσεων + AI auto-changelog, ΥΛΟΠΟΙΗΣΗ)**: **κλείνει την
  Απόφαση #9** (κενό #8, §4.2) — το τελευταίο core κενό του ADR. Το σύστημα κρατά **μόνο του** την
  ιστορία εκδόσεων και **προτείνει μόνο του τι άλλαξε**. Αρχιτεκτονική: **§5.7**.
  - **Phase 1 recognition — ο κώδικας επιβεβαίωσε το κενό**: `revision.number/date/author/description`
    **υπήρχαν ήδη** στο `PLACEHOLDER_REGISTRY`, τα διάβαζε ο `readRevision` του resolver, υπήρχε
    `PlaceholderScopeRevision` **και** έτοιμο δίγλωσσο `defaults/revision.ts` — **κανείς δεν τα
    γέμιζε**. Ίδιο μοτίβο με το `drawing.sheetNumber` πριν τη Φάση Ζ ⇒ **μηδέν νέα placeholders**,
    μόνο **παραγωγός**. Το `entity_audit_trail` (ADR-195) **απορρίφθηκε** ως πηγή του diff (καλύπτει
    μόνο BIM οντότητες, σε επίπεδο **πεδίου** — λάθος επίπεδο· και είναι ratchet-protected).
  - **Μοντέλο (καθαρό, ντετερμινιστικό)** — **NEW** `text-engine/title-block/revisions/`:
    `revision.types.ts` · `revision-numbering.ts` (μοτίβο `sheet-numbering.ts`: max+1 ⇒ ο αριθμός·
    `formatRevisionNumber` → «1η/2η/3η» EL, «1/2/3» EN — Απόφαση #8) · `revision-snapshot.ts`
    (αποτύπωμα σετ: **υπογραφή ανά οντότητα** `idHash:contentHash:type` + `countsByType`· canonical
    JSON με ταξινομημένα κλειδιά ⇒ μηδέν ψεύτικες «τροποποιήσεις»· `MAX_SIGNATURES` 12.000 ⇒ coarse
    mode **δηλωμένο**, ποτέ σιωπηλή περικοπή) · `revision-diff.ts` (**προστέθηκε/αφαιρέθηκε/
    τροποποιήθηκε** ανά τύπο + νέα/αφαιρεμένα φύλλα + `baseline`).
  - **Persistence (νέο collection, append-only)** — **NEW** `drawing_revisions` (+ `DRAWING_REVISIONS`
    στο `firestore-collections.ts`) & **NEW** prefix `drev` + `generateDrawingRevisionId` +
    **`generateDeterministicDrawingRevisionId`** (ADR-632 Φ5 μοτίβο). **NEW**
    `drawing-revision.service.ts` (server-only, admin SDK, `setDoc` — N.6): **idempotency ΔΟΜΙΚΗ** —
    doc id = ντετερμινιστικό ανά `(projectId, digest)` ⇒ δύο κλικ «Νέα αναθεώρηση» ⇒ **ΕΝΑ** doc
    (`created: false`). Ο **αριθμός** παράγεται server-side (πηγή αλήθειας της ιστορίας)· query
    `companyId + projectId` **χωρίς** composite index (ταξινόμηση στη μνήμη).
  - **Παραγωγός (μηδέν δεύτερο data path)** — **MOD** `active-title-block.ts`:
    `TitleBlockScopeOverrides.revision` + το `buildActiveTitleBlockScope` γεμίζει τα `{{revision.*}}`
    από την **τρέχουσα** αναθεώρηση· **MOD** `loadTitleBlockAssets` την προ-φορτώνει στο **ίδιο**
    σημείο (ένας ιδιοκτήτης lifecycle) ⇒ **NEW** `revision-client.ts` (module singleton cache,
    ADR-040 getters — μηδέν `await` στο κλικ/ghost/PDF). ⇒ **πινακίδα + πίνακας αναθεωρήσεων γεμίζουν
    στα 3 backends δωρεάν** (§7 must-have #4). **MOD** `resolver.ts` (εξήχθη `toShortDate` — η
    ημερομηνία στον διάλογο === η ημερομηνία που τυπώνεται) · **MOD** `sheet-set.ts` (εξήχθη
    `sheetTitleForLevel` — το φύλλο λέγεται το ΙΔΙΟ σε PDF και πίνακα αναθεωρήσεων, N.18).
  - **AI auto-changelog (§8 #6)** — **NEW** `ai/ai-revision-changelog-schema.ts` (Zod) +
    `ai/ai-revision-changelog.ts` (server-only): **ο κώδικας μετράει, το AI διατυπώνει** — στο μοντέλο
    δίνεται ο **έτοιμος** diff, ποτέ το σχέδιο ⇒ κανένα «το LLM μέτρησε λάθος τους τοίχους».
    `getOpenAIProvider` + `generateObject` + `recordUsage` (κανάλι `dxf-title-block-ai`) — **καμία**
    αλλαγή στο `src/services/ai-pipeline/` (N.10 δεν ενεργοποιείται). **Graceful `null`**.
  - **Routes (server-only)** — **NEW** `api/dxf/revisions/route.ts` (GET ιστορία / POST καταχώρηση·
    το GET **δεν** στέλνει snapshots — ~260KB που ο client δεν χρειάζεται· ο συντάκτης λύνεται από τον
    **ίδιο** `buildPlaceholderScope` που γεμίζει την πινακίδα) + **NEW**
    `api/dxf/text-templates/ai/revision-changelog/route.ts` (reuse του **κοινού** `_ai-route-helpers`
    της Φάσης Δ· επιστρέφει **diff + πρόταση**) + **NEW** `_revision-route-helpers.ts` (το `jscpd:diff`
    έπιασε δίδυμο wire parsing στα δύο routes ⇒ **εξήχθη SSoT**, N.18).
  - **UI (κανένα νέο σύστημα)** — **NEW** `RevisionsDialog.tsx` (ιστορικό + ντετερμινιστικός diff +
    AI πρόταση + **έγκριση/διόρθωση** πριν την καταχώρηση) + `useRevisions.ts` + **NEW**
    `app/RevisionsHost.tsx` (event-gated, mirror `AiTitleBlockHost`). **MOD** κουμπί «Αναθεωρήσεις…»
    στο **υπάρχον** contextual tab «Πινακίδα Σχεδίου» (`open-revisions-dialog` → EventBus
    `dxf:revisions-dialog-requested`) · `RibbonButtonIcon` (`revisions`) · lazy + `DxfViewerDialogs` ·
    i18n `{el,en}/dxf-viewer-shell.json` (`revisions.*` + `ribbon.commands.titleBlockRevisions*`).
  - **Tests**: `revisions/__tests__/revision-snapshot-diff.test.ts` (10 — σταθερό digest ανεξάρτητα
    σειράς = idempotency· αλλαγή σχεδίου ⇒ αλλαγή digest· selection ≠ αλλαγή· added/removed/**modified**
    διακριτά· νέο/αφαιρεμένο φύλλο). Σύνολο text-engine: **519/519 πράσινα**. `jscpd:diff` **καθαρό**.
- **2026-07-14 (Φάση Δ — AI ναυαρχίδα: Εικόνα→Πινακίδα · Φυσική-γλώσσα→Πινακίδα · AI compliance,
  ΥΛΟΠΟΙΗΣΗ)**: **κλείνει το κενό #7** (§4.2) — το **τελευταίο** του ADR. Ο μηχανικός **φωτογραφίζει**
  υπάρχουσα πινακίδα ή **την περιγράφει**, και το AI παράγει **επεξεργάσιμο πρότυπο** που ζωγραφίζεται
  από τα ΙΔΙΑ τρία backends. Build-on, πλήρες SSoT reuse (αρχιτεκτονική **§5.6**):
  - **Phase 1 recognition — ο κώδικας διόρθωσε το σχέδιο**: ο `agentic-openai-client.ts` που έδειχνε
    το handoff είναι **LEGACY/DISABLED** (Vercel AI SDK migration, 2026-03-29). Ο ενεργός SSoT είναι
    **`getOpenAIProvider()`** (ADR-294 ratchet) + **`generateObject`** — ίδιο μοτίβο με το **ήδη
    αποδεδειγμένο** `ai-query-translator.ts` (ADR-268). ⇒ **Μηδέν νέος OpenAI client**, μηδέν coupling
    με το accounting analyzer, **καμία** τροποποίηση στο `src/services/ai-pipeline/` (N.10 δεν
    ενεργοποιείται — μόνο κατανάλωση του `recordUsage` SSoT, ADR-259A, κανάλι `dxf-title-block-ai`).
  - **AI schema (SSoT)** — **NEW** `text-engine/title-block/ai/ai-title-block-schema.ts`: Zod schema
    που γεμίζει το μοντέλο (επικεφαλίδα + γραμμές πεδίων + `placeholderPath` + `emphasis` +
    `withStampBox` + `confidence`/`notes`) — **μόνο περιεχόμενο, ποτέ γεωμετρία** (η κορνίζα ανήκει
    στο `sheet-frame.ts`). Strict-mode σύμβαση: όλα υποχρεωτικά, τα προαιρετικά `.nullable()`.
    Μαζί το `aiComplianceSchema` (§8 #5).
  - **Reconciliation (anti-hallucination, καθαρή συνάρτηση)** — **NEW** `ai-title-block-reconcile.ts`:
    κάθε `placeholderPath` περνά από `isKnownPlaceholder` — άγνωστο ⇒ **πέφτει** + `droppedPaths` (το
    UI το λέει). Το `DxfTextNode` χτίζεται με τους **ίδιους** builders των built-ins
    (`makeNode/makeParagraph/makeRun`) και τη **σύμβαση** που ήδη διαβάζει ο renderer («επικεφαλίδα +
    Ετικέτα: τιμή») ⇒ **canvas === PDF === in-scene δωρεάν**, μηδέν νέος render δρόμος. Ένας draft
    builder (`buildDraftTitleBlockTemplate`) τον μοιράζονται reconcile + validate route (N.18).
  - **Generator (server-only)** — **NEW** `ai-title-block-generator.ts`: `generateTitleBlockFromImage`
    (vision, `VISION_MODEL`, image message part) + `generateTitleBlockFromText` (`TEXT_MODEL`) — **μία
    μηχανή, δύο είσοδοι** (κοινό system prompt που παραθέτει τα **γνωστά** placeholder paths από το
    registry). Usage → `recordUsage`. **Graceful `null`** σε κάθε αποτυχία.
  - **AI compliance (§8 #5)** — **NEW** `ai-title-block-compliance.ts`: τρέχει **πρώτα** τον
    rule-based `validateTitleBlock` (Φάση Ε) και τον δίνει ως context ώστε το AI να προσθέσει **μόνο
    σημασιολογικά** ευρήματα (π.χ. ασύμβατη κλίμακα για κάτοψη άδειας). **Προειδοποίηση, ποτέ φραγή**·
    αποτυχία ⇒ `[]` (ο rule-based μένει η βάση).
  - **Routes (server-only, μοτίβο Φάσης Β)** — **NEW** `app/api/dxf/text-templates/ai/{from-image,
    from-text,validate}/route.ts` + **NEW** `_ai-route-helpers.ts` (κοινό κέλυφος
    `withStandardRateLimit` + `withAuth` + try/catch + wire bodies — τα τρία routes ήταν δίδυμα, το
    `jscpd:diff` το έπιασε και **εξήχθη SSoT**, N.18). companyId/userId **από claims**· η εικόνα
    στέλνεται ως base64 data-URI (**throwaway** — δεν αποθηκεύεται) με φραγή μεγέθους.
  - **Persist = υπάρχον CRUD (μηδέν νέο πεδίο/collection)** — το route επιστρέφει **draft**· η
    «Αποθήκευση» περνά από το **υπάρχον** `POST /api/dxf/text-templates` (`generateTextTemplateId` +
    `setDoc`, N.6) ⇒ κανονικό user template στο υπάρχον management UI (two-tier ADR-344).
  - **Insert = υπάρχον εργαλείο (μηδέν νέος μηχανισμός)** — **MOD** `state/title-block-options-store.ts`
    (νέο `aiOverride` — η AI πινακίδα υπερισχύει του preset· η επιλογή preset το **καθαρίζει**) +
    **MOD** `active-title-block.ts` (`titleBlockTemplateForLocale` + νέο `activeStampMeta` ⇒ layout
    **και** έλεγχος πληρότητας τιμούν το override). Η ενεργοποίηση του εργαλείου γίνεται με το **ήδη
    υπάρχον** `level-panel:tool-change` ⇒ single-click τοποθέτηση με ghost/undo/persist της Φάσης Β.
    **MOD** `title-block-presets.ts` (εκτέθηκε `TITLE_BLOCK_STAMP_LABEL` — ίδιο κείμενο κελιού
    σφραγίδας για preset **και** AI πινακίδα, N.18).
  - **UI (κανένα νέο σύστημα)** — **NEW** `AiTitleBlockDialog.tsx` (2 tabs: εικόνα/περιγραφή +
    **live preview** με τον ΙΔΙΟ resolver και τα πραγματικά στοιχεία έργου + AI compliance panel +
    «Αποθήκευση»/«Εισαγωγή») + `useAiTitleBlock.ts` + **NEW** `app/AiTitleBlockHost.tsx` (event-gated,
    mirror `StampHost`) + **NEW** `ai-title-block-client.ts`. **MOD** ribbon κουμπί «AI Πινακίδα…» στο
    contextual «Πινακίδα Σχεδίου» tab (action `open-ai-title-block-dialog` → EventBus
    `dxf:ai-title-block-dialog-requested`), `RibbonButtonIcon` (νέο `ai-title-block` = Wand2),
    `dxf-special-actions.ts`, `drawing-event-map.ts`, `dxf-viewer-lazy-components.tsx`,
    `DxfViewerDialogs.tsx`.
  - **i18n (N.11)** — `aiTitleBlock.*` (13 ομάδες: tabs/image/text/preview/name/compliance/errors) +
    `ribbon.commands.aiTitleBlock{,Tooltip}` σε **EL + EN** (ICU plurals single-brace, CHECK 3.9).
    **Μόνο τα δικά μας κλειδιά** στο κοινό `dxf-viewer-shell.json` (τα κλειδιά πινακίδας Φάσεων Β–Ζ
    επιβεβαιώθηκαν **παρόντα** — 18/18 EL/EN, δεν έλειπαν αυτή τη φορά).
  - **Tests** — **NEW** `ai/__tests__/ai-title-block-reconcile.test.ts` (γνωστά paths → `{{path}}`·
    **άγνωστα πέφτουν** + `droppedPaths`· literal fallback· επικεφαλίδα known/literal/none· έμφαση →
    run style· `withStampBox`· κενές γραμμές· **ντετερμινισμός**· `toAiTitleBlockResult`) + **NEW**
    `ai-title-block-generator.test.ts` (mocked `ai` SDK: structured output, **usage mapping**,
    **graceful null**, image message part). Επηρεαζόμενα suites: **227/227 passing** (title-block +
    templates). `jscpd:diff` **καθαρό** (12 αρχεία, μετά την εξαγωγή του `_ai-route-helpers`).
  - **Εκτός φάσης (αμετάβλητα)**: native paperspace LAYOUT/VPORT (DEFERRED, ADR-453), revision/issue
    table (Απόφαση #9), **AI batch-δημιουργία σετ φύλλων από πρόθεση** (§8 #4 — χτίζει πάνω στο
    `buildSheetSet` της Φάσης Ζ), refactor του AI pipeline/Text Engine/print.
    **Commit/push: εκκρεμεί από Giorgio.**
- **2026-07-14 (Φάση Ζ — Multi-sheet sets + auto-numbering, ΥΛΟΠΟΙΗΣΗ)**: **κλείνει το κενό #3** (§4.2)
  για σετ+αρίθμηση. Ο μηχανικός παράγει **ολόκληρο σετ αδείας μονομιάς** (πολυσέλιδο PDF, ένα φύλλο ανά
  όροφο, αυτόματη αρίθμηση Α-1/Α-2…, ίδια πινακίδα). Build-on, πλήρες SSoT reuse (αρχιτεκτονική **§5.5**):
  - **«Sheet Set» παραγόμενο από τα levels (μηδέν νέο persistence)** — **NEW** `text-engine/title-block/
    sheet-set.ts`: `buildSheetSet(sources, {locale})` — καθαρή, backend-agnostic συνάρτηση (SSoT «ποια
    φύλλα, ποια σειρά, ποια αρίθμηση»). Κάθε level με φορτωμένο scene = ένα φύλλο (πρακτική AutoCAD Sheet
    Set Manager / ArchiCAD Layout Book: live view πάνω σε ΕΝΑ project data model, όχι αντίγραφο). Η
    **σειρά** ορίζεται στον καλούντα (PrintHost) — decoupled από React/context, unit-testable.
  - **Auto-numbering (καθαρή, ντετερμινιστική)** — **NEW** `sheet-numbering.ts`: `autoSheetNumber(index,
    prefix)` → `${prefix}-${index+1}`· `sheetNumberPrefixForLocale` (ελληνικό «Α» / λατινικό «A»,
    Απόφαση #8). Ο αριθμός/τίτλος περνούν ως `drawing.sheetNumber` / `drawing.title` **overrides** —
    **MOD** `active-title-block.ts` (`TitleBlockScopeOverrides` +`title`/`sheetNumber`· ίδιο μοτίβο με το
    `scaleName` της Φάσης Ε). Το `drawing.sheetNumber` placeholder **υπήρχε ήδη** (ADR-344) — απέκτησε
    παραγωγό· **μηδέν** αλλαγή στον resolver.
  - **Πολυσέλιδο PDF από τον ΙΔΙΟ pipeline (το μόνο νέο backend κομμάτι)** — **MOD** `print/assemble/
    pdf-assembler.ts`: νέο `assemblePrintPdfPages(pages, paper)` (`new jsPDF`+font μία φορά, `addPage()`
    ανά φύλλο, κοινός `drawPrintPage`)· το single-page `assemblePrintPdf` έγινε **thin wrapper** — μηδέν
    διπλός κώδικας εξόδου (N.18). **MOD** `print/print-service.ts`: νέο `runPrintSet(request, deps,
    sheets)` — κάθε φύλλο = **ίδιο** `buildSheet` (per-sheet τίτλος/αριθμός) + **ίδιο** 2D capture
    (extracted `capture2dScene` SSoT· το capture ζωγραφίζει από το **περασμένο** scene, όχι το live
    canvas ⇒ και μη-ενεργοί όροφοι) + ο πολυσέλιδος assembler. Σετ = **2Δ μόνο** (τα levels είναι 2Δ
    κατόψεις)· όλα τα φύλλα ΙΔΙΟ χαρτί (συνεπής πινακίδα). **MOD** `print/config/paper-types.ts`
    (`PrintRequest.wholeSet`), `print/index.ts` (export `runPrintSet`).
  - **UI (Απόφαση #10) — υπάρχων διάλογος, κανένα νέο σύστημα** — **MOD** `PrintOutputControls.tsx`
    (checkbox «όλο το σετ φύλλων ({N})», 2Δ + ≥2 φύλλα), `usePrintDialogState.ts` (`wholeSet` state),
    `PrintDialog.tsx` (`sheetCount` prop), `app/PrintHost.tsx` (μαζεύει level scenes ίδιο μοτίβο με
    `ExportHost` → `buildSheetSet` → branch `runPrint`/`runPrintSet`).
  - **i18n (N.11)** — `print.sheetSet.{label,hint}` σε **EL + EN** (ICU plural `{count, plural, …}`,
    single-brace κατά CHECK 3.9). **Μόνο τα δικά μας κλειδιά** στο κοινό `dxf-viewer-shell.json` (τα
    κλειδιά πινακίδας Φάσεων Β–Ε επιβεβαιώθηκαν παρόντα — 18 `titleBlock*` EL/EN, δεν έλειπαν αυτή τη φορά).
  - **Tests** — **NEW** `sheet-set.test.ts` (auto-numbering: πρόθεμα ανά γλώσσα, 0→1-based· `buildSheetSet`:
    σειρά αρίθμησης, τίτλος entityLabel→name fallback, EN πρόθεμα, κενό σετ, per-sheet scene· overrides
    threading στο drawing scope) + **MOD** `print-service.test.ts` (`runPrintSet`: μία σελίδα ανά φύλλο,
    per-sheet capture, ΕΝΑ combined PDF/έξοδος, per-page sheetNumber/title στην πινακίδα, κενό σετ throw).
    Επηρεαζόμενα suites: **163/163 passing** (title-block + print). `jscpd:diff` καθαρό (9 αρχεία).
    **MOD** ADR-453 (multi-page assembler note).
  - **Εκτός φάσης (αμετάβλητα)**: AI batch-δημιουργία (Δ, §8 #4), native paperspace LAYOUT/VPORT records
    (DEFERRED, ADR-453), revision/issue table (Απόφαση #9), refactor του print/export ή levels. Το
    DXF-σετ καλύπτεται ήδη από το `all-zip` (ADR-505). **Commit/push: εκκρεμεί από Giorgio.**
- **2026-07-13 (Φάση Ε — Σφραγίδα-εικόνα + έλεγχος πληρότητας + νέο `ImageEntity`, ΥΛΟΠΟΙΗΣΗ)**:
  **κλείνει το κενό #6** (§4.2). Η πινακίδα γίνεται **καταθέσιμη**. Αρχιτεκτονική: **§5.4**. Build-on,
  πλήρες SSoT reuse:
  - **Σφραγίδα ζει στον μηχανικό** — **NEW** `services/upload/utils/storage-path-bim.ts:buildEngineerStampPath`
    (`companies/{companyId}/engineer-stamps/{userId}.{ext}`, company-scoped) + **MOD** `storage.rules`
    (mirror του material-thumbnail κανόνα, 2MB, `image/.*`). Το URL persist-άρεται στο
    `users/{userId}.stampImageUrl` (**self-update, ήδη επιτρεπτό** από τους `firestore.rules` — καμία
    αλλαγή κανόνα). **NEW** `text-engine/title-block/engineer-stamp.service.ts` — thin orchestrator
    (validate → Storage → user doc `setDoc merge` → in-session scope patch).
  - **Κοινός uploader (SSoT, Boy-Scout N.0.2/N.18)** — **NEW** `services/upload/image-asset-upload.ts`:
    ο πυρήνας «validate (τύπος+μέγεθος) → `uploadBytes` σε company-scoped path → `getDownloadURL`»
    **βγήκε** εκεί όταν απέκτησε 4ο καταναλωτή· **MOD** `bim-material-thumbnail-upload.service.ts`
    delegάρει σε αυτόν (μηδέν clone· τα υπάρχοντα material tests πράσινα).
  - **Ταξιδεύει στο ίδιο scope** — **MOD** `resolver/scope.types.ts` (`PlaceholderScopeUser.stampImageUrl`
    — **εικόνα, ΟΧΙ placeholder**: δεν μπαίνει ποτέ στο `PLACEHOLDER_REGISTRY`) + `scope-builder.ts`
    (`pickUser` το διαβάζει) + `placeholder-scope-client.ts` (`applyStampImageUrl` — in-session
    προβάδισμα, μοτίβο `registerUserMaterialImage`). Μηδέν δεύτερο data path (§5.1).
  - **Μπαίνει στο κελί ως `RasterPrimitive`** (ADR-622) — **MOD** `title-block-layout.ts`
    (`stampImage` → raster μέσα στο `stamp` rect, contain-fit, χωρίς επικάλυψη στον υπότιτλο) ⇒ PDF
    (`drawRaster`) + canvas τη ζωγραφίζουν **δωρεάν**. **NEW** `stamp-image-client.ts` — προ-φόρτωση
    (url για in-scene, data-URL για jsPDF) με `crossOrigin='anonymous'` (αλλιώς taint → σπάει το
    `toDataURL` της raster εκτύπωσης)· **MOD** `active-title-block.ts` (`loadTitleBlockAssets` —
    ΕΝΑΣ ιδιοκτήτης προ-φόρτωσης· μηδέν `await` στο render path, ADR-040) + **MOD** `PrintHost`/
    `print-service` (PDF παίρνει `'data-url'`).
  - **Νέο `ImageEntity` (Απόφαση Giorgio — native AutoCAD `IMAGE`/`IMAGEDEF`, όχι hatch-παράκαμψη)** —
    **NEW** `types/image.ts` + wiring στο `entities.ts`/`base-entity.ts`· **NEW**
    `rendering/entities/ImageRenderer.ts` (contain-fit + rotation, **reuse** `HatchImageCache` με νέο
    προαιρετικό `crossOrigin` — καμία αλλαγή στο υπάρχον hatch)· registration + όλα τα SSoT registries
    (renderable-type / render-contract / export-coverage / dxf-export-mapping / entity-bounds / hit-test /
    scale / rotate / move / canvas-v2 entity-model). **MOD** `detail-primitives-to-entities.ts` — το
    τρίτο backend απέκτησε καταναλωτή: `raster` → `ImageEntity` (contain-fit ΙΔΙΟΣ helper με το PDF).
  - **DXF export (reuse ADR-643 Φ5b)** — **NEW** `export/core/image-entity-export.ts` (async pre-pass:
    decode → `DxfImageExportMarker` με ΕΝΑ insert) + **NEW** `image-export-shared.ts` (κοινό decode/fetch,
    N.18)· **MOD** `dxf-ascii-image-writer.ts`/`dxf-ascii-writer.ts`/`export-service.ts` — το `IMAGE`/
    `IMAGEDEF` writer + zip bundle δέχονται και `image` entities (cross-type IMAGEDEF dedup ανά filename).
  - **Έλεγχος πληρότητας (rule-based, Απόφαση #4)** — **NEW** `title-block-compliance.ts`:
    `validateTitleBlock()` παράγει τα υποχρεωτικά πεδία από το `PLACEHOLDER_REGISTRY` (νέο flag
    `permitRequired` στα 8 ΤΕΕ πεδία — **MOD** `variables.ts`), με τρία διακριτά ευρήματα
    (empty-value / absent-field / no-stamp-image). **NEW** `PrintComplianceHint.tsx` στον **υπάρχοντα**
    διάλογο εκτύπωσης — **προειδοποίηση, όχι φράγμα**· τρέχει με την κλίμακα που ΟΝΤΩΣ τυπώνεται.
  - **UI ανεβάσματος** — **NEW** ribbon κουμπί «Σφραγίδα…» στο contextual «Πινακίδα Σχεδίου» tab (action
    `open-stamp-dialog` → EventBus `dxf:stamp-dialog-requested`) + **NEW** `StampHost` (mirror `ExportHost`)
    + `EngineerStampDialog` + `useEngineerStampUpload` (companyId/userId από `useCompanyId`/`useAuth`,
    μοτίβο `useHatchImageUploads`) + lucide `Stamp` icon.
  - **i18n (N.11)** — `titleBlockStamp.*`, `print.titleBlock.compliance.*`, `ribbon.{panels,commands}.titleBlockStamp*`
    σε **EL + EN**. **Αποκατάσταση (2η φορά)**: ο άλλος agent είχε ξαναγράψει τα κοινά `dxf-viewer-shell.json`
    και είχε (α) σβήσει τα κλειδιά Φάσης Β/Γ (`titleBlockEditor.*`, tabs/panels), (β) γυρίσει το
    `print.titleBlock` σε παλιά Φάση-Α μορφή (χαμένο `missingHint`, dead `scale/date/sheet`). Ξαναγράφτηκαν
    **χειρουργικά** (μόνο τα δικά μας κλειδιά).
  - **Tests** — `title-block-stamp.test.ts` (σφραγίδα σε 3 backends, contain-fit, ΟΘΟΝΗ===PDF, y-flip,
    annotative, έλεγχος πληρότητας: registry-derived, empty vs absent, no-stamp-image, ντετερμινισμός)
    + `image-entity.test.ts` (type guard/bounds/hit-test/scale/rotate/move) + image DXF export tests +
    ενημέρωση coverage golden sets. Επηρεαζόμενα suites Φάσης Ε: **πράσινα**. `jscpd:diff` καθαρό (12 αρχεία).
  - **Προϋπάρχουσες/ξένες αστοχίες (ΟΧΙ Φάση Ε)**: `systems-discipline-tabs` (διπλό MEP commandKey),
    `entity-render-coverage`/`bounds-twins`/`build-entity-model-coverage` (`floorplan-symbol`/`leader`
    partition — υπάρχουν στο HEAD, επαληθεύτηκε με git), `dxf-linetype-compound-roundtrip`/`dxf-attrib-attdef`.
  - **Εκτός φάσης (αμετάβλητα)**: AI (Δ — image→/NL→template, AI validation· εδώ μόνο rule-based),
    multi-sheet σετ + auto-numbering (Ζ), paperspace, revision/issue management (Απόφαση #9).
    **Commit/push: εκκρεμεί από Giorgio.**
- **2026-07-13 (Φάση ΣΤ — Εκτύπωση/Εξαγωγή: WYSIWYG, ΥΛΟΠΟΙΗΣΗ)**: **κλείνει το κενό #5** (§4.2). Ο
  χρήστης έβλεπε τέλεια πινακίδα στην οθόνη και **άλλη, φτωχή** στο PDF. Πλέον **οθόνη === PDF ===
  in-scene === DXF**, από ΕΝΑ layout model (αρχιτεκτονική: **§5.3**):
  - **Ο ζωγράφος έγινε κοινός (ADR-622)** — **NEW** `detail-sheet/render/detail-pdf-primitives.ts`:
    το `DetailPrimitive[] → jsPDF` **βγήκε** από το `detail-pdf-renderer.ts` (ήταν ιδιωτικό) και τώρα
    το καλούν **δύο** καταναλωτές: φύλλα λεπτομερειών **και** το print engine. Μηδέν νέος renderer —
    ο assembler απλώς **προωθεί** primitives (sheet-mm === page-mm ⇒ καμία μετατροπή).
  - **Το τυπωμένο φύλλο (SSoT)** — **NEW** `text-engine/title-block/print-sheet.ts`:
    `buildPrintSheet({paper, content, options})` → `{primitives, drawingAreaMm}` πάνω στο **ίδιο**
    `buildTitleBlockLayout` της Φάσης Γ (νέο ρητό `origin: 'sheet' | 'title-block'` — η σελίδα PDF
    **είναι** το φύλλο, ακόμη κι όταν δεν ζωγραφίζεται κορνίζα).
  - **Ωφέλιμη περιοχή (SSoT)** — **MOD** `sheet-frame.ts`: `usableAreaRects()` / `largestUsableRect()`
    (κορνίζα μείον πινακίδα — Γ-σχήμα). **MOD** `suggest-paper.ts`: το `fitsInFrame` τα καταναλώνει ⇒
    «χωράει» (πρόταση χαρτιού) **σημαίνει** «εκεί τυπώθηκε» (εκτύπωση). Το σχέδιο **δεν** τυπώνεται
    ποτέ κάτω από την πινακίδα (το legacy ζωγράφιζε αδιαφανές κουτί πάνω του).
  - **Πραγματικά δεδομένα στο PDF** — **MOD** `PrintHost.tsx`: προ-φόρτωση του **ίδιου**
    `loadPlaceholderScope(projectId)` με το άνοιγμα του διαλόγου ⇒ owner/θέση/εργοδότης/**Α.Μ. ΤΕΕ**
    στο τυπωμένο φύλλο, με **μηδέν `await`** στο μονοπάτι εκτύπωσης (event-time getter, ADR-040).
    **MOD** `print-service.ts`: `PrintDeps.titleBlock*` → **μόνο** `titleBlockLocale` (ό,τι άλλο το
    διαβάζει από τους SSoT της οθόνης)· η **κλίμακα** της πινακίδας = αυτή που ΟΝΤΩΣ τυπώνεται.
  - **Auto-prompt «λείπει πινακίδα» (Απόφαση #10β)** — **NEW** `hasTitleBlockEntity()` (όνομα block =
    ταυτότητα, ίδιο κριτήριο με το DXF export) → **MOD** `PrintDialog`/`PrintOutputControls`: υπόδειξη
    στον υπάρχοντα διάλογο (checkbox ήδη ON), **κανένα νέο UI σύστημα**.
  - **Dead code (CHECK 3.22)** — **DELETED** `print/assemble/title-block-renderer.ts` (legacy
    `drawTitleBlock`, ~85mm κουτί) + `title-block-types.ts`. Η δεύτερη μηχανή πινακίδας **έπαψε να
    υπάρχει**, δεν «παρακάμφθηκε».
  - **Boy-Scout (N.0.2 / N.18)** — **MOD** `paper-math.ts`: `computeRasterPxForArea()` (το raster
    sizing δέχεται **ορθογώνιο**, όχι περιθώριο· το `computePaperRasterPx` έγινε thin wrapper) +
    `resolveAppliedScaleDenominator()` / `formatScaleText()` — ο κανόνας «ποια κλίμακα τυπώνεται» ζούσε
    **τρεις** φορές (2 capture adapters + print-service)· τώρα μία (**MOD** `capture-2d.ts`,
    `capture-2d-vector.ts`). **MOD** `title-block-rows.ts`: `resolveTitleBlockContent()` (η αλυσίδα
    `resolveTemplate → readTitleBlockContent` ζούσε σε in-scene **και** print). **FIX** (λανθάνον, Φάση
    Γ): `Record<TextTemplateLocale, …>` απαιτούσε και κλειδί `'multi'` ⇒ νέος στενός τύπος
    `TitleBlockLocale` + SSoT `toTitleBlockLocale()` (το i18n→locale mapping ζούσε στο `useTitleBlockTool`).
  - **i18n (N.11)** — `print.titleBlock.missingHint` + ανανεωμένο `print.titleBlock.label` (EL+EN)· τα
    νεκρά `print.titleBlock.{scale,date,sheet}` **αφαιρέθηκαν** μαζί με τον legacy renderer.
  - **Παλινδρόμηση Φάσης Β/Γ που αποκαταστάθηκε** (εντολή Giorgio): άλλος agent είχε ξαναγράψει τα
    **κοινά** αρχεία και είχε σβήσει το ribbon wiring + **όλα** τα i18n κλειδιά της πινακίδας
    (`tools.titleBlock.*`, `ribbon.commands.titleBlock*`, `titleBlockEditor.*`, trigger `title-block`,
    καταχώρηση contextual tab, `useRibbonTitleBlockBridge`). Ξαναγράφτηκαν **χειρουργικά** (καμία
    γραμμή του άλλου agent δεν πειράχτηκε).
  - **Tests** — 12 νέα (`print-sheet.test.ts`: ταύτιση με το layout της οθόνης, ωφέλιμη περιοχή ανά
    χαρτί/προσανατολισμό, μηδενική επικάλυψη με την πινακίδα, κελί σφραγίδας, ντετερμινισμός·
    `title-block-dxf-export.test.ts`: BLOCK+INSERT, λυμένα στοιχεία έργου στο DXF, ανίχνευση «λείπει
    πινακίδα») + ξαναγράφτηκαν `pdf-assembler.test.ts` / `print-service.test.ts` (συμβόλαιο: primitives
    πάνω από το σχέδιο, λεζάντα μόνο χωρίς πινακίδα, κλίμακα εκτύπωσης στην πινακίδα). Επηρεαζόμενα
    suites: **94/94 passing (1059 tests)**. `jscpd:diff` καθαρό (16 αρχεία).
  - **Εκτός φάσης (αμετάβλητα)**: AI (Δ), σφραγίδα-ως-**εικόνα** + validation ελλείψεων (Ε),
    multi-sheet σετ + auto-numbering (Ζ), paperspace layouts, γενικό refactor του print engine.
    **Commit/push: εκκρεμεί από Giorgio.**
- **2026-07-13 (Φάση Γ — Κορνίζα ISO 5457 + parametric reflow + βιβλιοθήκη presets, ΥΛΟΠΟΙΗΣΗ)**:
  **κλείνει το κενό #2** (§4.2). Η πινακίδα παύει να είναι «κουτί σταθερού πλάτους 180mm» και γίνεται
  **πραγματικό φύλλο σχεδίου**. Καμία νέα μηχανή διάταξης (βλ. **§5.2** — αρχιτεκτονική απόφαση):
  - **Μοντέλο φύλλου (SSoT)** — **NEW** `text-engine/title-block/sheet-frame.ts`: `ISO_5457`
    (τα μόνα «μαγικά» νούμερα του προτύπου, σε ΕΝΑ σημείο) + `computeSheetFrameMetrics()` →
    ορθογώνια φύλλου / κορνίζας / πινακίδας / σφραγίδας / πεδίων + `buildSheetFramePrimitives()`.
    Διαστάσεις χαρτιού από το **paper SSoT** (`resolvePaperDimensionsMm`, ADR-453· μηδέν
    ξαναγραμμένα μεγέθη), γεωμετρία ως **`DetailPrimitive[]`** (ADR-622· τα 3 backends τη
    ζωγραφίζουν δωρεάν). Καθαρή συνάρτηση ⇒ **ghost === commit** (N.7.2).
  - **Parametric reflow (Απόφαση #2)** — **MOD** `title-block-layout.ts`: το `TITLE_BLOCK_WIDTH_MM =
    180` **έφυγε**· πλάτος = `min(180, πλάτος κορνίζας)`, ύψος = `fieldBlockHeightMm(rows)` (ADR-622)
    με τα ελάχιστα του προτύπου, θέση = κάτω-δεξιά **υπολογισμένη**. Δύο modes: **πλήρες φύλλο** (ISO
    5457 κορνίζα, default — πρακτική Vectorworks) ή **μόνο η πινακίδα** (η συμπεριφορά της Φάσης Β).
  - **Έξυπνη πρόταση χαρτιού (Απόφαση #2 / §8 #9)** — **NEW** `suggest-paper.ts`:
    `bbox σχεδίου ÷ συντελεστή κλίμακας` → το **μικρότερο** φύλλο του οποίου η **ωφέλιμη περιοχή**
    (κορνίζα μείον πινακίδα — σχήμα Γ, ώστε το σχέδιο να μην κρύβεται κάτω από την πινακίδα) χωράει
    το σχέδιο· ο προσανατολισμός ακολουθεί την αναλογία. **Πρόταση, όχι κλείδωμα**: εφαρμόζεται στο
    όπλισμα του εργαλείου και **σταματά μόνιμα** μόλις ο χρήστης διαλέξει ο ίδιος χαρτί.
  - **Βιβλιοθήκη presets (Απόφαση #3, EL+EN Απόφαση #8)** — **NEW** `title-block-presets.ts` (registry:
    id → πρότυπο ανά γλώσσα + κελί σφραγίδας) · **MOD** `templates/defaults/title-blocks.ts`: +3 built-in
    πρότυπα × 2 γλώσσες — **«Άδεια δόμησης»** (ΤΕΕ πεδία: μελετητής/ειδικότητα/**Α.Μ. ΤΕΕ**/εργοδότης/
    θέση + **κενό κελί σφραγίδας**, Απόφαση #6γ), **«Απλή»**, **«Λεπτομέρεια»**. Το υπάρχον built-in
    μένει ως **«Τυπική»** (default — καμία αλλαγή συμπεριφοράς για ό,τι το χρησιμοποιεί ήδη).
  - **UI (Απόφαση #10)** — **NEW** contextual tab «Πινακίδα Σχεδίου» (`contextual-title-block-tab.ts`,
    trigger `title-block-tool-active`) + `useRibbonTitleBlockBridge` + command keys + tool bridge store.
    Οι επιλογές preset/χαρτιού **παράγονται από τα registries** (`TITLE_BLOCK_PRESETS` /
    `PAPER_SIZE_ORDER`) — καμία χειρόγραφη λίστα που θα ξέφευγε. **NEW** `state/title-block-options-store.ts`
    = ο ΕΝΑΣ ιδιοκτήτης του «τι θα μπει στο επόμενο κλικ» (event-time read, ADR-040· μοτίβο
    `scale-bar-options-store`). Τα numeric (γωνία/κλίμακα) γράφονται στο handle του εργαλείου μέσω των
    **υπαρχόντων** `readToolOverrideNumber`/`writeToolOverrideNumber` (N.18 — μηδέν clone).
  - **Boy-Scout (N.0.2)** — **MOD** `systems/zoom/utils/bounds.ts`: νέο `createBoundsFromEntities()`·
    το `{entities, layers: [], bounds: null} as DxfScene` σκαρί ζούσε δύο φορές (DXF export extents +
    η νέα πρόταση χαρτιού) — τώρα μία (**MOD** `export/formats/dxf-export-adapter.ts` το καταναλώνει).
  - **i18n (N.11)** — `ribbon.tabs.titleBlockPlacement`, `ribbon.panels.titleBlock{Template,Sheet,Transform}`,
    `ribbon.commands.titleBlockEditor.*` (preset/presetOptions/paperSize/orientation/orientationOptions/
    frameMode/frameModeOptions/rotation/scale) σε **EL + EN**. Καμία hardcoded UI string· τα κείμενα
    **μέσα** στην πινακίδα (π.χ. «ΣΦΡΑΓΙΔΑ / ΥΠΟΓΡΑΦΗ») είναι **περιεχόμενο σχεδίου** και ακολουθούν τη
    γλώσσα ΤΟΥ ΠΡΟΤΥΠΟΥ, όχι του UI — γι' αυτό ζουν δίπλα στα templates.
  - **Tests** — 21 νέα (`sheet-frame.test.ts`: paper SSoT, περιθώρια ISO ανά μέγεθος/προσανατολισμό,
    anchoring κάτω-δεξιά, A4-όρθιο πλήρες πλάτος, ύψος ∝ γραμμές, κελί σφραγίδας χωρίς επικάλυψη,
    ντετερμινισμός· `title-block-presets.test.ts`: registry EL/EN + i18n κλειδιά, ΤΕΕ placeholders,
    πρόταση χαρτιού (12×8m@1:50 ⇒ A3 landscape, λεπτομέρεια ⇒ A4, ψηλό-στενό ⇒ portrait, τεράστιο ⇒ A0,
    άκυρη κλίμακα), store «πρόταση χωρίς κλείδωμα», ribbon trigger/labels/options). Επηρεαζόμενα suites:
    **119 → 1272/1273 passing** (η μία αστοχία, `systems-discipline-tabs`, είναι **ξένη**: διπλό MEP
    commandKey `bathroom-auto-arrange`). `jscpd:diff` καθαρό (14 αρχεία).
  - **Εκτός φάσης (αμετάβλητα)**: AI (Δ), σφραγίδα-ως-**εικόνα** + validation ελλείψεων (Ε), multi-sheet
    (Ζ), export σετ (ΣΤ), paperspace. Το `PrintHost`/`drawTitleBlock` **δεν** καταναλώνει ακόμη ούτε το
    scope route ούτε το νέο μοντέλο φύλλου (§4.2 #5 — Φάση ΣΤ). **Commit/push: εκκρεμεί από Giorgio.**
- **2026-07-13 (Φάση Β — «Insert title block into scene», ΥΛΟΠΟΙΗΣΗ)**: **κλείνει το κενό #1** (§4.2) — ο
  resolver δεν ζει πια μόνο στο preview: η πινακίδα μπαίνει ως **πραγματικό αντικείμενο** στο σχέδιο.
  Build-on, κανένα παράλληλο σύστημα:
  - **Scope → client (κρίσιμη απόφαση, §5.1)** — **NEW** `app/api/dxf/text-templates/placeholder-scope/route.ts`
    (POST, `withAuth` + rate limit, `dxf:files:view`· companyId από claims) καλεί τον **υπάρχοντα**
    `buildPlaceholderScope()`. **NEW** `resolver/placeholder-scope-client.ts` — module singleton cache
    (idempotent per-project fetch, in-flight dedupe, **event-time getter**, αποτυχία ⇒ κενό scope χωρίς throw).
    **MOD** `resolver/scope.types.ts` — `PlaceholderScopeSources` (wire contract = company/project/user).
  - **Πινακίδα = block** — **NEW** `text-engine/title-block/`: `title-block-rows.ts` (λυμένο AST →
    `heading` + `FieldRow[]`), `title-block-layout.ts` (→ `DetailPrimitive[]` σε sheet-mm: περίγραμμα +
    ζώνη κεφαλίδας + `buildFieldBlock` **του ADR-622**, μηδέν νέα μηχανή διάταξης), `title-block-def.ts`
    (→ `InSessionBlockDef`), `active-title-block.ts` (ποιο preset/ποια δεδομένα/ποια κλίμακα, event-time).
  - **Τρίτο backend (ADR-622)** — **NEW** `detail-sheet/render/detail-primitives-to-entities.ts`: sheet
    primitives → scene entities (y-flip + annotative `scaleFactor`) ⇒ **preview === PDF === in-scene** από
    ΕΝΑ layout model. **MOD** `detail-sheet-field-block.ts` (εκτέθηκαν `FIELD_BLOCK_METRICS` +
    `fieldBlockHeightMm` — καμία αλλαγή διάταξης, μηδέν διπλοί μαγικοί αριθμοί).
  - **Annotative μέγεθος** — **MOD** `systems/viewport/ViewportStore.ts`: derived `getActiveScaleFactor()`
    (`modelHeight/paperHeight`, fallback 1) ⇒ η πινακίδα έχει σωστό **τυπωμένο** μέγεθος πάνω σε σχέδιο
    κτιρίου (1:50 ⇒ ×50), όπως τα AutoCAD annotative αντικείμενα.
  - **Εργαλείο + UX** — **NEW** `hooks/drawing/useTitleBlockTool.ts` πάνω στο **υπάρχον**
    `createSingleClickPlacementTool` (ADR-600)· commit μέσω `buildBlockEntityFromDef` + `addBlockToScene`
    (ADR-652 — undoable append + broadcast + persist). **MOD** ToolType `'title-block'` (`ui/toolbar/types.ts`)
    + `TOOL_DEFINITIONS` (exhaustive registry) + click dispatch (`canvas-click-*`: `TitleBlockToolLike` =
    **alias** του `BlockLibraryToolLike`) + `useSpecialTools*` + `CanvasSection` (pass-through· βλ. ADR-040
    changelog, CHECK 6B) + ribbon «Πινακίδα» (`insert-tab.ts`, `RibbonButtonIcon`).
  - **i18n (N.11)** — `tools.titleBlock.{statusPosition,errorNoTemplate}` + `ribbon.panels.titleBlock` +
    `ribbon.commands.titleBlock{,Tooltip}` σε **EL + EN** (καμία hardcoded string).
  - **Tests** — 12 νέα (title-block def/layout/rows/wiring: resolve, y-flip, annotative γραμμικότητα, κενό
    scope, μοναδικά ids, ToolType/ribbon/i18n coverage) + 6 (scope client: idempotency, in-flight dedupe,
    per-project cache, graceful degradation). Επηρεαζόμενα suites: **274/274 passing**. `jscpd:diff` καθαρό.
  - **Εκτός φάσης (αμετάβλητα)**: πλήρης κορνίζα ISO 5457 + parametric reflow (Γ), presets library (Γ), AI
    (Δ), σφραγίδα-εικόνα/validation (Ε), multi-sheet (Ζ), export σετ (ΣΤ), paperspace. Το built-in
    `defaults/title-blocks.ts` **δεν** πειράχθηκε. Print (`PrintHost`) **δεν** καταναλώνει ακόμη το νέο
    scope route (§4.2 #5). **Commit/push: εκκρεμεί από Giorgio.**
- **2026-07-13 (Φάση Α — Data wiring, ΥΛΟΠΟΙΗΣΗ)**: Πρώτη γραμμή κώδικα του ADR-651. Build-on-ADR-344
  (κανένα παράλληλο σύστημα). **Κλείνει το κενό #4** (§4.2) και **μερικώς το #5**:
  - **Resolver SSoT chain** — νέα placeholders `project.location` (ΘΕΣΗ ΕΡΓΟΥ) + `project.client`
    (ΕΡΓΟΔΟΤΗΣ, διακριτό από το `owner`=κύριος έργου) σε: `resolver/variables.ts`
    (`PlaceholderPath` + `PLACEHOLDER_REGISTRY`, 17→19 paths), `resolver/scope.types.ts`
    (`PlaceholderScopeProject.location/client`), `resolver/resolver.ts` (`readProject`),
    `resolver/scope-builder.ts` (`pickProject` διαβάζει `data.location`/`data.client` + guard).
  - **i18n (N.11)** — labels EL `Θέση Έργου`/`Εργοδότης` & EN `Location`/`Client` στα
    `locales/{el,en}/textTemplates.json` (κλειδιά· καμία hardcoded string).
  - **Print wiring** — `app/PrintHost.tsx`: το PDF title block παίρνει το πραγματικό όνομα του ενεργού
    Project (`selectedProject.name`, fallback `level.name`). Πλήρες owner/location/client → PDF
    μεταφέρθηκε (βλ. §4.2 #5: client hierarchy projection δεν φέρει τα πεδία).
  - **Tests** — `variables.test.ts` (count 17→19 + focused), `resolver.test.ts` (location/client
    substitution), `scope-builder.test.ts` (hydration). 72/72 passing. jscpd:diff καθαρό (χωρίς clones).
  - Εκτός φάσης (αμετάβλητα): in-scene insert (Β), ISO 5457 κορνίζα (Γ), AI (Δ), σφραγίδα-εικόνα (Ε),
    multi-sheet (Ζ), export (ΣΤ). Built-in `defaults/title-blocks.ts` δεν πειράχθηκε (preset/content =
    Φάση Γ). **Commit/push: εκκρεμεί από Giorgio.**
- **2026-07-13** — Δημιουργία ADR (Round 1). Βαθιά έρευνα με 3 παράλληλους πράκτορες (Revit+AutoCAD /
  ArchiCAD+Vectorworks+cloud/AI+πρότυπα / SSoT audit κώδικα). Τεκμηρίωση ευρημάτων, εντοπισμός κενού
  αγοράς (cloud/AI εργαλεία χωρίς σύστημα πινακίδων), SSoT audit (~80% υποδομής μέσω ADR-344),
  προτεινόμενη αρχιτεκτονική (build-on-ADR-344), 6-φασικό roadmap, must-have features, AI-magic
  differentiators. **Απόφαση Giorgio:** ναυαρχίδα = και τα 3 AI χαρακτηριστικά· τώρα ΜΟΝΟ ADR (καμία
  υλοποίηση). Επόμενο βήμα: ανάγνωση από Giorgio → απόφαση ποια φάση υλοποιείται πρώτη.
- **2026-07-13 (Round 1b — Q&A διευκρινίσεις)**: 10 διευκρινιστικές ερωτήσεις προς Giorgio (μία-μία,
  απλή γλώσσα) → §11 Αποφάσεις. Κύριες συνέπειες: (1) πινακίδα ΚΑΙ σε χαρτί εκτύπωσης ΚΑΙ in-scene·
  (2) ελεύθερο μέγεθος + έξυπνη πρόταση → parametric reflow core· (3) βιβλιοθήκη presets (Άδεια/Απλή/
  Λεπτομέρεια) + επεξεργάσιμα· (4) zero-config auto-fill + προειδοποίηση ελλείψεων → validation core·
  (5) AI εικόνα→πινακίδα «ίδια διάταξη αλλά καθαρή» (vector, όχι raster)· (6) σφραγίδα = εικόνα+κείμενο+
  κενό → κλείνει gap #6· (7) **multi-sheet ΞΕΠΑΓΩΝΕΙ** (νέα Φάση Ζ, σετ+auto-numbering)· (8) ελληνικά
  + κουμπί→αγγλικά· (9) αυτόματο revision ιστορικό + AI πρόταση αλλαγής → core· (10) UX = ribbon
  κουμπί + auto-prompt στην εκτύπωση. **Καθαρή διεύρυνση scope**: validation/multi-sheet/auto-revision
  ανέβηκαν από «μελλοντικά» σε core.
