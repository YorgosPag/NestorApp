# DECISIONS-PHASE-2: Wire Up Dead Code — MatchingEngine + Reports

> **Status**: ΥΠΟΦΑΣΗ 2a ✅ + 2b ✅ + 2c ✅ + 2d ✅ + 2e ✅
> **Date**: 2026-03-30
> **Scope**: Φάση 2 του accounting roadmap
> **Depends on**: Phase 1a ✅, Phase 1b ✅, Phase 1c ✅

---

## Σύνοψη Φάσης 2

Η Φάση 2 αφορά **δύο πυλώνες**:
1. **MatchingEngine** — Αυτόματη αντιστοίχιση bank transactions ↔ invoices/journals (κώδικας ΥΠΑΡΧΕΙ, δεν είναι wired)
2. **Reports** — Λογιστικές αναφορές (ΔΕΝ υπάρχει κώδικας)

### Dead Code που εντοπίστηκε:
- `services/engines/matching-engine.ts` (~288 lines) — Πλήρως υλοποιημένο, ΠΟΤΕ δεν instantiated
- `services/external/csv-import-service.ts` (~332 lines) — Πλήρως υλοποιημένο, ΠΟΤΕ δεν instantiated
- `POST /api/accounting/bank/import` — Έχει ΔΙΚΗ ΤΟΥ CSV parsing logic (duplicate του CSVImportService)
- `POST /api/accounting/bank/match` — Χρησιμοποιεί repo directly, ΟΧΙ MatchingEngine

### Αρχιτεκτονικά patterns (από έρευνα βιομηχανίας):
- SAP/NetSuite/Xero: 3-tier matching (deterministic → fuzzy → ML)
- Confidence: 95%+ auto-match, 85-94% suggest, <85% manual
- Split transactions: essential για production
- Reports minimum: P&L, Trial Balance, AR Aging, Tax Summary
- Ελληνικά: Very Small Entity → μόνο Κατάσταση Αποτελεσμάτων (B.6) υποχρεωτική

---

## Ερωτήσεις & Αποφάσεις

### Q1: MatchingEngine — Wire Up As-Is ή Enhance;

**Τι υπάρχει:** Ο MatchingEngine έχει 5 κανόνες αντιστοίχισης:
1. Exact amount match (90% confidence)
2. Description keywords (85%)
3. Contact name match (80%)
4. Recurring patterns (95% μετά 2+ matches)
5. AI fuzzy match (variable)

**Τι κάνει η βιομηχανία:** 3 επίπεδα + weighted scoring:
- Tier 1: Deterministic (exact amount + reference)
- Tier 2: Fuzzy (Levenshtein/Jaro-Winkler distance)
- Tier 3: ML/Embeddings (semantic similarity)
- Weighted: Amount 35%, Description 50%, Currency 10%, Date 5%

**Επιλογές:**
- **A — Wire up as-is**: Χρησιμοποίησε τον υπάρχοντα engine χωρίς αλλαγές. Αρκετά καλό για ατομική επιχείρηση.
- **B — Wire up + light enhance**: Πρόσθεσε configurable thresholds (auto/suggest/manual) + date tolerance. Κράτα τους 5 κανόνες.
- **C — Rewrite με weighted scoring**: SAP/Midday pattern. Νέος scoring algorithm, 3 tiers, weighted factors.

**Απόφαση: C — Rewrite με weighted scoring (SAP/Midday pattern)**
**Αιτιολόγηση:** Google-level quality. Weighted scoring algorithm με 3 tiers (auto ≥95%, suggest 85-94%, manual 70-84%, no match <70%). Amount 35%, Description 50%, Currency 10%, Date 5%. Ο υπάρχων engine αντικαθίσταται πλήρως.

---

### Q2: Confidence Thresholds — Σταθερά ή Configurable;

**Τι αποφασίζουμε:** Τα score thresholds (auto-match ≥95%, suggest 85-94%, manual 70-84%) είναι hardcoded ή configurable από UI;

**Έρευνα βιομηχανίας:**
- Enterprise (SAP, NetSuite, Stripe): Configurable
- SMB (Xero, QuickBooks): Σταθερά/hidden
- Google pattern: Smart defaults + Advanced Settings για power users

**Επιλογές:**
- A — Σταθερά (95/85/70) hardcoded
- B — Configurable χωρίς UI (config object + defaults)
- B+ — Configurable με UI (sliders στο Settings)

**Απόφαση: B+ — Configurable με UI (Google-level) + ΠΑΝΤΑ Manual Approval**
**Αιτιολόγηση:** Enterprise systems (SAP, NetSuite) = πάντα configurable. Google pattern = smart defaults + overrides. UI sliders στις Ρυθμίσεις Accounting, defaults 95/85/70, αποθήκευση σε Firestore `accounting_settings`. Effort: +1.5 ώρα, αξίζει.

**ΚΡΙΣΙΜΗ ΑΠΟΦΑΣΗ — User Approval Flow:**
- **Ο χρήστης ΒΛΕΠΕΙ ΤΑ ΠΑΝΤΑ** — πλήρης διαφάνεια, τίποτα στο background
- **ΤΙΠΟΤΑ δεν γίνεται αυτόματα** χωρίς ανθρώπινη έγκριση
- Ακόμα και τα ≥95% (auto-matched) **περιμένουν κλικ** — είναι pre-selected, ΟΧΙ auto-cleared
- Ο χρήστης βλέπει: score, λόγους matching, ποσά, ημερομηνίες
- Κουμπί **"Αποδοχή Όλων"** για batch approval των ≥95% (1 κλικ για πολλά)
- Κάθε tier (suggest, possible) ελέγχεται 1-1
- **ΑΠΟΚΛΕΙΣΤΗΚΕ** το SAP "true auto-clear" pattern — ο Γιώργος θέλει τον χρήστη στο τιμόνι

---

### Q3: Split Transactions — 1:1, 1:N, ή N:M;

**Τι αποφασίζουμε:** Πώς αντιστοιχίζονται κινήσεις ↔ τιμολόγια/εγγραφές;

**Σενάρια πραγματικά:**
- 1:N → Πελάτης πληρώνει 3 τιμολόγια μαζί (1 κατάθεση €5.200 = 3 invoices)
- N:1 → Πελάτης πληρώνει σε δόσεις (3 καταθέσεις = 1 τιμολόγιο €5.200)
- N:M → Μείγμα (2 καταθέσεις → 3 τιμολόγια)

**Έρευνα βιομηχανίας:**
- Enterprise (SAP, NetSuite, Dynamics 365, Sage): N:M native
- SMB (Xero, QuickBooks): Μόνο 1:1

**Επιλογές:**
- A — Μόνο 1:1 (+0 effort)
- B — 1:N split (+2 ώρες, 95% κάλυψη)
- C — N:M full, SAP pattern (+4 ώρες, 100% κάλυψη)

**Απόφαση: C — N:M full (SAP pattern)**
**Αιτιολόγηση:** Enterprise-grade, καλύπτει 100% σεναρίων. Δόσεις (N:1) είναι συνηθισμένες σε τεχνικά γραφεία. Ο engine αναλύει combinations, προτείνει σετ που "κλείνουν", ο χρήστης έχει πάντα τον τελικό λόγο (manual approval βάσει Q2).

---

### Q4: CSVImportService — Wire up ή κράτα duplicate;

**Τι αποφασίζουμε:** Υπάρχει διπλός κώδικας CSV parsing — στον CSVImportService (332 γρ.) ΚΑΙ στο API route (150 γρ.).

**Επιλογές:**
- A — Wire up CSVImportService, σβήσε duplicate logic από API route (SSoT)
- B — Κράτα API route, σβήσε CSVImportService (dead code cleanup)

**Απόφαση: A — Wire up CSVImportService (SSoT)**
**Αιτιολόγηση:** Single Source of Truth. Ο CSVImportService είναι πληρέστερος (332 γρ., proper error handling, batch tracking). Το API route γίνεται thin wrapper. Μηδέν duplicates = enterprise standard.

---

### Q5: Rule Learning — Να μαθαίνει από χειροκίνητες αντιστοιχίσεις;

**Τι αποφασίζουμε:** Μετά από manual match, το σύστημα θυμάται το pattern για μελλοντικές προτάσεις;

**Έρευνα βιομηχανίας:**
- SAP: ML model, εκπαιδεύεται σε historical clearings
- Xero: Cross-user learning (μαθαίνει από όλους τους χρήστες)
- QuickBooks: Per-user, θυμάται κάθε manual categorization
- NetSuite: Auto-create rules από manual matches

**Επιλογές:**
- A — Χωρίς learning (+0)
- B — Simple learning: merchant → category/entity (+2 ώρες)
- C — Advanced learning: patterns + 90-day calibration + confidence decay (+4 ώρες)

**Απόφαση: C — Advanced learning (SAP/Midday pattern)**
**Αιτιολόγηση:** Enterprise-grade. Κάθε manual match αποθηκεύεται ως learned rule. Confidence αυξάνεται με κάθε επιβεβαίωση, μειώνεται (decay) αν ο χρήστης αλλάξει γνώμη ή αν περάσουν 90 μέρες χωρίς επιβεβαίωση. 90-day rolling window για calibration. Αποθήκευση σε Firestore `accounting_matching_rules`. Patterns: merchant name + amount range + description keywords → entity type + category.

---

### Q6: Reports — Ποιες αναφορές στη Φάση 2;

**Τι αποφασίζουμε:** Ποιες λογιστικές αναφορές υλοποιούμε. Σήμερα δεν υπάρχει κανένα report.

**Νομικό πλαίσιο:** ΕΛΠ Ν.4308/2014 — ατομική επιχείρηση: υποχρεωτική μόνο Κατάσταση Αποτελεσμάτων (Β.6)

**Έρευνα βιομηχανίας:** SAP, NetSuite, QuickBooks, Xero — όλοι παρέχουν 7+ standard reports

**Επιλογές:**
- A — Core 3: P&L + Trial Balance + AR Aging (~4 ώρες)
- B — Core 3 + Tax Summary + Bank Reconciliation Statement (~6 ώρες)
- C — Full 7: Τα 5 παραπάνω + Cash Flow + Income by Customer (~9 ώρες)

**Απόφαση: C — Full 7 Reports**
**Αιτιολόγηση:** Google-level = πλήρες σετ αναφορών. 7 reports:
1. **Profit & Loss** (Κατάσταση Αποτελεσμάτων) — ΕΛΠ Β.6, υποχρεωτικό
2. **Trial Balance** (Ισοζύγιο) — βασικό εργαλείο ελέγχου
3. **AR Aging** (Ηλικίωση Απαιτήσεων) — αξιοποιεί customer balances Phase 1b
4. **Tax Summary** (Σύνοψη Φόρων) — χρειάζεται για Ε3/φορολογική δήλωση
5. **Bank Reconciliation Statement** — φυσικό συμπλήρωμα του MatchingEngine
6. **Cash Flow Statement** (Ταμειακές Ροές) — operating + investing + financing
7. **Income by Customer** (Έσοδα ανά Πελάτη) — business intelligence

---

### Q7: Comparative Reports — Σύγκριση περιόδων;

**Τι αποφασίζουμε:** Τα reports δείχνουν μόνο τρέχουσα περίοδο ή και συγκρίσεις;

**Έρευνα βιομηχανίας:**
- SAP/NetSuite: Πάντα comparative, πολλαπλές στήλες
- QuickBooks: "Compare with previous period" toggle
- Xero: Side-by-side σε κάθε report

**Επιλογές:**
- A — Χωρίς comparison (+0)
- B — Simple: τρέχουσα vs ίδια πέρυσι (+1.5 ώρες)
- C — Full: τρέχουσα vs πέρυσι + vs προηγούμενη περίοδος + % μεταβολή (+3 ώρες)

**Απόφαση: C — Full comparison**
**Αιτιολόγηση:** Η σύγκριση είναι η ψυχή του report. 3 στήλες σύγκρισης:
1. Τρέχουσα περίοδος
2. Ίδια περίοδος πέρυσι (YoY — Year over Year)
3. Προηγούμενη περίοδος (MoM/QoQ)
4. Στήλη % μεταβολή (absolute + percentage change)
Εφαρμόζεται σε όλα τα 7 reports.

---

### Q8: Export Formats — Πώς εξάγονται τα reports;

**Τι αποφασίζουμε:** Σε ποια formats εξάγονται τα 7 reports.

**Έρευνα βιομηχανίας:** SAP, NetSuite, QuickBooks, Xero — όλοι παρέχουν PDF + Excel + CSV

**Επιλογές:**
- A — Μόνο PDF (~2 ώρες)
- B — PDF + Excel (~3.5 ώρες)
- C — PDF + Excel + CSV (~4.5 ώρες)

**Απόφαση: C — PDF + Excel + CSV**
**Αιτιολόγηση:** Πλήρης κάλυψη:
- **PDF**: Αποστολή σε λογιστή, εκτύπωση, αρχειοθέτηση
- **Excel (.xlsx)**: Επεξεργασία, pivot tables, custom ανάλυση
- **CSV**: Import σε εξωτερικά συστήματα, myDATA, λογιστικά προγράμματα
Email scheduling (αυτόματη μηνιαία αποστολή) → μελλοντική φάση.

---

### Q9: Report Date Filtering — Πώς επιλέγει ο χρήστης περίοδο;

**Τι αποφασίζουμε:** Πώς ο χρήστης επιλέγει χρονική περίοδο στα reports.

**Έρευνα βιομηχανίας:** SAP, QuickBooks, Xero — όλοι presets + custom range

**Επιλογές:**
- A — Μόνο presets (8 dropdown επιλογές) (~1 ώρα)
- B — Presets + Custom date range (date picker) (~2 ώρες)

**Απόφαση: B — Presets + Custom date range**
**Αιτιολόγηση:** Industry standard. Presets για 90% χρήσης (αυτός ο μήνας, προηγούμενος, τρίμηνο, έτος, YTD, πέρυσι), custom date picker για ειδικές περιπτώσεις. Κοινό component για όλα τα 7 reports.

---

### Q10: Expense by Category — Προσθέτουμε 8ο report;

**Τι αποφασίζουμε:** Πέρα από τα 7 reports (Q6), προσθέτουμε Expense by Category;

**Χρησιμότητα:**
- Πού πάνε τα λεφτά (ποσοστό ανά κατηγορία)
- Φορολογική αναμόρφωση (εκπιπτόμενα vs μη)
- Ε3 mapping (κατηγορίες → κωδικοί ΑΑΔΕ)

**Επιλογές:**
- A — Κράτα 7 reports (+0)
- B — Πρόσθεσε 8ο: Expense by Category (+1 ώρα)

**Απόφαση: B — 8 Reports συνολικά**
**Αιτιολόγηση:** +1 ώρα για πολύ χρήσιμο report. Breakdown εξόδων ανά κατηγορία με %, comparative columns (vs πέρυσι, vs προηγούμενη περίοδο). Βοηθάει σε Ε3 mapping + φορολογική αναμόρφωση.

**Τελική λίστα 8 Reports:**
1. Profit & Loss (Κατάσταση Αποτελεσμάτων — ΕΛΠ Β.6)
2. Trial Balance (Ισοζύγιο)
3. AR Aging (Ηλικίωση Απαιτήσεων)
4. Tax Summary (Σύνοψη Φόρων)
5. Bank Reconciliation Statement
6. Cash Flow Statement (Ταμειακές Ροές)
7. Income by Customer (Έσοδα ανά Πελάτη)
8. Expense by Category (Έξοδα ανά Κατηγορία)

---

### Q11: MatchingEngine UI — Πού ζει το reconciliation screen;

**Τι αποφασίζουμε:** Πού βλέπει ο χρήστης τα αποτελέσματα matching και αποφασίζει.

**Έρευνα βιομηχανίας:**
- Xero: Dedicated reconciliation page, split view
- QuickBooks: Inline στο Banking tab
- SAP: Dedicated app "Bank Statement Reprocessing"
- NetSuite: Dedicated "Match Bank Data" screen

**Επιλογές:**
- A — Ενσωμάτωση στο υπάρχον Bank tab, section "Reconciliation" (~2 ώρες)
- B — Ξεχωριστή σελίδα, split view (κινήσεις αριστερά, τιμολόγια δεξιά) (~4 ώρες)

**Απόφαση: B — Dedicated Reconciliation Page με Split View**
**Αιτιολόγηση:** N:M matching χρειάζεται χώρο. Full-page experience:
- **Αριστερά:** Τραπεζικές κινήσεις (unmatched/suggested), filters, scores
- **Δεξιά:** Τιμολόγια/εγγραφές candidates, confidence indicators
- **Batch actions:** "Αποδοχή Όλων ≥95%", multi-select approve/reject
- **Visual:** Χρωματική κωδικοποίηση tiers (πράσινο/κίτρινο/γκρι/κόκκινο)
- **Route:** `/accounting/reconciliation`

---

### Q12: Reports UI — Πού ζουν τα 8 reports;

**Τι αποφασίζουμε:** Πώς ο χρήστης βλέπει και πλοηγείται στα 8 reports.

**Έρευνα βιομηχανίας:**
- QuickBooks: Reports center — tiles/cards, αναζήτηση, favorites
- Xero: Sidebar navigation, κάθε report σε δική του σελίδα
- SAP Fiori: Tiles dashboard + drill-down
- NetSuite: Report list + saved searches

**Επιλογές:**
- A — Μέσα στο υπάρχον Reports tab, dropdown επιλογή (~1 ώρα)
- B — Dedicated Reports page, sidebar με 8 reports (~3 ώρες)
- C — Reports Dashboard: landing page με cards/tiles + live summaries + drill-down (~5 ώρες)

**Απόφαση: C — Reports Dashboard με Cards/Tiles + Drill-Down**
**Αιτιολόγηση:** SAP Fiori / Google-level UX. Landing page:
- **8 cards/tiles** με live summary (κέρδος, ληξιπρόθεσμα, cash flow, κλπ)
- **Drill-down** σε full report view (κλικ στο card)
- **Date filter** κοινό (presets + custom, βάσει Q9) στο top
- **Export buttons** (PDF/Excel/CSV βάσει Q8) σε κάθε full report view
- **Comparative columns** (βάσει Q7) σε κάθε report
- **Route:** `/accounting/reports` (dashboard) + `/accounting/reports/[type]` (detail)

---
---

## Μεθοδολογία Σχεδιασμού

### Έρευνα Βιομηχανίας (Web Research)

Πριν από κάθε ερώτηση σχεδιασμού, πραγματοποιήθηκε **εκτενής έρευνα στο διαδίκτυο** σε 6 enterprise/SMB πλατφόρμες:

| Πλατφόρμα | Τύπος | Τι μελετήθηκε |
|---|---|---|
| **SAP S/4HANA** | Enterprise ERP | Bank reconciliation algorithm, ML matching, rule-based clearing, 3-tier confidence |
| **Oracle NetSuite** | Enterprise ERP | Many-to-many matching rules, auto-create rules, enrichment-based matching |
| **Microsoft Dynamics 365** | Enterprise ERP | Copilot reconciliation, lump sum recognition, installment matching |
| **Xero** | SMB Accounting | JAX auto-reconciliation, cross-user learning, bank rules engine |
| **QuickBooks Online** | SMB Accounting | Auto-matching rules, bank feeds categorization, reports center |
| **Midday.ai** | Open-source fintech | Weighted scoring (Amount 35%, Description 50%, Currency 10%, Date 5%), 768-dim embeddings |

**Επιπλέον πηγές:** Sage Intacct (split transactions), Stripe (reconciliation API), Codat (categorization patterns), ΑΑΔΕ/ΕΛΠ Ν.4308/2014 (ελληνικές νομικές απαιτήσεις), ΚΦΔ Ν.4987/2022 (φορολογικός κώδικας).

### Διαδικασία Αποφάσεων

12 ερωτήσεις σχεδιασμού τέθηκαν **μία-μία** στον Γιώργο Παγώνη. Κάθε ερώτηση περιλάμβανε:
1. Τι αποφασίζουμε (context)
2. Τι κάνει η βιομηχανία (έρευνα)
3. Επιλογές με effort εκτίμηση
4. Πρόταση με αιτιολόγηση

Ο Γιώργος επέλεξε σε κάθε περίπτωση **enterprise-grade λύση** (Google-level quality).

---

## Plan Υλοποίησης — 5 Υποφάσεις

Οι 12 αποφάσεις ομαδοποιήθηκαν σε **5 υποφάσεις** με βάση τεχνικές εξαρτήσεις. Κάθε υποφάση αντιστοιχεί σε συγκεκριμένες αποφάσεις που τεκμηριώθηκαν παραπάνω μετά από έρευνα βιομηχανίας.

### Διάγραμμα Εξαρτήσεων

```
2a (MatchingEngine Core)  ──→  2b (Rule Learning)  ──→  2d (Reconciliation UI)

2c (Reports Engine)  ──────────────────────────────→  2e (Reports Dashboard UI)
```

- 2a + 2c: Ανεξάρτητα, μπορούν παράλληλα
- 2b: Απαιτεί 2a
- 2d: Απαιτεί 2a + 2b
- 2e: Απαιτεί 2c

---

### Υποφάση 2a: MatchingEngine Core (~8 ώρες)

**Αποφάσεις:** Q1 (weighted scoring rewrite), Q3 (N:M matching), Q4 (CSVImportService SSoT)

**Τι υλοποιείται:**
1. **Rewrite matching-engine.ts** — Νέος weighted scoring algorithm (SAP/Midday pattern)
   - Amount score (35% weight): exact match, ±5% tolerance, partial match
   - Description score (50% weight): keyword matching, Levenshtein distance
   - Currency score (10% weight): same currency bonus
   - Date score (5% weight): proximity scoring, ±7 day tolerance
2. **N:M matching logic** — Combination analysis engine
   - 1:1 (μία κίνηση → ένα τιμολόγιο)
   - 1:N (μία κίνηση → πολλά τιμολόγια, π.χ. μαζική πληρωμή)
   - N:1 (πολλές κινήσεις → ένα τιμολόγιο, π.χ. δόσεις)
   - N:M (πολλές → πολλά, μείγμα)
   - Subset-sum algorithm για εύρεση σετ που "κλείνουν"
3. **Configurable thresholds** — Config type + SAP defaults
   - `autoMatchThreshold`: 95 (default)
   - `suggestThreshold`: 85 (default)
   - `manualThreshold`: 70 (default)
   - Αποθήκευση σε Firestore `accounting_settings`
4. **Wire up CSVImportService** — Σβήσιμο duplicate logic από API route
   - `POST /api/accounting/bank/import` → thin wrapper → CSVImportService
   - Instantiate στο factory (createAccountingServices)
5. **Wire up MatchingEngine** — API endpoints
   - `POST /api/accounting/bank/match` → MatchingEngine.matchTransaction()
   - `GET /api/accounting/bank/candidates?transactionId=X` → MatchingEngine.findCandidates()
   - `POST /api/accounting/bank/match-batch` → MatchingEngine.matchBatch()

**Αρχεία (εκτίμηση):**
- `services/engines/matching-engine.ts` — REWRITE (~400 γρ.)
- `services/engines/matching-scoring.ts` — NEW: scoring algorithm (~200 γρ.)
- `services/engines/matching-combination.ts` — NEW: N:M subset-sum logic (~200 γρ.)
- `types/matching-config.ts` — NEW: config types + defaults (~50 γρ.)
- `services/external/csv-import-service.ts` — WIRE UP (ήδη υπάρχει)
- `services/create-accounting-services.ts` — EDIT: instantiate matching + CSV
- `app/api/accounting/bank/import/route.ts` — EDIT: thin wrapper
- `app/api/accounting/bank/match/route.ts` — EDIT: use MatchingEngine
- `app/api/accounting/bank/candidates/route.ts` — NEW: endpoint
- `app/api/accounting/bank/match-batch/route.ts` — NEW: endpoint

---

### Υποφάση 2b: Rule Learning (~4 ώρες)

**Αποφάσεις:** Q5 (advanced learning + 90-day calibration + confidence decay)

**Τι υλοποιείται:**
1. **Learned Rules Collection** — Firestore `accounting_matching_rules`
   - Pattern storage: merchant name, amount range, description keywords
   - Target: entity type, category, specific entity ID
   - Confidence tracking: αρχικό score, confirmations, rejections
   - Timestamps: created, lastConfirmed, lastUsed
2. **Pattern Recording** — Κάθε manual match αποθηκεύει rule
   - Εξαγωγή pattern από bank transaction description
   - Normalization (lowercase, strip numbers, trim whitespace)
   - Duplicate detection (ίδιο merchant → update existing rule)
3. **90-day Calibration Window**
   - Rolling window: μόνο matches τελευταίων 90 ημερών μετράνε
   - Confidence αυξάνεται με κάθε επιβεβαίωση (+5% per confirm)
   - Confidence μειώνεται (decay) αν ο χρήστης αλλάξει γνώμη (-15% per reject)
   - Rules κάτω από 50% confidence → αυτόματα disabled
4. **Integration με MatchingEngine** — Rules ως πρόσθετος scoring factor
   - Αν υπάρχει learned rule → bonus στο weighted score
   - Recurring pattern detection βάσει rules (αντί hardcoded)

**Αρχεία (εκτίμηση):**
- `types/matching-rules.ts` — NEW: LearnedRule, RulePattern types (~60 γρ.)
- `services/repository/matching-rules-repo.ts` — NEW: CRUD + query (~150 γρ.)
- `services/engines/rule-learning-engine.ts` — NEW: record, calibrate, decay (~250 γρ.)
- `services/engines/matching-engine.ts` — EDIT: integrate rules scoring
- `config/firestore-collections.ts` — EDIT: +ACCOUNTING_MATCHING_RULES
- `services/enterprise-id.service.ts` — EDIT: +matching rule ID generator

---

### Υποφάση 2c: Reports Engine (~8 ώρες)

**Αποφάσεις:** Q6 (8 reports), Q7 (full comparative), Q9 (presets + custom dates), Q10 (expense by category)

**Τι υλοποιείται:**
1. **Report Generator Framework** — Κοινή αρχιτεκτονική
   - `ReportDateFilter`: presets (this_month, last_month, this_quarter, last_quarter, this_year, last_year, ytd) + custom range
   - `ComparativeEngine`: τρέχουσα vs πέρυσι (YoY) + vs προηγούμενη περίοδος (MoM/QoQ) + % μεταβολή
   - `ReportResult<T>`: generic wrapper (data, metadata, comparisons)
2. **8 Report Generators** (standalone functions, repo ως parameter):
   - `generateProfitAndLoss()` — ΕΛΠ Β.6 format, έσοδα - έξοδα = κέρδος
   - `generateTrialBalance()` — Debit/Credit ανά λογαριασμό
   - `generateARaging()` — Ηλικίωση ανά πελάτη, 6 buckets (Phase 1b data)
   - `generateTaxSummary()` — ΦΠΑ + φόρος εισοδήματος + ΕΦΚΑ, Ε3 mapping
   - `generateBankReconciliation()` — Υπόλοιπο τράπεζας vs βιβλίων, εκκρεμή
   - `generateCashFlow()` — Operating + investing + financing activities
   - `generateIncomeByCustomer()` — Breakdown εσόδων ανά πελάτη
   - `generateExpenseByCategory()` — Breakdown εξόδων ανά κατηγορία, %
3. **API Endpoints** — Ένα endpoint ανά report
   - `GET /api/accounting/reports/[type]?from=X&to=Y&preset=Z`
   - Query params: date filter + comparative options

**Αρχεία (εκτίμηση):**
- `types/reports.ts` — NEW: ReportDateFilter, ComparativeConfig, ReportResult types (~100 γρ.)
- `services/reports/report-date-utils.ts` — NEW: preset resolution, period calculation (~120 γρ.)
- `services/reports/comparative-engine.ts` — NEW: YoY, MoM, % change logic (~150 γρ.)
- `services/reports/profit-and-loss.ts` — NEW (~150 γρ.)
- `services/reports/trial-balance.ts` — NEW (~120 γρ.)
- `services/reports/ar-aging.ts` — NEW (~130 γρ.)
- `services/reports/tax-summary.ts` — NEW (~150 γρ.)
- `services/reports/bank-reconciliation.ts` — NEW (~140 γρ.)
- `services/reports/cash-flow.ts` — NEW (~160 γρ.)
- `services/reports/income-by-customer.ts` — NEW (~100 γρ.)
- `services/reports/expense-by-category.ts` — NEW (~100 γρ.)
- `services/reports/index.ts` — NEW: barrel exports
- `app/api/accounting/reports/[type]/route.ts` — NEW: unified report endpoint

---

### Υποφάση 2d: Reconciliation UI (~7 ώρες)

**Αποφάσεις:** Q2 (configurable thresholds + manual approval UI), Q11 (dedicated split view page)

**Τι υλοποιείται:**
1. **Reconciliation Page** — `/accounting/reconciliation`
   - Split view: κινήσεις αριστερά, τιμολόγια/εγγραφές δεξιά
   - Χρωματική κωδικοποίηση: πράσινο (≥95%), κίτρινο (85-94%), γκρι (70-84%), κόκκινο (<70%)
   - Score + λόγοι matching visible ανά πρόταση
   - N:M visual grouping (σετ κινήσεων ↔ σετ τιμολογίων)
2. **Batch Actions**
   - "Αποδοχή Όλων ≥95%" — 1 κλικ batch approval
   - Multi-select approve/reject
   - Undo last action
3. **Matching Settings Panel** — UI για Q2 thresholds
   - 3 sliders: auto-match, suggest, manual thresholds
   - Defaults: 95/85/70
   - Save σε Firestore `accounting_settings`
   - Live preview: "Με αυτά τα thresholds, 32 auto / 8 suggest / 4 manual / 6 unmatched"
4. **Manual Match UI**
   - Αναζήτηση τιμολογίων/εγγραφών
   - Drag & drop ή click-to-match
   - Split transaction UI (κατανομή ποσού σε πολλά)

**Αρχεία (εκτίμηση):**
- `app/accounting/reconciliation/page.tsx` — NEW: page component
- `components/accounting/reconciliation/ReconciliationSplitView.tsx` — NEW (~300 γρ.)
- `components/accounting/reconciliation/BankTransactionList.tsx` — NEW (~200 γρ.)
- `components/accounting/reconciliation/MatchCandidatePanel.tsx` — NEW (~250 γρ.)
- `components/accounting/reconciliation/BatchActionBar.tsx` — NEW (~100 γρ.)
- `components/accounting/reconciliation/MatchingSettingsDialog.tsx` — NEW (~200 γρ.)
- `components/accounting/reconciliation/SplitTransactionDialog.tsx` — NEW (~200 γρ.)
- `hooks/accounting/useReconciliation.ts` — NEW: data fetching + state (~200 γρ.)

---

### Υποφάση 2e: Reports Dashboard UI (~8 ώρες)

**Αποφάσεις:** Q8 (export PDF/Excel/CSV), Q12 (dashboard tiles + drill-down)

**Τι υλοποιείται:**
1. **Reports Dashboard** — `/accounting/reports`
   - 8 cards/tiles με live summaries
   - Κάθε card δείχνει: τίτλος, key metric, trend indicator (↑↓), mini sparkline
   - Κοινό date filter στο top (presets + custom, βάσει Q9)
   - Click → drill-down σε full report
2. **Full Report View** — `/accounting/reports/[type]`
   - Πίνακας δεδομένων με comparative columns (βάσει Q7)
   - Column headers: Τρέχουσα | Πέρυσι | Προηγούμενη | Μεταβολή | %
   - Sorting, filtering ανά στήλη
   - Export bar: κουμπιά PDF / Excel / CSV
3. **Export Engine** (client + server)
   - **PDF**: Server-side generation (react-pdf ή pdfmake), company header, formatted tables
   - **Excel (.xlsx)**: Client-side (SheetJS/xlsx), formulas maintained, styled headers
   - **CSV**: Client-side, raw data, UTF-8 BOM για Excel compatibility

**Αρχεία (εκτίμηση):**
- `app/accounting/reports/page.tsx` — NEW: dashboard page
- `app/accounting/reports/[type]/page.tsx` — NEW: detail page
- `components/accounting/reports/ReportsDashboard.tsx` — NEW: 8 tiles (~250 γρ.)
- `components/accounting/reports/ReportCard.tsx` — NEW: single tile component (~100 γρ.)
- `components/accounting/reports/ReportDateFilter.tsx` — NEW: presets + custom picker (~150 γρ.)
- `components/accounting/reports/ReportTable.tsx` — NEW: generic report table with comparative (~250 γρ.)
- `components/accounting/reports/ExportBar.tsx` — NEW: PDF/Excel/CSV buttons (~80 γρ.)
- `services/reports/export/pdf-exporter.ts` — NEW (~200 γρ.)
- `services/reports/export/excel-exporter.ts` — NEW (~150 γρ.)
- `services/reports/export/csv-exporter.ts` — NEW (~80 γρ.)
- `hooks/accounting/useReport.ts` — NEW: data fetching + date state (~150 γρ.)
- `hooks/accounting/useReportsDashboard.ts` — NEW: dashboard summaries (~100 γρ.)

---

## Σύνοψη Effort

| Υποφάση | Αποφάσεις | Νέα αρχεία | Τροποποιήσεις | Effort |
|---|---|---|---|---|
| **2a** MatchingEngine Core ✅ | Q1, Q3, Q4 | 5 NEW | 6 EDIT | DONE |
| **2b** Rule Learning ✅ | Q5 | 3 NEW | 5 EDIT | DONE |
| **2c** Reports Engine ✅ | Q6, Q7, Q9, Q10 | 13 NEW | 1 EDIT | DONE |
| **2d** Reconciliation UI ✅ | Q2, Q11 | 12 NEW | 6 EDIT | DONE |
| **2e** Reports Dashboard UI ✅ | Q8, Q12 | 13 NEW | 5 EDIT | DONE |
| **ΣΥΝΟΛΟ** | **12 αποφάσεις** | **~40 αρχεία** | **~8 τροποποιήσεις** | **~35 ώρες** |

---

## Changelog

### 2026-03-30 — Phase 2c: Reports Engine (13 νέα αρχεία)
- `types/reports.ts` — ReportType, ComparativeColumn<T>, 8 result interfaces
- `services/reports/report-date-utils.ts` — Date preset resolution
- `services/reports/comparative-engine.ts` — Generic comparative computations
- 8 report generators: expense-by-category, income-by-customer, trial-balance, ar-aging, bank-reconciliation, profit-and-loss, tax-summary, cash-flow
- `services/reports/index.ts` — Registry + barrel export
- `app/api/accounting/reports/[type]/route.ts` — GET endpoint
- Updated `types/index.ts` barrel

### 2026-03-30 — Phase 2d: Reconciliation UI (12 νέα αρχεία)
- `components/reconciliation/tier-colors.ts` — Tier-to-color mapping
- `hooks/useMatchCandidates.ts` — Candidate fetching with AbortController
- `hooks/useMatchActions.ts` — Match, batch, exclude actions
- `hooks/useMatchingConfig.ts` — Firestore config read/write
- `components/reconciliation/CandidateCard.tsx` — Single candidate card
- `components/reconciliation/CandidateGroupCard.tsx` — N:M group card
- `components/reconciliation/TransactionsPanel.tsx` — Left panel with filters
- `components/reconciliation/CandidatesPanel.tsx` — Right panel with candidates
- `components/reconciliation/BatchActionsToolbar.tsx` — Batch actions
- `components/reconciliation/MatchingSettingsDialog.tsx` — Settings with sliders
- `components/reconciliation/ReconciliationPageContent.tsx` — Main orchestrator
- `app/accounting/reconciliation/page.tsx` — Page route
- Updated: lazyRoutes, navigation, i18n (en+el), domain-constants

### 2026-03-30 — Phase 2e: Reports Dashboard UI (13 νέα αρχεία)
- `services/export/report-table-adapter.ts` — Shared flatten logic for table + exporters
- `hooks/useReport.ts` — Single report fetch hook with AbortController
- `hooks/useReportsDashboard.ts` — 8 parallel fetches via Promise.allSettled
- `components/reports/ReportDateFilterBar.tsx` — Radix Select preset picker + custom dates
- `components/reports/FinancialReportCard.tsx` — Dashboard card with key metric + trend
- `components/reports/FinancialReportsDashboard.tsx` — 8-card grid with date filter
- `components/reports/ReportTable.tsx` — Generic comparative table with sorting
- `components/reports/ExportBar.tsx` — PDF/Excel/CSV export buttons
- `components/reports/ReportDetailView.tsx` — Full detail page with filter + export + table
- `services/export/csv-exporter.ts` — UTF-8 BOM CSV export
- `services/export/excel-exporter.ts` — ExcelJS styled export
- `services/export/pdf-exporter.ts` — jsPDF + autoTable with Greek font support
- `app/accounting/reports/[type]/page.tsx` — Detail page route
- Modified: ReportsPageContent (added Tabs), hooks/index.ts, lazyRoutes, i18n (en+el)

