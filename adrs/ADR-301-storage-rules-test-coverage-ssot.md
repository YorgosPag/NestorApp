# ADR-301 — Storage Rules Test Coverage SSoT

**Status:** Accepted  
**Date:** 2026-04-14  
**Authors:** YorgosPag  
**Related:** ADR-031 (File Storage System), ADR-298 (Firestore Rules Coverage)

---

## 1. Context

`storage.rules` is the security boundary for all Firebase Storage uploads,
reads, and deletes in the Nestor platform. As of 2026-04-14 it contains
**4 top-level match path patterns**:

| Path Pattern | Lines | Operations |
|---|---|---|
| `/companies/{cId}/projects/{pId}/entities/…/files/{f}` | 172-201 | read, write, delete |
| `/companies/{cId}/entities/…/files/{f}` | 212-229 | read, write, delete |
| `/cad/{userId}/{fileId}/{fileName}` | 238-249 | read, write, delete |
| `/temp/{userId}/{fileName}` | 258-265 | read+write, delete |

Prior to this ADR, Storage rules had **zero automated test coverage**. Any
change to `storage.rules` could silently break tenant isolation, owner access,
or super_admin bypass paths. The existing ADR-298 Firestore rules coverage
pattern provided a proven blueprint to replicate for Storage.

---

## 2. Decision

Create a dedicated Storage rules test harness at `tests/storage-rules/`
modelled on the Firestore harness (ADR-298) but adapted for the Storage
emulator API (`@firebase/rules-unit-testing` v5 — `ctx.storage()`).

### 2.1 Architecture

```
tests/storage-rules/
  _harness/
    emulator.ts          ← initStorageEmulator() / teardownStorageEmulator() / resetStorageData()
    auth-contexts.ts     ← getStorageContext(env, persona) → RulesTestContext
    seed-helpers.ts      ← seedStorageFile(env, path) — bypasses rules for arrange phase
    assertions.ts        ← assertStorageCell(ctx, cell, target) — dispatches read/write/delete
  _registry/
    personas.ts          ← StoragePersona type + PERSONA_CLAIMS (SRP copy from firestore registry)
    operations.ts        ← StorageOperation = 'read' | 'write' | 'delete'
    coverage-manifest.ts ← STORAGE_RULES_COVERAGE (SSoT) + STORAGE_RULES_PENDING
  suites/
    canonical-path-with-project.storage.test.ts
    canonical-path-no-project.storage.test.ts
    cad-files.storage.test.ts
    temp-uploads.storage.test.ts
```

### 2.2 Emulator configuration

Storage emulator: `localhost:9199` (matches `firebase.json`).  
Init: `initializeTestEnvironment({ storage: { rules, host, port } })`.  
Reset: `env.clearStorage()` in `afterEach`.

### 2.3 Coverage matrix

Each path registers a `matrix: readonly StorageCoverageCell[]` of
`(persona × operation)` cells. Four storage personas are used:

| Persona | UID | companyId | globalRole |
|---|---|---|---|
| `super_admin` | `persona-super-admin` | `company-root` | `super_admin` |
| `same_tenant_user` | `persona-same-user` | `company-a` | `internal_user` |
| `same_tenant_admin` | `persona-same-admin` | `company-a` | `company_admin` |
| `cross_tenant_user` | `persona-cross-user` | `company-b` | `internal_user` |
| `anonymous` | — | — | — |

For owner-based paths (`cad/`, `temp/`), `same_tenant_user` acts as the
**file owner** — the path embeds `OWNER_USER_UID = 'persona-same-user'`.

### 2.4 Seed-before-read/delete pattern

Firebase Storage emulator returns `storage/object-not-found` (not
`storage/unauthorized`) when a file does not exist. Without pre-seeding,
deny assertions on `read` and `delete` would pass for the wrong reason. Every
test seeds the target file via `withSecurityRulesDisabled` before running
read/delete cells.

### 2.5 Write path strategy

Write cells use a unique path suffix (`path--write-<timestamp>`) to ensure
the emulator sees a **CREATE** operation. This avoids routing through a
potential UPDATE path and ensures the `allow write` gate is exercised cleanly.

---

## 3. CHECK 3.19 — Zero-tolerance coverage gate

`scripts/check-storage-rules-test-coverage.js` enforces:

| Validation | What is checked |
|---|---|
| **A** | Every `match` block in `storage.rules` is in COVERAGE (by `rulesRange`) or `STORAGE_RULES_PENDING` |
| **B** | Every COVERAGE entry has an existing test file at `testFile` path |
| **C** | Each test file exports `COVERAGE` and references its `pathId` |
| **D** | Each test file iterates via `for (const cell of COVERAGE.matrix)` |

**Trigger:** commits that stage `storage.rules` or any file under
`tests/storage-rules/`.

**Pre-commit hook:** CHECK 3.19 block inserted between CHECK 3.17 and CHECK 4.

**NPM scripts:**
```bash
pnpm test:storage-rules             # run suites (requires emulator)
pnpm test:storage-rules:emulator    # auto-start emulator + run suites
pnpm storage-rules:coverage:audit   # full scan of CHECK 3.19
pnpm storage-rules:emulator         # start emulator for manual testing
```

---

## 4. ✅ ΛΥΜΕΝΟ (2026-07-26) — `temp/` read + `isValidFileSize()`

Ο κανόνας ήταν:
```
allow read, write: if isOwner(userId) && isValidFileSize();
```

Το `isValidFileSize()` διαβάζει `request.resource.size`. Στο **read** το
`request.resource` είναι `null` στα Firebase Storage Rules ⇒ ο κανόνας αποτύγχανε
⇒ **ο ιδιοκτήτης δεν μπορούσε να διαβάσει τα δικά του `temp/` αρχεία**.

**Τι έγινε**: το §4 προέβλεψε ρητά «αν ο emulator απορρίψει αυτό το cell, το test
αποτυγχάνει και εκθέτει το λανθάνον σφάλμα». Την **πρώτη φορά που το suite έτρεξε
πραγματικά σε emulator** (2026-07-26) συνέβη ακριβώς αυτό: `temp-uploads.storage`
`same_tenant_user × read` → `storage/unauthorized`. Εφαρμόστηκε η προδιαγεγραμμένη
διάσπαση — αυτούσια:
```
allow read: if isOwner(userId);
allow write: if isOwner(userId) && isValidFileSize();
allow delete: if isOwner(userId);
```
Μετά: **8 suites / 111 tests πράσινα**. Καμία άλλη διαδρομή δεν είχε το ίδιο σχήμα
(μοναδικό `allow read, write` του αρχείου· παντού αλλού το `isValidFileSize()`
είναι μόνο σε `write`).

**Το δίδαγμα**: ένα καταγεγραμμένο «known caveat» με σωστά γραμμένο test παρέμεινε
λανθάνον για **3 μήνες** επειδή το suite δεν είχε τρέξει ποτέ. Η καταγραφή δεν
αντικαθιστά την εκτέλεση.

---

## 5. 🔴 Παγίδα εκκίνησης του Storage emulator — warnings > 8 KB = σιωπηλό κρέμασμα

**Ο λόγος που το suite δεν είχε τρέξει ΠΟΤΕ** (διαγνώστηκε 2026-07-26). Το
`firebase emulators:start --only storage` κρεμούσε επ' αόριστον, **χωρίς κανένα
μήνυμα σφάλματος**: το hub έδενε στο 4400, το **9199 δεν έδενε ποτέ**.

**Μηχανισμός** (`firebase-tools/lib/emulator/storage/rules/runtime.js:123-133`): ο
rules-runtime (Java) επιστρέφει το αποτέλεσμα μεταγλώττισης ως **ένα** JSON μήνυμα
στο stdout, και το firebase-tools κάνει `JSON.parse` **ανά chunk του `data` event**,
υποθέτοντας ότι ένα chunk = ένα πλήρες μήνυμα. Στα Windows το pipe παραδίδει σε
τεμάχια των **8192 bytes**. Το `storage.rules` παρήγαγε **25 warnings** (κυρίως
«Unused function», το καθένα με πλήρες σειριοποιημένο protobuf `sourcePosition_`)
⇒ απάντηση **~25 KB** ⇒ `JSON.parse` απέτυχε **ακριβώς στη θέση 8192** ⇒ ο handler
του `id:0` δεν κλήθηκε ποτέ ⇒ το `loadRuleset` δεν επιλύθηκε ⇒ ο emulator δεν
προχώρησε ποτέ σε listen. Το catch κάνει `log('INFO', …)` και **`return`** — γι' αυτό
το μόνο ορατό σύμπτωμα ήταν ένα ωμό JSON blob στην κονσόλα.

**Αφορά και τα tests**: το `initializeTestEnvironment` ανεβάζει τους πραγματικούς
κανόνες μέσω `setRules`, που περνά από τον **ίδιο** parser. Μετρήθηκε: το jest
κρέμασε >5 λεπτά με μηδέν έξοδο ακόμα και με ήδη ανεβασμένο emulator.

**Συνέπεια — αναλλοίωτο που πρέπει να κρατηθεί**:

> ### Το `storage.rules` ΟΦΕΙΛΕΙ να μεταγλωττίζεται χωρίς warnings.
> Δεν είναι αισθητική: ένα warning-ful αρχείο κάνει **ολόκληρη** τη σουίτα
> storage-rules μη εκτελέσιμη, και το σύμπτωμα είναι κρέμασμα χωρίς μήνυμα.

Αφαιρέθηκαν 10 συναρτήσεις που ο ίδιος ο μεταγλωττιστής χαρακτήριζε «Unused»
(`extractFileId`, `getFileRecordPath`, `hasPendingFileRecord`,
`fileRecordMatchesPathSimple/WithProject`, `storagePathEquals`,
`hasFileRecordWithPath`, `hasReadyFileRecord`, `isFileCreator`, `isImageType`,
`isPDFType`). Ήταν cross-service Firestore lookups **ήδη εγκαταλελειμμένες ρητά για
λόγους latency** (βλ. τα `NOTE:` στα blocks) — μηδενική αλλαγή συμπεριφοράς σε
οποιονδήποτε κανόνα, επιβεβαιωμένη από 111/111 πράσινα. Ιστορικό: git +
`storage.rules.enterprise`.

**Δύο ακόμα εμπόδια της ίδιας συνεδρίας**:
- Το repo **δεν έχει `.firebaserc`** και το `firebase-tools` **δεν είναι τοπική
  εξάρτηση** (μόνο global) ⇒ το `npx firebase …` προσπαθούσε να το κατεβάσει και
  περίμενε σιωπηλά επιβεβαίωση. Τα npm scripts καρφώθηκαν σε
  `--project demo-nestor` (το πρόθεμα `demo-` = πλήρως τοπικό, χωρίς διαπιστευτήρια).
- Ορφανές διεργασίες κρατούν 4400/9199 μετά από kill. **Πάντα πρώτα**:
  `netstat -ano | grep -E ":(9199|4400)\b"`.

Μία εντολή, από την αρχή: `npm run test:storage-rules:emulator`.

---

## 6. Scope boundaries

This ADR covers **storage.rules only**. Firestore rules remain under ADR-298.

The two systems are intentionally separate:
- Different emulator ports (Firestore: 8080, Storage: 9199)
- Different SDKs (`ctx.firestore()` vs `ctx.storage()`)
- Different test manifests and check scripts
- Shared persona model (SRP duplicate — not cross-imported)

---

## 7. Phase history

| Phase | Date | What |
|---|---|---|
| **A** | 2026-04-14 | Harness + manifest + 4 suites + CHECK 3.19 + ADR-301 |
| **Β — ΠΡΩΤΗ ΕΚΤΕΛΕΣΗ** | 2026-07-26 | Το suite έτρεξε **για πρώτη φορά** σε emulator: **8 suites / 111 tests πράσινα**. Άρθηκε η παγίδα του §5· διορθώθηκε το §4· τα npm scripts έγιναν εκτελέσιμα |

---

## 8. Changelog

| Date | Change |
|---|---|
| 2026-04-14 | Initial ADR accepted. Phase A complete: 4 paths, 48 cells, CHECK 3.19. |
| 2026-07-26 | **Η ΣΟΥΙΤΑ ΕΤΡΕΞΕ ΓΙΑ ΠΡΩΤΗ ΦΟΡΑ — 8 suites / 111 tests πράσινα σε πραγματικό emulator.** Μέχρι σήμερα ήταν **δηλωμένη** κάλυψη, όχι αποδεδειγμένη (το μοτίβο «anchor χωρίς gate» του ADR-587 §6.1). **Ρίζα**: §5 — 25 compiler warnings φούσκωναν την απάντηση του rules-runtime στα ~25 KB, το firebase-tools κάνει `JSON.parse` ανά chunk, και το Windows pipe κόβει στα **8192 bytes** ⇒ αποτυχία parse **ακριβώς στη θέση 8192** ⇒ το handshake δεν ολοκληρωνόταν ποτέ ⇒ κρέμασμα χωρίς μήνυμα (μετρημένο, όχι εικασία). Αφαιρέθηκαν 10 συναρτήσεις που ο μεταγλωττιστής χαρακτήριζε «Unused» — μηδέν αλλαγή συμπεριφοράς κανόνα. **Ευρήματα της πρώτης εκτέλεσης**: (1) `temp-uploads · same_tenant_user × read` **κόκκινο** ⇒ επιβεβαίωσε το λανθάνον σφάλμα που το §4 προέβλεπε 3 μήνες πριν· εφαρμόστηκε η προδιαγεγραμμένη διάσπαση `read`/`write`/`delete` ⇒ ο ιδιοκτήτης διαβάζει ξανά τα `temp/` του. (2) `bim-comment-attachments` **10/12** — τα δύο `write → allow` cells απέτυχαν επειδή το suite δεν έδινε `contentType` και το default του harness (`application/octet-stream`) απορρίπτεται επίτηδες από αυτό το path· προστέθηκε `ATTACHMENT_CONTENT_TYPE` (μοτίβο `topo-surfaces`) **+ 4 νέα content-type pins** (JPEG allow ⇒ το σκέλος `jpe?g` είναι ζωντανό· SVG/WebP/octet-stream deny ⇒ η άμυνα stored-XSS του ADR-366 §12 είναι πλέον **δοκιμασμένη**, όχι μόνο γραμμένη) ⇒ **16/16**. **Εκτελεσιμότητα**: το repo δεν έχει `.firebaserc` και το `firebase-tools` δεν είναι τοπική εξάρτηση ⇒ τα `test:storage-rules:emulator` / `storage-rules:emulator` καρφώθηκαν σε `--project demo-nestor`. **CHECK 3.19 OK** (19 blocks / 8 coverage / 11 pending)· `jscpd:diff` καθαρό· ΟΧΙ tsc (N.17). |
