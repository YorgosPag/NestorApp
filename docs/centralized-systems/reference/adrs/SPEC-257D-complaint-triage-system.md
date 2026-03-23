# SPEC-257D: Complaint Triage System (AI Auto-Classification)

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 4 of 7 |
| **Priority** | MEDIUM |
| **Status** | PENDING |
| **Depends On** | SPEC-257A (unit links for routing) |

---

## Objective

Ο buyer αναφέρει πρόβλημα → AI κατηγοριοποιεί σοβαρότητα → δημιουργεί task → ειδοποιεί admin αν urgent.

## Implementation Steps

### Step 1: AI Intent Detection
Στο system prompt, πρόσθεσε:

```
ΠΑΡΑΠΟΝΑ/ΠΡΟΒΛΗΜΑΤΑ ΠΕΛΑΤΩΝ:
Αν ο χρήστης αναφέρει πρόβλημα στο ακίνητό του, κατηγοριοποίησε σοβαρότητα:
- URGENT: υγρασία, πλημμύρα, ρωγμή, διαρροή, ηλεκτρολογικό, θέρμανση χαλασμένη
- NORMAL: μικρό πρόβλημα, φθορά, ελαττωματικό υλικό
- LOW: αισθητικό, γείτονας, εκτός αρμοδιότητας
Δημιούργησε task: firestore_write("tasks", create, {
  title: "Παράπονο: [σύντομη περιγραφή]",
  description: "[πλήρες κείμενο buyer]",
  priority: "critical|high|low",
  status: "pending",
  contactId: "[buyer contactId]",
  unitId: "[linked unitId]",
  projectId: "[projectId]"
})
```

### Step 2: Admin Notification
- URGENT → task created + send_telegram_message στον admin
- NORMAL → task created (admin βλέπει στη λίστα)
- LOW → task created με priority "low"

### Step 3: Buyer Response
- "✅ Καταγράφηκε το πρόβλημά σας. Θα ενημερωθείτε σύντομα." (urgent)
- "✅ Λάβαμε το μήνυμά σας. Θα το εξετάσουμε." (normal/low)

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/config/ai-role-access-matrix.ts` | MODIFY | Buyer prompt: complaint handling instructions |
| `src/services/ai-pipeline/agentic-loop.ts` | MODIFY | System prompt: complaint triage rules |

## Existing Functions to Reuse

- `firestore_write("tasks", create, {...})` — ήδη λειτουργεί
- `send_telegram_message` — ήδη λειτουργεί
- Task schema: `src/config/firestore-schema-map.ts:225-237`
- `COLLECTIONS.TASKS` — write allowed

## Acceptance Criteria

- [ ] Buyer λέει "υγρασία στο μπάνιο" → task priority critical + admin ειδοποιείται
- [ ] Buyer λέει "μικρή φθορά στο πάτωμα" → task priority high
- [ ] Buyer λέει "ο γείτονας κάνει θόρυβο" → task priority low
- [ ] Buyer λαμβάνει επιβεβαίωση
