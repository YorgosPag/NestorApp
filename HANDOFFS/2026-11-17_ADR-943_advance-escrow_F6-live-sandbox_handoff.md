# HANDOFF — ADR-943: Φ6 ζωντανή επαλήθευση EveryPay Marketplace (sandbox) στην παραγωγή

**Ημερομηνία:** 2026-11-17 · Προηγούμενο: `2026-11-17_ADR-943_advance-escrow_land-conflict_handoff.md` (ΕΚΛΕΙΣΕ)
**Worktree:** `C:\Nestor_Worktrees\wt-prune` · **κλαδί:** `agent/wt-prune` · η νέα συνεδρία συνεχίζει στο ΙΔΙΟ worktree.

## 0. Κανόνες (Giorgio)
- Commit μόνο στο `agent/wt-prune`, με ρητή λίστα αρχείων. **Ποτέ** commit στο `main`.
- `wt:land` και `push` **μόνο με ρητή εντολή Giorgio** (για αυτή τη ροή η εντολή του υπερισχύει του «commit ⇒ αμέσως land»).
- Ποτέ `--no-verify` · ποτέ `tsc` · tests μόνο με έγκριση · πρωτοβουλίες = πρόταση μίας γραμμής και στάση.
- Ποιότητα «μεγάλων παικτών» (Stripe Connect κ.λπ.), full SSoT: **grep audit πριν από κάθε νέο κώδικα**. Αβεβαιότητα ⇒ έρευνα στο web.

## 1. Κατάσταση
- Φ5α–Φ5δ + ADR-943 §8 #1 **landed και pushed**: `main` = `origin/main` περιέχει `e07a9343`· live deploy `0ca0b764` (το περιέχει).
- **EveryPay**: email 17/11 17:30 στο νήμα «Ενεργοποίηση Marketplace στον λογαριασμό sandbox» → «η αλλαγή ολοκληρώθηκε».
  Το sandbox dashboard δείχνει πλέον μενού **Marketplace** (Sellers · Transfers · Reversals · Payouts). Τα ερωτήματα **2–6** του
  email (merchant of record/chargebacks · split σε IRIS · refund μετά από reversal · πεδία πωλητή/KYC · webhooks transfers/payouts)
  και τα 2 θέματα του email 13/11 (Apple/Google Pay) **έμειναν αναπάντητα**.
- **Παραγωγή (Coolify, Production env)**: υπήρχαν `EVERYPAY_PUBLIC_KEY` · `EVERYPAY_SECRET_KEY` · `PAYMENTS_PROVIDER_MODE`.
  Ο Giorgio **πρόσθεσε `EVERYPAY_MARKETPLACE=enabled`** (Runtime) και έκανε **Redeploy** 20:02 UTC — healthy.
- **Localhost** (`C:\Nestor_Pagonis\.env.local`, εκτός git): προστέθηκαν κλειδιά sandbox + `EVERYPAY_MARKETPLACE=enabled` +
  `PAYMENTS_PROVIDER_MODE=sandbox`. Θέλει επανεκκίνηση `npm run dev` για να ισχύσουν.
- Κρίση config: `everypay-config.ts:49` `judgeEverypayConfig` (κλειδιά + mode ∈ `EVERYPAY_ENDPOINTS` + marketplace=`enabled`) →
  `payment-provider-registry.ts:39` `marketplacePaymentProvider()` → `/api/account/payouts` → κάρτα «Λήψη πληρωμών».

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ (Φ6)
1. Άνοιξε `https://nestorconstruct.gr/profile` (Chrome· ο Giorgio είναι ήδη συνδεδεμένος ως **`georgios.pagonis+arch1@gmail.com`**,
   «Γεώργιος Πέας», αρχιτέκτονας ESCO — ο μηχανικός/πωλητής). Η κάρτα **«Λήψη πληρωμών»** πριν το redeploy έλεγε
   «δεν είναι ακόμη διαθέσιμη»· τώρα πρέπει να προσφέρει εγγραφή δικαιούχου.
   - Αν ΑΚΟΜΗ «μη διαθέσιμη» ⇒ διάγνωση (σήμα `payee-kyc` / διάγνωση `kyc:<κατάσταση>` στο `payment-provider.ts`), ΜΗΝ μαντέψεις.
2. Εγγραφή δικαιούχου (`POST /sellers`) → hosted KYC (`kyc_process_url`) → webhook `SELLER_KYC.STATUS` → `authorized`.
   Τα στοιχεία IBAN/ΑΦΜ τα πληκτρολογεί ο Giorgio (δοκιμαστικά sandbox).
3. Γραφείο (`georgios.pagonis@gmail.com`, `comp_9c7c1a50…`): ανάθεση με προκαταβολή → αποστολή για έγκριση.
4. Ιδιοκτήτης: `/document-request` από το email → έγκριση → πληρωμή (κάρτα sandbox) → `split=1` → κρατημένη μεταφορά (`on_hold`).
5. Έπειτα: αυτόματη αποδέσμευση / ακύρωση με επιστροφή (reversal → refund — §8 #4, το ερώτημα 4 της EveryPay) / ΜΑΡΚ.
6. Κάθε εύρημα → ADR-943 (§8 + changelog, Φ6). Ενημέρωσε το status header.

## 3. Ανοιχτά (μόνο προτάσεις, όχι εντολές)
- **Κενά Όνομα/Επώνυμο στο `/profile`** για λογαριασμούς που δεν πέρασαν από φόρμα (στατική ανάλυση, όχι επαληθευμένο στη βάση):
  πρόσκληση `citizen-identity.ts:212-216, :293-310` (μόνο `displayName` — πιθανή προέλευση του `+arch1`) · Google χωρίς
  `completeProfile` (`useAuthActions.ts:114-119`, ονόματα μόνο σε localStorage) · `identity-record.ts:126-132` ·
  `account-reprovision.ts:142` · `bootstrap-admin/route.ts:154`. Κανένα backfill. Το σπάσιμο του `displayName` απαγορεύεται ρητά
  (`useAuthActions.ts:87-93`). Ο Giorgio συμπλήρωσε χειροκίνητα τον `+arch1`.
- Απάντηση στην EveryPay που ξαναθέτει τα ερωτήματα 2–6 (προσχέδιο μόνο με εντολή).
- Ειδοποίηση γραφείου όταν ο μηχανικός καταγράφει ΜΑΡΚ προκαταβολής.

## 4. Μην κάνεις
`--no-verify` · γυμνό `git stash` · commit στο `main` · `wt:land`/push χωρίς εντολή · `wt:remove` χωρίς εντολή ·
επανάληψη τιμών κλειδιών σε μηνύματα · αλλαγές σε μεταβλητές Coolify (τις κάνει ο Giorgio).
