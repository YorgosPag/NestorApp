# ADR-417: BIM Roof Element (Δομικό στοιχείο «Στέγη»)

- **Status**: 🟢 ACCEPTED + 🟡 Φ1 + Φ1-part-2 #1/#2/#3/#4/#5/#8 IMPLEMENTED (2026-06-04→05, Opus) — entity+engine+2D+3D+tool+persistence+RoofTypes(built-ins)+BOQ+ribbon+i18n DONE· **contextual-tab + grips + V/G category(✅browser-verified) + audit + icon + Family-type UI (edit-dialog/auto-assign/re-resolution/override/delete-detach/typeId-persistence) DONE (2026-06-05)**· εκκρεμή: contextual-tab tests (#6 μερικώς) + hip Φ2 (#7) (βλ. §10). 🔴 browser-verify + commit pending.
- **Date**: 2026-06-04
- **Deciders**: Giorgio (Yorgos Pagonis)
- **Scope**: DXF Viewer subapp (`src/subapps/dxf-viewer`) — νέο παραμετρικό BIM δομικό στοιχείο «Στέγη» (κεκλιμένη/πραγματική στέγη), πέρα από την υπάρχουσα επίπεδη `slab kind='roof'`.
- **Supersedes / relates to**: ADR-416 (Slab Layered Build-up), ADR-412 (BIM Family Types), ADR-414 (Wall Type Live Preview), ADR-040 (Preview Canvas Performance), ADR-401/404 (wall attach), ADR-407 (Railings — sibling path-based element).

---

## 1. Πλαίσιο & Πρόβλημα (Context)

Ο χρήστης θέλει να προσθέσουμε το δομικό στοιχείο **BIM «Στέγη»** στην υποεφαρμογή `localhost:3000/dxf/viewer`. Μέχρι σήμερα δεν υπάρχει τίποτα ως **πραγματική κεκλιμένη στέγη**.

### Τι υπάρχει ήδη στον κώδικα (Code = Source of Truth)
- Η έννοια «στέγη» υπάρχει **μόνο ως επίπεδο δώμα**: `SlabKind` περιλαμβάνει `'roof'` (μαζί με `floor | ceiling | ground | foundation`) στο `bim/types/slab-types.ts`.
- Υπάρχει ήδη **έτοιμη 7-στρωματική σύνθεση** δώματος: `createDefaultRoofBuildup()` στο `bim/types/slab-dna-types.ts` →
  χαλίκι προστασίας 50mm → υδατοστεγής μεμβράνη 5mm → θερμομόνωση XPS 80mm → φράγμα υδρατμών 4mm → ρύσεις (slope screed) 80mm → οπλισμένο σκυρόδεμα 200mm → σοβάς οροφής 15mm (σύνολο 434mm).
- Αυτό όμως είναι **οριζόντιο δώμα** (flat roof). **ΔΕΝ** καλύπτει δίρριχτη (gable), τετράρριχτη (hip), μονόρριχτη (shed), κ.λπ. με ρίσες (slopes), κορφιάδες (ridges) και λούκια (valleys).

### Το πραγματικό ζητούμενο
Παραμετρική **κεκλιμένη** στέγη: ορισμός με περίγραμμα (footprint) + κλίσεις ανά ακμή, ή με προφίλ που σαρώνεται (extrusion), που παράγει 3D επιφάνειες με κορφιάδες/ρίσες/λούκια — όπως κάνουν Revit/ArchiCAD.

---

## 2. Ευρήματα Βαθιάς Έρευνας (Verified Research)

> Μεθοδολογία: deep-research harness — 103 agents, 21 πηγές, 90 ισχυρισμοί εξαχθέντες, 25 επαληθευμένοι με adversarial 3-vote (24 confirmed / 1 refuted). Όλες οι πηγές παρατίθενται στο §8.

### 2.1 Κανονικοί τύποι στέγης — το πρότυπο IFC (`IfcRoofTypeEnum`)

Το IFC ορίζει τη **μόνη σταθερή, κανονική απαρίθμηση** τύπων στέγης. Σταθερή σε όλες τις εκδόσεις:

| Τιμή enum | Ελληνική απόδοση | Επίσημος ορισμός IFC |
|---|---|---|
| `FLAT_ROOF` | Επίπεδο δώμα | Στέγη χωρίς κλίση (ή με ελάχιστη για απορροή) |
| `SHED_ROOF` | Μονόρριχτη / πρόσριχτη | Στέγη με **μία** κλίση |
| `GABLE_ROOF` | Δίρριχτη | Δύο κλίσεις από κεντρικό κορφιά, σχηματίζοντας αέτωμα σε κάθε άκρο |
| `HIP_ROOF` | Τετράρριχτη | Κεκλιμένα άκρα & πλευρές που συναντώνται σε κεκλιμένη γωνία |
| `HIPPED_GABLE_ROOF` | Ημι-τετράρριχτη (jerkinhead) | Συνδυασμός hip + gable |
| `GAMBREL_ROOF` | Διπλόρριχτη αχυρώνα (αμερικ.) | Δίρριχτη με δύο διαφορετικές κλίσεις ανά πλευρά |
| `MANSARD_ROOF` | Μανσάρ (γαλλική) | Τετράπλευρη με σπαστή κλίση σε όλες τις πλευρές |
| `BARREL_ROOF` | Κυλινδρική / θόλος ημικ. | Καμπύλη σε μορφή βαρελιού |
| `RAINBOW_ROOF` | Τοξωτή (ουράνιο τόξο) | Καμπύλη τοξωτή |
| `BUTTERFLY_ROOF` | Πεταλούδα | Δύο κλίσεις που κατεβαίνουν προς το κέντρο |
| `PAVILION_ROOF` | Πυραμιδωτή | Πυραμιδοειδής hip |
| `DOME_ROOF` | Τρούλος | Ημισφαιρική hip |
| `FREEFORM` | Ελεύθερη μορφή | Οποιαδήποτε γεωμετρία εκτός των παραπάνω |
| `USERDEFINED` *(IFC4+)* | Ορισμένη από χρήστη | — |
| `NOTDEFINED` | Μη ορισμένη | — |

- **IFC2x3**: 14 τιμές (12 named + FREEFORM + NOTDEFINED).
- **IFC4 / IFC4x3**: 15 τιμές (προσθήκη `USERDEFINED`).
- **ΚΡΙΣΙΜΟ**: το enum **μόνο ταξινομεί** — δεν παραμετροποιεί γεωμετρία. Πιο σύνθετες ή ακανόνιστες στέγες (`FREEFORM`) **πρέπει** να οριστούν με ρητή γεωμετρία. (Επαληθευμένο· ένας ισχυρισμός ότι το enum ορίζει «distinct slope geometry» **απορρίφθηκε** 1-2.)

### 2.2 Δομή δεδομένων IFC — `IfcRoof` (container)

Το `IfcRoof` είναι **container** που μοντελοποιείται με **δύο αμοιβαία αποκλειόμενους** τρόπους:

- **(α) Αθροιστική συναρμολόγηση (assembly)** — αγρεγκάρει μέρη που το καθένα έχει δική του γεωμετρία:
  - `IfcSlab` (επιφάνειες/decks της στέγης, με `PredefinedType=ROOF`)
  - `IfcBeam` (αμείβοντες/τεγίδες — rafters/purlins)
  - φωλιασμένα `IfcRoof` (π.χ. αυτοτελή dormers)
  - Σύνδεση μέσω `IfcRelAggregates`.
- **(β) Μονολιθική στέγη** — φέρει όλες τις αναπαραστάσεις γεωμετρίας απευθείας (π.χ. ένα `Brep`/`SweptSolid`).

**Κανόνας αποκλειστικότητας**: αν το `IfcRoof` αποσυντίθεται σε μέρη, **ΔΕΝ** φέρει δική του ανεξάρτητη γεωμετρία· η γεωμετρία του είναι **το άθροισμα** των μερών. Μόνο μη-αποσυντιθέμενη στέγη φέρει απευθείας γεωμετρία.

> **Σημασία για εμάς**: Η μοντέλο (α) χαρτογραφείται **1:1** με την υπάρχουσα αρχιτεκτονική μας: μια Στέγη = container που αγρεγκάρει επιφάνειες-`slab` (`kind='roof'`). Δηλαδή μπορούμε να **επαναχρησιμοποιήσουμε** το slab subsystem για κάθε κεκλιμένη πλάκα-στέγης.

### 2.3 Πώς δημιουργείται μια στέγη — Revit (3 μέθοδοι)

1. **Roof by Footprint** — από το περίγραμμα του κτηρίου. **Κλίση/προεξοχή/offset είναι ιδιότητες ΑΝΑ ΑΚΜΗ** του περιγράμματος, όχι καθολικές:
   - flag `Defines Roof Slope` (αν η ακμή ορίζει κλίση)
   - `Slope` (γωνία κλίσης)
   - `Overhang` (οριζόντια προεξοχή από τον σχετιζόμενο τοίχο)
   - `Offset From Roof Base`, `Plate Offset From Base`
   - **Έτσι από ΕΝΑ περίγραμμα παράγονται gable/hip/shed** — απλώς διαλέγεις ποιες ακμές είναι slope-defining και σε ποια γωνία.
2. **Roof by Extrusion** — σάρωση (extrude) ενός σκιαγραφημένου προφίλ (για τοξωτές, butterfly, gambrel κ.λπ.).
3. **Roof by Face** — πάνω σε μη-κατακόρυφες έδρες ενός mass (freeform).

### 2.4 Πώς δημιουργείται μια στέγη — ArchiCAD (pivot line)

- **Pivot line / pivot polygon**: οριζόντια **μη-εκτυπώσιμη** γραμμή αναφοράς που σχεδιάζεις κατά τη δημιουργία. Η στάθμη της pivot line ορίζει τη **στάθμη αναφοράς** της στέγης (Pivot Offset από το Home Story).
- **Single-plane** vs **Multi-plane Roof**: το Multi-plane είναι **ΕΝΑ στοιχείο** παρά τα πολλά επίπεδα — όταν επεξεργάζεσαι ένα επίπεδο, τα υπόλοιπα προσαρμόζονται αυτόματα. Σπάει σε ανεξάρτητα Single-plane μέσω `Edit > Reshape > Split`.
- **Κλίση (pitch) μετριέται ΑΠΟ την pivot line**, ρυθμιζόμενη **ανά επίπεδο**.
- **Μονάδες κλίσης**: μοίρες, ποσοστά (%), ή (imperial) rise-per-12. Μπορεί να είναι **αρνητική** → ανεστραμμένη στέγη (κλίνει προς τα κάτω).
- **Προεξοχή γείσου (eaves overhang)** μετριέται ως απόσταση από το pivot polygon.

### 2.5 Στρώσεις/Σύνθεση στέγης (Layers / Build-up) — όπως τοίχος αλλά κεκλιμένος

- Στο Revit ο **τύπος στέγης** είναι **compound structure** όπως ο τοίχος: στρώσεις core / insulation / membrane + **Core Boundary** (δύο γραμμές αναφοράς, μηδενικού πάχους, μη-επεξεργάσιμες).
- Στρώση membrane = μηδενικού πάχους.
- **Tapered insulation (ρύσεις)**: μια στρώση μπορεί να οριστεί **Variable** πάχους → η κλίση εφαρμόζεται μόνο σε αυτή τη στρώση, ενώ η κάτω πλευρά της στέγης μένει επίπεδη. (Ακριβώς ο μηχανισμός για «ρύσεις» σε δώμα.)
- Τυπικά γεωμετρικά στοιχεία: γείσο/προεξοχή (eaves/overhang), κορφιάς (ridge), λούκι (valley), ακμή hip, υδρορροές (gutters), μετώπη (fascia), ψευδοροφή γείσου (soffit).

> **Σημασία για εμάς**: Έχουμε ήδη το γενικό `LayeredBuildup<Z>` SSoT (`bim/types/layered-buildup.ts`) που μοιράζονται τοίχος & πλάκα, και `createDefaultRoofBuildup()`. Η κεκλιμένη στέγη μπορεί να επαναχρησιμοποιήσει αυτό το σύστημα στρώσεων.

### 2.6 Βασικές παράμετροι που ορίζει ο χρήστης

| Παράμετρος | Περιγραφή |
|---|---|
| Κλίση (pitch/slope) | μοίρες / ποσοστό / λόγος (rise:run) |
| Στάθμη βάσης (base level) | επίπεδο αναφοράς (όπως pivot line) |
| Ύψος γείσου (eaves height) | — |
| Ύψος κορφιά (ridge height) | προκύπτει από κλίση + άνοιγμα |
| Προεξοχή γείσου (overhang) | οριζόντια προβολή πέρα από τον τοίχο |
| Κοπή αμείβοντα (rafter cut / plumb cut) | λεπτομέρεια άκρου |
| Μετώπη/ψευδοροφή (fascia/soffit) | — |

### 2.7 Σύνδεση με τοίχους & ανοίγματα

- **Attach Top/Base**: οι τοίχοι «δένουν» την κορυφή (ή βάση) τους στη στέγη → προσαρμόζονται αυτόματα όταν αλλάζει η στέγη (δεν επεξεργάζεσαι χειροκίνητα το προφίλ τοίχου).
- Η στέγη είναι **host** για ανοίγματα: φεγγίτες / παράθυρα στέγης (skylights / roof windows). Η οικογένεια ανοίγματος πρέπει να έχει δηλωθεί host-on-roof εξαρχής (δεν αλλάζει εκ των υστέρων).

### 2.8 Ποσότητες / BOQ — κεκλιμένο vs προβολή (κρίσιμο για ΑΤΟΕ)

Από `Qto_RoofBaseQuantities` (IFC4x3) — **3 εμβαδά**:

| Ποσότητα | Τύπος | Ορισμός |
|---|---|---|
| **GrossArea** | area | **Κεκλιμένο/πραγματικό** εμβαδό εξωτερικής επιφάνειας (developed), χωρίς αφαίρεση ανοιγμάτων |
| **NetArea** | area | Καθαρό εμβαδό — αφαιρούνται ανοίγματα/εσοχές, προστίθενται προεξοχές |
| **ProjectedArea** | area | **Προβολή στο έδαφος** (κάτοψη/footprint) |

> **ΚΡΙΣΙΜΟ για κοστολόγηση**: η επικάλυψη (κεραμίδια/λαμαρίνα) μετριέται με το **GrossArea (κεκλιμένο)**, ΟΧΙ με την προβολή — η κεκλιμένη επιφάνεια είναι πάντα μεγαλύτερη από την κάτοψη. Η υπάρχουσα `slab-geometry.ts` υπολογίζει εμβαδό **κάτοψης** (projected) — για στέγη χρειαζόμαστε **και** το κεκλιμένο εμβαδό = projected / cos(κλίση) ανά πλευρά.

---

## 3. Η αρχιτεκτονική πραγματικότητα του project (πού «κουμπώνει»)

Το πλησιέστερο υπάρχον στοιχείο είναι η **ΠΛΑΚΑ (slab)** — έχει ήδη polygon footprint, στρώσεις (DNA), κλίση (`slab-slope.ts`), 3D mesh, grips, BOQ, family-types.

### Σημεία καταγραφής για νέο 2D BIM entity (γνωστό «μάθημα» — 5+1 πύλες)
1. `bim/types/bim-base.ts` — `BimElementType` union (+ type guard στο `types/entities.ts`)
2. `hooks/canvas/dxf-scene-entity-converter.ts` — `case 'roof':` (αλλιώς silent-drop!)
3. `rendering/core/EntityRendererComposite.ts` — register `RoofRenderer`
4. `types/entity-bounds.ts` — `case 'roof':` (culling/zoom-extents)
5. `bim/utils/bim-bounds.ts` — `case 'roof':` (marquee select)
6. `rendering/hitTesting/Bounds.ts` — `case 'roof':` (spatial index / hit-test)

### Πλήρης χάρτης αρχείων-προτύπων (slab ως template)
| Αντικείμενο | Αρχείο-πρότυπο (slab) |
|---|---|
| types/schema | `bim/types/slab-types.ts`, `bim/types/slab.schemas.ts` |
| στρώσεις (DNA) | `bim/types/slab-dna-types.ts`, `bim/types/layered-buildup.ts` |
| 2D renderer | `bim/renderers/SlabRenderer.ts` |
| 2D geometry | `bim/geometry/slab-geometry.ts`, `bim/geometry/slab-slope.ts` |
| 3D mesh | `bim-3d/converters/BimToThreeConverter.ts` (`slabToMesh`), `slab-multilayer-solid-3d.ts`, `mesh-slope-shear.ts` |
| drawing tool | `hooks/drawing/useSlabTool.ts`, `hooks/drawing/slab-completion.ts` |
| factory | `src/services/factories/slab.factory.ts` |
| grips | `bim/slabs/slab-grips.ts` |
| persistence | `bim/slabs/slab-firestore-service.ts`, `hooks/data/useSlabPersistence.ts` |
| enterprise id | `src/services/enterprise-id-prefixes.ts` (prefix), `enterprise-id-convenience.ts` (generator) |
| collection | `src/config/firestore-collections.ts` (`FLOORPLAN_SLABS`) |
| BOQ/ΑΤΟΕ | `bim/config/bim-to-atoe-mapping.ts`, `hooks/data/slab-boq-feed.ts` |
| ribbon | `ui/ribbon/data/home-tab-draw.ts`, `ui/ribbon/data/contextual-slab-tab.ts` |
| family types | `bim/types/bim-family-type.ts`, `bim/family-types/built-in-types.ts` |
| i18n | `src/i18n/locales/{el,en}/dxf-viewer-shell.json`, `tool-hints.json` |

---

## 4. Αρχιτεκτονικές αποφάσεις — ΚΛΕΙΔΩΜΕΝΕΣ (Giorgio, 2026-06-04)

> Αποφασίστηκαν μέσω AskUserQuestion με απλά λόγια. **Γενικό directive Giorgio: «σαν Revit — FULL ENTERPRISE + FULL SSOT».**

- **Q1 — Δομή entity** → **ΑΠΟΦΑΣΗ (αρχιτέκτονας):** Νέο BimElementType `'roof'` ως **παραμετρικό** entity (footprint + κλίσεις ανά ακμή), με engine `computeRoofGeometry()` που παράγει τα κεκλιμένα επίπεδα — όπως `computeRailingGeometry` (ADR-407) & multi-layer wall. ΟΧΙ literal child-slabs (μία οντότητα = ένα persistence/selection/grip lifecycle = SSoT). Συμβατό με IFC export ως `IfcRoof` container → `IfcSlab` planes στην έξοδο.
- **Q2 — Μορφές** → **Και οι 4**: `flat` + `mono-pitch (shed)` + `gable` + `hip`. (Φασοποίηση: hip σε Φ2 — βλ. Q-φάση.)
- **Q3 — Μέθοδος δημιουργίας** → **Footprint + κλίσεις ανά ακμή (Revit-style)**: κλικ-κλικ περίγραμμα, flag `definesSlope` + γωνία + overhang ανά ακμή.
- **Q4 — Υλικό/σύνθεση** → **«Σαν Revit / full SSoT»** → υλοποίηση μέσω **Roof Types** (family types). Built-in: «Μπετονένιο δώμα» (reuse `createDefaultRoofBuildup()` 7 στρώσεις) **ΚΑΙ** «Κεραμοσκεπή» (πέτσωμα/τεγίδες/μόνωση/κεραμίδι) μέσω `LayeredBuildup` SSoT.
- **Q5 — Μονάδες κλίσης** → **Και μοίρες ΚΑΙ ποσοστό**, εναλλάξιμα στο UI (όπως ArchiCAD).
- **Q6 — Σύνδεση τοίχων (attach-top)** → **ΑΡΓΟΤΕΡΑ** (ξεχωριστή φάση, Φ4).
- **Q7 — BOQ** → GrossArea (κεκλιμένο, για επικάλυψη) + ProjectedArea (κάτοψη). ΑΤΟΕ άρθρο: επιλογή στη Φάση υλοποίησης (πρότυπο `slab-boq-feed`).
- **Q8 — Family Types** → **ΝΑΙ, «Τύπος Στέγης»** (πλήρες ADR-412 plug-in: built-ins + edit type + re-resolution).
- **Q-φάση: Τετράρριχτη (hip)** → **Φ2** (πρώτα οι 3 απλές: flat/mono/gable — γρήγορα & σταθερά· hip solver κορφιάδων/λουκιών αμέσως μετά).

---

## 5. Σχεδίαση & Roadmap (κλειδωμένη μετά Q1–Q8)

### Φάση 1 — Vertical slice: flat + mono-pitch + gable
1. Νέο entity `'roof'` + `RoofParams { roofTypeId, basePivotZ, units:'deg'|'percent', edges: { definesSlope, slope, overhang }[] }`.
2. Engine `computeRoofGeometry(footprint, edges)` (FULL SSoT, pure) → κεκλιμένα επίπεδα για flat/shed/gable.
3. Επαναχρήση `LayeredBuildup` (στρώσεις) + `mesh-slope-shear.ts` (3D).
4. Polygon drawing tool (πρότυπο `useSlabTool` + `slab-completion`).
5. **6 πύλες καταγραφής** (§3) + ribbon button «Στέγη» στα Δομικά Στοιχεία (`RF`).
6. Persistence: prefix `roof` (N.6), collection `FLOORPLAN_ROOFS`, factory + IFC GUID.
7. **Roof Types (ADR-412)**: built-ins «Μπετονένιο δώμα» + «Κεραμοσκεπή» + edit-type + re-resolution.
8. UI κλίσης: μοίρες ↔ ποσοστό toggle.
9. BOQ: GrossArea (κεκλιμένο) + ProjectedArea (`slab-boq-feed` πρότυπο).

### Φάση 2 — Τετράρριχτη (hip)
- Straight-skeleton solver για κορφιάδες (ridges) / λούκια (valleys) / ακμές hip από footprint + ομοιόμορφη κλίση.

### Φάση 3 — Λεπτομέρειες
- Γείσο/μετώπη/ψευδοροφή (fascia/soffit), υδρορροές, grips ανά ακμή/κορυφή.

### Φάση 4 — Σύνδεση τοίχων (wall attach-top)
- Auto «attach top» τοίχων στην κάτω επιφάνεια στέγης (ADR-401/404 μηχανισμός).

### Φάση 5 — Ανοίγματα στέγης
- Φεγγίτες / παράθυρα στέγης (skylights) ως roof-hosted openings.

### Φάση 6 (μελλοντικά)
- mansard / gambrel / barrel (extrusion), dormers (φωλιασμένα roof), freeform.

---

## 6. Συνέπειες (Consequences)

- **➕** Πλήρης ευθυγράμμιση με IFC (export-ready), επαναχρήση slab/wall layered subsystem → χαμηλό ρίσκο.
- **➕** Καλύπτει πραγματικό κενό (μόνο flat δώμα υπάρχει σήμερα).
- **➖** Ο hip/valley solver (γεωμετρία straight-skeleton) είναι μη-τετριμμένος → σταδιακή υλοποίηση.
- **➖** Νέο entity = 6 πύλες καταγραφής + ADR-040 staging (canvas αρχεία).

---

## 7. ADR-040 / Pre-commit σημειώσεις

- Τα 2D renderer / scene-converter / bounds αγγίζουν canvas pipeline → **STAGE ADR-040** (CHECK 6B/6D).
- Firestore writes → enterprise-id generator υποχρεωτικό (N.6), νέο prefix `roof` + collection `FLOORPLAN_ROOFS`.
- i18n: όλα τα labels μέσω `t()` (N.11) — κλειδιά πρώτα σε `el` + `en`.

---

## 8. Πηγές (Sources — primary, verified)

**IFC standard (primary):**
- IfcRoofTypeEnum — IFC2x3 TC1, IFC4 ADD2 TC1, IFC4x3: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/schema/ifcsharedbldgelements/lexical/ifcrooftypeenum.htm
- IfcRoof (container/aggregation/geometry-exclusivity): https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/schema/ifcsharedbldgelements/lexical/ifcroof.htm , https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcRoof.htm
- IfcRoofType: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcRoofType.htm
- Qto_RoofBaseQuantities (GrossArea/NetArea/ProjectedArea): https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/Qto_RoofBaseQuantities.htm
- IfcSlab (PredefinedType=ROOF): https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcSlab.htm

**Autodesk Revit (primary):**
- Roof creation methods (Footprint/Extrusion/Face) + per-edge slope flags: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-ArchDesign/files/GUID-FF37F25A-D805-4F2E-B9FC-4372CAFDF4FC.htm
- Attach Walls to Other Elements (wall-to-roof): https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-ED60CE62-B955-45E9-9D7D-00F1552D858C
- Roof types / compound structure & tapered insulation: https://rescreeningmasters.com/revit-sloped-roof-tapered-insulation-design-modeling/

**Graphisoft ArchiCAD (primary):**
- Multi-plane/Single-plane, pivot line, pitch units, negative pitch: https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-60.htm , https://help.graphisoft.com/AC/22/INT/_AC22_Help/140_UserInterfaceToolSettings/140_UserInterfaceToolSettings-4.htm

**Reference (roof shapes):**
- List of roof shapes: https://en.wikipedia.org/wiki/List_of_roof_shapes

### Caveats (από την έρευνα)
- **Αδύναμη κάλυψη** για Vectorworks / Allplan / Tekla (καμία επαληθευμένη πηγή — αν χρειαστεί, νέα στοχευμένη έρευνα).
- ArchiCAD/Revit findings είναι single-vendor docs (σταθερά στις εκδόσεις που παρατέθηκαν, αλλά μη-ανεξάρτητα).
- Απορρίφθηκε (1-2): ισχυρισμός ότι το IFC enum ορίζει «distinct slope geometry» ανά τύπο — το enum **μόνο ταξινομεί**.

---

## 9. Changelog

- **2026-06-05** — **Roof 3D material rendering + CC0 κεραμίδι + material-list SSoT — FULL ENTERPRISE/SSOT (Opus).** Ο Giorgio: «θέλω δωρεάν υλικό κεραμοσκεπής (μηδέν θέμα αδειών) που να φαίνεται στο 3D». **(Α) Roof έδειχνε υλικό.** Το `roofToMesh` έκανε hardcode `getElementMaterial3D('slab')` (concrete deck Φ1) → η στέγη ΑΓΝΟΟΥΣΕ τελείως το υλικό των στρώσεων (ό,τι κι αν διάλεγε ο χρήστης στον Edit-Type, μηδέν αλλαγή 3D). FIX: NEW `resolveRoofSurfaceMaterialId(roof)` → **top DNA layer** (`dna.layers[0].materialId`, Revit «η εμφάνιση = η εξωτερική κάλυψη») → `params.material` → fallback `elem-roof`· render μέσω `getMaterial3D` (ΟΧΙ element fallback). **+world-meter UVs**: η γεωμετρία στέγης είχε μόνο `position` → καμία υφή· προστέθηκε `setBoxWorldUvs(flat)` (per-face world-axis· reuse ADR-413 SSoT) + uv2 για aoMap. **(Β) CC0 κεραμίδι.** NEW built-in texture slug `'roof-tiles'` (Poly Haven «roof_tiles_14», **CC0** — μηδέν άδεια, ίδια πηγή με τα 7 υπάρχοντα· `public/textures/roof-tiles/{albedo,normal,roughness,ao}.jpg` 2K) + NEW DNA material `mat-roof-tile` (terracotta `0x9e4a2c`, `MATERIAL_TEXTURE_MAP→'roof-tiles'`) + `elem-roof` element key. Η built-in «Κεραμοσκεπή» (`roof-buildup.ts`) top layer `mat-tile`→**`mat-roof-tile`**. Κατηγορία `roofing`→`roof-tiles` (2D swatch + library `bmat_` roofing). **(Γ) Material-list SSoT (Boy-Scout N.0.2).** Ο `EditRoofTypeDialog` είχε ΔΙΚΗ του `MATERIAL_OPTIONS` (`rc`/`tile`/`wood` — λεξιλόγιο που ΔΕΝ έδενε με το material catalog → render-άρε concrete) ΞΕΧΩΡΙΣΤΗ από το `SLAB_MATERIAL_IDS` του `SlabDnaEditor`. NEW SSoT `bim/materials/construction-materials.ts` (`CONSTRUCTION_MATERIAL_IDS` + `isConstructionMaterialId` + `constructionMaterialLabelKey`) — **μία λίστα** που καταναλώνουν ΚΑΙ οι δύο editors· το roof dialog πλέον χρησιμοποιεί `mat-*` ids (σωστό 3D mapping). **Friendly labels** (Revit material-browser): NEW i18n `constructionMaterials.*` (el+en, dxf-viewer-shell) — οι pickers δείχνουν «Κεραμίδι στέγης»/«Σκυρόδεμα» αντί raw `mat-roof-tile`. Αρχεία: NEW `construction-materials.ts` + `public/textures/roof-tiles/*` · MOD `roof-to-three.ts`, `roof-buildup.ts`, `material-catalog-defs.ts`, `bim-texture-registry.ts`, `material-thumbnail-resolver.ts`, `SlabDnaEditor.tsx`, `EditRoofTypeDialog.tsx`, i18n el+en. 31 roof/slab/family-type tests PASS, tsc 0 (πλην pre-existing mesh-to-object3d:124 ADR-411). ADR-040-neutral (converter + low-freq UI). ΜΑΘΗΜΑ: το roof Φ1 ποτέ δεν έδενε το per-layer material στο 3D (deferred Φ2)· + 2 διπλότυπες material-λίστες με ασύμβατα λεξιλόγια. **(Δ) ΠΛΗΡΗΣ ΑΛΗΘΟΦΑΝΕΙΑ — per-layer sub-solids + κορφιάδες (Giorgio follow-up «όπως οι μεγάλοι/Revit, πλήρη αληθοφάνεια»).** Το (Α) έδειχνε ΕΝΑ υλικό (top layer) σε όλο το solid → το περιμετρικό πάχος έβγαινε κεραμίδι. **Revit «Fine»:** το `roofToMesh` σπάει κάθε «νερό» σε **ένα sub-solid ΑΝΑ DNA στρώση** (`buildFaceLayerSolids` — γενικό `buildDepthPrism(topDepthMm,botDepthMm)` slope-parallel slicing top→bottom), καθένα με το υλικό του (`getMaterial3D(layer.materialId)`) → πάνω όψη=κεραμίδι, κάτω=σοβάς, **περιμετρικό=στοίβα στρώσεων** (κάθε μπάντα το υλικό της), 1:1 με τους per-DNA-layer τοίχους. Monolithic fallback (χωρίς dna) κρατά single solid. **+Κορφιάδες (ridge/hip caps):** `addRidgeCaps` διαβάζει `geometry.ridges` (kind `ridge`/`hip`) → `buildRidgeCap` ημικυλινδρικός dome (semicircle cross-section, flat-down, swept κατά μήκος a→b· `RIDGE_CAP_RADIUS_M=0.09`) με υλικό `mat-roof-tile`· eave/valley → χωρίς cap. **SSoT fix:** `roof-buildup` battens/sarking `mat-timber`→`mat-wood` (το `mat-timber` ΔΕΝ υπήρχε στο catalog→render-άρε concrete). roof-to-three 343 γραμμές (<500). 31 roof tests PASS, tsc 0. ΜΑΘΗΜΑ: το `geometry.ridges` Φ1 παράγει ΜΟΝΟ `kind:'ridge'` (όχι hip/eave)· τα eave edges παράγονται από `params.edges.definesSlope===false`. 🔴 browser verify (στέγη με κεραμίδι + στρώσεις στο περιμετρικό + κορφιάδες). 🔴 browser verify (hard refresh→στέγη με κεραμίδι· top layer «Κεραμίδι στέγης») + commit pending. **DEFERRED:** (1) **Γείσο: overhang + fascia + soffit** (Giorgio ζήτησε — eave detailing από `params.edges` definesSlope===false· proper-eave board sweep· ΜΕΓΑΛΥΤΕΡΟ geometry task)· (2) library `bmat_` materials στον SlabDnaEditor (όπως WallDnaEditor library group) — Revit-parity follow-up.

- **2026-06-05** — **Φ1-part-2 #3: Roof Family-type UI — FULL ENTERPRISE/SSOT (Opus, Plan Mode).** Η στέγη έγινε πλήρες Revit Type/Instance family-type entity, 1:1 με την πλάκα (ADR-412): Edit-Type dialog με live 3D layer preview, auto-assign, re-resolution «edit type → όλες οι στέγες ενημερώνονται», per-instance material override, delete-warn-detach, all-floors BOQ refeed. **🐛 root-cause που έκλεισε:** το `typeId`/`typeOverrides` ΔΕΝ persist-άρονταν → ο τύπος χανόταν σε reload (μόνο dna/thickness round-trip)· χωρίς αυτό το re-resolution δεν λειτουργεί. **RECOGNITION:** το Φ1 είχε ΗΔΗ `RoofEntity.typeId?`/`typeOverrides?`, `RoofTypeParams`, 2 built-ins (concrete/tiled), `UpdateRoofParamsCommand`+`RoofTypeChange`, minimal combobox, `ROOF_TRACKED_FIELDS`, γενικό `resolveEffectiveParams`· το `BimFamilyTypeService` ήδη roof-aware. **Πρότυπο = SLAB** (footprint + layered `SlabDna`· roof DNA *είναι* `SlabDna` → reuse `SlabDnaEditor`+`SlabTypePreviewPanel` χωρίς fork). FIX: (core) `resolveEffectiveRoofParams` + NEW `roof-type-auto-assign.ts` (non-destructive match-gate, creation+load) + roof helpers στο `family-type-ui-helpers` (`ROOF_OVERRIDABLE_KEYS=['material']`). (persistence) `RoofDoc`/`RoofSaveInput`/`RoofUpdateInput` +`typeId`/`typeOverrides` (null→`deleteField`)· `entityToSaveInput`/`docToEntity`· `RoofEntitySchema` validation· NEW `roof-persistence-helpers.ts` (`docToEntity` type-resolved + `reresolveSceneRoofs` + `resolveRoofParamsFromStore` + `roofTypeLinkChanged` + `roofEntityDiffersFromDoc`)· `useRoofPersistence` type-link guard + NEW `useRoofTypeReresolution` mount. (commands) NEW `AssignRoofTypeCommand` + `UpdateRoofFamilyTypeCommand` + `createDeleteRoofFamilyTypeCommand` (CompoundCommand single-undo, all undoable). (UI) NEW `useRoofFamilyTypeController` + `RibbonRoofFamilyTypeWidget` (picker+Edit/Duplicate/Delete) + `RibbonRoofTypePropertiesWidget` (material override badge/reset+rename) + `EditRoofTypeDialog` + `edit-roof-type-store`· wired στο `RibbonPanel` + `contextual-roof-tab` (αντικατέστησε τον minimal combobox)· **αφαιρέθηκε το dead `roofType` assignment path** από `useRibbonRoofBridge` (SSoT — μία διαδρομή μέσω controller). (side-effects) `findRoofsByTypeId` + `refeedRoofBoqForTypeAcrossFloors` στο `family-type-side-effects` + `'roof'` branch στο `useFamilyTypeBoqRefeed` + `'roof'` στο `bim:family-type-changed` union. (mount) `RoofPersistenceHost` renders `<EditRoofTypeDialog/>`. **Audit parity:** το `typeId` ΔΕΝ μπήκε στο `ROOF_TRACKED_FIELDS` — ούτε wall/slab το tracking-άρουν (το family-type change audit-άρεται ξεχωριστά μέσω `bim_family_type`). i18n: NEW `roofFamilyType.*` + `bimFamilyType.builtin.roof.{concrete,tiled}` (el+en, CHECK 3.8 ratchet-positive· μηδέν hardcoded). ~28 αρχεία· `resolve-effective-params` +roof / NEW `roof-type-auto-assign` (28 tests) + NEW `roof-family-type-commands` (8 tests) PASS· tsc 0 δικά μου. ADR-040: `EditRoofTypeDialog`/widgets ΔΕΝ είναι micro-leaf (low-freq store subs)· `RoofRenderer` ανέπαφο. 🔴 browser verify (edit type→live re-flow· Duplicate-to-edit· override+reset· delete→warn→detach· **reload→τύπος επιβιώνει**· BOQ m²) + commit pending.

- **2026-06-05** — **Φ1-part-2 #4: V/G category `'roof'` — FULL SSOT (Opus, Plan Mode).** RECOGNITION αποκάλυψε ότι το Φ1 είχε ΗΔΗ καταχωρήσει το `'roof'` σε `DEFAULT_OBJECT_STYLES` (pen 5/6), `BIM_CATEGORIES`, `MODEL_BIM_CATEGORIES` και `DISCIPLINE_BY_CATEGORY` (`architectural`) — το V/G UI είναι data-driven από `BIM_CATEGORIES` άρα η στέγη ήδη εμφανιζόταν στο Visibility/Graphics. Το **μόνο** κενό ήταν το piggyback `'slab'` στο sync, που έκανε τη στέγη να ακολουθεί τη visibility/discipline της πλάκας αντί τη δική της. FIX (2 αρχεία, μηδέν αλλαγή στον γενικό ADR-382 resolver): (3D) `BimSceneLayer.syncRoofs` → `resolveEntity(roof, 'roof', ctx)`· (2D) `RoofRenderer.render` → minimal `roof.visible` guard αντικαταστάθηκε με `resolveIsEntityVisible({ category: 'roof', layerId, discipline }, { objectStyles, disciplineVisibility, layer })` (1:1 με SlabRenderer· κρατήθηκε cheap per-element `roof.visible === false` short-circuit). Τώρα: hide «Στέγες» στο V/G ≠ hide «Πλάκες»· architectural discipline toggle κρύβει στέγες (όχι το structural). +2 tests (`visibility-resolver.test.ts`: roof στο per-category isolation loop + architectural-not-structural discipline). ADR-040: το RoofRenderer είναι entity renderer (CHECK 6D → οποιοδήποτε ADR staged αρκεί· ADR-417 staged)· η αλλαγή είναι ADR-040-neutral (event-time resolver call, μηδέν νέα subscription, mirror SlabRenderer). tsc 0 δικά μου. ✅ **BROWSER-VERIFIED** (Giorgio: ON/OFF στέγης λειτουργεί). **Boy-Scout i18n (N.11) κατά το verify:** το V/G dialog (`VisibilityGraphicsPanel`, key `ribbon.commands.objectStyles.categories.<cat>`) εμφάνιζε raw keys για 10 νεότερες κατηγορίες (light-fixture/electrical-panel/mep-manifold/railing/mep-wire/furniture/duct/pipe/sanitary/kitchen — `roof` ήταν ήδη «Στέγη»)· προστέθηκαν el+en (`dxf-viewer-shell.json`, ratchet-positive CHECK 3.8). 🔴 commit pending.

- **2026-06-05** — **Φ1-part-2 #5 (audit SSoT/wiring) + #8 (icon) — FULL ENTERPRISE/SSOT (Opus).** (#5) **Audit τώρα δουλεύει πραγματικά.** Το Φ1 roof-audit-client ποστάριζε `entityType:'roof'` αλλά το route το απέρριπτε σιωπηλά (400 → fire-and-forget swallow): το `'roof'` έλειπε από `AuditEntityType` union, `VALID_ENTITY_TYPES` **και** `ENTITY_COLLECTION_MAP`. Προστέθηκαν και στα τρία (`ENTITY_COLLECTION_MAP.roof = FLOORPLAN_ROOFS`· ownership-check διαβάζει `RoofDoc.companyId`). Το local `ROOF_TRACKED_FIELDS` μεταφέρθηκε στο **κεντρικό SSoT** `config/audit-tracked-fields.ts` (`mergeDefs` pattern, enriched +`material` +`dna` JSON-scalar mirror wall/slab· coordinate-heavy `outline`/`edges` σκόπιμα OUT) + `case 'roof'` στο `getTrackedFieldsForEntityAuditType`· `roof-audit-client` importάρει το SSoT (μηδέν local duplicate). Αφαιρέθηκαν 2 stale `as`-casts στο `useRoofPersistence` (`BimEntityType`/`BimRestoreEntityTypeFwd` ήδη περιείχαν `'roof'`). (#8) Δικό `bim-roof` icon (inline gable glyph) + ribbon switch από `bim-slab`. Αρχεία: `config/audit-tracked-fields.ts`, `types/audit-trail.ts`, `api/audit-trail/record/route.ts`, `bim/roofs/roof-audit-client.ts`, `hooks/data/useRoofPersistence.ts`, `ui/ribbon/components/buttons/RibbonButtonIcon.tsx`, `ui/ribbon/data/home-tab-draw.ts`. 18/18 roof tests PASS, tsc 0 (πλην pre-existing mesh-to-object3d:124 ADR-411). 🔴 browser verify + commit pending. (Απομένουν §10: #3 family-UI, #4 V/G category, #6 contextual-tab tests, #7 hip Φ2.)

- **2026-06-05** — **Φ1-part-2 #2: 2D-select fix + GRIPS «Edit Footprint» (Opus, Plan Mode).** (Α) **2D-select fix** — η στέγη επιλεγόταν ΜΟΝΟ στο 3Δ. Αιτία: το `HitTestingService.convertToEntityModel()` δεν είχε `case 'roof'` → έπεφτε στο `default` (χωρίς `geometry`/`params`) → `BoundsCalculator` έβλεπε `geometry===undefined` → null bounds → σιωπηλό drop από το spatial index → `RoofRenderer.hitTest()` δεν καλούνταν ποτέ. FIX: νέο `case 'roof'` με **geometry-recompute fallback** (`rf.geometry ?? computeRoofGeometry(rf.params)`, mirror column/mep-segment) — απαραίτητο γιατί το `RoofDoc` persist-άρει params μόνο (geometry re-derivable, σκόπιμα omitted), άρα Firestore-loaded στέγη φτάνει χωρίς geometry. (Β) **Grips** — νέος `roofGripKind` discriminant (`roof-vertex-${n}` + `roof-edge-midpoint-${n}`): per-vertex move + edge-midpoint insert + vertex delete (Delete key PRIORITY 0.5 + right-click «Διαγραφή/Προσθήκη γωνίας»). Όλες οι αλλαγές → `UpdateRoofParamsCommand` (μηδέν νέο geometry path, merge-window single-undo). 🔑 **edges ↔ vertices lockstep** (≠ slab): το `RoofParams.edges` είναι παράλληλο με `outline.vertices` και το `validate()` απαιτεί ίδιο μήκος — insert κάνει splice **αντίγραφο** του `edges[N]` (Revit «split keeps parent slope»), delete φιλτράρει ΚΑΙ τα δύο arrays. NEW `bim/roofs/roof-grips.ts` (pure `getRoofGrips`/`applyRoofGripDrag`/`removeVertexFromRoof`) + `__tests__/roof-grips.test.ts` (12/12 PASS) + 16 wiring edits (HitTestingService, RoofRenderer.getGrips, grip-kinds/-types/useGripMovement/unified-grip-types/grip-registry/grip-computation [+case 'roof']/grip-parametric-commits [commitRoofGripDrag]/grip-commit-adapters/grip-projections, entity-preview-types/apply-entity-preview/draw-ghost-entity [+case 'roof' live footprint ghost]/grip-drag-preview-transform, grip-context-menu-resolver/useGripContextMenuController [onSlabVertexOp roof branch], useSmartDelete). FULL SSOT: ένας polygon-vertex-op dispatcher για slab+roof. tsc 0 (πλην pre-existing mesh-to-object3d:124 ADR-411). 🔴 browser verify + commit pending.

- **2026-06-05** — **🐛 ROOT-CAUSE FIX: winding-agnostic engine.** Η αλλαγή μορφής/κλίσης «δεν φαινόταν» (όλες οι στέγες έβγαιναν επίπεδες, `ridgeHeightMm=0` παρότι `shape='gable'`/`faces=2`). Αιτία: το `computeRoofGeometry`/`resolveEavePlanes` υπέθετε **CCW** footprint — το `inwardNormal` επέστρεφε το αριστερό κάθετο (εσωτερικό μόνο για CCW). Για **CW** footprint (όπως σχεδιάζει συχνά ο χρήστης) το «εσωτερικό» κάθετο έδειχνε ΕΞΩ → `eaveDistance` αρνητικό → `max(0,…)=0` παντού → μηδενικό rise → επίπεδη στέγη. FIX: νέα `polygonSignedAreaXY` + `windingSign` (καθαρά αλγεβρικό, ανεξάρτητο y-up/y-down)· `inwardNormal(v0,v1,sign)` πολλαπλασιάζει με −1 για CW ώστε το κάθετο να δείχνει ΠΑΝΤΑ μέσα. Εφαρμόζεται σε `resolveEavePlanes` + `applyRoofShapePreset`. Το render pipeline (dispatch→command→3D resync) ήταν εξαρχής σωστό (επιβεβαιώθηκε με console diagnostics). NEW engine tests `bim/geometry/__tests__/roof-geometry.test.ts` (6/6 PASS: CW & CCW gable/mono ridge>0, CW≈CCW, flat=0, gross>projected) — καλύπτει §10 #6 (μερικώς).

- **2026-06-05** — **Φ1-part-2 #1 + delete-event (Opus, Plan Mode).** Contextual ribbon tab «Στέγη» + `UpdateRoofParamsCommand`. Όταν επιλέγεται μια στέγη → tab με: **Μορφή** (flat/μονόρριχτη/δίρριχτη, preset μέσω `applyRoofShapePreset`)· **Κλίση** + **toggle μοίρες↔ποσοστό** (`roofSlopeToRatio`/`roofSlopeFromRatio`, conversion διατηρεί γεωμετρία)· **Στάθμη γείσου** (basePivotZ)· **Roof Type** picker (minimal: assign typeId + dna/thickness από built-in). Κάθε αλλαγή = undoable `UpdateRoofParamsCommand` (recompute geometry + validation atomically· optional `typeChange` patch). FULL SSOT: το shape/slope **παράγονται** από `params.edges`/`geometry.shape`, δεν αποθηκεύονται ως πεδία. 4 νέα αρχεία (`core/commands/entity-commands/UpdateRoofParamsCommand.ts` + `ui/ribbon/hooks/bridge/roof-command-keys.ts` + `ui/ribbon/hooks/useRibbonRoofBridge.ts` + `ui/ribbon/data/contextual-roof-tab.ts`) + wiring σε `app/ribbon-contextual-config.ts` (register + `resolveContextualTrigger`/activeTool + `BIM_KIND_TYPES`), `app/useDxfBimBridges.ts`, `app/useDxfViewerRibbon.ts`, `ui/ribbon/hooks/useRibbonCommands.ts` (routing) + i18n el+en (`roofProperties`/`roofEditor.*`). **Delete:** `bim:roof-delete-requested` + `bim:roof-params-updated` στο drawing-event-map· uncomment listener στο `useRoofPersistence`· roof batch στο `useSmartDelete`. ΕΚΤΟΣ ADR-040 (μόνο ribbon/commands/persistence). tsc 0 (πλην pre-existing mesh-to-object3d:124 ADR-411). 🔴 browser verify + commit pending.

- **2026-06-04** — Δημιουργία ADR. Ολοκλήρωση βαθιάς έρευνας (IFC/Revit/ArchiCAD), καταγραφή ευρημάτων, χαρτογράφηση αρχείων-προτύπων.
- **2026-06-04** — Κλείδωμα αποφάσεων Q1–Q8 (Giorgio, AskUserQuestion): και οι 4 μορφές (hip→Φ2), footprint+per-edge slopes (Revit-style), μοίρες+ποσοστό, Roof Types (ADR-412), wall-attach→Φ4. Status → ACCEPTED (design). Roadmap 6 φάσεων. Εκκρεμεί έγκριση execution-mode (N.8) πριν υλοποίηση.
- **2026-06-04** — **Φ1 υλοποίηση (Opus, Orchestrator + 4 subagents).** Νέο παραμετρικό entity `'roof'` + pure SSoT μηχανή `computeRoofGeometry` (lower-envelope per-edge rising planes: flat / mono-pitch / gable· hip→Φ2 graceful flat fallback) με GrossArea (κεκλιμένο) + ProjectedArea. Παραδοτέα: types/schemas/μηχανή/buildup (concrete δώμα + κεραμοσκεπή)· factory + enterprise-id (`roof`) + collection `FLOORPLAN_ROOFS`· 6 πύλες καταγραφής (bim-base/entities-guard/dxf-scene-entity-converter/EntityRendererComposite/entity-bounds/bim-bounds/hitTesting-Bounds) + 2D pipeline (dxf-types/dxf-renderer-entity-model)· 2D RoofRenderer (faces+ridges)· 3D `roof-to-three` (units-safe, ShapeUtils + axis convention column/wall)· 3D feed (Bim3DEntitiesStore `roofs` slice + aggregator + BimSceneLayer.syncRoofs)· drawing tool `useRoofTool` + `roof-completion` (footprint polygon, default flat)· persistence (roof-firestore-service + useRoofPersistence + RoofPersistenceHost mount) με N.6 setDoc· Roof Types built-ins (ADR-412: «Μπετονένιο δώμα»+«Κεραμοσκεπή»)· BOQ (OIK-7.01 m² κεκλιμένο)· ribbon «Στέγη» (RF) + i18n el+en. **Φ1-part-2 (βλ. §10):** grips, contextual-tab (shape preset + slope deg↔percent UI), family-type edit-dialog/auto-assign, V/G category 'roof', roof-delete EventBus, audit-tracked-fields SSoT entry.

## 10. Φ1-part-2 — Εκκρεμότητες (documented follow-ups)

Η μηχανή ΥΠΟΣΤΗΡΙΖΕΙ ήδη flat/mono/gable· λείπει το **property UI** για να τα ορίσει ο χρήστης (το drawing tool παράγει default flat). Εκκρεμή:

1. ✅ **DONE (2026-06-05, Opus)** — **Contextual ribbon tab «Στέγη»** — μορφή (flat/mono/gable preset μέσω `applyRoofShapePreset`) + κλίση με toggle μοίρες↔ποσοστό (`roofSlopeToRatio`/`roofSlopeFromRatio`) + base elevation + Roof Type picker (minimal: built-in assign + dna/thickness). Νέος `UpdateRoofParamsCommand` (undoable, optional `typeChange`). 4 νέα αρχεία (command + roof-command-keys + useRibbonRoofBridge + contextual-roof-tab) + wiring (ribbon-contextual-config / useDxfBimBridges / useDxfViewerRibbon / useRibbonCommands) + i18n el+en. 🔴 browser verify pending.
2. ✅ **DONE (2026-06-05, Opus)** — **2D-select fix + Grips «Edit Footprint»** — per-vertex move + edge-midpoint insert + vertex delete μέσω `roofGripKind` discriminant (NEW `bim/roofs/roof-grips.ts` + 16 forwarding edits + 2D-select `case 'roof'` με geometry-recompute fallback στο HitTestingService). edges↔vertices lockstep (validate). 12/12 grip tests PASS. 🔴 browser verify pending. (βλ. §9 changelog 2026-06-05.)
3. ✅ **DONE (2026-06-05, Opus — Plan Mode, FULL ENTERPRISE/SSOT)** — **Family-type UI** (πλήρες ADR-412 plug-in, Revit Type/Instance, πρότυπο slab). **🐛 root-cause που έκλεισε:** το `typeId`/`typeOverrides` ΔΕΝ persist-άρονταν (`RoofDoc`/`RoofSaveInput`/`RoofUpdateInput`/`entityToSaveInput`/`docToEntity` τα αγνοούσαν) → ο τύπος **χανόταν σε reload**. Παραδοτέα: (core) `resolveEffectiveRoofParams` + `roof-type-auto-assign.ts` (non-destructive match-gate) + roof helpers στο `family-type-ui-helpers` (`ROOF_OVERRIDABLE_KEYS=['material']`). (persistence) `RoofDoc`/save/update +`typeId`/`typeOverrides` (null→`deleteField`)· `RoofEntitySchema` validation· NEW `roof-persistence-helpers.ts` (`docToEntity` type-resolved + `reresolveSceneRoofs` + `roofTypeLinkChanged`)· `useRoofPersistence` type-link guard + `useRoofTypeReresolution` mount· auto-assign στο creation (`buildRoofEntity`). (commands) `AssignRoofTypeCommand` + `UpdateRoofFamilyTypeCommand` + `createDeleteRoofFamilyTypeCommand` (CompoundCommand warn-detach) — όλα undoable. (UI) `useRoofFamilyTypeController` + `RibbonRoofFamilyTypeWidget` (picker+Edit/Duplicate/Delete) + `RibbonRoofTypePropertiesWidget` (material override badge/reset) + `EditRoofTypeDialog` (reuse `SlabDnaEditor` + `SlabTypePreviewPanel` — roof DNA=`SlabDna`, μηδέν fork)· αντικατέστησε τον minimal combobox (αφαιρέθηκε το dead `roofType` path από `useRibbonRoofBridge`). (side-effects) `refeedRoofBoqForTypeAcrossFloors` + roof branch στο `useFamilyTypeBoqRefeed` + `'roof'` στο `bim:family-type-changed` union. ~28 αρχεία· 28+8 νέα tests PASS, tsc 0 δικά μου. 🔴 browser verify (edit type→όλες οι στέγες live· Duplicate-to-edit· override material+reset· delete→warn→detach· **reload→ο τύπος επιβιώνει**) + commit pending.
4. ✅ **DONE + BROWSER-VERIFIED (2026-06-05, Opus — Plan Mode· Giorgio «τώρα λειτουργεί ON/OFF στέγης»)** — **V/G category `'roof'`**. Αποκάλυψη: το config ήταν ΗΔΗ έτοιμο από Φ1 (`'roof'` σε `DEFAULT_OBJECT_STYLES`/`BIM_CATEGORIES`/`MODEL_BIM_CATEGORIES` + discipline `architectural`)· έλειπε ΜΟΝΟ το **wiring στο sync** (Φ1 piggyback `'slab'`). FIX 2 αρχεία: (3D) `BimSceneLayer.syncRoofs` `resolveEntity(roof,'slab')` → `'roof'`· (2D) `RoofRenderer` minimal `roof.visible` guard → `resolveIsEntityVisible({category:'roof', discipline})` (1:1 SlabRenderer, διατηρεί per-element short-circuit). Ο resolver (ADR-382) είναι γενικός → μηδέν αλλαγή. Αποτέλεσμα: η στέγη κρύβεται/εμφανίζεται ανεξάρτητα από την πλάκα (Revit-parity) + ακολουθεί το **architectural** discipline toggle (όχι structural). +2 roof tests στο visibility-resolver.test.ts (V/G isolation + architectural discipline).
5. ✅ **DONE (2026-06-05, Opus — FULL ENTERPRISE/SSOT)** — **delete-event** (`bim:roof-delete-requested` + `bim:roof-params-updated` στο drawing-event-map· listener στο useRoofPersistence· batch emit στο useSmartDelete) **+ audit SSoT/wiring**. (Α) `ROOF_TRACKED_FIELDS` μεταφέρθηκε από local στο **κεντρικό SSoT** `config/audit-tracked-fields.ts` (ίδιο μοτίβο με τα 7 BIM entities· enriched: +`material` +`dna` JSON-scalar mirror wall/slab) + `case 'roof'` στο `getTrackedFieldsForEntityAuditType`· `roof-audit-client.ts` καταναλώνει το SSoT (μηδέν local). (Β) **🐛 root-cause: το roof audit έκανε σιωπηλό 400** — το `'roof'` έλειπε από `AuditEntityType` union (`types/audit-trail.ts`), `VALID_ENTITY_TYPES` **και** `ENTITY_COLLECTION_MAP` (`api/audit-trail/record/route.ts` → `FLOORPLAN_ROOFS`). Προστέθηκαν και στα τρία (ίδιο pattern με ADR-406/408 «was missing… fixed»). (Γ) Αφαιρέθηκαν 2 stale `as`-casts στο `useRoofPersistence` (`'roof' as BimEntityType` / `as BimRestoreEntityTypeFwd`) — τα unions ήδη περιείχαν `'roof'` (μηδέν `as`, N.2). 🔴 browser verify (delete στέγης → History row) + commit pending.
6. **Tests** — ✅ engine unit tests (`roof-geometry.test.ts` 6/6) + ✅ grip tests (`roof-grips.test.ts` 12/12, move/insert/delete + edges-lockstep + rectilinear)· εκκρεμή: contextual-tab/bridge tests.
7. **Hip (Φ2)** — straight-skeleton solver.
8. ✅ **DONE (2026-06-05, Opus)** — **Δικό icon** `bim-roof` (inline gable glyph: peak slopes + eave line) στο `RibbonButtonIcon.tsx`· ribbon `home-tab-draw.ts` `icon: 'bim-slab'` → `'bim-roof'` (διακριτό από slab `Layers`).
