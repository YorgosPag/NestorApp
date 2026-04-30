# ADR-328 — RFQ Detail Page: Contacts-Style Split Layout

**Status:** ACCEPTED  
**Date:** 2026-04-29  
**Author:** Giorgio Pagonis  
**Supersedes:** N/A  
**Related:** ADR-327 (Multi-Vendor Architecture), ADR-267 (Quote Detail Header SSoT)

---

## ⚠️ TIME-SENSITIVE NOTICE — READ BEFORE IMPLEMENTING

**As of the ADR write date (2026-04-29):** All Firestore + Storage data is **test/draft** and will be wiped before production deployment. §5.Q therefore states "no migration required."

**However:** Giorgio has indicated production deployment may occur **within ~1 week** of this ADR (i.e. roughly the week of 2026-05-06). Once real production data exists, the test-data assumption **breaks** and migration becomes mandatory for any new schema fields added by this ADR (e.g. `version`, `updatedAt`, `updatedBy` from §5.J).

### If you are reading this ADR after 2026-05-06 — CHECK FIRST:

1. **Has production launched?** Check `git log` for "production" / "launch" / "go-live" commit messages.
2. **Is there real customer data in Firestore?** Check non-test `companyId` documents in collections touched by this ADR (`rfqs`, `quotes`, `vendor_invites`, `rfq_lines`).
3. **If YES to either** → §5.Q is **invalid**. You must:
   - Open a migration ADR before merging schema changes from §5.J
   - Backfill `version`, `updatedAt`, `updatedBy` on existing documents
   - Add fallback paths in optimistic-locking code for documents missing the new fields
   - Coordinate the schema change with Firestore rules and indexes
4. **If NO** → §5.Q remains valid; proceed as written.

**Do not silently skip this check.** Assuming "test data" without verification when production is already live can corrupt customer state. The 1-week window is tight — verify, do not assume.

The current RFQ detail page (`/procurement/rfqs/[id]`) uses a stacked linear layout:

```
[Back button] [Title] [Scan button] [New Quote button]
──────────────────────────────────────────────────────
[QuoteList — narrow left column]   (right: empty)
[SourcingEventSummaryCard]         ← full width, below list
[ComparisonPanel]                  ← full width, below
[RfqLinesPanel]                    ← full width, below
[VendorInviteSection]              ← full width, below
```

**Problems identified:**
1. No breadcrumb — user loses navigation context
2. No stats dashboard — no quick KPIs visible at a glance
3. All sections stacked vertically → excessive scroll, no spatial clarity
4. QuoteList has a left column but no right detail pane (split layout incomplete)
5. Comparison panel, RFQ lines, and vendor invites mixed in one linear flow without hierarchy

**Reference pattern:** The Contacts page (`/contacts`) demonstrates the correct layout pattern used across the app:
- `PageHeader` (sticky-rounded) with `ModuleBreadcrumb` + eye-toggle for stats
- `UnifiedDashboard` (collapsible stats cards)
- `AdvancedFiltersPanel` (collapsible)
- Split layout: left list panel (CompactToolbar + search + QuickFilters + cards) / right detail pane

---

## 2. Decision

Redesign the RFQ detail page to adopt the contacts-style layout, using all existing centralized systems. The three conceptually distinct sections (quote browsing, comparison analysis, RFQ configuration) are organized into **3 tabs** to eliminate the linear scroll and give each section appropriate space.

---

## 3. New Page Structure

```
PageHeader (sticky-rounded, ModuleBreadcrumb, dashboard toggle)
UnifiedDashboard (toggleable, 4–6 stats cards)
─── Tabs ──────────────────────────────────────────────────────
[Tab 1: Προσφορές]  [Tab 2: Σύγκριση]  [Tab 3: Ρύθμιση RFQ]
```

### 3.1 Default Active Tab (smart selection)

When the page loads, the active tab is chosen based on the RFQ state:

| Condition | Default tab | Rationale |
|-----------|------------|-----------|
| `quotes.length === 0` | **Setup** (Ρύθμιση RFQ) | No quotes yet → user is still configuring (lines/invites) |
| `quotes.length > 0` | **Quotes** (Προσφορές) | Quotes received → primary intent is browsing them |

Implementation: derive initial `activeTab` from `quotes` on first render (after data load), then user-controlled.

```ts
const [activeTab, setActiveTab] = useState<'quotes'|'comparison'|'setup'>(() =>
  quotes.length > 0 ? 'quotes' : 'setup'
);
```

Note: since `quotes` may be empty during the initial loading phase, the initial state should be set inside an effect that fires once when quotes finish loading (avoid flicker from `setup` → `quotes`).

### 3.2 Default Selected Quote (Tab 1 — smart selection)

When Tab 1 (Quotes) opens and `quotes.length > 0`, a quote is auto-selected so the right pane is never empty on first view. Selection priority:

| Priority | Condition | Reason |
|----------|-----------|--------|
| 1 | First quote with `status === 'under_review'`, sorted by `submittedAt ASC` (oldest first) | Demands user attention — waiting longest = most urgent |
| 2 | Most recently submitted quote (`submittedAt DESC`) | If nothing under review, show the freshest activity |
| 3 | First quote in list (any state) | Fallback if no `submittedAt` available |

Implementation pattern:

```ts
const defaultQuote = useMemo(() => {
  if (quotes.length === 0) return null;
  const underReview = quotes
    .filter(q => q.status === 'under_review')
    .sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
  if (underReview.length > 0) return underReview[0];
  const sorted = [...quotes].sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
  return sorted[0] ?? quotes[0];
}, [quotes]);
```

User selection then overrides this default and persists for the session.

### 3.3 Dashboard Default Visibility

The stats dashboard (`UnifiedDashboard`) is **hidden by default** when the page loads. The user reveals it via the eye-toggle in the `PageHeader`.

```ts
const [showDashboard, setShowDashboard] = useState(false);
```

**Rationale:** Maximize vertical space for primary content (quote list + detail pane). Stats are secondary information that the user requests on demand. No persistence across sessions — each page visit starts hidden (consistent, predictable behavior).

### 3.4 URL State Persistence (Google-pattern: «URL is state»)

Both `activeTab` and `selectedQuote` are persisted in the URL via search params. This makes the page **shareable**, **refresh-safe**, **bookmarkable**, and gives **correct browser back/forward** behavior.

**URL shape:**
```
/procurement/rfqs/{rfqId}?tab={quotes|comparison|setup}&quote={quoteId}
```

**Examples:**
- `/procurement/rfqs/rfq_abc?tab=comparison` — comparison tab, no specific quote
- `/procurement/rfqs/rfq_abc?tab=quotes&quote=q_xyz` — quote q_xyz open in detail pane
- `/procurement/rfqs/rfq_abc` — no params → both fall back to smart defaults (§3.1, §3.2)

**Fallback rules:**

| Situation | Behavior |
|-----------|----------|
| `?tab` missing | Use smart default from §3.1 |
| `?tab` invalid value | Use smart default from §3.1, silently rewrite URL via `router.replace` |
| `?quote` missing | Use smart default from §3.2 |
| `?quote` references a deleted quote | Re-apply smart default from §3.2, silently rewrite URL via `router.replace` (no toast/error — the page just adjusts) |
| `?quote` valid but `tab !== 'quotes'` | Keep both — the URL preserves the user's last quote selection even when viewing other tabs |

**Navigation method:**

| User action | Method | Why |
|-------------|--------|-----|
| Tab change | `router.push` | Each tab is a navigable view → browser back/forward should step through them |
| Quote selection within Tab Quotes | `router.replace` | Refining the same view, not a new navigation step → avoids cluttering history |
| URL self-correction (deleted quote, invalid tab) | `router.replace` | Silent normalization, never adds history entries |

**Implementation pattern:**

```ts
'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const router = useRouter();
const pathname = usePathname();
const searchParams = useSearchParams();

const tabParam = searchParams.get('tab');
const quoteParam = searchParams.get('quote');

const activeTab = useMemo<TabValue>(() => {
  const valid = ['quotes', 'comparison', 'setup'] as const;
  if (tabParam && (valid as readonly string[]).includes(tabParam)) {
    return tabParam as TabValue;
  }
  return quotes.length > 0 ? 'quotes' : 'setup';
}, [tabParam, quotes.length]);

const selectedQuote = useMemo<Quote | null>(() => {
  if (!quoteParam) return defaultSelectedQuote(quotes);
  const found = quotes.find(q => q.id === quoteParam);
  return found ?? defaultSelectedQuote(quotes);
}, [quoteParam, quotes]);

// Tab change → push
const handleTabChange = useCallback((nextTab: TabValue) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', nextTab);
  router.push(`${pathname}?${params.toString()}`);
}, [router, pathname, searchParams]);

// Quote select → replace (no history entry)
const handleSelectQuote = useCallback((quote: Quote | null) => {
  const params = new URLSearchParams(searchParams.toString());
  if (quote) params.set('quote', quote.id);
  else params.delete('quote');
  router.replace(`${pathname}?${params.toString()}`);
}, [router, pathname, searchParams]);

// Self-correct invalid params on mount
useEffect(() => {
  if (quoteParam && !quotes.find(q => q.id === quoteParam) && quotes.length > 0) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('quote');
    router.replace(`${pathname}?${params.toString()}`);
  }
}, [quoteParam, quotes, searchParams, router, pathname]);
```

**Why no useState for these:** Single source of truth = URL. Local state would risk drift between URL and rendered state, breaking the share/refresh contract.

**Edge case — initial load before quotes resolve:**
If `quotes` is loading (empty array) and the URL has no `?tab`, the smart default would briefly choose `setup` (since `length === 0`), then flicker to `quotes` once data arrives. Solution: gate the smart default on `quotesLoading`:

```ts
if (quotesLoading) return tabParam ?? 'quotes'; // optimistic guess until data resolves
```

### Tab 1 — Προσφορές (Quote Browser)

Split layout, identical pattern to Contacts:

```
┌─ Left panel (≈380px fixed) ─────┐  ┌─ Right panel (flex) ───────────────────┐
│ [CompactToolbar: quotesConfig]  │  │ [QuoteDetailsHeader SSoT]              │
│ [Search input]                  │  │   displayNumber + status badge         │
│ [QuoteStatusQuickFilters]       │  │   actions: Επεξεργασία / Επιβεβαίωση  │
│ ─────────────────────────────  │  │ ─────────────────────────────────────  │
│ [QuoteListCard] × N             │  │ [QuoteDetailSummary]                   │
│   (scrollable)                  │  │   Original doc (compact)               │
│                                 │  │   All lines                            │
│                                 │  │   Totals                               │
│                                 │  │   Terms                                │
│                                 │  │ (empty state if no quote selected)     │
└─────────────────────────────────┘  └────────────────────────────────────────┘
```

**Components used (all existing, no new code):**
- Left: `QuoteList` (already has CompactToolbar + search + QuickFilters + cards)
- Right: `QuoteDetailSummary` (already exists, used in `/procurement/quotes` page)
- Right header: `QuoteDetailsHeader` (SSoT from ADR-267)

**Wiring needed:**
- `QuoteList` passes selected quote up via `onSelectQuote` callback (prop already exists)
- Parent holds `selectedQuote: Quote | null` state
- Right pane renders `QuoteDetailSummary` when `selectedQuote !== null`

### Tab 2 — Σύγκριση (Comparison)

Full-width, no split needed (comparison table needs horizontal space):

```
[RecommendationCard]          (if comparison.recommendation exists)
[SourcingEventSummaryCard]    (if rfq.sourcingEventId exists)
[ComparisonPanel]             (full table: vendor / total / score / breakdown / flags / award)
```

All components already exist. No structural changes to them.

### Tab 3 — Ρύθμιση RFQ (RFQ Configuration)

Full-width, two stacked sections:

```
[RfqLinesPanel]         (line items that define what was requested)
[VendorInviteSection]   (invite management: create / revoke / resend)
```

All components already exist.

---

## 4. Centralized Systems Used (SSOT)

| System | Component | Import path | Status |
|--------|-----------|-------------|--------|
| Breadcrumb | `ModuleBreadcrumb` | `@/components/shared/ModuleBreadcrumb` | Already has `procurement` + `quotes` segments |
| Page header | `PageHeader` | `@/core/headers` | Already used in contacts/other pages |
| Stats dashboard | `UnifiedDashboard` | `@/components/property-management/dashboard/UnifiedDashboard` | Used in contacts, projects, etc. |
| Compact toolbar | `CompactToolbar` (quotesConfig) | `@/components/core/CompactToolbar` | Already in QuoteList |
| Quick filters | `QuoteStatusQuickFilters` | `@/components/shared/TypeQuickFilters` | Already in QuoteList |
| Advanced filters | `AdvancedFiltersPanel` | `@/components/core/AdvancedFilters` | ❌ **Removed from scope** per §5.W (Q27) — covered by quick filters + smart search |
| Quote list | `QuoteList` | `@/subapps/procurement/components/QuoteList` | Already in RfqDetailClient |
| Quote detail | `QuoteDetailSummary` | `@/subapps/procurement/components/QuoteDetailSummary` | Used in `/procurement/quotes` |
| Quote header | `QuoteDetailsHeader` | `@/core/entity-headers` (ADR-267) | SSoT header with actions |
| Comparison | `ComparisonPanel` | `@/subapps/procurement/components/ComparisonPanel` | Already in RfqDetailClient |
| Recommendation | `RecommendationCard` | `@/subapps/procurement/components/RecommendationCard` | Sub-component of ComparisonPanel |
| Sourcing event | `SourcingEventSummaryCard` | `@/subapps/procurement/components/SourcingEventSummaryCard` | Already in RfqDetailClient |
| RFQ lines | `RfqLinesPanel` | `@/subapps/procurement/components/RfqLinesPanel` | Already in RfqDetailClient |
| Invites | `VendorInviteSection` | `@/subapps/procurement/components/VendorInviteSection` | Already in RfqDetailClient |

**New items required:**
1. `buildRfqDashboardStats(rfq, quotes, invites, comparison, activeTab, t)` — factory function for stats cards, returns 4 context-aware cards based on `activeTab` (mirrors `buildContactDashboardStats` pattern)
2. ~~`rfqQuoteFiltersConfig` — `AdvancedFiltersPanel` config~~ — **removed per §5.W** (Q27): at the §5.N scale (3-5 typical, max 10 quotes), `QuoteStatusQuickFilters` + smart search (§5.U) cover all realistic filtering needs without the cost of an advanced filter panel

---

## 5. Stats Dashboard Definition (per-tab, context-aware)

The dashboard contents change based on `activeTab` so each tab surfaces stats relevant to its purpose. The factory accepts the active tab as input:

```ts
buildRfqDashboardStats(rfq, quotes, invites, comparison, activeTab, t): StatCard[]
```

### 5.1 Tab «Προσφορές» — Quote browsing context

| Card | Value | Icon | Color |
|------|-------|------|-------|
| Συνολικές Προσφορές | `quotes.length` | `FileText` | blue |
| Υπό Εξέταση | `quotes.filter(q => q.status === 'under_review').length` | `Clock` | orange |
| Εγκρίθηκαν | `quotes.filter(q => q.status === 'accepted').length` | `CheckCircle` | green |
| Καλύτερη Τιμή | `min(quotes.filter(q => q.totals?.total).map(q => q.totals.total))` | `TrendingDown` | cyan |

### 5.2 Tab «Σύγκριση» — Comparison context

| Card | Value | Icon | Color |
|------|-------|------|-------|
| Καλύτερη Τιμή | `min(quotes.totals.total)` | `TrendingDown` | green |
| Χειρότερη Τιμή | `max(quotes.totals.total)` | `TrendingUp` | red |
| Διαφορά (€) | `max - min` of submitted quotes | `ArrowDownUp` | orange |
| Σύσταση Συστήματος | `comparison?.recommendation?.vendorName ?? '—'` | `Sparkles` | purple |

### 5.3 Tab «Ρύθμιση RFQ» — Configuration context

| Card | Value | Icon | Color |
|------|-------|------|-------|
| Σύνολο Γραμμών | `rfq.lines.length` | `List` | blue |
| Συνολικός Όγκος | `sum(rfq.lines.map(l => l.quantity))` (τμχ) | `Package` | indigo |
| Προσκλήσεις | `invites.length` | `Mail` | purple |
| Εκκρεμείς | `invites.filter(i => i.status === 'pending').length` | `AlertCircle` | yellow |

**Notes:**
- Stat count per tab: 4 cards (clean grid `columns={4}`)
- All values gracefully fall back to `0` or `'—'` when source data is empty/null
- Switching tabs updates stats live (no manual reload)

---

## 5.A PageHeader Action Buttons (per-tab, context-aware)

The action buttons in `PageHeader.actions.customActions` change based on `activeTab`. Each tab exposes only the actions relevant to its content.

### 5.A.1 Tab «Προσφορές»

| Button | Icon | Action | Existing? |
|--------|------|--------|-----------|
| Σάρωση | `ScanLine` | Open scan dialog (PDF → AI extract) | ✅ already in current `RfqDetailClient` |
| Νέα Προσφορά | `Plus` | Manual new quote dialog | ✅ already in current `RfqDetailClient` |

### 5.A.2 Tab «Σύγκριση»

| Button | Icon | Action | Existing? |
|--------|------|--------|-----------|
| Εξαγωγή σε Excel | `Download` | Export comparison table as `.xlsx` | ⚠️ **Phase 2** — does not exist yet |

If the export feature is not yet built, this tab shows **no action buttons** initially. The export will be added in a follow-up ADR.

### 5.A.3 Tab «Ρύθμιση RFQ»

| Button | Icon | Action | Existing? |
|--------|------|--------|-----------|
| Νέα Πρόσκληση | `UserPlus` | Open invite vendor dialog | ⚠️ Currently lives **inside** `VendorInviteSection` (internal button) |
| Προσθήκη Γραμμής | `Plus` | Open add-line dialog | ⚠️ Currently lives **inside** `RfqLinesPanel` (internal button) |

**Decision:** Promote both buttons to the `PageHeader` action bar **only if** removing them from the panel internals does not break inline UX. If they are tightly coupled with their parent panel state, keep them inline and leave Tab «Ρύθμιση» without header actions. To be confirmed during Phase A implementation by reading the current panel components.

### 5.A.4 Implementation pattern

```ts
const customActions = useMemo(() => {
  switch (activeTab) {
    case 'quotes':
      return [scanButton, newQuoteButton];
    case 'comparison':
      return []; // Phase 2: [exportExcelButton]
    case 'setup':
      return setupActionsAvailable ? [newInviteButton, addLineButton] : [];
  }
}, [activeTab, /* ...handlers */]);
```

---

## 5.B Tab Badges (attention-driven)

Tabs show numeric badges **only when something needs the user's attention**. No badge in the steady state — keeps the chrome quiet and makes signals meaningful.

### 5.B.1 Badge rules

| Tab | Badge condition | Color | Badge value |
|-----|-----------------|-------|-------------|
| **Προσφορές** | `quotes.filter(q => q.status === 'under_review').length > 0` | 🔴 red | count of `under_review` quotes |
| **Σύγκριση** | `comparison?.recommendation && !quotes.some(q => q.status === 'accepted')` | 🟡 yellow | dot only (no number) |
| **Ρύθμιση RFQ** | Any invite is `expired` OR `status === 'pending'` past `rfq.deadline` | 🟡 yellow | count of attention-requiring invites |

### 5.B.2 Semantic meaning

- 🔴 **Red — action required**: User decision is blocking workflow (quotes awaiting review).
- 🟡 **Yellow — recommended action**: Workflow can proceed, but optimal action is pending (system has a recommendation; some invites need resend or follow-up).
- *(no badge)*: Steady state — nothing to do.

### 5.B.3 Visual pattern

Use existing `TabsTrigger` + a small badge slot:

```tsx
<TabsTrigger value="quotes">
  Προσφορές
  {underReviewCount > 0 && (
    <Badge variant="destructive" className="ml-2">{underReviewCount}</Badge>
  )}
</TabsTrigger>
<TabsTrigger value="comparison">
  Σύγκριση
  {recommendationPending && (
    <span className="ml-2 inline-block size-2 rounded-full bg-yellow-500" />
  )}
</TabsTrigger>
<TabsTrigger value="setup">
  Ρύθμιση RFQ
  {setupAttentionCount > 0 && (
    <Badge variant="warning" className="ml-2">{setupAttentionCount}</Badge>
  )}
</TabsTrigger>
```

### 5.B.4 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.tabs.badges.underReview` (aria-label) | προσφορές υπό εξέταση | quotes under review |
| `rfqs.tabs.badges.recommendation` (aria-label) | εκκρεμεί επιλογή νικητή | winner selection pending |
| `rfqs.tabs.badges.setupAttention` (aria-label) | προσκλήσεις που χρειάζονται προσοχή | invites needing attention |

These provide accessible labels for screen readers (the visual badges have no text).

---

## 5.C Empty State — Tab «Προσφορές» (no quotes received yet)

When the user opens Tab «Προσφορές» but `quotes.length === 0`, show an informative empty state that combines **invite status** with **manual entry actions**. The empty state replaces the entire split layout (no list, no detail pane).

### 5.C.1 Layout

```
┌────────────────────────────────────────────────────────────┐
│                          📭                                │
│              Καμία προσφορά ακόμα                          │
│                                                            │
│  ┌─ Πρόσφατες προσκλήσεις ──────────────────────────────┐  │
│  │ • Προμηθευτής Α — στάλθηκε πριν 2 ημέρες  ✓ ανοίχτηκε │  │
│  │ • Προμηθευτής Β — στάλθηκε πριν 5 ημέρες  ✗ δεν άνοιξε│  │
│  │ • Προμηθευτής Γ — στάλθηκε πριν 1 ημέρα   ⏳ pending  │  │
│  │                              [Στείλε υπενθύμιση]      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                            │
│   [+ Νέα Προσφορά]   [📷 Σάρωση PDF]   [👥 Δες προσκλήσεις] │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 5.C.2 Content rules

**Header:**
- Icon: `Inbox` (lucide-react), large (size 48–64), muted color
- Title: `t('rfqs.empty.quotes.title')` → «Καμία προσφορά ακόμα» / «No quotes yet»
- Subtitle: `t('rfqs.empty.quotes.subtitle')` → «Στείλε προσκλήσεις ή καταχώρησε χειροκίνητα» / «Send invites or enter manually»

**Pending invites card (only if `invites.length > 0`):**
- Title: `t('rfqs.empty.quotes.pendingInvitesTitle')` → «Πρόσφατες προσκλήσεις»
- Show **up to 5** most recent invites, sorted by `sentAt DESC`
- Each row: vendor name + relative time («πριν Χ ημέρες/ώρες») + status indicator
- Status indicators:
  - ✓ green — `openedAt` exists → «ανοίχτηκε»
  - ✗ red — `sentAt` exists, no `openedAt`, > 3 days old → «δεν άνοιξε»
  - ⏳ yellow — `sentAt` exists, no `openedAt`, ≤ 3 days → «εκκρεμεί»
  - ⚠️ orange — `status === 'expired'` → «έληξε»
- Per-row action: small «Στείλε υπενθύμιση» link (only for non-opened, non-expired)
- If `invites.length === 0`: hide this card entirely (only show actions row)

**Action buttons row** (always visible):
- `[+ Νέα Προσφορά]` — primary, opens manual quote dialog (same handler as `PageHeader.newQuoteButton`)
- `[📷 Σάρωση PDF]` — secondary, opens scan dialog (same handler as `PageHeader.scanButton`)
- `[👥 Δες προσκλήσεις]` — ghost/link, switches to Tab «Ρύθμιση RFQ»

### 5.C.3 Component

New component: `src/subapps/procurement/components/QuotesEmptyState.tsx` (~80–100 lines)

Props:
```ts
interface QuotesEmptyStateProps {
  invites: VendorInvite[];
  onNewQuote: () => void;
  onScan: () => void;
  onViewInvites: () => void; // calls setActiveTab('setup')
  onResendInvite: (inviteId: string) => Promise<void>;
}
```

Reuses existing relative-time helper (`@/lib/time/relative` or equivalent) — does NOT introduce new date utilities.

### 5.C.4 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.empty.quotes.title` | Καμία προσφορά ακόμα | No quotes yet |
| `rfqs.empty.quotes.subtitle` | Στείλε προσκλήσεις ή καταχώρησε χειροκίνητα | Send invites or enter manually |
| `rfqs.empty.quotes.pendingInvitesTitle` | Πρόσφατες προσκλήσεις | Recent invites |
| `rfqs.empty.quotes.opened` | ανοίχτηκε | opened |
| `rfqs.empty.quotes.notOpened` | δεν άνοιξε | not opened |
| `rfqs.empty.quotes.pending` | εκκρεμεί | pending |
| `rfqs.empty.quotes.expired` | έληξε | expired |
| `rfqs.empty.quotes.resendReminder` | Στείλε υπενθύμιση | Send reminder |
| `rfqs.empty.quotes.viewInvitesAction` | Δες προσκλήσεις | View invites |
| `rfqs.empty.quotes.newQuoteAction` | Νέα Προσφορά | New Quote |
| `rfqs.empty.quotes.scanAction` | Σάρωση PDF | Scan PDF |

---

## 5.D Comparison Row Click → Drill into Quote (Google drill-down pattern)

In Tab «Σύγκριση», each row in `ComparisonPanel` represents one quote. Clicking the row navigates the user to Tab «Προσφορές» with that quote pre-selected. This reuses the existing detail view instead of building a parallel preview/popup/accordion UI.

### 5.D.1 Behavior

```
User clicks row of «Προμηθευτής Β» in comparison table
  → setActiveTab('quotes')
  → setSelectedQuote(quoteOfVendorB)
  → URL becomes ?tab=quotes&quote=q_xyz789
  → Browser back returns to ?tab=comparison (preserved via router.push from §3.4)
```

### 5.D.2 Required improvements to `ComparisonPanel`

**1. Visual affordance — make clickability obvious:**

| Property | Value |
|----------|-------|
| `cursor` | `pointer` on `<tr>` |
| Hover background | `hover:bg-muted/50` (subtle) |
| Right-edge indicator | `<ChevronRight className="size-4 opacity-0 group-hover:opacity-100" />` (appears on hover) |
| `aria-label` | `t('rfqs.comparison.rowAriaLabel')` → «Δες λεπτομέρειες προσφοράς» / «View quote details» |
| Keyboard | `tabIndex={0}` + `onKeyDown` for Enter/Space |

**2. Full row click area:**

The entire `<tr>` is interactive — not just the vendor name cell:

```tsx
<tr
  className="group cursor-pointer hover:bg-muted/50"
  onClick={() => onRowClick(quote)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick(quote);
    }
  }}
  tabIndex={0}
  aria-label={t('rfqs.comparison.rowAriaLabel')}
>
  {/* cells */}
</tr>
```

**3. Stop propagation on inner interactive elements:**

Buttons, checkboxes, links, and any other interactive controls **inside** a row MUST call `e.stopPropagation()` to prevent triggering the row navigation when the user clicks them:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    handleAward(quote);
  }}
>
  {t('rfqs.comparison.awardButton')}
</button>
```

Affected controls in `ComparisonPanel`: award button, any future "View original PDF" link, expand/collapse toggles for breakdown rows, score-flag tooltips with click action.

### 5.D.3 Wiring

`ComparisonPanel` exposes a new optional callback prop:

```ts
interface ComparisonPanelProps {
  // ... existing props
  onRowClick?: (quote: Quote) => void;
}
```

In `RfqDetailClient.tsx`:

```tsx
<ComparisonPanel
  comparison={comparison}
  onRowClick={(quote) => {
    setSelectedQuote(quote);   // updates URL via §3.4 handlers
    setActiveTab('quotes');     // push (creates back-history entry)
  }}
/>
```

Both state setters in §3.4 push to the URL appropriately (`push` for tab, `replace` for quote selection within the same tab — but here the tab is changing, so a single `push` covers both via combined params).

**Combined push pattern** (single navigation entry):

```ts
const handleComparisonRowClick = useCallback((quote: Quote) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', 'quotes');
  params.set('quote', quote.id);
  router.push(`${pathname}?${params.toString()}`);
}, [router, pathname, searchParams]);
```

### 5.D.4 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.comparison.rowAriaLabel` | Δες λεπτομέρειες προσφοράς | View quote details |

---

## 5.E Mobile Responsive Behavior (Material 3 list-detail pattern)

The page uses **the same component code** across all breakpoints — only the CSS layout changes. No separate mobile route, no parallel mobile component tree.

### 5.E.1 Breakpoint behavior

| Breakpoint | Tab «Προσφορές» layout |
|------------|------------------------|
| `< 768px` (mobile, default) | **Navigated** — list **OR** detail, never both |
| `≥ 768px` (`md:` and up) | **Two-pane** — list AND detail side by side |

### 5.E.2 Tab «Προσφορές» — responsive layout

```tsx
<div className="md:grid md:grid-cols-[380px_1fr] md:gap-4">
  {/* List */}
  <div className={cn(
    "md:block",
    selectedQuote ? "hidden md:block" : "block"
  )}>
    <QuoteList ... />
  </div>

  {/* Detail */}
  <aside className={cn(
    "md:block",
    selectedQuote ? "block" : "hidden md:block"
  )}>
    {selectedQuote && (
      <>
        {/* Mobile-only back button */}
        <button
          type="button"
          className="md:hidden mb-2 flex items-center gap-2 text-sm font-medium"
          onClick={() => handleSelectQuote(null)}
          aria-label={t('rfqs.mobile.backToList')}
        >
          <ArrowLeft className="size-4" />
          {t('rfqs.mobile.backToList')}
        </button>
        <QuoteDetailsHeader quote={selectedQuote} />
        <QuoteDetailSummary quote={selectedQuote} />
      </>
    )}
    {!selectedQuote && (
      // Empty state shown on desktop only (mobile shows the list instead)
      <div className="hidden md:flex items-center justify-center text-muted-foreground">
        {t('rfqs.selectQuoteHint')}
      </div>
    )}
  </aside>
</div>
```

### 5.E.3 Other tabs

- **Tab «Σύγκριση»**: already full-width — no mobile changes. The comparison table may need horizontal scroll on small screens (existing `<table>` overflow pattern). Out of scope for this ADR; addressed in a follow-up if needed.
- **Tab «Ρύθμιση RFQ»**: already full-width stacked sections — works on mobile as-is.

### 5.E.4 Amendment to §3.4 — mobile-aware navigation method

On mobile, quote selection MUST use `router.push` (not `replace`) so the device's native back gesture/button returns from detail to list. This is **the** critical UX guarantee on mobile.

```ts
const isMobile = useMediaQuery('(max-width: 767px)');

const handleSelectQuote = useCallback((quote: Quote | null) => {
  const params = new URLSearchParams(searchParams.toString());
  if (quote) params.set('quote', quote.id);
  else params.delete('quote');

  const navMethod = isMobile ? router.push : router.replace;
  navMethod(`${pathname}?${params.toString()}`);
}, [router, pathname, searchParams, isMobile]);
```

This **supersedes** the unconditional `router.replace` rule for quote selection in §3.4. Tab changes still always use `push` on every breakpoint.

| User action | Desktop method | Mobile method | Why |
|-------------|----------------|---------------|-----|
| Tab change | `push` | `push` | Each tab is a navigable view |
| Quote selection | `replace` | `push` | Mobile needs back-gesture support; desktop avoids history clutter |
| Self-correction (deleted quote, invalid tab) | `replace` | `replace` | Silent normalization, never adds history |

### 5.E.5 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.mobile.backToList` | Πίσω στη λίστα | Back to list |

### 5.E.6 useMediaQuery utility

If a `useMediaQuery` hook does not already exist in the codebase, **search first** before creating one (CLAUDE.md SSOT rule). Likely candidates to grep: `useMediaQuery`, `useBreakpoint`, `useIsMobile`. If none, create at `src/hooks/useMediaQuery.ts` (~15 lines, SSR-safe with `typeof window` guard).

---

## 5.F Winner Award Flow (Google «Optimistic + Undo» pattern)

The «Επιλογή Νικητή» action follows Material Design 3 guidance: **no confirmation dialog** for reversible actions; instead, **optimistic update + Undo snackbar**. Confirmation dialogs reserved for irreversible operations only.

### 5.F.1 Reversibility classification

| State | Award reversible? | UI behavior |
|-------|-------------------|-------------|
| No PO created yet | ✅ Yes — just a Firestore flag flip | Award/re-award freely with optimistic + undo |
| PO created for the awarded quote | ❌ No — downstream commitment exists | Disable «Επιλογή Νικητή» on non-winning rows + tooltip explaining |

### 5.F.2 Action flow

```
User clicks [Επιλογή Νικητή] on row of Vendor B
  │
  ├─ 1. Optimistic UI update (synchronous, immediate)
  │   • Vendor B row → green background + 🏆 badge
  │   • Other rows → award button disabled (greyed)
  │   • Comparison header banner appears: «✅ Νικητής: Vendor B — 13.200€ — 15 ημ.»
  │   • Stat card «Καλύτερη Τιμή» → «Νικητής: Vendor B»
  │   • Tab «Σύγκριση» yellow badge clears (recommendation acted upon)
  │
  ├─ 2. Snackbar/toast (bottom-left, 8 seconds)
  │   «Νικητής: Vendor B. [ΑΝΑΙΡΕΣΗ]»
  │
  ├─ 3. Server call → updateQuoteStatus(quoteId, 'accepted') + sibling quotes → 'rejected'
  │
  └─ 4a. Success → keep optimistic state, snackbar continues its 8s window
      4b. Failure → rollback optimistic state, error toast
          «Δεν αποθηκεύτηκε. Δοκίμασε ξανά.» [retry button]
```

### 5.F.3 Undo behavior

If user clicks ΑΝΑΙΡΕΣΗ within 8s:
- Send compensating call: revert all affected quotes to their prior status
- Optimistic UI: row colors and banners revert
- Snackbar: «Επαναφορά» (1.5s, no undo button on undo)

### 5.F.4 Re-award (changing winner before PO)

Identical flow to first award. The previous winner's quote returns to its prior status (`under_review` or `submitted`), the new winner becomes `accepted`. The header banner updates in place.

### 5.F.5 Post-PO state (irreversible region)

Once a PO is created for the awarded quote (downstream signal: `rfq.status === 'awarded'` AND `purchaseOrderId` exists on the awarded quote):

- The award button on **all non-winning rows** is `disabled`
- Tooltip on hover: `t('rfqs.award.lockedByPo')` → «Έχει δημιουργηθεί παραγγελία. Ακύρωσε το PO για να αλλάξεις νικητή.» / «A purchase order exists. Cancel the PO to change the winner.»
- The winning row keeps its 🏆 badge but its award button becomes a non-interactive «🔒 Νικητής» indicator

### 5.F.6 Non-modal CTA — next step toward PO

The comparison header banner (when a winner exists) includes a **non-modal** CTA link/button:

```
✅ Νικητής: Vendor B — 13.200€    [Δημιουργία Παραγγελίας →]
```

This is a link/secondary button, **not** a dialog. The user clicks it on their own timing — never auto-opens.

If a PO is already created → CTA changes to «[Δες Παραγγελία →]» linking to the PO detail page.

### 5.F.7 Implementation notes

- Optimistic state: managed in `useComparison` hook (or wherever the quotes/comparison state lives) via local state mutation before awaiting the server response
- Rollback: keep a snapshot of the prior state before mutation; on server error, restore from snapshot
- Snackbar/toast: use the existing toast system (search first — likely `sonner` or `radix-ui/toast`); do **not** introduce a new one
- The `onAward` handler exists — wire optimistic + undo around it without rewriting the underlying service call

### 5.F.8 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.award.successToast` | Νικητής: {{vendor}} | Winner: {{vendor}} |
| `rfqs.award.undoButton` | ΑΝΑΙΡΕΣΗ | UNDO |
| `rfqs.award.errorToast` | Δεν αποθηκεύτηκε. Δοκίμασε ξανά. | Could not save. Try again. |
| `rfqs.award.errorRetry` | Επανάληψη | Retry |
| `rfqs.award.undoneToast` | Επαναφορά | Reverted |
| `rfqs.award.headerBanner` | Νικητής: {{vendor}} — {{total}} — {{deliveryDays}} ημ. | Winner: {{vendor}} — {{total}} — {{deliveryDays}} days |
| `rfqs.award.createPoCta` | Δημιουργία Παραγγελίας | Create Purchase Order |
| `rfqs.award.viewPoCta` | Δες Παραγγελία | View Purchase Order |
| `rfqs.award.lockedByPo` | Έχει δημιουργηθεί παραγγελία. Ακύρωσε το PO για να αλλάξεις νικητή. | A purchase order exists. Cancel the PO to change the winner. |
| `rfqs.award.lockedBadge` | 🔒 Νικητής | 🔒 Winner |

---

## 5.G Setup Tab Lock State (Google «Match lock to dependency» pattern)

The «Ρύθμιση RFQ» tab applies **granular locking** based on what the awarded quote actually depends on. Not all-or-nothing — each control is locked only if its data is depended upon.

### 5.G.1 Lock matrix

| Control | No award yet | Award exists, no PO | PO created |
|---------|--------------|---------------------|------------|
| **Edit RFQ line** (qty, spec, name) | ✅ Enabled | 🔒 Locked | 🔒 Locked |
| **Add RFQ line** | ✅ Enabled | 🔒 Locked | 🔒 Locked |
| **Delete RFQ line** | ✅ Enabled | 🔒 Locked | 🔒 Locked |
| **View RFQ lines** | ✅ Always | ✅ Always | ✅ Always |
| **Add new invite** | ✅ Enabled | 🔒 Locked | 🔒 Locked |
| **Send reminder to pending invite** | ✅ Enabled | 🔒 Locked | 🔒 Locked |
| **Cancel pending invite** (housekeeping) | ✅ Enabled | ✅ Enabled | 🔒 Locked |
| **Resend revoked invite** | ✅ Enabled | 🔒 Locked | 🔒 Locked |
| **View invites** | ✅ Always | ✅ Always | ✅ Always |

**Rationale:**
- RFQ lines define what was quoted → editing breaks the quote's reference data → lock fully after award
- Adding/reminding invites post-award has no semantic purpose (winner already chosen) → lock
- Cancelling a pending invite is housekeeping (remove dead invitations) — does not affect awarded quote → keep enabled until PO
- After PO: everything is downstream-committed → full read-only

### 5.G.2 Banner — explains lock + provides exit path

When the Setup tab is locked, a prominent banner sits at the top of the tab content. The banner is the **single source** for the unlock action — disabled buttons just show short tooltips pointing at the banner.

**Award-locked state (no PO):**

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔒 Οι ρυθμίσεις έχουν κλειδωθεί από την επιλογή νικητή (Vendor B)│
│                                       [Αναίρεση Νικητή]           │
└──────────────────────────────────────────────────────────────────┘
```

The «Αναίρεση Νικητή» button triggers the same Undo flow as §5.F.3 (revert all affected quotes to prior status), then the banner disappears and controls re-enable.

**PO-locked state:**

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔒 Έχει δημιουργηθεί παραγγελία (PO-12345) — ρύθμιση κλειδωμένη  │
│                       [Δες Παραγγελία →]   [Ακύρωση Παραγγελίας] │
└──────────────────────────────────────────────────────────────────┘
```

«Ακύρωση Παραγγελίας» is destructive and out of this ADR's scope — it follows whatever PO cancellation flow exists. After cancellation, state returns to award-locked (Σενάριο 1).

### 5.G.3 Disabled control behavior

Each disabled button:
- `disabled={true}` (visually greyed)
- `aria-disabled="true"`
- Tooltip on hover: short reason + pointer to banner

| Control disabled | Tooltip key |
|------------------|-------------|
| Add line / Edit line / Delete line | `rfqs.setup.lockedTooltip.lines` → «Κλειδωμένο από την επιλογή νικητή» |
| Add invite / Resend invite | `rfqs.setup.lockedTooltip.inviteAction` → «Έχει ήδη επιλεγεί νικητής» |
| Send reminder | `rfqs.setup.lockedTooltip.reminder` → «Έχει ήδη επιλεγεί νικητής» |
| Any control (PO state) | `rfqs.setup.lockedTooltip.po` → «Κλειδωμένο από δημιουργημένη παραγγελία» |

### 5.G.4 Consistency with §5.A (PageHeader actions)

The action buttons promoted to `PageHeader` for the Setup tab (`Νέα Πρόσκληση`, `Προσθήκη Γραμμής`) follow the **same lock matrix**. They are `disabled` with the same tooltips when the underlying action is locked.

```ts
const setupActionsLocked = Boolean(rfq?.purchaseOrderId) ||
  quotes.some(q => q.status === 'accepted');

const newInviteButton = {
  label: t('rfqs.actions.newInvite'),
  icon: UserPlus,
  onClick: handleNewInvite,
  disabled: setupActionsLocked,
  tooltip: setupActionsLocked
    ? t('rfqs.setup.lockedTooltip.inviteAction')
    : undefined,
};
```

### 5.G.5 Lock state derivation

Single source-of-truth helper, used by both Setup tab content and PageHeader:

```ts
type SetupLockState = 'unlocked' | 'awardLocked' | 'poLocked';

function deriveSetupLockState(rfq: RFQ, quotes: Quote[]): SetupLockState {
  if (rfq.purchaseOrderId) return 'poLocked';
  if (quotes.some(q => q.status === 'accepted')) return 'awardLocked';
  return 'unlocked';
}
```

Place in `src/subapps/procurement/utils/rfq-lock-state.ts` (~20 lines).

### 5.G.6 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.setup.banner.awardLocked` | Οι ρυθμίσεις έχουν κλειδωθεί από την επιλογή νικητή ({{vendor}}) | Settings locked by winner selection ({{vendor}}) |
| `rfqs.setup.banner.poLocked` | Έχει δημιουργηθεί παραγγελία ({{poNumber}}) — ρύθμιση κλειδωμένη | A purchase order has been created ({{poNumber}}) — settings locked |
| `rfqs.setup.banner.revertAward` | Αναίρεση Νικητή | Revert Winner |
| `rfqs.setup.banner.viewPo` | Δες Παραγγελία | View Purchase Order |
| `rfqs.setup.banner.cancelPo` | Ακύρωση Παραγγελίας | Cancel Purchase Order |
| `rfqs.setup.lockedTooltip.lines` | Κλειδωμένο από την επιλογή νικητή | Locked by winner selection |
| `rfqs.setup.lockedTooltip.inviteAction` | Έχει ήδη επιλεγεί νικητής | Winner already selected |
| `rfqs.setup.lockedTooltip.reminder` | Έχει ήδη επιλεγεί νικητής | Winner already selected |
| `rfqs.setup.lockedTooltip.po` | Κλειδωμένο από δημιουργημένη παραγγελία | Locked by existing purchase order |

---

## 5.H Async Scan UX (Google «Never block, show twice» pattern)

PDF scanning with AI extraction takes 5–15s. The UX MUST never block the user and MUST surface progress in **two** places: in-place (list placeholder) and peripheral (grouped toast). Modal blockers are forbidden.

### 5.H.1 In-list placeholder

When a scan starts, an optimistic placeholder is inserted at the top of `QuoteList`:

```
┌─────────────────────────────────────────┐
│ 🔄 quote-vendor-x.pdf                   │
│    Ανάλυση εγγράφου... (στάδιο 2 από 3) │
└─────────────────────────────────────────┘
```

Stage labels (driven by progress events from the AI pipeline):

| Stage | Label key | el | en |
|-------|-----------|----|----|
| 1 | `rfqs.scan.stage.reading` | Ανάγνωση PDF... | Reading PDF... |
| 2 | `rfqs.scan.stage.extracting` | Εξαγωγή στοιχείων με AI... | Extracting data with AI... |
| 3 | `rfqs.scan.stage.validating` | Επικύρωση δεδομένων... | Validating data... |

If the underlying scan service does not emit stage events, fall back to a single label `rfqs.scan.stage.processing` («Επεξεργασία...» / «Processing...») without the «(στάδιο X από Y)» suffix.

### 5.H.2 Grouped persistent toast

Single toast that aggregates **all** in-flight scans:

```
┌────────────────────────────────────────┐
│ 🔄 Επεξεργασία 3 αρχείων (1/3 έτοιμο) │
│                                    [×] │
└────────────────────────────────────────┘
```

- Toast persists across tab/page navigation within the same session
- Counter updates live as scans complete
- Closing (`[×]`) hides the toast but does NOT cancel the scans (they finish in the background; placeholders in list still resolve normally)

### 5.H.3 Success path

When a scan completes:

1. List: placeholder is replaced by the real `Quote` row (smooth transition, no layout jump)
2. Toast: counter increments. If this was the last in-flight scan, toast morphs into success state:
   ```
   ✅ Νέα προσφορά: Vendor X — 12.500€   [Δες]
   ```
3. Auto-dismiss after 8s (extends to 15s if multiple scans completed in the same window — final toast lists all)
4. Clicking `[Δες]` → switches to Tab «Προσφορές» (push) and selects the new quote (`?tab=quotes&quote=<newId>`)

If multiple scans complete simultaneously, the final toast shows the most recent one with «+N more» suffix.

### 5.H.4 Failure path

If a scan fails:

1. Placeholder turns red (red border + ❌ icon):
   ```
   ❌ quote-vendor-x.pdf
      Αποτυχία επεξεργασίας
      [Δοκίμασε ξανά]   [Διαγραφή]
   ```
2. Error toast (separate from the success toast):
   ```
   ⚠️ Δεν ολοκληρώθηκε η ανάλυση του "quote-vendor-x.pdf"
   ```
3. The uploaded PDF is **kept** in Firebase Storage until the user resolves it (retry or delete) — never silently discarded.
4. Retry: re-runs the AI pipeline on the existing storage object (no re-upload). Same UX flow as a fresh scan.
5. Delete: removes the storage object + clears the placeholder. No toast.

### 5.H.5 State scope — client-only placeholders

The placeholder/toast state lives in **client-side React state only**, not in Firestore. This means:

- Browser refresh (F5) clears placeholders from the list and clears the toast
- The actual scan continues server-side (the AI pipeline call is already in flight)
- When the scan completes server-side, the new quote is written to Firestore and shows up in the list naturally on next data refresh
- If the user wants persistence across refreshes (so they can close the laptop and come back), that requires a `pending_scans` Firestore collection — **out of scope** for this ADR; potential Phase 2

This trade-off is acceptable: scans are short (5–15s), users typically wait. The added complexity of Firestore-persisted in-flight state is not justified by the rare refresh-during-scan case.

### 5.H.6 Parallel scans

The user can trigger multiple scans before the first completes (drag-and-drop multiple PDFs, or pressing «Σάρωση» twice). Each gets its own placeholder. The grouped toast aggregates them. There is no upper limit imposed by this UX (the AI pipeline / rate limits handle backend constraints).

### 5.H.7 State container

A new client hook to manage scan UI state, distinct from the underlying scan service:

```ts
// src/subapps/procurement/hooks/useScanQueue.ts
interface ScanQueueItem {
  clientId: string;            // generated locally
  fileName: string;
  stage: 1 | 2 | 3 | null;
  status: 'pending' | 'success' | 'error';
  resultQuoteId?: string;      // populated on success
  errorMessage?: string;
  storagePath?: string;        // for retry/delete on failure
}

interface UseScanQueueResult {
  items: ScanQueueItem[];
  enqueue: (file: File) => Promise<void>;
  retry: (clientId: string) => Promise<void>;
  remove: (clientId: string) => Promise<void>;
  inFlightCount: number;
}
```

Place at `src/subapps/procurement/hooks/useScanQueue.ts` (~60–80 lines). Do **not** rebuild the underlying scan service — wrap the existing one.

### 5.H.8 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.scan.stage.reading` | Ανάγνωση PDF... | Reading PDF... |
| `rfqs.scan.stage.extracting` | Εξαγωγή στοιχείων με AI... | Extracting data with AI... |
| `rfqs.scan.stage.validating` | Επικύρωση δεδομένων... | Validating data... |
| `rfqs.scan.stage.processing` | Επεξεργασία... | Processing... |
| `rfqs.scan.stageSuffix` | (στάδιο {{current}} από {{total}}) | (stage {{current}} of {{total}}) |
| `rfqs.scan.toast.processingSingle` | Επεξεργασία αρχείου... | Processing file... |
| `rfqs.scan.toast.processingMultiple` | Επεξεργασία {{count}} αρχείων ({{done}}/{{count}} έτοιμο) | Processing {{count}} files ({{done}}/{{count}} done) |
| `rfqs.scan.toast.success` | Νέα προσφορά: {{vendor}} — {{total}} | New quote: {{vendor}} — {{total}} |
| `rfqs.scan.toast.successWithMore` | Νέα προσφορά: {{vendor}} — {{total}} (+{{moreCount}} ακόμα) | New quote: {{vendor}} — {{total}} (+{{moreCount}} more) |
| `rfqs.scan.toast.viewAction` | Δες | View |
| `rfqs.scan.placeholder.failed` | Αποτυχία επεξεργασίας | Processing failed |
| `rfqs.scan.placeholder.retry` | Δοκίμασε ξανά | Retry |
| `rfqs.scan.placeholder.delete` | Διαγραφή | Delete |
| `rfqs.scan.toast.error` | Δεν ολοκληρώθηκε η ανάλυση του "{{fileName}}" | Could not finish analyzing "{{fileName}}" |

---

## 5.I Quote Header Actions (Google «Hierarchy by frequency, status-aware»)

The right pane in Tab «Προσφορές» renders `QuoteDetailsHeader` (ADR-267 SSoT) above `QuoteDetailSummary`. The header exposes actions on the selected quote following Material Design 3 hierarchy: **1–2 primary text buttons + 3 secondary icon buttons + overflow menu**.

### 5.I.1 Visual layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Q-2026-0042   [under_review]                                         │
│                                                                      │
│ [Έγκριση Νικητή]  [Απόρριψη]      📥  💬3  🕒        ⋯              │
│  primary 1         primary 2      Download Comments History  Overflow│
└──────────────────────────────────────────────────────────────────────┘
```

### 5.I.2 Primary actions — status-driven, max 2

| Status | Primary 1 | Primary 2 |
|--------|-----------|-----------|
| `submitted` | Επιβεβαίωση (→ `under_review`) | Απόρριψη |
| `under_review` | Έγκριση Νικητή (→ award flow §5.F) | Απόρριψη |
| `accepted`, no PO | Δημιουργία Παραγγελίας | — |
| `accepted`, with PO | Δες Παραγγελία | — |
| `rejected` | Επαναφορά (→ `submitted`) | — |
| `draft` | Επεξεργασία | — (or move Edit to primary only here) |

**Hide rule:** never show an action irrelevant to the current status. E.g. an `accepted` quote never shows «Έγκριση» — it's hidden, not disabled.

### 5.I.3 Secondary actions — icon-only, always visible

Three icons grouped on the right side, each with tooltip on hover:

| Icon | Action | Tooltip key | Disabled when |
|------|--------|-------------|---------------|
| `Download` | Λήψη αρχικού PDF | `rfqs.quoteHeader.tooltip.download` | No source PDF on the quote |
| `MessageSquare` | Σχολιασμός (opens comments side panel) | `rfqs.quoteHeader.tooltip.comments` | — |
| `History` | Ιστορικό αλλαγών (opens history side panel) | `rfqs.quoteHeader.tooltip.history` | — |

The `MessageSquare` icon shows a small numeric badge if `commentCount > 0`. Comments and history side panels are out of scope for this ADR — wire the buttons to placeholder handlers; flesh out in follow-up ADR if not already implemented.

### 5.I.4 Overflow menu (⋯)

Rare and destructive actions live behind the overflow trigger. Order:

1. **Επεξεργασία** — opens edit dialog. Disabled when locked by award/PO with tooltip from §5.G.6.
2. **Αντιγραφή ως νέα** (Duplicate) — creates a new draft quote pre-filled with the current quote's lines. Useful when a vendor sends a revised quote and you want to preserve history.
3. **Διαγραφή** — destructive. Material 3 explicitly **allows** confirmation dialogs for irreversible destructive actions; show one here:
   > «Διαγραφή της προσφοράς Q-2026-0042; Η ενέργεια δεν αναιρείται.»
   > [Ακύρωση] [Διαγραφή]

### 5.I.5 Lock interactions with award/PO state (§5.G consistency)

When the parent RFQ has an awarded quote, **other** quotes in the list have their primary actions adjusted:

| Quote status | RFQ has winner ≠ this quote | Behavior |
|--------------|------------------------------|----------|
| `submitted` | Yes | Primary 1 «Επιβεβαίωση» **disabled** with tooltip «Έχει ήδη επιλεγεί νικητής» |
| `under_review` | Yes | Primary 1 «Έγκριση Νικητή» **disabled** with same tooltip — user must revert award first |
| `rejected` | Yes | «Επαναφορά» **disabled** — same tooltip |

When the awarded quote has a PO, **all** non-winning quotes' primary actions are disabled with the §5.G.6 PO-lock tooltip.

### 5.I.6 Compatibility with ADR-267 (QuoteDetailsHeader SSoT)

`QuoteDetailsHeader` already exists. **Do not fork.** During Phase A.0:

1. Read the current `QuoteDetailsHeader` implementation (path TBD via grep — likely `src/core/entity-headers/quote/`)
2. Inventory existing action slots (likely already supports `primaryActions`, `secondaryActions`, `overflowActions` or similar)
3. **If the API supports the §5.I.1 layout natively** → just pass the right props
4. **If the API is missing slots** (e.g. no `secondaryActions` array) → extend the SSoT API in a non-breaking way (additive props with sane defaults), not a fork
5. **Verify** the existing `/procurement/quotes` page still renders identically after any SSoT extension

### 5.I.7 Action handler wiring

The actions array is built in `RfqDetailClient.tsx` (or a co-located factory) and passed to `QuoteDetailsHeader`. Most handlers already exist (mutations from `useQuotes`, `useComparison`, etc.) — wire, don't rewrite:

```ts
const headerActions = useMemo(
  () => buildQuoteHeaderActions({
    quote: selectedQuote,
    rfq,
    quotes,
    onConfirm: handleConfirm,
    onApprove: handleAward, // §5.F flow
    onReject: handleReject,
    onCreatePo: handleCreatePo,
    onViewPo: handleViewPo,
    onRestore: handleRestore,
    onDownload: handleDownload,
    onOpenComments: handleOpenComments,
    onOpenHistory: handleOpenHistory,
    onEdit: handleEdit,
    onDuplicate: handleDuplicate,
    onDelete: handleDelete,
    t,
  }),
  [selectedQuote, rfq, quotes, /* handlers */]
);
```

Place factory at `src/subapps/procurement/utils/quote-header-actions.ts` (~80–120 lines). Pure function, no hooks inside.

### 5.I.8 Out of scope (potential Phase 2)

- Keyboard shortcuts (Gmail-style: `A` approve, `R` reject, `D` download, `E` edit, `?` help)
- Bulk actions (multi-select in `QuoteList` → bulk approve/reject)
- Comments / History side panels' internals (this ADR only adds entry-point buttons)

### 5.I.9 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.quoteHeader.action.confirm` | Επιβεβαίωση | Confirm |
| `rfqs.quoteHeader.action.approve` | Έγκριση Νικητή | Award Winner |
| `rfqs.quoteHeader.action.reject` | Απόρριψη | Reject |
| `rfqs.quoteHeader.action.createPo` | Δημιουργία Παραγγελίας | Create Purchase Order |
| `rfqs.quoteHeader.action.viewPo` | Δες Παραγγελία | View Purchase Order |
| `rfqs.quoteHeader.action.restore` | Επαναφορά | Restore |
| `rfqs.quoteHeader.action.edit` | Επεξεργασία | Edit |
| `rfqs.quoteHeader.action.duplicate` | Αντιγραφή ως νέα | Duplicate as new |
| `rfqs.quoteHeader.action.delete` | Διαγραφή | Delete |
| `rfqs.quoteHeader.tooltip.download` | Λήψη αρχικού PDF | Download original PDF |
| `rfqs.quoteHeader.tooltip.comments` | Σχολιασμός | Comments |
| `rfqs.quoteHeader.tooltip.history` | Ιστορικό αλλαγών | History |
| `rfqs.quoteHeader.tooltip.disabledByAward` | Έχει ήδη επιλεγεί νικητής | Winner already selected |
| `rfqs.quoteHeader.delete.confirmTitle` | Διαγραφή προσφοράς {{number}}; | Delete quote {{number}}? |
| `rfqs.quoteHeader.delete.confirmBody` | Η ενέργεια δεν αναιρείται. | This action cannot be undone. |
| `rfqs.quoteHeader.delete.confirmAction` | Διαγραφή | Delete |
| `rfqs.quoteHeader.delete.cancelAction` | Ακύρωση | Cancel |

---

## 5.J Concurrent Collaboration (Google «Real-time + optimistic locking» pattern)

When two users have the same RFQ open and act simultaneously, the page must (a) reflect remote changes live and (b) detect conflicts on critical writes with a friendly «review and retry» UX — not silent overwrite, not raw error.

### 5.J.1 Two-layer strategy

| Layer | Mechanism | Applies to |
|-------|-----------|------------|
| **Real-time view sync** | Firestore `onSnapshot` | All read paths (quotes, comparison, lines, invites) |
| **Optimistic locking** | Firestore `runTransaction` + version check | Critical writes only (see 5.J.3) |

### 5.J.2 Layer 1 — Real-time view sync via `onSnapshot`

All hooks driving page state subscribe to Firestore changes:

| Hook | Subscribes to | Why |
|------|---------------|-----|
| `useQuotes(rfqId)` | `quotes` collection filtered by `rfqId` | New quotes appear, status changes propagate |
| `useComparison(rfqId)` | `rfq_comparisons/{rfqId}` doc | Recommendation updates live |
| `useRfqLines(rfqId)` | `rfqs/{rfqId}` doc (for lines field) or `rfq_lines` subcollection | Line edits propagate |
| `useVendorInvites(rfqId)` | `vendor_invites` filtered by `rfqId` | Invite status (sent/opened/expired) propagates |
| `useSourcingEventAggregate(eventId)` | `sourcing_events/{eventId}` doc | Event metadata updates |

**Phase A.0 verification:** Before refactoring layout, grep each hook to confirm whether it already uses `onSnapshot`. If a hook uses one-shot `getDocs`/`getDoc`, convert to `onSnapshot` as part of Phase A. Conversion is local to each hook (~10–20 line change per hook), no consumer-facing API change.

### 5.J.3 Layer 2 — Optimistic locking on critical writes

Conflict-prone operations use Firestore transactions with version field checks:

| Operation | Conflict-prone? | Strategy |
|-----------|-----------------|----------|
| Award winner | ✅ Yes (financial commitment) | Transaction + version check |
| Create PO | ✅ Yes (irreversible after send) | Transaction + version check |
| Edit RFQ line | ✅ Yes (data integrity) | Transaction + version check |
| Confirm/reject quote | ⚠️ Yes (may collide with award) | Transaction + version check |
| Add invite | ❌ No (additive, no collision) | Last write wins — direct write |
| Cancel pending invite | ❌ No (idempotent target state) | Last write wins — direct write |
| Add comment | ❌ No (additive) | Last write wins — direct write |
| UI selection (quote/tab) | ❌ No (local only) | N/A — never written to Firestore |

**Schema additions** (each conflict-prone document gets):
```ts
version: number;          // increment on every write
updatedAt: Timestamp;     // serverTimestamp()
updatedBy: string;        // user ID
```

**Transaction pattern:**

```ts
async function awardWinner(rfqId: string, quoteId: string, expectedVersion: number) {
  return runTransaction(db, async (tx) => {
    const rfqRef = doc(db, 'rfqs', rfqId);
    const rfqSnap = await tx.get(rfqRef);
    const rfq = rfqSnap.data();

    if (!rfq) throw new NotFoundError('RFQ not found');

    if (rfq.version !== expectedVersion) {
      throw new ConflictError({
        type: 'AWARD_CONFLICT',
        actualWinner: rfq.awardedQuoteId ?? null,
        actualWinnerVendor: rfq.awardedVendorName ?? null,
        actor: rfq.updatedBy,
        actorTime: rfq.updatedAt,
        currentVersion: rfq.version,
      });
    }

    tx.update(rfqRef, {
      awardedQuoteId: quoteId,
      awardedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      version: rfq.version + 1,
    });
    // sibling quotes status update — same transaction
  });
}
```

The `expectedVersion` is captured by the client at the time the user **opened** the page (or last successfully wrote). Each successful write returns the new version, which the client retains for the next write.

### 5.J.4 Conflict UI — «Review and retry»

When a transaction throws `ConflictError`, the optimistic UI update from §5.F is rolled back, and a non-blocking dialog appears:

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠️ Σύγκρουση επιλογής νικητή                                     │
│                                                                  │
│ Η {{actor}} επέλεξε νικητή τον {{actualVendor}} πριν {{ago}}.    │
│                                                                  │
│ Πάτησες «Έγκριση» στον {{attemptedVendor}} — αλλά η κατάσταση    │
│ έχει ήδη αλλάξει.                                                │
│                                                                  │
│   [Δες την επιλογή της {{actor}}]   [Κράτα τη δικιά σου]         │
└──────────────────────────────────────────────────────────────────┘
```

| Button | Behavior |
|--------|----------|
| «Δες την επιλογή» | Closes dialog. UI is already showing the remote state (because `onSnapshot` synced it). User effectively accepts. |
| «Κράτα τη δικιά σου» | Re-runs the transaction with the **current** version. This will succeed (no longer stale). The previous winner gets overwritten. |

This dialog template generalizes for all critical writes — only the title and message strings change. Helper: `<ConflictDialog>` component.

### 5.J.5 Subtle live-change toasts

When `onSnapshot` delivers a remote change initiated by a **different user**, show a brief toast with a «Δες» action:

| Trigger | Toast |
|---------|-------|
| New quote arrives in this RFQ | «Νέα προσφορά: {{vendor}} — {{total}}   [Δες]» |
| Quote status → `under_review` | «Η {{actor}} επιβεβαίωσε προσφορά: {{vendor}}   [Δες]» |
| Quote status → `accepted` (winner award) | «Η {{actor}} επέλεξε νικητή: {{vendor}}   [Δες]» |
| Quote status → `rejected` | «Η {{actor}} απέρριψε προσφορά: {{vendor}}   [Δες]» |
| PO created | «Η {{actor}} δημιούργησε παραγγελία   [Δες]» |
| RFQ line edited | «Η {{actor}} τροποποίησε γραμμή RFQ   [Δες]» |

**Filtering rules:**
- Hide toast if `change.updatedBy === currentUserId` (don't notify yourself)
- Hide toast if change occurred more than 60s ago (initial snapshot — not a "live" event)
- Aggregate: if 3+ remote changes arrive within 5s, group as «Η {{actor}} έκανε {{count}} αλλαγές   [Δες]»
- 5s auto-dismiss, dismissible

«Δες» action: scrolls/navigates to the affected element (e.g. clicks the matching row in the comparison panel, opens the matching quote).

**Detection:** keep a snapshot of the previous Firestore state in a ref; on every snapshot delivery, diff against ref and compute change events.

### 5.J.6 Version retention on the client

The client retains `version` for each writeable document and passes it as `expectedVersion` on every transaction:

```ts
const [rfqVersion, setRfqVersion] = useState<number>(rfq.version);
useEffect(() => setRfqVersion(rfq.version), [rfq.version]); // updates as snapshots arrive

// On write:
await awardWinner(rfqId, quoteId, rfqVersion);
```

This is sufficient — the version moves forward as snapshots arrive, so a stale-write attempt only happens if the user acts faster than the snapshot arrives (usual race window: 100–500ms).

### 5.J.7 Out of scope (Phase 2 follow-up ADR)

- Presence avatars («👁 Μαρία and 2 others viewing»)
- Live cursors / typing indicators in shared text fields
- Real-time inline edits with operational transform (overkill for procurement workflows)
- Field-level locking (e.g. «Maria is editing this line — read-only for 30s»)

### 5.J.8 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.conflict.award.title` | Σύγκρουση επιλογής νικητή | Winner selection conflict |
| `rfqs.conflict.award.body` | Η {{actor}} επέλεξε νικητή τον {{actualVendor}} πριν {{ago}}. Πάτησες «Έγκριση» στον {{attemptedVendor}} — αλλά η κατάσταση έχει ήδη αλλάξει. | {{actor}} selected {{actualVendor}} as winner {{ago}}. You attempted to award {{attemptedVendor}} — the state has already changed. |
| `rfqs.conflict.action.acceptRemote` | Δες την επιλογή της {{actor}} | View {{actor}}'s selection |
| `rfqs.conflict.action.keepMine` | Κράτα τη δικιά σου | Keep mine |
| `rfqs.conflict.poCreate.title` | Σύγκρουση δημιουργίας παραγγελίας | Purchase order conflict |
| `rfqs.conflict.lineEdit.title` | Σύγκρουση επεξεργασίας γραμμής | Line edit conflict |
| `rfqs.conflict.statusChange.title` | Σύγκρουση αλλαγής κατάστασης | Status change conflict |
| `rfqs.live.newQuote` | Νέα προσφορά: {{vendor}} — {{total}} | New quote: {{vendor}} — {{total}} |
| `rfqs.live.quoteConfirmed` | Η {{actor}} επιβεβαίωσε προσφορά: {{vendor}} | {{actor}} confirmed quote: {{vendor}} |
| `rfqs.live.quoteAwarded` | Η {{actor}} επέλεξε νικητή: {{vendor}} | {{actor}} selected winner: {{vendor}} |
| `rfqs.live.quoteRejected` | Η {{actor}} απέρριψε προσφορά: {{vendor}} | {{actor}} rejected quote: {{vendor}} |
| `rfqs.live.poCreated` | Η {{actor}} δημιούργησε παραγγελία | {{actor}} created a purchase order |
| `rfqs.live.lineEdited` | Η {{actor}} τροποποίησε γραμμή RFQ | {{actor}} edited an RFQ line |
| `rfqs.live.aggregated` | Η {{actor}} έκανε {{count}} αλλαγές | {{actor}} made {{count}} changes |
| `rfqs.live.viewAction` | Δες | View |

---

## 5.K Browser Navigation & Unsaved Changes (Google «Never hijack browser back»)

The browser back/forward buttons MUST behave predictably according to the URL history defined in §3.4. They are **never** repurposed for application-level undo. Data-loss protection is layered on top via `beforeunload` and in-page discard dialogs — only when there is real unsaved input.

### 5.K.1 Default browser back behavior

The §3.4 push/replace rules already produce Google-compliant back-stack behavior:

| In-page action | Method | Adds history entry? |
|----------------|--------|---------------------|
| Tab change (Quotes ↔ Comparison ↔ Setup) | `push` | ✅ Yes |
| Quote selection in Tab Quotes (desktop) | `replace` | ❌ No — refines current view |
| Quote selection in Tab Quotes (mobile) | `push` | ✅ Yes — back gesture must restore list |
| Comparison row click → drill into Tab Quotes | `push` | ✅ Yes — distinct view (§5.D) |
| Self-correction (deleted quote, invalid tab) | `replace` | ❌ No |

Browser back therefore navigates through meaningful states only — never invents history entries for trivial UI refinements (no spam in the back stack).

**Forbidden:**
- ❌ Hijacking back to perform an application undo (e.g. revert award)
- ❌ Showing a confirmation dialog on every back press

### 5.K.2 `beforeunload` protection — only for unsaved forms

When a form contains user input that has not yet been committed, register a `beforeunload` listener so the browser shows its native warning on tab close / page refresh / cross-origin navigation:

```ts
useEffect(() => {
  if (!isDirty) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = ''; // browser displays its native, non-customizable warning
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [isDirty]);
```

The browser warning text is **not customizable** — that is a security feature of all modern browsers (prevents phishing). Trying to customize it does nothing.

Register on:
- Edit RFQ line dialog with modified fields
- Manual quote entry dialog with filled fields
- Comment composer with non-empty text

Do **not** register on:
- View-only screens
- Quote selection (no input — pure URL state)
- Tab switching

### 5.K.3 In-app close-modal protection

`beforeunload` only fires on real browser navigation events (tab close, refresh, cross-origin nav). It does **not** fire when the user closes a modal/dialog while staying on the page. For that, use an in-page confirmation:

```tsx
function handleCloseDialog() {
  if (!isDirty) return closeDialog();
  showConfirm({
    title: t('rfqs.unsaved.title'),         // «Έχετε μη αποθηκευμένες αλλαγές»
    body: t('rfqs.unsaved.body'),           // «Αν κλείσετε, οι αλλαγές θα χαθούν.»
    confirmLabel: t('rfqs.unsaved.discard'),// «Απόρριψη αλλαγών»
    cancelLabel: t('rfqs.unsaved.keep'),    // «Συνέχεια επεξεργασίας»
    onConfirm: closeDialog,
  });
}
```

This applies to ESC-to-close, click-outside-to-close, and explicit `[X]` button presses on dialogs.

### 5.K.4 In-page tab switch protection (only if needed)

Edit forms in this ADR live inside **modals/dialogs**, not inline within tab content. So switching tabs (`Tabs.onValueChange`) does not destroy form state — modals float above the tab content and persist across tab switches.

If a future change introduces an inline form on a tab, hook into `Tabs.onValueChange` to call the same dirty-check + confirmation pattern as §5.K.3 before allowing the tab change.

### 5.K.5 DirtyFormProvider — single source of truth

Track dirty state across multiple forms with a small context provider, used by:
- The `beforeunload` effect (any form dirty → register listener)
- The close-dialog handlers (each form reads its own slot)
- A future router-level guard if internal navigation guards become needed

```ts
// src/providers/DirtyFormProvider.tsx (~50 lines)
interface DirtyFormContextValue {
  registerDirty: (formId: string) => void;
  clearDirty: (formId: string) => void;
  isAnyDirty: boolean;
  isDirty: (formId: string) => boolean;
}
```

Search first for an existing equivalent (`useFormDirty`, `useUnsavedChanges`, `BeforeUnload*`) before creating — CLAUDE.md SSOT rule.

### 5.K.6 Auto-save (out of scope, future direction)

Google Docs eliminates most unsaved-state cases by auto-saving every keystroke. Adopting auto-save throughout procurement forms would remove most of §5.K.2–5.K.4 complexity. Out of scope for this ADR; potential follow-up.

### 5.K.7 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.unsaved.title` | Έχετε μη αποθηκευμένες αλλαγές | You have unsaved changes |
| `rfqs.unsaved.body` | Αν κλείσετε, οι αλλαγές θα χαθούν. | If you close, changes will be lost. |
| `rfqs.unsaved.discard` | Απόρριψη αλλαγών | Discard changes |
| `rfqs.unsaved.keep` | Συνέχεια επεξεργασίας | Continue editing |

---

## 5.L Offline & Network Failure Handling (Google «Banner + read-only» for transactional)

Procurement is a transactional, financial, multi-user system — full offline-first (Google Docs pattern) is inappropriate because hard conflicts on award/PO writes cannot be merged automatically. Instead, we use the Cloud Console pattern: graceful read-only degradation, with Firebase's built-in offline persistence providing free perks.

### 5.L.1 Detection — dual-source

Online state is the AND of two signals: browser network and Firestore connection. A laptop with WiFi but a downed Firestore is still effectively offline.

```ts
const isOnline = useOnlineStatus();              // window 'online'/'offline' events
const isFirestoreConnected = useFirestoreStatus(); // Firebase SDK signals
const isConnected = isOnline && isFirestoreConnected;
```

Both hooks must be SSR-safe. Search first for existing equivalents (CLAUDE.md SSOT). If absent:
- `src/hooks/useOnlineStatus.ts` (~15 lines)
- `src/hooks/useFirestoreStatus.ts` (~30 lines, uses Firestore SDK's offline detection helpers)

### 5.L.2 Banner — discreet, transient

Banner sits between `PageHeader` and the dashboard area. Yellow when offline, green for 3s on recovery, then auto-dismisses.

| State | Banner |
|-------|--------|
| Offline | ⚠️ «Δεν υπάρχει σύνδεση — προσπάθεια επανασύνδεσης...» (yellow, with subtle spinner) |
| Just reconnected | ✅ «Σύνδεση αποκαταστάθηκε» (green, 3s, auto-dismiss) |
| Online (steady) | (no banner) |

Banner is **non-blocking** — never modal, never dismisses content underneath. User can still browse cached data freely.

### 5.L.3 Write action policy — critical vs additive

The granular policy avoids both extremes (block everything = frustrating; queue everything = race-condition risk on critical writes):

| Action category | Offline behavior | Reason |
|-----------------|-------------------|--------|
| **Critical writes** (award, PO create/cancel, line edit, confirm/reject quote) | 🔒 Disabled + tooltip | Conflict-prone, financial — better to fail fast than queue and surprise-fail later |
| **Additive writes** (add comment, add invite, cancel pending invite) | ✅ Allowed — Firestore offline queue replays on reconnect | Idempotent or non-conflicting; safe to queue |
| **UI-only state** (tab change, quote selection, scroll, search) | ✅ Always works | No server interaction |
| **Reads** | ✅ From Firestore cache | `onSnapshot` continues emitting cached data |

**Disabled-tooltip text:** `t('rfqs.offline.requiresConnection')` → «Απαιτείται σύνδεση για αυτή την ενέργεια» / «This action requires a connection».

### 5.L.4 Firestore offline persistence — built-in perks

Enable Firestore's offline persistence at app initialization (if not already enabled). This gives:
- ✅ Reads served from cache transparently when offline
- ✅ `onSnapshot` continues emitting cached snapshots
- ✅ Additive writes queue automatically and replay when online
- ✅ If a queued write later fails the version check (§5.J), the existing `ConflictError` flow runs — same code path, no duplication

Verification step (Phase A.0): grep `enableIndexedDbPersistence` or `persistentLocalCache` in the Firebase init module. If not enabled, enable it (single-line change). If multi-tab support is needed, use `persistentMultipleTabManager`.

### 5.L.5 Live-change toasts behavior during offline

The §5.J live-change toast stream is **paused** while offline (no remote events arrive anyway, but cached snapshot deltas should not be misinterpreted as remote activity). On reconnection, instead of replaying every delta as individual toasts (which would spam), show a single aggregated toast:

```
ℹ️ {{count}} αλλαγές στη συνεδρία σας ενώ ήσασταν εκτός σύνδεσης. [Δες ιστορικό]
```

«Δες ιστορικό» opens a side panel listing the changes detected since the last connected snapshot. (Side panel content out of scope here — minimum viable: list of `{actor, action, target, time}`.)

### 5.L.6 Optimistic updates during offline

If the user triggers an additive write (e.g. add comment) while offline:
- Optimistic UI shows the comment with a small «pending» indicator (clock icon)
- Firestore queues the write
- On reconnect: write replays, indicator disappears
- On replay failure: indicator turns red, user can retry/discard

For critical writes (which are disabled), there is no optimistic state to manage — the buttons themselves don't fire.

### 5.L.7 Out of scope (potential Phase 2)

- Service Worker for full offline page load (currently the page must be loaded online; only post-load offline is handled)
- IndexedDB queue beyond Firestore's built-in (e.g. for non-Firestore API calls)
- Time-since-last-sync indicator
- Per-action offline policy customization beyond the static categories above
- Conflict review side panel for §5.L.5 reconnection summary (basic list is in scope; rich diff UI is not)

### 5.L.8 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.offline.banner` | Δεν υπάρχει σύνδεση — προσπάθεια επανασύνδεσης... | No connection — attempting to reconnect... |
| `rfqs.offline.recovered` | Σύνδεση αποκαταστάθηκε | Connection restored |
| `rfqs.offline.requiresConnection` | Απαιτείται σύνδεση για αυτή την ενέργεια | This action requires a connection |
| `rfqs.offline.queuedPending` | Σε αναμονή αποστολής | Pending sync |
| `rfqs.offline.queueFailed` | Δεν στάλθηκε. Δοκιμάστε ξανά. | Could not send. Try again. |
| `rfqs.offline.summaryToast` | {{count}} αλλαγές στη συνεδρία σας ενώ ήσασταν εκτός σύνδεσης. | {{count}} changes while you were offline. |
| `rfqs.offline.summaryAction` | Δες ιστορικό | View history |

---

## 5.M Accessibility — Deferred (explicit decision)

Per Giorgio's directive (2026-04-29), accessibility (WCAG, screen reader support, dedicated keyboard navigation, color-blind safe palettes, reduced-motion handling, RTL readiness) is **not in scope** for ADR-328 nor for the broader application at this time.

### 5.M.1 Decision

| Aspect | Status |
|--------|--------|
| Explicit `aria-label` / `aria-describedby` annotations | ❌ Not required |
| Explicit `role` attributes (beyond Radix defaults) | ❌ Not required |
| Custom keyboard handlers (Enter/Space on non-button elements) | ❌ Not required |
| Custom `tabIndex` management | ❌ Not required |
| Color-blind alternative indicators (icon + color, not color alone) | ❌ Not required |
| Contrast ratio audits (WCAG 4.5:1 / 7:1) | ❌ Not required |
| Skip links / landmark regions | ❌ Not required |
| `prefers-reduced-motion` handling | ❌ Not required |
| RTL layout readiness | ❌ Not required |

### 5.M.2 Rationale

- The application is approaching production deployment
- Customer base is **B2B** (construction/property management) — no current legal obligation under the European Accessibility Act (which targets B2C)
- Greek law 4727/2020 applies to public sector only — not relevant here
- No current contractual customer demanding WCAG compliance
- Retrofit cost across the existing 200+ components/pages is months of work — not justified by current customer profile

### 5.M.3 Affected sections — clarification

Earlier sections of this ADR (§5.B.4, §5.D.2, §5.I.3, §5.A.3, §5.G.3) mention `aria-label` keys, keyboard handlers, and `tabIndex` assignments. These are **deferred / aspirational** — implementation may omit them. They remain in the i18n key tables only because they cost ~zero to define and would be useful if accessibility is later prioritized.

What **is** still expected (because it serves all users, not just accessibility):
- Tooltips on icon-only buttons (discoverability for everyone)
- Native HTML semantics where natural (`<button>` for buttons, `<nav>` for nav, etc.) — Radix UI provides these by default at no cost
- Visible hover and focus states (Radix UI defaults — no extra work)

What is **not** expected:
- Manual `aria-*` attributes beyond Radix defaults
- Custom keyboard handling beyond what Radix provides natively
- Contrast audits / color-blind testing
- Screen reader testing

### 5.M.4 Future re-evaluation triggers

This decision should be revisited if any of the following occur:

| Trigger | Action |
|---------|--------|
| Customer signs a contract requiring WCAG compliance | Open accessibility ADR, scope retrofit by criticality |
| Application pivots to B2C distribution in EU | Same — EAA enforcement makes it mandatory |
| Sale to public sector body (Greek/EU) | Public-sector accessibility laws kick in |
| Internal user with disability needs the app | Address that user's specific need first; broaden as needed |

Until then, all new ADRs may continue without dedicated accessibility scope. **No silent reintroduction of accessibility scope** mid-implementation — must be explicit in a new ADR.

### 5.M.5 i18n keys

No additional i18n keys for this section. Earlier `aria-label` keys defined in §§5.B.4, 5.D.2, 5.I.3 remain in the i18n tables but are not required to be wired up.

---

## 5.N Performance Budget & Scale Assumptions

Based on Giorgio's confirmed real-world usage (2026-04-29), the page is engineered for **small-scale** procurement workflows. This avoids unnecessary complexity (virtualization, pagination, infinite scroll) that would not pay off at the actual data sizes.

### 5.N.1 Realistic data bounds (per single RFQ)

| Item | Typical | Max | Hard upper bound (defensive) |
|------|---------|-----|-------------------------------|
| Quotes received | 3–5 | 10 | 25 |
| Vendor invites sent | 3–5 | 10 | 25 |
| RFQ lines (items being quoted) | 5–15 | 30 | 50 |
| Comments per quote | 0–5 | 20 | 50 |

«Hard upper bound» = the size at which the page must still feel responsive. Beyond this, behavior is undefined (degrade gracefully, but no UX guarantees).

### 5.N.2 Implementation implications — what we DON'T need

Given the small data sizes, the following are explicitly **not required**:

| Feature | Status | Reason |
|---------|--------|--------|
| List virtualization (`react-window`, `tanstack-virtual`) | ❌ Out | 10 quote rows = no perf benefit; adds complexity |
| Pagination on quotes/invites/lines | ❌ Out | All fit on screen with normal scroll |
| Infinite scroll | ❌ Out | Bounded data |
| `useDeferredValue` / `useTransition` for filtering | ❌ Out | Filtering 10 items is instant |
| Server-side search | ❌ Out | Client-side filter on 10 items is trivial |
| Comparison table column virtualization | ❌ Out | 10 columns max |
| Memoization beyond standard React patterns | ❌ Out | Re-rendering 10 rows is fast |

### 5.N.3 Implementation implications — what we DO

| Feature | Status | Reason |
|---------|--------|--------|
| Client-side search on `QuoteList` | ✅ Already in `QuoteList` (free) | Useful at any scale, costs nothing |
| Standard React `useMemo` on derived data (stats, sorted lists) | ✅ Standard | Negligible cost, prevents unneeded recomputation |
| `onSnapshot` for live data | ✅ Per §5.J | Required for collaboration regardless of scale |

### 5.N.4 Performance budget

Target metrics on a **typical RFQ** (5 quotes, 15 lines, 5 invites) on **mid-tier hardware** (e.g. 2020 laptop with throttled 4× CPU, Fast 3G network):

| Metric | Target |
|--------|--------|
| Initial page load (Time to Interactive) | < 2s |
| Tab switch | < 100ms |
| Quote selection (right pane render) | < 100ms |
| Award winner (optimistic UI update) | < 50ms |
| Comparison row click → drill into Quotes tab | < 200ms |

These budgets assume Firestore data is already cached (subsequent loads) or is delivered within typical Firestore latency (~150–500ms for cold reads).

### 5.N.5 Future scale revisit triggers

This decision should be revisited if any of the following occur:

| Trigger | Action |
|---------|--------|
| A single RFQ exceeds 25 quotes in production | Add list virtualization to `QuoteList`; revisit comparison panel |
| RFQ lines exceed 50 in production | Add virtualization or pagination to `RfqLinesPanel` |
| Customer base shifts to large infrastructure projects | Re-scope to Option Β (medium) or Γ (large) in a new ADR |
| Latency budget breached on real workloads | Profile, then optimize specifically — no premature work |

Until then, **no premature optimization**. New ADRs assume Option Α scale unless explicitly stated otherwise.

---

## 5.O PDF Preview Integration (Google «Synthesized first, raw on demand»)

The right pane in Tab «Προσφορές» defaults to extracted data (synthesized view). The original PDF is one toggle away — side-by-side on desktop for verification, full-screen modal on mobile. Reuses the existing PDF viewer component from the quote review page (`/procurement/quotes/[id]/review`).

### 5.O.1 Default behavior

When a quote is selected, the right pane shows extracted data only:
- `QuoteDetailsHeader` (with award/status actions)
- `QuoteDetailSummary` (lines, totals, terms)

The original PDF is **not** rendered until the user opts in.

### 5.O.2 Toggle entry point

A new icon button is added to the header's secondary actions group (extending §5.I.3):

| Icon | Action | Tooltip key | Disabled when |
|------|--------|-------------|---------------|
| `Eye` (or `FileText`) | Show/hide original PDF | `rfqs.quoteHeader.tooltip.viewPdf` → «Δες αρχικό PDF» | No source PDF on the quote (`!quote.sourcePdfUrl`) |

The icon toggles between «show» and «hide» states based on whether the PDF panel/modal is currently open.

### 5.O.3 Desktop behavior — side panel slide-in

On `≥ 768px` (`md:` breakpoint and up), toggling the PDF view splits the right pane horizontally:

```
┌─ QuoteList ──┬─ Right pane ──────────────────────────────────┐
│  380px       │  Default state: full-width extracted           │
│              │                                                │
│              │  Toggle ON: 50/50 split                        │
│              │  ┌─ PDF viewer ──┬─ Extracted data ────┐       │
│              │  │  ~50%         │  ~50%               │       │
│              │  │               │                     │       │
│              │  └───────────────┴─────────────────────┘       │
└──────────────┴────────────────────────────────────────────────┘
```

- `QuoteList` (left, 380px) stays visible — navigation between quotes continues to work
- Smooth animation on slide-in/out (~200ms transform; respect `prefers-reduced-motion` if available, otherwise plain transition is fine)
- Each pane is independently scrollable
- A close button (`[×]`) on the PDF pane top-right also closes (in addition to the header toggle)

### 5.O.4 Mobile behavior — full-screen modal

On `< 768px`, side-by-side is not viable. Toggle ON opens a full-screen modal:

- 100% viewport
- Top bar: file name + close button
- Body: same `PdfViewer` component
- ESC, backdrop click, or close button dismisses

### 5.O.5 PDF viewer component — shared with review page

Phase A.0 verification step: locate the existing PDF viewer component used in `/procurement/quotes/[id]/review`. Likely candidates to grep: `PdfViewer`, `PDFPreview`, `PdfPreview`, `DocumentViewer`.

| If found at | Action |
|-------------|--------|
| Reusable component already (e.g. `src/components/pdf/PdfViewer.tsx`) | Import and reuse as-is |
| Embedded inside `QuoteReviewClient.tsx` | **Extract** to `src/components/pdf/PdfViewer.tsx` first; update review page to consume the extracted version; then use the same component here |

**Do not fork** — the component must be the single source of truth so review and RFQ-detail pages stay in sync (zoom controls, page navigation, error states).

### 5.O.6 URL state — `?pdf=1`

Persist the open/closed state in the URL alongside `?tab=` and `?quote=`:

```
/procurement/rfqs/{rfqId}?tab=quotes&quote={quoteId}&pdf=1
```

| Param | Meaning |
|-------|---------|
| `pdf=1` | PDF panel/modal open |
| `pdf` missing or `pdf=0` | PDF closed (default) |

Navigation method: `router.replace` (refining current view, no new history entry) — same as quote selection on desktop. Mobile: `router.push` so back-gesture closes the modal (consistency with §5.E.4).

This makes refresh-safe and share-link-safe: if a user shares a URL with `?pdf=1`, the recipient lands with PDF open.

### 5.O.7 Phase A.0 — extraction work upfront

If the PDF viewer is not already a reusable component, the extraction is a **prerequisite** of Phase A:

1. Identify the inline implementation in the review page
2. Extract to `src/components/pdf/PdfViewer.tsx` with a clean prop interface:
   ```ts
   interface PdfViewerProps {
     url: string;
     fileName?: string;
     onError?: (error: Error) => void;
     className?: string;
   }
   ```
3. Update review page to consume the extracted component (verify nothing regresses visually)
4. Use the same component in the RFQ detail page

This extraction is mandatory — it is **not** acceptable to render the PDF differently in the two pages. Inconsistent zoom controls or page navigation between two views of the same PDF would be a serious UX regression.

### 5.O.8 Lazy loading

The `PdfViewer` component (and its dependencies — likely `react-pdf` or similar with `pdfjs-dist`) should be **lazy-loaded** via `next/dynamic` to keep the initial RFQ detail page bundle small:

```ts
const PdfViewer = dynamic(() => import('@/components/pdf/PdfViewer'), {
  ssr: false,
  loading: () => <PdfViewerSkeleton />,
});
```

Most users will not toggle the PDF on every visit — paying its bundle cost upfront would slow initial load for the common case. This is consistent with the §5.N performance budget.

### 5.O.9 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.quoteHeader.tooltip.viewPdf` | Δες αρχικό PDF | View original PDF |
| `rfqs.quoteHeader.tooltip.hidePdf` | Κλείσε αρχικό PDF | Hide original PDF |
| `rfqs.pdfPanel.closeAria` | Κλείσιμο PDF | Close PDF |
| `rfqs.pdfPanel.loading` | Φόρτωση PDF... | Loading PDF... |
| `rfqs.pdfPanel.error` | Δεν φόρτωσε το PDF | Could not load PDF |

---

## 5.P Quote List Sorting (Google «Smart default + user control»)

The quote list applies a status-priority composite sort by default — matching the user's primary task (decide who to award) — and exposes a sort dropdown so the user can override.

### 5.P.1 Default sort — «Status + Price»

Quotes are grouped by status priority, then sorted by `totals.total` ASC within each group:

```
1. accepted          (winner — pinned to top)
   ─────────────────
2. under_review      (cheapest first within group)
   ─────────────────
3. submitted         (cheapest first within group)
   ─────────────────
4. draft             (cheapest first within group)
   ─────────────────
5. rejected          (cheapest first within group)
```

Note: there is no `expired` group — expiration is a derived UI overlay (§5.BB), not a status. Expired quotes appear within their actual status group with the badge.

A subtle horizontal divider (`border-t border-muted`) separates each status group — visual cue mirrors Gmail's section-grouped inbox.

### 5.P.2 Status priority constants

```ts
// src/subapps/procurement/utils/quote-sort.ts
// NOTE: 'expired' is NOT a status (per §5.BB) — it's derived from validUntil
export const STATUS_PRIORITY: Record<QuoteStatus, number> = {
  accepted: 1,
  under_review: 2,
  submitted: 3,
  draft: 4,
  rejected: 5,
};
```

### 5.P.3 Sort options (user-overridable)

A dropdown above the list (rendered inside `QuoteList` toolbar area) exposes:

| Sort key | Label (el / en) | Sort order |
|----------|-----------------|------------|
| `status-price` (default) | Κατάσταση + Τιμή / Status + Price | `STATUS_PRIORITY` ASC, then `totals.total` ASC |
| `recent` | Πιο πρόσφατες / Most recent | `submittedAt` DESC |
| `price-asc` | Φθηνότερη πρώτα / Cheapest first | `totals.total` ASC |
| `price-desc` | Ακριβότερη πρώτα / Most expensive first | `totals.total` DESC |
| `vendor-asc` | Προμηθευτής (Α-Ω) / Vendor (A-Z) | `vendorName` locale-compare ASC |

### 5.P.4 URL state

Sort key persists in the URL, consistent with §3.4. Default value is omitted from the URL to keep canonical URLs clean:

```
/procurement/rfqs/{rfqId}?tab=quotes&quote={quoteId}             (default sort)
/procurement/rfqs/{rfqId}?tab=quotes&sort=recent
/procurement/rfqs/{rfqId}?tab=quotes&sort=price-asc
```

Navigation method: `router.replace` (refining current view — no new history entry needed). Tab change still uses `push`.

### 5.P.5 Missing field fallback

If a quote is missing `submittedAt` or `totals.total`, it sorts to the **end** of its group rather than breaking the sort:

```ts
function compareByPrice(a: Quote, b: Quote): number {
  const aTotal = a.totals?.total ?? Number.POSITIVE_INFINITY;
  const bTotal = b.totals?.total ?? Number.POSITIVE_INFINITY;
  return aTotal - bTotal;
}

function compareByRecency(a: Quote, b: Quote): number {
  const aTime = a.submittedAt ?? 0;
  const bTime = b.submittedAt ?? 0;
  return bTime - aTime; // DESC
}
```

`Number.POSITIVE_INFINITY` for missing prices = naturally sorts last in ASC, naturally sorts first in DESC. For DESC price sort, swap to `Number.NEGATIVE_INFINITY` to keep them last:

```ts
function compareByPriceDesc(a: Quote, b: Quote): number {
  const aTotal = a.totals?.total ?? Number.NEGATIVE_INFINITY;
  const bTotal = b.totals?.total ?? Number.NEGATIVE_INFINITY;
  return bTotal - aTotal;
}
```

### 5.P.6 Implementation location

| Module | Path | Responsibility |
|--------|------|----------------|
| Sort utilities | `src/subapps/procurement/utils/quote-sort.ts` | Pure functions: `STATUS_PRIORITY`, `sortQuotes(quotes, sortKey)`, comparators |
| Sort dropdown UI | Inside `QuoteList` toolbar (existing `CompactToolbar` slot) | Reads/writes `?sort=` via the same URL pattern as other state |

Pure-function module is testable in isolation. Do **not** embed sort logic inside `QuoteList` JSX — extract to the utility module.

### 5.P.7 Group dividers in the rendered list

When `sortKey === 'status-price'` (default), render a divider between status groups:

```tsx
{groups.map((group) => (
  <Fragment key={group.status}>
    {!isFirst && <div className="border-t border-muted my-2" />}
    {group.quotes.map((q) => <QuoteListCard key={q.id} quote={q} />)}
  </Fragment>
))}
```

For other sort keys (recent, price, vendor), no dividers — flat list. Dividers are only meaningful when grouping is the active organizing principle.

### 5.P.8 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.sort.label` | Ταξινόμηση | Sort |
| `rfqs.sort.option.statusPrice` | Κατάσταση + Τιμή | Status + Price |
| `rfqs.sort.option.statusPriceDefault` | Κατάσταση + Τιμή (προεπιλογή) | Status + Price (default) |
| `rfqs.sort.option.recent` | Πιο πρόσφατες | Most recent |
| `rfqs.sort.option.priceAsc` | Φθηνότερη πρώτα | Cheapest first |
| `rfqs.sort.option.priceDesc` | Ακριβότερη πρώτα | Most expensive first |
| `rfqs.sort.option.vendorAsc` | Προμηθευτής (Α-Ω) | Vendor (A-Z) |

---

## 5.Q No Data Migration Required (TIME-SENSITIVE — see top of ADR)

> **⚠️ Read the top-of-document notice before relying on this section.** This decision was valid as of 2026-04-29 but expires the moment production launches (target ~2026-05-06). After production launch, treat this section as **invalid** and open a migration ADR.

Confirmed by Giorgio (2026-04-29): all current Firestore + Storage data is **test data** that will be wiped before production deployment. This ADR therefore does **not** include:

- Backfill scripts for new fields (e.g. `version`, `updatedAt`, `updatedBy` introduced in §5.J)
- Compatibility shims for old documents lacking new fields
- Backwards-compatible default values for missing schema additions
- Migration ADR/runbook

New fields can be assumed present on every document from day one of production. This significantly simplifies the implementation:
- Optimistic locking version checks (§5.J.3) can `throw` immediately on missing `version` instead of falling back to a "first-write" path
- The conflict UI (§5.J.4) does not need a "legacy document" branch
- Stats and sort comparisons (§5.N, §5.P) can rely on consistent shape

If at any point production data is generated **before** this ADR ships, the test-data assumption breaks and a migration ADR becomes necessary. Currently no such constraint exists, but the production launch is expected within ~1 week of this ADR — see top-of-document notice for verification steps.

---

## 5.R Comments & History — Deferred to Future ADRs

The icon buttons defined in §5.I.3 for **Comments** (`💬 MessageSquare`) and **History** (`🕒 History`) are part of the visual design contract, but their **functional implementation** is deferred to dedicated follow-up ADRs. This ADR provides the **entry points only**.

### 5.R.1 Scope clarification

| Aspect | This ADR (ADR-328) | Future ADR |
|--------|---------------------|------------|
| Icon button rendering in header | ✅ In scope | — |
| Click handler wiring (`onClick`) | ⚠️ Wire to placeholder no-op | ✅ Replace with real handler |
| Side panel UI (Comments) | ❌ Out of scope | ✅ Future ADR (e.g. ADR-329) |
| Side panel UI (History) | ❌ Out of scope | ✅ Future ADR (e.g. ADR-330) |
| Firestore subcollection / audit-trail wiring | ❌ Out of scope | ✅ Future ADR |
| Comment count badge | ⚠️ Render `0` for now (no data source yet) | ✅ Real count from Firestore |
| `mentions @user`, threading, edit/delete | ❌ Out of scope | ✅ Future ADR |

### 5.R.2 Placeholder behavior in this ADR

Until the future ADRs land, the buttons should **not** be silently dead. Two acceptable options — implementer chooses:

**Option A — Disabled with tooltip (recommended):**
```tsx
<IconButton
  icon={MessageSquare}
  disabled
  tooltip={t('rfqs.comingSoon.comments')}  // «Σχόλια — έρχονται σύντομα»
/>
```
- Pro: signals to user that the feature is planned
- Pro: zero risk of accidentally invoking unfinished code
- Con: slightly cluttered visual

**Option B — Hide entirely until feature lands:**
- Remove from `secondaryActions` array until the future ADR adds the real handler
- Pro: cleaner UI, no dead controls
- Con: changes the §5.I.3 visual contract; the future ADR will need to re-add them

**Default choice:** Option A. Removing and re-adding the buttons creates double work; disabled-with-tooltip preserves the §5.I.3 visual design.

### 5.R.3 Why deferred

- Implementing Comments well requires its own design space: threading model, mention notifications, edit/delete policy, real-time sync, moderation
- Implementing History well requires reusing/extending the existing `EntityAuditService` (ADR-195), which has its own design considerations (UI for diff rendering, filtering, exporting)
- Bundling either into ADR-328 would expand scope by 1–2 weeks and delay the structural refactor
- The buttons in the design ensure that the future ADRs have a clear UX entry point already specified

### 5.R.4 Action — open follow-ups

Once ADR-328 is implemented and merged:

1. Open **ADR-329** for Quote Comments (or whatever number is next available per CLAUDE.md numbering rule)
2. Open **ADR-330** for Quote History (or next available)
3. Each future ADR replaces the placeholder no-op handler with the real one and removes the «coming soon» tooltip

### 5.R.5 i18n keys (placeholder only)

| Key | el | en |
|-----|----|----|
| `rfqs.comingSoon.comments` | Σχόλια — έρχονται σύντομα | Comments — coming soon |
| `rfqs.comingSoon.history` | Ιστορικό — έρχεται σύντομα | History — coming soon |

These are temporary; remove when the corresponding future ADRs ship.

---

## 5.S Comparison Tab Empty States (Google «Educate, don't disable»)

The «Σύγκριση» tab handles three cardinality cases. The tab itself is **always enabled** — Material 3 mandates that top-level navigation remain explorable. Empty states inside the tab educate the user about what will appear and how to populate it.

### 5.S.1 Cardinality matrix

| Quotes count | Tab state | Tab badge (§5.B) | Tab content |
|--------------|-----------|-------------------|-------------|
| 0 | Enabled | — | §5.S.2 educational empty state |
| 1 | Enabled | — | §5.S.3 single-quote pre-comparison state |
| ≥ 2 | Enabled | yellow dot if recommendation pending | Normal `ComparisonPanel` (existing component) |

The tab is **never disabled**, regardless of count. Disabling top-level navigation contradicts Material 3 guidance and creates inconsistency with the §5.B badge model.

### 5.S.2 Empty state — 0 quotes

```
┌────────────────────────────────────────────────────────────┐
│                          📊                                │
│                                                            │
│         Δεν υπάρχουν προσφορές για σύγκριση                │
│                                                            │
│   Όταν λάβεις προσφορές από προμηθευτές, εδώ               │
│   θα εμφανιστεί η σύγκρισή τους με σκορ, τιμές            │
│   και προτεινόμενο νικητή.                                 │
│                                                            │
│   [👥 Δες προσκλήσεις]   [📷 Σάρωση PDF]                  │
└────────────────────────────────────────────────────────────┘
```

**Spec:**
- Icon: `BarChart3` (lucide-react), large (size 48–64), muted color
- Title: `t('rfqs.comparison.empty.zero.title')` → «Δεν υπάρχουν προσφορές για σύγκριση»
- Body: `t('rfqs.comparison.empty.zero.body')` → educational copy describing what will appear
- CTAs (mirror §5.C action buttons for cross-tab consistency):
  - «👥 Δες προσκλήσεις» → switches to Tab Setup (`router.push` with `?tab=setup`)
  - «📷 Σάρωση PDF» → opens scan dialog (same handler as `PageHeader.scanButton`)

### 5.S.3 Empty state — 1 quote (pre-comparison)

Shows the single existing quote in summary form, explains the threshold, offers next-step CTAs:

```
┌────────────────────────────────────────────────────────────┐
│                          📊                                │
│                                                            │
│      Έχεις 1 προσφορά — χρειάζονται τουλάχιστον 2          │
│      για σύγκριση                                          │
│                                                            │
│   ┌─ Τρέχουσα προσφορά ─────────────────────────┐         │
│   │ 🏪 Vendor X                                  │         │
│   │ 💰 12.500€ — 15 ημέρες παράδοση              │         │
│   │ Status: under_review                          │         │
│   │                       [Δες λεπτομέρειες]      │         │
│   └───────────────────────────────────────────────┘         │
│                                                            │
│   [+ Νέα προσφορά]   [📷 Σάρωση PDF]   [👥 Δες προσκλήσεις]│
└────────────────────────────────────────────────────────────┘
```

**Spec:**
- Same `BarChart3` icon
- Title: `t('rfqs.comparison.empty.one.title')` → «Έχεις 1 προσφορά — χρειάζονται τουλάχιστον 2 για σύγκριση»
- Body: short explanatory line
- **Quote summary card** for the existing quote:
  - Vendor name (with icon)
  - Total price + delivery days
  - Status badge
  - «Δες λεπτομέρειες» link → `router.push` with `?tab=quotes&quote=<thatQuoteId>` (drill-down per §5.D pattern)
- CTAs: New Quote, Scan PDF, View Invites (consistency with §5.C and §5.S.2)

### 5.S.4 Component

New component: `src/subapps/procurement/components/ComparisonEmptyState.tsx` (~80–110 lines).

Props:
```ts
interface ComparisonEmptyStateProps {
  quotes: Quote[];                          // 0 or 1 quote — caller guarantees length < 2
  onNewQuote: () => void;
  onScan: () => void;
  onViewInvites: () => void;                // calls setActiveTab('setup')
  onViewQuoteDetails: (quoteId: string) => void; // for the 1-quote case
}
```

Render branch:
- `quotes.length === 0` → §5.S.2 layout
- `quotes.length === 1` → §5.S.3 layout
- (caller never passes `length >= 2` — those go to `ComparisonPanel`)

### 5.S.5 Usage in `RfqDetailClient.tsx`

```tsx
<TabsContent value="comparison">
  {quotes.length < 2 ? (
    <ComparisonEmptyState
      quotes={quotes}
      onNewQuote={handleNewQuote}
      onScan={handleScan}
      onViewInvites={() => handleTabChange('setup')}
      onViewQuoteDetails={handleSelectQuoteFromComparison}
    />
  ) : (
    <>
      {comparison?.recommendation && <RecommendationCard … />}
      {rfq?.sourcingEventId && <SourcingEventSummaryCard … />}
      <ComparisonPanel
        comparison={comparison}
        onRowClick={handleSelectQuoteFromComparison}
      />
    </>
  )}
</TabsContent>
```

### 5.S.6 Behavior consistency

| Empty state | Same pattern as |
|-------------|-----------------|
| 0 quotes (Comparison) | §5.C empty state for Tab Quotes |
| 0 quotes (Quotes Tab) | §5.C |
| 1 quote (Comparison) | New — but reuses §5.C's CTA design language |

The user sees a coherent "education + next steps" pattern across tabs, not three different empty-state designs.

### 5.S.7 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.comparison.empty.zero.title` | Δεν υπάρχουν προσφορές για σύγκριση | No quotes to compare yet |
| `rfqs.comparison.empty.zero.body` | Όταν λάβεις προσφορές από προμηθευτές, εδώ θα εμφανιστεί η σύγκρισή τους με σκορ, τιμές και προτεινόμενο νικητή. | When you receive vendor quotes, you will see them compared here with scores, prices and a recommended winner. |
| `rfqs.comparison.empty.one.title` | Έχεις 1 προσφορά — χρειάζονται τουλάχιστον 2 για σύγκριση | You have 1 quote — at least 2 are needed for comparison |
| `rfqs.comparison.empty.one.body` | Πρόσθεσε δεύτερη προσφορά για να ενεργοποιηθεί η σύγκριση. | Add a second quote to enable comparison. |
| `rfqs.comparison.empty.one.currentLabel` | Τρέχουσα προσφορά | Current quote |
| `rfqs.comparison.empty.one.viewDetails` | Δες λεπτομέρειες | View details |
| `rfqs.comparison.empty.deliveryDays` | {{days}} ημέρες παράδοση | {{days}} days delivery |

---

## 5.T Comparison Panel Scope (Procore-inspired pragmatic) — Deferred extensions

The existing `ComparisonPanel` component remains **unchanged** in this ADR. ADR-328 only relocates it into Tab «Σύγκριση» (§3) and wires the row-click drill-down (§5.D). Construction-grade comparison features (inclusions/exclusions matrix, normalized TCO, weighted scoring, vendor qualification badges) are deferred to a dedicated follow-up ADR.

### 5.T.1 What ADR-328 does to `ComparisonPanel`

| Action | Status |
|--------|--------|
| Move into Tab «Σύγκριση» | ✅ In scope (§3) |
| Add `onRowClick` prop for drill-down | ✅ In scope (§5.D.3) |
| Add visual affordance + stopPropagation on inner controls | ✅ In scope (§5.D.2) |
| Change scoring algorithm | ❌ Out of scope |
| Add new comparison columns | ❌ Out of scope |
| Add inclusions/exclusions matrix | ❌ Out of scope |
| Normalize totals (ΦΠΑ + εργασία + μεταφορικά) | ❌ Out of scope |
| Add weighted scoring | ❌ Out of scope |
| Add vendor qualification badges | ❌ Out of scope |

### 5.T.2 Phase A.0 audit step (mandatory before implementation)

Before ADR-328 implementation begins, the implementer must read the current `ComparisonPanel.tsx` and produce a brief audit table inside this section (§5.T.3 below) listing:

- Which AI-extracted quote fields it currently surfaces in the comparison
- Which industry-standard construction comparison criteria are missing
- Whether `vatIncluded` / `laborIncluded` flags (from ADR-327 recent work) are honored

This audit is **non-blocking** — it does not change behavior in ADR-328. It exists to feed the follow-up ADR with concrete gaps.

### 5.T.3 Audit results — Phase 0 (executed 2026-04-30)

**File audited:** `src/subapps/procurement/components/ComparisonPanel.tsx`

| Criterion | Currently shown? | Source field |
|-----------|-------------------|--------------|
| Net total (`entry.total`) | ✅ Yes — `formatCurrency(entry.total)` | `QuoteComparisonEntry.total` |
| Grand total (incl. VAT) | ⚠️ Unclear — `total` field, VAT breakdown not surfaced | `QuoteComparisonEntry.total` |
| VAT included flag | ❌ No | Not in `QuoteComparisonEntry` (lives in `Quote.extractedData.vatIncluded`) |
| Labor included flag | ❌ No | Not in `QuoteComparisonEntry` (lives in `Quote.extractedData.laborIncluded`) |
| Delivery days | ❌ No | Not in `QuoteComparisonEntry` |
| Payment terms | ❌ No | Not in `QuoteComparisonEntry` |
| Warranty | ❌ No | Not in `QuoteComparisonEntry` |
| Discount | ❌ No | Not in `QuoteComparisonEntry` |
| AI score / recommendation | ✅ Yes — `entry.score` column + `RecommendationCard` above table | `QuoteComparisonEntry.score` + `comparison.recommendation` |
| Breakdown bars (price/supplier/terms/delivery) | ✅ Yes — `BreakdownBars` sub-component, 4 progress bars | `QuoteComparisonEntry.breakdown` |
| Flags | ✅ Yes — `FlagsRow` sub-component with badge variants | `QuoteComparisonEntry.flags` |
| Award button per row | ✅ Yes — opens `AwardModal` | `onAward` callback |
| Cherry-pick summary | ✅ Yes — `CherryPickCard` (conditional) | `CherryPickResult` |
| Template/weights summary | ✅ Yes — `TemplateSummary` in CardHeader | `comparison.templateId` + `comparison.weights` |
| **`onRowClick` prop** | ❌ **MISSING** — `ComparisonPanelProps` has no click handler | Must add in Phase 3 |
| Inclusions/Exclusions matrix | ❌ Not present | Deferred to ADR-331 |
| Normalized TCO | ❌ Not present | Deferred to ADR-331 |
| Vendor qualification | ❌ Not present | Deferred to ADR-331 |

**Summary:** The panel is solid for small-scale procurement (§5.N: 3-5 quotes). The only ADR-328 gap is `onRowClick` (Phase 3 addition, non-blocking per §6.3). All construction-grade criteria (VAT flag, TCO, inclusions matrix) are confirmed absent and correctly deferred to ADR-331.

### 5.T.4 Follow-up ADR — Construction-grade comparison

Open **ADR-331** (or next available number per CLAUDE.md numbering rule, after ADR-329 / ADR-330 from §5.R) titled approximately:

> **ADR-331 — Construction-Grade Quote Comparison: Inclusions, TCO, Weighted Scoring**

Suggested scope for that ADR (do not implement here — just enumerate so future planners have a starting point):

1. **Normalized totals** — single comparable base across vendors:
   - Apply `vatIncluded` / `laborIncluded` flags consistently
   - Add user-configurable defaults: «αν vendor δε λέει ΦΠΑ, υπολόγισε με 24%»
   - Surface a normalized comparable total alongside the raw bid

2. **Inclusions / Exclusions matrix** — Procore-style:
   - Rows: ΦΠΑ, Εργασία, Μεταφορά, Εγκατάσταση, Εγγύηση, Πιστοποιήσεις
   - Columns: each vendor
   - Cells: ✅ / ❌ / «—» (unknown)
   - Source: AI extraction + manual override during review

3. **Weighted scoring v2** — SAP Ariba-style:
   - User defines weights per RFQ (price 40% / delivery 30% / payment 20% / warranty 10%, defaults configurable)
   - Computed score visible per vendor
   - Recommendation = highest weighted score (not lowest price)

4. **Vendor qualification badges** — from existing contacts module:
   - Tax compliance valid?
   - Past performance score
   - Certifications (ISO, CE)

5. **Visualizations**:
   - Bar chart of normalized totals
   - Radar chart of weighted criteria
   - Sensitivity slider («αν δώσω 50% στην παράδοση, αλλάζει ο νικητής;»)

### 5.T.5 Why deferred

- Each construction-grade criterion is its own design problem (inclusions/exclusions logic, weight UI, vendor qualification data model)
- Bundling into ADR-328 expands scope by 2–4 weeks and delays the structural refactor
- The current `ComparisonPanel` is **adequate for small-scale** procurement (per §5.N — 3-5 quotes typical, max 10) — most users will be served well enough by what already exists
- A dedicated ADR allows proper input from real users on weight defaults and criteria priorities

### 5.T.6 Reference benchmarks

| System | Pattern relevant to ADR-331 |
|--------|------------------------------|
| **SAP Ariba Sourcing** | Multi-criteria weighted scoring, configurable weights |
| **Oracle Primavera Unifier** | Total Cost of Ownership (TCO), compliance gating |
| **Procore Bid Comparison** | Inclusions/Exclusions matrix, schedule of values, vendor qualification |

ADR-331 should pick the construction-most-relevant patterns from each (likely Procore-leaning, since the customer base is small construction — see §5.N).

---

## 5.U Smart Search in Quote List (pattern-aware)

The search box in `QuoteList` (already present) detects the user's intent from the input pattern and searches the most relevant fields. Falls back to free-text multi-field search when no pattern matches.

### 5.U.1 Pattern detection priority

The query is checked against patterns in this order. **First match wins**; the rest are skipped:

| Priority | Pattern | Detection | Searched fields | Match logic |
|----------|---------|-----------|-----------------|-------------|
| 1 | Quote number | `/^q[-\s]?(\d{4})?[-\s]?\d+/i` (e.g. `Q-2026-0042`, `q42`, `Q 2026 0042`) | `quote.displayNumber` | Case-insensitive substring after normalization |
| 2 | Date (DD/MM/YYYY or YYYY-MM-DD) | `/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/` or ISO date | `quote.submittedAt`, `quote.createdAt` | Same calendar day match |
| 3 | Numeric / price | `/^[€$]?\s*\d+([.,]\d{1,2})?\s*[€$]?$/` (e.g. `12500`, `12,500`, `€12500.00`) | `quote.totals.netTotal`, `quote.totals.grandTotal` | Substring match on stringified value (no tolerance window — exact within rounding) |
| 4 | Free text (default) | anything else | `quote.vendorName`, `quote.lines[].description`, `quote.terms.delivery`, `quote.terms.payment`, `quote.terms.warranty`, `quote.notes` | Case-insensitive locale-aware substring; matches if **any** field contains the query |

### 5.U.2 Examples

| User types | Detected pattern | Searches |
|------------|------------------|----------|
| `Q-2026-0042` | Quote number | `displayNumber` only |
| `q42` | Quote number | `displayNumber` only |
| `12500` | Numeric/price | `totals.netTotal`, `totals.grandTotal` |
| `12.500€` | Numeric/price | totals (after currency strip) |
| `15/04/2026` | Date | `submittedAt`, `createdAt` (same day) |
| `boiler` | Free text | vendor name + lines + terms + notes |
| `Thermoland` | Free text | vendor name (matches), also tries other fields |
| `pirelli 12500` | Free text (no single-pattern match) | all free-text fields, treats as multi-token |

For multi-token free-text queries (e.g. `pirelli 12500`), split on whitespace, require **all** tokens to match (any field per token). This is a common pattern from search UIs and matches user intent of "narrow further".

### 5.U.3 Normalization rules

Before matching, normalize both the query and the candidate field values:

- Lowercase
- Greek + Latin both supported via `String.prototype.localeCompare` with `{ sensitivity: 'base' }` (matches `Θ` and `θ`, ignores accents)
- Strip currency symbols (€, $) and thousand separators (`,`, `.` ambiguous in Greek — handle both)
- Trim whitespace

For numeric matching specifically:
- Parse query as number after stripping non-digit, non-decimal chars
- Compare stringified field value (rounded to 2 decimals) — so `12500` matches `12500.00` and `12,500.00`

### 5.U.4 No "I meant the other pattern" UI

Pattern detection is automatic and silent. Material 3:
> *«Avoid mode toggles in search inputs unless the user has explicitly asked for one. The right pattern should win 95%+ of cases via heuristics; the remaining 5% can use the free-text fallback by simply rephrasing.»*

If the user types `12500` but actually wants a vendor whose name contains `12500` (rare), the numeric pattern will hit no totals match → falls through to no-results state. The user can then type more context (e.g. `vendor 12500`) which becomes free-text.

### 5.U.5 Empty results state

When no matches:

```
┌────────────────────────────────────────────┐
│             🔍                             │
│   Δεν βρέθηκαν προσφορές με «{{query}}»    │
│                                            │
│   Δοκίμασε να ψάξεις με:                   │
│   • Όνομα προμηθευτή (π.χ. Thermoland)     │
│   • Αριθμό προσφοράς (π.χ. Q-2026-0042)    │
│   • Τιμή (π.χ. 12500)                      │
└────────────────────────────────────────────┘
```

Suggestions are static (not personalized) — explain what's searchable. Helpful to first-time users who don't know the search supports numeric/quote-number patterns.

### 5.U.6 Performance

At §5.N scale (max 10 quotes per RFQ), search runs synchronously on every keystroke without debouncing. With more than ~50 quotes (out of current scope), add debouncing (`useDeferredValue` or 150ms `setTimeout`).

### 5.U.7 Implementation location

| Module | Path | Responsibility |
|--------|------|----------------|
| Pattern detection + matching | `src/subapps/procurement/utils/quote-search.ts` (~80–120 lines, pure functions) | `detectPattern(query)`, `matchesQuote(quote, query)` |
| Search input + state | Inside `QuoteList` toolbar (existing search slot) | Reads/writes `?q=` URL param |

URL state for search query: `?q=<urlencoded>`. Uses `router.replace` (refining current view, no history clutter). Persists across tab switches and refresh, just like sort.

### 5.U.8 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.search.placeholder` | Αναζήτηση σε προσφορές... | Search quotes... |
| `rfqs.search.empty.title` | Δεν βρέθηκαν προσφορές με «{{query}}» | No quotes found for «{{query}}» |
| `rfqs.search.empty.suggestionsTitle` | Δοκίμασε να ψάξεις με: | Try searching by: |
| `rfqs.search.empty.suggestion.vendor` | Όνομα προμηθευτή (π.χ. Thermoland) | Vendor name (e.g. Thermoland) |
| `rfqs.search.empty.suggestion.quoteNumber` | Αριθμό προσφοράς (π.χ. Q-2026-0042) | Quote number (e.g. Q-2026-0042) |
| `rfqs.search.empty.suggestion.price` | Τιμή (π.χ. 12500) | Price (e.g. 12500) |

---

## 5.V Vendor Notifications — Manual Trigger with Templates

After award, the user manually triggers vendor notifications via a dedicated dialog. The system **never auto-sends** emails when status changes — this prevents accidents (e.g. award reverted within the §5.F undo window, but email already left). The user reviews and approves before any email is dispatched.

### 5.V.1 Trigger entry point

A primary CTA button appears in the comparison header banner (§5.F.6) after award is committed (transaction success, undo window passed):

```
✅ Νικητής: Vendor B — 13.200€    [📧 Ενημέρωσε προμηθευτές]   [Δημιουργία Παραγγελίας →]
```

Visibility rules:
- Hidden if no winner has been awarded yet
- Visible if a winner exists, regardless of whether emails have been sent before (allows re-send / corrections)
- After all vendors notified at least once, the button label changes to `📧 Ξανά ενημέρωση` («Re-notify»)

### 5.V.2 Dialog UX — vendor list + per-vendor template

Click → opens a modal dialog (`Sheet` or `Dialog` component, full-page on mobile, ~700px on desktop):

```
┌─ Ενημέρωση προμηθευτών ─────────────────────────────────────────┐
│                                                                  │
│ Επίλεξε ποιους θα ενημερώσεις και έλεγξε τα μηνύματα:           │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ ☑ Vendor B (νικητής)         🟢 Πρότυπο: Επιβεβαίωση       │  │
│ │   info@vendorB.gr             [Επεξεργασία μηνύματος ▾]    │  │
│ │   Last sent: never                                          │  │
│ │   ┌─ Preview ────────────────────────────────────────┐     │  │
│ │   │ Θέμα: Συγχαρητήρια — επιλεχθήκατε για το RFQ X   │     │  │
│ │   │ Σώμα: Σας ενημερώνουμε ότι... [editable]         │     │  │
│ │   └──────────────────────────────────────────────────┘     │  │
│ ├────────────────────────────────────────────────────────────┤  │
│ │ ☑ Vendor A                    🔴 Πρότυπο: Απόρριψη        │  │
│ │   contact@vendorA.gr          [Επεξεργασία μηνύματος ▾]   │  │
│ │   Last sent: 2026-04-25 14:30                              │  │
│ │   ┌─ Preview (collapsed) ─┐                                │  │
│ │   │ Θέμα: Ευχαριστούμε... │                                │  │
│ │   └───────────────────────┘                                │  │
│ ├────────────────────────────────────────────────────────────┤  │
│ │ ☐ Vendor C (already sent)     🔴 Πρότυπο: Απόρριψη        │  │
│ │   contact@vendorC.gr                                       │  │
│ │   Last sent: 2026-04-25 14:30  (μη ξανα-στείλεις)          │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                  [Ακύρωση]    [Αποστολή σε 2 προμηθευτές]       │
└──────────────────────────────────────────────────────────────────┘
```

**Per-row behavior:**

| Element | Description |
|---------|-------------|
| Checkbox | Enable/disable sending to this vendor; default checked unless already sent |
| Vendor info | Name + email (read-only here; edit in vendor module) |
| Template tag | Auto-detected: 🟢 Winner template if `accepted`, 🔴 Rejection template otherwise |
| Last sent | Timestamp of most recent send; «never» if first time. If already sent, the row is **default unchecked** to avoid spam |
| Edit message | Expandable — shows subject + body, both editable inline |
| Preview | Collapsed by default. Expanding shows the rendered preview with placeholders interpolated |

**Footer:**
- «Ακύρωση» — closes dialog, no emails sent
- «Αποστολή σε N προμηθευτές» — sends to checked vendors only; counter updates live

### 5.V.3 Templates — defaults + per-RFQ overrides

Two default templates ship with the system:

| Template | Trigger | Default subject | Default body (placeholders) |
|----------|---------|-----------------|------------------------------|
| `winner` | Quote status `accepted` | «Συγχαρητήρια — Επιλέχθηκε η προσφορά σας για [{{rfqTitle}}]» | Multi-paragraph thank-you + next steps + PO timing |
| `rejection` | Quote status `rejected` | «Ευχαριστούμε για την προσφορά σας στο [{{rfqTitle}}]» | Polite thank-you + indication that another supplier was chosen + invitation for future RFQs |

Placeholders supported in subject and body:
- `{{rfqTitle}}` — `rfq.title`
- `{{rfqNumber}}` — `rfq.displayNumber`
- `{{vendorName}}` — `vendor.name` from quote
- `{{quoteNumber}}` — `quote.displayNumber`
- `{{senderName}}` — current user's display name
- `{{companyName}}` — current company name from settings
- `{{date}}` — today, formatted per locale

**Storage of templates:**

| Layer | Path | Purpose |
|-------|------|---------|
| System defaults | `src/subapps/procurement/templates/vendorNotificationDefaults.ts` (~80 lines, pure data) | Hardcoded fallback in code |
| Company override | Firestore `companies/{companyId}/settings/vendorNotificationTemplates` | Editable in a settings page (out of scope here — future ADR) |
| Per-RFQ override | Firestore `rfqs/{rfqId}.notificationTemplates` (optional field) | If user edits the message inline, it persists at the RFQ level for re-sends |

For ADR-328: implement the system defaults + per-RFQ override only. Company-level overrides (settings page) defer to a future ADR.

### 5.V.4 Sending mechanism

**Phase A.0 verification step:** before implementing send, grep the codebase for existing outbound email service. The project already uses **Mailgun for inbound** (per ADR-070/071). Likely candidates:
- `src/services/email/` or similar
- `mailgun.send`, `sendEmail`, `sendOutboundEmail`
- API route `/api/email/send` or `/api/notifications/send`

| If found | Reuse — pass `to`, `subject`, `body`, optionally `replyTo` |
| If not found | Stop. Open ADR-332 (Outbound Email Service) before implementing this section. Do not build a one-off email sender. |

The implementation MUST go through a dedicated outbound service — not direct Mailgun API calls scattered in the procurement subapp. Single source of truth for outbound delivery + audit logging + rate limiting + bounce handling.

### 5.V.5 Audit trail

Every send creates an entry in the existing `EntityAuditService` (ADR-195) on the quote document:

```ts
{
  entity: 'quote',
  entityId: quoteId,
  action: 'vendor_notified',
  actor: currentUserId,
  timestamp: serverTimestamp(),
  metadata: {
    template: 'winner' | 'rejection',
    subject: '<final subject after interpolation>',
    recipientEmail: 'info@vendor.gr',
    customized: true | false,  // true if user edited the default
  },
}
```

This populates the §5.I.3 / §5.R History side panel automatically (when that ADR ships).

### 5.V.6 Sent indicator on quote rows

Once a vendor has been notified at least once for this RFQ's outcome, surface a small badge in `QuoteListCard`:

```
🏪 Vendor A
   12.500€ — rejected
   ✉️ Ενημερώθηκε στις 25/4 14:30
```

| Indicator | When |
|-----------|------|
| (none) | Vendor never notified for current outcome |
| ✉️ + timestamp | Vendor notified for current outcome |
| ✉️⚠️ | Notified, then status changed (e.g. award reverted) — re-notification recommended |

The «✉️⚠️» state is detected by comparing the most recent `vendor_notified` audit entry's `template` field with the current quote status.

### 5.V.7 Failure handling

If the send fails (Mailgun error, invalid email, timeout):
- The optimistic dialog state stays open — does NOT auto-close
- Per-row status indicator: ✅ sent / ⏳ sending / ❌ failed (tooltip with error)
- Failed rows can be retried individually
- Successful rows are not re-sent on retry (idempotency)

### 5.V.8 What this ADR includes vs what's deferred

| Item | This ADR (ADR-328) | Future ADR |
|------|---------------------|------------|
| Trigger button in comparison banner | ✅ | — |
| Dialog with vendor list + checkboxes | ✅ | — |
| 2 default templates (winner + rejection) | ✅ | — |
| Inline edit per vendor | ✅ | — |
| Per-RFQ template override storage | ✅ | — |
| Send via existing outbound service | ✅ (if service exists) | ⚠️ Open ADR-332 if missing |
| Audit trail entries | ✅ | — |
| Sent indicator on quote rows | ✅ | — |
| Company-level template settings page | ❌ | Future ADR (settings UI) |
| Multi-language template selection per vendor | ❌ | Future ADR |
| Email open / click tracking pixels | ❌ | Future ADR |
| Bulk send across multiple RFQs | ❌ | Future ADR |

### 5.V.9 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.notify.triggerButton` | Ενημέρωσε προμηθευτές | Notify vendors |
| `rfqs.notify.triggerButtonResend` | Ξανά ενημέρωση | Re-notify |
| `rfqs.notify.dialog.title` | Ενημέρωση προμηθευτών | Notify vendors |
| `rfqs.notify.dialog.subtitle` | Επίλεξε ποιους θα ενημερώσεις και έλεγξε τα μηνύματα. | Choose recipients and review the messages. |
| `rfqs.notify.template.winner` | Πρότυπο: Επιβεβαίωση | Template: Confirmation |
| `rfqs.notify.template.rejection` | Πρότυπο: Απόρριψη | Template: Rejection |
| `rfqs.notify.editMessage` | Επεξεργασία μηνύματος | Edit message |
| `rfqs.notify.lastSent` | Τελευταία αποστολή: {{date}} | Last sent: {{date}} |
| `rfqs.notify.lastSent.never` | Καμία προηγούμενη αποστολή | Never sent |
| `rfqs.notify.alreadySent` | (μη ξανα-στείλεις) | (don't re-send) |
| `rfqs.notify.cancelButton` | Ακύρωση | Cancel |
| `rfqs.notify.sendButton` | Αποστολή σε {{count}} προμηθευτές | Send to {{count}} vendors |
| `rfqs.notify.sendStatus.sending` | Αποστολή... | Sending... |
| `rfqs.notify.sendStatus.success` | Στάλθηκε | Sent |
| `rfqs.notify.sendStatus.failed` | Αποτυχία αποστολής | Send failed |
| `rfqs.notify.sentBadge` | Ενημερώθηκε στις {{date}} | Notified on {{date}} |
| `rfqs.notify.staleBadgeTooltip` | Ο νικητής άλλαξε μετά την προηγούμενη ενημέρωση — ίσως χρειάζεται νέα αποστολή | Winner changed since last notification — re-notification may be needed |
| `rfqs.notify.template.winner.subject` | Συγχαρητήρια — επιλέχθηκε η προσφορά σας για {{rfqTitle}} | Congratulations — your quote was selected for {{rfqTitle}} |
| `rfqs.notify.template.rejection.subject` | Ευχαριστούμε για την προσφορά σας στο {{rfqTitle}} | Thank you for your quote on {{rfqTitle}} |

---

## 5.W Filtering Strategy — Quick Filters + Smart Search Only

At the §5.N scale (3-5 typical, max 10 quotes per RFQ), an `AdvancedFiltersPanel` is overkill. Two existing mechanisms cover all realistic filtering needs:

### 5.W.1 Layer 1 — `QuoteStatusQuickFilters` (already in `QuoteList`)

Status chips at the top of the list:

```
[Όλες (5)]  [Submitted (1)]  [Under review (2)]  [Accepted (1)]  [Rejected (1)]
```

| Chip | Filter |
|------|--------|
| Όλες | No filter |
| Submitted | `status === 'submitted'` |
| Under review | `status === 'under_review'` |
| Accepted | `status === 'accepted'` |
| Rejected | `status === 'rejected'` |
| Expired | `isExpired(quote)` derived per §5.BB — only shown if any expired exist (chip is independent of `status`) |

URL state: `?status=<value>`. Default (no filter) omits the param. Uses `router.replace`.

### 5.W.2 Layer 2 — Smart search (§5.U)

The pattern-aware search box covers ad-hoc filtering:

| Filter need | How smart search handles it |
|-------------|------------------------------|
| Price range | Type a number (e.g. `12500`) → matches that price |
| Vendor | Type vendor name (free text) |
| Quote number | Type `Q-2026-0042` |
| Date submitted | Type `15/04/2026` |
| Line content | Type any term (e.g. `boiler`) → searches line descriptions |

For the rare case where a user wants "all quotes under 12.000€" specifically, they can:
1. Sort by price ASC (§5.P)
2. Visually scan — at 10 max items, this is instant

Or in a future iteration:
3. Add range syntax to smart search (e.g. `<12000`, `>=10000`) — small extension, not in this ADR

### 5.W.3 What is NOT in scope

| Feature | Status |
|---------|--------|
| `AdvancedFiltersPanel` for quotes | ❌ Removed from §4 — covered by quick filters + smart search |
| Date range filter | ❌ Not needed at current scale |
| Multi-select vendor filter | ❌ Not needed at current scale |
| Saved filter presets | ❌ Out of scope; future ADR if requested |
| Filter combination operators (AND/OR/NOT) | ❌ Not needed at current scale |

### 5.W.4 Future scale revisit

If §5.N scale assumptions break (e.g. RFQs start having 50+ quotes), revisit by adding `AdvancedFiltersPanel` in a future ADR with `rfqQuoteFiltersConfig`. The component (`@/components/core/AdvancedFilters`) already exists and is used elsewhere — adoption would be straightforward when the need is real.

Until then, **no premature filter complexity**. The §5.U smart search already handles 95% of search-style filtering at zero additional cost.

### 5.W.5 i18n keys

No new keys for this section — `QuoteStatusQuickFilters` already has its translations from existing implementation. If any are missing, they should be added under `rfqs.statusFilters.*` during Phase A.0 audit.

---

## 5.X Award Reason Capture (required only when not the cheapest)

When the user awards a winner, capture WHY — but only when the choice is non-obvious. This focuses friction where it has audit value (deviating from the cheapest bid) and avoids friction where the rationale is self-evident (lowest bid wins).

### 5.X.1 Conditional friction model

| Award scenario | Friction |
|----------------|----------|
| Selected quote has the lowest `totals.netTotal` among non-rejected/non-draft quotes | ❌ Zero — optimistic + Undo as in §5.F |
| Selected quote is **not** the cheapest | ✅ Brief modal: required category + optional free text → optimistic + Undo |

This is a **context-capture dialog** (asking "why?"), not a confirmation dialog (asking "are you sure?"). Material 3 distinguishes the two — the §5.F prohibition on confirmation dialogs for reversible actions does not apply here.

### 5.X.2 «Cheapest» definition (naive, scoped to this ADR)

```ts
function isCheapestSubmitted(targetQuote: Quote, quotes: Quote[]): boolean {
  const eligible = quotes.filter(q =>
    q.status !== 'rejected' &&
    q.status !== 'draft' &&
    typeof q.totals?.netTotal === 'number'
  );
  if (eligible.length <= 1) return true; // single quote = nothing to compare
  const minNet = Math.min(...eligible.map(q => q.totals.netTotal));
  return targetQuote.totals?.netTotal === minNet;
}
```

**Limitations of this naive definition:**
- Does not account for `vatIncluded` / `laborIncluded` flags (raw vs normalized comparison)
- Does not include shipping, installation, or lifecycle costs
- May classify a quote as "cheapest" when, after normalization, it is actually more expensive

These limitations are intentional for ADR-328 simplicity. ADR-331 (Construction-Grade Comparison) will refine this to normalized TCO. Until then, the implementer must add a code comment at the helper noting the naive nature so future-implementers know the dependency.

### 5.X.3 Reason categories (predefined)

| Category | Greek label | English label |
|----------|-------------|---------------|
| `better_delivery` | Καλύτερη παράδοση | Better delivery time |
| `better_quality` | Καλύτερη ποιότητα / Brand reputation | Better quality / Brand reputation |
| `existing_relationship` | Συμβατική σχέση / Συνεργασία | Existing relationship / Partnership |
| `certifications` | Πιστοποιήσεις (CE, ISO, κλπ.) | Certifications (CE, ISO, etc.) |
| `inclusions` | Inclusions (περιλαμβάνει εργασία/μεταφορά) | Inclusions (includes labor/shipping) |
| `stock_availability` | Διαθεσιμότητα stock | Stock availability |
| `past_consistency` | Συνέπεια προηγούμενων συνεργασιών | Past performance reliability |
| `other` | Άλλο (παρακαλώ εξήγησε) | Other (please explain) |

If `other` is selected → free-text explanation becomes **required**.

### 5.X.4 Modal UX

```
┌─ Λόγος επιλογής νικητή ────────────────────────────────────┐
│                                                             │
│ Επιλέγεις τον {{vendorName}} ({{selectedTotal}}) αντί      │
│ του φθηνότερου {{cheapestVendorName}} ({{cheapestTotal}}). │
│                                                             │
│ Λόγος: [▾ Καλύτερη παράδοση                              ]  │
│                                                             │
│ Επεξήγηση (προαιρετικά):                                    │
│ ┌─────────────────────────────────────────────────────┐    │
│ │                                                      │    │
│ │                                                      │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│                  [Ακύρωση]   [Επιβεβαίωση Νικητή]          │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Cancel closes dialog, no award executed
- Confirm runs the §5.F optimistic-update + Undo flow with the captured reason embedded
- Selected category auto-suggests free-text placeholder (e.g. for `better_delivery`: «π.χ. 15 ημ. vs 30 ημ., εντός project schedule»)
- If `other` is selected and free-text is empty → confirm button disabled with tooltip «Συμπλήρωσε επεξήγηση»

### 5.X.5 Persistence

Two storage layers:

**Layer 1 — On the quote document (queryable):**

```ts
// quote document fields (added by award)
{
  // ... existing fields
  awardedReason: 'better_delivery' | 'better_quality' | ... | null,
  awardedReasonNote: string | null,  // free-text explanation
  awardedAt: Timestamp,
  awardedBy: string,                  // user ID
}
```

If the quote is the cheapest and award was zero-friction, `awardedReason = null`, `awardedReasonNote = null`. The fact of being cheapest is itself the implicit reason and queryable from the totals.

**Layer 2 — Audit trail (immutable history):**

`EntityAuditService.recordChange()` creates an entry per ADR-195:

```ts
{
  entity: 'quote',
  entityId: quoteId,
  action: 'awarded',
  actor: currentUserId,
  timestamp: serverTimestamp(),
  metadata: {
    reasonCategory: 'better_delivery' | null,
    reasonNote: string | null,
    selectedTotal: 13200,
    cheapestTotal: 11800,
    cheapestVendorName: 'Vendor D',
    wasCheapest: false,
  },
}
```

Both layers update in the same transaction as the award itself (§5.J optimistic locking).

### 5.X.6 Edit reason later

Capability: the reason can be edited after award without re-awarding. Useful when:
- User awarded quickly and wants to add justification later
- A new requirement (audit, partner question) makes the reason worth capturing retroactively

UX: in the History side panel (§5.R, future ADR-330), each `awarded` entry exposes an «Επεξεργασία λόγου» action. Edit creates a **new** audit entry (`action: 'reason_modified'`) — the original entry is **never** mutated, preserving the audit trail integrity required by ADR-195.

In ADR-328 itself, the edit-reason action is documented but **wired to a placeholder** (similar to §5.R Comments/History buttons). Real implementation lands with ADR-330.

### 5.X.7 Display of reason

Where the reason surfaces in the UI:

| Location | What's shown |
|----------|--------------|
| Comparison header banner (§5.F.6) | «✅ Νικητής: Vendor B — 13.200€ — Λόγος: Καλύτερη παράδοση» |
| Quote header (§5.I) on accepted quote | Subtle badge/chip with reason category |
| History side panel (§5.R / ADR-330) | Full entry: category + note + actor + time |
| Audit log export (compliance) | All metadata |

For ADR-328 implementation: surface the reason in the comparison header banner only. The other surfaces land with their respective future ADRs.

### 5.X.8 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.awardReason.dialog.title` | Λόγος επιλογής νικητή | Award rationale |
| `rfqs.awardReason.dialog.body` | Επιλέγεις τον {{vendorName}} ({{selectedTotal}}) αντί του φθηνότερου {{cheapestVendorName}} ({{cheapestTotal}}). | You are awarding {{vendorName}} ({{selectedTotal}}) instead of the cheapest {{cheapestVendorName}} ({{cheapestTotal}}). |
| `rfqs.awardReason.label.category` | Λόγος | Reason |
| `rfqs.awardReason.label.note` | Επεξήγηση (προαιρετικά) | Explanation (optional) |
| `rfqs.awardReason.label.noteRequired` | Επεξήγηση (απαιτείται) | Explanation (required) |
| `rfqs.awardReason.placeholder.note.delivery` | π.χ. 15 ημ. vs 30 ημ., εντός project schedule | e.g. 15 days vs 30 days, fits project schedule |
| `rfqs.awardReason.placeholder.note.quality` | π.χ. premium brand, καλύτερη antifouling περφόρμανς | e.g. premium brand, superior antifouling performance |
| `rfqs.awardReason.placeholder.note.relationship` | π.χ. 5+ έτη συνεργασίας, αξιόπιστη παράδοση | e.g. 5+ years partnership, reliable delivery |
| `rfqs.awardReason.placeholder.note.certifications` | π.χ. CE Mark + ISO 9001 vs ανταγωνιστές χωρίς | e.g. CE Mark + ISO 9001, competitors without |
| `rfqs.awardReason.placeholder.note.inclusions` | π.χ. περιλαμβάνει εγκατάσταση και 2 ώρες εκπαίδευση | e.g. includes installation and 2 hours training |
| `rfqs.awardReason.placeholder.note.stock` | π.χ. immediate availability vs 6 εβδομάδες lead time | e.g. immediate availability vs 6 weeks lead time |
| `rfqs.awardReason.placeholder.note.consistency` | π.χ. zero defects σε προηγούμενα 3 έργα | e.g. zero defects across previous 3 projects |
| `rfqs.awardReason.placeholder.note.other` | Παρακαλώ εξήγησε τον λόγο της επιλογής | Please explain the reason for the choice |
| `rfqs.awardReason.category.better_delivery` | Καλύτερη παράδοση | Better delivery time |
| `rfqs.awardReason.category.better_quality` | Καλύτερη ποιότητα / Brand reputation | Better quality / Brand reputation |
| `rfqs.awardReason.category.existing_relationship` | Συμβατική σχέση / Συνεργασία | Existing relationship / Partnership |
| `rfqs.awardReason.category.certifications` | Πιστοποιήσεις (CE, ISO, κλπ.) | Certifications (CE, ISO, etc.) |
| `rfqs.awardReason.category.inclusions` | Inclusions (περιλαμβάνει εργασία/μεταφορά) | Inclusions (includes labor/shipping) |
| `rfqs.awardReason.category.stock_availability` | Διαθεσιμότητα stock | Stock availability |
| `rfqs.awardReason.category.past_consistency` | Συνέπεια προηγούμενων συνεργασιών | Past performance reliability |
| `rfqs.awardReason.category.other` | Άλλο (παρακαλώ εξήγησε) | Other (please explain) |
| `rfqs.awardReason.cancelButton` | Ακύρωση | Cancel |
| `rfqs.awardReason.confirmButton` | Επιβεβαίωση Νικητή | Confirm Winner |
| `rfqs.awardReason.confirmDisabledTooltip` | Συμπλήρωσε επεξήγηση | Fill in the explanation |
| `rfqs.award.bannerWithReason` | Νικητής: {{vendor}} — {{total}} — Λόγος: {{reasonLabel}} | Winner: {{vendor}} — {{total}} — Reason: {{reasonLabel}} |

---

## 5.Y Vendor Invite Send Dialog (Multi-select + Suggested + Ad-hoc)

The «Νέα Πρόσκληση» action opens a dialog that supports multi-select from contacts, RFQ-category-based suggestions, and ad-hoc emails for vendors not yet in the contacts module. Existing `VendorInviteSection` is extended (not forked) — Phase A.0 audit determines current capabilities before extension.

### 5.Y.1 Phase A.0 audit

Before implementation, read the existing `VendorInviteSection` and document:
- Does it already have a multi-select dialog?
- Does it use the contacts module for vendor lookup?
- How does it currently send invites (which service, which API endpoint)?
- What audit entries does it write?

Outcomes:
| Existing state | Action |
|----------------|--------|
| Already multi-select with contacts integration | Extend with §5.Y.3 suggestions + §5.Y.4 ad-hoc |
| Single-vendor only | Replace dialog component, keep server send logic |
| No dialog (different UX) | Build dialog per spec, reuse server send logic if possible |

Do NOT replace working server-side send logic without good reason.

### 5.Y.2 Dialog layout

```
┌─ Στείλε πρόσκληση για: «{{rfqTitle}}» ──────────────────────┐
│                                                              │
│ 🔍 [Αναζήτηση προμηθευτή...........................]         │
│                                                              │
│ ┌─ ⭐ Προτεινόμενοι ({{n}}) ────────────────────────┐        │
│ │ ☑ Vendor A (ξυλουργεία)  ✉️ Last: 25/3            │        │
│ │ ☑ Vendor B (πόρτες)      ✉️ Last: 12/4            │        │
│ │ ☐ Vendor C (ξυλουργεία)  ✉️ Never                 │        │
│ └────────────────────────────────────────────────────┘        │
│                                                              │
│ ┌─ Όλοι οι προμηθευτές ({{n}}) ─────────────────────┐        │
│ │ ☐ Vendor D (παράθυρα)                             │        │
│ │ ☐ Vendor E                                         │        │
│ │ ... (scrollable, alphabetical)                     │        │
│ └────────────────────────────────────────────────────┘        │
│                                                              │
│ ┌─ Πρόσθεσε email απευθείας ────────────────────────┐        │
│ │ [contact@newvendor.gr.................] [+ Προσθήκη]│       │
│ │ ☑ Δημιουργία νέου contact με αυτό το email         │        │
│ └────────────────────────────────────────────────────┘        │
│                                                              │
│ ─── Μήνυμα ──────────────────────────────────────────         │
│ Θέμα: [Πρόσκληση για προσφορά: {{rfqTitle}}.........]         │
│ ┌─────────────────────────────────────────────────────┐      │
│ │ Αγαπητέ {{vendorName}},                              │      │
│ │ Σας προσκαλούμε να υποβάλετε προσφορά για το έργο   │      │
│ │ {{rfqTitle}}. Προθεσμία απάντησης: {{deadline}}.    │      │
│ │                                                      │      │
│ │ Με εκτίμηση,                                          │      │
│ │ {{senderName}}                                        │      │
│ └─────────────────────────────────────────────────────┘       │
│                                                              │
│ Προθεσμία απάντησης: [📅 5 ημέρες ▾]   ☑ Στείλε cc σε εμένα  │
│                                                              │
│       [Ακύρωση]   [Στείλε σε {{count}} προμηθευτές]          │
└──────────────────────────────────────────────────────────────┘
```

### 5.Y.3 Suggested vendors logic — graceful degradation

```ts
interface VendorBucket {
  suggested: Contact[];
  others: Contact[];
}

function rankVendors(rfq: RFQ, allVendors: Contact[]): VendorBucket {
  // Exclude already-invited for THIS RFQ
  const eligible = allVendors.filter(
    v => !alreadyInvitedForThisRfq(v.id, rfq.id)
  );

  // If RFQ has a category and contacts have tags, surface matches
  if (rfq.category && eligible.some(v => v.tags?.length)) {
    const matches = eligible.filter(
      v => v.tags?.some(tag => tagMatchesCategory(tag, rfq.category))
    );
    return {
      suggested: matches.sort(byLastInvitedThenName),
      others: eligible
        .filter(v => !matches.includes(v))
        .sort(byName),
    };
  }

  // Fallback: no categorization data → flat alphabetical list
  return {
    suggested: [],
    others: eligible.sort(byName),
  };
}
```

When `suggested` is empty, the «Προτεινόμενοι» section is **not rendered** — only the «Όλοι» section remains. No empty state, no «no suggestions» message. Clean fallback.

### 5.Y.4 Already-invited exclusion

Vendors with an active invite for the **current** RFQ (`status: 'pending' | 'sent' | 'opened'`) are filtered out before bucketing. A subtle banner above the search shows:

```
ℹ️ {{count}} προμηθευτές έχουν ήδη προσκληθεί για αυτό το RFQ. [Δες προσκλήσεις]
```

«Δες προσκλήσεις» → switches to Tab Setup (`router.push` with `?tab=setup`).

### 5.Y.5 Ad-hoc email field

| Element | Behavior |
|---------|----------|
| Email input | Validates format on blur and on Add. Invalid → red border + tooltip «Μη έγκυρο email» |
| «+ Προσθήκη» button | Adds the email to the selected list as an ad-hoc entry. Clears the input. Disabled if email empty or invalid. |
| Auto-create contact checkbox | Default **checked**. When checked, on send a draft contact is created in Firestore with the email + minimal metadata (`name: email`, `source: 'rfq_invite'`). User can fill details later in contacts module. When unchecked, send is purely transient — no contact persists. |

Multiple ad-hoc emails can be added. They appear in a separate «Ad-hoc» mini-list above the message editor:

```
┌─ Ad-hoc invitees (2) ────────────────────────────┐
│ ✉️ contact@newvendor.gr             [×]           │
│ ✉️ sales@anothervendor.com          [×]           │
└──────────────────────────────────────────────────┘
```

### 5.Y.6 Personalization — single template, per-vendor send

The user writes **one** message. The system sends **N** emails, each with placeholders interpolated for that specific vendor:

| Placeholder | Source |
|-------------|--------|
| `{{vendorName}}` | Contact's name OR ad-hoc email's local-part formatted |
| `{{rfqTitle}}` | `rfq.title` |
| `{{rfqNumber}}` | `rfq.displayNumber` |
| `{{senderName}}` | Current user's display name |
| `{{companyName}}` | Current company name |
| `{{deadline}}` | Selected deadline date, formatted per locale |
| `{{inviteLink}}` | Tokenized link to vendor portal where they submit a quote (token via existing `vendor-invite-token` service if it exists; verify in Phase A.0) |

Each vendor receives a separate email — **never BCC list**. Vendors must not see each other's identities (competitive concern).

### 5.Y.7 Deadline picker

Quick presets in dropdown:

| Preset | Days from today |
|--------|------------------|
| 3 ημέρες | +3 |
| 5 ημέρες (default) | +5 |
| 7 ημέρες | +7 |
| 14 ημέρες | +14 |
| Custom... | Opens date picker |

Default: 5 days. Computed at dialog open time. Shown formatted: «Παρασκευή 4 Μαΐου 2026».

If RFQ already has a `deadline` field set at creation, use it as default and pre-select the matching preset (or «Custom» if it doesn't match).

### 5.Y.8 Validation before send

| Check | Failure UX |
|-------|------------|
| At least 1 invitee (contact or ad-hoc) | «Στείλε σε...» button disabled |
| All ad-hoc emails are valid format | Red border on invalid entries; cannot add malformed email |
| Subject not empty | Subject field red border + tooltip |
| Body not empty | Body textarea red border + tooltip |
| Deadline is in the future | Date picker red border + tooltip |

### 5.Y.9 Send mechanism

Phase A.0: identify the existing send service (likely the same outbound email service mentioned in §5.V.4). If exists, reuse. If not, ADR-332 (Outbound Email Service) is a hard prerequisite.

Send flow:
1. Client builds N email payloads (one per recipient with interpolated placeholders)
2. Server endpoint receives the batch + creates `vendor_invites` Firestore documents (status: `pending`)
3. Server kicks off Mailgun send for each recipient asynchronously
4. Mailgun delivery webhook updates each invite document's status (`sent`, `delivered`, `opened`, `bounced`)
5. Client sees status updates via `onSnapshot` on `vendor_invites` collection (per §5.J real-time view)

### 5.Y.10 Audit trail

One audit entry per recipient via `EntityAuditService`:

```ts
{
  entity: 'rfq',
  entityId: rfqId,
  action: 'vendor_invited',
  actor: currentUserId,
  timestamp: serverTimestamp(),
  metadata: {
    vendorContactId: contactId | null,    // null for ad-hoc
    vendorEmail: email,
    inviteId: '...',                       // ID of created vendor_invite doc
    isAdHoc: boolean,
    deadlineDays: 3 | 5 | 7 | 14 | null,
    customMessage: boolean,                // true if subject/body differ from defaults
  },
}
```

### 5.Y.11 Mobile

Full-screen modal:
- Sections stack vertically (no side-by-side)
- Suggested + Others combined into one scrollable list with «⭐» icon prefix on suggested rows
- Ad-hoc field below list
- Message editor below ad-hoc
- Send button sticky at bottom

### 5.Y.12 Out of scope (potential future ADRs)

| Item | Status |
|------|--------|
| Per-recipient custom message (5 different bodies) | Not needed at scale §5.N |
| Attachment support (PDF specs) | Future ADR — needs storage upload integration |
| Reminder scheduling («στείλε υπενθύμιση 2 ημέρες πριν deadline») | Future ADR (Notifications module) |
| RFQ specs auto-attached as PDF | Future ADR |
| Vendor portal authentication (passwordless link) | Should already exist — verify in Phase A.0 |

### 5.Y.13 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.invite.dialog.title` | Στείλε πρόσκληση για: «{{rfqTitle}}» | Send invite for: «{{rfqTitle}}» |
| `rfqs.invite.search.placeholder` | Αναζήτηση προμηθευτή... | Search vendor... |
| `rfqs.invite.section.suggested` | ⭐ Προτεινόμενοι | ⭐ Suggested |
| `rfqs.invite.section.allVendors` | Όλοι οι προμηθευτές | All vendors |
| `rfqs.invite.section.adHoc` | Πρόσθεσε email απευθείας | Add email directly |
| `rfqs.invite.section.adHocList` | Ad-hoc invitees ({{count}}) | Ad-hoc invitees ({{count}}) |
| `rfqs.invite.adHoc.placeholder` | contact@vendor.gr | contact@vendor.gr |
| `rfqs.invite.adHoc.addButton` | Προσθήκη | Add |
| `rfqs.invite.adHoc.createContact` | Δημιουργία νέου contact με αυτό το email | Create new contact with this email |
| `rfqs.invite.adHoc.invalid` | Μη έγκυρο email | Invalid email |
| `rfqs.invite.lastInvited` | ✉️ Last: {{date}} | ✉️ Last: {{date}} |
| `rfqs.invite.lastInvited.never` | ✉️ Never | ✉️ Never |
| `rfqs.invite.alreadyInvitedBanner` | {{count}} προμηθευτές έχουν ήδη προσκληθεί για αυτό το RFQ. | {{count}} vendors already invited for this RFQ. |
| `rfqs.invite.alreadyInvitedAction` | Δες προσκλήσεις | View invites |
| `rfqs.invite.subject.label` | Θέμα | Subject |
| `rfqs.invite.subject.default` | Πρόσκληση για προσφορά: {{rfqTitle}} | Quote invitation: {{rfqTitle}} |
| `rfqs.invite.body.label` | Μήνυμα | Message |
| `rfqs.invite.body.default` | Αγαπητέ {{vendorName}},\n\nΣας προσκαλούμε να υποβάλετε προσφορά για το έργο {{rfqTitle}}.\nΠροθεσμία απάντησης: {{deadline}}.\n\nΜε εκτίμηση,\n{{senderName}} | Dear {{vendorName}},\n\nWe invite you to submit a quote for {{rfqTitle}}.\nResponse deadline: {{deadline}}.\n\nKind regards,\n{{senderName}} |
| `rfqs.invite.deadline.label` | Προθεσμία απάντησης | Response deadline |
| `rfqs.invite.deadline.preset.3` | 3 ημέρες | 3 days |
| `rfqs.invite.deadline.preset.5` | 5 ημέρες | 5 days |
| `rfqs.invite.deadline.preset.7` | 7 ημέρες | 7 days |
| `rfqs.invite.deadline.preset.14` | 14 ημέρες | 14 days |
| `rfqs.invite.deadline.custom` | Custom... | Custom... |
| `rfqs.invite.cc` | Στείλε αντίγραφο σε εμένα (cc) | Send a copy to me (cc) |
| `rfqs.invite.cancelButton` | Ακύρωση | Cancel |
| `rfqs.invite.sendButton` | Στείλε σε {{count}} προμηθευτές | Send to {{count}} vendors |
| `rfqs.invite.sendButton.singular` | Στείλε σε {{count}} προμηθευτή | Send to {{count}} vendor |
| `rfqs.invite.send.success` | Στάλθηκαν {{count}} προσκλήσεις | {{count}} invites sent |
| `rfqs.invite.send.partialFailure` | Στάλθηκαν {{success}} από {{total}} — {{failed}} απέτυχαν | Sent {{success}} of {{total}} — {{failed}} failed |

---

## 5.Z Form Validation Rules — Hard Errors vs Soft Warnings

Edit forms for RFQ lines and quote lines distinguish between **hard errors** (block save — system-breaking) and **soft warnings** (inform but allow override — business-suspicious but legitimate). This avoids the trap of strict validation blocking legitimate edge cases (vendor offered 8 instead of 10, vendor's stated total has rounding diff, discount lines with negative values).

### 5.Z.1 Hard errors (block save)

| Field | Rule | Error key |
|-------|------|-----------|
| `description` | Required, length ≥ 1 | `rfqs.lineEdit.error.descriptionRequired` |
| `quantity` | Required, ≥ 0, numeric, max 4 decimals | `rfqs.lineEdit.error.quantityInvalid` |
| `unit` | Required, from predefined list (§5.Z.5) or non-empty custom | `rfqs.lineEdit.error.unitRequired` |
| `unitPrice` | Numeric (may be negative for discount lines), max 6 decimals | `rfqs.lineEdit.error.priceInvalid` |
| `vatRate` (only if `vatIncluded === false`) | Required, ∈ {0, 6, 13, 24} (Greek VAT rates) | `rfqs.lineEdit.error.vatRateRequired` |

Hard errors render inline (red text below field) and disable the «Σώσε» button. Save button shows tooltip with first error message on hover.

### 5.Z.2 Soft warnings (inform, allow override)

| Check | Trigger | Warning key |
|-------|---------|-------------|
| `total ≠ qty × unitPrice` (tolerance ±0.01€) | User overrode auto-calc OR manual `total` differs | `rfqs.lineEdit.warning.totalMismatch` |
| Quote line `quantity` ≠ corresponding RFQ line `quantity` | Quote review/edit context | `rfqs.lineEdit.warning.quantityMismatch` |
| `Σ(line.total) ≠ grandTotal` (tolerance ±0.01€) | Quote save | `rfqs.quoteEdit.warning.linesSumMismatch` |
| Negative `unitPrice` | `unitPrice < 0` | `rfqs.lineEdit.warning.negativePrice` |
| `quantity === 0` AND `unitPrice > 0` | `qty === 0 && unitPrice > 0` | `rfqs.lineEdit.warning.zeroQuantityWithPrice` |

Warnings render in a yellow banner above the save button. Save button is **enabled** but shows a confirmation:

```
┌─ ⚠️ Προσοχή ─────────────────────────────────────┐
│ Άθροισμα γραμμών (1.190,00 €) δεν ταιριάζει     │
│ με το συνολικό ποσό που έγραψε ο vendor          │
│ (1.200,00 €). Διαφορά: 10,00 €                   │
│                                                  │
│ [Διόρθωση]   [Σώσε ούτως ή άλλως]                │
└──────────────────────────────────────────────────┘
```

«Σώσε ούτως ή άλλως» persists the value as-is and adds an `inconsistencies` flag to the document audit metadata for future traceability.

### 5.Z.3 Auto-calculated total with explicit override

```
┌─ Γραμμή ─────────────────────────────────────────┐
│ Περιγραφή: [Πόρτα ξύλινη οξιάς             ]    │
│ Ποσότητα: [10]    Μονάδα: [τμχ ▾]               │
│ Τιμή μονάδας: [120.00] €                         │
│ Σύνολο: 1.200,00 €    [🔒 Auto] [✏️ Override]   │
└──────────────────────────────────────────────────┘
```

| Mode | Behavior |
|------|----------|
| 🔒 Auto (default) | `total` is read-only, computed live as `qty × unitPrice` |
| ✏️ Override | `total` becomes editable. Inline warning if differs from `qty × unitPrice` (per §5.Z.2). User explicitly opts in to record the vendor's stated value. |

The override toggle is a discoverable affordance — not hidden in a menu. Most users will never need it; those who do, find it immediately.

### 5.Z.4 Inconsistency tracking — audit metadata

When a save proceeds despite warnings, the document's audit entry includes:

```ts
{
  // ... existing audit fields
  metadata: {
    inconsistencies: [
      'totals_mismatch',        // line.total ≠ qty × unitPrice
      'lines_sum_mismatch',     // Σ(lines) ≠ grandTotal
      'quantity_mismatch',      // quote qty ≠ rfq qty
      // ... etc
    ],
    inconsistencyDetails: {
      // optional structured details — e.g.:
      // totalsMismatchAmount: 10.00,
      // requestedQuantity: 10,
      // offeredQuantity: 8,
    },
  },
}
```

Surfaces in the History side panel (§5.R / future ADR-330) so future readers know the user consciously accepted the deviation.

### 5.Z.5 Predefined units

```ts
// src/subapps/procurement/utils/units.ts
export const UNITS = [
  'τμχ', 'm', 'm²', 'm³', 'kg', 'g', 'l', 'ml',
  'ώρα', 'ημέρα', 'μήνας',
  'σετ', 'ζεύγος', 'πακέτο', 'ρολό', 'παλέτα',
] as const;
```

The dropdown displays these + a final option «Άλλο...» that opens a free-text input. Custom units saved within the project surface as additional dropdown options for that project.

Phase A.0: search the codebase for any existing units list (likely `units.ts`, `measurement-units.ts`, `UNIT_OF_MEASURE`). If exists and complete, **reuse**. If exists but missing entries, extend in place. Do NOT fork.

### 5.Z.6 Greek decimal parsing/formatting

User input is normalized on save; display is always Greek-formatted.

**Parse helper** (idempotent — handles all common forms):

```ts
function parseGreekDecimal(input: string): number | null {
  const cleaned = String(input ?? '').replace(/[€\s]/g, '').trim();
  if (cleaned === '') return null;

  // Both . and , present: assume . = thousands sep, , = decimal sep (Greek)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  // Only , present: assume decimal (Greek style: 12,50)
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return Number(cleaned.replace(',', '.'));
  }
  // Only . or neither: standard JS parsing
  return Number(cleaned);
}
```

**Format helper** (display):

```ts
function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
```

**Phase A.0 SSOT check:** the project likely already has helpers like `formatCurrency`, `formatEuro`, `parseLocaleNumber`. Grep first. If found, reuse. If naming clashes or duplication exists, this is also good documentation of an SSOT cleanup opportunity for a future ADR (not in scope here).

### 5.Z.7 Validation library

Phase A.0 search:
- `import.*zod` — Zod schemas already used?
- `import.*yup` — Yup schemas?
- `useForm` from `react-hook-form`?

| Found | Approach |
|-------|----------|
| Zod (most likely in this codebase) | Define `LineSchema = z.object({ description: z.string().min(1), ... })`. Errors map directly to per-field UI. |
| react-hook-form + zod | Use `zodResolver` for binding |
| Neither | Manual validation in a `validateLine(line)` function returning `{errors: {field: msg}, warnings: {check: msg}}`. Adequate for this scope. |

Do NOT introduce a new validation library if one already exists.

### 5.Z.8 Where this validation lives

| File | Responsibility |
|------|----------------|
| `src/subapps/procurement/utils/line-validation.ts` (~120-150 lines) | Pure validation: `validateLine(line, context)` returning errors + warnings |
| `src/subapps/procurement/utils/quote-validation.ts` (~80-100 lines) | Quote-level checks: lines-sum vs grandTotal, etc. |
| Edit dialog component | Calls validators on field change + on save attempt |

Pure functions are unit-testable in isolation. Do NOT inline validation logic inside JSX.

### 5.Z.9 Out of scope (potential future work)

| Item | Status |
|------|--------|
| Multi-currency support (USD, GBP) | Out — project is Greek market |
| Custom VAT rates (e.g. island reduced rate 17%) | Out — current 4 rates cover mainland |
| Schema-level validation (Firestore security rules) | ⚠️ Already enforced by tier 3 of CHECK 3.10 — verify Phase A.0 |
| Cross-line validations (e.g. duplicate description detection) | Out — UX nice-to-have |
| Async validation (e.g. unit price sanity check via AI) | Out — overkill |

### 5.Z.10 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.lineEdit.error.descriptionRequired` | Η περιγραφή είναι υποχρεωτική | Description is required |
| `rfqs.lineEdit.error.quantityInvalid` | Η ποσότητα πρέπει να είναι ≥ 0 | Quantity must be ≥ 0 |
| `rfqs.lineEdit.error.unitRequired` | Επίλεξε μονάδα μέτρησης | Select a unit |
| `rfqs.lineEdit.error.priceInvalid` | Η τιμή πρέπει να είναι αριθμός | Price must be a number |
| `rfqs.lineEdit.error.vatRateRequired` | Επίλεξε συντελεστή ΦΠΑ | Select a VAT rate |
| `rfqs.lineEdit.warning.totalMismatch` | Το σύνολο δεν ταιριάζει με qty × τιμή. Στο PDF: {{statedTotal}}, υπολογισμός: {{computedTotal}} | Total does not match qty × price. Stated: {{statedTotal}}, computed: {{computedTotal}} |
| `rfqs.lineEdit.warning.quantityMismatch` | Ο vendor προσφέρει {{vendorQty}} αντί για {{requestedQty}} που ζητήσατε | Vendor offers {{vendorQty}} instead of the {{requestedQty}} you requested |
| `rfqs.quoteEdit.warning.linesSumMismatch` | Άθροισμα γραμμών ({{sum}}) δεν ταιριάζει με το συνολικό ποσό ({{stated}}) | Lines sum ({{sum}}) does not match the stated total ({{stated}}) |
| `rfqs.lineEdit.warning.negativePrice` | Αρνητική τιμή — βεβαιωθείτε ότι είναι discount line | Negative price — verify it is a discount line |
| `rfqs.lineEdit.warning.zeroQuantityWithPrice` | Ποσότητα 0 — δωρεάν δείγμα ή λάθος; | Quantity 0 — free sample or mistake? |
| `rfqs.lineEdit.totalAuto` | Auto | Auto |
| `rfqs.lineEdit.totalOverride` | Override | Override |
| `rfqs.lineEdit.unitOption.other` | Άλλο... | Other... |
| `rfqs.lineEdit.unitOption.otherPlaceholder` | π.χ. βαρέλι, καρότσι | e.g. barrel, cart |
| `rfqs.lineEdit.warning.title` | Προσοχή | Notice |
| `rfqs.lineEdit.warning.fixButton` | Διόρθωση | Fix |
| `rfqs.lineEdit.warning.saveAnywayButton` | Σώσε ούτως ή άλλως | Save anyway |

---

## 5.AA Quote Duplicate Detection & Versioning

When a vendor submits a revised quote (or a duplicate scan happens), the system detects it via multi-signal matching, defaults to creating a new version (high-confidence path) or asks the user (medium/low confidence). Active versions only appear in comparison; full revision history surfaces in the quote list and audit trail.

### 5.AA.1 Multi-signal duplicate detection

```ts
type DuplicateConfidence = 'high' | 'medium' | 'low' | 'none';

interface DuplicateDetectionResult {
  confidence: DuplicateConfidence;
  matchedQuote: Quote | null;
  signals: ('email' | 'taxId' | 'name')[];
}

function detectDuplicate(
  newQuote: Quote,
  existingActive: Quote[]
): DuplicateDetectionResult {
  for (const existing of existingActive) {
    const emailMatch = !!newQuote.vendor.email
      && newQuote.vendor.email.toLowerCase() === existing.vendor.email?.toLowerCase();
    const taxIdMatch = !!newQuote.vendor.taxId
      && newQuote.vendor.taxId === existing.vendor.taxId;
    const nameMatch = fuzzyEqualGreek(newQuote.vendor.name, existing.vendor.name); // levenshtein ≤ 2

    const signals: ('email'|'taxId'|'name')[] = [];
    if (emailMatch) signals.push('email');
    if (taxIdMatch) signals.push('taxId');
    if (nameMatch) signals.push('name');

    if (emailMatch && taxIdMatch) return { confidence: 'high', matchedQuote: existing, signals };
    if (emailMatch || taxIdMatch) return { confidence: 'medium', matchedQuote: existing, signals };
    if (nameMatch) return { confidence: 'low', matchedQuote: existing, signals };
  }
  return { confidence: 'none', matchedQuote: null, signals: [] };
}
```

### 5.AA.2 Confidence-driven UX

| Confidence | Default action | UX |
|------------|----------------|-----|
| **high** (email + taxId match) | Auto-version: existing → `superseded`, new → v(N+1) `active` (preserves existing status) | Toast 8s with «[Όχι, ξεχωριστές προσφορές]» one-click undo |
| **medium** (email OR taxId match) | None — ask user | Modal: «Αυτός ο vendor μοιάζει με τον {{X}}. Ανανέωση ή ξεχωριστή προσφορά;» |
| **low** (only fuzzy name match) | None — ask user | Same modal, less prominent wording |
| **none** | New quote standalone | No notification |

Toast example for high-confidence (consistent with §5.F):
```
ℹ️ Αναγνωρίστηκε ως ανανέωση προσφοράς του {{vendorName}}
   Παλιά: {{oldTotal}}  →  Νέα: {{newTotal}}
                    [Όχι, ξεχωριστές προσφορές]   [×]
```

If user clicks «Όχι, ξεχωριστές προσφορές» within the 8s window: server compensating call reverts (`existing.status` restored from `superseded`, new quote becomes standalone v1). UI rolls back optimistically.

### 5.AA.3 Modal for medium/low confidence

```
┌─ Πιθανή ανανέωση προσφοράς ──────────────────────────┐
│                                                       │
│ Η προσφορά που σαρώθηκε μοιάζει με υπάρχουσα:        │
│                                                       │
│   Vendor: {{vendorName}}                              │
│   Συμπίπτουν: {{matchingSignals}}                     │
│                                                       │
│ Υπάρχουσα προσφορά:                                   │
│   {{oldVendorDisplay}} — {{oldTotal}} (από {{oldDate}})│
│                                                       │
│ Νέα προσφορά:                                         │
│   {{newVendorDisplay}} — {{newTotal}}                 │
│                                                       │
│ Είναι:                                                │
│   ○ Ανανέωση (αντικατέστησε την παλιά)                │
│   ○ Ξεχωριστή προσφορά (κράτα και τις δύο)            │
│   ○ Ακύρωσε import (διπλό σκαν κατά λάθος)            │
│                                                       │
│              [Επιβεβαίωση]                            │
└───────────────────────────────────────────────────────┘
```

### 5.AA.4 Schema additions on `Quote` document

```ts
{
  // existing fields (status, totals, lines, vendor, etc.)
  version: number;                 // default 1
  previousVersionId?: string;      // links to v(N-1)
  supersededBy?: string;           // links to v(N+1) when superseded
  supersededAt?: Timestamp;
  // status type: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'superseded'
  //   ⚠️ NOTE: 'expired' is NOT a status — it's derived from `validUntil` per §5.BB
}
```

⚠️ This is a schema change. **§5.Q applies** as long as production has not launched. After production launch, this requires a migration ADR.

### 5.AA.5 Edge cases

| Scenario | Handling |
|----------|----------|
| Existing quote has `status: 'accepted'` (winner) | Modal warning: «Η υπάρχουσα είναι νικητής. Αν την αντικαταστήσεις, το award μεταφέρεται στη νέα. Συνέχεια;» — explicit user confirm before transfer |
| Existing quote has linked PO (`purchaseOrderId` exists) | **Block** auto-version. Modal: «Δεν μπορεί να αντικατασταθεί — υπάρχει παραγγελία ({{poNumber}}). Ακύρωσε πρώτα την παραγγελία.» Only «Ξεχωριστή προσφορά» or «Ακύρωσε import» allowed. |
| Existing quote has `status: 'rejected'` | Auto-version OK. New quote starts as `submitted` (a fresh review state — user explicitly re-rejects if appropriate). Audit metadata: `revivingRejected: true` |
| New quote has different line count or descriptions | Auto-version OK. Audit metadata: `lineCountChanged: true`, `linesDelta: { added: N, removed: M, changed: K }` |
| Multiple existing quotes match (rare) | Match with highest confidence wins. If tie, most recent `submittedAt`. Document the algorithm in the helper's JSDoc. |

### 5.AA.6 Display in `QuoteList`

```
┌─ Quote List ─────────────────────────────┐
│ Vendor A                12.500€          │
│ Vendor B   v2 ⏷         1.100€          │  ← active
│   └── v1   superseded   1.200€  25/3     │  ← muted, expandable
│ Vendor C                14.000€          │
└──────────────────────────────────────────┘
```

- `v2` badge shown only when `version > 1`
- Chevron `⏷` toggles expansion of older versions
- Expanded older versions: muted background, smaller text, **non-selectable** as winner
- Tooltip on `v2` badge: «Έχει {{count}} προηγούμενη version από {{date}}»

### 5.AA.7 Comparison panel filtering

`ComparisonPanel` reads only quotes with `status !== 'superseded'`. Stats (§5.5) and sort (§5.P) likewise. The active-version filter is applied at the hook level (`useQuotes` returns active by default with an opt-in `includeSuperseded` flag for the History panel future ADR).

### 5.AA.8 Award flow interaction with versioning

Extending §5.F:
- Awarding always targets an **active** quote (can't award `superseded`)
- If a vendor has multiple versions and the awarded one is `accepted`, then a new revision arrives:
  - High confidence → modal: «Έχεις awardάρει την v1. Αν η v2 γίνει active, το award θα μεταφερθεί. Συνέχεια;»
  - User confirms → award transfers atomically (v1 `superseded`, v2 `accepted`, audit trail records both moves)
- If a PO exists for the awarded version → auto-version is blocked (per §5.AA.5)

### 5.AA.9 Manual «Add revision» action

For cases where the user knows in advance a revision is coming and wants to manually create it:
- Quote header overflow menu (§5.I.4) → «Προσθήκη ανανεωμένης version»
- Opens scan/manual entry dialog with `linkedToQuoteId` pre-set on the new quote draft
- On save → directly created as `version: previousQuote.version + 1` linked properly

### 5.AA.10 Audit trail entries

When auto-versioning succeeds:

```ts
// On the superseded (old) quote
{
  entity: 'quote',
  entityId: oldQuoteId,
  action: 'superseded_by_revision',
  actor: currentUserId,
  metadata: {
    supersededByQuoteId: newQuoteId,
    oldTotal: 1200,
    newTotal: 1100,
    delta: -100,
    deltaPercent: -8.33,
    detectionConfidence: 'high',
    detectionSignals: ['email', 'taxId'],
    autoDetected: true,
  }
}

// On the new (active) quote
{
  entity: 'quote',
  entityId: newQuoteId,
  action: 'created_as_revision',
  actor: currentUserId,
  metadata: {
    previousVersionId: oldQuoteId,
    versionNumber: 2,
    totalDelta: -100,
    lineCountChanged: false,
  }
}
```

### 5.AA.11 Stats consistency (§5.5)

Stats cards count active versions only:
- «Συνολικές Προσφορές» = count of `status !== 'superseded'`
- «Καλύτερη Τιμή» = min over active
- All other stats — same filter

### 5.AA.12 Implementation files

| Module | Path | Responsibility |
|--------|------|----------------|
| Detection logic | `src/subapps/procurement/utils/quote-duplicate-detection.ts` (~80 lines) | Pure: `detectDuplicate(newQuote, existing)` |
| Greek fuzzy match helper | Existing or `src/lib/string/fuzzy-greek.ts` | Phase A.0 search first |
| Versioning service | `src/subapps/procurement/services/quote-versioning-service.ts` | `supersede`, `revertSupersede`, `createRevision` operations (Firestore transactions per §5.J) |
| Modal component | `src/subapps/procurement/components/QuoteRevisionDetectedDialog.tsx` | UI for medium/low confidence |
| Hook | `useQuotes(rfqId, { includeSuperseded?: boolean })` | Default `false` — active only |

### 5.AA.13 Out of scope (potential future work)

| Item | Status |
|------|--------|
| Side-by-side diff between v(N) and v(N-1) | Future ADR (could be part of ADR-330 History) |
| Vendor self-revising via portal (vendor-driven, not user-scanned) | Future ADR (vendor portal flow) |
| Auto-merge of compatible revisions (e.g. only price changed) | Out — explicit versioning is clearer |
| Multiple parallel branches per vendor (v1a, v1b for different specs) | Out — one linear version chain per vendor |

### 5.AA.14 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.duplicate.toast.detected` | Αναγνωρίστηκε ως ανανέωση προσφοράς του {{vendorName}}. Παλιά: {{oldTotal}} → Νέα: {{newTotal}} | Detected as a revision from {{vendorName}}. Old: {{oldTotal}} → New: {{newTotal}} |
| `rfqs.duplicate.toast.undoButton` | Όχι, ξεχωριστές προσφορές | No, separate quotes |
| `rfqs.duplicate.dialog.title` | Πιθανή ανανέωση προσφοράς | Possible quote revision |
| `rfqs.duplicate.dialog.body` | Η προσφορά που σαρώθηκε μοιάζει με υπάρχουσα. | The scanned quote resembles an existing one. |
| `rfqs.duplicate.dialog.matching` | Συμπίπτουν: {{signals}} | Matching: {{signals}} |
| `rfqs.duplicate.dialog.signals.email` | email | email |
| `rfqs.duplicate.dialog.signals.taxId` | ΑΦΜ | tax ID |
| `rfqs.duplicate.dialog.signals.name` | όνομα | name |
| `rfqs.duplicate.dialog.option.revision` | Ανανέωση (αντικατέστησε την παλιά) | Revision (replace existing) |
| `rfqs.duplicate.dialog.option.separate` | Ξεχωριστή προσφορά (κράτα και τις δύο) | Separate quote (keep both) |
| `rfqs.duplicate.dialog.option.cancel` | Ακύρωσε import (διπλό σκαν κατά λάθος) | Cancel import (accidental double scan) |
| `rfqs.duplicate.dialog.confirmButton` | Επιβεβαίωση | Confirm |
| `rfqs.duplicate.dialog.acceptedWarning` | Η υπάρχουσα είναι νικητής. Αν την αντικαταστήσεις, το award θα μεταφερθεί στη νέα. | Existing is the winner. Replacing transfers the award to the revision. |
| `rfqs.duplicate.dialog.poBlocked` | Δεν μπορεί να αντικατασταθεί — υπάρχει παραγγελία ({{poNumber}}). Ακύρωσε πρώτα την παραγγελία. | Cannot replace — purchase order exists ({{poNumber}}). Cancel the PO first. |
| `rfqs.versionBadge.label` | v{{version}} | v{{version}} |
| `rfqs.versionBadge.tooltip` | Έχει {{count}} προηγούμενη version από {{date}} | Has {{count}} previous version since {{date}} |
| `rfqs.versionBadge.tooltip.plural` | Έχει {{count}} προηγούμενες versions | Has {{count}} previous versions |
| `rfqs.versionList.expandToggle` | Δες παλιότερες versions | Show older versions |
| `rfqs.versionList.collapseToggle` | Κρύψε παλιότερες versions | Hide older versions |
| `rfqs.versionList.supersededBadge` | superseded | superseded |
| `rfqs.versionList.addRevisionAction` | Προσθήκη ανανεωμένης version | Add revised version |

---

## 5.BB Quote Expiration Handling (derived state, never auto-status-flip)

When a quote has a `validUntil` date that passes, the system surfaces this as a **derived** UI state, never as an automatic `status` change. The `status` field stays a record of user intent (`submitted`, `under_review`, `accepted`, `rejected`, `superseded`); expiration is computed at render time.

### 5.BB.1 Core principle: derived, not persisted

| Property | Type | Source |
|----------|------|--------|
| `status` | enum (no `'expired'`) | User-driven |
| `validUntil` | Timestamp \| null | AI extraction OR manual entry |
| `isExpired` | computed boolean | `validUntil != null && validUntil < now()` |

**Why not auto-flip status to `'expired'`:**
- Status field reflects user intent — mixing automated transitions corrupts that meaning
- A cron-driven write would be an "invisible actor" that conflicts with §5.J optimistic locking (no `currentUserId` to attribute the change to)
- After auto-flip, you can't distinguish «user rejected» from «system timed out»
- Costs Cloud Function execution + Firestore writes for zero net benefit

### 5.BB.2 Schema retraction (correction to §5.AA.4)

Earlier in §5.AA.4 the status enum was listed including `'expired'`. **This is corrected here**: the canonical status enum is:

```ts
type QuoteStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'superseded';
// 'expired' is NOT a status — it's derived
```

Affected sections that referenced `status === 'expired'`:
- §5.AA.4 — schema additions: remove `'expired'`
- §5.P.2 STATUS_PRIORITY — remove the `expired: 6` line
- §5.W.1 — quick-filter chip: «Expired» becomes a **derived** filter that calls `isExpired(quote)`, not `status === 'expired'`

### 5.BB.3 Visual indicators in `QuoteListCard`

| State | Trigger | Badge text | Color |
|-------|---------|------------|-------|
| Expired | `isExpired(quote) === true` | ⏳ Έληξε στις {{date}} | 🔴 red text on muted bg |
| Expiring soon | `validUntil` within next 7 days | ⚠️ Λήγει σε {{N}} ημέρες | 🟡 yellow text |
| Normal | `validUntil` ≥ 7 days from now OR null | (none) | — |

The badge sits next to the status chip on each `QuoteListCard`. No layout change beyond the existing card structure.

### 5.BB.4 Banner in `QuoteDetailsHeader`

When the selected quote is expired:

```
┌─ ⏳ Η προσφορά έληξε στις 1 Μαΐου 2026 (πριν 1 ημέρα) ─┐
│                                  [Ζήτησε ανανέωση →]   │
└────────────────────────────────────────────────────────┘
```

Compact, yellow/orange treatment. Sits directly below the status row in the header. The CTA opens the renewal email composer (§5.BB.6).

### 5.BB.5 Award attempt on expired quote

When the user clicks «Έγκριση Νικητή» (or any other award action) on an expired quote, the §5.F award flow is gated by an «expired warning» modal:

```
┌─ ⏳ Η προσφορά έχει λήξει ──────────────────────────────┐
│                                                          │
│ Η προσφορά του {{vendorName}} έληξε στις                 │
│ {{validUntilDate}} (πριν {{daysAgo}} ημέρες). Ο vendor  │
│ μπορεί να μην τηρήσει την τιμή.                          │
│                                                          │
│ Τι θες να κάνεις;                                        │
│                                                          │
│   [📧 Ζήτησε ανανέωση από vendor]                        │
│   [✅ Award παρόλα αυτά]                                 │
│   [Ακύρωση]                                              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Action | Behavior |
|--------|----------|
| Ζήτησε ανανέωση | Opens renewal composer (§5.BB.6); award is paused (not cancelled — user can come back) |
| Award παρόλα αυτά | Proceeds to §5.F flow (with §5.X reason capture if non-cheapest); audit metadata records `awardedExpired: true, expiredDays: N` |
| Ακύρωση | Closes modal, no action |

If «Award παρόλα αυτά» wins, the comparison header banner (§5.F.6) appends an asterisk marker:

```
✅ Νικητής: Vendor B — 1.100€ — ⚠️ Awarded από expired προσφορά
```

### 5.BB.6 Renewal email composer

```
┌─ Ζήτηση ανανέωσης προσφοράς ──────────────────────────┐
│ Προς: {{vendorEmail}} (read-only)                     │
│ Θέμα: [Ανανέωση προσφοράς για: {{rfqTitle}}.........]│
│ ┌─────────────────────────────────────────────────┐   │
│ │ Αγαπητέ {{vendorName}},                          │   │
│ │                                                   │   │
│ │ Η προσφορά σας {{quoteNumber}} με ισχύ έως        │   │
│ │ {{originalValidUntil}} έχει λήξει.                │   │
│ │                                                   │   │
│ │ Είναι ακόμη έγκυρη η τιμή των {{total}} €;        │   │
│ │ Αν ναι, παρακαλούμε στείλτε ανανέωση. Αν όχι,     │   │
│ │ στείλτε αναθεωρημένη προσφορά.                    │   │
│ │                                                   │   │
│ │ Με εκτίμηση,                                       │   │
│ │ {{senderName}}                                     │   │
│ └─────────────────────────────────────────────────┘   │
│         [Ακύρωση]   [Στείλε email]                    │
└────────────────────────────────────────────────────────┘
```

- Subject + body editable by user
- Send uses the existing outbound email service (§5.V.4 reuse)
- On success: audit entry `renewal_requested` on the quote document
- If vendor responds with new PDF → §5.AA detection picks it up → high-confidence auto-version

### 5.BB.7 Stats card consistency

«Καλύτερη Τιμή» (§5.5) ignores expired and superseded quotes:

```ts
const candidates = quotes.filter(q =>
  q.status !== 'rejected' &&
  q.status !== 'superseded' &&
  !isExpired(q)
);
const bestPrice = Math.min(...candidates.map(q => q.totals?.netTotal ?? Infinity));
```

Optional new stats card (when any expired/expiring soon exist):

| Card | Trigger | Value |
|------|---------|-------|
| «Λήγουν σύντομα» | Any quote with `validUntil` in next 7 days | count |

This card replaces a less-relevant card in the per-tab stats layout (§5) — implementer chooses which is least useful in the «Προσφορές» context (likely «Εγκρίθηκαν» if no awards yet).

### 5.BB.8 Sort behavior (§5.P) — no change

The default `status-price` sort does **not** demote expired quotes. Expiration is a UI overlay, not a sort criterion. Reasoning: a cheap expired quote is still a viable starting point for renewal — the user wants it visible.

If future feedback shows users want expired quotes pushed down, add a tertiary comparator. Not in scope for this ADR.

### 5.BB.9 Filter behavior (§5.W) — derived chip

The §5.W.1 «Expired» status quick-filter chip (originally `status === 'expired'`) becomes derived:

```tsx
{ key: 'expired', predicate: (q: Quote) => isExpired(q) }
```

It surfaces as a chip only if **any** quote in the current RFQ is expired. The chip is independent of `status` — a quote can be `under_review` AND expired simultaneously.

### 5.BB.10 Edge cases

| Scenario | Handling |
|----------|----------|
| Quote has no `validUntil` (extraction failed or vendor didn't specify) | No badge, no banner, no warning modal. User can add validity manually in line/quote edit. |
| Quote `validUntil` is malformed (string instead of Timestamp) | Treat as null. Log warning to console for diagnostic. Do not crash. |
| `validUntil` is **in the future** but extracted with wrong year (e.g. 2025 instead of 2026 — common AI error) | Visible as expired. User edits `validUntil` to fix. No automatic correction. |
| Award expired quote, then PO is created, then user notices expiration | Cannot revert (per §5.AA.5). PO must be cancelled first. Audit trail flags this for compliance review. |
| Renewal email send fails | Toast error + retry. The quote remains expired until vendor responds. |
| User clicks «Ζήτησε ανανέωση» but never sends | No state change. Quote remains expired. |

### 5.BB.11 Implementation files

| Module | Path | Responsibility |
|--------|------|----------------|
| Expiration helpers | `src/subapps/procurement/utils/quote-expiration.ts` (~40 lines) | `isExpired(quote, now?)`, `daysUntilExpiry(quote)`, `expiryBadgeState(quote): 'expired'\|'expiring_soon'\|'normal'\|'unknown'` |
| Award expired warning | `src/subapps/procurement/components/ExpiredAwardWarningDialog.tsx` | Modal preceding §5.F when expired |
| Renewal composer | `src/subapps/procurement/components/QuoteRenewalRequestDialog.tsx` | Email composer with renewal template |
| Quote header banner | Inside `QuoteDetailsHeader` (extension via prop) | Renders banner when `isExpired(quote)` |

`isExpired(quote, now?)` accepts an optional `now` argument for testing. Default: `Date.now()`.

### 5.BB.12 Phase A.0 verification

- Grep `validUntil`, `validity`, `expir` in the `Quote` type and AI extraction schema. Verify it's already extracted by the AI pipeline (per ADR-327's recent work on `vatIncluded`/`laborIncluded`, this field likely exists)
- If `validUntil` is **not** extracted: open follow-up to ADR-327 to add it to the extraction schema. ADR-328 implementation can ship without `validUntil` populated; the UX simply shows no badges/banners — graceful degradation
- Confirm no other place hardcodes `status === 'expired'` (besides the ones documented in §5.BB.2)

### 5.BB.13 Out of scope (potential future)

| Item | Status |
|------|--------|
| Pre-expiry reminder notifications («Vendor X λήγει σε 3 ημέρες») | Future ADR (Notifications module) |
| Auto-renewal request on expiry | Out — manual user trigger preserves intent |
| Vendor portal for one-click renewal | Out — vendor portal is its own multi-ADR effort |
| Bulk renewal request («Ζήτησε ανανέωση από όλους τους ληγμένους») | Out — small-scale per §5.N rarely needs this |
| Configurable «expiring soon» threshold (currently hardcoded 7 days) | Out — sensible default; revisit if user feedback warrants |

### 5.BB.14 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.expiry.badge.expired` | ⏳ Έληξε στις {{date}} | ⏳ Expired on {{date}} |
| `rfqs.expiry.badge.expiringSoon` | ⚠️ Λήγει σε {{days}} ημέρες | ⚠️ Expires in {{days}} days |
| `rfqs.expiry.banner.title` | Η προσφορά έληξε στις {{date}} (πριν {{daysAgo}} ημέρα) | Quote expired on {{date}} ({{daysAgo}} day ago) |
| `rfqs.expiry.banner.titlePlural` | Η προσφορά έληξε στις {{date}} (πριν {{daysAgo}} ημέρες) | Quote expired on {{date}} ({{daysAgo}} days ago) |
| `rfqs.expiry.banner.requestRenewalCta` | Ζήτησε ανανέωση | Request renewal |
| `rfqs.expiry.warningModal.title` | Η προσφορά έχει λήξει | Quote has expired |
| `rfqs.expiry.warningModal.body` | Η προσφορά του {{vendor}} έληξε στις {{date}} (πριν {{daysAgo}} ημέρες). Ο vendor μπορεί να μην τηρήσει την τιμή. | {{vendor}}'s quote expired on {{date}} ({{daysAgo}} days ago). The vendor may not honor the price. |
| `rfqs.expiry.warningModal.requestRenewal` | Ζήτησε ανανέωση από vendor | Request renewal from vendor |
| `rfqs.expiry.warningModal.awardAnyway` | Award παρόλα αυτά | Award anyway |
| `rfqs.expiry.warningModal.cancel` | Ακύρωση | Cancel |
| `rfqs.expiry.awardedExpiredBanner` | ⚠️ Awarded από expired προσφορά | ⚠️ Awarded from expired quote |
| `rfqs.expiry.renewal.dialogTitle` | Ζήτηση ανανέωσης προσφοράς | Request quote renewal |
| `rfqs.expiry.renewal.subjectDefault` | Ανανέωση προσφοράς για: {{rfqTitle}} | Renewal of quote for: {{rfqTitle}} |
| `rfqs.expiry.renewal.bodyDefault` | Αγαπητέ {{vendorName}},\n\nΗ προσφορά σας {{quoteNumber}} με ισχύ έως {{originalValidUntil}} έχει λήξει.\n\nΕίναι ακόμη έγκυρη η τιμή των {{total}} €; Αν ναι, παρακαλούμε στείλτε ανανέωση. Αν όχι, στείλτε αναθεωρημένη προσφορά.\n\nΜε εκτίμηση,\n{{senderName}} | Dear {{vendorName}},\n\nYour quote {{quoteNumber}} valid until {{originalValidUntil}} has expired.\n\nIs the price of {{total}} € still valid? If so, please send a renewal. If not, please send a revised quote.\n\nKind regards,\n{{senderName}} |
| `rfqs.expiry.renewal.sendButton` | Στείλε email | Send email |
| `rfqs.expiry.renewal.cancelButton` | Ακύρωση | Cancel |
| `rfqs.expiry.stats.expiringSoonCard` | Λήγουν σύντομα | Expiring soon |
| `rfqs.expiry.filter.chip` | Έληξαν | Expired |

---

## 5.CC AI Confidence Visibility — Validation-Only (rest deferred)

### 5.CC.1 Decision (in scope for ADR-328)

| Surface | Confidence visible? | Rationale |
|---------|--------------------|-----------|
| Quote review page (`/procurement/quotes/[id]/review`) | ✅ Yes (already implemented) | Validation context — user is approving extracted data |
| RFQ detail browse views (`QuoteList`, `QuoteDetailSummary`, `ComparisonPanel`, header) | ❌ No | Post-validation context — data is treated as canonical |
| Edit dialog (when user clicks «Επεξεργασία» from §5.I.4 overflow menu) | ✅ Yes (deferred — see §5.CC.3) | Re-validation context — user is reviewing/changing data |

**Principle (industry-standard for OCR/extraction):** Confidence is metadata of the extractor, not of the data. After human approval, the data is canonical. Re-show confidence only when re-entering a validation context.

### 5.CC.2 Phase A.0 verification

Before implementing the structural refactor:

1. Open the new RFQ detail page in dev (`/procurement/rfqs/[id]`)
2. Verify that `QuoteListCard`, `QuoteDetailSummary`, `ComparisonPanel`, and `QuoteDetailsHeader` do **not** render confidence percentages, badges, or warning icons in their current implementations
3. If any do → remove that rendering (small cleanup, ~30 minutes)
4. Confidence values must remain **stored** in Firestore — do NOT delete the fields. Only the UI rendering changes.

The `confidence` fields stay in the document model so they're available when the future edit dialog needs them:

```ts
{
  vendor: { name, nameConfidence, taxId, taxIdConfidence, ... },
  totals: { grandTotal, grandTotalConfidence, ... },
  // etc.
}
```

### 5.CC.3 Edit dialog — DEFERRED to future ADR

> **🚧 PENDING FUTURE WORK — must open before implementation**

The full quote edit dialog (with confidence indicators, field-by-field editing, re-run AI option) is **not** built in ADR-328. The «Επεξεργασία» button in §5.I.4 overflow menu lands as a placeholder per the §5.R pattern: rendered, disabled, tooltip «Έρχεται σύντομα».

A dedicated future ADR (working title: **ADR-333 — Quote Edit Dialog with AI Confidence**) must be opened **before** any implementation begins. Suggested scope of that future ADR:

1. Edit dialog modal layout (likely reuses review page split: PDF + form)
2. Per-field confidence indicators (reuse review page visualization)
3. Confidence threshold thresholds + colors (reuse review page constants)
4. Save logic (writes back to Firestore, audit entry `quote_edited`)
5. Re-run AI extraction action (optional — opens follow-up ADR if added)
6. Wiring to the §5.I.4 overflow menu (replaces the placeholder)
7. Schema additions if any (probably none — `confidence` fields already exist)

The future ADR should also produce **audit entries** when fields are edited:

```ts
{
  entity: 'quote',
  action: 'field_edited',
  metadata: {
    field: 'totals.grandTotal',
    oldValue: 600,
    newValue: 650,
    originalConfidence: 0.65,  // from extraction
    editedByUser: true,
  }
}
```

### 5.CC.4 Pending status — track explicitly

This work is **explicitly pending** and must not be silently picked up mid-implementation of ADR-328. The implementer of ADR-328 should:

- Render the «Επεξεργασία» button in §5.I.4 as disabled with «coming soon» tooltip
- Not implement any inline edit logic for quotes
- Leave the placeholder until ADR-333 ships and supersedes it
- Add a TODO comment near the placeholder pointing to «See ADR-333 (pending)»

### 5.CC.5 Audit value of confidence data — preserved

The `confidence` fields recorded at extraction time remain queryable in Firestore. This means:

- Any future audit/compliance review can answer «what was the AI's confidence on this field?»
- A future analytics dashboard could surface «average extraction confidence» as a quality metric
- A future bulk re-validation flow could prioritize low-confidence documents

None of these require ADR-328 changes. They simply benefit from the data being preserved.

### 5.CC.6 i18n keys (additional, minimal)

| Key | el | en |
|-----|----|----|
| `rfqs.quoteHeader.tooltip.editComingSoon` | Επεξεργασία — έρχεται σύντομα | Edit — coming soon |

(Other confidence-related i18n keys remain in the review page's existing namespace — no duplication needed for ADR-328.)

---

## 5.DD RFQ Creation Flow — Out of Scope (DEFERRED to ADR-334)

> **🚧 PENDING FUTURE WORK — must open ADR-334 before changing creation flow**

### 5.DD.1 What this ADR does NOT touch

The «Νέο RFQ» creation flow (likely at `/procurement/rfqs/new` or via a modal on `/procurement/rfqs`) is explicitly **out of scope** for ADR-328. ADR-328 only refactors the **detail page** (`/procurement/rfqs/[id]`), not how RFQs come into existence.

### 5.DD.2 Tolerance contract — what the detail page must accept

The new detail page MUST gracefully render any RFQ document that the current creation flow produces, without crashes or broken layouts. Specifically:

| RFQ has | Detail page behavior |
|---------|---------------------|
| No `title` | `PageHeader` title fallback: «Χωρίς τίτλο» / «Untitled» |
| No `projectId` link | `ModuleBreadcrumb` skips the project segment cleanly (no broken segment) |
| 0 `lines` | Setup tab shows empty state for lines («Καμία γραμμή — πρόσθεσε ζητήσεις») |
| 0 `invites` | Setup tab shows empty state for invites; §5.C empty state covers Quotes tab |
| 0 `quotes` | §3.1 default tab = Setup; §5.S.2 empty state in Comparison tab |
| No `deadline` | Banner / badge skipped silently — no warning, no broken date format |
| No `category` | §5.Y.3 graceful degradation — no «Suggested vendors» section, full alphabetical list |

The page is built defensively: every read of an optional RFQ field uses a sensible fallback. The implementer should grep all `rfq.<field>` accesses during Phase A.0 to verify defensive null/undefined handling.

### 5.DD.3 Phase A.0 audit step

Before refactoring the detail page, the implementer locates the existing creation flow and documents:

1. **Where** creation happens (route or modal component)
2. **Which fields are required** at creation (per current code)
3. **Which fields are optional** at creation
4. **Validation rules** in the creation form

Result of this audit goes into a brief table in this section (left empty here; the implementer fills it):

**Executed 2026-04-30** — Source: `src/subapps/procurement/types/rfq.ts` (`CreateRfqDTO`), `src/subapps/procurement/services/quote-service.ts`:

| Field | Required at creation? | Notes |
|-------|------------------------|-------|
| title | ✅ Yes | Required in `CreateRfqDTO` (TypeScript non-optional) |
| projectId | ✅ Yes | Required in `CreateRfqDTO` (TypeScript non-optional) |
| lines | ❌ No | `lines?: RfqLine[]` — optional, stored inline `[]` if omitted |
| category | ❌ No | **Not in `RFQ` schema at all** — no `category` field on `RFQ` type |
| deadline | ❌ No | `deadlineDate?: string \| null` — optional |
| inviteList | ❌ No | `invitedVendorIds?: string[]` — optional |
| buildingId | ❌ No | Optional association |
| description | ❌ No | Optional freetext |
| awardMode | ❌ No | Defaults to `whole_package` (inferred from DTO optional) |
| sourcingEventId | ❌ No | Multi-vendor extension (ADR-327), optional |

**Key findings for ADR-334:**
- Only `title` + `projectId` are enforced at creation — all else is optional
- `category` does not exist on the `RFQ` type (not a TBD gap — genuinely absent from schema)
- The creation flow allows minimal RFQs (title + project) with progressive fill-in later
- No «save as draft» distinction currently — all RFQs start with no explicit status or `draft`
- No quality gate before invite sending (any RFQ can invite regardless of completeness)

This audit is **non-blocking** — it does not change the creation flow itself, only documents its current state for the future ADR-334.

### 5.DD.4 «Sensible minimum» — recommendation for ADR-334 (NOT enforced here)

For reference only — for future ADR-334 to consider when refining the creation flow. Based on construction industry patterns (Procore, SAP Ariba):

| Field | Status at draft | Status at first invite send |
|-------|-------------------|------------------------------|
| `title` | ✅ Required (identity) | ✅ Required |
| `projectId` | ✅ Required (budget/reporting tracking) | ✅ Required |
| `category` | ⚠️ Optional but encouraged (enables §5.Y.3 suggestions) | ⚠️ Optional |
| `lines[]` | ⚠️ Optional (saved as draft) | ✅ Required ≥1 line |
| `deadline` | ⚠️ Optional (saved as draft) | ✅ Required |
| `specs/attachments` | ❌ Optional | ❌ Optional |

Pattern: «**Save draft fast → fill progressively → enforce quality gates at the meaningful action (send invites)**».

### 5.DD.5 Future ADR-334 — pending

> **🚧 ADR-334 — RFQ Creation Flow Refinement** (placeholder; actual number per CLAUDE.md numbering rule when written)

**Must open before any changes to the creation flow.** Suggested scope:

1. Verify / add required-at-creation enforcement: `title` + `projectId`
2. Add «save as draft» distinction (RFQ status `draft` vs `open`)
3. Add «send invites» quality gate: blocks if missing `lines` or `deadline`
4. Improve creation UX (progressive disclosure, project autosuggest, BOQ import from existing project lines)
5. Add audit entry `rfq_created` with metadata about completeness
6. Update Firestore security rules if new required-fields are introduced

Until ADR-334 ships, **the creation flow stays exactly as it is today**. ADR-328 implementation cannot silently change it.

### 5.DD.6 Why this discipline matters

If we touched creation flow inside ADR-328:
- Scope explosion (1–2 weeks extra)
- Two distinct UX domains entangled (creation + detail) → harder to review, test, roll back
- Breaks the §5.Q «no migration» window — adding required fields at creation means existing test/draft RFQs need backfill, which is a migration concern

By keeping ADR-328 detail-only, we preserve atomic deliverability of the structural refactor.

### 5.DD.7 i18n keys (additional, for fallbacks only)

| Key | el | en |
|-----|----|----|
| `rfqs.detail.fallback.untitled` | Χωρίς τίτλο | Untitled |
| `rfqs.detail.fallback.noProject` | (Χωρίς έργο) | (No project) |
| `rfqs.setup.lines.empty.title` | Καμία γραμμή | No lines yet |
| `rfqs.setup.lines.empty.body` | Πρόσθεσε ζητήσεις για να δουν οι vendors τι ζητάς | Add line items so vendors know what you're asking for |
| `rfqs.setup.invites.empty.title` | Καμία πρόσκληση | No invites yet |
| `rfqs.setup.invites.empty.body` | Στείλε προσκλήσεις σε προμηθευτές για να λάβεις προσφορές | Send invites to vendors to receive quotes |

---

## 5.EE RFQ Lifecycle Management — Out of Scope (DEFERRED to ADR-335)

> **🚧 PENDING FUTURE WORK — must open ADR-335 before changing lifecycle behavior**

### 5.EE.1 What this ADR does NOT touch

The RFQ lifecycle (draft → open → awarded → po_created → delivered → closed/cancelled) is explicitly **out of scope** for ADR-328. ADR-328 only refactors the visual presentation of the detail page — it does not implement state transitions, archiving, closing, reopening, or any lifecycle automation.

### 5.EE.2 Tolerance contract — detail page accepts whatever status exists

The new detail page MUST gracefully render any `RFQ` document, regardless of which `status` value (if any) it has:

| RFQ has `status` | Detail page behavior |
|------------------|----------------------|
| `'draft'` (if used) | Render normally; optional info banner «📝 Draft RFQ» |
| `'open'`, `'active'`, or unset/missing | Default — full ADR-328 design applies |
| `'awarded'` (if used) | §5.G lock state already engages via the `accepted` quote (no new logic needed) |
| `'po_created'` (if used) | §5.G full PO-lock applies via existing `purchaseOrderId` field |
| `'closed'` or `'archived'` (if used) | Page renders read-only; «🔒 RFQ closed» banner at top; all write actions disabled with tooltip pointing to lifecycle ADR |
| `'cancelled'` (if used) | Same as closed but banner says «❌ RFQ cancelled» |
| Unknown / unexpected value | Render normally with «Άγνωστη κατάσταση» indicator; do not crash |

The detail page **reads** `rfq.status` but **never writes** to it. Lifecycle transitions remain the responsibility of the future ADR.

### 5.EE.3 Phase A.0 audit step

Before refactoring, the implementer documents:

1. Does the `RFQ` type currently have a `status` field? Where is it defined?
2. What enum values does it accept?
3. Where is it written (creation flow, award flow, PO flow, manual close)?
4. Is there any current «closed» or «archived» concept?

Result populates the table below:

**Executed 2026-04-30** — Source: `src/subapps/procurement/types/rfq.ts`:

| Aspect | Current state |
|--------|----------------|
| `status` field exists? | ✅ Yes — `status: RfqStatus` on `RFQ` interface |
| Enum values | `draft \| active \| closed \| archived` (4 values) |
| Transitions | `draft→active\|archived`, `active→closed\|archived`, `closed→archived`, `archived→[]` |
| Set at creation | `draft` (implied entry state — no explicit set in DTO but transitions confirm it) |
| Set at award | ❌ **Not set** — award sets `winnerQuoteId` on `RFQ` but does NOT flip `status`; RFQ stays `active` |
| Set at PO creation | ❌ **Not set** — `linkedPoId` is on the `Quote` doc, not on `RFQ`; no PO→RFQ status coupling |
| Manual close UI | ❌ Not present — no close action in current RFQ detail page |
| Hidden from list when closed? | ❌ Not implemented — no filter in list hooks |
| `'cancelled'` status | ❌ Not in enum (only `archived`) — tolerance contract in §5.EE.2 must handle gracefully |

**Key findings for ADR-335:**
- Award flow (`winnerQuoteId`) and RFQ status are **decoupled** — award does not auto-transition RFQ to `closed`. This is a gap to address in ADR-335.
- PO linkage lives on the Quote, not RFQ — the §5.G lock logic (post-PO state) must read `Quote.linkedPoId`, not `RFQ.status`
- `cancelled` is **not** a valid enum value — §5.EE.2 "unknown status" fallback covers this
- No read-only enforcement at the Firestore rules layer for closed RFQs

This audit is **non-blocking** — informs ADR-335 without changing anything in ADR-328.

### 5.EE.4 «Sensible lifecycle» — recommendation for ADR-335 (NOT enforced here)

For reference. Based on Procore + SAP Ariba patterns:

| State | Entry trigger | Auto/Manual | Exit triggers |
|-------|---------------|-------------|----------------|
| `draft` | RFQ created, no invites sent | Auto | First invite sent → `open` |
| `open` | First invite sent | Auto | Quote accepted → `awarded`; user cancels → `cancelled` |
| `awarded` | First quote `status: 'accepted'` | Auto | PO created → `po_created`; award reverted → back to `open` |
| `po_created` | Linked `purchaseOrderId` exists | Auto | PO marked delivered → `delivered`; PO cancelled → back to `awarded` |
| `delivered` | PO module signals delivery | Auto (via PO event) | Manual close OR auto X days later → `closed` |
| `closed` | User manual «Κλείσιμο» OR auto N days post-delivery | Hybrid | Manual reopen → previous state |
| `cancelled` | User explicit cancellation before award | Manual | Manual reopen → `open` (or `draft`) |

Default RFQ list view filters out `closed` + `cancelled`. Toggle «Δες όλα» surfaces archived items.

### 5.EE.5 Future ADR-335 — pending

> **🚧 ADR-335 — RFQ Lifecycle Management** (placeholder; actual number per CLAUDE.md numbering rule when written)

**Must open before any changes to lifecycle behavior.** Suggested scope:

1. Define the `RfqStatus` enum (per §5.EE.4 or refined)
2. Implement state transitions (auto-triggers, manual actions)
3. Read-only state behavior — what gets disabled, banner copy, unlock paths
4. Archive list UI (hide closed/cancelled from default; toggle for full view)
5. Reporting / metrics views (per ADR's analytics scope, if any)
6. Reopen flow (when allowed, by whom, audit trail)
7. Migration for existing RFQs with no/legacy status (§5.Q applies if pre-prod)
8. Firestore security rules updates (read-only enforcement at the rules layer)
9. Audit trail entries for every state transition

### 5.EE.6 Impact on ADR-328 implementation

**Minimal.** Only the tolerance contract (§5.EE.2) needs to be coded:

- Optional `status` banner rendering above the existing PageHeader
- Read-only mode wrapping (when `status === 'closed' | 'cancelled' | 'archived'`)
- Disabled write actions with tooltip when in a read-only lifecycle state

These are ~20–30 lines of conditional rendering — no business logic, no state transitions, no Firestore writes related to lifecycle.

### 5.EE.7 Why this discipline matters

Same as §5.DD.6 (creation flow):
- Atomic deliverability of the structural refactor
- Two distinct domains (detail rendering vs lifecycle automation) — separate review surfaces
- §5.Q «no migration» window stays intact — no new required schema fields introduced
- Future ADR-335 can do the lifecycle properly without retrofitting half-implemented closed-states

### 5.EE.8 i18n keys (additional, fallback only)

| Key | el | en |
|-----|----|----|
| `rfqs.status.unknown` | Άγνωστη κατάσταση | Unknown status |
| `rfqs.status.banner.draft` | 📝 Draft RFQ — δεν έχει σταλεί ακόμα | 📝 Draft RFQ — not yet sent |
| `rfqs.status.banner.closed` | 🔒 Αυτό το RFQ έχει κλείσει | 🔒 This RFQ is closed |
| `rfqs.status.banner.cancelled` | ❌ Αυτό το RFQ έχει ακυρωθεί | ❌ This RFQ is cancelled |
| `rfqs.status.banner.archived` | 📦 Αυτό το RFQ είναι αρχειοθετημένο | 📦 This RFQ is archived |
| `rfqs.status.lockedTooltip` | Δεν επιτρέπεται — το RFQ δεν είναι ενεργό | Not allowed — RFQ is inactive |

---

## 5.FF Project Context Visibility (Procore-pattern: project-centric navigation)

In construction procurement, the project is the primary organizing entity. Every RFQ belongs to a project; budgeting, scheduling, and reporting are project-scoped. The detail page therefore surfaces project context in **two places**: the breadcrumb (navigational) and a subtitle/badge near the title (visual emphasis).

### 5.FF.1 Breadcrumb — project segment

`ModuleBreadcrumb` includes a project segment when `rfq.projectId` is present:

```
Procurement › Έργο: Πολυκατοικία Δάφνη › RFQs › Πόρτες ξύλινες
                          ↑ clickable → /projects/<id>
```

If `projectId` is missing (per the §5.DD tolerance contract), the project segment is **omitted cleanly** — no broken segment, no «Loading...», no «Άγνωστο έργο». The breadcrumb degrades to:

```
Procurement › RFQs › Πόρτες ξύλινες
```

Exact segment ordering depends on the existing `ModuleBreadcrumb` API discovered in Phase A.0.

### 5.FF.2 PageHeader subtitle — project link

A subtitle line under the title shows the project name with a building icon, clickable to navigate to the project detail page:

```
┌─ PageHeader ──────────────────────────────────────────────┐
│ 📋 Πόρτες ξύλινες                                          │
│ 🏗️ Πολυκατοικία Δάφνη — Νέα Σμύρνη                         │
└────────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Icon | `Building2` from lucide-react, size 12-14px, muted color |
| Text | `rfq.projectName` (denormalized field on RFQ) |
| Hover | Underline + cursor pointer |
| Click | Navigate to `/projects/<projectId>` (Next.js `<Link>`) |
| Truncation | Long names: ellipsis after ~60 chars, full name in tooltip |
| Fallback | If `projectId` is missing OR `projectName` is missing, the subtitle is **not rendered** at all (cleaner than showing «(Χωρίς έργο)») |

### 5.FF.3 §3 layout skeleton — updated

The §3.6 layout from earlier is amended:

```tsx
<PageHeader
  variant="sticky-rounded"
  breadcrumb={
    <ModuleBreadcrumb
      projectId={rfq?.projectId}
      projectName={rfq?.projectName}
    />
  }
  title={{
    icon: ClipboardList,
    title: rfq?.title ?? t('rfqs.detail.fallback.untitled'),
    subtitle: rfq?.projectId && rfq.projectName ? (
      <Link
        href={`/projects/${rfq.projectId}`}
        className="text-sm text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
        aria-label={t('rfqs.detail.projectLink.aria', { projectName: rfq.projectName })}
      >
        <Building2 className="size-3" />
        {rfq.projectName}
      </Link>
    ) : undefined,
  }}
  actions={{ /* ... per §5.A */ }}
/>
```

### 5.FF.4 Phase A.0 verification

| Check | What to do |
|-------|------------|
| Does `ModuleBreadcrumb` already accept project segment? | Grep `ModuleBreadcrumb`. Read its prop interface. If yes, pass `projectId` + `projectName`. If no, extend additively (new optional props with default fallback to current behavior). |
| Does `PageHeader` accept a `subtitle` prop in `title`? | Grep `PageHeader` from `@/core/headers`. If yes, use directly. If no, extend additively (no breaking change for existing consumers). |
| Does `RFQ` document have `projectName` denormalized? | Inspect the type. If present, render directly (zero cost). If only `projectId`, use the existing `useProject(projectId)` hook OR add denormalization. |

The denormalization decision: **prefer denormalize at RFQ creation/update**. Pattern is standard SSOT trade-off — small write cost, big read win, no extra Firestore round-trip per detail page load. If the RFQ data flow doesn't currently denormalize, this becomes input to ADR-334 (RFQ creation refinement) — out of scope for ADR-328 itself, but the implementer surfaces the gap.

If neither denormalization nor a fast project hook exists, fallback: render «🏗️ ...» skeleton on first paint, then resolve to actual name once project doc loads. Acceptable if rare.

### 5.FF.5 Edge cases

| Scenario | Behavior |
|----------|----------|
| `projectId` exists but project document was deleted | Subtitle skipped (denormalized name still works if it's denormalized; lookup hook handles 404 with skipped render) |
| Project name very long (>60 chars) | Truncate with `…` + full name on hover tooltip |
| Mobile (< 768px) | Subtitle keeps single-line truncation; breadcrumb may collapse intermediate segments per existing `ModuleBreadcrumb` mobile behavior |
| Multiple users on same RFQ, project gets renamed | §5.J `onSnapshot` on RFQ document re-renders; if denormalization isn't propagated, name lags. ADR-334 should address. |

### 5.FF.6 Why no «Sibling RFQs» widget

Considered and rejected:
- Overlaps with the project detail page (`/projects/<id>`) which already lists all project RFQs
- Adds horizontal/vertical space cost on the detail page
- Increases scope (rendering, filtering, sorting, real-time sync of sibling list)
- The breadcrumb «Project» segment provides one click to reach the project list — sufficient for the rare cross-RFQ navigation case

If user feedback later shows demand for sibling navigation, revisit in a future ADR (e.g. ADR-336).

### 5.FF.7 i18n keys (additional)

| Key | el | en |
|-----|----|----|
| `rfqs.detail.projectLink.aria` | Δες σελίδα έργου: {{projectName}} | View project page: {{projectName}} |
| `rfqs.detail.projectIcon.aria` | Έργο | Project |
| `rfqs.detail.breadcrumb.projectSegmentPrefix` | Έργο | Project |

---

## 5.GG Date / Time Formatting (context-aware, Greek-first)

Different contexts demand different date formats. This section establishes the canonical patterns used across all surfaces in the RFQ detail page; all other ADRs and components should follow the same conventions for consistency.

### 5.GG.1 Three context patterns

| Pattern | Use for | Example |
|---------|---------|---------|
| **A — Relative** | Activity timestamps (recent past): `submittedAt`, `createdAt`, audit events, live-change toasts (§5.J.5), last-invited indicator (§5.Y.4) | «πριν 2 ώρες» |
| **B — Deadline (absolute + relative)** | Future commitments: RFQ `deadline`, quote `validUntil`, scheduled actions | «έως 5 Μαΐου — σε 5 ημέρες» |
| **C — Precise** | Audit detail panels, error messages, debug info | «15/04/2026 14:23:45» |

**Tooltip rule:** wherever a relative or compact date is shown, the precise timestamp MUST be available via tooltip on hover (and via the `dateTime` attribute on `<time>`).

### 5.GG.2 Pattern A — Relative

Logic ladder (apply in order, first match wins):

```
< 60s                           → «μόλις τώρα»
< 60min                         → «πριν Ν λεπτό/-ά»  (or «πριν Ν λεπτά» plural)
< 24h                           → «πριν Ν ώρα/-ες»
within yesterday's calendar day → «χθες στις HH:mm»
< 7 days (and not yesterday)    → «πριν Ν ημέρες» (with «numeric: auto» for «προχθές»)
same calendar year              → «15 Απρ» (compact absolute)
older year                      → «15 Απρ 2025»
```

Implementation uses `Intl.RelativeTimeFormat('el-GR', { numeric: 'auto' })` for natural Greek wording where applicable («χθες», «προχθές», «αύριο», «μεθαύριο», «πέρσι», «φέτος»).

### 5.GG.3 Pattern B — Deadline (absolute + relative)

Format: `«{absolute medium} — {relative}»`.

Examples:
| State | Output |
|-------|--------|
| Future (5 days away) | «5 Μαΐου 2026 — σε 5 ημέρες» |
| Future (1 day away) | «αύριο» (compact when relative is enough) |
| Future (today) | «σήμερα στις 18:00» |
| Past (1 day overdue) | «έληξε 1 Μαΐου — πριν 1 ημέρα» |
| Past (>30 days overdue) | «έληξε 15 Μαρτίου 2026» (relative dropped — too distant) |

The format helper inspects the delta and chooses the most concise readable form.

### 5.GG.4 Pattern C — Precise

For audit details, history panels' detailed view, error messages, debug surfaces:

```
15/04/2026 14:23:45
```

Or with weekday for high-precision audit views:

```
Παρασκευή, 15 Απριλίου 2026, 14:23:45
```

Use `Intl.DateTimeFormat('el-GR', { dateStyle: 'full', timeStyle: 'medium' })` for the verbose form.

### 5.GG.5 Helper module

```ts
// src/lib/datetime/format.ts
export function formatRelative(date: Date | Timestamp | null, now?: Date): string;
export function formatAbsolute(date: Date | Timestamp | null, options?: Intl.DateTimeFormatOptions): string;
export function formatDeadline(date: Date | Timestamp | null, options?: { dropRelativeAfterDays?: number }): string;
export function formatPrecise(date: Date | Timestamp | null): string;
export function formatTooltip(date: Date | Timestamp | null): string; // verbose, weekday-included
```

All helpers handle `null` / `undefined` by returning `'—'` (em dash). Never throw on bad input.

**Phase A.0 verification:** grep first for existing helpers (`formatDate`, `formatTimeAgo`, `useRelativeTime`, `dayjs`, `date-fns`). The codebase likely has some — reuse and extend per CLAUDE.md SSOT. Do NOT introduce a new date library if `Intl` covers the needs (it does for everything in this section).

### 5.GG.6 Semantic HTML

Wherever a relative or compact date is rendered:

```tsx
<time dateTime={date.toISOString()} title={formatTooltip(date)}>
  {formatRelative(date)}
</time>
```

Benefits:
- Browsers and screen readers expose the precise timestamp
- Copy-paste extracts the readable text
- Tooltip provides full context on hover
- `dateTime` attribute facilitates future enhancements (e.g. user-locale override)

### 5.GG.7 Time-only / Date-only handling

| Source field type | Render format |
|-------------------|---------------|
| Date-only (no time component, e.g. RFQ deadline if stored as date) | «5 Μαΐου 2026» — no time |
| DateTime (most fields like `submittedAt`) | «15 Απρ 2026, 14:23» |
| Time-only (rare in this domain) | «09:00» |

The helper inspects whether the source has a meaningful time component (e.g. `00:00:00.000` UTC suggests date-only). If unsure, default to DateTime format.

### 5.GG.8 Edge cases

| Scenario | Behavior |
|----------|----------|
| `null` or `undefined` | «—» (em dash); never throw |
| Date in future where past is expected (clock skew) | «μόλις τώρα» — defensive against minor skews |
| Date >100 years in future/past | Fall back to absolute format (likely a data bug — visible to user) |
| Server `Timestamp` object (Firestore) | Helpers accept both `Date` and Firestore `Timestamp` (call `.toDate()` internally) |
| Locale change at runtime (rare) | Helpers re-evaluate on each call — consumers re-render via React state propagation |

### 5.GG.9 Tooltip vs visible text consistency

Some examples to enforce alignment:

| Visible | Tooltip |
|---------|---------|
| «πριν 2 ώρες» | «Παρασκευή, 15 Απριλίου 2026, 12:23» |
| «χθες στις 14:23» | «Πέμπτη, 14 Απριλίου 2026, 14:23» |
| «5 Μαΐου — σε 5 ημέρες» | «Δευτέρα, 5 Μαΐου 2026 (σε 5 ημέρες)» |
| «έληξε 1 Μαΐου — πριν 1 ημέρα» | «Πέμπτη, 1 Μαΐου 2026 (πριν 1 ημέρα)» |

The tooltip always wins on precision; the visible text always wins on brevity.

### 5.GG.10 Out of scope

| Item | Status |
|------|--------|
| User-configurable date format preferences | Out — not in current product scope |
| Multi-locale support (English, etc.) | Out — Greek-first; English is documentation language only per CLAUDE.md top |
| Timezone selection (if Greek customers need to handle different TZs) | Out — assume `Europe/Athens` for now; revisit if customer base extends |
| Calendar week numbers | Out — not used in procurement workflows here |

### 5.GG.11 i18n keys

These keys are Greek-only (English mirrors per project convention) and used by the helpers via `Intl` interpolation:

| Key | el | en |
|-----|----|----|
| `datetime.relative.justNow` | μόλις τώρα | just now |
| `datetime.relative.minutesAgo` | πριν {{n}} λεπτό | {{n}} minute ago |
| `datetime.relative.minutesAgo_plural` | πριν {{n}} λεπτά | {{n}} minutes ago |
| `datetime.relative.hoursAgo` | πριν {{n}} ώρα | {{n}} hour ago |
| `datetime.relative.hoursAgo_plural` | πριν {{n}} ώρες | {{n}} hours ago |
| `datetime.relative.yesterdayAt` | χθες στις {{time}} | yesterday at {{time}} |
| `datetime.relative.daysAgo` | πριν {{n}} ημέρες | {{n}} days ago |
| `datetime.deadline.future` | {{absolute}} — σε {{n}} ημέρες | {{absolute}} — in {{n}} days |
| `datetime.deadline.today` | σήμερα στις {{time}} | today at {{time}} |
| `datetime.deadline.tomorrow` | αύριο | tomorrow |
| `datetime.deadline.expiredRecent` | έληξε {{absolute}} — πριν {{n}} ημέρες | expired {{absolute}} — {{n}} days ago |
| `datetime.deadline.expiredOld` | έληξε {{absolute}} | expired {{absolute}} |
| `datetime.empty` | — | — |

The actual `Intl` API is preferred over manual interpolation for plural rules (`Intl.PluralRules`) — these keys are fallbacks if a specific phrasing is needed beyond what `Intl` produces.

---

## 5.HH Pending Design Questions — Post-Implementation Discussion

> **🚧 PENDING — to be discussed AFTER ADR-328 implementation is complete**

The following design questions have been **identified but not resolved** during the ADR-328 design phase. Per Giorgio's directive (2026-04-30), these are deliberately deferred to post-implementation discussion: once the structural refactor ships and we have hands-on experience with the new page, decisions on these items become more grounded and lower-risk.

**Workflow:** when the ADR-328 implementation is merged and stable, revisit each item below. For each, decide:
- Drop entirely (turned out unnecessary)
- Open dedicated future ADR (significant scope)
- Add as small follow-up to an existing future ADR (e.g. ADR-333 edit dialog)

### 5.HH.1 Permissions / RBAC integration

**Question:** Who is allowed to perform which actions on the RFQ detail page?

Examples:
- Award winner — only manager, or any authenticated user?
- Scan PDF — any user?
- Edit RFQ lines — only creator + project manager?
- Cancel PO / revert award — restricted to admins?
- Send vendor notifications (§5.V) — any user, or restricted?

**Why deferred:** RBAC is cross-cutting across the whole app (CLAUDE.md mentions 10 roles). Wiring procurement-specific permissions requires coordination with `src/lib/auth/roles.ts` and the existing `withAuth()` middleware. ADR-328 ships permission-agnostic; whoever can already access the page can do all the actions designed in this ADR. Tightening happens in a follow-up ADR.

**Default behavior in ADR-328:** all authenticated users with access to the page can perform all actions. No additional gates.

### 5.HH.2 Drag & drop upload for PDF scanning

**Question:** Should the RFQ detail page support drag-and-drop file upload (multiple PDFs at once) directly into the QuoteList, triggering the §5.H async scan flow?

**Why deferred:** Nice-to-have UX upgrade, but the current «Σάρωση» button in `PageHeader` (§5.A.1) already exposes the scan flow. Drag-and-drop is a productivity boost, not a blocker. Discuss after ship — if users routinely scan multiple PDFs, prioritize.

**Default behavior in ADR-328:** click button only. No drag-and-drop.

### 5.HH.3 Print / Export comparison

**Question:** Should the comparison panel be exportable as PDF or Excel (.xlsx)?

Use cases:
- Send to project manager who isn't in the system
- Print for in-person procurement meeting
- Archive for long-term record-keeping

**Why deferred:** Already mentioned as «Phase 2» in §5.A.2 (Tab Σύγκριση no action button initially). Exporters are non-trivial: layout, branding, locale-aware columns, currency formatting. Best handled by a dedicated export ADR. May overlap with ADR-331 (construction-grade comparison).

**Default behavior in ADR-328:** no export. View-only on screen.

### 5.HH.4 RFQ template / clone

**Question:** Should a user be able to create a new RFQ by cloning an existing one (e.g. «Πόρτες ξύλινες — Έργο A» → «Πόρτες ξύλινες — Έργο B» with same lines and invitee list)?

**Why deferred:** Productivity feature, common in procurement systems (Procore, Ariba). But touches the creation flow which is itself out of scope (§5.DD). Bundles naturally with ADR-334 (creation flow refinement) — discuss together when ADR-334 is opened.

**Default behavior in ADR-328:** no clone. Each RFQ created from scratch.

### 5.HH.5 Quote attachments beyond the source PDF

**Question:** Can a quote have additional attachments? Examples:
- Technical specs as separate PDFs
- CAD drawings (DXF / DWG)
- Product datasheets
- Photos of physical samples
- Vendor presentations

**Why deferred:** Overlaps significantly with ADR-333 (Quote Edit Dialog — §5.CC.3). Attachment management UI (upload, list, preview, delete, download) is a feature in itself. The current AI extraction handles a single PDF per quote. Discuss as part of ADR-333 or as a sibling ADR after.

**Default behavior in ADR-328:** quote has at most one source PDF (§5.O). No multi-file attachments.

### 5.HH.6 Tracking

When ADR-328 implementation ships and these items become discussable:

1. Schedule a follow-up review session
2. For each item, decide: drop / dedicated ADR / fold into existing future ADR
3. Update this section with the disposition (cross out + link to the resolution)
4. Once all 5 items are resolved, this section can be removed entirely

The section exists primarily as a memory anchor — preventing these threads from being silently lost between the ADR design phase and post-implementation iteration.

---

## 6. Phase A.0 Verification Checklist

Before writing any production code, the implementer runs this checklist. Each item is a **search-first / audit-first** step required by the SSOT and Google-level discipline mandated in CLAUDE.md.

### 6.1 Required reads

| ID | What to verify | Section ref | Outcome documents |
|----|----------------|-------------|--------------------|
| V1 | `ModuleBreadcrumb` API — does it accept project segment? | §5.FF.4 | If not, extend additively |
| V2 | `PageHeader` (`@/core/headers`) — does it expose `subtitle`/`description` slot in title? | §5.FF.4 | If not, extend additively |
| V3 | `RFQ` document — has `projectName` denormalized? Has `category`? Has `status`? | §5.FF.4 / §5.DD.3 / §5.EE.3 | Surface gaps; do not change creation flow |
| V4 | `Quote` document — has `validUntil`? Has `vatIncluded` / `laborIncluded` (per ADR-327)? | §5.BB.12 / §5.X.2 | If `validUntil` missing, surface for ADR-327 follow-up |
| V5 | `useQuotes`, `useComparison`, `useRfqLines`, `useVendorInvites`, `useSourcingEventAggregate` — do they use `onSnapshot` or one-shot fetch? | §5.J.2 | Convert one-shots to `onSnapshot` as part of Phase A |
| V6 | Firestore `enableIndexedDbPersistence` (or `persistentLocalCache`) — already enabled at app init? | §5.L.4 | Enable if missing |
| V7 | Existing `useMediaQuery` / `useBreakpoint` / `useIsMobile` hook — present? | §5.E.6 | Reuse if present; otherwise add `src/hooks/useMediaQuery.ts` |
| V8 | Existing `useOnlineStatus` / `useFirestoreStatus` hooks — present? | §5.L.1 | Reuse or add minimal helpers |
| V9 | Existing `PdfViewer` component — extracted as reusable, or embedded in `QuoteReviewClient`? | §5.O.5 | Extract if embedded; share between review and RFQ detail |
| V10 | `QuoteList` — current props (`onSelectQuote`, `selectedQuoteId`, search, sort, status filter)? | §3 / §5.P.6 / §5.W.1 | Extend with sort dropdown if missing |
| V11 | `QuoteDetailSummary` — used in `/procurement/quotes` page already? Self-contained auth? | §3 | Reuse as-is in right pane |
| V12 | `QuoteDetailsHeader` (ADR-267 SSoT) — supports `primaryActions` / `secondaryActions` / `overflowActions` slots? | §5.I.6 | Extend additively if API gaps |
| V13 | `ComparisonPanel` — has `onRowClick`? Currently surfaced fields? | §5.D.3 / §5.T.2 / §5.T.3 | Add `onRowClick` prop if missing; populate §5.T.3 audit table |
| V14 | `VendorInviteSection` — current send dialog UX? Multi-select? Contact integration? | §5.Y.1 | Extend or rebuild per §5.Y |
| V15 | Outbound email service — exists? (Mailgun outbound, used by ADR-070 / ADR-071?) | §5.V.4 / §5.Y.9 / §5.BB.6 | If absent, ADR-332 is a hard prerequisite |
| V16 | Greek decimal parse / format helpers (`parseLocaleNumber`, `formatCurrency`, `formatEuro`) | §5.Z.6 | Reuse if present; otherwise add to `src/lib/number/` |
| V17 | Date helpers (`formatDate`, `formatTimeAgo`, `useRelativeTime`) — present? Library used (date-fns, dayjs, native Intl)? | §5.GG.5 | Prefer native `Intl`; reuse existing wrappers if compatible |
| V18 | Validation library — Zod / Yup / react-hook-form already used? | §5.Z.7 | Reuse same library; do not introduce a new one |
| V19 | Predefined units list (`UNITS`, `UNIT_OF_MEASURE`) — present? | §5.Z.5 | Extend if present, otherwise add per §5.Z.5 |
| V20 | Greek fuzzy string match helper (Levenshtein-aware, accent-insensitive) — present? | §5.AA.12 | Add at `src/lib/string/fuzzy-greek.ts` if absent |
| V21 | `EntityAuditService` (ADR-195) — confirmed in use, write entry pattern stable? | §5.F + §5.V.5 + §5.X + §5.AA.10 + §5.Y.10 | Reuse for all audit entries in this ADR |
| V22 | Existing toast / snackbar system (sonner / radix-ui/toast) — used app-wide? | §5.F + §5.H + §5.J.5 + §5.AA.2 | Reuse; do not add new toast lib |
| V23 | `DirtyFormProvider` (or equivalent unsaved-form context) — present? | §5.K.5 | Reuse or add per §5.K |
| V24 | Browse views currently rendering AI confidence percentages? | §5.CC.2 | Remove from browse views; preserve fields in Firestore |
| V25 | Existing creation flow (`/procurement/rfqs/new` or modal) — required vs optional fields | §5.DD.3 | Document current state in §5.DD.3 table; do not modify in this ADR |
| V26 | Existing RFQ status field — values, set-points, read-only behavior | §5.EE.3 | Document in §5.EE.3 table; do not modify in this ADR |

### 6.2 Verification deliverables

After running V1–V26, the implementer produces a single artifact: a markdown table summarizing each item's outcome. This artifact is **committed alongside the ADR** in the same PR — likely inline in §5.T.3, §5.DD.3, §5.EE.3, plus a top-level summary added below this section in a future commit.

If any verification step reveals a missing prerequisite that blocks ADR-328 (e.g. V15 outbound email absent, V21 EntityAuditService not actually wired), implementation stops and the prerequisite ADR is opened first.

### 6.3 Non-blocking gaps

Some gaps are acceptable to ship around (with documented fallbacks):
- V4 `validUntil` missing → §5.BB graceful degradation (no expiry badges/banners) — acceptable
- V13 `ComparisonPanel.onRowClick` missing → add the prop in same PR — acceptable
- V20 fuzzy Greek match missing → add it in same PR (~30 lines) — acceptable

Hard blockers (cannot ship around):
- V15 outbound email missing → ADR-332 first
- V21 EntityAuditService not in use → halt, escalate to architecture
- V11 `QuoteDetailSummary` requires server-side data not exposed → halt, fix data layer first

### 6.4 Phase 0 findings (executed 2026-04-30)

**0 hard blockers. 15 non-blocking gaps. Implementation green-lit.**

#### 6.4.1 Hard blockers
None. All three hard-blocker conditions are clear:
- ✅ **V15** — outbound email EXISTS: `src/subapps/procurement/services/channels/email-channel.ts` (Resend + Mailgun fallback, ADR-327 §7.2)
- ✅ **V21** — `EntityAuditService` IS in use in procurement domain (`rfq-line-service.ts`). Dead import in `quote-service.ts` is a minor inconsistency, not a blocker.
- ✅ **V11** — `QuoteDetailSummary` is self-contained: uses `useAuth()` for companyId, no external data dependency.

#### 6.4.2 Full V1–V26 outcome table

| ID | Outcome | Phase to address |
|----|---------|-----------------|
| V1 | ⚠️ `ModuleBreadcrumb` has `procurement`+`quotes` in `SEGMENT_CONFIG` but NO `rfqs` entry → breadcrumb stops at «Procurement» for RFQ detail URL | Phase 1: add `rfqs` entry + dynamic last-segment support |
| V2 | ✅ `PageHeader` has `subtitle?: string` in `HeaderTitleProps`, `customActions` array in `HeaderActionsProps` — fully usable as-is | — |
| V3 | ⚠️ `RFQ` has `status`, `projectId` ✅ but NO `projectName` denormalized and NO `category` field | Phase 1: resolve project name from `projectId` (fetch or prop-drill); `category` absent from schema (document for ADR-334) |
| V4 | ⚠️ `Quote.validUntil: Timestamp\|null` ✅; `vatIncluded`/`laborIncluded` nested in `extractedData` (not direct fields) | Non-blocking per §6.3 — access via `quote.extractedData?.vatIncluded?.value` |
| V5 | ❌ ALL hooks (`useQuotes`, `useComparison`, `useRfqLines`, `useVendorInvites`) use one-shot HTTP fetch, NOT `onSnapshot` | Phase 5: convert to Firestore onSnapshot |
| V6 | ❌ No `persistentLocalCache` / `enableIndexedDbPersistence` in `src/lib/firebase.ts` | Phase 5: enable at app init |
| V7 | ✅ `useIsMobile` exists at `src/hooks/useMobile.tsx` (uses `MOBILE_BREAKPOINT` constant, SSR-safe with `undefined` init) | Reuse as-is — no new `useMediaQuery.ts` needed |
| V8 | ❌ No `useOnlineStatus` / `useFirestoreStatus` hook found | Phase 14: add minimal `useOnlineStatus` (~15 lines) |
| V9 | ⚠️ No dedicated `PdfViewer` component. PDF rendering done via `FilePreviewRenderer` + `QuoteOriginalDocumentPanel` (ADR-031/191 SSoT). Embedded in review page, already reusable. | Phase 11: use `FilePreviewRenderer` directly — no extraction needed |
| V10 | ✅ `QuoteList` has `onSelectQuote`, `selectedQuoteId`, internal search, 4-option sort, `QuoteStatusQuickFilters` — all props present | — |
| V11 | ✅ `QuoteDetailSummary` is self-contained (uses `useAuth()` for companyId). Used in `/procurement/quotes` page ✅ | — |
| V12 | ✅ `QuoteDetailsHeader` supports `onCreateNew`, `onEdit`, `onArchive` via `createEntityAction`. Single `actions` array — no explicit `primaryActions`/`secondaryActions` split. Sufficient for ADR-328 needs. | Phase 12: extend additively if more action slots needed |
| V13 | ❌ `ComparisonPanel` has NO `onRowClick` prop. Fields shown: total, score, breakdown bars, flags, award button ✅. Missing: vatIncluded, laborIncluded, deliveryDays, paymentTerms, warranty (all deferred to ADR-331). | Phase 3: add `onRowClick` prop (non-blocking per §6.3) |
| V14 | ✅ `VendorInviteSection` + `useVendorInvites` hook — supports create/revoke, no multi-select yet, contact integration via API | Phase 12: extend per §5.Y |
| V15 | ✅ **CLEAR** — see §6.4.1 | — |
| V16 | ⚠️ `formatCurrency` + `formatDate` exist in `src/lib/intl-formatting.ts`. `parseLocaleNumber` NOT found. `formatEuro` not a separate function (use `formatCurrency`). | Phase 13: add `parseLocaleNumber` to `src/lib/number/` |
| V17 | ⚠️ `formatDate` + `formatDateTime` exist ✅. `formatTimeAgo` / `useRelativeTime` NOT found. Library: native `Intl` API ✅ (preferred). | Phase 5.C / wherever relative time first needed: add ~20-line `formatTimeAgo` using `Intl.RelativeTimeFormat` |
| V18 | ✅ `zod` used in procurement API routes. `react-hook-form` absent from procurement — plain state used. Zod is the validation library to use. | — |
| V19 | ❌ No `UNITS` / `UNIT_OF_MEASURE` list in procurement. Hardcoded `'τμχ'` default in `materializeQuoteLines`. | Phase 13: add predefined units list per §5.Z.5 |
| V20 | ⚠️ `matchesSearchTerm` + `normalizeSearchText` exist in `src/lib/search/search.ts` — handles Greek diacritics + final sigma (σ/ς) ✅. No Levenshtein distance. Substring match sufficient for Phase 7 quote search. | Phase 7: use `matchesSearchTerm`; full Levenshtein optional (≤30 lines if needed) |
| V21 | ✅ **CLEAR** — see §6.4.1. `EntityAuditService` dead import in `quote-service.ts` is tech debt. | Phase 15: clean dead import |
| V22 | ✅ `sonner` toast used throughout procurement (confirmed in `QuoteReviewClient.tsx`, `NotificationProvider.tsx`). | — |
| V23 | ❌ `DirtyFormProvider` / `useDirtyForm` NOT found anywhere. | Phase 14: create `src/context/DirtyFormProvider.tsx` per §5.K |
| V24 | ✅ AI confidence NOT in browse views. `overallConfidence` appears only in `ExtractedDataReviewPanel` (review/edit page ✅) and `RecommendationCard` (comparison tab summary ✅ — appropriate). | — |
| V25 | ✅ Creation flow documented — see §5.DD.3. Only `title` + `projectId` required. Non-blocking. | ADR-334 |
| V26 | ✅ RFQ status documented — see §5.EE.3. Gap: award does NOT flip `status`; no close UI. Non-blocking per §5.EE.2. | ADR-335 |

#### 6.4.3 Non-blocking gaps summary

| # | Gap | Phase |
|---|-----|-------|
| G1 | `rfqs` segment missing from `ModuleBreadcrumb.SEGMENT_CONFIG` | 1 |
| G2 | `projectName` not denormalized on `RFQ` — must fetch from `projectId` | 1 |
| G3 | `vatIncluded`/`laborIncluded` nested in `extractedData`, not top-level on `Quote` | Non-issue (access path known) |
| G4 | All 5 hooks use one-shot fetch, not `onSnapshot` | 5 |
| G5 | No Firestore IndexedDB persistence enabled | 5 |
| G6 | No `useOnlineStatus` hook | 14 |
| G7 | No dedicated `PdfViewer` — use `FilePreviewRenderer` SSoT | 11 |
| G8 | `ComparisonPanel` missing `onRowClick` | 3 |
| G9 | `parseLocaleNumber` missing | 13 |
| G10 | `formatTimeAgo` missing | 5.C (first use) |
| G11 | No predefined units list | 13 |
| G12 | No Levenshtein fuzzy match — substring match sufficient | 7 (optional extension) |
| G13 | `EntityAuditService` dead import in `quote-service.ts` | 15 (cleanup) |
| G14 | No `DirtyFormProvider` | 14 |
| G15 | `category` not in `RFQ` schema | ADR-334 (document only) |

---

## 7. Implementation Phases — Session-Atomic Plan

### 7.0 Workflow rules (non-negotiable)

The implementation is split into **16 atomic phases** (Phase 0 through Phase 15). Each phase is sized to fit in **one Claude Code session with clean context, without noise**. After each phase:

1. **The implementer updates this ADR** with what was actually built (changelog row + phase-specific notes section)
2. **The implementer writes a handoff document** at `.claude-rules/adr-328-handoff-after-phase-N.md` (see §7.2 template)
3. **A new clean session is started** (`/clear` or new agent) for the next phase
4. **The next session reads the handoff** as its primary context, plus the relevant ADR sections

This is a **non-negotiable** workflow per Giorgio's directive (2026-04-30). Skipping the ADR update or handoff document corrupts the chain — every phase MUST close with both.

### 7.1 Universal phase cycle

Each session follows this cycle:

```
┌─ Pre-flight (5 min) ──────────────────────────────────────┐
│ 1. Read the handoff doc from previous phase               │
│ 2. Read the relevant ADR §§ for current phase             │
│ 3. Confirm the suggested model (per CLAUDE.md N.14)       │
│    Wait for «ok» before any tool call                     │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Implementation (~2-3h) ──────────────────────────────────┐
│ 4. Run the phase's pre-flight grep checks                 │
│ 5. Write code per phase deliverables                      │
│ 6. Manual smoke test (golden path for this phase)         │
│ 7. TypeScript check (`npx tsc --noEmit`, in background)   │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Post-flight (~15 min) ───────────────────────────────────┐
│ 8. Update ADR §X.Y with «Phase N implemented» notes       │
│ 9. Add changelog row dated today                          │
│ 10. Write handoff doc for next session                    │
│ 11. Commit (NO PUSH — wait for Giorgio order)             │
│ 12. Hand off to Giorgio: «Phase N complete. Handoff at X.»│
└────────────────────────────────────────────────────────────┘
```

### 7.2 Handoff document template

Every phase produces `.claude-rules/adr-328-handoff-after-phase-N.md` with this exact structure:

```markdown
# ADR-328 Handoff — After Phase N: <Title>

**Date:** YYYY-MM-DD
**Phase completed:** N (<title>)
**Phase next:** N+1 (<title>)

## What was built
- File: `path/to/file.tsx` — created (~120 lines): <one-line description>
- File: `path/to/other.ts` — modified: <what changed>
- ...

## What was NOT built (deferred or skipped)
- ...

## Deviations from the ADR spec
- §X.Y: implemented as <Y'> instead of <Y> because <reason>
- (none) — if no deviations

## Known issues / TODOs
- ...
- (none) — if clean

## Verification status
- [x] TypeScript: clean
- [x] Manual golden path: passed
- [x] Cross-tab works: ...
- [ ] (anything not yet verified, with reason)

## Required reads for next session
- ADR §<sections relevant to next phase>
- Files: ...
- Existing handoff: .claude-rules/adr-328-handoff-after-phase-N-1.md (if any)

## Suggested model for next session
- <Haiku 4.5 | Sonnet 4.6 | Opus 4.7>
- Reason: <one line>

## Pending Giorgio decisions
- (none) — if clear
- Or: <decision needed>
```

This document is the **only context** the next session needs to start cleanly.

### 7.3 Phase index

| # | Phase | Goal | Depends on | Est. | Suggested model |
|---|-------|------|------------|------|------------------|
| 0 | Verification | Run V1–V26 audits; populate ADR tables | — | 2–3h | Sonnet 4.6 |
| 1 | Foundation | PageHeader + Breadcrumb + Tabs + URL state | 0 | 2–3h | Sonnet 4.6 |
| 2 | Quotes Tab | Split layout list↔detail + mobile navigated | 1 | 2–3h | Sonnet 4.6 |
| 3 | Comparison Tab | Relocate components + empty states + drill-down | 1 | 2h | Sonnet 4.6 |
| 4 | Setup Tab | Relocate components + lock state + banner | 1 | 2h | Sonnet 4.6 |
| 5 | Real-time + Locking | onSnapshot + Tx helper + ConflictDialog + live toasts | 1 | 3h | Opus 4.7 |
| 6 | Stats + Badges | Per-tab dashboard + attention badges + eye-toggle | 1 | 2h | Sonnet 4.6 |
| 7 | Sort + Search | quote-sort + quote-search + URL params + dropdown | 2 | 2h | Sonnet 4.6 |
| 8 | Award + Reason | Optimistic+Undo + reason dialog + comparison banner | 5, 7 | 3h | Opus 4.7 |
| 9 | Versioning | Duplicate detection + auto-version + display + audit | 5, 8 | 3h | Opus 4.7 |
| 10 | Expiration + Scan | isExpired helpers + warning + renewal + scan queue | 8 | 2–3h | Sonnet 4.6 |
| 11 | PDF + Header Actions | PdfViewer extract + toggle + side panel/modal + header actions | 2 | 2–3h | Sonnet 4.6 |
| 12 | Vendor Communication | Invite dialog + Notification dialog + audit per recipient | 4, 8 | 3h | Sonnet 4.6 |
| 13 | Validation | line/quote validation + auto-calc + Greek decimals | 2, 4 | 2h | Sonnet 4.6 |
| 14 | Browser Nav + Offline | DirtyFormProvider + beforeunload + offline banner + action gates | 13 | 2h | Sonnet 4.6 |
| 15 | i18n + Polish + Finalize | All i18n keys + visual QA + future ADR stubs + status flip | all | 2–3h | Sonnet 4.6 |

**Total: ~37–45 hours of focused implementation across 16 sessions.**

### 7.4 Phase 0 — Verification & ADR Audit Population

**Goal:** Run §6 verification (V1–V26); populate audit tables (§5.T.3, §5.DD.3, §5.EE.3); identify hard blockers before any code is written.

**Depends on:** none (entry point)
**Blocks:** all subsequent phases

**Pre-flight checklist:**
- Read top-of-document «TIME-SENSITIVE NOTICE» — verify §5.Q assumption still holds
- Read §6 (V1–V26)
- Open these files to read (no edits): `src/subapps/procurement/types/quote.ts`, `src/subapps/procurement/services/quote-service.ts`, `src/components/shared/ModuleBreadcrumb.tsx`, `src/core/headers/index.ts`, `src/components/contacts/page/contactDashboardStats.ts`, `src/services/firebase/firestore.ts` (or equivalent init)

**Deliverables:**

| Output | Where |
|--------|-------|
| §5.T.3 audit table populated | inline in this ADR |
| §5.DD.3 audit table populated | inline in this ADR |
| §5.EE.3 audit table populated | inline in this ADR |
| Top-level «Phase 0 findings» summary added below §6 | inline in this ADR |
| List of hard blockers (if any) | inline + handoff doc |

**Out of scope:**
- Any code changes (this phase is read-only audit)
- Opening prerequisite ADRs (only flag them — don't write them)

**Validation:**
- [ ] Every V1–V26 has a documented outcome
- [ ] Every hard blocker is explicitly listed
- [ ] Non-blocking gaps are listed with proposed Phase X to address them

**Commit message:** `docs(adr-328 phase 0): verification audits + populated audit tables`

**ADR post-update:**
- Add §6.4 «Phase 0 findings (executed YYYY-MM-DD)» with summary
- Changelog row: «Phase 0 verification complete; X hard blockers, Y non-blocking gaps surfaced»

**Handoff focus for next session:** What's reusable, what needs extending, what's missing entirely.

### 7.5 Phase 1 — Foundation

**Goal:** RFQ detail page renders with PageHeader (with breadcrumb + project subtitle), 3-tab structure, URL state, smart defaults — but tab content is still the old layout (full-width stacked) inside placeholder TabsContent slots.

**Depends on:** Phase 0
**Blocks:** Phases 2, 3, 4, 5, 6, 7, 11

**Pre-flight checklist:**
- Read ADR §3 (full structure), §3.1, §3.2, §3.4, §5.E.4, §5.FF
- Read Phase 0 handoff for any blockers/gaps
- Re-read existing `RfqDetailClient.tsx` (current ~220 lines)

**Deliverables:**

| File | Action | Notes |
|------|--------|-------|
| `RfqDetailClient.tsx` | modified | PageHeader + ModuleBreadcrumb + Tabs + URL state hooks; old content moved into `<TabsContent>` placeholders |
| `src/subapps/procurement/hooks/useRfqUrlState.ts` | new (~80 lines) | URL state read/write helpers; push/replace logic |
| `src/hooks/useMediaQuery.ts` | new IF V7 said missing (~15 lines) | SSR-safe |
| `src/i18n/locales/{el,en}/quotes.json` | append i18n keys | smart-default, breadcrumb, project keys |

**Out of scope:**
- New tab content (Phases 2–4)
- Stats dashboard (Phase 6)
- Tab badges (Phase 6)
- Sort / search (Phase 7)
- Lock state UX (Phase 4)

**Validation:**
- [ ] Tabs visible, click switches via URL push
- [ ] Refresh `?tab=comparison` lands on Comparison tab
- [ ] Old content still renders inside its (likely default) tab
- [ ] PageHeader subtitle clickable → project page
- [ ] No regressions on the existing user flow (just relocated UI)

**Commit message:** `feat(adr-328 phase 1): foundation — PageHeader, breadcrumb, tabs, URL state`

**ADR post-update:** Note Phase 1 implementation date in changelog. If `useRfqUrlState` deviated from §3.4 spec, document why.

### 7.6 Phase 2 — Quotes Tab Split Layout

**Goal:** Tab «Προσφορές» renders the split layout (left list 380px, right detail flex) on desktop; mobile shows list OR detail per Material 3 navigated pattern.

**Depends on:** Phase 1
**Blocks:** Phases 7, 11, 13

**Pre-flight checklist:**
- Read ADR §3, §3.2, §5.E, §5.O.1 (PDF preview default off)
- Re-read `QuoteList.tsx` to confirm `onSelectQuote` and `selectedQuoteId` props (V10)
- Re-read `QuoteDetailSummary.tsx` to confirm self-contained auth (V11)
- Read Phase 1 handoff

**Deliverables:**

| File | Action | Notes |
|------|--------|-------|
| `RfqDetailClient.tsx` | modified | Tab «Προσφορές» content: grid layout, mobile responsive |
| Possibly `QuoteList.tsx` | modified | If `selectedQuoteId` highlight not present, add minimal CSS |

**Out of scope:**
- Sorting UI (Phase 7)
- Search UI (Phase 7)
- PDF preview toggle (Phase 11)
- Tab badge (Phase 6)
- §5.S.2 / §5.S.3 / §5.C empty states (Phases 3 / Phase later)

**Validation:**
- [ ] Click quote in list → right pane updates
- [ ] URL `?quote=<id>` updates via `replace` on desktop, `push` on mobile
- [ ] Refresh restores selection
- [ ] Mobile (< 768px): list visible by default, click quote → detail full-width with «Πίσω στη λίστα» button
- [ ] If `quotes.length === 0` → §5.C empty state placeholder (basic shell — full empty state in later phase)

**Commit message:** `feat(adr-328 phase 2): Quotes tab split layout (desktop + mobile navigated)`

### 7.7 Phase 3 — Comparison Tab Relocation + Empty States + Drill-Down

**Goal:** Tab «Σύγκριση» renders existing `ComparisonPanel` + `SourcingEventSummaryCard`, plus §5.S.2 (0 quotes) and §5.S.3 (1 quote) empty states. Comparison row click drills into Quotes tab with selection.

**Depends on:** Phase 1
**Blocks:** —

**Pre-flight checklist:**
- Read §5.D, §5.S
- Re-read `ComparisonPanel.tsx` to confirm `onRowClick` prop (V13)
- Read Phase 0 §5.T.3 audit findings
- Read Phase 1 handoff

**Deliverables:**

| File | Action |
|------|--------|
| `RfqDetailClient.tsx` | modified — Tab «Σύγκριση» content |
| `src/subapps/procurement/components/ComparisonEmptyState.tsx` | new (~100 lines) |
| `ComparisonPanel.tsx` | modified — add `onRowClick`, visual affordance, stopPropagation on inner buttons |
| i18n keys | append §5.S, §5.D keys |

**Validation:**
- [ ] 0 quotes: educational empty state with CTAs visible
- [ ] 1 quote: summary card + threshold message
- [ ] ≥2 quotes: existing comparison panel renders normally
- [ ] Click row → switches to Quotes tab + selects that quote (single push)
- [ ] Stop propagation works on award/inner buttons

**Commit:** `feat(adr-328 phase 3): Comparison tab — empty states + row drill-down`

### 7.8 Phase 4 — Setup Tab Relocation + Lock State + Banner

**Goal:** Tab «Ρύθμιση» renders existing `RfqLinesPanel` + `VendorInviteSection`, with §5.G granular lock state when awarded or PO-locked. Banner with revert/cancel-PO actions.

**Depends on:** Phase 1
**Blocks:** Phases 12, 13

**Pre-flight:** §5.G, §5.EE.2 (tolerance contract)

**Deliverables:**

| File | Action |
|------|--------|
| `RfqDetailClient.tsx` | modified — Tab «Ρύθμιση» content |
| `src/subapps/procurement/utils/rfq-lock-state.ts` | new (~30 lines) |
| `RfqLinesPanel.tsx` | modified — receive `lockState` prop, disable add/edit/delete |
| `VendorInviteSection.tsx` | modified — receive `lockState` prop, disable add/reminder/resend, keep cancel-pending |
| New `<SetupLockBanner>` component | new (~60 lines) |
| i18n keys | §5.G keys |

**Validation:**
- [ ] No award yet → all controls enabled
- [ ] After award (no PO) → lines locked, invite cancel still works, banner shows revert action
- [ ] After PO → all locked, banner shows cancel-PO action

**Commit:** `feat(adr-328 phase 4): Setup tab lock state + banner`

### 7.9 Phase 5 — Real-time + Optimistic Locking

**Goal:** All hooks use `onSnapshot`. Schema additions (`version`, `updatedAt`, `updatedBy`) on conflict-prone documents. Transaction helper for critical writes. `ConflictDialog` component. Live-change toasts.

**Depends on:** Phase 1
**Blocks:** Phases 8, 9

**Pre-flight:** §5.J full, §5.AA.4 schema

**Deliverables:**

| File | Action |
|------|--------|
| Each hook (`useQuotes`, `useComparison`, `useRfqLines`, `useVendorInvites`, `useSourcingEventAggregate`) | modified — convert to `onSnapshot` if not already |
| `src/subapps/procurement/services/quote-versioning-service.ts` | partial new — transaction helpers (no full versioning logic yet — that's Phase 9) |
| `src/subapps/procurement/components/ConflictDialog.tsx` | new (~120 lines) |
| `src/subapps/procurement/hooks/useLiveChangeToasts.ts` | new (~80 lines) |
| Firestore offline persistence enabled (V6) | one-line change in init |

**Out of scope:**
- Full duplicate detection (Phase 9)
- Award flow itself (Phase 8 — uses these primitives)

**Validation:**
- [ ] Two browsers open same RFQ → change in one reflects in other within 1s
- [ ] Conflict scenario: simulate → ConflictDialog appears
- [ ] Live-change toast appears for remote changes, NOT for self changes

**Commit:** `feat(adr-328 phase 5): real-time sync + optimistic locking primitives`

### 7.10 Phase 6 — Stats Dashboard + Tab Badges

**Goal:** Per-tab dashboard cards (4 each), attention-driven tab badges, eye-toggle wiring.

**Depends on:** Phase 1
**Blocks:** —

**Pre-flight:** §5 / §5.5, §5.B, §3.3

**Deliverables:**

| File | Action |
|------|--------|
| `src/subapps/procurement/utils/rfq-dashboard-stats.ts` | new (~80 lines) |
| `RfqDetailClient.tsx` | modified — wire `UnifiedDashboard` + tab badges |
| i18n keys | §5 / §5.B keys |

**Validation:**
- [ ] Dashboard hidden by default
- [ ] Click eye → 4 cards appear, change with active tab
- [ ] Tab «Προσφορές» shows red badge with count when any `under_review`
- [ ] Tab «Σύγκριση» shows yellow dot when recommendation pending
- [ ] Tab «Ρύθμιση» shows yellow badge when invites need attention

**Commit:** `feat(adr-328 phase 6): per-tab stats dashboard + attention-driven badges`

### 7.11 Phase 7 — Sort + Search

**Goal:** Sort dropdown (5 options) + smart pattern-aware search, both URL-persistent.

**Depends on:** Phase 2
**Blocks:** —

**Pre-flight:** §5.P, §5.U, §5.W

**Deliverables:**

| File | Action |
|------|--------|
| `src/subapps/procurement/utils/quote-sort.ts` | new (~80 lines) |
| `src/subapps/procurement/utils/quote-search.ts` | new (~120 lines) |
| `QuoteList.tsx` | modified — add sort dropdown + use search/sort URL params |
| i18n keys | §5.P, §5.U, §5.W keys |

**Validation:**
- [ ] Default sort is `status-price` with group dividers
- [ ] Switching sort updates URL via `replace`
- [ ] Search «12500» → matches by price; «Q-2026» → by quote number; «boiler» → free text
- [ ] No matches → empty state with suggestions
- [ ] Refresh preserves sort + search

**Commit:** `feat(adr-328 phase 7): smart sort + pattern-aware search`

### 7.12 Phase 8 — Award Flow + Reason Capture

**Goal:** Optimistic award with Undo snackbar. Reason dialog when not the cheapest. Comparison header banner with non-modal PO CTA.

**Depends on:** Phase 5 (locking primitives), Phase 7 (sorted/searched list to know cheapest)
**Blocks:** Phases 9, 10

**Pre-flight:** §5.F, §5.X

**Deliverables:**

| File | Action |
|------|--------|
| `src/subapps/procurement/services/quote-award-service.ts` | new (~100 lines, uses §5.J transactions) |
| `src/subapps/procurement/components/AwardReasonDialog.tsx` | new (~150 lines) |
| `src/subapps/procurement/utils/quote-cheapest.ts` | new (~30 lines, naive netTotal — see §5.X.2) |
| `RfqDetailClient.tsx` | modified — comparison header banner + PO CTA |
| `ComparisonPanel.tsx` | modified — wire award through award-service |
| i18n keys | §5.F, §5.X keys |

**Validation:**
- [ ] Award cheapest → no reason modal, optimistic + Undo snackbar
- [ ] Award non-cheapest → reason modal first, then optimistic + Undo
- [ ] Header banner appears with «Δημιουργία Παραγγελίας →» CTA
- [ ] Concurrent test: simulate stale write → ConflictDialog from Phase 5 fires

**Commit:** `feat(adr-328 phase 8): award flow with optimistic+undo + reason capture`

### 7.13 Phase 9 — Versioning

**Goal:** Quote duplicate detection (multi-signal) + auto-version (high-confidence) + modal (medium/low) + display in QuoteList.

**Depends on:** Phases 5, 8
**Blocks:** —

**Pre-flight:** §5.AA full

**Deliverables:**

| File | Action |
|------|--------|
| `src/subapps/procurement/utils/quote-duplicate-detection.ts` | new (~80 lines) |
| `src/lib/string/fuzzy-greek.ts` | new IF V20 said missing (~30 lines) |
| `quote-versioning-service.ts` | extend Phase 5 file — `supersede`, `revertSupersede`, `createRevision` |
| `src/subapps/procurement/components/QuoteRevisionDetectedDialog.tsx` | new (~120 lines) |
| `QuoteListCard.tsx` (or equivalent) | modified — version badge + collapsible older versions |
| `useQuotes` | modified — accept `{ includeSuperseded }` option, default false |
| i18n keys | §5.AA keys |

**Validation:**
- [ ] Scan duplicate (same email + taxId) → auto-version + Undo toast
- [ ] Scan with only name fuzzy match → modal asks user
- [ ] Scan with PO already created → blocked with explanatory modal
- [ ] Older versions hidden in list by default; expandable

**Commit:** `feat(adr-328 phase 9): quote duplicate detection + versioning`

### 7.14 Phase 10 — Expiration + Async Scan UX

**Goal:** Expiration helpers + visual badges + warning modal + renewal composer. Async scan placeholder + grouped toast.

**Depends on:** Phase 8
**Blocks:** —

**Pre-flight:** §5.BB, §5.H

**Deliverables:**

| File | Action |
|------|--------|
| `src/subapps/procurement/utils/quote-expiration.ts` | new (~50 lines) |
| `src/subapps/procurement/components/ExpiredAwardWarningDialog.tsx` | new (~100 lines) |
| `src/subapps/procurement/components/QuoteRenewalRequestDialog.tsx` | new (~150 lines) |
| `src/subapps/procurement/hooks/useScanQueue.ts` | new (~80 lines) |
| `QuoteList.tsx` | modified — render scan placeholders inline + expiration badges |
| `QuoteDetailsHeader.tsx` (extension) | modified — render expiration banner |
| Award flow (Phase 8) | extended to invoke ExpiredAwardWarningDialog before §5.F |
| i18n keys | §5.BB, §5.H keys |

**Validation:**
- [ ] Expired quote in list → red badge
- [ ] Expiring soon → yellow badge
- [ ] Award expired → warning modal with 3 options
- [ ] «Ζήτησε ανανέωση» → renewal composer opens, send works
- [ ] Multiple parallel scans → grouped toast
- [ ] Scan failure → red placeholder with retry/delete

**Commit:** `feat(adr-328 phase 10): expiration handling + async scan UX`

### 7.15 Phase 11 — PDF Preview + Quote Header Actions

**Goal:** Extract `PdfViewer` to shared component if needed (V9). Toggle button in header. Side panel desktop / modal mobile. Lazy load. Status-aware quote header actions per §5.I.

**Depends on:** Phase 2
**Blocks:** —

**Pre-flight:** §5.O, §5.I, §5.CC.2 (cleanup any browse-view confidence rendering)

**Deliverables:**

| File | Action |
|------|--------|
| `src/components/pdf/PdfViewer.tsx` | new IF V9 says embedded — extract from review page |
| `QuoteReviewClient.tsx` | refactor to consume extracted PdfViewer |
| `QuoteDetailsHeader.tsx` (extension via SSoT extension if needed) | modified — primary/secondary/overflow slots |
| `src/subapps/procurement/utils/quote-header-actions.ts` | new (~120 lines) — factory |
| `RfqDetailClient.tsx` | modified — PDF toggle integration in right pane |
| Browse views (Phase 2) | cleanup of any confidence rendering (V24) |
| i18n keys | §5.I, §5.O, §5.CC keys |

**Validation:**
- [ ] Review page still works identically after PdfViewer extraction
- [ ] Click 👁 in RFQ detail header → desktop split, mobile modal
- [ ] URL `?pdf=1` persists state
- [ ] Quote header shows correct primary/secondary actions per status
- [ ] No confidence percentages visible in browse views

**Commit:** `feat(adr-328 phase 11): PDF preview + quote header actions`

### 7.16 Phase 12 — Vendor Communication

**Goal:** Invite send dialog (multi-select + suggested + ad-hoc). Notification dialog (winner/rejection templates). Audit per recipient. Sent indicator on quote rows.

**Depends on:** Phases 4, 8
**Blocks:** —

**Pre-flight:** §5.V, §5.Y. **MUST verify outbound email service exists (V15)** — if not, halt and open ADR-332.

**Deliverables:**

| File | Action |
|------|--------|
| `VendorInviteSection.tsx` | extended (per V14 audit) — replace single-vendor with multi-select dialog |
| `src/subapps/procurement/components/VendorInviteDialog.tsx` | new IF rebuilding (~250 lines) |
| `src/subapps/procurement/components/VendorNotificationDialog.tsx` | new (~250 lines) |
| `src/subapps/procurement/templates/vendorNotificationDefaults.ts` | new (~80 lines) |
| `src/subapps/procurement/utils/vendor-suggestions.ts` | new (~50 lines) |
| `RfqDetailClient.tsx` | modified — «Ενημέρωσε προμηθευτές» CTA in comparison banner |
| `QuoteListCard.tsx` | modified — sent badge with stale indicator |
| i18n keys | §5.V, §5.Y keys |

**Validation:**
- [x] Invite dialog: multi-select works, suggestions appear when category set, ad-hoc email validates
- [x] Notification dialog: per-vendor template, edit works, send dispatches
- [x] Audit entry created per recipient (vendor_notified via EntityAuditService)
- [x] Sent badge appears on QuoteListCard after send (lastNotifiedAt + stale indicator)

**Implemented:** 2026-04-30 — commit `feat(adr-328 phase 12): vendor invite + notification dialogs`

### 7.17 Phase 13 — Form Validation

**Goal:** line/quote validation rules (hard errors + soft warnings + override). Auto-calc total with override toggle. Greek decimal helpers (or reuse).

**Depends on:** Phases 2, 4
**Blocks:** Phase 14

**Pre-flight:** §5.Z

**Deliverables:**

| File | Action |
|------|--------|
| `src/subapps/procurement/utils/line-validation.ts` | new (~150 lines) |
| `src/subapps/procurement/utils/quote-validation.ts` | new (~100 lines) |
| `src/subapps/procurement/utils/units.ts` | new IF V19 says missing (~20 lines) |
| `src/lib/number/greek-decimal.ts` | new IF V16 says missing (~50 lines) — else reuse |
| Edit dialogs (line, quote) | modified — call validators, render errors/warnings, save-anyway button |
| i18n keys | §5.Z keys |

**Validation:**
- [x] Empty description → hard error, save disabled
- [x] Total mismatch → soft warning, save-anyway available
- [x] Override toggle works, persists user-entered total
- [x] Greek decimal `12.500,50` parses correctly
- [ ] Inconsistencies recorded in audit metadata when save-anyway used — **DEFERRED** to ADR-330 (History panel): API route not extended; inconsistencies are surfaced in UI warnings only. Full audit trail requires ADR-330 `linesSumMismatch` event type.

**Implemented: 2026-04-30**

**Commit:** `feat(adr-328 phase 13): form validation rules + Greek decimals`

### 7.18 Phase 14 — Browser Nav + Offline Guards

**Goal:** `DirtyFormProvider` + `beforeunload` for unsaved forms. In-page «discard changes» dialog. Offline banner + critical-write disable + Firestore offline persistence verified.

**Depends on:** Phase 13
**Blocks:** —

**Pre-flight:** §5.K, §5.L

**Deliverables:**

| File | Action |
|------|--------|
| `src/providers/DirtyFormProvider.tsx` | new IF V23 says missing (~50 lines) — else reuse |
| `src/hooks/useOnlineStatus.ts` | new IF V8 says missing (~15 lines) |
| `src/hooks/useFirestoreStatus.ts` | new IF V8 says missing (~30 lines) |
| `src/subapps/procurement/components/OfflineBanner.tsx` | new (~60 lines) |
| `RfqDetailClient.tsx` | modified — wrap in DirtyFormProvider + render OfflineBanner |
| Critical write actions (award, edit, PO) | modified — gate by `isConnected` |
| i18n keys | §5.K, §5.L keys |

**Validation:**
- [ ] Edit form with unsaved changes + close tab → browser warning fires
- [ ] Modal close with unsaved → in-page «discard changes» dialog
- [ ] Offline simulation (DevTools) → yellow banner + critical actions disabled with tooltip
- [ ] Reconnect → banner morphs to green for 3s then disappears
- [ ] Add comment offline → queues + replays on reconnect

**Commit:** `feat(adr-328 phase 14): unsaved-form guards + offline handling`

### 7.19 Phase 15 — i18n + Polish + Finalization

**Goal:** All i18n keys consolidated. Visual QA pass. Cross-browser smoke. 7 future ADR stubs created. ADR-328 status `PROPOSED` → `ACCEPTED`. Audit tables (§5.T.3, §5.DD.3, §5.EE.3) reconfirmed final.

**Depends on:** all previous
**Blocks:** —

**Pre-flight:** Read all phase handoffs to confirm completeness.

**Deliverables:**

| File | Action |
|------|--------|
| `src/i18n/locales/{el,en}/quotes.json` | final pass — verify all keys from §§5.A–5.GG present |
| `src/i18n/locales/{el,en}/common.json` (or appropriate) | append `datetime.*` keys (§5.GG) |
| `adrs/ADR-329-quote-comments.md` | new stub (~30 lines, pointing back to §5.R) |
| `adrs/ADR-330-quote-history.md` | new stub (~30 lines) |
| `adrs/ADR-331-construction-grade-comparison.md` | new stub (~30 lines) |
| `adrs/ADR-332-outbound-email-service.md` | new stub IF V15 needed, may already be done |
| `adrs/ADR-333-quote-edit-dialog.md` | new stub |
| `adrs/ADR-334-rfq-creation-flow.md` | new stub |
| `adrs/ADR-335-rfq-lifecycle.md` | new stub |
| `ADR-328` (this file) | status `PROPOSED → ACCEPTED`, final changelog row |
| `npm run i18n:baseline` | regenerate baseline |

**Validation:**
- [ ] No hardcoded strings in any new `.tsx` file (i18n ratchet baseline matches new state)
- [ ] All 14 golden paths (§8.1) pass
- [ ] All 20 edge cases (§8.2) pass
- [ ] Performance budgets (§8.4) met
- [ ] Cross-browser smoke (§8.6) passes
- [ ] All 7 future ADR stubs exist with proper frontmatter

**Commit:** `feat(adr-328 phase 15): i18n + polish + finalization — ADR-328 ACCEPTED`

**Final handoff:** «ADR-328 implementation complete. Page deployed. §5.HH design questions ready for post-implementation review.»

### 7.20 Total estimate

~37–45 hours across 16 sessions. Comfortable pace: **2 phases per day = 8 working days**. Aggressive pace: **3 phases per day = 5–6 days**. Conservative: **1 phase per day = 16 days**.

The pace is the user's choice; the workflow rules (handoff + ADR update) are non-negotiable regardless.

> **Note:** A coarser earlier draft of §7 (Phase A.0/A/B/C/D/E/F with 6–8h phases) was replaced on 2026-04-30 by the §7.0–§7.20 session-atomic plan above per Giorgio's directive. The atomic plan is the authoritative implementation roadmap.

<!-- Old §7.2–§7.8 (Phase A through F) deleted; superseded by §7.4–§7.19 above -->

---

## 8. Test Plan

Test scenarios are organized by category. The plan covers golden paths (must work) and edge cases (must not break).

### 8.1 Golden paths (must work end-to-end)

| ID | Scenario | Expected |
|----|----------|----------|
| GP1 | Open RFQ with 5 quotes | Lands on Tab Quotes, smart-default quote selected, list visible |
| GP2 | Open RFQ with 0 quotes | Lands on Tab Setup, Quotes tab shows empty state |
| GP3 | Click quote in list | Right pane shows details; URL updates to `?quote=<id>`; refresh restores |
| GP4 | Switch tabs | URL `?tab=` updates; browser back navigates between tabs |
| GP5 | Click row in Comparison | Drills to Tab Quotes with that quote selected |
| GP6 | Award winner (cheapest) | Optimistic update + Undo snackbar; no reason modal |
| GP7 | Award winner (not cheapest) | Reason modal appears; on confirm → optimistic + Undo |
| GP8 | Send vendor invites (multi-select) | Dialog → emails dispatched → invites appear in Setup tab |
| GP9 | Sort change | URL updates; list reorders; refresh preserves |
| GP10 | Search by price «12500» | Pattern detected; only matching quotes show |
| GP11 | Toggle PDF preview | Right pane splits; URL `?pdf=1`; refresh preserves |
| GP12 | Scan a PDF | Placeholder appears in list; grouped toast; success replaces placeholder |
| GP13 | Mobile: select quote | List → detail full-screen with back; back gesture returns |
| GP14 | Concurrent: User A awards while User B viewing | User B sees live-change toast; data updates without refresh |

### 8.2 Edge cases (must not break)

| ID | Scenario | Expected |
|----|----------|----------|
| EC1 | RFQ with no `projectId` | Subtitle skipped cleanly; breadcrumb omits project segment |
| EC2 | Quote with no `validUntil` | No expiry badge / banner; no warning on award |
| EC3 | 1 quote in Comparison tab | §5.S.3 single-quote empty state with summary card |
| EC4 | Concurrent: A awards Vendor B while B awards Vendor A | First write wins; second sees ConflictDialog «review and retry» |
| EC5 | Award expired quote | Warning modal with renew/award-anyway/cancel; audit metadata captures `awardedExpired` |
| EC6 | Cancel mid-scan refresh | Server scan continues; placeholder lost; new quote eventually appears |
| EC7 | Vendor sends revised quote | High-confidence: auto-version + undo toast |
| EC8 | Vendor sends new quote, only name fuzzy matches | Low-confidence: modal asks user |
| EC9 | Try to award when PO already exists for another quote | Award blocked with §5.G PO-lock tooltip |
| EC10 | Form: edit line, leave dialog open, refresh tab | beforeunload fires; user warned before page reload |
| EC11 | Form: edit line with invalid price | Hard error displays; save disabled |
| EC12 | Form: line `qty × unitPrice ≠ total` | Soft warning; «Save anyway» allowed; `inconsistencies` audit metadata |
| EC13 | Offline: try to award | Button disabled with «Απαιτείται σύνδεση» tooltip |
| EC14 | Offline: add comment | Queues via Firestore; replays on reconnect |
| EC15 | Browser back from `?tab=quotes&quote=X` | Goes to previous URL state (history-respecting) |
| EC16 | Search yields 0 results | Empty state with suggestions |
| EC17 | Page with 50 quotes (above small-scale assumption) | Renders correctly, perhaps slow — falls within §5.N tolerance |
| EC18 | Vendor invited duplicate (already invited for this RFQ) | Excluded from suggested list; banner shows count |
| EC19 | Delete a previously-selected quote | URL self-corrects via `router.replace`; smart default re-engages |
| EC20 | Status field on RFQ has unexpected value | Banner shows «Άγνωστη κατάσταση»; page renders defensively |

### 8.3 i18n verification

| ID | Check |
|----|-------|
| I1 | All visible strings have translations in both `el/quotes.json` AND `en/quotes.json` (CLAUDE.md SOS N.11) |
| I2 | No hardcoded Greek/English in `.tsx` outside locale files (i18n ratchet baseline holds) |
| I3 | No `defaultValue: 'literal text'` patterns added |
| I4 | ICU placeholders (`{{var}}`) used consistently |
| I5 | Plural forms work for «1 ημέρα» vs «2 ημέρες» (Intl.PluralRules) |

### 8.4 Performance verification

Per §5.N budgets — measured on mid-tier hardware with 5 quotes / 15 lines / 5 invites:

| Metric | Target | How to measure |
|--------|--------|----------------|
| Initial TTI | < 2s | Chrome DevTools Performance tab |
| Tab switch | < 100ms | Manual stopwatch (or React Profiler) |
| Quote select render | < 100ms | Same |
| Optimistic award update | < 50ms | Same |
| Comparison row click → drill | < 200ms | Same |

If any budget breached, profile and optimize specifically — no premature work elsewhere.

### 8.5 Type safety verification

| ID | Check |
|----|-------|
| T1 | `npx tsc --noEmit` passes (no new errors beyond known pre-existing) |
| T2 | No `any`, `as any`, or `@ts-ignore` introduced (CLAUDE.md SOS N.2) |
| T3 | All Firestore writes use `setDoc()` with enterprise IDs (CLAUDE.md SOS N.6) |

### 8.6 Cross-browser & device verification

| Surface | Browsers/Devices |
|---------|------------------|
| Desktop | Chrome (latest), Firefox (latest), Safari (latest) |
| Mobile | iOS Safari (latest), Chrome Android (latest) |

Specific things to spot-check on mobile: §5.E navigated list-detail, §5.O modal PDF, §5.Y full-screen invite dialog, back-gesture handling.

---

## 9. Definition of Done

ADR-328 is **complete** only when **every** item below is satisfied. Half-done ADRs are not allowed (CLAUDE.md no-half-implementations rule).

### 9.1 Implementation completeness

- [ ] All §6 verification items (V1–V26) audited and outcomes documented in this ADR
- [ ] Phase A through Phase F commits merged to `main`
- [ ] Each commit message references ADR-328
- [ ] §5.Q time-sensitive notice still valid (or migration ADR opened if production launched)
- [ ] No silent scope creep — features outside §§3–5.HH not added

### 9.2 Test plan execution

- [ ] All 14 golden paths (GP1–GP14) verified manually
- [ ] All 20 edge cases (EC1–EC20) verified manually
- [ ] All i18n checks (I1–I5) pass
- [ ] All performance budgets (§8.4) within target on baseline hardware
- [ ] All type-safety checks (T1–T3) pass
- [ ] Cross-browser smoke pass on Chrome + Firefox + Safari (desktop) and iOS Safari + Chrome Android (mobile)

### 9.3 Quality gates

- [ ] `npx tsc --noEmit` exits clean (modulo known pre-existing errors in CLAUDE.md)
- [ ] Pre-commit hooks pass (i18n ratchet, SSoT ratchet, EntityAudit coverage, native tooltip baseline)
- [ ] No `companyId` query violations introduced (CHECK 3.10)
- [ ] No new `any` / `@ts-ignore` introduced
- [ ] No new files >500 lines without explicit justification (CLAUDE.md SOS N.7.1)
- [ ] No new function >40 lines without explicit justification

### 9.4 Documentation

- [ ] This ADR's status flipped from `PROPOSED` to `ACCEPTED`
- [ ] Final implementation date added to changelog
- [ ] Phase A.0 audit tables (§5.T.3, §5.DD.3, §5.EE.3) populated with actual findings
- [ ] §5.HH pending design questions retained as-is for post-implementation review
- [ ] 7 future ADR stubs created (ADR-329 through ADR-335) so they're not lost

### 9.5 Release readiness

- [ ] ADR has been reviewed by Giorgio (or designated reviewer)
- [ ] No outstanding blockers in PR feedback
- [ ] Localhost smoke test passes (the only test before push, per CLAUDE.md no-push-without-order rule)
- [ ] **Do NOT push to remote without explicit Giorgio order** (CLAUDE.md SOS N.(-1))

### 9.6 Post-merge follow-up

- [ ] Post-merge: open the §5.HH discussion when it makes sense (after ~1 week of real use)
- [ ] Post-merge: monitor production logs for any unhandled cases (ConflictDialog edge cases, scan failures, expired-quote awards)
- [ ] Post-merge: audit `EntityAuditService` entries for any malformed metadata (CLAUDE.md CHECK 3.17)

---

## 10. Closing Notes

This ADR documents a **structural refactor** of `/procurement/rfqs/[id]` toward a contacts-style split layout, with deeply considered UX patterns informed by Google products (Material Design 3) and construction-industry standards (Procore, SAP Ariba, Oracle Primavera).

The design phase produced **37 explicit decisions**, **5 deferred design questions**, and **7 deferred future ADRs**. Implementation is split into **16 session-atomic phases** (Phase 0 through Phase 15) with explicit commit boundaries, mandatory ADR updates after each phase, and handoff documents at session boundaries to keep context clean across multi-session execution.

The most important time-sensitive constraint is the **§5.Q migration assumption** — this ADR assumes test data will be wiped before production. If production launches before this ADR ships, §5.Q expires and a migration ADR becomes mandatory. See top-of-document notice.

— End of ADR-328 —

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-29 | ADR created — proposed, not yet implemented |
| 2026-04-29 | §3.1 added: smart default tab — Setup if no quotes, Quotes if any (Q1 clarification) |
| 2026-04-29 | §3.2 added: smart default selected quote — under_review first, else most recent (Q2 clarification) |
| 2026-04-29 | §3.3 added: dashboard hidden by default, no cross-session persistence (Q3 clarification) |
| 2026-04-29 | §5 restructured: per-tab stats (4 cards each), factory now takes `activeTab` + `comparison` (Q4 clarification) |
| 2026-04-29 | §5.A added: per-tab PageHeader action buttons (Quotes: scan+new, Comparison: export Phase 2, Setup: invite+line) (Q5 clarification) |
| 2026-04-29 | §5.B added: attention-driven tab badges (red=under_review, yellow=recommendation/expired invites, none=steady state) (Q6 clarification) |
| 2026-04-29 | §5.C added: rich empty state for Tab Quotes — pending invites card + action buttons + new `QuotesEmptyState` component (Q7 clarification) |
| 2026-04-29 | §3.4 added: URL state persistence — `?tab=` + `?quote=`, smart fallback, push for tabs, replace for quote selection (Google «URL is state» pattern, Q8 clarification) |
| 2026-04-29 | §5.D added: comparison row click → drill into Quote tab with selection (Google Analytics drill-down pattern + 3 UX improvements: affordance, full-row click, stopPropagation) (Q9 clarification) |
| 2026-04-29 | §5.E added: Material 3 list-detail responsive — same component, mobile shows list OR detail (push for back-gesture), desktop shows both. Amends §3.4 mobile-aware nav method (Q10 clarification) |
| 2026-04-29 | §5.F added: winner award flow — optimistic + Undo snackbar, no confirmation dialog, non-modal PO CTA, irreversible post-PO state with disabled buttons + tooltip (Q11 clarification) |
| 2026-04-29 | §5.G added: Setup tab granular lock state — lines fully locked post-award, invites partially (cancel still allowed), full lock post-PO, prominent unlock banner with revert/cancel-PO action (Q12 clarification) |
| 2026-04-29 | §5.H added: async scan UX — never-block, in-list placeholder + grouped toast, stage labels, parallel scans, retry/delete on failure, client-only state with `useScanQueue` hook (Q13 clarification) |
| 2026-04-29 | §5.I added: quote header actions — 1-2 primary text buttons + 3 secondary icons + overflow menu, status-aware hide/show, hide irrelevant actions, lock consistency with §5.G, ADR-267 SSoT extended (not forked) (Q14 clarification) |
| 2026-04-29 | §5.J added: concurrent collaboration — Firestore onSnapshot for view sync + optimistic locking via runTransaction for critical writes + ConflictDialog «review and retry» + filtered live-change toasts. Phase 1 only; presence/cursors/OT explicitly out of scope (Q15 clarification) |
| 2026-04-29 | §5.K added: browser back never hijacked, beforeunload only for unsaved forms, in-page «discard changes» dialog for modal close, DirtyFormProvider context (Q16 clarification) |
| 2026-04-29 | §5.L added: offline handling — yellow banner, granular write policy (critical disabled, additive queued), Firestore offline persistence enabled, paused live toasts with aggregated reconnect summary (Q17 clarification) |
| 2026-04-29 | §5.M added: accessibility explicitly deferred — B2B context, no legal obligation, retrofit too costly, future re-evaluation triggers documented, earlier aria/keyboard mentions marked aspirational (Q18 clarification) |
| 2026-04-29 | §5.N added: performance budget for small-scale (3-5 typical, max 10 quotes per RFQ) — no virtualization, no pagination, no premature optimization; revisit triggers documented (Q19 clarification) |
| 2026-04-29 | §5.O added: PDF preview integration — extracted-data default + toggle (👁) → side panel 50/50 on desktop, modal on mobile, URL state `?pdf=1`, mandatory shared `PdfViewer` component reused from review page, lazy-loaded (Q20 clarification) |
| 2026-04-29 | §5.P added: quote list sorting — default «Status + Price» composite, 5 sort options via dropdown, URL state `?sort=`, group dividers when default sort active, missing-field fallbacks (Q21 clarification) |
| 2026-04-29 | §5.Q added: no data migration required — test data wiped before production, new fields assumed present from day one, no backfill/shim/compat work in scope |
| 2026-04-29 | Top-of-document TIME-SENSITIVE NOTICE added: warns future readers that §5.Q expires when production launches (~2026-05-06); explicit verification steps before relying on test-data assumption |
| 2026-04-29 | §5.R added: Comments + History deferred to future ADRs (ADR-329 / ADR-330) — icon buttons rendered with «coming soon» tooltip, no functional implementation in this ADR (Q22 clarification) |
| 2026-04-29 | §5.S added: Comparison tab empty states for 0 and 1 quote — tab always enabled (Material 3), educational empty state for 0, single-quote summary + threshold message for 1, new `ComparisonEmptyState` component (Q23 clarification) |
| 2026-04-29 | §5.T added: ComparisonPanel scope — current panel unchanged in this ADR, Phase A.0 audit step, follow-up ADR-331 for Procore-grade construction comparison (Inclusions/Exclusions, normalized TCO, weighted scoring, vendor qualification) (Q24 clarification) |
| 2026-04-29 | §5.U added: smart pattern-aware search — quote number / date / numeric / free-text detection priority, multi-token AND matching, URL `?q=`, helpful empty state with suggestions (Q25 clarification) |
| 2026-04-29 | §5.V added: vendor notifications — manual trigger with templates dialog, 2 defaults (winner/rejection), inline edit, per-RFQ override storage, audit trail via EntityAuditService, sent badge with stale detection, send via existing outbound service or open ADR-332 if missing (Q26 clarification) |
| 2026-04-29 | §5.W added: filtering strategy — quick filters + smart search only, AdvancedFiltersPanel removed from §4, no premature filter complexity at small-scale. Updated §4 SSOT table accordingly (Q27 clarification) |
| 2026-04-29 | §5.X added: award reason capture — required only when not the cheapest, 8 predefined categories + optional/required explanation, persists on quote doc + audit trail, naive cheapest = lowest netTotal (refines in ADR-331), edit reason later via History panel (Q28 clarification) |
| 2026-04-29 | §5.Y added: vendor invite send dialog — multi-select with category-based suggestions (graceful degradation), ad-hoc email field with auto-create contact, single template with per-vendor placeholder interpolation, 4 deadline presets, audit per recipient, mobile full-screen modal (Q29 clarification) |
| 2026-04-29 | §5.Z added: form validation rules — hard errors vs soft warnings, auto-calc total with override toggle, predefined units list, Greek decimal parse/format, inconsistency tracking in audit metadata, Phase A.0 search for existing helpers/validators (Q30 clarification) |
| 2026-04-29 | §5.AA added: quote duplicate detection & versioning — multi-signal matching (email/taxId/name), confidence-driven UX (auto-version high, modal medium/low), schema additions (version, previousVersionId, supersededBy), edge cases (accepted, PO-locked), audit trail with delta + signals (Q31 clarification) |
| 2026-04-29 | §5.BB added: quote expiration as derived UI state (never auto-status-flip), visual badges, banner with renewal CTA, award-expired warning modal, renewal email composer, status enum corrected (no `'expired'`); §5.AA.4 / §5.P.2 / §5.W.1 updated to align (Q32 clarification) |
| 2026-04-29 | §5.CC added: AI confidence — browse views clean (no confidence), edit dialog DEFERRED to future ADR-333 with «coming soon» placeholder, Phase A.0 cleanup of any existing confidence rendering in browse views, confidence data preserved in Firestore (Q33 clarification) |
| 2026-04-30 | §5.DD added: RFQ creation flow OUT of scope — detail page tolerance contract (graceful fallbacks for missing fields), Phase A.0 audit of current creation requirements, sensible-minimum recommendation, deferred to ADR-334 (must open before changes) (Q34 clarification) |
| 2026-04-30 | §5.EE added: RFQ lifecycle management OUT of scope — detail page tolerance contract (read-only mode for closed/cancelled/archived), Phase A.0 audit of current status field, sensible-lifecycle recommendation, deferred to ADR-335 (must open before changes) (Q35 clarification) |
| 2026-04-30 | §5.FF added: project context visibility — breadcrumb project segment + PageHeader subtitle with clickable project link, graceful fallback if projectId missing, Phase A.0 verifies ModuleBreadcrumb/PageHeader API + denormalization status of `projectName` (Q36 clarification) |
| 2026-04-30 | §5.GG added: date/time formatting — context-aware patterns (relative/deadline/precise), `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat` with `el-GR`, `<time>` semantic element with tooltip, helper module + Phase A.0 search for existing helpers (Q37 clarification) |
| 2026-04-30 | §5.HH added: 5 pending design questions (RBAC, drag-and-drop scan, export, RFQ clone, multi-attachments) explicitly deferred to post-implementation discussion — memory anchor to prevent silent loss between design and iteration phases |
| 2026-04-30 | §6 added: Phase A.0 verification checklist (V1–V26) — consolidated all "search first" / "audit step" requirements from §§3–5 into a single pre-implementation gate |
| 2026-04-30 | §7 added: implementation phases (A.0 → A → B → C → D → E → F) with file-by-file scope, commit boundaries, and ~25–35h estimate |
| 2026-04-30 | §8 added: test plan with 14 golden paths (GP1–GP14), 20 edge cases (EC1–EC20), i18n verification (I1–I5), performance budget checks, type-safety checks, cross-browser/device matrix |
| 2026-04-30 | §9 added: Definition of Done — 6-category checklist covering implementation, test execution, quality gates, documentation, release readiness, post-merge follow-up |
| 2026-04-30 | §10 added: closing notes summarizing decisions, deferrals, and the §5.Q time-sensitive constraint |
| 2026-04-30 | §7 fully rewritten: replaced coarse 6-phase plan (A.0/A/B/C/D/E/F with 6–8h phases) with 16 session-atomic phases (Phase 0 through Phase 15, ~2–3h each), universal phase-cycle workflow, handoff document template, mandatory ADR update after each phase. Old §6–§10 (RfqDetailClient refactor plan, file size check, i18n keys list, original implementation phases, risk assessment) removed — content fully subsumed by §3.6 / §5.x / §7 / §8 / §9 |
| 2026-04-30 | Phase 0 verification complete; 0 hard blockers, 15 non-blocking gaps surfaced. §5.T.3, §5.DD.3, §5.EE.3 audit tables populated. §6.4 «Phase 0 findings» added with full V1–V26 outcome table. Implementation green-lit for Phase 1. |
| 2026-04-30 | Phase 1 Foundation implemented: PageHeader + ModuleBreadcrumb (rfqs entry added, G1 resolved) + 3-tab structure (Προσφορές/Σύγκριση/Ρύθμιση RFQ) + URL state via `useRfqUrlState` (§3.4 spec followed exactly). Deviation: projectName fetched client-side (secondary fetch after RFQ loads) rather than as server prop — simpler for Phase 1 since page.tsx did not previously fetch RFQ server-side. `HeaderTitleProps.subtitle` extended to `React.ReactNode` (additive, non-breaking). |
| 2026-04-30 | Phase 4 Setup Tab lock state implemented: `rfq-lock-state.ts` (new utility, `SetupLockState` type + `deriveSetupLockState`). `SetupLockBanner.tsx` (new, ~60 lines): amber banner for awardLocked + red banner for poLocked, `onRevertAward`/`onViewPo`/`onCancelPo` callbacks. `RfqLinesPanel`: `lockState` prop, delete + add-line buttons disabled when locked. `VendorInviteSection`: `lockState` prop, add-invite button disabled when locked, revoke disabled only for poLocked (awardLocked keeps cancel per §5.G.1). `RfqDetailClient`: `lockState` from `deriveSetupLockState(rfq, quotes)`, `winnerVendorName` from winner quote, `SetupLockBanner` at top of Tab 3. Deviations: (1) `purchaseOrderId` not in RFQ type → `poLocked` state unreachable, uses `winnerQuoteId` for awardLocked; (2) `onRevertAward` not wired (§5.F.3 revert flow deferred to future phase). i18n: `rfqs.setup.banner.*` + `rfqs.setup.lockedTooltip.*` (9 keys, el+en). |
| 2026-04-30 | Phase 3 Comparison Tab implemented: `ComparisonEmptyState.tsx` (new, ~85 lines) — 0-quote educational empty state (BarChart3 icon, CTAs: new/scan/invites) and 1-quote pre-comparison state (vendor card + viewDetails drill-down). `ComparisonPanel`: `onRowClick?: (quoteId: string) => void` prop added, `ComparisonRow` gets cursor-pointer/hover/group/ChevronRight affordance, keyboard nav (Enter/Space), `e.stopPropagation()` on award button. `useRfqUrlState`: `handleComparisonDrillDown` (single push tab+quote, §5.D.3). `RfqDetailClient` Tab 2: `quotes.length < 2` guard renders empty state, else existing panel. i18n: `rfqs.comparison.rowAriaLabel` + `rfqs.comparison.empty.*` (7 keys, el+en). Deviation: `deliveryTerms` (string) used instead of non-existent `deliveryDays` (number) — Quote type has `deliveryTerms: string | null`. |
| 2026-04-30 | Phase 2 Quotes Tab Split Layout implemented: `RfqDetailClient.tsx` Tab 1 now renders `md:grid md:grid-cols-[380px_1fr]` split layout. `QuoteList` wired to `handleSelectQuote` + `selectedQuoteId` highlight. `QuoteDetailsHeader` + `QuoteDetailSummary` render in right pane. Mobile navigated pattern per §5.E.2 (list OR detail, never both). `useRfqUrlState` updated: `handleSelectQuote` mobile-aware (push on mobile for back-gesture, replace on desktop — §5.E.4); self-correction useEffect for stale `?quote=` param. i18n keys added: `rfqs.mobile.backToList`, `rfqs.selectQuoteHint`. |
| 2026-04-30 | Phase 5 Real-time + Optimistic Locking primitives implemented (§5.J). All 5 hooks converted from one-shot `fetch` to Firestore `onSnapshot` via `firestoreQueryService` (ADR-214 SSoT, tenant-aware): `useQuotes` (direct subscribe to `QUOTES` with rfqId/projectId/etc. filters), `useVendorInvites` (direct subscribe to `VENDOR_INVITES` with `where('rfqId','==',rfqId)`), `useRfqLines` (direct `subscribeSubcollection` on `rfqs/{rfqId}/lines`, mutations remain via API), `useComparison` (HYBRID: subscribe `QUOTES` as change-detector → 400ms debounced refetch of `/api/rfqs/{rfqId}/comparison` — server-computed comparison logic preserved), `useSourcingEventAggregate` (HYBRID: `subscribeDoc` on `SOURCING_EVENTS/{eventId}` → debounced refetch of aggregate API). New `quote-versioning-service.ts` (~170 lines): `ConflictError` class, `assertVersionMatches`, `nextVersionFields`, `runVersionedUpdate` transaction wrapper — Phase 5 partial scope per §7.9 (full `supersede`/`createRevision` deferred to Phase 9). New `ConflictDialog.tsx` (~135 lines): generic dialog driven by `ConflictType` discriminator, `awardContext` for vendor names, accept-remote (close — onSnapshot already shows remote state) + keep-mine (re-runs original transaction). New `useLiveChangeToasts.ts` (~165 lines): subscribe `QUOTES` filtered by rfqId, diff against previous snapshot ref, filter self-changes (`createdBy === currentUserId`) + initial snapshot (60s freshness window), aggregate 3+ events within 5s into single toast. Firestore offline persistence enabled via `initializeFirestore(app, { localCache: persistentLocalCache(...) })` in `src/lib/firebase.ts` (V6 resolved). i18n: `rfqs.conflict.*` (8 keys) + `rfqs.live.*` (8 keys) + `rfqs.conflict.generic.body` (additive non-spec key for non-award conflicts) added to el+en. Deviations: (1) `useRfqLines` mutations dropped optimistic UI overlays — onSnapshot delivers update from local Firestore cache before server ack thanks to persistent cache, so perceived latency is acceptable without optimistic state (which would have required dedupe logic against snapshot delivery); (2) `useComparison`/`useSourcingEventAggregate` use HYBRID rather than pure-Firestore subscription because the comparison + aggregate are server-computed views of the underlying quotes/RFQs — re-implementing them client-side is out of Phase 5 scope. |
| 2026-04-30 | Phase 6 Stats Dashboard + Tab Badges implemented (§5, §5.B, §3.3). New `rfq-dashboard-stats.ts` (~90 lines): pure `buildRfqDashboardStats(rfq, quotes, invites, comparison, activeTab, t)` factory returning 4 `DashboardStat[]` per tab — quotes (total/underReview/accepted/bestPrice), comparison (bestPrice/worstPrice/diff/recommendation), setup (totalLines/totalVolume/invites/attentionCount). `RfqDetailClient.tsx` wired: `showDashboard` state (false by default, §3.3), eye-toggle `Button[variant=ghost]` prepended to PageHeader `customActions` (Eye/EyeOff icon), `UnifiedDashboard columns={4}` rendered conditionally between PageHeader and Tabs. Badge derivation: `underReviewCount` (quotes tab red Badge[destructive]), `recommendationPending` (comparison tab yellow dot span), `setupAttentionCount` (setup tab yellow Badge[warning] — invites expired OR pending past rfq.deadline). `useVendorInvites(id)` hoisted to `RfqDetailClient` to supply `invites` to both stats factory and badge derivation; `VendorInviteSection` retains its own internal subscription (2 subscriptions, Firebase SDK deduplicates). i18n: `rfqs.tabs.badges.*` (3 aria-label keys) + `rfqs.dashboard.*` (13 keys across 3 tabs + toggle) added to el+en. No deviations from spec. |
| 2026-04-30 | Phase 7 Sort + Search implemented (§5.P, §5.U, §5.W). New `quote-sort.ts` (~85 lines): `STATUS_PRIORITY` map (8 statuses), `SortKey` type + 5 options, `sortQuotes(quotes, sortKey)` pure function, `groupByStatus(sortedQuotes)` for group dividers. Handles both Firestore Timestamp and serialized `{ seconds }` objects. New `quote-search.ts` (~100 lines): `detectPattern(query)` — quote-number/date/numeric/free-text priority, `matchesQuote(quote, query)` — numeric uses `totals.subtotal`/`totals.total` (Quote type has no `netTotal`/`grandTotal`), date uses `submittedAt`/`createdAt`, free-text searches vendor/lines/terms/notes. `QuoteList.tsx` updated (~315 lines): `isRfqMode = !!onSelectQuote` gates two computation paths. RFQ mode: URL sort (`?sort=` via `router.replace`) + URL search (`?q=`) + `sortQuotes()` + `groupByStatus()` group dividers for `status-price` key; standalone mode: legacy `useSortState` + local `searchTerm` behavior unchanged. Sort dropdown `<Select>` rendered below CompactToolbar in RFQ mode. Empty state with search suggestions when `?q=` yields no results. i18n: `rfqs.sort.*` (7 keys) + `rfqs.search.*` (6 keys) added to el+en. Deviation: `?status=` URL persistence for QuoteStatusQuickFilters deferred (Phase 7 deliverables specify only sort+search URL persistence; status chips remain local state). |
| 2026-04-30 | Phase 9 Versioning implemented (§5.AA). New `src/lib/string/fuzzy-greek.ts` (~32 lines): `fuzzyEqualGreek(a,b)` via Levenshtein ≤ 2 after `normalizeSearchText`. New `quote-duplicate-detection.ts` (~70 lines): `detectDuplicate(newQuote, existingActive)` — multi-signal (email/taxId/name), confidence high/medium/low/none, tie-break by most-recent submittedAt. New `QuoteRevisionDetectedDialog.tsx` (~115 lines): medium/low confidence modal with 3 radio options (revision/separate/cancel_import), blocks PO-locked quotes, shows winner warning. `quote-versioning-service.ts` extended (+100 lines): `supersede()` — atomic tx marks old as superseded, promotes new to v(N+1); `revertSupersede()` — compensating tx restores original status; `createRevision()` — copies base doc + mutator + supersedes atomically. `useQuotes` extended: second `options: { includeSuperseded? }` param, client-side filter via ref (default false = superseded excluded per §5.AA.7). `quote-sort.ts`: `superseded: 9` added to `STATUS_PRIORITY`. `quote.ts`: `superseded` added to `QuoteStatus` union + `QUOTE_STATUSES` + `QUOTE_STATUS_TRANSITIONS` + `QUOTE_STATUS_META`; versioning fields added to `Quote` interface (`version?`, `previousVersionId?`, `supersededBy?`, `supersededAt?`, `_previousStatus?`). `QuoteListCard.tsx`: `superseded: 'secondary'` in `STATUS_BADGE_VARIANTS`; `hasOlderVersions`/`isVersionExpanded`/`onVersionToggle` props; version badge `v{n}` shown when `version > 1`; collapsible chevron toggle. `QuoteList.tsx`: `supersededByParentId` map built from superseded quotes; `expandedVersions` state; `rfqSorted` filters out superseded; `SupersededVersionRow` inline component (muted, non-selectable); rfqGroups + rfqSorted render both wired with version props. `RfqDetailClient.tsx`: `useQuotes(..., { includeSuperseded: true })`; `activeQuotes` derived (excludes superseded) — used for tabs/stats/lock/counts; full `quotes` passed to `QuoteList`; comparison tab guard uses `activeQuotes.length`. i18n: `rfqs.versioning.*` (9 keys) + `rfqs.revisionDialog.*` (16 keys) added to el+en. Deviations: (1) `createRevision` not yet wired to UI — §5.AA.9 manual revision requires quote header overflow menu (Phase 11); (2) high-confidence auto-version toast + undo not yet wired — trigger point in quote creation/scan flow is Phase 10+ scope; Phase 9 ships the complete service + detection + dialog + display layer. |
| 2026-04-30 | Phase 8 Award Flow + Reason Capture implemented (§5.F, §5.X). New `quote-cheapest.ts` (~20 lines): `eligibleForComparison()` predicate (status not rejected/draft, subtotal > 0), `isCheapestEligible(targetQuote, quotes)` (naive pre-VAT net comparison — ADR-331 refines to normalized TCO), `cheapestEligibleQuote(quotes)`. New `useAwardFlow.ts` hook (~95 lines): `executeAward()` — optimistic `setOptimisticWinnerId` before API call, Sonner toast with 8s duration + Undo action (re-awards `prevId`; Undo disabled for first-ever award); `handleAwardIntent()` — cheapest (via `entry.flags.includes('cheapest')`) → direct award, non-cheapest → set `pendingEntry`/`cheapestEntry` for dialog; error path shows Retry action. New `AwardReasonDialog.tsx` (~130 lines): 8 reason categories (`better_delivery`, `better_quality`, `existing_relationship`, `certifications`, `inclusions`, `stock_availability`, `past_consistency`, `other`) — `other` requires non-empty note; Dialog shows cheapest comparison context in `DialogDescription` only when awarding over a cheaper option. `ComparisonPanel.tsx` modified: `onAward(winnerQuoteId, overrideReason)` → `onAwardIntent(entry)` + `winnerQuoteId?: string | null` prop; `ComparisonRow` gets `isWinner` highlight (emerald-50/60 bg) + Trophy icon + lockedBadge label; `rfqAwarded` disabled state preserved. `RfqDetailClient.tsx` modified: `handleAward` → `onFireAward`; `useAwardFlow` wired; `effectiveWinnerId = optimisticWinnerId ?? rfq.winnerQuoteId` (optimistic takes precedence); winner banner added to comparison tab (§5.F.6) — `CheckCircle2` icon + vendor name + total + disabled Create PO CTA; `AwardReasonDialog` rendered outside `Tabs`. i18n: `rfqs.award.*` (8 keys) + `rfqs.awardReason.*` (24 keys) added to el+en. Deviations: (1) `quote-award-service.ts` replaced by `useAwardFlow.ts` hook — spec named it a service but it owns React state + `useTranslation`, so hooks/ is correct per project convention; (2) cheapest detection uses `entry.flags.includes('cheapest')` from comparison engine (more accurate than naive recalculation in `quote-cheapest.ts`) — `quote-cheapest.ts` retained as utility for future Phase 9 versioning. |
| 2026-04-30 | Phase 10 Expiration + Async Scan UX implemented (§5.BB, §5.H). New `quote-expiration.ts` (~60 lines): pure helpers `isExpired`, `daysUntilExpiry`, `expiryBadgeState` (expired/expiring_soon/normal/unknown, 7-day threshold), `formatValidUntilDate` — all derived from `validUntil: Timestamp\|null`, no status mutation per §5.BB invariant. `resolveMs()` handles Firestore `{ seconds }` shape + malformed string fallback. New `useScanQueue.ts` (~100 lines): §5.H «Never block, show twice» scan state manager — `enqueue(file)` calls `POST /api/quotes/scan` then polls `GET /api/quotes/{id}` every 3s (max 20 attempts) until `extractedData` populated; stage timers 4s→stage2, 10s→stage3; grouped Sonner toast via stable `'scan-queue'` ID (loading while pending, dismiss on completion). New `ExpiredAwardWarningDialog.tsx` (~60 lines): award gate intercept when target quote is expired — 3 actions: `request_renewal` | `award_anyway` | `cancel`; uses `DialogDescription` for body (no extra div). New `QuoteRenewalRequestDialog.tsx` (~100 lines): email composer dialog — editable subject + body (pre-filled template), `font-mono` textarea, sends via `onSend(to, subject, body)` callback. `useAwardFlow.ts` extended: `quotes?: Quote[]` option; `pendingExpiredEntry` state; `proceedWithAward(entry)` extracted helper (cheapest check + dialog gate); `handleAwardIntent` checks `isExpired` before proceeding; `handleExpiredDialogAction` clears gate + calls `proceedWithAward` for `'award_anyway'`. `QuoteList.tsx` extended (+scan placeholder rendering): `scanItems?`, `onRetryScan?`, `onRemoveScan?` props; `ScanPlaceholderRow` local component (error=red border+XCircle+Retry/Delete, pending=dashed+Loader2+stage label); placeholders rendered above ScrollArea in RFQ mode. `QuoteDetailsHeader.tsx` extended: `onRequestRenewal?` prop; amber expiry banner with date + daysAgo + CTA button rendered below EntityDetailsHeader when `isExpired`. `QuoteListCard.tsx` extended: `expiryBadge` useMemo — expired=destructive badge with date, expiring_soon=warning badge with days count; badges order: version → expiry → status. `RfqDetailClient.tsx` wired: `useScanQueue` hooked + `scanItems`/`onRetryScan`/`onRemoveScan` → `QuoteList`; `ExpiredAwardWarningDialog` + `QuoteRenewalRequestDialog` added; `renewalQuoteId` state + `renewalQuote` memo; `pendingExpiredQuote` memo from `pendingExpiredEntry`; `onRequestRenewal` on `QuoteDetailsHeader`. i18n: `rfqs.expiry.*` (15 keys) + `rfqs.scan.*` (12 keys) added to el+en. Deviations: (1) `QuoteRenewalRequestDialog.onSend` is a stub (closes dialog, no API call) — actual email sending requires new API route, deferred V15 gap; (2) `useScanQueue.retry` not yet wired to `ScanPlaceholderRow.onRetry` in `RfqDetailClient` — retry prop exists but callback is no-op placeholder pending Phase 11 scan retry flow. |
| 2026-04-30 | Phase 14 Browser Nav + Offline Guards implemented (§5.K, §5.L). New `src/hooks/useOnlineStatus.ts` (~20 lines): SSR-safe `navigator.onLine` + `online`/`offline` events. New `src/hooks/useFirestoreStatus.ts` (~35 lines): `onSnapshot` with `includeMetadataChanges` on `config/app` sentinel — optimistic start (true), only transitions to false after first server snapshot received and then `fromCache` becomes true. New `src/providers/DirtyFormProvider.tsx` (~55 lines): context with `registerDirty`/`clearDirty`/`isAnyDirty`/`isDirty`; mounts `beforeunload` listener when `isAnyDirty`. New `src/subapps/procurement/components/OfflineBanner.tsx` (~65 lines): yellow offline banner + green 3s recovery banner, `role="status"` `aria-live="polite"`, auto-dismissed after recovery. `quote-header-actions.ts`: `isConnected?: boolean` added to `BuildQuoteHeaderActionsParams`; when false, all critical writes (confirm/reject/approve/createPo/restore/edit) get `disabled: true` + `rfqs.offline.requiresConnection` tooltip; offline tooltip takes priority over award-lock tooltip. `QuoteForm.tsx`: `useDirtyForm` integration — `hasInteracted` state tracks first `setField` call → `registerDirty('quote-form')`; cleanup effect calls `clearDirty` on unmount; discard confirmation `AlertDialog` intercepts `onCancel` when `hasInteracted`. `RfqDetailClient.tsx` (499 lines): wrapped in `DirtyFormProvider`; `useOnlineStatus` + `useFirestoreStatus` hooked → `isConnected = isOnline && isFirestoreConnected`; `OfflineBanner` rendered between `PageHeader` and dashboard; `isConnected` passed to `buildQuoteHeaderActions`. i18n: `rfqs.unsaved.*` (4 keys: title/body/discard/keep) + `rfqs.offline.*` (7 keys: banner/recovered/requiresConnection/queuedPending/queueFailed/summaryToast/summaryAction) added to el+en. Deviations: (1) `useFirestoreStatus` uses `config/app` as sentinel — world-readable for authenticated users per Firestore rules; brief false-offline on initial cached snapshot avoided via `hasServerSnapshot` ref guard; (2) in-page tab-switch protection (§5.K.4) not implemented — all Phase 14 forms live in modals (not inline tabs), so the prerequisite condition does not apply.
| 2026-04-30 | Phase 13 Form Validation implemented (§5.Z). V16 confirmed: `parseLocaleNumber` NOT found — new `src/lib/number/greek-decimal.ts` (~50 lines): `parseGreekDecimal()` (handles Greek keyboard input: `1.200,50` → 1200.5, `12,50` → 12.5) + `formatEuro()` (fixed EUR/el-GR Intl formatter, named to avoid SSoT conflict with `formatCurrency` in `intl-formatting`). V19 confirmed: no UNITS list — new `src/subapps/procurement/utils/units.ts` (~25 lines): `UNITS` const array (16 units), `OTHER_UNIT` sentinel, `isKnownUnit()` predicate. New `src/subapps/procurement/utils/line-validation.ts` (~140 lines): `validateLine(line, ctx)` — hard errors (description required, quantity ≥ 0 max 4 decimals, unit required, price numeric max 6 decimals, vatRate ∈ {0,6,13,24} when vatIncluded=false) + soft warnings (totalMismatch when overridden, quantityMismatch vs rfqQuantity, negativePrice, zeroQuantityWithPrice); `collectInconsistencies()`. New `src/subapps/procurement/utils/quote-validation.ts` (~50 lines): `validateQuote(lines, statedGrandTotal)` — linesSumMismatch (tolerance ±0.01€); `collectQuoteInconsistencies()`. New `src/subapps/procurement/components/QuoteLineEditorTable.tsx` (264 lines): extracted from `ExtractedDataReviewPanel` + enhanced — per-row unit Select from UNITS + "Other..." fallback free-text input, per-row Auto/Override lineTotal toggle (Lock/Unlock icon), per-row inline error display (red text below field), per-row inline warning display (amber text), full row validation via `validateLine()`, `onValidationChange(hasErrors, inconsistencies)` callback to parent. `ExtractedDataReviewPanel.tsx` (456→392 lines): imports `QuoteLineEditorTable` + `validateQuote` + `formatEuro`; replaced raw table with `QuoteLineEditorTable`; added `hasLineErrors`/`bannerDismissed` state; quote-level warning banner (amber, above footer buttons) with [Fix] dismiss + [Save anyway] call; save button disabled when `hasLineErrors`. `RfqLinesPanel.tsx` (193→226 lines): unit field upgraded from free-text Input to unit Select (UNITS list + "Other..." + custom text fallback); `NewLineState` extended with `customUnit: boolean`. i18n: `rfqs.lineEdit.error.*` (5 keys) + `rfqs.lineEdit.warning.*` (8 keys incl. title/buttons) + `rfqs.lineEdit.totalAuto/Override/unitOption.*` (4 keys) + `rfqs.quoteEdit.warning.*` (1 key) = 18 keys added to el+en. Deviations: (1) Inconsistencies in audit metadata (§5.Z.4) deferred to ADR-330 (History panel not yet implemented — no server storage for inconsistencies array); (2) negative `unitPrice` blocked by existing `min(0)` in `UpdateQuoteSchema` (API-level) — UI validation allows it with warning, API blocks at save for now (noted for ADR-333 quote edit flow). |
| 2026-04-30 | Phase 12 Vendor Communication implemented (§5.V, §5.Y). Phase A.0 audit: outbound email exists (`sendReplyViaMailgun` via `po-email-service.ts` pattern) — no ADR-332 needed. New `vendorNotificationDefaults.ts` (~85 lines): 2 default templates (winner/rejection) + `interpolatePlaceholders()` + `buildDefaultTemplate()`. New `vendor-suggestions.ts` (~65 lines): `rankVendors()` — category-based suggested bucket + alphabetical others, graceful fallback when no tags. New `ComparisonWinnerBanner.tsx` (~65 lines): extracted winner banner from RfqDetailClient + «Ενημέρωσε προμηθευτές» CTA (re-notify label when all vendors already notified). New `VendorNotificationDialog.tsx` (~311 lines): per-vendor checklist (auto-detect winner/rejection template), per-row collapsible subject+body editor, per-row send status (idle/sending/sent/failed), batch sequential POST `/api/quotes/{id}/notify-vendor`. New `/api/quotes/[id]/notify-vendor/route.ts`: sends via `sendReplyViaMailgun`, writes `lastNotifiedAt`+`lastNotifiedTemplate` to quote doc, fires `EntityAuditService.recordChange(action:'vendor_notified')` fire-and-forget. New `/api/quotes/[id]/request-renewal/route.ts`: POST `{to,subject,body}` → `sendReplyViaMailgun` — wires stub from Phase 10. `VendorInviteDialog.tsx` rebuilt (~347 lines, §5.Y): multi-select checkboxes (suggested + all vendors buckets), ad-hoc email field with badge list, deadline quick presets (3/5/7/14d), shared subject+body message template, batch send via sequential `createInvite()`. `VendorInviteSection.tsx` extended: `rfq?` + `onViewInvites?` props, `alreadyInvitedIds` Set computed from active invites. `QuoteListCard.tsx`: `notifiedBadge` useMemo — `✉️` info badge with date when `lastNotifiedAt` set; `⚠️` warning badge when `lastNotifiedTemplate` no longer matches current status (stale). `Quote` type: `lastNotifiedAt?: Timestamp`, `lastNotifiedTemplate?: 'winner'\|'rejection'` added. `AuditAction`: `'vendor_notified'` added. `RfqDetailClient.tsx` (498 lines): CheckCircle2+formatCurrency removed (moved to ComparisonWinnerBanner), `ComparisonWinnerBanner` + `VendorNotificationDialog` wired, `notifyDialogOpen` state, renewal `onSend` wired to real API, `rfq` prop passed to `VendorInviteSection`. i18n: `rfqs.notify.*` (16 keys) + `rfqs.invite.*` (17 keys) added to el+en. Deviations: (1) `senderName`/`companyName` passed as empty strings to VendorNotificationDialog — requires company settings lookup (deferred, out of Phase 12 scope); (2) `createRevision()` overflow menu entry still deferred (Phase 12 scope was only invite/notification); (3) Overflow Delete AlertDialog still stub — full implementation deferred per handoff. |
| 2026-04-30 | Phase 11 PDF Preview + Quote Header Actions implemented (§5.I, §5.O). V9 confirmed: no `PdfViewer.tsx` extraction needed — `QuoteOriginalDocumentPanel` (ADR-031/191 SSoT) already reusable. V24 confirmed: browse views already free of confidence%. New `quote-header-actions.ts` (~155 lines): pure factory `buildQuoteHeaderActions()` returning `{ primaryActions, secondaryActions, overflowActions }`. Primary actions status-driven per §5.I.2 (submitted→confirm+reject, under_review→approve+reject, accepted→createPo/viewPo, rejected→restore, draft→edit). Lock rule §5.I.5 via `isLockedByAward()`. Secondary icons: Download (disabled when `source !== scan/email_inbox`), Comments (disabled placeholder), History (disabled placeholder). Overflow: Edit (disabled, §5.CC.3 — future ADR-333), Duplicate (stub), Delete (stub). `QuoteDetailsHeader.tsx` extended (85→~210 lines): new optional props `primaryActions/secondaryActions/overflowActions/pdfOpen/onTogglePdf/hasPdf`; 5 new sub-components: `PrimaryButton` (tooltip on disabled), `SecondaryIcon` (badge support), `PdfToggleButton` (Eye/EyeOff), `OverflowMenu` (DropdownMenu + per-item Tooltip), `ExpiryBanner` (extracted from main). Legacy props (`onEdit`, `onArchive`, `onCreateNew`) preserved for backward compat. `useRfqUrlState.ts` extended: `pdfOpen: boolean` (from `?pdf=1`), `handleTogglePdf` (toggle `?pdf` param via `router.replace`). New `QuoteRightPane.tsx` (~95 lines): extracted right-pane content from `RfqDetailClient` (SRP split, needed for 500-line budget). Renders mobile back button + `QuoteDetailsHeader` + desktop split (`grid-cols-2` when `pdfOpen && !isMobile`) + mobile Dialog modal for PDF. `RfqDetailClient.tsx` modified (472→500 lines): `QuoteRightPane` replaces old right-pane JSX; `patchQuoteStatus` `useCallback` for FSM transitions via `PATCH /api/quotes/{id}` (confirm→under_review, reject→rejected, restore→submitted); `handleStub` for Phase 12+ unimplemented actions; `buildQuoteHeaderActions` in `useMemo`; `pdfOpen`/`handleTogglePdf` from updated `useRfqUrlState`. i18n: `rfqs.quoteHeader.action.*` (9 keys), `rfqs.quoteHeader.tooltip.*` (7 keys incl. comingSoon), `rfqs.quoteHeader.delete.*` (4 keys), `rfqs.pdfPanel.*` (3 keys) added to el+en. Deviations: (1) Overflow Delete/Duplicate are `handleStub` (toast "coming soon") — proper confirmation dialog + API deferred to Phase 12; (2) `hasPdf` derived from `quote.source` heuristic (scan/email_inbox) rather than checking actual file system — accurate enough for toggle disabled state; (3) `QuoteRightPane` is a new extraction file not listed in §7.15 deliverables — added to satisfy N.7.1 file size rule. |
| 2026-04-30 | Phase 15 i18n final pass + finalization. Dead `EntityAuditService` import removed from `quote-service.ts` (V21 cleanup). `datetime.*` keys (13 keys: relative.justNow/minutesAgo/minutesAgo_plural/hoursAgo/hoursAgo_plural/yesterdayAt/daysAgo + deadline.future/today/tomorrow/expiredRecent/expiredOld + empty) added to `src/i18n/locales/{el,en}/common.json` (§5.GG.11). Final pass on `src/i18n/locales/{el,en}/quotes.json` — all keys from §§5.A–5.GG confirmed present (phases 1–14 changelog entries verify each key set). 7 future ADR stubs created: ADR-329 (Quote Comments, §5.R), ADR-330 (Quote History, §5.R), ADR-331 (Construction-Grade Comparison, §5.T), ADR-332 (Outbound Email — RESOLVED NOT NEEDED, V15 cleared in Phase 12), ADR-333 (Quote Edit Dialog, §5.CC), ADR-334 (RFQ Creation Flow, §5.DD), ADR-335 (RFQ Lifecycle, §5.EE). ADR-328 status `PROPOSED → ACCEPTED`. i18n baseline regenerated. |
