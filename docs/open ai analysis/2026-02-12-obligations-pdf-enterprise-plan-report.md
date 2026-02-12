# Enterprise Analysis & Plan: Obligations PDF / Print / Share
Date: 2026-02-12
Scope: `obligations` print/export pipeline (technical specs / contractual obligations) with enterprise-grade output and controlled sharing.

## 1) Executive Summary
Η τρέχουσα υλοποίηση εξάγει λειτουργικό PDF, αλλά δεν είναι ακόμα σε επίπεδο enterprise document-control (πλήρης ταυτότητα εγγράφου, revision governance, issue/transmittal readiness, legal-grade signature workflow).

Πρόταση: κρατάμε τη σημερινή αρχιτεκτονική renderer-based (`src/services/pdf/*`) και τη βελτιώνουμε στοχευμένα με:
- Document Control Header (Doc No, Revision, Status, Issue Date, Page X/Y)
- Cover σε contract/spec format (εταιρεία/έργο/κτίριο ή μονάδα/συμβαλλόμενοι)
- Formal approval/signature blocks + distribution table
- Structured appendix blocks (phases/milestones/cost bindings) όταν υπάρχουν
- PDF sharing με web share fallback + deterministic filename

## 2) Findings From Current Codebase
- Η βάση είναι καλή: modular renderers (`CoverRenderer`, `TOCRenderer`, `ContentRenderer`, `HeaderFooterRenderer`).
- Υπάρχει ήδη πλούσιο domain model σε `ObligationDocument` (`docNumber`, `revision`, `status`, `projectDetails`, `companyDetails`, `buildingId`, `unitId`, `phaseBinding`, `costBinding`, `approvals`).
- Κενό: τα metadata δεν αποτυπώνονται ακόμη πλήρως στο export layout.
- Κενό: το share flow είναι κυρίως preview/download, όχι end-to-end enterprise transmittal UX.

## 3) Internet Benchmark (Primary Sources)
### 3.1 Μεγάλες εταιρείες λογισμικού (Construction PM / CDE)
1. Autodesk Build Submittals: workflow bar, reviewers, close/distribute, δημιουργία νέας revision, watchers, due dates.
Source: https://help.autodesk.com/cloudhelp/ENG/Build-Submittals/files/work-submittals/Process_Submittal.html

2. Procore Submittals: default statuses + custom statuses για granular process control.
Source: https://support.procore.com/faq/what-are-the-default-submittal-statuses-in-procore
Source: https://support.procore.com/products/online/user-guide/project-level/submittals/best-practices-submittals

3. Oracle Aconex: transmittals/workflows/revision chains με explicit document versioning και transmittal details.
Source: https://help.aconex.com/tasks/opening-a-document-transmittal/
Source: https://help.aconex.com/workflows/review-documents-from-a-workflow-transmittal/
Source: https://help.aconex.com/es/apis/api-guide-documents/

4. Primavera Unifier: dedicated bid-management/bidder process account, controlled portal behavior.
Source: https://docs.oracle.com/cd/F37129_01/English/unifier_modules/74446.htm

5. Autodesk BuildingConnected / TradeTapp: standardized bid forms, bid comparison, vendor risk/qualification integration, API integration με ERP/CRM/BI.
Source: https://aps.autodesk.com/developer/overview/buildingconnected-and-tradetapp-apis
Source: https://construction.autodesk.com/resources/specialty-contractors-customer-stories/

### 3.2 Πρότυπα για νομικά έγκυρο PDF/signing
1. PAdES baseline signatures (ETSI EN 319 142) για long-term valid signatures.
Source: https://webstore.ansi.org/standards/ds/dsetsien319142v12024

2. eIDAS/QES πρακτική χρήσης σε ευρωπαϊκά workflows.
Source: https://ec.europa.eu/digital-building-blocks/wikis/display/DIGITAL/eSignature%2BFAQ
Source: https://commission.europa.eu/system/files/2023-03/Instructions%20for%20QES%20signature%20of%20documents.pdf

3. PDF/A για archival stability (ISO 19005 family).
Source: https://pdfa.org/resource/pdfa-flyer/
Source: https://helpx.adobe.com/sign/config/global/pdf-a-workflows.html

## 4) What Large Construction Firms Actually Do (Inference)
Inference from Autodesk/Procore/Aconex customer patterns + workflow docs:
- Χρησιμοποιούν CDE-style document control (status + revision + transmittal + audit trail).
- Δεν βασίζονται σε "ένα static PDF"· το PDF είναι controlled snapshot μιας governed record.
- Συνδέουν contractual/spec docs με project context (project/package/scope) και distribution matrix (ποιος το πήρε, πότε, τι revision).
- Διαχωρίζουν clearly: contractual obligations/specifications vs procurement/bid comparison workflows.

## 5) Gap Analysis for Nestor
Critical gaps προς enterprise επίπεδο:
1. Header/footer δεν περιέχει πλήρη document identity και controlled issue metadata.
2. Cover δεν δείχνει πλήρες chain: company -> project -> building/unit scope.
3. Approval/signature section λείπει ως δομημένο τμήμα (prepared/reviewed/approved/sign date).
4. Distribution list / issue log λείπει από export payload.
5. Status-to-layout semantics δεν είναι πλήρεις (draft/review/issued/superseded/archived visual treatment).
6. Δεν υπάρχει explicit PDF legal mode (PAdES-ready placeholder + archival option).

## 6) Proposed ADR (to create in centralized ADR folder)
Title: "ADR - Enterprise Obligation Document Control & PDF Output"
Decision:
- Το obligations PDF γίνεται governed artifact με mandatory document-control metadata.
- Η υποχρεωτική δομή export γίνεται:
  1) Cover (identity + parties + scope)
  2) TOC
  3) Clauses
  4) Project/phase/cost appendices (optional but typed)
  5) Approvals & signatures
  6) Distribution / issue log
- Status model παραμένει συμβατό με υπάρχον enum αλλά αποκτά fixed print semantics.
- Share flow υποστηρίζει preview/download και native share όταν είναι διαθέσιμο.

## 7) Proposed Firestore Schema (Obligations Document Control)
Για να στηρίξει enterprise print/share:

Collection: `obligations`
- `id`
- `title`
- `docNumber` (indexed)
- `revision` (indexed)
- `status` (indexed)
- `companyId` (indexed)
- `projectId` (indexed)
- `buildingId` (optional, indexed)
- `unitId` (optional, indexed)
- `parties[]` (role, name, legalId)
- `phaseBinding` (phaseId, phaseName, milestoneId)
- `costBinding` (costCode, boqItem, budgetAmount)
- `approvals[]` (role, userId/contactId, decision, date, notes)
- `distribution[]` (recipientType, recipientId/email, channel, sentAt, revisionSent)
- `issueLog[]` (issueType, issuedAt, issuedBy, revision)
- `pdfSnapshot` (checksum/hash, fileId/url, generatedAt, templateVersion)
- `createdAt`, `updatedAt`

Collection: `obligation_revisions`
- `obligationId` (indexed)
- `revision`
- `statusAtRevision`
- `snapshotData` (immutable payload)
- `pdfFileId`
- `createdAt`

## 8) UI Placement Recommendation
Για το UI:
- `obligations` register παραμένει κεντρικό σημείο.
- Στο edit/workspace προστίθεται ξεκάθαρο panel `Document Control` με:
  - Doc No / Revision / Status / Issue Date
  - Scope Selector (Project / Building / Unit)
  - Approvals & Signatures
  - Distribution Matrix
- Το "Export PDF" γίνεται "Issue PDF" όταν status είναι `issued`.

## 9) Implementation Plan (Next)
1. Εμπλουτισμός CoverRenderer + HeaderFooterRenderer με identity metadata.
2. Νέα renderer section για approvals/distribution.
3. Status visual semantics στο PDF (draft/review/issued/superseded/archived).
4. Upgrade `usePdfExport` για deterministic filename + share fallback.
5. Backward compatibility: αν metadata λείπουν, graceful fallbacks.

## 10) Sources
- Autodesk Build Submittals Process: https://help.autodesk.com/cloudhelp/ENG/Build-Submittals/files/work-submittals/Process_Submittal.html
- Procore Default Submittal Statuses: https://support.procore.com/faq/what-are-the-default-submittal-statuses-in-procore
- Procore Submittals Best Practices: https://support.procore.com/products/online/user-guide/project-level/submittals/best-practices-submittals
- Oracle Aconex Transmittal/Workflow: https://help.aconex.com/tasks/opening-a-document-transmittal/
- Oracle Aconex Workflow Transmittal Review: https://help.aconex.com/workflows/review-documents-from-a-workflow-transmittal/
- Oracle Aconex Documents API (revision/transmittal fields): https://help.aconex.com/es/apis/api-guide-documents/
- Primavera Unifier Bid Management Account: https://docs.oracle.com/cd/F37129_01/English/unifier_modules/74446.htm
- Autodesk BuildingConnected & TradeTapp APIs: https://aps.autodesk.com/developer/overview/buildingconnected-and-tradetapp-apis
- Autodesk BuildingConnected product positioning: https://construction.autodesk.com/resources/specialty-contractors-customer-stories/
- ETSI PAdES baseline signatures reference: https://webstore.ansi.org/standards/ds/dsetsien319142v12024
- EC eSignature FAQ: https://ec.europa.eu/digital-building-blocks/wikis/display/DIGITAL/eSignature%2BFAQ
- EC QES instructions: https://commission.europa.eu/system/files/2023-03/Instructions%20for%20QES%20signature%20of%20documents.pdf
- PDF/A overview (PDF Association): https://pdfa.org/resource/pdfa-flyer/
- Adobe Acrobat Sign PDF/A workflows: https://helpx.adobe.com/sign/config/global/pdf-a-workflows.html
