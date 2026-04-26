# ADR-327: Quote Management & Comparison System (Hybrid Scan + Vendor Portal)

**Status**: ✅ APPROVED — All 20 Q&A answered (Giorgio, 2026-04-25). Ready for Phase 1a implementation.
**Date**: 2026-04-25
**Author**: Claude (Opus 4.7, Research Agents × 4)
**Related ADRs**:
- **ADR-267** Lightweight Procurement (PO) — closest sibling, explicitly excludes RFQ/quotes (gap this ADR fills)
- **ADR-175** BOQ / Quantity Surveying — ΑΤΟΕ codes used as universal join key
- **ADR-170** Attendance QR — HMAC-SHA256 token + tokenized public-write pattern (reuse for vendor portal)
- **ADR-ACC-005** AI Document Processing (OpenAI Vision) — pattern for `OpenAIQuoteAnalyzer`
- **ADR-315** Unified Sharing — token-based external delivery
- **ADR-264** Document Preview Mode — AI auto-analysis pipeline integration
- **ADR-070** Email & AI Ingestion — Mailgun/Resend infrastructure
- **ADR-121** Contact Personas — `SupplierPersona` extension target
- **ADR-017** Enterprise ID — `QT-NNNN` numbering
- **ADR-294** SSoT Ratchet — new modules registered

### Changelog
| Date | Changes |
|------|---------|
| 2026-04-25 | 📝 Initial draft based on 4 parallel research agents (ADR index + entities + AI pipeline + portal patterns). Awaiting Giorgio Q&A before approval. |
| 2026-04-25 | ✅ **Q&A EXTENDED** — Clarification Q21–Q27 (currency EUR only, soft-delete, vendor decline button, inline quick-add via ContactService SSoT, attachment policy 5img+1PDF 10MB, audit trail forever + GDPR anonymize, notification prefs extend ProcurementNotificationSettings). §17 updated. |
| 2026-04-25 | ✅ **APPROVED** — Όλες οι 20 ερωτήσεις του §13 απαντήθηκαν Q&A με Γιώργο (Σενάριο Γ σχεδόν παντού — Google-level + SSoT enforcement). Key decisions: hybrid RFQ model, hierarchical 32-trade taxonomy (8 groups, runtime-extensible), AI scan με per-field confidence + multilingual auto-detect, vendor portal με 3-day edit window + counter-offer (1 round), comparison templates ανά τύπο RFQ (Standard/Commodity/Specialty/Urgent), risk warnings + override-with-reason, multi-channel notifications με smart batching, configurable vendor reminders. **Phase plan**: 6 phases (P1a → P1b → P2 → P4 → P3 → P5), 1 phase = 1 session, deferred production rollout (Google-style incremental build, single cutover at end). Decision log §17 πλήρης. |

---

## 1. EXECUTIVE SUMMARY

Σήμερα οι **προσφορές** από προμηθευτές (μπετατζής, ελαιοχρωματιστής, πλακάς, τούβλας, μηχανολόγος, υδραυλικός κ.λπ.) μαζεύονται με χαρτί / WhatsApp / email / προφορικά. Δεν υπάρχει συστηματική σύγκριση, δεν υπάρχει αποθήκευση, δεν υπάρχει audit trail.

Το ADR-267 (Procurement) λύνει το **PO** (μετά την επιλογή προμηθευτή). Το **πριν** — η συλλογή και η σύγκριση των προσφορών — είναι κενό. Αυτό το ADR το γεμίζει.

**Τι χτίζουμε**:

1. **`Quote` entity** με 6-state FSM (`draft → sent_to_vendor → submitted_by_vendor → under_review → accepted → rejected/expired`).
2. **AI Scan** — φωτογραφία/PDF προσφοράς → `OpenAIQuoteAnalyzer` (mirror του `OpenAIDocumentAnalyzer` για λογιστικά) → δομημένα fields.
3. **Vendor Portal** — HMAC-signed link σταλμένο σε vendor (email / Telegram / WhatsApp / SMS) → public page → ο vendor καταχωρεί την προσφορά μόνος του.
4. **Comparison Engine** — auto-σύγκριση πολλαπλών προσφορών για το ίδιο BOQ/RFQ → multi-factor scoring → πρόταση «καλύτερης» στον υπεύθυνο.
5. **Decision Support** — ο PM βλέπει side-by-side σύγκριση, recommendation, δικαιολογία αν παρακάμψει την πρόταση.

**Hybrid model**: ο PM μπορεί να καταχωρεί χειροκίνητα, να φωτογραφίζει/σκανάρει χαρτί, ή να στέλνει link στον vendor — όλα καταλήγουν στην ίδια `Quote` οντότητα.

**Δεν περιλαμβάνεται** (out of scope):
- Tendering / e-auction (live bidding)
- Vendor account creation με password (μόνο tokenized portal)
- Αυτόματη υπογραφή σύμβασης (ADR-230 Contract Workflow)
- Πληρωμές (ADR-ACC-002 Invoicing)

---

## 2. CONTEXT — ΤΙ ΥΠΑΡΧΕΙ ΣΗΜΕΡΑ

### 2.1 Procurement (ADR-267 — κάλυψη μετά)

✅ **Υπάρχει**:
- `purchase_orders` collection με 6-state FSM
- `SupplierPersona` (`personaType: 'supplier'`) με `supplierCategory` (4 buckets: materials/equipment/subcontractor/services) + `paymentTermsDays`
- Supplier Comparison (SupplierComparisonTable) — αλλά **μόνο ιστορικά metrics** (on-time, lead-time, cancellation rate), όχι σύγκριση προσφορών
- `BOQItem.linkedContractorId` — modeled, UI όχι έτοιμο
- `PURCHASE_ORDER_COUNTERS` — atomic counter για `PO-NNNN`
- PO PDF + Email + Share Link (`po-share-service.ts`)

❌ **Λείπει**: `Quote` / `Offer` / `RFQ` collection, type, service. Καμία αναφορά στο codebase.

### 2.2 AI Document Extraction (ADR-ACC-005 — reuse)

✅ **Υπάρχει**:
- `OpenAIDocumentAnalyzer` ([src/subapps/accounting/services/external/openai-document-analyzer.ts:301](../../../../src/subapps/accounting/services/external/openai-document-analyzer.ts)) — `gpt-4o-mini`, two-phase (`classifyDocument` → `extractData`)
- Strict-mode JSON schemas (`EXPENSE_CLASSIFY_SCHEMA`, `EXPENSE_EXTRACT_SCHEMA`)
- Non-blocking processing pattern σε `accounting/documents/route.ts`
- PDF support via base64 `input_file` ([src/services/ai-pipeline/invoice-entity-extractor.ts:181](../../../../src/services/ai-pipeline/invoice-entity-extractor.ts))
- Cost: ~$0.0002/scan με `gpt-4o-mini`

✅ **Reusable verbatim**: prompt structure, schema pattern, fallback-first error handling, `IDocumentAnalyzer` interface.

### 2.3 Public/Tokenized Patterns

| Pattern | ADR | Token | Write? | Reuse |
|---------|-----|-------|--------|-------|
| Attendance QR | ADR-170 | HMAC-SHA256, daily rotation | ✅ Public POST | **Direct template** |
| Showcase | ADR-312/321 | Opaque ID + expiry | ❌ Read-only | Email delivery pattern |
| PO Share | ADR-267 | Opaque ID, 7-day | ❌ Read-only | Email pattern |

**Μόνο ADR-170** έχει tokenized **write** path. Το vendor portal είναι ο 2ος write-path use case.

### 2.4 Trade Taxonomy

❌ **Λείπει**:
- `SupplierCategory` έχει μόνο 4 generic τιμές (materials/equipment/subcontractor/services) → δεν διακρίνει μπετατζή από ελαιοχρωματιστή
- `construction_worker` persona έχει `specialtyCode` (ΕΦΚΑ ασφαλιστικός κωδικός) — αλλά αυτό αφορά εργαζομένους, όχι προμηθευτικές εταιρείες
- ΑΤΟΕ codes (BOQ) είναι work-package codes, όχι vendor specialty

---

## 3. DECISION DRIVERS

1. **Cost-saving via comparison** — ο PM δεν συγκρίνει σήμερα συστηματικά → χάνει χρήμα. Στόχος: «πάντα τουλάχιστον 3 προσφορές, αυτόματη σύγκριση».
2. **Reduce friction** — ο μπετατζής δεν θα κάνει ποτέ login με password. Πρέπει: φωτογραφία ή link.
3. **Single source of truth** — μία `Quote` οντότητα, ανεξάρτητα από κανάλι εισαγωγής (manual / scan / portal).
4. **Trade-aware** — να ξέρει το σύστημα ότι ζητάμε μπετόν ή χρώμα ή πλακάκια — όχι «services».
5. **Reuse over rebuild** — μέγιστη επανάχρηση από ADR-267 (FSM, share, contacts), ADR-ACC-005 (AI), ADR-170 (HMAC).
6. **Audit trail** — ποιος έδωσε ποιο price, πότε, από πού (IP/channel), τι άλλαξε.
7. **Decision support, not auto-decision** — η εφαρμογή **προτείνει**, ο PM **αποφασίζει**.

---

## 4. CONSIDERED OPTIONS

### Option A — Manual entry only
PM γράφει χειροκίνητα τις προσφορές, σύγκριση side-by-side.
- ✅ Απλό, γρήγορο για build
- ❌ Δεν μειώνει την κούραση του PM
- ❌ Δεν λύνει το «θέλω να φωτογραφίζω» / «θέλω link»

### Option B — AI scan only
Φωτογραφίες → AI extraction.
- ✅ Φεύγει το typing
- ❌ Όταν vendor είναι online (μηχανολόγος με email), forced χαρτί είναι παράλογο
- ❌ Δε λύνει το «δώσε link στον vendor»

### Option C — Vendor portal only
Όλοι μπαίνουν με link.
- ✅ Καθαρά δεδομένα από την πηγή
- ❌ Ο μπετατζής δε θα μπει σε portal — αλλά δίνει χαρτί
- ❌ Forced internet/literacy — αποκλείει trades

### **Option D — Hybrid (ΕΠΙΛΕΓΜΕΝΗ)** ✅
Όλα τα παραπάνω, μία οντότητα `Quote`.
- ✅ Ο PM επιλέγει κανάλι κατά case (paper photo / portal link / typed)
- ✅ Reuse όλων των υπαρχόντων: PO FSM, AI analyzer, HMAC tokens
- ✅ Comparison engine αγνωστος για το κανάλι
- ⚠️ Πιο μεγάλο scope → χρειάζεται phasing (5 φάσεις)

---

## 5. DECISION

**Hybrid Quote Management & Comparison System**, χτισμένο σε 5 phases, με κάθε phase να παραδίδει αυτόνομη αξία.

### 5.1 Domain Model

```
RFQ (Request For Quotation)
 ├─ id: rfq_<nanoid>
 ├─ projectId
 ├─ buildingId? / boqItemIds[]?     ← link σε BOQ items (ΑΤΟΕ codes)
 ├─ trade: TradeCode                  ← μπετατζής/ελαιοχρωματιστής/...
 ├─ description, deadlineDate
 ├─ status: draft | active | closed
 ├─ invitedVendors: VendorInvite[]    ← contacts + token + delivery channel
 └─ winnerQuoteId?                    ← τελική επιλογή

Quote (1 RFQ → N Quotes, 1 ad-hoc Quote without RFQ)
 ├─ id: qt_<nanoid>           (display: QT-NNNN από counter)
 ├─ rfqId? (optional — ad-hoc quotes χωρίς RFQ)
 ├─ projectId, buildingId?
 ├─ vendorContactId           ← reference to contacts (SupplierPersona)
 ├─ trade: TradeCode
 ├─ source: 'manual' | 'scan' | 'portal' | 'email_inbox'
 ├─ status: draft | sent_to_vendor | submitted | under_review | accepted | rejected | expired
 ├─ lines: QuoteLine[]
 ├─ totals: { subtotal, vat, total, vatRate }
 ├─ validUntil: Date
 ├─ paymentTerms, deliveryTerms, warranty
 ├─ attachments: { fileUrl, fileType }[]    ← original photo/PDF
 ├─ extractedData?: ExtractedQuoteData      ← AI raw output
 ├─ confidence?: number                      ← AI confidence score
 ├─ submittedAt, submitterIp(hashed), source channel metadata
 └─ auditTrail: AuditEntry[]

QuoteLine
 ├─ description
 ├─ categoryCode: ATOECode?    ← UNIVERSAL JOIN με BOQ + PO
 ├─ quantity, unit
 ├─ unitPrice, vatRate, lineTotal
 └─ notes

QuoteComparison (computed view, not stored or denormalized cache)
 ├─ rfqId | adhocGroupId
 ├─ quotes[]
 ├─ scoring: { quoteId, totalScore, breakdown: { price, supplierMetrics, terms } }[]
 └─ recommendation: { quoteId, reason, weights }

VendorInvite
 ├─ id, rfqId, vendorContactId
 ├─ token (HMAC-signed)
 ├─ deliveryChannel: 'email' | 'telegram' | 'sms' | 'whatsapp'
 ├─ deliveredAt, openedAt, submittedAt
 ├─ expiresAt
 └─ status: sent | opened | submitted | expired

Trade (SSoT registry)
 ├─ code: 'concrete' | 'painting' | 'tiling' | ...
 ├─ labelEl, labelEn
 ├─ relatedAtoeCategories: ATOECode[]    ← για auto-mapping line items
 └─ defaultUnits: Unit[]
```

### 5.2 Firestore Collections (νέες)

| Collection | Purpose | Write access |
|------------|---------|--------------|
| `rfqs` | RFQ records | Authenticated (admin/PM) |
| `quotes` | Quote entities | Authenticated **OR** Admin SDK (vendor portal) |
| `quote_counters` | Atomic `QT-NNNN` counter (per company) | Admin SDK only |
| `vendor_invites` | Tokenized invites | Admin SDK only |
| `vendor_invite_tokens` | HMAC validation cache (TTL) | Admin SDK only |
| `trades` | Trade taxonomy SSoT | Admin SDK only |

### 5.3 Architecture Layers

```
┌────────────────────────────────────────────────────────────┐
│ UI                                                         │
│ ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│ │ Quotes List  │ │ RFQ Builder  │ │ Comparison Panel    │ │
│ │ + Quick Add  │ │ + Send Links │ │ + Recommendation    │ │
│ └──────────────┘ └──────────────┘ └─────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Vendor Portal (/vendor/quote/[token])                │  │
│ │ — public, mobile-first, no auth                       │  │
│ └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
       │                                          │
       │ withAuth (admin)                         │ HMAC validation
       ▼                                          ▼
┌────────────────────────────────────────────────────────────┐
│ API Routes                                                 │
│ /api/quotes (list/create/update)                           │
│ /api/quotes/scan (upload+extract)                          │
│ /api/rfqs (create/send)                                    │
│ /api/rfqs/[id]/invite-vendors                              │
│ /api/quotes/comparison/[rfqId]                             │
│ /api/quotes/[id]/accept | /reject                          │
│ /api/vendor/quote/[token]   ← public POST (HMAC)           │
└────────────────────────────────────────────────────────────┘
       │                                          │
       ▼                                          ▼
┌────────────────────────────────────────────────────────────┐
│ Services                                                   │
│ - QuoteService           (CRUD, FSM transitions)           │
│ - QuoteAnalyzerService   (OpenAI Vision wrapper)           │
│ - QuoteComparisonService (multi-factor scoring)            │
│ - RfqService             (RFQ lifecycle)                   │
│ - VendorInviteService    (HMAC tokens, channel delivery)   │
│ - VendorPortalService    (token validation, public submit) │
│ - TradeRegistry          (SSoT for trades)                 │
└────────────────────────────────────────────────────────────┘
       │                                          │
       ▼                                          ▼
┌────────────────────────────────────────────────────────────┐
│ Persistence                                                │
│ Firestore (Admin SDK only για vendor writes)               │
│ Firebase Storage (signed upload URLs για vendor uploads)   │
└────────────────────────────────────────────────────────────┘
```

---

## 6. AI EXTRACTION STRATEGY (Phase 2)

### 6.1 Reuse path

- Νέο αρχείο: `src/subapps/procurement/services/external/openai-quote-analyzer.ts`
- Mirror `OpenAIDocumentAnalyzer` (accounting), επανάχρηση factory `createOpenAIDocumentAnalyzer()` env-vars
- 2 νέα strict schemas:
  - `QUOTE_CLASSIFY_SCHEMA` — distinguishes `vendor_quote | price_list | invoice | other`
  - `QUOTE_EXTRACT_SCHEMA` — fields:
    - `vendorName`, `vendorVAT`, `vendorPhone`, `vendorEmail`
    - `quoteDate`, `validUntil`, `quoteReference`
    - `lineItems[]`: `{description, quantity, unit, unitPrice, vatRate, lineTotal}`
    - `subtotal`, `vatAmount`, `totalAmount`, `currency`
    - `paymentTerms`, `deliveryTerms`, `warranty`, `notes`
    - `confidence` per field
    - `tradeHint` (AI guess: μπετατζής/ελαιοχρωματιστής/...)

### 6.2 Flow

```
1. User uploads photo/PDF → /api/quotes/scan
2. Server: save to Firebase Storage, create quote με status='processing'
3. Non-blocking: call OpenAIQuoteAnalyzer.classify() → discard if not 'vendor_quote'
4. OpenAIQuoteAnalyzer.extract() → ExtractedQuoteData
5. Auto-suggest: vendorContactId (fuzzy match σε contacts), trade (από tradeHint)
6. Update quote status='draft', set extractedData + confidence
7. UI: review screen με highlighted low-confidence fields
8. PM accepts → status='under_review' (έτοιμο για comparison)
```

### 6.3 Constraints
- `gpt-4o-mini`, timeout 45s (paper photos μεγαλύτερα), max 2 retries
- Έλληνικά prompts (όλα τα paper quotes είναι ελληνικά)
- Fallback-first: αν αποτύχει το AI, status='draft' με empty extractedData → PM μπαίνει χειροκίνητα
- Cost target: <$0.001/scan

---

## 7. VENDOR PORTAL STRATEGY (Phase 3)

### 7.1 Token

Mirror ADR-170 attendance:
```
Token format: base64url({rfqId}:{vendorContactId}:{nonce}:{expiry}:{hmac})
HMAC: SHA-256, secret = VENDOR_PORTAL_SECRET (νέο env var)
Expiry: configurable per RFQ (default 7 days), stored in Firestore
Single-use option: nonce blacklisted στο Firestore μετά την υποβολή
```

### 7.2 Delivery Channels

Σταδιακά (priority order):
1. **Email** (Mailgun/Resend — υπάρχει υποδομή ADR-070)
2. **Telegram** (αν ο vendor έχει chatId στο contact record — extend `sendTelegramAlert` pattern)
3. **WhatsApp** (μέσω Twilio API — νέο integration, Phase 3.b)
4. **SMS** (Twilio — νέο, Phase 3.c)
5. **Copy link** (manual paste — fallback, διαθέσιμο πάντα)

### 7.3 Vendor Portal Flow

```
Vendor κλικ link → /vendor/quote/[token] (Server Component, no auth)
   ↓
Token validation (HMAC + Firestore active check)
   ↓
Render VendorQuoteForm (mobile-first)
  ├─ Pre-filled vendor info από contact
  ├─ RFQ details (project, deliverables, deadline)
  ├─ Inline line-items entry (add/remove)
  ├─ Photo attachment (signed URL upload — Storage rules require auth, so server generates signed URL)
  └─ Submit button
   ↓
POST /api/vendor/quote/[token]
   ↓
Re-validate HMAC + Firestore active check + nonce
   ↓
Admin SDK write: quotes/{id} με source='portal', submittedAt, submitterIp(hashed)
   ↓
Mark token as used, send confirmation email
   ↓
Notify PM (in-app + Telegram)
```

### 7.4 Security
- HMAC validation πρώτα (no DB hit για bad tokens)
- Rate limit: `withHeavyRateLimit` (10 req/min) keyed σε hashed IP
- Storage uploads μέσω server-generated signed URL (μέγιστο 5 αρχεία × 10MB)
- Firestore rules: `allow create: if false` σε `quotes` (Admin SDK only)
- Audit: `submittedAt`, `submitterIp` (hashed), `userAgent`, `editHistory[]`
- CSRF: token-bound (το token είναι το credential)

---

## 8. COMPARISON ENGINE (Phase 4)

### 8.1 Multi-Factor Scoring

Για κάθε `Quote` μέσα σε ένα RFQ (ή ad-hoc group):

```typescript
score = (priceScore × W_price) +
        (supplierScore × W_supplier) +
        (termsScore × W_terms) +
        (deliveryScore × W_delivery)

W_price + W_supplier + W_terms + W_delivery = 1.0
default weights: 0.5 / 0.25 / 0.15 / 0.10
```

| Factor | Calculation | Source |
|--------|-------------|--------|
| `priceScore` | `1 - (quote.total - minTotal) / (maxTotal - minTotal)` | Quote totals, normalized |
| `supplierScore` | weighted on-time%, cancellation%, prior PO history | `SupplierMetrics` (ADR-267) |
| `termsScore` | bonus για longer payment terms, bonus για warranty | `paymentTermsDays`, `warranty` |
| `deliveryScore` | bonus για earlier delivery / sooner availability | `deliveryTerms` parsing |

Recommendation = highest weighted score.

### 8.2 Per-Line vs Total Comparison

Δύο modes:
- **Total mode** (default) — ολόκληρη η προσφορά συγκρίνεται
- **Per-line mode** — αν όλες οι προσφορές χρησιμοποιούν ΑΤΟΕ codes, σύγκριση γραμμή-γραμμή (cherry-pick best per line — useful για mixed-trade RFQs)

### 8.3 Override

PM μπορεί να επιλέξει non-recommended quote → υποχρεωτικό **πεδίο αιτιολόγησης** → καταγράφεται στο audit trail. Παράδειγμα: «Ο vendor X είναι αξιόπιστος για urgent jobs παρότι είναι 5% πιο ακριβός».

### 8.4 Output

```typescript
interface QuoteComparisonResult {
  rfqId: string;
  quoteCount: number;
  quotes: Array<{
    quoteId: string;
    vendorName: string;
    total: number;
    score: number;
    breakdown: { price: number; supplier: number; terms: number; delivery: number };
    rank: number;        // 1 = best
    flags: string[];     // ['cheapest', 'most-reliable', 'fastest-delivery', ...]
  }>;
  recommendation: {
    quoteId: string;
    reason: string;     // human-readable, generated από breakdown
    confidence: number; // delta σε score από #2 (αν >5% σαφής νικητής)
  };
}
```

---

## 9. TRADE TAXONOMY

### 9.1 Decision: New `trades` SSoT registry

Δεν επεκτείνουμε `SupplierCategory` (έχει legacy χρήση σε PO comparison). Δημιουργούμε νέο SSoT.

### 9.2 Initial trades (configurable)

| Code | Greek | English |
|------|-------|---------|
| `concrete` | Μπετόν / Μπετατζής | Concrete |
| `painting` | Ελαιοχρωματισμοί | Painting |
| `tiling` | Πλακάδικα | Tiling |
| `masonry` | Τοιχοποιία (Τούβλα) | Masonry |
| `plumbing` | Υδραυλικά | Plumbing |
| `electrical` | Ηλεκτρολογικά | Electrical |
| `hvac` | Μηχανολογικά (HVAC) | Mechanical/HVAC |
| `gypsum` | Γυψοκαρτές / Γυψοσανίδες | Drywall |
| `insulation` | Μονώσεις | Insulation |
| `aluminum` | Αλουμίνια / Κουφώματα | Aluminum/Frames |
| `woodwork` | Ξυλουργικά | Woodwork |
| `marble` | Μάρμαρα | Marble |
| `roofing` | Στέγη / Κεραμοσκεπή | Roofing |
| `landscaping` | Διαμόρφωση εξωτερικών χώρων | Landscaping |
| `materials_general` | Υλικά (γενικά) | General materials |
| `equipment_rental` | Ενοικίαση εξοπλισμού | Equipment rental |

Each trade έχει `relatedAtoeCategories[]` για να auto-suggest BOQ items όταν δημιουργεί RFQ.

### 9.3 Συσχέτιση με `SupplierPersona`

Νέο πεδίο στο `SupplierPersona`:
```typescript
tradeSpecialties: TradeCode[]    // multi-select, vendor μπορεί να κάνει ≥1 trade
```

Backward-compatible: legacy `supplierCategory` παραμένει — μπορεί να γίνει deprecated αργότερα.

---

## 10. PHASING

| Phase | Scope | Effort | Suggested Model | Dependencies |
|-------|-------|--------|-----------------|--------------|
| **P1 — Foundation** | Domain types, Firestore collections, `QuoteService` CRUD, `RfqService` CRUD, manual entry UI, basic side-by-side view, Trade SSoT | ~3-4 days | Sonnet 4.6 | None |
| **P2 — AI Scan** | `OpenAIQuoteAnalyzer`, `/api/quotes/scan`, review UI με confidence, vendor fuzzy-match | ~2-3 days | Sonnet 4.6 | P1 |
| **P3 — Vendor Portal** | HMAC tokens, `/vendor/quote/[token]` page, public POST, signed-URL upload, email/Telegram delivery | ~3-4 days | Opus 4.7 | P1 |
| **P4 — Comparison Engine** | Multi-factor scoring, recommendation, override-with-reason, audit | ~2-3 days | Opus 4.7 | P1 + at least P2 OR P3 |
| **P5 — BOQ Integration** | RFQ-from-BOQ flow, ΑΤΟΕ auto-mapping, per-line comparison, winner→PO conversion | ~2 days | Sonnet 4.6 | ADR-267, P1, P4 |

**Total**: ~12-16 ημέρες (μία προσπάθεια). Suggested order: P1 → P2 → P4 → P3 → P5 (vendor portal τελευταίο γιατί έχει το πιο πολύπλοκο security surface).

---

## 11. SECURITY & COMPLIANCE

| Concern | Mitigation |
|---------|-----------|
| Vendor data tampering | Firestore rules: `allow create/update: if false` σε `quotes` για non-admin contexts. Vendor writes go through `/api/vendor/quote/[token]` με Admin SDK only |
| Token leakage | HMAC με secret server-side, single-use option, expiry, rate limit per token |
| File upload abuse | Signed upload URL με max size (10MB) + content-type whitelist, scoped to specific quote draft |
| PII στο audit trail | IP hashing (existing pattern from rate-limit), όχι full IP storage |
| Tenant isolation | `companyId` mandatory σε όλα τα queries (CHECK 3.10 του pre-commit hook) |
| Vendor portal phishing | Email content με clear company branding + warning «Never share this link» |
| Audit immutability | `auditTrail[]` append-only, server-side enforcement (validation στο service layer) |

---

## 12. CONSEQUENCES

### Positive
- ✅ Συστηματική σύγκριση → cost saving (estimated 5-15% per project σε προσφορές που σήμερα δε συγκρίνονται)
- ✅ Audit trail πλήρης (vendor, date, amount, channel) → απαντητικότητα σε διαφωνίες
- ✅ Vendor relationship data μπαίνει στο σύστημα → καλύτερο SupplierMetrics μακροπρόθεσμα
- ✅ Quote→PO conversion (P5) χωρίς re-typing
- ✅ Reuse: ~70% του κώδικα είναι patterns από ADR-170/267/ACC-005

### Negative / Cost
- ⚠️ +6 collections στο Firestore (rules complexity)
- ⚠️ Vendor portal: επιπλέον security surface (HMAC, public POST)
- ⚠️ AI cost ~$0.001/quote × N scans/μήνα (negligible αλλά υπαρκτό)
- ⚠️ +1 secret στο env (`VENDOR_PORTAL_SECRET`)
- ⚠️ Phase 3 (portal) έχει χρόνο σε integration testing (HMAC + signed URL + multi-channel delivery)
- ⚠️ Trade taxonomy χρειάζεται maintenance (νέα trades, αλλαγές labels)

### Risks
- 🔴 AI extraction accuracy χαμηλή σε χειρόγραφες προσφορές → mitigation: PM review screen, low-confidence highlighting, fallback to manual
- 🟡 Vendor portal adoption από μπετατζήδες χαμηλή (digital literacy) → mitigation: hybrid model, paper-photo path πάντα διαθέσιμο
- 🟡 Comparison weighting controversial → mitigation: defaults + per-RFQ override, not enforced

---

## 13. OPEN QUESTIONS — ΓΙΑ ΣΥΖΗΤΗΣΗ ΜΕ ΤΟΝ ΓΙΩΡΓΟ

Πριν την έγκριση και υλοποίηση, χρειάζονται αποφάσεις στα παρακάτω:

### Σχετικά με το μοντέλο
1. **RFQ vs ad-hoc Quote**: θέλεις πάντα να δημιουργείς RFQ πρώτα και μετά να μαζεύεις προσφορές, ή να επιτρέπω και «έπεσε προσφορά τυχαία, καταχώρισέ τη χωρίς RFQ»;
2. **1 RFQ → 1 trade ή multi-trade**: ένα RFQ είναι μόνο για μπετόν, ή μπορεί να καλύπτει πολλά trades (π.χ. «όλο το έργο»);
3. **Vendor διαφορετικό από supplier persona**: θέλεις να δημιουργώ ξεχωριστό `Vendor` entity ή να συνεχίζω με `SupplierPersona` σε `contacts`;

### Σχετικά με την AI
4. **AI scope**: μόνο βασικά πεδία (vendor, totals, lines), ή και terms, validity, warranty, payment terms;
5. **Multi-language scan**: μόνο ελληνικά paper quotes ή και ξενόγλωσσα;
6. **Auto-accept threshold**: αν AI confidence > 95%, αυτόματο `under_review` ή πάντα PM review;

### Σχετικά με το vendor portal
7. **Channels priority**: Email πρώτα είναι σαφές. Telegram/WhatsApp/SMS — τι σειρά;
8. **Vendor login persistence**: όταν ο vendor υποβάλει 1 φορά, να κρατάμε «remember device» 30 μέρες ώστε να μην ξανακάνει validation;
9. **Vendor counter-offer**: μπορεί ο vendor να ξαναυποβάλει νέα προσφορά μετά την πρώτη (revision), ή κάθε link = 1 submission;
10. **Public language**: το vendor portal Ελληνικά μόνο, ή multi-language;

### Σχετικά με comparison
11. **Default weights**: 0.5/0.25/0.15/0.10 (price/supplier/terms/delivery) είναι λογικό για σένα ή θες άλλα;
12. **Per-line vs total**: προτιμάς πάντα total σύγκριση, ή επιτρέπω κι ANALYTIC per-line cherry-picking;
13. **«Κρυφή» καλύτερη**: αν μια προσφορά είναι 10% φθηνότερη αλλά ο vendor έχει χαμηλό supplier score, θες να εμφανίζεται warning ή να αποκλείεται;

### Σχετικά με trades
14. **Initial trade list**: η λίστα των 16 trades είναι σωστή; Λείπει κάτι;
15. **Custom trades**: θες να μπορώ να προσθέτω custom trade ad-hoc, ή κλειδωμένη λίστα;

### Σχετικά με phasing
16. **Order of phases**: P1→P2→P4→P3→P5 ή άλλη σειρά;
17. **MVP minimum**: αν θέλω να βγάλω κάτι σε production γρήγορα, P1+P2 αρκούν, ή θέλεις και P4 (comparison) από την αρχή;

### Σχετικά με notifications
18. **PM notifications**: όταν vendor υποβάλλει προσφορά → in-app + email + Telegram, ή μόνο in-app;
19. **Vendor reminders**: αν RFQ deadline σε 24h και vendor δεν έχει υποβάλει, αυτόματο reminder ή manual από PM;

### Σχετικά με access control
20. **RBAC**: ποιοι roles μπορούν να δημιουργούν RFQs / να αποδέχονται quotes; (default: super_admin + company_admin + project_manager — να επιβεβαιωθεί)

---

## 14. SUCCESS METRICS

Μετά από 3 μήνες σε production:
- **Quote count**: ≥X quotes/project (σήμερα ~0 συστηματικά)
- **Comparison rate**: ≥80% των POs να προέρχονται από συγκρινόμενο RFQ
- **AI extraction accuracy**: ≥85% των fields σωστά (PM correction rate ≤15%)
- **Vendor portal usage**: ≥30% των quotes να έρχονται από portal (ο μπετατζής δε θα πιάσει 100%)
- **Time saved**: από «μάζεμα 3 προσφορών για ένα έργο» 2-3 ώρες → ≤30'
- **Decision support trust**: PM ακολουθεί την recommendation σε ≥60% των cases (όχι 100% — αλλιώς overfit)

---

## 15. RELATED FILES (μετά την υλοποίηση)

```
src/subapps/procurement/
  ├─ types/
  │   ├─ quote.ts                    [NEW]
  │   ├─ rfq.ts                      [NEW]
  │   ├─ vendor-invite.ts            [NEW]
  │   ├─ trade.ts                    [NEW]
  │   └─ comparison.ts               [NEW]
  ├─ services/
  │   ├─ quote-service.ts            [NEW]
  │   ├─ rfq-service.ts              [NEW]
  │   ├─ quote-comparison-service.ts [NEW]
  │   ├─ vendor-invite-service.ts    [NEW]
  │   ├─ vendor-portal-service.ts    [NEW]
  │   ├─ trade-registry.ts           [NEW]
  │   └─ external/
  │       ├─ openai-quote-analyzer.ts        [NEW]
  │       └─ quote-analyzer.stub.ts          [NEW]
  └─ data/
      └─ trades.ts                   [NEW] (initial trade SSoT)

src/components/quotes/
  ├─ QuoteList.tsx                   [NEW]
  ├─ QuoteForm.tsx                   [NEW]
  ├─ QuoteDetail.tsx                 [NEW]
  ├─ QuoteScanUploader.tsx           [NEW]
  ├─ QuoteReviewScreen.tsx           [NEW]
  ├─ RfqBuilder.tsx                  [NEW]
  ├─ ComparisonPanel.tsx             [NEW]
  ├─ RecommendationCard.tsx          [NEW]
  └─ vendor-portal/
      ├─ VendorQuoteForm.tsx         [NEW]
      ├─ VendorQuoteSubmitted.tsx    [NEW]
      └─ VendorQuoteExpired.tsx      [NEW]

src/app/
  ├─ quotes/                         [NEW]
  │   ├─ page.tsx
  │   └─ [id]/page.tsx
  ├─ rfqs/                           [NEW]
  │   ├─ page.tsx
  │   └─ [id]/page.tsx
  ├─ vendor/quote/[token]/           [NEW]
  │   └─ page.tsx
  └─ api/
      ├─ quotes/                     [NEW]
      │   ├─ route.ts
      │   ├─ scan/route.ts
      │   ├─ [id]/route.ts
      │   ├─ [id]/accept/route.ts
      │   ├─ [id]/reject/route.ts
      │   └─ comparison/[rfqId]/route.ts
      ├─ rfqs/                       [NEW]
      │   ├─ route.ts
      │   ├─ [id]/route.ts
      │   └─ [id]/invite-vendors/route.ts
      └─ vendor/quote/[token]/route.ts  [NEW]

[MODIFIED]
src/config/firestore-collections.ts          (+6 collections)
src/config/enterprise-id.service.ts          (+QT prefix generator)
src/types/contacts/personas.ts               (+tradeSpecialties on SupplierPersona)
src/i18n/locales/{el,en}/quotes.json         [NEW namespace]
.ssot-registry.json                          (+5 modules: quote-entity, rfq-entity, trade-taxonomy, vendor-portal-token, quote-comparison)
firestore.rules                              (+rules για 6 νέες collections)
storage.rules                                (+vendor-quote-attachments path)
docs/centralized-systems/README.md           (+entry για Quote Management)
docs/centralized-systems/reference/adr-index.md  (+ADR-327)
adrs/ADR-267-lightweight-procurement-module.md  (cross-link σε changelog)
src/services/ai-pipeline/modules/register-modules.ts  (+QuoteScanModule, αν θέλουμε Telegram path)
```

---

## 16. APPENDIX A — ΣΗΜΕΙΑ ΕΠΑΝΑΧΡΗΣΗΣ (cited)

| What | Where | Reuse |
|------|-------|-------|
| HMAC token utility | `src/services/attendance/qr-token-service.ts:58-79` | Direct copy → `vendor-portal-token-service.ts` |
| Token validation pattern | `src/services/attendance/qr-token-service.ts:207-228` (timing-safe + Firestore re-check) | Direct template |
| Public route pattern | `src/app/attendance/check-in/[token]/page.tsx:26` | Direct template για `/vendor/quote/[token]` |
| Public POST pattern | `src/app/api/attendance/check-in/route.ts:163` (`withHeavyRateLimit`) | Direct template |
| AI Vision analyzer | `src/subapps/accounting/services/external/openai-document-analyzer.ts:301` | Mirror class structure |
| Strict JSON schema | `src/subapps/accounting/services/external/openai-document-analyzer.ts:77,145` | Schema template |
| AI factory | `src/subapps/accounting/services/external/openai-document-analyzer.ts:525` | Direct reuse (env vars) |
| PDF Vision support | `src/services/ai-pipeline/invoice-entity-extractor.ts:181-203` | Direct copy |
| Non-blocking processing | `src/app/api/accounting/documents/route.ts:107-203` | Direct template |
| Storage path builder | `src/services/upload/utils/storage-path.ts:264` | Direct reuse (νέο domain) |
| 6-state FSM pattern | `src/types/procurement/purchase-order.ts:30-38` (`PO_STATUS_TRANSITIONS`) | Adapt για Quote (7 states) |
| Atomic counter | `src/services/procurement/procurement-repository.ts:47-63` | Copy → `quote-counters` |
| Supplier persona | `src/types/contacts/personas.ts:200-206` | Extend με `tradeSpecialties[]` |
| Supplier metrics | `src/services/procurement/supplier-metrics-service.ts` | Direct read για comparison `supplierScore` |
| BOQ join key | `src/types/boq/boq.ts:106` (`linkedContractorId`) + `categoryCode` (ΑΤΟΕ) | Universal join για P5 |
| Email service | `src/services/email.service.ts:3` (Resend + Mailgun fallback) | Direct reuse για vendor invites |
| Telegram alert | `src/lib/telemetry/telegram-alert-service.ts:201` | Pattern για `sendVendorInviteTelegram()` |
| PO share email | `src/services/procurement/po-email-service.ts` | Template για vendor invite |
| Rate limiting | `src/lib/middleware/with-rate-limit.ts` (`withHeavyRateLimit`) | Direct reuse |

---

## 17. APPENDIX B — DECISION LOG (Q&A με Γιώργο, 2026-04-25)

| # | Θέμα | Απόφαση | Σκεπτικό |
|---|------|---------|----------|
| 1 | RFQ vs ad-hoc Quote | **Σενάριο Γ — Μικτό**. Ο PM μπορεί (α) να φτιάξει RFQ από πριν και να μαζέψει τις προσφορές κάτω από αυτό, ή (β) να καταχωρήσει ad-hoc προσφορά χωρίς RFQ. Όταν συγκεντρωθούν 2+ ad-hoc προσφορές για ίδιο project+trade, η εφαρμογή τις ομαδοποιεί σε «virtual RFQ» για σύγκριση. | Καλύπτει πραγματική ροή: προγραμματισμένα αιτήματα + αυθόρμητες προσφορές που έρχονται απρόσκλητες. |
| 2 | RFQ scope (single-trade vs multi-trade) | **Σενάριο Γ — Και τα δύο μέσα από ένα data model**. Ένα RFQ έχει `lines[]` και κάθε line έχει το δικό της `trade`. Αν όλες οι lines έχουν το ίδιο trade → UI εμφανίζει «single-trade RFQ». Αν διαφορετικά → «multi-trade RFQ / package». Comparison engine δουλεύει πάντα στο line-level και aggregates στο total. Vendor μπορεί να κάνει bid line-by-line ή «πακέτο» (flag). | Google-level: ένα unified entity, η UI προσαρμόζεται. Pattern Ariba/Coupa. ΑΤΟΕ codes ήδη line-level → φυσικά έτοιμο. |
| 3 | Vendor entity location | **Σενάριο Γ — `SupplierPersona` σε `contacts`, με extension**. Κρατάμε τον υπάρχοντα `SupplierPersona` flag στις επαφές. Επεκτείνουμε με νέο πεδίο `tradeSpecialties: TradeCode[]` (multi-select). Quote history + ratings αποτελούν computed views, όχι denormalized fields. Καμία παράλληλη `Vendor` collection. | Google-level: μην φτιάχνεις παράλληλη ιεραρχία. Reuse existing persona + relationship system. Backward-compatible με legacy `supplierCategory`. |
| 4 | AI extraction scope | **Σενάριο Γ — Όλα ό,τι μπορεί + per-field confidence**. Η AI εξάγει: vendor info, quote date, line items (description/qty/unit/price/VAT), totals, payment terms, validity, warranty, delivery terms, remarks. Κάθε πεδίο έχει `confidence: 0-1`. UI: green ≥0.9 (auto-accepted), yellow 0.6-0.9 (review hint), red <0.6 (manual fill). Fallback: αν AI fails completely, status='draft' με empty extractedData. | Google-level pattern: Document AI / Textract / Vision όλοι κάνουν per-field confidence. User-controlled review surface. |
| 5 | Multi-language scan | **Σενάριο Γ — Auto-detect**. AI ανιχνεύει αυτόματα γλώσσα εγγράφου (ελληνικά/αγγλικά/ιταλικά/...), εξάγει δεδομένα, normalizes σε internal format με ελληνικά labels. Zero extra code/cost/effort vs single-language. Edge case (κινέζικα/αραβικά) χαμηλότερη ακρίβεια αλλά 0% του πραγματικού flow. | gpt-4o-mini multilingual native. Ίδιο prompt structure. Future-proof για εισαγόμενα υλικά. |
| 6 | AI auto-accept threshold | **Σενάριο Γ — Configurable threshold per channel**. Setting στο `system/settings`: `quoteAutoAcceptThreshold: { scan: 1.0, portal: 0.8, manual: 1.0 }` (1.0 = always review). Default όλα στο 1.0 («πάντα έλεγχος»). Per-channel override (vendor portal πιο relaxed γιατί είναι πληκτρολογημένο από τον ίδιο). Κάθε auto-accept καταγράφεται στο audit trail με `acceptanceMode: 'auto' \| 'manual'`. | Google-level: ξεκινάς conservative, χαλαρώνεις με data. Per-channel risk-aware. User-controlled trust. |
| 7 | Vendor portal channels | **Σενάριο Β με phased rollout (Google-level)**. Day 1: Channel abstraction layer (`MessageChannel` interface) + Email driver (Mailgun/Resend) + «Copy Link» button (manual fallback). Future phases data-driven: 3.b WhatsApp via Twilio (μόνο αν email open-rate <60% σε 30 ημ.), 3.c SMS fallback (αν WhatsApp delivery fail >10%), 3.d Telegram (YAGNI — όχι). Per-vendor preferred channel αποθηκεύεται στο contact record. | Google-level: build small, measure, expand. Architecture supports N channels, implementation incremental. Avoid sunk cost on unused integrations. |
| 8 | Vendor post-submission lifecycle | **Σενάριο Β — 3-ήμερο edit window**. Vendor link παραμένει ενεργό 72 ώρες μετά την πρώτη υποβολή. Vendor μπορεί να ξανακλικάρει και να επεξεργαστεί την προσφορά του (versioning: v1, v2, ...). Όλες οι αλλαγές logged στο audit trail (`vendor_quote_edits[]` με timestamp + diff). Μετά 72h, link expires και η προσφορά κλειδώνει. PM ειδοποιείται για κάθε edit. | Vendor-friendly για typos/ξεχασμένα items. Όριο 72h αποτρέπει «infinite revision». Audit trail πλήρης. Δεν κρατάμε «session cookies» — link-based πάντα. |
| 9 | Counter-offer / διαπραγμάτευση | **Σενάριο Β — Ένας γύρος formal counter-offer**. PM πατάει «Ζήτησε καλύτερη τιμή» → vendor δέχεται in-app message με προτεινόμενο στόχο → vendor υποβάλλει revised quote (μόνο price changes, όχι line edits) → versioning v1 → v2. Comparison engine χρησιμοποιεί τη νέα τιμή. Επιπλέον γύροι γίνονται εκτός εφαρμογής. Καταγράφεται counter-offer event στο audit trail. | Πραγματικότητα Ελλάδας: διαπραγματεύσεις γίνονται προφορικά. Το σύστημα καταγράφει το αποτέλεσμα, δεν οδηγεί. Ένας γύρος = 95% των cases. |
| 10 | Vendor portal language | **Σενάριο Β — Ελληνικά + Αγγλικά με toggle**. Default ελληνικά, language switcher στο header. Reuse existing i18n infrastructure (`src/i18n/locales/{el,en}/`). Νέο namespace: `vendor-portal.json`. ~30-40 strings σε 2 γλώσσες. Future-proof για ξένους προμηθευτές. | Ελάχιστο effort (υπάρχει υποδομή). Καλύπτει 99% cases. Future-proof. |
| 11 | Comparison weights | **Σενάριο Γ — Templates ανά τύπο RFQ**. Built-in templates: **Standard** (50/25/15/10), **Commodity** (70/15/10/5), **Specialty** (35/35/15/15), **Urgent** (35/25/5/35). Default Standard. PM επιλέγει template στη δημιουργία RFQ, μπορεί να edit τα weights inline. Μελλοντικά: custom templates per-company σε `system/quote_comparison_templates`. | Reflects construction reality (commodity vs specialty). Pattern Ariba/Coupa. Default safe για όσους δε θέλουν tuning. Configurable για όσους θέλουν. |
| 12 | Per-line vs total comparison | **Σενάριο Γ — Configurable per RFQ**. RFQ έχει toggle `awardMode: 'whole_package' \| 'cherry_pick'`. Default `whole_package` (1 vendor → όλη η δουλειά). `cherry_pick` mode εμφανίζει per-line winner + total optimal split + savings vs whole-package. Vendor φλαγκάρει αν δέχεται split-award (`acceptsPartialAward: boolean`) — αν false, αποκλείεται από cherry-pick. | Reflects 2 πραγματικές χρήσεις: εργολαβίες (whole) + bulk material purchasing (cherry). Default safe. |
| 13 | Risky cheap quotes | **Σενάριο Γ — Show all + warnings + mandatory override-with-reason**. Όλες οι προσφορές εμφανίζονται. Vendors με supplier score <70 παίρνουν 🟡 banner + 🚩 risk flags inline. Αν PM επιλέξει κάποιον με risk flags ως νικητή → υποχρεωτικό modal με justification text (≥20 chars). Καταγράφεται στο audit trail (`overrideReason`, `overrideAt`, `overriddenBy`). Σε επόμενες παρόμοιες περιπτώσεις, εμφανίζεται διαθέσιμο το παλιό justification ως reference. | Google-level: ποτέ δεν κρύβεις δεδομένα. Justification gates αναγκάζουν σκέψη. Audit-friendly. Pattern Salesforce/SAP. |
| 14+15 | Trade taxonomy + extensibility | **Hierarchical taxonomy: 32 trades σε 8 parent groups** (Σκελετός, Κουφώματα, Δίκτυα, Επενδύσεις, Φινίρισμα, Εξωτερικά, Ειδικά, Υπηρεσίες/Logistics). Restructured από 16→32 για να αντικατοπτρίζει την ελληνική κατασκευαστική πραγματικότητα: σοβάς distinct από masonry, κουφωματάς material-agnostic (frames_exterior/interior), separated waterproofing/insulation, etc. **Runtime-extensible** μέσω admin UI: super_admin/company_admin προσθέτουν/επεξεργάζονται trades χωρίς code change. Soft-delete only (immutable αν used σε RFQ). Validation: trade code unique + i18n labels el+en mandatory + parent assignment mandatory. SSoT module: `trade-taxonomy` στο `.ssot-registry.json` (Tier 2). | Google-level: hierarchical, extensible, validated, soft-delete. Reflects real Greek construction trades. SSoT-compliant. Future-proof για new trades. |
| 16+17 | Phase order + MVP scope (Google methodology) | **6 phases (P1 split → P1a + P1b), σειρά Σενάριο Δ adapted: P1a → P1b → P2 → P4 → P3 → P5**. Methodology: **Google-style incremental build με deferred production rollout**. Κάθε phase = 1 session με implementation + tests + ADR update + commit. Πρόσβαση σε production μόνο μετά την ολοκλήρωση και των 6 phases + integration test + security review. Όχι staged production rollout, ένα μόνο cutover. SSoT enforcement σε όλα τα phases (CHECK 3.18 baseline + ratchet). Phase split rationale: P1 sole sarebbe ~25 files = borderline context unsafe → split in P1a (domain foundation, no UI) + P1b (UI foundation). | Compromesso Google-validated: incrementale build (early bug detection, AI accuracy validation, tight feedback loops) + deferred rollout (no half-finished σε production). 1 phase = 1 session = context safety. SSoT non-negotiable. |
| 18 | PM notifications | **Σενάριο Β — Multi-channel per event με smart batching**. 7 γεγονότα × 3 κανάλια matrix με defaults: urgent (deadline imminent) → in-app + email + Telegram, normal (νέα προσφορά / RFQ ολοκληρωμένο) → in-app + Telegram ή email, low (vendor edit / AI low conf) → in-app μόνο. Per-user override σε settings UI. **Smart batching**: >3 ίδιου τύπου σε 30' → ενοποίηση σε 1 ειδοποίηση («📥 3 νέες προσφορές για RFQ "Πευκάκια"»). Reuse Notification SSoT (NOTIFICATION_KEYS registry, ADR-21/04/2026). | Google-level: per-event channel routing, user-controlled noise. Anti-spam μέσω batching. SSoT-compliant με υπάρχον notification system. |
| 19 | Vendor reminders | **Σενάριο Γ — Configurable per-RFQ template + smart logic**. Templates: Aggressive (72/48/24/6/1h), **Standard default** (48/24/6h), Soft (24/1h), Off. Smart conditions: (α) reminder μόνο σε vendors που δεν άνοιξαν το link (έλεγχος `openedAt`), (β) decline button stops all reminders, (γ) draft state → ειδικό reminder «έχεις προσφορά υπό επεξεργασία». Channels follow vendor's preferred channel (email/WhatsApp/SMS, ίδιο με την αρχική αποστολή). | Google-level: configurable + smart + user-controlled. Anti-spam μέσω disinterest detection. Pattern Booking.com/Eventbrite. |
| 20 | RBAC | **Σενάριο Α — Full role matrix (least privilege)**. Detailed permissions matrix για 7 ρόλους × 15 actions. Highlights: super_admin/company_admin = full access, project_manager = full project-scoped, site_manager = scan-only + limited comparison view, accountant = read + audit cross-check, data_entry = manual entry + scan, viewer = read-only. RFQ winner declaration limited to PM+ levels. Trade taxonomy management = company_admin+. Override recommendation gated to PM+. | Google-level: principle of least privilege, audit-friendly, scoped. Aligned με ADR-244 role hierarchy. |

---

| 21 | Currency | **EUR μόνο**. Όλες οι τιμές σε ευρώ. Τύπος: `number` (όχι `{ amount, currency }`). | Απλούστατο — 100% των Ελλήνων προμηθευτών δουλεύουν σε €. |
| 22 | Delete policy (RFQ/Quote) | **Soft-delete**. Διαγραφή = `status: 'archived'`, δε φαίνεται στη λίστα αλλά παραμένει στη βάση. Μόνιμη διαγραφή ποτέ από UI. | Audit trail + ιστορικό πάντα διαθέσιμο. Google-level: soft-delete only. |
| 23 | Vendor decline flow | **Σενάριο Α — Decline button υπάρχει**. `VendorInvite.status` έχει `declined` state. Πατώντας decline: reminders σταματούν (ήδη Q19), PM ειδοποιείται αμέσως, decline rate καταγράφεται στα supplier metrics. Google-level: proactive signal > passive timeout. Ήδη implicit στο Q19. | Proactive = PM αντιδρά αμέσως. Anti-spam. Supplier score signal. |
| 24 | Νέος vendor χωρίς contact record | **Σενάριο Β + SSoT**. Inline quick-add στο RFQ Builder → καλεί τον centralized `ContactService.createContact()` (δεν υπάρχει 2ος τρόπος δημιουργίας contact). Δημιουργεί minimal `SupplierPersona` με `tradeSpecialties: [trade του RFQ]`, αμέσως invite. Google-level: μη σπάς τη ροή. SSoT: ένα contact service, ένα entity, καμία παράλληλη δημιουργία. | UX continuity + SSoT compliance. |
| 25 | Attachment policy (Quote files) | **5 φωτογραφίες + 1 PDF per quote. Max 10MB/αρχείο (μετά compression). MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp` + `application/pdf`**. Reuse SSoT `FILE_TYPE_CONFIG` από `src/config/file-upload-config.ts` με context-specific maxSize override (10MB). Ίδιοι τύποι με Contact Documents uploads. | SSoT file type registry. Per-quote limits αντί global. |
| 26 | Audit trail retention | **Forever — no auto-deletion**. Ελληνικό φορολογικό δίκαιο = 5yr minimum → forever το καλύπτει. Firestore cost negligible. Construction disputes εμφανίζονται χρόνια μετά. GDPR "right to erasure": anonymize PII fields (`vendorName → 'REDACTED'`), δομή audit trail παραμένει. Ίδιο pattern με PO audit trail + EntityAuditService. | Google-level: audit logs δεν διαγράφονται ποτέ. SSoT alignment με υπάρχον audit pattern. |
| 27 | Notification preferences storage | **SSoT extension — zero new infrastructure**. Reuse `UserNotificationSettingsService` + extend `ProcurementNotificationSettings` με 5 νέα fields: `quoteReceived`, `quoteDeadlineApproaching`, `vendorDeclined`, `quoteEdited`, `aiLowConfidence` (booleans). Per-user Firestore document `user_notification_settings/{uid}`. Category `procurement` υπάρχει ήδη. ~10 min effort. | Google + SSoT: extend existing, μην φτιάχνεις parallel. Zero νέες collections. |

| 2026-04-25 | 🚀 **P1a IMPLEMENTED** — Domain Foundation (no UI). New: `src/subapps/procurement/types/` (quote, rfq, vendor-invite, trade, comparison), `src/subapps/procurement/data/trades.ts` (32 trades/8 groups), `src/subapps/procurement/services/` (quote-service, rfq-service, trade-registry, quote-counters), `src/app/api/quotes/route.ts`, `src/app/api/rfqs/route.ts`, `src/i18n/locales/{el,en}/quotes.json`. Modified: `firestore-collections.ts` (+6 collections), `enterprise-id-prefixes.ts` (+QUOTE/RFQ/VENDOR_INVITE/TRADE), `personas.ts` (+tradeSpecialties), `user-notification-settings.types.ts` (+5 quote notification fields), `.ssot-registry.json` (+5 modules Tier 2/3), `firestore.rules` (+6 collection rules Admin SDK only). |
| 2026-04-26 | 🚀 **P1b IMPLEMENTED** — UI Foundation. New hooks: `src/subapps/procurement/hooks/` (useRfqs, useQuotes, useTradeRegistry). New components: `src/subapps/procurement/components/` (QuoteStatusBadge, TradeSelector, ComparisonPanelStub, QuoteList, RfqList, QuoteForm, RfqBuilder). New pages: `src/app/procurement/rfqs/page.tsx` (lista), `rfqs/new/page.tsx` (RfqBuilder), `rfqs/[id]/page.tsx` (detail + QuoteList + ComparisonPanelStub). Updated i18n: el/en quotes.json (+UI keys per forms, lists, comparison namespace). Acceptance criteria: RfqBuilder ✅, QuoteForm ✅, QuoteList ✅, TradeSelector ✅, ComparisonPanelStub ✅, i18n ✅. |

**Next step**: P2 — AI Scan (`OpenAIQuoteAnalyzer`, `/api/quotes/scan`, review UI con confidence).
