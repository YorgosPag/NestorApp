# Address Geocoding & Map Projection Investigation (OSM/Nominatim)

Date: 2026-02-16
Scope: Why added addresses are not projected correctly on the map and why Greeklish queries are unreliable.

## 1) External Research (OSM / Nominatim)

### 1.1 What Nominatim expects for best quality
- Nominatim Search API supports both free-form query (`q=...`) and structured address params (`street`, `city`, `postalcode`, `country`, etc.). For address precision, structured search is generally more deterministic than a single free-form `q`.
- `accept-language` can control language preference of returned labels.
- `countrycodes` restricts search geography but does not guarantee exact city/street match.
- Public Nominatim usage requires polite usage patterns (rate limiting, proper identification headers/referer, no aggressive bursts).

### 1.2 Greek / transliterated names behavior
- Nominatim supports multilingual data from OSM and can match via tokenizer/transliteration logic.
- In practice, quality for Greeklish varies by local data quality, stored name variants (`name`, `name:el`, `name:en`), and query quality.
- Conclusion: We should not rely on a single raw user query only. We need normalized and fallback query variants.

Inference note:
- Based on OSM/Nominatim docs and behavior, Greeklish is not guaranteed to resolve equally well for all addresses unless we send robust query variants and better constraints.

## 2) Codebase Investigation Findings

### Critical Finding A: Cache key collision can return wrong coordinates
- File: `src/services/real-estate-monitor/AddressResolver.ts:510`
- Current cache key:
  - `${street}_${number}_${area}_${postalCode}` (lowercase)
- Missing fields: `city`, `country`, `municipality`, `region`.
- Impact:
  - Different cities with same street/number may reuse wrong cached coordinates.
  - This directly explains “address appears in wrong place on map”.

### Critical Finding B: Parsed `area` is overwritten by a narrow hardcoded detector
- File: `src/services/real-estate-monitor/AddressResolver.ts:171`, `src/services/real-estate-monitor/AddressResolver.ts:192`, `src/services/real-estate-monitor/AddressResolver.ts:204`
- Behavior:
  - Regex first extracts area from input.
  - Then `result.area = this.extractArea(cleaned)` overwrites it.
  - `extractArea` recognizes only a short hardcoded list (mostly Attica neighborhoods).
- Impact:
  - Valid areas outside the hardcoded list are dropped.
  - Query quality degrades; fallback behavior becomes inconsistent.

### Critical Finding C: Region is hardcoded to Attica
- File: `src/services/real-estate-monitor/AddressResolver.ts:270`, `src/services/real-estate-monitor/AddressResolver.ts:272`
- Behavior:
  - `detectRegion()` always returns `'Αττική'`.
- Impact:
  - Wrong regional context for addresses outside Attica.
  - Increases mismatch risk in both geocoding and confidence scoring.

### Critical Finding D: Synthetic area fallback coordinates can place marker at approximate/wrong location
- File: `src/services/real-estate-monitor/AddressResolver.ts:369-383`
- Behavior:
  - `resolveAreaCenter()` uses generated nearby coordinates around default city for several areas.
- Impact:
  - Marker may show “somewhere nearby” rather than real geocoded address.
  - For users this looks like incorrect map projection.

### Critical Finding E: Burst geocoding from AddressMap without request pacing
- File: `src/components/shared/addresses/AddressMap.tsx:170`
- Behavior:
  - Uses `Promise.allSettled` for all addresses at once.
- Impact:
  - Can trigger throttling/partial failures on public Nominatim.
  - Leads to unstable geocoding results and inconsistent rendering.

### High Finding F: Browser-side User-Agent setting is unreliable for policy compliance
- File: `src/services/real-estate-monitor/AddressResolver.ts:315`
- Behavior:
  - Tries to set `User-Agent` in client-side fetch (`'use client'`).
- Impact:
  - Browser may not apply this header as intended.
  - Policy/identification compliance should be handled server-side proxy.

### High Finding G: Greeklish normalization strategy is missing in geocoding flow
- Files:
  - `src/services/real-estate-monitor/AddressResolver.ts:148`
  - `src/subapps/geo-canvas/components/AddressSearchPanel.tsx:136`
- Behavior:
  - Single query attempt only (`resolve(searchQuery.trim())`).
  - No query variant pipeline: original + accent-stripped + Greeklish→Greek + Greek→Latin alternatives.
- Impact:
  - Greeklish inputs have lower hit rate.

### Medium Finding H: Confidence scoring is script/diacritics-sensitive
- File: `src/services/real-estate-monitor/AddressResolver.ts:469-479`
- Behavior:
  - `display_name?.includes(...)` raw includes checks.
- Impact:
  - Under-scores valid matches when scripts/accents differ.

### Medium Finding I: No dedicated tests for geocoding parser/resolver behavior
- Repo search found no unit tests for AddressResolver path.
- Impact:
  - Regressions in parsing/matching remain undetected.

## 3) Centralized Fix Plan (Single Source of Truth)

### 3.1 Create centralized geocoding normalization module
- New module (suggested): `src/lib/geocoding/geocoding-normalization.ts`
- Responsibilities:
  - Unicode normalization + accent stripping.
  - Greek final sigma normalization.
  - Greeklish→Greek transliteration.
  - Greek→Latin transliteration for alternative query generation.
- Reuse existing logic from:
  - `src/services/ai-pipeline/shared/greek-text-utils.ts`
  - `src/services/ai-pipeline/shared/greek-nlp.ts`
- Do not duplicate transliteration logic in AddressResolver.

### 3.2 Replace single-query with centralized query strategy
- New module (suggested): `src/lib/geocoding/geocoding-query-strategy.ts`
- Query order:
  1. Structured query (street/number/city/postalCode/country).
  2. Free-form original.
  3. Free-form normalized (accent-stripped).
  4. Greeklish→Greek variant.
  5. Greek→Latin variant.
- Stop on first high-confidence result.

### 3.3 Move Nominatim calls server-side
- Add internal API route/proxy for geocoding.
- Enforce:
  - rate limiting / queue (e.g. 1 req/sec for public endpoint).
  - proper identification headers.
  - retry/backoff and provider fallback.
- Keep client purely as consumer of internal geocoding API.

### 3.4 Fix cache key design
- Include canonical fields in key:
  - street, number, city, postalCode, municipality, region, country.
- Normalize all before key generation.
- Version cache schema to invalidate old wrong entries.

### 3.5 Remove hardcoded area/region assumptions
- Do not overwrite regex-derived area with limited list.
- If area extraction helper is used, make it additive (fallback only), not destructive.
- Replace hardcoded `Αττική` return with real derivation or no forced region.

### 3.6 Rework fallback behavior
- Keep `resolveAreaCenter` as explicit low-confidence fallback only.
- Mark such results clearly and avoid using them when exact street-level query failed but ambiguity is high.
- Never silently present synthetic area center as if exact address match.

### 3.7 Update AddressMap batching behavior
- Replace uncontrolled `Promise.allSettled` burst with controlled queue/concurrency (e.g. 1-2 parallel max).
- Surface partial-failure diagnostics in UI.

### 3.8 Add tests (mandatory)
- Unit tests for:
  - parser behavior with Greek + Greeklish + mixed inputs.
  - cache key uniqueness across city/country differences.
  - query strategy fallback order.
  - confidence normalization (accent/script-insensitive comparisons).
- Integration tests for map marker projection consistency.

## 4) Prioritized Implementation Order
- P0: Cache key redesign + cache invalidation.
- P0: Stop area overwrite and remove forced Attica region.
- P0: Server-side geocoding proxy with throttling.
- P1: Centralized normalization/query strategy for Greeklish.
- P1: Confidence scoring normalization.
- P2: UI diagnostics + deeper observability metrics.

## 5) Files Most Likely to Change
- `src/services/real-estate-monitor/AddressResolver.ts`
- `src/components/shared/addresses/AddressMap.tsx`
- `src/subapps/geo-canvas/components/AddressSearchPanel.tsx`
- `src/types/project/address-helpers.ts`
- New centralized modules under `src/lib/geocoding/*`

## Sources
- Nominatim Search API: https://nominatim.org/release-docs/latest/api/Search/
- Nominatim Usage Policy (OSMF): https://operations.osmfoundation.org/policies/nominatim/
- Nominatim Customization / Tokenizers (transliteration behavior): https://nominatim.org/release-docs/latest/customize/Tokenizers/
- OpenStreetMap multilingual naming conventions: https://wiki.openstreetmap.org/wiki/Multilingual_names
