# HANDOFF — ADR-929: βαθμολογητής ρόλων + ζωντανή Φ5.5 έγιναν · η εύρεση ζευγών έδειξε ότι το κριτήριο καταγραφής είναι άκυρο (2026-11-08)

**Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` · **Κλαδί:** `agent/raster-plan-recognition`. Η νέα συνεδρία
συνεχίζει **εδώ**. Commit μόνο στο κλαδί, με ρητή λίστα αρχείων. `wt:land` + push **μόνο με εντολή Giorgio**. Στο `main` κανένα commit.

## 0. Κατάσταση (μετρημένη)
- `main` = `origin/main` = `5cf4c4a4` (Βήμα 3), **live** στο Netcup (`/api/build-info` → `5cf4c4a4…`).
- Κλαδί **μπροστά από το main κατά 5 commits** (κανένα δεν έχει γίνει land/push):
  `e0ea45b2` handoff · `12d344e9` ADR §6.9 tests+μεταλλάξεις · `d561b30c` **βαθμολογητής ρόλων** (κώδικας) ·
  `d8da07d5` ADR §6.8 ζωντανή Φ5.5 · `a311463f` ADR §6.9 #6 εύρεση ζευγών. (+ αυτό το handoff.)
- P = `src/subapps/dxf-viewer/bim/plan-recognition`. Πλήρες κείμενο: ADR-929 **§6.8, §6.9 #5, §6.9 #6**.

## 1. Τι έγινε (μην το ξανακάνεις)
- **§6.9 tests (με έγκριση):** 33/33. Μεταλλάξεις: κέντρο→άκρη ✅ · χωρίς Hartley ✅ · **χωρίς snooping τελευταίου γύρου 🔴 επέζησε**
  (κανένα test του `registerToInk` δεν φέρνει χονδροειδές σφάλμα στον τελευταίο γύρο). Προτάθηκε test, **δεν** προστέθηκε.
- **Βαθμολογητής ρόλων** `P/testing/role-scoring/` (`role-scoring-types` · `match-truth` · `role-confusion` (`scoreRoles`) · `span-check` (`checkSpans`)):
  πίνακες σε **px μήκους** (κριτήριο ELSED), precision (αναγνωριστής→CAD, `no-truth`) + recall (CAD→αναγνωριστής, `missed`),
  ουρά αταίριαστων κατά |dimensionScore−0,5|, spans ⇒ `matched`/`wrong-pair`/`no-truth`/`unresolved`.
  Test `P/__tests__/role-scoring.test.ts` 9/9 · μετάλλαξη γωνίας πιάνεται. ⚠️ Το `core/spatial/GridSpatialIndex` **δεν** χρησιμοποιήθηκε
  επίτηδες (κουτιά `plan-mm`, εδώ `raster-px`).
- **Ζωντανή Φ5.5** (Κτήριο Α / 3ος Όροφος, μόνο DOM): 364/74/388 + `dimension` 137 + `annotation` 294 = **1257**. Ισοζύγιο 17 = 137−120.
  Το σημάδι `dimension` = `dimension-line` + `extension-line` (`systems/plan-recognition/plan-role-marks.ts`). Ότι τα 17 είναι πράγματι επεκτάσεις **ΔΕΝ** αποδείχθηκε.
- **Εύρεση ζευγών** (scripts στο `C:\Nestor_Worktrees\_adr929-measure\`: `pair-inventory.js`, `pair-register.js`, τρέχουν με
  `node -r ./swc-register.js …`· έξοδος **μόνο** στο `F:/Shared/_Nestor_Plan_Golden/pairs/` — `inventory.json`, `register-trial.jsonl`, κλειδί sha256):
  - 99 CAD με εικόνα κοντά (64 TEK · 35 DXF).
  - 🔴 **Μόνο 4/252 TEK είναι XML.** 247 = παλιά κειμενική μορφή (`#!TEKTON`, `# Version 2|4|5`, μπλοκ `{ }`): v4 199 · v5 33 · v2 15.
    Το ADR-526 διαβάζει μόνο XML. Σε σκέτο Node το `parseXml` θέλει `DOMParser` (το script βάζει του jsdom).
  - 🔴 **Το κριτήριο «p95 ≤ 2 px ⇒ affine αρκεί» είναι άκυρο:** τα υπόλοιπα είναι **κομμένα** από την τελευταία ακτίνα ICP (3 px). Max ≤ 2,75 px
    σε όλες τις 11 «επιτυχίες», και σε κάλυψη 0,045. Σήμα = **κάλυψη**: 8/11 στο 0,045–0,08 (θόρυβος). Οι υπόλοιπες σε ψευδές DPI
    (10/60 από regex `/MediaBox`). **Κανένα ζεύγος δεν επιβεβαιώθηκε.**

## 2. Επόμενο (προτάσεις — όλα με «ναι» Giorgio, πρώτα Plan Mode + SSoT grep + έρευνα όπου δεν είσαι σίγουρος)
**Πρόταση προτεραιότητας: 1+2+3 μαζί** (χωρίς αυτά καμία μέτρηση ζεύγους δεν είναι αξιόπιστη):
1. **Κριτήριο αποδοχής καταγραφής** στο SSoT `src/lib/geometry/registration/`: ελάχιστη **κάλυψη** + **μηδενικό τεστ**
   (σκορ chamfer απέναντι σε τυχαίες/μετατοπισμένες θέσεις, a-contrario, π.χ. NFA των Desolneux–Moisan–Morel). Όχι απόλυτο κατώφλι.
   Νέο πεδίο αποτελέσματος (π.χ. `verdict: 'accepted' | 'rejected'` με λόγο). Ψάξε βιβλιογραφία πριν.
2. **Υπόλοιπα χωρίς αποκοπή:** μετά τη σύγκλιση, μέτρηση με ακτίνα ≫ 3 px (ή κατανομή υπολοίπων ως ποσοστό της ακτίνας), ώστε το p95 να λέει αλήθεια.
   Διόρθωσε και το κείμενο του κριτηρίου στο ADR §6.9 #4.
3. **DPI από τον renderer** (viewport του `pdfjs` στο `src/services/pdf/pdf-rasterize.service.ts`: επιστροφή κλίμακας μαζί με το PNG),
   όχι regex. Πρώτα grep για υπάρχον API μεγέθους σελίδας (`readPdfPage`, `readPdfTextLayout`).
4. Το test που λείπει για το snooping του τελευταίου γύρου (§6.9, M3).
5. DXF (35 ζεύγη): καταγραφή με όλες τις γραμμές μέχρι να δηλωθεί στρώση τοίχων (ρώτα τον Giorgio για στρώση).
6. Αναγνώστης παλιάς μορφής TEK v2/v4/v5 (ADR-526): **μεγάλη χωριστή εργασία**, ανοίγει τα 247 αρχεία. Μόνο αν το εγκρίνει ο Giorgio.
7. Μετά: πρώτη πραγματική μέτρηση ζεύγους → `scoreRoles`/`checkSpans` ⇒ αν τα 17 της Φ5.5 είναι επεκτάσεις · καταχώριση `lib/geometry/registration`
   στο `.ssot-registry.json` + `docs/centralized-systems` · βαθμονόμηση (L2 logistic, leave-one-plan-out, Platt).

## 3. Κανόνες
- Plan Mode + σχέδιο στον Giorgio πριν από κώδικα · SSoT audit (grep) πρώτα · έρευνα στο διαδίκτυο όπου δεν είναι σίγουρο.
- Όχι tsc, όχι `--no-verify`, **κανένα test/πύλη χωρίς έγκριση**, **καμία εικόνα σε AI** (ούτε στιγμιότυπο οθόνης με την κάτοψη),
  κανένα όνομα/διαδρομή από `F:\Shared` σε repo/AI/οθόνη.
- Jest: `npx jest <αρχεία>` **μέσα στο worktree** (έχει δικό του `node_modules`). Μεταλλάξεις με επαναφορά στην ίδια εντολή (trap).
- Ζωντανή μέτρηση: Claude in Chrome, μόνο `javascript_tool`/`find` (DOM), κουμπί «Τοίχοι από το σχέδιο» (κορδέλα «Δομικά») →
  «Αναγνώριση από την εικόνα του υποβάθρου».
- Μεγάλα κείμενα με `Write`· git: `"C:\Program Files\Git\cmd\git.exe"`.
