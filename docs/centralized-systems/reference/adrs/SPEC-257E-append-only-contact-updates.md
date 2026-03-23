# SPEC-257E: Append-Only Contact Updates

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 5 of 7 |
| **Priority** | MEDIUM |
| **Status** | IMPLEMENTED |
| **Depends On** | SPEC-257B (buyer must be identified) |
| **Implemented** | 2026-03-23 |

---

## Objective

Ο buyer/owner/tenant μπορεί να **ΠΡΟΣΘΕΣΕΙ** νέα στοιχεία επικοινωνίας (τηλέφωνο, email, social media) αλλά **ΟΧΙ** να ΔΙΑΓΡΑΨΕΙ ή ΤΡΟΠΟΠΟΙΗΣΕΙ υπάρχοντα.

**Λογική**: Αποφυγή σεναρίου οφειλέτης αλλάζει τηλέφωνο → χάνεται επικοινωνία. Μόνο admin κάνει delete/edit.

## Architecture Decision: Dedicated Tool `append_contact_info`

Η `firestore_write` είναι **admin-only**. Αντί να ανοίξουμε generic write, dedicated tool που:

1. **ΟΧΙ contactId στα params** — server uses `ctx.contactMeta.contactId` (buyer edits ONLY own contact)
2. **Server-side validation** — `isValidPhone()` + `isValidEmail()` (SSoT validators ADR-212/ADR-209)
3. **Duplicate detection** — checks existing array by value before append
4. **Proper typed objects** — constructs `PhoneInfo`/`EmailInfo`/`SocialMediaInfo` with correct enums
5. **Audit trail** — via existing `auditWrite()` (mode: 'append')

## Implementation Details

### Tool Parameters (AI provides)
| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldType` | `'phone' \| 'email' \| 'social'` | Type of contact info |
| `value` | string | Phone number, email, or username/URL |
| `label` | string | Label: εργασία/σπίτι/κινητό (phone), εργασία/προσωπικό (email), platform name (social) |

### Label → Type Mapping (static readonly, defined ONCE in executor)
```
Phone: εργασία→work, σπίτι→home, κινητό→mobile, fax→fax, default→mobile
Email: εργασία→work, προσωπικό→personal, default→personal
Social: facebook, instagram, linkedin, twitter, youtube, github, default→other
```

### Entry Construction (server-side)
```typescript
// Phone
{ number: cleaned, type: 'mobile'|'work'|..., isPrimary: false }

// Email
{ email: normalized, type: 'personal'|'work'|'other', isPrimary: false }

// Social
{ platform: 'facebook'|..., username: value, url?: value (if valid URL) }
```

### Security
- `isPrimary: false` always — buyer cannot change primary contact
- Append-only: reads current array, appends new entry, writes full array back
- No `FieldValue.arrayUnion()` — manual dedup by value (arrayUnion uses deep equality on objects)

## Files Modified

| File | Action | Details |
|------|--------|---------|
| `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` | MODIFY | +`append_contact_info` tool definition |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | +switch case, +label maps (static readonly), +`executeAppendContactInfo()` |
| `src/config/ai-role-access-matrix.ts` | MODIFY | +`CONTACT_UPDATE_PROMPT` shared const, appended to 3 customer roles |

## Existing Functions Reused (ZERO duplication)

- `isValidPhone()` — `@/lib/validation/phone-validation` (SSoT ADR-212)
- `isValidEmail()` — `@/lib/validation/email-validation` (SSoT ADR-209)
- `isValidUrl()` — `@/lib/validation/email-validation`
- `this.auditWrite()` — executor audit method
- `PhoneInfo`, `EmailInfo`, `SocialMediaInfo` — `@/types/contacts/contracts`
- `COLLECTIONS.CONTACTS` — `firestore-collections.ts`

## Security Matrix

| Threat | Mitigation |
|--------|------------|
| Buyer updates another's contact | Server uses `ctx.contactMeta.contactId` — no AI input |
| Buyer deletes entries | Tool is APPEND-ONLY — read + append + write |
| Invalid phone/email | SSoT validators reject invalid format |
| Duplicate entries | Check by value (cleaned/normalized) before append |
| Buyer changes primary | `isPrimary: false` always — hardcoded |

## Acceptance Criteria

- [x] Buyer "πρόσθεσε 6974050025 ως εργασία" → appends to phones[]
- [x] Buyer "πρόσθεσε email test@gmail.com" → appends to emails[]
- [x] Buyer "πρόσθεσε instagram @myuser" → appends to socialMedia[]
- [x] Buyer ΔΕΝ μπορεί να αλλάξει υπάρχον τηλέφωνο (prompt says no)
- [x] Buyer ΔΕΝ μπορεί να αλλάξει στοιχεία ΑΛΛΟΥ contact (server enforces)
- [x] Duplicate phone → error "Το τηλέφωνο υπάρχει ήδη"
- [x] Invalid phone → error with format hint
