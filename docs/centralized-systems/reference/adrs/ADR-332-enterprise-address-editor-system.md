# ADR-332 — Enterprise Address Editor System (Full Transparency)

**Status:** 📋 PROPOSED — Phase 0 (ADR drafting) in progress 2026-05-05
**Date:** 2026-05-05
**Author:** Claude (Opus 4.7) + Γιώργος
**Mandate:** GOL + SSOT — full enterprise scope, no MVP variants
**Related ADRs:** ADR-168 (draggable markers), ADR-277 (drag hierarchy clear), ADR-279/280 (i18n runtime resolver), ADR-294 (SSoT ratchet), ADR-298 (Firestore rules tests), ADR-318 (derived work addresses), ADR-319 (HQ positional invariant), ADR-330 (procurement hub)

---

### Changelog

| Date | Changes |
|------|---------|
| 2026-05-05 | ✅ **Phase 0 COMPLETED** — engine multi-result + foundation types. 5 files (3 NEW + 2 MODIFY). 11 jest tests green. Two commits in same session: (a) ADR file proposed, (b) Layer 1+2 implementation (engine returns top + up to 4 alternatives, resolvedFields normalized, attemptsLog with i18n keys for all 8 variants, per-field match matrix, partialMatch detection, source provenance). Backward compatibility: legacy `GeocodingApiResponse` core fields (lat/lng/accuracy/confidence/displayName/resolvedCity) preserved unchanged — additive enrichment only. NO push (CLAUDE.md N.(-1)). |
| 2026-05-05 | 📋 PROPOSED — bozza iniziale dopo session di clarificazione (3 round Q&A — coordinator A+optin → coordinator pieno; 1 form → 3 form; trigger 1 → trigger 4). Mandate Giorgio: "πιο προηγμένο σύστημα που μπορεί να υπάρχει… πλήρης πληροφόρηση κάθε στιγμή". 11 phases, 1 phase per session, handoff-driven. |

---

## 1. Context

L'editor di indirizzi è una superficie ad alta densità informativa che attraversa **7 domain** dell'applicazione (contacts, projects, buildings, building-code, procurement, property-showcase, geocoding service). Il flusso utente coinvolge:

1. **Form input** — l'utente scrive street/number/postal/city/region
2. **Geocoding service** — chiamata client → API route → Nominatim (3 livelli, 6-8 varianti retry)
3. **Map render** — pin sulla posizione restituita
4. **Reverse geocoding** — quando l'utente trascina il pin, restituisce nuovi campi
5. **Hierarchy picker** — ELSTAT 4-tier (settlement/community/municipal unit/municipality/regional unit/region)
6. **Persistence** — Firestore con `companyId` tenant isolation

### Stato attuale (2026-05-05)

L'implementazione esistente è **funzionale ma opaca**:

| Aspetto | Stato attuale | Problema |
|---------|---------------|----------|
| **Status feedback** | `AddressMapStatusChip` con 6 stati (idle/loading/partial/stale/error/success) | Non dice **perché** è partial, non dice **cosa** è in conflitto |
| **Field-level validation** | Inesistente | Utente non sa quale campo sta facendo fail il geocoding |
| **Suggestions** | Inesistenti — il service prende solo `data[0]` da Nominatim ignorando 4 candidati che ha già richiesto (`limit=5`) | Utente non vede alternative quando il match è ambiguo |
| **Reconciliation** | Inesistente — silent overwrite quando il drag restituisce dati diversi | Utente perde dati inseriti senza warning |
| **Activity log** | Inesistente | "Cosa sta facendo l'app adesso?" — l'utente non lo sa |
| **Source of pin** | Inesistente | "Questo pin è geocodato, trascinato manualmente, o derivato?" |
| **Freshness** | Esiste solo flag `stale` boolean | Non dice **quando** è stato verificato l'ultimo |
| **Confidence visibility** | Inesistente | `confidence` viene calcolato ma mai mostrato all'utente |
| **Conflict resolution** | Inesistente | Non c'è UI per "il sistema dice X, tu dici Y, scegli" |
| **Telemetry** | Solo logger.info/warn server-side | Nessuna learning loop dalle correzioni utente |
| **Undo/Redo** | Inesistente | Drag accidentale = perdita dati |
| **Hierarchy validation** | Inesistente | Postal code 99999 con città Θεσ/νίκη accettato senza warning |
| **A11y** | Limitata | Activity changes non annunciati a screen reader |

### Pattern industry dominante

| Vendor | Pattern Address Editor |
|--------|------------------------|
| **Google Maps Places + Address Form** | Web Component `<gmpx-place-picker>` — coordinator unico, autocomplete inline, partial_match flag, multiple results, confidence implicit |
| **HERE WeGo / HERE Studio** | Real-time validation per-field, alternative rankings con distance, source labels |
| **Mapbox Geocoding API + Address SDK** | Multi-result default, confidence score esposto, "did you mean" UI |
| **OpenCage Geocoder** | Componenti normalized esposti, confidence 1-10, fallback chain visibile |
| **Smarty (US/intl)** | Field-level match status, suggestions panel, "validate as you type" |

Il **pattern enterprise convergente**: **single coordinator component** che possiede form+map+activity+suggestions+reconciliation in un'unica sorgente di verità (SSoT), con **transparency totale** allo utente su tutto ciò che il sistema sta facendo o ha trovato.

### Convergenza con CLAUDE.md mandates

- **N.7 Google-level quality** — proactive feedback, zero silent overwrite, idempotenza, belt-and-suspenders
- **N.0/N.12 SSoT** — eliminare 3-form duplication, un punto canonico per geocoding/conflict logic
- **N.7.1 file size** — coordinator + presentational split, ognuno < 500 LOC, funzioni < 40 LOC
- **N.7.2 architecture checklist** — ownership esplicito, race-free, single source of truth
- **N.11 i18n SSoT** — tutte le nuove stringhe via `t()` con keys in locale JSONs
- **N.10 testing** — pure helpers + state machine + hooks coperti da test

---

## 2. Decision

Costruire un **Address Editor System v2.0** end-to-end enterprise con **transparency totale**, applicato a **TUTTI** i 28 punti dell'app dove gli indirizzi vengono editati, visualizzati o renderizzati su mappa.

Il sistema espone all'utente **in ogni momento**:

1. **Cosa sta facendo** (Activity Log live)
2. **Cosa ha trovato** (Suggestions panel)
3. **Quale campo è in conflitto** (Field-level badges)
4. **Quanto è sicuro** (Confidence meter)
5. **Da dove viene** (Source label)
6. **Quando è stato verificato** (Freshness indicator)
7. **Cosa cambierà** (Drag confirm dialog + Reconciliation panel)
8. **Come tornare indietro** (Undo/Redo)

---

## 3. Architecture

### 3.1 Layered structure

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 7 — Migration sites (28 components rewired)      │
│  contacts/projects/buildings/showcase/procurement/...   │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 6 — <AddressEditor> coordinator                  │
│  Public API. Wraps Form + Map + Panels + Activity log   │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 5 — Presentational components (~14 nuovi)        │
│  FieldBadge, ConfidenceMeter, SuggestionsPanel,         │
│  ReconciliationPanel, ActivityLog, SourceLabel,         │
│  FreshnessIndicator, DiffSummary, DragConfirmDialog     │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 4 — Hooks                                        │
│  useAddressEditor (master)                              │
│  useAddressFieldStatus, useAddressSuggestions,          │
│  useAddressReconciliation, useAddressActivity,          │
│  useAddressTelemetry, useAddressUndo                    │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 3 — State machine                                │
│  Pure logic: idle/typing/debouncing/loading/partial/    │
│  success/conflict/stale/error states + transitions      │
│  Fully testable, no React deps                          │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 2 — Service (client)                             │
│  geocoding-service.ts: multi-result, alternatives,      │
│  cache TTL, telemetry hooks, in-flight dedup            │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 1 — Engine (server)                              │
│  geocoding-engine.ts: returns ALL 5 candidates,         │
│  resolvedFields, partialMatch, reasoning                │
│  ELSTAT cross-check, hierarchy validation               │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Type contracts

#### `GeocodingApiResponse` (estesa)

```typescript
export interface GeocodingApiResponse {
  // Existing
  lat: number;
  lng: number;
  accuracy: 'exact' | 'interpolated' | 'approximate' | 'center';
  confidence: number;
  displayName: string;
  resolvedCity?: string;

  // NEW — Layer 1 enrichment
  resolvedFields: ResolvedAddressFields;
  partialMatch: boolean;
  reasoning: GeocodingReasoning;
  alternatives: GeocodingApiResponse[];  // top 4 (without their alternatives — flat)
  source: {
    provider: 'nominatim' | 'cache' | 'manual';
    osmType?: string;
    osmId?: string;
    importance?: number;
    variantUsed: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  };
}

export interface ResolvedAddressFields {
  street?: string;
  number?: string;
  postalCode?: string;
  neighborhood?: string;
  city?: string;
  county?: string;
  region?: string;
  country?: string;
}

export interface GeocodingReasoning {
  /** Match score per field — for badge logic */
  fieldMatches: {
    [K in keyof ResolvedAddressFields]: 'match' | 'mismatch' | 'unknown' | 'not-provided';
  };
  /** Variants attempted (for activity log) */
  attemptsLog: GeocodingAttempt[];
  /** Why this confidence score */
  confidenceBreakdown: {
    base: number;
    streetMatch: number;
    cityMatch: number;
    postalMatch: number;
    countyMatch: number;
    municipalityMatch: number;
  };
}

export interface GeocodingAttempt {
  variant: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  description: string;  // i18n key, not raw string
  status: 'success' | 'no-results' | 'error' | 'skipped';
  durationMs: number;
}
```

#### `AddressFieldStatus` (Layer 5)

```typescript
export type AddressFieldStatus =
  | { kind: 'match'; userValue: string; resolvedValue: string }
  | { kind: 'mismatch'; userValue: string; resolvedValue: string }
  | { kind: 'unknown'; userValue: string }       // Nominatim non riconosce
  | { kind: 'not-provided'; resolvedValue?: string }  // user vuoto, Nominatim potrebbe avere
  | { kind: 'pending' };                          // geocoding in flight
```

#### `GeocodingActivityEvent` (Layer 4)

```typescript
export interface GeocodingActivityEvent {
  id: string;             // ULID
  timestamp: number;      // unix ms
  level: 'info' | 'success' | 'warn' | 'error';
  category: 'input' | 'request' | 'response' | 'conflict' | 'suggestion' | 'apply' | 'drag' | 'undo';
  i18nKey: string;        // resolves via t()
  i18nParams?: Record<string, string | number>;
}
```

#### `AddressSourceType` & `AddressFreshness`

```typescript
export type AddressSourceType =
  | 'geocoded'    // automatic Nominatim
  | 'dragged'     // user drag pin
  | 'manual'      // user typed without geocoding
  | 'derived'     // ADR-318 from parent contact
  | 'imported'    // external import (future)
  | 'unknown';

export interface AddressFreshness {
  verifiedAt: number | null;  // unix ms; null = mai verificato
  level: 'never' | 'fresh' | 'recent' | 'aging' | 'stale';
  staleReason?: 'field-changed' | 'time-elapsed' | 'force-refresh-pending';
}
```

#### `AddressEditorState` (Layer 3)

```typescript
export type AddressEditorState =
  | { phase: 'idle' }
  | { phase: 'typing'; lastEditMs: number }
  | { phase: 'debouncing'; etaMs: number }
  | { phase: 'loading'; attempt: number; totalAttempts: number; variantDescription: string }
  | { phase: 'success'; result: GeocodingApiResponse; freshness: AddressFreshness }
  | { phase: 'partial'; resolved: number; total: number; conflicts: AddressFieldConflict[] }
  | { phase: 'conflict'; result: GeocodingApiResponse; conflicts: AddressFieldConflict[] }
  | { phase: 'suggestions'; candidates: GeocodingApiResponse[]; reason: SuggestionTrigger }
  | { phase: 'stale'; lastResult: GeocodingApiResponse; reason: 'field-changed' }
  | { phase: 'error'; reason: 'no-results' | 'timeout' | 'rate-limit' | 'network'; canRetry: boolean };

export type SuggestionTrigger =
  | 'no-results-after-retry'
  | 'low-confidence'
  | 'multiple-candidates-similar'
  | 'partial-match-flag';
```

### 3.3 Coordinator API

```typescript
<AddressEditor
  // Required
  value={address}
  onChange={(addr) => ...}

  // Mode
  mode="edit" | "view"
  domain="contact" | "project" | "building" | "procurement" | "showcase" | "frontage"

  // Form options (vary by domain)
  formOptions={{
    showHierarchy?: boolean;     // ELSTAT picker
    showAddressType?: boolean;
    showBlockSide?: boolean;
    showCustomLabel?: boolean;
  }}

  // Map options
  mapOptions={{
    height?: 'small' | 'medium' | 'large' | 'full';
    showLocateMe?: boolean;
    initialZoom?: number;
  }}

  // Activity log
  activityLog={{
    enabled?: boolean;          // default true in edit, false in view
    verbosity?: 'basic' | 'detailed' | 'debug';  // default 'detailed'
    collapsed?: boolean;        // default false in edit
  }}

  // Telemetry
  telemetry={{
    enabled?: boolean;          // default true
    contextEntityType?: string; // e.g. 'contact', 'project'
    contextEntityId?: string;
  }}

  // Multi-address layout (contacts/projects/buildings can have N addresses)
  addresses?: ProjectAddress[];  // alternative to single value
  onAddressesChange?: (addrs: ProjectAddress[]) => void;
  primaryAddressIndex?: number;  // ADR-319 invariant

  // Read-only enriched display
  readOnlyExtraAddresses?: ProjectAddress[];  // ADR-318 derived

  // Backward compat
  legacy?: {
    onAddressDragUpdate?: (addr, idx) => void;  // bridges to old code
  };
/>
```

### 3.4 Suggestion trigger algorithm

Pattern C (Suggestions Panel) si attiva quando **ALMENO UNO** dei seguenti:

1. **Hard fail** — 0 results dopo TUTTE le 6-8 varianti del Layer 1 → retry chiamando di nuovo Layer 1 con `omitField: 'postalCode'` (priorità: postalCode > number > neighborhood)
2. **Low confidence** — `confidence < 0.7`
3. **Ambiguous** — `alternatives.length >= 2` AND `top.confidence - alternatives[0].confidence < 0.15`
4. **Partial match** — `partialMatch === true`

In ALL cases except (1), **non si chiama Nominatim ulteriormente** — si usano i 5 candidati già richiesti con `limit=5`.

### 3.5 Reconciliation logic

Pattern B (Reconciliation Panel) si attiva quando:
- `partialMatch === true` con conflicts su uno o più campi specifici
- Drag end con `reverseGeocode` returns che differiscono da formData esistente

Output: lista `AddressFieldConflict[]` con buttons inline:
- `[Διόρθωση]` → applica resolved value
- `[Άφησέ το]` → mantieni user value (mark address as `manual` source)
- `[Διόρθωσέ τα όλα]` → applica tutti i resolved values
- `[Δοκίμασε άλλον συνδυασμό]` → trigger Pattern C suggestions

### 3.6 Activity Log specification

Default verbosity: **`detailed`** — l'utente vede 15-20 lines per geocoding cycle.

Mandatory events da registrare:
- `input` — field change detected con field name e old→new value
- `request` — debounce eta + Nominatim call kickoff con variant description
- `response` — top result + confidence + alternatives count
- `conflict` — per ogni field con mismatch
- `suggestion` — quando triggers algorithm fires
- `apply` — quando user accetta correction
- `drag` — drag start/move/end + reverse geocode
- `undo` — undo/redo events

Verbosity levels:
- `basic` — solo `success` + `error` events (5-6 lines)
- `detailed` — tutti tranne `info`-level low-importance (15-20 lines) — **DEFAULT**
- `debug` — tutto, incluso variant attempts dettagliati (50+ lines)

Toolbar: `[clear log]` `[copy as JSON]` `[verbosity ▼]` `[collapse/expand]`

A11y: `<div role="log" aria-live="polite" aria-relevant="additions">` per screen reader announcements automatici.

### 3.7 Telemetry schema

Nuova collection Firestore `address_corrections_log/`:

```typescript
{
  id: 'acl_<ulid>',
  companyId: string,                    // tenant isolation (mandatory N.11 + ADR-294)
  userId: string,
  contextEntityType: 'contact' | 'project' | 'building' | 'procurement' | 'showcase',
  contextEntityId: string,
  timestamp: Timestamp,

  // What user typed initially
  userInput: ResolvedAddressFields,

  // What Nominatim returned
  nominatimResolved: ResolvedAddressFields,
  confidence: number,
  variantUsed: number,
  partialMatch: boolean,

  // Action taken
  action: 'accepted-top' | 'accepted-suggestion' | 'kept-user' | 'mixed-correction' | 'used-drag',
  acceptedSuggestionRank?: number,    // 0=top, 1-4=alternatives

  // Per-field actions
  fieldActions: {
    [K in keyof ResolvedAddressFields]?: 'kept' | 'corrected-to-resolved' | 'corrected-to-suggestion';
  },

  // Metadata
  durationFromInputToActionMs: number,
  undoOccurred: boolean,
  finalAddress: ResolvedAddressFields,
}
```

Firestore rules: tenant-scoped read (own `companyId`), Admin-only delete, server-only write (via API route con `withAuth`).

Indexes: `(companyId, timestamp DESC)` + `(companyId, contextEntityType, timestamp DESC)`.

### 3.8 Undo/Redo

Stack scope: **per session** (sopravvive a navigation tra address editors). Persistito in `sessionStorage` come `address-editor-undo-stack`.

Timeout: **60 secondi** dopo l'ultima azione → flush dello stack (Google standard inline-undo è 30s, ma per address correction enterprise = 60s perché user può alternare focus tra mappa+form).

Ops trackable:
- field correction (single field)
- bulk correction (Reconciliation panel "Διόρθωσέ τα όλα")
- suggestion accept
- drag-resolved apply
- form clear (Ctrl+Backspace)

Keybinding: `Ctrl+Z` undo / `Ctrl+Shift+Z` redo.

### 3.9 Hierarchy validation (ELSTAT)

Greek-specific rules in `validateGreekHierarchy.ts`:

1. Postal code 5 digits, primo digit 1-9
2. Postal code prefix → expected city/region check (lookup table da ELSTAT)
3. Settlement → community → municipal unit → municipality → regional unit → region chain consistency
4. Mismatch → warning event in activity log + badge `unknown` su field

Lookup data: deriva da `src/data/elstat/` (esiste già — confermare in Phase 9).

### 3.10 Read-only mode enrichment

In `mode="view"`, il coordinator NON chiama Nominatim ma mostra comunque:

- **Source label** chip ("geocoded" / "manual" / "derived") — derivato da `address.source` (campo nuovo)
- **Freshness badge** ("verified 5 min ago" / "never verified") — derivato da `address.verifiedAt`
- **Has-coordinates** badge ("📍 has coords" / "❓ no coords")
- **Activity log** disabled (no live events)
- **No drag, no edit** — pure visualization con tooltips

Storage: `ProjectAddress` schema esteso con:

```typescript
interface ProjectAddress {
  // existing fields...
  source?: AddressSourceType;
  verifiedAt?: number;       // unix ms
  geocodingMetadata?: {
    confidence: number;
    accuracy: string;
    variantUsed: number;
    osmType?: string;
  };
}
```

Migration: campi opzionali, retro-compatibili. Esistenti addresses senza `source` fallback a `'unknown'`.

---

## 4. Phasing — 11 Phases, 1 Phase per Session

Ogni phase è progettata per:
- **Completarsi in una singola chat session** (~80-120k tokens budget)
- Avere **deliverable testabile** alla fine
- Avere **handoff template** preformattato per la sessione successiva
- Includere **commit + ADR Phase 3 update** entro la session
- **NESSUN push** senza ordine esplicito di Giorgio (CLAUDE.md N.(-1))

### Phase 0 — ADR + Foundation Types (corrente)
**Scope:** Questo file ADR + extension dei types core.
**Files:** ~5
**Deliverable:**
- ✅ `docs/centralized-systems/reference/adrs/ADR-332-enterprise-address-editor-system.md`
- `src/lib/geocoding/geocoding-types.ts` (NEW) — tutti i types condivisi (Layer 1+2)
- `src/components/shared/addresses/editor/types.ts` (NEW) — Layer 3-5 types
- `src/app/api/geocoding/geocoding-engine.ts` (MODIFY) — multi-result return + resolvedFields + reasoning + variant tracking
- `src/lib/geocoding/geocoding-service.ts` (MODIFY) — types extension, no behavior change yet
- `src/lib/geocoding/__tests__/geocoding-engine-multiresult.test.ts` (NEW)

**Acceptance:**
- TypeScript compile clean
- Engine returns 5-result array (top + 4 alternatives) ma il client legacy (Layer 7 esistente) continua a funzionare leggendo solo `data[0]`/top
- Test multi-result green
- Commit `feat(addresses): ADR-332 Phase 0 — engine multi-result + types foundation`
- ADR §10 Implementation Tracking aggiornato

**Handoff:** Phase 1 — State Machine + Core Hooks

---

### Phase 1 — State Machine + Core Hooks
**Scope:** Pure logic + main hooks, no UI yet.
**Files:** ~8
**Deliverable:**
- `src/components/shared/addresses/editor/state/addressEditorMachine.ts` (NEW) — pure state machine
- `src/components/shared/addresses/editor/state/transitions.ts` (NEW) — transition tables
- `src/components/shared/addresses/editor/helpers/diffAddressFields.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressEditor.ts` (NEW) — main hook
- `src/components/shared/addresses/editor/hooks/useAddressFieldStatus.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressActivity.ts` (NEW) — log accumulator
- `src/components/shared/addresses/editor/__tests__/addressEditorMachine.test.ts` (NEW)
- `src/components/shared/addresses/editor/__tests__/diffAddressFields.test.ts` (NEW)

**Acceptance:**
- State machine 100% test coverage
- `useAddressEditor` hook compila + standalone usable (no UI)
- Demo `app/demo/addresses-editor-state/page.tsx` mostra state transitions live (debugger view)
- ADR §10 update

**Handoff:** Phase 2 — Suggestions + Reconciliation Logic

---

### Phase 2 — Suggestions + Reconciliation Logic
**Scope:** Pattern B + C logic + supporting hooks.
**Files:** ~7
**Deliverable:**
- `src/components/shared/addresses/editor/helpers/computeSuggestionTriggers.ts` (NEW)
- `src/components/shared/addresses/editor/helpers/rankSuggestions.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressSuggestions.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressReconciliation.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressUndo.ts` (NEW) — sessionStorage stack
- `src/components/shared/addresses/editor/__tests__/computeSuggestionTriggers.test.ts` (NEW)
- `src/components/shared/addresses/editor/__tests__/rankSuggestions.test.ts` (NEW)

**Acceptance:**
- 4 suggestion triggers covered by tests (no-results, low-confidence, ambiguous, partial-match)
- Reconciliation diff produces correct field-by-field conflict list
- Undo stack persists across page navigation in sessionStorage
- ADR §10 update

**Handoff:** Phase 3 — Presentational Components Set 1

---

### Phase 3 — Presentational Components Set 1 (status indicators)
**Scope:** Compact status UI (badge, meter, source, freshness).
**Files:** ~10
**Deliverable:**
- `src/components/shared/addresses/editor/components/AddressFieldBadge.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressFieldTooltip.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressConfidenceMeter.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressSourceLabel.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressFreshnessIndicator.tsx` (NEW)
- `src/i18n/locales/el/addresses.json` (MODIFY) — ~15 keys
- `src/i18n/locales/en/addresses.json` (MODIFY) — ~15 keys
- `src/app/demo/addresses-editor/page.tsx` (NEW) — showcase page
- `src/components/shared/addresses/editor/__tests__/AddressFieldBadge.test.tsx` (NEW)

**Acceptance:**
- Demo page mostra tutti 5 components con tutti gli states (match/mismatch/unknown/etc.)
- i18n keys validated (no hardcoded strings — N.11)
- A11y: tooltips accessibili keyboard
- ADR §10 update

**Handoff:** Phase 4 — Presentational Components Set 2

---

### Phase 4 — Presentational Components Set 2 (panels)
**Scope:** Heavy UI panels (activity, reconciliation, suggestions, dialogs).
**Files:** ~10
**Deliverable:**
- `src/components/shared/addresses/editor/components/AddressActivityLog.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressReconciliationPanel.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressSuggestionsPanel.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressDiffSummary.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressDragConfirmDialog.tsx` (NEW)
- `src/components/shared/addresses/AddressMapStatusChip.tsx` (MODIFY) — extend states
- `src/i18n/locales/el/addresses.json` (MODIFY) — ~15 more keys
- `src/i18n/locales/en/addresses.json` (MODIFY) — ~15 more keys
- Demo page wiring update
- 1-2 test files

**Acceptance:**
- Activity log scrolla auto, supporta verbosity toggle
- Reconciliation panel wires `useAddressReconciliation` hook
- Suggestions panel keyboard-nav functional (↑↓ Enter Esc)
- Drag confirm dialog wires `useAddressEditor` drag flow
- ADR §10 update

**Handoff:** Phase 5 — Coordinator AddressEditor

---

### Phase 5 — Coordinator AddressEditor
**Scope:** Top-level orchestrator + Context, demo end-to-end.
**Files:** ~6
**Deliverable:**
- `src/components/shared/addresses/editor/AddressEditor.tsx` (NEW) — coordinator
- `src/components/shared/addresses/editor/AddressEditorContext.tsx` (NEW)
- `src/components/shared/addresses/editor/AddressEditor.types.ts` (NEW) — public API
- `src/components/shared/addresses/editor/index.ts` (NEW) — barrel export
- Demo page upgrade — full flow: typing → debounce → load → success/conflict/suggestions → apply → undo
- 1 integration test

**Acceptance:**
- Demo `/demo/addresses-editor` mostra end-to-end flow funzionante
- AddressEditor < 500 LOC, ogni funzione < 40 LOC
- Backward compat: il vecchio `AddressMap` rimane intatto e funzionante (per Phase 6+ migration graduale)
- ADR §10 update

**Handoff:** Phase 6 — Migration Wave 1: Contacts

---

### Phase 6 — Migration Wave 1: Contacts
**Scope:** Tutti i punti contacts che editano/visualizzano addresses.
**Files:** ~5
**Deliverable:**
- `src/components/contacts/dynamic/AddressesSectionWithFullscreen.tsx` (MODIFY) — wrap in AddressEditor
- `src/components/shared/addresses/AddressWithHierarchy.tsx` (MODIFY) — consume context for badges
- `src/components/contacts/details/ContactAddressMapPreview.tsx` (MODIFY) — bridge to AddressEditor
- `src/components/contacts/dynamic/CompanyAddressesSection.tsx` (MODIFY) — branches use editor
- `src/components/contacts/relationships/hooks/useDerivedWorkAddresses.ts` (verifica/touch only se serve)

**Acceptance:**
- HQ edit form mostra activity log + field badges + reconciliation panel
- Drag pin produce confirm dialog (no più silent overwrite)
- Branches editor stesso comportamento
- Derived work addresses (ADR-318) mostrano source label `derived` + read-only
- Test E2E manuale: edit contact → modifica ΤΚ → vede activity log + suggestion → applica → undo
- ADR §10 update

**Handoff:** Phase 7 — Migration Wave 2: Projects + Buildings

---

### Phase 7 — Migration Wave 2: Projects + Buildings
**Scope:** Project locations + building addresses + frontage.
**Files:** ~7
**Deliverable:**
- `src/components/projects/tabs/ProjectLocationsTab.tsx` (MODIFY)
- `src/components/projects/tabs/locations/LocationInlineForm.tsx` (MODIFY)
- `src/components/projects/tabs/locations/ProjectAddressFields.tsx` (MODIFY)
- `src/components/shared/addresses/AddressFormSection.tsx` (MODIFY)
- `src/components/building-management/tabs/GeneralTabContent/building-addresses-card/BuildingAddressesEditor.tsx` (MODIFY)
- `src/components/building-management/tabs/GeneralTabContent/building-addresses-card/BuildingAddressesMapPane.tsx` (MODIFY)
- `src/components/projects/building-code/FrontageAddressCreateDialog.tsx` (MODIFY)

**Acceptance:**
- 3 forms (project, building, frontage) mostrano stesso enterprise UI
- Test manuale per ognuno
- ADR §10 update

**Handoff:** Phase 8 — Migration Wave 3: Showcase + Procurement + Read-only

---

### Phase 8 — Migration Wave 3: Showcase + Procurement + Read-only Cards
**Scope:** Last edit form + read-only display surfaces.
**Files:** ~8
**Deliverable:**
- `src/components/property-showcase/AddressMapPicker.tsx` (MODIFY)
- `src/components/procurement/PODeliveryAddressField.tsx` (MODIFY)
- `src/components/shared/addresses/AddressCard.tsx` (MODIFY) — source/freshness badges
- `src/components/shared/addresses/AddressListCard.tsx` (MODIFY)
- `src/components/shared/addresses/SharedAddressActionCard.tsx` (MODIFY)
- `src/components/building-management/tabs/GeneralTabContent/building-addresses-card/BuildingAddressesManualList.tsx` (MODIFY)
- `src/components/contacts/list/ContactsList.tsx` (MODIFY) — inline mini badges (only source-coords-status)
- `src/types/project/addresses.ts` (MODIFY) — `source` + `verifiedAt` + `geocodingMetadata` fields

**Acceptance:**
- Read-only cards mostrano source label + freshness + has-coords
- Tutti i 28 punti dell'app ora rispettano lo standard nuovo
- ADR §10 update

**Handoff:** Phase 9 — Telemetry + Hierarchy Validation

---

### Phase 9 — Telemetry + Hierarchy Validation
**Scope:** Firestore logging + ELSTAT cross-check.
**Files:** ~10
**Deliverable:**
- `src/services/geocoding/address-corrections-telemetry.service.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressTelemetry.ts` (NEW)
- `src/app/api/geocoding/telemetry/route.ts` (NEW) — server-only write endpoint
- `src/components/shared/addresses/editor/helpers/validateGreekHierarchy.ts` (NEW)
- `src/components/shared/addresses/editor/helpers/postalCodeAutoFill.ts` (NEW)
- `firestore.rules` (MODIFY) — `address_corrections_log` rules
- `firestore.indexes.json` (MODIFY) — 2 composite indexes
- `src/config/firestore-collections.ts` (MODIFY) — register collection
- Tests
- `services/enterprise-id` — `acl_*` prefix se non esiste

**Acceptance:**
- Telemetry write su correction action — Firestore doc creato con tenant isolation
- Hierarchy validation produce activity events su mismatch
- Postal code auto-fill funzionante per `54635` → city `Θεσσαλονίκη`
- Firestore rules tested (ADR-298)
- ADR §10 update

**Handoff:** Phase 10 — Hardening

---

### Phase 10 — Hardening + A11y + Keyboard + Final
**Scope:** Polish + comprehensive a11y + ADR final lock.
**Files:** ~5 + tests
**Deliverable:**
- A11y audit pass: ARIA roles, live regions, focus management, screen reader announcements
- Keyboard shortcuts: `Ctrl+Z` undo, `Ctrl+Shift+Z` redo, `Ctrl+Shift+R` force re-geocode, `Esc` close panels, `↑↓ Enter` suggestions nav
- Comprehensive E2E test sweep
- `docs/centralized-systems/reference/adrs/ADR-332-...md` (MODIFY) — Phase 3 changelog finale, status `📋 PROPOSED → ✅ IMPLEMENTED`
- Update `docs/centralized-systems/reference/adr-index.md` (auto-generated; just run script)
- README/internals doc se necessario

**Acceptance:**
- A11y audit report: zero AA-level violations su demo + 1 contact form
- Keyboard nav fully functional senza mouse
- Tests > 90% coverage on new files
- ADR `IMPLEMENTED`
- Final commit `feat(addresses): ADR-332 IMPLEMENTED — enterprise address editor system v2.0`

**Handoff:** END (system ready for production)

---

## 5. Decisions log

### D1 — Coordinator vs prop-drilling vs Context
**RESOLVED — Coordinator (Layer 6) `AddressEditor`**
- Rejected: bare AddressMap + opt-in prop (compromise, not Google-grade)
- Rejected: global Context (overkill, breaks with multiple form/map pairs on same page)
- Chosen: **dedicated coordinator** che possiede form + map + tutti i panel
- Rationale: Google `<gmpx-place-picker>` pattern, SAP/Oracle/Mapbox convergence, single ownership = N.7.2 explicit lifecycle

### D2 — Form scope V1
**RESOLVED — All 9 forms migrated (Phases 6-8)**
- Rejected: contacts-only V1 (canary launch — ammessibile in MVP, rifiutato Enterprise)
- Rejected: 2/3 forms V1 phased
- Chosen: **all 9 forms** + read-only cards + map previews (Phases 6-8 progressive)
- Rationale: "Completeness over MVP" memory rule — Giorgio explicit GOL+SSOT mandate

### D3 — Pattern C trigger scope
**RESOLVED — 4 triggers (no-results / low-confidence / ambiguous / partial-match)**
- Rejected: 0-results-only (1 trigger) — under-utilized given limit=5 already requested
- Chosen: **all 4 triggers** with 0-extra Nominatim cost on triggers 2/3/4 (data already in response)
- Rationale: Google Geocoder API equivalent transparency

### D4 — Activity log default verbosity
**RESOLVED — `detailed` (default)**
- Rejected: `basic` (under-informs the user — contradicts mandate "πλήρη πληροφόρηση κάθε στιγμή")
- Rejected: `debug` (too noisy as default)
- Chosen: **`detailed`** with toggle to `basic` or `debug`
- Rationale: Giorgio explicit "πλήρη πληροφόρηση κάθε στιγμή"

### D5 — Telemetry collection
**RESOLVED — YES, `address_corrections_log/`**
- Storage cost: ~1 doc per address change, minimal vs business value
- Future ML/heuristics: track which suggestions are accepted to improve ranking
- Rules: tenant-isolation via companyId + Admin-only delete

### D6 — Undo timeout
**RESOLVED — 60 seconds**
- Rejected: 30s (Google standard inline-undo) — insufficient per address correction (user alterna mappa+form)
- Rejected: permanent stack — confusing scope
- Chosen: **60s session-scoped** in sessionStorage

### D7 — Read-only enrichment
**RESOLVED — Source + Freshness + Has-coords badges everywhere**
- Includes ContactsList inline (compact only-coords-status badge)
- Schema migration: `ProjectAddress.source` + `.verifiedAt` + `.geocodingMetadata` (optional fields, retro-compatible)

### D8 — Hierarchy validation engine
**RESOLVED — `validateGreekHierarchy.ts` + ELSTAT data lookup**
- Postal code 5-digit + first-digit 1-9 strict
- Postal-code → expected-region table from ELSTAT (data layer pre-existente)
- Mismatch produce activity event + field badge `unknown`

### D9 — Backward compatibility durante rollout
**RESOLVED — Old `AddressMap` standalone preservato fino al Phase 8 done**
- Phases 0-5 building su parallel tree (`editor/` subdir)
- Phase 6-8 migration progressive
- Ogni session è committable + non-breaking

### D10 — Phase split granularity
**RESOLVED — 11 phases, 1 phase per session, handoff-driven**
- Mandate Giorgio: clean context per session, no noise
- Dopo ogni phase: handoff template paste-able per nuova session
- Self-contained: nuova session non richiede memoria della precedente, solo l'handoff

---

## 6. Files inventory (final estimate)

### Layer 1+2 (Engine + Service) — Phase 0
- 1 NEW types file
- 2 MODIFY (engine, service)
- 1 NEW test

### Layer 3 (State machine) — Phase 1
- 2 NEW (machine, transitions)
- 1 NEW helper (diffAddressFields)
- 1 NEW test

### Layer 4 (Hooks) — Phase 1+2
- 6 NEW hooks
- 2 NEW helpers (computeSuggestionTriggers, rankSuggestions)
- 3-4 NEW tests

### Layer 5 (Presentational) — Phase 3+4
- 10 NEW components
- 1 MODIFY (AddressMapStatusChip)
- 2 NEW tests
- 2 MODIFY i18n (~30 keys total)

### Layer 6 (Coordinator) — Phase 5
- 3 NEW (AddressEditor, Context, types)
- 1 NEW barrel export
- 1 NEW integration test
- Demo page upgrade

### Layer 7 (Migration) — Phase 6+7+8
- ~20 MODIFY across all 7 domains

### Layer 8 (Telemetry + Hierarchy) — Phase 9
- 5 NEW files
- 4 MODIFY (rules, indexes, collections, enterprise-id)
- 2-3 NEW tests

### Layer 9 (Hardening) — Phase 10
- A11y audit + adjustments (~5 MODIFY)
- ADR final lock
- E2E test sweep

**Total estimate: ~50-55 files** (NEW + MODIFY combined). Distribuiti in 11 phases.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Performance regression** — coordinator wraps form+map adding render cost | React.memo + selective context; before/after profile in Phase 5 |
| **Backward compat break** — 28 sites depend on existing AddressMap API | Old AddressMap preserved untouched fino al Phase 8; new editor è additive subdir |
| **i18n key explosion** — ~50 nuove keys | Namespace dedicato `addresses.editor.*`; aggiungere keys in baseline (CHECK 3.8) prima di compilare |
| **Telemetry storage cost** — 1 doc/correction × N users | TTL via Cloud Function (30 days retention default — configurabile) |
| **State machine complexity** — 9 phase states + transitions | Pure logic con 100% test coverage Phase 1; XState-style se serve |
| **Session token budget overflow** — phase non sta in 1 session | Phase 6+7+8 splittable in sub-sessions se needed; ADR § 4 modifiable |
| **i18n CHECK 3.13 (runtime resolver reachability)** | Use single useTranslation per file; ensure keys reachable via static analyzer |

---

## 8. Pre-commit Implications

- **CHECK 3.7 SSoT ratchet** — new module `address-editor` aggiunto a `.ssot-registry.json` Phase 5
- **CHECK 3.8 i18n missing keys** — ~50 nuove keys aggiunte a baseline Phase 3+4+9
- **CHECK 3.10 Firestore companyId** — `address_corrections_log` queries devono includere companyId (Phase 9)
- **CHECK 3.13 i18n resolver reachability** — Phase 3+4+10 audit
- **CHECK 3.14 Audit value catalogs** — N/A (no enum/catalog changes)
- **CHECK 3.15 Firestore index coverage** — 2 nuovi composite indexes Phase 9
- **CHECK 3.16 Firestore rules tests** — `address_corrections_log/` test in `firestore-rules-tests/` Phase 9
- **CHECK 3.17 Entity audit coverage** — N/A (telemetry separato da entity audit)
- **CHECK 3.18 SSoT discover** — geocoding-engine no duplicates (Phase 0 audit)
- **CHECK 3.23 Native HTML tooltip** — `AddressFieldTooltip` use Radix Tooltip, non `title=`

---

## 9. Acceptance Criteria — System-level

Sistema considerato `IMPLEMENTED` quando:

1. ✅ Tutti i 28 punti dell'app usano `<AddressEditor>` o consumano i suoi badge components
2. ✅ Activity log visibile in tutti gli edit forms con verbosity togglabile
3. ✅ Field-level badges visibili in tutti i 9 form fields
4. ✅ Reconciliation panel triggers correttamente su partial-match + drag conflict
5. ✅ Suggestions panel triggers correttamente su tutti i 4 trigger types
6. ✅ Confidence meter visibile su map status chip
7. ✅ Source label + freshness indicator visibili su tutte le read-only cards
8. ✅ Telemetry logging funzionante (Firestore docs creati con tenant isolation)
9. ✅ Undo/redo funzionante con sessionStorage persistence
10. ✅ Keyboard shortcuts tutti funzionanti
11. ✅ A11y audit passes (zero AA-level violations)
12. ✅ Test coverage > 90% su nuovi files
13. ✅ ADR-332 status `IMPLEMENTED`
14. ✅ adr-index.md auto-rigenerato

---

## 10. Implementation Tracking

| Phase | Status | Session Date | Commit Hash | Notes |
|-------|--------|--------------|-------------|-------|
| Phase 0 — ADR + Foundation Types | ✅ COMPLETED | 2026-05-05 | ADR + multi-result | Two commits: (a) ADR file proposed, (b) engine multi-result + types foundation. 11 tests green. Backward-compat preserved. |
| Phase 1 — State Machine + Core Hooks | ⏳ PENDING | — | — | — |
| Phase 2 — Suggestions + Reconciliation Logic | ⏳ PENDING | — | — | — |
| Phase 3 — Presentational Components Set 1 | ⏳ PENDING | — | — | — |
| Phase 4 — Presentational Components Set 2 | ⏳ PENDING | — | — | — |
| Phase 5 — Coordinator AddressEditor | ⏳ PENDING | — | — | — |
| Phase 6 — Migration Wave 1: Contacts | ⏳ PENDING | — | — | — |
| Phase 7 — Migration Wave 2: Projects + Buildings | ⏳ PENDING | — | — | — |
| Phase 8 — Migration Wave 3: Showcase + Procurement + Read-only | ⏳ PENDING | — | — | — |
| Phase 9 — Telemetry + Hierarchy Validation | ⏳ PENDING | — | — | — |
| Phase 10 — Hardening + A11y + Keyboard + Final | ⏳ PENDING | — | — | — |

---

## 11. Handoff Templates

### Template — End of Phase N → Start of Phase N+1

```
ΣΥΝΕΧΕΙΑ ΕΡΓΑΣΙΑΣ: ADR-332 Enterprise Address Editor System — Phase {N+1}

ΟΛΟΚΛΗΡΩΜΕΝΑ (committed, NOT pushed):
- Phase 0 → ... → Phase N (commit hashes)
- ADR `docs/centralized-systems/reference/adrs/ADR-332-enterprise-address-editor-system.md` aggiornato
- Last commit: <hash> "<message>"

ΕΠΟΜΕΝΟ ΒΗΜΑ — Phase {N+1}: <phase title>
- Scope: <copy from §4 of ADR-332>
- Files: <list>
- Deliverable: <list>
- Acceptance: <list>

ΑΡΧΕΙΑ ΠΡΟΣ ΕΛΕΓΧΟ/ΕΠΕΞΕΡΓΑΣΙΑ (estimate):
- <files>

ΣΗΜΑΝΤΙΚΕΣ ΡΥΘΜΙΣΕΙΣ (CLAUDE.md):
- N.(-1): NO push χωρίς ρητή εντολή
- N.7.1: αρχεία ≤ 500 lines, functions ≤ 40 lines
- N.11: zero hardcoded i18n strings — keys πρώτα στα locale JSONs
- GOL + SSOT mandatory
- LANGUAGE: Giorgio γράφει ελληνικά → απαντάς ιταλικά by default

ΠΡΩΤΟ ΣΟΥ MESSAGE:
"🎯 Modello consigliato: Sonnet 4.6 (per Phase 1-4-7-8) / Opus 4.7 (per Phase 0-2-3-5-6-9-10)
Motivo: <riassunto scope>
⏸️ In attesa di conferma — rispondi 'ok' per procedere."

ΞΕΚΙΝΑ ΜΕ:
1. Διάβασε `docs/centralized-systems/reference/adrs/ADR-332-enterprise-address-editor-system.md` (Phase {N+1} sezione)
2. Διάβασε i file deliverable della phase precedente per capire il contesto
3. Implementa Phase {N+1} secondo § 4 dell'ADR
4. Tests + ADR §10 update + commit (NO push)
5. Genera handoff template per Phase {N+2}
```

---

## 12. References

- ADR-145 (super-admin-ai-assistant) — for telemetry collection pattern
- ADR-168 (draggable-markers) — extends drag flow with confirm dialog
- ADR-277 (drag-hierarchy-clear) — Reconciliation Panel applies to this flow
- ADR-279/280 (i18n-runtime-resolver) — array useTranslation pattern for keys
- ADR-282 (contact-persona-architecture) — derived addresses (ADR-318)
- ADR-294 (ssot-ratchet-enforcement) — register `address-editor` module
- ADR-298 (firestore-rules-tests) — `address_corrections_log` rules tested
- ADR-318 (derived-work-addresses) — read-only derived pins
- ADR-319 (hq-positional-invariant) — primary address index
- ADR-330 (procurement-hub-scoped-split) — pattern reference for phase-driven session work
- CLAUDE.md N.7 / N.7.1 / N.7.2 / N.11 / N.12 / N.14
