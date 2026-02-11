# Enterprise Analysis - Legal Documents / Obligations (Συγγραφή Υποχρεώσεων)

Ημερομηνία: 2026-02-11  
Πεδίο: `Sidebar -> Νομικά Έγγραφα -> Συγγραφή Υποχρεώσεων`

## 1) Τι ελέγχθηκε
- Κώδικας UI/routes/services/types για το obligations module.
- Σύγκριση με enterprise πρακτικές από μεγάλες εταιρείες λογισμικού κατασκευών και μεγάλες κατασκευαστικές.

## 2) Ευρήματα στην τρέχουσα υλοποίηση (as-is)

### 2.1 Navigation/route ασυνέπειες (υψηλή προτεραιότητα)
- Το navigation δείχνει σωστά τη διαδρομή προς obligations:
  - `src/config/smart-navigation-factory.ts:95`
  - `src/config/smart-navigation-factory.ts:96`
  - `src/config/smart-navigation-factory.ts:534`
  - `src/config/smart-navigation-factory.ts:687`
  - `src/config/smart-navigation-factory.ts:688`
- Στο `new` page υπάρχουν links προς routes που δεν βρέθηκαν υλοποιημένα στον app router:
  - Redirect μετά create: `src/app/obligations/new/page.tsx:443` -> `/obligations/${newObligation.id}/edit`
  - Back link: `src/app/obligations/new/page.tsx:461` -> `/obligations`
- Υπάρχουν μόνο:
  - `src/app/obligations/error.tsx`
  - `src/app/obligations/new/page.tsx`
  - `src/app/obligations/new/error.tsx`

Συμπέρασμα: υπάρχει λειτουργικό ρίσκο dead-end/404 στη ροή μετά τη δημιουργία εγγράφου.

### 2.2 Lifecycle status περιορισμένο (μεσαία-υψηλή προτεραιότητα)
- Το status contract είναι μόνο: `draft | completed | approved`:
  - `src/types/obligations/contracts.ts:1`

Συμπέρασμα: για enterprise legal/document control λείπουν ενδιάμεσα states (review, returned-for-correction, superseded, archived, void κ.λπ.).

### 2.3 PDF export contract χωρίς πλήρη υλοποίηση (υψηλή προτεραιότητα)
- Η υπηρεσία εκθέτει `exportToPDF`:
  - `src/services/obligations/ObligationsService.ts:104`
  - `src/services/obligations/ObligationsService.ts:105`
- Το repository ρίχνει explicit not-implemented:
  - `src/services/obligations/InMemoryObligationsRepository.ts:320`
  - `src/services/obligations/InMemoryObligationsRepository.ts:321`

Συμπέρασμα: υπάρχει συμβόλαιο δυνατότητας export χωρίς εγγυημένη backend ολοκλήρωση.

### 2.4 Naming/architecture drift στο repository layer (μεσαία προτεραιότητα)
- Μέσα σε αρχείο `InMemoryObligationsRepository.ts` δηλώνεται κύρια κλάση `FirestoreObligationsRepository`:
  - `src/services/obligations/InMemoryObligationsRepository.ts:28`
- Υπάρχει επίσης deprecated compatibility class:
  - `src/services/obligations/InMemoryObligationsRepository.ts:326`

Συμπέρασμα: δημιουργεί σύγχυση συντήρησης και technical debt σε κρίσιμο υποσύστημα.

### 2.5 Legacy placeholders παραμένουν (μεσαία προτεραιότητα)
- Legacy forms εμφανίζονται ακόμα ως placeholders:
  - `src/components/obligations/ObligationForm.tsx:11`
  - `src/components/obligations/ObligationForm.tsx:12`
- i18n επιβεβαιώνει legacy state:
  - `src/i18n/locales/el/obligations.json:225`
  - `src/i18n/locales/en/obligations.json:225`

Συμπέρασμα: συνυπάρχουν modern και legacy ροές, αυξάνοντας ασάφεια προϊόντος.

## 3) Πιθανά φράγματα πριν enterprise rollout
- Απουσία πλήρους route map για list/view/edit obligations.
- Απουσία πλήρους document workflow engine (στάδια + approvals + επιστροφές).
- Απουσία immutable revision chain με audit-level events (ποιος/πότε/τι άλλαξε).
- Απουσία SLA/reminder/escalation μηχανισμού για obligations deadlines.
- Απουσία προτυποποιημένων policy packs ανά τύπο έργου/σύμβασης.
- Απουσία clear governance για superseded/obsolete εκδόσεις.

## 4) Τι κάνουν οι μεγάλοι vendors λογισμικού (benchmark)

### 4.1 Procore (Construction specs/submittals/change workflows)
- Διαχωρίζει clearly το document lifecycle (draft, review, approved κ.λπ.).
- Παρέχει granular permissions ανά ρόλο και στάδιο workflow.
- Συνδέει τεκμήρια με submittals/RFIs και downstream execution.

### 4.2 Oracle Aconex / Oracle Construction ecosystem
- Έμφαση σε immutable document records και πλήρες audit trail.
- Controlled workflow transitions για επίσημες εγκρίσεις.
- Enterprise document control με traceability across contract chain.

### 4.3 Autodesk Build / ACC
- Standardized issue/document/submittal flows με assignment, due dates, accountability.
- Version-aware collaboration σε common data environment.

## 5) Τι κάνουν οι μεγάλες κατασκευαστικές (benchmark)

### 5.1 Turner Construction
- Επενδύει σε VDC/BIM-centric delivery και standard digital workflows σε scale.
- Η πληροφορία έργου λειτουργεί με κοινά ψηφιακά standards (όχι ad-hoc τοπικές φόρμες).

### 5.2 Bechtel
- Δηλώνει integrated digital delivery με κοινό περιβάλλον πληροφορίας και ελέγχους ποιότητας/ιχνηλασιμότητας.
- Process governance σε όλο τον κύκλο engineering-procurement-construction.

### 5.3 Skanska
- Εφαρμόζει digitalized project controls, sustainability/compliance traceability και data-driven governance σε portfolio κλίμακα.

## 6) Προτάσεις για Nestor (enterprise-ready target)

### P0 (πριν από νέο feature code)
1. Κλείσιμο route gaps:
- Υλοποίηση ή ανακατεύθυνση για `/obligations` (list/index).
- Υλοποίηση ή ανακατεύθυνση για `/obligations/[id]/edit`.

2. Καθαρισμός architecture naming:
- Ευθυγράμμιση ονομάτων αρχείων/κλάσεων repository (Firestore vs InMemory).
- Αφαίρεση deprecated facade όταν ολοκληρωθεί migration.

3. Hard stop για contract mismatch:
- Αν δεν υπάρχει backend PDF export, το UI να μην το παρουσιάζει ως production-ready capability.

### P1 (enterprise document control)
1. Επέκταση status machine:
- `draft -> in_review -> returned -> approved -> issued_for_construction -> superseded -> archived`.

2. Revision governance:
- `docNumber`, `revision`, `supersedes`, `supersededBy`, immutable publication snapshots.

3. Approval matrix:
- Ρόλοι (author, reviewer, approver, legal, PM), υποχρεωτικές υπογραφές/χρονοσφραγίδες.

4. SLA/escalations:
- Due dates ανά στάδιο, reminders, escalation κανόνες, dashboard καθυστερήσεων.

### P2 (λειτουργικότητα κλίμακας)
1. Template packs:
- Πρότυπα ανά project type/contract model με mandatory clauses.

2. Cross-module links:
- Σύνδεση obligations με contracts, milestones, payments, change orders.

3. Searchability:
- Full-text + clause tags + obligations matrix export (Excel/PDF) για ελέγχους.

## 7) Προτεινόμενη απόφαση ADR-level
- Να ΜΗΝ θεωρηθεί ολοκληρωμένο enterprise module στο τρέχον state.
- Να προηγηθεί stabilization phase (routes/contracts/workflow/audit/revisions) και μετά feature expansion.
- Να οριστεί “Obligations Domain Model v2” ως ενιαία πηγή αλήθειας για UI/API/DB.

## 8) Πηγές (internet)
- Procore Docs - Workflows and permissions:
  - https://support.procore.com/products/online/user-guide/project-level/workflows/tutorials/create-a-custom-workflow-template
  - https://support.procore.com/products/online/user-guide/company-level/permissions/tutorials/grant-granular-permissions-in-a-permissions-template
- Oracle Aconex help (document control):
  - https://help.aconex.com/
  - https://help.aconex.com/get-started/learn-about-aconex/manage-documents/
- Autodesk Construction Cloud / Autodesk Build:
  - https://www.autodesk.com/solutions/construction-software/construction-document-management
  - https://help.autodesk.com/view/BUILD/ENU/
- Turner Construction (VDC capabilities):
  - https://www.turnerconstruction.com/services/virtual-design-construction
- Bechtel Digital Delivery:
  - https://www.bechtel.com/services/digital-delivery/
- Skanska (Digitalization / project delivery themes):
  - https://www.group.skanska.com/how-we-work/innovation/
- ISO 19650 guidance context:
  - https://www.ukbimframework.org/iso-19650-guidance/

---

Σημείωση: Τα σημεία benchmark είναι σύνθεση από public vendor/contractor documentation και όχι αναπαραγωγή εσωτερικών διαδικασιών εταιρειών.
