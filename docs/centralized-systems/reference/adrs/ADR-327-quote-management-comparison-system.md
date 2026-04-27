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
| 2026-04-26 | 🗂️ **SSoT registry cleanup** — `.ssot-registry.json` aggiornato post-P5: stub `vendor-portal-token-stub` → `vendor-portal` (P3 fully implemented: `vendor-invite-service.ts` canonical, hooks+components+API routes in allowlist, forbidden patterns for direct addDoc); stub `quote-comparison-stub` → `quote-comparison` (P4 fully implemented: `comparison-service.ts` canonical, scoring function forbidden patterns); new module `po-auto-generation` (P5-ATOE: `generatePoFromAwardedQuote()` SSoT, `comparison-service.ts` only allowed caller). |
| 2026-04-27 | 🧠 **AI extraction prompt tuning** — `quote-analyzer.schemas.ts::QUOTE_EXTRACT_PROMPT` esteso post-test FENPLAST 146918 (3 cufomi + 3 ρολά). Cause root: AI saltava 1/3 righe causa layout colonnare, non calcolava `validUntil` da "ισχύει 30 μέρες", confondeva "Ημ/νία παράδοσης" del template con `validUntil`. Fix: (1) line items — istruzione esplicita di scansionare tutti i numeri sequenziali `001/002/003` e leggere multi-page; uso opzionale di "Σύνοψη/Summary" come verifica conteggio; (2) `validUntil` — calcolo da durata "ισχύει X ημέρες"; separazione netta da `deliveryTerms`; (3) `paymentTerms` — null esplicito quando "Τρόπος Πληρωμής" è vuoto (no false positives); (4) `notes` — aggregazione da entrambe le pagine. Solo prompt update, schema invariato. |
| 2026-04-27 | 🚀 **AI extraction v2.0 — Google Document AI pattern**: validation re-test FENPLAST 146918 mostrava ancora numeri shuffled tra colonne (gpt-4o-mini vision limit). Decisione "fai come Google" → architettura riscritta zero-hard-coding. **4 cambiamenti combinati**: (1) **Hierarchical schema** `QUOTE_LINE_ITEM` ora ha `rowNumber + rowSubtotal + components[]` con `discountPercent` per component (mappa cufomo+ρολό + qualsiasi kit). (2) **Self-validation loop** generico — checksums `unitPrice×qty×(1-discount) ≈ lineTotal`, `Σ(components) ≈ rowSubtotal`, `subtotal+vat ≈ total` (tolerance 2%). On mismatch → retry max 2 con feedback specifico iniettato nel prompt. (3) **Dedicated quote vision model**: env var `OPENAI_QUOTE_VISION_MODEL` (default `gpt-4o`, NON mini) + opzionale `OPENAI_QUOTE_ESCALATE_MODEL` per retry escalation. (4) **CoT reasoning step** via `tableStructureNotes: string` come primo campo strict-schema → AI descrive struttura tabellare prima di estrarre. Tutto generic, nessun template-specific. ADR-327 §6 riscritto v2.0. Files: `openai-quote-analyzer.ts`, `quote-analyzer.schemas.ts`, `types/quote.ts` (`+discountPercent`, `+parentRowNumber`). |
| 2026-04-27 | 🌐 **Bilingual notes + validation warnings (GR+EN)**: (1) `QUOTE_EXTRACT_PROMPT` notes instruction aggiornata — AI ora obbligata a scrivere sempre in formato `[GR] ...\n[EN] ...`, tradurre da qualsiasi lingua sorgente (BG/EN/IT/etc.). (2) `quote-analyzer.validation.ts` — tutti i messaggi di errore matematico ora bilingui inline (`Γραμμή/Row N`, `αλλά / but`, `αναντιστοιχία / mismatch`). (3) `appendValidationIssuesToNotes` header reso bilingue: riga GR + riga EN. Fix: note estratte da PDF in bulgaro/inglese non erano visibili in greco. |
| 2026-04-27 | 🔧 **Quote scanner UX fixes** — 3 bug post-test FENPLAST: (1) `vendorPhone` prompt reso esplicito: telefono del EMITTENTE della prosfora (vendor), NON del destinatario/cliente ("Προς:" section). (2) Note di validazione rese Greek-only: rimosso tutto il testo inglese inline (`/ but`, `/ mismatch`, `Row/Γραμμή`, `unitPrice/qty/lineTotal`) sostituito con termini greci (`τιμή/τμχ/αξία γραμμής/καθαρό σύνολο/ΦΠΑ`). (3) Header `appendValidationIssuesToNotes` rimosso il testo inglese. (4) `QUOTE_EXTRACT_PROMPT::notes` cambiato da bilingue obbligatorio (`[GR]/[EN]`) a Greek-only. (5) Glossario OCR aggiunto: auto-correzi "ΓΙΑΝΤΖΟΥΡΗ/ΙΑΝΤΖΟΥΡΗ/ΑΤΖΟΥΡΗ" → ΠΑΝΤΖΟΥΡΙ. |
| 2026-04-27 | 📍 **Vendor address extraction + contact storage + non-GR UI**: Task A — schema AI aggiornato con `vendorAddress/City/PostalCode/Country` (4 campi nullable, confidence tracking, prompt instructions con ISO country code inference). Task B — `POST /api/contacts/resolve` accetta i 4 campi indirizzo, li persiste via `FieldValue.arrayUnion` su `addresses[]` del contact appena creato; `ExtractedDataReviewPanel.onSwitchVendor` + `QuoteReviewPage.handleSwitchVendor` aggiornati per passare i campi indirizzo. Task C — `AddressWithHierarchy` ha ora campo `country` in Section 1 (basic fields); quando `country` è impostato e ≠ 'GR', la sezione accordion di Διοικητική Διαίρεση viene nascosta. `ContactFormTypes.CompanyAddress` + `ContactFormData.hqAddressCountry` aggiunti per persistenza. |
| 2026-04-27 | 🖼️ **Logo: embedded XObject extraction + email prompt fix** — (1) `logo-extractor.ts`: strategia belt-and-suspenders. PRIMARY: enumerate Image XObjects pagina 1 via `pdf-lib`, seleziona il più grande con DCTDecode filter (JPEG), converte a PNG via `@napi-rs/canvas`. FALLBACK: rasterize+crop quadrante top-left (comportamento precedente). (2) `quote-analyzer.schemas.ts::QUOTE_EXTRACT_PROMPT::vendorEmails`: prompt rafforzato — sezioni "Οικονομικά στοιχεία / Financial Details" + pattern `"e-mail: X"` esplicitati; regola che ogni email trovata in QUALSIASI sezione / pagina 2 va nel array, non in notes. |
| 2026-04-27 | 🔓 **Storage public-upload SSoT (UBLA root-cause — first attempt: download token)** — Logo `<img>` rendeva 403 perché `bucket.file().makePublic()` no-op silenzioso su bucket UBLA (`pagonis-87766.firebasestorage.app`). Primo tentativo: nuovo servizio `uploadPublicFile()` usava **Firebase Storage download token** + URL `firebasestorage.googleapis.com/...?alt=media&token=UUID`. Migrati 3 consumer (`logo-extractor`, `quotes/scan` PDF, `email-inbound-attachments`). Nuovo modulo SSoT registrato. Commit `ad054c48`. **Esito: NON funziona** — Firebase Storage Rules continuano a denegare con 403 anche con token nei metadata: i token settati dall'Admin SDK NON vengono riconosciuti come "Firebase-issued" → le rules vengono comunque applicate. |
| 2026-04-27 | 🛡️ **Storage public-upload SSoT (UBLA fix v2 — auth-gated proxy, definitive)** — Pivot al pattern già usato in `showcase/shared-pdf-proxy-helpers.ts`: il file viene salvato privato (no makePublic, no token), e l'URL ritornato è un proxy same-origin `/api/storage/file/{path}` che richiede auth via session cookie. Nuova route `src/app/api/storage/file/[...path]/route.ts` con `withAuth` + path-based authorization (`segments[1] === ctx.companyId`) + stream del file via Admin SDK (`createReadStream()`). `uploadPublicFile()` aggiornato: rimosso token UUID, ora ritorna `/api/storage/file/{encodedPath}`. La funzione `buildProxyUrl()` esportata per riuso/test. Le rules Storage rimangono deny-all (più sicuro). I 3 consumer non richiedono altre modifiche — la firma del service è invariata. Browser `<img src="...">` carica via cookie auth. |
| 2026-04-27 | 🛑 **Storage public-upload SSoT (root cause v3 — orphan-cleanup race, definitive)** — Anche con il proxy auth-gated, `getMetadata` dal proxy 4s dopo l'upload ritornava `404 No such object` mentre `verifiedSize` post-save in upload-process funzionava. Diagnosi via REST API + standalone Admin SDK: bucket `pagonis-87766.firebasestorage.app` aveva 30+ file `softDeleted=true` con `softDeleteTime` ~2 secondi dopo `updated`. Trovato `functions/src/storage/orphan-cleanup.ts::onStorageFinalize`: cancella ogni file il cui `fileId` (ultimo segmento path meno estensione) non ha claim in `files` o `file_shares` (resolver `findFileOwner`). I file scan/logo erano cancellati come orphan perché nessuno scriveva il claim. **Fix Google-level**: `uploadPublicFile()` ora scrive `FILES/{fileId}` doc minimale `{id, storagePath, bucket, contentType, sizeBytes, status:'active', createdBy, claimSource:'storage-public-upload'}` con `set({merge:true})` **PRIMA** di `fileRef.save()`. Vince la race contro `onFinalize` (~hundreds of ms). `extractFileIdFromStoragePath()` esportato per parità con la logica della Cloud Function. Helper privato `writeOrphanClaim()` lancia se la scrittura fallisce — meglio fallire upload che lasciare orphan da cancellare. Rimossa diagnostica temporanea da service e proxy route. |
| 2026-04-27 | 🎨 **Comparison color palette → SSoT module + Tailwind subapps content** — Le 3 mappe inline (`FACTOR_BAR_COLORS` / `FLAG_BADGE_COLORS` / `FACTOR_TEXT_COLORS`) erano duplicate in `ComparisonPanel.tsx`, e `RecommendationCard.tsx` aveva ancora i reason badges grigi (`variant=secondary`). Giorgio ha chiesto: (a) stessa label = stesso colore in entrambe le card (RecommendationCard reasons + ComparisonRow flags), (b) badge centrati, (c) zero codice scattered. **Fix SSoT**: nuovo modulo `src/subapps/procurement/config/comparison-factor-colors.ts` con `COMPARISON_FACTOR_COLORS` (4 factor × 3 surfaces: bar/badge/text) + `FLAG_TO_FACTOR` (bridge da token `cheapest|most_reliable|best_terms|fastest_delivery` a factor key). Consumati da: `BreakdownBars` (bar), `FlagsRow` (badge + centered con `justify-center`), `TemplateSummary` (text), `RecommendationCard` reasons (badge + centered). Variant `secondary→outline` per i factor-badges per evitare conflict `bg-secondary` vs custom `bg-X-600` non risolto da twMerge sulle classi CSS-variable del design system. **Tailwind content**: aggiunto `./src/subapps/**/*.{ts,tsx}` a `tailwind.config.ts` (era esclusa — prevenzione JIT miss su classi uniche del subapp procurement). |
| 2026-04-27 | 🐛 **3 fix UI nella RFQ detail page (`/procurement/rfqs/[id]`)** — (1) **Vendor name = ID**: in `RecommendationCard` e `ComparisonPanel` apparivano contact ID grezzi (`cont_dfa2bc20-...`) invece dei nomi vendor. Root cause: `comparison-service.ts::fetchVendorNames` settava `displayName ?? companyName ?? doc.id` come fallback finale, producendo l'ID quando entrambi i campi erano null/empty. Fix: `pickContactDisplayName()` ora itera su `[displayName, companyName, fullName, legalName, name]`, ritorna `null` se nessuno è valido (no più "id-as-name"); `resolveVendorName()` cascade fallback contact-lookup → `quote.extractedData.vendorName.value` → raw ID con `logger.warn` per visibilità regression. (2) **Score bars + flag badges + template legend monocromatici**: 4 barre score (Τιμή/Προμηθευτής/Όροι/Παράδοση) tutte azzurro `bg-primary` perché `Progress` usato senza `indicatorClassName`; i 4 flag badge (`cheapest/most_reliable/best_terms/fastest_delivery`) tutti `variant=secondary` grigio (con conflitto Tailwind `bg-secondary` vs custom `bg-X` non risolto da `cn()`); template summary "Τιμή 50% · Προμηθευτής 25%..." tutto color-muted. Fix: tre mappe color-coordinate in `ComparisonPanel.tsx`: `FACTOR_BAR_COLORS` per `BreakdownBars` (`bg-X-600`), `FLAG_BADGE_COLORS` per `FlagsRow` (`border + bg-X-600 + text-white`, variant cambiata `secondary→outline` per evitare bg-conflict), `FACTOR_TEXT_COLORS` per `TemplateSummary` (`text-X-600 dark:text-X-400`). Palette unificata: price/cheapest=blue, supplier/most_reliable=emerald, terms/best_terms=amber, delivery/fastest_delivery=pink. Color-coding consistente bar↔badge↔legend → utente collega visivamente "vendor X è il piu economico" sia dalla barra (blue) che dal badge (blue) che dalla quota nel template legend (blue). (3) **Specialty mostra chiave i18n**: colonna "Ειδικότητα" in `QuoteList.tsx:122` rendeva `{q.trade}` raw (es. `aluminum_frames`) invece di traduzione. La chiave `trades.aluminum_frames` esiste già in `src/i18n/locales/{el,en}/quotes.json:227`. Fix: `t(\`trades.\${q.trade}\`)` con namespace `quotes` già attivo. |
| 2026-04-27 | 🐛 **FSM fix: award flow su RFQ in `draft`** — `comparison-service.ts::awardRfq()` chiamava `updateRfq(... status: 'closed')` direttamente, ma `RFQ_STATUS_TRANSITIONS` consente solo `draft → active → closed`. Quando il flusso award partiva da una RFQ ancora in `draft` (es. quote manual-entry, nessun invito vendor inviato), `updateRfq` lanciava `Invalid transition: draft → closed`. Errore silenziato da `safeFirestoreOperation` (`firebaseAdmin.ts:218-223` cattura + ritorna fallback `undefined`) → API ritornava 200, PO veniva generato, `quote.status='accepted'`, ma RFQ restava in `draft` senza `winnerQuoteId` (stato inconsistente). **Fix**: prima del transition finale a `closed`, se `rfq.status === 'draft'` promuovi a `'active'` (audit step intermedio). FSM intatta, no bypass, audit trail completo (`status_change: draft → active`, `status_change: active → closed`). 1 file: `src/subapps/procurement/services/comparison-service.ts:425-431`. Riprodotto su RFQ `rfq_1a3c3f2f` award flow cherry_pick=true (winner QT-0016). |
| 2026-04-27 | 🛡️ **Defense-in-Depth contro regression race (4 layer Google-style)** — Il fix v3 protegge solo `uploadPublicFile()`. Per evitare che un futuro consumer storage bypass il SSoT e re-introduca la race, aggiunti 3 layer presubmit/observability/CI sopra il Layer 2 runtime invariant. **Layer 1 (presubmit)**: nuovo forbidden pattern `\.file\([^)]*\)\.save\(` in modulo `storage-public-upload` di `.ssot-registry.json` — blocca uso diretto `bucket.file().save()` fuori dall'allowlist. Allowlist estesa a `src/services/showcase-core/` (FILE_SHARES claim, ADR-312), `src/services/floorplans/` (thumbnail child di FILES claim), `src/app/api/properties/` (showcase generator), `functions/` (CF runtime, no race contro se stesso). Golden fixture aggiunta. **Layer 3 (observability)**: nuova scheduled Cloud Function `orphanSpikeAlert` (`functions/src/storage/orphan-spike-alert.ts`, cron orario UTC) che conta `ORPHAN_FILE_DELETED` audit row dell'ultima ora; se >`ORPHAN_SPIKE_THRESHOLD` (default 5) → POST diretto a Telegram super-admin chat (no shared lib, ~30 righe). Idempotency via `system_orphan_spike_alerts/{yyyy-MM-ddTHH}` doc. Wired in `functions/src/index.ts` line 501. Fallback se `TELEGRAM_BOT_TOKEN` mancante: log strutturato `severity=ERROR` per Stackdriver alert. **Layer 4 (CI integration test)**: primo test functions emulator (`tests/functions-integration/`). `firebase.json` esteso con `emulators.functions.port=5001`. Nuovo `jest.config.functions-integration.js` (node env, 60s timeout, maxWorkers=1). Suite `storage-orphan-cleanup.integration.test.ts` con 2 scenari: (a) **happy path** — `uploadPublicFile()` produce file che sopravvive `onFinalize`; (b) **regression guard** — raw `bucket.file().save()` senza claim VIENE cancellato (conferma che `onFinalize` è effettivamente attivo nell'emulator — protegge da false-positive silenziosi). Workflow CI `functions-integration.yml` triggerato narrow su touch in `src/services/storage-admin/`, `functions/src/storage/`, `functions/src/shared/file-ownership-resolver.ts`. npm script `test:functions-integration:emulator`. **Tabella layer**:<br/>• Layer 1 (presubmit) — SSoT regex blocca `.file().save()` fuori allowlist, ~0s costo<br/>• Layer 2 (runtime) — pre-claim `FILES/{fileId}` prima di save() (commit 63efd4e2), già attivo<br/>• Layer 3 (observability) — Telegram spike alert su `ORPHAN_FILE_DELETED >5/h`<br/>• Layer 4 (CI) — emulator integration test su PR che toccano storage code |

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

- Αρχείο: `src/subapps/procurement/services/external/openai-quote-analyzer.ts`
- Mirror `OpenAIDocumentAnalyzer` (accounting) ως αφετηρία, αλλά **divergent evolution** για quotes (πιο σύνθετα tables, multi-vendor formats).
- 2 strict schemas:
  - `QUOTE_CLASSIFY_SCHEMA` — distinguishes vendor quote vs invoice vs other
  - `QUOTE_EXTRACT_SCHEMA` — **hierarchical** structure (parent rows + components, βλ. §6.4)

### 6.2 Flow (v2.0 — Google Document AI pattern)

```
1. User uploads photo/PDF → /api/quotes/scan
2. Server: save to Firebase Storage + capture buffer (zero re-download)
3. Non-blocking after(): call OpenAIQuoteAnalyzer.classifyQuote() → if not quote → mark rejected
4. ┌─ extractQuote() loop (max 1 + maxValidationRetries):
   │  a) Build vision content (PDF base64 inline OR image_url)
   │  b) Call OpenAI Responses API with QUOTE_EXTRACT_SCHEMA (strict + CoT)
   │  c) Parse → validate (§6.5)
   │  d) If valid → return; else inject specific feedback into prompt + retry
   │     (escalation model used on retry if OPENAI_QUOTE_ESCALATE_MODEL set)
   └─ After max retries → return last attempt (UI shows low confidence + issues)
5. Flatten components → ExtractedQuoteLine[] με parentRowNumber preserved
6. Auto-suggest vendorContactId (fuzzy contacts), trade (από tradeHint)
7. Update quote: extractedData + materialized lines + status='draft'
8. UI: review screen με highlighted low-confidence cells + parent-grouping
9. PM accepts → status='under_review' (ready for comparison)
```

### 6.3 Constraints (v2.0)

| Knob | Default | Env var |
|------|---------|---------|
| Primary vision model | `gpt-4o` (full vision, NOT mini) | `OPENAI_QUOTE_VISION_MODEL` (fallback `OPENAI_VISION_MODEL`) |
| Escalation model (retry) | none (reuses primary) | `OPENAI_QUOTE_ESCALATE_MODEL` (e.g. `o1`, `gpt-4-turbo`) |
| Validation retries | 2 | `OPENAI_QUOTE_VALIDATION_RETRIES` |
| Request timeout | 60s | `OPENAI_TIMEOUT_MS` |
| Network retries (per call) | 2 | `OPENAI_MAX_RETRIES` |

- **Multi-language prompts**: Greek-first, `detectedLanguage` ISO output. Vendors' formats vary (Greek, Bulgarian-templated like FENPLAST, English boilerplate).
- **Generic, NOT template-specific**: zero hard-coded vendor patterns. Cross-vendor robustness via prompt engineering + validation, not regex.
- **Cost envelope**: typical 1-3 page PDF ~$0.01-0.05/scan. Acceptable for low-volume task (single-digit scans/day).

### 6.4 Hierarchical schema

Πραγματικές προσφορές δεν είναι flat: ένα `κούφωμα` περιέχει `τελάρο + ρολό + φυλλαράκι`, ένα HVAC kit έχει sub-components, ένας πίνακας ηλεκτρολογικός έχει εξαρτήματα. Παλαιό flat schema ανάγκαζε το AI να συνενώνει ή να σπάει αυθαίρετα → mismatched columns.

**Νέο schema** (`quote-analyzer.schemas.ts`):

```typescript
QUOTE_LINE_ITEM = {
  rowNumber: string | null,        // "001", "1", "A1"…
  description: string,             // header της αριθμημένης γραμμής
  rowSubtotal: number | null,      // καθαρή τιμή γραμμής μετά εκπτώσεις
  components: QUOTE_COMPONENT[],   // ένα ή πολλά υπο-εξαρτήματα
}

QUOTE_COMPONENT = {
  description, quantity, unit, unitPrice,
  discountPercent: number | null,  // ΝΕΟ — colonna sconto vendor
  vatRate, lineTotal,
  // + per-field confidence
}
```

Post-extraction normalize → flatten σε `ExtractedQuoteLine[]` με `parentRowNumber` preserved (so UI mporei grouping/indentation).

### 6.5 Self-validation loop (Google Document AI pattern)

Generic, μηδενικό template knowledge. Tolerance: **2%** (numeric formatting, rounding).

| Check | Formula |
|-------|---------|
| Component math | `unitPrice × quantity × (1 - discountPercent/100) ≈ lineTotal` |
| Row consistency | `Σ(components.lineTotal) ≈ rowSubtotal` |
| Quote subtotal | `Σ(rowSubtotal) ≈ subtotal` |
| Totals integrity | `subtotal + vatAmount ≈ totalAmount` |

If checks fail:
1. Build feedback string με **specific** issues (greek, ≤8 issues per retry).
2. Inject feedback as **next user prompt** in same conversation.
3. Re-call OpenAI με ίδιο schema.
4. If `OPENAI_QUOTE_ESCALATE_MODEL` set → use it on retry calls.
5. Max `OPENAI_QUOTE_VALIDATION_RETRIES` (default 2). Final response returned regardless.

### 6.6 CoT (Chain-of-Thought) reasoning

Schema includes `tableStructureNotes: string` as **first** required field. Strict mode emits properties in declaration order → AI writes structural reasoning **before** numbers, grounding subsequent extraction. Pattern from OpenAI Structured Outputs guide. Field ignored downstream (UI doesn't render it; logged for debug).

### 6.7 PDF→PNG rasterization (SSoT)

Vision models (incl. `gpt-4o`) struggle on PDFs that combine product imagery with column-heavy numeric tables (FENPLAST-class quotes). Native `input_file` parsing aligns numbers across visual rows incorrectly → shuffled prices.

**Fix**: rasterize PDF to PNG **before** vision call. Pattern AWS Textract / Google Document AI.

**SSoT module**: `src/services/pdf/pdf-rasterize.service.ts` (registered as Tier 3 in `.ssot-registry.json::pdf-rasterize`).

```typescript
import { rasterizePdfPages } from '@/services/pdf/pdf-rasterize.service';
const pages: Buffer[] = await rasterizePdfPages(pdfBuffer, { dpi: 200, maxPages: 10 });
// each page sent as input_image data:image/png;base64,...
```

Implementation: `pdfjs-dist/legacy/build/pdf.mjs` + `@napi-rs/canvas` (server-side, zero DOM dependency). DPI 200 default → ~1.65k px width per A4 page (capped at `maxWidthPx` 2000).

**Knobs**:

| Env var | Default | Purpose |
|---------|---------|---------|
| `OPENAI_QUOTE_RASTERIZE_PDF` | `1` (on) | Set to `0` to revert to native `input_file` |
| `OPENAI_QUOTE_RASTER_DPI` | `200` | Render DPI |

**Confidence cap on validation fail**: when retries exhausted with issues > 0, `normalizeExtracted()` caps `overallConfidence` to `min(50, raw)` and **appends issues to `notes` field**. UI signals manual review via low confidence + visible warning block. Avoids the AI's bogus "99% confidence" self-assessment when checksum fails.

### 6.8 FSM transition

PM review confirm → status `under_review` (NOT `submitted` — `submitted` is reserved for vendor portal self-submission). Path: `draft → under_review → accepted | rejected`.

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
| 2026-04-26 | 🛠️ **P1c IMPLEMENTED** — REST CRUD per `[id]`. New: `src/app/api/quotes/[id]/route.ts` (GET/PATCH/DELETE), `src/app/api/rfqs/[id]/route.ts` (GET/PATCH/DELETE). Status transitions enforced via service layer. Soft-delete only (`status: 'archived'`). Auth/rate-limit guards inherited. |
| 2026-04-26 | 📝 **LABEL CORRECTION** — Commits `0aabb730` (mis-labeled "P1b: type extensions + i18n foundation"), `7490ccd8` (mis-labeled "P1c: REST CRUD") and `13eb1cbd` (mis-labeled "P2: UI layer") realmente coprono **P1b — UI Foundation**. La numerazione P2 viene riservata al **vero P2 — AI Scan** (questa fase). Ordine canonico autoritativo rimane: **P1a → P1b → P2 → P4 → P3 → P5** (§17 Q16+17). Future commit `feat(adr-327): P2 — AI Scan ...` per implementazione attuale. |
| 2026-04-26 | 🤖 **P2 IMPLEMENTED** — AI Scan integration (full end-to-end). **Services**: `src/subapps/procurement/services/external/quote-analyzer.stub.ts` (NOT_CONFIGURED fallback), `quote-analyzer.schemas.ts` (OpenAI strict-mode classify+extract schemas + Greek prompts, flat values + parallel `confidence` object), `openai-quote-analyzer.ts` (Responses API + Vision + retry/timeout + factory). **API**: `src/app/api/quotes/scan/route.ts` (POST multipart upload, sensitive rate-limit, 10MB cap per Q25, draft quote + Storage attach + fire-and-forget via `after()`), `src/app/api/quotes/scan/process.ts` (async classify+extract pipeline + graceful fallback on failure). **Service extension**: `quote-service.ts` (+`applyExtractedData(ctx, quoteId, extracted, options)` with `materializeQuoteLines`, audit entry `extracted_applied`, autoAcceptThreshold default 1.0 = always review per Q6). **UI components**: `ExtractedDataReviewPanel.tsx` (per-field confidence colors green ≥80 / yellow 50-79 / red <50, editable lines, totals recompute, confirm→PATCH). **UI hook**: `src/subapps/procurement/hooks/useQuote.ts` (single-quote fetch + configurable polling that auto-stops when `extractedData` populated). **UI pages**: `src/app/procurement/quotes/scan/page.tsx` (upload form: file + project + supplier + trade selectors, query-param prefill from RFQ, client-side MIME/size guard, redirect to review), `src/app/procurement/quotes/[id]/review/page.tsx` (polling wrapper that mounts `ExtractedDataReviewPanel` once extraction is ready; confirm→PATCH lines+status `submitted`, reject→DELETE archive). **RFQ wiring**: `src/app/procurement/rfqs/[id]/page.tsx` adds `Σάρωση Προσφοράς (AI)` button that prefills `rfqId`, `projectId`, and `trade` (when single-trade RFQ). **i18n**: el/en `quotes.scan.*` namespace (~45 keys, no defaultValue). **Storage path**: `companies/{companyId}/quotes/{quoteId}/scan-{fileId}.{ext}`. Stub fallback when `OPENAI_API_KEY` absent. Pattern reuse: mirror `OpenAIDocumentAnalyzer` accounting + non-blocking `after()` like `accounting/documents/route.ts`. **Known follow-up**: existing `withStandardRateLimit(request, () => handler())` invocation in `api/quotes/route.ts:114-119` and `api/rfqs/route.ts` is broken (signature is `(handler) => handler`); scan route uses corrected pattern `withSensitiveRateLimit(handler)`. Tracked as separate fix. **End-to-end flow** now operational: RFQ detail → click Scan → upload → 202 + draft quote → review page polls → `ExtractedDataReviewPanel` shown → confirm → quote `submitted`. **Acceptance**: stub mode ✅ (graceful no-key), schema strict-mode ✅, lines materialized ✅, audit entry ✅, review UI confidence colors ✅, polling auto-stop ✅, RFQ→Scan→Review→Confirm wired ✅, i18n el/en ✅. |
| 2026-04-26 | ⚖️ **P4 IMPLEMENTED** — Comparison Engine (multi-factor scoring + award + override). **Service**: `src/subapps/procurement/services/comparison-service.ts` — `computeRfqComparison(companyId, rfqId, options)` (template lookup + per-quote breakdown {price, supplier, terms, delivery} via `priceScore` (linear normalisation min↔max), `termsScore` (warranty +15 / payment-terms-days bonus +10 per 30d), `deliveryScore` (linear days→score, ≤7d=100, ≥60d=0), `computeVendorScore` (wraps `calculateSupplierMetrics` from ADR-267: onTime×0.5 + (100−cancellation)×0.3 + order-history bonus min(20, totalOrders×2); neutral 50 when no PO history), recommendation with reason tokens + confidence = delta/100, flag assignment (`cheapest`/`most_reliable`/`fastest_delivery`/`best_terms`/`risk_low_score` <70), `computeCherryPick(companyId, rfqId)` per-line winners by `categoryCode`/description match, `awardRfq(ctx, rfqId, {winnerQuoteId, overrideReason?})` (atomic: winner submitted→under_review→accepted, losers→rejected, RFQ→closed with `winnerQuoteId`, audit `award_decision` JSON detail with override flags + templateId; override required ≥20 chars when winner ≠ recommendation OR has `risk_low_score`). **API**: `src/app/api/rfqs/[id]/comparison/route.ts` (GET, standard rate-limit, optional `?templateId=` + `?cherryPick=true`), `src/app/api/rfqs/[id]/award/route.ts` (POST, sensitive rate-limit, Zod body schema enforces `overrideReason` 20–1000 chars when present). **UI components**: `RecommendationCard.tsx` (winner highlight + reason chips + confidence Progress + risk banner), `AwardModal.tsx` (override-with-reason flow, Textarea ≥20 chars, override + risk warnings, error surface), `ComparisonPanel.tsx` (recommendation card + cherry-pick savings card + scoring table with per-row breakdown bars + flag badges + Award button per row). Stub `ComparisonPanelStub.tsx` removed. **Hook**: `src/subapps/procurement/hooks/useComparison.ts` (fetch + refetch helpers, optional `templateId`/`cherryPick`). **RFQ page wiring**: `src/app/procurement/rfqs/[id]/page.tsx` replaces stub with `ComparisonPanel`, passes `awardMode` from RFQ + `rfqAwarded` lock + `onAward` POST handler that refetches RFQ/quotes/comparison after success. **i18n**: `quotes.comparison.*` expanded el+en (~55 new keys: factors, flags, reasons, recommendation, award modal, cherry-pick, weight summary). EL pure Greek (no English). All ICU `{var}` single-brace per CHECK 3.9. **Acceptance**: multi-factor scoring ✅ (4 weighted factors, sum-to-1 weights from `COMPARISON_TEMPLATES`), recommendation with explicit reason tokens ✅, override-with-reason ≥20 chars enforced ✅ (server + client), audit immutability ✅ (`award_decision` audit trail entry + per-quote `risk_flag_override` from updateQuote), real `ComparisonPanel` replaces stub ✅, GET /api/rfqs/[id]/comparison ✅, POST /api/rfqs/[id]/award ✅, i18n el/en ✅. |

| 2026-04-26 | 🚪 **P3 IMPLEMENTED** — Vendor Portal (HMAC tokens + public POST + multi-channel delivery, day-1 = email + copy_link). **Token service**: `src/services/vendor-portal/vendor-portal-token-service.ts` — base64url(`{rfqId}:{vendorContactId}:{nonce}:{expiresAt}:{hmac}`), HMAC-SHA256 with `VENDOR_PORTAL_SECRET` (NEW env var), timing-safe compare, signature-only fast path (no DB hit on bad tokens), nonce blacklist for explicit revocation. **VendorInviteService**: `src/subapps/procurement/services/vendor-invite-service.ts` — invite lifecycle (sent → opened → submitted | declined | expired), 72h edit window per Q8, RFQ.invitedVendorIds sync via batch, channel dispatch with copy_link fallback when channel unavailable. **Channels**: `src/subapps/procurement/services/channels/{types,email-channel,copy-link-channel,index}.ts` — `MessageChannel` interface, Email driver reuses Resend → Mailgun fallback (ADR-070) with vendor-portal–specific HTML body (greeting + branding + anti-phishing warning) + copy_link no-op driver. **Public APIs**: `src/app/api/vendor/quote/[token]/route.ts` (GET + POST, withHeavyRateLimit, HMAC validate first, hashed submitterIp, 5 img + 1 PDF × 10MB, vendor write via Admin SDK only — bypasses quote-service to avoid `ctx.userId` mismatch), `src/app/api/vendor/quote/[token]/decline/route.ts` (POST, withHeavyRateLimit, marks invite declined + notifies PM). **Public page**: `src/app/vendor/quote/[token]/page.tsx` (Server Component, validates signature + loads invite/RFQ via service layer) + `VendorPortalClient.tsx` + `VendorPortalForm.tsx` + `DeclineDialog.tsx` + `SuccessState.tsx` + `VendorPortalErrorState.tsx` + `types.ts`. Mobile-first, language toggle el ↔ en, no auth, Tailwind only (no app shell). **i18n**: `src/i18n/locales/{el,en}/vendor-portal.json` (~70 keys, EL pure Greek, ICU `{var}` single-brace) + `quotes.json` extended with `quotes.notifications.*` (5 keys el+en) + namespace registration in `lazy-config.ts` + `namespace-loaders.ts` (registers both `quotes` and `vendor-portal` — `quotes` was unregistered prior to P3). **Notifications**: `src/config/notification-events.ts` extended with `PROCUREMENT_QUOTE_RECEIVED`, `PROCUREMENT_VENDOR_DECLINED`, `PROCUREMENT_QUOTE_EDITED` event types + `QUOTE`, `RFQ` entity types. `src/server/notifications/notification-orchestrator.ts` exposes new `dispatchProcurementNotification`. `src/config/notification-keys.ts` adds `procurement.quote.*` registry block. **Storage rules**: `storage.rules` adds explicit `companies/{companyId}/quotes/{quoteId}/{fileName}` block (Admin SDK writes only, authenticated company-scoped reads). **Firestore rules**: unchanged — already in P1a. **Acceptance**: HMAC validation pre-DB ✅, timing-safe compare ✅, withHeavyRateLimit on hashed IP ✅, 5 img + 1 PDF × 10MB enforced server + client ✅, submitterIp hashed ✅, audit trail append-only via service ✅, edit window 72h ✅, decline flow ✅, branded email + anti-phishing warning ✅, public page mobile-first + el/en toggle ✅, vendor invite delivery audited ✅, PM notifications on submit/edit/decline ✅. **Known gap (deferred to follow-up cleanup)**: legacy `quote-service.ts`/`rfq-service.ts` use non-existent `ctx.userId` — P3 sidesteps this by writing the vendor quote directly via Admin SDK and using `ctx.uid` everywhere it does call services. Also pending: existing `withStandardRateLimit(request, () => handler())` mis-invocations in `api/quotes/route.ts` and `api/rfqs/route.ts`. |

| 2026-04-26 | 🔔 **P3.b IMPLEMENTED** — Admin Invite UI. **API**: `src/app/api/rfqs/[id]/invites/route.ts` (POST create invite — withAuth + withSensitiveRateLimit + Zod schema {vendorContactId, deliveryChannel: email\|copy_link, expiresInDays?, locale?}, returns {invite, portalUrl, delivery}; GET list — withStandardRateLimit, calls `listVendorInvitesByRfq`), `src/app/api/rfqs/[id]/invites/[inviteId]/revoke/route.ts` (POST, withSensitiveRateLimit, calls `revokeVendorInvite`), `src/app/api/rfqs/[id]/vendor-contacts/route.ts` (GET, withStandardRateLimit, returns companyId-scoped contacts where `supplierPersona` defined — picker data source). **Hook**: `src/subapps/procurement/hooks/useVendorInvites.ts` — fetch invites + vendor contacts, `createInvite(dto)`, `revokeInvite(id)`, refetch after mutations, `VendorContactOption` shared type. **Component**: `src/subapps/procurement/components/VendorInviteSection.tsx` — section below ComparisonPanel in RFQ detail page; invite button opens Dialog modal (vendor SearchableCombobox, channel Select email\|copy_link, expires days Input); after create shows portalUrl + Copy; invite table: vendor name, channel icon (Mail\|Link), StatusBadge (sent/opened/submitted/declined/expired), expiresAt formatted, Copy Link button, Revoke button (confirm + disabled on terminal statuses). **i18n**: `quotes.invites.*` namespace (~30 keys, el pure Greek + en) added to `quotes.json` el + en. **RFQ page wiring**: `src/app/procurement/rfqs/[id]/page.tsx` adds `<VendorInviteSection rfqId={id} />` after ComparisonPanel. **No new Firestore collections / rules / events** — all infra from P3. ctx.uid pattern used throughout (no ctx.userId). withSensitiveRateLimit for mutating routes, withStandardRateLimit for reads. |

| 2026-04-26 | 🗂️ **P5-BOQ IMPLEMENTED** — RFQ-from-BOQ flow. **Data**: `trades.ts` — all 32 `relatedAtoeCategories[]` populated with OIK-1..OIK-12 mappings (previously all empty). **Helpers** (client-safe, in `trades.ts`): `getAtoeCodesForTrade(tradeCode): string[]` (trade → ΑΤΟΕ codes from seed data), `getTradeCodeForAtoeCategory(atoeCode): TradeCode \| null` (OIK-N → primary trade, reverse lookup from 12-entry map). **Type**: `CreateRfqDTO.invitedVendorIds?: string[]` added (backward-compatible, `createRfq()` now uses `dto.invitedVendorIds ?? []`). **Service factory**: `createRfqFromBoqItems(ctx, boqItemIds[]): Promise<CreateRfqDTO>` in `rfq-service.ts` — reads `boq_items` Firestore (max 30 IDs, tenant-filtered by `companyId`), maps each `BOQItem.title → RfqLine.description`, `BOQItem.categoryCode → RfqLine.categoryCode`, `BOQItem.categoryCode → TradeCode` via `getTradeCodeForAtoeCategory` (fallback `materials_general`), collects `linkedContractorId` → `invitedVendorIds` (best-effort). **API**: `POST /api/rfqs/from-boq` (withAuth + withStandardRateLimit, Zod body `{boqItemIds: string[1..30]}`), returns `{data: CreateRfqDTO}`. **RfqBuilder**: `initialState?: RfqBuilderInitialState` prop (exported type), `useState` seeded from prop; `invitedVendorIds` hidden field passed to create API. **Page**: `rfqs/new/page.tsx` reads `?boqItems=id1,id2` searchParam, fetches `/api/rfqs/from-boq` on mount, shows Spinner while loading, passes result as `initialState` to RfqBuilder. **BOQ UI**: `MeasurementsTabContent.tsx` adds "Δημιουργία RFQ από BOQ" button (outline, disabled when no items), navigates to `rfqs/new?boqItems=...` with all filtered item IDs. **i18n**: `building-tabs.json` el+en `tabs.measurements.actions.createRfqFromBoq`; `quotes.json` el+en `rfqs.fromBoq.*` (3 keys). **Acceptance**: service factory reads Firestore ✅, ΑΤΟΕ→TradeCode mapping ✅, `invitedVendorIds` pre-populated from `linkedContractorId` (best-effort) ✅, RfqBuilder accepts initialState prop ✅, page handles boqItems searchParam ✅, button in BOQ UI ✅, i18n el+en ✅, ADR §17 updated ✅. |

| 2026-04-26 | 🏷️ **P5-ATOE IMPLEMENTED** — ΑΤΟΕ auto-mapping on QuoteLine + RfqLine. **trades.ts helpers**: `getAtoeCodesForTrade` + `getTradeCodeForAtoeCategory` (see P5-BOQ above). **RfqBuilder**: `RfqLineRow` adds `categoryCode` Select column — options ordered as: trade-relevant ΑΤΟΕ codes first (from `getAtoeCodesForTrade(line.trade)`), SelectSeparator, then remaining OIK-N codes; when TradeSelector changes trade → auto-sets `categoryCode` to first ΑΤΟΕ code of new trade. Table header adds `rfqs.lineCategoryCode` column. `addLine()` pre-sets `categoryCode = getAtoeCodesForTrade('concrete')[0]`. **QuoteForm**: `LineRow` adds `categoryCode` Select column — same ordering (suggested codes from `form.trade`, separator, remaining); `addLine()` pre-sets `categoryCode = atoeCodesForTrade[0]` where `atoeCodesForTrade = getAtoeCodesForTrade(form.trade)`; `suggestedAtoeCodes` passed as prop to LineRow. Table header adds `quotes.categoryCode` column. **i18n**: `quotes.json` el `quotes.categoryCode`, `quotes.categoryCodePlaceholder`, `quotes.noCategoryCode`; `rfqs.lineCategoryCode`, `rfqs.categoryCodePlaceholder`, `rfqs.noCategoryCode` + `rfqs.fromBoq.*` (3 keys); same in en. **Acceptance**: `getAtoeCodesForTrade` returns populated codes ✅, combobox shows trade-relevant codes first ✅, remaining codes after separator ✅, auto-set on trade change (RfqBuilder) ✅, auto-set on addLine (QuoteForm) ✅, i18n el+en ✅. |

| 2026-04-26 | 🔗 **P5 IMPLEMENTED** — Quote → PO Conversion + Supplier Metrics Enrichment. **Trigger**: `awardRfq()` in `comparison-service.ts` now auto-generates a PurchaseOrder via ADR-267 `createPO()` immediately after awarding — proactive, primary path, not a side effect. **Bidirectional audit link**: `Quote.linkedPoId = poId` (new field on Quote entity) + `PurchaseOrder.sourceQuoteId = quoteId` (new field on PurchaseOrder entity); `linkedPoId` written atomically via Admin SDK update after PO creation; `sourceQuoteId` stored on the PO document at creation time. **PO generation service**: `src/subapps/procurement/services/po-generation-service.ts` (NEW, 76 lines) — `generatePoFromAwardedQuote(ctx, winner)`: maps `QuoteLine[]` → `CreatePurchaseOrderDTO.items` (categoryCode fallback `OIK-1` when null, quantity/unit/unitPrice preserved), calls `createPO(ctx, dto)` (reuses full ADR-267 pipeline: atomic counter `PO-NNNN`, `EntityAuditService.recordChange`, existing audit), then writes `quote.linkedPoId` via direct Admin SDK update. Generated PO starts as `draft` — PM reviews/edits before ordering (consistent with ADR-267 approval workflow). **Supplier metrics enrichment**: `calculateSupplierMetrics()` in ADR-267 reads all POs via `listPurchaseOrders({companyId, supplierId})` — newly created `draft` PO is automatically included in `totalOrders` for future comparisons; `totalSpend` counts only `PO_COMMITTED_STATUSES` (ordered/partially_delivered/delivered/closed) → correct behavior, no denormalized fields (Q3). **Type extensions**: `PurchaseOrder.sourceQuoteId: string \| null` + `CreatePurchaseOrderDTO.sourceQuoteId?: string \| null` added to `src/types/procurement/purchase-order.ts`; `Quote.linkedPoId: string \| null` added to `src/subapps/procurement/types/quote.ts`; `procurement-repository.ts` passes `sourceQuoteId` through when creating PO document. **AwardResult** extended with `{poId, poNumber}` for API response transparency. **Acceptance**: trigger proactive in `awardRfq()` primary path ✅, `Quote.linkedPoId` written atomically post-award ✅, `PO.sourceQuoteId` set at PO creation time ✅, `createPO()` full pipeline (counter + audit) reused ✅, supplier metrics include new PO on next computation ✅, no new collections ✅, no denormalized fields ✅, file sizes ≤500 (comparison-service 474 lines, po-generation-service 76 lines) ✅. |
