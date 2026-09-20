# Firebase στη γραμμή παραγωγής — Runbook (ADR-865 §11)

> **Τι κάνει**: σε κάθε push στο `main` το GitHub ρωτά την παραγωγή Firebase «ταιριάζεις με το
> δέντρο;». Αν όχι, **ζητά την έγκρισή σου**, αναπτύσσει κανόνες/δείκτες, περιμένει τους δείκτες
> να γίνουν **READY**, και **μόνο τότε** αφήνει τον κώδικα να βγει στο nestorconstruct.gr.
> Κάθε πρωί (07:30 Αθήνα) το ίδιο ερώτημα γίνεται και χωρίς push, και σε ειδοποιεί αν κάτι άλλαξε.
>
> **Αυθεντία**: ο κώδικας — `.github/workflows/docker-build.yml` · `.github/workflows/firebase-drift.yml` ·
> `.github/actions/firebase-identity` · `scripts/lib/firestore-deploy/*` · `scripts/firestore-deploy/*`.
> Σκεπτικό: ADR-865 §11.

---

## 1. Εφάπαξ στήσιμο — το κάνει **ο Giorgio**, με τη σειρά

⚠️ **Πριν από το πρώτο push που περιέχει το §11.** Χωρίς αυτά το `firebase-plan` αποτυγχάνει και ο
κώδικας **δεν κυκλοφορεί** (ασφαλής αποτυχία — αλλά το Netcup σταματά να ενημερώνεται).

### 1.1 Google Cloud (terminal με `gcloud` συνδεδεμένο ως owner του `pagonis-87766`)

Μία εντολή τη φορά· αν κάποια απαντήσει «already exists», προχώρα στην επόμενη.

```bash
PROJECT=pagonis-87766
PROJECT_NUMBER=157616068729
POOL=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github

# (α) Η υπηρεσία που ανταλλάσσει το εισιτήριο του GitHub με εισιτήριο Google
gcloud services enable sts.googleapis.com iamcredentials.googleapis.com --project=$PROJECT

# (β) Η «πόρτα» για το GitHub — δέχεται ΜΟΝΟ αυτό το repo, ΜΟΝΟ το main.
#     Αριθμητικά ids (όχι ονόματα): ένα όνομα repo μπορεί να το ξαναπάρει άλλος, ένα id όχι.
gcloud iam workload-identity-pools create github \
  --project=$PROJECT --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc nestor-app \
  --project=$PROJECT --location=global --workload-identity-pool=github \
  --display-name="NestorApp (main)" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository_owner_id=='213181784' && assertion.repository_id=='1113295967' && assertion.ref=='refs/heads/main'"

# (γ) Δύο ρόλοι «στα μέτρα μας». Ο έτοιμος ρόλος ανάγνωσης (datastore.viewer) θα διάβαζε
#     ΚΑΘΕ έγγραφο πελάτη — ρόλος «μόνο ανάγνωση δεικτών» ΔΕΝ υπάρχει (μετρημένο 2026-09-18).
gcloud iam roles create nestorFirebaseDriftReader --project=$PROJECT --stage=GA \
  --title="Nestor - Firebase drift reader (ADR-865)" \
  --description="Read-only: rules releases, index definitions. NO data access." \
  --permissions=firebaserules.releases.get,firebaserules.rulesets.get,datastore.databases.getMetadata,datastore.schemas.list,serviceusage.services.use
#     ⚠️ ΚΑΝΕΝΑ firebasestorage.* — ο bucket ΔΗΛΩΝΕΤΑΙ (§11.7), δεν ανακαλύπτεται. Ελάχιστα δικαιώματα
#     μετρημένα 2026-09-19 (ADR-865 Changelog): πλάνο πράσινο με ΑΥΤΑ τα 5 (runs 35429150868 · 35431491440).

gcloud iam roles create nestorFirebaseRulesDeployer --project=$PROJECT --stage=GA \
  --title="Nestor - Firebase rules/indexes deployer (ADR-865)" \
  --description="Deploy rules and create/update indexes. NO deletes, NO data, NO IAM." \
  --permissions=firebaserules.releases.get,firebaserules.releases.list,firebaserules.releases.create,firebaserules.releases.update,firebaserules.rulesets.get,firebaserules.rulesets.list,firebaserules.rulesets.create,firebaserules.rulesets.test,datastore.databases.getMetadata,datastore.schemas.get,datastore.schemas.list,datastore.schemas.create,datastore.schemas.update,datastore.operations.get,serviceusage.services.get,serviceusage.services.use,resourcemanager.projects.get
#     17 δικαιώματα — dry-run πράσινο με ΑΥΤΑ (run 35431491440, 2026-09-19). Τα create/update
#     ruleset·release·δείκτη μετριούνται στην πρώτη ΠΡΑΓΜΑΤΙΚΗ ανάπτυξη μέσα από τη γραμμή.

# (δ) Δύο λογαριασμοί υπηρεσίας — ΧΩΡΙΣ κλειδί (κανένα αρχείο JSON δεν δημιουργείται ποτέ)
gcloud iam service-accounts create gh-firebase-verify --project=$PROJECT \
  --display-name="GitHub - Firebase drift (read-only)"
gcloud iam service-accounts create gh-firebase-deploy --project=$PROJECT \
  --display-name="GitHub - Firebase deploy (approval-gated)"

# (ε) Κάθε λογαριασμός παίρνει ΜΟΝΟ τον δικό του ρόλο
gcloud projects add-iam-policy-binding $PROJECT --condition=None \
  --member="serviceAccount:gh-firebase-verify@$PROJECT.iam.gserviceaccount.com" \
  --role="projects/$PROJECT/roles/nestorFirebaseDriftReader"
gcloud projects add-iam-policy-binding $PROJECT --condition=None \
  --member="serviceAccount:gh-firebase-deploy@$PROJECT.iam.gserviceaccount.com" \
  --role="projects/$PROJECT/roles/nestorFirebaseRulesDeployer"

# (στ) ΠΟΙΟΣ μπορεί να γίνει ποιος.
#      Ο ελεγκτής: κάθε job αυτού του repo στο main.
gcloud iam service-accounts add-iam-policy-binding \
  gh-firebase-verify@$PROJECT.iam.gserviceaccount.com --project=$PROJECT \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/$POOL/attribute.repository_id/1113295967"
#      Ο deployer: ΜΟΝΟ job μέσα στο environment firebase-production — δηλαδή ΜΟΝΟ μετά την
#      έγκρισή σου. Χωρίς έγκριση το κλειδί ΔΕΝ εκδίδεται, όποιος κι αν το ζητήσει.
gcloud iam service-accounts add-iam-policy-binding \
  gh-firebase-deploy@$PROJECT.iam.gserviceaccount.com --project=$PROJECT \
  --role=roles/iam.workloadIdentityUser \
  --member="principal://iam.googleapis.com/$POOL/subject/repo:YorgosPag/NestorApp:environment:firebase-production"
```

### 1.2 GitHub (από την ιστοσελίδα)

1. **Settings → Environments → New environment** → όνομα **`firebase-production`**.
   - ☑ **Required reviewers** → `YorgosPag`. (Μην τσεκάρεις «Prevent self-review» — είσαι ο μόνος.)
   - ☐ **Allow administrators to bypass configured protection rules** → **ξε**-τσεκαρισμένο.
   - **Deployment branches and tags** → *Selected branches and tags* → `main`.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable** (τρεις —
   **variables, όχι secrets**: δεν είναι μυστικά, είναι διευθύνσεις):

| Όνομα | Τιμή |
|---|---|
| `GCP_WIF_PROVIDER` | `projects/157616068729/locations/global/workloadIdentityPools/github/providers/nestor-app` |
| `GCP_SA_VERIFY` | `gh-firebase-verify@pagonis-87766.iam.gserviceaccount.com` |
| `GCP_SA_DEPLOY` | `gh-firebase-deploy@pagonis-87766.iam.gserviceaccount.com` |

Τα `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` υπάρχουν ήδη ως secrets.

### 1.3 Πρώτη δοκιμή (μετά το push του §11)

1. **Actions → «T1 🔭 Firebase Drift (ADR-865)» → Run workflow**. Αποδεικνύει ότι ο ελεγκτής
   συνδέεται. Αναμένεται **κόκκινο** αν η παραγωγή διαφέρει — αυτό είναι σωστό.
2. **Actions → «T1 🚀 Build & Deploy Docker Image» → Run workflow → ☑ firebase_dry_run**.
   Αποδεικνύει ότι ο deployer έχει τα δικαιώματα — **τίποτα δεν γράφεται, τίποτα δεν κυκλοφορεί**.
   Θα ζητηθεί έγκριση (το dry-run περνά κι αυτό από το environment).

---

## 2. Καθημερινή χρήση

| Συμβαίνει | Τι βλέπεις | Τι κάνεις |
|---|---|---|
| push χωρίς αλλαγή κανόνων/δεικτών | τίποτα νέο — το `firebase-plan` λέει `none` σε ~1′ | τίποτα |
| push **με** αλλαγή | **Telegram «⏸ Firebase: ζητείται έγκριση»** (με τους στόχους) + email GitHub «waiting for review» · η σελίδα δείχνει **τι** θα αλλάξει | **Review deployments → Approve** |
| απορρίπτεις | ο κώδικας **δεν** κυκλοφορεί · Telegram «Deploy FALLITO» | διόρθωσε και ξανά push |
| νεότερο push πριν εγκρίνεις | ✅ **ADR-865 §11.9**: το νεότερο τρέξιμο (η **κορυφή**) **ακυρώνει** μόνο του το παλαιότερο που περιμένει έγκριση ⇒ παίρνει **δικό του** κουμπί. Το παλαιότερο γίνεται **γκρι** (cancelled), **όχι** κόκκινο, και **δεν** στέλνει «FALLITO». Ανάπτυξη που **ήδη τρέχει** δεν κόβεται ποτέ | **Approve** μόνο την **κορυφή**. Το δέντρο της περιέχει και το παλαιότερο |
| εγκρίνεις **παλαιότερο** τρέξιμο (π.χ. από παλιό email) | το τρέξιμο **αυτοακυρώνεται** πριν πάρει το κλειδί του deployer: *«ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ … η κορυφή του main στο …»*. **Τίποτα** δεν αναπτύσσεται, **τίποτα** δεν κυκλοφορεί | τίποτα — Approve την κορυφή |
| **Re-run** παλιού τρεξίματος | ίδιο: δεν είναι κορυφή ⇒ αυτοακύρωση. **Rollback = `git revert` + push** (GitOps), ποτέ re-run | revert + push |
| έγκριση **ξεχάστηκε** | κάθε πρωί (07:30 Αθήνα) Telegram **«έγκριση Firebase περιμένει»** για ό,τι περιμένει ≥ 8 ώρες, με σύνδεσμο. Το GitHub την κρατά έως 30 μέρες και μετά την αποτυγχάνει | Approve (ή Reject) |
| πρωινός έλεγχος βρίσκει διαφορά | σχόλιο στο CI Health issue + Telegram (μόνο στην **αλλαγή** κατάστασης) | άνοιξε το τρέξιμο, δες τον πίνακα |

**Δείκτες που υπάρχουν στην παραγωγή αλλά όχι στο αρχείο** δεν σβήνονται **ποτέ** αυτόματα
(σπάει αμέσως τα ερωτήματα που τους χρειάζονται). Αν πρέπει να φύγουν: απόφαση ανθρώπου, από την
Firebase Console → Firestore → Indexes.

### 2.1 Άσκηση διαδοχής — πώς **δοκιμάζεται** ο μηχανισμός χωρίς να πειραχτεί η παραγωγή

Το *«job σε αναμονή έγκρισης **κρατά** το concurrency group»* **δεν** είναι τεκμηριωμένο από το
GitHub (ADR-865 §11.9). Η μόνη απόδειξη ότι η ακύρωση του εκκρεμούς **ελευθερώνει** τη θέση είναι
**δική μας μέτρηση** — άρα η διαδοχή δοκιμάζεται όπως δοκιμάζεται κάθε μηχανισμός ανάκαμψης:
**στην πραγματική παραγωγή**, σκόπιμα, με **μηδενική** ακτίνα βλάβης (Google DiRT · AWS
Well-Architected REL12 «game day»).

### ❌ Το φορτίο που ΔΕΝ δουλεύει: σχόλιο *(μετρημένο 2026-09-20, push `aee8f601`, run `35526661461`)*

Ένα σχόλιο στο `firestore.rules` **δεν** ζητά έγκριση. Το `firebase.json` δηλώνει το **παραγόμενο**
`firestore.rules.compiled`, και ο μεταγλωττιστής (`scripts/build-firestore-rules.js`) **αφαιρεί τα
σχόλια** (όριο πλατφόρμας 256KB). Η σύγκριση γίνεται στο `wireOf()` — δηλαδή στη **σημασιολογία**,
όχι στα bytes της πηγής. Μετρημένο: `✓ Synced · Healthy firestore:rules` ⇒ **`πλάνο: none`**.

⚠️ **Δηλωμένη απόκλιση δύο οργάνων στην ίδια ερώτηση**: το CHECK 3.86 στο pre-commit/pre-push κρίνει
**sha256 της πηγής** και είπε *«⏳ deploy-pending · firestore:rules … στο push θα ζητηθεί η έγκρισή
σου»* — ενώ η γραμμή απάντησε `none`. Ο hook **υπερεκτιμά** (προειδοποιεί χωρίς λόγο, ποτέ το
αντίστροφο) ⇒ ακίνδυνο, αλλά μην το διαβάσεις ως υπόσχεση: **αυθεντία είναι η γραμμή**.

❌ **ΜΗΝ** χρησιμοποιήσεις ψεύτικο **δείκτη** ως φορτίο: δείκτης που υπάρχει στην παραγωγή και όχι
στο αρχείο **δεν σβήνεται ποτέ** αυτόματα (§2 παραπάνω) ⇒ μόνιμη μόλυνση για μια μέτρηση.

### ✅ Ο ασφαλής δρόμος: `workflow_dispatch` → `firebase_dry_run`

Actions → *T1 🚀 Build & Deploy* → **Run workflow** με `firebase_dry_run` = **true**: το
`firebase-apply` τρέχει (άρα **ζητά έγκριση**, γρ. 283) με `--dry-run` (γρ. 315) ⇒ **καμία** εγγραφή,
και τα `release`/`notify` **δεν** τρέχουν (γρ. 328/383) ⇒ **καμία** κυκλοφορία.

🔑 **Ακυρώνει μόνο το push.** `KEEPER_EVENT = 'push'` (`succession.js:26`) και η σκούπα ανήκει **μόνο**
στον keeper (`sweep()`: `keeper.id !== self.runId` ⇒ δεν ακυρώνει κανέναν). Ένα `workflow_dispatch`
**ποτέ** δεν γίνεται κορυφή — αλλά **ακυρώνεται** από την κορυφή όταν περιμένει έγκριση, γιατί το
κριτήριο του `supersededHolders` είναι το `pending_deployments`, **όχι** το event.

| # | Βήμα | Τι περιμένεις |
|---|---|---|
| 1 | **Α** = dispatch dry-run | Telegram *«⏸ ζητείται έγκριση»* · `pending_deployments` = 1 ⇒ **κρατά** την ουρά. **ΜΗΝ εγκρίνεις** |
| 2 | **Γ** = δεύτερο dispatch dry-run | μένει **χωρίς** κουμπί (`pending_deployments` = 0) — το ίδιο σύμπτωμα των runs `35429150868`/`35431491440` |
| 3 | **Β** = push (οτιδήποτε) | keeper ⇒ ακυρώνει **μόνο το Α** (το Γ δεν έχει κουμπί ⇒ δεν είναι superseded): *«⏭️ αντικαταστάθηκε»* |
| 4 | Μέτρησε | πόσα **δευτερόλεπτα** ως το `pending_deployments` = 1 του **Γ** ⇒ η ακύρωση **ελευθερώνει** την ουρά (ADR-865 §11.9 όριο 1) |
| 5 | Έγκρινε το **Γ** | δεν είναι πια κορυφή ⇒ φρουρός *«⏭️ ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ»* ⇒ αυτοακύρωση μέσα στη χάρη των 2′ |

Το Α γίνεται **γκρι** (cancelled), ποτέ κόκκινο: ο CI Health (ADR-757) μετρά ως «έσπασε» **μόνο** το
`failure`. Καμία ειδοποίηση «FALLITO» — το `notify` δεν τρέχει σε ακυρωμένο τρέξιμο.

---

## 3. Έκτακτη ανάγκη

- **Το GitHub ή η Google δεν απαντούν** και πρέπει να αναπτυχθεί τώρα: από τον υπολογιστή σου
  `npm run firestore:deploy -- --project pagonis-87766` (γράφει το τοπικό μητρώο — κάνε commit).
  Το επόμενο push θα δει την παραγωγή ίδια με το δέντρο και **δεν** θα ζητήσει έγκριση.
- **Αποτυχία του `firebase-apply`** (π.χ. δικαίωμα που λείπει): το μήνυμα λέει ποιο δικαίωμα
  (`PERMISSION_DENIED … <permission>`). Πρόσθεσέ το στον ρόλο (`gcloud iam roles update
  nestorFirebaseRulesDeployer --project=pagonis-87766 --add-permissions=<permission>`) και
  **Re-run failed jobs**.
- **Storage: `NO_DEFAULT_BUCKET` / «Deploy target main not configured»** (ADR-865 §11.7): ο bucket
  **δηλώνεται** — `firebase.json` `"storage": [{ "target": "main", … }]` + `.firebaserc`
  `targets.<project>.storage.main`. **ΜΗΝ** γυρίσεις το `storage` σε αντικείμενο (ξαναφέρνει την
  ασταθή κλήση `defaultBucket`) και **ΜΗΝ** γράψεις `bucket` στον πίνακα (σπάει τον emulator). Νέο
  project με emulator Storage ⇒ γραμμή στο `.firebaserc` (το ελέγχει η άγκυρα). **ΠΟΤΕ** `"projects"`
  στο `.firebaserc`: μια προεπιλογή θα έστελνε κάθε εντολή χωρίς `--project` στην παραγωγή.
- **Ζωντανή κατάσταση από τον υπολογιστή** (μόνο ανάγνωση):
  `npm run firestore:verify -- --project pagonis-87766` · με `--plan` βλέπεις τι θα έκανε η γραμμή.
  Κρίνει το **`HEAD`** (ό,τι κρίνει και η γραμμή), **όχι** τον δίσκο: ακομμίτιστες αλλαγές,
  δικές σου ή άλλης συνεδρίας, **δεν** κρίνονται, αλλά **τυπώνονται** ως ⚠️. Για να κρίνεις τον δίσκο:
  `--tree worktree` (ADR-865 §11.8). Ομοίως ο φύλακας του push κρίνει **ό,τι στέλνεται**, όχι ό,τι
  βρίσκεται στον δίσκο.

---

## 4. Ασφάλεια — τι **δεν** μπορεί να συμβεί

- **Κανένα κλειδί** δεν υπάρχει για να κλαπεί: το GitHub αποδεικνύει στη Google ποιος είναι, και
  παίρνει εισιτήριο που λήγει σε λεπτά.
- **Fork ή άλλο repo** δεν περνά την πόρτα (αριθμητικό `repository_id` στη συνθήκη).
- **Άλλο branch** δεν περνά (`ref == refs/heads/main`).
- **Ο deployer δεν εκδίδεται χωρίς την έγκρισή σου** (δεμένος στο `environment:firebase-production`).
- Κανένας από τους δύο **δεν διαβάζει δεδομένα** πελατών, **δεν σβήνει** τίποτα, **δεν αλλάζει** IAM.
- **Ο bot της γραμμής ΜΟΝΟ ακυρώνει τρεξίματα** (`actions: write`, ADR-865 §11.9), και μόνο όσα
  **δεν** είναι κορυφή και **περιμένουν** έγκριση. **Ποτέ** δεν εγκρίνει και **ποτέ** δεν απορρίπτει: το
  `POST …/pending_deployments` το καλούν μόνο *«Required reviewers»*, δηλαδή **εσύ**. Καμία ρύθμιση
  GitHub δεν άλλαξε γι' αυτό: το δικαίωμα δηλώνεται ανά job στο YAML (repo: `default_workflow_permissions: read`).
- Το όριο της υπενθύμισης (8 ώρες) ζει **μόνο** στο `REMINDER_AFTER_HOURS`
  (`scripts/lib/firestore-deploy/succession.js`) — αλλαγή εκεί, όχι εδώ.
- Το repo είναι **δημόσιο**: τα logs φαίνονται δημόσια. Δείχνουν ονόματα δεικτών/κανόνων — που
  είναι **ήδη** δημόσια μέσα στο ίδιο το repo (`firestore.rules`, `firestore.indexes.json`).
