# ADR-877 — Μία πόρτα εξόδου email: το email ακολουθεί το επίπεδο δεδομένων

| | |
|---|---|
| **Status** | ACCEPTED — υλοποιήθηκε 2026-09-24 · **επαληθεύτηκε στον browser/emulator 2026-09-24 (§6)**, χωρίς commit |
| **Date** | 2026-09-24 |
| **Προέλευση** | ADR-876 §5.8 **Σ22** *(εύρημα επαλήθευσης: ο server πάνω στον emulator έστειλε πραγματικό email)* |
| **Σχετικά** | ADR-777 §8.26 *(αλυσίδα παρόχων)* · ADR-857 Φ9 *(ταυτότητα αποστολέα, CHECK 3.83)* · ADR-821 §3.1α *(γεγονός, όχι διακόπτης)* · ADR-853 Φ5 *(όριο χρόνου)* · ADR-841 §7 Α21.20 *(bounces, συσχέτιση)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το πρόβλημα, μετρημένο (2026-09-24)

Με `dev:emulator` το log έγραψε «Email sent successfully via Mailgun» σε `vendor+…@golden.local`. SSoT audit (grep +
Explore agent): **τέσσερις** ανεξάρτητοι δρόμοι έφταναν στο δίκτυο, **κανείς** δεν ήξερε για emulator, και δεν υπήρχε
**κανένα** σημείο που να απαντά «σε ποιο περιβάλλον τρέχω;» για το email:

| # | Δρόμος | Αρχείο | Καλούντες |
|---|---|---|---|
| Δ1 | `sendReplyViaMailgun` · `clearMailgunBounce` (`fetch`) | `services/ai-pipeline/shared/mailgun-sender.ts` | ~20 (τιμολόγια, προσκλήσεις χώρου, auth mail, showcase…) — **παρακάμπτουν** την αλυσίδα |
| Δ2 | `EmailAdapter.sendEmail` (`fetch`) | `server/comms/email-adapter.ts` | αλυσίδα · `onboarding-reminder.job` · `email-channel` |
| Δ3 | `resendProvider` (SDK) | `server/comms/email-providers.ts` | αλυσίδα (`email.service` · `outbound-email-flush.job`) |
| Δ4 | **χειρόγραφο δίδυμο της αλυσίδας** Resend→Mailgun | `subapps/procurement/services/channels/email-channel.ts` | email πρόσκλησης προμηθευτή — **η διαδρομή του Σ22** |

Ευρήματα πέρα από τον emulator:

| # | Εύρημα |
|---|---|
| **Ε1** | 🔴 Το Δ4 διάβαζε **μόνο** `result.data` του Resend. Το SDK **δεν πετά** σε απόρριψη (`{ data:null, error }`) ⇒ πρόσκληση που απέρριψε ο Resend γραφόταν **«στάλθηκε»**, **χωρίς** μετάπτωση στον Mailgun. Η παγίδα ήταν ήδη τεκμηριωμένη στο `email-providers.ts` — το δίδυμο δεν τη μάθαινε |
| **Ε2** | URL περιοχής + Basic auth του Mailgun γραμμένα **δύο** φορές (Δ1 · Δ2)· το Δ2 **χωρίς** `PROVIDER_TIMEOUT_MS` (το μάθημα ADR-853 Φ5 δεν είχε φτάσει εκεί) |
| **Ε3** | Το Δ4 είχε **δεύτερο** `PROVIDER_TIMEOUT_MS = 20_000` + δικό του `withProviderTimeout` |
| **Ε4** | «αποτυχίες αλυσίδας → κείμενο» γραμμένο **δύο** φορές (`email.service` · `outbound-email-flush.job`) — θα γινόταν τρίτη στο Δ4 |
| **Ε5** | Οι ετικέτες Resend (`campaign`/`invite_id`) και το `metadata` του Mailgun του Δ4: **0 καταναλωτές** (grep) — δεδομένα μόνο-εγγραφής |

## 2. Έρευνα — πώς το κάνουν οι μεγάλοι

- **Rails** `ActionMailer` `delivery_method :test` + interceptors · **Laravel** `MAIL_MAILER=log`, `Mail::alwaysTo()`, allowlist
  packages · **Django** `filebased.EmailBackend` · **Mailpit/MailHog** (SMTP catcher). Όλοι κρίνουν με **διακόπτη
  περιβάλλοντος** που κάποιος πρέπει να **θυμηθεί** να ρυθμίσει: ασφάλεια **opt-in**.
- **Mailgun `o:testmode`**: απορρίπτεται — *«You are charged for messages sent in test mode»*, και θέλει πραγματικά κλειδιά + δίκτυο.

## 3. Η απόφαση

### 3.1 Το email ακολουθεί το επίπεδο δεδομένων (πού τους ξεπερνάμε)

Αν ο server μιλά σε **emulator**, κάθε σύνδεσμος του email δείχνει σε δεδομένα που **δεν υπάρχουν** στον πραγματικό κόσμο
⇒ το email **δεν έχει θέση** εκεί. Το κριτήριο είναι **γεγονός**: `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`,
οι μεταβλητές του **ίδιου του Firebase SDK**, ήδη ορισμένες από το `dev:emulator` — ίδια δικαιολόγηση με το ADR-821 §3.1α.
**Κανένας νέος διακόπτης, καμία ρύθμιση να ξεχαστεί**: ο emulator **δεν μπορεί** να στείλει email, όσα κλειδιά κι αν έχει το `.env`.

⚠️ Το `NODE_ENV` **δεν** ρωτιέται: `next dev` πάνω στην **πραγματική** βάση = πραγματικά δεδομένα = πραγματικό email (σκόπιμα).

### 3.2 Τα κομμάτια (`src/server/comms/egress/`)

| Κομμάτι | Αρχείο | Τι κάνει |
|---|---|---|
| **Πολιτική** | `email-delivery-mode.ts` | `emailDeliveryMode(env) → 'deliver' \| 'capture'` — καθαρό |
| **Σχήμα** | `egress-email.ts` | `EgressEmail` = **υπερσύνολο** (κεφαλίδες + συνημμένα + συσχέτιση): πριν, ο κάθε δρόμος έχανε σιωπηλά ό,τι δεν ήξερε |
| **Outbox** | `email-outbox.ts` | `captureEmail` → `.eml` RFC 5322 (multipart, θέμα RFC 2047) στο `/.emulator-outbox/` (gitignored, αγκυρωμένο). **Αρχείο, όχι συλλογή Firestore**: κανένας κανόνας/συλλογή στην παραγωγή για κάτι μόνο-τοπικό |
| **Πόρτα Mailgun** | `mailgun-transport.ts` | το **ΜΟΝΟ** αρχείο με `mailgun.net`: `mailgunSendMessage` · `mailgunDeleteBounce` · `mailgunAvailable`. Περιοχή, auth, όριο χρόνου **μία** φορά |
| **Πόρτα Resend** | `resend-transport.ts` | το **ΜΟΝΟ** αρχείο που εισάγει `resend` (δυναμικά): `resendSendMessage` (κρατά τον έλεγχο `result.error`) · `resendAvailable` |

🔑 **Πρώτη ερώτηση κάθε πόρτας: `emailDeliveryMode()`** — **πριν** από τον έλεγχο κλειδιών. Σε emulator οι πόρτες δηλώνουν
«διαθέσιμες» (`*Available()`), ώστε το outbox να δείχνει **ό,τι θα έφευγε** ακόμη και χωρίς κλειδιά.

### 3.3 Οι καταναλωτές

| Αρχείο | Αλλαγή |
|---|---|
| `mailgun-sender.ts` | αναθέτει στην πόρτα· **ίδιο** δημόσιο API ⇒ οι ~20 καλούντες **ανέγγιχτοι** |
| `email-adapter.ts` | `sendEmail` αναθέτει στην πόρτα (κερδίζει όριο χρόνου)· έφυγαν πεδία κλειδιών + δεύτερο URL/auth (Ε2) |
| `email-providers.ts` | κρίκος Mailgun μέσω `EmailAdapter` (κρατά το σημείο δοκιμής του `outbound-email-flush` test) · κρίκος Resend στην πόρτα · `configured` = η πόρτα |
| `procurement/.../email-channel.ts` | το δίδυμο → `sendThroughChain(defaultEmailChain())` (Ε1 · Ε3 · Ε5) — 179 → 99 γραμμές |
| `email-provider-chain.ts` | + `chainFailureReasons(outcome)` — ΕΝΑ λεξιλόγιο (Ε4)· το υιοθετούν `email.service` · `outbound-email-flush.job` · το κανάλι |

### 3.4 Κλείδωμα

`.ssot-registry.json` → module **`email-egress`**: `api(\.eu)?\.mailgun\.net` · `from ['"]resend['"]` · `import\(['"]resend['"]\)` ·
`new Resend\(` — allowlist = οι δύο πόρτες (+ απόδειξη στο `scripts/lib/ssot/pattern-proofs.js`, `test:registry-golden` 314/314).
Νέος πάροχος = **νέα πόρτα** εδώ, με τον ίδιο φρουρό.

## 4. Άγκυρες — `src/server/comms/egress/__tests__/email-egress.test.ts` (10/10)

| Άγκυρα | Κλειδώνει |
|---|---|
| **Ε1** | host emulator (Firestore **ή** Auth) ⇒ `capture` · κενά/απουσία/`NODE_ENV` ⇒ `deliver` |
| **Ε2** 🔴 | σε emulator **με όλα τα κλειδιά ρυθμισμένα**: Δ1 · Δ2 · αλυσίδα · Δ4 · καθαρισμός bounce ⇒ **0** `fetch`, **0** SDK, **4** `.eml` · το `.eml` λέει ό,τι θα έφευγε (παραλήπτης · θέμα RFC 2047 · σώμα · `X-Outbox-Captured`) |
| **Ε3** | εκτός emulator η πόρτα **στέλνει**, με σήμα ματαίωσης — ο φρουρός δεν έκλεισε την παραγωγή |
| **Ε4** | παρονομαστής: σάρωση του `src/` με τα **ίδια** patterns του μητρώου ⇒ **ακριβώς** οι δύο πόρτες (αν τυφλωθεί ο σαρωτής ⇒ κόκκινο) |
| **Ε5** | Resend `{ error }` ⇒ το κανάλι πρόσκλησης **μεταπίπτει** στον Mailgun (Ε1 του §1) |

Μεταλλάξεις **4/4 κόκκινες**: φρουρός Mailgun αφαιρεμένος (2) · φρουρός Resend αφαιρεμένος (1) · `mailgun.net` σε τρίτο αρχείο (1) ·
έλεγχος `result.error` αφαιρεμένος (1). Επαναφορά στην ίδια εκτέλεση, αρχεία ακέραια (`cmp`).
Υπάρχοντα πράσινα: `test:ai-pipeline:all` (78/1239) · `src/server/comms` · procurement services · `outbound-email-flush.job` ·
`test:sender-authority` (23) · `jscpd:diff` (0 κλώνοι).

## 5. Δηλωμένα όρια

- **Σκέτο `next dev` πάνω στην πραγματική βάση στέλνει πραγματικά email** — σκόπιμα (§3.1).
- **Μη διαθέσιμο σε client**: όλα `server-only`. Το outbox γράφει στο `process.cwd()` — σε read-only FS (π.χ. serverless) η
  σύλληψη επιστρέφει ονομασμένη αποτυχία `outbox: …`, **ποτέ** δίκτυο.
- **Εκτός εύρους**: SMS/Telegram · inbound webhooks Mailgun (ανάγνωση, όχι αποστολή).
- ~~Επαλήθευση στον browser — δεν έγινε~~ → **έγινε, §6** (Σ-α…Σ-δ πράσινα· 4 ευρήματα κλάσης, όλα διορθωμένα).

## 6. Επαλήθευση στον browser / emulator (2026-09-24)

**Στήσιμο**: `npm run emulator` · `emulator:seed-personas` · `emulator:seed-golden` · `next dev` στη **3100** με
`FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST` (γεγονός του SDK, §3.1). Κλήσεις ως `admin.civil@alpha.local` με
token του auth emulator — **κανένας κωδικός σε φόρμα**. Κάθε `.eml` αναλύθηκε με τον **τυπικό** αναλυτή RFC 5322 της Python
(`email.policy.default`), ανεξάρτητο από τον δικό μας κώδικα.

### 6.1 Σενάρια — όλα πράσινα

| # | Σενάριο | Αποτέλεσμα |
|---|---|---|
| **Σ-α** | `POST /api/rfqs/{id}/invites` (`email`, `…@golden.local`) | `.eml` · `providerMessageId: captured_msg_…` · log `[EMAIL_OUTBOX] … NOT sent`. Ο σύνδεσμος του `.eml` στον Chrome **άνοιξε την πύλη**: η πρόσκληση πέρασε `sent → opened`, το `#t=` σβήστηκε από τη διεύθυνση (ADR-876 §5) |
| **Σ-β** | Ληγμένος σύνδεσμος (κομμένος με το **ίδιο** SSoT `issueAdditionalVendorLink`, `expiresAtMs` στο παρελθόν) | `GET` ⇒ `link_expired` · `POST …/renew` ⇒ **202** · νέο `.eml` · ο νέος σύνδεσμος ανοίγει (`GET` 200) |
| **Σ-γ** | `POST /api/workspace-invitations` (δρόμος `sendReplyViaMailgun`, Δ1) | 201 `delivery: accepted` · `.eml` · ο σύνδεσμος `/invite/…` απαντά 200 |
| **Σ-δ** | Θέμα RFC 2047 σε ανεξάρτητο αναλυτή | «Πρόσκληση Προσφοράς: …» / «Πρόσκληση συνεργασίας από Άλφα Τεχνική (DEMO) — Nestor App» · **0 defects** σε όλα τα μέρη |

**Γραμμές «via Mailgun» / «via Resend» στο log του dev: 0** (σε όλη τη συνεδρία, 6 αποστολές).

### 6.2 Ευρήματα — διορθωμένα στην κλάση

| # | Εύρημα | Κλάση · διόρθωση |
|---|---|---|
| **Ζ1** 🔴 | Η πρόσκληση έγραφε «λήγει στις» με `toLocaleString()` **χωρίς ζώνη** ⇒ ώρα **του διακομιστή**. Ο διακομιστής τρέχει σε **UTC** (Docker, ίδια διαπίστωση με το `email-delivery-clock.ts`): ο Έλληνας προμηθευτής θα διάβαζε **11:17** για σύνδεσμο που λήγει **14:17**. Το text/plain έγραφε **ωμό ISO σε UTC**. Στον υπολογιστή ανάπτυξης (Αθήνα) το λάθος είναι **αόρατο** | **Κλάση: ώρα που γράφει ο διακομιστής σε άνθρωπο.** Σάρωση ⇒ **8** σημεία: πρόσκληση προμηθευτή · `formatEmailDateGreek` (4 πρότυπα επιβεβαίωσης) · τιμολόγιο · email παραγγελίας · **PDF** παραγγελίας (πανομοιότυπος κλώνος) · ειδοποιήσεις πωλήσεων · Telegram κράτησης (`getDay()`/`getDate()` + καρφωμένα ονόματα ημερών) · **«σήμερα» του AI** (`agentic-system-prompt`, `getDate()` ⇒ μετά τις 21:00/22:00 ώρα Ελλάδας το AI πίστευε ότι είναι **χθες**). Νέο SSoT **`src/lib/operator-time-format.ts`**: `OPERATOR_TIME_ZONE` · 24ωρο `h23` · `YYYY-MM-DD` ⇒ μεσημέρι UTC (δόγμα `formatCalendarDay`) · `Record<HumanLanguage,…>` (`en` ⇒ `en-GB`: μέρα/μήνας). HTML **και** κείμενο από την **ίδια** τιμή |
| **Ζ2** | Το κανάλι πρόσκλησης δεν περνούσε `lang` ⇒ η **αγγλική** πρόσκληση δήλωνε `<html lang="el">` (WCAG 3.1.1 · ADR-851) | `lang: resolveHumanLanguage(message.locale)` |
| **Ζ3** | Υποσέλιδο **κάθε** email: «All rights reserved.» — αγγλικά σε κάθε ελληνικό μήνυμα· έτος με `getFullYear()` (ζώνη διακομιστή) | `base-email-texts.ts` (`Record<HumanLanguage,…>`, σχήμα `auth-action-email-texts`) · έτος = `calendarDayOf()` της ζώνης φορέα |
| **Ζ4** | SSR της πύλης: `raw key reached the UI → vendor-portal:page.loading` (`vendor-portal=absent`). Η **μόνη** σελίδα διαπιστευτηρίου με ψυχρή είσοδο από email **χωρίς** route slice (`contact`/`invite`/`mandate`/`card-email`/`hours-question`/`email/preferences` έχουν). Ρίζα: `` t(`vendor-portal:${errorKey}`) `` με `errorKey: string` ⇒ ο γεννήτορας **αρνήθηκε** το slice | `errorKey: string` → **κλειστός τύπος** `VendorPortalActionError` + `Record` στατικών `t()` · δήλωση στο `.i18n-shell-slice.json` (σφράγιση **5671** bytes, μετρημένα) · `registerRouteSlice` στο **client** `VendorPortalGate` (ADR-744 §18). Ζωντανά: το SSR γράφει «Φόρτωση πρόσκλησης…», **0** ωμά κλειδιά |

**Boy Scout (CHECK 3.28, ανέβηκε από το `jscpd:diff` των αρχείων που αγγίχτηκαν)**: `escapeHtml` ×3 · `formatEuro` ×5 · `formatPoDate` ×2 ·
εσωτερικός δίδυμος κειμένου/HTML τιμολογίου ⇒ `src/lib/html/escape-html.ts` (καθαρό — **όχι** `escapeXml`: το `&apos;` δεν είναι
οντότητα HTML4, Outlook) · `lib/number/greek-decimal.formatEuro` (ήδη υπήρχε, ταυτόσημη έξοδος) · `services/procurement/po-format.ts` ·
`invoiceEmailFacts()`. Το `base-email-template` **επανεξάγει** ⇒ οι ~20 καταναλωτές ανέγγιχτοι. Διαγράφηκε ο νεκρός ψευδώνυμος
`formatDate` των ειδοποιήσεων πωλήσεων (0 καταναλωτές). `jscpd:diff` 17 αρχεία ⇒ **0 κλώνοι**.

### 6.3 Άγκυρες — `src/lib/__tests__/operator-time-format.test.ts` (13/13)

| Άγκυρα | Κλειδώνει |
|---|---|
| **Α0** | **κάθε** `Intl.DateTimeFormat` του SSoT φτιάχνεται με `timeZone: Europe/Athens` (spy) |
| **Α1-Α5** | 14:17 Αθήνας · 22:30 UTC = **αύριο** · `YYYY-MM-DD` σταθερή · «Πέμπτη 1/10» · αδιάβαστη τιμή αυτούσια |
| **Α6** | πρόσκληση el/en: ώρα Αθήνας σε HTML **και** κείμενο (όχι ISO) · `lang` · υποσέλιδο ανά γλώσσα · Telegram · βασικό πρότυπο |
| **Α7** | **παρονομαστής**: κανένα `toLocale*String(` / `new Intl.DateTimeFormat(` / `.getDay|getDate|getHours()` στον κώδικα μηνυμάτων του διακομιστή (email · PDF · Telegram · prompt AI) — με **θετικό έλεγχο** ότι ο σαρωτής βλέπει (>30 αρχεία, βρίσκει το ίδιο το SSoT) |

⚠️ **ΜΕΤΡΗΜΕΝΟ, ΜΗΝ ΤΟ ΞΑΝΑΔΟΚΙΜΑΣΕΙΣ**: η πρώτη εκδοχή άλλαζε `process.env.TZ` μέσα στο jest — **δεν πιάνει** (το `process.env` του
sandbox είναι αντίγραφο· το ICU μένει στη ζώνη της μηχανής). Το έπιασε η ίδια η άγκυρα «η αλλαγή ζώνης πιάνει»: χωρίς αυτήν όλες
θα ήταν πράσινες **χωρίς να μετρούν τίποτα** σε μηχανή Αθήνας. Γι' αυτό η Α0 ελέγχει την **αιτία** (spy), όχι το κείμενο.

**Μεταλλάξεις 7/7 κόκκινες**, επαναφορά στην ίδια εκτέλεση (backup + `trap` + `sha1sum -c`): SSoT χωρίς `timeZone` · κείμενο με
ωμό ISO · χωρίς `lang` · καρφωμένο υποσέλιδο · δίδυμος PO με `toLocaleDateString` · prompt AI με `getDate()` · δυναμική `t()`
στη φόρμα της πύλης (⇒ `check-i18n-shell-slice --full` ❌ «not what the generator produces»· η γρήγορη λειτουργία το πιάνει
στο commit, από το αποτύπωμα του σταδιοποιημένου αρχείου).
Πράσινα: 69 σουίτες / **1164** tests (comms · templates · procurement · accounting · sales · telegram · tokens · route-slice ·
demand) · `test:ai-pipeline:all` **78/1239** · CHECK 3.34 full ✅.

### 6.4 Δηλωμένα όρια (όχι διορθωμένα εδώ)

- **Άρνηση που αποτυγχάνει ⇒ «Η υποβολή απέτυχε»** (ADR-876 · `VendorPortalClient.onDecline`): λάθος λέξη για την πράξη. Ο
  κλειστός τύπος `VendorPortalActionError` το κάνει πλέον **ορατό**· θέλει νέο κλειδί `errors.declineFailed` (el+en) — εκτός εύρους.
- **Το email ανανέωσης έχει το ΙΔΙΟ θέμα με την πρόσκληση** («Πρόσκληση Προσφοράς: …»): ο προμηθευτής που ζήτησε νέο σύνδεσμο δεν
  βλέπει στο θέμα ότι αυτό **είναι** ο νέος σύνδεσμος. Απόφαση προϊόντος.
- **Ο Chrome (επέκταση)** δεν μπόρεσε να «πιάσει» την καρτέλα για στιγμιότυπο — ούτε σε σκέτο `/api/health` ⇒ πρόβλημα
  σύνδεσης/φόρτου, **όχι** της σελίδας. Η απόδειξη ότι η πύλη άνοιξε είναι η μετάβαση `sent → opened` της πρόσκλησης και το
  `GET /api/vendor/quote 200` του log. Ο οπτικός έλεγχος μένει στον Giorgio.
- Το `manifest` του i18n slice γράφει αποτυπώματα **όλων** των αρχείων κλειστότητας, και των τρεχόντων αρχείων χαρτών άλλου
  agent (ντετερμινιστικό· ξαναγεννιέται με το commit του).

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-24 | Δημιουργία + υλοποίηση: 4 δρόμοι → 2 πόρτες εξόδου με φρουρό emulator · outbox `.eml` · Ε1 (σιωπηλή απόρριψη Resend στο κανάλι πρόσκλησης) · Ε2-Ε5 · module μητρώου `email-egress` · άγκυρες Ε1-Ε5, μεταλλάξεις 4/4. |
| 2026-09-24 | **§6 Επαλήθευση στον browser/emulator**: Σ-α…Σ-δ πράσινα, 0 γραμμές «via Mailgun». Ευρήματα Ζ1 (ώρα διακομιστή σε UTC — κλάση 8 σημείων ⇒ SSoT `lib/operator-time-format`) · Ζ2 (`lang`) · Ζ3 (υποσέλιδο ανά γλώσσα) · Ζ4 (route slice πύλης προμηθευτή + κλειστός τύπος σφάλματος). Boy Scout CHECK 3.28: `lib/html/escape-html` · `po-format` · `invoiceEmailFacts`. Άγκυρες Α0-Α7, μεταλλάξεις 7/7. |
