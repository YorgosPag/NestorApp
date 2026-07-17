# ADR-669 — BIM mesh identity stamping: ένας writer (`stampBimIdentity`)

**Status:** Φάση Α **ΥΛΟΠΟΙΗΜΕΝΗ** (uncommitted) · Φάση Β (seam) **ΑΠΟΡΡΙΦΘΗΚΕ ΜΕ ΑΠΟΔΕΙΞΕΙΣ** (§5) · Φάση Β′ **ΥΛΟΠΟΙΗΜΕΝΗ** 2026-07-18 (§9) — **0 ωμές εγγραφές· το gate είναι ΕΝΕΡΓΟ** (§6)
**Ημερομηνία:** 2026-07-18
**Σχετικά:** ADR-668 (`resolveBimMeshIdentity` — ο reader), ADR-382 (visibility SSoT),
ADR-358 Q19 (stair sub-element picking), CLAUDE.md N.0.2 / N.12 / N.18

---

## 1. Το ερώτημα

> «Ο διασκορπισμός των converters που κάνουν `userData` identity stamping είναι σωστός;
> Έτσι θα το έκαναν οι μεγάλοι παίχτες;» — Giorgio, 2026-07-18

## 2. Το εύρημα (μετρημένο, όχι εικασία)

**Υπήρχε ΗΔΗ SSoT** — `tagMesh()` στο `bim-three-shape-helpers.ts`, με **11 αρχεία** να το
καλούν σωστά (walls, columns, beams, slabs, MEP, foundation, floor-finish, point-converters).
Δίπλα του ζούσαν **4 ιδιωτικοί helpers** που **δεν** το καλούσαν:

| Helper | Σχέση | Ετυμηγορία |
|---|---|---|
| `roof-to-three.ts::tagRoofMesh` | byte-identical, `type` hardcoded `'roof'` | **καθαρός κλώνος** |
| `StairToThreeConverter.ts::tagMesh` | **ίδιο όνομα** με το SSoT· superset (+`stairComponent*`)· **χωρίς `matId`** | κλώνος + shadowing trap |
| `mesh-to-object3d.ts::tagObject` | `Object3D` + `traverse` σε απογόνους | **νόμιμο variant**, αλλά με αντιγραμμένο σώμα |
| `railing-to-three.ts::tagComponent` | `Object3D` + `railingComponent` | **νόμιμο variant**, αλλά με αντιγραμμένο σώμα |

Δηλαδή **δύο** ήταν πραγματικοί κλώνοι και **δύο** νόμιμα variants — αλλά **και τα τέσσερα**
αντέγραφαν τα ίδια ονόματα κλειδιών (`bimId`/`bimType`/`matId`/`levelId`).

### Γιατί κανένα gate δεν τους είδε
- **CHECK 3.18** (`ssot:discover`): name/regex-based → `tagRoofMesh` ≠ `tagMesh` → τυφλό.
  Επιπλέον σαρώνει μόνο `src/config|utils|lib` σε `-maxdepth 1` → **δεν ανοίγει ποτέ** το `src/subapps`.
- **CHECK 3.28** (jscpd): θα τα έπιανε token-based, αλλά είναι `--diff` (same-commit) και οι
  κλώνοι είναι **προϋπάρχοντες** → μέσα στο baseline.

Ίδιο σχήμα με το incident του N.0.2 (`renderGrips()` copy-paste σε 7 renderers).

## 3. Τι κάνουν οι μεγάλοι

Σε **Revit/ArchiCAD** η ταυτότητα είναι **δομική, όχι επίθετο**: η γεωμετρία **ανήκει** σε
Element (`ElementId`)· δεν τη «σφραγίζει» κάθε geometry producer χωριστά.

⚠️ **ΑΡΧΙΚΑ ΣΥΜΠΕΡΑΝΑΜΕ ΛΑΘΟΣ** από αυτό ότι «το ισοδύναμο εδώ είναι ένα finalize seam».
**Δεν είναι** — και το §5 το αποδεικνύει. Το Revit μοντέλο μιλά για το *element*: το άνοιγμα
**είναι** δικό του element φιλοξενούμενο στον τοίχο, άρα «μία ταυτότητα ανά υποδέντρο» είναι
**λάθος ανάγνωση** του Revit. Και ο three.js γράφος μας δεν είναι δέντρο από elements: αναμειγνύει
**σώματα** με **decorations** (edge overlays, οπλισμό) που δεν έχουν και δεν πρέπει να έχουν
ταυτότητα. Το analogue του `ElementId` εδώ είναι **ένας writer** (§4), όχι ένα write-site.

Η **αναρρίχηση προγόνων** του `resolveBimMeshIdentity()` (ADR-668) φαινόταν «απόδειξη
ασυνέπειας». **Δεν είναι**: είναι ο σωστός τρόπος ανάγνωσης μιας **εμφωλευμένης ιεραρχίας
elements** (άνοιγμα μέσα σε τοίχο). Το πραγματικό της bug είναι άλλο — §5.6.

## 4. Απόφαση — Φάση Α (υλοποιημένη)

**Ένας writer.** Νέο primitive στο υπάρχον SSoT (`bim-three-shape-helpers.ts`):

```ts
export interface BimMeshIdentity {
  readonly bimId: string; readonly bimType: string;
  readonly matId?: string; readonly levelId?: string;
}
export function stampBimIdentity(obj: THREE.Object3D, identity: BimMeshIdentity): void
```

- Δέχεται **`Object3D`** (όχι `Mesh`) → το μοιράζονται και τα group/component variants.
- Τα προαιρετικά πεδία **παραλείπονται όταν είναι `undefined`** (ποτέ δεν γράφονται ως
  `undefined`) → **κάθε caller κρατά ακριβώς το σημερινό key set του**.
- `tagMesh()` = `stampBimIdentity` + shadows. **Δημόσια υπογραφή αμετάβλητη** → τα 11 σωστά
  call sites δεν αγγίχτηκαν.

**Οι 4 delegate πλέον:**

| Αρχείο | Αλλαγή |
|---|---|
| `roof-to-three.ts` | `tagRoofMesh` → thin arity adapter πάνω στο `tagMesh`. Μηδέν δικό του stamping. |
| `StairToThreeConverter.ts` | `tagMesh` → **μετονομάστηκε `tagStairMesh`** (τέλος το shadowing)· καλεί `stampBimIdentity` + προσθέτει `stairComponent*`. |
| `mesh-to-object3d.ts` | `tagObject` → `stampBimIdentity` σε root + απογόνους. |
| `railing-to-three.ts` | `tagComponent` → `stampBimIdentity` + `railingComponent`. |

### 4.1 Γιατί η σκάλα ΔΕΝ περνά `matId` (κρίσιμο — μην το «διορθώσεις»)

Το `StairToThreeConverter` **ποτέ δεν όριζε** `matId` (το `resolveStairMaterial` το λύνει
per component/tread). Το `section-cut-cap-groups.ts:62` **διαβάζει** `userData['matId']` και το
δίνει στο `resolveHatchKey(matId: string | undefined)`. Αν περνούσαμε `''` για να ταιριάξει η
υπογραφή του `tagMesh`, **θα άλλαζαν οι τομές**. Γι' αυτό το `matId` είναι **optional** στο
primitive και η σκάλα το αφήνει **απόν** — όχι κενό. Αυτός είναι και ο λόγος που η σκάλα
καλεί το `stampBimIdentity` και **όχι** το `tagMesh`.

**Σκοπίμως ΜΗΔΕΝ αλλαγή συμπεριφοράς.** Καθαρή δομική ενοποίηση.

## 5. Φάση Β (`finalizeEntityMesh` seam) — **ΑΠΟΡΡΙΦΘΗΚΕ ΜΕ ΑΠΟΔΕΙΞΕΙΣ**

Η αρχική πρόταση («οι converters δεν σφραγίζουν καθόλου· ένα seam στον `BimSceneLayer`
δίνει ταυτότητα») **ελέγχθηκε από ορχηστρωτή 5 πρακτόρων (2026-07-18) και ΔΕΝ αντέχει.**

**Μετρημένο μέγεθος:** 35 γραμμές / 22 αρχεία (εκτός tests) γράφουν `userData['bimId']`
εκτός SSoT· **25/35 σφραγίζουν groups/composites**, όχι mesh.

### 5.1 Γιατί το «τυφλό traverse seam» σπάει

- **Nested distinct entities**: το `attachOpeningMeshes` (`bim-three-wall-opening-attach.ts:58`)
  βάζει το opening group (`opening-mesh.ts:112`, `bimId=opening.id`) **ΜΕΣΑ** στο wall group
  (`BimToThreeConverter.ts:272`, `bimId=wall.id`). Ο `BimEntityRaycaster.ts:94-101` σταματά
  στον **πρώτο** πρόγονο με ταυτότητα → τυφλό σφράγισμα = **η πόρτα επιλέγεται ως τοίχος**.
  (Ο κίνδυνος είναι **τοποθεσιακός**: seam στη γρ.272 = ακίνδυνο, στη γρ.418 = ζημιά.)

### 5.2 Γιατί και το «root-only seam» σπάει

**11+ καταναλωτές ΔΕΝ ανεβαίνουν προγόνους** — απαιτούν το κλειδί **πάνω στο Mesh**:
`section-cut-cap-groups.ts:40,60` (φιλτράρει `instanceof Mesh` + `bimId===undefined → return`
→ **σιωπηλή** απώλεια γεμισμάτων τομής), `StairSubElementHighlighter.ts:50,108`,
`FaceSelectionHighlighter.ts:127`, `scene-framing-bounds.ts:22`.
Επιπλέον η αναρρίχηση είναι ασφαλής **μόνο** για `bimId`/`bimType`: ο raycaster
(`BimEntityRaycaster.ts:120,135`) διαβάζει `stairComponent` από τον κόμβο **όπου σταμάτησε**
→ root-only = **τέλος το per-tread picking**.

### 5.3 Γιατί ΚΑΙ το «inherit-unless-own» (η διορθωμένη πρότασή μας) ΔΕΝ αρκεί

Το κατηγόρημα «προσπέρασε υποδέντρο με δικό του `bimId`» **δεν πιάνει τα decorations**:

- **`LineSegments2 extends Mesh`** (επαληθεύτηκε στο `node_modules/three/examples/jsm/lines/LineSegments2.js:227`).
  Τα edge overlays (`bim-3d-edge-overlay-builder.ts:218` → `mesh.add(overlay)`) δεν έχουν δικό
  τους `bimId` → **θα κληρονομούσαν** → περνούν το `instanceof Mesh` → **οι ακμές γίνονται
  γεμίσματα τομής** + τους αλλάζει υλικό ο `BimSelectionHighlighter`.
- **`InstancedMesh extends Mesh`**: ο οπλισμός (`column-rebar-3d.ts:224`, `beam-rebar-3d.ts:67`)
  σφραγίζεται **μόνο στο group** → οι ράβδοι θα κληρονομούσαν → **ο οπλισμός γίνεται γέμισμα τομής**.

Δηλαδή το seam θα χρειαζόταν **allow-list γεωμετρίας** (σώμα vs decoration) — γνώση που
**έχει ο converter και ΔΕΝ έχει το seam**. Ένα gate με τέτοιο κατηγόρημα είναι εύθραυστο.

### 5.4 Διορθωμένο εύρημα (λάθος της αρχικής μας ανάλυσης)

Το `slab-opening-pick-mesh` **ΔΕΝ** είναι nested: ο `BimSceneLayer.ts:325` και `:331`
κάνουν **και τα δύο** `this.group.add(...)` → είναι **αδέλφια** κάτω από το scene group.
Καμία σύγκρουση ταυτότητας. (Η αρχική υπόθεση ήταν λάθος — διορθώθηκε από τον ορχηστρωτή.)

### 5.5 ΑΠΟΦΑΣΗ

**Το seam ΔΕΝ γίνεται.** Η ανά-κόμβο απόφαση «ποιος παίρνει ταυτότητα» είναι **πραγματική
πληροφορία του converter**, όχι ασυνέπεια. Το Revit μοντέλο («ταυτότητα = δομική») ισχύει
για το *element*, όχι για κάθε κόμβο ενός three.js scene graph που αναμειγνύει σώματα με
decorations. → **Φάση Β′ (§9).**

## 5.6 ΠΑΡΑΠΛΕΥΡΟ ΕΥΡΗΜΑ — ΥΠΑΡΚΤΟ BUG ΣΤΟ ADR-668 (ΔΕΝ ΑΓΓΙΧΤΗΚΕ)

Το `mesh3d-identity.ts:30-38` (`resolveBimMeshIdentity`) τρέχει `readUp` **ανά κλειδί,
ανεξάρτητα**. Το opening group έχει `bimId`/`bimType`/`levelId` αλλά **ΟΧΙ `matId`· ο τοίχος
έχει** (`BimToThreeConverter.ts:414`). → Ένα φύλλο πόρτας εξάγεται με `bimId=opening.id` και
**`matId` = το σκυρόδεμα του ΤΟΙΧΟΥ** → **λάθος υλικό στο OBJ/glTF σήμερα**.
Η ταυτότητα δεν είναι ατομική μονάδα στο export. **Αναφέρθηκε στον Giorgio· δεν αγγίχτηκε**
(ADR-668 = κλειδωμένο, εκκρεμεί commit+e2e).

**✅ ΕΚΛΕΙΣΕ (2026-07-18) — δικό του scoped change στο ADR-668.** Fix στο `mesh3d-identity.ts`:
νέα `readWithinElement(mesh, 'matId', ownerBimId)` — η αναρρίχηση του `matId` σταματά σε κόμβο με
**ΔΙΑΦΟΡΕΤΙΚΟ** `bimId`. ⚠️ Επαληθεύτηκε στον κώδικα ότι η κατά γράμμα διατύπωση «σταμάτα στον
κοντινότερο κόμβο με `bimId`» **θα έσπαγε τον τοίχο**: τα wall body meshes φέρουν κι αυτά
`bimId=wall.id` (γρ. 195) ενώ το `matId` κάθεται στο wall group **από πάνω** τους (γρ. 412) — άρα το
σύνορο ορίζεται από **αλλαγή** `bimId`, όχι από την παρουσία του. `bimType`/`bimId`/`levelId`
αμετάβλητα. Ένας reader/ένας writer διατηρήθηκαν.

Επιπλέον (απόφαση Giorgio §2.4, «όπως οι μεγάλοι»): τα ανοίγματα πλέον σφραγίζονται με **δικό τους
πραγματικό `matId`** (`mat-wood`/`mat-glass` — τα catalog ids που ήδη χτίζουν τα υλικά τους), όχι
color-hash fallback — Revit/ArchiCAD δίνουν named part-surfaces ανά πόρτα. Raw augmentation στο ίδιο
σημείο με το raw `levelId` (§6.1). Λεπτομέρειες + changelog: **ADR-668 §10**.

## 6. Registry module — ΚΑΤΑΧΩΡΗΘΗΚΕ στο τέλος της Φάσης Β′ (μετρημένη ακολουθία)

Στη **Φάση Α** το module **ΣΚΟΠΙΜΩΣ ΔΕΝ** καταχωρήθηκε. **ΜΕΤΡΗΣΑ ΠΡΩΤΑ** (όπως ζητήθηκε):

> **35 παραβάσεις / 22 αρχεία** θα άναβαν **αμέσως**.

Το **CHECK 3.7 είναι fail-closed**: νέο module στο JSON → επιβάλλεται στο **επόμενο** commit →
**θα μπλόκαρε το commit του Giorgio**. Ένα allowlist με 22 αρχεία = gate χωρίς σήμα.
Άρα το module ανήκε στο **ΤΕΛΟΣ** της Φάσης Β′ — και εκεί μπήκε.

**2026-07-18 (Φάση Β′):** με τις ωμές εγγραφές στο **0**, το module `bim-mesh-identity-stamp`
(tier 3) καταχωρήθηκε με allowlist **ΕΝΑ αρχείο** (`bim-three-shape-helpers.ts`).
Το CHECK 3.7 είναι πλέον **σύμμαχος** αντί για φραγμό.

### 6.1 Εύρος του gate — γιατί ΜΟΝΟ το `bimId` (μετρημένο, όχι παράλειψη)

Απαγορεύεται μόνο το `bimId` — η **άγκυρα** της ταυτότητας. Τα ωμά `bimType`/`matId`/`levelId`
**ΔΕΝ** απαγορεύονται, γιατί υπάρχουν **νόμιμοι** κόμβοι που τα φέρουν μόνα τους:

| Site | Τι γράφει | Γιατί είναι νόμιμο |
|---|---|---|
| `EnvelopeToThree.ts:309,410` · `envelope-three-mesh.ts:55` | `bimType='envelope'` **χωρίς** `bimId` | το envelope δεν είναι BIM element — δεν έχει ταυτότητα |
| `joint-rebar-3d.ts:325` | `bimType='joint-reinforcement'` **χωρίς** `bimId` | decoration κόμβου, όχι element |
| `BimToThreeConverter.ts:412,427` | `matId`/`levelId` σε **ήδη σφραγισμένο** wall group | post-hoc augmentation· η ταυτότητα μπήκε στη γρ. 272 |
| `bim-three-wall-opening-attach.ts:51` | `levelId` στο opening mesh | το mesh έχει ήδη `bimId`/`bimType` από `opening-mesh.ts:112` |

Αν τα απαγόρευε το gate, **θα άναβε από την πρώτη μέρα** → gate χωρίς σήμα. Η δρομολόγηση
των augmentation sites θα απαιτούσε να **ξαναδηλώσουν** `bimId`/`bimType` σε σημείο που
**δεν κατέχει** αυτή την απόφαση — ακριβώς η αστοχία «το seam ξέρει πράγματα που δεν του
ανήκουν» του §5.3. Τα αφήνουμε.

### 6.2 ⚠️ Το regex — η ίδια παγίδα που μόλυνε τη μέτρηση

Τα `forbiddenPatterns` τελειώνουν σε **`[^=]`**:
```
userData\[['"]bimId['"]\] *= *[^=]
userData\.bimId *= *[^=]
```
Χωρίς το `[^=]`, το `= ` ταιριάζει στο **πρώτο `=` του `===`** → το gate θα χτυπούσε τους
**αναγνώστες** (`scene-framing-bounds.ts`, `FaceSelectionHighlighter.ts`,
`StairSubElementHighlighter.ts`). Το ίδιο λάθος φούσκωσε τη μέτρηση 35 → 39.
**ΟΧΙ `(?:...)`/lookahead** — το golden test (`npm run test:registry-golden`) τα τρέχει με
πραγματικό `grep -E -f` και θα κοκκινίσει.
Τα test files **δεν** σαρώνονται (`exemptPatterns` → `__tests__/`, `.test.`), άρα τα ωμά
`userData['bimId']` των tests δεν μπλοκάρουν.

## 7. Gates (Φάση Α)

| Gate | Αποτέλεσμα |
|---|---|
| jest — converters + selection + raycaster + section + scene | **94 suites / 693 tests ✅** |
| `npm run jscpd:diff` (N.18, 5 αρχεία) | **καθαρό ✅** |
| `roof-to-three.ts` μέγεθος (N.7.1, ήταν 496/500) | **493 ✅** |
| tsc | **δεν τρέχει** (N.17 — Giorgio/CI) |

## 9. ΦΑΣΗ Β′ — Η ΠΡΟΤΑΣΗ ΠΟΥ ΑΝΤΙΚΑΤΕΣΤΗΣΕ ΤΟ SEAM (**ΥΛΟΠΟΙΗΜΕΝΗ** 2026-07-18)

**Στόχος του Giorgio ήταν ένα gate** («να μην ξανασυμβεί»), όχι το seam καθαυτό.
Το gate είναι εφικτό **χωρίς** seam:

> Οι 35 ωμές γραμμές `userData['bimId'] = …` δρομολογούνται μέσα από το
> `stampBimIdentity()` — **ίδιος κόμβος, ίδια κλειδιά, ίδια συμπεριφορά**, απλώς ένας writer.

- Η ανά-κόμβο απόφαση **μένει στον converter** (εκεί ζει η γνώση σώμα-vs-decoration).
- Μετά → **0** ωμές εγγραφές → το registry module `bim-mesh-identity-stamp` γίνεται
  **επιβλητό** με allowlist **ένα αρχείο** (`bim-three-shape-helpers.ts`) → το CHECK 3.7
  fail-closed γίνεται **σύμμαχος** αντί για φραγμό.
- Μηδέν αλλαγή συμπεριφοράς· μηχανικό· ελέγξιμο ανά αρχείο με jest.

Αυτό δίνει **πραγματικό full SSoT** (ένας writer + ενεργό gate) χωρίς κανένα από τα
ναρκοπέδια του §5.

### 9.1 Τι έγινε (2026-07-18)

**35 ωμές εγγραφές / 22 αρχεία → 0.** Επαληθευμένο με το σωστό regex σε **ολόκληρο το `src/`**:
η μόνη εναπομείνασα γραμμή `userData['bimId'] =` είναι ο ίδιος ο writer
(`bim-three-shape-helpers.ts:141`). Τα μη-ταυτοτικά κλειδιά (`structuralFinish`,
`finishClassification`, `reinforcement`, `layerId`, `segmentIndex`, `stairComponent*`) έμειναν
**ως έχουν** δίπλα στην κλήση.

**Ασφάλεια του key set** (γιατί δεν άλλαξε συμπεριφορά): κάθε `matId` που δρομολογήθηκε είναι
τύπου **`string`** (μη-optional) — ελέγχθηκε σε `structural-finish-3d.ts` (`materialId: string`)
και `HorizontalFinishFace.materialId: string`. Αν ήταν `string | undefined`, το σημερινό
`userData['matId'] = undefined` **ορίζει** το κλειδί ενώ το primitive το **παραλείπει** → θα
άλλαζε το `Object.keys()`. Δεν συνέβη πουθενά.

### 9.2 🚨 Η ΜΙΑ αλλαγή συμπεριφοράς — `bim3d-preview-rebuild.ts:452` (απόφαση Giorgio)

Ο wrapper του live-preview σκάλας έγραφε **μόνο** `bimId`, **χωρίς** `bimType` — το μόνο από
τα 35 που **δεν** δρομολογούνταν με μηδέν αλλαγή (το `stampBimIdentity` απαιτεί `bimType`).

**Απόφαση (Giorgio 2026-07-18: «όπως οι μεγάλοι»):** ο wrapper σφραγίζεται με **πλήρη**
ταυτότητα → `stampBimIdentity(group, { bimId: stair.id, bimType: 'stair' })`.

**Γιατί είναι ασφαλές (μετρημένο, όχι εικασία):**
- Τα **παιδιά** του wrapper έχουν ήδη `bimType='stair'` (`tagStairMesh`,
  `StairToThreeConverter.ts:101`) → κάθε reader που ανεβαίνει προγόνους βρίσκει `'stair'`
  **έτσι κι αλλιώς**.
- Το `section-cut-cap-groups` φιλτράρει `instanceof Mesh` → ο **Group** εξαιρείται.
- Είναι **transient** αντικείμενο ενός drag· ο `applyResize` δεν διαβάζει καθόλου το
  `userData` του (`bim3d-edit-live-preview.ts:351-360` — απλό `parent.add`).
- **235 suites / 2071 tests** πράσινα μετά την αλλαγή.

**Γιατί είναι ΣΩΣΤΟ (όχι απλώς ακίνδυνο):** `bimId` χωρίς `bimType` είναι **ελλιπής**
ταυτότητα. Στη Revit ένα `ElementId` έχει **πάντα** κατηγορία — ένας κόμβος που απαντά «ποιο
element» οφείλει να απαντά και «ποια κατηγορία». Το `matId` μένει **απόν** (§4.1).

## 10. `attachElementComponent` — το δεύτερο διπλότυπο (Boy Scout, N.0.2)

Βρέθηκε **κατά τη διάρκεια** της Φάσης Β′ και κεντρικοποιήθηκε επιτόπου (εντολή Giorgio
2026-07-18). **Ο ίδιος ο κώδικας ομολογούσε το διπλότυπο στα σχόλιά του:**

> `attachSlabRebar`: «**Mirror του `attachBeamRebar`**» · `attachBeamRebar`: «**Mirror του
> `attachColumnRebar`**» · `attachSoffitFinish`: «**Mirror του `attachSlabRebar`**»

**4 σημεία / 3 αρχεία** (όχι 3 — το `attachSoffitFinish` κάνει ακριβώς το ίδιο):

| Αρχείο | Συνάρτηση |
|---|---|
| `bim-three-beam-rebar-attach.ts` | `attachBeamRebar` |
| `bim-three-structural-converters.ts` | `attachColumnRebar` |
| `bim-three-slab-converter.ts` | `attachSlabRebar` **+** `attachSoffitFinish` |

**Τι είναι το κοινό — και τι ΔΕΝ είναι.** Κοινό **δεν** είναι το χτίσιμο του component (κάθε
ένα καλεί άλλον builder με άλλα ορίσματα· ο δοκός έχει και top-clip). Κοινό είναι το
**Mesh↔Group composition**:

```ts
export function attachElementComponent(
  composed: THREE.Mesh | THREE.Group,
  component: THREE.Object3D,
  identity: BimMeshIdentity,
): THREE.Mesh | THREE.Group
```

Ένα composed result είναι σκέτο `Mesh` όσο το element έχει ένα σώμα, και `Group` μόλις
αποκτήσει component. Άρα: **ήδη Group → σκέτο add· σκέτο Mesh → wrap σε Group που φέρει την
ταυτότητα** — γιατί ο wrapper γίνεται ο κόμβος που επιλέγεται/framάρεται, και wrapper χωρίς
ταυτότητα **βγάζει το element εκτός selection/section**.

**Ο caller κρατά ό,τι είναι δικό του**: αν υπάρχει component (view gates, εγκυρότητα
γεωμετρίας) και πώς χτίζεται. Ίδια αρχή με το §5.5 — η γνώση μένει εκεί που ζει.
Mirror του Revit: host + hosted component, **μία** ταυτότητα όσα components κι αν αποκτήσει.

**Γιατί κανένα gate δεν το είδε:** ίδιο σχήμα με §2 — το CHECK 3.18 είναι name/regex-based
(`attachBeamRebar` ≠ `attachSlabRebar`) και δεν ανοίγει `src/subapps`· το CHECK 3.28 (jscpd)
είναι `--diff`, και οι κλώνοι ήταν **προϋπάρχοντες** → μέσα στο baseline. Το βρήκε **ανθρώπινη
ανάγνωση** του jscpd report κατά τη Φάση Β′.

**Απόδειξη ότι έφυγε:** `npm run jscpd:diff` στα 3 αρχεία → **«no new clones»**, ενώ πριν
flagάριζε `bim-three-beam-rebar-attach.ts:50-59` ↔ `bim-three-slab-converter.ts:59-68` ↔
`bim-three-structural-converters.ts:258-267`. Gates: **235 suites / 2071 tests ✅**.

## 8. Changelog

- **2026-07-18** — **Boy Scout (N.0.2), εντολή Giorgio**: κεντρικοποιήθηκε **δεύτερο**
  διπλότυπο που βρέθηκε κατά τη Φάση Β′ — `attachElementComponent` (§10), **4 σημεία / 3
  αρχεία** (`attachBeamRebar`/`attachColumnRebar`/`attachSlabRebar`/`attachSoffitFinish`,
  που τα ίδια τους τα σχόλια αποκαλούσαν «Mirror του…»). **`jscpd:diff` → «no new clones»**
  στα 3 αρχεία που πριν flagάριζαν· **235 suites / 2071 tests ✅**· μηδέν αλλαγή συμπεριφοράς.
- **2026-07-18** — **Φάση Β′ ΥΛΟΠΟΙΗΘΗΚΕ** (§9.1): οι **35 ωμές εγγραφές / 22 αρχεία → 0**·
  ίδιος κόμβος, ίδια κλειδιά, ένας writer. **Το registry module `bim-mesh-identity-stamp`
  (tier 3) ΚΑΤΑΧΩΡΗΘΗΚΕ** με allowlist **ένα** αρχείο → **CHECK 3.7 ενεργό** (§6).
  Μία **σκόπιμη** αλλαγή συμπεριφοράς, εγκεκριμένη: ο wrapper preview σκάλας
  (`bim3d-preview-rebuild.ts:452`) παίρνει πλέον `bimType='stair'` — ήταν ελλιπής ταυτότητα
  (§9.2). Gates: **235 suites / 2071 tests ✅**, `test:registry-golden` **90 ✅**,
  `jscpd:diff` → μόνο **προϋπάρχοντα** clones (αποδείχθηκε με `git diff -U0`: κάθε σημείο
  πήγε 2 γραμμές → 1· τα flagged blocks έγιναν **μικρότερα**).
- **2026-07-18** — Φάση Α: `stampBimIdentity` primitive· 4 helpers delegate· stair
  `tagMesh`→`tagStairMesh`. Μηδέν αλλαγή συμπεριφοράς. Registry module ΑΝΑΒΛΗΘΗΚΕ με
  μέτρηση (35/22 → fail-closed).
- **2026-07-18** — Ορχηστρωτής 5 πρακτόρων: **η Φάση Β (seam) ΑΠΟΡΡΙΦΘΗΚΕ** (§5) — τρία
  ανεξάρτητα ναρκοπέδια (nested openings· 11+ non-climbing consumers· `LineSegments2`/
  `InstancedMesh extends Mesh` → decorations θα κληρονομούσαν ταυτότητα). **Φάση Β′** (§9)
  εγκρίθηκε στη θέση της. Βρέθηκε **υπαρκτό bug ADR-668** (§5.6, δεν αγγίχτηκε).
- **2026-07-18** — **ΔΙΟΡΘΩΣΗ ΜΕΤΡΗΣΗΣ**: το αρχικό «39 γραμμές / 25 αρχεία» ήταν **λάθος** —
  το grep `userData\['bimId'\] *=` πιάνει **και τις συγκρίσεις** `=== ` (το `=` ταιριάζει στο
  πρώτο `=` του `===`). Τέσσερα «write sites» ήταν **αναγνώστες** (`scene-framing-bounds.ts:22`,
  `FaceSelectionHighlighter.ts:127`, `StairSubElementHighlighter.ts:50,108`).
  **Σωστό: 35 εγγραφές / 22 αρχεία.** Σωστό pattern: `userData\['bimId'\] *= *[^=]`.
  ⚠️ Το ίδιο λάθος θα μόλυνε και το `forbiddenPatterns` του registry module — **μην το
  αντιγράψεις**.
