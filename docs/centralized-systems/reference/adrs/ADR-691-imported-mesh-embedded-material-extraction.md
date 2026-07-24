# ADR-691 — Extraction embedded υλικών/υφών ενός `imported-mesh` → βιβλιοθήκη + panel «Υλικά όψης»

**Status:** 🟢 **Φ2 DONE (κώδικας + tests)** — 2026-07-24. jest **418/418 πράσινα σε 38 suites** (όλα τα σχετικά domains), jscpd (N.18) **καθαρό σε 12 αρχεία**. Υλοποιήθηκε με **orchestrator 5 παράλληλων agents** (απόφαση Giorgio, N.8). Commit = Giorgio. 🔴 **Εκκρεμεί browser επαλήθευση** (βλ. §9).
**Date:** 2026-07-24
**Owner:** Giorgio
**Σχετικά (parents):** **ADR-683** Φ3β/Φ5 (imported-mesh οντότητα, `materialSlots`) · **ADR-690** (native `.dae` → glb· §9 του οποίου *τεκμηρίωσε* το κενό που κλείνει εδώ) · **ADR-687** Φ8 (panel «Υλικά όψης» / `useSceneMaterials`) · **ADR-678** Βήμα 3 (ξένες υφές → `bmat_*`, content-hash dedup) · **ADR-679** (PBR υφές) · **ADR-686** (imported-mesh appearance override) · **ADR-363** §Q8 (BimMaterial schema)

---

## 1. Πρόβλημα (intent του Giorgio, 2026-07-24)

Μετά το ADR-690, ένα ξένο μοντέλο (`abricos_gerbera.dae`) μπαίνει σωστά: **γεωμετρία + υλικά + υφές**
φαίνονται στο 3Δ. Αλλά τα υλικά του **δεν υπάρχουν πουθενά ως υλικά** — μόνο ως THREE materials
ψημένα μέσα στο `.glb`. Δηλαδή:

- ❌ Δεν εμφανίζονται στην κάτω μπάρα **«Υλικά όψης»** (Ν.2).
- ❌ Δεν μπαίνουν στη **βιβλιοθήκη υλικών** (Ν.1) → ο χρήστης **δεν μπορεί** να πάρει το ξύλο του
  εισαγόμενου επίπλου και να βάψει μ' αυτό έναν τοίχο.
- ❌ Δεν έχουν κόστος/ΑΤΟΕ/όνομα → δεν συμμετέχουν σε καμία προμέτρηση.

> **Το αίτημα:** τα embedded υλικά **και οι υφές τους** να μπαίνουν **ΚΑΙ** στη βιβλιοθήκη **ΚΑΙ**
> στο panel «Υλικά όψης» — όχι μόνο renderαρισμένα πάνω στη γεωμετρία.

**Ισχύει για `.glb` ΚΑΙ `.dae`** — άρα η δουλειά ανήκει στο **κοινό** glTF μονοπάτι, όχι στο
dae-specific (το `.dae` περνά ήδη από `colladaToGlb` → ίδιο pipeline, ADR-690 §3).

### 1.1 Ground truth — γιατί το panel είναι άδειο (μετρημένο στον κώδικα)

| Βήμα | Αρχείο | Τι κάνει |
|---|---|---|
| Panel «Υλικά όψης» | `bim-3d/ui/useSceneMaterials.ts:107-121` | φιλτράρει τον `buildMaterialLibraryEntries(library)` με τα refs της σκηνής |
| Ο συλλέκτης | `bim-3d/ui/scene-material-usage.ts:58-94` | **ρητοί extractors ανά τύπο**: `entity.faceAppearance` (solids) · `params.materials.appearance` (σκάλα) · `params.appearance` (κάγκελο) |
| Το imported-mesh | `bim/entities/imported-mesh/imported-mesh-types.ts` | **δεν έχει κανένα από τα τρία** συμπληρωμένο κατά την εισαγωγή |

Τα υλικά ζουν **μόνο** μέσα στο `.glb` (`imported-mesh-material-enhance.ts` τα αφήνει ως έχουν όταν
δεν υπάρχει override). Άρα ο συλλέκτης — σωστά — δεν βλέπει τίποτα.

---

## 2. Big-player benchmark

| Εφαρμογή | Τι κάνει με τα υλικά ενός εισαγόμενου μοντέλου |
|---|---|
| **Revit** (Link/Import CAD & FBX) | Δημιουργεί **πραγματικά Materials** στο project (`Imported Material : <name>`) + appearance assets. Εμφανίζονται στο Material Browser και είναι **επαναχρησιμοποιήσιμα** σε native στοιχεία. |
| **ArchiCAD** | Import → νέα **Surfaces** στον Attribute Manager, με πρόθεμα προέλευσης. |
| **Cinema 4D** | Τα υλικά του εισαγόμενου αρχείου μπαίνουν στον **Material Manager** του document. |
| **Blender / three.js editor** | Τα materials γίνονται datablocks/entries του project. |

**Καθολικό μοτίβο:** τα embedded υλικά **προάγονται σε πολίτες του project** — αλλά **η γεωμετρία
συνεχίζει να renderάρεται με ό,τι ήρθε**. Κανείς δεν ξαναβάφει το εισαγόμενο μοντέλο με «δικά του»
υλικά κατά την εισαγωγή. Αυτή η διάκριση είναι το κλειδί ολόκληρου του ADR (§4).

---

## 3. Οι δύο δρόμοι — και γιατί ο ένας απορρίπτεται (ΜΕΤΡΗΜΕΝΟ, όχι θεωρία)

### 3.α «Βάψε τις όψεις» — δημιούργησε `bmat_*` και γράψε `faceAppearance['*'] = { materialId }`

Φαινομενικά δωρεάν: ο συλλέκτης **ήδη** διαβάζει `faceAppearance` κάθε entity → μηδέν αλλαγή στο
`scene-material-usage.ts`. **Το αρχικό προτιμώμενο του handoff. ΑΠΟΡΡΙΠΤΕΤΑΙ** μετά από ανάγνωση
του render path:

1. **Πλήρης αντικατάσταση, όχι merge.** `bim-3d/converters/imported-mesh-material-enhance.ts:120-135`
   (`resolveSlotMaterial`): αν υπάρχει override, το embedded THREE material **πετιέται ολόκληρο** και
   αντικαθίσταται από νέο `MeshStandardMaterial` της βιβλιοθήκης. Χρώμα, `map`, normal/roughness,
   ρυθμίσεις PBR του συνεργάτη — **όλα χάνονται**.
2. **UV mismatch → οπτική καταστροφή.** Οι υφές της βιβλιοθήκης ρυθμίζονται με
   `repeat = 1 / tileSizeM` (`bim-3d/materials/pbr-texture-config.ts:30-39`) πάνω σε **σύμβαση
   world-meter UV** (`bim-uv-helpers.ts`: 1 UV = 1 μέτρο). Η ξένη γεωμετρία έχει **authored UVs**
   (unwrap του καλλιτέχνη). Εφαρμογή του ενός πάνω στο άλλο = η υφή τεντώνεται/επαναλαμβάνεται
   λάθος. **Το μοντέλο που μόλις μπήκε σωστά θα χαλούσε.**
3. **Per-entity, όχι per-slot.** Το ADR-686 απέδειξε ότι το override γράφεται στο `'*'` (base):
   ένα mesh με 4 slots (βάση/κάθισμα/μπράτσα) θα έπαιρνε **ένα** υλικό παντού.
4. **Σημασιολογικά λάθος:** «ο χρήστης έβαψε ρητά» ≠ «έτσι ήρθε». Το ADR-687 Φ8 ορίζει ρητά ότι το
   panel δείχνει **ρητές βαφές** — μολύνοντάς το με ψευδο-βαφές χάνουμε τη διάκριση «τι άλλαξα εγώ».

### 3.β **ΕΠΙΛΕΓΕΤΑΙ** — δημιούργησε `bmat_*` και **κατέγραψε τη χρήση**, ΜΗΝ βάψεις

Η γεωμετρία μένει **byte-identical** στο render (μηδέν οπτική αλλαγή, μηδέν regression), και η
οντότητα κρατά **δείκτες** στα υλικά που περιέχει: νέο πεδίο `params.embeddedMaterialIds`. Ο
συλλέκτης αποκτά **έναν ακόμη ρητό extractor** — ακριβώς όπως ήδη έχει για σκάλα και κάγκελο (η
αρχιτεκτονική του το προβλέπει: «ρητοί extractors ανά τύπο, ΟΧΙ blind deep-scan»).

```
.glb bytes ─► glb-embedded-materials (pure)  ─► {index, name, colorHex, metalness, roughness, opacity, albedo bytes}
                                                        │
                       ┌────────────────────────────────┴──────────────────────────┐
                       ▼ (έχει υφή)                                                ▼ (μόνο χρώμα)
        importForeignTextures  (ADR-678, ΑΥΤΟΥΣΙΟ:                   createColourMaterial
        content-hash dedup + upload + self-heal + rollback)          (appearance → bmat_*)
                       └────────────────────────────────┬──────────────────────────┘
                                                        ▼
                                        Map<gltfMaterialIndex, bmat_*>
                                                        ▼
   importGltfMeshes ─► buildImportedMeshEntities ─► params.embeddedMaterialIds  (ΜΙΑ γραφή, μηδέν race)
                                                        ▼
                       scene-material-usage (νέος ρητός extractor) ─► useSceneMaterials ─► panel «Υλικά όψης» ✅
                                                        ▼
                              useMaterialLibrary (live Firestore) ─► βιβλιοθήκη Ν.1 ✅ + drag σε τοίχους ✅
```

**Οφέλη πέρα από το αίτημα (δωρεάν, μηδέν κώδικας):**
- Το dialog «Αντιστοίχιση Υλικών» (ADR-686) τα βλέπει αμέσως στα swatches (τρέφεται από τον ίδιο
  `material-library-index`) → ο χρήστης μπορεί να αντιστοιχίσει ρητά ένα κομμάτι στο δικό του υλικό.
- Το ADR-683 Φ3.1β «όνομα υλικού → `BimMaterial` → `defaultUnitCost`» παύει να είναι νεκρό γράμμα:
  τα ονόματα υπάρχουν πλέον ως πραγματικά `bmat_*`.

---

## 4. Απόφαση

> **Κατά την εισαγωγή ενός `imported-mesh`, τα embedded υλικά προάγονται σε πραγματικά `BimMaterial`
> (`bmat_*`) της βιβλιοθήκης — με τις υφές τους ανεβασμένες — και η οντότητα καταγράφει ποια
> περιέχει. Η γεωμετρία ΔΕΝ ξαναβάφεται: renderάρεται ακριβώς όπως ήρθε.**

### 4.1 Επιμέρους αποφάσεις

| # | Ερώτημα | Απόφαση | Γιατί |
|---|---|---|---|
| 1 | Πού εμφανίζονται; | Νέο `params.embeddedMaterialIds` + **ρητός extractor** στον `collectSceneAppearanceRefs` | §3· ο συλλέκτης είναι ήδη type-explicit — δεν σπάει η αρχιτεκτονική του |
| 2 | Πηγή δεδομένων; | **Ο GLB/glTF JSON container**, όχι τα THREE materials | δίνει τα **αρχικά bytes** της υφής → σταθερό SHA-256 → το content-hash dedup του ADR-678 δουλεύει **cross-session**. Canvas re-encode θα έδινε ασταθές hash |
| 3 | Κλειδί join; | **glTF material index** (μέσω `gltf.parser.associations`, three r170 `{materials: i}`) | τα ξένα υλικά είναι **συχνά ανώνυμα** (μετρημένο ADR-686) — το name-join θα τα έχανε σιωπηλά |
| 4 | Υφές; | **`importForeignTextures` ΑΥΤΟΥΣΙΟ** (DI), με `File` συνθεμένο από τα embedded bytes | N.18: μηδέν sibling clone· κερδίζουμε δωρεάν content-hash dedup + self-heal + rollback |
| 5 | Υλικά χωρίς υφή; | Νέο `bmat_*` με `appearance {baseColorHex, metalness, roughness, opacity}` (ADR-687 Φ1/Φ4 schema) | το χρώμα του συνεργάτη είναι πληροφορία· χωρίς αυτό η μισή καρέκλα δεν θα υπήρχε στη βιβλιοθήκη |
| 6 | Scope; | **`company`** (ίδιο με ADR-678) | το υλικό «Δρυς» δεν ανήκει σε ένα έργο — Revit appearance assets = shared. Ίδια απόφαση με το υπάρχον texture import → μηδέν δεύτερη σημασιολογία |
| 7 | Idempotency; | 3 φίλτρα: (α) Nestor DNA (`isUnchangedNestorMaterial`) → skip· (β) `resolveKnownId(name)` → reuse· (γ) content-hash → reuse | δεύτερη εισαγωγή ίδιου μοντέλου = **μηδέν** νέο doc |
| 8 | Έλεγχος χρήστη; | Checkbox στο `ImportedMeshImportDialog`, **default ΟΝ** | το dialog είναι ήδη «ο χρήστης αποφασίζει τι μπαίνει»· 40 υλικά σκηνογραφίας στη βιβλιοθήκη είναι πραγματικός κίνδυνος |
| 9 | Πότε τρέχει; | **ΠΡΙΝ** το `importGltfMeshes` (το αποτέλεσμα περνά ως input) | N.7.2 #1/#2: οι οντότητες γεννιούνται πλήρεις, ΕΝΑ undo, μηδέν race, μηδέν δεύτερο command |
| 10 | Αποτυχία upload; | Per-material isolation (ποτέ throw) — η γεωμετρία μπαίνει ούτως ή άλλως | ADR-678 συμβόλαιο· η εισαγωγή δεν χάνεται επειδή έσπασε μία υφή |

### 4.2 Ρητά ΕΚΤΟΣ πεδίου

- **Καμία** αλλαγή στο render των imported-mesh (2Δ ή 3Δ). Καμία γραφή `faceAppearance`.
- Καμία αυτόματη ανάθεση ΑΤΟΕ/κόστους — `category:'other'`, `atoeCategory:'OIK-77.01'` όπως ADR-678.
- Καμία εξαγωγή normal/roughness/AO maps (μόνο **albedo/baseColorTexture**) — mirror ADR-678 Βήμα 3.
- Καμία retro-ενεργοποίηση για ήδη εισαγμένα μοντέλα (θα ήταν migration· χωριστή απόφαση).

---

## 5. Αρχεία (πλάνο Φ2)

**NEW** (όπως υλοποιήθηκαν)
| Αρχείο | Ρόλος |
|---|---|
| `io/mesh3d-roundtrip/glb-embedded-materials.ts` | **Pure**: GLB (ArrayBuffer) ή glTF (JSON string **ή κείμενο ως bytes**) → `EmbeddedGltfMaterial[]` (index, name, colorHex sRGB, opacity, metalness, roughness, albedo bytes+mime). Μηδέν THREE, μηδέν DOM, δικός του base64 decoder → 100% testable· ποτέ throw |
| `io/mesh3d-material-import/import-embedded-materials.ts` | **DI orchestrator**: `assignUniqueLabels` → `classifyMaterials` (skip/reuse/textured/color-only) → **μία** batch κλήση `importForeignTextures` → color-only creation → `Map<index, bmat_*>` |
| `io/mesh3d-material-import/foreign-texture-deps.ts` | **ΕΝΑ** σημείο καλωδίωσης των `ForeignTextureImporterDeps` με τα SSoT (upload/hash/reachability). Δημιουργήθηκε επειδή ο **δεύτερος** καλών θα έκανε το inline literal structural clone (N.18) |
| `ui/components/imported-mesh/useEmbeddedMaterialImport.ts` | Ο hook που ενώνει τα παραπάνω για το dialog· **ποτέ δεν πετά** (αποτυχία υλικών ≠ αποτυχία γεωμετρίας) |
| `__tests__` × 2 (13 tests) | `glb-embedded-materials` 6/6 · `import-embedded-materials` 7/7 |

**EDIT** (όπως υλοποιήθηκαν)
| Αρχείο | Αλλαγή |
|---|---|
| `io/mesh3d-roundtrip/gltf-scene-parse.ts` | `GltfObjectRecord.materialIndices` + `buildMaterialIndexLookup()` πάνω στο `gltf.parser.associations` (χρησιμοποιεί το τυποποιημένο `GLTFReference` της three — όχι επινοημένο interface) + κοινό `distinctInOrder<T>()` (απέτρεψε τρίτο copy-paste dedup) |
| `io/mesh3d-roundtrip/import-gltf-meshes.ts` | input `materialIdByGltfIndex?` + `resolveEmbeddedMaterialIds()` (dedup, `undefined` όταν κενό → Firestore-safe) |
| `bim/entities/imported-mesh/build-imported-mesh-entity.ts` | `ImportedMeshSource.embeddedMaterialIds` + **ίδιο conditional-spread μοτίβο** με το `materialSlots` |
| `bim/entities/imported-mesh/imported-mesh-types.ts` | νέο optional param `embeddedMaterialIds?: readonly string[]` |
| `bim-3d/ui/scene-material-usage.ts` | **+1 ρητός extractor** (`isImportedMeshEntity` SSoT guard, **μηδέν cast**) + διόρθωση κεφαλίδας σε «ρητά βαμμένα **+ ρητά εισαγμένα**» |
| `ui/components/imported-mesh/ImportedMeshImportDialog.tsx` | checkbox (default ΟΝ, κρύβεται χωρίς scope) + `runMaterialImport()` **πριν** το `importGltfMeshes` |
| `ui/components/C4dMaterialImportButton.tsx` | **Boy Scout (N.0.2):** το inline deps literal → `buildForeignTextureDeps` |
| `io/mesh3d-material-import/import-foreign-textures.ts` | μόνο `export` της `IMPORTED_TEXTURE_ATOE_CATEGORY` (κοινή ΑΤΟΕ κατηγορία, μηδέν δεύτερο literal) |
| `i18n el+en/dxf-viewer-shell.json` | 4 κλειδιά `importMeshes.extractMaterials*` / `materialsExtracted` (N.11: πρώτα τα locales) |

**ΑΜΕΤΑΒΛΗΤΑ (κρίσιμο):** `imported-mesh-material-enhance.ts`, `imported-mesh-to-three.ts`,
`useSceneMaterials.ts`, `material-library-index.ts`, `MaterialLibraryService`,
`import-foreign-textures.ts`, `apply-imported-mesh-material-map.ts`, `collada-to-glb.ts`.

---

## 6. Google-level checklist (N.7.2)

| # | Ερώτημα | Απάντηση |
|---|---|---|
| 1 | Proactive/reactive; | **Proactive** — τα υλικά δημιουργούνται τη στιγμή της εισαγωγής, όχι με side-effect |
| 2 | Race condition; | **Όχι** — η extraction ολοκληρώνεται **πριν** χτιστούν οι οντότητες· μία γραφή |
| 3 | Idempotent; | **Ναι** — τριπλό φίλτρο (§4.1 #7)· δεύτερο import = 0 νέα docs |
| 4 | Belt & suspenders; | **Ναι** — per-material isolation· αποτυχία extraction ≠ αποτυχία εισαγωγής γεωμετρίας |
| 5 | SSoT; | **Ναι** — `bim_materials` = ιδιοκτήτης των υλικών· η οντότητα κρατά **μόνο ids** |
| 6 | await ή fire-and-forget; | **await** (η ορθότητα του `embeddedMaterialIds` εξαρτάται από αυτό) |
| 7 | Ποιος κατέχει τον κύκλο ζωής; | **Ρητά** ο `ImportedMeshImportDialog` (ήδη ο ιδιοκτήτης της εισαγωγής) |

---

## 7. Test anchors (Φ2)

1. `glb-embedded-materials`: GLB με 2 υλικά (1 textured, 1 flat) → σωστά index/όνομα/hex/bytes· glTF JSON με data-URI· κατεστραμμένο container → `[]` ποτέ throw.
2. `import-embedded-materials`: (α) Nestor DNA → skip· (β) γνωστό όνομα → reuse, 0 saves· (γ) ίδια bytes σε 2 υλικά → 1 `bmat_*`· (δ) color-only → `appearance` σωστό· (ε) αποτυχία upload ενός → τα υπόλοιπα περνούν.
3. `scene-material-usage`: imported-mesh με `embeddedMaterialIds` → μπαίνουν στο `materialIds`· χωρίς → αμετάβλητο (back-compat).

---

## 8. Changelog

- **2026-07-24 — Φ1 (ΠΛΑΝΟ):** SSoT audit + ADR. Κύριο εύρημα: ο δρόμος «βάψε τις όψεις» (§3.α) που
  πρότεινε το handoff **απορρίπτεται μετρημένα** — το `resolveSlotMaterial` αντικαθιστά ΟΛΟΚΛΗΡΟ το
  embedded material και η σύμβαση world-meter UV της βιβλιοθήκης θα κατέστρεφε τα authored UVs του
  ξένου μοντέλου. Επιλέγεται η προαγωγή-χωρίς-βαφή (§3.β), που είναι και η πρακτική Revit/ArchiCAD/C4D.
  Δεύτερο εύρημα: το join πρέπει να γίνει με **glTF material index**, όχι όνομα (ανώνυμα υλικά).
  🔴 Αναμονή έγκρισης Giorgio (N.8) πριν τη Φ2.
- **2026-07-24 — Φ2 DONE (υλοποίηση):** ο Giorgio επέλεξε **orchestrator**· η δουλειά έτρεξε σε **5
  παράλληλους agents** με **καρφωμένα συμβόλαια τύπων εκ των προτέρων** (pure extractor · parse+
  plumbing · collector · DI orchestrator · i18n) και partition **ανά αρχείο** ώστε να μη συγκρουστούν
  στο κοινό working tree. Τα δύο σημεία συναρμογής (dialog + deps wiring) γράφτηκαν κεντρικά.
  Αποτέλεσμα: **418/418 jest** σε 38 suites (καμία παλινδρόμηση σε OBJ/DAE/glTF round-trip, σκάλα,
  κάγκελο, BOQ), **jscpd καθαρό** σε 12 αρχεία.
  - **3 διορθώσεις κατά τη συναρμογή:** (1) `.gltf` **κείμενο διαβασμένο ως bytes** επέστρεφε σιωπηλά
    μηδέν υλικά (ο caller κρατά `File`, δεν ξέρει αν είναι binary ή JSON) → `parseAnyContainer`
    fallback· (2) ο collector είχε ακόμη τοπικό cast για το param που έγραφε παράλληλος agent →
    αντικαταστάθηκε με τον πραγματικό `ImportedMeshEntity` (μηδέν cast, N.2)· (3) Boy Scout N.0.2 —
    κεντρικοποίηση του deps literal που ο δεύτερος καλών θα είχε κλωνοποιήσει.
  - **Απόφαση που άλλαξε στην πράξη:** καμία. Και τα 10 σημεία του §4.1 υλοποιήθηκαν όπως γράφτηκαν.

- **2026-07-24 — Φ3 (browser ground truth → «γιατί είναι όλα γκρι;»):** ο Giorgio εισήγαγε το
  `abricos_gerbera` και τα 6 υλικά **μπήκαν σωστά**, αλλά στη μπάρα «Υλικά όψης» μόνο το κόκκινο
  βάζο είχε χρώμα. Query στο `bim_materials` (ground truth, όχι εικασία) έδειξε τον διαχωρισμό:

  | υλικό | `appearance` | `albedoUrl` | swatch |
  |---|---|---|---|
  | Mat.2 / Mat.3 / Mat #4 (color-only) | ✅ `#e83030` / `#ffffff` / `#cccccc` | — | σωστό |
  | Mat.1 / Mat / Scene_Material3 (textured) | **null** | ✅ | **γκρι** |

  **Δύο αιτίες, και οι δύο πραγματικές:**
  1. Τα textured περνούν από το `importForeignTextures` (ADR-678, reused αυτούσιο) που ξέρει **μόνο
     από υφές** → `appearance: null` → το swatch έπεφτε στο χρώμα κατηγορίας `other` = γκρι.
  2. **Το χρώμα του αρχείου δεν σώζει:** ο C4D γράφει `Color 204,204,204` και αφήνει το πορτοκαλί
     στο `Abricos_full_color.jpg` (φαίνεται στο ίδιο το C4D UI του screenshot). Άρα το glTF
     `baseColorFactor` **δεν είναι** το χρώμα ενός textured υλικού — ποτέ.
  3. Επιπλέον, στο `MaterialSwatch` η **γκρι σφαίρα-fallback προηγούνταν του πραγματικού albedo**,
     οπότε δεν φαινόταν ούτε καν η φωτογραφία της υφής.

  **Λύση (πρακτική Revit «image appearance asset» / C4D Material Manager preview):** το «χρώμα» ενός
  textured υλικού είναι ο **μέσος όρος της υφής του**.
  - **NEW** `io/mesh3d-material-import/texture-average-color.ts` — `averageColorHexOfImage` (16×16
    downsample, αγνοεί διάφανα pixel· `createImageBitmap`+`OffscreenCanvas`, μηδέν dependency).
    Injected probe → ο orchestrator μένει testable χωρίς DOM.
  - **EDIT** `import-embedded-materials.ts` — `paintTexturedAppearance`: patch `appearance` **μόνο
    στα νεοδημιουργημένα** (ένα reused υλικό μπορεί να έχει χρώμα που όρισε ο χρήστης — ποτέ overwrite).
  - **EDIT** `MaterialSwatch.tsx` — μια σφαίρα **χωρίς appearance ΚΑΙ χωρίς φορτωμένη υφή** δεν
    προηγείται πια του πραγματικού albedo. **Αυτό διορθώνει και τα ΗΔΗ δημιουργημένα** υλικά
    (δείχνουν τη φωτογραφία της υφής τους) χωρίς migration.
  - +6 tests (4 orchestrator Φ3 + 2 swatch). 194/194 πράσινα σε 21 suites· jscpd καθαρό.
  - ⚠️ **Τα 3 υπάρχοντα textured `bmat_*` δεν αποκτούν `appearance` αναδρομικά** (το re-import τα
    βρίσκει by-name → reuse). Θέλουν διαγραφή+επανεισαγωγή αν χρειάζεται το χρώμα και στο 2Δ.

---

## 9. 🔴 Τι πρέπει να ελεγχθεί στον browser (Giorgio)

Δοκιμαστικό: `abricos_gerbera.dae` + τα 3 jpg (το ίδιο του ADR-690) **και** ένα `.glb` με υφές.

| # | Έλεγχος | Αναμενόμενο |
|---|---|---|
| 1 | Το dialog εισαγωγής | Νέο checkbox «Εισαγωγή υλικών στη βιβλιοθήκη», **τσεκαρισμένο** |
| 2 | Μετά την εισαγωγή | Toast «Δημιουργήθηκαν N υλικά, M επαναχρησιμοποιήθησαν» |
| 3 | **Η όψη του μοντέλου** | **ΑΜΕΤΑΒΛΗΤΗ** — ίδια υφή/χρώμα με το ADR-690 (αν άλλαξε κάτι, κάτι βάφτηκε: bug) |
| 4 | Κάτω μπάρα «Υλικά όψης» | Εμφανίζονται τα υλικά του μοντέλου |
| 5 | Βιβλιοθήκη (Ν.1) | Τα ίδια υλικά ως `bmat_*` company scope, με τη σωστή υφή στο swatch |
| 6 | Drag υλικού σε τοίχο | Βάφει κανονικά (η υφή τότε ακολουθεί τη σύμβαση world-meter UV — αναμενόμενο) |
| 7 | **Δεύτερη εισαγωγή** ίδιου αρχείου | Toast «0 νέα, N επαναχρησιμοποιήθησαν» — **κανένα διπλότυπο** στη βιβλιοθήκη |
| 8 | Reload | Τα `embeddedMaterialIds` persist → η μπάρα δείχνει τα ίδια υλικά |
