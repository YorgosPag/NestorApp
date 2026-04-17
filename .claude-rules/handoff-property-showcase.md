# HANDOFF — Property Showcase (ADR-311)

**Data handoff**: 2026-04-17
**Stato**: Piano approvato da Giorgio, pronto esecuzione.
**MVP**: singola sessione, autonomo F1→F9, commit finale (NO push).

---

## 🎯 Obiettivo

Aggiungere bottone **"Επίδειξη Ακινήτου"** (Share2 icon, violet) nell'header dettagli property accanto a Edit/New/Delete. Il bottone apre dialog con:
- **Copia link rich** → apre pagina web pubblica `/showcase/[token]` con scheda completa immobile (foto, κατόψεις, video link, dati, branding azienda)
- **Scarica PDF** → download PDF brandizzato con stessi contenuti
- **Revoca link**

Un **unico token** (FILE_SHARES) serve sia il PDF che la pagina web.

---

## 🗺️ Mappa SSoT — RIUSO MASSIMO (zero duplicazione)

| Serve | SSoT Esistente | Azione |
|---|---|---|
| Token + share + TTL + password + download count | `FileShareService` (`src/services/file-share.service.ts`) + collection `FILE_SHARES` | ✅ Riuso 100% |
| Pagina pubblica download file | `/shared/[token]/page.tsx` | ✅ Riuso 100% |
| PDF engine | `src/services/pdf/` — `PDFExportService`, `JSPDFLoader`, `JSPDFAdapter`, `renderers/`, `greek-font-loader` | ✅ Riuso engine |
| HTML email con logo + footer brandizzato | `src/services/email-templates/base-email-template.ts` — `wrapInBrandedTemplate`, `BRAND`, `escapeHtml` | ✅ Riuso 100% |
| API invio email property | `/api/communications/email/property-share` + `EmailService.sendPropertyShareEmail` | ✅ Riuso (fase 2) |
| ID generator | `generateShareId` | ✅ Riuso |
| Rules + rate-limit + index | `FILE_SHARES` già regolato | ✅ Riuso |
| Entity action preset | `src/core/entity-headers/entity-action-presets.ts` — `createEntityAction('showcase', ...)` | ✅ Estendi (add preset) |

**NON CREARE** sistemi nuovi. Solo composizione e specializzazioni.

---

## 🆕 File NUOVI (~10)

1. `src/services/pdf/renderers/PropertyShowcaseRenderer.ts` — pattern identico `CoverRenderer` (usa `IPDFDoc`)
2. `src/services/email-templates/property-showcase.ts` — usa `wrapInBrandedTemplate` (fase 2, opzionale MVP)
3. `src/app/showcase/[token]/page.tsx` — server component, valida token via `FileShareService.validateShare()`
4. `src/components/property-showcase/ShowcaseClient.tsx`
5. `src/components/property-showcase/ShowcaseHeader.tsx` — branding azienda (logo + nome)
6. `src/components/property-showcase/ShowcasePhotoGrid.tsx` — griglia foto con caption
7. `src/components/property-showcase/ShowcaseFloorplans.tsx`
8. `src/components/property-showcase/ShowcaseVideoEmbed.tsx` — link esterno cliccabile (YouTube/Vimeo/Storage URL)
9. `src/app/api/properties/[id]/showcase/generate/route.ts` — POST genera PDF + salva Storage + crea file entry + `FileShareService.createShare` → ritorna `{ token, pdfUrl, richUrl }`. DELETE revoca.
10. `src/features/properties-sidebar/components/PropertyShowcaseDialog.tsx` — Copia link / Scarica PDF / Revoca
11. `src/i18n/locales/el/showcase.json` + `src/i18n/locales/en/showcase.json` — namespace pagina pubblica (el locale ZERO parole inglesi, rule session memory)
12. `docs/centralized-systems/reference/adrs/ADR-311-property-showcase.md` — ADR composizione SSoT
13. Tests: `src/components/property-showcase/__tests__/` (almeno smoke test)

## 🔧 File MODIFICATI (~6)

1. `src/services/file-share.service.ts` — estendi `FileShareRecord` con 2 fields opzionali (NO breaking):
   ```ts
   showcasePropertyId?: string;
   showcaseMode?: boolean;
   ```
2. `src/core/entity-headers/entity-action-presets.ts` — aggiungi preset `showcase` (icon `Share2` da lucide-react, `GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON` o nuovo `VIOLET`)
3. `src/core/entity-headers/entity-action-presets.ts` ActionType union: aggiungi `'showcase'`
4. `src/features/properties-sidebar/components/PropertyDetailsHeader.tsx` — props `onShowcaseProperty?`, inserisci action showcase tra `edit` e `new` o dopo `delete`
5. `src/features/property-details/PropertyDetailsContent.tsx` — wire handler Dialog
6. `src/i18n/locales/el/properties.json` + `en/properties.json` — key `navigation.actions.showcase.label` ("Επίδειξη Ακινήτου" / "Property Showcase")
7. `src/services/email-templates/index.ts` — export `buildPropertyShowcaseEmail` (fase 2)
8. `docs/centralized-systems/reference/adr-index.md` — registra ADR-311
9. `firestore.rules` — (se serve) permetti lettura `FILE_SHARES` per token con `showcaseMode=true` (verifica rules già ammettono read by token)
10. `firestore.indexes.json` — verifica se serve index per query showcase; probabilmente no (token match già indexed)

---

## ⚙️ Decisioni MVP (fisse)

| Punto | Decisione |
|---|---|
| TTL | **30 giorni fisso** (hardcoded, no UI selector) |
| Email diretto | **FUORI MVP** — fase 2 (già esiste API `property-share`) |
| Analytics view-count | **FUORI MVP** — campo già esistente in `FileShareRecord.downloadCount`, opzionale incrementare |
| Branding | Da `companies/{companyId}` doc: `logoUrl` + `name`. Fallback: testo "Nestor" |
| Video | **Solo link esterno cliccabile** (no embed avanzato) — YouTube/Vimeo/Storage URL qualsiasi |
| Password | FUORI MVP — usa `FileShareService.createShare` senza password |
| Revoca | `FileShareService.deactivateShare(shareId)` esistente |

---

## 📋 Fasi esecuzione (ADR-Driven 4 Phases)

### Fase 1 — RECOGNITION (Plan Mode implicito, già fatto in handoff)
- ADR-311 ancora non scritto (scrivi Fase 3)
- Verifica codice corrente dei 6 file da modificare PRIMA di toccarli

### Fase 2 — IMPLEMENTATION

**F1. Foundations (5min)**
- Estendi `FileShareRecord` (2 fields)
- Aggiungi preset `showcase` + ActionType
- i18n key `navigation.actions.showcase`

**F2. PDF Renderer (30min)**
- `PropertyShowcaseRenderer.ts` — sezioni: header brand, titolo property, tabella campi, griglia foto (max 6 per pagina, caption sotto), floorplans, link video testuale
- Riusa `greek-font-loader` per font greci
- Output `Uint8Array` via `JSPDFAdapter.output('arraybuffer')`

**F3. API generate (20min)**
- `/api/properties/[id]/showcase/generate/route.ts`
- `withAuth` + `companyId` dal contesto
- Carica property + foto URLs + floorplans + company branding
- Chiama renderer → `Uint8Array`
- Upload Storage path: `companies/{companyId}/property-showcases/{propertyId}/{shareId}.pdf`
- Crea entry `files` via file-mutation-gateway
- `FileShareService.createShare(fileId, { showcasePropertyId, showcaseMode: true, expiresInHours: 720, companyId })`
- Ritorna `{ token, pdfUrl: \`/shared/${token}\`, richUrl: \`/showcase/${token}\` }`

**F4. Pagina pubblica (40min)**
- `/showcase/[token]/page.tsx` server component
- Valida via `FileShareService.validateShare(token)` → `showcasePropertyId`
- Carica property (+ company per branding) con Admin SDK
- Passa a `ShowcaseClient` (mobile-first, no auth, `robots: noindex`)
- Componenti: Header brand, Photo grid (captioned), Specs table, Floorplans, Video link

**F5. Dialog + integration UI (20min)**
- `PropertyShowcaseDialog` — 3 bottoni: Copia link rich, Scarica PDF, Revoca
- Clipboard API per copia
- `window.open(pdfUrl)` per download
- Fetch DELETE per revoca
- Wire in `PropertyDetailsHeader` + `PropertyDetailsContent`

**F6. i18n (10min)**
- `showcase.json` namespace nuovo
- Greek PURO (zero inglese, verifica memory rule `feedback_pure_greek_locale`)

**F7. Security (10min)**
- Verifica `firestore.rules` ammetta read su `FILE_SHARES` con token + `showcaseMode=true` (già public access per token)
- Rate limit `/showcase/[token]`: reuse esistente

### Fase 3 — ADR UPDATE (ADR-311)
- Scrivi `ADR-311-property-showcase.md` seguendo stile ADR del progetto
- Titolo: "Property Showcase — SSoT Composition over Greenfield"
- Sezioni: Context, Decision (composizione SSoT), SSoT Reuse Map (tabella sopra), Extension of FileShareRecord, Consequences, Alternatives Considered (greenfield refused)
- Registra in `adr-index.md`
- Changelog entry

### Fase 4 — COMMIT
- `git add` dei file tocati (mai `git add -A`)
- Commit message stile Conventional (es. `feat(properties): property showcase MVP via SSoT composition (ADR-311)`)
- Ultimate line: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- **NO PUSH** (aspetta ordine di Giorgio)
- `npx tsc --noEmit` in background (ratchet pre-commit già gestisce i18n+SSoT)

---

## 🚨 Regole NON-NEGOZIABILI (da CLAUDE.md)

- **Lingua**: Giorgio scrive in greco. TU rispondi SEMPRE in italiano. Mai inglese, mai greco.
- **NO `any`, `as any`, `@ts-ignore`** — enterprise TypeScript
- **NO inline styles** (eccetto template email dove è obbligatorio)
- **NO hardcoded Greek/English strings** in `.ts`/`.tsx` — solo `t('key')`, mai `defaultValue: 'literal'`
- **Enterprise IDs**: `setDoc()` + generatore, no `addDoc()` o `.add()`
- **Firestore `where()`**: deve includere `companyId` (tenant isolation)
- **File size**: max 500 lines, max 40 lines/function
- **NO `undefined` a Firestore**: usa `?? null`
- **NO PUSH senza ordine esplicito di Giorgio** (ogni push = build Vercel = $$$)
- **Commit in background** (`run_in_background: true`)
- **tsc in background**, non blocking
- **Locale greco PURO** — zero parole inglesi anche "m²"/"dashboard"

---

## 🎬 Comando di avvio nuova sessione

> Leggi `.claude-rules/handoff-property-showcase.md` e `CLAUDE.md`. Esegui il piano Property Showcase MVP in autonomia: Fase 1 recognition → Fase 2 implementation F1-F7 → Fase 3 ADR-311 → Fase 4 commit (NO PUSH). Usa TaskList per tracciare. Mostra context health alla fine.

---

## 📎 Riferimenti file (per Read rapido)

- `CLAUDE.md` (project instructions)
- `src/services/file-share.service.ts` (FileShareService pattern)
- `src/services/pdf/PDFExportService.ts` + `renderers/CoverRenderer.ts` (PDF pattern)
- `src/services/email-templates/base-email-template.ts` + `photo-share.ts` (HTML email pattern)
- `src/app/shared/[token]/page.tsx` + `src/app/shared/po/[token]/page.tsx` (public page pattern)
- `src/features/properties-sidebar/components/PropertyDetailsHeader.tsx` (header dove aggiungere bottone)
- `src/core/entity-headers/entity-action-presets.ts` (preset da estendere)
- `src/services/attendance/qr-token-service.ts` (token pattern reference)
- `docs/centralized-systems/reference/adr-index.md` (registrare ADR-311)
