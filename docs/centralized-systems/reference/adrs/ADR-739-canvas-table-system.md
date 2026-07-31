# ADR-739 — Σύστημα Πινάκων (Tables) στον 2Δ/3Δ Καμβά — Έρευνα Αγοράς + Αρχιτεκτονικό Blueprint

- **Status**: ✅ **ΕΓΚΕΚΡΙΜΕΝΟ ΣΧΕΔΙΟ — ΥΠΟ ΥΛΟΠΟΙΗΣΗ (σταδιακά, Φ.Α→Θ)**. Οι 5 αποφάσεις του
  §14 ελήφθησαν από τον Giorgio (2026-07-31). **Δεν προστίθεται κώδικας σε αυτό το ADR** — κάθε
  φάση κλείνει αυτοτελώς με δικό της κύκλο (§14.1). **Επόμενο βήμα: Φάση Α.**
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
| **Α** | Μοντέλο + μηχανή διάταξης | `types/table.ts`, `table-layout.ts` (measure/place/borders), `TableStyle` SSoT + presets. **Καθαρές συναρτήσεις, μηδέν React/canvas** | ~6 |
| **Β** | Απορρόφηση ADR-622 | `buildScheduleTable` → adapter· χαρακτηρισμός 6 καταναλωτών **πρώτα** | ~4 |
| **Γ** | Entity + rendering 2D | `TableEntity`, `TableRenderer`, bounds/hit-test/grips, 9 gates §12 | ~12 |
| **Δ** | Δημιουργία + επεξεργασία | εργαλείο, inline cell editor, keyboard nav, επικόλληση TSV/CSV, undo | ~10 |
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
