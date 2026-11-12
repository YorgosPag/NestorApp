# ADR-939 — «Γράψτε μας» στη σελίδα παραστατικού: κανάλι `portal` στα ενιαία εισερχόμενα CRM

- **Κατάσταση**: 🟢 **ΥΛΟΠΟΙΗΘΗΚΕ** (2026-11-12) · εκκρεμεί ζωντανή επαλήθευση.
- **Φορέας**: ADR-ACC-018 §16.1 (κανάλια επικοινωνίας της σελίδας παραστατικού), Φάση 2.
- **Σχετικά**: ADR-174 (μοντέλο συνομιλιών / `storeChannelMessage`) · ADR-872 (ιδεμποτία, CHECK 3.92) · ADR-855 (πολιτική ορίων) · ADR-849 (προορισμός ειδοποίησης) · ADR-857 (αποστολέας email, CHECK 3.83).
- **Συντάκτης**: Claude (Opus 5.5) + Γιώργος Παγώνης

---

## 1. Πρόβλημα

Η σελίδα κοινόχρηστου παραστατικού (`/shared/<token>`, ADR-ACC-018 §16) έδειχνε email, τηλέφωνο και κουμπιά εφαρμογών μηνυμάτων (§16.1, Φάση 1). Όλα αυτά βγάζουν τον πελάτη **έξω** από τη σελίδα και η συζήτηση χάνει τη σύνδεση με το παραστατικό. Ο εκδότης δεν έχει καμία συνομιλία «πάνω» στο έγγραφο.

## 2. Τι κάνουν οι άλλοι (2026-11-12)

| Παίκτης | Πρακτική |
|---|---|
| **Zoho Invoice** | Σχόλια πάνω στο τιμολόγιο από τη σελίδα πελάτη. Ο εκδότης ειδοποιείται με email και απαντά με «εμφάνιση στη σελίδα πελάτη». Τα σχόλια μένουν μέσα στο τιμολόγιο. |
| **FreshBooks** | Σχόλιο στο τιμολόγιο και απαντήσεις με reply-to email. |
| **Stripe · Xero · QuickBooks** | Καμία συνομιλία στη σελίδα· μόνο απάντηση στο email. |
| **Zendesk** (inbox) | Ένα γενικό κανάλι «Web» και η πηγή ως χωριστό πεδίο («via web form / web widget / Help Center»). |

**Πού τους ξεπερνάμε**: το μήνυμα **δεν** μένει απομονωμένο στο τιμολόγιο (Zoho). Μπαίνει στα **ενιαία εισερχόμενα CRM**, δίπλα σε Telegram/WhatsApp/email, δεμένο με παραστατικό και πελάτη. Η απάντηση φαίνεται στη σελίδα **και** φεύγει με email σε διεύθυνση που ξέρει **μόνο** ο διακομιστής: ο πελάτης δεν πληκτρολογεί ποτέ email.

## 3. Αποφάσεις (Giorgio, 2026-11-12)

- **(α) Γενικό κανάλι `portal`** (`COMMUNICATION_CHANNELS.PORTAL`, `IDENTITY_PROVIDER.PORTAL`, πλατφόρμα `web`), με την πηγή ως πεδίο της συνομιλίας: `ConversationDocument.subject = { kind: 'invoice', invoiceId, shareId, reference }`. Πρότυπο Zendesk. Νέα σελίδα πελάτη (προσφορά, αγγελία) ⇒ νέο `subject.kind`, όχι νέο κανάλι.
- **(β) Ο μισθωτής ρητά στο `storeChannelMessage`.** Ο γραφέας έγραφε πάντα `getCompanyId()` (εταιρεία της ρύθμισης περιβάλλοντος). Μήνυμα προς άλλον μισθωτή θα γραφόταν σε ξένη εταιρεία και θα ήταν **αόρατο** στα εισερχόμενα (`/api/conversations` φιλτράρει με `ctx.companyId`). Πλέον `companyId` είναι **υποχρεωτικό** πεδίο εισόδου. Οι 3 adapters του Meta περνούν ρητά `getCompanyId()`: **ίδια** συμπεριφορά.
- **(γ) Ταυτότητα πελάτη = ο σύνδεσμος.** `externalUserId = share:<shareId>` (ο ίδιος δράστης με το `INVOICE_PAYMENT_LINK_OPENED`). **Μία** συνομιλία ανά σύνδεσμο. Το παραστατικό, ο μισθωτής και ο εκδότης βγαίνουν **μόνο** από τον σύνδεσμο (`readSharedInvoice`)· το σώμα του αιτήματος φέρει μόνο κείμενο.
- **(δ) Διαδρομή** `GET · POST /api/shares/[shareId]/invoice-payment/messages`. Ίδιοι φρουροί με την όψη/checkout: `withAuth({ allowUnauthenticated })` + κουπόνι επίσκεψης + ενεργός σύνδεσμος. POST με `Idempotency-Key` ανά πάτημα (σύνορο `withAuth`, CHECK 3.92) και `withSensitiveRateLimit`. Κεφαλίδες `no-store` + `noindex`.
- **(ε) Όρια**: κείμενο 1–2.000 χαρακτήρες μετά το trim (`INVOICE_PORTAL_MESSAGE_MAX_LENGTH`, ίδιο για φόρμα και διακομιστή)· **20 μηνύματα ανά σύνδεσμο ανά 24ω** (`INVOICE_PORTAL_MESSAGE_DAILY_QUOTA`, μέσω του υπάρχοντος `withinSubjectQuota`). Αποτυχία του store ⇒ επιτρέπει (ADR-855 Α3).
- **(στ) Ειδοποίηση εκδότη**: `dispatchNotification` με **δικό του** τύπο `CRM_PORTAL_MESSAGE` (`crm.portalMessage`), παραλήπτης ο δημιουργός του συνδέσμου, οντότητα `INVOICE` (νέος τύπος), προορισμός `ENTITY_ROUTES.crm.communications` (νέα διαδρομή στο SSoT). Παράπλευρη πράξη: αποτυχία της δεν ακυρώνει το μήνυμα.
  - **Γιατί όχι το `CRM_NEW_COMMUNICATION`** (αρχική υλοποίηση, διορθώθηκε 2026-11-12): εκείνο είναι το γενικό omnichannel και είναι **κλειστό** από προεπιλογή (`newCommunication: false`). Η ζωντανή επαλήθευση έδειξε ότι ο εκδότης **έχανε σιωπηλά** κάθε μήνυμα πελάτη: ο orchestrator επέστρεφε `skipped` και κανείς δεν το διάβαζε.
  - **Πολιτική**: `isMandatory: false`, προεπιλογή **`true`**, δική του γραμμή στις ρυθμίσεις («Μήνυμα πελάτη από σελίδα παραστατικού»). Ίδια απόφαση με το `properties.firstContactReceived` (ADR-843). Οι υπάρχοντες χρήστες το παίρνουν ανοιχτό **χωρίς migration**, γιατί μόνο ρητό `false` κλείνει (`categorySettingEnabled`).
  - **Καμία σιωπηλή παράλειψη**: το `notifyIssuer` διαβάζει το `DispatchResult`. Το `skipped` (διακόπτης κλειστός, επανάληψη) γράφεται ως `info` με τον λόγο, και το `success:false` ως `warn`.
  - **Έρευνα**: το FreshBooks έχει **δικό του** διακόπτη «ο πελάτης σχολίασε το τιμολόγιο» στις ειδοποιήσεις τιμολογίων. Το Zoho Invoice στέλνει email στον εκδότη όταν σχολιάσει ο πελάτης. Στο Intercom, ό,τι ανατέθηκε **σε σένα** ειδοποιεί πάντα, ενώ το «Unassigned» είναι κλειστό από προεπιλογή.
- **(ζ) Απάντηση εκδότη** από τα εισερχόμενα (`POST /api/conversations/[id]/send`, κλάδος `portal` → `send/portal-reply.ts` → `replyOnInvoicePortal`). Αποστολέας ο **άνθρωπος** (`senderType: agent`, νέο προαιρετικό `agent` στο `storeChannelMessage`· χωρίς αυτό τα webhooks γράφουν bot όπως πριν). Συνημμένα δεν υποστηρίζονται ακόμη στη σελίδα ⇒ ρητό 400.
- **(η) Email απάντησης** στη διεύθυνση όπου στάλθηκε **αυτός** ο σύνδεσμος (`emailHistory[].paymentLinkShareId`, πιο πρόσφατη επιτυχής), αλλιώς στο email του πελάτη στο παραστατικό· χωρίς διεύθυνση η απάντηση μένει μόνο στη σελίδα. **Χωρίς** τον σύνδεσμο μέσα (διαπιστευτήριο, αποθηκεύεται μόνο το hash του). Κείμενα από το **ίδιο** locale της σελίδας (`createBundleTranslate`). Το πλαίσιο του εκδότη από ένα SSoT (`invoiceIssuerEmailFrame`), κοινό με το email του παραστατικού.
- **(θ) Όψη για τον πελάτη = ρητή λίστα**: `{ id, author: 'customer' | 'issuer', text, sentAt }`. Ποτέ ονόματα υπαλλήλων, ids εγγράφων ή email.
- **(ι) UI**: `InvoiceIssuerMessages.tsx` κάτω από το «Επικοινωνία με τον εκδότη». Το πρόχειρο μένει στο `sessionStorage` της καρτέλας, ώστε να μη χαθεί όταν λήξει το κουπόνι επίσκεψης (15′) και ο πελάτης ανανεώσει. Σημασιολογική λίστα (`ol` / `article` / `time`), `role=status` για την επιτυχία, `role=alert` για την άρνηση.

## 4. Αρχεία

| Ρόλος | Αρχείο |
|---|---|
| Λεξιλόγιο | `types/communications.ts` · `types/conversations.ts` · `server/comms/crm/channel-bindings.ts` · `server/comms/orchestrator.ts` · `config/notification-events.ts` |
| Ρύθμιση ειδοποίησης | `services/user-notification-settings/user-notification-settings.types.ts` (`portalMessage`) · `config/notification-preference-rows.ts` · `locales/{el,en}/common-account.json` |
| Σχήμα | `server/types/conversations.firestore.ts` (`subject`) |
| Γραφέας CRM | `server/comms/crm/channel-crm-store.ts` (+ 3 `webhooks/*/crm-adapter.ts`) |
| Πελάτης | `server/accounting/public-invoice/invoice-portal-messages.ts` · `app/api/shares/[shareId]/invoice-payment/messages/route.ts` · `subapps/accounting/types/invoice-portal-messages.ts` |
| Εκδότης | `server/accounting/public-invoice/invoice-portal-reply.ts` · `app/api/conversations/[conversationId]/send/portal-reply.ts` · `services/email-templates/invoice-portal-reply-email.ts` |
| UI | `components/shared/pages/invoice-payment/InvoiceIssuerMessages.tsx` · `useInvoicePortalThread.ts` |
| Κοινά | `lib/middleware/rate-limit-config.ts` · `lib/routes/entityRoutes.ts` · `subapps/accounting/services/email/invoice-email-template.ts` |
| Άγκυρες | `server/accounting/public-invoice/__tests__/invoice-portal-messages.test.ts` (Γ1–Γ5) · `invoice-portal-reply.test.ts` (Π1–Π4) |

## 5. Γνωστά / εκτός εμβέλειας

- Η καρτέλα «Επικοινωνίες» των εισερχομένων δεν έχει δικό της φίλτρο για `portal` (ούτε για WhatsApp/Messenger/Instagram): οι συνομιλίες φαίνονται στο «Όλα».
- Το Telegram δεν περνά ακόμη από το `storeChannelMessage` (ADR-174, εκκρεμότητα ratchet).
- Συνημμένα στη σελίδα πελάτη · ζωντανή ανανέωση του νήματος (σήμερα: μία ανάγνωση ανά άνοιγμα).
- Φάση 3 (ADR-ACC-018 §16.1): `ref`/`start` κωδικοί Messenger/Instagram/Telegram, Viber bot.

## 6. Κέλυφος των σελίδων με κλειδί: route group `(link)` (2026-11-12)

**Εύρημα (ζωντανή επαλήθευση §3):** η σελίδα πελάτη `/shared/<token>` αποδιδόταν **μέσα στο κέλυφος του γραφείου**: πλαϊνή μπάρα έργων/λογιστικής, εναλλαγή εταιρείας, αναζήτηση, φωνητικός βοηθός.

**Ρίζα:** οι σελίδες `shared/`, `showcase/[token]` και `share/photo/` ζούσαν στο `(app)` **χωρίς καμία δήλωση**. Δεν αναφέρονταν σε κανένα από τα `.shell-boundary.json`, `.shell-surface.json`, `.shell-utilities.json`, ούτε σε ADR. Το `(app)/layout.tsx` αποδίδει το κέλυφος **άνευ όρων**, άρα το έβλεπε και ο ανώνυμος επισκέπτης. Οι πύλες ήταν πράσινες: ο Κ1 της CHECK 3.52 είναι αυτο-συνεπής με τον φάκελο, και ο Κ2 κοιτά μόνο τα hooks δημόσιων αγγελιών. Παρενέργεια: **διπλό `<main>`**, γιατί ο `MainContentBridge` του κελύφους είναι `<main>` και οι σελίδες έχουν δικό τους.

**Μέτρηση πριν τη μετακόμιση:** υπολογίστηκε η κλειστότητα εισαγωγών (με τον ίδιο επιλυτή όπως ο Κ2, `scripts/lib/shell-boundary/public-surface.js`). Από τους 12 providers του `(app)`, οι σελίδες ζητούν **μόνο** τον `TooltipProvider`:

| Σελίδα | Αρχεία | Providers του `(app)` που ζητά |
|---|---|---|
| `/shared/[token]` | 1.752 | `TooltipProvider` |
| `/shared/po/[token]` | 87 | — |
| `/showcase/[token]` | 262 | `TooltipProvider` |
| `/share/photo/[id]` | 43 | — |

**Απόφαση:** νέο route group `(link)`, `wearsShell: false`. Οι διευθύνσεις μένουν ίδιες. Το layout είναι **μόνο** `TooltipProvider` + `AuthToolbar`, δηλαδή ο υπάρχων συναρμολογητής των καθολικών δυνατοτήτων (γλώσσα, θέμα, λογαριασμός, CHECK 3.72). Είναι `fixed`, άρα εκτός ροής. Κάθε σελίδα κατέχει το `<main>`, το ύψος και το περιθώριό της, και αυτό δηλώνεται στο `.shell-surface.json`.
- **Όχι `(auth)`**, παρότι εκεί ζουν ήδη 14 σελίδες με κλειδί: το `ShellSurface` του είναι `<main>` που κεντράρει. Θα ξανάφερνε το διπλό `<main>` και θα συρρίκνωνε τις σελίδες πλήρους πλάτους.
- **Όχι `(light)`**: είναι ο ιστότοπος της **πλατφόρμας**, ενώ η σελίδα παραστατικού ανήκει στον **εκδότη**. Το ίδιο κάνουν το Stripe hosted invoice και τα client portal των FreshBooks/Zoho: καμία πλοήγηση του παρόχου.

**Δηλώσεις:** `(link)` στο `.shell-boundary.json` (3.52) και στο `.shell-surface.json`, στα `groupsWithoutFrame`/`groupsWithoutCorridor` (3.63). Αφαιρέθηκαν οι 3 δηλώσεις `shared`/`share`/`showcase` από τα `.workspace-scope.json` και `-baseline.json` (3.60), γιατί αφορούν μόνο το `(app)` και θα έμεναν ορφανές. Ο γεννήτορας ξαναπαρήγαγε το `shell-slice.manifest.json`: αλλάζουν μόνο οι διαδρομές των layouts, με μηδέν αλλαγή σε bytes.

**Εκκρεμεί:** ζωντανή επαλήθευση, με ανώνυμο και με συνδεδεμένο επισκέπτη, στις 4 σελίδες. Ο έλεγχος αν η `AuthToolbar` (πάνω δεξιά) επικαλύπτει περιεχόμενο είναι ανοιχτός.

## 7. Changelog

| Ημερομηνία | Αλλαγή | Συντάκτης |
|---|---|---|
| 2026-11-12 | Αρχική υλοποίηση (§3 α–ι) | Giorgio + Claude Code |
| 2026-11-12 | §3(στ): νέος τύπος `crm.portalMessage` (ανοιχτός από προεπιλογή) στη θέση του κλειστού `crm.newCommunication`. Καταγραφή του `skipped`/`reason` στο `notifyIssuer`. Άγκυρες Γ4 (+3) | Giorgio + Claude Code |
| 2026-11-12 | Εύρημα ζωντανής επαλήθευσης: ωμό κλειδί στην κεφαλίδα φίλτρων των εισερχομένων (`/crm/communications`). Το `communicationsFiltersConfig` διαβάζει το namespace `filters`, αλλά το `communicationsTitle` υπήρχε μόνο στο `building-filters.json`. Προστέθηκε στο `filters.json` (el/en). Μένουν ωμά στο ίδιο πάνελ: `allChannels`, `status.sent`, `status.received`, `status.failed` | Giorgio + Claude Code |
| 2026-11-12 | §6: οι σελίδες με κλειδί (`/shared/*`, `/showcase/[token]`, `/share/photo/*`) βγήκαν από το κέλυφος του γραφείου και πήγαν στο νέο route group `(link)`. Δηλώσεις στις CHECK 3.52, 3.63 και 3.60. Τέλος το διπλό `<main>` | Giorgio + Claude Code |
