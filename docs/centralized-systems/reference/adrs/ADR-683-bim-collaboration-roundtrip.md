# ADR-683 — Συνεργατικό round-trip: παράδοση project σε εξωτερικό μηχανικό και επιστροφή

**Status:** 🟡 IN PROGRESS — Φ1 (ADR-678) DONE · **Φ2 DONE** (glTF import + geometry fingerprint + manifest + **UI καλωδίωση**) · **per-face round-trip (ADR-678 Φ3, ΜΟΝΟ glTF) DONE 2026-07-21** (κλείνει το «🔴 ΓΝΩΣΤΟ ΟΡΙΟ» του Φ2 hotfix, βλ. §11) · **Φ3α DONE** (τύπος `imported-mesh`: 2Δ+3Δ+move/rotate, 20 anchors) · **Φ3β DONE** (καλωδίωση εισαγωγής) · **Φ3.1α DONE** (μοντέλο κοστολόγησης) · **Φ3.1β DONE** (διεπαφή ανάθεσης — ⚠️ **καμία επαλήθευση στον browser**) · **§units DONE** (ρητή μονάδα εισαγωγής glTF, §10.5 — ⚠️ **καμία επαλήθευση στον browser**) · **§render-gate DONE** · **§project-scope DONE** · **§mesh-load DONE** (register ανά αρχείο) · **§mesh-load-nesting DONE** (κοινός deep walker parse↔index· η καρέκλα σμιλεύεται — ⚠️ **εκκρεμεί τελική επαλήθευση browser**, βλ. §11) · Φ3.1γ (μνήμη κανόνων) / Φ4 TODO
**Date:** 2026-07-20
**Owner:** Giorgio
**Σχετικά:** ADR-678 (C4D material round-trip — **γίνεται η Φ1 αυτού του σχεδίου**) · **ADR-679 (PBR full parity — ιδιοκτήτης όλου του PBR/υφών· αυτό το ADR ΔΕΝ το επαναλαμβάνει)** · ADR-668 (mesh3d export OBJ/glTF) · ADR-413 (BimMaterial library + PBR textures) · ADR-539 (per-face appearance) · ADR-449 (structural finish skin) · ADR-511 (material catalog SSoT)

---

## 1. Πρόβλημα (το όραμα του Giorgio, 2026-07-20)

Ο Νέστωρ χτίζεται για να γίνει πλήρες πρόγραμμα στο επίπεδο C4D / Blender / Rhino / SketchUp.
Ένα κρίσιμο κομμάτι που λείπει είναι η **συνεργασία μεταξύ μηχανικών**:

> Ένας μηχανικός δουλεύει στον Νέστορα και έχει καταλήξει πώς θα κατασκευαστεί το κτίριο. Θέλει να
> δώσει **όλο το project** σε άλλον μηχανικό για επεξεργασία: να βάλει κάγκελα, να αλλάξει το ύψος
> στα στηθαία, να κάνει επιφάνειες γυάλινες ή καθρέφτες, να βάλει χρώματα/υφές/υλικά, να
> διαφοροποιήσει τα κουφώματα. Και μετά να **επιστρέψει το αρχείο** στον Νέστορα **χωρίς να
> γκρεμιστεί η αρχική κατασκευή**, με τον Νέστορα να **αντιλαμβάνεται** τι αντικαταστάθηκε, τι
> διορθώθηκε, πού άλλαξε χρώμα, πού υφή, πού οι τιμές φωτορεαλισμού.

## 2. Ground truth — τι ΥΠΑΡΧΕΙ ήδη (μετρημένο 2026-07-20)

**Το θεμέλιο είναι ήδη χτισμένο.** Δεν ξεκινάμε από το μηδέν:

| Ικανότητα | Κατάσταση | Πού ζει |
|---|---|---|
| Export OBJ + `.mtl` | 🟢 DONE | `export/formats/mesh3d-export-adapter.ts` (ADR-668) |
| Export glTF/GLB | 🟢 DONE | ίδιο adapter, `serialiseGlb` |
| **Σταθερή ταυτότητα στο όνομα mesh** | 🟢 DONE | `mesh3d-naming.ts::buildMeshName` |
| Import υλικών/χρωμάτων (OBJ) | 🟢 DONE | `io/mesh3d-material-import/` (ADR-678 Φ1+Φ1.1) |
| Name→bimId matching | 🟢 DONE | `match-objects-to-entities.ts` (forward map, όχι reverse-parse) |
| Ατομικό undo εισαγωγής | 🟢 DONE | ΕΝΑ `CompositeCommand` |

**Το κανάλι ταυτότητας** (ADR-678 §2) είναι το κλειδί όλου του σχεδίου:

```
[HIDDEN_]<Όροφος>_<Κατηγορία>_<bimId>[_N]
π.χ. Ισόγειο_Wall_w-42
```

### 2.1 Τα πραγματικά κενά (μετρημένα, όχι εικαζόμενα)

| # | Κενό | Σοβαρότητα |
|---|---|---|
| **Κ1** | ~~Δεν υπάρχει glTF/GLB import~~ → 🟢 **ΛΥΘΗΚΕ ΠΛΗΡΩΣ** (parser Φ2 + **UI Φ2-UI**: `accept=".glb,.gltf,.obj,.mtl"` στο ένα κουμπί εισαγωγής). Το OBJ μονοπάτι παραμένει text-only by design. | 🟢 DONE |
| **Κ2** | **Καμία έννοια «εισαγόμενης γεωμετρίας»** στο BIM μοντέλο. Τα unmatched objects απλά αναφέρονται και **αγνοούνται** → τα κάγκελα του εξωτερικού **χάνονται**. | 🔴 Κρίσιμο |
| **Κ3** | Textures (`map_Kd`) αγνοούνται στο import. | 🟡 ADR-678 Φ2 |
| **Κ4** | PBR ανά όψη (γυαλί/καθρέφτης/υφές) — **ιδιοκτησία ADR-679**, Φ2a ήδη DONE (library + textures + render + ενοποιημένος color registry)· εκκρεμούν Φ2b/Φ2c. | 🟢 Καλύπτεται αλλού |
| **Κ5** | Καμία ανίχνευση αλλαγής γεωμετρίας — αν ο εξωτερικός σηκώσει στηθαίο, ο Νέστωρ **δεν το μαθαίνει ποτέ**. | 🟡 |
| **Κ6** | Καμία εξαγωγή/εισαγωγή DAE. | 🟢 Χαμηλή (βλ. §6) |

## 3. Το θεμελιώδες όριο (100% ειλικρίνεια)

**Τα mesh formats είναι μονόδρομος.** Ο Νέστωρ κρατά παραμετρικά (`Wall{h:300,t:25,...}`)· τα
OBJ/DAE/FBX/glTF κρατούν ψημένα τρίγωνα.

```
Νέστωρ:  Wall{h:300, t:25}  →  108 vertices   ✅ πλήρες
C4D:     108 πειραγμένα vertices  →  Wall{h:?} ❌ ΑΔΥΝΑΤΟ
```

Καμία εφαρμογή στον κόσμο δεν συμπεραίνει «αυτό είναι στηθαίο με νέα παράμετρο ύψους» από τρίγωνα.
Ούτε το Revit — γι' αυτό υπάρχει το IFC και τα linked models. **Το ADR-678 §3 το δήλωσε ήδη σωστά·
αυτό το ADR δεν το ανατρέπει, το περιβάλλει.**

**Συνέπεια:** η αίτηση «να αλλάξει το ύψος στα στηθαία και να γυρίσει πίσω ως BIM» **δεν λύνεται
πλήρως αυτόματα**. Λύνεται *ημι-αυτόματα* (§5, κατάσταση C) — ο Νέστωρ **ανιχνεύει** ότι η γεωμετρία
άλλαξε και **ρωτά** τον χρήστη, αντί να μαντεύει.

## 4. Απόφαση: **μοντέλο ιδιοκτησίας** (ownership split)

Αντί να προσπαθήσουμε να συγχωνεύσουμε τα πάντα, ορίζουμε **ποιος κατέχει τι**. Είναι ακριβώς η
στρατηγική των linked models του Revit και του IFC reference view.

| Ζώνη | Ιδιοκτήτης | Ο εξωτερικός μπορεί; | Στην επιστροφή |
|---|---|---|---|
| **Γεωμετρία BIM** (τοίχοι, πλάκες, κολόνες) | **Νέστωρ** | ❌ Όχι — μόνο να προτείνει | Ανιχνεύεται, δεν εφαρμόζεται σιωπηλά |
| **Εμφάνιση** (χρώμα, υλικό, υφή, PBR) | **Εξωτερικός** | ✅ Ναι — πλήρως | Εφαρμόζεται αυτόματα |
| **Νέα αντικείμενα** (κάγκελα, έπιπλα, βλάστηση) | **Εξωτερικός** | ✅ Ναι | Εισάγεται ως `imported-mesh` entity |

**Γιατί αυτό λύνει το «χωρίς να γκρεμιστεί η αρχική κατασκευή»:** ο Νέστωρ δεν ξαναχτίζει ποτέ το
BIM από το επιστρεφόμενο αρχείο. Το BIM μένει άθικτο· η επιστροφή **επικάθεται** πάνω του.

## 5. Reconcile policy — οι 4 καταστάσεις

Ο reconciler αντιστοιχεί μέσω `bimId` (από `buildMeshName`) και κατατάσσει κάθε object:

| # | Κατάσταση | Ανίχνευση | Ενέργεια |
|---|---|---|---|
| **A** | MATCHED, ίδια γεωμετρία, **άλλη** εμφάνιση | `bimId` βρέθηκε + geometry hash ίδιο | ✅ **Αυτόματα** — appearance apply (ADR-678, ήδη δουλεύει) |
| **B** | MATCHED, ίδια γεωμετρία, **ίδια** εμφάνιση | DNA αμετάβλητο (`mat-*`/`elem-*`/`mat_<hex6>`) | ⏭️ **No-op** (ήδη δουλεύει, ADR-678 §4.3) |
| **C** | MATCHED, **άλλη** γεωμετρία | geometry hash διαφορετικό | ⚠️ **Ρώτα**: «κράτα BIM» / «δέξου ως πλέγμα» / «αγνόησε» |
| **D** | **UNMATCHED** (χωρίς έγκυρο `bimId`) | δεν ταιριάζει σε καμία ζωντανή οντότητα | ➕ **Εισήγαγε** ως `imported-mesh` (τα κάγκελα) |
| **E** | **MISSING** (υπάρχει στον Νέστορα, λείπει στην επιστροφή) | set difference | 🗑️ **Ρώτα πριν σβήσεις** (ποτέ σιωπηλά) |

**Geometry fingerprint (ΥΛΟΠΟΙΗΜΕΝΟ, Φ2):** `io/mesh3d-roundtrip/geometry-hash.ts` — ΕΝΑ SSoT που
τρέχει **και στα δύο άκρα**: στο export γράφεται στο manifest (§7), στο import ξαναϋπολογίζεται.

⚠️ **Διόρθωση της αρχικής διατύπωσης (μετρημένο 2026-07-20):** «σκέτο quantised hash κορυφών» **δεν
δουλεύει**. Το float32 του glTF έχει σχετική ακρίβεια ~1.2e-7 → σε συντεταγμένη 100 m ο θόρυβος
είναι ~12 μm. Με κάδο 100 μm, η πιθανότητα μια κορυφή να πέσει στην άλλη πλευρά ενός ορίου κάδου
είναι **~12% ανά συντεταγμένη** — σε mesh με χιλιάδες κορυφές, πρακτικά βεβαιότητα. Δηλαδή **κάθε**
αμετάβλητο στοιχείο θα γύριζε «άλλαξε» και η κατάσταση C θα ρωτούσε για τα πάντα (gate με >50%
false positives = θόρυβος, όχι gate).

**Λύση — δύο επίπεδα με ρητούς ρόλους:**

| Επίπεδο | Τι είναι | Ρόλος |
|---|---|---|
| `hash` | FNV-1a επί κβαντισμένων (0.1 mm) **ταξινομημένων** κορυφών + πλήθη | Ακριβές, φθηνό, **μηδέν false negatives**. Ίδιο ⇒ σίγουρα ίδια γεωμετρία (γρήγορο μονοπάτι) |
| `signature` | πλήθη, διαστάσεις bbox, κεντροειδές, εμβαδόν | Συγκρίνεται **με ανοχή** (1 mm / 0.5%). Τρέχει ΜΟΝΟ όταν το hash διαφέρει |

→ `compareGeometry()` επιστρέφει `identical` (A/B) · `equivalent` (θόρυβος float ή άλλη
τριγωνοποίηση του παραλήπτη — **όχι** ερώτηση) · `changed` (C — ρώτα). Άγνωστο fingerprint σε
οποιαδήποτε πλευρά ⇒ `changed` (fail-closed).

**Χώρος αναφοράς (τι πιάνει και τι όχι — 100% ειλικρίνεια):** world space, μεταφερμένο ώστε το bbox
min να πέσει στο origin. Άρα ✅ πιάνει σχήμα/διαστάσεις/κλίμακα κόμβου· ❌ **δεν** πιάνει καθαρή
μετακίνηση (σκόπιμο — floor stacking/re-centring/διαφορετικά origins θα έκαναν τα πάντα false
positive· η θέση είναι δουλειά της Φ3)· ❌ δεν πιάνει περιστροφή ολόκληρου του μοντέλου. Μονάδα
**πάντα μέτρα**, υπολογισμένη **πριν** το `applyExportUnit` — αλλιώς το ίδιο μοντέλο θα έδινε άλλο
fingerprint ανά επιλογή μονάδας OBJ.

⚠️ **Κρίσιμο για την κατάσταση C:** δεν προσπαθούμε ποτέ να συμπεράνουμε παραμέτρους. Το «δέξου ως
πλέγμα» **αποσυνδέει** την οντότητα από το BIM (γίνεται `imported-mesh`) και το δηλώνει ρητά. Ο
χρήστης ξέρει ότι έχασε την παραμετρικότητα εκείνου του στοιχείου — δεν το ανακαλύπτει αργότερα.

## 6. Απόφαση formats

Ο Giorgio αποφάσισε (2026-07-20): **κάλυψη κάθε περίπτωσης παραλήπτη**.

| Format | Ταυτότητα (UUID) | Υλικά | PBR/γυαλί | Textures | Ρόλος |
|---|---|---|---|---|---|
| **glTF 2.0** | ✅ ακέραιο | ✅ | ✅ **πλήρες** (metallic/roughness/transmission) | ✅ ενσωματωμένες | 🏆 **Κύριος δρόμος** — σύγχρονος παραλήπτης |
| **OBJ + MTL** | ✅ ακέραιο | ⚠️ sidecar | ❌ | ⚠️ refs | 🥈 Legacy — C4D R15 (ήδη DONE) |
| **DAE 1.4** | ✅ ακέραιο | ✅ ενσωματωμένα | ❌ μόνο blinn/phong | ✅ refs | 🥉 Γέφυρα R15 **μόνο αν αποδειχθεί ανάγκη** |
| **FBX** | 🔴 **ΣΠΑΣΜΕΝΗ** | ✅ | ⚠️ | ✅ | ❌ **ΑΠΟΡΡΙΠΤΕΤΑΙ** ως εξαγωγή |

### 6.1 Γιατί απορρίπτεται το FBX (μετρημένο 2026-07-20)

Το FBX export του C4D R15 **μετατρέπει κάθε `-` σε `_`** στα ονόματα:
```
Νέστωρ:  Column_col_2ce2440d-a9d8-4ab3-b0b7-ff0078dcc6d7
FBX:     Column_col_2ce2440d_a9d8_4ab3_b0b7_ff0078dcc6d7
```
Τα dashes του **UUID** καταστρέφονται → **όλο** το κανάλι ταυτότητας του §2 πεθαίνει. Το OBJ και το
DAE διατηρούν τα ονόματα ακέραια. **Ο Νέστωρ δεν εξάγει FBX.** (Εισαγωγή FBX μπορεί να υποστηριχθεί
μελλοντικά με normalisation `-`↔`_`, αλλά είναι lossy — δύο διαφορετικά ids μπορούν να συγκρουστούν.)

### 6.2 Γιατί το DAE υποβιβάζεται σε «αν χρειαστεί»

Αρχικά ζητήθηκε DAE exporter. **Ο έλεγχος έδειξε ότι δεν είναι το κρίσιμο μονοπάτι:**
- Το `three@0.170.0` **δεν έχει `ColladaExporter`** (αφαιρέθηκε ~r150) → writer από το μηδέν.
- Το OBJ που ήδη εξάγουμε κρατά τα UUID **εξίσου** ακέραια.
- Το DAE **δεν** προσθέτει PBR — άρα δεν λύνει το «γυαλί/καθρέφτης» που ήταν ο λόγος που το θέλαμε.
- Ο R15 (2013) **δεν έχει PBR εσωτερικά** — κανένα format δεν του το δίνει.

→ Το DAE μπαίνει στη Φ4, **μετά** από ρητή επιβεβαίωση ότι ο COLLADA importer του R15 φέρνει υλικά
που ο OBJ importer του δεν φέρνει. Χωρίς αυτό, είναι ένας ακόμα writer χωρίς κέρδος.

## 7. Το manifest (`.nestor.json`)

Τα mesh formats δεν χωράνε όλη την πληροφορία. Δίπλα σε κάθε export γράφεται **sidecar manifest**:

**Υλοποιημένο σχήμα (Φ2, `io/mesh3d-roundtrip/export-manifest.ts`):**

```jsonc
{
  "schema": "nestor-export/1",
  "exportedAt": "2026-07-20T10:43:50.000Z",
  "projectName": "Katoikia", "buildingId": "bld-1",
  "unit": "centimeters",              // μονάδα του ΑΡΧΕΙΟΥ ΜΟΝΤΕΛΟΥ (glTF ⇒ πάντα "meters")
  "materials": {                      // Φ2 hotfix — εξαχθέν χρώμα ανά υλικό (sRGB), για repaint detection
    "mat-concrete-c25": "#808080",
    "mat_a1b2c3": "#a1b2c3"
  },
  "entities": [
    { "meshName": "Ισόγειο_Wall_w-42", "bimId": "w-42", "bimType": "wall", "levelId": "lvl-1",
      "geometryHash": "a3f1...",       // null όταν το mesh δεν έχει αξιοποιήσιμες κορυφές
      "geometry": { "vertexCount": 24, "triangleCount": 12,
                    "sizeM": [0.25, 3, 5], "centroidM": [0.125, 1.5, 2.5], "areaM2": 32.5 } }
  ]
}
```

**`materials` (Φ2 hotfix, νέο):** `καθαρό όνομα υλικού → sRGB hex` — mirror του `.mtl` table (`buildMaterialBaseline`).
Είναι το SSOT που ξεχωρίζει «ο συνεργάτης ξαναέβαψε» από «αμετάβλητο» **χωρίς lossy reverse-parse
ονόματος**: ο import συγκρίνει το πραγματικό χρώμα του επιστρεφόμενου υλικού με το καταγεγραμμένο
(`resolveImportAppearance::detectRepaint`). Keyed ανά **όνομα** (όχι ανά mesh) γιατί ο import
κλειδώνει την εμφάνιση με όνομα υλικού. Legacy manifest χωρίς `materials` → `{}` (fail-closed).

**Αποκλίσεις από την αρχική πρόταση (γιατί):**
- `projectId` → **`projectName`**: το `ExportDeps` δεν κουβαλά projectId· κουβαλά `projectName`
  (αυτό που ήδη ονοματίζει τα αρχεία). Καμία τεχνητή εξάρτηση για ένα πεδίο ενημερωτικό.
- **`geometry`** (νέο): ο περιγραφέας με ανοχή του §5 — χωρίς αυτόν το `geometryHash` μόνο του
  είναι εύθραυστο (βλ. §5).
- **`params` ΔΕΝ γράφεται ακόμη.** Τις αρχικές παραμέτρους τις χρειάζεται ο **διάλογος της Φ4**
  («τι άλλαξε»), και η headless σκηνή εξαγωγής κουβαλά **ταυτότητα** (`userData`), όχι παραμετρικό
  DNA. Θα μπουν στη Φ4 από την πλευρά των **οντοτήτων**, όχι από το three δέντρο.
- **Μονάδες:** το `unit` περιγράφει το αρχείο μοντέλου· τα fingerprints είναι **πάντα σε μέτρα**.

**Ο εξωτερικός δεν το αγγίζει** — το επιστρέφει αυτούσιο μαζί με το πειραγμένο μοντέλο. Δίνει στον
reconciler: (α) το fingerprint για να ξεχωρίσει A από C, (β) το πλήρες σύνολο εξαχθέντων → set
difference = κατάσταση E, (γ) τη σύνδεση `meshName → bimId/bimType/levelId` χωρίς lossy
reverse-parse ονόματος.

⚠️ **Συνέπεια παράδοσης:** το sidecar ταξιδεύει ως δεύτερο artifact, άρα **και το glTF export
κατεβαίνει πλέον ως `.zip`** (`.glb` + `.nestor.json`) — όπως ήδη συνέβαινε στο OBJ με το `.mtl`.
Αυτό είναι το ζητούμενο: manifest που δεν ταξιδεύει με το μοντέλο δεν επιστρέφει ποτέ.

## 8. Νέα modules (mirror της υπάρχουσας δομής)

```
io/mesh3d-roundtrip/           ← νέο, δίπλα στο υπάρχον mesh3d-material-import/
  geometry-hash.ts             🟢 Φ2 — fingerprint κορυφών (export + import, ΕΝΑ SSoT)
  gltf-scene-parse.ts          🟢 Φ2 — Κ1: GLTFLoader → objects + **υλικά** (glTF ανάλογο του .mtl)
  export-manifest.ts           🟢 Φ2 — γράψε/διάβασε .nestor.json
  import-gltf-appearance.ts    🟢 Φ2-UI — λεπτός wrapper glTF πάνω από τον κοινό πυρήνα
  reconcile-scene.ts           ⬜ Φ4 — οι 5 καταστάσεις του §5 → ReconcileReport (pure)
  apply-reconcile.ts           ⬜ Φ4 — ReconcileReport + αποφάσεις χρήστη → CompositeCommand
bim/entities/imported-mesh/    🟢 Φ3α — Κ2: ο νέος τύπος οντότητας
  imported-mesh-types.ts       🟢 params/geometry/entity + κλειδί bundle `<uploadId>#<nodeName>`
  imported-mesh-geometry.ts    🟢 params → geometry (delegate στον κοινό πυρήνα ίχνους) + validate
  imported-mesh-grips.ts       🟢 ΔΥΟ λαβές (move+rotation)· ΚΑΜΙΑ λαβή σχήματος (§3)
  build-imported-mesh-entity.ts 🟢 unmatched κόμβος → οντότητα (κατάσταση D)
bim/geometry/shared/
  centred-box-footprint.ts     🟢 Φ3α — ο κοινός πυρήνας ίχνους (furniture + imported-mesh)
bim/renderers/ImportedMeshRenderer.ts        🟢 Φ3α — 2Δ περίγραμμα (fallback: μετρημένο bbox)
bim-3d/converters/imported-mesh-to-three.ts  🟢 Φ3α — 3Δ (λεπτός adapter στο meshToObject3D)
core/commands/entity-commands/UpdateImportedMeshParamsCommand.ts  🟢 Φ3α
```

### 8.1 Το σχήμα «ΕΝΑΣ πυρήνας + δύο wrappers» (Φ2-UI)

Ο orchestrator του ADR-678 (`importC4dMaterials`) έκανε **και** το parsing **και** την εφαρμογή. Το
glTF είναι **async + binary** → δεν χωρά στην ίδια υπογραφή. Δύο orchestrators όμως θα ήταν
sibling clone (N.18). Λύση — το συμβόλαιο κόβεται **ακριβώς** στο σημείο που τα δύο formats παύουν
να διαφέρουν:

```
OBJ text   → parseObjObjects + parseMtl ─┐
                                          ├→ applyImportedAppearance(objects, materials, charset)
GLB binary → parseGltfScene ─────────────┘        │
                                                   └→ match → resolve → SetFaceAppearanceCommand → ΕΝΑ undo
```

`ImportedAppearanceInput = { objects, materials, charset }` — format-agnostic. Το `charset` παύει
να είναι προαιρετικό στον πυρήνα (**υποχρεωτικό**, ρητά δηλωμένο ανά wrapper): `'latin'` για OBJ
(transliteration C4D R15), `'unicode'` για glTF (UTF-8). Λάθος τιμή = **μηδέν ταιριάσματα σε κάθε
ελληνικό όνομα ορόφου, σιωπηλά** — γι' αυτό υπάρχει ρητό anchor test.

**Το μη-προφανές εύρημα της Φ2-UI:** ο `resolveImportAppearance` διαβάζει τα χρώματα από
`Map<name, ImportedMaterial>` — που στο OBJ έρχεται από το **sidecar `.mtl`**. Το glTF **δεν έχει
sidecar**: τα χρώματα ζουν πάνω στα ίδια τα υλικά των mesh. Χωρίς το νέο `collectGltfMaterials`, το
glTF import θα «δούλευε» (θα ταίριαζε, θα ανέφερε επιτυχία) **χάνοντας σιωπηλά κάθε χρώμα** — θα
έπεφτε στο τελευταίο fallback (hex μέσα στο όνομα), που ισχύει μόνο για C4D R15 χωρίς `.mtl`.
Η ασυμμετρία «το OBJ έχει sidecar, το glTF όχι» ήταν το μοναδικό πραγματικό κενό της καλωδίωσης.

**Σημείο ένωσης export (Φ2):** το manifest χτίζεται στο `export/formats/mesh3d-export-adapter.ts`
σε **ΕΝΑ** σημείο κλήσης για τα δύο formats — **μετά** το `nameMeshesForExport` (αλλιώς τα
`meshName` είναι κενά) και **πριν** το `applyExportUnit` (αλλιώς τα fingerprints δεν είναι σε
μέτρα). Ένα σημείο ⇒ OBJ και GLB δεν μπορούν να αποκλίνουν.

**Το glTF μονοπάτι παράγει το ΙΔΙΟ σχήμα δεδομένων με το OBJ** (`ObjectMaterialAssignment`), άρα
τα `matchObjectsToEntities` / `resolveImportAppearance` / `applyFaceAppearanceToFaces` του ADR-678
τρέχουν **αυτούσια** — μηδέν δεύτερο μονοπάτι αντιστοίχισης ανά format. Η μόνη προσθήκη είναι το
`fingerprint`, που το OBJ μονοπάτι δεν μπορεί να δώσει (δεν φορτώνει γεωμετρία, by design).

**SSoT reuse (μηδέν διπλότυπο):** `buildMeshName` (ονοματοδοσία), `resolveImportAppearance`
(υλικό→εμφάνιση), `applyFaceAppearanceToFaces` (εφαρμογή), `finish-import-routing` (σοβάς),
`CompositeCommand` (undo) — **όλα υπάρχουν ήδη** από ADR-678.

## 9. Φασικό roadmap

| Φάση | Περιεχόμενο | Ξεκλειδώνει | Κατάσταση |
|---|---|---|---|
| **Φ1** | Appearance round-trip OBJ (ADR-678) | χρώμα/υλικό ανά στοιχείο | 🟢 **DONE** |
| **Φ2** | **glTF import** (Κ1) + geometry fingerprint + manifest + **UI καλωδίωση** (§8.1) · 4 modules + 53 jest tests | 🎯 **ο κύκλος βαφής κλείνει: στέλνω .glb → γυρίζει βαμμένο → μπαίνει** | 🟢 **DONE** (κύκλος βαφής: **hotfix 2026-07-21**, βλ. §11) |
| **Φ3α** | **`imported-mesh` entity type** (Κ2) — 2Δ κάτοψη + 3Δ + move/rotate (§10.1)· **CHECK 5C ενεργοποιήθηκε** (20 capability anchors απαντήθηκαν) | 🎯 ο τύπος υπάρχει, σχεδιάζεται, επιλέγεται, μετακινείται | 🟢 **DONE** |
| **Φ3β** | **Καλωδίωση εισαγωγής** — τα unmatched γίνονται οντότητες: `worldBoxM` + αντίστροφο placement, upload `.glb`, dialog επιλογής, persistence (collection + rules + indexes + audit + events) | 🎯 **τα κάγκελα μπαίνουν πραγματικά** | 🟢 **DONE** |
| **Φ3.1α** | **Μοντέλο κοστολόγησης** — μέτρηση όγκου/στεγανότητας από τα τρίγωνα· τύπος ταυτότητας· gating μονάδων· resolver· καλωδίωση Path 1 (audit+upsert+delete) | 🎯 η αλυσίδα ταυτότητα→ποσότητα→γραμμή BOQ κλείνει λογικά | 🟢 **DONE** |
| **Φ3.1β** | **Διεπαφή ανάθεσης** — contextual tab + dialog (πρόταση από όνομα **και** υλικό)· undoable command· gating μονάδων ανά άρθρο· `sourceEntityType:'imported-mesh'`· μετρητής ανανάθετων | 🎯 **ο χρήστης κοστολογεί εισαγόμενα** | 🟢 **DONE** |
| **Φ3.1γ** | **Πάνελ εισαγόμενων** — αριστερό tab «Εισαγόμενα»: ομαδοποίηση ανά `.glb` (linked-model), badge ανανάθετων, κλικ → επιλογή + dialog ανάθεσης | 🎯 **η «ορατή απουσία» γίνεται πράγματι ορατή** | 🟢 **DONE** |
| **Φ3.1δ** | **Μνήμη κανόνων** (project→company override) — scoped library + enterprise id + rules/indexes/audit | «μία φορά το δηλώνω, δεν ξαναρωτιέμαι» | ⬜ TODO |
| **Φ4** | Reconcile UI — διάλογος έγκρισης για C/E | «αντιλαμβάνεται τι άλλαξε» | ⬜ TODO |
| **Φ5** | **Καλωδίωση** του PBR/υφών του ADR-679 στο round-trip (glTF PBR ↔ `BimMaterial`) — **όχι** νέο σύστημα υλικών | γυαλί, καθρέφτης, υφές, φωτορεαλισμός | ⬜ TODO (μετά ADR-679 Φ2b/c) |
| **Φ6** | DAE export/import — **μόνο αν** επιβεβαιωθεί ανάγκη R15 (§6.2) | legacy γέφυρα | ⬜ ΥΠΟ ΑΙΡΕΣΗ |

**Κρίσιμη διαδρομή για το όραμα του §1: Φ2 → Φ3 → Φ4.** Οι Φ2+Φ3 μαζί καλύπτουν ~85% του αιτήματος.

⚠️ **Όριο ιδιοκτησίας με ADR-679:** το ADR-679 κατέχει **τι είναι** ένα υλικό (κανάλια, υφές, editor,
render). Αυτό το ADR κατέχει **πώς ταξιδεύει** ένα υλικό μέσα/έξω (parse, match, reconcile, apply).
Καμία επικάλυψη — η Φ5 είναι σύνδεση των δύο, όχι νέο σύστημα υλικών.

## 10. Αποφάσεις επί των ανοιχτών ερωτημάτων (Giorgio, 2026-07-20)

### 10.1 ✅ Τα `imported-mesh` **ΣΧΕΔΙΑΖΟΝΤΑΙ και στην κάτοψη** (2Δ + 3Δ)

Απόφαση: **πλήρης πολίτης**, όχι 3Δ-only διακοσμητικό. Μπαίνουν στο `RENDERABLE_ENTITY_TYPES` →
**ενεργοποιείται το CHECK 5C** (ADR-587 capability anchors, ~41s). Οι απαντήσεις στα 5 anchors:

| Ερώτηση anchor | Απάντηση | Γιατί |
|---|---|---|
| Σχεδιάζεται 2Δ; | ✅ Ναι — **προβολή περιγράμματος** στο επίπεδο κοπής | Το ζήτησε ρητά ο Giorgio |
| Μετακινείται; | ✅ Ναι | Ο Giorgio πρέπει να διορθώσει θέση χωρίς νέο γύρο στον συνεργάτη |
| Περιστρέφεται; | ✅ Ναι | ίδιος λόγος |
| Εξάγεται; | ✅ Ναι — σε OBJ/glTF | Αλλιώς χάνεται στον επόμενο γύρο συνεργασίας |
| Έχει λαβές reshape; | ❌ **ΟΧΙ** | Είναι ψημένο πλέγμα, όχι παραμετρικό. Μετακίνηση/περιστροφή = μετασχηματισμός (νόμιμος)· αλλαγή σχήματος = θα απαιτούσε παραμετρικότητα που **δεν υπάρχει** (§3). |

**Το όριο δηλώνεται στον χρήστη:** τα εισαγόμενα δείχνουν λαβές θέσης/στροφής, ποτέ λαβές σχήματος.

### 10.2 ✅ Τα `imported-mesh` **ΜΕΤΡΙΟΥΝΤΑΙ στην προμέτρηση** — με ανάθεση ταυτότητας

**Ο υπολογισμός είναι ΠΑΝΤΑ αυτόματος** (μήκος/επιφάνεια/όγκος/πλήθος από τη γεωμετρία).
Χειροκίνητη είναι **μόνο η ταυτότητα**, μία φορά:

```
«Rail_01»  →  [Κάγκελο αλουμινίου ▾]  →  45 €/μ   →  όλα τα νούμερα αυτόματα από κει και πέρα
```

**Γιατί δεν γίνεται πλήρως αυτόματο (τεκμηρίωση, να μην ξαναρωτηθεί):** το ίδιο ακριβώς πλέγμα
κοστολογείται 288 € ως αλουμίνιο, 448 € ως σίδερο, 832 € ως inox. Η πληροφορία **δεν υπάρχει μέσα
στη γεωμετρία**. Δεύτερο, ύπουλο: η **μονάδα μέτρησης** είναι σημασιολογική — κάγκελο σε τρέχοντα
μέτρα, τζάμι σε τετραγωνικά, εξάρτημα σε τεμάχια. Ο Νέστωρ έχει και τα τρία νούμερα, δεν ξέρει ποιο
ισχύει. **Αυτόματη μαντεψιά κόστους = λάθος κοστολόγιο που ο χρήστης εμπιστεύεται** — χειρότερο από
κανένα (ίδια αρχή με Revit linked models / IFC: ποτέ κόστος από γεωμετρία).

**Μετριασμός τριβής (υποχρεωτικός, όχι προαιρετικός):**
1. **Πρόταση από όνομα** — `Rail_*` / `railing` / `handrail` / `κάγκελο` → προ-συμπληρωμένο, ο χρήστης πατά ✓.
2. **Πρόταση από υλικό** — το `usemtl`/glTF material name (π.χ. `Aluminium`) ταιριάζει στον κατάλογο (SSoT reuse: `known-import-materials.ts`).
3. **Μνήμη κανόνων** — μόλις οριστεί «`Rail_*` = κάγκελο αλουμινίου», **δεν ξαναρωτά** — ούτε σε επόμενο import, ούτε σε επόμενο project (project → company scope).

**Ξεχωριστή ομάδα στο BOQ** («Εισαγόμενα από συνεργάτη») ώστε να ξεχωρίζει τι κοστολογήθηκε από BIM
DNA και τι από ανάθεση. ⚠️ Δεν αγγίζει approved/certified baselines (κανόνας ADR-673).

### 10.4 ✅ Τα εισαγόμενα κάγκελα μπαίνουν **πάντα ως `imported-mesh`** (Giorgio, 2026-07-20)

Το `'railing'` **υπάρχει ήδη** ως πλήρως παραμετρική οντότητα (`railing-types.ts`, zod schema, BOQ
mapping). Ερώτημα: τα εισαγόμενα κάγκελα να προτείνονται ως native `railing`;

**Απόφαση: όχι στη Φ3 — πάντα `imported-mesh`.** Ο συνεργάτης σχεδίασε κάτι συγκεκριμένο· το
κρατάμε πιστά. Το να «αναγνωρίσουμε» ένα πλέγμα ως παραμετρικό κάγκελο θα παραβίαζε ευθέως το
όριο του §3 (συμπερασμός παραμέτρων από τρίγωνα). Η κοστολόγηση καλύπτεται ήδη από το §10.2
(ανάθεση ταυτότητας μία φορά), χωρίς να χρειάζεται παραμετρικότητα.

**Προαιρετική πρόταση μετατροπής** («αυτό μοιάζει με κάγκελο — να το κάνω native railing;») μπαίνει
ως **ξεχωριστή υπο-φάση αργότερα**, αφού δει ο Giorgio πώς δουλεύει στην πράξη. Ρητά **εκτός Φ3**.

### 10.3 ~~Φ5 PBR στο BIM~~ — **ΛΥΘΗΚΕ**

Το **ADR-679** το κατέχει ήδη (PBR channels, `PbrMaterialTextures`, texture registry,
`pbr-material-builder`, Φ2a DONE). Η Φ5 εδώ είναι μόνο η **καλωδίωση** στο round-trip.

### 10.5 ✅ Μονάδες εισαγωγής — **ρητή επιλογή, όχι auto-detect** (§units)

**Πρόβλημα (μετρημένο 2026-07-22):** το `untitled.glb` (καρέκλα Aeron σε **ίντσες**, bbox ~44 units)
εισήχθη αόρατο. Ο importer υπέθετε glTF = μέτρα → 44 units διαβάστηκαν ως **44 μέτρα** →
`measuredHeightMm≈44180`, θέση δεκάδες χιλιάδες scene units → τερατώδες & εκτός frustum. Το
`HMI_Aeron_Chair_3D.glb` (εξήχθη από C4D σε μέτρα) μπήκε σωστά — άρα **μόνο η κλίμακα** έφταιγε.

**Research verdict (πρακτική μεγάλων — ζητήθηκε ρητά):** το glTF ορίζει 1 unit = 1 μέτρο (Khronos·
το units-field απορρίφθηκε επίσημα, glTF #2425). Λάθος κλίμακα = bug του exporter. Ο enterprise χειρισμός
ambiguous μονάδων είναι **ρητό dropdown μονάδας + scale factor + live preview** (Revit «Import Units»,
SketchUp mm/cm/in/ft/m, C4D scale multiplier) — **ΠΟΤΕ silent bbox auto-rescale** (ρητό anti-pattern:
αποτυγχάνει σε βίδες/πλοία/κτήρια). Default = μέτρα → σωστά αρχεία μένουν ανέγγιχτα.

**Ροή του factor (μία τιμή, κάθε owner κλιμακώνει ό,τι κατέχει):**
- SSoT `io/mesh3d-roundtrip/import-unit-scale.ts` — presets + `resolveUnitScaleFactor` + `scaleWorldBoxByFactor`.
  Ο πίνακας factor **δεν** ξαναγράφεται: `unitScaleFactor(unit)` = `sceneUnitsToMeters(unit)` (SSoT `scene-units.ts`).
- **Θέση** (owner: `import-gltf-meshes.ts`) — `scaleWorldBoxByFactor(worldBoxM, f)` πριν το `gltfNodeToPlacement`
  (η pure placement μένει ανέγγιχτη).
- **Μετρήσεις** (owner: `build-imported-mesh-entity.ts`) — dims ×f, εμβαδόν ×f², όγκος ×f³ (null-safe).
  Το `signature`/fingerprint hash **δεν** αγγίζεται → σωστό reconcile στον επόμενο roundtrip.
- **UI**: `ImportedMeshImportDialog` + `ImportUnitScaleControl` (canonical `@/components/ui/select`, ADR-001)·
  ονόματα μονάδων από `common:units.*`· η λίστα διαστάσεων ενημερώνεται **live** καθώς αλλάζει η μονάδα.

## 11. Changelog

- **2026-07-22 (§mesh-load-orphan-cleanup — Η ΟΡΙΣΤΙΚΗ ΡΙΖΑ: Cloud Function έσβηνε το `.glb` δευτερόλεπτα μετά το upload)** —
  Το «λείπει το αρχείο» των προηγούμενων entries **δεν** ήταν Storage wipe ούτε bucket mismatch. Το HAR
  (`localhost-2.har`) έδειξε το upload: `POST 200`, bucket `pagonis-87766.firebasestorage.app`, path
  `.../imported-meshes/<uploadId>.glb`, **2.2MB body** → το αρχείο **γράφτηκε σωστά**. Και όμως λείπει
  δευτερόλεπτα μετά. Ο client επιβεβαίωσε ίδιο bucket (το `scene.json` persists εκεί)· το MCP βρήκε το
  `scene.json` στο ίδιο bucket → **όχι** bucket mismatch.
  - **Ρίζα (functions):** η Cloud Function `onStorageFinalize` (`functions/src/storage/orphan-cleanup.ts`)
    τρέχει σε **κάθε** upload κάτω από `companies/…`. Βγάζει `fileId` από το όνομα (`<uploadId>.glb` →
    `uploadId`), ρωτά `findFileOwner()` (`functions/src/shared/file-ownership-resolver.ts`) — ο οποίος
    ήξερε **μόνο** τους providers `FILES` (doc-id) και `FILE_SHARES` (doc-id). Τα imported meshes ανήκουν
    στο `floorplan_imported_meshes` **μέσω `params.uploadId`** (Ν οντότητες → ΕΝΑ αρχείο· doc-id ≠ fileId),
    οπότε **κανείς provider δεν το διεκδικούσε** → «orphan» → `bucket.file().delete()` + audit
    `ORPHAN_FILE_DELETED`. Ίδια ΑΚΡΙΒΩΣ κλάση bug με το incident **2026-04-17** (showcase PDFs σβήνονταν ms
    μετά το upload, λύθηκε προσθέτοντας τον `FILE_SHARES` provider — το σχόλιο του αρχείου το τεκμηριώνει).
  - **Fix (SSoT, μηδέν νέος μηχανισμός — επέκταση του καθιερωμένου registry):** ο `file-ownership-resolver`
    υποστηρίζει πλέον **query-based** providers (όχι μόνο doc-id) και προστέθηκε ο provider
    `imported_meshes` → `floorplan_imported_meshes` where `params.uploadId == fileId`. Νέο collection key
    `FLOORPLAN_IMPORTED_MESHES` στο functions config. Πλέον το `.glb` αναγνωρίζεται ως owned → **δεν
    σβήνεται**. Test (regression anchor): `functions/src/shared/__tests__/file-ownership-resolver.test.ts`
    (doc-id claim / imported-mesh query claim / genuine orphan → null).
  - **⚠️ ΑΠΑΙΤΕΙ DEPLOY functions** (`firebase deploy --only functions:onStorageFinalize`) — ο Giorgio.
    Μέχρι τότε κάθε νέο import συνεχίζει να σβήνεται. Μετά το deploy: fresh re-import → το `.glb` επιβιώνει →
    η καρέκλα σμιλεύεται. Οι παλιές ορφανές οντότητες (με ήδη σβησμένα αρχεία) διαγράφονται από το UI.
  - **Residual (παρακολούθηση):** το `onStorageFinalize` τρέχει μόλις ολοκληρωθεί το upload· η οντότητα
    γράφεται στο Firestore αμέσως μετά (append→persist). Αν σε edge περίπτωση ο έλεγχος προηγηθεί του
    entity write, ο query provider δεν θα βρει claim (race). Τα timestamps δείχνουν το entity write να
    προηγείται· αν εμφανιστεί race, follow-up = claim-first ordering ή grace-period στο finalize.

- **2026-07-22 (§mesh-load-missing-file — η ΠΡΑΓΜΑΤΙΚΗ αιτία του placeholder κουτιού: το `.glb` λείπει από το Storage)** —
  Μετά τα §mesh-load + §mesh-load-nesting η καρέκλα **έμεινε κουτί**. Ground-truth από τη βάση (όχι υπόθεση):
  - Το εισαγόμενο `.glb` (`HMI_Aeron_Chair_3D.glb`) παρήχθη από **trimesh** (Python), με **10 κόμβους top-level**
    (`HArmPads … HSpndle`, scene.nodes = [1..10]) — **flat, ΟΧΙ nested**. Άρα το §mesh-load-nesting **δεν ήταν**
    η αιτία για αυτό το αρχείο (τα ονόματα ταιριάζουν 1:1, top-level).
  - Οι 14 `floorplan_imported_meshes` οντότητες του `proj_04a6b4bb` έχουν σωστά `nodeName` + `storagePath`
    (`companies/…/projects/proj_04a6b4bb/imported-meshes/<uploadId>.glb`). **ΑΛΛΑ** το `imported-meshes/`
    folder στο cloud Storage είναι **εντελώς άδειο** (0 αρχεία· μόνο `entities/` υπάρχει στο project). Το app
    τρέχει σε **cloud** (όχι emulator — το MCP βλέπει τα entities στο cloud Firestore).
  - **Ρίζα:** `resolveMeshUrl` → `getDownloadURL(<storagePath>)` → **404** (αρχείο ανύπαρκτο) → `bim-mesh-cache`
    κλειδώνει `status='error'` → μόνιμο placeholder κουτί. `buildImportedMeshPath` είναι ντετερμινιστικό
    (write-path == stored == read-path) → **δεν** είναι path bug· το αρχείο ανέβηκε στο import (το upload είναι
    `await` πριν δημιουργηθεί οποιαδήποτε οντότητα) και **χάθηκε αργότερα** (Storage wipe σε pre-production
    single-user env), αφήνοντας **ορφανές** οντότητες.
  - **Συμπέρασμα:** τα §mesh-load (register per-file) + §mesh-load-nesting (deep walker) είναι **σωστές**
    διορθώσεις — αλλά **δεν μπορούν** να φορτώσουν αρχείο που δεν υπάρχει. Το ορατό κουτί εδώ είναι
    **data-integrity issue** (ορφανές οντότητες), όχι code bug. Fix: re-import (fresh upload) ή restore του
    αρχείου στο ακριβές path.
  - **✅ Google-level robustness (υλοποιήθηκε, έγκριση Giorgio):** ένα missing linked-file δεν είναι πλέον
    **σιωπηλό** κουτί. (1) Ο `bim-mesh-cache.preload` σε 404/load-fail κάνει `logger.warn` με `category/assetId/
    error` (ήταν κενό `.catch` — γι' αυτό χρειάστηκε σκάψιμο στη βάση). (2) Νέος `bimMeshCache.getLoadState(
    category, assetId)` → `'idle'|'loading'|'error'|'ready'`. (3) Bump του `meshAssetVersion` **και** σε αποτυχία
    (μία φορά ανά asset· `status='error'` μπλοκάρει re-preload → no loop), ώστε το UI να αντιδρά. (4) Το πάνελ
    «Εισαγόμενα» (`ImportedMeshListRow`) δείχνει badge **«⚠ Αρχείο μη διαθέσιμο»** όταν `getLoadState==='error'`
    — πρακτική Revit «Manage Links → Not Found». i18n: `panels.importedMeshes.fileUnavailable` (el+en). Ο pure
    row-builder (`imported-mesh-panel-rows`) **δεν** μολύνθηκε — το state διαβάζεται React-side στο row.
    Tests: +2 στο `bim-mesh-cache-bundle.test.ts` (getLoadState idle→ready· error σε 404). jscpd καθαρό.

- **2026-07-22 (§mesh-load — τα εισαγόμενα εμφανίζονται ΑΛΛΑ ως placeholder κουτιά· το `.glb` δεν φορτώνει ποτέ)** —
  Μετά το §render-gate οι οντότητες έφταναν στο 2Δ+3Δ, αλλά **πάντα** ως ορθογώνιο bbox κουτί (σωστή
  θέση/κλίμακα) και **ποτέ** ως το σμιλευμένο πλέγμα — σε fresh import ΚΑΙ μετά από reload. Το πραγματικό
  `.glb` δεν έφτανε ποτέ στον `bimMeshCache`.
  - **Ρίζα (grep SSOT audit, code = source of truth):** ασυνέπεια των **δύο αξόνων** του linked-model. Το
    URL λύνεται **ανά αρχείο** (`bim-mesh-cache.loadScene` → `resolveMeshUrl('imported', bundleId=uploadId)`,
    ΧΩΡΙΣ `#node`) — αλλά το `registerImportedMeshAsset` δήλωνε **ανά κόμβο**
    (`registerMeshAssetPath('imported', '<uploadId>#<nodeName>', path)`). Ο resolver έψαχνε κλειδί
    `imported/<uploadId>`, το registry είχε `imported/<uploadId>#<node>` → **miss** → curated library
    fallback (`bim-mesh-library/imported/<uploadId>.glb`, ανύπαρκτο για project-scoped εισαγόμενα) → **404**
    → `bim-mesh-cache` κλείδωνε `status='error'` **μόνιμα** → placeholder κουτί για πάντα, χωρίς κανένα
    σφάλμα ορατό. Επιβεβαιωμένο και από το ίδιο το test `bim-mesh-cache-bundle.test.ts:101` («το URL
    ζητείται για το ΑΡΧΕΙΟ, όχι για τον κόμβο»).
  - **Fix (full SSoT, μηδέν νέος resolver/registry):** το `registerImportedMeshAsset` γίνεται **file-scoped** —
    `registerImportedMeshAsset(uploadId, storagePath)` → `registerMeshAssetPath(IMPORTED_MESH_CATEGORY,
    uploadId, storagePath)`. Πλέον register-axis == resolve-axis (`imported/<uploadId>`). Idempotent (N κόμβοι
    ίδιου upload → ίδιο key). Καθαρίστηκε το πλέον αχρησιμοποίητο `nodeName` param + `importedMeshAssetId`
    import· τα δύο call sites (`import-gltf-meshes.ts` → μία κλήση ανά upload αντί για loop· `imported-mesh-
    persistence-helpers.ts` → ανά έγγραφο, idempotent) απλοποιήθηκαν. Η node-axis ζει **αποκλειστικά** στον
    cache (`indexBundleNodes` σπάει το φορτωμένο αρχείο σε N templates μετά τη λήψη — Revit/C4D linked-model).
  - **Tests (jest):** νέο `imported-mesh-asset-resolution.test.ts` (2 tests) — regression guard ότι
    register-axis ↔ resolve-axis ταιριάζουν (δήλωση ανά αρχείο → ο resolver βρίσκει το project path με
    κλειδί `uploadId`, όχι το library fallback· και ότι το curated μονοπάτι μένει άθικτο). Update
    `import-gltf-meshes.test.ts` → 2-arg + «μία δήλωση ανά αρχείο, όχι ανά κόμβο». Σύνολο 14/14 πράσινα.
    `jscpd:diff` καθαρό.
  - **Πρακτική των μεγάλων (Revit linked model / C4D proxy):** ένα αρχείο εντοπίζεται/κατεβαίνει **μία φορά
    ανά αρχείο** (κλειδί = file/upload id)· η ανάθεση σε κόμβο γίνεται **μετά** τη φόρτωση. Οι δύο άξονες
    πρέπει να είναι συνεπείς — το bug ήταν ακριβώς η ασυνέπεια (register per-node, resolve per-file).
- **2026-07-22 (§mesh-load-nesting — η καρέκλα έμεινε κουτί ΚΑΙ μετά το §mesh-load: nested κόμβοι)** —
  Μετά το file-scoped register (πάνω), ο Giorgio επιβεβαίωσε στον browser: το `.glb` πλέον λύνει URL σωστά,
  αλλά το πλέγμα **έμεινε placeholder κουτί**. Δεύτερη, ανεξάρτητη ρίζα.
  - **Ρίζα (grep SSOT audit):** ασυμμετρία **deep vs shallow** traversal. Ο parser `collectGltfObjects`
    (`io/mesh3d-roundtrip/gltf-scene-parse`) κάνει **deep** `root.traverse` → το `nodeName` της οντότητας
    μπορεί να είναι mesh **βαθιά** στην ιεραρχία (ο συνεργάτης C4D εξήγαγε τους κόμβους κάτω από
    armature/root group). Αλλά ο cache `indexBundleNodes` (`bim-mesh-cache`) ευρετηρίαζε **μόνο** top-level
    `scene.children` → ο nested κόμβος αποκτούσε `nodeName` αλλά **καμία** template → `getInstance` null →
    ο renderer έπεφτε στο ορθογώνιο, **παρότι** το αρχείο είχε κατέβει σωστά.
  - **Fix (full SSoT — ΕΝΑΣ walker, όχι δύο traversals που αποκλίνουν):** νέο pure module
    `bim-3d/scene/gltf-addressable-nodes.ts` (`collectAddressableGltfNodes` + `readGltfFaceKeys`), που
    ορίζει **μία φορά** ποιοι κόμβοι είναι διευθυνσιοδοτήσιμοι (deep, faced-solid-aware, ανώνυμα κρατιούνται).
    Τον καταναλώνουν **και** ο `collectGltfObjects` (refactor behavior-preserving — το παλιό `readFaceKeys`
    μεταφέρθηκε εκεί ως SSoT) **και** το `indexBundleNodes` (deep). Οι δύο άξονες (parse ↔ index) **δεν
    μπορούν** πλέον να αποκλίνουν εξ ορισμού. Ο nested κόμβος ευρετηριάζεται με **bake του world
    μετασχηματισμού** (`bakeNodeWorldTransform`) ώστε να στέκει σωστά αποσπασμένος από τον γονέα του·
    top-level κόμβος υπό identity root → ταυτόσημο με την παλιά συμπεριφορά (μηδέν παλινδρόμηση).
  - **Layering:** ο walker ζει στο `bim-3d/scene/` (όχι στο io/) γιατί ο parser (io) **ήδη** importει από
    εκεί (`finiteBox3FromObject`)· το αντίστροφο (cache bim-3d → io) θα δημιουργούσε κύκλο io ↔ bim-3d.
  - **Tests (jest):** νέο `gltf-addressable-nodes.test.ts` (7 tests: nested/flat/faced/single-faced/ανώνυμα/
    non-mesh/readGltfFaceKeys) + νέο case στο `bim-mesh-cache-bundle.test.ts` (nested σκηνή με μετασχηματισμένο
    γονέα → οι 3 κόμβοι δίνουν template). Τα 12 υπάρχοντα `gltf-scene-parse` tests **αμετάβλητα** πράσινα
    (behavior-preserving refactor). Σύνολο 41/41. `jscpd:diff` καθαρό (η διπλή λογική traversal **αφαιρέθηκε**,
    δεν αντιγράφηκε).

- **2026-07-22 (§project-scope — «Δεν βρέθηκε ενεργό έργο» ενώ το έργο υπάρχει)** — Ο import dialog
  διάβαζε το `projectId` **μόνο** από το `levels.saveContext?.projectId`, που τίθεται **μόνο** όταν το
  ενεργό επίπεδο έχει φορτώσει σκηνή από persisted file record (`useLevelSceneLoader`). Σε floor-derived
  ή ειδικά επίπεδα (Θεμελίωση, ή επίπεδο του οποίου η σκηνή δεν έχει φορτωθεί ακόμη) το `saveContext`
  είναι `null` → `projectId=''` → ο guard `if (!projectId || !companyId || !layerId)` έκοβε την εισαγωγή
  με toast «Δεν βρέθηκε ενεργό έργο», **παρότι** εταιρεία/έργο/κτήριο/όροφοι υπάρχουν κανονικά (μετρημένο
  στη βάση: `proj_04a6b4bb` «ΕΡΓΟ Α», DXF Ισογείου linked σωστά).
  - **Fix (full SSoT, μηδέν νέος resolver):** fallback στον υπάρχοντα durable SSoT
    `resolveActiveProjectId(levels)` (`systems/levels/level-floor-resolution.ts`, ADR-650 M10) —
    επιστρέφει το `projectId` του πρώτου linked level (ίδιο για όλο το κτήριο, διαθέσιμο από το load,
    δεν κάνει flip `null→value`). Ο ίδιος resolver φτιάχτηκε για ΤΑΥΤΟ πρόβλημα στο topo-survey scope
    (ειδικοί όροφοι χωρίς δικό τους projectId). Νέα γραμμή: `saveContext?.projectId ??
    resolveActiveProjectId(levels.levels) ?? ''`. Ο `resolveActiveProjectId` έχει ήδη κάλυψη
    (`resolve-active-project-id.test.ts`, 4 tests πράσινα). jscpd καθαρό.
  - **Πρακτική των μεγάλων (Revit-grade):** το project scope είναι durable ιδιότητα της ιεραρχίας
    (project→building→floor→level), όχι εφήμερη κατάσταση της φορτωμένης σκηνής· η εισαγωγή δεν πρέπει
    να αποτυγχάνει επειδή το ενεργό επίπεδο δεν έχει ακόμη hydrate-άρει τη σκηνή του.

- **2026-07-22 (§render-gate — τα εισαγόμενα πλέγματα δεν έφταναν ΠΟΤΕ στον 3Δ manager)** — Μετά τη λύση
  των μονάδων (§units) αποκαλύφθηκε ξεχωριστό bug: τα `imported-mesh` εμφανίζονταν στο 2Δ **ως ορθογώνιο
  κουτί** (όχι σμιλεμένο silhouette) και στο 3Δ **καθόλου**.
  - **Ρίζα (γειωμένη με grep SSOT audit, όχι το building gate που υποψιαζόταν το handoff):** το single-floor
    `resyncBimScene` (`bim-3d/scene/bim3d-resync.ts`) ξανάγραφε **με το χέρι** το object literal των entity
    slices που περνά στο `manager.syncBimEntities(...)` και είχε **ξεχάσει το `importedMeshes`** (προστέθηκε
    στο Φ3· τα `furnitures`/`genericSolids`/… υπήρχαν). Άρα `entities.importedMeshes` = undefined → ο point-
    contract (`bim-scene-point-contracts.ts:114`) δεν χτίζε τίποτα → **3Δ κενό**. Και επειδή ο 3Δ converter
    (`meshToObject3D`) είναι ο **μόνος** που καλεί `bimMeshCache.preload()`, ο cache δεν γέμιζε ποτέ → το 2Δ
    `ImportedMeshRenderer` δεν έβρισκε silhouette → **κολλούσε στο bbox κουτί**. Ένα κενό, δύο συμπτώματα.
  - **Fix (full SSoT):** αντικατάσταση του drift-prone hand-literal με τον υπάρχοντα typed selector
    `selectBim3DEntities(s)` (`Bim3DEntitiesStore.ts`). Ο selector απαιτεί **ΟΛΑ** τα slices του
    `Bim3DEntities`, άρα καμία μελλοντική οικογένεια οντοτήτων δεν μπορεί να ξεχαστεί ξανά — ίδια anti-drift
    εγγύηση με το `EMPTY_BIM_ENTITIES` (N.18). Το multi-floor path (`extract-bim3d-entities.ts:48`) περιλάμβανε
    ήδη τα imported meshes → μόνο το single-floor είχε σπάσει· τώρα τα δύο μονοπάτια συμφωνούν.
  - **Διερευνήθηκαν & απορρίφθηκαν ως αίτια (τίμια):** (α) το 3Δ building/floor visibility gate
    (`shouldRender`/`activeBuildingId`) — το furniture χρησιμοποιεί **ίδιο** floor-chain (`floorId`→floor→
    building) και δουλεύει, άρα το gate δεν φταίει· καμία αλλαγή σε shared visibility logic. (β) threading
    `storeyId` — το `floorId` ήδη περνά και είναι η ίδια τιμή (`resolveEntityBuilding` κάνει `storeyId ?? floorId`).
    (γ) category `'imported-mesh'` vs `'imported'` — δύο διαφορετικοί άξονες (V/G vs storage folder), και οι δύο
    σωστοί· latent type-hygiene ήδη τεκμηριωμένο στο `resolve-entity-bim-category.ts`, άσχετο εδώ.
  - **Test:** νέο `bim-3d/scene/__tests__/bim3d-resync.test.ts` (3 tests, πράσινα) — regression anchor με τον
    ΠΡΑΓΜΑΤΙΚΟ store+selector: single-floor resync προωθεί το `importedMeshes` slice + κάθε κλειδί του
    `EMPTY_BIM_ENTITIES`. Το 2Δ preload δεν αποκλίνει: ο `FurnitureRenderer` επίσης δεν preload-άρει (κοινό
    pattern — ο 3Δ converter preload-άρει, 2Δ+3Δ καταναλώνουν τον ίδιο cache).

- **2026-07-22 (§units — ρητή μονάδα εισαγωγής glTF/GLB)** — Λύση του «εισαγόμενο αόρατο λόγω μονάδων»
  (καρέκλα Aeron σε ίντσες, βλ. §10.5). Νέο SSoT `import-unit-scale.ts` (reuse `sceneUnitsToMeters` — κανένας
  δεύτερος πίνακας factor)· ο factor ρέει σε **θέση** (`import-gltf-meshes` → `scaleWorldBoxByFactor` πριν το
  placement) και **μετρήσεις** (`build-imported-mesh-entity`: dims ×f, area ×f², volume ×f³ null-safe, χωρίς
  να αγγίζει το fingerprint hash). UI: `ImportUnitScaleControl` (dropdown 5 μονάδες + custom + live preview)
  στο `ImportedMeshImportDialog`, default = μέτρα. i18n: ονόματα από `common:units.*`, context κλειδιά στο
  `c4dMaterialImport.importMeshes.*` (el+en). **Auto-detect απορρίφθηκε ρητά** (anti-pattern των μεγάλων).
  Το `untitled.glb` δεν πειράχτηκε — το αρχείο είναι έγκυρο, ο χειρισμός μονάδων ήταν το κενό.

- **2026-07-21 (ADR-678 Φ3 — per-face material round-trip, ΜΟΝΟ glTF· κλείνει το «🔴 ΓΝΩΣΤΟ ΟΡΙΟ»
  του hotfix παρακάτω)** — Ιδιοκτησία αυτής της φάσης: **ADR-678** (πώς ταξιδεύει ένα υλικό),
  καταγράφεται εδώ γιατί λύνει ρητά το όριο που κατέγραψε ο Φ2 hotfix του ίδιου ADR-683.
  - **Ρίζα:** μόλις ένα στοιχείο αποκτούσε per-face appearance (ADR-539) γινόταν multi-material
    mesh· το `assignExportMaterials` έκανε **skip** τα multi-material → στην επαν-εξαγωγή τα
    per-face υλικά έβγαιναν **ανώνυμα** και εκτός baseline → ο **2ος** γύρος συνεργασίας έσπαγε
    (μετρημένο: 81 ανώνυμα κόκκινα + 1 named σοβάς). Ο 1ος γύρος δούλευε ήδη πλήρως.
  - **Μετρημένη συμπεριφορά three (jest probe):** ο `GLTFExporter` σπάει ένα multi-material mesh σε
    **ένα primitive ανά `geometry.group`**· ο `GLTFLoader` το επιστρέφει ως **`THREE.Group` με ένα
    single-material child mesh ανά primitive** (ΟΧΙ mesh με `material[]`). Το node-level
    `mesh.userData` (άρα και το `faceKeyByMaterialIndex`) **επιβιώνει ακέραιο**, σε αρχική σειρά· τα
    ονόματα υλικών επιβιώνουν verbatim· primitive↔child = 1:1 ντετερμινιστικό. Per-primitive
    `extras` δεν είναι εφικτά (`geometry.userData` ίδιο σε όλα) → η «διεύθυνση όψης» ταξιδεύει
    **μόνο** ως το node-level array + η θέση.
  - **Αρχεία (5, ADR-678 §6 έχει το πλήρες detail):** `mesh3d-materials.ts` (ονοματίζει ΚΑΙ τα array
    υλικά, colour-based `mat_<hex6>`)· `obj-mtl-parse.ts` + `match-objects-to-entities.ts` (νέο
    `faceMaterials?` πεδίο)· `gltf-scene-parse.ts` (αναγνωρίζει faced solid, ξαναχτίζει
    `faceMaterials` ανά θέση, skip per-face children ως ξεχωριστές entities)· `import-c4d-
    materials.ts` (per-face `SetFaceAppearanceCommand`, collapse σε `BASE_FACE_KEY '*'` όταν όλες οι
    όψεις ταιριάζουν, idempotent).
  - **SSoT:** η αρίθμηση όψεων παραμένει ΕΝΑ SSoT (`bim-three-faced-prism.ts::faceKeyByMaterialIndex`,
    node-level `userData`) — ταξιδεύει αυτούσια, μηδέν δεύτερος υπολογισμός στον import.
  - **ΜΟΝΟ glTF.** Το OBJ μονοπάτι παραμένει per-object dominant — ο stock `OBJExporter` του three
    δεν είναι group-aware (§6.2 του ADR-678). Δεν αλλάζει το §6 (πίνακας formats) αυτού του ADR: το
    glTF ήταν ήδη ο «🏆 Κύριος δρόμος», τώρα κερδίζει πλήρες per-face round-trip έναντι του OBJ.
  - **134 υπάρχοντα tests πράσινα + νέα Φ3 tests.** Γνωστό όριο (τίμια): ένα προϋπάρχον 3-γραμμο
    idiom collapse-σε-CompositeCommand υπάρχει τώρα ΚΑΙ σε `import-c4d-materials.ts` ΚΑΙ σε
    `bim-3d/ui/apply-face-appearance.ts` — δεν εξήχθη σε κοινό helper (δεύτερο αρχείο κοινό με άλλον
    πράκτορα ταυτόχρονα)· Boy-scout on-touch υποψήφιο.

- **2026-07-21 (Φ2 hotfix — το round-trip εμφάνισης δουλεύει ΟΛΟΚΛΗΡΟ· δύο δικά μας σπασίματα)** — Το
  όραμα του §1 (στέλνω `.glb` → ο συνεργάτης βάφει → γυρίζει → **ταιριάζει**) **δεν είχε δοκιμαστεί
  ποτέ ολόκληρο**. Δοκιμάστηκε με το `scripts/simulate-partner-repaint.js` («τέλειος συνεργάτης»:
  αλλάζει μόνο χρώμα υλικού, ονόματα/γεωμετρία byte-identical). Έσπαγε — και **όχι** από εξωτερικό
  εργαλείο. Ground truth (`Ισόγειο.glb`): 1/6 κόμβοι με ταυτότητα, **2 υλικά ανώνυμα**.
  - **Break B — ανώνυμα glTF υλικά.** Το `assignExportMaterials` καλούνταν **μόνο στον OBJ κλάδο**
    (`mesh3d-export-adapter.ts`)· ο glTF έβγαινε με ανώνυμα υλικά → ο import (που ταιριάζει **με
    όνομα**) δεν έβρισκε τίποτα. Fix: το naming/table τρέχει πλέον στο **κοινό** μονοπάτι (όπως το
    `nameMeshesForExport`), glTF με **κενό hidden set** (τα κρυμμένα ταξιδεύουν μέσω ονόματος κόμβου,
    όχι διαφανούς υλικού). Μηδέν sibling clone (N.18): μία `assignExportMaterials`, όχι δεύτερο helper.
  - **Break C — repaint αγνοούνταν ως «αμετάβλητο».** Ο `isUnchangedNestorMaterial` (ΡΙΖΑ 2 του
    ADR-678) γύριζε `null` για DNA/`mat_<hex6>` ονόματα — σωστό για C4D («νέο υλικό = νέο όνομα»),
    **λάθος** για Blender/glTF όπου ο συνεργάτης **ξαναβάφει κρατώντας το όνομα**. Fix **manifest-
    driven** (η πρακτική των reconcilers των μεγάλων, όχι heuristic reverse-parse): το ζωντάνεμα του
    **«declared but not fed»** `.nestor.json` — νέο πεδίο `materials` (§7) καταγράφει το **εξαχθέν
    χρώμα ανά υλικό (sRGB)**· ο import (`resolveImportAppearance::detectRepaint`) συγκρίνει πραγματικό-
    vs-καταγεγραμμένο → κάθε αλλαγή ανιχνεύεται. Το `<input>` δέχεται πλέον `.json` και διαβάζει το
    sidecar. **Μόνο glTF μονοπάτι**: το OBJ `.mtl` `Kd` είναι **linear** ενώ baseline+glTF actual
    **sRGB** → σύγκριση στο OBJ θα έδινε false-positive (Ρίσκο R1). Backward-compatible: λείπει
    sidecar/legacy manifest → σημερινή συμπεριφορά.
  - **Η ταυτότητα του σοβά ΔΕΝ άλλαξε — ήταν ήδη η πρακτική της Revit.** Ο σοβάς είναι ενιαίο skin
    ανά κτίριο/ζώνη με synthetic id· ο import τον δρομολογεί **πίσω στις όψεις των δομικών μελών**
    (`finish-import-routing.ts`, ADR-678 Φ1.1) — όπως τα finishes = layers στο compound structure
    της Revit, όχι GUID objects. Το matching γίνεται με **zone token** (`-hcol-/…`), όχι με
    buildingId. Το κενό buildingId (`resolveEntityBuilding → ''` σε ανανάθετα/single-building) ήταν
    **κοσμητικό** (`Column_structural-finish-` με ξεκρέμαστη παύλα)· fix = σταθερό fallback `nameId =
    buildingId || ctx.activeBuildingId || 'default'` **μόνο** στο όνομα του skin (το `groups` key και
    το `userData['buildingId']` tag μένουν ως έχουν → μηδέν grouping regression).
  - **Αρχεία:** 9 (export 2, io 5, ui 1, bim-3d 1), όλα <500 γρ. **Έλεγχοι:** +~20 tests (baseline
    serialise/parse, detectRepaint, glTF naming, threading σε body+σοβά paint paths)· θιγμένα suites
    πράσινα (mesh3d-materials/export-manifest/obj-material-import/finish-import-routing/import-c4d/
    mesh3d-roundtrip)· `jscpd:diff` καθαρό. Το finish-sync naming fallback (τετριμμένο `||`) δεν πήρε
    δικό του integration test — η ουσιαστική εγγύηση (token routing επιβιώνει με μη-κενό suffix)
    καλύπτεται από τα `finishTargetTypes`/`isFinishSkinName` tests.
  - **✅ Επαληθευμένο στην οθόνη (Giorgio, 2026-07-21):** ΚΑΙ τα δύο paint paths ζωντανά — σώματα
    (κολώνες→κόκκινες, `SetFaceAppearanceCommand`) ΚΑΙ σοβάς (φινιρίσματα→πράσινα, `finish-import-
    routing`), αμφότερα DNA υλικά που ανιχνεύθηκαν μέσω manifest baseline. buildingId fallback
    ορατό ως `structural-finish-default`.
  - **🔴 ΓΝΩΣΤΟ ΟΡΙΟ — το round-trip ΔΕΝ είναι επαναλήψιμο σε ήδη-βαμμένα στοιχεία.** Μόλις ένα
    στοιχείο αποκτήσει per-face appearance (είτε από import είτε χειροκίνητα, ADR-539), ο converter
    το κάνει **multi-material mesh** (array υλικών ανά όψη). Το `assignExportMaterials` **σκόπιμα
    παρακάμπτει** τα multi-material (`mesh3d-materials.ts` — `Array.isArray(mesh.material)`), οπότε
    στην **επαν-εξαγωγή** αυτά τα υλικά βγαίνουν **ανώνυμα** και **εκτός baseline**. Μετρήθηκε:
    export ήδη-βαμμένου ορόφου → 81 ανώνυμα κόκκινα υλικά (13 κολώνες × per-face) + 1 named
    `mat-plaster-int`. Συνέπεια: **δεύτερος** γύρος συνεργασίας σε ήδη-βαμμένα στοιχεία σπάει (χάνεται
    το κανάλι ονόματος). Ο **πρώτος** γύρος (φρέσκο μοντέλο → βαφή → import) δουλεύει πλήρως. Fix =
    ξεχωριστή συνεδρία: ονοματοδοσία per-face υλικών στο multi-material μονοπάτι εξαγωγής (σύνορο
    ADR-539 ↔ ADR-668), ΟΧΙ τετριμμένο.
    **✅ ΕΠΙΛΥΘΗΚΕ (2026-07-21, ADR-678 Φ3)** — βλ. καταχώρηση στην κορυφή αυτού του §11. Περίληψη:
    `assignExportMaterials` ονοματίζει πλέον ΚΑΙ τα array (per-face) υλικά χρωματικά (`mat_<hex6>`)·
    ο glTF import (`gltf-scene-parse.ts`) αναγνωρίζει το faced solid (Group child-per-primitive **ή**
    single Mesh με `userData.faceKeyByMaterialIndex`) και ξαναχτίζει `faceMaterials` ανά θέση· ο
    orchestrator εφαρμόζει per-face `SetFaceAppearanceCommand` με collapse σε `BASE_FACE_KEY '*'`
    όταν όλες οι όψεις ταιριάζουν. **Μόνο glTF** — το OBJ μονοπάτι παραμένει per-object dominant
    (stock `OBJExporter` όχι group-aware).

- **2026-07-20 (Φ3.1γ — το πάνελ εισαγόμενων· η ορατή απουσία αποκτά τόπο)** — Η Φ3.1γ **σπάστηκε**:
  εδώ έγινε **μόνο** το πάνελ· η μνήμη κανόνων αποσπάστηκε ως **Φ3.1δ** (N.8: ~10-13 αρχεία / 4
  domains από μόνη της). Νέα: `imported-mesh-panel-rows.ts` (καθαρός πυρήνας + 8 tests),
  `ImportedMeshesPanel` / `ImportedMeshUploadSection` / `ImportedMeshListRow`, tab `imported-meshes`.
  - **Η απόφαση «εκτός BOQ» είχε ανεξόφλητο τίμημα.** Η Φ3.1α αποφάσισε ότι ανανάθετο πλέγμα δεν
    παράγει γραμμή BOQ (μηδενική γραμμή = φαινομενικά μετρημένο κόστος μηδέν). Ο μετρητής
    `countUnassignedImportedMeshes` υπήρχε από τη Φ3.1β, αλλά εμφανιζόταν **μόνο μέσα στο dialog
    ανάθεσης** — δηλαδή μόνο αφού ο χρήστης είχε ήδη βρει ένα ανανάθετο **μόνος του**. Το πλήθος
    πλέον φαίνεται **πριν** ανοίξει οτιδήποτε. Χωρίς αυτό, η «ορατή απουσία» ήταν αόρατη.
  - **Το Properties palette ΔΕΝ μπορούσε να το φιλοξενήσει** (το handoff πρότεινε
    `TopoSurfacePropertiesTab` ως πρότυπο). Εκείνα ζουν στον `BimPropertiesRouter` και είναι
    **object-bound** — εμφανίζονται μόνο με ενεργή επιλογή. Λίστα *όλων* των εισαγόμενων με
    συνολικό badge είναι εξ ορισμού project-wide· δεν είναι το ίδιο είδος επιφάνειας.
    ⚠️ **Εν γνώσει αντίθεση με το ADR-662 Φ4**, που **απέσυρε** το `topography` από αριστερό tab υπέρ
    «ribbon + Properties». Εναλλακτικές που εξετάστηκαν: εντολή στο **Analyze** ribbon tab (ρητά
    σχεδιασμένο να δεχτεί κι άλλα reporting) και επέκταση του `BimScheduleDialog` με
    `ScheduleEntityType:'imported-mesh'` (η Revit πρακτική: επεξεργασία παραμέτρων μέσα στο
    schedule). **Απόφαση Giorgio: 8ο αριστερό tab.** Καταγράφεται γιατί ο επόμενος που θα διαβάσει
    το ADR-662 θα βρει δύο κανόνες σε σύγκρουση — δεν είναι παράβλεψη.
  - **Ομαδοποίηση ανά `uploadId`, όχι επίπεδη λίστα.** Το `uploadId` **είναι** η ταυτότητα «αυτά
    ήρθαν μαζί» (§ linked-model). Ο χρήστης ρωτά «τι μου έστειλε ο συνεργάτης Χ;» — 60 επίπεδες
    γραμμές από τρία `.glb` δεν απαντούν. Πρότυπο: Manage Links του Revit.
  - **Η σειρά είναι συμπεριφορά, όχι παρουσίαση** — γι' αυτό ζει σε καθαρό module με tests, όχι
    μέσα στο component: ανανάθετα πρώτα μέσα στην ομάδα, ομάδες με εκκρεμότητες πρώτες. Το πάνελ
    **είναι** λίστα εκκρεμοτήτων· η δουλειά που μένει ανεβαίνει.
  - **Επιλογή ΠΡΙΝ το άνοιγμα του dialog.** Ο χρήστης πρέπει να βλέπει στην κάτοψη τι κοστολογεί.
    Ασφαλές επειδή το `ImportedMeshBoqDialogStore` κρατά **καρφωμένο** το `entityId` όσο είναι
    ανοιχτό — αλλαγή επιλογής δεν μπορεί να γράψει ανάθεση σε λάθος πλέγμα.
  - **Ο κύκλος ζωής δεν διπλασιάστηκε** (N.7.2 §7): το πάνελ είναι **αναγνώστης** — δύο store
    κλήσεις, μηδέν νέα κατάσταση. Ιδιοκτήτης της ανάθεσης παραμένει ο `ImportedMeshBoqHost`.
  - **Μικρο-κεντρικοποίηση (N.0.2):** ο discriminator `'imported-mesh'` ήταν literal σε καταναλωτές
    που δέχονται χαλαρό `{type: string}` — εκεί ο tsc **δεν** ελέγχει τίποτα και ένα τυπογραφικό θα
    έδινε σιωπηλά «κανένα εισαγόμενο». Νέα σταθερά `IMPORTED_MESH_ENTITY_TYPE`· το `SceneEntityLike`
    εξήχθη ώστε ο μετρητής και η λίστα να ρωτούν **το ίδιο** ελάχιστο συμβόλαιο.
  - **Έλεγχοι:** 83 tests στο imported-mesh (+8), 126 suites / 1268 tests σε `app`+`ui`, capability
    anchors 329/21 αμετάβλητα, `jscpd:diff` καθαρό. ⚠️ **Καμία επαλήθευση στην οθόνη** — βλ. §11 της
    Φ3β· ισχύει ακόμη.

- **2026-07-20 (Φ3.1β — η διεπαφή ανάθεσης· η κοστολόγηση γίνεται πράξη του χρήστη)** — Το μοντέλο
  της Φ3.1α απέκτησε χειριστήριο. **Η μνήμη κανόνων (§2.4 του σχεδίου) ΔΕΝ έγινε** — αποσπάστηκε ως
  **Φ3.1γ** μετά από μέτρηση εύρους (~24 αρχεία / 4 domains → N.8) και απόφαση Giorgio.
  - **Το gating μονάδων είναι ΤΟΜΗ ΤΡΙΩΝ, όχι ενός.** Το σχέδιο έλεγε «οι μονάδες βγαίνουν από
    `supportedBoqUnits`». Λάθος από μόνο του: το `getAllowedUnits` (`config/boq-categories`)
    **υπήρχε ήδη** ως SSoT «τι επιτρέπει το άρθρο ΑΤΟΕ» και το χρησιμοποιεί κάθε χειροκίνητη γραμμή
    προμέτρησης. Νέο `assignableBoqUnits(params, categoryCode)` = *τι μετρά η γεωμετρία* ∩ *τι
    επιτρέπει το άρθρο* ∩ *τι μετατρέπει το `deriveAtoeQuantity`*. Χωρίς τον 2ο περιορισμό, ένα
    κάγκελο θα μπορούσε να ανατεθεί σε m³ κάτω από άρθρο που ρητά δεν τα δέχεται.
    ⚠️ **Οι υποκατηγορίες κληρονομούν από την ομάδα**: `getAllowedUnits('OIK-12.1')` δεν βρίσκει
    κατηγορία και πέφτει στο γενικό fallback — δηλαδή **χαλαρώνει σιωπηλά** το gating. Λύση:
    `atoeGroupCodeOf()` μεταβαίνει `OIK-x.y → OIK-x` πριν τη ρώτηση. Test το καρφώνει.
    **Κενή τομή είναι έγκυρη απάντηση** (ανοιχτό πλέγμα + άρθρο σκυροδέματος) → το dialog το εξηγεί
    και δεν επιτρέπει αποθήκευση, αντί να γράψει νούμερο σε λάθος διάσταση.
  - **Το όνομα υλικού δεν αποθηκευόταν πουθενά** — και χωρίς αυτό το μέτρο τριβής 2 (§10.2, πρόταση
    από υλικό) θα ήταν **δηλωμένο και ανενεργό**, ακριβώς το μοτίβο που δάγκωσε τρεις φορές αυτό το
    ADR. Το `record.materialName` υπάρχει στην εισαγωγή και χανόταν οριστικά (η ανάθεση γίνεται σε
    **άλλη συνεδρία**, με το `.glb` ξεφόρτωτο). Νέο προαιρετικό `params.sourceMaterialName`,
    γραμμένο μία φορά κατά την εισαγωγή. Το κλειδί **παραλείπεται** όταν λείπει — ποτέ `undefined`.
  - **Οι δύο πηγές πρόβλεψης ΣΥΝΔΥΑΖΟΝΤΑΙ, δεν ανταγωνίζονται.** Το σχέδιο τις απαριθμούσε ως
    ξεχωριστά μέτρα. Απαντούν όμως σε διαφορετικές ερωτήσεις: το όνομα κόμβου λέει **τι είναι**
    (`Rail_01` → κάγκελο), το υλικό **από τι είναι** (`Inox_304` → με τιμή). Το
    `suggestImportedMeshIdentity` παίρνει **άρθρο+τίτλο από το όνομα** και **`materialId` από το
    υλικό** → πρόταση που καμία πηγή μόνη της δεν ήξερε. Καμία μαντεψιά από γεωμετρία (§3):
    άγνωστο όνομα + άγνωστο υλικό → `null`, κενό έντυπο. **Η βλάστηση δεν έχει άρθρο ΑΤΟΕ** και
    γι' αυτό δεν έχει κανόνα — ένα δέντρο δεν είναι οικοδομική εργασία.
  - **`EntityFieldOverrideCommand`, ΟΧΙ `AssignTypeCommandBase`.** Το προφανές αρχέτυπο («Assign»
    στο όνομα) ήταν λάθος: εκείνο γράφει `typeId`/`typeOverrides` και ξαναϋπολογίζει **γεωμετρία**.
    Εδώ η γεωμετρία δεν αλλάζει καθόλου — η ταυτότητα δηλώνει *πώς κοστολογείται*, όχι *τι είναι*
    (§10.4). Το `undefined` είναι **έγκυρη τιμή εγγραφής** (αφαίρεση), όχι «τίποτα»: μια φρουρά
    `if (!value) return false` θα έκανε το undo μιας ανάθεσης σιωπηλό no-op. Mutation-verified.
  - **`withImportedMeshIdentity` ΣΒΗΝΕΙ το κλειδί στην αφαίρεση.** Το Firestore απορρίπτει
    `undefined` και το `params` γράφεται ως ενιαίο map (`updateImportedMesh`) → ένα `undefined`
    κλειδί θα σήμαινε «ξε-ανατέθηκε στην οθόνη, επέστρεψε στο επόμενο reload». Mutation-verified.
  - **Λανθάνον σφάλμα τύπου που έκλεισε:** ο `BimToBoqBridge:125` περνούσε `BimEntityType` (που
    **ήδη** περιείχε `'imported-mesh'` από τη Φ3.1α) εκεί που ζητείται `BOQItem['sourceEntityType']`
    (που **δεν** το περιείχε). Αόρατο, γιατί το root `tsconfig` **εξαιρεί** το `dxf-viewer`. Η
    προσθήκη της τιμής στο union (§2.3) δεν ήταν καλλωπισμός.
  - **Το `imported-mesh` μετακινήθηκε στο `ENTITY_CONTEXTUAL_TRIGGER` map**, όπως προέβλεπε ρητά η
    σημείωση της Φ3 στο coverage test. Tab **actions-only** (mirror `topo-surface`): ένα ψημένο
    πλέγμα δεν έχει παραμέτρους να επεξεργαστείς (§3)· η μία απόφαση είναι η κοστολόγηση.
  - ⚠️ **Το badge «N ανανάθετα» δεν μπήκε όπου το περιέγραφε το σχέδιο** («στο UI των εισαγόμενων»):
    **τέτοιο UI δεν υπάρχει** — κανένα πάνελ/λίστα εισαγόμενων. Ο καθαρός μετρητής
    (`countUnassignedImportedMeshes`, με tests) εμφανίζεται στο dialog ως «μένουν N ακόμη», που
    είναι όπου ο χρήστης πράγματι δουλεύει επαναληπτικά. Το **αυτόνομο πάνελ** πάει στη Φ3.1γ.
  - **Verification:** 925 tests / 84 suites GREEN (app + ribbon + imported-mesh + roundtrip)·
    **329/329 capability anchors**· `jscpd:diff` καθαρό σε 10 αρχεία ΧΩΡΙΣ `SKIP`· mutation-verified
    ×2 (undefined-αντί-διαγραφής → 3 κόκκινα· falsy guard στο `writeValue` → 2 κόκκινα· revert
    πράσινο)· i18n el+en επαληθευμένα προγραμματιστικά (8/8 κλειδιά, ICU plural όπως τα αδέλφια).
    **ΟΧΙ tsc (N.17).**
  - 🔴 **Καμία επαλήθευση στην οθόνη** — ούτε αυτής της φάσης ούτε της Φ3β (που δεν επαληθεύτηκε
    ποτέ). Το dialog δοκιμάζεται μόνο πάνω σε οντότητες που μπήκαν σωστά· αν αστοχεί το ύψος
    τοποθέτησης, η ρίζα είναι στο `useImportedMeshPlacementContext`.

- **2026-07-20 (Φ3.1α — το μοντέλο κοστολόγησης· η ταυτότητα αποκτά νόημα)** — Η αλυσίδα
  «ανάθεση → ποσότητα → γραμμή BOQ» κλείνει λογικά. Το UI ανάθεσης (Φ3.1β) μένει εκτός.
  - **Το `boq: 'missing'` δεν ήταν ποτέ flag.** Καμία τέτοια τιμή δεν υπήρχε στον κώδικα: το
    `imported-mesh` απλώς **έλειπε από το `BimEntityType` union** — όπως λείπουν ακόμα τα
    `topo-surface`, `mep-fitting`, `electrical-panel`. Η φάση **πρόσθεσε τύπο σε union**.
  - **Καμία τέταρτη διαδρομή τροφοδοσίας.** 1 οντότητα → 1 γραμμή = **Path 1**
    (`BimToBoqBridge.upsertSingleEntry`). Ο φρουρός frozen-baseline του ADR-673 κάθεται ήδη εκεί,
    άρα η προστασία approved/certified ήρθε **δωρεάν** αντί να ξαναγραφεί σωστά.
  - **Ο έκτος resolver εκτός kind-πίνακα** (μαζί με beam I-shape / mep-segment / stair /
    opening-hardware / foundation): `resolveImportedMeshMapping`. Ιδιαιτερότητα — είναι ο μόνος του
    οποίου η πηγή είναι **δήλωση χρήστη** αντί ιδιότητα του μοντέλου, γιατί ένα ψημένο πλέγμα δεν
    φέρει ούτε κόστος ούτε μονάδα μέτρησης (§3). Fail-closed: μερική ταυτότητα → `null` → **καμία
    γραμμή**, ποτέ γραμμή με κενό τίτλο ή μονάδα που δίνει σιωπηλά μηδέν.
  - 🔴 **Ο όγκος ήταν το πραγματικό πρόβλημα, όχι η ταυτότητα.** Το ίδιο κουτί 10×1×0,05 m περιέχει
    κάγκελο (~0,02 m³) ή διακοσμητικό τοίχο (~0,5 m³) — **σφάλμα ×25** και **αδύνατο να ξεχωριστεί
    από τις διαστάσεις**. Νέο module `io/mesh3d-roundtrip/mesh-solid-measure.ts`: προσανατολισμένη
    πολλαπλότητα (κάθε κατευθυνόμενη ακμή ακριβώς μία φορά, με την αντίστροφή της επίσης μία) +
    προσημασμένος όγκος τετραέδρων. **Όγκος μόνο για κλειστό κέλυφος· αλλιώς `null`** — ακριβώς η
    συμπεριφορά του Revit σε εισαγόμενο DirectShape και η αρχή του IFC (`IfcElementQuantity`:
    δηλώνονται, δεν συνάγονται). Οι μονάδες m³/kg **δεν προσφέρονται καν** σε ανοιχτό πλέγμα.
    - Οι κορυφές **συγκολλούνται κατά θέση** πριν τον έλεγχο: ο `GLTFLoader` διπλασιάζει κορυφές
      στις σκληρές ακμές (ίδια θέση, άλλο normal), οπότε έλεγχος με τους δείκτες του buffer θα
      έβγαζε **κάθε** στερεό ως ανοιχτό.
    - Ο υπολογισμός γίνεται περί το κεντροειδές: τα γινόμενα τριών συντεταγμένων μεγαλώνουν με τον
      **κύβο** της απόστασης, οπότε γεωαναφερμένη γεωμετρία θα έχανε κάθε σημαντικό ψηφίο.
  - **Το εμβαδόν ΔΕΝ ξαναγράφτηκε.** Το `GeometrySignature.areaM2` της Φ2 είναι ήδη το συνολικό
    εμβαδόν τριγώνων σε world space. Νέο είναι **μόνο** ο όγκος· το εμβαδόν και οι διαστάσεις
    περνούν αυτούσια. Ένα δεύτερο «measure everything» module θα ήταν structural clone (N.18).
  - **Νέο SSoT `io/mesh3d-roundtrip/mesh-triangles.ts`** — ανάγνωση κορυφών world-space + διέλευση
    τριγώνων (indexed/non-indexed) σε **ένα** σημείο, κοινό για fingerprint και solid measure.
    Καθαρή εξαγωγή από το `geometry-hash`, μηδέν αλλαγή συμπεριφοράς (50 tests αμετάβλητα πράσινα).
  - **Δεν αποθηκεύεται `isWatertight`.** Το `measuredVolumeM3 === null` **είναι** η απάντηση· δύο
    πεδία για το ίδιο γεγονός θα απέκλιναν.
  - **Μία μόνο μετατροπή mm → m** (`imported-mesh-boq.ts`). Το μήκος βγαίνει από τη **διαγώνιο του
    ίχνους**, όχι τη μεγαλύτερη πλευρά: γραμμικό αντικείμενο υπό 45° έχει bbox 7,07×7,07 ενώ είναι
    10 m — η πλευρά θα το υποτιμούσε κατά 30%. **Όριο, ρητά:** για καμπύλο/σχήματος Γ δίνει τη
    χορδή, όχι το ανεπτυγμένο μήκος· διαδρομή δεν βγαίνει από ψημένα τρίγωνα (§3).
  - 🔴 **Το προφανές πρότυπο για αντιγραφή είχε κενό.** Το `useRailingPersistence.onDeleted` κάνει
    μόνο audit και **αφήνει ορφανή τη γραμμή BOQ**. Το `imported-mesh` χτίστηκε πάνω στο
    `createBimBoqAuditLifecycle` (ADR-628) που κάνει και τα τρία σωστά, ώστε το κενό να μην
    κληρονομηθεί. Προστέθηκε επιπλέον η **αφαίρεση ανάθεσης**: χωρίς ταυτότητα το upsert σιωπηλά
    δεν κάνει τίποτα, οπότε χωρίς ρητή διαγραφή η παλιά γραμμή θα μετρούσε για πάντα.
  - **Ανανάθετο → καμία γραμμή** (απόφαση Giorgio): προτιμάται η ορατή απουσία από μηδενική γραμμή
    που μοιάζει με μετρημένο κόστος. Προκύπτει από το υπάρχον συμβόλαιο (`mapping === null` →
    early return), χωρίς ειδική περίπτωση.
  - **Κατάλογος ΑΤΟΕ άρθρων δεν υπάρχει** (μετρημένο): μόνο 16 κατηγορίες + 98 υποκατηγορίες,
    **χωρίς τιμές**· τα `BOQ_PRICE_LISTS`/`BOQ_TEMPLATES` δηλώνονται και δεν χρησιμοποιούνται. Το
    μόνο που κουβαλά τιμή στο repo είναι το `BimMaterial.defaultUnitCost` — γι' αυτό η ταυτότητα
    κρατά προαιρετικό `materialId` ως τη μοναδική αυτόματη διαδρομή τιμής.
  - **Tests:** 357 πράσινα στις θιγόμενες περιοχές (35 suites) · **329/329** capability anchors ·
    `jscpd:diff` καθαρό. Νέα: 11 για όγκο/στεγανότητα (κλειστό/ανοιχτό/επίπεδο/μη-πολλαπλό/
    εκφυλισμένο/non-indexed/γεωαναφερμένο/ανάποδη φορά), 17 για gating & μετατροπή & fail-closed.
  - **Τι ΔΕΝ έγινε:** το `supportedBoqUnits` υπάρχει και ελέγχεται αλλά **δεν το καλεί ακόμα
    κανείς** — καταναλωτής του είναι ο dialog της Φ3.1β. Επίσης εκτός: μνήμη κανόνων, ομάδα BOQ
    «Εισαγόμενα από συνεργάτη», badge ανανάθετων, και η **επαλήθευση οθόνης της Φ3β**.

- **2026-07-20 (Φ3β — η καλωδίωση: τα κάγκελα μπαίνουν πραγματικά)** — Ο τύπος της Φ3α
  **τροφοδοτείται**. Οι κόμβοι χωρίς αντιστοίχιση (κατάσταση **D** του §5) γίνονται οντότητες στη
  σκηνή, ανεβαίνουν σε project-scoped Storage, επιβιώνουν του reload.
  - **Η θέση δεν έλειπε — δεν εκθέτονταν.** Το `readWorldPositions` έδινε ήδη παγκόσμιες
    συντεταγμένες· το `rebaseToBoundingBox` πετούσε το bbox min για να μείνει το fingerprint
    **ανεξάρτητο μετατόπισης** (σωστό — το χρειάζεται ο reconciler A vs C). Λύση: νέο πεδίο
    `worldBoxM` στο `GltfObjectRecord`, **έξω** από το `GeometrySignature`, και καθαρή συνάρτηση
    `gltfNodeToPlacement` που είναι ο **αντίστροφος** του `mesh-to-object3d` (ADR-411). Το πλαίσιο
    ορόφου (`useImportedMeshPlacementContext`) καλεί **τις ίδιες** συναρτήσεις datum με τον exporter
    (`build-mesh3d-scene.ts:60-70`) ⇒ έξοδος και είσοδος συμφωνούν εξ ορισμού, όχι κατά σύμπτωση.
    Το round-trip test τρέχει τον **πραγματικό** converter, ώστε να πιάνει την απόκλιση των δύο
    πλευρών· mutation-verified (πρόσημο z → 3 κόκκινα, minY→centre → 4 κόκκινα).
  - 🔴 **Δύο κενά «δηλωμένο αλλά μη τροφοδοτούμενο» της Φ3α, που κανένα test δεν έβλεπε:**
    1. **`buildImportedMeshParams` διάβαζε `sizeM.x/.y/.z` ενώ το `Vec3M` είναι tuple `[x,y,z]`** →
       `undefined → NaN` → **κάθε πραγματικός κόμβος απορριπτόταν** ως εκφυλισμένος. Τα 28 tests
       ήταν πράσινα επειδή το fixture τους έγραφε `{x,y,z}` — **το test κωδικοποιούσε την ίδια
       παρανόηση με τον κώδικα**. Ο tsc θα το είχε πιάσει (το fixture είναι annotated
       `GeometrySignature`), αλλά το `src/subapps/dxf-viewer/**` **εξαιρείται από το root
       tsconfig**. Διορθώθηκαν κώδικας + fixtures.
    2. **Το `Bim3DEntitiesStore` είχε slice `importedMeshes` και το διάβαζε, χωρίς setter** — άρα
       το 3Δ δεν μπορούσε να τα δει ποτέ. Προστέθηκε `setImportedMeshes`.
  - **Η παγίδα του κουμπιού:** ένα `.glb` με **μόνο** νέα γεωμετρία έχει `appliedCount === 0` →
    έπεφτε στο early return «καμία αλλαγή» και ο χρήστης **δεν θα έβλεπε ποτέ** τα αντικείμενά του
    — ακριβώς η περίπτωση για την οποία φτιάχτηκε η φάση. Η προσφορά εισαγωγής προηγείται πλέον
    ρητά των μηνυμάτων βαφής.
  - **Δύο undo, όχι ένα** (απόφαση): το βάψιμο εκτελείται αμέσως· η εισαγωγή μεσολαβείται από
    απόφαση χρήστη στο dialog. Κοινό undo θα σήμαινε ότι το Ctrl+Z μετά την εισαγωγή ξεβάφει και
    στοιχεία που ο χρήστης δεν άγγιξε. Κάθε πράξη = ένα undo, στο επίπεδο που την αποφάσισε ο
    χρήστης. Η ίδια η εισαγωγή είναι **ΕΝΑ** βήμα (`appendEntitiesToScene` → `CompoundCommand`).
  - **Persistence δεν ήταν προαιρετική:** η Φ3α έβαλε το `imported-mesh` στο `isBimEntityType`, άρα
    το `isPerEntityPersistedEntity` το καλύπτει, άρα ο `reconcileLoadedSceneBim` **πετά** το
    αντίγραφο του scene blob στο load. Χωρίς per-entity doc, κάθε εισαγωγή θα εξαφανιζόταν στο
    πρώτο reload. Χτίστηκε mirror του furniture πάνω στο **υπάρχον** `createBimEntityPersistenceHook`
    (ADR-594): collection `floorplan_imported_meshes`, service, hydrate helper, hook, host, mount,
    rules + 4 indexes + coverage registry (τα δίχτυα πλήθους 22→23 authoring / 36→37 blocks έπιασαν
    σωστά τη νέα συλλογή), audit client (ADR-195) + tracked fields, και τα δύο lifecycle events.
  - 🔴 **Το σημείο που σπάει σιωπηλά μετά το reload:** ο hydrate **πρέπει** να καλεί
    `registerImportedMeshAsset` πριν επιστρέψει την οντότητα — το μητρώο του resolver είναι
    in-memory singleton και μετά από refresh είναι άδειο, οπότε ο resolver πέφτει στο path της
    **βιβλιοθήκης** που δεν υπάρχει: ο χρήστης βλέπει placeholder κουτί για πάντα, χωρίς κανένα
    σφάλμα. Η κλήση ζει σε **ένα** σημείο (`imported-mesh-assets.ts`), με test που καρφώνει και τη
    **σειρά** (δήλωση πριν την προσθήκη στη σκηνή).
  - **Τι ΔΕΝ έγινε:** Φ3.1 (ταυτότητα→προμέτρηση, §10.2) και Φ4 (reconcile UI) μένουν εκτός.

- **2026-07-20 (Φ3α — ο τύπος `imported-mesh` γεννιέται)** — Το κενό **Κ2** (§2.1) έκλεισε στο επίπεδο
  του μοντέλου: υπάρχει πλέον οντότητα για τη γεωμετρία που φτιάχνει ο συνεργάτης. **Πλήρης πολίτης**
  κατά §10.1 — 2Δ περίγραμμα στην κάτοψη, 3Δ, επιλογή, hit-test, μετακίνηση, περιστροφή, εξαγωγή.
  - **~80% ήταν ήδη εκεί.** Το ADR-411 είχε γενικεύσει το mesh pipeline ακριβώς γι' αυτό:
    `bimMeshCache` (glTF load + template cache), `mesh-silhouette` (2Δ περίγραμμα από πραγματικό
    πλέγμα), `meshToObject3D` (3Δ τοποθέτηση), `resolveMoveRotateHandleWorld` (λαβές) δουλεύουν
    **αμετάβλητα**. Ο νέος τύπος είναι καταναλωτής, όχι νέο σύστημα.
  - **Το μοναδικό αρχιτεκτονικό εμπόδιο** ήταν ο `resolveMeshUrl`: έχτιζε πάντα
    `bim-mesh-library/<category>/<assetId>.glb`, όπου τα `storage.rules` δίνουν **write μόνο σε
    super-admin** — ο χρήστης δεν μπορούσε να ανεβάσει. Λύση εντός του ίδιου SSoT αρχείου:
    μητρώο **προ-δηλωμένων** paths (`registerMeshAssetPath`) + `importedMeshStoragePath()` για
    project-scoped δέντρο `companies/{c}/projects/{p}/imported-meshes/{uploadId}.glb`, με **δικά του**
    rules (@pathId: `imported_meshes` — write από μέλη εταιρείας, όχι super-admin). Η υπόσχεση του
    αρχείου («αλλάζει hosting ⇒ αλλάζει ΜΟΝΟ αυτό») έμεινε αληθινή.
  - **Linked-model, όχι αντίγραφο ανά αντικείμενο** (απόφαση Giorgio): ένα `.glb` με 12 κάγκελα
    ανεβαίνει **μία** φορά· κάθε οντότητα κρατά `<uploadId>#<nodeName>`. Το `bimMeshCache` κατεβάζει
    το αρχείο μία φορά και ευρετηριάζει **όλους** τους κόμβους → οι υπόλοιποι 11 είναι δωρεάν cache
    hits. ⚠️ **Παγίδα που πιάστηκε:** το `status` guard κλειδώνει ανά *κόμβο*, οπότε 12 ταυτόχρονες
    `preload` ξεκινούσαν **12 λήψεις του ίδιου αρχείου** (λειτουργικά σωστό, ορατό μόνο στο network
    tab). Προστέθηκε de-dup στο επίπεδο **αρχείου** (`inFlightScenes`) + test που το καρφώνει.
  - **N.18 — clone αποτράπηκε με εξαγωγή, όχι με αντιγραφή:** το `computeFurnitureGeometry` είχε
    ιδιωτικό τον μετασχηματισμό «κεντραρισμένο ορθογώνιο + στροφή». Αντί να αντιγραφεί, εξήχθη στο
    `bim/geometry/shared/centred-box-footprint.ts` και **το furniture μετακινήθηκε εκεί** (25 tests
    του πράσινα ⇒ behavior-preserving). `jscpd:diff` καθαρό σε 8 νέα αρχεία.
  - **Το όριο του §3 είναι πλέον εκτελέσιμο, όχι σχόλιο:** οι λαβές είναι **δύο** (move + rotation)·
    το `UpdateImportedMeshParamsCommand.validate()` **απορρίπτει** κάθε αλλαγή μετρημένης διάστασης·
    και υπάρχει test («ΚΑΜΙΑ λαβή σχήματος») που σπάει αν κάποιος προσθέσει resize «για ευκολία».
    IFC: `IfcBuildingElementProxy` — ποτέ `IfcRailing`, όσο κι αν ο κόμβος λέγεται `Rail_01` (§10.4).
  - **CHECK 5C ενεργοποιήθηκε by design:** 20 capability anchors ρώτησαν «μετακινείται; περιστρέφεται;
    εξάγεται; έχει λαβές/ghost;» και **απαντήθηκαν ρητά** — 329/329 anchor tests πράσινα (21 suites).
    Οι απαντήσεις είναι του §10.1, δεν εφευρέθηκαν. Export: `dxf: 'decompose'`, `tek: 'missing'`
    (το TEK θέλει παραμετρικό στοιχείο· το 3Δ OBJ/glTF export δουλεύει κανονικά) — export-gap 29→30.
  - **Μετρημένες, όχι authored διαστάσεις:** το `furniture` ρωτά τον κατάλογο· εδώ δεν υπάρχει
    κατάλογος. Οι διαστάσεις προκύπτουν **μία φορά** από το `GeometrySignature.sizeM` της Φ2 (μηδέν
    νέα γεωμετρική εργασία) και **αποθηκεύονται**, ώστε το ίχνος —άρα hit-test και επιλογή— να
    υπάρχει **πριν** κατέβει το `.glb`. Άξονες: glTF Y-up → `width←x, depth←z, height←y`.
  - **Tests:** 28 νέα (geometry/grips/builder) + 5 για το bundle cache· **18.840 πράσινα** σε πλήρη
    σάρωση των 9 επηρεαζόμενων περιοχών του subapp.
  - **ΕΚΤΟΣ Φ3α (σκόπιμα, βλ. Φ3β):** το upload του `.glb` σε Storage, η καλωδίωση των unmatched του
    import flow, το UI επιλογής και το persistence. Ο τύπος **υπάρχει και ζει**· η αυτόματη
    **τροφοδότησή** του από την εισαγωγή είναι το επόμενο βήμα. Ως τότε τα unmatched εξακολουθούν
    να αναφέρονται μόνο στο toast.

- **2026-07-20 (Φ2-UI — καλωδίωση glTF import στο UI)** — Ο parser της Φ2 **δεν καλούνταν από
  πουθενά**· τώρα καλείται. **53 jest tests πράσινα** στο `io/mesh3d-*` πεδίο (73 μαζί με ADR-678),
  14 στον export adapter, μηδέν jscpd clone.
  - **SSoT audit πρώτα (βήμα-πύλη):** το `charset` του matching, ο resolver εμφάνισης, το σοβά-routing
    και το atomic undo **υπήρχαν ήδη** από ADR-678 — μηδέν ξαναγράψιμο. Το `import-c4d-materials.ts`
    είχε ήδη σχόλιο *«Default 'latin' (OBJ). glTF import θα έδινε 'unicode'»*: ήταν σχεδιασμένο γι' αυτό.
  - **`applyImportedAppearance`** (§8.1) — ο πυρήνας βγήκε από τον OBJ orchestrator· δύο λεπτοί
    wrappers από πάνω (`importC4dMaterials` = OBJ, `importGltfAppearance` = glTF). Το `charset`
    έγινε **υποχρεωτικό** στον πυρήνα. `C4dMaterialImportResult` → alias του format-agnostic
    `ImportedAppearanceResult` (μηδέν breaking change στους καταναλωτές).
  - **`collectGltfMaterials`** (νέο, `gltf-scene-parse.ts`) — **το μοναδικό πραγματικό κενό**: το
    glTF δεν έχει sidecar `.mtl`, τα χρώματα ζουν στα υλικά των mesh. Χωρίς αυτό το import θα
    ανέφερε επιτυχία **χάνοντας σιωπηλά κάθε χρώμα** (βλ. §8.1). `parseGltfObjects` →
    **`parseGltfScene`** (επιστρέφει objects **και** υλικά σε μία διέλευση).
  - **UI:** `accept=".glb,.gltf,.obj,.mtl"`, ανάγνωση `arrayBuffer()` για `.glb` / `text()` για
    `.gltf`/`.obj`, glTF προηγείται όταν επιλεγούν και τα δύο. **ΕΝΑ κουμπί για όλα τα formats**
    (πρακτική Revit «Link/Import» = ένα dialog με format dropdown· ίδιο ArchiCAD/C4D) — ο
    διαχωρισμός γίνεται από την κατάληξη, όχι από τον χρήστη. i18n: `noObj` → `noSource`, νέο
    `parseError` (κατεστραμμένο glTF ή `.gltf` με εξωτερικά `.bin`), label → «από 3Δ αρχείο».
  - **Εκτός Φ2-UI (σκόπιμα):** το `.nestor.json` δεν καταναλώνεται ακόμη στο import — η αξιοποίηση
    του fingerprint (καταστάσεις C/E + διάλογος) είναι **Φ4**. Τα `imported-mesh` entities είναι **Φ3**·
    μέχρι τότε τα unmatched (π.χ. `Rail_01`) εξακολουθούν μόνο να **αναφέρονται** στο toast.

- **2026-07-20 (Φ2 — glTF import + geometry fingerprint + manifest)** — Υλοποιήθηκε ο πυρήνας της
  Φ2, τρία νέα modules στο `io/mesh3d-roundtrip/` + καλωδίωση στον export adapter, **41 jest tests
  πράσινα** (96 στο ευρύτερο mesh3d πεδίο), μηδέν jscpd clone.
  - **`geometry-hash.ts`** — ΕΝΑ SSoT fingerprint, export + import. **Κύριο εύρημα:** η αρχική
    διατύπωση του §5 («σκέτο quantised hash κορυφών») είναι **μετρήσιμα εύθραυστη** — float32
    θόρυβος ~12 μm σε συντεταγμένη 100 m vs κάδος 100 μm ⇒ ~12% πιθανότητα boundary flip **ανά
    συντεταγμένη** ⇒ κάθε αμετάβλητο στοιχείο θα γύριζε «άλλαξε». Αντικαταστάθηκε από **δύο
    επίπεδα**: ακριβές `hash` (μηδέν false negatives) + `signature` με ανοχή (μηδέν false
    positives από θόρυβο/retessellation). Το §5 ξαναγράφτηκε με το σκεπτικό.
  - **`gltf-scene-parse.ts`** — κλείνει το **κενό Κ1**. `collectGltfObjects` (pure, testable χωρίς
    loader) + `parseGltfObjects` (GLTFLoader — ήδη production dependency από το `bim-mesh-cache`).
    Παράγει **ακριβώς** το `ObjectMaterialAssignment` του ADR-678 ⇒ ο υπάρχων pipeline
    αντιστοίχισης/βαφής τρέχει αυτούσιος (μηδέν διπλότυπο μονοπάτι ανά format).
  - **`export-manifest.ts`** — sidecar `.nestor.json` (§7), build/serialise/parse/index,
    fail-closed σε άγνωστο schema. Αποκλίσεις από την πρόταση τεκμηριωμένες στο §7
    (`projectName` αντί `projectId`· νέο `geometry`· `params` **αναβάλλεται στη Φ4** — η headless
    σκηνή εξαγωγής κουβαλά ταυτότητα, όχι παραμετρικό DNA).
  - **Καλωδίωση:** `mesh3d-export-adapter.ts` — ΕΝΑ σημείο κλήσης για OBJ+GLB, μετά την
    ονοματοδοσία και πριν το `applyExportUnit`. **Συνέπεια:** το glTF export κατεβαίνει πλέον ως
    `.zip` (`.glb` + `.nestor.json`), όπως ήδη το OBJ με το `.mtl`.
  - **Εκτός Φ2 (σκόπιμα):** ο ίδιος ο reconciler (§5 → `reconcile-scene.ts`) και το UI εισαγωγής
    glTF είναι **Φ4**· τα `imported-mesh` entities (Κ2) είναι **Φ3**. Η Φ2 παρέχει τα *δεδομένα*
    που τους λείπουν, δεν τα καταναλώνει ακόμη.

- **2026-07-20** — Δημιουργία ADR (PROPOSED). Αφορμή: αίτημα Giorgio για πλήρες συνεργατικό
  round-trip με εξωτερικό μηχανικό. Ground-truth έλεγχος 3 πραγματικών C4D R15 exports (FBX 7.3 ASCII,
  DAE 1.4, DAE 1.5) + του υπάρχοντος import pipeline. Κύρια ευρήματα: (α) το θεμέλιο ταυτότητας
  υπάρχει ήδη (ADR-678), (β) **λείπει glTF import** παρότι εξάγουμε glTF (Κ1), (γ) **λείπει έννοια
  εισαγόμενης γεωμετρίας** → τα νέα αντικείμενα του εξωτερικού χάνονται (Κ2), (δ) το **FBX
  καταστρέφει τα UUID** (`-`→`_`) → απορρίπτεται ως εξαγωγή, (ε) ο **DAE δεν είναι το κρίσιμο
  μονοπάτι** — το `three@0.170` δεν έχει `ColladaExporter`, το OBJ κρατά ήδη τα UUID, και το DAE δεν
  προσθέτει PBR. Απόφαση: μοντέλο ιδιοκτησίας 3 ζωνών + reconcile 5 καταστάσεων + sidecar manifest.
  **Αναθεώρηση ίδιας ημέρας:** εντοπίστηκε το **ADR-679** (PBR full parity, Φ2a DONE) — η αρχική Φ5
  «PBR κανάλια» θα ήταν **διπλότυπο συστήματος υλικών**. Υποβιβάστηκε σε καλωδίωση· ορίστηκε ρητό
  όριο ιδιοκτησίας (679 = *τι είναι* το υλικό· 683 = *πώς ταξιδεύει*)· το ανοιχτό ερώτημα #3 έκλεισε.
- **2026-07-20 (αποφάσεις §10)** — Ο Giorgio απάντησε στα 2 εναπομείναντα ερωτήματα: (1) τα εισαγόμενα
  **σχεδιάζονται και στην κάτοψη** ως πλήρεις πολίτες (move/rotate/export ναι· λαβές σχήματος όχι —
  είναι ψημένο πλέγμα) → ενεργοποιείται CHECK 5C· (2) **μετριούνται στην προμέτρηση** με ανάθεση
  ταυτότητας μία φορά (ο υπολογισμός πάντα αυτόματος), με υποχρεωτικό μετριασμό τριβής: πρόταση από
  όνομα, πρόταση από υλικό, μνήμη κανόνων. Τεκμηριώθηκε ρητά **γιατί** το κόστος δεν μαντεύεται από
  γεωμετρία (ίδιο πλέγμα = 288/448/832 € ανά υλικό· η μονάδα μέτρησης είναι σημασιολογική) ώστε να
  μην ξαναρωτηθεί. Νέα υπο-φάση Φ3.1.
