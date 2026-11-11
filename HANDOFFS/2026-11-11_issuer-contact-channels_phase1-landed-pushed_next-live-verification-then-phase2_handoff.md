# Handoff: Κανάλια «Επικοινωνία με τον εκδότη» · Φάση 1 LANDED + PUSH σε εξέλιξη · Επόμενο: ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ → Φάση 2

**Ημερομηνία:** 2026-11-11 · **Worktree:** `C:\Nestor_Worktrees\product-portal` · **Κλαδί:** `agent/product-portal`
Προηγούμενο handoff (έρευνα και αποφάσεις): `HANDOFFS/2026-11-11_issuer-contact-channels_research-done_next-decisions-phase1_handoff.md`

## Κανόνες (Giorgio), αμετάβλητοι
Κάθε βήμα μόνο με «ναι» · κανένα test χωρίς έγκριση · όχι tsc · SSoT grep πριν από κώδικα · έρευνα στο διαδίκτυο όπου δεν
είσαι σίγουρος · ποιότητα «μεγάλων παικτών» και καλύτερα · commit μόνο σε `agent/*` με ρητή λίστα · ποτέ commit στο `main` ·
**wt:land και push ΜΟΝΟ με ρητή εντολή Giorgio** · ποτέ `--no-verify` / `SKIP_*` · ελληνικά. Μην αγγίξεις αρχεία άλλων worktrees.

## 1. Κατάσταση
- Φάση 1 = commit **`49318674`**, **landed** στο τοπικό `main` (HEAD `49318674`). Μαζί μπήκαν `b9a5f34b`, `4710452f` (ADR-925 §16
  wt:handoffs/land/remove), `d9daf6ba`, `86539f44`. Ο Giorgio **έκανε push** (2026-11-11 ~16:10). Το deploy στο Netcup
  (nestorconstruct.gr) **ήταν σε εξέλιξη** όταν γράφτηκε το handoff.
- Land: πρώτη απόπειρα μπλοκαρίστηκε από land άλλου πράκτορα (lock), μετά σύγκρουση μόνο στο παραγόμενο `src/types/i18n.ts`
  (ADR-937 του άλλου πράκτορα) ⇒ λύθηκε με `--ours` + `npm run generate:i18n-types`, freshness 56/56.

## 2. ΠΡΩΤΟ ΒΗΜΑ: ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ μόλις ολοκληρωθεί το push/deploy που ήδη τρέχει
Επιβεβαίωσε πρώτα ότι το deploy τελείωσε και ότι η παραγωγή τρέχει `49318674` ή νεότερο. Μετά, με τον Giorgio:
1. Στην εταιρεία (μισθωτής, `companies/{companyId}.socialMedia[]`) να υπάρχουν λογαριασμοί: viber (αριθμός), whatsapp (αριθμός),
   facebook (όνομα σελίδας), telegram (όνομα χρήστη), instagram. Η φόρμα επαφής προσφέρει πλέον «Viber».
   ⚠️ Πού επεξεργάζεται ο Giorgio τα social του **μισθωτή**: ΔΕΝ το επαλήθευσα (υπάρχει και δεύτερο σχήμα-αντικείμενο
   `socialMedia` στο `src/services/company/company-settings-types.ts:83`). Βρες το πριν τη δοκιμή.
2. Άνοιξε σύνδεσμο πληρωμής τιμολογίου (`/shared/<token>`): το μπλοκ «Επικοινωνία με τον εκδότη» δείχνει κουμπιά.
3. Από **κινητό**: κάθε κουμπί ανοίγει συνομιλία με τον σωστό λογαριασμό και έτοιμο κείμενο «…παραστατικό Σειρά-Αριθμός.»
   (Viber `viber.me/<αρ>?draft=`, WhatsApp `wa.me/<αρ>?text=`, Messenger `m.me/<σελίδα>?text=`, Telegram `t.me/<χρήστης>?text=`).
   Instagram: χωρίς κείμενο· το κλικ αντιγράφει το μήνυμα και η σελίδα λέει «Το μήνυμα αντιγράφηκε…».
4. ⚠️ Viber: κατά τη Viber το `viber.me` είναι για λογαριασμούς **Business** (δωρεάν). Δοκίμασε και με **προσωπικό** λογαριασμό.
   Αν δεν ανοίγει, ενημέρωσε τον Giorgio (εναλλακτική: μη τεκμηριωμένο `viber://chat?number=%2B…&draft=`, απόφαση δική του).
5. Χωρίς κανάλια ⇒ κανένα κουμπί, το μπλοκ δείχνει μόνο email/τηλέφωνο/ιστότοπο. Στην εκτύπωση τα κουμπιά δεν φαίνονται.
6. Κονσόλα χωρίς σφάλματα, χωρίς ωμά κλειδιά i18n (el + en).

## 3. Τι υλοποιήθηκε (Φάση 1, ADR-ACC-018 §16.1)
- SSoT `src/lib/contact/social-chat-links.ts` (`CHAT_CHANNELS`, `chatChannelsOf`, `buildChatLink`, `chatChannelBrandName`,
  `chatChannelPrefillsDraft`). Messenger από facebook, Instagram Direct από instagram, επικύρωση δείκτη ανά κανάλι.
- Νέα πλατφόρμα `viber` στη ρίζα `SOCIAL_PLATFORMS` + `.domain-vocabulary.json` + προφίλ + `UNIFIED_SOCIAL_PLATFORMS` + φόρμα + ετικέτες.
- `resolveTenantSocialAccounts` (company-branding-resolver) → `invoice-public-session.ts` → `InvoicePublicView.issuerChatChannels`.
- `InvoiceIssuerContact.tsx` (εξήχθη από τη σελίδα) + `chat-channel-icons.ts` (Simple Icons CC0).
- Άγκυρα `src/lib/contact/__tests__/social-chat-links.test.ts`, μετάλλαξη επαληθευμένη.

## 4. ΜΕΤΑ: Φάση 2, κανάλι CRM «Γράψτε μας» μέσα στη σελίδα (Plan Mode, απόφαση Giorgio)
Σχέδιο (δεν εγκρίθηκε ακόμη σε επίπεδο αρχείων):
- Δημόσιο POST με την πρόσβαση του συνδέσμου (`requestHasShareAccessGrant` + `findActiveShareOf`), `withAuth({allowUnauthenticated})`,
  όριο ρυθμού (`withSensitiveRateLimit`), ημερήσιο όριο ανά σύνδεσμο (πρότυπο `QUOTE_REQUEST_PAIR_DAILY_QUOTA`), ιδεμποτία
  (CHECK 3.92), απλό κείμενο με όριο μήκους. Το παραστατικό το βρίσκει ο server **μόνο** από τον σύνδεσμο.
- Αποθήκευση στο μοντέλο ADR-029 (`MESSAGES`/`CONVERSATIONS`, πρότυπο `storeChannelMessage`) με νέο κανάλι «σύνδεσμος
  παραστατικού», δεμένο με παραστατικό και πελάτη. ΟΧΙ νήματα ADR-867 (απορρίπτουν άγνωστους).
- Ειδοποίηση στον εκδότη: `dispatchNotification` (νέο event στο `EVENT_CATEGORY_MAP`, παραλήπτης `StoredShare.createdBy`).
- Απάντηση ορατή στη σελίδα (GET με την ίδια πρόσβαση) + email στον πελάτη (`From:` από τη ρίζα, CHECK 3.83).
- Νέο ADR (αριθμός με `ls docs/centralized-systems/reference/adrs/` τη στιγμή που χρειαστεί, CHECK 3.49).
Ξεκίνα με SSoT grep των παραπάνω (οι γραμμές του προηγούμενου handoff §2 θέλουν επαλήθευση) → σχέδιο αρχείων → «ναι».
Φάση 3 (αργότερα): `ref` Messenger/Instagram + `start` Telegram με σύντομο κωδικό · «σύνδεσε το δικό σου Viber bot»
(πληρώνει η εταιρεία απευθείας τη Viber), με fallback στον δωρεάν σύνδεσμο.

## 5. Άλλες εκκρεμότητες (ΟΧΙ αυτής της εργασίας, μόνο με εντολή Giorgio)
- Μία φορά `npm run wt:handoffs -- --all`.
- Ζωντανή επαλήθευση ADR-929 Σ1.3β: `HANDOFFS/2026-11-11_ADR-929_S1.3b-landed-pushed_next-live-verification_handoff.md`.
- Πρόταση (δεν εγκρίθηκε): `writeFileAtomic` του `scripts/lib/i18n-shell-slice/source-cache.js` → `scripts/lib/fs/atomic-write.js`.
