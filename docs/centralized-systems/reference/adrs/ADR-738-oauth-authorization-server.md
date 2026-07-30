# ADR-738: OAuth 2.1 Authorization Server — ο Νέστωρ εκδίδει τα δικά του tokens

**Κατάσταση:** ACCEPTED — υλοποιημένο (2026-07-31)
**Σχετικά:** ADR-734 (Agent Capability Layer, Φάση 3β), ADR-657 (auth claims), ADR-294 (SSoT ratchet)

---

## 1. Σκοπός

Ο Νέστωρ εκθέτει MCP endpoint (ADR-734 Φάση 3β). Οι εξωτερικοί MCP clients —
Claude Desktop, Cursor, VS Code — **δεν** στέλνουν Firebase ID tokens: ζητούν
πρόσβαση μέσω **OAuth 2.1** με discovery. Αυτό το ADR περιγράφει τον
authorization server που καλύπτει το κενό, και **γιατί** δεν αγοράστηκε έτοιμος.

---

## 2. Το ερώτημα που τέθηκε λάθος

Το handoff της Φάσης 3α έθεσε τρεις δρόμους: (Α) μόνο bearer Firebase token,
(Β) «πλήρες OAuth 2.1 authorization server — σημαντικά μεγαλύτερο εγχείρημα»,
(Γ) τοπικό stdio bridge. Το Β παρουσιάστηκε ως συνολικό πακέτο τεράστιου
κόστους, και γι' αυτό συνιστήθηκε το Α.

**Η έρευνα στο πρότυπο 2025-11-25 έδειξε ότι το πακέτο δεν υπάρχει.** Το ίδιο
το spec διαχωρίζει τους ρόλους:

> «A protected *MCP server* acts as an OAuth 2.1 **resource server**… The
> *authorization server* is responsible for interacting with the user and issuing
> access tokens. **The implementation details of the authorization server are
> beyond the scope of this specification.** It may be hosted with the resource
> server or a separate entity.»

Οι υποχρεώσεις του **MCP server** είναι τέσσερις, και μόνο:

| # | Απαίτηση | Πηγή |
|---|---|---|
| 1 | **MUST** Protected Resource Metadata με `authorization_servers` | RFC 9728 |
| 2 | **MUST** `401` + `WWW-Authenticate` με `resource_metadata` (**SHOULD** `scope`) | RFC 9728 §5.1 |
| 3 | **MUST** επικύρωση token **με δέσμευση ακροατηρίου** | RFC 8707 |
| 4 | **MUST NOT** token passthrough προς upstream | §Confused Deputy |

Επιπλέον, το **DCR υποβαθμίστηκε σε `MAY`** («included for backwards
compatibility») και το **CIMD ανέβηκε σε `SHOULD`**. Το handoff περιέγραφε το
DCR ως απαίτηση — δεν είναι πλέον.

---

## 3. Τι κάνουν οι μεγάλοι παίκτες (Ιούλιος 2026)

| Παίκτης | Πρακτική |
|---|---|
| **Autodesk** | Πήγε στην επιτροπή MCP και **αντικατέστησε το DCR με CIMD**: σταθερά client IDs δεμένα σε domain, «όπως διαχειρίζονται εμπιστοσύνη οι μεγάλοι οργανισμοί». Πέρασε στο spec τον Νοέμβριο 2025. Ταυτοποίηση: **δικός τους** AS (Autodesk ID, 3LO). |
| **Figma** | OAuth **υποχρεωτικό**· Personal Access Tokens **ρητά απαγορευμένα**· allowlist clients από κατάλογο. Δικός τους AS: `figma.com/oauth/mcp`. |
| **WorkOS / Stytch** | Πουλάνε τον AS ως ξεχωριστό προϊόν· ο MCP server κρατά **μόνο** PRM + επικύρωση token. |

**Κοινό σχήμα:** ο AS είναι στρώμα **πάνω από την υπάρχουσα ταυτότητα**, όχι
δεύτερη ταυτότητα.

---

## 4. Απόφαση

**Δικός μας AS πάνω στο Firebase** (απόφαση Γιώργου, 2026-07-31).

```
Firebase Auth  →  ΠΟΙΟΣ ΕΙΣΑΙ            (η SSoT ταυτότητας παραμένει ΜΙΑ)
δικός μας AS   →  ΤΙ ΕΠΙΤΡΕΠΕΙΣ σε ΑΥΤΟΝ τον πράκτορα, και για πόσο
```

**Γιατί όχι managed πάροχος (WorkOS/Stytch):** θα έμπαινε **δεύτερος πάροχος
ταυτότητας** δίπλα στο Firebase — το γνωστό «δύο λεξιλόγια» του έργου (βλ. §7)
— συν κόστος συνδρομής και εξωτερική εξάρτηση σε production που τρέχει σε
Netcup δωρεάν επίπεδο.

**Γιατί όχι μόνο bearer (δρόμος Α):** θα ήταν «HTTP endpoint σε μορφή MCP», όχι
MCP server. Κανένας εξωτερικός client δεν θα συνδεόταν — δηλαδή το παραδοτέο
δεν θα εξυπηρετούσε τον σκοπό του.

### 4.1 Ροή

```
1. client → GET /api/mcp χωρίς token
2.        ← 401 + WWW-Authenticate: Bearer resource_metadata="…", scope="boq:read"
3. client → GET /.well-known/oauth-protected-resource     (RFC 9728)
4. client → GET /.well-known/oauth-authorization-server   (RFC 8414)
5. client → /api/oauth/authorize?client_id=<HTTPS URL>&code_challenge=…&resource=…
              ├─ CIMD fetch + επικύρωση (μέσω outbound-url-guard)
              ├─ χωρίς __session → /login?next=… → επιστροφή
              ├─ υπάρχει συγκατάθεση που καλύπτει τα scopes → σιωπηλή έγκριση
              └─ αλλιώς → οθόνη συγκατάθεσης
6.        ← code (60s, μιας χρήσης)
7. client → POST /api/oauth/token (code + code_verifier + resource)
8.        ← access token (aud = canonical URI του /api/mcp) + refresh
9. client → POST /api/mcp με Bearer — JSON-RPC 2.0
```

### 4.2 Πολιτική εμπιστοσύνης clients

Το πρότυπο επιτρέπει «allowlist trusted domains» **ή** «accept any HTTPS
client_id». Η Figma διάλεξε κλειστό κατάλογο — που αποκλείει κάθε νέο εργαλείο
μέχρι να το εγκρίνει η ίδια. Εδώ επιλέχθηκε το **ενδιάμεσο**:

- **κάθε** HTTPS `client_id` γίνεται δεκτό·
- όσα δεν είναι σε γνωστό domain **σημαίνονται στην οθόνη** ως άγνωστα, με το
  hostname τους μπροστά στα μάτια του χρήστη.

Η απόφαση μένει στον άνθρωπο **με πληροφορία**, αντί να λαμβάνεται σιωπηλά από
κατάλογο που δεν ελέγχει.

---

## 5. Αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `lib/security/outbound-url-guard.ts` | **ΝΕΟ SSoT** — άμυνα SSRF για κάθε fetch σε URL τρίτου |
| `lib/oauth/oauth-config.ts` | **ΝΕΟ SSoT** — issuer, scopes, TTL, PKCE, canonical audience, familiar domains |
| `lib/oauth/oauth-doc-guards.ts` | **ΝΕΟ SSoT** — «έχει λήξει;» για κάθε βραχύβιο έγγραφο |
| `lib/oauth/client-id-metadata.ts` | CIMD fetch + επικύρωση + redirect matching |
| `lib/oauth/oauth-authorization-code.ts` | codes + PKCE S256 + μιας χρήσης |
| `lib/oauth/oauth-token-store.ts` | opaque tokens, rotation, ανίχνευση επαναχρησιμοποίησης |
| `lib/oauth/oauth-consent-store.ts` | οι αποφάσεις του ανθρώπου |
| `lib/oauth/authorize-request.ts` | επικύρωση αιτήματος (fatal vs redirectable) |
| `lib/oauth/authorize-request-store.ts` | παγωμένο αίτημα μεταξύ GET και POST |
| `app/api/oauth/{authorize,token,consent-request,consents}/route.ts` | τα endpoints |
| `app/api/oauth/metadata/{protected-resource,authorization-server}/route.ts` | discovery (rewrites στο `next.config.js`) |
| `app/(auth)/oauth/consent/page.tsx` + `components/oauth/OAuthConsentCard.tsx` | η οθόνη |
| `firestore.rules` | **deny-all** στις 5 συλλογές OAuth |

### 5.1 Πέντε αποφάσεις που ξεπερνούν το ελάχιστο

| # | Απόφαση | Γιατί |
|---|---|---|
| 1 | **Opaque tokens, όχι JWT** | Το πρότυπο δεν απαιτεί JWT (RFC 9068 = *παράδειγμα*). Το ζητούμενο είναι **άμεση ανάκληση**· με JWT θα χρειαζόταν λίστα ανάκλησης — ίδια ανάγνωση, συν διαχείριση κλειδιών και JWKS |
| 2 | **Το doc id ΕΙΝΑΙ το SHA-256 του μυστικού** | Ωμό μυστικό δεν γράφεται ποτέ· η αναζήτηση γίνεται O(1) χωρίς index· διαρροή αντιγράφου δίνει hashes |
| 3 | **Το αίτημα ΠΑΓΩΝΕΙ πριν την οθόνη** | Κρυφά πεδία φόρμας σημαίνουν ότι ό,τι *βλέπει* ο χρήστης δεν είναι ό,τι *εγκρίνει* — και ανοίγουν CSRF |
| 4 | **Ταυτότητα παγωμένη στο token** | Το token σημαίνει «αυτό που ενέκρινε ο χρήστης **τότε**». Αλλιώς μελλοντική αναβάθμιση ρόλου διευρύνει **αναδρομικά** την εξουσία πράκτορα |
| 5 | **Replay ⇒ πέφτει η ΟΙΚΟΓΕΝΕΙΑ** | Επανάληψη code ή refresh = σήμα κλοπής. Σιωπηλή απόρριψη αφήνει τον κλέφτη με λειτουργικό token από την πρώτη, επιτυχή χρήση |

---

## 6. Ανάκληση

`GET /api/oauth/consents` → η λίστα· `DELETE ?consentId=…` → η ανάκληση.

**Η σειρά είναι απόφαση:** πρώτα η συγκατάθεση (κόβει κάθε *μελλοντική* έκδοση),
μετά τα tokens (κόβουν την *τρέχουσα* πρόσβαση). Με την αντίστροφη σειρά υπάρχει
παράθυρο όπου μια ανανέωση γεννά καινούργια tokens.

---

## 7. ⚠️ Παγίδες που εντοπίστηκαν στον κώδικα

### 7.1 Το bot-blocking του Edge έκοβε τα πάντα

Το `src/middleware.ts` μπλοκάρει user-agents `node-fetch`, `axios/`,
`go-http-client`, `python-requests`, `curl/` με **403 στο Edge** — ακριβώς τους
user-agents κάθε MCP client και κάθε δοκιμής με curl. Χωρίς εξαίρεση, το
endpoint θα απαντούσε 403 **πριν τρέξει μία γραμμή του κώδικά του**, και το
σφάλμα θα έμοιαζε με «λάθος διαπιστευτήρια».

Λύση: επέκταση του υπάρχοντος μοτίβου `isWebhook` → `isMachineEndpoint`.

### 7.2 Δύο λεξιλόγια ρόλων

Το `isAdminRole()` του `lib/auth/security-policy.ts` ελέγχει
`['admin','broker','builder']` — **παλαιότερο** σύστημα. Τα `GLOBAL_ROLES` των
Firebase claims είναι `super_admin` / `company_admin` / … Ένα
`isAdminRole('company_admin')` επιστρέφει **`false`**, δηλαδή θα έκλεινε σιωπηλά
την πρόσβαση σε κάθε διαχειριστή εταιρείας. Ο έλεγχος γράφτηκε ρητά στο
`mcp-identity.ts`, με σχόλιο που απαγορεύει τη χρήση του `isAdminRole` εκεί.

### 7.3 Γιατί ο OAuth resolver ΔΕΝ μπήκε στο `buildRequestContext()`

Ο προφανής δρόμος ήταν να μάθει το κεντρικό `buildRequestContext()` να δέχεται
και OAuth tokens. **Θα ήταν σοβαρό σφάλμα:** κάθε route του `src/app/api/`
περνά από εκεί, οπότε token εγκεκριμένο για `boq:read` θα γινόταν δεκτό και στο
`/api/admin/*` — η παραβίαση που το πρότυπο ονομάζει «fundamental OAuth security
boundary». Ο resolver ζει στο **ένα** path που έχει ακροατήριο.

### 7.4 Το `NODE_ENV=development` bypass

Το `buildRequestContext()` παρακάμπτει auth σε development **όταν δεν βρει
διαπιστευτήρια**. Ο `resolveMcpIdentity` το καλεί **μόνο όταν υπάρχει Bearer
token** — αλλιώς το MCP endpoint θα ήταν τοπικά ορθάνοιχτο και τα tests θα
περνούσαν πράσινα χωρίς να ελέγχουν τίποτα. Υπάρχει test.

### 7.5 Το CIMD δεν λύνει το `localhost`

Το ίδιο το πρότυπο: «Client ID Metadata Documents cannot prevent `localhost`
URL impersonation by themselves.» Κακόβουλο πρόγραμμα δηλώνει το **νόμιμο**
`client_id`, δεσμεύει τοπικό port και εισπράττει τον code — ο χρήστης βλέπει το
νόμιμο όνομα. Η τεχνική άμυνα σταματά εκεί· η επόμενη είναι **η οθόνη**, που
δείχνει ρητά hostname redirect και προειδοποιεί σε loopback.

### 7.6 Port matching σε loopback

Ακριβής σύγκριση redirect URI — **εκτός από το port σε loopback** (RFC 8252
§7.3). Ένας native client δεσμεύει **τυχαίο** ελεύθερο port τη στιγμή της
σύνδεσης και δεν μπορεί να το ξέρει όταν δημοσιεύει το CIMD. Χωρίς την εξαίρεση
ο Claude Desktop θα αποτύγχανε κάθε φορά — και η βιαστική «διόρθωση» (prefix
matching) θα άνοιγε πραγματική τρύπα σε **όλα** τα redirect URIs. Υπάρχουν tests
και για τα δύο.

### 7.7 Γνωστό όριο — TOCTOU στον SSRF guard

Ο `outbound-url-guard` λύνει το DNS και ελέγχει **όλες** τις διευθύνσεις, και
δεν ακολουθεί ανακατευθύνσεις. Παραμένει παράθυρο χιλιοστών μεταξύ ανάλυσης και
σύνδεσης (DNS rebinding). Πλήρες κλείσιμο απαιτεί custom dispatcher με `lookup`
hook· το `undici` **δεν** είναι άμεση εξάρτηση. Πρακτικό αντίμετρο: ο μοναδικός
καταναλωτής είναι το CIMD fetch, όπου το σώμα **δεν** επιστρέφεται ποτέ στον
καλούντα — μόνο επικυρωμένα πεδία. Καταγράφεται αντί να αποσιωπηθεί.

---

## 8. Επαλήθευση

**Tests:** 8 νέα suites, **185 νέα tests** (σύνολο `agent-capability` +
`lib/oauth` + `lib/security`: 357 πράσινα).

**16 σκόπιμες μεταλλάξεις, 16 σκοτώθηκαν** (πήχης ADR-734: Φ1=3, Φ2=6, Φ3α=8):

| # | Μετάλλαξη | Κόκκινα |
|---|---|---|
| 1 | αφαίρεση ελέγχου scope στο MCP σύνορο | 1 |
| 2 | fallback σε Firebase **και** σε `audience_mismatch` | 4 |
| 3 | αφαίρεση ελέγχου ακροατηρίου στο token store | 1 |
| 4 | reuse detection χωρίς ανάκληση οικογένειας | 1 |
| 5 | αποδοχή `plain` PKCE | 1 |
| 6 | authorization code επαναχρησιμοποιήσιμος | 3 |
| 7 | loopback επιτρεπτό στον SSRF guard | 3 |
| 8 | έλεγχος μόνο της **πρώτης** διεύθυνσης DNS | 1 |
| 9 | `Origin` χωρίς έλεγχο | 4 |
| 10 | απουσία έκδοσης ⇒ σφάλμα αντί υπονοούμενης | 1 |
| 11 | prefix matching σε `redirect_uri` | 1 |
| 12 | χωρίς έλεγχο `client_id` ↔ URL | 1 |
| 13 | `redirect_uri` mismatch → redirectable (**open redirect**) | 1 |
| 14 | `resource` ξένου server γίνεται δεκτό | 1 |
| 15 | αστοχία εργαλείου → JSON-RPC error αντί `isError` | 1 |
| 16 | απόκριση client ως κλήση μεθόδου | 2 |

**CHECK 3.28 (jscpd):** έπιασε **πραγματικό** δίδυμο — η ανάλυση `resource`
ήταν γραμμένη δύο φορές (`authorize-request.ts` και `token/route.ts`).
Κεντρικοποιήθηκε σε `resolveRequestedAudience()` στο `oauth-config.ts`. Δεύτερη
εκτέλεση: καθαρό σε 21 αρχεία.

**Δεν εκτελέστηκε `tsc`** (N.17) — ο έλεγχος τύπων γίνεται από τον Γιώργο και το
pre-commit hook.

---

## 9. Google-Level (N.7.2)

| # | Ερώτημα | Απάντηση |
|---|---|---|
| 1 | Proactive ή reactive; | **Proactive** — η συγκατάθεση καταγράφεται τη στιγμή της απόφασης, όχι ως παρενέργεια |
| 2 | Race condition; | **Όχι** — code και εκκρεμές αίτημα καταναλώνονται σε `runTransaction` |
| 3 | Idempotent; | **Ναι** — ανάκληση δύο φορές = ίδιο αποτέλεσμα |
| 4 | Belt-and-suspenders; | **Ναι** — Origin + audience + scope + `registry.policy` + Firestore rules |
| 5 | SSoT; | **Ναι** — ένα `oauth-config`, ένας κανόνας audience, ένα registry BOQ (εξήχθη, §5) |
| 6 | Await ή fire-and-forget; | **Await** παντού — ορθότητα |
| 7 | Ποιος κατέχει τον κύκλο ζωής; | **Ρητά**: ο AS τα διαπιστευτήρια, το registry την εκτέλεση |

**✅ Google-level: ΝΑΙ** — υλοποιεί τις κανονιστικές απαιτήσεις του προτύπου
χωρίς έκπτωση, προσθέτει τρία μέτρα πέρα από το ελάχιστο (ανίχνευση
επαναχρησιμοποίησης, παγωμένο αίτημα, SSRF guard), και κάθε ισχυρισμός
ασφαλείας συνοδεύεται από μετάλλαξη που αποδεικνύει ότι το test τον πιάνει.

---

## 10. Τι ΔΕΝ έγινε

- ❌ **Καμία οθόνη διαχείρισης** στο UI — υπάρχει το API (`/api/oauth/consents`),
  όχι σελίδα. Επόμενο βήμα, χαμηλού ρίσκου.
- ❌ **Καμία αυτόματη εκκαθάριση** ληγμένων εγγράφων. Τα ληγμένα απορρίπτονται
  σωστά κατά την ανάγνωση· η *διαγραφή* τους θέλει TTL policy ή cron.
- ❌ **Κανένα `client_secret`** — οι MCP clients είναι public clients (§Token endpoint).
- ❌ **Καμία υποστήριξη DCR** (`registration_endpoint` δεν δηλώνεται).
- ❌ **Δεν άνοιξε** το `WRITE_CAPABILITIES_ENABLED` (ADR-734 Φάση 4).

---

## 11. Πηγές

- [MCP Authorization — spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707.html)
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 8252 — OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252)
- [OAuth Client ID Metadata Document (draft-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00)
- [How Autodesk helped make MCP enterprise-ready](https://adsknews.autodesk.com/en/views/how-autodesk-helped-make-the-model-context-protocol-enterprise-ready/)
- [Figma — Set up the remote MCP server](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)

---

## 12. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-31 | **Δημιουργία + υλοποίηση.** OAuth 2.1 AS πάνω στο Firebase, ως στρώμα εξουσιοδότησης και **όχι** δεύτερη ταυτότητα. Το §3.1 του handoff της Φάσης 3α ήταν **ψευδοδίλημμα**: το πρότυπο αφήνει τον AS εκτός εμβέλειας και το DCR είναι πλέον `MAY` — διορθώθηκε στο §2. CIMD αντί DCR (η γραμμή της Autodesk). 16/16 μεταλλάξεις σκοτώθηκαν· το CHECK 3.28 έπιασε πραγματικό δίδυμο στην ανάλυση `resource`, που κεντρικοποιήθηκε. Κατάσταση: **ACCEPTED — σε κώδικα.** |
