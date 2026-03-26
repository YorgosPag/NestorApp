# ADR-264: Document Preview Mode — AI Auto-Analysis for File-Only Messages

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-03-26 |
| **Category** | AI Architecture |
| **Related** | ADR-171 (Agentic Loop), ADR-174 (Multi-Channel), ADR-191 (Document Management) |

## Context

Όταν ο χρήστης στέλνει αρχείο (PDF, εικόνα, κλπ) στο Telegram **χωρίς κείμενο/εντολή**, ο AI agent λάμβανε μόνο metadata (filename, contentType) αλλά δεν γνώριζε το πραγματικό περιεχόμενο. Αποτέλεσμα: αδυναμία να βοηθήσει χωρίς explicit command.

## Decision

**Hybrid Auto-Enrichment (Approach C):** Αυτόματο detection "αρχείο χωρίς εντολή" → OpenAI Vision analysis **πριν** το agentic loop → inject results στο enriched message → AI περιγράφει + ρωτάει.

### Γιατί Approach C
- **Εγγυημένη ανάλυση** — δεν βασίζεται στο AI να "σκεφτεί" να καλέσει tool
- **Χωρίς σπατάλη** — τρέχει ΜΟΝΟ αν file χωρίς κείμενο
- **Google-level UX** — ο agent γίνεται βοηθός, δεν παίρνει αποφάσεις

## Architecture

```
User στέλνει αρχείο χωρίς κείμενο
  ↓
agentic-path-executor.ts → handleDocumentPreviewIfNeeded()
  ↓ (αν file + no text)
document-preview-service.ts → previewDocument()
  ↓
OpenAI gpt-4o-mini Vision → structured JSON
  ↓
enrichWithDocumentPreview() → inject στο user message
  ↓
executeAgenticLoop() → AI βλέπει ανάλυση + prompt instruction
  ↓
chatHistoryService.addMessage() → αποθηκεύει enrichedMessage (με ανάλυση)
  ↓
AI: "Αναγνώρισα τιμολόγιο ΔΕΗ... Τι θέλεις να κάνω;"
  ↓
Follow-up μηνύματα → chat history περιέχει ανάλυση PDF → AI θυμάται context
```

## Files

| File | Change |
|------|--------|
| `src/services/ai-pipeline/document-preview-service.ts` | **NEW** — Vision analysis service |
| `src/services/ai-pipeline/agentic-reply-utils.ts` | **MOD** — `enrichWithDocumentPreview()`, `DocumentPreviewData` |
| `src/services/ai-pipeline/agentic-path-executor.ts` | **MOD** — `handleDocumentPreviewIfNeeded()` + wiring |
| `src/services/ai-pipeline/agentic-system-prompt.ts` | **MOD** — DOCUMENT PREVIEW MODE instructions |
| `src/services/ai-pipeline/tools/handlers/contact-document-classifier.ts` | **MOD** — Export shared helpers |

## Interfaces

```typescript
interface DocumentPreviewResult {
  summary: string;           // "Τιμολόγιο ΔΕΗ €142.30, 15/03/2026"
  documentType: string;      // "invoice" | "tax_document" | "contract" | ...
  language: string;           // "el" | "en"
  suggestedActions: string[]; // ["Αρχειοθέτηση", "Σύνδεση με επαφή"]
  confidence: number;         // 0-1
}

interface DocumentPreviewData {
  fileRecordId: string;
  filename: string;
  summary: string;
  documentType: string;
  suggestedActions: string[];
  confidence: number;
}
```

## Rules

1. **Trigger condition:** attachments present AND (empty text OR < 5 chars)
2. **Max previews per message:** 2 (Vercel timeout protection)
3. **Max file size:** 4MB
4. **Supported MIME types:** image/*, application/pdf, Office documents
5. **Graceful fallback:** on failure → metadata-only (existing behavior)
6. **NO auto-action:** AI describes + suggests, waits for user command

## Changelog

| Date | Change |
|------|--------|
| 2026-03-26 | Initial implementation — 1 new file, 4 modified |
| 2026-03-26 | **BUGFIX**: Chat history αποθήκευε `userMessage` (κενό) αντί `enrichedMessage` (με ανάλυση PDF). Follow-up μηνύματα έχαναν context εγγράφου. Fix: save enriched + bump MAX_MESSAGE_CONTENT_LENGTH 2000→3000 |
