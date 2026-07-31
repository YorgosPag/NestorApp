# ADR-739 — Σύστημα Πινάκων (Tables) στον 2Δ/3Δ Καμβά — Έρευνα Αγοράς + Αρχιτεκτονικό Blueprint

- **Status**: ✅ **ΥΠΟ ΥΛΟΠΟΙΗΣΗ — Φ.Α/Β/Γ ΚΛΕΙΣΤΕΣ, Φ.Δ ΒΗΜΑ 1 ΚΛΕΙΣΤΟ** (2026-07-31). Οι 5
  αποφάσεις του §14 ελήφθησαν από τον Giorgio. Κάθε φάση κλείνει αυτοτελώς με δικό της κύκλο (§14.1).
  **Φ.Α ✅** Μοντέλο + μηχανή διάταξης + `TableStyle` SSoT + χαρακτηρισμός ADR-622 (§16).
  **Φ.Β ✅** Απορρόφηση ADR-622 — **byte-identical, 10/10 snapshots**, με τη γενική μηχανή
  **ανέπαφη** (§17). **Φ.Γ ✅** Οντότητα σκηνής + απόδοση 2Δ + τα 9 gates του §12 (§18).
  **Φ.Δ βήμα 1 ✅** Σειριοποίηση (Λύση Α — ο πίνακας **επιβιώνει reload/undo/πρόχειρο**) +
  εργαλείο ενός κλικ + WYSIWYG φάντασμα + κουμπί κορδέλας (§19).
  **Επόμενο βήμα: Φ.Δ βήμα 2 — inline επεξεργαστής κελιού + πλοήγηση πληκτρολογίου.**
  ⚠️ **Το βήμα 1 ΔΕΝ έχει επαληθευτεί στην οθόνη** (§19.8).
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
| **Δ** | Δημιουργία + επεξεργασία | **βήμα 1 ✅** — σειριοποίηση (Λύση Α) + εργαλείο ενός κλικ + WYSIWYG φάντασμα + κουμπί κορδέλας (§19)· **βήματα 2-4 ΑΝΟΙΧΤΑ** — inline cell editor, keyboard nav, επικόλληση TSV/CSV, contextual καρτέλα ribbon | 5 νέα + ~20 (βήμα 1) |
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
| Inline επεξεργαστής κελιού, πλοήγηση με πληκτρολόγιο, επικόλληση TSV/CSV | Φ.Δ **βήμα 2** | εκεί ανήκει και η λαβή ύψους γραμμής (§18.4: μία επιλεγμένη γραμμή, μοτίβο Excel/Figma) |
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

🔴 **BROWSER VERIFY: ΔΕΝ ΕΓΙΝΕ.** Η επέκταση Chrome δεν συνδεόταν. **Κανείς δεν έχει δει
πίνακα στην οθόνη** — ούτε το φάντασμα να ακολουθεί τον κέρσορα, ούτε το κλικ να τον
προσγειώνει, ούτε τον πίνακα να ξαναεμφανίζεται μετά από F5. Ό,τι γράφει το §19 για
συμπεριφορά στην οθόνη είναι **συμπέρασμα από κώδικα και tests, όχι παρατήρηση**. Πρώτο
βήμα επαλήθευσης: `Εισαγωγή → Πίνακας` → κλικ → F5 → ο πίνακας πρέπει να είναι ακόμα εκεί,
με τα 4 κελιά του.

---

## Changelog

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
