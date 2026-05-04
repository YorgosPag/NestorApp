# ADR-330 — Procurement Hub Scoped Split (Company-wide vs Project-scoped)

**Status:** ✅ IMPLEMENTED — Phase 1 (S1-S6) complete 2026-05-04. Phase 3 (Vendor Master) complete 2026-05-04. Phase 4 (Material Catalog) complete 2026-05-04. Phase 6 (Cross-project Dashboard) complete 2026-05-04. Hub landing + project-scoped procurement tab + 5 KPIs + create buttons + vendor directory + material catalog (CRUD) + company-wide dashboard widgets (4 KPI, spend-by-category, monthly trend).
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
| 2026-05-03 | ✅ **D5 RESOLVED** — Material Catalog implementation: **Opzione A — greenfield collection `materials/`** (no estensione di `boq-categories`). Motivazione: (a) tutti i 5 maggiori player (Procore Material Library, SAP Material Master, Oracle Primavera material catalog, Autodesk Construction Cloud Materials, Buildertrend Cost Items) tengono i materiali come entità separate dalle work categories, (b) i materiali hanno lifecycle proprio — prezzo/supplier preferito cambiano spesso (mensili), mentre le categorie ΑΤΟΕ sono metadata stabili pluriennali, (c) separation of concerns: `boq-categories` resta SSoT per categorizzazione lavori (ADR-175), `materials/` SSoT per anagrafica materiali con price history e preferred suppliers, (d) query veloci per dashboard "tutti i materiali con vendor preferito" senza join attraverso categorie. Schema target: `{ id: 'mat_*', companyId, code, name, unit, atoeCategoryCode (FK→boq-categories), preferredSupplierContactIds[], avgPrice, lastPrice, lastPurchaseDate, createdAt }`. |
| 2026-05-03 | 🔍 **Phase 1 deep-dive started** — riletto ADR su richiesta Giorgio. Identificate 5 nuove decisioni Phase 1 che bloccano implementation: D8 (RouteTabs vs StateTabs), D9 (top-level dual-surface durante transizione), D10 (detail page URL durante Phase 1), D11 (Επισκόπηση scope), D12 (create buttons in sub-tab). |
| 2026-05-03 | ✅ **D8 RESOLVED** — Sub-tab navigation pattern: **Opzione A — RouteTabs** (URL-based, ognuna delle 4 sub-tab ha URL propria). Motivazione: tutti i 5 maggiori player del settore (Procore `/projects/{id}/bidding`, SAP Fiori URL hash, Oracle Primavera deep-link, Autodesk ACC `/projects/{id}/cost`, Buildertrend `/Job/{id}/Selections`) usano routing URL-based. Vantaggi: (a) shareable links tra membri ομάδας έργου (caso d'uso quotidiano costruzioni), (b) browser F5/back/forward funzionano correttamente, (c) bookmarkable per sub-tab, (d) audit/analytics possono misurare uso per sub-tab via URL. URL pattern: `/projects/{projectId}/procurement/{overview\|rfq\|quote\|po}`. Implementazione: `RouteTabs` da ADR-328 SSoT. |
| 2026-05-03 | ✅ **D9 RESOLVED — Phase 1 + Phase 2 MERGED into single Phase 1** (Opzione Δ — full structural move). Motivazione: Giorgio chiarisce che l'app è in fase pre-launch e l'unico utente attuale è Giorgio stesso. Tutta la logica di "transition gentleness" (status quo, dual-surface, gradual migration) era costruita per proteggere existing users — premessa che non si applica. Pattern industry: greenfield internal tool senza utenti = direct-to-final-state, no transition phase (Procore/SAP/Autodesk usano transition solo perché hanno migliaia di utenti in production). Conseguenze: (a) Phase 1 ora include top-level Hub redesign + detail page migration project-scoped (D1) + ProcurementSubNav semantics change + rimozione vecchie route top-level, (b) D6 auto-risolto (Phase 1 prima, ora include molto più), (c) D7 auto-risolto (no "wait for Phase 3-4" — top-level mostra placeholder cards "Προμηθευτές: έρχεται", "Υλικά: έρχεται"), (d) D10 auto-risolto (link da project tab → direct project-scoped URL, no transition URLs). |
| 2026-05-03 | ✅ **D11 RESOLVED — Επισκόπηση sub-tab: ALL 5 KPIs in Phase 1** (Opzione A — full enterprise scope). Motivazione: Giorgio attiva GOL + SSOT mandate esplicito ("ENTERPRISE applicazione, non μπακάλικο γειτονιάς"). Time/file-count non sono trade-off accettabili. Phase 1 deve mostrare la full Project Procurement Overview da day 1: (1) # RFQ ανοιχτά, (2) # PO σε έγκριση, (3) Total committed spend, (4) Budget vs Committed bar chart per ΑΤΟΕ, (5) % BOQ καλυμμένο da PO items. Industry pattern: SAP S/4HANA Fiori usa 6-8 KPI tiles dal day 1, Procore 4-5 cards + chart. Implementation requirements: (a) extension `procurementDashboardStats` con `projectScoped: true` flag, (b) nuovo aggregator `projectBoqCoverageStats` (join `purchase_order_items.boqItemId` ↔ `boq_items` per progetto), (c) composite indexes Firestore per query veloci, (d) component-per-KPI sotto 40 LOC ciascuno (CLAUDE.md N.7.1), (e) optimistic updates + zero race conditions (N.7.2), (f) SSoT: nessuna duplicazione di stats logic, riuso `useSupplierMetrics` per #3. |
| 2026-05-03 | ✅ **D12 RESOLVED — Create button per sub-tab** (Opzione A — kουμπί δημιουργίας in ogni sub-tab). Motivazione: tutti i 5 maggiori player del settore (Procore "+ Create" per tool, SAP Fiori plus shortcut per app card, Oracle Primavera per business process, Autodesk ACC per tool, Buildertrend "New" per section) usano questo pattern. Construction reality richiede sia guided workflow (BOQ → RFQ → Quote → PO) sia ad-hoc creation (post-fact PO da fatture arrivate, emergency orders, direct deals con telefono). Implementation: (a) bottone "+ Νέο" top-right di ciascuna sub-tab RFQ/Quote/PO (Overview no), (b) `projectId` auto-precompilato in tutti i form (no dropdown progetto), (c) bonus link "Δημιουργία RFQ" da Επιμετρήσεις tab del progetto verso `/projects/{projectId}/procurement/rfq?fromBoq={boqItemId}`, (d) Quote sub-tab default è "create from RFQ" (Quote standalone disponibile ma secondario), (e) tutti i bottoni chiamano gli stessi endpoint API esistenti — SSoT. |
| 2026-05-03 | 🎯 **ALL DECISIONS RESOLVED — ADR APPROVED** — D1-D12 completati. Status: 📋 PROPOSED → ✅ APPROVED. Phase 1 ready for implementation planning. Mandate Giorgio: GOL + SSOT, full enterprise scope, no MVP variants. Phase 1 scope finale: project tab enrichment (1.A) + detail page migration project-scoped (1.B) + top-level Hub redesign con placeholder cards (1.C) + 5 KPIs Επισκόπηση + create buttons in sub-tab + i18n SSoT + composite indexes. |
| 2026-05-04 | ✅ **S4 COMPLETED** — Create buttons in sub-tab + BOQ→RFQ link. Key findings: (1) All 3 list components (`RfqList`, `PurchaseOrderList`, `QuoteList`) already had `onCreateRfq`/`onCreateNew` callback props — no new button components needed (SSoT reuse); (2) `ProjectPoListClient` had broken URL (`/procurement?new=1` → list page, form never opened) — fixed to `/procurement/new?projectId=X`; (3) `ProjectQuoteListClient` was missing `onCreateNew` → added `handleCreate` → `/procurement/quotes/scan?projectId=X` (scan page already reads `projectId` from URL); (4) `MeasurementsTabContent` BOQ→RFQ link was missing `projectId` — fixed using `building.projectId` (available in Building type); (5) `PurchaseOrderForm` / `usePurchaseOrderForm` / `ProcurementDetailPageContent` chain enhanced with `initialProjectId` prop — reads `?projectId=` URL param on `poId==='new'`, pre-fills project selector. 7 files MODIFY, 0 NEW. |
| 2026-05-04 | ✅ **S3 COMPLETED** — Επισκόπηση 5 KPIs. Files: 15 (11 NEW + 4 MODIFY). Key findings: (1) `PurchaseOrderStatus` has no `pending_approval` — KPI #2 maps to `status === 'draft'` (awaiting approval) per `PO_STATUS_TRANSITIONS`; (2) `RfqStatus` has no `open` — KPI #1 maps to `status === 'active'`; (3) BOQ costs NOT stored in Firestore — computed server-side from `(materialUnitCost + laborUnitCost + equipmentUnitCost) × estimatedQuantity × (1 + wasteFactor)`; (4) `useSupplierMetrics` is per-supplier hook — not reusable for cross-project KPI #3; (5) PO queries must include `isDeleted == false` filter (soft-delete pattern). Architecture: API route `/api/procurement/project-overview-stats` → 2 server aggregators (`projectProcurementStats` KPIs 1/2/3, `projectBoqCoverageStats` KPIs 4/5) → `useProjectProcurementStats` hook (ADR-300 stale cache) → `ProjectProcurementOverview` container → 5 KPI components each <40 LOC. Recharts `BarChart` for KPI #4. `ComponentErrorBoundary` per-KPI. i18n: 16 keys in `procurement.overview.kpi.*` namespace. Composite indexes: 2 new (purchase_orders + rfqs). |
| 2026-05-03 | 📋 **Phase 1 SESSION BREAKDOWN added** (§5.1 + §5.2 + §7 popolati). Mandate Giorgio: ogni sessione completabile in **una singola chat session** con context pulito, **Plan Mode preferito** a Orchestrator (controllo + token efficiency). Phase 1 suddivisa in **6 sessioni**: S1 detail page migration (additive), S2 project tab + RouteTabs, S3 Επισκόπηση 5 KPIs, S4 create buttons, S5 top-level Hub redesign + cleanup, S6 verification + finalize. Token budget per sessione ~80-120k. Modello consigliato Opus 4.7 per ogni sessione (architettura + implementazione in stesso Plan Mode). Stima totale: ~60-90 file su 6 sessioni. §7 Implementation tracking pronto a essere popolato sessione per sessione. |
| 2026-05-04 | ✅ **Phase 3 COMPLETED** — Vendor Master surface at `/procurement/vendors`. Files: 5 (1 NEW component + 1 MODIFY page + 1 MODIFY type + 1 MODIFY service + 2 MODIFY i18n). Key changes: (1) `SupplierMetrics` type extended with `lastOrderDate: string | null` + `tradeSpecialties: string[]`; (2) `supplier-metrics-service.ts` — `fetchSupplierNames` replaced by `fetchSupplierDetails` returning name + tradeSpecialties from `SupplierPersona.tradeSpecialties` (ADR-327 §9.3); `calcLastOrderDate()` added; `calculateSupplierMetrics` + `getSupplierComparison` updated; (3) `VendorCard.tsx` new component — name, trade specialties badges (up to 3 + overflow), orders count, on-time %, total spend, last order date; (4) `vendors/page.tsx` — full grid replacing placeholder: `usePOSupplierContacts` (master contact list) merged with `useSupplierComparison` (KPIs), client-side search, loading skeleton, 3 empty states (no vendors / no search results / loading); (5) 8 new i18n keys in `hub.vendorMaster.*` (el + en). Architecture: contacts SSoT preserved (D4 ADR decision — derived view, no new collection). |
| 2026-05-04 | ⚠️ **S5-GAP identificato** — `/procurement/quotes` e `/procurement/rfqs` → 404 dopo S5. Nessun bottone per raggiungere scan page. ProcurementSubNav manca tab Προσφορές/RFQ. Fix documentato in §3 Phase S5-GAP. Da implementare prossima sessione con Sonnet 4.6. |
| 2026-05-04 | ✅ **Phase 6 COMPLETED** — Cross-project Dashboard on hub landing. Files: 6 (2 NEW + 4 MODIFY). Architecture: `useProcurementDashboard` hook = pure `useMemo` computation on `usePurchaseOrders()` data (no new API, ADR-300 stale cache shared). `ProcurementDashboardSection` component: 4 KPI cards (TotalPOs, Committed€, Delivered€, ActiveSuppliers) + CategoryBars (top 5 ATOE categories by spend, from `items[].categoryCode`) + MonthlyTrend (last 6 months CSS bars, from `dateCreated`). Empty state (noPOs) guards render. i18n: 9 new keys `hub.dashboard.*` in el+en. NEW files: `useProcurementDashboard.ts`, `ProcurementDashboardSection.tsx`. MODIFY: `HubLanding.tsx` (fragment wrapper + import), `hooks/procurement/index.ts` (barrel export), `el+en/procurement.json` (9 keys each). |
| 2026-05-04 | ✅ **Phase 4 COMPLETED** — Material Catalog surface at `/procurement/materials`. Files: 17 (12 NEW + 5 MODIFY). Greenfield collection `materials/` (D5 ADR decision — separate from `boq-categories`). Architecture: (1) `Material` entity = `{ id: 'mat_*', companyId, code (unique per company), name, unit (BOQMeasurementUnit), atoeCategoryCode (FK→ATOE_MASTER_CATEGORIES), description, preferredSupplierContactIds[] (max 5, FK contacts/supplier persona), avgPrice, lastPrice, lastPurchaseDate, isDeleted (soft-delete), createdAt, updatedAt, createdBy }`; (2) Server-side validation: ATOE code, code length, code uniqueness via `where(companyId,==).where(code,==).where(isDeleted,==false)`, max 5 suppliers de-dup; (3) Soft-delete pattern (PO-style audit trail); (4) `MaterialCodeConflictError` → 409, `MaterialValidationError` → 400. NEW files: `subapps/procurement/types/material.ts`, `subapps/procurement/services/material-service.ts` (CRUD + audit fire-and-forget), `app/api/procurement/materials/{route,[materialId]/route}.ts`, `hooks/procurement/useMaterials.ts` (Firestore onSnapshot + API mutations + ADR-300 stale cache), 4 components in `components/procurement/materials/{MaterialCard,MaterialList,MaterialFilters,MaterialFormDialog}.tsx`, `app/procurement/materials/page.tsx` (rewrite — replaces placeholder). MODIFY files: `enterprise-id-prefixes` (`MATERIAL: 'mat'`), `enterprise-id.service` + `enterprise-id-convenience` (`generateMaterialId`), `firestore-collections` (`MATERIALS`), `domain-constants.ENTITY_TYPES.MATERIAL`, `audit-trail.AuditEntityType` (+'material'), `firestore.rules` (`/materials/{materialId}` read tenant-scoped, writes Admin-only), `firestore.indexes.json` (3 composite indexes: createdAt-desc, +atoeCategory, +preferredSuppliers array-contains), 2× `i18n/locales/{el,en}/procurement.json` (~50 keys `hub.materialCatalog.*` incl. units, form, deleteConfirm, toast). Decisions applied: avgPrice/lastPrice manual edit MVP (auto-update from PO out-of-scope, future Phase 4.5); contacts SSoT preserved (FK only); boq-categories SSoT preserved (FK ATOE codes); ADR-282 personas pattern reused for supplier picker. Sub-tasks for future Phase 4.5: Cloud Function trigger on PO `delivered` → recompute `avgPrice` (rolling 12mo) + `lastPrice` + `lastPurchaseDate`. |
| 2026-05-04 | ✅ **S6 COMPLETED** — Verification + finalize. Files: 6 (1 NEW + 5 MODIFY). Regressions found and fixed: (1) `ProcurementDetailPageContent` `handleSuccess`+`handleDuplicate` navigated to deleted `/procurement/${id}` — fixed to `getPoDetailUrl` (reads `po.projectId` for edits, `initialProjectId ?? pathProjectId` for create); (2) `params.poId ?? 'new'` fallback added so dedicated `/procurement/new` route works without `[poId]` segment; (3) `/procurement/new/page.tsx` created (restores PO create form deleted with `[poId]` catch-all in S5); (4) `ContactPurchaseOrdersSection.handleView` fixed — was `/procurement/${poId}`, now `getPoDetailUrl(po.projectId, po.id)`; (5) `ProjectPoListClient.handleDuplicate` fixed — was `/procurement/${poId}?duplicate=1`, now `getPoDetailUrl(projectId, poId)?duplicate=1`; (6) `purchase-orders/[id]/page.tsx` fixed — was redirecting to deleted route, now fetches PO server-side via `getPO()` and redirects to canonical project-scoped URL (restores audit trail deep-links). Audits: TS 0 new errors, i18n 0 violations, SSoT 0 violations. ADR status → IMPLEMENTED. adr-index.md → IMPLEMENTED. |
| 2026-05-04 | ✅ **S5 COMPLETED** — Top-level Hub redesign. Files: 19 (9 NEW + 7 MODIFY + 3 DELETE). Key decisions: (1) Old detail route pages `/procurement/rfqs/[id]` and `/procurement/quotes/[id]/review` kept alive (not deleted) — internal app call-sites (ContactRfqInvitesSection, ManualQuoteDialog, scan page) still reference them; back-nav within client components updated from deleted list pages to `/procurement` Hub; (2) Old LIST pages deleted: `/procurement/[poId]/page.tsx`, `/procurement/quotes/page.tsx`, `/procurement/rfqs/page.tsx`; (3) ProcurementSubNav tabs: [Hub, Vendors, Materials, Agreements, Analytics]; (4) HubLanding grid 4 cards — VendorMasterCard (reuses usePOSupplierContacts supplier count), MaterialCatalogCard (placeholder), FrameworkAgreementsCard (placeholder), SpendAnalyticsCard (reuses usePurchaseOrders for total POs + spend); (5) 4 placeholder pages with ProcurementSubNav for vendor/material/agreements/analytics sections; (6) i18n: 25 new keys in hub.* + nav.*; (7) ProcurementPageContent stripped from ~257 LOC to ~40 LOC (Hub landing only). |
| 2026-05-03 | ✅ **S1 COMPLETED** — Detail page migration project-scoped (additive). Files: 8 (7 NEW + 1 MODIFY): (1) `src/lib/navigation/procurement-urls.ts` SSoT helper (`getPoDetailUrl` / `getQuoteDetailUrl` / `getRfqDetailUrl`), (2) `src/server/auth/require-project-for-page.ts` server-component tenant guard (riusa `requireProjectInTenant` SSoT), (3) `src/app/projects/[id]/procurement/layout.tsx` RBAC guard via `notFound()` su mismatch, (4) `src/app/projects/[id]/procurement/po/[poId]/page.tsx` riusa `LazyRoutes.ProcurementDetail`, (5) `src/app/projects/[id]/procurement/rfq/[rfqId]/page.tsx` riusa `RfqDetailClient`, (6) `src/app/projects/[id]/procurement/quote/[quoteId]/page.tsx` redirect → `/review`, (7) `src/app/projects/[id]/procurement/quote/[quoteId]/review/page.tsx` riusa `QuoteReviewClient`, (8) `src/subapps/procurement/components/RfqList.tsx` MODIFY — `handleView(rfq)` ora usa `getRfqDetailUrl(rfq.projectId, rfq.id)`. Vecchie URL top-level `/procurement/[poId]`, `/procurement/quotes/[id]/review`, `/procurement/rfqs/[id]` **restano funzionanti** (kill in S5). Zero hardcoded string templating per le nuove URL — helper SSoT enforced. |
| 2026-05-03 | ✅ **S2 COMPLETED** — Project tab restructure + RouteTabs + 4 sub-tab wiring. Architectural finding: project tabs sono state-based (`UniversalTabsRenderer` in `/projects?projectId=X`), non URL-segments — D8 RouteTabs richiede ejection nella sezione standalone `/projects/[id]/procurement/*`. Files: 12 (10 NEW + 2 MODIFY + 2 i18n MODIFY): (1) `src/components/projects/procurement/ProjectProcurementTabs.tsx` NEW — RouteTabs SSoT con 4 tab dinamiche (`useMemo([projectId])`), (2) `src/components/projects/procurement/BackToProjectLink.tsx` NEW — back link a `/projects?projectId=X` per riprendere project tab strip, (3-5) `src/components/projects/procurement/clients/{ProjectRfqListClient,ProjectQuoteListClient,ProjectPoListClient}.tsx` NEW — thin wrapper che fetchano data filtrata per `projectId` + handle navigation via `procurement-urls` helper (S1), (6) `src/app/projects/[id]/procurement/page.tsx` NEW — server redirect → `/overview`, (7) `src/app/projects/[id]/procurement/overview/page.tsx` NEW — stub "Coming soon" (riempito in S3), (8-10) `src/app/projects/[id]/procurement/{rfq,quote,po}/page.tsx` NEW — server pages che passano `projectId` ai client wrapper, (11) `src/app/projects/[id]/procurement/layout.tsx` MODIFY — RBAC S1 invariato + aggiunge `<BackToProjectLink>` + `<ProjectProcurementTabs>` sopra `{children}`, (12) `src/components/projects/tabs/ProcurementProjectTab.tsx` MODIFY — diventa `router.replace('/projects/X/procurement/overview')` redirect-on-mount + Skeleton fallback (pattern Procore Commitments tool), (13-14) `src/i18n/locales/{el,en}/projects.json` MODIFY — nuove keys `tabs.subtabs.procurement.{overview,rfq,quote,po,backToProject,overviewComingSoon}` (zero hardcoded). ComparisonPanel **deferred** a sessione successiva (richiede ricostruzione `useQuotesPageState` — fuori scope S2); in S2 il click sulla quote naviga direttamente a `getQuoteDetailUrl(projectId, id, {review: true})`. RouteTabs SSoT da ADR-328 (no custom impl). Tutti i file < 500 LOC, function < 40 LOC. |

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

### Phase 1 — Full structural move (project tab enrichment + top-level Hub redesign + detail page migration)

> **Nota:** Phase 1 e Phase 2 originariamente separate sono state **MERGED** in singola Phase 1 dopo D9 (2026-05-03). Motivazione in changelog. Phase 3-7 invariate.

**1.A — Project tab enrichment (RouteTabs):**
- Riscrivere `src/components/projects/tabs/ProcurementProjectTab.tsx` con `RouteTabs` (ADR-328 SSoT) + 4 sub-tab (Overview, RFQ, Quote, PO)
- URL pattern: `/projects/{projectId}/procurement/{overview|rfq|quote|po}` (D8)
- Default redirect: `/projects/{projectId}/procurement` → `/projects/{projectId}/procurement/overview`
- Riusare `RfqList`, `QuoteList`, `PurchaseOrderList`, `ComparisonPanel` esistenti con filtro `projectId`
- Aggiungere variante `procurementDashboardStats` con flag `projectScoped: true`
- i18n: `src/i18n/locales/{el,en}/projects.json` aggiungere keys `tabs.subtabs.procurement.{overview,rfq,quote,po}`

**1.B — Detail page migration (project-scoped):**
- Spostare `/procurement/[poId]` → `/projects/{projectId}/procurement/po/{poId}`
- Spostare `/procurement/quotes/[id]/review` → `/projects/{projectId}/procurement/quote/{quoteId}/review`
- Spostare `/procurement/rfqs/[id]` → `/projects/{projectId}/procurement/rfq/{rfqId}`
- Rimuovere vecchie route top-level (no redirect — D9 motivazione: no users to migrate)
- RBAC enforcement: `withAuth()` middleware verifica `projectId` dell'URL contro permessi utente
- Update tutti i call-site che linkano alle vecchie URL (Grep esaustivo prima del commit)

**1.C — Top-level Hub redesign:**
- Trasformare `/procurement` da "PO list" a "Hub landing page" con 4 card placeholder:
  - **Vendor Master** — "Έρχεται (Phase 3)" + count contacts con persona='supplier'
  - **Material Catalog** — "Έρχεται (Phase 4)"
  - **Framework Agreements** — "Έρχεται (Phase 5)"
  - **Cross-project Spend Analytics** — "Έρχεται (Phase 6)" + mini-stats da `procurementDashboardStats` no filter
- Aggiornare `ProcurementSubNav` semantica: tabs diventano [Hub, Vendors, Materials, Agreements, Analytics] (vendors/materials/agreements/analytics sono "coming soon" placeholder pages)
- Sostituire viste cross-project "All Activity" con la search bar globale (search by `PO-NNNN` o `RFQ-NNNN` ovunque nell'app)

**Rischio:** medio (più file di un Phase 1 puro additive, ma blast radius accettabile in pre-launch — unico utente è Giorgio).

---

### 5.1 — Phase 1 Session Breakdown (Plan Mode)

> **Mandate Giorgio (2026-05-03):** ogni sessione deve completarsi in **una singola chat session** con context pulito. Plan Mode preferito a Orchestrator per controllo + token efficiency. Modello consigliato per ogni sessione: **Opus 4.7** (architettura + planning), implementazione subito dopo nel medesimo Plan Mode.
>
> **Token budget target per sessione:** ~80-120k (entro warning ~70%, sotto soglia /clear ~90%).
>
> **Pattern di sessione:**
> 1. `/clear` per pulire context
> 2. `cd C:\Nestor_Pagonis` + leggere ADR-330 §5.1 [questa sezione]
> 3. Entrare in Plan Mode
> 4. Proporre piano dettagliato (file paths, signatures, SSoT touchpoints)
> 5. Giorgio approva
> 6. Esegue implementazione
> 7. Verifica TypeScript + lint
> 8. Aggiorna ADR (§7 Implementation tracking + changelog)
> 9. Commit (no push se non ordinato)
> 10. Report finale + suggerimento prossima sessione

#### Phase 1 — Sessions overview

| Sessione | Scope | Pre-req | Files (stima) | Risk |
|----------|-------|---------|---------------|------|
| **S1** | Detail page migration project-scoped (additive) | — | ~12-18 | Bassa |
| **S2** | Project tab restructure + RouteTabs + sub-tab wiring | S1 | ~12-18 | Bassa |
| **S3** | Επισκόπηση 5 KPIs + aggregators + indexes | S2 | ~14-20 | Media |
| **S4** | Create buttons in sub-tab + bonus link da BOQ | S2 | ~8-12 | Bassa |
| **S5** | Top-level Hub redesign + ProcurementSubNav + cleanup vecchie route | S1, S2 | ~12-18 | Media |
| **S6** | Verification end-to-end + ADR §7 finalize + memory update | S1-S5 | ~3-6 | Minima |

**Totale Phase 1: ~60-90 file modificati/creati su 6 sessioni.**

---

#### S1 — Detail page migration project-scoped (additive)

**Goal:** creare le nuove route `/projects/{projectId}/procurement/{po|quote|rfq}/{id}` riusando i componenti detail esistenti. Le vecchie route top-level **restano funzionanti** (no rimozione in S1) — verranno killate in S5.

**Pre-requisiti:** nessuno. Sessione puramente additive.

**Files target (~12-18):**
- `src/app/(authenticated)/projects/[id]/procurement/po/[poId]/page.tsx` (NEW — wrapper su `PurchaseOrderDetail`)
- `src/app/(authenticated)/projects/[id]/procurement/quote/[quoteId]/page.tsx` (NEW)
- `src/app/(authenticated)/projects/[id]/procurement/quote/[quoteId]/review/page.tsx` (NEW — review screen)
- `src/app/(authenticated)/projects/[id]/procurement/rfq/[rfqId]/page.tsx` (NEW)
- Eventuali sub-page (edit/duplicate) speculari alle top-level esistenti
- `src/lib/auth/middleware.ts` o `src/middleware.ts` — RBAC check: `projectId` URL deve appartenere alla company dell'utente
- Helper `src/lib/navigation/procurement-urls.ts` (NEW SSoT) — funzioni `getPoDetailUrl(projectId, poId)`, `getQuoteDetailUrl`, `getRfqDetailUrl`. Tutti i call-site nel codebase useranno questo helper (no string templating).
- Refactor call-site nei componenti list (`PurchaseOrderList`, `QuoteList`, `RfqList`, `ComparisonPanel`) per usare il nuovo helper — risolve link agli URL nuovi
- i18n: nessuna nuova key (riusa esistenti dei detail components)

**Tasks:**
1. Plan Mode: enumerare call-site con Grep di pattern URL hardcoded (`/procurement/[poId]`, `/procurement/quotes`, `/procurement/rfqs`)
2. Creare helper `procurement-urls.ts` SSoT (10-15 LOC, 3 funzioni semplici)
3. Creare le 4 nuove route page (riuso componenti detail esistenti)
4. Refactor call-site al nuovo helper
5. Aggiungere RBAC guard nel layout `[id]/procurement/layout.tsx` se non già coperto

**Validation:**
- Cliccando un PO/Quote/RFQ da QUALSIASI list → apre il detail nella nuova URL
- Vecchie URL top-level continuano a funzionare (S5 le killerà)
- `npx tsc --noEmit` clean per i file toccati

**Plan Mode:** sì (architettura URL pattern + helper SSoT + call-site refactor — beneficia di plan upfront).

**Token budget:** ~80-100k.

---

#### S2 — Project tab restructure + RouteTabs + sub-tab wiring

**Goal:** trasformare il `ProcurementProjectTab.tsx` (oggi 22 LOC stub) in surface RouteTabs con 4 sub-tab. Wire delle 3 sub-tab transazionali (RFQ/Quote/PO) alle list esistenti filtrate per `projectId`. Sub-tab Overview = stub temporaneo (sarà popolato in S3).

**Pre-requisiti:** S1 completata (le list devono linkare alle nuove URL project-scoped).

**Files target (~12-18):**
- `src/app/(authenticated)/projects/[id]/procurement/layout.tsx` (NEW — RouteTabs setup)
- `src/app/(authenticated)/projects/[id]/procurement/page.tsx` (modify — redirect a `/overview`)
- `src/app/(authenticated)/projects/[id]/procurement/overview/page.tsx` (NEW — stub "Coming in S3")
- `src/app/(authenticated)/projects/[id]/procurement/rfq/page.tsx` (NEW — wraps `<RfqList projectId={projectId} />`)
- `src/app/(authenticated)/projects/[id]/procurement/quote/page.tsx` (NEW — wraps `<QuoteList + ComparisonPanel projectId={projectId} />`)
- `src/app/(authenticated)/projects/[id]/procurement/po/page.tsx` (NEW — wraps `<PurchaseOrderList projectId={projectId} />`)
- `src/components/projects/tabs/ProcurementProjectTab.tsx` (modify — diventa thin wrapper o eliminato a favore di pattern Next.js layout/page)
- `src/i18n/locales/el/projects.json` + `src/i18n/locales/en/projects.json` — nuove keys `tabs.subtabs.procurement.{overview,rfq,quote,po}`
- Verifica config navigazione `src/components/navigation/config/navigation-entities/entity-config.ts` (project tab Procurement order 12.5 invariato)
- ADR-328 RouteTabs SSoT verifica: usare il componente esistente, no custom tab impl

**Tasks:**
1. Plan Mode: scegliere pattern Next.js (layout.tsx + page.tsx per sub-tab) vs single page con state. Vincolato a RouteTabs URL-based (D8) → layout.tsx + page.tsx.
2. Setup RouteTabs in layout.tsx con definizione delle 4 sub-tab
3. Creare le 4 sub-page wrapper (Overview = stub, RFQ/Quote/PO = wire list esistenti)
4. Aggiungere i18n keys
5. Verificare default redirect overview funziona

**Validation:**
- Click su tab "Προμήθειες" del progetto → apre `/projects/[id]/procurement/overview` (stub message)
- Click su sub-tab RFQ → mostra `RfqList` filtrato per `projectId`
- Stessa cosa per Quote e PO
- Browser back/forward funziona tra sub-tab
- F5 mantiene la sub-tab corrente
- `npx tsc --noEmit` clean

**Plan Mode:** sì (architettura layout/page Next.js + RouteTabs pattern).

**Token budget:** ~80-100k.

---

#### S3 — Επισκόπηση 5 KPIs + aggregators + Firestore indexes

**Goal:** popolare la sub-tab Overview con i 5 KPI definiti in D11. Implementazione GOL-level: component-per-KPI < 40 LOC, optimistic updates, loading skeletons, error boundaries.

**Pre-requisiti:** S2 completata (Overview stub esiste, deve essere riempito).

**Files target (~14-20):**
- `src/services/procurement/aggregators/projectProcurementStats.ts` (NEW SSoT — extension di `procurementDashboardStats` con flag `projectScoped`)
- `src/services/procurement/aggregators/projectBoqCoverageStats.ts` (NEW SSoT — join `purchase_order_items.boqItemId` ↔ `boq_items.quantity` per progetto)
- `src/hooks/useProjectProcurementStats.ts` (NEW — fetch + cache + refresh)
- `src/components/projects/procurement/overview/ProjectProcurementOverview.tsx` (NEW container, ~40 LOC)
- `src/components/projects/procurement/overview/kpi/KpiOpenRfqs.tsx` (NEW, <40 LOC)
- `src/components/projects/procurement/overview/kpi/KpiPendingApprovalPos.tsx` (NEW)
- `src/components/projects/procurement/overview/kpi/KpiTotalCommittedSpend.tsx` (NEW)
- `src/components/projects/procurement/overview/kpi/ChartBudgetVsCommitted.tsx` (NEW — bar chart per ΑΤΟΕ, riusa libreria chart già nel progetto)
- `src/components/projects/procurement/overview/kpi/KpiBoqCoverage.tsx` (NEW)
- `src/components/projects/procurement/overview/skeleton/KpiSkeleton.tsx` (NEW — shared loading skeleton)
- `firestore.indexes.json` — composite indexes per query KPI (es. `purchase_orders` su `companyId + projectId + status`)
- `src/i18n/locales/{el,en}/procurement.json` — keys `overview.kpi.{openRfqs,pendingPos,committedSpend,budgetVsCommitted,boqCoverage}.{label,tooltip,empty}`
- `src/app/(authenticated)/projects/[id]/procurement/overview/page.tsx` (modify — sostituisce stub con `<ProjectProcurementOverview projectId={projectId} />`)

**Tasks:**
1. Plan Mode: schema aggregator + index design + component decomposition + ricerca SSoT esistenti (Grep `useSupplierMetrics`, `procurementDashboardStats` per riuso)
2. Implementare aggregators con tipi forti, no `any`
3. Implementare hook con SWR pattern o React Query (verificare quale già usato)
4. Implementare 5 KPI components, ognuno < 40 LOC
5. Skeleton + error boundary
6. Deploy Firestore indexes (`firebase deploy --only firestore:indexes` background)
7. i18n SSoT keys (zero hardcoded)
8. Wire in Overview page

**Validation:**
- Sub-tab Overview mostra 5 KPI cards/charts con dati reali
- Loading skeleton durante fetch
- Empty state ben gestito (es. progetto senza BOQ → KPI #4/#5 mostrano "δεν υπάρχει BOQ")
- Error boundary cattura crash di singolo KPI senza rompere la pagina
- `npx tsc --noEmit` clean
- Composite indexes deploy success

**Plan Mode:** sì (decomposition + aggregator architecture + index strategy critici).

**Token budget:** ~100-120k (sessione più densa).

---

#### S4 — Create buttons in sub-tab + bonus link da BOQ

**Goal:** aggiungere bottoni "+ Νέο" in ogni sub-tab (RFQ, Quote, PO) con `projectId` auto-precompilato. Aggiungere link "Δημιουργία RFQ" da Επιμετρήσεις tab del progetto.

**Pre-requisiti:** S2 completata (sub-tab esistono).

**Files target (~8-12):**
- `src/components/projects/procurement/actions/NewRfqButton.tsx` (NEW — bottone + dialog/modal o redirect a form)
- `src/components/projects/procurement/actions/NewQuoteButton.tsx` (NEW — default "create from RFQ", secondary "standalone")
- `src/components/projects/procurement/actions/NewPoButton.tsx` (NEW — supporta ad-hoc PO senza RFQ/Quote precedente)
- Modify sub-tab pages RFQ/Quote/PO per includere il bottone top-right
- `src/components/projects/measurements/...` (modify) — aggiungere bottone "Δημιουργία RFQ" su BOQ items selezionati → naviga a `/projects/{projectId}/procurement/rfq?fromBoq={boqItemId}`
- Wire `?fromBoq=` query param nel form RFQ (precompile items)
- `src/i18n/locales/{el,en}/projects.json` — keys `tabs.subtabs.procurement.actions.{newRfq,newQuote,newPo,createFromBoq}`

**Tasks:**
1. Plan Mode: identificare se i form RFQ/Quote/PO esistenti accettano `projectId` come prop / query param. Se sì → riuso. Se no → adattare con prop `projectId` defaultato dal URL.
2. Implementare 3 buttons con design consistent (icon + label, top-right placement)
3. Aggiungere wire `fromBoq` query param nel form RFQ esistente
4. Bottone in Επιμετρήσεις tab che apre RFQ form precompilato
5. i18n SSoT

**Validation:**
- Click su "+ Νέο RFQ" in sub-tab RFQ → apre form con `projectId` precompilato
- Stesso per Quote e PO
- Bottone in Επιμετρήσεις → apre RFQ form con BOQ items precompilati
- Tutti i create flow chiamano gli endpoint API esistenti (no nuovi endpoint server)
- `npx tsc --noEmit` clean

**Plan Mode:** sì (verifica riuso form esistenti vs nuovi).

**Token budget:** ~70-90k.

---

#### S5 — Top-level Hub redesign + ProcurementSubNav + cleanup vecchie route

**Goal:** trasformare `/procurement` da PO list a Hub landing con 4 placeholder cards. Aggiornare `ProcurementSubNav` semantica. **Rimuovere** le vecchie route top-level detail (S1 le aveva lasciate vive).

**Pre-requisiti:** S1 (nuove URL detail attive) + S2 (project tab funzionante).

**Files target (~12-18):**
- `src/components/procurement/pages/ProcurementPageContent.tsx` (modify — diventa Hub landing)
- `src/components/procurement/hub/HubLanding.tsx` (NEW — container 4 cards)
- `src/components/procurement/hub/cards/VendorMasterCard.tsx` (NEW — placeholder + count contacts supplier)
- `src/components/procurement/hub/cards/MaterialCatalogCard.tsx` (NEW — placeholder)
- `src/components/procurement/hub/cards/FrameworkAgreementsCard.tsx` (NEW — placeholder)
- `src/components/procurement/hub/cards/SpendAnalyticsCard.tsx` (NEW — placeholder + mini-stats da `procurementDashboardStats` no filter)
- `src/components/procurement/navigation/ProcurementSubNav.tsx` (modify — tabs [Hub, Vendors, Materials, Agreements, Analytics])
- `src/app/(authenticated)/procurement/vendors/page.tsx` (NEW — placeholder "Phase 3")
- `src/app/(authenticated)/procurement/materials/page.tsx` (NEW — placeholder "Phase 4")
- `src/app/(authenticated)/procurement/agreements/page.tsx` (NEW — placeholder "Phase 5")
- `src/app/(authenticated)/procurement/analytics/page.tsx` (NEW — placeholder "Phase 6")
- **DELETE** vecchie route detail top-level:
  - `src/app/(authenticated)/procurement/[poId]/page.tsx` (delete)
  - `src/app/(authenticated)/procurement/quotes/[id]/review/page.tsx` (delete + relative folders)
  - `src/app/(authenticated)/procurement/rfqs/[id]/page.tsx` (delete)
  - `src/app/(authenticated)/procurement/quotes/page.tsx` (delete — ora le liste vivono nel project tab)
  - `src/app/(authenticated)/procurement/rfqs/page.tsx` (delete)
  - `src/app/(authenticated)/procurement/sourcing-events/page.tsx` (valutare: spostare a project o tenere top-level read-only? vedi nota S5.1 sotto)
- `src/i18n/locales/{el,en}/procurement.json` — keys `hub.cards.{vendorMaster,materialCatalog,frameworkAgreements,spendAnalytics}.{title,description,comingSoon}`

**Note S5.1 — Sourcing Events:** sono già project-scoped (`projectId` REQ). Decidere in S5 se: (a) lasciare top-level in modalità read-only, (b) spostare nel project tab come 5° sub-tab, (c) lasciare per Phase 7 quando diventeranno multi-progetto. **Default proposto: (c) — lasciare invariato, separato dal cleanup.**

**Tasks:**
1. Plan Mode: enumerare tutte le rimozioni con Grep per confermare zero call-site rimasti
2. Creare HubLanding + 4 cards
3. Aggiornare ProcurementSubNav con nuovi tabs
4. Creare 4 placeholder pages (vendors/materials/agreements/analytics)
5. Eliminare le vecchie route detail (verifica Grep no orphan link)
6. i18n SSoT

**Validation:**
- Sidebar "Προμήθειες" → apre Hub landing con 4 cards
- ProcurementSubNav mostra [Hub, Vendors, Materials, Agreements, Analytics]
- Vecchie URL detail → 404 (atteso, no users to break)
- Tutti i link da project tab list → puntano alle nuove URL project-scoped (verificato in S1)
- `npx tsc --noEmit` clean

**Plan Mode:** sì (cleanup è la parte più rischiosa, plan upfront riduce blast radius).

**Token budget:** ~80-100k.

---

#### S6 — Verification end-to-end + ADR §7 finalize + memory update

**Goal:** smoke test manuale dei flussi critici, popolamento §7 Implementation tracking con file count reali, eventuale aggiornamento CLAUDE.md memory se sono emersi nuovi pattern.

**Pre-requisiti:** S1-S5 tutte committate.

**Files target (~3-6):**
- `docs/centralized-systems/reference/adrs/ADR-330-procurement-hub-scoped-split.md` (modify — popola §7 con tabella sessioni completate, file count, LOC actual, test results, date)
- `docs/centralized-systems/README.md` (verifica se l'ADR-330 entry necessita update)
- `docs/centralized-systems/reference/adr-index.md` (verifica entry ADR-330 stato APPROVED → IMPLEMENTED)
- Eventuale memory file in `.claude-rules/` se sono emersi pattern riusabili
- Smoke test checklist: documentata in §7 sotto sezione "S6 Verification log"

**Tasks:**
1. Manual smoke test flussi:
   - Click sidebar Προμήθειες → Hub landing OK
   - Apri progetto → tab Προμήθειες → sub-tab Overview → 5 KPI render
   - Sub-tab RFQ → list + "+ Νέο RFQ" funzionante
   - Sub-tab Quote → list + comparison + "+ Νέα Προσφορά"
   - Sub-tab PO → list + "+ Νέα Παραγγελία"
   - Click su PO da list → apre detail nella URL project-scoped
   - F5 mantiene sub-tab corrente
   - Browser back funziona tra sub-tab
   - Επιμετρήσεις tab → "Δημιουργία RFQ" funziona
2. `npx tsc --noEmit` full check (no nuovi errori vs baseline)
3. Eseguire `npm run i18n:audit` per verificare zero nuove violazioni i18n
4. Eseguire `npm run ssot:audit` per verificare zero nuove violazioni SSoT
5. Aggiornare ADR §7 con dati reali
6. Aggiornare `adr-index.md` se necessario
7. Commit finale

**Validation:**
- Tutti i flussi smoke test passano
- Zero nuovi errori TypeScript vs baseline
- Zero nuove violazioni i18n / SSoT
- ADR §7 popolato con metriche reali

**Plan Mode:** minimo (sessione di verifica + documentazione, no architettura).

**Token budget:** ~50-70k.

---

### 5.2 — Phase 1 cross-session checklist (Giorgio facing)

**Prima di ogni sessione:**
- [ ] `/clear` per context pulito
- [ ] Verificare branch `main`, working tree clean
- [ ] Read questa sezione §5.1 + sessione specifica

**Durante:**
- [ ] Plan Mode prima dell'implementazione
- [ ] Approvazione Giorgio del plan
- [ ] Implementazione + TypeScript check background

**Fine sessione:**
- [ ] Aggiornare ADR §7 con file/LOC reali
- [ ] Changelog entry in §changelog
- [ ] Commit (no push se non ordinato)
- [ ] Suggerire prossima sessione

---

### Phase 3 — Vendor Master surface

- Nuova vista `/procurement/vendors` che query Contacts con `personaTypes array-contains 'supplier'`
- Aggregare KPI da `useSupplierMetrics` esteso
- Card per vendor con: name, trade(s), # POs, total spend YTD, on-time delivery %, last order date

**Rischio:** basso. Solo nuova vista, dati esistenti.

### Phase 4 — Material Catalog ✅ IMPLEMENTED 2026-05-04

- ✅ Firestore collection `materials/` + ID `mat_*` (`generateMaterialId`)
- ✅ Schema: `{ id, companyId, code, name, unit, atoeCategoryCode, description, preferredSupplierContactIds[] (max 5), avgPrice, lastPrice, lastPurchaseDate, isDeleted, createdAt, updatedAt, createdBy }`
- ✅ Server-side code uniqueness per `(companyId, code)` + ATOE validation
- ✅ Soft-delete pattern (audit trail consistency con PO)
- ✅ CRUD API `/api/procurement/materials` (GET list, POST create) + `/api/procurement/materials/[materialId]` (GET, PATCH, DELETE)
- ✅ UI CRUD `/procurement/materials` — grid + filters (search + ATOE) + form dialog (create/edit) + confirm delete
- ✅ FK `boq-categories` (ATOE codes OIK-1..OIK-12) — no duplicazione
- ✅ FK `contacts/` (supplier persona) — no duplicazione (ADR-282 SSoT)
- ✅ Firestore rules (read tenant-scoped, writes Admin-only) + 3 composite indexes
- ✅ Audit trail via `EntityAuditService.recordChange` (created/updated/soft_deleted)

**Out-of-scope (future Phase 4.5):** auto-update `avgPrice`/`lastPrice`/`lastPurchaseDate` da Cloud Function trigger su PO `delivered`. In MVP Phase 4 i prezzi sono editabili manualmente.

### Phase 5 — Framework Agreements

- Nuova entità `framework_agreements/` + auto-apply discount in PO totals
- Schema con `vendorContactId`, `validFrom/To`, `discountRules[]`, `volumeBreakpoints[]`
- Hook in PO calc: se vendor ha framework agreement attivo → applicare sconto

**Rischio:** medio-alto. Logica calc PO da non rompere.

### Phase 6 — Cross-project Dashboard ✅ IMPLEMENTED 2026-05-04

- `/procurement` landing hub mostra sezione dashboard KPI sotto le 4 nav cards
- `useProcurementDashboard` hook — pure computation su `usePurchaseOrders()` (nessuna API extra, ADR-300 stale cache condivisa)
- Widget 1: 4 KPI cards (Totale PO, Impegnato €, Consegnato €, Fornitori attivi)
- Widget 2: Spend per categoria ΑΤΟΕ — top 5 con progress bar (da `items[].categoryCode`)
- Widget 3: Trend mensile 6 mesi — bar chart CSS (da `dateCreated`)
- File NEW: `src/hooks/procurement/useProcurementDashboard.ts`, `src/components/procurement/hub/ProcurementDashboardSection.tsx`
- File MODIFY: `HubLanding.tsx`, `el/procurement.json`, `en/procurement.json`, `hooks/procurement/index.ts`

**Rischio:** basso. Solo lettura aggregata.

### Phase S5-GAP — Navigation Gap (⏳ PENDING — nuova sessione)

**Problema identificato 2026-05-04:** S5 ha eliminato le list page top-level (`/procurement/quotes`, `/procurement/rfqs`) ma non ha aggiunto entry point alternativi. Risultato:

- `/procurement/quotes` → **404** (eliminata in S5)
- `/procurement/rfqs` → **404** (eliminata in S5)
- `/procurement/quotes/scan` → raggiungibile solo via URL diretto (nessun bottone)
- ProcurementSubNav ha solo: [Hub, Προμηθευτές, Υλικά, Συμβάσεις, Αναλυτικά] — mancano Προσφορές e RFQ

**Decisione (SAP/Procore pattern):** aggiungere tab dedicati + liste cross-project.

**Fix da implementare:**
1. Ripristina `/procurement/quotes/page.tsx` — lista cross-project di tutte le quote (filtrabili per progetto) + bottone "Σάρωση Νέας Προσφοράς" top-right
2. Ripristina `/procurement/rfqs/page.tsx` — lista cross-project di tutti gli RFQ (filtrabili per progetto) + bottone "+ Νέο RFQ" top-right
3. Aggiungi tab "Προσφορές" e "RFQ" in `ProcurementSubNav` (o merge in unico tab "Διαγωνισμοί")
4. i18n keys per nuovi tab e label

**Rischio:** basso. Route restoration + UI wiring, nessuna logica nuova.
**Modello:** Sonnet 4.6

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

### D5. Material Catalog implementation ✅ RESOLVED 2026-05-03

**Domanda:** greenfield (nuova collection `materials/`) oppure estendere `boq-categories` con campo `materials[]`?

**Risposta Giorgio:** **Opzione A — greenfield collection `materials/`**.

**Motivazione (industry research):** tutti i 5 maggiori player del settore tengono i materiali come entità **separate** dalle work categories:

| Vendor | Pattern Material Catalog |
|--------|---------------------------|
| Procore | Material Library (entity dedicata, separata da Cost Codes) |
| SAP S/4HANA | Material Master (entity di prima classe, link a WBS via BOM) |
| Oracle Primavera | Material catalog separato dalle attività WBS |
| Autodesk Construction Cloud | Materials list indipendente |
| Buildertrend | Cost Items library separata da Job Categories |

**Vantaggi consolidati:**
- **Lifecycle separato:** materiali cambiano prezzo/supplier preferito frequentemente (mensili), categorie ΑΤΟΕ sono metadata stabili pluriennali
- **Separation of concerns:** `boq-categories` resta SSoT per categorizzazione lavori (ADR-175), `materials/` SSoT per anagrafica materiali con price history
- **Query indipendenti:** dashboard "tutti i materiali con vendor preferito" senza join attraverso categorie
- **Ricerca diretta** per nome materiale (es. "τσιμέντο 50kg") senza dover prima entrare in una categoria

**Implementation pattern:**
1. **Nuova collection** `materials/` + ID generator `mat_*` (registrato in `enterprise-id.service.ts` per N.6)
2. **Schema target:**
   ```typescript
   {
     id: string;                          // mat_*
     companyId: string;                   // tenant isolation
     code: string;                        // codice interno o ΑΤΟΕ-aligned
     name: string;                        // es. "Τσιμέντο γκρι 50kg"
     unit: string;                        // σακί, kg, m², τεμ.
     atoeCategoryCode: string;            // FK → boq-categories.code
     preferredSupplierContactIds: string[]; // FK → contacts/ (persona='supplier')
     avgPrice: number;                    // media mobile ultimi N PO
     lastPrice: number;
     lastPurchaseDate: Timestamp | null;
     createdAt: Timestamp;
     updatedAt: Timestamp;
   }
   ```
3. **Link a `boq-categories.code`** per mantenere coerenza ΑΤΟΕ senza duplicare metadata
4. **Link a `contacts/`** per preferred suppliers (riusa Vendor Master di D4)
5. **UI CRUD** `/procurement/materials` (Phase 4)
6. **Price history** auto-aggiornato da Cloud Function trigger su PO `status: confirmed`

### D8. Sub-tab navigation pattern (RouteTabs vs StateTabs) ✅ RESOLVED 2026-05-03

**Domanda:** le 4 sub-tab del project Procurement devono essere RouteTabs (URL-based, ogni sub-tab ha propria URL) oppure StateTabs (state-based, URL invariata)?

**Risposta Giorgio:** **Opzione A — RouteTabs**.

**Motivazione (industry research):** tutti i 5 maggiori player usano routing URL-based per le sub-tab di tool a livello progetto:

| Vendor | Pattern URL sub-tab |
|--------|---------------------|
| Procore | `/projects/{id}/bidding`, `/projects/{id}/commitments`, `/projects/{id}/change_orders` |
| SAP S/4HANA Fiori | URL hash routing per ogni sub-tool |
| Oracle Primavera Unifier | Deep-link per ogni business process |
| Autodesk Construction Cloud | `/projects/{id}/cost`, `/projects/{id}/quality`, `/projects/{id}/safety` |
| Buildertrend | `/Job/{id}/Selections`, `/Job/{id}/Bids`, `/Job/{id}/PurchaseOrders` |

**Vantaggi consolidati per il caso costruzioni:**
- **Shareable links:** μηχανικός manda al λογιστήριο link "δες παραγγελίες έργου Παγκράτι" → ανοίγει στη σωστή υπο-καρτέλα
- **Browser navigation:** F5 mantiene la sub-tab, back/forward navigano tra sub-tab senza uscire dal progetto
- **Bookmarkable:** utenti management possono bookmarkare "PO ανά έργο" per accesso rapido
- **Audit/analytics:** GA / Vercel Analytics possono misurare uso per sub-tab via URL pattern
- **RBAC URL-driven:** `withAuth()` middleware può verificare permission per sub-tab basandosi sul path

**URL pattern adottato:**
```
/projects/{projectId}/procurement/overview
/projects/{projectId}/procurement/rfq
/projects/{projectId}/procurement/quote
/projects/{projectId}/procurement/po
```

**Implementazione:** `RouteTabs` da ADR-328 SSoT (`src/components/ui/tabs/RouteTabs.tsx`). Default sub-tab redirect: `/projects/{projectId}/procurement` → `/projects/{projectId}/procurement/overview`.

### D6. Phase order ✅ RESOLVED 2026-05-03 (auto-resolved by D9)

**Domanda originale:** Phase 1 prima è ok?

**Risposta Giorgio (implicita via D9):** Sì, Phase 1 prima. Phase 1 ora include il merge con Phase 2 (vedi D9). Phase 3-7 a seguire senza urgenza specifica.

### D7. Top-level cleanup timing ✅ RESOLVED 2026-05-03 (auto-resolved by D9)

**Domanda originale:** Phase 2 può aspettare Phase 3-4 per non lasciare top-level "vuoto"?

**Risposta Giorgio (via D9):** No need to wait — Phase 2 è stata mergiata in Phase 1. Top-level mostra placeholder cards ("Προμηθευτές: έρχεται", "Υλικά: έρχεται", "Συμβόλαια: έρχεται", "Στατιστικά: έρχεται") da subito. Premessa "non lasciare top-level vuoto" non si applica perché unico utente è Giorgio (no UX confusion risk).

### D9. Top-level surface during Phase 1 transition ✅ RESOLVED 2026-05-03

**Domanda:** durante Phase 1 (project tab enrichment), cosa succede al top-level `/procurement` che oggi ospita le liste PO/Quote/RFQ cross-project?

**Risposta Giorgio:** **Opzione Δ — Phase 1 + Phase 2 MERGED**.

**Motivazione:** Giorgio chiarisce che l'app è in fase pre-launch e l'unico utente attuale è Giorgio stesso. Tutta la logica di "transition gentleness" (status quo dual-surface, gradual migration) era costruita per proteggere existing users — premessa che non si applica.

**Industry pattern (greenfield internal tool):**
- Procore/SAP/Autodesk usano transition phases SOLO perché hanno migliaia di utenti in production
- Greenfield tool senza utenti = direct-to-final-state (no transition)
- Best practice: build it right da subito, no technical debt da rifattorizzare dopo

**Conseguenze del merge:**
1. **Phase 1 ora include**: project tab enrichment (1.A) + detail page migration (1.B) + top-level Hub redesign (1.C) — vedi §5
2. **D6 auto-risolto**: Phase 1 prima, ora più grande
3. **D7 auto-risolto**: top-level mostra placeholder cards "coming soon" da subito (no wait per Phase 3-4)
4. **D10 auto-risolto**: link da project tab list → direct project-scoped URL, no transition URLs

**Rischio accettabile:** blast radius più ampio di un Phase 1 puro additive, ma manageabile in pre-launch. Mitigazione: test esaustivo prima del commit, Grep per tutti i call-site delle vecchie URL.

### D10. Detail page URL during Phase 1 ✅ RESOLVED 2026-05-03 (auto-resolved by D9)

**Domanda originale:** durante Phase 1, quando user clicca PO da project tab list, va a vecchia URL top-level o nuova project-scoped?

**Risposta Giorgio (via D9):** Nuova project-scoped da subito. Phase 1 (mergiato con Phase 2) include detail page migration. Le vecchie URL top-level vengono rimosse. Tutti i link da project tab puntano direttamente a `/projects/{projectId}/procurement/{po|quote|rfq}/{id}`.

### D11. Επισκόπηση sub-tab — KPI scope in Phase 1 ✅ RESOLVED 2026-05-03

**Domanda:** quanti KPI mostrare nella sub-tab Επισκόπηση al lancio di Phase 1? Minimal (3 KPI), medio (3 + 1 chart + placeholder), o full (5 KPI complete)?

**Risposta Giorgio:** **Opzione A — full 5 KPI da day 1** (con mandate esplicito GOL + SSOT, "ENTERPRISE applicazione, non μπακάλικο γειτονιάς").

**Motivazione (industry research + Giorgio preference):**

| Vendor | Phase 1 KPI count |
|--------|-------------------|
| SAP S/4HANA Fiori | 6-8 KPI tiles dal day 1 |
| Procore | 4-5 numeric cards + 1 chart |
| Autodesk ACC Cost | 3 cards + 1 trend chart |
| Buildertrend | 4 numeric tiles |

Sweet spot industry: 4-6 KPI dal primo release. Giorgio richiede esplicitamente full scope, no MVP variants.

**5 KPI confermati per Phase 1:**

| # | KPI | Source | Difficoltà |
|---|-----|--------|------------|
| 1 | **# RFQ ανοιχτά** | count `rfqs` where `projectId == X && status == 'open'` | Bassa |
| 2 | **# PO σε έγκριση** | count `purchase_orders` where `projectId == X && status == 'pending_approval'` | Bassa |
| 3 | **Total committed spend** | sum `purchase_orders.totalAmount` where `projectId == X && status IN ('confirmed','partially_received','received')` | Bassa |
| 4 | **Budget vs Committed bar chart per ΑΤΟΕ** | join `boq_items.budgetAmount` (per category) ↔ `purchase_order_items` aggregated per `atoeCategoryCode` | Media — richiede aggregator nuovo |
| 5 | **% BOQ καλυμμένο da PO** | join `purchase_order_items.boqItemId` ↔ `boq_items.quantity` per progetto | Media — richiede aggregator nuovo |

**Implementation requirements (GOL + SSOT mandate):**

1. **SSoT extension** — `procurementDashboardStats` con flag `projectScoped: true` (riuso pattern esistente, no duplicazione)
2. **Nuovo aggregator** — `projectBoqCoverageStats` per #4 e #5 (join PO items ↔ BOQ items)
3. **Composite indexes Firestore** — necessari per query veloci con multi-field filter
4. **Component-per-KPI** — ogni KPI come componente separato sotto 40 LOC (N.7.1)
5. **Optimistic updates** — refresh KPI dopo PO/RFQ status change senza full reload (N.7.2)
6. **Zero race conditions** — `useEffect` cleanup, abort controller per query (N.7.2)
7. **Riuso esistente** — `useSupplierMetrics` per parte di #3, no nuovi hook se evitabile (SSoT)
8. **Loading skeleton + error boundary** per ogni KPI card (Google-level UX)
9. **i18n SSoT** — tutte le label via `t()`, nessun hardcoded string (N.11)
10. **TypeScript strict** — no `any`, no `as any`, no `@ts-ignore` (N.2/N.3)

### D12. Create buttons per sub-tab ✅ RESOLVED 2026-05-03

**Domanda:** dove va il pulsante "+ Νέο RFQ / Quote / PO" nel project Procurement? Per-sub-tab (A), unico dropdown in cima (B), o nessun bottone diretto solo workflow guidato (C)?

**Risposta Giorgio:** **Opzione A — pulsante in ogni sub-tab**.

**Motivazione (industry research):**

| Vendor | Pattern create button |
|--------|------------------------|
| Procore | "+ Create" dentro ogni tool (Bidding, Commitments, Change Orders) + link da BOQ |
| SAP S/4HANA Fiori | Plus shortcut top-right per app card |
| Oracle Primavera Unifier | Bottone create per business process |
| Autodesk Construction Cloud | "Create" button per tool |
| Buildertrend | "New" button per section |

**Construction reality:** servono entrambi i flow:
- **Guided workflow** — BOQ → RFQ → Quote → PO (path ideale, da Επιμετρήσεις)
- **Ad-hoc creation** — post-fact PO (fatture arrivate prima del flow), emergency orders (telefonata + ordine immediato), direct deals (negoziato senza RFQ formale)

L'opzione C (no buttons) è impossibile in cantiere reale.

**Implementation:**
1. **Bottone "+ Νέο" top-right** in sub-tab RFQ, Quote, PO (Overview no — è dashboard read-only)
2. **Auto-precompile `projectId`** dal URL pattern (`/projects/{projectId}/procurement/...`) — utente non sceglie mai progetto
3. **Bonus link da Επιμετρήσεις** — bottone "Δημιουργία RFQ" su BOQ items selezionati → `/projects/{projectId}/procurement/rfq?fromBoq={boqItemId}` (preserva il guided flow ideale)
4. **Quote sub-tab default** — "Create from RFQ" (riusa quote workflow esistente da ADR-327), Quote standalone disponibile ma secondario via "Other options"
5. **API SSoT** — tutti i bottoni chiamano gli stessi endpoint REST esistenti (`POST /api/procurement/rfqs`, `POST /api/procurement/quotes`, `POST /api/procurement/purchase-orders`) — no duplicazione lato server
6. **i18n keys** — `tabs.subtabs.procurement.actions.{newRfq,newQuote,newPo}` in `projects.json`

---

## 7. Implementation tracking

### Phase 1 — Session execution log

| Session | Status | Files actual | LOC actual | TS check | i18n audit | SSoT audit | Commit | Date |
|---------|--------|--------------|------------|----------|------------|------------|--------|------|
| **S1** Detail page migration | ✅ COMPLETED | 8 (7 NEW + 1 MODIFY) | ~165 | ⏳ background | n/a (no new keys) | n/a (helper added to registry in S2) | pending | 2026-05-03 |
| **S2** Project tab + RouteTabs | ✅ COMPLETED | 14 (10 NEW + 4 MODIFY) | ~290 | ⏳ background | ✅ 6 new keys × 2 locale | ✅ RouteTabs SSoT (ADR-328) | pending | 2026-05-03 |
| **S3** Επισκόπηση 5 KPIs | ✅ COMPLETED | 15 (11 NEW + 4 MODIFY) | ~380 | ⏳ background | ✅ 16 keys × 2 locale | ✅ useAsyncData+stale-cache (ADR-300), EnterpriseErrorBoundary per-KPI | pending | 2026-05-04 |
| **S4** Create buttons + BOQ link | ✅ COMPLETED | 7 (0 NEW + 7 MODIFY) | ~55 | ⏳ background | ✅ 4 new keys × 2 locale | ✅ SSoT: existing list buttons via onCreateRfq/onCreateNew callbacks | pending | 2026-05-04 |
| **S5** Top-level Hub redesign | ✅ COMPLETED | 19 (9 NEW + 7 MODIFY + 3 DELETE) | ~380 | ⏳ background | ✅ 25 new keys × 2 locale (nav.hub/vendors/materials/agreements/analytics + hub.* section) | ✅ usePOSupplierContacts+usePurchaseOrders SSoT reuse, no new queries | pending | 2026-05-04 |
| **S6** Verification + finalize | ✅ COMPLETED | 6 (1 NEW + 5 MODIFY) | ~65 | ✅ 0 new errors | ✅ 0 violations | ✅ 0 violations | pending | 2026-05-04 |

**Aggiornare ogni cella alla fine della sessione corrispondente.**

Status legend: 📋 PLANNED · 🚧 IN_PROGRESS · ✅ COMPLETED · ⚠️ PARTIAL · ❌ BLOCKED

### Phase 3-7 — placeholder

| Phase | Status | Sessioni | Date |
|-------|--------|----------|------|
| 3 — Vendor Master surface | ✅ COMPLETED | 1 sessione | 2026-05-04 |
| 4 — Material Catalog | 📋 PLANNED | TBD (probabile 2-3 sessioni) | — |
| 5 — Framework Agreements | 📋 PLANNED | TBD (probabile 2-3 sessioni) | — |
| 6 — Cross-project Dashboard | 📋 PLANNED | TBD (probabile 1-2 sessioni) | — |
| 7 — Sourcing Events globali | 📋 FUTURE | TBD | — |

### S6 Verification log (smoke test checklist)

> Completato 2026-05-04. Smoke test UI rimandato a Giorgio (dev server).

- [ ] Sidebar Προμήθειες → Hub landing render OK (smoke test manuale Giorgio)
- [ ] Progetto → tab Προμήθειες → sub-tab Overview → 5 KPI render (smoke test manuale Giorgio)
- [ ] Sub-tab RFQ → list + "+ Νέο RFQ" funzionante (smoke test manuale Giorgio)
- [ ] Sub-tab Quote → list + comparison + "+ Νέα Προσφορά" (smoke test manuale Giorgio)
- [ ] Sub-tab PO → list + "+ Νέα Παραγγελία" funzionante (smoke test manuale Giorgio)
- [ ] Click PO da list → detail URL project-scoped (smoke test manuale Giorgio)
- [ ] F5 mantiene sub-tab corrente (smoke test manuale Giorgio)
- [ ] Browser back funziona tra sub-tab (smoke test manuale Giorgio)
- [ ] Επιμετρήσεις tab → "Δημιουργία RFQ" funziona (smoke test manuale Giorgio)
- [x] Vecchie URL detail top-level → `/procurement/purchase-orders/[id]` ora fa fetch PO + redirect project-scoped
- [x] `npx tsc --noEmit` zero nuovi errori vs baseline (file S5+S6 puliti)
- [x] `npm run i18n:audit` ✅ 0 violazioni (baseline 0, current 0)
- [x] `npm run ssot:audit` ✅ 0 nuove violazioni

**S6 regressions fixed (5 call-sites, 1 new route):**
- `ProcurementDetailPageContent` — `handleSuccess` + `handleDuplicate` ora usano `getPoDetailUrl`
- `/procurement/new/page.tsx` — creato (PO create form ripristinato)
- `ContactPurchaseOrdersSection` — `handleView` usa `getPoDetailUrl(po.projectId, po.id)`
- `ProjectPoListClient` — `handleDuplicate` usa `getPoDetailUrl(projectId, poId)`
- `purchase-orders/[id]/page.tsx` — fetch PO Admin SDK + redirect project-scoped

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
