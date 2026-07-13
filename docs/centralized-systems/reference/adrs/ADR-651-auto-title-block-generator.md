# ADR-651 — Σύστημα Αυτόματης Δημιουργίας Πινακίδων Σχεδίου (Auto Title Block Generator) — Έρευνα Αγοράς + Αρχιτεκτονικό Blueprint

- **Status**: 🔵 PROPOSED (research / documentation — καμία υλοποίηση σε αυτό το βήμα)
- **Date**: 2026-07-13
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

1. **#1 missing link — καμία εντολή «εισαγωγή πινακίδας στη σκηνή».** Ο resolver τρέχει **μόνο**
   στο preview του management UI (`ui/text-templates/preview/TextTemplatePreview.tsx`)· κανείς δεν
   βάζει το resolved template ως πραγματικό entity/BLOCK στο ενεργό σχέδιο. Ο ίδιος ο κώδικας το
   ομολογεί: *«the insertion command (later)»*.
2. **Καμία γραφική περιμετρική κορνίζα-φύλλου ISO 5457** — υπάρχει μόνο μικρό box κάτω-δεξιά στο
   PDF (`drawTitleBlock`, 85mm), όχι πλήρης πολυκελιακή πινακίδα σε όλη τη σελίδα.
3. **Multi-sheet / layout / paperspace** — ρητά DEFERRED (ADR-453)· ο DXF writer έχει μόνο το
   υποχρεωτικό `*Paper_Space` stub, όχι πραγματικά layouts/VPORTs.
4. ~~**`PLACEHOLDER_REGISTRY` λείπει `project.location` / `project.client`**~~ — **✅ RESOLVED (Φάση Α,
   2026-07-13)**: προστέθηκαν `project.location` (ΘΕΣΗ ΕΡΓΟΥ) + `project.client` (ΕΡΓΟΔΟΤΗΣ) σε όλη
   την αλυσίδα του resolver (ADR-344 SSoT): `PlaceholderPath` union + `PLACEHOLDER_REGISTRY`
   (`variables.ts`), `PlaceholderScopeProject` (`scope.types.ts`), `readProject` (`resolver.ts`),
   `pickProject` (`scope-builder.ts` — διαβάζει `data.location`/`data.client` από το `Project` doc),
   + i18n labels EL (`Θέση Έργου`/`Εργοδότης`) & EN (`Location`/`Client`). Registry: 17 → **19 paths**.
   Coverage: resolver + scope-builder + variables tests (72 passing).
5. **Print engine δεν διαβάζει το πλήρες Firestore `Project`** — **⚠️ PARTIAL (Φάση Α, 2026-07-13)**:
   το `PrintHost.tsx` πλέον περνά στην πινακίδα το **πραγματικό όνομα του ενεργού Project**
   (`useProjectHierarchyOptional().selectedProject?.name`) αντί για σκέτο `level.name` (safe fallback
   όταν δεν υπάρχει επιλεγμένο έργο / εκτός provider, ADR-371). **Το `owner`/`location`/`client` ΔΕΝ
   φτάνουν ακόμη στο PDF title block**: το client-side `ProjectHierarchyContext.Project` είναι
   περιορισμένο projection (`{ id, name, company, buildings, parkingSpots }`, βλ.
   `contexts/project-hierarchy-types.ts`) — δεν φέρει αυτά τα πεδία. Πλήρες wiring απαιτεί είτε
   επέκταση του projects API + hierarchy projection, είτε server round-trip μέσω `buildPlaceholderScope`
   (server-only, admin SDK) — **μεγαλύτερο από «data wiring», μεταφέρεται σε δική του υπο-φάση** (δένει
   με τη Φάση Β in-scene insert, όπου ο resolver τρέχει με πλήρες scope). Ο resolver-path (κενό #4)
   είναι **έτοιμος** να τα σερβίρει μόλις φτάσει το scope.
6. **Καμία σφραγίδα-ως-εικόνα** (upload PNG σφραγίδας/λογότυπου) — μόνο κειμενική.
7. **Κανένα AI generation** (image→template, NL→template, validation).

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

---

## 6. Roadmap (6 Φάσεις — υλοποίηση αργότερα, 1 φάση/session)

- **Φάση Α — Data wiring** *(μικρό, ασφαλές θεμέλιο)* — **✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-13** (βλ. changelog):
  προσθήκη `project.location` + `project.client` στο `PLACEHOLDER_REGISTRY`· `scope-builder` διαβάζει
  τα πεδία· σύνδεση Print με πραγματικό `Project` name (αντί `level.name`)· i18n keys (ΘΕΣΗ/ΕΡΓΟΔΟΤΗΣ).
  ⚠️ owner/location/client → PDF εκκρεμεί (§4.2 #5, client projection gap).
- **Φάση Β — «Insert title block into scene» command** *(#1 gap)*: resolve template → πραγματικά
  DXF entities (MTEXT + frame lines) ως placed group/BLOCK στο ενεργό σχέδιο. Reuse `buildFieldBlock`,
  entity factories, `completeEntity` pipeline, BLOCK/INSERT writer.
- **Φάση Γ — Γραφική κορνίζα ISO 5457**: πλήρες περιμετρικό frame + πολυκελιακή πινακίδα κάτω-δεξιά,
  **παραμετρική ανά μέγεθος χαρτιού** (A4↔A0 reflow)· νέο ribbon tool «Πινακίδα».
- **Φάση Δ — AI ναυαρχίδα (3 δυνατότητες, όραμα Giorgio)**:
  - **Εικόνα→Πινακίδα**: upload screenshot/φωτό υπάρχουσας πινακίδας → **vision LLM** (υπάρχει ήδη
    AI pipeline, `gpt-4o-mini` vision, βλ. accounting) αναδημιουργεί editable `TextTemplate` + layout.
    *Κανένας ανταγωνιστής δεν το κάνει.*
  - **Φυσική-γλώσσα→Πινακίδα**: «φτιάξε πινακίδα A2 άδειας δόμησης» → LLM παράγει ΤΕΕ-συμβατό template.
  - **Zero-config auto-fill**: αυτόματο γέμισμα από πραγματικό Project/Company/User.
- **Φάση Ε — Ελληνική συμμόρφωση + σφραγίδα-εικόνα + revisions/issues**: έτοιμο **ΤΕΕ/ISO-7200
  preset**· upload PNG σφραγίδας/λογότυπου· revision/issue table management· **AI validation** (λείπει
  υποχρεωτικό πεδίο πριν το export για κατάθεση;).
- **Φάση ΣΤ — Export**: πινακίδα ως DXF BLOCK / PDF (reuse ADR-608 vector-PDF + ADR-636/644/648 DXF).

---

## 7. Must-have features (από τους ηγέτες — τι πρέπει να έχει το σύστημά μας)

1. **Master/parent-child template + real-time inheritance** — αλλαγή στο master → όλα τα φύλλα (ArchiCAD).
2. **Two-way data binding με project metadata** — live references, όχι static κείμενο (Autotext/fields).
3. **Batch/mass editing πολλών φύλλων ταυτόχρονα** (Vectorworks).
4. **Auto revision/issue worksheets** από τα ίδια δεδομένα, χωρίς διπλή καταχώρηση (Vectorworks).
5. **Reusable template libraries μεταξύ έργων** (project templates / πρότυπα γραφείου).
6. **Consistency/error-proofing** — αδύνατη ασυμφωνία μεταξύ φύλλων (μία πηγή αλήθειας).
7. **Multi paper-size** (A4→A0) με parametric reflow (ISO 5457).

---

## 8. AI-magic Differentiators (γιατί ξεπερνάμε τους ηγέτες)

**Ναυαρχίδα (Φάση Δ, εγκεκριμένο όραμα):**
1. **Εικόνα → Πινακίδα** — φωτογραφίζεις/ανεβάζεις οποιαδήποτε υπάρχουσα πινακίδα, το AI την
   αναδημιουργεί ως editable template. **Μοναδικό στην αγορά.**
2. **Φυσική γλώσσα → Πινακίδα** — «πινακίδα A2 άδειας δόμησης» → πλήρης ΤΕΕ-συμβατή πινακίδα.
3. **Zero-config auto-fill** — μηδέν πληκτρολόγηση· έναντι πολύπλοκου shared-params του Revit.

**Μελλοντικές (καταγραφή για roadmap, όχι δέσμευση):**
4. **Auto batch-δημιουργία σετ φύλλων από πρόθεση** — «σετ αδείας: κατόψεις όλων ορόφων + 2 τομές +
   4 όψεις» → auto sheets με σωστή αρίθμηση/τίτλους (κατεύθυνση Revit 2027).
5. **AI compliance validation** — έλεγχος υποχρεωτικών πεδίων (ΑΜ ΤΕΕ/κλίμακα/σφραγίδα) πριν το
   export για e-Άδειες.
6. **Auto-changelog revision** — diff μοντέλου vs προηγούμενη έκδοση → auto περιγραφή αλλαγής.
7. **Auto-localization EL↔EN** πινακίδας με ένα κλικ (όρους/μονάδες/format ημερομηνίας).
8. **QR/version fingerprint** που συνδέει το τυπωμένο σχέδιο με το ζωντανό cloud μοντέλο.
9. **Έξυπνη πρόταση κλίμακας/χαρτιού** βάσει bbox αντικειμένου + κανόνων ISO 5457.

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

9. **Αναθεωρήσεις → ΑΥΤΟΜΑΤΟ ΙΣΤΟΡΙΚΟ + AI ΠΡΟΤΑΣΗ ΑΛΛΑΓΗΣ** *(2026-07-13)*: Το σύστημα κρατά
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
