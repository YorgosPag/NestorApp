# Αναφορά Benchmark: Διαχείριση Προσφορών Υπεργολάβων (Software + Μεγάλες Κατασκευαστικές)

Ημερομηνία: 12 Φεβρουαρίου 2026
Πεδίο: Πώς διαχειρίζονται οι μεγάλοι vendors λογισμικού και οι μεγάλες κατασκευαστικές τις προσφορές/διαγωνισμούς υπεργολάβων, και τι σημαίνει αυτό για το Nestor App.

## 1) Executive Summary

Ναι, πρέπει να μοντελοποιηθεί **ξεχωριστή οντότητα** για προσφορές υπεργολάβων (RFQ/Tender/Bid) και όχι να «στριμωχτεί» μέσα στη Συγγραφή Υποχρεώσεων.

Το κοινό enterprise μοτίβο που προκύπτει από την έρευνα είναι:
- `Prequalification` προμηθευτή/υπεργολάβου πριν από ανάθεση.
- `Tender/RFQ Event` με δομημένες γραμμές BOQ/Scope.
- `Sealed/Open bidding` με audit trail και deadlines.
- `Bid leveling` (apples-to-apples) για συγκρίσιμη αξιολόγηση.
- `Weighted scoring` (τιμή, χρόνος, ποιότητα, ρίσκο, συμμόρφωση).
- `Award + Contract/PO conversion` με end-to-end ιχνηλασιμότητα.

## 2) Τι κάνουν οι μεγάλες εταιρείες λογισμικού

## 2.1 Autodesk (BuildingConnected + TradeTapp)
- Εστιάζουν σε πλήρη προ-κατασκευαστική ροή: εύρεση συνεργείων, λήψη/σύγκριση bids, risk qualification.
- Προβάλλουν «apples-to-apples» σύγκριση και centralized bid workflows.
- Διαχωρίζουν καθαρά το qualification/risk layer (TradeTapp) από το bid workflow.
- Δίνουν API για ενσωμάτωση με ERP/BI και data orchestration.

Inference για Nestor:
- Χρειάζεται ξεχωριστό module `Bids + Supplier Qualification`, με ισχυρή σύνδεση με BOQ και τελική ανάθεση.

## 2.2 Procore (Tender/Bidding)
- Side-by-side σύγκριση προσφορών και tender leveling.
- Sealed bidding με unlock μετά τη λήξη (governance + fairness).
- Μετά το award, one-click/streamlined μετατροπή σε subcontract/PO.

Inference για Nestor:
- Να προβλεφθούν modes `open` και `sealed`.
- Να υπάρχει «award to contract/PO» χωρίς re-typing.

## 2.3 Oracle Procurement / Sourcing / SQM
- Αξιολόγηση supplier responses με weighted score (manual/automatic/team scoring).
- Requirements scoring με μέγιστη βαθμολογία, βάρη και roll-up score.
- Ισχυρό supplier qualification lifecycle (eligibility, questionnaires, initiatives, audits).

Inference για Nestor:
- Χρειάζεται `Scoring Engine` με weighted κριτήρια + team evaluation + auditability.

## 2.4 SAP Ariba / SAP Sourcing
- Guided sourcing με grading/scoring για αντικειμενική επιλογή supplier.
- Υποστήριξη MEAT (Most Economically Advantageous Tender) λογικής.
- Team grading και optimization scenarios για award allocation.

Inference για Nestor:
- Να υποστηριχθεί «χαμηλότερη τιμή» **και** «best value/MEAT» ως διαφορετικές στρατηγικές award.

## 3) Τι κάνουν οι μεγάλες κατασκευαστικές εταιρείες

## 3.1 Skanska
- Προϋπόθεση prequalification για συμμετοχή σε bid.
- Ισχυρά safety gates (π.χ. EMR, OSHA history, fatality criteria).

Inference:
- Η συμμετοχή σε tender πρέπει να είναι policy-gated (όχι όλοι οι suppliers σε όλα τα packages).

## 3.2 Bouygues Construction
- Κεντρική supplier platform (Sourceo): supplier base, online tender invitations, framework contracts, spend analytics.
- Ρόλοι προμήθειας ανά τύπο αγορών και τοπικές/κεντρικές ομάδες.

Inference:
- Το Nestor χρειάζεται `Supplier Master + Tender Engine + Framework Contracts + Spend Analytics` σε ενιαίο μοντέλο.

## 3.3 Turner Construction
- Formal subcontractor prequalification, με απαιτούμενα safety/financial/compliance στοιχεία.
- Δομημένη onboarding/qualification διαδικασία για συμμετοχή σε έργα.

Inference:
- Να απαιτούνται τεκμήρια πριν το invitation/award (ασφάλιση, οικονομικά, ethics policies κ.λπ.).

## 3.4 Ferrovial
- Vendor database για αντιστοίχιση capabilities με bid opportunities και ειδοποιήσεις για deadlines/addenda.

Inference:
- Χρειάζεται capability-based matching + proactive notifications (addenda/deadlines).

## 3.5 Bechtel / HOCHTIEF (governance & anti-fraud)
- Supplier portals με registration/approval διαδικασία.
- Ισχυρή έμφαση σε anti-fraud controls (valid PO, domain validation, fraud alerts).

Inference:
- Το Nestor πρέπει να έχει anti-fraud controls στην επικοινωνία και στο payment/award flow.

## 4) Προτεινόμενο Target Operating Model για Nestor

## 4.1 Νέες οντότητες (minimum enterprise)
- `SupplierProfile` (εταιρεία, trades, πιστοποιήσεις, insurance, οικονομικά, ESG/compliance).
- `PrequalificationRecord` (status, score, validity dates, mandatory docs).
- `TenderPackage` (έργο, trade, BOQ lines, scope docs, deadlines, sealed/open mode).
- `BidSubmission` (supplier, τιμές ανά line, exclusions, lead time, validity, attachments, revisions).
- `BidEvaluation` (weighted criteria, evaluator scores, consensus, notes, decision rationale).
- `AwardDecision` (winner, alternates, approval chain, reason code).
- `ContractLink` (conversion σε subcontract/PO, baseline value, variation terms).

## 4.2 Κρίσιμα UI/UX που εμφανίζονται σε όλα τα enterprise συστήματα
- Bid leveling grid (line-by-line, missing items, exclusions flags).
- Sealed bid workflow με controlled unlock και πλήρες audit trail.
- Weighted scorecard (price/time/quality/risk/compliance) με configurable weights ανά trade.
- Comparison modes: `lowest compliant` και `best value`.
- «From award to contract» wizard για γρήγορη μετατροπή σε σύμβαση/PO.

## 4.3 Governance & Risk controls
- Υποχρεωτικά qualification gates πριν invitation.
- Versioned addenda με acknowledgment ανά bidder.
- Role-based permissions (estimator, procurement, legal, project manager, approver).
- Fraud controls: verified supplier domains, approved PO enforcement, banking-change dual approval.

## 5) Τι σημαίνει για το ήδη υπάρχον Obligations module

Το module `Obligations` πρέπει να μείνει για νομικό/συμβατικό κείμενο και document governance.

Δεν πρέπει να φορτωθεί με όλη τη λογική tendering/bid comparison.

Η σωστή αρχιτεκτονική είναι:
- `Obligations` = νομική τεκμηρίωση και terms.
- `Procurement / Subcontractor Bids` = προσκλήσεις, προσφορές, σύγκριση, αξιολόγηση, award.
- Σύνδεση μεταξύ τους με references (π.χ. award -> contract terms template).

## 6) Προτεινόμενο rollout (πρακτικό)

1. Phase 1 (γρήγορο business value)
- Tender package + invitations + bid submissions.
- Side-by-side comparison + basic leveling.
- Manual award + export to Excel/PDF.

2. Phase 2 (enterprise governance)
- Supplier prequalification with mandatory docs.
- Weighted scoring + evaluator workflow.
- Sealed bidding + unlock controls + audit log.

3. Phase 3 (full integration)
- Award -> subcontract/PO conversion.
- BOQ-cost baselines + variance analytics.
- Advanced risk/compliance dashboards.

## 7) Συμπέρασμα

Η διεθνής πρακτική δείχνει καθαρά ότι οι προσφορές υπεργολάβων αντιμετωπίζονται ως **ξεχωριστό procurement domain** με αυστηρά workflows και όχι ως υπο-ενότητα της συγγραφής υποχρεώσεων.

Άρα η ορθή κατεύθυνση για Nestor είναι:
- Νέα ενότητα `Subcontractor Bids & Tendering`.
- Ισχυρή διασύνδεση με BOQ, χρονοδιάγραμμα, κόστος και συμβάσεις.
- Το `Obligations` παραμένει νομικός/συμβατικός πυρήνας.

---

## Πηγές (Internet Research)

Software vendors
- Autodesk BuildingConnected product page: https://construction.autodesk.com/products/buildingconnected
- Autodesk APS BuildingConnected/TradeTapp API: https://aps.autodesk.com/buildingconnected-cover-page
- Procore Tender Management: https://www.procore.com/en-au/tender-management
- Procore Bid Leveling: https://support.procore.com/products/online/user-guide/project-level/bidding/tutorials/join-the-open-beta-for-bid-leveling
- Procore sealed bids unlock flow: https://support.procore.com/products/portfolio-financials/user-guide/bid-room/tutorials/unlock-bids-in-a-sealed-bid-room-in-portfolio-financials
- Oracle Negotiation Requirement Responses Scoring: https://docs.oracle.com/en/cloud/saas/procurement/24b/oaprc/negotiation-requirement-responses-scoring.html
- Oracle Requirement Scores: https://docs.oracle.com/en/cloud/saas/procurement/25d/oaprc/requirement-scores.html
- Oracle Supplier Qualification Management overview: https://docs.oracle.com/en/cloud/saas/procurement/25c/fainp/spq-about-oracle-supplier-qualification.html
- SAP Guided Sourcing grading/scoring: https://help.sap.com/docs/strategic-sourcing/managing-events-with-guided-sourcing/grading-and-scoring-in-guided-sourcing-events-7cb7a4675a5a4afca47477f513ceea4f
- SAP Grading and Scoring guide (PDF): https://help.sap.com/doc/2b853cf8927b44c0a15c9abaa4f9339a/2505/en-US/Scoring.pdf
- SAP Supplier Evaluation Weighting and Scoring: https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/af9ef57f504840d2b81be8667206d485/b68ae77f93a846f192d3ef53cf2bf060.html

Large construction companies
- Skanska Subcontractor Management / Prequalify: https://www.usa.skanska.com/who-we-are/our-impact/responsibility/safety/subcontractor-management/
- Bouygues suppliers portal (preferred partners flow): https://fournisseurs.bouygues-construction.com/en/user
- Bouygues Sourceo platform modules: https://fournisseurs.bouygues-construction.com/en/sourceo-our-supplier-platform
- Bouygues purchasing 360° roles: https://fournisseurs.bouygues-construction.com/en/purchasing-360%C2%B0
- Turner subcontractors prequalification page: https://www.turnerconstruction.com/subcontractors
- Ferrovial vendor database: https://www.ferrovial.com/en-us/f-construction/who-we-are/vendor-database/
- Bechtel suppliers portal/resources: https://www.bechtel.com/suppliers/
- Bechtel first-time registration guide: https://www.bechtel.com/supplier/first-time-user-guide/english
- HOCHTIEF business partners / procurement fraud warning: https://www.hochtief.com/activities/for-business-partners

## 8) Καθολικό Audit στην Υπάρχουσα Εφαρμογή (Nestor)

### 8.1 Επιβεβαιωμένη ιεραρχία δεδομένων (όπως είναι σήμερα)

Από rules/types/services προκύπτει ότι το canonical μοντέλο είναι:
- `Company (tenant)` → `Project` → `Building` → παράλληλες κατηγορίες `Units | Storage | Parking`.

Τεκμήρια codebase:
- `firestore.rules`: `projects`, `buildings`, `units`, `storage_units`, `parking_spots` με tenant isolation.
- `src/services/projects/contracts.ts`: ρητά `Project → Buildings → (Units | Storage | Parking)`.
- `src/config/unified-tabs-factory.ts`: το building context έχει ξεχωριστά domains (timeline, storage, contracts, etc.).

### 8.2 Σημαντική τεχνική παρατήρηση (scope inconsistency)

Υπάρχει σήμερα μικτή πρακτική στα APIs:
- `storages` endpoint φιλτράρει κυρίως με `projectId`.
- `parking` endpoint φιλτράρει κυρίως με `buildingId`.
- Τα rules για `storage_units` και `parking_spots` είναι building-company scoped.

Συμπέρασμα:
- Το procurement module δεν πρέπει να κλειδώσει σε ένα μόνο επίπεδο (μόνο project ή μόνο building).
- Πρέπει να υποστηρίζει **multi-scope targeting** με canonical anchor στο project.

## 9) Πού πρέπει να τοποθετηθεί στο UI το σύστημα προσφορών

### 9.1 Primary placement (κύριο σημείο)

`Projects` area, ως πρώτη-class ενότητα προμήθειας:
- Νέο main route: `/procurement/bids` ή `/projects/bids`.
- Μέσα στο `ProjectDetails` νέο tab `Προσφορές / Procurement` (δίπλα σε structure/timeline/documents).

Γιατί εδώ:
- Το οικονομικό και τεχνικό scope στο construction tendering είναι project-driven.
- Υπάρχει ήδη project context, project details, project structure και timeline.

### 9.2 Secondary placement (δευτερεύοντα entry points)

- Από `Buildings` detail: CTA "Νέα Πρόσκληση Προσφοράς για αυτό το κτίριο" που ανοίγει pre-filtered procurement workspace.
- Από `Spaces` (units/storage/parking): CTA "Request Quote" που δημιουργεί package line item στο ίδιο procurement module.

Αρχή:
- Ένα procurement engine, πολλά context entry points.
- Όχι ξεχωριστό δεύτερο module ανά σελίδα.

## 10) Απόφαση scope: project ή building ή μονάδα;

### 10.1 Προτεινόμενη απόφαση

- **Anchor πάντα σε `projectId`** (υποχρεωτικό).
- **Προαιρετικά target levels**:
  - `buildingId` (κτιριακό package),
  - `unitIds[]` (μονάδες),
  - `storageIds[]` (αποθήκες),
  - `parkingIds[]` (θέσεις στάθμευσης),
  - `boqLineIds[]` (τεχνικό/ποσοτικό scope).

### 10.2 Γιατί αυτή η απόφαση είναι σωστή

- Ταιριάζει με το enterprise procurement pattern (project-driven governance).
- Δεν χάνει granular use cases (π.χ. προσφορά μόνο για parking coating ή μόνο για αποθήκες).
- Επιτρέπει roll-up συγκρίσεις σε project επίπεδο (budget, award strategy, variance).

## 11) Προτεινόμενο Data Contract για Bid Scope

Ελάχιστα πεδία:
- `companyId` (tenant anchor)
- `projectId` (required)
- `scope.type`: `project | building | mixed | boq-only`
- `scope.buildingIds[]`
- `scope.unitIds[]`
- `scope.storageIds[]`
- `scope.parkingIds[]`
- `scope.boqLineIds[]`
- `scope.notes` / exclusions

Κανόνας:
- Αν λείπει `projectId`, δεν δημιουργείται tender package.

## 12) Τελική σύσταση για υλοποίηση UI/UX

1. Δημιουργία centralized module `Procurement / Bids` στο navigation.
2. Νέο `ProjectDetails` tab: `Προσφορές` με full register, comparison, award.
3. Deep links από Building/Spaces σε pre-filtered δημιουργία package.
4. Scope picker με 4 επίπεδα:
- Project-wide
- Building-specific
- Space-specific (units/storage/parking)
- BOQ-line-specific
5. Single source of truth για bids (όχι duplications σε obligations/building/spaces).

## 13) Τι ΔΕΝ πρέπει να γίνει

- Να μπει η διαχείριση προσφορών μέσα στο `Obligations` module.
- Να υπάρχουν δύο ανεξάρτητα bid systems (ένα στο project και άλλο στο building).
- Να χρησιμοποιείται μόνο `buildingId` χωρίς `projectId` anchor.

---

## 14) Πρόσθετες εσωτερικές πηγές (Codebase Audit)

- `firestore.rules`
- `src/services/projects/contracts.ts`
- `src/config/project-tabs-config.ts`
- `src/config/unified-tabs-factory.ts`
- `src/app/api/projects/list/route.ts`
- `src/app/api/buildings/route.ts`
- `src/app/api/units/route.ts`
- `src/app/api/storages/route.ts`
- `src/app/api/parking/route.ts`
- `src/config/smart-navigation-factory.ts`
