# ΕΡΕΥΝΑ ΠΑΡΑΛΛΗΛΗ #2 — 5D Integration + Subcontractors + PDF ΑΤΟΕ

**Ημερομηνία:** 2026-02-11  
**Αρχείο:** `docs/architecture-review/2026-02-11-boq-parallel-research-2.md`

---

## ΘΕΜΑ 1: Μορφή PDF εκτύπωσης ΑΤΟΕ / Δημοπράτησης

## 1.1 Τεκμηριωμένα ευρήματα από πραγματικά PDF

Από πραγματικά τεύχη δημοπράτησης/τιμολογίου (Δήμος Αθηναίων, Πανεπιστήμιο Μακεδονίας) προκύπτει σταθερό μοτίβο δομής:

1. Επικεφαλίδα τεύχους: τίτλος έργου, φορέας, θέση, χρηματοδότηση, προϋπολογισμός, αρίθμηση σελίδας.
2. Κορμός άρθρων με πεδία:
- `A.T.` (αριθμός τιμολογίου)
- `Άρθρο` (κωδικός/τίτλος)
- `Κωδικός αναθεώρησης` (π.χ. ΟΙΚ xxxx)
- αναλυτική περιγραφή εργασίας
- `Τιμή ανά ...` (μονάδα)
- `Ευρώ (Αριθμητικά)`
- `Ευρώ (Ολογράφως)`
3. Στα προϋπολογιστικά τεύχη εμφανίζεται ξεχωριστή ανάλυση κονδυλίων:
- `Δαπάνη Εργασιών`
- `ΓΕ+ΟΕ`
- `Απρόβλεπτα`
- `Απολογιστικά`
- `Αναθεώρηση`
- `ΦΠΑ`

## 1.2 Δομή στηλών/υποσυνόλων (πρακτικά για PDF export Nestor)

Πρότυπη δομή που ταιριάζει στην ελληνική δημόσια πρακτική:

1. Στήλες άρθρου:
- `Α/Α`
- `Κωδικός Άρθρου`
- `Περιγραφή`
- `Μονάδα`
- `Ποσότητα`
- `Τιμή Μονάδας`
- `Μερική Δαπάνη`

2. Υποσύνολα ανά ομάδα εργασιών:
- `Υποσύνολο Ομάδας`
- `Σύνολο Δαπάνης Εργασιών`
- `ΓΕ+ΟΕ`
- `Απρόβλεπτα`
- `Αναθεώρηση`
- `Σύνολο χωρίς ΦΠΑ`
- `ΦΠΑ`
- `Γενικό Σύνολο`

## 1.3 Ανάλυση τιμής (Υλικά + Εργασία + ΓΕ + ΟΕ)

Στα εξετασμένα τεύχη δημοπράτησης, η τιμή άρθρου εμφανίζεται συνήθως ως τελική τιμή μονάδας με περιγραφή τι περιλαμβάνει. Η διάκριση `ΓΕ+ΟΕ` εμφανίζεται συνήθως σε επίπεδο προϋπολογισμού/συγκεντρωτικών κονδυλίων και όχι πάντα ως ξεχωριστές στήλες ανά γραμμή άρθρου.

Για Nestor PDF προτείνεται διπλή προβολή:

1. **Detailed mode (εσωτερικό):** Υλικά, Εργασία, Εξοπλισμός, ΓΕ+ΟΕ factor.
2. **Tender mode (δημόσιο συμβατό):** τελική `Τιμή Μονάδας` και συγκεντρωτικά ΓΕ+ΟΕ στο τέλος.

## 1.4 Fonts, μεγέθη, στοίχιση, λογότυπα (παρατηρήσεις)

Στα δείγματα:

1. Typography: τυπική διοικητική μορφοποίηση (συχνά Times-like/Cambria-like σε σώμα).
2. Μέγεθος: περίπου 10–12pt σώμα, 12–14pt τίτλοι.
3. Στοίχιση: αριθμητικά δεξιά, περιγραφές αριστερά, νομισματικά με 2 δεκαδικά.
4. Λογότυπα/σήμανση: εξαρτάται από φορέα, συνήθως στην πρώτη σελίδα ή header.

Σύσταση για Nestor export:

1. A4 portrait, monospace-free, καθαρό tabular grid.
2. Σταθερό footer (`σελίδα x / y`, `ημ/νία εκτύπωσης`, `έκδοση template`).
3. Δίγλωσσο header option (`EL/EN`) για ιδιωτικά έργα.

---

## ΘΕΜΑ 2: Subcontractor Management σε Construction Software

## 2.1 Procore (τεκμηριωμένα patterns)

1. Commitment-based μοντέλο (Subcontract/Purchase Order) με `Schedule of Values`.
2. Ξεχωριστό `Subcontractor SOV` που ρέει στις subcontractor invoices.
3. Payment applications/invoices με retainage controls σε επίπεδο line item.
4. Change-order integration στις τιμολογήσεις (συμπερίληψη/αφαίρεση COs).

## 2.2 Oracle Primavera Unifier

1. `Base Commit` + `Change Commit` + `Payment Application` ως linked business processes.
2. Payment Application line items auto-populate από commit/SOV.
3. Υποστήριξη retainage, stored materials, past payments.
4. Commitment funding sheet για κατανάλωση κονδυλίων από spends/payment apps.

## 2.3 Buildertrend

1. PO/Bills-centric ροή πληρωμών υπεργολάβων.
2. Υποστήριξη retainage/holdbacks (πρακτικά με split bills ή dedicated fields).
3. Subcontractor requested payments σε approved POs/bills.
4. Ψηφιακές πληρωμές subs/vendors και lien-waiver-aware flows.

## 2.4 Κοινό μοντέλο που επαναλαμβάνεται

`Υπεργολάβος -> Σύμβαση/Commitment -> SOV/BOQ line items -> Progress Payment -> Retainage -> Τελική εκκαθάριση`

## 2.5 Contract types που πρέπει να καλυφθούν στο Nestor

1. `Lump Sum` (κατ’ αποκοπή)
2. `Unit Price` (ανά μονάδα μέτρησης)
3. `Cost Plus` (όπου απαιτείται για ιδιωτικά)
4. `Re-measurable / αναθεωρητέο` με πιστοποίηση ποσοτήτων

---

## ΘΕΜΑ 3: 5D BIM Implementation Patterns

## 3.1 Πρακτική σύνδεση BOQ -> Gantt -> Cost

Κύριο pattern αγοράς:

1. Κάθε BOQ item συνδέεται με WBS/Task ID.
2. Planned quantity * unit cost = time-phased planned cost (PV curve).
3. Progress update στο task ενημερώνει earned quantity/value (EV).
4. Πληρωμές/τιμολόγια τροφοδοτούν actual cost (AC).

## 3.2 Cash-flow projection / S-curve (πρακτικός αλγόριθμος)

Για κάθε περίοδο `t`:

1. `PlannedCost_t = SUM(PlannedQty_t(item) * UnitCost(item))`
2. `PV_t = cumulative(PlannedCost_1..t)`
3. `AC_t = cumulative(ActualCost_1..t)`
4. `EV_t = SUM(BAC_item * PhysicalProgress_item_t)` ή ισοδύναμα από πιστοποιημένες ποσότητες

## 3.3 EVM metrics (βασικός πυρήνας)

1. `CV = EV - AC`
2. `SV = EV - PV`
3. `CPI = EV / AC`
4. `SPI = EV / PV`
5. `EAC` (simplified) = `BAC / CPI`
6. `ETC = EAC - AC`

## 3.4 Τι υλοποιούν τα μεγάλα εργαλεία

1. Oracle Primavera / Unifier: πλήρες EVM stack (PV/EV/AC, CPI/SPI, ETC/EAC, dashboards).
2. Microsoft Project: πλήρης earned value ερμηνεία/metrics στο εργαλείο.
3. RIB iTWO: 5D BIM με ενσωμάτωση χρόνου + κόστους στο μοντέλο.

## 3.5 Simplified EVM για μικρομεσαίες

MVP που είναι ρεαλιστικό για Nestor:

1. Υποχρεωτικά μόνο: `PV, EV, AC, CPI, SPI`.
2. Περίοδος reporting: μηνιαία.
3. EV source: πιστοποιημένες ποσότητες (όχι μόνο subjective %).
4. Traffic-light thresholds:
- `CPI < 0.95` κόκκινο
- `SPI < 0.95` κόκκινο
- `0.95–1.05` πράσινο/ουδέτερο

---

## ΘΕΜΑ 4: Ελληνική Πιστοποίηση Εργασιών

## 4.1 Τι είναι πρακτικά

Η «πιστοποίηση εργασιών» είναι η επίσημη επιβεβαίωση ποσοτήτων/εκτελεσμένης αξίας για περίοδο, πάνω στην οποία εκδίδεται ο αντίστοιχος λογαριασμός αναδόχου για πληρωμή.

## 4.2 Λογαριασμοί εργολάβου

Πρακτικό flow:

1. Περιοδική επιμέτρηση
2. Σύνταξη πιστοποίησης
3. Έκδοση λογαριασμού (`1ος, 2ος, ...`) 
4. Έλεγχοι/κρατήσεις
5. Πληρωμή
6. Τελικός λογαριασμός / εκκαθάριση

## 4.3 Σύνδεση με BOQ

Για κάθε γραμμή BOQ:

1. `EstimatedQty`
2. `CertifiedQty_to_date`
3. `RemainingQty`
4. `CertifiedAmount`
5. `Variance vs estimate`

Αυτό είναι το σωστό data bridge μεταξύ τεχνικού αντικειμένου και οικονομικής ροής.

## 4.4 Νομικό πλαίσιο (δημόσια έργα)

Με βάση τη δομή του Ν.4412/2016 (Τίτλος Δημοσίων Συμβάσεων Έργων):

1. `Άρθρο 151`: Επιμετρήσεις
2. `Άρθρο 152`: Λογαριασμοί
3. `Άρθρο 153`: Αναθεώρηση τιμών
4. `Άρθρο 154`: Απολογιστικές εργασίες
5. `Άρθρο 165`: Υπεργολαβία κατά την εκτέλεση

Επιπλέον στην πράξη πληρωμών συνδέεται και η διαδικασία ασφαλιστικής ενημερότητας/βεβαίωσης για είσπραξη λογαριασμού δημοσίου έργου (e-ΕΦΚΑ εγκύκλιοι).

## 4.5 Δημόσια vs ιδιωτικά έργα

1. Δημόσια έργα: δεσμευτικό πλαίσιο Ν.4412/2016 + διοικητικές πράξεις + ειδικές κρατήσεις/έλεγχοι.
2. Ιδιωτικά έργα: ελευθερία σύμβασης (ιδιωτικό δίκαιο), αλλά στην πράξη συχνά υιοθετούνται παρόμοια templates λογαριασμών/πιστοποιήσεων.

---

## Συμπέρασμα για Nestor

1. Το PDF export πρέπει να υποστηρίζει δύο προφίλ: `Tender/Public` και `Operational/Internal`.
2. Το subcontractor module πρέπει να βασιστεί σε: `Contract -> BOQ/SOV -> Progress Certification -> Invoice -> Retainage -> Final Account`.
3. Η 5D υλοποίηση να ξεκινήσει με `PV/EV/AC + CPI/SPI` και να επεκταθεί σε πλήρες EVM.
4. Η ελληνική πιστοποίηση να μοντελοποιηθεί ως first-class entity (όχι απλό attachment).

---

## Πηγές

### PDF τιμολόγια / δημόσια τεύχη

1. Δήμος Αθηναίων, Τιμολόγιο Δημοπράτησης (123 σελ.):
https://www.cityofathens.gr/wp-content/uploads/2024/06/timologio-dimopratisis-ergo-syntiriseis-scholikon-ktirion-dimoy-athinaion-7i-dimotiki-koinotita.pdf

2. Πανεπιστήμιο Μακεδονίας, Τιμολόγιο Μελέτης (NET OIK):
https://www.uom.gr/assets/site/public/nodes/6742/4371-TIMOLOGIO-MELETHSsigned.pdf

3. DDM/GGDE, Περιγραφικό Τιμολόγιο ΟΙΚ:
https://ddm.gov.gr/wp-content/uploads/2017/09/%CE%A0%CE%95%CE%A1%CE%99%CE%93%CE%A1%CE%91%CE%A6%CE%99%CE%9A%CE%9F-%CE%A4%CE%99%CE%9C%CE%9F%CE%9B%CE%9F%CE%93%CE%99%CE%9F-1.pdf

4. SATE index τιμολογίων ΑΤΟΕ:
https://sate.gr/html/timologia.aspx

5. Παράδειγμα ανάλυσης προϋπολογισμού με ΓΕ+ΟΕ/Απρόβλεπτα/Αναθεώρηση:
https://korinthos.gr/%CE%B1%CF%80%CF%8C%CF%86%CE%B1%CF%83%CE%B7-%CE%B4%CE%B7%CE%BC%CE%BF%CF%84%CE%B9%CE%BA%CE%AE%CF%82-%CE%B5%CF%80%CE%B9%CF%84%CF%81%CE%BF%CF%80%CE%AE%CF%82-%CE%BC%CE%B5-%CE%B1%CF%81%CE%B9%CE%B8%CE%BC-269/

### Subcontractor / Payments / Retainage

6. Procore - Subcontractor SOV / Commitments flow:
https://support.procore.com/products/online/user-guide/project-level/commitments/tutorials/enable-or-disable-the-ssov-tab-on-a-commitment

7. Procore - Retainage on subcontractor payment applications:
https://en-gb.support.procore.com/products/online/user-guide/project-level/invoicing/tutorials/set-or-release-retainage-on-a-subcontractor-invoice

8. Procore - Commitment Invoice Retainage Controls (release):
https://www.procore.com/whats-new/commitment-invoice-retainage-controls

9. Oracle Primavera Unifier - Payment Application BPs:
https://docs.oracle.com/cd/E37673_01/English/User_Guides/UnifierHelp/WebHelp/content/unifier_user_guide/business_processes/payment_application_business_processes.htm

10. Oracle Primavera Unifier - Base Commit/Change Commit integration:
https://docs.oracle.com/cd/F50962_01/English/User_Guides/udesigner/77280.htm

11. Buildertrend - retainage/holdbacks (trade partners):
https://buildertrend.com/help-article/retainage-holdbacks-for-trade-partners-using-bills-purchase-orders/

12. Buildertrend - subcontractor payments:
https://buildertrend.com/help-article/buildertrend-payments-paying-subcontractors/

### 5D / EVM / Cashflow

13. Oracle Unifier EVM guide (PV/EV/AC/SPI/CPI definitions):
https://docs.oracle.com/cd/F50962_01/English/User_Guides/evm/unifier_evm_user.pdf

14. Oracle EVM node overview:
https://docs.oracle.com/cd/F74686_01/English/User_Guides/evm/10292511.htm

15. Oracle EVM preview metrics:
https://docs.oracle.com/cd/F74686_01/English/User_Guides/evm/10293313.htm

16. Oracle Cash Flow curves / curve profile:
https://primavera.oraclecloud.com/help/en/user/207927.htm

17. Microsoft Support - Earned value fundamentals (PV/AC/EV):
https://support.microsoft.com/en-us/office/earned-value-analysis-for-the-rest-of-us-6a49f56d-d7bc-44eb-8b56-2ff5526403cc

18. RIB iTWO case (integration of model + cost + time):
https://www.rib-software.com/en/case-studies/codema-international-gmbh

### Ελληνικό πλαίσιο πιστοποίησης / λογαριασμών

19. Ν.4412/2016 (κωδικοποίηση, άρθρα 151-154, 165):
https://www.taxheaven.gr/law/4412/2016

20. ΕΑΔΗΣΥ - Ν.4412 portal:
https://www.eaadhsy.eu/n4412/index.html

21. e-ΕΦΚΑ εγκύκλιος για είσπραξη λογαριασμών δημοσίων έργων (ΑΔΑ Ω5ΤΥ46ΜΑΠΣ-ΗΓΓ):
https://www.efka.gov.gr/sites/default/files/2022-06/%CE%93.%CE%95.%20%CE%92%CE%95%CE%92%CE%91%CE%99%CE%A9%CE%A3%CE%95%CE%99%CE%A3%20%CE%94%CE%97%CE%9C%CE%9F%CE%A3%CE%99%CE%A9%CE%9D%20%CE%95%CE%A1%CE%93%CE%A9%CE%9D%20%28%CE%A95%CE%A4%CE%A546%CE%9C%CE%91%CE%A0%CE%A3-%CE%97%CE%93%CE%93%29.pdf

---

## Σημείωση ποιότητας πηγών

1. Όπου χρησιμοποιήθηκαν vendor docs/help centers, δόθηκε προτεραιότητα σε επίσημα documentation URLs.
2. Για ΑΤΟΕ article-level πλήρη δομή παραμένει θέμα διαθέσιμων machine-readable αρχείων (πολλά δημόσια αρχεία είναι scanned PDFs).
3. Τα συμπεράσματα για fonts/layout είναι παρατηρησιακά από διαθέσιμα PDF δείγματα δημοπράτησης.
