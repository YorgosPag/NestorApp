# ADR-865 — Η ΑΠΟΔΕΙΞΗ ΑΝΑΠΤΥΞΗΣ: «γραμμένο» δεν σημαίνει «ανεπτυγμένο»

> **Κατάσταση**: ✅ Υλοποιημένο (2026-09-16) · ✅ §10 ζωντανή επαλήθευση (2026-09-18) · ✅ §11 γραμμή παραγωγής — **ενεργή** (πρώτο πράσινο run `35426414076`, 2026-09-19· πρώτη πραγματική ανάπτυξη `35432199109` (storage)· εγγραφή κανόνων Firestore/δεικτών μέσα από τη γραμμή **αμέτρητη**, δες Changelog) · ✅ §11.8 κρίνεται ό,τι φεύγει (2026-09-19) (`docs/deployment/firebase-pipeline.md`) · **Πύλη**: CHECK 3.86 · **Αφορμή**: ADR-864 Φ1β
> **Σχετικά**: ADR-845 §Ο-18 (πρώτη εμφάνιση, χωρίς όργανο) · ADR-195 · ADR-787 Ε-3 · ADR-298 · ADR-757 (Tier 1) · ADR-860 §Ε1 (carry-forward)

---

## §1. Το περιστατικό — μετρημένο, όχι αφηγημένο

Η ενότητα **«Ιστορικό»** στη σελίδα του ιδιώτη (`/offers/<ownerPropertyId>`) έδειχνε κόκκινο:

```
Ιστορικό αλλαγών
Missing or insufficient permissions.
```

Η **υπόλοιπη σελίδα δούλευε άψογα**. Ο κώδικας ήταν **σωστός σε κάθε κρίκο** — επαληθευμένο με
ανάγνωση **και** ζωντανή μέτρηση:

| Κρίκος | Ετυμηγορία | Απόδειξη |
|---|---|---|
| `custodyOf` → ποιο βιβλίο | ✅ `personal` | το έγγραφο έχει `authorCompanyId: null` (Firestore MCP) |
| `AUDIT_LEDGER_COLLECTION.personal` | ✅ έγκυρο `CollectionKey` | `lib/audit/audit-ledger.ts:111` |
| tenant φρουρός `mode:'userId'` | ✅ **εγχέει** `where('userId','==',uid)` | `firestore-query.service.ts:105-108`, κοινός για `getAll`/`subscribe` |
| κανόνας `firestore.rules:3341` | ✅ σωστός | σουίτα emulator **42 κελιών**, πράσινη |
| δείκτης `firestore.indexes.json` | ✅ υπάρχει, με `userId` | `(entityType, entityId, userId, timestamp DESC)` |

**Και οι τέσσερις υποψήφιες ρίζες του handoff πέθαναν στη μέτρηση.** Αυτό που έλειπε **δεν ήταν
κώδικας**:

```
ζωντανοί δείκτες: 436   |   αρχείο: 437
η ΜΙΑ διαφορά: entity_audit_trail_personal (entityType, entityId, userId, timestamp DESC)
```

Ο κανόνας **και** ο δείκτης είχαν γίνει commit μαζί (`b307f46e`, 2026-09-16 16:04) και
αναπτύσσονται με την **ίδια χειροκίνητη πράξη**. Ο δείκτης αποδεδειγμένα δεν ανέβηκε ⇒ ούτε ο
κανόνας ⇒ η συλλογή έμεινε σε **default-deny**.

🔑 **Και το μήνυμα το αποδεικνύει μόνο του**: οι κανόνες κρίνονται **πριν** τα ευρετήρια. Αν
έλειπε *μόνο* ο δείκτης θα βλέπαμε `failed-precondition` (*«The query requires an index»*).
Βλέπουμε `permission-denied` ⇒ λείπει **ο κανόνας**, με τον δείκτη κρυμμένο από πίσω.

📏 **Η ηλικία της βλάβης**: `git rev-list --count b307f46e..HEAD` = **21 commits**.

---

## §2. Η ρίζα: **commit ≠ deploy**, και κανένα όργανο δεν ρωτούσε

Το push πάει **GitHub → Netcup → nestorconstruct.gr**. Το Firebase **δεν είναι στη διαδρομή**.
Κανόνες και δείκτες ανεβαίνουν **μόνο** με χειροκίνητο `firebase deploy`.

⚠️ **ΔΕΥΤΕΡΗ ΦΟΡΑ ΣΕ ΕΞΙ ΜΕΡΕΣ.** Το **ADR-845 §Ο-18** (2026-09-10) το είχε ήδη **ονομάσει**:

> *«κανένας αυτοματισμός δεν ανεβάζει δείκτες — το `firestore-rules.yml` μόνο ελέγχει, και το
> push πάει στο Netcup, όχι στο Firebase»*

Το ονόμασε και **δεν έφτιαξε όργανο**. Δεύτερη εμφάνιση δεν είναι ατύχημα — είναι **κενό
οργάνου**. *SSoT audit 2026-09-16: `grep deployment-ledger|deploy-parity|deployed-sha` → **No
files found**. Δεν υπήρχε «η μία» υλοποίηση· υπήρχε κενό.*

---

## §3. Έρευνα — και τι ΔΙΕΨΕΥΣΕ η μέτρηση

**Πρωτογενείς πηγές** (2026-09-16):

- **Terraform**: `plan -detailed-exitcode` → **exit 2 = drift**, με τη λεπτή διάκριση που μας
  αφορά: το `-refresh-only` απομονώνει το *«άλλαξε έξω»* από το *«άλλαξε το config και **δεν
  εφαρμόστηκε**»* — η **δεύτερη** είναι ακριβώς η δική μας.
- **Argo CD**: `OutOfSync` = live state ≠ desired state· **χωρίς `selfHeal`** η απόκλιση μένει
  **ορατή** *«until a human or a Git change acts on it»*. Ταιριάζει αυτούσιο με το N.(-1).
- **Firebase Security Rules API**: τα rulesets είναι **αμετάβλητα** και η ανάπτυξη
  παρακολουθείται σε **release**· το CLI λέει *«already up to date, skipping»* όταν ταιριάζουν.

🔴 **ΚΑΙ ΕΔΩ Η ΜΕΤΡΗΣΗ ΔΙΕΨΕΥΣΕ ΤΗΝ ΕΡΕΥΝΑ.** Η προφανής λύση ήταν «ρώτα τον πάροχο με
`--dry-run`». Μετρήθηκε:

```
$ firebase deploy --only firestore:rules --dry-run --project pagonis-87766
+ Dry run complete!          EXIT_CODE=0
```

**Exit 0, μηδέν αναφορά σε απόκλιση — ενώ η απόκλιση υπήρχε αποδεδειγμένα.** Το `--dry-run`
επικυρώνει **μεταγλώττιση**, όχι **ισοτιμία με το ανεπτυγμένο**. Το *«already up to date»*
τυπώνεται **μόνο σε πραγματικό deploy** — δηλαδή μόνο **αφού γράψεις**. **Πράσινο που σημαίνει
«δεν κοίταξα»** (σχήμα N.11 · N.12 · N.18).

**Δεύτερος φραγμός, μετρημένος**: `grep secrets.*(FIREBASE|GCP|GOOGLE)` στα workflows → **κενό**.
Το CI χρησιμοποιεί firebase-tools **μόνο** για emulator. Ζωντανή σύγκριση σε CI = αδύνατη σήμερα·
σε pre-commit = λάθος (δίκτυο + ταυτότητα σε hook). Το REST `firebaserules.googleapis.com`
απάντησε `SERVICE_DISABLED` + απαιτεί quota project στα ADC.

> 🔴 **ΔΙΑΨΕΥΣΤΗΚΕ 2026-09-18 (§10)**: το `SERVICE_DISABLED` **δεν** είναι φραγμός — είναι η
> απάντηση όταν λείπει το header **`x-goog-user-project`**. Με αυτό, τα **ίδια** ADC απαντούν `200`.
> Το «για κανόνες δεν υπάρχει read-only ερώτηση» ίσχυε μόνο για το **CLI**, όχι για το API.
> Ο φραγμός του **hook** παραμένει (δίκτυο + ταυτότητα)· γι' αυτό η ζωντανή ερώτηση ζει
> **δίπλα** στην πύλη, όχι μέσα της.

---

## §4. Η απόφαση

> **Η ερώτηση δεν είναι «τι είναι ζωντανά;» αλλά «υπάρχει ΑΠΟΔΕΙΞΗ ότι αυτά τα bytes έφυγαν;»**

Offline, με sha256 τριών αρχείων. Καμία ταυτότητα, κανένα δίκτυο.

| Απόφαση | Γιατί |
|---|---|
| **Μητρώο append-only**, μόνο ό,τι **συνέβη** | Χειρόγραφο πεδίο `pending` θα ήταν **δεύτερη αυθεντία** — θα σάπιζε ακριβώς όπως σάπισε η γνώση που γέννησε αυτό το ADR |
| Η εκκρεμότητα **ΠΑΡΑΓΕΤΑΙ** (τρέχον ≠ τελευταίο αναπτυγμένο) | Τίποτα να συντηρήσει άνθρωπος ⇒ τίποτα να ξεχάσει |
| Η γραμμή είναι **ΠΑΡΑΓΩΓΟ της πράξης** | `npm run firestore:deploy` = deploy **ΚΑΙ** καταγραφή, μία εντολή· γράφεται **μόνο** αν το deploy γύρισε 0. Γραμμένη στο χέρι θα ήταν **ισχυρισμός**, όχι απόδειξη |
| Αποτύπωμα της **ΠΗΓΗΣ**, όχι του `firestore.rules.compiled` | Το compiled είναι **παραγόμενο** και **untracked** ⇒ θα άλλαζε χωρίς αλλαγή περιεχομένου, αόρατο στο git |
| Ο παρονομαστής **παράγεται από το `firebase.json`** | Νέα βάση ή νέος στόχος **κοκκινίζει** μέχρι να τον δει άνθρωπος (fail-closed· η αντίστροφη διάταξη έχει αποτύχει **τέσσερις** φορές σε αυτό το δέντρο — `.gate-inventory.json` `$whyNotAList`) |
| Ηλικία σε **commits**, ποτέ σε μέρες | Ρολόι σε πύλη = άλλη ετυμηγορία αύριο (μάθημα CHECK 3.33) |

### 4.1 🔑 Δύο σοβαρότητες — και **δεν** είναι έκπτωση

> 🔁 **Αντικαταστάθηκε από το §11 (2026-09-18)**: ο Κ5 είναι πλέον **μόνο αναφορά** (σε commit **και**
> push), έναντι του `origin/main`. Η φύλαξη «κώδικας όχι χωρίς κανόνα» ζει στη γραμμή παραγωγής
> (`docker-build.yml`), όπου ρωτιέται ο **πάροχος**. Ο πίνακας μένει ως ιστορικό της απόφασης.

| Στιγμή | Ο Κ5 | Γιατί |
|---|---|---|
| **commit** | ⏳ ορατή αναφορά | Ο άνθρωπος **δουλεύει**· η στιγμή της ανάπτυξης είναι **δική του απόφαση** (N.(-1)). Πύλη που μπλόκαρε εδώ θα παρακαμπτόταν την πρώτη μέρα — και πύλη που παρακάμπτεται δεν είναι πύλη |
| **push** | 🚫 **μπλοκ** | Εκεί ο κώδικας **φεύγει προς την παραγωγή** χωρίς τον κανόνα του |

### 4.2 🔴 Καμία σκανδάλη — και είναι **όλο** το νόημα

Η πύλη τρέχει σε **ΚΑΘΕ** commit, όχι μόνο όταν αγγίζεις τα αρχεία. **Με σκανδάλη δεν θα είχε
πιάσει τη βλάβη που τη γέννησε**: το `b307f46e` τα άγγιξε, και μετά πέρασαν **21 commits** —
*εκεί* ξεχάστηκε. Κόστος: sha256 τριών αρχείων + ένα JSON.

---

## §5. 🏆 Πού ξεπερνάμε

| | Terraform | Argo CD | **Εδώ** |
|---|---|---|---|
| Πότε ρωτά | cron / nightly | reconciliation 120s | **κάθε commit** |
| Χρειάζεται δίκτυο/ταυτότητα | ναι | ναι | **όχι** |
| Πότε μπλοκάρει | — (ειδοποιεί) | — (χωρίς selfHeal) | **στο push**, πριν φύγει στην παραγωγή |
| Ηλικία απόκλισης | — | — | **σε commits** |

> 🔁 **§11 (2026-09-18)**: «πότε μπλοκάρει» → **στην κυκλοφορία** (`release` του `docker-build.yml`):
> ο κώδικας δεν φτάνει στους χρήστες πριν ο **πάροχος** επιβεβαιώσει κανόνες/δείκτες **READY** — με
> έγκριση ανθρώπου μόνο όταν η παραγωγή διαφέρει. «Πότε ρωτά» → **κάθε push + κάθε πρωί**, και ο πάροχος.

---

## §6. Ο μηχανισμός

| Κομμάτι | Πού |
|---|---|
| Μοντέλο (παρονομαστής, αποτύπωμα, μητρώο I/O) | `scripts/lib/firestore-deploy/model.js` |
| Κρίση (**καθαρή**, Κ1-Κ5) | `scripts/lib/firestore-deploy/judge.js` |
| Κόσμος (δίσκος + git) | `scripts/lib/firestore-deploy/world.js` |
| CLI πύλης | `scripts/check-firestore-deploy-proof.js` |
| Γεννήτορας (deploy **και** καταγραφή) | `scripts/firestore-deploy/record-deploy.js` |
| Ζωντανός κόσμος (**μόνο GET**, ADC) — §10 | `scripts/lib/firestore-deploy/live.js` |
| Κρίση ζωντανού (**καθαρή**, Sync × Health × προέλευση) — §10 | `scripts/lib/firestore-deploy/drift.js` |
| CLI ζωντανής επαλήθευσης — §10 | `scripts/firestore-deploy/verify-live.js` (`npm run firestore:verify`) |
| Πλάνο (**καθαρό**: none · apply · blocked) — §11 | `scripts/lib/firestore-deploy/plan.js` (`verify-live.js --plan`) |
| Γραμμή παραγωγής (πλάνο → έγκριση → ανάπτυξη → κυκλοφορία) — §11 | `.github/workflows/docker-build.yml` |
| Καθημερινός έλεγχος (Tier 1) — §11 | `.github/workflows/firebase-drift.yml` |
| Ταυτότητα χωρίς κλειδί (κοινή) — §11 | `.github/actions/firebase-identity` · runbook `docs/deployment/firebase-pipeline.md` |
| Αποστολέας Telegram (**ένας**) — §11 | `scripts/lib/ci/telegram.js` · `scripts/ci/telegram-notify.js` |
| Μεταγλώττιση κανόνων (**μία**, predeploy + επαλήθευση) | `compileRules` στο `scripts/build-firestore-rules.js` |
| Μητρώο (**παραγόμενο**, append-only) | `.firestore-deploy-ledger.json` |
| Φύλακας του push | `scripts/git-hooks/pre-push` *(νέο)* — από §11 μπλοκάρει **μόνο** Κ1-Κ4 |
| Άγκυρες | `scripts/__tests__/firestore-deploy-gate.test.js` · `scripts/__tests__/firestore-deploy-drift.test.js` (§10) · `scripts/__tests__/firestore-deploy-pipeline.test.js` (§11) |
| Πύλη | **CHECK 3.86** — `docs/gates/3.86.md` |

🔁 **Δανεισμός, όχι εφεύρεση**: η δομή *(model καθαρό · judge καθαρό · world με δίσκο+git ·
CLI λεπτό · γεννήτορας που γράφει append-only)* είναι **αυτούσια** του CHECK 3.85 / ADR-861,
γραμμένου την **ίδια μέρα**. Το `stableStringify`/`sha256` έρχονται από το **υπάρχον**
`scripts/lib/i18n-shell-slice/slice-build` — καμία δεύτερη σειριοποίηση (μάθημα ADR-749).

---

## §7. 🔴 Ο φύλακας που το CLAUDE.md ήδη προϋπέθετε

Το **N.(-1.1)** απαγορεύει ρητά το `git push --no-verify` *«bypasses pre-push hook safety
checks»*. Μετρημένο 2026-09-16: **κανένα pre-push hook δεν υπήρχε** (`scripts/git-hooks/` είχε
μόνο `commit-msg` και `pre-commit`· το `.git/hooks/` ήταν άδειο, `core.hooksPath =
scripts/git-hooks`). Η απαγόρευση **φύλαγε κενό**. Τώρα υπάρχει φύλακας.

---

## §8. Δηλωμένα όρια

1. Η **πύλη** αποδεικνύει ότι τα bytes **στάλθηκαν**, όχι ότι το Firebase τα **κράτησε**. ✅ Από
   2026-09-18 το δεύτερο το απαντά η **ζωντανή επαλήθευση** (§10, `npm run firestore:verify`) —
   κανόνες **και** δείκτες — αλλά **εκτός** πύλης: τρέχει μετά από κάθε deploy και κατ' απαίτηση,
   **όχι** σε commit/push (δίκτυο + ταυτότητα, §3). ✅ Από §11 τρέχει **αυτόματα** σε **κάθε** push
   (`firebase-plan`) και **κάθε πρωί** (`firebase-drift`), με ταυτότητα χωρίς κλειδί.
2. **Deploy ≠ διαθέσιμος**: ο δείκτης χτίζεται (`CREATING`) και το ερώτημα αποτυγχάνει μέχρι
   `READY` (ADR-845 §Ο-18). ✅ Από 2026-09-18 **μετριέται** (άξονας Health, έξοδος `3`, `--wait`)·
   πριν, το `--verify` το τύπωνε ως **σταθερό κείμενο** (§10.1).
3. Ο Κ3 συγκρίνει με το `HEAD`. Στο CI: `FIRESTORE_DEPLOY_BASE_REF`· χωρίς αυτήν, εκεί συγκρίνει
   το commit με τον εαυτό του.
4. Το **CHECK 3.66** μετρά αυθεντίες *δρομολογητής + pre-commit*. Το **pre-push** είναι **τρίτη**
   πηγή εκτέλεσης που δεν σαρώνει — η 3.86 είναι ορατή επειδή δρομολογείται **και** στο commit.
   Δηλωμένο, όχι σιωπηλό.
5. Το `functions` έχει δικό του κύκλο ζωής και **δεν** κρίνεται εδώ (`NOT_JUDGED`, με λόγο).

---

## §10. Η ζωντανή επαλήθευση — από **ισχυρισμό** σε **γεγονός** (2026-09-18)

> **Η δεύτερη ερώτηση**: η πύλη ρωτά *«στάλθηκαν αυτά τα bytes;»* από το **δικό μας** μητρώο.
> Εδώ ρωτάμε **τον πάροχο**: *«αυτά τρέχουν — και είναι διαθέσιμα;»*

### 10.1 🔴 Τι ήταν λάθος — μετρημένο, όχι υποθετικό

| Ισχυρισμός (πριν) | Μέτρηση 2026-09-18 |
|---|---|
| «Η έξοδος του `--verify` λέει ρητά αν κάτι είναι `CREATING`» | 🔴 **Σταθερό κείμενο**, τυπωνόταν **πάντα**. Το `firebase firestore:indexes` που ρωτούσε **δεν επιστρέφει κατάσταση** |
| «Για κανόνες δεν υπάρχει read-only ερώτηση» | 🔴 Υπάρχει: Rules API + `x-goog-user-project` ⇒ `200` με τα **ίδια** ADC (§3) |
| «Το `world.js` ήδη ρωτά ζωντανά τους δείκτες» (handoff) | 🔴 Το `world.js` είναι δίσκος + git· η ερώτηση ζούσε στο `record-deploy.js` |
| `verifyIndexes` = πλήρης σύγκριση | ⚠️ Έβλεπε **μόνο** «λείπουν». Όχι ζωντανούς **εκτός** αρχείου (που το επόμενο deploy ζητά να **σβήσει**), όχι `fieldOverrides`/TTL, όχι `queryScope`/`density` |

### 10.2 Η απόφαση

| Απόφαση | Γιατί — και ποιος το κάνει έτσι |
|---|---|
| **Δύο άξονες**: Sync (ορισμοί = δέντρο;) **×** Health (διαθέσιμο;) | **Argo CD**: `sync status` ≠ `health status`. Δείκτης σε `CREATING` είναι `Synced` **και** `Progressing` — ένας άξονας δεν μπορεί να το πει |
| Κωδικοί εξόδου **0 · 1 · 2 · 3 · 4** | **Terraform** `-detailed-exitcode` (0 ok · 1 σφάλμα · 2 απόκλιση) **+** `3` Progressing · `4` Degraded — ο άξονας υγείας που το Terraform δεν έχει |
| `--wait` ξαναρωτά **μόνο** όσο `Progressing` | **`argocd app wait --health`** · **`kubectl rollout status`**. Απόκλιση/βλάβη **δεν** «περνούν με αναμονή» |
| Ταύτιση δεικτών **του deployer** | `processIndex` · `indexMatchesSpec` · `fieldMatchesSpec` του **firebase-tools 15.13.0**, αυτούσια. Επαληθευτής με **άλλη** σημασιολογία από αυτόν που γράφει κρίνει **άλλο πράγμα** |
| Releases **του deployer** | `cloud.firestore` · `firebase.storage/<defaultBucket>`. 🔴 Το project έχει **και** νεκρό `firebase.storage` (2025-08-10) — «το πρώτο που μοιάζει» θα έκρινε λάθος release |
| Σύγκριση κανόνων με **φρέσκια μεταγλώττιση της πηγής** | Όχι με το untracked `.compiled`: αυτό θα απέδειχνε «artifact = παραγωγή», όχι «**δέντρο** = παραγωγή». `compileRules` εξήχθη **καθαρή** — **μία** μεταγλώττιση για predeploy **και** επαλήθευση |
| Ταυτότητα: **ADC** μέσω του υπάρχοντος `firebase-admin` | Πρακτική Google· **ίδιος κώδικας** τοπικά (`gcloud auth application-default login`) και σε CI (service account). Κανένα νέο πακέτο, κανένα shell-out |
| **Εκτός** πύλης | Δίκτυο + ταυτότητα σε pre-commit = αργή, offline-κόκκινη πύλη (§3). Τρέχει **μετά από κάθε deploy** (αυτόματα) και κατ' απαίτηση |
| Μετά από κάθε deploy, ο κωδικός εξόδου είναι **της ζωντανής ερώτησης** | «Αναπτύχθηκε» δεν αναφέρεται **ποτέ** ως «διαθέσιμο» χωρίς να ρωτηθεί ο πάροχος (μάθημα ADR-845 §Ο-18) |

### 10.3 🏆 Πού ξεπερνάμε: **απόδοση προέλευσης σε τρεις δρόμους**

Terraform και Argo CD συγκρίνουν **δύο** πράγματα (επιθυμητό · ζωντανό). Εμείς έχουμε **τρίτο**: το
append-only μητρώο με το **commit** κάθε ανάπτυξης. Άρα για κάθε απόκλιση κανόνων απαντάμε και
**από πού ήρθε** αυτό που τρέχει:

| Προέλευση | Σημαίνει | Ενέργεια |
|---|---|---|
| `tree` | ζωντανό = δέντρο | καμία (αν το μητρώο δεν το ξέρει ⇒ ⚠️ ανάπτυξη **εκτός εργαλείου**) |
| `recorded` | ζωντανό = η τελευταία **καταγεγραμμένη** ανάπτυξη (@commit) — το δέντρο προχώρησε | `npm run firestore:deploy` |
| `foreign` | ζωντανό ≠ δέντρο **και** ≠ κάθε καταγεγραμμένη | **έρευνα**: Console · rollback · άλλο δέντρο |
| `unattributable` | η καταγεγραμμένη δεν ανασυντίθεται (bytes μη δεσμευμένα) | δηλωμένο, **ποτέ** ψευδές `foreign` |

Η ανασύνθεση γίνεται από το git (`<commit>:<πηγή>`). 🔴 **Μετρημένη παγίδα**: με `core.autocrlf=true`
το `storage.rules` είναι **CRLF στον δίσκο, LF στο blob**, ενώ το `firestore.rules` LF και στα δύο.
Ούτε `git show` ούτε `git cat-file --filters` (που εξαρτάται από τη ρύθμιση **του μηχανήματος**)
αναπαράγουν πάντα τον δίσκο ⇒ δοκιμάζονται οι **τρεις αποδόσεις γραμμών** και δεκτή είναι εκείνη που
**ταιριάζει με το sha256 του μητρώου**. Το αποτύπωμα είναι η απόδειξη· καμία μαντεψιά.

### 10.4 Μέτρηση στην παραγωγή (2026-09-18, `pagonis-87766`)

```
✓ Synced · Healthy  firestore:rules    release 08:27:34Z · 020f8f74…   (116.677 bytes = compileRules(firestore.rules))
✓ Synced · Healthy  firestore:indexes  ζωντανά 475 · αρχείο 475 · overrides 2/2 · STANDARD · 475/475 READY
✓ Synced · Healthy  storage            release 08:27:32Z · 3dd4e096…   (= storage.rules, CRLF)
EXIT 0
```

**Αρνητικοί μάρτυρες πάνω σε ΠΡΑΓΜΑΤΙΚΑ ζωντανά δεδομένα** (αλλοίωση **μόνο** του επιθυμητού, στη
μνήμη): κανόνας αλλαγμένος ⇒ `OutOfSync`/`recorded` **@78b75dc1** (η ανασύνθεση από το git ταίριαξε με
την παραγωγή) · ξένη αλλαγή ⇒ `foreign` · δείκτης εκτός αρχείου ⇒ `extra` · δείκτης που λείπει ⇒
`missing` · TTL που διαφωνεί ⇒ `missing` · δείκτης σε `CREATING` ⇒ `Synced`/`Progressing`, έξοδος **3**.

### 10.5 Δηλωμένα όρια

1. ~~**Κανένας αυτοματισμός δεν ρωτά περιοδικά.**~~ ✅ **ΕΚΛΕΙΣΕ — §11**: `firebase-drift.yml` κάθε πρωί
   (Tier 1) + `firebase-plan` σε κάθε push. 🔴 Και ο ισχυρισμός «ο κώδικας είναι ήδη έτοιμος (ADC)»
   ήταν **μισός**: το `firebase-admin` 12.7.0 **δεν** δέχεται ταυτότητα χωρίς κλειδί (§11.3).
2. ~~**Το deploy μένει χειροκίνητο.**~~ ✅ **ΕΚΛΕΙΣΕ — §11**: το CI αναπτύσσει **με έγκριση** (GitHub
   environment), **μόνο** όταν η παραγωγή διαφέρει, και ο κώδικας **περιμένει** δείκτες READY. Η
   χειροκίνητη ανάπτυξη μένει για **έκτακτη ανάγκη**.
3. Τα αποτυπώματα του μητρώου είναι **ευαίσθητα σε line endings** (sha256 των bytes του δίσκου): το
   `storage.rules` αναπτύχθηκε με CRLF. ✅ **Μερικώς κλειστό — §11**: η **ζωντανή** σύγκριση και ο Κ5
   γίνονται πλέον **modulo CRLF/LF** (`M.normalizeEol`). Τα αποτυπώματα του **μητρώου** μένουν bytes του
   δίσκου — δηλωμένο (αλλάζει μόνο αν αλλάξει το σχήμα του μητρώου).
4. Πολλαπλές βάσεις (`firestore` ως **πίνακας** στο `firebase.json`) **δεν** υποστηρίζονται — ούτε από
   την πύλη. Ο Κ1 κοκκινίζει αν εμφανιστεί νέο κλειδί.

---

## §11. Η γραμμή παραγωγής — η παραγωγή **ελέγχεται** και **ενημερώνεται** από το CI (2026-09-18)

> **Η τρίτη ερώτηση**: όχι «στάλθηκαν;» (πύλη) ούτε «τρέχουν;» (§10) αλλά **«κυκλοφορεί ο κώδικας
> ΜΟΝΟ όταν η παραγωγή Firebase είναι έτοιμη γι' αυτόν — χωρίς να το θυμηθεί άνθρωπος;»**

### 11.1 Η αφορμή — και το αυγό-κότα που έπρεπε να λυθεί πρώτο

Το §10.5 #1-#2 άφηνε δύο κενά: κανείς δεν ρωτούσε **περιοδικά**, και η ανάπτυξη ήταν **χειροκίνητη** ⇒
το push πάει στο Netcup ⇒ η παραγωγή **δομικά** ξαναπαλιώνει (16/09 · 18/09). Εντολή Giorgio: και τα δύο.

🔴 **Το κεντρικό ερώτημα (handoff §5.1)**: αν αναπτύσσει το CI, πώς φτάνει η γραμμή του μητρώου στο
δέντρο; Μετρημένο: ο Κ5 στο pre-push θα μπλόκαρε **κάθε** push που θα έκανε το CI να αναπτύξει —
**το push ΕΙΝΑΙ το αίτημα**. Τρεις δρόμοι:

| | Δρόμος | Ετυμηγορία |
|---|---|---|
| α | το CI κάνει **commit πίσω** τη γραμμή | ❌ ρομπότ γράφει στο έργο (N.(-1))· το τοπικό `main` μένει πίσω ⇒ το επόμενο push απορρίπτεται· με δεύτερο πράκτορα στο ίδιο δέντρο, επικίνδυνο. Οι μεγάλοι δεν το κάνουν |
| **β** | **GitOps**: το δέντρο = «τι θέλουμε»· ρωτιέται ο **πάροχος**· ιστορικό = το σύστημα ανάπτυξης | ✅ **Επιλέχθηκε** |
| γ | μόνο έλεγχος, όχι ανάπτυξη | ❌ αφήνει το §10.5 #2 ανοιχτό |

**Γιατί β, με πρωτογενή πηγή**: Argo CD, *«An automated sync will only be performed if the
application is OutOfSync»* · *«By default (and as a safety mechanism), automated sync will not delete
resources»* (argo-cd.readthedocs.io, `auto_sync`). Terraform: plan → **έγκριση** → apply.

### 11.2 Ο μηχανισμός

```
push main ─► build-and-push (εικόνα → GHCR :main-<sha>, ΟΧΙ :latest) ─────────────┐
          ─► firebase-plan  (drift reader · verify-live --plan --wait) ──┐           ├─► release: :latest → Coolify
                 └─ action=apply ─► firebase-apply (environment firebase-production,  │
                                    ⏸ ΕΓΚΡΙΣΗ · deployer · deploy --only <διαφέροντες> │
                                    → verify --wait μέχρι READY) ───────────────────────┘─► notify (Telegram)
cron 04:30 UTC ─► firebase-drift (drift reader · verify --wait) ─► Tier 1 ⇒ CI Health σχόλιο + Telegram σε μετάβαση
```

| Απόφαση | Γιατί |
|---|---|
| Έγκριση **μόνο όταν η παραγωγή διαφέρει** (`plan.js`) | Φίλτρο διαδρομών θα έχανε **ακριβώς** τη βλάβη του §1: ο κανόνας άλλαξε και **21 commits** αργότερα έλειπε — κανένα δεν άγγιζε το αρχείο. Πιάνει και αλλαγές από την Console |
| Πλάνο **πριν** την έγκριση, στη σελίδα της | Terraform plan: εγκρίνεις **αυτό που θα γίνει**, όχι «κάτι» (`$GITHUB_STEP_SUMMARY`) |
| Αναπτύσσονται **μόνο** οι στόχοι που διαφέρουν (`--only`) | ελάχιστη ακτίνα αλλαγής |
| Ο κώδικας **περιμένει** δείκτες READY | Deploy ≠ διαθέσιμος (§8 #2, ADR-845 §Ο-18). Το Argo CD (sync waves) δεν περιμένει χτίσιμο δείκτη Firestore |
| Fail-closed: πάροχος σιωπηλός / έγκριση απορρίφθηκε / δείκτης όχι READY ⇒ **καμία κυκλοφορία** | άγνωστο ≠ «εντάξει» |
| Δείκτες εκτός αρχείου: **none + προειδοποίηση**, ποτέ `--force` | διαγραφή δείκτη σπάει ερωτήματα **αμέσως**. Μετρημένο στο firebase-tools 15.13.0 (`lib/firestore/api.js:85-121`): `--non-interactive` χωρίς `--force` **δεν** σβήνει· και το `checkStorageRulesIamPermissions` **δεν** αγγίζει IAM (`lib/rulesDeploy.js:65`) |
| **Immutable tag + promote** (`:main-<sha>` → `:latest` μόνο στο `release`) | `:latest` = «ό,τι κυκλοφόρησε» ⇒ και το carry-forward (ADR-860 §Ε1) διαβάζει τη σωστή προηγούμενη έκδοση |
| Ιστορικό = **GitHub Deployment** του environment | αυτόματο (ποιος ενέκρινε, πότε, ποιο commit) — κανείς δεν το γράφει με το χέρι. Το τοπικό μητρώο μένει για ανάπτυξη **έκτακτης ανάγκης** (`npm run firestore:deploy`, το γράφει όπως πάντα) |
| Προέλευση από το **ιστορικό του git** (`world.attributeFromHistory`, νέο `ORIGIN.HISTORY`) | η γραμμή αναπτύσσει **μόνο δεσμευμένα** bytes ⇒ το git **είναι** το μητρώο της· ταύτιση περιεχομένου (φραγμένη στα 200 commits της πηγής — μετρημένο: 7,6s εύρεση, 19s πλήρης αστοχία σε 161 commits) |
| Σύγκριση κανόνων **modulo CRLF/LF** (`M.normalizeEol`) | Argo CD diff normalization: CI Linux = LF, ζωντανό storage = CRLF (αναπτύχθηκε από Windows) ⇒ αλλιώς **ψευδές** OutOfSync ανά μηχάνημα. Ορατή σημείωση όταν διαφέρουν μόνο οι αλλαγές γραμμής |
| **Ο Κ5 δεν μπλοκάρει πια** — γίνεται ενημέρωση έναντι `origin/main` | η φύλαξη μετακόμισε εκεί όπου **δεν** παρακάμπτεται με μεταβλητή και ισχύει από **κάθε** μηχάνημα |
| Καρφωμένο `firebase-tools@15.13.0` (`M.FIREBASE_TOOLS_VERSION`, `npx --yes`) | ήταν μόνο **global** στον υπολογιστή· ο επαληθευτής αντιγράφει τη σημασιολογία **αυτής** της έκδοσης |

### 11.3 Ταυτότητα — **χωρίς κλειδί**, **ελάχιστα** δικαιώματα (μετρημένα)

| Εύρημα | Μέτρηση |
|---|---|
| 🔴 `roles/datastore.indexViewer` **δεν υπάρχει** | `gcloud iam roles describe` → *not found* |
| 🔴 Ο μόνος έτοιμος ρόλος ανάγνωσης (`datastore.viewer`) έχει `datastore.entities.get/list` | = το CI θα διάβαζε **κάθε έγγραφο πελάτη** ⇒ **custom roles** |
| Τα 18 ονόματα δικαιωμάτων υπάρχουν | `projects:testIamPermissions` στο `pagonis-87766` → 18/18 |
| 🔴 **Το `firebase-admin` 12.7.0 ΔΕΝ δέχεται ταυτότητα χωρίς κλειδί** | `credential-internal.js:479-496`: μόνο `service_account`/`authorized_user`/`impersonated_service_account` — το `external_account` (WIF) ⇒ *«Invalid contents in the credentials file»*. Ο ισχυρισμός του §10.2 «ίδιος κώδικας τοπικά και σε CI» ίσχυε **μόνο με κλειδί** ⇒ το `live.js` περνά στο **`google-auth-library`** (Apache-2.0, **9.15.1** — ήδη στο lockfile ως *optional*, πλέον ρητό devDependency, **μία** έκδοση, CHECK 3.65 ✅) — **το ίδιο** που χρησιμοποιεί το firebase-tools (`lib/requireAuth.js`) |
| `google-github-actions/auth` | **v3.0.0** (2025-08-28), **Apache-2.0**, απαιτεί `id-token: write` |

| Ταυτότητα | Ρόλος | Ποιος μπορεί να τη γίνει |
|---|---|---|
| `gh-firebase-verify` | `nestorFirebaseDriftReader` (8, ζωντανά): `firebaserules.{releases,rulesets}.get` · `datastore.databases.getMetadata` · `datastore.schemas.list` · `firebasestorage.defaultBucket.get` · `firebasestorage.buckets.get` · `resourcemanager.projects.get` · `serviceusage.services.use`. ⚠️ Τα **τρία** του Storage/project **δεν χρησιμοποιούνται** μετά το §11.7 (προστέθηκαν 19:13 στη διάγνωση και **δεν** έλυσαν το 404) — αφαιρούνται όταν πρασινίσει η γραμμή | κάθε job **αυτού** του repo στο `main` |
| `gh-firebase-deploy` | `nestorFirebaseRulesDeployer` (+12 δημιουργίας/ενημέρωσης) — **χωρίς** `*.delete`, `entities.*`, `setIamPolicy` | **μόνο** `subject/repo:YorgosPag/NestorApp:environment:firebase-production` ⇒ το κλειδί **δεν εκδίδεται** χωρίς έγκριση |

Πόρτα WIF: `assertion.repository_owner_id=='213181784' && assertion.repository_id=='1113295967' &&
assertion.ref=='refs/heads/main'` — **αριθμητικά** ids κατά το cybersquatting (Google, *Best practices
for using Workload Identity Federation*). Κοινό βήμα: `.github/actions/firebase-identity` (**ένα**
composite, τρεις καταναλωτές). Βήματα Giorgio: `docs/deployment/firebase-pipeline.md`.

**Κόστος (πηγές)**: GitHub Actions *«free for standard GitHub-hosted runners in public repositories»*
(το repo είναι **δημόσιο**, μετρημένο) · Environments με required reviewers: *«GitHub Free … public
repositories»* ✅. Google: μερικές δεκάδες αναγνώσεις **ρυθμίσεων** ανά ημέρα — όχι αναγνώσεις
εγγράφων. ⚠️ **Γραπτή επίσημη τιμή για WIF/Rules API ΔΕΝ βρέθηκε** — επαλήθευση στον λογαριασμό
χρέωσης μετά από μία εβδομάδα, όχι υπόσχεση «μηδέν».

### 11.4 Ειδοποίηση — **ένα** κανάλι πολιτικής, **ένας** αποστολέας

- `firebase-drift.yml` = **Tier 1** (`.ci-gate-tiers.json`) ⇒ ο CI Health συγκεντρωτής (ADR-757)
  σχολιάζει σε **μετάβαση** **και** (νέο) στέλνει Telegram — η πολιτική `alert` σε **ένα** σημείο
  (`health-state.tier1Alert`). Σταθερό κόκκινο = σιωπή.
- `scripts/lib/ci/telegram.js` = ο **ένας** αποστολέας. Το inline `curl` του `docker-build.yml`
  αντικαταστάθηκε — είχε το μήνυμα του commit **μέσα** στο script (`echo "${{ …message }}"`: script
  injection κατά τον οδηγό hardening του GitHub) και Markdown που έσπαγε σιωπηλά σε `_`/`*`. Τώρα:
  μεταβλητή περιβάλλοντος + HTML με διαφυγή· **ποτέ** δεν ρίχνει τη γραμμή.

### 11.5 Άγκυρες

`scripts/__tests__/firestore-deploy-pipeline.test.js` — πλάνο σε **κάθε** κλάδο με θετικό μάρτυρα ·
CRLF/LF · προέλευση από **πραγματικό** ιστορικό · deployer (καρφωμένη έκδοση, **ποτέ** `--force`,
`--pipeline` μόνο στο Actions) · **η δομή** του `docker-build.yml` μέσα από τον **έναν** αναγνώστη YAML
(`workflow-meta.readWorkflowJobs`, νέο): `release` χρειάζεται `firebase-plan`+`firebase-apply`, το apply
ζει πίσω από το environment, **μόνο** το `release` ενεργοποιεί το Coolify · ειδοποίηση. **9/9
εκτελεσμένες μεταλλάξεις** σκοτώθηκαν (αντικατάσταση → jest → επαναφορά σε `finally` → sha256 ✓).

### 11.6 Δηλωμένα όρια

1. **Ενεργοποίηση**: μέχρι να γίνουν τα βήματα του Giorgio (runbook §1), το `firebase-plan` αποτυγχάνει
   ⇒ **καμία** κυκλοφορία στο Netcup (fail-closed). Η σειρά είναι: στήσιμο ταυτότητας → push.
2. Η συμπεριφορά του `concurrency` με job που **περιμένει έγκριση** (αντικαθίσταται ή κρατά θέση;)
   **δεν** μετρήθηκε — θα μετρηθεί στην πρώτη διπλή εκκρεμότητα.
3. Η συμβατότητα `google-auth-library` ↔ WIF και τα 12 δικαιώματα του deployer **μετρώνται** στο
   πρώτο τρέξιμο (`firebase_dry_run`)· αν λείπει δικαίωμα, το μήνυμα το ονομάζει (runbook §3).
4. Προέλευση από ιστορικό: παλαιότερη των 200 αλλαγών της πηγής μένει `foreign` — δηλωμένο.
5. Ο Κ5 συγκρίνει με το `origin/main` όπως το ξέρει ο **τοπικός** κλώνος (τελευταίο fetch).

### 11.7 Ο bucket **δηλώνεται**, δεν ανακαλύπτεται *(2026-09-18, πρώτο τρέξιμο της γραμμής)*

**Το συμβάν (μετρημένο)**: στο πρώτο τρέξιμο (run `35384172883`) το `firebase-plan` σταμάτησε με
`storage · 404 NO_DEFAULT_BUCKET` ⇒ «ο πάροχος δεν απάντησε» ⇒ **καμία** κυκλοφορία (fail-closed,
σωστά). Το **ίδιο** αίτημα με διαπιστευτήρια χρήστη απαντά `pagonis-87766.firebasestorage.app`, και ο
ρόλος `nestorFirebaseDriftReader` **έχει** το `firebasestorage.defaultBucket.get`.

🔴 **Η ΥΠΟΘΕΣΗ «ΛΕΙΠΕΙ ΔΙΚΑΙΩΜΑ» ΔΙΑΨΕΥΣΤΗΚΕ ΔΥΟ ΦΟΡΕΣ.** Audit log: `UpdateRole` και στους δύο ρόλους
19:13:06Z / 19:13:30Z (+`firebasestorage.buckets.get` · +`resourcemanager.projects.get` — ό,τι έχει ο
`roles/firebasestorage.viewer` πλην των `*.list`). Δύο ανεξάρτητα re-run (attempt 2 ~25′ και attempt 3
~10′ μετά) ⇒ **το ίδιο** 404. Η μίμηση του λογαριασμού υπηρεσίας για άμεση διάγνωση **δεν** έγινε.

| Πηγή | Εύρημα |
|---|---|
| firebase-tools 15.13.0 `deploy/storage/prepare.js` | `if (!Array.isArray(rulesConfig)) { getDefaultBucket(...) }` — η ανακάλυψη γίνεται **μόνο** στη μορφή αντικειμένου, και **αντικαθιστά** κάθε `bucket` του |
| `deploy/storage/release.js` · `rc.js` | `target` ⇒ `rc.target(project,'storage',target)` = `targets[project].storage[target] \|\| []`, release σε **κάθε** bucket της λίστας· κενή ⇒ `requireTarget` ρίχνει |
| 🔴 `emulator/storage/rules/config.js` | πίνακας **χωρίς** `target` ⇒ `throw "Must supply 'target' in Storage configuration"` — **ο emulator δεν ξεκινά**· target χωρίς αντιστοίχιση σε demo project ⇒ **ΑΝΟΙΧΤΟΙ** προεπιλεγμένοι κανόνες |
| Firebase, [*Deploy targets*](https://firebase.google.com/docs/cli/targets) | ο **τεκμηριωμένος** μηχανισμός δήλωσης bucket: `firebase target:apply storage main <bucket>` + `"storage": [{ "target": "main", … }]` |
| [firebase-tools #6593](https://github.com/firebase/firebase-tools/issues/6593) (2023-12 → 2026-06) | το συμβόλαιο IAM του `defaultBucket` είναι **ασταθές και λάθος τεκμηριωμένο**: το δικαίωμα ήταν κρυφό από custom roles· κάθε χρήστης χρειάστηκε **άλλο** σύνολο (`firebasestorage.viewer` · +Storage Admin · `storage.buckets.get/list` · +`firebasestorage.admin`)· 06/2026: *«my CI/CD was working fine, no upgrades — something changed somewhere»* |
| Terraform `google_firebaserules_release` | `name = "firebase.storage/${bucket}"` — **δηλωμένος** πόρος, καμία ανακάλυψη |

⇒ Όποιο δικαίωμα κι αν προστεθεί είναι **μαντεψιά πάνω σε alpha API που αλλάζει χωρίς ειδοποίηση**. Η
κρίσιμη διαδρομή κυκλοφορίας **δεν** εξαρτάται πια από αυτό: **η ερώτηση καταργήθηκε**.

**Απόφαση (αναθεωρημένη την ίδια μέρα)**: η πρώτη εκδοχή (`"storage": [{ "bucket": … }]`) έλυνε το
deploy αλλά **έσπαγε τον emulator** (γραμμή 3 του πίνακα) — μετρημένο πάνω στην πραγματική
`getStorageRulesConfig`. Τελική, με τον μηχανισμό της Google:

```jsonc
// firebase.json
"storage": [{ "target": "main", "rules": "storage.rules" }]
// .firebaserc — ΜΟΝΟ targets· ΚΑΝΕΝΑ "projects" (εντολή χωρίς --project δεν φτάνει ποτέ στην παραγωγή)
"targets": { "pagonis-87766":            { "storage": { "main": ["pagonis-87766.firebasestorage.app"] } },
             "demo-nestor":              { "storage": { "main": ["demo-nestor.appspot.com"] } },
             "demo-nestor-functions-it": { "storage": { "main": ["demo-nestor-functions-it.appspot.com"] } } }
```

Ο επαληθευτής **και** ο deployer **και** ο emulator διαβάζουν την **ίδια** δήλωση. Ο **ένας** αναγνώστης
`storageEntriesOf` → `declaredBucketOf(firebaseJson, firebaserc, project)` (model.js) λύνει το `target`
**ακριβώς** όπως το `release.js`· ≠1 στοιχεία · `bucket`+`target` μαζί (ο deployer αγνοεί σιωπηλά το
`bucket`) · target με 0 ή >1 buckets ⇒ **ρίχνει**. Στο `live.js` λάθος δήλωση γίνεται `{error}` **με
όνομα** (όχι «ο πάροχος δεν απάντησε»), χωρίς καμία κλήση στο `defaultBucket`.

🏆 **Πέρα από το Firebase — τρεις άγκυρες πάνω στο ΠΡΑΓΜΑΤΙΚΟ αποθετήριο** (`firestore-deploy-drift.test.js`):
1. **Οι κανόνες πάνε στον bucket που χρησιμοποιεί η εφαρμογή**: ο λυμένος bucket για το
   `FIREBASE_PROJECT_ID` του `docker-build.yml` **=** `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`. Δύο δηλώσεις
   του ίδιου γεγονότος· αν αποκλίνουν, το deploy «πετυχαίνει» σε bucket που η εφαρμογή δεν αγγίζει και
   ο πραγματικός μένει με τους **παλιούς** κανόνες — σιωπηλά. Κανένα εργαλείο της αγοράς δεν το ελέγχει.
2. **Κάθε emulator με storage και ρητό `--project` ξεκινά με τους δικούς μας κανόνες** (σάρωση του
   `package.json`) — ποτέ με τους ανοιχτούς προεπιλεγμένους του demo project.
3. **Το `.firebaserc` δεν ορίζει προεπιλεγμένο project.**

**Μετρημένο 2026-09-18 (όχι υποθετικό)**:

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `verify-live --project pagonis-87766` (ζωντανό) | storage **✓ Synced**, release `3dd4e096…` — **το ίδιο** που έβρισκε η ανακάλυψη ⇒ δήλωση ≡ εύρεση στην παραγωγή |
| `firebase deploy --only storage --dry-run --debug` (15.13.0) | exit 0 · `requireTarget(pagonis-87766, storage, main)` ✓ · **0** κλήσεις `defaultBucket` |
| `test:storage-rules:emulator` (`demo-nestor`) | ο emulator **ξεκινά** · 12/13 σουίτες, 182/183 — το 1 κόκκινο (`user-avatars` · same_tenant_user × write) **προϋπάρχει**: ίδιο με τη διαμόρφωση του HEAD (15 tests, 1 κόκκινο), άσχετο |
| `test:functions-integration:emulator` (`demo-nestor-functions-it`) | ο emulator **ξεκινά**, triggers Storage πυροδοτούνται στο `demo-nestor-functions-it.appspot.com` · 11/12 — το 1 κόκκινο είναι `TypeError … 'serverTimestamp'` **μέσα** στο `orphan-cleanup.ts:90` (`admin.firestore.FieldValue`), σφάλμα κώδικα άσχετο με τη δήλωση· **δεν** ξαναμετρήθηκε με τη διαμόρφωση του HEAD |
| jest `firestore-deploy-{drift,gate,pipeline}` | **83/83** · **9/9 μεταλλάξεις σκοτωμένες** (>1 buckets δεκτό · target αγνοείται · bucket+target δεκτά · live αγνοεί τη δήλωση · σφάλμα δήλωσης ⇒ σιωπηλή ανακάλυψη · `.firebaserc` χωρίς demo · λάθος bucket παραγωγής · default project · `firebase.json` πίσω σε `bucket`) |

Τα `storage-rules.yml` και `functions-integration.yml` ενεργοποιούνται πλέον **και** από το `.firebaserc`
(πριν: μόνο `firebase.json` ⇒ αλλαγή αντιστοίχισης θα περνούσε αθέατη από τον emulator του CI).

⚠️ **Δικαιώματα**: με δηλωμένο bucket, τα `firebasestorage.defaultBucket.get` · `firebasestorage.buckets.get`
· `resourcemanager.projects.get` **δεν χρησιμοποιούνται πια** από κανέναν από τους δύο ρόλους. Μένουν
(ο runbook καθρεφτίζει τον ζωντανό IAM, μετρημένο με `gcloud iam roles describe` + diff)· η αφαίρεσή τους
(ελάχιστα δικαιώματα) είναι βήμα Giorgio **αφού** πρασινίσει η γραμμή.

### 11.8 Κρίνεται ό,τι **φεύγει**, όχι ο δίσκος — και το μητρώο κρίνεται modulo CRLF/LF *(2026-09-19, Ε1 + Ε2)*

**Η αφορμή, μετρημένη**: σε **κοινό** working tree το `firestore.rules` είχε **+9 ακομμίτιστες**
γραμμές **άλλης** συνεδρίας. (α) Ο pre-push (CHECK 3.86) τύπωνε *«διαφέρει από το origin/main — στο push:
πλάνο → έγκριση»* για push που **δεν** τις περιείχε. (β) Το `firestore:verify` έβγαινε **EXIT 2** ενώ η
παραγωγή = HEAD. (γ) Επιπλέον, και **χειρότερο**, το pre-commit διάβαζε **και** το μητρώο από τον
δίσκο ⇒ μια ακομμίτιστη γραμμή μητρώου άλλου θα μπορούσε να **μπλοκάρει** (Κ3/Κ4) ένα άσχετο commit.
**Ρίζα**: ο «κόσμος» (`world.js`) είχε **ένα** σημείο ανάγνωσης, τον δίσκο, και κάθε όργανο το
κληρονομούσε σιωπηλά.

**Η απόφαση**: το δέντρο είναι **υποχρεωτική, ρητή** παράμετρος του `loadWorld({ tree })`. Κάθε
ανάγνωση (`firebase.json`, πηγές, μητρώο) περνά από **έναν** αναγνώστη (`treeReader`). Κόσμος χωρίς
δέντρο **ρίχνει**, γιατί η σιωπηλή προεπιλογή «δίσκος» ήταν ακριβώς η βλάβη.

| Όργανο | Δέντρο | Γιατί (πρωτογενής πηγή) |
|---|---|---|
| pre-commit (CHECK 3.86) | **index** (`git show :<αρχείο>`) | ό,τι θα **δεσμεύσει** το commit |
| pre-push (`--at-push`) | κάθε **`<local sha>`** του stdin | githooks(5): *«`<local-ref> SP <local-object-name> SP <remote-ref> SP <remote-object-name> LF`»*. Βάση Κ3 = `<remote sha>` (νέο ref ⇒ `merge-base` με `origin/main`)· Κ5 **μόνο** για `M.PIPELINE.ref` |
| `firestore:verify` | **`HEAD`** (προεπιλογή) · `--tree worktree\|index\|<rev>` | Argo CD: *«compare live state against the resource manifests defined at the tip of the specified branch»* — revision, όχι working copy |
| `firestore:deploy` (έκτακτη ανάγκη) | **worktree** + επαλήθευση `--tree worktree` | το `firebase deploy` **διαβάζει τον δίσκο** ⇒ αυτά είναι τα bytes που στάλθηκαν |
| `--report` | **worktree** | αναφορά για άνθρωπο: «τι έχω εδώ» |

Όταν ο δίσκος ≠ το κρινόμενο δέντρο, αυτό **τυπώνεται** (`world.worktreeDrift`). Το όργανο δεν αγνοεί
σιωπηλά ό,τι βλέπει ο άνθρωπος στον editor. Push σε ref που **δεν** πυροδοτεί τη γραμμή ⇒
`off-pipeline`, ποτέ ψευδές «θα ζητηθεί έγκριση». Το `M.PIPELINE.ref` δένεται με το **πραγματικό**
`on.push.branches` του workflow μέσω του **ενός** αναγνώστη YAML (`workflow-meta.readWorkflowTriggers`
→ νέο `pushBranches`), όχι με δεύτερο αντίγραφο.

**Ε2 — το μητρώο modulo CRLF/LF, χωρίς επανεγγραφή ιστορικού**: **και οι 7** γραμμές `storage` του
μητρώου έχουν αποτύπωμα **CRLF** (γράφτηκαν από Windows· μετρημένο: το ωμό blob **δεν** ταιριάζει σε
καμία, το blob→CRLF ταιριάζει σε **όλες**). Η σημείωση *«το τοπικό μητρώο δεν το κατέγραψε»* κρινόταν
με `recorded.digest !== desired.digest`, δηλαδή με **bytes** ⇒ άλλη απάντηση σε Windows και σε CI.
Το μητρώο είναι **append-only** ⇒ η κανονικοποίηση γίνεται στη **σύγκριση** (Argo CD *diff
normalization*), **όχι** στην αποθήκευση. **Μία** συνάρτηση, `M.renderingOf(digest, text)`, δίνει την
απόδοση γραμμών (ως έχει · LF · CRLF) που ταιριάζει στο αποτύπωμα. Τη χρησιμοποιούν το
`recordedBytes`, που πριν είχε δικό του βρόχο, **και** το νέο `recorded.matchesTree`. Οι νέες γραμμές
κρατούν **όπως πριν** το sha256 των bytes που **στάλθηκαν** (αλήθεια της πράξης), και οι παλιές
διαβάζονται αυτούσιες.

**Μετρημένο 2026-09-19 (ίδια κατάσταση δίσκου, +9 ξένες γραμμές)**:

| Έλεγχος | Πριν | Μετά |
|---|---|---|
| `check-firestore-deploy-proof --at-push` (πραγματικός hook, stdin `eca0e195 → refs/heads/main`) | ⏳ *«firestore:rules διαφέρει»* | ✓ ίδιο · ℹ️ *«ο δίσκος διαφέρει στο firestore.rules — ΔΕΝ κρίθηκε»* |
| pre-commit (index) | ⏳ διαφέρει | ✓ ίδιο + ίδια σημείωση |
| `firestore:verify --project pagonis-87766` | **EXIT 2** (rules OutOfSync) | **EXIT 0** · 3/3 Synced·Healthy · ⚠️ σημείωση δίσκου |
| `firestore:verify … --tree worktree` (θετικός μάρτυρας) | — | **EXIT 2** · rules OutOfSync, *«τρέχει η ανάπτυξη της 2026-09-18 (@38dde0d5)»* |
| Ε2: `loadDesired` στο `38dde0d5` (blob LF = ό,τι βλέπει το CI) | `recorded.digest ≠ digest` ⇒ ψευδής σημείωση | `matchesTree: true` ⇒ **καμία** σημείωση |

jest `firestore-deploy-{gate,drift,pipeline}` + `check-anchor-execution` + `ci-gate-tiers`: **160/160**.
**12/12 εκτελεσμένες μεταλλάξεις σκοτωμένες**, με επαναφορά md5 OK: αναγνώστης πάντα-δίσκος ·
διαγραφές στο stdin · Κ5 εκτός γραμμής · σιωπηλή σημείωση δίσκου · `renderingOf` μόνο ωμά · σύγκριση
bytes στο `drift` · σιωπηλή προεπιλογή δέντρου · commit→δίσκος · λάθος κλάδος γραμμής · `verify`
προεπιλογή δίσκος · επαλήθευση μετά την ανάπτυξη στο HEAD · επιθυμητό από δίσκο. `jscpd:diff`: 0 κλώνοι.

⚠️ **Δηλωμένα όρια**: (1) Η τοπική ανάπτυξη έκτακτης ανάγκης γράφει `commit: HEAD` και όταν ο δίσκος
≠ HEAD. Η απόδοση προέλευσης το **αποκαλύπτει** αργότερα (*«δεν ήταν δεσμευμένα στο …»* ⇒
`unattributable`), αλλά **δεν** το εμποδίζει. **Δεν** άλλαξε, γιατί θα άλλαζε τη συμπεριφορά εργαλείου
που γράφει στην παραγωγή. (2) Ο Κ3 στο push κρίνει το ref **ένα-ένα**. Αν ένα push στείλει πολλά refs,
το καθένα κρίνεται με τη δική του βάση.

### 11.9 Η διαδοχή — μόνο η **κορυφή** αναπτύσσει και κυκλοφορεί *(2026-09-19, Ε3)*

**Η αφορμή, μετρημένη** (Changelog 2026-09-19, runs `35429150868` / `35431491440`): job σε αναμονή
έγκρισης **κρατά** το `concurrency: firebase-production`. Το νεότερο μένει `pending` με
`pending_deployments = 0`, δηλαδή **χωρίς** κουμπί ⇒ **καμία** κυκλοφορία στο Netcup μέχρι Reject/Approve.
Η απάντηση του §11.6 #2 είναι λοιπόν: **κρατά θέση**.

**Έρευνα (πρωτογενείς πηγές, αυτούσια)**:

| Πηγή | Αυτούσιο | Τι μας λέει |
|---|---|---|
| GitHub, *Control the concurrency* | *«any existing `pending` job or workflow in the same concurrency group will be canceled and the new queued job or workflow will take its place»* | **Τρίτο** τρέξιμο: ακυρώνεται το εκκρεμές Β, μπαίνει το Γ, το Α **κρατά**. Τεκμηριωμένο, όχι μετρημένο |
| GitHub, changelog 2026-05-07 | `queue: max`: *«Up to 100 jobs or workflow runs can be `pending`»* | Δεν βοηθά: όλα στέκονται πίσω από το Α. ❌ |
| GitHub, *Control deployments* | *«If a job is not approved within 30 days, it will automatically fail.»* | Όριο 30 ημερών, όχι ακύρωση |
| GitHub, «job σε αναμονή έγκρισης κρατά το group» | **ΜΗ ΤΕΚΜΗΡΙΩΜΕΝΟ** | Μοναδική απόδειξη η μέτρησή μας |
| GitHub REST (fine-grained) | `POST …/runs/{id}/cancel` ⇒ *Actions: write* · `POST …/pending_deployments` ⇒ *«Required reviewers … can use this endpoint»* | Ο bot **ακυρώνει**, **δεν** απορρίπτει |
| **AWS CodePipeline** | *«A stage with an approval action is locked until the approval action is approved or rejected or has timed out»* · *«Waiting executions are superseded by more recent executions … only … in between stages»* | **Ίδια** συμπεριφορά με το GitHub. Λύση: χρονικό όριο (7 μέρες) + αντικατάσταση όσων περιμένουν **μπροστά** από το στάδιο |
| **GitLab** | *«prevent older deployment jobs from running when a newer deployment job is started»* | Φρουρός φρεσκάδας |
| **HCP Terraform** | *«a run remains pending until every run before it has completed»* · *«stale saved plan runs are automatically detected and discarded»* | Ίδιο μπλοκάρισμα ουράς· το μπαγιάτικο πλάνο **απορρίπτεται** |
| Argo CD | *«only attempt one synchronization per unique combination of commit SHA1»* | Καμία έγκριση: πάντα η κορυφή |
| Spinnaker Manual Judgment | χρονικό όριο/σημαίες: **ΜΗ ΤΕΚΜΗΡΙΩΜΕΝΑ** στο spinnaker.io | δεν επικαλούμαστε |

**Η απόφαση (Giorgio, «ΝΑΙ»)**: GitOps διαδοχή — το δέντρο της κορυφής είναι **υπερσύνολο** κάθε
παλαιότερου, άρα ένα παλαιότερο τρέξιμο έχει μόνο κάτι να **γυρίσει πίσω**. Απορρίφθηκαν:
`cancel-in-progress: true` (κόβει ανάπτυξη που τρέχει) · `queue: max` · χρονικό όριο (η κορυφή **πρέπει** να
περιμένει τους κανόνες της) · αυτόματη έγκριση δεικτών (**μετρημένο**: 14 από τα 20 commits δεικτών των 90
ημερών άλλαξαν **και** κανόνες ⇒ ελάχιστο όφελος για νέα ταυτότητα εγγραφής).

| Job / βήμα (`docker-build.yml`) | Λειτουργία (`succession.js`) | Τι κάνει |
|---|---|---|
| `firebase-succession` (μετά το πλάνο) | `claim` | όχι κορυφή ⇒ **αυτοακύρωση**· κορυφή ⇒ ακυρώνει κάθε **άλλο** ενεργό τρέξιμο με `pending_deployments` στο environment. Ποτέ τρέξιμο που **αναπτύσσει** (0 εκκρεμείς) |
| ίδιο, βήμα Telegram | — | *«⏸ Firebase: ζητείται έγκριση»* τη **στιγμή** του αιτήματος |
| `firebase-queue-watch` (μόνο όταν `apply`) | `watch` | όσο το **δικό μου** apply κάθεται στην ουρά χωρίς κουμπί, ξανασκουπίζει κάθε 30″ (όριο 70′) — κλείνει τον αγώνα «ο παλιός μπήκε σε αναμονή μετά τη σκούπα» |
| πρώτο βήμα `firebase-apply` (πριν την ταυτότητα) | `guard` | έγκριση που δόθηκε **μετά** από νεότερο push ⇒ αυτοακύρωση **πριν** εκδοθεί το κλειδί του deployer |
| πρώτο βήμα `release` + `concurrency: netcup-release` | `guard` | αργό build παλαιότερου commit **δεν** γυρίζει πίσω το `:latest`. Οι κυκλοφορίες σειριοποιούνται |
| `notify` | `tip` | μιλά **μόνο** η κορυφή (ή όποιος κυκλοφόρησε)· κανένα ψευδές «FALLITO» |
| `firebase-drift.yml` (`actions: read`) | `remind` | κάθε πρωί Telegram για έγκριση που περιμένει ≥ `REMINDER_AFTER_HOURS` (8)· ποτέ κόκκινο |

🔑 **Κορυφή** = το **νεότερο** τρέξιμο **push** στο commit της κορυφής του `main`. Αν δεν υπάρχει ακόμη ⇒
**κανείς** δεν ακυρώνεται. **Αντικατάσταση = ακύρωση, ποτέ αποτυχία**: ο CI Health (ADR-757) μετρά ως
«έσπασε» **μόνο** το `failure`, άρα ένα κόκκινο αντικατεστημένο τρέξιμο θα έστελνε ψευδές Tier 1.

🏆 **Πού ξεπερνάμε**: το CodePipeline **δεν** αντικαθιστά αυτόν που **κρατά** την έγκριση (μόνο το χρονικό
όριο τον βγάζει). Εμείς τον αντικαθιστούμε **αμέσως**, αλλά **μόνο** όσο περιμένει. Επιπλέον ο φρουρός
κάνει το παράθυρο «εγκρίθηκε ακριβώς τη στιγμή της ακύρωσης» **ακίνδυνο**: ένα τρέξιμο που δεν είναι
κορυφή δεν φτάνει ποτέ στο βήμα ανάπτυξης.

**SSoT**: ο πελάτης GitHub REST εξήχθη από το `ci-health-report.js` (inline `api()`) στο **ένα**
`scripts/lib/ci/github-api.js`. Ο συγγραφέας `GITHUB_OUTPUT`/`STEP_SUMMARY` εξήχθη από το `verify-live.js`
στο `scripts/lib/ci/actions-io.js`. Ο αναγνώστης YAML (`workflow-meta`) επεκτάθηκε: `name` · `permissions` ·
`concurrency` ανά job + `readWorkflowPermissions`. Ονόματα jobs και ουράς στο `M.PIPELINE`. Αποστολέας: το
`telegram.js`.

**Μετρημένο 2026-09-19 (τοπικά)**: jest `firestore-deploy-{gate,drift,pipeline,succession}` +
`check-anchor-execution` + `ci-gate-tiers` **201/201** (νέα σουίτα: 32 tests · +9 άγκυρες δομής).
**19/19 εκτελεσμένες μεταλλάξεις σκοτωμένες**, με επαναφορά md5 OK. Η 19η επέζησε στο πρώτο πέρασμα
(φίλτρο «ολοκληρωμένο» του πυρήνα, κρυμμένο πίσω από το CLI) ⇒ νέα άγκυρα ⇒ σκοτώθηκε. CHECK 3.54 ✓ ·
3.47 ✓ · 3.37 ✓ · `jscpd:diff` 0 κλώνοι σε 10 αρχεία · YAML έγκυρο (`yaml` 2.8.2). Repo:
`default_workflow_permissions: "read"` (`gh api`, ανάγνωση), και ήδη το `packages: write` του `release`
πέτυχε (run `35432199109`) ⇒ το `permissions:` του job **ανεβάζει** δικαίωμα ⇒ **καμία** ρύθμιση GitHub.

**Μετρημένο στην παραγωγή 2026-09-19 — run `35450352067` (`7057264b`, push `eca0e195..7057264b`), success**:

| Job | UTC | Μέτρηση |
|---|---|---|
| `firebase-plan` `105916309338` | 14:58:37→14:59:36 | rules **OutOfSync** (το +9 του `37be5d1d`) · indexes/storage Synced ⇒ `apply · firestore:rules` |
| `firebase-succession` `105916441964` | 14:59:55→15:00:03 | *«✓ κορυφή του main: 7057264b»* · καμία ακύρωση (κανένα παλαιότερο σε αναμονή) · Telegram «ζητείται έγκριση» **χωρίς** προειδοποίηση |
| `firebase-apply` `105916501808` | αναμονή 15:00:03 · 15:00:46→15:02:12 | `waiting` με `pending_deployments` = 1 ⇒ **κουμπί**. Έγκριση Giorgio (deployment `6542247921`). Φρουρός *«✓ κορυφή»* ⇒ `deploying firestore` → *«compiled successfully»* → *«released rules firestore.rules.compiled to cloud.firestore»* → *«Deploy complete!»* ⇒ `verify --wait` **3/3 Synced·Healthy** |
| `firebase-queue-watch` `105916501392` | 15:00:09→15:00:19 | *«η ανάπτυξη αυτού του τρεξίματος: waiting — ο φύλακας τελείωσε»*, στον **πρώτο** γύρο |
| `release` `105918223919` | 15:12:27→15:12:36 | φρουρός *«✓ κορυφή»* ⇒ `:latest` ⇒ Coolify *«Deployment request queued»* (`pehzxcng0w3sunowx67vb1kd`) |
| `notify` `105918248401` | 15:12:39→15:12:47 | Telegram success, χωρίς προειδοποίηση |

⇒ Μετρήθηκαν: (α) η **εγγραφή κανόνων Firestore** μέσα από τη γραμμή, με τον `gh-firebase-deploy` (**17**
δικαιώματα) ⇒ νέο release rules `6fa8a29d-96a0-4b91-85f6-d773882c45a2` 2026-09-19T15:02:06Z. (β) Το
`actions: write` **ανά job** δουλεύει με το repo σε `default_workflow_permissions: read`. (γ) Το API `…/jobs`
επιστρέφει το `name:` του job, και ο φύλακας βρήκε το δικό του apply. (δ) Στην απλή έγκριση (χωρίς wait
timer) το `wait_timer_started_at` είναι **`null`** ⇒ η υπενθύμιση μετρά από τη δημιουργία του τρεξίματος
(η εφεδρική διαδρομή του κώδικα).

⚠️ **Δηλωμένα όρια**:
1. **ΑΜΕΤΡΗΤΟ στην παραγωγή**: η ίδια η **αντικατάσταση**. Το run `35450352067` εγκρίθηκε **πριν** έρθει
   δεύτερο push ⇒ δεν μετρήθηκε ακόμη ότι η ακύρωση τρεξίματος σε `waiting` **ελευθερώνει** αμέσως το group
   και ότι το νεότερο παίρνει κουμπί, ούτε ότι η αυτοακύρωση σκοτώνει το βήμα μέσα στη χάρη των 2′ (αλλιώς
   έξοδος 3 ⇒ fail-closed). Μετριέται την **επόμενη** φορά που θα ζητηθεί έγκριση: δεύτερο push όσο περιμένει.
2. Push στην κορυφή αντικαθιστά και **δοκιμή deployer** (`workflow_dispatch`) που περιμένει έγκριση.
3. **Re-run** παλιού τρεξίματος αυτοακυρώνεται ⇒ rollback = `git revert` + push (GitOps).
4. Ο φύλακας βρίσκει το δικό του apply με το `name:` του job (το API `…/jobs` επιστρέφει αυτό). Το
   διαβάζει από το workflow με τον **έναν** αναγνώστη, και η άγκυρα δένει κάθε λειτουργία του YAML με το CLI.
5. ~~Εγγραφή κανόνων Firestore αμέτρητη~~ ⇒ ✅ **μετρήθηκε** (run `35450352067`, πίνακας παραπάνω).
   Μένει **αμέτρητη** η εγγραφή **δεικτών** μέσα από τη γραμμή (κανένας δεν διέφερε).

---

## §9. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-19 | ✅ **§11.9 — ΠΡΩΤΟ ΤΡΕΞΙΜΟ ΤΗΣ ΔΙΑΔΟΧΗΣ + ΠΡΩΤΗ ΕΓΓΡΑΦΗ ΚΑΝΟΝΩΝ FIRESTORE ΜΕΣΑ ΑΠΟ ΤΗ ΓΡΑΜΜΗ (μετρημένο)**. Push `eca0e195..7057264b` ⇒ run `35450352067` **success**. Πλάνο `105916309338`: rules **OutOfSync** (το +9 του `37be5d1d`, ADR-867) ⇒ `apply · firestore:rules`. Διαδοχή `105916441964` (8″): *«✓ κορυφή του main: 7057264b»*, καμία ακύρωση, Telegram «ζητείται έγκριση». Apply `105916501808`: `waiting` με `pending_deployments` = 1 ⇒ κουμπί· φύλακας `105916501392` τελείωσε στον **πρώτο** γύρο (10″). Έγκριση Giorgio (deployment `6542247921`) ⇒ φρουρός *«✓ κορυφή»* ⇒ *«released rules firestore.rules.compiled to cloud.firestore»* ⇒ **3/3 Synced·Healthy**. ✅ **§11.6 #3 για κανόνες Firestore ΜΕΤΡΗΘΗΚΕ**: ο `gh-firebase-deploy` με **17** δικαιώματα δημιούργησε ruleset και ενημέρωσε release (`6fa8a29d…` 15:02:06Z). Release `105918223919`: φρουρός ✓ ⇒ Coolify *«Deployment request queued»* 15:12:36Z · notify ✓. Επίσης μετρημένα: `actions: write` ανά job με repo `default_workflow_permissions: read` · το API `…/jobs` επιστρέφει το `name:` του job · `wait_timer_started_at` = `null` στην απλή έγκριση. ⏳ **Αμέτρητα**: η ίδια η **αντικατάσταση** (εγκρίθηκε πριν από δεύτερο push — §11.9 όριο 1) και η εγγραφή **δεικτών** μέσα από τη γραμμή. |
| 2026-09-19 | ✅ **§11.9 — Η ΔΙΑΔΟΧΗ: ΜΟΝΟ Η ΚΟΡΥΦΗ ΑΝΑΠΤΥΣΣΕΙ ΚΑΙ ΚΥΚΛΟΦΟΡΕΙ (Ε3)** *(εντολή Giorgio: «ΝΑΙ» στα Ε3+Ε4+Ε5 της σύγκρισης)*. Κλείνει το μετρημένο «ξεχασμένη έγκριση κρατά την ουρά `firebase-production` ⇒ καμία κυκλοφορία στο Netcup». Έρευνα σε πρωτογενείς πηγές: το AWS CodePipeline έχει **την ίδια** συμπεριφορά (*«A stage with an approval action is locked until … approved or rejected or has timed out»*)· το GitLab έχει φρουρό (*«prevent older deployment jobs from running»*)· το HCP Terraform απορρίπτει μπαγιάτικα πλάνα· το GitHub τεκμηριώνει ότι το τρίτο τρέξιμο αντικαθιστά το εκκρεμές δεύτερο, **όχι** τον κάτοχο. Νέα: `succession.js` (καθαρός πυρήνας + CLI `claim/guard/watch/tip/remind`) · jobs `firebase-succession` και `firebase-queue-watch` · φρουρός κορυφής ως **πρώτο** βήμα του `firebase-apply` (πριν την ταυτότητα) και του `release` (+ `concurrency: netcup-release`) · `notify` μόνο από την κορυφή · πρωινή υπενθύμιση στο `firebase-drift.yml` (`actions: read`) · Telegram τη στιγμή του αιτήματος έγκρισης. **Καμία** ρύθμιση GitHub/Google: `actions: write` ανά job (μετρημένο `default_workflow_permissions: read`). ⛔ Κανένα `cancel-in-progress: true` (άγκυρα). SSoT: ο πελάτης GitHub REST εξήχθη σε `lib/ci/github-api.js`, οι έξοδοι Actions σε `lib/ci/actions-io.js`, και το `workflow-meta` διαβάζει `name/permissions/concurrency`. Jest **201/201**, **19/19** εκτελεσμένες μεταλλάξεις (md5 OK), CHECK 3.54/3.47/3.37 ✓, `jscpd:diff` 0. ⏳ **Αμέτρητο** στην παραγωγή μέχρι το πρώτο push (§11.9 όριο 1). Εγγραφή κανόνων Firestore: ακόμη αμέτρητη, γιατί το `37be5d1d` δεν έχει γίνει push. |
| 2026-09-19 | ✅ **§11.8 — ΚΡΙΝΕΤΑΙ Ο,ΤΙ ΦΕΥΓΕΙ, ΟΧΙ Ο ΔΙΣΚΟΣ (Ε1) · ΤΟ ΜΗΤΡΩΟ MODULO CRLF/LF (Ε2)**. Κλείνουν τα δύο ανοιχτά ευρήματα της προηγούμενης γραμμής. **Ε1**: το `loadWorld` παίρνει **υποχρεωτικό** δέντρο (`index` στο pre-commit · `<local sha>` του stdin στο pre-push · `HEAD` στο `firestore:verify` · `worktree` στο `firestore:deploy`/`--report`) και **ένα** σημείο ανάγνωσης. Βρέθηκε και **τρίτη** διαδρομή του ίδιου σχήματος: το pre-commit διάβαζε και το **μητρώο** από τον δίσκο, άρα μπορούσε να μπλοκάρει (Κ3/Κ4) για ξένη ακομμίτιστη γραμμή. Push εκτός `refs/heads/main` ⇒ `off-pipeline`. Το `workflow-meta.readWorkflowTriggers` επιστρέφει `pushBranches`, και η άγκυρα δένει το `M.PIPELINE.ref` με το πραγματικό workflow. **Ε2**: ένα `M.renderingOf` (ως έχει · LF · CRLF) για το `recordedBytes` **και** το νέο `recorded.matchesTree`. Καμία αλλαγή σχήματος και καμία επανεγγραφή του append-only μητρώου. **Μετρημένο** με +9 ξένες ακομμίτιστες γραμμές στο `firestore.rules`: πραγματικός pre-push με stdin `eca0e195 → refs/heads/main` ✓ ίδιο (πριν: ⏳ διαφέρει) · `firestore:verify --project pagonis-87766` **EXIT 0**, 3/3 Synced·Healthy (πριν: **EXIT 2**) · `--tree worktree` **EXIT 2** (θετικός μάρτυρας) · στο `38dde0d5` η γραμμή storage με CRLF ⇒ `matchesTree: true`. Jest **160/160**, **12/12** εκτελεσμένες μεταλλάξεις σκοτωμένες (md5 OK), `jscpd:diff` 0. Το `check-anchor-execution.test.js` Π ενημερώθηκε (`toEqual` με το νέο `pushBranches`). ⏳ Το **Ε3** (ξεχασμένη έγκριση) μένει ανοιχτό· και η εγγραφή κανόνων Firestore μέσα από τη γραμμή μένει **αμέτρητη**, γιατί το `firestore.rules` της άλλης συνεδρίας **δεν** έχει γίνει push (`HEAD` = `origin/main` = `eca0e195`). |
| 2026-09-19 | ✅ **§11 — Η ΠΡΩΤΗ ΠΡΑΓΜΑΤΙΚΗ ΑΝΑΠΤΥΞΗ ΜΕΣΑ ΑΠΟ ΤΗ ΓΡΑΜΜΗ (μετρημένο)**. Push `e93c68a0..eca0e195` (`storage.rules`: avatars `image/(webp\|png)`, ADR-798). Run `35432199109` **success**. Πλάνο (job `105868680976`): rules **Synced** · indexes **Synced** (478/478) · storage **OutOfSync** (*«τρέχει η ανάπτυξη της 2026-09-18 (@38dde0d5) — το δέντρο προχώρησε»*) ⇒ `apply · storage`. Έγκριση Giorgio (deployment `6538927993`). Apply (job `105868765800`, 08:35:46→08:36:58Z): *«deploying storage» → «storage.rules compiled successfully» → «uploading rules storage.rules» → «released rules storage.rules to firebase.storage» → «Deploy complete!»* ⇒ `verify --wait` **3/3 Synced·Healthy**. ✅ **§11.6 #3 για το storage ΜΕΤΡΗΘΗΚΕ**: ο `gh-firebase-deploy` με **17** δικαιώματα (χωρίς κανένα `firebasestorage.*`) **δημιούργησε ruleset και ενημέρωσε release**. Νέο release storage: `23bbdcef…` 2026-09-19T08:36:53Z. ⏳ Για **κανόνες Firestore** και **δείκτες**, τα δικαιώματα εγγραφής μέσα από τη γραμμή μένουν **αμέτρητα**, αφού δεν αναπτύχθηκαν σε αυτό το run. Release Netcup (job `105870589192`) **success** 08:47:13Z · Ειδοποίηση success. Στο ίδιο push, το `storage-rules.yml` `35432199164` ⇒ **13/13 σουίτες, 187/187**: το πρώτο πράσινο από το `31471274680` (11/08). 🔴 **Εύρημα, ανοιχτό — τα τοπικά όργανα κρίνουν τον ΔΙΣΚΟ, όχι αυτό που στέλνεται**. Το `firestore.rules` είχε **+9 ακομμίτιστες** γραμμές στο working tree, από άλλη συνεδρία, που **δεν** ήταν στο push. (α) Ο pre-push (CHECK 3.86) τύπωσε *«firestore:rules · διαφέρει από το origin/main — στο push: πλάνο → έγκριση»*, ενώ το πλάνο του CI στο HEAD βρήκε **Synced**. (β) Μετά το run, το τοπικό `firestore:verify` ⇒ **EXIT 2** (*rules OutOfSync*), ενώ η παραγωγή = HEAD. Και τα δύο είναι ψευδώς θετικά σε κοινό working tree. Η ετυμηγορία της γραμμής παραγωγής **δεν** επηρεάζεται, γιατί κρίνει το checkout του commit. **Δεν** διορθώθηκε. Πρωινός έλεγχος απόκλισης: `firebase-drift.yml` χειροκίνητα ⇒ run `35433199321` (`eca0e195`, job `105871418397`, 08:53:56→08:54:39Z) **success**, **3/3 Synced·Healthy** με την ταυτότητα CI (reader με **5** δικαιώματα). |
| 2026-09-19 | ✅ **§11 — ΤΟ ΠΡΩΤΟ ΠΡΑΣΙΝΟ ΤΡΕΞΙΜΟ ΤΗΣ ΓΡΑΜΜΗΣ (μετρημένο)**. Run `35426414076` (headSha `e93c68a0`) **success**. Πλάνο (job `105853042665`, 06:23:22→06:24:09Z): **3/3 Synced·Healthy** — rules release `ac5ed685…` 2026-09-18T20:51:01Z · indexes **478/478**, overrides 2/2 · storage release `3dd4e096…` 20:50:59Z ⇒ `action=none`. **Το 404 `NO_DEFAULT_BUCKET` της ταυτότητας CI εξαφανίστηκε** με το §11.7: ο bucket λύθηκε από το target, **χωρίς** αλλαγή IAM. `firebase-apply` (job `105853274768`) **skipped**, `approvals` = `[]`. Αιτία: οι στόχοι είχαν ήδη αναπτυχθεί **τοπικά**, με διαπιστευτήρια χρήστη, από το `38dde0d5` (καταγραφή ledger `e93c68a0`), **πριν** το push. Release (job `105854573579`, 06:35:07→06:35:14Z): `main-e93c68a` → `:latest` · Coolify *«Deployment request queued»* (`m12p20pny7w6xxqscfk4apj4`). Η ολοκλήρωση στο Netcup **δεν** μετρήθηκε. Τοπικό `firestore:verify` μετά το run ⇒ **EXIT 0**. ⇒ **§11.6 #1 έκλεισε**. §11.6 #3: η ταυτότητα CI (WIF + `google-auth-library`) ✅ **μετρήθηκε** στο πλάνο· τα δικαιώματα **εγγραφής** του deployer **ΑΜΕΤΡΗΤΑ**, επειδή το apply δεν έτρεξε ποτέ. **Μερική μέτρηση του deployer (ίδια μέρα)**: `workflow_dispatch` `firebase_dry_run=true` ⇒ run `35427334871` **success**, στο commit `e93c68a0`. Το environment **κράτησε** το apply σε `waiting` από 06:43:21Z μέχρι την έγκριση του Giorgio (deployment `6538085045`). Apply (job `105855541133`, 07:05:02→07:06:16Z): με `TARGETS` κενό ⇒ *«deploying storage, firestore»*. Ο `gh-firebase-deploy` (WIF) πέρασε: predeploy `build-firestore-rules.js` · `firebase.storage` *«storage.rules compiled successfully»* **μέσω target** · *«required API firestore.googleapis.com is enabled»* · ανάγνωση `firestore.indexes.json` · `cloud.firestore` *«firestore.rules.compiled compiled successfully»* ⇒ *«Dry run complete!»*. Release/Ειδοποίηση **skipped** (`inputs.firebase_dry_run`). ⚠️ Το dry-run **δεν** δημιουργεί ruleset, **δεν** ενημερώνει release και **δεν** γράφει δείκτη. Αυτά τα δικαιώματα μένουν **αμέτρητα** μέχρι την πρώτη πραγματική αλλαγή μέσα από τη γραμμή. 🔴 **§11.6 #2 ΜΕΤΡΗΘΗΚΕ, και ο runbook §2 ΔΙΑΨΕΥΣΤΗΚΕ** («νεότερο push ⇒ η παλαιότερη εκκρεμής ακυρώνεται»). Δύο dry-runs στο `e93c68a0`: το A `35429150868` έμεινε με το apply σε `waiting` (έγκριση) από 07:23Z. Το B `35431491440`, που δημιουργήθηκε 08:15:05Z, είχε το apply **`pending`** με `pending_deployments` = **0** (08:16:00→08:19:52Z), ενώ το A **έμενε** `waiting`. ⇒ Ένα job που περιμένει έγκριση **κρατά** το `concurrency: firebase-production`· το νεότερο **δεν** το ακυρώνει, αλλά μπαίνει σε ουρά **χωρίς** κουμπί έγκρισης. ⇒ Μια ξεχασμένη έγκριση **μπλοκάρει κάθε επόμενη ανάπτυξη Firebase και κάθε κυκλοφορία στο Netcup**. Απόρριψη του A (deployment `6538390239`) ⇒ A `failure`, και το B σε `waiting` **αμέσως** (08:21:25Z). Έγκριση του B ⇒ apply `105866904367` **success** (08:22:57→08:24:10Z, *«Dry run complete!»*). Ό,τι γίνεται με **τρίτο** run στην ουρά **δεν** μετρήθηκε. Runbook §2 διορθώθηκε. ✅ **Ελάχιστα δικαιώματα (07:10Z, από τον Giorgio)**: `nestorFirebaseDriftReader` −`firebasestorage.buckets.get` −`firebasestorage.defaultBucket.get` −`resourcemanager.projects.get` ⇒ **5** · `nestorFirebaseRulesDeployer` −`firebasestorage.buckets.get` −`firebasestorage.defaultBucket.get` ⇒ **17** (το `resourcemanager.projects.get` μένει). Μετά από **≥13′** διάδοσης: πλάνο πράσινο και στα A και B (reader με 5) · dry-run του B πράσινο (deployer με 17). Ο runbook §1.1 καθρεφτίζει πλέον τους ζωντανούς ρόλους. Η περιγραφή του ζωντανού ρόλου reader ενημερώθηκε σε *«Read-only: rules releases, index definitions. NO data access.»* (etag `BwZb0cR24VM=`), ίδια με τον runbook. `storage-rules.yml` `35426414115`: ο emulator **ξεκίνησε** με το target (κανένα `Must supply 'target'`, 13 σουίτες) · **182/183**. Το 1 κόκκινο (`user-avatars` · same_tenant_user × write ⇒ `storage/unauthorized`) είναι **ίδιο** με το run `35226081869` (17/09, πριν το §11.7), δηλαδή προϋπάρχει. Ποιους κανόνες φόρτωσε ο emulator **δεν** τυπώνεται στο log· το «`storage.rules`, όχι ανοιχτοί» είναι συμπέρασμα από την πηγή, όχι μέτρηση. 🔴 **Εύρημα, ανοιχτό**: η γραμμή `storage` του ledger κρατά sha256 των bytes του **δίσκου**. Στα Windows (CRLF) είναι `bb78d397…`, στο blob (LF) `10cbeeb1…`, ενώ ο πάροχος έχει LF. Έτσι τοπικά η απόδοση προέλευσης βρίσκει την καταγραφή, αλλά στο CI (checkout LF) τυπώνει *«το τοπικό μητρώο δεν το κατέγραψε»*. Η ετυμηγορία (`Synced`) **δεν** αλλάζει· η **απόδοση** είναι ασύμμετρη Windows↔CI. **Δεν** διορθώθηκε. |
| 2026-09-18 | ✅ **§11.7 — Ο BUCKET ΔΗΛΩΝΕΤΑΙ, ΜΕ ΤΟΝ ΜΗΧΑΝΙΣΜΟ ΤΗΣ GOOGLE (deploy targets)** *(εντολή Giorgio: «όπως οι μεγάλοι»)*. Το πρώτο τρέξιμο της γραμμής σταμάτησε (σωστά, fail-closed) σε `storage · 404 NO_DEFAULT_BUCKET` για την ταυτότητα CI. 🔴 **Η υπόθεση IAM διαψεύστηκε δύο φορές** (UpdateRole 19:13 +2 δικαιώματα ⇒ δύο re-run, ίδιο 404) και το firebase-tools #6593 δείχνει ότι το συμβόλαιο IAM του `defaultBucket` είναι **ασταθές** (2023→06/2026) ⇒ **καταργήθηκε η ερώτηση**. 🔴 **Η πρώτη εκδοχή (`storage: [{ bucket }]`) ΕΣΠΑΓΕ ΤΟΝ EMULATOR** (`config.js`: «Must supply 'target'») — αναθεωρήθηκε την ίδια μέρα σε `storage: [{ target: "main" }]` + νέο **`.firebaserc` μόνο με `targets`** (παραγωγή + τα δύο demo projects, **κανένα** default project). `storageEntriesOf` → **`declaredBucketOf(firebaseJson, firebaserc, project)`** με τη σημασιολογία του `release.js`/`rc.js`· λάθος δήλωση ⇒ `{error}` **με όνομα** στο `live.js`. 🏆 Άγκυρες στο **πραγματικό** αποθετήριο: κανόνες στον **ίδιο** bucket με το `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` · κάθε emulator με storage ξεκινά με **τους δικούς μας** κανόνες · κανένα default project. **9/9 μεταλλάξεις σκοτωμένες** (md5 επαναφορά). Runbook: οι εντολές δημιουργίας ρόλων καθρεφτίζουν τον **ζωντανό** IAM (diff). |
| 2026-09-18 | ✅ **§11 — Η ΓΡΑΜΜΗ ΠΑΡΑΓΩΓΗΣ: η παραγωγή Firebase ελέγχεται (3) και ενημερώνεται (4) από το CI** *(εντολή Giorgio: «και τα δύο, όπως οι μεγάλοι»)*. Κλείνουν τα §10.5 #1-#2. 🔑 **Το αυγό-κότα του handoff §5.1** λύθηκε με **GitOps** (Argo CD: *«sync only if OutOfSync»*): το δέντρο = «τι θέλουμε», ρωτιέται ο **πάροχος**, ιστορικό = GitHub Deployment — **κανένα** commit από ρομπότ. `docker-build.yml`: `firebase-plan` (παράλληλα με το build) → ⏸ έγκριση **μόνο αν διαφέρει** → `firebase-apply` (μόνο οι διαφέροντες στόχοι, `--wait` μέχρι READY) → `release` (immutable `:main-<sha>` → `:latest` → Coolify). `firebase-drift.yml` κάθε πρωί, **Tier 1** ⇒ CI Health + **Telegram σε μετάβαση**. Ο **Κ5 γίνεται ενημέρωση** έναντι `origin/main` (δεν μπλοκάρει πια το push — θα απαγόρευε το ίδιο το αίτημα). 🔴 **Τρία μετρημένα ευρήματα που ανέτρεψαν υποθέσεις**: (1) **`roles/datastore.indexViewer` δεν υπάρχει** και ο `datastore.viewer` διαβάζει **κάθε έγγραφο** ⇒ δύο **custom roles** (6 · 18 δικαιώματα, 18/18 επαληθευμένα με `testIamPermissions`, **χωρίς** delete/δεδομένα/IAM)· (2) **το `firebase-admin` 12.7.0 απορρίπτει την ταυτότητα χωρίς κλειδί** (`external_account`) ⇒ το `live.js` σε `google-auth-library` 9.15.1 (Apache-2.0, ήδη στο lockfile ως optional — **μία** έκδοση), το ίδιο με το firebase-tools· (3) το repo είναι **δημόσιο** ⇒ Actions δωρεάν, Environments διαθέσιμα στο Free. Επίσης: σύγκριση κανόνων **modulo CRLF/LF** · προέλευση `history` από το git (ταύτιση περιεχομένου) · καρφωμένο `firebase-tools@15.13.0` · `--pipeline` (μόνο μέσα στο Actions) · **ένας** αποστολέας Telegram (το inline curl είχε script injection) · `workflow-meta.readWorkflowJobs`. Σουίτα `firestore-deploy-pipeline.test.js` (**25** tests, **9/9 εκτελεσμένες μεταλλάξεις**)· 105/105 μαζί με gate/drift/tiers. Runbook βημάτων Giorgio: `docs/deployment/firebase-pipeline.md`. **Ενεργοποίηση**: μετά τα βήματα Giorgio — πριν από αυτά ο κώδικας **δεν** κυκλοφορεί (fail-closed, §11.6). |
| 2026-09-18 | ✅ **§10 — Η ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ: το μητρώο από ισχυρισμός γίνεται επαληθεύσιμο γεγονός** *(εντολή Giorgio)*. Αφορμή: το handoff ζητούσε deploy που **είχε ήδη γίνει** (`bd29dd14`)· η επιβεβαίωση χρειάστηκε **χειροκίνητο** curl/gcloud, γιατί το εργαλείο δεν μπορούσε να την κάνει — και μετρήθηκαν **τέσσερις** ψευδείς ισχυρισμοί (§10.1), με χειρότερο το «CREATING» του `--verify` που ήταν **σταθερό κείμενο**. Νέα: `live.js` (ο **μόνος** κώδικας που ρωτά τον πάροχο — μόνο GET, ADC μέσω του υπάρχοντος `firebase-admin`, releases/ταύτιση **του firebase-tools 15.13.0**) · `drift.js` (καθαρός, **Sync × Health** του Argo CD, έξοδοι **0-4** επέκταση του Terraform `-detailed-exitcode`, **απόδοση προέλευσης** `tree/recorded/foreign/unattributable` από το μητρώο + git) · `verify-live.js` (`npm run firestore:verify`, `--wait`, `--json`) · `compileRules` εξήχθη **καθαρή** από το `build-firestore-rules.js` (μία μεταγλώττιση, δύο καταναλωτές). Το `record-deploy.js` **έχασε** το `verifyIndexes`/`indexKey` και τρέχει τη ζωντανή ερώτηση **μετά από κάθε** deploy, με τον **δικό της** κωδικό εξόδου. 🔴 Παγίδα που βρέθηκε: `storage.rules` CRLF στον δίσκο / LF στο blob ⇒ ανασύνθεση με **τρεις αποδόσεις γραμμών** κρινόμενες από το sha256 του μητρώου. Μέτρηση παραγωγής: **3/3 Synced·Healthy, 475/475 READY, overrides 2/2, EXIT 0**· 6 αρνητικοί μάρτυρες σε **πραγματικά** ζωντανά δεδομένα. Σουίτα `firestore-deploy-drift.test.js` (+30 tests· 50/50 μαζί με την πύλη) με **εκτελεσμένες μεταλλάξεις**. |
| 2026-09-16 | ✅ **Η ΠΡΩΤΗ ΑΝΑΠΤΥΞΗ — και η οριστική απόδειξη της διάγνωσης** *(εντολή Giorgio)*. `firestore:rules` + `firestore:indexes` → δείκτες **437 = 437** (ήταν 436·437). 🔑 **Η οθόνη άλλαξε μήνυμα**: από `Missing or insufficient permissions` (**permission-denied** ⇒ κανόνας) σε `The query requires an index… currently building` (**failed-precondition** ⇒ δείκτης) — δηλαδή ο κανόνας **πέρασε**, και αποκαλύφθηκε το εμπόδιο που ήταν **κρυμμένο πίσω του**, ακριβώς όπως προέβλεψε το §1 (οι κανόνες κρίνονται **πριν** τα ευρετήρια). Μετά, `storage` με το ίδιο σκεπτικό: στο GitOps δόγμα η απάντηση στο «artifact χωρίς απόδειξη» είναι **reconcile**, **ποτέ** «εξαίρεσέ το» (Argo CD δεν αφαιρεί resource επειδή είναι `OutOfSync`· Terraform δεν προτείνει `ignore_changes` για drift). Πύλη: **✅ και οι τρεις στόχοι**, EXIT 0. ⚠️ **Τεκμήριο της έρευνας που ΔΕΝ επιβεβαιώθηκε**: το CLI **ποτέ** δεν τύπωσε *«already up to date»* — τύπωσε `uploading… released` και στις τρεις περιπτώσεις ⇒ **δεν** μπορεί να χρησιμοποιηθεί ως ανιχνευτής απόκλισης, ούτε καν κατά την ανάπτυξη. Δηλωμένο όριο. |
| 2026-09-16 | **Δημιουργία + υλοποίηση.** Αφορμή: το «Ιστορικό» του ADR-864 Φ1β έδειχνε `permission-denied` με **σωστό κώδικα σε κάθε κρίκο**· ζωντανή μέτρηση **436 vs 437** έδειξε ότι ο δείκτης του `b307f46e` **δεν ανέβηκε ποτέ** (ηλικία **21 commits**). Ρίζα: **commit ≠ deploy**, δεύτερη φορά σε 6 μέρες (ADR-845 §Ο-18 την ονόμασε χωρίς όργανο). 🔴 Η προφανής λύση **διαψεύστηκε από μέτρηση**: το `firebase deploy --dry-run` γυρίζει **exit 0** με την απόκλιση παρούσα. Λύση: μητρώο **append-only** όπου η γραμμή είναι **παράγωγο της πράξης**, εκκρεμότητα **παραγόμενη**, κρίση **offline**, μπλοκ **στο push**. Νέος **pre-push** φύλακας — που το N.(-1.1) ήδη προϋπέθετε ενώ **δεν υπήρχε**. CHECK 3.86. |
