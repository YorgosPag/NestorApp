# Handoff · Επαλήθευση ζωντανής έκδοσης πριν από το «Deploy completato» (2026-11-05)

Αντικαθιστά το `2026-11-05_ADR-923_coordinator_wave3_progress3_handoff.md`. Τα «Μαθήματα» του παλιού ισχύουν· τα κρίσιμα επαναλαμβάνονται εδώ.

- **Worktree:** `C:\Nestor_Worktrees\xchange-report-typography`
- **Κλαδί:** `agent/xchange-report-typography`, πάνω στο `ce35e9b2` (= `origin/main` όταν γράφτηκε).
- **Στο `main` δεν γίνεται commit.** Το `wt:land`, το push και οι εγκρίσεις Firebase γίνονται **μόνο** με ρητή εντολή του Giorgio.

## Τι μπήκε στην παραγωγή (επαληθευμένο: `/api/build-info` = `ce35e9b2`, μέσω Chrome)
| Commit | Τι |
|---|---|
| `c091092f` | Ενεργό cron `rfq-invite-delivery` (`11-59/15`) · `sweepDeadlineMs` 240s + `deferred` · άγκυρα «καμία επαναλαμβανόμενη εργασία δεν μοιράζεται λεπτό». ADR-740 + ADR-923. |
| `e5b192c2` | ADR-930 §3.7, εξουσία κατόχου ευκαιρίας (δουλειά της συνεδρίας CRM, ενταγμένη από εδώ). Οι κανόνες Firebase αναπτύχθηκαν με έγκριση. |
| `ce35e9b2` | Δείκτης `common_spaces (status, deletedAt)` + άγκυρα «κάθε συλλογή του `SOFT_DELETE_CONFIG` έχει τον δείκτη της εκκαθάρισης». ADR-931. Αιτία: `FAILED_PRECONDITION` στο cron `purge-deleted-entities`, 05:00 UTC 2026-11-05. |

Αρχείο (όχι στο `main`, επίτηδες): το κλαδί `agent/adr-923-w3-l1-wip-archive` (`52dd2bb8`), ο γύρος της Λ1 που αντικαταστάθηκε. Αποκλίνει από τον ζωντανό σχεδιασμό.

## ΕΠΟΜΕΝΟ ΒΗΜΑ (εγκρίθηκε: «ΝΑΙ ΦΤΙΑΞΤΟ»): το «Deploy completato» να σημαίνει «τρέχει»

### Το εύρημα (μετρημένο σήμερα)
- `.github/workflows/docker-build.yml`, job «📦 Κυκλοφορία στο Netcup», βήμα «Trigger Coolify redeploy»: `curl GET …/api/v1/applications/f661kuiq901llma0o8unhvpi/start` ⇒ `{"message":"Deployment request queued.","deployment_uuid":"…"}`.
  - Το job τελειώνει **αμέσως** μετά.
  - Το job «📣 Ειδοποίηση» (`node scripts/ci/telegram-notify.js`, lib `scripts/lib/ci/telegram.js`) στέλνει ✅ «Deploy completato» με `release success`.
- **Μέτρηση:** μήνυμα στις 09:12:14 UTC · `/api/build-info` έδειχνε ακόμη το **παλιό** sha 30″ μετά · το νέο sha φάνηκε σε ≤4′.
  - Αν το container δεν ανέβει ποτέ (build crash, healthcheck, OOM), το μήνυμα λέει πάλι ✅.
  - Πράσινο που σημαίνει «ζήτησα», όχι «έγινε»: ίδιο σχήμα με το «0 = κανείς δεν κοίταξε» του CLAUDE.md.
- **ΟΧΙ** αιτία της απορίας του Giorgio («δεν ήρθε Telegram χθες»):
  - Το `sendTelegram` πήρε HTTP 200 και στις 02:39 (έγκριση) και στις 02:55 (completato) ώρα Ελλάδας.
  - Σήμερα ήρθαν κανονικά και τα δύο μηνύματα, στο ίδιο `TELEGRAM_CHAT_ID`.
  - Αν ο Giorgio δεν τα βρει στη συνομιλία εκείνες τις ώρες, είναι ξεχωριστό θέμα. Μην το μπλέξεις.

### Τι ζητείται (επίπεδο Google SRE / Vercel / Netlify: «deploy succeeded» = η νέα έκδοση σερβίρει)
1. **Έρευνα πριν από κώδικα:**
   - Πώς επαληθεύουν οι μεγάλοι ότι η έκδοση είναι ζωντανή (Vercel deployment `READY` + alias · Argo Rollouts / k8s rollout status · Netlify deploy-succeeded hooks).
   - Coolify API: **`GET /api/v1/deployments/{deployment_uuid}`** (status `finished` / `failed`). Επιβεβαίωσε με τα docs της έκδοσης Coolify που τρέχει.
2. **Πιθανός σχεδιασμός** (να επικυρωθεί, όχι να εκτελεστεί τυφλά):
   - **Πρώτη πηγή:** η κατάσταση του Coolify deployment (`deployment_uuid`), με όριο χρόνου.
   - **Τελικός κριτής:** το `/api/build-info` (`{"deploymentId": <sha>}`), το ίδιο που διαβάζει ο browser (ADR-860 §Ε0, `docker-build.yml:137`). Το sha πρέπει να είναι **ίσο** με `github.sha` πριν σταλεί ✅.
   - **Αποτυχία ή λήξη χρόνου:** ❌ «Η έκδοση δεν ανέβηκε», με τι είδαμε (παλιό sha / status Coolify / HTTP code) και σύνδεσμο. Όχι σιωπή, όχι ψευδές ✅.
   - Τα στάδια του μηνύματος να λένε π.χ. `release success · live ce35e9b (2′14″)`.
3. ⚠️ **Παγίδα 403:**
   - Το `curl` από το τερματικό του Giorgio παίρνει **403** στο `https://nestorconstruct.gr/api/build-info`, ενώ ο Chrome παίρνει 200.
   - Πιθανότατα φίλτρο bot / User-Agent / WAF μπροστά από το Netcup. Ο runner του GitHub μπορεί να πάρει **επίσης** 403.
   - Μέτρησε **πρώτα** τι παίρνει ο runner (π.χ. δοκιμαστικό `workflow_dispatch` ή βήμα με `continue-on-error`), και μετά διάλεξε:
     - ρητό User-Agent `nestor-deploy-verifier`;
     - εσωτερική διεύθυνση του Coolify host;
     - ή μόνο το Coolify API.
   - Μην αποδυναμώσεις κανέναν φράχτη ασφαλείας για να περάσει ο έλεγχος.
4. **SSoT audit (grep) πριν από κώδικα:**
   - `scripts/ci/*`, `scripts/lib/ci/*`, `scripts/firestore-deploy/*` (υπάρχει ήδη μηχανή διαδοχής/ουράς).
   - Ό,τι μιλά στο Coolify API, π.χ. ο runbook του ADR-740 §9.1, που γράφει env μέσω Coolify REST.
   - Ό,τι διαβάζει `build-info`, π.χ. `grep -rn "build-info" src scripts .github`.
   - Η λογική να ζει σε **ελέγξιμο** module `scripts/lib/ci/…` με jest (ψεύτικο `fetch`, ρολόι), όχι σε bash μέσα στο yml. Πρότυπο: `telegram.js` + `telegram-notify.js`.
5. **Πύλες:**
   - Το `.github/workflows/*` καλύπτεται από το **CHECK 3.37** (`.ci-gate-tiers.json`).
   - Νέο αρχείο στο `scripts/` ⇒ CHECK 3.22 (knip) και CHECK 3.66 αν γεννηθεί πύλη.
   - Το ADR να ενημερωθεί: ADR-757 (ιεράρχηση CI / ειδοποιήσεις) ή ADR-865 §11 (γραμμή παραγωγής). Βρες ποιο κατέχει το job «Ειδοποίηση».
6. **Επαλήθευση:**
   - jest του νέου module, με μεταλλάξεις: «στέλνει ✅ χωρίς ίσο sha» ⇒ κόκκινο · «λήξη χρόνου ⇒ ✅» ⇒ κόκκινο.
   - Ζωντανή απόδειξη μόνο μετά από push, που θέλει εντολή του Giorgio.

## Εκκρεμότητες μετά
- **Ζωντανός έλεγχος (εγκρίθηκε 1 δοκιμαστικό RFQ):**
  - Η πρόσκληση να φτάσει σε `delivered` / «Στάλθηκε».
  - Το Sentry monitor `rfq-invite-delivery` να τρέχει χωρίς `FAILED_PRECONDITION`.
  - Το cron `purge-deleted-entities` στις 05:00 UTC να μην έχει σφάλμα `common_space`.
- **Χαμηλά Χ-Α…Χ-Ζ της Λ1** (λεπτομέρειες στο `2026-11-05_ADR-923_coordinator_wave3_progress3_handoff.md`):
  - `stopOnUncertain`
  - test ταυτόχρονων κρατήσεων
  - κείμενο / κουμπί επαναποστολής
  - `markDispatched` try/catch
  - `.catch` στο `fetchVendorContact`
  - θέση JSDoc
- **Λωρίδες Λ3 / Λ4 / Λ7 του ADR-923 §23.**
- ⚠️ **CI «Secret Scan»** κόκκινο από ευρήματα σε **παλιά** commits (Ιαν–Μαρ: `ADR-263…md:114`, `BACKUP_SUMMARY.json:35`, `telegram-webhook-setup.sh:5` κ.ά.). Δεν σχετίζεται με τα σημερινά. Θέλει απόφαση του Giorgio: rotation + allowlist με fingerprint.

## Καθαρισμός (από τον Giorgio, σε ξεχωριστό PowerShell — ο φύλακας δεν επιτρέπει git σε ξένο worktree)
Το περιεχόμενό τους είναι ήδη στο GitHub:
```
git worktree remove -f -f C:/Nestor_Worktrees/land-raster-check351
git worktree remove -f -f C:/Nestor_Pagonis/.claude/worktrees/agent-a4aa1ef33828efaf9
git worktree remove -f -f C:/Nestor_Worktrees/crm-pipeline-dnd
git worktree prune
```
Και τα worktrees/κλαδιά που απαριθμεί το παλιό handoff (§«Φάκελοι για σβήσιμο»).

## Μαθήματα
- **Ο φύλακας απομόνωσης:**
  - Αρνείται `git -C`, μεταβλητές σε εντολές git, `cd … &&` πριν από git, `sleep N; <εντολή>` σε προσκήνιο.
  - Μόνο απλές μονές εντολές git από τη ρίζα του worktree.
  - Αναμονή: `run_in_background` + `sleep N; <εντολή>`.
- **Ξένο worktree:**
  - Σύγκριση **χωρίς** git: `cmp`/`diff` αρχείων με το δικό σου checkout του `origin/main`.
  - Ή node script που καλεί `git show <sha>:<path>` στο δικό σου cwd: `scratchpad/cmp-wip.js`, ξαναγράψ' το αν χρειαστεί.
- **Ένταξη ξένου commit:**
  1. `git switch -c <κλαδί> origin/main`
  2. `git cherry-pick --no-commit <sha>`
  3. Παραγόμενα: `git checkout origin/main -- src/types/i18n.ts` + `npm run generate:i18n-types` + `npm run generate:i18n-shell-slice`.
  4. `git commit -C <sha>` (πλήρες hook) και ff push.
- **Συνεδρίες-ομότιμοι** αρνούνται push με εντολή που μεταφέρεται από άλλη συνεδρία, και αυτό είναι σωστό. Η ένταξη γίνεται από τη συνεδρία που έχει την εντολή.
- **Μήνυμα commit:** επιτρεπτοί τύποι `fix feat refactor docs chore test perf ci style build i18n`. Το `wip` μπλοκάρει.
- **Deploy:**
  - Το run περιμένει έγκριση στο «🚀 Firebase — ανάπτυξη (με έγκριση)» μόνο όταν αλλάζουν rules/indexes.
  - Έγκριση: `gh api -X POST repos/YorgosPag/NestorApp/actions/runs/<id>/pending_deployments -F "environment_ids[]=22248013755" -f state=approved -f comment=…`.
  - Νεότερο run ακυρώνει το παλαιότερο (concurrency). Αυτό είναι φυσιολογικό, γιατί το νεότερο το περιέχει.
- **Ζωντανός έλεγχος:** `/api/build-info` **μέσω Chrome** (`mcp__claude-in-chrome__*`), όχι curl. Περίμενε 1–4′ μετά το «Deploy completato» (ακριβώς το εύρημα αυτού του handoff).
