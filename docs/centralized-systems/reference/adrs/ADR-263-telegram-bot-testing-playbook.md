# ADR-263: Telegram Bot Testing Playbook

**Status**: ACTIVE
**Created**: 2026-03-25
**Category**: Testing & QA
**Author**: Claude Agent + Γιώργος Παγώνης

---

## Σκοπός

Πλήρες playbook για testing του AI Agent pipeline.
Δίνεται σε κάθε Claude agent ώστε να ξεκινά tests **αμέσως** χωρίς έρευνα.

---

## 0. Testing Strategy — ΥΠΟΧΡΕΩΤΙΚΗ ΣΕΙΡΑ ΕΚΤΕΛΕΣΗΣ

### ΦΑΣΗ 1: Automated Unit Tests (ΠΡΩΤΑ — ~5 δευτερόλεπτα)

Πριν αγγίξεις το Telegram bot, τρέξε **ΠΑΝΤΑ** τα automated tests:

```bash
cd C:/Nestor_Pagonis && npx jest --testPathPatterns="ai-pipeline/tools/__tests__" --no-cache
```

**5 test suites / 63 tests** — Google-level coverage:

| Test Suite | Tests | Καλύπτει |
|------------|-------|----------|
| `contact-handler.test.ts` | 15 | Contact CRUD, validation, duplicate detection |
| `firestore-handler.test.ts` | 17 | Query, get, count, write, search_text, whitelist |
| `esco-write-handler.test.ts` | 12 | ESCO occupation/skills, disambiguation, protection |
| `messaging-handler.test.ts` | 8 | Telegram/email reply, media, attachments |
| `executor.test.ts` | 11 | Tool routing, error handling, RBAC, rate limits |

**Τα tests αυτά δημιουργήθηκαν σε προηγούμενο session** (2026-03-25) ακολουθώντας Google testing standards:
- Mock Firestore (in-memory, deterministic)
- Company isolation (multi-tenant)
- Security canaries (F-006, F-007 whitelist enforcement)
- Edge cases (empty inputs, invalid data, ESCO protection)

**Αν ΟΠΟΙΟΔΗΠΟΤΕ test αποτύχει → ΣΤΑΜΑΤΑ. Μην πας στη Φάση 2.**
Διόρθωσε τον κώδικα πρώτα, κάνε re-run, μετά συνέχισε.

### ΦΑΣΗ 2: Telegram Bot E2E Tests (ΜΕΤΑ — ~2-5 λεπτά ανά test)

Αφού τα automated tests περνάνε, δοκίμασε τη **ζωντανή** pipeline μέσω Telegram webhook.
Αυτά τα tests ελέγχουν:
- AI reasoning (OpenAI gpt-4o-mini)
- Tool call ακρίβεια (σωστά args, σωστό tool)
- UX (μήνυμα στον χρήστη)
- End-to-end data flow (Telegram → Pipeline → Firestore → Telegram reply)

Μπορείς να χρησιμοποιήσεις **είτε** το Production bot **είτε** το Development bot.

---

## 1. Bot Credentials

### Production Bot
| Field | Value |
|-------|-------|
| **Bot Name** | Nestor_P_Bot |
| **Bot ID** | 8097088681 |
| **Token** | `8097088681:AAHasjfQQh6K3zUpxvcz7nolgwM72ODaFwE` |
| **Webhook URL** | `https://nestor-app.vercel.app/api/communications/webhooks/telegram` |
| **Webhook Secret** | `5BD3E52317ECFEAD9628A44C29D979A261309228D6558C1D0CECD25F16108428` |
| **Env Source** | Vercel env vars (pulled via `vercel env pull`) |

### Development Bot (localhost)
| Field | Value |
|-------|-------|
| **Token** | `8291786276:AAEkduYv24BzyW-6oBnL_LOG97s0e5Rwz8U` |
| **Webhook URL** | Needs ngrok or Vercel preview deploy |
| **Webhook Secret** | `nestor_webhook_secret_2025_secure_key` |
| **Env Source** | `.env` file |

### Super Admin (Γιώργος)
| Field | Value |
|-------|-------|
| **Telegram User ID** | `5618410820` |
| **Telegram Chat ID** | `5618410820` |
| **Pseudonym** | St€ F@no |
| **Company ID** | `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` |

---

## 2. Πώς Στέλνουμε Test Messages

### ΚΡΙΣΙΜΟ: Χρησιμοποίησε Node.js, ΟΧΙ curl
Windows curl κάνει garble τα ελληνικά. Πάντα Node.js:

```javascript
// === COPY-PASTE READY: Send message to production webhook ===
cd C:/Nestor_Pagonis && node -e "
const https = require('https');
function send(text, uid, mid) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      update_id: uid, message: {
        message_id: mid,
        from: {id:5618410820,is_bot:false,first_name:'St€ F@no',language_code:'el'},
        chat: {id:5618410820,first_name:'St€ F@no',type:'private'},
        date: Math.floor(Date.now()/1000), text
      }
    });
    const req = https.request({
      hostname:'nestor-app.vercel.app',
      path:'/api/communications/webhooks/telegram',
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Telegram-Bot-Api-Secret-Token':'5BD3E52317ECFEAD9628A44C29D979A261309228D6558C1D0CECD25F16108428',
        'Content-Length':Buffer.byteLength(payload)
      }
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); });
    req.on('error',reject); req.write(payload); req.end();
  });
}
// ΑΛΛΑΞΕ ΕΔΩ: text, update_id (αύξησε +1 κάθε φορά), message_id
send('ΤΟ ΜΗΝΥΜΑ ΕΔΩ', 900000001, 90001)
  .then(r => console.log('Response:', r));
"
```

### update_id Κανόνες
- **Πρέπει** να αυξάνεται κάθε φορά (Telegram απορρίπτει duplicates)
- Ξεκίνα από `900000001` και αύξανε +1 ανά μήνυμα
- Αν τα tests γίνονται σε νέο session, ξεκίνα από `900100001` (safe gap)

### Χρόνος Αναμονής
- Μετά κάθε webhook call: **18-20 seconds** wait
- Ο pipeline κάνει: enqueue → AI classify → tool calls → AI reply → Telegram send
- Αν δεν βλέπεις αποτέλεσμα, περίμενε 25-30 δεύτερα

---

## 3. Πώς Ελέγχουμε Αποτελέσματα

### A. Firestore MCP Tools (προτιμώμενο)
```
mcp__firestore__firestore_query:
  collection: "contacts"
  filters: [{"field": "companyId", "operator": "==", "value": "comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757"}]

mcp__firestore__firestore_get_document:
  collection: "contacts"
  documentId: "cont_XXXXX"

mcp__firestore__firestore_query:
  collection: "ai_chat_history"
  limit: 1
```

### B. Chat History — Πλήρης Ανάλυση
Το `ai_chat_history` document (`ach_telegram_5618410820`) περιέχει:
- `messages[].role` = "user" | "assistant"
- `messages[].content` = Τι είπε ο χρήστης / τι απάντησε ο AI
- `messages[].toolCalls[]` = Ποια tools κάλεσε ο AI, με τι args, τι result

**Αυτό είναι το πιο σημαντικό** — δείχνει τη σκέψη του AI, τα λάθη, τα retries.

---

## 4. Cleanup (Πριν / Μετά τα Tests)

### Διαγραφή μέσω Firebase Admin SDK
Το MCP δεν υποστηρίζει delete (`MCP_ALLOW_DELETE=false`). Χρησιμοποίησε:

```javascript
cd C:/Nestor_Pagonis && node -e "
const admin = require('firebase-admin');
const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
const sak = JSON.parse(match[1].replace(/^\"|\"$/g, ''));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sak) });
const db = admin.firestore();

async function cleanup() {
  // Διέγραψε contacts (αντικατέστησε τα IDs)
  await db.doc('contacts/cont_XXXXX').delete();
  console.log('Deleted contact');

  // Διέγραψε chat history (ΠΑΝΤΑ πριν νέο test session)
  await db.doc('ai_chat_history/ach_telegram_5618410820').delete();
  console.log('Deleted chat history');

  // Διέγραψε contact_links αν υπάρχουν
  const links = await db.collection('contact_links')
    .where('companyId', '==', 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757')
    .get();
  for (const doc of links.docs) {
    await doc.ref.delete();
    console.log('Deleted link:', doc.id);
  }
  console.log('CLEANUP DONE');
}
cleanup().catch(console.error);
"
```

---

## 5. Test Plan — Επίπεδα Δυσκολίας

### Επίπεδο 1: EASY (Βασική λειτουργικότητα)

| # | Test | Input Message | Expected Result | Verify |
|---|------|--------------|-----------------|--------|
| 1.1 | Δημιουργία επαφής | "Δημιούργησε νέα επαφή: Νίκος Παπαδόπουλος" | Contact created | `contacts` collection |
| 1.2 | Μονό πεδίο (φύλο) | "Ο Νίκος είναι άνδρας" | gender=male | contact doc |
| 1.3 | Μονό πεδίο (τηλέφωνο) | "Πρόσθεσε κινητό 6971234567 στον Νίκο" | phones array updated | contact doc |
| 1.4 | Μονό πεδίο (email) | "Email: nikos@example.com" | emails array updated | contact doc |
| 1.5 | Ημερομηνία γέννησης | "Γεννήθηκε 15 Μαρτίου 1990" | birthDate=15/03/1990 | contact doc |

### Επίπεδο 2: MEDIUM (Πολλαπλά πεδία + φυσική γλώσσα)

| # | Test | Input Message | Expected Result | Verify |
|---|------|--------------|-----------------|--------|
| 2.1 | Πολλαπλά basic | "Πατρώνυμο Κώστας, μητρώνυμο Μαρία, γεννήθηκε Ελλάδα" | 3 fields set | contact doc |
| 2.2 | Ταυτότητα πλήρης | "Ταυτότητα ΑΚ 582946, εκδόθηκε 10/01/2020, λήγει 10/01/2030, Αστυνομία Θεσσαλονίκης" | 5 identity fields | contact doc |
| 2.3 | Φορολογικά | "ΑΦΜ 123456789, ΔΟΥ Α Θεσσαλονίκης" | vatNumber + taxOffice | contact doc |
| 2.4 | ΑΜΚΑ validation | "ΑΜΚΑ 15039012345" (11ψ σωστό) | Αποθήκευση | contact doc |
| 2.5 | ΑΜΚΑ rejection | "ΑΜΚΑ 1234567890" (10ψ λάθος) | Απόρριψη | chat history |
| 2.6 | Διεύθυνση πλήρης | "Διεύθυνση: Τσιμισκή 42, Θεσσαλονίκη 54623" | addresses array | contact doc |
| 2.7 | Τηλέφωνο + email μαζί | "Κινητό 6988111222 και email test@test.gr" | phones + emails | contact doc |

### Επίπεδο 3: HARD (ESCO, NLP, Edge Cases)

| # | Test | Input Message | Expected Result | Verify |
|---|------|--------------|-----------------|--------|
| 3.1 | ESCO μονοσήμαντο | "Είναι αρχιτέκτονας τοπίου" | ESCO set directly | profession + escoUri |
| 3.2 | ESCO disambiguation | "Είναι μηχανικός" | AI ρωτάει "Ποιο μηχανικός;" | chat history |
| 3.3 | ESCO απάντηση | "Μηχανικός δομικών έργων" (μετά τη 3.2) | ESCO set | profession + iscoCode |
| 3.4 | Skill ESCO | "Πρόσθεσε δεξιότητα σχεδίαση CAD" | Skill search + save | contact skills |
| 3.5 | Skill free-text (F-003) | "Πρόσθεσε δεξιότητα σχεδιασμός κτιρίων" | Auto-save as free-text | contact skills |
| 3.6 | Γενική πτώση (F-005) | "Βάλε τηλέφωνο 6999888777 του Παπαδόπουλου" | Βρίσκει τον Νίκο | contact phones |
| 3.7 | documentNumber prefix (F-001) | "Ταυτότητα ΑΚ 582946" | documentNumber="ΑΚ 582946" | contact doc |
| 3.8 | Εργοδότης | "Δουλεύει ως Senior Engineer στην ΑΕΔΑΚ ΑΕ" | employer=ΑΕΔΑΚ ΑΕ | contact doc |

### Επίπεδο 4: EXPERT (Cross-entity, Multi-step)

| # | Test | Input Message | Expected Result | Verify |
|---|------|--------------|-----------------|--------|
| 4.1 | 2η επαφή | "Δημιούργησε: Ελένη Δημητρίου, 6977666555" | Contact + phone | contacts |
| 4.2 | Σχέση | "Η Ελένη είναι σύζυγος του Νίκου" | Graceful decline (no tool) | chat history |
| 4.3 | IBAN | "IBAN GR1601101250000000012300695 Εθνική Τράπεζα στον Νίκο" | Block (F-007 fix) | chat history |
| 4.4 | Αναζήτηση | "Πόσες επαφές έχω;" | count/list | chat history |
| 4.5 | Εταιρική επαφή | "Δημιούργησε εταιρεία: ΑΕΔΑΚ ΑΕ, ΑΦΜ 099876543" | type=company | contacts |

### Επίπεδο 5: STRESS (Ασυνήθιστα inputs)

| # | Test | Input Message | Expected Result | Verify |
|---|------|--------------|-----------------|--------|
| 5.1 | Greeklish | "Valta to tilefono 6912345678 ston Niko" | Βρίσκει + ενημερώνει | contact |
| 5.2 | Typo στο όνομα | "Αλεξανδρος" (χωρίς τόνο) | Βρίσκει Αλέξανδρος | chat history |
| 5.3 | Κενό input | "" (empty) | Graceful handling | webhook response |
| 5.4 | Πολύ μεγάλο μήνυμα | 500+ chars instruction | Handles properly | chat history |
| 5.5 | Ασχετο μήνυμα | "Τι καιρό κάνει σήμερα;" | Polite redirect | chat history |

---

## 6. Scoring & Αξιολόγηση

Κάθε test αξιολογείται σε 3 άξονες:

| Άξονας | ✅ PASS | ⚠️ PARTIAL | ❌ FAIL |
|--------|---------|-----------|---------|
| **Data** | Σωστά δεδομένα στο Firestore | Δεδομένα σωστά αλλά με retry | Λάθος ή missing data |
| **UX** | Σαφές μήνυμα στον χρήστη | Confusing μήνυμα αλλά λειτουργεί | Error μήνυμα ενώ πέτυχε |
| **Efficiency** | ≤3 tool calls | 4-6 tool calls ή 1 retry | 7+ calls ή hallucinated IDs |

### Severity Classification
- **P0 Critical**: Data corruption, security bypass, wrong data saved
- **P1 High**: Feature broken, user blocked
- **P2 Medium**: UX confusing, unnecessary retries, hallucinated IDs
- **P3 Low**: Minor wording issues, extra tool calls

---

## 7. Pipeline Architecture (Quick Reference)

```
User Message (Telegram)
  → Webhook: /api/communications/webhooks/telegram (POST)
  → validateSecretToken() [X-Telegram-Bot-Api-Secret-Token header]
  → handler.ts: processTelegramUpdate()
  → TelegramChannelAdapter.feedToPipeline()
  → enqueuePipelineItem() → ai_pipeline_queue collection
  → after() callback: processAIPipelineBatch()
  → pipeline-orchestrator.ts: executeAgenticPath()
  → agentic-loop.ts: Multi-step reasoning (max 5 iterations, 50s timeout)
  → Tool calls: create_contact, update_contact_field, search_text, etc.
  → AI generates response
  → sendChannelReply() → Telegram Bot API sendMessage
  → Chat history saved to ai_chat_history collection
```

### Key Firestore Collections
| Collection | Purpose |
|------------|---------|
| `contacts` | Contact data (test target) |
| `ai_chat_history` | Conversation log + tool calls |
| `ai_pipeline_queue` | Pipeline processing queue |
| `contact_links` | Relationships between contacts |
| `messages` | CRM message log |

---

## 8. Known Issues & Findings Log

| ID | Severity | Description | Status | Fix |
|----|----------|-------------|--------|-----|
| F-001 | P1 | documentNumber prefix stripped ("ΑΚ" removed) | ✅ FIXED | Tool description instruction |
| F-002 | P1 | ESCO disambiguation leak (auto-select without consent) | ✅ FIXED | System prompt scoping rule |
| F-003 | P2 | Skills free-text not auto-saved | ✅ FIXED | Auto-save instruction |
| F-004 | P0 | Phone/Email blocked for admin | ✅ FIXED | append_contact_info accepts contactId |
| F-005 | P2 | Search γενική πτώση ("Δημητρίου" not found) | ✅ FIXED | stripDiacritics + stemGreekWord |
| F-006 | P0 | firestore_write bypass to contact_links | ✅ FIXED | Removed from whitelist |
| F-007 | P0 | IBAN as flat field via firestore_write | ✅ FIXED | Block mode=update on contacts |
| FIND-A | P2 | Hallucinated contactId on 2nd message | ⏳ OPEN | AI uses wrong ID from memory |
| FIND-B | P2 | Error message shown despite success | ⏳ OPEN | UX inconsistency after retry |
| FIND-C | P3 | Unnecessary ESCO search for "Άνδρας" | ⏳ OPEN | AI confuses gender with occupation |

---

## 9. Changelog

| Date | Change |
|------|--------|
| 2026-03-25 | Initial version — credentials, test plan, findings |
