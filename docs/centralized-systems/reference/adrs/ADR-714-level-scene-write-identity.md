# ADR-714 — Ταυτότητα εγγραφής επιπέδου↔σκηνής: το «Save Ticket»

**Κατάσταση:** Υλοποιημένο (2026-07-26)
**Σχετικά:** ADR-399 (cross-floor link guard — ο κανόνας που επεκτείνεται στο write path) ·
ADR-469 v1.2 (orphaned-target latch — συνυπάρχει) · ADR-293 (`canonicalScenePath` SSoT) ·
ADR-098 (debounce 2000ms) · ADR-459 Φ7 (`stripForeignFloorBim`) · ADR-505 §A (`isBimEntity` SSoT) ·
ADR-354 Phase B (`resetSceneSession`)

---

## 1. Πρόβλημα — απώλεια δεδομένων, όχι ενόχληση

Στις **2026-07-26** τα επίπεδα «1ος Όροφος» (`lvl_2a7ff5cc`) και «Ισόγειο» (`lvl_dabeb3bb`)
βρέθηκαν να δείχνουν **στο ίδιο** `sceneFileId` (`file_751f0286`, που ανήκει στο Ισόγειο).

Ένα φυσικό `.scene.json` — δύο όροφοι το γράφουν. **Όποιος σώζει τελευταίος σβήνει τον άλλο.**

Μετρημένο στο ίδιο το blob (read-only, Storage MCP):

| | Πριν | Μετά |
|---|---|---|
| DXF οντότητες | 1169 (1154 line / 9 text / 6 arc) | **0** |
| BIM οντότητες | 12 κολόνες | 12 κολόνες |
| layers | 7 | 4 (μόνο `TOPO-*`) |
| bounds | πραγματικά | `{min:{0,0}, max:{0,0}}` |

Όλες οι 12 εναπομείνασες οντότητες είχαν `layerId: lvl_2a7ff5cc` — δηλαδή **ο 1ος Όροφος
έγραψε πάνω στο Ισόγειο**. Υπήρχε σωστό, **ορφανό** FileRecord του 1ου (`file_90ee1df2`,
`entityId: flr_4275c4c9`) που κανένα επίπεδο δεν δείχνει.

**Η ενέργεια που το πυροδότησε ήταν απολύτως νόμιμη:** ο χρήστης φόρτωσε το **ίδιο**
`Ισόγειο 1.dxf` σε δύο ορόφους και πρόσθεσε ξεχωριστά BIM στοιχεία στον καθένα. Καμία
εισαγωγή, καμία επεξεργασία — μόνο εναλλαγές ορόφου και reload.

> ⚠️ Το «ίδιο αρχείο σε δύο ορόφους» **δεν προκάλεσε** τη ζημιά. **Αποκάλυψε** ότι ο όροφος
> δεν ήταν μέρος της ταυτότητας πουθενά στη διαδρομή εγγραφής.

## 1.1 Οι τέσσερις ρίζες

Καμία τους δεν είναι επαρκής μόνη της. Και οι τέσσερις μαζί παράγουν την καταστροφή.

### Ρίζα 1 — Ταυτότητα = όνομα αρχείου, όχι όροφος

`DxfFirestoreService.findExistingFileRecord` ρωτούσε `companyId + originalFilename`,
**χωρίς `entityId`**. Με δύο FileRecords ίδιου ονόματος επέστρεφε αυθαίρετα το ένα.

Και η `fileIdCacheRef` ήταν **keyed by σκέτο `fileName`**: ο πρώτος όροφος που έσωζε
«δίδασκε» στην cache το δικό του `fileId` και ο δεύτερος το κληρονομούσε.

Το σχόλιο ακριβώς από πάνω προέβλεπε το σενάριο — *«never by fileName to avoid cross-file
contamination when two files share the same originalFilename»* — και θωράκιζε το
`scenePathCacheRef`, **αφήνοντας εκτεθειμένη τη cache του `fileId`**, που είναι η κρισιμότερη
από τις δύο: καθορίζει **ποιο αρχείο γράφεται**.

### Ρίζα 2 — Το save σχεδιαζόταν με το ένα κλειδί και εκτελούνταν με το άλλο

| Πότε | Τι διαβαζόταν |
|---|---|
| Τ₀ (scheduling) | `fileName = currentFileNameRef.current` |
| **Τ₀ + 2000 ms** (μέσα στο `setTimeout`) | `fileId = injectedFileRecordIdRef.current` |

Μια εναλλαγή ορόφου στο ενδιάμεσο καλούσε `setFileRecordId(...)` → **ο όροφος Α
προγραμμάτιζε την εγγραφή και ο όροφος Β την εκτελούσε.**

Το `resetDxfAutoSaveTarget()` μηδένιζε τα refs αλλά **δεν** έκανε `clearTimeout`. Μόνο το
`resetSceneSession` (ADR-354, super-admin company switch) ακύρωνε pending save.

### Ρίζα 3 — Ο cross-floor guard ήταν μόνο στην ανάγνωση

`isCrossFloorSceneLink` καλούνταν **μόνο** στο load path. Το `linkSceneToLevel`, που **γράφει**
το `sceneFileId`, είχε έναν μόνο έλεγχο: `if (level?.sceneFileId === fileId) return` — καθαρή
idempotency, **μηδενικός έλεγχος ορόφου**.

Η λάθος σύνδεση γραφόταν ελεύθερα και ανακαλυπτόταν αργότερα, όταν το μόνο που μπορούσε να
γίνει ήταν να μείνει ο όροφος άδειος. **Ο φρουρός ήταν στη λάθος πλευρά της πόρτας.**

### Ρίζα 4 — Το `onSceneSaved` δενόταν στον όροφο της ΟΛΟΚΛΗΡΩΣΗΣ

```ts
setOnSceneSaved((fileId) => { if (currentLevelId) linkSceneToLevel(currentLevelId, …); });
}, [currentLevelId, linkSceneToLevel, setOnSceneSaved]);   // ← αντικαθίσταται σε κάθε εναλλαγή
```
Το save του Α τελείωνε μετά την εναλλαγή → καλούσε το **νέο** callback →
`linkSceneToLevel(όροφος Β, fileId του Α)`. **Εδώ γράφτηκε** το
`lvl_2a7ff5cc.sceneFileId = file_751f0286`.

### Ρίζα 5 — Ο loader ρωτούσε «έχει κάτι;» αντί «έχει DXF;» *(εντοπίστηκε 2026-07-27)*

> Οι Ρίζες 1-4 εξηγούν **πού** γραφόταν η ζημιά. Η Ρίζα 5 εξηγεί **γιατί υπήρχε ζημιά να γραφτεί.**

Μετά την v1.0 ο φρουρός `isDxfWipe` **χτυπούσε στο runtime** (`execute-scene-save.ts:184`,
«αποτροπή εγγραφής που μηδενίζει τη γεωμετρία DXF»). Σωστά — αλλά αυτό σήμαινε ότι η σκηνή στη
μνήμη **όντως** έχανε τα DXF της. Ο φρουρός ήταν το σύμπτωμα· η αιτία ήταν στο load path:

```ts
// useLevelSceneLoader.ts — ΠΡΙΝ
if (existingScene && existingScene.entities.length > 0) return;   // «έχει κάτι;»
```

Το `reconcileLoadedSceneBim` (**ADR-390 Φ4**) πετά το BIM του snapshot ως παράγωγο cache, και τα
per-entity Firestore subscriptions (floorId-keyed) το ξαναγεμίζουν **ασύγχρονα**. Αν αυτά
προλάβουν το load, η in-memory σκηνή είναι **μόνο-BIM**: `entities.length > 0` → ο loader την
έκρινε «φορτωμένη» → **το DXF δεν κατέβαινε ΠΟΤΕ από το Storage**. Στη συνέχεια το auto-save
έγραφε αυτή τη μόνο-BIM σκηνή πάνω από το αρχείο — δηλαδή **παρήγαγε** ακριβώς την εγγραφή που
μπλοκάρει ο `isDxfWipe`.

**Fix:** η σωστή ερώτηση, με το **ίδιο SSoT που χρησιμοποιεί ο φρουρός**:

```ts
// ΜΕΤΑ
if (existingScene && countDxfEntities(existingScene) > 0) return;  // «έχει DXF;»
```

Ίδιο μοτίβο με το **ADR-469** («έχει κάτι;» → «έχει BIM;»), κατοπτρικά. Κρίσιμο ότι load και
guard μοιράζονται τον **ίδιο** ορισμό του «DXF»: δύο ορισμοί θα ξανάνοιγαν το κενό. Δεν
δημιουργείται re-fetch loop — το `loadedSceneLevelsRef` κρατά την προσπάθεια one-shot ακόμη κι
όταν το αρχείο όντως δεν έχει DXF οντότητες.

⚠️ **Μην «χαλαρώσεις» τον `isDxfWipe` για να πάψει να εμφανίζεται το μήνυμα.** Είναι σήμα, όχι
θόρυβος: αν ξαναχτυπήσει, κάποιος καταναλωτής ξαναρώτησε λάθος ερώτηση.

### 1.2 Γιατί δεν έπιασε το δίχτυ ασφαλείας

```ts
const isEmptyScene = scene.entities.length === 0;   // incident 2026-06-08
```
Η καταστροφική σκηνή είχε **12 κολόνες** ⇒ `12 > 0` ⇒ πέρασε και έγραψε 12 πάνω από 1181.

Ο φρουρός ρωτούσε **«είναι κενό;»** αντί για **«χάνεται ό,τι υπάρχει;»**.

---

## 2. Απόφαση

### 2.1 Το αμετάβλητο

> **Ένα save γράφει πάντα στο αρχείο του ορόφου που το γέννησε· ένα `sceneFileId` δεν αλλάζει
> ποτέ σε αρχείο άλλου ορόφου· ένα auto-save δεν μηδενίζει ποτέ τη DXF γεωμετρία μιας
> αποθηκευμένης σκηνής.**

### 2.2 Το μοντέλο δεδομένων: ένα DXF ανά όροφο

Απόφαση Giorgio (2026-07-26). Κάθε όροφος έχει **δικό του** FileRecord και **δικό του**
`.scene.json`, ακόμη κι όταν το αρχείο-πηγή είναι το ίδιο. Το σύστημα ήδη δημιουργούσε σωστά
ξεχωριστά FileRecords (`file_751f0286` / `file_90ee1df2`) — η αστοχία ήταν αποκλειστικά στο
ποιο από τα δύο διάλεγε η διαδρομή εγγραφής.

Απορρίφθηκε το μοντέλο Revit *linked model* / ArchiCAD *Hotlink* (N:M αρχείο↔όροφος): δεν
χρειάζεται όσο κάθε όροφος διατηρεί ανεξάρτητο snapshot, και θα εισήγαγε επίπεδο έμμεσης
αναφοράς χωρίς αντίκρισμα.

### 2.3 Ο μηχανισμός: Save Ticket

Revit (transaction με ρητό document target), Figma (κάθε operation φέρει το `fileKey` της),
ArchiCAD Teamwork (reserve-before-write) συγκλίνουν στην ίδια αρχή:

> **Το save φέρει μαζί του τον προορισμό του, αντί να τον διαβάζει από μεταβλητό ambient
> state τη στιγμή της εκτέλεσης.**

Το `SceneSaveTicket` (`hooks/scene/scene-save-ticket.ts`) είναι `Object.freeze`-αρισμένο και
παγώνει στο Τ₀ **ολόκληρη** την ταυτότητα: `levelId`, `floorId`, `companyId`, `userUid`,
`fileId`, `fileName`, `canonicalScenePath`, `saveContext`, `scene`.

Ο executor (`hooks/scene/execute-scene-save.ts`) **δεν διαβάζει κανένα `*Ref.current`**.

**Πλεονέκτημα έναντι του προφανούς «ακύρωσε το pending save στην εναλλαγή ορόφου»:
καμία απώλεια δουλειάς.** Το save του Α ολοκληρώνεται σωστά στον Α ακόμη κι αν ο χρήστης
βρίσκεται ήδη στον Β. Δεν χρειάζεται καν ακύρωση.

### 2.4 Πέντε στρώματα άμυνας

| # | Στρώμα | Πού | Τι σταματά |
|---|---|---|---|
| 1 | Παγωμένο ticket | `scene-save-ticket.ts` | Ρίζες 2 + 4 |
| 2 | Floor-scoped resolution | `findFloorFloorplanFileRecord` | Ρίζα 1 |
| 3 | Floor-scoped cache key | `${floorId}::${fileName}` | Ρίζα 1 (cache) |
| 4 | Write-side cross-floor guard | `executeSceneSave` + `linkSceneToLevel` | Ρίζα 3 (client) |
| 5 | **Server-side guard** | `/api/dxf-levels` PATCH/POST → **409** | Ρίζα 3 (μη παρακάμψιμο) |
| 6 | `isDxfWipe` | `executeSceneSave` | §1.2 |

Το **5** είναι το μόνο που δεν παρακάμπτεται: ο client δεν είναι έμπιστος. Χρησιμοποιεί το
**ίδιο pure predicate** `isCrossFloorSceneLink` (ADR-399) — dependency-free, άρα εκτελείται
αυτούσιο και στον διακομιστή. **Ένας ορισμός, δύο σημεία επιβολής.**

### 2.5 `isDxfWipe` — γιατί «μηδέν» και όχι ποσοστό

```ts
isDxfWipe(next, baseline) := baseline > 0 && countDxfEntities(next) === 0
```

Το αποτύπωμα της ζημιάς είναι ακριβώς **«DXF → 0 ενώ το BIM επιβιώνει»**, γιατί το BIM
ξαναγεμίζει από τα per-entity Firestore docs ενώ η DXF γεωμετρία ζει **μόνο** στο blob.

Ποσοστιαίο κατώφλι θα εισήγαγε false positives σε νόμιμες μαζικές διαγραφές. Το «έπεσε στο
απόλυτο μηδέν ενώ πριν υπήρχε» είναι **ντετερμινιστικό** και πρακτικά αδύνατο ως πρόθεση
χρήστη. Με άγνωστο baseline (`0`) επιστρέφει `false` — γνήσιο πρώτο save δεν μπλοκάρεται ποτέ.

Ο διαχωριστής DXF↔BIM είναι το υπάρχον SSoT `isBimEntityType` (`types/entities.ts`) — **καμία
δεύτερη λίστα τύπων**, όπως και στο `export/core/export-entity-scope.ts` (ADR-505 §A).

### 2.6 Θεραπεία παλαιών λάθος συνδέσμων

Απόφαση Giorgio: **αυτόματη αποσύνδεση + ειδοποίηση**. Όταν το load path πιάσει cross-floor
link, εκτός από την προστασία της σκηνής κάνει PATCH `sceneFileId: null` και εμφανίζει
`scene.crossFloorLinkCleared`. **Καμία σκηνή δεν διαγράφεται — μόνο ο λάθος σύνδεσμος.**

Χωρίς αυτό ο όροφος έμενε μόνιμα «άδειος με προειδοποίηση» και κάθε συνεδρία ξαναέτρεχε το
ίδιο αποτυχημένο load.

### 2.7 Object Versioning (υποδομή)

Το bucket ήταν `Suspended` — **γι' αυτό δεν υπήρχε τίποτα να ανακτηθεί**. Ενεργοποιείται
versioning + lifecycle 30 ημερών (`scripts/storage-lifecycle-30d.json`), το ισοδύναμο του
Revit `.0001.rvt` backup και του Figma version history.

---

## 3. Αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `hooks/scene/scene-save-ticket.ts` | **νέο** — pure· ticket + `countDxfEntities` + `isDxfWipe` |
| `hooks/scene/execute-scene-save.ts` | **νέο** — async executor· μηδενική πρόσβαση σε refs |
| `hooks/scene/useAutoSaveSceneManager.ts` | παγώνει το ticket στο Τ₀· floor-scoped cache key |
| `systems/levels/hooks/useLevelSceneLoader.ts` | `setLevelFloorScope`· baseline· write guard· θεραπεία |
| `services/dxf-firestore.service.ts` | `findFloorFloorplanFileRecord`· `getFileFloorScope` |
| `app/api/dxf-levels/dxf-levels.handlers.ts` | server-side 409· ξαναπετά τα `ApiError` |
| `i18n/locales/{el,en}/dxf-viewer.json` | `scene.*` μηνύματα (N.11) |

**N.7.1:** ο executor εξήχθη και για μέγεθος — η `setLevelSceneWithAutoSave` ήταν **154
γραμμές** με ~107 μέσα στο `setTimeout` (όριο: 40).

### 3.1 Παρενέργεια που διορθώθηκε

Το `catch` του `handleUpdateDxfLevel` **κατάπινε** κάθε `ApiError` και το μετέτρεπε σε
αδιάκριτο **500**. Το 409 του guard θα έφτανε στον χρήστη ως «κάτι έσπασε» αντί για «αυτό
απαγορεύεται και να γιατί». Προστέθηκε `if (error instanceof ApiError) throw error`, όπως
έκανε ήδη ο create handler.

---

## 4. Tests

| Suite | Τι κλειδώνει |
|---|---|
| `scene-save-ticket.test.ts` (10) | freeze· `isDxfWipe` στο **πραγματικό** σενάριο (1169→0 με 12 BIM)· fail-safe |
| `execute-scene-save-floor-scope.test.ts` (8) | **εναλλαγή ορόφου μέσα στο debounce δεν ανακατευθύνει την εγγραφή**· cross-floor block· cached path ≠ ιδιοκτησία· floor-scoped resolution |
| `cross-floor-guard.test.ts` (8) | server 409/404· null πάντα επιτρεπτό· κρίση με τον όροφο **μετά** το PATCH |

Σύνολο επηρεαζόμενων: **20 suites / 221 tests πράσινα**.

---

## 5. Changelog

- **2026-07-27 — v1.1 (🐛 ROOT-CAUSE — Ρίζα 5: γιατί η σκηνή έχανε τα DXF της, Opus 5).** UNCOMMITTED. Μετά την v1.0 ο φρουρός `isDxfWipe` **χτυπούσε στο runtime** — δηλαδή δούλευε, αλλά η αιτία έμενε ανοιχτή. **Root cause:** ο `useLevelSceneLoader` ρωτούσε `existingScene.entities.length > 0` («έχει κάτι;»). Επειδή το `reconcileLoadedSceneBim` (ADR-390 Φ4) πετά το BIM του snapshot και τα per-entity subscriptions το ξαναγεμίζουν **ασύγχρονα**, μια in-memory σκηνή μπορεί να είναι **μόνο-BIM** — φαίνεται «φορτωμένη» ενώ έχει **μηδέν** DXF → early return → **το DXF δεν κατέβαινε ποτέ** → το auto-save έγραφε τη μόνο-BIM σκηνή, δηλαδή **παρήγαγε** την εγγραφή που ο φρουρός μπλοκάρει. **Fix (1 γραμμή, μηδέν νέα αφαίρεση):** `countDxfEntities(existingScene) > 0` — το **ίδιο SSoT** που χρησιμοποιεί ο `isDxfWipe`, ώστε load και guard να μην μπορούν να αποκλίνουν στον ορισμό του «DXF». Ίδιο μοτίβο με ADR-469 («έχει κάτι;»→«έχει BIM;»), κατοπτρικά. Καμία re-fetch loop: το `loadedSceneLevelsRef` κρατά την προσπάθεια one-shot. **Tests:** +2 cases στο `scene-save-ticket.test.ts` που καρφώνουν ρητά την **απόκλιση** που προκάλεσε το bug (μόνο-BIM σκηνή: `entities.length > 0` **ΑΛΛΑ** `countDxfEntities === 0` **ΚΑΙ** `isDxfWipe === true`) — προστατεύουν **και τους δύο** καταναλωτές από μελλοντική «απλοποίηση» σε `entities.length`. `hooks/scene` + `systems/levels` → **18 suites / 198 tests** PASS. **Ειλικρινής επιφύλαξη:** η ίδια η γραμμή του loader **δεν** καλύπτεται από test (ο hook θα απαιτούσε βαρύ mocking Firestore/Storage)· καλύπτεται η **σύμβαση** που καταναλώνει, και το call site είναι μονογραμμική κλήση του SSoT. **ΟΧΙ tsc (N.17).** 🔴 browser-verify: άνοιξε όροφο με BIM **και** DXF → hard reload → το DXF εμφανίζεται· **καμία** εμφάνιση «[SceneSave] ADR-714 — αποτροπή εγγραφής».
- **2026-07-26 — v1.0.** Αρχική υλοποίηση. Save Ticket· floor-scoped resolution + cache key·
  write-side guard (client + server)· `isDxfWipe`· αυτόματη θεραπεία λάθος συνδέσμων·
  Object Versioning. Ρίζα: περιστατικό απώλειας 537→0 DXF οντοτήτων σε δύο ορόφους.
