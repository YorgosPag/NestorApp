# SPEC-259C: Silent Failure Recovery + E2E Test Plan

| Field | Value |
|-------|-------|
| **ADR** | ADR-259 (Production Readiness Audit) |
| **Phase** | 3 of 4 |
| **Priority** | HIGH — buyer UX + data correctness |
| **Status** | ✅ IMPLEMENTED |
| **Depends On** | Push commit 4628a57c (ADR-257 SPECs) |

---

## Objective

Εντοπισμός και αντιμετώπιση 5 σημείων silent failure στο AI pipeline, προσθήκη user-friendly error messages, βελτίωση FAILED_PRECONDITION handling, και πλήρες E2E test plan για buyer flow μέσω Telegram.

---

## Current State

### 5 Silent Failure Points

| # | Σημείο | Αρχείο:Lines | Τι γίνεται ΤΩΡΑ | Τι βλέπει ο buyer |
|---|--------|-------------|-----------------|-------------------|
| 1 | Contact resolution fails | `handler.ts:318-320` | Συνεχίζει ως unknown contact | Generic response, δεν αναγνωρίζεται |
| 2 | linkedUnitIds = [] | `agentic-tool-executor.ts:205-215` | enforceRoleAccess denies queries | ΤΙΠΟΤΑ — silent deny |
| 3 | FAILED_PRECONDITION | `agentic-tool-executor.ts:345-377` | Broad fallback (unfiltered data) | Πιθανά λάθος αποτελέσματα |
| 4 | Pipeline enqueue fails | `handler.ts:496-498` | Non-fatal, skip | Κανένα AI response |
| 5 | Firebase unavailable | `handler.ts:360-362` | Skip pipeline entirely | Κανένα AI response |

### Contact Linker Flow

**Αρχείο**: `src/services/contact-recognition/contact-linker.ts` (275 γραμμές)

```
resolveContactFromTelegram(userId, senderName)
  ↓ Query external_identities WHERE provider='telegram' AND externalUserId
  ↓ Αν δεν βρεθεί → heuristic name match (first 50 contacts)
  ↓ Αν βρεθεί contact → query contact_links WHERE sourceContactId AND status='active'
  ↓ Extract linkedUnitIds WHERE targetEntityType='unit'
  ↓ Return ResolvedContact { contactId, linkedUnitIds, projectRoles }
  ↓ Αν τίποτα δεν βρεθεί → return null
```

### FAILED_PRECONDITION Handling

**Αρχείο**: `src/services/ai-pipeline/tools/agentic-tool-executor.ts` (lines 345-377)

```typescript
// Τρέχουσα λογική:
if (errorMessage.includes('FAILED_PRECONDITION')) {
  // Broad fallback: only companyId filter, limit 50
  let broadQuery = db.collection(collection)
    .where('companyId', '==', companyId)
    .limit(50);
  // Return { success: true, data: results }
  // ❌ AI δεν ενημερώνεται ότι τα data είναι unfiltered
}
```

### Firestore Indexes

**Αρχείο**: `firestore.indexes.json`
- Existing: searchDocuments, admin_building_templates, buildings, contact_relationships
- ❌ Missing: Δεν γνωρίζουμε ποια μέχρι runtime E2E test

---

## Target State

- ✅ Silent failure #1: Buyer ενημερώνεται "Δεν σας αναγνωρίσαμε, παρακαλώ επικοινωνήστε..."
- ✅ Silent failure #2: Buyer με linkedUnitIds=[] → explicit message "Δεν έχετε συνδεδεμένες ιδιοκτησίες"
- ✅ Silent failure #3: AI ενημερώνεται "[FALLBACK: unfiltered results, may be incomplete]"
- ✅ Silent failure #4: Pipeline enqueue failure → retry once, then inform user
- ✅ Silent failure #5: Firebase unavailable → "Η υπηρεσία δεν είναι προσωρινά διαθέσιμη"
- ✅ FAILED_PRECONDITION → log index creation link + flag data as unfiltered
- ✅ Missing indexes identified via E2E test + auto-created
- ✅ Complete E2E test plan documented

---

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/app/api/communications/webhooks/telegram/handler.ts` | MODIFY | User-friendly messages for failures #1, #4, #5 |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | FAILED_PRECONDITION: flag unfiltered + log index link |
| `src/services/ai-pipeline/pipeline-orchestrator.ts` | MODIFY | Handle linkedUnitIds=[] → explicit message |
| `firestore.indexes.json` | MODIFY | Add missing indexes (discovered during E2E test) |

---

## Implementation Steps

### Step 1: Contact Not Recognized → User Message

**Αρχείο**: `handler.ts` (around line 318-320)

**Before**: Continues as unknown → generic processing
**After**: Send explicit message

```typescript
if (!resolvedContact) {
  // Send user-friendly message
  await sendTelegramReply(chatId,
    'Δεν σας αναγνωρίσαμε. Παρακαλώ επικοινωνήστε με το γραφείο μας ' +
    'για να συνδεθεί ο λογαριασμός σας Telegram.'
  );
  // Still enqueue to pipeline as unknown (for admin visibility)
}
```

### Step 2: Empty linkedUnitIds → Explicit Message

**Αρχείο**: `pipeline-orchestrator.ts` (in `executeAgenticPath`)

```typescript
// After contact resolution, before agentic loop:
if (!context.isAdmin && context.linkedUnitIds?.length === 0) {
  return {
    success: true,
    response: 'Δεν βρέθηκαν ιδιοκτησίες συνδεδεμένες με τον λογαριασμό σας. ' +
              'Παρακαλώ επικοινωνήστε με το γραφείο μας.',
    skipped: true,
    reason: 'no_linked_units',
  };
}
```

### Step 3: FAILED_PRECONDITION — Flag Unfiltered Data

**Αρχείο**: `agentic-tool-executor.ts` (lines 345-377)

**Before**: Returns `{ success: true, data: results }`
**After**:

```typescript
if (errorMessage.includes('FAILED_PRECONDITION')) {
  // Log index creation link (Firebase provides it in error)
  logger.warn('Missing Firestore index — fallback to broad query', {
    collection,
    originalFilters: filters,
    error: errorMessage,  // Contains auto-create link
  });

  const broadResults = await broadQuery.get();
  return {
    success: true,
    data: results,
    count: results.length,
    // ✅ Flag for AI awareness:
    warning: `[FALLBACK] Αποτελέσματα χωρίς πλήρες φιλτράρισμα — ` +
             `ενδέχεται ανακρίβεια. Χρειάζεται index: ${collection}`,
  };
}
```

### Step 4: Pipeline Enqueue Failure → Retry + Message

**Αρχείο**: `handler.ts` (around line 496-498)

```typescript
try {
  await feedTelegramToPipeline(message, text);
} catch (enqueueError) {
  // Retry once
  try {
    await feedTelegramToPipeline(message, text);
  } catch (retryError) {
    logger.error('Pipeline enqueue failed after retry', { error: retryError });
    await sendTelegramReply(chatId,
      'Λυπούμαστε, δεν μπορέσαμε να επεξεργαστούμε το μήνυμά σας. ' +
      'Παρακαλώ δοκιμάστε ξανά σε λίγο.'
    );
  }
}
```

### Step 5: Firebase Unavailable → Message

**Αρχείο**: `handler.ts` (around line 360-362)

```typescript
if (!isFirebaseAvailable()) {
  await sendTelegramReply(chatId,
    'Η υπηρεσία δεν είναι προσωρινά διαθέσιμη. Παρακαλώ δοκιμάστε ξανά αργότερα.'
  );
  return NextResponse.json({ ok: true });
}
```

---

## E2E Test Plan

### Prerequisites

1. Push commit `4628a57c` (ADR-257)
2. Start dev server: `npx next dev --port 3000`
3. Start ngrok: `C:\Nestor_Pagonis\ngrok-bin\ngrok.exe http 3000`
4. Set Telegram webhook: `https://api.telegram.org/bot{TOKEN}/setWebhook?url={NGROK_URL}/api/communications/webhooks/telegram`
5. Dev bot token: `8291786276:AAHDwgcf5VmY5MODnr7oym90B5sJE7ZEWLY`

### Test Data Setup

Στο Firestore, δημιούργησε:

**1. Test Contact** (collection: `contacts`)
```json
{
  "id": "cont_test_buyer_001",
  "firstName": "Test",
  "lastName": "Buyer",
  "companyId": "{your_company_id}",
  "personas": [{ "type": "buyer", "status": "active" }]
}
```

**2. External Identity** (collection: `external_identities`)
```json
{
  "provider": "telegram",
  "externalUserId": "{your_telegram_user_id}",
  "contactId": "cont_test_buyer_001"
}
```

**3. Contact Link** (collection: `contact_links`)
```json
{
  "id": "cl_cont_test_buyer_001_unit_{unit_id}_buyer",
  "sourceContactId": "cont_test_buyer_001",
  "targetEntityType": "unit",
  "targetEntityId": "{real_unit_id}",
  "role": "buyer",
  "status": "active",
  "companyId": "{your_company_id}"
}
```

### Test Cases

| # | Test | Αναμενόμενο αποτέλεσμα | Pass/Fail |
|---|------|----------------------|-----------|
| 1 | Στείλε "Γεια" ως buyer | Contact recognized, personalized greeting | |
| 2 | "Ποια είναι η ιδιοκτησία μου;" | Buyer βλέπει ΜΟΝΟ linked unit info | |
| 3 | "Δείξε μου τις πληρωμές μου" | remainingAmount, nextInstallment (SPEC-257C fields) | |
| 4 | "Θέλω να κάνω παράπονο" | Complaint triage (SPEC-257D) | |
| 5 | "Δείξε μου ΟΛΑ τα units" | Buyer βλέπει ΜΟΝΟ δικά του (ΟΧΙ άλλων) | |
| 6 | "Πληρωμές project Χ" | Blocked — buyer δεν έχει project-level access | |
| 7 | Στείλε από ΑΓΝΩΣΤΟ Telegram account | "Δεν σας αναγνωρίσαμε..." message | |
| 8 | Στείλε 51 μηνύματα (after SPEC-259A) | "Ξεπεράσατε το ημερήσιο όριο..." | |

### Index Discovery

Κατά τα tests, monitor Vercel logs:
- Κάθε `FAILED_PRECONDITION` → extract auto-create link
- Click link → Firebase console creates index
- Wait 2-5 min → re-test

---

## Verification

1. **Failure #1**: New Telegram account sends message → gets recognition failure message
2. **Failure #2**: Contact without contact_links sends message → gets "no properties" message
3. **Failure #3**: Trigger FAILED_PRECONDITION → AI response includes warning
4. **Failure #4**: Simulate enqueue failure → user gets retry/error message
5. **Failure #5**: Simulate Firebase down → user gets unavailable message
6. **E2E**: Full buyer flow works end-to-end

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-23 | SPEC created — pending implementation |
| 2026-03-24 | ✅ IMPLEMENTED — 5 silent failures fixed: (1) handler.ts: contact not recognized → explicit user message, (2) pipeline-orchestrator.ts: empty linkedUnitIds → early-exit with message before agentic loop, (3) agentic-tool-executor.ts: FAILED_PRECONDITION → `warning` field in ToolResult + full error logged with index link, (4) handler.ts: pipeline enqueue retry once + user notification on double failure, (5) handler.ts: Firebase unavailable → parse JSON first, send createDatabaseUnavailableResponse. i18n: +4 keys in el/en telegram.json. ToolResult interface: +warning field. agentic-loop.ts: warning propagation to AI messages. |
