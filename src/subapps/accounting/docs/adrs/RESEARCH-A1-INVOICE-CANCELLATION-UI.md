# Research: Invoice Cancellation UI/UX — Enterprise Benchmark

**Ημερομηνία**: 2026-03-30
**Σχετικό**: AUDIT-2026-03-29.md, Task A-1
**Scope**: Βαθιά έρευνα — πώς οι μεγάλες εταιρείες λογισμικού χειρίζονται την ακύρωση τιμολογίου στο UI

---

## 1. SAP S/4HANA

**UI Flow:**
- Invoice → Menu: "Reverse Document" (Fiori app)
- Δημιουργεί reversal document — ΠΟΤΕ delete

**Confirmation Dialog:**
- **Reversal Reason**: ΥΠΟΧΡΕΩΤΙΚΟ dropdown (π.χ. "Reversal in current period", "Actual reversal")
- **Reversal Date**: Ημερομηνία posting
- Warning: "This will create a reversal document. The original will be marked as reversed."

**Visual Indicators:**
- Κόκκινο status badge "Reversed"
- Link στο reversal document
- Η στήλη Status γίνεται κόκκινη

**Void vs Credit:** Reversal (storno) = πλήρης, Credit Memo = μερική πίστωση
**Reason:** ΥΠΟΧΡΕΩΤΙΚΟ — predefined λίστα
**Partial:** Ναι — μέσω Credit Memo
**Undo:** ΟΧΙ — πρέπει νέο document
**Paid invoices:** Πρώτα reset clearing, μετά reversal

---

## 2. Oracle NetSuite

**UI Flow:**
- Invoice → Actions dropdown → "Void" ή "Create Credit Memo"

**Confirmation Dialog:**
- Void: "Are you sure? A voiding journal entry will be created. Cannot be undone."
- Memo reason: optional textarea

**Visual Indicators:**
- Status badge "Voided" σε γκρι
- Grayed out row στη λίστα

**Void vs Credit:** Void = πλήρης (μόνο unpaid), Credit Memo = μερική/πλήρης
**Reason:** Προαιρετικό
**Partial:** Ναι — Credit Memo
**Undo:** ΟΧΙ
**Paid invoices:** ΜΟΝΟ Credit Memo + Refund

---

## 3. Xero

**UI Flow:**
- Invoice → Options (⋯) → "Void" ή "Add Credit Note"

**Confirmation Dialog:**
- Modal: κίτρινο warning icon, "Are you sure? This can't be undone."
- Κόκκινο destructive button "Void"

**Visual Indicators:**
- Κόκκινο badge "VOIDED"
- Read-only invoice
- "This invoice has been voided" κάτω από τον αριθμό

**Smart redirect:** Αν πατήσεις void σε paid → "This invoice has payments. Create a credit note instead."
**Reason:** ΟΧΙ
**Partial:** Ναι — Credit Note
**Undo:** ΟΧΙ
**Paid invoices:** ΜΟΝΟ Credit Note

---

## 4. QuickBooks Online

**UI Flow:**
- Invoice → More (⋮) → "Void" ή "Delete"

**Confirmation Dialog:**
- Void: "This will zero out the amount but keep the transaction in your records."
- Delete: "Permanently remove. Cannot be undone." (κόκκινο button)

**Visual Indicators:**
- **Watermark/stamp "VOIDED"** πάνω στο invoice
- Status: "Voided" γκρι badge
- Amounts: $0.00

**Void vs Delete:** Void = κρατά record, Delete = μόνο Draft
**Reason:** ΟΧΙ
**Partial:** Μόνο μέσω Credit Memo
**Undo:** ΟΧΙ
**Paid invoices:** Πρώτα void payment, μετά void invoice (2-step)

---

## 5. Sage Business Cloud

**UI Flow:**
- Invoice → Actions → "Void Invoice" ή "Create Credit Note"

**Confirmation Dialog:**
- "You are about to void Invoice #XXX. A voiding entry will be created."

**Visual Indicators:**
- "VOID" watermark στο εκτυπωμένο
- Κόκκινο status badge

**Reason:** Προαιρετικό
**Partial:** Ναι — Credit Note
**Undo:** ΟΧΙ
**Paid invoices:** Credit Note + Refund

---

## 6. Procore (Construction-Specific)

**UI Flow:**
- Invoice → Status dropdown → "Void" (commitment/owner invoices)

**Confirmation Dialog:**
- "Are you sure? All associated payment information will be removed."
- Extra warning αν linked σε change orders

**Construction-Specific:**
- Progress billing: void = revert billed amounts back to available
- Retention: ειδική μεταχείριση
- Timeline/audit log: ποιος/πότε voided

**Visual Indicators:**
- Dimmed/grayed row
- "Voided" κόκκινο badge
- Excluded from totals

**Reason:** Required σε πολλά workflows (configurable)
**Paid invoices:** ΠΡΩΤΑ reverse payment

---

## 7. FreshBooks

**UI Flow:**
- Invoice → More (⋮) → "Mark as Void" ή "Delete"

**Visual Indicators:**
- **"VOID" μεγάλα γράμματα watermark**
- Grayed out

**Reason:** ΟΧΙ
**Undo:** ΟΧΙ

---

## 8. Zoho Invoice / Zoho Books

**UI Flow:**
- Invoice → More (⋯) → "Void" ή "Create Credit Note"

**Confirmation Dialog:**
- "Are you sure? A journal entry will reverse the impact."
- **Reason for voiding: [textarea]** (προαιρετικό)
- **Checkbox: "Notify customer about voiding"** (μοναδικό feature)

**Visual Indicators:**
- "VOID" stamp σε κόκκινο
- Read-only

**Reason:** Προαιρετικό textarea
**Customer notification:** ✅ Optional checkbox
**Paid invoices:** ΜΟΝΟ Credit Note + refund

---

## Σύγκριτικός Πίνακας

| Feature | SAP | NetSuite | Xero | QBO | Sage | Procore | Fresh | Zoho |
|---------|-----|----------|------|-----|------|---------|-------|------|
| Void unpaid | Reversal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Void paid | Reset first | ❌→CM | ❌→CN | ❌ | ⚠️ | ❌ | ❌ | ❌→CN |
| Credit Note | ✅ Ξεχωριστό | ✅ | ✅ | ✅ | ✅ | Change orders | ❌ | ✅ |
| Μερική ακύρωση | ✅ CM | ✅ CM | ✅ CN | ✅ CM | ✅ | ❌ | ❌ | ✅ |
| Reason ΥΠΟΧΡ. | **✅** | ❌ | ❌ | ❌ | ❌ | Config | ❌ | ❌ |
| Undo | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Visual | Badge | Grayed | Badge | Watermark | Watermark | Dimmed | Watermark | Stamp |
| Notify πελάτη | Manual | Manual | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Ελληνική Νομοθεσία (ΚΦΔ / ΑΑΔΕ / myDATA)

1. **ΑΠΑΓΟΡΕΥΕΤΑΙ** η διαγραφή εκδοθέντος παραστατικού (ΚΦΔ ν. 4987/2022)
2. Ακύρωση γίνεται **ΑΠΟΚΛΕΙΣΤΙΚΑ** με **Πιστωτικό Τιμολόγιο** (myDATA τύπος 5.1)
3. Το πιστωτικό αναφέρει **ΥΠΟΧΡΕΩΤΙΚΑ** τον αριθμό του αρχικού
4. **ΥΠΟΧΡΕΩΤΙΚΗ** διαβίβαση στο myDATA
5. Τα πιστωτικά μειώνουν τον ΦΠΑ εκροών στη δήλωση ΦΠΑ
6. **Κατασκευαστικές**: πιστωτικό σε τεχνικά έργα αναφέρει αριθμό σύμβασης

## EU e-Invoicing (2014/55/EU + EN 16931)

- Ακύρωση = Credit Note (InvoiceTypeCode = 381)
- BillingReference → σύνδεση με original invoice
- Δεν υπάρχει concept "void" στο EU framework

---

## Αρχιτεκτονικές Αποφάσεις βάσει Έρευνας

| Απόφαση | Επιλογή | Πηγή |
|---------|---------|------|
| Draft invoice | Soft-delete (status→cancelled) | Xero, QBO |
| Εκδοθέν invoice | ΜΟΝΟ Πιστωτικό Τιμολόγιο | Ελληνικός νόμος + SAP/NetSuite |
| Λόγος ακύρωσης | **ΥΠΟΧΡΕΩΤΙΚΟ** dropdown | SAP (μόνη που το κάνει υποχρεωτικό) |
| Μερική ακύρωση | Μελλοντικό (Path B: Έκδοση Πιστωτικού) | NetSuite/Xero/Zoho |
| Visual: Badge | Κόκκινο "ΑΚΥΡΩΜΕΝΟ" | Xero + Sage |
| Visual: Watermark | Diagonal "ΑΚΥΡΩΜΕΝΟ" σε opacity | QuickBooks + FreshBooks |
| Visual: Opacity | Content σε 0.6 opacity | NetSuite + Procore |
| Undo ακύρωσης | ΟΧΙ — τελεσίδικη | 8/8 εταιρείες |
| Ειδοποίηση πελάτη | Optional checkbox (μελλοντικό) | Zoho |

---

## Κατάσταση Υλοποίησης (2026-03-30)

### ✅ Backend — 100% ΥΛΟΠΟΙΗΜΕΝΟ (δεν χρειάζεται κώδικας)

| Αρχείο | Τι κάνει |
|---|---|
| `reversal-service.ts` (243 γρ.) | `reverseJournalEntryForCancelledInvoice()` + `createCreditNoteForInvoice()` |
| `invoices/[id]/route.ts` DELETE | Path A: Draft→Void, Path B: Sent/Accepted→Credit Note, Zod validation |
| `invoice-schemas.ts` | `CancelInvoiceSchema`, `VOIDABLE_STATUSES`, `CREDIT_NOTE_STATUSES` |
| `fiscal-period-service.ts` (328 γρ.) | Cross-period reversal, OPEN/CLOSED/LOCKED |
| `balance-service.ts` (290 γρ.) | Customer balance update μετά ακύρωση |
| `accounting-audit-service.ts` | Audit logging (15 event types) |

### ✅ UI — 100% ΥΛΟΠΟΙΗΜΕΝΟ (2026-03-30)

| Τι υλοποιήθηκε | Αρχείο |
|---|---|
| Κουμπί "Ακύρωση" (draft) / "Έκδοση Πιστωτικού" (εκδοθέν) | `InvoiceActionsMenu.tsx` — τελευταίο, κόκκινο, separator |
| Dialog λόγου ακύρωσης με dropdown + notes | `CancelInvoiceDialog.tsx` (νέο, 319 γρ.) |
| Badge "ΑΚΥΡΩΜΕΝΟ" + dimmed content | `InvoiceDetails.tsx` (banner) + `InvoiceSummaryCard.tsx` (opacity) |
| Dimmed row στη λίστα | `InvoiceRow.tsx` (opacity 0.5) |
| Bidirectional credit note link | `InvoiceDetails.tsx` (Link components) |
| i18n (EL + EN) | `accounting.json` — section `cancelDialog` |
| Tests 24/24 | `__tests__/CancelInvoiceDialog.test.tsx` + `InvoiceActionsMenu.test.tsx` |

---

## Προτεινόμενη UI Ροή (Enterprise Pattern)

### Path A: Πρόχειρο τιμολόγιο (Draft/Rejected) → Κουμπί "Ακύρωση"

```
Χρήστης → Μενού ενεργειών → "Ακύρωση"
  ↓
Modal:
  - Τίτλος: "Ακύρωση Πρόχειρου Τιμολογίου"
  - Λόγος (ΥΠΟΧΡΕΩΤΙΚΟ dropdown)
  - Σημειώσεις (υποχρεωτικό αν "Άλλο")
  - [Ακύρωση] κόκκινο | [Πίσω]
  ↓
Backend: DELETE /api/accounting/invoices/[id] → Path A (void)
  - status → cancelled
  - Journal reversal
  - Balance update
  - Audit log
```

### Path B: Εκδοθέν τιμολόγιο (Sent/Accepted) → Κουμπί "Έκδοση Πιστωτικού"

```
Χρήστης → Μενού ενεργειών → "Έκδοση Πιστωτικού"
  ↓
Modal:
  - Τίτλος: "Έκδοση Πιστωτικού Τιμολογίου"
  - Warning: "Θα δημιουργηθεί πιστωτικό τιμολόγιο (ελληνική νομοθεσία)"
  - Λόγος (ΥΠΟΧΡΕΩΤΙΚΟ dropdown)
  - Σημειώσεις (υποχρεωτικό αν "Άλλο")
  - Preview ποσών
  - [Έκδοση Πιστωτικού] κόκκινο | [Πίσω]
  ↓
Backend: DELETE /api/accounting/invoices/[id] → Path B (credit note)
  - Νέο credit_invoice δημιουργείται
  - Journal reversal
  - Bidirectional link
  - Balance update
  - Audit log
```

### Path C: Μερική Πίστωση (Μελλοντικό)

```
Χρήστης → "Μερική Πίστωση" → Φόρμα με editable amounts → Confirm
```

---

---

## ΚΡΙΣΙΜΗ ΔΙΕΥΚΡΙΝΗΣΗ: "Ακύρωση" vs "Πιστωτικό" στην Ελλάδα (2026-03-30)

**Ερώτηση Γιώργου**: "Η ελληνική νομοθεσία επιτρέπει να ακυρώσεις τιμολόγιο ναι ή όχι;"

### Απάντηση: Υπάρχουν ΔΥΟ διαφορετικά πράγματα

| | Τεχνική Ακύρωση (myDATA API) | Πιστωτικό Τιμολόγιο (5.1) |
|---|---|---|
| **Τι είναι** | Flag στο myDATA — `SendInvoicesCancellation` | Νέο παραστατικό με νομική ισχύ |
| **Πότε** | Λάθος/διπλή διαβίβαση, τεχνικό σφάλμα | Πραγματική αντιστροφή συναλλαγής |
| **Νομική βάση** | Τεχνικές προδιαγραφές myDATA API | Ν. 4308/2014 (ΕΛΠ), Άρθρο 10 |
| **Αριθμός** | Ίδιο MARK, flagged ως cancelled | Νέος αριθμός, νέο MARK |
| **Λογιστική εγγραφή** | ΟΧΙ — σαν να μην υπήρξε ποτέ | ΝΑΙ — αντίστροφη εγγραφή |
| **ΦΠΑ** | Δεν επηρεάζεται | Αντιστρέφεται κανονικά |
| **Χρήση** | Σπάνια, ειδικές περιπτώσεις | Η standard μέθοδος |

### Τι κάνει ο τρέχων κώδικας — ΣΩΣΤΟ

| Κατάσταση | Ενέργεια | Νομικά |
|---|---|---|
| Draft/Rejected | Soft-delete + journal reversal | ✅ Σωστό — δεν εκδόθηκε ποτέ |
| Sent/Accepted | Δημιουργία πιστωτικού τιμολογίου | ✅ Σωστό — Ν. 4308/2014 |

### Επίπτωση στο UI

Η λέξη "Ακύρωση" στο UI πρέπει να χρησιμοποιείται ΜΟΝΟ για drafts.
Για εκδοθέντα τιμολόγια, η ενέργεια πρέπει να λέει "Έκδοση Πιστωτικού" ή "Αντιστροφή μέσω Πιστωτικού".
Η εφαρμογή ΔΕΝ πρέπει να δίνει την εντύπωση ότι "ακυρώνει" ένα εκδοθέν τιμολόγιο.

### DISCLAIMER
Ανάλυση βασισμένη σε γνώσεις μέχρι Μάιο 2025. Για production: επιβεβαίωση από λογιστή/φοροτεχνικό + τρέχουσες εγκυκλίους ΑΑΔΕ.

---

## Changelog

| Ημερομηνία | Ενέργεια |
|-----------|---------|
| 2026-03-30 | Δημιουργία — βαθιά έρευνα 8 enterprise πλατφορμών + ελληνική νομοθεσία + EU directive |
| 2026-03-30 | Κρίσιμη διευκρίνηση: "Ακύρωση" vs "Πιστωτικό" — ερώτηση Γιώργου. Διαχωρισμός τεχνικής ακύρωσης myDATA από πιστωτικό τιμολόγιο. Επίπτωση στο UI naming. |
| 2026-03-30 | Προστέθηκε section "Κατάσταση Υλοποίησης" — backend 100% done, UI 0%. Διορθώθηκε η UI ροή: 2 ξεχωριστά κουμπιά (Ακύρωση για draft, Έκδοση Πιστωτικού για εκδοθέντα). Επιβεβαίωση ότι δεν γράφουμε διπλότυπο κώδικα. |
| 2026-03-30 | **ΑΠΟΦΑΣΗ Γιώργου**: ✅ Επιβεβαίωσε 2 ξεχωριστά κουμπιά: "Ακύρωση" (draft), "Έκδοση Πιστωτικού" (εκδοθέν). |
| 2026-03-30 | **ΑΠΟΦΑΣΗ Γιώργου**: ✅ Visual: Badge κόκκινο "ΑΚΥΡΩΜΕΝΟ" + dimmed content (SAP/NetSuite enterprise pattern). ΟΧΙ watermark. |
| 2026-03-30 | **ΕΛΕΓΧΟΣ ΔΙΠΛΟΤΥΠΟΥ**: Bidirectional linking (creditNoteInvoiceId↔relatedInvoiceId) ΗΔΗ υλοποιημένο στο backend + PDF. Λείπει ΜΟΝΟ UI link (1 `<Link>` component). Μηδέν κίνδυνος διπλότυπου. |
| 2026-03-30 | **ΑΠΟΦΑΣΗ Γιώργου**: ✅ Κουμπί ακύρωσης/πιστωτικού τελευταίο στο dropdown + κόκκινο χρώμα (destructive action — SAP/Xero/Zoho pattern). |
| 2026-03-30 | **ΥΛΟΠΟΙΗΣΗ UI**: ✅ CancelInvoiceDialog (Path A void + Path B credit note), InvoiceActionsMenu (2 κουμπιά, separator, destructive), InvoiceDetails (cancelled banner, credit note links), InvoiceSummaryCard (dimmed), InvoiceRow (dimmed), i18n EL+EN. 24 tests pass. |
