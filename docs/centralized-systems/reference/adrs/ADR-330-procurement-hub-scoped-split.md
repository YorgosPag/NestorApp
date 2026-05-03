# ADR-330 — Procurement Hub Scoped Split (Company-wide vs Project-scoped)

**Status:** 📋 PROPOSED — pending Giorgio answers to §6 open questions (D1–D7)
**Date:** 2026-05-03
**Author:** Claude (Plan Mode, 3 Explore agents) + Γιώργος
**Supersedes (partially):** ADR-267 §"Αποφάσεις" #1 ("Standalone top-level navigation")
**Related ADRs:** ADR-267 (Lightweight Procurement Module), ADR-327 (Quote Management & Comparison), ADR-329 (BOQ Granularity), ADR-328 (Tabs SSoT), ADR-326 (Tenant Org Structure), ADR-175 (BOQ / Quantity Surveying)

### Changelog

| Date | Changes |
|------|---------|
| 2026-05-03 | 📋 PROPOSED — bozza iniziale post esplorazione (3 agents Explore + verifica codice + lettura ADR-267/327/328) |
| 2026-05-03 | ✅ **D1 RESOLVED** — Detail page deep-link: **Opzione B** (project-scoped URLs `/projects/{projectId}/procurement/{po|quote|rfq}/[id]`). Motivazione: tutti i big player del settore (Procore, SAP S/4HANA EPPM, Oracle Primavera Unifier, Autodesk Construction Cloud, Buildertrend) usano URL project-scoped per detail page. Vantaggi: (a) RBAC tenant-isolation enforced dall'URL stesso, (b) breadcrumb completo `Έργο > Προμήθειες > PO-1234`, (c) audit trail chiaro, (d) ricerca globale comunque disponibile via search bar (non dipende dalla URL structure). |
| 2026-05-03 | ✅ **D2 RESOLVED** — Sub-tab nel project Procurement: **Opzione A — 4 sub-tab** (Επισκόπηση, Αιτήματα Προσφορών/RFQ, Προσφορές & Σύγκριση/Quote, Παραγγελίες/PO). Motivazione: pattern Procore (Bidding/Commitments come tool separati), separation of concerns chiara, evita confusione "richiesto vs ricevuto" nella stessa surface, Overview merita propria oscreen per KPI/charts del progetto. Eventuale 5° sub-tab "Ανά Κτίριο" rimane opzionale Phase 1.5. |
| 2026-05-03 | ✅ **D3 RESOLVED** — Building tab Procurement: **Opzione A — NO tab Procurement dentro building**. Motivazione: (a) le Επιμετρήσεις vivono nel building perché *originano* lì (data entry per-building con quantities differenti); le Procurement *consumano* le Επιμετρήσεις aggregate e beneficiano di consolidation per ottenere volume discounts e ridurre delivery costs (es. ordinare 530 sacchi cemento insieme invece che 200+150+180 separati); (b) breakdown per-building disponibile via filter `buildingId` dentro la sub-tab Παραγγελίες/RFQ; (c) single source of truth per le procurement, no duplicazione UX; (d) industry standard (Procore/SAP/Primavera tutti project-level). |
| 2026-05-03 | ✅ **D4 RESOLVED** — Vendor Master implementation: **Opzione A — vista derivata da Contacts** (no nuova collection). Motivazione: (a) preserva SSoT contatti (ADR-282 Contact Persona Architecture), (b) un contatto può avere multiple personas simultaneamente (es. mechanikos che è sia supplier di servizi che customer di una proprietà — caso comune in Grecia), (c) zero duplicazione: cambio telefono/indirizzo si propaga ovunque, (d) pattern allineato a SAP S/4HANA (Business Partner unificato con role flags). I KPI vendor-specifici (lead time, on-time delivery, total spend, # POs) vivono in tabella laterale `vendor_metrics/` (cached/computed, identità resta in `contacts/`). |

---

## 1. Context

Il modulo Procurement è cresciuto per fasi (A→J di ADR-267 + Phase 1–9 di ADR-327). La superficie top-level `/procurement` accoglie oggi **dati transazionali project-scoped** (PO, Quote, RFQ, Sourcing Events) che strutturalmente hanno tutti `projectId` obbligatorio. Questo crea due problemi:

1. **UX cognitiva (priorità alta):** l'utente che lavora su un progetto specifico (es. "Παγκράτι, 3 κτίρια") deve uscire dal contesto progetto per gestire le proprie RFQ/PO, poi filtrare per progetto. Le **Επιμετρήσεις** vivono dentro il progetto (tab order 12), ma le **Προμήθειες** vivono fuori (sidebar order 55) — il flusso BOQ → RFQ → Quote → PO è spezzato in due posti del navigation system.

2. **Mancanza di company-wide masters:** Vendor Master, Material Catalog, Framework Agreements e Cross-project Spend Analytics — che sono *davvero* company-wide e non legati a un singolo progetto — **non esistono come entità formali**. Oggi:
   - Vendor = Contact con `personaTypes contains 'supplier'` (no view dedicata)
   - Material = `trades.ts` registry mestieri + `boq-categories` 12 codici ΑΤΟΕ (no catalogo materiali)
   - Framework Agreements = inesistente
   - Cross-project Spend = parziale (`useSupplierMetrics` esiste per singolo supplier, manca dashboard aggregata)

La best practice di settore conferma il problema:

| Vendor | Pattern Procurement |
|--------|---------------------|
| **Procore** | Project Tools → *Bidding*, *Commitments* (PO), *Change Orders*. Tutto dentro il progetto. Niente top-level. |
| **Primavera Unifier (Oracle)** | Bid Tab → Award → Commitment, legati a WBS del progetto. Master vendor company-wide. |
| **SAP S/4HANA EPPM** | **Ibrido a 2 livelli**: Vendor Master + Material Master = company-wide; PR/PO/RFQ = legati a WBS element progetto. |
| **Autodesk Construction Cloud / BIM 360 Cost** | Procurement project-scoped, link diretto a BOQ. |

Il **pattern dominante** per un'app di ordine enterprise è il modello ibrido SAP-style. ADR-267 §"Αποφάσεις" #1 (28 marzo 2026) aveva intenzionalmente scelto "Standalone top-level (displayOrder: 55)" perché in quella fase Procurement era solo PO management. Con l'aggiunta di ADR-327 (Quote/RFQ), Sourcing Events multi-trade e le richieste future (Vendor Master, Material Catalog, Framework Agreements), quella decisione deve essere riconsiderata.

### Stato attuale verificato (2026-05-03)

| Superficie | Esiste? | Cosa contiene |
|------------|---------|---------------|
| Top-level `/procurement` | ✅ | PO list cross-project (split panel, Phase E ADR-267) |
| Top-level `/procurement/quotes` | ✅ | Quote list cross-project (split panel, Phase H ADR-267) |
| Top-level `/procurement/rfqs` | ✅ | RFQ list cross-project |
| Top-level `/procurement/sourcing-events` | ✅ | Sourcing events (multi-trade) cross-project |
| Top-level `/procurement/[poId]` | ✅ | PO detail page (deep-link target) |
| Top-level `/procurement/quotes/[id]/review` | ✅ | Quote review page |
| Project tab "Προμήθειες" (order 12.5) | ✅ (thin) | `ProcurementProjectTab.tsx` ~22 LOC — solo `RfqList` filtrato per `projectId` |
| Building tab "Επιμετρήσεις" | ✅ | BOQ CRUD per building |
| Project tab "Επιμετρήσεις" (order 12) | ✅ | Aggregate read-only di tutti i building del progetto |
| **Vendor Master** company-wide | ❌ | Vendors = Contacts con persona, no vista dedicata |
| **Material Catalog** company-wide | ❌ | Esiste solo `trades.ts` + `boq-categories` |
| **Framework Agreements** | ❌ | Non esiste |
| **Cross-project Vendor Spend** | 🔶 parziale | `useSupplierMetrics` per single supplier, no dashboard aggregata |

### Foreign keys confermate (lato dati)

- `RFQ.projectId` REQ, `RFQ.buildingId` opt
- `Quote.projectId` REQ, `Quote.rfqId` opt
- `PurchaseOrder.projectId` REQ, `PurchaseOrder.buildingId` opt
- `PurchaseOrderItem.boqItemId` opt → link a Επιμετρήσεις
- `SourcingEvent.projectId` REQ

**Conclusione:** tutto il transazionale è già *strutturalmente* project-scoped. Manca solo la riorganizzazione UX.

---

## 2. Decision

Adottare il **modello ibrido SAP-style** con due superfici Procurement chiaramente separate per responsabilità.

### 2.1 Top-level `/procurement` → "Procurement Hub" (company-wide)

Contiene **esclusivamente** entità o aggregazioni che hanno senso a livello azienda:

| Sezione | Contenuto | Stato oggi |
|---------|-----------|------------|
| **Vendor Master** | Lista canonica fornitori (Contacts con `personaTypes contains 'supplier'`), KPI per vendor (lead time, on-time delivery, qualità), categorizzazione per trade | ⚠️ vista non esiste, dati sì |
| **Material Catalog** | Catalogo unificato materiali con codice ΑΤΟΕ, unit, supplier preferiti, prezzo storico medio | ❌ da costruire |
| **Framework Agreements** | Contratti-quadro multi-progetto (es. "Τιτάν -10% se annual volume > 1000t") con auto-applicazione su PO totals | ❌ da costruire |
| **Cross-project Spend Analytics** | Dashboard aggregata: spesa annua per vendor / per trade / per progetto, budget vs committed company-wide | 🔶 esiste single-supplier, manca aggregata |
| **Sourcing Events globali** (Phase 2) | Pacchetti multi-progetto (acquisto centralizzato per più cantieri) | ❌ oggi event = 1 progetto |

Il top-level **NON contiene più**:
- Lista PO operativa (si sposta nel project tab)
- Lista Quote operativa (si sposta nel project tab)
- Lista RFQ operativa (si sposta nel project tab)

**Eccezione tollerata:** rimangono **viste cross-project read-only** ("Tutte le PO della company", "Tutti gli RFQ aperti") accessibili da una sub-tab `Hub → All Activity` per super-admin / management che hanno bisogno della overview aggregata.

### 2.2 Project tab `Προμήθειες` → "Project Procurement" (transazionale)

Sostituisce l'attuale `ProcurementProjectTab.tsx` (oggi 22 LOC, solo `RfqList`). Diventa una surface sub-tabbed che riusa `RouteTabs` o `StateTabs` (ADR-328 SSoT).

| Sub-tab | Contenuto | Riuso da |
|---------|-----------|----------|
| **Επισκόπηση** | KPI del progetto: budget vs committed (per ΑΤΟΕ), # RFQ aperti, # PO in approvazione, % BOQ coperto, spend trend | nuovo (riusa `procurementDashboardStats` filtrato per `projectId`) |
| **Αιτήματα Προσφορών (RFQ)** | Lista RFQ del progetto + create from BOQ + workflow lifecycle | `RfqList` esistente |
| **Προσφορές & Σύγκριση (Quote)** | Lista quote del progetto + comparison panel + award | `QuoteList` + `ComparisonPanel` esistenti |
| **Παραγγελίες (PO)** | Lista PO del progetto + dettaglio + lifecycle | `PurchaseOrderList` + `PurchaseOrderDetail` esistenti, già supportano filtro `projectId` |
| **Ανά Κτίριο** (opzionale Phase 1.5) | Vista breakdown PO/RFQ raggruppati per `buildingId` | nuovo, query esistenti |

### 2.3 Sidebar entry

`Προμήθειες` resta in sidebar a `displayOrder: 55` ma il **label tooltip** diventa esplicito: *"Hub Προμηθειών — Προμηθευτές · Υλικά · Συμβόλαια · Στατιστικά"*. Nessun figlio nel sidebar (le sub-tab vivono dentro la pagina, no nesting nel menu laterale).

### 2.4 Building tab Προμήθειες

**Decisione:** non aggiungere un tab Procurement dentro il building. La granularità building è già coperta dal filtro `buildingId` opzionale dentro le sub-tab del project (sub-tab "Ανά Κτίριο"). Le **Επιμετρήσεις** vivono giustamente nel building perché *originano* lì (data entry); le **Procurement** *consumano* le Επιμετρήσεις aggregate al livello progetto.

---

## 3. Consequences

### Positive

- ✅ Allineamento alla best practice (Procore / SAP / Primavera / Autodesk)
- ✅ Flusso utente lineare: Έργο → Επιμετρήσεις → RFQ → Quote → PO senza uscire dal progetto
- ✅ Vendor Master + Material Catalog + Framework Agreements abilitano sconti volume e price history affidabili
- ✅ Cross-project analytics diventa cittadino di prima classe del Hub (oggi è scattered)
- ✅ Project tab finalmente utile (oggi 22 LOC stub)
- ✅ Riuso massimo: `RfqList`, `QuoteList`, `PurchaseOrderList` già supportano filtro `projectId` lato API
- ✅ Pattern coerente con `ProjectMeasurementsTab.tsx` (aggregate read-only nel project tab)

### Negative / Costo

- ❌ Refactor non banale: spostare 3 surface (PO/Quote/RFQ list) dal top-level al project tab
- ❌ Detail page route da spostare a pattern project-scoped (`/projects/{projectId}/procurement/{po|quote|rfq}/{id}`) — vedi §5 Phase 2 per dettagli
- ❌ 4 nuove entità/viste da modellare (VendorMaster view, MaterialCatalog, FrameworkAgreement, CompanyProcurementDashboard)
- ❌ ADR-267 §"Αποφάσεις" #1 va annotato come superseded
- ❌ ProcurementSubNav (`/procurement` ↔ `/procurement/quotes`) deve cambiare semantica

### Risk mitigations

- **Migrazione fasata** (vedi §5) — Phase 1 è puramente additive (zero rotture)
- **Detail pages migrano a route project-scoped** (`/projects/{projectId}/procurement/{po|quote|rfq}/{id}`) — vedi D1 risolta in §6. Industry pattern (Procore/SAP/Primavera/Autodesk/Buildertrend) tutti project-scoped
- **Sub-tab del project usano gli stessi componenti list già esistenti** (zero duplicazione di codice)
- **Phase 2 (top-level cleanup) può aspettare Phase 3-4** per evitare di lasciare il top-level vuoto senza Vendor Master/Catalog pronti

---

## 4. Alternatives considered

| # | Opzione | Esito |
|---|---------|-------|
| A | **Status quo** — top-level only, project tab thin | ❌ Rifiutata: UX non scalabile, non Google-level, replica sintomo già documentato in CLAUDE.md N.7 |
| B | **Hybrid SAP-style** — top-level Hub + project tab transazionale | ✅ **APPROVATA** — questa ADR |
| C | **Full project-scoped** — eliminare top-level, tutto dentro project | ❌ Rifiutata: si perde la vista company-wide essenziale per master data e analytics multi-progetto |
| D | **Building-level Procurement** — replicare pattern Επιμετρήσεις dentro building | ❌ Rifiutata: granularità building già coperta da filtro `buildingId` nel project tab; complessità inutile |

---

## 5. Migration plan

> **Nota:** dettagli implementativi saranno definiti in plan separati post-discussione. Questa sezione è alto livello.

### Phase 1 — Project tab enrichment (additive, zero rotture)

- Riscrivere `src/components/projects/tabs/ProcurementProjectTab.tsx` con `RouteTabs`/`StateTabs` (ADR-328) + 4 sub-tab (Overview, RFQ, Quote, PO)
- Riusare `RfqList`, `QuoteList`, `PurchaseOrderList`, `ComparisonPanel` esistenti con filtro `projectId`
- Aggiungere variante `procurementDashboardStats` con flag `projectScoped: true`
- i18n: `src/i18n/locales/{el,en}/projects.json` aggiungere keys `tabs.subtabs.procurement.{overview,rfq,quote,po}`

**Rischio:** minimo. Top-level resta invariato, deep-link funzionano, project tab finalmente utile.

### Phase 2 — Top-level Hub redesign + Detail page migration

- Trasformare `/procurement` da "PO list" a "Hub landing page" con 4 card (Vendor Master, Material Catalog, Framework Agreements, Spend Analytics)
- **Spostare detail page** (D1 risolta Opzione B):
  - `/procurement/[poId]` → `/projects/{projectId}/procurement/po/{poId}`
  - `/procurement/quotes/[id]/review` → `/projects/{projectId}/procurement/quote/{quoteId}/review`
  - `/procurement/rfqs/[id]` → `/projects/{projectId}/procurement/rfq/{rfqId}`
- Rimuovere vecchie route top-level (no redirect necessari)
- Aggiornare `ProcurementSubNav` semantica: tabs diventano [Hub, Vendors, Materials, Agreements, Analytics]
- Sostituire viste cross-project "All Activity" con la search bar globale (search by `PO-NNNN` o `RFQ-NNNN` ovunque nell'app)
- RBAC enforcement: `withAuth()` middleware verifica `projectId` dell'URL contro permessi utente

**Rischio:** medio. Cambio cognitivo per utenti esistenti, ma allineato a industry standard.

### Phase 3 — Vendor Master surface

- Nuova vista `/procurement/vendors` che query Contacts con `personaTypes array-contains 'supplier'`
- Aggregare KPI da `useSupplierMetrics` esteso
- Card per vendor con: name, trade(s), # POs, total spend YTD, on-time delivery %, last order date

**Rischio:** basso. Solo nuova vista, dati esistenti.

### Phase 4 — Material Catalog

- Nuova entità Firestore `materials/` collection + ID generator (`mat_*`)
- Schema: `{ id, companyId, code, name, unit, atoeCategory, preferredSupplierIds[], avgPrice, lastPrice, createdAt }`
- UI CRUD `/procurement/materials`
- Link a `boq-categories` per ΑΤΟΕ + supplier preferiti

**Rischio:** medio. Nuova collection, nuove rules, nuove indexes.

### Phase 5 — Framework Agreements

- Nuova entità `framework_agreements/` + auto-apply discount in PO totals
- Schema con `vendorContactId`, `validFrom/To`, `discountRules[]`, `volumeBreakpoints[]`
- Hook in PO calc: se vendor ha framework agreement attivo → applicare sconto

**Rischio:** medio-alto. Logica calc PO da non rompere.

### Phase 6 — Cross-project Dashboard

- `/procurement` landing page diventa dashboard con widget aggregati cross-project
- Riusa `procurementDashboardStats` SSoT senza filtro `projectId`
- Widget: Top 10 vendors by spend, spend per trade, monthly trend, budget vs committed company-wide

**Rischio:** basso. Solo lettura aggregata.

### Phase 7 (futura) — Sourcing Events globali

- Estendere `SourcingEvent` con `projectIds: string[]` (oggi `projectId: string`)
- Pacchetti multi-progetto per acquisti centralizzati

**Rischio:** alto, fuori scope iniziale.

---

## 6. Decisions to confirm with Giorgio (open questions)

Le seguenti decisioni rimangono aperte fino a discussione esplicita. ADR sarà aggiornato a **APPROVED** dopo conferma.

### D1. Detail page deep-link ✅ RESOLVED 2026-05-03

**Domanda:** ok mantenere le detail page a `/procurement/[poId]`, `/procurement/quotes/[id]/review`, `/procurement/rfqs/[id]` cross-project? Oppure replicarle / redirezionarle a `/projects/[projectId]/procurement/{po|quote|rfq}/[id]`?

**Risposta Giorgio:** **Opzione B** — detail page si spostano sotto `/projects/{projectId}/procurement/...`.

**Motivazione (industry research):** tutti i 5 maggiori player del settore costruzioni usano URL project-scoped per le detail page:

| Vendor | URL pattern detail page |
|--------|--------------------------|
| Procore | `app.procore.com/projects/{projectId}/commitments/{poId}` |
| SAP S/4HANA EPPM | Detail bound to WBS element via project hierarchy |
| Oracle Primavera Unifier | `/projects/{shellId}/business-process/{recordId}` |
| Autodesk Construction Cloud | `acc.autodesk.com/projects/{projectId}/...` |
| Buildertrend | `app.buildertrend.com/Job/{jobId}/Selections/{itemId}` |

**Vantaggi consolidati:**
- RBAC tenant-isolation: enforced direttamente dall'URL pattern (middleware `withAuth()` può bloccare cross-project access basandosi sul path)
- Breadcrumb completo: `Έργο Παγκράτι > Προμήθειες > PO-1234` invece di `Hub > PO-1234`
- Audit trail più chiaro (path include sempre il contesto progetto)
- Search globale resta disponibile via top-bar search (indipendente dalla URL structure)

**URL pattern adottati:**
```
/projects/{projectId}/procurement/po/{poId}
/projects/{projectId}/procurement/quote/{quoteId}
/projects/{projectId}/procurement/rfq/{rfqId}
```

Le vecchie route `/procurement/[poId]`, `/procurement/quotes/[id]/review`, `/procurement/rfqs/[id]` saranno **rimosse** (no redirect — vedi nota implementativa Phase 2).

### D2. Sub-tab sotto project Procurement ✅ RESOLVED 2026-05-03

**Domanda:** 4 sub-tab (Overview, RFQ, Quote, PO) oppure consolidare in 2 (Sourcing = RFQ+Quote, Orders = PO)?

**Risposta Giorgio:** **Opzione A — 4 sub-tab**.

**Motivazione:**
- Pattern Procore (Bidding e Commitments come strumenti separati con sub-stage interni)
- Separation of concerns chiara: ogni sub-tab serve un singolo step del workflow
- Evita confusione "ho richiesto" vs "ho ricevuto" nella stessa surface
- Overview merita propria screen per KPI/charts del progetto (budget vs committed, % BOQ coperto)

**Sub-tab finali confermati:**
1. **Επισκόπηση** — KPI del progetto (budget vs committed per ΑΤΟΕ, # RFQ aperti, # PO in approvazione, % BOQ coperto, spend trend)
2. **Αιτήματα Προσφορών (RFQ)** — lista RFQ del progetto, create from BOQ, lifecycle workflow
3. **Προσφορές & Σύγκριση (Quote)** — lista quote del progetto, comparison panel, award decision
4. **Παραγγελίες (PO)** — lista PO del progetto, dettaglio, lifecycle

5° sub-tab opzionale **"Ανά Κτίριο"** (breakdown per `buildingId`) resta candidato Phase 1.5 — decisione finale rimandata a dopo Phase 1.

### D3. Building tab Procurement ✅ RESOLVED 2026-05-03

**Domanda:** confermi che NON serve un tab Procurement dentro il building (filtro `buildingId` nel project tab "Ανά Κτίριο" basta)?

**Risposta Giorgio:** **Confermato — NO tab Procurement dentro building**.

**Motivazione:**
- Asimmetria semantica: Επιμετρήσεις vivono nel building perché *originano* lì (data entry per-building con quantities differenti per ogni edificio); Procurement *consumano* le Επιμετρήσεις aggregate e **beneficiano di consolidation** (volume discounts, single delivery, single payment terms)
- Esempio concreto: invece che ordinare 200+150+180 sacchi cemento separati per Κτίριο 1/2/3, l'utente ordina 530 sacchi insieme allo stesso supplier → sconto volume + un solo trasporto
- Breakdown per-building disponibile via filter `buildingId` dentro le sub-tab Παραγγελίες/RFQ
- Single source of truth: nessuna duplicazione UX, nessuna confusione "questo PO è del building o del project?"
- Industry standard confermato (Procore/SAP/Primavera tutti project-level, no procurement tab a livello unit/building)

### D4. Vendor Master implementation ✅ RESOLVED 2026-05-03

**Domanda:** vista derivata da Contacts (no nuova collection) oppure entità autonoma `vendors/` collection?

**Risposta Giorgio:** **Opzione A — vista derivata da Contacts**.

**Motivazione:**
- Preserva SSoT contatti (ADR-282 Contact Persona Architecture)
- Un contatto può avere multiple personas simultaneamente (es. il mechanikos che è sia *supplier* di servizi che *customer* di una proprietà nel progetto — caso comune in Grecia)
- Zero duplicazione: cambio telefono/indirizzo si propaga ovunque automaticamente
- Pattern allineato a SAP S/4HANA (Business Partner unificato con role flags)

**Implementation pattern:**
1. **Identità del vendor** → vive in `contacts/` collection (filter `personaTypes array-contains 'supplier'`)
2. **KPI performance** → tabella laterale `vendor_metrics/` (cached/computed):
   - Schema: `{ contactId, totalOrders, totalSpend, avgLeadTimeDays, onTimeDeliveryRate, qualityScore, lastOrderDate, updatedAt }`
   - Aggiornata via background job o trigger Cloud Function on PO lifecycle change
   - Permette query veloci per dashboard senza ricalcolare ogni volta
3. **UI** → nuovo route `/procurement/vendors` che mostra cards aggregando dati Contact + vendor_metrics

### D5. Material Catalog implementation

**Domanda:** greenfield (nuova collection `materials/`) oppure estendere `boq-categories` con campo `materials[]`?

**Trade-off:**
- **Greenfield** — schema pulito, query indipendenti, ma da zero
- **Estensione boq-categories** — riusa SSoT esistente, ma `boq-categories` è metadata di catalogazione, materials sarebbero entità con prezzo/supplier

**Raccomandazione Claude:** greenfield (`materials/` collection nuova, link a `boq-categories.code` per ΑΤΟΕ).

### D6. Phase order

**Domanda:** Phase 1 (enrichment project tab) per primo è ok? Vantaggio: zero rotture, immediate UX win. Phase 2-6 successive senza urgenza.

**Raccomandazione Claude:** sì, Phase 1 prima. Mostra valore immediato.

### D7. Top-level cleanup timing

**Domanda:** Phase 2 (top-level redesign) può aspettare Phase 3-4 (Vendor Master + Material Catalog pronti) per non lasciare top-level "vuoto"?

**Trade-off:**
- **Phase 2 subito** — risk: top-level diventa landing page con solo "coming soon" cards
- **Phase 2 dopo Phase 3-4** — top-level resta invariato finché ha contenuto reale da mostrare (Vendor Master + Catalog)

**Raccomandazione Claude:** posticipare Phase 2 fino a Phase 3 completata.

---

## 7. Implementation tracking

> Verrà popolato dopo conferma D1-D7. Pattern: Phase X.Y con file paths + LOC estimate + test plan.

```
| Phase | Status | Files | LOC | Tests | Date |
|-------|--------|-------|-----|-------|------|
| 1     | 📋 PLANNED | TBD | TBD | TBD  | TBD  |
```

---

## 8. References

- **ADR-267** — Lightweight Procurement Module — `docs/centralized-systems/reference/adrs/ADR-267-lightweight-procurement-module.md`
- **ADR-327** — Quote Management & Comparison System — `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md`
- **ADR-329** — BOQ Granularity Property-Level — `docs/centralized-systems/reference/adrs/ADR-329-measurement-task-scope-granularity.md`
- **ADR-328** — Tabs SSoT (BaseTabs/StateTabs/RouteTabs) — `docs/centralized-systems/reference/adrs/ADR-328-tabs-ssot-consolidation.md`
- **ADR-326** — Tenant Org Structure — referenced in CLAUDE.md memory
- **CLAUDE.md** — N.7 Google-Level Quality, N.7.2 Architecture Checklist, N.0.1 ADR-Driven Workflow

### Industry pattern references

- Procore — Project Tools / Bidding / Commitments architecture
- SAP S/4HANA Construction (EPPM) — Vendor Master + Material Master + WBS-bound transactions
- Oracle Primavera Unifier — Bid → Award → Commitment workflow
- Autodesk Construction Cloud / BIM 360 Cost — BOQ-linked procurement
