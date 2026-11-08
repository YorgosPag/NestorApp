# HANDOFF — ADR-934: στάδιο Μ-α ολοκληρώθηκε (`e16cbd29`) · επόμενα: απόφαση για land → σχέδιο Μ-β (λήψη bytes + καραντίνα)

- **Worktree**: `C:\Nestor_Worktrees\product-portal` · **Κλαδί**: `agent/product-portal` · ΠΟΤΕ commit στο `main`.
- **wt:land / push**: ΜΟΝΟ με ρητή εντολή Giorgio, και **χωριστά**.
- Αντικαθιστά το `2026-11-08_ADR-934_E3-live-aab9a782_therapy-live-check-media-Ma_handoff.md`.
- **Αυθεντία**: ADR-934 §5.2 (σχέδιο μέσων Μ1–Μ11′) + **§5.2.1 (Μ-α όπως υλοποιήθηκε)** + changelog · ADR-923 §5.10 Δ9 + changelog.

## 1. Κατάσταση

- **Παραγωγή = `aab9a782`** (`curl -s -A "Mozilla/5.0" https://nestorconstruct.gr/api/build-info`). Το κλαδί είναι **μπροστά** από το `origin/main` κατά 3 commits κώδικα/ADR (+ αυτό το handoff):
  - `093642b7` docs: Ε3 ζωντανά ΠΕΡΑΣΕ (θεραπεία `cibat_61d7e2dd…` ⇒ 0 εκκρεμείς · νέα παρτίδα `cibat_ff4c5ab1…` εγκαταλείφθηκε από το UI, προτάσεις έφυγαν, κουμπιά κλειδωμένα, `discarded` μετά από ανανέωση).
  - `39169bd5` **Μ-α1**: ρόλοι `declaration` · `energyLabel` · `safetyDataSheet` (λεξιλόγιο, αποθήκευση, ετικέτες/εικονίδια, CHECK 3.73, i18n, route slice).
  - `e16cbd29` **Μ-α2**: `vocabulary/etim-attachments.ts` (πίνακας ATX → ρόλος, ρίζα CHECK 3.73) · `import/asset-uri.ts` (`canonicalAssetUri`) · `ExtractedAsset` + `ExtractedRow.assets?` / `ExtractedGroup.assets?` · `interop/etim/xchange-attachments.ts` (ανάγνωση `ProductAttachments` + `ItemAttachments` πρώτου είδους, ένα μέσο ανά λεπτομέρεια, κάθε συνημμένο κρίνεται χωριστά) · `xchange-report.ts` `attachments{…}` + `XChangeReportNote.tsx` + i18n.
- **Tests ΠΕΡΑΣΑΝ** (έγκριση Giorgio): `xchange-attachments.test.ts` + `asset-uri.test.ts` + `etim-xchange-roundtrip.test.ts` = **56/56**. ⚠️ Αυτό **δεν** έχει γραφτεί στο changelog του ADR-934 (προτάθηκε, αναμένει «ναι»).

## 2. Επόμενα βήματα (με αυτή τη σειρά — το καθένα θέλει «ναι» του Giorgio)

1. **Απόφαση για τη μία αλλαγή συμπεριφοράς του Μ-α2** (ADR-934 §5.2.1 εύρημα 5): το `stageGroup` (`src/server/catalog/import-proposal-writer.server.ts`) γράφει `extracted: group` αυτούσιο ⇒ μετά το land οι προτάσεις από xChange **με συνημμένα** θα αποθηκεύουν τις περιγραφές των μέσων (αχρησιμοποίητες ως το Μ-γ, που τις χρειάζεται). Χωρίς συνημμένα: πρόταση ίδια με πριν. Giorgio αποφασίζει: δεκτό ως έχει, ή αλλαγή πριν το land.
2. **Changelog ADR-934**: γραμμή «tests Μ-α 56/56» (μόνο με «ναι»).
3. **Land** (μόνο με εντολή): πρώτα `git fetch` + `git log HEAD..origin/main` (η συνεδρία `agent/catalog-editions` αγγίζει τον ίδιο τομέα — πιθανή σύγκρουση σε `catalog-import.ts`, `xchange-*`, `catalog-import.json`, `.domain-vocabulary.json`, `src/types/i18n.ts`, `src/i18n/generated/**`· τα παραγόμενα **ξαναπαράγονται**, δεν συγχωνεύονται με το χέρι: `npm run generate:i18n-types` · `npm run generate:i18n-shell-slice`). Μετά `npm run wt:land -- product-portal`. Push **χωριστά**.
4. **Στάδιο Μ-β** (Plan Mode, πρώτα SSoT audit με grep): λήψη bytes από το `lib/security/outbound-url-guard.ts` σε λειτουργία **bytes** (σήμερα κείμενο ≤ 64 KB, `fetchGuardedText`/`fetchGuardedDocument`) — όριο από `CATALOG_ASSET_MAX_BYTES` ανά είδος, διακοπή ροής όταν ξεπεραστεί, ≤ 3 ανακατευθύνσεις με επανέλεγχο · magic bytes + `judgeAssetFile` (HTML ⇒ `notAFile`, Μ4) · καραντίνα μέσω `server/storage/create-object-once.server.ts` με κλειδί sha256 · αποδιπλασιασμός κατά (χώρος, κανονικό URI) **και** sha256 (Μ5, πρότυπο `contentSha256` του `import-source.server.ts`) · conditional GET (`ETag`/`Last-Modified`) · αποτυχία ανά μέσο δηλωμένη και ξαναδοκιμάσιμη (Μ9). Ουρά ανά παρτίδα με οδηγό τον πελάτη, ≤ 3 ταυτόχρονα / ≤ 2 ανά host (Μ3). ⚠️ Το TOCTOU (DNS rebinding) του φρουρού μένει ξεχωριστή απόφαση.

## 3. Ανοιχτά (μόνο με «ναι»)
- Κοσμητικό: εγκαταλειμμένη παρτίδα γράφει «Δεν υπάρχουν προτάσεις ακόμη» και δεν δείχνει την κατάσταση (changelog ADR-934 `093642b7`).
- Ε4: καρφωμένη στήλη «Μέγεθος» επικαλύπτεται σε οριζόντια κύλιση.
- `!IMPORT_FINISHED_BATCH_STATUSES.includes(...)` σε 4 σημεία ⇒ υποψήφιο κατηγόρημα `isImportBatchFinished`.
- Δεν υπάρχει test για «εγκατάλειψη στη μέση της χαρτογράφησης αρχείου» · `retireStaleProposals` > 500 εγγραφές · test ταύτισης μόνο από GTIN · απόκρυψη μπαρών κύλισης.
- ATX017 (μάρκετινγκ) · ATX021–023 · ATX025–026 · ATX099 = «εκτός ρόλου» (δηλώνονται στην αναφορά). Νέος ρόλος γι' αυτά = απόφαση Giorgio.

## 4. ΜΗΝ
- Κανένα test ή tsc χωρίς έγκριση (N.(-2), N.17). Ποτέ `--no-verify` / `SKIP_*`.
- Όχι commit στο `main`· commit μόνο με ρητή λίστα αρχείων. `wt:land` και push μόνο με εντολή, και χωριστά.
- Καμία εγγραφή στην παραγωγή χωρίς «ναι».
- Όχι `git stash` χωρίς ετικέτα (κοινή στοίβα).
- Μη ονομάσεις βοηθητικό python script `types.py` στο scratchpad: σκιάζει το stdlib (`python -I` το αποφεύγει).
- Οι γεννήτορες i18n (`generate:i18n-types`, `generate:i18n-shell-slice`) **είναι** απαραίτητοι μετά από νέο κλειδί σε locale (CHECK 3.33 / 3.34) — δεν είναι tests.
