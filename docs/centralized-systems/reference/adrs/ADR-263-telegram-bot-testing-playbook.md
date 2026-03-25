# ADR-263: Telegram Bot Testing Playbook

**Status**: ACTIVE
**Created**: 2026-03-25
**Category**: Testing & QA
**Author**: Claude Agent + Γιώργος Παγώνης

---

## Σκοπός

Πλήρες playbook για testing του AI Agent pipeline.
Δίνεται σε κάθε Claude agent ώστε να ξεκινά tests **αμέσως** χωρίς έρευνα.

### ΚΑΘΟΛΙΚΟΣ ΚΑΝΟΝΑΣ
**Ο AI Agent πρέπει να χειρίζεται ΤΑ ΠΑΝΤΑ** — contacts, projects, buildings,
appointments, invoices, documents, communications — **από ΟΠΟΙΟΔΗΠΟΤΕ κανάλι**
(Telegram, Email, Web UI). Τα tests γίνονται μέσω Telegram bot αλλά ο στόχος
είναι η πλήρης αντικατάσταση γραμματειακής υποστήριξης:
- 100% γραφειοκρατική διαδικασία
- 100% επικοινωνία με πελάτες/προμηθευτές
- 100% data entry και διαχείριση CRM

**ΟΛΑ τα tests (automated + E2E) γίνονται με αυτή τη μέθοδο** σε κάθε τομέα
της εφαρμογής, όχι μόνο contacts.

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

### ΦΑΣΗ 2: Διόρθωση κώδικα (αν χρειάζεται)

Αν κάποιο automated test αποτύχει:
1. Διόρθωσε τον κώδικα
2. Re-run automated tests μέχρι 63/63 PASS
3. Commit τη διόρθωση
4. Push (αν ζητηθεί) ώστε να χτιστεί στο Vercel

### ΦΑΣΗ 3: Telegram Bot E2E Tests (~2-5 λεπτά ανά test)

Αφού τα automated tests περνάνε, δοκίμασε τη **ζωντανή** pipeline μέσω Telegram webhook.

**ΚΑΝΟΝΑΣ**: Τα E2E tests γίνονται **κυρίως μέσω dev bot + ngrok** (δωρεάν, άμεσο).
Production bot **μόνο για τελική επιβεβαίωση** μετά από batch fixes.

**Setup dev bot + ngrok:**
1. Ξεκίνα localhost: `cd C:/Nestor_Pagonis && npm run dev`
2. Ξεκίνα ngrok: `C:/Nestor_Pagonis/ngrok-bin/ngrok.exe http 3000`
3. Πάρε το ngrok URL (π.χ. `https://xxxx.ngrok-free.app`)
4. Set webhook: `curl "https://api.telegram.org/bot8291786276:AAEkduYv24BzyW-6oBnL_LOG97s0e5Rwz8U/setWebhook?url=https://xxxx.ngrok-free.app/api/communications/webhooks/telegram&secret_token=nestor_webhook_secret_2025_secure_key"`
5. Στέλνε messages με dev bot token + dev secret στο Node.js script

Αυτά τα tests ελέγχουν:
- AI reasoning (OpenAI gpt-4o-mini)
- Tool call ακρίβεια (σωστά args, σωστό tool)
- UX (μήνυμα στον χρήστη)
- End-to-end data flow (Telegram → Pipeline → Firestore → Telegram reply)

### ΦΑΣΗ 4: Καταγραφή ευρημάτων

Μετά τα Telegram tests, καταγράφεις τα ευρήματα στο αρχείο `docs/QA_AGENT_FINDINGS.md`:
- Νέα findings (bugs, UX issues, hallucinations)
- Severity classification (P0-P3)
- Ακριβές reproduction scenario

### ΦΑΣΗ 5: Επανάληψη κύκλου

```
Automated Tests → Fix Code → Re-test → Telegram E2E → Findings →
→ Fix Code → Νέα Automated Tests (αν χρειάζεται) → Re-test → ...
```

**ΕΜΠΛΟΥΤΙΣΜΟΣ**: Αν βρεθεί νέο bug στο Telegram E2E, **ΠΡΟΣΘΕΣΕ** automated test
που το καλύπτει (στα αντίστοιχα `*.test.ts` αρχεία), ώστε να μην ξαναεμφανιστεί.

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

### Telegram Notifications
Ο Γιώργος **δεν ενοχλείται** από τα test notifications στο Telegram.
Δεν χρειάζεται silent mode — τα replies στέλνονται κανονικά.

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

### Test Data Policy
Τα test data μπαίνουν κανονικά στη βάση χωρίς prefix — δεν χρειάζεται διαχωρισμός.
Cleanup γίνεται πριν/μετά κάθε test session μέσω Firebase Admin SDK.

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
| FIND-A | P2 | Hallucinated contactId on 2nd message | ✅ FIXED | Ενισχυμένος κανόνας: ΠΑΝΤΑ fresh search, ΠΟΤΕ ID από προηγούμενο μήνυμα |
| FIND-B | P2 | Error message shown despite success | ✅ FIXED | Prompt rule: τελική κατάσταση μόνο, όχι ενδιάμεσα errors |
| FIND-C | P3 | Unnecessary ESCO search for "Άνδρας" | ✅ FIXED | Prompt rule: άνδρας/γυναίκα = gender, ΟΧΙ ESCO search |
| FIND-D | P2 | Employer χάνεται μετά ESCO disambiguation | ✅ FIXED | Prompt rule: πολυμερείς εντολές — σημείωσε + ολοκλήρωσε μετά disambiguation |
| FIND-E | P1 | Disambiguation loop — AI δεν αναγνωρίζει αριθμό | ✅ FIXED | ESCO results injected στο chat context + prompt rule αναγνώρισης αριθμού |
| FIND-F | **P0** | **AI hallucination → data corruption** | ✅ **FIXED** | Anti-fabrication guardrail: server blocks phone/email not in user message + prompt rule |

---

## 9. Test Execution Log — Session 2026-03-25

### Αποτελέσματα E2E Tests (Production Bot)

| Test | Περιγραφή | Input | Result | Findings |
|------|-----------|-------|--------|----------|
| T1.1 | Δημιουργία επαφής | "Δημιούργησε νέα επαφή: Νίκος Παπαδόπουλος" | ✅ PASS | — |
| T1.2 | 4 basic fields (φύλο, γέννηση, πατρώνυμο, μητρώνυμο) | "Ο Νίκος είναι άνδρας, γεννήθηκε 15 Μαρτίου 1990..." | ✅ PASS | 1ο retry αρχικά hallucinated ID (FIND-A) |
| T1.3 | Τηλέφωνο | "Πρόσθεσε κινητό 6971234567 στον Νίκο" | ✅ PASS | — |
| T2.2 | Ταυτότητα (5 πεδία) | "Ταυτότητα ΑΚ 582946, εκδόθηκε 10/01/2020..." | ✅ PASS | **F-001 confirmed**: prefix "ΑΚ" διατηρήθηκε |
| T2.3 | ΑΦΜ + ΔΟΥ | "ΑΦΜ 123456789, ΔΟΥ Α Θεσσαλονίκης" | ✅ PASS | lookup_doy_code → 1301 σωστό |
| T3.6 | Γενική πτώση (F-005) | "Βάλε email nikos@example.com του Παπαδόπουλου" | ✅ PASS | **F-005 confirmed**: "Παπαδόπουλου" → found |
| T3.1 | ESCO disambiguation trigger | "Ο Νίκος είναι ηλεκτρολόγος μηχανικός" | ✅ PASS | Σωστά ρωτάει "Ποιο εννοείς;" (6 options) |
| T3.3 | Disambiguation answer | "Ηλεκτρολόγος μηχανικός (το 1)" + "1" | ❌ FAIL | FIND-E: AI ξαναψάχνει αντί να επιλέξει |
| T3.8 | Employer | (μέσα στο T3.1) "δουλεύει στην ΔΕΔΔΗΕ ΑΕ" | ❌ FAIL | FIND-D: Ξεχάστηκε λόγω ESCO |
| — | Hallucination check | (μετά disambiguation) | ❌ **P0 FAIL** | FIND-F: Ψεύτικο email+phone γράφτηκαν |

### Τι λειτουργεί σωστά:
- ✅ Create contact (T1.1)
- ✅ Basic fields: gender, birthDate, fatherName, motherName (T1.2)
- ✅ Phone append (T1.3)
- ✅ Identity: documentType, documentNumber (with prefix), issuer, dates (T2.2)
- ✅ Tax: vatNumber, taxOffice via lookup_doy_code (T2.3)
- ✅ Email append (T3.6)
- ✅ Greek genitive search — F-005 fix (T3.6)
- ✅ ESCO disambiguation trigger — F-002 fix (T3.1)

### Τι ΔΕΝ λειτουργεί (ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ):
1. **FIND-F (P0)**: AI hallucination → ψεύτικα data. ΚΡΙΣΙΜΟ — χρειάζεται guardrail
2. **FIND-E (P1)**: ESCO disambiguation loop — AI δεν αναγνωρίζει αριθμό επιλογής
3. **FIND-D (P2)**: Employer χάνεται σε multi-part εντολή με ESCO
4. **FIND-A (P2)**: Hallucinated contactId (AI χρησιμοποιεί λάθος ID)

### ΣΤΡΑΤΗΓΙΚΗ ΕΠΟΜΕΝΩΝ ΒΗΜΑΤΩΝ:
1. **Πρώτα**: Διόρθωσε κώδικα (FIND-F → FIND-E → FIND-D → FIND-A)
2. **Μετά**: Πρόσθεσε νέα automated tests που καλύπτουν τα findings
3. **Μετά**: Τρέξε automated tests (63+νέα) — πρέπει ALL PASS
4. **Μετά**: Κάνε push + build Vercel (ΜΙΑ ΦΟΡΑ, όχι πολλές)
5. **Μετά**: Ξανα-τρέξε E2E Telegram tests για confirmation
6. **Μετά**: Συνέχισε στα υπόλοιπα tests (Level 2-5)

### ΜΗ ΞΕΧΑΝΕΣΕ:
- **Push μόνο μετά από ολοκληρωμένο batch διορθώσεων** (max 5-6 builds/ημέρα)
- **Πρώτα automated tests, μετά Telegram** (Φάση 1 → Φάση 3 ροή)
- Ρώτα τον Γιώργο: "Production ή Development bot;" πριν κάθε E2E session

---

## 10. Roadmap — Υποδομή Testing

### ΦΑΣΗ A: Τώρα (πρώτο session)
| # | Τι | Effort | Status |
|---|----|--------|--------|
| A1 | **Automated E2E Runner** — script που τρέχει ΟΛΑ τα tests αυτόματα με snapshot assertions + response time tracking | 1-2 ώρες | ⏳ TODO |
| A2 | **Guardrail Tests** — negative cases, anti-hallucination, injection, cross-company isolation | 30 λεπτά | ⏳ TODO |
| A3 | **CI/CD GitHub Actions** — automated tests τρέχουν σε κάθε push (63 tests, ~6s, free tier OK) | 15 λεπτά | ⏳ TODO |
| A4 | **Fixes FIND-F/E/D/A** — code fixes για τα 4 open findings | 1-2 ώρες | ⏳ TODO |

### ΦΑΣΗ B: Πριν τους πραγματικούς πελάτες
| # | Τι | Effort | Status |
|---|----|--------|--------|
| B1 | **Separate Test Firebase Project** — ξεχωριστό project + service account ώστε tests να μην μολύνουν production data | 1-2 ώρες | ⏳ TODO |

### Γιατί αυτή η σειρά:
- **A1**: Μετατρέπει 30 λεπτά χειροκίνητα σε 5 λεπτά αυτόματα
- **A2**: Πιάνει hallucinations πριν γράψουν ψεύτικα data (FIND-F prevention)
- **A3**: Κάθε push ελέγχεται αυτόματα — zero cost (GitHub free tier 2000 min/month, tests ~6s)
- **A4**: Fixes βασισμένα σε πραγματικά test results
- **B1**: Αναβάλλεται γιατί η βάση είναι άδεια τώρα — γίνεται ΠΡΙΝ μπουν πελάτες

---

## 11. Changelog

| Date | Change |
|------|--------|
| 2026-03-25 | Initial version — credentials, test plan, 5-phase workflow |
| 2026-03-25 | Session 1 results: 7/10 tests PASS, 3 new findings (FIND-D/E/F) |
| 2026-03-25 | All 12 findings FIXED — anti-fabrication guardrail, ESCO context injection, prompt rules |
