# ADR-660 — Self-registration hardening (pending / admin-approval)

**Status**: Accepted · **Ημερομηνία**: 2026-07-15 · **Σχετικά**: 🔴 **ADR-787 (η πολυ-οργανισμική πλατφόρμα — ⚠️ η pending-έγκριση αυτού του ADR ΜΕΝΕΙ ακέραιη· η «αυτο-δημιουργία ΔΙΚΟΥ ΤΟΥ χώρου» είναι ΑΛΛΗ πράξη, δες ADR-787 §2.2: ο χρήστης ΠΟΤΕ δεν δηλώνει ρόλο σε ξένο χώρο)**, ADR-657 §3.5 (fail-closed auth — root cause), ADR-439 Phase 3 (tenant provisioning), ADR-244 (Role Management console), ADR-063 (company isolation via claims), ADR-316 (workspace bootstrap at login)

---

## 1. Πλαίσιο

### 1.1 Το κενό (root cause που αποκάλυψε το ADR-657)

Η αυτο-εγγραφή ήταν **ανοιχτή**: οποιοσδήποτε με λογαριασμό Google (ή email/password)
μπορούσε να αυτο-εγγραφεί και να προσγειωθεί **μέσα στην πραγματική εταιρεία**. Το endpoint
`POST /api/auth/complete-registration` χορηγούσε αυτόματα:

- `globalRole: 'external_user'`
- `companyId: DEFAULT_COMPANY_ID` (ο πραγματικός tenant ΠΑΓΩΝΗΣ)
- claims `properties:view` + `projects:view`, `/users/{uid}` + `company_members/{uid}` `status: 'active'`

Ο ύποπτος λογαριασμός `mugeshraotech` (έρευνα ADR-657: καλοήθης, session 11″, μηδέν writes)
απέδειξε ότι το privilege-escalation του fail-open (τώρα κλειστό) στηριζόταν σε αυτή την ανοιχτή
πόρτα. Το fail-closed (ADR-657 §3.5) έκλεισε το escalation· **δεν** έκλεισε την ανοιχτή εγγραφή.

Οι μεγάλοι παίκτες (Revit/ACC, ArchiCAD, Figma) **δεν** αφήνουν τυχαίο χρήστη σε tenant — είναι
invite-only / domain-allowlist / **admin-approval**.

### 1.2 Επιλογή κατεύθυνσης (Giorgio, 2026-07-15)

Επιλέχθηκε **pending / admin-approval** — ταιριάζει άριστα με το ήδη-deployed fail-closed
(pending χρήστης = χωρίς `companyId` claim ⇒ ήδη 401 παντού, μηδέν νέα gate logic) και με το
admin-approval μοντέλο των μεγάλων.

## 2. Απόφαση

### 2.1 SSoT provisioning service — `src/server/auth/pending-registration.ts`

`ensurePendingRegistration({ uid, email, displayName?, authProvider? })`:

- Αν ο χρήστης έχει ήδη `companyId` (εγκεκριμένος) → `{ status: 'assigned' }`, **ποτέ downgrade**.
- Αλλιώς upsert `/users/{uid}` με `status: 'pending'`, `companyId: null`, `globalRole: null`,
  `registrationStatus: 'pending'`, `requestedAt` — **ΧΩΡΙΣ custom claims, ΧΩΡΙΣ member doc**.
- **Notify-once** (transaction-guarded `pendingNotifiedAt`, zero race): στέλνει email στους
  ενεργούς `super_admin`/`company_admin` του tenant μέσω `sendReplyViaMailgun` (SSoT) +
  `buildPendingRegistrationAdminEmail` (branded template, ADR-590 base helpers).
  **Πηγή admin = το top-level `users` collection** (`companyId` + `globalRole`), ΟΧΙ το
  `companies/{id}/members` subcollection — live-verify 2026-07-15 έδειξε ότι το members είναι
  **άδειο** στην παραγωγή (ο owner bootstrap-άρεται με απευθείας claims, χωρίς member doc), οπότε
  query στο members θα έστελνε 0 emails. Ενεργοί admin του tenant σήμερα: `georgios.pagonis@gmail.com`
  (super_admin)· `pagonis.oe@gmail.com` = external_user (δεν λαμβάνει).

Συγκλίνουν εδώ **δύο** entry points (μηδέν διπλότυπο):

- `POST /api/auth/session` — **universal login chokepoint** (κάθε provider, verified token).
  Στο branch «χωρίς `companyId`» καλεί fire-and-forget το service (mirror του υπάρχοντος
  `ensureCompanyDocument` bootstrap για το companyId branch).
- `POST /api/auth/complete-registration` — client onboarding (email/password). Πλέον **thin
  delegate** στο service· αφαιρέθηκε ΟΛΗ η grant-λογική.

### 2.2 Client pending UX

- `src/app/pending-approval/page.tsx` — φιλική οθόνη «εκκρεμεί έγκριση» + «Έλεγχος ξανά»
  (refresh token) + «Αποσύνδεση». i18n `auth.pendingApproval.*`.
- `src/app/page.tsx` — authenticated χωρίς `companyId` → `router.replace('/pending-approval')`
  (αντί για σπασμένο dashboard).
- `auth-context-profile.ts` — JIT profile `status: hasTenant ? 'active' : 'pending'` (συνέπεια).

### 2.3 Admin approval (reuse ADR-244, ΟΧΙ νέο engine)

- Το `GET /api/admin/role-management/users` ήδη λιστάρει «unassigned» (`companyId == null`)·
  τώρα default `status: 'pending'`.
- `ApproveUserDialog` → οδηγεί το **υπάρχον** `POST /api/admin/set-user-claims` (θέτει claims +
  member doc + user active + audit + tenant isolation). Στον πίνακα, unassigned χρήστης = κουμπί
  **Έγκριση** (οι role/perms/suspend απαιτούν member doc που δεν υπάρχει ακόμη).
- `status: 'pending'` προστέθηκε σε types + badge (`secondary`) + φίλτρο + labels (el/en).

## 3. Consequences

- ✅ Καμία αυτόματη πρόσβαση σε tenant από αυτο-εγγραφή — enterprise gate όπως οι μεγάλοι.
- ✅ Μηδέν νέο gate logic: το fail-closed (ADR-657) κόβει ήδη τον pending χρήστη.
- ✅ Μηδέν διπλότυπο: ένα SSoT service, δύο entry points· approval μέσω υπάρχοντος set-user-claims.
- ✅ Admin awareness: email ειδοποίηση (notify-once, race-proof) + ορατότητα στην κονσόλα.
- ⚠️ Το `/pending-approval` gate είναι στο `/` (primary post-login landing). Άμεση πλοήγηση σε
  βαθύ route (`/buildings`) δείχνει fail-closed κενά — αποδεκτό v1· κεντρικό layout gate = future.
- ⚠️ Απενεργοποίηση Google self-signup στο Firebase Auth console = συμπληρωματικό, εκτός scope.

## 4. Changelog

- **2026-07-15** — ADR created + implemented (Opus). **NEW**: `server/auth/pending-registration.ts`,
  `services/email-templates/pending-registration-admin.ts`, `app/pending-approval/page.tsx`,
  `role-management/components/ApproveUserDialog.tsx`. **MOD**: `api/auth/complete-registration/route.ts`
  (delegate, grant αφαιρέθηκε), `api/auth/session/route.ts` (pending branch fire-and-forget),
  `auth-context-profile.ts` (status pending), `auth/types/auth.types.ts` (+`pending`),
  `role-management/types.ts` + `users/route.ts` + `UsersTab`/`UserTable` (pending status + approve),
  i18n `auth.pendingApproval.*` + `admin.roleManagement.{approve,statusLabels.pending,actions.approve}`
  (el/en). **Tests**: `email-templates/__tests__/pending-registration-admin.test.ts` (3) +
  `server/auth/__tests__/pending-registration.test.ts` (5 — pending upsert χωρίς claims, no-op
  assigned, notify-once race-guard, no-admins, suspended/disabled exclusion) → 8/8 pass.
  `useAuthActions.signUp` — αφαιρέθηκε η νεκρή client κλήση `complete-registration` (401άρει υπό
  fail-closed· provisioning γίνεται server-side στο session route). Pending commit + live-verify (Giorgio).
- **2026-08-23** — **§5: ο πολίτης δεν περιμένει έγκριση για να υπάρχει** (απόφαση Giorgio μετά
  από έρευνα αγοράς). Η έγκριση καθόταν στη **λάθος πύλη**: στον λογαριασμό, όπου καμία πλατφόρμα
  δεν τη βάζει. **NEW**: `lib/routes/landing.ts` (`resolvePostLoginRoute` · `PRIVATE_SPACE_HOME`),
  `lib/routes/__tests__/landing.test.ts` (14 άγκυρες). **MOD**: `lib/routes/authRoutes.ts`
  (+`pendingApproval` — ήταν ωμή συμβολοσειρά), `lib/routes/index.ts`, `dashboard/page.tsx` (δεν
  αποφασίζει πια μόνο του πού ανήκει ο άνθρωπος), `pending-approval/page.tsx` (νέα **σημασία** +
  πόρτα εξόδου), `server/auth/pending-registration.ts` (−`registrationStatus`: δεύτερη αυθεντία
  με 0 αναγνώστες/0 έγγραφα· διόρθωση ψευδούς docblock «ΔΥΟ σημεία»), i18n `auth.pendingApproval.*`
  (el+en, +`goToMySpace`). **Μετρήσεις**: ο SSoT δεν είχε τρέξει **ποτέ** (4 χρήστες, 0 pending)·
  το `complete-registration` = νεκρό **και** δομικά αδύνατο. **Tests**: 20/20, **9/9 μεταλλάξεις
  κόκκινες**. 🔶 Εκκρεμούν: διαγραφή του `api/auth/complete-registration/` (Giorgio) · το claim
  του ιδιωτικού χώρου (**Φάση 3 ADR-787**) — μέχρι τότε η **υποβολή** του πολίτη 401άρει.

---

## 5. Ο ΠΟΛΙΤΗΣ ΔΕΝ ΠΕΡΙΜΕΝΕΙ ΕΓΚΡΙΣΗ ΓΙΑ ΝΑ ΥΠΑΡΧΕΙ (2026-08-23)

### 5.1 Η ανατροπή: η έγκριση καθόταν στη ΛΑΘΟΣ πύλη

Η λέξη «εγγραφή» σημαίνει **δύο** πράγματα, και ο κώδικας ήξερε μόνο το ένα:

| πρόθεση | σωστή απάντηση | τι έκανε ο κώδικας |
|---|---|---|
| *«θέλω να **μπω στο γραφείο σου**»* | ✅ έγκριση διαχειριστή | έγκριση |
| *«θέλω να **υπάρχω**»* | ⛔ **ποτέ** έγκριση (ADR-787 Ε-3) | **έγκριση** |

Το `ensurePendingRegistration` τους αντιμετώπιζε **ταυτόσημα** ⇒ ο πολίτης που ανεβάζει το
διαμέρισμά του έβλεπε ως **πρώτη οθόνη μετά την εγγραφή** το *«ο λογαριασμός σας εκκρεμεί
έγκριση»*. Δεν ήταν σφάλμα αυτού του ADR ούτε του ADR-787: ήταν **δύο σωστές αποφάσεις που δεν
συναντήθηκαν ποτέ**.

### 5.2 Η έρευνα αγοράς — δύο πύλες, και οι μεγάλοι τις ξεχωρίζουν πάντα

| | Πύλη | Zillow (ΗΠΑ) | Rightmove (ΗΒ) | **Spitogatos / XE (ΕΛΛΑΔΑ)** |
|---|---|---|---|---|
| **Α** | **ΛΟΓΑΡΙΑΣΜΟΣ** — «επιτρέπεται να υπάρχεις;» | άμεσος | *(απαγορεύει τον ιδιώτη)* | **άμεσος, μόνο επιβεβαίωση email** |
| **Β** | **ΑΓΓΕΛΙΑ** — «επιτρέπεται να δημοσιευτεί;» | έλεγχος έως 72h + τηλέφωνο | μόνο μεσίτες με φορέα επανόρθωσης | **πληρωμή** 3€/6€, καμία έγκριση |

⇒ **Καμία δεν βάζει ανθρώπινη έγκριση στην Α για ιδιώτη.** Ο Νέστωρ έκανε **ακριβώς ανάποδα**:
φρουρός στην Α, ανοιχτό στη Β (το `OWNER_PROPERTY_LIFECYCLES` έχει **ήδη** αποφασίσει «καμία ουρά
για την αγγελία»).

- **GitHub**, αυτολεξεί: *«you cannot sign in to an organization. Instead, **each person signs in
  to their user account**»* — η ταυτότητα είναι **πάντα** το πρόσωπο· ο οργανισμός είναι δοχείο
  μέσα από το οποίο ενεργεί. Ίδιο μοντέλο σε **Figma** (ο προσωπικός χώρος συνυπάρχει) και
  **Autodesk** (το Autodesk ID είναι η ταυτότητα, τα hubs προστίθενται).
- **DSA Άρθρο 30 (KYBC)**, σε ισχύ για marketplaces από 10/2024: απαιτεί επαλήθευση **μόνο για
  traders**. *Ο νόμος δεν ζητά έγκριση για τον ιδιώτη — ζητά να **ΞΕΧΩΡΙΖΕΙΣ** τον έμπορο από τον
  πολίτη*, δηλαδή ακριβώς τη διάκριση `OrgWorkspaceRef` / `PersonalWorkspaceRef` του ADR-787.
- **Onboarding UX**: *«end the onboarding flow **inside a useful screen**, not on a dead-end
  confirmation»* — η οθόνη αναμονής είναι το ονομασμένο αντι-πρότυπο.

🏆 **Πού ξεπερνάμε**: το Zillow **δεν επιτρέπει** μετατροπή ιδιώτη σε επαγγελματία στο ίδιο email —
θέλει **δεύτερο λογαριασμό**. Εδώ η μετάβαση είναι **προσθετική, με μηδέν δεύτερο λογαριασμό**.

### 5.3 Οι μετρήσεις (2026-08-23) — τέσσερις ανέτρεψαν το σχέδιο

1. 🔴 **Ο SSoT δεν είχε τρέξει ΠΟΤΕ.** Βάση: **4 χρήστες**, **0** με `status:'pending'`, **0** με
   `registrationStatus`, **0** με `pendingNotifiedAt`. Ο χρήστης του περιστατικού
   (`mugeshraotech@gmail.com`) γράφτηκε **12/06**, ο SSoT γεννήθηκε **15/07** ⇒ **η ουρά ήταν
   άδεια· κανένα πρόβλημα μετανάστευσης.**
2. 🔴 **`/api/auth/complete-registration` = νεκρό ΚΑΙ δομικά αδύνατο** — τυλιγμένο σε `withAuth`,
   επιστρέφει **401 ακριβώς στους χρήστες που υπήρχε να εξυπηρετήσει**, με **μηδέν καλούντες**.
   ⚠️ **Η γνώση ΥΠΗΡΧΕ**: το §4 το γράφει από τις 15/07 (*«401άρει υπό fail-closed»*) — και το
   docblock του SSoT εξακολουθούσε να το διαφημίζει ως ένα από «ΔΥΟ σημεία». *Ένα anchor χωρίς
   gate είναι σχόλιο* (CHECK 3.36)· εδώ ούτε σχόλιο ήταν — ήταν **αντιφατικό** σχόλιο.
3. 🔴 **`registrationStatus` = δεύτερη αυθεντία** για ερώτημα που ήδη απαντούσε το `status`
   (ADR-749): **0 αναγνώστες** σε όλο το `src/`, **0 έγγραφα** στη βάση. Αφαιρέθηκε.
4. 🔴 **`AUTH_ROUTES.home` ήταν ΣΤΑΘΕΡΑ** (8 καταναλωτές) και τεκμηριωμένη ως *«η αρχική του
   ΣΥΝΔΕΔΕΜΕΝΟΥ»*. Από τη στιγμή που υπάρχουν **δύο είδη** συνδεδεμένου, μία σταθερά είναι
   **δομικά ανίκανη** να απαντήσει — ο **καθρέφτης** του ADR-749 (εκεί δύο απαντήσεις σε ένα
   ερώτημα· εδώ **μία** απάντηση σε ερώτημα που έχει δύο).
5. ✅ Ο `(me)` είναι **μισο-ζωντανός χωρίς claim**: οι **αναγνώσεις** περνούν από client Firestore
   (`useMyOwnerProperties` με `where(authorUserId == uid)`, ο κανόνας το επιτρέπει) ⇒ δουλεύουν.
   Μόνο οι **υποβολές** πάνε σε `withAuth` API ⇒ 401.

### 5.4 Η απόφαση, και τι άλλαξε

> **Ο πολίτης δεν περιμένει έγκριση για να υπάρχει. Η έγκριση αφορά ΜΟΝΟ την είσοδο σε ΞΕΝΟ χώρο.**

- **ΕΝΑΣ επιλυτής προσγείωσης** — `src/lib/routes/landing.ts` (`resolvePostLoginRoute`). ⚠️ **Δεν
  αποφασίζει ταυτότητα**: χαρτογραφεί ταυτότητα **ήδη αποφασισμένη** σε διεύθυνση, άρα **δεν**
  είναι αναγνώστης καναλιού του CHECK 3.58 και **δεν** μπαίνει στο `.workspace-authority.json`.
  🎁 Όταν η **Φάση 3 του ADR-787** βάλει τον χώρο στη διεύθυνση, αλλάζει **αυτή η μία συνάρτηση**,
  όχι N σημεία κλήσης.
- **Η οθόνη αναμονής απέκτησε όνομα** (`AUTH_ROUTES.pendingApproval`) — ήταν **ωμή συμβολοσειρά**,
  και μια διεύθυνση χωρίς όνομα δεν μπορεί να φυλαχθεί.
- **Το `pending` άλλαξε ΣΗΜΑΣΙΑ**: από *«δεν υπάρχεις»* σε *«ζήτησες να μπεις σε γραφείο»*, με
  **πόρτα εξόδου** προς τον ιδιωτικό χώρο. ⚠️ **Καμία αυτόματη ανακατεύθυνση** από εκεί: θα έκανε
  τη σελίδα απρόσιτη και για τον επαγγελματία που όντως περιμένει — δηλαδή θα έσβηνε τη μία
  περίπτωση που τη δικαιολογεί.
- **Προσγείωση του πολίτη = `MY_OFFERS_ROUTE`**, ονομασμένο ως `PRIVATE_SPACE_HOME`. ⚠️
  **Ονομασία, ΟΧΙ διπλότυπο**. Επιλέχθηκε αντί για νέα σελίδα-ευρετήριο του `(me)` επειδή ο
  `MyOwnerPropertiesContent` **έχει ήδη** άδεια κατάσταση με κάλεσμα προς `NEW_OFFER_ROUTE` —
  *useful screen with an action*, χωρίς νέα επιφάνεια προϊόντος.

### 5.5 Ο δρόμος που ΑΠΟΡΡΙΦΘΗΚΕ — «έγκριση για όλους, όπως σήμερα»

Ήταν συνεπής με το §2 και **λάθος** για δύο λόγους, και οι δύο μετρημένοι:

1. **Καμία πλατφόρμα της αγοράς δεν το κάνει** (§5.2), και ο DSA ζητά **διάκριση**, όχι έγκριση.
2. **Η ουρά γινόταν αόρατη.** Το `OWNER_PROPERTY_LIFECYCLES` έχει ήδη αποφασίσει «δημοσίευση
   αμέσως, καμία ουρά» για την **αγγελία**. Η έγκριση στον **λογαριασμό** έβαζε την ίδια ουρά
   **ένα σκαλί πιο πίσω**, εκεί που η απόφαση του ADR-777 §8.16.2 δεν την έβλεπε.

🔶 Απορρίφθηκε **προς το παρόν** και η ενδιάμεση εκδοχή *«καμία έγκριση, αλλά επαλήθευση
email/τηλεφώνου πριν την πρώτη δημοσίευση»*: είναι πύλη **Β**, άπτεται του **Κ-8** (επαλήθευση
ιδιότητας) και **δεν** πρέπει να μπλεχτεί με αυτή τη δουλειά.

### 5.6 Ο φρουρός — και γιατί ΟΧΙ νέα CHECK

Το ερώτημα που δεν επιτρέπεται να ξαναγεννηθεί σιωπηλά: *«υπάρχει μονοπάτι που στέλνει άνθρωπο σε
ουρά ανθρώπινης έγκρισης **απλώς και μόνο επειδή γράφτηκε**;»*

- ⛔ **Το προφανές κριτήριο μετρήθηκε και απορρίφθηκε**: «`!companyId` σε θέση φρουράς στον
  πελάτη» ⇒ **289 υποψήφια**, συντριπτικά νόμιμα (cache keys, φίλτρα, σελίδες `(app)` που *σωστά*
  θέλουν εταιρεία) ⇒ ψευδώς θετικά **πολύ πάνω από 10%**.
- ✅ **Κρατήθηκε το κριτήριο πλοήγησης** προς την ονομασμένη διεύθυνση: 21 ωμά hits, από τα οποία
  **1** πλοήγηση (τα υπόλοιπα: κείμενο της σελίδας 7 · ο άσχετος `pendingApprovalPoCount` του
  procurement 10 · σχόλια 3) ⇒ **0% ψευδώς θετικά**. Μετά τη θεραπεία: **μηδέν** πλοηγήσεις.
- 🔑 **Δεν γράφτηκε νέα CHECK, και ο λόγος είναι μετρημένος**: το `jest-suite.yml` (**ADR-783 /
  CHECK 3.54**) τρέχει **ολόκληρη** τη σουίτα **άνευ όρων και μπλοκάροντας** ⇒ **σε αυτό το repo
  μια άγκυρα ΕΙΝΑΙ πύλη**. Μια 35η μηχανή για πληθυσμό **μηδέν**, εκεί που 30 γραμμές άγκυρας
  έχουν την ίδια ισχύ, θα ήταν προσθήκη στους **606 αδρανείς** του ADR-749 §5.
- Ο φρουρός είναι **κλειστό σύνολο με υποχρεωτικό λόγο** (πρότυπο CHECK 3.35/3.50/3.58), σήμερα
  **κενό**, και κοκκινίζει **και στις δύο** κατευθύνσεις: αδήλωτη πλοήγηση **και** δήλωση χωρίς
  αντικείμενο (νεκρός φρουρός). ⚠️ Κόβει σχόλια πριν κρίνει — *τεκμηρίωση της βλάβης δεν είναι
  βλάβη* (`Κ7β` της CHECK 3.50)· το έμαθε **πάνω στον εαυτό του**, κοκκινίζοντας στο σχόλιο που
  εξηγεί γιατί η ωμή διεύθυνση ήταν λάθος.

### 5.7 🔶 Τι ΔΕΝ έκλεισε — δηλωμένο, όχι κρυμμένο

- ⛔ **Η υποβολή του πολίτη εξακολουθεί να 401άρει.** Και οι **5** διαδρομές API
  (`owner-properties` ×3 · `demand/interest` · `demand/competition`) είναι `withAuth`, και το
  **claim** του ιδιωτικού χώρου ανήκει στη **Φάση 3 του ADR-787**. Μετά από αυτή τη δουλειά ο
  πολίτης: ✅ μπαίνει · ✅ προσγειώνεται στον χώρο του · ✅ **βλέπει** τα ακίνητά του · ❌ **δεν**
  υποβάλλει ακόμη.
- 🔶 **Εκκρεμεί η διαγραφή** του `src/app/api/auth/complete-registration/` — **απόφαση Giorgio**.
- 🔶 Το §3 γράφει *«το `/pending-approval` gate είναι στο `/`»*: **μπαγιάτικο** από το ADR-777
  §8.13 (η ρίζα είναι η δημόσια οθόνη· ο χώρος εργασίας μετακόμισε στο `/dashboard`).

**Αρχεία**: `lib/routes/landing.ts` *(νέο)* · `lib/routes/authRoutes.ts` · `lib/routes/index.ts` ·
`app/(app)/dashboard/page.tsx` · `app/(app)/pending-approval/page.tsx` ·
`server/auth/pending-registration.ts` · i18n `auth.pendingApproval.*` (el+en).

**Άγκυρες**: `lib/routes/__tests__/landing.test.ts` (**14**: Κ1-Κ6 · Π1-Π3 · Φ1+Φ1β · Δ1+Δ1β · Δ2)
και `server/auth/__tests__/pending-registration.test.ts` (**6**) ⇒ **20/20**, **9/9 μεταλλάξεις
κόκκινες, Μ0 πράσινο πριν ΚΑΙ μετά**.
⚠️ Το `Δ1` μετρά αρχείο που αυτή η δουλειά **δεν επιτρέπεται να αγγίξει** (Φάση 3, κοινό working
tree), άρα η απόδειξή του μετακινήθηκε στο **κατηγόρημα** (`Δ1β`) — δηλωμένο όριο.
