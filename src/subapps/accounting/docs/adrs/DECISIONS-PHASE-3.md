# DECISIONS-PHASE-3: Missing Features & Interface Fixes

> **Status**: ✅ IMPLEMENTED (2026-03-30)
> **Date**: 2026-03-30
> **Scope**: Φάση 3 του accounting roadmap (audit items B-1, B-2, B-3, B-4, C-1)
> **Depends on**: Phase 1a ✅, Phase 1b ✅, Phase 1c ✅, Phase 2 ✅

---

## Σύνοψη Φάσης 3

Η Φάση 3 αφορά **5 εργασίες** — missing features και βελτιώσεις interface:

| # | Audit ID | Εργασία | Εκτίμηση |
|---|----------|---------|----------|
| 11 | B-1 | ΕΠΕ/ΑΕ εταιρικός φόρος στο Reports | ~30min |
| 12 | B-2 | Invoice Edit UI (draft/rejected) | ~3h |
| 13 | B-3 | Expense→Journal κεντρικοποίηση | ~1h |
| 14 | B-4 | Dashboard fiscal year selector | ~30min |
| 15 | C-1 | Fix ITaxEngine interface (concrete cast) | ~30min |

---

## Ερωτήσεις & Αποφάσεις

### Q1: ΕΠΕ/ΑΕ στο Reports — Ξεχωριστό component ή reuse;

**Πρόβλημα:** Το `ReportsPageContent.tsx` δείχνει φόρο μόνο για sole_proprietor και ΟΕ. Τα entity types ΕΠΕ/ΑΕ πέφτουν στο default (sole proprietor) view.

**Υπάρχον code:** `CorporateTaxBreakdown` component (components/tax/) — fully implemented αλλά δεν γίνεται import. API endpoint ΗΔΗ επιστρέφει EPE/AE data. Hook `useTaxEstimate` χρειάζεται extend.

**Industry Research:**
- **SAP S/4HANA**: Ένα configurable template ανά tax report, entity-level customization μέσω labels/filters
- **Oracle NetSuite**: Tax Return Templates — pre-configured per entity, customizable. Multi-entity μέσω OneWorld.
- **Xero/QuickBooks**: Ίδια UI δομή (income→expenses→taxable→tax), αλλαγή labels + rates ανά entity type

**Πηγές:**
- [SAP Tax Enterprise Structure](https://blog.sap-press.com/enterprise-structure-elements-for-taxes-within-sap-s4hana)
- [Oracle NetSuite Tax Return Templates](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1528248236.html)
- [Xero Business Structures](https://www.xero.com/us/guides/starting-a-business/business-structure/)

**Επιλογές:**
- **A — Reuse** `CorporateTaxBreakdown` για ΕΠΕ+ΑΕ, labels μέσω i18n βάσει entity type
- **B — Ξεχωριστά** components EPETaxBreakdown + AETaxBreakdown (duplicate code)

**Απόφαση Γιώργου: ✅ Option A** — Ένα reusable component, i18n labels. Industry standard (SAP/NetSuite/Xero pattern).

---

### Q2: Invoice Edit UI — Ποια πεδία editable σε draft;

**Πρόβλημα:** API PATCH δουλεύει σωστά (draft/rejected=editable, sent/approved/paid=locked), αλλά δεν υπάρχει UI. Ο χρήστης αναγκάζεται σε cancel+recreate.

**Industry Research:**
- **Xero**: Draft = πλήρες edit, Approved = μικρές αλλαγές μόνο, Paid = locked
- **QuickBooks**: Draft = πλήρες edit, Sent = edit με warning, Paid = void+recreate
- **SAP/SAGE**: Draft = πλήρες edit, Posted = reversal only

**Πηγές:**
- [Xero Edit Invoice](https://central.xero.com/s/article/Edit-an-invoice-US)
- [Xero Invoice Status](https://developer.xero.com/documentation/best-practices/user-experience/invoice-status/)

**Επιλογές:**
- **A — Πλήρες edit** σε draft/rejected (γραμμές, πελάτης, ημερομηνίες, ποσά, τύπος, σειρά, payment, withholding, notes)
- **B — Περιορισμένο edit** (μόνο γραμμές, ποσά, ημερομηνίες, notes — πελάτης+τύπος+σειρά locked)

**Απόφαση Γιώργου: ✅ Option A** — Πλήρες edit σε draft/rejected. Ίδιο form με create, pre-filled. Industry standard.

---

### Q3: Expense→Journal — Κεντρικοποίηση;

**Πρόβλημα:** Η λογική "επιβεβαίωση εξόδου → εγγραφή ημερολογίου" είναι inline στο API endpoint (`documents/[id]/route.ts`), αντί σε κεντρικό service. Τα τιμολόγια ΗΔΗ έχουν κεντρική μέθοδο `createJournalEntryFromInvoice()`.

**Industry Research:**
- **Xero**: Αυτόματο double-entry booking μέσω κεντρικού engine
- **Oracle NetSuite**: Rule-based journal entry automation, κεντρικά
- **SAP Concur**: Enterprise-grade journal entry automation, single source

**Πηγές:**
- [Xero Double-Entry Bookkeeping](https://www.xero.com/us/guides/double-entry-bookkeeping/)
- [NetSuite Journal Entry Automation](https://www.netsuite.com/portal/resource/articles/accounting/journal-entry-automation.shtml)

**Απόφαση Γιώργου: ✅ ΝΑΙ** — Δημιουργία `createJournalEntryFromExpense()` στο AccountingService. API endpoint καλεί service method.

---

### Q4: Dashboard Fiscal Year Selector

**Πρόβλημα:** Dashboard hardcoded στο τρέχον έτος (`new Date().getFullYear()`). Χρήστης δεν μπορεί να δει προηγούμενα έτη.

**Υπάρχον code:** `FiscalYearPicker` component ΗΔΗ υπάρχει και χρησιμοποιείται στο Reports page.

**Industry Research:**
- Κάθε accounting dashboard (Xero, QuickBooks, SAP, NetSuite) έχει time period selector
- Pattern: Dropdown στο header, δίπλα σε actions

**Απόφαση Γιώργου: ✅ ΝΑΙ** — Reuse `FiscalYearPicker` στο Dashboard header, δίπλα στο "Νέο Τιμολόγιο".

---

### Q5: Fix ITaxEngine Interface (Concrete Cast)

**Πρόβλημα:** 3 σημεία στο `accounting-service.ts` κάνουν `this.taxEngine as TaxEngine` (concrete cast) αντί να χρησιμοποιούν το interface. Σπάει abstraction layer (ADR-ACC-010).

**Industry Research:**
- **Strategy Pattern** (standard): Interface expose όλες τις μεθόδους, concrete classes implement
- **SAP/Oracle**: Tax abstract class + ITaxFactory, Dependency Inversion Principle
- **SOLID**: Open/Closed Principle — extend interface, μην τροποποιείς consumers

**Πηγές:**
- [Strategy Pattern for Tax](https://www.ionos.com/digitalguide/websites/web-development/strategy-pattern/)
- [Martin Fowler: Patterns for Accounting](https://martinfowler.com/eaaDev/AccountingNarrative.html)
- [TaxCalculator Design Patterns](https://github.com/juankamilomarin/TaxCalculator)

**Απόφαση Γιώργου: ✅ ΝΑΙ** — Extend `ITaxEngine` interface με `calculatePartnershipTax()`, `calculateCorporateTax()`, `calculateAETax()`. Αφαίρεση concrete casts.

---

## Changelog

| Ημερομηνία | Ενέργεια |
|-----------|---------|
| 2026-03-30 | Δημιουργία — 5 ερωτήσεις, αποφάσεις Γιώργου, industry research |
| 2026-03-30 | Υλοποίηση ολοκληρώθηκε — C-1, B-3, B-4, B-1 (+A-2 hooks fix), B-2 |
