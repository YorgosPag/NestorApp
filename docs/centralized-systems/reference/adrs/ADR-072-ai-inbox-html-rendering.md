# ADR-072: AI Inbox HTML Rendering with Enterprise Sanitization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-05 |
| **Category** | Security & Auth |
| **Canonical Location** | `src/lib/message-utils.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

Τα emails στο AI Inbox εμφανίζονταν χωρίς formatting, με τα εξής προβλήματα:

### The Problem

- **Χρώματα/Fonts**: Δεν διατηρούνταν τα χρώματα και οι γραμματοσειρές του email
- **Links**: Τα links `Google Maps <URL>` εμφανίζονταν ολόκληρα αντί για clickable text
- **Contrast**: Τα links ήταν γκρι/σκούρα και δεν διαβάζονταν εύκολα
- **HTML Content**: Το email HTML content (`<div>`, `<br>`, `<a>`, `<b>`, `<i>`) δεν αποδιδόταν σωστά

### Existing Infrastructure

| Component | Path | Status |
|-----------|------|--------|
| **DOMPurify** | `package.json` (v3.3.1) | Εγκατεστημένο |
| **sanitizeHTML()** | `src/lib/message-utils.ts` | Enterprise function |
| **TELEGRAM_ALLOWED_TAGS** | `src/lib/message-utils.ts` | Περιοριστικό για emails |

---

## 2. Decision

Επέκταση του υπάρχοντος sanitization system στο `message-utils.ts` με νέο configuration για emails.

### Canonical Source

```
src/lib/message-utils.ts
```

### Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Email Content  │────▶│  Extended Sanitizer  │────▶│  Safe HTML      │
│  (HTML/Text)    │     │  (DOMPurify + Config)│     │  Rendering      │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────────┐
                        │  EMAIL_ALLOWED_TAGS  │
                        │  - div, span, p      │
                        │  - a (with href)     │
                        │  - b, i, u, strong   │
                        │  - br, ul, li        │
                        │  - style (inline)    │
                        └──────────────────────┘
```

### API

```typescript
import { sanitizeEmailHTML, EMAIL_ALLOWED_TAGS } from '@/lib/message-utils';

// Sanitize email HTML content
const safeHTML = sanitizeEmailHTML(rawEmailContent);

// Render with dangerouslySetInnerHTML (safe after sanitization)
<div dangerouslySetInnerHTML={{ __html: safeHTML }} />
```

### EMAIL_ALLOWED_TAGS

```typescript
export const EMAIL_ALLOWED_TAGS = [
  // Structure
  'div', 'span', 'p', 'br', 'hr',
  // Text formatting
  'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del',
  // Lists
  'ul', 'ol', 'li',
  // Links
  'a',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Tables (email signatures)
  'table', 'tr', 'td', 'th', 'tbody', 'thead',
  // Images
  'img',
];
```

### EMAIL_ALLOWED_ATTRIBUTES

```typescript
export const EMAIL_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'title', 'target'],
  'img': ['src', 'alt', 'width', 'height'],
  '*': ['style', 'class', 'dir'], // Allow inline styles for colors
};
```

---

## 3. Consequences

### Positive

- **XSS Protection**: DOMPurify removes ALL dangerous content (scripts, event handlers)
- **Visual Fidelity**: Email colors, fonts, and formatting preserved
- **Clickable Links**: Links rendered properly with `target="_blank"`
- **Enterprise Reuse**: Extends existing sanitization infrastructure
- **OWASP Compliance**: Whitelist approach (secure by default)

### Negative

- **External Images**: Allows `<img src="...">` from any domain (tracking pixels possible)
- **Inline Styles**: Allows `style` attribute (required for email formatting)

### Security Mitigations

| Threat | Mitigation |
|--------|------------|
| `<script>` injection | DOMPurify removes ALL script tags |
| Event handlers (`onclick`) | FORBID_ATTR list blocks them |
| `javascript:` URLs | DOMPurify default protection |
| SVG exploits | Not in allowed tags |
| iframe embedding | Not in allowed tags |

---

## 4. Prohibitions (after this ADR)

- **Direct dangerouslySetInnerHTML**: Always use `sanitizeEmailHTML()` first
- **Custom HTML parsers**: Use DOMPurify only
- **Allowing event handlers**: Never add `onclick`, `onerror`, etc. to allowlist
- **Allowing script tags**: Never add `script` to allowlist

---

## 5. Migration

| File | Status | Notes |
|------|--------|-------|
| `src/lib/message-utils.ts` | Migrated | Added EMAIL config + sanitizeEmailHTML() |
| `src/app/admin/ai-inbox/AIInboxClient.tsx` | Migrated | Uses SafeHTMLContent component |

---

## 6. References

- Related: [ADR-070](./ADR-070-email-ai-ingestion-system.md) - Email & AI Ingestion System
- DOMPurify: https://github.com/cure53/DOMPurify
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

---

## 7. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-05 | ADR Created | Claude Code |
| 2026-02-05 | Status: Implemented | Γιώργος Παγώνης |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
