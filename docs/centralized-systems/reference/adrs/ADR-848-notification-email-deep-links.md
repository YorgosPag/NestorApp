# ADR-848 — **ΤΟ EMAIL ΕΙΔΟΠΟΙΗΣΗΣ ΟΔΗΓΕΙ ΚΑΠΟΥ: ΜΟΝΙΜΟΣ ΣΥΝΔΕΣΜΟΣ, ΕΠΙΣΤΡΟΦΗ ΜΕΤΑ ΤΗ ΣΥΝΔΕΣΗ, ΔΙΑΓΡΑΦΗ ΕΝΟΣ ΚΛΙΚ**

> **Κατάσταση**: 🟢 Υλοποιημένο *(2026-09-10)* · §6α *(2026-09-11, δεδομένα στοιχισμένα)* · ✅ πρώτη ζωντανή αποστολή 2026-09-10 (ADR-849 §6γ) · 🔶 ζωντανό κλικ του §6α εκκρεμεί (§9 #8)
> **Πηγή**: στιγμιότυπο Giorgio 2026-09-10 — «2 νέες ειδοποιήσεις — ΝΕΣΤΩΡ», δύο γραμμές, **κανένας σύνδεσμος**
> **Σχετικά**: ADR-777 §8.23–§8.54 *(ο αγωγός email)* · ADR-841 Α18 *(ο προορισμός της ειδοποίησης)* · ADR-787 *(χώρος)* · ADR-744 *(route slices)* · ADR-819 *(διεύθυνση χώρου)*

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ, ΣΕ ΜΙΑ ΠΡΟΤΑΣΗ

> **Το email έλεγε «νέα αγγελία ταιριάζει στη ζήτησή σας» και ο άνθρωπος έπρεπε να ανοίξει
> μόνος του την εφαρμογή και να την ψάξει — ενώ ο σύνδεσμος υπήρχε ήδη, μέσα στη βάση.**

### 1.1 Η μετρημένη ρίζα — **πέντε** ανεξάρτητα κενά

| # | Κενό | Απόδειξη |
|---|---|---|
| 1 | Ο προορισμός **χανόταν** στον orchestrator | `notification-orchestrator.ts:292-315` — στο `queueNotificationEmail` περνούσαν `subject/content/entityId/entityType`, **όχι** `actions`. Το `EmailLegRequest` / `EnqueueMessageParams` / `PendingEmail` δεν είχαν καν πεδίο |
| 2 | Τα **μεμονωμένα** email ήταν **μόνο απλό κείμενο** | `outbound-email-flush.job.ts` `deliverOne` — κανένα `html` |
| 3 | Η **σύνοψη** είχε HTML **χωρίς κανένα `<a>`** | `email-digest.ts` `digestHtml` |
| 4 | **Καμία** διαγραφή από τη λίστα | 0 εμφανίσεις `List-Unsubscribe` στο `src/`· οι πάροχοι **δεν περνούσαν** δικές μας κεφαλίδες |
| 5 | Η σύνδεση **πετούσε** τον προορισμό | `[...unprefixed]` · `o/[workspace]/layout.tsx` · `ProtectedRoute` ⇒ σκέτο `/login`· η σελίδα login δεν διάβαζε `next` |

🔴 **Κανένα από τα πέντε δεν ήταν δηλωμένο** — ούτε στο ADR-777 §8.23.8 («τι ΔΕΝ έγινε») ούτε
στο ADR-841 Α18 (που έδωσε προορισμό στις ειδοποιήσεις **μόνο** για το κουδούνι). Τυφλό σημείο,
όχι αναβολή.

---

## 2. 🏆 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ — ΚΑΙ ΠΟΥ ΠΑΜΕ ΠΙΟ ΠΕΡΑ *(έρευνα με πηγές, 2026-09-10)*

| Θέμα | Πρακτική (πηγή) | Εδώ |
|---|---|---|
| Σύνδεσμος ανά γραμμή | GitHub/Figma: κάθε στοιχείο → **το δικό του** αντικείμενο | Ο **τίτλος** κάθε γραμμής είναι ο σύνδεσμος (WebAIM: ποτέ «πάτα εδώ») |
| Επίλυση τη στιγμή του κλικ | Slack `app_redirect` | **`/n/{id}`**: ο προορισμός διαβάζεται από την ειδοποίηση **όταν πατηθεί** — παλιό email δεν σπάει όταν αλλάξουν οι διαδρομές |
| «Διαβάστηκε» | GitHub: pixel — πλέον αναξιόπιστο (Apple MPP ≈ μισά «ανοίγματα» ψευδή) | Γράφεται στο **κλικ ανθρώπου με συνεδρία**· σαρωτής χωρίς cookie ⇒ σύνδεση ⇒ **καμία εγγραφή** |
| Επιστροφή μετά τη σύνδεση | Devise/Auth0: μόνο διαδρομή ίδιου origin (OWASP Unvalidated Redirects) | `?next=` με φρουρό που κρίνει **ο αναλυτής URL**, όχι regex |
| Ξένο / ανύπαρκτο | — | **Ίδια** απάντηση (δόγμα Ε-5 §4) — καμία απαρίθμηση |
| Διαγραφή | Gmail/Yahoo 2024+: `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058), εκτέλεση ≤2 ημέρες· οι ειδοποιήσεις είναι «subscription messages» | Και οι δύο κεφαλίδες· **μόνο POST** — οι σαρωτές (Safe Links) πατούν κάθε GET |
| «Λιγότερα, όχι κανένα» | Medium/LinkedIn | «Μία σύνοψη την ημέρα» δίπλα στη διακοπή, με **Αναίρεση που επαναφέρει ΑΚΡΙΒΩΣ** (Gmail) |
| Κουμπί | Litmus: table + VML για Outlook · ≥44px (WCAG 2.5.5) · ρητό φόντο (σκοτεινό θέμα) | Ναι |
| Απλό κείμενο | Postmark: πλήρες URL κάτω από κάθε κουμπί | Ναι |
| UTM / Gmail Go-To Actions | Δεν μπαίνουν σε ειδοποιήσεις· η Google εγκρίνει Go-To μόνο για πτήσεις/αποστολές | **Απορρίφθηκαν** (§8) |

Πηγές: RFC 8058 · Google «Email sender guidelines» + «Email subscription guidelines» · OWASP
Unvalidated Redirects Cheat Sheet · Microsoft Learn «Safe Links» · Mailgun Send API (`h:` headers) ·
Litmus «Bulletproof buttons» / «Dark mode» · WebAIM «Link text» · Postmark «Transactional email best practices».

---

## 3. Η ΑΠΟΦΑΣΗ — Η ΡΟΗ

```
παραγωγός ─actions[0].url─▶ orchestrator ─(notificationId ΜΟΝΟ αν υπάρχει προορισμός)─▶ email leg
                                                                                          │ ουρά: metadata.{notificationId, recipientId}
outbound-email-flush ─▶ liveEmailLinks() ─▶ planEmailDelivery(…, links) · soloEnvelope(…, links)
                                            └─▶ αλυσίδα Resend→Mailgun (ΙΔΙΕΣ κεφαλίδες και στους δύο)
κλικ ─▶ /n/{id} ─(χωρίς συνεδρία)─▶ /login?next=/n/{id} ─▶ πίσω
               ├─(δική σου)──▶ seen + openedVia:'email' ─▶ /o/<χώρος><προορισμός>
               └─(ξένη/ανύπαρκτη)─▶ «Η ειδοποίηση δεν είναι διαθέσιμη»
υποσέλιδο ─▶ /email/preferences/<token>  (GET = μόνο ανάγνωση)
κεφαλίδα / κουμπιά ─▶ POST /api/notifications/email/subscription?t=<token> ─▶ transaction ─▶ {previous, current}
```

**Ιδιοκτησία (N.7.2 #7)**: ο **παραγωγός** κατέχει τον προορισμό (ADR-841 Α18)· η **ειδοποίηση**
τον αποθηκεύει· ο **αποστολέας** φτιάχνει τον φάκελο — ίδιο δόγμα με το `brandedSubject` (§8.54).
Η ουρά κρατά **γεγονότα, ποτέ URL**: μήνυμα που περιμένει το παράθυρο των 20:00 δεν κουβαλά
διεύθυνση που ίσως άλλαξε ως τότε.

---

## 4. ΑΣΦΑΛΕΙΑ — ΤΑ ΣΗΜΕΙΑ ΠΟΥ ΘΑ ΜΠΟΡΟΥΣΑΝ ΝΑ ΣΠΑΣΟΥΝ

| Κίνδυνος | Φρουρός |
|---|---|
| Ανοιχτή ανακατεύθυνση μέσω `?next=` | `safeReturnPath`: μόνο διαδρομή· ο **αναλυτής** κρίνει το origin· απορρίπτει `//`, `/\`, `%2F%2F`, `%5C`, `%09`, σχήματα, χαρακτήρες ελέγχου (`\p{Cc}`), βρόχο στο `/login` |
| Προορισμός από δεδομένα | Το `actions[0].url` περνά **ξανά** τον ίδιο φρουρό στο `/n` |
| Απαρίθμηση ειδοποιήσεων | Ανώνυμος ⇒ σύνδεση **πριν** από κάθε ανάγνωση βάσης· ξένη ≡ ανύπαρκτη |
| Σαρωτές που πατούν GET | Καμία αλλαγή σε GET· one-click μόνο με το **ακριβές** σώμα του RFC (άδειο POST ⇒ 400) |
| Πλαστό token | HMAC με **δικό του** μυστικό (`NOTIFICATION_EMAIL_SECRET`) + πεδίο σκοπού μέσα στην υπογραφή |
| Έγχυση κεφαλίδων | `safeHeaderEntries`: όνομα `[A-Za-z0-9-]`, τιμή χωρίς `\r\n` — **πριν** το δίκτυο, και στους **δύο** παρόχους |
| Edge 403 στο POST του Gmail | `/api/notifications/email/subscription` στο `isMachineEndpoint` του `middleware.ts` + κάδος `WEBHOOK` |
| Διαρροή σε `Referer` / ευρετήρια | `referrer: no-referrer` · `robots: noindex` στις δύο σελίδες |
| Σύνοψη με δύο λογαριασμούς στην ίδια διεύθυνση | **Κανένα** token διαγραφής (`soleRecipientOf`) — ποτέ μαντεψιά |
| Υποχρεωτικά email ασφαλείας | Σύνδεσμος ναι· «διαχείριση» και `List-Unsubscribe` **όχι** — καμία ρύθμιση δεν τα σταματά |

---

## 5. ΥΠΟΒΑΘΜΙΣΗ — ΚΑΘΕ ΑΠΟΥΣΙΑ ΣΒΗΝΕΙ ΜΟΝΟ Ο,ΤΙ ΤΗΣ ΑΝΗΚΕΙ

| Λείπει | Αποτέλεσμα |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Email **χωρίς** συνδέσμους — ποτέ σχετικό URL, ποτέ `localhost` (`publicUrl` ⇒ `null`) |
| `NOTIFICATION_EMAIL_SECRET` | Σύνδεσμοι ειδοποιήσεων **ναι**· διαχείριση/κεφαλίδες **όχι**· ένα `warn` ανά διεργασία· `environment-contract.ts` (βαθμίδα `feature`) |
| Παλιά `pending` έγγραφα (πριν το ADR-848) | **Ακριβώς** το σημερινό email — καμία migration |

---

## 6. ΤΙ ΑΛΛΑΞΕ

**Νέα**: `lib/http/public-origin.ts` · `lib/routes/return-path.ts` · `lib/routes/route-param.ts` ·
`lib/notifications/{notification-permalink-route, email-subscription-routes, email-subscription-contract}.ts` ·
`lib/workspace/workspace-destination.ts` · `server/notifications/{notification-read, notification-permalink,
notification-email-render, notification-email-envelope, email-subscription, user-notification-settings-store}.ts` ·
`services/notifications/email-subscription-token.service.ts` · `app/(auth)/n/[notificationId]/page.tsx` ·
`app/(auth)/email/preferences/[token]/page.tsx` · `app/api/notifications/email/subscription/route.ts` ·
`components/notifications/{NotificationPermalinkUnavailable, EmailPreferencesPanel}.tsx`.

**Αλλαγμένα**: orchestrator (+`hasDestination`, −`loadUserSettings` → store) · email leg (γεγονότα φακέλου) ·
`comms/orchestrator` (τύπος `metadata.email`) · `email-digest.ts` (**μόνο** σχεδιαστής· η απόδοση
μετακόμισε) · `outbound-email-flush.job.ts` (σύνδεσμοι + φάκελος· **500 → 499** γραμμές) ·
`email-provider-chain/-providers/-adapter` (κεφαλίδες) · `email-texts.ts` (`links.*`) ·
`request-origin.ts` (πυρήνας → `public-origin`) · `base-email-template.ts` (βλ. §7) · login (`?next=`
μέσα σε `<Suspense>`, CHECK 3.55) · `[...unprefixed]` (επιστροφή + κοινός βοηθός χώρου) ·
`auth.types` / `useAuthFormState` (`redirectTo: WorkspaceHref`) · `ack/route.ts` (κοινός συγγραφέας) ·
`workspace-scope.ts` (`n`, `email`) · `middleware.ts` · `rate-limit-config.ts` ·
`environment-contract.ts` · `auth.json` el/en · `.i18n-shell-slice.json` (δύο route slices, **μετρημένα**:
493 · 1804 bytes).

---

## 6α. Ο ΧΩΡΟΣ-ΣΤΟΧΟΣ ΤΑΞΙΔΕΥΕΙ ΜΕ ΤΗΝ ΕΙΔΟΠΟΙΗΣΗ — ΚΑΙ ΤΟ ΚΟΥΔΟΥΝΙ ΠΕΡΝΑ ΑΠΟ ΤΗΝ ΙΔΙΑ ΠΟΡΤΑ *(ADR-849 §6δ Β1/Β2, 2026-09-11)*

**Σύμπτωμα**: σύνδεσμος email → `/n/<id>` → `/o/<γραφείο του ΘΕΑΤΗ>/properties/<ακίνητο ΑΛΛΟΥ γραφείου>` ⇒
«Το ακίνητο δεν βρέθηκε». Το `/n/{id}` έβαζε τον χώρο από το **claim του θεατή** (`workspaceOwnerOf`)·
το κουδούνι από την **τρέχουσα διεύθυνση** (το σύνορο `useRouter` προθεματίζει με το ψευδώνυμο της
σελίδας). Και τα δύο: χώρος του θεατή, όχι του γεγονότος.

**Έρευνα (πηγές)**: Slack `app_redirect?team=` (docs.slack.dev/interactivity/deep-linking — ο χώρος
**ρητά** από τον παραγωγό) · Microsoft Teams deep links με `tenantId`
(learn.microsoft.com/…/deep-link-teams) · GitHub Notifications: `repository` + αναφορά οντότητας,
τελικός σύνδεσμος **παράγεται** (docs.github.com/en/rest/activity/notifications). 🏆 **Εδώ και τα δύο**:
ο παραγωγός δηλώνει (Slack/Teams) και το ψευδώνυμο λύνεται **στο κλικ** (GitHub) — γραφείο που
αλλάζει ψευδώνυμο δεν σπάει κανένα παλιό email. Ο χώρος μένει **αίτημα**: τη συμμετοχή την κρίνει ο
φύλακας του `o/[workspace]/layout.tsx`.

| Κομμάτι | Πού |
|---|---|
| Λεξιλόγιο (γραφή + ανάγνωση) | **`lib/notifications/notification-destination.ts`** — `NotificationDestination` · `viewDestination` · `readDestinationWorkspace` (ξανακρίνει· ιδιωτικός χώρος **μόνο** του παραλήπτη) |
| Ο τύπος ως φρουρός | `DispatchRequest = DispatchContent & DispatchDestination`: `actions` **μόνο** μαζί με `workspace` |
| Αποθήκευση | `meta.workspace` (ένωση `WorkspaceRef`) — ⛔ ποτέ `companyId` στην κορυφή (ADR-787 Ε-3 §8) |
| Παραγωγοί | ζήτηση `placeDestination(source, id, holderId)` (ο σαρωτής δηλώνει `holderId`) · ταίριασμα `listingMatchDestination` · εντολές `mandateRequestDestination` / `mandateDecisionDestination` (+ `custodyWorkspace(custodyOf(…))`) · PO · εισερχόμενα email |
| Η μία αρχή | `server/notifications/notification-permalink.ts` → `workspaceDestinationOf(ownerOfWorkspace(target))`· παλιό έγγραφο ⇒ η συμπεριφορά πριν (θεατής) |
| Κουδούνι | `components/notifications/drawer-destination.ts` → **`/n/{id}?via=inapp`** (το ψευδώνυμο το λύνει **μόνο** ο διακομιστής — άγκυρα `Λ2`)· ο σύνδεσμος γράφει «ανοίχτηκε» (`openedVia: 'inapp'`), το `act` **δεν** καλείται — ένας συγγραφέας |
| Ανιχνευτής (Β2) | `notification-destination-{drift,rules}.ts` + `npm run notifications:destination-drift` (ξηρό · `--apply --expect-drift=N`) |
| Επανάληψη | `missing-workspace` — **δεν** μαντεύει χώρο |

**Ανιχνευτής — ξηρό τρέξιμο 2026-09-11** (120 ειδοποιήσεις με σύνδεσμο): **20 αποκλίσεις** — 14 ζήτησης
(**5 λάθος πόρτα** `/offers/prop_*` → `/properties/…` + 9 μόνο χώρος) · 4 ταιριάσματος · 1 απόφασης
εντολής (πόρτα `/offers/…` → `/listings/mandates/…` της Α18.12 + χώρος) · 1 απάντησης αιτήματος· 100
**εξωτερικοί** σύνδεσμοι χωρίς τύπο ⇒ `no-rule` (§9 #7).

✅ **Εγγραφή εκτελέστηκε 2026-09-11 12:13Z** (έγκριση Giorgio): ξανά ξηρό ⇒ **ίδια** ανάλυση, 20 · `--apply
--expect-drift=20` ⇒ «Γράφτηκαν 20 ειδοποιήσεις» (μόνο `actions` όπου άλλαζε η πόρτα + `meta.workspace`) · ξανά ξηρό ⇒
**0 αποκλίσεις** — 20 `aligned`, 100 `no-rule` ανέγγιχτα, σύνολο 120. Ασφαλές πριν το push: ο κώδικας παραγωγής αγνοεί
το `meta.workspace`, και οι νέες πόρτες είναι οι σωστές ήδη από το ADR-841 Α18.9 / Α18.12.

**Παράπλευρα (N.0.2)**: 🔴 η ειδοποίηση έγκρισης PO έγραφε με το χέρι `/procurement/<id>` — **δεν
υπάρχει σελίδα** (404), με ελληνική ετικέτα — αόρατο γιατί ο φρουρός (`notification-destination-custody`)
κοιτούσε μόνο αρχεία `*-notifier.service.ts`. Νέο `ENTITY_ROUTES.procurement.purchaseOrder` · ανακάλυψη
πλέον **κάθε** καλούντα του `dispatchNotification({` · `APP_ROUTES.aiInbox`.

**Απόδειξη**: 25 σουίτες / **399** tests πράσινα · **12/12 μεταλλάξεις** σκοτωμένες (αγνόηση χώρου-στόχου ·
ξένος ιδιωτικός χώρος · μη αποθήκευση · κάτοχος = παραλήπτης · ωμή διαδρομή στο κουδούνι · τυφλός
ανιχνευτής · λάθος χώρος ιδιώτη · μαντεψιά στην επανάληψη · κανάλι · χειρόγραφο PO · χώρος εντολής
από τον συγγραφέα · κάτοχος = `createdBy`) · CHECK 3.28 (diff, 33 αρχεία) · 3.47 · 3.56 · 3.61 · 3.73
· 3.70 (`--all`). **Όχι tsc (N.17).**

---

## 7. ΠΑΡΑΠΛΕΥΡΑ ΕΥΡΗΜΑΤΑ *(N.0.2 — Boy Scout)*

| Εύρημα | Ενέργεια |
|---|---|
| `base-email-template.ts` είχε εφεδρεία `https://nestor-app.vercel.app` — **νεκρό** domain (Vercel παγωμένο 2026-05-09) ⇒ κίνδυνος **subdomain takeover**: ξένος θα σέρβιρε εικόνες μέσα στα email μας | Διορθώθηκε (→ `publicOrigin()`, `''` χωρίς ρύθμιση) |
| Το **ίδιο** νεκρό domain σε **17** ακόμη αρχεία (κοινοποιήσεις, QR, πρόσκληση εντολής…) | 🔴 `.claude-rules/pending-ratchet-work.md` — >1h, 5+ domains |
| `ack/route.ts`: `where('__name__','in', ids.slice(0,10))` — **σιωπηλή** περικοπή μετά τη 10η | Διορθώθηκε (`getAll` ανά κλειδί, όριο 50 **ρητό**) |
| `mandate/[token]` σελίδα + API: ωμό `decodeURIComponent` ⇒ **500** σε κομμένο σύνδεσμο | Διορθώθηκε (`decodeRouteParam`) |
| `contacts` **ταυτόχρονα** εντός και εκτός χώρου· `contact` (ADR-844) αδήλωτο — **5 κόκκινα tests ήδη στο HEAD** | ✅ **Έκλεισε 2026-09-10** — ADR-843 §10.19 (`/first-contacts`) + κανόνας Κ3 της CHECK 3.60 |
| Regex χαρακτήρων ελέγχου γράφτηκε αρχικά με **ωμό NUL** μέσα στο αρχείο (το εργαλείο ερμήνευσε το escape) | Διορθώθηκε σε `\p{Cc}` — καμία αριθμητική διαφυγή· η άγκυρα «παύλα» το κλειδώνει |

---

## 8. ΕΝΑΛΛΑΚΤΙΚΕΣ ΠΟΥ ΑΠΟΡΡΙΦΘΗΚΑΝ

- **Ο προορισμός κατευθείαν μέσα στο email** — σπάει με την πρώτη αλλαγή διαδρομών, δεν λύνει
  χώρο, δεν γράφει «διαβάστηκε». Το `/n/{id}` κάνει και τα τρία.
- **Σύνδεσμος με κλειδί σύνδεσης (magic link)** — ένα προωθημένο email θα έδινε τον λογαριασμό.
- **Pixel ανάγνωσης** — Apple MPP ⇒ ψευδή ανοίγματα· το κλικ είναι το αληθινό σήμα.
- **Διαγραφή σε GET** — οι σαρωτές θα διέγραφαν ανθρώπους. Γι' αυτό υπάρχει το RFC 8058.
- **UTM** — οι μεγάλοι δεν τα βάζουν σε ειδοποιήσεις· θα «λέρωναν» URL ασφαλείας.
- **Gmail Go-To Actions** — χειροκίνητη έγκριση μόνο για πτήσεις/αποστολές, Gmail-only.
- **Σύνοψη: η απόδοση ΕΞΩ από τον σχεδιαστή** — θα έσπαγε ~25 ισχυρισμούς χωρίς κέρδος· ο
  σχεδιαστής μένει καθαρός με **ένεση** συνδέσμων (`EmailLinks`).
- **`publicUrl` μέσα στο `request-origin.ts`** — θα τραβούσε το `next/server` σε κάθε πρότυπο email
  και άγκυρά του· ο πυρήνας ζει σε `public-origin.ts` χωρίς εξαρτήσεις.

---

## 9. 🔶 ΔΗΛΩΜΕΝΑ ΟΡΙΑ — ΤΙ **ΔΕΝ** ΕΓΙΝΕ

1. ✅ ~~**Καμία ζωντανή αποστολή email**~~ **Πρώτη ζωντανή αποστολή 2026-09-10 20:50Z** — επανάληψη 2
   ειδοποιήσεων με έγκριση Giorgio (ADR-849 §6γ + §9 #3). 🔶 Κεφαλίδες `List-Unsubscribe`, σελίδα token
   και one-click εκκρεμούν στο Gmail (ADR-849 §9 #3, Β2–Β4).
2. 🔶 **Κανένα περπάτημα στον φυλλομετρητή** του `/n` → login → επιστροφή. Η ροή κλειδώνεται από
   άγκυρες ανά κρίκο, **όχι** από ζωντανό πέρασμα.
3. ✅ ~~**Το `o/[workspace]/layout.tsx` μένει σε σκέτο `/login`**~~ **Έκλεισε 2026-09-23 (ADR-875 §14.5)**:
   το middleware προωθεί πλέον τη διαδρομή ως κεφαλίδα αιτήματος (`lib/http/request-path.ts`) και οι φρουροί
   του διακομιστή ζητούν `loginHrefForRequest()` (`server/auth/login-return.ts`) — layout **και**
   `procurement/analytics`. Τη μετρά ζωντανά ο δίδυμος του χρησμού (`guard-return-lost`). 🔶 Μένουν οι
   φρουροί **πελάτη** (`ProtectedRoute` κ.ά., `router.replace(login)`) — `pending-ratchet-work.md`.
4. 🟡 **Σίγαση ανά τύπο** («όχι email για ταιριάσματα αγγελιών») → **[ADR-849](./ADR-849-notification-preferences-type-by-channel.md)**.
   Α1 (μοντέλο + πύλες server) · Α2 (token/κεφαλίδα/σελίδα, ADR-849 §6α) · Α3 (οθόνη, ADR-849 §6β) ✅ 2026-09-10.
5. ✅ ~~**Ειδοποίηση άλλου χώρου από τον ενεργό**: ανοίγει στον χώρο της **ταυτότητας**.~~ **Έκλεισε
   2026-09-11 (§6α, ADR-849 Β1)**: ο παραγωγός **δηλώνει** τον χώρο-στόχο και το `/n/{id}` λύνει το
   ψευδώνυμο **του γεγονότος**. Παραμένει: αν ο θεατής **δεν** είναι μέλος, το layout απαντά 404
   (fail-closed) — καμία αυτόματη αλλαγή εταιρείας, καμία ονομασμένη άρνηση.
7. 🔶 **Ειδοποιήσεις χωρίς κανόνα ανιχνευτή** (§6α): 100 έγγραφα με **εξωτερικό** σύνδεσμο `http(s)`
   και χωρίς `meta.eventType` (μετρημένα 2026-09-11) — εκτός χώρου, άρα ανεπηρέαστα· η προέλευσή
   τους δεν ερευνήθηκε.
8. ✅ **Ζωντανή επαλήθευση του §6α — 2026-09-11 17:33–17:56Z** (nestorconstruct.gr, build `f6a915bb`,
   super-admin): **(1)** σύνδεσμος #2 του email με τον επιλογέα σε **ξένη** εταιρεία (Ροή) ⇒
   `/o/comp_9c7c…/properties/prop_ef2eaebd…`, η καρτέλα ανοίγει («Διαμέρισμα 80 τ.μ. · 177.000 €»), ο
   επιλογέας γράφει ΠΑΓΩΝΗΣ ✅ · **(2)** κουδούνι από το γραφείο της Ροής ⇒ «Προβολή» σε ειδοποίηση ζήτησης
   της ΠΑΓΩΝΗΣ ⇒ `/n/{id}?via=inapp` ⇒ ίδια καρτέλα· στη βάση `openedVia: "inapp"` ✅ (ιδιωτική `ownp_*` ⇒
   `/offers/<id>` της `(me)` ✅) · **(3)** αλλαγή εταιρείας ⇒ `/o/<νέα>/properties` · δύο καρτέλες σε δύο
   εταιρείες μένουν χωριστές ✅ · **(5)** ταίριασμα ⇒ `/listing/<id>` αυτούσιο, εκτός χώρου· `openedVia`
   έμεινε `"email"` ✅ · **(4)** 🔴 `/o/me/projects` **δείχνει έργα** — ο δρόμος του **API** (ADR-787 §9,
   όριο (1)): ιδιωτικός χώρος ⇒ `requestedCompanyId() = null` ⇒ καμία κεφαλίδα ⇒ για super-admin
   `super-admin-global` (όλη η συλλογή· σήμερα 7/7 έργα της ΠΑΓΩΝΗΣ, οπότε τα δεδομένα δεν το ξεχωρίζουν
   — το αποδεικνύει **ο κώδικας**). 🔶 Παρατηρήσεις: κάθε πλοήγηση πελάτη προς `/n/` που **ανακατευθύνει**
   καταγράφει **503** στο αίτημα RSC (ο προορισμός φτάνει σωστά· `/n/` χωρίς ανακατεύθυνση ⇒ 200) · ωμά
   κλειδιά `grid.emptyState.*` στο **κρυφό** τμήμα SSR (`div#S:0[hidden]`) του `/o/<εταιρεία>/properties`
   — αόρατα, τυφλό σημείο του CHECK 3.51. Ανοιχτά: `.claude-rules/pending-ratchet-work.md` (ADR-849 Β1).
6. 🔶 Η σελίδα προτιμήσεων **δεν** συνδέει στις «όλες οι ρυθμίσεις»: για τον ιδιώτη το
   `/account/notifications` δεν έχει σελίδα (`/o/me/*`) — σύνδεσμος εκεί θα ήταν 404.

---

## 10. ΕΝΕΡΓΕΙΕΣ ΓΙΑ ΤΟΝ GIORGIO (Netcup)

- **Νέο** `NOTIFICATION_EMAIL_SECRET` (π.χ. `openssl rand -hex 32`).
- ~~Επιβεβαίωση `NEXT_PUBLIC_APP_URL=https://nestorconstruct.gr`.~~ ✅ **2026-09-10: μπήκε στο BUILD**
  (`.github/workflows/docker-build.yml`). ⚠️ Ρύθμιση **μόνο** στο Coolify (runtime) **δεν αρκεί**: ο
  server τη διαβάζει, ο **browser ποτέ** — το Next ψήνει μόνο όσες `NEXT_PUBLIC_*` υπάρχουν στο build.

---

## 11. ΑΓΚΥΡΕΣ

`return-path` · `request-origin` (Ζ) · `email-provider-headers` · `notification-email-render` ·
`notification-email-envelope` · `email-subscription-token` · `email-subscription-contract` ·
`email-subscription` · `notification-permalink` · `subscription-route` · `notification-read` ·
`notification-email-leg` · **§6α**: `notification-destination` (Α–Δ) · `notification-orchestrator-destination`
· `notification-destination-drift` · `notification-destination-rules` · `place-location` · `notification-permalink`
Γ/Δ · `notification-destination-custody` (Κ0–Κ5, ανακάλυψη ανά καλούντα). Ενημερώθηκαν: `email-digest` Σ4 (ο παλιός έλεγχος ήταν **η ακριβής
συμβολοσειρά** της παλιάς σήμανσης ⇒ με νέα σήμανση θα έμενε πράσινος **ανεξάρτητα από το
αποτέλεσμα**· πλέον ρωτά «υπάρχει κενή παράγραφος;») · `email-texts` Β6 (η υπογραφή του
μοναχικού ζει στον φάκελο). Καμία πραγματική αποστολή (Π3). **Όχι tsc (N.17).**

---

## 12. CHANGELOG

- **2026-09-10** — Γέννηση. Πέντε κενά (§1.1) κλειστά· δύο route slices σφραγισμένα με μέτρηση·
  CHECK 3.28 (diff) 0 κλώνοι σε 31 αρχεία· CHECK 3.34 OK· 357+ άγκυρες πράσινες στο επηρεαζόμενο
  σύνολο (οι 5 κόκκινες του `workspace-scope`/`route-catalogue-anchor` **προϋπάρχουν στο HEAD**, §7).
- **2026-09-10 (β)** — 🔴 **Μία άγκυρα που ξέφυγε από το «επηρεαζόμενο σύνολο»**: το `navigation.test.tsx`
  **Λ3** διάβαζε τον κώδικα του `[...unprefixed]/page.tsx` για τη διακλάδωση ταυτότητας — που αυτό το ADR
  **μετέφερε** στο `workspace-destination.ts`. Κόκκινη χωρίς να έχει χαλάσει τίποτα· διορθώθηκε ώστε να
  ρωτά το δίχτυ **αν καλεί** τον επιλυτή και τον επιλυτή **αν ονομάζει και τους δύο κλάδους**. Βρέθηκε
  στο ADR-843 §10.19, που έκλεισε και το εύρημα `contacts` του §7.
- **2026-09-10 (γ)** — 🔴 **Η διεύθυνσή μας έλειπε από το BUILD της παραγωγής.** Το `docker-build.yml`
  όριζε 16 `NEXT_PUBLIC_*` αλλά **όχι** το `NEXT_PUBLIC_APP_URL`. Μετρημένο στον κώδικα του Next
  (`next/dist/lib/static-env.js`): ψήνονται **μόνο** όσες υπάρχουν τη στιγμή του build (`value != null`).
  ⇒ ο **server** τη διάβαζε από το Coolify στο runtime (σωστά — email/προσκλήσεις/QR παρουσιών εντάξει),
  αλλά ο **browser ποτέ**: το QR της πινακίδας σχεδίων (DXF viewer, πελάτης) τύπωνε
  `nestor-app.vercel.app`. ✅ Μία γραμμή στο build. Το σβήσιμο της εφεδρείας Vercel από τα ~20 αρχεία
  μένει **καθάρισμα** (`.claude-rules/pending-ratchet-work.md`). 🔶 Δεν επαληθεύτηκε σε ζωντανό bundle.
- **2026-09-10 (δ)** — 🔴 **Η «Διακοπή» δεν τηρούνταν για ό,τι περίμενε ήδη στην ουρά** — κενό αυτού του ADR
  που **δεν** είχε δηλωθεί: η απόφαση λαμβανόταν μόνο στην εγγραφή, και ο αγωγός δεν διάβαζε ρυθμίσεις ποτέ
  ⇒ «Διακοπή» στις 15:00, σύνοψη στις 20:00. ✅ Κλειστό από την πύλη της αποστολής του **ADR-849** Α1
  (`email-send-gate.ts`, `status:'cancelled'` + λόγος). Το §9 #4 δείχνει πλέον στο ADR-849.
- **2026-09-11** — 🔴 **§6α — Ο ΧΩΡΟΣ ΤΟΥ ΓΕΓΟΝΟΤΟΣ, ΟΧΙ ΤΟΥ ΘΕΑΤΗ** *(ADR-849 §6δ Β1/Β2)*. Το `/n/{id}` λύνει
  πλέον το ψευδώνυμο του χώρου που **δήλωσε ο παραγωγός** (`meta.workspace`, πρότυπο Slack `app_redirect?team=`
  · Teams `tenantId` · GitHub αναφορά οντότητας)· το **κουδούνι** περνά από την **ίδια** πόρτα
  (`/n/{id}?via=inapp` — ένας συγγραφέας του «ανοίχτηκε»). Ο τύπος `DispatchRequest` δέχεται `actions`
  **μόνο** μαζί με `workspace`. Ανιχνευτής απόκλισης `notifications:destination-drift` (ξηρό: 20 αποκλίσεις,
  από τις οποίες 5 λάθος πόρτες `/offers/prop_*`)· η εγγραφή περιμένει έγκριση. Παράπλευρο: νεκρός
  σύνδεσμος PO (`/procurement/<id>` → `ENTITY_ROUTES.procurement.purchaseOrder`) και διεύρυνση της
  ανακάλυψης της `notification-destination-custody` σε **κάθε** καλούντα. §9 #5 έκλεισε· #7 · #8 νέα.
- **2026-09-11 (β)** — ✅ **Η εγγραφή του ανιχνευτή εκτελέστηκε** (§6α, έγκριση Giorgio): 20 έγγραφα — 5 πόρτες
  `/offers/prop_*` → `/properties/…` · 1 `/offers/ownp_*` → `/listings/mandates/…` · χώρος-στόχος σε όλα· ξανά
  ξηρό ⇒ **0**. §9 #1 διορθώθηκε (μπαγιάτικο: η πρώτη ζωντανή αποστολή έγινε 2026-09-10, ADR-849 §6γ). Η Φάση Β
  γράφτηκε και στα ADR-849 §6δ και ADR-787 §9 (όριο (4) έκλεισε).
- **2026-09-11 (γ)** — 🔍 **Ζωντανή επαλήθευση του §6α** (§9 #8): σύνδεσμος email · κουδούνι από ξένο γραφείο ·
  επιλογέας · δύο καρτέλες · ταίριασμα ✅. 🔴 `/o/me/projects` δείχνει έργα — όριο (1) του ADR-787 §9, ζωντανά
  ορατό και **βαρύτερο** από όσο γράφτηκε (για super-admin καθολική όψη, όχι claim). 🔶 503 στο RSC του `/n/`
  · ωμά κλειδιά σε κρυφό τμήμα SSR. Ανοιχτά στο `pending-ratchet-work.md`.
