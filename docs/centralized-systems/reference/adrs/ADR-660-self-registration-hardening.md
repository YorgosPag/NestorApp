# ADR-660 — Self-registration hardening (pending / admin-approval)

**Status**: Accepted · **Ημερομηνία**: 2026-07-15 · **Σχετικά**: ADR-657 §3.5 (fail-closed auth — root cause), ADR-439 Phase 3 (tenant provisioning), ADR-244 (Role Management console), ADR-063 (company isolation via claims), ADR-316 (workspace bootstrap at login)

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
