# ADR-694 — Κηδεμονία αρχείων Storage (fail-safe GC) + ταυτότητα υλικού εισαγόμενου πλέγματος

**Status:** IMPLEMENTED — Α/Β/Γ/Δ/Ε deployed & browser-verified · **Ζ/Φ10 committed (`253a8e35`)**
**Ημερομηνία:** 2026-07-25
**Σχετικά:** ADR-031 (canonical files), ADR-312 (showcase PDFs), ADR-413 §2D (PBR υφές), ADR-678
(C4D round-trip), ADR-683 §11 (imported meshes ownership), ADR-687 Φ8 (βιβλιοθήκη υλικών),
ADR-691 (embedded material extraction), ADR-693 (ghost + material fallback)

---

## 1. ΤΟ ΣΥΜΠΤΩΜΑ (Giorgio, browser 2026-07-25 00:09)

Μοντέλο: μπολ με βερίκοκα + λουλούδι σε κόκκινο βάζο (εισαγόμενο `.dae` → `.glb`).

1. Στη μπάρα «Υλικά όψης» τα **πορτοκαλί** (βερίκοκα) και **πράσινα** (φύλλα) υλικά εμφανίζονται
   ως λευκά/γκρι πλακίδια.
2. Με επιλεγμένο το **κόκκινο βάζο**, το αριστερό panel «Τρέχον υλικό» δείχνει σωστή ετικέτα
   «Mat.2» αλλά **γκρι** εικονίδιο — ενώ η κάτω μπάρα δείχνει το ίδιο `Mat.2` **κόκκινο**.

---

## 2. GROUND TRUTH — ΜΕΤΡΗΜΕΝΟ (2026-07-25)

### 2.1 Τι ΑΠΟΡΡΙΦΘΗΚΕ τεκμηριωμένα

Το handoff είχε ως **#1 υποψία** ότι «δεν έχει γίνει ποτέ `firebase deploy --only storage`».
**Λάθος.** Μετρημένο μέσω Firebase Rules API:

```
projects/pagonis-87766/releases/firebase.storage/pagonis-87766.firebasestorage.app
  ruleset 170a94a2-965c-41df-b9b6-7e48f02d64d0   updateTime 2026-07-20T19:24:44Z
```

Το deployed ruleset είναι **byte-identical** με το τοπικό `storage.rules`
(md5 `9015eb2eb9d5f28feb61f1485e4f1ba8`, 30.502 chars) και **περιέχει** το
`bim-material-textures` match. Τα storage rules ΔΕΝ ευθύνονται.

Επίσης λύθηκε το caveat §1.3 του handoff: `gs://pagonis-87766.firebasestorage.app` είναι ο
**μοναδικός** bucket· το legacy `.appspot.com` επιστρέφει **404**.

### 2.2 Η ΠΡΑΓΜΑΤΙΚΗ αιτία — τα αρχεία ανέβηκαν και ΔΙΑΓΡΑΦΗΚΑΝ

Το upload **ποτέ δεν απέτυχε**. Κάθε albedo ανέβηκε κανονικά (8 generations, 108.012 bytes
σταθερά) και **διαγράφηκε 16–18 δευτερόλεπτα αργότερα**, κάθε φορά:

```
created 2026-07-24T18:38:01.540Z → DELETED 2026-07-24T18:38:18.027Z
created 2026-07-24T18:39:15.510Z → DELETED 2026-07-24T18:39:31.786Z
…
created 2026-07-24T20:40:52.596Z → DELETED 2026-07-24T20:41:10.648Z
```

Ο δράστης, από τα Cloud Function logs (**όχι υπόθεση — κυριολεκτικό log entry**):

```
2026-07-24T20:41:10.535Z  WARNING  onStorageFinalize
«Orphan file detected — no ownership claim in any provider. Deleting.»
companies/…/bim-material-textures/bmat_34929e3b-…/albedo.jpg
```

**Μηχανισμός** (`functions/src/storage/orphan-cleanup.ts`):

| Βήμα | Κώδικας | Αποτέλεσμα για το texture path |
|---|---|---|
| 1 | `if (!filePath.startsWith('companies/')) return` | περνά — είναι company-scoped |
| 2 | `fileId = fileName.split('.')[0]` | `albedo.jpg` → **`"albedo"`** |
| 3 | `findFileOwnerWithGrace('albedo')` σε 3 providers | κανένα claim |
| 4 | grace `[2000,4000,6000]` + 4 Firestore lookups | **≈16–18s** ← ταιριάζει ακριβώς |
| 5 | `bucket.file(filePath).delete()` | **το αρχείο σβήνεται** |

Το `assertTextureDurable` (verify-after-write, ADR-678) **δεν φταίει και δεν μπορούσε να το
πιάσει**: επαληθεύει τη στιγμή του upload, 16 δευτερόλεπτα πριν τη διαγραφή.

### 2.3 BLAST RADIUS — 61 νόμιμα αρχεία σε 4 υποσυστήματα / 13 ημέρες

Από `gcloud logging read` (45 ημέρες), ομαδοποιημένα:

| Ημερομηνία | Υποσύστημα | Αρχεία | Κατάσταση |
|---|---|---|---|
| 12/07 | `bim-material-thumbnails/` | 3 | 🔴 φάκελος **άδειος** |
| 18–21/07 | `block-library/` | 10 | 🔴 φάκελος **άδειος** |
| 20–22/07 | `projects/…/imported-meshes/` | 20 | ✅ σταμάτησαν μετά το ADR-683 §11 provider |
| 21/07 + 24/07 | `bim-material-textures/` | 28 | 🔴 φάκελος **άδειος** |

**Δεύτερο επιβεβαιωμένο θύμα (δεν το είχε εντοπίσει κανείς):** το Firestore `block_library`
κρατά το μπλοκ «Πόρτα 01» (`blklib_13697df4-…`) με έγκυρο `geometryUrl`, αλλά το αρχείο
γεωμετρίας του **έχει διαγραφεί** → **μη-τοποθετήσιμο μπλοκ** στο palette. Ίδια ακριβώς κλάση
σφάλματος με τα γκρι swatches.

**Το μοτίβο:** το ADR-683 §11 απέδειξε ότι το provider-patching δουλεύει *για το ένα path που
διορθώνεις* και αφήνει τα υπόλοιπα εκτεθειμένα. Είναι το **3ο incident της ίδιας κλάσης**
(2026-04-17 showcase PDFs → ADR-312· 2026-07-22 imported meshes → ADR-683 §11· 2026-07-24
textures/blocks/thumbnails). Κάθε νέο υποσύστημα που γράφει αρχεία χάνει σιωπηλά τα δεδομένα
του μέχρι κάποιος να προσθέσει τον επόμενο provider.

### 2.4 Εκτεθειμένα paths (SSoT `services/upload/utils/storage-path-bim.ts`)

| Path | `fileId` που εξάγεται | Κατάσταση |
|---|---|---|
| `bim-material-textures/{id}/{map}.{ext}` | `"albedo"` | 🔴 28 διαγραφές |
| `block-library/{blockId}.json` | `blklib_…` | 🔴 10 διαγραφές |
| `bim-material-thumbnails/{id}.{ext}` | `bmat_…` | 🔴 3 διαγραφές |
| `bim_environments/{envId}.{ext}` | `envId` | ⚠️ εκτεθειμένο |
| `bim_animations/{id}/renders/{jobId}` | `jobId` | ⚠️ εκτεθειμένο |
| `engineer-stamps/{userId}.{ext}` | `userId` | ⚠️ εκτεθειμένο |
| `quotes/{quoteId}/portal-{fileId}.{ext}` | `portal-…` | ⚠️ εκτεθειμένο |
| `projects/…/imported-meshes/{uploadId}.glb` | `uploadId` | ✅ provider ADR-683 |

### 2.4β Ο συναγερμός που έπρεπε να μας σώσει ήταν **νεκρός** (νέο εύρημα)

Το ADR-327 όρισε **Layer 3**: `orphanSpikeAlert`, ωριαίο, στέλνει Telegram όταν οι
`ORPHAN_FILE_DELETED` εγγραφές ξεπεράσουν το κατώφλι (5). Στις 24/07 έγιναν **25**
διαγραφές — πενταπλάσιες του κατωφλιού — και **δεν χτύπησε ποτέ**.

Αιτία, από τα logs:

```
2026-07-24T21:00:09.513Z  orphanSpikeAlert
Error: 9 FAILED_PRECONDITION: The query requires an index.
  audit_log (action ASC, performedAt ASC)
```

Ο **producer δούλευε σωστά** — το `audit_log` περιέχει κανονικά τις εγγραφές. Ο
**consumer** έσκαγε σε κάθε εκτέλεση, επειδή το composite index δεν είχε δηλωθεί ποτέ
στο `firestore.indexes.json` (υπάρχουν `file_audit_log` και `accounting_audit_log`, όχι
`audit_log`). Το σκάσιμο συνέβη **19 λεπτά μετά** τις διαγραφές — ακριβώς τη στιγμή που
όφειλε να ειδοποιήσει.

**Μάθημα (ίδιο με ADR-587 §6.1):** ένα safety net χωρίς δικό του gate δεν είναι safety
net — είναι σχόλιο. Και τα τρία επίπεδα του ADR-327 απέτυχαν ταυτόχρονα: Layer 1
(providers) δεν κάλυπτε το νέο υποσύστημα, Layer 2 (grace window) ήταν 12 δευτερόλεπτα,
Layer 3 (alert) δεν εκτελέστηκε ποτέ επιτυχώς.

### 2.5 Το πρόβλημα Α (αριστερό panel) — ταυτότητα, όχι εμφάνιση

`resolve-entity-current-material.ts:109 resolveEntityMaterialIdSet` διαβάζει **μόνο**
`faceAppearance` (δηλ. ρητά overrides βαφής). Το ADR-691 §3.α **σκόπιμα ΔΕΝ βάφει** τη
γεωμετρία του εισαγόμενου πλέγματος → 0 overrides → `entry === undefined` →
`ImportedMeshAdvancedPanel.tsx:215-224` περνά **όλα** τα props του `MaterialSwatch` ως
`undefined` → ουδέτερο γκρι. Η ετικέτα «Mat.2» έρχεται από άλλη πηγή (`sourceName`), γι' αυτό
το panel δείχνει **σωστό όνομα με λάθος εικονίδιο**.

Η γέφυρα **υπάρχει ήδη**: `params.embeddedMaterialIds` (ADR-691), το οποίο ο συλλέκτης σκηνής
`bim-3d/ui/scene-material-usage.ts:111` ήδη καταναλώνει. Δεν χρειάζεται νέος resolver.

### 2.6 Δύο κενά που κρατούν το πρόβλημα ζωντανό ακόμη και μετά τη διόρθωση του GC

- **`import-embedded-materials.ts:259`** — το by-name reuse (`resolveKnownId`) τρέχει **πριν**
  από οποιονδήποτε έλεγχο υγείας, με `continue` που παρακάμπτει εντελώς το
  `importForeignTextures`. Άρα ένα υπάρχον υλικό με σπασμένο albedo **ούτε θεραπεύεται ούτε
  αποκτά `appearance`**, όσες φορές κι αν γίνει re-import (sticky).
  Το **DAE μονοπάτι το έχει ήδη λύσει**: `import-collada-appearance.ts:41
  foreignAndBrokenTextures` → `repairIds`. Το GLB μονοπάτι απλώς δεν το χρησιμοποιεί.
  → **επαναχρησιμοποιήσιμο SSoT, όχι νέος κώδικας** (N.18).
- **`paintTexturedAppearance`** βάφει `appearance` **μόνο** στα `freshlyCreated` → τα 4
  υπάρχοντα textured υλικά μένουν `appearance: null` για πάντα (γνωστό ανοιχτό ADR-691 §9).

Ground truth Firestore (`bim_materials`, `category=='other'`):

| nameEl | `appearance` | `pbrTextures.albedoUrl` |
|---|---|---|
| `Mat.1` / `Mat` / `Mat#ID12` / `Scene_Material3` | **null** | ✅ (δείχνει σε διαγραμμένο αρχείο) |
| `Mat.2` | `{#e83030, op 0.64}` | null |
| `Mat.3` / `Mat #4` | `{#ffffff}` / `{#cccccc}` | null |

---

## 3. ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ (τεκμηριωμένη έρευνα, με πηγές)

### 3.1 Garbage collection πάνω σε object storage

| Μηχανισμός | Ποιος | Πηγή |
|---|---|---|
| **`ownerReferences`**: dependent σβήνεται **μόνο** όταν η αναφορά είναι **σπασμένη** (owner UID δεν υπάρχει πια). Object **χωρίς καμία** owner reference **δεν αγγίζεται ΠΟΤΕ** | Kubernetes GC | [k8s.io/docs/concepts/architecture/garbage-collection](https://kubernetes.io/docs/concepts/architecture/garbage-collection/) |
| Soft/lazy deletion 15–60 ημέρες· ρητή σύσταση «**hinder developers from circumventing soft deletion**» | Google (SRE Book) | [sre.google/sre-book/data-integrity](https://sre.google/sre-book/data-integrity/) |
| Mark-and-sweep **υποχρεωτικά σε read-only mode** — αλλιώς «risk that layers are mistakenly deleted» | Docker/OCI Registry | [distribution.github.io/…/garbage-collection](https://distribution.github.io/distribution/about/garbage-collection/) |
| GC **daily batch**, DB-first (πρώτα καθαρίζονται invalid refs, μετά τα αρχεία) | GitLab LFS | [docs.gitlab.com/administration/raketasks/cleanup](https://docs.gitlab.com/administration/raketasks/cleanup/) |
| Mark (unreferenced) ≠ Sweep (ανάκτηση χώρου) — δύο ασύγχρονα στάδια | Dropbox Magic Pocket | [dropbox.tech/…/magic-pocket](https://dropbox.tech/infrastructure/improving-storage-efficiency-in-magic-pocket-our-immutable-blob-store) |
| Ακόμη και το «ξεκάθαρα ορφανό» (ημιτελές multipart upload) παίρνει **7 ημέρες**, όχι δευτερόλεπτα | AWS S3 | [docs.aws.amazon.com/…/mpu-abort-incomplete-mpu-lifecycle-config](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html) |
| Το ίδιο ακριβώς antipattern (`onFinalize` auto-delete με μικρό grace) είναι **τεκμηριωμένο reproducible race condition** στο Firebase ecosystem | community repro | [github.com/SvenSlijkoord/firebase-storage-functions-race-condition](https://github.com/SvenSlijkoord/firebase-storage-functions-race-condition) |

**Το κρίσιμο συμπέρασμα:** σε **κανένα** ώριμο σύστημα η *απουσία* απόδειξης ιδιοκτησίας δεν
συνιστά άδεια διαγραφής. Διαγράφεται μόνο ό,τι έχει **θετική απόδειξη ορφανότητας** (σπασμένη
αναφορά), και πάντα με retention window ημερών.

### 3.2 Χαμένο asset υφής — κανείς δεν αποτυγχάνει σιωπηλά

| Εργαλείο | Συμπεριφορά | Πηγή |
|---|---|---|
| **Revit** | **κόκκινο swatch + θαυμαστικό (!)** + tooltip με το path αναζήτησης· warning στο render | [autodesk.com/support/…/Missing-Material-Appearance-in-Revit](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Missing-Material-Appearance-in-Revit.html) |
| **ArchiCAD** | κόκκινο εικονίδιο στον Attribute Manager (⚠️ μόνο community πηγές) | [community.graphisoft.com](https://community.graphisoft.com/t5/Libraries-objects/Missing-surface-image-that-s-not-listed-in-Surface-Attribute/td-p/688598) |
| **Cinema 4D** | Project Asset Inspector: φίλτρο `Status=Missing` + **batch relink** | [novedge.com/…/project-asset-inspector](https://novedge.com/blogs/design-news/cinema-4d-tip-project-asset-inspector-find-relink-and-consolidate-external-assets) |
| **Blender** | **magenta** — ρητά «panic color for images» στο ίδιο τους το bug tracker | [projects.blender.org/blender/blender/issues/107016](https://projects.blender.org/blender/blender/issues/107016) |
| **Unreal / Unity** | magenta / checkerboard (⚠️ μόνο community πηγές) | — |

**Κανόνας:** *fail loud, fail visible, fail actionable*. Το σημερινό μας `onError → flat colour
chip` (ADR-693 Γ3) δίνει **χρώμα** αλλά **δεν λέει ποτέ ότι λείπει κάτι** — γι' αυτό ο Giorgio
έκανε 8 imports χωρίς να αντιληφθεί ότι σβήνονταν αρχεία.

### 3.3 Αντιπροσωπευτικό χρώμα υφής — ο σημερινός υπολογισμός είναι μαθηματικά λάθος

Το `texture-average-color.ts` κάνει μέσο όρο **απευθείας σε sRGB**. Τεκμηριωμένο σφάλμα: sRGB
128 δεν είναι 50% φως αλλά **~21.8%** linear → το αποτέλεσμα βγαίνει σκουρότερο/«λασπωμένο».
Το σφάλμα εισάγεται **δύο φορές**, γιατί και το `drawImage` downscale φιλτράρει σε sRGB.

Σωστό (BlurHash σε production· NVIDIA GPU Gems 3 κεφ.24· LearnOpenGL):
**sRGB → linear → μέσος όρος → πίσω σε sRGB**.

- [BlurHash Algorithm.md](https://github.com/woltapp/blurhash/blob/master/Algorithm.md) — «virtually
  all image processing algorithms assume linearly encoded light intensities»
- [GPU Gems 3, Ch.24 — The Importance of Being Linear](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-24-importance-being-linear)
- Alpha: premultiplied-aware· πλήρως διαφανή pixels αγνοούνται
  ([iquilezles.org/articles/premultipliedalpha](https://iquilezles.org/articles/premultipliedalpha/))

⚠️ **Δηλωμένη αβεβαιότητα:** ΔΕΝ επαληθεύτηκε ότι Revit/ArchiCAD/C4D υπολογίζουν καθόλου μέσο
χρώμα από pixels. Εδώ **δεν αντιγράφουμε — πρωτοπορούμε**, άρα αξίζει να γίνει σωστά.

---

## 4. ΑΠΟΦΑΣΕΙΣ

### Α — ΚΗΔΕΜΟΝΙΑ (custody): ο GC αντιστρέφεται σε Kubernetes-style fail-safe

**Α1. Ο `onStorageFinalize` ΠΑΥΕΙ ΟΡΙΣΤΙΚΑ να διαγράφει αρχεία.**
Απουσία claim ⇒ **δεν** είναι απόδειξη ορφανότητας. Γίνεται **mark-only**: καταγράφει υποψήφιο
σε `storage_orphan_candidates` (path, fileId, contentType, size, firstSeenAt) + log. Μηδέν
`delete()` σε real-time μονοπάτι. Αυτό μόνο του κλείνει **και τα 7** εκτεθειμένα paths ταυτόχρονα
και κάνει το 4ο incident **αδύνατο**, όχι απλώς λιγότερο πιθανό.

**Α2. Path-custody SSoT** — `functions/src/storage/storage-path-custody.ts` (ΝΕΟ).
ΕΝΑ μητρώο που απαντά «ποιος κατέχει αυτό το path και πώς αποδεικνύεται η ιδιοκτησία;»,
αντικαθιστώντας την υπόθεση «fileId = basename» που ίσχυε σιωπηλά παντού. Τρεις κατηγορίες:
`file-record` (ADR-031), `entity-owned` (claim σε πεδίο οντότητας), `library-owned`
(doc-id-keyed). Άγνωστο path → `unknown` → **ποτέ διαγραφή**, μόνο αναφορά.

**Α3. Sweeper με θετική απόδειξη ορφανότητας** — `functions/src/storage/orphan-sweeper.ts` (ΝΕΟ),
scheduled (ημερήσιο). Σβήνει υποψήφιο **μόνο** αν ΟΛΑ ισχύουν:
(α) το path ανήκει σε **γνωστή** custody κατηγορία, (β) η αναφορά είναι **σπασμένη** (ο owner
έχει όντως διαγραφεί / δεν υπήρξε ποτέ), (γ) έχουν περάσει **≥7 ημέρες** από το `firstSeenAt`,
(δ) ο έλεγχος επαναλαμβάνεται τη στιγμή της διαγραφής. Αλλιώς → παραμένει, με log.

**Α4. Bucket soft-delete** — ήδη ενεργό (7 ημέρες, `retentionDurationSeconds: 604800`).
Τεκμηριώνεται ρητά ως το τελευταίο δίχτυ και **δεν** απενεργοποιείται.

**Α5. Ανάσταση του ADR-327 Layer 3** — δηλώνεται το composite index
`audit_log (action ASC, performedAt ASC)` στο `firestore.indexes.json`, ώστε ο
`orphanSpikeAlert` να εκτελείται επιτέλους. Απαιτεί
`firebase deploy --only firestore:indexes`. Δηλώνεται επίσης το
`storage_orphan_candidates (custodyKind ASC, firstSeenAt ASC)` που χρειάζεται ο sweeper.

### Β — ΟΡΑΤΟΤΗΤΑ: fail loud (Revit/Blender συμβόλαιο)

**Β1.** Το `MaterialSwatch` κρατά το flat-colour fallback (ADR-693 Γ3 — σωστό) αλλά αποκτά
**ορατό badge** «λείπει η υφή» όταν η εικόνα αποτύχει, με tooltip που ονομάζει το asset.
Ποτέ ξανά σιωπηλή αποτυχία.

**Β2.** Αυτό μας κάνει **καλύτερους από τους μεγάλους**: κανένα από τα 5 εργαλεία δεν
συνδυάζει ταυτόχρονα (α) οπτική ένταση, (β) actionable tooltip με ταυτότητα asset, (γ)
αυτόματη επιδιόρθωση. Έχουμε ήδη το (γ) στο DAE μονοπάτι — μένει να επεκταθεί (Γ1).

### Γ — ΘΕΡΑΠΕΙΑ & ΧΡΩΜΑ

**Γ1.** `import-embedded-materials.ts`: το by-name reuse περνά από **έλεγχο υγείας** πριν το
`continue`, με **επαναχρησιμοποίηση** του υπάρχοντος `foreignAndBrokenTextures` προτύπου
(`repairIds`) — μηδέν sibling clone (N.18).

**Γ2.** `paintTexturedAppearance`: τα **reused** textured υλικά χωρίς `appearance` το αποκτούν
(backfill). Ποτέ δεν πατιέται υπάρχον `appearance` που όρισε ο χρήστης.

**Γ3.** `texture-average-color.ts`: **gamma-correct** μέσος όρος (sRGB→linear→mean→sRGB),
premultiplied-alpha aware. Τεκμηριωμένα σωστό, ήδη ανώτερο από κάθε επαληθευμένη πρακτική.

### Δ — ΤΑΥΤΟΤΗΤΑ ΕΙΣΑΓΟΜΕΝΟΥ ΠΛΕΓΜΑΤΟΣ (πρόβλημα Α)

**Δ1.** Επέκταση του υπάρχοντος `resolve-entity-current-material.ts` με «τρέχον υλικό **όπως
το βλέπει ο renderer**»: ρητό override → αλλιώς **embedded** (`params.embeddedMaterialIds`).
ΕΝΑΣ resolver, καμία δεύτερη υλοποίηση — ίδια πηγή με το `scene-material-usage.ts`, ώστε panel
και κάτω μπάρα να μη διαφωνούν ποτέ. Revit «Imported Material : X» συμβόλαιο.

### Ε — BACKFILL

**Ε1.** Ανάκτηση από soft-delete (λήγει **31/07**) — 4 υφές + 1 γεωμετρία μπλοκ:

```
bmat_34929e3b…/albedo.jpg  gen 1784925652590639   108.012 B
bmat_af231b75…/albedo.jpg  gen 1784925654418434   200.385 B
bmat_ed26cea2…/albedo.jpg  gen 1784925656038990   148.851 B
bmat_6c10a05b…/albedo.png  gen 1784921582760569 1.590.584 B
block-library/blklib_13697df4-4b38-4e8b-8dc4-8a44f9bb7814.json
```

**ΥΠΟΧΡΕΩΤΙΚΗ ΣΕΙΡΑ:** πρώτα deploy του Α1, μετά restore. Αντίστροφα, ο GC θα τα ξανασβήσει.
Τα υπάρχοντα download tokens παραμένουν έγκυρα → τα swatches ζωντανεύουν χωρίς re-import.

### Ζ — Φ10: ΕΝΟΠΟΙΗΣΗ ΤΗΣ ΣΥΝΑΡΤΗΣΗΣ ΜΕΤΑΦΟΡΑΣ sRGB

Το Γ3 δημιούργησε το `srgb-linear-unit.ts` σε **λάθος φάκελο** (`io/mesh3d-material-import/`, δίπλα
σε έναν importer) ενώ **υπήρχε ήδη** κεντρικό `config/color-math.ts` (25 καταναλωτές) με το ίδιο
μαθηματικό μέσα του. Δηλαδή το Γ3 **αύξησε** τη διασπορά αντί να τη μειώσει.

#### Ζ0. ΔΙΟΡΘΩΣΗ ΤΟΥ GROUND TRUTH — το «δύο σωστά πρότυπα» ΔΕΝ ισχύει

Η αρχική καταγραφή (handoff Φ10 §2/§3) έλεγε ότι οι δύο σταθερές που βρέθηκαν στον κώδικα
(`0.03928` και `0.04045`) είναι **και οι δύο σωστές**, για διαφορετικό πρότυπο — `0.03928` «ό,τι
γράφει ρητά το WCAG 2.x», `0.04045` το IEC 61966-2-1. **Αυτό είναι λάθος, και ήταν λάθος από το
2021.** Από την ίδια την κανονιστική σελίδα του W3C:

> «Before May 2021 the value of **0.04045** in the definition was different (0.03928). It was taken
> from an older version of the specification and has been updated.»
> — <https://www.w3.org/WAI/WCAG22/Understanding/relative-luminance.html>

Άρα δεν υπάρχουν δύο πρότυπα: υπάρχει **ένα** (IEC 61966-2-1, `0.04045`) και ένα **τυπογραφικό
λάθος που το W3C απέσυρε**. Το `0.03928` στον κώδικά μας ήταν απλώς μπαγιάτικο.

*(Μοτίβο ήδη καταγεγραμμένο στο CLAUDE.md N.12: αριθμός αντιγράφηκε σε handoff → σε ανάλυση →
σε συμπέρασμα, χωρίς κανείς να ανοίξει την πηγή. Άνοιξε την πηγή.)*

#### Ζ1. Η απόφαση — ΕΝΑ primitive, ΜΙΑ σταθερά, ΔΥΟ στρώματα

Ο πυρήνας του αρχικού σκεπτικού **στέκει**: WCAG contrast και χρωματομετρία είναι διαφορετικά
*συμβόλαια* (αν αύριο περάσουμε σε APCA/WCAG 3, το πρώτο αλλάζει ριζικά, το δεύτερο ποτέ). Αυτό
όμως επιβάλλει **χωριστές συναρτήσεις**, όχι χωριστό αντίγραφο των ίδιων μαθηματικών:

- `srgbToLinearUnit` / `linearToSrgbUnit` = **χρωματομετρία** (EOTF/OETF, IEC 61966-2-1)
- `srgbRelativeLuminance` / `contrastRatio` / `contrastRatioRgb` = **WCAG**, χτισμένα **πάνω** στο EOTF

Ίδια δομή με τους μεγάλους: το **colorjs.io** (των editors του CSS Color spec) και το **three.js**
έχουν **ένα** ζεύγος μεταφοράς και παράγουν το WCAG luminance από αυτό — δεν κρατούν δεύτερο
αντίγραφο με το αποσυρμένο `0.03928`.

#### Ζ2. Η αλλαγή είναι ΜΕΤΡΗΜΕΝΑ μηδενικού ρίσκου

Για **κάθε** ακέραιο κανάλι `0..255` οι δύο σταθερές δίνουν **bit-for-bit ταυτόσημο** αποτέλεσμα:

```
bytes που διαφέρουν (0..255):  []      ← ΚΑΝΕΝΑ
max |ΔL| ανά κανάλι:           0.000
```

Ο λόγος είναι αριθμητικός: byte 10 → `0.039216` (**κάτω** κι από τα δύο κατώφλια)· byte 11 →
`0.043137` (**πάνω** κι από τα δύο). Κανένα byte δεν πέφτει στη ζώνη διαφωνίας `(0.03928, 0.04045]`,
άρα κανένα δεν αλλάζει κλάδο. Ισχύει και για τους 25 καταναλωτές του `color-math`.

Αυτό **δεν** μένει σχόλιο: το `config/__tests__/color-math-srgb-transfer.test.ts` κρατά τη **παλιά**
υλοποίηση ως μάρτυρα και απαιτεί ταυτότητα (`toBe`, όχι `toBeCloseTo`) σε κάθε εκτέλεση.

#### Ζ3. Τι έγινε στον κώδικα

| # | Αρχείο | Αλλαγή |
|---|---|---|
| 1 | `config/color-math.ts` | +`srgbToLinearUnit`/`linearToSrgbUnit` (μεταφορά) · `linearizeChannel` **διαγράφηκε** — το `srgbRelativeLuminance` καλεί πλέον το EOTF · +`contrastRatioRgb` · **σχόλιο-φρουρός** με το W3C erratum |
| 2 | `io/mesh3d-material-import/srgb-linear-unit.ts` | **ΔΙΑΓΡΑΦΗΚΕ** |
| 3 | `io/mesh3d-material-import/texture-average-color.ts` | import → `config/color-math` |
| 4 | `io/mesh3d-roundtrip/glb-embedded-materials.ts` | ιδιωτικό `linearToSrgbUnit` **διαγράφηκε** · +φρουρός πεπερασμένου ώστε το ιστορικό `#ffffff` fallback να μη γίνει σιωπηλά **μαύρο** (το SSoT χαρτογραφεί `NaN→0`) |
| 5 | `rendering/utils/canvas-pill.ts` | inline linearization **και** ιδιωτικός `parseColorRgb` **διαγράφηκαν** → `parseColor` + `srgbRelativeLuminance`. Διορθώνεται και η ασυνέπεια της σταθεράς |
| 6 | `ui/color/hooks/useContrast.ts` | `getRelativeLuminance` **διαγράφηκε** → `contrastRatioRgb`. Το δικό του συμβόλαιο σφάλματος (throw → `ratio: 0`) **διατηρήθηκε ακέραιο** — γι' αυτό χρειάστηκε η `Rgb` παραλλαγή, το `contrastRatio(hex)` επιστρέφει `1` |

**6ο εύρημα (επαληθευμένο):** ο `parseColorRgb` του `canvas-pill` ήταν **γνήσιο υποσύνολο** του
`parseColor` του `color-math` → διαγράφηκε.

**7ο εύρημα (κατά τη διόρθωση, N.18):** το `jscpd:diff` εντόπισε **προϋπάρχον** structural clone
μέσα στο `useContrast` — ο κορμός του hook ήταν αντίγραφο του `calculateContrast`. Ενοποιήθηκε: το
hook είναι πλέον **memoisation** του `calculateContrast`, όχι δεύτερη υλοποίησή του.

**Καθαρό αποτέλεσμα:** 5 υλοποιήσεις μεταφοράς sRGB → **1**· 3 υλοποιήσεις WCAG luminance → **1**·
2 colour parsers → **1**.

#### Ζ4. Τα δύο «εκτός εύρους» — επανεξετάστηκαν και ΚΛΕΙΣΑΝ (Φ10β)

Είχαν αρχικά σημειωθεί ως «εντοπίστηκαν, δεν πειράχτηκαν». Μετά από ένσταση του Giorgio
(«έτσι θα το έκαναν οι μεγάλοι παίχτες;») επανεξετάστηκαν — **και οι δύο δικαιολογίες ήταν λάθος.**

**α) `geo-canvas/config/color-config.ts` — η δικαιολογία «cross-subapp coupling» ήταν άκυρη.**
Το geo-canvas **ήδη** εισάγει από το dxf-viewer σε 8+ σημεία (`@/subapps/dxf-viewer/…`). Η σύζευξη
υπάρχει και είναι καθιερωμένη πρακτική του repo. Με τον φραγμό να πέφτει, το αρχείο ξανακοιτάχτηκε
σωστά και βρέθηκαν **δύο** ευρήματα, όχι ένα:

| Εύρημα | Κατάσταση | Ενέργεια |
|---|---|---|
| `getContrastTextColor` (BT.601) | **ΝΕΚΡΟΣ ΚΩΔΙΚΑΣ** — μηδέν call sites σε όλο το repo· μόνο ο ορισμός + η εγγραφή στο `GEO_COLORS` | **ΔΙΑΓΡΑΦΗΚΕ.** Δεν κεντρικοποιείς νεκρό κώδικα — τον σβήνεις |
| `withOpacity` (8ο εύρημα) | **ΖΩΝΤΑΝΟ** διπλότυπο του `hexToRgba` (SSoT, ADR-573), **10+ call sites** | **Delegate** στο SSoT |

Το `withOpacity` δεν ήταν απλώς διπλότυπο — ήταν **διπλότυπο με σφάλμα**. Έκοβε τυφλά
`substring(0,2)/(2,4)/(4,6)`, άρα **έσπαγε σιωπηλά σε 3-ψήφιο hex**, και η ίδια η παλέτα του
αρχείου περιέχει `#DDD` / `#ddd`:

```
withOpacity('#ddd', 0.5)          → 'rgba(221, NaN, NaN, 0.5)'   ← άκυρο CSS
withOpacity('rgba(1,2,3,1)', 0.5) → 'rgba(NaN, 186, NaN, 0.5)'
```

Ο browser πετά **αθόρυβα** την άκυρη δήλωση → το στοιχείο μένει άβαφο, χωρίς κανένα σφάλμα
πουθενά. Το SSoT `hexToRgba` δέχεται `#rgb`/`#rrggbb`, κάνει clamp το alpha, και σε άκυρη είσοδο
επιστρέφει το ίδιο το hex ως ασφαλές fallback. Το ίδιο `substring` σφάλμα είχε και ο διαγραμμένος
`getContrastTextColor` (3-ψήφιο hex → `NaN` → `NaN > 0.5` = `false` → σιωπηλά **λευκό** κείμενο).

**β) `webgl-line-buffer-builder.hexToLinearRgb` — η ανάθεση στο THREE είναι ΣΩΣΤΗ· το test της ήταν ΨΕΥΤΙΚΟ.**

Η ανάθεση **επιβεβαιώθηκε ως η σωστή επιλογή** και διατηρήθηκε: το `setStyle` δεν μετατρέπει
«sRGB → linear-sRGB» αλλά «sRGB → **τον working χώρο του renderer**». Σήμερα ταυτίζονται· αν αύριο
το `workingColorSpace` γίνει Linear-Display-P3, το `setStyle` μένει σωστό ενώ δική μας συνάρτηση θα
ανέβαζε **λάθος primaries** στο GPU. Ο κινητήρας είναι ο ιδιοκτήτης του working χώρου.

**Το πραγματικό πρόβλημα ήταν αλλού** — και ήταν σοβαρότερο. Το test που υποτίθεται ότι
προστάτευε αυτό το μονοπάτι ήταν **ταυτολογία**:

```js
const expected = new THREE.Color().setStyle('#808080');  // ...και η υλοποίηση είναι
// ακριβώς `_color.setStyle(hex)` → σύγκριση της THREE με τον ΕΑΥΤΟ της
```

Με `ColorManagement.enabled = false` **και οι δύο** πλευρές θα γύριζαν μαζί σε ωμό sRGB, το test θα
έμενε **πράσινο**, και οι γραμμές θα σχεδιάζονταν ορατά ξεπλυμένες. Χειρότερα: το
`ColorManagement.enabled` **πουθενά στον κώδικά μας δεν ορίζεται** — κληρονομούμε το default
`true` της three r152+ (είμαστε σε 0.170). Μια αναβάθμιση που θα το άλλαζε θα περνούσε αθόρυβα.

*(Ίδια αρχή με ADR-587 §6.1: «ένα anchor χωρίς gate δεν είναι anchor — είναι σχόλιο». Εδώ το gate
υπήρχε αλλά δεν μπορούσε να αποτύχει.)*

**Διόρθωση — το αδήλωτο καθολικό γίνεται εκτελεστό συμβόλαιο:**
1. Η αναμενόμενη τιμή έρχεται πλέον από **ανεξάρτητο μάρτυρα** — το δικό μας `srgbToLinearUnit`,
   καμία σχέση με THREE. Ρητό `expect(c[0]).not.toBeCloseTo(0x80/255)` = «όχι ωμό sRGB».
2. +test κορεσμένου χρώματος (πιάνει μπέρδεμα καναλιών, που το γκρι `#808080` δεν μπορεί).
3. +ρητό `expect(THREE.ColorManagement.enabled).toBe(true)` με τεκμηριωμένο blast radius.
4. +διασταύρωση THREE ↔ SSoT σε 5 χρώματα.

**Αυτό είναι το σημείο όπου ξεπερνάμε τη συνήθη πρακτική:** τα three-based επαγγελματικά εργαλεία
βασίζονται στη *σύμβαση* ότι το ColorManagement είναι ON. Εμείς το **επαληθεύουμε εκτελεστικά**,
διασταυρώνοντας τον κινητήρα με ανεξάρτητη υλοποίηση του προτύπου.

---

## 5. ΤΙ ΡΗΤΑ ΔΕΝ ΑΛΛΑΖΕΙ

- **ADR-691 §3.α — η γεωμετρία του εισαγόμενου πλέγματος ΔΕΝ βάφεται.** Το Δ1 αλλάζει μόνο τι
  *διαβάζει* το panel, ποτέ τι *γράφεται* στην οντότητα.
- **ADR-693 Γ3** flat-colour fallback — παραμένει· το Β1 **προσθέτει** badge, δεν αντικαθιστά.
- **ADR-678 verify-after-write** — παραμένει· δεν ήταν αυτό το σφάλμα.
- **ADR-683 §11 provider** — παραμένει ως μηχανισμός θετικής απόδειξης ιδιοκτησίας.

---

## 6. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.3 | 2026-07-25 | Claude (Opus 5) | **Φ10β — ΤΑ ΔΥΟ «ΕΚΤΟΣ ΕΥΡΟΥΣ» ΕΠΑΝΕΞΕΤΑΣΤΗΚΑΝ ΚΑΙ ΕΚΛΕΙΣΑΝ (§Ζ4 ξαναγράφτηκε).** Μετά από ένσταση του Giorgio («έτσι θα το έκαναν οι μεγάλοι παίχτες;») — **και οι δύο δικαιολογίες της v1.2 ήταν λάθος**. **(α) geo-canvas:** η δικαιολογία «cross-subapp coupling» ήταν **άκυρη** — το geo-canvas ήδη εισάγει από dxf-viewer σε **8+ σημεία**. Με τον φραγμό να πέφτει βρέθηκαν **δύο** ευρήματα: το `getContrastTextColor` είναι **ΝΕΚΡΟΣ ΚΩΔΙΚΑΣ** (μηδέν call sites) → **ΔΙΑΓΡΑΦΗΚΕ** (δεν κεντρικοποιείς νεκρό κώδικα)· και **8ο ΕΥΡΗΜΑ — ΖΩΝΤΑΝΟ**: το `withOpacity` (**10+ call sites**) ήταν διπλότυπο του `hexToRgba` (SSoT ADR-573) **με σφάλμα** — τυφλό `substring(0,2)/(2,4)/(4,6)` που **έσπαγε σιωπηλά σε 3-ψήφιο hex**, ενώ η ίδια η παλέτα περιέχει `#DDD`/`#ddd`: `withOpacity('#ddd',0.5)` → `rgba(221, NaN, NaN, 0.5)` = **άκυρο CSS που ο browser πετά αθόρυβα** (στοιχείο άβαφο, μηδέν σφάλμα πουθενά) → **delegate στο SSoT**. **(β) webgl:** η **ανάθεση** στο `THREE.Color` **επιβεβαιώθηκε σωστή και διατηρήθηκε** (το `setStyle` μετατρέπει sRGB → **working χώρο του renderer**, όχι linear-sRGB· αν αλλάξει σε Linear-Display-P3 δική μας συνάρτηση θα ανέβαζε **λάθος primaries** — ο κινητήρας είναι ο ιδιοκτήτης). **Το πραγματικό πρόβλημα ήταν το test: ταυτολογία** — `expected = new THREE.Color().setStyle(hex)` έναντι υλοποίησης που **είναι** `setStyle(hex)`, δηλαδή σύγκριση της THREE με τον εαυτό της· με `ColorManagement.enabled=false` **και οι δύο** πλευρές θα γύριζαν μαζί σε ωμό sRGB, **το test θα έμενε πράσινο** και οι γραμμές θα σχεδιάζονταν ξεπλυμένες. Επιπλέον το `ColorManagement.enabled` **πουθενά δεν ορίζεται** στον κώδικά μας (default `true` της r152+· three 0.170). **Διόρθωση:** ανεξάρτητος μάρτυρας (`srgbToLinearUnit`, όχι THREE) + ρητό «ΟΧΙ ωμό sRGB» + test κορεσμένου χρώματος (πιάνει μπέρδεμα καναλιών που το γκρι δεν μπορεί) + ρητό `expect(ColorManagement.enabled).toBe(true)` + διασταύρωση THREE↔SSoT σε 5 χρώματα. Ίδια αρχή με ADR-587 §6.1 — «anchor χωρίς gate δεν είναι anchor»· εδώ το gate υπήρχε αλλά **δεν μπορούσε να αποτύχει**. **Επαλήθευση:** webgl-lines + geo-canvas suites πράσινα (69 tests)· `jscpd:diff` **καθαρό**· **ΟΧΙ tsc (N.17)**. ⚠️ Προϋπάρχον/άσχετο: `geo-canvas/__tests__/DxfGeoTransform.test.ts` (1 test) — η αλυσίδα imports του δεν αγγίζει χρώματα. 🔜 Προτεινόμενο (δεν έγινε — απαιτεί απόφαση): προαγωγή του `color-math` σε ουδέτερο `src/lib/color/`, τώρα που έχει καταναλωτή σε **δύο** subapps· ~30 import sites, σε **μοιραζόμενο** working tree. |
| v1.2 | 2026-07-25 | Claude (Opus 5) | **Φ10 — ΕΝΟΠΟΙΗΣΗ ΤΗΣ ΣΥΝΑΡΤΗΣΗΣ ΜΕΤΑΦΟΡΑΣ sRGB (νέα ενότητα Ζ).** **Ζ0 — διόρθωση ground truth:** το καταγεγραμμένο «δύο σταθερές, και οι δύο σωστές για διαφορετικό πρότυπο» **ΔΕΝ ισχύει**· το W3C **απέσυρε** το `0.03928` τον **Μάιο 2021** («It was taken from an older version of the specification and has been updated») — υπάρχει **ΕΝΑ** πρότυπο (IEC 61966-2-1, `0.04045`) και ένα διορθωμένο τυπογραφικό λάθος. **Ζ1:** ΕΝΑ primitive, ΜΙΑ σταθερά, ΔΥΟ στρώματα — το WCAG (`srgbRelativeLuminance`/`contrastRatio`) χτίζεται **πάνω** στο EOTF, όπως colorjs.io + three.js· οι συναρτήσεις μένουν χωριστές ώστε μια μελλοντική μετάβαση σε APCA να μην αγγίζει τη χρωματομετρία. **Ζ2 — μετρημένο μηδενικό ρίσκο:** για **κάθε** byte `0..255` οι δύο σταθερές είναι **bit-for-bit ταυτόσημες** (κανένα byte δεν πέφτει στη ζώνη `(0.03928, 0.04045]`: byte 10 κάτω κι από τα δύο, byte 11 πάνω κι από τα δύο) — κλειδωμένο εκτελεστικά με τη **παλιά** υλοποίηση ως μάρτυρα σε `config/__tests__/color-math-srgb-transfer.test.ts`. **Ζ3:** 5 υλοποιήσεις μεταφοράς → **1**, 3 υλοποιήσεις WCAG luminance → **1**, 2 parsers → **1**· `srgb-linear-unit.ts` **διαγράφηκε** (τα anchors του μετακόμισαν, δεν χάθηκαν)· διατηρήθηκαν ακέραια δύο διακριτά συμβόλαια σφάλματος (`#ffffff` fallback στο glTF μέσω φρουρού πεπερασμένου· `ratio: 0` στο `useContrast` μέσω `contrastRatioRgb`). **6ο εύρημα επαληθευμένο** (`parseColorRgb` = υποσύνολο του `parseColor` → διαγράφηκε). **7ο εύρημα** από το `jscpd:diff`: **προϋπάρχον** clone μέσα στο `useContrast` (ο κορμός του hook = αντίγραφο του `calculateContrast`) → το hook είναι πλέον **memoisation**, όχι δίδυμο. **Επαλήθευση: 1642 tests / 147 suites πράσινα** στο εύρος `config`+`ui/color`+`rendering`+`io`· **mutation-verified** (`0.04045`→`0.05045` → **2 κόκκινα**, revert → πράσινο)· `jscpd:diff` **καθαρό**. **ΟΧΙ tsc (N.17).** ⚠️ **Προϋπάρχον κόκκινο, ΑΣΧΕΤΟ με το Φ10:** `config/__tests__/bim-object-styles.test.ts` — `BIM_CATEGORY_LINE_COLORS` έχει 20 εγγραφές / 19 μοναδικά χρώματα, επειδή `electricalPanel` και `thermalSpace` δείχνουν **και τα δύο** στο `MEP_TEAL_COLOR`. Το αρχείο είναι αμετάβλητο στο working tree (HEAD, commit `887c1588` 2026-07-22, ADR-684) → το κόκκινο προϋπάρχει· χρειάζεται απόφαση Giorgio (είναι σκόπιμη η επαναχρήστη του analytical teal → λάθος **το test**· αλλιώς λείπει χρώμα). |
| v1.1 | 2026-07-25 | Claude (Opus 5) | **Ε1 BACKFILL ΟΛΟΚΛΗΡΩΘΗΚΕ + deploy + επαλήθευση παραγωγής.** Deployed: `firestore:indexes` (2 νέα, `CREATING`→`READY`) και `functions:onStorageFinalize,orphanSweeper,orphanSpikeAlert` (**το `tsc` predeploy πέρασε καθαρό**). Restore 5 αντικειμένων από soft-delete (4 υφές + η γεωμετρία «Πόρτα 01»). **ΑΠΟΔΕΙΞΗ ΟΤΙ ΤΟ Α1 ΔΟΥΛΕΥΕΙ ΣΤΗΝ ΠΑΡΑΓΩΓΗ:** στις 22:15Z (πριν ολοκληρωθεί το deploy) το ΠΑΛΙΟ function κατέγραψε ακόμη 4× «Orphan file detected — Deleting»· στις 22:31Z το ΝΕΟ κατέγραψε «**Storage custody: candidate recorded (no deletion)**» με `custodyKind=orphaned` — **μηδέν διαγραφή**, όπως σχεδιάστηκε. ⚠️ **Δύο ευρήματα του backfill:** (α) το self-heal των 22:15 (Γ1/Γ2) **δούλεψε** — τα `Mat.1`/`Mat`/`Scene_Material3` απέκτησαν πραγματικά `appearance` από gamma-correct μέσο χρώμα υφής (**#94a785 πράσινο**, **#dd8b30** & **#e29032 πορτοκαλί** — ακριβώς το αρχικό παράπονο του Giorgio) **αλλά** τα νέα uploads σβήστηκαν από το παλιό function, οπότε τα `albedoUrl` έδειχναν σε **νεκρά tokens (403)**· διορθώθηκαν τα 3 `pbrTextures.albedoUrl` ώστε να δείχνουν στα restored generations — **και τα 4 URL → HTTP 200**, το `appearance` διατηρήθηκε ακέραιο. (β) Το `bmat_af231b75` (`Mat#ID12`) **δεν υπάρχει πλέον** στο Firestore (9→8 docs), οπότε το restored αρχείο του είναι **γνήσια ορφανό** — το custody το χαρακτήρισε σωστά `orphaned` και είναι ο 1ος καταχωρημένος υποψήφιος· ο sweeper (dry-run) θα το αναφέρει, όχι θα το σβήσει. **Το σύστημα απέδειξε ότι λειτουργεί ακριβώς όπως σχεδιάστηκε: ένα γνήσια ορφανό αναγνωρίστηκε, καταγράφηκε, και ΔΕΝ διαγράφηκε αυτόματα.** 🔴 Εκκρεμεί: **Φ10** (ενοποίηση sRGB transfer — 5 σημεία, βλ. HANDOFF 2026-07-25 Φ10) + commit από Giorgio. |
| v1.0 | 2026-07-25 | Claude (Opus 5) | **ΥΛΟΠΟΙΗΣΗ Α/Β/Γ/Δ (εγκεκριμένο «προχώρα», orchestrator 3 agents).** **Α1** `orphan-cleanup.ts` → mark-only· μηδέν `delete()` στο real-time μονοπάτι· υποψήφιοι σε `storage_orphan_candidates` με σταθερό base64url doc id (idempotent). **Α2** NEW `storage-path-custody.ts` — 5 ρητοί κανόνες κηδεμονίας· το κλειδί της υφής είναι ο **φάκελος** (`materialId`), όχι το basename (`albedo`)· `unknown` → **ποτέ** διαγραφή· ο `findFileOwner` επαναχρησιμοποιείται ως **positive-only** ανιχνευτής (μηδέν διπλότυπο, N.18 — δεν έγινε dead code). **Α3** NEW `orphan-sweeper.ts` — ο ΜΟΝΟΣ destructive δρόμος, 4 φράγματα (ρητή άδεια `ORPHAN_SWEEP_ENABLED` αλλιώς **dry-run** · θετική απόδειξη ορφανότητας · ωρίμανση 7 ημερών από την ΠΡΩΤΗ παρατήρηση · **επανέλεγχος** τη στιγμή της διαγραφής) + cap 50/εκτέλεση. **Α5** +2 composite indexes (ανάσταση Layer 3). **Β1** badge «λείπει η υφή» + Radix tooltip (CHECK 3.23-safe) + a11y· διακρίνει «απέτυχε η φόρτωση» από «δεν υπήρξε ποτέ εικόνα». **Γ1** self-heal στο GLB μονοπάτι — η `foreignAndBrokenTextures` καλείται **αυτούσια** (μόνο προσαρμογή σχήματος)· `classifyMaterials` μένει sync/pure. **Γ2** NEW `embedded-appearance-backfill.ts` — γεμίζει `appearance` μόνο όταν **αποδεικνύεται** `null`, ποτέ overwrite. **Γ3** gamma-correct μέσο χρώμα + NEW `srgb-linear-unit.ts` (ακριβές IEC 61966-2-1)· δείγμα 16×16→64×64· alpha-weighted. **Δ1** NEW `resolveEntityRenderedMaterialIds` — override → αλλιώς embedded· οι 4 υπάρχουσες συναρτήσεις **αμετάβλητες**. **Επαλήθευση: 484 tests / 44 suites πράσινα**· mutation-verified (επαναφορά του θανάσιμου default → **5 κόκκινα**, revert → πράσινο)· `jscpd:diff` καθαρό σε όλα τα batches. **ΟΧΙ tsc (N.17).** Εκκρεμεί Ε1 (backfill, **μετά** το deploy) + browser verification. |
| v0.1 | 2026-07-25 | Claude (Opus 5) | Αρχική σύνταξη. Ground truth: το `onStorageFinalize` (`orphan-cleanup.ts`) διέγραψε **61 νόμιμα αρχεία σε 4 υποσυστήματα / 13 ημέρες** — αποδεδειγμένο από Cloud Function logs + soft-delete generations + Firebase Rules API. Απορρίφθηκε τεκμηριωμένα η #1 υποψία του handoff (storage rules deploy). Εντοπίστηκε **2ο άγνωστο θύμα**: `block_library` «Πόρτα 01» με διαγραμμένη γεωμετρία. Αποφάσεις Α (fail-safe custody GC, Kubernetes `ownerReferences` μοντέλο), Β (fail-loud badge, Revit/Blender), Γ (self-heal + gamma-correct χρώμα), Δ (ταυτότητα embedded), Ε (backfill από soft-delete πριν τις 31/07). |
