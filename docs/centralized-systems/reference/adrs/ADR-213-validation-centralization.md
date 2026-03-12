# ADR-213: Validation Centralization (Phone + Text Extraction)

## Status
**ACCEPTED** — 2026-03-12

## Context
Audit εντόπισε **8 scattered phone validation regexes** με ασυνεπείς κανόνες σε ολόκληρο το codebase. Επιπλέον, τα AI pipeline modules (uc-015, uc-016) είχαν **identical duplicate** regexes για email/phone/VAT extraction. Bonus: `useNotifications.ts` είχε duplicate `formatRelativeTime` (33 lines) ενώ υπήρχε centralized version στο `intl-utils.ts`.

Ήδη υπήρχε centralized email validation στο `src/lib/validation/email-validation.ts` (ADR-209 Phase 8). Ακολουθήσαμε το ίδιο pattern.

## Decision

### 1. Νέο SSoT: `src/lib/validation/phone-validation.ts`
Δύο κατηγορίες:
- **VALIDATION** (anchored regexes) — για form inputs, zod schemas
- **EXTRACTION** (non-anchored regexes) — για AI pipeline text parsing

Base regex από `RelationshipValidationService` (#6 στο audit) — η καλύτερη κάλυψη (Greek mobile + landline + international).

### 2. Migrated Files (8)

| # | Αρχείο | Πριν | Μετά |
|---|--------|------|------|
| 1 | `src/utils/validation.ts` | `/^\+?[1-9]\d{1,14}$/` inline | `PHONE_REGEX` import |
| 2 | `src/config/contact-info-config.ts` | Dynamic `+30` regex | `isValidGreekPhone()` |
| 3 | `src/utils/contactForm/utils/data-cleaning.ts` | `/^[\+]?[0-9\s\-\(\)]{8,15}$/` | `isValidPhone()` |
| 4 | `src/types/contacts/helpers.ts` | `/^\+?[0-9\s-()]+$/` | `PHONE_REGEX` import |
| 5 | `src/hooks/useFormValidation.ts` | `/^\+?[1-9]\d{1,14}$/` inline | `PHONE_REGEX` import |
| 6 | `RelationshipValidationService.ts` | Private method with inline regex | Delegate to `isValidPhone()` |
| 7 | `uc-015 admin-create-contact-module.ts` | Local `EMAIL_REGEX` + `PHONE_REGEX` | `extractEmailFromText()` + `extractPhoneFromText()` |
| 8 | `uc-016 admin-update-contact-module.ts` | Local `EMAIL_REGEX` + `PHONE_REGEX` + `VAT_REGEX` | `extractEmailFromText()` + `extractPhoneFromText()` + `extractVatFromText()` |

### 3. Bonus: formatRelativeTime Dedup
`src/app/crm/notifications/useNotifications.ts` — αφαιρέθηκε 33-line local duplicate, αντικαταστάθηκε με import από `@/lib/intl-utils` (Intl.RelativeTimeFormat — auto-locale, Math.trunc precision).

## Consequences

### Positive
- Single source of truth για phone validation — αλλαγή σε 1 αρχείο αντί 8
- Consistent validation rules: Greek mobile (69X), landline (2X), international (+XX)
- AI pipeline modules χωρίς duplicate regexes
- Extraction functions reusable για μελλοντικά UC modules

### Negative
- Breaking change στο validation strictness (π.χ. `data-cleaning.ts` τώρα απορρίπτει αριθμούς χωρίς proper format αντί να δέχεται garbage)

## API Reference

```typescript
// VALIDATION (form inputs)
import { PHONE_REGEX, isValidPhone, isValidGreekPhone } from '@/lib/validation/phone-validation';

// EXTRACTION (AI text parsing)
import { extractPhoneFromText, extractEmailFromText, extractVatFromText } from '@/lib/validation/phone-validation';
```

## Changelog
- **2026-03-12**: Initial implementation — 8 files migrated, 1 formatRelativeTime dedup
