# Handoff — ADR-ACC-030 · επίσκεψη που ανανεώνεται (εντάχθηκε) → απάντηση Everypay + ζωντανή επαλήθευση

**Ημερομηνία:** 2026-11-13 · **Worktree:** `C:\Nestor_Worktrees\accounting-next` · **Κλαδί:** `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.**

## 1. Κατάσταση

- ✅ **Commit `bb1dde20` → land → τοπικό `main` `ba9366d3`**: «feat(sharing): share visit renews while the customer is active
  (15' idle + 8h ceiling)». 9 στοχευμένες σουίτες jest πράσινες (101/101) + hook (108 σουίτες Accounting) πράσινο.
- ✅ Ο Giorgio έκανε push· το `origin/main` = `1c6ba1c9` **περιέχει** το `ba9366d3`.
- 🔴 **Το deploy ΑΠΕΤΥΧΕ** (run `43481185085`, «T1 🚀 Build & Deploy Docker Image»): βήμα «Verify PDF runtime in standalone»
  ⇒ `Cannot find module '.next/standalone/pdf-path-walker' imported from .pdf-runtime-structure.mjs`. Η Κυκλοφορία στο
  Netcup **παραλείφθηκε** ⇒ η παραγωγή τρέχει ακόμη την παλιά έκδοση.
  - Ρίζα: το ADR-941 (`50c675fd`, Φ1) εξήγαγε `src/services/pdf/pdf-path-walker.ts`· το `pdf-page-structure.ts` το εισάγει
    (`./pdf-path-walker`). Το `scripts/lib/pdf-service-probe.cjs` (ADR-923 §5.5.1) κάνει transpile **μόνο** τα
    `pdf-rasterize.service.ts` + `pdf-page-structure.ts` σε προσωρινά `.mjs` ⇒ το walker λείπει.
  - **ΔΕΝ είναι δική μας δουλειά** — ανήκει στον πράκτορα του ADR-941 (ή σε όποιον αναθέσει ο Giorgio). ΜΗΝ το αγγίξεις
    χωρίς ρητή εντολή.
- ⏳ Ο Giorgio θα ειδοποιήσει όταν ένα νέο push/deploy ολοκληρωθεί επιτυχώς ⇒ τότε η ζωντανή επαλήθευση (§3).

## 2. Τι υλοποιήθηκε (για αναφορά — ΜΗΝ το ξαναγράψεις)

Ρίζα της αποτυχημένης ζωντανής επαλήθευσης του `e04fdc3b`: το κουπόνι επίσκεψης εκδιδόταν μία φορά και δεν ανανεωνόταν
⇒ στο 16′ `visit-expired` σε **όλη** τη σελίδα πελάτη (όψη, PDF, Πληρωμή, Γράψτε μας, αναμονή).

- `server/access-grant/access-grant.ts`: ανανεώσιμα είδη (`visitCeilingSeconds`) — αδράνεια 15′ ανανεώσιμη + απόλυτη
  λήξη υπογεγραμμένη· `renewAccessGrant`. Τα μη ανανεώσιμα (θέαση περιήγησης ADR-884) **ίδια μορφή**.
- `server/sharing/share-access-grant.ts`: `SHARE_VISIT_CEILING_SECONDS = 8h` · `renewShareAccessGrant` · `clearShareAccessGrant`.
- `app/api/shares/[shareId]/invoice-payment/_shared/invoice-visit-route.ts`: ένας σκελετός για όψη/PDF/checkout POST/
  messages — ανανέωση **μόνο** μετά από αυθεντική κρίση συνδέσμου · `link-inactive` ⇒ σβήσιμο · το GET έκβασης **δεν** ανανεώνει.
- Client: `reopenVisit` (single-flight, `useSharedFilePageState`) · `share-visit-fetch.ts` (`fetchInVisit`: μία αθόρυβη
  νέα επίσκεψη, ποτέ βρόχος) σε όψη/αναμονή/checkout/thread/PDF · `visibilitychange`/`pageshow`/`online` ξυπνούν την αναμονή.
- Διόρθωση: το τέλος αναμονής το ορίζει η **πρώτη** απάντηση και οι επόμενες μόνο το μικραίνουν (`deadlineAfter`).
- ADR: ADR-315 Α19 · ADR-ACC-030 §5.6 · ADR-ACC-018 §16 · ADR-884 (changelog σε όλα).
- Παρενέργεια deploy: κουπόνια κοινοποίησης σε ισχύ τη στιγμή του deploy απορρίπτονται μία φορά (η σελίδα τιμολογίου
  ανοίγει αθόρυβα νέα επίσκεψη· οι άλλες σελίδες κοινοποίησης θέλουν ανανέωση).

## 3. Επόμενα βήματα (με τη σειρά)

### 3Α. Απάντηση Everypay — ΤΩΡΑ (δεν εξαρτάται από deploy)
Gmail thread `1a1d4b10d6f17741` (ADR-ACC-030 changelog 2026-11-13 «§5.8 #7–#8»). Απάντηση info@everypay.gr 13/11 15:23 UTC:
1. **Apple Pay / Google Pay ήδη ενεργά στο sandbox από 11/11/2026**· για παραγωγή τους ειδοποιούμε μετά τις δοκιμές.
2. Υποστηρίζονται **και** στη hosted σελίδα των Payment Notifications (`payment_link_url`), όχι μόνο στο Payform·
   εμφανίζονται αυτόματα κατά ενεργές υπηρεσίες + συμβατότητα συσκευής/browser.
3. **Καμία** επαλήθευση domain (nestorconstruct.gr) — η πληρωμή γίνεται στη σελίδα τους, το domain το διαχειρίζονται εκείνοι.
4. Webhook: επιτυχία = **HTTP 200 OK**· αριθμός/διαστήματα επαναλήψεων **θα τα επιβεβαιώσουν** με το τεχνικό τμήμα.

Εργασία: SSoT audit (git grep) του τι δείχνει/υποθέτει σήμερα ο κώδικας για τρόπους πληρωμής (κάρτα / IRIS / πορτοφόλια:
UI σελίδας τιμολογίου, i18n, `online-payment` τύποι, καταγραφή μεθόδου από webhook/`GET /payments`, λογιστική
συμφιλίωση) → έρευνα επίσημων docs Everypay (πώς αναφέρεται ο τρόπος πληρωμής Apple/Google Pay στην απάντηση πληρωμής)
→ πρόταση σχεδίου στον Giorgio (Plan Mode αν 3+ αρχεία) → υλοποίηση → ADR-ACC-030 §5.8 #7–#8 (κλείσιμο ερωτήσεων 1–3,
#4 μένει ανοιχτό για τις επαναλήψεις) + changelog. Τη ζωντανή δοκιμή πορτοφολιού (συσκευή/κάρτα) την κάνει ο **Giorgio**.

### 3Β. Ζωντανή επαλήθευση — ΜΟΝΟ όταν ο Giorgio πει ότι το deploy ολοκληρώθηκε
Chrome, δοκιμαστικό τιμολόγιο Α-13, νέα απόπειρα IRIS (ο Giorgio χειρίζεται τον προσομοιωτή IRIS):
- (α) στο 16′+ η σελίδα ρωτά ακόμη, `expiresInMs` μειώνεται, **κανένα** `visit-expired` (νέο `Set-Cookie`
  `nestor_share_<shareId>` στις απαντήσεις όψης)· `timed-out` μόνο μετά τη λήξη συνεδρίας + 1′.
- (β) καρτέλα στο παρασκήνιο > 5′ → επιστροφή ⇒ γύρος **αμέσως**.
- (γ) σελίδα αδρανής > 15′ → «Πληρωμή» ⇒ αθόρυβη νέα επίσκεψη, καμία άρνηση.
- (δ) ανάκληση συνδέσμου εν ώρα αναμονής ⇒ άρνηση στον επόμενο γύρο, το cookie σβήνει.
- (ε) ανάκληση δοκιμαστικού συνδέσμου στο τέλος.
Μετά: σημείωση «επαληθεύτηκε ζωντανά» στο ADR-ACC-030 §5.6 **μόνο** με «ναι» του Giorgio (η γραμμή changelog λέει
σήμερα «Ζωντανή επαλήθευση: εκκρεμεί»).

### 3Γ. Μετά (από το προηγούμενο handoff §3, με τη σειρά)
Coolify logs · μία πλήρης IRIS για `signatureScheme` · σενάρια §2.5 · προαιρετικά.

## 4. Κανόνες (αμετάβλητοι)
- Στο `main` **κανένα** commit· commit μόνο στο `agent/accounting-next` με ρητή λίστα αρχείων· `wt:land` και push
  **μόνο** με εντολή Giorgio. Ποτέ `--no-verify`.
- Πριν από κώδικα: πραγματικό SSoT audit (git grep) + επίσημες πηγές + έρευνα στο διαδίκτυο όταν δεν είσαι σίγουρος.
- Tests **μόνο** με έγκριση Giorgio· **ποτέ** tsc. Lock `C:\Users\user\.claude\heavy-task.lock` (<20′ ⇒ περίμενε).
- Μόνο Everypay sandbox· κανένα κλειδί παρόχου, κανένα live. Ο Giorgio: κάρτες, IRIS, dashboard Everypay, Coolify logs.
- Bash < 6.000 χαρακτήρες· git σε απλές, χωριστές εντολές (απομόνωση worktree).
- Ελληνικά πάντα· δείκτης context στο τέλος κάθε εργασίας.
