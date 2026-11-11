# Handoff: ADR-939 «Γράψτε μας» στη σελίδα παραστατικού · ΥΛΟΠΟΙΗΘΗΚΕ · Επόμενο: έλεγχος commit → land/push (εντολή Giorgio) → ζωντανή επαλήθευση

**Ημερομηνία:** 2026-11-12 · **Worktree:** `C:\Nestor_Worktrees\product-portal` · **Κλαδί:** `agent/product-portal`
Προηγούμενο handoff: `HANDOFFS/2026-11-12_issuer-contact-channels_phase1-live-verified_next-phase2-crm-write-to-us_handoff.md`

## Κανόνες (Giorgio), αμετάβλητοι
Κάθε βήμα μόνο με «ναι» · κανένα test χωρίς έγκριση · όχι tsc · πραγματικό SSoT grep πριν από κώδικα · έρευνα στο διαδίκτυο
όπου δεν είσαι σίγουρος · ποιότητα «μεγάλων παικτών» και καλύτερα · commit μόνο σε `agent/*` με ρητή λίστα · ποτέ commit στο
`main` · **wt:land και push ΜΟΝΟ με ρητή εντολή Giorgio** · ποτέ `--no-verify` / `SKIP_*` · ελληνικά · μην αγγίξεις αρχεία
άλλων worktrees · **ΠΟΤΕ** μη ζητήσεις / επαναλάβεις / γράψεις tokens ή secrets.

## 1. Κατάσταση
- Ο κώδικας της Φάσης 2 + ADR-939 + το handoff δεσμεύτηκαν (ή επιχειρήθηκε) σε **ένα** commit στο `agent/product-portal`.
  ⚠️ Η **πρώτη** απόπειρα commit σκοτώθηκε από το Claude Code λόγω **χαμηλής μνήμης** του υπολογιστή (όχι αποτυχία πύλης):
  οι **86 παράλληλοι έλεγχοι + 3.22 πέρασαν**, σταμάτησε στα jest του hook (Accounting · Type Safety). Ο hook κρατά >10′.
  **ΠΡΩΤΟ ΒΗΜΑ**: `git log --oneline -2` + `git status --short`. Αν το commit **δεν** υπάρχει → ανάφερε και ρώτα τον Giorgio.
- **ΟΧΙ land, ΟΧΙ push.** Ο Giorgio αποφασίζει.
- Tests (εγκεκριμένα, μόνο τα νέα): `src/server/accounting/public-invoice/__tests__/invoice-portal-messages.test.ts` (Γ1–Γ5)
  + `invoice-portal-reply.test.ts` (Π1–Π4) → **16/16 πράσινα**.
- ADR-ACC-018 §16.1 (δ′): **Viber = μόνο λογαριασμός Business** (απόφαση Giorgio «Α», καμία αλλαγή κώδικα).

## 2. Τι υλοποιήθηκε (λεπτομέρειες: ADR-939)
- Νέο γενικό κανάλι **`portal`** (`COMMUNICATION_CHANNELS` / `IDENTITY_PROVIDER` / `channel-bindings` / `orchestrator`),
  πηγή συνομιλίας `ConversationDocument.subject = { kind:'invoice', invoiceId, shareId, reference }` (πρότυπο Zendesk «via»).
- `storeChannelMessage`: **`companyId` υποχρεωτικό** (πριν: `getCompanyId()` ⇒ μήνυμα άλλου μισθωτή αόρατο)· 3 adapters
  Meta περνούν `getCompanyId()` (ίδια συμπεριφορά)· προαιρετικά `subject`, `agent` (ανθρώπινη απάντηση).
- `GET·POST /api/shares/[shareId]/invoice-payment/messages` (κουπόνι επίσκεψης + ενεργός σύνδεσμος, Idempotency-Key,
  SENSITIVE, 20 μηνύματα/σύνδεσμο/24ω `INVOICE_PORTAL_MESSAGE_DAILY_QUOTA`, 2.000 χαρακτήρες).
- Ειδοποίηση εκδότη `CRM_NEW_COMMUNICATION` → δημιουργός συνδέσμου, οντότητα `INVOICE` (νέα), προορισμός
  `ENTITY_ROUTES.crm.communications` (νέο). i18n `notifications.portal.newMessage`.
- Απάντηση από τα εισερχόμενα: κλάδος `portal` στο `conversations/[id]/send` → `send/portal-reply.ts` →
  `server/accounting/public-invoice/invoice-portal-reply.ts` (σελίδα + email στη διεύθυνση του συνδέσμου από
  `emailHistory[].paymentLinkShareId`, αλλιώς `customer.email`). Email: `services/email-templates/invoice-portal-reply-email.ts`
  (κείμενα από `accounting-public-payment.json` → `replyEmail.*`). Νέο SSoT `invoiceIssuerEmailFrame` (και στο email τιμολογίου).
- UI: `InvoiceIssuerMessages.tsx` + `useInvoicePortalThread.ts` (πρόχειρο σε `sessionStorage`), κλειδιά `messages.*`.
- ADR-939 (νέο), ADR-ACC-018 changelog + §16.1, ADR-174 changelog. Παραγόμενα i18n (`types/i18n.ts`, shell slice) ξαναπαράχθηκαν.

## 3. ΕΠΟΜΕΝΑ (μόνο με «ναι» Giorgio)
1. Επιβεβαίωση commit (§1). Μετά, με εντολή Giorgio: `npm run wt:land -- product-portal` → push.
2. **Ζωντανή επαλήθευση** μετά το deploy: σελίδα Α-10 (`/shared/<token>`) → γράψε μήνυμα → φαίνεται στο νήμα · ειδοποίηση στο
   κουδούνι → `/crm/communications` → συνομιλία `portal` (εικονίδιο Globe) → απάντηση → φαίνεται στη σελίδα + email
   (χρειάζεται **δεύτερος άνθρωπος/λογαριασμός** για πραγματικό έλεγχο email). Έλεγχος ορίου, el/en, κινητό.
3. Προτάσεις (όχι εγκεκριμένες): φίλτρο «Σελίδα πελάτη» στα εισερχόμενα (λείπουν και WhatsApp/Messenger/Instagram) ·
   deep link της ειδοποίησης στη συγκεκριμένη συνομιλία.
4. Μετά: οθόνη social της εταιρείας (§4 προηγούμενου handoff, πεδίο «αριθμός Viber Business») · Φάση 3.
5. Telegram (τα κάνει ο Giorgio): Devices + Two-Step Verification · Commands/Menu Button/Mini App · `/start` @Nestor_P_Bot ·
   άγνωστο bot του «Your token was replaced» 21:14.
