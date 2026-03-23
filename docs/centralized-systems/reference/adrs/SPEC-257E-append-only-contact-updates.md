# SPEC-257E: Append-Only Contact Updates

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 5 of 7 |
| **Priority** | MEDIUM |
| **Status** | PENDING |
| **Depends On** | SPEC-257B (buyer must be identified) |

---

## Objective

Ο buyer μπορεί να ΠΡΟΣΘΕΣΕΙ νέα στοιχεία επικοινωνίας (τηλέφωνο, email, social) αλλά ΟΧΙ να ΔΙΑΓΡΑΨΕΙ ή ΤΡΟΠΟΠΟΙΗΣΕΙ υπάρχοντα.

## Λογική (Append-Only)

- Αποφυγή σεναρίου: οφειλέτης αλλάζει τηλέφωνο → χάνεται επικοινωνία
- Μόνο ο admin κάνει delete/edit
- Audit trail: κάθε προσθήκη καταγράφεται

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` | MODIFY | Νέο tool: `append_contact_info` |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | Executor για append (arrayUnion) |
| `src/config/ai-role-access-matrix.ts` | MODIFY | Buyer prompt: append instructions |
| `src/services/ai-pipeline/agentic-loop.ts` | MODIFY | System prompt: "μπορείς να προσθέσεις, ΟΧΙ να διαγράψεις" |

## Implementation Steps

### Step 1: New tool definition

```typescript
{
  name: 'append_contact_info',
  description: 'Append new contact info (phone, email, social) to a contact. APPEND ONLY — cannot delete or modify existing entries.',
  parameters: {
    contactId: 'string',
    fieldType: 'phone|email|social',
    value: 'string (phone number, email address, or social URL)',
    label: 'string? (optional label like "εργασία", "προσωπικό")',
  }
}
```

### Step 2: Executor implementation

```typescript
// Use Firestore arrayUnion — atomic append, no duplicates
const fieldMap = {
  phone: 'phones',
  email: 'emails',
  social: 'socialMedia',
};
const arrayField = fieldMap[fieldType];
const newEntry = { value, type: label ?? 'other', isPrimary: false };

await db.collection('contacts').doc(contactId).update({
  [arrayField]: FieldValue.arrayUnion(newEntry),
  updatedAt: new Date().toISOString(),
});
```

### Step 3: Security — Non-admin can ONLY append to OWN contact

```typescript
if (!ctx.isAdmin && ctx.contactMeta?.contactId !== contactId) {
  return { success: false, error: 'Μπορείτε να ενημερώσετε μόνο τα δικά σας στοιχεία.' };
}
```

### Step 4: Prompt guidance

```
ΕΝΗΜΕΡΩΣΗ ΣΤΟΙΧΕΙΩΝ ΕΠΙΚΟΙΝΩΝΙΑΣ:
Ο buyer μπορεί να ΠΡΟΣΘΕΣΕΙ νέο τηλέφωνο, email, ή social media.
ΔΕΝ μπορεί να ΔΙΑΓΡΑΨΕΙ ή να ΑΛΛΑΞΕΙ υπάρχοντα.
Χρησιμοποίησε: append_contact_info(contactId, fieldType, value, label)
```

## Existing Functions to Reuse

- `FieldValue.arrayUnion()` — Firestore atomic array append
- `COLLECTIONS.CONTACTS` — in write whitelist
- Contact schema: `phones[]`, `emails[]`, `socialMedia[]` arrays

## Acceptance Criteria

- [ ] Buyer λέει "πρόσθεσε το 6974050025 ως εργασία" → appends στο phones[]
- [ ] Buyer λέει "πρόσθεσε email test@gmail.com" → appends στο emails[]
- [ ] Buyer ΔΕΝ μπορεί να αλλάξει υπάρχον τηλέφωνο
- [ ] Buyer ΔΕΝ μπορεί να αλλάξει στοιχεία ΑΛΛΟΥ contact
- [ ] Admin μπορεί να κάνει ΟΛΑ (append + edit + delete)
