# Handoff 2026-11-22 — Υλοποίηση ADR-949 (έγγραφα → αυτόματη συμπλήρωση · «Ζήτα συμβολαιογράφο») + ADR-947 Φ2/Φ3

**Worktree:** `C:\Nestor_Worktrees\objective-value-next` · **Κλαδί:** `agent/objective-value-next` (η νέα συνεδρία
συνεχίζει ΣΤΟ ΙΔΙΟ worktree).
⛔ Στο `main` κανένα commit. **`wt:land` και push ΜΟΝΟ με ρητή εντολή Giorgio.**
⛔ Κανένα test / tsc / jscpd / πύλη χωρίς έγκριση (CLAUDE.md N.(-2), N.17). Commit στο κλαδί `agent/*` με ρητή λίστα αρχείων.
Πήχης Giorgio: Revit · ArchiCAD · Cinema 4D · Figma · Zillow · Idealista, και καλύτερα. Full enterprise + full SSoT,
καμία έκπτωση. Όπου δεν είσαι σίγουρος, κάνε έρευνα στο διαδίκτυο. **Πριν από κάθε κώδικα, πραγματικό SSoT audit με grep.**

## Τι έγινε σε αυτή τη συνεδρία (δεσμευμένο στο κλαδί, ΟΧΙ στο main)

### 1. Όμοροι όροφοι: ΕΝΑΣ κανόνας (ADR-898 §24 · ADR-236 changelog) — κώδικας, ΑΝΕΠΑΛΗΘΕΥΤΟΣ
- Νέο `src/lib/floor/level-stack.ts` (καθαρό): `levelStackNeighbours` (χαμηλότερος −1 / ψηλότερος +1, με προαιρετικά
  όρια) · `shiftLevelStack` · `isLevelStackEnd`. Πρότυπο Revit Base/Top Constraint · ArchiCAD Home Story + Top Link.
- `FloorMultiSelectField.tsx` (Μονάδες) → καλεί τον κοινό κανόνα. Η συμπεριφορά δεν αλλάζει.
- `ObjectiveValueProperty.tsx` (υπολογιστής), όπως αποφάσισε ο Giorgio:
  - επιλογέας μόνο στο επίπεδο 1, με μετακίνηση όλης της στοίβας
  - κουμπιά ↑/↓ για νέο επίπεδο
  - αφαίρεση μόνο στα άκρα
  - πραγματικός όροφος στο πρόχειρο (ΣΤ'+Ζ' = 6/7, ίδια ετικέτα κάδου)
  - δεύτερο υπόγειο επιτρέπεται
- `objective-value-prefill.ts`: εξάγει `OBJECTIVE_VALUE_FLOOR_BOUNDS` (−9…99) + `MAX_LEVELS` (9).
- 4 κλειδιά el/en: `property.levelBelow/levelAbove/derivedFloor/levelFloorPending`. Αναπαράχθηκαν τα `src/types/i18n.ts`,
  route slice και manifest.
- ⚠️ **Δεν έτρεξε jest, tsc, ούτε έλεγχος σε browser.** Προτείνεται, με έγκριση: jest για το `level-stack.ts` (δεν έχει
  tests) + ζωντανός έλεγχος στο `/ergaleia/antikeimeniki-axia`. Ο browser του Giorgio είναι σε ζουμ 80%.
- Παρατήρηση, όχι εργασία: ορφανό JSDoc επικύρωσης στο `src/services/multi-level.service.ts:94-108`.

### 2.+3. ADR-949 (ΠΡΟΤΕΙΝΟΜΕΝΟ) — έρευνα + σχέδιο, ΧΩΡΙΣ κώδικα
`docs/centralized-systems/reference/adrs/ADR-949-objective-value-documents-and-notary-request.md`.
**Διάβασέ το ολόκληρο πριν ξεκινήσεις.** Επίσης ADR-947 (§5 Δ1–Δ9, §6 φάσεις) και ADR-945.

## Ο Giorgio ενέκρινε τις 4 κύριες αποφάσεις του ADR-949

1. Το έγγραφο διαβάζεται **στον browser** (`pdfjs-dist`) με τους **ίδιους καθαρούς** αναγνώστες του μητρώου ADR-915.
   Το αρχείο δεν ανεβαίνει πουθενά. Σαρωμένο PDF ⇒ «δεν διαβάζεται», χωρίς OCR/LLM στη δημόσια σελίδα.
2. Πρόταση με αναφορά σελίδας («Ε9, σελ. 2») → έγκριση ανά πεδίο. Η προέλευση μένει `declared` («δηλώσατε από το
   Ε9»), **ποτέ** `public-record`/`attested`.
3. Η σελίδα δείχνει μόνο έγγραφα για τα πεδία που λείπουν (`needsInput.missing`), με φορέα · σύνδεσμο · κόστος.
4. Συμβολαιογράφος: ρητή «αποδοχή χωρίς χρέωση» (βάση `'no-charge'`, όχι ποσό 0) · προσφορά · απόρριψη.
   Ελάχιστη αποκάλυψη πρώτα. Πληρωμή εκτός πλατφόρμας. Κατάλογος χωρίς κατάταξη, αξιολογήσεις ή σύγκριση τιμών.

## Τι κάνει η νέα συνεδρία: υλοποίηση ΟΛΩΝ, με αυτή τη σειρά

**Ανοιχτά ερωτήματα που ΔΕΝ έχουν απαντηθεί (ADR-949 §8): ρώτα τον Giorgio στην αρχή, μην τα μαντέψεις.**
- (1) δείγματα PDF Ε9 / ΕΝΦΙΑ / οικοδομικής άδειας
- (2) νομικό «χωρίς χρέωση / προσφορά»
- (4) `settlement` ανά είδος υπηρεσίας ή κανόνας για όλους τους νομικούς επαγγελματίες

1. **Α-1** — μητρώο `OBJECTIVE_VALUE_EVIDENCE` (είσοδος → έγγραφα → φορέας/σύνδεσμος/κόστος) και οδηγός στη σελίδα.
   SSoT: πρώτα το `src/config/document-validity/document-issuers.ts` — επέκταση, όχι δεύτερη λίστα. Κάθε σύνδεσμος και
   κόστος **επαληθεύεται** στην επίσημη πηγή (ADR-949 §2.1 πίνακας). Κείμενα μόνο σε locales el+en.
2. **Α-2** — ανάγνωση στη συσκευή + πρόταση/επιβεβαίωση με τους **υπάρχοντες** αναγνώστες:
   - `readPeaText` (`lib/energy-certificate/pea-text.ts`) και `pea-proposal.ts` (το μοτίβο)
   - `lib/geo/kaek.ts`
   - Ελέγξτε την αντιστοίχιση θέρμανσης ΠΕΑ → `hasCentralHeating`.
   - Η προέλευση επεκτείνει το `objective-value-input-provenance.ts` (ADR-947 Δ2). Όχι δεύτερη κλίμακα.
   - Δεν φτιάχνεται server endpoint.
3. **Α-3** — νέοι αναγνώστες Ε9 · ΕΝΦΙΑ · άδεια στο `lib/document-validity/document-text-facts.ts`. **ΜΟΝΟ** με
   πραγματικά δείγματα. Χωρίς δείγμα: σταμάτα και ζήτα. Το Ε9 με πολλά ακίνητα επιστρέφει γραμμές και ο χρήστης
   διαλέγει μία. Ο αναγνώστης δεν έχει πεδίο για ΑΦΜ ή ονόματα.
4. **ADR-947 Φ2** — `objective_value_snapshots` (enterprise ID: νέο πρόθεμα στο `enterprise-id.service` + `setDoc`,
   αμετάβλητο), PDF πληροφοριακού υπολογισμού, ένδειξη απόκλισης.
5. **ADR-947 Φ3** — γενίκευση μονάδας ADR-945 σε `IssuanceDeliverable` (`document` | `service`) + `SERVICE_KIND_SPECS`.
   Καθαρό refactor, καμία αλλαγή συμπεριφοράς, το id seed των εγγράφων αμετάβλητο.
6. **Β-1…Β-4** (ADR-949 §5 Β):
   - `serviceKind: 'objective-value-review'`
   - `QUOTE_BASES` + `'no-charge'`
   - `settlement` στο `SERVICE_KIND_SPECS`
   - «η δική μου» / «βρες μου» (`acceptsRequests` στο `/pro`, `recipient-quota`)
   - engagement `property_dossier` με ρόλο `notary` (υπάρχει) + `engagement-invitations`
   - φάκελος υπολογισμού πριν τη συμφωνία, έγγραφα ανά αρχείο μετά (ADR-916 Φ-Ε1 `dossier-share-reach.ts`)
   - παράδοση στιγμιότυπου
   - «ο δικός μου επαγγελματίας» (επέκταση `lib/engagements/contact-professional-link.ts`)

Το Μέρος Β είναι μεγάλο: 5+ αρχεία, 2+ τομείς. Κατά CLAUDE.md N.8, πριν ξεκινήσει **ενημέρωσε τον Giorgio και πρότεινε
Plan Mode ή Orchestrator**. Κάθε φάση: κώδικας + ADR (949/947/945) changelog στο ίδιο commit. Λεξιλόγιο: καμία
«βεβαίωση» ή «επίσημη τιμή» (ADR-947 Δ1). Για νέα ADR, ο αριθμός βρίσκεται με `ls docs/centralized-systems/reference/adrs/`.
Το ευρετήριο ξαναπαράγεται με `node docs/centralized-systems/reference/scripts/generate-adr-index.cjs`, και η κεφαλίδα του
ADR πρέπει να είναι πίνακας `| **Status** |`, αλλιώς βγαίνει «APPROVED».

## Χρήσιμα εργαλεία που μετρήθηκαν
- Το `pdf-parse` είναι v2: `const { PDFParse } = require('pdf-parse'); new PDFParse({ data }).getText()`.
- Μετά από αλλαγή σε locales: `npm run generate:i18n-types` + `npm run generate:i18n-shell-slice`.
