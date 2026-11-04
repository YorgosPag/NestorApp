# ADR-923 · Συντονίστρια · Κύμα 2 — handoff

**Ημερομηνία:** 2026-11-04 · **Παραγωγή:** https://nestorconstruct.gr (Netcup / Coolify)
**Worktree:** `C:\Nestor_Worktrees\xchange-report-typography` · **Κλαδί:** `agent/xchange-report-typography`
**Η νέα συνεδρία συνεχίζει στο ΙΔΙΟ worktree** και **είναι η συντονίστρια** του ADR-923 (απόφαση Giorgio 2026-11-03:
«συντονίζεις εσύ»). Δεν υπάρχει άλλη συνεδρία-συντονίστρια· το `adr-923-phase3-close` αφαιρέθηκε.
**`main` = `origin/main` = `4ea82569`** (push έγινε 2026-11-04, deploy run `41742820705` ✅ build · release).
Το κλαδί αυτό = `main` + μόνο το commit αυτού του handoff.

## 0. Εντολή Giorgio (ισχύει)
Να υλοποιηθούν **ΟΛΕΣ** οι εκκρεμότητες του ADR-923, με παράλληλους πράκτορες. Επίπεδο Revit / ArchiCAD / Cinema 4D / Figma /
Zillow / Idealista ή καλύτερα· FULL ENTERPRISE + FULL SSOT, καμία έκπτωση· όπου οι μεγάλοι δεν το κάνουν, ακολουθούμε την
πρακτική τους· έρευνα στο διαδίκτυο όπου υπάρχει αμφιβολία, και αναζήτηση λύσεων εξυπνότερων από των μεγάλων.
**Πραγματικό SSoT audit με grep ΠΡΙΝ από κάθε γραμμή κώδικα.**

## 1. Τι έκλεισε στο κύμα 1 (ζωντανό στο main — μην το ξανανοίξεις)
| Commit | Λωρίδα | Περιεχόμενο |
|---|---|---|
| `ddc35f28` | Γ+Δ (συντονίστρια) | `lib/http/cache-control.ts` (`PRIVATE_NO_STORE` · `withPrivateNoStore`) στο `respond` του `_shared/catalog-route.ts` ⇒ κάθε απόκριση καταλόγου `private, no-store` (§5.14.1 Ζ23) · `priceListId` κρίνεται από το μητρώο (`isEnterpriseIdOfPrefix(…, CATALOG_PRICE_LIST)`) ⇒ 400 αντί 404 (Ζ24) · «catalog request rejected» / «Catalog read failed» · 35 ετικέτες `catalog:audit.fields` el/en ⇒ `audit-field-descriptor.test.ts` πράσινο |
| `d95a1d1e` | Β (εκδότης) | QR → `/q/<id>` στις σελίδες οικογένειας, άρνηση σε μη δημόσια βάση · υποσέλιδο «ισχύς από … έως …» (`publication-price-edition.ts`, σχήμα απόδοσης 7, απόφαση 76 §5.6.1) · ένας αναγνώστης `server/catalog/catalog-dataset-reads.server.ts` για εκδότη + xChange |
| `4ea82569` | Α (προμήθειες) | Ε6 Τ0–Τ4: `createRfq` σε ΜΙΑ συναλλαγή (`rfq-create-plan.ts` · `rfq-create-transaction.ts` · `rfq-boq-items.ts`), γραμμές καταλόγου, αρνήσεις `types/rfq-create-refusal.ts` (`catalogSkuUnavailable` 422 · `supplierNotAcceptingQuotes` 409 · `supplierContactUnavailable` 409 · `rfqTooLarge` 422), `SAFE_BATCH_WRITES` = 500 − 50 (ένα SSoT), opt-in μέσα στη συναλλαγή (`supplierAcceptsQuotesInTx`). ⚠️ Το commit **περιέχει και τα Τ0–Τ3** (σύμπτυξη), το μήνυμα λέει μόνο Τ4· τα καταγράφει το changelog του ADR |

## 2. 🔴 ΠΡΩΤΟ ΒΗΜΑ: ζωντανή επαλήθευση στην παραγωγή (browser, συνδεδεμένος)
⚠️ Το `curl` παίρνει **403** από το middleware (ακόμη και `/api/build-info`) ⇒ μόνο μέσω browser (Claude in Chrome: πρώτα
`tabs_context_mcp`, νέα καρτέλα). Το «release success» = μόνο «queued» στο Coolify (μάθημα §5.13).
1. `/api/build-info` ⇒ commit `4ea82569`. Αν όχι, **σταμάτα** και ρώτα τον Giorgio.
2. **Ζ23:** σε όψη τιμών (π.χ. ανάλυση τιμής στο `/catalog/discounts`, ή `/api/catalog/xchange-export/preview`) DevTools/
   `read_network_requests` ⇒ `Cache-Control: private, no-store`.
3. **Ζ24:** `GET /api/catalog/xchange-export/preview?priceListId=bogus!` ⇒ **400** · έγκυρη μορφή ανύπαρκτη ⇒ 404 · κανένα «write» στο μήνυμα.
4. **Ετικέτες ιστορικού:** ιστορικό μιας έκδοσης / εισαγωγής / κανόνα ορατότητας ⇒ ελληνικές ετικέτες, όχι ωμά ονόματα πεδίων· και σε English.
5. **Εκδότης:** νέα έκδοση ⇒ QR στις σελίδες οικογένειας οδηγεί σε `/q/<id>` (307, `no-store`) · έκδοση με τιμές που αντικαταστάθηκαν ⇒ «έως». ⚠️ Το upload/παραγωγή PDF στην παραγωγή **μόνο με εντολή Giorgio**. Έλεγξε επίσης ότι το CHECK 3.110 (Typst + veraPDF) πέρασε στο CI του `4ea82569`.
6. **RFQ:** δημιουργία RFQ από BOQ και ad-hoc όπως πριν (καμία οπισθοδρόμηση) · πίνακας RFQ μετρά προελεύσεις χωριστά.
   Γραμμή καταλόγου **δεν έχει UI ακόμη** (Τ6).
7. **`<html lang>`:** αλλαγή σε English ⇒ `document.documentElement.lang === 'en'`. Ο κώδικας (ADR-830, `i18n/config.ts`) συγχρονίζει ήδη· το «μένει `el`» του προηγούμενου handoff **δεν αναπαράχθηκε από κώδικα**. Αν αναπαραχθεί, διάγνωση· αν όχι, κλείσε το στο ADR.
Κάθε εύρημα ⇒ γραμμή στο ADR-923 (μόνο δική σου γραμμή changelog).

## 3. Κύμα 2 — λωρίδες (χωρίς κοινά αρχεία· συμφώνησέ τες με τον Giorgio πριν τις αναθέσεις, N.8 + N.14)
- **Α2 · Ε6 Τ6 (UI «Ζητήστε προσφορά»):** μεταφράσεις el/en των 4 κωδικών μέσω `explainProcurementError` · νησίδα
  `RequestQuoteButton` + `quoteDraftHref` · `RfqBuilder` (ο τοπικός τύπος `FormLine` δεν ξέρει `catalog`· στέλνει `catalogLines`,
  προσυμπλήρωση από `?catalog=`) · ανώνυμος ⇒ `loginHref` με επιστροφή στο ίδιο πρόχειρο (Ε6), ανοιχτό: κρατά η σύνδεση το `next`;
  · πρόταση `supply-request-link` όταν το SKU κρίθηκε από τη βιτρίνα. Σχέδιο: §5.13 Ε6 και η ενότητα «Τ4» του ADR-923.
- **Β2 · «Τι άλλαξε» στον εκδότη:** το κεφάλαιο δεν ονομάζει την έκδοση σύγκρισης (μόνο «Πριν €» / «Τώρα €»)· θέλει αλλαγή
  στο `typst-template.ts`, επαληθεύσιμη μόνο στο CI (CHECK 3.110). Δες απόφαση 76 §5.6.1.
- **Γ2 · ανοιχτά ⏳ του ADR-923:** απογραφή των ⏳ (ήταν 61 πριν το κύμα 1, ξαναμέτρησέ τα: `grep -c '⏳'`) σε **έναν**
  κατάλογο, με ταξινόμηση «κώδικας / ζωντανή επαλήθευση / απόφαση Giorgio / δεδομένα». Σημεία εκκίνησης: §5.5.1 σελ. 86 και
  ψευδές `unknownReference` (γρ. ~382) · §5.12 Τμήματα 1–5 ζωντανές επαληθεύσεις · §5.14 κενά (β)(γ) εισαγωγή xChange (`NA`/`UN`,
  `Pricing` με UNECE) · §5.13 Σ6 (τιμές βιτρίνας — **με ανεξάρτητη ανασκόπηση ασφαλείας**) · Σ8 `Material.catalogRef`.
- **Φ8** (πύλη σύγκρισης): προϋποθέτει Κοινό Λεξικό (§13, §17) ⇒ **όχι** σε αυτό το κύμα.

## 4. Αποφάσεις / ενέργειες του Giorgio (ΔΕΝ τις κάνει πράκτορας — ρώτα, μη μαντεύεις)
1. 🔓 **`defineRoute` στέλνει στον πελάτη το `message` κάθε απρόβλεπτου `Error` σε 500** (~85 routes, ADR-602 «byte-identical»)·
   εγγραφή υψηλής προτεραιότητας στο `.claude-rules/pending-ratchet-work.md`. Αλλάζει απαντήσεις παντού ⇒ έγκριση.
2. `SUPPLIER_TAX_FINGERPRINT_HMAC_SECRET` και `GEMI_OPENDATA_API_KEY` στο Coolify (η τιμή **δεν** στέλνεται στον πράκτορα, **δεν** αλλάζει ποτέ μετά).
3. Ενεργοποίηση βιτρίνας 6β Σ3: `readLiveSupplierStanding` (πάντα `unknown`) + cron `public-catalog-sweep` (`enabled: false`).
4. Νομική γνώμη Ε7 · μέλος ETIM για τον επίσημο validator · κλάση ETIM για «Fan coil» (δεδομένα) · Φ5: κατάλογος 300+ σελίδων από τον ίδιο.
5. Σβήσιμο worktrees κύματος 1: `C:\Nestor_Pagonis\.claude\worktrees\agent-aca3717765f6b724e` (κλαδί `agent/adr-923-e6-quote`) και
   `…\agent-ad7870d824fbfd2af` (`agent/adr-923-publisher-qr`) — έχουν μπει στο main. Επίσης ξεπερασμένα κλαδιά
   `agent/adr-923-phase6b-s2`, `agent/adr-923-xchange-export`, `agent/adr-923-phase3-close` (κώδικάς τους ήδη στο main).

## 5. Μαθήματα κύματος 1 (πώς δουλεύει ο συντονισμός εδώ)
- **Υποπράκτορες:** `Agent` με `isolation: "worktree"` + `git switch agent/<κλαδί>` μέσα τους. Δουλεύει· το `wt:land` βρίσκει
  worktree **κατά κλαδί**. Χρειάζονται `pnpm install --offline --frozen-lockfile --ignore-scripts --package-import-method=hardlink` + patch radix (όπως το `wt:new`).
- **Land σειριακά, ένα κλαδί τη φορά.** Το κλαδί που μπαίνει δεύτερο συγκρούεται στο changelog του ADR-923 ⇒ ο **πράκτορας της
  λωρίδας** κάνει `git rebase main`, λύνει (ADR: και οι δύο πλευρές · παραγόμενα: μόνο γεννήτορες), και μετά `git reset --soft main`
  + ΕΝΑ commit με πλήρες hook. ⚠️ Το μήνυμα να περιγράφει **όλα** τα commits που συμπτύσσονται (λάθος του κύματος 1).
- **`heavy-task.lock`:** 4 πυρήνες· jest/hook/jscpd περιμένουν το κλείδωμα (background until-loop, όχι polling). Το hook μπορεί να
  σκοτωθεί από μνήμη ή το CHECK 3.34 από timeout 120″ υπό φόρτο ⇒ ξαναδοκιμή όταν είναι ήσυχο το μηχάνημα, ποτέ παράκαμψη.
- **Push μία φορά στο τέλος** όλων των land (ένα deploy αντί για Ν).
- Ένα κόκκινο `ownership-callsite-coverage-anchor.test.ts` (18 αρχεία, όχι του κύματος 1) αναφέρθηκε από τη λωρίδα Α ως
  προϋπάρχον — **δεν** επαληθεύτηκε πάνω στο main.

## 6. Κανόνες
Commit μόνο σε `agent/*`, ρητή λίστα, πλήρες hook. Όχι `--no-verify`, `SKIP_*`, `git add -A`, `stash`, `tsc`, `firebase deploy`.
Στο `main` κανένα commit. **`wt:land` / push ΜΟΝΟ με εντολή Giorgio.** Bash > 6.000 χαρακτήρες ⇒ `Write` (N.19). Το isolation
αρνείται σύνθετες εντολές git ⇒ απλές, μία τη φορά. `HANDOFFS/*.md` είναι στο `.git/info/exclude` ⇒ `git add -f -- <αρχείο>`.
Νέα εξαίρεση πύλης από πράκτορα (π.χ. η Κ3β του 3.17 στο κύμα 1) ⇒ ρητή αναφορά στον Giorgio.
