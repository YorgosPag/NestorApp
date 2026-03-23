# SPEC-257F: Photo & Floorplan Delivery via AI

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 6 of 7 |
| **Priority** | MEDIUM |
| **Status** | IMPLEMENTED |
| **Depends On** | SPEC-257B (unit-level scoping) |
| **Implemented** | 2026-03-23 |

---

## Objective

Ο AI στέλνει φωτογραφίες, κατόψεις, και έγγραφα ως συνημμένα στον buyer μέσω Telegram/Email/Messenger.

## Architecture Decision: Entity-Reference Pattern

**AI δεν βλέπει ποτέ raw URLs.** Ακολουθεί το ίδιο pattern με SPEC-257D/E:

```
AI: deliver_file_to_chat(sourceType: "unit_photo", sourceId: "<unitId>")
Server: validate unitId ∈ linkedUnitIds → fetch unit doc → get photoURL → send via channel
```

**3 source types (SSoT: `FILE_SOURCE_TYPES` in agentic-tool-definitions.ts):**

| sourceType | sourceId | URL πηγή | Validation |
|---|---|---|---|
| `unit_photo` | unitId | `unit.photoURL` / `unit.multiplePhotoURLs[]` | unitId ∈ linkedUnitIds |
| `file` | fileId | `fileRecord.downloadUrl` | entity ownership chain |
| `floorplan` | floorplanId | `floorplan.pdfImageUrl` / `downloadUrl` | projectId ∈ linked projects |

**DXF floorplans** (compressed scene JSON) → NOT sendable. Μόνο PDF floorplans.

## Τι μπορεί να λάβει ο buyer (ADR-257 §2.8)

- Φωτογραφίες δικού unit
- Φωτογραφίες έργου (γενικές)
- Κάτοψη ορόφου unit (PDF only — DXF not sendable)
- Κάτοψη ορόφου αποθήκης (αν linked)
- Κάτοψη ορόφου parking (αν linked)
- Γενική κάτοψη έργου (site plan)
- Έγγραφα: ενεργειακό, κατόψεις, Συγγραφή Υποχρεώσεων, άδεια, τοπογραφικό, δικά συμβόλαια

## Channel Capabilities

| Κανάλι | Φωτογραφίες | PDF/Αρχεία | Μέθοδος |
|--------|------------|------------|---------|
| Telegram | ✅ sendPhoto | ✅ sendDocument | Native Bot API |
| Email | ✅ attachment | ✅ attachment | Mailgun (fetch→Buffer→attach) |
| WhatsApp | ✅ text+link | ✅ text+link | Text fallback (Phase 1) |
| Messenger | ✅ text+link | ✅ text+link | Text fallback (Phase 1) |
| Instagram | ✅ text+link | ❌ error | Μόνο εικόνες |
| In-App | ✅ fileUrl | ✅ fileUrl | Voice command doc update |

## Files Modified

| File | Action | Details |
|------|--------|---------|
| `src/app/api/communications/webhooks/telegram/telegram/types.ts` | MODIFY | +photo, +document, +caption στο TelegramSendPayload |
| `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` | MODIFY | +FILE_SOURCE_TYPES SSoT const, +deliver_file_to_chat tool |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | +executeDeliverFileToChat() 3-mode entity resolver |
| `src/services/ai-pipeline/shared/channel-reply-dispatcher.ts` | MODIFY | +ChannelMediaReplyParams, +sendChannelMediaReply() |
| `src/config/ai-role-access-matrix.ts` | MODIFY | +FILE_DELIVERY_PROMPT, +FILES/FLOORPLANS στο CUSTOMER_COLLECTIONS |
| `docs/.../ADR-257-customer-ai-access-control.md` | MODIFY | +changelog entry |

## Security Flow

```
deliver_file_to_chat(sourceType, sourceId)
  │
  ├── ctx.contactMeta? → must be recognized
  ├── linkedUnitIds.length > 0? → must have units
  │
  ├── unit_photo: sourceId ∈ linkedUnitIds → fetch unit.photoURL
  ├── file: FileRecord.entityId belongs to accessible entity chain
  └── floorplan: floorplan.projectId ∈ linked projects
```

## SSoT Pattern

| SSoT | Location | Consumers |
|------|----------|-----------|
| `FILE_SOURCE_TYPES` | agentic-tool-definitions.ts | tool enum + executor validation |
| `FileSourceType` | agentic-tool-definitions.ts | executor type safety |
| `FILE_DELIVERY_PROMPT` | ai-role-access-matrix.ts | buyer/owner/tenant prompts |
| `CUSTOMER_COLLECTIONS` | ai-role-access-matrix.ts | RBAC collection gate |
| `PHOTO_CONTENT_TYPES` | agentic-tool-executor.ts | photo vs document detection |
| `ChannelMediaReplyParams` | channel-reply-dispatcher.ts | media dispatch |

## Existing Functions Reused

- `sendTelegramMessage()` — telegram/client.ts (generic API caller, supports method+payload)
- `sendReplyViaMailgun()` — mailgun-sender.ts (email with attachments)
- `sendChannelReply()` — channel-reply-dispatcher.ts (text fallback for WA/Messenger/IG)
- `getAdminFirestore()` — firebaseAdmin.ts (server-side Firestore)
- `COLLECTIONS.*` — firestore-collections.ts (collection names SSoT)
- `auditWrite()` — executor internal (audit trail)

## Acceptance Criteria

- [x] Buyer ρωτάει "δείξε μου φωτογραφίες του ακινήτου" → AI στέλνει photos
- [x] Buyer ρωτάει "στείλε μου την κάτοψη" → AI στέλνει floorplan image/PDF
- [x] Buyer ρωτάει "στείλε μου τη Συγγραφή Υποχρεώσεων" → AI στέλνει PDF
- [x] Instagram: PDF → error "δεν υποστηρίζεται"
- [x] Buyer ΔΕΝ λαμβάνει αρχεία ΑΛΛΟΥ unit
- [x] DXF floorplan → error "μόνο CAD μορφή"
- [x] Multiple unit photos → sent one-by-one with counter caption
