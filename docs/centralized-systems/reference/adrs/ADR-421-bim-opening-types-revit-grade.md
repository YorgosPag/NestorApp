# ADR-421 — BIM Opening Types (Revit-grade door & window catalog)

**Status:** 🟢 SLICE A + SLICE B DONE (2026-06-07) — όλοι οι **17 τύποι** πλήρως registered + parametric 2D plan symbols + parametric 3D mesh + ρητό IFC4 `operationType`· tsc 0 (scope)· opening suites PASS· 🔴 browser-verify + commit (Giorgio). SLICE C (ADR-412 opening Family/Type) εκκρεμεί ως ξεχωριστό plan.
**Author:** Claude (Opus 4.8)
**Decision (Giorgio, 2026-06-07):** **Μοντέλο B — πλήρες ADR-412 Family/Type** («όπως η Revit, full enterprise + full SSOT») · **και τους 17 τύπους** · **parametric 3D mesh** ανά τύπο · **ρητό `operationType` field** (IfcDoorTypeOperationEnum / IfcWindowPanelOperationEnum) για Revit-grade IFC export.

**Related:**
- **ADR-363** (BIM Drawing Mode) §5.4 — το opening subsystem (governing ADR· `OpeningKind`, `OpeningParams`, geometry/2D/3D/IFC).
- **ADR-412** (BIM Family Types) — Revit Type/Instance σύστημα· **υλοποιημένο μόνο για `wall` + `stair`** σήμερα (το `opening` αναφέρεται μόνο εννοιολογικά στο §3.1 map, χωρίς κώδικα). Υποψήφιο για reuse αν επιλεγεί το Family/Type μοντέλο.
- **ADR-376** (Opening Mark/Tag) — per-kind prefix ταμπελάκια (dynamic i18n).
- **ADR-396** (Thermal envelope) — reveal insulation (Z4) στα κουφώματα.
- **ADR-040** (Canvas performance) — ο `OpeningRenderer` είναι canvas-renderer (CHECK 6D-sensitive).
- **ADR-369** (Elevation convention) — opening factory + IFC mapping.

---

## 1. Context — το ζητούμενο

Σήμερα το subsystem κουφωμάτων (ADR-363 §5.4) υποστηρίζει **5 τύπους** μέσω του
`OpeningKind` discriminated union:

| Kind | Ελληνικά | IFC σήμερα | 2D plan symbol σήμερα |
|---|---|---|---|
| `door` | Πόρτα (μονόφυλλη ανοιγόμενη) | IfcDoor | jambs + leaf line + swing arc (¼) |
| `french-door` | Τζαμωτή δίφυλλη | IfcDoor | 2 leaves + 2 arcs |
| `sliding-door` | Συρόμενη | IfcDoor | rail line + panel offset |
| `window` | Παράθυρο (ανοιγόμενο) | IfcWindow | glazing lines |
| `fixed` | Σταθερό τζάμι | IfcWindow | glazing lines |

Ο Giorgio ζητά **περισσότερους τύπους «σαν τη Revit»** — όχι μόνο ανοιγόμενο μονόφυλλο.
Αυτό το ADR (α) τεκμηριώνει τι ΑΚΡΙΒΩΣ κάνει η Revit/IFC, (β) προτείνει πλήρη κατάλογο
τύπων με 2D/3D/IFC/παραμέτρους ανά τύπο, (γ) θέτει την απόφαση μοντέλου
(enum-extension vs ADR-412 Family/Type).

---

## 2. Industry research (Revit + buildingSMART IFC)

### 2.1 Πώς τα διαχειρίζεται η Revit

Η Revit μοντελοποιεί κουφώματα ως **Families → Types**:

- **Family** = η κατηγορία γεωμετρίας + ο μηχανισμός λειτουργίας (π.χ. *Single-Flush*,
  *Double-Glass*, *Sliding*, *Bifold*, *Overhead-Sectional*, *Casement*, *Double-Hung*,
  *Awning*, *Fixed*, *Bay*). Κάθε family έχει δικό της **2D symbolic plan** (symbolic
  lines: παρειές + φύλλο + τόξο/βέλος) και **3D geometry** (κάσα + φύλλο/υαλοστάσιο).
- **Type** = συγκεκριμένες διαστάσεις/παράμετροι μέσα στην family (π.χ. *0915 x 2134mm*).
  Edit Type → ενημερώνονται όλες οι instances. "Duplicate" για fork.
- **Parameters:** Type-level (Width, Height, Thickness, Frame/Sash Material, Construction,
  Fire Rating, Operation) vs Instance-level (Sill Height, Head Height, Mark, Comments,
  flip/handing). Built-in categories: **Doors** (`OST_Doors`) + **Windows** (`OST_Windows`).
- Το 2D plan της Revit είναι **symbolic** (ξεχωριστό από το 3D cut) ώστε το swing/operation
  να διαβάζεται καθαρά σε κάτοψη ανεξαρτήτως κλίμακας — ίδια φιλοσοφία με το δικό μας
  `drawKindOverlay` (ADR-363 §5.4).

Out-of-the-box οι κατάλογοι (Revit + κοινές βιβλιοθήκες BIMobject/NBS/BIMsmith) καλύπτουν:

- **Πόρτες:** single-flush, double-flush, double-glass (french), sliding (μονή/διπλή),
  pocket, bi-fold, overhead/sectional (γκαραζόπορτα), roll-up, revolving.
- **Παράθυρα:** fixed, casement (side-hung), double-hung, single-hung, horizontal-sliding,
  awning (top-hung), hopper (bottom-hung), tilt-and-turn, bay/bow, louvre/jalousie.

### 2.2 Η αυθεντική πηγή — buildingSMART IFC enumerations

Η Revit εξάγει σε IFC χαρτογραφώντας την operation κάθε family στα παρακάτω enums. Αυτά
είναι το **gold standard** για το ποια λειτουργικά είδη υπάρχουν:

**`IfcDoorTypeOperationEnum` (IFC4) — 20 τιμές:**

| Τιμή | Λειτουργία |
|---|---|
| `SINGLE_SWING_LEFT` / `SINGLE_SWING_RIGHT` | Μονόφυλλη ανοιγόμενη (αριστερό/δεξί μεντεσέ) |
| `DOUBLE_DOOR_SINGLE_SWING` | Δίφυλλη, ένα φύλλο αριστερά + ένα δεξιά |
| `DOUBLE_DOOR_SINGLE_SWING_OPPOSITE_LEFT` / `_RIGHT` | Δίφυλλη, αντίθετες φορές |
| `DOUBLE_SWING_LEFT` / `DOUBLE_SWING_RIGHT` | Μονόφυλλη παλινδρομική (double-acting) |
| `DOUBLE_DOOR_DOUBLE_SWING` | Δίφυλλη παλινδρομική |
| `SLIDING_TO_LEFT` / `SLIDING_TO_RIGHT` | Συρόμενη μονή |
| `DOUBLE_DOOR_SLIDING` | Συρόμενη διπλή |
| `FOLDING_TO_LEFT` / `FOLDING_TO_RIGHT` | Πτυσσόμενη μονή (bi-fold) |
| `DOUBLE_DOOR_FOLDING` | Πτυσσόμενη διπλή |
| `REVOLVING` | Περιστρεφόμενη (4 φύλλα σταυρός) |
| `ROLLINGUP` | Ρολό / γκαραζόπορτα (κυλιόμενη προς τα πάνω) |
| `SWING_FIXED_LEFT` / `SWING_FIXED_RIGHT` | Ανοιγόμενη + σταθερό φεγγίτη/φύλλο |
| `USERDEFINED` / `NOTDEFINED` | Custom / lining χωρίς φύλλα |

**`IfcWindowTypePartitioningEnum` (διάταξη φύλλων) — 11 τιμές:**
`SINGLE_PANEL`, `DOUBLE_PANEL_VERTICAL`, `DOUBLE_PANEL_HORIZONTAL`,
`TRIPLE_PANEL_VERTICAL`, `TRIPLE_PANEL_BOTTOM`, `TRIPLE_PANEL_TOP`, `TRIPLE_PANEL_LEFT`,
`TRIPLE_PANEL_RIGHT`, `TRIPLE_PANEL_HORIZONTAL`, `USERDEFINED`, `NOTDEFINED`.

**`IfcWindowPanelOperationEnum` (μηχανισμός ανά φύλλο) — 14 τιμές:**
`SIDEHUNGLEFTHAND`, `SIDEHUNGRIGHTHAND` (ανοιγόμενο/casement),
`TILTANDTURNLEFTHAND`, `TILTANDTURNRIGHTHAND` (ανοιγο-ανακλινόμενο),
`TOPHUNG` (awning/ανακλινόμενο πάνω), `BOTTOMHUNG` (hopper/ανακλινόμενο κάτω),
`PIVOTHORIZONTAL`, `PIVOTVERTICAL` (περιστρεφόμενο), `SLIDINGHORIZONTAL`,
`SLIDINGVERTICAL` (double-hung), `FIXEDCASEMENT` (σταθερό), `REMOVABLECASEMENT`,
`OTHEROPERATION`, `NOTDEFINED`.

> **Παρατήρηση χαρτογράφησης:** Στο IFC το «είδος κουφώματος» δεν είναι ένα enum —
> είναι **operation** (πώς ανοίγει) + **partitioning** (πόσα/πώς φύλλα). Ένα Nestor `OpeningKind`
> αντιστοιχεί σε έναν συνδυασμό (operation × partitioning). Π.χ. `awning` → IfcWindow +
> `SINGLE_PANEL` + `TOPHUNG`.

### 2.3 Πηγές (research log)

- buildingSMART IFC4 — `IfcDoorTypeOperationEnum` (20 τιμές, verbatim): <https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/schema/ifcsharedbldgelements/lexical/ifcdoortypeoperationenum.htm>
- buildingSMART IFC4 — `IfcWindowTypePartitioningEnum` (11 τιμές): <https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/schema/ifcsharedbldgelements/lexical/ifcwindowtypepartitioningenum.htm>
- buildingSMART IFC4.3 — `IfcWindowPanelOperationEnum` (14 τιμές): <https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcWindowPanelOperationEnum.htm>
- Revit door families (single/double/sliding/pocket/bifold/overhead): BIMobject <https://www.bimobject.com/en-us/categories/doors>, BIMsmith pocket/bifold <https://market.bimsmith.com/category/Pocket-Doors-revit>, NBS sliding-folding <https://source.thenbs.com/en/category/bim/doors-windows-and-hatches/doors/doorsets/sliding-folding-doorsets/bc2XKw3nKGAEANJUdeKCFx>
- Revit window families (fixed/casement/double-hung/awning/hopper/sliding/bay): libraryRevit guide 2026 <https://libraryrevit.com/revit-window-families-complete-guide-2026/>, BIMobject casement <https://www.bimobject.com/en-us/categories/windows/casement-window?software=revit>, BIMobject double-hung <https://www.bimobject.com/en-us/categories/windows/double-hung-windows?software=revit>

---

## 3. Proposed catalog — Nestor opening types (Revit-mapped)

Πλήρης κατάλογος υποψηφίων (ο τελικός υποσύνολο επιλέγεται στις §6 ερωτήσεις). **EXISTING** =
ήδη υπάρχει σήμερα. Όλα κρατούν footprint = `width × wall-thickness` → **κληρονομούν ΔΩΡΕΑΝ**
τα 6 grips (ADR-363 §6 Phase 2.5), το 3D wall-cut (kind-agnostic), mark/tag, firestore, BOQ grouper.

### 3.1 Πόρτες (IfcDoor)

| # | Kind (πρόταση) | Ελληνικά | IFC operation | 2D plan symbol | 3D (Φ-future) | Key params |
|---|---|---|---|---|---|---|
| 1 | `door` *(EXISTING)* | Μονόφυλλη ανοιγόμενη | `SINGLE_SWING_LEFT/RIGHT` | leaf line + ¼ arc | φύλλο+κάσα | handing, openDirection |
| 2 | `double-door` | Δίφυλλη ανοιγόμενη (συμπαγής) | `DOUBLE_DOOR_SINGLE_SWING` | 2 leaves + 2 arcs | 2 φύλλα | handing, openDirection |
| 3 | `french-door` *(EXISTING)* | Δίφυλλη τζαμωτή | `DOUBLE_DOOR_SINGLE_SWING` (glazed) | 2 leaves + 2 arcs + glazing | 2 τζαμωτά φύλλα | handing, glazingPanes |
| 4 | `sliding-door` *(EXISTING)* | Συρόμενη μονή | `SLIDING_TO_LEFT/RIGHT` | rail + panel offset | συρόμενο φύλλο | — |
| 5 | `double-sliding-door` | Συρόμενη διπλή | `DOUBLE_DOOR_SLIDING` | 2 rails + 2 panels | 2 φύλλα | — |
| 6 | `pocket-door` | Χωνευτή (στον τοίχο) | `SLIDING_TO_*` (pocket) | panel μισό μέσα στον τοίχο (dashed pocket) | φύλλο σε θήκη | — |
| 7 | `bifold-door` | Πτυσσόμενη (φυσαρμόνικα) | `FOLDING_TO_LEFT/RIGHT` | zig-zag φύλλα (V) | πτυσσόμενα panels | handing |
| 8 | `overhead-door` | Γκαραζόπορτα (ρολό/τμηματική) | `ROLLINGUP` | dashed up-swing / sectional lines | οριζόντιες λωρίδες | — |
| 9 | `revolving-door` | Περιστρεφόμενη | `REVOLVING` | κύκλος + σταυρός 4 φύλλων | 4 φύλλα + κύλινδρος | — |

### 3.2 Παράθυρα (IfcWindow)

| # | Kind (πρόταση) | Ελληνικά | IFC operation/partition | 2D plan symbol | 3D (Φ-future) | Key params |
|---|---|---|---|---|---|---|
| 10 | `window` *(EXISTING)* | Παράθυρο (ανοιγόμενο/casement) | `SINGLE_PANEL`+`SIDEHUNG*` | glazing lines | υαλοστάσιο | glazingPanes, sillHeight |
| 11 | `fixed` *(EXISTING)* | Σταθερό τζάμι | `SINGLE_PANEL`+`FIXEDCASEMENT` | glazing lines (no swing) | σταθερό υαλοστάσιο | glazingPanes |
| 12 | `double-hung-window` | Συρόμενο κατακόρυφα (αμερικ.) | `DOUBLE_PANEL_VERTICAL`+`SLIDINGVERTICAL` | glazing + arrow ↕ | 2 sashes | glazingPanes |
| 13 | `sliding-window` | Συρόμενο οριζόντια | `DOUBLE_PANEL_HORIZONTAL`+`SLIDINGHORIZONTAL` | glazing + arrow ↔ | 2 sashes | glazingPanes |
| 14 | `awning-window` | Ανακλινόμενο πάνω | `SINGLE_PANEL`+`TOPHUNG` | glazing + ▲ hinge-top mark | top-hinged sash | glazingPanes, sillHeight |
| 15 | `hopper-window` | Ανακλινόμενο κάτω | `SINGLE_PANEL`+`BOTTOMHUNG` | glazing + ▼ hinge-bottom mark | bottom-hinged sash | glazingPanes, sillHeight |
| 16 | `tilt-turn-window` | Ανοιγο-ανακλινόμενο | `SINGLE_PANEL`+`TILTANDTURN*` | glazing + L-shape mark | dual-mode sash | handing, glazingPanes |
| 17 | `bay-window` | Προεξέχον (κουτί) | `TRIPLE_PANEL_*` (projecting) | προεξέχον πολυγωνικό outline | προεξέχον σώμα | depth, glazingPanes |

> **Σημείωση:** 12–13 (double-hung/sliding) & 14–16 (awning/hopper/tilt-turn) έχουν **ίδιο plan
> outline** με `window`/`fixed`· διαφέρουν στο overlay mark + στο schedule/tag/IFC operation. Στη
> Revit το ίδιο: σε κάτοψη πολλά παράθυρα φαίνονται όμοια· η διάκριση είναι στην elevation/3D + tag.

---

## 4. Geometry / 2D / 3D / IFC ανά concern (πώς δένει με το υπάρχον SSoT)

| Concern | Υπάρχον SSoT (ADR-363) | Τι αλλάζει ανά νέο τύπο |
|---|---|---|
| **Schema** | `OpeningKind` union + `OPENING_KIND_DEFAULTS` (`opening-types.ts`) | + νέα μέλη union + defaults (width/height/sill) |
| **Geometry** | `computeOpeningGeometry` → `buildOutline` (κοινό rect) + `buildHingeArc` (door/french) | νέοι plan builders: `buildFoldingPlan` (bifold), `buildSlidingPlan` (pocket/double-slide), `buildRevolvingPlan`, `buildSashMark` (awning/hopper/tilt). Όλοι **pure**, στο `opening-geometry.ts` (ή split αν >500γρ) |
| **2D render** | `OpeningRenderer.drawKindOverlay` (ADR-040-sensitive) | branch ανά νέο overlay· χρώμα `OPENING_KIND_STROKE` (`opening-kind-style.ts`) |
| **3D** | `wall-opening-extrude.ts` — **kind-agnostic** (ορθογώνιο κενό, κανένα mesh φύλλου) | scope question §6 (2D-only vs parametric 3D leaf/sash mesh) |
| **IFC** | `inferOpeningIfcType` (door/sliding/french→IfcDoor· window/fixed→IfcWindow) | επέκταση mapping· προαιρετικά `operationType` field για IfcDoor/WindowTypeOperationEnum (IFC export fidelity) |
| **Ribbon** | `OPENING_KIND_OPTIONS` (`contextual-opening-tab.ts`) + i18n `ribbon.commands.openingEditor.kind.*` | + options + el/en labels |
| **Mark/Schedule** | `opening-mark-allocator` (dynamic i18n prefix) + `openingKindToScheduleType` | + prefix i18n + schedule routing (door vs window preset) |
| **BOQ/ΑΤΟΕ** | `OPENING_MAPPING` (`bim-to-atoe-mapping.ts`) | + entry ανά kind |
| **Grips** | `opening-grips.ts` (6 grips, footprint-driven) | **καμία αλλαγή** (κληρονομούνται) |

**⚠️ Exhaustive maps** (`OPENING_KIND_DEFAULTS`, `OPENING_KIND_STROKE`, `OPENING_MAPPING`,
`RenumberOpeningsHost.kindPrefixes`): νέο kind σπάει type-check σε όλα → χρήσιμο compile-time
safety net (ο tsc τα δείχνει).

---

## 5. Decision — δύο μοντέλα (το οριστικό αποφασίζεται στις §6 ερωτήσεις)

### Μοντέλο A — Επέκταση `OpeningKind` enum (industry «hardcoded families»)

Προσθήκη νέων μελών στο `OpeningKind` union + registration surface (§4). Κάθε «τύπος» =
σταθερή family με δικό του 2D/3D/IFC. Διαστάσεις = instance params (όπως σήμερα).

- ✅ Ευθυγραμμίζεται 1:1 με την υπάρχουσα αρχιτεκτονική (ADR-363)· μηδέν νέα collection/persistence.
- ✅ Γρήγορο, χαμηλό ρίσκο· κάθε kind κληρονομεί grips/3D-cut/mark/BOQ δωρεάν.
- ✅ Αντιστοιχεί στο πώς η Revit ορίζει **Families** (γεωμετρία/operation hardcoded).
- ❌ ΔΕΝ δίνει named user-defined «Types» με live propagation (το Type κομμάτι της Revit).

### Μοντέλο B — Πλήρες Family/Type σύστημα (reuse ADR-412)

Προσθήκη `opening` category στο `BimFamilyType` (ADR-412): `OpeningTypeParams` (Type-level:
operation, frame material, fire rating, construction) + instance overrides + live propagation +
"Duplicate to edit". Το `OpeningKind` παραμένει ως **family discriminator** (γεωμετρία/operation),
και το Type κουμπώνει από πάνω (named διαστάσεις/υλικά).

- ✅ Πλήρες Revit μοντέλο (Families × Types)· edit Type → όλες οι instances.
- ✅ Reuse του υπάρχοντος ADR-412 engine (`resolveEffectiveParams`, controller, audit).
- ❌ Μεγάλο lift (νέα typeParams schema, ribbon widget, propagation host, Firestore index/rules,
  audit subcollection)· 5+ αρχεία, 2+ domains → **Orchestrator/Plan Mode** (N.8).
- ❌ Το `opening` δεν υπάρχει καθόλου στο ADR-412 code σήμερα (μόνο `wall`+`stair`).

> **Πρόταση συγγραφέα:** Υβριδικό σε φάσεις — **Φ1 = Μοντέλο A** (επέκταση enum με τους
> πραγματικά χρήσιμους τύπους + σωστό 2D/IFC), που είναι το «Families» κομμάτι και απαντά άμεσα
> στο ζητούμενο· **Φ2 (μετέπειτα, προαιρετικό) = Μοντέλο B** (named Types με propagation) αν
> ο Giorgio θέλει το πλήρες Type/Instance. Έτσι ΔΕΝ ξαναγράφουμε τίποτα: το enum των families
> είναι προαπαιτούμενο και για τα δύο μοντέλα.

---

## 6. Resolved decisions (Giorgio, 2026-06-07)

| # | Ερώτηση | Απόφαση |
|---|---|---|
| 1 | Type model | **Μοντέλο B — πλήρες ADR-412 Family/Type** («όπως η Revit, full enterprise + full SSOT»). Το `OpeningKind` παραμένει family discriminator· από πάνω κουμπώνει `OpeningTypeParams` (named Types, live propagation, Duplicate-to-edit). |
| 2 | Scope τύπων | **Και τους 17** του §3 καταλόγου. |
| 3 | 3D scope | **Parametric 3D mesh ανά τύπο** (φύλλο/υαλοστάσιο/ρολό/περιστρεφόμενο σώμα), όχι μόνο kind-agnostic κενό. |
| 4 | IFC fidelity | **Ρητό `operationType` field** (IfcDoorTypeOperationEnum / IfcWindowPanelOperationEnum) για Revit-grade openBIM export. |

### 6.1 Συνέπεια εκτέλεσης (N.8)

Το εύρος (17 families × {schema, 2D geometry, 3D mesh, renderer, IFC operation, Family/Type
integration, ribbon, mark/schedule/BOQ}) είναι **πολλαπλά domains & δεκάδες αρχεία** → απαιτεί
**Orchestrator ή phased Plan Mode** (εκκρεμεί έγκριση Giorgio). Η υλοποίηση θα γίνει σε
**vertical slices** (ένας τύπος end-to-end πρώτα ως πρότυπο, μετά fan-out) για Google-level ποιότητα.

---

## 7. Changelog

- **2026-06-07** — Δημιουργία (PROPOSED). Deep research (Revit + IFC4 enums), πλήρης κατάλογος
  17 τύπων με 2D/3D/IFC/params mapping, 2 decision μοντέλα.
- **2026-06-07** — DECIDED: Giorgio κλείδωσε Μοντέλο B (full Family/Type) + 17 τύποι + parametric
  3D mesh + ρητό operationType. Execution: Plan Mode + vertical slices (N.8 έγκριση Giorgio).
- **2026-06-07** — **SLICE A DONE** (Plan Mode, εγκεκριμένο plan). Παραδοτέα:
  - **NEW** `bim/types/opening-operation-types.ts` — IFC4 enums SSoT (door 20 / window 14 /
    partitioning 11) + `DEFAULT_OPERATION_BY_KIND` + `resolveOperationType(kind, handing)`.
  - **NEW** `bim-3d/converters/opening-mesh.ts` — parametric 3D κούφωμα (κάσα + φύλλο/-α +
    υαλοστάσιο)· double-leaf-aware· glazed→γυαλί· ίδια scene-units convention με wall-opening-extrude.
  - `OpeningParams.operationType?` (+zod +factory auto-fill, idempotent) — Revit-grade IFC export.
  - Νέα family `double-door`: union + defaults (1400×2100) + `isDoubleLeafKind` SSoT (reuse στο
    geometry `buildHingeArc`, ghost-preview, 3D mesh — μηδέν νέος 2D builder).
  - Registration: OPENING_KIND_DEFAULTS/STROKE (+ghost KIND_STROKE/FILL), OPENING_MAPPING (BOQ),
    openingKindToScheduleType, RenumberOpeningsHost.kindPrefixes, ribbon OPENING_KIND_OPTIONS,
    i18n el+en (`openingEditor.kind.doubleDoor` + `opening.tag.prefix.double-door` ΔΦ/DD).
  - `OpeningRenderer` ΜΗΝ αλλαχθεί (double-door πέφτει φυσικά στα door branches → καμία ADR-040 επίπτωση).
  - Tests: opening-operation-types (νέο), opening-mesh (νέο), factory operationType/double-door,
    renumber/geometry/extrude/schedule/boq regression. **164 PASS, tsc 0 (scope).**
  - 🔴 ΕΚΚΡΕΜΕΙ: browser-verify (2D 2 φύλλα/2 τόξα· 3D κάσα+2 φύλλα) + commit (Giorgio· κοινό tree).
- **2026-06-07** — **SLICE B DONE** (Plan Mode, εγκεκριμένο plan). Fan-out στους **11 υπόλοιπους**
  τύπους (5 πόρτες + 6 παράθυρα), reusing το πρότυπο A — **FULL SSOT, Revit-grade**. Παραδοτέα:
  - **Νέα SSoT** (`opening-types.ts`): `OpeningKind` +11· `OPENING_KIND_DEFAULTS` +11· νέα predicates
    `isWindowKind` / `isSlidingKind` / `isFoldingKind`· επέκταση `isGlazedKind` (όλα τα windows)·
    **ΝΕΟ `OpeningPlanSymbol` + `OPENING_PLAN_SYMBOL` exhaustive map** = μοναδικό 2D-overlay dispatch.
  - **IFC4 operation** (`opening-operation-types.ts`): `DEFAULT_OPERATION_BY_KIND` +11 (DOUBLE_DOOR_SLIDING /
    SLIDING_TO_* / FOLDING_TO_* / ROLLINGUP / REVOLVING / SLIDINGVERTICAL / SLIDINGHORIZONTAL / TOPHUNG /
    BOTTOMHUNG / TILTANDTURN* / SIDEHUNG)· `resolveOperationType` handing variants (sliding/pocket/bifold/tilt-turn).
  - **2D**: **ΝΕΟ `bim/renderers/opening-overlay-drawing.ts`** (pure SSoT· dispatch σε `OPENING_PLAN_SYMBOL`) —
    swing/glazing μεταφέρθηκαν εκεί (Boy-Scout) + νέα σύμβολα: sliding διπλό/pocket+pocket-cavity, folding zig-zag,
    overhead sectional, revolving κύκλος+4-blade, slide arrows ↔/↕, sash marks ▲/▼/L, bay projecting trapezoid.
    `OpeningRenderer.drawKindOverlay` → ένα call· subcat helpers via `isWindowKind`/`isSlidingKind` (ΟΧΙ νέοι subcats).
  - **3D**: **ΝΕΟ `bim-3d/converters/opening-mesh-builders.ts`** (per-family panel specs) — sliding offset/overlap,
    bifold 3 panels, overhead 5 slats, revolving 2 blades+post, glazed 2-sash (h/v), bay projecting body.
    `opening-mesh.ts` `leafPanels` → `buildLeafSpecs` dispatcher (BoxSpec/Materials εξήχθησαν στο builders).
  - **Geometry**: bay bbox επέκταση (culling parity, `opening-geometry.ts`)· τίποτε άλλο (windows ρέουν ως outline-only).
  - **Registration**: STROKE/ghost STROKE+FILL, OPENING_MAPPING (BOQ), openingKindToScheduleType, inferOpeningIfcType
    (factory + IFC loader via `isWindowKind`), IFC serializer (overhead→GATE), kindPrefixes (host + test fixture),
    RenumberOpeningsDialog ALL_KINDS + generic `toCamel`, migrate-opening-tags PREFIXES (EL/EN), ribbon OPENING_KIND_OPTIONS,
    i18n el+en (kind labels + tag prefixes).
  - **CHECK 6D**: ο `OpeningRenderer` άλλαξε → staged μαζί με ADR-040.
  - Tests: νέο `opening-types.test` (predicates/plan-symbol exhaustive) + επεκτάσεις operation-types/factory/opening-mesh ανά family.
    **opening suites PASS (487+), tsc 0 (scope· μόνο 4 pre-existing errors άλλων agents).**
  - 🔴 ΕΚΚΡΕΜΕΙ: browser-verify (2D σύμβολο + 3D σώμα + IFC operation ανά τύπο) + commit (Giorgio· κοινό tree).
- **2026-06-08** — **SLICE C DONE** (Plan Mode, εγκεκριμένο plan): Revit Family/Type για κουφώματα,
  **πλήρης επαναχρησιμοποίηση του generic ADR-412 framework — ΜΗΔΕΝ fork στο infrastructure**
  (collection `bim_family_types`, `generateBimFamilyTypeId`, `BimFamilyTypeService`, store,
  `resolveEffectiveParams`, Firestore rules — όλα category-blind). Αποφάσεις Giorgio: Revit-true split +
  πλήρες UI (Edit dialog) + seed built-ins. Παραδοτέα:
  - **Type contract**: `OpeningTypeParams` (kind/width/height/frameWidth?/material?/glazingPanes?/fireRating?)
    + `BimTypeParamsByCategory.opening`· `OpeningTypeParamsSchema` (.strict()) στο `opening.schemas.ts`
    (reuse `OpeningKindSchema`· αποφυγή runtime cycle) + opening branch στο `BimFamilyTypeSchema` discriminatedUnion
    + `schemaByCategory.opening`· **NEW `resolveEffectiveOpeningParams`** (legacy fast-path = zero regression).
  - **Type vs Instance (Revit-true)**: TYPE owns kind/width/height/frame/material/glazing/fireRating·
    INSTANCE owns wallId/offsetFromStart/sillHeight/handing/openDirection· `operationType` re-derived (derived).
  - **Instance fields**: `OpeningEntity.typeId?`/`typeOverrides?` (+ schema + factory + `OpeningDoc`/`OpeningUpdateInput`
    με `null`→`deleteField()` + `entityToSaveInput`).
  - **Built-ins + auto-typing**: `getBuiltInOpeningTypes` (1/kind = 17, dims από `OPENING_KIND_DEFAULTS`)·
    **NEW `auto-opening-type.ts` `resolveAutoOpeningTypeId`** (link σε built-in όταν dims==default· διαθέσιμο,
    wiring at-create = follow-up).
  - **Commands**: **NEW `AssignOpeningTypeCommand`** (effective params + computeOpeningGeometry + validate +
    re-derive operationType + kind/ifcType lock-step· ΧΩΡΙΣ cascade)· **NEW generic `UpdateFamilyTypeCommand` +
    `DeleteFamilyTypeCommand`** (category-agnostic· το opening τα καταναλώνει· wall→generics migration =
    pending-ratchet, shared tree).
  - **Controller + UI**: **NEW `useOpeningFamilyTypeController`** + helpers (`asOpeningFamilyType`/`listOpeningTypes`/
    `OPENING_OVERRIDABLE_KEYS`/`resolveOpeningTypeAssignment`)· **NEW** `RibbonOpeningFamilyTypeWidget` (selector +
    Duplicate) + `RibbonOpeningTypePropertiesWidget` (effective params read-only + override badges + reset + rename +
    edit/delete) + `EditOpeningTypeDialog` (FloatingPanel, draft, follow-selection· χωρίς DNA) + `edit-opening-type-store`·
    panel `opening-family-type` στο contextual-opening-tab + RibbonPanel dispatch.
  - **Persistence**: **NEW `opening-type-resolution.ts`** (resolveOpeningEffective/openingEntityDiffersFromDoc/
    openingTypeLinkChanged/openingUpdateLinkPatch/reresolveSceneOpenings)· hydration «type wins» στο
    `opening-doc-hydration`· auto-save link-aware + persist link patch στο `useOpeningPersistence`· **NEW
    `useOpeningTypeReresolution`** (catalog-bump re-flow)· `findOpeningsByTypeId`· `EditOpeningTypeDialog` mounted
    στο OpeningPersistenceHost (catalog loader + delete dialog reused από WallPersistenceHost).
  - **Audit**: `AnyFamilyTypeParams` += OpeningTypeParams· `BIM_FAMILY_TYPE_TRACKED_FIELDS` += width/height/
    frameWidth/glazingPanes/fireRating.
  - **i18n** el+en: `ribbon.panels.openingFamilyType` + `bimFamilyType.{paramWidth/Height/FrameWidth/GlazingPanes/
    FireRating, editTypeOpening*, builtin.opening.*}`.
  - **Tests**: resolveEffectiveOpeningParams + auto-opening-type/built-ins + OpeningTypeParamsSchema/discriminator +
    opening-type-resolution helpers.
  - **CHECK 6D**: ΔΕΝ αγγίχθηκαν canvas-drawing/renderer αρχεία (μόνο ribbon/commands/types/persistence) → χωρίς ADR-040.
  - 🟡 **Documented follow-ups**: ~~(1) type-aware gating των legacy kind/size comboboxes σε typed openings (bridge)~~ ✅ **DONE 2026-06-08** (βλ. επόμενο entry)·
    (2) cross-floor opening BOQ re-feed (signature-group, θέλει floorplanId plumbing)· (3) wall→generic command migration.
  - 🔴 ΕΚΚΡΕΜΕΙ: browser-verify (assign/edit/duplicate/delete/override + reload) + commit (Giorgio· κοινό tree).
- **2026-06-08** — **SLICE C follow-up (a): TYPE-AWARE GATING** (Revit-true, Approach B). Σε **typed** κούφωμα
  (`opening.typeId` set) τα ribbon comboboxes **Kind / Width / Height** γίνονται **read-only** — η τιμή
  παραμένει ορατή (διέπεται από τον Τύπο), επεξεργασία μόνο μέσω «Edit type», ακριβώς όπως η Revit δείχνει
  greyed τα type-params στο instance Properties. **Untyped** (legacy) κουφώματα μένουν πλήρως editable
  (zero regression). Κλείνει το **silent-edit-loss bug**: direct edit του `params.width/height/kind` μέσω
  `UpdateOpeningParamsCommand` ξαναγραφόταν σιωπηλά στο επόμενο catalog re-resolution / reload («type wins»
  στο `opening-doc-hydration` + `useOpeningTypeReresolution`).
  - **Approach B** (thread `disabled` flag μέσα από `RibbonComboboxState` — minimal framework change):
    1. **SSoT** `OPENING_TYPE_GOVERNED_COMBOBOX_KEYS` + `isOpeningTypeGovernedComboboxKey` στο
       `opening-command-keys.ts` (kind/width/height· mirror του `OPENING_OVERRIDABLE_KEYS` + `kind`).
       Instance-owned `sillHeight`/`handing`/`openDirection`/`mark` → **ΠΟΤΕ** gated.
    2. `RibbonComboboxState += disabled?: boolean` (generic — bridges που το παραλείπουν → editable, no breaking change).
    3. `RibbonCombobox.tsx`: `disabled={comingSoon || dynamicState?.disabled === true}` (το Radix Select disabled δείχνει το value).
    4. `useRibbonOpeningBridge.getComboboxState` επιστρέφει `disabled` όταν `typeId` + type-governed key·
       **defense-in-depth** no-op guard στο `onComboboxChange` (gated field σε typed opening → δεν dispatch-άρει,
       ακόμη κι αν παρακαμφθεί το UI gating).
  - **Files (MOD)**: `opening-command-keys.ts`, `RibbonCommandContext.tsx`, `RibbonCombobox.tsx`,
    `useRibbonOpeningBridge.ts`. **NEW test**: `useRibbonOpeningBridge.test.tsx` (7/7 PASS — gating + guard + zero-regression).
  - **CHECK 6D**: μόνο ribbon context/combobox/bridge → ΟΧΙ canvas/renderer → **χωρίς ADR-040 staging**. tsc 0 (scope).
  - 🔴 ΕΚΚΡΕΜΕΙ: browser-verify (typed opening → Kind/Width/Height greyed, value ορατό· untyped → editable) + commit (Giorgio).
