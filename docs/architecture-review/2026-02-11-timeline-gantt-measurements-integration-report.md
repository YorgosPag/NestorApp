# Αναφορά: Σύνδεση Επιμετρήσεων με Χρονοδιάγραμμα (Milestones + Gantt)

**Ημερομηνία:** 2026-02-11  
**Αρχείο:** `docs/architecture-review/2026-02-11-timeline-gantt-measurements-integration-report.md`

---

## 1. Τι εξέτασα στην εφαρμογή

Έγινε τεχνική μελέτη στα building tabs και ειδικά στο tab `Χρονοδιάγραμμα`:

1. `src/components/building-management/tabs/TimelineTabContent.tsx`
2. `src/components/building-management/tabs/TimelineTabContent/utils.ts`
3. `src/components/building-management/tabs/TimelineTabContent/gantt/GanttView.tsx`
4. `src/components/building-management/hooks/useConstructionGantt.ts`
5. `src/types/building/construction.ts`
6. `src/app/api/buildings/[buildingId]/construction-phases/route.ts`

---

## 2. Ευρήματα (σημερινή κατάσταση)

## 2.1 Milestones view: static δεδομένα

Τα milestones σήμερα είναι hardcoded (χρονολογίες 2006–2009), όχι from DB:

1. `src/components/building-management/tabs/TimelineTabContent/utils.ts:24`
2. `src/components/building-management/tabs/TimelineTabContent/utils.ts:25`
3. `src/components/building-management/tabs/TimelineTabContent/utils.ts:31`

Το `TimelineTabContent` καταναλώνει αυτά τα static milestones:

1. `src/components/building-management/tabs/TimelineTabContent.tsx:65`
2. `src/components/building-management/tabs/TimelineTabContent.tsx:66`

## 2.2 Forecast/Critical Path: placeholder logic

1. `CompletionForecastCard` χρησιμοποιεί σταθερό `delayDays = 5`:
`src/components/building-management/tabs/TimelineTabContent/CompletionForecastCard.tsx:22`

2. `CriticalPathCard` είναι fixed UI content και όχι αποτέλεσμα CPM/graph analysis:
`src/components/building-management/tabs/TimelineTabContent/CriticalPathCard.tsx:28`

## 2.3 Gantt view: πραγματικά data-driven

Το Gantt φορτώνει πραγματικές φάσεις/εργασίες από API:

1. `src/components/building-management/hooks/useConstructionGantt.ts:181`
2. `src/components/building-management/hooks/useConstructionGantt.ts:182`
3. `src/components/building-management/hooks/useConstructionGantt.ts:183`

Το API διαβάζει από `construction_phases` και `construction_tasks`:

1. `src/app/api/buildings/[buildingId]/construction-phases/route.ts:75`
2. `src/app/api/buildings/[buildingId]/construction-phases/route.ts:106`

## 2.4 Απουσία πεδίων BOQ linkage στο Gantt schema

Τα entities φάσης/εργασίας δεν έχουν πεδία όπως `plannedCost`, `linkedBoqItemIds`, `earnedValue`:

1. `src/types/building/construction.ts:28`
2. `src/types/building/construction.ts:49`

Επίσης στο API allowlist δεν υπάρχουν measurement/cost links:

1. `src/app/api/buildings/[buildingId]/construction-phases/route.ts:317`
2. `src/app/api/buildings/[buildingId]/construction-phases/route.ts:319`

---

## 3. Κρίσιμα σημεία που πρέπει να προβλεφθούν πριν κώδικα επιμετρήσεων

1. **Milestones να γίνουν data-driven**
- Είτε νέα collection `construction_milestones`, είτε deterministic derive από phases/tasks.

2. **BOQ ↔ Gantt να είναι many-to-many**
- Όχι μόνο ένα `linkedPhaseId` στο BOQ item.
- Χρειάζεται link table για granular mapping item-to-task.

3. **Progress κανόνας από ποσότητες**
- Η πρόοδος task να μπορεί να προκύπτει από `certifiedQuantity / estimatedQuantity` των linked BOQ lines.

4. **Planned vs Actual κόστος στο timeline**
- Αν δεν υπάρχουν `plannedCost`, `actualCost`, `earnedValue` ανά task/phase, η σύνδεση θα είναι μόνο οπτική.

5. **Milestone types για οικονομικό έλεγχο**
- `measurement-freeze`, `certification-cutoff`, `invoice-approved`, `retainage-release`.

6. **Governance locks**
- Μετά από certification, quantities/costs να μην αλλάζουν χωρίς change-order flow.

7. **Real critical path**
- Να υπολογίζεται από dependencies και ημερομηνίες, όχι static card content.

---

## 4. Προτάσεις υλοποίησης (συγκεκριμένες)

## 4.1 Επέκταση τύπων Gantt

Σε `ConstructionTask` και `ConstructionPhase` να προστεθούν:

1. `plannedCost?: number`
2. `actualCost?: number`
3. `earnedValue?: number`
4. `linkedBoqCount?: number`
5. `boqCoveragePct?: number`

## 4.2 Νέα relation για σύνδεση BOQ items

Προτείνεται collection:

1. `boq_task_links`

Πεδία:

1. `buildingId`
2. `phaseId`
3. `taskId`
4. `boqItemId`
5. `weightPct` (προαιρετικό για επιμερισμό)
6. `createdAt`, `createdBy`

## 4.3 Milestones ως first-class entity

Collection:

1. `construction_milestones`

Πεδία:

1. `buildingId`
2. `name`, `type`, `targetDate`, `actualDate`
3. `status`
4. `linkedPhaseId?`, `linkedTaskId?`
5. `linkedCertificationId?`, `linkedInvoiceId?`

## 4.4 EVM-lite στο Building επίπεδο

Ελάχιστα metrics:

1. `PV`
2. `EV`
3. `AC`
4. `SPI = EV/PV`
5. `CPI = EV/AC`

Αυτά να μπαίνουν στο Gantt summary panel, όχι μόνο progress %.

## 4.5 Update Milestones cards

1. `CriticalPathCard`: να τραβάει πραγματικά delayed critical tasks.
2. `CompletionForecastCard`: να υπολογίζει forecast από schedule slippage και SPI, όχι fixed +5 ημέρες.

---

## 5. Τι κάνουν οι μεγάλες κατασκευάστριες εταιρείες λογισμικού

## 5.1 Autodesk

1. Συγκρίνει sheet versions/snapshots και quantity diffs (Takeoff compare).
2. Συνδέει model-based και manual takeoff workflows.
3. Στόχος: μετατροπή από static quantities σε revision-aware quantities.

## 5.2 Oracle Primavera / Unifier

1. Payment Application ως επίσημη διαδικασία με SOV line items.
2. Track retainage, stored materials, past payments.
3. EVM με PV/EV/AC, CPI/SPI, EAC/ETC σε WBS/CBS επίπεδο.

## 5.3 Procore

1. Subcontractor SOV και invoicing line items.
2. Retainage set/release ανά γραμμή.
3. Progress claims που συνδέονται με commitment/invoice workflows.

## 5.4 Bentley SYNCHRO

1. 4D planning + model-based QTO/WBS.
2. Earned value KPIs και field-to-office progress/cost feedback loops.
3. Cost + performance management συνδεδεμένα με 4D μοντέλο.

---

## 6. Τι κάνουν οι μεγάλες κατασκευαστικές εταιρείες έργων

## 6.1 Turner Construction

1. VDC ως core λειτουργία, όχι βοηθητικό εργαλείο.
2. 4D scheduling με BIM για sequencing/phasing.
3. Production tracking με data από εργοτάξιο.

## 6.2 Skanska

1. BIM analytics που ενώνουν κόστος + πρόγραμμα + μοντέλο.
2. 4D rehearsals για βελτίωση sequence/logistics.
3. 5D χρήση για κόστη και αποδοτικότητα σε planning/estimating.

## 6.3 VINCI / Bouygues (στρατηγική κατεύθυνση)

1. Μοντελοκεντρική συνεργασία (single digital environment).
2. 4D visualization για stakeholders.
3. Standardized digital processes σε όλο lifecycle (design-to-operation).

---

## 7. Τελικό συμπέρασμα

Πριν γράψουμε κώδικα για επιμετρήσεις, είναι κρίσιμο να κλειδώσουμε 4 πράγματα:

1. Data-driven milestones (όχι static list)
2. Many-to-many BOQ↔Task links
3. Cost/progress metrics ανά phase/task (τουλάχιστον EVM-lite)
4. Governance σε certification/invoicing milestones

Αν αυτά μπουν από την αρχή, η σύνδεση επιμετρήσεων με Gantt και ορόσημα θα είναι πραγματικά επιχειρησιακή και όχι μόνο οπτική.

---

## 8. Πηγές

### Software vendors

1. Autodesk Takeoff compare sheets:
https://help.autodesk.com/cloudhelp/ENU/Takeoff-Files/files/Compare_Sheets.html

2. Oracle Unifier Payment Application BPs:
https://docs.oracle.com/cd/E37673_01/English/User_Guides/UnifierHelp/WebHelp/content/unifier_user_guide/business_processes/payment_application_business_processes.htm

3. Oracle Unifier Earned Value Analysis (PV/EV/AC/SPI/CPI):
https://docs.oracle.com/cd/F25628_01/English/User_Guides/evm/10292511.htm

4. Procore retainage on subcontractor invoice:
https://support.procore.com/faq/how-do-i-set-and-release-retainage-on-a-subcontractor-invoice-in-procore

5. Procore invoicing tutorial (line-item retainage controls):
https://support.procore.com/products/online/user-guide/project-level/invoicing/tutorials/set-or-release-retainage-on-a-subcontractor-invoice

6. Bentley SYNCHRO product capabilities:
https://www.bentley.com/software/synchro/

7. Bentley announcement on SYNCHRO cost/performance expansion:
https://investors.bentley.com/news-releases/news-release-details/bentley-systems-enhances-synchro-construction-management

### Construction companies

8. Turner VDC (4D scheduling, production tracking):
https://www.turnerconstruction.com/services/virtual-design-and-construction-bim

9. Skanska BIM Analytics (cost + schedule + model integration):
https://www.usa.skanska.com/what-we-deliver/services/innovation/bim-analytics/

10. Skanska advanced visualization with BIM (4D sequencing):
https://www.usa.skanska.com/what-we-deliver/services/innovation/advanced-visualization-with-bim/

11. VINCI Construction Grands Projets BIM uses (3D/4D communication and delivery):
https://www.vinci-construction-projets.com/fr/nos-savoir-faire/nos-expertises/bim/

12. Bouygues digital modelling/BIM strategy:
https://www.bouygues-construction.com/en/press/release/bouygues-construction-shares-its-vision-digital-modelling-customers-and-partners

13. Bouygues + Dassault + Accenture digital platform initiative:
https://www.3ds.com/newsroom/press-releases/bouygues-construction-teams-dassault-systemes-and-accenture-accelerate-digital-transformation-its-construction-project-activities
