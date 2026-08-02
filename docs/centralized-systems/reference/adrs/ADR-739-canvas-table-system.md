# ADR-739 — Σύστημα Πινάκων (Tables) στον 2Δ/3Δ Καμβά — Έρευνα Αγοράς + Αρχιτεκτονικό Blueprint

- **Status**: ✅ **ΥΠΟ ΥΛΟΠΟΙΗΣΗ — Φ.Α/Β/Γ ΚΛΕΙΣΤΕΣ, Φ.Δ ΒΗΜΑΤΑ 1-9 ΚΛΕΙΣΤΑ** (2026-08-02).
  **Φ.Δ βήμα 9 ✅** **εισαγωγή/διαγραφή γραμμών & στηλών από τις ζώνες δείκτη** (§27): δεξί
  κλικ σε γράμμα στήλης / αριθμό γραμμής ⇒ μενού με **ρητή κατεύθυνση**· αριστερό κλικ ⇒
  επιλογή **ολόκληρης** της στήλης/γραμμής. Οι ζώνες του βήματος 7 έπαψαν να είναι
  διακοσμητικές — η γεωμετρία τους έγινε **SSoT** που μοιράζονται ζωγράφος και hit-test, με
  το **ίδιο** κατώφλι LOD (αλλιώς πατάς κουτί που δεν ζωγραφίστηκε). **ΕΝΑ** undo ανά πράξη,
  στην ίδια διαδρομή commit. ✅ **ΕΠΑΛΗΘΕΥΜΕΝΟ ΖΩΝΤΑΝΑ** (§27.10) — 5/6 σημεία πέρασαν με
  δεδομένα/screenshot· το έκτο βρήκε **πραγματικό σφάλμα**: το μενού δεν είχε slot στον
  escape-bus, οπότε το πρώτο `Escape` το άρπαζε η **αποεπιλογή του καμβά** ⇒ ο πίνακας
  αποεπιλεγόταν, **οι ζώνες εξαφανίζονταν** ενώ η συνεδρία φαινόταν ζωντανή, και το μενού δεν
  έκλεινε. Διορθώθηκε με **μία** εγγραφή σε `POPOVER_DROPDOWN`. Εκκρεμεί μόνο ο **στραμμένος**
  πίνακας.
  **Φ.Δ βήμα 8 ✅** **επιλογή περιοχής + αντιγραφή/επικόλληση** (§26): `Shift+βέλος/κλικ`,
  `Ctrl+A`, και **TSV** προς/από Excel μέσω των **φυσικών** συμβάντων προχείρου (δουλεύει σε
  ελληνική διάταξη, χωρίς άδειες, και με δεξί κλικ). Η επικόλληση είναι **ΕΝΑ** undo **χωρίς
  καμία νέα μηχανική** — η ατομικότητα βγήκε από την καθαρότητα του `setPersistedCellText`.
  ✅ **Επαληθευμένο ζωντανά** (§26.13, 2026-08-02, μέσω **CDP** — η επέκταση Chrome ποτέ δεν
  συνδέθηκε): πραγματικό πρόχειρο Windows (TSV με TAB+CRLF, αμφίδρομα), πληθυντικοί ICU, **ΕΝΑ**
  undo, μέγεθος υπό συγχώνευση, κείμενο που **γέρνει** με τον πίνακα. Το ένα εύρημα εκείνης της
  συνεδρίας — «**οποιοδήποτε κλικ στον καμβά κλείνει τη συνεδρία**» ⇒ «απλό κλικ μετακινεί
  κελί» και «`Shift+κλικ` = δεύτερη γωνία» νεκρά — **✅ ΛΥΘΗΚΕ** (§26.15), και η ρίζα ήταν
  **δύο** πράγματα, όχι ένα: (α) το ίδιο το **κέλυφος** του επεξεργαστή σκέπαζε το ενεργό κελί
  (`mousedown` → `DIV`, όχι `CANVAS` — απουσία, όχι κούρσα· γι' αυτό 11/11), και (β) ένα κλικ
  παράγει **δύο** `focusout`, όχι ένα. Η λύση αλλάζει την **ερώτηση** του φύλακα, όχι τον
  χρονισμό: «μήπως αυτό το blur το προκάλεσε δικό μου κλικ;» — δήλωση από τον pointer, ανάκτηση
  από τον **έναν** δρόμο (`restartTableCellCursorSession`). Μαζί έπεσε και μια σιωπηλή **απώλεια
  πληκτρολόγησης** (§26.15.3). ✅ **Επαληθευμένο ζωντανά, 3 τρεξίματα × 6 βήματα, ταυτόσημα.**
  **Φ.Δ βήμα 7 ✅** **γραμμή τύπων (fx) + αναφορά κελιού + δείκτης πίνακα** (§25): γράμματα
  στηλών και αριθμοί γραμμών **γύρω από τον πίνακα** (AutoCAD `TABLEINDICATOR`) και από πάνω
  τους η γραμμή τύπων του Excel — **και τα δύο, που κανένα από τα δύο εργαλεία δεν έχει μαζί**.
  Ονομασία `A1` **+ κείμενο κεφαλίδας** (`B3 · Περιγραφή`)· εύρος σε συγχωνευμένο. **Γράφεται**,
  με **ένα** πρόχειρο σε δύο πεδία και **μία** διαδρομή commit. 🔴 Ο πίνακας **δεν μετακινείται
  καθόλου** — οι ζώνες ζωγραφίζονται στον καμβά σε αρνητικές συντεταγμένες πλαισίου, μηδέν
  resize. Το `Enter`/`Tab` **επαληθεύτηκαν ζωντανά** (κλείνει ανεπαλήθευτο του βήματος 6).
  **Φ.Δ βήμα 3 ✅** in-cell editing (§21). **Φ.Δ βήμα 4 ✅** λειτουργία Excel — αποκοπή
  πληκτρολογίου (§22). **Φ.Δ βήμα 5 ✅** περικοπή κειμένου κελιού στα 4 backends (§23) —
  🔴 τα «τέσσερα backends» αποδείχθηκαν **ένα σημείο**: όλα διαβάζουν το `TableCellLayout.text`.
  **Φ.Δ βήμα 6 ✅** ο επεξεργαστής **επεκτείνεται πέρα από το κελί** (§24): μεγαλώνει με το κείμενο
  και αναδιπλώνει σε δεύτερη γραμμή (πλήρες Excel), με τη **στοίχιση ως άγκυρα** (Figma auto-width)
  και **ζώνη εκτύπωσης** που δείχνει **τι θα τυπωθεί** — κάτι που δεν δίνει κανένα από
  Excel/Sheets/AutoCAD. Απαίτησε `<input>` → `<textarea>`· η κατακόρυφη γεωμετρία του βήματος 3
  **επιβίωσε αλγεβρικά, με μηδέν αλλαγή νούμερου** (§24.6). **0,00 `measureText` ανά καρέ** (§24.7).
  ⚠️ Ανεπαλήθευτα ζωντανά, **και τα δύο χρειάζονται άδεια του Giorgio** (§25.12):
  **δεξιά/κεντρική στοίχιση + στραμμένος πίνακας** (η σκηνή δεν έχει τέτοιον πίνακα) και η
  **εξαγωγή σε αρχείο** (λήψη αρχείου).
  **Επόμενο: Φ.Δ βήμα 8** — επιλογή περιοχής (Shift+βέλος/κλικ, Ctrl+A) + αντιγραφή/επικόλληση.
  Ιστορικό status μέχρι 2026-07-31 παρακάτω: Οι 5 αποφάσεις του §14 ελήφθησαν από τον Giorgio. Κάθε φάση κλείνει αυτοτελώς με
  δικό της κύκλο (§14.1).
  **Φ.Α ✅** Μοντέλο + μηχανή διάταξης + `TableStyle` SSoT + χαρακτηρισμός ADR-622 (§16).
  **Φ.Β ✅** Απορρόφηση ADR-622 — **byte-identical, 10/10 snapshots**, με τη γενική μηχανή
  **ανέπαφη** (§17). **Φ.Γ ✅** Οντότητα σκηνής + απόδοση 2Δ + τα 9 gates του §12 (§18).
  **Φ.Δ βήμα 1 ✅** Σειριοποίηση (Λύση Α — ο πίνακας **επιβιώνει reload/undo/πρόχειρο**) +
  εργαλείο ενός κλικ + WYSIWYG φάντασμα + κουμπί κορδέλας (§19).
  **Φ.Δ βήμα 2 — inline επεξεργαστής κελιού ✅** (διπλό κλικ σε κελί → `<input>` πάνω στον
  καμβά → commit `UpdateEntityCommand`, §19.9). **Ανοιχτά ακόμα μέσα στο βήμα 2**: πλοήγηση
  πληκτρολογίου (Tab/Enter/βέλη μεταξύ κελιών), επικόλληση TSV/CSV, λαβή ύψους γραμμής.
  ✅ **BROWSER VERIFY ΕΓΙΝΕ** (2026-07-31, §19.10): ο πίνακας φαίνεται, γράφεται και
  **επιβιώνει reload με το περιεχόμενο των κελιών** — αποδεδειγμένο με νέα εγγραφή, όχι με
  συμπέρασμα. Βρέθηκε **ένα** πραγματικό σφάλμα (η κεφαλίδα έχανε τα γράμματά της στο hover)
  και **διορθώθηκε** (§19.10.β). **Ανοιχτό**: καμία ένδειξη **επιλογής** (μόνο hover).
- **Date**: 2026-07-31
- **Category**: DXF Viewer / Annotation / Documentation / Data Binding / Research
- **Σχετικά**:
  - **ADR-622** (Structural Detail-Sheet SSoT) — `buildScheduleTable` / `buildFieldBlock` / τα **3 backends**. **Το θεμέλιο.**
  - **ADR-651** (Auto Title Block) — πρώτος καταναλωτής του «χάρτινο layout → in-scene block»
  - **ADR-650 M7** (Τοπογραφικά παραδοτέα) — δεύτερος καταναλωτής· `ExportableTable` SSoT
  - **ADR-363 §6 Φ8** (BIM Schedules) — `ScheduleColumnDef` / `ScheduleRow` / 3 exporters
  - **ADR-612** (Opening Info Tag) — **prior art επεξεργασίας κελιού στον καμβά** (hit-test κελιού + inline editor)
  - **ADR-344** (Text Engine) — `DxfTextNode`, placeholders, resolver
  - **ADR-550 / ADR-587** (Entity Render Contract + Type Descriptor) — τα registries που πρέπει να δηλωθεί νέος τύπος
  - **ADR-648 Στάδιο Δ** (`entity-export-coverage`) — υποχρεωτική δήλωση εξαγωγής ανά format
  - **ADR-462** (canonical mm), **ADR-040** (micro-leaf perf), **ADR-034 Appendix C / N.5** (άδειες)

> **Εντολή Giorgio (2026-07-31)**: *«Θέλω υλοποίηση όπως οι μεγάλοι παίκτες (Revit / ArchiCAD /
> Maxon C4D / Figma-level), full enterprise + full SSoT, χωρίς εκπτώσεις. Αν οι μεγάλοι δεν το
> προτείνουν, ακολουθούμε την πρακτική τους. Και αν μπορείς, βρες λύσεις **ακόμη πιο έξυπνες**
> από αυτές που χρησιμοποιούν οι μεγάλοι.»*

---

## Context — το πρόβλημα

Ο 2Δ καμβάς του NESTOR **δεν έχει γενικό εργαλείο πίνακα**. Δεν υπάρχει `'table'` στο
`RENDERABLE_ENTITY_TYPES`, δεν υπάρχει AutoCAD `ACAD_TABLE` σε import/export, δεν υπάρχει
εργαλείο «σχεδίασε πίνακα N×M». Ο 3Δ καμβάς δεν έχει τίποτα σχετικό.

Ταυτόχρονα, **υπάρχουν ήδη τρεις ανεξάρτητες μηχανές πίνακα** στο repo, καμία τους όμως δεν
είναι γενικό εργαλείο χρήστη. Η αρχιτεκτονική ερώτηση δεν είναι «πώς φτιάχνω πίνακα» — είναι
**«πώς ενοποιώ τρεις υπάρχουσες μηχανές σε ΜΙΑ, χωρίς να γίνει η τέταρτη»** (N.12 / N.18).

---

## 1. SSoT Audit — τι ΥΠΑΡΧΕΙ ήδη (μετρημένο, 2026-07-31)

| Στρώμα | Αρχείο | Τι κάνει | Κενό |
|---|---|---|---|
| **Layout πίνακα** | `bim/structural/detail-sheet/detail-sheet-schedule-table.ts` | `buildScheduleTable(spec)` — `ScheduleColumn[]` (x-anchor ως **κλάσμα** πλάτους + alignment), header bold → rules → data rows → total → footers. Βγάζει `DetailPrimitive[]` (γραμμή + κείμενο) | Στήλες με **κλάσμα**, όχι πραγματικά πλάτη· **καμία** κάθετη γραμμή· καμία συγχώνευση κελιών· κανένα style object |
| **Layout πεδίων** | `bim/structural/detail-sheet/detail-sheet-field-block.ts` | `buildFieldBlock` — 2-στηλος `label : value`, `FIELD_BLOCK_METRICS` | Ειδικού σκοπού |
| **Backend 1 — καμβάς** | `bim/structural/detail-sheet/render/detail-canvas-renderer.ts` | προεπισκόπηση σε καμβά | Μόνο preview, όχι σκηνή |
| **Backend 2 — PDF** | `.../render/detail-pdf-renderer.ts` | vector PDF | — |
| **Backend 3 — σκηνή** ⭐ | `.../render/detail-primitives-to-entities.ts` | `DetailPrimitive[]` → **`Entity[]`** με y-flip + annotation scale (paper-mm → model units) | Υποστηρίζει μόνο `line`/`polyline`/`text` |
| **Προσγείωση ως block** | `bim/block-library/sheet-block-def.ts` | `buildSheetBlockDef` → `InSessionBlockDef` → `BlockEntity` (επιλέξιμο/μετακινούμενο/undo) | Ο πίνακας γίνεται **αδιαφανές block** — τα κελιά **χάνονται** |
| **Δεδομένα (SSoT)** | `bim/schedule/types.ts` | `ScheduleColumnDef {key,i18nKey,valueType,align,widthHint}`, `ScheduleRow`, **`ExportableTable`**, `ExportableTableSection` | Καμία σύνδεση με καμβά |
| **Παραγωγοί δεδομένων** | `bim/schedule/schedule-builder.ts` · `systems/topography/deliverables/survey-tables.ts` | BIM schedules (10 τύποι) + τοπογραφικά (συντεταγμένες ΕΓΣΑ'87, εμβαδά, όγκοι, ανοχές) | — |
| **Καταναλωτές** | `csv/xlsx/pdf-exporter.ts` · `ui/components/bim-schedule/SchedulePreviewTable.tsx` | 3 exporters + React preview | **Ποτέ στον καμβά** |
| **Prior art κελιού** ⭐ | `bim/opening-info-tag/*` + `hooks/canvas/use-opening-info-tag-double-click.ts` | Entity με **3 επεξεργάσιμα κελιά**: `openingInfoTagCellAtWorld` (hit-test κελιού), inline `<input>` overlay μέσω `opening-info-tag-editor-store`, grips, rotated-box pick | Μόνο 3 σταθερά κελιά |

**Συμπέρασμα audit**: υπάρχει το **~75%** των μηχανισμών. Λείπει το **μοντέλο** (γενικός πίνακας
ως first-class entity) και το **UX** (δημιουργία / επεξεργασία / DXF interop).

> ⚠️ **Ο πραγματικός κίνδυνος**: `buildScheduleTable` (ADR-622) και `SchedulePreviewTable.tsx`
> είναι **ήδη** δύο μηχανές διάταξης πίνακα. Ένας τρίτος «table renderer» = sibling clone
> (N.18 / CHECK 3.28). **Ο νέος πίνακας ΠΡΕΠΕΙ να απορροφήσει τον ADR-622, όχι να τον μιμηθεί.**

---

## 2. Έρευνα Αγοράς — πώς το κάνουν οι μεγάλοι

| Εργαλείο | Μηχανισμός | Killer feature | Αδυναμία |
|---|---|---|---|
| **AutoCAD** 🏆 | `ACAD_TABLE` entity + `TABLESTYLE` object + **Data Links** (ζωντανός δεσμός με Excel) + `FIELD` objects σε κελιά + τύποι `=Sum(A1:A5)` | Ο **μόνος** πραγματικά γενικός πίνακας CAD· in-place cell editing· merged cells· **table breaking** (σπάει σε στήλες όταν δεν χωρά)· τύποι μεταξύ κελιών | Ο δεσμός δείχνει σε **αρχείο Excel** — όχι στο ίδιο το μοντέλο· fields μόνο σε ATTDEF defaults· βαρύ regen σε μεγάλους πίνακες |
| **Revit** | **Schedule = View**, όχι annotation. Τοποθετείται σε **Sheet**. **Αμφίδρομο**: αλλαγή κελιού → αλλάζει η παράμετρος του στοιχείου στο μοντέλο | **Bidirectionality** — το κελί *είναι* το μοντέλο· propagation σε όλα τα instances ενός type | ❗ **ΔΕΝ έχει καθόλου εργαλείο πίνακα-σημείωσης.** Οι χρήστες φτιάχνουν πίνακες με **detail lines + text** ή κάνουν **link ένα AutoCAD DWG**. Schedule **δεν μπαίνει σε κάτοψη** — μόνο σε φύλλο (workaround: «Schedule Key» legend) |
| **ArchiCAD** | **Interactive Schedule** — αμφίδρομο· τοποθετείται σε **Layout** | Διορθώνεις λάθος καταχώρησης μέσα από τον πίνακα· εντοπίζει ασυνέπειες από merge πολλών μελετητών | Ίδιος περιορισμός: ζει στο Layout, όχι ελεύθερα στην κάτοψη |
| **Vectorworks** | Worksheets (spreadsheet με τύπους) που μπορούν να **τοποθετηθούν** στο σχέδιο | Πραγματικό spreadsheet + database rows | UX «δύο κόσμων» (worksheet ≠ σχέδιο) |
| **Figma** | **Δεν έχει native πίνακα.** Πίνακες = Auto Layout frames (κοινότητα/plugins) | Auto Layout = δηλωτικό reflow· resize handles· responsive min/max | Καμία σημασιολογία δεδομένων — καθαρά οπτικό |
| **Maxon C4D** | Δεν έχει έννοια πίνακα στη σκηνή (μόνο Attribute Manager / Takes) | — | Άσχετο για το domain μας |

**Sources**: [AutoCAD TABLE DXF group codes](https://help.autodesk.com/cloudhelp/2015/ENU/AutoCAD-DXF/files/GUID-D8CCD2F0-18A3-42BB-A64D-539114A07DA0.htm) ·
[AutoCAD data links](https://www.engineering.com/autocad-tables-data-linking/) ·
[Revit schedule bidirectionality](https://www.modelical.com/en/gdocs/model-schedules/) ·
[Revit δεν έχει table annotation → workarounds](https://www.cad-notes.com/how-to-create-a-table-in-revit/) ·
[ArchiCAD Interactive Schedules](https://help.graphisoft.com/AC/20/INT/AC20Help/03_2_Views_Virtual_Building/03_2_Views_Virtual_Building-95.htm) ·
[Figma tables = Auto Layout](https://www.untitledui.com/blog/create-tables-in-figma)

### 2.1 Τα 5 κρίσιμα ευρήματα

1. **Το κενό της αγοράς είναι υπαρκτό και μεγάλο.** Το κορυφαίο BIM εργαλείο του κόσμου (Revit)
   **δεν έχει εργαλείο πίνακα**. Οι μηχανικοί σχεδιάζουν πίνακες με γραμμές και κείμενο ή
   κάνουν import DWG. Αυτό δεν είναι λεπτομέρεια — είναι **η ευκαιρία**.
2. **Οι δύο κόσμοι δεν έχουν ενωθεί από κανέναν.** AutoCAD = γενικός πίνακας **χωρίς** δεσμό
   με το μοντέλο. Revit/ArchiCAD = δεσμός με το μοντέλο **χωρίς** γενικό πίνακα. **Κανείς δεν
   έχει και τα δύο.**
3. **Ο δεσμός του AutoCAD δείχνει σε λάθος μέρος** — σε αρχείο Excel. Αν το αρχείο μετακινηθεί,
   ο πίνακας «παγώνει». Το ΔΙΚΟ μας μοντέλο είναι ήδη στη σκηνή· ο δεσμός μπορεί να δείχνει
   **στην ίδια τη σκηνή**, χωρίς εξωτερικό αρχείο.
4. **Ο περιορισμός Layout/Sheet είναι ιστορικός, όχι τεχνικός.** Οι μηχανικοί ΘΕΛΟΥΝ πίνακα
   δίπλα στην κάτοψη (γι' αυτό κάνουν τα workarounds). Εμείς **δεν έχουμε** διαχωρισμό
   model/paper space που να μας εμποδίζει — ο ADR-622 backend #3 ήδη προσγειώνει «χάρτινο»
   layout μέσα στη σκηνή με annotation scale.
5. **Το Auto Layout της Figma είναι το σωστό μοντέλο διάταξης** — δηλωτικό (`hug` / `fill` /
   `fixed` ανά στήλη) αντί για χειροκίνητα πλάτη. Το `frac` του ADR-622 είναι η φτωχή εκδοχή του.

---

## 3. Η Αρχιτεκτονική Απόφαση

### Αρχή 1 — ΕΝΑ entity, ΕΝΑ μοντέλο, τρία επίπεδα «ζωντάνιας»

Νέος first-class renderable type **`'table'`** (κατηγορία `annotation`, δίπλα στο `scale-bar` /
`opening-info-tag`). **Ένα** data model· η διαφορά είναι **από πού έρχεται το περιεχόμενο**:

| Mode | Πηγή κελιών | Ανάλογο | Χρήση |
|---|---|---|---|
| `static` | Ο χρήστης τα πληκτρολογεί | AutoCAD TABLE | Υπόμνημα, σημειώσεις, ελεύθερος πίνακας |
| `bound` | Στιγμιότυπο από `ExportableTable` (schedule/τοπογραφικό), **με** αποθηκευμένο `sourceRef` + `revision` | AutoCAD Data Link | Πίνακας ποσοτήτων που **δηλώνει** πότε είναι μπαγιάτικος |
| `live` ⭐ | Παράγεται από τη σκηνή σε κάθε `regen` μέσω `sourceRef` — **αμφίδρομο** | Revit Schedule | Ο πίνακας **είναι** το μοντέλο |

Ένα `TableEntity` μπορεί να είναι `live` και ο χρήστης να κάνει **detach** → γίνεται `static`
(μονόδρομη, ρητή ενέργεια — όπως το «Explode»). Ποτέ σιωπηλά.

### Αρχή 2 — Ο ADR-622 ΑΠΟΡΡΟΦΑΤΑΙ, δεν αντιγράφεται

`buildScheduleTable` γίνεται **thin adapter** πάνω στη νέα μηχανή:
`ScheduleTableSpec` → `TableModel` → `layoutTable()` → `DetailPrimitive[]`. Τα υπάρχοντα
detail sheets (δοκός/υποστύλωμα/πέδιλο/πλάκα) και το title block **δεν αλλάζουν συμπεριφορά**
(κλειδώνεται με χαρακτηρισμό — βλ. §12). **Μία μηχανή διάταξης στο repo, ποτέ δύο.**

### Αρχή 3 — Ένα layout, τέσσερα backends

Το `layoutTable(model, style)` βγάζει **γεωμετρία σε sheet-mm** και **τίποτε άλλο**. Backends:

```
                 ┌─ Canvas 2D  (detail-canvas-renderer — ΥΠΑΡΧΕΙ)
TableModel       ├─ PDF        (detail-pdf-renderer — ΥΠΑΡΧΕΙ)
  + TableStyle ──┼─ Scene      (detail-primitives-to-entities — ΥΠΑΡΧΕΙ)
  → layoutTable  └─ DXF        (ACAD_TABLE native — ΝΕΟ, §11)
```

**οθόνη === PDF === DXF === σκηνή**, μία αλήθεια (η αρχή που ήδη επέβαλε ο ADR-651 §11).

---

## 4. Data Model (πρόταση)

```ts
// types/table.ts — canonical mm (ADR-462), y-πάνω στη σκηνή
export interface TableEntity extends BaseEntity {
  readonly type: 'table';
  readonly position: Point2D;        // άγκυρα (πάνω-αριστερά, σύμβαση AutoCAD)
  readonly rotation: number;         // rad
  readonly styleId: string;          // → TableStyle SSoT (tblstyle_<UUID>)
  readonly model: TableModel;
  readonly binding?: TableBinding;   // undefined = static
  readonly breaking?: TableBreaking; // AutoCAD table breaking
}

export interface TableModel {
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
  readonly cells: ReadonlyMap<CellKey, TableCell>; // αραιό — μόνο μη-κενά/overridden
  readonly merges: readonly CellSpan[];
}

export interface TableColumn {
  readonly id: string;               // σταθερό — τα merges/formulas δείχνουν σε id, ΟΧΙ σε index
  /** Figma Auto Layout: fixed = ρητά mm · hug = μέγιστο περιεχόμενο · fill = μοιράζεται το υπόλοιπο */
  readonly sizing: { kind: 'fixed'; widthMm: number } | { kind: 'hug' } | { kind: 'fill'; weight: number };
  readonly valueType: ScheduleColumnValueType;   // ΕΠΑΝΑΧΡΗΣΗ ADR-363 — όχι νέο vocabulary
  readonly align: ScheduleColumnAlign;
}

export type CellKind = 'text' | 'formula' | 'field' | 'block' | 'image';
export interface TableCell {
  readonly kind: CellKind;
  readonly value: ScheduleCellValue;     // ΕΠΑΝΑΧΡΗΣΗ ADR-363
  readonly formula?: string;             // '=SUM(C2:C9)' — kind:'formula'
  readonly styleOverride?: Partial<TableCellStyle>;
  readonly locked?: boolean;             // live mode: κελί που δεν επιτρέπει write-back
}
```

**Γιατί `ScheduleCellValue` / `ScheduleColumnValueType` και όχι νέοι τύποι**: τα τρία υπάρχοντα
συστήματα (schedules, τοπογραφικά, detail sheets) μιλούν ήδη αυτή τη γλώσσα. Νέο vocabulary =
τέταρτο λεξιλόγιο = μεταφραστές παντού (η παγίδα «2 λεξιλόγια ρόλων» του ADR-694).

**Γιατί `id` και όχι index σε στήλες/γραμμές**: εισαγωγή γραμμής στη μέση **δεν** πρέπει να
σπάει merges και τύπους. Το AutoCAD το κάνει με index και γι' αυτό οι τύποι σπάνε.

**Γιατί αραιό `cells`**: πίνακας 500×8 = 4.000 κελιά· τα περισσότερα κενά. Πυκνός πίνακας =
4.000 αντικείμενα σε κάθε undo snapshot.

### 4.1 Μονάδες — ρητή διάκριση (η παγίδα ADR-716)

Δύο χώροι, ποτέ ανάμεικτοι:
- **sheet-mm** (paper): πλάτη στηλών, ύψη γραμμών, ύψος κειμένου, πάχη γραμμών.
- **model units**: η θέση της άγκυρας στη σκηνή.

Η γέφυρα είναι **αποκλειστικά** ο `scaleFactor` (annotation scale) του
`detail-primitives-to-entities.ts`. **Καμία άλλη πολλαπλασιαστική μετατροπή πουθενά** — αυτό
είναι το μάθημα των ADR-462/716.

---

## 5. TableStyle SSoT — σαν DIMSTYLE, όχι σαν CSS

`TableStyle` = named object (id `tblstyle_<UUID-v4>` από `enterprise-id.service`, N.6), με
**τρεις row classes** (AutoCAD: `title` / `header` / `data`) και προαιρετικό override ανά κελί:

```ts
interface TableRowClassStyle {
  textStyleId: string; textHeightMm: number;
  align: CellAlign;            // 9 θέσεις (TL..BR) — group code 170 του DXF
  marginsMm: { h: number; v: number };
  fillColor?: ColorRef; textColor: ColorRef;
  borders: { top; right; bottom; left; insideH; insideV }; // color + lineweight + visibility
}
```

Ταιριάζει **1:1** με τα group codes 7/140/170/64/63/69/65/66/68/279/275/276/278/289/285/286/288
του `ACAD_TABLE` → το DXF round-trip γίνεται **αντιστοίχιση πεδίων**, όχι μετάφραση με απώλειες.

Οι υπάρχοντες πίνακες του ADR-622 γίνονται **built-in preset** (`structural-detail`) με
ακριβώς τις τιμές που έχουν σήμερα (`ROW_H_MM 7.5`, `TEXT_MM 2.6`, `#999999`, `0.15mm`) → μηδέν
οπτική μεταβολή.

---

## 6. Rendering — 2Δ

- **Ζωγραφική**: μέσω του υπάρχοντος `EntityRendererComposite` (νέος `TableRenderer`), όχι νέο
  pipeline. Ο ADR-040 απαγορεύει subscriptions σε orchestrators — ο renderer είναι καθαρή
  συνάρτηση `(model, style, transform) → draw`.
- **Κλιμάκωση**: η μηχανή διάταξης τρέχει **μόνο** όταν αλλάζει μοντέλο/στυλ, ποτέ ανά frame.
  Το αποτέλεσμα (`TableLayout`: x/y ανά στήλη/γραμμή + text runs) απομνημονεύεται στο entity.
- **Culling / LOD** (το μάθημα του ADR-735 — μην κάνεις O(zoom²) δουλειά):
  - `zoom < LOD_TEXT` → μόνο το πλέγμα + γεμίσματα (κανένα glyph).
  - Ορατές γραμμές μόνο: binary search στο cumulative-y του `TableLayout` για το viewport →
    **O(log n + ορατές)**, όχι O(γραμμές).
  - Το bitmap cache key (ADR-040 κανόνας 3) **ΔΕΝ** περιέχει `hoveredCell`/`editingCell`.
- **Table breaking**: όταν `heightMm > maxHeightMm`, ο πίνακας σπάει σε τμήματα δίπλα-δίπλα
  με επανάληψη κεφαλίδας (AutoCAD parity).

---

## 7. Rendering — 3Δ (η ρητή απάντηση στην ερώτηση «2Δ **και** 3Δ»)

**Τι κάνουν οι μεγάλοι**: τίποτα. Revit schedules δεν εμφανίζονται σε 3D view. C4D δεν έχει
έννοια πίνακα. **Κανένας δεν βάζει πίνακα δεδομένων μέσα σε 3D σκηνή.**

**Πρόταση** — τρία επίπεδα, με ρητή τήρηση του περιορισμού υλικού:

| Επίπεδο | Τι | Κόστος |
|---|---|---|
| **Α (must)** | `table` = `annotation` → **2D-only** στο render contract (`d3: false`), όπως `scale-bar`/`opening-info-tag`. Στο 3D **δεν** εμφανίζεται. | 0 |
| **Β (ΕΓΚΡΙΘΗΚΕ)** ⭐ | **Screen-space HUD panel** στο 3D viewport (DOM overlay, Navisworks-style): ο ίδιος `TableModel`, ίδια δεδομένα, ίδιο i18n — αλλά **HTML**, όχι WebGL. Επιλογή γραμμής → highlight του entity στο 3D· επιλογή στο 3D → scroll στη γραμμή. | Χαμηλό |
| **Γ (ΕΓΚΡΙΘΗΚΕ)** ⭐ | World-anchored **billboard** πλάκα πίνακα μέσα στον 3D χώρο (πρότυπο: `bim-3d/comments/CommentMarker3DRenderer.ts` + `comment-marker-textures.ts`). | Χαμηλό — βλ. §7.1 |

**Απόφαση Giorgio (2026-07-31): Α + Β + Γ.**

### 7.1 Το κόστος του επιπέδου Γ — γιατί είναι αποδεκτό ακόμη και σε αδύναμο μηχάνημα

Διόρθωση διατύπωσης που κουβαλούσε το project: **δεν υπάρχει σήμερα PC «χωρίς GPU»** — κάθε
σύγχρονη CPU (Intel/AMD/Apple) φέρει **ενσωματωμένη** GPU. Οι τρεις πραγματικές καταστάσεις:

| Κατάσταση | Τι σημαίνει | Επίπτωση σε 1 billboard |
|---|---|---|
| **Ενσωματωμένη (integrated)** | GPU μέσα στη CPU, μοιράζεται RAM. Η συνηθέστερη σε φορητά | Αμελητέα |
| **Αποκλειστική (discrete)** | Ξεχωριστή κάρτα με δική της VRAM | Αμελητέα |
| **Software rendering** (SwiftShader) | Ο browser έβαλε τον driver σε denylist, ή τρέχει σε VM / απομακρυσμένη επιφάνεια. **Εδώ** πραγματικά δεν υπάρχει GPU για τη σελίδα | Αισθητή — γι' αυτό fallback |

Η προϋπάρχουσα σημείωση «PC χωρίς GPU» αφορούσε το **μηχάνημα ανάπτυξης του Giorgio** στο
πλαίσιο του pan-lag (13 full-viewport canvases σε software compositing) — **όχι** τους τελικούς
χρήστες. Ήταν ανακριβής διατύπωση του «χωρίς **αποκλειστική** κάρτα».

**Γιατί το billboard είναι φθηνό**: είναι **ένα quad με μία υφή** (canvas → `CanvasTexture`).
Το κόστος **δεν** είναι το draw (1 draw call) — είναι το **re-raster της υφής**. Άρα ο κανόνας:

- Re-raster **μόνο** όταν αλλάζουν δεδομένα/στυλ/DPR — **ποτέ** ανά frame, ποτέ σε pan/zoom
  (ακριβώς η αρχή του `ImmediateTransformStore` / ADR-040: η κάμερα κινείται, η υφή δεν ξαναχτίζεται).
- Το billboard δείχνει **σελίδα/σύνοψη**, όχι 500 γραμμές — φράγμα υφής (π.χ. 1024×1024) με ρητή
  ένδειξη «+N γραμμές». Το πραγματικό ρίσκο είναι **μνήμη υφής**, όχι ρυθμός καρέ.
- Capability detection: σε software rendering → **αυτόματη υποβάθμιση στο επίπεδο Β** (DOM HUD).

Έτσι ούτε το επίπεδο Γ παραβιάζει τον περιορισμό ούτε χάνεται η φιλοδοξία: **η υποβάθμιση είναι
σχεδιασμένη, όχι τυχαία**.

> **Δεν ξέρω** (ειλικρινώς) το ακριβές ποσοστό χρηστών σε software rendering — δεν βρήκα
> αξιόπιστα δημόσια στοιχεία. Γι' αυτό η λύση είναι **ανίχνευση δυνατότητας στον χρόνο
> εκτέλεσης**, όχι υπόθεση για το κοινό.

Τα επίπεδα Β **και** Γ είναι **πάνω από τους μεγάλους**: κανένα BIM εργαλείο δεν δίνει ζωντανό,
αμφίδρομα επιλέξιμο πίνακα ποσοτήτων μέσα στο 3D viewport.

---

## 8. Editing UX — Figma-level

**Πρότυπο υλοποίησης: ο ADR-612.** Το `use-opening-info-tag-double-click.ts` έχει ήδη λύσει το
δύσκολο κομμάτι (world→cell hit-test, screen rect με το **ίδιο** `CoordinateTransforms.worldToScreen`
που χρησιμοποιεί ο renderer, overlay `<input>`, commit μέσω store). Γενικεύεται:

- **Δημιουργία**: εργαλείο `TABLE` → drag ορθογωνίου ή dialog «γραμμές × στήλες» ή **επικόλληση
  από πρόχειρο** (TSV/CSV → πίνακας· το κάνει το Excel, δεν το κάνει κανένα CAD).
- **In-place επεξεργασία**: διπλό κλικ → editor στο κελί. `Tab`/`Shift+Tab`/`Enter`/βέλη =
  πλοήγηση. `F2` = edit. `Esc` = ακύρωση. **Ownership πληκτρολογίου μέσω του υπάρχοντος bus**
  (ADR-364/711 — το `inert` δεν σταματά το `window keydown`).
- **Grips** (ADR-587: «μετακινείται; περιστρέφεται; έχει λαβές;»): γωνιακή λαβή μετακίνησης,
  λαβή περιστροφής, **λαβές ορίων στηλών** (drag → `sizing: fixed`), λαβές ορίων γραμμών.
- **Επιλογή εύρους**: click-drag πάνω σε κελιά → range· `Ctrl+C`/`Ctrl+V`· συγχώνευση/διάσπαση.
- **Undo**: μέσω του υπάρχοντος command stack — **μία εγγραφή ανά χειρονομία**, όχι ανά κελί.

---

## 9. Τύποι (formulas) — και το θέμα ΑΔΕΙΑΣ

🚨 **Εύρημα N.5 (κρίσιμο)**: **HyperFormula = GPLv3** (dual-license με εμπορική).
**ΑΠΑΓΟΡΕΥΕΤΑΙ** — θα υποχρέωνε όλο το NESTOR σε open source ή σε πληρωμή. Το
`handsontable/formula-parser` είναι **deprecated**.

### 9.1 Απόφαση Giorgio (2026-07-31): εξωτερική βιβλιοθήκη MIT, μηδέν δεσμεύσεις

**Επιλογή: [`fast-formula-parser`](https://github.com/LesterLyu/fast-formula-parser) v1.0.19 — MIT.**
LL(1) parser (~3× ταχύτερος του `formula-parser`), **280 συναρτήσεις Excel**.

**Έλεγχος ΟΛΗΣ της αλυσίδας εξαρτήσεων** (N.5 — δεν αρκεί η άδεια του πακέτου· μια GPL
εξάρτηση μολύνει το ίδιο):

| Πακέτο | Έκδοση | Άδεια | |
|---|---|---|---|
| `fast-formula-parser` | 1.0.19 | **MIT** | ✅ |
| ├ `chevrotain` | 13.0.0 | **Apache-2.0** | ✅ |
| ├ `jstat` | 1.9.6 | **MIT** | ✅ |
| ├ `bessel` | 1.0.2 | **Apache-2.0** | ✅ |
| └ `bahttext` | 2.4.0 | **MIT** | ✅ |

**Καθαρή αλυσίδα — καμία GPL/LGPL/AGPL, μηδέν κόστος, μηδέν υποχρέωση ανοίγματος κώδικα.**

🔴 **Απορρίφθηκε: `@sheetxl/formulas`** (ο διάδοχος που συνιστά το ίδιο το README του
`fast-formula-parser`). Δηλώνει `"license": "SEE LICENSE IN <LICENSE>"` — **μη τυποποιημένη
άδεια**. Ο N.5 είναι ρητός: *«αν η άδεια είναι ασαφής → ΡΩΤΑ»*. Δεν το εισάγουμε.

**Ο κίνδυνος και γιατί είναι αποδεκτός**: το `fast-formula-parser` μπαίνει σε maintenance mode
(ο συγγραφέας μετακόμισε στο SheetXL). **Αλλά MIT σημαίνει ότι ο κώδικας είναι δικός μας για
πάντα** — αν σταματήσει, κάνουμε fork. Η άδεια δεν ανακαλείται. Αυτό είναι ακριβώς η διαφορά
από το GPL: εκεί το «δικός μας για πάντα» έρχεται με τίμημα το άνοιγμα ΟΛΟΥ του NESTOR.

### 9.2 Αρχιτεκτονική ένταξη — adapter, ποτέ γυμνή εξάρτηση

Η βιβλιοθήκη **δεν** αγγίζει το `TableEntity`. Μπαίνει πίσω από **ένα** interface
(`table-formula-engine.ts`):

```ts
export interface TableFormulaEngine {
  evaluate(model: TableModel, changed: readonly CellKey[]): ReadonlyMap<CellKey, ScheduleCellValue>;
}
```

Λόγοι (και οι τρεις είναι δεσμευτικοί):
1. **Αναστρεψιμότητα** — αν η βιβλιοθήκη πεθάνει, αλλάζει **ένα** αρχείο, όχι το μοντέλο.
2. **Μετάφραση αναφορών** — η βιβλιοθήκη μιλά `A1`/`B2` (**index**), το μοντέλο μας μιλά
   **column-id/row-id** (§4). Ο adapter είναι το **μόνο** σημείο μετάφρασης· χωρίς αυτόν, η
   εισαγωγή γραμμής θα έσπαγε τους τύπους ακριβώς όπως στο AutoCAD.
3. **Επαναϋπολογισμός μόνο των εξαρτημένων** — dependency graph + τοπολογική ταξινόμηση +
   ανίχνευση κύκλου (`#CIRCULAR!`) δικά μας· η βιβλιοθήκη αξιολογεί **έναν** τύπο, δεν
   διαχειρίζεται φύλλο.

---

## 10. DXF Interop — `ACAD_TABLE`

**Export**: `table` → `native` στο `ENTITY_EXPORT_COVERAGE` (ADR-648). Τα group codes είναι
τεκμηριωμένα και ταιριάζουν με το §5:

| Κωδικός | Σημασία | Κωδικός | Σημασία |
|---|---|---|---|
| 91 / 92 | αριθμός γραμμών / στηλών | 171 | τύπος κελιού (1=text, 2=block) |
| 141 / 142 | ύψος γραμμής / πλάτος στήλης | 172 / 173 | flag / merged value |
| 1 / 2 | κείμενο (<250 / τμήματα) | 175 / 176 | εύρος συγχώνευσης (πλάτος/ύψος) |
| 344 | pointer σε `FIELD` object | 170 | στοίχιση κελιού |
| 340 / 144 | block record / κλίμακα | 63/64 | γέμισμα / χρώμα περιεχομένου |
| 40 / 41 | περιθώρια οριζ./κατακ. | 280 / 281 | απόκρυψη title / header |

**Fallback**: `TABLESTYLE` object + `ACAD_TABLE` απαιτούν R2004+. Για παλιότερα targets →
`decompose` σε lines+text (η διαδρομή που ήδη υπάρχει). Η απόφαση δηλώνεται στο coverage table.

**Import**: `ACAD_TABLE` → `TableEntity` (`static`). Σήμερα το αρχείο **χάνεται σιωπηλά** —
αυτό από μόνο του είναι κέρδος.

---

## 11. Τι μας κάνει **καλύτερους** από τους μεγάλους

| # | Χαρακτηριστικό | Ποιος το έχει |
|---|---|---|
| 1 | **Γενικός πίνακας ΚΑΙ αμφίδρομος δεσμός με το μοντέλο, στο ίδιο αντικείμενο** | **Κανείς.** AutoCAD έχει το πρώτο, Revit/ArchiCAD το δεύτερο |
| 2 | **Ελεύθερη τοποθέτηση στην κάτοψη** (όχι μόνο σε φύλλο) με annotative scale | AutoCAD ναι· Revit/ArchiCAD **όχι** (και οι χρήστες το ζητούν) |
| 3 | **Δεσμός στη ΣΚΗΝΗ, όχι σε εξωτερικό αρχείο** — δεν σπάει ποτέ | Κανείς (AutoCAD δείχνει σε Excel) |
| 4 | **Ζωντανός πίνακας μέσα στο 3D viewport** με αμφίδρομη επιλογή (§7 Β) | Κανείς |
| 5 | **Figma Auto Layout sizing** (`hug`/`fill`/`fixed`) αντί για χειροκίνητα πλάτη | Κανένα CAD |
| 6 | **Επικόλληση TSV/CSV από το πρόχειρο** → πίνακας σε ένα βήμα | Κανένα CAD |
| 7 | **Column/row ids** → εισαγωγή γραμμής δεν σπάει τύπους/merges | Ούτε το AutoCAD |
| 8 | **Ένδειξη «μπαγιάτικου»** σε `bound` mode (revision stamp) αντί για σιωπηλά λάθος νούμερα | Κανείς |
| 9 | **i18n εξ ορισμού** (`i18nKey` ανά στήλη — ήδη στο `ScheduleColumnDef`) | Κανείς |

Το #8 αξίζει έμφαση: ο ADR-720 έχει ήδη διδάξει ότι **ένα κατασκευασμένο `0.000` σε νομικό
παραδοτέο είναι μέτρηση που κανείς δεν πήρε**. Ένας πίνακας ποσοτήτων που δείχνει παλιά νούμερα
χωρίς να το δηλώνει είναι το ίδιο σφάλμα **τιμής**, όχι εμφάνισης.

---

## 12. Υποχρεωτικά Gates (τι θα μας ρωτήσει το ίδιο το repo)

Η προσθήκη `'table'` στο `RENDERABLE_ENTITY_TYPES` **σπάει σκόπιμα** τα εξής — και κάθε ένα
απαιτεί συνειδητή απάντηση (ADR-587 §6.1: *«anchor χωρίς gate δεν είναι anchor — είναι σχόλιο»*):

| Gate | Ερώτηση | Απάντηση |
|---|---|---|
| `entity-render-contract.ts` | d2/d3/d3Builder; | `d2:true, d3:false, d3Builder:'none'` |
| `entity-render-surfaces.ts` | 2D-only εξαίρεση; | annotation → όχι στο `BIM_2D_ONLY_TYPES` (αυτό είναι για BIM) |
| `entity-type-descriptor.ts` | κατηγορία; | `+1 γραμμή` στο `ANNOTATION_RENDERABLE_TYPES` |
| `entity-export-coverage.ts` | DXF / TEK; | `dxf:'native'` (§10) · TEK → απόφαση §14 |
| ~20 capability anchors (CHECK 5C, ~41s) | μετακινείται/περιστρέφεται/grips/ghost/bounds; | ναι/ναι/ναι(§8)/όχι/ναι |
| CHECK 3.8 + 3.33 | i18n keys | κλειδιά σε **EL+EN** ΠΡΙΝ τον κώδικα· `npm run generate:i18n-types` |
| CHECK 3.28 (jscpd) | sibling clone; | **§3 Αρχή 2** — απορρόφηση ADR-622, όχι μίμηση |
| CHECK 3.29 (DXF tsc, CI) | νέα σφάλματα τύπων; | το subapp είναι εκτός root tsconfig — **μόνο το CI βλέπει** |
| N.7.1 | 500 γρ./αρχείο, 40 γρ./συνάρτηση | το layout σπάει σε `measure` / `place` / `borders` / `breaking` |

**Χαρακτηρισμός πριν την απορρόφηση**: πριν αγγίξω το `buildScheduleTable`, γράφω
snapshot tests στα **4 υπάρχοντα detail sheets + title block + τοπογραφικά** ώστε η απορρόφηση
να αποδεικνύεται byte-identical. Χωρίς αυτό, «δεν άλλαξε τίποτα» είναι ισχυρισμός, όχι απόδειξη.

---

## 13. Roadmap (φάσεις — κάθε μία αυτοτελής, με δικά της tests)

| Φ | Τίτλος | Παραδοτέο | Αρχεία |
|---|---|---|---|
| **Α** ✅ | Μοντέλο + μηχανή διάταξης | `types/table.ts`, `table-layout.ts` (measure/place/borders), `TableStyle` SSoT + presets. **Καθαρές συναρτήσεις, μηδέν React/canvas**. **+ ο χαρακτηρισμός του §12 τραβήχτηκε ΕΔΩ** ώστε η Φ.Β να ξεκινήσει με το δίχτυ στημένο | 10 + 3 tests |
| **Β** ✅ | Απορρόφηση ADR-622 | `buildScheduleTable` → adapter (**byte-identical**)· ~~χαρακτηρισμός 6 καταναλωτών **πρώτα**~~ **έγινε στη Φ.Α**· `buildFieldBlock` **εκτός εύρους** (§17.5) | 3 + 1 test |
| **Γ** ✅ | Entity + rendering 2D | `TableEntity`, `TableRenderer`, bounds/hit-test/grips, **9 gates §12 απαντημένα** (§18) | 9 νέα + 21 gates |
| **Δ** | Δημιουργία + επεξεργασία | **βήμα 1 ✅** — σειριοποίηση (Λύση Α) + εργαλείο ενός κλικ + WYSIWYG φάντασμα + κουμπί κορδέλας (§19)· **βήμα 2 (inline cell editor) ✅** (§19.9)· **βήμα 2 (keyboard nav, TSV/CSV) + βήματα 3-4 ΑΝΟΙΧΤΑ** — contextual καρτέλα ribbon | 5 νέα + ~20 (βήμα 1) + 3 νέα (cell editor) |
| **Ε** | DXF interop | `ACAD_TABLE` export/import + `TABLESTYLE` + fallback | ~6 |
| **ΣΤ** | `bound` mode | `sourceRef` σε `ExportableTable`, revision stamp, «ανανέωση» | ~5 |
| **Ζ** | Τύποι | δικός μας evaluator + dependency graph | ~4 |
| **Η** | `live` mode ⭐ | ζωντανή αναγέννηση + **write-back** στο μοντέλο (η ναυαρχίδα) | ~8 |
| **Θ** | 3D HUD panel | DOM overlay + αμφίδρομη επιλογή (§7 Β) | ~5 |

Οι Φ.Α–Γ είναι το «υπάρχει πίνακας». Οι Δ–Ε το «είναι επαγγελματικό εργαλείο». Οι ΣΤ–Θ το
«ξεπερνά τους μεγάλους».

---

## 14. Αποφάσεις — ΕΛΗΦΘΗΣΑΝ (Giorgio, 2026-07-31)

| # | Θέμα | Απόφαση |
|---|---|---|
| 1 | **Εύρος** | **Όλες οι φάσεις Α–Θ — αλλά ΣΤΑΔΙΑΚΑ**, μία τη φορά, με ποιότητα σε κάθε βήμα. Το πλήρες όραμα είναι ο προορισμός· ο δρόμος είναι φάση-φάση, όχι μεγάλη έκρηξη |
| 2 | **`live` write-back** (Φ.Η) | **ΝΑΙ, σε δική του φάση.** Σχεδιάζεται από τώρα στο μοντέλο (`sourceRef`, `locked` κελιά), υλοποιείται στη Φ.Η με δικά της tests |
| 3 | **3Δ** | **Α + Β + Γ** — 2D-only entity **+** DOM HUD panel **+** world-anchored billboard, με σχεδιασμένη υποβάθμιση σε software rendering (§7.1) |
| 4 | **Τύποι** | **Εξωτερική MIT βιβλιοθήκη: `fast-formula-parser`** (αλυσίδα αδειών επαληθευμένη, §9.1), πίσω από adapter (§9.2). `@sheetxl/formulas` **απορρίφθηκε** — ασαφής άδεια |
| 5 | **TEK export** | **`decompose`** (απόφαση αρχιτέκτονα): ο Τέκτονας δεν έχει έννοια πίνακα· ο πίνακας αποδομείται σε γραμμές + κείμενο, όπως ήδη κάνουν οι annotations. Καμία σιωπηλή απώλεια |

### 14.1 Τι σημαίνει «σταδιακά» επιχειρησιακά

Κάθε φάση κλείνει **αυτοτελώς** πριν ανοίξει η επόμενη:
`ADR φάσης → υλοποίηση → tests → ενημέρωση ADR (Φάση 3, N.0.1) → έγκριση Giorgio → επόμενη`.
Καμία φάση δεν αφήνει «μισό» μηχανισμό πίσω της (το μάθημα του ADR-507 hatch).

---

## 15. Κίνδυνοι

| Κίνδυνος | Μετριασμός |
|---|---|
| **Τέταρτη μηχανή πίνακα** (N.18) | §3 Αρχή 2 + χαρακτηρισμός πριν την απορρόφηση + `npm run jscpd:diff` πριν κάθε «done» |
| **Perf σε 500+ γραμμές** (ADR-735) | Layout **memoized**, ποτέ ανά frame· binary search ορατών γραμμών· LOD κειμένου |
| **Άδεια formula engine** | §9.1 — HyperFormula **απαγορευμένο**· `fast-formula-parser` MIT με **επαληθευμένη αλυσίδα**· adapter (§9.2) ώστε η αντικατάσταση να κοστίζει ένα αρχείο |
| **Εγκατάλειψη `fast-formula-parser`** | MIT = δικαίωμα fork εσαεί· ο adapter απομονώνει· `@sheetxl/formulas` απορρίφθηκε (ασαφής άδεια) |
| **DXF `ACAD_TABLE` απαιτεί R2004+** | ρητό fallback `decompose` ανά έκδοση-στόχο |
| **Ασυμφωνία μονάδων** (ADR-716) | §4.1 — δύο χώροι, **μία** γέφυρα (`scaleFactor`) |
| **i18n χρέος** (N.11) | κλειδιά EL+EN πριν τον κώδικα· έλεγχος με pseudo locale (ADR-666), όχι με το `0` του scanner |
| **Απόδοση 3D billboard σε αδύναμο μηχάνημα** | §7.1 — 1 quad + 1 υφή· **re-raster μόνο σε αλλαγή δεδομένων**, ποτέ ανά frame· φράγμα υφής· **σχεδιασμένη υποβάθμιση** σε επίπεδο Β όταν ανιχνευθεί software rendering |

---

## 16. Φάση Α — τι υλοποιήθηκε (2026-07-31)

### 16.1 Τα αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `types/table.ts` | Το μοντέλο: `TableModel` / `TableColumn` / `TableRow` / `TableCell` / `CellSpan` / `CellKey` (**branded**) / `TableBinding` / `TableBreaking` / `TableBorderSpec` |
| `bim/table/table-style.ts` | `TableStyle` + 3 κλάσεις γραμμής + `resolveCellStyle` (κλάση → παράκαμψη κελιού) |
| `bim/table/table-style-presets.ts` | `standard` (πλήρες πλέγμα) + `detailSheet` (**οι ακριβείς τιμές του ADR-622**) |
| `bim/table/table-style-registry.ts` | Μητρώο — κάτοπτρο του `line-style-registry` (ADR-570), ίδιο συμβόλαιο `useSyncExternalStore` |
| `bim/table/table-model-helpers.ts` | `cellKey()` (η **μόνη** πηγή κλειδιών) · `buildMergeIndex()` · `createTableModel()` |
| `bim/table/table-layout-measure.ts` | Στάδιο 1 — `fixed` → `hug` → `fill` |
| `bim/table/table-layout-place.ts` | Στάδιο 2 — ορθογώνια κελιών + αγκύρωση κειμένου |
| `bim/table/table-layout-borders.ts` | Στάδιο 3 — ακμές πλέγματος, **ενωμένες** |
| `bim/table/table-layout.ts` | `layoutTable()` + `visibleRowRange()` |
| `bim/table/table-layout-types.ts` | `TableLayout` — το συμβόλαιο προς τα 4 backends |

Παράλληλα: `TABLE_STYLE: 'tblstyle'` + `generateTableStyleId()` (N.6, 3 αρχεία του
`enterprise-id`) · i18n κλειδιά `ribbon.commands.tableStyleNames.*` σε **EL+EN** πριν τον κώδικα
(N.11) + `npm run generate:i18n-types` (CHECK 3.33) · module `table-layout-engine` στο
`.ssot-registry.json` (N.12, tier 3).

### 16.2 Τρεις αποκλίσεις από το §4 — και ο λόγος καθεμιάς

1. **Το `TableEntity` ΔΕΝ γράφτηκε.** Απαιτεί `'table'` στο `EntityType` union, που πυροδοτεί και
   τα 9 gates του §12 (~20 capability anchors, CHECK 5C). Το roadmap τα τοποθετεί στη **Φ.Γ**·
   entity χωρίς απαντημένα gates θα άφηνε το repo κόκκινο (ADR-587 §6.1: *«anchor χωρίς gate δεν
   είναι anchor — είναι σχόλιο»*). Τα υπόλοιπα πεδία του §4 (`binding`, `breaking`, `styleId`)
   υπάρχουν ήδη ως τύποι, ώστε το σχήμα να μην αλλάξει ανά φάση.
2. **Προστέθηκε `TableRow.borderTop`** (δεν ήταν στο §4). Το row-class μοντέλο του AutoCAD
   **δομικά δεν μπορεί** να εκφράσει «γραμμή πάνω από μία συγκεκριμένη γραμμή δεδομένων» — και
   αυτό είναι ακριβώς η **γραμμή-σύνολο**, καθολικό μοτίβο κάθε πίνακα ποσοτήτων (το AutoCAD το
   λύνει με per-cell border overrides· μία παράκαμψη ανά γραμμή είναι απλούστερη και αρκεί).
3. **Το `TableBorderSpec` ζει στο μοντέλο, όχι στο στυλ.** Το χρειάζονται και τα δύο (το στυλ για
   τις κλάσεις, το μοντέλο για τη γραμμή-σύνολο)· ένας ορισμός, το `table-style.ts` τον
   επανεξάγει. Αλλιώς `types/table.ts` → `table-style.ts` γινόταν κύκλος εισαγωγών.

### 16.3 Ο χαρακτηρισμός — τραβήχτηκε στη Φάση Α

`__tests__/adr622-absorption-characterization.test.ts` — **10 snapshots** (2.042 γραμμές, 142
text + 11 line primitives) και των **έξι** καταναλωτών: 4 detail-sheet schedules + το τοπογραφικό
φύλλο (ADR-650 M7) + 4 title blocks + η αυτόματη πινακίδα (ADR-651).

**Mutation-verified**, γιατί πράσινα snapshots δεν αποδεικνύουν από μόνα τους ότι κάτι μετριέται:
- `ROW_H_MM 7.5 → 7.6` στο `detail-sheet-schedule-table.ts` ⇒ **5/10 κόκκινα** (ακριβώς τα
  schedule· τα field-block έμειναν πράσινα — έχουν δικό τους `ROW_H_MM = 7`).
- `LABEL_HEX #555555 → #555556` στο `detail-sheet-field-block.ts` ⇒ **5/10 κόκκινα** (η άλλη πλευρά).

Και τα δύο mutations αναιρέθηκαν· τα δύο αρχεία του ADR-622 είναι **αναλλοίωτα** σε αυτή τη φάση.

### 16.4 Τι ρητά ΔΕΝ υπόσχεται το preset `detailSheet`

**Byte-identical έξοδο.** Ο σημερινός ADR-622 τοποθετεί τις δύο οριζόντιες γραμμές του
**baseline-relative** (`y - ROW_H_MM * 0.2`), όχι στις ακμές των κελιών· η γενική μηχανή τις βάζει
στις **ακμές** (σωστό, και συμβατό με τα DXF group codes του §5). Η γεφύρωση είναι δουλειά του
adapter της **Φ.Β**, με το δίχτυ χαρακτηρισμού στο χέρι — **όχι εικασία στη Φ.Α**. Το preset
κρατά τις τιμές (`7.5` / `2.6` / `#222222` / `#999999` / `0.15mm` / `4mm`), κλειδωμένες με tests.

### 16.5 Απόδοση — τι μπήκε από τώρα

- `visibleRowRange(layout, top, bottom)` → δυαδική αναζήτηση στο αύξον `yMm`: **O(log n + ορατές)**.
  Επαληθεύεται έναντι γραμμικής σάρωσης σε 36 διαφορετικά παράθυρα (η επιτάχυνση δεν αλλάζει απάντηση).
- Οι ακμές πλέγματος **ενώνονται**: πίνακας 2×3 δίνει **7** τμήματα αντί για 24 ακμές κελιών.
- Η διάταξη είναι καθαρή συνάρτηση ⇒ ασφαλώς απομνημονεύσιμη· ποτέ ανά frame (§6).

### 16.6 Έλεγχοι

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `bim/table` unit tests | **43/43** ✅ (27 layout + 16 registry) |
| `detail-sheet` (όλα, μαζί με τον χαρακτηρισμό) | **20 suites / 144 tests / 10 snapshots** ✅ |
| `npm run jscpd:diff` (N.18, CHECK 3.28) | ✅ καθαρό — κανένα sibling clone στα 10 νέα αρχεία |
| N.7.1 (500 γρ./αρχείο) | ✅ μέγιστο 274 γρ. (`types/table.ts`, εξαιρούμενο ως types) |
| `npm run test:registry-golden` | ⚠️ 101/102 — η μία αποτυχία είναι στο module **`date-local`** και **προϋπάρχει στο HEAD** (επαληθεύτηκε με stashed registry)· άσχετη με το ADR-739 |

---

## 17. Φάση Β — η απορρόφηση του ADR-622 (2026-07-31)

**Αποτέλεσμα: byte-identical, 10/10 snapshots — και χωρίς καμία παραχώρηση στη μηχανή.**

### 17.1 Το «quirk» δεν υπήρχε

Το §16.4 προειδοποιούσε ότι ο ADR-622 τοποθετεί τις δύο γραμμές του **baseline-relative**
(`y - ROW_H_MM * 0.2`), σχήμα που δεν εκφράζεται με ακμές κελιών, και ότι η γεφύρωση θα
γινόταν στη Φ.Β **με μέτρηση**. Η μέτρηση έδωσε καλύτερη απάντηση από την αναμενόμενη:

> **Δεν ήταν quirk τοποθέτησης γραμμής. Ήταν κοντύτερη γραμμή κεφαλίδας (6mm αντί 7.5)
> συν κείμενο δεδομένων που κάθεται 1,5mm χαμηλότερα μέσα στη γραμμή του** — δηλαδή δύο
> απολύτως συνηθισμένες ιδιότητες πίνακα, που το γενικό μοντέλο ήδη εξέφραζε.

Αλγεβρική ταύτιση, για κάθε γραμμή δεδομένων N:

```
  ADR-622 : 7.5 + 7.5(N-1) + 2.6         = 7.5N + 2.6
  μοντέλο : 6   + 7.5(N-1) + 1.5 + 2.6   = 7.5N + 2.6   ✓
  γραμμή#1: ακμή κάτω από κεφαλίδα ύψους 6            = y+6   ≡ 7.5 - 1.5   ✓
  γραμμή#2: ακμή μετά από 6 + n×7.5                   = 6+7.5n ≡ (7.5+7.5n) - 1.5 ✓
```

Το εύρημα ζει ως `DETAIL_SHEET_BASELINE_INSET_MM` / `DETAIL_SHEET_HEADER_HEIGHT_MM` στο
preset, με την απόδειξη σε σχόλιο, και ελέγχεται από δύο tests (ένα ανά σκέλος της
ταυτότητας). **Η γενική μηχανή έμεινε ανέπαφη** — κανένα `borderOffsetMm`, καμία ειδική
περίπτωση, καμία σημαία «λειτουργία συμβατότητας».

### 17.2 Οι τρεις μεταφράσεις του adapter

| # | Τι μεταφράζεται | Πώς |
|---|---|---|
| 1 | **`frac` (άγκυρα) → πλάτη στηλών** | `resolveColumnEdges`: `align:'left'` κλειδώνει το αριστερό όριο στην άγκυρα, `'right'` το δεξί. Κανένα κελί δεν κλειδώνει και τα δύο ⇒ κάποια ενδιάμεσα όρια μένουν **αδιόριστα**, και σωστά: δεν επηρεάζουν ούτε ένα glyph. Γεμίζουν με γραμμική παρεμβολή |
| 2 | **Οι δύο γραμμές** | §17.1 — ζει ολόκληρο στο preset, μηδέν κώδικας στον adapter |
| 3 | **Τα footers (ρ, α)** | **Δεν είναι πίνακας** — ελεύθερες γραμμές κειμένου κάτω από αυτόν. Παράγονται ως έχουν· θα χρειάζονταν πλασματική στήλη μόνο για να χωρέσουν |

### 17.3 Η μία πραγματική έκπληξη

Τα footers έβγαιναν **1,5mm χαμηλά** (4/10 snapshots κόκκινα στην πρώτη εκτέλεση). Αιτία:
το `y` που ο ADR-622 κρατούσε στον βρόχο του δεν ήταν η **ακμή** της γραμμής — ήταν η
**γραμμή περιεχομένου** (`baseline = y + TEXT_MM`), και από εκεί μετρούσε το κενό. Στο νέο
μοντέλο η ίδια θέση είναι «κορυφή γραμμής + κατακόρυφο περιθώριο». Μία γραμμή διόρθωση.

Αξίζει σημείωση: **αυτό δεν θα το έπιανε καμία επιθεώρηση κώδικα.** Το έπιασε το δίχτυ που
γράφτηκε στη Φ.Α — και είναι η δικαίωση της απόφασης να τραβηχτεί ο χαρακτηρισμός νωρίτερα.

### 17.4 Νέο αρχείο — η γέφυρα προς τα τρία backends

`bim/table/table-layout-to-primitives.ts`: `TableLayout` → `DetailPrimitive[]`. Ο
`DetailPrimitive` είναι ήδη η κοινή γλώσσα των τριών ζωγράφων που υπάρχουν (canvas / PDF /
σκηνή), οπότε ο πίνακας τους απέκτησε **χωρίς να γραφτεί νέος ζωγράφος**. Το τέταρτο
backend (DXF `ACAD_TABLE`, Φ.Ε) θα διαβάσει το `TableLayout` απευθείας — εκεί ο πίνακας
είναι first-class και η αποδόμηση σε γραμμές+κείμενο θα ήταν απώλεια.

Η **σειρά** εξόδου («ανά γραμμή: πάνω ακμή → κελιά· μετά η κάτω ακμή· μετά οι κατακόρυφες»)
αναπαράγει ακριβώς το z-order του ADR-622 και ελέγχεται ρητά — ο χαρακτηρισμός μόνος του θα
έδειχνε απλώς «κάτι άλλαξε», όχι *τι*.

### 17.5 Τι ΔΕΝ απορροφήθηκε — και γιατί

**Το `buildFieldBlock` έμεινε ως έχει** (συνειδητή απόφαση, όχι παράλειψη). Το εύρος που
ορίζουν το §3 Αρχή 2 και το §13 είναι το `buildScheduleTable`. Το `buildFieldBlock` είναι
78 γραμμές που παράγουν λίστα `label : value` — χωρίς στήλες, κελιά, πλέγμα ή συγχωνεύσεις·
δεν είναι δεύτερη *μηχανή πίνακα*, είναι μια στοιχισμένη λίστα. Το πέρασμά της από τη
μηχανή πίνακα θα απαιτούσε per-cell override σε κάθε τιμή (χρώμα + έντονο) για μηδέν
όφελος. **Αν το θέλεις, γίνεται — αλλά ως ρητή απόφαση, όχι ως σιωπηλή επέκταση εύρους.**

### 17.6 Έλεγχοι

| Έλεγχος | Αποτέλεσμα |
|---|---|
| Χαρακτηρισμός ADR-622 (τα 6 αρχικά snapshots) | **10/10 byte-identical** ✅ — και η απόδειξη είναι στέρεη: στην 1η εκτέλεση 4 απέτυχαν, άρα δεν ξαναγράφτηκαν σιωπηλά |
| `bim/table` unit tests | **50/50** ✅ (28 layout + 16 registry + 6 γέφυρα) |
| Πλήρες regression `bim` + `topography` + `text-engine` | **1232/1233 suites · 13.987 tests** ✅ |
| Η 1 αποτυχία | `topo-planimetric-points` (3 tests, κάλυψη υψομέτρων) — **προϋπάρχει**· επαληθεύτηκε με stash του adapter: ίδιες 3 αποτυχίες και με τον παλιό ADR-622 |
| `npm run jscpd:diff` (N.18) | ✅ καθαρό |
| N.7.1 | ✅ μέγιστο 312 γρ. (`detail-sheet-schedule-table.ts`) |


---

## 18. Φάση Γ — οντότητα + απόδοση 2Δ (2026-07-31)

Ο πίνακας είναι πλέον **οντότητα σκηνής**: μπαίνει στο `EntityType`, ζωγραφίζεται στον κύριο
2D καμβά, επιλέγεται, μετακινείται, περιστρέφεται, έχει λαβές και εξάγεται. Και τα **9 gates**
του §12 απαντήθηκαν — **24 anchor suites / 384 tests πράσινα**.

### 18.1 Τα αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `types/table-entity.ts` **(νέο)** | `TableEntity` + `TableEntityGeometry` + `isTableEntity` + ελάχιστα |
| `bim/table/table-entity-geometry.ts` **(νέο)** | Οι **τρεις** μετατροπές: mm→κόσμος, αναστροφή y, περιστροφή· απομνημονευμένη διάταξη |
| `bim/table/table-entity-hit.ts` **(νέο)** | `hitTestTable` + `calculateTableBounds` — ΕΝΑ SSoT, τρεις καταναλωτές |
| `bim/table/table-entity-grips.ts` **(νέο)** | `getTableGrips` + `applyTableGripDrag` (move / rotation / όριο στήλης) |
| `bim/table/table-render-index.ts` **(νέο)** | Ευρετήριο ορατότητας περιγραμμάτων (δυαδικό ανά καρέ) |
| `rendering/entities/TableRenderer.ts` **(νέο)** | Το φύλλο· καμία συνδρομή σε store, καμία διάταξη μέσα του |
| `rendering/entities/table/stamp-table-layout.ts` **(νέο)** | Ο καμβάς-backend (γεμίσματα / πλέγμα / κείμενο + LOD) |
| `export/core/table-to-primitives.ts` **(νέο)** | `decomposeTable` — γραμμές + κείμενα, μέσω της γέφυρας της Φ.Β |
| `hooks/grips/grip-table-commit.ts` **(νέο)** | Commit λαβής μέσω του κοινού `commitParametricAnnotationGripDrag` |

Τροποποιημένα (τα gates): `types/base-entity.ts` · `renderable-entity-type.ts` ·
`entity-render-contract.ts` · `entity-type-descriptor.ts` · `entity-export-coverage.ts` ·
`dxf-export.types.ts` · `entity-renderer-registry.ts` · `EntityRendererComposite.ts` ·
`Bounds.ts` + `bounds-annotation.ts` + `entity-bounds-ssot.ts` · `hit-test-entity-tests.ts` ·
`hit-test-model-dxf.ts` · `dxf-types.ts` + `dxf-renderer-entity-model.ts` ·
`dxf-scene-entity-handlers.ts` · `grip-kinds*.ts` + `grip-computation-producers.ts` +
`grip-parametric-dispatch.ts` · `apply-parametric-annotation-preview.ts` ·
`move-entity-geometry.ts` · `rotation-math.ts` · `annotation-to-primitives.ts` · `entities.ts`.

### 18.2 Τέσσερις αποκλίσεις από το §12 — και ο λόγος καθεμιάς

1. **`angleRad`, όχι `rotation`** (το §4 έγραφε `rotation: number`). Ίδιο όνομα με τα δύο αδέλφια
   (`ScaleBarEntity` / `OpeningInfoTagEntity`), ώστε οι **κοινοί** μηχανισμοί
   (`rotateEntityGripDrag`, `commitParametricAnnotationGripDrag`, το ghost) να διαβάζουν ένα
   όνομα σε όλες τις σημειώσεις. Η μονάδα είναι στο όνομα — το μάθημα του ADR-716.

2. **`dxf: 'decompose'`, όχι `'native'`.** Το §12 περιέγραφε την κατάσταση **μετά τη Φ.Ε**: ο
   writer του `ACAD_TABLE` δεν υπάρχει ακόμη. Δηλωμένο `native` χωρίς writer σημαίνει ότι ο
   πίνακας **χάνεται σιωπηλά** στην εξαγωγή — ακριβώς το σφάλμα που ο πίνακας κάλυψης υπάρχει
   για να αποτρέπει. Το `decompose` **δεν** είναι προσωρινό: το §10 το απαιτεί ούτως ή άλλως
   ως fallback για στόχους πριν την R2004, άρα ο κώδικας επιβιώνει αυτούσιος μετά τη Φ.Ε.

3. **Ο πίνακας απέκτησε `ROTATE_HANDLERS` entry — πρώτος της οικογένειας σημειώσεων.** Τα
   `scale-bar` / `opening-info-tag` είναι σκόπιμα no-op εκεί (περιστρέφονται μόνο από τη λαβή
   τους). Για τον πίνακα αυτό θα σήμαινε ότι η **εντολή ROTATE δεν κάνει τίποτα** σε ένα
   προφανώς περιστρεφόμενο αντικείμενο. Κόστος: δύο αριθμοί (η διάταξη είναι αναλλοίωτη ως προς
   την περιστροφή).

4. **Ρητό 2D ghost branch**, αν και το §12 λέει «ghost: όχι». Τα δύο δεν συγκρούονται: το «όχι»
   του §12 αφορά το **`placementGhost3D`** του render contract (και είναι `false`). Το 2D
   preview-ghost είναι άλλο seam — και ο πίνακας έχει παραμετρικές λαβές, οπότε χωρίς branch το
   σύρσιμο ορίου στήλης δεν θα έδειχνε **τίποτα** μέχρι το commit (η ασυμμετρία που ο ADR-662
   §13 έκλεισε για την τοπογραφική επιφάνεια όταν εκείνη απέκτησε λαβές).

### 18.3 Μονάδες — ο πίνακας είναι **annotative**

Η διάταξη είναι sheet-mm, η άγκυρα μονάδες σκηνής, και η γέφυρα είναι **αποκλειστικά** το
`paperHeightToModel(1, drawingScale, sceneUnits)` — το ΙΔΙΟ SSoT που ήδη διπλώνει το πάχος του
scale-bar και το ύψος κάθε διαστασιολόγησης. Καμία άλλη πολλαπλασιαστική μετατροπή (§4.1).

⚠️ **Η λανθάνουσα μνήμη διάταξης ΔΕΝ κλειδώνεται στο `drawingScale`** — και αυτό είναι η αιτία
που ένα zoom ή μια αλλαγή 1:100→1:50 δεν ξαναϋπολογίζει τίποτα: η διάταξη είναι **αναλλοίωτη**
ως προς την κλίμακα· η κλίμακα μπαίνει μόνο ως πολλαπλασιαστής στο τέλος.

### 18.4 Απόδοση — τι τηρείται και γιατί

- **Διάταξη ποτέ ανά καρέ.** `WeakMap` με κλειδί την **ταυτότητα** του `TableModel`: το μοντέλο
  είναι `readonly`, άρα αλλαγή περιεχομένου ⇒ νέο αντικείμενο ⇒ φυσική ακύρωση, χωρίς
  χειροκίνητο `invalidate()` που κάποιος θα ξεχνούσε να καλέσει.
- **Ορατές γραμμές δυαδικά** (`visibleRowRange`) **και ορατά περιγράμματα δυαδικά**
  (`visibleHorizontals`). Το δεύτερο χρειάστηκε δικό του ευρετήριο: τα `layout.borders` είναι
  **μεικτά** (οριζόντιες αύξουσες, μετά κατακόρυφες) ⇒ δυαδική αναζήτηση πάνω τους θα ήταν λάθος.
- **Το παράθυρο υπολογίζεται αντιστρέφοντας τις 4 γωνίες του καμβά** στο πλαίσιο του πίνακα.
  Απλή σύγκριση σε `y` θα έκοβε ορατές γραμμές σε στραμμένο πίνακα («λείπουν γραμμές όταν τον
  γυρίζω»).
- **Το πλήθος λαβών ΔΕΝ είναι ανάλογο των δεδομένων**: move + rotation + μία ανά **εσωτερικό**
  όριο στηλών. Λαβές ύψους γραμμής θα σήμαιναν 500 λαβές σε πίνακα 500 γραμμών, ζωγραφισμένες
  **και** hit-tested ανά καρέ — το σχήμα που πλήρωσε ο ADR-735. Το ύψος γραμμής αλλάζει από τον
  επεξεργαστή κελιού της **Φ.Δ**, όπου υπάρχει **μία** επιλεγμένη γραμμή (μοτίβο Excel/Figma).
- **LOD κειμένου**: κάτω από 5px ύψος κεφαλαίου το κείμενο δεν ζωγραφίζεται· το πλέγμα μένει.

### 18.5 Τι ρητά **δεν** κάνει η Φ.Γ

| Θέμα | Πού ανήκει | Γιατί όχι εδώ |
|---|---|---|
| ~~**Σειριοποίηση** (`model.cells` = `Map`, δεν επιβιώνει `JSON.stringify`)~~ | ~~Φ.Δ~~ | ✅ **ΕΚΛΕΙΣΕ στη Φ.Δ βήμα 1** (§19.2, Λύση Α): το `TableEntity.model` είναι πλέον `PersistedTableModel` — απλό JSON, κελιά ως ακολουθία τριάδων. **Ο πίνακας επιβιώνει reload / undo / πρόχειρο.** Η προειδοποίηση που στεκόταν εδώ («μην υποθέσεις ότι ένας πίνακας επιβιώνει reload») **δεν ισχύει πια** |
| Εργαλείο δημιουργίας | ~~Φ.Δ~~ | ✅ **ΕΚΛΕΙΣΕ στη Φ.Δ βήμα 1** (§19.5): κουμπί κορδέλας + `TABLE`/`TB` + τοποθέτηση με ένα κλικ + WYSIWYG φάντασμα |
| Επεξεργαστής κελιού / πλοήγηση πληκτρολογίου / καρτέλα ribbon | Φ.Δ **βήματα 2-3** | §13 — η Φ.Γ κλείνει αυτοτελώς· βλ. §19.7 για το τι μένει ανοιχτό μετά το βήμα 1 |
| `SCALE` εντολή | Φ.Δ | Η κλιμάκωση πίνακα σημαίνει «άλλαξε πλάτη στηλών και ύψη κειμένου» — **σημασιολογία επεξεργασίας**, όχι γεωμετρικός μετασχηματισμός. Σήμερα πέφτει στο no-op default του `scale-entity-transform` |
| Table breaking | Φ.Δ | Δηλωμένο στο μοντέλο από τη Φ.Α· ο καταναλωτής έρχεται με το εργαλείο |
| `ACAD_TABLE` native | Φ.Ε | §18.2 απόκλιση 2 |

### 18.6 Έλεγχοι

| Έλεγχος | Αποτέλεσμα |
|---|---|
| **Τα 9 gates / capability anchors** | **24 suites / 384 tests** ✅ |
| `bim/table` unit tests | **92/92** ✅ (50 Φ.Α/Β + 23 γεωμετρία + 19 αλληλεπίδραση) |
| **Μεταλλάξεις** (αναστροφή y · αντίστροφη περιστροφή · μετατροπή ανοχής · επιλογή στήλης · θέση λαβής περιστροφής) | **5/5 σκοτώθηκαν** ✅ |
| Regression `rendering`+`export`+`hooks/grips`+`services`+`utils`+`canvas-v2`+`systems/scale` | **284 suites / 3.300 tests** ✅ |
| Regression `core`+`types`+`app`+`bim` | **1.229 suites / 13.614 tests** ✅ |
| `npm run jscpd:diff` (N.18) | ✅ καθαρό στα 9 νέα αρχεία |
| `npm run validate:i18n` | ✅ 30.114/30.114 EL+EN (**η Φ.Γ δεν χρειάστηκε νέα κλειδιά** — το UI είναι Φ.Δ) |
| N.7.1 | ✅ μέγιστο **247** γρ. (`table-entity-geometry.ts`)· συναρτήσεις ≤40 |

🔴 **Η μετάλλαξη που ΕΠΕΖΗΣΕ στην πρώτη εκτέλεση** (και το μάθημά της): η μετατροπή της ανοχής
hit-test από μονάδες σκηνής σε sheet-mm ήταν **αδοκίμαστη**, επειδή όλα τα tests έτρεχαν σε
**1:1**, όπου η μετατροπή είναι ταυτοτική. ⇒ **Ένα test σε ουδέτερη κλίμακα δεν ελέγχει την
κλίμακα.** Προστέθηκε ρητό test σε 1:100· η μετάλλαξη πεθαίνει πλέον.

---

## 19. Φάση Δ βήμα 1 — δημιουργία + σειριοποίηση (2026-07-31)

Ο πίνακας **γεννιέται** από την κορδέλα με ένα κλικ και **επιβιώνει** αποθήκευση, αναίρεση
και πρόχειρο. Είναι το **πρώτο από τα τέσσερα βήματα** της Φ.Δ (§13): εργαλείο +
σειριοποίηση. Ο επεξεργαστής κελιού, η πλοήγηση με πληκτρολόγιο, η επικόλληση TSV/CSV και η
contextual καρτέλα της ribbon είναι τα βήματα 2-4 και **δεν** έγιναν (§19.7).

Η σειρά δεν είναι τυχαία: μέχρι σήμερα ο πίνακας ζωγραφιζόταν σωστά και **χανόταν
σιωπηλά** στο πρώτο reload (§18.5). Εργαλείο δημιουργίας πάνω σε οντότητα που δεν επιβιώνει
θα ήταν εργοστάσιο πτωμάτων — η σειριοποίηση έπρεπε να κλείσει **πριν** το κλικ γίνει
προσβάσιμο στον χρήστη.

### 19.1 Τα αρχεία

**Νέα production:**

| Αρχείο | Ρόλος |
|---|---|
| `types/json-safe-entity.ts` **(νέο)** | **Φρουρός 1** — `JsonSafe<T>` / `IsJsonSafe` / `JsonUnsafeKeys` / `AssertJsonSafe` / `AssertNotJsonSafe`. Καμία οντότητα σκηνής δεν επιτρέπεται να γίνει μη-σειριοποιήσιμη, ούτε στο μέλλον |
| `bim/table/build-table-entity.ts` **(νέο)** | Το **εργοστάσιο** ενός νέου πίνακα (σχήμα → στήλες/γραμμές/σπαρμένα κελιά/συγχώνευση τίτλου) **και το φράγμα** των τριών μεγεθών (`sanitizeTable*`) |
| `state/table-options-store.ts` **(νέο)** | zustand store των τριών επιλογών + **το ΕΝΑ mapping** `buildTableEntityFromLiveOptions` που τρέφει ghost **και** commit |
| `hooks/drawing/drawing-entity-xline.ts` **(νέο)** | **Δεν είναι πίνακας.** Απόσπαση N.7.1 του `case 'xline'` από το `drawing-entity-builders.ts` ώστε να χωρέσει το `case 'table'` — μηδέν αλλαγή συμπεριφοράς (κάθε `break` του παλιού `case` κατέληγε στο ίδιο `return null`) |
| `ui/ribbon/components/buttons/table-icon-glyph.tsx` **(νέο)** | Η γλυφή πλέγματος, αποσπασμένη από το `RibbonButtonIcon.tsx` (ίδιος λόγος N.7.1). Έντονη γραμμή κεφαλίδας ⇒ διακρίνεται από «σχήμα πλέγματος» |

**Τροποποιημένα τύπων / βοηθών:** `types/table.ts` (**+`PersistedTableModel`** — ο
`TableModel` **ανέγγιχτος**) · `types/table-entity.ts` (`model: PersistedTableModel`) ·
`bim/table/table-model-helpers.ts` (`resolveTableModel` / `toPersistedTableModel` + η
ανάνηψη παλιού σχήματος + logger) · `table-entity-geometry.ts` + `table-entity-grips.ts`
(περνούν από το `resolveTableModel` πριν αγγίξουν τη μηχανή διάταξης).

**Τα 8 σημεία καταχώρησης του εργαλείου** (κανένα δεν είναι προαιρετικό — ένα που λείπει
δίνει κουμπί που δεν κάνει τίποτα):

| Σημείο | Τι δηλώνει |
|---|---|
| `core/state-machine/interfaces.ts:283` | `minPoints: 1, maxPoints: 1, allowsContinuous: false` |
| `systems/tools/tool-definitions.ts:318,451` | metadata εργαλείου + χάρτης `tool → entityType` |
| `systems/command-line/CommandAliasRegistry.ts:219` | `TABLE`, `TB` |
| `ui/toolbar/types.ts:319` | `'table'` στην ένωση των εργαλείων σχεδίασης |
| `hooks/drawing/drawing-tool-classification.ts:41` | εργαλείο **ενός κλικ** |
| `hooks/drawing/drawing-types.ts:182` + `drawing-entity-complete.ts:30` | υδραυλική συσσωρευτή σημείων (1 σημείο ⇒ ολοκλήρωση) |
| `hooks/drawing/drawing-entity-builders.ts:411` | ο builder της ολοκλήρωσης |
| `hooks/drawing/drawing-preview-generator.ts:347` | το WYSIWYG φάντασμα |
| `ui/ribbon/data/insert-tab.ts:367` + `RibbonButtonIcon.tsx:470` | το κουμπί + η γλυφή |

Παράλληλα: **10 κλειδιά i18n EL + 10 EN** γραμμένα **πριν** τον κώδικα (N.11) +
`generate:i18n-types` (`src/types/i18n.ts`, CHECK 3.33).

**Νέα test suites:** `bim/table/__tests__/build-table-entity.test.ts` (32) ·
`bim/table/__tests__/table-model-serialization.test.ts` (26) ·
`types/__tests__/entity-json-roundtrip-coverage.test.ts` (125). Ενημερώθηκε και το κοινό
fixture των capability anchors (`rendering/hitTesting/__tests__/renderable-entity-fixtures.ts`).

### 19.2 ΛΥΣΗ Α — «λίστα στο αρχείο, ευρετήριο στη μνήμη»

Ένας `Map` **δεν** επιβιώνει `JSON.stringify`: γίνεται `{}`. Χωρίς εξαίρεση, χωρίς
προειδοποίηση, χωρίς σφάλμα τύπου. Το `TableEntity.model` κρατούσε `TableModel`, του οποίου
το `cells` είναι `ReadonlyMap` — άρα κάθε πίνακας ξανάνοιγε με **άδειο πλέγμα**.

**Η λύση**: το `model` της οντότητας έγινε `PersistedTableModel`, όπου τα κελιά είναι
**ακολουθία τριάδων** `[rowId, colId, cell]`. Ο `TableModel` με τον `Map` παράγεται
**κατ' απαίτηση** από το `resolveTableModel` και είναι ό,τι εξακολουθούν να δέχονται η
μηχανή διάταξης και ο adapter του ADR-622.

🔴 **Το `TableModel` δεν άλλαξε ούτε ένα byte.** Ο `Map` δεν είναι λάθος — είναι λάθος
*στο δίσκο*. Ένα ευρετήριο είναι δομή **μνήμης**· η μορφή που ταξιδεύει είναι λίστα. Αν
είχαμε «απλοποιήσει» τη μηχανή διάταξης σε αντικείμενο-λεξικό, θα είχαμε πληρώσει O(n)
αναζήτηση σε κάθε κελί για να λύσουμε πρόβλημα που δεν είναι δικό της.

**Προηγούμενο αγοράς** — κανείς σοβαρός δεν σειριοποιεί χάρτη:

| Φορμά | Τι γράφει |
|---|---|
| `ACAD_TABLE` (Autodesk) | **ακολουθιακές εγγραφές κελιών**, group code 171 ανά κελί |
| Kiwi (Figma) | **δεν διαθέτει καν τύπο χάρτη** — μόνο λίστες και structs |
| OOXML `sheetData` | `<row>` → `<c r="A1">`, ακολουθία |
| Google Sheets API | `rowData[].values[]`, ακολουθία |

**Γιατί ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ σειρά** (`toPersistedTableModel`: γραμμή, μετά στήλη — όπως τις
ορίζουν τα `rows`/`columns`, όχι όπως έτυχαν στον `Map`): η σειρά εισαγωγής θα έδινε
**διαφορετικό JSON για ταυτόσημο περιεχόμενο**. Συνέπειες κατά σειρά σοβαρότητας: άχρηστα
diffs, ασταθή snapshots και — το χειρότερο — **ψευδείς «αλλαγές» που πυροδοτούν auto-save**
σε πίνακα που κανείς δεν άγγιξε. Η ταυτότητα του αντικειμένου είναι η έκδοσή του (§19.3),
οπότε αστάθεια στη σειριοποίηση σημαίνει αστάθεια σε ολόκληρη την αλυσίδα.

#### 🔴 Η διόρθωση: οι μηχανισμοί είναι **ΤΡΕΙΣ**, όχι πέντε

Ο αρχικός ισχυρισμός («πέντε γενικοί μηχανισμοί περνούν κάθε οντότητα από JSON round-trip»)
ήταν **λάθος σε δύο σκέλη**. Οι πραγματικοί είναι τρεις:

| # | Μηχανισμός | Θέση |
|---|---|---|
| 1 | Αποθήκευση / επαναφόρτωση σκηνής | `services/dxf-firestore-storage.impl.ts:169` — `JSON.stringify(scene, null, 0)` |
| 2 | Αναίρεση ενημέρωσης | `core/commands/UpdateEntityCommand.ts:38` — `deepClone(entity)` |
| 3 | Διαγραφή + αναίρεση | `core/commands/DeleteEntityCommand.ts:169,301` — `deepClone(entity)` |

όπου `deepClone` **είναι** `JSON.parse(JSON.stringify())` (`src/lib/clone-utils.ts:19`).

Τα δύο που **έμοιαζαν** γενικά και δεν είναι:

- **Πρόχειρο** (`systems/clipboard/EntityClipboardStore.ts:30-37`): κλωνοποιεί με
  `structuredClone`, που **διατηρεί** τον `Map`. Το `JSON.parse(JSON.stringify())` εκεί είναι
  `else`-fallback για runtime **χωρίς** το global `structuredClone` — δεν συμβαίνει ούτε σε
  browser ούτε σε Node 20+.
- **Λανθάνουσα μνήμη ζωγραφικής** (`rendering/passes/EntityPass.ts:435-437`, `getCacheKey`):
  (α) **νεκρός κώδικας** — το `RenderPipeline` που τον κατασκευάζει δεν καλείται από πουθενά
  στην παραγωγή· ο μόνος καταναλωτής είναι το barrel `rendering/passes/index.ts`, του οποίου
  η κεφαλίδα αυτοχαρακτηρίζεται «DEADCODE»· (β) ακόμη κι αν ζούσε, το `JSON.stringify` εκεί
  είναι **κλειδί μνήμης**, όχι αποθήκευση: ένας `Map` που γίνεται `{}` δίνει μπαγιάτικο
  cache key, όχι χαμένα κελιά.

**Γιατί έχει σημασία** — δύο λόγοι, και ο δεύτερος είναι ο σοβαρός:

1. Το «πέντε» ήταν **αριθμός που ταξίδεψε χωρίς να ανοίξει κανείς τα αρχεία** — ακριβώς το
   σχήμα που το ίδιο το repo έχει πληρώσει τρεις φορές (το `0` του N.11 που σημαίνει «κανείς
   δεν κοίταξε», το `unprotected: 0` του N.12, το «91» που μπαγιάτεψε δύο μήνες και
   αντιγράφηκε σε handoff → ανάλυση → συμπέρασμα). Ένα ADR που φουσκώνει τον κίνδυνο για να
   δικαιολογήσει τη λύση του υπονομεύει κάθε άλλο νούμερο που γράφει.
2. **Επιχειρησιακά**: αν το πρόχειρο ήταν όντως ένοχο, η αντιγραφή-επικόλληση πίνακα θα
   έχανε κελιά. **Δεν τα χάνει.** Ο επόμενος που θα διάβαζε «πέντε» είτε θα κυνηγούσε
   σφάλμα που δεν υπάρχει, είτε — χειρότερα — θα «διόρθωνε» το πρόχειρο σε `JSON` για
   ομοιομορφία και θα **δημιουργούσε** το σφάλμα που ο ADR υπόσχεται ότι έκλεισε.

Ο σωστός αριθμός και οι δύο εξαιρέσεις με το σκεπτικό τους ζουν πλέον στο docstring του
`types/json-safe-entity.ts` — εκεί που θα τα δει όποιος αγγίξει τον φρουρό.

#### Ανάνηψη παλιού σχήματος — «είτε σωστά, είτε φωναχτά· ποτέ σιωπηλά άδειος»

Ο τύπος δεν φυλάει την πόρτα: το μοντέλο φτάνει στο `createTableModel` και από `JSON.parse`
παλιάς σκηνής, και από μπαγιάτικο fixture. Δύο **πραγματικά** σχήματα περνούσαν:

- `{}` (το πτώμα ενός `Map`) → `TypeError: not iterable` **μέσα στο render pass** ⇒ μία
  χαλασμένη οντότητα έριχνε **ολόκληρο** το καρέ, όχι μόνο τον πίνακά της.
- πραγματικός `Map` → **τίποτα**. Ο iterator του δίνει ζεύγη μήκους 2, η αποδόμηση της
  τριάδας έβγαζε `cell === undefined`, και **όλα τα κελιά εξαφανίζονταν σιωπηλά**. Ο κώδικας
  που γράφτηκε για να σκοτώσει τη σιωπηλή απώλεια την αναπαρήγαγε.

Απόφαση: κάθε μη-κανονικό σχήμα είτε **ανακτάται ρητά** (και το καταγράφει ως `error` — ο
καλών παραβιάζει ακόμα τη Λύση Α και πρέπει να διορθωθεί, όχι να παρηγορηθεί), είτε
καταγράφεται με το τι χάθηκε. **Ποτέ `throw`**: μία χαλασμένη οντότητα δεν ρίχνει το καρέ
των υπόλοιπων. Κόστος: το `table-model-helpers.ts` δεν είναι πια «μηδέν εξαρτήσεις» — απέκτησε
τον κεντρικό `createModuleLogger` (`@/lib/telemetry`), και το docstring του το λέει.

### 19.3 Η αλυσίδα των τριών μνημών

```
PersistedTableModel  ──resolveTableModel──▶  TableModel  ──resolveTableLayout──▶  TableLayout
  (ταυτότητα = έκδοση)      WeakMap                          WeakMap (Φ.Γ)
```

1. **`PersistedTableModel` — η ταυτότητα ΕΙΝΑΙ η έκδοση.** Κάθε πεδίο `readonly`, άρα κάθε
   αλλαγή περιεχομένου παράγει **νέο αντικείμενο**. Δεν είναι στιλιστική επιλογή: είναι ο
   μηχανισμός ακύρωσης όλων των μνημών κάτω από αυτό.
2. **`RESOLVED_MODEL_CACHE`** (`WeakMap<PersistedTableModel, TableModel>`,
   `table-model-helpers.ts:328`).
3. **`LAYOUT_CACHE`** (`resolveTableLayout`, Φ.Γ).

Σταθερό `PersistedTableModel` ⇒ σταθερό `TableModel` ⇒ σταθερή διάταξη. Άρα το **«διάταξη
ποτέ ανά καρέ»** του §6 / §18.4 εξακολουθεί να ισχύει **ακέραιο**, παρότι η οντότητα κρατά
πλέον απλό JSON. Αν η αλυσίδα έσπαγε σε οποιονδήποτε κρίκο, η Λύση Α θα είχε αγοράσει
σειριοποίηση με το κόστος πλήρους διάταξης ανά καρέ — ανταλλαγή που κανείς δεν θα έκανε
συνειδητά.

🔴 **Γιατί ΚΑΜΙΑ `invalidate()`** — και είναι το κρίσιμο σημείο: ένα χειροκίνητο
`invalidate()` είναι κάτι που κάποιος, κάποτε, **θα ξεχνούσε να καλέσει**, και η συνέπεια
δεν είναι crash αλλά πίνακας που δείχνει **παλιά κελιά χωρίς κανένα ίχνος**. Εδώ η ακύρωση
είναι φυσική συνέπεια της αμεταβλητότητας, όχι πειθαρχία. Και επειδή είναι `WeakMap`, όταν
πεθάνει το persisted πεθαίνει και το παράγωγο — μηδέν διαρροή σε σκηνή με χιλιάδες αναιρέσεις.

**Η μονοθέσια μνήμη του `buildTableModel`** (`build-table-entity.ts:264-295`) είναι ο
τέταρτος κρίκος και υπάρχει για ένα πολύ συγκεκριμένο σενάριο: το φάντασμα του εργαλείου
ξαναχτίζει την οντότητα σε **κάθε κίνηση ποντικιού**. Νέο αντικείμενο μοντέλου ανά καρέ ⇒
αστοχία **και στις δύο** `WeakMap` ⇒ **πλήρης διάταξη ανά καρέ** — ακριβώς το σχήμα που ο
**ADR-735** πλήρωσε σε παραγωγή. Ίδιο σχήμα + ίδια γλώσσα ⇒ **η ίδια αναφορά** ⇒ η αλυσίδα
κρατά. (Η γλώσσα είναι μέσα στο κλειδί επειδή τα σπαρμένα κελιά είναι μεταφρασμένο κείμενο.)

Η **κοινή αναφορά** ανάμεσα σε φάντασμα και committed οντότητα είναι ασφαλής **μόνο και
ακριβώς** επειδή το `PersistedTableModel` είναι `readonly` παντού: κάθε επεξεργασία κελιού
(βήμα 2) θα παράγει **νέο** αντικείμενο, οπότε δύο πίνακες δεν μπορούν ποτέ να «μοιραστούν»
μια αλλαγή. Χωρίς την αμεταβλητότητα η ίδια βελτιστοποίηση θα ήταν σφάλμα δεδομένων· με
αυτήν είναι η μόνη λογική επιλογή. ⚠️ Όποιος κάνει το `model` μεταβλητό στο βήμα 2 σπάει
**και τα δύο** ταυτόχρονα — και το πρώτο σιωπηλά.

### 19.4 Οι δύο φρουροί — τι φρουρούν και τι όχι

Το πρόβλημα δεν ήταν «ο πίνακας έχει `Map`»· ήταν «τίποτα δεν εμποδίζει μια οντότητα να
αποκτήσει `Map`». Η διόρθωση του πίνακα είναι **συνήθεια**· ο φρουρός είναι **εγγύηση**.
Ίδιο μάθημα με το ADR-650 §M10e (`dxf-scene-json.ts`): η λύση δεν ήταν «πρόσθεσε τα τέσσερα
πεδία που λείπουν» αλλά spread-then-override, ώστε **κανένα μελλοντικό πεδίο** να μη χαθεί
έτσι.

**Φρουρός 1 — χρόνος μεταγλώττισης** (`types/json-safe-entity.ts`). Η σειρά των κλάδων του
`JsonSafe<T>` **είναι** ο μηχανισμός: πρωτόγονα **πρώτα** (αλλιώς ένα branded string όπως
το `CellKey` θα χαρτογραφούνταν πάνω στα `keyof String` και θα απορριπτόταν — ψευδώς θετικό
σε κάτι απολύτως νόμιμο)· `ReadonlyMap`/`ReadonlySet`/`Date`/`RegExp`/`symbol`/`bigint`/
συναρτήσεις → `never`· πίνακες **πριν** αντικείμενα. Το `AssertNotJsonSafe` είναι η
**απόδειξη ότι ο φρουρός δουλεύει**: ένας έλεγχος που δεν έχει δείξει ποτέ κόκκινο δεν έχει
αποδείξει τίποτα.

🔴 **Τι ΔΕΝ φρουρεί σήμερα ο Φρουρός 1: τον εαυτό του.** Ο τύπος **δεν έχει επαληθευτεί με
`tsc`** — ο N.17 απαγορεύει στον πράκτορα να τρέξει type-check, και το
`src/subapps/dxf-viewer/**` είναι **εκτός** του root `tsconfig.json`, άρα ούτε το
`npm run typecheck` ούτε το pre-commit hook τον βλέπουν. Ο μόνος που θα τον δει είναι το
**CHECK 3.29 στο CI** (ADR-663, per-file ratchet vs `.dxf-tsc-baseline.json`) ή ο περιοδικός
έλεγχος του Giorgio. **Μέχρι τότε ο Φρουρός 1 είναι ισχυρισμός, όχι μετρημένο γεγονός** —
και αυτός ακριβώς είναι ο λόγος που δεν στηρίζεται σε αυτόν τίποτα.

**Φρουρός 2 — χρόνος εκτέλεσης**
(`types/__tests__/entity-json-roundtrip-coverage.test.ts`, **125 tests**). Είναι ο ισχυρός,
για έναν λόγο: **τρέχει**. Περνά κάθε ζωντανό `RENDERABLE_ENTITY_TYPE` από τον **πραγματικό**
μηχανισμό (`JSON.parse(JSON.stringify())` + `deepClone`) και δείχνει το **μονοπάτι** του
ενόχου (`entity.model.cells → Map`), όχι απλώς ότι «διαφέρουν».

- Ο πίνακας μπήκε στον **βρόχο του ζωντανού μητρώου** — το χωριστό «καρφωμένο κενό» fixture
  σβήστηκε: ένα δεύτερο αντίγραφο της λίστας θα μπαγιάτευε και θα έλεγε ψέματα με το πρώτο
  νέο entity type.
- **Πλήρης κάλυψη της ένωσης**: `NOT_COVERED_ENTITY_TYPES` είναι
  `as const satisfies readonly EntityType[]`, και ένας τύπος ολότητας απαιτεί το
  `Exclude<EntityType, RenderableEntityType | (typeof NOT_COVERED)[number]>` να είναι `never`.
  Νέος `EntityType` που δεν λογοδοτεί σε καμία από τις δύο λίστες ⇒ **δεν μεταγλωττίζεται**,
  με το όνομά του μέσα στο μήνυμα.
- Ο ανιχνευτής πιάνει και `NaN`/`Infinity` — **αλλοίωση τιμής που το σχήμα κρύβει** — και
  δεν πιάνει κοινή αναφορά DAG ως κύκλο (μηδέν ψευδώς θετικά· ένας φρουρός που κράζει σε
  νόμιμο κώδικα σβήνεται μέσα σε έναν μήνα).

**Τι δεν φρουρεί κανένας από τους δύο**: σκηνές που σώθηκαν **πριν** τη Φ.Δ. Εκείνα τα κελιά
χάθηκαν την ώρα της **εγγραφής** και κανείς δεν μπορεί να τα εφεύρει — γι' αυτό υπάρχει η
ανάνηψη του §19.2, που τουλάχιστον αφήνει **ίχνος** αντί για σιωπηλά άδειο πλέγμα.

### 19.5 Το εργαλείο — ένα κλικ, πάνω-αριστερή γωνία

**Το σημείο του κλικ είναι η ΠΑΝΩ-ΑΡΙΣΤΕΡΗ γωνία** (σύμβαση `ACAD_TABLE`), σε **ρητή
αντίθεση** με το αδελφό `opening-info-tag`, που αγκυρώνει στο **κέντρο**. Ο λόγος δεν είναι
αισθητικός: ο πίνακας **μεγαλώνει κάτω-δεξιά** καθώς προστίθενται γραμμές, οπότε άγκυρα στο
κέντρο θα τον **μετακινούσε σε κάθε νέα γραμμή**. Ο χρήστης που τοποθέτησε τον πίνακα σε ένα
σημείο του φύλλου θα τον έβρισκε αλλού μετά από τρεις καταχωρήσεις. Καμία εφαρμογή CAD δεν
το κάνει, και για τον ίδιο λόγο.

**Ένα mapping για ghost και commit.** Το `buildTableEntityFromLiveOptions`
(`table-options-store.ts:76`) είναι η **μοναδική** μετάφραση «ζωντανό store →
`BuildTableOptions` → οντότητα», και το καταναλώνουν **και οι δύο** διαδρομές:
`drawing-entity-builders.ts:411` (ολοκλήρωση) και `drawing-preview-generator.ts:347`
(φάντασμα). Καρφωμένο στα tests με **ταυτότητα αντικειμένου** — όχι «παράγουν το ίδιο
αποτέλεσμα» αλλά «είναι η ίδια συνάρτηση»: δύο αντίγραφα που σήμερα συμφωνούν είναι δύο
αντίγραφα που αύριο αποκλίνουν (N.18). Το φάντασμα ζωγραφίζεται από τον **πραγματικό**
`TableRenderer` (ADR-624 WYSIWYG): πραγματικές γραμμές, στήλες και σπαρμένα κελιά — όχι
σκίτσο ορθογωνίου που ψεύδεται για το τι θα πάρει ο χρήστης.

**4 σπαρμένα κελιά από τα 15** (τίτλος + 3 κεφαλίδες) — και εδώ **διαφέρουμε σκόπιμα από το
AutoCAD**, που δίνει κενό πλέγμα και ζητά από τον χρήστη να γράψει ο ίδιος τίτλο και
κεφαλίδες πριν κάνει οτιδήποτε άλλο, σε **κάθε** εισαγωγή. Excel, Google Sheets και Revit
δίνουν πάντα κεφαλίδες. Τα 4 από τα 15 είναι αρκετά ώστε ο πίνακας να είναι αμέσως χρήσιμος
και αρκετά αραιά ώστε να μένει **ειλικρινές δείγμα** του §4 («μόνο τα μη-κενά κελιά
ταξιδεύουν») — ένας πλήρως γεμάτος πίνακας θα έκρυβε ότι το `cells` είναι αραιό. Οι
κεφαλίδες είναι **τρεις**: αν ο χρήστης ζητήσει περισσότερες στήλες, οι επιπλέον μένουν
**κενές** — δεν υπάρχει γενικό όνομα για τέταρτη στήλη και μια αυτόματη «Στήλη 4» είναι
θόρυβος προς σβήσιμο. Το κείμενο μεταφράζεται **μία φορά** (`i18n.t` event-time) και μετά
ανήκει στο σχέδιο: αλλαγή γλώσσας δεν ξαναγράφει σχέδια που ήδη σώθηκαν.

**Το φράγμα των μεγεθών** (`build-table-entity.ts:133-183`, `table-options-store.ts:60-63`).
`parseFloat('')` **είναι** `NaN` — αυτό ακριβώς παράγει ένα αριθμητικό πεδίο που ο χρήστης
άδειασε με backspace· δεν είναι σενάριο επίθεσης, είναι η Τρίτη το πρωί. Οι τρεις συνέπειες
ήταν άνισες σε σοβαρότητα:

| Είσοδος | Τι έσπαγε |
|---|---|
| `columnWidthMm: NaN` | NaN bbox — και επειδή το `entity-bounds-ssot` **ενώνει** bboxes, δηλητηριάζει τα όρια **ΟΛΗΣ** της σκηνής: zoom-extents και marquee σπάνε **καθολικά**, όχι στον πίνακα |
| `columnCount: NaN` | `i < NaN` ψευδές από την πρώτη επανάληψη → μηδέν στήλες → **αόρατη οντότητα** |
| `columnCount: Infinity` | `for (i = 0; i < Infinity; i++)` → **πάγωμα καρτέλας + OOM** |

Κανόνας: **μη-πεπερασμένο ⇒ προεπιλογή** (όχι 0 — αυτό είναι ο αόρατος πίνακας· όχι `throw`
— μια εξαίρεση εδώ ζει μέσα στο render pass του φαντάσματος)· **πεπερασμένο εκτός εύρους ⇒
κόψιμο στα άκρα**. Τα άνω όρια βγαίνουν από το **χαρτί**, όχι από το κεφάλι κανενός: 256
στήλες × το ελάχιστο 4mm = 1.024mm ≈ η μεγάλη πλευρά ενός A0 (1.189mm)· 1.000 γραμμές × 8mm
= 8 μέτρα χαρτιού· πλάτος στήλης πάνω από 1.189mm δεν είναι στήλη.

**Γιατί το ίδιο φράγμα μπαίνει ΚΑΙ στον store ΚΑΙ στο `resolveShape`** — δύο κλήσεις, **μία**
υλοποίηση (N.18): ο store καθαρίζει ό,τι *γράφεται*, ώστε η ribbon να μη δείχνει `NaN` ενώ ο
πίνακας γεννιέται με 3 στήλες (UI που λέει άλλα από όσα κάνει είναι ψέμα)· το `resolveShape`
καθαρίζει ό,τι *φτάνει*, επειδή ο store **δεν είναι η μόνη πόρτα** — το `buildTableEntity`
είναι δημόσιο και το καλούν ήδη ο builder της ολοκλήρωσης, το φάντασμα και τα tests. Φράγμα
μόνο στον store είναι φράγμα που ο επόμενος καλών παρακάμπτει **χωρίς να το ξέρει**.

### 19.6 🔴 ΜΟΝΑΔΕΣ — ο αριθμός που σοκάρει, και η ασυμμετρία δίπλα του

Ο προεπιλεγμένος πίνακας είναι 3 στήλες × 40mm = **120mm** πλάτος και 5 γραμμές × 8mm =
**40mm** ύψος — **στο χαρτί**. Σε σχέδιο **1:100**, η γέφυρα `paperHeightToModel` δίνει ×100:

> **120 × 40 sheet-mm ⇒ 12.000 × 4.000 μονάδες σκηνής, δηλαδή 12m × 4m κόσμου.**

**Αυτό είναι ΣΩΣΤΟ.** Είναι ο ορισμός του annotative: 120mm στο τυπωμένο φύλλο ενός σχεδίου
1:100 **είναι** 12 μέτρα κόσμου. Όποιος δει «12000» σε debugger και θεωρήσει ότι έφυγε
κόμμα, θα «διορθώσει» τη γέφυρα — και θα σπάσει ταυτόχρονα τον scale-bar και **κάθε**
διαστασιολόγηση, που περνούν από το **ίδιο** SSoT (§18.3). Εκεί ζει το μάθημα των
**ADR-462/716**: το λάθος δεν θα έμοιαζε με λάθος· θα έμοιαζε με τακτοποίηση.

🔴 **Η ασυμμετρία που κανένα ADR δεν αντιπαραθέτει** — γραμμένη εδώ επειδή δύο **αδελφές**
σημειώσεις με ταυτόσημη σύμβαση ονοματοδοσίας ζουν σε **διαφορετικά πλαίσια**:

| Οντότητα | Πεδίο | Πλαίσιο | Στο 1:100, «120mm» σημαίνει |
|---|---|---|---|
| `table` | διάταξη σε sheet-mm | **annotative** (§18.3) | **12.000** μονάδες σκηνής |
| `opening-info-tag` | `widthMm` | **WORLD canonical-mm — ΟΧΙ annotative** (`systems/scale/scale-entity-transform.ts:319-322`, ρητά: *«`widthMm` is WORLD canonical-mm (NOT annotative) → scales like a length»*) | **120** μονάδες σκηνής |
| `scale-bar` | ύψη / πάχη | annotative | όπως ο πίνακας |

**Διαφορά ×100 μεταξύ δύο σημειώσεων που μοιράζονται το επίθημα `Mm`, το `angleRad`, τον
κοινό μηχανισμό λαβών και το ίδιο αρχείο `scale-entity-transform.ts`.** Το επίθημα λέει τη
**μονάδα** (ADR-716) αλλά **δεν λέει το πλαίσιο** — και το πλαίσιο είναι η μισή απάντηση.
Ο επόμενος που θα δει τους δύο αριθμούς δίπλα-δίπλα θα υποθέσει σφάλμα στον έναν· δεν
υπάρχει σφάλμα, υπάρχουν **δύο διαφορετικές —και ηθελημένες— αποφάσεις** που κανείς δεν είχε
γράψει στο ίδιο σημείο. Πριν αγγίξει κανείς τη γέφυρα του πίνακα «για να ταιριάξει με τον
αδελφό του»: **η διόρθωση θα ήταν σφάλμα ΤΙΜΗΣ σε κάθε τυπωμένο φύλλο**, όχι εμφάνισης.

### 19.7 Τι ρητά ΔΕΝ κάνει το βήμα 1

| Θέμα | Πού ανήκει | Σημείωση |
|---|---|---|
| ~~Inline επεξεργαστής κελιού~~ | ~~Φ.Δ βήμα 2~~ | ✅ **ΕΚΛΕΙΣΕ** (§19.9): διπλό κλικ σε κελί → `<input>` πάνω στον καμβά → commit `UpdateEntityCommand` |
| Πλοήγηση με πληκτρολόγιο (Tab/Enter/βέλη), επικόλληση TSV/CSV | Φ.Δ **βήμα 2 (συνέχεια)** | εκεί ανήκει και η λαβή ύψους γραμμής (§18.4: μία επιλεγμένη γραμμή, μοτίβο Excel/Figma) |
| **Contextual καρτέλα ribbon** | Φ.Δ **βήμα 3** | ⚠️ **Γι' αυτό το `table-options-store` είναι σήμερα ΑΠΡΟΣΠΕΛΑΣΤΟ**: υπάρχει, δουλεύει, καθαρίζει — αλλά **καμία επιφάνεια δεν το γράφει**, άρα κάθε πίνακας γεννιέται 3 × 3 × 40mm. Ο store δεν είναι νεκρός κώδικας· είναι **προεγκατεστημένος καταναλωτής** που περιμένει την πόρτα του |
| Undo ανά κελί | Φ.Δ βήμα 2 | σήμερα το `UpdateEntityCommand` κλωνοποιεί ολόκληρη την οντότητα — σωστό, αλλά αδρό |
| `SCALE`, table breaking, `ACAD_TABLE` native | όπως §18.5 | αμετάβλητα |

**Γνωστά κατάλοιπα της Φ.Γ** — εντοπίστηκαν από τους κριτές του βήματος 1 και καταγράφονται
με **αρχείο:γραμμή** ώστε να μη χαθούν σε handoff:

| # | Κατάλοιπο | Πού | Τι βλέπει ο χρήστης |
|---|---|---|---|
| 1 | **Το κείμενο ΔΕΝ περιστρέφεται** | `rendering/entities/table/stamp-table-layout.ts:~132-138` — `fillText` χωρίς `ctx.rotate` | γυρνάς τον πίνακα, **τα γράμματα μένουν οριζόντια** |
| 2 | Καμία ένδειξη **επιλογής** — μόνο hover | `rendering/entities/TableRenderer.ts:~105-107` (`tablePhaseColor` → `_currentHovered`) | επιλεγμένος πίνακας δεν φαίνεται επιλεγμένος |
| 3 | Λαβές **χωρίς γλυφή** | `bim/grips/grip-glyph-registry.ts` — λείπουν `table-move` / `table-rotation`, ενώ το `hooks/grip-kinds-primitives.ts:~251` **υπόσχεται ρητά** «4-arrow MOVE glyph» | τετράγωνες λαβές αντί για σταυρό/τόξο — ο κώδικας λέει άλλα από όσα κάνει |
| 4 | `moveGlyphFrame` **null** | `bim/grips/move-glyph-frame.ts:~179` (τελικό `return null`) | **καμία μετακίνηση με πληκτρολογημένη απόσταση**, και ο σταυρός μένει εκτός snap. Το σχόλιο του **ίδιου** αρχείου ονομάζει αυτό ακριβώς το σφάλμα: *«a null frame draws the glyph but leaves the arms inert»* |
| 5 | Καμία ένδειξη **clearance** | `bim/framing/entity-footprint-for-dims.ts` — κανένα σκέλος `table` | ο πίνακας δεν συμμετέχει στις αυτόματες αποστάσεις |
| 6 | Λαβές σε **λάθος μονάδες** σε σκηνή σε μέτρα | `bim/table/table-entity-grips.ts:52` — `computeTableEntityGeometryLive(entity)` **χωρίς** `sceneUnits` ⇒ προεπιλογή `'mm'`, ενώ ο ζωγράφος περνά `this._sceneUnits` (`TableRenderer.ts:66`) | **δύο απαντήσεις στην ίδια ερώτηση**: οι λαβές πέφτουν ×1000 μακριά από τον πίνακα |
| 7 | Το `fontFamily` **χάνεται** | `TableTextRun` (`table-layout-types.ts:59-67`) δεν το μεταφέρει· το `stampRun` γράφει σκληρά `'arial'` (`stamp-table-layout.ts:135`) | το `TableStyle` επιτρέπει γραμματοσειρά που ο καμβάς αγνοεί σιωπηλά |
| 8 | Καμία **περικοπή** κειμένου | `stamp-table-layout.ts` — κανένα `clip` / ellipsis | μακρύ κείμενο ξεχειλίζει έξω από το κελί, πάνω στη γειτονική στήλη |

Τα **1, 3, 6, 7** είναι αποκλίσεις **αλήθειας** (ο κώδικας υπόσχεται κάτι που δεν κάνει)·
τα υπόλοιπα είναι ελλείψεις. Προτεραιότητα στο βήμα 2 έχουν το **6** και το **4**: το πρώτο
δίνει λάθος **θέση** (και μόνο σε σκηνές σε μέτρα, άρα δεν θα το δει όποιος δοκιμάζει σε mm),
το δεύτερο **ακυρώνει ολόκληρη μια εντολή**.

### 19.8 Έλεγχοι

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `bim/table` unit | **7 suites / 150 tests** ✅ (Φ.Γ: 92 ⇒ +58) |
| `build-table-entity.test.ts` — εργοστάσιο + φράγμα | **32** ✅ |
| `table-model-serialization.test.ts` — Λύση Α + ανάνηψη | **26** ✅ |
| `entity-json-roundtrip-coverage.test.ts` — **Φρουρός 2** | **125** ✅ |
| Capability anchors ADR-587 (CHECK 5C) | **25 suites / 509 tests** ✅ (Φ.Γ: 24 / 384) |
| `npm run jscpd:diff` (N.18) στα 5 νέα/τροποποιημένα production αρχεία | ✅ καθαρό |
| i18n | 10 κλειδιά **EL + EN** γραμμένα **πριν** τον κώδικα + `generate:i18n-types` (N.11 / CHECK 3.33) |
| N.7.1 | δύο αποσπάσεις **επειδή** το όριο χτυπούσε: `drawing-entity-xline.ts` από τον builder, `table-icon-glyph.tsx` από το `RibbonButtonIcon.tsx` |

**Μεταλλάξεις**: οι δύο υλοποιητές αναφέρουν επαλήθευση με μετάλλαξη στα σκέλη τους (φρουρός
τύπου + κοινό fixture· φράγμα + ανάνηψη). **Δεν τις επανεκτέλεσα** — τα παραπάνω νούμερα
suites/tests τα μέτρησα ο ίδιος με `jest`.

**TypeScript**: δεν έτρεξε (N.17 — ο πράκτορας δεν τρέχει `tsc`). Το subapp είναι εκτός του
root `tsconfig.json`, άρα ο έλεγχος έρχεται από το **CHECK 3.29 στο CI** ή από τον περιοδικό
έλεγχο του Giorgio (§19.4).

✅ **BROWSER VERIFY: ΕΓΙΝΕ (2026-07-31).** Η γέφυρα Chrome έλυσε τη σύγκρουση named pipe με
την εφαρμογή Claude Desktop· ο πίνακας παρατηρήθηκε ζωντανά σε σκηνή **σε μέτρα** (2.951
οντότητες, κλίμακα 1:2352 μετά από `Home`). Πλήρες πρακτικό στο **§19.10**.

⚠️ **Το πρώτο βήμα επαλήθευσης έχει μια παγίδα που κόστισε δύο συνεδρίες**: μετά από F5 ο
καμβάς φαίνεται **άδειος** — αυτό ΔΕΝ είναι απώλεια δεδομένων, είναι **λάθος κάμερα** (ο
viewer επαναφέρει `s=1`, δηλ. 1:3,8). Το επίπεδο δηλώνει κανονικά τις οντότητές του στην
παλέτα. **Πάτα `Home` πριν συμπεράνεις οτιδήποτε.**

### 19.9 Φάση Δ βήμα 2 (μέρος) — inline επεξεργαστής κελιού (2026-07-31)

Διπλό κλικ πάνω σε κελί ενός επιλεγμένου πίνακα ανοίγει ένα απλό `<input>` πάνω στον καμβά,
ακριβώς πάνω στο κελί· Enter/blur κάνει commit, Esc ακυρώνει (escape-bus, MODAL_DIALOG).
**Τρία νέα αρχεία**, καθρέφτες του υπάρχοντος text-editor ζεύγους (ADR-344 Φ6.E):

- `bim/table/table-cell-edit-session.ts` — καθαρό (χωρίς React): `resolveTableCellEditTarget`
  (σημείο κόσμου → ποιο κελί + τρέχον κείμενο + πάνω-αριστερή γωνία αγκύρωσης, πάνω στο ΗΔΗ
  υπάρχον `tableCellAtWorld`/`tableFrameToWorld` του Φ.Γ) και `buildTableCellEditCommand`
  (νέο κείμενο → `UpdateEntityCommand | null`· `null` όταν το κείμενο δεν άλλαξε — εκμεταλλεύεται
  την ταυτότητα by-reference του `setPersistedCellText`, ΚΑΜΙΑ δεύτερη σύγκριση ισότητας).
- `ui/table-cell-editor/useTableCellDoubleClickEditor.ts` — ο 2D «ανοιχτήρας»: καθρέφτης του
  `useTextDoubleClickEditor` (τοπικό `useState`, καμία `useSyncExternalStore`, ADR-040 rule 1),
  αλλά χρειάζεται το σημείο κόσμου του ΙΔΙΟΥ του κλικ (όχι μόνο την οντότητα, όπως το κείμενο) —
  ίδια αντίστροφη προβολή οθόνης→κόσμου με το `useOpeningInfoTagDoubleClick` (ADR-612). Commit
  ξαναδιαβάζει την οντότητα ΤΗ ΣΤΙΓΜΗ του commit (όχι τη στιγμιότυπη αναφορά του ανοίγματος) και
  εκτελεί μέσω `useCommandHistory().execute` πάνω στον `LevelSceneManagerAdapter` singleton
  (ADR-527) — ίδιος command bus με το `OpeningInfoTagEditorOverlay`.
- `ui/table-cell-editor/TableCellEditorOverlay.tsx` — η όψη, prop-driven (ΟΧΙ store-driven όπως
  το opening-info-tag): απλό controlled `<input>`, **όχι** το TipTap `TextEditorOverlay` — το
  `TableCell.value` (Φ.Α) είναι απλό `string`, ένας πλήρης rich-text editor θα υποσχόταν
  μορφοποίηση που η μηχανή διάταξης δεν διαβάζει. Επαναχρησιμοποιεί αυτούσιο το κοινό
  `TextEditorAnchorLayer`/`createTextEditorAnchor2D` (ζωντανή αγκύρωση, ακολουθεί pan/zoom χωρίς
  re-render) — **καμία τρίτη υλοποίηση αγκύρωσης**.

#### 19.9.α Το δίδυμο που γεννήθηκε στην ίδια κίνηση — και πώς έκλεισε

🔴 Η πρώτη γραφή του `TableCellEditorOverlay` πέρασε το `jscpd:diff` **και ήταν λάθος**: ο έλεγχος
είχε τρέξει **μόνο πάνω στα νέα αρχεία**, οπότε δεν συνέκρινε ποτέ με τον αδελφό που καθρέφτιζε.
Τρέχοντάς τον **μαζί με το `OpeningInfoTagEditorOverlay`** βγήκε clone **15 γραμμών / 50 tokens**:
η εγγραφή στον escape-bus και ο `onKeyDown` του Enter ήταν ταυτόσημα.

Αυτό είναι **ακριβώς** το λάθος που περιγράφει ο N.18 — «κεντρικοποιείς το Α, γράφεις το Β ως
δίδυμο» — και το μάθημα δεν είναι για το jscpd αλλά για τη **μεθοδολογία**: *ένας έλεγχος διδύμων
που τρέχει μόνο στα δικά σου αρχεία δεν ρωτά την ερώτηση.* Το πρότυπο που μιμείσαι πρέπει να είναι
**μέσα** στο σύνολο σύγκρισης.

**Λύση — εξαγωγή, όχι περικοπή**: νέο `ui/inline-editor/use-inline-editor-keys.ts`
(`useInlineEditorKeys({ id, onCommit, onCancel })`), που καταναλώνουν **και οι δύο** επεξεργαστές.
Ανέλαβε **και** τον φρουρό «μία φορά» (`settledRef`), που πριν ήταν αντιγραμμένος σε καθέναν: το
`onBlur={commit}` και το Enter πυροδοτούν **και τα δύο** στην ίδια χειρονομία (Enter → commit →
ξεφόρτωση → απώλεια εστίασης → δεύτερο commit), δηλαδή **δύο εγγραφές undo για μία πληκτρολόγηση**
αν κάποιος τον ξεχάσει. Τώρα δεν μπορεί να τον ξεχάσει.

⚠️ **Μία σκόπιμη σύγκλιση συμπεριφοράς**: το info-tag είχε `canHandle: () => true`, ο πίνακας
`() => !committed`. Το κοινό SSoT κρατά το **δεύτερο** για τους δύο — ένας χειριστής που δεν έχει
πια τίποτα να ακυρώσει δεν πρέπει να **καταπίνει** το ESC. Στην πράξη μη προσπελάσιμο (ο επεξεργαστής
ξεφορτώνεται στο commit), αλλά είναι αλλαγή και καταγράφεται ως αλλαγή, όχι ως καλλωπισμός.
Δεν αφορά το `TextEditorOverlay` (ADR-344): έχει πλουσιότερο πληκτρολόγιο (TipTap) και δεν αγγίχτηκε.

**Καλωδίωση** (3 υπάρχοντα αρχεία, ελάχιστο diff, ΚΑΝΕΝΑ νέο `useSyncExternalStore`):
`useCanvasSectionUI.ts` προσθέτει το hook στην αλυσίδα double-click (μετά το opening-info-tag,
πριν το κείμενο — τα τρία είναι αμοιβαία αποκλειόμενα από τον τύπο οντότητας, δεν χρειάζεται
«claim» boolean)· `CanvasSection.tsx` χαρτογραφεί το `editingState` σε prop (491/500 γραμμές,
ίδιο μοτίβο με το `textEditorOverlay`)· `CanvasSectionOverlays.tsx` προσθέτει ένα conditional
render με `key` = `entityId:rowId:colId` (χωρίς αυτό, αλλαγή κελιού χωρίς remount θα κρατούσε
μπαγιάτικο draft κειμένου). 2 νέα κλειδιά i18n (EL+EN, `table.cellEditor.editorPlaceholder`) +
`generate:i18n-types`.

**Έλεγχοι**: `bim/table` **182** ✅ (150 ⇒ +12) · `types` **141** ✅ (αμετάβλητο) · capability
anchors ADR-587 **25 suites / 509 tests** ✅ (αμετάβλητο) · `npm run jscpd:diff` στα 6
νέα/τροποποιημένα αρχεία ✅ καθαρό · i18n **30.121/30.121** EL+EN. **Μεταλλάξεις (2/2,
επαληθεύτηκαν σε αυτή τη συνεδρία)**: (α) αφαίρεση του no-op guard (`if (nextModel ===
entity.model) return null`) → 1 test κοκκίνισε στο αναμενόμενο σημείο· (β) λάθος γωνία
αγκύρωσης (κάτω-δεξιά αντί πάνω-αριστερά) → 3 tests κοκκίνισαν (ασύμμετρες διαστάσεις +
στραμμένος πίνακας + annotative κλίμακα) — και τα δύο επαναφέρθηκαν αμέσως μετά.

🔴 **ΔΕΝ έγιναν σε αυτό το βήμα**: πλοήγηση πληκτρολογίου (Tab/Enter/βέλη μεταξύ κελιών),
επικόλληση TSV/CSV, λαβή ύψους γραμμής, undo πιο λεπτόκοκκο από «κλωνοποίηση όλης της
οντότητας» (§19.7 — αμετάβλητο). ✅ **BROWSER VERIFY ΕΓΙΝΕ** (2026-07-31) — ο editor
παρατηρήθηκε ζωντανά και **δουλεύει**: §19.10.

---

### 19.10 Browser verify — τι είδε πραγματικά η οθόνη (2026-07-31)

Πρώτη ζωντανή παρατήρηση του πίνακα. Σκηνή του Giorgio σε **μέτρα** (όχι mm) — η μονάδα που
**κανένα** test δεν είχε ελέγξει, αφού όλα έτρεξαν σε ουδέτερα mm.

| # | Ερώτημα | Τι είδε η οθόνη |
|---|---|---|
| α | Φαίνεται, σε σωστό μέγεθος; | ✅ ναι — σωστό annotative μέγεθος έναντι του τοπογραφικού |
| β | Κείμενο μέσα στα κελιά; | ✅ ναι — τίτλος + «Α/Α · Περιγραφή · Ποσότητα» + περιεχόμενο σειρών, σωστά τοποθετημένα |
| γ | Επιλέγεται με κλικ; | ⚠️ **η πρόβλεψη επιβεβαιώθηκε**: μόνο **hover** (πράσινο περίγραμμα + λαβές)· μόλις φύγει ο δρομέας, **καμία ένδειξη επιλογής** (§19.7, ανοιχτό) |
| δ | Λαβές εκεί που φαίνονται; | ✅ **η πρόβλεψη «σφάλμα ×1000» ΔΕΝ ίσχυσε** — οι λαβές πέφτουν **πάνω στην ακμή**, στα σημεία των διαχωριστικών στηλών. Καμία απόκλιση μονάδων σε σκηνή σε μέτρα |
| ε | Ghost ≡ commit; | ⚪ δεν ελέγχθηκε (απαιτεί περιστροφή) — §19.7 αμετάβλητο |
| στ | **Reload → επιβιώνει με τα κελιά;** | ✅✅ **ΑΠΟΔΕΙΓΜΕΝΟ ΜΕ ΝΕΑ ΕΓΓΡΑΦΗ**: κείμενο γράφτηκε σε κενό κελί → Enter → «Saving…» → «Last saved: Just now» → **πλήρες reload** → το κείμενο ήταν εκεί. Το `model.cells` = `Map` **επιβιώνει** |
| ζ | **Διπλό κλικ → γράφεις;** | ✅ ναι — το `<input>` πέφτει **πάνω στο σωστό κελί**, δέχεται πολλαπλούς χαρακτήρες, Enter δεσμεύει, το commit φτάνει στο Firestore |

#### 19.10.α ⚠️ Δύο «ευρήματα» που ήταν **artifacts του εργαλείου**, όχι σφάλματα

Καταγράφονται επειδή **και τα δύο έμοιαζαν με σοβαρά bugs** και θα ξαναεμφανιστούν σε κάθε
μελλοντικό browser verify:

1. **«Ο εγγραφέας κελιού δέχεται μόνο 1 χαρακτήρα»** — το `type` action (και το `key` με
   **πολλά** πλήκτρα σε μία κλήση) του browser tool δεν σέβεται το focus σε αυτή τη σελίδα:
   οι χαρακτήρες κατέληγαν στη **γραμμή εντολών**. Με **ξεχωριστές κλήσεις ενός πλήκτρου**
   το κελί δέχτηκε κανονικά `k`→`m`→`z` = «kmz» και έκανε commit. **Ο κώδικας ήταν σωστός.**
2. **«Σφάλμα hit-test»** — οι συντεταγμένες του screenshot (1568px) **δεν** είναι οι CSS
   συντεταγμένες της σελίδας (`innerWidth` = **2400**, `devicePixelRatio` 0,8). Κλικ που
   «φαινόταν» πάνω στον πίνακα έπεφτε σε γειτονικό **MTEXT**.

📌 **Κανόνας για το επόμενο verify**: ένα πλήκτρο ανά κλήση· ελληνικοί χαρακτήρες **δεν**
στέλνονται καθόλου (προκαλούν blur)· επιβεβαίωσε τη θέση με `getBoundingClientRect` πριν
συμπεράνεις σφάλμα γεωμετρίας.

#### 19.10.β Το **ένα** πραγματικό σφάλμα που βρέθηκε — και διορθώθηκε

**Στο hover η γραμμή κεφαλίδων έχανε τα γράμματά της.** Το `phaseColor` έβαφε **και** το
γέμισμα **και** το κείμενο με το ίδιο χρώμα (`stamp-table-layout.ts`, γρ. 59 + 134): σε κελί
**με** `fillColorHex` αυτό σημαίνει ίδιο φόντο και ίδιο μελάνι ⇒ μονόχρωμο πλακάκι. Οι σειρές
δεδομένων (χωρίς γέμισμα) κρατούσαν τα γράμματά τους — **η ασυμμετρία ήταν το αποτύπωμα**.

**Διόρθωση**: το κείμενο κρατά **πάντα** το `run.colorHex`· το χρώμα φάσης βάφει τη
**σιλουέτα** (γεμίσματα + πλέγμα), ποτέ το μελάνι. Ίδια αρχή με το AutoCAD: το highlight
αλλάζει τη σιλουέτα, δεν κάνει την οντότητα δυσανάγνωστη.

**Γιατί δεν το είχε πιάσει κανένα test**: το `stamp-table-layout.ts` είχε **μηδενική**
κάλυψη, και τα 323 tests του `bim/table` ελέγχουν τη **διάταξη** (πού πέφτει το κείμενο), όχι
το **μελάνι** (με τι χρώμα γράφεται). Το σφάλμα ήταν αποκλειστικά στο μελάνι ⇒ **δομικά
αόρατο**. Νέο `rendering/entities/table/__tests__/stamp-table-layout.test.ts` (**6 tests**),
που δοκιμάζει κελί **με** και **χωρίς** γέμισμα **μαζί** — ένα test μόνο σε κελί χωρίς γέμισμα
θα ήταν πράσινο και **πριν** τη διόρθωση.

**Έλεγχοι**: `bim/table` + `types` + `rendering/entities/table` **329/329** ✅ (323 ⇒ +6) ·
`jscpd:diff` ✅ καθαρό · **μετάλλαξη 1/1**: επαναφορά του `rc.phaseColor ??` στο `stampRun`
→ **3 tests κοκκίνισαν**, επαναφέρθηκε αμέσως. Επαληθεύτηκε **και στην οθόνη**: μετά τη
διόρθωση η κεφαλίδα δείχνει «Α/Α · Περιγραφή · Ποσότητα» ενώ ο πίνακας είναι σε hover.

---

## 20. Φάση Δ βήμα 2 (συνέχεια) — **πλοήγηση κελιών σαν Excel** (2026-08-01)

Ο πίνακας γραφόταν, αλλά **μόνο με διπλό κλικ σε κάθε κελί ξεχωριστά**. Αυτό το βήμα δίνει
πλοήγηση με το πληκτρολόγιο (Tab / Shift+Tab / Enter / Shift+Enter / βέλη / Home / End) και
**type-to-replace** + **F2**. Εκτός εύρους ρητά: επικόλληση TSV/CSV, επιλογή περιοχής,
drag-fill, τύποι.

### 20.1 Τι κάνουν οι μεγάλοι — **ερευνήθηκε, δεν υποτέθηκε**

| Πηγή | Τι μετρήθηκε | Τι κρατήσαμε |
|---|---|---|
| **BricsCAD** (τεκμηριωμένος κλώνος του AutoCAD TABLE in-place editor) | Tab → επόμενο κελί ίδιας γραμμής · Shift+Tab → προηγούμενο · Enter → επόμενο κελί **ίδιας στήλης** · Shift+Enter → προηγούμενο · βέλη → μεταξύ κελιών · Esc → έξοδος · Alt+Enter → δεύτερη γραμμή στο κελί | **Όλα**, εκτός του Alt+Enter (το `TableCell.value` είναι απλό `string`, §4) |
| **AutoCAD** | Μονό κλικ **επιλέγει** κελί· πληκτρολόγηση **αντικαθιστά** το περιεχόμενο· διπλό κλικ μπαίνει σε επεξεργασία επί τόπου | Η **διάκριση επιλογή vs επεξεργασία** — ίδια με τις καταστάσεις του Excel |
| **Excel** | Ο κανόνας της **στήλης αγκύρωσης** (μετά από σειρά Tab, το Enter κατεβαίνει και επιστρέφει στη στήλη **όπου ξεκίνησε το Tab**) · οι **τρεις** καταστάσεις Ready/Enter/Edit με F2 να εναλλάσσει τις δύο τελευταίες | **Και τα δύο** — δες §20.2 |
| **WAI-ARIA APG «Grid»** | roving tabindex · Home/End = άκρα γραμμής, Ctrl+Home/Ctrl+End = άκρα πλέγματος · navigation vs edit mode · Escape **επαναφέρει την πλοήγηση** · αναδίπλωση με βέλη **προαιρετική, μόνο για layout grids** | Όλα· τα βέλη **σταματούν** στην άκρη (δεδομένα, όχι διάταξη) |
| **Revit schedules** | Παράπονο κοινότητας: τα shortcuts «δεν δουλεύουν μέσα σε schedule γιατί το Revit νομίζει ότι εισάγεις δεδομένα» | **Προειδοποίηση**: η ιδιοκτησία πλήκτρων πρέπει να είναι **ρητά εξιτέα** (Esc), αλλιώς ο χρήστης εγκλωβίζεται ⇒ δίπτυχο Escape (§20.4) |
| **Handsontable** | Αλφαριθμητικό σε επιλεγμένο κελί → μπαίνει σε επεξεργασία **με τον χαρακτήρα μέσα** | Επιβεβαιώνει το type-to-replace ως πρότυπο κλάδου |

### 20.2 Οι **τρεις** καταστάσεις — και γιατί δύο δεν αρκούν

Η διαφορά `enter` vs `edit` είναι **μετρήσιμη στα βέλη**, και είναι ο λόγος που υπάρχει το F2:

| κατάσταση | πώς μπαίνεις | βέλος | πληκτρολόγηση |
|---|---|---|---|
| `nav` (Excel: Ready) | Tab/Enter/βέλος, ή Esc από γραφή | μετακινεί **κελί** | **αντικαθιστά** το κελί |
| `enter` (Excel: Enter) | πληκτρολόγησες πάνω σε `nav` | **δεσμεύει και μετακινεί** κελί | συνεχίζει |
| `edit` (Excel: Edit) | F2 ή διπλό κλικ | μετακινεί τον **κέρσορα κειμένου** | εισάγει στη θέση του κέρσορα |

Με δύο καταστάσεις τα βέλη είναι διφορούμενα: ή χάνεις την πλοήγηση μόλις αρχίσεις να γράφεις,
ή δεν μπορείς ποτέ να διορθώσεις ένα γράμμα στη μέση. Αυτό ήταν το ανοιχτό σχεδιαστικό ερώτημα
του βήματος και έκλεισε με την απάντηση του Excel.

### 20.3 SSoT audit — τι επαναχρησιμοποιήθηκε, τι γεννήθηκε, **με αιτιολόγηση**

| Υποψήφιο | Απόφαση |
|---|---|
| `ui/inline-editor/use-inline-editor-keys.ts` | **ΑΥΤΟΥΣΙΟ** — κρατά τον φρουρό «μία φορά» και τη δρομολόγηση του Escape από τον bus. **ΔΕΝ επεκτάθηκε**: Tab/Enter/βέλη είναι σημασιολογία **πλέγματος**, όχι «inline editor»· θα βάραινε και τον δεύτερο καταναλωτή (opening-info-tag), που δεν έχει πλέγμα |
| `layers/hooks/useKeyboardNavigation.ts` · `carousel/hooks/useA11yNav.ts` | **ΟΧΙ** — πλοηγούν **γραμμική λίστα** (`ArrowUp/Down` πάνω σε `findIndex`). Ο πίνακας είναι **2Δ με συγχωνεύσεις**: το «επόμενο» δεν είναι `index ± 1` |
| `lib/a11y/keyboard-scope.ts` | **ΜΗΔΕΝ αλλαγές** — δες §20.4 |
| `TextEditorAnchorLayer` + `createTextEditorAnchor2D` | **ΑΥΤΟΥΣΙΑ**, καμία τρίτη υλοποίηση αγκύρωσης |
| `table-model-helpers.indexById` | Ήταν **ιδιωτικό**· το CHECK 3.28 (jscpd) χαρακτήρισε clone το τοπικό αντίγραφο που γεννήθηκε στην πλοήγηση ⇒ **εξήχθη** αντί να μείνει δίδυμο |
| **Νέο** `bim/table/table-cell-navigation.ts` | Καθαρό, μηδέν React/DOM. Η ίδια ερώτηση («πού πάει το Tab;») θα τεθεί ξανά από τη 3Δ όψη, την επικόλληση TSV και την επιλογή περιοχής |
| **Νέο** `ui/table-cell-editor/table-cell-key-intent.ts` | Η **σημασιολογία** χωριστά από την καλωδίωση, ώστε ένα λάθος **απόφασης** να φαίνεται ως τέτοιο σε test που διαβάζεται σαν προδιαγραφή |
| **Νέο** `state/table-cell-cursor-store.ts` | Ο δρομέας διαβάζεται **και** από τον ζωγράφο του καμβά, που δεν βλέπει React state |

**Ο ΕΝΑΣ κανόνας για τις συγχωνεύσεις**: κάθε βήμα προχωρά **όσο χρειάζεται ώστε να αλλάξει ο
ιδιοκτήτης** (`ownerByCell`). Ένα κελί 2×2 έχει τέσσερα κλειδιά με τον ίδιο ιδιοκτήτη· με μέτρημα
δεικτών το Tab θα κολλούσε ή θα προσγειωνόταν σε **καλυμμένο** κελί. Καμία ειδική περίπτωση ανά
κατεύθυνση, και ο δρομέας κάθεται **πάντα στην άγκυρα**.

### 20.4 Η ΙΔΙΟΚΤΗΣΙΑ ΠΛΗΚΤΡΩΝ — λύθηκε **δομικά, με μηδέν γραμμές** στον φύλακα

Ο viewer έχει **43** window-level keydown listeners, και με `activeTool === 'select'` **κάθε**
`[A-Za-z0-9]` ανοίγει τη **γραμμή εντολών**. Το ίδιο το `useKeyboardShortcuts` απαγορεύει ρητά
τοπικό `if` («ο φύλακας είναι δομικός»).

**Η λύση δεν ήταν τέταρτο predicate στο `keyboard-scope.ts`, ούτε declarative context à la VS
Code.** Είναι ότι το τρέχον κελί **είναι πραγματικά ένα εστιασμένο πεδίο κειμένου**: ένα
`<input>` αγκυρωμένο πάνω στο κελί, που ζει **και** σε κατάσταση πλοήγησης (αόρατο,
`pointer-events-none`, **ποτέ** `display:none` / `visibility:hidden` — αφαιρούν την εστίαση).

    isTextEntryTarget(<input>) -> true
       => consumesTypedCharacters -> true    (γράμματα: η γραμμή εντολών παραιτείται)
       => consumesDirectionalKeys -> true    (βέλη/Home/End: το pan ±80px παραιτείται)
       => shouldGlobalShortcutYield -> true  για ΟΛΟΥΣ τους 43 listeners, δωρεάν

Είναι και η αρχιτεκτονική του **Google Sheets / Excel Online**: πλέγμα σε καμβά, πραγματικό
εστιασμένο πεδίο από πίσω. Το ίδιο ένα πράγμα λύνει **και** το type-to-replace (ο πρώτος
χαρακτήρας βρίσκει **άδειο** πεδίο, άρα «αντικαθιστά» χωρίς καμία λογική αντικατάστασης) **και**
το IME / νεκρούς τόνους / ελληνικά, που μια συνθετική επανεκπομπή χαρακτήρα θα έσπαγε.

**Escape δίπτυχο** (Excel + APG, όχι το μονόπτυχο του AutoCAD): σε γραφή ακυρώνει τη **συνεδρία**
και μένει στο κελί· σε πλοήγηση κλείνει τον δρομέα. Δρομολογείται **πάντα** από τον escape-bus
μέσα στο `use-inline-editor-keys` — καμία inline σύγκριση (CHECK 3.7).

**Εύρημα, ΟΧΙ παλινδρόμηση αυτού του βήματος**: το `useCommandHistoryKeyboard` (Ctrl+Z / Ctrl+Y)
δένεται με **ωμό `window.addEventListener`**, όχι με `addGlobalShortcutListener` — δηλαδή **δεν
παραιτείται ποτέ** μπροστά σε πεδίο κειμένου. Ίσχυε ήδη για κάθε inline editor του viewer· δεν το
άλλαξε αυτό το βήμα και δεν το «διορθώνει» σιωπηλά (αλλαγή σημασιολογίας undo = δική της απόφαση).

### 20.5 Ο δρομέας στον καμβά — ADR-040 κανόνας #3

Το ορθογώνιο του τρέχοντος κελιού ζωγραφίζεται από τον **καμβά** (`stampTableCellCursor`), όχι από
το DOM κουτί: ο πίνακας μπορεί να είναι **περιστραμμένος** και το κελί αλλάζει μέγεθος με το zoom,
ενώ η αγκύρωση είναι σκόπιμα σταθερή σε px οθόνης (ADR-344). Οι τέσσερις γωνίες περνούν από το
`toScreen` — `strokeRect` σε άξονες οθόνης θα κρεμόταν λοξά σε περιστραμμένο πίνακα.

**Ποτέ μέσα στο bitmap cache**: ζωγραφίζεται **μόνο** σε φάση επιλογής (`options.selected`), όπου
το normal-state pass —αυτό που μπαίνει στο raster— έχει πάντα κενό `selectedEntityIds`. Το store
ζητά **ένα καρέ ανά πάτημα πλήκτρου** με `markSystemsDirty(['dxf-canvas'])`.

### 20.6 Το μετρημένο ελάττωμα που βρέθηκε **στον browser**: χαμένη πληκτρολόγηση

Το πρόχειρο ήταν `useState` μέσα στον επεξεργαστή. Ζωντανά, probe στα συμβάντα του DOM έδειξε:

    keydown 7 -> input value="7" -> focusout value="7" -> keydown Tab σε <input> με value=""

δηλαδή ο επεξεργαστής **ξαναστηνόταν** ανάμεσα στον χαρακτήρα και το Tab (ασύγχρονη ανανέωση
σκηνής / autosave), και το `useState` ξανασπερνόταν από την αρχική τιμή του κελιού. Το commit που
ακολουθούσε έγραφε το **παλιό** κείμενο (`buildTableCellEditCommand` -> `null`, «τίποτα δεν
άλλαξε») — **σιωπηλή απώλεια πληκτρολόγησης**, διαλείπουσα, αόρατη σε κάθε test κατάστασης.

**Η διόρθωση δεν είναι «κράτα και το προηγούμενο target»** (θεραπεία συμπτώματος): ιδιοκτήτης της
συνεδρίας γραφής είναι ο **δρομέας**, όχι ένα DOM node που μπορεί να ξεφορτωθεί. Με το πρόχειρο
στο store, το ξαναστήσιμο είναι **αβλαβές εξ ορισμού**. Αυτό **δεν** αναιρεί το «το store δεν
κρατά κείμενο κελιού»: το πρόχειρο **δεν είναι** το κείμενο του κελιού — είναι ό,τι δεν έχει
δεσμευτεί ακόμα· το δεσμευμένο μένει παράγωγο της οντότητας, πάντα.

### 20.7 Επαλήθευση

**Tests** — `bim/table` + `types` + `rendering/entities/table` + `state` + `ui/table-cell-editor`:
**603/603** (28 suites) · `--testPathPatterns="dxf-viewer.*coverage.test"` **509/509** ·
`jscpd:diff` καθαρό (μετά την εξαγωγή του `indexById`) · **μεταλλάξεις 14/14 πιάστηκαν**
(4 στην πλοήγηση, 4 στη σημασιολογία πλήκτρων, 2 στον ζωγράφο του δρομέα, 6 στο store).

**Browser** (ζωντανά, 1.954 οντότητες, `scene.units = 'mm'`):

- διπλό κλικ -> δρομέας σε κατάσταση `edit` στο **σωστό** κελί, με το κείμενο του κελιού
- Tab -> μετακίνηση δεξιά· ο δρομέας γίνεται **αόρατος** (`opacity 0`, `pointer-events none`) και
  **κρατά την εστίαση**
- πληκτρολόγηση **13 χαρακτήρων** σε κατάσταση πλοήγησης -> **όλοι** μπήκαν στο κελί, η γραμμή
  εντολών **δεν άνοιξε** (η απόδειξη του §20.4)
- Tab, Tab, Enter -> ο δρομέας επέστρεψε στη **στήλη εκκίνησης** (ο κανόνας του Excel, ορατός
  στην οθόνη)
- επιβίωση **reload** με το περιεχόμενο · μετά τη διόρθωση του §20.6, διπλό κλικ σε κελί **με**
  κείμενο -> πληκτρολόγηση -> Tab **προσαρτά και δεσμεύει** (πριν χανόταν)

**Διόρθωση του handoff**: οι συντεταγμένες του εργαλείου browser είναι σε **screenshot-space**,
όχι CSS-space. Η προηγούμενη διάγνωση («κλικ από screenshot πέφτει ~800px λάθος») ήταν λάθος.
Επίσης το `type` με **πολλούς** χαρακτήρες **δεν** χάνει την εστίαση όταν υπάρχει ιδιοκτήτης.

### 20.8 ΚΛΕΙΣΤΟ (2026-08-01) — «ο πίνακας γεννιέται τεράστιος»: **δεν φταίει ο πίνακας**

Αναφέρθηκε από τον Giorgio και επιβεβαιώθηκε στην οθόνη: στο τοπογραφικό ο πίνακας είναι
μεγαλύτερος από ολόκληρο το οικόπεδο. **Η αλυσίδα μετρήθηκε ολόκληρη και είναι αριθμητικά σωστή:**

1. `scene.units = 'mm'`, έκταση σκηνής **816.533 × 1.915.132** μονάδες (≈ 817 m × 1915 m).
2. Το `useViewportAutoFit.autoFitDrawingScale` καλεί `computeFitToPaperScale(scene.bounds)` με
   χαρτί **A3 usable (~400 mm)**: `1.915.132 / 400 = 4788` -> snap -> **`drawingScale = 5000`**.
3. Το `tableMmToWorld = drawingScale × mmToSceneUnits('mm') = 5000`.
4. Το μοντέλο πίνακα είναι **3 στήλες × 40 sheet-mm = 120 sheet-mm** -> **600.000 μονάδες = 600 m**.

Μετρημένο ανεξάρτητα στον browser: η απόσταση δύο διαδοχικών δρομέων κελιού ήταν **237 CSS px**
με `transform.scale = 0.0011853`, δηλαδή **~200.000 μονάδες ανά στήλη 40 mm** -> `mmToWorld ≈ 5000`.
Συμφωνεί με το (3) — **καμία απόκλιση, κανένα σφάλμα μονάδων**.

**Το πραγματικό ελάττωμα είναι δομικό και ΔΕΝ ανήκει στον πίνακα**: υπάρχει **μία** καθολική
κλίμακα σχεδίασης ανά επίπεδο (ADR-375), αυτόματα προσαρμοσμένη στην **έκταση ΟΛΟΚΛΗΡΗΣ της
σκηνής**. Ένα επίπεδο που περιέχει **και** τοπογραφικό 1,9 km **και** κάτοψη κτιρίου δεν μπορεί να
έχει μία κλίμακα σημειώσεων. Το ίδιο ισχύει για **κάθε** annotative στοιχείο: το
`useTextCreationTool` περνά τον ΙΔΙΟ `drawingScale` στο `paperHeightToModel`, άρα και το κείμενο
που θα δημιουργηθεί εκεί θα είναι εξίσου γιγαντιαίο. Ο πίνακας απλώς το **έκανε ορατό** πρώτος.

#### Η μέτρηση ξαναέγινε από το μηδέν (2026-08-01, δεύτερη συνεδρία)

| Μέγεθος | Τιμή | Όργανο |
|---|---|---|
| `drawingScale` | **5000** | το ίδιο το widget: `aria-label="Κλίμακα σχεδίου 1:5000"` |
| Μοντέλο πίνακα | 3 × 40 = **120 sheet-mm** | `t.model.columns` από το React fiber |
| Πρόβλεψη | 120 × 5000 = **600 m** | `paperHeightToModel` |
| **Ζωντανή μέτρηση** | αριστερή ακμή X=**267,380** m, δεξιά X=**867,225** m ⇒ **599,85 m** | ο δείκτης συντεταγμένων της εφαρμογής |

Συμφωνία **0,03 %**. 📌 Ο Giorgio ανέφερε «650 m»· **δεν είναι 650, είναι 600** — μετρημένο από δύο
ανεξάρτητους δρόμους. (Η διαγώνιος 600×204 είναι 634 m — πιθανή πηγή της οπτικής εκτίμησης.)

⚠️ **Δύο αριθμοί του αρχικού §20.8 δεν επαληθεύτηκαν**: το `scene.bounds` δίνει max.y = **1.091.301**,
ενώ η **έκταση οντοτήτων** είναι 1.915.132 (ο αριθμός που είχε καταγραφεί). Τα δύο **δεν συμφωνούν
μεταξύ τους** — άσχετο για το πόρισμα (**και τα δύο** δίνουν snap -> 5000), αλλά είναι πραγματική
απόκλιση και δηλώνεται εδώ αντί να σιωπηθεί.

#### 🔴 Το ελάττωμα, διατυπωμένο σωστά — μετρημένη κατανομή

| | span X | span Y |
|---|---|---|
| Πλήρη όρια | 817 m | **1.915 m** |
| 5–95 εκατοστημόριο | 228 m | **106 m** |

Η κατανομή είναι **διτροπική**: το 90 % της γεωμετρίας ζει σε ~228×106 m, και λίγες ομάδες είναι
σκορπισμένες ως τα 1,9 km (το αρχείο είναι τοπογραφικό οικοπέδου **1.364 τ.μ.**, δηλαδή ≈37×37 m).

> Ο αυτόματος υπολογισμός **απαντά σε ερώτημα που κανείς δεν έθεσε**: «ποιο 1:N χωράει την **ένωση
> κάθε οντότητας** σε ένα A3;» Όταν η σκηνή έχει χωριστά μπλοκ σχεδίου 1,9 km μακριά, το ερώτημα
> **δεν έχει χρήσιμη απάντηση** — και η απάντησή του γίνεται η **μόνιμη** κλίμακα σημειώσεων.

#### Έρευνα — τι κάνουν οι μεγάλοι (συγκλίνουν απόλυτα)

| Εργαλείο | Πού ζει η κλίμακα σημειώσεων | Παράγεται από την έκταση περιεχομένου; |
|---|---|---|
| AutoCAD | `CANNOSCALE` (model space) + κλίμακα ανά viewport· annotative αντικείμενα κρατούν **λίστα** κλιμάκων | **Όχι** |
| Revit | ιδιότητα της **ΠΡΟΒΟΛΗΣ**· τα schedules ζουν μόνο σε φύλλα | **Όχι** |
| ArchiCAD | layout book· το κείμενο έχει επιλογή **«fixed size»** | **Όχι** |
| Vectorworks | **Design Layer Scale** ανά επίπεδο + κλίμακα viewport | **Όχι** |

**Κανείς δεν την παράγει από το bounding box των πάντων.** Το `computeFitToPaperScale(scene.bounds)`
(ADR-375 Φ.B.4) είναι εφεύρεση του Nestor χωρίς αντίστοιχο σε κανέναν από τους τέσσερις. Το
`drawingScale` του Nestor είναι **ανά επίπεδο**, δηλαδή αντιστοιχεί ακριβώς στο **Design Layer Scale**
του Vectorworks — το **σχήμα** είναι σωστό· λάθος είναι ότι η **τιμή** μαντεύεται.

#### ΑΠΟΦΑΣΗ ΤΟΥ GIORGIO (2026-08-01)

> «**Να την μαντεύει, αλλά να μπορεί και ο χρήστης να την αλλάζει όπως επιθυμεί.**»

Δηλαδή το μοντέλο AutoCAD: υπάρχει αυτόματη πρόταση, αλλά η **ρητή επιλογή του χρήστη είναι πάνω
από αυτήν**. Απορρίφθηκε το «να μη μαντεύει ποτέ». Οι (α)/(β)/(γ) **δεν** υλοποιήθηκαν — η (γ)
παραμένει ο δηλωμένος προορισμός (4ο backend του §3).

#### ΥΛΟΠΟΙΗΣΗ — δύο διορθώσεις, καμία αλλαγή μοντέλου

**1. Η επιλογή του χρήστη γίνεται ΜΟΝΙΜΗ** (`drawingScaleUserSet` πλέον persisted ανά επίπεδο).
Ήταν σημαία **μόνο συνεδρίας**: το `buildRaw` έγραφε την **τιμή** χωρίς το **κλείδωμα**, οπότε η
εγγύηση που υποσχόταν το ίδιο του το σχόλιο («a genuine re-import never overwrites a scale the user
deliberately chose») **έπαυε να ισχύει σε κάθε reload**. Άγγιξε: `BimRenderSettings` (νέο προαιρετικό
πεδίο), `ResolvedBimSettings`, `resolveBimSettings` (**αυστηρό `=== true`** ⇒ παλιά έγγραφα μένουν
AUTO), `buildRaw`, `loadForLevel`.

**2. Η μαντεψιά αποκτά ΦΡΕΝΟ** — νέο `computeAutoDrawingScale` δίπλα στο `computeFitToPaperScale`:
- `MAX_AUTO_DRAWING_SCALE` = **τελευταίο στοιχείο του `DRAWING_SCALE_PRESETS`** (500) — **παράγωγο**,
  όχι hardcoded· τα presets είναι το δηλωμένο λεξιλόγιο «κλίμακες που σχεδιάζει ο χρήστης».
- Πάνω από το ταβάνι η έκταση είναι **οικοπέδου/τοπογραφικού**, όχι **σχεδίου** ⇒ η μαντεψιά
  επιστρέφει `null` = «καμία γνώμη», **το ίδιο συμβόλαιο** που ήδη είχε για εκφυλισμένη σκηνή, άρα
  **κανένας καλών δεν χρειάστηκε νέο κλαδί**.
- ⚠️ Το ταβάνι δεσμεύει **μόνο** τον αυτόματο δρόμο (`useViewportAutoFit`). Το ρητό «Αυτόματη
  προσαρμογή» (`useFitToView` -> `annotation-fit-to-paper`) εξακολουθεί να καλεί το
  `computeFitToPaperScale` **χωρίς ταβάνι**: απάντηση που ζήτησε ρητά ο χρήστης πρέπει να είναι η
  **ειλικρινής**, όσο χοντρή κι αν είναι.

**Καλύπτει και το κείμενο** — και κάθε άλλη σημείωση: η διόρθωση είναι **πάνω** από το
`paperHeightToModel`, στην τιμή που όλοι τους διαβάζουν (κείμενο, 4 διαδρομές διαστάσεων, scale-bar,
βόρειο βέλος, ετικέτα εμβαδού). Το κείμενο 2,5 mm πάει από **12,5 m** σε **25 cm**.

**Ζωντανή επαλήθευση**: επίπεδο σε AUTO με `drawingScale: 100`, φόρτωση **χωρίς** αποθηκευμένο
viewport (ώστε να τρέξει ο αυτόματος δρόμος) ⇒ το widget έδειξε **1:100**, το έγγραφο Firestore
έμεινε **αμετάβλητο**, και ο πίνακας μετρήθηκε **267,38 → 279,63 m = 12,25 m** (πρόβλεψη 12,000·
απόκλιση 2 px του δείκτη). **600 m -> 12 m.**

**ΜΗΝ διορθωθεί με πολλαπλασιαστή στο `tableMmToWorld`**: θα έσπαγε το «οθόνη === PDF === DXF ===
σκηνή», που είναι ολόκληρο το θεμέλιο αυτού του ADR, και θα άφηνε το ίδιο ελάττωμα ζωντανό για το
κείμενο και κάθε άλλη σημείωση. **ΜΗΝ** μεταφερθεί το ταβάνι μέσα στο `computeFitToPaperScale` —
θα ακύρωνε σιωπηλά το ρητό κουμπί.

#### ⚠️ Τι ΔΕΝ λύθηκε (δηλώνεται ρητά)

- **Επίπεδο που όντως μιξάρει** τοπογραφικό 1,9 km **και** κάτοψη κτιρίου εξακολουθεί να έχει **μία**
  κλίμακα. Αυτό είναι δομικό και η λύση του είναι η **(γ)** (φύλλα/viewports) ή κλίμακα ανά **layer**
  (Vectorworks). Η παρούσα διόρθωση εγγυάται μόνο ότι η **προεπιλογή είναι χρησιμοποιήσιμη** και ότι
  **η επιλογή του χρήστη επιβιώνει**.
- **Γνήσιο σχέδιο οικοπέδου** (π.χ. 1:1000) δεν παίρνει πια αυτόματη κλίμακα — ο χρήστης τη θέτει
  **μία φορά** και πλέον **μένει**. Αυτό ακριβώς απαιτούν AutoCAD/Vectorworks.
- **Υπάρχοντα επίπεδα** με ήδη αποθηκευμένο 1:5000 **δεν** αγγίζονται (καμία migration): η διόρθωση
  πιάνει όσα δεν έχουν ακόμη κλίμακα. Διορθώνονται με ένα κλικ, που πλέον επιβιώνει.
- **Δεύτερο σύστημα κλίμακας υπάρχει ήδη** και δεν ενοποιήθηκε: `systems/viewport/ViewportStore`
  (`activeScale` + `scaleList`) + `annotationScales` ανά οντότητα + `AnnotationScaleManager` +
  `resolveAnnotativeEntity` — **ζωντανό** (`EntityRendererComposite.ts:204`) αλλά opt-in
  (`isAnnotative: false` σε **κάθε** σημείο δημιουργίας). Είναι το μοντέλο AutoCAD «λίστα κλιμάκων
  ανά αντικείμενο», ήδη χτισμένο **για κείμενο** (ADR-344 Φ11). Αν ποτέ χρειαστεί κλίμακα ανά
  πίνακα, **αυτό** είναι το SSoT που επεκτείνεται — **όχι** νέος μηχανισμός.

---

## 21. Φάση Δ βήμα 3 — **in-cell editing: ο κέρσορας μπαίνει ΜΕΣΑ στο κελί** (2026-08-01)

> «ΘΕΛΩ ΟΤΑΝ ΚΑΝΩ ΔΙΠΛΟ ΚΛΙΚ ΜΕΣΑ ΣΕ ΕΝΑ ΚΕΛΙ … ΝΑ ΜΠΑΙΝΕΙ Ο ΚΕΡΣΟΡΑΣ ΜΕΣΑ ΣΤΟ ΚΕΛΙ ΟΠΩΣ
> ΣΥΜΒΑΙΝΕΙ ΣΤΟ EXCEL ΚΑΙ ΟΧΙ ΝΑ ΑΝΟΙΓΕΙ ΑΥΤΟ ΤΟ ΜΑΥΡΟ ΠΛΑΙΣΙΟ ΓΙΑ ΝΑ ΠΛΗΚΤΡΟΛΟΓΗΣΩ.»
> — Giorgio, 2026-08-01 (με στιγμιότυπο του ελαττώματος **και** του στόχου)

### 21.1 Η αιτία ήταν **δύο σταθερές** — και μία **αρχιτεκτονική απόφαση** πίσω τους

```ts
// useTableCellDoubleClickEditor.ts:54-56 (ΠΡΙΝ)
const CELL_EDITOR_WIDTH_PX = 140;
const CELL_EDITOR_HEIGHT_PX = 24;
```

Ένα `<input>` **σταθερό 140×24 px**, με χρώματα του **θέματος της εφαρμογής**, αγκυρωμένο στην
πάνω-αριστερή γωνία του κελιού. Δεν κληρονομούσε **τίποτα**: ούτε ορθογώνιο, ούτε γραμματοσειρά,
ούτε στοίχιση, ούτε γέμισμα, ούτε την περιστροφή του πίνακα. Στην οθόνη = **μαύρο κουτάκι** με
μικροσκοπικά γράμματα, ενώ ο καμβάς ζωγράφιζε **ταυτόχρονα** το κείμενο σε κανονικό μέγεθος.

Η αιτιολόγηση ήταν ρητή στην κεφαλίδα του `TableCellEditorOverlay.tsx` — και ήταν το **δόγμα του
ADR-344**: «θέση από την προβολή, **μέγεθος + προσανατολισμός σταθερά σε screen-space»**, δανεισμένο
από το AutoCAD `MTEXTFIXED = 2`.

**Το δόγμα δεν είναι λάθος· είναι λάθος ΕΔΩ.** Η διαφορά είναι ουσιαστική:

| | ελεύθερο κείμενο (MTEXT) | **κελί πίνακα** |
|---|---|---|
| Έχει δικό του ορθογώνιο; | **όχι** | **ναι** (η διάταξη το ορίζει) |
| Έχει δική του τυπογραφία/στοίχιση; | την ορίζει το ίδιο | **ναι**, από το `TableStyle` |
| Μπορεί να είναι δυσανάγνωστο; | ναι (μικροσκοπικό / ανάποδο) | όχι περισσότερο από το κελί |
| Τι σημαίνει «σταθερό σε px»; | **ευανάγνωστο** κουτί | **ξένο** κουτί πάνω στο κελί |

Άρα η επιλογή έγινε **ανά καταναλωτή**, όχι καθολική: το `TextEditorAnchor` απέκτησε **προαιρετικό**
`projectBox()`. Απόν ⇒ η ιστορική συμπεριφορά μένει ακέραιη για το MTEXT (2D **και** 3D).

### 21.2 Έρευνα — τι κάνουν οι μεγάλοι (και πού τους ξεπερνάμε)

| Σύστημα | Πώς τοποθετεί τον in-cell editor |
|---|---|
| **Excel desktop** | πραγματικό πεδίο **στο ορθογώνιο του κελιού**, με την τυπογραφία του κελιού· **επεκτείνεται** πέρα από το κελί όταν το κείμενο δεν χωρά |
| **Google Sheets / Excel Online** | πλέγμα σε **canvas**, αλλά ένα πραγματικό **εστιασμένο** πεδίο από πάνω (ίδια αρχιτεκτονική με τη Φ.Δ βήμα 2 εδώ) |
| **Glide Data Grid** (canvas grid, MIT — διαβάστηκε ο κώδικας) | `left/top` = **ακριβώς** οι συντεταγμένες του κελιού· `min-width/min-height` = το μέγεθος του κελιού· `width: max-content` με ταβάνι 400 px· γραμματοσειρά από **θέμα** (το πλέγμα τους δεν ζουμάρει) |
| **Figma** | το κείμενο επεξεργάζεται **στην κλίμακα του καμβά** — WYSIWYG σε κάθε zoom |

**Πού πάμε παραπέρα από όλους:**
1. **Περιστροφή.** Κανένα φύλλο υπολογισμού δεν έχει στραμμένο πλέγμα· ο πίνακάς μας έχει
   `angleRad`. Ο επεξεργαστής γέρνει μαζί του, με αρχή την ίδια γωνία αγκύρωσης.
2. **Ζωντανό zoom με ΜΗΔΕΝ re-render.** Το Glide δεν ζουμάρει· το Sheets ξαναποδίδει. Εδώ οι τιμές
   ταξιδεύουν ως **CSS custom properties** που γράφει επιτακτικά το `TextEditorAnchorLayer` στο ίδιο
   tick με τη θέση (ADR-040). Μετρήθηκε ζωντανά: zoom ×15,28 ⇒ κουτί ×15,2817, γραμματοσειρά
   ×15,2812.
3. **Μία μέτρηση, όχι δύο.** Δες §21.4.

### 21.3 🔴 Η γραμμή βάσης μέσα σε `<input>` — το δύσκολο κομμάτι

Ο καμβάς τοποθετεί βάση **απόλυτα** (`fillText` + `textBaseline: 'alphabetic'`). Το DOM **δεν έχει**
«βάλε τη βάση εδώ»: ένα μονόγραμμο `<input>` **κεντράρει** το κουτί γραμμής στο content box, δηλαδή
βάζει τη βάση στο `H/2 + (A−D)/2`. Για Arial η διαφορά από τον στόχο είναι **≈ 0,15 em** — σε
γραμματοσειρά 34 px, **5 px αναπήδηση** τη στιγμή του διπλού κλικ.

Λύση **κλειστού τύπου**, όχι μαγικός αριθμός (`table-cell-editor-frame.ts`):

```
βάση = padTop + (H − padTop − padBottom)/2 + (A − D)/2
  ⇒  padTop    = 2·(στόχος − H/2 − (A−D)/2)        όταν ο στόχος είναι ΚΑΤΩ από το κέντρο
  ⇒  padBottom = H − 2·(στόχος − (A−D)/2)          όταν είναι ΠΑΝΩ
```

Ένα από τα δύο σκέλη ισχύει πάντα (το padding δεν γίνεται αρνητικό). Δηλώνεται **και** `line-height`
ίσο με το content box: αν το κουτί γραμμής είναι ακριβώς όσο το content box, οι δύο ασύμφωνες
συμπεριφορές των μηχανών («κεντράρω» vs «τιμώ το line-height») γίνονται **αριθμητικά ταυτόσημες** —
ο τύπος παύει να εξαρτάται από τη μηχανή.

### 21.4 Η **μία** μηχανή μέτρησης — η απάντηση στο «μη μετράς δύο φορές»

Το ερώτημα του handoff ήταν: *αν ο καμβάς και το DOM μετρήσουν χωριστά, ο κέρσορας θα πέφτει σε λάθος
γράμμα.* Η απάντηση **δεν** είναι «δεύτερη, καλύτερη μέτρηση» — είναι ότι **δεν υπάρχει δεύτερη**:

- `tableCellFont(fontPx, bold)` (νέα, στο `stamp-table-layout.ts`) παράγει **ένα** αλφαριθμητικό
  που δέχονται **και** το `ctx.font` του ζωγράφου **και** το CSS `font` shorthand του `<input>`.
- `table-cell-text-metrics.ts` μετρά με `ctx.measureText` και **αυτό ακριβώς** το αλφαριθμητικό.

Ίδια μηχανή του browser, ίδιο μέγεθος, ίδια οικογένεια ⇒ οι δύο μετρήσεις **είναι** η ίδια μέτρηση.
Απόκλιση δεν είναι «απίθανη» — είναι **αδύνατη εξ ορισμού**.

Δύο σημειώσεις που κοστίζουν αν ξεχαστούν:
- **`fontBoundingBox*`, ΠΟΤΕ `actualBoundingBox*`.** Το `text-vertical-metrics.ts` καταγράφει
  μετρημένο περιστατικό όπου το δεύτερο επέστρεψε σκουπίδια στη μηχανή του Giorgio
  (`cssInkAscent = −17`). Και σημασιολογικά μόνο το πρώτο απαντά στο ερώτημα («πώς στοιχίζει **το
  CSS** το κουτί γραμμής») — αυτό ορίζεται από τα μετρικά της **γραμματοσειράς**, όχι από τα γράμματα.
- **Η ζώνη απομνημονεύεται ως ΑΝΑΛΟΓΙΑ** (μετρημένη σε 200 px αναφοράς), όχι σε px. Σε κάθε καρέ zoom
  το μέγεθος αλλάζει· cache με κλειδί το πλήρες αλφαριθμητικό θα αστοχούσε **σε κάθε καρέ** και θα
  μεγάλωνε όσο κρατά η χειρονομία. Με αναλογία: **το πολύ δύο εγγραφές**.
- **ΟΧΙ** `rendering/cache/TextMetricsCache`: μετρά με `` `${fontSize}px ${fontFamily}` `` — **αγνοεί
  το βάρος**. Οι κεφαλίδες είναι `bold`, άρα θα έδινε συστηματικά στενότερο πλάτος και ο κέρσορας θα
  έπεφτε όλο και πιο αριστερά όσο προχωρά η λέξη. Δεν είναι SSoT για αυτό το ερώτημα.

### 21.5 🔴 Το SSoT audit βρήκε **δεύτερη, αποκλίνουσα** προβολή κόσμου→οθόνης

Ζωντανή μέτρηση έδειξε το κουτί μετατοπισμένο **≈ 30 px αριστερά και ≈ 23 px κάτω**. Αιτία: το
`text-editor-anchor-2d.ts` έγραφε **δική του** εκδοχή του `worldToScreen`:

```ts
x: rect.left + world.x * scale + offsetX,
y: rect.top + (container.clientHeight - world.y * scale - offsetY),
```

Είναι ο σωστός τύπος **χωρίς τους χάρακες**. Η αρχή του κόσμου δεν κάθεται στην κάτω-αριστερή γωνία
του **container** αλλά της **περιοχής σχεδίασης** (`rendering/core/drawing-area.ts`), μικρότερης κατά
`leftRulerWidth` / `bottomRulerHeight`. Το σφάλμα ήταν **σταθερή μετατόπιση** — αόρατη σε ένα ελεύθερα
αιωρούμενο κουτί TipTap, **μετρήσιμη** μόλις το κουτί έπρεπε να καθίσει *πάνω στο κελί*.

Το χαρακτηριστικό του διπλότυπου (N.18): η **αντίστροφη** διαδρομή — το `eventWorldPoint` του διπλού
κλικ — καλούσε **ήδη** το `CoordinateTransforms.screenToWorld`, δηλαδή τη σωστή, margin-aware μηχανή.
Οι δύο κατευθύνσεις της **ίδιας** προβολής είχαν διαφορετική άποψη για το πού είναι η αρχή. Τώρα και
οι δύο περνούν από το ένα SSoT. **Ωφελούνται και οι τρεις καταναλωτές** (κελί, MTEXT, εργαλείο
κειμένου) — το MTEXT ήταν μετατοπισμένο κι αυτό, απλώς κανείς δεν είχε τι να το συγκρίνει.

### 21.6 Η διπλή ζωγραφική — και γιατί ο καμβάς **δεν** αρκεί να παραλείψει

Ο ζωγράφος παραλείπει πλέον το κείμενο του κελιού με **ανοιχτή συνεδρία γραφής**
(`stampTableText(rc, cells, skip)`), και **μόνο** τότε: σε κατάσταση `nav` το `<input>` είναι
διαφανές, οπότε παράλειψη θα «έσβηνε» κείμενο που κανείς δεν άλλαξε. Η απόφαση παίρνεται στο **ίδιο**
σημείο με τον δρομέα — μία ανάγνωση του store ανά καρέ, όχι δύο.

**Αυτό δεν αρκεί, και δηλώνεται ρητά.** Το δεσμευμένο κείμενο ζει **και** μέσα στο cached raster, και
το κλειδί του cache **δεν δέχεται** διαδραστική κατάσταση (ADR-040: *«this change only ever REMOVES
inputs from the key»*) — ένα `edit`-flag εκεί θα ζητούσε πλήρη ανακατασκευή N οντοτήτων σε κάθε διπλό
κλικ. Άρα το κείμενο του raster **σκεπάζεται**: το `<input>` έχει **αδιαφανές** φόντο = το γέμισμα του
κελιού, ή — σε κελί χωρίς γέμισμα — το φόντο του καμβά (`resolveDxfCanvasBackgroundHex`, διαβασμένο
**μία φορά ανά συνεδρία**: είναι `getComputedStyle`, δηλαδή style recalc, και δεν επιτρέπεται στον
βρόχο του zoom). Ακριβώς αυτό κάνει και το Excel.

### 21.7 Ο κέρσορας πέφτει στο **γράμμα που έδειξες** (Excel)

Ο στόχος επεξεργασίας κουβαλά πλέον `clickOffsetMm` = η οριζόντια απόσταση **μέσα στο κελί**·
`undefined` για `Tab`/`F2`/βέλη, που δεν έχουν σημείο ⇒ κέρσορας στο τέλος. Ο δείκτης χαρακτήρα
επιλέγεται στο **πλησιέστερο όριο** (κλικ στο δεξί μισό ενός γράμματος ⇒ κέρσορας **μετά** από αυτό)
— η συμπεριφορά κάθε επεξεργαστή κειμένου· «ποιος χαρακτήρας περιέχει το σημείο» δίνει μονίμως έναν
δείκτη λιγότερο.

### 21.8 SSoT audit — τι επαναχρησιμοποιήθηκε, τι γεννήθηκε

| Ερώτημα | Πού απαντήθηκε | Νέο; |
|---|---|---|
| πλαίσιο → κόσμος | `tableFrameToWorld` | **όχι** (καμία δεύτερη αναστροφή y) |
| κόσμος → οθόνη | `CoordinateTransforms.worldToScreen` | **όχι** — αντίθετα, **σβήστηκε** ένα διπλότυπο (§21.5) |
| px οθόνης ανά sheet-mm | `tablePxPerMm` | **εξαγωγή** — ήταν έκφραση μέσα στον `TableRenderer`, τώρα την μοιράζονται ζωγράφος + επεξεργαστής |
| γραμμή βάσης κελιού | `cellBaselineYMm` | **εξαγωγή** από το `table-layout-place.ts` (ήταν ιδιωτική) |
| οριζόντια στοίχιση κενού κελιού | `TableCellLayout.hAlign` | **νέο πεδίο**, γραμμένο από την **ίδια** έκφραση με το `text.hAlign` — ένα κενό κελί δεν έχει `text`, αλλά έχει στοίχιση |
| γραμματοσειρά κελιού | `tableCellFont` | **εξαγωγή** από το `stampRun` |
| mm → px CSS + γεμίσεις + περιστροφή | `table-cell-editor-frame.ts` | **νέο** (καθαρό, μηδέν DOM) |
| μετρικά γραμματοσειράς / δείκτης κέρσορα | `table-cell-text-metrics.ts` | **νέο** (ο μόνος τόπος με `measureText` για κελιά) |
| ονόματα CSS custom properties | `table-cell-editor-vars.ts` | **νέο** — αλφαριθμητικό γραμμένο σε δύο αρχεία δεν το ελέγχει **κανένας** μεταγλωττιστής |

⚠️ **Γνωστό, καταγεγραμμένο χρέος:** ο καμβάς ζωγραφίζει πάντα `'arial'` (καρφωμένο στο `stampRun`),
ενώ ο **μετρητής διάταξης** τιμά το `TableCellStyle.fontFamily` (opentype, ADR-557). Ο επεξεργαστής
ακολουθεί **ό,τι ζωγραφίζεται**, γιατί αυτό είναι που πρέπει να καλύψει. Η ενοποίηση των δύο είναι
ξεχωριστό βήμα.

### 21.9 Τι ρητά **ΔΕΝ** κάνει το βήμα 3

- **Δεν επεκτείνεται πέρα από το κελί** όταν το κείμενο δεν χωρά (το Excel το κάνει· το Glide με
  `width: max-content`). Το `<input>` κυλά εσωτερικά, όπως AG Grid / Handsontable. Λόγος: η
  κατεύθυνση επέκτασης εξαρτάται από στοίχιση **και** περιστροφή, δηλαδή είναι δικό της βήμα.
- **Δεν έχει γραμμή τύπων** (Φ.Δ.4), **επιλογή περιοχής** (Φ.Δ.5), **λαβή συμπλήρωσης** (Φ.Δ.6),
  **μορφοποίηση** (Φ.Δ.7) ή **τύπους** (Φ.Δ.8). Ο Giorgio ζήτησε **σταδιακά**.
- **Το κείμενο του κελιού δεν περικόπτεται** στο ορθογώνιό του στον καμβά (`fillText` χωρίς clip).
  Αν ένα κελί ξεχειλίζει, η ουρά του **μένει** ορατή από το raster όσο επεξεργάζεσαι. Η περικοπή
  αφορά **και τα τέσσερα** backends (οθόνη/PDF/DXF/σκηνή) — δεν αποφασίζεται εδώ.
- **Το clamping του `TextEditorAnchorLayer` παραμένει**: αν το κελί βγει εκτός οθόνης, το κουτί
  κρατιέται στο viewport και **παύει** να είναι ευθυγραμμισμένο. Το Excel αντ' αυτού **κυλά** τη
  θέα. Συνειδητά αμετάβλητο — είναι συμπεριφορά του κοινού layer, όχι του κελιού.

### 21.10 Επαλήθευση — **ζωντανά, με δεδομένα και όχι με οθόνη**

Πλήρες reload (παγίδα: το HMR δεν είναι αξιόπιστο), και μετά **ανεξάρτητη απόδειξη**: το ορθογώνιο
του κελιού μετρήθηκε από τα **πίξελ του ίδιου του καμβά** (σάρωση του γεμίσματος `#EDEDED`) και
συγκρίθηκε με το `getBoundingClientRect()` του DOM κουτιού.

| Μέτρηση | Αποτέλεσμα |
|---|---|
| κουτί DOM vs ορθογώνιο κελιού | Δx = −1,6 px · Δy = −3,1 px — **ακριβώς** το μισό πάχος του περιγράμματος (Δw = 3,5 · Δh = 6,7), δηλαδή **κεντραρισμένο πάνω στο κελί** |
| γραμμή βάσης: διάταξη (5,5 mm × 11,306 px/mm) | **529,00** |
| γραμμή βάσης: DOM (από το CSS που υπολόγισε ο browser) | **529,21** |
| γραμμή βάσης: καμβάς (μελάνι του «Π» στο **γειτονικό** κελί) | **528,68** |
| **απόκλιση** | **0,53 px σε γραμματοσειρά 34 px = 1,5 % του em** (εντός antialiasing) |
| zoom ×15,28 | κουτί **×15,2817** · γραμματοσειρά **×15,2812** |
| κέρσορας από διπλό κλικ | δείκτης **4** και **7** για δύο διαφορετικά σημεία του ίδιου κειμένου |
| παράλειψη κειμένου | κελί υπό επεξεργασία: καθαρό στο overlay pass· **γειτονικό**: 221 px μελανιού — η παράλειψη είναι **στοχευμένη** |
| `Escape` | πρόχειρο άδειασε, `opacity → 0`, **μοντέλο αμετάβλητο** |
| `Tab` | δρομέας μετακινήθηκε, το «Περιγραφή» **ξαναζωγραφίστηκε** από τον καμβά (η παράλειψη είναι mode-gated) |
| έγγραφο | **και οι δύο πίνακες αμετάβλητοι** — μηδέν εγγραφή στα δεδομένα του Giorgio |

⚠️ **Artifact του browser tool που θα ξαναεμφανιστεί** (τρίτο στη σειρά, μετά τα δύο του §19.10.α):
μια ενδιάμεση κλήση JS μπορεί να προκαλέσει blur/refocus στο `<input>`. Τότε το `handleBlur` κάνει
`commit()`, ο φρουρός «μία φορά» (`settledRef`) κλειδώνει, και το `Escape` **παύει να καταναλώνεται**
(`canHandle: () => !settledRef.current`). Φαίνεται ακριβώς σαν σοβαρό bug· δεν είναι — σε καθαρή
ακολουθία πλήκτρων το `Escape` δουλεύει. Το `window.__escapeAudit.last()` το δείχνει αμέσως
(`consumedBy: null`).

---

## 22. Φάση Δ βήμα 4 — **ΛΕΙΤΟΥΡΓΙΑ EXCEL: αποκοπή του πληκτρολογίου από τον καμβά** (2026-08-01)

> Ζητούμενο (Giorgio): «να μπαίνουμε μέσα στον πίνακα μέσω μιας εντολής, ας πούμε **Edit**, και εκεί
> να ισχύουν οι συντομεύσεις του Excel — δηλαδή να γίνεται μια **αποκοπή της επεξεργασίας από το
> περιβάλλον του καμβά**.»

### 22.1 🔴 Το πρόβλημα ΔΕΝ ήταν το scope — και το scope μόνο του δεν έλυνε τίποτα

Το SSoT υπήρχε ήδη (`src/lib/a11y/keyboard-scope.ts`, ADR-711): σωρός με βάθος, `pushModalKeyboardScope()`.
**Κανένα δεύτερο σύστημα scope δεν γράφτηκε.** Το audit όμως έδειξε ότι η προφανής υλοποίηση —
«πάτα το scope και τελείωσες» — θα ήταν **σχεδόν no-op**:

Το `<input>` του δρομέα κελιού είναι `autoFocus` και **δεν κλείνει ποτέ** όσο υπάρχει δρομέας (§20.4).
Άρα `isTextEntryTarget(<input>) === true` ⇒ `shouldGlobalShortcutYield === true` για **όλους** τους
listeners που περνούν από τον wrapper — **ήδη πριν από αυτό το βήμα**. Το scope προσθέτει τη *δεύτερη*
ασφάλεια («είμαι μέσα στον πίνακα ακόμα κι αν η εστίαση έφυγε»), όχι την πρώτη.

Η πραγματική δουλειά ήταν αλλού, και **μετρήθηκε αντί να υποτεθεί**.

### 22.2 Η μέτρηση — 38 εγγραφές keydown, ταξινομημένες

Το grep του προηγούμενου handoff (`window.addEventListener('keydown'`, μονά εισαγωγικά) έβρισκε **36**.
Ευρύτερο grep (διπλά εισαγωγικά **και** `document.`) βρίσκει **38** — δύο τυφλά σημεία που κανείς δεν
είχε δει (`bim-3d/accessibility/use-bim-entity-proxy-accessibility.ts`, `debug/enterprise-cursor-crosshair-test.ts`).

| Φύλακας | Πλήθος | Παραιτούνται μέσα στον πίνακα; |
|---|---|---|
| SSoT (`shouldGlobalShortcutYield`) | 4 | ✅ |
| χειροκίνητος (`tagName === 'INPUT'`…) | 10 | ✅ (ο στόχος **είναι** `<input>`) |
| μόνο `document.activeElement` | 4 | ✅ |
| **κανένας** | **20** | ❌ — αυτοί ήταν το ερώτημα |

**Ανάλυση των 20 ασκέπαστων** (η απάντηση στο «ποιοι πυροδοτούν πραγματικά»):

| Κατηγορία | Πλήθος | Γιατί δεν κλέβουν πλήκτρο Excel |
|---|---|---|
| by design εκτός | 2 | modifier tracker · Dynamic Input (κατέχει το πεδίο του) |
| μόνο debug F-keys | 4 | `F3`, `Ctrl+F2`… — καμία επικάλυψη με Excel |
| νεκρό αρχείο παραδείγματος | 1 | `tests-modal/examples` |
| μόνο 3D | 4 | δεν είναι μονταρισμένα στον 2D καμβά |
| **καθαροί modifier trackers** | 5 | πιάνουν **μόνο** `Shift`/`Control` — δεν εκτελούν εντολή |
| **ψευδώς θετικό** | 1 | `useEnhancedSelection.ts`: ο listener ζει μέσα σε **JSDoc σχόλιο** |
| φραγμένο & αμοιβαία αποκλειόμενο | 1 | `QuickPropertiesMiniPanel` — ανοίγει σε **γραμμή**, όχι σε πίνακα |
| 🔴 **ΠΡΑΓΜΑΤΙΚΟΣ ΚΛΕΦΤΗΣ** | **1** | `useCommandHistory` — `Ctrl+Z`/`Ctrl+Y`, ωμός, χωρίς φύλακα |

Και **ένας ακόμη εκτός λίστας**: `hooks/drawing/attach-image-tool.ts` (`Enter`) — μπήκε με το ADR-736,
ρωτούσε **μόνο** «γράφει ο χρήστης;» (`isTextEntryFocused`) και ποτέ «κατέχει modal το πληκτρολόγιο;».
Άφηνε τον ratchet του `keyboard/__tests__` **κόκκινο στο main** και δεν το είχε δει κανείς.

> **Συμπέρασμα: 2 από 38 έκλεβαν πραγματικά πλήκτρα Excel. Και οι δύο μετανάστευσαν στον wrapper.**
> Η μαζική μετατροπή των «36» θα ήταν 34 άσκοπες αλλαγές σε αρχεία που ήδη παραιτούνται.

### 22.3 Η μηχανή καταστάσεων — **καμία νέα κατάσταση**

Ζητήθηκε ένα «τρίτο, εξωτερικό» επίπεδο πάνω από τα `nav`/`enter`/`edit`. **Υπάρχει ήδη** και είναι
`cursor !== null`. Ένα νέο `isInTableMode` θα ήταν δεύτερη αλήθεια για το ίδιο γεγονός — και η πρώτη
φορά που θα απέκλιναν θα ήταν ένα **κλειδωμένο πληκτρολόγιο**.

### 22.4 🔴 Το σφάλμα που βρέθηκε γράφοντας το test: **ο viewer ΜΠΟΡΟΥΣΕ να κλειδώσει**

Το scope δένεται σε **`overlay !== null`**, όχι σε `cursor !== null`. Η διαφορά είναι η γραμμή που
αποφασίζει αν ο viewer κλειδώνει για πάντα: `overlay` είναι `null` όποτε λείπει οτιδήποτε από τα τρία
(δρομέας, ζωντανός στόχος, αγκύρωση), δηλαδή ταυτίζεται με «υπάρχει εστιασμένο `<input>` που κατέχει
τα πλήκτρα». Δεν μπορεί να υπάρξει «scope πατημένο αλλά κανείς δεν ακούει».

Γράφοντας το test για τον δρόμο «undo που σβήνει τον πίνακα», βρέθηκε **πραγματικό ελάττωμα**:

```
const target = useMemo(() => { …resolveTableById(levelManager, …)… }, [cursor, levelManager]);
```

Ο memo **διάβαζε τη σκηνή** αλλά δήλωνε δύο εξαρτήσεις που **δεν αλλάζουν ποτέ** όταν αλλάζει η σκηνή:

- το `levelManager` είναι τιμή React context και το `getLevelScene` του είναι `useCallback(…, [])`
  πάνω σε **ref** (`LevelsSystem.tsx:177`) — η ταυτότητα του context μένει ίδια σε κάθε `setLevelScene`·
- ο `cursor` αλλάζει σε **κάθε πάτημα πλήκτρου** (το πρόχειρο ζει μέσα του).

**Το δεύτερο έκρυβε το πρώτο**: όσο ο χρήστης πληκτρολογούσε όλα φαίνονταν σωστά. Σε αλλαγή σκηνής
**χωρίς** αλλαγή δρομέα — δηλαδή σε **undo / διαγραφή πίνακα / αλλαγή επιπέδου** — ο memo κρατούσε
μπαγιάτικο `target`, το overlay έμενε μονταρισμένο πάνω σε πίνακα **που δεν υπάρχει**, και το modal
scope έμενε πατημένο: **κανένα πλήκτρο του καμβά μέχρι reload**.

Η διόρθωση **δεν** είναι φύλακας που κλείνει τον δρομέα (θα σκότωνε τη συνεδρία γραφής σε κάθε
παροδικά αποτυχημένη ανάγνωση σκηνής — η παλινδρόμηση του §20.6). Η ανάγνωση ανέβηκε **έξω** από τον
memo (`liveEntity`), και ο memo δηλώνει επιτέλους ό,τι πραγματικά διαβάζει.

### 22.5 Έρευνα — τι κάνουν οι μεγάλοι

| Πηγή | Τι λέει | Τι πήραμε |
|---|---|---|
| **WAI-ARIA APG «Grid»** | *«Escape: restores grid navigation. If content was being edited, it may also undo edits.»* · `Enter`/`F2`/αλφαριθμητικό μπαίνουν σε edit · μέσα σε edit τα βέλη πάνε στο widget | Επικυρώνει **αυτούσιο** το υπάρχον `nav`/`enter`/`edit`· από εδώ το `Enter`/`F2` ως είσοδοι |
| **Excel** | **τέσσερις** καταστάσεις: Ready / Enter / Edit / **Point** | Η `Point` (επιλογή κελιού μέσα σε τύπο) καταγράφεται **τώρα** για τη Φ.Δ.11 — η μηχανή δεν θα χρειαστεί ξαναγράψιμο |
| **AutoCAD `TABLEDIT`** | εντολή που ενεργεί πάνω σε **επιλεγμένο** πίνακα | Το alias `TABLEDIT`/`TE` |
| **Figma** (object edit mode) | χαρακτηρίζεται *«feature που ανάβει κατά λάθος και οι χρήστες το μισούν αμέσως»*, με κόσμο να πατά `Esc` στα τυφλά | **Αρνητικό πρότυπο**: η ορατή ένδειξη και η αξιόπιστη έξοδος είναι **απαιτήσεις**, όχι διακόσμηση |
| **VS Code** `when`-clause contexts | δηλωτικά keybindings αντί για σκορπισμένα `if` | Το «έξυπνο ερώτημα» του handoff, υλοποιημένο ως **test σύγκρουσης ονομάτων** (§22.7) |

### 22.6 Οι τέσσερις αποφάσεις (εγκρίθηκαν από τον Giorgio πριν τον κώδικα)

| # | Ερώτημα | Απόφαση |
|---|---|---|
| 1 | **Πώς μπαίνεις;** | Και τα τρία: **διπλό κλικ** (υπάρχει, με σημείο ⇒ `edit` στο γράμμα) · **`Enter`** ⇒ `nav` στο 1ο κελί · **`F2`** ⇒ `edit` στο 1ο κελί (APG/Excel) · εντολή **`TABLEDIT`/`TE`** ⇒ `nav` (AutoCAD) |
| 2 | **Πώς βγαίνεις;** | **Σκάλα 3 σκαλιών**: `Esc`#1 ακυρώνει τη γραφή (μένεις στο κελί) · `Esc`#2 βγαίνεις, ο πίνακας μένει **επιλεγμένος** · `Esc`#3 αποεπιλογή. Συν κλικ έξω, undo/διαγραφή, αλλαγή επιπέδου |
| 3 | **Πώς φαίνεται;** | Γραμμή κατάστασης «**Πίνακας · Έτοιμο/Καταχώριση/Επεξεργασία · Esc για έξοδο**» **+ διακεκομμένο περίγραμμα** γύρω από **ΟΛΟ** τον πίνακα στον καμβά |
| 4 | **Τι επιβιώνει;** | **Μηδέν** συντομεύσεις σχεδίασης. Επιβιώνουν: pan μεσαίου κουμπιού, zoom ροδέλας (δεν είναι πλήκτρα), `Esc`, `Ctrl+S`, `F1`, οι modifier trackers. **`Ctrl+Z` = Excel** (§22.8) |

**Η σκάλα του `Esc` δεν χρειάστηκε νέο slot**: το `useInlineEditorKeys` ήδη διεκδικεί στο
`ESC_PRIORITY.MODAL_DIALOG` και το `handleCancel` ήδη διακλαδίζει σε `nav`/γραφή· ο νέος `sessionId`
στήνει καθαρό `<input>` με καθαρό `settledRef`, ώστε το **δεύτερο** `Esc` να φτάσει. Το τρίτο πέφτει
στον υπάρχοντα σύνθετο αποεπιλογέα (`DRAFT_POLYGON`, 400). Η δουλειά ήταν να **αποδειχθεί**, όχι να
ξαναχτιστεί — ίδιο σχήμα με `GROUP_EXIT` (408) / `BLOCK_EDITOR_EXIT` (407): ο πίνακας είναι το **τρίτο
drill-in** της εφαρμογής.

### 22.7 Το δεύτερο μητρώο εντολών — και το τίμημά του

Το `CommandAliasRegistry` χαρτογραφεί `alias → ToolType` και ο εκτελεστής του κάνει **ένα** πράγμα:
`selectTool(toolId)`. Το `TABLEDIT` **δεν οπλίζει εργαλείο** — ενεργεί πάνω στην επιλογή. Ένα ψεύτικο
`ToolType` θα μόλυνε το SSoT των εργαλείων με κάτι χωρίς εικονίδιο, κατηγορία, δρομέα ή συμπεριφορά κλικ.

Γεννήθηκε το `CommandActionRegistry` (ονόματα = **δεδομένα**· εκτελεστής = **εγγραφή σε χρόνο
εκτέλεσης**, ίδιο σχήμα με τον `EscapeCommandBus`). Δύο μητρώα όμως μοιράζονται **έναν** χώρο ονομάτων,
και η αστοχία θα ήταν **σιωπηλή**: κάποιος προσθέτει `TE` ως συντόμευση του `TEXT` και το `TABLEDIT`
παύει να φτάνει ποτέ. Γι' αυτό υπάρχει `__tests__/command-alias-namespace.test.ts` που αποδεικνύει
**μηδενική τομή** — η δηλωτική ιδέα του VS Code ως εκτελέσιμος έλεγχος.

### 22.8 `Ctrl+Z` — η απόφαση που **αντιστράφηκε**

Μέχρι το βήμα 3 το `table-cell-key-intent.ts` άφηνε τα `Ctrl`/`Meta` ανέγγιχτα, με ρητή αιτιολογία:
«ένα κελί που τρώει το undo του χρήστη είναι χειρότερο από ένα κελί χωρίς πλοήγηση». Ήταν **σωστό όσο**
ο καμβάς άκουγε ακόμα. Τώρα ο `useCommandHistory` παραιτείται ⇒ χωρίς διεκδίκηση, το `Ctrl+Z` μέσα
στον πίνακα δεν θα έκανε **τίποτα**. Η ίδια αρχή απαιτεί το αντίθετο:

- **πλοήγηση** → αναίρεση της τελευταίας **επεξεργασίας κελιού**. Δεν χρειάστηκε δεύτερο ιστορικό:
  κάθε δέσμευση κελιού είναι ήδη `UpdateEntityCommand` στο **ίδιο** ιστορικό.
- **γραφή** → αναίρεση της **πληκτρολόγησης**, που την κάνει ο browser στο `<input>` ⇒ `passthrough`.
  Κάθε συνθετικό undo θα έσπαγε τη στοίβα του πεδίου, τους νεκρούς τόνους και το IME.

⚠️ Ο έλεγχος γίνεται στο **`event.code`** (`KeyZ`/`KeyY`), ποτέ στο `key`: σε **ελληνική διάταξη** το
`key` του ίδιου πλήκτρου είναι `'ζ'`. Ο `useCommandHistory` είχε ήδη κάνει αυτή την επιλογή· τηρείται.

### 22.9 SSoT audit — τι επαναχρησιμοποιήθηκε, τι γεννήθηκε

| Επαναχρησιμοποιήθηκε | Γεννήθηκε | Γιατί |
|---|---|---|
| `keyboard-scope.ts` (**μηδέν αλλαγές**) | — | το scope SSoT υπήρχε |
| `global-shortcut-listener.ts` (**μηδέν αλλαγές**) | — | ο δομικός φύλακας υπήρχε |
| `useInlineEditorKeys` + `ESC_PRIORITY` | — | η σκάλα Esc υπήρχε· αποδείχθηκε |
| `table-cell-cursor-store` | — | το «είμαι μέσα» **είναι** ο δρομέας |
| — | `table-entity-lookup.ts` | 3 είσοδοι ρωτούν το ίδιο· **εξαγωγή** πριν το τρίτο αντίγραφο (N.18) |
| — | `use-table-mode-entry.ts` | οι είσοδοι **χωρίς σημείο** |
| — | `CommandActionRegistry.ts` | εντολές που δεν οπλίζουν εργαλείο (§22.7) |
| — | `StatusBarActiveTableLeaf.tsx` | τρίτο αδελφάκι ομάδας/μπλοκ |
| — | `tableFirstCursorPosition` | προσγείωση χωρίς σημείο, με σεβασμό στις συγχωνεύσεις |
| `stampTableCellCursor` → κοινός `strokeRectMm` | `stampTableModeOutline` | δύο δείκτες, **ένας** χάρακας — αλλιώς sibling clone |

### 22.10 🔴 Το **δεύτερο** σφάλμα — το βρήκε ΜΟΝΟ ο browser: `F2` έσβηνε το κελί

Με `F2` πάνω στο κελί τίτλου «ΠΙΝΑΚΑΣ», ο επεξεργαστής άνοιγε **κενός**. Το επόμενο `Tab`/`Enter`
θα έκανε `commit('')` ⇒ **απώλεια δεδομένων από πάτημα πλοήγησης**.

Καμία μονάδα δεν το έβλεπε γιατί **κάθε συστατικό ήταν σωστό μόνο του**: ο δρομέας δέχεται πρόχειρο,
ο επεξεργαστής δεσμεύει το πρόχειρο, και το `F2` **μέσα** στον πίνακα (`nav → edit`) σπέρνει σωστά
το κείμενο μέσω `setTableCellCursorMode(…, initialText)`. Η λανθασμένη αναλογία ήταν να θεωρηθεί ότι
το ίδιο ισχύει και για το `F2` ως **είσοδο** — εκεί όμως **δεν υπάρχει ακόμη επεξεργαστής** για να το
σπείρει. Αν δεν σπαρθεί στην είσοδο, δεν σπέρνεται πουθενά.

Ο αναλλοίωτος που κλειδώθηκε: **`draft === initialText`** τη στιγμή της εισόδου σε `edit`. Το
`use-table-mode-entry.test.tsx` τον αποδεικνύει· η μετάλλαξη «κενό πρόχειρο» τον κάνει κόκκινο.

> **Το μάθημα**: το §11.10 του handoff («ζωντανό verify με ανεξάρτητη απόδειξη») δεν είναι
> τελετουργικό. Δύο σφάλματα βρέθηκαν σε αυτό το βήμα και **κανένα** από τα δύο δεν ήταν ορατό στη
> λογική — το πρώτο (§22.4) φάνηκε γράφοντας το test, το δεύτερο **μόνο** στην οθόνη.

### 22.11 Επαλήθευση

- **676/676 tests** (35 suites): πίνακας, πληκτρολόγιο, γραμμή εντολών, a11y, state.
- **Νέα**: `table-mode-keyboard-scope.test.tsx` (8) — ελέγχει **έναν αριθμό**, το βάθος του σωρού, σε
  **κάθε** δρόμο εξόδου· συν την **αρνητική** απόδειξη ότι το `Esc`#1 **δεν** σε βγάζει έξω (χωρίς
  αυτήν, μια υλοποίηση που πετά τον χρήστη στο πρώτο `Esc` θα περνούσε). `use-table-mode-entry.test.tsx`
  (11) — με πρώτο το «`F2` ΔΕΝ σβήνει το κελί». `command-alias-namespace.test.ts` (18).
- **7/7 μεταλλάξεις** επαληθευμένες κόκκινες: scope σε `cursor` αντί `overlay` · memo με τις παλιές
  ψεύτικες εξαρτήσεις · `Ctrl+Z` και σε γραφή · σύγκριση χαρακτήρα αντί `code` (ελληνική διάταξη) ·
  σύγκρουση ονομάτων μητρώων · νέος ωμός listener · κενό πρόχειρο στο `F2`.
- **Ζωντανά** (πλήρες reload, σκηνή 1.955 οντοτήτων, **δεδομένα όχι στιγμιότυπα**):
  `Enter` ⇒ «Πίνακας · **Έτοιμο** · Esc για έξοδο» · `F2` ⇒ «Πίνακας · **Επεξεργασία**» ·
  🔴 **`L` μέσα στον πίνακα: εργαλείο έμεινε «Επιλογή», γραμμή εντολών έμεινε κενή, ο χαρακτήρας
  μπήκε στο κελί** και η κατάσταση πήγε «Καταχώριση» — η αποκοπή, μετρημένη. Διακεκομμένο περίγραμμα
  ορατό γύρω από τον πίνακα. Ένα `Esc` καταναλώθηκε επιβεβαιωμένα από
  `table-cell-editor/table-cell-cursor`.
- ⚠️ **Τι ΔΕΝ επαληθεύτηκε ζωντανά και γιατί**: η πλήρης σκάλα `Esc`#1→#2→#3 σε μία ροή. Κάθε
  round-trip του browser tool προκαλεί blur/refocus στο `<input>` ⇒ `handleBlur` ⇒ `commit()` ⇒ ο
  φρουρός `settledRef` κλειδώνει ⇒ το `Escape` παύει να καταναλώνεται (`busDispatched: true`,
  `consumedBy: null`). Είναι το **τεκμηριωμένο artifact** του εργαλείου (παγίδα #11), όχι σφάλμα —
  και επιβεβαιώθηκε με `window.__escapeAudit.last()`. Η σκάλα καλύπτεται από τα 8 unit tests.
  Ομοίως, το «`F2` σπέρνει το κείμενο» φάνηκε ζωντανά **μόνο** ως `draft === initialText` σε **κενό**
  κελί: οι δύο πίνακες της σκηνής επικαλύπτονται και το κλικ έπεφτε πάντα στον κενό. Δεν γράφτηκε
  δοκιμαστικό κείμενο στο έγγραφο του χρήστη για να δειχθεί σε μη-κενό κελί.
- **Ο ratchet ωμών listeners μειώθηκε κατά 2** και ξανάγινε πράσινος (ήταν κόκκινος στο main).
- `jscpd:diff` **καθαρό** σε 13 αρχεία (τα δικά μου **και** τα πρότυπα που καθρεφτίζω).
- ❌ **ΟΧΙ `tsc`** (N.17). ❌ **ΟΧΙ commit** (N.(-1)).

---

## 23. Φάση Δ βήμα 5 — **ΤΟ ΚΕΙΜΕΝΟ ΤΟΥ ΚΕΛΙΟΥ ΜΕΣΑ ΣΤΟ ΟΡΘΟΓΩΝΙΟ ΤΟΥ** (2026-08-01)

### 23.1 Το πρόβλημα — μετρημένο, όχι υποθετικό

```bash
grep -rniE "overflow|ellips|truncat|clipText" --include=*.ts \
  src/subapps/dxf-viewer/bim/table/ src/subapps/dxf-viewer/rendering/entities/table/
# → ΜΗΔΕΝ αποτελέσματα (επαληθεύτηκε ξανά 2026-08-01)
```

Δεν υπήρχε **καμία** λογική περικοπής πουθενά στον πίνακα — ούτε στον υπόλοιπο viewer (ευρύτερο
grep για `ellips|truncat|…` σε όλο το `dxf-viewer`: μόνο ένα codepoint στον χάρτη cp1252 του
`encoding-service.ts`). Άρα κείμενο που δεν χωρούσε ζωγραφιζόταν **πάνω από τα περιγράμματα**, και
στα τέσσερα backends. Για εργαλείο που παράγει **εκτυπώσιμα σχέδια** αυτό δεν είναι αισθητικό
ελάττωμα· είναι **άχρηστο παραδοτέο**.

⚠️ **Η σειρά Φ.Δ.5/Φ.Δ.6 αντιστράφηκε συνειδητά.** Η «επέκταση του επεξεργαστή πέρα από το κελί»
είναι **παράγωγη ερώτηση** της «πού τελειώνει το ορατό κείμενο ενός κελιού;». Χτισμένη πρώτη, θα
χτιζόταν πάνω σε ανορισμένο κανόνα και θα ξαναγραφόταν.

### 23.2 🔴 Το εύρημα που άλλαξε τη σχεδίαση: τα «τέσσερα backends» είναι **ΕΝΑ σημείο**

Το handoff φοβόταν ότι ο κανόνας θα γραφτεί στον ζωγράφο και οι άλλοι τρεις θα αποκλίνουν σιωπηλά.
Η ανάγνωση των τεσσάρων δρόμων έδειξε ότι **συγκλίνουν όλοι στην ίδια συνάρτηση**:

| # | Δρόμος | Τι διαβάζει |
|---|---|---|
| 1 | `stampTableText` (καμβάς) | `cell.text` του `TableLayout` |
| 2 | `tableLayoutToPrimitives` (σκηνή/PDF) | `cell.text` του `TableLayout` |
| 3 | `decomposeTable` (DXF/PDF εξαγωγή) | → καλεί το #2 |
| 4 | `buildScheduleTable` (φύλλα λεπτομερειών) | → `layoutTable` → καλεί το #2 |

Και το `cell.text` γεννιέται σε **ένα** σημείο: `placeText()` στο `table-layout-place.ts`. Άρα ο
κανόνας δεν χρειάζεται να **κληθεί** από τους τέσσερις — τον **κληρονομούν δομικά**. Μηδέν αλλαγή σε
backend· ένα μελλοντικό πέμπτο backend τον παίρνει χωρίς να το ξέρει. Αυτό είναι αυστηρά καλύτερο
από «τα τέσσερα καλούν την ίδια συνάρτηση», που εξαρτάται από το να **θυμηθεί** κάποιος να την
καλέσει.

### 23.3 Έρευνα — τι κάνουν οι μεγάλοι (και πού είναι το κενό)

| Εργαλείο | Τι κάνει όταν δεν χωρά |
|---|---|
| **AutoCAD TABLE** | **Αναδιπλώνει πάντα** και μεγαλώνει το ύψος γραμμής. **Δεν υπάρχει καν διακόπτης** word-wrap — ούτε στο table style, ούτε στο ribbon, ούτε στις ιδιότητες· το ύψος κελιού **δεν κλειδώνεται**. |
| **Revit Schedules** | **Δύο διαφορετικές συμπεριφορές για τα ίδια δεδομένα**: στο schedule view **δεν** αναδιπλώνει (μία γραμμή)· πάνω σε **Sheet** αναδιπλώνει. Δηλαδή ο ίδιος πίνακας δείχνει αλλιώς στην οθόνη απ' ό,τι στο χαρτί — **ακριβώς το ελάττωμα που εμείς απαγορεύουμε δομικά** (§23.2). |
| **Excel** | Ξεχειλίζει σε **κενό** γείτονα· ακυρώνεται από merge / wrap / alignment=fill. Αριθμός που δεν χωρά → `#####`. Καμία ένδειξη περικοπής σε κείμενο. |
| **Google Sheets** | **Ρητή ιδιότητα ανά κελί: Overflow / Wrap / Clip** (Format → Text wrapping). Το Clip «δεν διαγράφει κείμενο». |
| **Figma** | `Truncate text` → προσθέτει **…**· κόβει **ανά λέξη** (τεκμηριωμένο παράπονο vs CSS `text-overflow`). |

**Το εύρημα**: κανένα CAD δεν δίνει επιλογή ανά στήλη — τη δίνει μόνο το Google Sheets, που δεν είναι
CAD. Είναι ένα από τα σημεία όπου ο ΝΕΣΤΩΡ **περνά** τους μεγάλους, με μοντέλο ήδη δοκιμασμένο σε
άλλο domain.

**Sources**: [AutoCAD word-wrap σε κελί](https://forums.autodesk.com/t5/autocad-forum/control-quot-word-wrap-quot-in-table-cell/td-p/6024794) ·
[Το ύψος κελιού δεν κλειδώνεται](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Table-cell-height-cannot-be-fixed-in-AutoCAD.html) ·
[Revit: αναδίπλωση σε Sheet, όχι σε schedule view](https://help.autodesk.com/cloudhelp/2021/ENU/Revit-DocumentPresent/files/GUID-3EB93CA1-715C-4B21-8F8D-345EF394F070.htm) ·
[Excel: ξεχείλισμα μόνο σε κενό γείτονα](https://www.ablebits.com/office-addins-blog/stop-text-spilling-over-excel/) ·
[Google Sheets: Overflow / Wrap / Clip ανά κελί](https://www.spreadsheetclass.com/wrap-clip-or-overflow-unwrap-text-in-google-sheets/) ·
[Figma Truncate: «…», κοπή ανά λέξη](https://forum.figma.com/suggest-a-feature-11/clip-and-ellipsize-text-in-fixed-size-text-blocks-14585)

### 23.4 Οι τέσσερις αποφάσεις (Giorgio, πριν τον κώδικα)

| # | Απόφαση | Γιατί |
|---|---|---|
| 1 | **Περικοπή στο όριο** — κανένα ξεχείλισμα σε κενό γείτονα | (α) σε DXF ένα ξεχειλισμένο κείμενο δεν ανήκει σε **κανένα** κελί, και το native `ACAD_TABLE` (Φ.Ε) **δεν μπορεί καν να το εκφράσει** ⇒ ο πίνακας θα έδειχνε αλλιώς στο AutoCAD· (β) σε πίνακα ποσοτήτων οι διπλανές στήλες σχεδόν ποτέ δεν είναι κενές· (γ) το ξεχείλισμα κάνει τη διάταξη ενός κελιού να εξαρτάται από το **περιεχόμενο άλλου** — μη τοπική, σπάει την καθαρή συνάρτηση που κάνει ασφαλές το raster (ADR-040 #3) |
| 2 | **Ρυθμιζόμενο ανά στήλη + παράκαμψη κελιού** (`TableCellOverflow`), υποδοχή από τώρα | Ο προορισμός είναι **full parity Excel** (Giorgio). Μπαίνοντας τώρα, οι ήδη αποθηκευμένοι πίνακες δεν χρειάζονται πείραγμα όταν έρθει η αναδίπλωση |
| 3 | **`…` σε κείμενο, `###` σε αριθμούς** | Το Excel δεν βάζει ένδειξη σε κείμενο **γιατί είναι διαδραστικό** (κλικ → γραμμή τύπων). Ένα **τυπωμένο σχέδιο δεν έχει γραμμή τύπων**. Και η διάκριση κειμένου/αριθμού δεν είναι διακοσμητική: ένα κομμένο κείμενο διαβάζεται ως προφανώς ελλιπές· ένας κομμένος αριθμός (`12345` → `12…`) διαβάζεται ως **ΑΛΛΟΣ ΑΡΙΘΜΟΣ** — σφάλμα **ΤΙΜΗΣ**, ίδια κατηγορία με τα ADR-712/713 |
| 4 | **Κατακόρυφα: τίποτα**, ρητή καταγραφή + test | Το ύψος γραμμής είναι πάντα ρητό και το κείμενο πάντα μία γραμμή ⇒ κατακόρυφο ξεχείλισμα προκύπτει **μόνο** από κακορυθμισμένο στυλ, ποτέ από δεδομένα του χρήστη (σε αντίθεση με το οριζόντιο, που το προκαλεί κάθε μακριά λέξη). Δάπεδο ύψους (AutoCAD) θα ρίσκαρε τα 10 snapshots του ADR-622 |

🔴 **Ο αριθμός κρίνεται από το `typeof cell.value === 'number'`, ΟΧΙ από το `TableColumn.valueType`** —
όπως ακριβώς το Excel, που κοιτά την **τιμή**. Με κριτήριο τη στήλη, η κεφαλίδα «ΠΟΣΟΤΗΤΑ» μιας
αριθμητικής στήλης θα ζωγραφιζόταν `####`.

### 23.5 SSoT audit — τι επαναχρησιμοποιήθηκε, τι γεννήθηκε

- ❌ **`bim/text/text-box.ts` ΔΕΝ ήταν η απάντηση.** Μιλά για «VISUAL box» αλλά αφορά **πού ζει το
  κουτί μιας οντότητας TEXT/MTEXT** (λαβές/hover/hitTest). Δεν αγγίχτηκε.
- ✅ **Η πραγματική υπάρχουσα απάντηση**: το χαρακτηρο-επίπεδο σκέλος του `fittingPrefixLength`
  (ιδιωτικό στο `bim/text/text-layout.ts`, αναδίπλωση MTEXT ADR-635 Φ C.20) — και μετρά με τον
  **ίδιο** `measureTextAdvanceWorld`. **Εξήχθη** σε `bim/text/text-fit.ts` και το καλούν και οι δύο.
  ⚠️ Ο **χάρακας** είναι κοινός· η **πολιτική** όχι: η αναδίπλωση προτιμά όριο **λέξης** (η λέξη
  συνεχίζεται παρακάτω), η περικοπή κόβει σε **χαρακτήρα** (η λέξη δεν συνεχίζεται πουθενά — κοπή
  ανά λέξη πετάει ολόκληρη τη λέξη· το τεκμηριωμένο παράπονο για τη Figma).
- ✅ `resolveTableTextMeasurer` — η έκφραση `options?.measureText ?? defaultTableTextMeasurer`
  γράφτηκε **μία** φορά, γιατί την χρειάζονται πλέον **δύο** στάδια (`measure` **και** `place`).
- ✅ Το `TableCellStyleOverride.overflow` ακολουθεί **ακριβώς** τη σειρά προτεραιότητας της
  στοίχισης (κελί → στήλη → προεπιλογή), στο ίδιο σημείο επίλυσης (`placeCells`).
- ✅ Test helper `table-paint-recorder.ts` — ο ψεύτικος `CanvasRenderingContext2D` εξήχθη από το
  `stamp-table-layout.test.ts` ώστε να μη γεννηθεί δεύτερο αντίγραφο ~35 γραμμών (CHECK 3.28).
- 🆕 `bim/table/table-cell-overflow.ts` — ο **ένας** κανόνας. 🆕 `bim/text/text-fit.ts` — ο **ένας**
  χάρακας.

### 23.6 🔴 Ποιον μετρητή ρωτά ο κανόνας — ρητή απόφαση, όχι παράλειψη

Ρωτά τον μετρητή **της διάταξης** (`measureTextAdvanceWorld`), τον ίδιο που αποφάσισε τα πλάτη
στηλών — **όχι** τον `ctx.measureText` του καμβά που τελικά ζωγραφίζει. Λόγος: δεν υπάρχει `ctx` σε
PDF, σε DXF, σε jest ή σε SSR· μια περικοπή δεμένη στον καμβά θα ήταν **ανυπολόγιστη** στα τρία από
τα τέσσερα backends — ακριβώς η απόκλιση που το βήμα κλείνει.

⚠️ **Το γνωστό τίμημα, δηλωμένο**: όσο ζει το χρέος «ο καμβάς ζωγραφίζει πάντα `arial` ενώ ο μετρητής
τιμά το `fontFamily`» (§21.8), σε κελί με **άλλη** οικογένεια η κοπή μπορεί να πέσει κατά έναν
χαρακτήρα δίπλα από το ιδανικό **στην οθόνη**. Δεν διορθώθηκε παρεμπιπτόντως: η ένωση των δύο
μετρητών θα μετακινούσε **κάθε** πλάτος στήλης του repo. Με τα σημερινά presets η απόκλιση είναι
μηδενική (ίδια οικογένεια).

### 23.7 Το μοντέλο ΔΕΝ αγγίζεται

Κόβεται **μόνο** το `TableTextRun.text`. Το `TableCell.value` μένει ακέραιο, και ο in-cell
επεξεργαστής διαβάζει από το **μοντέλο** (`getPersistedCellText`, `table-cell-edit-session.ts`), όχι
από τη διάταξη — άρα `F2` πάνω σε περικομμένο κελί δείχνει το **πλήρες** κείμενο. Επαληθεύτηκε
ζωντανά (§23.9) και κλειδώνεται με test.

Το `TableTextRun.clipped` υπάρχει **μόνο όταν αληθεύει** (ίδιο σχήμα με το `dashMm` του
`borderPrimitive`): ένα ρητό `clipped: false` θα άλλαζε το σχήμα **κάθε** μη-περικομμένου run και
μαζί κάθε snapshot των φύλλων οπλισμού, χωρίς καμία οπτική διαφορά. Ο δείκτης («…»/«###») είναι
**μέσα** στο `text`, οπότε ο ζωγράφος δεν το χρειάζεται· το χρειάζεται το **επόμενο** βήμα (Φ.Δ.6),
που ρωτά ακριβώς «κρύβει αυτό το κελί κείμενο;».

### 23.8 Έλεγχοι

- **1.179 tests / 99 suites πράσινα** στο δίχτυ `bim/table` + `rendering/entities/table` +
  `ui/table-cell-editor` + `bim/text` + `bim/structural/detail-sheet` + `export` (**20/20 snapshots**,
  όπου τα **10 του χαρακτηρισμού ADR-622** — δηλαδή **κανένα υπάρχον κελί φύλλου οπλισμού δεν
  ξεχείλιζε**, η περικοπή δεν άλλαξε τίποτα τυπωμένο). Επιπλέον 335 tests στο
  `state`/`command-line`/`keyboard`/`a11y`.
- **Νέα**: 16 unit (`table-cell-overflow.test.ts`) + 8 ισοτιμίας (`table-cell-clipping.test.ts`) +
  2 κατακόρυφου ορίου (στο `table-layout.test.ts`).
- 🔴 **Το test του βήματος** τρέχει και τους **τέσσερις** πραγματικούς δρόμους με τον **πραγματικό**
  μετρητή και συγκρίνει το ορατό κείμενο. Κρίσιμο: υπάρχει **δεύτερος** έλεγχος ότι και οι τρεις
  **ΟΝΤΩΣ κόβουν** — χωρίς αυτόν η «ισοτιμία» θα ήταν πράσινη και **πριν** το βήμα 5 (τρία
  πανομοιότυπα ξεχειλισμένα κείμενα είναι επίσης «ίδια»). Επαληθεύτηκε: με τον κανόνα αφαιρεμένο
  από τη διάταξη, ο πρώτος έλεγχος **μένει πράσινος** και ο δεύτερος πέφτει.
- **7/7 μεταλλάξεις** (σπάσιμο → κόκκινο → επαναφορά): δείκτης εκτός μέτρησης · αριθμός σαν κείμενο ·
  κανόνας εκτός διάταξης · χωρίς κούρεμα κενού · χωρίς επικύρωση άγνωστης τιμής · δάπεδο ύψους
  γραμμής · αυστηρή σύγκριση «χωράει ακριβώς».
- `jscpd:diff` **καθαρό** σε 12 αρχεία — τα δικά μου **και** το πρότυπο που καθρεφτίζω
  (`text-layout.ts`, `stamp-table-layout.test.ts`).
- ❌ **ΟΧΙ `tsc`** (N.17). ❌ **ΟΧΙ commit** (N.(-1)).

### 23.9 Ζωντανή επαλήθευση — **με δεδομένα, όχι με οθόνη** (2026-08-01)

Μέθοδος: **παρεμβολή στο ίδιο το `CanvasRenderingContext2D.prototype.fillText`**, ώστε να
καταγραφεί ό,τι **πραγματικά** ζωγραφίστηκε — όχι τι λέει η διάταξη ότι θα ζωγραφιζόταν.

| Τι | Μέτρηση |
|---|---|
| Κείμενο που πληκτρολογήθηκε (κελί τίτλου, merged ×3) | **111** χαρακτήρες |
| Ό,τι έφτασε στο `ctx.fillText` | **49** χαρακτήρες, `«…ΓΙΑ ΝΑ ΧΩΡΕΣΕΙ ΣΤ…»`, **πρόθεμα** του πλήρους |
| `TableCell.value` στο μοντέλο | **111** — ακέραιο |
| **Μετά από πλήρες reload** (σκηνή 1.955 οντοτήτων) | μοντέλο **111**, ζωγραφισμένο **49** |
| `<input>` του επεξεργαστή σε **περικομμένο** κελί (`F2`/διπλό κλικ) | **111** — το πλήρες κείμενο |

Οπτικά: το κείμενο σταματά **μέσα** στο δεξί περίγραμμα του πίνακα, με ορατά αποσιωπητικά.
🧹 Τα δοκιμαστικά δεδομένα **αφαιρέθηκαν** από τη σκηνή του χρήστη μετά την επαλήθευση
(επιβεβαιώθηκε: `r0/c0 → ''`).

⚠️ **ΤΙ ΔΕΝ ΠΕΡΠΑΤΗΘΗΚΕ ΖΩΝΤΑΝΑ**: η **εξαγωγή** σε αρχείο. Το κουμπί «Εξαγωγή» της κορδέλας δεν
κατέβασε αρχείο με ένα κλικ και η αναζήτηση του μενού σταμάτησε αντί να γίνει λαγούμι. Η διαδρομή
εξαγωγής καλύπτεται από **πραγματικό** `decomposeTable` μέσα στο test ισοτιμίας (όχι mock), αλλά
**δεν** ανοίχτηκε παραγόμενο DXF σε άλλο πρόγραμμα.

### 23.10 Τι ρητά ΔΕΝ κάνει το βήμα 5

- **Καμία αναδίπλωση** (`'wrap'`): αλλάζει ύψος γραμμής ⇒ ύψος πίνακα ⇒ γεωμετρία οντότητας ⇒ λαβές,
  hit-test, επιβίωση reload, και πολυγραμμικό `<input>`. Είναι η **επόμενη τιμή** του ίδιου
  διακόπτη, όχι δεύτερος μηχανισμός.
- **Κανένα ξεχείλισμα σε κενό γείτονα**, καμία σμίκρυνση γραμματοσειράς (Excel Shrink to Fit).
- **Καμία κατακόρυφη περικοπή** και κανένα δάπεδο ύψους γραμμής (§23.4/4).
- **Καμία διεπαφή**: ο χρήστης δεν μπορεί ακόμη να **αλλάξει** το `overflow` — η υποδοχή υπάρχει στο
  μοντέλο, το μενού έρχεται με τη Φ.Δ.10 (μορφοποίηση κελιού).
- 🔴 **Καμία νέα τιμή στο union χωρίς μηχανή.** Ο διακόπτης στο `resolveVisibleCellText` γράφτηκε
  **χωρίς `default`**: η προσθήκη μέλους σπάει τη **μεταγλώττιση**. Ένα `'wrap'` που θα έπεφτε
  σιωπηλά σε περικοπή θα ήταν **ψέμα του τύπου** — ο χρήστης θα ζητούσε αναδίπλωση και θα έβλεπε
  κομμένο κείμενο, χωρίς κανένα σήμα.

## 24. Φάση Δ βήμα 6 — **Ο ΕΠΕΞΕΡΓΑΣΤΗΣ ΕΠΕΚΤΕΙΝΕΤΑΙ ΠΕΡΑ ΑΠΟ ΤΟ ΚΕΛΙ** (2026-08-01)

### 24.1 Το πρόβλημα — η άλλη όψη του βήματος 5

Το βήμα 5 όρισε **πού τελειώνει το ορατό κείμενο** ενός κελιού. Γεννήθηκε έτσι κατάσταση που πριν
δεν υπήρχε: ο χρήστης **βλέπει λιγότερα απ' όσα έχει γράψει**. Και μπαίνοντας να διορθώσει, ο
επεξεργαστής ήταν κολλημένος στο πλάτος του κελιού — **είχε** μέσα του όλο το κείμενο (μετρημένο
στο βήμα 5: 111 χαρακτήρες) αλλά **έδειχνε** όσους χωρούσαν, και ο χρήστης σκρόλαρε στα τυφλά μέσα
σε πεδίο πλάτους 3 εκατοστών.

Ήταν συνειδητή αντιστροφή σειράς (§23.1): η «επέκταση» είναι **παράγωγη ερώτηση** της «πού
τελειώνει το ορατό κείμενο;». Τώρα ο κανόνας υπάρχει, άρα η επέκταση είναι καλά ορισμένη.

### 24.2 Έρευνα — τι κάνουν οι μεγάλοι, και πού είναι το κενό

| Εργαλείο | Τι κάνει το πλαίσιο επεξεργασίας |
|---|---|
| **Excel** | Μεγαλώνει ζωντανά και **σκεπάζει τα διπλανά κελιά**· φτάνοντας στην άκρη **αναδιπλώνει κατακόρυφα**. Η ίδια η Microsoft δίνει διακόπτη «Allow editing directly in cells» για να το **αποφύγεις**, και προτείνει τη γραμμή τύπων ως διέξοδο. Σε δεξιά στοίχιση/indent μεγαλώνει **αριστερά** |
| **Google Sheets** | Απαντά σε **άλλη** ερώτηση (overflow/wrap/clip της **προβολής**)· δεν ορίζει κανόνα επέκτασης επεξεργαστή |
| **AutoCAD** (in-place TABLE editor) | **Δεν** σκεπάζει γείτονες — μεγαλώνει το **ίδιο το κελί/γραμμή** ζωντανά. Εδώ αυτό **απαγορεύεται**: θα ήταν αλλαγή γεωμετρίας οντότητας από πάτημα πλήκτρου. Το `MTEXTFIXED` αφορά **αναγνωσιμότητα**, απόφαση ήδη απορριφθείσα για κελιά (§21.1) |
| **Figma** («Auto width») | Το κουτί ακολουθεί το περιεχόμενο και **η στοίχιση είναι η άγκυρα**: αριστερά→δεξιά, δεξιά→αριστερά, κέντρο→**συμμετρικά** |
| **Handsontable** (Excel-like grid) | Ρητός σχεδιαστικός στόχος: «*μεγάλωσε σε πλάτος μέχρι ένα μέγιστο· αν το φτάσεις, μεγάλωσε σε ύψος*». Μετρά όμως με **DOM mirror ανά πάτημα πλήκτρου** |

🔴 **Το κενό που κανείς δεν καλύπτει**: όλοι σου δείχνουν το **πλήρες** κείμενο ενώ γράφεις, αλλά
**κανένας δεν σου λέει τι θα τυπωθεί**. Σε φύλλο υπολογισμού αυτό είναι ανεκτό — έχεις γραμμή
τύπων και η οθόνη *είναι* το παραδοτέο. Σε εργαλείο **εκτυπώσιμων σχεδίων** είναι ακριβώς η
ερώτηση του μηχανικού, και είναι ο λόγος που το βήμα 6 προσθέτει τη **ζώνη εκτύπωσης** (§24.5).

### 24.3 Οι τέσσερις αποφάσεις (Giorgio, πριν τον κώδικα)

1. **Πότε**: **και όσο γράφεις και τη στιγμή που μπαίνεις** σε κελί που ήδη κρύβει κείμενο. Το
   δεύτερο είναι **πάνω** από το Excel, όπου μπαίνεις και βλέπεις κομμένο μέχρι να πατήσεις πλήκτρο.
2. **Κατεύθυνση**: **η στοίχιση είναι η άγκυρα** (Excel + Figma). Αριστερή→δεξιά, δεξιά→αριστερά,
   κεντρική→**συμμετρικά**. Έτσι το κείμενο **δεν μετακινείται** τη στιγμή που ανοίγει ο
   επεξεργαστής — δηλαδή διατηρείται το «ο επεξεργαστής είναι αόρατος ως κουτί» του βήματος 3.
3. **Μέχρι πού**: **οριζόντια μέχρι την άκρη, μετά δεύτερη γραμμή** — πλήρες Excel. ⚠️ Η επιλογή
   αυτή **επέβαλε** `<input>` → `<textarea>` (§24.6). Είχε επισημανθεί ως το μεγαλύτερο σκέλος·
   ο Giorgio την επέλεξε ρητά.
4. **Όψη**: **και τα τρία** — λεπτό περίγραμμα στο επεκτεταμένο κουτί, **δείκτης ορίου κελιού**
   (πού θα κοπεί) και **σκίαση** του μη-εκτυπώσιμου τμήματος.

### 24.4 SSoT audit — τι επαναχρησιμοποιήθηκε, τι γεννήθηκε

**Το πρώτο εύρημα ήταν αρνητικό και σημαντικό**: `grep -riE "scrollWidth|auto-?grow|autosize|fitContent|
field-sizing"` σε ολόκληρο το `src/` → **κανένα auto-grow πεδίο δεν υπάρχει στο repo**. Το
`ui/text-toolbar/` κρατά **σταθερό** κουτί (`textEditorBoxHeightPx = ύψος × scale × 4`) και το
`OpeningInfoTagEditorOverlay` παίρνει καρφωμένο `anchorRect.width`. Άρα το βήμα 6 γράφει **τον πρώτο**
— και ακριβώς γι' αυτό δεν επιτρεπόταν να γεννήσει δεύτερη μηχανή μέτρησης ή δεύτερη μηχανή κουτιού.

| Ερώτηση | Ποιος απαντά | Νέο; |
|---|---|---|
| «πόσο πλατύ είναι το κείμενο σε px;» | `cellTextWidthPx` (βήμα 3) | ❌ υπάρχον |
| «πόσο χωρά σε αυτό το πλάτος;» | `fittingPrefixLengthByChar` (βήμα 5) | ❌ υπάρχον |
| «πού σπάει η γραμμή σε όριο λέξης;» | `fittingPrefixLengthByWord` | ⚠️ **εξαγωγή** από το `text-layout.ts` |
| «πόσο μεγάλο πρέπει να γίνει το κουτί;» | `table-cell-editor-expansion.ts` | ✅ νέο |
| «πώς γίνεται το κελί κουτί οθόνης;» | `computeTableCellEditorFrame` (βήμα 3) | ❌ υπάρχον, **επεκτάθηκε** |
| «πώς φτάνουν οι τιμές στο DOM ανά tick;» | `TextEditorAnchorBox` + `cssVars` (βήμα 3) | ❌ υπάρχον |
| «hex + διαφάνεια;» | `config/color-math.ts` (`hexToRgba`) | ❌ υπάρχον SSoT |
| «τι χρώμα έχει ο δείκτης διεπαφής;» | `TABLE_CELL_CURSOR.colorHex` | ❌ υπάρχον — **κανένα τέταρτο χρώμα** |

🔴 **Η προτίμηση λέξης μετακόμισε, δεν αντιγράφηκε.** Ο βρόχος ζούσε ιδιωτικός μέσα στο
`text-layout.ts:fittingPrefixLength` (αναδίπλωση MTEXT) και απέκτησε **δεύτερο** καταναλωτή. Ένα
αντίγραφο θα ήταν ο structural clone που πιάνει το CHECK 3.28 — **ανεξάρτητα ονόματος** (ADR-584).
Το `text-layout.ts` κρατά πλέον **μόνο** το δέσιμο του μετρητή στο `piece`.

⚠️ Το ίδιο το CHECK 3.28 **έπιασε δικό μου κλώνο** μέσα στο `text-fit.ts`: το τρίγραμμο προοίμιο
(«κενό κείμενο / μη θετικό πλάτος / χωρά όλο») ήταν πανομοιότυπο στις δύο πολιτικές. Εξήχθη σε
`trivialFit` — ακριβώς η δουλειά για την οποία υπάρχει ο έλεγχος.

### 24.5 Η ζώνη εκτύπωσης — η πληροφορία που λείπει από όλους

Το επεκτεταμένο κουτί ζωγραφίζει **τρεις στρώσεις υποβάθρου**, όλες από CSS gradients πάνω στο
**ίδιο** στοιχείο (μηδέν επιπλέον DOM, μηδέν επιπλέον re-render):

1. **η γραμμή κοπής** — κατακόρυφη γραμμή στο `--tce-print-w`, ύψους **ενός κελιού**: είναι
   κυριολεκτικά η δεξιά ακμή του κελιού, εκεί που το βήμα 5 θα βάλει «…»·
2. **το πέπλο κάτω** — ό,τι πέρασε σε δεύτερη γραμμή, περιορισμένο στο `--tce-print-w`·
3. **το πέπλο δεξιά** — ό,τι ξεπέρασε το κελί οριζόντια, σε όλο το ύψος.

Οι (2) και (3) **εφάπτονται και δεν επικαλύπτονται εξ ορισμού** — το ένα σταματά όπου αρχίζει το
άλλο, άρα καμία διπλά σκουρυμένη γωνία. Το πέπλο είναι το **μελάνι του κελιού στο 10%** (μέσω
`hexToRgba`) και όχι τρίτο χρώμα: δουλεύει σωστά σε σκούρο **και** σε ανοιχτό γέμισμα, χωρίς κανένα
ερώτημα θέματος. Ο δείκτης δανείζεται το `TABLE_CELL_CURSOR.colorHex` — ίδιο λεξιλόγιο με τον
δρομέα του καμβά, μηδέν νέα χρώματα.

🔴 **Το «σβηστό» εκφράζεται ως `transparent`/μηδενικό πάχος** και όχι ως εναλλαγή κλάσης: οι
ενδείξεις αλλάζουν στο **ίδιο tick** με το μέγεθος (ένα zoom-out μπορεί να κάνει το κείμενο να
χωρέσει), και ο ADR-040 απαγορεύει re-render εκεί. Έτσι ο κανόνας CSS μένει **ένας** και σταθερός.

⚠️ **Το περίγραμμα είναι `outline`, ποτέ `border`.** Το `border` είναι μέρος του box model και θα
έτρωγε 1 px από το content box, μετακινώντας κάθε γράμμα — δηλαδή θα χαλούσε την ακρίβεια pixel που
ολόκληρο το βήμα 3 υπάρχει για να πετύχει.

### 24.6 🔴 `<input>` → `<textarea>` — και γιατί ΔΕΝ έσπασε τίποτα

Η απόφαση 3 απαιτεί δεύτερη **οπτική** γραμμή. Τρία θεμέλια κινδύνευαν· και τα τρία ελέγχθηκαν
**πριν** γραφτεί κώδικας:

1. **Ιδιοκτησία πλήκτρων (Φ.Δ.4)** — ο δομικός φύλακας ρωτά `isTextEntryTarget`, που απαντά `true`
   για `INPUT` **και** `TEXTAREA` στην ίδια γραμμή (`keyboard-scope.ts:188`, με test
   `['TEXTAREA', true]`). Και οι 43 window listeners παραιτούνται όπως πριν, **μηδέν αλλαγές**.
2. **Κατακόρυφη γεωμετρία (Φ.Δ.3)** — ένα `<textarea>` **δεν κεντράρει**, στοιβάζει από την κορυφή.
   Ο τύπος του βήματος 3 φαινόταν να ακυρώνεται· **δεν ακυρώνεται**:
   ```
   βάση₁ = padTop + (L − A − D)/2 + A        (textarea, L = ύψος κουτιού γραμμής)
   με L = H − padTop και padBottom = 0:
   βάση₁ = padTop/2 + H/2 + (A−D)/2 = padTop/2 + centred  ⇒  padTop = 2·(στόχος − centred)
   ```
   που είναι **ακριβώς** ο τύπος του `<input>`. Η αιτία είναι η επιλογή που ήδη τεκμηριώνει το
   §21.3: όταν το κουτί γραμμής είναι **ίσο με το content box**, το half-leading μηδενίζεται και οι
   δύο τοποθετήσεις γίνονται αριθμητικά ταυτόσημες. Η γραμμή που γράφτηκε για ανεξαρτησία από τη
   **μηχανή** αποδείχθηκε ανεξαρτησία και από το **στοιχείο**. **Μηδέν νούμερο άλλαξε· τα tests του
   βήματος 3 έμειναν πράσινα αμετάβλητα.**
3. **`Enter`** — το διεκδικεί ήδη το `resolveTableCellKeyIntent` ως `move`, με `preventDefault` πριν
   προλάβει ο browser.

🔴 **Δύο πράγματα όμως ΑΛΛΑΞΑΝ σημασία και χρειάστηκαν ρητή άρνηση** — και τα δύο είναι η ίδια
κατηγορία: *αδράνεια που ήταν δωρεάν με `<input>` και γίνεται σφάλμα δεδομένων με `<textarea>`.*

- **`Alt+Enter`**: μέχρι το βήμα 5 ήταν `passthrough` («δεν το υλοποιούμε, αλλά ούτε το κλέβουμε») —
  σωστό, γιατί το `<input>` **δεν δέχεται** αλλαγή γραμμής. Τώρα ο browser θα έγραφε πραγματικό `\n`
  μέσα στο `TableCell.value`, που είναι **απλό `string`** (Φ.Α): η διάταξη θα το μετρούσε σαν γράμμα
  και το DXF θα έπαιρνε χαρακτήρα ελέγχου μέσα σε κελί. Νέα πρόθεση `suppress` — «κατάπιε το, μην
  κάνεις τίποτα». **Θα ξαναγίνει αλλαγή γραμμής όταν έρθει το `overflow: 'wrap'` (Φ.Δ.10), σε μία γραμμή.**
- **Επικόλληση πολυγραμμικού κειμένου**: το `<input>` την ισοπέδωνε μόνο του. Τώρα ισοπεδώνεται
  ρητά (`flattenToSingleLine`, κάθε αλλαγή γραμμής → **ένα κενό**, ώστε να μην κολλήσουν λέξεις) και
  **τη στιγμή της πληκτρολόγησης, όχι του commit**: ένα «καθάρισμα» τη στιγμή της δέσμευσης θα
  άλλαζε το κείμενο κάτω από τα μάτια του χρήστη αφού το είχε ήδη εγκρίνει.

### 24.7 🔴 Η απόδοση — το `projectBox()` τρέχει ΣΕ ΚΑΘΕ ΚΑΡΕ

Το κουτί ξαναϋπολογίζεται σε κάθε καρέ (γι' αυτό ο επεξεργαστής ζουμάρει μαζί με τον καμβά). Ένα
αφελές `ctx.measureText(draft, font)` εκεί μέσα είναι **μία μέτρηση ανά καρέ ανά κείμενο** — δουλειά
ανάλογη του χρόνου, ακριβώς το σχήμα που τιμώρησε ο **ADR-735**.

Η απάντηση δεν είναι απομνημόνευση που ελπίζουμε να πετύχει· είναι **αλλαγή της ερώτησης**: η πρόοδος
πένας είναι **γραμμική ως προς το μέγεθος**, οπότε μετράμε **μία φορά στα 200 px** και
πολλαπλασιάζουμε. Το κλειδί του cache χάνει το μέγεθος ⇒ το zoom **δεν μπορεί καν** να το αστοχήσει.
Είναι το ίδιο επιχείρημα που ήδη κάνει το `fontBandRatio` για τη ζώνη ascent/descent (§21.4),
εφαρμοσμένο στην άλλη διάσταση. Το cache είναι **φραγμένο** (512 εγγραφές, FIFO): κάθε πάτημα
πλήκτρου γεννά νέο πρόχειρο, και χωρίς φράγμα μια μεγάλη συνεδρία γραφής θα ήταν διαρροή μνήμης με
το πρόσχημα του cache.

**Μετρημένο** (πρόχειρο 90 χαρακτήρων, 60 καρέ zoom, `table-cell-editor-frame-cost.test.ts`):

| Σενάριο | `ctx.measureText` ανά καρέ |
|---|---|
| πρώτο (ψυχρό) καρέ | 23 — **μία** φορά |
| χωρίς αναδίπλωση, ζωντανό zoom | **0,00** |
| με αναδίπλωση, ζωντανό zoom | **0,85** (51 μετρήσεις σε 60 καρέ, έναντι ~1.380 χωρίς κανονικοποίηση) |
| ανά πάτημα πλήκτρου | **1** |

Επιπλέον, η σειρά μέσα στο tick του `TextEditorAnchorLayer` άλλαξε σε **όλες οι αναγνώσεις πρώτα,
όλες οι εγγραφές μετά**: το `project()` διαβάζει γεωμετρία DOM και το `applyBox` γράφει· ανάγνωση
μετά από εγγραφή στο ίδιο tick αναγκάζει τον browser σε επιπλέον υπολογισμό διάταξης, 60 φορές το
δευτερόλεπτο.

### 24.8 Η περιστροφή — η μετατόπιση ζει ΜΕΤΑ το `rotate`

Η δεξιά/κεντρική στοίχιση απαιτεί το κουτί να απλωθεί **αριστερά**. Ένα ξεχασμένο `translate` **πριν**
το `rotate` μοιάζει σωστό σε **κάθε** πίνακα με γωνία μηδέν και ξεκολλά τον επεξεργαστή από το κελί
του μόλις ο πίνακας γυρίσει έστω λίγο. Γι' αυτό το νέο `TextEditorAnchorBox.offsetXPx` μπαίνει
**τελευταίο** στο transform:

```
translate(θέση) rotate(θ) translate(offsetX, 0)
```

δηλαδή στο **ήδη γυρισμένο** σύστημα συντεταγμένων — κατά μήκος της **γραμμής του πίνακα**, όχι
οριζόντια στην οθόνη. Με το ίδιο σκεπτικό, ο **διαθέσιμος χώρος** μετριέται ως ακτίνα
`(cos θ, sin θ)` μέχρι την άκρη του παραθύρου (`editorGrowthCeilingPx`): ένα «πλάτος παραθύρου μείον
x» θα ήταν σωστό μόνο για γωνία μηδέν.

### 24.9 Η αναδίπλωση είναι ΣΥΝΤΗΡΗΤΙΚΗ — εξ ορισμού, όχι κατά τύχη

Την τελική αναδίπλωση την κάνει ο **browser** μέσα στο `<textarea>`· εμείς προβλέπουμε **πόσες
γραμμές** για να δώσουμε ύψος. Αν πέσουμε έξω προς τα κάτω, η τελευταία γραμμή κόβεται και ο χρήστης
ξαναγράφει στα τυφλά — **ακριβώς το ελάττωμα που λύνουμε**. Αν πέσουμε έξω προς τα πάνω, περισσεύει
μια άδεια γραμμή. Υπολογίζοντας με **ένα px λιγότερο** από όσο θα έχει ο browser (`WRAP_SAFETY_PX`),
εμείς αναδιπλώνουμε **το αργότερο** όποτε αναδιπλώνει κι εκείνος: το σφάλμα γίνεται **μονόπλευρο και
ακίνδυνο**. Οι κανόνες `white-space: pre-wrap` / `overflow-wrap: break-word` δηλώνονται **ρητά** ώστε
να μην εξαρτάται το ύψος από το UA stylesheet.

### 24.10 Έλεγχοι

- **`table-cell-editor-expansion.test.ts`** — πότε/πόσο/προς τα πού, με **χειροκίνητο** μετρητή
  σταθερού πλάτους ώστε κάθε αναμενόμενος αριθμός να προκύπτει από τον ορισμό και όχι από την
  υλοποίηση· περιλαμβάνει τον χώρο σε **στραμμένο** πλαίσιο.
- 🔴 **`table-cell-editor-leaves-layout-alone.test.ts` — ΤΟ TEST ΤΟΥ ΒΗΜΑΤΟΣ.** Τρέχει την
  **πραγματική** διάταξη με τον **πραγματικό** μετρητή πριν/κατά/μετά την επέκταση: η διάταξη είναι
  `toEqual` ίδια, το `TableTextRun.text` μένει περικομμένο με «…» και `clipped: true`, το
  `TableCell.value` ακέραιο, και το πλάτος στήλης δεν ακολουθεί το πρόχειρο όσο μακρύ κι αν γίνει.
  Πρώτος έλεγχος του αρχείου: **ότι η επέκταση όντως συμβαίνει** — αλλιώς όλα τα υπόλοιπα θα ήταν
  πράσινα και με τον μηχανισμό απενεργοποιημένο.
- **`table-cell-editor-frame-cost.test.ts`** — το §24.7 σε **αριθμούς**, με ψεύτικο καμβά που μετρά
  κλήσεις (σε jsdom ο πραγματικός δρόμος δεν εκτελείται, άρα ο έλεγχος **δεν θα μπορούσε** να αποτύχει).
- **`text-editor-anchor-layer-box.test.tsx`** — η **σειρά** των μετασχηματισμών (§24.8).
- **`table-cell-single-line-guard.test.ts`** — καμία αλλαγή γραμμής δεν φτάνει στο μοντέλο.
- **Σύνολο: 1.218 tests / 102 suites** πράσινα (από 1.179/99), **20/20 snapshots** — τα **10 του
  ADR-622 αμετάβλητα**. Δίχτυ πληκτρολογίου **335/335**. **9/9 μεταλλάξεις** έδωσαν κόκκινο
  (κατεύθυνση, αναδίπλωση, δείκτης κοπής, κλειδί cache, `Alt+Enter`, φύλακας μονής γραμμής, ύψος,
  σειρά transform, στοίχιση σε επέκταση). `jscpd:diff` καθαρό.

### 24.11 Ζωντανή επαλήθευση — **με δεδομένα, όχι με οθόνη** (2026-08-01)

Πλήρες reload, σκηνή 1.955 οντοτήτων, κελί 40 mm (`ent_89f53628` r3/c1):

| Πρόχειρο | πλάτος κουτιού | ύψος | ζώνη εκτύπωσης | περίγραμμα | πέπλο |
|---|---|---|---|---|---|
| 0 χαρακτήρες | **430,4 px** (= το κελί) | 86,1 | 0 px | 0 px | `transparent` |
| 37 χαρακτήρες | **706,7 px** | 86,1 | **375,0 × 86,08 px** | **1 px** | `rgba(17,17,17,0.1)` |

- **Το ερώτημα 1 απαντήθηκε ζωντανά με ΔΕΣΜΕΥΜΕΝΟ κείμενο**: διπλό κλικ σε κελί που ήδη κρύβει
  (`initialText` = 37 χαρακτήρες) άνοιξε κουτί **706,7 px ήδη επεκτεταμένο, πριν πατηθεί πλήκτρο**,
  με δείκτη κοπής `#0099ff`. Ταυτόχρονα ο **καμβάς** ζωγράφιζε «ΕΞΥΓΙΑΝΣΗ ΕΔΑΦΟΥΣ Μ**…**» μέσα στο
  κελί: πλήρες κείμενο στον επεξεργαστή, κομμένο στο σχέδιο, **μηδέν απώλεια δεδομένων**.
- **Κατακόρυφη αναδίπλωση**: σε συγχωνευμένο κελί 120 mm, 50 χαρακτήρες έδωσαν **1749,6 × 116,6 →
  1824,8 × 215,5 px** — δεύτερη γραμμή, με τη **ζώνη εκτύπωσης να μένει ένα κελί ψηλή** (116,64 px).
- **Επιστροφή**: αδειάζοντας το κείμενο, το κουτί επανήλθε **ακριβώς** στα 430,4 px με `printW: 0`
  και `outline: 0` — η επέκταση είναι καθαρή συνάρτηση του περιεχομένου.
- Επιβεβαιώθηκαν ζωντανά: `TEXTAREA`, `white-space: pre-wrap`, `resize: none`, `overflow: hidden`,
  **3 στρώσεις** gradient, `text-align: left` σε επέκταση.
- **Τα δοκιμαστικά δεδομένα σβήστηκαν** και η διαγραφή επιβεβαιώθηκε **μετά από reload**.

### 24.12 🔴 Τι ΔΕΝ επαληθεύτηκε ζωντανά (δηλωμένο, όχι κρυμμένο)

- **Δεξιά και κεντρική στοίχιση** και **στραμμένος πίνακας**: και οι δύο πίνακες της σκηνής έχουν
  `angleRad = 0` και **όλες** οι στήλες τους `align: 'left'`. Η αλλαγή τους θα ήταν μεταβολή της
  σκηνής του Giorgio χωρίς εντολή. Καλύπτονται από tests (κατεύθυνση ανά στοίχιση, χώρος σε
  στραμμένο πλαίσιο, σειρά transform) — **όχι όμως από την οθόνη**.
- **Η εξαγωγή σε αρχείο** εξακολουθεί να μην έχει περπατηθεί (κληρονομημένο από το βήμα 5).

### 24.13 Τι ρητά ΔΕΝ κάνει το βήμα 6

- **Δεν αγγίζει τη διάταξη ούτε το μοντέλο** — μετά το commit ο πίνακας ξαναδείχνει κομμένο.
- **Δεν υλοποιεί `overflow: 'wrap'`**: η αναδίπλωση εδώ είναι **οπτική, μέσα στον επεξεργαστή**. Η
  αναδίπλωση του **κελιού** αλλάζει ύψος γραμμής ⇒ γεωμετρία οντότητας, και είναι η επόμενη τιμή του
  διακόπτη του βήματος 5 (Φ.Δ.10).
- **Δεν προσθέτει γραμμή τύπων** (Φ.Δ.7) ούτε επιλογή περιοχής (Φ.Δ.8).
- **Δεν δίνει διεπαφή** για ενεργοποίηση/απενεργοποίηση της επέκτασης: είναι συμπεριφορά, όχι ρύθμιση.

---

## 25. Φάση Δ βήμα 7 — **ΓΡΑΜΜΗ ΤΥΠΩΝ (fx) + ΑΝΑΦΟΡΑ ΚΕΛΙΟΥ + ΔΕΙΚΤΗΣ ΠΙΝΑΚΑ** (2026-08-01)

### 25.1 Το πρόβλημα — και γιατί ΔΕΝ το έλυσε το βήμα 6

Το βήμα 6 έδωσε «βλέπω όλο το κείμενο **μέσα** στο κελί». Μένουν δύο κενά που ο in-cell
επεξεργαστής **δεν μπορεί** να καλύψει, εξ ορισμού:

1. **Ανάγνωση χωρίς γραφή.** Η πλήρης τιμή φαίνεται μόνο αφού μπεις σε λειτουργία γραφής —
   δηλαδή αφού αναλάβεις τον κίνδυνο να την αλλάξεις.
2. **Τύπος και αποτέλεσμα ταυτόχρονα.** Είναι η **προϋπόθεση του Φ.Δ.11**: ένα κελί με
   `=SUM(B2:B7)` δείχνει **αριθμό**· χωρίς δεύτερο παράθυρο, ο τύπος γίνεται αόρατος τη
   στιγμή που υπολογίζεται, άρα μη-επεξεργάσιμος.

### 25.2 Έρευνα — τι κάνουν οι μεγάλοι, και το εύρημα που άλλαξε τη σχεδίαση

| Εργαλείο | Τι δίνει | Τι μας διδάσκει |
|---|---|---|
| **Excel** | Name Box + fx **πάνω** από το πλέγμα, μόνιμα· `Ctrl+Shift+U` μεγαλώνει σε 3 γραμμές | Σε **συγχωνευμένο** το Name Box δείχνει σκέτη την άγκυρα (`C7`) ενώ ο τύπος γράφει `C7:D7` — **τεκμηριωμένη πηγή σύγχυσης** |
| **Google Sheets** | Ίδια θέση· κλικ στη γραμμή = Edit mode, η εστίαση **μένει** εκεί | Το εύρος συγχώνευσης **λέγεται** — και είναι πιο τίμιο |
| **🏆 AutoCAD** | **Δεν έχει γραμμή τύπων.** Έχει `TABLEINDICATOR`: γράμματα στηλών + αριθμούς γραμμών **γύρω από τον πίνακα**, μόνο κατά την επεξεργασία, και **ποτέ στην εκτύπωση**. Οι τύποι του (`=Sum(A1:A5)`) φαίνονται **μόνο** μέσα στον in-place επεξεργαστή | **Το `A1` είναι το προηγούμενο του ΙΔΙΟΥ domain**, όχι δάνειο από φύλλο υπολογισμού. Και το κενό του AutoCAD είναι ακριβώς το (1) και (2) του §25.1 |
| **Figma** | Inspector panel — πλήρης τιμή του επιλεγμένου χωρίς είσοδο σε γραφή | Επιβεβαιώνει το (1) ως αυτοτελή αξία |

🔴 **Το εύρημα**: κανένα από τα δύο δεν είναι πλήρες. Το Excel έχει γραμμή τύπων αλλά **δεν
έχει στραμμένο πλέγμα**· το AutoCAD έχει δείκτη πίνακα αλλά **δεν έχει γραμμή τύπων**. Ο
ΝΕΣΤΩΡ παίρνει **και τα δύο**, και τα δένει στην ίδια οντότητα σκηνής.

### 25.3 Οι τέσσερις αποφάσεις (Giorgio, **πριν** τον κώδικα)

| # | Ερώτημα | Απόφαση |
|---|---|---|
| 1 | **Πού** ζει η γραμμή | Ούτε λωρίδα σελίδας, ούτε πλωτό πάνελ: **αγκυρωμένη στον πίνακα**. Στην πάνω πλευρά του πίνακα τα γράμματα `A B C`, στα αριστερά οι αριθμοί `1 2 3`, και **πιο πάνω** η γραμμή τύπων. 🔴 **«Ο πίνακας να μην μετακινείται καθόλου κατά το edit»** |
| 2 | **Πότε** φαίνεται | Μόνο όσο είσαι μέσα στον πίνακα (`overlay !== null` — το ίδιο σήμα που ήδη κρατά το modal scope) |
| 3 | **Πώς** ονομάζεται το κελί | **`A1` + κείμενο κεφαλίδας**: `B3 · Περιγραφή` |
| 4 | **Γράφεται** μέσα της | **Ναι**, όπως στο Excel |

### 25.4 Γιατί η απόφαση 1 απαγορεύει τη λωρίδα σελίδας — και τι το αντικαθιστά

Μια λωρίδα στη **ροή** της διάταξης κοντεύει τον καμβά κατά ~32 px τη στιγμή που μπαίνεις σε
κελί ⇒ resize ⇒ **όλο το σχέδιο γλιστράει** ⇒ το κελί που μόλις πάτησες φεύγει κάτω από το
ποντίκι, και ξαναγυρίζει στο `Esc`. Αναπήδηση σε κάθε είσοδο/έξοδο.

Οι δύο ζώνες ζωγραφίζονται **στον καμβά**, σε **αρνητικές συντεταγμένες του πλαισίου του
πίνακα** (`stamp-table-indicator.ts`): καμία σχέση με τη διάταξη σελίδας, μηδέν resize, μηδέν
επαναϋπολογισμός προβολής. Η γραμμή τύπων είναι DOM (πρέπει να δέχεται πληκτρολόγηση) και
αγκυρώνεται με το **ίδιο** `TextEditorAnchorLayer` που ήδη κουβαλά τον επεξεργαστή κελιού —
άρα ακολουθεί pan/zoom **χωρίς κανένα re-render** (ADR-040).

**Οι ζώνες γέρνουν με τον πίνακα, τα γράμματα μένουν ίσια.** Δεν είναι δύο αποφάσεις: είναι η
**ίδια** που ήδη τηρεί το `stampTableText` για το κείμενο των κελιών (καμία `ctx.rotate`).
Η **γραμμή τύπων** δεν γέρνει καθόλου (`rotationRad: 0`) — είναι εργαλείο, όχι σχέδιο, και
ανάποδα γράμματα σε πεδίο που πληκτρολογείς είναι το πρόβλημα που λύνει το `MTEXTFIXED = 2`.

### 25.5 🔴 Γιατί `A1` — τρεις δεσμεύσεις, όχι προτίμηση

1. **Ο μηχανισμός τύπων το απαιτεί**: το §9.2 έχει ήδη επιλέξει `fast-formula-parser` και
   δηλώνει ότι «η βιβλιοθήκη μιλά `A1`/`B2`, το μοντέλο μιλά ids· ο adapter είναι το **μόνο**
   σημείο μετάφρασης». Το `table-cell-reference.ts` **είναι** αυτό το σημείο, μια φάση νωρίτερα.
2. **Το DXF το γράφει ήδη**: ένα κελί `ACAD_TABLE` κρατά `=Sum(A1:A5)` (§2).
3. **Το CAD το δείχνει ήδη**: `TABLEINDICATOR`.

**Γιατί ΟΧΙ «όνομα στήλης + αριθμός»** (η εναλλακτική που εξετάστηκε): ο `TableColumn` **δεν
έχει πεδίο ονόματος**. Η κεφαλίδα είναι απλώς κελί σε γραμμή `rowClass: 'header'` — μπορεί να
λείπει, να είναι κενή, ή δύο στήλες να έχουν το **ίδιο** κείμενο. Ταυτότητα που μπορεί να μη
λύνεται ή να λύνεται διπλά δεν είναι ταυτότητα· και επειδή θα την κληρονομούσαν οι τύποι, η
πρώτη διπλή κεφαλίδα θα έδινε **λάθος άθροισμα**.

**Πού ξεπερνάμε τους μεγάλους**: η κεφαλίδα επιστρέφεται **δίπλα** στην αναφορά — ταυτότητα το
`B3`, **συμφραζόμενο** το «Περιγραφή». Κανένας από Excel/Sheets/AutoCAD δεν δείχνει και τα δύο.
Σε πίνακα ποσοτήτων το νόημα της στήλης είναι ακριβώς αυτό που ψάχνει ο μηχανικός, και κοστίζει
μηδέν γιατί είναι **παράγωγο**. Και σε **συγχωνευμένο** λέγεται το **εύρος** (`B3:C4`, όπως τα
Sheets) αντί για σκέτη άγκυρα (Excel) — το εύρος είναι γνωστό από το μοντέλο, άρα η απόκρυψή
του θα ήταν επιλογή να πούμε λιγότερα απ' όσα ξέρουμε.

### 25.6 🔴 Η απόφαση 4 και ο κίνδυνος που κουβαλά: δύο πεδία, μία συνεδρία

Ολόκληρη η λειτουργία Excel (Φ.Δ.4, αποκοπή **43** window listeners) στηρίζεται στο ότι
υπάρχει **ένα εστιασμένο πεδίο κειμένου**. Ένα δεύτερο πεδίο ικανοποιεί **αμέσως** το παλιό
κριτήριο εξόδου: πατάς τη γραμμή τύπων → το κελί κάνει blur → ο δρομέας κλείνει → λύνεται το
modal scope. Δηλαδή η γραμμή τύπων θα σκότωνε τη συνεδρία **τη στιγμή που την πατάς**.

Η λύση ζει σε **ένα** αρχείο (`table-cell-session-focus.ts`) και κάνει **και τα δύο** που
επέτρεπε το handoff — γιατί είναι το ίδιο πράγμα: το σημάδι `data-table-cell-cursor` αλλάζει
σημασία από «είμαι ο δρομέας» σε «**ανήκω στη συνεδρία**», και το κριτήριο γίνεται συνάρτηση
που δεν μπορεί να ξαναγραφτεί με ορθογραφικό λάθος.

Η απόφαση χρησιμοποιεί `event.relatedTarget` (ποιος **παίρνει** την εστίαση) αντί για έλεγχο
ένα καρέ αργότερα. Και το ουσιώδες: όταν η εστίαση μετακινείται **μέσα** στη συνεδρία, **δεν
γίνεται commit**. Αλλιώς ο φρουρός «μία φορά» του `useInlineEditorKeys` θα κλείδωνε στο πρώτο
πέρασμα κελί→γραμμή, και ό,τι γραφόταν μετά **δεν θα δεσμευόταν ποτέ** — σιωπηλή απώλεια
πληκτρολόγησης, αόρατη σε κάθε test κατάστασης.

**Το πρόχειρο δεν διπλασιάζεται**: ζει ήδη στον δρομέα (απόφαση του βήματος 2). Και τα δύο
πεδία διαβάζουν από εκεί και γράφουν εκεί — μηδέν συγχρονισμός, γιατί μηδέν δεύτερη κατάσταση.
Το commit περνά από την **ίδια** `buildTableCellEditCommand`· καμία δεύτερη διαδρομή εγγραφής.

### 25.7 SSoT audit — τι επαναχρησιμοποιήθηκε, τι γεννήθηκε, **και τι βρέθηκε αλλού**

| Ερώτηση | Απάντηση |
|---|---|
| Υπάρχει ονοματολογία `A1` στον viewer; | **ΟΧΙ.** `grep` για `columnLetter\|colLetter\|a1Notation\|cellRef\|cellAddress` σε όλο το `src/subapps/dxf-viewer/` δίνει **μόνο** το άσχετο `TableCellRef` του `stamp-table-layout.ts` («ποιο κελί ζωγραφίζεται τώρα») |
| 🔴 Αλλού στο repo; | **ΝΑΙ, πέντε φορές.** `colLetter` **byte-ταυτόσημο** σε `builder-excel-analysis.ts` **και** `builder-excel-exporter.ts`· και τρεις παραλλαγές στο `systems/guides/` |
| Πού ζει το «τρέχον κελί»; | `state/table-cell-cursor-store.ts` — ένα SSoT, **δεν** γεννήθηκε δεύτερο |
| Πού μπαίνουν τα πάνελ; | `CanvasSectionOverlays.tsx`, **μέσα** στον container του καμβά — εκεί μπήκε και η γραμμή |
| Μηχανή αγκύρωσης; | `TextEditorAnchorLayer` + `createTextEditorAnchor2D` — **επαναχρησιμοποιήθηκαν αυτούσια** |
| Σημασιολογία πλήκτρων; | `resolveTableCellKeyIntent` — **μία**, και η **εκτέλεσή** της εξήχθη σε `use-table-cell-session-keys.ts` ώστε το δεύτερο πεδίο να μη γεννήσει αντίγραφο του `switch` |

**Νέα SSoT** (2, καταχωρημένα στο `.ssot-registry.json`):
- `src/lib/spreadsheet/column-letter.ts` — δείκτης ⇄ γράμμα, **bijective** base-26·
- `src/subapps/dxf-viewer/bim/table/table-cell-reference.ts` — ονομασία κελιού + ετικέτες ζωνών.

🔴 **Τι ΔΕΝ ενοποιήθηκε, και γιατί δεν είναι παράλειψη**: οι τρεις συναρτήσεις του
`systems/guides/` (`generateLetterLabels`, `autoLabel`, `generateLabels`) απαντούν σε **άλλη
ερώτηση** — ετικέτες **δομικού κανάβου** (AutoCAD/Revit grid bubbles), που ο χρήστης
αντικαθιστά (`guide.label`) και που σε ορισμένα πρότυπα **παραλείπουν** γράμματα (I/O/Q). Κοινή
συνάρτηση θα σήμαινε ότι μια αλλαγή στο πρότυπο κανάβου θα άλλαζε σιωπηλά τις **αναφορές
κελιών**, δηλαδή τους τύπους. **Ομώνυμα, όχι συνώνυμα.** (Και οι τρεις σπάνε ούτως ή άλλως μετά
το `ZZ` — χειρίζονται μόνο δύο γράμματα· το test το κλειδώνει ρητά.)

**Boy Scout (N.0.2)** — δύο διπλότυπα εξοντώθηκαν στα ίδια δύο αρχεία `report-engine`:
`colLetter` → `@/lib/spreadsheet/column-letter`, και `getExcelFormat` → νέο
`builder-excel-number-format.ts`. Το δεύτερο **δεν** είναι καλλωπισμός: το φύλλο «Ανάλυση»
δείχνει αθροίσματα των στηλών του φύλλου «Δεδομένα» — αν οι δύο μορφές αποκλίνανε, το ίδιο
νούμερο θα εμφανιζόταν με άλλη μορφή στα δύο φύλλα του **ίδιου** βιβλίου.

### 25.8 Η μία επέκταση συμβολαίου: `offsetYPx`

Το `TextEditorAnchorBox` είχε `offsetXPx` (τοπική μετατόπιση **μετά** την περιστροφή). Η
γραμμή τύπων χρειάζεται και **κατακόρυφη**: αγκυρώνεται στη γωνία του πίνακα αλλά κάθεται πιο
πάνω κατά ένα ύψος ζώνης δείκτη — και το ύψος αυτό είναι σε **px οθόνης**, άρα αλλάζει σε κάθε
zoom. Σημείο κόσμου δεν μπορεί να το εκφράσει: το `worldPoint` υπολογίζεται μία φορά ανά
συνεδρία, ενώ η μετατόπιση πρέπει να ξαναβγαίνει σε κάθε tick.

⚠️ Οι δύο άξονες εκπέμπονται **μαζί ή καθόλου**. Ένα `translate` με έναν μόνο άξονα θα σήμαινε
ότι ο άλλος επανέρχεται σιωπηλά στο μηδέν όταν η πρώτη τιμή μηδενιστεί — test το κλειδώνει.

### 25.9 🔴 Το αναποδογύρισμα — το βρήκε **ΜΟΝΟ ο browser**

Στην πρώτη ζωντανή δοκιμή ο πίνακας ήταν κοντά στο πάνω χείλος του σχεδίου και η γραμμή τύπων
κάθισε **έξω από την περιοχή σχεδίασης, πάνω στις κορδέλες της εφαρμογής**. Κανένα test δεν το
έπιανε, και δεν είναι σφάλμα του clamping: το `TextEditorAnchorLayer` περιορίζει στο
**παράθυρο**, και η θέση ήταν απολύτως έγκυρη εκεί — απλώς όχι μέσα στον καμβά.

Η απάντηση **δεν** είναι «περιόρισέ την στον καμβά»: εκεί θα κολλούσε στο χείλος και θα
σκέπαζε τα γράμματα των στηλών, δηλαδή θα έκρυβε ακριβώς αυτό που εξηγεί. Πάει **κάτω** από
τον πίνακα — η ίδια απόφαση που παίρνει κάθε tooltip όταν δεν χωρά. Ο διαθέσιμος χώρος
μετριέται στη **φάση ανάγνωσης** του tick (πριν από κάθε εγγραφή), άρα μηδέν επιπλέον
ανακατασκευή διάταξης.

### 25.10 Έλεγχοι

```
npx jest src/subapps/dxf-viewer/bim/table src/subapps/dxf-viewer/rendering/entities/table \
         src/subapps/dxf-viewer/ui/table-cell-editor src/subapps/dxf-viewer/bim/text \
         src/subapps/dxf-viewer/bim/structural/detail-sheet src/subapps/dxf-viewer/export \
         src/subapps/dxf-viewer/ui/text-toolbar src/lib/spreadsheet
→ 116 suites / 1.358 tests / 21 snapshots — ΟΛΑ ΠΡΑΣΙΝΑ  (ήταν 110 / 1.283 στο βήμα 6)

npx jest src/subapps/dxf-viewer/state src/subapps/dxf-viewer/systems/command-line \
         src/subapps/dxf-viewer/keyboard src/lib/a11y     → 19 suites / 335 tests ✅
npx jest src/services/report-engine                        → 9 suites / 223 tests ✅
npm run test:registry-golden                               → 102 tests ✅ (οι 2 νέες ERE έγκυρες)
npm run jscpd:diff <17 αρχεία>                             → ✅ καθαρό
```

**Mutation-verified 7/7** — κάθε μηχανισμός σπασμένος, κόκκινο, επαναφορά:

| Μετάλλαξη | Αποτέλεσμα |
|---|---|
| `columnLetter`: bijective → απλή base-26 (`AA` → `BA`) | ΚΟΚΚΙΝΟ |
| `tableRowNumber`: 1-based → 0-based | ΚΟΚΚΙΝΟ |
| δείκτης: **και οι δύο** φύλακες LOD αφαιρεμένοι | ΚΟΚΚΙΝΟ |
| δείκτης: η ενεργή υποδιαίρεση χάνει το χρώμα δρομέα | ΚΟΚΚΙΝΟ |
| φύλακας εστίασης: ο έλεγχος `relatedTarget` αφαιρεμένος | ΚΟΚΚΙΝΟ |
| πλήκτρα: `move` **πριν** από `commit` | ΚΟΚΚΙΝΟ |
| `offsetYPx`: ο ένας άξονας μηδενίζει σιωπηλά τον άλλο | ΚΟΚΚΙΝΟ |

⚠️ **Ειλικρίνεια**: η πρώτη απόπειρα της τρίτης μετάλλαξης βγήκε **πράσινη** — είχα σπάσει
μόνο τον φύλακα πλάτους, και τον έπιανε ο αδελφός του (ύψος). Δεν ήταν τυφλό test, ήταν τυφλή
**μετάλλαξη**· ξαναέγινε σωστά.

### 25.11 Ζωντανή επαλήθευση — **με δεδομένα, όχι με οθόνη** (2026-08-01)

Πλήρες reload (1.955 οντότητες), πίνακας `ent_89f53628`:

| Τι | Μετρημένο |
|---|---|
| Δύο πεδία, ένα πρόχειρο | `[{TEXTAREA, "Κελί πίνακα", "Περιγραφή"}, {INPUT, "Τιμή κελιού", "Περιγραφή"}]` — **ίδια τιμή** |
| Αναφορά + κεφαλίδα | `B2 · Περιγραφή` · μετά από κλικ σε άλλο κελί → `A3 · Α/Α` |
| Ζώνες δείκτη | `1 2 3 4 5` αριστερά με τη **2** φωτισμένη· `A B C` πάνω με τη **B** φωτισμένη |
| **Ο πίνακας δεν κουνήθηκε** | Ίδιες συντεταγμένες οθόνης πριν/μετά την είσοδο σε κελί |
| 🔴 **Ο δρομέας ΕΠΙΒΙΩΣΕ** της εστίασης στη γραμμή | `activeIsSession: true` — καμία έξοδος |
| **Γραφή ΜΕΣΑ στη γραμμή** | Πληκτρολόγησα `DOKIMI-FX` στη γραμμή· το **κελί στον καμβά** το έδειξε **ταυτόχρονα** |
| **`Enter` από τη γραμμή** | Δέσμευσε **και** μετακίνησε τον δρομέα στη γραμμή 4 (`A4 · Α/Α`), autosave |
| **`Tab`** | `A4` → `B4 · Περιγραφή` |
| Αναποδογύρισμα | `barRect.y` **μέσα** στον καμβά (`canvasTop: 204`, `barInsideCanvas: true`) |
| Καθαρισμός | `Ctrl+Z` · **μετά από πλήρες reload**: 1.955 οντότητες, `anyTestData: false` |

🔴 **Το `Enter` και το `Tab` έφτασαν ζωντανά** — κλείνει το ανεπαλήθευτο #3 του βήματος 6. Η
παγίδα «τα συνθετικά πλήκτρα δεν φτάνουν» **δεν** ισχύει όταν η εστίαση κάθεται σε πραγματικό
`<input>` της γραμμής τύπων.

### 25.12 Τι ΔΕΝ επαληθεύτηκε ζωντανά (δηλωμένο, όχι κρυμμένο)

- **Δεξιά/κεντρική στοίχιση και στραμμένος πίνακας** — κληρονομείται από το βήμα 6. Και οι δύο
  πίνακες της σκηνής είναι `angleRad = 0` με όλες τις στήλες `align: 'left'`· απαιτεί **άδεια**
  του Giorgio για δοκιμαστικό πίνακα.
- **Εξαγωγή σε αρχείο** — κληρονομείται από το βήμα 5. Απαιτεί **ρητή άδεια** (λήψη αρχείου).
- **Ζώνη γραμμάτων σε πίνακα στο πάνω χείλος**: όταν ο πίνακας ακουμπά την κορυφή του καμβά, η
  ζώνη `A B C` **κόβεται** από την άκρη του καμβά. Είναι εγγενές στην απόφαση «αγκυρωμένη στον
  πίνακα» (η γραμμή τύπων αναποδογυρίζει· η ζώνη είναι μέρος του πίνακα και δεν μπορεί).
  Παρατηρημένο, **όχι** διορθωμένο.

### 25.13 Τι ρητά ΔΕΝ κάνει το βήμα 7

- **Δεν αξιολογεί τύπους** (Φ.Δ.11) — η γραμμή είναι το **παράθυρο** που θα τους δείξει.
- **Δεν κάνει `Ctrl+Shift+U`** (μεγάλωμα γραμμής): μία σειρά, όπως η προεπιλογή του Excel.
- **Δεν δέχεται πληκτρολογημένη αναφορά για πλοήγηση** (Excel Name Box): το
  `parseTableCellReference` υπάρχει και είναι δοκιμασμένο, αλλά δεν είναι συνδεδεμένο σε
  διεπαφή — ανήκει στο Φ.Δ.8 (επιλογή περιοχής).
- **Δεν αγγίζει επιλογή περιοχής** ούτε το μοντέλο: η εμφάνιση μιας τιμής δεν είναι συγγραφέας.

---

## 26. Φάση Δ βήμα 8 — **ΕΠΙΛΟΓΗ ΠΕΡΙΟΧΗΣ + ΑΝΤΙΓΡΑΦΗ/ΕΠΙΚΟΛΛΗΣΗ** (2026-08-02)

### 26.1 Το πρόβλημα
Μέχρι το βήμα 7 ο πίνακας είχε **ένα** τρέχον κελί. Κάθε πράξη σε πολλά κελιά — αντιγραφή
μιας στήλης ποσοτήτων, άδειασμα ενός μπλοκ, μεταφορά δεδομένων από/προς Excel — ήταν
αδύνατη. Είναι το τελευταίο βήμα πριν ο πίνακας γίνει χρησιμοποιήσιμος για **πραγματική**
καταχώριση ποσοτήτων.

### 26.2 Έρευνα — τι κάνουν οι μεγάλοι
| Ερώτημα | AutoCAD `ACAD_TABLE` | Excel | Απόφαση εδώ |
|---|---|---|---|
| Ασυνεχής επιλογή (`Ctrl+κλικ`) | **Δεν υπάρχει** (νήμα CADTutor: «μόνο με προγραμματισμό») | Υπάρχει, αλλά **δεν αντιγράφεται** («*That command cannot be used on multiple selections*») | **Μόνο ορθογώνια** |
| Επιλογή που κόβει συγχώνευση | — | **Κουμπώνει** ώστε να περικλείει ολόκληρες | Ίδιο |
| `Ctrl+A` | — | Επιλέγει όλα, **αφήνει το ενεργό κελί όπου ήταν** | Ίδιο |
| Επικόλληση που δεν χωράει | Γεμίζει όσα χωρούν | Επεκτείνει το φύλλο | **Κόβεται, με μήνυμα** |
| Μορφή προχείρου | — | `text/html` **+** `text/plain` (**TSV**) | Διαβάζουμε **TSV** |

⇒ Το σχήμα των δεδομένων είναι **δύο γωνίες**, όχι λίστα περιοχών. Μια δομή που δεν μπορεί
καν να **εκφράσει** την ασυνεχή επιλογή δεν μπορεί ούτε να την αφήσει να διαρρεύσει σε
αντιγραφή που δεν την υποστηρίζει.

### 26.3 Οι πέντε αποφάσεις (Giorgio, **πριν** τον κώδικα)
1. **Μόνο ορθογώνια περιοχή** — όχι ασυνεχής (§26.2).
2. **Η γραμμή τύπων μένει στο ενεργό κελί**· το μέγεθος πάει στη **γραμμή κατάστασης**. Το
   πεδίο τιμής είναι πεδίο **γραφής**: με έξι κελιά μαρκαρισμένα, η απάντηση στο «ποιο
   αλλάζει;» πρέπει να είναι πάντα σαφής.
3. **Ό,τι δεν χωράει κόβεται, με μήνυμα.** Ο πίνακας **ΔΕΝ** μεγαλώνει μόνος του — ίδιο
   επιχείρημα με το «το `Tab` στο τελευταίο κελί δεν φτιάχνει γραμμή»: σιωπηλή μεταβολή
   **γεωμετρίας οντότητας σχεδίου** από πλήκτρο είναι μη-αναστρέψιμη έκπληξη σε undo CAD.
4. **ΕΝΑ undo** για όλη την επικόλληση.
5. **Από Excel μπαίνει σκέτο κείμενο**, με ρητό μήνυμα. ⚠️ Ο **τύπος** χάνεται ως τύπος αλλά
   **μπαίνει ως τιμή**: το Excel γράφει στο TSV το **αποτέλεσμα** (`24`), όχι το `=A1*2`.

### 26.4 🔴 Η επιλογή ΔΕΝ είναι τέταρτη κατάσταση δρομέα — είναι **έκταση**
Το βήμα 4 απέρριψε ήδη τέταρτη κατάσταση, και το επιχείρημα ισχύει αυτούσιο: ο δρομέας
εξακολουθεί να κάθεται σε **ένα** κελί και να δέχεται πληκτρολόγηση. Η περιοχή ζει σε δικό
της πεδίο του store (`selection`), **όχι** μέσα στο `TableCursorPosition`: εκείνο είναι
**καθαρή θέση** και το παράγουν τέσσερις δρόμοι, ένας από τους οποίους είναι μια
πληκτρολογημένη αναφορά `B3` στη γραμμή τύπων — που δεν έχει καμία σχέση με επιλογή.

#### 🔴 Γιατί ΔΥΟ γωνίες και όχι «ενεργό κελί + άκρο» — το `Ctrl+A` διέψευσε την πρώτη σχεδίαση
Πρώτη σχεδίαση: `rangeEnd`, με το ενεργό κελί ως τη μία γωνία. **Το `Ctrl+A` τη σκότωσε**:
με ενεργό κελί το `C5`, η περιοχή είναι `A1:τέλος` — ορθογώνιο που **δεν έχει το ενεργό κελί
σε καμία γωνία του**. Η μόνη διέξοδος θα ήταν να **μετακινήσει** τον δρομέα στο `A1`, δηλαδή
το `Ctrl+A` να πλοηγεί ενώ πρέπει μόνο να επιλέγει. Η περιοχή έγινε **ανεξάρτητη** από τη θέση.

### 26.5 Το κούμπωμα στις συγχωνεύσεις — **βρόχος**, όχι ένα πέρασμα
Μια επέκταση φέρνει την περιοχή σε επαφή με **δεύτερη** συγχώνευση, που την επεκτείνει ξανά.
Ο βρόχος τερματίζει πάντα (το ορθογώνιο μόνο μεγαλώνει και είναι φραγμένο από το πλέγμα).
⚠️ Καμία δεύτερη λογική συγχωνεύσεων: τα ορθογώνια των spans βγαίνουν από το **ίδιο**
`model.merges` που διαβάζει το `buildMergeIndex`, με την ίδια περικοπή και την ίδια ανοχή.

### 26.6 🔴 «ΕΝΑ undo» χωρίς **καμία** νέα μηχανική
Υπάρχει έτοιμη υποδομή σύνθετης εντολής (`CompositeCommand` / `executeAsAtomicBatch`,
ADR-539) — **και δεν χρειάστηκε**. Το `setPersistedCellText` είναι ήδη **καθαρός,
αμετάβλητος** γραφέας: εφαρμόζεται Ν φορές πάνω στο ενδιάμεσο αποτέλεσμα **στη μνήμη** και
φτάνει ως **ένα** τελικό μοντέλο. Ένα `UpdateEntityCommand`, ένα undo, και — το σημαντικότερο
— **η ίδια ακριβώς διαδρομή commit** με τη μονή επεξεργασία κελιού (`buildTableModelCommand`,
εξαγμένη ώστε οι τέσσερις γραφείς να μην τη γράψουν τέσσερις φορές).
**Η ατομικότητα βγήκε δωρεάν από την καθαρότητα, αντί να χτιστεί από πάνω της.**

### 26.7 🔴 Το πρόχειρο ΔΕΝ περνά από πλήκτρα
Το `Ctrl+C`/`Ctrl+V`/`Ctrl+X` **δεν** αναγνωρίζονται ως `keydown`. Ο browser εκπέμπει ήδη
πραγματικά συμβάντα `copy`/`cut`/`paste` στο εστιασμένο `<textarea>`, με έτοιμο
`clipboardData`. Καλύτερο σε **τέσσερα** μέτωπα, το καθένα αρκετό από μόνο του:
1. **Καμία άδεια, καμία χειρονομία** — το `navigator.clipboard.readText()` τα απαιτεί· το
   `clipboardData` του συμβάντος **είναι** η χειρονομία.
2. **Κάθε διάταξη πληκτρολογίου** — σε ελληνική, το `Ctrl+C` έχει `key: 'ψ'` και το `Ctrl+V`
   `key: 'ω'`. Ένας έλεγχος χαρακτήρα θα δούλευε **μόνο** σε λατινική.
3. **Ό,τι έχει το πρόχειρο**, όχι ό,τι νομίζουμε.
4. **Το δεξί κλικ → «Επικόλληση» δουλεύει δωρεάν.**

⚠️ Το ίδιο μάθημα χτύπησε και το `Ctrl+A`, που **είναι** πλήκτρο: ελέγχεται με
`mod.code === 'KeyA'` (φυσική θέση), ποτέ με χαρακτήρα — σε ελληνική διάταξη το `key` είναι `'α'`.

### 26.8 Η ιδιοκτησία των τριών πλήκτρων είναι **δομική**
Και τα τρία ήταν πιασμένα από τον καμβά με σοβαρές εντολές: `Ctrl+A` = επιλογή **όλων των
οντοτήτων**, `Ctrl+C`/`Ctrl+V` = πρόχειρο **οντοτήτων** (ADR-466, cross-floor). Αν διέρρεαν,
το `Ctrl+C` μέσα σε κελί θα αντέγραφε **ολόκληρο τον πίνακα ως οντότητα** και το επόμενο
`Ctrl+V` θα γεννούσε **δεύτερο πίνακα**. Δεν διεκδικήθηκαν με `if`: ο `useDxfToolbarShortcuts`
παραιτείται από **κάθε** συντόμευση όταν ο στόχος είναι `INPUT`/`TEXTAREA`, και η λειτουργία
πίνακα κρατά ένα τέτοιο μονίμως εστιασμένο (βήμα 2). Ζωντανό anchor με **αντίστροφη**
απόδειξη: `table-clipboard-key-ownership.test.tsx` (10 tests).

### 26.9 Το κλικ — **παθητικός** ακροατής, μηδέν άγγιγμα στον orchestrator
Απλό κλικ μετακινεί το ενεργό κελί, `Shift+κλικ` απλώνει την περιοχή. Ο ακροατής **ποτέ**
`preventDefault`/`stopPropagation`: ο καμβάς παραμένει ιδιοκτήτης του ποντικιού (λαβές,
μετακίνηση, πλαίσιο επιλογής), και εδώ γίνεται μόνο μια **επιπλέον ανάγνωση**. Έτσι το
`CanvasSection` — που ο ADR-040 απαγορεύει να αποκτήσει συνδρομές — δεν αγγίζεται καθόλου.
🔴 Ο δρομέας **δεν κλείνει** από το blur που ακολουθεί, επειδή ο φύλακας
(`useTableCellSessionBlur`) αναβάλλει την απόφαση κατά **ένα καρέ** όταν ο παραλήπτης της
εστίασης είναι `null` — και το σχόλιο εκείνου του αρχείου ονομάζει **ρητά** το «κλικ στον
καμβά» ως τον λόγο. Χτίζουμε σε δηλωμένη εγγύηση, όχι σε παρενέργεια.

### 26.10 SSoT audit — τι επαναχρησιμοποιήθηκε, τι γεννήθηκε, τι **βρέθηκε αλλού**
| Ερώτημα | Απάντηση |
|---|---|
| Έννοια «περιοχή κελιών»; | **Πουθενά** — γράφτηκε καθαρή (`bim/table/table-cell-range.ts`) |
| ⚠️ Ψευδο-εύρημα | Το `anchorIndexAt` είναι άγκυρα **συγχώνευσης**, όχι επιλογής. **Ομώνυμα, όχι συνώνυμα** — δεν επαναχρησιμοποιήθηκε |
| `Shift+βέλος`; | **Μηδέν νέα πλοήγηση** — δανείζεται αυτούσιο το `moveTableCursor`, άρα ο κανόνας «άλλαξε ο ιδιοκτήτης» ισχύει δωρεάν και στην επέκταση |
| TSV parser; | **Κανένας** ⇒ νέο SSoT `lib/spreadsheet/tsv.ts` (registry: `spreadsheet-tsv`), δίπλα στον αδελφό `column-letter` |
| 🔴 Δύο **line-based** CSV splitters | `DataImportService.parseCSVLine` + `csv-import-service.splitCSVLine` — structural clones **και οι δύο ανίκανοι** για ενσωματωμένη αλλαγή γραμμής. **ΔΕΝ** ενοποιήθηκαν (άλλος τομέας, χωρίς δικά τους tests) — **καταγράφηκαν** στο `pending-ratchet-work.md` |
| Χρώμα επιλογής | **Παράγωγο** του `INDICATOR_BLUE` μέσω του `hexToRgba` SSoT (ADR-571), ποτέ δεύτερο κυριολεκτικό `rgba(...)` |
| Διαδρομή 4 γωνιών | Ήταν γραμμένη **τρεις** φορές ⇒ ένα `traceRectMm`. Το jscpd το έπιασε **μέσα στο ίδιο commit** |

### 26.11 Το ελάττωμα που βρήκε ένα test — **φάντασμα εγγραφή**
Το `setPersistedCellText` σε κελί που **δεν υπάρχει** με κείμενο `''` γεννούσε εγγραφή
`{ kind: 'text', value: '' }` και **νέο μοντέλο**. Ο χάρτης είναι **αραιός**: απόν κελί
σημαίνει ήδη κενό. Δύο ζωντανές συνέπειες, και οι δύο προϋπήρχαν του βήματος 8:
**(α)** `Delete` σε ήδη κενό κελί παρήγαγε `UpdateEntityCommand` — ένα `Ctrl+Z` που δεν
αναιρεί τίποτα ορατό· **(β)** `Delete` σε περιοχή 500 κενών κελιών θα έγραφε 500 άχρηστες
εγγραφές και θα ακύρωνε τις μνήμες `resolveTableModel`/`resolveTableLayout` χωρίς λόγο.
Η τέταρτη εγγύηση (ταυτότητα) επεκτάθηκε στο απόν κελί.

### 26.12 Έλεγχοι
| Σουίτα | Τι κλειδώνει |
|---|---|
| **ΝΕΟ** `lib/spreadsheet/__tests__/tsv.test.ts` | Το **quoting** (RFC 4180 με στηλοθέτη): κελί με tab/newline/εισαγωγικά· κύκλος γράψε→διάβασε |
| **ΝΕΟ** `bim/table/__tests__/table-cell-range.test.ts` | Κανονικοποίηση, **αλυσιδωτό** κούμπωμα, `Ctrl+A`, μέλη ανά άξονα, `Shift+βέλος` |
| **ΝΕΟ** `bim/table/__tests__/table-range-clipboard.test.ts` | §26.3 ως **εκτελέσιμη προδιαγραφή**: κόψιμο, καλυμμένα κελιά, ένα μοντέλο, καθαρότητα |
| **ΝΕΟ** `ui/table-cell-editor/__tests__/table-clipboard-key-ownership.test.tsx` | Ο καμβάς **δεν** βλέπει τα τρία πλήκτρα μέσα στον πίνακα — **και τα ξαναβλέπει** μόλις βγεις |
| `table-cell-key-intent.test.ts` (+31) | `Shift+κίνηση`, `Ctrl+A` **σε ελληνική διάταξη**, εύρος προχείρου |

**Mutation-verified**: **11 από 12** σκέλη έδωσαν κόκκινο. Το 12ο (η στήλη αγκύρωσης της
συνθετικής θέσης στο `extendTableCellRangeEnd`) είναι **ισοδύναμη μετάλλαξη**: μόνο τα
`commitDown`/`commitUp` τη διαβάζουν, και αυτά χαρτογραφούνται ρητά σε **κίνηση**, ποτέ σε
επέκταση. Η ιδιότητα **κλειδώθηκε με test** αντί να μείνει σιωπηλή.

### 26.13 ✅ Η ζωντανή επαλήθευση — **ΕΓΙΝΕ** (2026-08-02), με **ένα** εύρημα

Και τα οκτώ σημεία περπατήθηκαν σε πραγματικό Chrome. Η **επέκταση** Claude-in-Chrome δεν
συνδέθηκε ποτέ (δες handoff §0.1) και **εγκαταλείφθηκε**: ο browser οδηγήθηκε με **CDP**
(Playwright `connectOverCDP` στη θύρα 9222), που έδωσε κάτι που η επέκταση δεν μπορούσε —
**αληθινό πληκτρολόγιο** και **αληθινό πρόχειρο λειτουργικού**.

| # | Τι | Απόδειξη |
|---|---|---|
| 1 | `Ctrl+C` → **πραγματικό πρόχειρο Windows** | `Get-Clipboard` = `777⇥12.50␍␊Skyrodema C25⇥5` — TAB + **CRLF**, ό,τι δέχεται το Excel ως 2×2. Αντίστροφα: `Set-Clipboard` 3×3 → `Ctrl+V` → μπήκε |
| 2 | Περιοχή + ζώνες | `Shift+βέλος` ✅ (μεγαλώνει **και** συρρικνώνεται)· `Ctrl+A` ✅ · ζώνες `A B C`/`1..5` ανάβουν **ολόκληρες**, ενεργό κελί με ξεχωριστό περίγραμμα (screenshot). `Shift+κλικ` ήταν 🔴 ⇒ **✅ λύθηκε**, δες §26.15 |
| 3 | Πληθυντικοί ICU | «χώρεσαν **2 από 3 γραμμές** · **1 από 3 στήλες**»· και ενικός/πληθυντικός στο μέγεθος: «**1 γραμμή**» vs «**2 γραμμές**» |
| 4 | **ΕΝΑ** `Ctrl+Z` | Επικόλληση έγραψε `C4`+`C5`· **ένα** undo τα επανέφερε **και τα δύο** (σύγκριση ολόκληρου του πλέγματος πριν/μετά: ταυτόσημα) |
| 5 | Μέγεθος υπό **συγχώνευση** | Δρομέας στο συγχωνευμένο → γραμμή τύπων `A1:C1` (**εύρος**, όχι «A1»)· `Shift+Κάτω` → «**2 γραμμές × 3 στήλες**» — κούμπωσε ολόκληρη τη συγχώνευση. Η αφελής αφαίρεση θα έλεγε «2 × 1» |
| 6 | **Περιστροφή** + σκέλος Β΄ | Καταγραφέας `fillText`: άστροφος `{0, −π/2}` (μόνο χάρακες)· στραμμένος 0,35 → **10 κείμενα με `rot = −0,35`** = ακριβώς τα 10 κείμενα κελιών. Επιβεβαιωμένο και με screenshot |
| 7 | «Εξαγωγή» + `Ctrl+E` | **Και τα δύο** ανοίγουν τον διάλογο «Εξαγωγή Σχεδίου»· **κανένα** `Unknown action: export` |
| 8 | Φ.Δ.1-7 άθικτα | Σκάλα `Esc` + «διπλό `F2`»: `Επεξεργασία → Έτοιμο → Επεξεργασία → Καταχώριση`· βέλη σε `nav`· type-to-replace (**ελληνικά**)· `Enter` δεσμεύει + κατεβαίνει· `Esc` **ακυρώνει** (επαληθευμένο στο **μοντέλο**) |

**Όργανα** (εκτός repo, `C:\Users\user\.claude\dxf-live-verify\`): `drive.js` (μία εντολή ανά
κλήση), `run.js` (σενάριο με **καταγραφή κονσόλας** — ο drive αποσυνδέεται και τα σφάλματα
συμβαίνουν ανάμεσα στις κλήσεις), `lib.js` (κοινές μετρήσεις), `sc-*.js` (ένα ανά σημείο).

🔬 **Τρεις παγίδες που κόστισαν και είναι γραμμένες στα όργανα** — (α) το `?s=&ox=&oy=` του
ADR-400 **αγνοείται** όταν η σκηνή φορτώνει ψυχρή (fit-to-view στα νέα bounds το ξαναγράφει,
3/3 αποτυχίες)· πλαισίωση μόνο μέσω διεπαφής (`Home` → ροδέλα → `Z`)· (β) το `s` του URL είναι
**debounced**, οπότε βρόχος ζουμ που το εμπιστεύεται φεύγει ως το ταβάνι (μετρημένο: `100000`)
— διάβαζε την **ετικέτα** κλίμακας· (γ) ο καμβάς **μετακινείται** στη σελίδα (η γραμμή
κατάστασης τυλίγεται όταν εμφανιστεί το μέγεθος περιοχής, +16px· η γραμμή τύπων άλλα +16px),
άρα οι θέσεις κελιών πρέπει να είναι **μετατοπίσεις ως προς τον καμβά**, ποτέ απόλυτες.

### 26.15 🔴 ΕΥΡΗΜΑ ⇒ ✅ **ΛΥΘΗΚΕ** — οποιοδήποτε κλικ στον καμβά έκλεινε τη συνεδρία

Το §4.1 του handoff το προέβλεψε ονομαστικά («αν ο δρομέας κλείνει σε κάθε κλικ, η κούρσα
έχασε»). **Έχασε.** Δύο γραμμές του πίνακα συμπεριφοράς (§26 «απλό κλικ μετακινεί κελί» και
«`Shift+κλικ` = δεύτερη γωνία») **δεν λειτουργούν ζωντανά**.

**Το αποφασιστικό πείραμα** — τρία κλικ, με θετικό control:

| Πείραμα | Αποτέλεσμα |
|---|---|
| κλικ στο **ΙΔΙΟ** κελί (`B3`) | ☠️ η συνεδρία κλείνει |
| κλικ σε **ΑΛΛΟ** κελί (`C3`) | ☠️ η συνεδρία κλείνει |
| κλικ στη **γραμμή τύπων** *(control)* | ✅ **ζει** — `nav → Επεξεργασία`, `activeElement` μέλος συνεδρίας |

Το control αποδεικνύει ότι ο μηχανισμός συνεδρίας είναι **υγιής**. Επειδή πεθαίνει **και** το
κλικ στο ίδιο κελί, η αιτία **δεν** είναι το hit-test ούτε η μετακίνηση του δρομέα: είναι το
ίδιο το κλικ στον καμβά. Χωρίζοντας `mousedown` από `mouseup`, η συνεδρία είναι νεκρή ήδη
**50ms μετά το mousedown** — ο δρομέας δεν πρόλαβε ποτέ να μετακινηθεί.

**Ρίζα.** Ο `useTableCellSessionBlur` (`table-cell-session-focus.ts`) κλείνει μέσα σε **ένα**
`requestAnimationFrame` αν κανένα μέλος δεν έχει την εστίαση. Ο `use-table-cell-pointer`
στηρίζεται ρητά στην υπόθεση ότι μέσα σε εκείνο το καρέ «το store έχει μετακινήσει τον δρομέα
και το React έχει στήσει **νέο `<textarea autoFocus>`**». **Το React δεν εγγυάται render μέσα
σε ένα rAF** — και στη μέτρηση δεν το κάνει ποτέ (11/11 αποτυχίες).

⚠️ **ΜΗΝ** το «διορθώσεις» με `stopPropagation` στον pointer: το ίδιο το αρχείο εξηγεί ότι θα
έσπαγε το σύρσιμο λαβών και τη μετακίνηση της οντότητας. Η κατεύθυνση που δηλώνει το §4.1
είναι να **μάθει ο φύλακας** ότι το κλικ έπεσε **μέσα στην ίδια συνεδρία** — δηλαδή το
κριτήριο κλεισίματος να πάψει να είναι «ποιος έχει την εστίαση **τώρα**» και να γίνει «έφυγε
η συνεδρία;», ερώτημα που απαντά το store, όχι το DOM.

⚠️ Παρενέργεια που κόστισε δεδομένα κατά τη δοκιμή: μόλις κλείσει ο δρομέας, ο πίνακας μένει
**επιλεγμένος με λαβές** και το επόμενο κλικ **σέρνει λαβή** (γραμμή κατάστασης: «Λειτουργία
λαβής: Έλξη»). Έτσι ο πίνακας περιστράφηκε κατά `−0,0124 rad` και μετακινήθηκε `200mm` χωρίς
να το ζητήσει κανείς. **Και τα δύο επαναφέρθηκαν** και επαληθεύτηκαν.

---

#### 26.15.1 🔴 Η ρίζα ήταν **ΔΥΟ** πράγματα, και το πρώτο δεν ήταν καν κούρσα

Η αρχική διάγνωση («το React δεν προλαβαίνει μέσα σε ένα rAF») ήταν **μισή**. Καταγραφή
συμβάντων εστίασης γύρω από **δύο διαδοχικά κλικ στο ίδιο σημείο** έδειξε το υπόλοιπο:

| κλικ | στόχος του `mousedown` | αποτέλεσμα |
|---|---|---|
| 1ο — ο δρομέας ήταν **αλλού** | `CANVAS` | ο ακροατής του πίνακα το βλέπει ✅ |
| 2ο — ο δρομέας ήταν **εκεί** | **`DIV`** | ο ακροατής **δεν το βλέπει ποτέ** ☠️ |

**Αιτία Α — το κέλυφος σκέπαζε το κελί.** Ο επεξεργαστής κελιού δηλώνει `pointer-events-none`
σε πλοήγηση «ώστε τα κλικ να περνούν στον καμβά από κάτω» (§ βήμα 2) — αλλά το δήλωνε **μόνο
το `<textarea>`**. Το `TextEditorAnchorLayer`, ένα `position: fixed` κουτί πάνω από τον καμβά,
παρέμενε στόχος. Δηλαδή **το ενεργό κελί ήταν πάντα σκεπασμένο από το ίδιο του το κέλυφος**:
δεν υπήρχε κούρσα να κερδίσει κανείς, το πάτημα δεν έφτανε ποτέ. Γι' αυτό το κλικ στο ίδιο
κελί αποτύγχανε **11/11** με μηδενική διακύμανση — απουσία, όχι χρονισμός.

**Αιτία Β — ένα κλικ παράγει ΔΥΟ `focusout`, όχι ένα:**

```
mousedown → focusout (Α: ξαναστήσιμο πεδίου) → focusin → focusout (Β: μεταφορά εστίασης) → mouseup
```

Το (Β) είναι η **προεπιλεγμένη ενέργεια** του `mousedown` και έρχεται **τελευταία** — μετά
τους ακροατές, μετά ακόμα κι από σύγχρονο πέρασμα του React. Ό,τι εστιαστεί μέσα στο
`mousedown` το ξεεστιάζει ο ίδιος ο browser αμέσως μετά.

#### 26.15.2 Η λύση — **αλλάζει η ερώτηση**, όχι ο χρονισμός

Ο φύλακας ρωτούσε μόνο «ποιος έχει την εστίαση;» — ερώτηση του DOM, που ένα κλικ σε καμβά
απαντά πάντα «κανείς». Τώρα ρωτά **δεύτερο**, μόνο όταν το πρώτο απαντήσει «κανείς»: «μήπως
αυτό το blur το προκάλεσε **δικό μου** κλικ;» — ερώτηση που **μόνο ο pointer** μπορεί να
απαντήσει, γιατί μόνο αυτός έτρεξε hit-test.

| Αλλαγή | Πού | Γιατί |
|---|---|---|
| `transparentToPointer` | `TextEditorAnchorLayer` + `TableCellEditorOverlay` | το κέλυφος δεν αρπάζει το ποντίκι σε πλοήγηση· **opt-in**, οι άλλοι δύο καταναλωτές (γραμμή τύπων, ελεύθερο κείμενο) **πρέπει** να δέχονται κλικ |
| `claimTableCellSessionPointerDown()` | `table-cell-session-focus.ts` — **ο ίδιος** ορισμός με το `TABLE_CELL_SESSION_MARKER` | ο καμβάς **δεν μπορεί** να φέρει το σημάδι (θα κρατούσε τη συνεδρία ζωντανή σε κάθε κλικ οπουδήποτε στο σχέδιο), άρα το κλικ **δηλώνεται** |
| τρίτη έκβαση `onReclaim` | `useTableCellSessionBlur` | ανάκτηση αντί κλεισίματος — μέσω `restartTableCellCursorSession`, τον **ίδιο** δρόμο που επαναφέρει την εστίαση μετά το μενού κεφαλίδων (βήμα 9). Καμία δεύτερη μηχανική |
| `isTableCellSessionElement(event.target)` | `use-table-cell-pointer` | το κλικ **μέσα στο κείμενο που γράφεις** είναι τοποθέτηση κέρσορα, όχι κλικ στον καμβά |
| `onCommitPending()` πριν τη μετακίνηση | `use-table-cell-pointer` + `useTableCellDoubleClickEditor` | δες §26.15.3 |

**Ο κύκλος ζωής της δήλωσης είναι δομικός, όχι χρονικός** — καμία μαγική σταθερά:
- **γεννιέται** μόνο όταν ένα πεδίο της συνεδρίας κρατά την εστίαση (αλλιώς δεν θα ακολουθούσε
  blur να την καταναλώσει, άρα θα έμενε ορφανή)·
- **λήγει** με την επόμενη είσοδο του χρήστη — `mousedown` **ή** `keydown`, σε φάση σύλληψης
  στο `document`. Το `mousedown` γιατί το κλικ **έξω** πρέπει να κλείνει ακόμα κι όταν γίνεται
  σε στοιχείο που δεν φτάνει ποτέ στον καμβά (κορδέλα)· το `keydown` γιατί αλλιώς ένα `Tab`
  έξω, μετά από κλικ σε κελί, θα ανακτούσε το πληκτρολόγιο και **δεν θα έβγαινες ποτέ**.

⚠️ Η πρώτη εκδοχή ήταν «διάβασε-και-σβήσε» και **ήταν λάθος**: την κατανάλωνε το `focusout` (Α)
και άφηνε το (Β) ορφανό ⇒ η συνεδρία επιβίωνε αλλά **έχανε το πληκτρολόγιο** — «ζωντανή αλλά
κουφή», διαλείπουσα σε **2 από 3** ζωντανά τρεξίματα. Μια σημαία που φαίνεται αυστηρότερη δεν
είναι σωστότερη.

❌ Τι **δεν** έγινε, και γιατί: `preventDefault` στο `mousedown` (το κλασικό μοτίβο των
react-select / Downshift / ProseMirror / φύλλων υπολογισμού σε καμβά) θα έσπαγε το σύρσιμο
λαβών και τη μετακίνηση οντότητας — ο καμβάς είναι ο ιδιοκτήτης του ποντικιού. `focus()` μέσα
στον χειριστή `blur` «παλεύει με τον χρήστη» και διαφέρει ανά μηχανή. `setTimeout` με μαγικό
αριθμό αντικαθιστά μια κούρσα με άλλη.

#### 26.15.3 Παράπλευρο εύρημα — **το κλικ έτρωγε την πληκτρολόγηση**

Το `use-table-cell-session-keys` γράφει ρητά: «η σειρά είναι το συμβόλαιο: **πρώτα** δεσμεύεται
το πρόχειρο, **μετά** μετακινείται ο δρομέας» (`case 'move': commit(); onMove(…)`). Το
πληκτρολόγιο το τηρούσε· **το ποντίκι όχι**. Ο ακροατής σύλληψης τρέχει **πριν** από κάθε
`blur`, άρα το `setTableCellCursor` είχε ήδη **σβήσει το πρόχειρο** όταν έφτανε το commit — και
ο επεξεργαστής είχε ξαναστηθεί σε `nav`, όπου το commit είναι εξ ορισμού σιωπηλό (σωστά: ένα
«γράψε το άδειο πρόχειρο» θα **έσβηνε** το κελί). Πληκτρολογείς, κλικάρεις δίπλα, η δουλειά σου
**εξαφανίζεται χωρίς μήνυμα**.

Διόρθωση: ο pointer δεσμεύει το εκκρεμές πρόχειρο **πριν** μετακινήσει — από την **ίδια**
διαδρομή (`commitText` ⇒ `buildTableCellEditCommand`), ιδεμποτής (ίδιο κείμενο ⇒ `null` εντολή).
Το `Shift+κλικ` **δεν** δεσμεύει, συμμετρικά με το `case 'extend'`.

#### 26.15.4 Απόδειξη

**Κόκκινο πρώτα.** `__tests__/table-cell-pointer-session-survival.test.tsx` — ο **πραγματικός**
pointer και ο **πραγματικός** φύλακας μαζί, πάνω σε πραγματική οντότητα και σε `<textarea
autoFocus>` με το `key` της παραγωγής. Πριν τη διόρθωση: **4 κόκκινα** (ίδιο κελί / άλλο κελί /
`Shift+κλικ` / ζώνη). Γιατί κανένα από τα 603 tests του βήματος 8 δεν το είχε δει: ο pointer
δοκιμαζόταν **μόνος του** (πράσινο), ο φύλακας **μόνος του** (πράσινο) — το σφάλμα ζούσε
αποκλειστικά **στη συνάντησή τους**.

⚠️ Το jsdom **δεν** υλοποιεί τη μεταφορά εστίασης του `mousedown` (είναι προεπιλεγμένη
ενέργεια), οπότε το test τη γράφει **ονομαστικά** (`blurActiveElement`) αντί να την κρύψει.
Και δεν βλέπει καθόλου την **Αιτία Α** (το κέλυφος): εκεί χρειάστηκε η οθόνη.

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `table-cell-pointer-session-survival` | 10 tests (6 επιβίωσης + 4 σειράς δέσμευσης) |
| `table-cell-session-focus` | οι **πέντε** δρόμοι + λήξη δήλωσης σε `mousedown`/`keydown` |
| Ευρύ δίχτυ | **1.656 / 1.656** πράσινα (116 σουίτες) |
| `jscpd:diff` (N.18) | καθαρό σε 11 αρχεία |

**Ζωντανά** (CDP, `sc-2615.js`) — **3 τρεξίματα × 6 βήματα, ταυτόσημα, μηδενική διακύμανση**:

| Χειρονομία | Πριν | Μετά |
|---|---|---|
| κλικ στο **ΙΔΙΟ** κελί | ☠️ | ✅ ζει, `activeElement` = πεδίο συνεδρίας |
| κλικ σε **ΑΛΛΟ** κελί | ☠️ | ✅ ζει, ο δρομέας μετακινήθηκε (`B3 → C3`) |
| **`Shift+κλικ`** | ☠️ | ✅ «**2 γραμμές × 1 στήλη**», ενεργό κελί **ακίνητο** στο `C3` |
| κλικ σε **ζώνη δείκτη** | ☠️ | ✅ ζει |
| κλικ στη **γραμμή τύπων** *(control)* | ✅ | ✅ |
| κλικ **ΕΞΩ** *(η μισή προδιαγραφή)* | ✅ κλείνει | ✅ **κλείνει** |

Σκηνή μετά: `5×3`, **12 κελιά**, 1 συγχώνευση `r0/c0` (`1×3`), `angleRad 0`, θέση επαναφερμένη
στο `{6748.408260175493, 1111.0563156435965}` — η μετακίνηση προήλθε από τη λαβή σε λειτουργία
AutoCAD (**κλικ πιάνει, κλικ αφήνει**: δεν χρειάζεται σύρσιμο, δύο κλικ αρκούν), στα τρεξίματα
πριν διορθωθούν τα όργανα.

#### 26.15.5 🔬 Τα ΟΡΓΑΝΑ έλεγαν ψέματα — τρεις μετρημένες αστοχίες

Καταγράφονται γιατί κόστισαν περισσότερο από τη διόρθωση, και θα ξανακοστίσουν:

1. **`page.mouse.click(x, y, { modifiers })` ΔΕΝ υπάρχει.** Τα `modifiers` είναι επιλογή του
   `locator.click()` και στο `mouse.click` **αγνοούνται σιωπηλά**: κάθε `Shift+κλικ` έφτανε ως
   **απλό** κλικ. Πρώτο συμπέρασμα: «το `Shift+κλικ` μετακινεί το ενεργό κελί» — σφάλμα του
   **οργάνου**, όχι της εφαρμογής. Διόρθωση: `keyboard.down('Shift')` ρητά (και στο `drive.js`).
2. **Τα δύο αρχεία των οργάνων είχαν αποκλίνει.** Το `lib.js` δηλώνει ότι οι μετατοπίσεις `OFF`
   ισχύουν για πλαισίωση **1:40**· το `sc-frame.js` σταματούσε στο **1:75**. Στο 1:75 τα κελιά
   είναι ~40% μικρότερα ⇒ κάθε κλικ έπεφτε **έξω από τον πίνακα**, ο δρομέας δεν άνοιγε καν και
   η μέτρηση έβγαινε «η συνεδρία είναι νεκρή». **Ψευδώς κόκκινο από αστοχία στόχου.**
3. **Οι σταθερές `OFF` εξαρτώνται και από το pan**, που η ροδέλα δεν αναπαράγει ντετερμινιστικά
   (μετρήθηκε απόκλιση **357px × 246px** στην ίδια κλίμακα). Η αντικατάσταση δεν είναι καλύτερη
   σταθερά: **ρωτάμε την ίδια την εφαρμογή** — το `<textarea>` είναι αγκυρωμένο ακριβώς πάνω στο
   κελί, άρα το `getBoundingClientRect()` του **είναι** το κουτί του κελιού. Περπάτημα του
   πλέγματος με βέλη ⇒ χάρτης κελιού→οθόνης, ανεξάρτητος από κλίμακα, pan και παράθυρο.
   Πλαισίωση με `Z` (εστίαση στην επιλογή), που **θέτει** αντί να συγκλίνει.

**Ο κανόνας:** όταν δύο τρεξίματα του ίδιου πειράματος διαφωνούν, το αποτέλεσμα δεν λέει τίποτα
— μόνο η **αλληλουχία των συμβάντων** λέει. Η διπλή `focusout` βρέθηκε έτσι, όχι με σκέψη.

### 26.14 Τι ρητά ΔΕΝ κάνει το βήμα 8
- **Δεν** υλοποιεί ασυνεχή επιλογή (§26.2) ούτε την **επανάληψη μοτίβου** του Excel
  (πηγή × Ν σε πολλαπλάσιο προορισμό) — δεν ζητήθηκε, και κανένα CAD δεν την έχει.
- **Δεν** μεγαλώνει τον πίνακα, ποτέ (§26.3).
- **Δεν** διαβάζει `text/html` από το πρόχειρο· μόνο `text/plain` (TSV).
- **Δεν** περιφέρει το `Enter` **μέσα** στην επιλογή (Excel). Γι' αυτό ακριβώς η γραφή
  **διαλύει** την περιοχή: κρατώντας μόνο το μαρκάρισμα χωρίς την περιφορά, το χρώμα θα
  έλεγε ψέματα — έξι φωτισμένα κελιά ενώ γράφεται **ένα**.
- **Δεν** αγγίζει τη λαβή συμπλήρωσης (Φ.Δ.9) ούτε τους τύπους (Φ.Δ.11).

## 27. Φάση Δ βήμα 9 — **ΕΙΣΑΓΩΓΗ / ΔΙΑΓΡΑΦΗ ΓΡΑΜΜΩΝ & ΣΤΗΛΩΝ ΑΠΟ ΤΙΣ ΖΩΝΕΣ ΔΕΙΚΤΗ** (2026-08-02)

Ζητούμενο (Giorgio): «δεξί κλικ πάνω στα γράμματα στηλών και στα νούμερα των γραμμών να
βγαίνει η **Εισαγωγή** και να προσθέτω γραμμές και στήλες».

### 27.1 Το κενό που έκλεισε — δύο ανεξάρτητα κενά, όχι ένα
1. **Οι ζώνες δείκτη ήταν διακοσμητικές.** Το βήμα 7 τις ζωγράφισε, αλλά **κανένα hit-test δεν
   τις έβλεπε**: το `tableCellAtFrame` ελέγχει `u, v ≥ 0`, ενώ οι ζώνες ζουν σε **αρνητικά** mm
   (πάνω/αριστερά του πλέγματος). Δεν ήταν παράλειψη — ένα κελί **είναι** μη αρνητικό.
2. **Ο πίνακας δεν είχε καμία εντολή αλλαγής πλέγματος.** `grep insertRow|deleteColumn` σε όλο
   το subapp: **μηδέν**. Το `table-range-clipboard.ts` το είχε δηλώσει ρητά — «ο πίνακας δεν
   μεγαλώνει μόνος του… η προσθήκη γραμμών ανήκει σε **ρητή** εντολή». Αυτή είναι εκείνη.

### 27.2 Ρητή κατεύθυνση, όχι σκέτο «Εισαγωγή» (απόφαση Giorgio)
Το Excel δείχνει **ένα** item και εισάγει πάντα *πριν* — κανόνας που ο χρήστης μαθαίνει με
δοκιμή και undo. AutoCAD και Google Sheets δείχνουν **και τις δύο** κατευθύνσεις. Επιλέχθηκε
το δεύτερο: ο πίνακας είναι **σχέδιο**, και μια εισαγωγή στη λάθος μεριά μετακινεί γεωμετρία
που ο μηχανικός μόλις τακτοποίησε.

| δεξί κλικ σε | items |
|---|---|
| γράμμα στήλης | Εισαγωγή στήλης αριστερά · δεξιά — Διαγραφή στήλης |
| αριθμό γραμμής | Εισαγωγή γραμμής πάνω · κάτω — Διαγραφή γραμμής |

Μαζί (απόφαση Giorgio): **αριστερό κλικ στη ζώνη = επιλογή ΟΛΗΣ της στήλης/γραμμής** (Excel).
Δεν χρειάστηκε νέος τύπος επιλογής — μια ολόκληρη στήλη είναι απλώς οι δύο γωνίες
(πρώτη γραμμή → τελευταία γραμμή) του ίδιου `TableCellRangeBounds` του βήματος 8.

### 27.3 🔴 Η ζώνη έγινε SSoT — αλλιώς πατάς κουτί που δεν βλέπεις
Η γεωμετρία της ζώνης (πάχος `px / pxPerMm`, τα rects των υποδιαιρέσεων, το κατώφλι LOD) ζούσε
**μέσα** στον ζωγράφο. Ένα δεύτερο αντίγραφο για το hit-test θα ήταν sibling clone (CHECK 3.28)
— αλλά το σοβαρό δεν είναι οι γραμμές, είναι **δύο μετρήσιμες αποκλίσεις**:
- **LOD**: ο ζωγράφος σταματά κάτω από `MIN_TABLE_SCREEN_PX`· hit-test χωρίς το κατώφλι θα
  άνοιγε μενού στήλης πάνω σε πίνακα-κουκκίδα, δηλαδή σε ζώνη **που δεν ζωγραφίστηκε**.
- **Πάχος**: αν ο ένας ρωτούσε px και ο άλλος mm, το κουτί που πατάς δεν είναι το κουτί που
  βλέπεις — και η διαφορά **μεγαλώνει με το zoom**.

Νέο module `bim/table/table-indicator-geometry.ts`: bands σε mm, `isTableIndicatorVisible`,
τα τρία rects (στήλη/γραμμή/γωνία), και `tableIndicatorHitAtFrame`. Ο ζωγράφος τα **καταναλώνει**
— η σουίτα του (6 tests) έμεινε πράσινη αυτούσια, που είναι και η απόδειξη ότι η εξαγωγή δεν
άλλαξε ζωγραφική. Η **γωνία** επιστρέφει ρητά `null`: το Excel βάζει εκεί «επιλογή όλων», εμείς
δεν έχουμε τέτοια εντολή, άρα δεν έχουμε τέτοιο κλικ.

### 27.4 Οι τέσσερις αποφάσεις των καθαρών πράξεων (`table-row-column-ops.ts`)
1. **Νέα ταυτότητα `r7`, όχι `r${θέση}`.** Οι ταυτότητες είναι τοπικές (`r0…rN`)· το προφανές
   `r${atIndex}` **συγκρούεται** σε εισαγωγή στη μέση, και ο αραιός χάρτης θα έδειχνε τα κελιά
   της παλιάς γραμμής στη νέα. Γεννήτορας: μέγιστο επίθεμα +1, με επαλήθευση σε `Set`.
   Ντετερμινιστικός ⇒ σταθερό JSON, δοκιμάσιμο, καμία `crypto`.
2. **Η εισαγωγή ΔΕΝ αγγίζει κανένα κελί.** Ούτε ένα — ακριβώς γι' αυτό το μοντέλο διάλεξε id
   αντί για index (§4: «το AutoCAD τα κρατά με index — γι' αυτό εκεί οι τύποι σπάνε»).
3. **Συγχωνεύσεις: ο κανόνας του Excel με ΜΙΑ ρητή εξαίρεση.** Εισαγωγή *αυστηρά μέσα* σε εύρος
   το μεγαλώνει· δίπλα του όχι. Εξαίρεση: συγχώνευση που καλύπτει **ολόκληρο** τον άξονα (η
   γραμμή τίτλου) **μένει** ολόκληρου άξονα. Το μοντέλο μας εκφράζει τον τίτλο ως merge ενώ το
   AutoCAD τον έχει ως **ιδιότητα κλάσης γραμμής** — χωρίς την εξαίρεση, η πιο συνηθισμένη πράξη
   όλων («εισαγωγή στήλης δεξιά») θα άφηνε τον τίτλο να σταματά μια στήλη πριν το τέλος. Δεν
   είναι χαλάρωση κανόνα· είναι η μετάφραση μιας έννοιας που το σχήμα μας δεν έχει.
4. **Η διαγραφή άγκυρας ΜΕΤΑΦΕΡΕΙ το περιεχόμενο.** Ο χρήστης βλέπει **ένα** κελί «ΠΙΝΑΚΑΣ»
   απλωμένο σε τρεις στήλες· ότι το κείμενο ζει τεχνικά στην πρώτη είναι εσωτερικό. Διαγραφή της
   πρώτης ⇒ η συγχώνευση ξανα-αγκυρώνεται **μαζί με το περιεχόμενό της**. Η εναλλακτική είναι
   σιωπηλή απώλεια κειμένου που ο χρήστης δεν είχε τρόπο να προβλέψει.

**Νέα γραμμή = πάντα `rowClass: 'data'`**: `title`/`header` είναι δομικά μοναδικές στο μοντέλο
`ACAD_TABLE` και το στυλ τις ζωγραφίζει ως τέτοιες· δεύτερη γραμμή τίτλου θα εμφανιζόταν ως
τίτλος και ο χρήστης **δεν έχει σήμερα τρόπο** να την ξαναχαρακτηρίσει. **Νέα στήλη**
κληρονομεί `sizing`/`valueType`/`align`/`overflow` από τη στήλη αναφοράς (το πλάτος δεν «πηδά»),
**ποτέ `sourceKey`** — δύο στήλες στην ίδια πηγή είναι σφάλμα δεσμού, όχι διευκόλυνση.

### 27.5 Ένα undo, καμία δεύτερη διαδρομή — και η εξαγωγή που το εξασφάλισε
Κάθε ενέργεια είναι **καθαρή πράξη → `buildTableModelCommand`**: ένα `UpdateEntityCommand`, ένα
`Ctrl+Z`, η **ίδια** διαδρομή με τη μονή επεξεργασία και την επικόλληση (§26.6). Ο δεσμευτής
(`commitModel`) ζούσε ιδιωτικά μέσα στο `use-table-range-actions` όσο ο καταναλωτής ήταν ένας·
με τους δύο εξήχθη σε `use-table-model-commit.ts`. Η οντότητα έγινε **όρισμα κλήσης** αντί για
εξάρτηση hook — γιατί αυτό ακριβώς πρέπει να διαβάζεται τη στιγμή της ενέργειας (το σφάλμα που
τεκμηριώνει το `liveEntity` του §22).

### 27.6 🔴 Ένας δρομολογητής δεξιού κλικ — γιατί ΔΕΝ μπήκε δεύτερος ακροατής
Ο `useCanvasContextMenu` είναι ήδη ακροατής **φάσης σύλληψης** στο ίδιο container και γράφεται
**πρώτος**. Δεύτερος ακροατής θα έτρεχε μετά — αφού το μενού **οντότητας** θα είχε ήδη ανοίξει,
γιατί σε λειτουργία πίνακα ο πίνακας **είναι** η επιλεγμένη οντότητα. Η σειρά εγγραφής ακροατών
δεν είναι συμβόλαιο· ο δρομολογητής είναι. Προστέθηκε **PRIORITY 1.4**, πριν από dimension/entity.

Η σύνδεση γίνεται με **θύρα module** (`table-header-menu-port.ts`), όχι με props: ο
δρομολογητής καλείται στη γραμμή 283 του `CanvasSection` ενώ ο κάτοχος της απάντησης στη 423 —
ένα prop θα απαιτούσε **αναδιάταξη hooks** στον πιο ευαίσθητο orchestrator της εφαρμογής
(ADR-040) ή ανάθεση σε ref μέσα στο render. Η θύρα δηλώνει ρητά ό,τι ήδη ισχύει: **ένας ανοιχτός
πίνακας τη φορά**, όπως **ένας** δρομέας κελιού. Ίδιο μοτίβο με την παραχώρηση στο μενού όψεων
του 3D (`usePolygonMode3DStore`, ADR-539 Φ3f): **ανάγνωση module τη στιγμή του συμβάντος**.

Ο `CanvasSection` δέχεται **μία** γραμμή (mount) και **καμία** νέα συνδρομή — CHECK 6C ανέπαφο.

### 27.7 🔴 Το μενού είναι ΜΕΛΟΣ της συνεδρίας — αλλιώς σβήνει αυτό που μόλις πάτησες
Το Radix εστιάζει το περιεχόμενό του μόλις ανοίξει. Ο φύλακας `useTableCellSessionBlur` κλείνει
τον δρομέα όταν η εστίαση φύγει σε μη-μέλος ⇒ **οι ζώνες θα εξαφανίζονταν τη στιγμή ακριβώς που
τις πατάς**, και το `Esc` θα σε πέταγε έξω από τον πίνακα.

Η λύση **δεν είναι νέος κανόνας**: το `TABLE_CELL_SESSION_MARKER` απλώνεται στο περιεχόμενο και
στον κρυφό trigger — «απλώνεται σε **κάθε** εστιάσιμο στοιχείο της συνεδρίας», όπως λέει ο ίδιος
ο ορισμός του από το βήμα 7. Στο κλείσιμο, νέα ενέργεια store `restartTableCellCursorSession()`
(καθρέφτης του `cancelTableCellCursorSession`, χωρίς να αγγίζει `mode`/`draft`) αυξάνει τον
`sessionId` ⇒ το `<textarea autoFocus>` ξαναστήνεται ⇒ **η εστίαση επιστρέφει στο κελί**. Χωρίς
αυτό η συνεδρία θα έμενε ζωντανή αλλά **κουφή**: ο δομικός φύλακας `isTextEntryTarget` βλέπει
εστιασμένο πεδίο κειμένου, όχι κατάσταση store.

Μετά από κάθε πράξη ο δρομέας τοποθετείται ρητά σε **επιζών** κελί (δείκτης κομμένος στα νέα
όρια) — αλλιώς μια διαγραφή θα τον άφηνε πάνω σε σβησμένη γραμμή.

🔴 **Και ο δρόμος του κλεισίματος πρέπει να είναι ΕΝΑΣ.** Η πρώτη εκδοχή έκλεινε το μενού
**μέσα** στο item (`setIsOpen(false)` μετά την ενέργεια) — δηλαδή παρέκαμπτε το
`onOpenChange` και μαζί του το `onClosed`. Αποτέλεσμα: `Esc` και κλικ έξω επέστρεφαν την
εστίαση στο κελί, **κλικ σε item όχι** — ακριβώς η διαδρομή που ο χρήστης κάνει κάθε φορά.
Το item πλέον **μόνο εκτελεί**· το κλείσιμο το ζητά το ίδιο το Radix (`onSelect` ⇒
`onOpenChange(false)`), άρα και οι τρεις έξοδοι περνούν από το ίδιο σημείο. Κλειδωμένο με
anchor στο `table-header-menu.test.tsx` — ο έλεγχος πατά **πραγματικό item** και απαιτεί
**και** την ενέργεια **και** ένα `onClosed`.

### 27.8 Απόδειξη
| σουίτα | τι κλειδώνει |
|---|---|
| `table-row-column-ops.test.ts` (21) | μοναδικότητα id· τίτλος full-width σε εισαγωγή δεξιά· εύρη ±1· re-anchor **με το περιεχόμενο**· κελιά σβησμένης γραμμής φεύγουν· όρια· **ταυτότητα by-reference** στο no-op |
| `table-indicator-geometry.test.ts` (10) | 🔴 **το κέντρο του ζωγραφισμένου rect πέφτει στην ίδια υποδιαίρεση** (ο έλεγχος που κάνει το module SSoT)· γωνία ⇒ `null`· LOD ⇒ `null` |
| `table-header-menu.test.tsx` (16) | θύρα δηλώνεται/αποσύρεται· **screen → world → frame → ζώνη** βρίσκει τη σωστή στήλη/γραμμή· **μία εντολή** ανά ενέργεια με **πραγματική** `ICommand`· δρομέας σε κελί που υπάρχει· αριστερό κλικ ⇒ όλη η στήλη/γραμμή· 🔴 το **ανοιχτό** μενού φέρει το σημάδι συνεδρίας· 🔴 **ο ΕΝΑΣ δρόμος κλεισίματος** (§27.7) |
| `stamp-table-indicator.test.ts` (6, υπάρχον) | *έμεινε πράσινο* — η εξαγωγή δεν άλλαξε ζωγραφική |

**704 tests πράσινα** στο δίχτυ πίνακα + καμβά. **jscpd καθαρό** σε 14 αρχεία (N.18).

### 27.9 Τι ρητά ΔΕΝ κάνει το βήμα 9
- **Δεν** εισάγει Ν γραμμές κατά το πλήθος της επιλογής (Excel: μαρκάρεις 3 στήλες → μπαίνουν 3).
  Η πράξη αφορά **την πατημένη** στήλη/γραμμή.
- **Δεν** δίνει σύρσιμο πλάτους στήλης / ύψους γραμμής από τη ζώνη, ούτε απόκρυψη στήλης, ούτε
  «Μορφοποίηση κελιών».
- **Δεν** επιτρέπει διαγραφή της **τελευταίας** γραμμής/στήλης (πίνακας χωρίς πλάτος ή ύψος =
  αόρατη οντότητα) — το item είναι ανενεργό, όχι σιωπηλά αδρανές.
- ✅ **ΕΠΑΛΗΘΕΥΜΕΝΟ ΖΩΝΤΑΝΑ (2026-08-02)** — δες §27.10. Απομένει **μόνο** το (α): το μενού πάνω
  σε **στραμμένο** πίνακα (`angleRad ≠ 0`) δεν περπατήθηκε· η σκηνή δεν είχε τέτοιον και δεν
  δημιουργήθηκε δοκιμαστικός.
  🔴 **Το στατικό μισό του (α) έκλεισε — §27.12**: 21 tests σε 4 γωνίες, μετάλλαξη 4/4, και η
  διαπίστωση ότι τα 29 προϋπάρχοντα ήταν **τυφλά** στη γωνία. **Η ζωντανή διαδρομή στον browser
  παραμένει ανοιχτή** και δεν αντικαθίσταται από αυτό.

### 27.10 🔴 Η ζωντανή επαλήθευση — και το σφάλμα που μόνο αυτή μπορούσε να βρει (2026-08-02)

Πέντε από τα έξι σημεία πέρασαν με **δεδομένα ή screenshot**, ποτέ «φαίνεται σωστό»: το μενού
ανοίγει με σωστή ταυτότητα (**«Στήλη B»**, **«Γραμμή 3»**)· η εισαγωγή δίνει `columns 3→4` με
`merges[0].colSpan 3→4`, δηλαδή **ο τίτλος καλύπτει όλο το πλάτος** (και οπτικά: καμία κάθετη
γραμμή δεν τον κόβει)· **ένα** `Ctrl+Z` επαναφέρει `colIds` **και** `colSpan` ακέραια· η
εισαγωγή γραμμής επιβιώνει σε **reload** (`r0,r1,r2,r5,r3,r4`, το «ΖΦ» μετακινημένο B4→B5)· σε
**μονόστηλο** πίνακα το «Διαγραφή στήλης» είναι όντως **ανενεργό**.

**Το σημείο (γ) όμως αποκάλυψε πραγματικό σφάλμα** — και ήταν το ίδιο σφάλμα με το (β), όχι δύο.

#### Το σύμπτωμα που ανέφερε ο Giorgio
«Δεξί κλικ στα γράμματα/αριθμούς δεν ανοίγει μενού.» Αναπαράχθηκε: **3/3 επαναλήψεις, και στους
δύο άξονες**, το πρώτο `Escape` δεν έκλεινε το μενού· χρειάζονταν **δύο**, και το δεύτερο
σκότωνε **και** τη λειτουργία πίνακα.

#### Η ρίζα, μετρημένη με στοίβα κλήσεων
Ο escape-bus (ADR-364) είναι ο **πρώτος** window-capture listener και σφραγίζει ό,τι
καταναλωθεί με `stopImmediatePropagation()`. Το `DismissableLayer` του Radix ακούει σε
**document** capture, δηλαδή **μετά**. Το μενού **δεν είχε slot στον bus**, οπότε το πρώτο ESC
το άρπαζε το `canvas/fallback-deselect` (P400) — του οποίου το `canHandle` είναι «υπάρχει
επιλεγμένη οντότητα;», και σε λειτουργία πίνακα ο πίνακας **είναι** η επιλεγμένη οντότητα.
Δεν έχει `allowWhenEditable`, άρα η ασπίδα «editable focus» θα το έκοβε αν η εστίαση ήταν στο
`<textarea>` του κελιού — **αλλά με ανοιχτό μενού η εστίαση είναι στο `<div role="menu">` του
Radix, που δεν είναι πεδίο κειμένου.** Περνούσε, και έκανε τρία κακά με ένα πάτημα:

1. το μενού **δεν έκλεινε** (το Radix δεν είδε ποτέ το ESC)·
2. ο πίνακας **αποεπιλεγόταν** (`clearEntitySelection`)·
3. άρα ο `TableRenderer` (`selected ? cursorOf(...) : null`) σταματούσε να βγάζει δρομέα **και
   ζώνες** ⇒ **τα γράμματα και οι αριθμοί εξαφανίζονταν** ενώ η γραμμή τύπων και η γραμμή
   κατάστασης έδειχναν ζωντανή συνεδρία.

Δηλαδή μια **κατάσταση-φάντασμα**: «είμαι σε λειτουργία πίνακα» χωρίς τίποτα να πατήσεις — και
ακριβώς αυτό βλέπει ο χρήστης ως «το δεξί κλικ δεν κάνει τίποτα».

⚠️ Το σχόλιο του `TableRenderer.cursorOf` έλεγε «ο δρομέας υπάρχει ούτως ή άλλως μόνο όσο ο
πίνακας είναι επιλεγμένος, άρα η συνθήκη δεν κρύβει τίποτα». **Η υπόθεση ήταν ψευδής**: η
συνεδρία επιβιώνει της αποεπιλογής. Δεν αλλάχθηκε ο ζωγράφος — αλλά η πρόταση δεν ισχύει πια
ως εγγύηση, μόνο ως περιγραφή της συνήθους περίπτωσης.

#### Η διόρθωση — μία εγγραφή, όχι νέος μηχανισμός
Το `TableHeaderContextMenu` εγγράφεται πλέον στον bus σε **`ESC_PRIORITY.POPOVER_DROPDOWN`** —
το ίδιο σκαλί με κάθε άλλο dropdown του θεατή (**14 καταναλωτές**: ribbon split, layer-state,
quick properties…) και **πάνω** από το P400 του fallback. Δεν χρειάζεται ψηλότερα: το μόνο που
έπρεπε να νικηθεί είναι η αποεπιλογή.

- `canHandle: () => isOpen` — **όχι** `true`. Ο κρυφός trigger είναι πάντα mountαρισμένος· ένα
  `true` θα ήταν η παλινδρόμηση §10.12 του ADR-364 σε νέα συσκευασία (αόρατο μενού που καταπίνει
  το «ακύρωση/αποεπιλογή», το συχνότερο πλήκτρο του καμβά).
- `handle` περνά από το **`handleOpenChange(false)`** — τον **ΕΝΑ** δρόμο κλεισίματος του §27.7.
  Σκέτο `setIsOpen(false)` θα ήταν δεύτερος δρόμος, και η έξοδος με `Escape` δεν θα επέστρεφε
  την εστίαση στο κελί ενώ η έξοδος με κλικ σε item θα την επέστρεφε.

**Το ίδιο το dev audit το φώναζε ήδη**: `SHADOW-OWNER — … ανήκει σε slot του ESC_PRIORITY`.
Κανείς δεν διάβαζε την κονσόλα. Μετά τη διόρθωση το μήνυμα **εξαφανίστηκε**.

#### Απόδειξη μετά τη διόρθωση (`window.__escapeAudit`, ζωντανά)
| | πριν | μετά |
|---|---|---|
| 1ο `Escape` | `consumedBy: canvas/fallback-deselect` · μενού **μένει** ανοιχτό | **`table/header-menu`** · μενού **κλείνει** |
| 2ο `Escape` | verdict `shadow-owner` (το Radix, εκτός SSoT) | `table-cell-editor/table-cell-cursor`, `focusAt: textarea` — **η εστίαση γύρισε στο κελί** |

3 νέα tests, **mutation-verified 3/3** (`canHandle:false` ⇒ 2 κόκκινα· `canHandle:true` ⇒ 2
κόκκινα· προτεραιότητα **κάτω** από το fallback ⇒ κόκκινο *ακριβώς* το test που αναπαράγει το
σφάλμα). Σουίτα βήματος 9: **723 πράσινα**.

#### 🔬 Το όργανο — γιατί χρειάστηκε νέο
Το `s/ox/oy` του URL γράφεται **debounced** (ADR-400) και ήταν μπαγιάτικο κατά τάξεις μεγέθους
(ο πίνακας υπολογιζόταν στο `x=3968` ενώ η οθόνη τελειώνει στο 1916)· ο μετασχηματισμός ζει σε
module store (ADR-040), απρόσιτος από το DOM. Λύση: **ρωτάμε την ίδια την εφαρμογή** — η ένδειξη
«Συντεταγμένες: X … Y … m» γράφεται από το `ImmediatePositionStore`, άρα **δύο κινήσεις δείκτη
σε γνωστά pixel ⇒ κλίμακα και μετατόπιση λυμένες**, ανεξάρτητα από URL και stores. Η πλαισίωση
έγινε με τη διαδρομή του χρήστη: **pan με μεσαίο πλήκτρο** (μετρημένο: μεσαίο **και** δεξί
κάνουν pan) + ροδέλα. ⚠️ Η ροδέλα **δεν αρκεί**: στο ταβάνι zoom-out (`s=0,0001`) ο στόχος
έμενε 120 px κάτω από την ακμή. Εργαλεία: `C:\Users\user\.claude\dxf-live-verify\v9-*.js`.

### 27.12 🔴 Ο στραμμένος πίνακας — το **στατικό** μισό του τελευταίου εκκρεμούς (2026-08-02)

Το §27.9 άφησε **ένα** ανοιχτό: το δεξί κλικ στις ζώνες πάνω σε πίνακα με `angleRad ≠ 0`. Πριν
ανοίξει browser, μετρήθηκε **τι μπορούσε** να το σπάσει — και βρέθηκε ότι το μεγαλύτερο μέρος
του ήταν ήδη κλειστό, ενώ **ένα** κομμάτι ήταν δομικά ανέλεγκτο.

#### Τι ήταν ήδη κλειστό — και δεν χρειάζεται ζωντανή απόδειξη για να το ξέρουμε
- **Οι γερμένες ζώνες** (σημείο 8β): κλειδωμένες σε jest από το βήμα 8 —
  `table-rotated-text.test.ts` § «οι ετικέτες των ζωνών ακολουθούν ΤΟΝ ΙΔΙΟ κανόνα». Η γωνία
  **παράγεται** από το ίδιο το `toScreen` (`frameScreenAngleRad`), δεν δίνεται ως παράμετρος,
  άρα ο ζωγράφος **δεν μπορεί** να αποκλίνει από την προβολή.
- **Η θέση του μενού** (σημείο 8γ): **ανεξάρτητη γωνίας εξ κατασκευής**. Ο δρομολογητής καλεί
  `open(e.clientX, e.clientY, hit)` και ο κρυφός trigger τοποθετείται σε `left/top` px. Καμία
  ανάγνωση `angleRad` σε ολόκληρη τη διαδρομή — δεν *υπάρχει* μηχανισμός να στραβώσει.

#### Τι ήταν ανέλεγκτο, και γιατί δεν φαινόταν
Το `tableWorldToFrame` είναι το αυστηρό αντίστροφο του `tableFrameToWorld`: ο πίνακας
`[[cos, sin], [sin, −cos]]` είναι **συμμετρικός ορθογώνιος με `det = −1`** (ανάκλαση — έχει
διπλωμένη μέσα του και την αναστροφή του y), άρα είναι **ο ίδιος του ο αντίστροφος**. Γι' αυτό
οι δύο συναρτήσεις μοιάζουν ίδιες· δεν είναι σύμπτωση.

Η υλοποίηση όμως δεν ελεγχόταν **ποτέ** με γωνία: **και τα 13** table tests της Φ.Δ χτίζουν
`buildTableEntity(...)`, που γεννά `angleRad: 0`. Με `cos = 1, sin = 0` **κάθε όρος με `sin`
εξαφανίζεται** — δηλαδή λάθος πρόσημο, ξεχασμένη γωνία, ή στροφή γύρω από την **αρχή του
κόσμου** αντί για την άγκυρα, όλα περνούσαν πράσινα και σφάλλουν **γραμμικά με τη γωνία**.

#### Η αιτία ήταν διπλότυπο (N.18)
Η προβολή «σημείο πίνακα → pixel» ήταν γραμμένη **τρεις** φορές με τρία ονόματα
(`bandScreenPoint`, `columnBandScreenPoint`, `cellScreenPoint` + ένα inline αντίγραφο). Τρία
αντίγραφα = τρεις ευκαιρίες να ξεχάσει κάποιος τη στροφή — και ακριβώς αυτό είχε συμβεί.
Ενοποιήθηκαν στο `ui/table-cell-editor/__tests__/table-screen-point.ts`: **ένα** πρωτόγονο
(`tableFrameScreenPoint`) και δύο ερωτήσεις από πάνω του. Το ορθογώνιο της ζώνης **δεν**
ξαναϋπολογίζεται — ζητείται από το `tableColumnTickRectMm` / `tableRowTickRectMm`, το ΙΔΙΟ SSoT
που ρωτούν ο ζωγράφος και το κλικ (δες §27.11: μια χειρόγραφη έκφραση του κέντρου έσπασε την
ίδια μέρα που η ζώνη απέκτησε κενό).

#### Τι κλειδώθηκε — και η απόδειξη ότι κλειδώνει κάτι
**21 νέα tests** στο `table-header-menu.test.tsx`: κάθε στήλη και κάθε γραμμή, σε **τέσσερις**
γωνίες (`0,35` · `π/2` · `−1,2` · `2,6` rad — μικρή, ορθή, αρνητική, και πάνω από 90°), με
**άγκυρα εκτός αρχής των αξόνων** ώστε να ξεχωρίζει «στροφή γύρω από τον πίνακα» από «στροφή
γύρω από το (0,0)». Συν η νεκρή γωνία και το κλικ μέσα στο πλέγμα, σε κάθε γωνία.

Ένα test υπάρχει **μόνο** για να αποδεικνύει ότι το μπλοκ διακρίνει τη στροφή: το σημείο
υπολογίζεται πάνω στο **άστροφο** δίδυμο και δίνεται στον **στραμμένο** πίνακα — αν το hit-test
αγνοούσε τη γωνία θα απαντούσε σωστά, και όλα τα υπόλοιπα θα ήταν ταυτολογίες.

**Επαλήθευση με μετάλλαξη — 4/4, στο `tableWorldToFrame`:**

| μετάλλαξη | κόκκινα (από 40) | προϋπάρχοντα tests |
|---|---|---|
| `u = a·cos **−** b·sin` (πρόσημο) | 11 | **όλα πράσινα** |
| `v = a·sin **+** b·cos` (πρόσημο) | 14 | **όλα πράσινα** |
| `cos = 1, sin = 0` (αγνοεί τη γωνία) | 16 | **όλα πράσινα** |
| `a = world.x / m` (στροφή γύρω από το (0,0)) | 14 | **όλα πράσινα** |

Η **δεξιά** στήλη είναι το εύρημα: σε κάθε μία από τις τέσσερις μεταλλάξεις τα 29 προϋπάρχοντα
tests έμεναν **πράσινα**. Δεν ήταν αδύναμα — ήταν **δομικά τυφλά**, ακριβώς όπως προβλέπει το
`cos 0 = 1`. Δίχτυ βήματος 9: **790 πράσινα** (από 762). `jscpd --diff`: καθαρό.

#### 🔴 Τι ΔΕΝ αποδεικνύει αυτό — ρητά
Το jest τρέχει με **συνθετικό** viewport (1200×800, `scale = 1`, `offset = 0`) και μηδενική
βαθμονόμηση. Άρα **δεν** αντικαθιστά τη ζωντανή επαλήθευση των 8α/8β/8γ: ό,τι αφορά πραγματικό
`getBoundingClientRect`, DPR, χάρακες και τη διαδρομή του ίδιου του χρήστη (λαβή περιστροφής →
δεξί κλικ) μένει **ανοιχτό** και περπατιέται στον browser.

#### Δύο μετρήσεις που διορθώνουν το handoff — και μία λανθάνουσα
- **Ο δρόμος περιστροφής**: ο πίνακας έχει **δική του λαβή** (`gripIndex 1`, μέσο της πάνω
  ακμής, `TABLE_ROTATION_KIND`) που γράφει `angleRad` μέσω `UpdateEntityCommand`. Ένα σύρσιμο,
  όχι διάλογος κορδέλας. (Η κορδέλα δουλεύει επίσης: `ROTATE_HANDLERS.table` στο
  `utils/rotation-math.ts`.)
- **Το `mmToWorld ≈ 1`** δεν είναι μέτρηση αλλά **αλλαγή μεταβλητής**: οι προεπιλογές είναι
  `40` sheet-mm ανά στήλη και `8` ανά γραμμή, και `tableMmToWorld = drawingScale` — άρα τα
  «4000 / 800» είναι **world**-mm σε `1:100`. Το ζεύγος `(u = 4000, m = 1)` είναι αριθμητικά
  ταυτόσημο με `(u = 40, m = 100)`. Για ζωντανό script: δούλεψε **μόνο σε μονάδες κόσμου** —
  το πάχος ζώνης εκεί είναι `18 / pxPerWorld`, δηλαδή το `drawingScale` **απλοποιείται και
  φεύγει**, και το ερώτημα παύει να υπάρχει.
- ⚠️ **Λανθάνον, καταγεγραμμένο**: ο `TableRenderer` υπολογίζει με `this._sceneUnits`, ενώ τα
  δύο hit-test μονοπάτια (`use-table-header-menu`, `use-table-cell-pointer`) καλούν
  `computeTableEntityGeometryLive(live)` με την **προεπιλογή `'mm'`**. Αδρανές σήμερα (ADR-462:
  κάθε σκηνή δηλώνει canonical mm), αλλά είναι δύο απαντήσεις στην ίδια ερώτηση. Η θεραπεία
  θέλει ζωντανό getter μονάδων — **δεν** έγινε εδώ, δεν έχει σχέση με τη γωνία.

### §27.11 — ΟΙ ΖΩΝΕΣ ΔΕΝ ΑΚΟΥΜΠΟΥΝ ΤΙΣ ΛΑΒΕΣ (2026-08-02)

**Αφορμή**: ο Giorgio, από στιγμιότυπο, «οι λαβές είναι **πριν** από τα γράμματα στηλών και
τους αριθμούς γραμμών — μήπως θα ήταν καλύτερα να τα **αγκαλιάζουν**;»

#### Η απάντηση στην ερώτηση: όχι, και είναι δομικό
Οι λαβές ορίζουν τα **πραγματικά** όρια της οντότητας — αυτό που εξάγεται σε DXF/PDF, αυτό που
μετακινείται, αυτό που πιάνει το snap. Οι ζώνες δείκτη είναι **σκαλωσιά επεξεργασίας** και
υπάρχουν μόνο όσο ζει ο δρομέας. Ένα πλαίσιο λαβών που τις περιλάμβανε θα:

1. **έλεγε ψέματα** για το τι επιλέχθηκε (πλαίσιο ≠ περιεχόμενο εξαγωγής),
2. **άλλαζε μέγεθος** μπαίνοντας/βγαίνοντας από τη λειτουργία πίνακα — ίδιο αντικείμενο, δύο
   μεγέθη,
3. **έδινε λάθος κλίμακα**: οι ζώνες είναι σταθερές σε px οθόνης, άρα η αναλογία του πλαισίου
   θα άλλαζε με το zoom,
4. **έσβηνε τη σημασία** της κάθε λαβής (η μεσαία λαβή ακμής σημαίνει «πλάτος στήλης»· πάνω σε
   ζώνη δεν σημαίνει τίποτα).

Κανένας από τους μεγάλους δεν το κάνει: AutoCAD (λαβές στη γεωμετρία του πίνακα), Excel/Sheets
(οι επικεφαλίδες δεν είναι ποτέ μέρος του επιλεγμένου αντικειμένου), Figma (πλαίσιο = τα
πραγματικά bounds· χάρακες/οδηγοί απ' έξω), Revit (λαβές στα άκρα του υπομνήματος).

#### Το πραγματικό ελάττωμα — και ΔΕΝ ήταν z-order
Το βάσιμο μισό του παραπόνου ήταν ότι η ζώνη **ακουμπούσε** τις λαβές. Μετρήθηκε:

| ερώτηση | μέτρηση |
|---|---|
| Πού κάθονται οι λαβές πίνακα; | **`v = 0`** — και οι τρεις ομάδες (`table-entity-grips`: MOVE στην άγκυρα, ROTATION στο μέσο της πάνω ακμής, μία ανά **εσωτερικό όριο στήλης**) |
| Πού τελείωνε η πάνω ζώνη; | **`v = 0`** — κολλητά, εξ ορισμού (`y: -columnBandMm, h: columnBandMm`) |
| Ζωγραφική σειρά | λαβές **βήμα 6**, γεωμετρία **βήμα 4** του `renderWithPhases` ⇒ οι λαβές ήταν **ήδη** από πάνω |

Άρα το z-order **ήταν ήδη σωστό** και δεν χρειάστηκε καμία αλλαγή — η αρχική πρόταση
«μετατόπιση **+ z-order**» ήταν κατά το ήμισυ λάθος και διορθώνεται εδώ ρητά. Το ελάττωμα ήταν
ότι **το ίδιο pixel απαντούσε σε δύο ερωτήσεις**: «ποια στήλη επιλέγεται;» και «ποια λαβή
πιάνεται;». Και οι δύο απαντούσαν «ναι», επειδή ο ακροατής του ποντικιού είναι **παθητικός**
(δεν καταναλώνει το συμβάν, §Φ.Δ βήμα 8) — δηλαδή ο χρήστης στόχευε τη λαβή πλάτους στήλης και
έπαιρνε **και** τα δύο.

#### Η λύση: το κενό ΕΙΝΑΙ η οπή της λαβής — όχι «2-3 px που φαίνονται καλά»
`TABLE_INDICATOR_GRIP_CLEARANCE_PX = TOLERANCE_CONFIG.GRIP_APERTURE`. Η ζώνη αρχίζει **εκεί
ακριβώς** που η λαβή σταματά να πιάνεται, και το εσωτερικό όριο του hit-test είναι **γνήσια**
ανισότητα (`v < -gapMm`) επειδή η οπή της λαβής είναι **κλειστός** δίσκος — με `≤` και στα δύο,
το pixel της ακμής θα ξαναγεννούσε το σφάλμα σε πλάτος 1 px. Το `gapMm` μπήκε στο
`TableIndicatorBandsMm`, οπότε **και οι τρεις** καταναλωτές (ζωγράφος, αριστερό κλικ, δεξί
κλικ) το πήραν χωρίς να αλλάξει γραμμή σε κανέναν τους: το κέρδος του βήματος 9, εισπραγμένο.

⚠️ **Ειλικρινές όριο, μετρημένο**: ο ζωντανός δρόμος (`useUnifiedGripInteraction`) ανοίγει την
οπή σε `max(gripSize × dpiScale + 2, GRIP_CONFIG.HIT_TOLERANCE)` = **9 px** με τις προεπιλογές,
δηλαδή **1 px** πάνω από το δηλωμένο δάπεδο των `8`. Το 1 px το κρατά η **λαβή** — και έτσι το
θέλουμε: σε αμφισβήτηση νικά η λαβή, γιατί η επιλογή στήλης έχει **δεύτερο** δρόμο (το γράμμα,
18 px πιο πάνω) ενώ η λαβή δεν έχει κανέναν. Αν κάποιος ανεβάσει το `gripSize` στις ρυθμίσεις,
η επικάλυψη επιστρέφει αναλογικά· η θεραπεία είναι να γίνει η **οπή** συνάρτηση SSoT που θα
καταναλώνουν και οι δύο — **δεν** έγινε εδώ.

#### Παράπλευρο: το τέταρτο αντίγραφο, την ίδια μέρα
Ο βοηθός `__tests__/table-screen-point.ts` — που γεννήθηκε στο §27.9 **για να σκοτώσει** τρία
αντίγραφα της ίδιας αριθμητικής — υπολόγιζε το κέντρο ζώνης χειρόγραφα (`-columnBandMm / 2`).
Με το κενό, το «μέσο της ζώνης» έδειχνε **μέσα στο κενό**: **18 tests κόκκινα σε δύο αρχεία που
δεν είχαν αλλάξει**. Διορθώθηκε να ζητά το **ζωγραφισμένο κουτί** (`tableColumnTickRectMm` /
`tableRowTickRectMm` / `tableIndicatorCornerRectMm`). Το μάθημα δεν είναι «πρόσεχε τα tests»:
είναι ότι ένα αντίγραφο **επιβιώνει** ακόμα και μέσα σε αρχείο γραμμένο ρητά ως SSoT, και
πληρώνεται στην **πρώτη** αλλαγή του πρωτοτύπου.

#### Αποδείξεις
- **Μετάλλαξη 4/4** (`CLEARANCE = 0`): κοκκινίζουν και τα 4 νέα στοχευμένα tests, τα
  προϋπάρχοντα μένουν πράσινα ⇒ δεν είναι κενά.
- **Cross-module anchor**: `getTableGrips` → `tableWorldToFrame` ⇒ **κάθε** λαβή έχει `v ≈ 0`.
  Αν κάποιος μετακινήσει τις λαβές (ή προσθέσει λαβές ύψους γραμμής στην αριστερή ακμή), το
  κενό παύει να έχει νόημα και το test το λέει — δεν αρκεί να «μεγαλώσει».
- Δίχτυ πίνακα **1.684/1.684** · `jscpd --diff` καθαρό · μεγαλύτερο αρχείο 222 γραμμές.

#### 🔴 ΑΝΕΠΑΛΗΘΕΥΤΟ ΖΩΝΤΑΝΑ
Το κενό είναι **οπτική** αλλαγή σε πραγματικό DPR. Το jsdom δεν βλέπει επικάλυψη (μάθημα του
§26.15) και το jest τρέχει με συνθετικό viewport. Ο πρώτος έλεγχος γίνεται στην οθόνη.

### §27.13 — ΕΝΑ ΠΑΧΟΣ ΓΙΑ ΤΙΣ ΔΥΟ ΖΩΝΕΣ · ΚΑΙ Η ΓΡΑΜΜΗ ΤΥΠΩΝ ΠΟΥ ΤΙΣ ΣΚΕΠΑΣΕ (2026-08-02)

Δύο εντολές του Giorgio από στιγμιότυπο, με **κοινή** ρίζα.

#### (α) Το ύψος της πάνω ζώνης = το πλάτος της αριστερής
Ήταν `18` και `28`: δύο **σωστές** απαντήσεις σε δύο διαφορετικές ερωτήσεις (η αριστερή έπρεπε
να χωρά τετραψήφιο αριθμό γραμμής· η πάνω μία σειρά κειμένου). Το αποτέλεσμα όμως ήταν
**ορθογώνια** γωνία ένωσης και πλαίσιο με ανομοιόμορφο πάχος — δύο χάρακες αντί για έναν.

Οδηγός μένει η **αριστερή**, γιατί η απαίτησή της είναι μετρήσιμη (τετραψήφιο) ενώ η άλλη
χωρά άνετα και στα 28. Υλοποίηση: **μία** ιδιωτική σταθερά `TABLE_INDICATOR_BAND_PX = 28` και
δύο ονόματα που τη **διαβάζουν** (`columnBandPx`, `rowBandPx`). Τα δύο ονόματα μένουν επειδή
είναι σημασιολογικά διαφορετικά (ύψος vs πλάτος) — αλλά **δεν μπορούν να αποκλίνουν**, γιατί
δεν υπάρχει δεύτερη τιμή να αποκλίνει. Anchor: «η γωνία ένωσης είναι τετράγωνο».

#### (β) 🔴 Η ΓΡΑΜΜΗ ΤΥΠΩΝ ΣΚΕΠΑΣΕ ΤΑ ΓΡΑΜΜΑΤΑ — ΔΙΚΗ ΜΑΣ ΠΑΛΙΝΔΡΟΜΗΣΗ ΤΟΥ §27.11
Η γραμμή τύπων υπολόγιζε **μόνη της** το εξωτερικό όριο του δείκτη:
`SPACE_NEEDED_ABOVE_PX = TABLE_INDICATOR.columnBandPx + …` και `offsetXPx = -rowBandPx`.
Τη στιγμή που η ζώνη απέκτησε **κενό** (§27.11), η ζώνη κατέβηκε 8 px πιο έξω και η γραμμή
έμεινε στη θέση της ⇒ **σκέπασε ακριβώς αυτό που εξηγεί**.

**Τρία ξεχωριστά πράγματα απέτυχαν, και αξίζουν να γραφτούν χωριστά:**

1. **Το SSoT audit του §27.11 το έχασε.** Έψαξε `columnBandMm|rowBandMm` — τα ονόματα σε
   **mm**. Η γραμμή τύπων μιλά σε **px** (`columnBandPx`). **Δύο λεξιλόγια της ίδιας
   ποσότητας**: ένα grep σε ένα λεξιλόγιο επιστρέφει «καθαρό» με απόλυτη σιγουριά και είναι
   λάθος. Ίδιο σχήμα με το «`0` = κανείς δεν κοίταξε» του N.11/N.12.
2. **Το test ήταν πράσινο ενώ έσπαγε.** Έλεγχε
   `offsetYPx < -(columnBandPx + heightPx)` — γνήσια ανισότητα πάνω σε **λάθος ποσότητα**:
   «είναι πιο ψηλά από κάτι;» αντί για «**πού τελειώνει** η γραμμή σε σχέση με το **πού
   αρχίζει** ο δείκτης;». Η πρώτη μένει αληθής όταν το εμπόδιο μεγαλώνει· η δεύτερη όχι.
   Τώρα ελέγχεται η **κάτω ακμή**: `offsetYPx + heightPx ≤ -OUTER.top`.
3. **Ο Giorgio το είδε πριν από κάθε εργαλείο.** Δίχτυ 1.684 πράσινο, jscpd καθαρό, μετάλλαξη
   4/4 — και η οθόνη έλεγε το αντίθετο. Το §26.15 το είχε ήδη γράψει: **η επικάλυψη θέλει
   οθόνη**, το jsdom δεν την βλέπει ποτέ.

**Η θεραπεία είναι δομική, όχι αριθμητική**: `TABLE_INDICATOR_OUTER_PX = { top, left }` στο
`table-indicator-geometry` — «πόσο τόπο πιάνει ο δείκτης **έξω** από το πλέγμα», κενό **συν**
ζώνη, σε **ένα** σημείο. Κανόνας: **κανείς έξω από αυτό το module δεν προσθέτει ζώνη + κενό.**
Η γραμμή τύπων πλέον **ρωτάει**· ό,τι κι αν αλλάξει στη ζώνη, το μαθαίνει δωρεάν.

#### Αποδείξεις
- **Μετάλλαξη**: με τη γραμμή να αγνοεί ξανά το κενό (`OUTER.top − 8`), κοκκινίζει **ακριβώς**
  το νέο anchor της κάτω ακμής — τα υπόλοιπα 11 μένουν πράσινα, δηλαδή το παλιό δίχτυ ήταν
  **δομικά τυφλό** σε αυτή τη ρύθμιση.
- Δίχτυ πίνακα **1.686/1.686** · `jscpd --diff` καθαρό · μεγαλύτερο αρχείο 245 γραμμές.

#### 🔴 ΑΝΕΠΑΛΗΘΕΥΤΟ ΖΩΝΤΑΝΑ
Και τα δύο είναι **οπτικά**. Ειδικά το (α) μεγαλώνει το chrome πάνω από τον πίνακα κατά 10 px
και σπρώχνει τη γραμμή τύπων άλλα τόσο ψηλά — δηλαδή πλησιάζει το κατώφλι αναποδογυρίσματος.
Θέλει μάτια σε πίνακα κοντά στο πάνω χείλος.

**Προσθήκη (ίδια μέρα)**: το ύψος της γραμμής τύπων ήταν `26` — τυχαία κοντά στο `28` της
ζώνης. Δύο **κοντινοί αλλά όχι ίσοι** αριθμοί στην ίδια κατακόρυφη στοίβα διαβάζονται ως
αστοχία ευθυγράμμισης, όχι ως πρόθεση. Πλέον `BAR_HEIGHT_PX = TABLE_INDICATOR.columnBandPx`:
γραμμή τύπων και ζώνη είναι δύο λωρίδες του **ίδιου** χάρακα. Διαβάζει το `TABLE_INDICATOR`
κατευθείαν και **όχι** το `TABLE_INDICATOR_OUTER_PX` — είναι **πάχος**, όχι θέση· άλλη
ερώτηση, άλλη πηγή.

### §27.14 — ΤΟ ΔΕΞΙ ΚΛΙΚ ΣΤΙΣ ΛΩΡΙΔΕΣ ΑΝΟΙΓΕ ΤΟ ΜΕΝΟΥ ΤΟΥ ΚΑΜΒΑ (2026-08-02)

**Αναφορά Giorgio**: «δεξί κλικ πάνω στις λωρίδες για να ανοίξω το μενού προσθήκης στηλών ή
γραμμών ⇒ αντί για το μενού του Excel εμφανίζεται το μενού του **καμβά**.»

#### Το εύρημα του στιγμιότυπου, πριν από κάθε υπόθεση
Στην εικόνα ο πίνακας είναι **επιλεγμένος** (λαβές, «Delete (1)») και **δεν υπάρχει καμία
λωρίδα**. Ο ζωγράφος δείχνει ζώνες **μόνο** όταν υπάρχει δρομέας ⇒ τη στιγμή που άνοιξε το
μενού, **η συνεδρία ήταν ήδη κλειστή**. Άρα το ερώτημα δεν ήταν ποτέ «ποιο μενού ανοίγει»:
ήταν «**ποιος σκότωσε τη συνεδρία πριν φτάσει το `contextmenu`**».

#### Η ρίζα: το §26.15 έδωσε δήλωση ΜΟΝΟ στο αριστερό πλήκτρο
Ο `use-table-cell-pointer` άνοιγε με `if (event.button !== 0) return;`. Η αιτιολογία ήταν
**σωστή** («το δεξί δεν επιτρέπεται να μετακινήσει την επιλογή κάτω από το μενού που μόλις
άνοιξε») — αλλά η πρόωρη έξοδος έκανε **δύο** πράγματα αντί για ένα: μαζί με τη μετακίνηση
απέκλεισε και τη **δήλωση** `claimTableCellSessionPointerDown()`. Η αλυσίδα:

```
mousedown(button 2) → [καμία δήλωση] → focusout → φύλακας: «αδιεκδίκητο» → ΚΛΕΙΣΙΜΟ
                                                → contextmenu → getHit(): δρομέας null
                                                → null ⇒ PRIORITY 2: μενού οντότητας
```

Ο δρομολογητής (`useCanvasContextMenu` PRIORITY 1.4) ήταν **σωστός** σε κάθε βήμα, και το
`getHit` επίσης: απαντούσε τίμια «δεν υπάρχει ζώνη», γιατί όντως δεν υπήρχε πια.

🔴 **Ο κανόνας του §26.15 δεν είπε ποτέ «αριστερό»**: είπε «όποτε αυτός ο ακροατής αναγνωρίζει
ότι το πάτημα έπεσε **μέσα στον δικό του πίνακα**, το δηλώνει». Η διόρθωση δεν προσθέτει
κανόνα — **εφαρμόζει τον υπάρχοντα ακέραιο**: δύο πλήκτρα μπαίνουν, **ένα** ενεργεί. Το μεσαίο
(pan) μένει εκτός.

#### Τι ΔΕΝ άλλαξε — ρητά (απόφαση Giorgio, 2026-08-02)
Ρωτήθηκε αν το **αριστερό** κλικ στη λωρίδα πρέπει να πάψει να μαρκάρει ολόκληρη τη
στήλη/γραμμή. Απάντηση: **όχι** — μένει, είναι το πρότυπο Excel / Sheets / AutoCAD. Το μενού
ήταν **ήδη** αποκλειστικά δεξιού κλικ (μοναδική διαδρομή: `contextmenu` → θύρα → `open`)·
καμία διαδρομή αριστερού κλικ προς μενού δεν υπήρξε ποτέ, και επαληθεύτηκε με grep.

#### Αποδείξεις
- **Κόκκινο πρώτα, 3/3**: «δεξί στη ζώνη ⇒ ζει», «δεξί σε κελί ⇒ ζει», «μόνο δηλώνει».
- **Η μισή προδιαγραφή, ρητά**: «δεξί κλικ **έξω** από τον πίνακα ⇒ κλείνει» — στο **ίδιο**
  σημείο οθόνης με το αριστερό δίδυμό του, αλλιώς συγκρίνονται δύο διαφορετικά πράγματα. Μια
  «διόρθωση» που κρατά τη συνεδρία σε κάθε δεξί κλικ του σχεδίου θα ήταν χειρότερη από το
  σφάλμα.
- Δίχτυ **1.795/1.795** (132 σουίτες, μαζί με `hooks/canvas`) · `jscpd --diff` καθαρό.

#### Το μάθημα
Το §26.15 πλήρωσε ήδη ένα μάθημα: «**μέτρα την αλληλουχία, όχι το αποτέλεσμα**». Εδώ ίσχυσε
ξανά, και μάλιστα χωρίς browser: η αλληλουχία διαβάστηκε **στατικά** (ποιος καλεί τη δήλωση —
grep, δύο σημεία, και τα δύο στο αριστερό μονοπάτι) και το test την επιβεβαίωσε κόκκινο. Η
οθόνη έδωσε το **σήμα** (καμία λωρίδα στο στιγμιότυπο)· ο κώδικας έδωσε την **αιτία**.


## 28. 🔴 ΦΑΣΗ Ε — MINI TOOLBAR ΜΟΡΦΟΠΟΙΗΣΗΣ ΣΤΙΣ ΖΩΝΕΣ ΔΕΙΚΤΗ (EXCEL FULL PARITY)

**Η απαίτηση, αυτολεξεί (Giorgio, 2026-08-02)**: «όταν κάνω δεξί κλικ πάνω στις λωρίδες
γραμμάτων και αριθμών, μαζί με το μενού προσθήκης γραμμής και στήλης να εμφανίζεται
**ξεκομμένο** και ένα μικρό μενουδάκι ρυθμίσεων κειμένου **πάνω από** το μενού προσθήκης,
όπως κάνει το Excel». Και ρητά: «**ΘΕΛΩ FULL PARITY EXCEL = NESTOR**».

📎 **Η πλήρης χαρτογράφηση** (38 χειριστήρια, πίνακας parity με αποδείξεις αρχείο:γραμμή,
ρίσκα, SSoT) ζει στο `HANDOFFS/2026-08-02_ADR-739_mini-toolbar-EXCEL-PARITY_synthesis.md`.
Παράχθηκε από orchestrator 9 πρακτόρων (8 παράλληλες έρευνες + σύνθεση) και ο συνθέτης
**έλυσε 4 αντιφάσεις** ανοίγοντας ο ίδιος τον κώδικα. Το παρόν §28 κρατά **μόνο** τις
αποφάσεις — η ανάλυση δεν αντιγράφεται εδώ.

### 28.1 🔴 Δύο ευρήματα που καμία από τις 8 έρευνες δεν είδε

1. **Η γραμματοσειρά ΔΕΝ είναι overridable — δομικά.** `table-style.ts:162` γράφει
   `fontFamily: base.fontFamily` (όχι `override.fontFamily ?? …`) και το
   `TableCellStyleOverride` **δεν έχει καν πεδίο** `fontFamily`. Το γνωστό χρέος «ο καμβάς
   ζωγραφίζει πάντα Arial» (`stamp-table-layout.ts:302-307`) είναι το **δεύτερο** εμπόδιο.
2. **Το ίδιο για τα περιθώρια** (`table-style.ts:164`) ⇒ καμία εσοχή ανά στήλη/κελί.

### 28.2 🔴 Το ζωντανό ελάττωμα που βρέθηκε ψάχνοντας για κάτι άλλο

**Ο πίνακας δεν εξάγεται όπως φαίνεται — ήδη σήμερα, ανεξάρτητα από αυτή τη δουλειά.**
Η διάταξη υπολογίζει **σωστά** `bold` + `colorHex` + `stroke` (`table-layout-to-primitives.ts:48-69`)
και το επόμενο βήμα τα **πετά**:

| χάνεται | πού |
|---|---|
| έντονα + χρώμα κειμένου | `table-to-primitives.ts:93-103` — το `NeutralTextOptions` δεν έχει πεδία |
| μολύβι περιγράμματος | `table-to-primitives.ts:90` — το `makeLine` αγνοεί το `prim.stroke` |
| γέμισμα κελιού | δεν παράγεται **καθόλου** ως primitive (`makeSolidFill` υπάρχει, αχρησιμοποίητο) |

Σύμπτωμα σήμερα: η γκρίζα γραμμή κεφαλίδας φεύγει στο DXF **λευκή**.

### 28.3 Οι αποφάσεις του ιδιοκτήτη (2026-08-02)

| # | Απόφαση | Συνέπεια |
|---|---|---|
| Α1 | **Η εξαγωγή διορθώνεται ΠΡΙΝ βγουν τα κουμπιά** | το §28.2 γίνεται **Φάση 1** — αλλιώς ο μηχανικός μορφοποιεί ό,τι δεν τυπώνεται και το μαθαίνει από τον πελάτη |
| Α2 | **Μορφοποίηση σε επίπεδο ΣΤΗΛΗΣ/ΓΡΑΜΜΗΣ**, όχι μόνο ανά κελί | νέες γραμμές **κληρονομούν** (κανόνας Excel)· νέο `TableAxisStyleOverride` |
| Α3 | **Το χρέος «πάντα Arial» ΛΥΝΕΤΑΙ** (δεν κρύβεται το χειριστήριο) | + πεδίο `fontFamily` σε override **και** ο ζωγράφος να το διαβάζει· θεραπεύει και το «μετράω άλλη, ζωγραφίζω άλλη» |
| Α4 | **Αριθμητική μορφοποίηση στη ΖΩΓΡΑΦΙΚΗ**, όχι επανεγγραφή κελιών | ανατρέπει ρητά την απόφαση `table-model-helpers.ts:74-83`· **αντιστρέψιμο, μηδέν απώλεια δεδομένων** — ο ακατέργαστος αριθμός επιβιώνει |
| Α5 | **«Συγχώνευση & κέντρο» = κανονική συγχώνευση όλης της στήλης** | πλήρες parity· effort M→L |
| Α6 | **Γραμμή > στήλη** σε σύγκρουση *(απόφαση αρχιτέκτονα, εγκεκριμένη σιωπηρά)* | η στήλη λέει «τι είδους δεδομένα», η γραμμή «τι ρόλο έχει η εγγραφή» — ο ειδικότερος ρόλος νικά |
| Α7 | **Το toolbar είναι ΞΕΚΟΜΜΕΝΟ**, δεύτερη πλωτή επιφάνεια πάνω από το μενού | ⚠️ **διόρθωση της πρότασης του αρχιτέκτονα**, που το ήθελε μέσα στο ίδιο `DxfMenuContent`· το Excel έχει όντως ξεχωριστό πλαίσιο με κενό, και αυτό ζήτησε ο ιδιοκτήτης |

### 28.4 Η σειρά προτεραιότητας στυλ — πέντε επίπεδα

```
1. παράκαμψη ΚΕΛΙΟΥ    (TableCell.styleOverride)              ← νικά τα πάντα
2. παράκαμψη ΓΡΑΜΜΗΣ   (TableRow.styleOverride)        ΝΕΟ    ← Α6
3. παράκαμψη ΣΤΗΛΗΣ    (TableColumn.styleOverride)     ΝΕΟ
4. στήλη σημασιολογική (TableColumn.align, 3 θέσεων)           ← μόνο hAlign· υπάρχει
5. ΚΛΑΣΗ ΓΡΑΜΜΗΣ       (TableStyle.rowClasses[...])            ← η βάση
```

**Τέσσερα** σημεία την επιλύουν, όχι δύο: `resolveCellStyle` (`table-style.ts:151`), οι δύο
καλούντες του (`table-layout-place.ts:207`, `table-layout-measure.ts:75` — **ο δεύτερος είναι
υποχρεωτικός**, αλλιώς οι στήλες `hug` μετρώνται με λάθος μέγεθος/bold και το κείμενο κόβεται),
και η ξεχωριστή έκφραση `hAlign` (`table-layout-place.ts:210-212`).

**Ένας** τύπος `TableAxisStyleOverride` και για τους δύο άξονες — δύο ταυτόσημα interfaces
είναι ακριβώς το σχήμα που πιάνει το CHECK 3.28 (N.18).

### 28.5 Φασεολόγιο — 6 φάσεις, καθεμιά ανεξάρτητα αποστείλσιμη

| Φ | περιεχόμενο | 🔴 τι βλέπει ο χρήστης |
|---|---|---|
| **1** | **«Ό,τι βλέπεις, βγαίνει»** (§28.2) — `makeText` δέχεται bold/χρώμα, `makeLine` δέχεται `stroke`, νέο fill primitive μέσω του υπάρχοντος `makeSolidFill`. **Καμία διεπαφή.** | Εξάγει τον **σημερινό** πίνακα και η γκρίζα κεφαλίδα βγαίνει **γκρίζα** |
| **2** | Θεμέλιο §28.4 + καθαρές πράξεις + κληρονομιά σε εισαγωγή **+ ένα κουμπί: Έντονα** | Δεξί κλικ στο **B** → **Β** → όλη η στήλη έντονη· νέα γραμμή βγαίνει έντονη· **ένα** `Ctrl+Z`· επιβιώνει σε reload· **και τυπώνεται** |
| **3** | Τυπογραφία: Πλάγια · Υπογράμμιση · Μέγεθος ± · **Γραμματοσειρά (Α3)** | πλήρης η σειρά 1 του Excel· διπλό κλικ → το πεδίο **δεν αναπηδά** |
| **4** | Χρώμα κειμένου · Χρώμα γεμίσματος · «Κανένα γέμισμα» | βάφει τη γραμμή συνόλων· hover → **το κείμενο δεν εξαφανίζεται** |
| **5** | Στοίχιση (`JustificationGrid` SSoT) · **Συγχώνευση & κέντρο (Α5)** · Περιγράμματα (μόνο τα υπάρχοντα, ανά κλάση γραμμής) | κεντράρει στήλη· συγχωνεύει· γραμμή πάνω από τα σύνολα |
| **6** | **Αριθμητική μορφοποίηση στη ζωγραφική (Α4)** — νέο `numberFormat` στο `TableColumn`, με `src/lib/intl-formatting.ts` | `1234.5` → `1.234,50 €` σε όλη τη στήλη με ένα κλικ |

**Εκτός v1**, ρητά καταγεγραμμένα ως γνωστά κενά: Πινέλο μορφοποίησης για πίνακες (ο
μηχανισμός **υπάρχει** — λείπει ο `'table'` από τη λίστα στο `entities.ts:1444`), «Μορφοποίηση
κελιών…» (πλήρης διάλογος), Μορφοποίηση υπό όρους, per-cell περιγράμματα.

### 28.6 Τι είναι γνήσια «δεν έχει νόημα σε CAD» — μόνο ΔΥΟ

Ο συνθέτης πέρασε **και τα 18** χειριστήρια με το βάρος της απόδειξης στον ίδιο, και βρήκε
**δύο** — και τα δύο αφορούν τη **μονάδα**, όχι τη λειτουργία:

- **Μέγεθος σε `pt`**: εδώ το ύψος είναι **sheet-mm** (DXF group code 140), δεσμευμένο στην
  κλίμακα σχεδίου (ADR-462/716). Ένα αποθηκευμένο «12pt» = δεύτερη μονάδα + μεταφραστής,
  ακριβώς η παγίδα που τα δύο εκείνα ADR έκλεισαν. **Το χειριστήριο μένει applicable** —
  N/A είναι μόνο η *αποθηκευμένη* μονάδα.
- **Φιλτράρισμα/ταξινόμηση**: αλλάζει *ποιες* γραμμές υπάρχουν· εδώ ο πίνακας είναι **σχέδιο**
  με σταθερή γεωμετρία, και θα έσπαγε το συμβόλαιο `bound`/`live`. **Το οπτικό μέρος
  (banded rows) είναι applicable** και υπάρχει ήδη ως `TableStyle`, απλώς χωρίς διεπαφή.

⚠️ **Ρητά ΟΧΙ N/A**, ώστε να μη γίνουν βολική δικαιολογία: νόμισμα (ένα BOQ **έχει** κόστη),
υπογράμμιση (το AutoCAD MTEXT την έχει· ο ίδιος ο Νέστορας τη ζωγραφίζει ήδη για κείμενα),
per-cell περιγράμματα (το AutoCAD τα έχει), μορφοποίηση υπό όρους (Revit από το 2010).
Είναι **αναβολές**, όχι αδυναμίες.

### 28.7 🔴 Τα πέντε ρίσκα, με το σύμπτωμα στην οθόνη

1. **Το πρώτο κλικ σε «Β» κλείνει το μενού** — αν τα κουμπιά είναι `DxfMenuItem` (Radix), το
   `onSelect` καλεί `onOpenChange(false)` (§27.7). ⇒ `role="toolbar"` με **σκέτα `<button>`**
   και δικό του roving tabindex (←/→), όχι το ↑/↓ του menu.
2. **Η μορφοποίηση δεν φαίνεται μέχρι F5** — mutation in-place αντί για spread· τα δύο
   αλυσιδωμένα `WeakMap` (`RESOLVED_MODEL_CACHE` → `LAYOUT_CACHE`) επιστρέφουν την παλιά
   διάταξη. **Υποχρεωτικά** νέο αντικείμενο, **και** επιστροφή `model` by-reference στο no-op
   (αλλιώς κάθε άνοιγμα μενού γεννά άχρηστο βήμα undo).
3. **Εξάγει και βγαίνει μονόχρωμο** — §28.2· η Α1 το βάζει πρώτο ακριβώς γι' αυτό.
4. **«Κανένα γέμισμα» που δεν σβήνει τίποτα** — το `??` merge (`table-style.ts:144-149`) δεν
   ξεχωρίζει «απόν override» από «ρητά κανένα». Θέλει τιμή-φρουρό ή `fillNone?`, **απόφαση
   πριν τον κώδικα** — και θα ξαναεμφανιστεί για κάθε «καθάρισμα» ιδιότητας.
5. **Νέα στήλη γεννιέται άβαφη** — το `insertTableColumn` (`table-row-column-ops.ts:281-287`)
   κληρονομεί **ρητή λίστα** πεδίων. Ξεχασμένο `styleOverride` ⇒ αποτυγχάνει ακριβώς ο λόγος
   που επιλέχθηκε το μοντέλο επιπέδου στήλης (Α2), στο πιο ορατό σημείο.

### 28.8 Ανεπαλήθευτα — να επαληθευτούν πριν τη Φάση 1

- **Ποιο μονοπάτι ακολουθεί η εξαγωγή PDF** ενός `TableEntity`. Αν περνά από τον
  `detail-pdf-renderer` (που καταναλώνει `DetailPrimitive` **με** stroke/bold/colorHex), το
  **PDF μπορεί να είναι σωστό ενώ το DXF όχι**. Αλλάζει τη σοβαρότητα του ρίσκου 3.
- Αν το `role="toolbar"` μέσα σε `role="menu"` περνά a11y review (ασυνήθιστος συνδυασμός).
- Αν το `FONT_SIZES_RAW` του `dxf-settings` ταιριάζει εννοιολογικά με sheet-mm.

---

## Changelog
- **2026-08-02** — **§28: ΦΑΣΗ Ε — MINI TOOLBAR ΜΟΡΦΟΠΟΙΗΣΗΣ (EXCEL FULL PARITY) — ΧΑΡΤΟΓΡΑΦΗΣΗ
  ΚΑΙ ΑΠΟΦΑΣΕΙΣ.** Orchestrator 9 πρακτόρων χαρτογράφησε **38 χειριστήρια**· ο συνθέτης έλυσε
  **4 αντιφάσεις** ανοίγοντας ο ίδιος τον κώδικα. **Καμία γραμμή κώδικα** — μόνο έρευνα.
  · 🔴 **Ζωντανό ελάττωμα που βρέθηκε ψάχνοντας για κάτι άλλο**: ο πίνακας **δεν εξάγεται
    όπως φαίνεται**. Η διάταξη υπολογίζει σωστά bold/χρώμα/μολύβι και το
    `table-to-primitives.ts:90,93-103` τα **πετά**· το γέμισμα δεν παράγεται καν ως primitive.
    Σήμερα κιόλας η γκρίζα κεφαλίδα φεύγει στο DXF **λευκή**.
  · 🔴 **Δύο ευρήματα που καμία από τις 8 έρευνες δεν είδε**: η γραμματοσειρά **δεν είναι
    overridable** (`table-style.ts:162` + απόν πεδίο στο `TableCellStyleOverride`) — το «πάντα
    Arial» ήταν το *δεύτερο* εμπόδιο, όχι το πρώτο· ίδια ιστορία για τα περιθώρια.
  · **7 αποφάσεις** (§28.3): εξαγωγή **πριν** τα κουμπιά · επίπεδο στήλης/γραμμής · λύση του
    χρέους Arial · αριθμοί **στη ζωγραφική** (αντιστρέψιμο) · πλήρης συγχώνευση στήλης ·
    γραμμή > στήλη · **ξεκομμένο** toolbar (διόρθωση της πρότασης του αρχιτέκτονα, κατά τη
    ρητή διατύπωση του ιδιοκτήτη).
  · **Μόνο ΔΥΟ** γνήσια N/A σε 18 χειριστήρια, και τα δύο αφορούν **μονάδα** όχι λειτουργία.
    Νόμισμα / υπογράμμιση / per-cell περιγράμματα / υπό όρους = **αναβολές**, ρητά όχι N/A.
  · Πλήρης ανάλυση: `HANDOFFS/2026-08-02_ADR-739_mini-toolbar-EXCEL-PARITY_synthesis.md`.
- **2026-08-02** — **§27.14: ΤΟ ΔΕΞΙ ΚΛΙΚ ΣΤΙΣ ΛΩΡΙΔΕΣ ΑΝΟΙΓΕ ΤΟ ΜΕΝΟΥ ΤΟΥ ΚΑΜΒΑ.** Το
  στιγμιότυπο έδειχνε **καμία λωρίδα** ⇒ η συνεδρία ήταν ήδη κλειστή όταν έφτασε το
  `contextmenu`, άρα το `getHit` απαντούσε τίμια `null`. Ρίζα: το §26.15 έδωσε **δήλωση** μόνο
  στο αριστερό πλήκτρο (`if (event.button !== 0) return`), οπότε κάθε δεξί πάτημα άφηνε
  αδιεκδίκητο `focusout` ⇒ κλείσιμο. Ο κανόνας του §26.15 δεν είπε ποτέ «αριστερό» — τώρα
  **δύο πλήκτρα μπαίνουν, ένα ενεργεί** (μεσαίο = pan, εκτός). Κόκκινο πρώτα **3/3** + η μισή
  προδιαγραφή («δεξί έξω ⇒ κλείνει», ίδιο σημείο με το αριστερό δίδυμο). Δίχτυ
  **1.795/1.795**. ✅ Απόφαση Giorgio: το **αριστερό** κλικ **κρατά** την επιλογή ολόκληρης
  στήλης/γραμμής (πρότυπο Excel) — καμία διαδρομή αριστερού προς μενού δεν υπήρξε ποτέ.
  🔴 **Ανεπαλήθευτο ζωντανά.**
- **2026-08-02** — **§27.13: ΕΝΑ ΠΑΧΟΣ ΓΙΑ ΤΙΣ ΔΥΟ ΖΩΝΕΣ · ΚΑΙ Η ΓΡΑΜΜΗ ΤΥΠΩΝ ΠΟΥ ΤΙΣ
  ΣΚΕΠΑΣΕ.** (α) Ύψος πάνω ζώνης = πλάτος αριστερής (`TABLE_INDICATOR_BAND_PX = 28`, **μία**
  σταθερά, δύο ονόματα που τη διαβάζουν) ⇒ **τετράγωνη** γωνία ένωσης. Ύψος γραμμής τύπων =
  ίδιο πάχος (ήταν `26`: κοντινό-αλλά-όχι-ίσο = διαβάζεται ως αστοχία). (β) 🔴 **Δική μας
  παλινδρόμηση του §27.11**: η γραμμή τύπων ξανάφτιαχνε το εξωτερικό όριο του δείκτη, έμεινε
  στη θέση της όταν μπήκε το κενό και **σκέπασε τα γράμματα**. Τρεις ξεχωριστές αστοχίες: το
  SSoT audit έψαξε `…Mm` ενώ αυτή μιλά `…Px` (**δύο λεξιλόγια της ίδιας ποσότητας**)· το test
  ρωτούσε «πιο ψηλά από κάτι;» αντί «πού τελειώνει vs πού αρχίζει;» και έμενε πράσινο· ο
  Giorgio το είδε πριν από κάθε εργαλείο. Θεραπεία δομική: `TABLE_INDICATOR_OUTER_PX` —
  **κανείς έξω από το geometry module δεν προσθέτει ζώνη + κενό**. Δίχτυ **1.686/1.686**.
- **2026-08-02** — **§27.12: Ο ΣΤΡΑΜΜΕΝΟΣ ΠΙΝΑΚΑΣ — ΤΟ ΣΤΑΤΙΚΟ ΜΙΣΟ.** Το τελευταίο εκκρεμές του
  §27.9 μετρήθηκε πριν ανοίξει browser. Δύο από τα τρία σημεία ήταν **ήδη** κλειστά: οι γερμένες
  ζώνες (8β) από το `table-rotated-text.test.ts` του βήματος 8, και η θέση του μενού (8γ) που
  είναι **ανεξάρτητη γωνίας εξ κατασκευής** (`open(clientX, clientY)` — καμία ανάγνωση
  `angleRad`). Το τρίτο (8α) ήταν **δομικά ανέλεγκτο**: και τα 13 table tests της Φ.Δ χτίζουν
  `angleRad: 0`, όπου `cos = 1, sin = 0` **εξαφανίζει κάθε όρο με `sin`**.
  · Αιτία = **διπλότυπο (N.18)**: η προβολή «σημείο πίνακα → pixel» ήταν γραμμένη **τρεις**
    φορές με τρία ονόματα. Ενοποιήθηκε στο `__tests__/table-screen-point.ts`, που ζητά το
    ορθογώνιο ζώνης από το **SSoT** (`tableColumnTickRectMm`) αντί να το ξαναφτιάχνει.
  · **21 νέα tests**: κάθε στήλη/γραμμή σε **4 γωνίες** (0,35 · π/2 · −1,2 · 2,6 rad) με
    **άγκυρα εκτός (0,0)**, συν ένα test που αποδεικνύει ότι το μπλοκ **διακρίνει** τη στροφή.
  · 🔴 **Μετάλλαξη 4/4** στο `tableWorldToFrame` (δύο πρόσημα · αγνόηση γωνίας · λάθος άγκυρα)
    → 11/14/16/14 κόκκινα. Και στις τέσσερις, τα **29 προϋπάρχοντα tests έμειναν πράσινα** —
    δεν ήταν αδύναμα, ήταν **τυφλά**. Δίχτυ βήματος 9: **790 πράσινα** (από 762)· jscpd καθαρό.
  · ⚠️ **ΔΕΝ αντικαθιστά τη ζωντανή επαλήθευση**: το jest τρέχει με συνθετικό viewport και
    μηδενική βαθμονόμηση· τα 8α/8β/8γ **στον browser** παραμένουν ανοιχτά.
  · Δύο διορθώσεις μετρήσεων (ο δρόμος περιστροφής είναι **λαβή**, όχι κορδέλα· το
    `mmToWorld ≈ 1` είναι **αλλαγή μεταβλητής**, όχι τιμή) + μία **λανθάνουσα** απόκλιση
    `sceneUnits` ζωγράφου/hit-test, καταγεγραμμένη και ανέγγιχτη.
- **2026-08-02** — **§27.11: ΟΙ ΖΩΝΕΣ ΔΕΙΚΤΗ ΔΕΝ ΑΚΟΥΜΠΟΥΝ ΠΙΑ ΤΙΣ ΛΑΒΕΣ.** Η ερώτηση «να τις
  αγκαλιάζουν οι λαβές;» απαντήθηκε **όχι** (τέσσερις δομικοί λόγοι· κανένας μεγάλος δεν το
  κάνει). Το z-order ήταν **ήδη** σωστό — το ελάττωμα ήταν ότι το ίδιο pixel απαντούσε σε δύο
  ερωτήσεις, με τον ακροατή **παθητικό** ⇒ και τα δύο γίνονταν. Κενό =
  `TOLERANCE_CONFIG.GRIP_APERTURE` (**η οπή της λαβής**, όχι αισθητικό νούμερο) + γνήσια
  ανισότητα στο εσωτερικό όριο. Παράπλευρο: **τέταρτο** αντίγραφο της αριθμητικής μέσα στον
  βοηθό tests του §27.9 ⇒ 18 κόκκινα σε αρχεία που δεν άλλαξαν· τώρα ζητά το ζωγραφισμένο
  κουτί. Μετάλλαξη 4/4 · anchor «κάθε λαβή σε `v = 0`» · δίχτυ **1.684/1.684**.
  🔴 **Ανεπαλήθευτο ζωντανά** — οπτική αλλαγή, θέλει οθόνη.
- **2026-08-02** — **§27.10: ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ ΤΟΥ ΒΗΜΑΤΟΣ 9 — ΚΑΙ ΤΟ ESCAPE ΠΟΥ ΕΣΒΗΝΕ ΤΙΣ
  ΖΩΝΕΣ.** Πέντε από τα έξι σημεία πέρασαν με δεδομένα/screenshot (ταυτότητα μενού · `colSpan`
  3→4 στον τίτλο · **ένα** undo · επιβίωση σε reload · ανενεργή διαγραφή σε μονόστηλο). Το έκτο
  αποκάλυψε το σφάλμα που ανέφερε ο Giorgio ως «**το δεξί κλικ στα γράμματα δεν ανοίγει
  μενού**»:
  · 🔴 **Το μενού δεν είχε slot στον escape-bus.** Ο bus είναι ο **πρώτος** window-capture
    listener και σφραγίζει με `stopImmediatePropagation()`· το `DismissableLayer` του Radix
    ακούει σε **document** capture, δηλαδή μετά. Το πρώτο ESC το άρπαζε το
    `canvas/fallback-deselect` (P400) — «υπάρχει επιλεγμένη οντότητα;» είναι **πάντα** αληθές σε
    λειτουργία πίνακα, και η ασπίδα «editable focus» δεν το έκοβε επειδή η εστίαση ήταν στο
    `<div role="menu">` του Radix, **όχι** σε πεδίο κειμένου.
  · 🔴 **Τρία κακά με ένα πάτημα**: το μενού δεν έκλεινε· ο πίνακας αποεπιλεγόταν· και ο
    `TableRenderer` (`selected ? cursorOf(...) : null`) σταματούσε να ζωγραφίζει δρομέα **και
    ζώνες** ⇒ **κατάσταση-φάντασμα**, «είμαι σε λειτουργία πίνακα» χωρίς τίποτα να πατήσεις.
    Το σχόλιο «ο δρομέας υπάρχει μόνο όσο ο πίνακας είναι επιλεγμένος» ήταν **ψευδής υπόθεση**.
  · ✅ Διόρθωση: **μία** εγγραφή σε `ESC_PRIORITY.POPOVER_DROPDOWN` (το σκαλί των 14 άλλων
    dropdowns), με `canHandle: () => isOpen` (**όχι** `true` — αυτό θα ήταν η §10.12 του
    ADR-364 ξανά) και κλείσιμο μέσω του **ΕΝΟΣ** δρόμου `handleOpenChange` (§27.7).
  · Το dev audit το φώναζε ήδη (`SHADOW-OWNER`)· κανείς δεν διάβαζε την κονσόλα. Μετά τη
    διόρθωση **εξαφανίστηκε**. 3 νέα tests, **mutation-verified 3/3**· σουίτα **723 πράσινα**.
  · 🔬 Νέο όργανο επαλήθευσης: το URL είναι debounced και ο μετασχηματισμός ζει σε module store,
    οπότε η θέση μετριέται **ρωτώντας την ίδια την εφαρμογή** (ένδειξη «Συντεταγμένες X/Y» →
    δύο δείγματα ⇒ κλίμακα+μετατόπιση). Πλαισίωση με **pan (μεσαίο πλήκτρο) + ροδέλα** — η
    ροδέλα μόνη της **δεν φτάνει** (στο ταβάνι zoom-out ο στόχος έμενε 120 px έξω).
- **2026-08-02** — **§26.15: ΤΟ ΚΛΙΚ ΣΤΟΝ ΚΑΜΒΑ ΔΕΝ ΚΛΕΙΝΕΙ ΠΙΑ ΤΗ ΣΥΝΕΔΡΙΑ** — το εύρημα του
  βήματος 8 έκλεισε, και η ρίζα ήταν **δύο** πράγματα:
  · 🔴 **Το κέλυφος σκέπαζε το κελί.** Ο επεξεργαστής δήλωνε `pointer-events-none` μόνο στο
    `<textarea>`· το `TextEditorAnchorLayer` (`position: fixed` πάνω από τον καμβά) παρέμενε
    στόχος. Καταγραφή συμβάντων: ο στόχος του `mousedown` γινόταν **`DIV` αντί για `CANVAS`**
    ακριβώς όταν ο δρομέας ήταν **σε εκείνο** το κελί. **Απουσία, όχι κούρσα** — γι' αυτό
    11/11 με μηδενική διακύμανση. Νέο **opt-in** `transparentToPointer` (οι άλλοι δύο
    καταναλωτές του layer **πρέπει** να δέχονται κλικ).
  · 🔴 **Ένα κλικ παράγει ΔΥΟ `focusout`**: ένα από το ξαναστήσιμο του πεδίου, ένα από τη
    **μεταφορά εστίασης**, που είναι προεπιλεγμένη ενέργεια και έρχεται **τελευταία**. Η
    «δηλωμένη εγγύηση του ενός rAF» δεν υπήρχε ποτέ.
  · **Η ερώτηση του φύλακα άλλαξε**, όχι ο χρονισμός: πρώτα «την πήρε μέλος;» (DOM), μετά
    «ήταν **δικό μου** κλικ;» (δήλωση του pointer — ο καμβάς δεν μπορεί να φέρει το σημάδι
    συνεδρίας). Τρίτη έκβαση `onReclaim` ⇒ `restartTableCellCursorSession`, ο **ίδιος** δρόμος
    με το κλείσιμο του μενού κεφαλίδων. Καμία `preventDefault`, κανένα `setTimeout`.
  · **Ο κύκλος ζωής της δήλωσης είναι δομικός**: γεννιέται μόνο με εστιασμένο μέλος (αλλιώς δεν
    έρχεται blur να την καταναλώσει), λήγει στο επόμενο `mousedown` **ή** `keydown` (αλλιώς το
    `Tab` έξω δεν σε βγάζει ποτέ). ⚠️ Η πρώτη εκδοχή ήταν «διάβασε-και-σβήσε» και άφηνε το
    **δεύτερο** `focusout` ορφανό ⇒ συνεδρία «ζωντανή αλλά **κουφή**», 2 στα 3 τρεξίματα.
  · 🔴 **Παράπλευρη σιωπηλή απώλεια πληκτρολόγησης** (§26.15.3): ο ακροατής σύλληψης έσβηνε το
    πρόχειρο **πριν** προλάβει το commit του `blur`. Το πληκτρολόγιο τηρούσε ήδη το γραμμένο
    συμβόλαιο «πρώτα δέσμευση, μετά μετακίνηση»· **το ποντίκι όχι**.
  · **Κόκκινο πρώτα**: `table-cell-pointer-session-survival.test.tsx` — pointer **και** φύλακας
    μαζί (κανένα από τα 603 tests δεν τους είχε συναντήσει). Δίχτυ **1.656/1.656**, jscpd καθαρό.
  · ✅ **Ζωντανά, 3 τρεξίματα × 6 βήματα, ταυτόσημα.** ⚠️ Τρεις αστοχίες **των οργάνων**
    τεκμηριωμένες στο §26.15.5 (τα `modifiers` του `mouse.click` αγνοούνται σιωπηλά· δύο αρχεία
    οργάνων είχαν αποκλίνει 1:40 vs 1:75· οι σταθερές θέσης εξαρτώνται και από το pan).
  · **Εξαγωγή** `table-cell-editor-frame-live.ts`: το `useTableCellDoubleClickEditor` χτύπησε
    τις 500 γραμμές (N.7.1) ⇒ 501 → **439**. Εξαγωγή, όχι κόψιμο σχολίων.
- **2026-08-02** — **Φ.Δ βήμα 9: ΕΙΣΑΓΩΓΗ/ΔΙΑΓΡΑΦΗ ΓΡΑΜΜΩΝ & ΣΤΗΛΩΝ ΑΠΟ ΤΙΣ ΖΩΝΕΣ ΔΕΙΚΤΗ** (§27).
  Δεξί κλικ σε γράμμα στήλης / αριθμό γραμμής ⇒ μενού με **ρητή κατεύθυνση** (πάνω/κάτω,
  αριστερά/δεξιά) + διαγραφή· αριστερό κλικ ⇒ επιλογή **ολόκληρης** της στήλης/γραμμής.
  · 🔴 **Οι ζώνες ήταν διακοσμητικές**: το `tableCellAtFrame` ελέγχει `u, v ≥ 0` ενώ οι ζώνες ζουν
    σε **αρνητικά** mm — κανένα hit-test δεν τις έβλεπε ποτέ. Και ο πίνακας δεν είχε **καμία**
    εντολή αλλαγής πλέγματος (`grep insertRow|deleteColumn` ⇒ μηδέν), όπως δήλωνε ρητά το
    `table-range-clipboard.ts`.
  · 🔴 **Η γεωμετρία της ζώνης έγινε SSoT** (`table-indicator-geometry.ts`): ο ζωγράφος την
    καταναλώνει αντί να την κρατά. Δεν είναι θέμα γραμμών — δύο αντίγραφα σημαίνουν ότι το
    **LOD** (πίνακας-κουκκίδα) και το **πάχος σε px** μπορούν να αποκλίνουν, δηλαδή να πατάς
    κουτί που δεν βλέπεις, με τη διαφορά να μεγαλώνει με το zoom.
  · 🔴 **Εξαίρεση full-width merge**: η γραμμή τίτλου μένει ολόκληρου πλάτους και σε εισαγωγή στο
    δεξί άκρο. Το σχήμα μας εκφράζει τον τίτλο ως merge ενώ το AutoCAD ως **ιδιότητα κλάσης
    γραμμής** — χωρίς αυτό, η πιο συνηθισμένη πράξη όλων θα έσπαγε ορατά τον τίτλο.
  · 🔴 **Η διαγραφή άγκυρας μεταφέρει το περιεχόμενο** στη νέα άγκυρα: ο χρήστης βλέπει ΕΝΑ κελί
    απλωμένο, όχι «κείμενο στην πρώτη στήλη». Αλλιώς ο τίτλος θα εξαφανιζόταν σιωπηλά.
  · **Νέα ταυτότητα με μέγιστο επίθεμα +1** (ντετερμινιστικά, καμία `crypto`): το προφανές
    `r${θέση}` **συγκρούεται** σε εισαγωγή στη μέση και ο αραιός χάρτης θα έδειχνε παλιά κελιά.
  · **ΕΝΑ undo**: η ίδια διαδρομή `buildTableModelCommand` με μονή επεξεργασία και επικόλληση.
    Ο δεσμευτής εξήχθη σε `use-table-model-commit.ts` (δεύτερος καταναλωτής ⇒ εξαγωγή, όχι κλώνος)
    με την **οντότητα ως όρισμα κλήσης** — event-time, όχι εξάρτηση render.
  · **Ένας δρομολογητής δεξιού κλικ** (PRIORITY 1.4): δεύτερος `contextmenu` ακροατής στο ίδιο
    container θα **έχανε** από τον υπάρχοντα (γράφεται πρώτος) και θα άνοιγε το μενού οντότητας —
    ο πίνακας **είναι** η επιλεγμένη οντότητα. Σύνδεση με **θύρα module** αντί για props, ώστε ο
    `CanvasSection` να μη χρειαστεί ούτε αναδιάταξη hooks ούτε νέα συνδρομή (ADR-040 / CHECK 6C).
  · 🔴 **Το μενού είναι ΜΕΛΟΣ της συνεδρίας** (`TABLE_CELL_SESSION_MARKER`): αλλιώς το Radix
    παίρνει την εστίαση, ο φύλακας blur κλείνει τον δρομέα, και **οι ζώνες εξαφανίζονται τη
    στιγμή που τις πατάς**. Νέα ενέργεια store `restartTableCellCursorSession()` επιστρέφει την
    εστίαση στο κελί στο κλείσιμο — χωρίς αυτήν η συνεδρία μένει ζωντανή αλλά **κουφή**.
  · **704 tests πράσινα** (46 νέα: 21 πράξεις + 10 γεωμετρία + 15 καλωδίωση)· **jscpd καθαρό**.
  · 🔴 **ΑΝΕΠΑΛΗΘΕΥΤΟ ΖΩΝΤΑΝΑ** (§27.9): έξι ονομαστικά σημεία εκκρεμούν στον browser.

- **2026-08-02** — **Φ.Δ βήμα 8: ΕΠΙΛΟΓΗ ΠΕΡΙΟΧΗΣ + ΑΝΤΙΓΡΑΦΗ/ΕΠΙΚΟΛΛΗΣΗ** (§26).
  `Shift+βέλος/Home/End`, `Shift+κλικ`, `Ctrl+A`· `Ctrl+C`/`Ctrl+X`/`Ctrl+V` σε **TSV** — τη
  μορφή που βάζουν στο πρόχειρο Excel/Sheets/Calc/Numbers, άρα **αμφίδρομη** μεταφορά με το
  Excel χωρίς κανέναν μετατροπέα. `Delete` αδειάζει **ολόκληρη** την περιοχή.
  · 🔴 **Το `Ctrl+A` διέψευσε την πρώτη σχεδίαση**: η «επιλογή όλων» αφήνει το ενεργό κελί όπου
    ήταν, άρα η περιοχή **δεν έχει** το ενεργό κελί σε καμία γωνία της ⇒ **δύο δικές της
    γωνίες**, ανεξάρτητες από τη θέση του δρομέα (§26.4).
  · 🔴 **ΕΝΑ undo με ΜΗΔΕΝ νέα μηχανική** (§26.6): το `setPersistedCellText` είναι καθαρό, οπότε
    Ν εγγραφές γίνονται στη μνήμη και φτάνουν ως **ένα** μοντέλο → **ένα** `UpdateEntityCommand`,
    στην **ίδια** διαδρομή commit με τη μονή επεξεργασία. Η υποδομή `CompositeCommand` **δεν
    χρειάστηκε** — η ατομικότητα βγήκε από την καθαρότητα.
  · 🔴 **Το πρόχειρο δεν περνά από πλήκτρα** (§26.7): φυσικά συμβάντα `copy`/`cut`/`paste`. Σε
    **ελληνική διάταξη** το `Ctrl+C` έχει `key: 'ψ'` — έλεγχος χαρακτήρα θα δούλευε μόνο σε
    λατινική. Το `Ctrl+A`, που **είναι** πλήκτρο, ελέγχεται με `code === 'KeyA'`.
  · **Το κλικ είναι παθητικός ακροατής** (§26.9): καμία `preventDefault`, μηδέν άγγιγμα στο
    `CanvasSection` (ADR-040). Ο δρομέας επιβιώνει χάρη στην **ένα-καρέ** αναβολή του φύλακα blur.
  · **Νέο SSoT** `lib/spreadsheet/tsv.ts` (registry `spreadsheet-tsv`) — quote-aware κατά RFC 4180
    με στηλοθέτη· αφελές σπάσιμο στον στηλοθέτη **μετατοπίζει κάθε επόμενη στήλη** σε κελί που
    περιέχει στηλοθέτη ή αλλαγή γραμμής. ⚠️ Δύο **line-based** CSV splitters του repo είναι δομικά
    ανίκανοι γι' αυτό — **καταγράφηκαν** στο `pending-ratchet-work.md`, δεν ενοποιήθηκαν.
  · **Ελάττωμα που βρήκε test** (§26.11): «γράψε κενό σε **απόν** κελί» γεννούσε φάντασμα εγγραφή
    ⇒ βήμα undo για το τίποτα + φούσκωμα. Η εγγύηση ταυτότητας επεκτάθηκε στο απόν κελί.
  · **jscpd**: βρήκε **2 δίδυμα που γεννήθηκαν σε αυτό το commit** (τρίτη διαδρομή 4 γωνιών·
    `onCopy`/`onCut`) — και τα δύο εξαλείφθηκαν πριν το «done». Τελικό: **καθαρό, 21 αρχεία**.
  · **603 tests πράσινα** στο δίχτυ πίνακα + **1.477** στο ευρύτερο· **mutation 11/12** (το 12ο
    ισοδύναμο, κλειδωμένο με test).
  · 🔴 **ΚΑΜΙΑ ζωντανή επαλήθευση** (§26.13): η επέκταση Chrome δεν ήταν συνδεδεμένη. Έξι
    συγκεκριμένα σημεία εκκρεμούν, απαριθμημένα.

- **2026-08-02** — **Φ.Δ βήμα 8, σκέλος απόδοσης: ΤΟ ΚΕΙΜΕΝΟ ΓΕΡΝΕΙ ΜΕ ΤΟΝ ΠΙΝΑΚΑ.**
  Ο πίνακας με `angleRad = 0,35` (≈20°) ζωγραφιζόταν γερμένος — πλέγμα, γεμίσματα, δρομέας,
  ζώνες, όλα περνούσαν από το `toScreen`. Τα **γράμματα** έμεναν **ίσια στην οθόνη**, γιατί
  στον ζωγράφο δεν υπήρχε καμία `ctx.rotate`. 🔴 **Δεν ήταν τεκμηριωμένη επιλογή — ήταν
  ασυμφωνία**: τέσσερις μηχανές απαντούν στην ίδια ερώτηση και **τρεις** συμφωνούσαν —
  εξαγωγή DXF (`rot = 20,053523°`, διαβασμένο από το αρχείο, και στα τρία `halign`), εξαγωγή
  PDF, και ο επεξεργαστής κελιού (`rotate(-0.35rad)`). Ο καμβάς ήταν ο **ένας** που διαφωνούσε,
  και το επιχείρημα του exporter («αλλιώς το κείμενο βγαίνει έξω από το κελί του») ισχύει
  **ακριβώς το ίδιο** στην οθόνη.
  · **Ένας σταμπαδόρος**: `stampFrameText` — τον καλούν **και** τα κείμενα κελιών (`stampRun`)
    **και** οι ετικέτες των ζωνών `A B C` / `1 2 3`. Το `stamp-table-indicator.ts` είχε γράψει
    μόνο του, μήνες πριν, «ό,τι κι αν αποφασιστεί κάποτε για την περιστροφή κειμένου, θα
    αποφασιστεί σε **ένα** σημείο και θα ισχύσει και για τα δύο» — **αυτό ακριβώς έγινε.**
  · **Η γωνία δεν είναι παράμετρος, είναι παράγωγο**: `frameScreenAngleRad(toScreen)` προβάλλει
    δύο σημεία του άξονα `+u` και μετρά τη διεύθυνσή τους **στην οθόνη**. ⚠️ **ΜΗΝ** πάρεις το
    `entity.angleRad`: είναι γωνία **κόσμου** και ανάμεσα παρεμβάλλεται η **αναστροφή του άξονα
    y** ⇒ αντίστροφο πρόσημο (ο επεξεργαστής κελιού πλήρωσε ήδη αυτόν τον λογαριασμό με το χέρι).
    Το `toScreen` **ήδη** κατέχει περιστροφή+κλίμακα+αναστροφή ⇒ το πρόσημο βγαίνει σωστό μόνο του.
    Εκφυλισμένη προβολή ⇒ `atan2(0,0) = 0` = «καμία στροφή», **όχι** `NaN`.
  · **Εργοστάσιο, όχι κυριολεκτικό αντικείμενο**: `createStampTableContext` υπολογίζει τη γωνία
    **μία φορά ανά καρέ**. Αν την υπολόγιζε ο `stampFrameText`, ένας πίνακας 500 γραμμών θα
    πλήρωνε **2.000 περιττές προβολές ανά καρέ** — ακριβώς το σχήμα που ο **ADR-735** πλήρωσε
    σε παραγωγή. Ο ζωγράφος **δεν ξέρει** τη γωνία, άρα δεν μπορεί να αποκλίνει από την προβολή.
  · **Μετάθεση πρώτα, στροφή μετά** — αλλιώς το κείμενο εκτοξεύεται κατά `|anchor| · sin(γωνία)` px.
  · **Απορρίφθηκε** το «οι ζώνες είναι διεπαφή, ας μένουν ίσιες»: τα **ορθογώνιά** τους ήδη
    γέρνουν, και ίσιο γράμμα σε γερμένο κουτί **δραπετεύει από το κουτί του**.
  · **ΔΕΝ «ορθώνει» ανάποδο κείμενο** (>90°): ούτε η οθόνη ούτε ο exporter το κάνουν, και
    διόρθωση **μόνο** εδώ θα ξαναγεννούσε την ίδια ασυμφωνία. Αν χρειαστεί, ο κανόνας ανήκει
    στη **διάταξη** (κοινή σε ζωγράφο και exporter), όχι στο μελάνι.
  · 34 tests πράσινα (`stamp-table-layout`, `stamp-table-indicator`, **νέο** `table-rotated-text`).

- **2026-08-01** — **Φ.Δ βήμα 7: ΓΡΑΜΜΗ ΤΥΠΩΝ (fx) + ΑΝΑΦΟΡΑ ΚΕΛΙΟΥ + ΔΕΙΚΤΗΣ ΠΙΝΑΚΑ**
  (νέο §25). Το βήμα 6 έδωσε «βλέπω όλο το κείμενο **μέσα** στο κελί»· μένουν δύο κενά που ο
  in-cell επεξεργαστής δεν μπορεί να καλύψει: **ανάγνωση χωρίς γραφή**, και **τύπος μαζί με
  αποτέλεσμα** — το δεύτερο είναι η **προϋπόθεση του Φ.Δ.11** (§25.1). 🔴 **Το εύρημα της
  έρευνας άλλαξε τη σχεδίαση**: το Excel έχει γραμμή τύπων αλλά **δεν έχει στραμμένο πλέγμα**·
  το AutoCAD έχει `TABLEINDICATOR` (γράμματα/αριθμοί γύρω από τον πίνακα, μόνο κατά την
  επεξεργασία, ποτέ στην εκτύπωση) αλλά **δεν έχει γραμμή τύπων** — ο ΝΕΣΤΩΡ παίρνει **και τα
  δύο** (§25.2). Αποφάσεις Giorgio πριν τον κώδικα: **αγκυρωμένα στον πίνακα**, όχι λωρίδα
  σελίδας, με ρητό όρο «**ο πίνακας να μην μετακινείται καθόλου**»· ορατά μόνο μέσα στον
  πίνακα· ονομασία **`A1` + κείμενο κεφαλίδας** (`B3 · Περιγραφή`)· **γράφεται** μέσα της
  (§25.3). Η πρώτη απόφαση απαγορεύει δομικά τη λωρίδα ροής: θα κόνταινε τον καμβά ⇒ resize ⇒
  το κελί θα έφευγε κάτω από το ποντίκι στο ίδιο το διπλό κλικ (§25.4). 🔴 **Το `A1` δεν είναι
  δάνειο από φύλλο υπολογισμού**: το επιβάλλουν τρία πράγματα — ο `fast-formula-parser` (§9.2),
  τα `=Sum(A1:A5)` του `ACAD_TABLE`, και ο ίδιος ο in-place επεξεργαστής του AutoCAD· και η
  εναλλακτική «όνομα στήλης + αριθμός» είναι **δομικά αδύνατη ως ταυτότητα**, αφού ο
  `TableColumn` δεν έχει πεδίο ονόματος (§25.5). **Πού ξεπερνάμε τους μεγάλους**: δείχνουμε
  ταυτότητα **και** κεφαλίδα (κανείς δεν δείχνει και τα δύο) και λέμε το **εύρος** σε
  συγχωνευμένο, αντί για τη σκέτη άγκυρα του Excel. 🔴 **Ο κίνδυνος του βήματος ήταν ένας**:
  δεύτερο πεδίο κειμένου σημαίνει ότι το παλιό κριτήριο εξόδου ικανοποιείται **αμέσως** — η
  γραμμή τύπων θα σκότωνε τη συνεδρία τη στιγμή που την πατάς, λύνοντας το modal scope των **43**
  listeners. Λύθηκε σε **ένα** αρχείο (`table-cell-session-focus.ts`) με το σημάδι να αλλάζει
  σημασία σε «ανήκω στη συνεδρία» και με `relatedTarget`· και — το ουσιώδες — **καμία δέσμευση
  όταν η εστίαση μετακινείται μέσα στη συνεδρία**, αλλιώς ο φρουρός «μία φορά» θα κλείδωνε και
  ό,τι γραφόταν μετά δεν θα δεσμευόταν **ποτέ** (§25.6). Το πρόχειρο **δεν διπλασιάστηκε**:
  ζει στον δρομέα από το βήμα 2 — μηδέν συγχρονισμός, γιατί μηδέν δεύτερη κατάσταση. **SSoT
  audit** (§25.7): καμία ονοματολογία `A1` στον viewer, αλλά **πέντε** αντίγραφα αλλού στο repo
  — δύο **byte-ταυτόσημα** στο `report-engine` (κεντρικοποιήθηκαν, N.0.2, μαζί με δεύτερο
  διπλότυπο `getExcelFormat` που ανακαλύφθηκε από το jscpd) και τρία στο `systems/guides/` που
  **ρητά ΔΕΝ ενοποιήθηκαν**: είναι ετικέτες δομικού κανάβου, ομώνυμα και όχι συνώνυμα — κοινή
  συνάρτηση θα άφηνε μια αλλαγή προτύπου κανάβου να αλλάξει σιωπηλά τους **τύπους**. 🔴 **Το
  αναποδογύρισμα το βρήκε ΜΟΝΟ ο browser** (§25.9): με τον πίνακα κοντά στο πάνω χείλος η
  γραμμή κάθισε πάνω στις κορδέλες — έγκυρη θέση μέσα στο **παράθυρο**, εκτός **καμβά**· πάει
  κάτω από τον πίνακα, όπως κάθε tooltip. **116 suites / 1.358 tests / 21 snapshots**, **7/7
  μεταλλάξεις**, jscpd καθαρό, 102 golden regex. **Ζωντανά**: δύο πεδία με **ίδιο** πρόχειρο,
  `B2 · Περιγραφή`, ζώνες `1..5` / `A B C` με φωτισμένο το τρέχον, **ο πίνακας δεν κουνήθηκε**,
  ο δρομέας **επιβίωσε** της εστίασης στη γραμμή, πληκτρολόγηση στη γραμμή φάνηκε **ταυτόχρονα**
  στο κελί, και — κλείνοντας ανεπαλήθευτο του βήματος 6 — **`Enter` και `Tab` έφτασαν ζωντανά**
  (§25.11). Δοκιμαστικά δεδομένα σβήστηκαν και επιβεβαιώθηκαν **μετά από reload**. Μένουν
  δηλωμένα ανοιχτά: στοίχιση/περιστροφή και εξαγωγή σε αρχείο, και τα δύο χρειάζονται **άδεια**
  (§25.12).

- **2026-08-01** — **Φ.Δ βήμα 6: Ο ΕΠΕΞΕΡΓΑΣΤΗΣ ΕΠΕΚΤΕΙΝΕΤΑΙ ΠΕΡΑ ΑΠΟ ΤΟ ΚΕΛΙ** (νέο §24). Το
  βήμα 5 δημιούργησε κατάσταση όπου ο χρήστης **βλέπει λιγότερα απ' όσα έγραψε**· ο επεξεργαστής
  ήταν κολλημένος στο πλάτος του κελιού και το σκρολάρισμα γινόταν στα τυφλά. 🔴 **Το SSoT audit
  βρήκε ότι κανένα auto-grow πεδίο δεν υπάρχει στο repo** (`grep` σε όλο το `src/`) — άρα το βήμα 6
  γράφει τον πρώτο, και ακριβώς γι' αυτό δεν επιτρεπόταν να γεννήσει δεύτερη μηχανή μέτρησης ή
  κουτιού (§24.4). Αποφάσεις Giorgio πριν τον κώδικα: επέκταση **και στην είσοδο** σε κελί που ήδη
  κρύβει (πάνω από το Excel), **η στοίχιση ως άγκυρα** (Excel + Figma auto-width), **οριζόντια μέχρι
  την άκρη και μετά δεύτερη γραμμή** (πλήρες Excel), και **και οι τρεις** ενδείξεις — περίγραμμα,
  δείκτης ορίου, σκίαση (§24.3). ⚠️ Η τρίτη απόφαση **επέβαλε `<input>` → `<textarea>`**· είχε
  επισημανθεί ως το μεγαλύτερο σκέλος και επιλέχθηκε ρητά. 🔴 **Η αλλαγή στοιχείου δεν έσπασε τίποτα,
  με απόδειξη**: η ιδιοκτησία πλήκτρων του Φ.Δ.4 στηρίζεται σε `isTextEntryTarget`, που καλύπτει
  `TEXTAREA` στην ίδια γραμμή· και η κατακόρυφη γεωμετρία του Φ.Δ.3 **επιβιώνει αλγεβρικά** — με
  `line-height` ίσο με το content box, ο τύπος του `<textarea>` **ταυτίζεται** με του `<input>`
  (§24.6), άρα **μηδέν νούμερο άλλαξε**. Χρειάστηκαν όμως δύο ρητές αρνήσεις, ίδιας κατηγορίας:
  `Alt+Enter` (νέα πρόθεση `suppress`) και **ισοπέδωση επικολλημένων αλλαγών γραμμής** — αδράνειες
  που ήταν δωρεάν με `<input>` και γίνονται **σφάλμα δεδομένων** με `<textarea>`, αφού το
  `TableCell.value` είναι απλό `string`. **Νέο, που δεν το κάνει κανείς** (§24.5): η **ζώνη
  εκτύπωσης** — γραμμή κοπής + σκίαση του μη-εκτυπώσιμου, σε **τρεις στρώσεις gradient πάνω στο ίδιο
  στοιχείο**, ώστε ο μηχανικός να βλέπει **τι θα τυπωθεί** ενώ γράφει· Excel/Sheets/AutoCAD δεν το
  δίνουν γιατί εκεί η οθόνη *είναι* το παραδοτέο. **Απόδοση μετρημένη, όχι υποσχεμένη** (§24.7): το
  `projectBox()` τρέχει ανά καρέ, και το πλάτος μετριέται **ως αναλογία στα 200 px** ⇒ **0,00
  `measureText` ανά καρέ** χωρίς αναδίπλωση, **0,85** με αναδίπλωση, **1** ανά πάτημα πλήκτρου
  (έναντι ~23/καρέ χωρίς κανονικοποίηση). SSoT: η **προτίμηση λέξης** μετακόμισε από το
  `text-layout.ts` στο `text-fit.ts` (δεύτερος καταναλωτής) και το ίδιο το CHECK 3.28 **έπιασε δικό
  μου κλώνο** μέσα στο `text-fit.ts`, που εξήχθη σε `trivialFit`. **1.218 tests / 102 suites**
  πράσινα (από 1.179/99), **20/20 snapshots**, **9/9 μεταλλάξεις**, jscpd καθαρό. Ζωντανά με
  **πλήρες reload**: κελί 40 mm **430,4 → 706,7 px** με ζώνη εκτύπωσης **375,0 px**, συγχωνευμένο
  κελί **116,6 → 215,5 px** (δεύτερη γραμμή), επιστροφή στα **430,4 px** όταν αδειάσει, και είσοδος
  σε **δεσμευμένο** περικομμένο κελί που ανοίγει **ήδη επεκτεταμένη** ενώ ο καμβάς ζωγραφίζει
  «…» (§24.11). ⚠️ **ΔΕΝ** επαληθεύτηκαν ζωντανά **δεξιά/κεντρική στοίχιση** και **στραμμένος
  πίνακας** — και οι δύο πίνακες της σκηνής είναι `angleRad = 0` με αριστερή στοίχιση, και η αλλαγή
  τους θα ήταν μεταβολή της σκηνής χωρίς εντολή (§24.12).

- **2026-08-01** — **Φ.Δ βήμα 5: ΠΕΡΙΚΟΠΗ ΚΕΙΜΕΝΟΥ ΚΕΛΙΟΥ** (νέο §23). Το grep επιβεβαίωσε
  **μηδέν** λογική περικοπής σε ολόκληρο τον viewer: το κείμενο ζωγραφιζόταν πάνω από τα
  περιγράμματα και στα τέσσερα backends. 🔴 **Το εύρημα που άλλαξε τη σχεδίαση**: τα «τέσσερα
  backends» είναι **ένα σημείο** — και τα τέσσερα διαβάζουν το `TableCellLayout.text`, που γεννιέται
  μία φορά στο `placeText`. Ο κανόνας μπήκε **εκεί** και οι τέσσερις τον **κληρονομούν δομικά**:
  μηδέν αλλαγή σε backend, και ένα μελλοντικό πέμπτο τον παίρνει χωρίς να το ξέρει (§23.2).
  Αποφάσεις Giorgio πριν τον κώδικα: **περικοπή** (όχι ξεχείλισμα Excel — σε DXF το ξεχειλισμένο
  κείμενο δεν ανήκει σε κανένα κελί και το native `ACAD_TABLE` δεν το εκφράζει), **ρυθμιζόμενη ανά
  στήλη/κελί** (υποδοχή τώρα, προς full parity Excel), **«…» σε κείμενο και «###» σε αριθμούς**
  (κομμένος αριθμός = σφάλμα **ΤΙΜΗΣ**, όχι εμφάνισης), **κατακόρυφα τίποτα** (§23.4). SSoT: το
  `text-box.ts` **δεν** ήταν η απάντηση· ο χαρακτηρο-επίπεδος χάρακας της αναδίπλωσης MTEXT εξήχθη σε
  `bim/text/text-fit.ts` και τον μοιράζονται πλέον αναδίπλωση **και** περικοπή — με ρητά
  **διαφορετική πολιτική** (λέξη vs χαρακτήρας, §23.5). Ρητή απόφαση ότι ο κανόνας ρωτά τον μετρητή
  **της διάταξης** και όχι του καμβά, με το χρέος του §21.8 δηλωμένο και **ανέγγιχτο** (§23.6).
  **1.179 tests / 99 suites** πράσινα, **20/20 snapshots** — τα **10 του ADR-622 αμετάβλητα**, άρα
  κανένα υπάρχον κελί φύλλου οπλισμού δεν ξεχείλιζε. **7/7 μεταλλάξεις**, jscpd καθαρό. Ζωντανά με
  **πλήρες reload** και παρεμβολή στο `ctx.fillText`: μοντέλο **111** χαρακτήρες, ζωγραφισμένο **49**
  με «…», `<input>` επεξεργαστή **111** — καμία απώλεια δεδομένων (§23.9). ⚠️ **Δεν** περπατήθηκε
  ζωντανά η εξαγωγή σε αρχείο.

- **2026-08-01** — **Φ.Δ βήμα 4: ΛΕΙΤΟΥΡΓΙΑ EXCEL — αποκοπή πληκτρολογίου** (νέο §22).
  **Κανένα δεύτερο σύστημα scope**: χρησιμοποιήθηκε το `keyboard-scope.ts` (ADR-711) με **μηδέν
  αλλαγές**. Το audit έδειξε ότι το scope μόνο του ήταν σχεδόν no-op — οι listeners που περνούν από
  τον wrapper **ήδη** παραιτούνταν, επειδή το `<input>` του δρομέα είναι μονίμως εστιασμένο (§22.1).
  Μετρήθηκαν **38** εγγραφές keydown (το προηγούμενο grep έβρισκε 36· δύο τυφλά σημεία) και
  ταξινομήθηκαν: από τους **20 ασκέπαστους**, **μόνο 1** έκλεβε πραγματικά πλήκτρο Excel
  (`useCommandHistory`, `Ctrl+Z`/`Ctrl+Y`) — οι υπόλοιποι είναι modifier trackers, debug F-keys,
  3D-only, ένα **ψευδώς θετικό μέσα σε JSDoc σχόλιο**, και ένα φραγμένο popover. Βρέθηκε **και ένας
  εκτός λίστας**: `attach-image-tool` (`Enter`, ADR-736) που άφηνε τον ratchet **κόκκινο στο main**.
  Και οι δύο μετανάστευσαν ⇒ ο ratchet μειώθηκε κατά 2 (§22.2). 🔴 **Γράφοντας το test βρέθηκε
  σφάλμα που κλείδωνε τον viewer**: το `target` ήταν `useMemo` που **διάβαζε τη σκηνή** αλλά δήλωνε
  εξαρτήσεις (`levelManager`, `cursor`) που **δεν αλλάζουν** σε αλλαγή σκηνής — το `getLevelScene`
  είναι `useCallback(…, [])` πάνω σε ref. Σε **undo/διαγραφή/αλλαγή επιπέδου** το overlay έμενε
  μονταρισμένο πάνω σε ανύπαρκτο πίνακα και το modal scope έμενε **πατημένο για πάντα** (§22.4).
  Καμία νέα κατάσταση: το «είμαι μέσα στον πίνακα» **είναι** `cursor !== null` (§22.3). Είσοδοι:
  διπλό κλικ (υπάρχει) + `Enter`/`F2` (WAI-ARIA APG «Grid» + Excel) + εντολή `TABLEDIT`/`TE`
  (AutoCAD) — η τελευταία χρειάστηκε **δεύτερο μητρώο** για εντολές που δεν οπλίζουν εργαλείο, με
  test **μηδενικής τομής** ονομάτων ως τίμημα (§22.7). Ένδειξη: γραμμή κατάστασης «Πίνακας ·
  κατάσταση · Esc για έξοδο» (τρίτο αδελφάκι ομάδας/μπλοκ) + **διακεκομμένο** περίγραμμα σε όλο τον
  πίνακα — ίδιο χρώμα, άλλη τάξη. `Ctrl+Z` πήρε σημασιολογία **Excel** και η προηγούμενη απόφαση
  **αντιστράφηκε ρητά**, με έλεγχο στο `event.code` για την **ελληνική διάταξη** (§22.8).
  🔴 **Και δεύτερο σφάλμα, που το βρήκε ΜΟΝΟ ο browser**: το `F2` ως **είσοδος** άνοιγε τον
  επεξεργαστή με **κενό** πρόχειρο ⇒ το επόμενο `Tab`/`Enter` έκανε `commit('')` πάνω στο κελί
  τίτλου — **απώλεια δεδομένων από πάτημα πλοήγησης**. Κάθε συστατικό ήταν σωστό μόνο του· έλειπε ο
  σπόρος στην είσοδο, γιατί εκεί δεν υπάρχει ακόμη επεξεργαστής να τον σπείρει (§22.10).
  **676/676 tests**, **7/7 μεταλλάξεις**, jscpd καθαρό. Ζωντανά με πλήρες reload: το `L` μέσα στον
  πίνακα **δεν** όπλισε εργαλείο και **δεν** άνοιξε τη γραμμή εντολών — μπήκε στο κελί. Έρευνα:
  APG / Excel (4 καταστάσεις — η **Point** καταγράφηκε για τη Φ.Δ.11) / AutoCAD /
  **Figma ως αρνητικό πρότυπο** / VS Code (§22.5).

- **2026-08-01** — **Φ.Δ βήμα 3: IN-CELL EDITING — ο κέρσορας μπαίνει ΜΕΣΑ στο κελί** (νέο §21).
  Η αιτία ήταν **δύο σταθερές** (`140 × 24 px`) και, πίσω τους, το δόγμα του ADR-344 «μέγεθος σταθερό
  σε screen-space» — **σωστό για ελεύθερο κείμενο, λάθος για κελί** (§21.1). Το `TextEditorAnchor`
  απέκτησε **προαιρετικό** `projectBox()`: απόν ⇒ η ιστορική συμπεριφορά του MTEXT (2D **και** 3D)
  μένει **ακέραιη**. Το κουτί είναι πλέον **το ίδιο το κελί**: ορθογώνιο, γραμματοσειρά, στοίχιση,
  περιθώρια, χρώματα και **περιστροφή** — όλα παράγωγα της **μίας** διάταξης, ζωντανά σε κάθε zoom
  με **μηδέν re-render** (CSS custom properties γραμμένες επιτακτικά στο ίδιο tick με τη θέση,
  ADR-040). Η γραμμή βάσης μέσα σε `<input>` λύθηκε με **κλειστό τύπο** αντιστροφής του κεντραρίσματος
  (§21.3), όχι με μαγικό αριθμό· το `line-height = content box` κάνει τον τύπο **ανεξάρτητο από τη
  μηχανή**. «Μία μέτρηση, όχι δύο»: ο ζωγράφος και το DOM μοιράζονται **το ίδιο αλφαριθμητικό
  γραμματοσειράς** (`tableCellFont`), άρα ο κέρσορας πέφτει στο γράμμα του κλικ **εξ ορισμού**
  (§21.4). 🔴 **Το audit βρήκε ΔΕΥΤΕΡΗ, αποκλίνουσα προβολή κόσμου→οθόνης**: το
  `text-editor-anchor-2d.ts` έγραφε δικό του `worldToScreen` **χωρίς τους χάρακες** ⇒ σταθερή
  μετατόπιση ≈ 30 px / 23 px, ενώ η **αντίστροφη** διαδρομή του ίδιου editor χρησιμοποιούσε ήδη το
  SSoT· διορθώθηκε — ωφελούνται και οι **τρεις** καταναλωτές (§21.5). Η διπλή ζωγραφική έφυγε με
  παράλειψη **mode-gated** στο overlay pass **συν** αδιαφανές φόντο κελιού (το cached raster δεν
  επιτρέπεται να δεχτεί διαδραστική κατάσταση στο κλειδί του — §21.6). **Ζωντανά (πλήρες reload,
  ανεξάρτητη απόδειξη από τα πίξελ του καμβά)**: κουτί **κεντραρισμένο** στο κελί (Δ = μισό
  περίγραμμα), γραμμή βάσης **529,21 vs 528,68** = **0,53 px σε 34 px γραμματοσειρά (1,5 % em)**,
  zoom ×15,28 ⇒ κουτί ×15,2817 / γραμματοσειρά ×15,2812, κέρσορας στον σωστό χαρακτήρα, **έγγραφο
  αμετάβλητο**. **310/310 tests** στα αγγιγμένα δέντρα (+35 νέα: 19 κουτί · 9 μετρικά · 4 παράλειψη
  · 3+ στόχος), **509/509 anchors**, **6/6 μεταλλάξεις απομονωμένες**, jscpd καθαρό. Ρητά **εκτός**
  (§21.9): επέκταση πέρα από το κελί, περικοπή κειμένου στα 4 backends, γραμμή τύπων / επιλογή
  περιοχής / τύποι.
- **2026-08-01** — **§20.8 ΕΚΛΕΙΣΕ: η κλίμακα σημειώσεων παύει να μαντεύεται σιωπηλά.** Ο πίνακας
  μετρήθηκε ζωντανά **599,85 m** (όχι 650 — δύο ανεξάρτητοι δρόμοι, συμφωνία 0,03 %) με
  `drawingScale = 5000` διαβασμένο **από το ίδιο το widget**. Η αιτία **δεν είναι ο πίνακας**: ο
  αυτόματος υπολογισμός επέλεγε 1:N ώστε να χωρέσει η **ένωση κάθε οντότητας** σε ένα A3, και η
  κατανομή είναι **διτροπική** (90 % της γεωμετρίας σε 228×106 m, ουρές ως τα 1,9 km) — ερώτημα
  χωρίς χρήσιμη απάντηση. Έρευνα σε AutoCAD/Revit/ArchiCAD/Vectorworks: **κανείς δεν παράγει την
  κλίμακα σημειώσεων από την έκταση περιεχομένου**. **Απόφαση Giorgio**: «να μαντεύει, αλλά ο
  χρήστης να μπορεί να την αλλάζει» ⇒ (1) το `drawingScaleUserSet` γίνεται **persisted** — ήταν
  σημαία μόνο-συνεδρίας, οπότε η εγγύηση του ίδιου του σχολίου του έπαυε να ισχύει σε κάθε reload·
  (2) νέο `computeAutoDrawingScale` με ταβάνι **παράγωγο** από το `DRAWING_SCALE_PRESETS` που
  επιστρέφει `null` (= «καμία γνώμη», **υπάρχον** συμβόλαιο ⇒ μηδέν αλλαγές σε καλούντες) όταν η
  έκταση είναι οικοπέδου και όχι σχεδίου· το **ρητό** κουμπί «Αυτόματη προσαρμογή» μένει
  **χωρίς** ταβάνι. **Καλύπτει και το κείμενο** (12,5 m -> 25 cm) και κάθε σημείωση στο
  `paperHeightToModel`. Καμία αλλαγή μοντέλου, καμία migration. **1580/1580 tests** (101 suites),
  509/509 anchors, **4/4 μεταλλάξεις απομονωμένες**, jscpd καθαρό. Ζωντανά: **600 m -> 12,25 m
  μετρημένα**, έγγραφο Firestore αμετάβλητο. Ανοιχτά (§20.8 τέλος): μιξαρισμένο επίπεδο θέλει (γ)
  φύλλα/viewports· υπάρχοντα επίπεδα με 1:5000 δεν αγγίζονται· το **δεύτερο** σύστημα κλίμακας
  (`ViewportStore` + `annotationScales`, ADR-344 Φ11) εντοπίστηκε ζωντανό αλλά **δεν** ενοποιήθηκε.
- **2026-08-01** — **Φ.Δ βήμα 2 (συνέχεια): ΠΛΟΗΓΗΣΗ ΚΕΛΙΩΝ ΣΑΝ EXCEL** (νέο §20). Ο πίνακας
  αποκτά **δρομέα κελιού** με τις τρεις καταστάσεις του Excel (Ready/Enter/Edit), Tab/Shift+Tab με
  αναδίπλωση γραμμής, Enter/Shift+Enter με τον κανόνα της **στήλης αγκύρωσης**, βέλη,
  Home/End/Ctrl+Home/Ctrl+End κατά WAI-ARIA APG, **type-to-replace** και F2 («διπλό F2»).
  4 νέα modules (καθαρή πλοήγηση με merge-awareness, σημασιολογία πλήκτρων, store δρομέα, ζωγράφος
  δρομέα) + 3 νέα test suites. **Η ιδιοκτησία πλήκτρων λύθηκε δομικά με ΜΗΔΕΝ γραμμές** στο
  `keyboard-scope.ts`: το τρέχον κελί **είναι** εστιασμένο `<input>`, άρα και οι 43 global listeners
  παραιτούνται μέσω του υπάρχοντος `shouldGlobalShortcutYield` (αρχιτεκτονική Google Sheets).
  **Μετρημένο ελάττωμα που βρέθηκε στον browser και διορθώθηκε** (§20.6): το πρόχειρο ήταν
  `useState` και **χανόταν διαλείπουσα** όταν ασύγχρονη ανανέωση σκηνής ξαναέστηνε τον επεξεργαστή
  — μεταφέρθηκε στον δρομέα, όπου το ξαναστήσιμο είναι αβλαβές. 603/603 tests, 509/509 anchors,
  **14/14 μεταλλάξεις**, jscpd καθαρό (εξήχθη το `indexById` μετά από CHECK 3.28).
  Άνοιξε τότε το §20.8 («ο πίνακας γεννιέται τεράστιος»): η αλυσίδα μετρήθηκε ολόκληρη και είναι
  **αριθμητικά σωστή** (σκηνή 1915 m -> auto fit-to-A3 -> `drawingScale = 5000` -> 120 sheet-mm =
  600 m). Το ελάττωμα είναι **δομικό και όχι του πίνακα**: μία καθολική κλίμακα σημειώσεων ανά
  επίπεδο, αυτόματα προσαρμοσμένη στην έκταση ΟΛΗΣ της σκηνής, δεν μπορεί να εξυπηρετήσει επίπεδο
  που μιξάρει τοπογραφικό 1,9 km με κάτοψη κτιρίου — ισχύει εξίσου για το κείμενο. Τρεις υποψήφιες
  λύσεις καταγράφηκαν· καμία δεν υλοποιήθηκε τότε. **➡️ ΕΚΛΕΙΣΕ την ίδια μέρα** — δες την επόμενη
  (πιο πρόσφατη) εγγραφή· η λύση που εφαρμόστηκε **δεν** ήταν καμία από τις τρεις.
- **2026-07-31** — Δημιουργία. Έρευνα αγοράς (AutoCAD/Revit/ArchiCAD/Vectorworks/Figma/C4D) +
  SSoT audit του υπάρχοντος κώδικα (3 μηχανές πίνακα, ~75% υποδομής) + αρχιτεκτονικό blueprint
  (ΕΝΑ `table` entity, 3 binding modes, 4 backends) + roadmap 9 φάσεων. **Κρίσιμα ευρήματα**:
  (α) το Revit **δεν έχει** εργαλείο πίνακα — υπαρκτό κενό αγοράς· (β) κανείς δεν συνδυάζει
  γενικό πίνακα με αμφίδρομο δεσμό μοντέλου· (γ) **HyperFormula = GPLv3, απαγορευμένο (N.5)**.
  Καμία αλλαγή κώδικα.
- **2026-07-31 (β)** — **Οι 5 αποφάσεις ελήφθησαν** (§14): πλήρες εύρος Α–Θ σταδιακά · `live`
  write-back σε δική του φάση · 3Δ **Α+Β+Γ** · **`fast-formula-parser` (MIT)** με επαληθευμένη
  αλυσίδα αδειών (chevrotain Apache-2.0 · jstat MIT · bessel Apache-2.0 · bahttext MIT) πίσω από
  adapter · TEK `decompose`. **Απορρίφθηκε `@sheetxl/formulas`** — δηλώνει `SEE LICENSE IN
  <LICENSE>`, μη τυποποιημένη άδεια (N.5: ασαφής άδεια → ρώτα, μην εισάγεις). Νέο §7.1:
  διόρθωση της διατύπωσης «PC χωρίς GPU» — **δεν υπάρχει σύγχρονο PC χωρίς GPU**· οι τρεις
  πραγματικές καταστάσεις είναι integrated / discrete / **software rendering**, και μόνο η τρίτη
  είναι πραγματικός κίνδυνος ⇒ η απάντηση είναι **ανίχνευση δυνατότητας + σχεδιασμένη
  υποβάθμιση**, όχι απαγόρευση WebGL. Status → ΕΓΚΕΚΡΙΜΕΝΟ ΣΧΕΔΙΟ.
- **2026-07-31 (γ)** — **ΦΑΣΗ Α ΥΛΟΠΟΙΗΘΗΚΕ** (νέο §16). 10 αρχεία + 3 test suites: το μοντέλο
  (`types/table.ts`), η **ΜΙΑ** μηχανή διάταξης σε τρία στάδια (`measure` / `place` / `borders`),
  το `TableStyle` SSoT με 2 presets και το μητρώο του. **Τρεις τεκμηριωμένες αποκλίσεις από το
  §4** (§16.2): (α) το `TableEntity` αναβλήθηκε ρητά για τη **Φ.Γ** — απαιτεί `'table'` στο
  `EntityType`, που πυροδοτεί και τα 9 gates του §12· entity χωρίς απαντημένα gates αφήνει το
  repo κόκκινο· (β) **νέο `TableRow.borderTop`** — το row-class μοντέλο του AutoCAD δομικά δεν
  εκφράζει τη **γραμμή-σύνολο**· (γ) το `TableBorderSpec` μετακινήθηκε στο μοντέλο (ένας ορισμός,
  αποφυγή κύκλου). **Ο χαρακτηρισμός του §12 τραβήχτηκε ΕΔΩ** (§16.3): 10 snapshots και των 6
  καταναλωτών, **mutation-verified 2/2** — ώστε η Φ.Β να ξεκινήσει με το δίχτυ στημένο και το «δεν
  άλλαξε τίποτα» να είναι απόδειξη, όχι ισχυρισμός. Τα δύο αρχεία του ADR-622 **δεν αγγίχτηκαν**.
  Ρητά **δεν** υπόσχεται byte-identical έξοδο το preset `detailSheet` (§16.4): το baseline-relative
  quirk (`y - ROW_H_MM * 0.2`) γεφυρώνεται στη Φ.Β **με μέτρηση**, όχι με εικασία εδώ. Απόδοση από
  τώρα (§16.5): `visibleRowRange` δυαδική (O(log n), το μάθημα του ADR-735) + ένωση ακμών πλέγματος.
  Παράλληλα: prefix `tblstyle` + `generateTableStyleId()` (N.6) · i18n κλειδιά EL+EN **πριν** τον
  κώδικα + `generate:i18n-types` (N.11 / CHECK 3.33) · module `table-layout-engine` στο
  `.ssot-registry.json` (N.12) · `jscpd:diff` καθαρό (N.18).
- **2026-07-31 (δ)** — **ΦΑΣΗ Β ΥΛΟΠΟΙΗΘΗΚΕ** (νέο §17). Το `buildScheduleTable` είναι πλέον
  **thin adapter** πάνω στη μία μηχανή· η δημόσια επιφάνεια αμετάβλητη, και οι 6 καταναλωτές
  ανέγγιχτοι. **Αποτέλεσμα: byte-identical, 10/10 snapshots.** 🔑 **Το κύριο εύρημα (§17.1): το
  «quirk» δεν υπήρχε.** Το `y - ROW_H*0.2` δεν ήταν baseline-relative ιδιοτροπία — ήταν
  **κοντύτερη γραμμή κεφαλίδας (6mm) + κείμενο δεδομένων 1,5mm χαμηλότερα μέσα στη γραμμή του**,
  δύο συνηθισμένες ιδιότητες πίνακα που το μοντέλο ήδη εξέφραζε· ταυτίζεται αλγεβρικά για κάθε
  γραμμή (`7.5N + 2.6`). **Η γενική μηχανή έμεινε ανέπαφη** — κανένα offset, καμία ειδική
  περίπτωση, καμία σημαία συμβατότητας. Η πρόβλεψη του §16.4 («γεφυρώνεται με μέτρηση») ήταν
  σωστή στη μέθοδο και υπερβολικά απαισιόδοξη στο κόστος. **Η μία πραγματική έκπληξη** (§17.3):
  τα footers έβγαιναν 1,5mm χαμηλά, γιατί το `y` του παλιού βρόχου ήταν η **γραμμή περιεχομένου**,
  όχι η ακμή γραμμής — **αυτό δεν θα το έπιανε επιθεώρηση κώδικα· το έπιασε το δίχτυ της Φ.Α**,
  και είναι η δικαίωση της απόφασης να τραβηχτεί ο χαρακτηρισμός νωρίτερα. Νέο
  `table-layout-to-primitives.ts` (§17.4): ο πίνακας απέκτησε **και τα τρία υπάρχοντα backends
  χωρίς νέο ζωγράφο**, με τη σειρά εξόδου (= z-order) ελεγμένη ρητά. **Το `buildFieldBlock` ΔΕΝ
  απορροφήθηκε** (§17.5) — συνειδητή απόφαση εντός του εύρους που ορίζουν §3/§13: είναι
  στοιχισμένη λίστα `label : value`, όχι μηχανή πίνακα. Regression: **1232/1233 suites, 13.987
  tests** ✅ (η 1 αποτυχία, `topo-planimetric-points`, **προϋπάρχει** — επαληθεύτηκε με stash).
- **2026-07-31 (ε)** — **ΦΑΣΗ Γ ΥΛΟΠΟΙΗΘΗΚΕ** (νέο §18). Ο πίνακας είναι **οντότητα σκηνής**:
  `'table'` στο `EntityType` + `RENDERABLE_ENTITY_TYPES`, `TableRenderer` στον κύριο 2D καμβά,
  hit-test/όρια/λαβές/μετακίνηση/περιστροφή/ghost/εξαγωγή. **Και τα 9 gates απαντήθηκαν — 24
  anchor suites / 384 tests πράσινα.** 9 νέα αρχεία + 21 τροποποιημένα. **Τέσσερις τεκμηριωμένες
  αποκλίσεις από το §12** (§18.2): (α) `angleRad` αντί `rotation` — ένα όνομα για όλη την
  οικογένεια σημειώσεων, μονάδα στο όνομα (ADR-716)· (β) **`dxf: 'decompose'` αντί `'native'`** —
  το §12 περιέγραφε την κατάσταση **μετά τη Φ.Ε**· δηλωμένο `native` χωρίς writer = ο πίνακας
  **χάνεται σιωπηλά**, ακριβώς το σφάλμα που ο πίνακας κάλυψης αποτρέπει· το `decompose` το
  απαιτεί ούτως ή άλλως το §10 ως fallback πριν την R2004· (γ) **πρώτο annotation με πραγματικό
  `ROTATE_HANDLERS` entry** — no-op εκεί θα σήμαινε «η εντολή ROTATE δεν κάνει τίποτα» σε
  προφανώς περιστρεφόμενο αντικείμενο· (δ) **ρητό 2D ghost branch** — το «ghost: όχι» του §12
  αφορά το `placementGhost3D` (που όντως είναι `false`), άλλο seam. **Ο πίνακας είναι
  annotative** (§18.3): μία γέφυρα, το `paperHeightToModel`· η μνήμη διάταξης **δεν** κλειδώνεται
  στην κλίμακα, γι' αυτό το zoom και η αλλαγή 1:100→1:50 δεν ξαναϋπολογίζουν τίποτα. Απόδοση
  (§18.4): διάταξη ποτέ ανά καρέ (WeakMap με κλειδί την **ταυτότητα** του μοντέλου ⇒ μηδέν
  χειροκίνητο `invalidate()`)· ορατές γραμμές **και** περιγράμματα δυαδικά (τα `borders` είναι
  μεικτά, χρειάστηκαν δικό τους ευρετήριο)· παράθυρο από αντιστροφή των 4 γωνιών του καμβά (απλή
  σύγκριση `y` θα έκοβε γραμμές σε στραμμένο πίνακα)· **λαβές O(στήλες), ΟΧΙ O(γραμμών)** — 500
  λαβές ανά καρέ είναι το σχήμα που πλήρωσε ο ADR-735. **Ρητά εκτός** (§18.5): σειριοποίηση
  (`model.cells` = `Map` ⇒ ⚠️ **μέχρι τη Φ.Δ ο πίνακας δεν επιβιώνει reload**), εργαλείο/επεξεργαστής,
  `SCALE` (είναι σημασιολογία επεξεργασίας, όχι γεωμετρικός μετασχηματισμός), table breaking,
  `ACAD_TABLE`. Έλεγχοι (§18.6): 92/92 unit · **5/5 μεταλλάξεις σκοτωμένες** · 284+1.229 suites
  regression · jscpd καθαρό · i18n 30.114/30.114 (**κανένα νέο κλειδί — το UI είναι Φ.Δ**) ·
  N.7.1 max 247 γρ. 🔴 **Η μετάλλαξη που επέζησε στην 1η εκτέλεση**: η μετατροπή ανοχής
  hit-test σε sheet-mm ήταν αδοκίμαστη γιατί **όλα τα tests έτρεχαν σε 1:1, όπου είναι
  ταυτοτική** ⇒ **test σε ουδέτερη κλίμακα δεν ελέγχει την κλίμακα**. Κλείστηκε με ρητό test 1:100.
- **2026-07-31 (στ)** — **ΦΑΣΗ Δ ΒΗΜΑ 1** (νέο §19· §13 Φ.Δ → «βήμα 1 ✅ / βήματα 2-4
  ανοιχτά»· **διορθώθηκε το §18.5**, που εξακολουθούσε να λέει «μέχρι τη Φ.Δ ο πίνακας δεν
  επιβιώνει reload» ενώ **επιβιώνει**). Το εύρημα σε μία πρόταση: **ο πίνακας χανόταν
  σιωπηλά σε τρεις —όχι πέντε— γενικούς μηχανισμούς** (αποθήκευση σκηνής
  `dxf-firestore-storage.impl.ts:169` · `UpdateEntityCommand.ts:38` ·
  `DeleteEntityCommand.ts:169,301`, όλοι μέσω `deepClone = JSON.parse(JSON.stringify())`),
  επειδή το `TableEntity.model` κρατούσε `Map`. **Λύση Α**: το `model` έγινε
  `PersistedTableModel` (κελιά ως ακολουθία τριάδων, **ντετερμινιστική** σειρά γραμμής→στήλης
  ώστε να μην παράγονται ψευδείς αλλαγές που πυροδοτούν auto-save)· ο `TableModel` με τον
  `Map` **δεν άλλαξε ούτε ένα byte** και παράγεται lazy από `resolveTableModel` (`WeakMap`) —
  η αλυσίδα `persisted → model → layout` κρατά, άρα το «διάταξη ποτέ ανά καρέ» (§6) ισχύει
  ακέραιο και **καμία `invalidate()`** δεν χρειάζεται (η ταυτότητα ΕΙΝΑΙ η έκδοση). **Η
  διόρθωση του «5→3» δεν είναι λεπτομέρεια**: το πρόχειρο κλωνοποιεί με `structuredClone`
  (διατηρεί τον `Map`) και το `EntityPass.getCacheKey` είναι νεκρός κώδικας **και** cache key,
  όχι αποθήκευση — ένας φουσκωμένος αριθμός θα έστελνε τον επόμενο να κυνηγήσει σφάλμα που
  δεν υπάρχει ή να «διορθώσει» το πρόχειρο σε JSON και να **δημιουργήσει** το σφάλμα. **Δύο
  φρουροί** (§19.4): τύπος `JsonSafe<T>` (`types/json-safe-entity.ts`) + ζωντανό test πάνω σε
  ΟΛΟ το `RENDERABLE_ENTITY_TYPES` (125 tests) που δείχνει το **μονοπάτι** του ενόχου· ⚠️ ο
  πρώτος **δεν** έχει επαληθευτεί με `tsc` (N.17 + subapp εκτός root tsconfig ⇒ μόνο CHECK
  3.29 στο CI). **Εργαλείο** (§19.5): 1 κλικ = **πάνω-αριστερή γωνία** (σύμβαση `ACAD_TABLE`
  — ο πίνακας μεγαλώνει κάτω-δεξιά· άγκυρα στο κέντρο θα τον μετακινούσε σε κάθε νέα γραμμή,
  σε αντίθεση με το `opening-info-tag`), **ένα** mapping για ghost+commit καρφωμένο με
  ταυτότητα αντικειμένου, 4 σπαρμένα κελιά από τα 15, **φράγμα** `NaN`/`Infinity` με μία
  υλοποίηση σε δύο πόρτες (store + `resolveShape`) και όρια βγαλμένα από το χαρτί (256 στήλες
  ≈ A0). 🔴 **Μονάδες** (§19.6): 120×40 sheet-mm ⇒ **12.000×4.000 μονάδες σκηνής στο 1:100**
  — σωστό annotative· **και η ασυμμετρία που κανένα ADR δεν αντιπαρέθετε**: το
  `opening-info-tag.widthMm` είναι **WORLD canonical-mm, ΟΧΙ annotative**
  (`scale-entity-transform.ts:319-322`) ⇒ **διαφορά ×100** μεταξύ δύο αδελφών σημειώσεων με
  το ίδιο επίθημα `Mm`. Καταγράφηκαν **8 γνωστά κατάλοιπα της Φ.Γ** με αρχείο:γραμμή (§19.7)
  — κείμενο που δεν περιστρέφεται, καμία ένδειξη επιλογής, λαβές χωρίς γλυφή, `moveGlyphFrame`
  null (⇒ καμία μετακίνηση με πληκτρολογημένη απόσταση), λαβές σε λάθος μονάδες σε σκηνή σε
  μέτρα, `fontFamily` που χάνεται, καμία περικοπή κειμένου, καμία clearance. Έλεγχοι (§19.8):
  `bim/table` **150** ✅ · roundtrip φρουρός **125** ✅ · capability anchors **25 suites / 509
  tests** ✅ · jscpd καθαρό · i18n 10+10 κλειδιά πριν τον κώδικα. 🔴 **BROWSER VERIFY ΔΕΝ
  ΕΓΙΝΕ** (η επέκταση Chrome δεν συνδεόταν) — κανείς δεν έχει δει πίνακα στην οθόνη· ό,τι
  λέει το §19 για συμπεριφορά είναι συμπέρασμα από κώδικα και tests, όχι παρατήρηση.
- **2026-07-31 (ζ)** — **ΦΑΣΗ Δ ΒΗΜΑ 2 (μέρος) — inline επεξεργαστής κελιού** (νέο §19.9· §13
  Φ.Δ → «βήμα 2 (cell editor) ✅ / βήμα 2 (keyboard nav, TSV/CSV) + βήματα 3-4 ανοιχτά»· §19.7
  ενημερώθηκε — η πρώτη γραμμή έκλεισε, η δεύτερη μένει ανοιχτή). **3 νέα αρχεία**, καθρέφτες
  του υπάρχοντος text-editor ζεύγους (ADR-344 Φ6.E): `bim/table/table-cell-edit-session.ts`
  (καθαρό — `resolveTableCellEditTarget` πάνω στο ΗΔΗ υπάρχον `tableCellAtWorld`/
  `tableFrameToWorld` του Φ.Γ, `buildTableCellEditCommand` πάνω στο ΗΔΗ υπάρχον
  `setPersistedCellText` του βήματος 1 — καμία νέα γνώση γεωμετρίας/σειριοποίησης, N.18),
  `ui/table-cell-editor/useTableCellDoubleClickEditor.ts` (ο 2D ανοιχτήρας· τοπικό state,
  καμία `useSyncExternalStore`, ADR-040 rule 1· commit ξαναδιαβάζει την οντότητα τη στιγμή
  του commit, όχι τη στιγμιότυπη αναφορά του ανοίγματος) και
  `ui/table-cell-editor/TableCellEditorOverlay.tsx` (η όψη — απλό `<input>`, **όχι** το TipTap
  `TextEditorOverlay`: το `TableCell.value` είναι απλό `string`, ένας πλήρης rich-text editor
  θα υποσχόταν μορφοποίηση που κανείς καταναλωτής της διάταξης δεν διαβάζει). Επαναχρησιμοποιεί
  αυτούσιο το κοινό `TextEditorAnchorLayer`/`createTextEditorAnchor2D` — καμία τρίτη υλοποίηση
  αγκύρωσης. Καλωδίωση σε 3 υπάρχοντα αρχεία (`useCanvasSectionUI.ts`, `CanvasSection.tsx` —
  491/500 γραμμές, `CanvasSectionOverlays.tsx`), ελάχιστο diff, κανένα νέο
  `useSyncExternalStore` στον orchestrator. 2 νέα κλειδιά i18n EL+EN πριν τον κώδικα +
  `generate:i18n-types`. Έλεγχοι: `bim/table` **182** ✅ (150 ⇒ +12) · `types` **141** ✅
  (αμετάβλητο) · capability anchors **25 suites / 509 tests** ✅ (αμετάβλητο) · jscpd καθαρό
  στα 6 νέα/τροποποιημένα αρχεία · i18n 30.121/30.121. **Μεταλλάξεις 2/2 επαληθεύτηκαν**: το
  no-op guard και η γωνία αγκύρωσης κοκκίνισαν τα σωστά tests όταν σπάστηκαν, επαναφέρθηκαν
  αμέσως μετά. 🔴 **ΔΕΝ έγιναν**: πλοήγηση πληκτρολογίου, επικόλληση TSV/CSV, λαβή ύψους
  γραμμής, πιο λεπτόκοκκο undo. **BROWSER VERIFY ΔΕΝ ΕΓΙΝΕ** (ίδιος περιορισμός με το §19.8).
- **2026-07-31 (η)** — **BROWSER VERIFY: ΕΓΙΝΕ** (νέο §19.10· §19.8 και §19.9 έπαψαν να λένε
  «δεν επαληθεύτηκε στην οθόνη»). Ο πίνακας παρατηρήθηκε ζωντανά σε σκηνή **σε μέτρα** — τη
  μονάδα που κανένα test δεν είχε ελέγξει, αφού όλα έτρεξαν σε ουδέτερα mm. **Επτά ερωτήματα,
  πέντε απαντήθηκαν** (§19.10): φαίνεται σωστά (α) · κείμενο σωστά στα κελιά (β) · **επιβιώνει
  reload με το περιεχόμενο** — αποδεδειγμένο με **νέα εγγραφή**, όχι με συμπέρασμα (στ) ·
  διπλό κλικ ανοίγει `<input>` στο σωστό κελί και το commit φτάνει στο Firestore (ζ). **Η
  πρόβλεψη «λαβές ×1000 μακριά» ΔΕΝ ίσχυσε** (δ) — πέφτουν πάνω στην ακμή. Επιβεβαιώθηκε το
  ανοιχτό (γ): **μόνο hover, καμία ένδειξη επιλογής**. **Ένα πραγματικό σφάλμα βρέθηκε και
  διορθώθηκε** (§19.10.β): το `phaseColor` έβαφε **και** το γέμισμα **και** το κείμενο, οπότε
  κάθε κελί **με** `fillColorHex` — δηλαδή η γραμμή κεφαλίδων — έχανε τα γράμματά του στο
  hover σε μονόχρωμο πλακάκι. Το κείμενο κρατά πλέον **πάντα** το `run.colorHex`· το χρώμα
  φάσης βάφει τη **σιλουέτα**, ποτέ το μελάνι. Το `stamp-table-layout.ts` είχε **μηδενική**
  κάλυψη — τα 323 tests ελέγχουν τη **διάταξη**, όχι το **μελάνι**, άρα το σφάλμα ήταν
  **δομικά αόρατο**· νέο `__tests__/stamp-table-layout.test.ts` (**6 tests**, κελί με **και**
  χωρίς γέμισμα μαζί — η ασυμμετρία ήταν το αποτύπωμα). Έλεγχοι **329/329** ✅ (323 ⇒ +6) ·
  jscpd ✅ · **μετάλλαξη 1/1** (επαναφορά του `rc.phaseColor ??` → 3 tests κόκκινα) ·
  επαληθεύτηκε **και στην οθόνη**. 📌 **§19.10.α καταγράφει δύο «ευρήματα» που ήταν artifacts
  του browser tool** (πολλαπλά πλήκτρα σε μία κλήση χάνουν το focus· screenshot 1568px vs CSS
  2400px) — **και τα δύο έμοιαζαν με σοβαρά bugs και θα ξαναεμφανιστούν**.
