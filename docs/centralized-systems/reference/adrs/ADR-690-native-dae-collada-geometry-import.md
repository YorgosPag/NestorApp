# ADR-690 — Native `.dae` (COLLADA) geometry import: το `.dae` κάνει ό,τι το `.glb`

**Status:** 🟢 **Φ2 DONE + BROWSER-VERIFIED** (2026-07-24, `abricos_gerbera.dae` + 3 jpg → γεωμετρία **+ υλικά + υφές** μπήκαν σωστά ως `imported-mesh`). 2 hotfixes μετά από browser tests: (#1 missing υφή → `stripBrokenTextures`· #2 ανώνυμα ColladaLoader meshes → `ensureUniqueMeshNames` + ξένο μοντέλο → πρόσφερε όλα). jest 7/7 + jscpd ✓. Commit = Giorgio. ✅ **Το §9 ΕΚΛΕΙΣΕ από το ADR-691** (2026-07-24): τα embedded υλικά προάγονται πλέον σε `bmat_*` της βιβλιοθήκης και εμφανίζονται στο panel «Υλικά όψης» — **χωρίς** να ξαναβάφεται η γεωμετρία. Το §9 παρακάτω παραμένει ως **ιστορική ανάλυση της αιτίας**.
**Date:** 2026-07-24
**Owner:** Giorgio
**Σχετικά (parents):** **ADR-683** (συνεργατικό round-trip — κλείνει το κενό **Κ6**: «Καμία εξαγωγή/εισαγωγή DAE») · **ADR-678** (C4D material round-trip — ιδιοκτήτης του υπάρχοντος `.dae` material path) · ADR-668 (mesh3d export OBJ/glTF — ιδιοκτήτης του `serialiseGlb`) · ADR-679 (PBR/υφές) · ADR-511 (material catalog SSoT)

---

## 1. Πρόβλημα (intent του Giorgio, 2026-07-24)

Ο Giorgio εισάγει **τακτικά** (ρουτίνα) 3Δ μοντέλα από **Cinema 4D R15** (2013). Ο R15 **ΔΕΝ εξάγει
glTF** (μπήκε στον R2024) — εξάγει `.dae` (COLLADA), που κρατά χρώματα + υλικά + υφές. Θέλει:

> **Το `.dae` να κάνει ό,τι κάνει το `.glb`** — να μπαίνει η **γεωμετρία** + υλικά + υφές, **χωρίς**
> ενδιάμεσο βήμα Blender κάθε φορά.

### 1.1 Ground truth — τι κάνει σήμερα το `.dae` (μετρημένο)

Ο Νέστωρ σήμερα **δεν φτιάχνει γεωμετρία από `.dae`**. Ρητά στον κώδικα
(`C4dMaterialImportButton.tsx:216-217`): «μόνο το glTF κουβαλά γεωμετρία… ο OBJ/DAE δρόμος δεν έχει
τι να προσφέρει εδώ (μηδέν κορυφές)».

- **Μόνο `.glb`/`.gltf`** δημιουργεί νέα οντότητα (`imported-mesh`) μέσω `ImportedMeshImportDialog`.
- Το `.dae` σήμερα = **ΜΟΝΟ material round-trip** (`importColladaAppearance` → name-based matching σε
  υπάρχοντα `bimId` που εξήχθησαν πρώτα από τον Νέστορα). Ξένο μοντέλο (π.χ. καρέκλα Herman Miller) →
  **μηδέν ταιριάσματα → τίποτα δεν μπαίνει**.

---

## 2. Big-player benchmark (ο κανόνας «αν οι μεγάλοι δεν το κάνουν…»)

| Κατηγορία | Πρακτική |
|---|---|
| **Desktop** (Revit / ArchiCAD / C4D) | Native Collada/FBX import **με** filesystem access — έχουν το πλήρες. Δεν είναι το πλαίσιό μας (browser). |
| **Web** (Autodesk Platform/Forge Viewer, Speckle, three.js editor, Figma-3D) | **Τυποποιούν σε glTF στην είσοδο.** Το glTF είναι «το JPEG των 3D». |
| **three.js (η ίδια η βάση μας)** | `ColladaLoader` = **legacy/maintenance**· `GLTFLoader`/`GLTFExporter` = **συνιστώμενα**. |

**Συμπέρασμα:** «`.dae` → glTF στην είσοδο, μετά κοινό glTF pipeline» **ΕΙΝΑΙ** η web πρακτική των
μεγάλων. Ευθυγραμμιζόμαστε πλήρως — δεν εφευρίσκουμε ξεχωριστό μονοπάτι γεωμετρίας για COLLADA.

---

## 3. Απόφαση αρχιτεκτονικής — `.dae` → in-memory `.glb` → **υπάρχον** glTF pipeline (ΜΗΔΕΝ διπλότυπο)

**ΔΕΝ** γράφουμε δεύτερο, ξεχωριστό `.dae` geometry importer (= sibling clone ολόκληρου του glTF
pipeline, απαγορευμένο N.18). Αντ' αυτού μετατρέπουμε το `.dae` → `.glb` **μέσα στον browser**, τη
στιγμή που μπαίνει, και τροφοδοτούμε το **ήδη υπάρχον** μονοπάτι:

```
.dae  ──ColladaLoader──►  THREE.Group  ──serialiseGlb (SSoT, ADR-668)──►  .glb (ArrayBuffer, μνήμη)
  │        (+ textures via LoadingManager.setURLModifier)                        │
  │                                                                              ▼
  │   (ΑΜΕΤΑΒΛΗΤΟ downstream)   parseGltfScene → ImportedMeshImportDialog → importGltfMeshes → upload+render
  │
  └──(ΑΜΕΤΑΒΛΗΤΟ)── importColladaAppearance (per-face βαφή + texture upload των **matched** στοιχείων)
```

Downstream = **μηδέν νέος κώδικας**. Το αποθηκευμένο asset γίνεται αυτάρκες `.glb` (ίδιο με το glTF
μονοπάτι — τα εισαγόμενα rendάρονται, μετακινούνται, περιστρέφονται· ADR-683 Φ3α).

### 3.1 SSoT reuse (άγκυρες — επαληθευμένες με grep 2026-07-24)

| Βήμα | Επαναχρησιμοποιεί (υπάρχον) | Πού |
|------|----------------------------|-----|
| THREE → `.glb` | **`serialiseGlb(root)`** — `GLTFExporter().parseAsync(root,{binary,onlyVisible:false,trs,embedImages})` | `export/core/mesh3d/mesh3d-serialise.ts:34` |
| `.glb` → objects+fingerprint | **`parseGltfScene(data)`** (δέχεται `ArrayBuffer`) | `io/mesh3d-roundtrip/gltf-scene-parse.ts:307` |
| Dialog επιλογής κόμβων | **`ImportedMeshImportDialog`** (δέχεται ήδη `ArrayBuffer \| Blob`) | `ui/components/imported-mesh/` |
| Upload + οντότητες + ΕΝΑ undo | **`importGltfMeshes`** (δέχεται ήδη `ArrayBuffer \| Blob`) | `io/mesh3d-roundtrip/import-gltf-meshes.ts` |
| Per-face βαφή/υφές των matched | **`importColladaAppearance`** (ΑΜΕΤΑΒΛΗΤΟ) | `io/mesh3d-material-import/import-collada-appearance.ts` |
| COLLADA loader / glTF exporter | `three/examples/jsm/loaders/ColladaLoader.js` · `exporters/GLTFExporter.js` | node_modules (three 0.170.0) ✅ |

**Bonus:** ο `serialiseGlb` γράφει `mesh.name`/`material.name`, άρα το κανάλι ταυτότητας (ADR-678 §2)
επιβιώνει → το ίδιο `.glb` τροφοδοτεί ΚΑΙ τον material round-trip δωρεάν.

### 3.2 Το open question — **REPLACE ή COEXIST;** → **COEXIST** (τεκμηριωμένη απόφαση)

Το υπάρχον `.dae` material path (`importColladaAppearance` → `foreignAndBrokenTextures` →
`importForeignTextures` → per-face `SetFaceAppearanceCommand` + self-heal) κάνει **texture upload σε
Firebase** για τα **matched** στοιχεία. Το glTF appearance path **δεν** ανεβάζει embedded textures.
Άρα «route τα πάντα μέσω glb» θα ήταν **regression** στη βαφή/υφές των matched. Επομένως:

- **Appearance (matched entities):** μένει στον `importColladaAppearance` — **ΑΜΕΤΑΒΛΗΤΟ**.
- **Geometry (νέα/unmatched objects):** νέο, **επιπρόσθετο** μονοπάτι μέσω glb.

**Ποια objects προσφέρονται ως γεωμετρία;** Αυτά που **δεν ταίριαξαν** σε ζωντανή οντότητα. Το
`importColladaAppearance` επιστρέφει ήδη `result.unmatched` (ονόματα). Φιλτράρουμε τις glb εγγραφές:
`records.filter(r => isImportableNode(r) && result.unmatched.includes(r.objectName))`.

- **Κύρια περίπτωση (ξένο μοντέλο, π.χ. καρέκλα HMI Aeron):** `importColladaAppearance` βρίσκει
  **μηδέν** matches → `result.unmatched` = **ΟΛΑ** τα ονόματα → **όλες** οι εγγραφές προσφέρονται.
  Το name-join δεν είναι εύθραυστο εδώ (superset).
- **Μεικτή περίπτωση (round-trip + νέα κάγκελα):** τα matched εξαιρούνται σωστά ώστε να μη μπει
  διπλή γεωμετρία. Εξάρτηση: το objectName επιβιώνει `.dae → glb → glb-load` (ο `GLTFExporter` **δεν**
  sanitizeάρει node names — glTF spec δέχεται αυθαίρετο UTF-8). Κλειδώνεται με jest (§6).

---

## 4. Η παγίδα των υφών (texture UX — Revit «missing assets» pattern)

Το `.dae` αναφέρει υφές ως **σκέτα ονόματα loose αρχείων** (μετρημένο στην πραγματική καρέκλα:
`HMI_3D01.jpg`, `3D01_OPC.jpg`). Ο **browser ΔΕΝ διαβάζει `F:\`**. Άρα:

- Ο χρήστης επιλέγει τα `.jpg` **μαζί** με το `.dae` (το `accept` ήδη τα δέχεται· το `readImportFiles`
  ήδη μαζεύει `imageFiles`).
- Ο converter χτίζει `THREE.LoadingManager` με `setURLModifier(filename → URL.createObjectURL(file))`
  ώστε ο `ColladaLoader` να βρίσκει τις εικόνες· ο `serialiseGlb` (`embedImages:true`) τις **ενσωματώνει**
  στο glb → τα εισαγόμενα renderάρονται με τις υφές τους.
- Υφές που το `.dae` αναφέρει αλλά ο χρήστης δεν επέλεξε → **actionable warning** (reuse
  `c4dMaterialImport.missingTextures`), **ποτέ** σιωπηλό γκρι.
- **⚠️ Broken-image robustness (ground-truth 2026-07-24, browser test #1):** ο `GLTFExporter`
  (`embedImages:true`) καλεί `ctx.drawImage(brokenImage)` → `InvalidStateError` **αν έστω μία υφή
  λείπει** → σκάει ΟΛΗ η μετατροπή, η γεωμετρία χάνεται (`daeConvertError`). Fix: `stripBrokenTextures`
  αφαιρεί (null-out + dispose) κάθε texture slot με `naturalWidth === 0` **πριν** τον `serialiseGlb`.
  Έτσι η υφή που λείπει παραλείπεται (warning), αλλά **το mesh μπαίνει** (Revit «missing assets»).
- Τα object URLs γίνονται `revoke` μετά τη σειριοποίηση (χωρίς leak).

---

## 5. File plan (Φάση 2 — μετά το «προχώρα»)

| Αρχείο | Είδος | Τι |
|---|---|---|
| `io/mesh3d-roundtrip/collada-to-glb.ts` | **NEW** | `colladaToGlb(daeText, imageFiles) → { glb: ArrayBuffer; missingTextures: string[] }`. ColladaLoader + LoadingManager.setURLModifier + **`serialiseGlb`** (SSoT). Helpers ≤40 γρ.: basename/index υφών, wait-for-textures, url-modifier. |
| `io/mesh3d-roundtrip/__tests__/collada-to-glb.test.ts` | **NEW** | jest: (α) filename→object-URL mapping (case-insensitive, basename), (β) missing-texture collection, (γ) name round-trip assertion (mock three). |
| `ui/components/C4dMaterialImportButton.tsx` | **EDIT** | (1) dae payload κρατά `fileName`. (2) `PendingMeshImport` γενικεύεται σε `{ records, data: ArrayBuffer\|Blob, sourceFileName }` (το gltf branch περνά `data: file, sourceFileName: file.name`). (3) dae branch: μετά τον **αμετάβλητο** `importColladaAppearance`, καλεί `colladaToGlb` → `parseGltfScene` → φιλτράρει με `result.unmatched` + `isImportableNode` → αν υπάρχουν → `setPendingImport` (γεωμετρία προηγείται, mirror του gltf). |
| `i18n/locales/{el,en}/dxf-viewer-shell.json` | **EDIT** | 1-2 νέα κλειδιά κάτω από `c4dMaterialImport` (π.χ. `daeConverting` info toast, `daeConvertError`). `importMeshes.*` + `missingTextures` **επαναχρησιμοποιούνται**. |

**Boy Scout (N.7.1):** το `handleFiles` είναι ήδη ~100 γρ. (pre-existing). Το νέο geometry-detection
μπαίνει ως **καθαρή io helper** (`colladaToGlb` + φίλτρο), όχι inline — η προσθήκη στο button ~8 γρ.
Δεν χειροτερεύω περαιτέρω· δεν κάνω μεγάλο refactor εκτός scope χωρίς εντολή.

**ΔΕΝ αλλάζει:** `parseGltfScene`, `importGltfMeshes`, `ImportedMeshImportDialog`,
`importColladaAppearance`, `serialiseGlb`, `dae-material-parse`, `import-foreign-textures`.

---

## 6. Testing (N.17: OXI tsc· jest επιτρέπεται)

- `collada-to-glb.test.ts`: URL modifier (basename + case), missing-texture list, name preservation.
- Επανεκτέλεση: `import-collada-appearance.test.ts` (καμία regression στο material path).
- **N.18:** `npm run jscpd:diff <staged src>` πριν το «done» — μηδέν sibling clone (ο converter
  ΔΕΝ ξαναγράφει `serialiseGlb`/`parseGltfScene`).
- 🔴 **Browser verification = ΔΙΚΗ ΤΟΥ GIORGIO** (test asset: `HMI_Aeron_Chair_3D.dae` + 2 jpg).

---

## 7. Όρια (100% ειλικρίνεια)

- Ισχύει το θεμελιώδες όριο του ADR-683 §3: τα mesh formats είναι **μονόδρομος** — το εισαγόμενο
  μπαίνει ως `imported-mesh` (ψημένα τρίγωνα), **όχι** ως parametric BIM. Μετακινείται/περιστρέφεται,
  δεν αλλάζει σχήμα. Αυτό είναι σκόπιμο (linked-model, όπως Revit).
- `ColladaLoader` = legacy στο three — γι' αυτό ακριβώς μετατρέπουμε άμεσα σε glTF και **δεν** χτίζουμε
  μόνιμο COLLADA rendering path.
- Μονάδες: ο `ColladaLoader` εφαρμόζει το `<unit>` του `.dae`· η τυχόν διόρθωση γίνεται από το
  υπάρχον `ImportUnitScaleControl` του dialog (ίδιο UX με glTF).

---

## 9. ~~Ανοιχτό~~ **ΕΚΛΕΙΣΕ (ADR-691)**: τα embedded υλικά και το panel «Υλικά όψης»

> ✅ **Λύθηκε από το ADR-691** (2026-07-24). Η ανάλυση παρακάτω παραμένει έγκυρη ως **διάγνωση**: εξηγεί
> γιατί ο συλλέκτης δεν έβλεπε τίποτα. Η λύση **δεν** ήταν να βαφτούν οι όψεις (αυτό θα κατέστρεφε τα
> authored UVs του ξένου μοντέλου — ADR-691 §3.α) αλλά η **προαγωγή** των υλικών σε `bmat_*` +
> καταγραφή τους στο `params.embeddedMaterialIds`, με τη γεωμετρία να renderάρεται αμετάβλητη.

Μετά από επιτυχή εισαγωγή ξένου μοντέλου, το κάτω panel «Υλικά όψης» (`useSceneMaterials`, ADR-687)
μένει άδειο, παρότι το mesh renderάρεται με τα υλικά/υφές του. **Δεν είναι bug:**

- Το panel δείχνει `collectSceneAppearanceRefs` = υλικά **βαμμένα σε όψεις BIM στοιχείων** (faceAppearance
  `materialIds`/`colorHexes` μέσω της βιβλιοθήκης Nestor).
- Τα υλικά ενός εισαγόμενου `imported-mesh` (είτε `.glb` είτε τώρα `.dae`) ζουν **embedded πάνω στη
  γεωμετρία** (THREE materials στο glb) και renderάρονται από εκεί — **δεν** είναι faceAppearance refs.
- Ο material path (`importColladaAppearance`) βάφει **μόνο matched** Nestor στοιχεία· ξένο μοντέλο =
  μηδέν matches → τίποτα στο panel.

Άρα το `.dae` συμπεριφέρεται **ακριβώς όπως το `.glb`** (ο στόχος του ADR). Το «να μπαίνουν τα embedded
υλικά και στη βιβλιοθήκη/panel» θα ήταν **ξεχωριστό feature** (material extraction imported-mesh →
`BimMaterial` library) που θα ίσχυε **και** για `.glb` — εκτός scope ADR-690. TODO αν το θελήσει ο Giorgio.

## 8. Changelog

- **2026-07-24 — Φ1 (PLAN):** SSoT audit (grep) επιβεβαίωσε τις άγκυρες (`serialiseGlb`,
  `parseGltfScene`, `ImportedMeshImportDialog`/`importGltfMeshes` δέχονται `ArrayBuffer|Blob`,
  ColladaLoader+GLTFExporter στα node_modules). Αρχιτεκτονική «`.dae`→in-memory `.glb`→υπάρχον glTF
  pipeline». Open question REPLACE/COEXIST → **COEXIST** (η βαφή/υφές των matched μένει στον
  αμετάβλητο `importColladaAppearance`).
- **2026-07-24 — Φ2 (DONE, code+jest+jscpd):**
  - **NEW** `io/mesh3d-roundtrip/collada-to-glb.ts` — `colladaToGlb(daeText, imageFiles) → { glb,
    missingTextures }`. `ColladaLoader` + `LoadingManager.setURLModifier` (basename, case-insensitive
    → `URL.createObjectURL`) + **`serialiseGlb`** (SSoT, μηδέν ξαναγραμμένος GLTFExporter). Περιμένει
    `manager.onLoad` πριν τη σειριοποίηση (πλήρως φορτωμένες υφές)· `revokeObjectURL` σε `finally`.
  - **NEW** `__tests__/collada-to-glb.test.ts` — 6 tests (basename/index helpers, resolve+serialise,
    missing-texture list, no-texture fast path). Σύνολο suite 11/11 ✓ (μαζί με το αμετάβλητο
    `import-collada-appearance.test.ts` — μηδέν regression).
  - **EDIT** `C4dMaterialImportButton.tsx` — dae payload κρατά `fileName`· `PendingMeshImport`
    γενικεύτηκε σε `{ records, data: ArrayBuffer|Blob, sourceFileName }` (glTF + dae τροφοδοτούν το
    ίδιο dialog)· νέο dae-geometry block **μετά** τον αμετάβλητο `importColladaAppearance`: τρέχει
    **μόνο** αν `result.unmatched.length > 0` (pure round-trip δεν πληρώνει μετατροπή), φιλτράρει τις
    glb εγγραφές με `unmatched ∩ isImportableNode`, warning για missing υφές, `setPendingImport`.
    Δικό του try/catch → `daeConvertError` (η βαφή έχει ήδη εφαρμοστεί, δεν χάνεται).
  - **EDIT** i18n `{el,en}/dxf-viewer-shell.json` — νέο κλειδί `c4dMaterialImport.daeConvertError`
    (τα `importMeshes.*` + `missingTextures` επαναχρησιμοποιήθηκαν αυτούσια).
  - **ΑΜΕΤΑΒΛΗΤΑ:** `serialiseGlb`, `parseGltfScene`, `importGltfMeshes`, `ImportedMeshImportDialog`,
    `importColladaAppearance`, `dae-material-parse`, `import-foreign-textures`.
  - 🔴 Εκκρεμεί μόνο η browser επαλήθευση (Giorgio).
- **2026-07-24 — Φ2 hotfix (browser test #1 → `daeConvertError` όταν λείπει υφή):** root cause = ο
  `GLTFExporter` σκάει σε broken image (missing texture 404). **NEW** `stripBrokenTextures` στο
  `collada-to-glb.ts` (generic διάσχιση όλων των `THREE.Texture` slots, null-out+dispose όσα έχουν
  `naturalWidth===0`) πριν τον `serialiseGlb` → η γεωμετρία μπαίνει ακόμη και χωρίς τις υφές. `+1` test
  (broken map καθαρίζεται, υγιές normalMap μένει) → 6/6 ✓. `console.error` στο catch του button για
  διάγνωση μελλοντικών edge cases. jscpd ✓.
- **2026-07-24 — Φ2 hotfix #2 (browser test #2 → `noChanges`, κανένα dialog γεωμετρίας):** ground-truth
  σε πραγματικό `.dae` (`abricos_gerbera`, nested hierarchy). **Δύο root causes:**
  1. Ο `ColladaLoader` βάζει τα `<node name>` στους ενδιάμεσους **Groups** αφήνοντας τα **Meshes
     ανώνυμα** → τα glb records βγαίνουν με `objectName=''` → το name-join με τον material parser
     (`unmatched`=`polymsh1`…) αποτυγχάνει → 0 records· **και** ο `bim-mesh-cache` (`indexBundleNodes`,
     κλειδί `<bundleId>#<nodeName>`) δεν βρίσκει template → placeholder κουτιά. Fix: **NEW**
     `ensureUniqueMeshNames` (own → κοντινότερος named ancestor → `'mesh'`, + counter) πριν τον
     `serialiseGlb`. `+1` test (`polymsh1`/`polymsh1_1`/`polymsh1_2`).
  2. Το geometry detection βασιζόταν στο cross-parse name-join ακόμη και για **πλήρως ξένο** μοντέλο
     (μηδέν Nestor matches). Fix (button): `appliedCount === 0` → πρόσφερε **ΟΛΑ** τα importable (τα
     ξένα ονόματα δεν ταιριάζουν ποτέ σε bimId)· μεικτό round-trip → best-effort join. Guard χαλάρωσε
     σε «skip μόνο σε καθαρό round-trip». Προστέθηκε `console.info('[ADR-690] dae geometry:',…)` για
     διάγνωση counts (objects/importable/applied/offered).
  - jest 7/7 ✓ · jscpd ✓. 🔴 re-test στον browser (`abricos_gerbera.dae` + 3 jpg).
