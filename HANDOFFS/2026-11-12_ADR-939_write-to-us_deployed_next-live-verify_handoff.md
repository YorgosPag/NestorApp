# Handoff: ADR-939 «Γράψτε μας» · ΖΩΝΤΑΝΟ στην παραγωγή · Επόμενο: ζωντανή επαλήθευση

**Ημερομηνία:** 2026-11-12 · **Worktree:** `C:\Nestor_Worktrees\product-portal` · **Κλαδί:** `agent/product-portal`
Προηγούμενο handoff: `HANDOFFS/2026-11-12_ADR-939_write-to-us_implemented_next-commit-land-live-verify_handoff.md`
(εκεί και η πλήρης περιγραφή της υλοποίησης· λεπτομέρειες: ADR-939).

## Κανόνες (Giorgio), αμετάβλητοι
Κάθε βήμα μόνο με «ναι» · κανένα test χωρίς έγκριση · όχι tsc · πραγματικό SSoT grep πριν από κώδικα · έρευνα στο διαδίκτυο
όπου δεν είσαι σίγουρος · ποιότητα «μεγάλων παικτών» και καλύτερα · commit μόνο σε `agent/*` με ρητή λίστα · ποτέ commit στο
`main` · **wt:land και push ΜΟΝΟ με ρητή εντολή Giorgio** · ποτέ `--no-verify` / `SKIP_*` · ελληνικά · μην αγγίξεις αρχεία
άλλων worktrees · **ΠΟΤΕ** μη ζητήσεις / επαναλάβεις / γράψεις tokens ή secrets.

## 1. Κατάσταση
- Commit `ad82f4b6 feat(portal): ADR-939 write-to-us on the shared invoice page via CRM inbox` (39 αρχεία) →
  `wt:land` στο τοπικό `main` → **push** (`e2f9995f..ad82f4b6`) → **deploy Netcup ΕΠΙΤΥΧΗΣ**: `live ad82f4b`
  (build · firebase-plan none · release success, run 43124003256).
- Κατά το commit: ο hook έπιασε 4 κόκκινα στο `src/app/api/accounting/__tests__/adr603-batch3.route.test.ts` — το mock του
  `invoice-email-template` δεν είχε το νέο `invoiceIssuerEmailFrame` ⇒ 500. Διορθώθηκε (1 γραμμή στο mock).
- Κατά το land: σύγκρουση μόνο στο **παραγόμενο** `src/types/i18n.ts` → λύθηκε με `npm run generate:i18n-types`
  (όχι με το χέρι)· το shell slice ξαναπαράχθηκε, χωρίς διαφορά.
- CHECK 3.86: καμία αλλαγή rules/indexes/storage ⇒ δεν χρειάζεται ανάπτυξη Firebase.

## 2. ΕΠΟΜΕΝΟ (μόνο με «ναι» Giorgio): ζωντανή επαλήθευση στο nestorconstruct.gr
1. Σελίδα Α-10 (`/shared/<token>`) → γράψε μήνυμα → εμφανίζεται στο νήμα («Γράψτε μας»).
2. Ειδοποίηση εκδότη στο κουδούνι (`CRM_NEW_COMMUNICATION`, οντότητα `INVOICE`) → οδηγεί στο `/crm/communications`.
3. Στα εισερχόμενα: συνομιλία καναλιού `portal` (εικονίδιο Globe), με πηγή το παραστατικό.
4. Απάντηση από τα εισερχόμενα → εμφανίζεται στη σελίδα + φεύγει email (διεύθυνση από `emailHistory[].paymentLinkShareId`,
   αλλιώς `customer.email`). Για πραγματικό έλεγχο email χρειάζεται **δεύτερος άνθρωπος/λογαριασμός**.
5. Έλεγχος ορίου (20 μηνύματα/σύνδεσμο/24ω, 2.000 χαρακτήρες), el/en, κινητό.
Τρόπος (Chrome από τον πράκτορα ή χειροκίνητα από τον Giorgio): **ρώτα τον Giorgio**.

## 3. Προτάσεις (ΟΧΙ εγκεκριμένες)
- Φίλτρο «Σελίδα πελάτη» στα εισερχόμενα (λείπουν και WhatsApp/Messenger/Instagram) · deep link της ειδοποίησης στη συνομιλία.
- Μετά: οθόνη social εταιρείας (πεδίο «αριθμός Viber Business») · Φάση 3.
- Telegram (τα κάνει ο Giorgio): Devices + Two-Step Verification · Commands/Menu Button/Mini App · `/start` @Nestor_P_Bot ·
  άγνωστο bot του «Your token was replaced» 21:14.
