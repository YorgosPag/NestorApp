# Handoff — Κανάλια «Επικοινωνία με τον εκδότη» στη σελίδα κοινόχρηστου παραστατικού · Έρευνα ΟΛΟΚΛΗΡΩΘΗΚΕ · Επόμενο: αποφάσεις Giorgio → Φάση 1

**Ημερομηνία:** 2026-11-11 · **Worktree:** `C:\Nestor_Worktrees\product-portal` · **Κλαδί:** `agent/product-portal`

## Κανόνες (Giorgio), αμετάβλητοι
Κάθε βήμα με «ναι» · κανένα test χωρίς έγκριση · όχι tsc · SSoT grep πριν από κώδικα · έρευνα στο διαδίκτυο όπου δεν είσαι
σίγουρος · ποιότητα «μεγάλων παικτών» και καλύτερα · commit μόνο σε `agent/*` με ρητή λίστα · ποτέ commit στο `main` ·
**wt:land και push ΜΟΝΟ με ρητή εντολή Giorgio** · ποτέ `--no-verify` / `SKIP_*` · ελληνικά. Μην αγγίξεις αρχεία άλλων worktrees.
N.8: η εργασία είναι 5+ αρχεία σε 3+ περιοχές ⇒ ο Giorgio αποφασίζει Plan Mode ή Orchestrator. N.14: προτεινόμενο μοντέλο Opus.

## Άλλες εκκρεμότητες στο ίδιο κλαδί (ΟΧΙ αυτής της εργασίας)
- `7ccd6739` feat(agent-worktree) ADR-925 §16, συλλογή handoffs (`wt:handoffs` / `wt:land` / `wt:remove`). Δεσμευμένο, hook ΠΡΑΣΙΝΟ,
  `test:agent-worktree` 84/84, μεταλλάξεις 2/2. **ΟΧΙ land.** Μαζί με το `1a4e1ba4` (handoff). Land μόνο με εντολή Giorgio.
- Απόφαση Giorgio (α): **μία φορά** `npm run wt:handoffs -- --all` για όλα τα worktrees. Ακόμη ΔΕΝ έτρεξε, θέλει ρητή εντολή.
- Πρόταση (δεν εγκρίθηκε): μεταφορά του `writeFileAtomic` του `scripts/lib/i18n-shell-slice/source-cache.js` στο νέο SSoT
  `scripts/lib/fs/atomic-write.js`. Θέλει αναπαραγωγή του shell slice (CHECK 3.34).
- Ζωντανή επαλήθευση ADR-929 Σ1.3β: `HANDOFFS/2026-11-11_ADR-929_S1.3b-landed-pushed_next-live-verification_handoff.md`, όταν πει ο Giorgio.

## 1. Το αίτημα
Στη σελίδα `nestorconstruct.gr/shared/<token>` (κοινόχρηστο τιμολόγιο με SEPA QR) το μπλοκ «Επικοινωνία με τον εκδότη»
δείχνει μόνο email και τηλέφωνο. Ο Giorgio θέλει:
- (α) επικοινωνία μέσω των καναλιών που έχει ήδη η εφαρμογή: Telegram, Instagram, Messenger, WhatsApp (+ Viber)·
- (β) **CRM ως κανάλι**: «Γράψτε μας» μέσα στη σελίδα. Το μήνυμα πάει στο CRM, δεμένο με πελάτη και παραστατικό, και η
  απάντηση φαίνεται στην ίδια σελίδα.

## 2. Ευρήματα κώδικα (μετρημένα από Explore agent, επαλήθευσε τις γραμμές πριν από κώδικα)
- **Σελίδα:** `src/app/(app)/shared/[token]/page.tsx` → `LazyRoutes.SharedFile` (`src/utils/lazyRoutesAdr294.tsx:341`, `ssr:false`).
  Το `shared/layout.tsx` είναι server, `force-dynamic`, `CREDENTIAL_LINK_PAGE_METADATA` (noindex + no-referrer) και λέει να ΜΗ
  γίνει server component.
- **Μπλοκ:** `IssuerContact` στο `src/components/shared/pages/invoice-payment/SharedInvoicePaymentPageContent.tsx` (~90-107),
  `view.issuer.{email,phone,website}`. i18n: `src/i18n/locales/el/accounting-public-payment.json:81-86` (`contact.*`).
  Hook: `useInvoicePublicView.ts` → `GET /api/shares/{shareId}/invoice-payment`.
- **Δεδομένα εκδότη:** `publicIssuer()` στο `src/subapps/accounting/services/public-invoice/invoice-public-view.ts:42-52`,
  από το στιγμιότυπο `InvoiceIssuer` (`src/subapps/accounting/types/invoice.ts:123`). Δεν έχει κανάλια.
- **Token:** `POST /api/shares/resolve` → `resolvePublicShare` (`src/server/sharing/share-resolve.ts`) → cookie HttpOnly
  `nestor_share_<shareId>` (Path=/api, 15′, HMAC: `share-access-grant.ts`). Οι συνέχειες ελέγχουν `requestHasShareAccessGrant`
  και `findActiveShareOf` (`share-active-lookup.ts`: `isActive`, `entityType`, `expiresAt`). Το `StoredShare` έχει `companyId`,
  `createdBy`, `entityId`. Ανάκληση: `/api/shares/[shareId]/revoke`. Ο θεατής είναι ανώνυμος.
- **Κανάλια εταιρείας:** `companies.socialMedia[]` μέσω `src/services/company/company-branding-resolver.ts` (`pickAllSocials`).
  SSoT URL προφίλ: `src/lib/contact/social-platform-profiles.ts` (`SOCIAL_PLATFORM_PROFILES`, `buildSocialProfileUrl`,
  `normaliseSocialHandle`). Λεξιλόγιο: `src/lib/contact/social-media-type-vocabulary.ts:56`, **χωρίς Messenger και Viber**.
  Σύνδεσμοι κοινοποίησης (όχι επικοινωνίας): `src/lib/share-utils.ts:236-257`, `src/lib/social-platform-system/*`.
- **Εισερχόμενα:** Messenger, Instagram, WhatsApp → `src/server/comms/crm/channel-crm-store.ts` (`storeChannelMessage`,
  ιδεμποτικό) → `MESSAGES` / `CONVERSATIONS` / `EXTERNAL_IDENTITIES` (ADR-029). Telegram: `webhooks/telegram/crm/store.ts`.
  Inbox UI: `src/components/crm/communications/*`. **Κενά:** το `linkedContactId` και το `linkedEntities.contactId` δεν
  γράφονται ποτέ· κανένας χειρισμός `ref` / `referral` / start-payload.
- **Νήματα ADR-867 (CHECK 3.89): ΔΕΝ ταιριάζουν.** Θέλουν συνδεδεμένους χρήστες και το ADR §2.1/§2.3 απορρίπτει ρητά
  άγνωστους και την επαναχρήση `conversations`. Το CRM-κανάλι ανήκει στο μοντέλο ADR-029.
- **Όρια ασφαλείας:** `withAuth({allowUnauthenticated:true})` (`src/lib/auth/middleware.ts:91`) + `withSensitiveRateLimit` /
  `withHeavyRateLimit` (`src/lib/middleware/with-rate-limit.ts`). Ιδεμποτία CHECK 3.92 (`Idempotency-Key` ή
  `mode:'natural'`). Πρότυπο ημερήσιου ορίου: `QUOTE_REQUEST_PAIR_DAILY_QUOTA`. Πρότυπα endpoints: `/api/shares/resolve`,
  `/api/first-contacts/guest`.
- **Ειδοποιήσεις:** `dispatchNotification` (`src/server/notifications/notification-orchestrator.ts:191`, νέο event στο
  `EVENT_CATEGORY_MAP`, παραλήπτης `StoredShare.createdBy`). Email: `sendReplyViaMailgun` / `enqueueMessage`. Ο αποστολέας
  `From:` περνά από τη ρίζα (CHECK 3.83).

## 3. Ευρήματα διαδικτύου (agent· όσα είναι UNVERIFIED να ξαναελεγχθούν)
| Κανάλι | Σύνδεσμος | Έτοιμο κείμενο | Κρυφή αναφορά στο webhook |
|---|---|---|---|
| WhatsApp | `wa.me/<E164>?text=` | ✅ | ❌ (μόνο μέσα από το κείμενο) |
| Messenger | `m.me/<page>?ref=` (`?text=`) | ✅ με επιφύλαξη | ✅ `ref` έως 2.083 χαρακτήρες, χωρίς εγγύηση· `messaging_postbacks` / `messaging_referrals` |
| Instagram | `ig.me/m/<user>?ref=` | ❌ | ✅ `ref` [A-Za-z0-9-_=], θέλει Icebreakers |
| Telegram bot | `t.me/<bot>?start=` | ➖ πατά «Start» | ✅ έως 64, [A-Za-z0-9_-] |
| Viber | `viber://pa?chatURI=&context=&text=` (bot) / `viber://chat?number=` | μόνο bot | μόνο bot (100 €/μήνα για bots μετά τις 2024-02-05) |
- Πηγές: core.telegram.org/bots/features#deep-linking · developers.facebook.com/docs/messenger-platform/discovery/m-me-links ·
  developers.facebook.com/documentation/business-messaging/instagram-messaging/features/ig-me-links ·
  developers.viber.com/docs/tools/deep-links · help.viber.com/hc/articles/15247629658525 · w3.org/TR/capability-urls.
- Στην Ελλάδα είναι μεγάλα και τα τρία (Viber, Messenger, WhatsApp). Δεν βρέθηκε έγκυρη έρευνα με μερίδια.
- Μεγάλοι παίκτες: κανείς δεν δείχνει κουμπιά εφαρμογών μηνυμάτων στη σελίδα τιμολογίου. Ο Zoho έχει σχόλια στο τιμολόγιο·
  Stripe και Xero μόνο στοιχεία επικοινωνίας (εν μέρει UNVERIFIED) ⇒ το CRM-κανάλι μαζί με τα κανάλια μηνυμάτων τους ξεπερνά.
- Ασφάλεια: ο κρυφός σύνδεσμος ΠΟΤΕ σε σύνδεσμο ή `ref` προς τρίτους. Αντί γι' αυτόν σύντομος κωδικός που αντιστοιχίζει ο server.
  Στο έτοιμο κείμενο μόνο ο αριθμός του παραστατικού (όχι ποσά, όχι PII). Φόρμα: όριο ρυθμού ανά σύνδεσμο και IP, όριο μήκους,
  απλό κείμενο· το έγγραφο το βρίσκει ο server μόνο από τον σύνδεσμο.

## 4. Προτεινόμενο σχέδιο (ΔΕΝ εγκρίθηκε ακόμη)
- **Φάση 1. Κουμπιά καναλιών:** κεντρικός builder «άνοιξε συνομιλία + έτοιμο κείμενο» δίπλα στο `social-platform-profiles.ts`·
  λεξιλόγιο + Messenger, Viber· τα κανάλια της εταιρείας μπαίνουν στο `InvoicePublicView` από τον server· έτοιμο κείμενο μόνο
  με τον αριθμό του παραστατικού.
- **Φάση 2. CRM-κανάλι «Γράψτε μας»:** δημόσιο POST με την πρόσβαση του συνδέσμου (όριο ρυθμού, ημερήσιο όριο ανά σύνδεσμο,
  ιδεμποτία, απλό κείμενο) → συνομιλίες/μηνύματα ADR-029 με νέο κανάλι «σύνδεσμος παραστατικού», δεμένα με παραστατικό και πελάτη ·
  ειδοποίηση στον εκδότη · η απάντηση φαίνεται στη σελίδα (GET με την ίδια πρόσβαση) + email στον πελάτη.
- **Φάση 3. Αυτόματη σύνδεση:** `ref` στο Messenger/Instagram και `start` στο Telegram, με σύντομο κωδικό → σύνδεση συνομιλίας
  με παραστατικό και επαφή· κλείνει και το κενό του `linkedContactId`.
- Νέο ADR: αριθμός με `ls docs/centralized-systems/reference/adrs/` τη στιγμή που χρειαστεί (CHECK 3.49).

## 5. ΕΠΟΜΕΝΟ: ανοιχτές αποφάσεις Giorgio (ρώτα τες ΠΡΩΤΑ, μην κάνεις τίποτα πριν)
1. Πηγή καναλιών: **τρέχοντα κανάλια της εταιρείας** (πρόταση) ή στιγμιότυπο κατά την έκδοση;
2. Viber: **απλός σύνδεσμος προς αριθμό χωρίς bot** (πρόταση) ή bot (100 €/μήνα);
3. Σειρά: **Φάση 1 → 2 → 3** (πρόταση);
4. Εκτέλεση: **Plan Mode ανά φάση** (πρόταση) ή Orchestrator (N.8);
Μετά από «ναι»: SSoT grep για τη Φάση 1 (επαλήθευση των γραμμών του §2) → σχέδιο αρχείων → «ναι» → κώδικας → tests με έγκριση → commit.
