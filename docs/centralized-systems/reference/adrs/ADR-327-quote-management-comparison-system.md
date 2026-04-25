# ADR-327: Quote Management & Comparison System (Hybrid Scan + Vendor Portal)

**Status**: 📝 DRAFT — Pending Q&A discussion with Giorgio (2026-04-25)
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

## 17. APPENDIX B — DECISION LOG (TBD μετά Q&A)

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1-20 | Βλ. §13 — pending Q&A | TBD | TBD |

---

**Next step**: Ο Γιώργος απαντά στις 20 ερωτήσεις του §13. Μετά αυτό το ADR γίνεται **APPROVED** και ξεκινά Phase 1.
