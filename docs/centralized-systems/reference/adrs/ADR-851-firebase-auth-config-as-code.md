# ADR-851 — Η ρύθμιση της Firebase Auth ως κώδικας · τα email λογαριασμού από το δικό μας σύστημα

**Κατάσταση**: ✅ Υλοποιημένο (κώδικας) · 🔶 δύο βήματα κονσόλας εκκρεμούν (§7) · **Ημερομηνία**: 2026-09-11
**Σχετικά**: ADR-351 (το αδελφό IaC: CORS) · ADR-740 (cron) · ADR-844 §13 (φύλαξη γραμματοκιβωτίου) ·
ADR-850 (αλλαγή email) · ADR-849 (γλώσσα email) · ADR-660 §6 (αίτημα ένταξης) · ADR-245 (`API_ROUTES`)

---

## 1. Το εύρημα — μετρημένο, όχι υποθετικό

Η ρύθμιση της Firebase Auth ζούσε **μόνο στην κονσόλα** και κανένα αρχείο του repo δεν την ήξερε.
Μια ανάγνωση (`projects.getConfig`, Identity Toolkit Admin v2, μόνο GET) στις 2026-09-11 βρήκε:

| Πεδίο | Ζωντανό | Συνέπεια |
|---|---|---|
| 🔴🔴 `notification.sendEmail.callbackUri` | `https://nestor-pagonis.vercel.app/auth/action` → **404 `DEPLOYMENT_NOT_FOUND`** | **κάθε** σύνδεσμος email της Firebase (επαναφορά κωδικού · επιβεβαίωση · αλλαγή/ανάκτηση email · ο σύνδεσμος του «ασφαλίσαμε») οδηγούσε σε **ελεύθερο** υποdomain τρίτου — όποιος το διεκδικούσε στο Vercel θα παραλάμβανε **oobCodes**, δηλαδή λογαριασμούς |
| 🔴 `notification.defaultLocale` | `en` | η εφαρμογή είναι ελληνική· κανένα `auth.languageCode` στον κώδικα |
| 🔴 πρότυπο «Email address change» | θέμα **«Επαναφορά κωδικού πρόσβασης»** πάνω σε αγγλικό σώμα | λάθος μήνυμα τη στιγμή που ο άνθρωπος ίσως χάνει τον λογαριασμό του |
| 🔴 `authorizedDomains` | 3 Vercel (2 `DEPLOYMENT_NOT_FOUND`) + `sslip.io` (μόνο σε παλιό `TELEGRAM_WEBHOOK_URL`) + `192.168.0.45` | ανακατευθύνσεις OAuth / σύνδεσμοι συνέχειας προς domains που δεν ελέγχουμε |
| ✅ `emailPrivacyConfig.enableImprovedEmailPrivacy` | `true` | η προστασία απαρίθμησης **είναι** ενεργή — κλείνει το ADR-850 §7 #1 (α) με μέτρηση |

`nestorconstruct.gr/auth/action` = **200** (το 403 του handoff ήταν artifact του curl χωρίς User-Agent).

## 2. Τι κάνουν οι μεγάλοι — με βαθμό βεβαιότητας

| Θέμα | Πρακτική | Βεβαιότητα |
|---|---|---|
| ρύθμιση υποδομής | στο git, με έλεγχο απόκλισης (Terraform `google_identity_platform_config` · ADR-351 εδώ) | υψηλή |
| email ασφαλείας | από **δικό τους** σύστημα, στη γλώσσα του **λογαριασμού** (Google · GitHub · Figma) | μέση (δεν τεκμηριώνεται δημόσια ανά εταιρεία· γενική πρακτική SaaS) |
| απαρίθμηση | ίδια απάντηση για γνωστό/άγνωστο email — **και** ίδιος χρόνος (OWASP Authentication Cheat Sheet) | υψηλή |
| πρότυπα Firebase | **ένα** προσαρμοσμένο ανά τύπο, **χωρίς** εκδοχή γλώσσας· η προσαρμογή σβήνει την αυτόματη μετάφραση | υψηλή (REST reference · firebase-js-sdk#5846) |

## 3. Οι αποφάσεις

**Α. Η ρύθμιση ως κώδικας** — `src/config/firebase-auth-config.ts` (δήλωση) · `src/server/firebase-auth-config/`
(`auth-config-state.ts` καθαρή σύγκριση · `identity-toolkit-config.ts` I/O · `auth-config-audit.ts` σύνθεση).
- ⚠️ **Στο `src/config`, όχι στο `infrastructure/`** (απόκλιση από ADR-351, με λόγο): ο έλεγχος τρέχει **και**
  μέσα στον διακομιστή (cron), και το standalone build του Next παίρνει μόνο ό,τι είναι στον γράφο εισαγωγών.
- 🔑 **Τίποτα παραγόμενο δεν γράφεται με το χέρι**: `callbackUri` = `joinOrigin(publicOrigin(), AUTH_ROUTES.action)`·
  τα δύο domains της Firebase από το project id· το domain της εφαρμογής από το `publicOrigin()`.
- 🔒 **Ελάχιστο προνόμιο**: `authorizedDomains` = `localhost` + `<project>.firebaseapp.com` + `<project>.web.app` + το δικό μας.

**Β. Τι γράφει ο κώδικας και τι όχι — ΜΕΤΡΗΜΕΝΟ, όχι τεκμηριωμένο πουθενά**:

| Διαδρομή | `projects.updateConfig` |
|---|---|
| `authorizedDomains` · `notification.defaultLocale` · `emailPrivacyConfig.*` | ✅ **γράφτηκε** στην παραγωγή 2026-09-11 |
| `notification.sendEmail.callbackUri` | ❌ `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` |
| `notification.sendEmail.*Template` | ❌ `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` |

Και PATCH με **έστω μία** απαγορευμένη διαδρομή απορρίπτεται **ολόκληρο** (μετρήθηκε: ούτε τα domains γράφτηκαν).
⇒ `CONSOLE_ONLY_PATHS` **κρίνονται** (απόκλιση = εύρημα) αλλά **ποτέ** δεν μπαίνουν σε PATCH — το `patchForDrifts`
**αρνείται** πριν φτάσει στη Google.

**Γ. Επιτήρηση** — `npm run firebase-auth:config:check` (exit 1 σε απόκλιση) · `firebase-auth:config:apply -- --expect-drift=N`
(αρνείται αν η κονσόλα άλλαξε στο μεταξύ) · `--export-templates=<dir>` (το πρότυπο προς επικόλληση) · **cron**
`firebase-auth-config-drift` καθημερινά 04:15 ⇒ Sentry σε απόκλιση. 🏆 Πέρα από το ADR-351: εκεί η επαλήθευση είναι χειροκίνητη.

**Δ. Τα email λογαριασμού από το δικό μας σύστημα** (`server/auth/auth-action-mail.ts`):
- `POST /api/auth/password-reset` — δημόσιο, **ίδιο `202` για όλους**, και η αναζήτηση/αποστολή τρέχουν στο
  **`after()`** ⇒ ούτε ο **χρόνος** προδίδει ποιος έχει λογαριασμό.
- `POST /api/auth/email-verification` — ID token **χωρίς** claims (`verifiedBearerUid`, `token-credentials.ts`).
- **Γλώσσα** = η **δηλωμένη** του χρήστη (`loadDeclaredEmailLanguage`, ADR-849), αλλιώς της οθόνης που ζήτησε.
- **Σύνδεσμος** = μόνο `mode`+`oobCode` από τη Firebase, ξαναχτισμένος στο `publicUrl()` (`auth-action-link.ts`
  `ownedActionLink`) ⇒ τα **δικά μας** email δεν εξαρτώνται **καθόλου** από την κονσόλα.
- **Όριο ανά παραλήπτη** `AUTH_MAIL_RECIPIENT_QUOTA` (3 / 15′, κλειδί κατακερματισμένο) — πάνω από το όριο ανά IP·
  `checkQuota` στο **ίδιο** store (Upstash). Αποτυχία store ⇒ επιτρέπεται (ίδια πολιτική με `withRateLimit`).
- Πελάτης: `auth/account-mail.client.ts`· σφάλματα με κωδικούς που ο χάρτης **ήδη** ξέρει (`auth/too-many-requests`…).
  Το `useAuthActions` παίρνει `currentLanguage()` ως **getter** από το `AuthContext` — δεν φορτώνει το i18n.
- Η εγγραφή **δεν** δηλώνεται αποτυχημένη αν απέτυχε μόνο το email επιβεβαίωσης (αλλιώς «το email χρησιμοποιείται ήδη»).

**Ε. `auth.languageCode`** — **ένας** γραφέας (`auth/firebase-auth-language.ts` `bindAuthLanguage`), εγκατεστημένος στο
`AuthProvider`: τρέχουσα γλώσσα + κάθε `languageChanged` (`pseudo` ⇒ `el`). Καλύπτει ό,τι στέλνει **ακόμη** η Firebase:
την επιβεβαίωση της νέας διεύθυνσης του `verifyBeforeUpdateEmail` (πρότυπο «Verify before change», **μη**
προσαρμοσμένο ⇒ μεταφράζεται αυτόματα) και την ειδοποίηση της παλιάς διεύθυνσης.

**Ζ. Ένα λεξιλόγιο, ένα πλαίσιο** — `services/email-templates/auth-action-email-texts.ts` (`Record<HumanLanguage,…>`) ·
`app-message-wording.ts` (τύπος + `isCompleteWording`, καθαρό) · `app-message-email.ts` (τμήμα + πλαίσιο) ·
`auth-action-email.ts` (δικό μας email **και** δίγλωσσο πρότυπο Firebase από το **ίδιο** τμήμα). `wrapInBrandedTemplate`
απέκτησε `lang` (WCAG 3.1.1· προεπιλογή `el`, μηδέν αλλαγή για τους σημερινούς καλούντες) · `NESTOR_APP_LOGO_PATH` εξάγεται.

## 4. 🏆 Πού ξεπερνά την πρακτική

1. **Η απόκλιση φαίνεται μέσα σε 24 ώρες**, όχι σε μήνες — το περιστατικό Vercel κράτησε από τις 2026-05-09.
2. **Οι δικοί μας σύνδεσμοι δεν εξαρτώνται από την κονσόλα** — ούτε αν κάποιος ξανασπάσει το action URL.
3. **Κλειστό σύνολο διαδρομών**: ό,τι δεν δηλώνεται δεν διαβάζεται, δεν τυπώνεται, δεν γράφεται (SMTP/κλειδιά ποτέ).
4. **Χρόνος ίδιος για όλους** στην επαναφορά κωδικού (`after()`), όχι μόνο σώμα.

## 5. Αρχεία

Νέα: `src/config/firebase-auth-config.ts` · `src/server/firebase-auth-config/{auth-config-state,identity-toolkit-config,auth-config-audit}.ts` ·
`scripts/firebase-auth/{auth-config,probe-oob-survival}.ts` · `src/lib/cron/jobs/firebase-auth-config-drift.job.ts` ·
`src/app/api/cron/firebase-auth-config-drift/route.ts` · `src/server/auth/{auth-action-mail,auth-action-link}.ts` ·
`src/app/api/auth/{password-reset,email-verification}/route.ts` · `src/auth/{account-mail.client,firebase-auth-language}.ts` ·
`src/services/email-templates/{auth-action-email-texts,auth-action-email,app-message-wording,app-message-email}.ts`.
Αλλάζουν: `firebaseAdmin.ts` (`getAdminAccessToken`) · `authRoutes.ts` (`AUTH_ROUTES.action`) · `cron-schedule.ts` ·
`domain-constants.ts` · `rate-limit-config.ts` / `rate-limiter.ts` (`checkQuota`) · `user-notification-settings-store.ts`
(`loadDeclaredEmailLanguage`) · `token-credentials.ts` (`verifiedBearerUid`) · `useAuthActions.ts` · `AuthContext.tsx` ·
`base-email-template.ts` · `scripts/_shared/loadEnvLocal.js` (`applyEnvLocal`) · `package.json`.

## 6. Άγκυρες — και οι μεταλλάξεις που τις ρίχνουν

`auth-config-state.test.ts` (Σ/Δ/Π) · `auth-action-email.test.ts` (Α/Φ) · `auth-action-mail.test.ts` (Α/Γ/Σ/Ο/Ε) ·
`account-mail.client.test.ts` · `firebase-auth-language.test.ts`. Μεταλλάξεις (επαναφορά md5 στην ίδια εκτέλεση):
M8 σύγκριση τυφλή στο `callbackUri` · M9 PATCH όλων των διαδρομών · M10 αγγλικά πρώτα στο πρότυπο · M11 `<html lang>`
αγνοεί τον παραλήπτη — **όλες κόκκινες**.

## 7. 🔶 Δηλωμένα όρια

1. **Κονσόλα — δύο βήματα που μόνο άνθρωπος κάνει** (η Google αρνείται μέσω API):
   (α) *Authentication → Templates → Customize action URL* = `https://nestorconstruct.gr/auth/action` —
   🔴 **μέχρι να γίνει**, ό,τι στέλνει η ίδια η Firebase (επιβεβαίωση νέας διεύθυνσης, ειδοποίηση παλιάς) οδηγεί σε 404·
   (β) πρότυπο «Email address change»: θέμα + σώμα από `--export-templates`. Μετά: `firebase-auth:config:check` ✅.
2. Το πρότυπο **«Verify before change»** δεν εκτίθεται στο API ⇒ **ΔΕΝ ΚΡΙΝΕΤΑΙ** (δηλώνεται στο `--check`)· μένει μη
   προσαρμοσμένο ώστε η Firebase να το μεταφράζει μόνη της.
3. Το © έτους στο πρότυπο ⇒ **αληθινή** απόκλιση κάθε 1η Ιανουαρίου (το email της Firebase γράφει τότε λάθος έτος).
4. Το email «ασφαλίσαμε» (ADR-844 §13) μένει **ελληνικό**: η πρόσκληση πρώτης επαφής **δεν** καταγράφει γλώσσα.

## 8. Πύλες

3.8 · 3.33 (`generate:i18n-types`) · 3.34 (`/profile` 4.707/5.883, καμία άρνηση) · 3.28 (`jscpd:diff`) · cron-route-contract ·
**N.17 χωρίς `tsc`**.

## Changelog

| Ημερομηνία | Τι |
|---|---|
| **2026-09-11** | 🔴🔴 **Το action URL όλων των email της Firebase έδειχνε σε νεκρό Vercel** (404 `DEPLOYMENT_NOT_FOUND`) — βρέθηκε με ανάγνωση `getConfig`, όχι από παράπονο. ✅ Ρύθμιση ως κώδικας + ημερήσιος έλεγχος απόκλισης· **γράφτηκαν** `defaultLocale: el` και `authorizedDomains` (−5 domains)· **μετρήθηκε** ότι `callbackUri` και πρότυπα είναι **μόνο κονσόλας** (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, PATCH ολόκληρο απορριπτόμενο). Email επαναφοράς/επιβεβαίωσης από το **δικό μας** σύστημα, στη γλώσσα του χρήστη, με σύνδεσμο που δεν εξαρτάται από την κονσόλα, ίδιο χρόνο απόκρισης για όλους και όριο ανά παραλήπτη. `auth.languageCode` με έναν γραφέα. 3 κλώνοι που έπιασε το CHECK 3.28 **μέσα** στη δουλειά εξήχθησαν (`applyEnvLocal` · `verifiedBearerUid` · `isCompleteWording`). |
