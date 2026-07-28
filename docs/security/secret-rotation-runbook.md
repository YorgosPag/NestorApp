# Runbook — Εκτεθειμένα διαπιστευτήρια στο git ιστορικό (ADR-598 G12)

> **Τι είναι αυτό:** το εκτελέσιμο εγχειρίδιο για τα διαπιστευτήρια που έχουν διαρρεύσει στο git
> ιστορικό του repo. Είναι ο προορισμός στον οποίο δείχνει ήδη το `.gitleaks.toml`
> (*«GENUINE secrets are NOT allowlisted here — they are rotated + purged from history. See
> docs/security (runbook) for the remediation record.»*) — μέχρι σήμερα ο δείκτης ήταν κρεμασμένος.
>
> **Κατάσταση:** 🔴 **ΑΝΟΙΧΤΟ.** Το gate `🔐 Secret Scan (ADR-598 G12)` είναι **κόκκινο σκόπιμα**.
> **Δεν υπάρχει καμία καταστολή (allowlist/ignore) σε ισχύ και δεν πρέπει να μπει καμία πριν
> εκτελεστεί το §2/§3/§4.**
>
> **Απόφαση Giorgio (2026-07-28):** η εναλλαγή (rotation) των τριών διαπιστευτηρίων **αναβάλλεται
> μέχρι τη στιγμή που η εφαρμογή βγαίνει στην παραγωγή**. Μέχρι τότε το gate μένει κόκκινο ως
> **ειλικρινές σήμα**, όχι ως θόρυβος.

---

## 0. Η αρχή που διέπει το έγγραφο — γιατί δεν «πρασινίζουμε» τώρα

Ένα gate ασφαλείας που σιωπά για ένα **ζωντανό** διαπιστευτήριο δεν είναι πράσινο· είναι **τυφλό**.
Η σειρά είναι μονόδρομος και τη γράφει το ίδιο το `.gitleaks.toml`:

```
1. ROTATE  → η παλιά τιμή γίνεται άχρηστη
2. VERIFY  → η νέα τιμή δουλεύει, η παλιά απορρίπτεται
3. SUPPRESS→ ΜΟΝΟ ΤΟΤΕ μπαίνει value-scoped entry για την πλέον νεκρή τιμή
4. RECORD  → remediation record στο ADR-598 §G12
```

**Το βήμα 3 πριν το 1 είναι η ίδια η αστοχία που το gate υπάρχει για να πιάσει.** Μετά το rotation
η παλιά τιμή είναι απλώς μια συμβολοσειρά χωρίς εξουσία — γι' αυτό και **τότε** είναι θεμιτό να
γραφτεί μέσα στο `.gitleaks.toml` για να σιωπήσει η σάρωση ιστορικού.

Αυτό είναι το πρότυπο σχήμα αντιμετώπισης περιστατικού (NIST SP 800-61: *Containment → Eradication →
Recovery*) και ταυτίζεται με ό,τι κάνουν GitHub Secret Scanning / GitGuardian / AWS: **η ανάκληση
προηγείται πάντα της καταστολής του ευρήματος**.

### 0.1 Γιατί η διαγραφή του αρχείου δεν κάνει τίποτα

Το gate σαρώνει **ολόκληρο το ιστορικό** (`gitleaks detect --source .` με `fetch-depth: 0`, ~9.821
commits). Σβήνοντας μια γραμμή σήμερα, ο παλιός commit εξακολουθεί να την περιέχει. Οι **μόνοι** τρόποι
να σιωπήσει το εύρημα είναι:

| Δρόμος | Επιβιώνει history rewrite; | Κόστος |
|---|---|---|
| **value-scoped `regexes[]` στο `.gitleaks.toml`** ✅ *(επιλογή Giorgio)* | ✅ Ναι — δεν δένεται σε SHA | Μηδέν· σιωπά **μόνο** τη συγκεκριμένη τιμή, νέο secret στο ίδιο αρχείο πιάνεται κανονικά |
| `.gitleaksignore` με fingerprints | ❌ Όχι — τα SHA αλλάζουν | Μηδέν, αλλά εύθραυστο· δεν υπάρχει τέτοιο αρχείο σήμερα |
| `git filter-repo` | — (τα εξαφανίζει όντως) | **Σπάει κάθε clone**· απαιτεί force-push + συντονισμό. Δεν επιλέχθηκε |

---

## 1. Μητρώο εκτεθειμένων διαπιστευτηρίων

⚠️ **Αυτό το έγγραφο δεν περιέχει τις τιμές των secrets** — αλλιώς θα ήταν το ίδιο μια νέα διαρροή.
Οι τιμές ανακτώνται από τους commits που αναφέρονται, τη στιγμή της εκτέλεσης.

| # | Διαπιστευτήριο | Πού διέρρευσε | Working tree σήμερα | Κατάσταση |
|---|---|---|---|---|
| 1 | **Telegram webhook secret** (`TELEGRAM_WEBHOOK_SECRET`) | `telegram-webhook-setup.sh:5` — commit `10473f11` (16/01)<br>`ADR-263-…-playbook.md:114` — commit `e6e16713` (25/03) | ✅ **Καθαρό** — το script διαγράφηκε 28/07· το ADR είχε ήδη redacted | 🔴 **ΖΩΝΤΑΝΟ** — εκκρεμεί rotation |
| 2 | **Meta / Instagram app secret** (`META_APP_SECRET`) | `BACKUP_SUMMARY.json:35` — commit `a59bd551` (11/02) | ✅ Καθαρό — το αρχείο είναι untracked/μικρότερο σήμερα | 🔴 **ΖΩΝΤΑΝΟ** — εκκρεμεί rotation |
| 3 | **Sketchfab API token** | `HANDOFFS/2026-06-08_adr408-…CODE_NEXT.md:84` — commit `15fe995f` (08/06)<br>`HANDOFFS/2026-06-08_adr411-sanitary-…_NEXT.md:94` — **δεύτερη εμφάνιση, δεν είχε καταγραφεί** | ✅ **Καθαρό** — και τα δύο redacted 28/07 | 🔴 **ΖΩΝΤΑΝΟ** — εκκρεμεί rotation |

**Έκταση έκθεσης:** το repo είναι **δημόσιο**. Πρέπει να θεωρηθεί ότι και τα τρία είναι **γνωστά σε
τρίτους** από την ημερομηνία του αντίστοιχου commit. Το #1 ήταν εκτεθειμένο στο working tree επί
**~6,5 μήνες**.

### 1.1 Εκκαθάριση working tree που έγινε ήδη (28/07)

| Ενέργεια | Αρχείο | Σκεπτικό |
|---|---|---|
| **Διαγραφή** | `telegram-webhook-setup.sh` | Περιείχε το secret ως literal· έδειχνε σε `nestor-app.vercel.app` (**νεκρό** — Vercel παγωμένο 09/05, παραγωγή = Netcup). **Έχει αντικατασταθεί από SSoT**: `src/app/api/admin/telegram/webhook/telegram-webhook-client.ts` (`setWebhook`/`getWebhookInfo`/`deleteWebhook`) πίσω από το admin endpoint `POST /api/admin/telegram/webhook` (**ADR-705**). Καμία απώλεια δυνατότητας. |
| **Redaction ×2** | τα δύο `HANDOFFS/2026-06-08_*` | Αντικατάσταση της τιμής με δείκτη σε αυτό το runbook |

Αυτά **δεν πρασινίζουν** το gate (§0.1) — σταματούν τη **μελλοντική** διάδοση και καθαρίζουν το
`gitleaks protect --staged` (pre-commit CHECK 14).

---

## 2. Rotation — Telegram webhook secret

> Είναι το shared secret που επαληθεύει ότι το webhook το κάλεσε **όντως ο Telegram**
> (`src/app/api/communications/webhooks/telegram/telegram-security.ts:116`). Όποιος το κατέχει
> μπορεί να στείλει **πλαστά updates** στο `/api/communications/webhooks/telegram`.
> **Είναι το πιο κρίσιμο από τα τρία.**

1. **Παρήγαγε νέο secret** (1–256 χαρακτήρες, `A-Z a-z 0-9 _ -` — περιορισμός Telegram):
   ```bash
   openssl rand -hex 32
   ```
2. **Ενημέρωσε το περιβάλλον** — και στα δύο σημεία:
   - **Netcup** (παραγωγή): env var `TELEGRAM_WEBHOOK_SECRET`
   - **`.env.local`** (ανάπτυξη): ίδιο όνομα, **διαφορετική τιμή** (dev bot `8291786276`)
3. **Δήλωσέ το στον Telegram.** Δύο δρόμοι:
   - ✅ **Προτιμότερος — μέσω της εφαρμογής (ADR-705):** `POST /api/admin/telegram/webhook`
     με `{"url": "https://nestorconstruct.gr/api/communications/webhooks/telegram"}`.
     Χωρίς `secret_token` στο σώμα, ο handler παίρνει **αυτόματα** το `TELEGRAM_WEBHOOK_SECRET`
     από το περιβάλλον (`telegram-webhook.handlers.ts:171`) και κάνει verify μετά.
   - Εναλλακτικά, απευθείας `setWebhook` στο Telegram Bot API με `secret_token=<νέο>`.
4. **Επαλήθευση:**
   - `GET /api/admin/telegram/webhook` → `getWebhookInfo` δείχνει το σωστό URL, `pending_update_count` λογικό.
   - Στείλε μήνυμα στο bot → φτάνει.
   - Κλήση στο endpoint με τον **παλιό** header `X-Telegram-Bot-Api-Secret-Token` → **401/403**.
     Αυτό είναι η απόδειξη ανάκλησης· μη συνεχίσεις χωρίς αυτήν.
5. ⚠️ Το `scripts/start-telegram-dev.ps1` διαβάζει το `TELEGRAM_WEBHOOK_SECRET` από το `.env.local`
   (γραμμή 34) — δεν χρειάζεται αλλαγή, αλλά ξανατρέξ' το για να ξαναδηλωθεί το ngrok tunnel.

---

## 3. Rotation — Sketchfab API token

> Χρησιμοποιήθηκε **χειροκίνητα** για κατέβασμα CC-BY μοντέλων (ADR-409/410/411). **Δεν υπάρχει
> στον κώδικα** — καμία διαδρομή runtime δεν το διαβάζει (επαληθεύτηκε με grep, 28/07).
> Έκθεση: πρόσβαση στον λογαριασμό Sketchfab μέσω API, όχι στην εφαρμογή.

1. Sketchfab → **Settings → Password & API → API Token → Regenerate**.
2. **Μην** τον ξαναγράψεις σε αρχείο του repo. Αν χρειαστεί σε script, μόνο μέσω env var
   (`SKETCHFAB_API_TOKEN`), ποτέ literal.
3. Επαλήθευση ανάκλησης — ο παλιός πρέπει να δίνει `401`:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" \
     -H "Authorization: Token <ΠΑΛΙΟΣ>" https://api.sketchfab.com/v3/me
   ```

---

## 4. Rotation — Meta / Instagram app secret

> Το `META_APP_SECRET` υπογράφει/επαληθεύει τα webhooks Messenger + Instagram + WhatsApp
> (`src/lib/communications/meta-webhook/meta-signature.ts`, ADR-174/586). Διαρροή = τρίτος μπορεί
> να πλαστογραφήσει `X-Hub-Signature-256` και να **εισάγει ψεύτικα εισερχόμενα μηνύματα** στο
> AI pipeline.

1. Meta for Developers → **App → Settings → Basic → App Secret → Reset**.
2. Ενημέρωσε το `META_APP_SECRET` σε **Netcup** και σε `.env.local`.
3. ⚠️ **Η ανάκληση είναι άμεση** — τα webhooks σπάνε μέχρι να αναπτυχθεί το νέο. Κάν' το σε
   παράθυρο συντήρησης, με τη σειρά: reset → ενημέρωση env → restart → επαλήθευση.
4. Επαλήθευση: στείλε δοκιμαστικό μήνυμα από κάθε ενεργό κανάλι· ο έλεγχος υπογραφής πρέπει να
   περνά. Χειροκίνητο POST με υπογραφή από το **παλιό** secret → **απόρριψη**.
5. Έλεγξε ταυτόχρονα αν το `BACKUP_SUMMARY.json` παράγεται ακόμη με secrets μέσα
   (`enterprise-backup.ps1`) — αν ναι, **αυτή είναι η ρίζα** και πρέπει να σταματήσει, αλλιώς η
   διαρροή θα επαναληφθεί στο επόμενο backup.

---

## 5. Μετά το rotation — καταστολή του ιστορικού

**Μόνο όταν έχουν ολοκληρωθεί §2 + §3 + §4 και έχει αποδειχθεί η ανάκληση.**

Πρόσθεσε στο `.gitleaks.toml`, στο υπάρχον μπλοκ `regexes[]`, ένα entry ανά **πλέον νεκρή** τιμή:

```toml
  # --- G12 remediation 2026-XX-XX: ROTATED credentials, kept for history-scan suppression.
  #     Οι τιμές αυτές είναι ΝΕΚΡΕΣ (ανακλήθηκαν — δες docs/security/secret-rotation-runbook.md).
  #     Value-scoped επίτηδες: νέο/άγνωστο secret στα ίδια αρχεία εξακολουθεί να πιάνεται. ---
  '''<παλιό Telegram webhook secret — αντίγραψέ το από τον commit 10473f11>''',   # rotated YYYY-MM-DD (§2)
  '''<παλιό Sketchfab API token   — αντίγραψέ το από τον commit 15fe995f>''',     # rotated YYYY-MM-DD (§3)
  '''<παλιό META_APP_SECRET       — αντίγραψέ το από τον commit a59bd551>''',     # rotated YYYY-MM-DD (§4)
```

Πώς παίρνεις την τιμή χωρίς να τη γράψεις πουθενά αλλού:
```bash
git show 10473f11:telegram-webhook-setup.sh | sed -n '5p'
git show 15fe995f:HANDOFFS/2026-06-08_adr408-washing-machine-appliance-CODE_NEXT.md | sed -n '84p'
git show a59bd551:BACKUP_SUMMARY.json | sed -n '35p'
```

⚠️ **Δύο παγίδες:**
- Το `regexTarget = "match"` (γραμμή 32) σημαίνει ότι το entry ταιριάζει είτε στη διαδρομή είτε
  στην ίδια την τιμή. Οι τιμές είναι hex — **δεν** χρειάζονται escaping, αλλά **ποτέ** μη βάλεις
  γενικό pattern τύπου `[0-9a-f]{32}`: θα τύφλωνε το gate σε κάθε μελλοντικό hex secret.
- Ο Sketchfab token υπάρχει σε **δύο** αρχεία (§1) — ένα value-scoped entry τα καλύπτει και τα δύο.
  Αν είχε επιλεγεί `.gitleaksignore`, θα χρειάζονταν **δύο** fingerprints. Ακόμη ένας λόγος για την
  value-scoped επιλογή.

### 5.1 Επαλήθευση ότι το gate ξαναέγινε σήμα
```bash
gitleaks detect --source . --config .gitleaks.toml --redact --exit-code 1 --verbose
```
Πρέπει να δώσει **exit 0**. Αν εμφανιστεί εύρημα που **δεν** είναι στο §1 → **νέο** περιστατικό:
γύρνα στο §0 και ξεκίνα από την αρχή γι' αυτό.

### 5.2 Remediation record
Πρόσθεσε entry στο **ADR-598 §7 changelog** με: ημερομηνία rotation, ποια από τα 3, απόδειξη
ανάκλησης, τα entries που μπήκαν. Το ίδιο το `.gitleaks.toml` (γραμμή 17-18) **απαιτεί** αυτό το
record — χωρίς αυτό η καταστολή είναι ατεκμηρίωτη.

---

## 6. Πρόληψη — τι εμποδίζει την επανάληψη

| Επίπεδο | Κατάσταση | Κενό |
|---|---|---|
| **pre-commit CHECK 14** — `gitleaks protect --staged` | ✅ Υπάρχει (`scripts/git-hooks/pre-commit:835`) | **Soft**: αν το binary λείπει, μόνο προειδοποιεί. Σε μηχάνημα χωρίς `gitleaks` περνούν όλα. |
| **CI full-history** — `gitleaks-scan.yml` | ✅ Υπάρχει, pinned v8.18.4, authoritative | Πιάνει **μετά** το push· το secret έχει ήδη φύγει προς τα έξω |
| **GitHub push protection** | ❌ Δεν είναι ενεργό | Είναι το **μόνο** επίπεδο που μπλοκάρει *πριν* φτάσει στον GitHub |

**Πρόταση (δεν υλοποιήθηκε — απόφαση Giorgio):**
1. **Ενεργοποίηση GitHub Secret Scanning + Push Protection** (Settings → Code security). Δωρεάν σε
   δημόσια repos, μηδέν κώδικας, και είναι το επίπεδο που όντως λείπει — μπλοκάρει στον server,
   ανεξάρτητα από το τι έχει εγκατεστημένο ο κάθε dev.
2. **Σκλήρυνση του CHECK 14** σε fail-closed: αν λείπει το binary → BLOCK με οδηγία εγκατάστασης,
   αντί για σιωπηλό warn. Ευθυγραμμίζεται με τον κανόνα «fail-closed» των υπόλοιπων gates
   (ADR-598 §6.1).
3. **Κανόνας τεκμηρίωσης:** τα `HANDOFFS/*.md` και τα ADR **δεν** γράφουν ποτέ τιμές
   διαπιστευτηρίων — μόνο το **όνομα** της env var. Δύο από τις τέσσερις διαρροές ήρθαν από
   αρχεία τεκμηρίωσης, όχι από κώδικα.

---

## 7. Κατάσταση ολοκλήρωσης

- [x] Εντοπισμός & καταγραφή (§1) — **28/07/2026**
- [x] Εκκαθάριση working tree: 1 διαγραφή + 2 redactions (§1.1) — **28/07/2026**
- [ ] §2 Telegram webhook secret — rotation ⏸️ *αναβλήθηκε μέχρι το production (Giorgio, 28/07)*
- [ ] §3 Sketchfab API token — rotation ⏸️
- [ ] §4 Meta app secret — rotation ⏸️
- [ ] §5 Value-scoped entries στο `.gitleaks.toml` — **μπλοκαρισμένο από τα παραπάνω**
- [ ] §5.2 Remediation record στο ADR-598
- [ ] §6 Απόφαση για push protection / fail-closed CHECK 14

**Μέχρι να τσεκαριστούν τα §2–§5, το `🔐 Secret Scan (G12)` παραμένει κόκκινο. Αυτό είναι το
σωστό αποτέλεσμα, όχι σφάλμα του gate.**
