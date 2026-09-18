# ADR-865 — Η ΑΠΟΔΕΙΞΗ ΑΝΑΠΤΥΞΗΣ: «γραμμένο» δεν σημαίνει «ανεπτυγμένο»

> **Κατάσταση**: ✅ Υλοποιημένο (2026-09-16) · ✅ §10 ζωντανή επαλήθευση (2026-09-18) · ✅ §11 γραμμή παραγωγής — κώδικας έτοιμος, **ενεργοποίηση μετά τα βήματα Giorgio** (`docs/deployment/firebase-pipeline.md`) · **Πύλη**: CHECK 3.86 · **Αφορμή**: ADR-864 Φ1β
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

---

## §9. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-18 | ✅ **§11.7 — Ο BUCKET ΔΗΛΩΝΕΤΑΙ, ΜΕ ΤΟΝ ΜΗΧΑΝΙΣΜΟ ΤΗΣ GOOGLE (deploy targets)** *(εντολή Giorgio: «όπως οι μεγάλοι»)*. Το πρώτο τρέξιμο της γραμμής σταμάτησε (σωστά, fail-closed) σε `storage · 404 NO_DEFAULT_BUCKET` για την ταυτότητα CI. 🔴 **Η υπόθεση IAM διαψεύστηκε δύο φορές** (UpdateRole 19:13 +2 δικαιώματα ⇒ δύο re-run, ίδιο 404) και το firebase-tools #6593 δείχνει ότι το συμβόλαιο IAM του `defaultBucket` είναι **ασταθές** (2023→06/2026) ⇒ **καταργήθηκε η ερώτηση**. 🔴 **Η πρώτη εκδοχή (`storage: [{ bucket }]`) ΕΣΠΑΓΕ ΤΟΝ EMULATOR** (`config.js`: «Must supply 'target'») — αναθεωρήθηκε την ίδια μέρα σε `storage: [{ target: "main" }]` + νέο **`.firebaserc` μόνο με `targets`** (παραγωγή + τα δύο demo projects, **κανένα** default project). `storageEntriesOf` → **`declaredBucketOf(firebaseJson, firebaserc, project)`** με τη σημασιολογία του `release.js`/`rc.js`· λάθος δήλωση ⇒ `{error}` **με όνομα** στο `live.js`. 🏆 Άγκυρες στο **πραγματικό** αποθετήριο: κανόνες στον **ίδιο** bucket με το `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` · κάθε emulator με storage ξεκινά με **τους δικούς μας** κανόνες · κανένα default project. **9/9 μεταλλάξεις σκοτωμένες** (md5 επαναφορά). Runbook: οι εντολές δημιουργίας ρόλων καθρεφτίζουν τον **ζωντανό** IAM (diff). |
| 2026-09-18 | ✅ **§11 — Η ΓΡΑΜΜΗ ΠΑΡΑΓΩΓΗΣ: η παραγωγή Firebase ελέγχεται (3) και ενημερώνεται (4) από το CI** *(εντολή Giorgio: «και τα δύο, όπως οι μεγάλοι»)*. Κλείνουν τα §10.5 #1-#2. 🔑 **Το αυγό-κότα του handoff §5.1** λύθηκε με **GitOps** (Argo CD: *«sync only if OutOfSync»*): το δέντρο = «τι θέλουμε», ρωτιέται ο **πάροχος**, ιστορικό = GitHub Deployment — **κανένα** commit από ρομπότ. `docker-build.yml`: `firebase-plan` (παράλληλα με το build) → ⏸ έγκριση **μόνο αν διαφέρει** → `firebase-apply` (μόνο οι διαφέροντες στόχοι, `--wait` μέχρι READY) → `release` (immutable `:main-<sha>` → `:latest` → Coolify). `firebase-drift.yml` κάθε πρωί, **Tier 1** ⇒ CI Health + **Telegram σε μετάβαση**. Ο **Κ5 γίνεται ενημέρωση** έναντι `origin/main` (δεν μπλοκάρει πια το push — θα απαγόρευε το ίδιο το αίτημα). 🔴 **Τρία μετρημένα ευρήματα που ανέτρεψαν υποθέσεις**: (1) **`roles/datastore.indexViewer` δεν υπάρχει** και ο `datastore.viewer` διαβάζει **κάθε έγγραφο** ⇒ δύο **custom roles** (6 · 18 δικαιώματα, 18/18 επαληθευμένα με `testIamPermissions`, **χωρίς** delete/δεδομένα/IAM)· (2) **το `firebase-admin` 12.7.0 απορρίπτει την ταυτότητα χωρίς κλειδί** (`external_account`) ⇒ το `live.js` σε `google-auth-library` 9.15.1 (Apache-2.0, ήδη στο lockfile ως optional — **μία** έκδοση), το ίδιο με το firebase-tools· (3) το repo είναι **δημόσιο** ⇒ Actions δωρεάν, Environments διαθέσιμα στο Free. Επίσης: σύγκριση κανόνων **modulo CRLF/LF** · προέλευση `history` από το git (ταύτιση περιεχομένου) · καρφωμένο `firebase-tools@15.13.0` · `--pipeline` (μόνο μέσα στο Actions) · **ένας** αποστολέας Telegram (το inline curl είχε script injection) · `workflow-meta.readWorkflowJobs`. Σουίτα `firestore-deploy-pipeline.test.js` (**25** tests, **9/9 εκτελεσμένες μεταλλάξεις**)· 105/105 μαζί με gate/drift/tiers. Runbook βημάτων Giorgio: `docs/deployment/firebase-pipeline.md`. **Ενεργοποίηση**: μετά τα βήματα Giorgio — πριν από αυτά ο κώδικας **δεν** κυκλοφορεί (fail-closed, §11.6). |
| 2026-09-18 | ✅ **§10 — Η ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ: το μητρώο από ισχυρισμός γίνεται επαληθεύσιμο γεγονός** *(εντολή Giorgio)*. Αφορμή: το handoff ζητούσε deploy που **είχε ήδη γίνει** (`bd29dd14`)· η επιβεβαίωση χρειάστηκε **χειροκίνητο** curl/gcloud, γιατί το εργαλείο δεν μπορούσε να την κάνει — και μετρήθηκαν **τέσσερις** ψευδείς ισχυρισμοί (§10.1), με χειρότερο το «CREATING» του `--verify` που ήταν **σταθερό κείμενο**. Νέα: `live.js` (ο **μόνος** κώδικας που ρωτά τον πάροχο — μόνο GET, ADC μέσω του υπάρχοντος `firebase-admin`, releases/ταύτιση **του firebase-tools 15.13.0**) · `drift.js` (καθαρός, **Sync × Health** του Argo CD, έξοδοι **0-4** επέκταση του Terraform `-detailed-exitcode`, **απόδοση προέλευσης** `tree/recorded/foreign/unattributable` από το μητρώο + git) · `verify-live.js` (`npm run firestore:verify`, `--wait`, `--json`) · `compileRules` εξήχθη **καθαρή** από το `build-firestore-rules.js` (μία μεταγλώττιση, δύο καταναλωτές). Το `record-deploy.js` **έχασε** το `verifyIndexes`/`indexKey` και τρέχει τη ζωντανή ερώτηση **μετά από κάθε** deploy, με τον **δικό της** κωδικό εξόδου. 🔴 Παγίδα που βρέθηκε: `storage.rules` CRLF στον δίσκο / LF στο blob ⇒ ανασύνθεση με **τρεις αποδόσεις γραμμών** κρινόμενες από το sha256 του μητρώου. Μέτρηση παραγωγής: **3/3 Synced·Healthy, 475/475 READY, overrides 2/2, EXIT 0**· 6 αρνητικοί μάρτυρες σε **πραγματικά** ζωντανά δεδομένα. Σουίτα `firestore-deploy-drift.test.js` (+30 tests· 50/50 μαζί με την πύλη) με **εκτελεσμένες μεταλλάξεις**. |
| 2026-09-16 | ✅ **Η ΠΡΩΤΗ ΑΝΑΠΤΥΞΗ — και η οριστική απόδειξη της διάγνωσης** *(εντολή Giorgio)*. `firestore:rules` + `firestore:indexes` → δείκτες **437 = 437** (ήταν 436·437). 🔑 **Η οθόνη άλλαξε μήνυμα**: από `Missing or insufficient permissions` (**permission-denied** ⇒ κανόνας) σε `The query requires an index… currently building` (**failed-precondition** ⇒ δείκτης) — δηλαδή ο κανόνας **πέρασε**, και αποκαλύφθηκε το εμπόδιο που ήταν **κρυμμένο πίσω του**, ακριβώς όπως προέβλεψε το §1 (οι κανόνες κρίνονται **πριν** τα ευρετήρια). Μετά, `storage` με το ίδιο σκεπτικό: στο GitOps δόγμα η απάντηση στο «artifact χωρίς απόδειξη» είναι **reconcile**, **ποτέ** «εξαίρεσέ το» (Argo CD δεν αφαιρεί resource επειδή είναι `OutOfSync`· Terraform δεν προτείνει `ignore_changes` για drift). Πύλη: **✅ και οι τρεις στόχοι**, EXIT 0. ⚠️ **Τεκμήριο της έρευνας που ΔΕΝ επιβεβαιώθηκε**: το CLI **ποτέ** δεν τύπωσε *«already up to date»* — τύπωσε `uploading… released` και στις τρεις περιπτώσεις ⇒ **δεν** μπορεί να χρησιμοποιηθεί ως ανιχνευτής απόκλισης, ούτε καν κατά την ανάπτυξη. Δηλωμένο όριο. |
| 2026-09-16 | **Δημιουργία + υλοποίηση.** Αφορμή: το «Ιστορικό» του ADR-864 Φ1β έδειχνε `permission-denied` με **σωστό κώδικα σε κάθε κρίκο**· ζωντανή μέτρηση **436 vs 437** έδειξε ότι ο δείκτης του `b307f46e` **δεν ανέβηκε ποτέ** (ηλικία **21 commits**). Ρίζα: **commit ≠ deploy**, δεύτερη φορά σε 6 μέρες (ADR-845 §Ο-18 την ονόμασε χωρίς όργανο). 🔴 Η προφανής λύση **διαψεύστηκε από μέτρηση**: το `firebase deploy --dry-run` γυρίζει **exit 0** με την απόκλιση παρούσα. Λύση: μητρώο **append-only** όπου η γραμμή είναι **παράγωγο της πράξης**, εκκρεμότητα **παραγόμενη**, κρίση **offline**, μπλοκ **στο push**. Νέος **pre-push** φύλακας — που το N.(-1.1) ήδη προϋπέθετε ενώ **δεν υπήρχε**. CHECK 3.86. |
