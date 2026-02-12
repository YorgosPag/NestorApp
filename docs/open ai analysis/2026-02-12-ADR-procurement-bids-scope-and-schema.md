# ADR: Procurement/Bids Scope, UI Placement, and Firestore Schema

- ADR ID: OPENAI-ADR-BIDS-001
- Date: 2026-02-12
- Status: Proposed
- Owners: Nestor Architecture

## 1. Context

Η εφαρμογή έχει ήδη enterprise ιεραρχία:
- Company (tenant) -> Project -> Building -> (Units | Storage | Parking ως παράλληλες κατηγορίες)

Σήμερα:
- Το `Obligations` module εξυπηρετεί νομικό/συμβατικό κείμενο.
- Δεν υπάρχει dedicated procurement engine για λήψη/σύγκριση/award προσφορών υπεργολάβων.

Business ανάγκη:
- Να λαμβάνονται προσφορές από διαφορετικά συνεργεία (μπετά, τοιχοποιία, πλακάκια κ.λπ.).
- Να γίνονται apples-to-apples συγκρίσεις και τεκμηριωμένη ανάθεση.
- Να υποστηρίζονται project-level αλλά και granular scope requests.

## 2. Decision

### 2.1 Domain boundary

Δημιουργείται ξεχωριστό module `Procurement/Bids`.

- `Obligations` παραμένει legal/contract document governance.
- `Procurement/Bids` αναλαμβάνει RFQ/Tender, Bid Submission, Comparison, Scoring, Award.

### 2.2 Scope model

Canonical anchor: `projectId` (υποχρεωτικό).

Προαιρετικά granular targets:
- `buildingIds[]`
- `unitIds[]`
- `storageIds[]`
- `parkingIds[]`
- `boqLineIds[]`

Άρα το σύστημα υποστηρίζει και:
- project-wide προσφορές,
- building-specific προσφορές,
- προσφορές για συγκεκριμένες μονάδες/αποθήκες/θέσεις στάθμευσης,
- προσφορές σε BOQ line επίπεδο.

### 2.3 UI placement

Primary placement:
- Νέα ενότητα sidebar: `Procurement` -> `Bids`.
- Νέο tab σε `ProjectDetails`: `Προσφορές`.

Secondary entry points (deep links στο ίδιο module):
- Από `Buildings` detail: "Νέα Πρόσκληση Προσφοράς" pre-filtered για building.
- Από `Spaces` (apartments/storage/parking): "Request Quote" pre-filtered για selected entities.

Κανόνας:
- Ένα procurement engine, πολλά context entry points.

## 3. Consequences

Θετικά:
- Καθαρό domain separation (legal vs procurement).
- Reusable engine για όλα τα επίπεδα scope.
- Καλύτερη ιχνηλασιμότητα award αποφάσεων.

Ρίσκα:
- Αυξημένη πολυπλοκότητα στο data model.
- Ανάγκη για αυστηρό validation scope (project anchor + tenant isolation).

Mitigations:
- Υποχρεωτικό `projectId` σε κάθε tender.
- Server-side authorization checks για κάθε referenced entity.
- Immutable audit trail για status transitions και award decisions.

## 4. Proposed Firestore Schema (v1)

## 4.1 Collections

### `procurement_tenders`

Purpose: RFQ/Tender packages ανά project.

Fields:
- `companyId: string` (required)
- `projectId: string` (required)
- `code: string` (human-readable tender code)
- `title: string`
- `description?: string`
- `status: 'draft' | 'published' | 'sealed' | 'closed' | 'awarded' | 'cancelled'`
- `bidMode: 'open' | 'sealed'`
- `currency: string` (default `EUR`)
- `submissionDeadline: Timestamp`
- `issueDate?: Timestamp`
- `scope: {`
- `  type: 'project' | 'building' | 'mixed' | 'boq-only',`
- `  buildingIds?: string[],`
- `  unitIds?: string[],`
- `  storageIds?: string[],`
- `  parkingIds?: string[],`
- `  boqLineIds?: string[],`
- `  notes?: string`
- `}`
- `supplierInviteIds?: string[]` (supplier/contact references)
- `attachments?: Array<{ fileId: string; category: string; name: string }>`
- `addendaCount?: number`
- `createdBy: string`
- `createdAt: Timestamp`
- `updatedBy?: string`
- `updatedAt?: Timestamp`

Indexes (minimum):
- `(companyId, projectId, status, submissionDeadline)`
- `(companyId, status, updatedAt desc)`

### `procurement_tender_addenda`

Purpose: αλλαγές/διευκρινίσεις tender.

Fields:
- `companyId: string`
- `projectId: string`
- `tenderId: string`
- `version: number`
- `title: string`
- `details: string`
- `issuedAt: Timestamp`
- `requiresAcknowledgement: boolean`
- `attachments?: Array<{ fileId: string; name: string }>`
- `createdBy: string`

Indexes:
- `(companyId, tenderId, version)`

### `procurement_bids`

Purpose: bid submissions από suppliers.

Fields:
- `companyId: string`
- `projectId: string`
- `tenderId: string`
- `supplierId: string` (contact/company)
- `supplierNameSnapshot: string`
- `status: 'submitted' | 'revised' | 'withdrawn' | 'accepted' | 'rejected'`
- `isCompliant?: boolean`
- `exclusions?: string[]`
- `assumptions?: string[]`
- `validUntil?: Timestamp`
- `leadTimeDays?: number`
- `totals: {`
- `  netAmount: number,`
- `  taxAmount?: number,`
- `  grossAmount?: number`
- `}`
- `lineItems: Array<{`
- `  boqLineId?: string,`
- `  description: string,`
- `  quantity: number,`
- `  unit: string,`
- `  unitPrice: number,`
- `  amount: number`
- `}>`
- `attachments?: Array<{ fileId: string; name: string }>`
- `submittedAt: Timestamp`
- `submittedBy?: string`
- `revision?: number`
- `createdAt: Timestamp`
- `updatedAt?: Timestamp`

Indexes:
- `(companyId, tenderId, supplierId, submittedAt desc)`
- `(companyId, projectId, status, updatedAt desc)`

### `procurement_evaluations`

Purpose: συγκριτική αξιολόγηση/scorecards.

Fields:
- `companyId: string`
- `projectId: string`
- `tenderId: string`
- `bidId: string`
- `evaluatorId: string`
- `criteria: Array<{`
- `  key: 'price' | 'schedule' | 'quality' | 'risk' | 'compliance' | string,`
- `  weight: number,`
- `  score: number,`
- `  comments?: string`
- `}>`
- `weightedTotal: number`
- `recommendation?: 'award' | 'reserve' | 'reject'`
- `notes?: string`
- `createdAt: Timestamp`
- `updatedAt?: Timestamp`

Indexes:
- `(companyId, tenderId, bidId, evaluatorId)`

### `procurement_awards`

Purpose: τελική απόφαση ανάθεσης.

Fields:
- `companyId: string`
- `projectId: string`
- `tenderId: string`
- `winningBidId: string`
- `winningSupplierId: string`
- `awardStrategy: 'lowest-compliant' | 'best-value' | 'negotiated'`
- `awardAmount: number`
- `awardDate: Timestamp`
- `decisionSummary: string`
- `approvals: Array<{ approverId: string; status: 'pending' | 'approved' | 'rejected'; at?: Timestamp; comment?: string }>`
- `contractRef?: { contractId?: string; poId?: string }`
- `createdBy: string`
- `createdAt: Timestamp`

Indexes:
- `(companyId, projectId, awardDate desc)`
- `(companyId, tenderId)`

### `procurement_supplier_prequalifications`

Purpose: qualification gates πριν από invitation.

Fields:
- `companyId: string`
- `supplierId: string`
- `status: 'pending' | 'approved' | 'rejected' | 'expired'`
- `validFrom?: Timestamp`
- `validTo?: Timestamp`
- `scores?: { safety?: number; financial?: number; compliance?: number; performance?: number }`
- `requiredDocs?: Array<{ type: string; fileId?: string; validTo?: Timestamp; verified?: boolean }>`
- `notes?: string`
- `updatedBy?: string`
- `updatedAt?: Timestamp`

Indexes:
- `(companyId, supplierId, status)`

## 4.2 Security and Rules Principles

- Όλα τα procurement collections tenant-scoped με `companyId`.
- `create/update/delete` μόνο μέσω server endpoints (Admin SDK) ή strict client rules με claim match.
- `projectId` mandatory σε tenders/bids/evaluations/awards.
- Server-side validation ότι κάθε referenced building/unit/storage/parking ανήκει στο ίδιο `projectId` και `companyId`.

## 4.3 API Endpoints (suggested)

- `GET/POST /api/procurement/tenders`
- `GET/PATCH /api/procurement/tenders/[tenderId]`
- `POST /api/procurement/tenders/[tenderId]/publish`
- `POST /api/procurement/tenders/[tenderId]/close`
- `POST /api/procurement/tenders/[tenderId]/addenda`
- `GET/POST /api/procurement/bids`
- `GET /api/procurement/tenders/[tenderId]/bids`
- `POST /api/procurement/evaluations`
- `POST /api/procurement/awards`

## 5. Rollout Plan

Phase 1:
- `procurement_tenders`, `procurement_bids`
- βασικό comparison table + manual award

Phase 2:
- evaluations/scoring + addenda + sealed mode controls

Phase 3:
- prequalification + award-to-contract/PO integration + analytics

## 6. Open Questions

- Θα υποστηριχθεί multi-currency σε v1 ή μόνο EUR;
- Award σε πολλούς suppliers (split award) από v1 ή v2;
- Θα απαιτείται υποχρεωτικό BOQ line mapping σε κάθε bid line ή optional στο v1;

## 7. Final Recommendation

Να προχωρήσει η υλοποίηση με:
- domain separation (`Obligations` != `Procurement`),
- project-anchored bid model,
- optional granular targeting σε building/unit/storage/parking/BOQ,
- centralized UI placement σε Projects με deep links από Buildings/Spaces.
