# ADR-868 — Ένα δημόσιο σύνορο: **καμία server action**, η ταυτότητα δεν είναι όρισμα

| Metadata | Value |
|---|---|
| **Status** | ✅ **ΕΝΕΡΓΟ — ΕΠΑΛΗΘΕΥΜΕΝΟ ΣΤΗΝ ΠΑΡΑΓΩΓΗ** (2026-09-20, `nestorconstruct.gr`, commit `b2aaee0f`). CHECK 3.90 πράσινη (0 οδηγίες)· ανώνυμος ⇒ **401**· με συνεδρία `super_admin`+MFA και οι 8 αρνήσεις (404/403/400/405/«Server action not found») **όπως προβλέφθηκαν**, με **μηδέν εγγραφές** αποδεδειγμένες σε Firestore (§6 #2). Μοναδικό υπόλοιπο: η **επιτυχής** έγκριση δεν δοκιμάστηκε ζωντανά (καλύπτεται από άγκυρες). |
| **Date** | 2026-09-19 |
| **Category** | Security / API Boundary / Multi-tenancy |
| **Canonical Locations** | `src/lib/auth/middleware.ts` (`withAuth`, `requireMfa`) · `src/server/admin/admin-guards-types.ts` (`ADMIN_SURFACE_AUTH`) · `src/app/api/admin/ai-inbox/communications/[communicationId]/triage/route.ts` · `scripts/check-server-action-boundary.js` (CHECK 3.90) |
| **Author** | Georgios Pagonis + Claude Code (Anthropic AI) |
| **Σχετικά** | **ADR-777 §8.60.20.9 #9 και #12** *(τα ευρήματα)* · **ADR-801** *(κριτής — CHECK 3.68)* · **ADR-602** *(`defineRoute`)* · **ADR-742** *(ιδιοκτησία, `concealCrossTenant`)* · **ADR-214** *(communications service)* · **ADR-813** *(ταβάνι ρόλων διαχείρισης)* |

---

## §1. Το πρόβλημα — μετρημένο 2026-09-19

Κάθε εξαγωγή αρχείου `'use server'` είναι **server action**, δηλαδή **δημόσιο POST endpoint**:
*«By default, when a Server Action is created and exported, it is reachable via a direct POST request,
not just through your application's UI»* (Next.js, *Data Security*).

Στο `src/` υπήρχαν **7** τέτοια αρχεία, και **κανένα** δεν επαλήθευε ταυτότητα:

| Αρχείο | Τι εξέθετε | Βαρύτητα |
|---|---|---|
| `services/communications.service.ts` | `getTriageCommunications(companyId?)` / `getTriageStats` — με `undefined` ⇒ «GLOBAL_ACCESS»: `messages` **όλων** των εταιρειών | 🔴 διαρροή μεταξύ εταιρειών |
| ίδιο + `communications-triage-actions.ts` | `approve/rejectCommunication(id, adminUid, companyId)` — ο έλεγχος ιδιοκτησίας συνέκρινε με εταιρεία **του καλούντος-πελάτη**· η εργασία ανατίθετο σε όποιο `uid` έστελνε | 🔴 εγγραφή σε ξένη εταιρεία |
| `services/storage.service.ts` | οποιαδήποτε αποθήκη με οποιοδήποτε id | 🔴 (έκλεισε στο ADR-777 #9) |
| `ai/flows/*` (2) | κλήσεις LLM χωρίς auth — **και** εισαγωγές που δεν υπάρχουν (`genkit`, `@/lib/data-services`) | 🟠 νεκρός, μη μεταγλωττίσιμος |
| `assignment/AssignmentPolicyRepository.ts` | Admin SDK με `companyId` όρισμα (σήμερα μόνο server εισαγωγείς) | 🟡 λάθος εργαλείο |
| `crm/tasks/contracts.ts` | **μόνο τύποι** | ⚪ άσκοπη οδηγία |

Η **σελίδα** `/admin/ai-inbox` φύλαγε (`requireAdminForPage`: ρόλος διαχειριστή + MFA)· τα **endpoints**
όχι. Το docblock της σελίδας έγραφε *«Tier 3: API-level enforcement (server actions με
requireAdminContext)»* — **ψευδές**. Η Next.js το λέει κατά λέξη: *«A page-level authentication check
does not extend to the Server Actions defined within it.»*

---

## §2. Απόφαση

### §2.1 Ένας τρόπος endpoint: `withAuth` — καμία server action

Η Next.js: *«We recommend choosing one data fetching approach and avoiding mixing them. This makes it
clear for both developers working in your code base and security auditors what to expect.»* Για
**υπάρχουσες μεγάλες εφαρμογές** προτείνει **HTTP APIs**. Αυτό είναι ακριβώς το δέντρο: ~319 διαδρομές
`withAuth`, με rate limit (ADR-855), κρίση χώρου (ADR-787), ταβάνια ρόλων (ADR-801), φάκελο
απάντησης (`defineRoute`, ADR-602) και τον `apiClient` του πελάτη.

⇒ Οι server actions **δεν** είναι δεύτερος μηχανισμός που «θέλει κι αυτός φύλακα» — **αφαιρούνται**.
Δεύτερος μηχανισμός θα χρειαζόταν δεύτερο κατασκευαστή ταυτότητας (χωρίς `NextRequest`), δεύτερη
κρίση χώρου, δεύτερο rate limit — **ADR-749 μέσα στη θεραπεία**.

### §2.2 Η ταυτότητα και ο μισθωτής **δεν είναι ορίσματα**

OWASP *Multi-Tenant Security*: *«Bind tenant context to a server-verified identity»* · *«Treat
client-supplied tenant identifiers as selectors only»*.
- Το `approveCommunication` / `rejectCommunication` δέχονται πλέον `(communicationId, actor: AuthContext)`.
  Το `AuthContext` **παράγεται μόνο** από το `withAuth`. Λάθος εταιρεία εδώ δεν «απαγορεύεται» —
  **δεν εκφράζεται** στην υπογραφή.
- Το σώμα της διαδρομής είναι **μόνο** `{ decision }` με `.strict()`: παλιός πελάτης που στέλνει
  `adminUid`/`companyId` παίρνει **400**, όχι σιωπηλή αγνόηση.
- Ξένο μήνυμα ⇒ **404 πανομοιότυπο** με το «δεν υπάρχει» (`concealCrossTenant`, ADR-742)· ο bypass
  ρόλος, που έχει ήδη καθολική ορατότητα, παίρνει την ειλικρινή άρνηση **403**.
- **Παράπλευρη διόρθωση ακεραιότητας**: το ίχνος ελέγχου κατασκεύαζε
  `{ email: '', globalRole: 'company_admin', mfaEnrolled: false }` — ρόλο που **κανείς δεν επαλήθευσε**
  (ένας super_admin καταγραφόταν ως company_admin). Πλέον γράφεται ο **πραγματικός** καλών.

### §2.3 Η διαδρομή API είναι **το ίδιο αυστηρή με τη σελίδα της**

Νέα επιλογή `withAuth({ requireMfa })` — **δήλωση στο σύνορο**, όπως το ταβάνι ρόλου, ποτέ `if` στον
handler. Κρίνεται **μετά** τον ρόλο (ο χρήστης χωρίς ρόλο μαθαίνει «όχι ρόλος», όχι «λείπει MFA»),
απαντά **403 `MFA_REQUIRED`** (όχι 401: καμία ανανέωση token δεν προσθέτει δεύτερο παράγοντα, και ο
`apiClient` θα ξανάστελνε το αίτημα).

Η πολιτική της κονσόλας ζει **μία φορά**: `ADMIN_SURFACE_AUTH = { requiredGlobalRoles: ADMIN_ROLES,
requireMfa: true }` δίπλα στο `MFA_REQUIRED_ROLES` — η ταύτιση «κάθε ρόλος του `/admin` οφείλει MFA»
είναι ήδη δηλωμένη εκεί. **Προεπιλογή: απενεργοποιημένη** — οι ~319 διαδρομές δεν αλλάζουν (άγκυρα Μ1).

### §2.4 Ανάγνωση: μόνο ο realtime listener — η «καθολική όψη» αφαιρέθηκε

Ο κλάδος server-action της ανάγνωσης υπήρχε **μόνο** για διαχειριστή **χωρίς** εταιρεία, και έδινε
καθολική όψη. **Μετρημένο στην παραγωγή (`users`, 2026-09-19): 0 από 4 διαχειριστές χωρίς
`companyId`.** Επιπλέον, το `withAuth` **αρνείται** ήδη τον άνθρωπο χωρίς εταιρεία (`missing_claims`,
ADR-817) ⇒ μια διαδρομή API γι' αυτόν θα ήταν **δομικά απρόσιτη** — νεκρός κώδικας.
- Η σελίδα στενεύει τον τύπο: `AIInboxAdminContext = AdminContext & { companyId: string }`. Χωρίς
  εταιρεία αποδίδεται η άρνηση **πριν** φτάσει ο πελάτης ⇒ η κατάσταση είναι **μη εκφράσιμη** στο hook.
- Η ανάγνωση περνά από τα `firestore.rules` (listener) — η απομόνωση την κρίνει η βάση.
- Αν ποτέ χρειαστεί διαχειριστική όψη **όλων** των εταιρειών, θα είναι **ρητή** διαδρομή με
  `resolveSuperAdminProjectScope` (ADR-356) — ποτέ `undefined` από τον πελάτη.

### §2.5 `server-only`, όχι `'use server'`, για ό,τι είναι κώδικας διακομιστή

Το `'use server'` **δημοσιεύει**· το `import 'server-only'` **αρνείται** το bundle πελάτη. Τα
`communications-triage-actions.ts` και `AssignmentPolicyRepository.ts` είναι πλέον `server-only`. Το
`contracts.ts` (μόνο τύποι) δεν έχει οδηγία.

---

## §3. 🏆 «Καλύτερα από τους μεγάλους» — CHECK 3.90

Η σύσταση της Next.js («ένας τρόπος») **μένει σύσταση**: κανένα εργαλείο του οικοσυστήματος δεν την
επιβάλλει. Και το προφανές ερώτημα *«καλεί κάθε action τον φύλακα;»* είναι **αναποκρίσιμο** στατικά
(φύλακας υπό συνθήκη, σε βοηθό, μετά από ανάγνωση) — ένας τέτοιος έλεγχος ή θα είχε ψευδώς αρνητικά
ή θα απαιτούσε baseline.

Η **CHECK 3.90** ρωτά το **αποκρίσιμο** ερώτημα: *υπάρχει δεύτερος τύπος endpoint;*
- **AST**, όχι κείμενο: οδηγία είναι **μόνο** συμβολοσειρά στον **πρόλογο** αρχείου ή σώματος
  συνάρτησης (ECMAScript §14.1.1). Μετρημένο: από τα **9** υποψήφια του `git grep`, τα **6** ήταν
  σχόλια που **τεκμηριώνουν** τη βλάβη ⇒ η σάρωση κειμένου θα είχε **67%** ψευδώς θετικά.
- **Inline actions** καλύπτονται (πρόλογος κάθε συνάρτησης).
- **Untracked** αρχεία καλύπτονται (`git grep --untracked`) — πιάνει το νέο αρχείο πριν το `git add`.
- **ZERO-TOL, χωρίς κλειστό σύνολο εξαιρέσεων**: endpoint εκτός συνόρου δεν είναι «εξαίρεση με
  λόγο» αλλά δεύτερη αρχιτεκτονική — αλλάζει **με τροποποίηση αυτού του ADR**, όχι με γραμμή σε JSON.

📘 `docs/gates/3.90.md`

---

## §4. Άγκυρες

| Σουίτα | Τι αποδεικνύει |
|---|---|
| `src/app/api/admin/ai-inbox/.../triage/__tests__/triage-route.test.ts` (9) | Α1 χωρίς συνεδρία 401, 0 εγγραφές · Α2 ρόλος εκτός 403 · Α3 χωρίς MFA 403 · Α4 σώμα με ταυτότητα 400 · Β1 ξένο = «δεν υπάρχει» **πανομοιότυπα** · Β2 bypass 403 · Γ1 ανάθεση στον **επαληθευμένο** καλούντα, στην εταιρεία **του** · Γ2 audit με τον **πραγματικό** ρόλο · Γ3 reject |
| `src/lib/auth/__tests__/with-auth-mfa.test.ts` (3) | Μ1 χωρίς δήλωση καμία αλλαγή · Μ2 με δήλωση 403 · Μ3 ρόλος πριν το MFA |
| `scripts/__tests__/check-server-action-boundary.test.js` | Κ1–Κ6 κριτήριο (θετικά **και** αρνητικά) · Ε1–Ε4 **εκτέλεση** της πύλης σε προσωρινό git |
| `src/services/__tests__/ownership-upstream-guarded.test.ts` | ενημερώθηκε στη νέα υπογραφή (ο ανάντη φύλακας ζει) |

**Μεταλλάξεις 8/8 κόκκινες**:
1. `ADMIN_SURFACE_AUTH.requireMfa: false` ⇒ Α3·
2. χωρίς `.strict()` ⇒ Α4·
3. αποκάλυψη σε όλους ⇒ Β1·
4. παράκαμψη ιδιοκτησίας ⇒ Β1 + Β2·
5. το `withAuth` αγνοεί το `requireMfa` ⇒ Α3·
6. η πύλη: ο πρόλογος δεν σταματά στην πρώτη μη-οδηγία ⇒ Κ5·
7. η πύλη: καμία σάρωση σωμάτων συνάρτησης ⇒ Κ4·
8. η πύλη: χωρίς `--untracked` ⇒ Ε3.

### §4.1 Γιατί ρητός wrapper ρυθμού και όχι `defineRoute`

Η πρώτη γραφή χρησιμοποίησε το `defineRoute` (ADR-602). Η **CHECK 3.78** τη μπλόκαρε:
*«νέα διαδρομή με βαθμίδα κρυμμένη σε εργοστάσιο»*. Ο αναγνώστης του `route.ts` πρέπει να **βλέπει** ποιο
όριο ισχύει. Ακολουθήθηκε η πύλη: `withSensitiveRateLimit(withAuth(handler, ADMIN_SURFACE_AUTH))`, ίδιο
σχήμα με το `workspace-invitations/[invitationId]/revoke`. Τα βοηθήματα φακέλου (`ok` / `notFound` /
`httpError`) και το `safeParseBody` είναι τα **ίδια** SSoT· το `ApiError` αποδίδεται από τον
`apiErrorHandler` του `withAuth`, με την **ίδια** ταξινόμηση (`asApiError`) που χρησιμοποιεί και το
`defineRoute`.

---

## §5. Απορριφθείσες εναλλακτικές

| Εναλλακτική | Γιατί όχι |
|---|---|
| Φύλακας (`requireAdminForPage`) **μέσα** σε κάθε server action — το παράδειγμα της Next.js | Δύο μηχανισμοί endpoint· δεύτερος κατασκευαστής ταυτότητας/κρίση χώρου/rate limit. Και το «το θυμήθηκε κάθε action;» δεν ελέγχεται στατικά. |
| Έλεγχος πάνω στο `companyId` που στέλνει ο πελάτης | Είναι το ίδιο ελάττωμα με άλλο όνομα — ο πελάτης διαλέγει και τη σύγκριση. |
| Διαδρομή API ανάγνωσης με «καθολική όψη» για super_admin | 0/4 χρήστες τη χρειάζονται· το `withAuth` αρνείται ήδη τον άνθρωπο χωρίς εταιρεία ⇒ νεκρή διαδρομή. Αν χρειαστεί: ρητή, με `resolveSuperAdminProjectScope`. |
| Πύλη «κάθε action καλεί τον φύλακα» | Αναποκρίσιμη στατικά ⇒ ψευδώς αρνητικά ή baseline. |
| MFA ως προεπιλογή σε κάθε διαδρομή με ρόλο διαχείρισης | Θα άλλαζε δεκάδες διαδρομές σιωπηλά (π.χ. super_admin χωρίς MFA στην παραγωγή) — σκλήρυνση που σπάει λειτουργία. Opt-in, δηλωμένο. |

---

## §6. ⚠️ Δηλωμένα όρια

1. ✅ **Διαγράφηκαν 2026-09-19 (από τον Giorgio — ο αυτόματος ταξινομητής αρνήθηκε τη διαγραφή στον
   πράκτορα)**: `src/services/communications.service.ts` (μηδέν εισαγωγείς) · `src/ai/flows/contact-follow-up-suggestions.ts`
   · `src/ai/flows/generate-report.ts` · `src/ai/genkit.ts`· αφαιρέθηκε και η γραμμή `"src/ai/**"` του `knip.json`.
   Η CHECK 3.90 ήταν **κόκκινη ακριβώς σε αυτά τα 3 endpoints** μέχρι τη διαγραφή, και **πράσινη** μετά
   (0 οδηγίες, 6 υποψήφια — όλα σχόλια).
2. ✅ **Ζωντανός έλεγχος — ΟΛΟΚΛΗΡΩΘΗΚΕ ΣΤΗΝ ΠΑΡΑΓΩΓΗ (2026-09-20, `nestorconstruct.gr`, commit `b2aaee0f`)**

   **α) Ανώνυμος καλών** (`curl`, με `User-Agent`) — η πρόβλεψη του dev ελέγχου **επαληθεύτηκε**:

   | Αίτημα | Απάντηση | Σώμα |
   |---|---|---|
   | `POST …/triage` χωρίς συνεδρία | **401** | `UNAUTHORIZED` · `reason: missing_token` |
   | ίδιο με ψεύτικο `Bearer` | **401** | `UNAUTHORIZED` · `reason: invalid_token` |
   | `GET …/triage` | **405** | — (εξάγεται **μόνο** `POST`) |

   🔑 Στην παραγωγή έρχεται **401**, όχι το 403 `MFA_REQUIRED` του dev: επιβεβαιώνεται ότι το
   `buildRequestContext` **δεν** κατασκευάζει ταυτότητα εκτός `development` (ADR-821). Η πόρτα MFA είναι
   **δεύτερη** γραμμή, όχι η μόνη.

   **β) Με πραγματική συνεδρία `super_admin` + MFA** (κονσόλα του browser στο
   `https://nestorconstruct.gr/admin/ai-inbox`, το οποίο απέδωσε «● Live» με **0/0/0/0**).
   Και οι δύο αποφάσεις, **μηδέν εγγραφές by design** — ο έλεγχος ιδιοκτησίας προηγείται κάθε εγγραφής
   στην `openOwnedCommunication`:

   | Αίτημα | Αναμ. | Ελήφθη | Τι αποδεικνύει |
   |---|---|---|---|
   | `{decision:'approve'}` σε ανύπαρκτο id | 404 | ✅ **404** `Communication not found` | ύπαρξη **πριν** ιδιοκτησία |
   | `{decision:'reject'}` σε ανύπαρκτο id | 404 | ✅ **404** ίδιο μήνυμα | **και οι δύο** κλάδοι στην ίδια `openOwnedCommunication` |
   | `{decision:'approve'}` σε `msg_019fa196…` (**χωρίς `companyId`**) | 403 | ✅ **403** `Communication is outside your company` | «χωρίς μισθωτή ⇒ κανενός» (`isPayloadOwnedByCompany`) **και** `concealCrossTenant` → ο bypass ρόλος παίρνει την **ειλικρινή** άρνηση (ADR-742) |
   | `{decision:'reject'}` στο ίδιο | 403 | ✅ **403** ίδιο | — |
   | `{decision:'approve', companyId:'x'}` | 400 | ✅ **400** `Unrecognized key(s) in object: 'companyId'` | το `.strict()` **λέει** ότι η ταυτότητα δεν ανήκει στο συμβόλαιο — δεν την αγνοεί σιωπηλά |
   | `{decision:'nuke'}` | 400 | ✅ **400** `Expected 'approve' \| 'reject'` | κλειστό λεξιλόγιο απόφασης |
   | σώμα `not-json` | 400 | ✅ **400** `Expected object, received null` | μη-JSON ⇒ 400, **όχι 500** |
   | `POST /admin/ai-inbox` με `Next-Action` | — | ✅ **404** `Server action not found.` | η σελίδα **δεν έχει πια** server action· το CHECK 3.90 το φυλάει στατικά, η παραγωγή το επιβεβαιώνει |

   **γ) Απόδειξη μηδενικής εγγραφής** (Firestore MCP, πριν/μετά):
   `messages/msg_019fa196…` → `updatedAt` **αμετάβλητο** (`1788627607.893`), κανένα `triageStatus`, κανένα
   `linkedTaskId` · `tasks` → **0 → 0** έγγραφα. Οι 403/404 **δεν έγραψαν τίποτα**.

   ⏳ **Δεν δοκιμάστηκε η ΕΠΙΤΥΧΗΣ έγκριση** (θα απαιτούσε δοκιμαστικό μήνυμα με `triageStatus: 'pending'`
   στην εταιρεία του Giorgio και θα γεννούσε **πραγματική** εργασία CRM): μετρημένα **0 / 46** μηνύματα
   έχουν `triageStatus`, όλα εξερχόμενες ειδοποιήσεις **χωρίς `companyId`**. Η ιδιοτροπία (idempotency)
   καλύπτεται από τις άγκυρες `triage-route.test.ts`, όχι ζωντανά.

   **δ) Ιστορικό — ο ΜΕΡΙΚΟΣ έλεγχος του dev server (2026-09-19, `localhost:3000`, Next 15.5.22)**:
   - ✅ POST **χωρίς καμία συνεδρία** ⇒ **403 `MFA_REQUIRED`**, ΟΧΙ 401 — και αυτό είναι το σημαντικότερο εύρημα:
     σε `NODE_ENV=development` το `buildRequestContext` **κατασκευάζει** ταυτότητα (`company_admin`,
     `mfaEnrolled: false`, ADR-821). Χωρίς την πόρτα MFA ένα **ανώνυμο** `curl` στον dev server θα περνούσε το
     ταβάνι ρόλου. Στην παραγωγή η κατασκευή αρνείται (`NODE_ENV` αυστηρό) ⇒ 401.
   - ✅ Ίδιο αίτημα με `adminUid`/`companyId` στο σώμα ⇒ ίδια άρνηση **πριν** καν διαβαστεί το σώμα.
   - ✅ Ψεύτικο `Bearer` ⇒ **401 `UNAUTHORIZED` (`invalid_token`)**.
   - ⚠️ Ο dev server απαντά **403 χωρίς σώμα** σε αιτήματα **χωρίς `User-Agent`** (φίλτρο bot του
     `src/middleware.ts`) — γι' αυτό ο πρώτος έλεγχος έμοιαζε «όχι δικός μας server».
   - ⏳ Δεν επαληθεύτηκε τότε με πραγματική συνεδρία διαχειριστή (ο Chrome του πράκτορα επέστρεφε σε
     «Νέα καρτέλα» σε κάθε πλοήγηση στο `localhost:3000`) — **έκλεισε στην παραγωγή, βλ. (β) παραπάνω**.
3. Το κλειδί `aiInbox.loadFailedWithErrorId` έμεινε **ορφανό** (ο κλάδος φόρτωσης μέσω server
   αφαιρέθηκε). Δεν αφαιρέθηκε, για να μην τρέξουν οι γεννήτορες 3.33/3.34 πάνω σε κλειδιά άλλου agent.
4. Το μήνυμα `'Live data is already up-to-date!'` του hook είναι προϋπάρχον hardcoded κείμενο (N.11)·
   δεν αγγίχτηκε.
5. Η `ownership-callsite-coverage-anchor` είναι **ήδη κόκκινη στο HEAD** για 3 αρχεία που **δεν**
   αγγίχτηκαν εδώ (`lib/agency/showcase-canonical-segment.ts` · `lib/mandate/attestation-document-verdict.ts`
   · `server/auth/workspace-invitation.ts`).

---

## §7. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-20 | **Ζωντανή επαλήθευση ΠΑΡΑΓΩΓΗΣ — το ADR κλείνει** (§6 #2 α/β/γ). Ανώνυμος ⇒ **401** (`missing_token` / `invalid_token`), `GET` ⇒ **405**· με πραγματική συνεδρία `super_admin`+MFA: ανύπαρκτο id ⇒ **404** *και* στο approve *και* στο reject· `msg_019fa196…` (χωρίς `companyId`) ⇒ **403** ειλικρινής άρνηση (`concealCrossTenant` + bypass ρόλος)· `companyId` στο σώμα ⇒ **400** `Unrecognized key(s)` (`.strict()`)· άκυρη απόφαση ⇒ **400**· μη-JSON ⇒ **400** (όχι 500)· `Next-Action` στη σελίδα ⇒ **404 «Server action not found»**. **Μηδέν εγγραφές αποδεδειγμένες**: `updatedAt` του μηνύματος αμετάβλητο, `tasks` 0 → 0. Το 403 `MFA_REQUIRED` του dev **δεν** εμφανίζεται στην παραγωγή ⇒ επιβεβαιώνεται ότι η κατασκευασμένη ταυτότητα του ADR-821 μένει στο `development`. |
| 2026-09-19 | **Διαγραφή των 4 νεκρών αρχείων** (§6 #1) + `knip.json` — CHECK 3.90 κόκκινη → **πράσινη**. |
| 2026-09-19 | **Δημιουργία + υλοποίηση.** Διαδρομή `POST /api/admin/ai-inbox/communications/[id]/triage` (`withSensitiveRateLimit(withAuth(…, ADMIN_SURFACE_AUTH))`)· `withAuth({ requireMfa })` + `createMfaRequiredResponse`· triage υπηρεσία `server-only` με `actor: AuthContext` και audit με τον πραγματικό καλούντα· hook μόνο realtime + `apiClient`· η σελίδα στενεύει σε `AIInboxAdminContext`· `server-only` στο `AssignmentPolicyRepository`· καμία οδηγία στο `contracts.ts`· **CHECK 3.90**. Κλείνει το ADR-777 §8.60.20.9 #12. |
