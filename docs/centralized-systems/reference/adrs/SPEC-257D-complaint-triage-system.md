# SPEC-257D: Complaint Triage System (AI Auto-Classification)

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 4 of 7 |
| **Priority** | MEDIUM |
| **Status** | IMPLEMENTED |
| **Depends On** | SPEC-257A (unit links for routing) |
| **Implemented** | 2026-03-23 |

---

## Objective

Ο buyer/owner/tenant αναφέρει πρόβλημα → AI κατηγοριοποιεί σοβαρότητα → δημιουργεί task → ειδοποιεί admin αν urgent.

## Architecture Decision: Dedicated Tool (not firestore_write)

Η `firestore_write` και `send_telegram_message` είναι **admin-only** (security). Αντί να ανοίξουμε generic write access σε non-admin ρόλους, δημιουργήσαμε ένα **dedicated tool** `create_complaint_task` που:

1. **Δεν απαιτεί admin** — ο buyer/owner/tenant μπορεί να το καλέσει
2. **Hardcoded collection** — γράφει ΜΟΝΟ στο `tasks` (ΟΧΙ παραμετρικό)
3. **Server derives context** — contactId, projectId, companyId από ctx (ΟΧΙ AI input)
4. **Unit validation** — unitId ∈ linkedUnitIds (security guard)
5. **Enterprise ID** — `generateTaskId()` (ΟΧΙ generic `generateEntityId()`)
6. **Server-side admin notification** — Telegram bypass χωρίς admin check exposure

## Implementation Details

### Severity Classification
| Severity | Keywords | CrmTask Priority |
|----------|----------|-----------------|
| `urgent` | υγρασία, πλημμύρα, ρωγμή, διαρροή, ηλεκτρολογικό, θέρμανση, ασανσέρ | `urgent` |
| `normal` | φθορά, υλικό, πόρτα, παράθυρο, βαφή | `high` |
| `low` | αισθητικό, γείτονας, θόρυβος, εκτός αρμοδιότητας | `low` |

### Task Data (server-side construction)
```typescript
{
  companyId: ctx.companyId,              // tenant isolation
  title: `Παράπονο: ${title}`,           // AI provides title
  description: string,                    // AI provides full text
  type: 'complaint',                      // hardcoded
  priority: 'urgent' | 'high' | 'low',   // mapped from severity
  status: 'pending',                      // hardcoded
  contactId: contact.contactId,           // from context
  unitId: string,                         // AI provides, server validates
  projectId: string | null,               // resolved from unit doc
  assignedTo: '',                         // admin assigns later
  metadata: {
    source: 'ai_complaint_triage',
    channel: ctx.channel,
    severity: string,
    reportedBy: contact.displayName,
  },
  createdAt / updatedAt: ISO string
}
```

### Admin Notification (urgent only)
- Server-side Telegram via `sendChannelReply()`
- Admin chatId from `super_admin_registry` (Firestore settings)
- Format: `🚨 ΕΠΕΙΓΟΝ ΠΑΡΑΠΟΝΟ\n📋 {title}\n👤 {name}\n🏠 Unit: {unitId}\n{desc}`
- Non-fatal: try/catch, task creation succeeds regardless

### Buyer Response (AI prompt)
- urgent: "✅ Καταγράφηκε ως ΕΠΕΙΓΟΝ. Θα ειδοποιηθεί αμέσως ο υπεύθυνος."
- normal/low: "✅ Λάβαμε το μήνυμά σας. Θα εξεταστεί σύντομα."

## Files Modified

| File | Action | Details |
|------|--------|---------|
| `src/types/crm.ts` | MODIFY | +`'complaint'` to CrmTask.type union |
| `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` | MODIFY | +`create_complaint_task` tool definition (strict mode) |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | +switch case, +`executeCreateComplaintTask()`, +`resolveAdminTelegramChatId()`, +TASKS to unitIdScopedCollections |
| `src/config/ai-role-access-matrix.ts` | MODIFY | +TASKS to CUSTOMER_COLLECTIONS, +complaint triage prompts (buyer/owner/tenant) |

## Existing Functions Reused (ZERO duplication)

- `generateTaskId()` — `enterprise-id.service.ts`
- `this.auditWrite()` — `agentic-tool-executor.ts`
- `sendChannelReply()` — `channel-reply-dispatcher.ts`
- `COLLECTIONS.TASKS`, `SYSTEM_DOCS.SUPER_ADMIN_REGISTRY` — `firestore-collections.ts`
- `getAdminFirestore()` — `firebaseAdmin.ts`

## Security Matrix

| Threat | Mitigation |
|--------|------------|
| Buyer writes to wrong collection | Hardcoded `COLLECTIONS.TASKS` |
| Buyer creates task for other's unit | `unitId ∈ linkedUnitIds` validation |
| AI hallucinates contactId/projectId | Server derives from `ctx.contactMeta` |
| Prompt injection → Telegram | `send_telegram_message` stays admin-only; notification is server-internal |
| Task spam | Pipeline rate limiting + unit link requirement |

## Acceptance Criteria

- [x] Buyer λέει "υγρασία στο μπάνιο" → task priority=urgent + admin ειδοποιείται via Telegram
- [x] Buyer λέει "μικρή φθορά στο πάτωμα" → task priority=high
- [x] Buyer λέει "ο γείτονας κάνει θόρυβο" → task priority=low
- [x] Buyer λαμβάνει επιβεβαίωση (severity-appropriate message)
- [x] Buyer μπορεί να δει τα δικά του tasks (unit-scoped read access)
- [x] Owner/tenant ίδια λειτουργικότητα
