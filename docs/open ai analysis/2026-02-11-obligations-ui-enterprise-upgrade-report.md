# UI Enterprise Review - Legal Documents / Obligations

Ημερομηνία: 2026-02-11  
Τοποθεσία: `Sidebar -> Νομικά Έγγραφα -> Συγγραφή Υποχρεώσεων`

## Σύντομη απάντηση (Ναι/Όχι)
- Είναι σωστό όπως είναι τώρα για enterprise χρήση; **Όχι**.
- Θα το υλοποιούσαν έτσι μεγάλες εταιρείες λογισμικού/κατασκευαστικές; **Όχι, όχι σε αυτή τη μορφή**.
- Μπορεί να εξελιχθεί σε enterprise; **Ναι, με στοχευμένες αλλαγές IA/UI/workflow**.

## Τι βρέθηκε στην τρέχουσα υλοποίηση UI

1. Υπάρχει λειτουργικό editor + live preview, αλλά η ροή είναι «single heavy page».
- `src/app/obligations/new/page.tsx` (μονολιθική σελίδα με πολλά concerns: δεδομένα, relationships, editor, preview, submit).

2. Υπάρχουν route UX ασυνέπειες.
- Redirect σε edit route: `src/app/obligations/new/page.tsx:443`.
- Back link προς list: `src/app/obligations/new/page.tsx:461`.
- Υλοποιημένα app routes που βρέθηκαν: μόνο `src/app/obligations/new/page.tsx` + error pages.

3. Το preview layout βασίζεται σε fixed ύψος.
- `src/app/obligations/new/page.tsx:124` χρησιμοποιεί fixed preview height token.
- Αυτό δεν κλιμακώνει καλά σε μεγάλα έγγραφα/μικρές οθόνες.

4. Συνυπάρχουν legacy placeholders στο UI.
- `src/components/obligations/ObligationForm.tsx`
- `src/components/obligations/ObligationEditForm.tsx`
- Δίνουν μήνυμα μη ολοκληρωμένης εμπειρίας.

5. Υπάρχει καλή modular βάση σε επιμέρους components.
- `src/components/obligations/structure-editor/StructureEditor.tsx`
- `src/components/obligations/live-preview.tsx`
- Αυτό είναι θετικό για refactor σε enterprise architecture.

## Τι κάνουν οι μεγάλοι vendors (software) στο UI

### Autodesk Build (Submittals)
- Χρησιμοποιεί ξεκάθαρο workflow bar με pending reviewers, review table, responses, revisions, close/distribute.
- Διακριτά στάδια ροής και accountability ανά βήμα.

### Procore
- Εστιάζει σε metadata + permissions + standardized workflow και revision-aware διαχείριση docs/specs.
- Ενιαία document management εμπειρία με ISO 19650 προσανατολισμό.

### Oracle Aconex
- Immutable transmittal record, supersede versioning, event log, access control ανά πεδίο/τύπο εγγράφου.
- Μαζικές λειτουργίες με metadata templates (Excel bulk processing).

### Trimble (ProjectSight / Vista)
- Ρητές καταστάσεις, due/sent/returned/received dates, register-based lifecycle.

## Τι δείχνουν οι μεγάλες κατασκευαστικές (operating model)

### Turner
- Ψηφιακές ροές VDC/BIM που συνδέουν design, schedule, budget και decision gates.

### Skanska
- Single digital source (GIS/BIM/data portals), hazard/workflow tracking, data-driven συνεργασία.

### Bechtel
- Data-centric execution με 3D/4D/5D, cloud systems, model governance.

## Κύρια συμπεράσματα για το UI του Nestor

1. Το σημερινό UI είναι καλό MVP editor, όχι enterprise document-control cockpit.
2. Το enterprise επίπεδο θέλει:
- multi-state workflow,
- ισχυρό revision/traceability UI,
- role-driven actions,
- list/register εμπειρία πριν από editor,
- σύνδεση με φάσεις και κόστη ως first-class στοιχεία.

## Προτάσεις και αλλαγές που πρέπει να γίνουν

## A. Information Architecture (υποχρεωτικό)
1. Να προστεθεί πλήρες Obligations workspace με 4 οθόνες:
- `Register/List` (πίνακας εγγράφων, φίλτρα, statuses, assignees, due dates)
- `Detail/Workflow` (timeline εγκρίσεων, actions, comments, transmittals)
- `Editor` (δομή άρθρων/παραγράφων)
- `Revision Compare` (diff μεταξύ εκδόσεων)

2. Να μην ξεκινάει ο χρήστης πάντα από `new` page.
- Enterprise pattern: πρώτα register, μετά create/edit/view.

## B. Workflow UI (υποχρεωτικό)
1. Προσθήκη workflow bar με σαφή στάδια:
- Draft -> In Review -> Returned -> Approved -> Issued -> Superseded -> Archived.

2. Προσθήκη "Pending action from" και SLA indicators.
- badges για overdue, approaching due date, blocked.

3. Approval matrix panel.
- Ρόλοι: author/reviewer/approver/legal/pm, με timestamps και υπογραφές.

## C. Revision & Audit UI (υποχρεωτικό)
1. Header metadata panel:
- `Doc No`, `Revision`, `Status`, `Discipline`, `Cost Code`, `WBS/Phase`, `Owner`.

2. Event log tab:
- ποιος, πότε, τι άλλαξε (immutable history).

3. Revision compare view:
- clause-level change highlighting.

## D. Σύνδεση με φάσεις και κοστολόγια (υψηλή προτεραιότητα)
1. Obligations-to-Phase binding panel.
- κάθε υποχρέωση να συνδέεται με milestone/phase και acceptance criteria.

2. Obligations-to-Cost binding panel.
- cost code / BOQ item / budget line ανά υποχρέωση.

3. Gate rules στο UI:
- να φαίνεται ρητά γιατί δεν κλείνει φάση ή δεν προχωρά πληρωμή λόγω ανοικτών υποχρεώσεων.

## E. Usability & Performance
1. Αντικατάσταση fixed preview heights με responsive split panes (resizable, persisted ανά χρήστη).
2. Virtualized lists για μεγάλα documents/registers.
3. Autosave + conflict resolution indicator (αν αλλάζει ταυτόχρονα άλλος χρήστης).
4. Keyboard shortcuts, command palette για power users.

## F. Modularity & Maintainability
1. Διάσπαση `new/page.tsx` σε feature modules:
- container/orchestration,
- form state,
- workflow actions,
- preview layout,
- integrations.

2. Shared obligation shell components:
- `ObligationsHeader`, `WorkflowBar`, `RevisionPanel`, `CompliancePanel`.

3. Σταθερό route contract:
- `/obligations`
- `/obligations/[id]`
- `/obligations/[id]/edit`
- `/obligations/[id]/revisions/[rev]`

## Σχέδιο υλοποίησης (προτεινόμενο)

### Phase 1 (2-3 εβδομάδες)
- Register/List + route completion + workflow bar v1 + status model expansion.

### Phase 2 (3-4 εβδομάδες)
- Approval matrix + event log + revision compare v1.

### Phase 3 (3-5 εβδομάδες)
- Full phase/cost bindings + gate rules + analytics widgets.

## Enterprise UI KPIs που πρέπει να μετριούνται
- Time-to-approval ανά υποχρέωση.
- % overdue obligations.
- Avg review cycles ανά document.
- % milestones blocked by open obligations.
- % cost lines with unresolved obligations.

## Πηγές (internet)
- Autodesk Build - Submittals Overview:
  - https://help.autodesk.com/cloudhelp/ENU/Build-Submittals/files/getting_started_submittals/Submittals_Overview.html
- Autodesk Build - Process Submittal:
  - https://help.autodesk.com/cloudhelp/ENU/Build-Submittals/files/work-submittals/Process_Submittal.html
- Procore - Document Management:
  - https://support.procore.com/products/online/user-guide/project-level/document-management
- Procore - Generate Submittals from Specifications:
  - https://pl-pl.support.procore.com/products/online/user-guide/project-level/specifications/tutorials/generate-submittal-log
- Oracle Aconex - Transmit your document:
  - https://help.aconex.com/documents/transmit-your-document/
- Oracle Aconex - Bulk Processing:
  - https://help.aconex.com/documents/upload-and-supersede-documents-using-the-bulk-processing-tool/
- Oracle Aconex - Access Control:
  - https://help.aconex.com/org-admins/use-access-control-to-restrict-users-access-to-documents/
- Trimble ProjectSight - Submittals:
  - https://prod.projectsightapp.trimble.com/Web/Web%20Help/Content/Online_Help/Records/Document_Control/Submittals.htm
- UK BIM Framework - ISO 19650 Guidance (CDE/workflow):
  - https://www.ukbimframework.org/wp-content/uploads/2021/02/Guidance-Part-C_Facilitating-the-common-data-environment-workflow-and-technical-solutions_Edition-1.pdf
- Turner Construction - VDC:
  - https://www.turnerconstruction.com/services/virtual-design-and-construction-bim
- Skanska - GIS / single-source collaboration examples:
  - https://www.skanska.co.uk/expertise/sectors/highways/geographic-information-systems-gis/
- Bechtel - Services (data-centric delivery, 3D/4D/5D):
  - https://www.bechtel.com/services/

---

Τελικό συμπέρασμα: για enterprise στόχο χρειάζεται μετασχηματισμός από "editor page" σε "document control workspace" με workflow, revisions, approvals, και άμεση σύνδεση με phases/costs.
