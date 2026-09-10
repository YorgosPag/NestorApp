# ADR-848 — **ΤΟ EMAIL ΕΙΔΟΠΟΙΗΣΗΣ ΟΔΗΓΕΙ ΚΑΠΟΥ: ΜΟΝΙΜΟΣ ΣΥΝΔΕΣΜΟΣ, ΕΠΙΣΤΡΟΦΗ ΜΕΤΑ ΤΗ ΣΥΝΔΕΣΗ, ΔΙΑΓΡΑΦΗ ΕΝΟΣ ΚΛΙΚ**

> **Κατάσταση**: 🟢 Υλοποιημένο *(2026-09-10)* · 🔶 ζωντανή αποστολή **δεν** επαληθεύτηκε (Π3 — δες §9)
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

1. 🔴 **Καμία ζωντανή αποστολή email** (Π3 — χωρίς εντολή). Όλες οι άγκυρες με ψεύτικο δίκτυο.
   Χρειάζεται εντολή Giorgio για ελεγχόμενο πέρασμα **μετά** τη ρύθμιση των env στο Netcup.
2. 🔶 **Κανένα περπάτημα στον φυλλομετρητή** του `/n` → login → επιστροφή. Η ροή κλειδώνεται από
   άγκυρες ανά κρίκο, **όχι** από ζωντανό πέρασμα.
3. 🔶 **Το `o/[workspace]/layout.tsx` μένει σε σκέτο `/login`**: ο διακομιστής layout **δεν γνωρίζει**
   τη διαδρομή του αιτήματος (το middleware δεν την προωθεί). Ο σύνδεσμος του email **δεν**
   επηρεάζεται — το `/n` ξέρει τη δική του διαδρομή. Το **`ProtectedRoute`** επίσης αμετάβλητο.
4. 🔶 **Σίγαση ανά τύπο** («όχι email για ταιριάσματα αγγελιών») — απόφαση Giorgio: **επόμενο βήμα**.
   Θέλει νέο πεδίο ρυθμίσεων + στήλη email στην οθόνη ρυθμίσεων.
5. 🔶 **Ειδοποίηση άλλου χώρου από τον ενεργό**: ανοίγει στον χώρο της **ταυτότητας**· αν δεν είναι
   μέλος, το layout απαντά 404 (fail-closed) — καμία αυτόματη αλλαγή εταιρείας.
6. 🔶 Η σελίδα προτιμήσεων **δεν** συνδέει στις «όλες οι ρυθμίσεις»: για τον ιδιώτη το
   `/account/notifications` δεν έχει σελίδα (`/o/me/*`) — σύνδεσμος εκεί θα ήταν 404.

---

## 10. ΕΝΕΡΓΕΙΕΣ ΓΙΑ ΤΟΝ GIORGIO (Netcup)

- **Νέο** `NOTIFICATION_EMAIL_SECRET` (π.χ. `openssl rand -hex 32`).
- Επιβεβαίωση `NEXT_PUBLIC_APP_URL=https://nestorconstruct.gr`.

---

## 11. ΑΓΚΥΡΕΣ

`return-path` · `request-origin` (Ζ) · `email-provider-headers` · `notification-email-render` ·
`notification-email-envelope` · `email-subscription-token` · `email-subscription-contract` ·
`email-subscription` · `notification-permalink` · `subscription-route` · `notification-read` ·
`notification-email-leg`. Ενημερώθηκαν: `email-digest` Σ4 (ο παλιός έλεγχος ήταν **η ακριβής
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
