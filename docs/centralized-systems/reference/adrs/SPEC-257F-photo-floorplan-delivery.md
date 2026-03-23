# SPEC-257F: Photo & Floorplan Delivery via AI

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 6 of 7 |
| **Priority** | MEDIUM |
| **Status** | PENDING |
| **Depends On** | SPEC-257B (unit-level scoping) |

---

## Objective

Ο AI στέλνει φωτογραφίες, κατόψεις, και έγγραφα ως συνημμένα στον buyer μέσω Telegram/Email/Messenger.

## Τι μπορεί να λάβει ο buyer (ADR-257 §2.8)

- Φωτογραφίες δικού unit
- Φωτογραφίες έργου (γενικές)
- Κάτοψη ορόφου unit
- Κάτοψη ορόφου αποθήκης (αν linked)
- Κάτοψη ορόφου parking (αν linked)
- Γενική κάτοψη έργου (site plan)
- Έγγραφα: ενεργειακό, κατόψεις, Συγγραφή Υποχρεώσεων, άδεια, τοπογραφικό, δικά συμβόλαια

## Channel Capabilities

| Κανάλι | Φωτογραφίες | PDF/Αρχεία | Όριο |
|--------|------------|------------|------|
| Telegram | ✅ | ✅ | 50MB |
| Email | ✅ | ✅ | Mailgun limits |
| Messenger | ✅ | ✅ | 25MB |
| Instagram | ✅ | ❌ | Μόνο εικόνες |

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` | MODIFY | Νέο tool: `send_file_to_chat` |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | Executor: fetch signed URL → send |
| `src/app/api/communications/webhooks/telegram/telegram/client.ts` | REUSE | `sendMessage()` with `messageType: 'photo'` / `'document'` |

## Implementation Steps

### Step 1: New tool definition

```typescript
{
  name: 'send_file_to_chat',
  description: 'Send a photo, floorplan, or document to the current chat. Fetches from Firebase Storage and sends via the active channel.',
  parameters: {
    fileType: 'photo|document|floorplan',
    storagePath: 'string (Firebase Storage path)',
    caption: 'string? (optional caption)',
  }
}
```

### Step 2: Executor — fetch signed URL + send per channel

```typescript
// 1. Get signed URL from Firebase Storage
const signedUrl = await getSignedUrl(storagePath);

// 2. Send based on channel
if (ctx.channel === 'telegram') {
  if (fileType === 'photo' || fileType === 'floorplan') {
    await telegramSendPhoto(ctx.telegramChatId, signedUrl, caption);
  } else {
    await telegramSendDocument(ctx.telegramChatId, signedUrl, caption);
  }
} else if (ctx.channel === 'email') {
  // Attach to email reply
}
```

### Step 3: AI knows where to find files

System prompt:
```
ΑΠΟΣΤΟΛΗ ΑΡΧΕΙΩΝ:
- Φωτογραφίες unit: αποθηκεύονται στο Firebase Storage path units/{unitId}/photos/
- Κατόψεις: floorplans collection → query by projectId + floorId → storagePath
- Έγγραφα: documents collection → query by unitId/projectId → storagePath
Χρησιμοποίησε: send_file_to_chat(fileType, storagePath, caption)
```

## Existing Functions to Reuse

- Telegram photo: `src/lib/communications/providers/telegram.ts:135-142` (`sendPhoto`)
- Firebase Storage signed URLs: MCP tool `storage_get_signed_url`
- Unit photos: `units.photoURL`, `units.multiplePhotoURLs`
- Floorplans: `COLLECTIONS.FLOORPLANS` (`src/config/firestore-collections.ts`)
- Documents: `COLLECTIONS.DOCUMENTS`

## Acceptance Criteria

- [ ] Buyer ρωτάει "δείξε μου φωτογραφίες του ακινήτου" → AI στέλνει photos
- [ ] Buyer ρωτάει "στείλε μου την κάτοψη" → AI στέλνει floorplan image
- [ ] Buyer ρωτάει "στείλε μου τη Συγγραφή Υποχρεώσεων" → AI στέλνει PDF
- [ ] Instagram: στέλνει μόνο εικόνες (ΟΧΙ PDF)
- [ ] Buyer ΔΕΝ λαμβάνει αρχεία ΑΛΛΟΥ unit
