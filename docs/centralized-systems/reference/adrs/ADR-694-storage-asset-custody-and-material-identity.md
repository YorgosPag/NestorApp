# ADR-694 — Κηδεμονία αρχείων Storage (fail-safe GC) + ταυτότητα υλικού εισαγόμενου πλέγματος

**Status:** IMPLEMENTED (Α/Β/Γ/Δ) · 🔴 **ΕΚΚΡΕΜΕΙ Ε1 (backfill) — ΜΕΤΑ το deploy, ΠΡΙΝ τις 31/07**
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
| v1.0 | 2026-07-25 | Claude (Opus 5) | **ΥΛΟΠΟΙΗΣΗ Α/Β/Γ/Δ (εγκεκριμένο «προχώρα», orchestrator 3 agents).** **Α1** `orphan-cleanup.ts` → mark-only· μηδέν `delete()` στο real-time μονοπάτι· υποψήφιοι σε `storage_orphan_candidates` με σταθερό base64url doc id (idempotent). **Α2** NEW `storage-path-custody.ts` — 5 ρητοί κανόνες κηδεμονίας· το κλειδί της υφής είναι ο **φάκελος** (`materialId`), όχι το basename (`albedo`)· `unknown` → **ποτέ** διαγραφή· ο `findFileOwner` επαναχρησιμοποιείται ως **positive-only** ανιχνευτής (μηδέν διπλότυπο, N.18 — δεν έγινε dead code). **Α3** NEW `orphan-sweeper.ts` — ο ΜΟΝΟΣ destructive δρόμος, 4 φράγματα (ρητή άδεια `ORPHAN_SWEEP_ENABLED` αλλιώς **dry-run** · θετική απόδειξη ορφανότητας · ωρίμανση 7 ημερών από την ΠΡΩΤΗ παρατήρηση · **επανέλεγχος** τη στιγμή της διαγραφής) + cap 50/εκτέλεση. **Α5** +2 composite indexes (ανάσταση Layer 3). **Β1** badge «λείπει η υφή» + Radix tooltip (CHECK 3.23-safe) + a11y· διακρίνει «απέτυχε η φόρτωση» από «δεν υπήρξε ποτέ εικόνα». **Γ1** self-heal στο GLB μονοπάτι — η `foreignAndBrokenTextures` καλείται **αυτούσια** (μόνο προσαρμογή σχήματος)· `classifyMaterials` μένει sync/pure. **Γ2** NEW `embedded-appearance-backfill.ts` — γεμίζει `appearance` μόνο όταν **αποδεικνύεται** `null`, ποτέ overwrite. **Γ3** gamma-correct μέσο χρώμα + NEW `srgb-linear-unit.ts` (ακριβές IEC 61966-2-1)· δείγμα 16×16→64×64· alpha-weighted. **Δ1** NEW `resolveEntityRenderedMaterialIds` — override → αλλιώς embedded· οι 4 υπάρχουσες συναρτήσεις **αμετάβλητες**. **Επαλήθευση: 484 tests / 44 suites πράσινα**· mutation-verified (επαναφορά του θανάσιμου default → **5 κόκκινα**, revert → πράσινο)· `jscpd:diff` καθαρό σε όλα τα batches. **ΟΧΙ tsc (N.17).** Εκκρεμεί Ε1 (backfill, **μετά** το deploy) + browser verification. |
| v0.1 | 2026-07-25 | Claude (Opus 5) | Αρχική σύνταξη. Ground truth: το `onStorageFinalize` (`orphan-cleanup.ts`) διέγραψε **61 νόμιμα αρχεία σε 4 υποσυστήματα / 13 ημέρες** — αποδεδειγμένο από Cloud Function logs + soft-delete generations + Firebase Rules API. Απορρίφθηκε τεκμηριωμένα η #1 υποψία του handoff (storage rules deploy). Εντοπίστηκε **2ο άγνωστο θύμα**: `block_library` «Πόρτα 01» με διαγραμμένη γεωμετρία. Αποφάσεις Α (fail-safe custody GC, Kubernetes `ownerReferences` μοντέλο), Β (fail-loud badge, Revit/Blender), Γ (self-heal + gamma-correct χρώμα), Δ (ταυτότητα embedded), Ε (backfill από soft-delete πριν τις 31/07). |
