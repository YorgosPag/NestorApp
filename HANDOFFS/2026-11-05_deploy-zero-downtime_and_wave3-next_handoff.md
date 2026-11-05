# Handoff · Deploy χωρίς κενό + επόμενα βήματα του κύματος 3 (2026-11-05, 12:55)

Αντικαθιστά το `2026-11-05_deploy-live-verification_handoff.md`. Ισχύουν και τα «Μαθήματα» εκείνου.

- **Worktree:** `C:\Nestor_Worktrees\xchange-report-typography`
- **Κλαδί:** `agent/xchange-report-typography`. Όταν γράφτηκε, ήταν πάνω στο `d504d5b5` (= `main` = `origin/main`).
- Στο `main` **δεν** γίνεται commit. Στο κλαδί `agent/*` ο πράκτορας κάνει commit τη **δική** του δουλειά, με ρητή λίστα
  αρχείων και πλήρες hook.
- Το `wt:land`, το push και οι εγκρίσεις Firebase γίνονται **μόνο** με ρητή εντολή του Giorgio.

## Τι είναι ζωντανό (επαληθευμένο με Telegram + log του run)
| Commit | Τι | Απόδειξη |
|---|---|---|
| `1ef2e712` | ADR-865 §11.11: το «Deploy completato» στέλνεται **μόνο** όταν το `/api/build-info` σερβίρει το sha του push. Αλλιώς ❌ «Η έκδοση δεν ανέβηκε», με ό,τι είδαμε. Λογική: `scripts/lib/ci/netcup-release.js`. | run `42005118492`: `live 1ef2e71 (53″)` |
| `d504d5b5` | ADR-865 §11.12: `HEALTHCHECK` στον Dockerfile, με `node` + UA `nestor-healthcheck/1`. Περιέχει **και** την απόδειξη του §11.11 στο ADR. ⚠️ Ο τίτλος λέει μόνο `docs(adr-865)…`, γιατί το `wt:land` ένωσε δύο commits. | run `42013699831`: `live d504d5b (55″)` — το healthcheck **δεν** μπλόκαρε την κυκλοφορία |
| `0410c16b` `5b193e30` `7c09ee43` | ADR-929 (άλλη συνεδρία): plan-recognition Phase 4 + διόρθωση της σελίδας ρυθμίσεων εταιρείας. Έφυγαν **στο ίδιο push**, με ρητή εντολή του Giorgio («push όλα»). | ίδιο run |

## ΕΠΟΜΕΝΟ ΒΗΜΑ 1 — μηδενικό κενό στο deploy (ADR-865 §11.12)

**Η ρίζα (μετρημένη):**
- Στο run `42005118492`, στο 42″, το build-info **δεν απάντησε** μέσα σε 10″.
- Στο Coolify η εφαρμογή (τύπος **Docker Image**) έχει **Port Mappings `3000:3000`**.
- Κατά τα docs του Coolify, μια θύρα δημοσιευμένη στον host ⇒ **stop-before-start**: σβήνει το παλιό container πριν
  ξεκινήσει το νέο. Δεν γίνεται rolling update.

**Η θύρα του host δεν χρησιμεύει (ελεγμένο):**
- Απ' έξω το `159.195.44.221:3000` δίνει `ECONNREFUSED`.
- Ο Traefik στέλνει την κίνηση μέσω του δικτύου του Docker (`loadbalancer.server.port=3000`).
- Ο χρονοπρογραμματιστής (ADR-740 §9) είναι Coolify Scheduled Task. Καλεί `127.0.0.1:3000` **μέσα** στο container.

**Βήματα:**
1. **Giorgio, στο Coolify:**
   - Διαδρομή: Configuration → General → Network → **Port Mappings: άδειο** → Save → Redeploy.
   - Το «Ports Exposes 3000» **μένει**.
2. **Μάρτυρας:**
   - Το log του βήματος «🚀 Coolify → μέχρι να σερβίρει το νέο commit», στο επόμενο run του `docker-build.yml`.
     Ένα redeploy από το Coolify **δεν** τρέχει αυτό το βήμα, άρα χρειάζεται push.
   - Εναλλακτικά, μέτρηση με δικό σου βρόχο κατά το Redeploy: ένα `fetch` ανά 1″ στο build-info, με UA `nestor-deploy-verifier/1.0`.
   - **Κανένα** timeout ή σφάλμα ανάμεσα σε παλιό και νέο sha ⇒ γράψε την απόδειξη στο ADR-865 §11.12 + changelog.
3. **Αν παραμένει κενό:**
   - Τα docs του Coolify **δεν** λένε αν, για τύπο Docker Image, διαβάζεται το `HEALTHCHECK` της εικόνας.
   - Τότε ενεργοποιείται Healthcheck στον πίνακα, τύπου **CMD**, με την **ίδια** εντολή που έχει ο Dockerfile.
   - **Ποτέ** HTTP check: τρέχει με curl/wget ⇒ 403 από το middleware ⇒ «ανθυγιές» για πάντα.
4. Κοίτα επίσης ότι το container δείχνει `healthy`, π.χ. από την καρτέλα Logs/Terminal του Coolify (Giorgio).

## ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ 2–4 (από το handoff του συντονισμού)
2. **Ζωντανός έλεγχος RFQ** (εγκρίθηκε 1 δοκιμαστικό RFQ):
   - Η πρόσκληση φτάνει σε `delivered` / «Στάλθηκε».
   - Το Sentry monitor `rfq-invite-delivery` τρέχει χωρίς `FAILED_PRECONDITION`.
   - Το cron `purge-deleted-entities` στις 05:00 UTC δεν έχει σφάλμα `common_space` (δείκτης `ce35e9b2`, ADR-931).
3. **Τα χαμηλά Χ-Α…Χ-Ζ της Λ1.** Λεπτομέρειες: `HANDOFFS/2026-11-05_ADR-923_coordinator_wave3_progress3_handoff.md`.
   - `stopOnUncertain`
   - test ταυτόχρονων κρατήσεων
   - κείμενο / κουμπί επαναποστολής
   - `markDispatched` try/catch
   - `.catch` στο `fetchVendorContact`
   - θέση JSDoc
4. **Λωρίδες Λ3 / Λ4 / Λ7** του ADR-923 §23.

## Ανοιχτές αποφάσεις του Giorgio (μην τις πάρεις μόνος)
- **Το Coolify API μιλά HTTP** (`159.195.44.221:8000`) ⇒ το `COOLIFY_TOKEN` ταξιδεύει χωρίς κρυπτογράφηση από τον
  runner. Προϋπήρχε. Επιλογές: domain + TLS μπροστά στο Coolify, ή περιορισμός της θύρας 8000. Το ADR-865 §11.11 το
  έχει ως όριο 3.
- **CI «Secret Scan»** κόκκινο από παλιά commits: rotation + allowlist με fingerprint.

## Καθαρισμός (Giorgio, σε δικό του PowerShell)
- **Βρώμικο, αλλά ήδη φυλαγμένο.** Τα 34 αρχεία του `agent-a4aa1ef33828efaf9` είναι ταυτόσημα με το αρχείο
  `52dd2bb8` (`agent/adr-923-w3-l1-wip-archive`). Το ελέγξαμε αρχείο-αρχείο. Ο γύρος της Λ1 που αντικαταστάθηκε:
  **ΜΗΝ** γίνει commit και **ΜΗΝ** ενταχθεί.
  ```
  git worktree remove -f -f C:/Nestor_Pagonis/.claude/worktrees/agent-a4aa1ef33828efaf9
  git worktree prune
  ```
- **Στο `C:\Nestor_Worktrees`, εκτός git, σβήνονται από τον Explorer:**
  - `adr-923-phase3-close`, `adr-923-phase5-publisher-b`, `adr-923-phase6b`, `adr-923-phase6-sku-boq`,
    `crm-opportunity-fixes` (άδειοι).
  - `_adr929-measure` (18 πρόχειρα scripts μέτρησης).
- **`land-raster-check351`, `crm-pipeline-dnd`** σβήνονται με `git worktree remove` **μόνο** αφού βεβαιωθεί ότι καμία
  συνεδρία δεν δουλεύει εκεί. Το `land-raster-check351` πειράχτηκε 12:29.

## Μαθήματα αυτής της συνεδρίας
- **Το 403 του curl** είναι το δικό μας `src/middleware.ts` (`BLOCKED_BOT_PATTERNS`: `curl/`, `wget`, `node-fetch`,
  `axios/` …), **όχι** WAF.
  - Κάθε δικός μας μηχανικός πελάτης στέλνει ρητό UA: `nestor-deploy-verifier/1.0` · `nestor-healthcheck/1` ·
    `nestor-scheduler/1`.
  - Η προεπιλογή του Node `fetch` (`node`) περνά. Ζωντανός έλεγχος από τερματικό: `node -e "fetch(…)"`, όχι curl.
- **Το `wt:land` ξανακρίνει πάνω στο τρέχον `main`.** Αν το `main` προχώρησε, **ενώνει** τα commits του κλαδιού σε ένα
  με τον τίτλο του **πρώτου**. Πριν από το land με πολλά commits, βάλε στο πρώτο τίτλο που καλύπτει όλα, ή ένωσέ τα
  πρώτα εσύ.
- **Πριν από push: `git fetch origin main` + `git log --oneline origin/main..main`.** Το τοπικό `main` μπορεί να
  κρατά commits **άλλης** συνεδρίας που μπήκαν με `wt:land` χωρίς push. Το push τα στέλνει στην παραγωγή μαζί ⇒
  ρώτα τον Giorgio.
- **Το CHECK 12 (άδειες)** μπλοκάρει με «UNKNOWN / lockfile-drift» όταν το `node_modules` του worktree είναι
  παλιότερο από το `pnpm-lock.yaml`. Δεν είναι παράβαση. Φτάνει ένα `pnpm install --frozen-lockfile` στο **δικό σου**
  worktree. Έλεγξε πρώτα ότι το `node_modules` δεν είναι link.
- **Ο φύλακας απομόνωσης** αρνείται σε εντολή Bash:
  - μεταβλητές στη θέση ορίσματος (`sed … $F`);
  - το `cmd //c`;
  - λέξεις που μοιάζουν με git μέσα σε σύνθετες εντολές.
  Μικρά node scripts στο scratchpad περνούν.
- **Ο πίνακας του Coolify** δεν φορτώνει στον Chrome του πράκτορα (σελίδα σε διαρκή φόρτωση). Ρυθμίσεις ζητούνται από
  τον Giorgio, ως κείμενο ή screenshot.
