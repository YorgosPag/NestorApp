# ΑΝΑΦΟΡΑ ΕΡΓΑΣΙΩΝ 2

## Scope
Ανάλυση για `Διαχείριση Επαφών -> Νομικά Πρόσωπα -> tabs «Δραστηριότητες & ΚΑΔ» και «Τραπεζικά»`.
Στόχος:
- να διαπιστωθεί αν σήμερα υπάρχουν dependencies,
- αν ο χρήστης ενημερώνεται όταν προσθέτει/αλλάζει/διαγράφει στοιχεία,
- τι notifications / confirmations / impact messages πρέπει να υπάρχουν,
- και τι pattern ακολουθούν μεγάλοι vendors.

---

## Executive Summary

### 1. Δραστηριότητες & ΚΑΔ
Ναι, υπάρχουν πραγματικές εξαρτήσεις και μάλιστα πιο σοβαρές απ’ όσο φαίνεται στο UI.
Το tab σήμερα λειτουργεί κυρίως ως form-state editor και όχι ως fully governed subsystem. Ο χρήστης μπορεί να αλλάξει primary/secondary KADs και chamber, αλλά δεν βλέπει ειδικά messages για add/update/remove/set-primary. Οι αλλαγές τελικά ενσωματώνονται στο γενικό save της επαφής.

Το σημαντικό είναι ότι ο primary KAD δεν είναι απλό display field. Συνδέεται ήδη με accounting/profile/PDF flows και μελλοντικά μπορεί να επηρεάζει classification και myDATA/invoicing semantics. Άρα χρειάζεται impact-aware UX, ειδικά όταν αλλάζει ή αφαιρείται ο primary KAD.

### 2. Τραπεζικά
Ναι, υπάρχουν dependencies και εδώ το σύστημα είναι πιο ώριμο.
Το banking tab έχει ξεχωριστό subsystem, CRUD υπηρεσίες, IBAN validation, duplicate prevention, soft-delete, set-primary και dedicated success/error toasts. Υπάρχει ήδη confirmation dialog για delete.

Παρόλα αυτά λείπει το πιο σημαντικό layer: dependency-aware ενημέρωση. Δηλαδή σήμερα ο χρήστης ενημερώνεται ότι «ο λογαριασμός διαγράφηκε/ορίστηκε κύριος», αλλά όχι για το operational impact: τι θα αλλάξει σε μελλοντικά invoices, payment instructions, accounting exports ή PDF fallback flows.

### 3. Συμπέρασμα προϊόντος
- Το `Τραπεζικά` είναι ήδη λειτουργικά ώριμο, αλλά όχι impact-aware.
- Το `Δραστηριότητες & ΚΑΔ` δεν είναι ακόμα productized στο ίδιο επίπεδο: έχει data model και rendering, αλλά όχι row-level governance/messages.
- Και τα δύο tabs πρέπει να αντιμετωπίζονται ως `master data with downstream effects`, όχι ως απλά form sections.

---

## Τι υπάρχει σήμερα στον κώδικα

## A. Δραστηριότητες & ΚΑΔ

### UI / Rendering
Το section αποδίδεται από custom renderer:
- `src/config/company-gemi/sections/activities.ts`
- `src/components/ContactFormSections/contactRenderersCore.tsx:223`
- `src/components/contacts/dynamic/ContactKadSection.tsx:59`

Το `ContactKadSection` επιτρέπει:
- 1 primary activity,
- N secondary activities,
- chamber field,
- add secondary,
- remove secondary,
- edit primary/secondary μέσω `KadCodePicker`.

Σημαντικό: όλες αυτές οι ενέργειες είναι local form mutations. Δεν υπάρχουν standalone toasts, confirm dialogs ή impact warnings μέσα στο component.

### Mapping / persistence
Οι δραστηριότητες γράφονται και διαβάζονται με compatibility layers:
- `src/utils/contactForm/mappers/company.ts:124-125`
- `src/utils/contacts/EnterpriseContactSaver.ts:162-164`
- `src/utils/contactForm/fieldMappers/companyMapper.ts:31-57`
- `src/components/ContactFormSections/contactRenderersCore.tsx:231-235`

Σήμερα συνυπάρχουν:
- `customFields.activities[]`
- πιθανό legacy root `activities`
- legacy singular fields `activityCodeKAD`, `activityDescription`, `activityType`

Αυτό σημαίνει ότι τα KADs έχουν ήδη βαρύτητα master-data και κουβαλάνε backward-compatibility footprint.

### Validation / governance
Το UI KAD picker είναι permissive:
- `src/components/shared/KadCodePicker.tsx`

Επιτρέπει:
- επιλογή από την official λίστα,
- αλλά και free-text fallback σε κάποιες περιπτώσεις.

Στο κανονικό UI flow δεν βρήκα:
- duplicate KAD prevention,
- confirmation πριν αφαιρεθεί secondary,
- confirmation πριν αλλάξει primary,
- ειδικό success/error toast για KAD add/update/remove.

### Σημερινά visible labels
Υπάρχουν μόνο labels του form, όχι operation messages:
- `src/i18n/locales/el/forms.json:293-301`

Π.χ. υπάρχουν:
- `Κύρια Δραστηριότητα`
- `Δευτερεύουσες Δραστηριότητες`
- `Προσθήκη ΚΑΔ`
- `Αφαίρεση ΚΑΔ`
- `Επιμελητήριο / Τ.Υ. ΓΕΜΗ`

Δεν βρέθηκαν ειδικά:
- `created/updated/deleted` toasts για KAD,
- `confirm delete primary KAD`,
- `impact preview` strings.

---

## B. Τραπεζικά

### UI / CRUD behavior
Το tab είναι σαφώς πιο ώριμο:
- `src/components/contacts/tabs/ContactBankingTab.tsx`
- `src/components/banking/BankAccountForm.tsx`
- `src/components/banking/BankAccountCard.tsx`
- `src/services/banking/BankAccountsService.ts`
- `src/services/banking/bank-accounts-server.service.ts`

Υποστηρίζει:
- list accounts,
- add account,
- edit account,
- delete account,
- set primary account,
- realtime subscription,
- IBAN validation,
- duplicate IBAN prevention,
- soft-delete με `isActive: false`.

### Σημερινά messages που ήδη υπάρχουν
Υπάρχει dedicated delete dialog και toasts:
- `src/components/contacts/tabs/ContactBankingTab.tsx:164-170`
- `src/components/contacts/tabs/ContactBankingTab.tsx:181-187`
- `src/components/contacts/tabs/ContactBankingTab.tsx:203-210`
- `src/components/contacts/tabs/ContactBankingTab.tsx:371-399`
- `src/i18n/locales/el/contacts.json:1318-1335`

Σήμερα ο χρήστης βλέπει ήδη:
- delete confirm,
- success toast για create,
- success toast για update,
- success toast για delete,
- success toast για set primary,
- error toast για load/delete/set primary.

### Validation / security
Στο server flow υπάρχουν:
- tenant isolation,
- IBAN validation,
- currency validation,
- duplicate IBAN check,
- single-primary enforcement,
- soft delete.

Τεκμήρια:
- `src/services/banking/bank-accounts-server.service.ts:74-90`
- `src/services/banking/bank-accounts-server.service.ts:101-147`
- `src/services/banking/bank-accounts-server.service.ts:158-181`
- `src/services/banking/bank-accounts-server.service.ts:190-218`
- `src/services/banking/bank-accounts-server.service.ts:240-300`
- `src/services/banking/bank-accounts-server.service.ts:317-440`

### Τι λείπει σήμερα
Δεν βρήκα στο normal product flow:
- warning όταν αλλάζει ο primary account,
- warning όταν διαγράφεται primary account,
- warning όταν διαγράφεται ο τελευταίος active account,
- impact preview για future invoices / payment instructions / PDF output,
- field-level audit trail στο UI path.

---

## Downstream Dependencies που υπάρχουν ήδη σήμερα

## A. ΚΑΔ / Δραστηριότητες

### Βέβαιες εξαρτήσεις
1. Contact/company persistence model
- `src/utils/contactForm/mappers/company.ts:124-125`
- `src/utils/contacts/EnterpriseContactSaver.ts:162-164`
- `src/utils/contactForm/fieldMappers/companyMapper.ts:31-57`

2. Primary activity mirroring σε legacy fields
- `src/components/ContactFormSections/contactRenderersCore.tsx:233-235`

3. Accounting / PDF usage
- `src/subapps/accounting/services/pdf/invoice-pdf-exporter.ts:76-79`
- `src/subapps/accounting/components/invoices/details/InvoiceActionsMenu.tsx:34-43`
- `src/subapps/accounting/services/pdf/invoice-pdf-template.ts` με `kadCode` rendering

4. Accounting architecture / ADR docs
- `src/subapps/accounting/docs/adrs/ADR-ACC-002-invoicing-system.md`
- `src/subapps/accounting/docs/adrs/ADR-ACC-003-mydata-aade-integration.md`
- `src/subapps/accounting/docs/adrs/ADR-ACC-018-invoice-pdf-generation.md`
- `src/subapps/accounting/config/account-categories.ts`

### Τι σημαίνει πρακτικά
- Ο primary KAD δεν είναι cosmetic.
- Μπορεί να εμφανίζεται ή να τροφοδοτεί accounting/myDATA/PDF behaviors.
- Η αλλαγή primary KAD πρέπει να θεωρείται `important business-data edit`.

### Σημαντική παρατήρηση
Το live contact model κρατά array `activities`, αλλά ο accounting PDF exporter σήμερα τραβά `mainKad` από company profile, όχι κατευθείαν από contact form state. Αυτό σημαίνει ότι υπάρχει architectural split και πιθανό consistency risk μεταξύ contact profile και accounting profile. Άρα η ανάγκη για ξεκάθαρα impact messages είναι ακόμα μεγαλύτερη.

## B. Τραπεζικά

### Βέβαιες εξαρτήσεις
1. Subcollection / reportability
- `contacts/{contactId}/bankAccounts/{accountId}`
- τεκμηριώνεται σε service και ADR/spec docs

2. Invoice PDF / issuer snapshot / fallback logic
- `src/subapps/accounting/services/pdf/invoice-pdf-exporter.ts:58-70`
- `src/subapps/accounting/components/invoices/details/InvoiceActionsMenu.tsx:40-43`
- `src/subapps/accounting/components/invoices/forms/InvoiceForm.tsx` με issuer snapshot placeholder για bank accounts
- `src/subapps/accounting/docs/adrs/ADR-ACC-018-invoice-pdf-generation.md`

3. AI tooling / admin operations
- `src/services/ai-pipeline/tools/handlers/banking-handler.ts`

4. Dynamic reporting / entity mapping docs
- `docs/centralized-systems/reference/adrs/ADR-268-dynamic-report-builder/SPEC-009-entity-mapping-companies.md`
- `docs/centralized-systems/reference/adrs/ADR-268-dynamic-report-builder/SPEC-022-entity-mapping-accounting.md`

### Τι σημαίνει πρακτικά
- Οι bank accounts επηρεάζουν τουλάχιστον future payment-facing outputs.
- Για νέα invoices, το σωστό pattern είναι snapshot.
- Για παλιότερα ή fallback flows, το live profile μπορεί ακόμα να χρησιμοποιείται.

### Πολύ κρίσιμο συμπέρασμα
Η σωστή product messaging πρέπει να ξεχωρίζει 2 πράγματα:
- `μελλοντικά παραστατικά / εξαγωγές / ροές πληρωμών θα χρησιμοποιούν τα νέα στοιχεία`
- `ήδη εκδομένα παραστατικά με snapshot δεν αλλάζουν`

---

## Audit / Tracking: τι υπάρχει και τι δεν υπάρχει

### Banking
Υπάρχει audit write στο AI path:
- `src/services/ai-pipeline/tools/handlers/banking-handler.ts:120-122`
- `src/services/ai-pipeline/tools/handlers/banking-handler.ts:196`
- `src/services/ai-pipeline/tools/handlers/banking-handler.ts:242`

### Activities
Υπάρχει audit write στο AI path:
- `src/services/ai-pipeline/tools/handlers/activity-handler.ts:145-147`
- `src/services/ai-pipeline/tools/handlers/activity-handler.ts:209-211`
- `src/services/ai-pipeline/tools/handlers/activity-handler.ts:255-257`

### Αλλά στο normal UI flow
Δεν βρήκα ισοδύναμο field-level audit trail για:
- add/remove secondary KAD,
- set primary KAD,
- update/delete/set-primary bank account.

Συμπέρασμα:
Το repo ήδη αναγνωρίζει θεωρητικά την ανάγκη audit, αλλά σήμερα την υλοποιεί άνισα: υπάρχει στον AI path, όχι καθαρά στον user-facing main UI path.

---

## Ενημερώνεται σήμερα ο χρήστης;

## A. Δραστηριότητες & ΚΑΔ
Σήμερα: `Όχι επαρκώς`.

Τι υπάρχει:
- labels/controls στο form,
- generic contact save feedback στο τέλος του submit.

Τι δεν υπάρχει:
- add KAD success toast,
- remove KAD confirm,
- primary KAD change warning,
- chamber change info,
- dependency preview.

Άρα ο χρήστης ουσιαστικά δεν ενημερώνεται σωστά για το operational impact.

## B. Τραπεζικά
Σήμερα: `Μερικώς ναι`.

Τι υπάρχει:
- CRUD toasts,
- delete confirmation,
- validation messages για IBAN/bank name,
- server-side duplicate prevention.

Τι δεν υπάρχει:
- dependency-aware messaging,
- future-vs-history clarification,
- stronger primary-account change warning,
- last-account safety message,
- explicit compliance-sensitive monitoring notice.

Άρα ο χρήστης ενημερώνεται για την πράξη, όχι για τη συνέπεια.

---

## Τι notifications / messages πρέπει να υπάρχουν

## A. Δραστηριότητες & ΚΑΔ

### 1. Add secondary KAD
Πρέπει να εμφανίζεται success toast:
- `Ο ΚΑΔ {code} προστέθηκε.`

Αν ο ΚΑΔ υπάρχει ήδη:
- `Ο ΚΑΔ {code} υπάρχει ήδη στις δραστηριότητες της επαφής.`

### 2. Remove secondary KAD
Πριν τη διαγραφή χρειάζεται lightweight confirm:
- `Θέλετε να αφαιρέσετε τον ΚΑΔ {code};`
- `Η αλλαγή θα επηρεάσει μόνο τη μελλοντική χρήση της επαφής σε αναζητήσεις, προφίλ και λογιστικές ροές που διαβάζουν live στοιχεία.`

Μετά τη διαγραφή:
- `Ο ΚΑΔ {code} αφαιρέθηκε.`

### 3. Change primary KAD
Αυτό είναι critical action και χρειάζεται stronger warning.
Προτεινόμενο confirm:
- `Η κύρια δραστηριότητα θα αλλάξει από {oldCode} σε {newCode}.`
- `Η αλλαγή μπορεί να επηρεάσει λογιστικές ρυθμίσεις, PDF παραστατικών, myDATA/classification flows και μελλοντικά έγγραφα που χρησιμοποιούν τον κύριο ΚΑΔ της εταιρείας.`
- `Τα ήδη εκδομένα παραστατικά που έχουν snapshot δεν αλλάζουν.`

Μετά το save:
- `Ο κύριος ΚΑΔ ενημερώθηκε.`

### 4. Remove primary KAD
Κανονικά δεν πρέπει να επιτρέπεται “κενό” primary KAD αν υπάρχουν άλλες δραστηριότητες.
Προτεινόμενο rule:
- αν υπάρχει secondary, ζητάμε πρώτα `ορίστε νέο primary`.
- αν είναι ο μόνος KAD, επιτρέπεται clear μόνο με explicit strong confirm ή δεν επιτρέπεται καθόλου αν ο business κανόνας απαιτεί κύρια δραστηριότητα.

Προτεινόμενο message:
- `Η εταιρεία πρέπει να έχει μία κύρια δραστηριότητα. Ορίστε άλλον ΚΑΔ ως κύριο πριν αφαιρέσετε τον τρέχοντα.`

### 5. Chamber edit
Δεν χρειάζεται βαρύ confirm, αλλά χρειάζεται info-level notice αν υπάρχουν accounting/compliance dependencies:
- `Η αλλαγή επιμελητηρίου θα χρησιμοποιηθεί σε μελλοντικές προβολές/έγγραφα που διαβάζουν live στοιχεία εταιρείας.`

### 6. Save summary για όλο το tab
Αν έχουν αλλάξει πολλά fields, ιδανικά πριν το save:
- `Θα ενημερωθούν η κύρια δραστηριότητα, {n} δευτερεύουσες δραστηριότητες και το επιμελητήριο.`
- `Οι αλλαγές θα ισχύσουν για μελλοντική χρήση της επαφής. Τα υπάρχοντα snapshots παραμένουν ως έχουν.`

---

## B. Τραπεζικά

### 1. Add bank account
Υπάρχει ήδη success toast. Θέλει μικρή ενίσχυση αν είναι primary:
- `Ο λογαριασμός {bankName} προστέθηκε και ορίστηκε ως κύριος.`

Αν δεν είναι primary:
- `Ο λογαριασμός {bankName} προστέθηκε.`

### 2. Update bank account
Υπάρχει ήδη success toast, αλλά για sensitive field changes πρέπει να υπάρχει impact notice.
Αν αλλάζει ένα από:
- `iban`
- `bankName`
- `bankCode`
- `holderName`
- `isPrimary`

τότε χρειάζεται message:
- `Οι αλλαγές θα χρησιμοποιηθούν σε μελλοντικές πληρωμές, εξαγωγές και έγγραφα που διαβάζουν live τραπεζικά στοιχεία.`
- `Τα ήδη εκδομένα παραστατικά που περιέχουν snapshot τραπεζικών στοιχείων δεν αλλάζουν.`

### 3. Delete bank account
Υπάρχει ήδη confirm, αλλά πρέπει να γίνει πιο χρήσιμο.
Προτεινόμενο νέο confirm:
- `Θέλετε να απενεργοποιήσετε τον λογαριασμό {bankName} με IBAN {iban};`
- `Ο λογαριασμός δεν θα είναι πλέον διαθέσιμος σε μελλοντικές πληρωμές, PDF παραστατικών και ροές που χρησιμοποιούν live τραπεζικά στοιχεία.`
- `Τα ήδη εκδομένα παραστατικά που έχουν snapshot δεν αλλάζουν.`

Αν είναι primary account:
- `Ο λογαριασμός αυτός είναι ο κύριος. Μετά τη διαγραφή, πρέπει να ορίσετε νέο κύριο λογαριασμό.`

### 4. Set primary account
Υπάρχει ήδη toast, αλλά χρειάζεται warning πριν την αλλαγή όταν υπάρχει ήδη άλλος primary:
- `Ο λογαριασμός {bankName} θα οριστεί ως κύριος.`
- `Μελλοντικές πληρωμές και έγγραφα που χρησιμοποιούν primary bank account θα εμφανίζουν αυτόν τον λογαριασμό.`

Μετά:
- `Ο λογαριασμός {bankName} ορίστηκε ως κύριος.`

### 5. Delete last active account
Πρέπει να υπάρχει special warning:
- `Πρόκειται για τον τελευταίο ενεργό τραπεζικό λογαριασμό της επαφής.`
- `Μετά τη διαγραφή δεν θα υπάρχει διαθέσιμος λογαριασμός για μελλοντικές πληρωμές ή προβολή σε σχετικά έγγραφα.`

### 6. Duplicate / fraud-sensitive edit
Για αλλαγή IBAN ειδικά, προτείνεται monitoring-style info:
- `Η αλλαγή IBAN είναι ευαίσθητη οικονομική μεταβολή και καταγράφεται στο ιστορικό αλλαγών.`

---

## Τι dependencies ΠΡΕΠΕΙ να θεωρούνται επίσημα product dependencies

## Για ΚΑΔ
Πρέπει να θεωρούνται official dependencies:
- company master profile,
- primary activity / classification logic,
- accounting profile resolution,
- invoice PDF / myDATA-related display or data selection,
- report filters / search / future analytics,
- audit trail.

## Για Τραπεζικά
Πρέπει να θεωρούνται official dependencies:
- payment instructions,
- invoice/export/PDF fallback data,
- issuer snapshot creation for new accounting docs,
- future remittance/payment integrations,
- sensitive-field monitoring,
- audit trail.

---

## Τι κάνουν οι μεγάλοι vendors

## 1. Microsoft Dynamics 365 / Business Central
Επίσημες πηγές δείχνουν ότι:
- επιτρέπονται πολλαπλοί bank accounts,
- ορίζεται preferred/default bank account,
- sensitive bank fields μπορούν να παρακολουθούνται και να παράγουν notifications,
- σε Finance υπάρχει vendor bank approval workflow,
- η Microsoft αναγνώρισε ρητά την ανάγκη ιστορικότητας για παλιά payment entries όταν αλλάζει IBAN.

Τεκμήρια:
- Business Central vendor bank accounts: preferred bank account + monitor sensitive fields
  https://learn.microsoft.com/en-gb/dynamics365/business-central/purchasing-how-set-up-vendors-bank-accounts
- Finance vendor bank approval workflow
  https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/vendor-bank-account-workflow
- Finance IBAN validation
  https://learn.microsoft.com/en-us/dynamics365/finance/cash-bank-management/iban-validation
- Business Central historical IBAN tracking for past credit transfer entries
  https://learn.microsoft.com/th-th/dynamics365-release-plan/2021wave2/smb/dynamics365-business-central/keep-track-historical-iban-number-when-vendor-bank-account-number-changes

Συμπέρασμα για εμάς:
Το σωστό market pattern είναι:
- multiple accounts,
- preferred/primary selection,
- strong validation,
- approval/monitoring για sensitive changes,
- historical safety για past documents/entries.

## 2. SAP
Η SAP αντιμετωπίζει τον business partner ως κεντρικό master record με:
- πολλαπλά bank details,
- IBAN και bank detail IDs,
- substitute/change semantics και validity periods,
- multiple industries με standard/default industry,
- industry ως classification της κύριας επιχειρηματικής δραστηριότητας.

Τεκμήρια:
- SAP Business Partner Industry
  https://help.sap.com/docs/SAP_S4HANA_CLOUD/f86dc2eb1f8b48c880a7607213104b27/273a98394e684e688845757ac68deb2d.html
- SAP Bank Details / Business Partner Bank Account Data
  https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/6d31005aa10649649041a0b205f5f4f7/b9ae8d5377a0ec23e10000000a174cb4.html
  https://help.sap.com/docs/SAP_S4HANA_CLOUD/f86dc2eb1f8b48c880a7607213104b27/ab936af2a75844d4b7948c8a23fd9ffc.html
- SAP Business Partner API properties for BANKDETAILS and INDUSTRIES
  https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/74b0b157c81944ffaac6ebc07245b9dc/87a9cd7d1c7e4fcb8bf81a080c516349.html

Συμπέρασμα για εμάς:
Το σωστό pattern είναι να μοντελοποιούμε και τα KAD και τα bank accounts ως first-class master subrecords, με standard/default semantics και όχι σαν απλά πεδία φόρμας.

## 3. Oracle Fusion
Η Oracle δείχνει ότι οι business classifications:
- είναι ξεχωριστός managed resource,
- έχουν status, certifying agency, notes, dates, attachments,
- κρατούν provider/contact attribution,
- έχουν create/update/delete REST endpoints,
- και στέλνονται notifications όταν classification records λήγουν.

Τεκμήρια:
- Oracle Business Classifications overview
  https://docs.oracle.com/en/cloud/saas/procurement/25c/oaprc/business-classifications.html
- Oracle Business Classifications REST endpoints
  https://docs.oracle.com/en/cloud/saas/procurement/25d/fapra/api-suppliers-business-classifications.html
- Oracle update classification API with `CreatedBy`, `LastUpdatedBy`, `LastUpdateDate`
  https://docs.oracle.com/en/cloud/saas/procurement/26a/fapra/op-suppliers-supplierid-child-businessclassifications-classificationid-patch.html

Συμπέρασμα για εμάς:
Τα activity/classification δεδομένα σε enterprise προϊόντα έχουν status, attribution, ημερομηνίες, notes και notifications. Άρα το δικό μας `ΚΑΔ` tab σήμερα είναι product-immature σε σχέση με την αγορά.

---

## Προτεινόμενο policy ανά tab

## A. Δραστηριότητες & ΚΑΔ
- Επιτρέπεται add/update/remove secondary KAD.
- Επιτρέπεται change primary KAD μόνο με explicit confirm.
- Δεν πρέπει να επιτρέπεται orphan state χωρίς primary KAD, εκτός αν υπάρχει σαφός business rule waiver.
- Το chamber edit επιτρέπεται χωρίς hard block αλλά με info notice.
- Κάθε save που αλλάζει primary KAD πρέπει να γράφει audit event.
- Ιδανικά να υπάρχει diff summary πριν το save.

## B. Τραπεζικά
- Επιτρέπεται add/update/delete/set-primary.
- Delete πρέπει να παραμείνει soft-delete.
- IBAN changes να θεωρούνται sensitive changes.
- Set-primary και delete-primary να έχουν extra warning.
- Delete-last-active να έχει stronger warning ή guard ανά business rule.
- Κάθε create/update/delete/set-primary να γράφει audit event και στο normal UI path, όχι μόνο στο AI path.

---

## Συγκεκριμένα gaps που αξίζει να υλοποιηθούν στο repo

### Priority 1
1. `KAD operation messaging`
- dedicated i18n keys για add/remove/set-primary/impact-warning
- lightweight confirm για remove secondary
- strong confirm για change primary

2. `Banking impact messaging`
- επέκταση του υπάρχοντος delete dialog
- warning όταν διαγράφεται primary ή last active
- info banner όταν αλλάζει sensitive field όπως IBAN

3. `UI-path audit trail`
- reuse του υπάρχοντος audit concept που υπάρχει στα AI handlers
- ίδια λογική για normal product flow

### Priority 2
4. `Future vs snapshot clarification`
- reusable copy pattern για accounting-related fields
- να εμφανίζεται σε banking και primary KAD changes

5. `KAD validation hardening`
- duplicate prevention
- ξεκάθαρο rule για free-text vs official-only KAD
- προστασία ώστε πάντα να υπάρχει primary

### Priority 3
6. `Impact preview`
- πριν από critical save να υπολογίζεται summary όπως:
  - `θα αλλάξει ο κύριος ΚΑΔ`
  - `θα απενεργοποιηθεί primary bank account`
  - `μελλοντικά έγγραφα/πληρωμές θα χρησιμοποιούν τα νέα στοιχεία`

---

## Τελικό συμπέρασμα
Στα tabs `Δραστηριότητες & ΚΑΔ` και `Τραπεζικά` υπάρχουν ήδη πραγματικές εξαρτήσεις.

Το `Τραπεζικά` έχει σήμερα αρκετά καλή CRUD ωριμότητα, αλλά λείπει η ενημέρωση για downstream impact.
Το `Δραστηριότητες & ΚΑΔ` έχει data model και rendering, αλλά όχι αντίστοιχη product governance: δεν έχει operation-level toasts, confirmations, impact warnings ή ξεκάθαρο audit story.

Αν το προϊόν θέλει enterprise συμπεριφορά, η σωστή κατεύθυνση είναι:
- `KAD = governed business classification master data`
- `Bank accounts = governed sensitive financial master data`
- και για τα δύο tabs: `impact-aware UX + audit trail + future-vs-history clarity`.

---

## Έλεγχος / Μεθοδολογία
Έγινε έρευνα στον τοπικό κώδικα και στα docs του repo, με έμφαση σε:
- contacts form rendering,
- mapping/persistence,
- banking services,
- accounting PDF/snapshot flows,
- i18n messages,
- AI handlers / audit patterns.

Έγινε επίσης benchmark από επίσημες πηγές Microsoft, SAP και Oracle.

Δεν έγινε αλλαγή production code. Άρα δεν έτρεξα `npx tsc --noEmit`, επειδή το turn αφορούσε μόνο συγγραφή τοπικής αναφοράς.
