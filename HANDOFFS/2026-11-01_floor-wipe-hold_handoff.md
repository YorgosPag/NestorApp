# HANDOFF — 🧹 Floor wipe (ADR-340) σβήνει `FileRecord` + bytes ΧΩΡΙΣ κριτή δέσμευσης

**Ημερομηνία:** 2026-11-01 · **Από:** διάδοχος του claude-6e (εργασία «🗑️ purge συνοδευτικών», ΕΚΛΕΙΣΕ — όλη στο `main` `033fb04b`)
**Πηγή:** `.claude-rules/pending-ratchet-work.md` → μπλοκ «🧹 Floor wipe (ADR-340) σβήνει `FileRecord` + bytes ΧΩΡΙΣ κριτή δέσμευσης»
(ΜΕΣΑΙΑ — ΓΚΠΔ/legal hold) · τεκμηρίωση: ADR-899 §2.2.1 (πίνακας «πόρτες οριστικής διαγραφής»).
Ο κώδικας είναι η αλήθεια· **ξαναδιάβασε το μπλοκ** πριν ξεκινήσεις.

## ⚠️ ΒΗΜΑ 0 — ΧΩΡΟΣ ΕΡΓΑΣΙΑΣ (ADR-925): το worktree ΔΕΝ υπάρχει ακόμη
- Στόχος: worktree `C:\Nestor_Worktrees\floor-wipe-hold` · κλαδί `agent/floor-wipe-hold` (από `main`), με `npm run wt:new -- floor-wipe-hold`
  (= `node scripts/agent-worktree.js new floor-wipe-hold`).
- **Μετρημένο εμπόδιο (2026-11-01):** το `wt:new` εγκαθιστά `pnpm install --offline --frozen-lockfile` και το store του C:
  (`store-dir=~/.pnpm-store` στο `.npmrc` ⇒ `C:\Users\Computer\.pnpm-store`) είναι **άδειο** (0 bytes· `reused 0`, πρώτο λείπον
  `@types/geojson@7946.0.16`). Το γεμάτο store είναι το `N:\.pnpm-store` — άλλος δίσκος, hardlinks αδύνατα. Η αποτυχία **σβήνει**
  worktree + κλαδί (σωστά — «μισό αντίγραφο»). Ο C: έχει ~9.7 GB ελεύθερα (96%).
- **Επιδιόρθωση (απόφαση Giorgio — κατεβάζει από το δίκτυο):** μία φορά `pnpm fetch` μόνο από το lockfile, σε φάκελο του C: που περιέχει
  αντίγραφα των `pnpm-lock.yaml` + `pnpm-workspace.yaml` + `.npmrc` (πρακτική pnpm για CI/Docker cache warming) ⇒ γεμίζει το
  `~/.pnpm-store`· μετά το `wt:new` δουλεύει offline, όπως προβλέπει το ADR-925. Εκτίμηση 1.5–3 GB (~1.885 πακέτα).
- Μόλις υπάρξει το worktree: **μετακίνησε αυτό το handoff** στο `HANDOFFS/` του worktree και κάνε commit στο `agent/floor-wipe-hold`.
- Αν ο Giorgio αποφασίσει αλλιώς (δουλειά στο κοινό `N:\`), ισχύουν οι κανόνες κοινού tree: ΟΧΙ commit/add/stash/checkout.

---

## 0. ΚΑΝΟΝΕΣ
- Ελληνικά πάντα. Commit **μόνο** στο `agent/floor-wipe-hold`, με **ρητή λίστα αρχείων** (`git add -- <αρχεία>`, ποτέ `-A`/`.`).
  **ΟΧΙ** commit στο `main`. **`wt:land` και `push` = μόνο με εντολή Giorgio.** Deploy / εγγραφή σε βάση / backfill `--apply` /
  λήψεις από δίκτυο = απόφαση Giorgio (εσύ μόνο dry-run / ανάγνωση).
- `git` ⇒ `git -c safe.directory='*' …`. ΟΧΙ `tsc` (N.17). Jest **μόνο στοχευμένα**, πάντα `run_in_background`, με σεβασμό στο
  `C:\Users\Computer\.claude\heavy-task.lock` (βλ. §4).
- **SSoT audit με grep ΠΡΙΝ από κώδικα.** Μέτρα, μην υποθέτεις: κάθε «0» επαληθεύεται σε **γνωστό θετικό**.
- Κάθε διόρθωση ⇒ άγκυρα + **μετάλλαξη** (backup → χάλασμα → jest κόκκινο → επαναφορά στην ίδια εντολή → `grep -c`).
  ⚠️ Μάθημα 2026-10-31: **ποτέ δύο scripts μετάλλαξης ταυτόχρονα** — το ένα μόλυνε την «πράσινη» εκτέλεση του άλλου.
  ⚠️ Ανιχνευτής κειμένου μπορεί να μείνει **πράσινος** στη μετάλλαξη (η Κ1 έπιανε μόνο `.file(p).delete(`, όχι
  `const f = bucket.file(p); … f.delete()`). Μη κοκκίνισε ⇒ **ενίσχυσε τον ανιχνευτή**, μην το προσπεράσεις.
- Ποιότητα «μεγάλων παικτών» (Google Drive/Vault · Box · Microsoft Purview · S3 lifecycle), full enterprise + full SSoT, χωρίς εκπτώσεις.
  Αβεβαιότητα ⇒ έρευνα στο διαδίκτυο.

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (μην το ξανακάνεις) — όλα στο `main` (`033fb04b` · `26d03c7b`)
**ΜΙΑ αγωγός οριστικής διαγραφής αρχείου**: cron εφαρμογής (`lib/cron/jobs/file-purge.job.ts`, Φάση Α:
`isDeleted == true && purgeAt <= now`) → `isFileHeld` (`services/file-record/file-purge-helpers.ts`) → `purgeFileRecord` →
`deleteStorageObjectForPurge` (πρωτότυπο **πρώτα**· άρνηση ⇒ τίποτα) → `deleteFileCompanions` (`file-companion-purge.ts`: μητρώο
`lib/files/file-companion-objects.ts` ∪ δείκτες εγγραφής, φρουρός `isCompanionPathOf`, 404 = αθώο, άλλο σφάλμα ⇒ `refused` ⇒ **όχι**
`purged`) → επιτύμβιο `purgedRecordFields` (`purgeAt: null`) + γραμμή στο βιβλίο του κατόχου (`recordFileAudit`).

| πόρτα | κατάσταση |
|---|---|
| cron · ΓΚΠΔ (`app/api/files/gdpr-delete`) · εργαλείο AI (`file-lifecycle-handler`) | ✅ ένας γραφέας + `isFileHeld` |
| cascade οντότητας (`lib/firestore/deletion-guard.ts` `CASCADE_PRESERVATION` + `deletion-storage-cleanup.ts`) | ✅ |
| `scheduledFilePurge` (Functions) | ✅ **αφαιρέθηκε** από τον κώδικα (deploy = Giorgio) |
| `onDeleteFloorplanBackground` (Functions) | ✅ **παραδίδει στον κάδο** (`fileTrashFields`, `purgeAt = τώρα`) |
| **floor wipe** | ❌ **← Η ΕΡΓΑΣΙΑ ΣΟΥ** |

SSoT που υπάρχουν: `isFileHeld(data)` · `purgedRecordFields(now)` · `purgeFileRecord(params)` · `fileTrashFields({trashedState, by,
purgeAt, now})` (`lib/files/file-trash-fields.ts`) · `FILE_LIFECYCLE_STATES` (`config/file-lifecycle-states.ts`, ξαναεξάγεται από
`domain-constants`) · `fileCompanionCandidates` / `companionTargetsOf` · `CASCADE_PRESERVATION` (μοτίβο «κρατημένο μένει, με ίχνος»).

## 2. Η ΕΡΓΑΣΙΑ — ΜΕΤΡΗΜΕΝΑ (audit 2026-11-01, `main` @ `0b8fd963`)
**Αρχεία** (`src/services/floorplan-background/`): `floorplan-floor-wipe.service.ts` (`executeWipe`, `preview`) ·
`floor-wipe-storage.ts` (`deleteStorageObjects`, `sweepFloorCategoryPath`) · `floor-wipe-queries.ts` (`listAllFloorFileRows`,
`loadFileRows` — `FileRow` = `{ ref, storagePath, storagePlacement }`· **δεν** κρατά πεδία δέσμευσης) ·
**ένας** καλών: `app/api/floorplans/wipe-floor/route.ts` (GET = `preview`, POST = `wipeAllForFloor`) — UI: διάλογος επιβεβαίωσης.
Tests: `__tests__/floor-wipe-storage.test.ts` · `__tests__/floorplan-floor-wipe-view-scope.test.ts` (in-memory Firestore) ·
`services/__tests__/ownership-empty-pair-services.test.ts` (αναφέρει `floor-wipe-queries`).

**Ελαττώματα (όλα μετρημένα στον κώδικα):**
1. **Καμία δέσμευση**: 0 `isFileHeld` στον φάκελο ⇒ αρχείο με legal hold / `isPreserved` / record (Πρωτόκολλο παράδοσης) σβήνεται οριστικά.
2. **Λάθος σειρά**: `deleteRefsInChunks(fileRows)` (εγγραφές) **πριν** από `deleteStorageObjects` (bytes), και τα bytes είναι
   «non-blocking». Αποτυχία bytes ⇒ η εγγραφή — ο **μόνος** δείκτης — έχει ήδη χαθεί (παραβίαση ADR-864 §21 · ADR-895 Ρ3).
3. **Η σάρωση προθέματος αγνοεί δέσμευση**: `sweepFloorCategoryPath` σβήνει **ό,τι** ζει κάτω από τον φάκελο κατηγορίας σε κάθε κάδο ⇒
   ακόμη κι αν παρακαμφθεί η εγγραφή κρατημένου αρχείου, τα bytes του σβήνονται (GCS `temporaryHold` αρνείται — αν έχει μπει).
4. **Δεύτερος ορισμός «τι ανήκει σε αρχείο»**: `deleteStorageObjects` = σάρωση προθέματος `storagePath` ⇒ πιάνει `{path}.thumbnail.png`,
   **όχι** τα συνοδευτικά στελέχους (`{id}_thumb.webp`, `{id}.scene.json`) — τα σώζει μόνο η σάρωση φακέλου. Διπλότυπο του μητρώου.
5. **Hard delete χωρίς επιτύμβιο και χωρίς γραμμή στο βιβλίο του κατόχου** (όλες οι άλλες πόρτες γράφουν και τα δύο).
6. **Η προεπισκόπηση** (`preview` → `fileRecordCount`) δεν λέει πόσα **κρατούνται** ⇒ ο άνθρωπος δεν μαθαίνει τι δεν θα σβηστεί.

## 3. ΚΑΤΕΥΘΥΝΣΗ (να επικυρωθεί με έρευνα — όχι δόγμα)
- Πρότυπο Vault/Purview: η δέσμευση **υπερισχύει** κάθε διαγραφής· το αρχείο **μένει** και ο χρήστης ενημερώνεται (όχι σιωπηλά).
- SSoT: το wipe **δεν** σβήνει bytes `FileRecord` μόνο του. Μη κρατημένες ⇒ **ένας γραφέας** (`purgeFileRecord`, άμεσα — το wipe είναι
  σύγχρονο «replace» πριν από νέο ανέβασμα) **ή** παράδοση στον κάδο (`fileTrashFields`, όπως το CF). Ζύγισε: το replace θέλει
  **καθαρό όροφο τώρα** ⇒ πιθανότατα άμεσο `purgeFileRecord` ανά εγγραφή, με επιτύμβιο αντί hard delete.
  ⚠️ Το `floor-wipe-queries` βρίσκει **και** επιτύμβια/κάδο αν φιλτράρει μόνο κατά `floorId` — έλεγξε ότι δεν ξανα-«σβήνει» `purged`.
- Κρατημένες ⇒ **μένουν** + **εκτός** σάρωσης προθέματος (εξαίρεση των αντικειμένων τους — `storagePath` + `companionTargetsOf` — ή
  σάρωση μόνο όταν δεν υπάρχει κρατημένο στον όροφο). Απάντηση με αριθμό `held`.
- `preview` ⇒ `heldFileCount` (και i18n στο διάλογο — `locales/{el,en}` — αν αγγίξεις UI: N.11, όχι σκληρά κείμενα).
- Η σάρωση φακέλου μένει ως δίχτυ για παλιά ορφανά (ADR-709), **με** φρουρό δέσμευσης.

## 4. ΠΕΡΙΒΑΛΛΟΝ (μετρημένο)
- Jest στο worktree: `cd /c/Nestor_Worktrees/floor-wipe-hold && node node_modules/jest/bin/jest.js <ονόματα> > <scratchpad>/out.txt 2>&1`
  (`run_in_background: true`). Στο κοινό `N:\`: config στο scratchpad με `rootDir: //giorgio-pc/Nestor_Pagonis` και
  `roots: [src, scripts, functions/src]`. Τα `functions/src/**` tests τα πιάνει ο root `jest.config.js` (δεν υπάρχει `functions/jest.config`).
  Πριν: `L=/c/Users/Computer/.claude/heavy-task.lock; until [ ! -f $L ] || [ $(( $(date +%s) - $(stat -c %Y $L) )) -gt 1200 ]; do sleep 10; done`.
- Grep σε μεγάλους φακέλους λήγει σιωπηλά (ψεύτικο 0) ⇒ script `node` που διασχίζει τον φάκελο, με θετικό έλεγχο.
- Heredoc / `node -e` τρώνε `\` και backticks ⇒ Write/Edit ή script `.js` στο scratchpad.
- Προβολή Functions: `node scripts/generate-functions-projection.js` + `node scripts/check-functions-projection.js` (CHECK 3.93).
  ⚠️ Ο γεννήτορας γράφει **ένα αρχείο ανά καταχώριση `constants`** — δύο εξαγωγές του ίδιου module συγκρούονται σιωπηλά (τομέας πυλών).
- Μέτρηση παραγωγής (ΜΟΝΟ ανάγνωση): `firebase-admin` + `.env.local` `FIREBASE_SERVICE_ACCOUNT_KEY`· το μητρώο συνοδευτικών εισάγεται
  απευθείας (`.ts` φύλλο, Node 24 type-stripping). Χρήσιμη μέτρηση: πόσες εγγραφές `files` με `floorId` έχουν δέσμευση / `preservedFor`
  / `handoverProtocolOf` (αν 0 σήμερα ⇒ λανθάνον, αλλά πραγματικό).

## 5. ΑΝΟΙΧΤΑ ΑΠΟ ΤΗΝ ΠΡΟΗΓΟΥΜΕΝΗ ΕΡΓΑΣΙΑ (για ενημέρωση)
- ⏳ Giorgio: `firebase deploy --only functions` (θα ρωτήσει διαγραφή `scheduledFilePurge` — «ναι»).
- 2 `.scene.json` στον κάδο χωρίς εγγραφή (`file_bc4d2885-…` · `file_7cd206cc-…`) — άγνωστα, **όχι** διαγραφή (ADR-694).
- Το cron `file-purge` κάνει `limit(100)`/διαμέρισμα/ημέρα — σήμερα 13 στον κάδο· ξαναμέτρηση αν μεγαλώσει.
- Άλλοι πράκτορες (2026-11-01): claude-30 → 🔌 hooks προμηθειών με ωμό `fetch` · claude-89 → έκλεισε την εμβέλεια CDE στα εργαλεία
  αρχείων AI· άφησε ΥΨΗΛΗ «τρία εργαλεία ανάγνωσης παρακάμπτουν το `enforceRoleAccess`» (θέλει απόφαση Giorgio).

## 6. ΣΤΟ ΤΕΛΟΣ
Μπλοκ pending (✅ + τι έμεινε) + **μία γραμμή στην κορυφή** του `## Changelog` (ξαναδιάβασέ το αμέσως πριν) + ADR-899 §2.2.1 (γραμμή
«floor wipe» του πίνακα) και/ή ADR-340. Commit στο `agent/floor-wipe-hold` με ρητή λίστα. Σύνοψη στα ελληνικά: τι άλλαξε / τι ελέγχθηκε
(jest + μετάλλαξη + μετρήσεις) / τι **δεν** ελέγχθηκε (typecheck · jscpd · browser · deploy) / τι έμεινε / ποια αρχεία.
