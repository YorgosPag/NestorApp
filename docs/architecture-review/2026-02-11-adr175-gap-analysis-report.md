# Αναφορά Ελέγχου ADR-175: Ευρήματα, Προβληματισμοί, Προτάσεις

**Ημερομηνία:** 2026-02-11  
**Αρχείο αναφοράς:** `docs/architecture-review/2026-02-11-adr175-gap-analysis-report.md`  
**Αντικείμενο ελέγχου:** `docs/centralized-systems/reference/adrs/ADR-175-quantity-surveying-measurements-system.md`

---

## 1. Σύνοψη

Το ADR-175 έχει πολύ καλή βάση (building-level ownership, dual scope building/unit, modularity, DXF verification state, price-list inheritance).  
Τα κύρια κενά είναι σε **project controls governance**: approvals, baselines, πιστοποιήσεις/πληρωμές υπεργολάβων, change orders και formal EVM.

---

## 2. Κύρια Ευρήματα

1. **Σωστή στρατηγική ownership**
- Οι επιμετρήσεις στο building level είναι σωστή επιλογή για σύζευξη με υπάρχον building-level Gantt.

2. **Σωστή πρόβλεψη modularity**
- Το pattern `manual | dxf-auto | dxf-verified` είναι σωστό foundation για phased adoption.

3. **Σωστή κατεύθυνση catalog/versioning**
- `catalogVersion` και 3-level τιμοκατάλογος είναι σωστή enterprise κατεύθυνση.

4. **Σωστή σύνδεση με Gantt σε επίπεδο item**
- `linkedPhaseId`/`linkedTaskId` επιτρέπει cost-time coupling.

5. **Σωστή πρόβλεψη accounting bridge**
- Η ύπαρξη `linkedInvoiceId`/`linkedContractorId` δείχνει έγκαιρο σχεδιασμό για μελλοντική ολοκλήρωση.

---

## 3. Προβληματισμοί / Φράγματα

## 3.1 Governance & Controls

1. Η αρχή «πλήρης ελευθερία χρήστη» χρειάζεται όρια σε production.
2. Δεν υπάρχει διαχωρισμός ρόλων για κρίσιμες ενέργειες (τιμές, actual quantities, overrides).
3. Δεν ορίζεται ροή έγκρισης (draft -> submitted -> approved -> certified).

**Κίνδυνος:** ανεξέλεγκτες αλλαγές σε κόστος/ποσότητες και ασυνέπεια δεδομένων.

## 3.2 Baseline / Auditability

1. Το variance φαίνεται ως UI-computed χωρίς persisted baseline snapshots.
2. Δεν υπάρχει explicit tracking για ποια έκδοση σχεδίου/αναθεώρησης παρήγαγε την ποσότητα.
3. Δεν υπάρχει πλήρες provenance πεδίων (method/formula/reference geometry).

**Κίνδυνος:** χαμηλή νομική/οικονομική τεκμηρίωση σε disputes και πιστοποιήσεις.

## 3.3 Subcontractor & Payment Lifecycle

1. Υπάρχει μόνο light bridge (`linkedInvoiceId`, `linkedContractorId`), όχι πλήρης lifecycle.
2. Δεν υπάρχουν entities για `Contract/Commitment`, `SOV`, `Payment Application`, `Certification`.
3. Δεν υπάρχει retainage model (κρατήσεις εγγύησης, release logic).

**Κίνδυνος:** αδυναμία σωστής διαχείρισης υπεργολάβων σε πραγματικό έργο.

## 3.4 Change Orders / Reforecast

1. Δεν ορίζεται formal μηχανισμός Change Order.
2. Δεν ορίζεται ποιο κόστος είναι original budget vs approved changes.
3. Δεν ορίζεται re-baseline στρατηγική μετά από approved changes.

**Κίνδυνος:** αλλοίωση budget history και αδύναμο claims management.

## 3.5 5D χωρίς πλήρες Project Controls kernel

1. Υπάρχει σύνδεση BOQ↔Gantt, αλλά όχι πλήρες EVM model.
2. Δεν ορίζονται PV/EV/AC ως persisted time-series.
3. Δεν ορίζονται SPI/CPI thresholds/alerts.

**Κίνδυνος:** το 5D μένει reporting-level και όχι decision-level.

## 3.6 DXF Auto Reliability

1. Υπάρχει verification state, αλλά λείπει confidence scoring ανά quantity.
2. Δεν ορίζεται deterministic re-run ανά drawing revision.
3. Δεν ορίζονται failure reason codes (π.χ. open polylines, missing layers, unrecognized blocks).

**Κίνδυνος:** χαμηλή εμπιστοσύνη σε auto extraction και δύσκολη αποσφαλμάτωση.

## 3.7 Data Model Fine Points

1. Δεν αποτυπώνεται ξεκάθαρα net/gross/ordered/installed/certified quantity lifecycle.
2. Δεν υπάρχει explicit unit conversion policy (π.χ. kg↔ton, m2↔box coverage).
3. Δεν ορίζεται currency/indexation policy (αναθεώρηση τιμών, escalation indices).

**Κίνδυνος:** αριθμητικές αποκλίσεις και financial reconciliation προβλήματα.

---

## 4. Πώς το κάνουν οι μεγάλοι (συμπεράσματα benchmark)

1. **Autodesk (Takeoff/Navisworks/Revit):** version/snapshot compare, model + manual quantification, structured quantity workflows.
2. **Oracle Primavera/Unifier:** commitments, payment applications, cost sheets, cash-flow και earned value σε integrated stack.
3. **Procore:** subcontractor SOV, invoices/progress payments, retainage controls ανά γραμμή.
4. **Bentley SYNCHRO / RIB iTWO:** WBS/CBS-driven cost-time integration με EV πρακτική.
5. **Μεγάλες κατασκευαστικές (Turner, Skanska):** 4D+5D μέσα σε VDC/controls λειτουργία με ισχυρά governance gates.

---

## 5. Προτάσεις (συγκεκριμένες)

## 5.1 Add Governance Workflow (άμεσο)

Προσθήκη κατάστασης εγγράφου:

1. `draft`
2. `submitted`
3. `approved`
4. `certified`
5. `locked`

Κανόνας:
- Μόνο συγκεκριμένοι ρόλοι μπορούν να αλλάζουν `actualQuantity`, `unitCost`, `wasteFactor` όταν status >= `submitted`.

## 5.2 Persisted Baselines & Provenance

Προσθήκη:

1. `baselineId`
2. `baselineVersion`
3. `drawingRevisionId`
4. `measurementMethod` (`manual`, `rule`, `ai`, `hybrid`)
5. `measurementFormula`
6. `sourceGeometryRef`

Κανόνας:
- Variance να υπολογίζεται από persisted baseline, όχι μόνο transient UI.

## 5.3 Introduce Subcontractor Financial Entities

Νέα entities:

1. `boq_contracts` (contract type: lump-sum/unit-price/remeasurable)
2. `boq_sov_lines`
3. `boq_payment_applications`
4. `boq_certifications`
5. `boq_retainage_ledger`

## 5.4 Change Order System

Προσθήκη:

1. `changeOrderId`
2. `changeType` (`scope`, `rate`, `schedule`, `mixed`)
3. `approvedAt`, `approvedBy`
4. impact fields: `deltaCost`, `deltaDuration`

Κανόνας:
- Καμία αλλαγή baseline costs χωρίς εγκεκριμένο CO.

## 5.5 Minimum EVM Kernel (MVP+)

Persisted monthly series:

1. `PV`
2. `EV`
3. `AC`

Computed KPIs:

1. `SPI = EV/PV`
2. `CPI = EV/AC`
3. `EAC = BAC/CPI` (αρχικά)

Threshold alerts:

1. `SPI < 0.95`
2. `CPI < 0.95`

## 5.6 DXF Quality Envelope

Προσθήκη:

1. `confidenceScore` (0..1)
2. `qaStatus` (`pending`, `accepted`, `rejected`)
3. `qaReasonCodes[]`
4. `reproRunId` (deterministic extraction run)

## 5.7 Quantity Lifecycle Split

Να υπάρχουν ξεχωριστά πεδία:

1. `estimatedNetQuantity`
2. `estimatedGrossQuantity`
3. `orderedQuantity`
4. `installedQuantity`
5. `certifiedQuantity`
6. `paidQuantity`

Αυτό ευθυγραμμίζει BOQ με προμήθειες, εργοτάξιο, πιστοποίηση και πληρωμές.

---

## 6. Προτεινόμενη Ιεράρχηση Ενεργειών

1. **Phase 1 (πριν το UI freeze):** governance states + baseline/provenance fields.
2. **Phase 2:** subcontractor financial entities + retainage.
3. **Phase 3:** change orders + EVM kernel.
4. **Phase 4:** DXF confidence envelope + deterministic QA.

---

## 7. Τελική Τοποθέτηση

Το ADR-175 είναι ισχυρή αρχιτεκτονική βάση, αλλά για να γίνει πραγματικά enterprise-grade χρειάζεται να περάσει από **BOQ tool** σε **project controls system**.  
Η διαφορά κρίνεται στα governance gates, baseline discipline, subcontractor payments lifecycle και EVM παρακολούθηση.

---

## 8. Πηγές (benchmark)

1. Autodesk Takeoff / compare workflows:
https://help.autodesk.com/cloudhelp/ENU/Takeoff-Files/files/Compare_Sheets.html

2. Autodesk Navisworks Quantification workbook:
https://help.autodesk.com/cloudhelp/2022/ENU/Navisworks/files/GUID-F12FB764-A75E-48FE-BC2B-DB9DA6FC4CAA.htm

3. Oracle Primavera Unifier (P6 integration / cost controls):
https://www.oracle.com/construction-engineering/primavera-unifier-project-controls-asset-management/primavera-unifier-primavera-p6-eppm-tour/

4. Oracle Payment Application business process:
https://docs.oracle.com/cd/E37673_01/English/User_Guides/UnifierHelp/WebHelp/content/unifier_user_guide/business_processes/payment_application_business_processes.htm

5. Procore SSOV / retainage:
https://support.procore.com/products/online/user-guide/project-level/commitments/tutorials/enable-or-disable-the-ssov-tab-on-a-commitment
https://en-gb.support.procore.com/products/online/user-guide/project-level/invoicing/tutorials/set-or-release-retainage-on-a-subcontractor-invoice

6. Bentley SYNCHRO:
https://www.bentley.com/software/synchro/

7. Turner VDC:
https://www.turnerconstruction.com/services/virtual-design-and-construction-bim

8. Skanska BIM analytics:
https://www.usa.skanska.com/what-we-deliver/services/innovation/bim-analytics/

9. Microsoft Earned Value fundamentals:
https://support.microsoft.com/en-us/office/earned-value-analysis-for-the-rest-of-us-6a49f56d-d7bc-44eb-8b56-2ff5526403cc
