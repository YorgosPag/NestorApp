# HANDOFF — ADR-934: στάδιο Μ-α ΕΝΤΑΧΘΗΚΕ στο `main` (`ab29a180`) · επόμενο: ζωντανή επαλήθευση + σχέδιο Μ-β (λήψη bytes + καραντίνα)

- **Worktree**: `C:\Nestor_Worktrees\product-portal` · **Κλαδί**: `agent/product-portal` · ΠΟΤΕ commit στο `main`.
- **wt:land / push**: ΜΟΝΟ με ρητή εντολή Giorgio, και **χωριστά**.
- Αντικαθιστά το `2026-11-09_ADR-934_Ma-done-e16cbd29_land-decision-Mb-plan_handoff.md`.
- **Αυθεντία**: ADR-934 §5.2 (σχέδιο μέσων Μ1–Μ11′) + §5.2.1 (Μ-α όπως υλοποιήθηκε) + changelog · ADR-923 §5.10 Δ9.

## 1. Κατάσταση (2026-11-09)

- **Απόφαση Giorgio (βήμα 1):** εύρημα 5 του §5.2.1 **δεκτό ως έχει** — οι προτάσεις από xChange με συνημμένα κρατούν τις
  περιγραφές των μέσων στο `extracted` (`stageGroup`, `import-proposal-writer.server.ts:63`)· το `editedGroup` τις διατηρεί.
- **Changelog ADR-934:** γραμμή 2026-11-09 «Μ-α tests 56/56 + εύρημα 5 δεκτό» (βήμα 2).
- **Land (βήμα 3):** `main` = **`ab29a180`** (ένα commit με όλο το Μ-α, πέρασε όλες τις πύλες: 85 checks + 12 σουίτες από το hook).
  Το `main` κινήθηκε δύο φορές κατά το land (B4 `df8580b7`/`c104e610` · ADR-929 `dd8eea12`)· συγκρούσεις μόνο στο changelog του
  ADR-923 (κρατήθηκαν **και οι δύο** γραμμές) και στα παραγόμενα i18n (ξαναπαράχθηκαν με τους γεννήτορες).
- **Push:** το έτρεξε ο Giorgio (στέλνει και τα B4 + ADR-929 άλλων συνεδριών). ⚠️ Επιβεβαίωσε την παραγωγή πριν από
  οποιονδήποτε ζωντανό έλεγχο: `curl -s -A "Mozilla/5.0" https://nestorconstruct.gr/api/build-info` (αναμένεται `ab29a180` ή νεότερο).
- Το κλαδί `agent/product-portal` ξεκινά από το `ab29a180` (+ αυτό το handoff).

## 2. Επόμενα βήματα (το καθένα θέλει «ναι» του Giorgio)

1. **Ζωντανός έλεγχος Μ-α** (μόνο ανάγνωση, όχι εγγραφή χωρίς «ναι»): νέα εισαγωγή του xChange του MFP (Fan coil) ⇒ η αναφορά
   xChange δείχνει τις γραμμές `attachments` (μέσα · σύνδεσμοι · εκτός ρόλου · μικρογραφίες · χωρίς διεύθυνση) χωρίς ωμά κλειδιά·
   η βιβλιοθήκη μέσων δείχνει τους ρόλους `declaration` · `energyLabel` · `safetyDataSheet` στο ανέβασμα.
2. **Στάδιο Μ-β** — Plan Mode, **πρώτα SSoT audit με grep**, μοντέλο Opus. Περιεχόμενο (ADR-934 §5.2 Μ3–Μ6, Μ9):
   - λήψη bytes από το `src/lib/security/outbound-url-guard.ts` σε λειτουργία **bytes** (σήμερα κείμενο ≤ 64 KB,
     `fetchGuardedText`/`fetchGuardedDocument`)· όριο από `CATALOG_ASSET_MAX_BYTES` ανά είδος, διακοπή ροής όταν ξεπεραστεί
     (όχι μόνο `content-length`), ≤ 3 ανακατευθύνσεις με επανέλεγχο σε κάθε άλμα·
   - magic bytes + `judgeAssetFile` (HTML ⇒ `notAFile`, Μ4)·
   - καραντίνα μέσω `src/server/storage/create-object-once.server.ts` με κλειδί sha256 (αρχείο χωρίς δέσιμο, Μ6)·
   - αποδιπλασιασμός κατά (χώρος, κανονικό URI — `import/asset-uri.ts`) **και** sha256 (Μ5, πρότυπο `contentSha256` /
     `findStoredBatchFile` του `import-source.server.ts`)· conditional GET (`ETag`/`Last-Modified`)·
   - αποτυχία ανά μέσο δηλωμένη και ξαναδοκιμάσιμη (Μ9, πρότυπο `pages.failed`)·
   - ουρά ανά παρτίδα με οδηγό τον πελάτη, ένα μέσο ανά αίτημα, ≤ 3 ταυτόχρονα / ≤ 2 ανά host (Μ3, πρότυπο σελίδων PDF).
   - ⚠️ Το TOCTOU (DNS rebinding) του φρουρού μένει **ξεχωριστή** απόφαση Giorgio.
   - Έρευνα στο διαδίκτυο όπου υπάρχει αμφιβολία (π.χ. streaming όριο σε Node `fetch`, magic bytes βιβλιοθήκη με άδεια MIT/Apache/BSD — N.5).

## 3. Ανοιχτά (μόνο με «ναι»)
- Κοσμητικό: εγκαταλειμμένη παρτίδα γράφει «Δεν υπάρχουν προτάσεις ακόμη» χωρίς την κατάσταση.
- Ε4: καρφωμένη στήλη «Μέγεθος» επικαλύπτεται σε οριζόντια κύλιση.
- `!IMPORT_FINISHED_BATCH_STATUSES.includes(...)` σε 4 σημεία ⇒ υποψήφιο κατηγόρημα `isImportBatchFinished`.
- ATX017 · ATX021–023 · ATX025–026 · ATX099 = «εκτός ρόλου»· νέος ρόλος = απόφαση Giorgio.
- `docs/.../ADR-358-dxf-stair-tool-google-level.md` έχει ξεχασμένα σημάδια `<<<<<<< Updated upstream` στο `main` (όχι δικά μας) —
  αναφορά μόνο, καμία αλλαγή χωρίς «ναι».

## 4. ΜΗΝ
- Κανένα test ή tsc χωρίς έγκριση (N.(-2), N.17). Ποτέ `--no-verify` / `SKIP_*`.
- Όχι commit στο `main`· commit μόνο με ρητή λίστα αρχείων. `wt:land` και push μόνο με εντολή, και χωριστά.
- Καμία εγγραφή στην παραγωγή χωρίς «ναι». Όχι `git stash` χωρίς ετικέτα.
- Στο land: το `main` κινείται από άλλες συνεδρίες **κατά τη διάρκεια** — ξαναέλεγξε `git rev-parse main` ακριβώς πριν το
  `wt:land`. Αν κάνεις rebase εσύ, το `wt:land` **δεν** ξανακρίνει με πύλες ⇒ κάνε το ενιαίο commit μέσα από τις πύλες
  (`reset --soft main` + `commit -F` με `composeLandMessage`), μετά `wt:land` (fast-forward).
- Τα παραγόμενα i18n (`src/types/i18n.ts`, `src/i18n/generated/**`) ξαναπαράγονται (`npm run generate:i18n-types` ·
  `npm run generate:i18n-shell-slice`), ποτέ συγχώνευση με το χέρι.
