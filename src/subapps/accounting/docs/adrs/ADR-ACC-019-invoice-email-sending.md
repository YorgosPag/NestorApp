# ADR-ACC-019: Invoice Email Sending — Αποστολή Τιμολογίων μέσω Email

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-03-17 |
| **Category** | Accounting / Invoicing / Email Delivery |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-002](./ADR-ACC-002-invoicing-system.md) — Invoicing System |
| **Depends On** | [ADR-ACC-018](./ADR-ACC-018-invoice-pdf-generation.md) — Invoice PDF Generation |
| **Related** | [ADR-070](../../../../docs/centralized-systems/reference/adrs/ADR-070-email-ai-ingestion-system.md) — Email & AI Ingestion |
| **Module** | M-003: Invoicing (Extension) |

---

## 1. Context

Η δημιουργία PDF τιμολογίων (ADR-ACC-018) **ολοκληρώθηκε**. Το `getInvoicePDFBlob()` επιστρέφει PDF Blob ready for attachment. Ωστόσο:

- Το κουμπί **Email** στο `InvoiceActionsMenu.tsx` είναι **disabled** (placeholder)
- Ο Γιώργος αποστέλλει τιμολόγια **χειροκίνητα** (download PDF → attach manually σε email client)
- Αυτό χάνει χρόνο και δεν αφήνει audit trail στην εφαρμογή

### Στόχος

One-click αποστολή τιμολογίου: Ο χρήστης πατάει "Email" → το PDF δημιουργείται, στέλνεται μαζί με branded HTML email, και καταγράφεται στο σύστημα.

---

## 2. Υπάρχουσα Υποδομή — ΠΛΗΡΗΣ ΑΝΑΛΥΣΗ

### 2.1 Email Sending Infrastructure (ΗΔΗ ΛΕΙΤΟΥΡΓΕΙ)

| Σύστημα | Αρχείο | Κατάσταση | Σημείωση |
|---------|--------|-----------|----------|
| **Mailgun Sender** | `src/services/ai-pipeline/shared/mailgun-sender.ts` | ✅ PRODUCTION | `sendReplyViaMailgun()` — text + HTML, **ΧΩΡΙΣ attachments** |
| **Email Templates** | `src/services/email-templates/base-email-template.ts` | ✅ PRODUCTION | `wrapInBrandedTemplate()` — Pagonis branded HTML wrapper |
| **Channel Dispatcher** | `src/services/ai-pipeline/shared/channel-reply-dispatcher.ts` | ✅ PRODUCTION | Routes `channel: 'email'` → `sendReplyViaMailgun()` |
| **Rate Limiting** | `src/lib/middleware/with-rate-limit.ts` | ✅ PRODUCTION | `withStandardRateLimit` (60/min), `withSensitiveRateLimit` (20/min) |

### 2.2 Invoice PDF (ΗΔΗ ΟΛΟΚΛΗΡΩΘΗΚΕ — ADR-ACC-018)

| Σύστημα | Αρχείο | Function |
|---------|--------|----------|
| **PDF Blob** | `src/subapps/accounting/services/pdf/invoice-pdf-exporter.ts` | `getInvoicePDFBlob(invoice, settings)` → `Blob` |
| **PDF Download** | (ίδιο) | `exportInvoicePDF()` |
| **PDF Print** | (ίδιο) | `printInvoicePDF()` |
| **Filename Builder** | (ίδιο) | `{Series}-{Number}_{CustomerName}_{Date}.pdf` |

### 2.3 Branded Email Template (ΗΔΗ ΥΠΑΡΧΕΙ)

| Export | Αρχείο | Σκοπός |
|--------|--------|--------|
| `wrapInBrandedTemplate()` | `base-email-template.ts` | Full HTML wrapper: logo, content slot, footer, contact info |
| `BRAND` colors | (ίδιο) | Navy #1E3A5F, gray, accent |
| `escapeHtml()` | (ίδιο) | XSS prevention |
| `formatEuro()` | (ίδιο) | Server-safe EUR formatter |
| `formatDateGreek()` | (ίδιο) | Server-safe DD/MM/YYYY |

### 2.4 Environment Variables (ΗΔΗ ΡΥΘΜΙΣΜΕΝΑ στο Vercel)

```
MAILGUN_API_KEY=✅
MAILGUN_DOMAIN=✅
MAILGUN_FROM_EMAIL=✅ (noreply@nestorconstruct.gr)
MAILGUN_REGION=eu ✅
```

---

## 3. Ανάλυση Gap — Τι ΛΕΙΠΕΙ

### 3.1 Mailgun Attachment Support

**ΚΡΙΣΙΜΟ**: Η τρέχουσα `sendReplyViaMailgun()` **ΔΕΝ υποστηρίζει attachments**.

Τρέχων κώδικας (mailgun-sender.ts:83-90):
```typescript
const formData = new FormData();
formData.append('from', fromEmail);
formData.append('to', params.to);
formData.append('subject', params.subject);
formData.append('text', params.textBody);
if (params.htmlBody) {
  formData.append('html', params.htmlBody);
}
// ← ΛΕΙΠΕΙ: formData.append('attachment', blob, filename)
```

**Mailgun API υποστηρίζει attachments** μέσω `FormData`:
```
formData.append('attachment', file, { filename: 'invoice.pdf', contentType: 'application/pdf' })
```

### 3.2 Invoice Email Template

**ΛΕΙΠΕΙ** ένα invoice-specific email template (content block) που θα μπει μέσα στο `wrapInBrandedTemplate()`.

Περιεχόμενο email:
- Subject: `Τιμολόγιο {Series}-{Number} | {CompanyName}`
- Body: Σύντομο summary (τύπος, αριθμός, ποσό, ημερομηνία, due date)
- Attachment: PDF τιμολογίου

### 3.3 API Endpoint

**ΛΕΙΠΕΙ** Server-side API route: `POST /api/accounting/invoices/[id]/send-email`

- Client-side: δεν μπορεί να στείλει email (env vars server-only, `mailgun-sender.ts` έχει `import 'server-only'`)
- Server-side: δημιουργεί PDF Blob → αποστολή μέσω Mailgun → audit log

### 3.4 Send Confirmation Dialog

**ΛΕΙΠΕΙ** UI dialog πριν την αποστολή:
- Preview email (to, subject, body)
- Confirmation button
- Success/error toast

### 3.5 Audit Trail

**ΛΕΙΠΕΙ** καταγραφή αποστολής:
- Πότε στάλθηκε
- Σε ποιον
- Message ID (Mailgun)
- Status (sent/failed)

---

## 4. Αρχιτεκτονικές Αποφάσεις — ΑΝΟΙΧΤΑ ΕΡΩΤΗΜΑΤΑ

### Ερώτημα 1: Server-side vs Client-side PDF Generation ✅ ΑΠΟΦΑΣΗ

**Πρόβλημα**: Η `renderInvoicePDF()` τρέχει client-side (jsPDF). Αλλά ο `mailgun-sender.ts` είναι server-only.

**✅ ΑΠΟΦΑΣΗ: Server-only (Google-level, κεντρικοποιημένο)**

```
Client: POST /api/.../send-email { invoiceId, recipientEmail }
Server: Fetch invoice → renderInvoicePDF() → Mailgun → audit trail
```

**Γιατί:**
- Ο server είναι η **single source of truth** — zero trust στον client
- **Κεντρικοποιημένο**: ένα σημείο ελέγχου, ένα audit trail, ένα failure mode
- **Google/SAP/Stripe pattern**: το PDF δεν φεύγει ποτέ από τον client
- jsPDF λειτουργεί κανονικά σε Node.js — μικρές αλλαγές (~20-30 γραμμές diff)
- Η `renderInvoicePDF()` γίνεται **isomorphic** (browser + server) με ελάχιστο refactoring

**Απόρριψη Hybrid**: Ο client μπορεί θεωρητικά να στείλει τροποποιημένο PDF → μη αποδεκτό σε production.

**Αποφασίστηκε**: 2026-03-17 — Γιώργος Παγώνης

### Ερώτημα 2: Recipient Email Resolution ✅ ΑΠΟΦΑΣΗ

**Πρόβλημα**: Πού βρίσκουμε το email του πελάτη;

**✅ ΑΠΟΦΑΣΗ: Cascading resolution (Google pattern)**

Κατά σειρά προτεραιότητας:
1. **Contact record** (Firestore, μέσω `invoice.customer.contactId`) — πιο ενημερωμένο, real-time
2. **Invoice snapshot** (`invoice.customer.email`) — fallback αν δεν βρεθεί contact
3. **Manual input** — τελευταία λύση, ο χρήστης πληκτρολογεί

**Γιατί cascading**: Αν ο πελάτης άλλαξε email μετά την έκδοση τιμολογίου, ο contact record θα έχει το σωστό. Το snapshot μπορεί να είναι outdated.

Πάντα **editable** στο dialog — ο χρήστης έχει τον τελικό λόγο.

**Αποφασίστηκε**: 2026-03-17 — Γιώργος Παγώνης

### Ερώτημα 3: Email Subject & Body Language ✅ ΑΠΟΦΑΣΗ

**Πρόβλημα**: Ποια γλώσσα θα έχει το email;

**✅ ΑΠΟΦΑΣΗ: Αυτόματα βάσει `customer.country` (Google i18n pattern)**

- `country === 'GR'` (ή absent) → **Ελληνικά**
- Οποιαδήποτε άλλη χώρα → **Αγγλικά**
- Override δυνατότητα στο dialog (ο χρήστης αλλάζει αν θέλει)

**Αποφασίστηκε**: 2026-03-17 — Γιώργος Παγώνης

### Ερώτημα 4: Audit Trail Location ✅ ΑΠΟΦΑΣΗ

**Πρόβλημα**: Πού αποθηκεύεται το ιστορικό αποστολών email;

**✅ ΑΠΟΦΑΣΗ: Embedded array `emailHistory` στο Invoice document**

- Atomic reads — zero joins, zero extra collections
- 1-3 sends per invoice max — δεν υπάρχει scaling concern
- Google pattern: embedded array για bounded, low-cardinality data

```typescript
interface EmailSendRecord {
  sentAt: string;           // ISO 8601
  recipientEmail: string;
  subject: string;
  mailgunMessageId: string | null;
  status: 'sent' | 'failed';
  error: string | null;
}
```

**Αποφασίστηκε**: 2026-03-17 — Γιώργος Παγώνης

### Ερώτημα 5: Rate Limiting Category ✅ ΑΠΟΦΑΣΗ

**✅ ΑΠΟΦΑΣΗ: `withSensitiveRateLimit` (20 req/min)**

- Η αποστολή email είναι **side-effect** (στέλνει σε τρίτο) — δεν είναι απλό read/write
- 20/min υπεραρκετό (ρεαλιστικά 5-10 emails/day)
- Προστατεύει από accidental spam
- Google pattern: side-effects = sensitive rate limit

**Αποφασίστηκε**: 2026-03-17 — Γιώργος Παγώνης

### Ερώτημα 6: Mailgun Sender Extension vs New Function ✅ ΑΠΟΦΑΣΗ

**Πρόβλημα**: Η `sendReplyViaMailgun()` δεν υποστηρίζει attachments.

**✅ ΑΠΟΦΑΣΗ: Extend existing `sendReplyViaMailgun()` (Google pattern)**

- Προσθήκη optional `attachments` field στο `MailgunSendParams`
- Backward compatible — existing callers δεν αλλάζουν
- Κεντρικοποιημένο — ένας sender για ΟΛΗ την εφαρμογή
- Zero duplication — ένα σημείο αλλαγής

```typescript
// Extended MailgunSendParams
interface MailgunSendParams {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  attachments?: Array<{         // ← ΝΕΟ (optional, backward compatible)
    filename: string;
    content: Blob | Buffer;
    contentType: string;
  }>;
}
```

**Αποφασίστηκε**: 2026-03-17 — Γιώργος Παγώνης

### Ερώτημα 7: Email Body Content ✅ ΑΠΟΦΑΣΗ

**✅ ΑΠΟΦΑΣΗ: Minimal, professional (Google pattern)**

Μόνο τα απαραίτητα στοιχεία — το PDF κάνει τη δουλειά.

**Ελληνικά (country === 'GR'):**
> Αγαπητέ/ή [Όνομα Πελάτη],
>
> Επισυνάπτεται το τιμολόγιο **Α-42** ημερομηνίας 17/03/2026.
>
> | | |
> |---|---|
> | Τύπος | Τιμολόγιο Παροχής Υπηρεσιών |
> | Ποσό | €1.240,00 |
> | Ημ/νία Λήξης | 15/04/2026 |
>
> Με εκτίμηση,
> Παγώνης Ενεργειακή Κατασκευαστική

**Αγγλικά (country !== 'GR'):**
> Dear [Customer Name],
>
> Please find attached invoice **A-42** dated 17/03/2026.
>
> | | |
> |---|---|
> | Type | Service Invoice |
> | Amount | €1,240.00 |
> | Due Date | 15/04/2026 |
>
> Kind regards,
> Pagonis Energeiaki Kataskevastiki

Wrapped μέσα στο `wrapInBrandedTemplate()` — logo header + footer contact info αυτόματα.

**Αποφασίστηκε**: 2026-03-17 — Γιώργος Παγώνης

### Ερώτημα 8: Send Confirmation UI ✅ ΑΠΟΦΑΣΗ

**✅ ΑΠΟΦΑΣΗ: Confirmation dialog πριν αποστολή (Google pattern — μη αναστρέψιμη ενέργεια)**

Πεδία:
- **To**: Pre-filled (cascading resolution: contact → snapshot → manual), editable
- **Subject**: Auto-generated, editable
- **Body Preview**: Read-only rendered preview του email
- **Buttons**: "Αποστολή / Send" + "Ακύρωση / Cancel"

Ποτέ one-click send χωρίς preview — email = side-effect = πάντα confirmation.

**Αποφασίστηκε**: 2026-03-17 — Γιώργος Παγώνης

### Ερώτημα 9: CC/BCC ✅ ΑΠΟΦΑΣΗ

**✅ ΑΠΟΦΑΣΗ: Phase 1 μόνο single recipient — CC στο Phase 2+**

- **Phase 1**: Μόνο `to` field — ship fast, κρατάμε απλό
- **Phase 2+**: Optional CC field στο dialog (π.χ. λογιστής)
- CC προσθέτεται εύκολα μετά χωρίς refactoring (extend `MailgunSendParams` + dialog field)

**Αποφασίστηκε**: 2026-03-17 — Γιώργος Παγώνης

### Ερώτημα 10: Resend Capability ✅ ΑΠΟΦΑΣΗ

**✅ ΑΠΟΦΑΣΗ: Resend επιτρέπεται χωρίς limit — audit trail covers accountability**

- Ο χρήστης πατάει ξανά "Email" → ίδιο dialog → ξαναστέλνει
- Κάθε αποστολή καταγράφεται στο `emailHistory` array (πότε, σε ποιον, status)
- Δεν μπλοκάρουμε τον ιδιοκτήτη της επιχείρησης — Google pattern

**Αποφασίστηκε**: 2026-03-17 — Γιώργος Παγώνης

---

## 5. Αρχιτεκτονική Πρόταση — Implementation Plan

### 5.1 Αρχεία που ΤΡΟΠΟΠΟΙΟΥΝΤΑΙ (ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ)

| Αρχείο | Αλλαγή | Γραμμές diff |
|--------|--------|-------------|
| `src/services/ai-pipeline/shared/mailgun-sender.ts` | +attachments support στο `MailgunSendParams` + `FormData.append()` | ~15 γραμμές |
| `src/subapps/accounting/types/invoice.ts` | +`emailHistory: EmailSendRecord[]` στο `Invoice` interface | ~15 γραμμές |

### 5.2 ΝΕΑ Αρχεία

| Αρχείο | Σκοπός | Εκτ. γραμμές |
|--------|--------|-------------|
| `src/subapps/accounting/services/email/invoice-email-template.ts` | Content block HTML για invoice email body | ~80 |
| `src/app/api/accounting/invoices/[id]/send-email/route.ts` | POST endpoint: receive PDF base64 → Mailgun + audit | ~100 |
| `src/subapps/accounting/components/invoices/details/SendInvoiceEmailDialog.tsx` | Confirmation dialog (to, subject, preview, send button) | ~120 |

### 5.3 Αρχεία που ΕΝΗΜΕΡΩΝΟΝΤΑΙ (UI)

| Αρχείο | Αλλαγή |
|--------|--------|
| `InvoiceActionsMenu.tsx` | Enable Email button → open `SendInvoiceEmailDialog` |
| `InvoiceDetails.tsx` | State management για dialog open/close |

### 5.4 Flow Diagram

```
User clicks "Email" button
        ↓
SendInvoiceEmailDialog opens
  - Pre-fills: to (customer.email), subject, body preview
  - User can edit "to" email
  - User clicks "Αποστολή"
        ↓
Client: getInvoicePDFBlob(invoice) → Blob
Client: Blob → base64 string
Client: POST /api/accounting/invoices/{id}/send-email
  Body: { recipientEmail, subject, pdfBase64, pdfFilename }
        ↓
Server (API Route):
  1. Auth check (withAuth)
  2. Rate limit (withStandardRateLimit)
  3. Validate input (email format, PDF size < 10MB)
  4. Decode pdfBase64 → Buffer
  5. Build HTML body (invoice-email-template.ts)
  6. wrapInBrandedTemplate(contentHtml)
  7. sendReplyViaMailgun({ to, subject, textBody, htmlBody, attachments: [{ filename, content, contentType }] })
  8. Update invoice: push to emailHistory array
  9. Return { success, mailgunMessageId }
        ↓
Client: Success toast + refresh invoice data
```

### 5.5 Dependency Reuse Summary

| Dependency | Source | Σκοπός |
|------------|--------|--------|
| `sendReplyViaMailgun()` | `mailgun-sender.ts` | Αποστολή email (extended with attachments) |
| `wrapInBrandedTemplate()` | `base-email-template.ts` | Branded HTML wrapper |
| `escapeHtml()` | `base-email-template.ts` | XSS prevention |
| `formatEuro()` | `base-email-template.ts` | EUR formatting |
| `formatDateGreek()` | `base-email-template.ts` | Date formatting |
| `getInvoicePDFBlob()` | `invoice-pdf-exporter.ts` | PDF generation (client-side) |
| `withAuth` | `lib/middleware/with-auth.ts` | Authentication |
| `withStandardRateLimit` | `lib/middleware/with-rate-limit.ts` | Rate limiting |
| `INVOICE_TITLES` | TBD (share from template or redefine) | Invoice type labels |

**Zero νέα npm packages.**
**Zero duplication.**
**100% κεντρικοποιημένα systems reuse.**

---

## 6. Εκτίμηση Πολυπλοκότητας

| Τμήμα | Πολυπλοκότητα |
|-------|---------------|
| Mailgun attachment extension | Χαμηλή — 15 γραμμές diff |
| Invoice email template (content block) | Χαμηλή — HTML table με invoice summary |
| API route (server-side) | Μεσαία — auth + validate + send + audit |
| Send dialog (UI) | Μεσαία — form + validation + loading state |
| Audit trail (emailHistory) | Χαμηλή — array push στο existing Invoice doc |

**Συνολικά**: ~330 νέες γραμμές + ~30 γραμμές diff σε existing αρχεία.

---

## 7. Edge Cases & Error Handling

| Scenario | Αντιμετώπιση |
|----------|-------------|
| Πελάτης χωρίς email | Dialog εμφανίζει κενό input — ο χρήστης πληκτρολογεί |
| Invalid email format | Client-side + server-side validation |
| Mailgun API failure | Error toast + log, δεν σπάει το invoice |
| PDF generation failure | Error toast, αποτρέπει αποστολή |
| PDF > 10MB | Rejection (Mailgun limit: 25MB, αλλά 10MB safety) |
| Network timeout | 30s timeout, retry button στο dialog |
| Duplicate send | Επιτρέπεται — audit trail καταγράφει κάθε αποστολή |
| Invoice χωρίς issuer email | Footer email fallback: `MAILGUN_FROM_EMAIL` |

---

## 8. Security Considerations

| Θέμα | Μέτρο |
|------|-------|
| Email content injection | `escapeHtml()` σε όλο το dynamic content |
| PDF tampering (client→server) | Αποδεκτό ρίσκο — ο χρήστης στέλνει τα δικά του τιμολόγια |
| Rate abuse | `withStandardRateLimit` (60/min) — πρακτικά αδύνατο |
| Env var exposure | `import 'server-only'` σε mailgun-sender.ts |
| GDPR | Email αποστέλλεται μόνο σε πελάτη που ήδη υπάρχει στο CRM |

---

## 9. Future Extensions (Phase 2+)

| Feature | Προτεραιότητα |
|---------|-------------|
| CC/BCC support | MEDIUM |
| Custom message body (user-editable) | MEDIUM |
| Scheduled send (στείλε αύριο στις 9:00) | LOW |
| Delivery tracking (Mailgun webhooks - delivered/opened) | LOW |
| Batch send (πολλά τιμολόγια σε διαφορετικούς πελάτες) | LOW |
| Email template customization (WYSIWYG) | LOW |

---

## 10. Changelog

| Date | Decision | Author |
|------|----------|--------|
| 2026-03-17 | ADR Created — Invoice Email Sending design, 10 ερωτήματα αρχιτεκτονικής | Claude Code |
| 2026-03-17 | IMPLEMENTED — All 7 steps complete: mailgun attachment support, EmailSendRecord type, invoice-email-template.ts, POST /api/accounting/invoices/[id]/send-email, SendInvoiceEmailDialog, enabled Email button, ADR update. Architecture note: invoice-email-template.ts is NOT server-only (pure HTML builders, no secrets) to allow preview rendering in client dialog. | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
