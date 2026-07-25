# ADR-709 — Immutable Storage Path: **ένα** σχήμα, οι σχέσεις ζουν στη βάση

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED (uncommitted — ο Giorgio κάνει commit) · 🔴 migration **δεν έχει εκτελεστεί** |
| **Date** | 2026-07-26 |
| **Domain** | Storage · Files/FileRecord · Deletion Guard · Migrations |
| **Canonical Location** | `src/services/upload/utils/storage-path.ts` (`buildStoragePath`, `buildEntityStoragePrefix`, `buildCategoryStoragePrefix`, `buildLegacyProjectScopedPrefix`, `parseStoragePath`) |
| **Anchor** | `src/services/upload/utils/__tests__/storage-path.test.ts` (28 tests) · `src/config/__tests__/deletion-registry-storage.test.ts` (9) · `src/app/api/admin/migrations/normalize-storage-paths/__tests__/…` (9) — **mutation-verified ×6** |
| **Related** | ADR-031 (Canonical File Storage) · ADR-226 (Deletion Guard) · ADR-694 (Storage custody fail-safe GC) · ADR-704 (Admin Migration-Runner SSoT) · ADR-708 (ίδια εκστρατεία E2E verify «Έργων») |

---

## 1. Context — πώς βρέθηκε

E2E verify «Έργων», **Φάση 5** (2026-07-26). Καταγράφηκε ως **Ε-17**: μετρήθηκαν
**3/3 δείγματα** στο ίδιο έργο (PRJ-002), στην ίδια συνεδρία, με **δύο ασύμβατα** σχήματα
storage path:

```
Φωτογραφίες : companies/<c>/               entities/project/<p>/domains/construction/categories/photos/files/
Βίντεο      : companies/<c>/               entities/project/<p>/domains/construction/categories/videos/files/
Κάτοψη      : companies/<c>/projects/<p>/  entities/project/<p>/domains/construction/categories/floorplans/files/
Στάθμευση   : companies/<c>/projects/<p>/  entities/project/<p>/domains/construction/categories/floorplans/files/
                        └────────────┘ το project id ΔΥΟ ΦΟΡΕΣ
```

### ⚠️ Η αρχική υπόθεση ήταν ΛΑΘΟΣ — καταγράφεται για ιχνηλασιμότητα

Το handoff της Φάσης 5 υπέθετε **«δύο αντιφατικά τεκμηριωμένα canonical»**:
`src/types/file-record.ts:207` (ΜΕ `projects/`) vs `PhotosTab.tsx` (ΧΩΡΙΣ).

**Δεν αντιφάσκουν.** Το παράδειγμα στο `file-record.ts` είναι `entityType: 'contact'` με
`projectId: 'project_456'` — **διαφορετικές οντότητες**, όπου το project scope προσθέτει
πραγματική πληροφορία. Η αντίφαση ήταν αλλού, και ήταν **μέσα στο ίδιο αρχείο**:

```
src/components/projects/tabs/ProjectFloorplanTab.tsx:18   ← docblock: path ΧΩΡΙΣ projects/
src/components/projects/tabs/ProjectFloorplanTab.tsx:136  ← κώδικας: projectId={String(resolvedProject.id)}
```

118 γραμμές απόσταση μεταξύ του δηλωμένου συμβολαίου και της παραβίασής του. Το ίδιο
ισχύει για **όλα** τα `Building*Tab.tsx` — τα docblocks τους τεκμηρίωναν ήδη το canonical,
ο κώδικας έγραφε το legacy.

---

## 2. Ρίζα — δύο ξεχωριστά ελαττώματα, μία αιτία

Ο builder δεχόταν **προαιρετικό** `projectId` που εισήγαγε τμήμα `projects/{projectId}`.
Άρα ο **καλών** διάλεγε σχήμα. Δύο τρόποι να το κάνει λάθος:

### Α) Ταυτολογία — 3 σημεία

Όταν `entityType === 'project'`, το `entityId` **είναι ήδη** το project:

| Σημείο | Τι έγραφε |
|---|---|
| `ProjectFloorplanTab.tsx:134,136` | `entityId={p}` **και** `projectId={p}` |
| `render-output-writer.ts:83,85` | `projectId: config.projectId` **και** `entityId: config.projectId` |
| `attendance-server-service.ts:191,193` | `projectId` **και** `entityId: projectId` |

→ `projects/<p>/entities/project/<p>/` — το ίδιο id δύο φορές, μηδέν επιπλέον πληροφορία.

### Β) Το path εξαρτιόταν από **μεταβλητό πεδίο ΑΛΛΗΣ οντότητας** — ~9 σημεία

`projectId={resolvedBuilding.projectId}` (Building Photos/Videos/Floorplan/Contracts,
Floors, Measurements, Parking, Space, NewUnitHierarchy).

Το `building.projectId` είναι **προαιρετικό και μεταβλητό**:

- Κτίριο **χωρίς** έργο → αρχεία στο σύντομο δέντρο.
- Το ίδιο κτίριο **αποκτά** έργο → νέα αρχεία στο μακρύ δέντρο.
- Το κτίριο **αλλάζει** έργο → όλα τα παλιά paths δείχνουν σε έργο που δεν ισχύει πια.

**Το path δεν μπορεί να ακολουθήσει, γιατί τα object keys είναι αμετάβλητα.**

---

## 3. Απόφαση

> **Το storage path είναι καθαρή συνάρτηση ΑΜΕΤΑΒΛΗΤΩΝ ταυτοτήτων της ΙΔΙΑΣ οντότητας.**
> Καμία σχέση, κανένα προαιρετικό τμήμα, καμία εξαίρεση.

```
companies/{companyId}/entities/{entityType}/{entityId}/domains/{domain}/categories/{category}/files/{fileId}.{ext}
```

Το `projectId` ζει **μόνο** στο `FileRecord.projectId` (Firestore) — όπου μπορεί να αλλάξει
χωρίς να μετακινηθεί ούτε ένα byte.

### Γιατί αυτό και όχι το αντίθετο (τεκμηρίωση)

| Παρατήρηση | Πηγή |
|---|---|
| Τα object keys είναι **αμετάβλητα by design**· rename = **COPY + DELETE** κάθε αντικειμένου (1 εκατ. αρχεία = 1 εκατ. COPY + 1 εκατ. DELETE, χρεώσιμα) | [AWS S3 — Copying, moving, renaming](https://docs.aws.amazon.com/AmazonS3/latest/userguide/copy-object.html) |
| «Φάκελοι» **δεν υπάρχουν** — ένα επίπεδο namespace· η ιεραρχία είναι οπτική ψευδαίσθηση του console πάνω στο `/` του key | [AWS S3 — Object keys](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html) |
| **Autodesk APS**: OSS = flat object storage· η ιεραρχία (folders/items/versions) ζει στο **Data Management API**, όχι στο key | [APS Data Management API](https://aps.autodesk.com/developer/overview/data-management-api) |

Δηλαδή: **ο μεγάλος παίκτης του ίδιου κλάδου (CAD/BIM) έχει ήδη κάνει ακριβώς αυτόν τον
διαχωρισμό.** Μεταβλητή σχέση μέσα σε αμετάβλητο key = ή μαζικό copy+delete σε κάθε αλλαγή,
ή path που λέει ψέματα. Δεν υπάρχει τρίτη επιλογή.

### Πώς γίνεται **δομικά αδύνατη** η απόκλιση (πέρα από την πρακτική των μεγάλων)

Οι μεγάλοι το τεκμηριώνουν ως **σύμβαση**. Εδώ γίνεται **μη εκφράσιμο**:

1. Το `projectId` **αφαιρέθηκε από το `StoragePathParams`** — δεν είναι «μην το περνάς»,
   είναι «δεν υπάρχει τρόπος να το περάσεις». Ο type checker είναι το gate.
2. **Anchor test** για τον χρόνο εκτέλεσης: ακόμη κι αν untyped καλών (JS, rehydrated
   payload, spread από παλιό σχήμα) σπρώξει `projectId`, το path **δεν** το περιέχει.
3. Τα cleanup templates του `deletion-registry` **παράγονται από την ίδια SSoT**
   (`entityCleanupTemplate()`), αντί να είναι χειρόγραφα strings. Αλλαγή σχήματος →
   τα templates ακολουθούν αυτόματα. Χειρόγραφο template ήταν ακριβώς ο τρόπος με τον
   οποίο οι sweepers απέκλιναν.

---

## 4. Tolerant reader — γιατί η ασυμμετρία είναι σκόπιμη

**Γράφουμε ένα σχήμα· διαβάζουμε δύο.**

`parseStoragePath` εξακολουθεί να αναγνωρίζει το legacy `projects/{p}/` και επιστρέφει
`legacyProjectId`. Χωρίς αυτό, τα ήδη γραμμένα αντικείμενα γίνονται **αόρατα σκουπίδια**:
κανείς δεν τα βρίσκει, κανείς δεν τα σβήνει, και συνεχίζουν να χρεώνονται.

`buildLegacyProjectScopedPrefix()` είναι η **μοναδική** περιγραφή του legacy σχήματος στο
repo — ώστε όταν ολοκληρωθεί το migration να σβηστεί με **μία** επεξεργασία.

---

## 5. Τι διορθώθηκε επιπλέον (βρέθηκε κατά N.0.2, ίδια αιτία)

### 5.1 🔴 Το `project` **δεν είχε καθόλου** storage cleanup

`deletion-registry.ts` είχε `storageCleanup` **μόνο** για `contact` και `property`. Το
`project` — που κατέχει κατόψεις, θέσεις στάθμευσης, BIM renders και φωτογραφίες παρουσίας
— **δεν είχε ούτε cascade των FileRecords ούτε storage sweep**. Διαγραφή έργου άφηνε τα
bytes στον κουβά **χωρίς κανένα εναπομείναν Firestore record** που να τα εντοπίζει.

Προστέθηκαν και τα δύο.

### 5.2 🔴 Ο floor-wipe sweeper σάρωνε **μόνο** το legacy δέντρο

`floorplan-floor-wipe.service.ts:358` — `const sweep = projectId ? await … : {deleted:0}`.
Το ίδιο το σχόλιο το παραδεχόταν: *«Skipped silently for legacy floors without … projectId»*.

Άρα: floorplan κτιρίου χωρίς έργο → γραφόταν στο σύντομο δέντρο → **ο sweeper δεν το
έβρισκε ποτέ**· και αν το κτίριο αποκτούσε έργο αργότερα, ο sweeper σάρωνε το **λάθος**
δέντρο.

Τώρα σαρώνει **πάντα** το canonical (χωρίς προϋπόθεση) **και επιπλέον** το legacy όταν το
έργο είναι γνωστό.

### 5.3 CHECK 3.28 — προϋπάρχον clone στο `deletion-registry`

Τα `parking` και `storage` entries ήταν **κυριολεκτικά δίδυμα** (24 γραμμές / 61 tokens),
με μοναδική διαφορά το ελληνικό μήνυμα «έχει πωληθεί». Ενοποιήθηκαν σε
`sellableSpaceDeletionConfig(soldMessage)`. Anchor επιβεβαιώνει ότι διαφέρουν **μόνο** εκεί.

---

## 6. Τι **δεν** άλλαξε — και γιατί δεν χρειάστηκε

| Περιοχή | Γιατί είναι ασφαλές |
|---|---|
| **~9 UI callers** (`projectId={building.projectId}`) | Το `projectId` συνεχίζει να ταξιδεύει προς το **Firestore FileRecord** — απλώς σταματά να μπαίνει στο path. **Μία** γραμμή στο `file-record-core.ts` το κόβει. Κανένα component δεν άλλαξε. |
| **Ανάγνωση στο UI** | Γίνεται από `FileRecord.storagePath`, **όχι** prefix listing → τα ήδη ανεβασμένα αρχεία συνεχίζουν να δουλεύουν άθικτα. |
| **`storage.rules`** | Καλύπτει **και τα δύο** δέντρα (γρ. 181 & 222) → μηδέν ρίσκο ασφάλειας κατά τη μετάβαση. |
| **`/api/storage/file/[...path]`** | Ελέγχει μόνο `segments[0]==='companies'` + `segments[1]===companyId` — path-αγνωστικό, σερβίρει και τα δύο. |
| **Υπάρχοντα αρχεία** | **Δεν μετακινήθηκε τίποτα.** Βλ. §7. |

---

## 7. 🔴 Migration — ΥΠΑΡΧΕΙ, ΔΕΝ ΕΧΕΙ ΕΚΤΕΛΕΣΤΕΙ

`POST /api/admin/migrations/normalize-storage-paths` (super_admin only, ADR-704 factory).

- **GET = dry-run** — σαρώνει, αναφέρει, **μηδέν** εγγραφές, **μηδέν** αντιγραφές.
- **POST = execute** — ανά αντικείμενο: **copy → verify → delete**, μετά ενημέρωση FileRecord.

**Εγγυήσεις:**

| Εγγύηση | Μηχανισμός |
|---|---|
| Ποτέ διαγραφή χωρίς επιβεβαιωμένο αντίγραφο | `exists()` έλεγχος **πριν** το `delete()`· anchor test το φρουρεί |
| Επαναλήψιμο | Αποτυχία αφήνει την πηγή **και** το FileRecord άθικτα → 2η εκτέλεση ξαναπιάνει ό,τι έμεινε legacy |
| Το FileRecord δεν δείχνει ποτέ σε ανύπαρκτα bytes | Τα objects μετακινούνται **πρώτα**· ενημερώνονται μόνο όσα records πέτυχαν |
| Τα derivations δεν ξεχνιούνται | `getFiles({prefix: legacyPath})` πιάνει `.thumbnail.png` / `.processed.json` |
| Τα `downloadUrl` δεν σπάνε | Το `copy()` μεταφέρει το `firebaseStorageDownloadTokens` → ξαναγράφεται **μόνο** το encoded path |
| Δεν χτυπά λάθος αρχεία | Ταξινόμηση με τον **SSoT parser**, όχι `includes('/projects/')` — anchor με εταιρεία ονόματι `projects` |

⚠️ **Ο Giorgio αποφασίζει πότε εκτελείται το POST.** Μέχρι τότε τα legacy αντικείμενα
παραμένουν πλήρως λειτουργικά (ανάγνωση από Firestore, sweep από το dual-prefix).

---

## 8. Επαλήθευση

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `storage-path.test.ts` | **28/28** ✅ |
| `deletion-registry-storage.test.ts` (νέο) | **9/9** ✅ |
| `storage-path-normalize-operations.test.ts` (νέο) | **9/9** ✅ |
| Regression (file-record, upload, firestore, config, floorplan-background) | **191/191** ✅ |
| **Mutation-verified** | **×6** — επαναφορά project scope (1 fail) · απενεργοποίηση tolerant reader (2) · αντιμετάθεση prefix segments (8) · αφαίρεση project storageCleanup (3) · χειρόγραφο λάθος template (2) · αφαίρεση copy-verification (1) |
| `jscpd:diff` (9 αρχεία) | **0 clones** ✅ |
| `tsc` | **ΔΕΝ εκτελέστηκε** — N.17 (ο Giorgio / pre-commit hook) |

**Γνωστή αστοχία, άσχετη:** `floorplan-background/__tests__/persistence.integration.test.ts`
απαιτεί Firebase emulator credentials (`firebaseAdmin.ts:60`). Δεν εισάγει κανένα αρχείο
αυτού του ADR — προϋπάρχουσα περιβαλλοντική αστοχία.

---

## 9. Το εύρημα που **δεν** ήταν bug

**Κάτοψη και Θέσεις Στάθμευσης γράφουν στον ίδιο φάκελο `categories/floorplans/`.**

Είναι **by design**: ο διαχωρισμός γίνεται από το `purpose`
(`FLOORPLAN_PURPOSES.PROJECT` vs `.PARKING`), όχι από το `category`. Επαληθεύτηκε ζωντανά
ότι δεν μπερδεύονται (Κάτοψη = 2 αρχεία, Στάθμευση = 1).

⚠️ **Παραμένουσα συνέπεια:** από το path **δεν** ανακτάται η διάκριση. Αν χαθεί το
Firestore, τα δύο είδη είναι δυσδιάκριτα. Καταγράφεται ως γνωστός περιορισμός — **όχι**
ενέργεια, γιατί η ίδια η αρχή του ADR-709 λέει ότι το path δεν είναι βάση δεδομένων.

---

## 10. Ο γενικεύσιμος κανόνας

> **Ένα storage key μπορεί να κωδικοποιεί μόνο ό,τι δεν αλλάζει ποτέ.**
> Ταυτότητα → key. Σχέση → βάση.
> Αν ένα τμήμα του path προέρχεται από πεδίο **άλλης** οντότητας, το path θα πει ψέματα
> την ημέρα που αυτό το πεδίο αλλάξει — και κανένα test δεν θα το πιάσει, γιατί τίποτα
> δεν σπάει· απλώς τα αρχεία γίνονται αόρατα.

Δεύτερος, ίδιας φύσης με τον κανόνα του ADR-708:

> **Δύο μηχανισμοί που απαντούν στην ίδια ερώτηση πρέπει να διαβάζουν την ίδια πηγή.**
> Εκεί ήταν `disabled={X}` vs `if (!Y) return`. Εδώ ήταν ο writer vs ο sweeper.
> Και στις δύο περιπτώσεις η αστοχία ήταν **σιωπηλή**.

---

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-07-26 | **Δημιουργία.** Ε-17 → ρίζα ονομασμένη (ταυτολογία + μεταβλητή εξάρτηση). `projectId` αφαιρέθηκε από `StoragePathParams` (type-level enforcement)· `parseStoragePath` → tolerant reader με `legacyProjectId`· νέες SSoT `buildEntityStoragePrefix` / `buildCategoryStoragePrefix` / `buildLegacyProjectScopedPrefix`· 5 writers καθαρίστηκαν· floor-wipe → dual-prefix + πάντα ενεργό· `project` απέκτησε FILES cascade + storageCleanup· cleanup templates παράγονται από την SSoT· `parking`/`storage` clone ενοποιήθηκε· migration route (dry-run έτοιμο, **execute εκκρεμεί εντολή Giorgio**). 46 tests, mutation-verified ×6, jscpd 0. |
